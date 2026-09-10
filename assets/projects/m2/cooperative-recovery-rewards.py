"""Ungated shared-policy approach, grasp, lift, carry and grasp-loss recovery.

The sequence implementation is reused for detached reset geometry only. Its
phase transitions, messages, attachment latch and action gating are bypassed.
The policy controls both grippers and all bounded motion at every active step.
"""
from copy import deepcopy
import numpy as np
from gymnasium import spaces
from scipy.spatial.transform import Rotation

from m2_rl.envs.carry_env import CarryEnv
from m2_rl.envs.end_to_end import EndToEndCarryEnv, end_to_end_cfg
from m2_rl.contact_grasp import ContactGrasps, point_velocity
from m2_rl.history import LocalHistory
from m2_rl.measurement_stream import MeasurementStream
from m2_rl.grasp_progress import grasp_error_progress
from m2_rl.managers import ObservationManager, RewardManager, TerminationManager
from m2_rl.managers.base import ObsTermCfg
from m2_rl.managers.termination import TerminationTermCfg
from m2_rl.mdp import terminations as tm
from m2_rl.recovery_observations import actor_history, centralized_state, world_packet, local_frame
from m2_sim.geometry.se3 import SE3Pose, SE3Reference
from m2_planner.spatial_reference import SpatialObjectPath


def contact_acquisition_potential(distance,closure,attached,closure_threshold):
    """No additional acquisition credit for squeezing beyond capture closure."""
    near=np.exp(-(distance/.04)**2)
    return float(near*np.clip(closure/closure_threshold,0.,1.)+float(attached))


def supported_goal_pose_progress(previous_error,current_error,rotation_radius,supported_before,supported_after):
    """Metric goal-distance reduction; cannot earn positive credit by dragging.

    Translation is measured in metres and rotation in radius-scaled radians.
    Unlike route projection, this also responds to lateral drift and incorrect
    orientation. Support affects reward attribution only, never action authority.
    """
    scale=np.r_[np.ones(3),np.full(3,rotation_radius)]
    change=float(np.linalg.norm(np.asarray(previous_error)*scale)-
                 np.linalg.norm(np.asarray(current_error)*scale))
    return change if supported_before and supported_after else min(0.,change)


def cooperative_recovery_cfg(seed=0):
    cfg=end_to_end_cfg(seed)
    cfg.learned_coordination=True;cfg.sequence_version=8;cfg.dynamics_version=3
    cfg.local_actor=True;cfg.base_residual=False;cfg.wait_for_both_controllers=False
    cfg.delayed_grasp=False;cfg.asynchronous_lift=False
    cfg.stages[cfg.start_stage].episode_s=60.
    cfg.stages[cfg.start_stage].events={}
    cfg.payload_overrides={'mass_kg':1.5}
    cfg.hold_in_furnished_scenes=True
    return cfg


class CooperativeRecoveryEnv(EndToEndCarryEnv):
    phase='autonomous'

    def __init__(self,cfg=None,render_mode=None):
        from m2_rl.config import upgrade_config
        cfg=upgrade_config(cfg or cooperative_recovery_cfg())
        self.contact_grasps=ContactGrasps(cfg.recovery.grasp)
        if cfg.recovery.physical_grasp.enabled:
            from m2_rl.native_contact_grasp import NativeContactGrasps
            self.contact_grasps=NativeContactGrasps(cfg.recovery.grasp,cfg.recovery.physical_grasp)
            self._contact_level_pending=cfg.recovery.physical_grasp.level
        self._recovery_ready=False;self._nearby_pose=None;self._path=None
        self._goal_hold=0;self._fault_started=None
        super().__init__(cfg,render_mode)
        self.action_space=spaces.Box(-1.,1.,(23,),dtype=np.float32)

    def action_space_size(self):
        return 23

    def _configure_stage(self):
        CarryEnv._configure_stage(self)
        self.obs_manager=ObservationManager({
            'policy':{'local_sensor_history':ObsTermCfg(actor_history)},
            'critic':{'centralized_state':ObsTermCfg(centralized_state)}},self)
        self.reward_manager=RewardManager({},self,1/self.cfg.control_hz)
        self.termination_manager=TerminationManager({
            'base_overturned':TerminationTermCfg(tm.base_overturned),
            'robot_collision':TerminationTermCfg(tm.robot_collision),
            'time_limit':TerminationTermCfg(tm.time_limit,terminal=False)},self)

    def reset(self,*,seed=None,options=None):
        if self.cfg.recovery.physical_grasp.enabled:
            from m2_rl.native_contact_grasp import restore_native_materials
            restore_native_materials(self)
        self._recovery_ready=False;self.contact_grasps.reset();self._goal_hold=0
        self._nearby_pose=None;self._path=None;self._fault_started=None
        self._fault_physically_exposed_at=None
        _,info=super().reset(seed=seed,options=options)
        limit=self.cfg.recovery.physical_grasp.maximum_payload_mass_kg
        if self.cfg.recovery.physical_grasp.enabled and limit is not None:
            from m2_rl.wrenches import body_subtree
            total=sum(self.model.body_mass[b] for b in body_subtree(self.model,self.bindings.payload_body))
            if total>limit+1e-9:raise ValueError(f'Payload mass {total:.4f} kg exceeds configured maximum {limit:.4f} kg')
        self.phase='autonomous'
        self.curriculum.freeze()
        self.last_action={r:np.zeros(23) for r in self.robot_ids}
        self.prev_action=deepcopy(self.last_action)
        self._closure={(r,s):0. for r in self.robot_ids for s in ('left','right')}
        self._fault_until={};self._fault_recovered=None;self._fault_position=None
        self._upper_body_commands={r:self.data.ctrl[np.r_[self.bindings.torso_actuator[r],
            self.bindings.arm_actuators[r]]].copy() for r in self.robot_ids}
        self._max_fault_travel=0.;self._peak_load=0.;self._max_slip=0.
        self._peak_tilt=0.;self._support_wait_steps=0;self._support_observed_steps=0
        self._regrasp_progress=None;self._post_regrasp_progress=0.
        self._saturated_steps=0;self._evaluated_steps=0
        self._first_full_support_at=None;self._pre_support_travel=0.
        self._reward_totals={};self._episode_reward=0.
        self._progress=0.;self._last_safe_progress=0.
        # Separate from physical-domain sampling; repeated reset(seed) is exact.
        if seed is not None or not hasattr(self,'_recovery_seed'):
            self._recovery_seed=self.cfg.seed if seed is None else seed
            self._recovery_episode=0
        rng=np.random.default_rng(np.random.SeedSequence([self._recovery_seed,self._recovery_episode,17303]))
        self._recovery_episode+=1
        self._fault_armed=bool(rng.random()<self.cfg.recovery.fault_probability)
        self._fault_robot=(str(rng.choice(self.robot_ids)) if self.cfg.recovery.fault_robot=='either'
                           else self.cfg.recovery.fault_robot)
        self._fault_duration=float(rng.uniform(*self.cfg.recovery.fault_duration_s))
        self._fault_progress_m=self.cfg.recovery.fault_after_progress_m
        if self.cfg.recovery.fault_after_progress_range_m is not None:
            trigger_rng=np.random.default_rng(np.random.SeedSequence([
                self._recovery_seed,self._recovery_episode-1,25111]))
            self._fault_progress_m=float(trigger_rng.uniform(*self.cfg.recovery.fault_after_progress_range_m))
        self._control_period={r:int(rng.integers(self.cfg.recovery.control_period_steps[0],
            self.cfg.recovery.control_period_steps[1]+1)) for r in self.robot_ids}
        self._streams={};self._histories={};self._quality={};self._sensor_cache={}
        from m2_rl.grasp_estimate import LocalGraspEstimate
        self._grasp_estimates={(r,s):LocalGraspEstimate(
            self.cfg.recovery.grasp_memory_contact_timeout_s,
            self.cfg.recovery.grasp_memory_max_gap_m,
            self.cfg.recovery.grasp_memory_max_rotation_rad)
            for r in self.robot_ids for s in ('left','right')}
        timing=self.cfg.recovery.sensors
        for r in self.robot_ids:
            self._histories[r]=LocalHistory(self.cfg.recovery.history_length,self.cfg.recovery.history_stride)
            for kind in ('object','hands','odometry'):
                self._streams[r,kind]=MeasurementStream(timing,getattr(timing,kind+'_period_s'),
                    int(rng.integers(2**31)))
        initial=self.measured_pose();c=self.cfg.recovery
        self._initial_position=np.asarray(initial.xyz).copy()
        self._unsupported_origin=self._initial_position.copy()
        self._max_unsupported_segment_travel=0.
        from m2_rl.grasp_safety import GraspSafetyMonitor
        self._grasp_safety=GraspSafetyMonitor(c,self._initial_position[:2])
        # Keep goal sampling independent of fault/control/sensor random streams.
        goal_rng=np.random.default_rng(np.random.SeedSequence([
            self._recovery_seed,self._recovery_episode-1,25109]))
        def sample_goal(constant,ranges):
            if ranges is None:return np.asarray(constant)
            bounds=np.asarray(ranges)
            return goal_rng.uniform(bounds[:,0],bounds[:,1])
        displacement=sample_goal(c.goal_displacement_m,c.goal_displacement_ranges_m)
        rotation_vector=sample_goal(c.goal_rotation_vector_rad,c.goal_rotation_vector_ranges_rad)
        self._sampled_goal={'displacement_object_m':displacement.tolist(),
            'rotation_vector_object_rad':rotation_vector.tolist()}
        lifted=SE3Pose.from_rotation(np.asarray(initial.xyz)+[0,0,displacement[2]],initial.rotation)
        goal=SE3Pose.from_rotation(np.asarray(initial.xyz)+initial.rotation@displacement,
            initial.rotation@Rotation.from_rotvec(rotation_vector).as_matrix())
        poses=[initial]
        if np.linalg.norm(initial.error_to(lifted))>1e-8:poses.append(lifted)
        if np.linalg.norm(poses[-1].error_to(goal))>1e-8:poses.append(goal)
        self.set_spatial_path(poses,refresh=False)
        self._previous_grasp_distance={r:self.grasp_position_error(r) for r in self.robot_ids}
        self._previous_grasp_rotation={r:self.grasp_rotation_error(r) for r in self.robot_ids}
        self._previous_contact_potential={r:0. for r in self.robot_ids}
        self._recovery_ready=True
        if self.cfg.recovery.physical_grasp.enabled:
            contact_rng=np.random.default_rng(np.random.SeedSequence([
                self._recovery_seed,self._recovery_episode-1,28101]))
            self.contact_grasps.configure(self,contact_rng,self._contact_level_pending)
            self._sensor_cache.clear()
        return self._observations(),info|{'phase':'autonomous','spatial_path':self._path.as_dict(),
            'sampled_goal':dict(self._sampled_goal),
            'contact_physics':getattr(self.contact_grasps,'episode_parameters',None)}

    def set_contact_curriculum_level(self,level):
        if not 0<=level<=1:raise ValueError('Contact curriculum level must be in [0,1]')
        self._contact_level_pending=float(level)

    def grasp_reward_target(self,robot,side):
        captured=self.contact_grasps.anchors.get((robot,side))
        if self.cfg.recovery.captured_position_reward and captured is not None:
            body=self.bindings.payload_body
            return self.data.xpos[body]+self.data.xmat[body].reshape(3,3)@captured[0]
        return self.palm_target(robot,side)

    def grasp_position_error(self,robot):
        """Worst hand gap to the configured free/held shaping reference."""
        return max(float(np.linalg.norm(self.grasp_reward_target(robot,side)-
            self.data.site_xpos[self.bindings.palm_site[robot][side]]))
            for side in ('left','right'))

    def grasp_rotation_error(self,robot):
        """True local grasp-frame error for shaping, using captured held frames.

        An attached hand is not rewarded for twisting back to its nominal
        approach frame. A free hand must align as well as approach the rail.
        """
        rotation=self.data.xmat[self.bindings.payload_body].reshape(3,3)
        angles=[]
        for side in ('left','right'):
            key=robot,side;captured=self.contact_grasps.anchors.get(key)
            retain=(self.cfg.recovery.physical_grasp.enabled and
                    self.cfg.recovery.physical_grasp.retain_assigned_orientation)
            relative=captured[1] if captured is not None and not retain else self._palm_nominal_rotation[key]
            actual=self.data.site_xmat[self.bindings.palm_site[robot][side]].reshape(3,3)
            angles.append(np.linalg.norm(Rotation.from_matrix(rotation@relative@actual.T).as_rotvec()))
        return float(np.mean(angles))

    def measured_pose(self):
        body=self.bindings.payload_body
        return SE3Pose.from_rotation(self.data.xpos[body],self.data.xmat[body].reshape(3,3))

    def measured_twist_se3(self):
        p=np.asarray(self.measured_pose().xyz)
        v,w=point_velocity(self.model,self.data,self.bindings.payload_body,p)
        return np.r_[v,w]

    @property
    def pose_reference(self):
        return SE3Reference(self._nearby_pose or self.measured_pose(),final=False)

    def set_spatial_path(self,poses,refresh=True):
        self._path=SpatialObjectPath(poses,self.cfg.recovery.path_rotation_radius_m)
        self._progress=0.
        self._nearby_pose,_=self._path.nearby(self.measured_pose(),0.,self.cfg.recovery.path_lookahead_m)
        self.target_height=self._path.poses[-1].xyz[2]
        self._reference_progress=0.
        if hasattr(self,'_sensor_cache'):self._sensor_cache.clear()
        return self._observations() if refresh else None

    def set_grasp_poses_object(self,poses):
        """Set planner-assigned SE3Pose frames on the object, without moving it.

        The complete mapping is {robot: {'left': pose, 'right': pose}}. It
        changes target geometry only; existing contacts and actions stay physical.
        """
        if set(poses)!=set(self.robot_ids):raise ValueError('Provide hand poses for every robot')
        for robot in self.robot_ids:
            if set(poses[robot])!={'left','right'} or not all(isinstance(p,SE3Pose) for p in poses[robot].values()):
                raise ValueError('Each robot needs left/right SE3Pose object-frame targets')
        for robot,hands in poses.items():
            for side,pose in hands.items():
                self._palm_nominal[robot,side]=np.asarray(pose.xyz).copy()
                self._palm_nominal_rotation[robot,side]=pose.rotation.copy()
        # A planner update is not physical progress; rebase stored potentials.
        self._previous_grasp_distance={r:self.grasp_position_error(r) for r in self.robot_ids}
        self._previous_grasp_rotation={r:self.grasp_rotation_error(r) for r in self.robot_ids}
        self._previous_contact_potential={r:sum(contact_acquisition_potential(
            np.linalg.norm(self.grasp_reward_target(r,s)-self.data.site_xpos[self.bindings.palm_site[r][s]]),
            self._closure[r,s],(r,s) in self.contact_grasps.anchors,self.cfg.recovery.grasp.closure_threshold)
            for s in ('left','right')) for r in self.robot_ids}
        self._sensor_cache.clear()
        return self._observations()

    def _actor_observation(self,robot):
        # This method can be called on PoseEstimator's coherent sensor view.
        # Packet buffers are per robot and updates are cached at control time.
        stamp=float(self.elapsed_s)
        if self._sensor_cache.get(robot,(None,None))[0]==stamp:
            return self._sensor_cache[robot][1].copy()
        fresh=world_packet(self,robot);packets={};quality=[]
        zero_pose=(np.zeros(3),np.eye(3),np.zeros(3),np.zeros(3))
        for kind in ('object','hands','odometry'):
            value,age,valid=self._streams[robot,kind].read(stamp,fresh[kind])
            if value is None:
                value={s:zero_pose for s in ('left','right')} if kind=='hands' else zero_pose
            packets[kind]=value;quality.extend([age,float(valid)])
        self._quality[robot]=quality
        if self.cfg.recovery.observe_grasp_memory:
            valid=bool(quality[1] and quality[3] and
                       max(quality[0],quality[2])<=self.cfg.recovery.sensors.stale_after_s)
            for side in ('left','right'):
                self._grasp_estimates[robot,side].update(stamp,packets['object'][:2],
                    packets['hands'][side][:2],self._closure[robot,side],
                    bool(self.hand_rail_contacts(robot,side)),valid,
                    self.cfg.recovery.grasp.closure_threshold,self.cfg.recovery.grasp.release_threshold)
        values=local_frame(self,robot,packets,quality)
        frame=np.concatenate(list(values.values()))
        result=self._histories[robot].push(frame,self._steps)
        self._sensor_cache[robot]=(stamp,result.copy())
        return result

    def _try_late_grasp(self):
        pass

    def _update_messages(self):
        pass

    def close_grasp_if_ready(self):
        # Physical contact attachment is exclusively driven by gripper action.
        return False

    def local_phase(self,robot):
        return 'autonomous'

    def requested_lift_height(self,robot):
        return self.target_height

    def grasp_engaged(self,robot):
        return self.contact_grasps.engaged(robot)

    def grasp_slip_m(self,robot):
        return max((self.contact_grasps.slips.get((robot,s),0.) for s in ('left','right')
                    if (robot,s) in self.contact_grasps.anchors),default=0.)

    def grasp_wrench(self,robot):
        body=self.bindings.chassis_body[robot]
        base=self.data.xmat[body].reshape(3,3)
        values=[self.contact_grasps.wrenches.get((robot,s),np.zeros(6)) for s in ('left','right')]
        if self.cfg.recovery.load_observation_mode=='total_contact':
            values=[]
            for side in ('left','right'):
                wrench=self.hand_grasp_wrench_world(robot,side)
                palm=self.data.site_xpos[self.bindings.palm_site[robot][side]]
                wrench[3:]+=np.cross(palm-self.data.xpos[body],wrench[:3])
                values.append(wrench)
        net=np.sum(values,axis=0)
        return np.r_[base.T@net[:3],base.T@net[3:]]

    def robot_diagnostics(self,robot):
        status=CarryEnv.robot_diagnostics(self,robot)
        rotation=self.measured_pose().rotation;origin=np.asarray(self.measured_pose().xyz)
        for side in ('left','right'):
            key=robot,side;site=self.bindings.palm_site[robot][side]
            anchor=self.contact_grasps.anchors.get(key)
            active=anchor is not None
            position=rotation.T@(self.data.site_xpos[site]-origin)
            reference=anchor[0] if active else self._palm_nominal.get(key,position)
            reference_rotation=anchor[1] if active else self._palm_nominal_rotation.get(key,np.eye(3))
            orientation=rotation.T@self.data.site_xmat[site].reshape(3,3)
            status['hands'][side].update(contact_attachment_active=active,
                slip_m=float(np.linalg.norm(position-reference)),
                rotation_deg=float(np.rad2deg(np.linalg.norm(Rotation.from_matrix(
                    orientation@reference_rotation.T).as_rotvec()))))
        status.update(grasp_model='finite_compliant_contact',base_feedforward_command=[0.,0.,0.],
            payload_force_world_n=(-sum((self.contact_grasps.wrenches.get((robot,s),np.zeros(6))[:3]
                for s in ('left','right')))).tolist(),
            force_scope='attachment spring reaction only; direct finger contact forces are additional',
            measurement_quality=getattr(self,'_quality',{}).get(robot))
        status['attachment_force_world_n']=status['payload_force_world_n'].copy()
        if self.cfg.recovery.load_observation_mode=='total_contact':
            status['payload_force_world_n']=(-sum(self.hand_grasp_wrench_world(robot,s)[:3]
                for s in ('left','right'))).tolist()
            status['force_scope']='total object reaction: direct hand contacts plus finite attachment spring; simulation only'
        if self.cfg.recovery.physical_grasp.enabled:
            status.update(grasp_model='native_finger_contact',force_scope='Native MuJoCo hand-object contacts only',
                grasp_work_j=self.contact_grasps.work_j.get(robot,0.),
                grasp_effort_nm2_s=self.contact_grasps.effort_nm2_s.get(robot,0.))
            for side in ('left','right'):
                status['hands'][side].update(physical_grasp=self.contact_grasps.quality.get((robot,side),{}),
                    contact_attachment_active=False,
                    measured_grasp_active=(robot,side) in self.contact_grasps.anchors)
        return status

    def hand_grasp_wrench_world(self,robot,side):
        """Full object reaction on this hand, expressed about its palm origin."""
        from m2_rl.wrenches import contact_wrench_on_bodies
        model,data=self.model,self.data;key=robot,side
        self._cache_contact_body_groups()
        palm=data.site_xpos[self.bindings.palm_site[robot][side]]
        result=contact_wrench_on_bodies(model,data,self._wrench_hand_bodies[key],
                                        self._wrench_payload_bodies,palm)
        spring=self.contact_grasps.wrenches.get(key,np.zeros(6))
        result+=spring
        captured=self.contact_grasps.anchors.get(key)
        if captured is not None:
            origin=data.xpos[self.bindings.payload_body]
            rotation=data.xmat[self.bindings.payload_body].reshape(3,3)
            point=(origin+rotation@captured[0]+palm)/2.
            result[3:]+=np.cross(point-palm,spring[:3])
        return result

    def hand_rail_contacts(self,robot,side):
        """Filter live contact arrays by immutable rail/body identities first."""
        import mujoco
        self._cache_contact_body_groups()
        model,data=self.model,self.data;key=robot,side
        rail=self._wrench_rail_geoms[key]
        contacts=data.contact;geoms=contacts.geom[:data.ncon]
        bodies=model.geom_bodyid[geoms];own=self._wrench_hand_masks[key]
        matches=((geoms[:,0]==rail)&own[bodies[:,1]])|((geoms[:,1]==rail)&own[bodies[:,0]])
        indices=np.flatnonzero(matches & (contacts.dist[:data.ncon]<=0.))
        records=[]
        for index in indices:
            contact=contacts[int(index)];force=np.zeros(6)
            mujoco.mj_contactForce(model,data,int(index),force)
            if force[0]>.1:
                records.append({'bodies':[model.body(int(body)).name or '' for body in bodies[index]],
                    'geoms':[model.geom(int(g)).name or '' for g in geoms[index]],
                    'position_world_m':contact.pos.tolist(),'normal_force_n':float(force[0]),
                    'penetration_m':float(-contact.dist)})
        return records

    def _cache_contact_body_groups(self):
        from m2_rl.wrenches import body_subtree
        model=self.model
        if getattr(self,'_wrench_body_model',None) is not model:
            self._wrench_body_model=model
            self._wrench_payload_bodies=body_subtree(model,self.bindings.payload_body)
            self._wrench_hand_bodies={(r,s):body_subtree(model,int(model.site_bodyid[
                self.bindings.palm_site[r][s]])) for r in self.robot_ids for s in ('left','right')}
            from m2_sim.builder.payloads import assigned_hand_rail_name
            self._wrench_hand_masks={key:np.isin(np.arange(model.nbody),list(bodies))
                for key,bodies in self._wrench_hand_bodies.items()}
            self._wrench_rail_geoms={(r,s):model.geom(assigned_hand_rail_name(model,
                self.bindings.rail_sites.index(self.assigned_rail(r)),s)).id
                for r in self.robot_ids for s in ('left','right')}

    def _apply_action(self,robot,action):
        if not self._recovery_ready:
            return CarryEnv._apply_action(self,robot,np.asarray(action)[:21])
        c=self.cfg.recovery;b=self.bindings;dt=1/self.cfg.physics_hz
        a=np.asarray(action).copy()
        quality=self._quality.get(robot,[0.,1.]*3)
        # A local communication-loss stop is an explicit nonlearned safety
        # boundary; it never checks partner readiness/contact.
        stopped=(self.elapsed_s<self._policy_start_at[robot] or
                 max(quality[0::2])>c.sensors.communication_stop_after_s)
        if stopped:
            a[:]=0.
        a[3:21]=np.where(np.abs(a[3:21])<c.motion_rate_deadband,0.,a[3:21])
        a[21:]=np.where(np.abs(a[21:])<c.gripper_rate_deadband,0.,a[21:])
        arms=b.arm_actuators[robot];lift=b.lift_actuator[robot];torso=b.torso_actuator[robot]
        measured=self.data.qpos[self.model.jnt_qposadr[self.model.actuator_trnid[arms,0]]]
        current=self.data.ctrl[arms]
        arm_delta=a[5:21]*c.arm_rate_rad_s*dt
        torso_delta=a[4]*c.torso_rate_rad_s*dt
        if c.upper_body_command_mode in ('position','incremental_position'):
            desired=(self._upper_body_commands[robot][1:] if c.upper_body_command_mode=='incremental_position'
                     else self.nominal_ctrl[arms]+a[5:21]*self.cfg.action_scale_arm_rad)
            arm_delta=np.clip(desired-current,-c.arm_rate_rad_s*dt,c.arm_rate_rad_s*dt)
            desired_torso=(self._upper_body_commands[robot][0] if c.upper_body_command_mode=='incremental_position'
                           else self.nominal_ctrl[torso]+a[4]*self.cfg.action_scale_torso_rad)
            torso_delta=np.clip(desired_torso-self.data.ctrl[torso],-c.torso_rate_rad_s*dt,c.torso_rate_rad_s*dt)
            if stopped:arm_delta=np.zeros_like(arm_delta);torso_delta=0.
        # Do not jump an already lagging target on zero input. Further travel
        # away from the measured joint is blocked; recovery toward it is free.
        arm_target=np.clip(current+arm_delta,
            np.minimum(current,measured-c.joint_target_error_rad),
            np.maximum(current,measured+c.joint_target_error_rad))
        lift_target=self.data.ctrl[lift]+a[3]*c.lift_rate_m_s*dt
        torso_target=self.data.ctrl[torso]+torso_delta
        if c.upper_body_command_mode=='bounded_rate':
            # Same own-neutral position envelope as position mode, expressed
            # through rate commands. Zero holds, including an already lagging
            # target; reaching a boundary never consults grasp or partner state.
            arm_target=np.clip(arm_target,
                np.minimum(current,self.nominal_ctrl[arms]-self.cfg.action_scale_arm_rad),
                np.maximum(current,self.nominal_ctrl[arms]+self.cfg.action_scale_arm_rad))
            torso_target=np.clip(torso_target,
                min(self.data.ctrl[torso],self.nominal_ctrl[torso]-self.cfg.action_scale_torso_rad),
                max(self.data.ctrl[torso],self.nominal_ctrl[torso]+self.cfg.action_scale_torso_rad))
        # Reuse wheel kinematics, motor limits and acceleration limits only.
        # base_residual is forbidden; there is no path-following feedforward.
        decoded=np.zeros(21);decoded[:3]=a[:3]
        speed=float(np.linalg.norm(decoded[:2])*self.cfg.action_scale_base_lin)
        if speed>c.speed_limit_m_s:decoded[:2]*=c.speed_limit_m_s/speed
        decoded[3]=(lift_target-self.nominal_ctrl[lift])/self.cfg.action_scale_lift_m
        decoded[4]=(torso_target-self.nominal_ctrl[torso])/self.cfg.action_scale_torso_rad
        decoded[5:]=(arm_target-self.nominal_ctrl[arms])/self.cfg.action_scale_arm_rad
        self.stage.control_base=True
        self.stage.arm_scale=self.stage.lift_scale=self.stage.torso_scale=1.
        CarryEnv._apply_action(self,robot,decoded)
        for i,side in enumerate(('left','right')):
            key=robot,side
            current_closure=self._closure[key]
            max_change=dt*c.grasp.closure_rate_s
            if c.gripper_command_mode=='position':
                target=(float(a[21+i])+1.)*.5
                change=np.clip(target-current_closure,-max_change,max_change)
            else:
                # Zero rate holds; negative opens; positive closes.
                change=a[21+i]*max_change
            closure=np.clip(current_closure+(0. if stopped else change),0.,1.)
            if self.elapsed_s<self._fault_until.get(robot,-1.):closure=0.
            self._closure[key]=float(closure)
            for act in b.hand_actuators[robot]:
                name=self.model.actuator(int(act)).name
                if ('Left' if side=='left' else 'Right') not in name:continue
                # Flexion synergies are bounded by the actual actuator range.
                targets=({'MCP':c.grasp.thumb_mcp_rad,'PIP':c.grasp.thumb_pip_rad,
                          'DIP':c.grasp.thumb_dip_rad,'Abd':c.grasp.thumb_abduction_rad} if 'Thumb' in name else
                         {'MCP':c.grasp.finger_mcp_rad,'PIP':c.grasp.finger_pip_rad})
                target=next((value*closure for suffix,value in targets.items() if name.endswith(suffix)),0.)
                if c.physical_grasp.enabled and c.physical_grasp.open_hand_from_joint_reference:
                    joint=int(self.model.actuator_trnid[act,0])
                    opened=float(self.model.qpos0[self.model.jnt_qposadr[joint]])
                    closed=next((value for suffix,value in targets.items() if name.endswith(suffix)),opened)
                    target=(1.-closure)*opened+closure*closed
                self.data.ctrl[act]=np.clip(target,*self.model.actuator_ctrlrange[act])

    def _apply_external_wrench(self):
        CarryEnv._apply_external_wrench(self)
        if self._recovery_ready:
            disabled=[r for r,t in self._fault_until.items() if self.elapsed_s<t]
            self.contact_grasps.apply(self,self._closure,disabled)

    def inject_grasp_loss(self,robot,duration_s):
        """Evaluation intervention: release both hands; never teleport the object."""
        if robot not in self.robot_ids or not np.isfinite(duration_s) or duration_s<=0:
            raise ValueError('Grasp loss requires a known robot and positive duration')
        self._fault_until[robot]=self.elapsed_s+duration_s
        self._fault_robot=robot
        self._fault_started=self.elapsed_s
        self._fault_position=np.array(self.measured_pose().xyz)
        for side in ('left','right'):
            if not self.cfg.recovery.physical_grasp.enabled:
                self.contact_grasps.release((robot,side),self.elapsed_s,'injected_grasp_loss')
        self.phase_events.append({'time_s':self.elapsed_s,'phase':'injected_grasp_loss','robot':robot})

    def _task_physics_failures(self):
        if not self._recovery_ready:return []
        if self.cfg.recovery.physical_grasp.enabled:self.contact_grasps.observe(self)
        if not np.isfinite(self.data.qpos).all() or not np.isfinite(self.data.qvel).all():
            return [{'reason':'nonfinite_state'}]
        # Compare to nearby planner orientation: commanded flips are permitted.
        error=self.measured_pose().error_to(self._nearby_pose)
        c=self.cfg.recovery
        limit=c.grasp_safety.hard_orientation_limit_rad if c.grasp_safety.enabled else c.unsafe_tilt_rad
        if np.linalg.norm(error[3:])>limit:
            return [{'reason':'unsafe_object_orientation','error_rad':float(np.linalg.norm(error[3:])),'limit_rad':limit}]
        from m2_rl.se3_safety import carried_contact_failures,unintended_payload_contact_failures
        from m2_sim.config import IDENTITIES
        prefixes=tuple(IDENTITIES[r].prefix for r in self.robot_ids)
        self._cache_contact_body_groups()
        failures=[f for f in carried_contact_failures(self.model,self.data,self.bindings.payload_body,
            prefixes) if f['reason']=='robot_self_penetration']
        failures.extend(unintended_payload_contact_failures(self.model,self.data,
            self._wrench_payload_bodies,set().union(*self._wrench_hand_bodies.values()),
            prefixes,self.cfg.recovery.unintended_contact_force_n))
        if self.cfg.recovery.physical_grasp.enabled:
            limit=self.cfg.recovery.physical_grasp.maximum_contact_penetration_m
            for (robot,side),quality in self.contact_grasps.quality.items():
                if quality['penetration_m']>limit:
                    failures.append({'reason':'hand_object_penetration','robot':robot,'hand':side,
                        'penetration_m':quality['penetration_m'],'limit_m':limit})
        return failures

    def stage_success(self):
        c=self.cfg.recovery
        return bool(self._goal_hold>=int(np.ceil(c.success_hold_s*self.cfg.control_hz))
            and (not c.require_fault_recovery or self._fault_recovered is not None))

    def step(self,action):
        physical=self.cfg.recovery.physical_grasp.enabled
        if physical:
            previous_contact={'work_j':dict(self.contact_grasps.work_j),
                'effort':dict(self.contact_grasps.effort_nm2_s),'acquisitions':dict(self.contact_grasps.acquisitions)}
            if self.cfg.recovery.physical_grasp.rewards.aligned_closure:
                from m2_rl.native_contact_grasp import measured_closure_potential
                previous_contact['closure_potential']={r:measured_closure_potential(self,r) for r in self.robot_ids}
        acts=self._as_dict(action)
        for r in self.robot_ids:
            if self._steps%self._control_period[r]:acts[r]=self.last_action[r].copy()
            elif self.cfg.recovery.upper_body_command_mode=='incremental_position':
                # Accept one bounded motor-target increment on this robot's
                # own control tick, then hold that target between updates.
                # This is local motor semantics; no object/partner phase gate.
                b=self.bindings;c=self.cfg.recovery
                indices=np.r_[b.torso_actuator[r],b.arm_actuators[r]]
                current=self.data.ctrl[indices]
                quality=self._quality.get(r,[0.,1.]*3)
                stopped=(self.elapsed_s<self._policy_start_at[r] or
                         max(quality[0::2])>c.sensors.communication_stop_after_s)
                horizon=self._control_period[r] if c.incremental_use_control_period else 1
                delta=np.asarray(acts[r])[4:21]*np.r_[c.torso_rate_rad_s,np.full(16,c.arm_rate_rad_s)]*horizon/self.cfg.control_hz
                limits=np.r_[self.cfg.action_scale_torso_rad,np.full(16,self.cfg.action_scale_arm_rad)]
                self._upper_body_commands[r]=(current.copy() if stopped else
                    np.clip(current+delta,np.minimum(current,self.nominal_ctrl[indices]-limits),
                            np.maximum(current,self.nominal_ctrl[indices]+limits)))
        old_position=np.array(self.measured_pose().xyz)
        old_goal_error=self.measured_pose().error_to(self._path.poses[-1])
        old_progress=self._progress
        old_grasp_event_count=len(self.contact_grasps.events)
        old_supported=all(self.grasp_engaged(r) for r in self.robot_ids)
        # Build sensor/history observations once, after the spatial reference
        # and fault state have been updated below. Public Gym output is unchanged.
        _,_,terminated,truncated,info=CarryEnv.step(self,acts,collect_observations=False)
        c=self.cfg.recovery;w=c.rewards;dt=1/self.cfg.control_hz
        actual=self.measured_pose()
        self._progress=self._path.project(actual,self._progress)
        # The broadcast target must follow an estimated object state too.
        # Physical truth is reserved for rewards/evaluation. No robot or grasp
        # readiness signal is consulted by this spatial reference update.
        estimate=self.pose_estimator.view(self,self.robot_ids[0]).measured_pose()
        self._nearby_pose,self._reference_progress=self._path.nearby(
            estimate,self._reference_progress,c.path_lookahead_m)
        supported=all(self.grasp_engaged(r) for r in self.robot_ids)
        if self._first_full_support_at is None:
            self._pre_support_travel=max(self._pre_support_travel,float(np.linalg.norm(
                (np.asarray(actual.xyz)-self._initial_position)[:2])))
            if supported:self._first_full_support_at=self.elapsed_s
        if (self._fault_armed and self._fault_started is None and supported
                and self._progress>=self._fault_progress_m
                and actual.xyz[2]>self.initial_height+.03 and not (terminated or truncated)):
            self.inject_grasp_loss(self._fault_robot,self._fault_duration)
            if not physical:supported=False
        if self._fault_started is not None:
            if physical and self._fault_physically_exposed_at is None and not any(
                    self.contact_grasps.quality[self._fault_robot,s]['qualified'] for s in ('left','right')):
                self._fault_physically_exposed_at=self.elapsed_s
            if not supported:
                self._max_fault_travel=max(self._max_fault_travel,float(np.linalg.norm(
                    (np.asarray(actual.xyz)-self._fault_position)[:2])))
            elif self._fault_recovered is None and (not physical or self._fault_physically_exposed_at is not None):
                self._fault_recovered=self.elapsed_s
                self._regrasp_progress=self._progress
                self.phase_events.append({'time_s':self.elapsed_s,'phase':'regrasped'})
        if not supported:
            if self._unsupported_origin is None:self._unsupported_origin=old_position.copy()
            self._max_unsupported_segment_travel=max(self._max_unsupported_segment_travel,
                float(np.linalg.norm((np.asarray(actual.xyz)-self._unsupported_origin)[:2])))
        else:self._unsupported_origin=None
        if c.grasp_safety.enabled:
            safety_failures=self._grasp_safety.advance(self.elapsed_s,actual.xyz[:2],
                float(np.linalg.norm(actual.error_to(self._nearby_pose)[3:])),supported)
            if safety_failures:
                terminated=True
                info.setdefault('terminations',[]).extend(f['reason'] for f in safety_failures)
                info.setdefault('task_physics_failures',[]).extend(safety_failures)
        elif self._max_unsupported_segment_travel>c.unsupported_travel_limit_m:
            terminated=True
            info.setdefault('terminations',[]).append('unsupported_object_travel')
            info.setdefault('task_physics_failures',[]).append({'reason':'unsupported_object_travel',
                'distance_m':self._max_unsupported_segment_travel,'limit_m':c.unsupported_travel_limit_m})
        goal_error=actual.error_to(self._path.poses[-1])
        good=(supported and np.linalg.norm(goal_error[:3])<c.position_tolerance_m
              and np.linalg.norm(goal_error[3:])<c.orientation_tolerance_rad
              and np.linalg.norm(self.measured_twist_se3())<.05)
        if physical:
            from m2_rl.native_contact_grasp import planner_palm_alignment_accepted
            good=good and planner_palm_alignment_accepted(self)
        self._goal_hold=self._goal_hold+1 if good and not terminated else 0
        success=self.stage_success() and not terminated
        shared_progress=(self._progress-old_progress) if old_supported and supported else min(0.,self._progress-old_progress)
        travel=np.linalg.norm((np.asarray(actual.xyz)-old_position)[:2])
        tilt=np.linalg.norm(actual.error_to(self._nearby_pose)[3:])
        self._peak_tilt=max(self._peak_tilt,float(tilt))
        if self._fault_started is not None and self._fault_recovered is None:
            supporter=next(r for r in self.robot_ids if r!=self._fault_robot)
            if self.grasp_engaged(supporter):
                body=self.bindings.chassis_body[supporter]
                velocity,omega=point_velocity(self.model,self.data,body,self.data.xpos[body])
                self._support_observed_steps+=1
                self._support_wait_steps+=int(np.linalg.norm(velocity[:2])<.025 and abs(omega[2])<.08)
        if supported and self._regrasp_progress is not None:
            self._post_regrasp_progress=max(self._post_regrasp_progress,self._progress-self._regrasp_progress)
        force_range=self.model.actuator_forcerange
        limited=self.model.actuator_forcelimited.astype(bool)
        force=self.data.actuator_force
        saturated=limited & ((force<=force_range[:,0]*.98)|(force>=force_range[:,1]*.98))
        self._saturated_steps+=int(np.any(saturated));self._evaluated_steps+=1
        components={};rewards={}
        for robot in self.robot_ids:
            gap=self.grasp_position_error(robot)
            delta,self._previous_grasp_distance[robot]=grasp_error_progress(
                self._previous_grasp_distance[robot],gap,c.grasp_progress_mode,.05)
            angle=self.grasp_rotation_error(robot)
            angle_progress,self._previous_grasp_rotation[robot]=grasp_error_progress(
                self._previous_grasp_rotation[robot],angle,c.grasp_progress_mode,.02)
            potential=0.
            for side in ('left','right'):
                key=robot,side
                distance=np.linalg.norm(self.grasp_reward_target(robot,side)-self.data.site_xpos[self.bindings.palm_site[robot][side]])
                potential+=contact_acquisition_potential(distance,self._closure[key],
                    key in self.contact_grasps.anchors,c.grasp.closure_threshold)
            contact_progress=potential-self._previous_contact_potential[robot]
            self._previous_contact_potential[robot]=potential
            load=np.linalg.norm(self.grasp_wrench(robot)[:3]);slip=self.grasp_slip_m(robot)
            self._peak_load=(max(self._peak_load,float(load)) if c.load_observation_mode=='total_contact'
                             else self.contact_grasps.peak_net_load_n)
            self._max_slip=self.contact_grasps.peak_attached_slip_m
            parts={'grasp_progress':w.grasp_progress*delta,
                'grasp_rotation_progress':w.grasp_rotation_progress*angle_progress,
                'contact_progress':w.contact_progress*contact_progress,
                'grasp_loss':-w.grasp_loss*sum(
                    event.get('event')=='release' and event.get('robot')==robot
                    and event.get('reason') in ('policy_open','grasp_capacity_exceeded')
                    for event in self.contact_grasps.events[old_grasp_event_count:]),
                'grasp_proximity':w.grasp_proximity*np.exp(-(gap/.08)**2)*dt,
                'supported_progress':w.supported_progress*shared_progress,
                'goal_pose_progress':w.goal_pose_progress*supported_goal_pose_progress(
                    old_goal_error,goal_error,c.path_rotation_radius_m,old_supported,supported),
                'supported_lift_progress':w.supported_lift_progress*supported_goal_pose_progress(
                    [0.,0.,old_goal_error[2],0.,0.,0.],[0.,0.,goal_error[2],0.,0.,0.],
                    c.path_rotation_radius_m,old_supported,supported),
                'stable_goal':w.stable_goal*float(good)*dt,
                'unsupported_travel':-w.unsupported_travel*travel*float(not supported),
                'slip':-w.slip*min(slip,.1)*float(self.grasp_engaged(robot))*dt,
                'load':-w.load*(load/max(1.,2*c.grasp.max_force_n))**2*dt,
                'tilt':-w.tilt*(self._grasp_safety.tilt_cost(tilt) if c.grasp_safety.enabled else tilt**2)*dt,
                'upright_torso':-w.upright_torso*self.torso_pitch(robot)**2*dt,
                'action_rate':-w.action_rate*np.sum((self.last_action[robot]-self.prev_action[robot])**2)*dt,
                'time':-w.time*dt,'success':w.success*float(success),'failure':-w.failure*float(terminated)}
            if physical:
                from m2_rl.native_contact_grasp import physical_reward_parts,penalized_grasp_releases
                parts['grasp_loss']=-w.grasp_loss*penalized_grasp_releases(
                    self.contact_grasps.events[old_grasp_event_count:],robot,self._fault_until)
                parts.update(physical_reward_parts(self,robot,previous_contact,dt))
            components[robot]=parts;rewards[robot]=float(sum(parts.values()))
            for key,value in parts.items():self._reward_totals[key]=self._reward_totals.get(key,0.)+value/len(self.robot_ids)
        # Reference refresh must not add history samples or advance its clock.
        self._sensor_cache.clear()
        obs=self._observations()
        info.update(success=success,phase='autonomous',reward_components=components,
            episode_reward_components=dict(self._reward_totals),phase_events=list(self.phase_events),
            pose_reference=self.pose_reference.as_dict(),spatial_progress_m=self._progress,
            grasp_events=list(self.contact_grasps.events),recovery={
                'grasp_safety':dict(self._grasp_safety.last) if c.grasp_safety.enabled else {'enabled':False},
                'fault_armed':self._fault_armed,'fault_started_s':self._fault_started,
                'fault_trigger_progress_m':self._fault_progress_m,
                'fault_robot':self._fault_robot if self._fault_started is not None else None,
                'regrasped_s':self._fault_recovered,'max_unsupported_travel_m':self._max_fault_travel,
                'peak_load_n':self._peak_load,'max_slip_m':self._max_slip,
                'load_scope':c.load_observation_mode,
                'peak_attachment_load_n':self.contact_grasps.peak_net_load_n,
                'peak_orientation_error_rad':self._peak_tilt,
                'first_full_support_s':self._first_full_support_at,
                'pre_support_max_xy_m':self._pre_support_travel,
                'max_unsupported_segment_travel_m':self._max_unsupported_segment_travel,
                'capacity_releases':sum(e.get('reason')=='grasp_capacity_exceeded' for e in self.contact_grasps.events),
                'policy_open_releases':sum(e.get('reason')=='policy_open' for e in self.contact_grasps.events),
                'supporter_wait_fraction':(self._support_wait_steps/self._support_observed_steps
                    if self._support_observed_steps else None),
                'supporter_observed_s':self._support_observed_steps*dt,
                'post_regrasp_progress_m':self._post_regrasp_progress,
                'actuator_saturation_fraction':self._saturated_steps/self._evaluated_steps,
                'goal_error_se3':goal_error.tolist()},
            grasp_model='native_finger_contact' if physical else 'finite compliant contact proxy; no permanent welds')
        if physical:
            info['contact_physics']=dict(self.contact_grasps.episode_parameters)
            info['physical_grasps']={'/'.join(key):dict(value) for key,value in self.contact_grasps.quality.items()}
            info['grasp_mechanical_work_j']=dict(self.contact_grasps.work_j)
            info['grasp_holding_effort_nm2_s']=dict(self.contact_grasps.effort_nm2_s)
            info['recovery']['fault_physically_exposed_s']=self._fault_physically_exposed_at
        return obs,rewards,bool(terminated or success),bool(truncated and not success),info

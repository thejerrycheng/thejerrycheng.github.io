"""Observe actual finger/palm contacts. This module never applies a grasp force.

The recorded anchors are measurements for drift/reward only, never constraints.
Normal opposition and cone utilization are interpretable quality proxies; they
are not a proof of six-dimensional force closure. Episode success is measured
with the free object's physical motion and all required hand contacts.
"""
import mujoco
import numpy as np
from m2_rl.contact_grasp import ContactGrasps,point_velocity


def configure_hand_motors(model,bindings,cfg):
    """Explicit bounded robot actuation; no force is applied to the payload.

    MJCF body childclass does not assign defaults to top-level actuators.
    The original hand position elements therefore compiled as kp=1 with no
    force cap. Restore the declared hand gains/cap before reset settling.
    """
    for robot in bindings.robot_ids:
        wrists=[a for a in bindings.arm_actuators[robot] if model.actuator(int(a)).name.endswith('Wrist')]
        acts=np.r_[bindings.hand_actuators[robot],wrists].astype(int)
        model.actuator_gainprm[acts,0]=cfg.hand_position_gain_nm_rad
        model.actuator_biasprm[acts,1]=-cfg.hand_position_gain_nm_rad
        model.actuator_biasprm[acts,2]=-cfg.hand_velocity_gain_nm_s_rad
        model.actuator_forcelimited[acts]=1
        model.actuator_forcerange[acts]=[-cfg.hand_torque_limit_nm,cfg.hand_torque_limit_nm]


_MATERIAL_FIELDS=('geom_friction','geom_condim','geom_priority','geom_solref','geom_solimp','dof_damping')


def restore_native_materials(env):
    """Reset settling must not inherit the preceding episode's sampled material."""
    defaults=getattr(env,'_native_material_defaults',None)
    if defaults is not None and defaults['model'] is env.model:
        for field in _MATERIAL_FIELDS:getattr(env.model,field)[:]=defaults[field]
        env.model.opt.cone=defaults['cone']


def contact_quality(records,cfg):
    if not records:
        return dict(contact_count=0,normal_force_n=0.,opposition=0.,slip_speed_m_s=0.,
            friction_utilization=0.,friction_margin=0.,firmness=0.,qualified=False,penetration_m=0.)
    force=np.array([r['normal_force_n'] for r in records]);total=float(force.sum())
    normals=np.array([r['normal_world'] for r in records]);bodies=np.array([r['hand_body'] for r in records])
    opposite=(1.-normals@normals.T)*.5
    opposite[bodies[:,None]==bodies[None,:]]=0.
    opposition=float(np.clip(opposite.max(),0.,1.))
    slip=float(np.dot(force,[r['slip_speed_m_s'] for r in records])/max(total,1e-12))
    utilization=float(max(r['friction_utilization'] for r in records))
    margin=float(np.clip(1.-utilization,0.,1.))
    firm=float(min(total/cfg.target_normal_force_n,1.)*opposition)
    qualified=(opposition>=cfg.opposition_threshold and total>=cfg.minimum_normal_force_n
        and slip<=cfg.slip_speed_limit_m_s)
    return dict(contact_count=len(records),normal_force_n=total,opposition=opposition,
        slip_speed_m_s=slip,friction_utilization=utilization,friction_margin=margin,
        firmness=firm,qualified=bool(qualified),penetration_m=max(r['penetration_m'] for r in records))


class NativeContactGrasps(ContactGrasps):
    """ContactGrasps-compatible diagnostic state with NO attachment dynamics."""
    def __init__(self,grasp_cfg,physics_cfg):
        self.physics_cfg=physics_cfg
        super().__init__(grasp_cfg)

    def reset(self):
        super().reset()
        self.quality={};self.contacts={};self.work_j={};self.effort_nm2_s={}
        self._dwell={};self._unqualified_time={};self._last_physics_time=None;self._first_acquisition=set()
        self.acquisitions={};self.episode_parameters={}

    def configure(self,env,rng,level):
        env._cache_contact_body_groups();model=env.model;c=self.physics_cfg
        if env.bindings.weld_eq:raise ValueError('Native grasp model must contain no grasp welds')
        if getattr(env,'_native_material_defaults',{}).get('model') is not model:
            env._native_material_defaults={field:getattr(model,field).copy() for field in _MATERIAL_FIELDS}
            env._native_material_defaults.update(model=model,cone=model.opt.cone)
        self.level=float(level)
        low,high=(1-self.level)*np.asarray(c.easy_sliding_friction)+self.level*np.asarray(c.full_sliding_friction)
        hands={};parameters={};self._hand_acts={}
        materials={r:(float(rng.uniform(low,high)),float(rng.uniform(*c.torsional_friction_m)),
            float(rng.uniform(*c.contact_time_constant_s)),float(rng.uniform(*c.contact_damping_ratio)))
            for r in env.robot_ids}
        for key,bodies in env._wrench_hand_bodies.items():
            geom=np.flatnonzero(np.isin(model.geom_bodyid,list(bodies)) & ((model.geom_contype!=0)|(model.geom_conaffinity!=0)))
            hands[key]=geom
            rail=env._wrench_rail_geoms[key]
            # Hands sharing one rail share its material, so MuJoCo's maximum
            # mixing rule cannot silently override a supposedly sampled value.
            mu,torsion,tc,ratio=materials[key[0]]
            selected=np.r_[geom,rail]
            model.geom_friction[selected]=[mu,torsion,0.]
            model.geom_condim[selected]=4;model.geom_priority[selected]=2
            model.geom_solref[selected]=[tc,ratio]
            model.geom_solimp[selected]=[.95,.99,.001,.5,2.]
            robot,side=key
            acts=np.array([int(a) for a in env.bindings.hand_actuators[robot]
                if ('Left' if side=='left' else 'Right') in model.actuator(int(a)).name])
            self._hand_acts[key]=acts
            joints=model.actuator_trnid[acts,0]
            damping=float(rng.uniform(*c.finger_joint_damping_nm_s_rad))
            model.dof_damping[model.jnt_dofadr[joints]]=damping
            parameters['/'.join(key)]={'sliding_friction':mu,'torsional_friction_m':torsion,
                'contact_time_constant_s':tc,'contact_damping_ratio':ratio,
                'finger_joint_damping_nm_s_rad':damping}
        # Elliptic cones avoid a direction-dependent pyramidal approximation.
        model.opt.cone=mujoco.mjtCone.mjCONE_ELLIPTIC
        self.episode_parameters={'level':self.level,'hands':parameters,
            'hand_motor':{'position_gain_nm_rad':c.hand_position_gain_nm_rad,
                          'velocity_gain_nm_s_rad':c.hand_velocity_gain_nm_s_rad,
                          'torque_limit_nm':c.hand_torque_limit_nm},
            'grasp_force_source':'native MuJoCo contacts only'}
        self._last_physics_time=float(env.data.time)
        self._dwell={key:0. for key in hands}
        self.work_j={r:0. for r in env.robot_ids};self.effort_nm2_s=dict(self.work_j)
        self.acquisitions={r:0 for r in env.robot_ids}
        self.observe(env)

    def apply(self,env,closure,disabled=()):
        # The base class injects spring wrenches. Deliberately bypass it.
        self.observe(env,disabled)

    def observe(self,env,disabled=()):
        if not hasattr(self,'_hand_acts'):return
        model,data=env.model,env.data;c=self.physics_cfg
        now=float(data.time);dt=max(0.,now-self._last_physics_time);self._last_physics_time=now
        if dt>2./env.cfg.physics_hz:dt=0. # resets never count as robot work
        payload=env.bindings.payload_body;origin=data.xpos[payload];rotation=data.xmat[payload].reshape(3,3)
        all_geoms=data.contact.geom[:data.ncon];all_bodies=model.geom_bodyid[all_geoms]
        for robot in env.robot_ids:
            for side in ('left','right'):
                key=robot,side;rail=env._wrench_rail_geoms[key];own=env._wrench_hand_masks[key]
                matches=((all_geoms[:,0]==rail)&own[all_bodies[:,1]])|((all_geoms[:,1]==rail)&own[all_bodies[:,0]])
                records=[]
                for index in np.flatnonzero(matches):
                    contact=data.contact[int(index)];force=np.zeros(6)
                    mujoco.mj_contactForce(model,data,int(index),force)
                    if force[0]<c.minimum_contact_force_n or contact.dist>0:continue
                    body=int(all_bodies[index,1] if all_geoms[index,0]==rail else all_bodies[index,0])
                    sign=1. if all_geoms[index,0]==rail else -1.
                    frame=contact.frame.reshape(3,3);normal=sign*frame[0]
                    hv,_=point_velocity(model,data,body,contact.pos);ov,_=point_velocity(model,data,payload,contact.pos)
                    relative=frame@(hv-ov)
                    # Actual contact.friction includes MuJoCo's pair mixing.
                    cone_components=force[1:3]/np.maximum(contact.friction[:2]*force[0],1e-12)
                    if contact.dim>=4:
                        cone_components=np.r_[cone_components,force[3]/max(contact.friction[2]*force[0],1e-12)]
                    cone=float(np.linalg.norm(cone_components))
                    records.append(dict(hand_body=body,normal_world=normal.tolist(),normal_force_n=float(force[0]),
                        slip_speed_m_s=float(np.linalg.norm(relative[1:])),friction_utilization=cone,
                        penetration_m=float(max(0.,-contact.dist)),position_world_m=contact.pos.tolist(),
                        tangent_force_n=float(np.linalg.norm(force[1:3]))))
                quality=contact_quality(records,c);self.contacts[key]=records;self.quality[key]=quality
                self.wrenches[key]=np.zeros(6) # there is no additional hand-object wrench
                acts=self._hand_acts[key]
                self.work_j[robot]+=float(np.sum(np.abs(data.actuator_force[acts]*data.actuator_velocity[acts])))*dt
                self.effort_nm2_s[robot]+=float(np.sum(data.actuator_force[acts]**2))*dt
                sid=env.bindings.palm_site[robot][side];palm=data.site_xpos[sid]
                # A fault requests motor opening; it must not fabricate an
                # instantaneous physical release in diagnostic bookkeeping.
                active=quality['qualified']
                self._dwell[key]=self._dwell.get(key,0.)+dt if active else 0.
                self._unqualified_time[key]=0. if active else self._unqualified_time.get(key,0.)+dt
                # Solver contact points can switch within a continuously
                # loaded grasp. Log raw qualification and bounded filtering
                # separately; absence of actual force bypasses the filter.
                lost=(quality['normal_force_n']<c.minimum_contact_force_n or
                      self._unqualified_time[key]>=c.release_hold_s)
                quality['unqualified_duration_s']=self._unqualified_time[key]
                quality['filtered_contact_hold']=bool(key in self.anchors and not active and not lost)
                if not active and lost:
                    self.release(key,env.elapsed_s,'contact_lost')
                elif self._dwell[key]>=c.acquisition_hold_s and key not in self.anchors:
                    self.anchors[key]=(rotation.T@(palm-origin),rotation.T@data.site_xmat[sid].reshape(3,3))
                    self.events.append(dict(time_s=env.elapsed_s,robot=robot,hand=side,event='physical_grasp'))
                    if key not in self._first_acquisition:
                        self._first_acquisition.add(key);self.acquisitions[robot]+=1
                anchor=self.anchors.get(key)
                self.slips[key]=float(np.linalg.norm(rotation.T@(palm-origin)-anchor[0])) if anchor else 0.
                self.peak_attached_slip_m=max(self.peak_attached_slip_m,self.slips[key])


def approach_contact_costs(distances,outward_speeds,qualified,cfg,dt):
    """Dense bounded costs: staying far or losing contact cannot earn credit.

    Outward speed is relative to the moving object grasp target, so desired
    rigid-body pitch/yaw motion is not itself penalized as hand separation.
    """
    w=cfg.rewards
    return {'grasp_distance':-w.distance*float(np.mean(np.tanh(np.asarray(distances)/cfg.distance_scale_m)))*dt,
        'grasp_separation_speed':-w.separation_speed*float(np.mean(np.clip(np.asarray(outward_speeds)/cfg.separation_speed_scale_m_s,0.,1.)))*dt,
        'secure_contact':-w.secure_contact*float(np.mean(1.-np.asarray(qualified,dtype=float)))*dt}


def penalized_grasp_releases(events,robot,fault_until):
    """Count real native losses too, excluding this robot's injected opening."""
    return sum(event.get('event')=='release' and event.get('robot')==robot and
        event.get('reason') in ('policy_open','grasp_capacity_exceeded','contact_lost') and
        event.get('time_s',0.)>=fault_until.get(robot,-1.) for event in events)


def pose_closure_potential(distance,angle,closure,cfg):
    """Bounded measured curl near an aligned grasp; delta gives closing credit.

    A stationary closed fist earns no continuing potential-difference reward.
    Closing far from the bar or with the wrong palm orientation earns little.
    This value is not contact qualification.
    """
    alignment=np.exp(-(distance/cfg.alignment_distance_m)**2-(angle/cfg.alignment_rotation_rad)**2)
    return float(alignment*np.clip(closure/cfg.closure_reward_target,0.,1.))


def measured_hand_closure(env,robot,side):
    """Encoder flexion along the configured non-thumb closing synergy."""
    values=[];m=env.model;d=env.data;c=env.cfg.recovery.grasp
    for act in env.bindings.hand_actuators[robot]:
        name=m.actuator(int(act)).name
        if ('Left' if side=='left' else 'Right') not in name or 'Thumb' in name:continue
        closed=c.finger_mcp_rad if name.endswith('MCP') else c.finger_pip_rad if name.endswith('PIP') else None
        if closed is None:continue
        adr=m.jnt_qposadr[m.actuator_trnid[act,0]];opened=m.qpos0[adr]
        if abs(closed-opened)>1e-6:values.append(np.clip((d.qpos[adr]-opened)/(closed-opened),0.,1.))
    return float(np.mean(values)) if values else 0.


def measured_closure_potential(env,robot):
    from scipy.spatial.transform import Rotation
    c=env.cfg.recovery.physical_grasp;total=0.;object_rotation=env.measured_pose().rotation
    for side in ('left','right'):
        key=robot,side;sid=env.bindings.palm_site[robot][side]
        held=env.contact_grasps.anchors.get(key) if c.constellation_use_held_frame else None
        target=env.grasp_reward_target(robot,side) if held is not None else env.palm_target(robot,side)
        rotation=object_rotation@(held[1] if held is not None and not c.retain_assigned_orientation
                                   else env._palm_nominal_rotation[key])
        angle=np.linalg.norm(Rotation.from_matrix(rotation@env.data.site_xmat[sid].reshape(3,3).T).as_rotvec())
        total+=pose_closure_potential(np.linalg.norm(target-env.data.site_xpos[sid]),angle,
                                     measured_hand_closure(env,robot,side),c)
    return total/2


def relative_hold_cost(linear,angular,cfg):
    return float(np.clip((np.linalg.norm(linear)/cfg.held_linear_speed_m_s)**2+
                        (np.linalg.norm(angular)/cfg.held_angular_speed_rad_s)**2,0.,1.))


def planner_palm_alignment_accepted(env):
    """Success check only; never suppress or replace the actor's commands."""
    limit=env.cfg.recovery.physical_grasp.success_palm_angle_rad
    if limit is None:return True
    rotation=env.measured_pose().rotation
    for robot in env.robot_ids:
        for side in ('left','right'):
            sid=env.bindings.palm_site[robot][side]
            normal=env.data.site_xmat[sid].reshape(3,3)[:,1]
            desired=(rotation@env._palm_nominal_rotation[robot,side])[:,1]
            if normal@desired<np.cos(limit):return False
    return True


def physical_reward_parts(env,robot,previous,dt):
    """Costs use measured contacts/work; no grasp flag can inject dynamics."""
    c=env.cfg.recovery.physical_grasp;w=c.rewards;monitor=env.contact_grasps
    q=[monitor.quality.get((robot,s),contact_quality([],c)) for s in ('left','right')]
    acquired=monitor.acquisitions[robot]-previous['acquisitions'][robot]
    work=monitor.work_j[robot]-previous['work_j'][robot]
    effort=monitor.effort_nm2_s[robot]-previous['effort'][robot]
    closure=0.;constellation=0.;distances=[];outward=[];alignment_cost=0.;adjustment=0.
    points=np.array([[0.,0.,0.],[.04,0.,0.],[0.,.04,0.],[0.,0.,.04]])
    object_rotation=env.measured_pose().rotation
    for side in ('left','right'):
        key=robot,side;sid=env.bindings.palm_site[robot][side]
        nominal=env.palm_target(robot,side);actual=env.data.site_xpos[sid]
        target=env.grasp_reward_target(robot,side)
        separation=actual-target;distance=float(np.linalg.norm(separation));distances.append(distance)
        hand_v,hand_w=point_velocity(env.model,env.data,int(env.model.site_bodyid[sid]),actual)
        target_v,target_w=point_velocity(env.model,env.data,env.bindings.payload_body,target)
        outward.append(float(separation@(hand_v-target_v)/max(distance,1e-8)))
        closure+=float(np.linalg.norm(nominal-actual)>.06)*env._closure[key]**2
        captured=monitor.anchors.get(key) if c.constellation_use_held_frame else None
        constellation_target=target if c.constellation_use_held_frame else nominal
        target_rotation=object_rotation@(captured[1] if captured is not None and not c.retain_assigned_orientation
                                          else env._palm_nominal_rotation[key])
        actual_rotation=env.data.site_xmat[sid].reshape(3,3)
        constellation+=np.mean(np.sum((actual+points@actual_rotation.T-constellation_target-points@target_rotation.T)**2,axis=1))
        from scipy.spatial.transform import Rotation
        angle=np.linalg.norm(Rotation.from_matrix(target_rotation@actual_rotation.T).as_rotvec())
        alignment_cost+=1.-pose_closure_potential(np.linalg.norm(actual-constellation_target),angle,1.,c)
        if key in monitor.anchors:
            # Match rigid-body velocity at the actual hand position. Intended
            # lift, translation or rotation is not hand readjustment/slip.
            rigid_v,rigid_w=point_velocity(env.model,env.data,env.bindings.payload_body,actual)
            adjustment+=relative_hold_cost(hand_v-rigid_v,hand_w-rigid_w,c)
    closed_progress=(measured_closure_potential(env,robot)-previous['closure_potential'][robot]
                     if w.aligned_closure else 0.)
    return {'physical_grasp_acquisition':w.acquisition*acquired,
        'hand_pose_alignment':-w.pose_alignment*alignment_cost*.5*dt,
        'aligned_finger_closure':w.aligned_closure*closed_progress,
        'held_hand_adjustment':-w.held_adjustment*adjustment*.5*dt,
        'grasp_firmness':-w.firmness*np.mean([1-r['firmness'] for r in q])*dt,
        'contact_slip':-w.contact_slip*np.mean([r['slip_speed_m_s'] for r in q])*dt,
        'friction_reserve':-w.friction_margin*np.mean([1-r['firmness']*r['friction_margin'] for r in q])*dt,
        'excess_grip_force':-w.excess_normal_force*np.mean([max(0.,r['normal_force_n']/c.maximum_normal_force_n-1.)**2 for r in q])*dt,
        'grasp_mechanical_work':-w.mechanical_work*work,
        'grasp_holding_effort':-w.holding_effort*effort,
        'precontact_closure':-w.precontact_closure*closure*dt,
        'contact_constellation':-w.contact_constellation*constellation*dt,
        **approach_contact_costs(distances,outward,[r['qualified'] for r in q],c,dt)}

# Full SE(3) cooperative transport

This revision searches object translation and orientation jointly. It supersedes the fixed-height SE(2) global search in the original report. The old results remain a separate baseline; they are not relabeled as SE(3) evidence. All new outputs are in `results_se3/`.

## State and secure-grasp constraints

The payload pose is T=(R,p) in SE(3). Storage is `[x,y,z,qw,qx,qy,qz]`; the seven numbers represent six degrees of freedom. Rotations are never interpolated as Euler angles. For robot i and hand h, A_ih is the measured, fixed payload-to-palm transform at the held start. Both left and right hands of both robots are constrained:

```
T_world,palm(i,h)(q_i) = T_world,object A_ih
c_ih(q,T) = [p_palm - (p + R a_ih),
             0.25 Log(R_palm (R R_ih)^T)] = 0.
```

The four full pose constraints give 24 scalar residuals. Two additional residuals enforce equal extension of the coupled lift stages. The robot variables are 44 coordinates: grounded base x/y/yaw, torso, arm/wrist joints and two lift stages per robot. Free bases retain their measured ground height and upright attitude during planning. Tilting the payload does **not** tilt the bases. Joint limits are the compiled MuJoCo model limits. Finger posture remains the secured held posture.

A payload pose is usable only if the solver finds a joint-limited configuration satisfying all four grasp transforms and the full scene's collision check. A failed numerical solve is a rejection within the solver's budget, not a proof of physical unreachability.

## Retraction, metric and global lower bound

Use a world-frame tangent increment v=(u,omega):

```
Retr_(p,R)(u,omega) = (p+u, Exp([omega]x) R)
Delta(Ta,Tb) = (pb-pa, Log(Rb Ra^T))
T(t) = Retr_Ta(t Delta(Ta,Tb)).
```

This is a valid product retraction on SE(3); it is not claimed to be the geodesic of the variable transport metric. The principal rotation logarithm makes equivalent quaternion signs and yaw wraparound harmless.

For a secured palm at object-relative a_h, its world velocity is u + omega × R a_h. Therefore its translational Jacobian is J_h=[I, -[R a_h]x]. Define:

```
G(T) = B + sum_h J_h(T)^T W J_h(T)
B = diag(1,1,1, 0.25,0.25,0.25)
W = diag(0.15,0.15,0.50)
length(Ta,Tb) ≈ sqrt(Delta^T G(T(1/2)) Delta).
```

The units and weights define a task cost, not a calibrated energy model. Since W is positive definite, G(T) >= B in Loewner order. For any curve, its G-length bounds its constant-product-metric length from below. The product distance is:

```
d_B(Ta,Tb) = sqrt(||pb-pa||² + 0.25 angle(Rb Ra^T)²)
h(T) = d_B(Tstart,T) + d_B(T,Tgoal).
```

This gives an admissible filter h(T) <= incumbent cost for subsequent sample batches. We use rejection sampling in a bounded pose domain. We deliberately do **not** apply a Euclidean informed ellipsoid to Euler angles or rotation vectors: SO(3) has topology and chart identifications that invalidate that shortcut. The lower-bound principle follows the second supplied paper, but this SE(3) extension is **not** a reproduction of its direct ellipsoid sampler. No optimality or completeness claim is made for this finite seeded roadmap or midpoint cost approximation.

## Roadmap and whole-body witnesses

`se3_planner.py` uses a lazy nearest-neighbor roadmap and Dijkstra search. Neighbors are proposed using xyz plus a rotation-matrix embedding, avoiding quaternion sign seams. Connection costs use the grasp pullback metric. Sampling mixes the full bounded six-dimensional domain with scene-oriented proposals. For the five original scenes, the previous Riemannian planar route supplies proposal locations only; five height/attitude layers and random poses add spatial alternatives. Every accepted node and edge must pass the new full 3D IK and collision checks. No RRT-Connect function is called.

Each node stores one robot configuration witness. Edge endpoints use exactly those stored witnesses, preventing disconnected IK branches from being silently joined. Intermediate object poses use the group retraction above; interpolated robot states initialize a fresh constrained projection. Scalar joint displacement also controls subdivision. Thus the connection is a path of feasible object **and robot** configurations, rather than a payload curve checked for hand-height bounds alone.

Bounded damped least squares solves each IK step:

```
min_d ||Jc d + c||² + 10^-6 ||d||²
subject to max(-0.12, q_min-q) <= d <= min(0.12, q_max-q).
```

The implementation solves these bounds within the subproblem, then retracts with MuJoCo's joint-coordinate integration. It does not rely on clipping an unconstrained answer at every iteration. Stop tolerance is 2e-5 in weighted residual coordinates; budget-exhausted solutions require residual below 5e-4 to proceed. The separate final audit reports actual palm position and rotation residuals in metres/radians.

For the position interface, a further local whole-body refinement uses the reduced inertia metric H=M_reduced+0.3I, a joint-centering objective f, and the H-orthogonal constraint projector:

```
P_H = I - H^-1 Jc^T (Jc H^-1 Jc^T)^-1 Jc
v = -P_H H^-1 grad f
q_next = project_constraints(Retr_q(alpha v)).
```

Damping regularizes the inverses. A proposal is accepted only after closure and collision checks. The complete refined trajectory is independently audited; if its interpolation fails, the already audited roadmap witnesses are exported instead and the rejected refinement is recorded. This is local whole-body refinement with global SE(3) search; it is not a complete global search over all 44 robot coordinates.

## Geometry and validation resolution

Collision checks use the actual compiled payload, robot and scene geometry in MuJoCo, with their configured collision masks. They include self-collision, inter-robot collision, robot–payload collision outside the secured palms, furniture, walls and floor. Wheel–floor and secured palm–payload contact are permitted. Internal contacts within the same secured gripper are excluded from failure and measured separately. The secure-grasp assumption does not excuse arm/payload or arm/arm collisions. Penetrations deeper than 1 mm are rejected during planning; this is a tolerance, not a positive clearance margin.

Connection subdivisions use 3.5 cm translation, 0.025 rad rotation, and a 0.045 scalar-joint endpoint-difference scale. Projection and refinement can increase the final joint increment; the maximum across the six exported trajectories is 0.0486 in joint units. Every resulting inter-knot midpoint is checked. A separate quarter/mid/three-quarter interpolation audit rejects any forbidden contact, palm position residual over 3 mm, palm angular residual over 0.02 rad, or hard planning joint-limit violation. These are finite-resolution checks, **not continuous swept-volume certification**. Execution success likewise does not prove dynamic stability or hard joint-limit invariance.

## Two exported interfaces

1. **Grasp references for RL:** four timestamped world SE(3) poses, two per robot. `Trajectory.exact_grasps(t)` interpolates the object pose and composes the fixed transforms, preserving closure between knots. `Trajectory.object_reference(t)` provides the existing M2 RL adapter with an equivalent object SE(3) target and world twist.
2. **Whole-body tracking:** named position-actuator references plus both grounded base x/y/yaw targets. The base tracking layer resolves wheel steering and velocity commands; wheel drives are not mislabeled as position actuators. The exported witness/refined configurations satisfy the same secured-grasp constraints.

Trajectory timing limits payload translation to 0.09 m/s, angular motion to 0.065 rad/s, scalar joint changes to 0.16 units/s, and base translation to 0.12 m/s. Acceleration, torque and balance are not imposed by the geometric planner. Actual dynamics rollouts test the resulting trajectories with gravity, contacts, position servos, gravity feedforward and swerve feedback. State is assigned only at reset, then advances via `mj_step`. No payload force or kinematic dragging is applied. Welds implement the explicitly assumed secure grasps.

## Experiment interpretation

The five original environments are living room, warehouse crate, museum painting, apartment couch/doorway and long workshop beam. Their new goals preserve the original destination x/y while requesting **+6 cm height, +0.06 rad world roll and +0.12 rad world pitch relative to upright**. Yaw is also planned through the route. These goals deliberately require nonplanar motion; they do not establish that every room's obstacle layout requires tilt. Full goal poses and pose bounds are saved in each report.

An additional connected-path experiment uses the existing `m2_gallery_floor_clearance` scene with upright start and goal. The selected route pitches the painting by 34.38° and raises it by up to 8 cm. The actual compiled upright payload height is 1.25 m and the opening between the plinth and overhead edge is 1.24 m; yaw and vertical translation alone cannot fit that upright payload through this aperture. This statement does not rule out routes around the obstacle elsewhere. Keeping the payload upright on the selected xyz route rejects 15 sampled configurations. `passage_audit.json` preserves the measured geometry and counterfactual results.

The attitude probes additionally test each original scene and three existing narrow-passage scenes at the held start. They vary one world rotation axis and height at a time, keeping grasp transforms fixed. These isolated solutions demonstrate conditional reachability and collision rejection; they are not certified paths to those poses. Large angles can fail because of floor or robot–payload collision even when the closed-chain IK converges.

The frozen RL actor is evaluated honestly with its existing termination logic. A reference being geometrically feasible does not mean this checkpoint can execute it. Its native self-contact interpretation can be stricter than our secured-gripper abstraction. No policy retraining is implied by these results.

## Sources and implementation map

- [Kyaw & Kelly, Geometry-Aware Sampling-Based Motion Planning on Riemannian Manifolds, supplied v3](https://arxiv.org/abs/2602.00992v3): state-dependent metrics, retractions and metric-aware planning. Local copy: `references/2602.00992v3.pdf`.
- [Kyaw & Kelly, Direct Informed Sampling on Riemannian Manifolds via Loewner Order Lower Bounds](https://arxiv.org/abs/2606.02879v1): constant matrix lower bounds and informed subsets. Local copy: `references/2606.02879v1-2.pdf`.
- [Authors' geodex repository](https://github.com/utiasSTARS/geodex): reference framework supporting SO(3)/SE(3). This experiment is an independent NumPy/SciPy implementation, not a geodex benchmark.
- [MuJoCo official simulation documentation](https://github.com/google-deepmind/mujoco/blob/main/doc/programming/simulation.rst): kinematics, Jacobians and simulation integration.

`se3_geometry.py` implements group operations, metric and lower bound; `se3_planner.py` implements the lazy roadmap and connected IK witnesses; `robot.py` implements bounded IK and inertia-metric refinement; `run_se3.py` audits and exports both interfaces; `execute.py` records actual dynamics; `probe_se3.py` measures pose feasibility; `build_se3_site.py` assembles this report from saved artifacts.

## Five-room extension

`long_scenes.py` constructs a mirrored pair of five-room floor plans within the planning project. The painting and crate use different corridor widths (4.6 and 4.8 m). Four 12 m center-to-center passages give a 48 m room itinerary with signed heading changes whose magnitudes are 90°, 120°, and 90°. Thresholds and overhead lintels constrain the object, while both bases stay on a level floor. These are generated scenes, separate from the nineteen existing-scene evaluations.

`run_long_horizon.py` supplies the ordered room centers as a route prior and composes four local SE(3) roadmaps. Each accepted terminal robot configuration becomes the exact next start. Interior object poses remain free to change height and attitude. Concatenation alone is insufficient: both complete exports undergo the same independent inter-knot audit as the short routes. The saved `segments.json` records each local search and its actual endpoints.

Development variants that did not produce a route are retained under `development_v1/` and `development_v2/`. Those variants are not pooled with the final geometry's trials. The finalized scenes keep their physical dimensions fixed during final planning and execution.

```sh
OPENBLAS_NUM_THREADS=1 python run_long_horizon.py
python render.py --all --root results_se3 \
  --scenes m2_long_museum_five_rooms m2_long_logistics_five_rooms \
  --kinds algorithm grasp_plan whole_body_plan
```

## External benchmark and mechanical work

See `BENCHMARK.md` for the complete protocol. Official OMPL RRT-Connect and BIT* use the same SE(3) domain and grounded closed-chain witness checks. The scene-guided roadmap and a uniform-coordinate ablation are reported separately; neither proposal distribution nor the native optimization objective is falsely claimed to be identical across methods.

Object translation is the sum of adjacent centroid distances. Accumulated rotation is the sum of principal relative rotation angles. Each base's planar travel is measured separately. Rate-limited reference duration is distinguished from actual time to termination under the common whole-body tracker. Only seed-0 accepted paths are used for the dynamics/work comparison; all three seeds contribute to planning statistics.

The new tracker instrumentation integrates positive actuator transmission power at each physics step:

    W_plus = sum_steps sum_actuators max(force * transmission_velocity, 0) * dt

This is mechanical work, including preparation and settling. It does not estimate electrical energy, motor inefficiency, idle electrical draw or battery consumption. A failed rollout's work describes only its truncated execution. Missing successful baseline trajectories cannot support completed-route efficiency rankings.


## Long-route distance and time objective

`optimize_long_horizon.py` keeps the five-room itinerary but releases the three room-center turns. It builds quadratic position curves, chooses broadside object yaw from their tangents, interpolates residual tilt on SO(3), and re-solves both robots under secure-grasp closure, limits and full geometry. Exact original object and robot states are retained at every splice. The independently audited candidate family has up to 216 combinations, including the original route.

The selection objective is `J = 0.5 D/D0 + 0.5 T/T0`. `trajectory_cost.py` computes duration from common object, joint, base and yaw rate bounds, a forward/backward speed pass, local sampled-acceleration repair and a final scaling guard. This is not globally time-optimal control or a certificate of continuous accelerations/torque feasibility. Actual dynamics rollouts validate execution separately. The baseline is re-executed under the same timing routine. The objective does not minimize energy: measured positive actuator work can increase even when distance and duration decrease. Every candidate, the 0.25/0.5/0.75 weight sweep, measured rollouts and all benchmark failures are retained.

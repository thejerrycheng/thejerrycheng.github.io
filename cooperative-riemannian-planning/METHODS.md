# Riemannian cooperative transport: implementation and evidence

This experiment replaces RRT-Connect with a lazy, metric-aware roadmap in this
folder. It does not change older experiments or silently reroute their planners.
Run `run_suite.py` for both output interfaces. The original five scene geometries
and their start/goal specifications are reused. A grasp is assumed acquired at
the initial held state and secured thereafter by four fixed welds.

## Two interfaces

1. **SE(3) grasp references.** Each of the two bimanual robots receives a left and
   right palm pose: four poses, not just two ambiguous robot frames. NPZ array
   `hand_poses_wxyz` has shape `[time, 4, 7]`, ordered MABEL left/right, MILO
   left/right; each row is world-frame `[x,y,z,qw,qx,qy,qz]` in metres. The object
   pose and a fixed object-to-hand transform imply the same references for the
   existing SE3 RL actor. The actor retains its own 187-observation/21-action
   contract; these poses are not misrepresented as policy actions.
2. **Whole-body position targets.** The output includes base `[x,y,yaw]` targets,
   complete MuJoCo qpos, and named actuator targets. Arms/torso use radians,
   lift uses summed tendon travel in metres. Wheel DRIVE actuators are velocity
   actuators and are resolved online from base tracking, not commanded to a
   fictitious wheel position. Finger/neck targets retain the secured posture.

## Configuration space and scope

The global transport chart is q=(x,y,theta), with unwrapped theta in [-pi,pi].
It embeds as T(q)=(Rz(theta),[x,y,z0]) in SE(3). Therefore the outputs contain
full orientations, but the global search does **not** explore roll, pitch or
height. This is a level-carry experiment, not evidence of six-axis obstacle
avoidance. A single yaw chart is used consistently for metric bounds and
sampling; there is no unjustified Euclidean heuristic across a wrap cut.

The whole-body optimization has 44 ambient generalized velocity coordinates: both
grounded bases x/y/yaw, both 16-axis arm/wrist groups, both torsos, and both pairs
of coupled lift stages. Payload poses are prescribed by the global route.
Four six-axis grasp constraints and two lift-coupling constraints leave an
18-dimensional local tangent space wherever the 26-row constraint Jacobian has
full row rank. Damping handles poorly conditioned solves but is not a proof
that the constraint manifold stays regular at every possible robot posture.
This is constrained, local whole-body trajectory refinement seeded by a global
transport route. It is not a globally complete 44-DOF planner.

## Metric construction and distance

For robot i at payload-frame offset r_i, its planar base position is
p_i(q)=[x,y]+R(theta)r_i. Differentiation gives

    J_i(q) = [[1, 0, -(R r_i)_y], [0, 1, (R r_i)_x]].
    W(theta) = R(theta) diag(0.12, 0.65) R(theta)^T.
    B = diag(1, 1, max(0.2, 0.25 rho^2)).
    G(q) = B + sum_i J_i(q)^T W(theta) J_i(q).

Here rho is the composite circumradius. W penalizes lateral motion more than
longitudinal motion. This is an engineered task metric with specified units and
weights; it is **not** a measured energy cost. Because W is positive definite,
v^T(G-B)v=sum_i (J_i v)^T W (J_i v)>=0 for every v and q. Thus B is a certified
global Loewner lower bound, without trusting a finite sample to establish a
global claim.

For two nearby chart points a,b and delta=b-a, the midpoint approximation is

    d_hat(a,b) = sqrt(delta^T G((a+b)/2) delta).
    L_hat(path) = sum_k d_hat(q_k,q_(k+1)).

This implements the midpoint geometry of Kyaw & Kelly [1]. Their local accuracy
statement is not a claim that a long roadmap edge is an exact geodesic. Edges
are subdivided by the local planner; all reported costs are numerical metric
lengths, not physical work or global-optimality certificates.

## Natural-gradient steering and graph search

Define phi(q)=0.5 d_hat(q,b)^2. With chart retraction R_q(v)=q+v, a finite
central difference evaluates grad_E phi at 1e-5 coordinate steps. Solve

    v = -G(q)^(-1) grad_E phi(q),
    q_next = R_q(s v / sqrt(v^T G(q) v)).

Backtracking requires phi(q_next)<phi(q) and d_hat(q,q_next)<=1.5s. The complete
returned local polyline is checked; it is never replaced by a straight shortcut
without checking. The graph uses 24 nearest neighbors under B, symmetrized.
Dijkstra proposes a route using midpoint estimates for unknown edges. Each
candidate route is checked lazily; accepted edges get their actual subdivided
costs, failed edges are removed, and shortest-path search repeats. A changed
edge cost triggers another search before accepting the route.

Portal samples are obtained from the scene's existing aperture geometry. They
are sampling guidance, not a precomputed path. Free samples outside the portal
remain in the roadmap. There is no call to RRT-Connect in this pipeline.

## Informed sampling derivation

From B<=G, every smooth chart curve gamma satisfies

    L_G(gamma) >= integral ||L^T gamma_dot|| dt
               >= ||L^T(q_goal-q_start)||,  B=L L^T.

The second inequality is the triangle inequality in transformed coordinates.
Hence h(q)=||L^T(q-q_start)||+||L^T(q_goal-q)|| is admissible. An incumbent
cost c restricts potentially improving points to h(q)<=c. In coordinates
x=L^T q this is a prolate hyperspheroid centered at (x_start+x_goal)/2 with
major semiaxis c/2 and minor semiaxes sqrt(c^2-c_min^2)/2. A uniform unit-ball
sample is rotated to the start-goal axis, scaled by those semiaxes, translated,
then mapped back by L^(-T). This is the direct sampler in [2].

Eighty percent of later-batch samples use that ellipsoid. Remaining samples
preserve global exploration. Uniformity is guaranteed inside the ellipsoid
before workspace and collision rejection, not over collision-free space without
rejection. The implementation also tests the paper's pairwise Loewner-meet
operation, but uses the analytically certified B for the actual experiments.
It does not claim to compute the tightest possible global matrix bound.

## Whole-body constraints and projected optimization

Let F_h(Q) be a hand's forward kinematics and C_h its fixed object-relative
grasp transform. Secured grasps impose

    F_h(Q) = T_object C_h, for all four hands.
    c_h(Q) = [p_h-p_h*, 0.25 Log(R_h R_h*^T)] = 0.

The factor 0.25 metres scales rotation residuals to the translational objective.
Two additional rows enforce equal travel of each lift's coupled stages.
Stacking these rows gives constraint Jacobian A. With the reduced mass matrix
H=S^T M(Q) S+0.3 I and joint-centering objective f, compute

    u = -H^(-1) grad f,
    v = u - H^(-1) A^T (A H^(-1) A^T + epsilon I)^(-1) A u.

Without damping, A v=0: this is the H-orthogonal projection into the constraint
tangent space. After a bounded tangent step, MuJoCo's configuration integrator
retracts rotations. Iterated damped least-squares projection corrects closure:

    Delta = -A^T (A A^T + 1e-7 I)^(-1) c(Q).

Joint limits are imposed after each retraction. A proposal is retained only if
closure converges and actual model contact checks find no unallowed penetration
above 1 mm. The endpoints remain at the original held posture. A posture taper
vanishes at endpoints. The optimization improves local joint centering; it does
not optimize all timing, contact forces or torque limits jointly.

## Verification and dynamics

Global edge checking uses an 18 mm swept-displacement step. An independent
final pass uses 5 mm; acceptance requires at least 20 mm planar clearance.
These are sampled checks, not continuous-time collision certificates. MuJoCo
full-body contact checks at trajectory knots complement the composite model;
neither finite sampling nor endpoint grasp projection proves the complete
interpolated trajectory is collision-free. Interpolation is independently
audited in `audit.py` and execution checks actual states.

The long beam initially overlaps low sawhorses in an infinite-height projected
map. The planner uses the measured held payload underside minus 20 mm to ignore
obstacles below the beam; those obstacles remain active against robot bases.
No furniture or scene geometry is removed to obtain success.

Dynamic execution uses `mj_step` only after a single held-start initialization.
Four grasp welds stay active. No payload force or pose correction is injected.
The original CAD keyframes leave the wheel surfaces about 170 mm above the
floor. Initialization lowers each base by its measured wheel-to-floor gap and
extends its two coupled lift stages by the same total amount. This preserves
all four world-frame palm poses and the object pose. A regression test checks
that preservation and the lift limits. Grasp weld impedance is explicitly set
to [0.999,0.9999], with time constant max(4 ms, twice the physics timestep).
Whole-body targets are tracked with position servos and base feedback through
the existing swerve controller. Gravity feedforward adjusts servo setpoints
using robot bias forces plus four equal nominal shares of payload weight.
Bounded position-error integration compensates residual servo offsets.
This support allocation is approximate, and does not certify force feasibility.
Actuator limits remain active. PPO execution uses the existing frozen SE3
checkpoint; no policy training or weight changes occur in this experiment.

Success requires the final object position within 60 mm, orientation within
0.08 rad, and no recorded unallowed penetration exceeding 2 mm. Runs stop on
controller termination, 650 mm position error, 0.8 rad orientation error,
20 mm unallowed penetration, or a documented time budget. Planning success
and controller success are reported separately. Failure recordings are results.

Under the secured-gripper approximation, contacts internal to a single hand
are excluded from the transport collision gate, as are intended hand/payload
and wheel/floor contacts. Internal finger penetration is still recorded as
`gripper_internal_penetration_m`. Contacts between distinct hands, arm links,
robots, objects and the environment remain forbidden. The learned controller
additionally retains its original termination manager, which can stop on
`robot_self_penetration` even when the common transport audit reports no
forbidden external contact. Consequently, native PPO failures must be read as
failures of that complete deployed controller, not proof that the exported
grasp poses are unreachable or a matched comparison of termination policies.

An independent recorded-state audit checks base inclination and actuator-space
tracking. Maximum base inclination remained below 0.017 rad in these runs.
MuJoCo uses soft joint constraints: the measured trajectories exhibit small
limit overshoots, despite valid planned configurations. `tracking_audit.json`
reports revolute overshoot in radians and prismatic overshoot in metres
separately. Goal completion therefore does not imply strict hard-limit
invariance or readiness for hardware deployment.

## Reproducibility and statistical limits

Five scenes cover couch, scanned living-room sofa, crate, painting and beam.
These are the repository's current light-load scene presets, approximately
1–2 kg, not full-weight sofas or the historical 55 kg warehouse description.
The actual model mass is stored in every execution result and displayed on the
site. Successful light-load tracking does not establish full-scale load capacity.
The main pipeline records both outputs and controller trials at seed 0.
The paired planning benchmark evaluates three seeds per scene against the
same roadmap with a constant metric. It tests metric/search behavior, not
an RL training distribution or a broad generalization claim. Three seeds and
one controller trial per scene are insufficient for population reliability.
Sources are hashed in result files; policy SHA-256 is recorded per RL run.
`summarize_benchmark.py` also evaluates both candidate paths with the same
Riemannian metric. The measured mean paired cost reduction is about 0.36%,
with a median runtime ratio of about 1.34. These small-sample observations do
not support a claim of a substantial cost advantage or a speedup.

## References

[1] Phone Thiha Kyaw and Jonathan Kelly. Geometry-Aware Sampling-Based Motion
Planning on Riemannian Manifolds. WAFR 2026, arXiv:2602.00992v3.
[Versioned paper](https://arxiv.org/abs/2602.00992v3)

[2] Phone Thiha Kyaw and Jonathan Kelly. Direct Informed Sampling on Riemannian
Manifolds via Loewner Order Lower Bounds. arXiv:2606.02879v1, 2026.
[Versioned paper](https://arxiv.org/abs/2606.02879v1)

[3] Authors' geodex implementation, Apache-2.0.
[Authors' repository](https://github.com/utiasSTARS/geodex)

This folder independently implements the paper-inspired geometry in NumPy to
reuse M2's collision and controller interfaces. It is not an unmodified run of
geodex and does not claim to reproduce the papers' published performance tables.

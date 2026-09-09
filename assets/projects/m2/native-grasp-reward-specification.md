# Native-contact grasp rewards and acceptance conditions

These values are shared by `native_grasp_hand_targets_v1.json` (transformer)
and `native_grasp_hand_targets_mlp_v1.json` (MLP). They describe the current
low-load acquisition experiment, not the earlier welded controller.

During supervised initialization the optimizer minimizes weighted teacher-action
MSE. It logs the environment rewards but does not optimize their return. PPO
continuation optimizes the summed reward below. Rewards are calculated per robot;
the Gym team's scalar reward averages the two robot rewards.

## Notation and timing

Control runs at 50 Hz, so `dt = 0.02 s`; physics runs at 500 Hz. Angle errors are
in radians, distances in metres, forces in newtons. `mean` averages the two hands
of one robot, while `sum` adds them. `clip(x,a,b)` limits x to [a,b].

- `d`: palm distance to its assigned grasp frame, or its measured captured frame
  once held. `d0` always uses the nominal assigned frame.
- `theta`: palm orientation error to that grasp frame.
- `c`: commanded closure; `cm`: measured normalized MCP/PIP finger curl.
- `A = exp(-(d/0.03)^2 - (theta/0.25)^2)`.
- `Phi = mean(A * clip(cm/0.6,0,1))`.
- `F`: sum of accepted normal contact forces on a hand's assigned rail.
- `o`: opposing-normal score, maximum `(1 - n_i dot n_j)/2` over contacts on
  different hand bodies. `f = min(F/12,1) * o` is a firmness proxy.
- `s`: normal-force-weighted tangential contact slip speed.
- `m`: remaining friction-cone margin, clipped to [0,1], including torsional
  utilization. This and firmness are diagnostics, not a proof of force closure.
- `vout`: palm velocity away from the moving grasp frame.
- `vrel, wrel`: hand velocity relative to rigid object motion at the hand position.
- `E`: sum over both hands of mean squared error of four grasp-frame landmarks
  (origin and 4 cm offsets along each axis).

## Physical grasp terms (all 15)

These are already weighted contributions. Do not multiply by the weight again.

| Logged term | Weight | Actual contribution | Intended behavior |
|---|---:|---|---|
| `physical_grasp_acquisition` | 8 | `8 * newly_acquired_hands` | First qualified acquisition per hand per episode; reacquisition cannot repeatedly farm this bonus |
| `hand_pose_alignment` | 3 | `-3 * mean(1-A) * dt` | Match position and orientation |
| `aligned_finger_closure` | 12 | `12 * (Phi_now-Phi_before)` | Close while aligned using measured finger curl; no continuing credit for a stationary closed fist |
| `held_hand_adjustment` | 1 | `-mean(held * clip((norm(vrel)/0.03)^2 + (norm(wrel)/0.2)^2,0,1)) * dt` | Limit relative readjustment after acquisition; intended rigid lift/rotation is not penalized |
| `grasp_firmness` | 1.5 | `-1.5 * mean(1-f) * dt` | Establish useful opposing contact force; no force benefit above the firmness saturation |
| `contact_slip` | 12 | `-12 * mean(s) * dt` | Reduce physical tangential slip |
| `friction_reserve` | 0.5 | `-0.5 * mean(1-f*m) * dt` | Maintain firm contact with friction reserve |
| `excess_grip_force` | 2 | `-2 * mean(max(F/40-1,0)^2) * dt` | Penalize force above 40 N per hand; 40 N is a penalty threshold, not an enforced force clamp |
| `grasp_mechanical_work` | 0.02 | `-0.02 * delta(sum integral(abs(torque*joint_speed) dt))` | Limit finger mechanical work; not electrical energy |
| `grasp_holding_effort` | 0.002 | `-0.002 * delta(sum integral(torque^2 dt))` | Limit sustained finger effort |
| `precontact_closure` | 0.5 | `-0.5 * sum(1[d0>0.06] * c^2) * dt` | Discourage closing more than 6 cm from the assigned grasp |
| `contact_constellation` | 100 | `-100 * E * dt` | Match the full hand frame through four landmarks |
| `grasp_distance` | 6 | `-6 * mean(tanh(d/0.06)) * dt` | Discourage remaining far from the handles |
| `grasp_separation_speed` | 3 | `-3 * mean(clip(vout/0.05,0,1)) * dt` | Discourage moving away from the grasp |
| `secure_contact` | **0** | `-0 * mean(1-qualified) * dt` | Explicit missing-contact cost is disabled in this profile; physical contact criteria and other rewards remain active |

## Task terms (all 18)

`gap = max(d_left,d_right)`. Rotation progress uses mean hand orientation error.
`Q = sum(exp(-(d/0.04)^2)*clip(c/0.6,0,1) + held)` is the older closure/contact
potential; unlike Phi it uses commanded closure and does not include orientation.
Both are currently active. `G(delta)` returns delta when all four hands support
before and after a step; otherwise it returns `min(delta,0)`. Reward support
checks do not gate actions or send coordination commands to the actor.

| Term | Weight | Actual contribution |
|---|---:|---|
| Grasp distance progress | 20 | `20 * clip(gap_before-gap_now,-0.05,0.05)` |
| Grasp rotation progress | 6 | `6 * clip(theta_mean_before-theta_mean_now,-0.02,0.02)` |
| Closure/contact progress | 5 | `5 * (Q_now-Q_before)` |
| Grasp loss | 6 | `-6 * released_hands`; native contact losses included; externally injected opening of that robot is excluded |
| Grasp proximity | 1 | `exp(-(gap/0.08)^2) * dt` |
| Supported path progress | 100 | `100 * G(path_progress_now-path_progress_before)` |
| Supported SE3 goal progress | 200 | `200 * G(D_before-D_now)`; `D=norm([position_error,0.35*rotation_error])` |
| Supported lift progress | 200 | `200 * G(abs(z_error_before)-abs(z_error_now))`; overshoot/retreat can lose credit |
| Stable goal | 2 | `2 * goal_conditions_met * dt` |
| Unsupported travel | 20 | `-20 * horizontal_distance_this_step * not_supported` |
| Held-frame displacement | 2 | `-2 * min(max_hand_drift,0.1) * robot_has_both_grasps * dt` |
| Load | 0.2 | `-0.2 * (norm(robot_net_force)/120)^2 * dt` |
| Object orientation error | 4 | `-4 * norm(rotation_error_to_nearby_planner_pose)^2 * dt` |
| Torso upright | 0.2 | `-0.2 * torso_pitch^2 * dt` |
| Action change | 0.01 | `-0.01 * sum((action_now-action_before)^2) * dt` |
| Time | 2 | `-2 * dt` |
| Task success | 300 | `+300` when successful, ending the episode |
| Physical/task failure | 500 | `-500` when terminated as failed |

These overlapping shaping terms are development choices, not a demonstrated
optimal reward. In particular, physical grasp acquisition and complete lift/hold
success are separate outcomes.

### Palm-up variant under physical testing

`native_grasp_palm_up_mlp_v1.json` is a separate candidate, not a change to the
completed paired MLP/transformer experiment. It increases pose-alignment weight
from 3 to 6 and tightens its rotation scale from 0.25 to 0.15 rad. With
`retain_assigned_orientation=true`, both alignment and constellation rewards keep
the planner's assigned orientation after contact; grasp-position references may
still follow compliant seating. Commanded object rotation transforms those
orientation targets with the object.

Teacher seating/continued-closing limits become 0.15/0.20 rad, respectively.
An initial probe timed out without closing: the wrist target saturated while the
measured wrist remained inside its joint limit. Teacher label schema 6 respects
motor-target saturation as well as joint limits, allowing the other arm joints
to contribute. This changes training labels only. Physical motor limits and
contact acceptance are unchanged. Diagnostic and frozen-policy outcomes are
recorded separately; successful training for this variant is not yet established.

The corrected teacher diagnostic then passed at seed 1560900: 6.35 cm measured
lift, all four grasps, no termination, and final palm-normal errors of 6.76–7.29
degrees. Fresh MLP collection now uses the additional
`success_palm_angle_rad = 10 degrees` requirement for **every** hand throughout
the eight-second final hold. It remains a learned-policy development experiment;
this single teacher diagnostic is not the >90% acceptance result.

## What qualifies as a grasp

| Condition | Current value / rule |
|---|---|
| Contact identity | Actual finger/palm contacts with that hand's assigned rail |
| Accepted individual contact | Compressive normal force at least 0.2 N and nonpositive MuJoCo contact distance |
| Opposing surfaces | Opposing-normal score at least 0.7, with contacts on different hand bodies |
| Force per hand | Sum of accepted normal forces at least 2 N |
| Slip per hand | Force-weighted tangential slip speed at most 0.04 m/s |
| Acquisition dwell | All three quality conditions hold continuously for at least 0.08 s |
| Robot support | Both hands acquired; full team support requires all four |
| Contact loss | Immediately if summed accepted normal force drops below 0.2 N; otherwise after 0.02 s continuously unqualified |
| Finger closure | A closure command alone never qualifies the grasp |
| Attachments | No grasp weld, adhesive force or spring wrench is added |

Teacher-only label rules: first closure requires position error below 2.3 cm and
rotation error below 0.35 rad; continued closure allows 5 cm and 0.65 rad when
the closure target is already above 0.05. A qualified held hand receives a 0.9
holding closure target. These rules generate examples; the deployed MLP and
transformer choose their own commands.

## Physical limits and lift/hold acceptance

| Limit / condition | Current value |
|---|---|
| Finger and wrist motor torque | Clamped to +/-1 N m per actuator |
| Grasp contact penetration | More than 4 mm terminates |
| Robot self-penetration | More than 1 mm terminates |
| Unintended object contact with non-hand robot body | Normal force above 1 N terminates |
| Base inclination | More than 2 degrees terminates |
| Unsupported horizontal displacement | More than 5 cm in an unsupported segment terminates |
| Frozen acquisition objective | Approach, four physical grasps, target 6 cm above initial height, then hold |
| Goal pose tolerance | Position error below 4 cm; orientation error below 0.08 rad |
| Goal stability | All four grasps and norm of concatenated measured linear/angular velocity below 0.05, held for 8 s with no termination |
| Episode time limit | 30 s |
| Payload | Nominal 0.8 kg; reset range 0.6–1.2 kg; actual total mass ceiling 1.9 kg |
| Sliding friction | Current level 3.0–4.0; configured full-difficulty range 2.5–3.5 |

The twist threshold is the existing implementation's mixed linear/angular
numeric norm, not two independent velocity bounds. A 6 cm target with a 4 cm
position tolerance is not a strict minimum 6 cm measured rise. Successful
acquisition alone does not establish transport, doorway, pitch or recovery
reliability. The separate 100-trial acquisition confirmation must exceed 90%.

Sources in this repository: `rl/m2_rl/native_contact_grasp.py`,
`rl/m2_rl/envs/cooperative_recovery.py`, `rl/m2_rl/se3_safety.py`, and
`rl/configs/native_grasp_hand_targets_mlp_v1.json`.

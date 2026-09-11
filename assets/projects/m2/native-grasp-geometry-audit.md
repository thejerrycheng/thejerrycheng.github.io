# Native grasp geometry audit

The current learned failure contains an open hand and one-sided finger contacts. High friction and a large normal force do not turn those contacts into a secure grasp. There is also a mismatch between the assigned palm target and the closed-hand geometry used by the successful scripted diagnostic. The next experiment should calibrate the grasp and its approach together, then retrain against physical contact measurements.

This is a simulation development audit, not a learned success result. The archived scripted pass and learned failure use different seeds and masses; they diagnose mechanisms rather than form a controlled policy comparison. The new physical probes below preserve the scripted baseline's seed and load.

## What each hand did

The learned trial is `native_grasp_acquisition_light_grasp_tolerance_mlp_000_screen/case_000`: seed 1980000, mass 0.34447 kg, duration 20.60 s. It never establishes four-hand support. It ends on unsupported horizontal travel: 156.3 mm after spending 0.76 s beyond the 150 mm allowance. Its final object height is 217.7 mm above the commanded height. Its final orientation error is 0.128 rad; the new acquisition tilt limit does not terminate this trial.

| Hand | Qualified saved samples | Last closure command / measured curl | Last normal force | Contact geometry at the end | Palm angle error |
|---|---:|---:|---:|---|---:|
| MABEL left | 20 / 207 | 0.989 / 0.831 | 16.41 N | Thumb distal and pinky; opposition 0.997 | 5.91° |
| MABEL right | 12 / 207 | 0.456 / 0.665 | 9.05 N | Two colliders on the same pinky segment; opposition 0 | 6.40° |
| MILO left | 0 / 207 | 0 / 0 | 0 N | No contact; open command in 51.2% of saved samples | 16.68° |
| MILO right | 17 / 207 | 0.134 / 0.215 | 9.24 N | Two colliders on the same pinky segment; opposition 0 | 11.28° |

These fractions count saved samples, not episodes or control-rate dwell intervals. MILO left never qualifies at any saved sample; the recorded final continuous unqualified duration is the entire 20.6 s. Its strongest earlier contact reaches 6.25 N, so it did touch the object during the attempt.

The scripted `native_contact_probe_v24_light_retention_baseline` uses seed 1640900 and 0.3 kg. It establishes full support at 2.42 s, lifts 60.13 mm, and passes the existing eight-second hold check. At the end, all four hands use opposing thumb-distal and pinky-intermediate contacts, with 10.72–12.55 N total normal force per hand, opposition 0.934–0.996, and 3.16–4.43° palm-normal error. Palm-body support force is **zero on every hand throughout that recording**. This is a finger pinch with upward-facing palms; it is not evidence that the bar rests on the palm surface.

## What the planner target means geometrically

The hand TCP is at local `(0, 0, 0.102)` m relative to the palm body. The planner uses `grasp_palm_below_bar_m = -0.040` and `grasp_palm_forward_offset_m = +0.045`. At the exact assigned palm-up pose, those values put the bar axis near palm-body `(0, 0.040, 0.057)` m.

The successful measured grip instead puts the bar axis at approximately `(±0.007, 0.073–0.076, 0.041–0.045)` m. Its TCP sits 36–39 mm below the assigned target, with total target errors of 38–41 mm. The teacher's contact capture preserves that physical frame after acquisition. The reward also uses the captured position for a held hand, so the old environment does not demand that an already successful grasp move back into the nominal target. The planner-provided nominal hand pose nevertheless remains a different pose from the measured successful grip.

No duplicated offset was found. `palm_up_grasp_pose()` adds the configured vertical and forward offsets once; `hand_pose()` then composes the object-relative hand transform with the object pose. The teacher's 35 mm approach clearance is a separate, temporary offset that fades with lateral alignment.

Using the exact archived collision meshes, rigidly placing the successful closed-hand geometry at the assigned TCP yields **19.1–20.4 mm of rail–pinky overlap**, plus roughly 8–10 mm of overlap with index/ring segments. At the actual successful hand pose, the corresponding overlap is 0.31–0.43 mm. This static comparison keeps the saved finger angles and changes only the hypothetical hand placement. It does not prove that every possible finger configuration at the assigned pose is infeasible, and it is not a dynamics rollout.

The initially measured left hands appeared more obstructed than the right hands. A second check set all fingers to their exact open joint references: all four hands then have approximately 0.33–0.37 mm overlap at the old target. The large initial left-hand overlap depends on its transient measured finger deflection. These checks do not establish a mirrored-joint or sign bug.

## Candidate geometry and physical checks

The mesh screen retains all native collision geometry, torque limits, friction, and the 4 mm penetration threshold. It searches the configured TCP offsets, with existing observed finger postures and a separate diagnostic comparison of deeper finger flexion. Deeper commanded fists did not produce better candidates within the conservative static screen; their angles should not be added to training on this evidence alone.

| TCP below / forward offsets | Static result using the saved closed hands | Interpretation |
|---|---|---|
| −40 / +45 mm | Up to 20.4 mm overlap; palm surface about 23.5 mm from rail | Existing nominal reference conflicts with this closed-hand posture |
| −75 / +45 mm | Up to 10.3 mm overlap; thumb distal still 11–14 mm clear | Changing only the vertical offset is insufficient |
| −83 / +56 mm | At most about 1.2 mm overlap; palm surface about 58 mm clear | Candidate for reproducing the known finger pinch; not a palm-rest grasp |
| −33.5 / +90 mm | At most 2.85 mm overlap; palm gap about 0.19–0.23 mm; opposing thumb-intermediate surfaces a few millimeters away | Candidate for a bar seated over the palm, requiring physical approach and closure validation |

`native_contact_probe_v25_inner_palm_reference` changes only the two TCP offsets from the archived scripted baseline to −33.5 / +90 mm. It retains the historical 50 mm unsupported-travel termination for the matched comparison. It fails at 0.66 s: an open MILO-left pinky reaches 14.37 N, the load moves 51.1 mm, and the object rises only 0.53 mm. No hand qualifies, no palm support is measured, and all four closure commands are still zero. This establishes an early approach collision, not the impossibility of the final grasp pose.

A follow-up, `native_contact_probe_v26_inner_palm_tolerant`, keeps that same seed, 0.3 kg load, geometry and scripted controller while enabling the current grasp-safety monitor: 150 mm acquisition travel allowance with a 0.75 s grace period, 250 mm hard limit, and the current grasp-aware orientation limits. It fails at 2.34 s after 177.4 mm of unsupported travel. The load rises 39.9 mm, but no hand qualifies and every palm-support measurement remains zero. MABEL closes both hands to 0.9; its final contacts are on the thumb-intermediate segments (11.46 and 5.90 N). MILO never closes and instead contacts the bar with ring/pinky/index segments. The bar remains above the palm surfaces. More tolerant termination exposes the unsuccessful approach and closure for longer; it does not turn this diagnostic into a successful grasp.

Both failures are retained, and no poses are edited during either rollout. These results reject the current scripted approach as a demonstrated solution for the new inner-palm target. They do not rule out a learned approach or a different physically bounded finger/ thumb closure trajectory. A force-limited finger can stop at the object before reaching its commanded joint target, so static overlap at a hypothetical fully closed joint pose cannot substitute for a physical closure test.

### Actual reset, open hands, no teacher

`probe_native_near_contact.py` separately initializes the current inner-palm configuration through the public Gym API at 0, 5 and 15 mm fixed standoffs. Each trial requests two seconds of zero base/arm/lift actions and open grippers, uses seed 1640900 and a 0.3 kg payload, and keeps the current physical collision and termination limits. No teacher or rollout state edits are used.

| Initial base standoff | Initial maximum rail penetration | Strongest initial hand normal force | Result |
|---|---:|---:|---|
| 0 mm | 8.08 mm | 105.3 N | First-step penetration termination |
| 5 mm | 11.29 mm | 151.6 N | First-step penetration termination |
| 15 mm | 22.45 mm | 425.8 N | First-step penetration termination |

There is no measured object travel or lift in these rollouts: each stops at the first 0.02 s step. These are invalid initializations, not failed learned closures. The ideal canonical open pose from the static screen differs from the actual settled reset. At zero standoff, TCP errors are 1.58, 4.07, 9.90 and 9.03 mm for MABEL left/right and MILO left/right, with several degrees of palm-normal error. The two left hands retain measured curl of 0.094 and 0.099, while the two right hands are near 0.018. The initial MABEL-left thumb and palm intersect the rail by 8.08 and 6.02 mm, respectively.

The current reset moves the base backward from the final hand pose. A short horizontal withdrawal can sweep the rail through the thumb/pinky instead of clearing the hand; the standoff reset path does not perform the collision rejection used by the separate radius-sampling reset. A useful near-contact curriculum therefore needs a physically valid open pregrasp with vertical clearance, while preserving the final assigned palm target. Increasing the penetration allowance would hide this initialization problem. The exact recorded contacts and encoder errors are retained in `inner_palm_real_reset_open_hold.json`.

The diagnostic next lowers the **reset IK target only** by 15 mm and restores the final planner grasp target before episode initialization. This uses a diagnostic subclass of the ordinary environment; there are still no state edits during the rollout. Both 0 and 5 mm standoffs now complete the full two-second open hold. Their maximum penetrations are 2.405 and 2.164 mm, and their maximum passive horizontal drift is 0.183 and 0.263 mm. All finger joints remain within their native limits. These two fixed initializations establish a useful starting point for a near-contact curriculum, not robustness across the full randomization range and not grasp success. The hands remain open, with zero palm support and no full support. Final grasp-reference errors of roughly 20–42 mm remain for the actor to correct.

The new public `reset_pregrasp_clearance_m = 0.015` setting reproduces the diagnostic subclass results exactly at 0 and 5 mm. At 15 mm standoff, however, it still begins with 14.07 mm penetration and terminates immediately. The tested feasible endpoints are therefore **0 and 5 mm**, and the larger interval must not be represented as validated. The default remains zero, preserving historical experiments; the final desired grasp transforms remain unchanged.

Increasing reset-only clearance to 30 mm still leaves collision bands: the inner-palm reference fails at a 40 mm base standoff with 8.51 mm penetration, while the original reference fails at zero standoff with 7.30 mm penetration. Increasing base distance is not monotonically safer because the rail can pass through different finger segments.

The **50 mm reset-only clearance** completes all five tested standoffs—0, 15, 40, 70 and 100 mm—for both reference geometries. Each check lasts 0.5 s with open hands. The inner-palm reference has at most 1.87 mm penetration and 0.52 mm passive object drift; the original reference has no recorded rail penetration or meaningful object drift. These are ten nominal, fixed-seed reset checks at 0.3 kg, not ten grasp successes. They establish a candidate common reset for a controlled reference comparison. The actual training distribution, randomized mass/friction and additional seeds still require their own reset audit before release.

![Measured reset penetration at sampled clearances and standoffs](../experiments/diagnostics/grasp_geometry_audit_20260909/reset_geometry_audit.png)

Blank cells were not tested. Red cells terminate; green cells complete their open hold. The plot reports maximum measured rail penetration and does not interpolate between samples.

### Stronger finger closure is a separate factor

A separate fixed-action diagnostic uses the valid 15 mm reset clearance at zero standoff, opens for 0.4 s, closes with MCP/PIP targets of 1.2/1.2 rad, and requests a 0.01 m/s lift after 1.5 s. These joint targets fit the native joint limits, and the actuator force limit remains 1 N·m. It runs for seven seconds without termination, raises the load 29.8 mm, and moves it horizontally by at most 1.37 mm. Maximum penetration is 2.405 mm and maximum measured hand torque is 0.885 N·m.

This remains an incomplete grasp: measured finger curl reaches 0.93–0.95, but the forces still come from thumb and finger segments, with **zero palm-body support**. Full support appears only briefly. MABEL's final opposition scores are about 0.58–0.59, below the unchanged 0.7 criterion, while MILO's are 0.94–0.96. The script closes while actual hand-target errors are still approximately 20–33 mm; it therefore tests the consequences of early closure, not a successful aligned palm-seating strategy. A learned controller must still choose the approach, alignment and closure sequence. This finger-synergy experiment is kept separate from the reference-only ablation, which retains the original 0.85/0.70 rad targets.

## What the audit can and cannot establish

- The exact archived models contain 68 hand/wrist actuators with ±1 N·m force limits, gain 2 N·m/rad and damping gain 0.1 N·m·s/rad. The upper-arm motors have their own model limits; ±1 N·m is not a limit for the entire robot.
- The measured per-robot sliding coefficients range from 3.10 to 3.46 across the two archived runs. The materials are already highly frictional. Missing opposing contacts remain the immediate grasp problem.
- The original recorded physical forces are authoritative for those trials. The saved state archives contain `qpos` and time, not full velocities and controls. This audit recomputes geometry only and does not present reconstructed torques or forces as measurements.
- The current success criterion permits zero palm-body support force. A result under that criterion must not be described as a validated palm-rest grasp. Once a palm-supported approach is feasible, palm-load retention should be reported explicitly alongside normal force, opposition, slip and full task success.
- Reward-only policies can explore different approach and closure trajectories from this scripted diagnostic. The teacher's failure should not be used to constrain the learned actor to repeat that trajectory.

## Reproducible artifacts

- `rl/scripts/audit_native_grasp_geometry_saved.py`: saved-pose measurements, motor metadata, native collider distances, and a TCP-offset screen.
- `rl/scripts/audit_palm_cradle_geometry_saved.py`: canonical open, observed pinch, and deeper-fist static comparisons.
- `rl/scripts/probe_native_near_contact.py`: actual reset/open-hold and configurable fixed closure diagnostics using the public Gym API.
- `rl/scripts/plot_native_reset_geometry_audit.py`: reproducible summary JSON and PNG/SVG comparison of the recorded reset checks.
- `experiments/diagnostics/grasp_geometry_audit_20260909/scripted_pass.json`
- `experiments/diagnostics/grasp_geometry_audit_20260909/tolerant_failure.json`
- `experiments/diagnostics/grasp_geometry_audit_20260909/static_offset_grid_summary.json`
- `experiments/diagnostics/grasp_geometry_audit_20260909/palm_cradle_screen.json`
- `experiments/diagnostics/grasp_geometry_audit_20260909/inner_palm_probe_config.json`
- `experiments/diagnostics/grasp_geometry_audit_20260909/inner_palm_tolerant_probe_config.json`
- `experiments/diagnostics/grasp_geometry_audit_20260909/inner_palm_real_reset_open_hold.json`
- `experiments/diagnostics/grasp_geometry_audit_20260909/inner_palm_clearance_15mm_open_hold.json`
- `experiments/diagnostics/grasp_geometry_audit_20260909/public_inner_palm_clearance_15mm_open_hold.json`
- `experiments/diagnostics/grasp_geometry_audit_20260909/inner_palm_clearance_15mm_deeper_closure_lift.json`
- `experiments/diagnostics/grasp_geometry_audit_20260909/public_inner_palm_clearance_30mm_reset_sweep.json`
- `experiments/diagnostics/grasp_geometry_audit_20260909/public_inner_palm_clearance_50mm_reset_sweep.json`
- `experiments/diagnostics/grasp_geometry_audit_20260909/public_original_reference_clearance_15mm_open_hold.json`
- `experiments/diagnostics/grasp_geometry_audit_20260909/public_original_reference_clearance_30mm_reset_sweep.json`
- `experiments/diagnostics/grasp_geometry_audit_20260909/public_original_reference_clearance_50mm_reset_sweep.json`
- `experiments/diagnostics/grasp_geometry_audit_20260909/reset_geometry_summary.json`

The paired physical probe configs preserve the archived baseline and record every changed field. Evaluator CPU slots are resumed after each probe; these diagnostics do not add teacher data to PPO.

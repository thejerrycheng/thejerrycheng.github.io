# Native grasp learning ablations

The current task is native finger contact with a 0.2–0.4 kg payload. The learned
actor has not demonstrated reliable acquisition. These experiments test changes
using frozen policies and matched evaluation starts; they do not replace the
separate requirement for over 90% full-mission success.

## Protocol

All pilots use the same shared 128×128 ELU MLP, 2,816 observation values per
robot, 23 actions, and the existing planner-owned hand targets. One policy is
evaluated independently on each robot. Contact physics, the 1 Nm finger/wrist
torque limits, sliding friction 3–4, and final acceptance remain unchanged.
Success requires four native grasps, the commanded 6 cm lift, final object-pose
tolerances, palm orientation within 10 degrees of the assigned normals, and
8 seconds of stable hold. The mobile-base tilt termination remains 2 degrees.

| Pilot | Initialization | Changed factor |
|---|---|---|
| Tolerant control | Existing actor, critic, optimizer and normalization | Current reward with revised acquisition safety |
| Best grasp progress | Exactly the same saved state | Grasp position/orientation progress is credited only beyond the episode's best previous error |
| Scratch | Random action-mean network and critic, empty optimizer | Initialization; the source's normalizers and action-noise scales provide the same input/exploration calibration |

The warm-start source is
`rl/runs/native_grasp_light_reward_only_mlp_continue_001/step_00075520.pt`, SHA-256
`c44591054e6119e3179965366387a982dde404f47c7934b8d0fae3a1552151d1`.
The scratch comparison is a bundled initialization ablation: actor, critic and
optimizer begin afresh. It cannot isolate the benefit of each component alone.

All new updates use PPO returns and advantages, with teacher auxiliary loss
coefficient 0 and policy-anchor coefficient 0. There is no demonstration data
collection or teacher action used in these pilots. The critic is optimized
alongside the actor. A `learning_audit.json` records changes to actor and critic
parameters and checks the absence of teacher/anchor losses; parameter changes
alone are not evidence of better task performance.

Each pilot uses one CPU environment, 128-step rollouts, three optimization
epochs, four minibatches, learning rate 0.0001, gamma 0.995 and GAE lambda 0.95.
Normalization is frozen. Learning-rate decay is disabled for these matched
short pilots: resuming a high global step counter with a short extension would
otherwise reduce the learning rate almost to zero immediately.

| Stage | Additional simulation steps | Training seed | Frozen evaluation seeds |
|---|---:|---:|---|
| Initial pilot | 4,096 | 2,440,000 | 2,480,000–2,480,005 (6 trials) |
| Extended pilot | 12,288 (16,384 cumulative) | 2,540,000 | 2,490,000–2,490,019 (20 trials) |

These are development cohorts with one training seed. They support diagnostics
and candidate selection, not a robust causal or statistical conclusion. Any
candidate must subsequently pass fresh 100-trial confirmation, then the
separate signed translation, yaw, pitch, asynchronous-arrival and physical
release/regrasp cohorts. Full doorway and obstacle missions remain separate.

## Why change termination and progress rewards?

During acquisition, temporary object tilt and small adjustments should have
time to recover. The revised monitor allows up to 60 degrees of orientation
error for 0.4 seconds and 15 cm of unsupported excursion for 0.75 seconds, with
immediate hard limits of 80 degrees and 25 cm. It requires 0.3 seconds of
continuous four-hand support before resetting the unsupported-travel origin;
brief contact therefore cannot conceal repeated dragging. After established
support, the nominal 5 cm unsupported-excursion bound returns with the grace
period. Orientation error is relative to the planner's nearby SE(3) reference,
so commanded pitching is not treated as accidental world-frame tilt.

The inherited policy's revised screen still fails. For example, seed 1,980,000
ended after 20.6 seconds with 15.6 cm of unsupported excursion lasting 0.76
seconds. Its peak orientation error was only 11.35 degrees, its tilt reward
penalty was zero, and it never obtained four-hand support. This is direct
evidence that tilt sensitivity alone did not explain the failure.

The optional `recovery.grasp_progress_mode = "best_so_far"` follows the
best-achieved-distance idea in the
[SimToolReal reward implementation](https://github.com/tylerlum/simtoolreal/blob/main/isaacsimenvs/tasks/simtoolreal/utils/reward_utils.py).
For each robot it credits improvements in assigned palm position and
orientation error; retreating and returning to a previously achieved error
does not receive more progress credit. Existing distance, separation, contact,
slip and stability terms still apply. This is an adaptation of one reward idea,
not a reproduction of SimToolReal or its SAPG training algorithm. The default
`step_delta` preserves archived behavior.

## Files and monitoring

- Pilot settings: `rl/configs/native_reward_ablation_pilots_v1.json`.
- Warm-start supervisor: `rl/scripts/run_native_reward_ablations.py`.
- Live warm-start status: `experiments/live/native_reward_ablation_pilots_v1.json`.
- Live scratch status: `experiments/live/native_grasp_scratch_ablation_v1.json`.
- Resolved training configs: `experiments/live/native_training_configs/`.
- Runs: `rl/runs/native_grasp_ablation_{tolerant_control,best_progress}_mlp_*`.
- Frozen outcomes and recorded MuJoCo states:
  `experiments/results/native_grasp_acquisition_ablation_*`.

The warm-start supervisor runs at most two simulation workers. Scratch waits
for the initial tolerance screen to finish before taking its slot, keeping at
most three training/evaluation environments active. The original tolerance campaign was retired after its complete 0/20 frozen
screen. Its checkpoints and reports remain available. The next reference study
waits for valid reset evidence and completion of the current warm-start pilots;
the retired campaign will not resume and consume two additional environments. Recorded states are kept for deterministic video rendering; rendering
does not re-simulate a different trajectory.

Full resumes accept only specifically named task revisions:
`--allow-grasp-safety-change`, `--allow-grasp-progress-change`,
`--allow-grasp-reference-change`, `--allow-approach-range-change`, and
`--allow-pregrasp-reset-change`. Other physics,
actions, success requirements and observation changes still fail the resume
configuration check. Each allowed revision is written to run metadata.

## Findings and revised experiment order

Both first 4,096-step warm-start pilots completed 32 reward-only PPO updates.
All six actor and all six critic parameter tensors changed, but each frozen
six-start screen returned **0/6**. Larger return or successful optimization
therefore cannot be substituted for grasp success. Their declared 12,288-step
continuations and separate 20-start cohorts retain the same original settings.

The original approximate KL stop was checked after an optimizer step even
when its pre-step KL already exceeded the threshold. The pilots reported KL
values far above 0.02. Instrumentation found stored/recomputed behavior
log-probabilities agreeing within about 0.00007, no clipped actor observations,
and the expected observation standard-deviation floor of 0.1. The sampled
Gaussian actions and their original log probabilities are retained in the
buffer even when motor inputs are clipped. These checks did not identify a
rollout/log-probability mismatch. The inherited action standard deviation is
approximately 0.030, making small changes to action means consequential.

A new, default-off `training.strict_kl_guard` measures mean analytic forward
KL over the complete collected rollout after each proposed update. An
overshoot restores the actor **and its Adam state**, while critic optimization
continues. This bounds average change on collected states; it is not a
guarantee of physical safety or task success. In the 256-step smoke at learning
rate 0.00001, five actor updates and 24 critic updates were accepted. Two
overshoots around KL 0.0257 were rejected, leaving final rollout KL 0.0153 and
0.0166. No teacher or anchor loss was used. The smoke is an optimizer check,
not a successful grasp rollout.

The not-yet-started optimizer comparison was deferred after static replay
analysis found substantial rail/finger penetration at the assigned hand
reference. Changing only the vertical offset is insufficient; both vertical
and forward TCP offsets require calibration. Nearly collision-free fingertip
pinches are not evidence that the bar rests on the palm body. The calibrated
reference must be physically checked before new training uses it.

The remaining studies are predeclared in
`rl/configs/native_grasp_followup_ablation_plan_v1.json`:

1. Original versus physically calibrated planner hand reference, with the
   same conservative learning rate, KL guard and reward weights.
2. Immediate strict acquisition limits versus bounded adjustment limits.
   Both retain the same support-settling monitor and tilt reward, so this
   isolates termination behavior. Both policies face the same frozen
   evaluation protocol.
3. Fixed 0.3 kg payload and friction 3.5 versus randomized 0.2–0.4 kg and
   friction 3–4 during training. Both face identical randomized validation
   starts. This is a bundled mass/material comparison, not separate estimates
   of each parameter's effect.

The termination and domain comparisons are waiting on reference validation;
they have not produced results. Broad object/scene randomization and the full
approach–grasp–lift–transport–reorient sequence remain subsequent requirements.


## Reference calibration and reset audit

The best-achieved-distance pilot completed its additional 16,384 PPO steps and
returned **0/20** on its second frozen cohort. Failures were 15 unsupported
travel, two base overturns, one hand penetration, one unintended payload/robot
contact and one timeout. Mean episode length was 8.75 seconds. Changing this
progress term alone did not solve secure acquisition. The matched control also completed its final cohort at **0/20**. The scratch
cohort is still running; partial outcomes remain separate from completed cohorts.

The proposed reference comparison uses the original vertical/forward TCP
offsets of −40/+45 mm and a candidate inner-palm reference of −33.5/+90 mm.
Both would use the same near-start training distribution, conservative PPO,
strict KL guard and reward weights. The independent evaluation still starts
40–100 mm away. This comparison isolates the reference within a new near-start
training regime; it cannot be compared with the old full-distance training as
if only one field changed.

Static placement is insufficient to validate a reset. Ideal open and closed
hands fit the candidate inner-palm reference within the existing 4 mm contact
penetration bound, but real reset IK and settling produce different finger and
arm states. Actual 0, 5 and 15 mm standoff resets had 8.08, 11.29 and 22.45 mm
rail penetration, respectively, with up to 426 N initial contact force. All
three terminated for penetration at the first 0.02-second policy step. The
provisional 0–15 mm reset range is therefore **not approved for training**.
The measured traces are retained in
`experiments/diagnostics/grasp_geometry_audit_20260909/inner_palm_real_reset_open_hold.json`.

The reset implementation captures final planner hand targets and then moves
the robot base backwards while keeping its arms fixed. Near this palm target,
that motion can sweep the fingers through the rail. The next diagnostic lowers
only the initial open-hand IK target before base backoff, leaving the final
planner target unchanged. It must establish a physically valid open start
before the curriculum is enabled. No collision limit, torque limit or success
criterion is relaxed to admit these starts.

The planned distance curriculum promotes only after strictly more than 90%
success over a completed-episode window; each level has a minimum trial count.
Its configuration, current level, evidence window and reset-domain identity
are saved with checkpoints. A separate frozen-suite distance override prevents
near-contact training from silently becoming easier evaluation. Closure,
lifting and waiting remain policy actions throughout this curriculum.


A 15 mm reset-only IK clearance reproduced safe two-second open holds through
the public Gym configuration at 0 and 5 mm standoff: penetration stayed below
2.41 mm and passive object drift below 0.27 mm. At 15 mm standoff the same
configuration still produced 14.07 mm penetration and failed immediately.
These endpoint checks do not establish validity across all interior seeds or
the full approach range. Wider-distance reset clearance is being audited before
any automatic distance curriculum is enabled.

A separate fixed-action diagnostic used deeper MCP/PIP closure angles of
1.2/1.2 radians, versus the unchanged 0.85/0.7 baseline. It completed seven
seconds, lifted 29.8 mm and drifted 1.37 mm, with actual hand torque below
0.885 Nm. This is physical evidence, not learned-policy success. Both MABEL
hands had contact-normal opposition around 0.58–0.59, below the unchanged 0.7
qualification threshold; MILO was around 0.94–0.96. This scalar opposition test
is a conservative grasp heuristic, not a complete friction-cone force-closure
analysis. No measured palm-body support force was present, so the requested
bar-in-palm behavior remains unresolved even during a stable finger pinch.


## Audited reset domain and active reference study

The public configuration now exposes `environment.acquisition.reset_pregrasp_clearance_m`.
It lowers only the cached initial open-hand IK target. The planner's final
assigned hand poses, policy observations/actions, native contact mechanics,
actuator limits and success conditions retain their separate definitions.
The field defaults to zero for archived behavior; full-checkpoint continuation
requires the explicit `--allow-pregrasp-reset-change` flag and records both
source and target values.

A common **50 mm** reset clearance passed both references on a denser physical
audit: 21 standoff distances from 0 to 100 mm in 5 mm increments, with two
matched randomized seeds each, for **84 valid open-hold trials**. Observed mass
ranged from 0.2006 to 0.3974 kg and sliding friction from 3.0047 to 3.9994.
The calibrated reference had at most 2.17 mm rail penetration and 0.61 mm
passive object drift during the 0.5-second checks; the original reference had
no rail contact. This is a finite reset audit, **not 84 grasp successes** and
not a proof covering every continuous initial condition.

The immutable evidence manifest is
`experiments/diagnostics/native_grasp_reference_feasibility_v1.json`. It binds
each reference to a hash of its complete environment configuration, excluding
only RNG seed and the deliberately swept standoff range. Native material
samples and per-hand initial/final contacts are retained in the two
`*_50mm_randomized_reset_audit.json` reports. Training refuses a different
reset configuration, an incomplete audit, or an uncovered curriculum range.

The original-reference and calibrated-reference PPO pilots are now active.
Both begin with a 0–5 mm base standoff and the same 50 mm open-hand clearance.
Their common automatic distance stages are 0–5, 5–20, 20–50 and 40–100 mm.
A level changes only after more than 90 successes in a completed 100-episode
training window. The frozen benchmark always uses 40–100 mm; training
promotion does not count as independent validation.

The earlier calibrated-only continuation was deferred before it trained.
The active pipeline in `rl/configs/native_grasp_followup_studies_v1.json`
selects its source from both completed frozen reference cohorts, runs the
matched termination and material studies below, then continues the selected
reference in 32,768-step PPO blocks. Fresh 20-trial screens and a separate
100-trial confirmation must each exceed 90%. This acquisition gate remains
separate from motion, pitch/yaw, delayed-start, regrasp and full scene missions.
The retired tolerance campaign and old failed studies remain available.


## Executable follow-up comparisons

The source-selection rule was declared before either final 20-trial reference
cohort completed. In order, it compares successful trials, trials with an exact
first four-hand-support event, time-integrated qualified-hand contact divided
by the complete declared episode budget, and lower contact-conditioned slip.
No contact is treated as missing slip evidence, not perfect zero slip. Exact
ties select the original reference. The selected checkpoint and every score
are recorded in `experiments/live/native_grasp_reference_selection_v1.json`.
Selection is a development decision, not a validation success claim.

| Queued study | Only training factor changed | Matched conditions and frozen evaluation |
| --- | --- | --- |
| `native_grasp_termination_ablation_v1.json` | Immediate 5 cm/0.6 rad acquisition limits versus 15 cm/0.75 s travel grace and 60°/0.4 s orientation grace | Same selected actor/critic/Adam, 50 mm reset clearance, near range, all rewards, material sampling, PPO settings; both evaluated with the same tolerant limits and full 40–100 mm starts |
| `native_grasp_material_ablation_v1.json` | Fixed 0.3 kg/friction 3.5 versus mass 0.2–0.4 kg/friction 3–4 | Same selected source and all other settings; both evaluated using one shared randomized full-distance configuration |

Both studies use 4,096 then 12,288 additional PPO steps per variant, with
matched training seeds and separate frozen 6/20-trial cohorts. They use the
same source selected from the reference pair; the second study does not inherit
weights from whichever termination arm happened to finish first. Training
standoff stays fixed at 0–5 mm in both arms. Previous distance-curriculum
evidence is explicitly restarted for this new comparison; actor, critic,
normalizers and Adam are retained. The narrow mass/friction resume override
cannot change force limits, contact qualification or success criteria.

The two study supervisors are running in a waiting state. Termination pilots
start after reference selection; material pilots start after termination
pilots and evaluations finish. At most two one-environment variants run
together, leaving the third simulation slot for the scratch comparison.
The shared frozen evaluation configuration is distinct from each variant's
training configuration, preventing an easier training mass or termination
from silently changing the benchmark. Outcomes and recorded-state paths are
retained for automatic video rendering without another simulation.

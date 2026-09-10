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
most three training/evaluation environments active. The main continuous
campaign supervisor is temporarily suspended while its original frozen screen
continues intact. It resumes automatically after the two warm-start pilots
finish. Recorded states are kept for deterministic video rendering; rendering
does not re-simulate a different trajectory.

Full resumes accept only specifically named task revisions:
`--allow-grasp-safety-change` and `--allow-grasp-progress-change`. Other physics,
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

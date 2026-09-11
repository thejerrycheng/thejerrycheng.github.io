# Dexterous play lessons for native-contact cooperative carrying

Reviewed 9 September 2026. This document separates research findings, M₂ design
choices, and measured outcomes. The active contact experiment has **not** passed
the requested greater-than-90% end-to-end acceptance threshold.

The inherited step-75,520 policy completed the new grasp-tolerance baseline
with **0/20 acquisition successes**. Every trial ended on unsupported object
travel; none established four-hand support. This is a frozen baseline under
revised termination conditions, before the parallel reward ablations.
[Baseline report](../experiments/results/native_grasp_acquisition_light_grasp_tolerance_mlp_000_screen.json).

## What the two papers establish

**Play2Perfect** studies demonstration-free play followed by assembly RL. Its
ablations vary objects, pose objectives, goal trajectories, and precision. It
uses SAPG and an LSTM actor on a single dexterous arm. The current paper version
is v3, revised 8 September 2026. These are useful curriculum comparisons, not
evidence that a small M₂ MLP will solve cooperative carrying.
[Paper](https://arxiv.org/html/2606.26428v3),
[project demonstrations](https://play2perfect.github.io/).

**SimToolReal** conditions tool manipulation on object state, goal pose and a
grasp-region description. Its actor uses interaction history; its asymmetric
critic receives additional simulator information. Goal advancement follows
measured achievement. The physical setup is a dexterous hand on one arm, so
support from an independent partner is outside its demonstrated task.
[Paper, Sections III–IV](https://arxiv.org/html/2602.16863v1),
[project](https://simtoolreal.github.io/).

M₂ retains a planner-owned SE(3) reference. Each local policy receives its hand
targets and relative object/task measurements. The policy controls the robot's
bounded base, lift, arm and closure commands. Reward bookkeeping may detect
support and progress, but must not supply a phase or force an action transition
to a deployed actor. We must test whether local measurements let the two copies
wait and recover, rather than infer that behavior from shared parameters.

## Reward ideas checked against executable code

The table describes the authors' current public helper functions, inspected on
9 September. It is not a claim that M₂ implements their algorithm exactly.
[SimToolReal reward source](https://raw.githubusercontent.com/tylerlum/simtoolreal/main/isaacsimenvs/tasks/simtoolreal/utils/reward_utils.py).

| Source behavior | M₂ experiment motivated by it | What must remain measurable |
|---|---|---|
| Before lifting, fingertip progress earns credit only when it beats the previous closest distance. | Compare best-so-far hand-frame distance progress with the existing signed step-to-step delta. | Hand position and orientation errors, new contact times, retreat distance. |
| Lift reward stops after a latched lifted condition; the crossing bonus is one-shot. | Avoid indefinite reward for merely hovering near a grasp or repeatedly lifting without transport. | Four-hand support, payload clearance, unsupported travel and subsequent progress. |
| After lifting, keypoint reward measures improvement over the previous best goal distance. | Later evaluate a 3D pose-progress term against separate translation/rotation terms. | Position and rotation accuracy reported separately so object scale cannot hide rotation error. |
| The helper named `action_penalty` penalizes joint-velocity magnitude. | Compare smoothness and mechanical work as separate quantities. | Joint speed, physical torque × speed work and torque saturation. |

For M₂'s hand-distance ablation, let `d_t` be the measured error and `b_t` the
minimum error previously reached in the episode. The candidate progress is
`max(b_t - d_t, 0)`, with `b_(t+1) = min(b_t, d_t)`. This prevents repeatedly
earning the same approach credit by oscillating away and back. It does not
reward a secure grasp by itself. Closure, useful opposing contact, slip, and
supported lifting remain necessary objectives.

The candidate is **not policy-invariant potential shaping**: an asymmetric
best-so-far reward changes the optimization objective, and the minimum is
additional state. The privileged critic should see relevant progress state if
this term becomes permanent. No phase or partner-readiness input is thereby
required by the actor. A one-factor experiment determines whether the changed
objective helps this plant.

M₂ also needs to distinguish successful regrasp from bonus farming. Initial
acquisition bonuses remain one-shot. After a release, supported task progress
and the final sustained hold must provide the main return. A repeated-contact
bonus must not outweigh the cost of dropping and recovering.

## Termination is part of the task, not a success-rate tuning knob

The public SimToolReal termination helper checks low object height, excessive
hand distance, a maximum goal count, and time limit. Its tolerance curriculum
can tighten during training while evaluation pins a fixed tolerance.
[Termination helper](https://raw.githubusercontent.com/tylerlum/simtoolreal/main/isaacsimenvs/tasks/simtoolreal/utils/termination_utils.py).
The paper additionally describes drop hysteresis and a table-force limit;
those checks are not present in that helper. An implementation should be
verified directly rather than assuming every listed paper condition is active.
[Paper, Appendix A-B5](https://arxiv.org/html/2602.16863v1).

For our mobile payload, returning to a support during acquisition or losing one
grasp should permit a recoverable attempt. Immediate termination still applies
to overturned bases, nonfinite physics, unacceptable collisions, and hard
object excursions. The new grasp-tolerance profile gives short transients a
grace interval and keeps a stricter settled-support bound. Payload orientation
error is relative to the planner's target, so a commanded pitch or flip is not
mistaken for an unintended fall. See
[grasp safety configuration](../rl/configs/native_grasp_light_grasp_tolerance_mlp_v1.json)
and [monitor implementation](../rl/m2_rl/grasp_safety.py).

Changed termination rules define a new protocol. Scores from it must be labeled
separately from older runs; relaxing a limit is not itself learned improvement.
The final hold, physical contact and task-completion criteria remain fixed in
the declared evaluation suite.

## Current initialization and reward ablations

The compact policy is an MLP with two 128-unit hidden layers over the same local
history layout on both robots. Two warm-start pilots and one random-network
pilot receive the same task, reward coefficients, grasp-tolerance settings,
frozen preprocessing and initial exploration scales, except for the declared
reward change in one warm-start arm. Each uses one simulation environment.

| Comparison | Training initialization | Scientific question |
|---|---|---|
| Warm-start control | Actor, critic and optimizer from step 75,520; teacher and anchor losses zero | Can online rewards improve the existing contact policy after supervision ends? |
| Best-so-far progress | Same checkpoint and learner history as control; only approach-progress definition changes | Does removing repeated approach credit reduce grasp readjustment? |
| Random-network control | Random actor-mean network and critic, fresh Adam; calibrated normalizers and action-noise scale only | Is the existing learned initialization helping under matched input and exploration scaling? |

The last row is deliberately labeled **random-network**, rather than claiming
that nothing was inherited. No actor-mean weights, critic weights, demonstration
labels or optimizer moments enter it. The comparison also bundles prior critic
and optimizer knowledge in the warm-start arm; it does not isolate behavior
cloning from all other pretraining effects. Further seeds and an actor-only
warm start would be needed for that claim.

The audited source action log standard deviations lie between −3.502 and
−3.495, approximately 0.030 standard deviation in normalized action units.
Matching that narrow exploration isolates the initialization comparison, but
may hinder learning from random networks. A failed pilot would motivate a
separate exploration-scale ablation, not a conclusion that reward-only learning
from scratch is impossible.

The random-network launcher records the source SHA, exact inherited fields,
initial random seed, zero optimizer-state count, and checkpoint SHA. After
each training budget it checks that actor and critic parameters both changed,
teacher/anchor coefficients stayed zero, and frozen normalizers stayed equal.

| Budget | Additional environment steps | Training seed | Frozen acquisition trials | Evaluation seed |
|---|---:|---:|---:|---:|
| Pilot 1 | 4,096 | 2,440,000 | 6 | 2,480,000 |
| Pilot 2 | 12,288, for 16,384 cumulative | 2,540,000 | 20 | 2,490,000 |

These are small development screens. They do not certify reliability or
end-to-end transport. Every reset, planning failure, physics failure and timeout
counts. Frozen evaluations save robot/object states for replay. The random
pilot uses the existing
[acquisition suite](../rl/configs/native_grasp_acquisition_suite_v1.json).

The first random-network budget completed 4,096 steps. Its audit measured actor
parameter change L2 = 0.4539 and critic change L2 = 0.9664, with unchanged
normalizers and zero teacher/anchor coefficients throughout. Both completed
training episodes timed out without a grasp; these are training outcomes,
separate from the frozen six-trial screen. The frozen candidate SHA is
`3a9a00af857ff7abe2e3de0d925d8e053e7e47381bae363d0a4c70906e6cf2c3`.
[Learner audit](../rl/runs/native_grasp_light_random_network_mlp_pilot_001/learning_audit.json).

The corresponding frozen screen completed **0/6 successes**. All six trials
reached the 30-second time limit without establishing four-hand support. The
second training budget continued from that checkpoint and retains the failure
records.
[Frozen six-trial report](../experiments/results/native_grasp_acquisition_random_network_mlp_pilot_001.json).

The second random-network budget has now completed its additional 12,288 steps,
for 16,384 total. Its actor parameter change L2 is 0.7507 and critic change L2
is 2.7983; normalizers stayed unchanged and teacher/anchor weights stayed zero.
The frozen final candidate SHA is
`b3cc69c0708d08af57931efc92711fbd6b7fbb395aed97f9eabe08e4f226ce04`.
Its independent 20-trial screen is still in progress as this note is written;
the live report retains every completed outcome and marks `complete` explicitly.
[Second learner audit](../rl/runs/native_grasp_light_random_network_mlp_pilot_002/learning_audit.json),
[frozen 20-trial report](../experiments/results/native_grasp_acquisition_random_network_mlp_pilot_002.json).

- [Scratch experiment specification](../rl/configs/native_grasp_scratch_ablation_v1.json)
- [Launcher](../rl/scripts/run_native_scratch_ablation.py)
- [Live status and completed evaluation paths](../experiments/live/native_grasp_scratch_ablation_v1.json)
- [Initial-state provenance](../experiments/live/native_scratch_ablation_v1/initialization_provenance.json), generated once training starts

## What comes after a reliable grasp

The training reset-distance curriculum is now implemented, with a strict
completed-episode promotion threshold above 90%. It remains disabled until
physical reset evidence covers every proposed range and matches the resolved
geometry/randomization fingerprint. The frozen acquisition suite independently
retains its 4–10 cm approach distance. This separates easier training starts
from actual full-approach validation. See the
[curriculum configuration and tests](RL_APPROACH_CURRICULUM.md) and
[physical grasp geometry audit](RL_NATIVE_GRASP_GEOMETRY_AUDIT.md).

The next training distribution should expand reachable object pose goals and
geometry only after retention works. Test single-axis translation and rotation
before mixed commands, then asynchronous arrivals and injected release. A
release trial must establish prior transport, physically lose contact, regrasp,
and resume progress; a failed fault injection cannot count as recovery.

The planner then supplies scene-level pose paths through doorways and over
floor obstacles. Goal selection follows measured spatial progress so a waiting
robot is not asked to catch up to a reference that moved with elapsed time.
The final validation spans initial object poses, robot standoff and heading,
object size/mass/friction, measurement noise/delay, and both choices of delayed
or released robot. These conditions must be reported by cohort, with more than
90% observed success in every declared acceptance cohort. Acquisition-only
screens, old welded trials and scripts are separate evidence.

None of these papers supplies a success guarantee for M₂'s hand model, torque
limits or four-contact geometry. Their released policies target different
embodiments and observation layouts; those checkpoints cannot be deployed here
as if they were M₂ policies. A lightweight MLP versus memory study should remain
an explicit ablation after the reward and mechanics bottlenecks are understood.

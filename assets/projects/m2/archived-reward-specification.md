# Reward and training specification

Scope: separate PPO branches `end_to_end_v15_expanded_domains_ppo` and
`end_to_end_v17_distance_gated_reward_ppo`. These objectives do not optimize
the frozen DAgger actor used for the 35/40 mission result. Equations were
checked against the v17 run's archived source and environment_config.json.
The live environment has subsequently changed; archived code is authoritative.

For robot i, the control timestep is Δt = 0.02 s. During approach/lift,
`EndToEndCarryEnv.step` REPLACES the inherited transport reward. The main
paper's acquisition table lists every term in those two phases. The +2
transition bonuses and −5 terminal penalty are not timestep-scaled.
The height kernel is clipped below at zero, but not above; the baseline
normalization switches to the raw kernel when Φ(e0) ≥ 1−10⁻⁶.

## Complete transport reward

Write Kσ(x)=exp(−||x||²/σ²), H for the paper's normalized height kernel,
η for object roll/pitch, βj for chassis inclination and ξ=(vx,vy,ω).
All rows below are multiplied by their weight and Δt. Positive shaping
terms marked P are also multiplied by the raw task value P. A terminal
sequence failure adds −5 after this sum.

| Term | Raw value | Weight | Gate |
|---|---|---:|---|
| Task P (velocity commands) | exp(−||(ξ−ξ*)/(0.15,0.15,0.2)||²) | 10 | none |
| Linear tracking | T₀.₂₅(v,v*) | 3 | none |
| Angular tracking | T₀.₃₅(ω,ω*) | 2 | none |
| Height | H(z−z*) | 2 | P |
| Level | K₀.₁₅(η) | 1 | P |
| Grasp | 1[robot i's grasp engaged] | 1 | P |
| Base inclination | −(maxⱼ βj / (π/90))² | 4 | none |
| Torso upright | K₀.₂₆₁₇₉₉(torso pitch i) | 0.5 | P |
| Arm symmetry | K₀.₁₅(arm symmetry error i in m) | 0.5 | P |
| Contact constellation | −Ec,i / 0.05² | 1 | none |
| Base constellation | −1[grasp engaged] Eb,i / 0.05² | 1 | none |
| Residual magnitude | −||a₀:₃||² − 0.1||a₃:||² | 2 | none |
| Object tilt | −min((||η||∞/0.15)²,4) | 0.5 | none |
| Action rate | −||at−at−1||² | 0.005 | none |
| Drop | −1[z < zrest−0.12 m] | 50 | none |

Tracking uses a stationary baseline with a smooth zero-command fallback:
Tσ(x,c) = (Kσ(x−c)−b)/max(1−b,0.1) + [1−min((1−b)/0.1,1)]Kσ(x−c),
where b=Kσ(c).

Ec,i is mean squared displacement of six ±0.05 m axis landmarks at each
assigned palm, averaged over the palms, relative to their attained object-frame
contact transforms. Eb,i uses base landmarks (0,0,0), (0.1,0,0), (0,0.1,0)
relative to the attained object-frame base transform. These terms include
position and orientation through transformed landmark errors.

The archived task function also supports a path-manager branch:
P=clip((p−p0)·u / ||pref−pref,0||,0,1), u the reference-displacement direction;
it returns 1 if reference displacement is below 1 mm. The reported PPO runs
use the velocity-command branch, not this planned-path branch. Furnished
scenes receive zero velocity commands (`hold_in_furnished_scenes`); the
flat arena receives sampled commands.

## Randomization and curriculum audit

The main paper distinguishes final DAgger collection, separate PPO and frozen
mission evaluation. The final collection uses explicit mass 1–2 kg and native
geometry scaling ±5%; imported datasets retain their historical noise and
actions. Do not infer a single homogeneous noise distribution for all imported
samples. Automatic difficulty and stage curricula are disabled in both final
DAgger and PPO metadata. DAgger changes who executes the actions between
aggregation rounds; the execution phase supervisor is not a learning curriculum.

PPO uses full dynamics difficulty (1): COM offsets are uniform within
±(0.05,0.12,0.05) m and gains within [0.85,1.15] of nominal. Configured interval
perturbations include payload forces bounded by 0.15 times weight (torque lever
0.25 m), nominal resampling every 1.2 s, and robot pushes up to 3 N s every
3.5 s, each with interval jitter 0.25. Native rail friction is uniform [0.9,1.8].
These perturbations are training configuration, not hardware calibration.

Failure is terminal; the 35 s training timeout is truncation. Read executable
termination functions and their configured terminal flags together: historical
comments about overshoot describe other experiments. In these saved configs,
2.5× target-rise overshoot is terminal. Object tilt >0.6 rad, drop below
rest−0.12 m, chassis inclination >2°, and forbidden world contact also fail.
The main mission's 180 s budget and geometric success criteria are separate.

## Authoritative local sources

- `rl/runs/end_to_end_v17_distance_gated_reward_ppo/environment_config.json`
- `rl/runs/end_to_end_v17_distance_gated_reward_ppo/source_snapshot/rl/m2_rl/envs/end_to_end.py`
- Same snapshot: `mdp/rewards.py`, `mdp/events.py`, `mdp/terminations.py`,
  `managers/reward.py`, and `envs/carry_env.py`.
- `rl/runs/end_to_end_v20_local_height_all_objects/environment_config.json`,
  `run_metadata.json`, `method.json` and `bootstrap_outcomes.json`.

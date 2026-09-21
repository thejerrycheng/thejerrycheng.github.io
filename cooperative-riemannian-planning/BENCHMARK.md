# Planner benchmark protocol

This is a finite-budget, fixed-scene study, not evidence of general state-of-the-art superiority.

- Six baseline scenes; seeds 0, 1, 2; requested solve budget 30 seconds.
- Official OMPL 2.0.1 RRTConnect and BITstar. RRTConnect range 0.35; BITstar native default settings and SE(3) path-length objective. Exact solutions only.
- Both use the same bounded grounded IK, one stored robot witness per pose, collision predicates, projected edge checker and independent quarter/half/three-quarter interpolation audit as the proposed planner.
- Scene-guided roadmap: one batch of 100 random samples plus its declared scene-derived layers. Uniform roadmap ablation: 100 uniformly sampled pose coordinates, no scene layers. OMPL uses its native SO(3) uniform sampler. Proposal distributions and graph construction are therefore not identical; this is explicitly a system comparison, with a prior-removal ablation, not a pure search-algorithm isolation.
- Model construction is outside the solve timer. The timing includes planner setup, pose validation and edge checking. Audits, common-cost scoring, exports and execution are separate. Native termination callbacks may overshoot; use actual recorded wall times. A failed solve remains in the timing and success statistics.
- Requested deadline is also checked inside feasibility callbacks in protocol version 2. Earlier development timings are retained as `earlier_protocol.json` where replaced. Protocol versions are recorded in raw trial metrics.
- Hardware is a shared workstation; rendering and other experiments can overlap. Wall times are descriptive, not isolated throughput claims.
- Travel and accumulated rotation are computed from dense saved paths. Both robot base travels are retained separately. All valid paths receive a common grasp-pullback cost.
- Reference duration uses the same translation, rotation, joint and base rate bounds. It is not executed time.
- Seed-0 accepted paths receive the same whole-body controller and explicit secured-grasp dynamics. Execution records include success/failure, contact penetration and terminal object errors. No controller tuning per planner.
- Positive actuator work integrates `sum(max(actuator_force * actuator_velocity, 0)) * timestep` at each physics step. This measures mechanical transmission work, not electrical energy. Preparation/settling are included, regeneration is not credited. Failed rollouts do not yield completed-task energy estimates.
- Sampled environment clearance excludes the floor and is capped at 1 m; it is not a continuous swept-volume certificate.

Install the official platform wheel separately (the binary is not vendored in publication sources):

```sh
python -m pip install --target .deps ompl==2.0.1
python run_benchmark_suite.py
python benchmark_execute.py
python benchmark_metrics.py
python publish_extended.py
```

The benchmark needs the existing M2 simulator and assets via `M2_REPOSITORY`. The planning paper does not train or modify the existing RL controller.

Primary sources: [OMPL benchmarking](https://ompl.kavrakilab.org/core/benchmark.html), [RRT-Connect implementation](https://github.com/ompl/ompl/blob/main/src/ompl/geometric/planners/rrt/RRTConnect.h), [BIT* authors' implementation page](https://robotic-esp.com/code/bitstar/).

## Prior-only control

`PriorOnly` deterministically lifts the exact same existing planar itinerary into spatial poses with gradually interpolated goal height/attitude. Each node and edge passes the same witness checks and final audit. A rejected connection ends the run; there is no graph search, replanning or metric optimization. The museum aperture has no stored planar prior and therefore tests a straight scene-derived itinerary. This control is run once per scene (seed 0), because repeats would be deterministic duplicates.

Comparisons between the guided roadmap and this control distinguish the supplied itinerary from subsequent spatial search. Execution efficiency should be paired by scene where both produce an audited path; aggregate medians over different successful scene subsets are not a paired efficiency test. Benchmark execution uses raw audited witnesses without post-planning joint-centering refinement for every method.


## Recent optimizing baselines and five-room refinement

The extension includes official OMPL 2.0.1 AORRTC (Wilson et al., RA-L 2025, DOI 10.1109/LRA.2025.3615522) and Informed RRT*. AORRTC is a recent optimizing RRT-Connect baseline, not a claim that this suite covers every current planner. AIT*/EIT* were not run. The available Python bindings do not expose them. Native optimizing methods use OMPL geometric SE(3) path length, not the proposed combined execution-duration objective.

`run_long_benchmark.py` applies the same four external planners to both frozen five-room scenes, three seeds and a 30 s solve budget. These are unconditioned global searches. They are not computationally matched against the room-itinerary initializer plus offline refinement: the latter has a supplied room order and uses additional feasibility queries. Zero solutions therefore cannot establish superiority of its optimizer.

`optimize_long_horizon.py` preserves the itinerary but frees the three room-center corners. It minimizes `0.5 D/D0 + 0.5 T/T0` over audited quadratic-corner combinations, with unchanged corners included. Both paths use `trajectory_cost.py` for comparison: rate bounds, a scalar forward/backward pass and sampled physical acceleration scaling. The result is a best tested candidate, not a globally shortest or fastest route. Exact splice configurations, secure grasps, joint limits and robot/object collision geometry are retained. `publish_distance_time.py` exposes every candidate and weight sweep. Original executions used velocity-only timing and remain archived separately. `execute_distance_time_baselines.py` re-executes their raw grasp-witness paths with the same new timing routine; these controlled baseline rollouts are used for the paired execution comparison.


One AORRTC trial (museum floor-clearance, seed 2) finds an independently audited solution in the 30 s study. The same controller is additionally evaluated on this path and the matching guided seed-2 path. These two extra rollouts are reported explicitly rather than being described as seed-0 executions or silently discarded. Every other unconditioned external trial is retained as a finite-budget failure.


## Reproduction dependencies

Use `requirements_planning.txt` for the tested numerical/rendering versions. The local OMPL 2.0.1 wheel was isolated in `.deps/` and is intentionally not vendored. Install that official package into the active interpreter or via `python -m pip install --target .deps ompl==2.0.1`. Set `M2_REPOSITORY` to the M2 asset checkout for simulator geometry; source hashes in the review manifest record the actual dependency working tree. Run `run_benchmark_suite.py`, `run_long_benchmark.py`, `optimize_long_horizon.py`, then the execution/publishing scripts. Avoid concurrent jobs for dedicated timing studies; the archived timings were measured on a shared workstation.

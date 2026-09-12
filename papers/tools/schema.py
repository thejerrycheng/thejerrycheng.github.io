"""Shared schema + taxonomy for the paper library."""

# ---------------------------------------------------------------- taxonomy
TREES = {
  "rl": {
    "name": "Reinforcement Learning",
    "blurb": "Policies learned by interaction and reward — from algorithmic foundations "
             "through legged locomotion, dexterous manipulation, multi-agent coordination, "
             "and RL as a post-training stage on top of foundation models.",
    "branches": {
      "foundations":  ("Algorithmic foundations", "Policy-gradient, actor-critic, off-policy and model-based cores that everything below is built on."),
      "locomotion":   ("Locomotion", "Legged and humanoid locomotion: blind and perceptive, flat to parkour, sim-to-real throughout."),
      "motion-imitation": ("Motion imitation & characters", "Reward-shaped tracking of reference motion — DeepMimic and its descendants, now the standard humanoid whole-body recipe."),
      "manipulation": ("Dexterous manipulation", "In-hand reorientation, vision-based dexterity, contact-rich and force-aware RL, grasping in clutter."),
      "loco-manip":   ("Whole-body loco-manipulation", "Arms and legs on one policy — force-adaptive carrying, mobile pick-and-place, door opening."),
      "marl":         ("Multi-agent RL", "Cooperative transport, decentralized coordination, opponent modelling, emergent team behaviour."),
      "post-training":("RL post-training on foundation models", "Turning a pretrained VLA or generalist policy into a reliable one with on-robot or offline RL."),
      "model-based":  ("Model-based & world-model RL", "Learning a dynamics model and planning or dreaming inside it."),
      "sim2real":     ("Sim-to-real & real-to-sim", "Domain randomization, adaptation, system identification, real2sim2real loops."),
    },
  },
  "il": {
    "name": "Imitation Learning",
    "blurb": "Policies learned from demonstration — behaviour cloning and its modern descendants: "
             "action-chunking transformers, diffusion and flow policies, vision-language-action models, "
             "world/world-action models, and the growing effort to learn from human video instead of robot data.",
    "branches": {
      "foundations":  ("Foundations of imitation", "BC, DAgger, inverse RL, adversarial imitation, implicit policies."),
      "visuomotor":   ("Visuomotor policy architectures", "ACT/CVAE, diffusion policy, flow matching, 3D policies — the action-decoder zoo."),
      "vla":          ("Vision-Language-Action models", "Generalist instruction-following policies built on VLM backbones."),
      "in-context":   ("In-context & few-shot", "Prompting a policy with demonstrations at test time instead of fine-tuning."),
      "world-models": ("World models & WAM", "Predicting futures — video, latent, or joint world-action — and acting through the prediction."),
      "human-video":  ("Learning from human video", "Egocentric and third-person human demonstrations as a data source for robots."),
      "retargeting":  ("Retargeting & teleoperation", "Mapping human motion onto robot embodiments; the interfaces that collect the data."),
      "data-scaling": ("Data scaling & cross-embodiment", "Large multi-robot datasets and the policies trained across them."),
      "tactile-learn":("Tactile & contact learning", "Policies that use touch, and the representation learning behind them."),
    },
  },
  "systems": {
    "name": "Hardware & Systems",
    "blurb": "The machines and the plumbing — open-source arms and hands, mobile manipulators, "
             "data-collection interfaces, tactile skins, humanoid platforms, co-design, and the "
             "simulators and benchmarks the field runs on.",
    "branches": {
      "bimanual":     ("Open-source arms & bimanual", "Low-cost, reproducible manipulator platforms that made the data flywheel possible."),
      "mobile-manip": ("Mobile manipulation platforms", "Bases + arms: TidyBot lineage, Stretch, whole-body household systems."),
      "interfaces":   ("Data-collection interfaces", "UMI-style handheld grippers, exoskeletons, gloves, VR teleop rigs."),
      "hands":        ("Dexterous hands", "Tendon- and direct-drive anthropomorphic hands, open and commercial."),
      "tactile-hw":   ("Tactile sensing hardware", "Vision-based and magnetic skins, fingertip sensors, full-hand coverage."),
      "humanoid-hw":  ("Humanoid & legged platforms", "The robots themselves — commercial, research, and open-source."),
      "codesign":     ("Co-design & morphology", "Optimizing body and brain together, increasingly with learning in the loop."),
      "sim-bench":    ("Simulators & benchmarks", "MuJoCo, Isaac, Genesis, and the task suites that define progress."),
      "planning-control": ("Planning & control", "MPC, trajectory optimization, sampling-based planning, collision avoidance — the model-based stack RL is often measured against."),
      "perception":   ("Perception & state estimation", "SLAM, odometry, calibration, pose estimation — the layer everything above assumes works."),
      "agentic":      ("Agentic & auto-research systems", "LLM agents that design, code, run and iterate robotics experiments."),
    },
  },
}

# your projects — current work first, everything else archived below
PROJECTS = {
  "mabel": dict(name="MABEL", kind="current", order=1,
    tag="Mobile bimanual humanoid",
    blurb="Wheeled-humanoid platform: bimanual arms on a swerve base, whole-body teleoperation, "
          "learned retargeting, and an open hardware stack.",
    path="~/Desktop/MABEL", color="#23577E"),
  "m2": dict(name="M2", kind="current", order=2,
    tag="Multi-robot collaboration",
    blurb="Two (and more) mobile manipulators cooperating — collaborative transport, distributed MPC, "
          "multi-agent RL, and the planning stack that keeps them from fighting each other.",
    path="~/Desktop/M2", color="#2E7D4F"),
  "r2s2r": dict(name="Real2Sim2Real", kind="current", order=3,
    tag="Egocentric capture → sim → policy",
    blurb="Learn from egocentric video: reconstruct the scene as a simulatable asset, pretrain the policy "
          "by imitation inside it, then fine-tune with RL and deploy back to the real scene. The ego view "
          "is the interface that holds the loop together.",
    path="", color="#C6301A"),
  "wam-tactile": dict(name="Tactile WAM", kind="current", order=4,
    tag="World-action model · touch + UMI glove",
    blurb="A world-action model whose observation stream carries contact, trained on UMI-glove capture — "
          "predict the future and the action that causes it, with touch in the loop rather than inferred "
          "from pixels.",
    path="", color="#D9A13F"),
  "geodex": dict(name="GeoDex", kind="past", order=5,
    tag="Geometry-driven dexterity",
    blurb="Dexterous hand work — geometry-aware grasping and in-hand manipulation, rollout studies, "
          "and the hardware behind them.",
    path="~/Desktop/dexterous_hand", color="#C88A2E"),
  "iris": dict(name="IRIS / MPR", kind="past", order=6,
    tag="Cinema robot arm",
    blurb="6-DOF cinema robot arm with visuomotor imitation learning (ACT/CVAE, diffusion), plus the "
          "next-generation Motion Picture Robotics platform on a swerve base.",
    path="~/Documents/GitHub/MEng_project", color="#7B5EA8"),
  "exo": dict(name="Exoskeleton / Sim-to-real", kind="past", order=7,
    tag="Wearable robotics",
    blurb="End-to-end assistive torque control, mixture-of-experts exoskeleton policies, and "
          "musculoskeletal sim-to-real (ExoGym).",
    path="", color="#B0566A"),
}

# research ideas — deduplicated from your list.
# `pitch` says what it is; `novelty` states the specific claim that is not already
# taken, phrased so it can be argued with. Where a 2026 paper has occupied the
# obvious framing, the novelty is the narrower thing that survives it.
IDEAS = [
 dict(id="multi-robot-marl", title="Multi-robot collaboration & multi-agent RL",
      merged=["Multi robot collaboration and mutual agent rl", "Multi robot collaboration tasks"],
      project="m2", trees=["rl"],
      pitch="Two mobile manipulators carrying one rigid object, where the coupling — not the navigation — "
            "is the problem.",
      novelty="Report the <b>internal wrench</b>, not just task success. Every learned cooperative-transport "
              "result reports whether the object arrived; none reports the squeeze the robots put on it when "
              "their state estimates disagree. Make that the headline metric, and show learned policies "
              "degrade more gracefully than MPC under injected pose drift."),
 dict(id="tactile-wm", title="Tactile world models for robot learning",
      merged=["Tactile robot learning world model"], project="wam-tactile", trees=["il","rl"],
      pitch="A world model whose observation stream carries contact, so the prediction contains slip and "
            "jamming rather than only what a camera can see.",
      novelty="Dream-Tac and the 2026 tactile-WAM cluster took the framing, but all of them evaluate on task "
              "success and all run on grippers. The claim left is <b>slip-prediction lead time on a 20+ DOF "
              "hand</b> — how many milliseconds before failure does the model see it coming, in the regime "
              "where the hand occludes its own contacts."),
 dict(id="ego-dex", title="Egocentric video learning for dexterity",
      merged=["Ego centric video learning for dexterity", "Learn from ego centric view data"],
      project="r2s2r", trees=["il"],
      pitch="First-person human hand video as the pretraining substrate for dexterous policies.",
      novelty="EgoScale already measured the scaling law, so raw scale is settled. What nobody has done is "
              "hold total hours <b>fixed</b> and vary only one axis at a time — scene diversity, annotation "
              "depth, or transfer mechanism (exoskeleton adapter vs pixel inpainting vs shared "
              "representation) — on one hand and one task set. That ablation tells the field what kind of "
              "hours to buy, which is the question a million-hour release actually raised."),
 dict(id="real2sim2real-ego", title="Real-to-sim-to-real from egocentric views with RL",
      merged=["Real to sim to real using ego centric views and rl", "Real to sim to real"],
      project="r2s2r", trees=["rl","systems"],
      pitch="Capture a scene egocentrically, rebuild it as something a simulator can step, train inside it, "
            "and deploy back.",
      novelty="EgoEngine and Video2Sim2Real both build the loop and run it <b>once</b>. Close it: feed the "
              "real-world failures back into the reconstruction and the dynamics model, iterate, and report "
              "geometry error, dynamics gap and task success as functions of iteration count. Second claim: "
              "how many reconstructed scenes before the policy stops needing a new one."),
 dict(id="rl-post-training", title="RL post-training on robot foundation models",
      merged=["Rl post training on foundation models"], project="iris", trees=["rl","il"],
      pitch="Converting a pretrained VLA's broad competence into task reliability with on-robot RL.",
      novelty="The methods have converged; the comparison has not. Nobody has answered the practitioner's "
              "question: <b>given one hour of robot time</b>, does residual RL, interactive post-training, or "
              "human-in-the-loop buy the most reliability — and on which task properties. Budget-matched, "
              "one base policy, reliability plotted against minutes rather than epochs."),
 dict(id="codesign-dex-agentic", title="Co-design of dexterous hands & arms with agentic AI",
      merged=["Codesign for dexterity and robot arms with agentic ai"],
      project="geodex", trees=["systems"],
      pitch="An agent that proposes a morphology, builds it in simulation, trains a policy, reads the result "
            "and revises.",
      novelty="All published co-design optimizes locomotion or simple grippers, because the dexterity "
              "objective is contact behaviour — expensive, badly differentiable, and not summarised by a "
              "scalar. Run the loop on a <b>multi-finger hand with in-hand reorientation as the objective</b>, "
              "let the agent propose only structural changes while gradients handle the continuous "
              "parameters, and build the winner. An unbuilt co-design result is a simulation paper."),
 dict(id="auto-research-dex", title="Agentic auto-research for dexterous manipulation",
      merged=["Dexterous manipulation with agentic auto research - you can try now"],
      project="geodex", trees=["rl","systems"],
      pitch="Point an agent at a dexterous task and let it write the reward, launch the run, read the result "
            "and try again.",
      novelty="HARBOR automated the simulated workflow, so the loop itself is taken. The gap is "
              "<b>diagnosis</b>: existing systems feed the agent scalar reward curves, from which a failed "
              "in-hand rotation is simply not diagnosable. Give it contact and trajectory <b>traces</b> — "
              "the thumb lost purchase at 40% of the rollout — and measure agent-iterations-to-target against "
              "a human researcher on the same task."),
 dict(id="codesign-dog-rl", title="End-to-end co-design of a fast-running quadruped with RL in the loop",
      merged=["Codesign a dog that run fast with rl in the loop - completely end to end"],
      project="", trees=["systems","rl"],
      pitch="Link lengths, gear ratios, actuator choice and control policy optimized together, with top speed "
            "as the single objective.",
      novelty="Co-design papers report simulated performance and stop. Build the winner and report the "
              "<b>design sim-to-real gap</b> — how much of a co-designed morphology's simulated advantage "
              "survives fabrication, decomposed into actuator, structural compliance and contact. That number "
              "does not exist in the literature and everyone doing co-design needs it."),
 dict(id="agentic-physical", title="Agentic physical robot",
      merged=["Agentic physical robot"], project="iris", trees=["il","systems"],
      pitch="The software-agent loop — plan, call skills, observe, replan — running on a physical body.",
      novelty="Dual-system VLAs already reason and act; what none of them do is <b>remember across "
              "attempts</b>. A robot that knows this drawer sticks, this mug is heavier than it looks, and "
              "that the last three grasps failed the same way, and conditions on that. The evaluation is a "
              "curve no current system has a positive slope on: success rate as a function of attempt number "
              "on the same task instance."),
 dict(id="rl-harness", title="Harness tasks in the real world",
      merged=["Harness task in real world - similar to the rl harness paper"],
      project="", trees=["rl","systems"],
      pitch="A standing set of physical tasks with automatic reset, scoring and logging, so real-robot RL can "
            "be run at scale.",
      novelty="HARBOR automated the <b>simulated</b> workflow. The real-world harness is still bespoke per "
              "lab, and SERL is the only shared artefact. Build and release the physical version — printable "
              "fixtures, validated reward detection, and a <b>72-hour unattended failure log</b>, which is a "
              "more useful contribution than the learning curves."),
 dict(id="wam-umi-gloves", title="World-action model from UMI gloves",
      merged=["World action model from UMI gloves", "UMI and world modeling - scale up"],
      project="wam-tactile", trees=["il"],
      pitch="Scale UMI-style handheld capture into the data source for a joint world-action model.",
      novelty="Hours are no longer scarce — Egocentric-1M has a million of them. UMI's remaining edge is a "
              "<b>physically grounded action track recorded at capture time</b> rather than retargeted "
              "afterwards. The experiment: same model, same hours, recorded actions vs Ego2Robot-style "
              "pseudo-actions. If recorded actions win, that is the argument for the whole UMI programme; if "
              "they do not, that is worth knowing before building more grippers."),
 dict(id="hand-22dof", title="Open-source 22-DOF tendon-driven hand",
      merged=["Open source 22 DOF hand - tendon driven like the 1X hand"],
      project="geodex", trees=["systems"],
      pitch="A reproducible high-DOF tendon hand with a published BOM and a working learning stack.",
      novelty="RUKA-v2 and the 21-DOF MM-Hand exist, so DOF count is not a contribution. Three things still "
              "are: <b>durability as a measured quantity</b> (cycles to tendon replacement, drift after N "
              "cycles, time to repair — only ORCA reports anything), <b>full-coverage touch designed in "
              "rather than retrofitted</b>, and a <b>MuJoCo model validated against measured tendon "
              "behaviour under load</b>. Build it as infrastructure; publish it when it has one of those."),
 dict(id="learned-retargeting", title="Learning-based retargeting",
      merged=["Learning basd retargeting - two fingers touching each other; teleop holding a box etc"],
      project="mabel", trees=["il"],
      pitch="Retargeting that optimizes for task-relevant contact rather than joint-angle or keypoint distance.",
      novelty="C2Dex, GMR and Human2Humanoid now bound the obvious framings. What is missing is a "
              "<b>benchmark</b>: retargeting is always evaluated through downstream policy success, which "
              "confounds it with policy quality. Measure it directly — contact-set agreement, force-closure "
              "preservation, fingertip-contact recall against demonstrations with instrumented ground truth. "
              "Then the second claim: retargeting objectives <b>conditioned on the task segment</b>, since a "
              "precision pinch and a power grasp do not want the same cost function."),
 dict(id="mobile-dex-umi", title="Mobile dexterous manipulation with a custom dexterous UMI",
      merged=["Mobile dexterous manipulation using a custom dex UMI"],
      project="mabel", trees=["systems","il"],
      pitch="A dexterous-hand UMI on a mobile base — in-the-wild capture, multi-finger hardware, whole-body reach.",
      novelty="Every dexterous-UMI paper evaluates on a static arm; every mobile-manipulation paper uses a "
              "gripper. Nobody has closed the combination. The claim: <b>in-the-wild multi-finger "
              "demonstrations, collected with no robot present, executed on a mobile base in scenes the robot "
              "has never entered</b> — with Mobile ALOHA's co-training ablation rerun for dexterity, since "
              "the mobile data requirement may turn out to be small."),
 dict(id="wm-residual", title="World modeling with residual physics",
      merged=["World modeling with residual learning - giving physics or robot model or mujoco physics to speed up learning"],
      project="wam-tactile", trees=["il","rl"],
      pitch="Give the world model a simulator as its backbone and learn only the residual.",
      novelty="Residual physics corrects a simulator to help a <b>policy</b> (actuator networks, ASAP's "
              "delta-action, DexNDM). World models learn dynamics from scratch. Nobody has built the hybrid: "
              "roll out MuJoCo, predict the residual, train the agent inside the sum. Two falsifiable claims — "
              "sample complexity at matched final performance, and <b>rollout divergence versus horizon</b>, "
              "where a physics-backed model should stay plausible far longer."),
 dict(id="auto-research-wm", title="Auto-research with world models",
      merged=["Auto research with world modeling"], project="", trees=["il","systems"],
      pitch="An agent that tests hypotheses inside a learned world model and spends real-robot time only on "
            "the survivors.",
      novelty="The two literatures — agents that run experiments, and agents trained inside world models — "
              "do not cite each other. Join them and measure the only thing that matters: <b>robot-hours to "
              "reach the same conclusion, with and without model-based triage</b>. And report the "
              "false-negative rate, because a model that confidently rejects a hypothesis that would have "
              "worked is worse than no filter."),
 dict(id="third-person", title="Learning from third-person view data",
      merged=["Learn from third person view data"], project="r2s2r", trees=["il"],
      pitch="Exocentric human video — the most abundant demonstration data there is — with the viewpoint gap "
            "handled explicitly.",
      novelty="The field assumed egocentric is better because it matches a wrist camera, and stopped asking. "
              "Ego-Exo4D makes it testable: same task, same paired data, same policy class, <b>viewpoint as "
              "the only variable</b>, reported per task category. The expected answer — ego for fine "
              "manipulation, exo for whole-body and scene layout — is currently folklore, not a measurement."),
 dict(id="hri-collab", title="Human-robot interaction & collaboration tasks",
      merged=["Human robot interaction - collaboration tasks"], project="m2", trees=["rl","il"],
      pitch="Physical collaboration with a person: intent inference, compliant co-manipulation, handovers.",
      novelty="Physical-HRI papers report task success and a comfort survey. None report <b>who did the "
              "adapting</b> — and in most deployed systems it is the human, silently. Measure the division: "
              "trajectory deviation from solo behaviour, with a human-human baseline on the same task. Then "
              "show an intent-inference module shifts the burden back onto the robot. That is a novel "
              "measurement, not a novel controller."),
 dict(id="soft-sim2real", title="Soft-object manipulation from simulation",
      merged=["Soft object manipulation from sim - sim to real gap - rendering issue using cameras and physics issue"],
      project="geodex", trees=["rl","systems"],
      pitch="Deformables break sim-to-real twice — the physics is wrong and the rendering is wrong.",
      novelty="Everyone attacks one gap and inherits the other. Run the <b>2×2</b>: real/sim physics crossed "
              "with real/sim rendering, using pixel-editing for the rendering axis and a learned delta model "
              "for the physics axis, on one task with a clean metric. The decomposition tells the field which "
              "gap to spend money on, and nobody has measured it. Add tactile as a fifth condition — for "
              "cloth and rope, touch disambiguates state that vision cannot."),
 dict(id="transformer-robot", title="Transformer robot: car ↔ humanoid, end to end",
      merged=["Transformer robot — car to humanoid using RL, hardware build end to end, balancing and walking "
              "in humanoid form, transformation policy, fall and stand-up, few policies on board"],
      project="", trees=["systems","rl"],
      pitch="Build the robot and the controller together: a machine that drives as a wheeled vehicle, stands "
            "up into a humanoid, walks, falls, recovers — with a handful of policies running on board.",
      novelty="X2-N (April 2026) already built a transformable wheel-legged humanoid with RL whole-body "
              "control, so the mechanism and the mode-switch are taken. Two things are not. First, the "
              "<b>policy budget</b>: how few on-board policies cover driving, walking, transforming, falling "
              "and standing up — and what is lost by merging them, measured, rather than assumed. Second, and "
              "more interesting, <b>transformation as a recovery action</b>: a fallen humanoid that folds "
              "into its wheeled form to right itself, instead of learning a get-up policy for every fallen "
              "posture. That reframes the morphology change from a feature into a controller primitive, and "
              "no getting-up paper has it."),
 dict(id="robot-dj", title="Robot DJ: turntablism with audio as a first-class modality",
      merged=["Robot DJ using a turntable — audio as a modality, force, tactile, dexterous hand"],
      project="geodex", trees=["il","systems"],
      pitch="A dexterous hand on a turntable: scratching, cueing and beat-matching, with contact microphones, "
            "force and touch in the loop.",
      novelty="Audio in robot learning is always an <em>extra observation</em> — ManiWAV, SonicSense, "
              "Audio-VLA all use sound to infer contact state. Turntablism is the first task where audio is "
              "also the <b>objective</b>: the policy's own output is the evaluation signal, so the reward and "
              "the observation live in the same modality and the loop can close without any external labeller. "
              "It also forces three things dexterity benchmarks avoid — regulating normal force against a "
              "<b>moving</b> surface, millisecond-scale timing where being early is as wrong as being late, "
              "and a task whose success a human can judge instantly. A hard, cheap, self-scoring benchmark "
              "for contact-rich dexterity."),
]

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

# your projects
PROJECTS = {
  "mabel": dict(name="MABEL", kind="active",
    tag="Mobile bimanual humanoid",
    blurb="Wheeled-humanoid platform: bimanual arms on a swerve base, whole-body teleoperation, "
          "learned retargeting, and an open hardware stack.",
    path="~/Desktop/MABEL", color="#5b8cff"),
  "m2": dict(name="M2", kind="active",
    tag="Multi-robot collaboration",
    blurb="Two (and more) mobile manipulators cooperating — collaborative transport, distributed MPC, "
          "multi-agent RL, and the planning stack that keeps them from fighting each other.",
    path="~/Desktop/M2", color="#7ad4a0"),
  "geodex": dict(name="GeoDex", kind="active",
    tag="Geometry-driven dexterity",
    blurb="Dexterous hand work — geometry-aware grasping and in-hand manipulation, rollout studies, "
          "and the hardware behind them.",
    path="~/Desktop/dexterous_hand", color="#f0a868"),
  "iris": dict(name="IRIS / MPR", kind="prior",
    tag="Cinema robot arm",
    blurb="6-DOF cinema robot arm with visuomotor imitation learning (ACT/CVAE, diffusion), plus the "
          "next-generation Motion Picture Robotics platform on a swerve base.",
    path="~/Documents/GitHub/MEng_project", color="#c89bf0"),
  "exo": dict(name="Exoskeleton / Sim-to-real", kind="prior",
    tag="Wearable robotics",
    blurb="Prior line of work: end-to-end assistive torque control, mixture-of-experts exoskeleton "
          "policies, and musculoskeletal sim-to-real (ExoGym).",
    path="", color="#e08a9b"),
}

# research ideas — deduplicated from your list
IDEAS = [
 dict(id="multi-robot-marl", title="Multi-robot collaboration & multi-agent RL",
      merged=["Multi robot collaboration and mutual agent rl", "Multi robot collaboration tasks"],
      project="m2", trees=["rl"],
      pitch="Two or more mobile manipulators that plan and act as one system — cooperative transport, "
            "role emergence, decentralized execution under partial observability."),
 dict(id="tactile-wm", title="Tactile world models for robot learning",
      merged=["Tactile robot learning world model"], project="geodex", trees=["il","rl"],
      pitch="A world model whose observation space includes touch, so the prediction carries contact "
            "events and slip — the modality vision fundamentally cannot see."),
 dict(id="ego-dex", title="Egocentric video learning for dexterity",
      merged=["Ego centric video learning for dexterity", "Learn from ego centric view data"],
      project="geodex", trees=["il"],
      pitch="Use first-person human hand video at internet scale as the pretraining substrate for "
            "dexterous policies, closing the hand-embodiment gap rather than sidestepping it."),
 dict(id="real2sim2real-ego", title="Real-to-sim-to-real from egocentric views with RL",
      merged=["Real to sim to real using ego centric views and rl", "Real to sim to real"],
      project="geodex", trees=["rl","systems"],
      pitch="Reconstruct the scene from egocentric capture, rebuild it as a simulatable asset, train "
            "with RL inside it, and deploy back — with the ego view as the shared interface."),
 dict(id="rl-post-training", title="RL post-training on robot foundation models",
      merged=["Rl post training on foundation models"], project="iris", trees=["rl","il"],
      pitch="A pretrained VLA is a strong prior and a mediocre policy. RL post-training is the step "
            "that converts broad competence into task reliability."),
 dict(id="codesign-dex-agentic", title="Co-design of dexterous hands & arms with agentic AI",
      merged=["Codesign for dexterity and robot arms with agentic ai"],
      project="geodex", trees=["systems"],
      pitch="Let an LLM agent drive the morphology search loop — propose a hand, build it in sim, "
            "train a policy, read the result, revise the design."),
 dict(id="auto-research-dex", title="Agentic auto-research for dexterous manipulation",
      merged=["Dexterous manipulation with agentic auto research - you can try now"],
      project="geodex", trees=["rl","systems"],
      pitch="Point an agent at a dexterous task and let it run the research loop itself — write the "
            "reward, launch the training, read the curves, diagnose the failure, try again. The one on "
            "your list that is genuinely runnable this week."),
 dict(id="codesign-dog-rl", title="End-to-end co-design of a fast-running quadruped with RL in the loop",
      merged=["Codesign a dog that run fast with rl in the loop - completely end to end"],
      project="", trees=["systems","rl"],
      pitch="Joint optimization of link lengths, gear ratios, actuator choice and control policy, "
            "with top speed as the single end-to-end objective."),
 dict(id="agentic-physical", title="Agentic physical robot",
      merged=["Agentic physical robot"], project="iris", trees=["il","systems"],
      pitch="An agent loop that plans, calls skills, observes, and replans on real hardware — the "
            "software-agent stack pointed at a physical body."),
 dict(id="rl-harness", title="Harness tasks in the real world",
      merged=["Harness task in real world - similar to the rl harness paper"],
      project="", trees=["rl","systems"],
      pitch="Build the real-world equivalent of an RL harness: a standing set of physical tasks with "
            "automatic reset, scoring and logging, so real-robot RL can actually be run at scale."),
 dict(id="wam-umi-gloves", title="World-action model from UMI gloves",
      merged=["World action model from UMI gloves", "UMI and world modeling - scale up"],
      project="mabel", trees=["il"],
      pitch="Scale UMI-style handheld/glove capture into the data source for a joint world-action "
            "model — predict the future and the action that causes it, from in-the-wild human data."),
 dict(id="hand-22dof", title="Open-source 22-DOF tendon-driven hand",
      merged=["Open source 22 DOF hand - tendon driven like the 1X hand"],
      project="geodex", trees=["systems"],
      pitch="A reproducible, high-DOF tendon hand in the spirit of the 1X Redwood hand — published "
            "BOM, routing, and a working learning stack on top."),
 dict(id="learned-retargeting", title="Learning-based retargeting",
      merged=["Learning basd retargeting - two fingers touching each other; teleop holding a box etc"],
      project="mabel", trees=["il"],
      pitch="Retargeting that optimizes for task-relevant contact (fingertips actually touching, box "
            "actually held) rather than joint-angle or keypoint distance."),
 dict(id="mobile-dex-umi", title="Mobile dexterous manipulation with a custom dexterous UMI",
      merged=["Mobile dexterous manipulation using a custom dex UMI"],
      project="mabel", trees=["systems","il"],
      pitch="A dexterous-hand UMI variant on a mobile base — the low-hanging combination of in-the-wild "
            "capture, multi-finger hardware, and whole-body reach."),
 dict(id="wm-residual", title="World modeling with residual physics",
      merged=["World modeling with residual learning - giving physics or robot model or mujoco physics to speed up learning"],
      project="", trees=["il","rl"],
      pitch="Give the world model a simulator or analytic robot model as its backbone and learn only "
            "the residual — far fewer samples, and physically plausible rollouts by construction."),
 dict(id="auto-research-wm", title="Auto-research with world models",
      merged=["Auto research with world modeling"], project="", trees=["il","systems"],
      pitch="An agent that forms hypotheses, tests them inside a learned world model, and only spends "
            "real-robot time on the survivors."),
 dict(id="third-person", title="Learning from third-person view data",
      merged=["Learn from third person view data"], project="iris", trees=["il"],
      pitch="Exocentric human video — the most abundant demonstration data there is — with the "
            "viewpoint and embodiment gap handled explicitly."),
 dict(id="hri-collab", title="Human-robot interaction & collaboration tasks",
      merged=["Human robot interaction - collaboration tasks"], project="m2", trees=["rl","il"],
      pitch="Physical collaboration with a person in the loop: intent inference, compliant co-manipulation, "
            "and handovers that do not require the human to adapt."),
 dict(id="soft-sim2real", title="Soft-object manipulation from simulation",
      merged=["Soft object manipulation from sim - sim to real gap - rendering issue using cameras and physics issue"],
      project="geodex", trees=["rl","systems"],
      pitch="Deformables are where sim-to-real breaks twice at once — the physics is wrong and the "
            "rendering is wrong. Attack both gaps together."),
]

FIELDS = ["id","title","authors","first_author","corresponding","institutions","lab",
          "venue","venue_type","year","date","tree","branch","topics","paradigm","method",
          "projects","ideas","related","arxiv","doi","url","code","site","abstract","note",
          "local","source","stars"]

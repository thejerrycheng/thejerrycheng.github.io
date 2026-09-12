# -*- coding: utf-8 -*-
"""World models, end to end.

Three things this module is trying to fix:
  1. the foundational lineage was missing its middle — PlaNet, Dreamer 1/2,
     TD-MPC, IRIS, DIAMOND, STORM, DINO-WM — so the atlas jumped from
     Ha & Schmidhuber straight to DreamerV3 with nothing in between;
  2. NVIDIA's 2026 world-action-model push (DreamDojo, DreamZero, Cosmos
     Policy, RoboDream) was absent;
  3. Yunzhu Li's RoboPIL line and Fei-Fei Li's Stanford line — the two groups
     that actually build *structured*, physics-grounded world models rather
     than video generators — were barely represented.
"""
import json, os
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=json.load(open(os.path.join(HERE,"wm_papers.json")))
VEN=json.load(open(os.path.join(HERE,"wm_venues.json"))) if os.path.exists(
    os.path.join(HERE,"wm_venues.json")) else {}
ROWS=[]

# (paper-id, tree, branch, topics, paradigm, ideas, projects, stars, note, related)
ANN={

# ══════════════════════════════════════════════════════════════════════════
#  I. THE FOUNDATIONAL LINEAGE — latent imagination, 2018 → 2025
# ══════════════════════════════════════════════════════════════════════════
"1811.04551":("planet","rl","model-based","recurrent state-space model, latent planning, pixels","model-based RL",
  "wm-residual,auto-research-wm","m2",3,
  "<b>PlaNet</b> — the paper that made latent-space planning from pixels actually work, and the direct "
  "ancestor of every Dreamer. Its contribution is the <b>RSSM</b>: a recurrent state-space model with a "
  "deterministic path <em>and</em> a stochastic path, because a purely stochastic latent forgets and a purely "
  "deterministic one cannot represent uncertainty. Planning is CEM in latent space, so no policy is learned at "
  "all — Dreamer's insight one year later was that you should learn one. Read it for the RSSM ablation in "
  "§4: it is the cleanest evidence anywhere for why the two-path latent is not an arbitrary choice.",
  "dreamer-v1,dreamer-v2,dreamerv3,worldmodels,td-mpc"),

"1912.01603":("dreamer-v1","rl","model-based","latent imagination, analytic value gradients, actor-critic in a world model","model-based RL",
  "wm-residual,auto-research-wm","m2",3,
  "<b>Dreamer (v1)</b> — 'Dream to Control'. The step past PlaNet: instead of re-planning with CEM every "
  "step, learn an actor and a critic <em>entirely inside</em> the imagined rollouts, and backpropagate "
  "analytic value gradients through the learned dynamics. That is the move that makes world models "
  "competitive rather than merely elegant — gradients through a differentiable model carry far more "
  "information per sample than a score-function estimate. Hafner, Lillicrap, Ba, Norouzi; note <b>Jimmy Ba "
  "is UofT</b>, so this line runs through your own department.",
  "planet,dreamer-v2,dreamerv3,daydreamer,pwm"),

"2010.02193":("dreamer-v2","rl","model-based","categorical latents, straight-through gradients, Atari","model-based RL",
  "wm-residual,auto-research-wm","",3,
  "<b>DreamerV2</b> — the first world-model agent to beat top single-GPU model-free agents on Atari, and the "
  "paper that replaced Gaussian latents with <b>categorical</b> ones trained by straight-through gradients. "
  "The ablation is the reason to read it: categorical latents win not because discreteness is fashionable "
  "but because a multi-modal posterior stops the model from averaging two possible futures into one "
  "blurry impossible one. Every subsequent discrete-token world model inherits this argument.",
  "dreamer-v1,dreamerv3,iris,storm,planet"),

"2203.04955":("td-mpc","rl","model-based","task-oriented latent dynamics, no reconstruction, MPC with a learned value","model-based RL",
  "wm-residual,rl-post-training","m2,geodex",3,
  "<b>TD-MPC</b> — the counter-argument to reconstruction. Do not model the pixels; model only what the "
  "<em>reward and value</em> depend on, and plan short-horizon MPC with a learned terminal value to cover "
  "the rest. It is the cheapest good world model in the literature, and for a contact-rich task where the "
  "visual scene is mostly irrelevant clutter, it is very often the right one. The direct ancestor of TD-MPC2.",
  "tdmpc2,dreamer-v2,dino-wm,planet,pwm"),

"2209.00588":("iris","rl","model-based","discrete autoencoder, transformer world model, sample efficiency","model-based RL",
  "wm-residual","",2,
  "<b>IRIS</b> — 'Transformers are Sample-Efficient World Models'. Tokenize frames with a discrete "
  "autoencoder, then let an autoregressive transformer be the dynamics model, so imagination becomes "
  "next-token prediction. This is the architectural bridge between the Dreamer line and everything that "
  "later got called a video world model: once the world model is a sequence model over tokens, all the "
  "scaling machinery from language transfers.",
  "storm,dreamer-v2,ivideogpt,genie-envisioner,diamond"),

"2405.12399":("diamond","rl","model-based","diffusion world model, pixel-space imagination, visual detail","model-based RL",
  "wm-residual,tactile-wm","wam-tactile",2,
  "<b>DIAMOND</b> — 'Visual Details Matter'. Runs the world model as a <em>diffusion</em> process in pixel "
  "space rather than a latent autoencoder, and then shows, concretely, which Atari failures were caused by "
  "the autoencoder throwing away small but decision-relevant detail. Directly relevant to your tactile WAM: "
  "a tactile signal <em>is</em> a small decision-relevant detail, and a latent trained on a reconstruction "
  "loss will happily discard it.",
  "iris,storm,dream-tac,tacforesight,omnivta"),

"2310.09615":("storm","rl","model-based","stochastic transformer world model, efficient imagination","model-based RL",
  "wm-residual","",2,
  "<b>STORM</b> — a stochastic transformer world model that gets DreamerV3-level Atari performance at a "
  "fraction of the training cost. Worth reading beside IRIS as the efficiency-tuned version of the same "
  "idea; together they are the argument that the transformer, not the recurrence, is now the default "
  "dynamics backbone.",
  "iris,dreamerv3,diamond"),

"2411.04983":("dino-wm","rl","model-based","frozen DINOv2 features, zero-shot planning, no reward model","model-based RL",
  "wm-residual,real2sim2real-ego","r2s2r,m2",3,
  "<b>DINO-WM</b> — do not learn a representation at all. Freeze DINOv2 patch features, learn dynamics "
  "<em>on top of them</em>, and plan to a goal specified as a target feature map. No reconstruction, no "
  "reward, no task-specific training, and it still plans zero-shot. This is the single most practical "
  "foundational world model in this list for someone who wants a working baseline this month: the "
  "representation is already trained, and you only pay for the dynamics head.",
  "td-mpc,pointworld,vjepa2,vla-jepa,dreamerv3"),

# ══════════════════════════════════════════════════════════════════════════
#  II. NVIDIA's 2026 world-action-model push
# ══════════════════════════════════════════════════════════════════════════
"2602.06949":("dreamdojo","il","world-models","44k hours egocentric human video, latent actions, real-time distillation, policy evaluation","world model",
  "wam-umi-gloves,ego-dex,tactile-wm,auto-research-wm","wam-tactile,mabel,r2s2r",3,
  "<b>DreamDojo</b> (NVIDIA, ICML 2026) — the one you asked for, and the most important single entry in "
  "this batch. A generalist robot world model pretrained on <b>44,000 hours of egocentric human video</b>, "
  "the largest video corpus used for world-model pretraining to date. Two things make it matter to you. "
  "First, the action-label problem is solved the way you would want it solved: <b>continuous latent actions "
  "as a unified proxy</b>, so unlabelled human video contributes interaction knowledge, and a small amount "
  "of target-robot data post-trains it into something controllable. Second, they distil it to "
  "<b>10.81 FPS real time</b>, which is what converts a world model from an offline curiosity into "
  "something you can teleoperate through, evaluate policies in, and plan with. That triple — live "
  "teleoperation, policy evaluation, model-based planning — is very close to the stated scope of your "
  "Tactile WAM project, so read this before you freeze that design.",
  "dreamzero,cosmos-policy,dreamgen,being-h07,lapa,motionwam,tactile-wam"),

"2602.15922":("dreamzero","il","world-models","14B autoregressive diffusion transformer, joint video+action prediction, zero-shot policy","world model, VLA",
  "wam-umi-gloves,rl-post-training,ego-dex","wam-tactile,m2",3,
  "<b>DreamZero</b> (NVIDIA) — 'World Action Models are Zero-shot Policies'. A 14B autoregressive diffusion "
  "transformer trained with chunk-wise teacher-forced video denoising, jointly decoding <em>future frames "
  "and actions</em> from visual context, language and proprioception. The headline claim is the one worth "
  "arguing with: <b>&gt;2× better generalization to unseen tasks and environments than GR00T N1.6 and "
  "π0.5</b> on real robots, plus few-shot embodiment transfer from 30 minutes of play data. The engineering "
  "result is just as useful — <b>38× speedup, 5.7 s → 150 ms</b> — because a WAM that cannot close a "
  "control loop is not a policy. If your Tactile WAM is going to claim anything, it has to claim it "
  "against this.",
  "dreamdojo,cosmos-policy,pi05,groot-n1,lawam,dream-tac,oa-wam"),

"2601.16163":("cosmos-policy","il","world-models","fine-tuning a video foundation model for control, visuomotor policy and planning","world model, VLA",
  "wam-umi-gloves,rl-post-training","wam-tactile,m2",3,
  "<b>Cosmos Policy</b> (NVIDIA) — the cleanest statement of the reuse argument: take a pretrained video "
  "world foundation model and fine-tune it into a visuomotor policy, so the same weights serve control "
  "<em>and</em> planning. The practical reason to care is that it tells you what the minimum viable "
  "adaptation is — you almost certainly do not need to pretrain a world model to build one.",
  "cosmos,dreamzero,dreamdojo,dreamgen,genie-envisioner"),

"2606.02577":("robodream","il","world-models","compositional world models, scalable data synthesis, scene and skill recombination","world model",
  "auto-research-wm,real2sim2real-ego,agentic-physical","r2s2r",2,
  "<b>RoboDream</b> — compositional world models used as a <em>data engine</em>: rather than generating one "
  "long rollout, compose scenes and skills so the synthetic distribution covers combinations no "
  "demonstration contained. This is the mechanism your agentic scene-construction idea needs, stated in "
  "world-model terms rather than simulator terms.",
  "dreamgen,gigaworld-0,acdc,simfoundry,prism"),

"2602.09765":("navdreamer","rl","model-based","video model as a 3D navigator, zero-shot navigation, no map","world model",
  "agentic-physical,wm-residual","mabel",2,
  "<b>NavDreamer</b> — video models as zero-shot 3D navigators. The mobile-base counterpart to the "
  "manipulation WAMs, and relevant to MABEL for exactly that reason: if the wheeled base can be driven by "
  "imagining forward, the navigation stack stops being a separate subsystem with its own map.",
  "navigation-world-models,dino-wm,gaia-2,vista-wm"),

# ══════════════════════════════════════════════════════════════════════════
#  III. Yunzhu Li / RoboPIL — structured, physics-grounded world models
# ══════════════════════════════════════════════════════════════════════════
"2205.02909":("robocraft","il","world-models","graph neural dynamics, elasto-plastic objects, particle representation","model-based RL",
  "soft-sim2real,wm-residual","",3,
  "<b>RoboCraft</b> — the start of Yunzhu Li's structured-world-model line. Represent dough as "
  "<b>particles</b>, learn a GNN dynamics model over them from real interaction, and plan to shape it. "
  "The argument that runs through this whole group's work begins here: a world model with the right "
  "<em>structure</em> (particles, graphs, springs) needs orders of magnitude less data than a video model "
  "and extrapolates instead of interpolating.",
  "robocook,adaptigraph,particle-grid-dynamics,phystwin,d3fields"),

"2306.14447":("robocook","il","world-models","long-horizon deformable manipulation, tool selection, GNN dynamics","model-based RL",
  "soft-sim2real,wm-residual","",2,
  "<b>RoboCook</b> — RoboCraft extended to long horizons and a <em>toolbox</em>: the system picks which "
  "tool to use as well as how to use it, dumpling-making end to end. The interesting part for you is the "
  "hierarchy — a learned dynamics model at the bottom, discrete tool selection on top — which is the same "
  "shape as choosing a grasp before refining it.",
  "robocraft,adaptigraph,bab-nd,robo-exp"),

"2309.16118":("d3fields","systems","perception","dynamic 3D descriptor fields, zero-shot generalization, category-level correspondence","representation",
  "real2sim2real-ego,third-person","r2s2r,geodex",3,
  "<b>D³Fields</b> — fuse multi-view RGBD into a 3D field carrying both geometry and <em>semantic "
  "descriptors</em> from a foundation model, so a task can be specified once with a 2D goal image and then "
  "executed zero-shot on new instances of the category. This is the representation layer that makes the "
  "rest of the RoboPIL stack category-general, and it is directly usable in your real2sim2real pipeline as "
  "the thing that tells you which reconstructed object is which.",
  "robo-exp,adaptigraph,gs-dynamics,voxposer,rekep"),

"2407.07889":("adaptigraph","il","world-models","material-adaptive dynamics, online physical property inference, GNN","model-based RL",
  "soft-sim2real,wm-residual,real2sim2real-ego","r2s2r",3,
  "<b>AdaptiGraph</b> (RSS 2024) — the piece the pure-video world models do not have: a dynamics model with "
  "an explicit <b>material latent</b> that is inferred online from a short interaction, so one model covers "
  "ropes, cloth and granular piles and <em>adapts</em> when the physical properties are unknown. If you are "
  "serious about 'close the loop' in real2sim2real, this is the closest published answer to what closing it "
  "means: the sim's parameters are estimated from the robot's own poking, continuously, not fitted once.",
  "robocraft,particle-grid-dynamics,phystwin,physworld,gs-dynamics"),

"2410.18912":("gs-dynamics","il","world-models","dynamic 3D Gaussian tracking, graph dynamics from monocular video, rendering-in-the-loop","model-based RL",
  "soft-sim2real,real2sim2real-ego","r2s2r",2,
  "<b>GS-Dynamics</b> — learn graph-based neural dynamics by tracking dynamic 3D Gaussians, so the dynamics "
  "model is supervised through a <em>renderer</em> from ordinary RGB video rather than from particle ground "
  "truth nobody has. The bridge between 'structured dynamics models are better' and 'but we can only "
  "collect video'.",
  "adaptigraph,phystwin,particle-grid-dynamics,d3fields"),

"2503.17973":("phystwin","systems","sim-bench","physics-informed reconstruction, spring-mass + Gaussian splats, inverse modelling","simulator",
  "soft-sim2real,real2sim2real-ego,tactile-wm","r2s2r,wam-tactile",3,
  "<b>PhysTwin</b> (ICCV 2025) — from sparse video of a deformable object being manipulated to a "
  "<b>real-time interactive replica</b> that is both photo-realistic and physically realistic. The recipe "
  "is worth copying wholesale: spring-mass for physics, generative shape model for the unseen geometry, "
  "Gaussian splats for appearance, and a multi-stage inverse-modelling optimization that recovers dense "
  "physical properties from the video. This is the strongest existing answer to 'what does a digital twin "
  "mean for a non-rigid object', and the natural comparison point for the reconstruction leg of "
  "Real2Sim2Real.",
  "physworld,physgen3d,adaptigraph,acdc,particle-grid-dynamics,egophys"),

"2506.15680":("particle-grid-dynamics","il","world-models","particle-grid hybrid, RGB-D supervision, learned digital twin","model-based RL",
  "soft-sim2real,wm-residual,real2sim2real-ego","r2s2r",2,
  "<b>Particle-Grid Neural Dynamics</b> — particles carry the object, a spatial grid discretizes the space "
  "between them, and Gaussian splats render the result, all learned from RGB-D video. The hybrid exists "
  "because pure particle methods scale badly in neighbourhood queries and pure grid methods blur "
  "boundaries; this is the standard numerical trade-off borrowed into a learned model.",
  "adaptigraph,gs-dynamics,phystwin,robocraft"),

"2510.21447":("physworld","systems","sim-bench","physics-aware demonstration synthesis, real video to world model, deformables","simulator, IL",
  "soft-sim2real,real2sim2real-ego,third-person","r2s2r",3,
  "<b>PhysWorld</b> (Huawei, Wangmeng Zuo's group — a parallel line to RoboPIL's, arriving at the same "
  "place) — real videos in, a world model of the deformable object out, and then "
  "<b>physics-aware demonstration synthesis</b> on top of it. Note what this is: the full real2sim2real "
  "loop for soft objects, where the sim is not authored but reconstructed, and its payoff is measured in "
  "synthesized demonstrations rather than in reconstruction error. That is the framing your project should "
  "adopt — reconstruction quality is a means, demonstration yield is the metric.",
  "phystwin,egophys,adaptigraph,acdc,prism,rigvid"),

"2606.16202":("egophys","il","world-models","egocentric video, generalizable physics models, deformable objects","world model",
  "ego-dex,soft-sim2real,real2sim2real-ego,wam-umi-gloves","r2s2r,wam-tactile",3,
  "<b>EgoPhys</b> (Xiaolong Wang's lab, UCSD — not RoboPIL, despite the subject matter) — learning "
  "generalizable physics models of deformable objects <em>from egocentric video</em>. This is the most "
  "direct collision with your own Real2Sim2Real-from-egocentric-video project of anything in the library, "
  "and you should read it early: it is either a strong baseline or a partial scoop, and which one it is "
  "determines whether your novelty claim needs to move toward the tactile/UMI-glove axis.",
  "physworld,phystwin,adaptigraph,egoengine,r2s-ego,dreamdojo"),

"2412.09584":("bab-nd","systems","planning-control","branch-and-bound, long-horizon planning with neural dynamics, global optimality","model-based RL",
  "wm-residual,soft-sim2real","m2",2,
  "<b>BaB-ND</b> — the honest observation that planning inside a learned dynamics model is a "
  "<em>non-convex</em> problem and that sampling-based planners quietly settle for local optima. Uses "
  "branch-and-bound with neural-network verification bounds to get global structure on contact-rich tasks "
  "— planar pushing with obstacles, sorting, rope routing. Read it if your MPC ever looks like it is "
  "failing for reasons the model cannot explain.",
  "robocook,adaptigraph,td-mpc,particle-grid-dynamics"),

"2503.20746":("physgen3d","systems","sim-bench","single image to interactive 3D scene, amodal completion, physics","simulator",
  "real2sim2real-ego,agentic-physical","r2s2r",2,
  "<b>PhysGen3D</b> (CVPR 2025) — one image to an amodal, camera-centric, physically interactive 3D scene. "
  "The extreme end of the reconstruction-cost spectrum; useful as the cheap baseline you must beat before "
  "justifying multi-view egocentric capture.",
  "phystwin,robosnap,acdc,physworld"),

"2507.00990":("rigvid","il","human-video","imitating AI-generated video, no physical demonstrations, monocular 4D extraction","IL",
  "third-person,ego-dex,real2sim2real-ego","r2s2r,geodex",3,
  "<b>RIGVid</b> (ICLR 2026) — Robots Imitating Generated Videos. Generate a video of the task with a video "
  "diffusion model, extract 4D object motion from it, retarget that to the robot, and execute — pouring, "
  "wiping, mixing, with <b>zero physical demonstrations and no robot-specific training</b>. The reason this "
  "belongs in your library is that it inverts the usual data argument: the world model is not a simulator "
  "you plan in, it is a <em>demonstration generator</em>, and the only thing you need from it is that the "
  "object trajectory be physically plausible.",
  "physworld,dreamgen,unipi,phantom,prism,robodream"),

"2402.15487":("robo-exp","systems","perception","action-conditioned scene graph, interactive exploration, verify by acting","representation",
  "agentic-physical,auto-research-wm","r2s2r,mabel",2,
  "<b>RoboEXP</b> (CoRL 2024) — build the scene graph by <em>interacting</em>: open the drawer to discover "
  "what is in it, rather than inferring it from a single view. The action-conditioned scene graph is the "
  "right data structure for an agentic system that has to construct its own understanding of a scene, and "
  "it is the piece your agentic-physical idea is currently missing.",
  "d3fields,voxposer,rekep,acdc"),

"2607.05390":("deform360","il","tactile-learn","multi-view visuotactile dataset, deformable world models, 360-degree capture","dataset",
  "tactile-wm,soft-sim2real,wam-umi-gloves","wam-tactile",2,
  "<b>Deform360</b> — a massive multi-view <em>visuotactile</em> dataset built specifically for deformable "
  "world models. The dataset that the tactile-WAM literature has been missing: visual world models of "
  "soft objects have had data for a while, visuotactile ones have not.",
  "phystwin,egophys,dream-tac,tactile-wam,omnivta"),

#  ── adjacent lines arriving at the same place from elsewhere ──
#     PhysWorld (Huawei) and EgoPhys (UCSD / Xiaolong Wang) are above: same problem,
#     different groups. Lab attribution below is derived from the author list, so
#     neither is filed under RoboPIL.

# ══════════════════════════════════════════════════════════════════════════
#  IV. Fei-Fei Li / Stanford — language-grounded 3D representations
# ══════════════════════════════════════════════════════════════════════════
"2307.05973":("voxposer","systems","planning-control","LLM-composed 3D value maps, zero-shot manipulation, no task training","LLM planning",
  "agentic-physical,auto-research-dex","r2s2r,mabel",3,
  "<b>VoxPoser</b> (CoRL 2023) — an LLM writes code that composes <b>3D value maps</b> (affordance and "
  "constraint voxel grids) which a motion planner then optimizes through, giving zero-shot manipulation "
  "with no task-specific training data at all. The lasting idea is the interface: the language model is not "
  "asked to output actions, it is asked to output an <em>objective</em>, and a classical optimizer supplies "
  "the competence. That division of labour is what makes agentic robot systems work.",
  "rekep,robo-exp,d3fields,acdc,behavior-robot-suite"),

"2409.01652":("rekep","systems","planning-control","relational keypoint constraints, constraints as Python functions, hierarchical optimization","LLM planning",
  "agentic-physical,auto-research-dex,hri-collab","mabel,geodex",3,
  "<b>ReKep</b> — VoxPoser's successor and a better formulation: express the task as <b>relational keypoint "
  "constraints</b>, Python functions mapping 3D keypoints to a cost, produced by a VLM and then solved "
  "hierarchically into robot actions. Constraints compose where value maps merely add, and they give you "
  "something a world model does not: a <em>checkable</em> statement of what the task requires, which is "
  "exactly what you need if an agent is going to propose tasks autonomously.",
  "voxposer,robo-exp,d3fields,behavior-robot-suite"),

# ══════════════════════════════════════════════════════════════════════════
#  V. Latent actions — how unlabelled human video becomes a policy
# ══════════════════════════════════════════════════════════════════════════
"2410.11758":("lapa","il","human-video","latent action quantization, VQ-VAE over frame transitions, action-free pretraining","IL, VLA",
  "ego-dex,wam-umi-gloves,third-person","mabel,r2s2r",3,
  "<b>LAPA</b> — Latent Action Pretraining from Videos. Learn a discrete latent action space from frame "
  "<em>transitions</em> with a VQ-VAE-style objective, pretrain a VLA to predict those latent actions on "
  "action-free human video, then map latents to real actions with a small labelled set. This is the "
  "canonical answer to 'how do I use 44,000 hours of video that has no action labels', and the mechanism "
  "DreamDojo later scales up with continuous rather than discrete latents.",
  "dreamdojo,lawm,adaworld,lawam,ego2robot"),

"2509.18428":("lawm","il","world-models","latent action pretraining through world modeling, self-supervised, unlabelled data","world model, IL",
  "ego-dex,wam-umi-gloves","mabel,wam-tactile",2,
  "<b>LAWM</b> — latent-action pretraining where the supervisory signal <em>is</em> the world model: learn "
  "to predict the future, and the latent that best explains the transition becomes the action. The cleaner "
  "formulation of LAPA's idea, and the one to cite if you want to argue that world modelling and action "
  "representation are the same problem.",
  "lapa,lawam,adaworld,dreamdojo,lawm-3d"),

"2606.15768":("lawam","il","world-models","latent visual subgoals instead of reconstructed video, efficient dynamics-aware policy","world model, IL",
  "wam-umi-gloves,tactile-wm,rl-post-training","wam-tactile",3,
  "<b>LaWAM</b> — the efficiency argument against video WAMs, and a good one: expose predictive dynamics to "
  "the policy as <b>compact latent visual subgoals</b> rather than decoding future frames at all. "
  "Generating pixels you immediately throw away is the single largest waste in the WAM stack, and this is "
  "the paper that says so. For a tactile WAM that must run at contact rates, this architecture is more "
  "plausible than a video diffusion backbone.",
  "dreamzero,lawm,vla-jepa,flare,vjepa2,dream-tac"),

"2608.05706":("lawm-3d","il","world-models","3D-aware latent actions, multi-view + single-view joint training, human video","world model, IL",
  "ego-dex,wam-umi-gloves,third-person","mabel,r2s2r",2,
  "<b>LAWM-3D</b> — latent actions that are <em>3D-aware</em>, trained jointly on multi-view and "
  "single-view data so that a latent learned from a monocular human video still means something metric. "
  "The obvious failure mode of LAPA-style latents is that they encode 2D optical flow; this addresses it "
  "directly, and matters for any pipeline where the human video and the robot see different viewpoints.",
  "lapa,lawm,lawam,ego2robot,hrdt"),

"2503.18938":("adaworld","il","world-models","adaptable world models, latent actions, fast adaptation to new environments","world model",
  "wm-residual,auto-research-wm","m2",2,
  "<b>AdaWorld</b> — condition the world model on latent actions extracted from video so that adapting to a "
  "new environment is a small fine-tune rather than a retrain. The adaptation axis of the latent-action "
  "idea, as opposed to LAPA's pretraining axis.",
  "lapa,lawm,dreamdojo,genie"),

"2602.10098":("vla-jepa","il","world-models","JEPA-style latent world model inside a VLA, predictive representation","world model, VLA",
  "wam-umi-gloves,rl-post-training","wam-tactile,m2",2,
  "<b>VLA-JEPA</b> — bolt a joint-embedding predictive world model onto a VLA so the policy is trained "
  "against latent future prediction rather than pixel reconstruction. Read it beside FLARE and LaWAM: "
  "three independent 2026 papers converging on 'predict in latent space, never decode', which is now "
  "close to settled practice.",
  "lawam,flare,vjepa2,dino-wm,dreamzero"),

# ══════════════════════════════════════════════════════════════════════════
#  VI. Video world models at scale
# ══════════════════════════════════════════════════════════════════════════
"2405.15223":("ivideogpt","il","world-models","interactive video GPT, scalable world model, compressive tokenization","world model",
  "wm-residual,auto-research-wm","",2,
  "<b>iVideoGPT</b> — makes a video GPT <em>interactive</em> (action-conditioned, observation-fed) with a "
  "compressive tokenizer, which is what separates a world model from a video generator. The scalability "
  "argument that Genie and the WAM line both build on.",
  "iris,genie,genie-envisioner,adaworld,dreamdojo"),

"2508.05635":("genie-envisioner","il","world-models","unified world foundation platform, policy learning + simulation + evaluation in one model","world model",
  "wam-umi-gloves,auto-research-wm","wam-tactile,m2",3,
  "<b>Genie Envisioner</b> — one video world model serving <em>three</em> jobs: generating policy actions, "
  "acting as a neural simulator, and evaluating policies. Worth reading as the platform-level statement of "
  "what a WAM is for, which is the framing your Tactile WAM project will need in its introduction.",
  "genie,dreamdojo,roboworld,worldeval,cosmos-policy,geniworld"),

"2511.19861":("gigaworld-0","il","world-models","world models as a data engine, large-scale synthetic embodied data","world model",
  "auto-research-wm,real2sim2real-ego","r2s2r",2,
  "<b>GigaWorld-0</b> — world models explicitly as a <em>data engine</em> for embodied AI, at scale. The "
  "industrial-scale version of the DreamGen argument; cite it for the claim that synthetic rollouts are now "
  "a primary rather than supplementary data source.",
  "dreamgen,robodream,cosmos,prism"),

"2601.03782":("pointworld","il","world-models","3D point-based world model, in-the-wild manipulation, scaling","world model",
  "wm-residual,real2sim2real-ego,third-person","r2s2r,m2",2,
  "<b>PointWorld</b> — scaling <b>3D</b> world models rather than 2D video ones for in-the-wild "
  "manipulation. The structural counter-current to the video-diffusion WAMs, and closer in spirit to the "
  "RoboPIL line: predict in a geometric representation, because that is where manipulation actually "
  "happens.",
  "dino-wm,particle-grid-dynamics,lawm-3d,d3fields"),

"2608.06332":("geniworld","il","world-models","generalizable interactive world model, visual actions, unseen scenarios","world model",
  "wam-umi-gloves,auto-research-wm","wam-tactile",2,
  "<b>GeniWorld</b> — an interactive world model conditioned on <em>visual actions</em>, aimed squarely at "
  "generalization to unseen scenes. The most recent entry in the interactive-WAM line at the time of "
  "writing; useful mainly as a generalization benchmark to position against.",
  "genie-envisioner,dreamdojo,dreamzero,ivideogpt"),

"2606.05979":("wla-model","il","world-models","unified world modeling + language reasoning + action synthesis","world model, VLA",
  "wam-umi-gloves,agentic-physical","wam-tactile,mabel",2,
  "<b>World-Language-Action model</b> — the three-way unification: predict the world, reason in language, "
  "emit actions, in one model. Read it for the ablation on whether the language-reasoning branch actually "
  "helps the action branch, which is the question every unified model should be asked and few are.",
  "dreamzero,cosmos-policy,himem-wam,aim-wam"),

"2606.10363":("himem-wam","il","world-models","hierarchical memory gating, long-horizon consistency","world model",
  "wam-umi-gloves,tactile-wm","wam-tactile",2,
  "<b>HiMem-WAM</b> — hierarchical memory gating for world-action models, targeting the failure that limits "
  "every autoregressive WAM in practice: context drift over a long rollout. Relevant if your tactile WAM "
  "has to stay coherent across a multi-minute contact-rich task.",
  "wla-model,dreamdojo,ev-wm,storm"),

"2604.11135":("aim-wam","il","world-models","intent-aware world action modeling, spatial value maps","world model",
  "wam-umi-gloves,hri-collab","wam-tactile,mabel",2,
  "<b>AIM</b> — intent-aware world-action modelling with <b>spatial value maps</b>, which is a neat fusion "
  "of the VoxPoser representation with the WAM formulation. Interesting for the HRI idea: a world model "
  "that predicts what the <em>human</em> intends, not only what the scene will do.",
  "voxposer,wla-model,interact,dreamzero"),

"2606.13053":("ev-wm","il","world-models","event-verified world models, long-horizon manipulation, verification signal","world model",
  "wm-residual,auto-research-wm","wam-tactile,m2",2,
  "<b>EV-WM</b> — verify the world model's rollout against discrete <em>events</em> (contact made, object "
  "lifted) rather than trusting pixel-level prediction over a long horizon. A cheap, sound idea, and a "
  "natural fit with tactile sensing, where contact events are exactly what you can measure reliably.",
  "himem-wam,dream-tac,tacforesight,worldeval"),

# ══════════════════════════════════════════════════════════════════════════
#  VII. World models as neural simulators and policy evaluators
# ══════════════════════════════════════════════════════════════════════════
"2505.19017":("worldeval","systems","sim-bench","world model as policy evaluator, real-world policy ranking without a robot","world model, benchmark",
  "auto-research-wm,rl-harness","wam-tactile,m2",3,
  "<b>WorldEval</b> — use the world model to <em>evaluate</em> real-world robot policies, so ranking "
  "candidate policies no longer costs robot hours. This is the application of world models most likely to "
  "pay off for you soonest: you have more policy variants than you have time on hardware, and this is the "
  "literature on whether the ranking transfers.",
  "roboworld,interactive-world-sim,worldarena2,genie-envisioner,robogaze"),

"2607.01060":("roboworld","systems","sim-bench","neural simulator trained on DROID, RoboArena replication, 100 H100-hours","world model, benchmark",
  "auto-research-wm,rl-harness","m2,r2s2r",3,
  "<b>RoboWorld</b> — a video world model trained on DROID, used as a fast neural simulator for generalist "
  "policy evaluation; replicating the RoboArena benchmark inside it costs <b>100 H100 hours</b> instead of "
  "months of real evaluation. The number is the point: it makes the cost argument for neural simulation "
  "concrete and checkable.",
  "worldeval,interactive-world-sim,worldarena2,droid,genie-envisioner"),

"2603.08546":("interactive-world-sim","systems","sim-bench","consistency models for latent dynamics, 15 FPS on one 4090, 10-minute rollouts","world model, simulator",
  "auto-research-wm,wm-residual,rl-harness","wam-tactile,m2",3,
  "<b>Interactive World Simulator</b> — builds an interactive world model from a <em>moderate-sized</em> "
  "robot interaction dataset using consistency models for both image decoding and latent dynamics, and "
  "reports stable interaction for <b>over 10 minutes at 15 FPS on a single RTX 4090</b>. That combination — "
  "modest data, one consumer GPU, long stable rollouts — makes this the most directly reproducible entry "
  "in this section for a lab-scale project.",
  "roboworld,worldeval,dreamdojo,lawam"),

"2605.17912":("worldarena2","systems","sim-bench","embodied world model benchmark, modality/functionality/platform axes","benchmark",
  "auto-research-wm,rl-harness","wam-tactile",2,
  "<b>WorldArena 2.0</b> — the benchmark that says what a world model is supposed to be good at, broken "
  "down by modality, functionality and platform. Use it to pick your evaluation axes rather than inventing "
  "them, especially since the tactile modality is where the axis list is thinnest.",
  "worldeval,roboworld,robogaze,wm-survey-robot"),

"2606.28385":("robogaze","systems","sim-bench","evaluating world models via structured vision-language analysis","benchmark",
  "auto-research-wm","wam-tactile",2,
  "<b>RoboGaze</b> — evaluate a robot world model by having a VLM interrogate its rollouts in a structured "
  "way, instead of scoring pixels with FVD. The right instinct: a world model should be judged on whether "
  "the <em>events</em> it predicts are right, not on whether the texture is.",
  "worldeval,worldarena2,ev-wm,roboworld"),

# ══════════════════════════════════════════════════════════════════════════
#  VIII. Driving and navigation — where world models scaled first
# ══════════════════════════════════════════════════════════════════════════
"2412.03572":("navigation-world-models","rl","model-based","conditional diffusion transformer, navigation as trajectory imagination, unfamiliar environments","world model",
  "wm-residual,agentic-physical","mabel",2,
  "<b>Navigation World Models</b> (Bar, LeCun et al.) — plan navigation by imagining future observations "
  "under candidate trajectories, with a conditional diffusion transformer, including in environments never "
  "seen before. The clearest demonstration that a world model can do planning work in a domain where "
  "classical mapping already works well — which is the bar it has to clear.",
  "navdreamer,dino-wm,vjepa2,gaia-2"),

"2405.17398":("vista-wm","rl","model-based","high-fidelity driving world model, long-horizon generation, versatile control","world model",
  "wm-residual","",2,
  "<b>Vista</b> — a generalizable driving world model with structural and motion losses added specifically "
  "to stop long-horizon rollouts from degenerating. Included because driving is where video world models "
  "were forced to confront long-horizon drift first, and the fixes transfer.",
  "gaia-2,navigation-world-models,navdreamer,dreamdojo"),

"2503.20523":("gaia-2","rl","model-based","latent diffusion, multi-view, controllable generation, ego-dynamics conditioning","world model",
  "wm-residual,auto-research-wm","",2,
  "<b>GAIA-2</b> (Wayve) — a controllable multi-view latent-diffusion world model conditioned on ego "
  "dynamics, other agents, environment and road semantics. The industrial reference for "
  "<em>controllability</em>: it is the clearest published account of how many conditioning channels a "
  "usable world model needs, which is more than most robotics WAMs currently expose.",
  "vista-wm,navigation-world-models,cosmos,genie3"),

# ══════════════════════════════════════════════════════════════════════════
#  IX. Surveys, tutorials, and the dissenting view
# ══════════════════════════════════════════════════════════════════════════
"2605.00080":("wm-survey-robot","il","world-models","comprehensive survey, taxonomy of world models for robot learning","survey",
  "wam-umi-gloves,tactile-wm,wm-residual","wam-tactile",3,
  "<b>World Model for Robot Learning: A Comprehensive Survey</b> — the most complete map of this area as of "
  "2026. Start here if you want the taxonomy before the papers; it is also the fastest way to check whether "
  "a subarea you are about to claim as novel already has a name.",
  "wm-survey-manip,wam-tutorial,embodied-sim-survey,worldarena2"),

"2606.00113":("wm-survey-manip","il","world-models","survey, world models specifically for manipulation","survey",
  "wam-umi-gloves,tactile-wm","wam-tactile",2,
  "<b>World Models for Robotic Manipulation: A Survey</b> — narrower than the general survey and therefore "
  "more useful for a manipulation project; the two overlap but disagree on taxonomy in instructive ways.",
  "wm-survey-robot,wam-tutorial,worldarena2"),

"2607.00836":("wam-tutorial","il","world-models","tutorial, world models to world-action models, formalism","survey",
  "wam-umi-gloves,tactile-wm,rl-post-training","wam-tactile",3,
  "<b>From World Models to World Action Models: A Concise Tutorial for Robotics</b> — the short, "
  "definitional piece that pins down what the <em>action</em> in world-action model buys you over a plain "
  "world model. Read this first of the four surveys; it is the one that will make the rest legible, and "
  "it gives you the vocabulary your own WAM paper should use.",
  "wm-survey-robot,wm-survey-manip,dreamzero,lawam"),

"2507.00917":("embodied-sim-survey","systems","sim-bench","survey, physical simulators vs world models for embodied intelligence","survey",
  "real2sim2real-ego,auto-research-wm,soft-sim2real","r2s2r",2,
  "<b>Learning Embodied Intelligence from Physical Simulators and World Models</b> — the survey that treats "
  "the analytic simulator and the learned world model as competing answers to the same question, rather "
  "than as separate fields. That comparison is precisely the framing your Real2Sim2Real project sits "
  "inside, so it is worth the read even though surveys rarely are.",
  "wm-survey-robot,physworld,phystwin,acdc"),

"2606.06556":("beyond-vla-wm","il","world-models","position paper, limits of VLA and world-model paradigms","position",
  "wm-residual,rl-post-training,tactile-wm","wam-tactile,m2",2,
  "<b>Robots Need More than VLA and World Models</b> — the dissenting position, and worth keeping in the "
  "library precisely because everything else in this section agrees with itself. Read it as a checklist of "
  "the objections your own WAM introduction will have to answer.",
  "wam-tutorial,wm-survey-robot,causal-wm"),

"2601.21998":("causal-wm","rl","model-based","causal structure in world models, robot control, spurious correlation","world model",
  "wm-residual,auto-research-wm","m2",2,
  "<b>Causal World Modeling for Robot Control</b> — the failure this addresses is real and under-discussed: "
  "a world model trained on correlational data will happily learn that the gripper closing <em>causes</em> "
  "the light to change, and plan accordingly. Relevant to anything trained on passively collected video, "
  "which is now most of the field.",
  "beyond-vla-wm,dino-wm,dreamerv3,adaptigraph"),

# ── humanoid whole-body, via a world model ──
"2602.11758":("haic","rl","loco-manip","dynamics-aware world model, agile object interaction, humanoid whole-body","world model, RL",
  "wm-residual,rl-post-training,hri-collab","mabel",3,
  "<b>HAIC</b> — humanoid agile object interaction control driven by a <b>dynamics-aware world model</b>. "
  "The entry in this batch closest to MABEL: most world-model work is tabletop manipulation, and this one "
  "is about a humanoid interacting with objects <em>while moving</em>, where the model has to capture the "
  "coupling between whole-body momentum and the object. If a world model is ever going to help MABEL, it "
  "will look more like this than like a video WAM.",
  "resmimic,amo,hugwbc,wholebodyvla,dreamzero,motionwam"),
}

# Lab attribution is *derived from the author list*, never guessed: a paper is
# filed under a group only when that group's PI is actually an author on it.
LABS=[("Yunzhu Li",        "RoboPIL (Yunzhu Li)"),
      ("Li Fei-Fei",       "Stanford Vision & Learning (SVL)"),
      ("Fei-Fei Li",       "Stanford Vision & Learning (SVL)"),
      ("Danijar Hafner",   "Google DeepMind"),
      ("Lerrel Pinto",     "NYU CILVR"),
      ("Yann LeCun",       "Meta FAIR"),
      ("Jim Fan",          "NVIDIA GEAR"),
      ("Yuke Zhu",         "NVIDIA GEAR")]
LABMAP=dict(LABS)
def lab_for(m):
    """Last author is the senior author, so a joint paper is filed under the group
    whose PI signs last: VoxPoser ends ... Yunzhu Li, Jiajun Wu, Li Fei-Fei -> SVL,
    while PhysTwin ends ... Shenlong Wang, Yunzhu Li -> RoboPIL."""
    auth=m.get("authors") or []
    for name in reversed(auth):
        if name in LABMAP: return LABMAP[name]
    return ""

for aid,(pid,tree,br,top,par,ideas,projs,st,note,rel) in ANN.items():
    m=SRC.get(aid)
    if not m:
        raise SystemExit(f"curated_wm: {aid} missing from wm_papers.json")
    ven=VEN.get(aid) or {}
    ROWS.append(dict(id=pid, title=m["title"], tree=tree, br=br,
      a="; ".join(m.get("authors") or []), inst="; ".join(m.get("institutions") or []), lab=lab_for(m),
      v=ven.get("venue","arXiv"), vt=ven.get("venue_type","preprint"),
      y=int(m["published"][:4]) if m.get("published") else None,
      d=m.get("published",""), top=top, par=par, meth="", pr=projs, id_=ideas, rel=rel,
      arx=aid, doi=ven.get("doi") or m.get("doi",""), note=note, st=st,
      abstract=m.get("abstract","")))

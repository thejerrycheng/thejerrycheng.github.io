# -*- coding: utf-8 -*-
"""Curated RL tree.  a=authors  corr=corresponding  inst=institutions  lab=lab
   v=venue vt=venue_type y=year d=date br=branch top=topics par=paradigm meth=methodology
   arx=arXiv  rel=related ids  pr=your projects  id_=your research ideas  st=1..3 importance"""
ROWS = []
def P(id, title, **k):
    k["id"] = id; k["title"] = title; k["tree"] = "rl"; ROWS.append(k)

# ---------------------------------------------------------------- foundations
P("ppo","Proximal Policy Optimization Algorithms",
  a="John Schulman; Filip Wolski; Prafulla Dhariwal; Alec Radford; Oleg Klimov",
  inst="OpenAI", lab="OpenAI", v="arXiv", vt="preprint", y=2017, d="2017-07-20",
  br="foundations", top="policy gradient, on-policy RL", par="RL",
  meth="clipped surrogate objective", arx="1707.06347", st=3,
  note="Still the workhorse behind essentially every legged-locomotion and humanoid result in this library. "
       "Its dominance is less about optimality than about tolerance: it survives bad reward scales, "
       "huge parallel batch sizes, and non-stationary curricula without diverging.",
  rel="sac,trpo,rudin2021,anymal-hwangbo")
P("trpo","Trust Region Policy Optimization",
  a="John Schulman; Sergey Levine; Philipp Moritz; Michael I. Jordan; Pieter Abbeel",
  inst="UC Berkeley", v="ICML", vt="conference", y=2015, d="2015-02-19",
  br="foundations", top="policy gradient, trust region", par="RL",
  meth="KL-constrained natural gradient", arx="1502.05477", st=2,
  note="The monotonic-improvement argument PPO approximates away. Worth reading to know what PPO's clip is standing in for.",
  rel="ppo")
P("sac","Soft Actor-Critic: Off-Policy Maximum Entropy Deep RL with a Stochastic Actor",
  a="Tuomas Haarnoja; Aurick Zhou; Pieter Abbeel; Sergey Levine",
  inst="UC Berkeley", lab="BAIR", v="ICML", vt="conference", y=2018, d="2018-01-04",
  br="foundations", top="off-policy RL, maximum entropy", par="RL",
  meth="entropy-regularized actor-critic, twin critics", arx="1801.01290", st=3,
  note="The default when samples are expensive — i.e. whenever you are learning on real hardware. "
       "Maximum-entropy formulation also gives you a temperature knob that behaves like an exploration schedule you do not have to tune by hand.",
  rel="ppo,serl,daydreamer")
P("td3","Addressing Function Approximation Error in Actor-Critic Methods",
  a="Scott Fujimoto; Herke van Hoof; David Meger", inst="McGill University; University of Amsterdam",
  v="ICML", vt="conference", y=2018, d="2018-02-26", br="foundations",
  top="off-policy RL, overestimation bias", par="RL", meth="twin critics, delayed policy update, target smoothing",
  arx="1802.09477", st=2, note="Where the twin-critic trick that SAC inherited comes from.", rel="sac")
P("dqn","Human-level control through deep reinforcement learning",
  a="Volodymyr Mnih; Koray Kavukcuoglu; David Silver; Andrei A. Rusu; Joel Veness; et al.",
  inst="Google DeepMind", lab="DeepMind", v="Nature", vt="journal", y=2015, d="2015-02-26",
  br="foundations", top="value-based RL, Atari", par="RL", meth="experience replay, target network",
  doi="10.1038/nature14236", st=2, note="The paper that started the modern era. Historical anchor for the RL tree.",
  rel="ppo,muzero")

# ---------------------------------------------------------------- locomotion
P("anymal-hwangbo","Learning agile and dynamic motor skills for legged robots",
  a="Jemin Hwangbo; Joonho Lee; Alexey Dosovitskiy; Dario Bellicoso; Vassilios Tsounis; Vladlen Koltun; Marco Hutter",
  corr="Jemin Hwangbo; Marco Hutter", inst="ETH Zürich; Intel Labs", lab="ETH Robotic Systems Lab (RSL)",
  v="Science Robotics", vt="journal", y=2019, d="2019-01-16", br="locomotion",
  top="legged locomotion, sim-to-real, actuator modelling", par="RL",
  meth="learned actuator network, domain randomization, TRPO", arx="1901.08652", st=3,
  note="The origin point for RL locomotion that actually transfers. The key idea is not the policy but the "
       "learned actuator network: identify the series-elastic actuator's real torque response from data and put "
       "*that* in the simulator, instead of hoping domain randomization papers over it.",
  rel="anymal-lee,rudin2021,rma,ppo", pr="mabel")
P("anymal-lee","Learning quadrupedal locomotion over challenging terrain",
  a="Joonho Lee; Jemin Hwangbo; Lorenz Wellhausen; Vladlen Koltun; Marco Hutter",
  corr="Joonho Lee", inst="ETH Zürich; Intel Labs", lab="ETH RSL",
  v="Science Robotics", vt="journal", y=2020, d="2020-10-21", br="locomotion",
  top="blind locomotion, rough terrain, proprioception", par="RL",
  meth="teacher-student privileged distillation, temporal convolution over proprioceptive history",
  arx="2010.11251", st=3,
  note="Teacher-student privileged distillation in its canonical form: train with terrain ground truth, "
       "distill into a policy that only sees joint history. Nearly every legged and humanoid pipeline since "
       "reuses this two-stage structure.",
  rel="anymal-hwangbo,rma,miki2022,anymal-parkour", pr="mabel")
P("rma","RMA: Rapid Motor Adaptation for Legged Robots",
  a="Ashish Kumar; Zipeng Fu; Deepak Pathak; Jitendra Malik",
  corr="Ashish Kumar", inst="UC Berkeley; Carnegie Mellon University", lab="BAIR; CMU",
  v="RSS", vt="conference", y=2021, d="2021-07-08", br="locomotion",
  top="online adaptation, sim-to-real, latent dynamics", par="RL",
  meth="environment-factor encoder + adaptation module regressed from proprioceptive history",
  arx="2107.04034", st=3,
  note="Reframes sim-to-real as online system identification: a small adaptation module infers a latent "
       "environment vector from recent proprioception at 100 Hz. The trick generalizes far beyond legs — "
       "the same structure shows up in in-hand manipulation and loco-manipulation.",
  rel="anymal-lee,dextreme,asap", pr="mabel", id_="real2sim2real-ego")
P("rudin2021","Learning to Walk in Minutes Using Massively Parallel Deep Reinforcement Learning",
  a="Nikita Rudin; David Hoeller; Philipp Reist; Marco Hutter", corr="Nikita Rudin",
  inst="ETH Zürich; NVIDIA", lab="ETH RSL", v="CoRL", vt="conference", y=2021, d="2021-09-24",
  br="locomotion", top="massively parallel RL, GPU simulation", par="RL",
  meth="thousands of parallel envs on one GPU, game-inspired curriculum", arx="2109.11978", st=3,
  note="The wall-clock unlock. Legged Gym / Isaac Gym made 4096 parallel environments normal and turned "
       "locomotion training from a cluster job into a coffee break. Almost every result below assumes it.",
  rel="isaacgym,anymal-lee,ppo", pr="mabel,m2")
P("miki2022","Learning robust perceptive locomotion for quadrupedal robots in the wild",
  a="Takahiro Miki; Joonho Lee; Jemin Hwangbo; Lorenz Wellhausen; Vladlen Koltun; Marco Hutter",
  corr="Takahiro Miki", inst="ETH Zürich", lab="ETH RSL", v="Science Robotics", vt="journal",
  y=2022, d="2022-01-19", br="locomotion", top="perceptive locomotion, exteroception, belief state", par="RL",
  meth="attention-gated belief encoder fusing exteroception with proprioception", arx="2201.08117", st=3,
  note="Solves the real failure mode of perceptive locomotion: the elevation map is often wrong. "
       "The belief encoder learns *when to distrust vision* and fall back on proprioception.",
  rel="anymal-lee,anymal-parkour,attention-map-hutter")
P("extreme-parkour","Extreme Parkour with Legged Robots",
  a="Xuxin Cheng; Kexin Shi; Ananye Agarwal; Deepak Pathak", corr="Xuxin Cheng",
  inst="Carnegie Mellon University", lab="CMU Robotics Institute (Pathak Lab)",
  v="ICRA", vt="conference", y=2024, d="2023-09-25", br="locomotion",
  top="parkour, agile locomotion, depth vision", par="RL",
  meth="inner-product reward for direction, single depth camera, two-stage distillation", arx="2309.14341", st=2,
  note="Shows how far a single front-facing depth camera plus a well-shaped direction reward can go. "
       "Contrast with ANYmal parkour, which leans on a planner and more sensing.",
  rel="anymal-parkour,miki2022,robot-parkour")
P("anymal-parkour","ANYmal Parkour: Learning Agile Navigation for Quadrupedal Robots",
  a="David Hoeller; Nikita Rudin; Dhionis Sako; Marco Hutter", corr="David Hoeller",
  inst="ETH Zürich; NVIDIA", lab="ETH RSL", v="Science Robotics", vt="journal", y=2024,
  d="2023-06-26", br="locomotion", top="parkour, skill library, navigation", par="RL",
  meth="specialized skill policies + high-level navigation policy selecting among them", arx="2306.14874", st=2,
  note="The hierarchical counterpoint to end-to-end parkour: train separate jump/climb/crouch specialists, "
       "then learn a navigator that picks between them. More engineering, more reliability.",
  rel="extreme-parkour,miki2022")
P("radosavovic-humanoid","Real-World Humanoid Locomotion with Reinforcement Learning",
  a="Ilija Radosavovic; Tete Xiao; Bike Zhang; Trevor Darrell; Jitendra Malik; Koushil Sreenath",
  corr="Ilija Radosavovic", inst="UC Berkeley", lab="BAIR / Hybrid Robotics",
  v="Science Robotics", vt="journal", y=2024, d="2023-03-06", br="locomotion",
  top="humanoid locomotion, causal transformer, in-context adaptation", par="RL",
  meth="causal transformer over observation-action history, trained in sim, zero-shot to Digit",
  arx="2303.03381", st=3,
  note="Treats locomotion as next-token prediction over the observation-action stream, which gives "
       "in-context adaptation for free. Early evidence that sequence models beat MLPs once the "
       "environment is non-stationary.",
  rel="rma,anymal-lee,humanoid-transformer2", pr="mabel")
P("multi-loco","Multi-Loco: Unifying Multi-Embodiment Legged Locomotion via Reinforcement Learning Augmented Diffusion",
  a="Shunpeng Yang; Zhen Fu; Zhefeng Cao; Guo Junde; Patrick Wensing; Wei Zhang; Hua Chen",
  inst="Southern University of Science and Technology; University of Notre Dame", v="arXiv", vt="preprint",
  y=2025, d="2025-06-13", br="locomotion", top="multi-embodiment, cross-morphology locomotion", par="RL, diffusion",
  meth="diffusion prior over gaits + RL residual", arx="2506.11470", st=1,
  note="In your ~/Desktop/papers/RL. Relevant to the cross-embodiment thread — one policy, many leg counts.",
  rel="rudin2021,crossformer")
P("booster-rl","Booster Gym: An End-to-End Reinforcement Learning Framework for Humanoid Robot Locomotion",
  a="Yushi Wang; Penghui Chen; Xinyu Han; Feng Wu; Mingguo Zhao", inst="Tsinghua University; Booster Robotics",
  v="arXiv", vt="preprint", y=2025, d="2025-06-18", br="locomotion",
  top="humanoid locomotion, open framework", par="RL", meth="sim-to-real pipeline, domain randomization",
  arx="2506.15132", st=1, note="In your library. Useful as a concrete reference stack for a humanoid RL bring-up.",
  rel="rudin2021,isaaclab", pr="mabel")
P("attention-map-hutter","Attention-Based Map Encoding for Learning Generalized Legged Locomotion",
  a="Junzhe He; Chong Zhang; Fabian Jenelten; Ruben Grandia; Moritz Bächer; Marco Hutter",
  inst="ETH Zürich; Disney Research", lab="ETH RSL", v="Science Robotics", vt="journal",
  y=2025, d="2025-06-11", br="locomotion", top="terrain encoding, attention, generalization", par="RL",
  meth="attention over local height-map tokens", arx="2506.09588", st=2,
  note="In your library. The modern successor to Miki's belief encoder — attention over map tokens instead of a fixed CNN.",
  rel="miki2022,anymal-parkour")

# ---------------------------------------------------------------- motion imitation
P("deepmimic","DeepMimic: Example-Guided Deep Reinforcement Learning of Physics-Based Character Skills",
  a="Xue Bin Peng; Pieter Abbeel; Sergey Levine; Michiel van de Panne",
  corr="Xue Bin Peng", inst="UC Berkeley; University of British Columbia", lab="BAIR; UBC Motion Lab",
  v="SIGGRAPH", vt="conference", y=2018, d="2018-04-08", br="motion-imitation",
  top="motion imitation, physics-based characters, reward shaping", par="RL",
  meth="pose-tracking reward, reference state initialization, early termination", arx="1804.02717", st=3,
  note="The single most load-bearing paper in humanoid whole-body control today. Two implementation details "
       "did most of the work — reference state initialization (start episodes anywhere in the clip) and early "
       "termination (kill the episode on loss of balance) — and both are still in every tracking policy you will train.",
  rel="amp,ase,phc,maskedmimic,h2o,asap,videomimic,add", pr="mabel", id_="learned-retargeting")
P("amp","AMP: Adversarial Motion Priors for Stylized Physics-Based Character Control",
  a="Xue Bin Peng; Ze Ma; Pieter Abbeel; Sergey Levine; Angjoo Kanazawa",
  corr="Xue Bin Peng", inst="UC Berkeley", lab="BAIR", v="SIGGRAPH", vt="conference", y=2021,
  d="2021-04-05", br="motion-imitation", top="adversarial imitation, motion style, unstructured mocap", par="RL, adversarial IL",
  meth="discriminator-based style reward + task reward", arx="2104.02180", st=3,
  note="Replaces DeepMimic's per-frame tracking with a learned style discriminator, so you can train on an "
       "unstructured motion dataset and combine style with an arbitrary task reward. This is what let motion "
       "priors escape single-clip imitation.",
  rel="deepmimic,ase,gail,calm")
P("ase","ASE: Large-Scale Reusable Adversarial Skill Embeddings for Physically Simulated Characters",
  a="Xue Bin Peng; Yunrong Guo; Lina Halper; Sergey Levine; Sanja Fidler",
  inst="UC Berkeley; NVIDIA; University of Toronto", lab="BAIR; NVIDIA Toronto AI Lab",
  v="SIGGRAPH", vt="conference", y=2022, d="2022-05-04", br="motion-imitation",
  top="skill embeddings, latent skill space, reusable priors", par="RL, adversarial IL",
  meth="adversarial skill discovery into a latent space, then task RL over latents", arx="2205.01906", st=2,
  note="Pretrain a latent skill space once, then solve downstream tasks by searching in it. The ancestor of "
       "every 'latent skill' loco-manipulation paper in this library.",
  rel="amp,calm,maskedmimic,lucid-skill")
P("phc","Perpetual Humanoid Control for Real-time Simulated Avatars",
  a="Zhengyi Luo; Jinkun Cao; Alexander Winkler; Kris Kitani; Weipeng Xu",
  corr="Zhengyi Luo", inst="Carnegie Mellon University; Meta Reality Labs", v="ICCV", vt="conference",
  y=2023, d="2023-05-10", br="motion-imitation", top="motion tracking, failure recovery, avatars", par="RL",
  meth="progressive multiplicative control policy, fail-state recovery", arx="2305.06456", st=2,
  note="Tracks the whole AMASS corpus with one policy and recovers from failure instead of resetting. "
       "PHC checkpoints are the de-facto motion-tracking backbone reused by H2O/OmniH2O and friends.",
  rel="deepmimic,h2o,omnih2o,maskedmimic")
P("maskedmimic","MaskedMimic: Unified Physics-Based Character Control Through Masked Motion Inpainting",
  a="Chen Tessler; Yunrong Guo; Ofir Nabati; Gal Chechik; Xue Bin Peng",
  corr="Chen Tessler", inst="NVIDIA; Technion; Simon Fraser University", lab="NVIDIA",
  v="SIGGRAPH Asia", vt="conference", y=2024, d="2024-09-22", br="motion-imitation",
  top="masked modelling, unified control, motion inpainting", par="RL",
  meth="train with randomly masked goal specifications so one policy serves many interfaces", arx="2409.14393", st=3,
  note="The BERT move applied to control: mask parts of the goal at training time and a single policy "
       "covers joystick, waypoint, VR-trio and full-body targets. HOVER is the same insight on real humanoid hardware.",
  rel="hover,ase,phc,deepmimic", pr="mabel", id_="learned-retargeting")
P("add","Physics-Based Motion Imitation with Adversarial Differential Discriminators",
  a="Ziyu Zhang; Sergey Bashkirov; Dun Yang; Michael Taylor; Xue Bin Peng",
  inst="Simon Fraser University; Sony", v="SIGGRAPH Asia", vt="conference", y=2025, d="2025-05-08",
  br="motion-imitation", top="adversarial imitation, reward design", par="RL, adversarial IL",
  meth="differential discriminator on state transitions, removes manual reward terms", arx="2505.04961", st=2,
  note="In your ~/Desktop/papers/RL. Gets rid of the hand-tuned multi-term tracking reward — the part of "
       "DeepMimic-style pipelines that costs the most engineer-hours.",
  rel="deepmimic,amp")
P("beyond-mimic","BeyondMimic: From Motion Tracking to Versatile Humanoid Control via Guided Diffusion",
  a="Hongwei Yu; Qiayuan Liao; Wenli Xiao; Zi Wang; Guanya Shi; Koushil Sreenath",
  inst="UC Berkeley; Carnegie Mellon University", lab="Hybrid Robotics (Sreenath); LeCAR (Shi)",
  v="arXiv", vt="preprint", y=2025, d="2025-08-11", br="motion-imitation",
  top="motion tracking, guided diffusion, versatile control", par="RL, diffusion",
  meth="unified tracking policy + diffusion-based test-time steering", arx="2508.08241", st=2,
  note="You named this one. The pitch is that a single well-trained tracking policy plus diffusion guidance "
       "at test time replaces a library of task-specific controllers — no retraining to get a new behaviour.",
  rel="deepmimic,maskedmimic,asap,dp", pr="mabel")
P("videomimic","VideoMimic: Visual Imitation Enables Contextual Humanoid Control",
  a="Arthur Allshire; Hongsuk Choi; Junyi Zhang; David McAllister; Anthony Zhang; Chung Min Kim; Trevor Darrell; Pieter Abbeel; Jitendra Malik; Angjoo Kanazawa",
  corr="Arthur Allshire", inst="UC Berkeley", lab="BAIR / KAIR",
  v="arXiv", vt="preprint", y=2025, d="2025-05-06", br="motion-imitation",
  top="real-to-sim, human video, terrain-aware humanoid control", par="RL, real2sim",
  meth="monocular video -> 4D reconstruction of human+scene -> RL tracking in reconstructed terrain",
  arx="2505.03729", st=3,
  note="Directly on your real-to-sim-to-real-from-egocentric-views idea. Reconstructs both the human motion "
       "and the terrain from ordinary video, then trains a policy in that reconstruction. The scene is the "
       "part everyone else drops.",
  rel="deepmimic,asap,videomimic2,real2sim", pr="mabel", id_="real2sim2real-ego,third-person")
P("visualmimic","VisualMimic: Visual Humanoid Loco-Manipulation via Motion Tracking and Generation",
  a="Shaofeng Yin; Yanjie Ze; Hong-Xing Yu; C. Karen Liu; Jiajun Wu",
  inst="Stanford University; Tsinghua University", lab="Stanford Vision & Learning (SVL)",
  v="arXiv", vt="preprint", y=2025, d="2025-09-25", br="motion-imitation",
  top="visual loco-manipulation, hierarchical control", par="RL",
  meth="low-level tracking policy + high-level visual policy generating motion targets", arx="2509.20322", st=2,
  note="In your library. The hierarchical split — vision picks the reference motion, a tracker executes it — "
       "is currently the most reliable recipe for humanoid loco-manipulation.",
  rel="deepmimic,falcon,fetchman", pr="mabel")

# ---------------------------------------------------------------- dexterous manipulation
P("dactyl","Learning Dexterous In-Hand Manipulation",
  a="OpenAI: Marcin Andrychowicz; Bowen Baker; Maciek Chociej; Rafal Jozefowicz; Bob McGrew; et al.",
  inst="OpenAI", lab="OpenAI", v="IJRR", vt="journal", y=2020, d="2018-08-01", br="manipulation",
  top="in-hand manipulation, dexterity, domain randomization", par="RL",
  meth="massive domain randomization, LSTM policy, vision-based pose estimation", arx="1808.00177", st=3,
  note="The existence proof for RL dexterity, and the cautionary tale about its cost — ~100 years of simulated "
       "experience on a Shadow Hand for one task. Everything since has been about making this affordable.",
  rel="chen-inhand,dextreme,qi-inhand,rotate-without-seeing", pr="geodex", id_="ego-dex")
P("chen-inhand","A System for General In-Hand Object Re-Orientation",
  a="Tao Chen; Jie Xu; Pulkit Agrawal", corr="Tao Chen", inst="MIT", lab="MIT Improbable AI Lab",
  v="CoRL", vt="conference", y=2021, d="2021-11-04", br="manipulation",
  top="in-hand reorientation, gravity-agnostic dexterity", par="RL",
  meth="teacher-student with privileged object state, gravity curriculum", arx="2111.03043", st=3,
  note="Reorients 2000+ objects including hand-facing-down, which Dactyl could not do. Best-paper at CoRL 2021 "
       "and the point where in-hand RL stopped being one-object-one-paper.",
  rel="dactyl,chen-visual-inhand,dextreme", pr="geodex")
P("chen-visual-inhand","Visual Dexterity: In-Hand Reorientation of Novel and Complex Object Shapes",
  a="Tao Chen; Megha Tippur; Siyang Wu; Vikash Kumar; Edward Adelson; Pulkit Agrawal",
  corr="Tao Chen; Pulkit Agrawal", inst="MIT; Meta AI", lab="MIT Improbable AI Lab",
  v="Science Robotics", vt="journal", y=2023, d="2022-11-21", br="manipulation",
  top="vision-based in-hand reorientation, novel objects", par="RL",
  meth="depth-only policy, teacher-student, real-time reorientation of unseen shapes", arx="2211.11744", st=3,
  note="The vision-based version — single depth camera, novel and complex shapes, no object model. "
       "This is the benchmark your GeoDex work sits against.",
  rel="chen-inhand,qi-inhand,dextreme", pr="geodex")
P("dextreme","DeXtreme: Transfer of Agile In-hand Manipulation from Simulation to Reality",
  a="Ankur Handa; Arthur Allshire; Viktor Makoviychuk; Aleksei Petrenko; Ritvik Singh; et al.",
  corr="Ankur Handa", inst="NVIDIA", lab="NVIDIA Seattle Robotics Lab", v="ICRA", vt="conference",
  y=2023, d="2022-10-25", br="manipulation", top="in-hand manipulation, sim-to-real, GPU RL", par="RL",
  meth="Isaac Gym domain randomization, ADR, pose estimation from vision", arx="2210.13702", st=2,
  note="Reproduces Dactyl-class dexterity on commodity hardware and a fraction of the compute. The gap between "
       "this and Dactyl is almost entirely simulator throughput.",
  rel="dactyl,isaacgym,chen-inhand", pr="geodex")
P("qi-inhand","In-Hand Object Rotation via Rapid Motor Adaptation",
  a="Haozhi Qi; Ashish Kumar; Roberto Calandra; Yi Ma; Jitendra Malik",
  corr="Haozhi Qi", inst="UC Berkeley; Meta AI", lab="BAIR", v="CoRL", vt="conference", y=2022,
  d="2022-10-10", br="manipulation", top="in-hand rotation, online adaptation, proprioception", par="RL",
  meth="RMA-style adaptation module on an Allegro hand, proprioception only", arx="2210.04887", st=2,
  note="RMA ported from legs to fingers, on a cheap Allegro hand with no vision. The proprioception-only "
       "constraint is what makes it deployable.",
  rel="rma,rotate-without-seeing,chen-inhand", pr="geodex")
P("rotate-without-seeing","Rotating without Seeing: Towards In-hand Dexterity through Touch",
  a="Zhao-Heng Yin; Binghao Huang; Yuzhe Qin; Qifeng Chen; Xiaolong Wang",
  corr="Zhao-Heng Yin", inst="HKUST; UC San Diego", lab="UCSD Xiaolong Wang Lab",
  v="RSS", vt="conference", y=2023, d="2023-03-20", br="manipulation",
  top="touch-only dexterity, binary tactile sensing", par="RL",
  meth="binary contact sensors, teacher-student, sim-to-real with tactile randomization", arx="2303.10880", st=2,
  note="Touch-only in-hand rotation. Direct evidence for your tactile-world-model idea: contact signals carry "
       "enough state for dexterity even with vision removed entirely.",
  rel="qi-inhand,dexskin,anyskin", pr="geodex", id_="tactile-wm")
P("dexplore","Dexplore: Scalable Neural Control for Dexterous Manipulation from Reference-Scoped Exploration",
  a="Sirui Xu; Yu-Wei Chao; Liuyu Bian; Arsalan Mousavian; Yu-Xiong Wang; Liang-Yan Gui; Wei Yang",
  inst="UIUC; NVIDIA", v="CoRL", vt="conference", y=2025, br="manipulation",
  top="dexterous manipulation, reference-guided exploration, scalable control", par="RL",
  st=2, note="From your CoRL 2025 proceedings folder. Uses reference motion as a soft exploration scope rather "
             "than a hard tracking target — a middle ground between DeepMimic-style tracking and free RL.",
  rel="deepmimic,chen-inhand", pr="geodex")
P("clutterdexgrasp","ClutterDexGrasp: A Sim-to-Real System for General Dexterous Grasping in Cluttered Scenes",
  a="Zeyuan Chen; Qiyang Yan; Yuanpei Chen; Tianhao Wu; Jiyao Zhang; Zihan Ding; Jinzhou Li; Yaodong Yang; Hao Dong",
  inst="Peking University", lab="PKU-Agibot Lab / Hao Dong Lab", v="CoRL", vt="conference", y=2025,
  br="manipulation", top="dexterous grasping, clutter, sim-to-real", par="RL",
  st=2, note="From your CoRL 2025 folder. Clutter is the setting where analytic grasp planners fall over and "
             "RL earns its keep.", rel="chen-visual-inhand,dexndm", pr="geodex")
P("force-control-corl","Reinforcement Learning with Vision-Language Models for Contact-Rich Force Control",
  a="(CoRL 2025 best-paper track)", inst="", v="CoRL", vt="conference", y=2025, br="manipulation",
  top="contact-rich manipulation, force control", par="RL", st=1,
  note="Saved in your ~/Desktop/papers/RL as force_control_corl_best_paper.pdf — worth re-checking the exact "
       "citation before you cite it. Contact-rich force control is the gap between grasping and assembly.",
  rel="dexskin,omnitactune")
P("catch-it","Catch It! Learning to Catch in Flight with Mobile Dexterous Hands",
  a="Yuanhang Zhang; Tianhai Liang; Zhenyang Chen; Yanjie Ze; Huazhe Xu",
  inst="Tsinghua University; Shanghai Qi Zhi Institute; Stanford University", v="ICRA", vt="conference",
  y=2025, d="2024-09-17", br="manipulation", top="dynamic manipulation, catching, mobile dexterity", par="RL",
  arx="2409.10319", st=2, note="In your library. Dynamic, whole-body, and dexterous at once — a good stress "
  "test for the mobile-dexterous-manipulation idea.", rel="visualmimic,falcon", pr="mabel", id_="mobile-dex-umi")
P("dexndm","DexNDM: Closing the Reality Gap for Dexterous In-Hand Manipulation via Joint-Wise Neural Dynamics Model",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2025, br="manipulation",
  top="in-hand manipulation, neural dynamics, reality gap", par="RL, model-based",
  st=2, note="In ~/Desktop/papers/Dexterous Manipulation Sim-to-real. Joint-wise learned dynamics is the "
             "hand analogue of Hwangbo's actuator network — identify the real actuator, not the whole world.",
  rel="anymal-hwangbo,wm-residual-ref", pr="geodex", id_="wm-residual")

# ---------------------------------------------------------------- loco-manipulation
P("falcon","FALCON: Learning Force-Adaptive Humanoid Loco-Manipulation",
  a="Yuanhang Zhang; Yifu Yuan; Prajwal Gurunath; Tairan He; Shayegan Omidshafiei; Ali-akbar Agha-mohammadi; Marcello Vendittelli; Guanya Shi",
  inst="Carnegie Mellon University", lab="CMU LeCAR Lab (Guanya Shi)", v="arXiv", vt="preprint",
  y=2025, d="2025-05-10", br="loco-manip", top="force-adaptive control, loco-manipulation, dual-agent RL", par="RL",
  meth="decoupled upper/lower-body agents with force curriculum", arx="2505.06776", st=2,
  note="In your library. The decoupled upper/lower-body formulation with an explicit external-force curriculum "
       "is directly applicable to MABEL carrying tasks.",
  rel="visualmimic,deep-wbc,fetchman,h2compact", pr="mabel,m2", id_="hri-collab")
P("deep-wbc","Deep Whole-Body Control: Learning a Unified Policy for Manipulation and Locomotion",
  a="Zipeng Fu; Xuxin Cheng; Deepak Pathak", corr="Zipeng Fu", inst="Carnegie Mellon University; Stanford University",
  lab="CMU Pathak Lab", v="CoRL", vt="conference", y=2022, d="2022-10-18", br="loco-manip",
  top="whole-body control, legged manipulation", par="RL",
  meth="single policy over arm+legs with regularized online adaptation", arx="2210.10044", st=2,
  note="Made the case that arm and legs should share one policy rather than be composed from two controllers.",
  rel="falcon,fetchman,visualmimic", pr="mabel")
P("fetchman","FetchMan: Learning Visual Humanoid Loco-Manipulation Policies",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, br="loco-manip",
  top="visual loco-manipulation, humanoid fetching", par="RL", arx="2608.17027", st=1,
  note="From your M2 literature. Recent visual loco-manipulation on humanoids.", rel="visualmimic,falcon", pr="m2,mabel")

# ---------------------------------------------------------------- multi-agent RL
P("mappo","The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games",
  a="Chao Yu; Akash Velu; Eugene Vinitsky; Jiaxuan Gao; Yu Wang; Alexandre Bayen; Yi Wu",
  corr="Chao Yu", inst="Tsinghua University; UC Berkeley; New York University", v="NeurIPS", vt="conference",
  y=2022, d="2021-03-02", br="marl", top="cooperative MARL, CTDE", par="MARL",
  meth="PPO with centralized value function, decentralized execution", arx="2103.01955", st=3,
  note="The MARL baseline you should start M2 from. Centralized-critic PPO beats most specialized MARL "
       "algorithms once you tune it properly, and it is far simpler to debug.",
  rel="qmix,ppo,maddpg", pr="m2", id_="multi-robot-marl")
P("qmix","QMIX: Monotonic Value Function Factorisation for Deep Multi-Agent Reinforcement Learning",
  a="Tabish Rashid; Mikayel Samvelyan; Christian Schroeder de Witt; Gregory Farquhar; Jakob Foerster; Shimon Whiteson",
  inst="University of Oxford", lab="Whiteson Research Lab", v="ICML", vt="conference", y=2018,
  d="2018-03-30", br="marl", top="value factorization, CTDE", par="MARL",
  meth="monotonic mixing network over per-agent Q-values", arx="1803.11485", st=2,
  note="The value-decomposition line. Matters for M2 mainly as the alternative framing to MAPPO: credit "
       "assignment by factorization instead of by a centralized critic.",
  rel="mappo,maddpg", pr="m2", id_="multi-robot-marl")
P("maddpg","Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments",
  a="Ryan Lowe; Yi Wu; Aviv Tamar; Jean Harb; Pieter Abbeel; Igor Mordatch",
  inst="OpenAI; UC Berkeley; McGill University", v="NeurIPS", vt="conference", y=2017,
  d="2017-06-07", br="marl", top="mixed cooperative-competitive, centralized critic", par="MARL",
  arx="1706.02275", st=2, note="The original centralized-critic/decentralized-actor template.",
  rel="mappo,qmix", pr="m2", id_="multi-robot-marl")
P("decentralized-aerial","Decentralized Aerial Manipulation of a Cable-Suspended Load using Multi-Agent Reinforcement Learning",
  a="(see PDF)", inst="", v="CoRL", vt="conference", y=2025, br="marl",
  top="cooperative transport, aerial manipulation, decentralized control", par="MARL", st=2,
  note="From your CoRL 2025 folder. The cleanest recent demonstration that decentralized MARL can hold a "
       "shared rigid constraint — exactly M2's collaborative-transport problem in a different medium.",
  rel="mappo,collab-transport-quad", pr="m2", id_="multi-robot-marl")
P("h2compact","H2-COMPACT: Human-Humanoid Co-Manipulation via Adaptive Contact Trajectory Policies",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2025, d="2025-05-23", br="marl",
  top="human-robot co-manipulation, contact trajectories", par="RL, IL", arx="2505.17627", st=2,
  note="From your M2 collaborative_transport folder. Human-in-the-loop co-manipulation — the HRI half of M2.",
  rel="falcon,decentralized-aerial", pr="m2", id_="hri-collab")

# ---------------------------------------------------------------- RL post-training on foundation models
P("serl","SERL: A Software Suite for Sample-Efficient Robotic Reinforcement Learning",
  a="Jianlan Luo; Zheyuan Hu; Charles Xu; You Liang Tan; Jacob Berg; Archit Sharma; Stefan Schaal; Chelsea Finn; Abhishek Gupta; Sergey Levine",
  corr="Jianlan Luo", inst="UC Berkeley; University of Washington; Stanford University", lab="BAIR (RAIL)",
  v="ICRA", vt="conference", y=2024, d="2024-01-29", br="post-training",
  top="real-world RL, sample efficiency, software suite", par="RL",
  meth="RLPD-style off-policy RL with demos, learned reward classifiers, forward-backward resets",
  arx="2401.16013", st=3,
  note="Makes real-robot RL a two-hour proposition rather than a research project. The reset and reward "
       "infrastructure here is the concrete template for your real-world RL harness idea.",
  rel="hil-serl,rlpd,rl-harness-ref,sac", pr="iris", id_="rl-harness,rl-post-training")
P("hil-serl","Precise and Dexterous Robotic Manipulation via Human-in-the-Loop Reinforcement Learning",
  a="Jianlan Luo; Charles Xu; Jeffrey Wu; Sergey Levine", corr="Jianlan Luo",
  inst="UC Berkeley", lab="BAIR (RAIL)", v="arXiv", vt="preprint", y=2024, d="2024-10-29",
  br="post-training", top="human-in-the-loop RL, precise manipulation", par="RL",
  meth="human corrections folded into the replay buffer during on-robot RL", arx="2410.21845", st=3,
  note="Near-100% success on genuinely hard contact-rich tasks in 1-2.5 hours of real training. The strongest "
       "existing argument that RL post-training beats more imitation data once you are chasing the last 10%.",
  rel="serl,rlpd,ript-vla", pr="iris", id_="rl-post-training,rl-harness")
P("rlpd","Efficient Online Reinforcement Learning with Offline Data",
  a="Philip J. Ball; Laura Smith; Ilya Kostrikov; Sergey Levine",
  inst="University of Oxford; UC Berkeley", lab="BAIR", v="ICML", vt="conference", y=2023,
  d="2023-02-06", br="post-training", top="offline-to-online RL, sample efficiency", par="RL",
  meth="symmetric sampling from offline and online buffers, layer norm, ensembles", arx="2302.02948", st=3,
  note="The algorithmic core underneath SERL/HIL-SERL. Three unglamorous tricks — 50/50 sampling, LayerNorm "
       "on critics, critic ensembles — turn offline data into a usable head start instead of a liability.",
  rel="serl,hil-serl,sac", id_="rl-post-training")
P("iRe-VLA","Improving Vision-Language-Action Model with Online Reinforcement Learning",
  a="Yanjiang Guo; Jianke Zhang; Xiaoyu Chen; Xiang Ji; Jianyu Chen",
  inst="Tsinghua University; Shanghai Qi Zhi Institute", v="ICRA", vt="conference", y=2025,
  d="2025-01-28", br="post-training", top="VLA post-training, online RL", par="RL, VLA",
  meth="alternating RL on the action head and supervised fine-tuning of the whole VLA", arx="2501.16664", st=2,
  note="Directly on your RL-post-training idea. The alternation matters: pure RL on a full VLA destabilizes "
       "the language backbone, so they interleave it with supervised phases.",
  rel="openvla,pi0,ript-vla,conrft", id_="rl-post-training")
P("ript-vla","Interactive Post-Training for Vision-Language-Action Models",
  a="Shuhan Tan; Kairan Dou; Yue Zhao; Philipp Krähenbühl", inst="UT Austin",
  v="arXiv", vt="preprint", y=2025, d="2025-05-22", br="post-training",
  top="VLA post-training, sparse reward, interactive RL", par="RL, VLA",
  meth="leave-one-out advantage over sampled rollouts, binary success reward only", arx="2505.17016", st=2,
  note="Post-trains a VLA with nothing but binary task success — no reward model, no value function. "
       "Practical because success is the one signal you can always instrument.",
  rel="iRe-VLA,hil-serl,pi0", id_="rl-post-training")
P("conrft","ConRFT: A Reinforced Fine-tuning Method for VLA Models via Consistency Policy",
  a="Yuhui Chen; Shuai Tian; Shugao Liu; Yingting Zhou; Haoran Li; Dongbin Zhao",
  inst="Chinese Academy of Sciences", v="RSS", vt="conference", y=2025, d="2025-02-08",
  br="post-training", top="VLA fine-tuning, consistency policy", par="RL, VLA",
  arx="2502.05450", st=2, note="Consistency-policy action head makes RL fine-tuning of a diffusion-style VLA "
  "tractable by cutting the denoising chain to a few steps.", rel="iRe-VLA,ript-vla,manflow", id_="rl-post-training")

# ---------------------------------------------------------------- model-based / world-model RL
P("dreamerv3","Mastering Diverse Domains through World Models",
  a="Danijar Hafner; Jurgis Pasukonis; Jimmy Ba; Timothy Lillicrap",
  corr="Danijar Hafner", inst="Google DeepMind; University of Toronto", lab="DeepMind",
  v="Nature", vt="journal", y=2025, d="2023-01-10", br="model-based",
  top="world models, latent imagination, generality", par="model-based RL",
  meth="RSSM latent dynamics, symlog returns, fixed hyperparameters across 150+ tasks", arx="2301.04104", st=3,
  note="One hyperparameter set, 150+ domains, diamonds in Minecraft from scratch. The reason 'world model' "
       "became a default design choice rather than an exotic one.",
  rel="daydreamer,dreamerv4,tdmpc2,muzero", id_="wm-residual,auto-research-wm")
P("daydreamer","DayDreamer: World Models for Physical Robot Learning",
  a="Philipp Wu; Alejandro Escontrela; Danijar Hafner; Ken Goldberg; Pieter Abbeel",
  corr="Philipp Wu", inst="UC Berkeley", lab="BAIR", v="CoRL", vt="conference", y=2022,
  d="2022-06-28", br="model-based", top="real-world model-based RL, sample efficiency", par="model-based RL",
  meth="Dreamer trained directly on physical robots, no simulator", arx="2206.14176", st=3,
  note="In your ~/Desktop/papers/RL. A quadruped learns to walk in one hour of real experience, no simulator. "
       "The single best argument that world models buy you real-world sample efficiency.",
  rel="dreamerv3,tdmpc2,serl", id_="wm-residual,rl-harness")
P("dreamerv4","Training Agents Inside Scalable World Models",
  a="Danijar Hafner; Wilson Yan; Timothy Lillicrap", inst="Google DeepMind", lab="DeepMind",
  v="arXiv", vt="preprint", y=2025, d="2025-09-29", br="model-based",
  top="scalable world models, offline-to-online, imagination training", par="model-based RL",
  meth="shortcut forcing, efficient transformer world model trained on offline data", arx="2509.24527", st=3,
  note="In your library. Learns Minecraft diamonds from offline data alone by training the agent purely "
       "inside the world model. The clearest signal yet for 'auto-research inside a world model'.",
  rel="dreamerv3,daydreamer,genie3", id_="auto-research-wm,wm-residual")
P("tdmpc2","TD-MPC2: Scalable, Robust World Models for Continuous Control",
  a="Nicklas Hansen; Hao Su; Xiaolong Wang", corr="Nicklas Hansen", inst="UC San Diego",
  v="ICLR", vt="conference", y=2024, d="2023-10-25", br="model-based",
  top="model predictive control, latent dynamics, multi-task", par="model-based RL",
  meth="decoder-free latent world model + MPPI planning", arx="2310.16828", st=2,
  note="Decoder-free: never reconstructs pixels, only predicts reward and value. Much cheaper than Dreamer "
       "and often stronger on continuous control.",
  rel="dreamerv3,daydreamer")
P("muzero","Mastering Atari, Go, Chess and Shogi by Planning with a Learned Model",
  a="Julian Schrittwieser; Ioannis Antonoglou; Thomas Hubert; Karen Simonyan; Laurent Sifre; et al.",
  inst="Google DeepMind", lab="DeepMind", v="Nature", vt="journal", y=2020, d="2019-11-19",
  br="model-based", top="learned model planning, MCTS", par="model-based RL",
  arx="1911.08265", st=2, note="Value-equivalent models: learn only what planning needs, not the pixels. "
  "Conceptual ancestor of TD-MPC's decoder-free design.", rel="tdmpc2,dreamerv3")
P("pwm","PWM: Policy Learning with Multi-Task World Models",
  a="Ignat Georgiev; Varun Giridhar; Nicklas Hansen; Animesh Garg",
  inst="Georgia Tech; UC San Diego", v="ICLR", vt="conference", y=2025, d="2024-07-02",
  br="model-based", top="differentiable world models, multi-task control", par="model-based RL",
  arx="2407.02466", st=1, note="First-order gradients through a learned smooth model — relevant if you want "
  "the residual-physics world model to be differentiable end to end.", rel="tdmpc2,dreamerv3", id_="wm-residual")

# ---------------------------------------------------------------- sim2real
P("domain-rand","Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World",
  a="Josh Tobin; Rachel Fong; Alex Ray; Jonas Schneider; Wojciech Zaremba; Pieter Abbeel",
  inst="OpenAI; UC Berkeley", v="IROS", vt="conference", y=2017, d="2017-03-20", br="sim2real",
  top="domain randomization, sim-to-real", par="RL", arx="1703.06907", st=3,
  note="The original 'randomize until reality looks like just another sample' argument. Still the first thing "
       "to try, and still insufficient on its own for contact-rich or deformable tasks.",
  rel="dactyl,rma,asap", id_="soft-sim2real,real2sim2real-ego")
P("asap","ASAP: Aligning Simulation and Real-World Physics for Learning Agile Humanoid Whole-Body Skills",
  a="Tairan He; Jiawei Gao; Wenli Xiao; Yuanhang Zhang; Zi Wang; Jiashun Wang; Zhengyi Luo; Guanya Shi; et al.",
  corr="Tairan He", inst="Carnegie Mellon University; NVIDIA", lab="CMU LeCAR Lab",
  v="RSS", vt="conference", y=2025, d="2025-02-03", br="sim2real",
  top="sim-to-real, delta action model, agile humanoid skills", par="RL",
  meth="learn a residual 'delta action' model from real rollouts, fine-tune the policy against it",
  arx="2502.01143", st=3,
  note="In your library. The cleanest modern take on closing the dynamics gap: collect real rollouts, learn a "
       "delta-action correction, retrain in the corrected sim. This is residual physics applied to sim-to-real, "
       "and it is the template for your residual world-model idea.",
  rel="rma,domain-rand,wm-residual-ref,deepmimic", pr="mabel", id_="wm-residual,real2sim2real-ego")
P("real2sim","Real2Sim2Real: Self-Supervised Learning of Physical Single-Step Dynamic Actions for Planar Robot Casting",
  a="Vincent Lim; Huang Huang; Lawrence Yunliang Chen; Jonathan Wang; Jeffrey Ichnowski; Daniel Seita; Michael Laskey; Ken Goldberg",
  inst="UC Berkeley", lab="AUTOLAB", v="ICRA", vt="conference", y=2022, d="2021-11-08",
  br="sim2real", top="real2sim2real, dynamics identification, deformables", par="RL, sim2real",
  arx="2111.04814", st=2, note="An explicit real2sim2real loop on a deformable (a cable). Useful precedent for "
  "both the real2sim2real idea and the soft-object sim-to-real gap.",
  rel="asap,videomimic,soft-ref", id_="real2sim2real-ego,soft-sim2real")

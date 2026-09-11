# -*- coding: utf-8 -*-
"""Curated Hardware & Systems tree."""
ROWS = []
def P(id, title, **k):
    k["id"] = id; k["title"] = title; k["tree"] = "systems"; ROWS.append(k)

# ---------------------------------------------------------------- open-source arms & bimanual
P("aloha","ALOHA: A Low-cost Open-source Hardware System for Bimanual Teleoperation",
  a="Tony Z. Zhao; Vikash Kumar; Sergey Levine; Chelsea Finn", corr="Tony Z. Zhao",
  inst="Stanford University", lab="Stanford IRIS Lab", v="RSS", vt="conference", y=2023, d="2023-04-23",
  br="bimanual", top="open hardware, bimanual teleoperation, low cost", par="hardware",
  meth="leader-follower joint-space teleoperation with ViperX/WidowX arms, ~$20k BOM",
  arx="2304.13705", site="https://tonyzhaozh.github.io/aloha/", st=3,
  note="The hardware half of the ACT paper, and arguably the more consequential half. Direct joint-space "
       "leader-follower with no force feedback turned out to be enough for fine bimanual work, and the $20k "
       "price point put it in reach of most labs. Every bimanual platform below is responding to it.",
  rel="act,aloha2,mobile-aloha,so100,gello,openpyro", pr="mabel,iris")
P("aloha2","ALOHA 2: An Enhanced Low-Cost Hardware for Bimanual Teleoperation",
  a="ALOHA 2 Team; Jorge Aldaco; Travis Armstrong; Robert Baruch; Jeff Bingham; et al.",
  inst="Google DeepMind", lab="DeepMind Robotics", v="arXiv", vt="preprint", y=2024, d="2024-05-03",
  br="bimanual", top="open hardware, improved ergonomics, MuJoCo model", par="hardware",
  arx="2405.02292", st=2, note="Better grippers, gravity compensation, a validated MuJoCo model. The MuJoCo "
  "model is the underrated part — it makes the platform simulatable rather than just buildable.",
  rel="aloha,alohaunleashed,mobile-aloha", pr="mabel")
P("mobile-aloha","Mobile ALOHA: Learning Bimanual Mobile Manipulation with Low-Cost Whole-Body Teleoperation",
  a="Zipeng Fu; Tony Z. Zhao; Chelsea Finn", corr="Zipeng Fu", inst="Stanford University",
  lab="Stanford IRIS Lab", v="CoRL", vt="conference", y=2024, d="2024-01-04", br="bimanual",
  top="mobile bimanual manipulation, whole-body teleoperation", par="hardware, IL",
  meth="ALOHA arms on a wheeled base, operator physically tethered for base control; co-train with static data",
  arx="2401.02117", site="https://mobile-aloha.github.io/", st=3,
  note="You named this one. Two results matter: the tether-style whole-body teleop rig, and the finding that "
       "co-training with static ALOHA data lifts mobile task success by up to 90%. The co-training result is "
       "the one that generalizes to MABEL.",
  rel="aloha,aloha2,tidybot2,umi,act", pr="mabel", id_="mobile-dex-umi")
P("so100","LeRobot / SO-100 & SO-101: Standard Open Arm",
  a="Rémi Cadène; Simon Alibert; Alexander Soare; Quentin Gallouédec; Adil Zouitine; Thomas Wolf; The Robot Studio",
  inst="Hugging Face; The Robot Studio", lab="Hugging Face LeRobot", v="open hardware", vt="software",
  y=2024, code="https://github.com/huggingface/lerobot", br="bimanual",
  top="ultra-low-cost arm, open source, community", par="hardware", st=3,
  note="A ~$120 printable 5-DOF arm with a maintained learning stack behind it. The cost floor dropped by two "
       "orders of magnitude from ALOHA, which changes who can run experiments at all. SO-101 fixes the wiring "
       "and assembly pain of SO-100.",
  rel="aloha,koch,gello,lerobot-data", pr="mabel,geodex", id_="hand-22dof")
P("koch","Koch v1.1 Low-Cost Robot Arm",
  a="Alexander Koch; Jess Moss; Rémi Cadène", inst="community; Hugging Face",
  v="open hardware", vt="software", y=2024, br="bimanual",
  top="low-cost arm, leader-follower", par="hardware",
  code="https://github.com/jess-moss/koch-v1-1", st=1,
  note="The direct predecessor of SO-100 in the LeRobot ecosystem. Historical value mostly.", rel="so100,aloha")
P("gello","GELLO: A General, Low-Cost, and Intuitive Teleoperation Framework for Robot Manipulators",
  a="Philipp Wu; Yide Shentu; Zhongke Yi; Xingyu Lin; Pieter Abbeel", corr="Philipp Wu",
  inst="UC Berkeley", lab="BAIR", v="IROS", vt="conference", y=2024, d="2023-09-24", br="bimanual",
  top="kinematic-twin teleoperation, low cost", par="hardware, teleop",
  meth="3D-printed scaled kinematic replica with encoders as the leader device", arx="2309.13037", st=3,
  note="In your CRV_iris/imitation folder. A $300 printed kinematic twin beats VR and spacemouse on both "
       "success rate and operator preference. If you build a leader device for MABEL, start here.",
  rel="aloha,open-television,umi,so100", pr="mabel,iris")
P("openpyro","OpenPyRo-A1: An Open Python-Based Low-Cost Bimanual Robot for Embodied AI",
  a="(see PDF)", inst="", v="IEEE RA-L", vt="journal", y=2026, d="2026-01-01", br="bimanual",
  top="open bimanual hardware, Python stack", par="hardware", st=2,
  note="In your MABEL hardware folder. Recent RA-L open bimanual platform — useful as a design and BOM "
       "comparison point for MABEL.", rel="aloha,so100,mabel-ref", pr="mabel")

# ---------------------------------------------------------------- mobile manipulation
P("tidybot","TidyBot: Personalized Robot Assistance with Large Language Models",
  a="Jimmy Wu; Rika Antonova; Adam Kan; Marion Lepert; Andy Zeng; Shuran Song; Jeannette Bohg; Szymon Rusinkiewicz; Thomas Funkhouser",
  corr="Jimmy Wu", inst="Princeton University; Stanford University; Columbia University; Google",
  lab="Princeton Vision & Robotics", v="IROS", vt="conference", y=2023, d="2023-05-09",
  br="mobile-manip", top="personalization, LLM summarization, household tidying", par="LLM, system",
  arx="2305.05658", st=2,
  note="LLMs used for the narrow, correct thing: summarizing a handful of user examples into a generalizable "
       "preference rule ('light clothes in the drawer'). Not a manipulation advance; a personalization one.",
  rel="tidybot2,homer,behavior-robot-suite")
P("tidybot2","TidyBot++: An Open-Source Holonomic Mobile Manipulator for Robot Learning",
  a="Jimmy Wu; William Chong; Robert Holmberg; Aaditya Prasad; Yihuai Gao; Oussama Khatib; Shuran Song; Szymon Rusinkiewicz; Jeannette Bohg",
  corr="Jimmy Wu", inst="Princeton University; Stanford University", lab="Princeton / Stanford IPRL",
  v="CoRL", vt="conference", y=2025, d="2024-12-16", br="mobile-manip",
  top="holonomic base, open hardware, mobile manipulation", par="hardware",
  meth="powered-caster holonomic drive, ~$6k base, phone-based whole-body teleop interface",
  arx="2412.10447", site="https://tidybot2.github.io/", st=3,
  note="You named this one. The powered-caster holonomic base is the design lesson for MABEL: full planar "
       "mobility without a swerve module's complexity, and a base that can be driven during demonstration "
       "collection rather than parked. The phone-as-teleop-interface trick is worth stealing outright.",
  rel="tidybot,mobile-aloha,homer,umi-on-legs,yor", pr="mabel,m2", id_="mobile-dex-umi")
P("homer","HoMeR: Learning In-the-Wild Mobile Manipulation via Hybrid Imitation and Whole-Body Control",
  a="Priya Sundaresan; Rhea Malhotra; Phoebe Miller; Jiaming Hu; Jeannette Bohg; Dorsa Sadigh",
  inst="Stanford University", lab="Stanford IRIS / IPRL", v="arXiv", vt="preprint", y=2025,
  d="2025-06-02", br="mobile-manip", top="hybrid imitation, whole-body control, in-the-wild", par="IL",
  arx="2506.01185", st=2, note="Hybrid action space — keypose for the coarse motion, dense for the "
  "contact-rich part. A sensible answer to 'the base and the arm want different action representations'.",
  rel="tidybot2,mobile-aloha,behavior-robot-suite", pr="mabel")
P("behavior-robot-suite","BEHAVIOR Robot Suite: Streamlining Real-World Whole-Body Manipulation for Everyday Household Activities",
  a="Yunfan Jiang; Ruohan Zhang; Josiah Wong; Chen Wang; Yanjie Ze; Hang Yin; Cem Gokmen; Shuran Song; Jiajun Wu; Li Fei-Fei",
  inst="Stanford University", lab="Stanford Vision & Learning (SVL)", v="CoRL", vt="conference",
  y=2025, d="2025-03-07", br="mobile-manip", top="whole-body manipulation, household benchmark, open platform",
  par="hardware, IL", arx="2503.05652", st=3,
  note="In your MABEL hardware folder. Identifies the three capabilities household tasks actually need — "
       "bimanual coordination, stable navigation, extensive reach — and builds the platform (JoyLo interface "
       "+ WB-VIMA policy) around them. The capability decomposition is the useful part for MABEL's spec.",
  rel="tidybot2,mobile-aloha,homer,mabel-ref", pr="mabel")
P("yor","YOR: Your Own Mobile Manipulator for Generalizable Robotics",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-02-11", br="mobile-manip",
  top="open mobile manipulator, reproducibility", par="hardware", arx="2602.11150", st=2,
  note="From your M2 humanoid_platforms folder (also in your pdf2web data). Recent open mobile manipulator — "
       "compare its BOM against TidyBot++ before committing MABEL's base design.",
  rel="tidybot2,behavior-robot-suite", pr="m2,mabel")
P("stretch","Stretch: A Mobile Manipulator for Home Environments",
  a="Charles C. Kemp; Aaron Edsinger; Henry M. Clever; Blaine Matulevich", inst="Hello Robot",
  lab="Hello Robot", v="ICRA", vt="conference", y=2022, d="2021-09-21", br="mobile-manip",
  top="commercial mobile manipulator, home robotics", par="hardware", arx="2109.10892", st=2,
  note="In your MABEL hardware folder. The lightweight telescoping-arm design point — very different "
       "tradeoff from a bimanual humanoid, and the one most home-robotics research actually runs on.",
  rel="tidybot2,homer", pr="mabel")

# ---------------------------------------------------------------- data-collection interfaces
P("umi","Universal Manipulation Interface: In-The-Wild Robot Teaching Without In-The-Wild Robots",
  a="Cheng Chi; Zhenjia Xu; Chuer Pan; Eric Cousineau; Benjamin Burchfiel; Siyuan Feng; Russ Tedrake; Shuran Song",
  corr="Cheng Chi; Shuran Song", inst="Stanford University; Columbia University; Toyota Research Institute",
  lab="Stanford REALab (Shuran Song)", v="RSS", vt="conference", y=2024, d="2024-02-15",
  br="interfaces", top="handheld gripper, in-the-wild data, embodiment-agnostic capture", par="hardware, IL",
  meth="handheld gripper + fisheye GoPro, IMU-aware pose tracking, latency-matched inference",
  arx="2402.10329", site="https://umi-gripper.github.io/",
  code="https://github.com/real-stanford/universal_manipulation_interface", st=3,
  note="The interface your UMI catalogue is about and the backbone of several of your research ideas. The "
       "core claim — that you can collect deployable demonstrations with no robot present — holds because of "
       "unglamorous engineering: side mirrors for implicit stereo, an IMU-aware SLAM pipeline, and explicit "
       "inference-latency matching. Read the hardware section, not just the method.",
  rel="umi-on-legs,fast-umi,dexumi,ume,dexcap,dp,tidybot2,open-aoe",
  pr="mabel,geodex", id_="wam-umi-gloves,mobile-dex-umi,ego-dex")
P("umi-on-legs","UMI on Legs: Making Manipulation Policies Mobile with Manipulation-Centric Whole-body Controllers",
  a="Huy Ha; Yihuai Gao; Zipeng Fu; Jie Tan; Shuran Song", corr="Huy Ha",
  inst="Stanford University; Google DeepMind", lab="Stanford REALab", v="CoRL", vt="conference",
  y=2024, d="2024-07-15", br="interfaces", top="mobile manipulation, whole-body controller, UMI", par="hardware, RL, IL",
  meth="task-frame end-effector trajectory as the interface between a UMI policy and an RL whole-body controller",
  arx="2407.10353", st=3,
  note="The clean decomposition: the manipulation policy speaks end-effector trajectories in the task frame, "
       "and an RL whole-body controller figures out how to deliver them. That interface is exactly what a "
       "mobile dexterous UMI on MABEL would need.",
  rel="umi,tidybot2,falcon,mobile-aloha", pr="mabel", id_="mobile-dex-umi,wam-umi-gloves")
P("fast-umi","Fast-UMI: A Scalable and Hardware-Independent Universal Manipulation Interface",
  a="Ziniu Wu; Tianyu Wang; Zhaxizhuoma; Chuyue Guan; Zhongjie Jia; Shuai Liang; et al.",
  inst="Shanghai AI Laboratory", v="arXiv", vt="preprint", y=2024, d="2024-09-29", br="interfaces",
  top="UMI variant, hardware independence, tracking", par="hardware",
  arx="2409.19499", st=2, note="Replaces UMI's SLAM pipeline with an off-the-shelf tracker to cut calibration "
  "pain. Relevant if you want capture that a non-expert can run.", rel="umi,dexumi,ume")
P("dexumi","DexUMI: Using Human Hand as the Universal Manipulation Interface for Dexterous Manipulation",
  a="Mengda Xu; Han Zhang; Yifan Hou; Zhenjia Xu; Linxi Fan; Manuela Veloso; Shuran Song",
  corr="Mengda Xu; Shuran Song", inst="Stanford University; Columbia University; NVIDIA; JP Morgan AI Research",
  lab="Stanford REALab", v="CoRL", vt="conference", y=2025, d="2025-05-27", br="interfaces",
  top="dexterous UMI, wearable exoskeleton, hand embodiment gap", par="hardware, IL",
  meth="wearable hand exoskeleton as the adapter + software inpainting of the human hand into robot pixels",
  arx="2505.21864", site="https://dex-umi.github.io/", st=3,
  note="In your library twice (Gloves/ and the CoRL 2025 folder). This is the paper standing between you and "
       "the 'custom dexterous UMI' idea — read its two-part gap-closing strategy (hardware exoskeleton for "
       "kinematics, video inpainting for appearance) and decide what you would do differently.",
  rel="umi,ume,dexcap,doglove,phantom,ruka", pr="geodex,mabel", id_="mobile-dex-umi,wam-umi-gloves,ego-dex")
P("ume","Universal Manipulation Exoskeleton: Learning Compliant Whole-Body Manipulation",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-06-14", br="interfaces",
  top="exoskeleton capture, compliant whole-body manipulation", par="hardware, IL", arx="2606.14218", st=3,
  note="You named this one — it is in your M2 humanoid_platforms and mobile_bimanual_platforms folders. "
       "Exoskeleton-based whole-body capture with compliance, i.e. the force half that UMI leaves out.",
  rel="umi,dexumi,airexo,ume-vs-umi", pr="m2,mabel", id_="mobile-dex-umi,wam-umi-gloves")
P("dexcap","DexCap: Scalable and Portable Mocap Data Collection System for Dexterous Manipulation",
  a="Chen Wang; Haochen Shi; Weizhuo Wang; Ruohan Zhang; Li Fei-Fei; C. Karen Liu",
  corr="Chen Wang", inst="Stanford University", lab="Stanford Vision & Learning (SVL)",
  v="RSS", vt="conference", y=2024, d="2024-03-12", br="interfaces",
  top="portable mocap, glove capture, dexterous data", par="hardware, IL",
  meth="Rokoko glove + LiDAR + SLAM chest rig; human-in-the-loop correction during deployment",
  arx="2403.07788", st=3,
  note="In your library twice (Gloves/ and Dexterous Manipulation Sim-to-real/). The portable glove+SLAM rig "
       "is the most direct hardware precedent for 'world-action model from UMI gloves'. Its residual "
       "correction mechanism is also worth noting — human fixes at deployment time, folded back into training.",
  rel="dexumi,doglove,umi,videodex,ruka", pr="geodex", id_="wam-umi-gloves,ego-dex")
P("doglove","DOGlove: Dexterous Manipulation with a Low-Cost Open-Source Haptic Force Feedback Glove",
  a="Han Zhang; Songbo Hu; Zhecheng Yuan; Huazhe Xu", inst="Tsinghua University; Shanghai Qi Zhi Institute",
  v="RSS", vt="conference", y=2025, d="2025-02-11", br="interfaces",
  top="haptic glove, force feedback, open source", par="hardware, teleop",
  meth="~$600 glove with 21-DOF tracking and 5-finger force feedback", arx="2502.07730", st=3,
  note="In your Gloves/ folder. Force feedback at $600 changes what glove teleop can collect — you get "
       "contact-aware demonstrations rather than free-space ones. Relevant to both the 22-DOF hand and the "
       "tactile-world-model ideas.",
  rel="dexcap,dexumi,ruka,orca-hand", pr="geodex", id_="hand-22dof,tactile-wm,wam-umi-gloves")
P("airexo","AirExo-2: Scaling up Generalizable Robotic Imitation Learning with Low-Cost Exoskeletons",
  a="Hongjie Fang; Chenxi Wang; Yiming Wang; Jingjing Chen; Shangning Xia; Jun Lv; Hao-Shu Fang; Cewu Lu",
  inst="Shanghai Jiao Tong University", lab="SJTU MVIG (Cewu Lu)", v="CoRL", vt="conference",
  y=2025, d="2025-03-05", br="interfaces", top="low-cost exoskeleton, in-the-wild demonstrations", par="hardware, IL",
  arx="2503.03081", st=2, note="Exoskeleton capture that transfers without robot data. The main competitor "
  "framing for UME.", rel="ume,dexumi,umi", pr="mabel")
P("bunny-visionpro","Bunny-VisionPro: Real-Time Bimanual Dexterous Teleoperation for Imitation Learning",
  a="Runyu Ding; Yuzhe Qin; Jiyue Zhu; Chengzhe Jia; Shiqi Yang; Ruihan Yang; Xiaojuan Qi; Xiaolong Wang",
  inst="HKU; UC San Diego", lab="UCSD Xiaolong Wang Lab", v="arXiv", vt="preprint", y=2024,
  d="2024-07-04", br="interfaces", top="Vision Pro teleoperation, haptic feedback", par="teleop",
  arx="2407.03162", st=2, note="Apple Vision Pro as a bimanual dexterous teleop device with haptic cues. "
  "Relevant given your visionOS app work in the MABEL repo.", rel="open-television,anyteleop,doglove", pr="mabel")
P("lucid-xr","Lucid-XR: An Extended-Reality Data Engine for Robotic Manipulation",
  a="Yajvan Ravan; Adam Rashid; Alan Yu; Kai McClennen; et al.", inst="MIT; UC Berkeley",
  v="CoRL", vt="conference", y=2025, br="interfaces", top="XR data engine, synthetic demonstrations", par="hardware, IL",
  st=2, note="From your CoRL 2025 folder. XR as a demonstration *generator* rather than just a controller.",
  rel="bunny-visionpro,open-television,lucid-skill")
P("modpack","ModPack: An Extensible Teleoperation Interface for Bimanual Manipulation",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-07-19", br="interfaces",
  top="modular teleop interface, bimanual", par="teleop", arx="2607.19479", st=1,
  note="From your M2 library. Modular teleop hardware — a build reference for MABEL.", rel="gello,open-television", pr="m2,mabel")
P("egosteer","EgoSteer: A Full-Stack System Towards Steerable Dexterous Manipulation",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-07-09", br="interfaces",
  top="egocentric steering, dexterous manipulation system", par="system", arx="2607.09701", st=2,
  note="From your M2 humanoid_platforms folder. Full-stack egocentric dexterity — a close neighbour of your "
       "ego-dexterity idea.", rel="dexumi,egomimic,do-as-i-do", pr="m2,geodex", id_="ego-dex")

# ---------------------------------------------------------------- dexterous hands
P("shadow-hand","The Shadow Dexterous Hand",
  a="Shadow Robot Company", inst="Shadow Robot Company", v="commercial", vt="industry", y=2005,
  br="hands", top="anthropomorphic hand, tendon driven, 24 DOF", par="hardware", st=2,
  note="The 20-actuator, 24-DOF reference hand that Dactyl and a decade of dexterity research ran on. "
       "Historically important, practically unaffordable — which is why everything below exists.",
  rel="dactyl,allegro,leap-hand,dlr-hand")
P("allegro","Allegro Hand",
  a="Wonik Robotics", inst="Wonik Robotics", v="commercial", vt="industry", y=2012, br="hands",
  top="four-finger hand, direct drive, research platform", par="hardware", st=2,
  note="The 16-DOF workhorse of RL dexterity papers (Qi, Chen, DeXtreme). Robust, backdrivable enough, and "
       "cheap relative to Shadow.", rel="shadow-hand,leap-hand,qi-inhand", pr="geodex")
P("leap-hand","LEAP Hand: Low-Cost, Efficient, and Anthropomorphic Hand for Robot Learning",
  a="Kenneth Shaw; Ananye Agarwal; Deepak Pathak", corr="Kenneth Shaw",
  inst="Carnegie Mellon University", lab="CMU Pathak Lab", v="RSS", vt="conference", y=2023,
  d="2023-09-12", br="hands", top="low-cost hand, open source, anthropomorphic", par="hardware",
  meth="novel MCP joint kinematics giving universal abduction, ~$2000 printable BOM", arx="2309.06440",
  site="https://leaphand.com/", st=3,
  note="The hand that made dexterity research affordable. The kinematic contribution is real — the MCP "
       "design keeps the fingers dexterous in every pose, which the cheap serial-chain alternatives do not. "
       "Start here for the 22-DOF open hand idea and note what LEAP deliberately gives up (no tendons, no "
       "wrist, limited fingertip force).",
  rel="orca-hand,ruka,leap-v2,dlr-hand,shadow-hand,videodex", pr="geodex", id_="hand-22dof")
P("orca-hand","ORCA: An Open-Source, Reliable, Cost-Effective, Anthropomorphic Robotic Hand",
  a="Clemens Schwarke; Victor Klemm; Jesus Tordesillas; Jean-Pierre Sleiman; Marco Hutter; et al.",
  inst="ETH Zürich", lab="ETH RSL", v="arXiv", vt="preprint", y=2025, d="2025-04-30", br="hands",
  top="open-source tendon hand, 17 DOF, reliability", par="hardware",
  arx="2504.21205", site="https://www.orcahand.com/", st=3,
  note="In your Robot Hands/ folder and your M2 library. Tendon-driven, 17 DOF, ~$2k, and explicitly "
       "engineered for reliability and repairability rather than peak spec. The closest existing reference "
       "design for your 22-DOF open hand — read its tendon routing and maintenance sections carefully.",
  rel="leap-hand,ruka,dlr-hand,doglove", pr="geodex", id_="hand-22dof")
P("ruka","RUKA: Rethinking the Design of Humanoid Hands with Learning",
  a="Anya Zorin; Irmak Guzey; Billy Yan; Aadhithya Iyer; Lisa Kondrich; Nikhil X. Bhattasali; Lerrel Pinto",
  corr="Anya Zorin", inst="New York University", lab="NYU General-Purpose Robotics Lab (Lerrel Pinto)",
  v="CoRL", vt="conference", y=2025, d="2025-04-17", br="hands",
  top="tendon-driven hand, learned kinematics, low cost", par="hardware, IL",
  meth="learn the tendon-to-joint map from MANUS glove data instead of modelling it analytically",
  arx="2504.13165", site="https://ruka-hand.github.io/", st=3,
  note="In your Robot Hands/ folder. The key move for your 22-DOF idea: stop trying to analytically model "
       "tendon coupling and just *learn* the motor-to-joint map from data. That removes the hardest part of "
       "building a high-DOF tendon hand. NYU lab — relevant to your PhD context.",
  rel="orca-hand,leap-hand,dexumi,dexcap", pr="geodex", id_="hand-22dof,learned-retargeting")
P("dlr-hand","The DLR Hand Arm System",
  a="Markus Grebenstein; Alin Albu-Schäffer; Thomas Bahls; Maxime Chalon; Oliver Eiberger; Werner Friedl; et al.",
  corr="Markus Grebenstein", inst="DLR", lab="DLR Institute of Robotics and Mechatronics",
  v="ICRA", vt="conference", y=2011, br="hands", top="variable stiffness, robust hand-arm, biomimetic", par="hardware",
  st=2, note="In your Robot Hands/ folder. The variable-stiffness, impact-tolerant design philosophy — a "
             "different axis from DOF count, and the one cheap hands most obviously lack.",
  rel="shadow-hand,orca-hand,midas-hand", pr="geodex", id_="hand-22dof")
P("dexwrist","DexWrist: A Robotic Wrist for Constrained and Dynamic Manipulation",
  a="Martin Peticco; Gabriella Ulloa; John Marangola; Pulkit Agrawal",
  inst="MIT", lab="MIT Improbable AI Lab", v="arXiv", vt="preprint", y=2025, br="hands",
  top="robotic wrist, dynamic manipulation, backdrivability", par="hardware", st=2,
  note="In your Bionic Hand Motor/ folder. The wrist is the joint everyone under-designs; this one is built "
       "for dynamic, constrained motion. Worth reading alongside the 22-DOF hand plan.",
  rel="orca-hand,leap-hand,midas-hand", pr="geodex", id_="hand-22dof")
P("midas-hand","MIDAS Hand: Modular Low-Impedance Direct-Drive Anthropomorphic Hand",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-07-14", br="hands",
  top="direct-drive hand, low impedance, modular", par="hardware", arx="2607.14487", st=2,
  note="From your M2 library. Direct-drive is the opposite bet from tendons — worse packing, far better "
       "force transparency. The relevant tradeoff study for your hand design.",
  rel="orca-hand,ruka,dlr-hand", pr="m2,geodex", id_="hand-22dof")
P("1x-hand","1X Redwood Hand / NEO",
  a="1X Technologies", inst="1X Technologies", lab="1X", v="industry", vt="industry", y=2025,
  br="hands", top="tendon-driven humanoid hand, high DOF, home robot", par="hardware",
  site="https://www.1x.tech/", st=2,
  note="You named this as the model for your 22-DOF hand. Industry, so specs are announcements rather than "
       "reviewed results — but the tendon-driven, high-DOF, soft-covered direction is the one to copy. "
       "Verify DOF counts against a current source before citing.",
  rel="ruka,orca-hand,dlr-hand", pr="geodex", id_="hand-22dof")
P("pds-joint","PDS-Joint: A Parametric Double Spiral Joint Tailored for Dexterous Hands",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-06-24", br="hands",
  top="joint mechanism, dexterous hand design", par="hardware", arx="2606.24377", st=1,
  note="From your M2 library. Mechanism-level design detail for high-DOF hands.", rel="midas-hand,orca-hand", pr="m2", id_="hand-22dof")

# ---------------------------------------------------------------- tactile
P("gelsight","GelSight: High-Resolution Robot Tactile Sensors for Estimating Geometry and Force",
  a="Wenzhen Yuan; Siyuan Dong; Edward H. Adelson", corr="Wenzhen Yuan",
  inst="MIT", lab="MIT CSAIL / Adelson Lab", v="Sensors", vt="journal", y=2017, d="2017-11-29",
  br="tactile-hw", top="vision-based tactile sensing, geometry, force", par="hardware",
  doi="10.3390/s17122762", st=3,
  note="The sensor that made tactile sensing a computer-vision problem — elastomer + camera + photometric "
       "stereo gives you sub-millimetre geometry. Every vision-based skin below descends from it.",
  rel="digit,anyskin,dexskin,gelslim", pr="geodex", id_="tactile-wm")
P("digit","DIGIT: A Novel Design for a Low-Cost Compact High-Resolution Tactile Sensor",
  a="Mike Lambeta; Po-Wei Chou; Stephen Tian; Brian Yang; Benjamin Maloon; Victoria Rose Most; et al.",
  corr="Mike Lambeta", inst="Meta AI", lab="FAIR", v="IEEE RA-L", vt="journal", y=2020,
  d="2020-05-24", br="tactile-hw", top="compact tactile sensor, open hardware", par="hardware",
  arx="2005.14679", st=2, note="GelSight shrunk to fingertip scale and open-sourced. The default fingertip "
  "sensor for multi-finger hands.", rel="gelsight,anyskin,dexskin", pr="geodex", id_="tactile-wm")
P("anyskin","AnySkin: Plug-and-play Skin Sensing for Robotic Touch",
  a="Raunaq Bhirangi; Venkatesh Pattabiraman; Enes Erciyes; Yifeng Cao; Tess Hellebrekers; Lerrel Pinto",
  corr="Raunaq Bhirangi", inst="New York University; Meta AI", lab="NYU GRAIL (Lerrel Pinto)",
  v="arXiv", vt="preprint", y=2024, d="2024-09-12", br="tactile-hw",
  top="magnetic skin, replaceable, cross-instance generalization", par="hardware",
  arx="2409.08276", st=3,
  note="Magnetic rather than optical, and — the actual contribution — *replaceable without recalibration*, "
       "so policies transfer across sensor instances. That is the property that makes tactile learning "
       "reproducible. NYU lab, relevant to you.",
  rel="reskin,digit,dexskin,gelsight", pr="geodex", id_="tactile-wm")
P("reskin","ReSkin: Versatile, Replaceable, Lasting Tactile Skins",
  a="Raunaq Bhirangi; Tess Hellebrekers; Carmel Majidi; Abhinav Gupta",
  inst="Carnegie Mellon University; Meta AI", v="CoRL", vt="conference", y=2021, d="2021-11-01",
  br="tactile-hw", top="magnetic skin, durability", par="hardware", arx="2111.00071", st=2,
  note="AnySkin's predecessor — elastomer with embedded magnetic particles.", rel="anyskin,digit", id_="tactile-wm")
P("dexskin","DexSkin: High-Coverage Conformable Robotic Skin for Learning Contact-Rich Manipulation",
  a="Suzannah Wistreich; Baiyu Shi; Stephen Tian; Samuel Clarke; Jiajun Wu; et al.",
  inst="Stanford University", lab="Stanford Vision & Learning", v="CoRL", vt="conference", y=2025,
  br="tactile-hw", top="conformable skin, high coverage, contact-rich learning", par="hardware, IL",
  st=3, note="From your CoRL 2025 folder. High-coverage conformable skin — the missing piece for a tactile "
             "world model, because fingertip-only sensing misses most of the contact that matters.",
  rel="anyskin,gelsight,rotate-without-seeing,robotacdex", pr="geodex", id_="tactile-wm")
P("robotacdex","RoboTacDex: A Dexterous Visual-Tactile Action Dataset for Humanoid Manipulation",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-06-31", br="tactile-hw",
  top="visual-tactile dataset, humanoid manipulation", par="dataset", arx="2606.31836", st=2,
  note="From your M2 library. A paired visual-tactile dataset is precisely what a tactile world model needs "
       "for pretraining.", rel="dexskin,anyskin,tactile-wm-ref", pr="m2,geodex", id_="tactile-wm")
P("omnitactune","OmniTacTune: Policy-Agnostic Real-World RL for Tactile Residual Learning",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-07-03", br="tactile-hw",
  top="tactile residual RL, real-world fine-tuning", par="RL", arx="2607.03723", st=2,
  note="From your M2 library. Tactile residual RL on top of an existing policy — the tactile version of your "
       "residual-world-model idea.", rel="dexskin,hil-serl,wm-residual-ref", pr="m2,geodex", id_="tactile-wm,rl-post-training")

# ---------------------------------------------------------------- humanoid & legged platforms
P("berkeley-humanoid","Berkeley Humanoid: A Research Platform for Learning-based Control",
  a="Qiayuan Liao; Bike Zhang; Xuanyu Huang; Xiaoyu Huang; Zhongyu Li; Koushil Sreenath",
  corr="Qiayuan Liao", inst="UC Berkeley", lab="Hybrid Robotics Lab (Sreenath)", v="arXiv", vt="preprint",
  y=2024, d="2024-07-31", br="humanoid-hw", top="research humanoid, learning-based control, open design", par="hardware",
  arx="2407.21781", st=2, note="In your MABEL hardware folder. A mid-scale humanoid designed around the "
  "requirements of RL rather than around classical control — low reflected inertia, good sim fidelity.",
  rel="berkeley-humanoid-lite,unitree-g1,toddlerbot", pr="mabel")
P("berkeley-humanoid-lite","Berkeley Humanoid Lite: An Open-source, Accessible, and Customizable 3D-printed Humanoid Robot",
  a="Yufeng Chi; Qiayuan Liao; Junfeng Long; Xiaoyu Huang; Zhongyu Li; Koushil Sreenath",
  inst="UC Berkeley", lab="Hybrid Robotics Lab", v="arXiv", vt="preprint", y=2025, d="2025-04-24",
  br="humanoid-hw", top="3D-printed humanoid, open source, accessibility", par="hardware",
  arx="2504.17249", st=2, note="In your MABEL hardware folder. Fully printable, ~$5k. The modular "
  "3D-printed cycloidal gearbox is the interesting mechanical contribution.",
  rel="berkeley-humanoid,toddlerbot,so100", pr="mabel", id_="codesign-dog-rl")
P("toddlerbot","ToddlerBot: Open-Source ML-Compatible Humanoid Platform for Loco-Manipulation",
  a="Haochen Shi; Weizhuo Wang; Shuran Song; C. Karen Liu", corr="Haochen Shi",
  inst="Stanford University", lab="Stanford SVL / REALab", v="arXiv", vt="preprint", y=2025,
  d="2025-02-02", br="humanoid-hw", top="small humanoid, open source, loco-manipulation", par="hardware",
  arx="2502.00893", st=2, note="Small, cheap, repairable, and explicitly built so that the sim model matches "
  "the hardware. The sim-fidelity-first design argument is worth reading for MABEL.",
  rel="berkeley-humanoid-lite,mabel-ref", pr="mabel")
P("disney-bdx","Design and Control of a Bipedal Robotic Character",
  a="Ruben Grandia; Espen Knoop; Michael A. Hopkins; Georg Wiedebach; Jared Bishop; Steven Pickles; David Müller; Moritz Bächer",
  corr="Ruben Grandia", inst="Disney Research", lab="Disney Research Zurich", v="RSS", vt="conference",
  y=2024, br="humanoid-hw", top="robotic character, expressive motion, bipedal design", par="hardware, RL",
  st=3, note="In your MABEL hardware and CRV_iris folders. The BD-X droid — the best existing example of "
             "combining stylized, expressive motion with real bipedal robustness. Relevant to MABEL's "
             "presence/character dimension, which most research platforms ignore entirely.",
  rel="deepmimic,amp,berkeley-humanoid", pr="mabel,iris")
P("unitree-g1","Unitree G1 / H1 Humanoid Platforms",
  a="Unitree Robotics", inst="Unitree Robotics", v="commercial", vt="industry", y=2024, br="humanoid-hw",
  top="commercial humanoid, low cost, research platform", par="hardware",
  site="https://www.unitree.com/g1", st=2,
  note="The platform most 2024-26 humanoid learning papers in this library actually run on. Worth tracking "
       "because it sets the de-facto hardware assumptions of the field.",
  rel="berkeley-humanoid,hover,asap,groot-n1", pr="mabel")
P("mit-cheetah","MIT Mini Cheetah: A Platform for Pushing the Limits of Dynamic Quadruped Control",
  a="Benjamin Katz; Jared Di Carlo; Sangbae Kim", corr="Benjamin Katz", inst="MIT",
  lab="MIT Biomimetic Robotics Lab", v="ICRA", vt="conference", y=2019, br="humanoid-hw",
  top="proprioceptive actuation, dynamic quadruped, low cost", par="hardware", st=3,
  note="The proprioceptive-actuator argument — high torque density, low gear ratio, backdrivable — that made "
       "cheap dynamic legged robots possible. The single most important hardware reference for the "
       "co-design-a-fast-dog idea.",
  rel="anymal-hwangbo,codesign-dog-ref,unitree-g1", id_="codesign-dog-rl")

# ---------------------------------------------------------------- co-design
P("robogrammar","RoboGrammar: Graph Grammar for Terrain-Optimized Robot Design",
  a="Allan Zhao; Jie Xu; Mina Konaković-Luković; Josephine Hughes; Andrew Spielberg; Daniela Rus; Wojciech Matusik",
  corr="Allan Zhao", inst="MIT", lab="MIT CSAIL", v="SIGGRAPH Asia", vt="conference", y=2020,
  br="codesign", top="morphology search, graph grammar, terrain adaptation", par="co-design",
  doi="10.1145/3414685.3417831", st=3,
  note="Constrains the morphology search space with a grammar so the search is tractable and the results are "
       "buildable. The right starting point for agentic co-design — the agent should propose within a "
       "grammar, not in free space.",
  rel="codesign-rl,task2morph,agentic-codesign-ref", id_="codesign-dex-agentic,codesign-dog-rl")
P("codesign-rl","Jointly Learning to Construct and Control Agents using Deep Reinforcement Learning",
  a="Charles Schaff; David Yunis; Ayan Chakrabarti; Matthew R. Walter", corr="Charles Schaff",
  inst="Toyota Technological Institute at Chicago", v="ICRA", vt="conference", y=2019, d="2018-01-04",
  br="codesign", top="morphology-control co-optimization", par="co-design, RL",
  arx="1801.01432", st=2, note="The canonical formulation of design and control as one RL problem — "
  "maintain a distribution over designs and update it with the policy.", rel="robogrammar,task2morph", id_="codesign-dog-rl")
P("task2morph","Task2Morph: Differentiable Task-Inspired Framework for Contact-Aware Robot Design",
  a="Xiaohan Zhang; Yingying Yu; Zhangjie Cao; et al.", inst="", v="IROS", vt="conference", y=2023,
  br="codesign", top="differentiable co-design, contact-aware", par="co-design", st=1,
  note="Differentiable co-design with contact. Relevant if you want gradients rather than evolutionary search "
       "in the dexterity co-design loop.", rel="robogrammar,codesign-rl", id_="codesign-dex-agentic")

# ---------------------------------------------------------------- simulators & benchmarks
P("mujoco","MuJoCo: A Physics Engine for Model-Based Control",
  a="Emanuel Todorov; Tom Erez; Yuval Tassa", corr="Emanuel Todorov",
  inst="University of Washington", v="IROS", vt="conference", y=2012, br="sim-bench",
  top="physics engine, contact dynamics", par="simulator", st=3,
  note="Soft-constraint contact model, fast and differentiable-ish. The default for anything where contact "
       "accuracy matters more than photorealism — which is most of this library.",
  rel="isaacgym,genesis,mjx")
P("isaacgym","Isaac Gym: High Performance GPU-Based Physics Simulation For Robot Learning",
  a="Viktor Makoviychuk; Lukasz Wawrzyniak; Yunrong Guo; Michelle Lu; Kier Storey; et al.",
  inst="NVIDIA", lab="NVIDIA", v="NeurIPS Datasets & Benchmarks", vt="conference", y=2021,
  d="2021-08-24", br="sim-bench", top="GPU physics, massively parallel RL", par="simulator",
  arx="2108.10470", st=3, note="End-to-end GPU simulation — physics and policy in the same memory. This is "
  "what makes 4096-environment training normal. Superseded by Isaac Lab but the paper is the reference.",
  rel="rudin2021,isaaclab,dextreme,genesis")
P("isaaclab","Isaac Lab (Orbit): A Unified Simulation Framework for Interactive Robot Learning",
  a="Mayank Mittal; Calvin Yu; Qinxi Yu; Jingzhou Liu; Nikita Rudin; David Hoeller; et al.",
  inst="NVIDIA; ETH Zürich", lab="NVIDIA; ETH RSL", v="IEEE RA-L", vt="journal", y=2023,
  d="2023-01-10", br="sim-bench", top="simulation framework, robot learning", par="simulator",
  arx="2301.04195", st=2, note="The maintained successor to Isaac Gym. What you would actually build MABEL's "
  "RL stack on today.", rel="isaacgym,rudin2021,genesis", pr="mabel")
P("genesis","Genesis: A Universal and Generative Physics Engine for Robotics and Beyond",
  a="Genesis Authors (Zhou Xian; et al.)", inst="CMU; Multi-institution consortium",
  v="open source", vt="software", y=2024, br="sim-bench",
  top="universal physics engine, generative simulation, speed", par="simulator",
  code="https://github.com/Genesis-Embodied-AI/Genesis", st=2,
  note="Claims very large speedups and unified multi-physics (rigid, MPM, SPH, cloth). The multi-material "
       "support is the reason to care for soft-object manipulation. Benchmark it yourself before believing "
       "the headline numbers.",
  rel="mujoco,isaacgym,soft-ref", id_="soft-sim2real")
P("maniskill","ManiSkill3: GPU Parallelized Robotics Simulation and Rendering for Generalizable Embodied AI",
  a="Stone Tao; Fanbo Xiang; Arth Shukla; Yuzhe Qin; Xander Hinrichsen; et al.",
  inst="UC San Diego", lab="UCSD Hao Su Lab", v="RSS", vt="conference", y=2025, d="2024-10-01",
  br="sim-bench", top="GPU simulation, benchmark, generalizable manipulation", par="simulator, benchmark",
  arx="2410.00425", st=2, note="Parallel rendering as well as parallel physics, which matters when your "
  "policy is vision-based.", rel="isaaclab,genesis,robocasa")
P("robocasa","RoboCasa: Large-Scale Simulation of Everyday Tasks for Generalist Robots",
  a="Soroush Nasiriany; Abhiram Maddukuri; Lance Zhang; Adeet Parikh; Aaron Lo; Abhishek Joshi; Ajay Mandlekar; Yuke Zhu",
  inst="UT Austin; NVIDIA", lab="UT Austin RobIn Lab (Yuke Zhu)", v="RSS", vt="conference", y=2024,
  d="2024-06-04", br="sim-bench", top="household simulation, generative scenes, benchmark", par="simulator, benchmark",
  arx="2406.02523", st=2, note="120 kitchen scenes, 2500+ objects, generative task variation. The scaling "
  "story for simulated household data.", rel="maniskill,behavior-robot-suite,libero")
P("libero","LIBERO: Benchmarking Knowledge Transfer for Lifelong Robot Learning",
  a="Bo Liu; Yifeng Zhu; Chongkai Gao; Yihao Feng; Qiang Liu; Yuke Zhu; Peter Stone",
  inst="UT Austin", lab="UT Austin", v="NeurIPS Datasets & Benchmarks", vt="conference", y=2023,
  d="2023-06-05", br="sim-bench", top="lifelong learning benchmark, knowledge transfer", par="benchmark",
  arx="2306.03310", st=2, note="The standard VLA evaluation suite. Useful mostly because everyone reports on "
  "it — treat saturation on LIBERO as weak evidence of anything real.", rel="robocasa,openvla,pi0")
P("humanoidbench","HumanoidBench: Simulated Humanoid Benchmark for Whole-Body Locomotion and Manipulation",
  a="Carmelo Sferrazza; Dun-Ming Huang; Xingyu Lin; Youngwoon Lee; Pieter Abbeel",
  corr="Carmelo Sferrazza", inst="UC Berkeley", lab="BAIR", v="RSS", vt="conference", y=2024,
  d="2024-03-15", br="sim-bench", top="humanoid benchmark, whole-body tasks", par="benchmark",
  arx="2403.10506", st=2, note="In your Archieve/Humaniod Benchmark folder. 27 whole-body tasks; the honest "
  "finding is that current RL solves locomotion and fails at the manipulation half.",
  rel="libero,robocasa,visualmimic", pr="mabel")

# ---------------------------------------------------------------- agentic / auto-research
P("eureka","Eureka: Human-Level Reward Design via Coding Large Language Models",
  a="Yecheng Jason Ma; William Liang; Guanzhi Wang; De-An Huang; Osbert Bastani; Dinesh Jayaraman; Yuke Zhu; Linxi Fan; Anima Anandkumar",
  corr="Yecheng Jason Ma", inst="NVIDIA; University of Pennsylvania; Caltech; UT Austin", lab="NVIDIA GEAR",
  v="ICLR", vt="conference", y=2024, d="2023-10-19", br="agentic",
  top="LLM reward design, evolutionary search, pen spinning", par="LLM, RL",
  meth="GPT-4 writes reward code, evaluates against RL training statistics, mutates", arx="2310.12931", st=3,
  note="The clearest existing template for agentic auto-research in robotics: the LLM writes reward *code*, "
       "trains a policy, reads the training curves, and rewrites. Pen spinning on a Shadow Hand is the "
       "headline. This is the seed of your dexterous-auto-research idea.",
  rel="dreureka,voyager,ai-scientist,robogrammar", pr="geodex", id_="auto-research-dex,codesign-dex-agentic,auto-research-wm,agentic-physical")
P("dreureka","DrEureka: Language Model Guided Sim-To-Real Transfer",
  a="Yecheng Jason Ma; William Liang; Hungju Wang; Sam Wang; Yuke Zhu; Linxi Fan; Osbert Bastani; Dinesh Jayaraman",
  inst="University of Pennsylvania; NVIDIA; UT Austin", lab="NVIDIA GEAR", v="RSS", vt="conference",
  y=2024, d="2024-06-04", br="agentic", top="LLM-guided domain randomization, sim-to-real", par="LLM, RL",
  arx="2406.01967", st=2, note="Eureka extended to writing the domain-randomization config too — the LLM "
  "tunes the sim-to-real knobs a grad student normally tunes. Yoga-ball balancing as the demo.",
  rel="eureka,domain-rand,asap", id_="auto-research-dex,codesign-dex-agentic,real2sim2real-ego")
P("voyager","Voyager: An Open-Ended Embodied Agent with Large Language Models",
  a="Guanzhi Wang; Yuqi Xie; Yunfan Jiang; Ajay Mandlekar; Chaowei Xiao; Yuke Zhu; Linxi Fan; Anima Anandkumar",
  inst="NVIDIA; Caltech; UT Austin; Stanford University", lab="NVIDIA GEAR", v="TMLR", vt="journal",
  y=2023, d="2023-05-25", br="agentic", top="open-ended agent, skill library, self-directed curriculum", par="LLM",
  arx="2305.16291", st=2, note="Minecraft, not robots — but the growing executable skill library plus "
  "self-proposed curriculum is the architecture your 'agentic physical robot' idea needs.",
  rel="eureka,ai-scientist,robocat", id_="agentic-physical,auto-research-wm,auto-research-dex")
P("ai-scientist","The AI Scientist: Towards Fully Automated Open-Ended Scientific Discovery",
  a="Chris Lu; Cong Lu; Robert Tjarko Lange; Jakob Foerster; Jeff Clune; David Ha",
  inst="Sakana AI; University of Oxford; UBC", v="arXiv", vt="preprint", y=2024, d="2024-08-12",
  br="agentic", top="automated research, hypothesis generation, paper writing", par="LLM",
  arx="2408.06292", st=2, note="Non-robotics, but the reference point for what 'auto-research' claims and "
  "where it breaks down (idea novelty and evaluation, not code generation). Read the criticism alongside it.",
  rel="voyager,eureka", id_="auto-research-wm,codesign-dex-agentic")

# ---------------------------------------------------------------- startup blogs (you asked for these)
P("sunday-gelato","Sunday Robotics: Gelato Foundation Model & Skill Capture",
  a="Sunday Robotics", inst="Sunday Robotics", lab="Sunday Robotics", v="company blog", vt="industry",
  y=2025, d="2025-11-01", br="agentic", top="home robot, skill capture glove, foundation model", par="VLA",
  site="https://www.sundayrobotics.com/", st=2,
  note="Came out of stealth late 2025 with 'Memo' and a handheld Skill Capture device — a commercial UMI-glove "
       "lineage, which is directly your world-action-model-from-gloves thesis with a company behind it. "
       "Company blog: unreviewed, no benchmarks. Track it as competitive intelligence, not evidence.",
  rel="umi,dexcap,dexumi,generalist-ai,pi05", pr="mabel", id_="wam-umi-gloves,mobile-dex-umi")
P("generalist-ai","Generalist AI: GEN-0 and Harmonic Reasoning",
  a="Generalist AI", inst="Generalist AI", lab="Generalist", v="company blog", vt="industry",
  y=2025, d="2025-10-01", br="agentic", top="robot foundation model, scaling laws, dexterity", par="VLA",
  site="https://generalistai.com/", st=2,
  note="Argues for robot-data scaling laws from a 270k-hour proprietary corpus and a 'harmonic reasoning' "
       "architecture that fuses thinking and acting at high rate. The scaling-law claim is the interesting "
       "one and the least verifiable. Unreviewed.",
  rel="pi05,groot-n1,sunday-gelato,oxe")
P("mimic-robotics","mimic robotics: Dexterous Manipulation from Human Demonstration",
  a="mimic robotics (ETH Zürich spin-off)", inst="mimic robotics", lab="mimic robotics",
  v="company blog", vt="industry", y=2025, br="agentic",
  top="dexterous hand, human demonstration, industrial deployment", par="IL",
  site="https://www.mimicrobotics.com/", st=2,
  note="ETH spin-off (Faive Robotics lineage) building a tendon-driven human-like hand and learning from "
       "human demonstration for industrial pick-and-place. The closest commercial analogue to the GeoDex "
       "hand + ego-video plan. Unreviewed.",
  rel="orca-hand,ruka,dexumi,sunday-gelato", pr="geodex", id_="hand-22dof,ego-dex")
P("skild","Skild AI: Omni-bodied Robot Brain",
  a="Skild AI", inst="Skild AI", lab="Skild AI (CMU spin-off)", v="company blog", vt="industry",
  y=2025, br="agentic", top="general robot brain, cross-embodiment", par="VLA",
  site="https://www.skild.ai/", st=1,
  note="CMU spin-off (Pathak/Gupta) pitching one model across embodiments. Unreviewed; included for "
       "completeness of the startup landscape.", rel="generalist-ai,pi05,crossformer")
P("dyna","Dyna Robotics: DYNA-1 Autonomous Dexterous Model",
  a="Dyna Robotics", inst="Dyna Robotics", v="company blog", vt="industry", y=2025, br="agentic",
  top="long-horizon autonomy, commercial dexterity", par="VLA", site="https://www.dyna.co/", st=1,
  note="Claims long-duration autonomous commercial task execution. Unreviewed — useful mainly as a marker "
       "of what industry considers the current reliability bar.", rel="generalist-ai,pi06")

# ---------------------------------------------------------------- co-design (expanded)
# Author lists deliberately left thin where memory is not reliable — the OpenAlex
# verification pass fills in authors, institutions and DOIs from the record of truth.
P("sims1994","Evolving Virtual Creatures",
  a="Karl Sims", inst="Thinking Machines Corporation", v="SIGGRAPH", vt="conference", y=1994,
  br="codesign", top="evolutionary co-design, morphology and control", par="co-design", st=3,
  note="The origin of the whole field: bodies and brains evolved together in simulated physics, in 1994. "
       "Every modern co-design paper is a re-run of this with better optimizers. Read it to see how little "
       "the framing has changed and how much the tooling has.",
  rel="robogrammar,derl,codesign-rl,neural-graph-evo", id_="codesign-dex-agentic,codesign-dog-rl")
P("lipson2000","Automatic design and manufacture of robotic lifeforms",
  a="Hod Lipson; Jordan B. Pollack", inst="Brandeis University", v="Nature", vt="journal", y=2000,
  br="codesign", top="evolutionary design, automatic fabrication", par="co-design", st=2,
  note="Evolved morphologies actually 3D-printed and run. The first closing of the design–fabricate–test "
       "loop without a human in it, which is exactly what an agentic co-design system has to reproduce.",
  rel="sims1994,robogrammar,text2robot", id_="codesign-dex-agentic")
P("derl","Embodied Intelligence via Learning and Evolution",
  a="Agrim Gupta; Silvio Savarese; Surya Ganguli; Li Fei-Fei", corr="Agrim Gupta",
  inst="Stanford University", lab="Stanford Vision & Learning", v="Nature Communications", vt="journal",
  y=2021, d="2021-02-03", br="codesign", top="evolution, morphological intelligence, Baldwin effect",
  par="co-design, RL", arx="2102.02202", st=3,
  note="DERL. Shows morphology and learning speed co-evolve — better bodies are the ones that learn faster, "
       "not just the ones that score higher. The 'morphological Baldwin effect' is the result to cite when "
       "arguing co-design is more than hyperparameter search.",
  rel="sims1994,codesign-rl,transform2act", id_="codesign-dog-rl,codesign-dex-agentic")
P("neural-graph-evo","Neural Graph Evolution: Towards Efficient Automatic Robot Design",
  a="Tingwu Wang; Yuhao Zhou; Sanja Fidler; Jimmy Ba", inst="University of Toronto; NVIDIA",
  lab="Vector Institute", v="ICLR", vt="conference", y=2019, d="2019-06-12",
  br="codesign", top="graph neural networks, morphology search", par="co-design, RL",
  arx="1906.05370", st=2,
  note="Represents the robot as a graph and mutates it, with a GNN policy that transfers across designs. "
       "University of Toronto — worth knowing locally.",
  rel="robogrammar,transform2act,derl", id_="codesign-dex-agentic")
P("transform2act","Transform2Act: Learning a Transform-and-Control Policy for Efficient Agent Design",
  a="Ye Yuan; Yuda Song; Zhengyi Luo; Wen Sun; Kris Kitani", corr="Ye Yuan",
  inst="Carnegie Mellon University; Cornell University", v="ICLR", vt="conference", y=2022,
  d="2021-10-07", br="codesign", top="design as action, morphology optimization", par="co-design, RL",
  arx="2110.03659", st=3,
  note="The cleanest formulation in the area: make the design choices *actions* in an extended MDP, so one "
       "RL algorithm optimizes body and behaviour with no separate outer loop. This is the formulation to "
       "start from for the quadruped co-design idea.",
  rel="derl,codesign-rl,robogrammar", id_="codesign-dog-rl,codesign-dex-agentic")
P("hardware-as-policy","Hardware as Policy: Mechanical and Computational Co-Optimization using Deep Reinforcement Learning",
  a="Tianjian Chen; Zhanpeng He; Matei Ciocarlie", corr="Tianjian Chen",
  inst="Columbia University", lab="Columbia ROAM Lab (Ciocarlie)", v="CoRL", vt="conference",
  y=2020, d="2020-08-05", br="codesign", top="differentiable hardware, co-optimization", par="co-design, RL",
  arx="2008.04460", st=3,
  note="Treats the mechanism itself as part of the policy network, so hardware parameters get gradients "
       "from the same backward pass. Demonstrated on underactuated hands — the most directly relevant "
       "formulation for dexterous-hand co-design.",
  rel="transform2act,diff-contact-design,fit2form", id_="codesign-dex-agentic,hand-22dof")
P("diff-contact-design","An End-to-End Differentiable Framework for Contact-Aware Robot Design",
  a="Jie Xu; Tao Chen; Lara Zlokapa; Michael Foshey; Wojciech Matusik; Shinjiro Sueda; Pulkit Agrawal",
  corr="Jie Xu", inst="MIT", lab="MIT CSAIL; Improbable AI", v="RSS", vt="conference", y=2021,
  d="2021-07-15", br="codesign", top="differentiable simulation, contact-aware design, hands", par="co-design",
  arx="2107.07501", st=3,
  note="Differentiable simulation through contact, applied to designing manipulators and hands. The contact "
       "part is what makes it relevant — for dexterity the design objective *is* the contact behaviour.",
  rel="hardware-as-policy,fit2form,task2morph", id_="codesign-dex-agentic,hand-22dof")
P("fit2form","Fit2Form: 3D Generative Model for Robot Gripper Form Design",
  a="Huy Ha; Shubham Agrawal; Shuran Song", corr="Huy Ha",
  inst="Columbia University", lab="Columbia REALab", v="CoRL", vt="conference", y=2020,
  d="2020-11-12", br="codesign", top="generative gripper design, task-driven form", par="co-design",
  arx="2011.06498", st=2,
  note="Generate the gripper geometry from the task rather than picking from a catalogue. The natural "
       "ancestor of 'let a generative model propose the hand'.",
  rel="diff-contact-design,hardware-as-policy,diffusebot", id_="codesign-dex-agentic,hand-22dof")
P("evogym","Evolution Gym: A Large-Scale Benchmark for Evolving Soft Robots",
  a="Jagdeep Singh Bhatia; Holly Jackson; Yunsheng Tian; Jie Xu; Wojciech Matusik",
  inst="MIT", lab="MIT CSAIL", v="NeurIPS Datasets & Benchmarks", vt="conference", y=2021,
  d="2022-01-24", br="codesign", top="co-design benchmark, soft robots", par="co-design, benchmark",
  arx="2201.09863", st=2,
  note="The benchmark the area needed. Useful for sanity-checking a co-design algorithm before spending "
       "GPU-months on a quadruped.",
  rel="sims1994,derl,diffusebot", id_="codesign-dog-rl,soft-sim2real")
P("dyret","Real-world embodied AI through a morphologically adaptive quadruped robot",
  a="Tønnes F. Nygaard; Charles P. Martin; Jim Torresen; Kyrre Glette; David Howard",
  corr="Tønnes F. Nygaard", inst="University of Oslo; CSIRO", v="Nature Machine Intelligence",
  vt="journal", y=2021, br="codesign", top="morphologically adaptive quadruped, real-world evolution",
  par="co-design", st=3,
  note="DyRET — a quadruped that physically changes its own leg lengths and evolves its morphology *in the "
       "real world*, not in simulation. The single most relevant prior work for the fast-running-dog "
       "co-design idea, and the one that shows how brutal the real-world version of this loop is.",
  rel="mit-cheetah,meta-rl-legged,transform2act", id_="codesign-dog-rl")
P("meta-rl-legged","Meta Reinforcement Learning for Optimal Design of Legged Robots",
  a="Álvaro Belmonte-Baeza; Joonho Lee; Giorgio Valsecchi; Marco Hutter",
  inst="ETH Zürich", lab="ETH RSL", v="IEEE RA-L", vt="journal", y=2022, d="2022-10-06",
  br="codesign", top="meta-RL, legged design optimization", par="co-design, RL",
  arx="2210.02750", st=2,
  note="Trains a design-conditioned policy once, then evaluates candidate morphologies cheaply without "
       "retraining. The practical trick that makes legged co-design affordable — read it before committing "
       "compute to the dog.",
  rel="dyret,transform2act,rudin2021", id_="codesign-dog-rl")
P("coros-codesign","Computational co-optimization of design parameters and motion trajectories for robotic systems",
  a="Sehoon Ha; Stelian Coros; Alexander Alspach; Joohyung Kim; Katsu Yamane",
  inst="Disney Research; ETH Zürich", v="IJRR", vt="journal", y=2018,
  br="codesign", top="trajectory-design co-optimization, sensitivity analysis", par="co-design", st=2,
  note="In your library's orbit via the Disney line. The implicit-function/sensitivity approach — differentiate "
       "the optimal trajectory with respect to the design parameters — is the model-based alternative to "
       "RL-in-the-loop, and it is far more sample-efficient when your model is good.",
  rel="diff-contact-design,dinev-codesign,disney-bdx", id_="codesign-dog-rl")
P("dinev-codesign","Co-Designing Robots by Differentiating Motion Solvers",
  a="Traiko Dinev; Carlos Mastalli; Vladimir Ivan; Steve Tonneau; Sethu Vijayakumar",
  inst="University of Edinburgh", v="ICRA", vt="conference", y=2022, d="2021-03-08",
  br="codesign", top="differentiating through optimal control, co-design", par="co-design",
  arx="2103.04660", st=2,
  note="Differentiate through the whole motion solver to get design gradients. Complementary to Transform2Act: "
       "gradients where you have a model, RL where you do not.",
  rel="coros-codesign,diff-contact-design,transform2act", id_="codesign-dog-rl")
P("text2robot","Text2Robot: Evolutionary Robot Design from Text Descriptions",
  a="Ryan P. Ringel; Zachary S. Charlick; Jiaxun Liu; Boxi Xia; Boyuan Chen",
  corr="Boyuan Chen", inst="Duke University", lab="Duke General Robotics Lab", v="ICRA", vt="conference",
  y=2025, d="2024-06-28", br="codesign", top="text-to-morphology, generative design, quadrupeds",
  par="co-design, LLM", arx="2406.19963", st=3,
  note="Text prompt → 3D generative model → printable quadruped → evolved controller, in under a day. "
       "This is the closest published thing to your agentic co-design idea, and it is on quadrupeds, so it "
       "touches the fast-dog idea too. The gap it leaves: it optimizes for locomotion, not for dexterity.",
  rel="diffusebot,robomorph,eureka,dyret", id_="codesign-dex-agentic,codesign-dog-rl,agentic-physical")
P("diffusebot","DiffuseBot: Breeding Soft Robots With Physics-Augmented Generative Diffusion Models",
  a="Tsun-Hsuan Wang; Juntian Zheng; Pingchuan Ma; Yilun Du; Byungchul Kim; Andrew Spielberg; Joshua Tenenbaum; Chuang Gan; Daniela Rus",
  corr="Tsun-Hsuan Wang", inst="MIT", lab="MIT CSAIL", v="NeurIPS", vt="conference", y=2023,
  d="2023-11-28", br="codesign", top="generative design, diffusion over morphology, soft robots",
  par="co-design, diffusion", arx="2311.17053", st=2,
  note="A diffusion model over robot morphologies, with differentiable physics steering the sampling. The "
       "generative-prior half of agentic co-design — the LLM proposes, something like this actually draws it.",
  rel="text2robot,fit2form,evogym", id_="codesign-dex-agentic,soft-sim2real")
P("robomorph","RoboMorph: Evolving Robot Morphology using Large Language Models",
  a="Kevin Qiu; Krzysztof Ciebiera; Paweł Fijałkowski; Marek Cygan; Łukasz Kuciński",
  inst="University of Warsaw; IDEAS NCBR", v="arXiv", vt="preprint", y=2024, d="2024-07-11",
  br="codesign", top="LLM-driven morphology evolution", par="co-design, LLM", arx="2407.08626", st=2,
  note="An LLM as the mutation operator in a morphology search loop, with automatic reward design alongside. "
       "Directly the mechanism your agentic co-design idea proposes — read it to see what is already claimed.",
  rel="text2robot,eureka,robogrammar", id_="codesign-dex-agentic,auto-research-dex")
P("taskagnostic-morph","Task-Agnostic Morphology Evolution",
  a="Donald J. Hejna III; Pieter Abbeel; Lerrel Pinto", inst="UC Berkeley; New York University",
  v="ICLR", vt="conference", y=2021, d="2021-02-25", br="codesign",
  top="task-agnostic morphology, information-theoretic objective", par="co-design", arx="2102.13100", st=2,
  note="Evolve morphologies without committing to a task, by maximizing the diversity of behaviour the body "
       "can express. Relevant if you want a hand that is good at dexterity in general rather than at one "
       "benchmark.", rel="derl,transform2act", id_="codesign-dex-agentic,hand-22dof")

# -*- coding: utf-8 -*-
"""Open-dataset table. Titles, authors and dates come from dataset_papers.json
(fetched from the arXiv API); everything else is annotation, with scale figures
taken from the papers' own abstracts."""

# cat: ego exo umi teleop robot dex tactile hri multi motion sim
# org: academia | industry | consortium
# D(id, arxiv, cat, org, one, device, modal, hours, eps, tasks, scenes, subj, embod, site)
ROWS = []
def D(id, arxiv="", **k): k.update(id=id, arxiv=arxiv); ROWS.append(k)

# ─────────────────────────────── EGOCENTRIC HUMAN ───────────────────────────────
D("ego4d","2110.07058",cat="ego",org="consortium",
  one="The foundational egocentric corpus: daily-life video from 931 wearers in 9 countries, with benchmark suites for memory, forecasting and social understanding.",
  device="Head-mounted cameras (Vuzix, GoPro, Aria, Weeview, Pupil)",
  modal="RGB, audio, 3D scans, eye gaze, IMU, stereo (subset)",
  hours="3,670 h", eps="3,670 h of video", tasks="hundreds of scenarios", scenes="74 locations",
  subj="931 wearers", embod="human", site="https://ego4d-data.org/",
  note="The substrate under almost every 'learn from human video' result. No native hand-pose labels — that gap is why EgoDex and OpenEgo exist.")
D("egoexo4d","2311.18259",cat="ego",org="consortium",
  one="Time-synchronised first- and third-person video of the same skilled activity — the dataset that turns 'is ego better than exo?' into an experiment.",
  device="Aria glasses (ego) + 4-5 static GoPros (exo)",
  modal="RGB, multi-view, audio, eye gaze, IMU, 3D pose, expert commentary",
  hours="1,286 h", eps="5,035 takes", tasks="8 skilled domains", scenes="13 cities",
  subj="740 participants", embod="human", site="https://ego-exo4d-data.org/",
  note="The only large corpus with genuinely paired ego/exo views. Central to the third-person-learning idea.")
D("epic100","2006.13256",cat="ego",org="academia",
  one="Long-term unscripted kitchen activity from head-mounted cameras, densely annotated with fine-grained actions.",
  device="Head-mounted GoPro", modal="RGB, audio, action segments",
  hours="100 h", eps="700 videos · 20M frames", tasks="90K action segments", scenes="45 kitchens",
  subj="45 participants", embod="human", site="https://epic-kitchens.github.io/",
  note="The precision standard for egocentric action annotation; small next to Ego4D but far more densely labelled.")
D("epicfields","2306.08731",cat="ego",org="academia",
  one="EPIC-KITCHENS re-registered in 3D — camera poses and neural-rendering-ready reconstructions for 96% of its videos.",
  device="Head-mounted GoPro + COLMAP reconstruction", modal="RGB, camera poses, 3D geometry",
  hours="99 h", eps="19M registered frames", tasks="—", scenes="45 kitchens", subj="—",
  embod="human", site="https://epic-kitchens.github.io/epic-fields/",
  note="Directly relevant to real-to-sim: it is egocentric video already solved for geometry.")
D("nymeria","2406.09905",cat="ego",org="industry",
  one="Egocentric daily motion in the wild with full-body ground truth — the largest paired ego-video-plus-motion-capture collection.",
  device="Project Aria glasses + wrist Aria + XSens body suit",
  modal="RGB, SLAM, eye gaze, IMU, full-body 3D motion, language narration",
  hours="300 h", eps="1,200 sequences · 399 km travelled", tasks="daily activity", scenes="50 locations",
  subj="264 participants", embod="human", site="https://github.com/facebookresearch/nymeria_dataset",
  note="The body-motion counterpart to Ego4D. If you want humanoid whole-body targets from ego video, this is the supervision.")
D("aea","2402.13349",cat="ego",org="industry",
  one="Everyday activity sequences from Aria glasses with globally aligned 3D trajectories, gaze and speech.",
  device="Project Aria glasses", modal="RGB, SLAM, eye gaze, point cloud, speech transcript",
  hours="—", eps="143 sequences", tasks="daily activity", scenes="5 indoor locations",
  subj="multiple wearers", embod="human", site="https://facebookresearch.github.io/projectaria_tools/docs/open_datasets/aria_everyday_activities_dataset",
  note="Small but the cleanest machine-perception annotations of the Aria family.")
D("aria","2308.13561",cat="ego",org="industry",
  one="The glasses themselves: the research platform and open tooling that most modern egocentric datasets are recorded on.",
  device="Project Aria glasses", modal="RGB, SLAM cameras, eye tracking, IMU, magnetometer, barometer, audio",
  hours="—", eps="platform + tools", tasks="—", scenes="—", subj="—",
  embod="human", site="https://facebookresearch.github.io/projectaria_tools/",
  note="Not a dataset — the capture platform. Worth knowing the sensor suite before designing your own rig.")
D("egodex","2505.11709",cat="ego",org="industry",
  one="Apple's large-scale egocentric video with paired 3D hand and finger tracking captured at record time, aimed squarely at dexterous manipulation.",
  device="Apple Vision Pro", modal="RGB 1080p/30 Hz, 3D hand + finger pose, camera pose",
  hours="829 h", eps="338K episodes", tasks="194 tasks", scenes="—", subj="—",
  embod="human", site="https://github.com/apple/ml-egodex",
  note="Solves Ego4D's biggest gap — native, accurate hand pose at scale. The most useful single corpus for the ego-dexterity idea.")
D("egoverse","2604.07607",cat="ego",org="consortium",
  one="A collaborative, standardised egocentric platform pooling human demonstrations from labs and industry worldwide.",
  device="mixed (community contributed)", modal="RGB, hand pose, manipulation annotations",
  hours="1,362 h", eps="80K episodes", tasks="1,965 tasks", scenes="240 scenes",
  subj="2,087 demonstrators", embod="human", site="https://arxiv.org/abs/2604.07607",
  note="The largest single egocentric manipulation release, and the first serious attempt at a shared contribution standard rather than another siloed corpus.")
D("openego","2509.05513",cat="ego",org="academia",
  one="Six public egocentric datasets unified into one schema with hand-pose and manipulation annotations.",
  device="mixed (aggregated)", modal="RGB, 3D hand pose, language",
  hours="1,107 h", eps="—", tasks="290 manipulation tasks", scenes="600+ environments", subj="—",
  embod="human", site="https://arxiv.org/abs/2509.05513",
  note="Aggregation, not new capture — but the harmonised schema saves weeks of data engineering.")
D("hoi4d","2203.01577",cat="ego",org="academia",
  one="4D egocentric human-object interaction with per-frame panoptic segmentation, object poses and hand poses.",
  device="Head-mounted RGB-D", modal="RGB-D, 3D hand pose, object 6D pose, panoptic masks",
  hours="—", eps="4,000 sequences · 2.4M frames", tasks="16 object categories", scenes="610 indoor rooms",
  subj="4 participants", embod="human", site="https://hoi4d.github.io/",
  note="Very dense annotation, very few subjects — the opposite tradeoff from Ego4D.")
D("hot3d","2411.19167",cat="ego",org="industry",
  one="Egocentric multi-view hand and object tracking in 3D, with laser-scanned object models and ground-truth poses.",
  device="Project Aria + Quest 3", modal="RGB, monochrome, 3D hand pose, object 6D pose, eye gaze",
  hours="13.9 h (833 min)", eps="3.7M+ images", tasks="hand-object tracking", scenes="—",
  subj="19 subjects", embod="human", site="https://facebookresearch.github.io/hot3d/",
  note="The precision benchmark for egocentric hand-object tracking — use it to validate your pose pipeline before trusting it on Ego4D.")
D("egovid","2411.08380",cat="ego",org="academia",
  one="Five million egocentric clips curated specifically for training egocentric video generation with action conditioning.",
  device="curated from existing corpora", modal="RGB, kinematic action labels, text",
  hours="—", eps="5M clips", tasks="—", scenes="—", subj="—",
  embod="human", site="https://egovid.github.io/",
  note="If you want to train a world model on the ego stream, this is the pre-curated pretraining set.")
D("egoexolearn","2403.16182",cat="ego",org="academia",
  one="Asynchronous ego and exo video of the same procedures — humans watching a demonstration and then doing the task themselves.",
  device="Head-mounted camera + fixed demonstration video", modal="RGB, gaze, audio, procedure annotations",
  hours="120 h", eps="—", tasks="daily + laboratory procedures", scenes="daily life + labs", subj="—",
  embod="human", site="https://github.com/OpenGVLab/EgoExoLearn",
  note="Asynchronous rather than simultaneous ego/exo — closer to how a robot would actually learn by watching.")
D("egobody","2112.07642",cat="ego",org="academia",
  one="Egocentric recordings of two-person social interaction with accurate 3D body shape and motion for the interactee.",
  device="HoloLens2 + multi-Kinect rig", modal="RGB-D, SMPL-X body meshes, eye gaze, scene mesh",
  hours="—", eps="125 sequences", tasks="social interaction", scenes="15 indoor scenes",
  subj="36 subjects", embod="human", site="https://sanweiliti.github.io/egobody/egobody.html",
  note="The human-partner perception data an HRI system needs, from the wearer's viewpoint.")
D("h2o-ego","2104.11181",cat="ego",org="academia",
  one="Two hands manipulating objects from a first-person view, with markerless 3D annotations for both hands and object 6D pose.",
  device="Head-mounted RGB-D", modal="RGB-D, two-hand 3D pose, object 6D pose, interaction labels",
  hours="—", eps="—", tasks="bimanual interaction recognition", scenes="—", subj="4 subjects",
  embod="human", site="https://taeinkwon.com/projects/h2o/")
D("egovla","2507.12440",cat="ego",org="academia",
  one="Not a dataset but the reference recipe: train a VLA on egocentric human video, then transfer it to a robot.",
  device="—", modal="RGB, hand pose", hours="—", eps="—", tasks="—", scenes="—", subj="—",
  embod="human → robot", site="https://arxiv.org/abs/2507.12440",
  note="Read alongside the ego datasets — it tells you what preprocessing they actually need to be usable.")

# ─────────────────────────── HAND-OBJECT / DEXTEROUS ────────────────────────────
D("arctic","2204.13662",cat="dex",org="academia",
  one="Two hands dexterously manipulating articulated objects, with synchronised 3D meshes and dense contact annotation.",
  device="Multi-view mocap (8 cameras) + head-mounted", modal="RGB, 3D hand+object meshes, contact maps",
  hours="—", eps="2.1M video frames", tasks="bimanual articulated manipulation", scenes="lab",
  subj="10 subjects", embod="human", site="https://arctic.is.tue.mpg.de/",
  note="The contact annotation is the part that matters — it is what contact-consistent retargeting needs as supervision.")
D("dexycb","2104.04631",cat="dex",org="industry",
  one="The standard benchmark for capturing human hand grasping of YCB objects, with 6D object and 3D hand pose.",
  device="8-camera RGB-D rig", modal="RGB-D, 3D hand pose, object 6D pose",
  hours="—", eps="1,000 sequences", tasks="grasping", scenes="lab", subj="10 subjects",
  embod="human", site="https://dex-ycb.github.io/",
  note="NVIDIA. Small and clean; still the default evaluation set for hand-pose and handover work.")
D("grab","2008.11200",cat="dex",org="academia",
  one="Whole-body human grasping — not just hands, but the full body approaching and manipulating objects.",
  device="Optical mocap (Vicon) + object markers", modal="SMPL-X whole-body, hand pose, contact, object pose",
  hours="—", eps="1,334 sequences", tasks="grasp + intent", scenes="lab", subj="10 subjects · 51 objects",
  embod="human", site="https://grab.is.tue.mpg.de/",
  note="Whole-body context for grasping — relevant once your manipulator is attached to a mobile base rather than a table.")
D("taco","2401.08399",cat="dex",org="academia",
  one="Bimanual tool-action-object interaction with paired third-person and egocentric views.",
  device="Multi-view + head-mounted", modal="RGB, ego+exo, 3D hand-object meshes, action labels",
  hours="—", eps="2.5K motion sequences", tasks="tool use", scenes="lab", subj="—",
  embod="human", site="https://taco2024.github.io/",
  note="Tool use specifically — the task family where functional correspondence matters most.")
D("oakink2","2403.19417",cat="dex",org="academia",
  one="Bimanual hand-object manipulation for complex multi-step daily tasks, organised into affordance / primitive / complex task levels.",
  device="Multi-view mocap", modal="RGB, 3D hand-object pose, task hierarchy",
  hours="—", eps="—", tasks="complex daily activities", scenes="lab", subj="—",
  embod="human", site="https://oakink.net/v2/",
  note="The task-hierarchy abstraction is unusual and useful if you want long-horizon structure rather than single grasps.")
D("dexgraspnet","2210.02697",cat="dex",org="academia",
  one="A million-plus simulated ShadowHand grasps across thousands of objects, all validated in physics.",
  device="synthetic (Isaac Gym validated)", modal="grasp poses, object meshes",
  hours="—", eps="1.32M grasps", tasks="grasping", scenes="sim", subj="5,355 objects",
  embod="ShadowHand (sim)", site="https://pku-epic.github.io/DexGraspNet/",
  note="Synthetic, but the validation-in-physics step is what makes it usable rather than decorative.")
D("dexgraspnet2","2410.23004",cat="dex",org="academia",
  one="Dexterous grasping in cluttered scenes at scale — 427 million grasps with demonstrated zero-shot sim-to-real.",
  device="synthetic", modal="grasp poses, depth, cluttered scenes",
  hours="—", eps="427M grasps", tasks="cluttered grasping", scenes="8,270 scenes", subj="1,319 objects",
  embod="dexterous hand (sim)", site="https://pku-epic.github.io/DexGraspNet2.0/",
  note="Reports 90.7% real-world success in clutter from synthetic data alone — a strong data point for the soft/sim2real debate.")
D("dexart","2305.05706",cat="dex",org="academia",
  one="Benchmark for dexterous manipulation of articulated objects with generalisation to unseen instances.",
  device="simulation", modal="point cloud, articulation state",
  hours="—", eps="—", tasks="articulated manipulation", scenes="sim", subj="—",
  embod="Allegro hand (sim)", site="https://www.chenbao.tech/dexart/")

# ────────────────────────────────── UMI & HANDHELD ──────────────────────────────
D("umi-data","2402.10329",cat="umi",org="academia",
  one="The original handheld-gripper demonstrations: deployable robot data collected in the wild with no robot present.",
  device="UMI handheld gripper + fisheye GoPro + side mirrors", modal="RGB fisheye, 6-DoF EE pose (SLAM), gripper width",
  hours="—", eps="~1,400 demos across tasks", tasks="dynamic, bimanual, precise, long-horizon", scenes="in-the-wild",
  subj="—", embod="UR5 / Franka / ARX (transferable)", site="https://umi-gripper.github.io/",
  note="Small by modern standards, but it defined the format everything below follows.")
D("fastumi100k","2510.08022",cat="umi",org="academia",
  one="The largest open UMI-style corpus: 100K+ handheld demonstrations in household environments, released in LeRobot format.",
  device="FastUMI handheld rig (hardware-decoupled, lightweight tracker)",
  modal="RGB multi-view wrist fisheye, EE state, text annotations",
  hours="—", eps="100K+ trajectories", tasks="54 tasks", scenes="household", subj="—",
  embod="embodiment-agnostic", site="https://github.com/MrKeee/FastUMI-100K",
  note="LeRobot v2.1 formatted, so it drops straight into an existing training stack. The obvious starting corpus for a UMI world model.")
D("yubi","2606.10244",cat="umi",org="academia",
  one="Bidigital handheld interface for bimanual dexterity, with a UMI-style dataset of genuinely unprecedented scale.",
  device="YUBI bidigital device + VR 6-DoF tracking", modal="RGB, 6-DoF pose, bimanual finger state",
  hours="8,434 h", eps="1.20M episodes", tasks="119 tasks", scenes="—", subj="—",
  embod="bimanual dexterous", site="https://arxiv.org/abs/2606.10244",
  note="8,434 hours from a handheld interface — an order of magnitude past anything teleoperated. This is the strongest existing evidence for the UMI-scaling thesis.")
D("dexumi-data","2505.21864",cat="umi",org="academia",
  one="Dexterous-hand demonstrations captured with a wearable exoskeleton adapter plus video inpainting of the robot hand.",
  device="Wearable hand exoskeleton + camera", modal="RGB (inpainted), finger joint state, tactile",
  hours="—", eps="—", tasks="dexterous manipulation", scenes="in-the-wild", subj="—",
  embod="XHand / Inspire hand", site="https://dex-umi.github.io/",
  note="The two-part gap-closing recipe — hardware for kinematics, inpainting for appearance.")
D("realdexumi","2606.06033",cat="umi",org="academia",
  one="A wearable universal manipulation interface built specifically for dexterous robot learning.",
  device="Wearable UMI (dexterous)", modal="RGB, hand pose, EE pose",
  hours="—", eps="—", tasks="dexterous manipulation", scenes="in-the-wild", subj="—",
  embod="dexterous hand", site="https://arxiv.org/abs/2606.06033")
D("ume-data","2606.14218",cat="umi",org="academia",
  one="Whole-body exoskeleton capture with compliance — the force dimension UMI-style rigs leave out.",
  device="Universal Manipulation Exoskeleton", modal="RGB, joint state, contact force, whole-body pose",
  hours="—", eps="—", tasks="compliant whole-body manipulation", scenes="—", subj="—",
  embod="humanoid / mobile manipulator", site="https://arxiv.org/abs/2606.14218")
D("openaoe","2607.14183",cat="umi",org="academia",
  one="An open egocentric manipulation dataset shipped with its capture toolchain rather than as a frozen release.",
  device="egocentric capture rig (open toolchain)", modal="RGB, hand pose, action",
  hours="—", eps="—", tasks="manipulation", scenes="—", subj="—",
  embod="human → robot", site="https://arxiv.org/abs/2607.14183",
  note="The toolchain is the valuable half — it means you can extend it rather than only consume it.")

# ───────────────────────────── ROBOT MANIPULATION AT SCALE ──────────────────────
D("oxe","2310.08864",cat="robot",org="consortium",
  one="The pooled cross-embodiment corpus: 22 robot types from 21 institutions in one schema — the ImageNet moment for robot data.",
  device="teleoperation (mixed: VR, leader-follower, kinesthetic)",
  modal="RGB, multi-view, proprioception, language instructions",
  hours="—", eps="1M+ trajectories", tasks="527 skills · 160,266 task instances", scenes="mixed",
  subj="21 institutions", embod="22 embodiments", site="https://robotics-transformer-x.github.io/",
  note="The training set under Octo, OpenVLA and most open generalist policies. Heterogeneous to a fault — the per-dataset quality varies enormously.")
D("droid","2403.12945",cat="robot",org="consortium",
  one="In-the-wild manipulation collected on one standardised hardware setup across 564 scenes — diversity with consistency.",
  device="Franka Panda + Robotiq, VR teleoperation, 3 cameras (2 stereo + wrist)",
  modal="RGB stereo, depth, proprioception, language, camera calibration",
  hours="350 h", eps="76K trajectories", tasks="86 tasks", scenes="564 scenes",
  subj="50 data collectors · 13 institutions", embod="Franka Panda", site="https://droid-dataset.github.io/",
  note="Standardised hardware is why it is more useful per-episode than OXE. The stereo calibration makes it usable for 3D policies.")
D("bridgev2","2308.12952",cat="robot",org="academia",
  one="Diverse low-cost-arm manipulation designed for studying generalisation, on hardware any lab can buy.",
  device="WidowX 250 + VR/leader teleoperation", modal="RGB multi-view, depth, proprioception, language",
  hours="—", eps="60,096 trajectories", tasks="24 environments", scenes="24 environments", subj="—",
  embod="WidowX 250", site="https://rail-berkeley.github.io/bridgedata/",
  note="The generalisation benchmark of the pre-DROID era, and still the cheapest to reproduce.")
D("rt1data","2212.06817",cat="robot",org="industry",
  one="Google's 17-month kitchen-scale collection — the dataset that first showed robot policies follow a data-scaling curve.",
  device="13 Everyday Robots mobile manipulators, teleoperation",
  modal="RGB, proprioception, language instructions",
  hours="—", eps="~130K episodes", tasks="700+ instructions", scenes="office kitchens", subj="—",
  embod="Everyday Robots", site="https://robotics-transformer1.github.io/",
  note="Not fully open, but the scaling result is the reason everything after it exists.")
D("robonet","1910.11215",cat="robot",org="academia",
  one="The first serious multi-robot pooled dataset — video of many robots interacting with objects, shared across institutions.",
  device="mixed (7 robot platforms)", modal="RGB video, actions, states",
  hours="—", eps="15M+ video frames", tasks="—", scenes="—", subj="4 institutions",
  embod="7 robot platforms", site="https://www.robonet.wiki/",
  note="The intellectual ancestor of Open X-Embodiment, five years early.")
D("rh20t","2307.00595",cat="robot",org="academia",
  one="Contact-rich manipulation at scale with force-torque, across many skills, robots and viewpoints — the most under-used corpus in this table.",
  device="Multiple arms + teleoperation (haptic + VR)",
  modal="RGB-D multi-view, force-torque, tactile, audio, proprioception",
  hours="—", eps="110,000+ sequences", tasks="147 tasks", scenes="diverse", subj="—",
  embod="4 robot configurations", site="https://rh20t.github.io/",
  note="One of very few large datasets with real force-torque throughout. If you care about contact-rich learning, this is the corpus to start from.")
D("robomind","2412.13877",cat="robot",org="consortium",
  one="Multi-embodiment manipulation collected under a single standardised protocol, spanning single-arm, dual-arm and humanoid.",
  device="unified collection platform, teleoperation",
  modal="RGB-D multi-view, proprioception, language",
  hours="—", eps="107K trajectories", tasks="479 tasks", scenes="—", subj="96 object classes",
  embod="Franka, UR5e, AgileX dual-arm, humanoid", site="https://x-humanoid-robomind.github.io/",
  note="The standardised protocol is the contribution; most pooled datasets are heterogeneous messes by comparison.")
D("agibot","2503.06669",cat="robot",org="industry",
  one="A million-plus trajectories from a fleet of 100+ identical humanoid mobile manipulators — uniformity as the design principle.",
  device="AgiBot G1 fleet, teleoperation", modal="RGB-D, proprioception, tactile (subset), language",
  hours="—", eps="1M+ trajectories", tasks="217 tasks", scenes="106 scenes · 5 deployment settings", subj="—",
  embod="AgiBot G1", site="https://agibot-world.com/",
  note="The industrial answer to DROID: hardware uniformity instead of institutional diversity. Which bet is right is still open.")
D("ario","2408.10899",cat="robot",org="consortium",
  one="A unified standard plus the largest aggregated embodied dataset — roughly 3 million episodes across 258 series.",
  device="mixed (aggregated + new collection)", modal="RGB-D, proprioception, language, tactile (partial)",
  hours="—", eps="~3M episodes", tasks="321,064 tasks", scenes="—", subj="—",
  embod="many", site="https://imaei.github.io/project_pages/ario/",
  note="Enormous, and the data-format standard is the more durable contribution.")
D("galaxea","2509.00576",cat="robot",org="industry",
  one="500+ hours of mobile manipulation in real homes and workplaces, all on one embodiment.",
  device="Galaxea R1-Lite mobile bimanual robot, teleoperation",
  modal="RGB, proprioception, language, subtask annotations",
  hours="500+ h", eps="~100K trajectories", tasks="150 task categories", scenes="50 real scenes", subj="—",
  embod="Galaxea R1-Lite", site="https://opengalaxea.github.io/G0/",
  note="Authentic living and working environments rather than lab mock-ups — closest in spirit to what MABEL would need.")
D("robocoin","2511.17441",cat="robot",org="consortium",
  one="Large-scale bimanual manipulation across 15 robot platforms, categorised by the type of two-arm coordination required.",
  device="15 robot platforms, teleoperation", modal="RGB multi-view, proprioception, language",
  hours="—", eps="180,000+ demonstrations", tasks="421 bimanual tasks · 39 coordination types", scenes="16 environments",
  subj="432 objects", embod="15 bimanual platforms", site="https://arxiv.org/abs/2511.17441",
  note="The taxonomy of 39 bimanual coordination actions is genuinely useful — it is the closest thing to a vocabulary for two-arm collaboration.")
D("bcz","2202.02005",cat="robot",org="industry",
  one="Robot demonstrations paired with human videos and language, built for zero-shot task generalisation.",
  device="Everyday Robots + teleoperation + human video", modal="RGB, language, human demo video",
  hours="—", eps="25,877 episodes", tasks="100+ tasks", scenes="—", subj="—",
  embod="Everyday Robots", site="https://sites.google.com/view/bc-z/home")
D("langtable","2210.06407",cat="robot",org="industry",
  one="Nearly 600K language-labelled trajectories for real-time language-conditioned control on a tabletop.",
  device="tabletop arm, teleoperation", modal="RGB, language annotations, actions",
  hours="—", eps="~600K language-labelled trajectories", tasks="long-horizon rearrangement", scenes="tabletop", subj="—",
  embod="xArm", site="https://interactive-language.github.io/",
  note="An order of magnitude more language labels than anything before it.")
D("fmb","2401.08553",cat="robot",org="academia",
  one="A functional manipulation benchmark built from 3D-printed objects so other labs can replicate the physical setup exactly.",
  device="Franka + teleoperation", modal="RGB-D multi-view, proprioception",
  hours="—", eps="22,550 trajectories", tasks="assembly + single-object manipulation", scenes="lab", subj="—",
  embod="Franka Panda", site="https://functional-manipulation-benchmark.github.io/",
  note="Reproducible physical hardware is rare and underrated — this is one of the few real-robot benchmarks you can actually rebuild.")
D("roboagent","2309.01918",cat="robot",org="academia",
  one="A sample-efficiency demonstration: 12 skills and 38 tasks from only 7,500 demonstrations via semantic augmentation.",
  device="Franka + teleoperation", modal="RGB multi-view, proprioception, language",
  hours="—", eps="7,500 demonstrations", tasks="38 tasks · 12 skills", scenes="kitchen scenes", subj="—",
  embod="Franka Panda", site="https://robopen.github.io/")
D("qwen-robotmanip","2606.17846",cat="robot",org="industry",
  one="A ~38,100-hour pretraining corpus assembled entirely from open datasets and human video, with a human-to-robot synthesis pipeline across 15 platforms.",
  device="aggregated open data + egocentric human video", modal="RGB, proprioception, language, synthesised actions",
  hours="~38,100 h", eps="—", tasks="—", scenes="—", subj="15 platforms",
  embod="15 platforms", site="https://arxiv.org/abs/2606.17846",
  note="Notable for using no proprietary collection at all — a direct test of whether open data plus human video is enough.")

# ────────────────────────────────── TELEOPERATION ───────────────────────────────
D("aloha-data","2304.13705",cat="teleop",org="academia",
  one="Fine-grained bimanual demonstrations from the low-cost leader-follower rig that made bimanual IL reproducible.",
  device="ALOHA leader-follower (ViperX/WidowX)", modal="RGB 4-camera, joint positions",
  hours="—", eps="~50 demos per task", tasks="6 fine-grained tasks", scenes="lab", subj="—",
  embod="ViperX 6-DoF bimanual", site="https://tonyzhaozh.github.io/aloha/",
  note="Tiny, and that is the point — 50 demos per task was enough for threading a zip tie.")
D("mobile-aloha-data","2401.02117",cat="teleop",org="academia",
  one="Mobile bimanual demonstrations with whole-body teleoperation, plus the co-training result that static data lifts mobile performance.",
  device="Mobile ALOHA (tethered whole-body teleop)", modal="RGB 4-camera, joint + base velocity",
  hours="—", eps="50 demos per task", tasks="7 mobile manipulation tasks", scenes="real home/kitchen", subj="—",
  embod="Mobile ALOHA", site="https://mobile-aloha.github.io/",
  note="The co-training finding — up to 90% improvement from static data — is the reusable result, not the dataset.")
D("roboturk","1811.02790",cat="teleop",org="academia",
  one="Crowdsourced 6-DoF teleoperation through ordinary phones — the first attempt to scale demonstration collection past a single lab.",
  device="smartphone-based teleoperation, crowdsourced", modal="RGB, actions",
  hours="137.5 h", eps="2,100+ demonstrations", tasks="3 tasks", scenes="sim + real", subj="54 users",
  embod="Sawyer / sim", site="https://roboturk.stanford.edu/",
  note="Historically important: the argument that operator access, not robot count, is the bottleneck.")
D("airexo2","2503.03081",cat="teleop",org="academia",
  one="In-the-wild demonstrations from a low-cost exoskeleton, designed to transfer without robot data.",
  device="AirExo-2 exoskeleton", modal="RGB-D, joint state",
  hours="—", eps="—", tasks="generalisable manipulation", scenes="in-the-wild", subj="—",
  embod="dual-arm", site="https://airexo.tech/airexo2/",
  note="The main competitor framing for UME-style exoskeleton capture.")
D("television","2407.01512",cat="teleop",org="academia",
  one="Open-source immersive VR teleoperation with active stereo vision — cheap, high-quality bimanual demonstrations.",
  device="VR headset + active stereo head", modal="stereo RGB, hand/arm pose, robot state",
  hours="—", eps="—", tasks="bimanual dexterous", scenes="lab", subj="—",
  embod="H1 / GR-1 / bimanual arms", site="https://robot-tv.github.io/")
D("humanplus","2406.10454",cat="teleop",org="academia",
  one="Humanoid shadowing from a single RGB camera, plus the imitation data it produces on a 33-DoF humanoid.",
  device="single RGB camera (shadowing) + 40 h of human mocap", modal="RGB, whole-body pose, joint state",
  hours="—", eps="40 demos per skill", tasks="wearing shoes, warehouse unloading, folding, typing", scenes="lab",
  subj="—", embod="33-DoF custom humanoid", site="https://humanoid-ai.github.io/")
D("dexcap-data","2403.07788",cat="teleop",org="academia",
  one="Portable glove-plus-SLAM mocap for dexterous manipulation, collected without a robot in the loop.",
  device="Rokoko glove + LiDAR chest rig + SLAM", modal="RGB-D, finger joint angles, 6-DoF wrist pose, point cloud",
  hours="—", eps="—", tasks="dexterous manipulation", scenes="in-the-wild", subj="—",
  embod="LEAP hand + Franka", site="https://dex-cap.github.io/",
  note="The most direct hardware precedent for a world-action model from glove capture.")

# ──────────────────────────────────── TACTILE ───────────────────────────────────
D("touchandgo","2211.12498",cat="tactile",org="academia",
  one="Human-collected paired vision and touch in the wild — someone walking around probing objects with a tactile sensor.",
  device="GelSight + handheld camera", modal="RGB, tactile images",
  hours="—", eps="13,900 touches", tasks="—", scenes="indoor + outdoor", subj="3,971 objects",
  embod="handheld", site="https://touch-and-go.github.io/",
  note="In-the-wild rather than lab-bench tactile data, which is rare and what pretraining needs.")
D("objectfolder2","2204.02389",cat="tactile",org="academia",
  one="Virtualised objects with visual, acoustic and tactile neural representations, built for sim-to-real transfer.",
  device="simulated multisensory (neural implicit)", modal="visual, acoustic, tactile",
  hours="—", eps="1,000 objects", tasks="—", scenes="sim", subj="1,000 objects",
  embod="sim", site="https://objectfolder.stanford.edu/")
D("objectfolder-real","2306.00956",cat="tactile",org="academia",
  one="The real-world counterpart: measured vision, sound and touch for 100 physical household objects, with a 10-task benchmark.",
  device="scanning rig + GelSight + impact sound capture", modal="3D mesh, video, impact sounds, tactile",
  hours="—", eps="100 real objects", tasks="10 benchmark tasks", scenes="lab", subj="100 objects",
  embod="—", site="https://objectfolder.stanford.edu/",
  note="The sim-and-real pairing is what makes this useful for multisensory sim-to-real.")
D("tvl","2402.13232",cat="tactile",org="academia",
  one="In-the-wild vision-touch pairs with language labels — the dataset behind touch-vision-language alignment.",
  device="handheld DIGIT + camera", modal="tactile images, RGB, language",
  hours="—", eps="44K vision-touch pairs", tasks="—", scenes="in-the-wild", subj="—",
  embod="handheld", site="https://tactile-vlm.github.io/",
  note="90% of labels are GPT-4V pseudo-labels — useful, but know what you are training on.")
D("tlv","2403.09813",cat="tactile",org="academia",
  one="A touch-language-vision dataset with human-annotated tactile descriptions for semantic alignment.",
  device="tactile sensor + camera", modal="tactile, RGB, language",
  hours="—", eps="20K pairs", tasks="—", scenes="lab", subj="—", embod="—",
  site="https://arxiv.org/abs/2403.09813")
D("sparsh","2410.24090",cat="tactile",org="industry",
  one="Self-supervised touch representations plus TacBench — the closest thing tactile sensing has to a foundation model.",
  device="DIGIT, GelSight, Soft Bubbles", modal="tactile images",
  hours="—", eps="460K+ tactile images", tasks="TacBench: 6 tasks", scenes="lab", subj="—",
  embod="multiple sensors", site="https://sparsh-ssl.github.io/",
  note="Meta. Reports large gains over task-specific training — the tactile analogue of R3M, and the encoder to start from for a tactile world model.")
D("robotacdex","2606.31836",cat="tactile",org="academia",
  one="Paired visual-tactile action data for humanoid dexterous manipulation.",
  device="dexterous hand with tactile skin", modal="RGB, tactile, joint state, actions",
  hours="—", eps="—", tasks="dexterous manipulation", scenes="—", subj="—",
  embod="humanoid dexterous hand", site="https://arxiv.org/abs/2606.31836",
  note="Exactly the paired modality a tactile world model needs for pretraining.")

# ───────────────────────── HUMAN-ROBOT INTERACTION & MULTI-ROBOT ────────────────
D("jrdb","1910.11792",cat="hri",org="academia",
  one="A social-navigation perception dataset recorded from a robot moving among people indoors and outdoors.",
  device="JackRabbot robot: 360° stereo, 2× Velodyne, 2× Sick lidar, audio",
  modal="360° RGB, 3D point clouds, audio, IMU, odometry",
  hours="1.07 h (64 min)", eps="2.3M bounding boxes · 1.8M 3D cuboids", tasks="detection + tracking",
  scenes="indoor + outdoor campus", subj="3,500+ person trajectories", embod="JackRabbot",
  site="https://jrdb.erc.monash.edu/",
  note="The standard for robot-centric human perception. Short but exhaustively annotated.")
D("jrdbact","2106.08827",cat="hri",org="academia",
  one="JRDB extended with spatio-temporal action, social grouping and activity labels.",
  device="JackRabbot", modal="360° RGB, 3D, action + social group labels",
  hours="—", eps="2.8M action labels", tasks="action + social group detection", scenes="campus",
  subj="—", embod="JackRabbot", site="https://jrdb.erc.monash.edu/")
D("thormagni","2403.09285",cat="hri",org="academia",
  one="Large-scale indoor motion capture of humans moving and interacting with robots in a shared workspace.",
  device="Qualisys mocap + robot + eye-tracking glasses",
  modal="6-DoF human trajectories, robot trajectories, gaze, video",
  hours="3.5 h", eps="—", tasks="shared-space navigation + interaction", scenes="indoor lab",
  subj="40 participants", embod="differential-drive + mobile manipulator",
  site="http://thor.oru.se/",
  note="One of very few datasets with millimetre-accurate ground truth for both the human and the robot — the right substrate for measuring who adapts to whom.")
D("dexh2r","2506.23152",cat="hri",org="academia",
  one="Real-world human-to-robot handovers on a dexterous hand, with dense frame-level annotation.",
  device="dexterous robotic hand + multi-camera", modal="RGB-D, hand + object pose, robot state",
  hours="—", eps="4,282 handover trials · 456K frames", tasks="dynamic handover", scenes="lab",
  subj="39 participants · 56 objects", embod="dexterous hand",
  site="https://arxiv.org/abs/2506.23152",
  note="The largest real handover dataset on a multi-finger hand — the physical-HRI data that barely exists elsewhere.")
D("handoversim","2205.09747",cat="hri",org="industry",
  one="Simulation benchmark for human-to-robot handovers, driven by DexYCB human motion.",
  device="simulation (DexYCB-driven human)", modal="RGB-D, hand + object pose",
  hours="—", eps="1,000 handover scenarios", tasks="human-to-robot handover", scenes="sim",
  subj="—", embod="Panda + gripper", site="https://handover-sim.github.io/",
  note="NVIDIA. The standard evaluation protocol for handovers, and the reason later handover work is comparable at all.")
D("r2handoversim","2606.21011",cat="hri",org="academia",
  one="The reverse direction: a simulation benchmark for robot-to-human handovers, which had no standard protocol.",
  device="simulation", modal="RGB-D, hand + object pose",
  hours="—", eps="—", tasks="robot-to-human handover", scenes="sim", subj="—",
  embod="arm + gripper", site="https://arxiv.org/abs/2606.21011")
D("hribench","2607.13056",cat="multi",org="academia",
  one="Interaction-centric human-robot collaboration benchmark with role-conditioned tasks requiring synchronised multi-agent coordination.",
  device="simulation", modal="RGB, state, role conditioning",
  hours="—", eps="650+ evaluation episodes", tasks="13 role-conditioned tasks", scenes="sim",
  subj="—", embod="humanoid + human agent", site="https://arxiv.org/abs/2607.13056",
  note="Reports lifting GR00T N1.5's physical-task success from 0.10 to 0.43 using its simulated data — the most direct evidence that collaboration data is a real gap.")
D("humanthor","2406.06498",cat="multi",org="academia",
  one="Simulation platform and benchmark for human-robot collaboration in a shared workspace, with realistic human agents.",
  device="simulation (AI2-THOR based)", modal="RGB-D, scene state",
  hours="—", eps="—", tasks="shared-workspace collaboration", scenes="sim households",
  subj="simulated humans", embod="mobile manipulator", site="https://sites.google.com/view/humanthor")
D("scand","2203.15041",cat="hri",org="academia",
  one="Socially compliant navigation demonstrations — humans teleoperating robots through real crowds.",
  device="Spot + Jackal, joystick teleoperation", modal="3D lidar, RGB, joystick commands, odometry, IMU",
  hours="8.7 h", eps="138 trajectories · 25 miles", tasks="social navigation", scenes="public campus spaces",
  subj="—", embod="Spot, Clearpath Jackal", site="https://www.cs.utexas.edu/~xiao/SCAND/SCAND.html")
D("musohu","2303.14880",cat="hri",org="academia",
  one="Multi-modal recordings of human navigation behaviour, captured to teach robots to move like people do.",
  device="human-worn sensor rig", modal="RGB-D, 3D lidar, IMU, GPS, audio",
  hours="20 h", eps="300 trials · ~100 km", tasks="social navigation", scenes="public spaces",
  subj="13 humans", embod="human (for robot transfer)", site="https://arxiv.org/abs/2303.14880")

# ──────────────────────────── HUMAN MOTION / HUMANOID ───────────────────────────
D("amass","1904.03278",cat="motion",org="academia",
  one="Fifteen optical mocap datasets unified into one SMPL body parameterisation — the backbone of humanoid motion imitation.",
  device="optical marker-based mocap (15 sources)", modal="SMPL body pose + shape",
  hours="40+ h", eps="11,000+ motions", tasks="—", scenes="mocap studios", subj="300+ subjects",
  embod="human (retargetable)", site="https://amass.is.tue.mpg.de/",
  note="Everything from DeepMimic descendants through PHC, H2O and HOVER is trained on retargeted AMASS.")
D("motionx","2307.00818",cat="motion",org="academia",
  one="Expressive whole-body motion including hands and face, annotated at frame level with text.",
  device="multi-source video + annotation pipeline", modal="SMPL-X whole-body pose, text descriptions",
  hours="—", eps="81.1K motion sequences · 15.6M pose annotations", tasks="—", scenes="in-the-wild",
  subj="—", embod="human (retargetable)", site="https://motion-x-dataset.github.io/",
  note="Hands and face, which AMASS lacks — relevant if your humanoid has fingers.")
D("humanoidx","2412.14172",cat="motion",org="academia",
  one="Twenty million humanoid robot poses with paired text descriptions, mined from massive human video.",
  device="human video → pose → retargeting pipeline", modal="humanoid joint poses, text",
  hours="—", eps="20M+ humanoid poses", tasks="text-conditioned pose control", scenes="in-the-wild",
  subj="—", embod="Unitree H1", site="https://usc-gvl.github.io/UH-1/",
  note="Already retargeted to a real humanoid, which saves the step everyone else redoes.")

# ─────────────────────────────── SIM BENCHMARKS ────────────────────────────────
D("metaworld","1910.10897",cat="sim",org="academia",
  one="Fifty distinct simulated manipulation tasks for multi-task and meta-RL — the standard generalisation suite.",
  device="simulation (MuJoCo)", modal="state, RGB", hours="—", eps="—", tasks="50 tasks",
  scenes="sim tabletop", subj="—", embod="Sawyer (sim)", site="https://meta-world.github.io/")
D("calvin","2112.03227",cat="sim",org="academia",
  one="Long-horizon language-conditioned manipulation with a strict evaluation protocol for instruction chaining.",
  device="simulation (PyBullet)", modal="RGB-D, proprioception, language",
  hours="—", eps="24 h of teleoperated play per environment", tasks="34 tasks", scenes="4 environments",
  subj="—", embod="Franka (sim)", site="http://calvin.cs.uni-freiburg.de/")
D("libero","2306.03310",cat="sim",org="academia",
  one="Lifelong-learning benchmark probing knowledge transfer across task suites — the default VLA evaluation.",
  device="simulation (robosuite)", modal="RGB, proprioception, language",
  hours="—", eps="130 tasks × 50 demos", tasks="130 tasks", scenes="sim", subj="—",
  embod="Franka (sim)", site="https://libero-project.github.io/",
  note="Everyone reports on it, which makes saturation weak evidence of anything real.")
D("robocasa","2406.02523",cat="sim",org="academia",
  one="Large-scale simulated household kitchens with generative scene and task variation.",
  device="simulation (MuJoCo/robosuite)", modal="RGB-D, proprioception, language",
  hours="—", eps="100K+ trajectories", tasks="100 tasks", scenes="120 kitchen scenes",
  subj="2,500+ objects", embod="mobile manipulator (sim)", site="https://robocasa.ai/")
D("behavior1k","2403.09227",cat="sim",org="academia",
  one="A thousand everyday household activities chosen by surveying what people actually want robots to do.",
  device="simulation (OmniGibson)", modal="RGB-D, segmentation, physics state",
  hours="—", eps="1,000 activities", tasks="1,000 activities", scenes="50 scenes",
  subj="9,000+ objects", embod="multiple (sim)", site="https://behavior.stanford.edu/",
  note="Includes fluids, soft bodies and cloth, which almost no other benchmark simulates at all.")
D("roboverse","2504.18904",cat="sim",org="consortium",
  one="A unified platform, dataset and benchmark that bridges many existing simulators under one interface.",
  device="multi-simulator", modal="RGB-D, state, language",
  hours="—", eps="—", tasks="—", scenes="sim", subj="—", embod="many (sim)",
  site="https://roboverseorg.github.io/")
D("maniskill3","2410.00425",cat="sim",org="academia",
  one="GPU-parallel physics and rendering together, for vision-based policies that need throughput on both.",
  device="simulation (SAPIEN)", modal="RGB-D, point cloud, state",
  hours="—", eps="—", tasks="12 task families", scenes="sim", subj="—",
  embod="many (sim)", site="https://maniskill.readthedocs.io/")
D("humanoidbench","2403.10506",cat="sim",org="academia",
  one="Whole-body humanoid locomotion and manipulation tasks — and an honest finding that current RL solves the first and fails the second.",
  device="simulation (MuJoCo)", modal="state, RGB", hours="—", eps="—", tasks="27 tasks",
  scenes="sim", subj="—", embod="Unitree H1 (sim)", site="https://humanoid-bench.github.io/")

# ────────────────────────────── THIRD-PERSON VIDEO ─────────────────────────────
D("ssv2","1706.04261",cat="exo",org="industry",
  one="Crowd-acted third-person clips of basic physical interactions, built to test whether models understand physical causality rather than object identity.",
  device="crowdsourced handheld video", modal="RGB, action class",
  hours="—", eps="220,847 videos", tasks="174 action templates", scenes="in-the-wild", subj="crowd workers",
  embod="human (third-person)", site="https://www.qualcomm.com/developer/software/something-something-v-2-dataset",
  note="Still the sharpest test of physical rather than semantic video understanding.")
D("howto100m","1906.03327",cat="exo",org="academia",
  one="136 million clips from 1.22M narrated instructional web videos — the largest source of humans explaining tasks while doing them.",
  device="web video (YouTube)", modal="RGB, ASR narration",
  hours="15 years of video", eps="136M clips", tasks="23K visual tasks", scenes="in-the-wild", subj="—",
  embod="human (third-person)", site="https://www.di.ens.fr/willow/research/howto100m/",
  note="Noisy and enormous. The natural pretraining corpus for third-person learning, if you can handle the noise.")
D("assembly101","2203.14712",cat="exo",org="academia",
  one="Multi-view procedural assembly and disassembly with both fixed and egocentric cameras and dense hand poses.",
  device="8 static RGB + 4 head-mounted monochrome", modal="RGB, multi-view, 3D hand poses, action segments",
  hours="513 h", eps="4,321 videos", tasks="101 toy vehicles · 1M fine-grained segments", scenes="lab",
  subj="53 participants", embod="human (ego + exo)", site="https://assembly-101.github.io/",
  note="Both viewpoints and 18M hand poses — a good testbed for the ego-versus-exo comparison at task level.")

# ══════════════════════ THE MILLION-HOUR TIER (2025-26) ══════════════════════
# Egocentric capture crossed from "thousands of hours" to "a million" inside about
# six months. These are the releases that did it.
D("egocentric1m","",name="Egocentric-1M",cat="ego",org="industry",
  one="Roughly one million hours of factory-floor egocentric video — larger than every prior egocentric dataset combined, released open under Apache 2.0.",
  device="Build AI custom head-mounted glasses",
  modal="RGB (streamable, no full download required)",
  hours="~1,000,000 h", eps="10.8 billion frames · gated on Hugging Face", tasks="assembly, sorting, packaging, machining",
  scenes="real production floors, Southeast Asia", subj="14,228 factory workers",
  embod="human", site="https://huggingface.co/builddotai",
  year=2026, date="2026-04-08",
  note="Build AI's scaling ladder went 10K hours (Nov 2025) → 100K (Dec 2025) → 1M (Apr 2026). The framing "
       "to hold onto: this is industrial repetitive labour, not household diversity, so it is enormous and "
       "narrow at the same time. Whether that narrowness matters is an open empirical question and a very "
       "cheap one to test.")
D("egocentric100k","",name="Egocentric-100K",cat="ego",org="industry",
  one="The 100,000-hour rung of Build AI's ladder — the release that made million-hour egocentric look inevitable.",
  device="Build AI head-mounted glasses", modal="RGB",
  hours="100,000 h", eps="—", tasks="industrial manual work", scenes="factory floors", subj="—",
  embod="human", site="https://huggingface.co/datasets/builddotai/Egocentric-100K",
  year=2025, date="2025-12-01")
D("egocentric10k","",name="Egocentric-10K",cat="ego",org="industry",
  one="The first rung: 10,000 hours of factory egocentric video, November 2025.",
  device="Build AI head-mounted glasses", modal="RGB",
  hours="10,000 h", eps="—", tasks="industrial manual work", scenes="factory floors", subj="—",
  embod="human", site="https://huggingface.co/datasets/builddotai/Egocentric-10K",
  year=2025, date="2025-11-01")
D("xperience10m","",name="Xperience-10M",cat="ego",org="industry",
  one="Ten thousand hours of egocentric recording with six synchronised RGB streams, stereo depth, SLAM pose and full hand-plus-body motion capture — roughly a petabyte.",
  device="Ropedia multi-camera capture rig",
  modal="6× RGB, audio, stereo depth, camera pose/SLAM, hand mocap, full-body mocap, IMU, hierarchical language",
  hours="10,000 h", eps="10M experiences · 2.88B RGB + 720M depth + 576M pose/mocap frames",
  tasks="hierarchical task/sub-task annotation", scenes="—", subj="—",
  embod="human", site="https://huggingface.co/datasets/ropedia-ai/xperience-10m",
  year=2026, date="2026-01-01",
  note="The richest egocentric annotation stack that exists — depth, SLAM and mocap all synchronised. Where "
       "Egocentric-1M has scale and nothing else, this has everything a real-to-sim or retargeting pipeline "
       "needs. If you only adopt one corpus for the Real2Sim2Real project, it is probably this one.")
D("humannet","2605.06747",cat="ego",org="industry",
  one="A human-centric video learning stack built to scale to one million hours, with controlled VLA ablations on the value of the data.",
  device="aggregated human video", modal="RGB, language, action labels",
  hours="1,000,000 h (stated)", eps="—", tasks="—", scenes="—", subj="—",
  embod="human → robot", site="https://arxiv.org/abs/2605.06747",
  note="Read it for the ablation rather than the corpus: it is one of the few papers that isolates what an "
       "extra order of magnitude of human video actually buys a VLA. Caveat: the million-hour figure is the "
       "paper's stated scale — its controlled ablations run at far smaller sizes, so treat the headline as a "
       "design target rather than a corpus you can download today.")
D("egoscale","2602.16710",cat="ego",org="industry",
  one="NVIDIA GEAR's scaling study: a VLA trained on 20,854 hours of action-labelled egocentric human video, with a measured log-linear scaling law.",
  device="aggregated egocentric + retargeting pipeline",
  modal="RGB, wrist motion, retargeted dexterous hand actions",
  hours="20,854 h", eps="—", tasks="dexterous manipulation", scenes="—", subj="—",
  embod="human → dexterous robot", site="https://research.nvidia.com/labs/gear/egoscale/",
  note="The most important number in this table for your ego-dexterity idea: validation loss falls log-linearly "
       "with human data scale, and that loss correlates with real-robot performance. It turns 'more human video "
       "helps' from a hope into a predictable curve.")
D("ego2robot","2608.02580",cat="ego",org="academia",
  one="A pipeline that converts egocentric human video into robot training data, producing 18,561 hours across 15 robot morphologies — the largest ego-to-robot corpus to date.",
  device="egocentric video → retargeting → visual synthesis",
  modal="RGB (synthesised robot arm), retargeted actions",
  hours="18,561 h", eps="—", tasks="manipulation", scenes="curated + in-the-wild", subj="15 robot morphologies",
  embod="15 robot morphologies", site="https://arxiv.org/abs/2608.02580",
  note="The other half of the million-hour story: raw human hours are useless until something turns them into "
       "actions. Action retargeting + robot-arm visual synthesis + multi-level quality curation is the recipe.")
D("egolive","2604.23570",cat="ego",org="industry",
  one="Large-scale egocentric capture from real-world human tasks, positioned on breadth of semantic coverage rather than raw hours.",
  device="head-mounted capture", modal="RGB, task annotations",
  hours="—", eps="—", tasks="real-world human tasks", scenes="in-the-wild", subj="—",
  embod="human", site="https://arxiv.org/abs/2604.23570",
  note="Argues that the long tail of semantics matters more than hour count, and benchmarks itself against "
       "EgoDex and Xperience-10M on exactly that. Worth reading as the counter-argument to pure scaling.")
D("aceego0","2606.17200",cat="ego",org="academia",
  one="A VLA pretraining framework that mixes robot, simulation and pseudo-action-labelled egocentric human data in one recipe.",
  device="aggregated", modal="RGB, robot actions, pseudo-action labels",
  hours="4.53K h robot+sim · 1.48K h human", eps="—", tasks="manipulation", scenes="—", subj="—",
  embod="multiple", site="https://arxiv.org/abs/2606.17200",
  note="The mixing ratio between robot, sim and human data is the real content here — the question everyone "
       "training a VLA has to answer and almost nobody reports.")
D("egokit","2605.16797",cat="ego",org="academia",
  one="An open, low-cost toolkit for collecting egocentric data across heterogeneous devices, including XR headsets with 26-joint hand tracking.",
  device="phones, action cams, XR headsets (unified)",
  modal="RGB, head pose, OpenXR 26-joint hand tracking",
  hours="—", eps="—", tasks="—", scenes="—", subj="—",
  embod="human", site="https://arxiv.org/abs/2605.16797",
  note="If you want to run your own egocentric collection rather than consume someone else's, this is the "
       "cheapest credible starting point.")
D("humanego","2605.24934",cat="ego",org="academia",
  one="The opposite bet from scaling: zero-shot robot learning from as little as 30 minutes of human egocentric video per task.",
  device="head-mounted camera", modal="RGB, hand pose",
  hours="0.5 h per task", eps="—", tasks="4 real-world tasks", scenes="—", subj="—",
  embod="robot arm", site="https://arxiv.org/abs/2605.24934",
  note="92.5% success from 30 minutes of human video, beating matched-time robot teleoperation by 41%. The "
       "sharpest counterpoint in this whole table to the million-hour thesis — worth taking seriously before "
       "you commit to a collection campaign.")
D("hrdt","2507.23523",cat="ego",org="academia",
  one="Bimanual manipulation improved by pretraining on large-scale egocentric human video with paired 3D hand poses.",
  device="aggregated egocentric + bimanual robot", modal="RGB, 3D hand pose, robot actions",
  hours="—", eps="—", tasks="bimanual manipulation", scenes="sim + real", subj="—",
  embod="bimanual", site="https://arxiv.org/abs/2507.23523")
D("egoemg","2605.05712",cat="ego",org="academia",
  one="Egocentric video paired with bilateral wrist EMG — muscle activity as a modality vision cannot see.",
  device="2× 8-channel wrist EMG @2 kHz, IMU, ego RGB, external RGB-D, mocap",
  modal="EMG, IMU, RGB, RGB-D, hand mocap",
  hours="10+ h", eps="—", tasks="60 gesture classes (30 single-hand, 30 bimanual)", scenes="lab",
  subj="41 participants", embod="human", site="https://arxiv.org/abs/2605.05712",
  note="Unusual and under-explored: EMG carries intent and force before motion is visible, which is exactly "
       "the gap a vision-only world model has.")
D("egoexo-handrig","2510.02601",cat="ego",org="industry",
  one="In-the-wild 3D hand tracking from a mobile multi-camera ego-exo rig, built to get ground truth outside the lab.",
  device="mobile multi-camera ego+exo rig", modal="RGB multi-view, 3D hand pose",
  hours="—", eps="—", tasks="hand tracking", scenes="in-the-wild", subj="—",
  embod="human", site="https://arxiv.org/abs/2510.02601")
D("agibot2026","",name="AgiBot World 2026",cat="robot",org="industry",
  one="AgiBot's 2026 release, aimed at reinforcement learning rather than imitation: real-world trajectories across industrial and household tasks.",
  device="AgiBot fleet, teleoperation", modal="RGB-D, proprioception, reward/task annotations",
  hours="—", eps="11,430 real-world trajectories", tasks="14 industrial and household tasks", scenes="—",
  subj="—", embod="AgiBot G1", site="https://agibot-world.com/",
  year=2026, date="2026-04-01",
  note="Small next to the original million-trajectory AgiBot World, and deliberately so — it is structured for "
       "RL, which almost no large robot dataset is. Released with Shanghai AI Lab and the National-Local "
       "Humanoid Robotics Innovation Centre.")

# ══════════════ MULTI-ROBOT & HUMAN-ROBOT INTERACTION (expanded) ══════════════
D("rocobench","2307.04738",cat="multi",org="academia",
  one="The reference multi-robot collaboration benchmark: six tabletop tasks that need both high-level communication and coordinated multi-arm motion planning.",
  device="simulation + real multi-arm", modal="state, RGB, language dialogue",
  hours="—", eps="text dataset for agent reasoning", tasks="6 collaboration tasks", scenes="tabletop",
  subj="—", embod="multi-arm (sim + real)", site="https://project-roco.github.io/",
  note="RoCoBench is what almost every LLM multi-robot paper now reports on. It also supports human-in-the-loop, "
       "so a person can be one of the agents — the bridge to your HRI idea.")
D("rocochallenge","2603.15469",cat="multi",org="consortium",
  one="An AAAI 2026 challenge on collaborative assembly, released with a teleoperated dual-arm mobile manipulation dataset.",
  device="dual-arm mobile platform, teleoperation",
  modal="RGB, depth, proprioception, action streams (synchronised)",
  hours="—", eps="300+ teleoperated demonstrations", tasks="collaborative assembly", scenes="industrial",
  subj="60+ teams, 170+ participants, 10+ countries", embod="dual-arm mobile manipulator",
  site="https://arxiv.org/abs/2603.15469",
  note="One of the very few real-robot collaborative-manipulation datasets that exists, and it comes with a "
       "leaderboard. Directly usable for M2 as a baseline setting rather than a from-scratch build.")
D("comuros","2511.22354",cat="multi",org="academia",
  one="A heterogeneous-team benchmark of scenarios and tasks spanning roughly twenty robots, with a task-manager LLM allocating subtasks to robot-level LLMs.",
  device="simulation + hardware", modal="state, language, ROS2 skill traces",
  hours="—", eps="22 scenarios", tasks="54 tasks", scenes="—", subj="~20 robots",
  embod="heterogeneous team", site="https://arxiv.org/abs/2511.22354",
  note="Interesting for M2 because it reports recovery from disruptive events and coordinated transport with "
       "emergent human-robot cooperation — i.e. it measures robustness, not just success.")
D("ga3t","2605.06478",cat="multi",org="academia",
  one="A real-world ground-aerial collaborative perception dataset: a Husky UGV and an Autel UAV working the same unstructured terrain together.",
  device="Clearpath Husky UGV + Autel EVO II UAV", modal="RGB, LiDAR, IMU, GPS, cross-agent views",
  hours="—", eps="—", tasks="terrain traversability, collaborative perception", scenes="unstructured outdoor",
  subj="2 heterogeneous agents", embod="UGV + UAV", site="https://arxiv.org/abs/2605.06478",
  note="Rare: an actual real-world multi-robot dataset rather than a simulator. Aerial-ground rather than "
       "manipulation, but the cross-agent perception problem is the same one M2 has.")
D("hercules","2606.22756",cat="multi",org="academia",
  one="An open simulation framework and benchmark for heterogeneous multi-robot SLAM, collaborative perception and exploration.",
  device="simulation (Unreal Engine 5 / AirSim)", modal="RGB, depth, LiDAR, IMU, ground-truth poses",
  hours="—", eps="—", tasks="collaborative SLAM, exploration", scenes="large-scale sim",
  subj="concurrent aerial + ground agents", embod="UAV + UGV", site="https://arxiv.org/abs/2606.22756")
D("kaiwu","2503.05231",cat="hri",org="academia",
  one="A multimodal manipulation dataset that records the human, the environment and the robot together — built for robot learning and HRI at once.",
  device="mocap + multi-view cameras + robot", modal="RGB-D, human pose, object pose, robot state, force",
  hours="—", eps="11,664 integrated instances", tasks="manipulation + interaction", scenes="lab",
  subj="20 subjects · 30 objects", embod="robot arm", site="https://arxiv.org/abs/2503.05231",
  note="Unusual in capturing all three streams synchronously. If you want to measure who adapts to whom in a "
       "collaboration, this is the closest existing data.")
D("interact","2311.12943",cat="hri",org="academia",
  one="Human-robot collaborative manipulation data where human intent is predicted *conditioned on what the robot does* — with the teleoperation setup open-sourced.",
  device="7-DoF arm teleoperation + human motion capture", modal="RGB-D, human pose, robot state",
  hours="—", eps="—", tasks="collaborative manipulation", scenes="tabletop", subj="—",
  embod="7-DoF arm", site="https://arxiv.org/abs/2311.12943",
  note="The conditioning is the point: most intent-prediction datasets treat the human as if the robot were not "
       "there. This one does not, which is exactly the framing your HRI idea needs.")
D("mogaze","2011.11552",cat="hri",org="academia",
  one="Long manipulation sequences with full-body motion, the 3D geometry of the workspace, and eye gaze — three things rarely captured together.",
  device="optical mocap + eye tracker + scanned workspace",
  modal="full-body 3D motion, eye gaze, workspace geometry, object poses",
  hours="—", eps="~3 h of manipulation sequences", tasks="pick-and-place sequences", scenes="scanned lab",
  subj="6 participants", embod="human (for robot prediction)",
  site="https://humans-to-robots-motion.github.io/mogaze/",
  note="Eye gaze is the strongest early signal of human intent and almost nothing else records it alongside "
       "full-body motion and scene geometry.")

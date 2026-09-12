# -*- coding: utf-8 -*-
"""Teleoperation systems, whole-body control, and the human-to-robot embodiment
gap — the three things MABEL actually runs on. Metadata from mabel_papers.json."""
import json, os, re
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=json.load(open(os.path.join(HERE,"mabel_papers.json")))
ROWS=[]
ANN={
# ─────────────────── teleoperation systems ───────────────────
"2502.13013":("homie","systems","interfaces","isomorphic exoskeleton cockpit, pedal locomotion, data flywheel","teleop, RL",
  "learned-retargeting,mobile-dex-umi","mabel",3,
  "The most complete teleoperation cockpit published: an RL body policy driven by a <b>pedal</b>, an isomorphic "
  "exoskeleton arm, and motion gloves for the hands — one operator, whole robot. The pedal is the design "
  "insight worth stealing: it frees both arms for manipulation while still giving continuous locomotion "
  "command, which every VR-based humanoid teleop rig struggles with. Open-sourced as OpenHomie.",
  "twist,ace-teleop,telemoma,omnih2o,hover,ume"),
"2505.02833":("twist","systems","interfaces","whole-body imitation teleoperation, real-time retargeting","teleop, RL",
  "learned-retargeting","mabel",3,
  "Teleoperated whole-body imitation from a single human demonstrator, with GMR as its retargeter. The pairing "
  "matters: TWIST is the system, [[gmr]] is the retargeting quality it depends on, and the two together are "
  "the cleanest current recipe for 'human moves, humanoid follows' at full body scale.",
  "gmr,homie,h2o,omnih2o,hover,exbody2"),
"2408.11805":("ace-teleop","systems","interfaces","cross-platform exoskeleton, hand-facing camera, low cost","teleop",
  "learned-retargeting,mobile-dex-umi","mabel,geodex",3,
  "One rig that teleoperates humanoid hands, arm-hand, arm-gripper and quadruped-gripper systems — a "
  "hand-facing camera for finger pose plus a portable exoskeleton base for the wrist. The cross-platform claim "
  "is the valuable part for MABEL: build the interface once, retarget to whatever the robot becomes.",
  "homie,exo-viha,anyteleop,dexumi,gello"),
"2403.07869":("telemoma","systems","interfaces","modular teleoperation, mobile manipulation, multi-interface","teleop",
  "mobile-dex-umi,learned-retargeting","mabel,m2",3,
  "A modular whole-body teleop interface for <b>mobile</b> manipulators that unifies RGB-D, VR controllers, "
  "keyboard and joystick — and mixes them. Demonstrated on Tiago++, HSR and Fetch. If MABEL needs one "
  "teleop stack that survives changing the input device, this is the architecture.",
  "homie,mobile-aloha,tidybot2,gello,modpack"),
"2503.01543":("exo-viha","systems","interfaces","exoskeleton with visual and haptic feedback, skill learning","teleop",
  "learned-retargeting","mabel,geodex",2,
  "Cross-platform exoskeleton with both visual and haptic feedback. Haptics is the channel almost every "
  "low-cost rig drops, and it is what lets the operator feel a failed grasp before the camera shows it.",
  "ace-teleop,doglove,homie,ume"),
"2602.06643":("hmi-robotfree","systems","interfaces","robot-free demonstrations, whole-body manipulation","teleop, IL",
  "mobile-dex-umi,wam-umi-gloves,learned-retargeting","mabel,wam-tactile",3,
  "Humanoid Manipulation Interface — UMI's argument extended to the <b>whole body</b>: collect whole-body "
  "manipulation demonstrations with no robot present. This is the single most MABEL-relevant paper in this "
  "batch, and it is close enough to your mobile-dexterous-UMI idea that you should read it before writing "
  "that proposal.",
  "umi,ume,umi-on-legs,homie,dexumi,realdexumi"),

# ─────────────────── wheeled humanoids (MABEL's actual morphology) ───────────────────
"2307.01350":("wheeled-bilateral","rl","loco-manip","wheeled humanoid, bilateral teleoperation, dynamic loco-manipulation","teleop, control",
  "learned-retargeting,hri-collab","mabel",3,
  "A wheeled humanoid doing dynamic mobile manipulation under whole-body bilateral teleoperation. MABEL is a "
  "wheeled humanoid, and this line of work is the closest existing control literature to that morphology — "
  "the balance problem on wheels is genuinely different from legs and is under-served in the RL literature.",
  "wheeled-posforce,wheeled-payload,wheeled-multistage,falcon,deep-wbc"),
"2407.12189":("wheeled-posforce","rl","loco-manip","position-force control modes, bilateral teleoperation, wheeled humanoid","control, teleop",
  "learned-retargeting,hri-collab","mabel,m2",3,
  "Already in your M2 library. Switching between position and force control modes during wheeled-humanoid "
  "teleoperation — which is exactly the decision MABEL has to make when it goes from reaching to pushing.",
  "wheeled-bilateral,wheeled-multistage,falcon,ume"),
"2508.09846":("wheeled-multistage","rl","loco-manip","object parameter estimation, bilateral teleoperation, wheeled loco-manipulation","control",
  "learned-retargeting,real2sim2real-ego","mabel",2,
  "Multi-stage estimation of the manipulated object's parameters during wheeled-humanoid teleoperation. On a "
  "balancing base, an unknown payload is not a nuisance — it changes the plant. Estimating it online is the "
  "difference between carrying a box and falling over.",
  "wheeled-payload,wheeled-posforce,falcon,asap"),
"2403.10948":("wheeled-payload","rl","sim2real","unknown payloads, equilibrium point estimation, real-to-sim adaptation","control, real2sim",
  "real2sim2real-ego","mabel",2,
  "Equilibrium-point estimation for wheeled humanoids carrying unknown payloads, via real-to-sim adaptation. "
  "The real-to-sim framing connects it straight to your Real2Sim2Real project, on the exact morphology MABEL "
  "has.", "wheeled-multistage,asap,real2sim,dexndm"),

# ─────────────────── whole-body control ───────────────────
"2412.13196":("exbody2","rl","motion-imitation","expressive whole-body tracking, velocity decoupling, teacher filtering","RL",
  "learned-retargeting","mabel",3,
  "The successor to ExBody, and the current reference for general whole-body motion tracking. Two ideas carry: "
  "decouple whole-body velocity tracking from body-landmark tracking, and use a teacher policy to <b>filter out "
  "motions the robot physically cannot do</b> before training on them. That filtering step is why most tracking "
  "pipelines fail on raw mocap.",
  "exbody,hugwbc,amo,resmimic,gmr,hover"),
"2505.03738":("amo","rl","loco-manip","adaptive motion optimization, hyper-dexterous whole-body control","RL, control",
  "learned-retargeting,mobile-dex-umi","mabel",3,
  "Sim-to-real RL fused with online trajectory optimization for real-time whole-body control on a 29-DoF "
  "Unitree G1, reporting a materially expanded workspace. The hybrid — learned policy for robustness, "
  "optimizer for reach — is the pragmatic answer when pure RL cannot hit the corner of the workspace.",
  "hugwbc,exbody2,falcon,hover,handoff"),
"2502.03206":("hugwbc","rl","locomotion","unified whole-body controller, gait parameterisation, upper-body intervention","RL",
  "learned-retargeting","mabel",3,
  "One policy producing walking, running, jumping, standing and hopping with <b>tunable</b> frequency, swing "
  "height, body height, waist rotation and pitch — and it accepts real-time upper-body intervention from a "
  "teleoperator while holding the gait. That last property is what makes it a loco-manipulation controller "
  "rather than a locomotion one, and it is the interface MABEL wants underneath its arms.",
  "hover,exbody2,amo,cross-humanoid-wbc,homie"),
"2602.05791":("cross-humanoid-wbc","rl","locomotion","cross-embodiment whole-body control, scalability","RL",
  "learned-retargeting","mabel",2,
  "Whole-body control that scales across different humanoid bodies rather than being retrained per robot. "
  "Relevant if MABEL's morphology keeps changing — which, during a hardware programme, it will.",
  "hugwbc,crossformer,chorus,exbody2"),
"2510.05070":("resmimic","rl","loco-manip","residual learning, motion tracking to loco-manipulation","RL",
  "wm-residual,learned-retargeting","mabel",3,
  "Takes a general motion-tracking policy and adds a <b>residual</b> to turn it into whole-body "
  "loco-manipulation, rather than retraining from scratch. The residual pattern shows up everywhere in this "
  "library ([[asap]], [[pld]], [[omnitactune]]) and this is its whole-body instance.",
  "asap,pld,exbody2,falcon,amo"),
"2510.11258":("demohlm","rl","loco-manip","one demonstration, generalizable loco-manipulation","RL, IL",
  "mobile-dex-umi","mabel",2,
  "One demonstration to generalizable humanoid loco-manipulation. The sample-efficiency claim is the "
  "interesting one — compare against [[humanego]]'s thirty-minutes result before assuming you need scale.",
  "humanego,resmimic,falcon,one-demo"),
"2511.21169":("kinematics-multipolicy","rl","loco-manip","force-capable loco-manipulation, multi-policy RL","RL",
  "hri-collab","mabel,m2",2,
  "Kinematics-aware multi-policy RL for force-capable loco-manipulation. Read alongside [[falcon]] — both are "
  "attacking the same problem (a humanoid that can actually push and pull) from different structural choices.",
  "falcon,amo,resmimic,h2compact"),
"2606.06493":("handoff","rl","loco-manip","task-space whole-body control, distilled teachers, agentic","RL",
  "agentic-physical,learned-retargeting","mabel",2,
  "Agentic task-space whole-body control distilled from complementary teacher policies. The distillation of "
  "several specialist teachers into one deployable policy is the same move [[hover]] makes for command modes.",
  "hover,amo,maskedmimic,exbody2"),
"2605.21133":("spatial-brain","rl","loco-manip","whole-body manipulation, spatial reasoning, generalizable action","VLA, RL",
  "agentic-physical","mabel",2,
  "Splits humanoid whole-body manipulation into an 'active spatial brain' and a 'generalizable action "
  "cerebellum' — the dual-system split again, this time with spatial reasoning as the slow half.",
  "groot-n1,helix,cosmos-reason,handoff"),
"2510.14454":("adaptive-tracking","rl","motion-imitation","adaptive motion tracking, controllability","RL",
  "learned-retargeting","mabel",2,
  "Adaptive motion tracking for humanoid control — the tracking policy adjusts rather than assuming the "
  "reference is feasible. Complementary to ExBody2's filter-before-training approach.",
  "exbody2,resmimic,phc,hover"),
"2512.11047":("wholebodyvla","il","vla","unified latent VLA, whole-body loco-manipulation","VLA",
  "mobile-dex-umi,wam-umi-gloves","mabel,m2",3,
  "ICLR 2026. A unified <b>latent</b> VLA for whole-body loco-manipulation — one model issuing both base and "
  "arm commands through a shared latent action space rather than two stacked controllers. If it holds, it "
  "collapses the manipulation/locomotion interface that [[umi-on-legs]] carefully separates, which is a real "
  "architectural fork for MABEL.",
  "umi-on-legs,motionwam,groot-n1,chorus,decowam"),
"2606.09215":("motionwam","il","world-models","foundation world-action model, real-time loco-manipulation","world model, VLA",
  "wam-umi-gloves,mobile-dex-umi","mabel,wam-tactile",3,
  "A world-action model aimed at <b>real-time</b> humanoid loco-manipulation — the constraint most WAM work "
  "ducks, since a world model that needs 200 ms per step cannot close a balance loop. Read with [[decowam]] "
  "and [[mobilewam]].",
  "decowam,mobilewam,dream-tac,wholebodyvla,vjepa2"),
"2508.03068":("handeye-delivery","rl","loco-manip","navigation, locomotion and reaching in one policy","RL",
  "mobile-dex-umi","mabel",2,
  "Learns navigation, locomotion and reaching together for an autonomous delivery task. The end-to-end "
  "framing — no separate nav stack — is the opposite bet from MABEL's current modular design and worth "
  "knowing as the alternative.",
  "fetchman,visualmimic,umi-on-legs,homer"),

# ─────────────────── human → robot embodiment gap ───────────────────
"2605.00078":("being-h07","il","world-models","latent world-action model, egocentric video pretraining","world model, VLA",
  "ego-dex,wam-umi-gloves,third-person","r2s2r,wam-tactile,mabel",3,
  "A latent world-action model learned from egocentric human video — the Being-H0 line moved from VLA "
  "pretraining to world-action modelling. This is the closest published system to your UMI-glove WAM idea "
  "and it works from ordinary human video rather than instrumented capture.",
  "egoscale,ego2robot,vjepa2,dream-tac,motionwam"),
"2510.02252":("gmr","il","retargeting","general motion retargeting, tracking fidelity, real-time CPU","teleop",
  "learned-retargeting","mabel",3,
  "Retargeting Matters — and the title is the finding. It shows that retargeting quality, not policy quality, "
  "often determines whether whole-body tracking works, and closes most of the gap to closed-source baselines. "
  "Runs in real time on CPU and is the retargeter behind [[twist]]. Your learned-retargeting idea should treat "
  "this as the baseline to beat.",
  "twist,h2o,hover,c2dex,human2humanoid,retarget-objectives"),
"2606.03476":("human2humanoid","il","retargeting","physics-aware retargeting, cross-morphology","teleop",
  "learned-retargeting","mabel",3,
  "Physics-aware cross-morphology retargeting: respect dynamics, not just kinematics, when mapping a human "
  "onto a robot with different mass distribution. Together with [[gmr]] and [[c2dex]] this is now a real "
  "sub-field — and the three of them bound what is left of your learned-retargeting idea.",
  "gmr,c2dex,x-op,h2o,retarget-objectives"),
"2506.09384":("retarget-objectives","il","retargeting","retargeting objectives, ablation, dexterous manipulation","teleop",
  "learned-retargeting","mabel,geodex",3,
  "An ablation of what the retargeting objective should actually optimize for dexterous manipulation. This is "
  "the closest existing thing to the <b>benchmark</b> your learned-retargeting idea proposes — read it first "
  "and decide whether to extend it rather than start over.",
  "gmr,c2dex,human2humanoid,dexpilot,anyteleop"),
"2605.15157":("hand-in-loop","rl","post-training","hand-arm intervention, VLA improvement, dexterous manipulation","RL, VLA",
  "rl-post-training,hri-collab","mabel,geodex",2,
  "Seamless hand-arm human intervention to improve a dexterous VLA — HIL-SERL's idea carried into "
  "multi-finger manipulation, where taking over mid-episode is much harder than with a gripper.",
  "hil-serl,pi06,pld,ript-vla"),
"2604.24681":("intention-priors","il","human-video","human-intention priors, large-scale demonstrations","IL",
  "ego-dex,hri-collab,third-person","r2s2r,mabel",2,
  "Learns intention priors from large-scale human demonstrations rather than action labels. A different answer "
  "to the embodiment gap: transfer the <em>intent</em>, and let the robot solve the kinematics itself.",
  "egoscale,ego2robot,humanoid-policy,interact"),
"2512.07765":("phhi-survey","rl","loco-manip","physical human-humanoid interaction, survey, control and intent","survey",
  "hri-collab,multi-robot-marl","mabel,m2",3,
  "A survey of physical human-humanoid interaction across control, intent and modelling, with an explicit "
  "agenda for what comes next. Start your HRI literature review here — it is the most recent map, and it "
  "covers the physical-contact case rather than the social-navigation case most HRI surveys default to.",
  "h2compact,falcon,intention-tracking,interact,workspace-opt"),
}
for aid,(pid,tree,br,top,par,ideas,projs,st,note,rel) in ANN.items():
    m=SRC.get(aid)
    if not m: continue
    ROWS.append(dict(id=pid, title=m["title"], tree=tree, br=br,
      a="; ".join(m.get("authors") or []), inst="; ".join(m.get("institutions") or []), lab="",
      v="arXiv", vt="preprint", y=int(m["published"][:4]) if m.get("published") else None,
      d=m.get("published",""), top=top, par=par, meth="", pr=projs, id_=ideas, rel=rel,
      arx=aid, doi=m.get("doi",""), note=note, st=st, abstract=m.get("abstract","")))

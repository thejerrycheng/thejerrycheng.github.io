# -*- coding: utf-8 -*-
"""Recent work found by live literature search (Sept 2026) and verified against the
arXiv API. Titles / authors / dates come from new_papers.json — the record of truth —
so nothing here is typed from memory except the annotation."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
NEW  = json.load(open(os.path.join(HERE, "new_papers.json")))
ROWS = []

# arxiv -> (tree, branch, topics, paradigm, ideas, projects, stars, note, related)
ANN = {
# ---------------- tactile world-action models (the "Tactile WAM" project) --------
"2606.08737": ("il","world-models","tactile, world-action model, contact-rich","world model, VLA",
  "tactile-wm,wam-umi-gloves","wam-tactile,geodex",3,
  "The paper that occupies your tactile-WAM idea most directly: it jointly models actions, future visual "
  "observations AND tactile dynamics, on a Tac-UMI gripper, over five contact-rich tasks (peg insertion, "
  "nut threading, gear meshing, bulb insertion, power insertion). Read it first and decide what you would "
  "do that it does not — the obvious gaps are multi-finger hands and slip prediction as an explicit metric.",
  "vt-wam,tactile-wam,tacforesight,omnivta,vjepa2,dexskin"),
"2606.26663": ("il","world-models","tactile attention, world-action model","world model",
  "tactile-wm","wam-tactile",2,
  "Asymmetric attention between the visual and tactile streams — the architectural question of how to fuse "
  "two modalities with very different rates and dimensionalities, which is the first thing you will hit.",
  "dream-tac,vt-wam,omnivta"),
"2607.02503": ("il","world-models","visual-tactile, world-action model","world model",
  "tactile-wm","wam-tactile",2,
  "Visual-tactile WAM for contact-rich manipulation. Same team lineage as OmniVTA — read the two together "
  "to see what actually changed.", "dream-tac,omnivta,tactile-wam"),
"2606.11184": ("il","world-models","force-guided prediction, tactile world model","world model",
  "tactile-wm","wam-tactile",2,
  "Force-guided rather than image-guided: the prediction target is the contact wrench. Closest to the "
  "'predict slip before it is visible' framing you want.", "dream-tac,omnivta,rotate-without-seeing"),
"2603.19201": ("il","world-models","visuo-tactile world modelling","world model",
  "tactile-wm","wam-tactile",2,
  "The earliest of this 2026 cluster. Useful as the baseline the later tactile-WAM papers compare against.",
  "dream-tac,vt-wam,tacforesight"),
"2606.13232": ("systems","interfaces","tactile UMI, whole-body manipulation, force supervision","hardware, teleop",
  "tactile-wm,mobile-dex-umi,wam-umi-gloves","wam-tactile,mabel",2,
  "A tactile UMI variant driving whole-body manipulation with force-supervised contact-aware planning. "
  "The hardware half of the tactile-WAM project, and directly relevant to a MABEL dexterous UMI.",
  "umi,dexumi,realdexumi,ume"),

# ---------------- real2sim2real from egocentric video (the "Real2Sim2Real" project) ----
"2606.12604": ("il","human-video","egocentric video, digital twin, dexterous demonstrations","real2sim, IL",
  "real2sim2real-ego,ego-dex","r2s2r,geodex",3,
  "EgoEngine builds a simulation scene from egocentric video that preserves task-relevant geometry and "
  "object layout, recovering hand pose and scene entities together, then trains in the reconstructed twin. "
  "This is your Real2Sim2Real project's thesis, already executed. The remaining gap is the RL fine-tuning "
  "stage and closing the loop back to the real scene.",
  "videomimic,video2sim2real,r2s-ego,phantom,egomimic"),
"2606.08828": ("rl","sim2real","single human video, dexterous skill acquisition, full stack","real2sim, RL, IL",
  "real2sim2real-ego,ego-dex","r2s2r,geodex",3,
  "Video2Sim2Real: one human video in, a dexterous skill out, with imitation producing the transferable base "
  "trajectory and residual RL handling the contact discrepancies. That IL-then-residual-RL split is exactly "
  "the architecture your project proposes — read it before writing the proposal.",
  "egoengine,videomimic,real2sim,asap,hil-serl"),
"2608.06827": ("rl","sim2real","sparse-capture real-to-sim, reconstruction refinement","real2sim",
  "real2sim2real-ego","r2s2r",2,
  "R2S-EGO attacks the practical failure of ego-capture real-to-sim: you never get enough views. Dual-proxy "
  "refinement for sparse capture. This is the engineering problem that will actually eat your time.",
  "egoengine,video2sim2real,polaris"),
"2512.16881": ("systems","sim-bench","real-to-sim evaluation, generalist policy benchmarking","simulator, benchmark",
  "real2sim2real-ego","r2s2r",2,
  "PolaRiS uses real-to-sim as an *evaluation* substrate rather than a training one — build the twin so you "
  "can benchmark policies cheaply. Worth adopting as your evaluation harness even if your training story differs.",
  "r2s-ego,egoengine,rl-harness-ref,harbor"),
"2509.22578": ("il","human-video","egocentric demonstration generation, viewpoint generalization","IL",
  "ego-dex,third-person","r2s2r",2,
  "Synthesises novel egocentric viewpoints so the policy stops overfitting to where the camera was. "
  "Cheap augmentation that any ego-video pipeline should include.", "egomimic,one-demo,egoengine"),
"2502.18615": ("rl","sim2real","deformable linear objects, distributional real2sim2real","real2sim",
  "real2sim2real-ego,soft-sim2real","r2s2r",1,
  "Real2Sim2Real treated distributionally rather than as point identification, on deformable linear objects. "
  "Relevant to both the real2sim2real loop and the soft-object gap.", "real2sim,simweaver,video2sim2real"),

# ---------------- RL post-training on foundation models ----------------
"2511.00091": ("rl","post-training","residual RL, self-improving VLA, data generation","RL, VLA",
  "rl-post-training","iris",3,
  "PLD — probe, learn, distill. Lightweight residual actors trained off-policy fix the base VLA's failures, "
  "then the successful rollouts are distilled back into it. The most practical recipe published for your "
  "RL-post-training idea, and it avoids destabilising the language backbone entirely.",
  "iRe-VLA,ript-vla,hil-serl,rlinf-vla,expo-ft"),
"2605.25477": ("rl","post-training","sample-efficient RL fine-tuning, VLA","RL, VLA","rl-post-training","",2,
  "Sample efficiency is the binding constraint for on-robot VLA fine-tuning. Compare its budget against "
  "HIL-SERL's 1-2.5 hours before choosing an approach.", "hil-serl,ript-vla,pld"),
"2510.06710": ("rl","post-training","RL infrastructure for VLA, unified framework","RL, VLA","rl-post-training","",2,
  "RLinf-VLA is the plumbing — a unified, efficient framework for RL on VLAs, accepted to RSS 2026. If you "
  "are going to do this, start from someone else's infrastructure rather than writing your own rollout loop.",
  "pld,serl,ript-vla"),
"2512.05107": ("rl","post-training","stage-aware reinforcement, progressive fine-tuning","RL, VLA","rl-post-training","",2,
  "Stage-aware credit assignment for long-horizon VLA tasks — the sparse-reward problem that RIPT-VLA's "
  "binary success signal leaves open.", "ript-vla,pld"),
"2511.19528": ("rl","post-training","RL-generated trajectories, VLA pretraining","RL, VLA","rl-post-training","",2,
  "Inverts the usual order: use RL to *generate* diverse trajectories, then pretrain the VLA on them. "
  "Interesting because it makes RL a data engine rather than a fine-tuner.", "pld,robocat,oxe"),
"2604.13733": ("rl","post-training","VLA as RL initialization, jump-starting","RL, VLA","rl-post-training","",1,
  "ICRA 2026 workshop paper. The simplest version of the idea — the VLA is the exploration prior, RL does "
  "the rest.", "pld,expo-ft"),

# ---------------- agentic / auto-research ----------------
"2606.08610": ("systems","agentic","RL harness, agentic workflow automation, benchmark","LLM, RL",
  "rl-harness,auto-research-dex,agentic-physical","geodex",3,
  "HARBOR automates the whole simulation-RL workflow across 6 benchmarks and 16 tasks spanning manipulation, "
  "locomotion and bimanual dexterous control, with policies that transfer to real robots. This is both your "
  "'RL harness' and your 'agentic auto-research for dexterous manipulation' idea in one paper. Read it "
  "immediately — it either kills the idea or tells you exactly which half is still open (the real-world "
  "harness, not the simulated one).",
  "eureka,rf-agent,serl,agent-laboratory,voyager"),
"2602.23876": ("systems","agentic","automated reward design, language agent tree search","LLM, RL",
  "auto-research-dex,codesign-dex-agentic","geodex",2,
  "RF-Agent replaces Eureka's evolutionary loop with language agent tree search over reward functions. "
  "The successor you should benchmark against if you go the automated-reward route.",
  "eureka,dreureka,harbor,robomorph"),
"2501.04227": ("systems","agentic","LLM research assistants, automated experimentation","LLM",
  "auto-research-wm,agentic-physical","",2,
  "Agent Laboratory — LLM agents running the literature-review / experiment / report loop. Non-robotics, "
  "but the honest reference point for what auto-research can and cannot do right now.",
  "ai-scientist,harbor,voyager"),
"2510.20809": ("systems","agentic","automated literature analysis, research mapping","LLM",
  "auto-research-wm","",2,
  "Real Deep Research: agentic analysis of the AI/robotics literature at scale. Amusingly, it is the "
  "automated version of what this Atlas does by hand — worth reading for the taxonomy method.",
  "agent-laboratory,ai-scientist"),

# ---------------- dexterous hands (the 22-DOF idea) ----------------
"2603.26660": ("systems","hands","tendon-driven hand, wrist and abduction, open source","hardware",
  "hand-22dof,learned-retargeting","geodex",3,
  "RUKA-v2 — the direct successor to the RUKA hand in your library, now with a decoupled 2-DOF parallel "
  "wrist and finger abduction, fully open-sourced, demonstrated on 13 teleoperated dexterous tasks. "
  "This is the current state of the art for your open 22-DOF hand idea and the thing your design has to "
  "improve on. NYU lineage, so the people are reachable.",
  "ruka,orca-hand,mm-hand,aero-hand,leap-hand"),
"2604.17245": ("systems","hands","21-DOF modular hand, remote actuation, multimodal sensing","hardware",
  "hand-22dof,tactile-wm","geodex",3,
  "MM-Hand: 21 DOF, remote tendon actuation, modular printed fingers, and joint-angle + tactile + motor + "
  "in-palm stereo sensing. Essentially the specification you wrote down, already built. The differentiator "
  "left to you is the learning stack and the sensing-for-world-modelling angle, not the DOF count.",
  "ruka-v2,orca-hand,aero-hand,dexskin"),
"2608.28578": ("systems","hands","tendon-driven hand, simulation-ready, low cost","hardware",
  "hand-22dof","geodex",2,
  "Aero Hand Open: five fingers, sixteen revolute joints, seven motors, 374 g, $314 of parts, and — the "
  "part that matters — shipped simulation-ready. Cheapest credible entry point if you want hardware in "
  "hand this month.", "ruka-v2,orca-hand,mm-hand,leap-hand"),
"2308.02453": ("systems","hands","biomimetic tendon hand, rolling contact joints, RL policy","hardware, RL",
  "hand-22dof","geodex",2,
  "The ETH Faive hand (the lineage behind mimic robotics), with rolling-contact joints and a learned "
  "dexterous policy. Read for the joint mechanism, which is the part tendon hands usually get wrong.",
  "orca-hand,mimic-robotics,ruka-v2"),

# ---------------- UMI / mobile dexterity ----------------
"2606.06033": ("systems","interfaces","wearable UMI, dexterous capture, in-the-wild data","hardware, IL",
  "mobile-dex-umi,wam-umi-gloves,ego-dex","mabel,geodex,wam-tactile",3,
  "RealDexUMI — a wearable universal manipulation interface built for dexterous hands. This is the 'custom "
  "dexterous UMI' idea as a published system. Combined with DexUMI and UME it means the interface itself is "
  "no longer the contribution; what you do with the data is.",
  "umi,dexumi,ume,dexcap,wt-umi,umi-on-legs"),

# ---------------- soft / deformable sim-to-real ----------------
"2606.15338": ("rl","sim2real","deformable manipulation, zero-shot RGB transfer","sim2real, RL",
  "soft-sim2real","",2,
  "SimWeaver claims zero-shot RGB sim-to-real for deformables, which is the harder half of the problem "
  "(rendering gap) rather than the physics half. Note the honest framing in this literature: pixel-based "
  "deformable policy learning has been stuck precisely on this gap.",
  "soft-gentle,dexsim2real,real2sim,genesis"),
"2605.05241": ("rl","sim2real","foundation-model-guided sim-to-real, dexterous transfer","sim2real, RL",
  "soft-sim2real,real2sim2real-ego","geodex",2,
  "Uses a foundation model to guide the sim-to-real transfer rather than hand-tuning randomization ranges — "
  "the same move DrEureka makes, applied to dexterity.", "dreureka,simweaver,dexndm"),
"2510.25405": ("rl","manipulation","deformable and fragile objects, stress-guided RL","RL, sim2real",
  "soft-sim2real","",2,
  "Stress-guided reward for gentle manipulation. The useful contribution is making 'do not break it' a "
  "differentiable objective rather than a constraint you hope holds.", "simweaver,force-control-corl"),
"2601.02778": ("rl","manipulation","zero-shot sim-to-real, force-based dexterous grasping","RL, sim2real",
  "soft-sim2real,real2sim2real-ego","geodex",2,
  "Force-based dexterous grasping transferred zero-shot. Read alongside DexNDM for the two competing "
  "answers to the hand reality gap.", "dexndm,clutterdexgrasp,dexsim2real"),
"2509.23075": ("rl","manipulation","articulated tools, in-hand manipulation, sim-to-real","RL, sim2real",
  "","geodex",1,
  "In-hand manipulation of articulated tools — a harder object class than the rigid blocks most in-hand "
  "papers use.", "chen-visual-inhand,clutterdexgrasp"),

# ---------------- survey ----------------
"2510.10903": ("il","foundations","survey, robot manipulation, unified taxonomy","survey","","",2,
  "A broad 2025 manipulation survey. Useful as a cross-check on this Atlas's taxonomy and as a source of "
  "citations you have missed.", "human-video-survey"),
}

ALIAS = {  # readable ids for cross-references
 "2606.08737":"dream-tac","2606.26663":"tactile-wam","2607.02503":"vt-wam","2606.11184":"tacforesight",
 "2603.19201":"omnivta","2606.13232":"wt-umi","2606.12604":"egoengine","2606.08828":"video2sim2real",
 "2608.06827":"r2s-ego","2512.16881":"polaris","2509.22578":"egodemogen","2502.18615":"dist-r2s2r",
 "2511.00091":"pld","2605.25477":"expo-ft","2510.06710":"rlinf-vla","2512.05107":"stare-vla",
 "2511.19528":"dlr-vla","2604.13733":"vla-jumpstart","2606.08610":"harbor","2602.23876":"rf-agent",
 "2501.04227":"agent-laboratory","2510.20809":"real-deep-research","2603.26660":"ruka-v2",
 "2604.17245":"mm-hand","2608.28578":"aero-hand","2308.02453":"faive-ball","2606.06033":"realdexumi",
 "2606.15338":"simweaver","2605.05241":"dexsim2real","2510.25405":"soft-gentle",
 "2601.02778":"force-grasp-s2r","2509.23075":"artic-tools","2510.10903":"manip-survey",
}

VENUE_HINT = {"2510.06710":("RSS","conference"), "2604.13733":("ICRA","conference")}

for aid, ann in ANN.items():
    m = NEW.get(aid)
    if not m: continue
    tree, br, top, par, ideas, projs, st, note, rel = ann
    ven, vt = VENUE_HINT.get(aid, ("arXiv","preprint"))
    if m.get("journal"): ven, vt = m["journal"][:40], "journal"
    ROWS.append(dict(
      id=ALIAS[aid], title=m["title"], tree=tree, br=br,
      a="; ".join(m["authors"]), inst="", lab="",
      v=ven, vt=vt, y=int(m["published"][:4]), d=m["published"],
      top=top, par=par, meth="", pr=projs, id_=ideas, rel=rel,
      arx=aid, doi=m.get("doi",""), note=note, st=st, abstract=m["abstract"],
    ))

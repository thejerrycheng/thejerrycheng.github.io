# -*- coding: utf-8 -*-
"""The 2026 human-data scaling papers. Metadata comes from dataset_papers.json
(arXiv / OpenAlex), annotation is mine."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC  = json.load(open(os.path.join(HERE, "ego_papers.json")))
ROWS = []

ANN = {
"2602.16710": ("egoscale","il","human-video",
  "egocentric scaling law, dexterous manipulation, action-labelled human video","IL, VLA, flow matching",
  "ego-dex,wam-umi-gloves,third-person","r2s2r,geodex,wam-tactile",3,
  "The scaling result the human-data thesis needed. NVIDIA GEAR trains a flow-based VLA on <b>20,854 hours</b> "
  "of action-labelled egocentric human video — 20× any prior effort — and finds a <b>log-linear scaling law</b> "
  "between human data scale and validation loss, with that loss correlating with real-robot performance. "
  "Before this, 'more human video helps' was a hope. Now it is a curve you can budget against. Two-stage: "
  "pretrain on human video with wrist motion and retargeted hand actions, then a light mid-training stage on "
  "aligned human-robot play data.",
  "egomimic,humanoid-policy,phantom,r3m,dreamgen,ego2robot"),
"2608.02580": ("ego2robot","il","human-video",
  "ego-to-robot synthesis, action retargeting, data curation","IL",
  "ego-dex,third-person,learned-retargeting","r2s2r,geodex",3,
  "The conversion step that makes a million hours of human video usable: retarget the actions, synthesise the "
  "robot arm into the pixels, and curate at multiple levels of quality. Produces <b>18,561 hours</b> of robot "
  "training data across 15 morphologies — the largest ego-to-robot corpus published. Raw human hours are "
  "worthless until something does this; read it as the other half of EgoScale.",
  "egoscale,phantom,dexumi,c2dex,simdex"),
"2605.06747": ("humannet","il","human-video",
  "human-centric video learning, million-hour scale","IL, VLA","ego-dex","r2s2r",2,
  "Aimed explicitly at the million-hour regime, with controlled VLA ablations isolating what an extra order of "
  "magnitude of human video actually buys. The ablation is the useful part — very few papers separate the "
  "value of scale from the value of everything else they changed.",
  "egoscale,ego2robot,dreamgen"),
"2606.17200": ("ace-ego-0","il","human-video",
  "unified pretraining, robot + sim + human data mixing","VLA","ego-dex,rl-post-training","r2s2r",2,
  "Mixes 4.53K hours of robot and simulation data with 1.48K hours of pseudo-action-labelled egocentric human "
  "data in one pretraining recipe. The mixing ratio between the three sources is the question every VLA team "
  "faces and almost nobody reports; this one does.",
  "egoscale,humanoid-policy,pld,dreamgen"),
"2605.24934": ("humanego","il","human-video",
  "few-minute human video, zero-shot transfer, sample efficiency","IL",
  "ego-dex,third-person","geodex,r2s2r",3,
  "The sharpest counterpoint to the scaling thesis in this whole library. <b>30 minutes</b> of human "
  "egocentric video per task gives 92.5% average success across four real tasks — 75% with only 15 minutes — "
  "and beats matched-time robot teleoperation by 41%. If a half-hour is enough, the argument for a "
  "million-hour campaign is about generality, not about any single task. Read it before committing to "
  "collection.",
  "egoscale,phantom,egomimic,one-demo"),
"2604.23570": ("egolive","il","human-video",
  "egocentric dataset, semantic coverage, long tail","dataset","ego-dex","r2s2r",2,
  "Argues that the long tail of semantic coverage matters more than hour count, and benchmarks itself against "
  "EgoDex and Xperience-10M on exactly that axis. The useful corrective to a table sorted by hours.",
  "egoscale,ego4d,egoverse-ref"),
"2507.23523": ("hrdt","il","human-video",
  "human video pretraining, bimanual manipulation","IL, diffusion","ego-dex","mabel",2,
  "Egocentric human video with paired 3D hand poses as a behavioural prior for bimanual robot manipulation. "
  "Relevant to MABEL specifically — bimanual is where human priors should transfer best and where robot data "
  "is scarcest.",
  "egoscale,rdt1b,act"),
"2605.16797": ("egokit","systems","interfaces",
  "low-cost egocentric capture, heterogeneous devices, open toolkit","hardware","ego-dex","r2s2r",2,
  "A unified low-cost toolkit for egocentric collection across phones, action cameras and XR headsets, logging "
  "head pose and OpenXR 26-joint hand tracking alongside video. If you run your own capture rather than "
  "consuming someone else's corpus, start here.",
  "umi,dexcap,egomimic,open-aoe"),
"2311.12943": ("interact","rl","marl",
  "human intent prediction conditioned on robot action, collaborative manipulation","HRI, transformer",
  "hri-collab,multi-robot-marl","m2",2,
  "Predicts human intent <em>conditioned on what the robot is doing</em>. Almost every intent dataset treats "
  "the human as if the robot were not there, which is exactly the assumption that breaks in collaboration. The "
  "teleoperation setup and the collected human-robot data are open-sourced.",
  "intention-tracking,workspace-opt,h2compact,roco"),
"2605.05712": ("egoemg","il","tactile-learn",
  "EMG, egocentric, hand pose, intent","dataset","tactile-wm,ego-dex","wam-tactile,geodex",2,
  "Bilateral 8-channel wrist EMG at 2 kHz paired with egocentric video, RGB-D and hand mocap, over 41 "
  "participants and 60 gestures. EMG carries force and intent <em>before</em> motion is visible, which is "
  "precisely the blind spot of a vision-only world model. Under-explored and cheap to instrument.",
  "dexskin,anyskin,dream-tac,doglove"),
}

for aid,(pid,tree,br,top,par,ideas,projs,st,note,rel) in ANN.items():
    m=SRC.get(aid)
    if not m: continue
    ROWS.append(dict(id=pid, title=m["title"], tree=tree, br=br,
      a="; ".join(m.get("authors") or []), inst="; ".join(m.get("institutions") or []), lab="",
      v="arXiv", vt="preprint", y=int(m["published"][:4]) if m.get("published") else None,
      d=m.get("published",""), top=top, par=par, meth="", pr=projs, id_=ideas, rel=rel,
      arx=aid, doi=m.get("doi",""), note=note, st=st, abstract=m.get("abstract","")))

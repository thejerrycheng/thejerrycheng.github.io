# -*- coding: utf-8 -*-
"""Audio-as-a-modality, and transformable morphology / fall recovery.
Metadata from new_ideas_papers.json."""
import json, os
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=json.load(open(os.path.join(HERE,"new_ideas_papers.json")))
ROWS=[]
ANN={
# ───────────────────────── audio as a modality ─────────────────────────
"2406.19464":("maniwav","il","tactile-learn","ear-in-hand, in-the-wild audio-visual data, contact sensing","IL, audio",
  "robot-dj,tactile-wm,wam-umi-gloves","geodex,wam-tactile",3,
  "The key paper for an audio-driven system: an <b>ear-in-hand</b> device — a contact microphone on a UMI-style "
  "handheld gripper — that collects audio-visual demonstrations in the wild, and policies learned directly from "
  "them. It is the UMI argument with sound added, which makes it the obvious substrate for a turntable system.",
  "umi,hearing-touch,audio-vla,sonicsense,dexumi"),
"2405.08576":("hearing-touch","il","tactile-learn","audio-visual pretraining, contact-rich manipulation","representation learning, audio",
  "robot-dj,tactile-wm","geodex,wam-tactile",3,
  "Audio-visual pretraining with piezoelectric contact microphones, and the result that matters: sound improves "
  "generalisation most in the <b>low-data</b> regime and under texture change. For a task defined by friction "
  "against a rotating surface, that is exactly the failure mode you need covered.",
  "maniwav,r3m,sonicsense,vibecheck"),
"2406.17932":("sonicsense","systems","tactile-hw","in-hand acoustic vibration, contact microphones per fingertip","hardware, audio",
  "robot-dj,tactile-wm,hand-22dof","geodex,wam-tactile",3,
  "A four-fingered hand with a contact microphone in <b>every fingertip</b>, identifying materials, container "
  "contents and 3D shape from tapping and shaking. Duke (Boyuan Chen). This is the hardware pattern for a "
  "dexterous audio hand — and it is cheap, because a piezo disc costs a dollar.",
  "maniwav,hearing-touch,anyskin,dexskin,leap-hand"),
"2511.09958":("audio-vla","il","vla","contact audio in a VLA, multimodal action model","VLA, audio",
  "robot-dj,tactile-wm","wam-tactile,geodex",2,
  "Adds contact-audio perception to a VLA. The natural baseline once you have an audio-equipped hand: does "
  "sound survive being fed into a large pretrained action model, or does it get ignored next to vision?",
  "maniwav,pi0,openvla,dream-tac"),
"2504.15535":("vibecheck","systems","tactile-hw","active acoustic sensing, contact-rich manipulation","hardware, audio",
  "robot-dj,tactile-wm","geodex,wam-tactile",2,
  "<b>Active</b> acoustic sensing — inject a vibration and listen to the response, rather than waiting for the "
  "task to make a noise. For a turntable, the platter is already vibrating, so you get an active probe for free.",
  "sonicsense,maniwav,hearing-touch"),
"2511.18299":("miccheck","systems","tactile-hw","pin microphones, low-cost contact sensing","hardware, audio",
  "robot-dj,tactile-wm,hand-22dof","geodex",2,
  "Off-the-shelf pin microphones repurposed as contact sensors. The cheapest possible entry point to audio "
  "sensing — worth building in an afternoon before designing anything custom.",
  "sonicsense,vibecheck,anyskin"),
"2409.14608":("av-contact","il","tactile-learn","extrinsic contact estimation, visual-auditory fusion","audio",
  "robot-dj,tactile-wm","wam-tactile",2,
  "Estimates <em>extrinsic</em> contact — where the held object touches the world, not where the hand touches "
  "the object — from vision and sound together. For a stylus on a record, extrinsic contact is the whole task.",
  "maniwav,hearing-touch,dexskin"),
"2212.03858":("see-hear-feel","il","tactile-learn","multisensory fusion, vision touch audio","IL, audio",
  "robot-dj,tactile-wm","wam-tactile,geodex",2,
  "The early systematic study of fusing vision, touch and audio for manipulation, and still the reference for "
  "<em>when</em> each modality actually helps. Read it before designing the fusion architecture.",
  "objectfolder-real,maniwav,robot-synesthesia"),
"2312.01853":("robot-synesthesia","rl","manipulation","visuotactile fusion, in-hand manipulation","RL",
  "tactile-wm,robot-dj","geodex",2,
  "Fuses vision and touch into a shared point-cloud representation for in-hand manipulation. The representation "
  "trick — put both modalities in the same 3D space instead of concatenating features — generalises to audio.",
  "see-hear-feel,dexskin,qi-inhand"),

# ─────────────────── transformable morphology & fall recovery ───────────────────
"2604.21541":("x2n","systems","codesign","transformable wheel-legged humanoid, dual-mode locomotion, RL whole-body control","hardware, RL",
  "transformer-robot,codesign-dog-rl","",3,
  "X2-N is a high-DoF robot that operates as both a humanoid and a wheel-legged vehicle and <b>transforms "
  "between them by joint reconfiguration</b>, with a single RL whole-body control framework covering hybrid "
  "locomotion, the transformation itself, and manipulation. This is your transformer-robot idea, built and "
  "published in April 2026. Read it first — it defines what is left to claim.",
  "swheg,reconfig-wheelleg,dyret,berkeley-humanoid-lite,humanup"),
"2210.15126":("swheg","systems","codesign","wheel-leg transformable, minimalist actuation","hardware",
  "transformer-robot","",2,
  "A wheel-leg transformable robot that reconfigures with a <b>single</b> extra actuator per wheel. The "
  "mechanical lesson for any transformer: the transformation should cost you one actuator, not a second robot.",
  "x2n,reconfig-wheelleg,mit-cheetah"),
"2507.22345":("reconfig-wheelleg","systems","codesign","reconfigurable wheel-leg, steering and adaptability","hardware",
  "transformer-robot","",1,
  "A reconfigured wheel-legged design focused on steering and terrain adaptability. Useful as a mechanism "
  "survey point rather than for its learning content.",
  "swheg,x2n"),
"2502.12152":("humanup","rl","locomotion","getting-up policies, real-world humanoid, curriculum","RL",
  "transformer-robot","mabel",3,
  "The reference getting-up paper: learned policies that stand a real humanoid back up from varied fallen "
  "configurations, later extended to deformable, slippery and inclined terrain. Any robot that falls needs "
  "this, and a transforming robot will fall in postures nobody anticipated.",
  "getup-morphologies,unirelo,fall-safety,stablemimic,deepmimic"),
"2512.12230":("getup-morphologies","rl","locomotion","cross-morphology recovery, unified policy, zero-shot","RL",
  "transformer-robot,codesign-dex-agentic","",3,
  "One policy that gets seven different humanoids (0.48–0.81 m, 2.8–7.9 kg) back on their feet, transferring "
  "zero-shot to unseen morphologies at ~86%. Directly relevant to a transforming robot: the policy has to "
  "survive the body changing, which is the same problem as the body being different.",
  "humanup,unirelo,cross-humanoid-wbc,x2n,dyret"),
"2606.08922":("unirelo","rl","locomotion","unified fall recovery and locomotion, diverse terrain","RL",
  "transformer-robot","mabel",2,
  "One policy spanning fall recovery <em>and</em> locomotion across terrains, rather than a recovery policy "
  "bolted onto a walking policy. The unification argument matters when you are counting how many policies fit "
  "on the robot.",
  "humanup,getup-morphologies,hugwbc,hover"),
"2511.07407":("fall-safety","rl","locomotion","fall-safety, few demonstrations, protective behaviour","RL, IL",
  "transformer-robot","mabel",2,
  "Falling <em>well</em> — protective behaviour learned from a few demonstrations — rather than only getting "
  "up afterwards. Cheaper than replacing a humanoid, and almost nobody works on it.",
  "humanup,stablemimic,unirelo"),
"2608.02385":("stablemimic","rl","motion-imitation","post-fall behaviour, recovery beyond the tracking distribution","RL",
  "transformer-robot","mabel",2,
  "Structured post-fall behaviour for motion-tracking policies — what happens when the robot leaves the "
  "distribution the tracker was trained on. The honest complement to every DeepMimic-descended controller in "
  "this library.",
  "humanup,fall-safety,exbody2,deepmimic"),
"2602.13656":("kungfu-bot","rl","motion-imitation","highly dynamic motion dataset, fall-resilient tracking","RL, dataset",
  "transformer-robot","mabel",2,
  "A balance-challenging dynamic motion dataset plus autonomous fall-resilient tracking — the robot keeps "
  "working all day because it recovers by itself. The dataset is the part to reuse.",
  "stablemimic,humanup,amass,exbody2"),
}
for aid,(pid,tree,br,top,par,ideas,projs,st,note,rel) in ANN.items():
    m=SRC.get(aid)
    if not m: continue
    ROWS.append(dict(id=pid, title=m["title"], tree=tree, br=br,
      a="; ".join(m.get("authors") or []), inst="; ".join(m.get("institutions") or []), lab="",
      v="arXiv", vt="preprint", y=int(m["published"][:4]) if m.get("published") else None,
      d=m.get("published",""), top=top, par=par, meth="", pr=projs, id_=ideas, rel=rel,
      arx=aid, doi=m.get("doi",""), note=note, st=st, abstract=m.get("abstract","")))

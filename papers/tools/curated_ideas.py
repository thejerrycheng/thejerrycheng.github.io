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

# ─────────── topology change: the true car ↔ humanoid problem ───────────
EXTRA = {
"2504.16383":("changing-morph-dyn","systems","codesign","whole-body dynamics under changing morphology, modular assembly","control",
  "transformer-robot","",3,
  "Closed-form, singularity-free whole-body Lagrangian dynamics for legged robots whose <b>morphology changes</b> — "
  "each limb modelled independently via Boltzmann-Hamel equations and screw theory, then assembled according to the "
  "robot's current configuration. For a machine whose kinematic tree is different in car form and robot form, this "
  "is the modelling tool: you do not re-derive the dynamics per mode, you reassemble them.",
  "x2n,gcnt,morph-hypernet,var-topology-truss"),
"2505.15211":("gcnt","rl","foundations","morphology-agnostic policy, graph transformer, zero-shot to unseen bodies","RL",
  "transformer-robot,codesign-dex-agentic","",2,
  "A GCN-plus-transformer policy that accepts an arbitrary number of modules and generalises zero-shot to "
  "morphologies it never saw. The architecture answer to 'one policy, changing body' — which is exactly what a "
  "transforming robot needs, since its body is a different graph before and after.",
  "morph-hypernet,getup-morphologies,cross-humanoid-wbc,transform2act"),
"2402.06570":("morph-hypernet","rl","foundations","morphology-conditioned hypernetwork, universal morphology control","RL",
  "transformer-robot,codesign-dex-agentic","",2,
  "Distils morphology-conditioned hypernetworks so one network emits the weights for whatever body it is given. "
  "Cheaper at inference than a graph transformer, which matters when the policy has to run on the robot.",
  "gcnt,getup-morphologies,derl"),
"2108.00309":("var-topology-truss","systems","codesign","variable topology truss, reconfiguration and locomotion planning","planning",
  "transformer-robot","",2,
  "Motion planning for trusses that change their <b>connection topology</b>, not just their joint angles. The "
  "closest existing formal treatment of reconfiguration where members change role — which is the abstract version "
  "of a body panel becoming a limb.",
  "changing-morph-dyn,x2n,swheg"),
"2008.10267":("dj-mix-analysis","il","tactile-learn","DJ mix analysis, mix-to-track alignment, cue points and transitions","audio",
  "robot-dj","",3,
  "ISMIR 2020. Aligns a real DJ mix back to its source tracks to recover cue points, transition length, mix "
  "segmentation and the musical changes the DJ made. This is where the <b>evaluation metrics</b> for a robot DJ "
  "come from — it is the only literature that quantifies what a DJ actually did, rather than whether a listener "
  "liked it.", "maniwav,hearing-touch,audio-vla"),
"2211.11644":("opt-legged-control","rl","locomotion","optimization-based control, dynamic legged robots, survey","control",
  "transformer-robot","mabel",2,
  "Survey of optimization-based control for dynamic legged robots. The model-based half you will need for the "
  "transformation manoeuvre, where you have a good model and only a couple of seconds of trajectory to plan.",
  "changing-morph-dyn,coros-codesign,dinev-codesign"),
}
for aid,(pid,tree,br,top,par,ideas,projs,st,note,rel) in EXTRA.items():
    m=SRC.get(aid)
    if not m: continue
    ROWS.append(dict(id=pid, title=m["title"], tree=tree, br=br,
      a="; ".join(m.get("authors") or []), inst="; ".join(m.get("institutions") or []), lab="",
      v="arXiv", vt="preprint", y=int(m["published"][:4]) if m.get("published") else None,
      d=m.get("published",""), top=top, par=par, meth="", pr=projs, id_=ideas, rel=rel,
      arx=aid, doi=m.get("doi",""), note=note, st=st, abstract=m.get("abstract","")))

# ─────────── the real-world transforming machines (no papers, but they are the state of the art) ───────────
def NP(id, title, **k):
    k.update(id=id, title=title, tree=k.pop("tree","systems"), br=k.pop("br","codesign"))
    ROWS.append(k)
NP("jdeite","J-deite RIDE: a 4 m rideable humanoid that transforms into a car",
   a="Kenji Ishida (BRAVE ROBOTICS); Asratec; Sansei Technologies", inst="BRAVE ROBOTICS; Asratec; Sansei Technologies",
   lab="BRAVE ROBOTICS", v="industry", vt="industry", y=2018, d="2018-04-26",
   top="car-humanoid transformation, topology change, rideable", par="hardware",
   pr="", id_="transformer-robot", st=3,
   site="https://braverobotics.com/en/2018/04/26/j-deite-ride-release/",
   note="The only real car ↔ humanoid robot at scale: 4 m tall, carries two people, drives at 60 kph on wheels, "
        "walks as a biped, and converts in about <b>one minute</b> using Asratec's V-Sido controller. Read it as "
        "the existence proof and as the benchmark to beat — the transformation is quasi-static and scripted, and "
        "the bipedal walking is slow and statically stable. Everything interesting about learned control is "
        "untouched.",
   rel="letrons,robosen,x2n,changing-morph-dyn")
NP("letrons","Letrons: a drivable BMW that converts into a 4.5 m robot",
   a="Letvision (Levent Erenler)", inst="Letvision", lab="Letvision", v="industry", vt="industry",
   y=2016, d="2016-09-01", top="car-robot conversion, show robot", par="hardware",
   pr="", id_="transformer-robot", st=1, site="https://www.letrons.com/",
   note="Twelve engineers, eight months, a real BMW that stands up and articulates its arms and fingers — but it "
        "<b>does not walk</b>, and it is remote-operated. Useful as a mechanical-packaging reference and as a "
        "reminder of where the difficulty actually sits: standing up is not the hard part, balancing and walking "
        "afterwards is.",
   rel="jdeite,robosen")
NP("robosen","Robosen auto-converting Transformers (Optimus Prime, Grimlock)",
   a="Robosen Robotics", inst="Robosen Robotics; Hasbro", lab="Robosen", v="commercial", vt="industry",
   y=2022, d="2022-01-01", top="auto-converting bipedal robot, high servo count, consumer scale", par="hardware",
   pr="", id_="transformer-robot", st=3, site="https://us.robosen.com/",
   note="The most under-rated engineering reference here: a consumer product that converts <b>automatically</b> "
        "between a walking biped and a vehicle, with 34 servos and no human in the loop. At ~0.5 m it is the scale "
        "a PhD can actually iterate on, and it proves the mechanism is tractable when you stop trying to build it "
        "at 4 m. Closed-source and scripted — but the packaging is a masterclass.",
   rel="jdeite,letrons,berkeley-humanoid-lite,toddlerbot")

# ─────────── flexible spine, and deriving morphology from animal motion ───────────
SPINE = {
"2605.27909":("s-cheetah","systems","codesign","3-DOF active spine, rotary gallop, RL locomotion","hardware, RL",
  "codesign-dog-rl","",3,
  "A quadruped with a bio-inspired serial <b>3-DOF active spine</b> giving tri-axial rotation, trained with RL: "
  "6.9 m/s peak speed on a rotary G2 gallop, 7.2 rad/s in-place turning, and emergent feline aerial self-righting. "
  "This is the flexible-torso idea, built and measured, in May 2026. It also settles the premise — the spine does "
  "help, comprehensively — so the open question is no longer <em>whether</em> but <em>which</em> spine.",
  "twisting-waist,spine-phase,mit-cheetah,dyret,transform2act"),
"2410.05884":("twisting-waist","systems","codesign","twisting waist, quadruped flexibility","hardware",
  "codesign-dog-rl","",2,
  "A single twisting waist joint rather than a full spine — the minimal version of the same idea, and a useful "
  "data point on how much of the benefit one DOF buys.",
  "s-cheetah,spine-phase"),
"2604.00329":("spine-phase","rl","locomotion","spinal motion phase, asymmetric stiffness, high-speed running","control",
  "codesign-dog-rl","",3,
  "The mechanism paper: it is the <b>phase relationship</b> between spinal motion and limb support — not spinal "
  "range of motion — that determines high-speed running performance, with asymmetric spinal stiffness. This is "
  "the variable a co-design search should actually be optimizing, and it is the kind of insight that tells you "
  "what to parameterise.",
  "s-cheetah,mit-cheetah,twisting-waist,coros-codesign"),
"2510.24117":("dogmo","il","human-video","4D canine motion, multi-view RGB-D, 1.2k sequences","dataset",
  "codesign-dog-rl,third-person","",3,
  "1,200 motion sequences from 10 dogs, multi-view RGB-D with real 3D — the first dog dataset with enough "
  "fidelity to measure how a real animal's trunk actually bends while running. If you want to derive a spine "
  "from data rather than assume one, this is the measurement.",
  "barc,corgi,animal-avatars,s-cheetah,amass"),
"2203.15536":("barc","il","human-video","3D dog shape regression, breed priors","representation learning",
  "codesign-dog-rl","",2,
  "Regresses 3D dog shape from ordinary images using breed information as a prior. The shape half of "
  "'measure the animal' — you need body proportions before you can scale a kinematic chain to them.",
  "dogmo,corgi,animal-avatars,hsmal"),
"2607.00321":("corgi","il","human-video","consistency-aware 3D dog reconstruction, single image","representation learning",
  "codesign-dog-rl","",2,
  "2026 single-image 3D dog reconstruction with explicit consistency handling. Together with DogMo it makes "
  "'build the robot from dog footage' a data problem rather than an aspiration.",
  "barc,dogmo,animal-avatars"),
"2403.17103":("animal-avatars","il","human-video","animatable 3D animals from casual video","representation learning",
  "codesign-dog-rl,third-person","",2,
  "Animatable 3D animals reconstructed from casual video — the pipeline that turns YouTube footage of a running "
  "dog into something with joints you can measure.",
  "dogmo,barc,corgi,videomimic"),
"2106.10102":("hsmal","il","human-video","horse shape and pose, motion pattern recognition","representation learning",
  "codesign-dog-rl","",1,
  "The horse instance of the SMAL family. Useful mainly as evidence that the parametric-quadruped approach "
  "generalises across species, which matters if you want to co-design for a morphology between a dog and a cheetah.",
  "barc,dogmo,animal-avatars"),
}
for aid,(pid,tree,br,top,par,ideas,projs,st,note,rel) in SPINE.items():
    m=SRC.get(aid)
    if not m: continue
    ROWS.append(dict(id=pid, title=m["title"], tree=tree, br=br,
      a="; ".join(m.get("authors") or []), inst="; ".join(m.get("institutions") or []), lab="",
      v="arXiv", vt="preprint", y=int(m["published"][:4]) if m.get("published") else None,
      d=m.get("published",""), top=top, par=par, meth="", pr=projs, id_=ideas, rel=rel,
      arx=aid, doi=m.get("doi",""), note=note, st=st, abstract=m.get("abstract","")))

# the changing-morphology dynamics paper: arXiv is rate-limiting, so record what is
# verified from the published version (Nonlinear Dynamics, Springer) and flag it.
if "2504.16383" not in SRC:
    ROWS.append(dict(id="changing-morph-dyn",
      title="Fast and Modular Whole-Body Lagrangian Dynamics of Legged Robots with Changing Morphology",
      tree="systems", br="codesign", a="", inst="", lab="",
      v="Nonlinear Dynamics", vt="journal", y=2025, d="2025-04-23",
      top="whole-body dynamics under changing morphology, modular assembly", par="control",
      meth="", pr="", id_="transformer-robot", rel="x2n,gcnt,morph-hypernet,var-topology-truss",
      arx="2504.16383", doi="", st=3, abstract="",
      note="Closed-form, singularity-free whole-body Lagrangian dynamics for legged robots whose <b>morphology "
           "changes</b> — each limb modelled independently (Boltzmann-Hamel equations plus screw theory) and "
           "reassembled according to the robot's current configuration, so you do not re-derive the dynamics per "
           "mode. For a machine with a different kinematic tree in car form and robot form, this is the modelling "
           "tool. Author list not yet verified against the arXiv record — check before citing."))

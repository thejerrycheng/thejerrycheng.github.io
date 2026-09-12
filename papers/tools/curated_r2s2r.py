# -*- coding: utf-8 -*-
"""Agentic scene construction, and the IL + residual-RL recipe for real2sim2real."""
import json, os
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=json.load(open(os.path.join(HERE,"r2s2r_papers.json")))
ROWS=[]
ANN={
# ── the agent builds the scene ──
"2410.07408":("acdc","systems","sim-bench","digital cousins, automated scene creation, asset substitution","simulator",
  "real2sim2real-ego,agentic-physical","r2s2r",3,
  "ACDC introduces <b>digital cousins</b> — scenes that preserve a real reference's structure and affordances "
  "while substituting different asset instances, rather than trying to twin it exactly. That is the key "
  "reframing for agentic scene construction: an exact twin is expensive and brittle, a cousin is cheap and "
  "<em>better for transfer</em>, because training across cousins is domain randomization with semantics. "
  "Stanford.",
  "simfoundry,robosnap,egoengine,r2s-ego,prism"),
"2606.28276":("simfoundry","systems","sim-bench","automated scene generation from video, sim-ready twins, editing","simulator",
  "real2sim2real-ego,agentic-physical","r2s2r",3,
  "Zero-shot real-to-sim from a video, producing sim-ready digital twins with object, scene and task editing, "
  "and automated generation of cousins. This is the closest thing to the 'agent constructs the scene' component "
  "you want — it is a pipeline rather than an LLM loop, but it is the substrate an agent would drive.",
  "acdc,robosnap,egoengine,prism,r2s-ego"),
"2607.06699":("robosnap","systems","sim-bench","one-shot real-to-sim from a single image","simulator",
  "real2sim2real-ego","r2s2r",2,
  "A single RGB image to a simulation-ready scene. The cheapest possible entry to the reconstruction leg — "
  "worth trying before committing to multi-view egocentric capture, if only to see how far one photo goes.",
  "acdc,simfoundry,prism"),
"2607.04880":("prism","systems","sim-bench","personalized dataset generation, scene and motion synthesis","simulator, IL",
  "real2sim2real-ego,third-person","r2s2r",2,
  "Generates robot datasets by synthesising both the scene and the motion from images. The natural pairing with "
  "cousin generation: once the agent can vary the scene, it should vary the demonstration too.",
  "acdc,simfoundry,dreamgen,egodemogen"),
"2509.22970":("learn-any-images","il","visuomotor","policy learning from arbitrary images, scene synthesis","IL",
  "real2sim2real-ego,third-person","r2s2r",2,
  "Turns ordinary images into training signal for manipulation. Relevant as the loosest end of the spectrum — "
  "if this works, the bar for how good your reconstruction must be drops considerably.",
  "prism,robosnap,phantom"),
# ── IL + residual RL: the recipe for dexterity ──
"2603.10451":("far-dex","rl","manipulation","few-shot augmentation, adaptive residual policy refinement, dexterity","IL, RL",
  "real2sim2real-ego,ego-dex,rl-post-training","r2s2r,geodex",3,
  "Few-shot data augmentation plus an <b>adaptive residual</b> policy for dexterous manipulation — the 2026 "
  "instance of the pattern that keeps recurring in this library: a base policy from imitation, a residual from "
  "RL, and the residual is where all the contact lives.",
  "video2sim2real,residual-assembly,pld,asap,omnitactune"),
"2407.16677":("residual-assembly","rl","manipulation","residual RL on top of imitation, precise assembly","IL, RL",
  "real2sim2real-ego,rl-post-training","r2s2r",3,
  "'From Imitation to Refinement' — the clearest statement of the division of labour: imitation gets you the "
  "coarse trajectory, residual RL supplies the precision that demonstrations cannot, on assembly tasks where "
  "tolerances are sub-millimetre. Read it for the argument, not the task.",
  "far-dex,video2sim2real,hil-serl,pld"),
"2502.20396":("humanoid-dex-s2r","rl","sim2real","automated real-to-sim tuning, vision-based dexterity, policy distillation","RL",
  "real2sim2real-ego,ego-dex","r2s2r,geodex",3,
  "Vision-based dexterous manipulation on humanoids with an <b>automated real-to-sim tuning module</b>, a "
  "contact-and-object-goal reward formulation, and divide-and-conquer distillation. The automated tuning module "
  "is the piece to steal: it is the closest published thing to closing the loop, even though the paper does not "
  "frame it that way.",
  "asap,dexndm,video2sim2real,far-dex,chen-visual-inhand"),
}
for aid,(pid,tree,br,top,par,ideas,projs,st,note,rel) in ANN.items():
    m=SRC.get(aid)
    if not m: continue
    ROWS.append(dict(id=pid, title=m["title"], tree=tree, br=br,
      a="; ".join(m.get("authors") or []), inst="; ".join(m.get("institutions") or []), lab="",
      v="arXiv", vt="preprint", y=int(m["published"][:4]) if m.get("published") else None,
      d=m.get("published",""), top=top, par=par, meth="", pr=projs, id_=ideas, rel=rel,
      arx=aid, doi=m.get("doi",""), note=note, st=st, abstract=m.get("abstract","")))

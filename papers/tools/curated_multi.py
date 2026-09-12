# -*- coding: utf-8 -*-
"""Multi-robot collaboration and physical HRI. Metadata from dataset_papers.json."""
import json, os
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=json.load(open(os.path.join(HERE,"multi_papers.json")))
ROWS=[]
ANN={
"2606.12352":("chorus","rl","marl","decentralized collaboration, multi-embodiment, single policy","VLA, MARL",
  "multi-robot-marl,hri-collab","m2",3,
  "One VLA policy driving decentralized collaboration across different embodiments. This is the most direct "
  "answer yet to M2's core question — whether two heterogeneous robots need two policies or one — and it says "
  "one. Read it before designing M2's policy architecture.",
  "mappo,decentralized-aerial,crossformer,h2compact,rocobench"),
"2307.04738":("roco","rl","marl","LLM dialogue, multi-arm planning, benchmark","LLM, MARL",
  "multi-robot-marl,agentic-physical,hri-collab","m2",3,
  "Robots that literally talk to each other: LLMs negotiate the task split, then a multi-arm motion planner "
  "executes the agreed waypoints. RoCoBench came out of it and is now the standard evaluation. The "
  "human-in-the-loop mode — a person as one of the agents — is the cleanest existing bridge between your "
  "multi-robot and HRI ideas.",
  "rocobench,chorus,mappo,voyager,embo-team"),
"2601.11063":("embo-team","systems","agentic","behaviour trees, PDDL grounding, multi-robot planning","LLM",
  "multi-robot-marl,agentic-physical","m2",2,
  "Grounds LLM reasoning into reactive behaviour trees via PDDL, so the plan is executable and re-plannable "
  "rather than a paragraph of hope. The architecture to copy if you want an LLM in M2's planning loop without "
  "giving up reactivity.",
  "roco,comuros-ref,voyager,harbor"),
"2602.06967":("climrs","rl","marl","group negotiation, heterogeneous teams, LLM coordination","LLM, MARL",
  "multi-robot-marl","m2",2,
  "Adaptive group negotiation for heterogeneous teams, reporting >40% higher efficiency on complex tasks without "
  "losing success on simple ones. The efficiency-vs-robustness tradeoff is the one M2 will actually have to manage.",
  "roco,chorus,mappo"),
"2403.12482":("llm-teams","systems","agentic","organised teams, emergent cooperation, LLM agents","LLM",
  "multi-robot-marl,agentic-physical","",2,
  "Non-robotic, but the finding transfers: giving LLM agents an explicit organisational structure changes how "
  "well they cooperate. Relevant if M2's agents ever need roles rather than symmetry.",
  "roco,voyager,embo-team"),
"2203.09063":("intention-tracking","rl","marl","intention tracking, industrial assembly, human-robot collaboration","HRI",
  "hri-collab,multi-robot-marl","m2",2,
  "Hierarchical intention tracking so the robot can both avoid interrupting the human and step in when the human "
  "is failing. That second behaviour — assistive intervention — is what separates a collaborator from a "
  "compliant obstacle.",
  "interact-ref,h2compact,falcon"),
"2401.12965":("workspace-opt","rl","marl","workspace arrangement, human motion prediction, legibility","HRI",
  "hri-collab","m2",2,
  "A genuinely different idea: instead of predicting human motion better, <em>arrange the workspace</em> so the "
  "human moves more predictably, including projecting virtual obstacles in AR. Cheap, and it attacks the "
  "variance rather than the model.",
  "intention-tracking,h2compact"),
}
for aid,(pid,tree,br,top,par,ideas,projs,st,note,rel) in ANN.items():
    m=SRC.get(aid)
    if not m: continue
    ROWS.append(dict(id=pid, title=m["title"].replace("\\n"," "), tree=tree, br=br,
      a="; ".join(m.get("authors") or []), inst="; ".join(m.get("institutions") or []), lab="",
      v="arXiv", vt="preprint", y=int(m["published"][:4]) if m.get("published") else None,
      d=m.get("published",""), top=top, par=par, meth="", pr=projs, id_=ideas, rel=rel,
      arx=aid, doi=m.get("doi",""), note=note, st=st, abstract=m.get("abstract","").replace("\\n"," ")))

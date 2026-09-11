# -*- coding: utf-8 -*-
"""Merge curated rows with the auto-harvested local corpus -> papers_data.json"""
import json, os, re, sys, unicodedata, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import schema, curated_rl, curated_il, curated_sys, curated_recent

HARVEST = "/private/tmp/claude-501/-Users-jerrycheng-Desktop/bfd64d9a-4eab-4216-ade8-f0b0cd1137d7/scratchpad/harvest"
OUT = os.path.join(os.path.dirname(HERE), "papers_data.json")
HOME = os.path.expanduser("~")

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").lower()
    return re.sub(r"[^a-z0-9]+", "", s)

def splitlist(s):
    if not s: return []
    if isinstance(s, list): return [x.strip() for x in s if str(x).strip()]
    return [x.strip() for x in re.split(r"[;,]\s*", s) if x.strip()]

# ------------------------------------------------------------------ curated
CUR = {}
for mod in (curated_rl, curated_il, curated_sys, curated_recent):
    for r in mod.ROWS:
        rec = dict(
            id=r["id"], title=r["title"], tree=r["tree"], branch=r.get("br",""),
            authors=splitlist(r.get("a","")), corresponding=splitlist(r.get("corr","")),
            institutions=splitlist(r.get("inst","")), lab=r.get("lab",""),
            venue=r.get("v",""), venue_type=r.get("vt",""), year=r.get("y"),
            date=r.get("d",""), topics=splitlist(r.get("top","")),
            paradigm=splitlist(r.get("par","")), method=splitlist(r.get("meth","")),
            projects=splitlist(r.get("pr","")), ideas=splitlist(r.get("id_","")),
            related=splitlist(r.get("rel","")), arxiv=r.get("arx",""), doi=r.get("doi",""),
            code=r.get("code",""), site=r.get("site",""), note=r.get("note",""),
            
            stars=r.get("st",1), curated=True, local="", abstract=r.get("abstract",""), source="curated",
        )
        rec["first_author"] = rec["authors"][0] if rec["authors"] else ""
        if rec["arxiv"]: rec["url"] = f"https://arxiv.org/abs/{rec['arxiv']}"
        elif rec["doi"]: rec["url"] = f"https://doi.org/{rec['doi']}"
        else: rec["url"] = rec.get("site","")
        CUR[rec["id"]] = rec

by_arx  = {c["arxiv"]: c for c in CUR.values() if c.get("arxiv")}
by_title= {norm(c["title"])[:60]: c for c in CUR.values()}

# ------------------------------------------------------------------ auto corpus
auto = json.load(open(f"{HARVEST}/enriched.json"))

DROP = re.compile(r"(意优|HexFellow|EYouServo|spec_sheet|manual|datasheet|应用手册|错误码|"
                  r"registration|visa|tax|financial|passport|invoice|order|apriltag|"
                  r"assembly_instruction|Statement of Purpose|Letter of|Supporting Documents)", re.I)

# tree/branch classifier over title+abstract+folder
RULES = [
 # order matters: most specific first
 (r"world[- ]?action model|wam|world model|latent predictive|dreamer|latent imagination|video (generation|prediction) (for|as)", "il","world-models",["world model"]),
 (r"vision[- ]language[- ]action|vla|vlas|generalist (policy|robot)|foundation model.*(robot|manipul)|instruction[- ]following polic", "il","vla",["VLA"]),
 (r"motion (imitation|tracking|retarget)|deepmimic|mimic|character (skill|control)|mocap track", "rl","motion-imitation",["motion imitation"]),
 (r"loco[- ]?manipulat|whole[- ]body (control|loco|manipul)|legged manipul", "rl","loco-manip",["loco-manipulation"]),
 (r"parkour|quadruped(al)? (loco|walk|gait|run)|legged loco|locomotion|gait|bipedal walk|humanoid (walk|loco|gait)|terrain", "rl","locomotion",["locomotion"]),
 (r"in[- ]hand|reorient|dexterous (grasp|manipulat|polic)|dexterity|grasp(ing)? (in|pose|generat)|contact[- ]rich", "rl","manipulation",["dexterous manipulation"]),
 (r"egocentric|first[- ]person|human video|third[- ]person|exocentric|learning from (human|video)|hand[- ]centric|human[- ]to[- ]robot", "il","human-video",["human video"]),
 (r"retarget|teleoperat|teleop|bilateral (teleop|control)", "il","retargeting",["teleoperation"]),
 (r"tactile|touch|skin sens|plantar pressure|force[- ]torque prox", "il","tactile-learn",["tactile"]),
 (r"(robotic |anthropomorphic |dexterous )hand.*(design|mechanism|tendon|joint|drive)|hand design|wrist.*(design|robotic)", "systems","hands",["hand design"]),
 (r"universal manipulation interface|umi|handheld gripper|data (collection|capture) (system|interface|device)|exoskeleton.*(capture|demonstrat|interface)|glove", "systems","interfaces",["capture interface"]),
 (r"exoskeleton|prosthe|wearable|assistive torque|gait assist|rehabilitat", "systems","humanoid-hw",["wearable robotics"]),
 (r"(open[- ]source|low[- ]cost|open python).*(robot|arm|platform|hand|manipulator)|bimanual (robot|platform|hardware)|hardware (design|system|platform)|robot platform", "systems","bimanual",["open hardware"]),
 (r"multi[- ]agent (reinforcement|rl|learning|coordinat)|marl|cooperative (transport|manipul|game|long rope)|multi[- ]robot (collaborat|coordinat|cooperat|learning)|opponent shaping|swarm|emergent (collective|behavio)", "rl","marl",["multi-agent"]),
 (r"model predictive control|mpc|nmpc|dmpc|trajectory optim|motion planning|path planning|coverage path|sampling[- ]based plan|rrt|collision avoid|obstacle avoid|control barrier|quadratic program|convex program|formation (control|navigation)|distributed control|event[- ]triggered", "systems","planning-control",["planning & control"]),
 (r"slam|odometry|state estimation|calibrat|pose estimation|localization|belief (tree|state)|sensor fusion|change detection|depth refine|visual servo", "systems","perception",["perception & estimation"]),
 (r"simulat|mujoco|isaac|physics engine|sim2real|sim[- ]to[- ]real|domain random|benchmark|dataset|toolchain|data engine", "systems","sim-bench",["simulation & benchmarks"]),
 (r"llm|language model|agentic|autonomous research|vision[- ]language navigation", "systems","agentic",["LLM agent"]),
 (r"post[- ]train|reinforcement (fine[- ]tun|learning).*(polic|vla|foundation)|offline[- ]to[- ]online", "rl","post-training",["RL post-training"]),
 (r"diffusion polic|flow matching|action chunk|visuomotor|behavio[u]?r clon|imitation learn|policy learning", "il","visuomotor",["visuomotor policy"]),
 (r"reinforcement learning|rl", "rl","foundations",["RL"]),
]
RULES = [(re.compile(p, re.I), t, b, x) for p,t,b,x in RULES]

IDEA_HINTS = [
 (r"multi[- ]agent|multi[- ]robot|cooperative transport|decentraliz|co-?manipulat", "multi-robot-marl"),
 (r"tactile|touch|skin", "tactile-wm"),
 (r"egocentric|first[- ]person|human video|hand[- ]centric", "ego-dex"),
 (r"real[- ]?to[- ]?sim|real2sim|sim[- ]to[- ]real|domain random", "real2sim2real-ego"),
 (r"post[- ]train|fine[- ]tun.*(rl|reinforce)|online reinforcement", "rl-post-training"),
 (r"co[- ]design|morpholog|design optimiz", "codesign-dex-agentic"),
 (r"(agentic|llm|language model).*(dexter|manipulat|grasp)|reward (design|generation).*(llm|language)", "auto-research-dex"),
 (r"\bllm\b|agentic|autonomous research|language model.*robot", "agentic-physical"),
 (r"world model|world[- ]action|latent predict|video predict", "wm-residual"),
 (r"retarget", "learned-retargeting"),
 (r"\bumi\b|universal manipulation interface|handheld gripper", "wam-umi-gloves"),
 (r"hand.*(tendon|dof|design)|anthropomorphic hand", "hand-22dof"),
 (r"mobile manipulat", "mobile-dex-umi"),
 (r"third[- ]person|exocentric", "third-person"),
 (r"human[- ]robot (interaction|collaborat)|handover", "hri-collab"),
 (r"deformable|cloth|soft object|fabric|rope|linear object", "soft-sim2real"),
]
IDEA_HINTS = [(re.compile(p, re.I), i) for p,i in IDEA_HINTS]

FOLDER_PROJECT = {"m2_lit":"m2", "mabel_lit":"mabel", "mpr":"iris"}
FOLDER_IDEA = {
  "multi_agent_rl":"multi-robot-marl", "multi_robot_collaboration":"multi-robot-marl",
  "collaborative_transport":"multi-robot-marl", "distributed_mpc":"multi-robot-marl",
  "learning_from_human_video":"ego-dex", "whole_body_loco_manipulation":"mobile-dex-umi",
  "mobile_bimanual_platforms":"mobile-dex-umi", "teleop_and_retargeting":"learned-retargeting",
}

def classify(text, folder):
    for rx, t, b, extra in RULES:
        if rx.search(text): return t, b, extra
    return "il", "visuomotor", []

merged, attached, dropped = [], 0, 0
seen_ids = set(CUR)
for a in auto:
    if DROP.search(a["file"]) or DROP.search(a["title"]):
        dropped += 1; continue
    arx = a.get("arxiv")
    local = a["path"].replace(HOME, "~")
    # attach to curated?
    hit = by_arx.get(arx) if arx else None
    if not hit:
        hit = by_title.get(norm(a["title"])[:60])
    if hit:
        if not hit["local"]: hit["local"] = local
        if not hit["abstract"]: hit["abstract"] = a.get("abstract","")
        if not hit["institutions"] and a.get("institutions"): hit["institutions"] = a["institutions"]
        if not hit["authors"] and a.get("authors"): 
            hit["authors"] = a["authors"]; hit["first_author"] = a["authors"][0]
        attached += 1; continue
    # your own papers live in the site's Publications page, not here
    if "My Papers" in a["folder"]:
        dropped += 1; continue
    blob = f"{a['title']} {a.get('abstract','')} {a['folder']}"
    tree, branch, extra = classify(blob, a["folder"])
    pid = re.sub(r"[^a-z0-9]+","-", norm(a["title"])[:40]) or f"auto{len(merged)}"
    pid = f"x-{pid[:44]}"
    n = 2
    while pid in seen_ids: pid = f"x-{pid[:40]}-{n}"; n += 1
    seen_ids.add(pid)
    date = (a.get("published") or "")[:10]
    year = int(date[:4]) if date[:4].isdigit() else None
    if not year:
        m = re.match(r"(\d{4})_", a["file"]); year = int(m.group(1)) if m else None
    projects = []
    p = FOLDER_PROJECT.get(a["source"])
    if p: projects.append(p)
    ideas = []
    fi = FOLDER_IDEA.get(os.path.basename(a["folder"]))
    if fi: ideas.append(fi)
    for rx, i in IDEA_HINTS:
        if rx.search(blob) and i not in ideas: ideas.append(i)
    topics = extra + []
    fold = os.path.basename(a["folder"]).replace("_"," ")
    if fold and fold not in ("_root",".") and len(fold) < 40: topics.append(fold)
    venue = a.get("venue_guess","")
    if not venue and a.get("comment"):
        for v in ("CoRL","ICRA","IROS","RSS","NeurIPS","ICLR","ICML","CVPR","ICCV","ECCV","Humanoids"):
            if re.search(rf"\b{v}\b", a["comment"], re.I): venue = v; break
    merged.append(dict(
      id=pid, title=a["title"], tree=tree, branch=branch,
      authors=a.get("authors",[]), first_author=(a.get("authors") or [""])[0],
      corresponding=[], institutions=a.get("institutions",[]), lab="",
      venue=venue or ("arXiv" if arx else ""), venue_type=a.get("venue_type_guess","") or ("preprint" if arx else ""),
      year=year, date=date, topics=topics[:6], paradigm=[], method=[],
      projects=projects, ideas=ideas[:4], related=[], arxiv=arx or "", doi=a.get("doi",""),
      url=(f"https://arxiv.org/abs/{arx}" if arx else (f"https://doi.org/{a['doi']}" if a.get("doi") else "")),
      code="", site="", abstract=a.get("abstract",""), note="", stars=1,
      curated=False, local=local, source="library",
    ))

papers = list(CUR.values()) + merged

# ---- resolve related edges; add topic-based edges for graph density
ids = {p["id"] for p in papers}
for p in papers:
    p["related"] = [r for r in p.get("related",[]) if r in ids and r != p["id"]]
# make edges symmetric
adj = {p["id"]: set(p["related"]) for p in papers}
for p in papers:
    for r in p["related"]: adj[r].add(p["id"])
for p in papers:
    p["related"] = sorted(adj[p["id"]])


# ---- derive project membership for the idea-driven current projects ----
IDEA2PROJ = {
  "real2sim2real-ego":"r2s2r", "third-person":"r2s2r", "ego-dex":"r2s2r",
  "wam-umi-gloves":"wam-tactile", "tactile-wm":"wam-tactile", "wm-residual":"wam-tactile",
}
for p in papers:
    p["projects"] = [x for x in (p.get("projects") or []) if x != "mine"]
    for i in (p.get("ideas") or []):
        pr = IDEA2PROJ.get(i)
        if pr and pr not in p["projects"]: p["projects"].append(pr)
    p["projects"] = sorted(set(p["projects"]))

# ---- apply the OpenAlex/PDF correction overlay, if it exists ----
CORRFILE = os.path.join(HERE, "corrections.json")
if os.path.exists(CORRFILE):
    corr = json.load(open(CORRFILE)); napp = 0
    for p in papers:
        c = corr.get(p["id"])
        if not c: continue
        napp += 1
        if c.get("title_pdf"): p["title"] = c["title_pdf"]
        if c.get("title_oa"):  p["title"] = c["title_oa"]
        for k_src, k_dst in (("authors_pdf","authors"),("authors","authors"),
                             ("corresponding","corresponding"),("institutions","institutions"),
                             ("doi","doi"),("venue","venue"),("date","date"),("url","url")):
            if c.get(k_src): p[k_dst] = c[k_src]
        if p.get("authors"): p["first_author"] = p["authors"][0]
        if p.get("date") and str(p["date"])[:4].isdigit(): p["year"] = int(str(p["date"])[:4])
        if p.get("arxiv"): p["arxiv_url"] = f"https://arxiv.org/abs/{p['arxiv']}"
    print(f"corrections applied: {napp}")

# ---- re-attach figures already extracted to disk ----
FIGDIR = os.path.join(os.path.dirname(HERE), "figures")
if os.path.isdir(FIGDIR):
    have = set(os.listdir(FIGDIR)); nfig = 0
    for p in papers:
        if f"{p['id']}.webp" in have:
            p["fig"] = f"figures/{p['id']}.webp"; nfig += 1
        ex = [f"figures/{p['id']}-{i}.webp" for i in (1,2,3) if f"{p['id']}-{i}.webp" in have]
        if ex: p["figs"] = ex
    print(f"figures attached: {nfig}")

for p in papers:
    if not p.get("year") and p.get("date"): 
        try: p["year"] = int(p["date"][:4])
        except: pass

papers.sort(key=lambda p: (-(p.get("stars") or 1), -(p.get("year") or 0), p["title"]))

meta = dict(
  generated=datetime.date.today().isoformat(),
  counts=dict(total=len(papers), curated=len(CUR), library=len(merged),
              attached=attached, dropped=dropped),
  trees=schema.TREES, projects=schema.PROJECTS, ideas=schema.IDEAS,
)
json.dump(dict(meta=meta, papers=papers), open(OUT,"w"), indent=1, ensure_ascii=False)
print(f"papers: {len(papers)}  (curated {len(CUR)}, library {len(merged)}, "
      f"attached-to-curated {attached}, dropped {dropped})")
from collections import Counter
print("by tree:", Counter(p["tree"] for p in papers))
print("with local pdf:", sum(1 for p in papers if p["local"]))
print("with institutions:", sum(1 for p in papers if p["institutions"]))
print("with venue:", sum(1 for p in papers if p["venue"]))
print("edges:", sum(len(p["related"]) for p in papers)//2)
print("->", OUT)

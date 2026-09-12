# -*- coding: utf-8 -*-
"""Build datasets_data.json: annotation table + authoritative arXiv metadata,
with every project URL checked over the network so no dead link ships."""
import json, os, sys, re, time, urllib.request, urllib.error, concurrent.futures as cf
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
ROOT=os.path.dirname(HERE)
import datasets as DS

DP  = json.load(open(os.path.join(HERE,"dataset_papers.json")))
PDB = json.load(open(os.path.join(ROOT,"papers_data.json")))
BY_AX = {p["arxiv"]: p for p in PDB["papers"] if p.get("arxiv")}

CATS = {
 "ego":   ("Egocentric human", "First-person capture of people doing things — the largest and cheapest source of manipulation data."),
 "exo":   ("Third-person video", "Exocentric human video: abundant, noisy, and the hardest viewpoint to transfer from."),
 "umi":   ("UMI & handheld", "Robot-free capture rigs that produce directly deployable demonstrations."),
 "teleop":("Teleoperation", "Demonstrations collected by a human driving the robot, through leader-follower, VR or exoskeleton."),
 "robot": ("Robot manipulation at scale", "Large pooled corpora of real robot trajectories, single- and cross-embodiment."),
 "dex":   ("Hand-object & dexterous", "Fine-grained hand pose, contact and grasping — human and synthetic."),
 "tactile":("Tactile", "Touch data, paired with vision and language where it exists."),
 "hri":   ("Human-robot interaction", "Robots perceiving, navigating around, and physically exchanging objects with people."),
 "multi": ("Multi-robot & collaboration", "Two or more agents coordinating on a shared task. The thinnest category here, which is itself the finding."),
 "motion":("Human motion & humanoid", "Mocap and pose corpora that humanoid whole-body controllers are trained on."),
 "sim":   ("Simulation benchmarks", "Task suites that define what progress is measured against."),
}
ORDER = ["ego","umi","teleop","robot","dex","tactile","hri","multi","exo","motion","sim"]

UA={"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                 "(KHTML, like Gecko) Chrome/131.0 Safari/537.36",
    "Accept":"text/html,application/xhtml+xml,*/*;q=0.8","Accept-Language":"en-US,en;q=0.9"}
SOFT404 = re.compile(r"(404|page not found|site not found|not be found|doesn'?t exist|"
                     r"no longer available|there isn'?t a github pages site here|"
                     r"we can'?t find the page)", re.I)
def check(url):
    """None = do not ship this link. Catches soft-404s, not just error codes."""
    if not url or not url.startswith("http"): return None
    try:
        req=urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=30) as r:
            if not (200 <= r.status < 400): return None
            ctype=r.headers.get("Content-Type","")
            body=r.read(120000).decode("utf-8","ignore") if ("html" in ctype or "text" in ctype) else ""
    except urllib.error.HTTPError as e:
        return e.code if e.code in (403,429) else None    # 403/429 = alive but blocking us
    except Exception:
        return None
    if body:
        m=re.search(r"<title[^>]*>(.*?)</title>", body, re.S|re.I)
        title=m.group(1) if m else ""
        head=re.sub(r"<script.*?</script>|<style.*?</style>","",body[:60000],flags=re.S|re.I)
        head=re.sub(r"<[^>]+>"," ",head)[:2500]
        if SOFT404.search(title) or SOFT404.search(head): return None
    return 200

rows=[]
for r in DS.ROWS:
    ax=r.get("arxiv","")
    meta = DP.get(ax) or {}
    pdb  = BY_AX.get(ax) or {}
    title   = meta.get("title") or pdb.get("title") or r.get("name") or r["id"]
    authors = meta.get("authors") or pdb.get("authors") or []
    date    = r.get("date") or meta.get("published") or pdb.get("date") or ""
    year    = r.get("year") or (int(date[:4]) if date[:4].isdigit() else None)
    insts   = meta.get("institutions") or pdb.get("institutions") or []
    rows.append(dict(
      id=r["id"], name=r.get("name") or title.split(":")[0].strip(), title=title,
      cat=r["cat"], org=r["org"], one=r["one"],
      device=r.get("device",""), modal=r.get("modal",""),
      hours=r.get("hours","—"), eps=r.get("eps","—"), tasks=r.get("tasks","—"),
      scenes=r.get("scenes","—"), subj=r.get("subj","—"), embod=r.get("embod","—"),
      note=r.get("note",""), arxiv=ax, authors=authors, year=year, date=date,
      institutions=insts,
      paper=(f"https://arxiv.org/abs/{ax}" if ax else ""),
      site=r.get("site",""), fig="",
    ))

# ---- verify project links in parallel ----
urls=sorted({x["site"] for x in rows if x.get("site")})
print(f"checking {len(urls)} project links…", flush=True)
status={}
with cf.ThreadPoolExecutor(max_workers=10) as ex:
    for u,s in zip(urls, ex.map(check, urls)): status[u]=s
dead=[u for u,s in status.items() if s is None]
for x in rows:
    s=status.get(x.get("site"))
    if x.get("site") and s is None:
        x["site_dead"]=x.pop("site"); x["site"]=""
print(f"  reachable: {sum(1 for s in status.values() if s)}   unreachable: {len(dead)}")
for u in dead: print("   DEAD:", u)

# ---- figures already on disk ----
figdir=os.path.join(ROOT,"figures")
have=set(os.listdir(figdir)) if os.path.isdir(figdir) else set()
for x in rows:
    if f"ds-{x['id']}.webp" in have: x["fig"]=f"figures/ds-{x['id']}.webp"
    ex=[f"figures/ds-{x['id']}-{i}.webp" for i in (1,2,3) if f"ds-{x['id']}-{i}.webp" in have]
    if ex: x["figs"]=ex

def hnum(h):
    """parse the hours string into a sortable number"""
    if not h or h=="—": return -1
    m=re.search(r"([\d,.]+)\s*([KkMm]?)", h.replace(",",""))
    if not m: return -1
    try: v=float(m.group(1))
    except ValueError: return -1
    return v*{"k":1e3,"K":1e3,"m":1e6,"M":1e6}.get(m.group(2),1)
for x in rows: x["hours_num"]=hnum(x["hours"])
# biggest first inside each category, then newest
rows.sort(key=lambda x:(ORDER.index(x["cat"]), -x["hours_num"], -(x["year"] or 0), x["name"]))
out=dict(meta=dict(generated=time.strftime("%Y-%m-%d"), total=len(rows),
                   categories={k:dict(name=v[0], blurb=v[1]) for k,v in CATS.items()},
                   order=ORDER),
         datasets=rows)
json.dump(out, open(os.path.join(ROOT,"datasets_data.json"),"w"), indent=1, ensure_ascii=False)
from collections import Counter
print(f"\ndatasets: {len(rows)}")
print("by category:", {CATS[k][0]: v for k,v in Counter(x['cat'] for x in rows).items()})
print("with a live project link:", sum(1 for x in rows if x.get('site')))
print("with an arXiv paper     :", sum(1 for x in rows if x.get('arxiv')))

# -*- coding: utf-8 -*-
"""Merge the review modules, validate every [[paper-id]] cross-reference against
the database, and emit reviews.json."""
import json, os, re, sys
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
ROOT=os.path.dirname(HERE)
import reviews_a, reviews_b, reviews_c
import schema

R={}
for m in (reviews_a, reviews_b, reviews_c): R.update(m.R)

db=json.load(open(os.path.join(ROOT,"papers_data.json")))
ids={p["id"] for p in db["papers"]}
titles={p["id"]: p["title"] for p in db["papers"]}
idea_ids={i["id"] for i in db["meta"]["ideas"]}

# readable aliases -> real ids, resolved by arXiv id or title prefix so they
# survive the automatic title-sync step
ALIASES = {
  "dreamhand": {"arxiv": "2608.20308"},
  "mimicfunc": {"title_prefix": "MimicFunc"},
}
alias_map = {}
for name, sel in ALIASES.items():
    for pp in db["papers"]:
        if sel.get("arxiv") and pp.get("arxiv") == sel["arxiv"]: alias_map[name] = pp["id"]; break
        if sel.get("title_prefix") and pp["title"].startswith(sel["title_prefix"]): alias_map[name] = pp["id"]; break
print("aliases resolved     :", alias_map)

def apply_aliases(v):
    if isinstance(v, str):
        for a, real in alias_map.items(): v = v.replace(f"[[{a}]]", f"[[{real}]]")
        return v
    if isinstance(v, list):  return [apply_aliases(x) for x in v]
    if isinstance(v, dict):  return {k: (alias_map.get(x, x) if k == "id" else apply_aliases(x)) for k, x in v.items()}
    return v
R = {k: apply_aliases(v) for k, v in R.items()}

REF=re.compile(r"\[\[([a-zA-Z0-9\-\._]+)\]\]")
bad={}; used=set(); nref=0
def walk(v, path):
    global nref
    if isinstance(v,str):
        for m in REF.finditer(v):
            nref+=1; k=m.group(1); used.add(k)
            if k not in ids: bad.setdefault(k,[]).append(path)
    elif isinstance(v,list):
        for i,x in enumerate(v): walk(x,f"{path}[{i}]")
    elif isinstance(v,dict):
        for kk,x in v.items(): walk(x,f"{path}.{kk}")
for k,v in R.items(): walk(v,k)

# reading-list ids must resolve too
for k,v in R.items():
    for r in v.get("read",[]):
        used.add(r["id"])
        if r["id"] not in ids: bad.setdefault(r["id"],[]).append(k+".read")

missing_ideas = idea_ids - set(R)
extra_ideas   = set(R) - idea_ids

print(f"reviews written      : {len(R)} / {len(idea_ids)} ideas")
if missing_ideas: print("  ideas WITHOUT a review:", sorted(missing_ideas))
if extra_ideas:   print("  reviews with no idea  :", sorted(extra_ideas))
print(f"cross-references     : {nref} inline + reading lists, {len(used)} distinct papers")
print(f"unresolved references: {len(bad)}")
for k,v in sorted(bad.items()): print(f"   [[{k}]]  used in: {', '.join(sorted(set(x.split('.')[0] for x in v)))}")

if not bad:
    json.dump(R, open(os.path.join(ROOT,"reviews.json"),"w"), indent=1, ensure_ascii=False)
    words=sum(len(re.sub(r"<[^>]+>"," ",str(v)).split()) for v in R.values())
    print(f"\nwrote reviews.json  ({words:,} words across {len(R)} reviews)")
else:
    print("\nNOT written — fix the unresolved references first.")

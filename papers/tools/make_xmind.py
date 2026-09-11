# -*- coding: utf-8 -*-
"""Generate papers_by_project.xmind — an XMind (Zen/2020+) mind map of the whole
library, organised by project. Also writes a Markdown outline as a fallback for
tools that do not read .xmind."""
import json, os, zipfile, uuid, datetime, html, re

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
DB=os.path.join(ROOT,"papers_data.json")
OUT=os.path.join(ROOT,"papers_by_project.xmind")
MD =os.path.join(ROOT,"papers_by_project.md")

d=json.load(open(DB)); PAPERS=d["papers"]; META=d["meta"]
BYID={p["id"]:p for p in PAPERS}
TREES=META["trees"]; PROJECTS=META["projects"]; IDEAS=META["ideas"]

def nid(): return uuid.uuid4().hex[:26]
def topic(title, children=None, note=None, href=None, labels=None, branch=None):
    t={"id":nid(),"class":"topic","title":title}
    if note:   t["notes"]={"plain":{"content":note}}
    if href:   t["href"]=href
    if labels: t["labels"]=labels[:3]
    if branch: t["branch"]=branch
    if children: t["children"]={"attached":children}
    return t

def paper_topic(p):
    bits=[]
    if p.get("venue"): bits.append(p["venue"])
    if p.get("year"):  bits.append(str(p["year"]))
    label=" ".join(bits)
    who = (p.get("first_author") or "")
    if who and len(p.get("authors") or [])>1: who += " et al."
    inst = (p.get("institutions") or [""])[0]
    note_parts=[]
    if who:  note_parts.append(who)
    if inst: note_parts.append(inst)
    if p.get("lab"): note_parts.append(p["lab"])
    if p.get("corresponding"): note_parts.append("Corresponding: "+", ".join(p["corresponding"]))
    if p.get("note"): note_parts.append("\n"+p["note"])
    if p.get("local"): note_parts.append("\nOn disk: "+p["local"])
    return topic(p["title"], note="\n".join(note_parts) or None,
                 href=p.get("url") or None, labels=[label] if label else None)

def group_by_branch(papers, title, note=None):
    """papers -> tree -> branch -> papers, oldest first"""
    kids=[]
    for tk,tree in TREES.items():
        inb=[p for p in papers if p["tree"]==tk]
        if not inb: continue
        bkids=[]
        for bk,(bname,bdesc) in tree["branches"].items():
            ps=[p for p in inb if p["branch"]==bk]
            if not ps: continue
            ps.sort(key=lambda p:(p.get("year") or 9999, p["title"]))
            bkids.append(topic(f"{bname}  ({len(ps)})", children=[paper_topic(p) for p in ps], note=bdesc))
        if bkids:
            kids.append(topic(f"{tree['name']}  ({len(inb)})", children=bkids, note=tree["blurb"]))
    return topic(f"{title}  ({len(papers)})", children=kids, note=note)

# ---------------- build the map ----------------
root_kids=[]
for kind,label in (("current","CURRENT PROJECTS"),("past","PAST PROJECTS")):
    proj=[ (k,v) for k,v in PROJECTS.items() if v.get("kind")==kind ]
    proj.sort(key=lambda kv: kv[1].get("order",99))
    pk=[]
    for k,v in proj:
        ps=[p for p in PAPERS if k in (p.get("projects") or [])]
        ideas=[i for i in IDEAS if i.get("project")==k]
        kids=[group_by_branch(ps, "Reading", v["blurb"])] if ps else []
        if ideas:
            kids.append(topic("Research ideas", children=[
                topic(i["title"], note=i["pitch"], children=[
                    paper_topic(BYID[x["id"]]) for x in [] ]) for i in ideas]))
        pk.append(topic(f"{v['name']} — {v['tag']}", children=kids, note=v["blurb"]))
    if pk: root_kids.append(topic(label, children=pk))

# research ideas as their own trunk
idea_kids=[]
for i in IDEAS:
    ps=[p for p in PAPERS if i["id"] in (p.get("ideas") or [])]
    ps.sort(key=lambda p:(-(p.get("stars") or 1), -(p.get("year") or 0)))
    note=i["pitch"]
    if i.get("merged") and len(i["merged"])>1:
        note += "\n\nMerged from: " + " · ".join(i["merged"])
    proj=PROJECTS.get(i.get("project",""),{}).get("name","")
    idea_kids.append(topic(f"{i['title']}" + (f"  [{proj}]" if proj else ""),
        children=[paper_topic(p) for p in ps[:28]], note=note))
root_kids.append(topic(f"RESEARCH IDEAS  ({len(IDEAS)})", children=idea_kids))

# the three trees as their own trunk
tree_kids=[]
for tk,tree in TREES.items():
    bk=[]
    for b,(bname,bdesc) in tree["branches"].items():
        ps=[p for p in PAPERS if p["tree"]==tk and p["branch"]==b]
        if not ps: continue
        ps.sort(key=lambda p:(p.get("year") or 9999, p["title"]))
        bk.append(topic(f"{bname}  ({len(ps)})", children=[paper_topic(p) for p in ps], note=bdesc))
    tree_kids.append(topic(f"{tree['name']}  ({sum(1 for p in PAPERS if p['tree']==tk)})",
                           children=bk, note=tree["blurb"]))
root_kids.append(topic("THE THREE TREES", children=tree_kids))

root=topic(f"Paper Atlas — {len(PAPERS)} papers", children=root_kids,
           note=f"Generated {datetime.date.today().isoformat()} from papers_data.json. "
                f"{META['counts']['curated']} hand-annotated, {META['counts']['library']} harvested from disk.")
root["structureClass"]="org.xmind.ui.map.unbalanced"

sheet={"id":nid(),"class":"sheet","title":"Papers by project","rootTopic":root,
       "theme":{"id":nid(),"importedId":"colorful","title":"Colorful"}}
content=[sheet]
manifest={"file-entries":{"content.json":{},"metadata.json":{}}}
metadata={"creator":{"name":"paper-atlas","version":"1.0"}}

with zipfile.ZipFile(OUT,"w",zipfile.ZIP_DEFLATED) as z:
    z.writestr("content.json", json.dumps(content, ensure_ascii=False))
    z.writestr("metadata.json", json.dumps(metadata, ensure_ascii=False))
    z.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False))

# ---- markdown outline fallback ----
def md_walk(t, depth, out):
    ind="  "*(depth)
    title=t["title"]
    href=t.get("href")
    line=f"{ind}- {'['+title+']('+href+')' if href else title}"
    lab=t.get("labels")
    if lab: line += f"  `{lab[0]}`"
    out.append(line)
    for c in (t.get("children") or {}).get("attached",[]): md_walk(c, depth+1, out)
lines=[f"# Paper Atlas — papers by project", "",
       f"_{len(PAPERS)} papers · generated {datetime.date.today().isoformat()}_",""]
for c in root_kids:
    lines.append(f"\n## {c['title']}\n")
    for cc in (c.get("children") or {}).get("attached",[]): md_walk(cc,0,lines)
open(MD,"w").write("\n".join(lines))

def count(t):
    return 1+sum(count(c) for c in (t.get("children") or {}).get("attached",[]))
print(f"wrote {OUT}  ({os.path.getsize(OUT)/1024:.0f} KB, {count(root)} topics)")
print(f"wrote {MD}   ({os.path.getsize(MD)/1024:.0f} KB)")

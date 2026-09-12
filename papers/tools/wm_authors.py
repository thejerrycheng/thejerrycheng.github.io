# -*- coding: utf-8 -*-
"""OpenAlex returns some author names as "Last, First". arXiv is authoritative for
author *order and spelling*, so take the list from there and fall back to flipping
the comma form for anything arXiv does not return."""
import json, os, time, urllib.parse, urllib.request, xml.etree.ElementTree as ET
HERE=os.path.dirname(os.path.abspath(__file__))
P=os.path.join(HERE,"wm_papers.json"); SRC=json.load(open(P))
NS={"a":"http://www.w3.org/2005/Atom"}
ids=list(SRC); got={}
for i in range(0,len(ids),15):
    ch=ids[i:i+15]
    u="https://export.arxiv.org/api/query?"+urllib.parse.urlencode({"id_list":",".join(ch),"max_results":15})
    try: raw=urllib.request.urlopen(u,timeout=60).read()
    except Exception as e:
        print("  arxiv fail",e); time.sleep(25); continue
    for e in ET.fromstring(raw).findall("a:entry",NS):
        bid=e.findtext("a:id","",NS).rsplit("/",1)[-1].split("v")[0]
        names=[" ".join((a.findtext("a:name","",NS) or "").split()) for a in e.findall("a:author",NS)]
        if names: got[bid]=names
    print(f"  {min(i+15,len(ids))}/{len(ids)}  cumulative {len(got)}")
    time.sleep(4)

def flip(n):
    if "," in n:
        a,b=[x.strip() for x in n.split(",",1)]
        return f"{b} {a}".strip()
    return n

fixed=0
for aid,m in SRC.items():
    if aid in got:
        if m.get("authors")!=got[aid]: fixed+=1
        m["authors"]=got[aid]
    else:
        old=m.get("authors") or []
        new=[flip(x) for x in old]
        if new!=old: fixed+=1; m["authors"]=new
json.dump(SRC,open(P,"w"),indent=1,ensure_ascii=False)
print(f"\nauthor lists corrected: {fixed} | from arXiv: {len(got)}/{len(ids)}")
for k in ("2503.17973","2507.00990","2411.04983"):
    print(f"  {k}: {SRC[k]['authors'][:5]}")

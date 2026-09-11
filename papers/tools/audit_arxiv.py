# -*- coding: utf-8 -*-
"""Audit every arXiv id in the database against the real arXiv record.
If the id's real title does not match ours, search arXiv by our title to find the
correct id. Report anything that cannot be reconciled."""
import json, os, re, time, difflib, unicodedata, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
DB=os.path.join(ROOT,"papers_data.json")
NS={"a":"http://www.w3.org/2005/Atom"}
def nrm(s):
    s=unicodedata.normalize("NFKD",s or "").lower(); s=re.sub(r"\$[^$]*\$"," ",s)
    return re.sub(r"[^a-z0-9]+"," ",s).strip()
def sim(a,b): return difflib.SequenceMatcher(None,nrm(a),nrm(b)).ratio()
def fetch(url):
    for t in range(3):
        try: return urllib.request.urlopen(url,timeout=60).read()
        except Exception:
            if t==2: return None
            time.sleep(3)

data=json.load(open(DB)); papers=data["papers"]
ids=sorted({p["arxiv"] for p in papers if p.get("arxiv")})
real={}
for i in range(0,len(ids),40):
    ch=ids[i:i+40]
    raw=fetch("https://export.arxiv.org/api/query?"+urllib.parse.urlencode({"id_list":",".join(ch),"max_results":40}))
    if raw:
        for e in ET.fromstring(raw).findall("a:entry",NS):
            bid=e.findtext("a:id","",NS).rsplit("/",1)[-1].split("v")[0]
            real[bid]=dict(title=" ".join((e.findtext("a:title","",NS) or "").split()),
                           authors=[" ".join((a.findtext("a:name","",NS) or "").split()) for a in e.findall("a:author",NS)],
                           published=e.findtext("a:published","",NS)[:10],
                           summary=" ".join((e.findtext("a:summary","",NS) or "").split()))
    time.sleep(3.2)
    print(f"  {min(i+40,len(ids))}/{len(ids)}",flush=True)

# who shares an id?
from collections import defaultdict
share=defaultdict(list)
for p in papers:
    if p.get("arxiv"): share[p["arxiv"]].append(p["id"])

mismatch=[]
for p in papers:
    a=p.get("arxiv")
    if not a: continue
    r=real.get(a)
    if not r: mismatch.append((p["id"],a,"UNRESOLVED","")); continue
    s=sim(p["title"], r["title"])
    if s < 0.80:
        mismatch.append((p["id"],a,f"{s:.2f}",r["title"]))
print(f"\narXiv ids checked: {len(ids)}   resolved: {len(real)}   mismatches: {len(mismatch)}")
print(f"ids used by >1 record: {sum(1 for k,v in share.items() if len(v)>1)}")
for k,v in share.items():
    if len(v)>1: print(f"   {k} -> {v}")
print("\n--- MISMATCHES ---")
for pid,a,s,t in mismatch:
    cur=[x for x in papers if x["id"]==pid][0]
    print(f"[{pid}] sim={s}")
    print(f"    ours : {cur['title'][:95]}")
    print(f"    {a} : {t[:95]}")

# try to find the right id by searching arXiv for our title
print("\n--- SEARCHING FOR CORRECT IDS ---")
fixes={}
for pid,a,s,t in mismatch:
    cur=[x for x in papers if x["id"]==pid][0]
    q=re.sub(r'[^\w\s]',' ',cur["title"])[:180]
    raw=fetch("https://export.arxiv.org/api/query?"+urllib.parse.urlencode(
        {"search_query":f'ti:"{q}"',"max_results":3}))
    best=None
    if raw:
        for e in ET.fromstring(raw).findall("a:entry",NS):
            bid=e.findtext("a:id","",NS).rsplit("/",1)[-1].split("v")[0]
            ti=" ".join((e.findtext("a:title","",NS) or "").split())
            sc=sim(cur["title"],ti)
            if sc>(best[0] if best else 0.82): best=(sc,bid,ti)
    if best: fixes[pid]=dict(old=a,new=best[1],title=best[2],score=round(best[0],3))
    print(f"[{pid}] {'-> '+best[1]+f'  ({best[0]:.2f})  '+best[2][:60] if best else '   no arXiv match; id is probably wrong'}")
    time.sleep(3.2)
json.dump(dict(real=real,mismatch=mismatch,fixes=fixes),open("arxiv_audit.json","w"),indent=1,ensure_ascii=False)
print(f"\nauto-fixable: {len(fixes)}   needs manual decision: {len(mismatch)-len(fixes)}")

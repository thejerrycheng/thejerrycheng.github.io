# -*- coding: utf-8 -*-
"""Fetch world-model paper metadata. OpenAlex by arXiv DOI first (reliable, gives
real venue + institutions), arXiv API as a fallback for anything OpenAlex misses."""
import json, os, sys, time, urllib.request, urllib.parse, xml.etree.ElementTree as ET
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,"wm_papers.json")
MAIL="jerrychengh990427@gmail.com"; UA=f"paper-atlas/1.0 (mailto:{MAIL})"
IDS=sys.argv[1:] or open(os.path.join(HERE,"wm_ids.txt")).read().split()

def get(url):
    for t in range(4):
        try:
            return urllib.request.urlopen(urllib.request.Request(
                url, headers={"User-Agent":UA,"Accept":"application/json"}), timeout=45).read()
        except Exception as e:
            if "404" in str(e): return None
            time.sleep(1.5*(t+1))
    return None

def inv2abs(inv):
    if not inv: return ""
    pos={}
    for w,ix in inv.items():
        for i in ix: pos[i]=w
    return " ".join(pos[i] for i in sorted(pos))

out = json.load(open(OUT)) if os.path.exists(OUT) else {}
for aid in IDS:
    if aid in out and out[aid].get("title"): continue
    raw=get("https://api.openalex.org/works/doi:10.48550/arXiv."+aid+"?mailto="+MAIL)
    if not raw: print(f"  oa-miss {aid}"); continue
    w=json.loads(raw)
    auths=[(a.get("author") or {}).get("display_name","") for a in w.get("authorships",[])]
    insts=[]
    for a in w.get("authorships",[]):
        for i in a.get("institutions",[]):
            n=i.get("display_name","")
            if n and n not in insts: insts.append(n)
    pl=w.get("primary_location") or {}; src=pl.get("source") or {}
    out[aid]=dict(arxiv=aid, title=w.get("title") or w.get("display_name") or "",
        authors=auths, institutions=insts,
        abstract=inv2abs(w.get("abstract_inverted_index")),
        published=w.get("publication_date",""),
        venue=src.get("display_name",""), venue_type=src.get("type",""),
        doi=(w.get("doi") or "").replace("https://doi.org/",""),
        cited=w.get("cited_by_count",0), oa=True)
    print(f"  ok {aid}  {out[aid]['title'][:70]}")
    time.sleep(0.35)

# arXiv fallback for whatever OpenAlex did not have
miss=[i for i in IDS if i not in out or not out[i].get("title")]
NS={"a":"http://www.w3.org/2005/Atom","arxiv":"http://arxiv.org/schemas/atom"}
for i in range(0,len(miss),15):
    ch=miss[i:i+15]
    u="https://export.arxiv.org/api/query?"+urllib.parse.urlencode({"id_list":",".join(ch),"max_results":15})
    try: raw=urllib.request.urlopen(u,timeout=60).read()
    except Exception as e: print("  arxiv fail",e); time.sleep(20); continue
    for e in ET.fromstring(raw).findall("a:entry",NS):
        bid=e.findtext("a:id","",NS).rsplit("/",1)[-1].split("v")[0]
        t=" ".join((e.findtext("a:title","",NS) or "").split())
        if not t: continue
        out[bid]=dict(arxiv=bid, title=t,
          authors=[" ".join((a.findtext("a:name","",NS) or "").split()) for a in e.findall("a:author",NS)],
          institutions=[], abstract=" ".join((e.findtext("a:summary","",NS) or "").split()),
          published=e.findtext("a:published","",NS)[:10],
          venue="arXiv", venue_type="repository",
          doi=e.findtext("arxiv:doi","",NS) or "",
          comment=" ".join((e.findtext("arxiv:comment","",NS) or "").split()), cited=0, oa=False)
        print(f"  ax {bid}  {t[:70]}")
    time.sleep(4)

json.dump(out,open(OUT,"w"),indent=1,ensure_ascii=False)
still=[i for i in IDS if i not in out]
print(f"\nfetched {len(IDS)-len(still)}/{len(IDS)}   missing: {still}")

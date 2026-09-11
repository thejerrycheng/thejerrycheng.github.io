# -*- coding: utf-8 -*-
"""Find a real link for every record that still has none.
Search arXiv by exact title, then Crossref, then OpenAlex. Anything still
unresolved is reported so it can be handled by hand."""
import json, os, re, time, difflib, unicodedata, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
DB=os.path.join(ROOT,"papers_data.json"); CORR=os.path.join(HERE,"corrections.json")
AUD=os.path.join(HERE,"arxiv_audit.json")
MAIL="jerrychengh990427@gmail.com"; UA=f"paper-atlas/1.0 (mailto:{MAIL})"
NS={"a":"http://www.w3.org/2005/Atom"}
def nrm(s):
    s=unicodedata.normalize("NFKD",s or "").lower(); s=re.sub(r"\$[^$]*\$"," ",s)
    return re.sub(r"[^a-z0-9]+"," ",s).strip()
def sim(a,b): return difflib.SequenceMatcher(None,nrm(a),nrm(b)).ratio()
def get(url,json_hdr=True):
    for t in range(3):
        try:
            h={"User-Agent":UA}
            if json_hdr: h["Accept"]="application/json"
            return urllib.request.urlopen(urllib.request.Request(url,headers=h),timeout=45).read()
        except Exception:
            if t==2: return None
            time.sleep(2*(t+1))

data=json.load(open(DB)); papers=data["papers"]
corr=json.load(open(CORR)) if os.path.exists(CORR) else {}
aud=json.load(open(AUD)) if os.path.exists(AUD) else {"real":{}}
todo=[p for p in papers if not p.get("url")]
print(f"records without a link: {len(todo)}")
fixed=unres=0
for p in todo:
    title=p["title"]
    found=None
    # 1. arXiv exact-title search
    q=re.sub(r'[^\w\s]',' ',title)[:190].strip()
    raw=get("https://export.arxiv.org/api/query?"+urllib.parse.urlencode(
        {"search_query":f'ti:"{q}"',"max_results":4}), json_hdr=False)
    if raw:
        try:
            for e in ET.fromstring(raw).findall("a:entry",NS):
                bid=e.findtext("a:id","",NS).rsplit("/",1)[-1].split("v")[0]
                ti=" ".join((e.findtext("a:title","",NS) or "").split())
                if sim(title,ti)>=0.85:
                    found=dict(kind="arxiv",id=bid,title=ti,
                      authors=[" ".join((a.findtext("a:name","",NS) or "").split()) for a in e.findall("a:author",NS)],
                      date=e.findtext("a:published","",NS)[:10],
                      summary=" ".join((e.findtext("a:summary","",NS) or "").split()))
                    break
        except Exception: pass
    time.sleep(3.2)
    # 2. Crossref
    if not found:
        raw=get("https://api.crossref.org/works?"+urllib.parse.urlencode(
            {"query.bibliographic":title[:200],"rows":3,"mailto":MAIL}))
        if raw:
            try:
                for it in json.loads(raw)["message"]["items"]:
                    t=(it.get("title") or [""])[0]
                    if sim(title,t)>=0.90:
                        found=dict(kind="doi",doi=it.get("DOI",""),title=t,
                          venue=(it.get("container-title") or [""])[0],
                          year=(it.get("issued",{}).get("date-parts") or [[None]])[0][0],
                          authors=[f"{a.get('given','')} {a.get('family','')}".strip() for a in (it.get("author") or [])])
                        break
            except Exception: pass
        time.sleep(0.3)
    # 3. OpenAlex
    if not found:
        raw=get("https://api.openalex.org/works?"+urllib.parse.urlencode(
            {"search":re.sub(r'[^\w\s]',' ',title)[:200],"per-page":3,"mailto":MAIL}))
        if raw:
            try:
                for w in json.loads(raw).get("results",[]):
                    t=w.get("title") or w.get("display_name") or ""
                    if sim(title,t)>=0.90:
                        doi=(w.get("doi") or "").replace("https://doi.org/","")
                        land=((w.get("primary_location") or {}).get("landing_page_url") or "")
                        if doi or land:
                            found=dict(kind="doi" if doi else "url", doi=doi, url=land, title=t,
                              venue=((w.get("primary_location") or {}).get("source") or {}).get("display_name",""),
                              year=w.get("publication_year"),
                              authors=[(a.get("author") or {}).get("display_name","") for a in (w.get("authorships") or [])])
                            break
            except Exception: pass
        time.sleep(0.2)
    c=corr.setdefault(p["id"],{})
    if not found:
        unres+=1; print(f"  UNRESOLVED  {title[:80]}"); continue
    fixed+=1
    if found["kind"]=="arxiv":
        p["arxiv"]=found["id"]; p["url"]=f"https://arxiv.org/abs/{found['id']}"
        p["arxiv_url"]=p["url"]; p["title"]=found["title"]
        if found.get("date"): p["date"]=found["date"]; p["year"]=int(found["date"][:4])
        if found.get("authors"): p["authors"]=found["authors"]; p["first_author"]=found["authors"][0]
        if found.get("summary") and not p.get("abstract"): p["abstract"]=found["summary"]
        aud["real"][found["id"]]=dict(title=found["title"],authors=found.get("authors",[]),
                                      published=found.get("date",""),summary=found.get("summary",""))
        c.update(arxiv=found["id"], url=p["url"], title_oa=found["title"])
        if found.get("date"): c["date"]=found["date"]
        if found.get("authors"): c["authors"]=found["authors"]
        print(f"  arXiv {found['id']}  {found['title'][:66]}")
    else:
        if found.get("doi"):
            p["doi"]=found["doi"]; p["url"]="https://doi.org/"+found["doi"]
        else: p["url"]=found.get("url","")
        p["title"]=found["title"]
        if found.get("year"): p["year"]=found["year"]
        if found.get("authors"): p["authors"]=found["authors"]; p["first_author"]=found["authors"][0]
        c.update(doi=p.get("doi",""), url=p["url"], title_oa=found["title"])
        if found.get("year"): c["date"]=f"{found['year']}-01-01"
        if found.get("authors"): c["authors"]=found["authors"]
        print(f"  DOI  {p.get('doi','')}  {found['title'][:66]}")

json.dump(corr,open(CORR,"w"),indent=1,ensure_ascii=False)
json.dump(aud,open(AUD,"w"),indent=1,ensure_ascii=False)
json.dump(data,open(DB,"w"),indent=1,ensure_ascii=False)
print(f"\nresolved {fixed}   still unresolved {unres}")

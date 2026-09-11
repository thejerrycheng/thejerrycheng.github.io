# -*- coding: utf-8 -*-
"""Second, far more reliable verification pass.
arXiv works are indexed in OpenAlex under DOI 10.48550/arXiv.<id>, and OpenAlex
merges the preprint record with its published version — so a direct DOI lookup
gives the real venue and the publisher DOI without any fuzzy title matching.
Falls back to Crossref for non-arXiv records."""
import json, os, re, time, difflib, unicodedata, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
DB    = os.path.join(ROOT, "papers_data.json")
CACHE = os.path.join(HERE, "verify2_cache.json")
CORR  = os.path.join(HERE, "corrections.json")
MAIL  = "jerrychengh990427@gmail.com"
UA    = f"paper-atlas/1.0 (mailto:{MAIL})"

def nrm(s):
    s = unicodedata.normalize("NFKD", s or "").lower()
    s = re.sub(r"\$[^$]*\$", " ", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()
def sim(a,b): return difflib.SequenceMatcher(None, nrm(a), nrm(b)).ratio()
def get(url):
    for t in range(3):
        try:
            return urllib.request.urlopen(urllib.request.Request(
                url, headers={"User-Agent":UA,"Accept":"application/json"}), timeout=40).read()
        except Exception as e:
            if "404" in str(e): return None
            if t==2: return None
            time.sleep(1.0*(t+1))

PREPRINT = re.compile(r"arxiv|preprint|biorxiv|ssrn|research square|techrxiv|hal science|openreview", re.I)
SHORT = [(r"conference on robot learning|\bcorl\b","CoRL","conference"),
 (r"robotics[ :]?science and systems|\brss\b","RSS","conference"),
 (r"international conference on robotics and automation|\bicra\b","ICRA","conference"),
 (r"intelligent robots and systems|\biros\b","IROS","conference"),
 (r"transactions on robotics","IEEE T-RO","journal"),
 (r"robotics and automation letters","IEEE RA-L","journal"),
 (r"science robotics","Science Robotics","journal"),
 (r"nature machine intelligence","Nature Machine Intelligence","journal"),
 (r"nature communications","Nature Communications","journal"),
 (r"^nature$","Nature","journal"), (r"^science$","Science","journal"),
 (r"international journal of robotics research","IJRR","journal"),
 (r"robotics (and )?automation magazine","IEEE RAM","journal"),
 (r"neural information processing systems|neurips","NeurIPS","conference"),
 (r"learning representations|\biclr\b","ICLR","conference"),
 (r"international conference on machine learning|\bicml\b","ICML","conference"),
 (r"computer vision and pattern recognition|\bcvpr\b","CVPR","conference"),
 (r"international conference on computer vision|\biccv\b","ICCV","conference"),
 (r"european conference on computer vision|\beccv\b","ECCV","conference"),
 (r"siggraph asia","SIGGRAPH Asia","conference"),
 (r"transactions on graphics|siggraph","SIGGRAPH","conference"),
 (r"humanoid robots","IEEE Humanoids","conference"),
 (r"transactions on mechatronics","IEEE/ASME T-Mech","journal"),
 (r"transactions on cybernetics","IEEE T-Cybernetics","journal"),
 (r"machine learning research|\btmlr\b","TMLR","journal"),
 (r"ieee access","IEEE Access","journal"),
 (r"autonomous robots","Autonomous Robots","journal"),
 (r"journal of field robotics","J. Field Robotics","journal"),
 (r"journal of biomechanics","J. Biomechanics","journal")]
def shorten(n):
    n=(n or "").strip()
    if not n: return "",""
    for rx,sh,k in SHORT:
        if re.search(rx,n,re.I): return sh,k
    n2=re.sub(r"^(proceedings of (the )?|\d{4}\s+)","",n,flags=re.I).strip()
    return n2[:44], ("journal" if re.search(r"journal|transactions|letters|magazine",n,re.I) else "conference")

def best_published(rec):
    """return (venue_name, doi, landing_url) of the non-preprint version, if any"""
    locs = []
    pl = rec.get("primary_location")
    if pl: locs.append(pl)
    locs += (rec.get("locations") or [])
    for l in locs:
        src = (l.get("source") or {})
        nm = src.get("display_name","")
        if nm and not PREPRINT.search(nm):
            doi = (l.get("doi") or rec.get("doi") or "").replace("https://doi.org/","")
            if doi.lower().startswith("10.48550"): doi = ""
            return nm, doi, l.get("landing_page_url","") or ""
    return "", "", ""

data = json.load(open(DB)); papers = data["papers"]
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
corr  = json.load(open(CORR)) if os.path.exists(CORR) else {}
n_hit=n_pub=n_inst=n_auth=n_bad=0
bad_ids=[]

for i,p in enumerate(papers):
    key = p["id"]
    if key in cache: rec = cache[key]
    else:
        rec = None
        if p.get("arxiv"):
            raw = get(f"https://api.openalex.org/works/doi:10.48550/arXiv.{p['arxiv']}?mailto={MAIL}")
            if raw:
                try: rec = json.loads(raw)
                except Exception: rec = None
        if rec is None and p.get("doi"):
            raw = get(f"https://api.openalex.org/works/doi:{urllib.parse.quote(p['doi'],safe='')}?mailto={MAIL}")
            if raw:
                try: rec = json.loads(raw)
                except Exception: rec = None
        if rec is None:
            # Crossref exact-ish title query
            raw = get("https://api.crossref.org/works?" + urllib.parse.urlencode(
                {"query.bibliographic": p["title"][:200], "rows": 3, "mailto": MAIL}))
            if raw:
                try:
                    for it in json.loads(raw)["message"]["items"]:
                        t = (it.get("title") or [""])[0]
                        if sim(p["title"], t) >= 0.90:
                            rec = {"_crossref": True, "title": t, "doi": it.get("DOI",""),
                                   "venue": (it.get("container-title") or [""])[0],
                                   "year": (it.get("issued",{}).get("date-parts") or [[None]])[0][0],
                                   "authors": [f"{a.get('given','')} {a.get('family','')}".strip()
                                               for a in (it.get("author") or [])]}
                            break
                except Exception: pass
        cache[key] = rec
        time.sleep(0.12)
    if not rec: 
        n_bad += 1; bad_ids.append(p["id"]); continue
    c = corr.setdefault(p["id"], {})
    if rec.get("_crossref"):
        if sim(p["title"], rec["title"]) < 0.90: continue
        n_hit += 1
        sh,k = shorten(rec.get("venue",""))
        if sh and (not p.get("venue") or p["venue"] in ("arXiv","","—")):
            p["venue"]=sh; p["venue_type"]=k; c["venue"]=sh; n_pub+=1
        if rec.get("doi"):
            p["doi"]=rec["doi"]; p["url"]="https://doi.org/"+rec["doi"]; c["doi"]=rec["doi"]; c["url"]=p["url"]
        if rec.get("authors") and not p.get("authors"):
            p["authors"]=rec["authors"]; p["first_author"]=rec["authors"][0]; c["authors"]=rec["authors"]; n_auth+=1
        continue
    # OpenAlex record
    oa_title = rec.get("title") or rec.get("display_name") or ""
    if oa_title and sim(p["title"], oa_title) < 0.80:
        n_bad += 1; bad_ids.append(p["id"] + " (title drift)"); continue
    n_hit += 1
    auths = rec.get("authorships") or []
    names = [ (a.get("author") or {}).get("display_name","") for a in auths ]
    insts = sorted({ i.get("display_name","") for a in auths for i in (a.get("institutions") or [])
                     if i.get("display_name") })
    corr_a = [ (a.get("author") or {}).get("display_name","") for a in auths if a.get("is_corresponding") ]
    if names and (not p.get("authors") or (not p.get("curated") and len(names) != len(p["authors"]))):
        p["authors"]=names; p["first_author"]=names[0]; c["authors"]=names; n_auth+=1
    if insts:
        p["institutions"]=insts[:8]; c["institutions"]=p["institutions"]; n_inst+=1
    if corr_a and not p.get("corresponding"):
        p["corresponding"]=corr_a; c["corresponding"]=corr_a
    if rec.get("publication_date") and not p.get("date"):
        p["date"]=rec["publication_date"]; c["date"]=p["date"]
    p["cited"]=rec.get("cited_by_count",0)
    ven, doi, land = best_published(rec)
    if ven:
        sh,k = shorten(ven)
        if sh and (not p.get("venue") or p["venue"] in ("arXiv","","—")):
            p["venue"]=sh; p["venue_type"]=k; c["venue"]=sh
        if doi:
            p["doi"]=doi; p["url"]="https://doi.org/"+doi; c["doi"]=doi; c["url"]=p["url"]; n_pub+=1
        elif land:
            p["url"]=land; c["url"]=land; n_pub+=1
        p["published_venue"]=ven
    elif p.get("arxiv") and not p.get("url"):
        p["url"]=f"https://arxiv.org/abs/{p['arxiv']}"
    if (i+1)%60==0:
        json.dump(cache,open(CACHE,"w")); print(f"  {i+1}/{len(papers)} hit={n_hit} pub={n_pub}", flush=True)

json.dump(cache,open(CACHE,"w"))
json.dump(corr,open(CORR,"w"),indent=1,ensure_ascii=False)
json.dump(data,open(DB,"w"),indent=1,ensure_ascii=False)
print(f"\nresolved            : {n_hit}/{len(papers)}")
print(f"published-version   : {n_pub}")
print(f"authors filled      : {n_auth}")
print(f"institutions filled : {n_inst}")
print(f"unresolved          : {n_bad}")
print("unresolved sample   :", bad_ids[:12])

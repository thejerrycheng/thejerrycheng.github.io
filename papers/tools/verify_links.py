# -*- coding: utf-8 -*-
"""Verify every paper link.  For each record:
   1. if it claims an arXiv id, confirm the id's real title matches (arXiv API)
   2. look the paper up in OpenAlex to find the *published* version (DOI + venue)
   3. prefer the proceedings/journal DOI over arXiv for the primary link
   Writes linkcheck.json (report) and openalex.json (cache)."""
import json, os, re, sys, time, unicodedata, urllib.parse, urllib.request, difflib

HERE = os.path.dirname(os.path.abspath(__file__))
DB   = os.path.join(os.path.dirname(HERE), "papers_data.json")
CACHE= os.path.join(HERE, "openalex_cache.json")
MAIL = "jerrychengh990427@gmail.com"
UA   = f"paper-atlas/1.0 (mailto:{MAIL})"

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").lower()
    s = re.sub(r"\$.*?\$", " ", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()
def sim(a,b): return difflib.SequenceMatcher(None, norm(a), norm(b)).ratio()

def get(url, tries=4, pause=1.0):
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept":"application/json"})
            return urllib.request.urlopen(req, timeout=45).read()
        except Exception as e:
            if t == tries-1: return None
            time.sleep(pause*(t+1))
    return None

data = json.load(open(DB))
papers = data["papers"]
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}

# ---------- 1. arXiv id sanity check (batched) ----------
ax_ids = sorted({p["arxiv"] for p in papers if p.get("arxiv")})
ax = {}
import xml.etree.ElementTree as ET
NS={"a":"http://www.w3.org/2005/Atom"}
for i in range(0, len(ax_ids), 40):
    chunk = ax_ids[i:i+40]
    raw = get("https://export.arxiv.org/api/query?"+urllib.parse.urlencode(
        {"id_list":",".join(chunk),"max_results":40}))
    if raw:
        try:
            for e in ET.fromstring(raw).findall("a:entry", NS):
                bid = e.findtext("a:id","",NS).rsplit("/",1)[-1].split("v")[0]
                ax[bid] = " ".join((e.findtext("a:title","",NS) or "").split())
        except Exception as ex: print("  arxiv parse fail", ex)
    time.sleep(3.2)
    print(f"  arxiv {min(i+40,len(ax_ids))}/{len(ax_ids)}", flush=True)

# ---------- 2. OpenAlex lookup ----------
PREPRINT_SRC = re.compile(r"arxiv|preprint|biorxiv|ssrn|research square|techrxiv", re.I)
def openalex(p):
    key = p["id"]
    if key in cache: return cache[key]
    rec = None
    if p.get("doi"):
        raw = get("https://api.openalex.org/works/doi:"+urllib.parse.quote(p["doi"], safe="")+f"?mailto={MAIL}")
        if raw:
            try: rec = json.loads(raw)
            except: rec = None
    if rec is None:
        t = re.sub(r"[^\w\s\-:]", " ", p["title"])[:230]
        raw = get("https://api.openalex.org/works?"+urllib.parse.urlencode(
            {"search": t, "per-page": 5, "mailto": MAIL}))
        best=None
        if raw:
            try:
                for w in json.loads(raw).get("results",[]):
                    s = sim(p["title"], w.get("title") or w.get("display_name") or "")
                    if s > (best[0] if best else 0.80): best=(s,w)
            except Exception: pass
        rec = best[1] if best else None
    out = None
    if rec:
        pl = rec.get("primary_location") or {}
        src = pl.get("source") or {}
        locs = [l for l in (rec.get("locations") or []) if (l.get("source") or {}).get("display_name")]
        pub = None
        for l in [pl]+locs:
            nm = ((l.get("source") or {}).get("display_name") or "")
            if nm and not PREPRINT_SRC.search(nm):
                pub = l; break
        out = dict(
          oa_id=rec.get("id",""), title=rec.get("title") or rec.get("display_name") or "",
          doi=(rec.get("doi") or "").replace("https://doi.org/",""),
          year=rec.get("publication_year"), pubdate=rec.get("publication_date",""),
          type=rec.get("type",""),
          primary_source=src.get("display_name",""), primary_type=src.get("type",""),
          published_source=((pub or {}).get("source") or {}).get("display_name",""),
          published_url=(pub or {}).get("landing_page_url","") if pub else "",
          is_preprint = bool(PREPRINT_SRC.search(src.get("display_name",""))) or rec.get("type")=="preprint",
          institutions=sorted({ i.get("display_name","") for a in (rec.get("authorships") or [])
                                for i in (a.get("institutions") or []) if i.get("display_name") }),
          authors=[ (a.get("author") or {}).get("display_name","") for a in (rec.get("authorships") or []) ],
          corresponding=[ (a.get("author") or {}).get("display_name","")
                          for a in (rec.get("authorships") or []) if a.get("is_corresponding") ],
          oa_pdf=((rec.get("best_oa_location") or {}) or {}).get("pdf_url","") or "",
          match=round(sim(p["title"], rec.get("title") or rec.get("display_name") or ""),3),
        )
    cache[key]=out
    return out

report=[]
for n,p in enumerate(papers):
    issues=[]
    # arXiv id check
    if p.get("arxiv"):
        real = ax.get(p["arxiv"])
        if real is None: issues.append(("arxiv-unresolved", p["arxiv"], ""))
        else:
            s = sim(p["title"], real)
            if s < 0.72: issues.append(("arxiv-title-mismatch", p["arxiv"], f"{s:.2f} :: {real}"))
    oa = openalex(p)
    if oa and oa["match"] >= 0.86:
        if oa["doi"] and not p.get("doi"): issues.append(("doi-found", oa["doi"], oa["published_source"]))
        if oa["published_source"] and not oa["is_preprint"]:
            issues.append(("published-version", oa["doi"] or oa["published_url"], oa["published_source"]))
    report.append(dict(id=p["id"], title=p["title"], arxiv=p.get("arxiv",""), url=p.get("url",""),
                       oa=oa, issues=issues))
    if (n+1)%40==0:
        json.dump(cache, open(CACHE,"w")); print(f"  openalex {n+1}/{len(papers)}", flush=True)
    time.sleep(0.12)

json.dump(cache, open(CACHE,"w"))
json.dump(report, open(os.path.join(HERE,"linkcheck.json"),"w"), indent=1, ensure_ascii=False)
from collections import Counter
c=Counter(k for r in report for k,_,_ in r["issues"])
print("\n=== link check ===")
print("records:", len(report))
print("openalex matched:", sum(1 for r in report if r["oa"] and r["oa"]["match"]>=0.86))
for k,v in c.items(): print(f"  {k}: {v}")
print("\narXiv title mismatches (need manual fix):")
for r in report:
    for k,a,b in r["issues"]:
        if k in ("arxiv-title-mismatch","arxiv-unresolved"):
            print(f"  [{r['id']}] {r['title'][:70]}\n      claimed arXiv {a}  -> {b[:90]}")

# -*- coding: utf-8 -*-
"""Correctness pass over the whole database.
 1. re-read titles/authors from the PDF by typography for auto-harvested rows
 2. look every paper up in OpenAlex; adopt canonical title, authors, institutions,
    venue, date and DOI when the match is confident
 3. point the primary link at the PUBLISHED version (DOI / publisher page) whenever
    one exists; arXiv becomes the secondary link
 4. drop duplicates
Writes corrections.json (reproducible overlay) and updates papers_data.json."""
import json, os, re, sys, time, difflib, unicodedata, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE)
DB   = os.path.join(ROOT, "papers_data.json")
CACHE= os.path.join(HERE, "openalex_cache.json")
CORR = os.path.join(HERE, "corrections.json")
HOME = os.path.expanduser("~")
MAIL = "jerrychengh990427@gmail.com"
UA   = f"paper-atlas/1.0 (mailto:{MAIL})"
from pdf_title import title_from_pdf

def nrm(s):
    s = unicodedata.normalize("NFKD", s or "").lower()
    s = re.sub(r"\$[^$]*\$", " ", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()
def sim(a,b): return difflib.SequenceMatcher(None, nrm(a), nrm(b)).ratio()
def get(url, tries=3):
    for t in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(
                url, headers={"User-Agent":UA,"Accept":"application/json"}), timeout=40).read()
        except Exception:
            if t==tries-1: return None
            time.sleep(1.2*(t+1))

PREPRINT = re.compile(r"arxiv|preprint|biorxiv|ssrn|research square|techrxiv|hal |openreview", re.I)
VENUE_SHORT = [
 (r"conference on robot learning|\bcorl\b","CoRL","conference"),
 (r"robotics[: ]?science and systems|\brss\b","RSS","conference"),
 (r"international conference on robotics and automation|\bicra\b","ICRA","conference"),
 (r"intelligent robots and systems|\biros\b","IROS","conference"),
 (r"transactions on robotics","IEEE T-RO","journal"),
 (r"robotics and automation letters","IEEE RA-L","journal"),
 (r"science robotics","Science Robotics","journal"),
 (r"nature machine intelligence","Nature Machine Intelligence","journal"),
 (r"^nature$","Nature","journal"),
 (r"^science$","Science","journal"),
 (r"international journal of robotics research","IJRR","journal"),
 (r"robotics (and )?automation magazine","IEEE RAM","journal"),
 (r"neural information processing systems|neurips|\bnips\b","NeurIPS","conference"),
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
 (r"journal of biomechanics","J. Biomechanics","journal"),
 (r"transactions on machine learning research|\btmlr\b","TMLR","journal"),
 (r"ieee access","IEEE Access","journal"),
 (r"\bsensors\b","Sensors","journal"),
]
def shorten_venue(name):
    n = (name or "").strip()
    if not n: return "", ""
    for rx, short, kind in VENUE_SHORT:
        if re.search(rx, n, re.I): return short, kind
    n2 = re.sub(r"^(proceedings of (the )?|\d{4}\s+)", "", n, flags=re.I).strip()
    return (n2[:46], "journal" if re.search(r"journal|transactions|letters|magazine", n, re.I) else "conference")

def openalex(title, doi="", arxiv=""):
    if doi:
        raw = get(f"https://api.openalex.org/works/doi:{urllib.parse.quote(doi,safe='')}?mailto={MAIL}")
        if raw:
            try: return json.loads(raw)
            except Exception: pass
    q = re.sub(r"[^\w\s\-:]", " ", title)[:230]
    raw = get("https://api.openalex.org/works?" + urllib.parse.urlencode(
        {"search": q, "per-page": 5, "mailto": MAIL}))
    best = None
    if raw:
        try:
            for w in json.loads(raw).get("results", []):
                s = sim(title, w.get("title") or w.get("display_name") or "")
                if s > (best[0] if best else 0.0): best = (s, w)
        except Exception: pass
    return best[1] if best and best[0] >= 0.86 else None

def summarise(rec):
    if not rec: return None
    pl  = rec.get("primary_location") or {}
    src = pl.get("source") or {}
    pub = None
    for l in [pl] + (rec.get("locations") or []):
        nm = ((l.get("source") or {}).get("display_name") or "")
        if nm and not PREPRINT.search(nm): pub = l; break
    auths = rec.get("authorships") or []
    return dict(
        title = rec.get("title") or rec.get("display_name") or "",
        doi   = (rec.get("doi") or "").replace("https://doi.org/",""),
        year  = rec.get("publication_year"), date = rec.get("publication_date",""),
        venue_raw = ((pub or {}).get("source") or {}).get("display_name","") or src.get("display_name",""),
        published = bool(pub),
        pub_url = (pub or {}).get("landing_page_url","") if pub else "",
        authors = [ (a.get("author") or {}).get("display_name","") for a in auths ],
        corresponding = [ (a.get("author") or {}).get("display_name","") for a in auths if a.get("is_corresponding") ],
        institutions = sorted({ i.get("display_name","") for a in auths
                                for i in (a.get("institutions") or []) if i.get("display_name") }),
        cited = rec.get("cited_by_count", 0),
    )

data = json.load(open(DB)); papers = data["papers"]
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
corrections = {}
n_title = n_oa = n_pub = 0

# ---- pass 1: recover titles from PDF typography (auto rows only) ----
for p in papers:
    if p.get("curated") or p.get("arxiv") or not p.get("local"): continue
    path = p["local"].replace("~", HOME)
    if not os.path.exists(path): continue
    try: t, a = title_from_pdf(path)
    except Exception: continue
    if not t: continue
    if sim(t, p["title"]) < 0.97 and len(t) > len(p["title"]) * 0.55:
        corrections.setdefault(p["id"], {})["title_pdf"] = t
        p["title"] = t; n_title += 1
        if a and len(a) > len(p.get("authors") or []):
            p["authors"] = a; p["first_author"] = a[0]
            corrections[p["id"]]["authors_pdf"] = a

# ---- pass 2: OpenAlex ----
for i, p in enumerate(papers):
    key = p["id"] + "::" + nrm(p["title"])[:70]
    if key in cache: oa = cache[key]
    else:
        oa = summarise(openalex(p["title"], p.get("doi",""), p.get("arxiv","")))
        cache[key] = oa
        time.sleep(0.11)
    if not oa: continue
    if sim(p["title"], oa["title"]) < 0.86: continue
    n_oa += 1
    c = corrections.setdefault(p["id"], {})
    # canonical title (keeps your capitalisation if close enough)
    if sim(p["title"], oa["title"]) < 0.995 and len(oa["title"]) > 12:
        if not p.get("curated") or len(oa["title"]) > len(p["title"]):
            c["title_oa"] = oa["title"]; p["title"] = oa["title"]
    if oa["doi"] and not p.get("doi"): p["doi"] = oa["doi"]; c["doi"] = oa["doi"]
    if oa["authors"] and (not p.get("authors") or len(oa["authors"]) > len(p["authors"]) or not p.get("curated")):
        if not p.get("curated") or not p.get("authors"):
            p["authors"] = oa["authors"]; p["first_author"] = oa["authors"][0] if oa["authors"] else ""
            c["authors"] = oa["authors"]
    if oa["corresponding"] and not p.get("corresponding"):
        p["corresponding"] = oa["corresponding"]; c["corresponding"] = oa["corresponding"]
    if oa["institutions"] and not p.get("institutions"):
        p["institutions"] = oa["institutions"][:8]; c["institutions"] = p["institutions"]
    # venue: adopt when ours is missing or just "arXiv"
    short, kind = shorten_venue(oa["venue_raw"])
    if short and oa["published"] and (not p.get("venue") or p["venue"] in ("arXiv","","—")):
        p["venue"] = short; p["venue_type"] = kind; c["venue"] = short
    if oa["date"] and (not p.get("date") or p.get("date")[:4] != str(oa["year"] or "")):
        if oa["published"] or not p.get("date"):
            p["date"] = oa["date"]; p["year"] = oa["year"]; c["date"] = oa["date"]
    p["cited"] = oa.get("cited", 0)
    # PRIMARY LINK: published version beats arXiv
    if oa["published"] and (oa["doi"] or oa["pub_url"]):
        p["url"] = ("https://doi.org/" + oa["doi"]) if oa["doi"] else oa["pub_url"]
        p["published_venue"] = oa["venue_raw"]; n_pub += 1
        c["url"] = p["url"]
    elif p.get("arxiv") and not p.get("url"):
        p["url"] = f"https://arxiv.org/abs/{p['arxiv']}"
    if p.get("arxiv"): p["arxiv_url"] = f"https://arxiv.org/abs/{p['arxiv']}"
    if (i+1) % 60 == 0:
        json.dump(cache, open(CACHE,"w")); print(f"  oa {i+1}/{len(papers)}", flush=True)

# ---- pass 3: dedupe ----
seen, keep = {}, []
for p in sorted(papers, key=lambda x: (0 if x.get("curated") else 1, -(x.get("stars") or 1))):
    k = p.get("doi") or p.get("arxiv") or nrm(p["title"])[:80]
    if k in seen:
        o = seen[k]
        if p.get("local") and not o.get("local"): o["local"] = p["local"]
        for f in ("fig","figs","abstract","note"):
            if p.get(f) and not o.get(f): o[f] = p[f]
        o["projects"] = sorted(set((o.get("projects") or []) + (p.get("projects") or [])))
        o["ideas"]    = sorted(set((o.get("ideas") or []) + (p.get("ideas") or [])))
        continue
    seen[k] = p; keep.append(p)
n_dup = len(papers) - len(keep)

# ---- re-attach figures that exist on disk ----
figdir = os.path.join(ROOT, "figures")
have = set(os.listdir(figdir)) if os.path.isdir(figdir) else set()
for p in keep:
    if f"{p['id']}.webp" in have: p["fig"] = f"figures/{p['id']}.webp"
    extra = [f"figures/{p['id']}-{i}.webp" for i in (1,2,3) if f"{p['id']}-{i}.webp" in have]
    if extra: p["figs"] = extra

keep.sort(key=lambda p: (-(p.get("stars") or 1), -(p.get("year") or 0), p["title"]))
data["papers"] = keep
data["meta"]["counts"]["total"] = len(keep)
data["meta"]["counts"]["deduped"] = n_dup
data["meta"]["counts"]["verified"] = n_oa
data["meta"]["counts"]["published_link"] = n_pub
json.dump(cache, open(CACHE,"w"))
json.dump(corrections, open(CORR,"w"), indent=1, ensure_ascii=False)
json.dump(data, open(DB,"w"), indent=1, ensure_ascii=False)
print(f"\ntitles fixed from PDF : {n_title}")
print(f"verified in OpenAlex  : {n_oa}/{len(papers)}")
print(f"now link to published : {n_pub}")
print(f"duplicates merged     : {n_dup}")
print(f"papers remaining      : {len(keep)}")
print(f"with figure           : {sum(1 for p in keep if p.get('fig'))}")

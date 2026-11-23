#!/usr/bin/env python3
"""Snapshot of citation counts for the publications page.

Resolves every publication in assets/data/catalog.json to an OpenAlex work (by title)
and writes assets/data/citations.json. The page shows this snapshot at once and then
refreshes all counts live with one request to the same API (OpenAlex allows browser
requests without a key; Semantic Scholar refuses them, which is why it is not used).

    python3 scripts/build_citations.py

A paper that cannot be matched keeps its previous entry if it had one. To pin a paper
by hand, give it an "openalex": "W..." field in catalog.json; "no_cite": true skips it.
"""
import datetime, json, pathlib, re, time, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
API = "https://api.openalex.org/works"
OUT = ROOT / "assets/data/citations.json"

def get(url, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "citation-snapshot"}), timeout=30) as r:
                return json.load(r)
        except Exception:
            time.sleep(2 + 3 * k)
    return None

def norm(t): return re.sub(r"[^a-z0-9]+", "", t.lower())

cat = json.loads((ROOT / "assets/data/catalog.json").read_text())
old = json.loads(OUT.read_text()).get("papers", {}) if OUT.exists() else {}
papers = {}
for p in cat["publications"]:
    if p.get("no_cite"): continue
    title = re.sub(r"^Master's Thesis:\s*", "", p["title"])
    rec = None
    if p.get("openalex"):
        rec = get(f'{API}/{p["openalex"]}?select=id,title,cited_by_count')
    else:
        q = re.sub(r"[^\w\s]", " ", title)
        hits = (get(f"{API}?search={urllib.parse.quote(q)}&select=id,title,cited_by_count&per-page=8") or {}).get("results", [])
        same = [h for h in hits if h.get("title") and norm(h["title"])[:45] == norm(title)[:45]]
        if same: rec = max(same, key=lambda h: h["cited_by_count"])      # preprint and published copies: the one that carries the citations
    if rec:
        papers[p["id"]] = {"oa": rec["id"].rsplit("/", 1)[-1], "count": rec["cited_by_count"]}
        print(f'  {p["id"]:20s} {rec["cited_by_count"]:4d}  {rec["title"][:60]}')
    elif p["id"] in old and "oa" in old[p["id"]]:
        papers[p["id"]] = old[p["id"]]; print(f'  {p["id"]:20s} kept the previous value ({old[p["id"]]["count"]})')
    else:
        print(f'  {p["id"]:20s}    -  not found')
    time.sleep(0.5)
OUT.write_text(json.dumps({"updated": datetime.date.today().isoformat(), "source": "OpenAlex", "papers": papers}, indent=1) + "\n")
print("wrote", OUT.relative_to(ROOT), "-", len(papers), "papers,", sum(v["count"] for v in papers.values()), "citations")

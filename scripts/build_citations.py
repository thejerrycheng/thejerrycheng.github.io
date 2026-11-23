#!/usr/bin/env python3
"""Citation counts for the publications page, read from the public Google Scholar profile.

Google Scholar has no API and refuses requests made by a web page, so the numbers
cannot be fetched by the visitor's browser. This script reads the profile page, writes
assets/data/citations.json (profile total, h-index, and the count of every catalog
paper it can match by title), and the page shows that file. Run it by hand, or let
.github/workflows/citations.yml run it every day.

    python3 scripts/build_citations.py

If Scholar answers with a captcha or an unexpected page, the old file is left alone.
A paper with "no_cite": true in catalog.json is skipped.
"""
import datetime, html, json, pathlib, re, sys, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
USER = "iQuHS3MAAAAJ"
PROFILE = f"https://scholar.google.com/citations?user={USER}&hl=en"
OUT = ROOT / "assets/data/citations.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

def fetch(url, tries=3):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"}), timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            print("  retry:", e); time.sleep(5 + 10 * k)
    return ""

def norm(t): return re.sub(r"[^a-z0-9]+", "", t.lower())

page = fetch(PROFILE + "&cstart=0&pagesize=100")
stats = [int(x) for x in re.findall(r'class="gsc_rsb_std">(\d+)<', page)]          # citations, since-5y, h, h-5y, i10, i10-5y
rows = []
for tr in re.findall(r'<tr class="gsc_a_tr">(.*?)</tr>', page, re.S):
    t = re.search(r'class="gsc_a_at">(.*?)</a>', tr, re.S)
    c = re.search(r'<a href="([^"]*)" class="gsc_a_ac[^"]*">(\d*)</a>', tr)
    if t: rows.append((html.unescape(re.sub(r"<[^>]+>", "", t.group(1))), int(c.group(2) or 0) if c else 0, html.unescape(c.group(1)) if c else ""))
if len(stats) < 3 or len(rows) < 5:
    print("Google Scholar did not return the profile (blocked or changed); keeping", OUT.relative_to(ROOT)); sys.exit(0)

cat = json.loads((ROOT / "assets/data/catalog.json").read_text())
papers = {}
for p in cat["publications"]:
    if p.get("no_cite"): continue
    key = norm(re.sub(r"^Master's Thesis:\s*", "", p["title"]))[:40]
    same = [r for r in rows if norm(r[0])[:40] == key]
    if not same: print(f'  {p["id"]:20s}    -  not on the profile'); continue
    title, n, url = max(same, key=lambda r: r[1])
    papers[p["id"]] = {"count": n, **({"url": url} if url else {})}
    print(f'  {p["id"]:20s} {n:4d}  {title[:60]}')

new = {"source": "Google Scholar", "profile": PROFILE, "total": stats[0], "h": stats[2], "papers": papers}
old = json.loads(OUT.read_text()) if OUT.exists() else {}
if {k: v for k, v in old.items() if k != "updated"} == new:
    print("no change:", stats[0], "citations"); sys.exit(0)
OUT.write_text(json.dumps({"updated": datetime.date.today().isoformat(), **new}, indent=1) + "\n")
print("wrote", OUT.relative_to(ROOT), "-", stats[0], "citations, h-index", stats[2], "-", len(papers), "papers matched")

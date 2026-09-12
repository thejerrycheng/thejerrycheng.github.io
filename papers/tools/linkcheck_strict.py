# -*- coding: utf-8 -*-
"""Strict link check: follow redirects, reject error codes, and read the body to
catch soft-404s (GitHub Pages / Google Sites / SPA catch-alls that return 200 on a
page that says 'not found'). Also does a weak relevance check against the dataset
name so a redirect to a homepage is flagged."""
import json, os, re, sys, html, unicodedata
import urllib.request, urllib.error, concurrent.futures as cf
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
DB=os.path.join(ROOT,"datasets_data.json")
UA={"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                 "(KHTML, like Gecko) Chrome/131.0 Safari/537.36",
    "Accept":"text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language":"en-US,en;q=0.9"}
SOFT404 = re.compile(r"(404|page not found|site not found|not be found|doesn'?t exist|"
                     r"no longer available|there isn'?t a github pages site here|"
                     r"we can'?t find the page|page you(?:'| a)re looking for)", re.I)
def norm(s): 
    s=unicodedata.normalize("NFKD",s or "").lower()
    return re.sub(r"[^a-z0-9]+"," ",s).strip()

def probe(item):
    url=item["site"]
    if not url: return dict(id=item["id"], url="", status="NO URL", verdict="none")
    try:
        req=urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=35) as r:
            code=r.status; final=r.geturl()
            ctype=r.headers.get("Content-Type","")
            body=b""
            if "html" in ctype or "text" in ctype:
                body=r.read(200000)
    except urllib.error.HTTPError as e:
        return dict(id=item["id"], url=url, status=f"HTTP {e.code}", final="",
                    verdict="BROKEN" if e.code not in (403,429) else "BLOCKED")
    except Exception as e:
        return dict(id=item["id"], url=url, status=type(e).__name__, final="", verdict="BROKEN")
    text=body.decode("utf-8","ignore")
    title=""
    m=re.search(r"<title[^>]*>(.*?)</title>", text, re.S|re.I)
    if m: title=html.unescape(re.sub(r"\s+"," ",m.group(1))).strip()[:110]
    head=re.sub(r"<script.*?</script>|<style.*?</style>","",text[:60000],flags=re.S|re.I)
    head=re.sub(r"<[^>]+>"," ",head)
    soft = bool(SOFT404.search(title)) or bool(SOFT404.search(head[:2500]))
    # weak relevance: does the page mention the dataset name?
    nm=norm(item["name"]).split()
    key=max(nm, key=len) if nm else ""
    rel = (len(key)>=4 and key in norm(title+" "+head[:8000]))
    verdict = "SOFT-404" if soft else ("OK" if rel or code==200 else "CHECK")
    if soft: verdict="SOFT-404"
    elif not rel: verdict="CHECK-RELEVANCE"
    else: verdict="OK"
    return dict(id=item["id"], name=item["name"], url=url, final=final, status=f"HTTP {code}",
                title=title, verdict=verdict)

data=json.load(open(DB)); rows=data["datasets"]
print(f"probing {len([r for r in rows if r.get('site')])} dataset links…\n")
res=[]
with cf.ThreadPoolExecutor(max_workers=8) as ex:
    for r in ex.map(probe, rows): res.append(r)
from collections import Counter
print("verdicts:", dict(Counter(r["verdict"] for r in res)), "\n")
for v in ("BROKEN","SOFT-404","BLOCKED","CHECK-RELEVANCE"):
    hits=[r for r in res if r["verdict"]==v]
    if not hits: continue
    print(f"--- {v} ({len(hits)}) ---")
    for r in hits:
        print(f"  [{r['id']}] {r.get('name','')[:28]:28} {r['status']:10} {r['url'][:68]}")
        if r.get("title"): print(f"        title: {r['title'][:90]}")
        if r.get("final") and r["final"]!=r["url"]: print(f"        ->     {r['final'][:90]}")
    print()
json.dump(res, open(os.path.join(HERE,"linkcheck_strict.json"),"w"), indent=1, ensure_ascii=False)

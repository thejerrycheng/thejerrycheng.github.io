# -*- coding: utf-8 -*-
"""Verify every link on the newly added world-model rows actually resolves to that
paper — arXiv abs pages are reliable but the ids are the thing worth re-checking,
and a wrong id returns a perfectly valid page for the wrong paper."""
import json, os, re, sys, html, difflib, unicodedata, urllib.request, concurrent.futures as cf
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
import curated_wm
ROOT=os.path.dirname(HERE)
db=json.load(open(os.path.join(ROOT,"papers_data.json")))
byid={p["id"]:p for p in db["papers"]}
UA={"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                 "(KHTML, like Gecko) Chrome/131.0 Safari/537.36"}
def nrm(s):
    s=unicodedata.normalize("NFKD",s or "").lower()
    s=re.sub(r"\$[^$]*\$"," ",s)
    return re.sub(r"[^a-z0-9]+"," ",s).strip()
def check(r):
    p=byid.get(r["id"])
    if not p: return (r["id"],"MISSING FROM DB","","")
    url=p.get("url","")
    if not url: return (r["id"],"NO URL","","")
    try:
        resp=urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=45)
        body=resp.read(220000).decode("utf-8","replace")
        code=resp.status
    except Exception as e:
        return (r["id"],f"FETCH FAIL {e}",url,"")
    m=re.search(r'<meta\s+name="citation_title"\s+content="([^"]+)"',body) or \
      re.search(r"<title>(.*?)</title>",body,re.S)
    page=html.unescape(re.sub(r"\s+"," ",m.group(1))) if m else ""
    page=re.sub(r"^\[\d+\.\d+\]\s*","",page.replace("arXiv:","")).strip()
    sim=difflib.SequenceMatcher(None,nrm(page),nrm(p["title"])).ratio()
    ok = "OK" if (code==200 and sim>=0.80) else f"MISMATCH sim={sim:.2f}"
    return (r["id"],ok,url,page[:70])
rows=curated_wm.ROWS
print(f"checking {len(rows)} links")
bad=[]
with cf.ThreadPoolExecutor(max_workers=6) as ex:
    for pid,st,url,page in ex.map(check,rows):
        if st!="OK": bad.append((pid,st,url,page)); print(f"  {st:<22} {pid}  {url}\n      page said: {page}")
print(f"\nOK: {len(rows)-len(bad)}/{len(rows)}   problems: {len(bad)}")

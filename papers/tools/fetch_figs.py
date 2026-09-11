# -*- coding: utf-8 -*-
"""For papers with no local PDF, fetch the arXiv PDF into the scratchpad, pull the
teaser figure out of it, and discard the PDF. Nothing is added to the repo but the
figure itself."""
import json, os, sys, time, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
ROOT=os.path.dirname(HERE)
TMP="/private/tmp/claude-501/-Users-jerrycheng-Desktop/bfd64d9a-4eab-4216-ade8-f0b0cd1137d7/scratchpad/arxpdf"
os.makedirs(TMP, exist_ok=True)
from figures import extract
DB=os.path.join(ROOT,"papers_data.json")
data=json.load(open(DB)); papers=data["papers"]
todo=[p for p in papers if not p.get("fig") and p.get("arxiv")]
print(f"fetching {len(todo)} PDFs from arXiv")
ok=fail=0
for i,p in enumerate(todo):
    pdf=os.path.join(TMP, p["arxiv"]+".pdf")
    if not os.path.exists(pdf):
        try:
            req=urllib.request.Request(f"https://arxiv.org/pdf/{p['arxiv']}",
                headers={"User-Agent":"paper-atlas/1.0 (mailto:jerrychengh990427@gmail.com)"})
            raw=urllib.request.urlopen(req,timeout=90).read()
            if len(raw)<40000 or not raw[:5].startswith(b"%PDF"): raise ValueError("not a pdf")
            open(pdf,"wb").write(raw)
        except Exception as e:
            fail+=1; time.sleep(3.2); continue
        time.sleep(3.2)
    want = 3 if (p.get("stars") or 1)>=2 else 1
    try: hero,figs = extract(pdf, p["id"], want)
    except Exception: hero,figs = None,[]
    if hero:
        p["fig"]=hero
        if figs: p["figs"]=figs
        ok+=1
    else: fail+=1
    try: os.remove(pdf)
    except OSError: pass
    if (i+1)%25==0:
        json.dump(data,open(DB,"w"),indent=1,ensure_ascii=False)
        print(f"  {i+1}/{len(todo)} ok={ok} fail={fail}", flush=True)
json.dump(data,open(DB,"w"),indent=1,ensure_ascii=False)
print(f"\nfigures added: {ok}   failed: {fail}")
print(f"total with a figure: {sum(1 for p in papers if p.get('fig'))}/{len(papers)}")

# -*- coding: utf-8 -*-
"""Teaser figure for each dataset, pulled from its own paper PDF on arXiv."""
import json, os, sys, time, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
ROOT=os.path.dirname(HERE)
TMP="/private/tmp/claude-501/-Users-jerrycheng-Desktop/bfd64d9a-4eab-4216-ade8-f0b0cd1137d7/scratchpad/dspdf"
os.makedirs(TMP,exist_ok=True)
from figures import extract
DB=os.path.join(ROOT,"datasets_data.json")
data=json.load(open(DB)); rows=data["datasets"]
todo=[r for r in rows if not r.get("fig") and r.get("arxiv")]
print(f"fetching {len(todo)} dataset PDFs")
ok=fail=0
for i,r in enumerate(todo):
    pdf=os.path.join(TMP, r["arxiv"]+".pdf")
    if not os.path.exists(pdf):
        try:
            raw=urllib.request.urlopen(urllib.request.Request(
                f"https://arxiv.org/pdf/{r['arxiv']}",
                headers={"User-Agent":"paper-atlas/1.0 (mailto:jerrychengh990427@gmail.com)"}),
                timeout=90).read()
            if len(raw)<40000 or not raw[:5].startswith(b"%PDF"): raise ValueError("not a pdf")
            open(pdf,"wb").write(raw)
        except Exception:
            fail+=1; time.sleep(3.2); continue
        time.sleep(3.2)
    try: hero,figs = extract(pdf, "ds-"+r["id"], 2)
    except Exception: hero,figs=None,[]
    if hero:
        r["fig"]=hero
        if figs: r["figs"]=figs
        ok+=1
    else: fail+=1
    try: os.remove(pdf)
    except OSError: pass
    if (i+1)%20==0:
        json.dump(data,open(DB,"w"),indent=1,ensure_ascii=False)
        print(f"  {i+1}/{len(todo)} ok={ok} fail={fail}",flush=True)
json.dump(data,open(DB,"w"),indent=1,ensure_ascii=False)
print(f"\nfigures: {ok} added, {fail} failed")
print(f"datasets with a figure: {sum(1 for r in rows if r.get('fig'))}/{len(rows)}")

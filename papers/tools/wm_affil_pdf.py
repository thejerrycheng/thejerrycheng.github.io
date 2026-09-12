# -*- coding: utf-8 -*-
"""Affiliations from page 1 of the paper itself — no API carries them for recent
preprints.

The whole difficulty is false positives. Matching anywhere on page 1 puts "Apple"
on VoxPoser (the fruit, in a manipulation task), "OpenAI" on IRIS (OpenAI Gym),
"NVIDIA" on STORM (the GPU they trained on) and "Unitree" on HAIC (the robot they
used). So match ONLY the front matter — everything above the abstract — which is
where affiliations actually live and where product names essentially never appear.
"""
import json, os, re, time, urllib.request
import pymupdf
HERE=os.path.dirname(os.path.abspath(__file__))
P=os.path.join(HERE,"wm_papers.json"); SRC=json.load(open(P))
TMP="/private/tmp/claude-501/-Users-jerrycheng-Desktop/bfd64d9a-4eab-4216-ade8-f0b0cd1137d7/scratchpad/affpdf"
os.makedirs(TMP,exist_ok=True)
CANON=[(r"\bnvidia\b","NVIDIA"),(r"stanford","Stanford University"),
 (r"columbia univ","Columbia University"),
 (r"urbana[- ]champaign|\buiuc\b","University of Illinois Urbana-Champaign"),
 (r"massachusetts institute of technology|\bmit\b","MIT"),
 (r"carnegie mellon|\bcmu\b","Carnegie Mellon University"),
 (r"\buc berkeley\b|university of california,? berkeley","UC Berkeley"),
 (r"university of california,? san diego|\bucsd\b|\buc san diego\b","UC San Diego"),
 (r"university of california,? irvine","UC Irvine"),
 (r"university of california,? los angeles|\bucla\b","UCLA"),
 (r"new york university|\bnyu\b","New York University"),
 (r"university of toronto","University of Toronto"),
 (r"google deepmind","Google DeepMind"),(r"\bdeepmind\b","Google DeepMind"),
 (r"google research|google brain|\bgoogle\b","Google"),
 (r"meta[- ]?ai\b|\bfair\b|meta platforms","Meta AI"),
 (r"university of geneva","University of Geneva"),
 (r"university of edinburgh","University of Edinburgh"),
 (r"tsinghua","Tsinghua University"),(r"peking university","Peking University"),
 (r"shanghai jiao ?tong","Shanghai Jiao Tong University"),
 (r"shanghai ai lab|shanghai artificial intelligence lab","Shanghai AI Laboratory"),
 (r"hkust\s*\(guangzhou\)","HKUST (Guangzhou)"),
 (r"hong kong university of science|\bhkust\b","HKUST"),
 (r"chinese university of hong kong|\bcuhk\b","CUHK"),
 (r"\bthe university of hong kong\b|\bhku\b","University of Hong Kong"),
 (r"zhejiang university","Zhejiang University"),
 (r"\beth\s*z(u|ü)rich\b|\beth\b","ETH Zurich"),(r"university of oxford","University of Oxford"),
 (r"university of cambridge","University of Cambridge"),
 (r"toyota research institute","Toyota Research Institute"),
 (r"\bkaist\b","KAIST"),(r"seoul national university","Seoul National University"),
 (r"\bwayve\b","Wayve"),(r"\bmbzuai\b|mohamed bin zayed","MBZUAI"),
 (r"university of washington","University of Washington"),
 (r"university of michigan","University of Michigan"),
 (r"university of texas at austin","UT Austin"),
 (r"georgia institute of technology","Georgia Tech"),(r"\bcaltech\b","Caltech"),
 (r"princeton university","Princeton University"),(r"\bepfl\b","EPFL"),
 (r"\bagibot\b","AgiBot"),(r"bytedance","ByteDance"),(r"\bgalbot\b","Galbot"),
 (r"xiaomi","Xiaomi Robotics Lab"),
 (r"hasso plattner","Hasso Plattner Institute"),
 (r"university college london","University College London"),
 (r"johns hopkins","Johns Hopkins University"),(r"\bkth\b","KTH"),
 (r"national university of singapore|\bnus\b","NUS"),
 (r"nanyang technological|\bntu\b","NTU Singapore"),
 (r"university of pennsylvania|\bupenn\b","University of Pennsylvania"),
 (r"cornell university","Cornell University"),
 (r"university of maryland","University of Maryland"),
 (r"beijing institute of technology|\bbit\b","Beijing Institute of Technology"),
 (r"beihang","Beihang University"),
 (r"university of science and technology of china|\bustc\b","USTC"),
 (r"westlake university","Westlake University"),
 (r"\bhuawei\b","Huawei"),(r"\btencent\b","Tencent"),(r"\balibaba\b","Alibaba"),
 (r"microsoft research|\bmicrosoft\b","Microsoft Research"),
 (r"\bopenai\b","OpenAI"),(r"physical intelligence","Physical Intelligence"),
 (r"brown university","Brown University"),
]
ABS=re.compile(r"\n\s*(?:A\s?B\s?S\s?T\s?R\s?A\s?C\s?T|Abstract|ABSTRACT)\b")
FOOT=re.compile(r"(Correspondence to|Equal contribution|\*Equal|Preprint\. Under review|"
                r"Proceedings of the \d+|Copyright \d{4})", re.I)
def frontmatter(pdf):
    """Two places affiliations live on page 1:
       - the header block above the abstract (NeurIPS/CoRL/arXiv style), and
       - a footnote at the bottom of page 1 (ICML style: PlaNet, TD-MPC, DINO-WM
         all put "1Google Brain 2University of Toronto ..." down there).
       Take both, and nothing in between, so body text never contributes."""
    d=pymupdf.open(pdf); t=d[0].get_text(); d.close()
    head=ABS.split(t,maxsplit=1)[0]
    if len(head)>4000: head=t[:1200]
    tail=""
    m=FOOT.search(t, len(head))
    if m: tail=t[max(m.start()-900,len(head)):m.start()+900]
    # ICML-style footnote with no trigger phrase: numbered markers glued to names.
    rest=t[len(head):]
    tail += "\n" + "\n".join(re.findall(r"^\s*\d\s?[A-Z][A-Za-z .,&\'-]{6,60}$", rest, re.M))
    # A superscript affiliation marker glues to the name ("1NVIDIA", "2HKUST"), and
    # \b does not fire between a digit and a letter — so split them apart first.
    return re.sub(r"(?<=[0-9])(?=[A-Z])", " ", head+"\n"+tail)

todo=list(SRC)
print(f"{len(todo)} papers")
ok=miss=0
for aid in todo:
    pdf=os.path.join(TMP,aid+".pdf")
    if not os.path.exists(pdf):
        try:
            raw=urllib.request.urlopen(urllib.request.Request(
              f"https://arxiv.org/pdf/{aid}",
              headers={"User-Agent":"paper-atlas/1.0 (mailto:jerrychengh990427@gmail.com)"}),timeout=90).read()
            if len(raw)<30000 or not raw[:5].startswith(b"%PDF"): raise ValueError("not a pdf")
            open(pdf,"wb").write(raw)
        except Exception as e:
            print(f"  dl-fail {aid} {e}"); miss+=1; time.sleep(3.2); continue
        time.sleep(3.2)
    try: head=frontmatter(pdf)
    except Exception as e:
        print(f"  pdf-fail {aid} {e}"); miss+=1; continue
    t=re.sub(r"\s+"," ",head)
    found=[]
    for pat,name in CANON:
        if re.search(pat,t,re.I) and name not in found: found.append(name)
    if found:
        SRC[aid]["institutions"]=found[:6]; ok+=1
        print(f"  {aid}  {', '.join(found[:5])}")
    elif not SRC[aid].get("institutions"):
        miss+=1; print(f"  --      {aid}")
    else:
        print(f"  (kept)  {aid}  {', '.join(SRC[aid]['institutions'][:4])}")
json.dump(SRC,open(P,"w"),indent=1,ensure_ascii=False)
print(f"\nfrom front matter: {ok}   no match: {miss}")

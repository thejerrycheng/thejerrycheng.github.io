# -*- coding: utf-8 -*-
"""Build wm_venues.json from the Semantic Scholar batch response.
Only venue strings that map to a recognised proceedings/journal are accepted —
S2 attaches bare "Robotics"/"SmartBot" strings to preprint records, which are
not venues. Two entries are hand-verified against a primary source."""
import json, os, re
HERE=os.path.dirname(os.path.abspath(__file__))
raw=json.load(open(os.path.join(HERE,"wm_s2_raw.json")))
SHORT=[(r"Conference on Robot Learning","CoRL","conference"),
 (r"Robotics: Science and Systems","RSS","conference"),
 (r"International Conference on Robotics and Automation","ICRA","conference"),
 (r"Intelligent Robots and Systems","IROS","conference"),
 (r"Neural Information Processing","NeurIPS","conference"),
 (r"International Conference on Learning Representations","ICLR","conference"),
 (r"International Conference on Machine Learning","ICML","conference"),
 (r"Computer Vision and Pattern Recognition","CVPR","conference"),
 (r"International Conference on Computer Vision","ICCV","conference"),
 (r"European Conference on Computer Vision","ECCV","conference"),
 (r"Transactions on Robotics","IEEE T-RO","journal"),
 (r"Robotics and Automation Letters","IEEE RA-L","journal"),
 (r"Science Robotics","Science Robotics","journal"),
 (r"Machine Learning Research","TMLR","journal"),
 (r"AAAI","AAAI","conference"), (r"Humanoid Robots","IEEE Humanoids","conference")]
out={}
for rec in raw:
    if not rec: continue
    aid=(rec.get("externalIds") or {}).get("ArXiv")
    name=(rec.get("publicationVenue") or {}).get("name") or rec.get("venue") or ""
    if not aid or not name or "arxiv" in name.lower(): continue
    for p,s,t in SHORT:
        if re.search(p,name,re.I):
            out[aid]=dict(venue=s, venue_type=t, raw=f"{name} {rec.get('year','')}",
                          doi=(rec.get("externalIds") or {}).get("DOI",""), src="semanticscholar")
            break
# hand-verified against primary sources (too recent for S2 to have indexed):
#   DreamDojo — NVIDIA's own repo README: "... (ICML 2026)"  github.com/NVIDIA/DreamDojo
#   RIGVid    — arXiv comments field: "In ICLR 2026"          arxiv.org/abs/2507.00990
out["2602.06949"]=dict(venue="ICML", venue_type="conference",
    raw="International Conference on Machine Learning 2026", doi="", src="github.com/NVIDIA/DreamDojo")
out["2507.00990"]=dict(venue="ICLR", venue_type="conference",
    raw="International Conference on Learning Representations 2026", doi="", src="arXiv comments")
json.dump(out,open(os.path.join(HERE,"wm_venues.json"),"w"),indent=1,ensure_ascii=False)
print(f"{len(out)} published venues")
for a,v in sorted(out.items(), key=lambda x:(x[1]["venue"],x[0])): print(f"  {a}  {v['venue']:<14} {v['raw']}")

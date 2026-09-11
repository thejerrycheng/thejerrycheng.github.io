import json, os, time, urllib.request, urllib.parse, xml.etree.ElementTree as ET
IDS = """2606.08737 2606.26663 2607.02503 2606.11184 2603.19201 2606.13232
2606.12604 2606.08828 2608.06827 2512.16881 2509.22578 2502.18615
2511.00091 2605.25477 2510.06710 2512.05107 2511.19528 2604.13733
2606.08610 2602.23876 2501.04227 2510.20809
2603.26660 2604.17245 2608.28578 2308.02453
2606.06033 2606.15338 2605.05241 2510.25405 2601.02778 2509.23075
2510.10903""".split()
NS={"a":"http://www.w3.org/2005/Atom","arxiv":"http://arxiv.org/schemas/atom"}
out={}
for i in range(0,len(IDS),20):
    ch=IDS[i:i+20]
    url="https://export.arxiv.org/api/query?"+urllib.parse.urlencode({"id_list":",".join(ch),"max_results":20})
    raw=urllib.request.urlopen(url,timeout=60).read()
    for e in ET.fromstring(raw).findall("a:entry",NS):
        bid=e.findtext("a:id","",NS).rsplit("/",1)[-1].split("v")[0]
        out[bid]=dict(
          arxiv=bid,
          title=" ".join((e.findtext("a:title","",NS) or "").split()),
          authors=[" ".join((a.findtext("a:name","",NS) or "").split()) for a in e.findall("a:author",NS)],
          abstract=" ".join((e.findtext("a:summary","",NS) or "").split()),
          published=e.findtext("a:published","",NS)[:10],
          comment=" ".join((e.findtext("arxiv:comment","",NS) or "").split()),
          journal=" ".join((e.findtext("arxiv:journal_ref","",NS) or "").split()),
          doi=e.findtext("arxiv:doi","",NS) or "")
    time.sleep(3.2)
json.dump(out,open("new_papers.json","w"),indent=1,ensure_ascii=False)
print("fetched",len(out),"of",len(IDS))
for k,v in out.items():
    print(f"{k}  {v['published']}  {v['title'][:78]}")
    print(f"        {', '.join(v['authors'][:3])}{' et al.' if len(v['authors'])>3 else ''} | {v['comment'][:56]}")

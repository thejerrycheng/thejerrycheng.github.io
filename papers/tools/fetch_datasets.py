import json, os, time, urllib.request, urllib.parse, xml.etree.ElementTree as ET
IDS = """
2110.07058 2311.18259 2006.13256 2203.01577 2203.14712 2309.02561 2406.09905 2402.13349
2505.11709 2411.19167 2204.13662 2104.04631 2008.11200 2401.08399 2403.19417 2509.05513
2411.08380 2403.16182 2308.13561 2112.07642 2104.11181
1706.04261 1906.03327 2306.08731
2310.08864 2403.12945 2308.12952 2212.06817 1910.11215 2307.00595 2412.13877 2503.06669
2408.10899 2202.02005 2210.06407 2401.08553 2309.01918 2511.17441 2606.17846
2510.08022 2606.10244
2406.10454 1811.02790
2204.02389 2306.00956 2211.12498 2401.14391 2410.24090
1904.03278 2307.00818 2412.14172
1910.11792 2106.08827 2403.09285 2506.23152 2607.13056 2606.21011 2406.06498 2203.15041
2303.14880 2205.09747
1910.10897 2112.03227 2403.09227 2504.18904
2305.05706 2210.02697 2410.23004
""".split()
NS={"a":"http://www.w3.org/2005/Atom","arxiv":"http://arxiv.org/schemas/atom"}
out={}
for i in range(0,len(IDS),25):
    ch=IDS[i:i+25]
    raw=urllib.request.urlopen("https://export.arxiv.org/api/query?"+urllib.parse.urlencode(
      {"id_list":",".join(ch),"max_results":25}),timeout=90).read()
    for e in ET.fromstring(raw).findall("a:entry",NS):
        bid=e.findtext("a:id","",NS).rsplit("/",1)[-1].split("v")[0]
        out[bid]=dict(arxiv=bid,
          title=" ".join((e.findtext("a:title","",NS) or "").split()),
          authors=[" ".join((a.findtext("a:name","",NS) or "").split()) for a in e.findall("a:author",NS)],
          abstract=" ".join((e.findtext("a:summary","",NS) or "").split()),
          published=e.findtext("a:published","",NS)[:10],
          comment=" ".join((e.findtext("arxiv:comment","",NS) or "").split()),
          doi=e.findtext("arxiv:doi","",NS) or "")
    time.sleep(3.2); print(f"  {min(i+25,len(IDS))}/{len(IDS)}", flush=True)
json.dump(out,open("dataset_papers.json","w"),indent=1,ensure_ascii=False)
print(f"\nfetched {len(out)}/{len(IDS)}  missing: {sorted(set(IDS)-set(out))}\n")
for k in IDS:
    if k in out: print(f"{k}  {out[k]['published']}  {out[k]['title'][:86]}")

# -*- coding: utf-8 -*-
"""Pull the teaser figure / system diagram out of each paper PDF.

Strategy per page: take the union of every raster image and every vector drawing,
drop anything that overlaps a text block too heavily, cluster what is left by
vertical proximity, and render the biggest cluster as a clipped bitmap. That
catches both photo teasers and the vector system diagrams, which pure
image-extraction misses entirely."""
import os, sys, json, io, re, math
import pymupdf
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "figures")
DB   = os.path.join(ROOT, "papers_data.json")
HOME = os.path.expanduser("~")
os.makedirs(OUT, exist_ok=True)

HERO_W, HERO_Q = 760, 72
FIG_W,  FIG_Q  = 560, 66

def rect_area(r): return max(0.0,(r[2]-r[0]))*max(0.0,(r[3]-r[1]))
def union(a,b):   return (min(a[0],b[0]), min(a[1],b[1]), max(a[2],b[2]), max(a[3],b[3]))
def inter(a,b):
    r=(max(a[0],b[0]),max(a[1],b[1]),min(a[2],b[2]),min(a[3],b[3]))
    return rect_area(r) if r[2]>r[0] and r[3]>r[1] else 0.0

def page_figures(page):
    """-> list of (bbox, score) candidate figure regions, best first."""
    pr = page.rect; PA = rect_area(pr)
    if PA <= 0: return []
    blocks = []
    # raster images
    for im in page.get_images(full=True):
        try:
            for r in page.get_image_rects(im[0]): blocks.append(tuple(r))
        except Exception: pass
    # vector drawings (system diagrams live here)
    for d in page.get_drawings():
        r = tuple(d["rect"])
        a = rect_area(r)
        if a < PA*0.0008: continue           # specks, rules, underlines
        if a > PA*0.92:   continue           # page frames
        if (r[2]-r[0]) < 3 or (r[3]-r[1]) < 3: continue
        blocks.append(r)
    if not blocks: return []
    text = [tuple(b[:4]) for b in page.get_text("blocks") if len(b) > 6 and str(b[4]).strip()]
    # cluster blocks that overlap or nearly touch
    blocks.sort(key=lambda r: (r[1], r[0]))
    clusters = []
    for r in blocks:
        placed = False
        for c in clusters:
            g = c["b"]
            gap_y = max(0, max(g[1],r[1]) - min(g[3],r[3]))
            ox = min(g[2],r[2]) - max(g[0],r[0])
            if gap_y < pr.height*0.045 and ox > -pr.width*0.10:
                c["b"] = union(g, r); c["n"] += 1; placed = True; break
        if not placed: clusters.append({"b": r, "n": 1})
    # merge again (clusters can now touch)
    for _ in range(3):
        merged=[]
        for c in clusters:
            hit=None
            for m in merged:
                gy = max(0, max(m["b"][1],c["b"][1]) - min(m["b"][3],c["b"][3]))
                ox = min(m["b"][2],c["b"][2]) - max(m["b"][0],c["b"][0])
                if gy < pr.height*0.045 and ox > -pr.width*0.10: hit=m; break
            if hit: hit["b"]=union(hit["b"],c["b"]); hit["n"]+=c["n"]
            else: merged.append(dict(c))
        if len(merged)==len(clusters): break
        clusters=merged
    out=[]
    for c in clusters:
        b=c["b"]; a=rect_area(b)
        w,h = b[2]-b[0], b[3]-b[1]
        if a < PA*0.035: continue                      # too small to be a figure
        if w < pr.width*0.18 or h < pr.height*0.05: continue
        ar = w/max(h,1e-6)
        if ar > 14 or ar < 0.12: continue              # rules / sidebars
        covered = sum(inter(b,t) for t in text)
        if covered > a*0.55: continue                  # mostly a text block
        score = a/PA * (1.0 + 0.30*min(c["n"],10)/10) * (1.0 - 0.5*min(covered/a,1.0))
        out.append((b, score))
    out.sort(key=lambda x: -x[1])
    return out

def render(page, bbox, maxw, quality, path, pad=5):
    pr = page.rect
    b = pymupdf.Rect(max(pr.x0, bbox[0]-pad), max(pr.y0, bbox[1]-pad),
                     min(pr.x1, bbox[2]+pad), min(pr.y1, bbox[3]+pad))
    if b.width < 8 or b.height < 8: return None
    zoom = min(4.0, max(1.4, maxw/max(b.width,1)))
    try:
        pm = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=b, alpha=False)
    except Exception: return None
    img = Image.frombytes("RGB", (pm.width, pm.height), pm.samples)
    if img.width > maxw:
        img = img.resize((maxw, max(1,round(img.height*maxw/img.width))), Image.LANCZOS)
    # reject near-blank crops
    ex = img.convert("L").resize((48,48)).getextrema()
    if ex[1]-ex[0] < 18: return None
    img.save(path, "WEBP", quality=quality, method=4)
    return os.path.getsize(path)

def extract(pdf_path, pid, want_extra=0):
    hero, figs = None, []
    try: doc = pymupdf.open(pdf_path)
    except Exception: return None, []
    try:
        cands = []
        for pno in range(min(5, doc.page_count)):
            page = doc[pno]
            for b, sc in page_figures(page)[:3]:
                bonus = 1.55 if pno == 0 else (1.12 if pno == 1 else 1.0)
                cands.append((sc*bonus, pno, b))
        cands.sort(key=lambda x: -x[0])
        used = []
        for sc, pno, b in cands:
            if hero is not None and len(figs) >= want_extra: break
            # don't emit two crops of the same region
            if any(pn == pno and inter(b, ob) > rect_area(b)*0.5 for pn, ob in used): continue
            if hero is None:
                p = os.path.join(OUT, f"{pid}.webp")
                if render(doc[pno], b, HERO_W, HERO_Q, p):
                    hero = f"figures/{pid}.webp"; used.append((pno,b))
            else:
                i = len(figs)+1
                p = os.path.join(OUT, f"{pid}-{i}.webp")
                if render(doc[pno], b, FIG_W, FIG_Q, p):
                    figs.append(f"figures/{pid}-{i}.webp"); used.append((pno,b))
        if hero is None and doc.page_count:      # fallback: top of page 1
            page = doc[0]; pr = page.rect
            p = os.path.join(OUT, f"{pid}.webp")
            if render(page, (pr.x0, pr.y0, pr.x1, pr.y0+pr.height*0.46), HERO_W, HERO_Q, p, pad=0):
                hero = f"figures/{pid}.webp"
    finally:
        doc.close()
    return hero, figs

if __name__ == "__main__":
    only_missing = "--missing" in sys.argv
    data = json.load(open(DB)); papers = data["papers"]
    done = fail = 0
    for i, p in enumerate(papers):
        if only_missing and p.get("fig"): continue
        loc = p.get("local")
        if not loc: continue
        path = loc.replace("~", HOME)
        if not os.path.exists(path): continue
        want = 3 if (p.get("stars") or 1) >= 2 else (2 if p.get("curated") else 0)
        try:
            hero, figs = extract(path, p["id"], want)
        except Exception as e:
            hero, figs = None, []
        if hero: p["fig"] = hero; p["figs"] = figs; done += 1
        else: fail += 1
        if (i+1) % 50 == 0:
            print(f"  {i+1}/{len(papers)}  ok={done} none={fail}", flush=True)
    json.dump(data, open(DB, "w"), indent=1, ensure_ascii=False)
    tot = sum(os.path.getsize(os.path.join(OUT,f)) for f in os.listdir(OUT))
    print(f"\nheroes: {done}   no-figure: {fail}   images: {len(os.listdir(OUT))}   {tot/1e6:.1f} MB")

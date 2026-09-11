# -*- coding: utf-8 -*-
"""Recover the real title/authors from a PDF by typography, not by line position.
The title is essentially always the largest non-trivial text run on page 1 that
sits above the abstract and is not a journal masthead."""
import re, unicodedata
import pymupdf

MAST = re.compile(r"^(ieee|acm|proceedings|copyright|arxiv|www\.|https?:|vol\.?\s|no\.?\s|doi|issn|isbn|"
                  r"received|accepted|published|downloaded|digital object|this article|authorized licen|"
                  r"journal of|transactions on|hindawi|elsevier|springer|mdpi|science robotics|"
                  r"conference on|international conference|\d{4} ieee|licensed under|preprint|"
                  r"submitted to|under review|to appear|see discussions|animal locomotion|"
                  r"research article|review article|manipulation copyright)", re.I)
STOP = re.compile(r"^(abstract|a\s?b\s?s\s?t\s?r\s?a\s?c\s?t|keywords|index terms|introduction|1\.?\s+introduction)", re.I)

def _clean(s):
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s*[\*†‡§¶]+\s*$", "", s)
    return s

def title_from_pdf(path, max_pages=1):
    try: doc = pymupdf.open(path)
    except Exception: return None, []
    try:
        page = doc[0]
        d = page.get_text("dict")
        runs = []          # (size, bold, y, x, text)
        for blk in d.get("blocks", []):
            if blk.get("type") != 0: continue
            for ln in blk.get("lines", []):
                txt = _clean("".join(sp.get("text","") for sp in ln.get("spans", [])))
                if not txt: continue
                sizes = [sp.get("size",0) for sp in ln.get("spans", []) if sp.get("text","").strip()]
                if not sizes: continue
                sz = max(sizes)
                bold = any("bold" in (sp.get("font","").lower()) for sp in ln.get("spans", []))
                runs.append(dict(size=round(sz,1), bold=bold, y=ln["bbox"][1], x=ln["bbox"][0], t=txt))
        if not runs: return None, []
        # where does the body start?
        body_y = min([r["y"] for r in runs if STOP.match(r["t"])] or [1e9])
        head = [r for r in runs if r["y"] < body_y]
        if len(head) < 2: head = runs[:40]
        # candidate title lines: big, not masthead, in the top 55% of the page
        pageh = page.rect.height
        cand = [r for r in head
                if not MAST.match(r["t"]) and len(r["t"]) >= 6
                and r["y"] < pageh*0.62
                and not re.match(r"^[\d\s,;:.\-–—/()]+$", r["t"])]
        if not cand: return None, []
        top = max(c["size"] for c in cand)
        # keep lines within 6% of the largest size, in reading order
        lines = [c for c in cand if c["size"] >= top*0.94]
        lines.sort(key=lambda r: (round(r["y"],1), r["x"]))
        # only keep the first vertically-contiguous group
        keep, prev = [], None
        for r in lines:
            if prev is not None and (r["y"] - prev) > top*2.6: break
            keep.append(r); prev = r["y"]
        title = _clean(" ".join(r["t"] for r in keep))
        title = re.sub(r"\s*-\s+", "-", title)
        if len(title) < 6 or len(title) > 260: return None, []
        # authors: the next distinct smaller size band below the title
        ty = max(r["y"] for r in keep)
        below = sorted([r for r in head if r["y"] > ty + 1], key=lambda r: r["y"])
        authors = []
        for r in below[:6]:
            if STOP.match(r["t"]) or MAST.match(r["t"]): break
            if r["size"] >= top*0.94: continue
            if re.search(r"@|university|institute|laborator|department|college|\bcorp\b|\binc\b", r["t"], re.I):
                break
            if len(r["t"]) > 250: break
            authors.append(r["t"])
            if len(authors) >= 3: break
        raw = " ".join(authors)
        raw = re.sub(r"[\*†‡§¶0-9]+", "", raw)
        names = [ _clean(a) for a in re.split(r",| and |&|;", raw) ]
        names = [n for n in names if 3 <= len(n) <= 48 and " " in n and not re.search(r"\d", n)]
        return title, names[:14]
    finally:
        doc.close()

if __name__ == "__main__":
    import sys, json, os
    for p in sys.argv[1:]:
        t,a = title_from_pdf(p)
        print(os.path.basename(p)[:50], "->", t, "|", a[:4])

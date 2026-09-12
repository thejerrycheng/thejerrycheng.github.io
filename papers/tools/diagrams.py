# -*- coding: utf-8 -*-
"""Tiny declarative SVG flow-chart builder so every idea's pipeline is drawn the
same way. Boxes sit on a 4-column grid; arrows route orthogonally between edges."""
from html import escape

W, COLW, GAP = 980, 216, 28
COLX = [16, 16+COLW+GAP, 16+2*(COLW+GAP), 16+3*(COLW+GAP)]   # 16, 260, 504, 748
TOP, ROWGAP = 34, 58
LH, HEAD, PAD = 16, 30, 12

class B:
    """A box. kind: plain | hi (highlighted) | soft (secondary) | out (result)"""
    def __init__(self, id, col, row, label, lines=(), kind="plain", span=1):
        self.id, self.col, self.row = id, col, row
        self.label, self.lines, self.kind, self.span = label, list(lines), kind, span
    @property
    def h(self): return HEAD + len(self.lines)*LH + PAD
    @property
    def w(self): return COLW*self.span + GAP*(self.span-1)
    def x(self): return COLX[self.col]
    def cx(self): return self.x() + self.w/2

class A:
    """An arrow. route: auto | right | down | up | left | around
       side: for 'around', which way to detour (l/r)."""
    def __init__(self, a, b, label="", route="auto", style="fwd", side="l", drop=0):
        self.a, self.b, self.label, self.route, self.style, self.side, self.drop = a,b,label,route,style,side,drop

def render(boxes, arrows, aria="pipeline"):
    by = {b.id: b for b in boxes}
    rows = {}
    for b in boxes: rows.setdefault(b.row, []).append(b)
    y, ry = TOP, {}
    for r in sorted(rows):
        ry[r] = y
        y += max(b.h for b in rows[r]) + ROWGAP
    H = y + 10
    for b in boxes: b._y = ry[b.row]

    out = [f'<svg viewBox="0 0 {W} {int(H)}" role="img" aria-label="{escape(aria)}">',
      '<defs><marker id="a_%s" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" '
      'orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker></defs>' % id(boxes),
      '<style>'
      '.bx{fill:var(--panel);stroke:var(--line);stroke-width:2;rx:8}'
      '.sf{fill:var(--bone);stroke:var(--line-soft);stroke-width:1.5;rx:7}'
      '.hl{fill:var(--yellow);stroke:var(--line);stroke-width:2;rx:8}'
      '.ot{fill:var(--panel);stroke:var(--hi);stroke-width:2.5;rx:8}'
      '.lb{font:700 10px var(--font-mono);fill:var(--imp);letter-spacing:.06em}'
      '.lbd{font:700 10px var(--font-mono);fill:#8a4a10;letter-spacing:.06em}'
      '.lbo{font:700 10px var(--font-mono);fill:var(--hi);letter-spacing:.06em}'
      '.s{font:400 10.5px var(--font-mono);fill:var(--ash)}'
      '.sd{font:400 10.5px var(--font-mono);fill:#3a3320}'
      '.al{font:700 9.5px var(--font-mono);fill:var(--hi);letter-spacing:.04em}'
      '.ln{stroke:currentColor;stroke-width:2;fill:none;color:var(--line);marker-end:url(#a_%s)}'
      '.fb{stroke:var(--hi);stroke-width:2;fill:none;color:var(--hi);stroke-dasharray:6 4;marker-end:url(#a_%s)}'
      '</style>' % (id(boxes), id(boxes))]

    def em(b, side):
        x,yy,w,h = b.x(), b._y, b.w, b.h
        return {"r":(x+w, yy+h/2), "l":(x, yy+h/2), "t":(b.cx(), yy), "b":(b.cx(), yy+h)}[side]

    for b in boxes:
        cls = {"plain":"bx","hi":"hl","soft":"sf","out":"ot"}[b.kind]
        lcl = {"plain":"lb","hi":"lbd","soft":"lb","out":"lbo"}[b.kind]
        tcl = "sd" if b.kind=="hi" else "s"
        out.append(f'<rect class="{cls}" x="{b.x()}" y="{b._y}" width="{b.w}" height="{b.h}"/>')
        out.append(f'<text class="{lcl}" x="{b.x()+14}" y="{b._y+20}">{escape(b.label)}</text>')
        for i,t in enumerate(b.lines):
            out.append(f'<text class="{tcl}" x="{b.x()+14}" y="{b._y+HEAD+10+i*LH}">{escape(t)}</text>')

    for ar in arrows:
        a, b = by[ar.a], by[ar.b]
        cls = "ln" if ar.style=="fwd" else "fb"
        r = ar.route
        if r=="auto":
            if a.row==b.row: r = "right" if b.col>a.col else "left"
            elif a.col==b.col: r = "down" if b.row>a.row else "up"
            else: r = "elbow"
        if r=="right":
            (x1,y1),(x2,y2)=em(a,"r"),em(b,"l"); d=f"M{x1} {y1} L{x2-4} {y2}"
            lx,ly=(x1+x2)/2,y1-8
        elif r=="left":
            (x1,y1),(x2,y2)=em(a,"l"),em(b,"r"); d=f"M{x1} {y1} L{x2+4} {y2}"
            lx,ly=(x1+x2)/2,y1-8
        elif r=="down":
            (x1,y1),(x2,y2)=em(a,"b"),em(b,"t"); d=f"M{x1} {y1} L{x2} {y2-4}"
            lx,ly=x1+8,(y1+y2)/2
        elif r=="up":
            (x1,y1),(x2,y2)=em(a,"t"),em(b,"b"); d=f"M{x1} {y1} L{x2} {y2+4}"
            lx,ly=x1+8,(y1+y2)/2
        elif r=="elbow":
            (x1,y1)=em(a,"b"); (x2,y2)=em(b,"t"); mid=(y1+y2)/2
            d=f"M{x1} {y1} L{x1} {mid} L{x2} {mid} L{x2} {y2-4}"
            lx,ly=(x1+x2)/2, mid-7
        else:  # around: exit bottom, run along a lane, enter target top
            (x1,y1)=em(a,"b"); (x2,y2)=em(b,"t")
            lane = y1 + 26 + ar.drop
            edge = (W-8) if ar.side=="r" else 8
            d=f"M{x1} {y1} L{x1} {lane} L{edge} {lane} L{edge} {y2-30} L{x2} {y2-30} L{x2} {y2-4}"
            lx,ly=(x1+edge)/2, lane-7
        out.append(f'<path class="{cls}" d="{d}"/>')
        if ar.label:
            anchor = "middle" if r in ("right","left","elbow","around") else "start"
            out.append(f'<text class="al" x="{lx:.0f}" y="{ly:.0f}" text-anchor="{anchor}">{escape(ar.label)}</text>')
    out.append('</svg>')
    return "\n".join(out)

def dia(title, caption, boxes, arrows):
    return dict(title=title, caption=caption, svg=render(boxes, arrows, title))

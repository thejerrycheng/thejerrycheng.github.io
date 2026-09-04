#!/usr/bin/env python3
"""Generate the art-deco Manhattan skyline silhouette used by the hero + footer.

Writes assets/images/gotham-skyline.svg. Re-runnable; edit the tower list to
change the skyline. Everything is a flat ink silhouette so it can sit over the
searchlight beams; a handful of brass windows are lit.
"""
import random
random.seed(7)
W, H = 1600, 300
GROUND = H
ink = "#151820"; brass = "#D9A13F"
parts = []; windows = []

def box(x, y, w, h):
    parts.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{h:.0f}"/>')

def tower(x, w, h, steps=0, spire=0, crown=False, water=False):
    """Stepped-setback deco tower. h = total body height above ground."""
    top = GROUND - h
    box(x, top, w, h)
    cw, cy = w, top
    for i in range(steps):
        cw = cw * 0.72; cy -= h * 0.11
        box(x + (w - cw) / 2, cy, cw, GROUND - cy)
    if crown:  # Chrysler-style arched crown: nested arcs
        cx = x + w / 2; base = cy; r = cw / 2
        for k in range(4):
            rr = r * (1 - k * 0.22); yy = base - k * 14
            parts.append(f'<path d="M{cx-rr:.0f} {yy:.0f} A{rr:.0f} {rr:.0f} 0 0 1 {cx+rr:.0f} {yy:.0f} Z"/>')
        cy = base - 3 * 14 - r * (1 - 3 * 0.22)
    if spire:
        cx = x + w / 2
        parts.append(f'<path d="M{cx-4:.0f} {cy:.0f} L{cx:.0f} {cy-spire:.0f} L{cx+4:.0f} {cy:.0f} Z"/>')
        parts.append(f'<rect x="{cx-1.2:.0f}" y="{cy-spire-16:.0f}" width="2.4" height="18"/>')
    if water:  # rooftop water tower, the NYC vernacular
        cx = x + w * 0.72
        box(cx - 9, top - 26, 18, 26); box(cx - 12, top - 30, 24, 5)
        parts.append(f'<path d="M{cx-11:.0f} {top-30:.0f} L{cx:.0f} {top-40:.0f} L{cx+11:.0f} {top-30:.0f} Z"/>')
    # lit windows (sparse)
    cols = max(1, int(w // 14)); rows = max(1, int(h // 18))
    for c in range(cols):
        for r in range(rows):
            if random.random() < 0.06:
                windows.append(f'<rect x="{x+6+c*14:.0f}" y="{top+8+r*18:.0f}" width="4" height="6"/>')

# left → right; heights are relative to a 300px band
tower(0,   70, 90)
tower(60,  40, 120, water=True)
tower(110, 90, 150, steps=2)
tower(215, 50, 105)
tower(270, 110, 200, steps=3, spire=60)                 # Empire State
tower(395, 60, 130, water=True)
tower(460, 80, 165, steps=1)
tower(555, 45, 95)
tower(605, 120, 175, steps=2)
tower(740, 70, 140)
tower(815, 100, 215, steps=2, crown=True, spire=50)     # Chrysler
tower(930, 55, 120, water=True)
tower(990, 95, 160, steps=1)
tower(1095, 65, 110)
tower(1165, 130, 190, steps=2)
tower(1310, 50, 100, water=True)
tower(1365, 90, 145, steps=1)
tower(1465, 70, 125)
tower(1540, 60, 95)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Art-deco Manhattan skyline silhouette">
<g fill="{ink}">
{chr(10).join(parts)}
</g>
<g fill="{brass}" opacity="0.75">
{chr(10).join(windows)}
</g>
</svg>
'''
open("assets/images/gotham-skyline.svg", "w").write(svg)
print("wrote assets/images/gotham-skyline.svg", len(parts), "shapes,", len(windows), "windows")

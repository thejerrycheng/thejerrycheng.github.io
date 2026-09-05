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
tower(1165, 90, 150, steps=1)

def bridge(x0, x1, towers, deck_y=224, top=88, tw=50):
    """Brooklyn Bridge: stone gothic towers with pointed double arches, a deck,
    main cables sagging between the towers, vertical suspenders and the
    radiating diagonal stays that make the silhouette unmistakable."""
    box(x0, deck_y, x1 - x0, 9)                          # deck
    for tx in towers:                                    # towers (evenodd: arch holes)
        L, R = tx - tw / 2, tx + tw / 2
        outer = f"M{L:.0f} {GROUND} V{top+12} L{L+7:.0f} {top} H{R-7:.0f} L{R:.0f} {top+12} V{GROUND} Z"
        def arch(y0, y1, w=20):
            aL, aR, ym = tx - w / 2, tx + w / 2, y0 + (y1 - y0) * 0.34
            return f"M{aL:.0f} {y1:.0f} V{ym:.0f} L{tx:.0f} {y0:.0f} L{aR:.0f} {ym:.0f} V{y1:.0f} Z"
        parts.append(f'<path fill-rule="evenodd" d="{outer} {arch(top+22, top+70)} {arch(top+80, deck_y-4)}"/>')
    # main cable: anchor → tower → sag → tower → anchor (quadratic Béziers)
    a0, a1 = (x0 + 6, deck_y), (x1 - 4, deck_y)
    t0, t1 = (towers[0], top - 2), (towers[1], top - 2)
    mid = ((t0[0] + t1[0]) / 2, deck_y - 34)
    c0 = ((a0[0] + t0[0]) / 2, deck_y - 8); c1 = ((t1[0] + a1[0]) / 2, deck_y - 8)
    def q(P0, P1, P2, t):
        return ((1-t)**2*P0[0] + 2*(1-t)*t*P1[0] + t**2*P2[0], (1-t)**2*P0[1] + 2*(1-t)*t*P1[1] + t**2*P2[1])
    cable = (f"M{a0[0]:.0f} {a0[1]:.0f} Q{c0[0]:.0f} {c0[1]:.0f} {t0[0]:.0f} {t0[1]:.0f} "
             f"Q{mid[0]:.0f} {mid[1]:.0f} {t1[0]:.0f} {t1[1]:.0f} Q{c1[0]:.0f} {c1[1]:.0f} {a1[0]:.0f} {a1[1]:.0f}")
    lines = [f'<path d="{cable}" fill="none" stroke="{ink}" stroke-width="4"/>']
    for (P0, P1, P2) in ((a0, c0, t0), (t0, mid, t1), (t1, c1, a1)):     # suspenders
        n = int(abs(P2[0] - P0[0]) // 18)
        for k in range(1, n):
            x, y = q(P0, P1, P2, k / n)
            lines.append(f'<line x1="{x:.0f}" y1="{y:.0f}" x2="{x:.0f}" y2="{deck_y}" stroke="{ink}" stroke-width="1.3"/>')
    for tx in towers:                                                    # diagonal stays
        for d in (34, 60, 88, 118, 150):
            for sgn in (-1, 1):
                lines.append(f'<line x1="{tx:.0f}" y1="{top+4}" x2="{tx+sgn*d:.0f}" y2="{deck_y}" stroke="{ink}" stroke-width="1.4" opacity="0.85"/>')
    parts.extend(lines)
    for x in range(x0 + 20, x1, 46):                                     # deck lamps
        windows.append(f'<rect x="{x}" y="{deck_y-6}" width="3" height="3"/>')

bridge(1260, W, towers=(1370, 1560))

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
# daytime variant: same silhouette, no lit windows (used when data-theme="day")
open("assets/images/gotham-skyline-day.svg", "w").write(svg.replace(chr(10).join(windows), ""))
print("wrote assets/images/gotham-skyline-day.svg")

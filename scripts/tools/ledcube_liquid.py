#!/usr/bin/env python3
"""Characterise the shallow-water liquid that runs inside the browser LED cube.

The solver being measured is the one the page actually ships,
assets/js/ledcube.js -> class Liquid; this script drives it through node so the
numbers on the page come from the same code a visitor runs, not a re-implementation.

Produces, into assets/images/projects/ledcube/:
  ledcube_liquid.pdf / .png   surface profile vs tilt, volume, and lit-LED count

Run:  python3 scripts/tools/ledcube_liquid.py
"""
import json
import subprocess
import pathlib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/images/projects/ledcube"
TILTS = list(range(0, 61, 2))
SETTLE_STEPS = 3000          # 12.5 s at dt = 1/240
DT = 1.0 / 240.0
DAMP = 0.6

DRIVER = r"""
const fs = require('fs');
global.window = {};
eval(fs.readFileSync(process.argv[2], 'utf8'));
const L = window.LEDCUBE, N = L.N;
const out = [];
for (const deg of JSON.parse(process.argv[3])) {
  const a = deg * Math.PI / 180;
  const q = new L.Liquid(1 / 3);
  const gx = 9.8 * Math.sin(a), gz = 9.8 * Math.cos(a);
  const settle = [];
  for (let i = 0; i < %d; i++) {
    q.step(%r, gx, 0, gz, %r);
    if (i %% 24 === 0) { const [mn, mx] = q.depth(); settle.push(mx - mn); }
  }
  let vol = 0; for (let i = 0; i < q.h.length; i++) vol += q.h[i];
  const c = new L.Cube(); q.render(c);
  const lit = c.buf.reduce((s, v) => s + v, 0);
  // surface profile along x, averaged over y (the tilt is purely in x)
  const prof = [];
  for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += q.h[i * N + j]; prof.push(s / N); }
  const [mn, mx] = q.depth();
  out.push({ deg, vol, lit, prof, min: mn, max: mx, settle });
}
console.log(JSON.stringify(out));
""" % (SETTLE_STEPS, DT, DAMP)


def run():
    drv = ROOT / "scripts/tools/_liquid_driver.js"
    drv.write_text(DRIVER)
    try:
        raw = subprocess.run(
            ["node", str(drv), str(ROOT / "assets/js/ledcube.js"), json.dumps(TILTS)],
            capture_output=True, text=True, check=True).stdout
    finally:
        drv.unlink(missing_ok=True)
    return json.loads(raw)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    data = run()
    by = {d["deg"]: d for d in data}
    fig, ax = plt.subplots(1, 3, figsize=(13.0, 3.7))

    # (a) settled surface profile along the tilt axis
    for deg in (0, 10, 20, 30, 40, 50):
        p = by[deg]["prof"]
        ax[0].plot(np.arange(8) + 0.5, p, marker="o", ms=4, lw=1.6, label=f"{deg}°")
    ax[0].axhline(8 / 3, color="0.4", ls="--", lw=1, zorder=0)
    ax[0].annotate("h = 8/3 (one third full)", (0.15, 8 / 3 + 0.18), fontsize=8, color="0.35")
    ax[0].set_xlabel("column index along the tilt axis")
    ax[0].set_ylabel("settled depth  [cells]")
    ax[0].set_title("(a) the surface goes flat, then finds a corner", fontsize=10)
    ax[0].set_ylim(-0.3, 8.3)
    ax[0].legend(fontsize=7, ncol=2, title="tilt", title_fontsize=7)

    # (b) volume conservation and the depth envelope
    degs = np.array([d["deg"] for d in data])
    vol = np.array([d["vol"] for d in data])
    mn = np.array([d["min"] for d in data])
    mx = np.array([d["max"] for d in data])
    ax[1].fill_between(degs, mn, mx, alpha=0.25, label="depth range across the 64 columns")
    ax[1].plot(degs, mx, lw=1.6)
    ax[1].plot(degs, mn, lw=1.6)
    ax[1].axhline(8 / 3, color="0.4", ls="--", lw=1, zorder=0)
    ax[1].set_xlabel("tilt  [deg]")
    ax[1].set_ylabel("depth  [cells]")
    ax[1].set_title(f"(b) volume held at {vol.mean():.3f} ± {vol.std():.1e}", fontsize=10)
    ax[1].legend(fontsize=7)
    dry = degs[mn <= 1e-9]
    if len(dry):
        ax[1].axvline(dry[0], color="crimson", lw=1, ls=":")
        ax[1].annotate(f"floor goes dry\nat {dry[0]}°", (dry[0] + 1, 6.4), fontsize=7.5, color="crimson")

    # (c) what the binary display can actually show
    lit = np.array([d["lit"] for d in data])
    ax[2].plot(degs, lit, lw=1.8, color="#B8431F")
    ax[2].axhline(512 / 3, color="0.4", ls="--", lw=1, zorder=0)
    ax[2].annotate("512/3 = 170.7 (the true volume)", (1, 512 / 3 - 13), fontsize=8, color="0.35")
    ax[2].set_xlabel("tilt  [deg]")
    ax[2].set_ylabel("LEDs lit  [of 512]")
    ax[2].set_title("(c) quantisation: the display over-reads when flat", fontsize=10)
    ax[2].set_ylim(120, 220)

    for a in ax:
        a.grid(alpha=0.25, lw=0.6)
        for sp in ("top", "right"):
            a.spines[sp].set_visible(False)
    fig.tight_layout()
    for ext in ("pdf", "png"):
        fig.savefig(OUT / f"ledcube_liquid.{ext}", dpi=170, bbox_inches="tight")

    # validation: a settled free surface must lie normal to gravity, so the depth
    # gradient across the wet columns is exactly -tan(theta). Fit it and check.
    print(f"{'tilt':>5} {'slope':>8} {'tan(t)':>8} {'err':>8}")
    slope_err = []
    for d in data:
        if d["deg"] == 0:
            continue
        prof = np.array(d["prof"])
        wet = prof > 0.05                       # a dry column is not on the surface
        if wet.sum() < 3:
            continue
        x = np.arange(8)[wet]
        k = np.polyfit(x, prof[wet], 1)[0]
        ref = np.tan(np.radians(d["deg"]))
        slope_err.append(abs(k - ref))
        if d["deg"] % 10 == 0:
            print(f"{d['deg']:>4}° {k:>8.4f} {ref:>8.4f} {k - ref:>+8.4f}")
    print(f"free-surface slope vs tan(tilt): max error {max(slope_err):.4f} cells/column "
          f"over {len(slope_err)} tilts\n")

    print(f"{'tilt':>5} {'volume':>10} {'min':>6} {'max':>6} {'lit':>5}")
    for d in data:
        if d["deg"] % 10 == 0:
            print(f"{d['deg']:>4}° {d['vol']:>10.3f} {d['min']:>6.2f} {d['max']:>6.2f} {d['lit']:>5}")
    print(f"\nvolume over all {len(data)} tilts: mean {vol.mean():.6f}, "
          f"spread {vol.max() - vol.min():.2e} cell-volumes")
    print(f"LEDs lit: {lit[0]} upright, {lit.min()}–{lit.max()} across 0–60°")
    print(f"wrote {OUT/'ledcube_liquid.pdf'}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Re-run the MIE444 maze localization scheme, exactly as the report specifies it.

The robot has four ultrasonics (one per side) and reads only its OWN tile's
adjacent walls, as a 4-bit code.  Bit 0 = wall in front, 1 = left, 2 = behind,
3 = right, in the robot's own frame -- so a reading is the world code of that
tile, cyclically rotated by the robot's unknown heading.  Localization is the
set-intersection this induces: start with every (tile, heading) consistent with
the first reading, move one tile, intersect again, repeat.

Maze transcribed from Figure 2.2-1 of the report (4 rows x 8 columns of 12 in
tiles; world bits 1 = north, 2 = west, 4 = south, 8 = east; 15 = blocked).

The claim under test is from page 9: trusting the IMU for heading took
localization "from up to 3 moves down to at most a single 1-tile movement".

Writes assets/images/projects/mie444/mie444_localization.pdf/.png and
assets/data/mie444_maze.json (the map the browser demo uses, so page and
harness cannot disagree).

Run:  python3 scripts/tools/mie444_localize.py
"""
import json
import pathlib
import random
from collections import Counter

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
# runs both inside the website repo and standalone in the analysis repo
if (ROOT / "assets/js").is_dir():
    FIGS = ROOT / "assets/images/projects/mie444"
    DATA = ROOT / "assets/data"
else:
    FIGS = ROOT / "figures"
    DATA = ROOT

# Figure 2.2-1, row 1 at the top.  15 = blocked.
MAZE = [
    [3,  1, 5,  9, 15, 11, 15, 11],
    [2, 12, 15, 6,  5,  0,  5,  8],
    [10, 15, 11, 15, 15, 10, 15, 10],
    [6,  5, 4,  5,  5, 12, 15, 14],
]
ROWS, COLS = len(MAZE), len(MAZE[0])
# world directions, counter-clockwise so that a heading change is a bit rotation
DIRS = [(-1, 0), (0, -1), (1, 0), (0, 1)]      # 0 N, 1 W, 2 S, 3 E
FREE = [(r, c) for r in range(ROWS) for c in range(COLS) if MAZE[r][c] != 15]


def observe(code, heading):
    """The 4-bit reading a robot with this heading takes on a tile with this code."""
    return sum(((code >> ((heading + b) & 3)) & 1) << b for b in range(4))


def step(rc, heading, body_dir):
    """Drive one tile in a body-relative direction. Returns None if blocked."""
    world = (heading + body_dir) & 3
    dr, dc = DIRS[world]
    r, c = rc[0] + dr, rc[1] + dc
    if not (0 <= r < ROWS and 0 <= c < COLS) or MAZE[r][c] == 15:
        return None
    return (r, c), world          # the robot turns to face the way it drove


def all_states(known_heading):
    if known_heading:
        return [(t, 0) for t in FREE]                 # heading pinned to north
    return [(t, h) for t in FREE for h in range(4)]


def consistent(z, belief):
    return [(t, h) for (t, h) in belief if observe(MAZE[t[0]][t[1]], h) == z]


def open_dirs(z):
    return [b for b in range(4) if not (z >> b) & 1]


def localize(start, policy, known_heading, rng, cap=12):
    """Returns the number of one-tile moves needed to pin down (tile, heading)."""
    t, h = start
    belief = consistent(observe(MAZE[t[0]][t[1]], h), all_states(known_heading))
    moves = 0
    prev = None
    while len(belief) > 1 and moves < cap:
        z = observe(MAZE[t[0]][t[1]], h)
        opts = [b for b in open_dirs(z) if step(t, h, b) is not None]
        if not opts:
            return None                                # boxed in; cannot happen here
        if policy == "random":
            b = rng.choice(opts)
        elif policy == "report":
            # the report's rule: prefer straight on, then anything but a reversal
            fwd = [d for d in opts if d == 0]
            noback = [d for d in opts if d != 2 and (prev is None or d != 2)]
            b = fwd[0] if fwd else (rng.choice(noback) if noback else rng.choice(opts))
        elif policy == "greedy":
            # pick the move that minimises the expected posterior belief size
            best, b = None, opts[0]
            for d in opts:
                nxt = Counter()
                for (bt, bh) in belief:
                    s = step(bt, bh, d)
                    if s is None:
                        continue
                    nt, nh = s
                    nxt[observe(MAZE[nt[0]][nt[1]], nh)] += 1
                tot = sum(nxt.values()) or 1
                exp = sum(n * n for n in nxt.values()) / tot   # E[|posterior|]
                if best is None or exp < best:
                    best, b = exp, d
        else:
            raise ValueError(policy)
        s = step(t, h, b)
        t, h = s
        nb = []
        for (bt, bh) in belief:
            sb = step(bt, bh, b)
            if sb is not None:
                nb.append(sb)
        belief = consistent(observe(MAZE[t[0]][t[1]], h), nb)
        prev, moves = b, moves + 1
    return moves if len(belief) == 1 else None


def sweep(policy, known_heading, trials=200, seed=0):
    rng = random.Random(seed)
    out = []
    for start in all_states(known_heading=False):          # always start unknown
        if known_heading:
            # the IMU pins heading, so the belief set only spans tiles
            t, h = start
            b0 = [(tt, h) for tt in FREE]
            z = observe(MAZE[t[0]][t[1]], h)
            if not [s for s in b0 if observe(MAZE[s[0][0]][s[0][1]], s[1]) == z]:
                continue
        for _ in range(trials if policy == "random" else 1):
            m = localize(start, policy, known_heading, rng)
            out.append(cap_val(m))
    return np.array(out, dtype=float)


def cap_val(m):
    return 12.0 if m is None else float(m)


def localize_known(start, policy, rng, cap=12):
    """Same, but the heading is known, so the belief is over tiles only."""
    t, h = start
    belief = [(tt, h) for tt in FREE]
    belief = consistent(observe(MAZE[t[0]][t[1]], h), belief)
    moves, prev = 0, None
    while len(belief) > 1 and moves < cap:
        z = observe(MAZE[t[0]][t[1]], h)
        opts = [b for b in open_dirs(z) if step(t, h, b) is not None]
        if not opts:
            return None
        if policy == "random":
            b = rng.choice(opts)
        elif policy == "report":
            b = 0 if 0 in opts else rng.choice([d for d in opts if d != 2] or opts)
        else:
            best, b = None, opts[0]
            for d in opts:
                nxt = Counter()
                for (bt, bh) in belief:
                    s = step(bt, bh, d)
                    if s is None:
                        continue
                    nt, nh = s
                    nxt[observe(MAZE[nt[0]][nt[1]], nh)] += 1
                tot = sum(nxt.values()) or 1
                exp = sum(n * n for n in nxt.values()) / tot
                if best is None or exp < best:
                    best, b = exp, d
        s = step(t, h, b)
        t, h = s
        nb = [x for x in (step(bt, bh, b) for (bt, bh) in belief) if x is not None]
        belief = consistent(observe(MAZE[t[0]][t[1]], h), nb)
        prev, moves = b, moves + 1
    return moves if len(belief) == 1 else None


def main():
    FIGS.mkdir(parents=True, exist_ok=True)

    # ---- 1. how ambiguous is a single reading? ------------------------------
    first = {}
    for (t, h) in all_states(False):
        z = observe(MAZE[t[0]][t[1]], h)
        first[(t, h)] = len(consistent(z, all_states(False)))
    sizes = np.array(list(first.values()))
    per_tile = np.zeros((ROWS, COLS))
    per_tile[:] = np.nan
    for (t, h), n in first.items():
        per_tile[t] = max(0 if np.isnan(per_tile[t]) else per_tile[t], n)
    uniq = [k for k, v in first.items() if v == 1]
    print(f"single reading, heading unknown: belief size {sizes.min()}-{sizes.max()}, "
          f"mean {sizes.mean():.1f} of {len(all_states(False))} states")
    print(f"  states pinned by one reading alone: {len(uniq)} "
          f"({sorted(set((t[0]+1, t[1]+1) for t, _ in uniq))})")

    firstk = {}
    for t in FREE:
        z = observe(MAZE[t[0]][t[1]], 0)
        firstk[t] = sum(1 for tt in FREE if observe(MAZE[tt[0]][tt[1]], 0) == z)
    sk = np.array(list(firstk.values()))
    print(f"single reading, heading known:   belief size {sk.min()}-{sk.max()}, "
          f"mean {sk.mean():.1f} of {len(FREE)} tiles")

    # ---- 2. moves to a unique fix -------------------------------------------
    rng = random.Random(7)
    res = {}
    TRIALS = 400
    for policy in ("random", "report", "greedy"):
        for known in (False, True):
            vals = []
            for (t, h) in all_states(False):
                reps = TRIALS if policy != "greedy" else 1
                for _ in range(reps):
                    m = (localize_known((t, h), policy, rng) if known
                         else localize((t, h), policy, False, rng))
                    vals.append(12.0 if m is None else float(m))
            v = np.array(vals)
            res[(policy, known)] = v
            print(f"{policy:>7} heading {'known ' if known else 'unknown'}: "
                  f"mean {v.mean():.2f} moves, median {np.median(v):.0f}, "
                  f"max {v.max():.0f}, "
                  f"{100*np.mean(v<=1):.0f} % done in <=1 move")

    # ---- figure --------------------------------------------------------------
    fig, ax = plt.subplots(1, 3, figsize=(13.4, 3.8))

    im = ax[0].imshow(per_tile, cmap="YlOrRd", vmin=1, vmax=per_tile[~np.isnan(per_tile)].max())
    for r in range(ROWS):
        for c in range(COLS):
            if MAZE[r][c] == 15:
                ax[0].add_patch(plt.Rectangle((c - .5, r - .5), 1, 1, color="0.25"))
                ax[0].text(c, r, "×", ha="center", va="center", color="w", fontsize=11)
            else:
                ax[0].text(c, r, f"{int(per_tile[r, c])}", ha="center", va="center", fontsize=9)
    ax[0].set_xticks(range(COLS), [str(i + 1) for i in range(COLS)])
    ax[0].set_yticks(range(ROWS), [str(i + 1) for i in range(ROWS)])
    ax[0].set_title("(a) states still possible after one reading", fontsize=10)
    fig.colorbar(im, ax=ax[0], fraction=0.03, pad=0.02)

    for policy, style in (("random", "-"), ("report", "--"), ("greedy", ":")):
        for known, col in ((False, "#C0392B"), (True, "#1F6FB2")):
            v = res[(policy, known)]
            xs = np.arange(0, 7)
            cdf = [np.mean(v <= x) for x in xs]
            ax[1].plot(xs, cdf, style, color=col, lw=1.8,
                       label=f"{policy}, heading {'known' if known else 'unknown'}")
    ax[1].axhline(1.0, color="0.7", lw=0.8)
    ax[1].set_xlabel("one-tile moves spent localizing")
    ax[1].set_ylabel("fraction of starts resolved")
    ax[1].set_title("(b) the cost of not trusting the IMU", fontsize=10)
    ax[1].legend(fontsize=6.5, loc="lower right")
    ax[1].set_ylim(0, 1.04)

    labels, means, errs = [], [], []
    for policy in ("random", "report", "greedy"):
        for known in (False, True):
            v = res[(policy, known)]
            labels.append(f"{policy}\n{'IMU' if known else 'no IMU'}")
            means.append(v.mean())
            errs.append(v.std())
    xs = np.arange(len(labels))
    cols = ["#C0392B", "#1F6FB2"] * 3
    ax[2].bar(xs, means, yerr=errs, capsize=3, color=cols, alpha=0.85)
    ax[2].set_xticks(xs, labels, fontsize=7.5)
    ax[2].set_ylabel("moves to a unique fix")
    ax[2].set_title("(c) mean ± sd over every start state", fontsize=10)

    for a in ax[1:]:
        a.grid(alpha=0.25, lw=0.6)
        for sp in ("top", "right"):
            a.spines[sp].set_visible(False)
    fig.tight_layout()
    for ext in ("pdf", "png"):
        fig.savefig(FIGS / f"mie444_localization.{ext}", dpi=170, bbox_inches="tight")
    print(f"wrote {FIGS/'mie444_localization.pdf'}")

    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "mie444_maze.json").write_text(json.dumps(
        {"rows": ROWS, "cols": COLS, "maze": MAZE,
         "note": "world bits 1=N 2=W 4=S 8=E; 15 = blocked. From Figure 2.2-1 of the report."},
        indent=1))
    print(f"wrote {DATA/'mie444_maze.json'}")


if __name__ == "__main__":
    main()

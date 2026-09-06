#!/usr/bin/env python3
"""
Copy a subset of the trained TINTIN policies into the website, rounding the
weights so the page does not ship two megabytes per checkpoint.

    python3 scripts/publish_tintin_policies.py

Reads   ~/Desktop/space_robot_mujoco/docs/policies/stage_*.json
Writes  assets/data/tintin_policies/stage_*.json
and rewrites the <select id="t3-stage"> options in tintin.html to match.
"""
import json, os, re, sys

SRC = os.path.expanduser("~/Desktop/space_robot_mujoco/docs/policies")
DST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "assets", "data", "tintin_policies")
PRECISION = 4


def label(n):
    if n >= 1_000_000:
        return f"{n/1e6:g} M steps"
    if n >= 1_000:
        return f"{n//1000} k steps"
    return f"{n} steps"


def main(keep=None):
    os.makedirs(DST, exist_ok=True)
    for f in os.listdir(DST):
        if f.endswith(".json"):
            os.remove(os.path.join(DST, f))

    stages = sorted(int(re.search(r"stage_(\d+)", f).group(1))
                    for f in os.listdir(SRC) if f.startswith("stage_"))
    if keep:
        stages = [s for s in stages if s in keep]
    else:
        # first, last, and a spread in between
        pick = {stages[0], stages[-1]}
        for frac in (0.25, 0.5, 0.75):
            pick.add(stages[int(frac * (len(stages) - 1))])
        stages = sorted(pick)

    total = 0
    for n in stages:
        with open(os.path.join(SRC, f"stage_{n}.json")) as fh:
            spec = json.load(fh)
        for L in spec["layers"]:
            L["w"] = [round(x, PRECISION) for x in L["w"]]
            L["b"] = [round(x, PRECISION) for x in L["b"]]
        p = os.path.join(DST, f"stage_{n}.json")
        with open(p, "w") as fh:
            json.dump(spec, fh, separators=(",", ":"))
        kb = os.path.getsize(p) // 1024
        total += kb
        print(f"  stage_{n}.json  {kb} KB")
    print(f"  {len(stages)} checkpoints, {total} KB total")

    # keep the picker in sync with what was actually published
    page = os.path.join(os.path.dirname(DST), "..", "..", "tintin.html")
    page = os.path.abspath(page)
    html = open(page).read()
    opts = "\n".join(
        f'            <option value="{n}"{" selected" if n == stages[-1] else ""}>{label(n)}</option>'
        for n in stages)
    html = re.sub(r'(<select id="t3-stage">)(.*?)(\n\s*</select>)',
                  lambda m: m.group(1) + "\n" + opts + m.group(3),
                  html, flags=re.S)
    open(page, "w").write(html)
    print("  updated the stage picker in tintin.html")


if __name__ == "__main__":
    main([int(x) for x in sys.argv[1:]] or None)

#!/usr/bin/env python3
"""Best-effort refresh of stats.json for the homepage dashboard.

Runs in CI (see .github/workflows/update-stats.yml). Every field falls back to
its previous value on any failure, so the dashboard never shows a broken number.

Sources:
  visitors  -> mapmyvisitors.com/web/1c0c4  (lifetime total visits)
  tiktok    -> tiktok.com/@thejerrycheng     (followerCount)
  citations -> Google Scholar profile        (may be blocked from CI IPs)
  hindex    -> Google Scholar profile
GitHub stars are fetched live client-side (site.js), not here.
X has no free automated source -> left as the manual value in stats.json.
"""
import json
import re
import urllib.request

PATH = "stats.json"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/123.0 Safari/537.36")


def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore")


def attempt(fn, label):
    try:
        v = fn()
        if v is not None:
            print(f"[ok]   {label} = {v}")
            return v
        print(f"[skip] {label}: no value parsed")
    except Exception as e:  # noqa: BLE001 - never let one source break the run
        print(f"[skip] {label}: {e}")
    return None


def visitors():
    html = fetch("https://mapmyvisitors.com/web/1c0c4")
    m = re.search(r"([\d,]+)\s*total\s*visits", html, re.I)
    return int(m.group(1).replace(",", "")) if m else None


def tiktok():
    html = fetch("https://www.tiktok.com/@thejerrycheng")
    m = re.search(r'"followerCount":\s*(\d+)', html)
    return int(m.group(1)) if m else None


def scholar():
    html = fetch("https://scholar.google.com/citations?user=iQuHS3MAAAAJ&hl=en")
    nums = re.findall(r'gsc_rsb_std">(\d+)</td>', html)
    # order: citations(all), citations(since), h(all), h(since), i10(all), i10(since)
    cites = int(nums[0]) if len(nums) >= 1 else None
    h = int(nums[2]) if len(nums) >= 3 else None
    return (cites, h) if (cites or h) else None


def main():
    with open(PATH, encoding="utf-8") as f:
        s = json.load(f)

    v = attempt(visitors, "visitors")
    if v is not None:
        s["visitors"] = v

    t = attempt(tiktok, "tiktok")
    if t is not None:
        s["tiktok"] = t

    sc = attempt(scholar, "scholar")
    if sc is not None:
        cites, h = sc
        if cites is not None:
            s["citations"] = cites
        if h is not None:
            s["hindex"] = h

    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(s, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("wrote", PATH)


if __name__ == "__main__":
    main()

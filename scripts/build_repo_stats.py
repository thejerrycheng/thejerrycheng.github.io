#!/usr/bin/env python3
"""Snapshot GitHub stars/forks for every repo the site links to (own + co-authored).

Writes assets/data/repo_stats.json. The page shows these numbers instantly, then
site.js replaces them with live counts from the GitHub API (cached 30 min per
browser). Re-run any time:  python3 scripts/build_repo_stats.py   (needs `gh` logged in)
"""
import json, pathlib, re, subprocess, datetime
ROOT = pathlib.Path(__file__).resolve().parents[1]
OWNERS = {"thejerrycheng", "robotmabel", "huangbj16", "utiasstars", "purdue-tracelab"}
pat = re.compile(r"https://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)")
repos = set()
for f in list(ROOT.glob("*.html")) + [ROOT / "assets/data/catalog.json"]:
    for o, r in pat.findall(f.read_text(errors="ignore")):
        r = re.sub(r"\.git$", "", r)
        if o.lower() in OWNERS: repos.add(f"{o}/{r}")
out = {}
for full in sorted(repos, key=str.lower):
    try:
        j = json.loads(subprocess.check_output(["gh", "api", f"repos/{full}"], stderr=subprocess.DEVNULL))
        out[full.lower()] = {"s": j["stargazers_count"], "f": j["forks_count"]}
        print(f"{full:60s} ★{j['stargazers_count']:>5}  ⑂{j['forks_count']:>4}")
    except subprocess.CalledProcessError:
        print(f"{full:60s} (not found / private, skipped)")
data = {"updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "repos": out}
(ROOT / "assets/data/repo_stats.json").write_text(json.dumps(data, indent=1) + "\n")
print(len(out), "repos")

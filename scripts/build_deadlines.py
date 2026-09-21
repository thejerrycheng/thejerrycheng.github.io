#!/usr/bin/env python3
"""Build the paper-deadline tracker dataset.

Merges the per-group research files in assets/data/deadlines_src/*.json
(one file per research pass, each shaped {"conferences": {"<id>": {...}}})
into a single validated dataset:

    assets/data/deadlines.json      the merged dataset
    assets/js/deadlines_data.js     the same as window.DEADLINES (no fetch, works on file://)

Every edition is checked for ISO dates in the right order
(abstract <= paper <= reviews <= rebuttal <= notification <= camera-ready <= conference),
a known continent, a 2-letter country code, a status from the allowed set and,
for official editions, at least one source. Problems are printed; --strict
makes them fatal.

    python3 scripts/build_deadlines.py [--strict]
"""
import datetime as dt
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "data", "deadlines_src")
OUT_JSON = os.path.join(ROOT, "assets", "data", "deadlines.json")
OUT_JS = os.path.join(ROOT, "assets", "js", "deadlines_data.js")

CONTINENTS = {"North America", "South America", "Europe", "Asia", "Africa", "Oceania"}
STATUSES = {"past", "announced", "estimated", "tbd", "rolling"}
CONF_LEVELS = {"high", "medium", "low"}

# research-file field tags -> canonical field ids used by the page
FIELD_MAP = {
    "robotics": "robotics", "mechatronics": "robotics", "automation": "robotics",
    "robot learning": "robot-learning", "robot-learning": "robot-learning",
    "machine learning": "ml", "ml": "ml", "reinforcement learning": "ml", "deep learning": "ml",
    "computer vision": "vision", "vision": "vision", "perception": "vision",
    "ai": "ai", "artificial intelligence": "ai", "planning": "ai", "multi-agent": "ai",
    "algorithms": "ai", "agents": "ai",
    "control": "control", "learning for control": "control",
    "hci": "hci", "human-robot interaction": "hci",
    "haptics": "haptics",
    "graphics": "graphics", "animation": "graphics",
}
FIELD_ORDER = ["robotics", "robot-learning", "ml", "vision", "ai", "control", "hci", "haptics", "graphics"]

SHORT = {
    "icra": "ICRA", "iros": "IROS", "corl": "CoRL", "iclr": "ICLR", "neurips": "NeurIPS", "icml": "ICML",
    "aaai": "AAAI", "ijcai": "IJCAI", "aistats": "AISTATS", "uai": "UAI", "colm": "COLM", "rlc": "RLC",
    "cvpr": "CVPR", "iccv": "ICCV", "eccv": "ECCV", "wacv": "WACV", "3dv": "3DV", "bmvc": "BMVC",
    "rss": "RSS", "humanoids": "Humanoids", "hri": "HRI", "aim": "AIM", "case": "CASE", "robosoft": "RoboSoft",
    "isrr": "ISRR", "iser": "ISER", "wafr": "WAFR", "icaps": "ICAPS", "aamas": "AAMAS", "ral": "RA-L",
    "chi": "CHI", "uist": "UIST", "siggraph": "SIGGRAPH", "siggraph_asia": "SIGGRAPH Asia",
    "haptics": "Haptics Symp.", "world_haptics": "World Haptics", "eurohaptics": "EuroHaptics",
    "cdc": "CDC", "acc": "ACC", "l4dc": "L4DC", "collas": "CoLLAs", "tro_special": "T-RO special issue",
}

DATE_FIELDS = ["abstract_deadline", "paper_deadline", "original_paper_deadline", "supplementary_deadline",
               "reviews_released", "rebuttal_start", "rebuttal_end", "notification", "camera_ready",
               "conf_start", "conf_end"]
ORDER_CHAIN = ["abstract_deadline", "paper_deadline", "reviews_released", "rebuttal_start", "rebuttal_end",
               "notification", "conf_start", "conf_end"]

EXCLUDE = {"tro_special"}   # a closed special-issue call; not a venue to plan around

problems = []


def warn(msg):
    problems.append(msg)
    print("  ! " + msg)


def iso(s, where, field):
    if s in (None, "", "null"):
        return None
    if not isinstance(s, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        warn(f"{where}: {field} is not an ISO date: {s!r}")
        return None
    try:
        dt.date.fromisoformat(s)
    except ValueError:
        warn(f"{where}: {field} is not a real date: {s!r}")
        return None
    return s


def canon_fields(tags):
    out = []
    for t in tags or []:
        k = FIELD_MAP.get(str(t).strip().lower())
        if k is None:
            warn(f"unknown field tag {t!r} (add it to FIELD_MAP)")
            continue
        if k not in out:
            out.append(k)
    return sorted(out, key=FIELD_ORDER.index)


def canon_pattern(p):
    """Agents named the pattern keys differently; map them onto one shape."""
    p = dict(p or {})
    out = {"deadline": None, "notification": None, "conference": None, "rotation": None,
           "review_process": None, "resubmission_rules": None, "extra": {}}
    def take(pred):
        for k in list(p):
            if pred(k.lower()) and isinstance(p[k], (str, int, float)):
                return str(p.pop(k))
        return None
    out["deadline"] = take(lambda k: "deadline" in k and "abstract" not in k and "camera" not in k and "workshop" not in k)
    out["notification"] = take(lambda k: "notification" in k or "decision" in k)
    out["conference"] = take(lambda k: "conference" in k and "location" not in k)
    out["rotation"] = take(lambda k: "rotation" in k or "location" in k)
    out["review_process"] = take(lambda k: "review" in k)
    out["resubmission_rules"] = take(lambda k: "resubmission" in k or "dual" in k or "rules" in k or "polic" in k)
    for k, v in p.items():
        out["extra"][k] = v if isinstance(v, (str, int, float, list, dict)) else str(v)
    return out


def load_sources():
    merged = {}
    for path in sorted(glob.glob(os.path.join(SRC, "*.json"))):
        with open(path) as f:
            try:
                doc = json.load(f)
            except json.JSONDecodeError as e:
                warn(f"{os.path.basename(path)}: invalid JSON ({e})")
                continue
        confs = doc.get("conferences", {})
        if isinstance(confs, list):
            confs = {c.get("id") or c.get("conf"): c for c in confs}
        for cid, c in confs.items():
            cid = (cid or "").strip().lower()
            if cid in EXCLUDE:
                continue
            if not cid:
                warn(f"{os.path.basename(path)}: conference without id")
                continue
            if cid in merged:
                # merge editions from a second file, keep first file's metadata
                seen = {e.get("year") for e in merged[cid]["editions"]}
                for e in c.get("editions", []):
                    if e.get("year") in seen:
                        warn(f"{cid} {e.get('year')}: duplicated in {os.path.basename(path)}, first copy kept")
                    else:
                        merged[cid]["editions"].append(e)
            else:
                merged[cid] = {"meta": c, "editions": list(c.get("editions", [])), "file": os.path.basename(path)}
    return merged


def build():
    merged = load_sources()
    conferences = []
    n_ed = 0
    status_count = {}
    for cid in sorted(merged):
        meta = merged[cid]["meta"]
        eds_out = []
        website = meta.get("website")
        for e in merged[cid]["editions"]:
            year = e.get("year")
            where = f"{cid} {year}"
            if not isinstance(year, int):
                warn(f"{where}: year must be an integer")
                continue
            ed = {"year": year, "name": e.get("name") or f"{SHORT.get(cid, cid.upper())} {year}"}
            for fld in DATE_FIELDS:
                ed[fld] = iso(e.get(fld), where, fld)
            # order check (multi-round venues publish round-1 decisions before the final deadline)
            prev_name, prev = None, None
            multi_round = bool(e.get("rounds"))
            for fld in ORDER_CHAIN:
                v = ed.get(fld)
                if v is None or (multi_round and fld in ("reviews_released", "rebuttal_start", "rebuttal_end")):
                    continue
                if prev is not None and v < prev:
                    warn(f"{where}: {fld} ({v}) is before {prev_name} ({prev})")
                prev_name, prev = fld, v
            if ed["camera_ready"] and ed["notification"] and ed["camera_ready"] < ed["notification"]:
                warn(f"{where}: camera_ready ({ed['camera_ready']}) is before notification ({ed['notification']})")
            if e.get("rounds"):
                ed["rounds"] = e["rounds"]
            for k in ("deadline_time", "deadline_tz", "city", "country", "venue", "website"):
                ed[k] = e.get(k) or None
            extra_notes = []
            if ed["venue"] and len(ed["venue"]) > 60 and " (" in ed["venue"]:
                # commentary written into the venue field -> keep the name, move the rest to notes
                head, tail = ed["venue"].split(" (", 1)
                ed["venue"], extra_notes = head.strip(), ["Venue: " + tail.rstrip(")").strip()]
            cc = (e.get("country_code") or "").strip().upper() or None
            if cc and not re.fullmatch(r"[A-Z]{2}", cc):
                warn(f"{where}: country_code {cc!r} is not ISO-2")
                cc = None
            ed["country_code"] = cc
            cont = e.get("continent")
            if cont and cont not in CONTINENTS:
                warn(f"{where}: continent {cont!r} not in {sorted(CONTINENTS)}")
            ed["continent"] = cont
            st = (e.get("status") or "tbd").lower()
            if st not in STATUSES:
                warn(f"{where}: status {st!r} not in {sorted(STATUSES)}")
                st = "tbd"
            ed["status"] = st
            status_count[st] = status_count.get(st, 0) + 1
            ed["notes"] = extra_notes + [str(n) for n in (e.get("notes") or [])]
            srcs = []
            for s in e.get("sources") or []:
                if isinstance(s, dict) and s.get("url"):
                    srcs.append({"url": s["url"], "accessed": s.get("accessed"), "quote": s.get("quote")})
            ed["sources"] = srcs
            if st in ("announced", "past") and not srcs:
                warn(f"{where}: official edition without a source")
            conf = e.get("confidence") or {}
            ed["confidence"] = {k: (conf.get(k) if conf.get(k) in CONF_LEVELS else None)
                                for k in ("paper_deadline", "notification", "conf_dates", "location")}
            if st != "rolling" and ed["paper_deadline"] is None and st != "tbd":
                warn(f"{where}: no paper_deadline but status is {st}")
            if st in ("announced", "past") and ed["conf_start"] and ed["conf_end"] is None:
                warn(f"{where}: conf_start without conf_end")
            if ed.get("website") and not website:
                website = ed["website"]
            eds_out.append(ed)
            n_ed += 1
        eds_out.sort(key=lambda x: x["year"], reverse=True)
        if eds_out and website is None:
            website = eds_out[0].get("website")
        fields = canon_fields(meta.get("field") or meta.get("fields"))
        if not fields:
            warn(f"{cid}: no field tags")
        conferences.append({
            "id": cid,
            "short": meta.get("short") or SHORT.get(cid, cid.upper()),
            "name": meta.get("full_name") or meta.get("name") or cid,
            "fields": fields,
            "website": website,
            "pattern": canon_pattern(meta.get("pattern")),
            "editions": eds_out,
        })
    conferences.sort(key=lambda c: (FIELD_ORDER.index(c["fields"][0]) if c["fields"] else 99, c["short"].lower()))
    data = {
        "generated": dt.date.today().isoformat(),
        "conference_count": len(conferences),
        "edition_count": n_ed,
        "conferences": conferences,
    }
    return data, status_count


def main():
    strict = "--strict" in sys.argv
    print(f"build_deadlines: reading {SRC}")
    data, status_count = build()
    with open(OUT_JSON, "w") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
        f.write("\n")
    with open(OUT_JS, "w") as f:
        f.write("/* generated by scripts/build_deadlines.py — do not edit by hand */\n")
        f.write("window.DEADLINES = ")
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
        f.write(";\n")
    print(f"\n{data['conference_count']} conferences, {data['edition_count']} editions -> {os.path.relpath(OUT_JSON, ROOT)}, {os.path.relpath(OUT_JS, ROOT)}")
    print("status counts: " + ", ".join(f"{k}={v}" for k, v in sorted(status_count.items())))
    print(f"\n{'conf':<14}{'year':<6}{'deadline':<12}{'decision':<12}{'conference':<24}{'where':<28}{'status':<10}conf.")
    for c in data["conferences"]:
        for e in c["editions"]:
            where = ", ".join(x for x in (e.get("city"), e.get("country")) if x)
            cd = f"{e.get('conf_start') or '—'} → {e.get('conf_end') or '—'}" if e.get("conf_start") else "—"
            cf = e["confidence"]
            print(f"{c['short']:<14}{e['year']:<6}{e.get('paper_deadline') or '—':<12}{e.get('notification') or '—':<12}{cd:<24}{where[:27]:<28}{e['status']:<10}{(cf.get('paper_deadline') or '-')[0]}/{(cf.get('notification') or '-')[0]}/{(cf.get('conf_dates') or '-')[0]}")
    if problems:
        print(f"\n{len(problems)} problem(s) listed above")
        if strict:
            sys.exit(1)
    else:
        print("\nno problems found")


if __name__ == "__main__":
    main()

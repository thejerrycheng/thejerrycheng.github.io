#!/usr/bin/env python3
"""Take the private content out of the published files and publish it encrypted.

The site is a public repo, so anything committed can be read. The research ideas
and the Read the Room page are therefore not committed as themselves: this
script lifts them out, encrypts them (scripts/tools/private_crypto.js), and
leaves behind only the .enc a browser can open with the passphrase.

Run it after any rebuild of papers_data.json, or after editing m2-private.html:

    JC_PRIVATE_PASS=... python3 scripts/tools/build_private.py

Idempotent. The plaintext stays on disk, git-ignored:
  papers/private-ideas.json · papers/reviews.json · m2-private.html · the M2 PDFs
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOOL = os.path.join(ROOT, "scripts", "tools", "private_crypto.js")
PASS = os.environ.get("JC_PRIVATE_PASS")
if not PASS:
    sys.exit("set JC_PRIVATE_PASS")

def enc(src, dst):
    subprocess.run(["node", TOOL, "encrypt", src, dst, "--pass", PASS], check=True)

def p(*a): return os.path.join(ROOT, *a)

# ---- 1. the research ideas -------------------------------------------------
db_path, rv_path = p("papers", "papers_data.json"), p("papers", "reviews.json")
src_path = p("papers", "private-ideas.json")          # local plaintext, git-ignored
db = json.load(open(db_path))

if db["meta"].get("ideas"):
    # first run after a rebuild: lift the ideas out and remember them locally
    payload = {
        "ideas":   db["meta"].pop("ideas"),
        "reviews": json.load(open(rv_path)) if os.path.exists(rv_path) else {},
        # which paper feeds which idea — the ids alone say more than they should
        "paperIdeas": {x["id"]: x["ideas"] for x in db["papers"] if x.get("ideas")},
    }
    for x in db["papers"]:
        x.pop("ideas", None)
    json.dump(payload, open(src_path, "w"), ensure_ascii=False)
    json.dump(db, open(db_path, "w"), ensure_ascii=False)
    print(f"lifted {len(payload['ideas'])} ideas and {len(payload['reviews'])} reviews "
          f"out of papers_data.json")
elif not os.path.exists(src_path):
    sys.exit("papers_data.json has no ideas and papers/private-ideas.json is missing "
             "— rebuild the database first")
else:
    print("papers_data.json is already stripped; re-encrypting the local copy")

enc(src_path, p("papers", "private-ideas.enc"))

# ---- 2. the Read the Room page and its PDFs --------------------------------
os.makedirs(p("assets", "private"), exist_ok=True)
enc(p("m2-private.html"), p("assets", "private", "m2.enc"))
for pdf in ("read-the-room.pdf", "supplement.pdf"):
    f = p("assets", "projects", "m2", pdf)
    if os.path.exists(f):
        enc(f, f + ".enc")

print("\ndone — now regenerate the XMind/Markdown downloads if the ideas moved:")
print("  python3 papers/tools/make_xmind.py")

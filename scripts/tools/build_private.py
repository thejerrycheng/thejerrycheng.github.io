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
import hashlib, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOOL = os.path.join(ROOT, "scripts", "tools", "private_crypto.js")
PASS = os.environ.get("JC_PRIVATE_PASS")
if not PASS:
    sys.exit("set JC_PRIVATE_PASS")

MANIFEST = None   # set once ROOT is known

def _sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

def enc(src, dst):
    """Encrypt, but only when the plaintext actually changed — a fresh IV every
    run would rewrite every .enc and put megabytes of noise in each commit."""
    digest = _sha(src)
    if MANIFEST.get(dst) == digest and os.path.exists(dst):
        print(f"unchanged {os.path.relpath(src, ROOT)}")
        return
    subprocess.run(["node", TOOL, "encrypt", src, dst, "--pass", PASS], check=True)
    MANIFEST[dst] = digest

def p(*a): return os.path.join(ROOT, *a)

MANIFEST_PATH = p("papers", ".private-manifest.json")     # local, git-ignored
MANIFEST = json.load(open(MANIFEST_PATH)) if os.path.exists(MANIFEST_PATH) else {}

# ---- 1. the research ideas -------------------------------------------------
# schema.py is the source of truth for the ideas and the order they appear in;
# reviews.json is the built review text. Both are git-ignored. Anything the last
# papers rebuild left lying in the public files gets lifted out here.
db_path, rv_path = p("papers", "papers_data.json"), p("papers", "reviews.json")
src_path = p("papers", "private-ideas.json")          # local plaintext, git-ignored
db = json.load(open(db_path))
payload = (json.load(open(src_path)) if os.path.exists(src_path)
           else {"ideas": [], "reviews": {}, "paperIdeas": {}})

sys.path.insert(0, p("papers", "tools"))
try:
    import schema
    payload["ideas"] = schema.ordered_ideas()
except Exception as e:                                 # tools not on this machine
    print(f"schema.py unavailable ({e}); keeping the ideas already in {src_path}")
    if db["meta"].get("ideas"):
        payload["ideas"] = db["meta"]["ideas"]
db["meta"].pop("ideas", None)

if os.path.exists(rv_path):
    payload["reviews"] = json.load(open(rv_path))

# the paper->idea tags: ids alone say more than they should, so they travel encrypted
moved = 0
for x in db["papers"]:
    if x.get("ideas"):
        payload["paperIdeas"][x["id"]] = sorted(set(payload["paperIdeas"].get(x["id"], []) + x.pop("ideas")))
        moved += 1

if not payload["ideas"]:
    sys.exit("no ideas found — rebuild papers_data.json, or restore papers/private-ideas.json")

json.dump(payload, open(src_path, "w"), ensure_ascii=False)
json.dump(db, open(db_path, "w"), ensure_ascii=False)
print(f"private: {len(payload['ideas'])} ideas, {len(payload['reviews'])} reviews, "
      f"{len(payload['paperIdeas'])} tagged papers ({moved} lifted out of papers_data.json this run)")

enc(src_path, p("papers", "private-ideas.enc"))

# ---- 2. the Read the Room page and its PDFs --------------------------------
os.makedirs(p("assets", "private"), exist_ok=True)
enc(p("m2-private.html"), p("assets", "private", "m2.enc"))
for pdf in ("read-the-room.pdf", "supplement.pdf"):
    f = p("assets", "projects", "m2", pdf)
    if os.path.exists(f):
        enc(f, f + ".enc")

json.dump(MANIFEST, open(MANIFEST_PATH, "w"), indent=1)

print("\ndone — now regenerate the XMind/Markdown downloads if the ideas moved:")
print("  python3 papers/tools/make_xmind.py")

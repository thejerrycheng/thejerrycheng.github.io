#!/usr/bin/env python3
"""Make the M2 page's heavy assets small enough to load fast. Idempotent.

The M2 page (m2.html -> assets/private/m2.enc) is published encrypted, and an
encrypted file cannot stream: the browser has to download all of it and decrypt
it before showing a single frame. So size is load time, and this script cuts it:

  viewer/rollouts.bin   float32 poses, 12.5 MB (9.2 MB gz)  -> rollouts.q.bin   ~1.4 MB gz
                        mm positions + int16 quaternions, delta-coded along time,
                        split into low/high byte planes so gzip sees the runs.
                        Worst-case error: 0.5 mm, ~0.1 deg.
  viewer/meshes.bin     float32 verts + uint32 indices, 2.2 MB gz -> meshes.q.bin ~1.1 MB gz
                        uint16 verts on each mesh's bounding box (<= 1/65535 of its extent),
                        int16 delta-coded indices.
  montage.mp4           hero, 1600x900 @ 1.9 Mb/s, 36 s, 8.5 MB -> 1280x720, first 20 s, 1.8 MB
  montage.jpg, objects.jpg   re-encoded smaller.
  assets/projects/m2/figures/*.png -> *.webp siblings (<= 1600 px wide) for the
                        page's <img> tags; the PNGs stay for click-to-enlarge.

The originals' .enc files are kept (the viewer falls back to them if a packed
file is missing or does not match rollouts.json), and the packed files are only
rebuilt when their source changed (sha recorded in viewer/.packed.json).

    JC_PRIVATE_PASS=... python3 scripts/tools/m2_fast_assets.py

Needs node (scripts/tools/private_crypto.js), numpy, ffmpeg and cwebp.
"""
import gzip, hashlib, json, os, shutil, struct, subprocess, sys, tempfile

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOOL = os.path.join(ROOT, "scripts", "tools", "private_crypto.js")
PRIV = os.path.join(ROOT, "assets", "private", "m2")
VIEW = os.path.join(PRIV, "viewer")
FIGS = os.path.join(ROOT, "assets", "projects", "m2", "figures")
PASS = os.environ.get("JC_PRIVATE_PASS") or sys.exit("set JC_PRIVATE_PASS")
TMP = tempfile.mkdtemp(prefix="m2fast-")


def dec(enc):
    out = os.path.join(TMP, os.path.basename(enc)[:-4])
    subprocess.run(["node", TOOL, "decrypt", enc, out, "--pass", PASS], check=True, capture_output=True)
    return out


def enc(src, dst):
    subprocess.run(["node", TOOL, "encrypt", src, dst, "--pass", PASS], check=True, capture_output=True)


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def planes(a16):
    """int16/uint16 array -> low bytes then high bytes (gzip compresses the planes far better)."""
    u = np.ascontiguousarray(a16).view(np.uint16).ravel()
    return (u & 255).astype(np.uint8).tobytes() + (u >> 8).astype(np.uint8).tobytes()


def write_gz_enc(blob, name):
    raw = os.path.join(TMP, name)
    with open(raw, "wb") as f:
        f.write(gzip.compress(blob, 9, mtime=0))
    enc(raw, os.path.join(VIEW, name + ".enc"))
    return os.path.getsize(raw)


# ---------------------------------------------------------------- 3-D viewer data
def pack_rollouts(js, binp):
    ro = json.load(open(js))
    nb = ro["nbody"]
    F = np.fromfile(binp, np.float32).reshape(-1, nb, 7).astype(np.float64)
    T = F.shape[0]
    starts = sorted({e["f0"] for e in ro["episodes"]} | {0})
    resets = np.zeros(T, bool)
    resets[[s for s in starts if s < T]] = True
    Q = F[..., 3:].copy()
    for t in range(1, T):                       # q and -q are one rotation: keep each series continuous
        if resets[t]:
            continue
        s = np.sign((Q[t] * Q[t - 1]).sum(-1))
        s[s == 0] = 1
        Q[t] *= s[:, None]
    PS, QS = 1e-3, 8192.0
    p = np.round(F[..., :3] / PS).astype(np.int64)
    q = np.round(Q * QS).astype(np.int64)
    a = np.concatenate([p, q], 2).transpose(1, 2, 0)          # body, channel, frame
    d = a.copy()
    d[..., 1:] -= a[..., :-1]
    d[..., resets] = a[..., resets]                            # absolute at every episode start
    assert np.abs(d).max() < 32768, "pose delta does not fit int16"
    hdr = b"M2Q1" + struct.pack("<iiffi", T, nb, PS, QS, len(starts)) + struct.pack("<%di" % len(starts), *starts)
    return write_gz_enc(hdr + planes(d.astype(np.int16)), "rollouts.q.bin.gz")


def pack_meshes(js, binp):
    sc = json.load(open(js))
    B = open(binp, "rb").read()
    V = np.frombuffer(B[: sc["vbytes"]], np.float32)
    I = np.frombuffer(B[sc["vbytes"]:], np.uint32)
    head, vs, ix = [], [], []
    for m in sc["meshes"]:
        v = V[m["v"]: m["v"] + 3 * m["nv"]].reshape(-1, 3).astype(np.float64)
        lo = v.min(0)
        s = float((v.max(0) - lo).max() / 65535) or 1.0
        vs.append(np.round((v - lo) / s).astype(np.uint16).ravel())
        i = I[m["i"]: m["i"] + m["ni"]].astype(np.int64)
        di = np.diff(np.concatenate([[0], i]))
        assert np.abs(di).max() < 32768, "index delta does not fit int16"
        ix.append(di.astype(np.int16))
        head.append(struct.pack("<II4f", m["nv"], m["ni"], lo[0], lo[1], lo[2], s))
    blob = b"M2M1" + struct.pack("<i", len(head)) + b"".join(head)
    blob += planes(np.concatenate(vs)) + planes(np.concatenate(ix))
    return write_gz_enc(blob, "meshes.q.bin.gz")


def viewer():
    rec_path = os.path.join(VIEW, ".packed.json")
    rec = json.load(open(rec_path)) if os.path.exists(rec_path) else {}
    srcs = {k: os.path.join(VIEW, k + ".gz.enc") for k in ("scene.json", "meshes.bin", "rollouts.json", "rollouts.bin")}
    key = {k: sha(v) for k, v in srcs.items()}
    if rec.get("src") == key and all(os.path.exists(os.path.join(VIEW, n)) for n in ("rollouts.q.bin.gz.enc", "meshes.q.bin.gz.enc")):
        print("viewer: packed files are current")
        return
    plain = {}
    for k, v in srcs.items():
        g = dec(v)
        plain[k] = g[:-3]
        with gzip.open(g) as fi, open(plain[k], "wb") as fo:
            shutil.copyfileobj(fi, fo)
    a = pack_rollouts(plain["rollouts.json"], plain["rollouts.bin"])
    b = pack_meshes(plain["scene.json"], plain["meshes.bin"])
    json.dump({"src": key}, open(rec_path, "w"), indent=1)
    print(f"viewer: rollouts {os.path.getsize(srcs['rollouts.bin'])/1e6:.2f} -> {a/1e6:.2f} MB, "
          f"meshes {os.path.getsize(srcs['meshes.bin'])/1e6:.2f} -> {b/1e6:.2f} MB")


# ---------------------------------------------------------------- hero video and stills
def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width",
                          "-of", "csv=p=0", path], check=True, capture_output=True, text=True).stdout
    return int(out.strip())


def hero():
    src = os.path.join(PRIV, "montage.mp4.enc")
    plain = dec(src)
    if probe(plain) <= 1280:
        print("hero: already 720p")
        return
    out = os.path.join(TMP, "montage.small.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", plain, "-t", "20", "-vf", "scale=1280:-2", "-c:v", "libx264",
                    "-preset", "slow", "-crf", "31", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out],
                   check=True)
    before = os.path.getsize(src)
    enc(out, src)
    print(f"hero: {before/1e6:.2f} -> {os.path.getsize(src)/1e6:.2f} MB")


def still(name, width, quality):
    src = os.path.join(PRIV, name + ".enc")
    plain = dec(src)
    from PIL import Image
    im = Image.open(plain)
    if im.info.get("comment") == b"m2-fast":
        print(f"{name}: already re-encoded")
        return
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    out = os.path.join(TMP, "small_" + name)
    im.convert("RGB").save(out, "JPEG", quality=quality, optimize=True, progressive=True, comment=b"m2-fast")
    before = os.path.getsize(src)
    if os.path.getsize(out) < before:
        enc(out, src)
    print(f"{name}: {before/1e3:.0f} -> {os.path.getsize(src)/1e3:.0f} kB")


def figures():
    tot0 = tot1 = 0
    for f in sorted(os.listdir(FIGS)):
        if not f.endswith(".png"):
            continue
        png, webp = os.path.join(FIGS, f), os.path.join(FIGS, f[:-4] + ".webp")
        if not os.path.exists(webp) or os.path.getmtime(webp) < os.path.getmtime(png):
            from PIL import Image
            w = Image.open(png).width
            args = ["cwebp", "-quiet", "-q", "82", "-m", "6"] + (["-resize", "1600", "0"] if w > 1600 else [])
            subprocess.run(args + [png, "-o", webp], check=True)
        tot0 += os.path.getsize(png)
        tot1 += os.path.getsize(webp)
    print(f"figures: {tot0/1e6:.1f} MB png -> {tot1/1e6:.1f} MB webp")


if __name__ == "__main__":
    try:
        viewer()
        hero()
        still("montage.jpg", 1280, 80)
        still("objects.jpg", 1100, 76)
        figures()
    finally:
        shutil.rmtree(TMP, ignore_errors=True)

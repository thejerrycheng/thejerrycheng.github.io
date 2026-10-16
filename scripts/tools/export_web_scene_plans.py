#!/usr/bin/env python3
"""Export the four published scene plans (doorway / corner / low ceiling / ramp) for the M2 page's 3-D player.

Runs on the 5080 box, inside the Isaac venv (needs m2_isaac, pxr, fast_simplification):

    cd ~/M2/isaac && ~/isaaclab_newton/IsaacLab/.venv/bin/python <this file> --out /tmp/m2_scene_plans

It regenerates EXACTLY the layouts behind docs/figures/scene_{doorway_sofa,corner_table,low_ceiling_panel,ramp_beam}.png
(same family, level, object box and seed as the figure script; the caption is checked against the published one),
samples each SE(3) payload path every --ds metres of travel (rotation counted at the box's half-diagonal, as the
verifier does), and records per sample: the payload pose, its roll/pitch/yaw, the two robot base positions the plan
implies (one at each end of the long axis, ROBOT_STANDOFF beyond it), the floor under each, and the clearance of
the payload box and of the robot cylinders to every obstacle (same SAT / cylinder tests as verify_layout).

The payload is drawn as a REAL object from the M2 library (USD mesh), the entry whose proportions are closest to
the planned box, scaled per axis to fill that box exactly. The plan was verified for the box, so the mesh is inside
everything the clearance numbers describe.

Writes plans.json (+ meshes.bin in the viewer's scene.json mesh layout: float32 verts, then uint32 indices).
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np

from m2_isaac.assets.scenes import ObjectDims, generate
from m2_isaac.assets.scenes.layout_types import ROBOT_DUCK_HEIGHT, ROBOT_RADIUS, ROBOT_STANDOFF
from m2_isaac.assets.scenes.render import _caption
from m2_isaac.assets.scenes.se3 import euler_from_quat
from m2_isaac.assets.scenes.verify import (cylinder_vs_upright_box, obb_separation, quats_to_rotmats, sample_path,
                                           support_height)

DATA = Path(__file__).resolve().parents[1] / "source/m2_isaac/m2_isaac/assets/data"
if not DATA.exists():
    DATA = Path.home() / "M2/isaac/source/m2_isaac/m2_isaac/assets/data"

# (key, family, level, object box, seed, library family, label) -- seeds from the figure script (7 + its index)
SCENES = [
    ("doorway", "doorway", 3, ObjectDims(2.1, 0.9, 0.83, 0.415), 8, "couch", "Doorway", "sofa"),
    ("corner", "corner", 4, ObjectDims(2.4, 1.1, 0.74, 0.37), 11, "table", "Corner", "table"),
    ("low_ceiling", "low_ceiling", 4, ObjectDims(1.9, 0.09, 1.25, 0.625), 12, "panel", "Low ceiling", "panel"),
    ("ramp", "ramp", 4, ObjectDims(3.2, 0.2, 0.2, 0.45), 14, "beam", "Ramp", "beam"),
]
PUBLISHED = {
    "doorway": "doorway L3 | obj 2.1x0.9x0.83 | door 0.95x2.03 | roll 90deg | clr 0.060",
    "corner": "corner L4 | obj 2.4x1.1x0.74 | W 2.00 | turn left | clr 0.050",
    "low_ceiling": "low_ceiling L4 | obj 1.9x0.1x1.25 | W 2.40 | clear 1.35 | roll 90deg | clr 0.150",
    "ramp": "ramp L4 | obj 3.2x0.2x0.20 | ramp 8deg h0.38 up | clr 0.360",
}


def r(x, n=4):
    return [round(float(v), n) for v in np.asarray(x).ravel()]


def decimate(v, f, target):
    if len(f) <= target:
        return v, f
    import fast_simplification
    return fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), 1.0 - target / len(f))


class MeshPack:
    def __init__(self):
        self.V, self.I, self.meshes, self.nv, self.ni = [], [], [], 0, 0

    def add(self, v, f):
        v = np.asarray(v, np.float32).reshape(-1, 3); f = np.asarray(f, np.uint32).reshape(-1)
        self.meshes.append(dict(v=3 * self.nv, nv=len(v), i=self.ni, ni=len(f)))
        self.V.append(v.ravel()); self.I.append(f); self.nv += len(v); self.ni += len(f)
        return len(self.meshes) - 1

    def write(self, path):
        V = np.concatenate(self.V).astype(np.float32); I = np.concatenate(self.I).astype(np.uint32)
        Path(path).write_bytes(V.tobytes() + I.tobytes())
        return V.nbytes


def usd_parts(row):
    """visual triangles of a payload USD in its object frame, with a colour per part (diffuse or mean texture)"""
    from pxr import Usd, UsdGeom, UsdShade
    usd = DATA / row["usd"]
    if not usd.exists():
        usd = DATA / "objects" / row["usd"]
    st = Usd.Stage.Open(str(usd))
    root = st.GetDefaultPrim() or st.GetPrimAtPath("/object")
    xc = UsdGeom.XformCache()
    rinv = xc.GetLocalToWorldTransform(root).GetInverse()
    parts = []
    for p in Usd.PrimRange(root):
        if not p.IsA(UsdGeom.Mesh) or "collision" in str(p.GetPath()).lower():
            continue
        if UsdGeom.Imageable(p).ComputePurpose() == UsdGeom.Tokens.guide:
            continue
        mesh = UsdGeom.Mesh(p)
        pts = np.array(mesh.GetPointsAttr().Get() or [], np.float64)
        if not len(pts):
            continue
        M = np.array(xc.GetLocalToWorldTransform(p) * rinv)
        pts = pts @ M[:3, :3] + M[3, :3]
        cnt = np.array(mesh.GetFaceVertexCountsAttr().Get()); idx = np.array(mesh.GetFaceVertexIndicesAttr().Get())
        tris, o = [], 0
        for c in cnt:
            for j in range(1, c - 1):
                tris.append((idx[o], idx[o + j], idx[o + j + 1]))
            o += c
        color = list(row.get("color", [0.7, 0.7, 0.7]))
        try:
            mat = UsdShade.MaterialBindingAPI(p).ComputeBoundMaterial()[0]
            sh = mat.ComputeSurfaceSource()[0] if mat else None
            inp = sh.GetInput("diffuseColor") if sh else None
            if inp and inp.HasConnectedSource():
                f = inp.GetConnectedSource()[0].GetPrim().GetAttribute("inputs:file").Get()
                if f is not None:
                    from PIL import Image
                    im = np.asarray(Image.open(f.resolvedPath or str(usd.parent / f.path)).convert("RGB").resize((64, 64)), float)
                    color = (im.reshape(-1, 3).mean(0) / 255).tolist()
            elif inp and inp.Get() is not None:
                color = list(inp.Get())
        except Exception as e:  # noqa: BLE001
            print("  colour fallback", row["name"], repr(e))
        parts.append((pts, np.array(tris, np.int64), color[:3]))
    return parts


def pick_object(manifest, family, dims):
    """the library entry of this family whose L:D:H proportions are closest to the planned box"""
    want = np.log([dims.L, dims.D, dims.H])
    best = None
    for row in manifest:
        name = row["name"]
        if row.get("family") != family:
            continue
        e = np.asarray(row["extents"], float)
        if (e <= 0).any():
            continue
        lg = np.log(e)
        score = float(np.abs((lg - lg.mean()) - (want - want.mean())).sum())     # shape only; size is fitted
        if best is None or score < best[0]:
            best = (score, name, row)
    return best


def object_geoms(pack, row, dims, faces):
    parts = usd_parts(row)
    allv = np.concatenate([p for p, _, _ in parts])
    lo, hi = allv.min(0), allv.max(0)
    c, ext = 0.5 * (lo + hi), np.maximum(hi - lo, 1e-6)
    s = np.array([dims.L, dims.D, dims.H]) / ext          # fill the planned box exactly (object frame = bbox centre)
    total = sum(len(t) for _, t, _ in parts)
    ratio = min(1.0, faces / max(total, 1))
    geoms = []
    for pts, tris, color in parts:
        if not len(tris):
            continue
        v, f = decimate((pts - c) * s, tris, max(24, int(len(tris) * ratio)))
        geoms.append(dict(mesh=pack.add(v, f), rgba=r(list(color) + [1.0], 3)))
    return geoms, r(s, 4), r(ext, 4)


def export_scene(key, fam, lv, dims, seed, lib_family, label, short, manifest, pack, ds, faces):
    lay = generate(fam, np.random.default_rng(seed), lv, dims)
    cap = _caption(lay)
    assert cap.strip() == PUBLISHED[key], f"{key}: regenerated caption differs:\n  {cap}\n  {PUBLISHED[key]}"
    h = dims.half
    S = sample_path(lay.path, ds, dims.half_diagonal)
    pos, R = S[:, :3], quats_to_rotmats(S[:, 3:])
    placed = lay.placed
    obstacles = [p for p in placed if p.role == "obstacle"]
    stands = [p for p in placed if p.role == "stand"]
    ground = [p for p in placed if p.role == "ground"]
    clr_obj = np.full(len(S), 9.0)
    for pl in obstacles:
        clr_obj = np.minimum(clr_obj, obb_separation(pos, R, h, pl.pos_xyz, pl.rotmat, pl.half))
    ux = R[:, :2, 0]
    ux = ux / np.maximum(np.linalg.norm(ux, axis=1), 1e-6)[:, None]
    along = h[0] + ROBOT_STANDOFF
    robots, clr_rob = [], np.full(len(S), 9.0)
    for end in (-1.0, 1.0):
        pxy = pos[:, :2] + end * along * ux
        z0 = support_height(ground, pxy[:, 0], pxy[:, 1])
        robots.append(np.concatenate([pxy, z0[:, None]], 1))
        for pl in obstacles:
            if abs(pl.pitch) < 1e-9:
                clr_rob = np.minimum(clr_rob, cylinder_vs_upright_box(pxy, z0, ROBOT_RADIUS, ROBOT_DUCK_HEIGHT,
                                                                      pl.pos_xyz, pl.yaw, pl.half))
    eul = np.degrees(np.array([euler_from_quat(q) for q in S[:, 3:]]))        # yaw, pitch, roll (Z-Y-X)
    for j in range(3):                                                         # unwrap for plotting
        eul[:, j] = np.degrees(np.unwrap(np.radians(eul[:, j])))
    travel = np.concatenate([[0.0], np.cumsum(np.maximum(np.linalg.norm(np.diff(pos, axis=0), axis=1),
        dims.half_diagonal * 2 * np.arccos(np.clip(np.abs((S[1:, 3:] * S[:-1, 3:]).sum(1)), 0, 1))))])
    name, row = pick_object(manifest, lib_family, dims)[1:]
    geoms, scale, ext = object_geoms(pack, row, dims, faces)
    slabs = [dict(size=r(2 * p.half, 3), pos=r(p.pos_xyz, 3), quat=r(p.pose[3:], 5), role=p.role, name=p.slab.name,
                  tag=p.tag) for p in placed]
    rep = lay.verify_report
    print(f"{key}: {len(S)} samples, travel {travel[-1]:.2f} m-eq, min clr obj {clr_obj.min()*1000:.0f} mm "
          f"(report {rep.min_clearance*1000:.0f}), robots {clr_rob.min()*1000:.0f} mm, object {name} x{scale}")
    return dict(
        key=key, label=label, short=short, caption=cap, family=fam, level=lv, seed=seed,
        dims=r([dims.L, dims.D, dims.H], 3), robot=dict(radius=ROBOT_RADIUS, duck=ROBOT_DUCK_HEIGHT, standoff=ROBOT_STANDOFF),
        params={k: (float(v) if isinstance(v, (int, float, np.floating)) else v) for k, v in (lay.params or {}).items()
                if isinstance(v, (int, float, str, np.floating))},
        object=dict(name=name, family=lib_family, attribution=row.get("attribution"), license=row.get("license"),
                    extents=ext, scale=scale, geoms=geoms),
        slabs=slabs, min_clearance=round(float(rep.min_clearance), 4),
        n=len(S), travel=r(travel, 3),
        pos=r(pos, 4), quat=r(S[:, 3:], 5), euler_ypr=r(eul, 2),
        robots=[r(x, 3) for x in robots],
        clr_obj=r(clr_obj, 4), clr_rob=r(clr_rob, 4),
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/m2_scene_plans")
    ap.add_argument("--ds", type=float, default=0.03)
    ap.add_argument("--obj_faces", type=int, default=9000)
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    manifest = json.load(open(DATA / "objects" / "manifest.json"))["objects"]
    pack = MeshPack()
    scenes = [export_scene(*s, manifest, pack, a.ds, a.obj_faces) for s in SCENES]
    vbytes = pack.write(out / "meshes.bin")
    json.dump(dict(ds=a.ds, meshes=pack.meshes, vbytes=vbytes, scenes=scenes,
                   note="payload pose [x y z qw qx qy qz]; euler_ypr in degrees (Z-Y-X); clearances in metres"),
              open(out / "plans.json", "w"), separators=(",", ":"))
    print("wrote", out, (out / "meshes.bin").stat().st_size, (out / "plans.json").stat().st_size)


if __name__ == "__main__":
    main()

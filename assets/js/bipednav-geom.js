/* bipednav-geom.js — pure geometry pipeline (a port of experiments/stair_perception.py and obstacle_perception.py). No DOM. */
// ---------------------------------------------------------------- numerics
function percentile(arr, p) { const a = Float64Array.from(arr).sort(); if (!a.length) return NaN; const k = (a.length - 1) * p / 100, lo = Math.floor(k), hi = Math.ceil(k); return a[lo] + (a[hi] - a[lo]) * (k - lo); }
function median(arr) { return percentile(arr, 50); }
function norm3(v) { return Math.hypot(v[0], v[1], v[2]); }
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function unit(v) { const n = norm3(v) || 1; return [v[0] / n, v[1] / n, v[2] / n]; }
function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale3(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }

/* smallest-eigenvector of a 3x3 symmetric matrix (plane normal by PCA) via Jacobi rotations */
function smallestEigvec(S) {
  let A = S.map((r) => r.slice()), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let it = 0; it < 30; it++) {
    let p = 0, q = 1, mx = Math.abs(A[0][1]);
    if (Math.abs(A[0][2]) > mx) { p = 0; q = 2; mx = Math.abs(A[0][2]); }
    if (Math.abs(A[1][2]) > mx) { p = 1; q = 2; mx = Math.abs(A[1][2]); }
    if (mx < 1e-12) break;
    const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]), c = Math.cos(th), s = Math.sin(th);
    for (let k = 0; k < 3; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
    for (let k = 0; k < 3; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
    for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
  }
  let i = 0; if (A[1][1] < A[i][i]) i = 1; if (A[2][2] < A[i][i]) i = 2;
  return [V[0][i], V[1][i], V[2][i]];
}
function planeNormal(P, idx) {
  let c = [0, 0, 0]; for (const i of idx) { c[0] += P[3 * i]; c[1] += P[3 * i + 1]; c[2] += P[3 * i + 2]; } c = scale3(c, 1 / idx.length);
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const i of idx) { const d = [P[3 * i] - c[0], P[3 * i + 1] - c[1], P[3 * i + 2] - c[2]]; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) S[a][b] += d[a] * d[b]; }
  return { n: unit(smallestEigvec(S)), c };
}

/* organised cloud (H x W x 3, Float32 flat) -> subsampled points + normals (central differences) */
function gridNormals(P, W, H, k = 2, stride = 2) {
  const pts = [], nrm = [], pix = [];
  for (let v = k; v < H - k; v += stride) for (let u = k; u < W - k; u += stride) {
    const i = v * W + u, il = i - k, ir = i + k, iu = i - k * W, id = i + k * W;
    const z = P[3 * i + 2]; if (!(z > 0.05)) continue;
    if (!(P[3 * il + 2] > 0) || !(P[3 * ir + 2] > 0) || !(P[3 * iu + 2] > 0) || !(P[3 * id + 2] > 0)) continue;
    const dx = [P[3 * ir] - P[3 * il], P[3 * ir + 1] - P[3 * il + 1], P[3 * ir + 2] - P[3 * il + 2]];
    const dy = [P[3 * id] - P[3 * iu], P[3 * id + 1] - P[3 * iu + 1], P[3 * id + 2] - P[3 * iu + 2]];
    if (norm3(dx) > 0.08 * (1 + z) || norm3(dy) > 0.08 * (1 + z)) continue;    // depth discontinuity
    let n = cross3(dx, dy); const nn = norm3(n); if (nn < 1e-9) continue; n = scale3(n, 1 / nn);
    const p = [P[3 * i], P[3 * i + 1], z];
    if (dot3(n, p) > 0) n = scale3(n, -1);          // toward the camera
    pts.push(p); nrm.push(n); pix.push([u, v]);
  }
  return { pts, nrm, pix };
}

/* spherical histogram modes of the normals (4 deg bins), refined as cone means */
function sphereModes(nrm, binDeg = 4, coneDeg = 18, maxModes = 8, minCount = 60) {
  const nb = Math.round(360 / binDeg), ne = Math.round(180 / binDeg), Hh = new Int32Array(nb * ne);
  for (const n of nrm) {
    const az = Math.atan2(n[0], -n[2]) * 180 / Math.PI, el = Math.asin(Math.max(-1, Math.min(1, n[1]))) * 180 / Math.PI;
    const i = Math.min(nb - 1, Math.floor((az + 180) / binDeg)), j = Math.min(ne - 1, Math.floor((el + 90) / binDeg));
    Hh[i * ne + j]++;
  }
  const order = Array.from(Hh.keys()).sort((a, b) => Hh[b] - Hh[a]).slice(0, 300);
  const modes = [], cosC = Math.cos(coneDeg * Math.PI / 180);
  for (const flat of order) {
    const i = Math.floor(flat / ne), j = flat % ne;
    const a = ((i + 0.5) * binDeg - 180) * Math.PI / 180, e = ((j + 0.5) * binDeg - 90) * Math.PI / 180;
    let v = [Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a)];
    if (modes.some((m) => Math.abs(dot3(m.v, v)) > Math.cos(40 * Math.PI / 180))) continue;
    for (let pass = 0; pass < 2; pass++) {
      let s = [0, 0, 0], cnt = 0;
      for (const n of nrm) if (dot3(n, v) > cosC) { s[0] += n[0]; s[1] += n[1]; s[2] += n[2]; cnt++; }
      if (cnt < minCount) { v = null; break; }
      v = unit(s); var count = cnt;
    }
    if (!v) continue;
    modes.push({ v, count });
    if (modes.length >= maxModes) break;
  }
  return modes;
}

/* 1-D offset clusters: histogram + gaussian smoothing + peaks */
function offsetClusters(o, bin = 0.005, sigmaBins = 2, minSep = 0.07, minFrac = 0.15) {
  if (o.length < 50) return { centres: [], counts: [] };
  let lo = Infinity, hi = -Infinity; for (const x of o) { if (x < lo) lo = x; if (x > hi) hi = x; }
  const nbin = Math.max(3, Math.ceil((hi - lo) / bin) + 3), h = new Float64Array(nbin);
  for (const x of o) h[Math.min(nbin - 1, Math.floor((x - lo) / bin) + 1)]++;
  const g = [], r = Math.ceil(3 * sigmaBins); for (let i = -r; i <= r; i++) g.push(Math.exp(-0.5 * (i / sigmaBins) ** 2));
  const hs = new Float64Array(nbin); for (let i = 0; i < nbin; i++) { let s = 0, w = 0; for (let k = -r; k <= r; k++) { const j = i + k; if (j >= 0 && j < nbin) { s += h[j] * g[k + r]; w += g[k + r]; } } hs[i] = s / w * g.reduce((a, b) => a + b, 0) / 1; }
  let mx = 0; for (const x of hs) mx = Math.max(mx, x);
  const dist = Math.max(1, Math.round(minSep / bin)), peaks = [];
  for (let i = 1; i < nbin - 1; i++) if (hs[i] >= hs[i - 1] && hs[i] > hs[i + 1] && hs[i] >= minFrac * mx) peaks.push(i);
  // enforce minimum separation, keep the taller
  peaks.sort((a, b) => hs[b] - hs[a]); const kept = [];
  for (const p of peaks) if (kept.every((q) => Math.abs(q - p) >= dist)) kept.push(p);
  kept.sort((a, b) => a - b);
  const centres = [], counts = [];
  for (const p of kept) { const c0 = lo + (p - 1 + 0.5) * bin; let s = 0, c = 0; for (const x of o) if (Math.abs(x - c0) < 0.015) { s += x; c++; } centres.push(c ? s / c : c0); counts.push(hs[p]); }
  return { centres, counts };
}
function latticeSpacing(centres, lo = 0.06, hi = 0.45) {
  if (centres.length < 2) return { h: NaN, gaps: [] };
  const gaps = []; for (let i = 1; i < centres.length; i++) gaps.push(centres[i] - centres[i - 1]);
  const good = gaps.filter((g) => g > lo && g < hi); if (!good.length) return { h: NaN, gaps };
  const h0 = median(good);
  const k = centres.map((c) => Math.round((c - centres[0]) / h0)); const uk = new Set(k);
  if (uk.size >= 2) { let sk = 0, sc = 0, skk = 0, skc = 0, n = k.length; for (let i = 0; i < n; i++) { sk += k[i]; sc += centres[i]; skk += k[i] * k[i]; skc += k[i] * centres[i]; } const hf = (n * skc - sk * sc) / (n * skk - sk * sk); if (hf > lo && hf < hi) return { h: hf, gaps: good }; }
  return { h: h0, gaps: good };
}

// ---------------------------------------------------------------- geometry pipeline
function backproject(depth, W, H, fx, fy, cx, cy) {
  const P = new Float32Array(W * H * 3);
  for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) { const i = v * W + u, z = depth[i]; P[3 * i] = (u - cx) * z / fx; P[3 * i + 1] = (v - cy) * z / fy; P[3 * i + 2] = z; }
  return P;
}
function upAxis(nrm) {
  const modes = sphereModes(nrm);
  let cands = modes.filter((m) => m.v[1] < -0.2); if (!cands.length) cands = [modes.reduce((a, b) => (a.v[1] < b.v[1] ? a : b))];
  let up = cands.reduce((a, b) => (a.count >= b.count ? a : b)).v; if (up[1] > 0) up = scale3(up, -1);
  return { up, modes };
}
function stairPipeline(pts, nrm) {
  let { up, modes } = upAxis(nrm);
  const cos15 = Math.cos(15 * Math.PI / 180);
  // refine 'up' with a shrinking slab on the most populated tread cluster
  for (const slab of [0.04, 0.025, 0.015]) {
    const idx = []; for (let i = 0; i < pts.length; i++) if (dot3(nrm[i], up) > cos15) idx.push(i);
    const off = idx.map((i) => dot3(pts[i], up)); const { centres, counts } = offsetClusters(off);
    if (!centres.length) break;
    let bi = 0; for (let i = 1; i < counts.length; i++) if (counts[i] > counts[bi]) bi = i;
    const sel = idx.filter((i, j) => Math.abs(off[j] - centres[bi]) < slab);
    if (sel.length > 200) { const flat = new Float32Array(pts.length * 3); for (let i = 0; i < pts.length; i++) { flat[3 * i] = pts[i][0]; flat[3 * i + 1] = pts[i][1]; flat[3 * i + 2] = pts[i][2]; } let { n } = planeNormal(flat, sel); if (dot3(n, up) < 0) n = scale3(n, -1); up = n; }
  }
  let fwd = unit(sub3([0, 0, 1], scale3(up, up[2])));
  const riserMode = modes.filter((m) => Math.abs(dot3(m.v, up)) < Math.cos(70 * Math.PI / 180) && dot3(m.v, scale3(fwd, -1)) > Math.cos(30 * Math.PI / 180)).sort((a, b) => b.count - a.count)[0];
  if (riserMode) { let back = unit(sub3(riserMode.v, scale3(up, dot3(riserMode.v, up)))); fwd = scale3(back, -1); }
  const tread = [], riser = [], cos20 = Math.cos(20 * Math.PI / 180);
  for (let i = 0; i < pts.length; i++) { if (dot3(nrm[i], up) > cos15) tread.push(i); else if (riserMode && dot3(nrm[i], scale3(fwd, -1)) > cos20) riser.push(i); }
  const tOff = offsetClusters(tread.map((i) => dot3(pts[i], up))).centres;
  const rOff = riserMode ? offsetClusters(riser.map((i) => dot3(pts[i], fwd))).centres : [];
  const rise = latticeSpacing(tOff).h;
  let run = latticeSpacing(rOff, 0.15, 0.6).h, runNote = "run from risers";
  if (!(run > 0)) {   // tread front edges
    const lat = cross3(up, fwd), latMed = median(tread.map((i) => dot3(pts[i], lat)));
    const edges = [];
    for (const c of tOff) { const s = []; for (const i of tread) if (Math.abs(dot3(pts[i], up) - c) < 0.02 && Math.abs(dot3(pts[i], lat) - latMed) < 0.35) s.push(dot3(pts[i], fwd)); if (s.length > 40) edges.push(percentile(s, 5)); }
    run = latticeSpacing(edges.sort((a, b) => a - b), 0.15, 0.6).h; runNote = "run from tread front edges";
  }
  const pitch = Math.atan2(-up[2], -up[1]) * 180 / Math.PI;
  return { up, fwd, tread, riser, tOff, rOff, rise, run, runNote, camPitch: pitch, nTreads: tOff.length, nRisers: rOff.length };
}
function obstaclePipeline(pts, nrm, corridor = 0.35) {
  let { up } = upAxis(nrm);
  const cos15 = Math.cos(15 * Math.PI / 180);
  const treadIdx = []; for (let i = 0; i < pts.length; i++) if (dot3(nrm[i], up) > cos15) treadIdx.push(i);
  const { centres, counts } = offsetClusters(treadIdx.map((i) => dot3(pts[i], up)), 0.005, 2, 0.07, 0.10);
  if (!centres.length) return { found: false, note: "no floor" };
  const cmax = Math.max(...counts); let floorC = Infinity; for (let i = 0; i < centres.length; i++) if (counts[i] >= 0.25 * cmax && centres[i] < floorC) floorC = centres[i];
  const sel = treadIdx.filter((i) => Math.abs(dot3(pts[i], up) - floorC) < 0.03);
  if (sel.length > 200) { const flat = new Float32Array(pts.length * 3); for (let i = 0; i < pts.length; i++) { flat[3 * i] = pts[i][0]; flat[3 * i + 1] = pts[i][1]; flat[3 * i + 2] = pts[i][2]; } let { n } = planeNormal(flat, sel); if (dot3(n, up) < 0) n = scale3(n, -1); up = n; floorC = median(sel.map((i) => dot3(pts[i], up))); }
  const fwd = unit(sub3([0, 0, 1], scale3(up, up[2]))), lat = cross3(up, fwd), latMed = median(sel.map((i) => dot3(pts[i], lat)));
  const cand = [];
  for (let i = 0; i < pts.length; i++) { const h = dot3(pts[i], up) - floorC, f = dot3(pts[i], fwd), l = dot3(pts[i], lat) - latMed; if (h > 0.03 && h < 0.6 && Math.abs(l) < corridor && f > 0.2) cand.push({ i, h, f, l, top: dot3(nrm[i], up) > cos15 }); }
  const camH = -floorC, camPitch = Math.atan2(-up[2], -up[1]) * 180 / Math.PI;
  if (cand.length < 30) return { found: false, note: "no obstacle in the corridor", camH, camPitch, up, fwd, floorC, floorIdx: sel };
  cand.sort((a, b) => a.f - b.f);
  let end = cand.length; for (let i = 1; i < cand.length; i++) if (cand[i].f - cand[i - 1].f > 0.15) { end = i; break; }
  let cl = cand.slice(0, end); if (cl.length < 30) return { found: false, note: "first cluster too small", camH, camPitch, up, fwd, floorC, floorIdx: sel };
  let note = "ok", plateaus = 0;
  const top = cl.filter((c) => c.top);
  if (top.length >= 30) { const pl = offsetClusters(top.map((c) => c.h), 0.005, 2, 0.05, 0.20).centres; plateaus = pl.length; if (pl.length >= 2) { cl = cl.filter((c) => c.h <= pl[0] + 0.03); note = `first of ${pl.length} plateaus (stair-like)`; } }
  const dist = percentile(cl.map((c) => c.f), 3); const tp = cl.filter((c) => c.top);
  let depth, height;
  if (tp.length >= 20) { const ft = tp.map((c) => c.f); depth = percentile(ft, 97) - Math.min(dist, percentile(ft, 3)); height = percentile(tp.map((c) => c.h), 90); }
  else { depth = percentile(cl.map((c) => c.f), 97) - dist; height = percentile(cl.map((c) => c.h), 95); }
  return { found: true, dist, depth, height, camH, camPitch, up, fwd, floorC, floorIdx: sel, obsIdx: cl.map((c) => c.i), note, plateaus };
}

/* metric scale: choose the inverse-depth shift so the dominant up-facing surface is flat, then scale by the camera height */
function metricCloud(disp, W, H, fx, fy, cx, cy, camH) {
  let dmin = Infinity, dmax = -Infinity; for (const d of disp) { if (d < dmin) dmin = d; if (d > dmax) dmax = d; }
  const range = dmax - dmin; let best = null;
  const coarse = [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.65, 0.8, 1.0];   // shifts beyond one disparity range flatten the scene: excluded
  const evalK = (k) => {
    const b = dmin - k * range, z = new Float32Array(disp.length);
    for (let i = 0; i < disp.length; i++) { const dd = disp[i] - b; z[i] = dd > 1e-6 ? 1 / dd : 0; }
    const zm = median(Array.from(z).filter((x) => x > 0)); if (!(zm > 0)) return;
    for (let i = 0; i < z.length; i++) z[i] = z[i] / zm * 2.0;             // provisional scale: median depth 2 m
    const P = backproject(z, W, H, fx, fy, cx, cy); const { pts, nrm } = gridNormals(P, W, H, 2, 3);
    if (pts.length < 300) return;
    const { up } = upAxis(nrm); const cos15 = Math.cos(15 * Math.PI / 180), cos25 = Math.cos(25 * Math.PI / 180);
    const idx = []; for (let i = 0; i < pts.length; i++) if (dot3(nrm[i], up) > cos25) idx.push(i);
    if (idx.length < 100) return;
    const off = idx.map((i) => dot3(pts[i], up)); const { centres, counts } = offsetClusters(off, 0.01, 2, 0.08, 0.10);
    if (!centres.length) return;
    let bi = 0; for (let i = 1; i < counts.length; i++) if (counts[i] > counts[bi]) bi = i;
    // criterion 1: the up-facing normals of the largest surface must agree (a wrong shift bends the floor)
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (let j = 0; j < idx.length; j++) if (Math.abs(off[j] - centres[bi]) < 0.06) { const v = nrm[idx[j]]; sx += v[0]; sy += v[1]; sz += v[2]; n++; }
    if (n < 60) return;
    const mean = unit([sx, sy, sz]); let spread = 0;
    for (let j = 0; j < idx.length; j++) if (Math.abs(off[j] - centres[bi]) < 0.06) spread += Math.acos(Math.min(1, Math.max(-1, dot3(nrm[idx[j]], mean))));
    spread /= n;
    // criterion 2: up-facing points collapse onto sharp offset peaks (treads / floor) when the shift is right
    let near = 0; for (const o of off) { let best_d = Infinity; for (const c of centres) best_d = Math.min(best_d, Math.abs(o - c)); if (best_d < 0.02) near++; }
    const sharp = 1 - near / off.length;
    const mu = centres[bi];
    const score = spread + 0.6 * sharp;
    if (!best || score < best.score) best = { score, b, k, planeDist: Math.abs(mu), zm, up };
  };
  for (const k of coarse) evalK(k);
  if (best) {                                   // refine around the best coarse shift
    const i = coarse.indexOf(best.k), lo = coarse[Math.max(0, i - 1)], hi = coarse[Math.min(coarse.length - 1, i + 1)];
    for (let j = 1; j <= 6; j++) evalK(lo + (hi - lo) * j / 7);
  }
  if (!best) throw new Error("could not find a flat reference surface");
  const z = new Float32Array(disp.length);
  const s = camH / best.planeDist * (2.0 / best.zm);
  for (let i = 0; i < disp.length; i++) { const dd = disp[i] - best.b; z[i] = dd > 1e-6 ? s / dd : 0; }
  return { z, shiftFrac: best.k, score: best.score };
}


export { percentile, median, backproject, gridNormals, sphereModes, offsetClusters, latticeSpacing, upAxis, stairPipeline, obstaclePipeline, metricCloud, dot3, cross3, unit, sub3, scale3 };

/* =============================================================================
   aerohaptix_cbf.js — MultiCBF in the browser: the exponential control barrier
   functions of the AeroHaptix study (super-ellipsoids for cubes and spheres, a
   2-D super-ellipse for pillars, half-spaces for the tunnel walls), the exact
   global safe input (QP in R^3 by active-set enumeration), the per-obstacle
   local safe inputs and the cue-rendering rule (actuator = most aligned
   direction, duty = clip(K_v |u_ref - u_safe,i|, 0, 15), two strongest kept).
   A line-by-line port of experiments/aerohaptix/{cbf,suit,world}.py.
   ============================================================================= */
export const PARAMS = { k1: 6, k2: 6, pad: 0.717, range: 5, Kv: 3, maxDuty: 15, keep: 2, vmax: 5, dt: 0.02, tauDrone: 0.25, rDrone: 0.35, length: 50, width: 5 };

export const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  norm: (a) => Math.hypot(a[0], a[1], a[2]),
  unit: (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1e-12; return [a[0] / n, a[1] / n, a[2] / n]; },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  clone: (a) => [a[0], a[1], a[2]],
};

export class SuperEllipsoid {
  constructor(center, size, kind, pad = PARAMS.pad, gains = [PARAMS.k1, PARAMS.k2]) {
    this.c = V.clone(center); this.size = size; this.kind = kind; this.n = kind === 'cube' ? 4 : 2;
    this.a = size + pad; this.half = size / 2; this.k1 = gains[0]; this.k2 = gains[1];
  }
  h(q) { let s = 0; for (let i = 0; i < 3; i++) s += Math.pow((q[i] - this.c[i]) / this.a, this.n); return s - 1; }
  grad(q) { const g = [0, 0, 0]; for (let i = 0; i < 3; i++) g[i] = this.n * Math.pow((q[i] - this.c[i]) / this.a, this.n - 1) / this.a; return g; }
  curv(q, v) { let s = 0; for (let i = 0; i < 3; i++) s += this.n * (this.n - 1) * Math.pow((q[i] - this.c[i]) / this.a, this.n - 2) * v[i] * v[i] / (this.a * this.a); return s; }
  constraint(q, v) { const A = this.grad(q); return [A, this.curv(q, v) + this.k2 * V.dot(A, v) + this.k1 * this.h(q)]; }
  inRange(q) { return V.norm(V.sub(q, this.c)) < this.a + PARAMS.range; }
  direction(q) { return V.unit(V.sub(this.c, q)); }
  signedDistance(q) {
    const d = V.sub(q, this.c);
    if (this.kind === 'cube') {
      const e = d.map(x => Math.abs(x) - this.half), out = e.map(x => Math.max(x, 0)), dist = V.norm(out);
      if (dist > 0) return [dist, [Math.sign(d[0]) * out[0] / dist, Math.sign(d[1]) * out[1] / dist, Math.sign(d[2]) * out[2] / dist]];
      let i = 0; for (let k = 1; k < 3; k++) if (e[k] > e[i]) i = k;
      const n = [0, 0, 0]; n[i] = d[i] !== 0 ? Math.sign(d[i]) : 1; return [e[i], n];
    }
    const r = V.norm(d); return [r - this.half, V.scale(d, 1 / (r + 1e-12))];
  }
}

export class Cylinder {
  constructor(center, size, axis, pad = PARAMS.pad, gains = [PARAMS.k1, PARAMS.k2]) {
    this.c = V.clone(center); this.size = size; this.kind = 'cylinder'; this.axis = axis; this.idx = [0, 1, 2].filter(i => i !== axis);
    this.n = 2; this.a = size + pad; this.half = size / 2; this.k1 = gains[0]; this.k2 = gains[1];
  }
  h(q) { let s = 0; for (const i of this.idx) s += Math.pow((q[i] - this.c[i]) / this.a, 2); return s - 1; }
  grad(q) { const g = [0, 0, 0]; for (const i of this.idx) g[i] = 2 * (q[i] - this.c[i]) / (this.a * this.a); return g; }
  curv(q, v) { let s = 0; for (const i of this.idx) s += 2 * v[i] * v[i] / (this.a * this.a); return s; }
  constraint(q, v) { const A = this.grad(q); return [A, this.curv(q, v) + this.k2 * V.dot(A, v) + this.k1 * this.h(q)]; }
  inRange(q) { const [i, j] = this.idx; return Math.hypot(q[i] - this.c[i], q[j] - this.c[j]) < this.a + PARAMS.range; }
  direction(q) { const d = [0, 0, 0]; for (const i of this.idx) d[i] = this.c[i] - q[i]; return V.unit(d); }
  signedDistance(q) { const d = [0, 0, 0]; for (const i of this.idx) d[i] = q[i] - this.c[i]; const r = V.norm(d); return [r - this.half, V.scale(d, 1 / (r + 1e-12))]; }
}

export class Plane {
  constructor(point, normal, name, gains = [PARAMS.k1, PARAMS.k2]) { this.p = V.clone(point); this.nrm = V.unit(normal); this.kind = 'plane'; this.name = name; this.k1 = gains[0]; this.k2 = gains[1]; }
  h(q) { return V.dot(this.nrm, V.sub(q, this.p)); }
  grad() { return V.clone(this.nrm); }
  curv() { return 0; }
  constraint(q, v) { return [V.clone(this.nrm), this.k2 * V.dot(this.nrm, v) + this.k1 * this.h(q)]; }
  inRange() { return true; }
  direction() { return V.scale(this.nrm, -1); }
  signedDistance(q) { return [this.h(q), V.clone(this.nrm)]; }
}

/* ---- safe inputs ---- */
export function localSafe(u, A, b) {
  const s = V.dot(A, u) + b;
  if (s >= 0) return V.clone(u);
  return V.sub(u, V.scale(A, s / V.dot(A, A)));
}

function solveSmall(G, r) {                       /* Gaussian elimination, n <= 3; null if singular */
  const n = r.length, M = G.map((row, i) => [...row, r[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
    if (Math.abs(M[p][c]) < 1e-10) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let i = 0; i < n; i++) { if (i === c) continue; const f = M[i][c] / M[c][c]; for (let j = c; j <= n; j++) M[i][j] -= f * M[c][j]; }
  }
  return M.map((row, i) => row[n] / row[i]);
}

function* combos(arr, r, start = 0, acc = []) {
  if (acc.length === r) { yield acc.slice(); return; }
  for (let i = start; i < arr.length; i++) { acc.push(arr[i]); yield* combos(arr, r, i + 1, acc); acc.pop(); }
}

function enumerate(u, A, b, rows) {
  const out = [];
  for (let r = 1; r <= Math.min(3, rows.length); r++) {
    for (const combo of combos(rows, r)) {
      const Ac = combo.map(i => A[i]);
      const G = Ac.map(ai => Ac.map(aj => V.dot(ai, aj)));
      const rhs = combo.map(i => -(V.dot(A[i], u) + b[i]));
      const lam = solveSmall(G, rhs);
      if (!lam) continue;
      let uu = V.clone(u); Ac.forEach((ai, k) => { uu = V.add(uu, V.scale(ai, lam[k])); });
      out.push(uu);
    }
  }
  return out;
}

export function globalSafe(u, A, b, tol = 1e-7) {
  const m = b.length;
  if (m === 0) return { u: V.clone(u), ok: true };
  const s0 = A.map((ai, i) => V.dot(ai, u) + b[i]);
  if (s0.every(s => s >= -tol)) return { u: V.clone(u), ok: true };
  let work = new Set(s0.map((s, i) => s < -tol ? i : -1).filter(i => i >= 0));
  let R = null, cands = [];
  for (let round = 0; round < 8; round++) {
    cands = enumerate(u, A, b, [...work].sort((x, y) => x - y));
    const newRows = new Set();
    for (const c of cands) {
      const bad = A.map((ai, i) => V.dot(ai, c) + b[i] < -tol ? i : -1).filter(i => i >= 0);
      if (bad.length === 0) { const d = V.norm(V.sub(c, u)); R = R === null ? d : Math.min(R, d); } else bad.forEach(i => newRows.add(i));
    }
    const grow = [...newRows].some(i => !work.has(i));
    if (R !== null || !grow) break;
    newRows.forEach(i => work.add(i));
  }
  if (R === null) {
    if (!cands.length) return { u: V.clone(u), ok: false };
    let best = null, bv = Infinity;
    for (const c of cands) { let viol = 0; A.forEach((ai, i) => { const s = V.dot(ai, c) + b[i]; if (s < 0) viol += s * s; }); if (viol < bv) { bv = viol; best = c; } }
    return { u: best, ok: false };
  }
  const keep = s0.map((s, i) => s <= V.norm(A[i]) * R + 1e-9 ? i : -1).filter(i => i >= 0);
  let best = null, bd = Infinity;
  for (const c of enumerate(u, A, b, keep)) {
    if (A.every((ai, i) => V.dot(ai, c) + b[i] >= -tol)) { const d = V.norm(V.sub(c, u)); if (d < bd) { bd = d; best = c; } }
  }
  return { u: best, ok: true };
}

/* ---- layouts and cues ---- */
export function makeLayout(json) {
  const dirs = json.dirs.map(d => V.unit(d));
  return { name: json.name, ids: json.ids, chains: json.chains, dirs, theta: json.theta_deg, phi: json.phi_deg, n: dirs.length };
}
export function selectActuator(dirs, d) {
  let m = -Infinity; const s = dirs.map(r => V.dot(r, d));
  for (const x of s) if (x > m) m = x;
  const idx = []; s.forEach((x, i) => { if (x >= m - 1e-9) idx.push(i); });
  return { idx, errDeg: Math.acos(Math.max(-1, Math.min(1, m))) * 180 / Math.PI };
}
export function renderCues(q, v, uRef, constraints, layout, opts = {}) {
  const Kv = opts.Kv ?? PARAMS.Kv, maxDuty = opts.maxDuty ?? PARAMS.maxDuty, keep = opts.keep ?? PARAMS.keep;
  const cues = [];
  constraints.forEach((obs, i) => {
    if (!obs.inRange(q)) return;
    const [A, b] = obs.constraint(q, v);
    const s = V.dot(A, uRef) + b;
    if (s >= 0) return;
    const ui = localSafe(uRef, A, b);
    const duty = Math.floor(Math.max(0, Math.min(maxDuty, Kv * V.norm(V.sub(uRef, ui)))));
    if (duty < 1) return;
    const dir = obs.direction(q);
    const sel = layout ? selectActuator(layout.dirs, dir) : { idx: [], errDeg: 0 };
    cues.push({ obs: i, duty, act: sel.idx, dir, errDeg: sel.errDeg, uLocal: ui, s, A, b });
  });
  const duties = new Map();
  for (const c of cues) for (const k of c.act) duties.set(k, Math.max(duties.get(k) || 0, c.duty));
  let active = [...duties.entries()];
  if (keep !== null && active.length > keep) active = active.sort((x, y) => y[1] - x[1]).slice(0, keep);
  active.sort((x, y) => x[0] - y[0]);
  return { cues, active };
}

/* ---- tunnels ---- */
const AXES = { forward: [0, 1, 2], right: [1, 0, 2], upward: [2, 0, 1] };
function unitAxis(i) { const a = [0, 0, 0]; a[i] = 1; return a; }

export function tunnelFromJson(tj) {
  const [ti, s1i, s2i] = [tj.axes.travel, tj.axes.side, tj.axes.other];
  const T = { direction: tj.direction, seed: tj.seed, length: tj.length, width: tj.width, tAxis: ti, s1Axis: s1i, s2Axis: s2i,
    t: unitAxis(ti), s1: unitAxis(s1i), s2: unitAxis(s2i), spec: tj.obstacles, obstacles: [], walls: [] };
  for (const o of tj.obstacles) T.obstacles.push(o.kind === 'cylinder' ? new Cylinder(o.center, o.size, o.axis, tj.pad) : new SuperEllipsoid(o.center, o.size, o.kind, tj.pad));
  for (const w of tj.walls) T.walls.push(new Plane(w.point, w.normal, w.name));
  T.constraints = [...T.obstacles, ...T.walls];
  return T;
}

function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function randomTunnel(direction, seed, nObs = 15) {
  /* the JS twin of world.Tunnel (its own PRNG, so its tunnels differ from the Python ones) */
  const rng = mulberry32(1000 + seed);
  const [ti, s1i, s2i] = AXES[direction];
  const length = PARAMS.length, width = PARAMS.width, t = unitAxis(ti), s1 = unitAxis(s1i), s2 = unitAxis(s2i);
  const kinds = []; for (let k = 0; k < nObs; k++) kinds.push(['cube', 'sphere', 'cylinder'][k % 3]);
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const t0 = 5, t1 = length - 3, gap = 2.5, slack = (t1 - t0) - gap * (nObs - 1);
  const parts = []; let sum = 0; for (let k = 0; k <= nObs; k++) { const e = -Math.log(rng() + 1e-12); parts.push(e); sum += e; }
  for (let k = 0; k <= nObs; k++) parts[k] = parts[k] / sum * slack;
  const spec = [], obstacles = [];
  let pos = t0 + parts[0];
  for (let k = 0; k < nObs; k++) {
    if (k > 0) pos += gap + parts[k];
    const size = 0.8 + rng() * 1.0, o1 = -1.6 + 3.2 * rng(), o2 = -1.6 + 3.2 * rng();
    let c = V.add(V.add(V.scale(t, pos), V.scale(s1, o1)), V.scale(s2, kinds[k] === 'cylinder' ? 0 : o2));
    spec.push({ kind: kinds[k], center: c, size, axis: kinds[k] === 'cylinder' ? s2i : null });
    obstacles.push(kinds[k] === 'cylinder' ? new Cylinder(c, size, s2i) : new SuperEllipsoid(c, size, kinds[k]));
  }
  const hw = width / 2;
  const walls = [new Plane(V.scale(s1, -hw), s1, 'wall-'), new Plane(V.scale(s1, hw), V.scale(s1, -1), 'wall+'), new Plane(V.scale(s2, -hw), s2, 'floor'), new Plane(V.scale(s2, hw), V.scale(s2, -1), 'ceiling')];
  return { direction, seed, length, width, tAxis: ti, s1Axis: s1i, s2Axis: s2i, t, s1, s2, spec, obstacles, walls, constraints: [...obstacles, ...walls],
    toJson() { return { direction, seed, length, width, axes: { travel: ti, side: s1i, other: s2i }, pad: PARAMS.pad, obstacles: spec, walls: walls.map(w => ({ name: w.name, point: w.p, normal: w.nrm })) }; } };
}

export function contacts(T, q, r) {
  const out = [];
  T.obstacles.forEach((o, i) => { const [d, n] = o.signedDistance(q); if (d < r) out.push({ name: o.kind, index: i, n, depth: r - d }); });
  T.walls.forEach((w, j) => { const [d, n] = w.signedDistance(q); if (d < r) out.push({ name: w.name, index: T.obstacles.length + j, n, depth: r - d }); });
  return out;
}
export const progress = (T, q) => V.dot(q, T.t);

/* ---- the torso model (same tables as suit.py) and the 2-D body map ---- */
const TZ = [-0.36, -0.25, -0.12, 0.00, 0.12, 0.24, 0.34], TW = [0.155, 0.150, 0.160, 0.172, 0.185, 0.205, 0.195], TD = [0.105, 0.108, 0.115, 0.120, 0.122, 0.118, 0.105];
export const TORSO = { top: 0.34, bottom: -0.36, n: 2.5 };
function interp(z, xs, ys) { if (z <= xs[0]) return ys[0]; for (let i = 1; i < xs.length; i++) if (z <= xs[i]) { const f = (z - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + f * (ys[i] - ys[i - 1]); } return ys[ys.length - 1]; }
export function torsoRadii(z) { z = Math.max(TORSO.bottom, Math.min(TORSO.top, z)); return [interp(z, TZ, TW), interp(z, TZ, TD)]; }
function torsoInside(p) { if (p[2] > TORSO.top || p[2] < TORSO.bottom) return false; const [w, d] = torsoRadii(p[2]); return Math.pow(Math.abs(p[0]) / d, TORSO.n) + Math.pow(Math.abs(p[1]) / w, TORSO.n) <= 1; }
export function torsoPoint(dir, origin = [0, 0, -0.02]) {
  const d = V.unit(dir); let lo = 0, hi = 1;
  for (let k = 0; k < 40; k++) { const mid = 0.5 * (lo + hi); if (torsoInside(V.add(origin, V.scale(d, mid)))) lo = mid; else hi = mid; }
  const p = V.add(origin, V.scale(d, lo));
  const z = Math.min(Math.max(p[2] * 2.8, TORSO.bottom + 0.005), TORSO.top - 0.005);
  const [w, dd] = torsoRadii(z);
  const r = Math.hypot(p[0], p[1]);
  if (r < 1e-9) return [d[0] >= 0 ? dd : -dd, 0, z];
  const scale = Math.pow(Math.pow(Math.abs(p[0]) / dd, TORSO.n) + Math.pow(Math.abs(p[1]) / w, TORSO.n), -1 / TORSO.n);
  return [p[0] * scale, p[1] * scale, z];
}
export function bodyPositions(layout) { return layout.dirs.map(d => torsoPoint(d)); }
export function torsoOutline(n = 40) {
  const pts = [];
  for (let i = 0; i < n; i++) { const z = TORSO.bottom + (TORSO.top - TORSO.bottom) * i / (n - 1); pts.push([torsoRadii(z)[0], z]); }
  pts.push([0.06, TORSO.top], [0.06, TORSO.top + 0.05], [-0.06, TORSO.top + 0.05], [-0.06, TORSO.top]);
  for (let i = n - 1; i >= 0; i--) { const z = TORSO.bottom + (TORSO.top - TORSO.bottom) * i / (n - 1); pts.push([-torsoRadii(z)[0], z]); }
  return pts;
}

/** Front/back body map as an inline SVG. Returns { setActive(active), setHover(i) }. */
export function buildBodyMap(container, layout, opts = {}) {
  const P = bodyPositions(layout);
  const scale = opts.scale || 260, pad = 0.09;
  const W = (1.35 + 2 * pad) * scale, H = (TORSO.top - TORSO.bottom + 0.34) * scale;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'ah-bodymap');
  const toXY = (x, z, view) => [((view === 'front' ? 0.3 : 1.05) + x + pad) * scale, (TORSO.top + 0.22 - z) * scale];
  const dots = [];
  for (const view of ['front', 'back']) {
    const outline = torsoOutline().map(([x, z]) => toXY(view === 'front' ? x : x, z, view));
    const path = document.createElementNS(ns, 'path'); path.setAttribute('d', 'M' + outline.map(p => p.join(',')).join('L') + 'Z'); path.setAttribute('class', 'ah-torso'); svg.appendChild(path);
    const head = document.createElementNS(ns, 'circle'); const [hx, hy] = toXY(0, TORSO.top + 0.10, view); head.setAttribute('cx', hx); head.setAttribute('cy', hy); head.setAttribute('r', 0.055 * scale); head.setAttribute('class', 'ah-torso'); svg.appendChild(head);
    const lbl = document.createElementNS(ns, 'text'); const [lx, ly] = toXY(0, TORSO.bottom - 0.06, view); lbl.setAttribute('x', lx); lbl.setAttribute('y', ly); lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('class', 'ah-bodylabel'); lbl.textContent = view.toUpperCase(); svg.appendChild(lbl);
    layout.dirs.forEach((d, i) => {
      const p = P[i];
      if (view === 'front' ? p[0] < -0.01 : p[0] > 0.01) return;
      const sx = view === 'front' ? -p[1] : p[1];
      const [cx, cy] = toXY(sx, p[2], view);
      const g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'ah-unit'); g.dataset.i = i;
      const halo = document.createElementNS(ns, 'circle'); halo.setAttribute('cx', cx); halo.setAttribute('cy', cy); halo.setAttribute('r', 0); halo.setAttribute('class', 'ah-halo');
      const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', 0.018 * scale); c.setAttribute('class', 'ah-dot');
      const t = document.createElementNS(ns, 'title'); t.textContent = `motor ${layout.ids[i]} · ϑ ${layout.theta[i]}° φ ${layout.phi[i]}° · chain ${layout.chains[i] + 1}`;
      g.appendChild(halo); g.appendChild(c); g.appendChild(t); svg.appendChild(g);
      dots.push({ i, g, c, halo, cx, cy });
      if (opts.onHover) { g.addEventListener('pointerenter', () => opts.onHover(i)); g.addEventListener('pointerleave', () => opts.onHover(-1)); }
    });
  }
  container.appendChild(svg);
  let hover = -1;
  function paint(active) {
    const duty = new Map(active || []);
    for (const d of dots) {
      const du = duty.get(d.i) || 0;
      d.g.classList.toggle('on', du > 0); d.g.classList.toggle('hover', d.i === hover);
      d.halo.setAttribute('r', du > 0 ? (0.02 + 0.045 * du / 15) * scale : 0);
      d.c.setAttribute('r', (0.018 + 0.012 * du / 15) * scale);
    }
  }
  let last = [];
  return { svg, setActive(active) { last = active; paint(active); }, setHover(i) { hover = i; paint(last); } };
}

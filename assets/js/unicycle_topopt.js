/* =============================================================================
   unicycle_topopt.js — a topology-optimisation playground: the mechanism behind
   the paper's "generative design" step, in the browser. SIMP (penalty 3), Q4
   plane-stress elements, density filter, optimality-criteria update; the FE
   system is solved matrix-free with a Jacobi-preconditioned conjugate gradient,
   warm-started from the previous iteration. Paint preserved (green) and
   obstacle (red) regions, move the load, change the target volume.
   ============================================================================= */
const NU = 0.3, PENAL = 3, EMIN = 1e-9;
const E_NYLON = 1.7e9, YIELD = 48e6, RHO = 1010;

function keQ4(nu = NU) {
  const k = [1 / 2 - nu / 6, 1 / 8 + nu / 8, -1 / 4 - nu / 12, -1 / 8 + 3 * nu / 8, -1 / 4 + nu / 12, -1 / 8 - nu / 8, nu / 6, 1 / 8 - 3 * nu / 8];
  const idx = [[0, 1, 2, 3, 4, 5, 6, 7], [1, 0, 7, 6, 5, 4, 3, 2], [2, 7, 0, 5, 6, 3, 4, 1], [3, 6, 5, 0, 7, 2, 1, 4], [4, 5, 6, 7, 0, 1, 2, 3], [5, 4, 3, 2, 1, 0, 7, 6], [6, 3, 4, 1, 2, 7, 0, 5], [7, 2, 1, 4, 3, 6, 5, 0]];
  const KE = new Float64Array(64); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) KE[i * 8 + j] = k[idx[i][j]] / (1 - nu * nu); return KE;
}

export class TopOpt {
  constructor(nelx, nely, opts = {}) {
    this.nelx = nelx; this.nely = nely; this.ne = nelx * nely; this.ndof = 2 * (nelx + 1) * (nely + 1);
    this.KE = keQ4(); this.volfrac = opts.volfrac ?? 0.35; this.rmin = opts.rmin ?? 2.0; this.mm = opts.mm ?? 1.0; this.thick = opts.thick ?? 6e-3;
    // element dofs (row-major: e = ey * nelx + ex ; node = ex*(nely+1)+ey, y downwards)
    this.edof = new Int32Array(this.ne * 8);
    for (let ex = 0; ex < nelx; ex++) for (let ey = 0; ey < nely; ey++) {
      const e = ey * nelx + ex, n1 = (nely + 1) * ex + ey, n2 = (nely + 1) * (ex + 1) + ey;
      const d = [2 * n1 + 2, 2 * n1 + 3, 2 * n2 + 2, 2 * n2 + 3, 2 * n2, 2 * n2 + 1, 2 * n1, 2 * n1 + 1];
      for (let k = 0; k < 8; k++) this.edof[e * 8 + k] = d[k];
    }
    this.f = new Float64Array(this.ndof); this.fixed = new Uint8Array(this.ndof);
    this.keep = new Uint8Array(this.ne); this.void = new Uint8Array(this.ne);
    this.x = new Float64Array(this.ne).fill(this.volfrac); this.xPhys = new Float64Array(this.ne).fill(this.volfrac);
    this.u = new Float64Array(this.ndof); this.it = 0; this.history = []; this.compliance = 0; this.change = 1;
    this.buildFilter();
  }
  buildFilter() {
    const r = this.rmin, R = Math.ceil(r) - 1; const nb = [], w = [];
    for (let ey = 0; ey < this.nely; ey++) for (let ex = 0; ex < this.nelx; ex++) {
      const ns = [], ws = [];
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const jx = ex + dx, jy = ey + dy; if (jx < 0 || jy < 0 || jx >= this.nelx || jy >= this.nely) continue;
        const fac = r - Math.hypot(dx, dy); if (fac <= 0) continue; ns.push(jy * this.nelx + jx); ws.push(fac);
      }
      nb.push(Int32Array.from(ns)); w.push(Float64Array.from(ws));
    }
    this.nb = nb; this.w = w; this.ws = w.map(a => a.reduce((s, v) => s + v, 0));
  }
  filter(src, dst) { for (let e = 0; e < this.ne; e++) { let s = 0; const nb = this.nb[e], w = this.w[e]; for (let k = 0; k < nb.length; k++) s += w[k] * src[nb[k]]; dst[e] = s / this.ws[e]; } }
  setDomain({ loads = [], fixed = [], keep = [], voids = [] }) {
    this.f.fill(0); this.fixed.fill(0); this.keep.fill(0); this.void.fill(0);
    for (const [nx, ny, fx, fy] of loads) { const n = (this.nely + 1) * nx + ny; this.f[2 * n] += fx; this.f[2 * n + 1] += fy; }
    for (const [x0, x1, y0, y1, dofs] of fixed) for (let nx = x0; nx <= x1; nx++) for (let ny = y0; ny <= y1; ny++) { const n = (this.nely + 1) * nx + ny; for (const d of dofs) this.fixed[2 * n + d] = 1; }
    for (const [x0, x1, y0, y1] of keep) for (let ey = y0; ey < y1; ey++) for (let ex = x0; ex < x1; ex++) this.keep[ey * this.nelx + ex] = 1;
    for (const [x0, x1, y0, y1] of voids) for (let ey = y0; ey < y1; ey++) for (let ex = x0; ex < x1; ex++) this.void[ey * this.nelx + ex] = 1;
    this.reset();
  }
  reset() { this.x.fill(this.volfrac); for (let e = 0; e < this.ne; e++) { if (this.keep[e]) this.x[e] = 1; if (this.void[e]) this.x[e] = 0; } this.xPhys.set(this.x); this.u.fill(0); this.it = 0; this.history = []; this.change = 1; }
  stiff(e) { const x = this.xPhys[e]; return EMIN + Math.pow(x, PENAL) * (1 - EMIN); }
  matvec(v, out) {
    out.fill(0); const KE = this.KE, ed = this.edof; const ue = new Float64Array(8);
    for (let e = 0; e < this.ne; e++) {
      const s = this.stiff(e); const o = e * 8; for (let k = 0; k < 8; k++) ue[k] = v[ed[o + k]];
      for (let i = 0; i < 8; i++) { let a = 0; for (let j = 0; j < 8; j++) a += KE[i * 8 + j] * ue[j]; out[ed[o + i]] += s * a; }
    }
    for (let d = 0; d < this.ndof; d++) if (this.fixed[d]) out[d] = v[d];   // Dirichlet rows
  }
  solve(maxit = 600, tol = 1e-6) {
    const n = this.ndof; const diag = new Float64Array(n); const KE = this.KE, ed = this.edof;
    for (let e = 0; e < this.ne; e++) { const s = this.stiff(e), o = e * 8; for (let k = 0; k < 8; k++) diag[ed[o + k]] += s * KE[k * 8 + k]; }
    for (let d = 0; d < n; d++) if (this.fixed[d]) diag[d] = 1;
    const b = new Float64Array(n); for (let d = 0; d < n; d++) b[d] = this.fixed[d] ? 0 : this.f[d];
    const u = this.u; for (let d = 0; d < n; d++) if (this.fixed[d]) u[d] = 0;
    const r = new Float64Array(n), z = new Float64Array(n), p = new Float64Array(n), Ap = new Float64Array(n);
    this.matvec(u, Ap); for (let d = 0; d < n; d++) r[d] = b[d] - Ap[d];
    let bn = 0; for (let d = 0; d < n; d++) bn += b[d] * b[d]; bn = Math.sqrt(bn) || 1;
    for (let d = 0; d < n; d++) { z[d] = r[d] / diag[d]; p[d] = z[d]; }
    let rz = 0; for (let d = 0; d < n; d++) rz += r[d] * z[d];
    let it = 0;
    for (; it < maxit; it++) {
      this.matvec(p, Ap); let pAp = 0; for (let d = 0; d < n; d++) pAp += p[d] * Ap[d]; if (pAp <= 0) break;
      const a = rz / pAp; let rn = 0;
      for (let d = 0; d < n; d++) { u[d] += a * p[d]; r[d] -= a * Ap[d]; rn += r[d] * r[d]; }
      if (Math.sqrt(rn) / bn < tol) break;
      let rz2 = 0; for (let d = 0; d < n; d++) { z[d] = r[d] / diag[d]; rz2 += r[d] * z[d]; }
      const beta = rz2 / rz; rz = rz2; for (let d = 0; d < n; d++) p[d] = z[d] + beta * p[d];
    }
    this.cgIters = it;
  }
  /** one SIMP iteration; returns compliance */
  step() {
    this.solve();
    const KE = this.KE, ed = this.edof, u = this.u; const ce = new Float64Array(this.ne); const ue = new Float64Array(8);
    let c = 0;
    for (let e = 0; e < this.ne; e++) {
      const o = e * 8; for (let k = 0; k < 8; k++) ue[k] = u[ed[o + k]];
      let s = 0; for (let i = 0; i < 8; i++) { let a = 0; for (let j = 0; j < 8; j++) a += KE[i * 8 + j] * ue[j]; s += ue[i] * a; }
      ce[e] = s; c += this.stiff(e) * s;
    }
    const dc = new Float64Array(this.ne), dv = new Float64Array(this.ne).fill(1);
    for (let e = 0; e < this.ne; e++) dc[e] = -PENAL * Math.pow(this.xPhys[e], PENAL - 1) * (1 - EMIN) * ce[e];
    const dcf = new Float64Array(this.ne), dvf = new Float64Array(this.ne);
    const tmp = new Float64Array(this.ne); for (let e = 0; e < this.ne; e++) tmp[e] = dc[e] / this.ws[e]; this.filter(tmp, dcf);
    for (let e = 0; e < this.ne; e++) tmp[e] = dv[e] / this.ws[e]; this.filter(tmp, dvf);
    // optimality criteria with bisection on the Lagrange multiplier
    let l1 = 0, l2 = 1e9; const move = 0.2; const xnew = new Float64Array(this.ne); const xp = new Float64Array(this.ne); let nb = 0;
    const free = []; for (let e = 0; e < this.ne; e++) if (!this.keep[e] && !this.void[e]) free.push(e);
    while ((l2 - l1) / Math.max(l1 + l2, 1e-30) > 1e-3 && nb++ < 100) {
      const lmid = 0.5 * (l1 + l2);
      for (let e = 0; e < this.ne; e++) {
        const x = this.x[e]; let v = x * Math.sqrt(Math.max(0, -dcf[e] / dvf[e] / lmid));
        v = Math.max(0, Math.max(x - move, Math.min(1, Math.min(x + move, v)))); xnew[e] = v;
      }
      for (let e = 0; e < this.ne; e++) { if (this.keep[e]) xnew[e] = 1; if (this.void[e]) xnew[e] = 0; }
      this.filter(xnew, xp); for (let e = 0; e < this.ne; e++) { if (this.keep[e]) xp[e] = 1; if (this.void[e]) xp[e] = 0; }
      let mean = 0; for (let e = 0; e < this.ne; e++) mean += xp[e]; mean /= this.ne;
      if (mean > this.volfrac) l1 = lmid; else l2 = lmid;
    }
    let ch = 0; for (let e = 0; e < this.ne; e++) ch = Math.max(ch, Math.abs(xnew[e] - this.x[e]));
    this.x.set(xnew); this.xPhys.set(xp); this.change = ch; this.it++; this.compliance = c; this.history.push(c);
    return c;
  }
  /** von Mises stress per element (Pa) on the current layout, safety factor and mass */
  stress() {
    const a = this.mm * 1e-3, scale = 1 / (E_NYLON * this.thick); const ed = this.edof, u = this.u;
    const D = [[1, NU, 0], [NU, 1, 0], [0, 0, (1 - NU) / 2]].map(r => r.map(v => v * E_NYLON / (1 - NU * NU)));
    const B = [[-1, 0, 1, 0, 1, 0, -1, 0], [0, -1, 0, -1, 0, 1, 0, 1], [-1, -1, -1, 1, 1, 1, 1, -1]].map(r => r.map(v => v / (2 * a)));
    const vm = new Float64Array(this.ne); let smax = 0, mass = 0;
    for (let e = 0; e < this.ne; e++) {
      const o = e * 8; const eps = [0, 0, 0];
      for (let i = 0; i < 3; i++) for (let k = 0; k < 8; k++) eps[i] += B[i][k] * u[ed[o + k]] * scale;
      const sg = [0, 0, 0]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) sg[i] += D[i][j] * eps[j];
      const x = this.xPhys[e]; const s = Math.sqrt(sg[0] * sg[0] - sg[0] * sg[1] + sg[1] * sg[1] + 3 * sg[2] * sg[2]) * x;
      vm[e] = s; if (x > 0.5) smax = Math.max(smax, s); mass += x * a * a * this.thick * RHO;
    }
    return { vm, smax, safety: YIELD / (smax || 1e-9), mass, massFull: this.ne * a * a * this.thick * RHO };
  }
}

/* ---------------------------------------------------------------- presets: the paper's three brackets + classics */
export const PRESETS = {
  side_support: { name: 'side support (the paper)', nelx: 36, nely: 72, mm: 1.7, volfrac: 0.30, rmin: 1.8,
    domain: (nx, ny) => ({ fixed: [[0, nx, ny, ny, [0, 1]]], loads: [[Math.round(nx / 2), 0, 0, 10], [nx - 1, 2, 5, 0], [1, 2, 5, 0]], keep: [[Math.round(nx / 2) - 4, Math.round(nx / 2) + 4, 0, 5], [0, nx, ny - 5, ny]] }),
    story: 'Fixed plane at the bottom; 10 N down from the top plate and 5 N sideways at the top. Green boxes are the joints Fusion 360 was told to preserve.' },
  rw_support: { name: 'reaction-wheel front support (the paper)', nelx: 48, nely: 60, mm: 1.7, volfrac: 0.28, rmin: 1.8,
    domain: (nx, ny) => ({ fixed: [[0, nx, ny, ny, [0, 1]]], loads: [[nx / 2, 1, 0, 2.4], [nx / 2 - 4, 1, 0, 6], [nx / 2 + 4, 1, 0, -6], [nx / 2, 1, 2, 0]], keep: [[nx / 2 - 6, nx / 2 + 6, 0, 6], [0, nx, ny - 4, ny]] }),
    story: 'A bearing seat at the top carries the wheel (2.4 N), the motor torque as a 6 N couple, and 2 N sideways; fixed at the base.' },
  bottom_plate: { name: 'bottom plate + motor support (the paper)', nelx: 84, nely: 24, mm: 1.7, volfrac: 0.32, rmin: 1.8,
    domain: (nx, ny) => ({ fixed: [[0, 1, 0, ny, [0, 1]], [nx - 1, nx, 0, ny, [0, 1]]], loads: [[nx / 2, 0, 0, 10], [Math.round(nx * 0.29), 0, 0, 5], [Math.round(nx * 0.71), 0, 0, 5], [nx / 2, ny, 0, 3.5]], keep: [[0, 3, 0, ny], [nx - 3, nx, 0, ny], [nx / 2 - 6, nx / 2 + 6, 0, 4]] }),
    story: 'Both ends fixed; the motor (10 N) in the middle, a 5 N battery load either side and a 3.5 N bearing pull below.' },
  cantilever: { name: 'cantilever beam (classic)', nelx: 80, nely: 40, mm: 1.0, volfrac: 0.40, rmin: 2.0,
    domain: (nx, ny) => ({ fixed: [[0, 0, 0, ny, [0, 1]]], loads: [[nx, ny / 2, 0, 1]], keep: [] }),
    story: 'Clamped on the left, a point load at the free end: the textbook case, which turns into a two-bar truss with a web.' },
  mbb: { name: 'MBB beam, half (classic)', nelx: 90, nely: 30, mm: 1.0, volfrac: 0.45, rmin: 2.2,
    domain: (nx, ny) => ({ fixed: [[0, 0, 0, ny, [0]], [nx, nx, ny, ny, [1]]], loads: [[0, 0, 0, 1]], keep: [] }),
    story: 'Half of a simply supported beam with a central load (symmetry on the left edge): the 88-line benchmark.' },
  lbracket: { name: 'L-bracket', nelx: 60, nely: 60, mm: 1.5, volfrac: 0.35, rmin: 1.8,
    domain: (nx, ny) => ({ fixed: [[0, Math.round(nx * 0.4), 0, 0, [0, 1]]], loads: [[nx, Math.round(ny * 0.4), 0, 1.5]], keep: [], voids: [[Math.round(nx * 0.4), nx, Math.round(ny * 0.4), ny]] }),
    story: 'A hanging L: fixed along the top-left edge, loaded at the tip; the red block is an obstacle nothing may be generated in.' },
};

/* ---------------------------------------------------------------- UI */
export function initTopopt(ui) {
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let opt = null, preset = null, running = false, brush = 'keep', painting = false, baseline = null;
  const cv = ui.canvas, ctx = cv.getContext('2d'); const hist = ui.hist, hctx = hist.getContext('2d');
  function load(name) {
    preset = PRESETS[name]; opt = new TopOpt(preset.nelx, preset.nely, { volfrac: parseFloat(ui.volfrac.value) || preset.volfrac, rmin: parseFloat(ui.rmin.value) || preset.rmin, mm: preset.mm, thick: 6e-3 });
    ui.volfrac.value = preset.volfrac; ui.rmin.value = preset.rmin; opt.volfrac = preset.volfrac; opt.rmin = preset.rmin; opt.buildFilter();
    opt.setDomain(preset.domain(preset.nelx, preset.nely)); ui.story.textContent = preset.story; baseline = null; running = false; ui.run.textContent = 'Run'; draw(); readout();
  }
  function fullBaseline() {
    // one FE solve on the solid domain for the "before" mass and safety factor
    const saved = opt.xPhys.slice(); opt.xPhys.fill(1); for (let e = 0; e < opt.ne; e++) if (opt.void[e]) opt.xPhys[e] = 0;
    const u0 = opt.u.slice(); opt.u.fill(0); opt.solve(1200, 1e-7); const st = opt.stress(); opt.xPhys.set(saved); opt.u.set(u0);
    return st;
  }
  function draw() {
    const r = cv.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const W = r.width, H = r.height;
    const panel = css('--panel') || '#fdf6e2', ink = css('--ink') || '#151820';
    ctx.fillStyle = panel; ctx.fillRect(0, 0, W, H);
    const nx = opt.nelx, ny = opt.nely; const s = Math.min((W - 40) / nx, (H - 40) / ny); const x0 = (W - s * nx) / 2, y0 = (H - s * ny) / 2;
    opt.px = { s, x0, y0 };
    const showStress = ui.showStress.checked; const st = showStress ? opt.stress() : null;
    const inkRGB = ink.startsWith('#') ? [parseInt(ink.slice(1, 3), 16), parseInt(ink.slice(3, 5), 16), parseInt(ink.slice(5, 7), 16)] : [21, 24, 32];
    const panRGB = panel.startsWith('#') ? [parseInt(panel.slice(1, 3), 16), parseInt(panel.slice(3, 5), 16), parseInt(panel.slice(5, 7), 16)] : [253, 246, 226];
    for (let ey = 0; ey < ny; ey++) for (let ex = 0; ex < nx; ex++) {
      const e = ey * nx + ex; const d = opt.xPhys[e];
      if (showStress && d > 0.3) { const t = Math.min(1, st.vm[e] / (st.smax || 1)); ctx.fillStyle = `rgb(${Math.round(40 + 215 * t)},${Math.round(40 + 120 * (1 - t))},${Math.round(60 + 40 * (1 - t))})`; }
      else { const c = inkRGB.map((v, i) => Math.round(panRGB[i] + (v - panRGB[i]) * d)); ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; }
      ctx.fillRect(x0 + ex * s, y0 + ey * s, s + 0.5, s + 0.5);
    }
    // keep / void overlays
    ctx.lineWidth = 1.2;
    for (let ey = 0; ey < ny; ey++) for (let ex = 0; ex < nx; ex++) {
      const e = ey * nx + ex;
      if (opt.keep[e]) { ctx.fillStyle = 'rgba(63,191,90,.45)'; ctx.fillRect(x0 + ex * s, y0 + ey * s, s + 0.5, s + 0.5); }
      if (opt.void[e]) { ctx.fillStyle = 'rgba(228,68,42,.45)'; ctx.fillRect(x0 + ex * s, y0 + ey * s, s + 0.5, s + 0.5); }
    }
    // supports and loads
    for (let n = 0; n < (nx + 1) * (ny + 1); n++) {
      const fx = opt.fixed[2 * n], fy = opt.fixed[2 * n + 1]; if (!fx && !fy) continue;
      const px = x0 + Math.floor(n / (ny + 1)) * s, py = y0 + (n % (ny + 1)) * s;
      ctx.fillStyle = '#2a78d6'; ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, s * 0.35), 0, 2 * Math.PI); ctx.fill();
    }
    for (let n = 0; n < (nx + 1) * (ny + 1); n++) {
      const fx = opt.f[2 * n], fy = opt.f[2 * n + 1]; if (!fx && !fy) continue;
      const px = x0 + Math.floor(n / (ny + 1)) * s, py = y0 + (n % (ny + 1)) * s; const L = 26, m = Math.hypot(fx, fy);
      ctx.strokeStyle = '#E4442A'; ctx.fillStyle = '#E4442A'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(px - fx / m * L, py - fy / m * L); ctx.lineTo(px, py); ctx.stroke();
      const a = Math.atan2(fy, fx); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 8 * Math.cos(a - 0.5), py - 8 * Math.sin(a - 0.5)); ctx.lineTo(px - 8 * Math.cos(a + 0.5), py - 8 * Math.sin(a + 0.5)); ctx.closePath(); ctx.fill();
      ctx.font = '10px "Space Mono", monospace'; ctx.fillText(m.toFixed(1) + ' N', px + 6, py - 6);
    }
    // history
    const hr = hist.getBoundingClientRect(); if (hist.width !== Math.round(hr.width * dpr)) { hist.width = Math.round(hr.width * dpr); hist.height = Math.round(hr.height * dpr); }
    hctx.setTransform(dpr, 0, 0, dpr, 0, 0); hctx.fillStyle = panel; hctx.fillRect(0, 0, hr.width, hr.height);
    const h = opt.history; if (h.length > 1) {
      const mn = Math.min(...h), mx = Math.max(...h); hctx.strokeStyle = '#E4442A'; hctx.lineWidth = 1.6; hctx.beginPath();
      h.forEach((c, i) => { const px = 6 + i / Math.max(1, h.length - 1) * (hr.width - 12), py = hr.height - 6 - (Math.log(c) - Math.log(mn)) / Math.max(1e-9, Math.log(mx) - Math.log(mn)) * (hr.height - 16); i ? hctx.lineTo(px, py) : hctx.moveTo(px, py); });
      hctx.stroke();
    }
    hctx.fillStyle = css('--ash') || '#8f8a7a'; hctx.font = '10px Jost, sans-serif'; hctx.fillText('compliance (log) per iteration', 6, 11);
  }
  function readout() {
    const st = opt.stress(); if (!baseline) baseline = fullBaseline();
    let vol = 0; for (let e = 0; e < opt.ne; e++) vol += opt.xPhys[e]; vol /= opt.ne;
    if (opt.it === 0) { ui.readout.innerHTML = `ready · material <b>${(100 * vol).toFixed(0)} %</b> target ${(100 * opt.volfrac).toFixed(0)} % · solid plate ${(baseline.mass * 1e3).toFixed(1)} g, safety factor ${baseline.safety > 999 ? '>999' : baseline.safety.toFixed(1)} · press Run`; return; }
    ui.readout.innerHTML = `iteration <b>${opt.it}</b> · material <b>${(100 * vol).toFixed(0)} %</b> · mass <b>${(st.mass * 1e3).toFixed(1)} g</b> (solid plate ${(baseline.mass * 1e3).toFixed(1)} g, −${(100 * (1 - st.mass / baseline.mass)).toFixed(0)} %) · max von Mises <b>${(st.smax / 1e6).toFixed(2)} MPa</b> · safety factor <b>${st.safety > 999 ? '>999' : st.safety.toFixed(1)}</b> (solid ${baseline.safety > 999 ? '>999' : baseline.safety.toFixed(1)}) · change ${opt.change.toFixed(3)} · CG ${opt.cgIters ?? 0} its`;
  }
  let lastFrame = 0;
  function frame(ts) {
    if (running) { if (opt.change > 0.01 && opt.it < 150) { const t0 = performance.now(); opt.step(); lastFrame = performance.now() - t0; } else { running = false; ui.run.textContent = 'Run'; } draw(); readout(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // painting
  function cellAt(ev) { const r = cv.getBoundingClientRect(); const { s, x0, y0 } = opt.px; const ex = Math.floor((ev.clientX - r.left - x0) / s), ey = Math.floor((ev.clientY - r.top - y0) / s); return (ex >= 0 && ey >= 0 && ex < opt.nelx && ey < opt.nely) ? [ex, ey] : null; }
  function paint(ev) {
    const c = cellAt(ev); if (!c) return; const [ex, ey] = c; const rad = 2;
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const jx = ex + dx, jy = ey + dy; if (jx < 0 || jy < 0 || jx >= opt.nelx || jy >= opt.nely) continue; const e = jy * opt.nelx + jx;
      if (brush === 'keep') { opt.keep[e] = 1; opt.void[e] = 0; } else if (brush === 'void') { opt.void[e] = 1; opt.keep[e] = 0; } else { opt.keep[e] = 0; opt.void[e] = 0; }
    }
    if (brush === 'load') { const nx = Math.round((ev.clientX - cv.getBoundingClientRect().left - opt.px.x0) / opt.px.s), ny = Math.round((ev.clientY - cv.getBoundingClientRect().top - opt.px.y0) / opt.px.s); opt.f.fill(0); const n = (opt.nely + 1) * Math.max(0, Math.min(opt.nelx, nx)) + Math.max(0, Math.min(opt.nely, ny)); opt.f[2 * n + 1] = parseFloat(ui.loadN.value) || 5; }
    baseline = null; draw();
  }
  cv.addEventListener('pointerdown', (e) => { painting = true; cv.setPointerCapture(e.pointerId); paint(e); });
  cv.addEventListener('pointermove', (e) => { if (painting) paint(e); });
  cv.addEventListener('pointerup', () => { painting = false; opt.reset(); readout(); draw(); });
  ui.brush.addEventListener('change', () => brush = ui.brush.value);
  ui.preset.addEventListener('change', () => load(ui.preset.value));
  ui.run.addEventListener('click', () => { running = !running; ui.run.textContent = running ? 'Pause' : 'Run'; });
  ui.step.addEventListener('click', () => { running = false; ui.run.textContent = 'Run'; opt.step(); draw(); readout(); });
  ui.reset.addEventListener('click', () => { running = false; ui.run.textContent = 'Run'; opt.reset(); draw(); readout(); });
  ui.volfrac.addEventListener('input', () => { opt.volfrac = parseFloat(ui.volfrac.value); ui.volOut.textContent = Math.round(100 * opt.volfrac) + ' %'; });
  ui.rmin.addEventListener('input', () => { opt.rmin = parseFloat(ui.rmin.value); opt.buildFilter(); ui.rminOut.textContent = opt.rmin.toFixed(1); });
  ui.showStress.addEventListener('change', draw);
  new ResizeObserver(draw).observe(cv);
  load(ui.preset.value || 'side_support');
  ui.volOut.textContent = Math.round(100 * opt.volfrac) + ' %'; ui.rminOut.textContent = opt.rmin.toFixed(1);
  return { get opt() { return opt; } };
}

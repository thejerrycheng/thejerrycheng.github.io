/* =============================================================================
   unicycle_sim.js — the self-balancing unicycle of Chen, Cheng & Han (ACAIB 2022)
   as a browser simulation. A line-for-line port of experiments/unicycle/model.py:
   wheeled inverted pendulum (pitch + translation, drive wheel) + reaction-wheel
   pendulum (roll), brushed DC motors with back-EMF, three PID loops, RK4 at 1 kHz
   with the controller held at 200 Hz.
   ============================================================================= */
export const G = 9.81;
export const P = {
  M_RW: 0.1656, M_RW_MOTOR: 0.07432, M_DRIVE_MOTOR: 0.096, M_BATT: 0.135, M_ELEC: 0.010,
  M_WHEEL: 0.040, R_WHEEL: 0.035, R_RW: 0.060, H_TOP: 0.26,
};
P.J_RW = 0.85 * P.M_RW * P.R_RW * P.R_RW;
P.J_WHEEL = 0.5 * P.M_WHEEL * P.R_WHEEL * P.R_WHEEL;
P.M_COMPONENTS = P.M_RW + P.M_RW_MOTOR + P.M_DRIVE_MOTOR + P.M_BATT + P.M_ELEC;

export function chassis(spec) {
  const c = Object.assign({}, spec);
  c.m_body = P.M_COMPONENTS + c.m_struct;
  c.j_body = c.m_body * Math.pow(c.k_gyr * c.l, 2);
  c.m_total = c.m_body + P.M_WHEEL;
  c.l_ground = (c.m_body * (c.l + P.R_WHEEL) + P.M_WHEEL * P.R_WHEEL) / c.m_total;
  c.j_roll_pivot = c.j_body + c.m_body * Math.pow(c.l + P.R_WHEEL, 2) + 0.5 * P.M_WHEEL * P.R_WHEEL * P.R_WHEEL;
  return c;
}
export const GENERATIVE = chassis({ name: 'generative', m_struct: 0.16903, l: 0.150, k_gyr: 0.60 });
export const CONVENTIONAL = chassis({ name: 'conventional', m_struct: 0.340, l: 0.120, k_gyr: 0.62 });
export const DRIVE_MOTOR = { kt: 0.12, ke: 0.12, R: 2.8, v_max: 11.1, b: 1.0e-4 };
export const RW_MOTOR = { kt: 0.045, ke: 0.045, R: 1.5, v_max: 11.1, b: 2.0e-5 };
export const PAPER_GAINS = { kp_pitch: 180, kd_pitch: 12, ki_pitch: 40, kp_x: 18, kd_x: 22, kp_roll: 280, kd_roll: 40, ki_roll: 0, kw: -0.18 };

const clip = (v, a, b) => Math.max(a, Math.min(b, v));

/** Unstable open-loop poles of the linearised plant (pitch, roll), 1/s, with the motors shorted
 *  (back-EMF damping at zero voltage), the same linearisation as experiments/unicycle/model.py. */
export function poles(c, drive = DRIVE_MOTOR, rw = RW_MOTOR) {
  const mb = c.m_body, l = c.l, jb = c.j_body, r = P.R_WHEEL;
  const a = P.M_WHEEL + mb + P.J_WHEEL / (r * r), b = mb * l, dd = jb + mb * l * l, det = a * dd - b * b;
  const d = drive.kt * drive.ke / drive.R + drive.b;
  // rhs = [tau1/r, -tau1 + mb g l phi] with tau1 = -d (xd/r - phid): derivatives w.r.t. (xd, phi, phid)
  const inv = [[dd / det, -b / det], [-b / det, a / det]];
  const col = (v) => [inv[0][0] * v[0] + inv[0][1] * v[1], inv[1][0] * v[0] + inv[1][1] * v[1]];
  const cxd = col([-d / (r * r), d / r]), cphi = col([0, mb * G * l]), cphid = col([d / r, -d]);
  // state (xd, phi, phid): A3 = [[cxd0, cphi0, cphid0], [0, 0, 1], [cxd1, cphi1, cphid1]]
  const A3 = [[cxd[0], cphi[0], cphid[0]], [0, 0, 1], [cxd[1], cphi[1], cphid[1]]];
  const f = (lam) => { const m = A3.map((row, i) => row.map((v, j) => v - (i === j ? lam : 0))); return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]); };
  let lo = 0.01, hi = 60; if (f(lo) * f(hi) > 0) hi = 200;
  for (let k = 0; k < 80; k++) { const mid = 0.5 * (lo + hi); if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; }
  const pitch = 0.5 * (lo + hi);
  const roll = Math.sqrt(c.m_total * G * c.l_ground / c.j_roll_pivot);
  return { pitch, roll };
}

export class Unicycle {
  constructor(c = GENERATIVE, gains = PAPER_GAINS, opts = {}) {
    this.c = c; this.g = Object.assign({}, gains);
    this.drive = Object.assign({}, DRIVE_MOTOR, opts.drive || {}); this.rw = Object.assign({}, RW_MOTOR, opts.rw || {});
    this.friction = opts.friction || 0; this.dt = 1e-3; this.dtCtrl = opts.dtCtrl || 5e-3; this.delay = opts.delay || 0;
    this.iMax = 0.5; this.fallAngle = Math.PI / 3;
    this.reset();
  }
  reset(phi0 = 0, rho0 = 0) {
    // x, xd, phi, phid, rho, rhod, th2, th2d, i_phi, i_rho
    this.s = [0, 0, phi0, 0, rho0, 0, 0, 0, 0, 0];
    this.t = 0; this.u1 = 0; this.u2 = 0; this.fell = false; this.acc = 0; this.queue = [];
    this.energy = 0; this.pmax = 0; this.p = 0; this.tau1 = 0; this.tau2 = 0; this.th1 = 0;
  }
  motor(m, u, w) { const i = (u - m.ke * w) / m.R; return [m.kt * i - m.b * w, i]; }
  accel(s, u1, u2) {
    const c = this.c, mb = c.m_body, l = c.l, jb = c.j_body;
    const xd = s[1], phi = s[2], phid = s[3], rho = s[4], th2d = s[7];
    const w1 = xd / P.R_WHEEL - phid;
    const tau1 = this.motor(this.drive, u1, w1)[0];
    const cph = Math.cos(phi), sph = Math.sin(phi);
    const m11 = P.M_WHEEL + mb + P.J_WHEEL / (P.R_WHEEL * P.R_WHEEL), m12 = mb * l * cph, m22 = jb + mb * l * l;
    const r1 = tau1 / P.R_WHEEL + mb * l * sph * phid * phid - this.friction * xd, r2 = -tau1 + mb * G * l * sph;
    const det = m11 * m22 - m12 * m12;
    const xdd = (m22 * r1 - m12 * r2) / det, phidd = (m11 * r2 - m12 * r1) / det;
    const tau2 = this.motor(this.rw, u2, th2d)[0];
    const rhodd = (c.m_total * G * c.l_ground * Math.sin(rho) - tau2) / c.j_roll_pivot;
    const th2dd = tau2 / P.J_RW - rhodd;
    return [xdd, phidd, rhodd, th2dd, tau1, tau2];
  }
  f(s, u1, u2) { const a = this.accel(s, u1, u2); return [s[1], a[0], s[3], a[1], s[5], a[2], s[7], a[3], s[2], s[4]]; }
  control(s) {
    const g = this.g;
    let u1 = g.kp_pitch * s[2] + g.kd_pitch * s[3] + g.ki_pitch * s[8] + g.kp_x * s[0] + g.kd_x * s[1];
    let u2 = g.kp_roll * s[4] + g.kd_roll * s[5] + g.ki_roll * s[9] - g.kw * s[7];
    return [clip(u1, -this.drive.v_max, this.drive.v_max), clip(u2, -this.rw.v_max, this.rw.v_max)];
  }
  power() { const s = this.s; const i1 = this.motor(this.drive, this.u1, s[1] / P.R_WHEEL - s[3])[1], i2 = this.motor(this.rw, this.u2, s[7])[1]; return [this.u1 * i1, this.u2 * i2]; }
  push(dphid, drhod) { this.s[3] += dphid; this.s[5] += drhod; }
  /** advance by `T` seconds of simulated time (many 1 ms RK4 steps) */
  advance(T) {
    if (this.fell) return;
    const dt = this.dt, n = Math.round(T / dt), every = Math.round(this.dtCtrl / dt), nd = Math.round(this.delay / dt);
    for (let k = 0; k < n; k++) {
      if (this.acc % every === 0) this.queue.push([this.acc + nd, this.control(this.s)]);
      while (this.queue.length && this.queue[0][0] <= this.acc) { const q = this.queue.shift(); this.u1 = q[1][0]; this.u2 = q[1][1]; }
      const s = this.s, u1 = this.u1, u2 = this.u2;
      const k1 = this.f(s, u1, u2), s2 = s.map((v, i) => v + 0.5 * dt * k1[i]);
      const k2 = this.f(s2, u1, u2), s3 = s.map((v, i) => v + 0.5 * dt * k2[i]);
      const k3 = this.f(s3, u1, u2), s4 = s.map((v, i) => v + dt * k3[i]);
      const k4 = this.f(s4, u1, u2);
      for (let i = 0; i < 10; i++) s[i] += dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
      s[8] = clip(s[8], -this.iMax, this.iMax); s[9] = clip(s[9], -this.iMax, this.iMax);
      this.th1 = s[0] / P.R_WHEEL;
      const [p1, p2] = this.power(); this.p = p1 + p2; this.energy += Math.max(0, this.p) * dt; this.pmax = Math.max(this.pmax, this.p);
      const a = this.accel(s, u1, u2); this.tau1 = a[4]; this.tau2 = a[5];
      this.acc++; this.t += dt;
      if (Math.abs(s[2]) > this.fallAngle || Math.abs(s[4]) > this.fallAngle) { this.fell = true; return; }
    }
  }
  get top() { return this.s[0] + P.H_TOP * Math.sin(this.s[2]); }
}

/** Offline run for the plots: returns arrays at 100 Hz and the paper's metrics. */
export function run(c, gains, opts = {}) {
  const uni = new Unicycle(c, gains, opts); const T = opts.T || 6, phi0 = opts.phi0 ?? 5 * Math.PI / 180, rho0 = opts.rho0 ?? phi0;
  uni.reset(phi0, rho0);
  const out = { t: [], phi: [], rho: [], x: [], top: [], p: [], u1: [], u2: [] };
  const step = 0.01, n = Math.round(T / step);
  for (let k = 0; k <= n; k++) {
    out.t.push(uni.t); out.phi.push(uni.s[2]); out.rho.push(uni.s[4]); out.x.push(uni.s[0]); out.top.push(uni.top); out.p.push(uni.p); out.u1.push(uni.u1); out.u2.push(uni.u2);
    if (uni.fell) break;
    if (opts.pushes) for (const [tp, dp, dr] of opts.pushes) if (Math.abs(uni.t - tp) < step / 2) uni.push(dp, dr);
    uni.advance(step);
  }
  out.fell = uni.fell; out.energy = uni.energy; out.pmax = uni.pmax;
  out.ts_pitch = settling(out.t, out.phi, phi0); out.ts_roll = settling(out.t, out.rho, rho0);
  out.peak_top = Math.max(...out.top.map(Math.abs));
  return out;
}
export function settling(t, y, y0, band = 0.05) {
  const thr = band * Math.abs(y0); if (thr === 0) return 0;
  const inside = y.map(v => Math.abs(v) <= thr); if (!inside[inside.length - 1]) return Infinity;
  let k = y.length - 1; while (k > 0 && inside[k - 1]) k--; return t[k];
}

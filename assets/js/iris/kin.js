/* =============================================================================
   kin.js — IRIS arm kinematics in the browser: the MuJoCo body tree of
   mujoco_sim/assets/iris.xml (assets/data/iris_model.json) composed exactly as
   MuJoCo does (T_parent · T(pos, quat) · R(axis, q)), the geometric Jacobian,
   damped-least-squares IK with a look-at orientation (the thesis convention:
   the mount's +z is the optical axis, its -y is "up"), joint limits and a
   velocity-limited joint tracker. Plain arrays, no three.js, so the Python
   twin (experiments/irisstudio/kinematics.py) and node tests share the maths.
   ============================================================================= */
export const M4 = {
  I: () => [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
  mul(A, B) { const C = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j] + A[i][3] * B[3][j]; return C; },
  fromQuatPos(q, p) { const [w, x, y, z] = q; return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), p[0]], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), p[1]], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), p[2]], [0, 0, 0, 1]]; },
  axisAngle(a, th) { const n = Math.hypot(a[0], a[1], a[2]); const [x, y, z] = [a[0] / n, a[1] / n, a[2] / n]; const c = Math.cos(th), s = Math.sin(th), C = 1 - c; return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s, 0], [y * x * C + z * s, c + y * y * C, y * z * C - x * s, 0], [z * x * C - y * s, z * y * C + x * s, c + z * z * C, 0], [0, 0, 0, 1]]; },
  pos: (T) => [T[0][3], T[1][3], T[2][3]],
  col: (T, k) => [T[0][k], T[1][k], T[2][k]],
  rot: (T) => [[T[0][0], T[0][1], T[0][2]], [T[1][0], T[1][1], T[1][2]], [T[2][0], T[2][1], T[2][2]]],
};
export const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], norm: (a) => Math.hypot(a[0], a[1], a[2]), cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  unit(a) { const n = Math.hypot(a[0], a[1], a[2]) || 1e-12; return [a[0] / n, a[1] / n, a[2] / n]; }, lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
const R3 = {
  mul(A, B) { const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j]; return C; },
  T: (A) => [[A[0][0], A[1][0], A[2][0]], [A[0][1], A[1][1], A[2][1]], [A[0][2], A[1][2], A[2][2]]],
  apply: (A, v) => [A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2], A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2], A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2]],
  fromCols: (x, y, z) => [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]],
  axisAngle(a, th) { const T = M4.axisAngle(a, th); return M4.rot(T); },
  log(Re) { const tr = (Re[0][0] + Re[1][1] + Re[2][2] - 1) / 2; const ang = Math.acos(Math.max(-1, Math.min(1, tr))); if (ang < 1e-9) return [0, 0, 0]; const k = ang / (2 * Math.sin(ang)); return [k * (Re[2][1] - Re[1][2]), k * (Re[0][2] - Re[2][0]), k * (Re[1][0] - Re[0][1])]; },
};
export { R3 };

/** Rotation whose +z looks from p to target and whose -y is as close to `up` as possible (x = right). */
export function lookAtRotation(p, target, up = [0, 0, 1]) {
  let z = V3.unit(V3.sub(target, p));
  if (Math.abs(V3.dot(z, up)) > 0.999) up = [1, 0, 0];
  const x = V3.unit(V3.cross(V3.scale(up, -1), z));
  const y = V3.cross(z, x);
  return R3.fromCols(x, y, z);
}
/** Rotation from yaw (about world z), pitch (up positive) and roll (about the optical axis), forward = +x at zero. */
export function yawPitchRoll(yaw, pitch, roll, p = [0, 0, 0]) {
  const f = [Math.cos(yaw) * Math.cos(pitch), Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch)];
  return rollAbout(lookAtRotation(p, V3.add(p, f)), roll);
}
export function rollAbout(R, roll) { if (!roll) return R; const z = [R[0][2], R[1][2], R[2][2]]; return R3.mul(R3.axisAngle(z, roll), R); }
export const smoothstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeOutExpo = (t) => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);

function solve(A, b) {                       /* Gaussian elimination with partial pivoting, n <= 6 */
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) { let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i; [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c] || 1e-12; for (let i = 0; i < n; i++) { if (i === c) continue; const f = M[i][c] / d; for (let j = c; j <= n; j++) M[i][j] -= f * M[c][j]; } }
  return M.map((r, i) => r[n] / (r[i] || 1e-12));
}

export const SEEDS_DEG = [[0, -20, -100, 0, 40, 0], [0, -60, -70, 0, 60, 0], [0, -40, -120, 0, 80, 0], [0, 0, -140, 0, 50, 0], [0, -80, -40, 0, 30, 0], [0, -30, -60, 0, -30, 0], [0, -20, -100, 90, 40, 0], [0, -20, -100, -90, 40, 0]];
export const TOOL_OFFSET = [0, 0, 0.14];   /* the lens entrance pupil, in the mount frame */
export class Arm {
  constructor(model) {
    this.model = model; this.bodies = model.bodies;
    this.jointBodies = this.bodies.filter(b => b.joint);
    this.n = this.jointBodies.length;
    this.lo = this.jointBodies.map(b => b.joint.range_deg[0] * Math.PI / 180); this.hi = this.jointBodies.map(b => b.joint.range_deg[1] * Math.PI / 180);
    this.names = this.jointBodies.map(b => b.joint.name);
    this.continuous = this.jointBodies.map((b, i) => (this.hi[i] - this.lo[i]) >= 2 * Math.PI - 1e-6);   /* joints 4 and 6: continuous-rotation motors */
    this.home = [0, -20, -100, 0, 40, 0].map(d => d * Math.PI / 180);          /* the thesis START_Q */
    this.vmax = 1.5;                                                            /* rad/s per joint, a cinema-smooth cap */
  }
  fkAll(q) {
    const poses = { world: M4.I() }; let k = 0;
    for (const b of this.bodies) {
      let T = M4.fromQuatPos(b.quat, b.pos);
      if (b.joint) { T = M4.mul(T, M4.axisAngle(b.joint.axis, q[k])); k++; }
      poses[b.name] = M4.mul(poses[b.parent], T);
    }
    return poses;
  }
  fk(q, body = 'tool') { const P = this.fkAll(q); if (body !== 'tool') return P[body]; const T = P.ee_mount.map(r => r.slice()); const o = R3.apply(M4.rot(T), TOOL_OFFSET); T[0][3] += o[0]; T[1][3] += o[1]; T[2][3] += o[2]; return T; }
  jacobian(q, poses) {
    poses = poses || this.fkAll(q); const pe = V3.add(M4.pos(poses.ee_mount), R3.apply(M4.rot(poses.ee_mount), TOOL_OFFSET)); const J = [[], [], [], [], [], []];
    this.jointBodies.forEach((b, k) => { const T = poses[b.name]; const a = R3.apply(M4.rot(T), b.joint.axis); const w = V3.cross(a, V3.sub(pe, M4.pos(T))); J[0][k] = w[0]; J[1][k] = w[1]; J[2][k] = w[2]; J[3][k] = a[0]; J[4][k] = a[1]; J[5][k] = a[2]; });
    return J;
  }
  clamp(q) { return q.map((v, i) => this.continuous[i] ? v : Math.max(this.lo[i], Math.min(this.hi[i], v))); }
  /** Joint difference with the continuous joints taken the short way round. */
  wrapDelta(dq) { return dq.map((d, i) => this.continuous[i] ? ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI : d); }
  /** Damped least squares to a position and (optionally) a rotation or a look-at point. Returns {q, ok, it, posErr, rotErr}. */
  ik(targetPos, opts = {}) {
    const { R: targetR0 = null, lookAt = null, roll = 0, q0 = this.home, iters = 60, damping = 2e-3, step = 0.7, tol = 5e-4, wRot = 0.35 } = opts;
    let q = q0.slice(); let posErr = 1, rotErr = 0;
    for (let it = 0; it < iters; it++) {
      const poses = this.fkAll(q); const T = poses.ee_mount; const R = M4.rot(T); const p = V3.add(M4.pos(T), R3.apply(R, TOOL_OFFSET));
      const ePos = V3.sub(targetPos, p); posErr = V3.norm(ePos);
      let targetR = targetR0; if (lookAt) targetR = rollAbout(lookAtRotation(p, lookAt), roll);
      let err, J;
      if (targetR) { const eRot = R3.log(R3.mul(targetR, R3.T(R))); rotErr = V3.norm(eRot); err = [ePos[0], ePos[1], ePos[2], wRot * eRot[0], wRot * eRot[1], wRot * eRot[2]]; J = this.jacobian(q, poses); for (let r = 3; r < 6; r++) for (let c = 0; c < 6; c++) J[r][c] *= wRot; }
      else { err = ePos; J = this.jacobian(q, poses).slice(0, 3); }
      if (posErr < tol && (!targetR || rotErr < 2e-3)) return { q, ok: true, it, posErr, rotErr };
      const m = err.length; const JJt = []; for (let i = 0; i < m; i++) { JJt.push([]); for (let j = 0; j < m; j++) { let s = 0; for (let c = 0; c < 6; c++) s += J[i][c] * J[j][c]; JJt[i][j] = s + (i === j ? damping : 0); } }
      const y = solve(JJt, err); const dq = new Array(6).fill(0); for (let c = 0; c < 6; c++) for (let i = 0; i < m; i++) dq[c] += J[i][c] * y[i];
      q = this.clamp(q.map((v, i) => v + step * dq[i]));
    }
    return { q, ok: posErr < 3e-3, it: iters, posErr, rotErr };
  }
  /** IK from qPrev first; on failure from the canonical seeds, keeping the solution closest to qPrev
      (or, without a previous pose, the one farthest from the joint limits). Mirrors kinematics.ik_multi. */
  ikMulti(targetPos, opts = {}, qPrev = null) {
    if (qPrev) { const r = this.ik(targetPos, { ...opts, q0: qPrev }); if (r.ok) return r; }
    let best = null;
    for (const s of SEEDS_DEG) {
      const r = this.ik(targetPos, { ...opts, q0: s.map(d => d * Math.PI / 180), iters: 300, damping: 1e-3, step: 0.5 });
      if (!r.ok) continue;
      const az = Math.atan2(targetPos[1], targetPos[0]) - Math.PI / 2; const dyaw = Math.abs(((r.q[0] - az + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
      if (qPrev) { const d = this.wrapDelta(r.q.map((v, i) => v - qPrev[i])); r.q = qPrev.map((v, i) => v + d[i]); }
      const score = qPrev ? Math.hypot(...r.q.map((v, i) => v - qPrev[i])) : dyaw - 0.2 * Math.min(...r.q.map((v, i) => Math.min(v - this.lo[i], this.hi[i] - v)));
      if (!best || score < best.score) best = { ...r, score };
    }
    if (best) return best;
    const r = this.ik(targetPos, { ...opts, q0: qPrev || this.home }); return { ...r, q: (qPrev || this.home).slice(), ok: false };   /* unreachable: hold the previous pose */
  }
  /** Move q toward qTarget with a per-joint speed cap (rad/s). */
  track(q, qTarget, dt, vmax = this.vmax) { const dq = this.wrapDelta(qTarget.map((t, i) => t - q[i])); return q.map((v, i) => { const m = vmax * dt; return v + Math.max(-m, Math.min(m, dq[i])); }); }
}
/** The camera frame: three.js cameras look down -z with +y up; the mount looks down +z with -y up: rotate pi about x. */
export const MOUNT_TO_CAMERA_QUAT = [1, 0, 0, 0];   /* (x, y, z, w) for three.js: 180 deg about x */

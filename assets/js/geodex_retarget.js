/* ============================================================================
   geodex_retarget.js — the GeoDEX finger-retargeting playground.

   Runs the released cost function (teleop/planners/planner_avp.py, Eq. 3 of the
   report) against the real ORCA hand kinematics, exported from the MuJoCo model
   by scripts/tools/export_hand_kinematics.py, on the real 21-landmark human
   hand recorded through the Apple Vision Pro pipeline.

   The offline harness uses SLSQP; here the same cost is minimised by projected
   gradient descent with a numerical Jacobian, which is what a browser can do at
   frame rate. Same objective, same kinematics, same data.
   ========================================================================= */
(function () {
  'use strict';

  // ---------- small 3-vector / quaternion helpers ---------------------------
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a) => Math.sqrt(dot(a, a));

  function quatToMat(q) {                    // MuJoCo order: w, x, y, z
    const [w, x, y, z] = q;
    return [
      1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
      2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
      2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
  }
  function axisAngleMat(ax, a) {
    const c = Math.cos(a), s = Math.sin(a), t = 1 - c, [x, y, z] = ax;
    return [t * x * x + c, t * x * y - s * z, t * x * z + s * y,
            t * x * y + s * z, t * y * y + c, t * y * z - s * x,
            t * x * z - s * y, t * y * z + s * x, t * z * z + c];
  }
  function mm(A, B) {
    const C = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    }
    return C;
  }
  const mv = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2],
                        A[3] * v[0] + A[4] * v[1] + A[5] * v[2],
                        A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
  const mtv = (A, v) => [A[0] * v[0] + A[3] * v[1] + A[6] * v[2],
                         A[1] * v[0] + A[4] * v[1] + A[7] * v[2],
                         A[2] * v[0] + A[5] * v[1] + A[8] * v[2]];

  // ---------- forward kinematics over the exported body tree ----------------
  class Hand {
    constructor(kin) {
      this.k = kin;
      this.n = kin.joints.length;
      this.bodyR = kin.bodies.map((b) => quatToMat(b.quat));
      this.lo = new Float64Array(this.n);
      this.hi = new Float64Array(this.n);
      kin.bodies.forEach((b) => {
        if (b.joint) { this.lo[b.joint.q] = b.joint.range[0]; this.hi[b.joint.q] = b.joint.range[1]; }
      });
      this.pos = []; this.rot = [];
      this.tips = new Set(kin.tips);
    }

    fk(q) {
      const K = this.k, pos = this.pos, rot = this.rot;
      for (let i = 0; i < K.bodies.length; i++) {
        const b = K.bodies[i];
        let R = this.bodyR[i], p = b.pos.slice();
        if (b.joint) R = mm(R, axisAngleMat(b.joint.axis, q[b.joint.q]));
        if (b.parent < 0) { pos[i] = p; rot[i] = R; }
        else { pos[i] = add(pos[b.parent], mv(rot[b.parent], p)); rot[i] = mm(rot[b.parent], R); }
      }
      // palm frame
      const pb = K.palm.body;
      const palmR = mm(rot[pb], quatToMat(K.palm.quat));
      const palmP = add(pos[pb], mv(rot[pb], K.palm.pos));
      const out = {};
      for (const key in K.keypoints) {
        const kp = K.keypoints[key];
        let g = pos[kp.body];
        if (kp.tip) g = add(g, mv(rot[kp.body], kp.offset));
        out[key] = mtv(palmR, sub(g, palmP));
      }
      return out;
    }
  }

  // ---------- the released cost ---------------------------------------------
  const TIPS = [4, 8, 12, 16, 20];
  function cost(rp, tg, qq, qPrev, w, pairs, gateSq) {
    let L = 0;
    if (w.cos) {
      let d = 0, nr = 0, nh = 0;
      for (const k in rp) {
        const a = rp[k], b = tg[k];
        if (!b) continue;
        d += dot(a, b); nr += dot(a, a); nh += dot(b, b);
      }
      L += w.cos * (1 - d / (Math.sqrt(nr * nh) + 1e-9));
    }
    if (w.pos) {
      for (const k of TIPS) {
        const a = rp[k], b = tg[k];
        if (a && b) { const e = sub(a, b); L += w.pos * dot(e, e); }
      }
    }
    if (w.rel) {
      for (const [i, j] of pairs) {
        const ra = rp[i], rb = rp[j], ha = tg[i], hb = tg[j];
        if (!ra || !rb || !ha || !hb) continue;
        const rr = sub(rb, ra), hh = sub(hb, ha);
        const boost = dot(hh, hh) < gateSq ? 5 : 1;
        const e = sub(rr, hh);
        L += w.rel * boost * dot(e, e);
      }
    }
    if (w.smooth) { let s = 0; for (let i = 0; i < qq.length; i++) { const d = qq[i] - qPrev[i]; s += d * d; } L += w.smooth * s; }
    if (w.reg) { let s = 0; for (let i = 0; i < qq.length; i++) s += qq[i] * qq[i]; L += w.reg * s; }
    return L;
  }

  // ---------- projected gradient descent ------------------------------------
  /* Coordinate descent with a shrinking trust radius.  With 20 joints and a
     forward-kinematics evaluation this cheap it beats a plain gradient step on
     this cost, whose terms differ by two orders of magnitude in scale. */
  function solve(hand, tg, q0, w, opts) {
    const o = Object.assign({ sweeps: 14, step: 0.30, minStep: 1.5e-3 }, opts);
    const n = hand.n, pairs = hand.k.relative_pairs, gate = hand.k.pinch_gate_sq;
    const q = Float64Array.from(q0), qPrev = Float64Array.from(q0);
    const C = (x) => cost(hand.fk(x), tg, x, qPrev, w, pairs, gate);
    let f = C(q), step = o.step, evals = 1;
    for (let s = 0; s < o.sweeps && step > o.minStep; s++) {
      let improved = false;
      for (let i = 0; i < n; i++) {
        const save = q[i];
        for (const d of [step, -step]) {
          const v = Math.min(hand.hi[i], Math.max(hand.lo[i], save + d));
          if (v === save) continue;
          q[i] = v;
          const ft = C(q); evals++;
          if (ft < f - 1e-12) { f = ft; improved = true; break; }
          q[i] = save;
        }
      }
      if (!improved) step *= 0.5;
    }
    return { q, f, evals };
  }

  window.GEODEX = { Hand, solve, cost, TIPS, sub, add, dot, norm, mv, mtv, quatToMat, mm };
})();

/* ============================================================================
   localization_engine.js — batch and sliding-window MAP localisation, live.

   The "Lost in the Woods" problem: a wheeled robot with noisy odometry,
   measuring range and bearing to known landmarks. Drag the window size from 1
   (a filter) to the whole trajectory (batch) and watch the estimate, the error
   and the 3-sigma bounds move.

   Same estimator as scripts/tools/estimator.py in the repo: stack every pose in
   the window into one state, linearise, solve one Gauss-Newton system.
   ========================================================================= */
(function () {
  'use strict';
  const wrap = (a) => { a = (a + Math.PI) % (2 * Math.PI); return a < 0 ? a + Math.PI : a - Math.PI; };
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const gauss = (rng) => Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-9)))
                         * Math.cos(2 * Math.PI * rng());

  // ---- linear algebra on small dense systems --------------------------------
  function solve(A, b, n) {
    const M = new Float64Array(n * (n + 1));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) M[i * (n + 1) + j] = A[i * n + j];
      M[i * (n + 1) + n] = b[i];
    }
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) {
        if (Math.abs(M[r * (n + 1) + c]) > Math.abs(M[piv * (n + 1) + c])) piv = r;
      }
      if (piv !== c) {
        for (let j = c; j <= n; j++) {
          const t = M[c * (n + 1) + j]; M[c * (n + 1) + j] = M[piv * (n + 1) + j]; M[piv * (n + 1) + j] = t;
        }
      }
      const d = M[c * (n + 1) + c] || 1e-12;
      for (let j = c; j <= n; j++) M[c * (n + 1) + j] /= d;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r * (n + 1) + c];
        if (!f) continue;
        for (let j = c; j <= n; j++) M[r * (n + 1) + j] -= f * M[c * (n + 1) + j];
      }
    }
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) x[i] = M[i * (n + 1) + n];
    return x;
  }

  // ---- the problem -----------------------------------------------------------
  const PR = { dt: 0.1, sv: 0.15, sw: 0.06, sr: 0.08, sb: 0.03, maxRange: 4.0 };

  function makeProblem(T, nLand, seed, blackout) {
    const rng = mulberry32(seed);
    const p = { T, dt: PR.dt, land: [], obs: [], visible: new Int32Array(T + 1) };
    p.u = []; p.xTrue = [[0, 0, 0]];
    for (let k = 0; k < T; k++) {
      const t = k * PR.dt;
      const v = 0.6 + 0.25 * Math.sin(0.35 * t);
      const w = 0.9 * Math.sin(0.21 * t) + 0.35 * Math.sin(0.07 * t);
      p.u.push([v, w]);
      const x = p.xTrue[k];
      p.xTrue.push([x[0] + PR.dt * v * Math.cos(x[2]),
                    x[1] + PR.dt * v * Math.sin(x[2]),
                    wrap(x[2] + PR.dt * w)]);
    }
    let lo = [1e9, 1e9], hi = [-1e9, -1e9];
    p.xTrue.forEach((x) => {
      lo[0] = Math.min(lo[0], x[0]); lo[1] = Math.min(lo[1], x[1]);
      hi[0] = Math.max(hi[0], x[0]); hi[1] = Math.max(hi[1], x[1]);
    });
    for (let j = 0; j < nLand; j++) {
      p.land.push([lo[0] - 1.5 + rng() * (hi[0] - lo[0] + 3),
                   lo[1] - 1.5 + rng() * (hi[1] - lo[1] + 3)]);
    }
    p.uMeas = p.u.map(([v, w]) => [v + gauss(rng) * PR.sv, w + gauss(rng) * PR.sw]);
    for (let k = 0; k <= T; k++) {
      const rows = [];
      const dark = blackout && k >= blackout[0] && k < blackout[1];
      if (!dark) {
        p.land.forEach((lm, j) => {
          const dx = lm[0] - p.xTrue[k][0], dy = lm[1] - p.xTrue[k][1];
          const r = Math.hypot(dx, dy);
          if (r < PR.maxRange) {
            rows.push([j, r + gauss(rng) * PR.sr,
                       wrap(Math.atan2(dy, dx) - p.xTrue[k][2] + gauss(rng) * PR.sb)]);
          }
        });
      }
      p.obs.push(rows);
      p.visible[k] = rows.length;
    }
    return p;
  }

  const f = (p, x, u) => [x[0] + p.dt * u[0] * Math.cos(x[2]),
                          x[1] + p.dt * u[0] * Math.sin(x[2]),
                          wrap(x[2] + p.dt * u[1])];

  function deadReckon(p) {
    const out = [[0, 0, 0]];
    for (let k = 0; k < p.T; k++) out.push(f(p, out[k], p.uMeas[k]));
    return out;
  }

  /** Gauss-Newton over poses k0..k1, with an optional prior on the first. */
  function gaussNewton(p, k0, k1, init, priorMean, priorCov, iters) {
    const n = k1 - k0 + 1, N = 3 * n;
    const x = init.map((v) => v.slice());
    const qi = [1 / (PR.sv * PR.sv), 1 / (PR.sv * PR.sv), 1 / (PR.sw * PR.sw)];
    const ri = [1 / (PR.sr * PR.sr), 1 / (PR.sb * PR.sb)];
    let A = null;
    for (let it = 0; it < (iters || 5); it++) {
      A = new Float64Array(N * N);
      const b = new Float64Array(N);
      if (priorCov) {
        for (let i = 0; i < 3; i++) {
          const pi = 1 / Math.max(priorCov[i], 1e-9);
          A[i * N + i] += pi;
          let e = priorMean[i] - x[0][i];
          if (i === 2) e = wrap(e);
          b[i] += pi * e;
        }
      }
      for (let i = 1; i < n; i++) {
        const k = k0 + i;
        const prev = x[i - 1], u = p.uMeas[k - 1];
        const pred = f(p, prev, u);
        const e = [pred[0] - x[i][0], pred[1] - x[i][1], wrap(pred[2] - x[i][2])];
        // dF/dprev
        const F = [[1, 0, -p.dt * u[0] * Math.sin(prev[2])],
                   [0, 1, p.dt * u[0] * Math.cos(prev[2])],
                   [0, 0, 1]];
        const a0 = 3 * (i - 1), c0 = 3 * i;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            let s = 0;
            for (let m = 0; m < 3; m++) s += F[m][r] * qi[m] * F[m][c];
            A[(a0 + r) * N + a0 + c] += s;
            A[(a0 + r) * N + c0 + c] += -F[c][r] * qi[c];
            A[(c0 + r) * N + a0 + c] += -qi[r] * F[r][c];
          }
          A[(c0 + r) * N + c0 + r] += qi[r];
          let s = 0;
          for (let m = 0; m < 3; m++) s += F[m][r] * qi[m] * e[m];
          b[a0 + r] += -s;
          b[c0 + r] += qi[r] * e[r];
        }
      }
      for (let i = 0; i < n; i++) {
        const k = k0 + i, s0 = 3 * i, xi = x[i];
        for (const [j, rr, bb] of p.obs[k]) {
          const dx = p.land[j][0] - xi[0], dy = p.land[j][1] - xi[1];
          const r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
          const H = [[-dx / r, -dy / r, 0], [dy / r2, -dx / r2, -1]];
          const e = [rr - r, wrap(bb - wrap(Math.atan2(dy, dx) - xi[2]))];
          for (let a = 0; a < 3; a++) {
            for (let c = 0; c < 3; c++) {
              A[(s0 + a) * N + s0 + c] += H[0][a] * ri[0] * H[0][c] + H[1][a] * ri[1] * H[1][c];
            }
            b[s0 + a] += H[0][a] * ri[0] * e[0] + H[1][a] * ri[1] * e[1];
          }
        }
      }
      for (let i = 0; i < N; i++) A[i * N + i] += 1e-9;
      const d = solve(A, b, N);
      let maxd = 0;
      for (let i = 0; i < n; i++) {
        x[i][0] += d[3 * i]; x[i][1] += d[3 * i + 1];
        x[i][2] = wrap(x[i][2] + d[3 * i + 2]);
        for (let c = 0; c < 3; c++) maxd = Math.max(maxd, Math.abs(d[3 * i + c]));
      }
      if (maxd < 1e-6) break;
    }
    // marginal variance of the last pose, by solving A z = e_i
    const varLast = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const e = new Float64Array(N); e[N - 3 + c] = 1;
      const z = solve(A, e, N);
      varLast[c] = Math.max(z[N - 3 + c], 1e-12);
    }
    return { x, varLast };
  }

  function estimate(p, window) {
    const dr = deadReckon(p);
    if (window === null) {
      const t0 = performance.now();
      const r = gaussNewton(p, 0, p.T, dr, null, null, 6);
      return { est: r.x, cov: null, ms: performance.now() - t0 };
    }
    const est = [dr[0].slice()];
    const cov = [[1e-4, 1e-4, 1e-4]];
    const t0 = performance.now();
    for (let k = 1; k <= p.T; k++) {
      const k0 = Math.max(0, k - window);
      const init = [];
      for (let i = k0; i < k; i++) init.push(est[i].slice());
      init.push(f(p, est[k - 1], p.uMeas[k - 1]));
      const r = gaussNewton(p, k0, k, init, est[k0], cov[k0], 4);
      for (let i = k0; i <= k; i++) est[i] = r.x[i - k0];
      cov[k] = r.varLast;
    }
    return { est, cov, ms: performance.now() - t0 };
  }

  window.LOCALIZATION = { makeProblem, deadReckon, estimate, wrap, mulberry32, PR };
})();

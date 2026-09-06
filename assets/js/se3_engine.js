/* ============================================================================
   se3_engine.js — SE(3) batch and sliding-window MAP estimation.

   The Assignment 3 problem: a vehicle carrying an IMU (which measures the
   body-frame twist) and a stereo camera (which sees known 3-D landmarks).
   Every pose from k0 to k1 is stacked into one state and solved for at once.

       motion       T_k = exp(dt * varpi_k^) T_{k-1}
       measurement  y_k^j = (1/z) M T_cv T_k p^j        (4 numbers, stereo)
       e_v,k = ln( Xi_k T_{k-1} T_k^-1 )^v
       e_y   = y - h(T_k, p^j)

   Gauss-Newton with a left perturbation T <- exp(eps^) T, so the Jacobians are
   the adjoint and circle-dot expressions rather than anything Euler-angled.
   Same equations as scripts/tools/se3.py in the repo.
   ========================================================================= */
(function () {
  'use strict';

  // ---- small matrix helpers (row-major, 4x4 and 3x3) ------------------------
  const I4 = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  function mul4(A, B) {
    const C = new Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += A[i * 4 + k] * B[k * 4 + j];
        C[i * 4 + j] = s;
      }
    }
    return C;
  }
  function inv4rt(T) {           // inverse of a rigid transform
    const R = [T[0],T[1],T[2], T[4],T[5],T[6], T[8],T[9],T[10]];
    const t = [T[3], T[7], T[11]];
    const Rt = [R[0],R[3],R[6], R[1],R[4],R[7], R[2],R[5],R[8]];
    const p = [-(Rt[0]*t[0]+Rt[1]*t[1]+Rt[2]*t[2]),
               -(Rt[3]*t[0]+Rt[4]*t[1]+Rt[5]*t[2]),
               -(Rt[6]*t[0]+Rt[7]*t[1]+Rt[8]*t[2])];
    return [Rt[0],Rt[1],Rt[2],p[0], Rt[3],Rt[4],Rt[5],p[1], Rt[6],Rt[7],Rt[8],p[2], 0,0,0,1];
  }
  const apply4 = (T, p) => [T[0]*p[0]+T[1]*p[1]+T[2]*p[2]+T[3],
                            T[4]*p[0]+T[5]*p[1]+T[6]*p[2]+T[7],
                            T[8]*p[0]+T[9]*p[1]+T[10]*p[2]+T[11]];

  function expSO3(phi) {
    const a = Math.hypot(phi[0], phi[1], phi[2]);
    if (a < 1e-9) return [1,-phi[2],phi[1], phi[2],1,-phi[0], -phi[1],phi[0],1];
    const ax = [phi[0]/a, phi[1]/a, phi[2]/a];
    const K = [0,-ax[2],ax[1], ax[2],0,-ax[0], -ax[1],ax[0],0];
    const s = Math.sin(a), c = 1 - Math.cos(a);
    const KK = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      let v = 0; for (let k = 0; k < 3; k++) v += K[i*3+k]*K[k*3+j];
      KK[i*3+j] = v;
    }
    const R = new Array(9);
    for (let i = 0; i < 9; i++) R[i] = (i % 4 === 0 ? 1 : 0) + s*K[i] + c*KK[i];
    return R;
  }
  function leftJ(phi) {
    const a = Math.hypot(phi[0], phi[1], phi[2]);
    if (a < 1e-9) return [1,-0.5*phi[2],0.5*phi[1], 0.5*phi[2],1,-0.5*phi[0], -0.5*phi[1],0.5*phi[0],1];
    const ax = [phi[0]/a, phi[1]/a, phi[2]/a];
    const K = [0,-ax[2],ax[1], ax[2],0,-ax[0], -ax[1],ax[0],0];
    const s = Math.sin(a)/a, c = (1-Math.cos(a))/a, d = 1 - s;
    const J = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      J[i*3+j] = s*(i===j?1:0) + d*ax[i]*ax[j] + c*K[i*3+j];
    }
    return J;
  }
  function expSE3(xi) {
    const rho = [xi[0],xi[1],xi[2]], phi = [xi[3],xi[4],xi[5]];
    const R = expSO3(phi), J = leftJ(phi);
    const t = [J[0]*rho[0]+J[1]*rho[1]+J[2]*rho[2],
               J[3]*rho[0]+J[4]*rho[1]+J[5]*rho[2],
               J[6]*rho[0]+J[7]*rho[1]+J[8]*rho[2]];
    return [R[0],R[1],R[2],t[0], R[3],R[4],R[5],t[1], R[6],R[7],R[8],t[2], 0,0,0,1];
  }
  function logSE3(T) {
    const tr = T[0] + T[5] + T[10];
    const a = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
    let phi;
    if (a < 1e-9) phi = [(T[9]-T[6])/2, (T[2]-T[8])/2, (T[4]-T[1])/2];
    else {
      const k = a / (2 * Math.sin(a));
      phi = [k*(T[9]-T[6]), k*(T[2]-T[8]), k*(T[4]-T[1])];
    }
    const J = leftJ(phi);
    // rho = J^-1 t, by 3x3 solve
    const t = [T[3], T[7], T[11]];
    const rho = solve3(J, t);
    return [rho[0],rho[1],rho[2], phi[0],phi[1],phi[2]];
  }
  function solve3(A, b) {
    const M = [A[0],A[1],A[2],b[0], A[3],A[4],A[5],b[1], A[6],A[7],A[8],b[2]];
    for (let c = 0; c < 3; c++) {
      let piv = c;
      for (let r = c+1; r < 3; r++) if (Math.abs(M[r*4+c]) > Math.abs(M[piv*4+c])) piv = r;
      if (piv !== c) for (let j = 0; j < 4; j++) { const t = M[c*4+j]; M[c*4+j] = M[piv*4+j]; M[piv*4+j] = t; }
      const d = M[c*4+c] || 1e-12;
      for (let j = c; j < 4; j++) M[c*4+j] /= d;
      for (let r = 0; r < 3; r++) {
        if (r === c) continue;
        const f = M[r*4+c];
        for (let j = c; j < 4; j++) M[r*4+j] -= f * M[c*4+j];
      }
    }
    return [M[3], M[7], M[11]];
  }
  function adjoint(T) {           // 6x6, row-major
    const R = [T[0],T[1],T[2], T[4],T[5],T[6], T[8],T[9],T[10]];
    const t = [T[3], T[7], T[11]];
    const tx = [0,-t[2],t[1], t[2],0,-t[0], -t[1],t[0],0];
    const txR = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      let s = 0; for (let k = 0; k < 3; k++) s += tx[i*3+k]*R[k*3+j];
      txR[i*3+j] = s;
    }
    const A = new Float64Array(36);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      A[i*6+j] = R[i*3+j];
      A[i*6+3+j] = txR[i*3+j];
      A[(3+i)*6+3+j] = R[i*3+j];
    }
    return A;
  }

  // ---- dense linear solve ----------------------------------------------------
  function solveDense(A, b, n) {
    const M = new Float64Array(n * (n + 1));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) M[i*(n+1)+j] = A[i*n+j];
      M[i*(n+1)+n] = b[i];
    }
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c+1; r < n; r++) if (Math.abs(M[r*(n+1)+c]) > Math.abs(M[piv*(n+1)+c])) piv = r;
      if (piv !== c) for (let j = c; j <= n; j++) { const t = M[c*(n+1)+j]; M[c*(n+1)+j] = M[piv*(n+1)+j]; M[piv*(n+1)+j] = t; }
      const d = M[c*(n+1)+c] || 1e-12;
      for (let j = c; j <= n; j++) M[c*(n+1)+j] /= d;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r*(n+1)+c];
        if (!f) continue;
        for (let j = c; j <= n; j++) M[r*(n+1)+j] -= f * M[c*(n+1)+j];
      }
    }
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) x[i] = M[i*(n+1)+n];
    return x;
  }

  // ---- the problem -----------------------------------------------------------
  const RIG = { fu: 387.8, fv: 387.8, cu: 257.9, cv: 197.0, b: 0.24 };
  const T_CV = [0,-1,0,0, 0,0,-1,0, 1,0,0,0, 0,0,0,1];   // camera looks along +x

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const gauss = (rng) => Math.sqrt(-2*Math.log(Math.max(rng(),1e-9)))*Math.cos(2*Math.PI*rng());

  const project = (pc) => [RIG.fu*pc[0]/pc[2] + RIG.cu,
                           RIG.fv*pc[1]/pc[2] + RIG.cv,
                           RIG.fu*(pc[0]-RIG.b)/pc[2] + RIG.cu,
                           RIG.fv*pc[1]/pc[2] + RIG.cv];

  function makeProblem(o) {
    const T = o.T || 140, dt = 0.1, seed = o.seed || 1;
    const rng = mulberry32(seed);
    const sv = o.sigmaV != null ? o.sigmaV : 0.06;
    const sw = o.sigmaW != null ? o.sigmaW : 0.02;
    const spx = o.sigmaPx != null ? o.sigmaPx : 1.2;
    const p = { T, dt, sv, sw, spx, maxRange: o.maxRange || 12, cosFov: Math.cos(35*Math.PI/180) };

    p.varpi = []; p.Ttrue = [I4()];
    for (let k = 0; k < T; k++) {
      const t = k * dt;
      const v = [1.2, 0.15*Math.sin(0.5*t), 0.20*Math.sin(0.3*t),
                 0.10*Math.sin(0.7*t), 0.12*Math.sin(0.4*t), 0.35*Math.sin(0.22*t)];
      p.varpi.push(v);
      p.Ttrue.push(mul4(expSE3(v.map((x) => x*dt)), p.Ttrue[k]));
    }
    // landmarks around the path (positions are the inverse transform's translation)
    const pos = p.Ttrue.map((T) => inv4rt(T).slice(3,4).concat([]) && [inv4rt(T)[3], inv4rt(T)[7], inv4rt(T)[11]]);
    let lo = [1e9,1e9,1e9], hi = [-1e9,-1e9,-1e9];
    pos.forEach((q) => { for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], q[i]); hi[i] = Math.max(hi[i], q[i]); } });
    p.pos = pos;
    p.land = [];
    const nl = o.nLand || 40;
    for (let j = 0; j < nl; j++) {
      p.land.push([lo[0]-6 + rng()*(hi[0]-lo[0]+12),
                   lo[1]-6 + rng()*(hi[1]-lo[1]+12),
                   lo[2]-6 + rng()*(hi[2]-lo[2]+12)]);
    }
    p.varpiMeas = p.varpi.map((v) => v.map((x, i) => x + gauss(rng)*(i < 3 ? sv : sw)));

    p.obs = []; p.visible = [];
    const bl = o.blackout;
    for (let k = 0; k <= T; k++) {
      const rows = [];
      const dark = bl && k >= bl[0] && k < bl[1];
      if (!dark) {
        const TcvT = mul4(T_CV, p.Ttrue[k]);
        p.land.forEach((lm, j) => {
          const pc = apply4(TcvT, lm);
          const r = Math.hypot(pc[0], pc[1], pc[2]);
          if (pc[2] < 0.5 || r > p.maxRange || pc[2]/r < p.cosFov) return;
          const y = project(pc).map((v) => v + gauss(rng)*spx);
          rows.push([j, y]);
        });
      }
      p.obs.push(rows); p.visible.push(rows.length);
    }
    return p;
  }

  function deadReckon(p) {
    const out = [I4()];
    for (let k = 0; k < p.T; k++) out.push(mul4(expSE3(p.varpiMeas[k].map((x) => x*p.dt)), out[k]));
    return out;
  }

  /** 4x6 measurement Jacobian for a left perturbation of T_k. */
  function measJ(Tk, lm) {
    const pv = apply4(Tk, lm);                       // vehicle frame
    const pc = apply4(T_CV, pv);                     // camera frame
    const z = pc[2], z2 = z*z;
    const dP = [RIG.fu/z, 0, -RIG.fu*pc[0]/z2,
                0, RIG.fv/z, -RIG.fv*pc[1]/z2,
                RIG.fu/z, 0, -RIG.fu*(pc[0]-RIG.b)/z2,
                0, RIG.fv/z, -RIG.fv*pc[1]/z2];
    // circle-dot of pv: [I3 | -hat(pv)]  (3x6)
    const cd = [1,0,0, 0,pv[2],-pv[1],
                0,1,0, -pv[2],0,pv[0],
                0,0,1, pv[1],-pv[0],0];
    // T_CV rotation (3x3) applied to circle-dot
    const R = [T_CV[0],T_CV[1],T_CV[2], T_CV[4],T_CV[5],T_CV[6], T_CV[8],T_CV[9],T_CV[10]];
    const Rcd = new Float64Array(18);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 6; j++) {
      let s = 0; for (let k = 0; k < 3; k++) s += R[i*3+k]*cd[k*6+j];
      Rcd[i*6+j] = s;
    }
    const H = new Float64Array(24);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) {
      let s = 0; for (let k = 0; k < 3; k++) s += dP[i*3+k]*Rcd[k*6+j];
      H[i*6+j] = s;
    }
    return { H, pc };
  }

  function gaussNewton(p, k0, k1, init, priorT, priorVar, iters) {
    const n = k1 - k0 + 1, N = 6*n;
    const Ts = init.map((T) => T.slice());
    const qi = [1/(p.sv*p.sv),1/(p.sv*p.sv),1/(p.sv*p.sv),
                1/(p.sw*p.sw),1/(p.sw*p.sw),1/(p.sw*p.sw)];
    const ri = 1/(p.spx*p.spx);
    let A = null;
    for (let it = 0; it < (iters || 4); it++) {
      A = new Float64Array(N*N);
      const b = new Float64Array(N);
      if (priorVar) {
        const e = logSE3(mul4(priorT, inv4rt(Ts[0])));
        for (let i = 0; i < 6; i++) {
          const pi = 1/Math.max(priorVar[i], 1e-12);
          A[i*N+i] += pi; b[i] += pi*e[i];
        }
      }
      for (let i = 1; i < n; i++) {
        const k = k0 + i;
        const Xi = expSE3(p.varpiMeas[k-1].map((x) => x*p.dt));
        const e = logSE3(mul4(mul4(Xi, Ts[i-1]), inv4rt(Ts[i])));
        const F = adjoint(Xi);
        const a0 = 6*(i-1), c0 = 6*i;
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 6; c++) {
            let s = 0; for (let m = 0; m < 6; m++) s += F[m*6+r]*qi[m]*F[m*6+c];
            A[(a0+r)*N + a0+c] += s;
            A[(a0+r)*N + c0+c] += -F[c*6+r]*qi[c];
            A[(c0+r)*N + a0+c] += -qi[r]*F[r*6+c];
          }
          A[(c0+r)*N + c0+r] += qi[r];
          let s = 0; for (let m = 0; m < 6; m++) s += F[m*6+r]*qi[m]*e[m];
          b[a0+r] += -s;
          b[c0+r] += qi[r]*e[r];
        }
      }
      for (let i = 0; i < n; i++) {
        const k = k0 + i, s0 = 6*i;
        for (const [j, y] of p.obs[k]) {
          const { H, pc } = measJ(Ts[i], p.land[j]);
          if (pc[2] < 0.2) continue;
          const yh = project(pc);
          const e = [y[0]-yh[0], y[1]-yh[1], y[2]-yh[2], y[3]-yh[3]];
          for (let a = 0; a < 6; a++) {
            for (let c = 0; c < 6; c++) {
              let s = 0; for (let m = 0; m < 4; m++) s += H[m*6+a]*ri*H[m*6+c];
              A[(s0+a)*N + s0+c] += s;
            }
            let s = 0; for (let m = 0; m < 4; m++) s += H[m*6+a]*ri*e[m];
            b[s0+a] += s;
          }
        }
      }
      for (let i = 0; i < N; i++) A[i*N+i] += 1e-8;
      const d = solveDense(A, b, N);
      let maxd = 0;
      for (let i = 0; i < n; i++) {
        Ts[i] = mul4(expSE3(Array.from(d.slice(6*i, 6*i+6))), Ts[i]);
        for (let c = 0; c < 6; c++) maxd = Math.max(maxd, Math.abs(d[6*i+c]));
      }
      if (maxd < 1e-9) break;
    }
    const varLast = new Array(6).fill(1e-9);
    for (let c = 0; c < 6; c++) {
      const e = new Float64Array(N); e[N-6+c] = 1;
      const z = solveDense(A, e, N);
      varLast[c] = Math.max(z[N-6+c], 1e-14);
    }
    return { Ts, varLast };
  }

  function estimate(p, window) {
    const dr = deadReckon(p);
    const t0 = performance.now();
    if (window === null) {
      const r = gaussNewton(p, 0, p.T, dr, null, null, 5);
      return { est: r.Ts, cov: null, ms: performance.now() - t0 };
    }
    const est = [dr[0].slice()];
    const cov = [[1e-6,1e-6,1e-6,1e-6,1e-6,1e-6]];
    for (let k = 1; k <= p.T; k++) {
      const k0 = Math.max(0, k - window);
      const init = [];
      for (let i = k0; i < k; i++) init.push(est[i].slice());
      init.push(mul4(expSE3(p.varpiMeas[k-1].map((x) => x*p.dt)), est[k-1]));
      const r = gaussNewton(p, k0, k, init, est[k0], cov[k0], 3);
      for (let i = k0; i <= k; i++) est[i] = r.Ts[i-k0];
      cov[k] = r.varLast;
    }
    return { est, cov, ms: performance.now() - t0 };
  }

  const positions = (Ts) => Ts.map((T) => { const J = inv4rt(T); return [J[3], J[7], J[11]]; });

  window.SE3 = { makeProblem, deadReckon, estimate, positions, logSE3, expSE3,
                 mul4, inv4rt, mulberry32, RIG };
})();

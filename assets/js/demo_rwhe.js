/* Live demo: certifiably correct robot-world / hand-eye calibration (Wise et al., IJRR 2025).
   Choose X (hand -> camera), Y (base -> target), the noise and the number of poses; the camera
   orbits the target, A_i X = Y B_i loops are generated, and three solvers run in the browser:
   the linear two-stage closed form, a local Levenberg-Marquardt solver from random starts (which
   can end in local minima), and the semidefinite relaxation solved by an ADMM iteration with the
   duality-gap certificate.  Everything is logged and plotted live. */
(function () {
  "use strict";
  var LA = CD.la, DEG = 180 / Math.PI;
  function mv(R, v) { return [R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]]; }
  function add(a, b, s) { s = s === undefined ? 1 : s; return [a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2]]; }
  function norm(a) { return Math.hypot(a[0], a[1], a[2]); }
  function se3(R, t) { return { R: R, t: t }; }
  function compose(A, B) { return se3(LA.mul(A.R, B.R), add(A.t, mv(A.R, B.t))); }
  function inv(T) { var Rt = LA.T(T.R); return se3(Rt, mv(Rt, T.t).map(function (x) { return -x; })); }
  function rpy(r, p, y) { return LA.mul(LA.rotvec([0, 0, y]), LA.mul(LA.rotvec([0, p, 0]), LA.rotvec([r, 0, 0]))); }
  function rotErr(R1, R2) { return norm(LA.logRot(LA.mul(LA.T(R1), R2))) * DEG; }
  function vec(R) { return [R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2]]; }   /* column-major */
  function unvec(v) { return [[v[0], v[3], v[6]], [v[1], v[4], v[7]], [v[2], v[5], v[8]]]; }
  function kron3(B, Aop) {   /* kron(B^T, I3) or kron(I3, A): returns 9x9 for vec(A X B) = kron(B^T, A) vec(X) */
    var K = LA.zeros(9, 9); for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) for (var k = 0; k < 3; k++) for (var l = 0; l < 3; l++) K[3 * i + k][3 * j + l] = B[j][i] * Aop[k][l]; return K; }
  function langevin(kappa, rng) { var f = function (th) { return Math.exp(2 * kappa * (Math.cos(th) - 1)) * (1 - Math.cos(th)); }; var fmax = 0; for (var i = 0; i <= 200; i++) fmax = Math.max(fmax, f(Math.PI * i / 200)); var th; for (var k = 0; k < 10000; k++) { th = rng() * Math.PI; if (rng() * fmax < f(th)) break; } var ax = [rng.normal(), rng.normal(), rng.normal()], n = norm(ax); return LA.rotvec([ax[0] / n * th, ax[1] / n * th, ax[2] / n * th]); }

  /* ---------- problem: full quadratic cost Q over x = [tX(3), tY(3), s, rX(9), rY(9)] ---------- */
  function buildQ(A, B, kappa, sigma) {
    var N = 25, Q = LA.zeros(N, N), I3 = LA.eye(3);
    for (var i = 0; i < A.length; i++) {
      var MR = LA.zeros(9, N), K1 = kron3(I3, A[i].R), K2 = kron3(B[i].R, I3);     /* vec(RA RX) = kron(I, RA) rX ; vec(RY RB) = kron(RB^T, I) rY */
      for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) { MR[r][7 + c] = K1[r][c]; MR[r][16 + c] = -K2[r][c]; }
      var Mt = LA.zeros(3, N); for (var r2 = 0; r2 < 3; r2++) { for (var c2 = 0; c2 < 3; c2++) { Mt[r2][c2] = A[i].R[r2][c2]; } Mt[r2][3 + r2] = -1; Mt[r2][6] = A[i].t[r2]; for (var c3 = 0; c3 < 3; c3++) Mt[r2][16 + 3 * c3 + r2] = -B[i].t[c3]; }  /* RY tB = kron(tB^T, I) rY */
      for (var p = 0; p < N; p++) for (var q = 0; q < N; q++) { var s = 0; for (var k = 0; k < 9; k++) s += kappa * MR[k][p] * MR[k][q]; for (var k2 = 0; k2 < 3; k2++) s += Mt[k2][p] * Mt[k2][q] / (sigma * sigma); Q[p][q] += s; }
    }
    return LA.scale(Q, 0.5);
  }
  function reduceQ(Q) {   /* eliminate the translations: keep [rX, rY, s] with s last */
    var elim = [0, 1, 2, 3, 4, 5], keep = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 6];
    var Qtt = LA.zeros(6, 6), Qtr = LA.zeros(6, 19), Qrr = LA.zeros(19, 19);
    for (var i = 0; i < 6; i++) { for (var j = 0; j < 6; j++) Qtt[i][j] = Q[elim[i]][elim[j]]; for (var k = 0; k < 19; k++) Qtr[i][k] = Q[elim[i]][keep[k]]; }
    for (var a = 0; a < 19; a++) for (var b = 0; b < 19; b++) Qrr[a][b] = Q[keep[a]][keep[b]];
    var Qi = LA.inv(Qtt), back = LA.scale(LA.mul(Qi, Qtr), -1), Qp = LA.add(Qrr, LA.mul(LA.T(Qtr), LA.mul(Qi, Qtr)), -1);
    return { Qp: Qp, back: back };
  }
  function cost(A, B, X, Y, kappa, sigma) { var J = 0; for (var i = 0; i < A.length; i++) { var RA = A[i].R, RB = B[i].R, e1 = LA.add(LA.mul(RA, X.R), LA.mul(Y.R, RB), -1); for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) J += 0.5 * kappa * e1[r][c] * e1[r][c]; var et = add(add(mv(RA, X.t), A[i].t), add(Y.t, mv(Y.R, B[i].t)), -1); J += 0.5 * (et[0] * et[0] + et[1] * et[1] + et[2] * et[2]) / (sigma * sigma); } return J; }

  /* ---------- SDP relaxation solved by ADMM on Z (19x19) with the 21 SO(3) constraints per rotation ---------- */
  function constraints() {   /* each constraint: list of [i, j, coef] with sum coef*Z[i][j] = rhs(=0), s index 18; plus Z[18][18] = 1 */
    var cons = [], s = 18;
    for (var l = 0; l < 2; l++) { var c = [9 * l, 9 * l + 3, 9 * l + 6];
      for (var i = 0; i < 3; i++) for (var j = i; j < 3; j++) { var terms = []; for (var m = 0; m < 3; m++) terms.push([c[i] + m, c[j] + m, 1]); if (i === j) terms.push([s, s, -1]); cons.push(terms); }   /* R^T R = s^2 I */
      for (var a = 0; a < 3; a++) for (var b = a; b < 3; b++) { var t2 = []; for (var k = 0; k < 3; k++) t2.push([c[k] + a, c[k] + b, 1]); if (a === b) t2.push([s, s, -1]); cons.push(t2); }   /* R R^T = s^2 I */
      [[0, 1, 2], [1, 2, 0], [2, 0, 1]].forEach(function (pqr) { var p = pqr[0], q = pqr[1], r = pqr[2]; for (var m = 0; m < 3; m++) { var m1 = (m + 1) % 3, m2 = (m + 2) % 3; cons.push([[c[p] + m1, c[q] + m2, 1], [c[p] + m2, c[q] + m1, -1], [s, c[r] + m, -1]]); } });   /* c_p x c_q = s c_r */
    }
    return cons;
  }
  function sdpADMM(Qp, opts, onIter) {
    /* min <Q,Z>  s.t. A(Z) = b, Z >= 0.   Splitting: X (affine), Z (PSD).  Scaled ADMM with rho.
       Affine projection: symmetric constraint matrices C_k (unit-normalised), b_k; project by solving the small Gram system. */
    var n = 19, cons = constraints(), K = cons.length + 1, scale = 0; for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) scale = Math.max(scale, Math.abs(Qp[i][j]));
    var Qs = LA.scale(Qp, 1 / scale);
    var Cm = [], b = [];
    cons.forEach(function (terms) { var M = LA.zeros(n, n); terms.forEach(function (t) { M[t[0]][t[1]] += t[2] / 2; M[t[1]][t[0]] += t[2] / 2; }); Cm.push(M); b.push(0); });
    var Ms = LA.zeros(n, n); Ms[n - 1][n - 1] = 1; Cm.push(Ms); b.push(1);
    var G = LA.zeros(K, K); for (var p = 0; p < K; p++) for (var q = p; q < K; q++) { var s = 0; for (var i2 = 0; i2 < n; i2++) for (var j2 = 0; j2 < n; j2++) s += Cm[p][i2][j2] * Cm[q][i2][j2]; G[p][q] = s; G[q][p] = s; }
    var Ginv = LA.pinvSym(G, 1e-9);   /* the 43 constraint matrices are linearly dependent */
    var dot = function (M1, M2) { var s = 0; for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) s += M1[i][j] * M2[i][j]; return s; };
    var projAffine = function (W) { var r = new Float64Array(K); for (var k = 0; k < K; k++) r[k] = dot(Cm[k], W) - b[k]; var lam = LA.mulv(Ginv, r); var out = W.map(function (row) { return Float64Array.from(row); }); for (var k2 = 0; k2 < K; k2++) { var l = lam[k2]; if (l === 0) continue; for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) out[i][j] -= l * Cm[k2][i][j]; } return { X: out, lam: lam }; };
    var projPSD = function (W) { var e = LA.eigSym(W), V = e.vectors, out = LA.zeros(n, n); for (var k = 0; k < n; k++) { var v = Math.max(e.values[k], 0); if (v === 0) continue; for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) out[i][j] += v * V[i][k] * V[j][k]; } return out; };
    var rho = opts.rho || 1.0, Z = LA.eye(n), U = LA.zeros(n, n), Xa = null, lamK = null, it, hist = [];
    for (it = 1; it <= (opts.maxIter || 3000); it++) {
      var W = LA.add(LA.add(Z, U, -1), Qs, -1 / rho);        /* argmin <Q,X> + rho/2 ||X - Z + U||^2 over the affine set */
      var pa = projAffine(W); Xa = pa.X; lamK = pa.lam;
      var Znew = projPSD(LA.add(Xa, U)); var rp = 0, rd = 0; for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) { var d1 = Xa[i][j] - Znew[i][j]; rp += d1 * d1; var d2 = Znew[i][j] - Z[i][j]; rd += d2 * d2; U[i][j] += Xa[i][j] - Znew[i][j]; }
      Z = Znew; rp = Math.sqrt(rp); rd = rho * Math.sqrt(rd);
      if (it % 10 === 0 || it < 5) { var pv = dot(Qs, Z) * scale; hist.push({ it: it, primal: pv, rp: rp, rd: rd }); if (onIter) onIter(it, pv, rp, rd); }
      if (rp < (opts.tol || 1e-9) && rd < (opts.tol || 1e-9)) break;
      if (it % 25 === 0 && it < 3000) { var f = 1; if (rp > 5 * rd) f = 2; else if (rd > 5 * rp) f = 0.5; if (f !== 1) { rho = Math.min(1e3, Math.max(1e-3, rho * f)); for (var a = 0; a < n; a++) for (var b2 = 0; b2 < n; b2++) U[a][b2] /= f; } }   /* residual balancing; the scaled dual U = y/rho must follow rho */
    }
    /* dual value from the affine multipliers of the last step: y = rho * lam  (up to sign); use it only as a lower bound estimate */
    var dual = 0; if (lamK) { dual = -lamK[K - 1] * rho * scale; }
    return { Z: Z, iters: it, hist: hist, primal: dot(Qs, Z) * scale, dual: dual };
  }
  function roundZ(Z, back) {   /* leading eigenvector -> r, s = 1; SO(3) projection; translations */
    var e = LA.eigSym(Z), n = 19, k = 0; for (var i = 1; i < n; i++) if (e.values[i] > e.values[k]) k = i;
    var v = []; for (var i2 = 0; i2 < n; i2++) v.push(e.vectors[i2][k]); if (v[18] < 0) v = v.map(function (x) { return -x; }); v = v.map(function (x) { return x / v[18]; });
    var RX = LA.projSO3(unvec(v.slice(0, 9))), RY = LA.projSO3(unvec(v.slice(9, 18)));
    var rs = vec(RX).concat(vec(RY)).concat([1]), t = LA.mulv(back, rs);
    var ratio = e.values.slice().sort(function (a, b) { return b - a; }); return { X: se3(RX, [t[0], t[1], t[2]]), Y: se3(RY, [t[3], t[4], t[5]]), eigRatio: Math.max(ratio[1], 0) / ratio[0], rvec: rs };
  }

  /* ---------- baselines ---------- */
  function linearSolve(A, B, kappa, sigma) {   /* smallest eigenvector of the rotation-only cost, SO(3) projection, translations by LS */
    var QR = LA.zeros(18, 18), I3 = LA.eye(3);
    for (var i = 0; i < A.length; i++) { var K1 = kron3(I3, A[i].R), K2 = kron3(B[i].R, I3); for (var r = 0; r < 9; r++) { var row = new Float64Array(18); for (var c = 0; c < 9; c++) { row[c] = K1[r][c]; row[9 + c] = -K2[r][c]; } for (var p = 0; p < 18; p++) for (var q = 0; q < 18; q++) QR[p][q] += kappa * row[p] * row[q]; } }
    var e = LA.eigSym(QR), k = 0; for (var i2 = 1; i2 < 18; i2++) if (e.values[i2] < e.values[k]) k = i2;
    var v = []; for (var i3 = 0; i3 < 18; i3++) v.push(e.vectors[i3][k]);
    var MX = unvec(v.slice(0, 9)), MY = unvec(v.slice(9, 18)); var det = function (M) { return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]); };
    if (det(MX) < 0) { MX = LA.scale(MX, -1); MY = LA.scale(MY, -1); }
    var RX = LA.projSO3(MX), RY = LA.projSO3(MY);
    var AtA = LA.zeros(6, 6), Atb = new Float64Array(6);
    for (var i4 = 0; i4 < A.length; i4++) { var rhs = add(mv(RY, B[i4].t), A[i4].t, -1); for (var r2 = 0; r2 < 3; r2++) { var row2 = new Float64Array(6); for (var c2 = 0; c2 < 3; c2++) row2[c2] = A[i4].R[r2][c2]; row2[3 + r2] = -1; for (var p2 = 0; p2 < 6; p2++) { Atb[p2] += row2[p2] * rhs[r2]; for (var q2 = 0; q2 < 6; q2++) AtA[p2][q2] += row2[p2] * row2[q2]; } } }
    var t = LA.solve(AtA, Atb); return { X: se3(RX, [t[0], t[1], t[2]]), Y: se3(RY, [t[3], t[4], t[5]]) };
  }
  function localSolve(A, B, kappa, sigma, X0, Y0, maxIter) {   /* LM over [phiX, tX, phiY, tY] with numerical Jacobian on the same objective */
    var x = { X: se3(X0.R, X0.t.slice()), Y: se3(Y0.R, Y0.t.slice()) };
    var resid = function (x) { var r = []; var sk = Math.sqrt(0.5 * kappa), st = Math.sqrt(0.5) / sigma; for (var i = 0; i < A.length; i++) { var e1 = LA.add(LA.mul(A[i].R, x.X.R), LA.mul(x.Y.R, B[i].R), -1); for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) r.push(sk * e1[a][b]); var et = add(add(mv(A[i].R, x.X.t), A[i].t), add(x.Y.t, mv(x.Y.R, B[i].t)), -1); r.push(st * et[0], st * et[1], st * et[2]); } return r; };
    var apply = function (x, d) { return { X: se3(LA.mul(x.X.R, LA.rotvec([d[0], d[1], d[2]])), [x.X.t[0] + d[3], x.X.t[1] + d[4], x.X.t[2] + d[5]]), Y: se3(LA.mul(x.Y.R, LA.rotvec([d[6], d[7], d[8]])), [x.Y.t[0] + d[9], x.Y.t[1] + d[10], x.Y.t[2] + d[11]]) }; };
    var res = resid(x), c = 0; for (var i = 0; i < res.length; i++) c += res[i] * res[i]; var lam = 1e-3, trace = [c], it;
    for (it = 1; it <= (maxIter || 60); it++) {
      var n = res.length, J = []; for (var p = 0; p < 12; p++) { var d = new Array(12).fill(0); d[p] = 1e-6; var rp = resid(apply(x, d)); var col = new Float64Array(n); for (var i2 = 0; i2 < n; i2++) col[i2] = (rp[i2] - res[i2]) / 1e-6; J.push(col); }
      var JtJ = LA.zeros(12, 12), g = new Float64Array(12); for (var p2 = 0; p2 < 12; p2++) { for (var i3 = 0; i3 < n; i3++) g[p2] += J[p2][i3] * res[i3]; for (var q = p2; q < 12; q++) { var s = 0; for (var i4 = 0; i4 < n; i4++) s += J[p2][i4] * J[q][i4]; JtJ[p2][q] = s; JtJ[q][p2] = s; } }
      var acc = false, tries = 0;
      while (!acc && tries < 10) { var Am = JtJ.map(function (row, i) { var rr = Float64Array.from(row); rr[i] *= (1 + lam); return rr; }); var dx = LA.solve(Am, g); var xn = apply(x, Array.from(dx).map(function (v) { return -v; })); var rn = resid(xn), cn = 0; for (var i5 = 0; i5 < rn.length; i5++) cn += rn[i5] * rn[i5];
        if (cn < c) { var rel = (c - cn) / c; x = xn; res = rn; c = cn; lam = Math.max(lam / 3, 1e-9); acc = true; trace.push(c); if (rel < 1e-10) { it++; break; } } else { lam *= 5; tries++; } }
      if (!acc) break;
    }
    return { X: x.X, Y: x.Y, cost: c, trace: trace, iters: it };
  }

  /* ---------- UI ---------- */
  var root = document.getElementById("demo-rwhe"); if (!root) return;
  var $ = function (id) { return root.querySelector("#" + id); };
  var view = null;   /* 2-D fallback; the three.js arm (rwhe_scene3d.js) takes over when it loads */
  function ensureView() { if (!view && !(window.RW3D && window.RW3D.demoView)) { view = new CD.View3($("rw-scene"), { az: -0.8, el: 0.4, scale: 110, center: [0, 0, 0] }); view.onchange = drawScene; } return view; }
  var plotLocal = new CD.Plot($("rw-plot-local"), { title: "local solver: cost vs iteration, 8 random starts", xlabel: "iteration", ylabel: "cost", logy: true });
  var plotSdp = new CD.Plot($("rw-plot-sdp"), { title: "SDP (ADMM): objective and residuals", xlabel: "ADMM iteration", ylabel: "", logy: true });
  var plotErr = new CD.Plot($("rw-plot-err"), { title: "hand→camera error per method", xlabel: "method (1 linear · 2-9 local random · 10 local from linear · 11 SDP)", ylabel: "translation error [mm]", logy: true });
  var log = new CD.Log($("rw-log"));
  var S = { running: false, data: null, sol: null, frame: 0 }, C = CD.colors();
  function readControls() { S.X = se3(rpy(+$("rw-xr").value / DEG, +$("rw-xp").value / DEG, +$("rw-xy").value / DEG), [+$("rw-xt").value / 100, 0.02, -0.03]); S.Y = se3(rpy(0.2, -0.3, +$("rw-yy").value / DEG), [+$("rw-yx").value / 100, 0.3, 0.1]); S.kappa = +$("rw-kappa").value; S.sigma = +$("rw-sigma").value / 100; S.N = +$("rw-N").value;
    $("rw-xr-v").textContent = $("rw-xr").value + "°"; $("rw-xp-v").textContent = $("rw-xp").value + "°"; $("rw-xy-v").textContent = $("rw-xy").value + "°"; $("rw-xt-v").textContent = $("rw-xt").value + " cm"; $("rw-yy-v").textContent = $("rw-yy").value + "°"; $("rw-yx-v").textContent = $("rw-yx").value + " cm"; $("rw-kappa-v").textContent = S.kappa + " (≈" + (Math.sqrt(1 / (2 * S.kappa)) * DEG).toFixed(1) + "°)"; $("rw-sigma-v").textContent = $("rw-sigma").value + " cm"; $("rw-N-v").textContent = S.N; }
  function spherePoses(n, radius) {   /* a spiral from near the pole to near the antipode: consecutive poses are neighbours, so the arm sweeps instead of jumping */
    var out = [], turns = Math.max(2, Math.round(Math.sqrt(n) / 1.6));
    for (var i = 0; i < n; i++) { var u = (i + 0.5) / n, phi = Math.acos(0.85 - 1.7 * u), th = 2 * Math.PI * turns * u; var p = [radius * Math.sin(phi) * Math.cos(th), radius * Math.sin(phi) * Math.sin(th), radius * Math.cos(phi)]; var z = p.map(function (x) { return -x / radius; }); var up = [0, 0, -1], x = LA.cross(up, z), nx = norm(x); if (nx < 1e-6) { x = LA.cross([1, 0, 0], z); nx = norm(x); } x = x.map(function (v) { return v / nx; }); var y = LA.cross(z, x); out.push(se3([[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]], p)); }
    return out; }
  function generate() { var rng = CD.rng(777 + S.N + Math.round(S.kappa) + Math.round(S.sigma * 1000) + Math.round($("rw-xy").value)), Bt = spherePoses(S.N, 1.0), A = [], B = [];
    Bt.forEach(function (Tb) { A.push(compose(compose(S.Y, Tb), inv(S.X))); B.push(se3(LA.mul(Tb.R, langevin(S.kappa, rng)), Tb.t.map(function (x) { return x + S.sigma * rng.normal(); }))); });
    return { A: A, B: B, Bt: Bt }; }
  function tagDraw(T, size, col) { var c = [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]].map(function (v) { return add(T.t, mv(T.R, [size * v[0], size * v[1], 0])); }); for (var i = 0; i < 4; i++) view.line(c[i], c[(i + 1) % 4], col, 2); view.line(c[0], c[2], col, 1); view.line(c[1], c[3], col, 1); }
  function drawScene() {
    C = CD.colors(); var d = S.data;
    if (window.RW3D && window.RW3D.demoView) { var kk = d ? Math.min(S.frame, d.A.length - 1) : 0; window.RW3D.demoView.update({ X: S.X, Y: S.Y, A: d ? d.A[kk] : { R: rpy(0, 0.6, 0.3), t: [0.9, 0.2, 0.2] }, B: d ? d.B[kk] : null, idx: d ? kk : undefined, est: S.sol, reset: !d || kk === 0, snap: !d }); return; }
    if (!ensureView()) return; view.clear();
    var base = [0, 0, -0.9]; view.point(base, C.text, 5); view.text(base, "base", C.text, 8, 0);
    tagDraw(S.Y, 0.18, C.pop); view.text(S.Y.t, "target  Y", C.pop, 8, -12);
    if (d) { var k = Math.min(S.frame, d.A.length - 1); for (var i = 0; i <= k; i += 3) { var cam = compose(d.A[i], S.X); view.frustum(cam.R, cam.t, 0.07, C.blue, 0.8); } var camk = compose(d.A[k], S.X); view.frustum(camk.R, camk.t, 0.14, C.blue, 2); view.line(base, d.A[k].t, C.hi, 1.5); view.point(d.A[k].t, C.hi, 4); view.text(d.A[k].t, "hand A_i", C.hi, 8, -10); view.line(d.A[k].t, camk.t, C.gold, 2.5); view.text(camk.t, "X", C.gold, 8, 8);
      var bm = compose(S.Y, d.B[k]); view.frustum(bm.R, bm.t, 0.14, C.green, 1.2); }
    if (S.sol) { var camE = compose(d.A[Math.min(S.frame, d.A.length - 1)], S.sol.X); view.frustum(camE.R, camE.t, 0.14, C.green, 2.5); tagDraw(S.sol.Y, 0.18, C.green); }
    view.ctx.fillStyle = C.ash; view.ctx.font = "10px 'Jost', sans-serif"; view.ctx.textAlign = "right"; view.ctx.fillText("blue = true camera poses · green = as measured by the camera (noisy B_i) / final estimate · drag to orbit", view.W - 8, view.H - 8);
  }
  function errs(sol, X, Y) { return { tx: 1000 * norm(add(sol.X.t, X.t, -1)), rx: rotErr(sol.X.R, X.R), ty: 1000 * norm(add(sol.Y.t, Y.t, -1)), ry: rotErr(sol.Y.R, Y.R) }; }
  function fmtE(e) { return "X: " + e.tx.toFixed(1) + " mm / " + e.rx.toFixed(2) + "°   Y: " + e.ty.toFixed(1) + " mm / " + e.ry.toFixed(2) + "°"; }

  async function run() {
    if (S.running) return; S.running = true; readControls(); $("rw-run").disabled = true; log.clear(); S.sol = null; plotLocal.clear(); plotSdp.clear(); plotErr.clear();
    var d = S.data = generate(), A = d.A, B = d.B, kappa = S.kappa, sigma = S.sigma, rng = CD.rng(99);
    log.add("── setup ──", "hl"); log.add(S.N + " poses on the unit sphere · rotation noise Lang(κ=" + kappa + ") ≈ " + (Math.sqrt(1 / (2 * kappa)) * DEG).toFixed(1) + "° · translation noise σ = " + (100 * sigma).toFixed(0) + " cm · unknowns X (hand→camera), Y (base→target)");
    for (var f = 0; f < A.length; f += 1) { S.frame = f; drawScene(); await CD.sleep(window.RW3D && window.RW3D.demoView ? 55 : 30); if (!S.running) return; }
    var truthCost = cost(A, B, S.X, S.Y, kappa, sigma); log.add("cost at the true X, Y: " + truthCost.toFixed(3) + "  (the noise-only floor)");
    /* linear */
    var lin = linearSolve(A, B, kappa, sigma), eL = errs(lin, S.X, S.Y); log.add("── linear two-stage (Shah / Wang) ──", "hl"); log.add("cost " + cost(A, B, lin.X, lin.Y, kappa, sigma).toFixed(3) + "   " + fmtE(eL));
    var errBars = [{ x: 1, y: eL.tx, c: C.ash }]; await CD.sleep(300);
    /* local from random starts */
    log.add("── local Levenberg–Marquardt from 8 random starts (same objective) ──", "hl");
    var locals = [], best = null;
    for (var k = 0; k < 8; k++) { var X0 = se3(LA.rotvec([rng.normal(), rng.normal(), rng.normal()]), [0.3 * rng.normal(), 0.3 * rng.normal(), 0.3 * rng.normal()]), Y0 = se3(LA.rotvec([rng.normal(), rng.normal(), rng.normal()]), [rng.normal(), rng.normal(), rng.normal()]);
      var ls = localSolve(A, B, kappa, sigma, X0, Y0, 60), e = errs(ls, S.X, S.Y); locals.push(ls); errBars.push({ x: 2 + k, y: e.tx, c: C.hi }); if (!best || ls.cost < best.cost) best = ls;
      log.add("start " + (k + 1) + ": " + ls.iters + " it, cost " + ls.cost.toFixed(3) + "   " + fmtE(e) + (ls.cost > 1.01 * truthCost && e.tx > 30 ? "   ← local minimum" : ""), (ls.cost > 1.01 * truthCost && e.tx > 30) ? "warn" : "");
      plotLocal.clear(); locals.forEach(function (l, i) { plotLocal.add("start " + (i + 1), l.trace.map(function (_, j) { return j; }), l.trace, { color: i % 2 ? C.hi : C.gold, width: 1.2 }); }); plotLocal.hline(truthCost, C.green, "cost at truth"); plotLocal.o.legend = false; plotLocal.draw(); await CD.sleep(150); }
    var loc = localSolve(A, B, kappa, sigma, lin.X, lin.Y, 60), eLL = errs(loc, S.X, S.Y); log.add("local from the linear start: cost " + loc.cost.toFixed(3) + "   " + fmtE(eLL)); errBars.push({ x: 10, y: eLL.tx, c: C.gold });
    /* SDP */
    log.add("── semidefinite relaxation: Schur-eliminate translations, lift the two rotations (19×19), ADMM ──", "hl");
    var Q = buildQ(A, B, kappa, sigma), red = reduceQ(Q), t0 = performance.now(), hist = [];
    var res = sdpADMM(red.Qp, { rho: 1.0, maxIter: 6000, tol: 1e-9 }, function (it, pv, rp, rd) { hist.push([it, pv, rp, rd]); if (it % 100 === 0) { plotSdp.clear().add("primal residual", hist.map(function (h) { return h[0]; }), hist.map(function (h) { return Math.max(h[2], 1e-12); }), { color: C.hi }).add("dual residual", hist.map(function (h) { return h[0]; }), hist.map(function (h) { return Math.max(h[3], 1e-12); }), { color: C.blue }); plotSdp.draw(); } });
    var rd = roundZ(res.Z, red.back), sdpCost = cost(A, B, rd.X, rd.Y, kappa, sigma), eS = errs(rd, S.X, S.Y);
    /* certificate: relative gap between the rounded rotation-only cost and the SDP value (lower bound) */
    var rr = rd.rvec, pRed = 0; for (var i = 0; i < 19; i++) for (var j = 0; j < 19; j++) pRed += rr[i] * red.Qp[i][j] * rr[j];
    var gap = (pRed - res.primal) / Math.abs(res.primal);
    plotSdp.clear().add("primal residual", hist.map(function (h) { return h[0]; }), hist.map(function (h) { return Math.max(h[2], 1e-12); }), { color: C.hi }).add("dual residual", hist.map(function (h) { return h[0]; }), hist.map(function (h) { return Math.max(h[3], 1e-12); }), { color: C.blue }); plotSdp.draw();
    log.add(res.iters + " ADMM iterations in " + ((performance.now() - t0) / 1000).toFixed(1) + " s   SDP value (lower bound) " + res.primal.toFixed(4) + "   rounded reduced cost " + pRed.toFixed(4) + "   relative gap " + gap.toExponential(2), "ok");
    log.add("rank check: λ2/λ1 of the lifted matrix = " + rd.eigRatio.toExponential(2) + (rd.eigRatio < 1e-4 ? "  → rank one, the relaxation is tight" : "  → not rank one"), rd.eigRatio < 1e-4 ? "ok" : "warn");
    log.add("certified solution: cost " + sdpCost.toFixed(3) + "   " + fmtE(eS), "ok");
    log.add("best local minimum found by the random starts: cost " + best.cost.toFixed(3) + "   SDP cost " + sdpCost.toFixed(3) + "   (" + (Math.abs(best.cost - sdpCost) < 1e-3 * sdpCost ? "the random search happened to find the global optimum" : "the SDP is lower: the random search never found the global optimum") + ")");
    errBars.push({ x: 11, y: eS.tx, c: C.green }); plotErr.clear(); errBars.forEach(function (b) { plotErr.add("", [b.x], [Math.max(b.y, 0.1)], { color: b.c, marker: 6, line: false }); }); plotErr.o.legend = false; plotErr.fixed = { x: [0.5, 11.5] }; plotErr.draw();
    S.sol = rd; drawScene();
    $("rw-result").innerHTML = "<b>SDP</b> X " + eS.tx.toFixed(1) + " mm / " + eS.rx.toFixed(2) + "° &nbsp; Y " + eS.ty.toFixed(1) + " mm / " + eS.ry.toFixed(2) + "° &nbsp; <b>gap</b> " + gap.toExponential(1) + " &nbsp; <small>linear " + eL.tx.toFixed(1) + " mm · local(random) best " + Math.min.apply(null, errBars.slice(1, 9).map(function (b) { return b.y; })).toFixed(1) + " / worst " + Math.max.apply(null, errBars.slice(1, 9).map(function (b) { return b.y; })).toFixed(0) + " mm</small>";
    S.running = false; $("rw-run").disabled = false;
  }
  ["rw-xr", "rw-xp", "rw-xy", "rw-xt", "rw-yy", "rw-yx", "rw-kappa", "rw-sigma", "rw-N"].forEach(function (id) { $(id).addEventListener("input", function () { readControls(); S.sol = null; S.data = null; S.frame = 0; drawScene(); }); });
  $("rw-run").addEventListener("click", run); $("rw-stop").addEventListener("click", function () { S.running = false; $("rw-run").disabled = false; log.add("stopped", "warn"); });
  window.addEventListener("resize", function () { [plotLocal, plotSdp, plotErr].forEach(function (p) { p.resize(); p.draw(); }); if (view) view.resize(); drawScene(); });
  document.querySelectorAll(".theme-btn").forEach(function (b) { b.addEventListener("click", function () { setTimeout(function () { drawScene(); plotLocal.draw(); plotSdp.draw(); plotErr.draw(); }, 30); }); });
  readControls(); document.addEventListener("rw3d-ready", drawScene); setTimeout(function () { if (!(window.RW3D && window.RW3D.demoView)) drawScene(); }, 1500); plotLocal.draw(); plotSdp.draw(); plotErr.draw();
})();

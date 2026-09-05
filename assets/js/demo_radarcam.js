/* Live demo: targetless radar-camera spatiotemporal calibration (Wise, Cheng & Kelly, T-RO 2023).
   Choose where the radar sits on the camera, the clock offset Δt, the monocular scale and the
   noise; the rig flies a trajectory, both streams are simulated, and the solver runs in the
   browser: Δt grid search + linear closed form (paper eq. 21), then Levenberg-Marquardt over
   rotation, lever arm, scale and offset with a live log and plots. */
(function () {
  "use strict";
  var LA = CD.la, DEG = 180 / Math.PI;
  function mv(R, v) { return [R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]]; }
  function mtv(R, v) { return [R[0][0] * v[0] + R[1][0] * v[1] + R[2][0] * v[2], R[0][1] * v[0] + R[1][1] * v[1] + R[2][1] * v[2], R[0][2] * v[0] + R[1][2] * v[1] + R[2][2] * v[2]]; }
  function add(a, b, s) { s = s === undefined ? 1 : s; return [a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2]]; }
  function norm(a) { return Math.hypot(a[0], a[1], a[2]); }
  function rpy(r, p, y) { return LA.mul(LA.rotvec([0, 0, y]), LA.mul(LA.rotvec([0, p, 0]), LA.rotvec([r, 0, 0]))); }
  function lookAt(pos, target) { var z = add(target, pos, -1); var nz = norm(z); z = [z[0] / nz, z[1] / nz, z[2] / nz]; var up = [0, 1, 0]; var x = LA.cross(up, z); var nx = norm(x); if (nx < 1e-6) { x = LA.cross([1, 0, 0], z); nx = norm(x); } x = [x[0] / nx, x[1] / nx, x[2] / nx]; var y = LA.cross(z, x); return [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]]; }
  function pose(kind, t) {
    var p, roll, yaw, pitch;
    if (kind === "A") { p = [1.1 * Math.sin(2 * Math.PI * t / 9), 0.7 * Math.sin(2 * Math.PI * t / 6.5 + 1), 2.4 + 0.5 * Math.sin(2 * Math.PI * t / 11)]; roll = 20 / DEG * Math.sin(2 * Math.PI * t / 8); yaw = 8 / DEG * Math.sin(2 * Math.PI * t / 5); pitch = 8 / DEG * Math.cos(2 * Math.PI * t / 7); }
    else { p = [0.25 * Math.sin(2 * Math.PI * t / 5), 0.25 * Math.cos(2 * Math.PI * t / 4), 2.0 + 0.12 * Math.sin(2 * Math.PI * t / 3)]; roll = 45 / DEG * Math.sin(2 * Math.PI * t / 2.6); yaw = 22 / DEG * Math.sin(2 * Math.PI * t / 2); pitch = 22 / DEG * Math.cos(2 * Math.PI * t / 2.3); }
    var R = LA.mul(lookAt(p, [0, 0, 0]), LA.mul(LA.rotvec([pitch, yaw, 0]), LA.rotvec([0, 0, roll])));
    return { p: p, R: R };
  }
  function kin(kind, t) { var h = 1e-3, a = pose(kind, t + h), b = pose(kind, t - h), c = pose(kind, t); var pdot = add(a.p, b.p, -1).map(function (x) { return x / (2 * h); }); var om = LA.logRot(LA.mul(LA.T(b.R), a.R)).map(function (x) { return x / (2 * h); }); return { p: c.p, R: c.R, pdot: pdot, om: om }; }

  /* ---------- UI ---------- */
  var root = document.getElementById("demo-radarcam"); if (!root) return;
  var $ = function (id) { return root.querySelector("#" + id); };
  var view = new CD.View3($("rc-scene"), { az: -0.9, el: 0.35, scale: 95, center: [0, 0, 1.6] });
  var plotTau = new CD.Plot($("rc-plot-tau"), { title: "Δt search: velocity mismatch vs offset", xlabel: "offset [ms]", ylabel: "RMS [m/s]" });
  var plotConv = new CD.Plot($("rc-plot-conv"), { title: "errors vs LM iteration", xlabel: "iteration (0 = closed form)", ylabel: "error", logy: true });
  var plotFit = new CD.Plot($("rc-plot-fit"), { title: "radar velocity x: measured vs predicted", xlabel: "camera time [s]", ylabel: "m/s" });
  var log = new CD.Log($("rc-log"));
  var S = { running: false, data: null, est: null, truth: null, frame: 0, trace: [] }, C = CD.colors();
  function readControls() { S.roll = +$("rc-roll").value; S.pitch = +$("rc-pitch").value; S.yaw = +$("rc-yaw").value; S.rx = +$("rc-rx").value; S.ry = +$("rc-ry").value; S.rz = +$("rc-rz").value; S.tau = +$("rc-tau").value; S.alpha = +$("rc-alpha").value; S.sigr = +$("rc-sigr").value; S.kind = $("rc-traj").value; S.T = +$("rc-T").value;
    $("rc-roll-v").textContent = S.roll + "°"; $("rc-pitch-v").textContent = S.pitch + "°"; $("rc-yaw-v").textContent = S.yaw + "°"; $("rc-rx-v").textContent = S.rx + " cm"; $("rc-ry-v").textContent = S.ry + " cm"; $("rc-rz-v").textContent = S.rz + " cm"; $("rc-tau-v").textContent = S.tau + " ms"; $("rc-alpha-v").textContent = S.alpha.toFixed(2); $("rc-sigr-v").textContent = S.sigr.toFixed(2) + " m/s"; $("rc-T-v").textContent = S.T + " s";
    S.truth = { R: rpy(S.roll / DEG, S.pitch / DEG, S.yaw / DEG), r: [S.rx / 100, S.ry / 100, S.rz / 100], alpha: S.alpha, tau: S.tau / 1000 }; }

  function cone(R, t, size, color, alpha) { var ctx = view.ctx, pts = []; for (var k = 0; k < 12; k++) { var a = 2 * Math.PI * k / 12, v = [0.6 * size * Math.cos(a), 0.35 * size * Math.sin(a), size]; pts.push(add(t, mv(R, v))); } ctx.globalAlpha = alpha || 0.35; for (var i = 0; i < 12; i++) { view.line(t, pts[i], color, 1); view.line(pts[i], pts[(i + 1) % 12], color, 1); } ctx.globalAlpha = 1; }
  function drawScene() {
    C = CD.colors(); view.clear(); var ctx = view.ctx;
    /* board at z = 0 */
    for (var i = -4; i <= 4; i++) { view.line([i * 0.1, -0.35, 0], [i * 0.1, 0.35, 0], C.ash, 0.6); } for (var j = -3; j <= 3; j++) view.line([-0.4, j * 0.1, 0], [0.4, j * 0.1, 0], C.ash, 0.6);
    var kind = S.kind, T = S.T, n = 200;
    for (var k = 1; k < n; k++) { var a = pose(kind, 0.5 + (T - 1) * (k - 1) / n), b = pose(kind, 0.5 + (T - 1) * k / n); view.line(a.p, b.p, C.gold, 0.8); }
    var tt = S.data && S.frame > 0 ? S.data.tk[Math.min(S.frame, S.data.tk.length - 1)] : 4.0, P = kin(kind, tt);
    view.frustum(P.R, P.p, 0.16, C.blue, 2);
    var Rr = LA.mul(P.R, S.truth.R), pr = add(P.p, mv(P.R, S.truth.r)); cone(Rr, pr, 0.5, C.hi, 0.6); view.point(pr, C.hi, 4); view.text(pr, "radar (truth)", C.hi, 8, -8);
    if (S.est) { var Re = LA.mul(P.R, S.est.R), pe = add(P.p, mv(P.R, S.est.r)); cone(Re, pe, 0.5, C.green, 0.9); view.point(pe, C.green, 4); view.text(pe, "estimate", C.green, 8, 10); }
    view.text(P.p, "camera", C.blue, 8, 12);
    if (S.data && S.frame > 0) { var vel = P.pdot, hv = mv(Rr, S.data.hj[Math.min(Math.floor(S.frame * 2 / 3), S.data.hj.length - 1)]); view.line(P.p, add(P.p, vel, 0.5), C.blue, 2.5); view.line(pr, add(pr, hv, 0.5), C.hi, 2.5); }
    ctx.fillStyle = C.text; ctx.font = "11px 'Space Mono', monospace"; ctx.textAlign = "left"; ctx.fillText("t = " + tt.toFixed(1) + " s   trajectory " + kind + "   drag to orbit", 10, 16);
    ctx.fillStyle = C.ash; ctx.font = "10px 'Jost', sans-serif"; ctx.textAlign = "right"; ctx.fillText("camera frustum (blue) · radar cone (red = true placement, green = estimate) · board on the ground", view.W - 8, view.H - 8);
  }
  view.onchange = drawScene;

  function generate() {
    var rng = CD.rng(4321 + Math.round(S.roll * 3 + S.rx * 7 + S.tau * 5 + S.sigr * 1000 + S.T)), tr = S.truth, kind = S.kind, T = S.T;
    var tk = [], pk = [], Rk = [];
    for (var t = 0.5; t < T - 0.5; t += 1 / 30) { var P = pose(kind, t); tk.push(t); Rk.push(LA.mul(P.R, LA.rotvec([0.1 / DEG * rng.normal(), 0.1 / DEG * rng.normal(), 0.1 / DEG * rng.normal()]))); pk.push(P.p.map(function (x) { return tr.alpha * x + 0.003 * rng.normal(); })); }
    var tj = [], hj = [];
    for (var s = 0.6; s < T - 0.6; s += 1 / 20) { var K = kin(kind, s + tr.tau); var vc = mtv(K.R, K.pdot); var h = mtv(tr.R, add(vc, LA.cross(K.om, tr.r))); tj.push(s); hj.push(h.map(function (x) { return x + S.sigr * rng.normal(); })); }
    /* camera-derived kinematics from the noisy poses (surrogate of the spline): Savitzky-Golay
       first derivative over a 9-frame window (zero phase, ~3x less velocity noise than a plain difference) */
    var vc = [], om = [], tc = [], SG = [-4, -3, -2, -1, 0, 1, 2, 3, 4], hstep = 1 / 30;
    for (var i = 4; i < tk.length - 4; i++) {
      var pd = [0, 0, 0], wd = [0, 0, 0];
      for (var q = -4; q <= 4; q++) { var c = SG[q + 4] / (60 * hstep); var rv = LA.logRot(LA.mul(LA.T(Rk[i]), Rk[i + q])); for (var a = 0; a < 3; a++) { pd[a] += c * pk[i + q][a]; wd[a] += c * rv[a]; } }
      tc.push(tk[i]); vc.push(mtv(Rk[i], pd)); om.push(wd);
    }
    return { tk: tk, pk: pk, Rk: Rk, tj: tj, hj: hj, tc: tc, vc: vc, om: om };
  }
  function interp3(ts, vals, t) { if (t <= ts[0]) return vals[0]; if (t >= ts[ts.length - 1]) return vals[vals.length - 1]; var lo = 0, hi = ts.length - 1; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (ts[m] <= t) lo = m; else hi = m; } var u = (t - ts[lo]) / (ts[hi] - ts[lo]); return [vals[lo][0] + u * (vals[hi][0] - vals[lo][0]), vals[lo][1] + u * (vals[hi][1] - vals[lo][1]), vals[lo][2] + u * (vals[hi][2] - vals[lo][2])]; }

  /* predicted radar velocity from the camera kinematics: h = R^T (a/alpha + om x r)  with a = scaled camera velocity */
  function predict(d, x, j) { var t = d.tj[j] + x.tau, a = interp3(d.tc, d.vc, t), w = interp3(d.tc, d.om, t); var vc = [a[0] / x.alpha, a[1] / x.alpha, a[2] / x.alpha]; return mtv(x.R, add(vc, LA.cross(w, x.r))); }
  function residual(d, x) { var r = []; for (var j = 0; j < d.tj.length; j++) { var t = d.tj[j] + x.tau; if (t < d.tc[0] || t > d.tc[d.tc.length - 1]) continue; var p = predict(d, x, j); r.push(d.hj[j][0] - p[0], d.hj[j][1] - p[1], d.hj[j][2] - p[2]); } return r; }
  function rms(r) { var s = 0; for (var i = 0; i < r.length; i++) s += r[i] * r[i]; return Math.sqrt(s / Math.max(r.length, 1)); }
  function closedForm(d, tau) {   /* a(t) = alpha R h(t+tau) - alpha om x r  -> linear in vec(alpha R) (9) and alpha r (3) */
    var AtA = LA.zeros(12, 12), Atb = new Float64Array(12), n = 0;
    for (var j = 0; j < d.tj.length; j++) { var t = d.tj[j] + tau; if (t < d.tc[0] || t > d.tc[d.tc.length - 1]) continue; var a = interp3(d.tc, d.vc, t), w = interp3(d.tc, d.om, t), h = d.hj[j];
      for (var i = 0; i < 3; i++) { var row = new Float64Array(12); for (var c = 0; c < 3; c++) row[3 * c + i] = h[c]; /* (alpha R h)_i = sum_c R_ic h_c, R column-major vec: index 3c+i */
        var sk = [[0, -w[2], w[1]], [w[2], 0, -w[0]], [-w[1], w[0], 0]]; for (var c2 = 0; c2 < 3; c2++) row[9 + c2] = -sk[i][c2];
        for (var p = 0; p < 12; p++) { Atb[p] += row[p] * a[i]; for (var q = 0; q < 12; q++) AtA[p][q] += row[p] * row[q]; } n++; } }
    var x = LA.solve(AtA, Atb), M = [[x[0], x[3], x[6]], [x[1], x[4], x[7]], [x[2], x[5], x[8]]];
    var e = LA.eigSym(LA.mul(LA.T(M), M)), alpha = Math.sqrt(Math.max(e.values.reduce(function (s, v) { return s + v; }, 0) / 3, 1e-12));
    var R = LA.projSO3(M), r = [x[9] / alpha, x[10] / alpha, x[11] / alpha];
    var res = residual(d, { R: R, r: r, alpha: alpha, tau: tau }); return { R: R, r: r, alpha: alpha, tau: tau, rms: rms(res) };
  }
  function errors(x, tr) { return { rot: norm(LA.logRot(LA.mul(LA.T(tr.R), x.R))) * DEG, trans: norm(add(x.r, tr.r, -1)) * 100, scale: 100 * Math.abs(x.alpha - tr.alpha) / tr.alpha, tau: 1000 * Math.abs(x.tau - tr.tau) }; }
  function pack(x) { return [x.R, x.r.slice(), x.alpha, x.tau]; }
  function applyDelta(x, dx) { return { R: LA.mul(x.R, LA.rotvec([dx[0], dx[1], dx[2]])), r: [x.r[0] + dx[3], x.r[1] + dx[4], x.r[2] + dx[5]], alpha: x.alpha + dx[6], tau: x.tau + dx[7] }; }

  async function run() {
    if (S.running) return; S.running = true; readControls(); $("rc-run").disabled = true; log.clear(); S.trace = []; S.est = null; plotTau.clear(); plotConv.clear(); plotFit.clear();
    var tr = S.truth, d = S.data = generate();
    log.add("── setup ──", "hl"); log.add("trajectory " + S.kind + ", " + S.T + " s · camera " + d.tk.length + " poses at 30 Hz (scaled by α = " + tr.alpha + ", 0.1° / 3 mm noise) · radar " + d.tj.length + " ego-velocities at 20 Hz, σ_r = " + S.sigr + " m/s, stamped " + S.tau + " ms early");
    log.add("truth: R_cr rpy = (" + S.roll + ", " + S.pitch + ", " + S.yaw + ")°   r = (" + S.rx + ", " + S.ry + ", " + S.rz + ") cm   α = " + tr.alpha + "   Δt = " + S.tau + " ms");
    for (var f = 0; f < d.tk.length; f += 6) { S.frame = f; drawScene(); await CD.sleep(16); if (!S.running) return; }
    S.frame = Math.floor(d.tk.length * 0.3); drawScene();
    /* stage 1: grid over tau */
    log.add("── stage 1: Δt grid search with the linear closed form (paper eq. 21) ──", "hl");
    var taus = [], rmss = [], best = null;
    for (var tau = -0.25; tau <= 0.2501; tau += 0.005) { var cf = closedForm(d, tau); taus.push(tau * 1000); rmss.push(cf.rms); if (!best || cf.rms < best.rms) best = cf; }
    plotTau.clear().add("RMS", taus, rmss, { color: C.gold, width: 1.8 }); plotTau.vline(tr.tau * 1000, C.hi); plotTau.vline(best.tau * 1000, C.green); plotTau.draw();
    var e0 = errors(best, tr); log.add("best Δt = " + (best.tau * 1000).toFixed(0) + " ms   rotation error " + e0.rot.toFixed(2) + "°   lever-arm error " + e0.trans.toFixed(1) + " cm   scale " + best.alpha.toFixed(3) + " (err " + e0.scale.toFixed(1) + " %)   residual RMS " + best.rms.toFixed(4) + " m/s");
    S.trace.push({ it: 0, e: e0 }); S.est = best; drawScene(); updateConv(); await CD.sleep(500);
    /* stage 2: LM on (phi, r, alpha, tau) with a numerical Jacobian */
    log.add("── stage 2: Levenberg–Marquardt over rotation, lever arm, scale and Δt (8 parameters) ──", "hl");
    var x = { R: best.R, r: best.r.slice(), alpha: best.alpha, tau: best.tau }, lam = 1e-3, res = residual(d, x), c = rms(res), it, converged = false, Jt;
    var steps = [1e-5, 1e-5, 1e-5, 1e-5, 1e-5, 1e-5, 1e-5, 1e-4];
    for (it = 1; it <= 30; it++) {
      var n = res.length, J = []; for (var p = 0; p < 8; p++) { var dx = [0, 0, 0, 0, 0, 0, 0, 0]; dx[p] = steps[p]; var rp = residual(d, applyDelta(x, dx)); var col = new Float64Array(n); for (var i = 0; i < n; i++) col[i] = (rp[i] - res[i]) / steps[p]; J.push(col); }
      var JtJ = LA.zeros(8, 8), g = new Float64Array(8); for (var p2 = 0; p2 < 8; p2++) { for (var i2 = 0; i2 < n; i2++) g[p2] += J[p2][i2] * res[i2]; for (var q = 0; q < 8; q++) { var s = 0; for (var i3 = 0; i3 < n; i3++) s += J[p2][i3] * J[q][i3]; JtJ[p2][q] = s; } }
      Jt = JtJ; var accepted = false, tries = 0;
      while (!accepted && tries < 10) { var A = JtJ.map(function (row, i) { var rr = Float64Array.from(row); rr[i] *= (1 + lam); return rr; }); var dxv = LA.solve(A, g); var xn = applyDelta(x, Array.from(dxv).map(function (v) { return -v; })); var rn = residual(d, xn), cn = rms(rn);
        if (cn < c) { var rel = (c - cn) / c; x = xn; res = rn; c = cn; lam = Math.max(lam / 3, 1e-9); accepted = true; if (rel < 1e-7) converged = true; } else { lam *= 5; tries++; } }
      if (!accepted) converged = true;
      var e = errors(x, tr); S.trace.push({ it: it, e: e }); S.est = x; drawScene(); updateConv();
      log.add("it " + String(it).padStart(2) + "  RMS " + c.toFixed(5) + "  λ " + lam.toExponential(1) + "  rot " + e.rot.toFixed(3) + "°  r " + e.trans.toFixed(2) + " cm  α " + x.alpha.toFixed(4) + "  Δt " + (x.tau * 1000).toFixed(2) + " ms");
      await CD.sleep(200); if (converged) break;
    }
    /* identifiability: singular values of J */
    var ev = LA.eigSym(Jt), sv = ev.values.map(function (v) { return Math.sqrt(Math.max(v, 0)); }).sort(function (a, b) { return b - a; });
    var e1 = errors(x, tr), sd = null; try { var cov = LA.inv(Jt); sd = [Math.sqrt(cov[0][0] + cov[1][1] + cov[2][2]) * S.sigr * DEG, Math.sqrt(cov[3][3] + cov[4][4] + cov[5][5]) * S.sigr * 100, Math.sqrt(cov[6][6]) * S.sigr, Math.sqrt(cov[7][7]) * S.sigr * 1000]; } catch (er) { }
    log.add("── result ──", "hl");
    log.add("rotation error " + e1.rot.toFixed(3) + "°   lever arm error " + e1.trans.toFixed(2) + " cm   scale " + x.alpha.toFixed(4) + " (truth " + tr.alpha + ", error " + e1.scale.toFixed(2) + " %)   Δt " + (x.tau * 1000).toFixed(2) + " ms (truth " + S.tau + ", error " + e1.tau.toFixed(2) + " ms)", "ok");
    if (sd) log.add("reported 1σ: rotation " + sd[0].toFixed(2) + "°   lever arm " + sd[1].toFixed(2) + " cm   α " + sd[2].toFixed(4) + "   Δt " + sd[3].toFixed(2) + " ms");
    log.add("singular values of the 8-parameter Jacobian: " + sv.map(function (v) { return v.toExponential(1); }).join(" ") + (sv[7] / sv[0] < 1e-4 ? "   → weakly identifiable (rotate about two axes!)" : "   → identifiable"), sv[7] / sv[0] < 1e-4 ? "warn" : "");
    log.add("radar residual RMS " + c.toFixed(4) + " m/s vs σ_r = " + S.sigr + " m/s · " + it + " iterations");
    /* fit plot */
    var tx = [], mx = [], px = []; for (var j = 0; j < d.tj.length; j++) { var tj = d.tj[j] + x.tau; if (tj < d.tc[0] || tj > d.tc[d.tc.length - 1]) continue; tx.push(tj); mx.push(d.hj[j][0]); px.push(predict(d, x, j)[0]); }
    plotFit.clear().add("predicted", tx, px, { color: C.blue, width: 1.6 }).add("measured", tx, mx, { color: C.hi, marker: 2, line: false }); plotFit.draw();
    $("rc-result").innerHTML = "<b>rotation</b> " + e1.rot.toFixed(2) + "° &nbsp; <b>lever arm</b> " + e1.trans.toFixed(2) + " cm &nbsp; <b>scale</b> " + x.alpha.toFixed(3) + " <small>(truth " + tr.alpha + ")</small> &nbsp; <b>Δt</b> " + (x.tau * 1000).toFixed(1) + " ms <small>(truth " + S.tau + ")</small> &nbsp; " + it + " iterations";
    S.running = false; $("rc-run").disabled = false;
  }
  function updateConv() { var tr = S.trace, its = tr.map(function (r) { return r.it; }); plotConv.clear().add("rotation [deg]", its, tr.map(function (r) { return Math.max(r.e.rot, 1e-3); }), { color: C.hi, marker: 3 }).add("lever arm [cm]", its, tr.map(function (r) { return Math.max(r.e.trans, 1e-3); }), { color: C.gold, marker: 3 }).add("scale [%]", its, tr.map(function (r) { return Math.max(r.e.scale, 1e-3); }), { color: C.green, marker: 3 }).add("Δt [ms]", its, tr.map(function (r) { return Math.max(r.e.tau, 1e-3); }), { color: C.blue, marker: 3 }); plotConv.draw(); }

  ["rc-roll", "rc-pitch", "rc-yaw", "rc-rx", "rc-ry", "rc-rz", "rc-tau", "rc-alpha", "rc-sigr", "rc-traj", "rc-T"].forEach(function (id) { $(id).addEventListener("input", function () { readControls(); S.est = null; drawScene(); }); });
  $("rc-run").addEventListener("click", run); $("rc-stop").addEventListener("click", function () { S.running = false; $("rc-run").disabled = false; log.add("stopped", "warn"); });
  window.addEventListener("resize", function () { [plotTau, plotConv, plotFit].forEach(function (p) { p.resize(); p.draw(); }); view.resize(); drawScene(); });
  document.querySelectorAll(".theme-btn").forEach(function (b) { b.addEventListener("click", function () { setTimeout(function () { drawScene(); plotTau.draw(); plotConv.draw(); plotFit.draw(); }, 30); }); });
  readControls(); drawScene(); plotTau.draw(); plotConv.draw(); plotFit.draw();
})();

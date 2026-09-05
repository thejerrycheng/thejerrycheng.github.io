/* Live demo: 2D radar-to-radar calibration from ego-velocity (Cheng, Wise & Kelly, AIM 2023).
   Place radar b, choose noise / duration / motion, run: the drive is simulated, the two
   ego-velocity streams are generated, the closed-form initialisation and the Schur-eliminated
   Levenberg-Marquardt batch solver run iteration by iteration with a log and live plots. */
(function () {
  "use strict";
  var LA = CD.la;
  function rot(th) { var c = Math.cos(th), s = Math.sin(th); return [[c, -s], [s, c]]; }
  function drot(th) { var c = Math.cos(th), s = Math.sin(th); return [[-s, -c], [c, -s]]; }
  function wrapPi(a) { return ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; }
  function axisErr(a, b) { return ((a - b + Math.PI / 2) % Math.PI + Math.PI) % Math.PI - Math.PI / 2; }
  function m2(R, v) { return [R[0][0] * v[0] + R[0][1] * v[1], R[1][0] * v[0] + R[1][1] * v[1]]; }
  function mT2(R, v) { return [R[0][0] * v[0] + R[1][0] * v[1], R[0][1] * v[0] + R[1][1] * v[1]]; }
  var DEG = 180 / Math.PI;

  /* ---------- trajectories (nominal = the paper's gen_data_2.m) ---------- */
  function trajectory(kind, T, dt) {
    var t = [], v = [], om = [];
    for (var s = 0; s <= T + 1e-9; s += dt) {
      t.push(s);
      if (kind === "straight") { v.push([5 + Math.sin(2 * s), 0]); om.push(Math.max(0.3 * Math.sin(s / 2), 0)); }
      else { v.push([Math.sin(2 * s) + 5, 0.25 * Math.cos(2 * s) + 1]); om.push(kind === "constant" ? 0.15 : Math.max(0.3 * Math.sin(s / 2), 0)); }
    }
    return { t: t, v: v, om: om };
  }
  function predictB(v, om, tt, tb) { var R = rot(tb), up = [-Math.sin(tt), Math.cos(tt)]; return v.map(function (vi, j) { return m2(R, [vi[0] + om[j] * up[0], vi[1] + om[j] * up[1]]); }); }

  /* ---------- initialisation (paper III-F) ---------- */
  function initialise(ha, hb) {
    var M = ha.length, pairs = [];
    for (var j = 0; j < M; j++) { var na = Math.hypot(ha[j][0], ha[j][1]), nb = Math.hypot(hb[j][0], hb[j][1]); pairs.push([Math.abs(na - nb), j]); }
    pairs.sort(function (a, b) { return a[0] - b[0]; });
    var sel = pairs.filter(function (p) { return p[0] < 0.05; }).map(function (p) { return p[1]; });
    if (sel.length < 5) sel = pairs.slice(0, Math.max(5, Math.floor(M / 5))).map(function (p) { return p[1]; });
    var sins = [], coss = [];
    sel.forEach(function (j) { var a = ha[j], b = hb[j]; var ang = Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]); sins.push(Math.sin(ang)); coss.push(Math.cos(ang)); });
    sins.sort(function (a, b) { return a - b; }); coss.sort(function (a, b) { return a - b; });
    var tb0 = Math.atan2(sins[Math.floor(sins.length / 2)], coss[Math.floor(coss.length / 2)]);
    var R = rot(tb0), S2 = 0, C2 = 0, om0 = [];
    var bvec = ha.map(function (a, j) { var r = mT2(R, hb[j]); return [r[0] - a[0], r[1] - a[1]]; });
    bvec.forEach(function (b) { var w = Math.hypot(b[0], b[1]), th = Math.atan2(b[1], b[0]) - Math.PI / 2; S2 += w * Math.sin(2 * th); C2 += w * Math.cos(2 * th); });
    var tt0 = ((0.5 * Math.atan2(S2, C2)) % Math.PI + Math.PI) % Math.PI;
    var up = [-Math.sin(tt0), Math.cos(tt0)];
    bvec.forEach(function (b) { om0.push(b[0] * up[0] + b[1] * up[1]); });
    return { tt: tt0, tb: tb0, om: om0 };
  }

  /* ---------- residuals / Jacobians / one LM step with Schur elimination ---------- */
  function residuals(ha, hb, v, om, tt, tb) {
    var R = rot(tb), dR = drot(tb), u = [Math.cos(tt), Math.sin(tt)], up = [-Math.sin(tt), Math.cos(tt)], M = ha.length;
    var ea = new Array(M), eb = new Array(M), Jbx = new Array(M), Jbg = new Array(M), Ru = m2(R, u), Rup = m2(R, up);
    for (var j = 0; j < M; j++) {
      var inner = [v[j][0] + om[j] * up[0], v[j][1] + om[j] * up[1]], pr = m2(R, inner);
      ea[j] = [ha[j][0] - v[j][0], ha[j][1] - v[j][1]]; eb[j] = [hb[j][0] - pr[0], hb[j][1] - pr[1]];
      Jbx[j] = [[-R[0][0], -R[0][1], -Rup[0]], [-R[1][0], -R[1][1], -Rup[1]]];
      var dRi = m2(dR, inner); Jbg[j] = [[om[j] * Ru[0], -dRi[0]], [om[j] * Ru[1], -dRi[1]]];
    }
    return { ea: ea, eb: eb, Jbx: Jbx, Jbg: Jbg };
  }
  function cost(ha, hb, v, om, tt, tb, wa, wb) { var r = residuals(ha, hb, v, om, tt, tb), c = 0; for (var j = 0; j < ha.length; j++) { c += wa * (r.ea[j][0] * r.ea[j][0] + r.ea[j][1] * r.ea[j][1]) + wb * (r.eb[j][0] * r.eb[j][0] + r.eb[j][1] * r.eb[j][1]); } return c; }
  function linearStates(ha, hb, tt, tb, wa, wb) {   /* with (tt,tb) fixed the states are linear: closed form per time step */
    var R = rot(tb), up = [-Math.sin(tt), Math.cos(tt)], Rup = m2(R, up), v = [], om = [];
    var Jb = [[R[0][0], R[0][1], Rup[0]], [R[1][0], R[1][1], Rup[1]]];
    for (var j = 0; j < ha.length; j++) {
      var A = LA.zeros(3, 3), b = new Float64Array(3);
      for (var i = 0; i < 2; i++) { A[i][i] += wa; b[i] += wa * ha[j][i]; }
      for (var r = 0; r < 2; r++) for (var p = 0; p < 3; p++) { for (var q = 0; q < 3; q++) A[p][q] += wb * Jb[r][p] * Jb[r][q]; b[p] += wb * Jb[r][p] * hb[j][r]; }
      var x = LA.solve(A, b); v.push([x[0], x[1]]); om.push(x[2]);
    }
    return { v: v, om: om };
  }
  function schurStep(ha, hb, v, om, tt, tb, wa, wb, lam) {
    var r = residuals(ha, hb, v, om, tt, tb), M = ha.length;
    var Hgg = [[0, 0], [0, 0]], bg = [0, 0], Hxx = [], Hxg = [], bx = [];
    for (var j = 0; j < M; j++) {
      var H = LA.zeros(3, 3), G = LA.zeros(3, 2), b = new Float64Array(3);
      for (var i = 0; i < 2; i++) { H[i][i] += wa; b[i] += wa * r.ea[j][i]; }   /* J_a = -I  =>  -J^T W e = +w e */
      var Jx = r.Jbx[j], Jg = r.Jbg[j], e = r.eb[j];
      for (var k = 0; k < 2; k++) { for (var p = 0; p < 3; p++) { for (var q = 0; q < 3; q++) H[p][q] += wb * Jx[k][p] * Jx[k][q]; for (var q2 = 0; q2 < 2; q2++) G[p][q2] += wb * Jx[k][p] * Jg[k][q2]; b[p] -= wb * Jx[k][p] * e[k]; } for (var p2 = 0; p2 < 2; p2++) { for (var q3 = 0; q3 < 2; q3++) Hgg[p2][q3] += wb * Jg[k][p2] * Jg[k][q3]; bg[p2] -= wb * Jg[k][p2] * e[k]; } }
      Hxx.push(H); Hxg.push(G); bx.push(b);
    }
    var S = [[Hgg[0][0] * (1 + lam), Hgg[0][1]], [Hgg[1][0], Hgg[1][1] * (1 + lam)]], rhs = [bg[0], bg[1]], Hinv = [];
    for (var j2 = 0; j2 < M; j2++) {
      var Hd = Hxx[j2].map(function (row) { return Float64Array.from(row); }); for (var d = 0; d < 3; d++) Hd[d][d] *= (1 + lam);
      var Hi = LA.inv(Hd); Hinv.push(Hi);
      var G2 = Hxg[j2], HiG = LA.mul(Hi, G2), Hib = LA.mulv(Hi, bx[j2]);
      for (var p3 = 0; p3 < 2; p3++) { for (var q4 = 0; q4 < 2; q4++) { var s = 0; for (var k2 = 0; k2 < 3; k2++) s += G2[k2][p3] * HiG[k2][q4]; S[p3][q4] -= s; } var s2 = 0; for (var k3 = 0; k3 < 3; k3++) s2 += G2[k3][p3] * Hib[k3]; rhs[p3] -= s2; }
    }
    var dg = LA.solve(S, rhs), vN = [], omN = [];
    for (var j3 = 0; j3 < M; j3++) { var rhsx = [bx[j3][0] - Hxg[j3][0][0] * dg[0] - Hxg[j3][0][1] * dg[1], bx[j3][1] - Hxg[j3][1][0] * dg[0] - Hxg[j3][1][1] * dg[1], bx[j3][2] - Hxg[j3][2][0] * dg[0] - Hxg[j3][2][1] * dg[1]]; var dx = LA.mulv(Hinv[j3], rhsx); vN.push([v[j3][0] + dx[0], v[j3][1] + dx[1]]); omN.push(om[j3] + dx[2]); }
    var ttN = tt + dg[0], tbN = wrapPi(tb + dg[1]);
    if (ttN < 0 || ttN >= Math.PI) { var kk = Math.floor(ttN / Math.PI); ttN -= kk * Math.PI; if (kk % 2 !== 0) omN = omN.map(function (o) { return -o; }); }
    return { v: vN, om: omN, tt: ttN, tb: tbN, dg: dg, S: S };
  }
  function schurInfo(ha, hb, v, om, tt, tb, wa, wb) { var st = schurStep(ha, hb, v, om, tt, tb, wa, wb, 0); return st.S; }

  /* ================= UI ================= */
  var root = document.getElementById("demo-radar2d"); if (!root) return;
  var $ = function (id) { return root.querySelector("#" + id); };
  var scene = $("r2d-scene"), sceneCtx = scene.getContext("2d");
  var plotVel = new CD.Plot($("r2d-plot-vel"), { title: "ego-velocity streams h_a, h_b (m/s)", xlabel: "time [s]", ylabel: "m/s" });
  var plotConv = new CD.Plot($("r2d-plot-conv"), { title: "error vs LM iteration", xlabel: "iteration (0 = closed-form init)", ylabel: "deg", logy: true });
  var plotEst = new CD.Plot($("r2d-plot-est"), { title: "estimate vs truth (θt, θba)", xlabel: "θt [deg]", ylabel: "θba [deg]" });
  var log = new CD.Log($("r2d-log"));
  var state = { tt: 158, tb: 95, dist: 3.2, sigma: 0.10, T: 60, motion: "nominal", initOff: 0, running: false, data: null, est: null, trace: [], frame: 0 };
  var C = CD.colors();

  function readControls() { state.tt = +$("r2d-tt").value; state.tb = +$("r2d-tb").value; state.dist = +$("r2d-dist").value; state.sigma = +$("r2d-sigma").value; state.T = +$("r2d-T").value; state.motion = $("r2d-motion").value; state.initOff = +$("r2d-init").value;
    $("r2d-tt-v").textContent = state.tt + "°"; $("r2d-tb-v").textContent = state.tb + "°"; $("r2d-dist-v").textContent = state.dist.toFixed(1) + " m"; $("r2d-sigma-v").textContent = state.sigma.toFixed(2) + " m/s"; $("r2d-T-v").textContent = state.T + " s"; $("r2d-init-v").textContent = state.initOff + "°"; }

  function drawScene() {
    var W = scene.width / (window.devicePixelRatio || 1), H = scene.height / (window.devicePixelRatio || 1); C = CD.colors();
    var ctx = sceneCtx; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    var sc = Math.min(W, H) / 14, ox = W * 0.5, oy = H * 0.5;
    var P = function (x, y) { return [ox + sc * x, oy - sc * y]; };
    /* grid */
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1; for (var g = -7; g <= 7; g++) { ctx.beginPath(); ctx.moveTo(P(g, -7)[0], P(g, -7)[1]); ctx.lineTo(P(g, 7)[0], P(g, 7)[1]); ctx.stroke(); ctx.beginPath(); ctx.moveTo(P(-7, g)[0], P(-7, g)[1]); ctx.lineTo(P(7, g)[0], P(7, g)[1]); ctx.stroke(); }
    var tt = state.tt / DEG, tb = state.tb / DEG, pb = [state.dist * Math.cos(tt), state.dist * Math.sin(tt)];
    /* vehicle body along the baseline */
    ctx.strokeStyle = C.gold; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(P(-9 * Math.cos(tt), -9 * Math.sin(tt))[0], P(-9 * Math.cos(tt), -9 * Math.sin(tt))[1]); ctx.lineTo(P(9 * Math.cos(tt), 9 * Math.sin(tt))[0], P(9 * Math.cos(tt), 9 * Math.sin(tt))[1]); ctx.stroke(); ctx.setLineDash([]);
    var fov = function (p, yaw, col) { ctx.fillStyle = col; ctx.globalAlpha = 0.16; ctx.beginPath(); ctx.moveTo(P(p[0], p[1])[0], P(p[0], p[1])[1]); ctx.arc(P(p[0], p[1])[0], P(p[0], p[1])[1], sc * 4.2, -(yaw + 1.05), -(yaw - 1.05), false); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; };
    fov([0, 0], 0, C.hi); fov(pb, -tb, C.blue);
    var frame = function (p, yaw, col, label) { var q = P(p[0], p[1]); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, 2 * Math.PI); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + 28 * Math.cos(yaw), q[1] - 28 * Math.sin(yaw)); ctx.stroke(); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] - 18 * Math.sin(yaw), q[1] - 18 * Math.cos(yaw)); ctx.stroke(); ctx.fillStyle = C.text; ctx.font = "bold 12px 'Jost', sans-serif"; ctx.textAlign = "left"; ctx.fillText(label, q[0] + 8, q[1] - 10); };
    frame([0, 0], 0, C.hi, "radar a (fixed)"); frame(pb, -tb, C.blue, "radar b · drag me");
    /* current estimate (ghost) */
    if (state.est) { var e = state.est, pe = [state.dist * Math.cos(e.tt), state.dist * Math.sin(e.tt)]; if (Math.cos(e.tt - tt) < 0) pe = [-pe[0], -pe[1]]; ctx.globalAlpha = 0.85; frame(pe, -e.tb, C.green, "estimate"); ctx.globalAlpha = 1; }
    /* live velocity arrows while the drive plays */
    if (state.data && state.frame > 0) { var j = Math.min(state.frame, state.data.ha.length - 1), d = state.data, ar = function (p, v, col) { var q = P(p[0], p[1]), tip = [q[0] + sc * 0.45 * v[0], q[1] - sc * 0.45 * v[1]]; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(tip[0], tip[1]); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(tip[0], tip[1], 4, 0, 2 * Math.PI); ctx.fill(); };
      ar([0, 0], d.ha[j], C.hi); ar(pb, mT2(rot(tb), d.hb[j]), C.blue);
      ctx.fillStyle = C.text; ctx.font = "11px 'Space Mono', monospace"; ctx.textAlign = "left"; ctx.fillText("t = " + d.t[j].toFixed(1) + " s   |h_a| = " + Math.hypot(d.ha[j][0], d.ha[j][1]).toFixed(2) + "   ω = " + d.om[j].toFixed(2) + " rad/s", 10, 16); }
    ctx.fillStyle = C.ash; ctx.font = "10px 'Jost', sans-serif"; ctx.textAlign = "right"; ctx.fillText("frame of radar a · 1 grid cell = 1 m · dashed = baseline axis θt", W - 8, H - 8);
  }

  /* dragging radar b */
  (function () { var drag = false; scene.addEventListener("pointerdown", function (e) { drag = true; scene.setPointerCapture(e.pointerId); move(e); }); scene.addEventListener("pointermove", function (e) { if (drag) move(e); }); scene.addEventListener("pointerup", function () { drag = false; }); scene.style.touchAction = "none";
    function move(e) { var r = scene.getBoundingClientRect(), W = r.width, H = r.height, sc = Math.min(W, H) / 14; var x = (e.clientX - r.left - W / 2) / sc, y = -(e.clientY - r.top - H / 2) / sc; var d = Math.hypot(x, y); if (d < 0.5) return; var ang = Math.atan2(y, x); if (ang < 0) { ang += Math.PI; } $("r2d-tt").value = Math.round(ang * DEG); $("r2d-dist").value = Math.min(6, Math.max(0.5, d)).toFixed(1); readControls(); drawScene(); } })();

  function generate() {
    var rng = CD.rng(1234 + Math.round(state.tt * 7 + state.tb * 13 + state.sigma * 1000 + state.T));
    var tr = trajectory(state.motion, state.T, 1 / 14), tt = state.tt / DEG, tb = state.tb / DEG, omg = tr.om.map(function (o) { return o * state.dist; });
    var vb = predictB(tr.v, omg, tt, tb), ha = [], hb = [];
    for (var j = 0; j < tr.t.length; j++) { ha.push([tr.v[j][0] + state.sigma * rng.normal(), tr.v[j][1] + state.sigma * rng.normal()]); hb.push([vb[j][0] + state.sigma * rng.normal(), vb[j][1] + state.sigma * rng.normal()]); }
    /* integrate the pose of radar a for the animation */
    var pos = [[0, 0]], yaw = [0];
    for (var k = 1; k < tr.t.length; k++) { var y0 = yaw[k - 1], R = rot(y0), dv = m2(R, tr.v[k - 1]); yaw.push(y0 + tr.om[k - 1] / 14); pos.push([pos[k - 1][0] + dv[0] / 14, pos[k - 1][1] + dv[1] / 14]); }
    return { t: tr.t, v: tr.v, om: tr.om, omg: omg, ha: ha, hb: hb, vb: vb, tt: tt, tb: tb, pos: pos, yaw: yaw };
  }

  async function run() {
    if (state.running) return; state.running = true; readControls(); $("r2d-run").disabled = true;
    log.clear(); state.trace = []; state.est = null; plotConv.clear(); plotEst.clear();
    var d = state.data = generate(); var M = d.t.length, wa = 1 / (state.sigma * state.sigma), wb = wa;
    log.add("── setup ──", "hl"); log.add("motion: " + state.motion + "   duration " + state.T + " s   " + M + " steps at 14 Hz   σ = " + state.sigma + " m/s");
    log.add("truth: θt = " + (d.tt * DEG).toFixed(2) + "°  θba = " + (d.tb * DEG).toFixed(2) + "°  |t| = " + state.dist.toFixed(2) + " m (not identifiable)");
    log.add("unknowns: " + (3 * M + 2) + "   residuals: " + (4 * M));
    /* play the drive: 14 Hz data at 4x speed */
    var stepPer = 4;
    for (var f = 0; f < M; f += stepPer) { state.frame = f; drawScene(); updateVelPlot(f); await CD.sleep(16); if (!state.running) return; }
    state.frame = M - 1; drawScene(); updateVelPlot(M - 1);
    /* initialise */
    var ini = initialise(d.ha, d.hb); var tt = ini.tt, tb = ini.tb;
    if (state.initOff) { tt = ((tt + state.initOff / DEG) % Math.PI + Math.PI) % Math.PI; tb = wrapPi(tb - state.initOff / DEG); log.add("initial guess perturbed by " + state.initOff + "° on both angles (basin-of-attraction test)", "warn"); }
    var st = linearStates(d.ha, d.hb, tt, tb, wa, wb), v = st.v, om = st.om;
    var c = cost(d.ha, d.hb, v, om, tt, tb, wa, wb);
    log.add("── closed-form initialisation (paper III-F) ──", "hl");
    log.add("θt0 = " + (tt * DEG).toFixed(2) + "°  (err " + (axisErr(tt, d.tt) * DEG).toFixed(2) + "°)   θba0 = " + (tb * DEG).toFixed(2) + "°  (err " + (wrapPi(tb - d.tb) * DEG).toFixed(2) + "°)   cost " + c.toExponential(3));
    state.trace.push({ it: 0, et: Math.abs(axisErr(tt, d.tt) * DEG), eb: Math.abs(wrapPi(tb - d.tb) * DEG), tt: tt, tb: tb });
    state.est = { tt: tt, tb: tb }; drawScene(); updateConv(); await CD.sleep(400);
    /* Levenberg-Marquardt */
    log.add("── Levenberg–Marquardt, Schur complement over " + M + " 3×3 blocks ──", "hl");
    var lam = 1e-4, it, converged = false, S = null;
    for (it = 1; it <= 60; it++) {
      var accepted = false, tries = 0;
      while (!accepted && tries < 12) {
        var stp = schurStep(d.ha, d.hb, v, om, tt, tb, wa, wb, lam), cN = cost(d.ha, d.hb, stp.v, stp.om, stp.tt, stp.tb, wa, wb);
        if (cN < c) { var rel = (c - cN) / c; v = stp.v; om = stp.om; tt = stp.tt; tb = stp.tb; c = cN; S = stp.S; lam = Math.max(lam / 3, 1e-12); accepted = true; if (rel < 1e-9) converged = true; }
        else { lam *= 5; tries++; }
      }
      if (!accepted) { converged = true; }
      state.trace.push({ it: it, et: Math.abs(axisErr(tt, d.tt) * DEG), eb: Math.abs(wrapPi(tb - d.tb) * DEG), tt: tt, tb: tb });
      log.add("it " + String(it).padStart(2) + "  cost " + c.toExponential(4) + "  λ " + lam.toExponential(1) + "  θt " + (tt * DEG).toFixed(3) + "°  θba " + (tb * DEG).toFixed(3) + "°  |err| " + (Math.abs(axisErr(tt, d.tt) * DEG)).toFixed(3) + " / " + (Math.abs(wrapPi(tb - d.tb) * DEG)).toFixed(3) + "°");
      state.est = { tt: tt, tb: tb }; drawScene(); updateConv(); await CD.sleep(220);
      if (converged) break;
    }
    /* covariance + identifiability */
    var Sinfo = schurInfo(d.ha, d.hb, v, om, tt, tb, wa, wb), cov = LA.inv(Sinfo), ev = LA.eigSym(Sinfo);
    var sdT = Math.sqrt(Math.max(cov[0][0], 0)) * DEG, sdB = Math.sqrt(Math.max(cov[1][1], 0)) * DEG, lmin = Math.min(ev.values[0], ev.values[1]);
    log.add("── result ──", "hl");
    log.add("θt  = " + (tt * DEG).toFixed(3) + "° ± " + sdT.toFixed(3) + "°   (truth " + (d.tt * DEG).toFixed(2) + "°, error " + (axisErr(tt, d.tt) * DEG).toFixed(3) + "°)", "ok");
    log.add("θba = " + (tb * DEG).toFixed(3) + "° ± " + sdB.toFixed(3) + "°   (truth " + (d.tb * DEG).toFixed(2) + "°, error " + (wrapPi(tb - d.tb) * DEG).toFixed(3) + "°)", "ok");
    log.add("smallest information eigenvalue: " + lmin.toExponential(2) + (lmin < 1e-3 ? "  → NOT identifiable (degenerate motion)" : "  → identifiable"), lmin < 1e-3 ? "warn" : "");
    var raw = 0, fus = 0; for (var j = 0; j < M; j++) { raw += Math.hypot(d.ha[j][0] - d.v[j][0], d.ha[j][1] - d.v[j][1]); fus += Math.hypot(v[j][0] - d.v[j][0], v[j][1] - d.v[j][1]); }
    log.add("fused ego-velocity error: raw " + (raw / M).toFixed(4) + " m/s → fused " + (fus / M).toFixed(4) + " m/s (mean over " + M + " steps)");
    log.add("iterations " + it + "   final cost " + c.toExponential(4) + "   χ² per residual " + (c / (4 * M)).toFixed(3) + " (≈1 when the noise model is right)");
    updateEst(tt, tb, cov, d);
    $("r2d-result").innerHTML = "<b>θt</b> " + (tt * DEG).toFixed(2) + "° <small>(truth " + (d.tt * DEG).toFixed(2) + "°)</small> &nbsp; <b>θba</b> " + (tb * DEG).toFixed(2) + "° <small>(truth " + (d.tb * DEG).toFixed(2) + "°)</small> &nbsp; <b>1σ</b> " + sdT.toFixed(2) + "° / " + sdB.toFixed(2) + "° &nbsp; <b>" + it + " iterations</b>";
    state.running = false; $("r2d-run").disabled = false;
  }
  function updateVelPlot(f) { var d = state.data; if (!d) return; var n = f + 1, t = d.t.slice(0, n); plotVel.clear().add("h_a x", t, d.ha.slice(0, n).map(function (h) { return h[0]; }), { color: C.hi }).add("h_a y", t, d.ha.slice(0, n).map(function (h) { return h[1]; }), { color: "#f2a08c" }).add("h_b x", t, d.hb.slice(0, n).map(function (h) { return h[0]; }), { color: C.blue }).add("h_b y", t, d.hb.slice(0, n).map(function (h) { return h[1]; }), { color: "#9fd0f0" }); plotVel.fixed = { x: [0, d.t[d.t.length - 1]] }; plotVel.draw(); }
  function updateConv() { var tr = state.trace; plotConv.clear().add("θt error", tr.map(function (r) { return r.it; }), tr.map(function (r) { return Math.max(r.et, 1e-3); }), { color: C.gold, marker: 3 }).add("θba error", tr.map(function (r) { return r.it; }), tr.map(function (r) { return Math.max(r.eb, 1e-3); }), { color: C.blue, marker: 3 }); plotConv.hline(2, C.hi, "paper: 2°"); plotConv.draw(); }
  function updateEst(tt, tb, cov, d) {
    var pts = 60, ex = [], ey = [], e = LA.eigSym(cov), a = Math.sqrt(Math.max(e.values[0], 0)) * 3 * DEG, b = Math.sqrt(Math.max(e.values[1], 0)) * 3 * DEG;
    for (var k = 0; k <= pts; k++) { var th = 2 * Math.PI * k / pts, x = a * Math.cos(th), y = b * Math.sin(th); ex.push(tt * DEG + e.vectors[0][0] * x + e.vectors[0][1] * y); ey.push(tb * DEG + e.vectors[1][0] * x + e.vectors[1][1] * y); }
    plotEst.clear().add("3σ ellipse", ex, ey, { color: C.green, width: 1.2 }).add("estimate", [tt * DEG], [tb * DEG], { color: C.green, marker: 5, line: false }).add("truth", [d.tt * DEG], [d.tb * DEG], { color: C.hi, marker: 5, line: false }).add("init", [state.trace[0].tt * DEG], [state.trace[0].tb * DEG], { color: C.gold, marker: 4, line: false });
    var trx = state.trace.map(function (r) { return r.tt * DEG; }), tryy = state.trace.map(function (r) { return r.tb * DEG; }); plotEst.add("LM path", trx, tryy, { color: C.ash, width: 1 }); plotEst.draw();
  }

  ["r2d-tt", "r2d-tb", "r2d-dist", "r2d-sigma", "r2d-T", "r2d-motion", "r2d-init"].forEach(function (id) { $(id).addEventListener("input", function () { readControls(); drawScene(); }); });
  $("r2d-run").addEventListener("click", run);
  $("r2d-stop").addEventListener("click", function () { state.running = false; $("r2d-run").disabled = false; log.add("stopped", "warn"); });
  window.addEventListener("resize", function () { [plotVel, plotConv, plotEst].forEach(function (p) { p.resize(); p.draw(); }); resizeScene(); drawScene(); });
  document.querySelectorAll(".theme-btn").forEach(function (b) { b.addEventListener("click", function () { setTimeout(function () { drawScene(); plotVel.draw(); plotConv.draw(); plotEst.draw(); }, 30); }); });
  function resizeScene() { var dpr = window.devicePixelRatio || 1, r = scene.getBoundingClientRect(); scene.width = Math.round(r.width * dpr); scene.height = Math.round((r.height || 360) * dpr); sceneCtx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  resizeScene(); readControls(); drawScene(); plotVel.draw(); plotConv.draw(); plotEst.draw();
})();

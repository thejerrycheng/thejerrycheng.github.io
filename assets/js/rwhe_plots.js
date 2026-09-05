/* rwhe_plots.js — 2-D plots of the real eight-camera experiment (assets/data/rwhe_scene.json). */
(function () {
  "use strict";
  var root = document.getElementById("rw-plots"); if (!root || !window.CD) return;
  var $ = function (id) { return document.getElementById(id); };
  var PAL = ["#1E88E5", "#D81B60", "#43A047", "#D9A13F", "#8E24AA", "#00ACC1", "#F4511E", "#C0CA33"];
  function tagColor(j, n) { return "hsl(" + Math.round(360 * j / n) + ", 70%, 58%)"; }
  function setup(canvas) { var dpr = window.devicePixelRatio || 1, r = canvas.getBoundingClientRect(); var w = Math.max(200, Math.round(r.width)), h = Math.max(160, Math.round(r.height)); canvas.width = w * dpr; canvas.height = h * dpr; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { ctx: ctx, w: w, h: h }; }
  var data = null, plots = {};

  function timeline() {
    var c = $("rwp-timeline"); if (!c) return; var g = setup(c), ctx = g.ctx, C = CD.colors(); var N = data.poses.length, K = data.cams.length, J = data.tags.length;
    var L = 46, R = 12, T = 22, B = 46; var rowH = (g.h - T - B) / K; ctx.clearRect(0, 0, g.w, g.h);
    ctx.font = "11px 'Space Mono', monospace"; ctx.fillStyle = C.ash; ctx.textAlign = "right";
    for (var k = 0; k < K; k++) { ctx.fillText("cam " + data.cams[k].id, L - 6, T + rowH * (k + 0.6)); ctx.fillStyle = C.grid || "rgba(128,128,128,0.25)"; ctx.fillRect(L, T + rowH * k + rowH - 1, g.w - L - R, 1); ctx.fillStyle = C.ash; }
    var xs = (g.w - L - R) / N;
    for (var i = 0; i < N; i++) { var obs = data.poses[i].obs; for (var o = 0; o < obs.length; o++) { ctx.fillStyle = tagColor(obs[o][1], J); ctx.fillRect(L + i * xs, T + rowH * obs[o][0] + 2, Math.max(1, xs), rowH - 5); } }
    ctx.textAlign = "left"; ctx.fillStyle = C.ash; ctx.fillText("rig pose index along the path →", L, g.h - 30);
    var lx = L; for (var j = 0; j < J; j++) { ctx.fillStyle = tagColor(j, J); ctx.fillRect(lx, g.h - 16, 10, 10); ctx.fillStyle = C.ash; ctx.fillText(String(data.tags[j].id), lx + 13, g.h - 7); lx += 36; }
  }
  function resid() {
    var c = $("rwp-resid"); if (!c) return; if (!plots.resid) plots.resid = new CD.Plot(c, { title: "", xlabel: "rig pose index along the path", ylabel: "loop-closure residual [cm]" }); var p = plots.resid; p.clear();
    var series = data.cams.map(function () { return { x: [], y: [] }; }); var all = [];
    data.poses.forEach(function (pose, i) { pose.obs.forEach(function (o) { if (o[2] === null) return; series[o[0]].x.push(i); series[o[0]].y.push(o[2]); all.push(o[2]); }); });
    series.forEach(function (s, k) { p.add("cam " + data.cams[k].id, s.x, s.y, { color: PAL[k], marker: 2.2, line: false }); });
    all.sort(function (a, b) { return a - b; }); var med = all[Math.floor(all.length / 2)]; p.hline(med, "#F4EAD2", "median " + med.toFixed(1) + " cm"); p.fixed = { y: [0, Math.min(30, all[Math.floor(all.length * 0.995)] * 1.1)] }; p.o.legend = true; p.draw();
  }
  function axesMap() {
    var c = $("rwp-axes"), sel = $("rwp-edge"); if (!c || !sel) return;
    if (!sel.options.length) { data.edges.slice().sort(function (a, b) { return b.n - a.n; }).forEach(function (e) { var o = document.createElement("option"); o.value = data.edges.indexOf(e); o.textContent = "tag " + data.tags[e.j].id + " – cam " + data.cams[e.k].id + "  (" + e.n + " poses" + (e.ident ? ", identifiable alone" : ", needs the graph") + ")"; sel.appendChild(o); }); sel.addEventListener("change", axesMap); }
    var e = data.edges[+sel.value]; if (!plots.axes) plots.axes = new CD.Plot(c, { title: "", xlabel: "axis azimuth [°]", ylabel: "axis elevation [°]" }); var p = plots.axes; p.clear();
    var big = e.axes.filter(function (a) { return a[2] >= 20; }), mid = e.axes.filter(function (a) { return a[2] >= 8 && a[2] < 20; }), small = e.axes.filter(function (a) { return a[2] < 8; });
    if (small.length) p.add("rotation < 8°", small.map(function (a) { return a[0]; }), small.map(function (a) { return a[1]; }), { color: "#8f8a7a", marker: 2.5, line: false });
    if (mid.length) p.add("8–20°", mid.map(function (a) { return a[0]; }), mid.map(function (a) { return a[1]; }), { color: "#D9A13F", marker: 4, line: false });
    if (big.length) p.add("≥ 20°", big.map(function (a) { return a[0]; }), big.map(function (a) { return a[1]; }), { color: e.ident ? "#43A047" : "#D81B60", marker: 6, line: false });
    p.fixed = { x: [-180, 180], y: [-90, 90] }; p.o.legend = true; p.o.title = (e.ident ? "distinct axes → identifiable on its own" : "axes nearly collinear → not identifiable alone") + " · " + e.axes.length + " relative rotations"; p.draw();
  }
  function coverage() {
    var c = $("rwp-coverage"); if (!c) return; var g = setup(c), ctx = g.ctx, C = CD.colors(); var J = data.tags.length, K = data.cams.length;
    var counts = data.tags.map(function () { return data.cams.map(function () { return 0; }); }); data.poses.forEach(function (p) { p.obs.forEach(function (o) { counts[o[1]][o[0]]++; }); });
    var tot = counts.map(function (r) { return r.reduce(function (a, b) { return a + b; }, 0); }); var max = Math.max.apply(null, tot);
    var L = 44, R = 10, T = 16, B = 40; var bw = (g.w - L - R) / J; ctx.clearRect(0, 0, g.w, g.h); ctx.font = "11px 'Space Mono', monospace";
    for (var gy = 0; gy <= 4; gy++) { var yv = max * gy / 4, y = T + (g.h - T - B) * (1 - gy / 4); ctx.fillStyle = "rgba(128,128,128,0.25)"; ctx.fillRect(L, y, g.w - L - R, 1); ctx.fillStyle = C.ash; ctx.textAlign = "right"; ctx.fillText(String(Math.round(yv)), L - 4, y + 4); }
    for (var j = 0; j < J; j++) { var y0 = T + (g.h - T - B); for (var k = 0; k < K; k++) { var h = (g.h - T - B) * counts[j][k] / max; if (!h) continue; ctx.fillStyle = PAL[k]; ctx.fillRect(L + j * bw + 3, y0 - h, bw - 6, h); y0 -= h; } ctx.fillStyle = C.ash; ctx.textAlign = "center"; ctx.fillText(String(data.tags[j].id), L + (j + 0.5) * bw, g.h - 24); }
    ctx.textAlign = "left"; ctx.fillText("tag id", L, g.h - 8); var lx = L + 60; for (var kk = 0; kk < K; kk++) { ctx.fillStyle = PAL[kk]; ctx.fillRect(lx, g.h - 17, 10, 10); ctx.fillStyle = C.ash; ctx.fillText("cam " + data.cams[kk].id, lx + 13, g.h - 8); lx += 62; }
  }
  function spectrum() {
    var c = $("rwp-spectrum"), card = $("rwp-spectrum-card"); if (!c) return; if (!data.spectrum) { if (card) card.hidden = true; return; } if (card) card.hidden = false;
    if (!plots.spec) plots.spec = new CD.Plot(c, { title: "", xlabel: "eigenvalue index (sorted)", ylabel: "eigenvalue of Z", logy: true }); var p = plots.spec; p.clear();
    var w = data.spectrum.map(function (x) { return Math.max(x, 1e-13); }); p.add("eigenvalues", w.map(function (_, i) { return i + 1; }), w, { color: "#1E88E5", marker: 3, line: true, width: 1 });
    p.add("λ₁ = " + w[0].toFixed(2), [1], [w[0]], { color: "#43A047", marker: 7, line: false }); p.add("λ₂ = " + w[1].toExponential(1) + "  (λ₂/λ₁ = " + (w[1] / w[0]).toExponential(1) + ")", [2], [w[1]], { color: "#D81B60", marker: 7, line: false });
    p.o.legend = true; p.draw();
  }
  function drawAll() { timeline(); resid(); axesMap(); coverage(); spectrum(); }
  fetch("assets/data/rwhe_scene.json").then(function (r) { return r.json(); }).then(function (d) { data = d; drawAll(); }).catch(function (e) { console.error("rwhe plots", e); });
  window.addEventListener("resize", function () { if (!data) return; Object.keys(plots).forEach(function (k) { plots[k].resize(); }); drawAll(); });
  document.querySelectorAll(".theme-btn").forEach(function (b) { b.addEventListener("click", function () { setTimeout(function () { if (data) drawAll(); }, 30); }); });
})();

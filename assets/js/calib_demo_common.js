/* Shared helpers for the in-browser calibration demos: seeded RNG, small dense linear
   algebra, a canvas plot, a log panel, a tiny 3-D projector and theme colours. */
(function () {
  "use strict";
  var CD = {};

  /* ---------- theme colours (follow the page's day / night tokens) ---------- */
  CD.colors = function () {
    var cs = getComputedStyle(document.documentElement);
    var g = function (n, d) { var v = cs.getPropertyValue(n).trim(); return v || d; };
    var night = document.documentElement.getAttribute("data-theme") !== "day";
    return { ink: g("--ink", "#151820"), panel: g("--panel", "#FDF6E2"), bone: g("--bone", "#F4EAD2"), hi: g("--hi", "#E4442A"),
             gold: g("--gold", "#D9A13F"), pop: g("--pop", "#FFCE0A"), blue: "#4FA3E0", green: "#2E9E5B", ash: g("--ash", "#8A8F9A"),
             text: night ? "#F7EFD9" : "#151820", grid: night ? "rgba(247,239,217,0.12)" : "rgba(21,24,32,0.12)", bg: night ? "#151820" : "#FDF6E2", night: night };
  };

  /* ---------- seeded random numbers ---------- */
  CD.rng = function (seed) {
    var a = (seed >>> 0) || 1;
    var f = function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    f.normal = function () { var u = 1 - f(), v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    f.int = function (n) { return Math.floor(f() * n); };
    return f;
  };

  /* ---------- dense linear algebra on plain arrays ---------- */
  var LA = CD.la = {};
  LA.zeros = function (n, m) { var A = []; for (var i = 0; i < n; i++) { A.push(new Float64Array(m)); } return A; };
  LA.eye = function (n) { var A = LA.zeros(n, n); for (var i = 0; i < n; i++) A[i][i] = 1; return A; };
  LA.mul = function (A, B) { var n = A.length, k = B.length, m = B[0].length, C = LA.zeros(n, m); for (var i = 0; i < n; i++) for (var p = 0; p < k; p++) { var a = A[i][p]; if (a === 0) continue; for (var j = 0; j < m; j++) C[i][j] += a * B[p][j]; } return C; };
  LA.mulv = function (A, v) { var n = A.length, m = v.length, r = new Float64Array(n); for (var i = 0; i < n; i++) { var s = 0; for (var j = 0; j < m; j++) s += A[i][j] * v[j]; r[i] = s; } return r; };
  LA.T = function (A) { var n = A.length, m = A[0].length, B = LA.zeros(m, n); for (var i = 0; i < n; i++) for (var j = 0; j < m; j++) B[j][i] = A[i][j]; return B; };
  LA.add = function (A, B, s) { s = s === undefined ? 1 : s; var n = A.length, m = A[0].length, C = LA.zeros(n, m); for (var i = 0; i < n; i++) for (var j = 0; j < m; j++) C[i][j] = A[i][j] + s * B[i][j]; return C; };
  LA.scale = function (A, s) { var n = A.length, m = A[0].length, C = LA.zeros(n, m); for (var i = 0; i < n; i++) for (var j = 0; j < m; j++) C[i][j] = s * A[i][j]; return C; };
  LA.solve = function (A0, b0) {   /* Gaussian elimination with partial pivoting; A0 n x n */
    var n = A0.length, A = A0.map(function (r) { return Float64Array.from(r); }), b = Float64Array.from(b0);
    for (var c = 0; c < n; c++) {
      var p = c, best = Math.abs(A[c][c]); for (var r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > best) { best = Math.abs(A[r][c]); p = r; }
      if (best < 1e-300) throw new Error("singular");
      if (p !== c) { var t = A[p]; A[p] = A[c]; A[c] = t; var tb = b[p]; b[p] = b[c]; b[c] = tb; }
      for (var r2 = c + 1; r2 < n; r2++) { var f = A[r2][c] / A[c][c]; if (f === 0) continue; for (var k = c; k < n; k++) A[r2][k] -= f * A[c][k]; b[r2] -= f * b[c]; }
    }
    var x = new Float64Array(n);
    for (var i = n - 1; i >= 0; i--) { var s = b[i]; for (var j = i + 1; j < n; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i]; }
    return x;
  };
  LA.inv = function (A) { var n = A.length, I = LA.eye(n), R = LA.zeros(n, n); for (var j = 0; j < n; j++) { var e = new Float64Array(n); e[j] = 1; var x = LA.solve(A, e); for (var i = 0; i < n; i++) R[i][j] = x[i]; } return R; };
  LA.eigSym = function (S) {   /* Jacobi eigenvalue algorithm for a symmetric matrix: returns {values, vectors(columns)} */
    var n = S.length, A = S.map(function (r) { return Float64Array.from(r); }), V = LA.eye(n);
    for (var sweep = 0; sweep < 60; sweep++) {
      var off = 0; for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (off < 1e-22) break;
      for (var p = 0; p < n; p++) for (var q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        var th = (A[q][q] - A[p][p]) / (2 * A[p][q]); var t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)); var c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (var k = 0; k < n; k++) { var akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (var k2 = 0; k2 < n; k2++) { var apk = A[p][k2], aqk = A[q][k2]; A[p][k2] = c * apk - s * aqk; A[q][k2] = s * apk + c * aqk; }
        for (var k3 = 0; k3 < n; k3++) { var vkp = V[k3][p], vkq = V[k3][q]; V[k3][p] = c * vkp - s * vkq; V[k3][q] = s * vkp + c * vkq; }
      }
    }
    var vals = []; for (var i2 = 0; i2 < n; i2++) vals.push(A[i2][i2]);
    return { values: vals, vectors: V };
  };
  LA.pinvSym = function (S, rel) {   /* pseudo-inverse of a symmetric PSD matrix via eigen decomposition */
    var e = LA.eigSym(S), n = S.length, mx = Math.max.apply(null, e.values.map(Math.abs)), R = LA.zeros(n, n);
    for (var k = 0; k < n; k++) { if (Math.abs(e.values[k]) < (rel || 1e-10) * mx) continue; var inv = 1 / e.values[k]; for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) R[i][j] += inv * e.vectors[i][k] * e.vectors[j][k]; }
    return R;
  };
  /* 3x3 rotation helpers */
  LA.rotvec = function (v) { var th = Math.hypot(v[0], v[1], v[2]); if (th < 1e-12) return LA.eye(3); var k = [v[0] / th, v[1] / th, v[2] / th], c = Math.cos(th), s = Math.sin(th), C = 1 - c;
    return [[c + k[0] * k[0] * C, k[0] * k[1] * C - k[2] * s, k[0] * k[2] * C + k[1] * s], [k[1] * k[0] * C + k[2] * s, c + k[1] * k[1] * C, k[1] * k[2] * C - k[0] * s], [k[2] * k[0] * C - k[1] * s, k[2] * k[1] * C + k[0] * s, c + k[2] * k[2] * C]]; };
  LA.logRot = function (R) { var c = Math.max(-1, Math.min(1, (R[0][0] + R[1][1] + R[2][2] - 1) / 2)), th = Math.acos(c); if (th < 1e-9) return [0, 0, 0]; var f = th / (2 * Math.sin(th)); return [f * (R[2][1] - R[1][2]), f * (R[0][2] - R[2][0]), f * (R[1][0] - R[0][1])]; };
  LA.cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  LA.projSO3 = function (M) {   /* nearest rotation: polar decomposition via M (M^T M)^{-1/2} using eigen decomposition */
    var MtM = LA.mul(LA.T(M), M), e = LA.eigSym(MtM), V = e.vectors, D = LA.zeros(3, 3);
    for (var i = 0; i < 3; i++) D[i][i] = 1 / Math.sqrt(Math.max(e.values[i], 1e-18));
    var R = LA.mul(M, LA.mul(V, LA.mul(D, LA.T(V))));
    var det = R[0][0] * (R[1][1] * R[2][2] - R[1][2] * R[2][1]) - R[0][1] * (R[1][0] * R[2][2] - R[1][2] * R[2][0]) + R[0][2] * (R[1][0] * R[2][1] - R[1][1] * R[2][0]);
    if (det < 0) { var mn = 0; for (var k = 1; k < 3; k++) if (e.values[k] < e.values[mn]) mn = k; var v = [V[0][mn], V[1][mn], V[2][mn]]; for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) R[r][c] -= 2 * (R[r][0] * v[0] + R[r][1] * v[1] + R[r][2] * v[2]) * v[c]; }
    return R;
  };

  /* ---------- canvas plot ---------- */
  CD.Plot = function (canvas, opts) {
    this.c = canvas; this.ctx = canvas.getContext("2d"); this.o = Object.assign({ title: "", xlabel: "", ylabel: "", logy: false, logx: false, legend: true, pad: { l: 52, r: 12, t: 26, b: 34 } }, opts || {});
    this.series = []; this.hlines = []; this.vlines = []; this.fixed = null; this.resize();
  };
  CD.Plot.prototype.resize = function () { var dpr = window.devicePixelRatio || 1, r = this.c.getBoundingClientRect(); var w = Math.max(200, Math.round(r.width)), h = Math.max(120, Math.round(r.height || 220)); this.c.width = w * dpr; this.c.height = h * dpr; this.W = w; this.H = h; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  CD.Plot.prototype.clear = function () { this.series = []; this.hlines = []; this.vlines = []; return this; };
  CD.Plot.prototype.add = function (name, xs, ys, style) { this.series.push({ name: name, xs: xs, ys: ys, style: Object.assign({ color: "#4FA3E0", width: 1.6, marker: 0, line: true }, style || {}) }); return this; };
  CD.Plot.prototype.hline = function (y, color, label) { this.hlines.push({ y: y, color: color, label: label }); return this; };
  CD.Plot.prototype.vline = function (x, color) { this.vlines.push({ x: x, color: color }); return this; };
  CD.Plot.prototype.draw = function () {
    var C = CD.colors(), ctx = this.ctx, o = this.o, p = o.pad, W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity, self = this;
    var fy = function (y) { return o.logy ? Math.log10(Math.max(y, 1e-300)) : y; }, fx = function (x) { return o.logx ? Math.log10(Math.max(x, 1e-300)) : x; };
    this.series.forEach(function (s) { for (var i = 0; i < s.xs.length; i++) { var x = fx(s.xs[i]), y = fy(s.ys[i]); if (!isFinite(x) || !isFinite(y)) continue; xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); } });
    this.hlines.forEach(function (h) { var y = fy(h.y); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); });
    if (this.fixed) { if (this.fixed.x) { xmin = fx(this.fixed.x[0]); xmax = fx(this.fixed.x[1]); } if (this.fixed.y) { ymin = fy(this.fixed.y[0]); ymax = fy(this.fixed.y[1]); } }
    if (!isFinite(xmin)) { xmin = 0; xmax = 1; } if (!isFinite(ymin)) { ymin = 0; ymax = 1; }
    if (xmax - xmin < 1e-12) { xmax = xmin + 1; } if (ymax - ymin < 1e-12) { ymax = ymin + 1; ymin -= 1; }
    if (!this.fixed || !this.fixed.y) { var dy = (ymax - ymin) * 0.06; ymin -= dy; ymax += dy; }
    var X = function (x) { return p.l + (fx(x) - xmin) / (xmax - xmin) * (W - p.l - p.r); }, Y = function (y) { return H - p.b - (fy(y) - ymin) / (ymax - ymin) * (H - p.t - p.b); };
    /* grid + ticks */
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.font = "10px 'Space Mono', monospace"; ctx.fillStyle = C.ash; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    var ticks = function (a, b, log) { var out = []; if (log) { for (var e = Math.floor(a); e <= Math.ceil(b); e++) if (e >= a - 1e-9 && e <= b + 1e-9) out.push({ v: e, l: (e >= -3 && e <= 4) ? String(Math.pow(10, e)) : "1e" + e }); return out; } var span = b - a, step = Math.pow(10, Math.floor(Math.log10(span))); if (span / step < 2) step /= 5; else if (span / step < 5) step /= 2; for (var v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push({ v: v, l: (Math.abs(v) < 1e-9 ? "0" : (step < 1 ? v.toFixed(Math.min(3, -Math.floor(Math.log10(step)))) : String(Math.round(v))))}); return out; };
    ticks(ymin, ymax, o.logy).forEach(function (t) { var y = H - p.b - (t.v - ymin) / (ymax - ymin) * (H - p.t - p.b); ctx.beginPath(); ctx.moveTo(p.l, y); ctx.lineTo(W - p.r, y); ctx.stroke(); ctx.fillText(t.l, p.l - 6, y); });
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ticks(xmin, xmax, o.logx).forEach(function (t) { var x = p.l + (t.v - xmin) / (xmax - xmin) * (W - p.l - p.r); ctx.beginPath(); ctx.moveTo(x, p.t); ctx.lineTo(x, H - p.b); ctx.stroke(); ctx.fillText(t.l, x, H - p.b + 5); });
    ctx.strokeStyle = C.ash; ctx.strokeRect(p.l, p.t, W - p.l - p.r, H - p.t - p.b);
    ctx.fillStyle = C.text; ctx.font = "11px 'Jost', sans-serif"; ctx.fillText(o.xlabel, (p.l + W - p.r) / 2, H - 15);
    ctx.save(); ctx.translate(13, (p.t + H - p.b) / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "middle"; ctx.fillText(o.ylabel, 0, 0); ctx.restore();
    ctx.font = "bold 12px 'Jost', sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillStyle = C.gold; ctx.fillText(o.title, p.l, 6);
    /* lines */
    ctx.save(); ctx.beginPath(); ctx.rect(p.l, p.t, W - p.l - p.r, H - p.t - p.b); ctx.clip();
    this.hlines.forEach(function (h) { ctx.strokeStyle = h.color; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(p.l, Y(h.y)); ctx.lineTo(W - p.r, Y(h.y)); ctx.stroke(); ctx.setLineDash([]); if (h.label) { ctx.fillStyle = h.color; ctx.font = "10px 'Jost', sans-serif"; ctx.textAlign = "right"; ctx.fillText(h.label, W - p.r - 4, Y(h.y) - 12); } });
    this.vlines.forEach(function (v) { ctx.strokeStyle = v.color; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(v.x), p.t); ctx.lineTo(X(v.x), H - p.b); ctx.stroke(); ctx.setLineDash([]); });
    this.series.forEach(function (s) {
      ctx.strokeStyle = s.style.color; ctx.fillStyle = s.style.color; ctx.lineWidth = s.style.width;
      if (s.style.line) { ctx.beginPath(); var started = false; for (var i = 0; i < s.xs.length; i++) { var x = X(s.xs[i]), y = Y(s.ys[i]); if (!isFinite(x) || !isFinite(y)) { started = false; continue; } if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); } ctx.stroke(); }
      if (s.style.marker) { for (var j = 0; j < s.xs.length; j++) { var x2 = X(s.xs[j]), y2 = Y(s.ys[j]); if (!isFinite(x2) || !isFinite(y2)) continue; ctx.beginPath(); ctx.arc(x2, y2, s.style.marker, 0, 2 * Math.PI); ctx.fill(); } }
    });
    ctx.restore();
    if (o.legend && this.series.length > 1) { ctx.font = "10px 'Jost', sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; var lx = W - p.r - 6, ly = p.t + 8; this.series.slice().reverse().forEach(function (s) { var w = ctx.measureText(s.name).width; lx -= w + 22; }); this.series.forEach(function (s) { ctx.fillStyle = s.style.color; ctx.fillRect(lx, ly - 3, 12, 6); ctx.fillStyle = C.text; ctx.fillText(s.name, lx + 16, ly); lx += ctx.measureText(s.name).width + 22; }); }
    return this;
  };

  /* ---------- log panel ---------- */
  CD.Log = function (el, max) { this.el = el; this.max = max || 400; this.lines = []; };
  CD.Log.prototype.add = function (s, cls) { this.lines.push({ s: s, cls: cls || "" }); if (this.lines.length > this.max) this.lines.shift(); this.el.innerHTML = this.lines.map(function (l) { return '<span class="' + l.cls + '">' + l.s.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</span>"; }).join("\n"); this.el.scrollTop = this.el.scrollHeight; };
  CD.Log.prototype.clear = function () { this.lines = []; this.el.innerHTML = ""; };

  /* ---------- tiny 3-D projector (orthographic with a rotating view) ---------- */
  CD.View3 = function (canvas, opts) { this.c = canvas; this.ctx = canvas.getContext("2d"); this.o = Object.assign({ az: -0.9, el: 0.45, scale: 120, center: [0, 0, 0] }, opts || {}); this.resize(); var self = this, drag = null;
    canvas.addEventListener("pointerdown", function (e) { drag = [e.clientX, e.clientY, self.o.az, self.o.el]; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", function (e) { if (!drag) return; self.o.az = drag[2] + (e.clientX - drag[0]) * 0.01; self.o.el = Math.max(-1.4, Math.min(1.4, drag[3] + (e.clientY - drag[1]) * 0.01)); if (self.onchange) self.onchange(); });
    canvas.addEventListener("pointerup", function () { drag = null; }); canvas.addEventListener("pointercancel", function () { drag = null; }); canvas.style.touchAction = "none"; };
  CD.View3.prototype.resize = function () { var dpr = window.devicePixelRatio || 1, r = this.c.getBoundingClientRect(); var w = Math.max(200, Math.round(r.width)), h = Math.max(160, Math.round(r.height || 320)); this.c.width = w * dpr; this.c.height = h * dpr; this.W = w; this.H = h; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  CD.View3.prototype.project = function (p) { var o = this.o, ca = Math.cos(o.az), sa = Math.sin(o.az), ce = Math.cos(o.el), se = Math.sin(o.el); var x = p[0] - o.center[0], y = p[1] - o.center[1], z = p[2] - o.center[2]; var x1 = ca * x + sa * y, y1 = -sa * x + ca * y; var y2 = ce * y1 + se * z, z2 = -se * y1 + ce * z; return [this.W / 2 + o.scale * x1, this.H / 2 - o.scale * z2, y2]; };
  CD.View3.prototype.line = function (a, b, color, width) { var A = this.project(a), B = this.project(b), ctx = this.ctx; ctx.strokeStyle = color; ctx.lineWidth = width || 1.2; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); };
  CD.View3.prototype.point = function (a, color, r) { var A = this.project(a), ctx = this.ctx; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(A[0], A[1], r || 3, 0, 2 * Math.PI); ctx.fill(); };
  CD.View3.prototype.text = function (a, s, color, dx, dy) { var A = this.project(a), ctx = this.ctx; ctx.fillStyle = color; ctx.font = "11px 'Jost', sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(s, A[0] + (dx || 6), A[1] + (dy || 0)); };
  CD.View3.prototype.frame = function (R, t, size, colors, width) { var cs = colors || ["#E4442A", "#2E9E5B", "#4FA3E0"]; for (var k = 0; k < 3; k++) { var e = [t[0] + size * R[0][k], t[1] + size * R[1][k], t[2] + size * R[2][k]]; this.line(t, e, cs[k], width || 2); } };
  CD.View3.prototype.frustum = function (R, t, size, color, width) { var c = [[-1, -0.75, 1.6], [1, -0.75, 1.6], [1, 0.75, 1.6], [-1, 0.75, 1.6]].map(function (v) { return [t[0] + size * (R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2]), t[1] + size * (R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2]), t[2] + size * (R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2])]; }); for (var i = 0; i < 4; i++) { this.line(t, c[i], color, width); this.line(c[i], c[(i + 1) % 4], color, width); } };
  CD.View3.prototype.clear = function (bg) { this.ctx.fillStyle = bg || CD.colors().bg; this.ctx.fillRect(0, 0, this.W, this.H); };
  CD.View3.prototype.ground = function (size, color, n) { n = n || 6; for (var i = -n; i <= n; i++) { this.line([-size, i * size / n, 0], [size, i * size / n, 0], color, 0.6); this.line([i * size / n, -size, 0], [i * size / n, size, 0], color, 0.6); } };

  CD.fmt = function (x, d) { return (typeof x === "number" && isFinite(x)) ? x.toFixed(d === undefined ? 3 : d) : String(x); };
  CD.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  window.CD = CD;
})();

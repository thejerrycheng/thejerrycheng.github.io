/* BlurTwist project page: interactive pieces.
   1. Blur lab: move the camera with sliders; every point smears by d = tau * J(x, Z) * xi (the page's Eq.);
      the six numbers are then recovered from the streaks alone with the same sign-free fit the project uses
      (collinearity null vector, scale from streak lengths, sign assignment + least squares).
   2. Shutter scrubber over the simulated frames.   3. Before/after wipes.
   No dependencies. */
(function () {
  'use strict';
  var F = 1161, W = 1280, H = 536;                       // the simulated camera: focal length and frame, in pixels
  var SHUTTERS = [250, 125, 60, 30, 15, 8];

  /* ---------- scene: far lights, near chess pieces (pixel offsets from the centre, depth in metres) ---------- */
  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  var rand = rng(7), PTS = [];
  for (var r = 0; r < 3; r++) for (var i = 0; i < 17; i++)
    PTS.push({ x: -600 + i * 75 + (rand() - 0.5) * 30, y: -215 + r * 62 + (rand() - 0.5) * 24, z: 2.1 + rand() * 0.5, far: true, hue: rand() });
  [[-330, 150, 0.52], [-170, 95, 0.62], [-40, 175, 0.5], [70, 60, 0.74], [190, 140, 0.56], [330, 85, 0.7], [470, 170, 0.5],
   [-480, 110, 0.66], [-250, 215, 0.47], [120, 220, 0.46], [400, 225, 0.47], [-90, 30, 0.82], [260, 20, 0.86]].forEach(function (p) {
    PTS.push({ x: p[0], y: p[1], z: p[2], far: false });
  });

  function jac(p) {                                       // 2x6 image Jacobian, rows = (x, y) pixel velocity
    var x = p.x, y = p.y, Z = p.z;
    return [[-F / Z, 0, x / Z, x * y / F, -(F + x * x / F), y],
            [0, -F / Z, y / Z, F + y * y / F, -x * y / F, -x]];
  }
  function mul(J, xi) { var a = 0, b = 0; for (var k = 0; k < 6; k++) { a += J[0][k] * xi[k]; b += J[1][k] * xi[k]; } return [a, b]; }
  function solve(A, b) {                                  // Gaussian elimination with pivoting, n x n
    var n = b.length, M = A.map(function (row, i) { return row.concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var piv = c; for (var r2 = c + 1; r2 < n; r2++) if (Math.abs(M[r2][c]) > Math.abs(M[piv][c])) piv = r2;
      var t = M[c]; M[c] = M[piv]; M[piv] = t;
      if (Math.abs(M[c][c]) < 1e-14) return null;
      for (var r3 = 0; r3 < n; r3++) if (r3 !== c) { var f = M[r3][c] / M[c][c]; for (var k = c; k <= n; k++) M[r3][k] -= f * M[c][k]; }
    }
    return M.map(function (row, i) { return row[n] / row[i]; });
  }

  /* ---------- the estimator: streaks (no arrowheads) -> twist, up to one global sign ---------- */
  function estimate(obs, tau) {
    if (obs.length < 8) return null;
    var Js = obs.map(function (o) { return jac(o.p).map(function (row) { return row.map(function (v) { return v * tau; }); }); });
    var col = [0, 0, 0, 0, 0, 0];
    Js.forEach(function (J) { for (var k = 0; k < 6; k++) col[k] += J[0][k] * J[0][k] + J[1][k] * J[1][k]; });
    col = col.map(function (v) { return Math.sqrt(v) + 1e-12; });
    // collinearity: d_perp . J xi = 0  ->  smallest eigenvector of M by inverse iteration
    var M = []; for (var a = 0; a < 6; a++) { M.push([0, 0, 0, 0, 0, 0]); }
    obs.forEach(function (o, i) {
      var n = Math.hypot(o.d[0], o.d[1]), px = -o.d[1] / n, py = o.d[0] / n, row = [];
      for (var k = 0; k < 6; k++) row.push((px * Js[i][0][k] + py * Js[i][1][k]) / col[k]);
      for (var a2 = 0; a2 < 6; a2++) for (var b2 = 0; b2 < 6; b2++) M[a2][b2] += row[a2] * row[b2];
    });
    var tr = 0; for (var q = 0; q < 6; q++) tr += M[q][q];
    for (q = 0; q < 6; q++) M[q][q] += 1e-9 * tr;
    var v = [1, 0.7, -0.4, 0.3, -0.8, 0.5];
    for (var it = 0; it < 25; it++) {
      var s = solve(M, v); if (!s) return null;
      var nn = Math.sqrt(s.reduce(function (acc, e) { return acc + e * e; }, 0)); v = s.map(function (e) { return e / nn; });
    }
    var xi = v.map(function (e, k) { return e / col[k]; });
    var num = 0, den = 0;                                // scale from the streak lengths
    obs.forEach(function (o, i) { var pr = mul(Js[i], xi); num += Math.abs(pr[0] * o.d[0] + pr[1] * o.d[1]); den += pr[0] * pr[0] + pr[1] * pr[1]; });
    xi = xi.map(function (e) { return e * num / den; });
    for (it = 0; it < 6; it++) {                          // assign signs, then plain least squares
      var A = [], bvec = [0, 0, 0, 0, 0, 0]; for (a = 0; a < 6; a++) A.push([0, 0, 0, 0, 0, 0]);
      obs.forEach(function (o, i) {
        var pr = mul(Js[i], xi), sg = (pr[0] * o.d[0] + pr[1] * o.d[1]) < 0 ? -1 : 1;
        for (var r4 = 0; r4 < 2; r4++) for (var a3 = 0; a3 < 6; a3++) {
          bvec[a3] += Js[i][r4][a3] * sg * o.d[r4];
          for (var b3 = 0; b3 < 6; b3++) A[a3][b3] += Js[i][r4][a3] * Js[i][r4][b3];
        }
      });
      var sol = solve(A, bvec); if (!sol) break; xi = sol;
    }
    return xi;
  }

  /* ---------- blur lab ---------- */
  var lab = document.getElementById('bt-lab');
  if (lab) {
    var cv = lab.querySelector('canvas'), ctx = cv.getContext('2d');
    var KEYS = ['vx', 'vy', 'vz', 'wx', 'wy', 'wz'], inputs = {}, state = { xi: [0, 0, 0, 0, 0, 0], sh: 3 };
    KEYS.forEach(function (k) { inputs[k] = lab.querySelector('[data-k="' + k + '"]'); });
    var shut = lab.querySelector('[data-k="sh"]'), shOut = lab.querySelector('[data-o="sh"]');
    var outTrue = lab.querySelectorAll('[data-true]'), outEst = lab.querySelectorAll('[data-est]'), note = lab.querySelector('.bt-note');
    var noise = rng(11), gauss = function () { return Math.sqrt(-2 * Math.log(noise() + 1e-9)) * Math.cos(6.2832 * noise()); };
    var NZ = PTS.map(function () { return [gauss() * 0.45, gauss() * 0.45, noise() < 0.5 ? -1 : 1]; });   // fixed per point: no flicker

    function read() {
      state.xi = [+inputs.vx.value / 100, +inputs.vy.value / 100, +inputs.vz.value / 100,
                  +inputs.wx.value * Math.PI / 180, +inputs.wy.value * Math.PI / 180, +inputs.wz.value * Math.PI / 180];
      state.sh = +shut.value;
    }
    function fmt(v, i) { return i < 3 ? (v * 100).toFixed(0) : (v * 180 / Math.PI).toFixed(1); }
    function draw() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), cw = cv.clientWidth, ch = cw * H / W;
      if (cv.width !== Math.round(cw * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
      var s = cv.width / W, tau = 1 / SHUTTERS[state.sh];
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#060607'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.setTransform(s, 0, 0, s, cv.width / 2, cv.height / 2); ctx.lineCap = 'round';
      var obs = [];
      PTS.forEach(function (p, i) {
        var d = mul(jac(p), state.xi); d = [d[0] * tau, d[1] * tau];
        var len = Math.hypot(d[0], d[1]);
        ctx.strokeStyle = p.far ? 'hsl(' + (34 + p.hue * 14) + ',100%,' + (62 + p.hue * 14) + '%)' : '#f5f5f7';
        ctx.lineWidth = p.far ? 7 : 15; ctx.globalAlpha = p.far ? 0.95 : 0.9;
        ctx.beginPath(); ctx.moveTo(p.x - d[0] / 2, p.y - d[1] / 2); ctx.lineTo(p.x + d[0] / 2 + 0.01, p.y + d[1] / 2); ctx.stroke();
        // what the estimator gets: the streak with half a pixel of noise and a random arrowhead; unreadable if too short or too long
        if (len > 2.5 && len < 58) obs.push({ p: p, d: [(d[0] + NZ[i][0]) * NZ[i][2], (d[1] + NZ[i][1]) * NZ[i][2]] });
      });
      ctx.globalAlpha = 1;
      var est = estimate(obs, tau), moving = state.xi.some(function (v) { return Math.abs(v) > 1e-9; });
      if (est) {                                          // one global sign cannot be known from one frame: show the closer one
        var dp = 0; for (var k = 0; k < 6; k++) dp += est[k] * state.xi[k] * (k < 3 ? 40 : 1); if (dp < 0) est = est.map(function (e) { return -e; });
      }
      for (var j = 0; j < 6; j++) {
        outTrue[j].textContent = fmt(state.xi[j], j);
        outEst[j].textContent = est ? fmt(est[j], j) : '–';
        outEst[j].parentNode.classList.toggle('off', !est);
      }
      note.textContent = !moving ? 'Camera still. No streaks, nothing to read.'
        : est ? obs.length + ' of ' + PTS.length + ' streaks readable. The six numbers come from the streaks alone.'
        : (obs.length < 8 ? 'Too few readable streaks: the blur is too short or too long. Change the shutter.' : 'Fit failed.');
      shOut.textContent = '1/' + SHUTTERS[state.sh] + ' s';
    }
    function set(vals) { KEYS.forEach(function (k, i) { inputs[k].value = vals[i]; }); read(); draw(); }
    lab.addEventListener('input', function () { read(); draw(); });
    lab.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = { slide: [18, 0, 0, 0, 0, 0], pan: [0, 0, 0, 0, 14, 0], push: [0, 0, 28, 0, 0, 0], roll: [0, 0, 0, 0, 0, 22],
                  hand: [9, -6, 8, 7, -10, 9], still: [0, 0, 0, 0, 0, 0] }[b.getAttribute('data-preset')];
        lab.querySelectorAll('[data-preset]').forEach(function (o) { o.classList.toggle('on', o === b); });
        set(p);
      });
    });
    window.addEventListener('resize', draw);
    set([9, -6, 8, 7, -10, 9]);
  }

  /* ---------- shutter scrubber ---------- */
  var sc = document.getElementById('bt-shutter');
  if (sc) {
    var img = sc.querySelector('img'), rg = sc.querySelector('input'), cap = sc.querySelector('.bt-cap'), data = JSON.parse(sc.getAttribute('data-info'));
    var upd = function () {
      var d = data[+rg.value]; img.src = d.src;
      cap.innerHTML = '<b>' + d.s + ' s</b><span>' + d.blur + ' px of blur</span><i class="' + (d.ok ? 'ok' : '') + '">' + d.res + '</i>';
    };
    data.forEach(function (d) { var im = new Image(); im.src = d.src; });
    rg.addEventListener('input', upd); upd();
  }

  /* ---------- before / after wipes ---------- */
  document.querySelectorAll('.bt-wipe').forEach(function (w) {
    var top = w.querySelector('.top'), bar = w.querySelector('.bar'), drag = false;
    var setp = function (cx) { var r = w.getBoundingClientRect(), p = Math.max(0, Math.min(1, (cx - r.left) / r.width)); top.style.clipPath = 'inset(0 ' + (100 - p * 100) + '% 0 0)'; bar.style.left = (p * 100) + '%'; };
    w.addEventListener('pointerdown', function (e) { drag = true; w.setPointerCapture(e.pointerId); setp(e.clientX); });
    w.addEventListener('pointermove', function (e) { if (drag) setp(e.clientX); });
    w.addEventListener('pointerup', function () { drag = false; });
    w.addEventListener('pointercancel', function () { drag = false; });
  });
})();

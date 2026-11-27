/* BlurTwist project page: interactive pieces.
   1. Blur lab: move the camera with sliders; every point smears by d = tau * J(x, Z) * xi (the page's Eq.);
      the six numbers are then recovered from the streaks alone with the same sign-free fit the project uses
      (collinearity null vector, scale from streak lengths, sign assignment + least squares).
   2. Shutter scrubber over the simulated frames.   3. Before/after wipes.
   No dependencies. */
(function () {
  'use strict';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var F = 1161, W = 1280, H = 536;                       // the simulated camera: focal length and frame, in pixels
  var SHUTTERS = [250, 125, 60, 30, 15, 8];

  function onSeen(el, fn, th) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold: th || 0.3 });
    io.observe(el);
  }

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
    var sweep = -1;                                        // -1: static drawing (reduced motion)
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
        if (sweep < 0) { ctx.beginPath(); ctx.moveTo(p.x - d[0] / 2, p.y - d[1] / 2); ctx.lineTo(p.x + d[0] / 2 + 0.01, p.y + d[1] / 2); ctx.stroke(); }
        else {                                            // exposure in progress: the recorded streak so far, and the point itself
          var u = Math.min(1, sweep / 0.72), hx = p.x + d[0] * (u - 0.5), hy = p.y + d[1] * (u - 0.5);
          ctx.globalAlpha *= 0.28; ctx.beginPath(); ctx.moveTo(p.x - d[0] / 2, p.y - d[1] / 2); ctx.lineTo(p.x + d[0] / 2 + 0.01, p.y + d[1] / 2); ctx.stroke();
          ctx.globalAlpha = p.far ? 0.95 : 0.9; ctx.beginPath(); ctx.moveTo(p.x - d[0] / 2, p.y - d[1] / 2); ctx.lineTo(hx + 0.01, hy); ctx.stroke();
          ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, (p.far ? 3.5 : 7.5) * (u < 1 ? 1.15 : 1), 0, 6.2832); ctx.fill();
        }
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
    lab.addEventListener('input', function (e) { if (e.isTrusted) stopAuto(); read(); draw(); });
    /* motion: the shutter "opens" over and over (a bright head travels each streak), and until the reader
       touches a control the camera tours the presets, easing from one move to the next */
    var PRESETS = { slide: [18, 0, 0, 0, 0, 0], pan: [0, 0, 0, 0, 14, 0], push: [0, 0, 28, 0, 0, 0], roll: [0, 0, 0, 0, 0, 22],
                    hand: [9, -6, 8, 7, -10, 9], still: [0, 0, 0, 0, 0, 0] };
    var TOUR = ['hand', 'slide', 'pan', 'push', 'roll'], auto = !REDUCED, tourI = 0, tourT = 0, from = PRESETS.hand, visible = false, last = 0;
    function stopAuto() { auto = false; lab.classList.add('touched'); }
    function mark(name) { lab.querySelectorAll('[data-preset]').forEach(function (o) { o.classList.toggle('on', o.getAttribute('data-preset') === name); }); }
    function ease(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
    function frame(now) {
      if (!visible) return;
      var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
      sweep = (now / 1400) % 1;
      if (auto) {
        tourT += dt;
        var hold = 2.6, move = 1.1, to = PRESETS[TOUR[(tourI + 1) % TOUR.length]];
        if (tourT > hold) {
          var u = Math.min(1, (tourT - hold) / move), e = ease(u);
          KEYS.forEach(function (k, i) { inputs[k].value = from[i] + (to[i] - from[i]) * e; });
          if (u >= 1) { tourI = (tourI + 1) % TOUR.length; tourT = 0; from = to; mark(TOUR[tourI]); }
          read();
        }
      }
      draw();
      requestAnimationFrame(frame);
    }
    if ('IntersectionObserver' in window && !REDUCED) {
      new IntersectionObserver(function (en) {
        var was = visible; visible = en[0].isIntersecting;
        if (visible && !was) { last = performance.now(); requestAnimationFrame(frame); }
      }, { threshold: 0.15 }).observe(lab);
    }
    lab.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        stopAuto(); mark(b.getAttribute('data-preset')); set(PRESETS[b.getAttribute('data-preset')]);
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
    var playing = !REDUCED, dir = 1;
    rg.addEventListener('input', function (e) { if (e.isTrusted) playing = false; upd(); }); upd();
    rg.addEventListener('pointerdown', function () { playing = false; });
    onSeen(sc, function () {
      var id = setInterval(function () {
        if (!playing) { clearInterval(id); return; }
        var v = +rg.value + dir; if (v > 5 || v < 0) { dir = -dir; v = +rg.value + dir; }
        rg.value = v; upd();
      }, 1100);
    });
  }

  /* ---------- before / after wipes ---------- */
  document.querySelectorAll('.bt-wipe').forEach(function (w) {
    var top = w.querySelector('.top'), bar = w.querySelector('.bar'), drag = false;
    var setp = function (cx) { var r = w.getBoundingClientRect(), p = Math.max(0, Math.min(1, (cx - r.left) / r.width)); top.style.clipPath = 'inset(0 ' + (100 - p * 100) + '% 0 0)'; bar.style.left = (p * 100) + '%'; };
    var demo = null;
    onSeen(w, function () {                               // sweep once so the reader sees that it moves
      if (REDUCED) return;
      var t0 = performance.now(), r = w.getBoundingClientRect();
      demo = function (now) {
        var u = (now - t0) / 2200; if (u >= 1 || drag) { if (!drag) setp(w.getBoundingClientRect().left + r.width / 2); demo = null; return; }
        setp(w.getBoundingClientRect().left + r.width * (0.5 + 0.32 * Math.sin(u * 6.2832))); requestAnimationFrame(demo);
      };
      requestAnimationFrame(demo);
    });
    w.addEventListener('pointerdown', function (e) { drag = true; w.setPointerCapture(e.pointerId); setp(e.clientX); });
    w.addEventListener('pointermove', function (e) { if (drag) setp(e.clientX); });
    w.addEventListener('pointerup', function () { drag = false; });
    w.addEventListener('pointercancel', function () { drag = false; });
  });

  /* ---------- scroll reveals ---------- */
  (function () {
    var sel = '.open, .facts .fact, .stage, .tiles > *, .steps > *, .cine > *, .two > *, #bt-lab, #bt-shutter, .plots > *, .links, .bt-fig';
    var els = Array.prototype.slice.call(document.querySelectorAll(sel));
    if (REDUCED || !('IntersectionObserver' in window)) return;
    els.forEach(function (el) {
      var sib = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.classList.add('rv'); el.style.transitionDelay = (Math.min(sib, 5) * 70) + 'ms';
    });
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ---------- numbers count up when they come into view ---------- */
  document.querySelectorAll('.fact .v, .tile b, .cine b.n, .cine p b').forEach(function (el) {
    var node = el.firstChild; if (!node || node.nodeType !== 3 || REDUCED) return;
    var m = /^([+\u2212-]?)(\d+(?:\.(\d+))?)(.*)$/.exec(node.nodeValue); if (!m) return;
    var target = parseFloat(m[2]), dec = m[3] ? m[3].length : 0, pre = m[1], post = m[4];
    if (target === 0) return;
    node.nodeValue = pre + (0).toFixed(dec) + post;
    onSeen(el, function () {
      var t0 = performance.now();
      (function tick(now) {
        var u = Math.min(1, (now - t0) / 1100), e = 1 - Math.pow(1 - u, 3);
        node.nodeValue = pre + (target * e).toFixed(dec) + post;
        if (u < 1) requestAnimationFrame(tick);
      })(t0);
    }, 0.6);
  });

  /* ---------- live charts: error against blur length, drawn in on scroll, readable on hover ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e;
  }
  document.querySelectorAll('.bt-chart').forEach(function (box) {
    var cfg = JSON.parse(box.getAttribute('data-chart')), Wd = 520, Ht = 340, m = { l: 58, r: 16, t: 34, b: 56 };
    var svg = el('svg', { viewBox: '0 0 ' + Wd + ' ' + Ht, role: 'img', 'aria-label': cfg.title }, box);
    var xs = cfg.x, lx = function (v) { return m.l + (Math.log(v) - Math.log(xs[0] * 0.8)) / (Math.log(xs[xs.length - 1] * 1.25) - Math.log(xs[0] * 0.8)) * (Wd - m.l - m.r); };
    var ly = function (v) { return Ht - m.b - (Math.log(v) - Math.log(cfg.ymin)) / (Math.log(cfg.ymax) - Math.log(cfg.ymin)) * (Ht - m.t - m.b); };
    el('text', { x: m.l, y: 18, 'class': 'ttl' }, svg, cfg.title);
    el('rect', { x: lx(5), y: m.t, width: lx(25) - lx(5), height: Ht - m.t - m.b, 'class': 'range' }, svg);
    el('text', { x: (lx(5) + lx(25)) / 2, y: m.t + 16, 'class': 'rangelab' }, svg, 'working range');
    cfg.yticks.forEach(function (v) {
      el('line', { x1: m.l, x2: Wd - m.r, y1: ly(v), y2: ly(v), 'class': 'grid' }, svg);
      el('text', { x: m.l - 8, y: ly(v) + 4, 'class': 'tick', 'text-anchor': 'end' }, svg, v);
    });
    xs.forEach(function (v, i) {
      el('text', { x: lx(v), y: Ht - m.b + 18, 'class': 'tick', 'text-anchor': 'middle' }, svg, Math.round(v) + ' px');
      el('text', { x: lx(v), y: Ht - m.b + 33, 'class': 'tick dim', 'text-anchor': 'middle' }, svg, cfg.shutters[i] + ' s');
    });
    el('line', { x1: m.l, x2: Wd - m.r, y1: ly(cfg.truth), y2: ly(cfg.truth), 'class': 'truth' }, svg);
    el('text', { x: Wd - m.r - 4, y: ly(cfg.truth) - 6, 'class': 'tick', 'text-anchor': 'end' }, svg, 'true speed');
    var clampY = function (v) { return ly(Math.min(cfg.ymax, Math.max(cfg.ymin, v))); };
    cfg.series.forEach(function (sr, si) {
      var up = xs.map(function (v, i) { return lx(v) + ',' + clampY(sr.q75[i]); }), dn = xs.map(function (v, i) { return lx(v) + ',' + clampY(sr.q25[i]); }).reverse();
      el('polygon', { points: up.concat(dn).join(' '), 'class': 'band s' + sr.cls }, svg);
      var path = el('polyline', { points: xs.map(function (v, i) { return lx(v) + ',' + clampY(sr.med[i]); }).join(' '), 'class': 'line s' + sr.cls }, svg);
      var len = path.getTotalLength(); path.style.strokeDasharray = len; path.style.strokeDashoffset = len; path.style.transitionDelay = (si * 250) + 'ms';
      xs.forEach(function (v, i) { var c = el('circle', { cx: lx(v), cy: clampY(sr.med[i]), r: 5, 'class': 'pt s' + sr.cls }, svg); c.style.transitionDelay = (si * 250 + 350 + i * 110) + 'ms'; });
      el('text', { x: m.l + 12, y: Ht - m.b - 14 - (cfg.series.length - 1 - si) * 17, 'class': 'leg s' + sr.cls }, svg, '\u25CF ' + sr.name);
    });
    var cur = el('line', { y1: m.t, y2: Ht - m.b, 'class': 'cursor' }, svg), tip = document.createElement('div'); tip.className = 'bt-tip'; box.appendChild(tip);
    function hover(e) {
      var r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * Wd, best = 0;
      xs.forEach(function (v, i) { if (Math.abs(lx(v) - px) < Math.abs(lx(xs[best]) - px)) best = i; });
      cur.setAttribute('x1', lx(xs[best])); cur.setAttribute('x2', lx(xs[best])); cur.style.opacity = 1;
      tip.innerHTML = '<b>' + cfg.shutters[best] + ' s \u00b7 ' + Math.round(xs[best]) + ' px</b>' + cfg.series.map(function (sr) {
        return '<span class="s' + sr.cls + '">' + sr.name + ': ' + (+sr.med[best]).toFixed(cfg.dec) + ' ' + cfg.unit + '</span>'; }).join('');
      tip.style.opacity = 1; tip.style.left = Math.min(r.width - 150, Math.max(0, (lx(xs[best]) / Wd) * r.width + 10)) + 'px';
    }
    svg.addEventListener('pointermove', hover); svg.addEventListener('pointerdown', hover);
    svg.addEventListener('pointerleave', function () { cur.style.opacity = 0; tip.style.opacity = 0; });
    if (REDUCED) box.classList.add('in'); else onSeen(box, function () { box.classList.add('in'); }, 0.35);
  });
})();

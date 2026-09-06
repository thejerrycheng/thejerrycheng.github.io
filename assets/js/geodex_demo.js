/* geodex_demo.js — the retargeting playground UI: draws the ORCA hand and the
   operator's recorded hand side by side, and lets you switch each term of the
   released cost off and watch the pinch geometry come apart. */
(function () {
  'use strict';
  const G = window.GEODEX;
  const $ = (id) => document.getElementById(id);
  const cv = $('gd-canvas');
  if (!G || !cv) return;

  const CHAINS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
  const FINGER = ['thumb', 'index', 'middle', 'ring', 'pinky'];
  const S = { data: null, hand: null, q: null, f: 0, playing: true, yaw: -0.55, pitch: 0.35,
              drag: null, hist: [], last: 0 };

  const W = () => ({
    cos: $('gd-cos').checked ? 50 : 0,
    rel: $('gd-rel').checked ? 100 : 0,
    smooth: $('gd-smooth').checked ? 0.5 : 0,
    reg: 0.02,
    pos: $('gd-pos').checked ? 400 : 0
  });

  function sizeCanvas(c) {
    const r = c.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(320, r.width * d); c.height = Math.max(240, r.height * d);
    return d;
  }

  function project(p, w, h, s) {
    // palm-frame point -> screen. Yaw about the palm normal, then pitch.
    const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
    const cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
    const x1 = p[0] * cy + p[2] * sy;
    const z1 = -p[0] * sy + p[2] * cy;
    const y1 = p[1] * cp - z1 * sp;
    const z2 = p[1] * sp + z1 * cp;
    return [w / 2 + x1 * s, h / 2 - y1 * s, z2];
  }

  function draw(rp, tg, dpr) {
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    const css = getComputedStyle(document.documentElement);
    const ink = (css.getPropertyValue('--ink') || '#151820').trim();
    const bone = (css.getPropertyValue('--panel') || '#FDF6E2').trim();
    const hi = (css.getPropertyValue('--hi') || '#E4442A').trim();
    const gold = (css.getPropertyValue('--gold') || '#D9A13F').trim();
    g.clearRect(0, 0, w, h);
    g.fillStyle = bone; g.fillRect(0, 0, w, h);

    const s = Math.min(w, h) * 2.6;
    const P = (p) => project(p, w, h, s);

    // ground shadow of the palm
    g.strokeStyle = 'rgba(21,24,32,0.15)'; g.lineWidth = 1 * dpr;
    g.beginPath(); g.ellipse(w / 2, h / 2 + 0.02 * s, 0.055 * s, 0.02 * s, 0, 0, 7); g.stroke();

    // operator's hand: dashed ghost
    if ($('gd-ghost').checked) {
      g.setLineDash([5 * dpr, 4 * dpr]); g.lineWidth = 1.6 * dpr;
      g.strokeStyle = gold; g.globalAlpha = .75;
      CHAINS.forEach((c) => {
        g.beginPath();
        const o = P([0, 0, 0]); g.moveTo(o[0], o[1]);
        c.forEach((k) => { const q = P(tg[k]); g.lineTo(q[0], q[1]); });
        g.stroke();
      });
      g.setLineDash([]);
      g.fillStyle = gold;
      [4, 8, 12, 16, 20].forEach((k) => {
        const q = P(tg[k]);
        g.beginPath(); g.arc(q[0], q[1], 3.2 * dpr, 0, 7); g.fill();
      });
      g.globalAlpha = 1;
    }

    // robot hand
    CHAINS.forEach((c, fi) => {
      g.lineWidth = 5.2 * dpr; g.lineCap = 'round';
      g.strokeStyle = fi === 0 ? hi : ink;
      g.beginPath();
      const o = P([0, 0, 0]); g.moveTo(o[0], o[1]);
      c.forEach((k) => { const q = P(rp[k]); g.lineTo(q[0], q[1]); });
      g.stroke();
      c.forEach((k, ji) => {
        const q = P(rp[k]);
        g.fillStyle = ji === c.length - 1 ? gold : bone;
        g.strokeStyle = ink; g.lineWidth = 1.6 * dpr;
        g.beginPath(); g.arc(q[0], q[1], (ji === c.length - 1 ? 5 : 3.4) * dpr, 0, 7);
        g.fill(); g.stroke();
      });
    });

    // the pinch pair, called out
    const a = P(rp[4]), b = P(rp[8]);
    g.setLineDash([3 * dpr, 3 * dpr]); g.strokeStyle = hi; g.lineWidth = 2 * dpr;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.setLineDash([]);
    const d = G.norm(G.sub(rp[8], rp[4])) * 1000;
    g.fillStyle = hi; g.font = `${12 * dpr}px "Space Mono", monospace`;
    g.fillText(d.toFixed(0) + ' mm', (a[0] + b[0]) / 2 + 8 * dpr, (a[1] + b[1]) / 2 - 6 * dpr);

    // legend
    g.fillStyle = ink; g.font = `${11 * dpr}px "Space Mono", monospace`;
    g.fillText('ORCA hand', 12 * dpr, h - 12 * dpr);
    g.fillStyle = gold;
    g.fillText('operator (dashed)', 92 * dpr, h - 12 * dpr);
  }

  function sparkline(hist) {
    const c = $('gd-spark');
    if (!c) return;
    const dpr = sizeCanvas(c), g = c.getContext('2d'), w = c.width, h = c.height;
    const css = getComputedStyle(document.documentElement);
    const ink = (css.getPropertyValue('--ink') || '#151820').trim();
    const hi = (css.getPropertyValue('--hi') || '#E4442A').trim();
    g.clearRect(0, 0, w, h);
    if (hist.length < 2) return;
    const max = 120, pad = 18 * dpr;
    const X = (i) => pad + i / (hist.length - 1) * (w - pad * 1.4);
    const Y = (v) => h - pad - Math.min(v, max) / max * (h - pad * 1.8);
    g.strokeStyle = 'rgba(21,24,32,.35)'; g.lineWidth = 1 * dpr;
    g.beginPath(); g.moveTo(pad, h - pad); g.lineTo(w - pad * .4, h - pad); g.stroke();
    [['h', ink, 2], ['r', hi, 1.7]].forEach(([key, col, lw]) => {
      g.strokeStyle = col; g.lineWidth = lw * dpr; g.beginPath();
      hist.forEach((p, i) => i ? g.lineTo(X(i), Y(p[key])) : g.moveTo(X(i), Y(p[key])));
      g.stroke();
    });
    g.fillStyle = ink; g.font = `${10 * dpr}px "Space Mono", monospace`;
    g.fillText('thumb–index distance [mm]  — operator  — ORCA', pad, 13 * dpr);
  }

  function frame() {
    const D = S.data, hand = S.hand;
    const tg = {}; D.keys.forEach((k, i) => tg[k] = D.trajectory[S.f][i]);
    const t0 = performance.now();
    const res = G.solve(hand, tg, S.q, W(), { sweeps: 14 });
    const ms = performance.now() - t0;
    S.q = res.q;
    const rp = hand.fk(S.q);

    const hp = G.norm(G.sub(tg[8], tg[4])) * 1000;
    const rq = G.norm(G.sub(rp[8], rp[4])) * 1000;
    let ang = 0;
    G.TIPS.forEach((k) => {
      const c = G.dot(rp[k], tg[k]) / (G.norm(rp[k]) * G.norm(tg[k]) + 1e-9);
      ang += Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
    });
    ang /= G.TIPS.length;

    S.hist.push({ h: hp, r: rq });
    if (S.hist.length > 90) S.hist.shift();

    const dpr = sizeCanvas(cv);
    draw(rp, tg, dpr);
    sparkline(S.hist);

    const pinching = hp < Math.sqrt(hand.k.pinch_gate_sq) * 1000;
    $('gd-out').innerHTML =
      `frame <b>${S.f + 1}/${D.trajectory.length}</b>` +
      `<br>thumb–index &nbsp;operator <b>${hp.toFixed(1)} mm</b> &nbsp; ORCA <b>${rq.toFixed(1)} mm</b>` +
      `<br>pinch error <b class="${Math.abs(hp - rq) > 20 ? 'gd-bad' : 'gd-ok'}">${Math.abs(hp - rq).toFixed(1)} mm</b>` +
      (pinching ? ' <span class="gd-gate">pinching</span>' : '') +
      `<br>fingertip direction error <b>${ang.toFixed(1)}°</b>` +
      `<br>cost <b>${res.f.toFixed(3)}</b> &nbsp; ${res.evals} FK evals &nbsp; <b>${ms.toFixed(1)} ms</b>`;

    $('gd-scrub').value = S.f;
  }

  function tick(ts) {
    if (S.playing && ts - S.last > 1000 / (S.data.fps * (+$('gd-speed').value))) {
      S.f = (S.f + 1) % S.data.trajectory.length;
      S.last = ts;
      frame();
    }
    requestAnimationFrame(tick);
  }

  // ---- pointer orbit --------------------------------------------------------
  cv.addEventListener('pointerdown', (e) => { S.drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    if (!S.drag) return;
    S.yaw += (e.clientX - S.drag[0]) * 0.01;
    S.pitch = Math.max(-1.3, Math.min(1.3, S.pitch + (e.clientY - S.drag[1]) * 0.01));
    S.drag = [e.clientX, e.clientY];
    frame();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
    cv.addEventListener(ev, () => { S.drag = null; }));

  fetch('assets/data/geodex_hand.json').then((r) => r.json()).then((d) => {
    S.data = d;
    S.hand = new G.Hand(d.kinematics);
    S.q = new Float64Array(S.hand.n);
    $('gd-scrub').max = d.trajectory.length - 1;
    ['gd-cos', 'gd-rel', 'gd-smooth', 'gd-pos', 'gd-ghost'].forEach((id) =>
      $(id).addEventListener('change', () => { S.hist = []; frame(); }));
    $('gd-scrub').addEventListener('input', (e) => { S.f = +e.target.value; S.playing = false; $('gd-play').textContent = 'Play'; frame(); });
    $('gd-play').addEventListener('click', () => {
      S.playing = !S.playing;
      $('gd-play').textContent = S.playing ? 'Pause' : 'Play';
    });
    $('gd-reset').addEventListener('click', () => {
      ['gd-cos', 'gd-rel', 'gd-smooth'].forEach((id) => { $(id).checked = true; });
      $('gd-pos').checked = false;
      S.q = new Float64Array(S.hand.n); S.hist = []; frame();
    });
    $('gd-speed').addEventListener('input', () => { $('gd-speed-v').textContent = $('gd-speed').value + '×'; });
    window.addEventListener('resize', frame);
    frame();
    requestAnimationFrame(tick);
  }).catch((e) => { $('gd-out').textContent = 'Could not load the hand model: ' + e.message; });
})();

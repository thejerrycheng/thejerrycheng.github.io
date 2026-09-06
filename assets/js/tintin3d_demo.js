/* tintin3d_demo.js — the 3-D landing sandbox: fly it yourself, hand it to the
   3-D PD baseline, or hand it to the trained SAC policy at any stage of its
   training. Renders with a hand-rolled perspective projection (no library). */
(function () {
  'use strict';
  const T = window.TINTIN3D;
  const $ = (id) => document.getElementById(id);
  const cv = $('t3-canvas');
  if (!T || !cv) return;

  const SKIP = 5;                       // 100 Hz physics, 20 Hz control
  let MESH = null;                      // the real Tintin rocket, loaded async
  fetch('assets/data/tintin_rocket_mesh.json')
    .then((r) => r.json())
    .then((m) => {
      // face centroids and normals, precomputed once
      m.n = []; m.c = [];
      m.f.forEach((f) => {
        const a = m.v[f[0]], b = m.v[f[1]], c = m.v[f[2]];
        const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
        const w = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
        const n = [u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]];
        const L = Math.hypot(n[0], n[1], n[2]) || 1;
        m.n.push([n[0]/L, n[1]/L, n[2]/L]);
        m.c.push([(a[0]+b[0]+c[0])/3, (a[1]+b[1]+c[1])/3, (a[2]+b[2]+c[2])/3]);
      });
      MESH = m;
      if (!S.running) draw();
    })
    .catch(() => {});
  const S = {
    r: null, mode: 'pd', policy: null, policies: {}, running: false,
    yaw: 0.7, pitch: 0.30, dist: 1.15, drag: null, keys: {},
    throttle: 0.35, gy: 0, gp: 0, last: 0, acc: 0, raf: 0, bundle: null,
    held: null, holdN: 0, hist: []
  };

  // ------------------------------------------------------------------ camera
  /* The camera frames the pad and the vehicle together, pulling back and
     looking higher while the vehicle is high, so the whole descent stays on
     screen without the viewer having to chase it. */
  function project(p, w, h) {
    const alt = S.r ? Math.max(S.r.alt(), 0) : 150;
    const focus = Math.min(alt * 0.5, 110);
    const range = (240 + alt * 1.15) * S.dist;
    const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
    const cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
    const fx = p[0] * cy - p[1] * sy;
    const fy = p[0] * sy + p[1] * cy;
    const ex = fy + range * cp;
    const ey = fx;
    const ez = p[2] - focus - range * sp * 0.5;
    // choose the focal length so the pad and the vehicle's nose together fill
    // about 62 % of the canvas, whatever the altitude
    const span = alt + 140;
    const f = 0.62 * h * range / span;
    const d = Math.max(ex, 1);
    return [w / 2 + f * ey / d, h * 0.47 - f * ez / d, d];
  }

  function sizeCanvas() {
    const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(360, r.width * d); cv.height = Math.max(260, r.height * d);
    return d;
  }

  // ------------------------------------------------------------------- render
  function draw() {
    const dpr = sizeCanvas();
    const g = cv.getContext('2d'), w = cv.width, h = cv.height, r = S.r;
    const P = (p) => project(p, w, h);

    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#080B12'); sky.addColorStop(1, '#1B2231');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(244,234,210,0.5)';
    for (let i = 0; i < 90; i++) {
      g.fillRect(((i * 8461) % 1000) / 1000 * w, ((i * 3719) % 997) / 997 * h * 0.6, 1.5 * dpr, 1.5 * dpr);
    }

    // ground grid
    g.strokeStyle = 'rgba(244,234,210,0.16)'; g.lineWidth = 1 * dpr;
    const G = 200, step = 25;
    for (let i = -G; i <= G; i += step) {
      line(g, P([i, -G, 0]), P([i, G, 0]));
      line(g, P([-G, i, 0]), P([G, i, 0]));
    }
    // landing ring
    g.strokeStyle = '#FFCE0A'; g.lineWidth = 2.4 * dpr;
    ring(g, P, 10); g.strokeStyle = 'rgba(255,206,10,0.45)'; g.lineWidth = 1.6 * dpr; ring(g, P, 50);

    // Monte Carlo ghost bundle
    if (S.bundle) {
      g.lineWidth = 1 * dpr;
      S.bundle.forEach((b) => {
        g.strokeStyle = b.ok ? 'rgba(126,217,87,0.25)' : 'rgba(228,68,42,0.18)';
        g.beginPath();
        b.pts.forEach((p, i) => { const q = P(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
        g.stroke();
      });
    }

    // trail
    if (r.trail.length > 1) {
      g.strokeStyle = 'rgba(228,68,42,0.9)'; g.lineWidth = 2 * dpr; g.beginPath();
      r.trail.forEach((p, i) => { const q = P(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
      g.stroke();
    }

    // shadow
    g.fillStyle = 'rgba(0,0,0,0.35)';
    const sh = P([r.p[0], r.p[1], 0.4]);
    g.beginPath(); g.ellipse(sh[0], sh[1], 22 * dpr * (200 / Math.max(sh[2], 60)), 7 * dpr * (200 / Math.max(sh[2], 60)), 0, 0, 7); g.fill();

    drawRocket(g, P, r, dpr);
    drawHUD(g, r, dpr, w, h);
  }

  function line(g, a, b) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  function ring(g, P, rad) {
    g.beginPath();
    for (let i = 0; i <= 48; i++) {
      const t = i / 48 * Math.PI * 2, q = P([rad * Math.cos(t), rad * Math.sin(t), 0.2]);
      i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]);
    }
    g.stroke();
  }

  /* The real Tintin rocket: the MJCF's own mesh, decimated to ~3.8k faces and
     drawn with a painter's algorithm. Faces are shaded by their normal against
     a fixed light and painted with the rocket's red-and-white checker, so the
     roll of the vehicle is legible even at this size. */
  function drawRocket(g, P, r, dpr) {
    const R = T.qmat(r.q);
    const body = (v) => [r.p[0] + R[0]*v[0]+R[1]*v[1]+R[2]*v[2],
                         r.p[1] + R[3]*v[0]+R[4]*v[1]+R[5]*v[2],
                         r.p[2] + R[6]*v[0]+R[7]*v[1]+R[8]*v[2]];
    drawPlume(g, P, r, dpr, body);
    if (!MESH) { drawRocketFallback(g, P, r, dpr, body); return; }

    const LIGHT = [0.45, 0.35, 0.82];
    const order = [];
    for (let i = 0; i < MESH.f.length; i++) {
      const q = P(body(MESH.c[i]));
      order.push([q[2], i]);
    }
    order.sort((a, b) => b[0] - a[0]);          // far faces first

    g.lineJoin = 'round';
    for (let k = 0; k < order.length; k++) {
      const i = order[k][1], f = MESH.f[i];
      const a = P(body(MESH.v[f[0]])), b = P(body(MESH.v[f[1]])), c = P(body(MESH.v[f[2]]));
      // backface cull in screen space
      if ((b[0]-a[0]) * (c[1]-a[1]) - (b[1]-a[1]) * (c[0]-a[0]) <= 0) continue;

      const n = MESH.n[i];
      const nw = [R[0]*n[0]+R[1]*n[1]+R[2]*n[2],
                  R[3]*n[0]+R[4]*n[1]+R[5]*n[2],
                  R[6]*n[0]+R[7]*n[1]+R[8]*n[2]];
      const lam = Math.max(0.18, nw[0]*LIGHT[0] + nw[1]*LIGHT[1] + nw[2]*LIGHT[2]);

      // the rocket's checkerboard, in body coordinates
      const p = MESH.c[i];
      const zc = p[2], th = Math.atan2(p[1], p[0]);
      const checker = (Math.floor(zc / 11) + Math.floor((th + Math.PI) / (Math.PI / 3))) & 1;
      const white = checker && zc > 8 && zc < 78;
      const base = white ? [244, 234, 210] : [188, 40, 34];
      const sh = 0.32 + 0.68 * lam;
      g.fillStyle = `rgb(${base[0]*sh|0},${base[1]*sh|0},${base[2]*sh|0})`;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]);
      g.closePath(); g.fill();
    }
  }

  function drawRocketFallback(g, P, r, dpr, body) {
    const H = 100, W = 7;
    const nose = P(body([0, 0, H]));
    const base = [];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      base.push(P(body([W * Math.cos(a), W * Math.sin(a), 0])));
    }
    g.fillStyle = '#C7302A'; g.strokeStyle = '#F4EAD2'; g.lineWidth = 1.4 * dpr;
    g.beginPath();
    base.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
    g.closePath(); g.fill(); g.stroke();
    for (let i = 0; i < 8; i += 2) {
      g.beginPath(); g.moveTo(base[i][0], base[i][1]); g.lineTo(nose[0], nose[1]); g.stroke();
    }
  }

  function drawPlume(g, P, r, dpr, body) {
    const thr = r.thrust / r.maxThrust;
    if (thr <= 0.02) return;
    const cg = Math.cos(r.gp);
    const dir = [Math.sin(r.gp), -Math.sin(r.gy) * cg, Math.cos(r.gy) * cg];
    const a0 = P(body([0, 0, -2]));
    const len = 25 + 90 * thr;
    const a1 = P(body([-dir[0] * len, -dir[1] * len, -2 - dir[2] * len]));
    const grad = g.createLinearGradient(a0[0], a0[1], a1[0], a1[1]);
    grad.addColorStop(0, 'rgba(255,206,10,0.95)');
    grad.addColorStop(0.55, 'rgba(228,68,42,0.55)');
    grad.addColorStop(1, 'rgba(228,68,42,0)');
    g.strokeStyle = grad; g.lineWidth = (5 + 12 * thr) * dpr; g.lineCap = 'round';
    line(g, a0, a1);
  }

  const OUTCOME = {
    success: ['LANDED.', 'ok'], hard: ['HARD LANDING — outside the touchdown box.', 'bad'],
    drift: ['DRIFTED OUT — past 150 m.', 'bad'], overspeed: ['BROKE UP — past 100 m/s.', 'bad'],
    tumble: ['TUMBLED — past 120° of tilt.', 'bad'], timeout: ['RAN THE CLOCK OUT.', 'bad']
  };

  function drawHUD(g, r, dpr, w, h) {
    g.font = `${11 * dpr}px "Space Mono", monospace`;
    g.fillStyle = 'rgba(244,234,210,0.85)';
    g.fillText(`ALT ${r.alt().toFixed(0)} m   OFFSET ${r.lateral().toFixed(0)} m   ` +
               `SPEED ${r.speed().toFixed(1)} m/s   TILT ${r.tiltDeg().toFixed(0)}°`,
               12 * dpr, 20 * dpr);
    g.fillText(`THROTTLE ${(r.thrust / r.maxThrust * 100).toFixed(0)}%   ` +
               `PROP ${(r.fuel / r.startFuel * 100).toFixed(0)}%   T+${r.t.toFixed(1)} s`,
               12 * dpr, 36 * dpr);
  }

  // ------------------------------------------------------------------- control
  function opts() {
    return {
      altitude: +$('t3-alt').value, lateral: +$('t3-lat').value,
      velStd: +$('t3-vel').value, tiltDeg: +$('t3-tilt').value,
      randomize: +$('t3-dr').value > 0, drAmount: +$('t3-dr').value,
      rng: Math.random
    };
  }

  /* One row per control step: everything the plots need. */
  function sample() {
    const r = S.r;
    S.hist.push({
      t: r.t,
      alt: r.alt(),
      lat: r.lateral(),
      vz: r.v[2],
      speed: r.speed(),
      tilt: r.tiltDeg(),
      thr: r.thrust / r.maxThrust * 100,
      gim: Math.hypot(r.gy, r.gp) * 180 / Math.PI,
      prop: (r.p[2] !== undefined ? (r.fuel / r.startFuel) * 100 : 100)
    });
    if (S.hist.length > 1200) S.hist.shift();
  }

  const PLOTS = [
    { id: 't3-plot-alt', title: 'altitude and downrange  [m]',
      series: [['alt', '--hi', 'altitude'], ['lat', '--gold', 'downrange']] },
    { id: 't3-plot-vel', title: 'speed and descent rate  [m/s]',
      series: [['speed', '--hi', 'speed'], ['vz', '--ink', 'v_z']] },
    { id: 't3-plot-att', title: 'tilt and gimbal  [deg]',
      series: [['tilt', '--hi', 'tilt'], ['gim', '--gold', 'gimbal']] },
    { id: 't3-plot-thr', title: 'throttle and propellant  [%]',
      series: [['thr', '--hi', 'throttle'], ['prop', '--ink', 'propellant left']] }
  ];

  function css(n, f) {
    return (getComputedStyle(document.documentElement).getPropertyValue(n) || f).trim();
  }

  function drawPlots() {
    PLOTS.forEach((spec) => {
      const c = $(spec.id);
      if (!c) return;
      const dpr = sizeCanvas(c);
      const g = c.getContext('2d'), w = c.width, h = c.height;
      const ink = css('--ink', '#151820');
      g.clearRect(0, 0, w, h);
      g.fillStyle = css('--panel', '#FDF6E2'); g.fillRect(0, 0, w, h);
      const H = S.hist;
      const pad = 30 * dpr, padL = 44 * dpr;
      g.strokeStyle = ink; g.lineWidth = 1.2 * dpr; g.globalAlpha = .55;
      g.beginPath(); g.moveTo(padL, 8 * dpr); g.lineTo(padL, h - pad);
      g.lineTo(w - 8 * dpr, h - pad); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = ink; g.font = `${10.5 * dpr}px "Space Mono", monospace`;
      g.fillText(spec.title, padL + 4 * dpr, 15 * dpr);
      if (H.length < 2) return;

      let lo = Infinity, hi = -Infinity;
      spec.series.forEach(([k]) => H.forEach((r) => {
        lo = Math.min(lo, r[k]); hi = Math.max(hi, r[k]);
      }));
      if (hi - lo < 1e-6) { hi = lo + 1; }
      const m = (hi - lo) * 0.12; lo -= m; hi += m;
      const t0 = H[0].t, t1 = Math.max(H[H.length - 1].t, t0 + 1e-3);
      const X = (t) => padL + (t - t0) / (t1 - t0) * (w - padL - 10 * dpr);
      const Y = (v) => (h - pad) - (v - lo) / (hi - lo) * (h - pad - 20 * dpr);

      if (lo < 0 && hi > 0) {
        g.strokeStyle = ink; g.globalAlpha = .25; g.setLineDash([3 * dpr, 3 * dpr]);
        g.beginPath(); g.moveTo(padL, Y(0)); g.lineTo(w - 8 * dpr, Y(0)); g.stroke();
        g.setLineDash([]); g.globalAlpha = 1;
      }
      spec.series.forEach(([k, col]) => {
        g.strokeStyle = css(col, '#E4442A'); g.lineWidth = 1.8 * dpr;
        g.beginPath();
        H.forEach((r, i) => i ? g.lineTo(X(r.t), Y(r[k])) : g.moveTo(X(r.t), Y(r[k])));
        g.stroke();
      });
      // axis numbers and a legend
      g.fillStyle = ink; g.font = `${9.5 * dpr}px "Space Mono", monospace`;
      g.fillText(hi.toFixed(0), 4 * dpr, 22 * dpr);
      g.fillText(lo.toFixed(0), 4 * dpr, h - pad - 2 * dpr);
      g.fillText('t ' + t1.toFixed(1) + ' s', w - 62 * dpr, h - 10 * dpr);
      spec.series.forEach(([k, col, lab], i) => {
        g.fillStyle = css(col, '#E4442A');
        g.fillRect(padL + 4 * dpr + i * 108 * dpr, h - 20 * dpr, 12 * dpr, 3 * dpr);
        g.fillStyle = ink;
        g.fillText(lab, padL + 20 * dpr + i * 108 * dpr, h - 16 * dpr);
      });
    });
  }

  function reset() {
    S.r = new T.Lander();
    S.r.reset(opts());
    S.throttle = 0.35; S.gy = 0; S.gp = 0; S.held = null; S.holdN = 0;
    S.hist = [];
    const v = $('t3-verdict'); v.hidden = true; v.className = 'demo-result';
    sample();
    draw(); drawPlots(); status();
  }

  function status() {
    const r = S.r;
    $('t3-out').innerHTML =
      `pilot <b>${$('t3-mode').selectedOptions[0].text}</b><br>` +
      `vehicle <span class="dim">dry</span> <b>${(r.dryMass / 1e6).toFixed(2)}kt</b> ` +
      `<span class="dim">prop</span> <b>${(r.startFuel / 1e6).toFixed(2)}kt</b> ` +
      `<span class="dim">Isp</span> <b>${r.isp.toFixed(0)}s</b><br>` +
      `<span class="dim">max thrust</span> <b>${(r.maxThrust / 1e6).toFixed(1)} MN</b> ` +
      `<span class="dim">TWR</span> <b>${(r.maxThrust / (r.wetMass * 1.62)).toFixed(2)}</b><br>` +
      `<span class="dim">gimbal bias</span> <b>${(r.dr.biasY * 180 / Math.PI).toFixed(1)}°,${(r.dr.biasP * 180 / Math.PI).toFixed(1)}°</b> ` +
      `<span class="dim">gain</span> <b>${(r.dr.gimbalGain * 100).toFixed(0)}%</b>`;
  }

  function action() {
    const r = S.r;
    if (S.mode === 'pd') return T.pd3d(r);
    if (S.mode === 'rl') {
      if (!S.policy) return T.pd3d(r);
      return S.policy.act(r.obs());
    }
    const k = S.keys;
    if (k.up) S.throttle = Math.min(1, S.throttle + 0.02);
    else if (k.down) S.throttle = Math.max(0, S.throttle - 0.02);
    const rate = 0.09;
    if (k.left) S.gy = Math.max(-1, S.gy - rate); else if (k.right) S.gy = Math.min(1, S.gy + rate); else S.gy *= 0.85;
    if (k.fwd) S.gp = Math.min(1, S.gp + rate); else if (k.back) S.gp = Math.max(-1, S.gp - rate); else S.gp *= 0.85;
    return [S.throttle * 2 - 1, S.gy, S.gp];
  }

  function finish() {
    const r = S.r, o = OUTCOME[r.outcome] || ['done', ''];
    const v = $('t3-verdict');
    v.innerHTML = `<b>${o[0]}</b><br>offset ${r.lateral().toFixed(1)} m &nbsp; ` +
      `speed ${r.speed().toFixed(2)} m/s &nbsp; tilt ${r.tiltDeg().toFixed(1)}° &nbsp; ` +
      `propellant used ${((1 - r.fuel / r.startFuel) * 100).toFixed(1)}% &nbsp; T+${r.t.toFixed(1)} s`;
    v.className = 'demo-result ' + (r.outcome === 'success' ? 't3-ok' : 't3-bad');
    v.hidden = false;
    S.running = false; $('t3-go').textContent = 'Launch';
  }

  function tick(ts) {
    if (!S.running) return;
    S.acc += Math.min((ts - S.last) / 1000 || 0, 0.1) * (+$('t3-speed').value);
    S.last = ts;
    // Controllers and the policy act at 20 Hz while the model integrates at
    // 100 Hz, exactly as the MuJoCo environment does (FRAME_SKIP = 5).
    let n = 0;
    while (S.acc >= S.r.P.dt && n < 400) {
      if (S.holdN <= 0) { S.held = action(); S.holdN = SKIP; }
      S.r.step(S.held); S.holdN--; S.acc -= S.r.P.dt; n++;
      if (S.r.steps % 5 === 0) sample();
      if (S.r.done) break;
    }
    if (S.r.done) sample();
    draw();
    drawPlots();
    if (S.r.done) { finish(); return; }
    S.raf = requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------- Monte Carlo
  function runMC() {
    const btn = $('t3-mc'); btn.disabled = true; btn.textContent = 'flying 100…';
    setTimeout(() => {
      const n = 100, o = opts(), t0 = performance.now();
      const rng = T.mulberry32((Math.random() * 1e9) | 0);
      const modes = {}; let ok = 0; const bundle = [];
      const lat = [], sp = [];
      for (let i = 0; i < n; i++) {
        const r = new T.Lander();
        r.reset(Object.assign({}, o, { rng }));
        const pts = [r.p.slice()];
        let held = null;
        while (!r.done) {
          if (r.steps % SKIP === 0) {
            held = S.mode === 'rl' && S.policy ? S.policy.act(r.obs()) : T.pd3d(r);
          }
          r.step(held);
          if (r.steps % 20 === 0) pts.push(r.p.slice());
        }
        pts.push(r.p.slice());
        modes[r.outcome] = (modes[r.outcome] || 0) + 1;
        if (r.outcome === 'success') ok++;
        lat.push(r.lateral()); sp.push(r.speed());
        if (i < 60) bundle.push({ ok: r.outcome === 'success', pts });
      }
      S.bundle = bundle;
      const ms = performance.now() - t0;
      const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
      const rows = Object.entries(modes).sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td><td>${(v / n * 100).toFixed(0)}%</td></tr>`).join('');
      $('t3-mc-out').innerHTML =
        `<div class="t3-rate"><b>${(ok / n * 100).toFixed(0)}%</b> of ${n} descents land inside the box` +
        `<span class="dim"> · ${ms < 1 ? '<1' : ms.toFixed(0)} ms</span></div>` +
        `<table class="data-table compact"><thead><tr><th>outcome</th><th>runs</th><th>share</th></tr></thead>` +
        `<tbody>${rows}</tbody></table>` +
        `<p class="plot-note">Median touchdown offset <b>${med(lat).toFixed(1)} m</b>, median arrival speed <b>${med(sp).toFixed(2)} m/s</b>.</p>`;
      draw();
      btn.disabled = false; btn.textContent = 'Fly 100 more';
    }, 20);
  }

  // --------------------------------------------------------------- policies
  function loadPolicy(stage) {
    if (S.policies[stage]) { S.policy = S.policies[stage]; status(); return Promise.resolve(); }
    $('t3-policy-note').textContent = 'loading the network…';
    return fetch(`assets/data/tintin_policies/stage_${stage}.json`)
      .then((r) => { if (!r.ok) throw new Error('missing'); return r.json(); })
      .then((spec) => {
        S.policies[stage] = new T.Policy(spec);
        S.policy = S.policies[stage];
        $('t3-policy-note').textContent =
          `${spec.layers.map((l) => l.out).join(' → ')} MLP, ${spec.obs} inputs, trained for ${(+stage).toLocaleString()} environment steps.`;
        status();
      })
      .catch(() => { $('t3-policy-note').textContent = 'that checkpoint is not published.'; });
  }

  // ------------------------------------------------------------------ events
  const KEY = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
                w: 'fwd', s: 'back', a: 'left', d: 'right', W: 'fwd', S: 'back', A: 'left', D: 'right' };
  window.addEventListener('keydown', (e) => { if (S.mode === 'manual' && KEY[e.key]) { S.keys[KEY[e.key]] = true; e.preventDefault(); } });
  window.addEventListener('keyup', (e) => { if (KEY[e.key]) S.keys[KEY[e.key]] = false; });

  cv.addEventListener('pointerdown', (e) => { S.drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    if (!S.drag) return;
    S.yaw += (e.clientX - S.drag[0]) * 0.008;
    S.pitch = Math.max(-0.15, Math.min(1.1, S.pitch + (e.clientY - S.drag[1]) * 0.005));
    S.drag = [e.clientX, e.clientY];
    if (!S.running) draw();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => cv.addEventListener(ev, () => { S.drag = null; }));
  cv.addEventListener('wheel', (e) => {
    S.dist = Math.max(0.35, Math.min(2.5, S.dist * (1 + Math.sign(e.deltaY) * 0.1)));
    e.preventDefault(); if (!S.running) draw();
  }, { passive: false });

  $('t3-mode').addEventListener('change', (e) => {
    S.mode = e.target.value;
    $('t3-keys').hidden = S.mode !== 'manual';
    $('t3-stage-wrap').hidden = S.mode !== 'rl';
    if (S.mode === 'rl') loadPolicy($('t3-stage').value).then(reset); else reset();
  });
  $('t3-stage').addEventListener('change', (e) => loadPolicy(e.target.value).then(reset));
  ['t3-alt', 't3-lat', 't3-vel', 't3-tilt', 't3-dr'].forEach((id) => {
    const el = $(id), out = $(id + '-v');
    el.addEventListener('input', () => { if (out) out.textContent = el.value; if (!S.running) reset(); });
    if (out) out.textContent = el.value;
  });
  $('t3-speed').addEventListener('input', () => { $('t3-speed-v').textContent = $('t3-speed').value + '×'; });
  $('t3-go').addEventListener('click', () => {
    if (S.running) { S.running = false; $('t3-go').textContent = 'Launch'; return; }
    if (S.r.done) reset();
    S.running = true; S.last = performance.now(); S.acc = 0;
    $('t3-go').textContent = 'Pause';
    S.raf = requestAnimationFrame(tick);
  });
  $('t3-reset').addEventListener('click', () => { S.running = false; $('t3-go').textContent = 'Launch'; S.bundle = null; reset(); });
  $('t3-mc').addEventListener('click', runMC);
  window.addEventListener('resize', () => { draw(); drawPlots(); });

  reset();
})();

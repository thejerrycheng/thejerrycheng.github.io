/* tintin_demo.js — wires the RocketGym-planar model into the page:
   a lander you can fly, the report's PD autopilot, and a Monte Carlo you
   can re-run in the browser. */
(function () {
  'use strict';
  const T = window.TINTIN;
  if (!T) return;
  const $ = (id) => document.getElementById(id);

  const cv = $('tt-canvas');
  if (!cv) return;
  const hud = $('tt-hud'), verdict = $('tt-verdict');
  const mcCv = $('tt-mc-canvas'), mcOut = $('tt-mc-out'), mcBtn = $('tt-mc-run');

  const state = { rocket: null, mode: 'auto', keys: {}, running: false,
                  bundle: null, raf: 0, last: 0, acc: 0, throttle: 0, gimbal: 0 };

  function sizeCanvas(c) {
    const r = c.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(320, r.width * dpr); c.height = Math.max(220, r.height * dpr);
  }

  function params() {
    return { twr: +$('tt-twr').value, gMoon: +$('tt-grav').value };
  }
  function gains() { return { glide: +$('tt-glide').value }; }

  function reset() {
    state.rocket = new T.Rocket(params());
    state.rocket.reset({ x: +$('tt-x0').value, z: +$('tt-z0').value, vx: 0, vz: -5, th: 0 });
    state.throttle = 0; state.gimbal = 0;
    verdict.textContent = '';
    verdict.className = 'demo-result';
    verdict.hidden = true;
    draw();
  }

  function draw() {
    sizeCanvas(cv);
    T.drawScene(cv, state.rocket, { bundle: state.bundle });
    const r = state.rocket;
    const propLeft = (r.p.mWet - r.propUsed - r.d.mDry) / r.d.mProp * 100;
    hud.innerHTML =
      `alt <b>${(r.z - r.p.zTouch).toFixed(0)} m</b> &nbsp; downrange <b>${r.x.toFixed(0)} m</b><br>` +
      `speed <b>${Math.hypot(r.vx, r.vz).toFixed(1)} m/s</b> &nbsp; v<sub>z</sub> <b>${r.vz.toFixed(1)}</b><br>` +
      `tilt <b>${(r.th * 180 / Math.PI).toFixed(1)}°</b> &nbsp; throttle <b>${(r.lastT / r.d.Tmax * 100).toFixed(0)}%</b><br>` +
      `propellant <b>${Math.max(0, propLeft).toFixed(1)}%</b> &nbsp; t <b>${r.t.toFixed(1)} s</b><br>` +
      `<span class="dim">shaped return</span> <b>${r.reward.toFixed(0)}</b>`;
  }

  const OUTCOME = {
    success: ['LANDED.', 'ok'],
    tilt: ['TIPPED OVER — tilt past 15° at touchdown.', 'bad'],
    impact: ['CRATER — you hit faster than 20 m/s.', 'bad'],
    drift: ['MISSED THE PAD — outside the ±80 m box.', 'bad'],
    overspeed: ['BROKE UP — past 200 m/s.', 'bad'],
    timeout: ['RAN THE CLOCK OUT — 2000 steps.', 'bad']
  };

  function finish() {
    const r = state.rocket, o = OUTCOME[r.outcome] || ['done', ''];
    verdict.innerHTML = `<b>${o[0]}</b><br>` +
      `offset ${Math.abs(r.x).toFixed(1)} m &nbsp; tilt ${Math.abs(r.th * 180 / Math.PI).toFixed(1)}° &nbsp; ` +
      `|v<sub>z</sub>| ${Math.abs(r.vz).toFixed(1)} m/s &nbsp; propellant used ${(r.propUsed / r.d.mProp * 100).toFixed(1)}% &nbsp; ` +
      `return ${r.reward.toFixed(0)}`;
    verdict.className = 'demo-result ' + (r.outcome === 'success' ? 'tt-ok' : 'tt-bad');
    verdict.hidden = false;
    state.running = false;
    $('tt-go').textContent = 'Launch';
  }

  function tick(ts) {
    if (!state.running) return;
    const dtReal = Math.min((ts - state.last) / 1000 || 0, 0.1);
    state.last = ts;
    state.acc += dtReal * (+$('tt-speed').value);
    let n = 0;
    while (state.acc >= state.rocket.p.dt && n < 60) {
      let uT, uG;
      if (state.mode === 'auto') {
        const u = T.pid(state.rocket, gains()); uT = u[0]; uG = u[1];
      } else {
        // manual: keys nudge a held throttle and gimbal
        const k = state.keys;
        if (k.up) state.throttle = Math.min(1, state.throttle + 0.045);
        else if (k.down) state.throttle = Math.max(0, state.throttle - 0.045);
        if (k.left) state.gimbal = Math.max(-1, state.gimbal - 0.10);
        else if (k.right) state.gimbal = Math.min(1, state.gimbal + 0.10);
        else state.gimbal *= 0.88;
        uT = state.throttle * 2 - 1; uG = state.gimbal;
      }
      state.rocket.step(uT, uG);
      state.acc -= state.rocket.p.dt; n++;
      if (state.rocket.done) break;
    }
    draw();
    if (state.rocket.done) { finish(); return; }
    state.raf = requestAnimationFrame(tick);
  }

  function go() {
    if (state.running) { state.running = false; $('tt-go').textContent = 'Launch'; return; }
    if (state.rocket.done) reset();
    state.running = true; state.last = performance.now(); state.acc = 0;
    $('tt-go').textContent = 'Pause';
    state.raf = requestAnimationFrame(tick);
  }

  // ---- keyboard -------------------------------------------------------------
  const KEY = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
                w: 'up', s: 'down', a: 'left', d: 'right' };
  function key(e, on) {
    const k = KEY[e.key];
    if (!k) return;
    if (state.mode !== 'manual') return;
    state.keys[k] = on;
    e.preventDefault();
  }
  window.addEventListener('keydown', (e) => key(e, true));
  window.addEventListener('keyup', (e) => key(e, false));

  // ---- Monte Carlo ----------------------------------------------------------
  function runMC() {
    mcBtn.disabled = true; mcBtn.textContent = 'flying 200…';
    setTimeout(() => {
      const n = 200, seed = (Math.random() * 1e9) | 0;
      const t0 = performance.now();
      const res = T.monteCarlo(n, seed, params(), gains(), true);
      const ms = performance.now() - t0;
      state.bundle = res.bundle;
      const rate = res.success / n * 100;
      const rows = Object.entries(res.modes).sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td><td>${(v / n * 100).toFixed(1)}%</td></tr>`).join('');
      mcOut.innerHTML =
        `<div class="tt-rate"><b>${rate.toFixed(1)}%</b> of ${n} descents land inside the box` +
        `<span class="dim"> · ${ms < 1 ? '<1' : ms.toFixed(0)} ms in your browser · seed ${seed}</span></div>` +
        `<table class="data-table compact"><thead><tr><th>outcome</th><th>runs</th><th>share</th></tr></thead>` +
        `<tbody>${rows}</tbody></table>` +
        `<p class="plot-note">Successful touchdowns: median offset <b>${T.median(res.radius).toFixed(1)} m</b>, ` +
        `median tilt <b>${T.median(res.tilt).toFixed(1)}°</b>, median |v<sub>z</sub>| <b>${T.median(res.vz).toFixed(1)} m/s</b>, ` +
        `median propellant <b>${(T.median(res.prop) * 100).toFixed(1)}%</b> of the load.</p>`;
      drawMC(res);
      draw();
      mcBtn.disabled = false; mcBtn.textContent = 'Fly 200 more';
    }, 20);
  }

  function drawMC(res) {
    if (!mcCv) return;
    sizeCanvas(mcCv);
    const g = mcCv.getContext('2d'), w = mcCv.width, h = mcCv.height;
    g.clearRect(0, 0, w, h);
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--ink').trim() || '#151820';
    const pad = 34 * (window.devicePixelRatio > 1 ? 2 : 1);
    const X = (x) => pad + (x + 250) / 900 * (w - pad * 1.5);
    const Y = (z) => h - pad - z / 600 * (h - pad * 1.6);
    g.strokeStyle = ink; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(pad, h - pad); g.lineTo(w - pad * .5, h - pad);
    g.moveTo(pad, h - pad); g.lineTo(pad, pad * .6); g.stroke();
    g.fillStyle = 'rgba(217,161,63,0.25)';
    g.fillRect(X(-80), pad * .6, X(80) - X(-80), h - pad - pad * .6);
    res.bundle.forEach((b) => {
      g.strokeStyle = b.ok ? 'rgba(46,158,91,0.5)' : 'rgba(228,68,42,0.45)';
      g.lineWidth = 1; g.beginPath();
      b.pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])));
      g.stroke();
    });
    g.fillStyle = ink; g.font = `${11 * (window.devicePixelRatio > 1 ? 2 : 1)}px "Space Mono", monospace`;
    g.fillText('downrange x [m]', w / 2 - 40, h - 8);
    g.save(); g.translate(12, h / 2); g.rotate(-Math.PI / 2);
    g.fillText('altitude z [m]', -40, 0); g.restore();
  }

  // ---- bindings -------------------------------------------------------------
  ['tt-twr', 'tt-grav', 'tt-glide', 'tt-x0', 'tt-z0'].forEach((id) => {
    const el = $(id); if (!el) return;
    const out = $(id + '-v');
    const sync = () => { if (out) out.textContent = el.value; };
    el.addEventListener('input', () => { sync(); if (!state.running) reset(); });
    sync();
  });
  $('tt-speed').addEventListener('input', () => { $('tt-speed-v').textContent = $('tt-speed').value + '×'; });
  $('tt-mode').addEventListener('change', (e) => {
    state.mode = e.target.value;
    $('tt-keys').hidden = state.mode !== 'manual';
    reset();
  });
  $('tt-go').addEventListener('click', go);
  $('tt-reset').addEventListener('click', () => { state.running = false; $('tt-go').textContent = 'Launch'; reset(); });
  if (mcBtn) mcBtn.addEventListener('click', runMC);
  window.addEventListener('resize', () => { draw(); if (state.bundle) drawMC({ bundle: state.bundle }); });

  reset();
})();

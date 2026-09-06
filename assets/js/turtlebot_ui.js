/* turtlebot_ui.js — watch the map get built, and race the four strategies. */
(function () {
  'use strict';
  const T = window.TURTLEBOT;
  const $ = (id) => document.getElementById(id);
  const cv = $('tb-canvas');
  if (!T || !cv) return;

  const S = { room: null, rb: null, strategy: 'hybrid', running: false,
              raf: 0, hist: [], last: 0, acc: 0 };
  const css = (n, f) => (getComputedStyle(document.documentElement).getPropertyValue(n) || f).trim();

  function sizeCanvas(c) {
    const r = c.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(280, r.width * d); c.height = Math.max(200, r.height * d);
    return d;
  }

  function build() {
    S.room = T.makeRoom(+$('tb-seed').value, +$('tb-obst').value);
    S.rb = new T.Robot(S.room, +$('tb-seed').value);
    S.hist = [];
    draw(); plot(); status();
  }

  function draw() {
    const dpr = sizeCanvas(cv);
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    const N = T.N;
    const s = Math.min(w, h) / N;
    const ox = (w - N * s) / 2, oy = (h - N * s) / 2;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#20252F'; g.fillRect(0, 0, w, h);

    const img = g.createImageData(N, N);
    const showTruth = $('tb-truth').checked;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const k = i * N + j, m = S.rb.map[k];
        let c;
        if (m === T.OCC) c = [228, 68, 42];
        else if (m === T.FREE) c = [244, 234, 210];
        else c = showTruth && S.room[k] ? [70, 60, 58] : [42, 47, 58];
        // image data is row-major in y, so transpose
        const idx = ((N - 1 - j) * N + i) * 4;
        img.data[idx] = c[0]; img.data[idx+1] = c[1]; img.data[idx+2] = c[2]; img.data[idx+3] = 255;
      }
    }
    const off = document.createElement('canvas');
    off.width = off.height = N;
    off.getContext('2d').putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(off, ox, oy, N * s, N * s);

    const X = (p) => ox + p[0] / T.RES * s;
    const Y = (p) => oy + (N - p[1] / T.RES) * s;

    // trail
    if (S.rb.trail.length > 1) {
      g.strokeStyle = 'rgba(46,158,91,0.75)'; g.lineWidth = 1.6 * dpr;
      g.beginPath();
      S.rb.trail.forEach((p, i) => i ? g.lineTo(X(p), Y(p)) : g.moveTo(X(p), Y(p)));
      g.stroke();
    }
    // planned path, when frontier is driving
    if (S.rb.path && S.rb.path.length) {
      g.strokeStyle = 'rgba(255,206,10,0.85)'; g.lineWidth = 1.6 * dpr;
      g.setLineDash([4 * dpr, 3 * dpr]);
      g.beginPath();
      g.moveTo(X(S.rb.p), Y(S.rb.p));
      S.rb.path.forEach((c) => g.lineTo(ox + c[0] * s, oy + (N - c[1]) * s));
      g.stroke(); g.setLineDash([]);
    }
    // the Kinect cone
    const fov = 57 * Math.PI / 180;
    g.fillStyle = 'rgba(255,206,10,0.13)';
    g.beginPath(); g.moveTo(X(S.rb.p), Y(S.rb.p));
    for (let a = -fov / 2; a <= fov / 2 + 1e-6; a += fov / 12) {
      const th = S.rb.th + a;
      g.lineTo(X([S.rb.p[0] + 4 * Math.cos(th), S.rb.p[1] + 4 * Math.sin(th)]),
               Y([S.rb.p[0] + 4 * Math.cos(th), S.rb.p[1] + 4 * Math.sin(th)]));
    }
    g.closePath(); g.fill();
    // the robot
    g.fillStyle = '#151820'; g.strokeStyle = '#FFCE0A'; g.lineWidth = 2 * dpr;
    g.beginPath(); g.arc(X(S.rb.p), Y(S.rb.p), 5 * dpr, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(X(S.rb.p), Y(S.rb.p));
    g.lineTo(X([S.rb.p[0] + 0.28 * Math.cos(S.rb.th), S.rb.p[1] + 0.28 * Math.sin(S.rb.th)]),
             Y([S.rb.p[0] + 0.28 * Math.cos(S.rb.th), S.rb.p[1] + 0.28 * Math.sin(S.rb.th)]));
    g.stroke();
  }

  function plot() {
    const c = $('tb-plot');
    const dpr = sizeCanvas(c), g = c.getContext('2d'), w = c.width, h = c.height;
    const ink = css('--ink', '#151820');
    g.clearRect(0, 0, w, h);
    g.fillStyle = css('--panel', '#FDF6E2'); g.fillRect(0, 0, w, h);
    const pad = 32 * dpr;
    g.strokeStyle = ink; g.lineWidth = 1.2 * dpr; g.globalAlpha = .6;
    g.beginPath(); g.moveTo(pad, 8 * dpr); g.lineTo(pad, h - pad); g.lineTo(w - 8 * dpr, h - pad);
    g.stroke(); g.globalAlpha = 1;
    g.fillStyle = ink; g.font = `${10 * dpr}px "Space Mono", monospace`;
    g.fillText('floor mapped [%]', pad + 4 * dpr, 16 * dpr);
    g.fillText('100', 4 * dpr, 16 * dpr); g.fillText('0', 12 * dpr, h - pad + 2 * dpr);
    if (S.hist.length < 2) return;
    const tmax = Math.max(S.hist[S.hist.length - 1][0], 30);
    const X = (t) => pad + t / tmax * (w - pad - 10 * dpr);
    const Y = (v) => (h - pad) - v * (h - pad - 18 * dpr);
    g.strokeStyle = css('--hi', '#E4442A'); g.lineWidth = 2 * dpr;
    g.beginPath();
    S.hist.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])));
    g.stroke();
    g.fillStyle = ink;
    g.fillText(`t ${tmax.toFixed(0)} s`, w - 56 * dpr, h - 10 * dpr);
  }

  function status() {
    $('tb-out').innerHTML =
      `strategy <b>${S.strategy}</b><br>` +
      `mapped <b>${(S.rb.coverage() * 100).toFixed(1)} %</b> of the reachable floor<br>` +
      `t <b>${S.rb.t.toFixed(0)} s</b> &nbsp; contacts <b>${S.rb.bumps}</b>` +
      (S.rb.path && S.rb.path.length ? '<br><span class="tb-plan">following a planned path</span>' : '');
  }

  function tick(ts) {
    if (!S.running) return;
    S.acc += Math.min((ts - S.last) / 1000 || 0, 0.1) * (+$('tb-speed').value);
    S.last = ts;
    let n = 0;
    while (S.acc >= 0.1 && n < 60) { S.rb.step(S.strategy); S.acc -= 0.1; n++; }
    if (n) {
      S.hist.push([S.rb.t, S.rb.coverage()]);
      draw(); plot(); status();
    }
    if (S.rb.t > 600) { S.running = false; $('tb-go').textContent = 'Run'; return; }
    S.raf = requestAnimationFrame(tick);
  }

  function race() {
    const btn = $('tb-race');
    btn.disabled = true; btn.textContent = 'racing…';
    setTimeout(() => {
      const rows = [];
      for (const s of T.STRATEGIES) {
        const rb = new T.Robot(S.room, +$('tb-seed').value);
        for (let k = 0; k < 3000; k++) rb.step(s);
        rows.push([s, rb.coverage() * 100, rb.bumps]);
      }
      rows.sort((a, b) => b[1] - a[1]);
      $('tb-race-out').innerHTML =
        '<table class="data-table compact"><thead><tr><th>strategy</th><th>mapped in 300 s</th><th>contacts</th></tr></thead><tbody>' +
        rows.map(([s, c, b], i) =>
          `<tr><td>${i === 0 ? '<b>' + s + '</b>' : s}</td><td class="${i === 0 ? 'ok' : ''}">${c.toFixed(1)} %</td><td>${b}</td></tr>`).join('') +
        '</tbody></table>';
      btn.disabled = false; btn.textContent = 'Race again';
    }, 20);
  }

  $('tb-mode').addEventListener('change', (e) => { S.strategy = e.target.value; build(); });
  ['tb-seed', 'tb-obst'].forEach((id) => {
    const el = $(id), out = $(id + '-v');
    el.addEventListener('input', () => { if (out) out.textContent = el.value; });
    el.addEventListener('change', build);
  });
  $('tb-truth').addEventListener('change', draw);
  $('tb-speed').addEventListener('input', () => { $('tb-speed-v').textContent = $('tb-speed').value + '×'; });
  $('tb-go').addEventListener('click', () => {
    S.running = !S.running;
    $('tb-go').textContent = S.running ? 'Pause' : 'Run';
    if (S.running) { S.last = performance.now(); S.acc = 0; S.raf = requestAnimationFrame(tick); }
  });
  $('tb-reset').addEventListener('click', () => { S.running = false; $('tb-go').textContent = 'Run'; build(); });
  $('tb-race').addEventListener('click', race);
  window.addEventListener('resize', () => { draw(); plot(); });
  ['tb-seed-v', 'tb-obst-v'].forEach((id) => { const e = $(id); if (e) e.textContent = $(id.replace('-v', '')).value; });
  $('tb-speed-v').textContent = $('tb-speed').value + '×';
  build();
})();

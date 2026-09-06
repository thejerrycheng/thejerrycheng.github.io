/* ledcube_ui.js — the 8×8×8 cube: animations, 3-D Snake, and a refresh-rate
   slider that takes persistence of vision away from you. */
(function () {
  'use strict';
  const L = window.LEDCUBE;
  const $ = (id) => document.getElementById(id);
  const cv = $('lb-canvas');
  if (!L || !cv) return;

  const N = L.N;
  const S = { cube: new L.Cube(), snake: new L.Snake(), mode: 'wave',
              yaw: -0.75, pitch: 0.42, drag: null, st: {}, t0: 0,
              acc: 0, last: 0, raf: 0, mux: 0, lit: null, tick: 0 };

  // Persistence of vision: how long a lit LED still reads as lit, in seconds.
  const POV = 0.055;

  function sizeCanvas() {
    const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(320, r.width * d); cv.height = Math.max(260, r.height * d);
    return d;
  }
  const css = (n, f) => (getComputedStyle(document.documentElement).getPropertyValue(n) || f).trim();

  function project(p, w, h) {
    const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
    const cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
    const x = p[0] - 3.5, y = p[1] - 3.5, z = p[2] - 3.5;
    const a = x * cy - y * sy, b = x * sy + y * cy;
    const u = a, v = z * cp - b * sp, d = b * cp + z * sp + 22;
    const f = Math.min(w, h) * 0.95;
    return [w / 2 + f * u / d, h / 2 - f * v / d, d];
  }

  function draw() {
    const dpr = sizeCanvas();
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0C1018'); grad.addColorStop(1, '#171E2B');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);

    // the frame the LEDs are soldered into
    g.strokeStyle = 'rgba(244,234,210,0.13)'; g.lineWidth = 1 * dpr;
    const corners = [[0,0,0],[7,0,0],[7,7,0],[0,7,0],[0,0,7],[7,0,7],[7,7,7],[0,7,7]];
    const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    edges.forEach(([a, b]) => {
      const p = project(corners[a], w, h), q = project(corners[b], w, h);
      g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
    });

    // every LED, depth sorted, with brightness from how recently it was lit
    const pts = [];
    for (let z = 0; z < N; z++) {
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const q = project([x, y, z], w, h);
          pts.push([q, x, y, z]);
        }
      }
    }
    pts.sort((a, b) => b[0][2] - a[0][2]);
    const now = S.tick;
    pts.forEach(([q, x, y, z]) => {
      const i = (z * N + y) * N + x;
      const on = S.cube.buf[i];
      const seen = S.lit[i];
      const age = now - seen;
      // an LED reads as lit if the eye saw it within POV seconds
      const bright = seen > 0 ? Math.max(0, 1 - age / POV) : 0;
      const r = Math.max(1.2, 130 / q[2]) * dpr;
      if (bright > 0.02) {
        g.globalAlpha = Math.min(1, bright);
        const gl = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], r * 3.2);
        gl.addColorStop(0, 'rgba(255,120,60,0.95)');
        gl.addColorStop(0.35, 'rgba(228,68,42,0.55)');
        gl.addColorStop(1, 'rgba(228,68,42,0)');
        g.fillStyle = gl;
        g.beginPath(); g.arc(q[0], q[1], r * 3.2, 0, 7); g.fill();
        g.fillStyle = '#FFE3B0';
        g.beginPath(); g.arc(q[0], q[1], r * 0.85, 0, 7); g.fill();
        g.globalAlpha = 1;
      } else {
        g.fillStyle = 'rgba(244,234,210,0.10)';
        g.beginPath(); g.arc(q[0], q[1], r * 0.5, 0, 7); g.fill();
      }
      if (on && z === S.cube.layer) {
        // the layer the multiplexer is driving right now
        g.strokeStyle = 'rgba(255,206,10,0.5)'; g.lineWidth = 1 * dpr;
        g.beginPath(); g.arc(q[0], q[1], r * 1.9, 0, 7); g.stroke();
      }
    });

    g.fillStyle = css('--bone', '#F4EAD2');
    g.font = `${11 * dpr}px "Space Mono", monospace`;
    g.globalAlpha = .8;
    g.fillText(`layer ${S.cube.layer + 1}/8 lit · ${(+$('lb-refresh').value)} Hz refresh`,
               12 * dpr, 20 * dpr);
    if (S.mode === 'snake') {
      g.fillText(S.snake.dead ? 'crashed — press Reset' : `length ${S.snake.body.length}  score ${S.snake.score}`,
                 12 * dpr, 36 * dpr);
    }
    g.globalAlpha = 1;
  }

  function frameContent(t) {
    if (S.mode === 'snake') {
      S.snake.render(S.cube, Math.floor(t * 4) % 2 === 0);
    } else {
      L.ANIM[S.mode](S.cube, t, S.st);
    }
  }

  function loop(ts) {
    const dt = Math.min((ts - S.last) / 1000 || 0, 0.1);
    S.last = ts;
    S.tick += dt;

    // content updates at its own rate
    S.acc += dt;
    const contentHz = S.mode === 'snake' ? (+$('lb-speed').value) : 30;
    if (S.acc > 1 / contentHz) {
      S.acc = 0;
      if (S.mode === 'snake') S.snake.step();
      frameContent(S.tick);
    }
    if (S.mode !== 'snake') frameContent(S.tick);

    // the multiplexer: one layer at a time, at the chosen refresh rate
    const hz = +$('lb-refresh').value;
    S.mux += dt * hz * N;
    while (S.mux >= 1) {
      S.mux -= 1;
      S.cube.tickLayer();
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const i = (S.cube.layer * N + y) * N + x;
          if (S.cube.buf[i]) S.lit[i] = S.tick;
        }
      }
    }
    draw();
    S.raf = requestAnimationFrame(loop);
  }

  const KEY = { ArrowLeft: [-1,0,0], ArrowRight: [1,0,0],
                ArrowUp: [0,1,0], ArrowDown: [0,-1,0],
                w: [0,0,1], s: [0,0,-1], W: [0,0,1], S: [0,0,-1] };
  window.addEventListener('keydown', (e) => {
    if (S.mode !== 'snake' || !KEY[e.key]) return;
    S.snake.steer(KEY[e.key]); e.preventDefault();
  });

  cv.addEventListener('pointerdown', (e) => { S.drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    if (!S.drag) return;
    S.yaw += (e.clientX - S.drag[0]) * 0.01;
    S.pitch = Math.max(-1.1, Math.min(1.1, S.pitch + (e.clientY - S.drag[1]) * 0.008));
    S.drag = [e.clientX, e.clientY];
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => cv.addEventListener(ev, () => { S.drag = null; }));

  $('lb-mode').addEventListener('change', (e) => {
    S.mode = e.target.value; S.st = {}; S.snake.reset();
    $('lb-keys').hidden = S.mode !== 'snake';
    $('lb-speed-wrap').hidden = S.mode !== 'snake';
  });
  $('lb-refresh').addEventListener('input', () => {
    $('lb-refresh-v').textContent = $('lb-refresh').value;
  });
  $('lb-speed').addEventListener('input', () => { $('lb-speed-v').textContent = $('lb-speed').value; });
  $('lb-reset').addEventListener('click', () => { S.snake.reset(); S.st = {}; });

  S.lit = new Float64Array(N * N * N);
  $('lb-refresh-v').textContent = $('lb-refresh').value;
  $('lb-speed-v').textContent = $('lb-speed').value;
  S.last = performance.now();
  S.raf = requestAnimationFrame(loop);
})();

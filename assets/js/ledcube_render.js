/* ledcube_render.js — the shared cube renderer and the comic FX layer.
   Used by both the animations page and the games page. */
(function () {
  'use strict';
  const L = window.LEDCUBE;
  const N = L.N;
  const POV = 0.055;               // seconds an LED still reads as lit

  const css = (n, f) => (getComputedStyle(document.documentElement).getPropertyValue(n) || f).trim();

  function sizeCanvas(c) {
    const r = c.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(300, r.width * d); c.height = Math.max(240, r.height * d);
    return d;
  }

  function project(p, w, h, view) {
    const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw);
    const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
    const x = p[0] - 3.5, y = p[1] - 3.5, z = p[2] - 3.5;
    const a = x * cy - y * sy, b = x * sy + y * cy;
    const u = a, v = z * cp - b * sp, d = b * cp + z * sp + 22;
    const f = Math.min(w, h) * 0.95;
    return [w / 2 + f * u / d, h / 2 - f * v / d, d];
  }

  /** Draw the cube: frame, then every LED depth-sorted, glowing for as long
      as the eye would hold it. `lit[i]` is the time each LED was last driven. */
  function drawCube(cv, cube, lit, now, view, opts) {
    const o = opts || {};
    const dpr = sizeCanvas(cv);
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0C1018'); grad.addColorStop(1, '#171E2B');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const P = (p) => project(p, w, h, view);

    g.strokeStyle = 'rgba(244,234,210,0.13)'; g.lineWidth = 1 * dpr;
    const C = [[0,0,0],[7,0,0],[7,7,0],[0,7,0],[0,0,7],[7,0,7],[7,7,7],[0,7,7]];
    [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(([a, b]) => {
      const p = P(C[a]), q = P(C[b]);
      g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
    });

    const pts = [];
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      pts.push([P([x, y, z]), x, y, z]);
    }
    pts.sort((a, b) => b[0][2] - a[0][2]);
    const hue = o.hue || [255, 120, 60];
    pts.forEach(([q, x, y, z]) => {
      const i = (z * N + y) * N + x;
      const seen = lit[i];
      const bright = seen > 0 ? Math.max(0, 1 - (now - seen) / POV) : 0;
      const r = Math.max(1.2, 130 / q[2]) * dpr;
      if (bright > 0.02) {
        g.globalAlpha = Math.min(1, bright);
        const gl = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], r * 3.2);
        gl.addColorStop(0, `rgba(${hue[0]},${hue[1]},${hue[2]},0.95)`);
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
      if (o.ring && cube.buf[i] && z === cube.layer) {
        g.strokeStyle = 'rgba(255,206,10,0.5)'; g.lineWidth = 1 * dpr;
        g.beginPath(); g.arc(q[0], q[1], r * 1.9, 0, 7); g.stroke();
      }
    });
    return { g, dpr, w, h };
  }

  /** Run the multiplexer for `dt` seconds at `hz`, marking LEDs as seen. */
  function multiplex(cube, lit, now, dt, hz, state) {
    state.mux += dt * hz * N;
    while (state.mux >= 1) {
      state.mux -= 1;
      cube.tickLayer();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = (cube.layer * N + y) * N + x;
        if (cube.buf[i]) lit[i] = now;
      }
    }
  }

  /* ── comic FX: onomatopoeia flung over the cube, the way the MABEL pop-ups
     do it. Pure DOM so it inherits the site's Bangers face and colours. */
  const EAT = ['YUM!', 'NOM!', 'CHOMP!', 'MUNCH!', 'GULP!', 'TASTY!', 'SNACK!'];
  const DIE = ['OOF!', 'SPLAT!', 'CRUNCH!', 'OUCH!', 'BONK!', 'WIPEOUT!'];
  const WIN = ['NICE!', 'BOOM!', 'POW!', 'ZING!', 'SMASH!'];
  const LOSE = ['DRAT!', 'MISS!', 'NUTS!', 'ARGH!'];

  function fx(host, text, kind) {
    if (!host) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = document.createElement('span');
    el.className = 'cube-fx cube-fx-' + (kind || 'eat');
    el.textContent = text;
    const a = Math.random() * Math.PI * 2;
    el.style.left = (38 + Math.random() * 24) + '%';
    el.style.top = (30 + Math.random() * 30) + '%';
    el.style.setProperty('--dx', (Math.cos(a) * 60).toFixed(0) + 'px');
    el.style.setProperty('--dy', (Math.sin(a) * 60 - 30).toFixed(0) + 'px');
    el.style.setProperty('--rot', ((Math.random() * 24) - 12).toFixed(1) + 'deg');
    host.appendChild(el);
    setTimeout(() => el.remove(), reduce ? 500 : 1150);
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  window.CUBEVIEW = { drawCube, multiplex, sizeCanvas, project, css, fx, pick,
                      EAT, DIE, WIN, LOSE, POV };
})();

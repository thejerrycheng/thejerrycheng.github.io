/* ledcube_games.js — the console: 3-D Snake and 3-D Pong against the machine,
   with scoreboards and the comic FX the cube deserves. */
(function () {
  'use strict';
  const L = window.LEDCUBE, V = window.CUBEVIEW;
  const $ = (id) => document.getElementById(id);
  const cv = $('gm-canvas');
  if (!L || !V || !cv) return;

  const N = L.N;
  const KEY = 'ledcube.scores.v1';
  const S = { cube: new L.Cube(), lit: new Float64Array(N * N * N),
              view: { yaw: -0.75, pitch: 0.42 }, drag: null,
              game: 'snake', snake: new L.Snake(), pong: new L.Pong(),
              t: 0, mux: 0, last: 0, acc: 0, running: false, count: 0,
              best: { snake: 0, pongWin: 0, pongPlayed: 0, pongBest: 0 } };

  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(S.best, JSON.parse(raw));
  } catch (e) { /* private window: scores just do not persist */ }
  function saveBest() {
    try { localStorage.setItem(KEY, JSON.stringify(S.best)); } catch (e) {}
  }

  // ---- switching games ------------------------------------------------------
  function select(g) {
    S.game = g;
    document.querySelectorAll('.gm-pick').forEach((b) =>
      b.classList.toggle('btn-primary', b.dataset.game === g));
    $('gm-snake-keys').hidden = g !== 'snake';
    $('gm-pong-keys').hidden = g !== 'pong';
    $('gm-skill-wrap').hidden = g !== 'pong';
    $('gm-speed-wrap').hidden = g !== 'snake';
    $('gm-title').textContent = g === 'snake' ? '3-D Snake' : '3-D Pong — you vs the machine';
    restart();
  }
  document.querySelectorAll('.gm-pick').forEach((b) =>
    b.addEventListener('click', () => select(b.dataset.game)));

  function restart() {
    if (S.game === 'snake') S.snake.reset(); else S.pong.reset(true);
    S.count = 3.0;                      // the console counts you in
    S.running = true;
    $('gm-go').textContent = 'Pause';
    board();
  }
  $('gm-restart').addEventListener('click', restart);
  $('gm-go').addEventListener('click', () => {
    S.running = !S.running;
    $('gm-go').textContent = S.running ? 'Pause' : 'Play';
    if (S.running) S.last = performance.now();
  });

  // ---- input ----------------------------------------------------------------
  const SNAKE_KEYS = { ArrowLeft: [-1,0,0], ArrowRight: [1,0,0],
                       ArrowUp: [0,1,0], ArrowDown: [0,-1,0],
                       w: [0,0,1], s: [0,0,-1], W: [0,0,1], S: [0,0,-1] };
  const held = {};
  window.addEventListener('keydown', (e) => {
    if (S.game === 'snake' && SNAKE_KEYS[e.key]) { S.snake.steer(SNAKE_KEYS[e.key]); e.preventDefault(); }
    if (S.game === 'pong') { held[e.key] = true; if (e.key.startsWith('Arrow') || 'wsWS'.includes(e.key)) e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { held[e.key] = false; });

  cv.addEventListener('pointerdown', (e) => { S.drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    if (!S.drag) return;
    S.view.yaw += (e.clientX - S.drag[0]) * 0.01;
    S.view.pitch = Math.max(-1.15, Math.min(1.15, S.view.pitch + (e.clientY - S.drag[1]) * 0.008));
    S.drag = [e.clientX, e.clientY];
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
    cv.addEventListener(ev, () => { S.drag = null; }));

  // ---- scoreboard -----------------------------------------------------------
  function board() {
    if (S.game === 'snake') {
      const s = S.snake;
      $('gm-board').innerHTML =
        `<div class="gm-score"><span class="gm-k">Length</span><b>${s.body.length}</b></div>` +
        `<div class="gm-score"><span class="gm-k">Eaten</span><b>${s.score}</b></div>` +
        `<div class="gm-score gm-best"><span class="gm-k">Best</span><b>${S.best.snake}</b></div>`;
    } else {
      const p = S.pong;
      const played = S.best.pongPlayed || 0;
      $('gm-board').innerHTML =
        `<div class="gm-score"><span class="gm-k">You</span><b>${p.human}</b></div>` +
        `<div class="gm-score gm-vs"><span class="gm-k">Machine</span><b>${p.robot}</b></div>` +
        `<div class="gm-score gm-best"><span class="gm-k">Rallies won</span><b>${S.best.pongWin}/${played}</b></div>`;
    }
  }

  // ---- the loop -------------------------------------------------------------
  function loop(ts) {
    const dt = Math.max(0, Math.min((ts - S.last) / 1000 || 0, 0.1));
    S.last = ts;
    S.t += dt;

    if (S.running && S.count > 0) {
      S.count -= dt;
      const n = Math.ceil(S.count);
      S.cube.clear();
      if (n > 0) L.glyph(S.cube, String(Math.min(3, n)), 3, 0);
      else L.glyph(S.cube, 'O', 3, 0);
      if (S.count <= 0) V.fx($('gm-fx'), 'GO!', 'win');
    } else if (S.running) {
      if (S.game === 'snake') {
        S.acc += dt;
        const hz = +$('gm-speed').value;
        while (S.acc > 1 / hz) {
          S.acc -= 1 / hz;
          const wasDead = S.snake.dead;
          S.snake.step();
          if (S.snake.ate) V.fx($('gm-fx'), V.pick(V.EAT), 'eat');
          if (S.snake.dead && !wasDead) {
            V.fx($('gm-fx'), V.pick(V.DIE), 'die');
            if (S.snake.score > S.best.snake) { S.best.snake = S.snake.score; saveBest(); V.fx($('gm-fx'), 'NEW BEST!', 'win'); }
            S.running = false; $('gm-go').textContent = 'Play';
          }
          board();
        }
        S.snake.render(S.cube, Math.floor(S.t * 4) % 2 === 0);
      } else {
        const step = 10 * dt;          // cells/s — faster than the machine at every skill
        let dx = 0, dz = 0;
        if (held.ArrowLeft) dx -= step; if (held.ArrowRight) dx += step;
        if (held.w || held.W) dz += step; if (held.s || held.S) dz -= step;
        if (held.ArrowUp) dz += step; if (held.ArrowDown) dz -= step;
        if (dx || dz) S.pong.movePad(dx, dz);
        S.pong.step(dt, +$('gm-skill').value);
        const e = S.pong.event;
        if (e === 'human') {
          V.fx($('gm-fx'), V.pick(V.WIN), 'win');
          S.best.pongWin++; S.best.pongPlayed++; saveBest(); board();
        } else if (e === 'robot') {
          V.fx($('gm-fx'), V.pick(V.LOSE), 'die');
          S.best.pongPlayed++; saveBest(); board();
        } else if (e === 'save') {
          V.fx($('gm-fx'), 'BONK!', 'eat');
        }
        S.pong.render(S.cube);
        board();
      }
    }

    V.multiplex(S.cube, S.lit, S.t, dt, +$('gm-refresh').value, S);
    V.drawCube(cv, S.cube, S.lit, S.t, S.view, {});

    const g = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    g.fillStyle = 'rgba(244,234,210,0.8)';
    g.font = `${11 * dpr}px "Space Mono", monospace`;
    if (S.count > 0 && S.running) g.fillText('get ready…', 12 * dpr, 20 * dpr);
    else if (!S.running) g.fillText(S.game === 'snake' && S.snake.dead ? 'crashed into yourself — press Restart' : 'paused', 12 * dpr, 20 * dpr);
    else g.fillText(S.game === 'snake' ? 'walls wrap — run off one face, come back on the other'
                                       : 'block the ball · the machine is thinking too', 12 * dpr, 20 * dpr);
    requestAnimationFrame(loop);
  }

  $('gm-speed').addEventListener('input', () => { $('gm-speed-v').textContent = $('gm-speed').value; });
  $('gm-skill').addEventListener('input', () => {
    $('gm-skill-v').textContent = ['sleepy', 'easy', 'fair', 'sharp', 'ruthless'][Math.round(+$('gm-skill').value * 4)];
  });
  $('gm-refresh').addEventListener('input', () => { $('gm-refresh-v').textContent = $('gm-refresh').value; });
  $('gm-clear').addEventListener('click', () => {
    S.best = { snake: 0, pongWin: 0, pongPlayed: 0, pongBest: 0 }; saveBest(); board();
  });
  $('gm-speed-v').textContent = $('gm-speed').value;
  $('gm-refresh-v').textContent = $('gm-refresh').value;
  $('gm-skill-v').textContent = 'fair';

  select('snake');
  S.last = performance.now();
  requestAnimationFrame(loop);
})();

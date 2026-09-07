/* maze444_ui.js — drive the maze robot and watch the candidate set collapse. */
(function () {
  'use strict';
  const M = window.MAZE444;
  const $ = (id) => document.getElementById(id);
  const cv = $('mz-canvas');
  if (!M || !cv) return;

  const S = { rover: new M.Rover(false), auto: null, hideTruth: false, flash: 0 };

  // ---------- drawing ----------
  const css = (n, f) => (getComputedStyle(document.documentElement).getPropertyValue(n) || f).trim();

  function geom() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(320, r.width * dpr);
    cv.height = Math.max(180, r.width * dpr * (M.ROWS / M.COLS) * 1.02);
    const pad = 14 * dpr;
    const s = Math.min((cv.width - 2 * pad) / M.COLS, (cv.height - 2 * pad) / M.ROWS);
    return { dpr, s, ox: (cv.width - s * M.COLS) / 2, oy: (cv.height - s * M.ROWS) / 2 };
  }

  // heading 0 N, 1 W, 2 S, 3 E — screen y grows downward
  const ANG = [-Math.PI / 2, Math.PI, Math.PI / 2, 0];

  /** an arrowhead pointing along heading h, its tip `reach` from (x,y) */
  function arrow(g, x, y, h, reach, len) {
    const a = ANG[h];
    const tx = x + Math.cos(a) * reach, ty = y + Math.sin(a) * reach;
    const bx = tx - Math.cos(a) * len, by = ty - Math.sin(a) * len;
    const nx = -Math.sin(a) * len * 0.62, ny = Math.cos(a) * len * 0.62;
    g.beginPath();
    g.moveTo(tx, ty); g.lineTo(bx + nx, by + ny); g.lineTo(bx - nx, by - ny);
    g.closePath(); g.fill();
  }

  function draw() {
    const { dpr, s, ox, oy } = geom();
    const g = cv.getContext('2d');
    const ink = css('--ink', '#151820'), paper = css('--paper', '#F7F1E4');
    const hi = css('--hi', '#B8431F'), pop = css('--pop', '#FFCE0A');
    g.clearRect(0, 0, cv.width, cv.height);

    const counts = S.rover.tileCounts();
    const maxc = Math.max(1, ...counts.values());

    for (let r = 0; r < M.ROWS; r++) for (let c = 0; c < M.COLS; c++) {
      const x = ox + c * s, y = oy + r * s, code = M.MAZE[r][c];
      if (code === 15) {
        g.fillStyle = ink; g.fillRect(x, y, s, s);
        g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 1 * dpr;
        for (let k = -s; k < s; k += 7 * dpr) {
          g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + s, y + s); g.stroke();
        }
        continue;
      }
      const n = counts.get(r * M.COLS + c) || 0;
      g.fillStyle = paper; g.fillRect(x, y, s, s);
      if (n) {
        g.globalAlpha = 0.20 + 0.55 * (n / maxc);
        g.fillStyle = S.rover.located ? '#2E9E5B' : hi;
        g.fillRect(x, y, s, s);
        g.globalAlpha = 1;
      }
      // the headings still alive on this tile
      g.fillStyle = S.rover.located ? '#1B6B3C' : 'rgba(21,24,32,0.62)';
      for (const [br, bc, bh] of S.rover.belief) {
        if (br === r && bc === c) arrow(g, x + s / 2, y + s / 2, bh, s * 0.36, s * 0.16);
      }
      // tile wall-code, small
      g.fillStyle = 'rgba(21,24,32,0.35)';
      g.font = `${9 * dpr}px "Space Mono", monospace`;
      g.fillText(String(code), x + 4 * dpr, y + 12 * dpr);
    }

    // the true robot
    if (!S.hideTruth || S.rover.located) {
      const x = ox + S.rover.c * s + s / 2, y = oy + S.rover.r * s + s / 2;
      g.fillStyle = ink;
      g.beginPath(); g.arc(x, y, s * 0.155, 0, 7); g.fill();
      g.fillStyle = S.flash > 0 ? '#FFFFFF' : pop;
      arrow(g, x, y, S.rover.h, s * 0.33, s * 0.17);
      g.fillStyle = pop;
      g.beginPath(); g.arc(x, y, s * 0.075, 0, 7); g.fill();
    }

    // walls, drawn last so they sit on top
    g.strokeStyle = ink; g.lineCap = 'square';
    for (let r = 0; r < M.ROWS; r++) for (let c = 0; c < M.COLS; c++) {
      const code = M.MAZE[r][c], x = ox + c * s, y = oy + r * s;
      g.lineWidth = 3.2 * dpr;
      const seg = (a, b, cc, d) => { g.beginPath(); g.moveTo(a, b); g.lineTo(cc, d); g.stroke(); };
      if (code & 1) seg(x, y, x + s, y);              // north
      if (code & 2) seg(x, y, x, y + s);              // west
      if (code & 4) seg(x, y + s, x + s, y + s);      // south
      if (code & 8) seg(x + s, y, x + s, y + s);      // east
    }
    // faint tile grid
    g.strokeStyle = 'rgba(21,24,32,0.18)'; g.lineWidth = 1 * dpr;
    g.setLineDash([3 * dpr, 4 * dpr]);
    for (let r = 0; r <= M.ROWS; r++) { g.beginPath(); g.moveTo(ox, oy + r * s); g.lineTo(ox + s * M.COLS, oy + r * s); g.stroke(); }
    for (let c = 0; c <= M.COLS; c++) { g.beginPath(); g.moveTo(ox + c * s, oy); g.lineTo(ox + c * s, oy + s * M.ROWS); g.stroke(); }
    g.setLineDash([]);
  }

  // ---------- readouts ----------
  const WALL = (z, b) => ((z >> b) & 1) ? 'wall' : 'open';
  function panel() {
    const rv = S.rover, z = rv.reading();
    $('mz-read').innerHTML = M.BODY.map((n, b) =>
      `<span class="mz-chip ${((z >> b) & 1) ? 'is-wall' : 'is-open'}">${n}<b>${WALL(z, b)}</b></span>`
    ).join('');
    $('mz-code').textContent = z;
    $('mz-bits').textContent = z.toString(2).padStart(4, '0');
    $('mz-count').textContent = rv.belief.length;
    $('mz-moves').textContent = rv.moves;
    const tiles = rv.tileCounts().size;
    $('mz-tiles').textContent = tiles;
    $('mz-status').className = 'lb-note' + (rv.located ? ' is-done' : '');
    $('mz-status').innerHTML = rv.located
      ? `<b>Located.</b> Tile (${rv.r + 1},&nbsp;${rv.c + 1}), facing ${M.DIRNAME[rv.h]}, after <b>${rv.moves}</b> ${rv.moves === 1 ? 'move' : 'moves'}. From here the route is a lookup — the robot only ever needs its <em>next</em> step.`
      : `<b>${rv.belief.length}</b> states still fit this reading, spread over <b>${tiles}</b> ${tiles === 1 ? 'tile' : 'tiles'}${tiles === 1 ? ' — the tile is pinned but the heading is not, which is the whole problem' : ''}. Drive one tile and intersect again.`;
    for (const b of [0, 1, 2, 3]) {
      const el = $('mz-go-' + b);
      if (el) el.disabled = !rv.canGo(b);
    }
    const sug = rv.located ? null : rv.suggest();
    document.querySelectorAll('.mz-drive').forEach((el) =>
      el.classList.toggle('btn-primary', !rv.located && +el.dataset.dir === sug));
  }

  // ---------- actions ----------
  function fresh(known) {
    stopAuto();
    S.rover = new M.Rover(known === undefined ? S.rover.knownHeading : known);
    S.flash = 0.6; panel(); draw();
  }
  function drive(b) {
    if (S.rover.go(b)) { S.flash = 0.45; panel(); draw(); }
  }
  function stopAuto() { if (S.auto) { clearInterval(S.auto); S.auto = null; $('mz-auto').textContent = 'Let it localize'; } }

  $('mz-auto').addEventListener('click', () => {
    if (S.auto) return stopAuto();
    if (S.rover.located) fresh();
    $('mz-auto').textContent = 'Stop';
    S.auto = setInterval(() => {
      if (S.rover.located || !S.rover.go(S.rover.suggest())) { stopAuto(); panel(); draw(); return; }
      panel(); draw();
    }, 620);
  });
  $('mz-drop').addEventListener('click', () => fresh());
  $('mz-imu').addEventListener('change', (e) => fresh(e.target.checked));
  $('mz-hide').addEventListener('change', (e) => { S.hideTruth = e.target.checked; draw(); });
  document.querySelectorAll('.mz-drive').forEach((el) =>
    el.addEventListener('click', () => { stopAuto(); drive(+el.dataset.dir); }));
  window.addEventListener('keydown', (e) => {
    const k = { ArrowUp: 0, ArrowLeft: 1, ArrowDown: 2, ArrowRight: 3 }[e.key];
    if (k === undefined) return;
    if (cv.getBoundingClientRect().bottom < 0 || cv.getBoundingClientRect().top > innerHeight) return;
    stopAuto(); drive(k); e.preventDefault();
  });
  window.addEventListener('resize', draw);

  (function tick() {
    if (S.flash > 0) { S.flash -= 0.05; if (S.flash <= 0) draw(); }
    requestAnimationFrame(tick);
  })();

  panel(); draw();
})();

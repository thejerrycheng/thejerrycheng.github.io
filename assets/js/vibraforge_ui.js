/* vibraforge_ui.js — a spatiotemporal vibrotactile pattern editor, standing in
   for the toolkit's GUI Editor. Paint intensities on a 16-unit chain against
   time, play it back on a sleeve, and see whether the command rate the pattern
   demands fits the link the paper measured (a command every 5 ms, 200 Hz, with
   14 ms of BLE plus 2 ms of UART before the first one lands). */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const grid = $('vf-grid'), sleeve = $('vf-sleeve');
  if (!grid || !sleeve) return;

  const UNITS = 16, STEPS = 32;
  const FREQS = [123, 145, 170, 200, 235, 275, 322, 384];   // the eight measured conditions
  const BLE_MS = 14, UART_MS = 2, SLOT_MS = 5;              // paper, section 4

  const S = { pat: new Uint8Array(UNITS * STEPS), brush: 12, freq: 3,
              stepMs: 50, playing: false, t: 0, head: -1, drag: 0 };
  const at = (u, s) => S.pat[u * STEPS + s];
  const set = (u, s, v) => { if (u >= 0 && u < UNITS && s >= 0 && s < STEPS) S.pat[u * STEPS + s] = v; };

  // ---- presets, each a function of (unit, step) -> intensity 0..15 -----------
  const PRESETS = {
    sweep: { name: 'Sweep down the arm', blurb: 'one unit at a time, 16 steps',
      f: (u, s) => (s % UNITS === u ? 13 : 0) },
    wave: { name: 'Travelling wave', blurb: 'overlapping, so it feels continuous',
      f: (u, s) => { const d = Math.abs(((s * 0.55) % UNITS) - u); return d < 2 ? Math.round(13 * (1 - d / 2)) : 0; } },
    heartbeat: { name: 'Heartbeat', blurb: 'lub-dub, twice a second',
      f: (u, s) => { const p = s % 16; const on = (p < 2) ? 14 : (p >= 5 && p < 8 ? 9 : 0);
                     return (u > 4 && u < 11) ? on : 0; } },
    collision: { name: 'Obstacle to the left', blurb: 'the AeroHaptix cue: closer = harder',
      f: (u, s) => { const near = u < 5; const ramp = Math.min(15, Math.round(s / 2));
                     return near ? ramp : 0; } },
    phoneme: { name: 'Phoneme burst', blurb: 'a short spatial signature',
      f: (u, s) => { if (s > 9) return 0; const sig = [2, 3, 6, 7, 11]; return sig.includes(u) ? (s < 4 ? 15 : 6) : 0; } },
    all: { name: 'All on', blurb: 'the worst case for the link',
      f: () => 14 },
  };
  const bar = $('vf-presets');
  Object.entries(PRESETS).forEach(([k, p]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn vf-preset'; b.dataset.k = k;
    b.innerHTML = `${p.name}<small>${p.blurb}</small>`;
    bar.appendChild(b);
  });
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('.vf-preset');
    if (!b) return;
    const f = PRESETS[b.dataset.k].f;
    for (let u = 0; u < UNITS; u++) for (let s = 0; s < STEPS; s++) set(u, s, Math.max(0, Math.min(15, f(u, s))));
    bar.querySelectorAll('.vf-preset').forEach((x) => x.classList.toggle('btn-primary', x === b));
    redraw();
  });

  // ---- the demand this pattern puts on the link -----------------------------
  function demand() {
    let changes = 0, peak = 0, used = new Set(), lit = 0;
    for (let s = 0; s < STEPS; s++) {
      let n = 0;
      for (let u = 0; u < UNITS; u++) {
        const now = at(u, s), prev = s === 0 ? 0 : at(u, s - 1);
        if (now !== prev) { n++; changes++; }
        if (now) { used.add(u); lit++; }
      }
      peak = Math.max(peak, n);
    }
    const dur = STEPS * S.stepMs / 1000;
    return { changes, peak, units: used.size, dur,
             rate: changes / dur,                       // mean commands per second
             peakRate: peak / (S.stepMs / 1000),        // worst instant, commands per second
             duty: lit / (UNITS * STEPS) };
  }

  function report() {
    const d = demand();
    $('vf-units').textContent = d.units;
    $('vf-rate').textContent = d.rate.toFixed(0);
    $('vf-peak').textContent = d.peakRate.toFixed(0);
    $('vf-dur').textContent = d.dur.toFixed(2);
    const ok = d.peakRate <= 1000 / SLOT_MS;
    const nStep = Math.ceil(d.peak * SLOT_MS);
    $('vf-verdict').className = 'lb-note' + (ok ? ' is-ok' : ' is-bad');
    $('vf-verdict').innerHTML = ok
      ? `<b>Fits the link.</b> The busiest step changes <b>${d.peak}</b> unit${d.peak === 1 ? '' : 's'} at once, which needs ${nStep}&nbsp;ms of slots against the ${S.stepMs}&nbsp;ms you have. Add ${BLE_MS + UART_MS}&nbsp;ms of latency and the first buzz reaches skin ${BLE_MS + UART_MS}&nbsp;ms after you press play.`
      : `<b>Too fast for one chain.</b> The busiest step changes <b>${d.peak}</b> units at once — ${nStep}&nbsp;ms of 5&nbsp;ms slots into a ${S.stepMs}&nbsp;ms step. Either slow the step down, thin the pattern out, or split it across more than one of the eight chains, which is what the 8&nbsp;×&nbsp;16 topology is for.`;
  }

  // ---- drawing ---------------------------------------------------------------
  const css = (n, f) => (getComputedStyle(document.documentElement).getPropertyValue(n) || f).trim();
  const heat = (v) => v ? `rgba(184,67,31,${0.18 + 0.82 * v / 15})` : 'rgba(21,24,32,0.05)';

  function cell(ev) {
    const r = grid.getBoundingClientRect();
    const u = Math.floor((ev.clientY - r.top) / (r.height / UNITS));
    const s = Math.floor((ev.clientX - r.left) / (r.width / STEPS));
    return [u, s];
  }
  function paint(ev, v) {
    const [u, s] = cell(ev);
    if (u < 0 || u >= UNITS || s < 0 || s >= STEPS) return;
    set(u, s, v);
    redraw();
  }
  grid.addEventListener('pointerdown', (e) => {
    const [u, s] = cell(e);
    S.drag = (u >= 0 && at(u, s) === S.brush) ? 0 : S.brush;   // second tap erases
    grid.setPointerCapture(e.pointerId);
    paint(e, S.drag);
  });
  grid.addEventListener('pointermove', (e) => { if (e.buttons) paint(e, S.drag); });
  grid.addEventListener('pointerup', () => { S.drag = 0; });

  function drawGrid() {
    const r = grid.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    grid.width = Math.max(320, r.width * dpr);
    grid.height = Math.max(160, r.width * dpr * 0.42);
    const g = grid.getContext('2d');
    const cw = grid.width / STEPS, ch = grid.height / UNITS;
    g.clearRect(0, 0, grid.width, grid.height);
    for (let u = 0; u < UNITS; u++) for (let s = 0; s < STEPS; s++) {
      g.fillStyle = heat(at(u, s));
      g.fillRect(s * cw + 1, u * ch + 1, cw - 2, ch - 2);
    }
    if (S.playing && S.head >= 0) {
      g.fillStyle = 'rgba(255,206,10,0.85)';
      g.fillRect(S.head * cw, 0, Math.max(2, cw * 0.12), grid.height);
    }
    g.strokeStyle = 'rgba(21,24,32,0.18)'; g.lineWidth = 1 * dpr;
    for (let s = 0; s <= STEPS; s += 4) { g.beginPath(); g.moveTo(s * cw, 0); g.lineTo(s * cw, grid.height); g.stroke(); }
  }

  function drawSleeve() {
    const r = sleeve.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    sleeve.width = Math.max(260, r.width * dpr);
    sleeve.height = Math.max(200, r.width * dpr * 0.62);
    const g = sleeve.getContext('2d');
    const ink = css('--ink', '#151820');
    g.clearRect(0, 0, sleeve.width, sleeve.height);
    // a forearm sleeve: four rings of four units
    const W = sleeve.width, H = sleeve.height;
    g.strokeStyle = 'rgba(21,24,32,0.35)'; g.lineWidth = 2 * dpr;
    g.beginPath();
    g.moveTo(W * 0.10, H * 0.30); g.quadraticCurveTo(W * 0.5, H * 0.16, W * 0.90, H * 0.30);
    g.lineTo(W * 0.90, H * 0.70); g.quadraticCurveTo(W * 0.5, H * 0.84, W * 0.10, H * 0.70);
    g.closePath(); g.stroke();
    const step = S.playing ? S.head : STEPS - 1;
    for (let u = 0; u < UNITS; u++) {
      const col = u % 4, row = Math.floor(u / 4);
      const x = W * (0.19 + 0.205 * row), y = H * (0.34 + 0.107 * col);
      const v = step >= 0 ? at(u, step) : 0;
      const rr = Math.max(6 * dpr, W * 0.021);
      if (v) {
        g.fillStyle = `rgba(184,67,31,${0.25 + 0.6 * v / 15})`;
        g.beginPath(); g.arc(x, y, rr * (1.7 + 1.6 * v / 15), 0, 7); g.fill();
      }
      g.fillStyle = v ? '#FFCE0A' : 'rgba(21,24,32,0.16)';
      g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
      g.strokeStyle = ink; g.lineWidth = 1.4 * dpr; g.stroke();
      g.fillStyle = 'rgba(21,24,32,0.5)';
      g.font = `${8.5 * dpr}px "Space Mono", monospace`;
      g.fillText(String(u), x - 3 * dpr, y + rr + 11 * dpr);
    }
    g.fillStyle = 'rgba(21,24,32,0.55)';
    g.font = `${10.5 * dpr}px "Space Mono", monospace`;
    g.fillText(`${FREQS[S.freq]} Hz · chain 1 of 8 · unit 0 → 15`, 10 * dpr, H - 10 * dpr);
  }

  const redraw = () => { drawGrid(); drawSleeve(); report(); };

  // ---- transport --------------------------------------------------------------
  let last = 0, acc = 0;
  function loop(ts) {
    const dt = Math.max(0, Math.min((ts - last) / 1000 || 0, 0.1));
    last = ts;
    if (S.playing) {
      acc += dt * 1000;
      while (acc >= S.stepMs) { acc -= S.stepMs; S.head = (S.head + 1) % STEPS; }
      drawGrid(); drawSleeve();
    }
    requestAnimationFrame(loop);
  }
  $('vf-play').addEventListener('click', () => {
    S.playing = !S.playing;
    S.head = S.playing ? 0 : -1;
    $('vf-play').textContent = S.playing ? 'Stop' : 'Play the pattern';
    redraw();
  });
  $('vf-clear').addEventListener('click', () => {
    S.pat.fill(0);
    bar.querySelectorAll('.vf-preset').forEach((x) => x.classList.remove('btn-primary'));
    redraw();
  });
  $('vf-brush').addEventListener('input', () => {
    S.brush = +$('vf-brush').value; $('vf-brush-v').textContent = S.brush;
  });
  $('vf-freq').addEventListener('input', () => {
    S.freq = +$('vf-freq').value; $('vf-freq-v').textContent = FREQS[S.freq];
    drawSleeve();
  });
  $('vf-step').addEventListener('input', () => {
    S.stepMs = +$('vf-step').value; $('vf-step-v').textContent = S.stepMs; redraw();
  });
  window.addEventListener('resize', redraw);

  bar.querySelector('.vf-preset').click();     // start on the sweep
  $('vf-brush-v').textContent = S.brush;
  $('vf-freq-v').textContent = FREQS[S.freq];
  $('vf-step-v').textContent = S.stepMs;
  last = performance.now();
  requestAnimationFrame(loop);
})();

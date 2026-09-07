/* ledcube_ui.js — the animations page: twelve patterns on big buttons, a
   refresh-rate slider that takes persistence of vision away, and a cube of
   liquid you tip by dragging. */
(function () {
  'use strict';
  const L = window.LEDCUBE, V = window.CUBEVIEW;
  const $ = (id) => document.getElementById(id);
  const cv = $('lb-canvas');
  if (!L || !V || !cv) return;

  const N = L.N;
  const S = { cube: new L.Cube(), lit: new Float64Array(N * N * N),
              mode: 'countdown', st: {}, view: { yaw: -0.75, pitch: 0.42 },
              drag: null, t: 0, mux: 0, last: 0, liquid: new L.Liquid(1 / 3),
              tipped: false };

  // ---- the button bar -------------------------------------------------------
  const bar = $('lb-buttons');
  L.ANIM_LIST.forEach(([key, label, blurb]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn lb-pick';
    b.dataset.mode = key;
    b.innerHTML = `${label}<small>${blurb}</small>`;
    bar.appendChild(b);
  });
  const liq = document.createElement('button');
  liq.type = 'button'; liq.className = 'btn lb-pick lb-liquid'; liq.dataset.mode = 'liquid';
  liq.innerHTML = 'Liquid<small>tip the cube to slosh it</small>';
  bar.appendChild(liq);

  function select(mode) {
    S.mode = mode; S.st = {};
    if (mode === 'liquid') { S.liquid.reset(); S.tipped = false; }
    bar.querySelectorAll('.lb-pick').forEach((b) => {
      b.classList.toggle('btn-primary', b.dataset.mode === mode);
    });
    $('lb-text-wrap').hidden = mode !== 'letters';
    $('lb-liquid-wrap').hidden = mode !== 'liquid';
    $('lb-note').innerHTML = mode === 'liquid'
      ? 'The cube is a third full. <b>Drag it</b> and the liquid stays level while the cube tips — each column is lit from the floor up to its own depth, which is what a shallow-water solver gives you for free.'
      : 'Only <b>one layer</b> is lit at any instant. The yellow ring marks the layer the multiplexer is driving right now; everything else you see is your own eye holding on to a light that has already gone out.';
  }
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('.lb-pick');
    if (b) select(b.dataset.mode);
  });

  // ---- drag to turn (and, in liquid mode, to tip) ---------------------------
  cv.addEventListener('pointerdown', (e) => { S.drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    if (!S.drag) return;
    S.view.yaw += (e.clientX - S.drag[0]) * 0.01;
    S.view.pitch = Math.max(-1.15, Math.min(1.15, S.view.pitch + (e.clientY - S.drag[1]) * 0.008));
    S.drag = [e.clientX, e.clientY];
    S.tipped = true;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
    cv.addEventListener(ev, () => { S.drag = null; }));

  // ---- loop ------------------------------------------------------------------
  function loop(ts) {
    const dt = Math.max(0, Math.min((ts - S.last) / 1000 || 0, 0.1));
    S.last = ts;
    S.t += dt;

    if (S.mode === 'liquid') {
      const g = L.gravityInCube(S.view.yaw, S.view.pitch, +$('lb-gravity').value);
      const damp = +$('lb-visc').value;
      for (let k = 0; k < 4; k++) S.liquid.step(dt / 4, g.gx, g.gy, g.gz, damp);
      S.liquid.render(S.cube);
    } else {
      S.st.text = $('lb-text').value || 'MIE438 LED CUBE ';
      L.ANIM[S.mode](S.cube, S.t, S.st);
    }

    V.multiplex(S.cube, S.lit, S.t, dt, +$('lb-refresh').value, S);
    V.drawCube(cv, S.cube, S.lit, S.t, S.view, { ring: S.mode !== 'liquid' });

    const g2 = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    g2.fillStyle = 'rgba(244,234,210,0.8)';
    g2.font = `${11 * dpr}px "Space Mono", monospace`;
    g2.fillText(`layer ${S.cube.layer + 1}/8 lit · ${$('lb-refresh').value} Hz refresh`, 12 * dpr, 20 * dpr);
    if (S.mode === 'liquid') {
      const [mn, mx] = S.liquid.depth();
      const tilt = Math.abs(S.view.pitch) * 180 / Math.PI;
      g2.fillText(`tilt ${tilt.toFixed(0)}°  ·  depth ${mn.toFixed(1)}–${mx.toFixed(1)} of 8 cells`, 12 * dpr, 36 * dpr);
      if (!S.tipped) {
        g2.fillStyle = 'rgba(255,206,10,0.9)';
        g2.font = `${13 * dpr}px "Space Mono", monospace`;
        g2.fillText('drag the cube to tip it →', 12 * dpr, 56 * dpr);
      }
    }
    requestAnimationFrame(loop);
  }

  $('lb-refresh').addEventListener('input', () => { $('lb-refresh-v').textContent = $('lb-refresh').value; });
  $('lb-gravity').addEventListener('input', () => { $('lb-gravity-v').textContent = $('lb-gravity').value; });
  $('lb-visc').addEventListener('input', () => { $('lb-visc-v').textContent = $('lb-visc').value; });
  $('lb-liquid-reset').addEventListener('click', () => { S.liquid.reset(); });
  $('lb-refresh-v').textContent = $('lb-refresh').value;
  $('lb-gravity-v').textContent = $('lb-gravity').value;
  $('lb-visc-v').textContent = $('lb-visc').value;

  select('countdown');
  S.last = performance.now();
  requestAnimationFrame(loop);
})();

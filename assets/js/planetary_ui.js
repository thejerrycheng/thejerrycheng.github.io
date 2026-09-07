/* planetary_ui.js — drive the capstone's gear set: change the teeth, watch the
   ratio, the feasibility conditions and the mesh frequency move with them. */
(function () {
  'use strict';
  const P = window.PLANETARY;
  const $ = (id) => document.getElementById(id);
  const cv = $('pg-canvas');
  if (!P || !cv) return;

  const MODULE = 2.0;
  const RPM_MAX = 3300;
  // ANSYS modal results quoted in section 5.8.1 of the report, plus the
  // corrected lumped system mode (see scripts/tools/fsae_gearbox.py)
  const MODES = [
    { name: 'output carrier, mode 1', hz: 2354.3, col: '#1F6FB2' },
    { name: 'input shaft, mode 1', hz: 3014.2, col: '#2E9E5B' },
    { name: 'system (corrected)', hz: 1481, col: '#8E44AD' },
  ];
  const PRESETS = [
    { label: '90 / 30 / 30', zs: 30, zp: 30, note: 'the design as built' },
    { label: '100 / 30 / 35', zs: 30, zp: 35, note: 'shortlisted' },
    { label: '120 / 40 / 40', zs: 40, zp: 40, note: 'shortlisted' },
    { label: '120 / 30 / 45', zs: 30, zp: 45, note: 'shortlisted' },
  ];

  const S = { t: 0, last: 0, phase: 0, running: true };

  // ---- preset buttons --------------------------------------------------------
  const bar = $('pg-presets');
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn pg-preset';
    b.dataset.zs = p.zs; b.dataset.zp = p.zp;
    b.innerHTML = `${p.label}<small>${p.note}</small>`;
    bar.appendChild(b);
  });
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('.pg-preset');
    if (!b) return;
    $('pg-sun').value = b.dataset.zs;
    $('pg-planet').value = b.dataset.zp;
    $('pg-n').value = 4;
    update();
  });

  const state = () => ({
    zs: +$('pg-sun').value, zp: +$('pg-planet').value,
    n: +$('pg-n').value, rpm: +$('pg-rpm').value,
  });

  // ---- readouts --------------------------------------------------------------
  function update() {
    const { zs, zp, n, rpm } = state();
    const f = P.feasibility(zs, zp, n, MODULE);
    const R = P.ratio(zs, zp);
    const mesh = P.meshHz(zs, zp, rpm);

    $('pg-sun-v').textContent = zs;
    $('pg-planet-v').textContent = zp;
    $('pg-n-v').textContent = n;
    $('pg-rpm-v').textContent = rpm;

    $('pg-ring').textContent = f.zr;
    $('pg-ratio').textContent = R.toFixed(2);
    $('pg-dia').textContent = f.ringDia.toFixed(0);
    $('pg-mesh').textContent = mesh.toFixed(0);

    const chip = (ok, label, why) =>
      `<span class="pg-chip ${ok ? 'is-ok' : 'is-bad'}" title="${why}">${label}<b>${ok ? 'passes' : 'fails'}</b></span>`;
    $('pg-checks').innerHTML =
      chip(f.assembly, `Assembly · (${zs}+${f.zr}) ÷ ${n}`,
           'For n equally spaced planets, (z_sun + z_ring) must divide by n') +
      chip(f.neighbour, 'Planets clear each other',
           `planet tip ${f.tip.toFixed(0)} mm vs ${f.gap.toFixed(0)} mm between neighbours`) +
      chip(f.undercut, 'No undercut at 20°',
           'a 20° spur pinion undercuts below about 17 teeth without profile shift') +
      chip(R >= 3 && R <= 5, 'Ratio inside 3 – 5', "the client's stated window");

    // where the mesh orders cross the reported modes, within the speed range
    const meshPerRpm = P.meshHz(zs, zp, 1);          // Hz of mesh per rpm of motor
    const rows = [];
    for (let o = 1; o <= 3; o++) {
      for (const m of MODES) {
        const rpmCross = m.hz / (o * meshPerRpm);
        if (rpmCross <= RPM_MAX) {
          rows.push(`<li><b>${o}× mesh</b> meets the ${m.name} (${m.hz.toFixed(0)} Hz) at <b>${rpmCross.toFixed(0)} rpm</b></li>`);
        }
      }
    }
    rows.sort();
    $('pg-camp').innerHTML = rows.length
      ? `<b>${rows.length} order crossing${rows.length > 1 ? 's' : ''} below the redline:</b><ul>${rows.join('')}</ul>`
        + '<p style="margin:6px 0 0">Modal frequencies are the report\'s, so they only strictly apply to the parts as built — but the orders move with the teeth, and you can watch them sweep.</p>'
      : '<b>No mesh-order crossing below the redline.</b> Bear in mind the modal frequencies are fixed at the values measured for the built parts, so this is only meaningful near the design point.';
    draw();
  }

  ['pg-sun', 'pg-planet', 'pg-n', 'pg-rpm'].forEach((id) =>
    $(id).addEventListener('input', update));
  $('pg-run').addEventListener('click', () => {
    S.running = !S.running;
    $('pg-run').textContent = S.running ? 'Pause' : 'Spin it';
  });

  // ---- drawing ---------------------------------------------------------------
  const css = (n, f) => (getComputedStyle(document.documentElement).getPropertyValue(n) || f).trim();

  function draw() {
    const { zs, zp, n } = state();
    const f = P.feasibility(zs, zp, n, MODULE);
    const k = P.kinematics(zs, zp);
    const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(320, r.width * dpr);
    cv.height = Math.max(260, r.width * dpr * 0.78);
    const g = cv.getContext('2d');
    const ink = css('--ink', '#151820'), paper = css('--paper', '#F7F1E4');
    const hi = css('--hi', '#B8431F'), pop = css('--pop', '#FFCE0A');

    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = paper; g.fillRect(0, 0, cv.width, cv.height);
    const cx = cv.width / 2, cy = cv.height / 2;
    const scale = Math.min(cv.width, cv.height) * 0.42 / (f.ringDia / 2 + MODULE * 2);
    const S_ = (mm) => mm * scale;
    const ph = S.phase;

    // Teeth are phased so the gears actually mesh: each planet's phase is set by
    // its mesh with the sun, and the ring's by its mesh with planet 0. When the
    // assembly condition fails the other planets disagree with that ring by half
    // a tooth, and you can see them clash.
    const theta = (i) => ph * k.carrier + i * 2 * Math.PI / n;
    const planetPh = (i) => P.planetPhase(zs, zp, ph, theta(i));
    const ringPh = P.ringPhase(f.zr, zp, planetPh(0), theta(0));

    // ring gear (internal), drawn as an annulus with inward teeth
    g.save();
    g.beginPath();
    g.arc(cx, cy, S_(f.ringDia / 2 + MODULE * 2.6), 0, 7);
    P.toothPath(g, cx, cy, f.zr, S_(MODULE), ringPh, true);
    g.fillStyle = 'rgba(21,24,32,0.14)';
    g.fill('evenodd');
    g.restore();
    g.strokeStyle = ink; g.lineWidth = 2 * dpr;
    P.toothPath(g, cx, cy, f.zr, S_(MODULE), ringPh, true); g.stroke();

    // carrier arms
    g.strokeStyle = 'rgba(21,24,32,0.35)'; g.lineWidth = 7 * dpr; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = theta(i);
      g.beginPath(); g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * S_(f.a), cy + Math.sin(a) * S_(f.a));
      g.stroke();
    }

    // planets
    for (let i = 0; i < n; i++) {
      const a = theta(i);
      const px = cx + Math.cos(a) * S_(f.a), py = cy + Math.sin(a) * S_(f.a);
      // Each planet is drawn phased to the sun, which it must mesh with. Whether
      // it can ALSO mesh the ring is the assembly condition, per planet.
      const clash = P.phaseError(zs, f.zr, n, i) > 0.02 || !f.neighbour;
      P.toothPath(g, px, py, zp, S_(MODULE), planetPh(i), false);
      g.fillStyle = clash ? 'rgba(220,50,40,0.42)' : 'rgba(184,67,31,0.22)';
      g.fill();
      g.strokeStyle = clash ? '#C0392B' : ink; g.lineWidth = 1.8 * dpr; g.stroke();
      g.fillStyle = ink;
      g.beginPath(); g.arc(px, py, S_(MODULE) * 1.1, 0, 7); g.fill();
    }

    // sun
    P.toothPath(g, cx, cy, zs, S_(MODULE), ph, false);
    g.fillStyle = pop; g.fill();
    g.strokeStyle = ink; g.lineWidth = 2 * dpr; g.stroke();

    // labels
    g.fillStyle = ink;
    g.font = `${11 * dpr}px "Space Mono", monospace`;
    g.fillText(`sun ${zs}T`, 12 * dpr, 20 * dpr);
    g.fillText(`planet ${zp}T × ${n}`, 12 * dpr, 36 * dpr);
    g.fillText(`ring ${f.zr}T`, 12 * dpr, 52 * dpr);
    if (!f.assembly) {
      g.fillStyle = '#C0392B';
      g.font = `${13 * dpr}px "Space Mono", monospace`;
      g.fillText(`(${zs}+${f.zr}) ÷ ${n} is not a whole number — the red planets`, 12 * dpr, cv.height - 30 * dpr);
      g.fillText('are half a tooth out of phase with the ring', 12 * dpr, cv.height - 14 * dpr);
    }
  }

  function loop(ts) {
    const dt = Math.max(0, Math.min((ts - S.last) / 1000 || 0, 0.08));
    S.last = ts;
    if (S.running) {
      const { rpm } = state();
      S.phase += dt * (rpm / 60) * 2 * Math.PI * 0.06;   // slowed for the eye
      draw();
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', draw);
  update();
  S.last = performance.now();
  requestAnimationFrame(loop);
})();

/* Live telemetry under the #live-gripper stage (user 2026-10-20: "plot the things for me too like error; grip force;
 * torque from the robot's arms; mobile base status - use a circle and velocity vector for vel vector and ang vel
 * vector"). Charts in the WUJI Training Studio style (uPlot, mono axes, faint grid, swatch-toggle legends, hover tip);
 * the base widget is a top-down chassis circle per robot with the velocity vector and an angular-velocity arc,
 * commanded (dashed) vs measured (solid). Data: the `tele` block of the server's state messages (~10 Hz,
 * scripts/live_server.py Tele), re-dispatched by m2-live-gripper.js as the root's `lg-state` event. */
(() => {
  'use strict';
  const root = document.getElementById('live-gripper');
  if (!root) return;
  const UPLOT = 'assets/projects/m2/vendor/uPlot.iife.min.js?v=1.6.31';
  const WIN = 20;                                              // s of history on screen
  // WUJI studio palette / axis style (assets/studio/app/rollview.js, studio.js chartOpts)
  const C = {ink: '#efeae3', soft: '#cfc8be', ash: '#97908a', grid: 'rgba(242,238,230,.06)', tick: 'rgba(242,238,230,.1)',
             accent: '#C25B2A', accentSoft: '#f0b68b', blue: '#6FA8DC', teal: '#8FBCBB', green: '#3FB56B', gold: '#E9C46A',
             danger: 'rgba(210,59,42,.75)', mabel: '#f28c28', milo: '#20bebe'};
  const MONO = '10px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  const AX = {stroke: C.ash, grid: {stroke: C.grid, width: 1}, ticks: {stroke: C.tick, width: 1, size: 4}, font: MONO, gap: 4};
  const ROBOT = ['MABEL', 'MILO'];

  // ---------------------------------------------------------------- DOM
  const box = document.createElement('details');
  box.className = 'lg-tele'; box.open = true; box.hidden = true;
  box.innerHTML = `<summary><span>Telemetry</span><small>live from the simulation · last ${WIN} s</small></summary>
    <div class="lg-tgrid">
      <div class="lg-chart" data-k="err"><div class="ct"><span class="t">tracking error · box vs plan</span><span class="v"></span></div><div class="cv"></div><div class="lg-tlg"></div></div>
      <div class="lg-chart" data-k="grip"><div class="ct"><span class="t">grip force · weaker pad, N</span><span class="v"></span></div><div class="cv"></div><div class="lg-tlg"></div><div class="lg-tnote lg-gap"></div></div>
      <div class="lg-chart" data-k="tau"><div class="ct"><span class="t">arm torque · % of rated</span><span class="v"></span></div><div class="cv"></div><div class="lg-tlg"></div><div class="lg-tnote">RMS over 2 s of each robot's most loaded arm joint (the training's motor model); dashed red: the 80 % continuous limit</div></div>
      <div class="lg-chart lg-basec" data-k="base"><div class="ct"><span class="t">mobile base · top view</span><span class="v"></span></div>
        <div class="lg-bases">${ROBOT.map((n, k) => `<figure class="lg-base" data-r="${k}"><canvas></canvas><figcaption><b style="color:${k ? C.milo : C.mabel}">${n}</b><span class="lg-bread"></span></figcaption></figure>`).join('')}</div>
        <div class="lg-tlg lg-blg"><span><i class="ln"></i>measured</span><span><i class="ln dash"></i>commanded</span><span><i class="ln" style="background:${C.green}"></i>turn rate ω</span><span class="mono dim">↑ forward · length ∝ √speed: full arrow 0.8 m/s, full arc 1 rad/s</span></div>
      </div>
    </div>`;
  const note = root.querySelector('.lg-note');
  (note ? note.parentNode : root.querySelector('.lg-wrap')).insertBefore(box, note || null);
  const $ = s => box.querySelector(s);

  // ---------------------------------------------------------------- data
  const H = {t: [], pe: [], re: [], g: [[], [], [], []], rms: [[], []], pk: [[], []]};
  let lastT = -1, trial = null, charts = null, uplotP = null, latest = null;
  function clear() { H.t.length = 0; H.pe.length = 0; H.re.length = 0; H.g.forEach(a => a.length = 0);
    H.rms.forEach(a => a.length = 0); H.pk.forEach(a => a.length = 0); lastT = -1; }
  function push(s) {
    const T = s.tele;
    if (s.trial !== trial || T.t < lastT) { clear(); trial = s.trial; }
    if (T.t === lastT) return false;
    lastT = T.t;
    H.t.push(T.t); H.pe.push(T.err[0]); H.re.push(T.err[1]);
    T.grip.forEach((v, i) => H.g[i].push(v));
    T.tau.forEach((r, k) => { H.rms[k].push(r[0]); H.pk[k].push(r[1]); });
    while (H.t.length && H.t[0] < T.t - WIN - 1) {
      H.t.shift(); H.pe.shift(); H.re.shift(); H.g.forEach(a => a.shift()); H.rms.forEach(a => a.shift()); H.pk.forEach(a => a.shift());
    }
    return true;
  }

  // ---------------------------------------------------------------- charts (WUJI studio style)
  function loadUplot() {
    if (window.uPlot) return Promise.resolve();
    if (!uplotP) uplotP = new Promise((res, rej) => {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = UPLOT.replace('iife.min.js', 'min.css'); document.head.appendChild(css);
      const sc = document.createElement('script'); sc.src = UPLOT; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc);
    });
    return uplotP;
  }
  const tipEl = Object.assign(document.createElement('div'), {className: 'lg-ttip'}); tipEl.hidden = true; box.appendChild(tipEl);
  function tipHook(u) {
    const i = u.cursor.idx;
    if (i == null || u.cursor.left < 0) { tipEl.hidden = true; return; }
    const rows = u.series.slice(1).map((s, k) => s.show !== false && s._label ?
      `<div><span class="sw" style="background:${s._color}"></span>${s._label} <b>${fmtv(u.data[k + 1][i])}</b></div>` : '').join('');
    tipEl.innerHTML = `<div class="dim">t ${u.data[0][i].toFixed(1)} s</div>${rows}`;
    const b = u.over.getBoundingClientRect(), bb = box.getBoundingClientRect();
    tipEl.style.left = Math.min(bb.width - 200, b.left - bb.left + u.cursor.left + 14) + 'px';
    tipEl.style.top = (b.top - bb.top + u.cursor.top + 10) + 'px'; tipEl.hidden = false;
  }
  const fmtv = v => v == null ? '—' : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
  function limitHook(y) {                                         // a dashed horizontal guide (the 80 % torque limit)
    return u => { const g = u.ctx, py = u.valToPos(y, 'y', true); if (py < u.bbox.top || py > u.bbox.top + u.bbox.height) return;
      g.save(); g.strokeStyle = C.danger; g.setLineDash([4, 3]); g.lineWidth = 1.2 * devicePixelRatio;
      g.beginPath(); g.moveTo(u.bbox.left, py); g.lineTo(u.bbox.left + u.bbox.width, py); g.stroke(); g.restore(); };
  }
  function opts(host, series, extra = {}) {
    const axes = [{...AX, size: 24, values: (u, v) => v.map(x => x.toFixed(0) + 's')}, {...AX, size: 40}];
    if (extra.y2) axes.push({...AX, side: 1, scale: 'y2', size: 40, grid: {show: false}});
    return {
      width: Math.max(220, host.clientWidth), height: 150, legend: {show: false}, cursor: {points: {size: 5}, drag: {x: false, y: false}},
      scales: {x: {time: false, range: () => { const t1 = H.t.length ? H.t[H.t.length - 1] : 0; return [Math.max(0, t1 - WIN), Math.max(WIN, t1)]; }},
               y: {range: extra.yr || ((u, lo, hi) => [Math.min(0, lo), Math.max(hi * 1.15, extra.ymin || 1)])},
               ...(extra.y2 ? {y2: {range: (u, lo, hi) => [0, Math.max(hi * 1.15, 2)]}} : {})},
      axes, series: [{}, ...series], hooks: {setCursor: [tipHook], draw: extra.draw || []},
    };
  }
  const line = (label, color, o = {}) => ({label, _label: label, _color: color, stroke: color, width: o.width || 1.6,
    dash: o.dash, scale: o.scale || 'y', points: {show: false}, spanGaps: true});
  function legend(el, u, items) {
    el.innerHTML = items.map((it, k) => `<button class="on" data-i="${k + 1}"><i style="background:${it._color}${it.dash ? ';opacity:.6' : ''}"></i>${it._label}</button>`).join('');
    el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i, show = !b.classList.contains('on'); b.classList.toggle('on', show); u.setSeries(i, {show}); }));
  }
  function build() {
    const hostOf = k => $(`.lg-chart[data-k="${k}"] .cv`), lgOf = k => $(`.lg-chart[data-k="${k}"] .lg-tlg`);
    const errS = [line('position, cm', C.blue), line('orientation, °', C.gold, {scale: 'y2'})];
    const gripS = [line('MABEL L', C.accent), line('MABEL R', C.accentSoft), line('MILO L', C.blue), line('MILO R', C.teal)];
    const tauS = [line('MABEL', C.accent, {width: 1.8}), line('MILO', C.blue, {width: 1.8})];
    const mk = (k, series, extra) => { const u = new uPlot(opts(hostOf(k), series, extra), [[]].concat(series.map(() => [])), hostOf(k)); legend(lgOf(k), u, series); return u; };
    charts = {
      err: mk('err', errS, {y2: true, ymin: 2}),
      grip: mk('grip', gripS, {ymin: 10}),
      tau: mk('tau', tauS, {yr: (u, lo, hi) => [0, Math.max(100, hi * 1.1)], draw: [limitHook(80)]}),
    };
    const ro = new ResizeObserver(() => Object.entries(charts).forEach(([k, u]) => u.setSize({width: Math.max(220, hostOf(k).clientWidth), height: 150})));
    Object.keys(charts).forEach(k => ro.observe(hostOf(k)));
  }
  function redraw() {
    if (!charts) return;
    charts.err.setData([H.t, H.pe, H.re]);
    charts.grip.setData([H.t, ...H.g]);
    charts.tau.setData([H.t, H.rms[0], H.rms[1]]);
  }

  // ---------------------------------------------------------------- base widget (top view, robot frame)
  const VMAX = 0.8, WMAX = 1.0;                                // m/s (BASE_VMAX), rad/s for a full arc
  function drawBase(cv, b, color) {
    const d = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
    if (!w) return;
    if (cv.width !== w * d) { cv.width = w * d; cv.height = h * d; }
    const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 22;
    // chassis circle, forward tick, faint cross
    g.strokeStyle = C.tick; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
    g.strokeStyle = color; g.globalAlpha = .9; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = color; g.beginPath(); g.moveTo(cx, cy - R - 7); g.lineTo(cx - 5, cy - R + 1); g.lineTo(cx + 5, cy - R + 1); g.closePath(); g.fill();
    g.font = MONO; g.fillStyle = C.ash; g.textAlign = 'center'; g.fillText('fwd', cx, cy - R + 14);
    if (!b) return;
    // swerve modules (when the server models them): module_xy [m, robot frame] + [steer rad, wheel m/s]
    if (b.modules && b.module_xy) {
      const S = R / 0.42;
      b.modules.forEach(([st, sp], i) => {
        const [mx, my] = b.module_xy[i], px = cx - my * S, py = cy - mx * S;
        g.save(); g.translate(px, py); g.rotate(-st);
        g.fillStyle = 'rgba(239,234,227,.16)'; g.strokeStyle = C.soft; g.lineWidth = 1;
        g.beginPath(); g.rect(-4, -9, 8, 18); g.fill(); g.stroke();
        const L = Math.max(-1, Math.min(1, sp / VMAX)) * R * 0.45;
        g.strokeStyle = C.soft; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -L); g.stroke();
        g.restore();
      });
    }
    // velocity vectors: robot +x = up, +y = left
    const arrow = (vx, vy, col, dash, lw) => {
      const v = Math.hypot(vx, vy), sc = v > 1e-6 ? Math.sqrt(Math.min(1, v / VMAX)) * R / v : 0;   // length ~ sqrt(speed)
      const sx = -vy * sc, sy = -vx * sc, L = Math.hypot(sx, sy);
      if (L < 1.5) { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, 2.5, 0, 7); g.fill(); return; }
      const k = Math.min(1, (R * 1.05) / L), ex = cx + sx * k, ey = cy + sy * k, a = Math.atan2(ey - cy, ex - cx);
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = lw; g.setLineDash(dash ? [5, 4] : []);
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
      g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - 9 * Math.cos(a - .4), ey - 9 * Math.sin(a - .4));
      g.lineTo(ex - 9 * Math.cos(a + .4), ey - 9 * Math.sin(a + .4)); g.closePath(); g.fill();
    };
    // angular velocity: an arc just outside the circle, from forward, CCW positive (screen CCW)
    const arc = (wz, col, dash, rr, lw) => {
      const sweep = Math.sign(wz) * Math.sqrt(Math.min(1, Math.abs(wz) / WMAX)) * Math.PI * 0.85;   // ~ sqrt(rate)
      if (Math.abs(sweep) < 0.02) return;
      const a0 = -Math.PI / 2, a1 = a0 - sweep;
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = lw; g.setLineDash(dash ? [5, 4] : []);
      g.beginPath(); g.arc(cx, cy, rr, a0, a1, sweep > 0); g.stroke(); g.setLineDash([]);
      const ex = cx + rr * Math.cos(a1), ey = cy + rr * Math.sin(a1), tg = a1 + (sweep > 0 ? -Math.PI / 2 : Math.PI / 2);
      g.beginPath(); g.moveTo(ex + 7 * Math.cos(tg), ey + 7 * Math.sin(tg));
      g.lineTo(ex + 6 * Math.cos(tg + 2.4), ey + 6 * Math.sin(tg + 2.4)); g.lineTo(ex + 6 * Math.cos(tg - 2.4), ey + 6 * Math.sin(tg - 2.4)); g.closePath(); g.fill();
    };
    arc(b.cmd[2], 'rgba(63,181,107,.65)', true, R + 13, 1.5);
    arc(b.meas[2], C.green, false, R + 8, 2.4);
    arrow(b.cmd[0], b.cmd[1], C.accentSoft, true, 1.6);
    arrow(b.meas[0], b.meas[1], C.ink, false, 2.4);
  }
  function drawBases(T) {
    box.querySelectorAll('.lg-base').forEach((f, k) => {
      const b = T ? T.base[k] : null;
      drawBase(f.querySelector('canvas'), b, k ? C.milo : C.mabel);
      f.querySelector('.lg-bread').innerHTML = b ? `v <b>${Math.hypot(b.meas[0], b.meas[1]).toFixed(2)}</b> m/s · ω <b>${(b.meas[2] * 180 / Math.PI).toFixed(0)}</b>°/s<br>lift <b>${b.lift[0].toFixed(2)}</b> m · <b>${(b.lift[1] * 1000).toFixed(0)}</b> mm/s` : '—';
    });
  }

  // ---------------------------------------------------------------- readouts + wiring
  function values(T) {
    const v = (k, html) => { $(`.lg-chart[data-k="${k}"] .v`).innerHTML = html; };
    v('err', `${T.err[0].toFixed(1)} cm · ${T.err[1].toFixed(1)}°`);
    v('grip', T.grip.map(x => x.toFixed(0)).join(' / ') + ' N');
    const worst = T.tau[0][0] >= T.tau[1][0] ? 0 : 1;
    v('tau', `<span class="${T.tau[worst][0] > 80 ? 'hot' : ''}">${T.tau[worst][0].toFixed(0)} %</span> ${ROBOT[worst]} ${T.tau[worst][2]}`);
    $('.lg-gap').innerHTML = 'finger gap · bar ' + T.bar_mm.toFixed(0) + ' mm: ' + ['MABEL L', 'MABEL R', 'MILO L', 'MILO R']
      .map((n, i) => `${n} <b class="${Math.abs(T.gap[i] - T.bar_mm) < 6 ? 'ok' : ''}">${T.gap[i].toFixed(0)}</b>`).join(' · ');
    const b = T.base.map(x => Math.hypot(x.meas[0], x.meas[1]).toFixed(2));
    v('base', `${b[0]} / ${b[1]} m/s`);
  }
  let raf = 0;
  root.addEventListener('lg-state', e => {
    const s = e.detail;
    if (!s || !s.tele) { if (s && s.mode === 'setup') { clear(); redraw(); drawBases(null); } return; }
    box.hidden = false; latest = s.tele;
    if (!push(s)) return;
    if (!charts) { loadUplot().then(() => { if (!charts) build(); redraw(); }).catch(() => {}); }
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; redraw(); values(latest); drawBases(latest); });
  });
  root.addEventListener('lg-connected', e => { box.hidden = !e.detail; if (!e.detail) { clear(); redraw(); } });
  box.addEventListener('toggle', () => { if (box.open) requestAnimationFrame(() => { if (charts) Object.values(charts).forEach(u => u.redraw()); drawBases(latest); }); });
  root.lgTele = {history: H, charts: () => charts, latest: () => latest};      // (read by the tests)
})();

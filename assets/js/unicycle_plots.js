/* =============================================================================
   unicycle_plots.js — canvas charts for the unicycle page, from
   assets/data/unicycle_results.json (experiments/make_figures.py). Hover for the
   values; redraws on theme changes and resizes.
   ============================================================================= */
(function () {
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COL = { generative: '#E4442A', conventional: '#2a78d6', paper: '#8e6bd1', gold: '#D9A13F', green: '#1baf7a' };
  const DEG = 180 / Math.PI;

  function setup(canvas) {
    const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return [ctx, r.width, r.height];
  }
  function theme() { return { ink: css('--ink') || '#151820', panel: css('--panel') || '#fdf6e2', ash: css('--ash') || '#8f8a7a', grid: 'rgba(128,128,128,.22)', font: '"Jost", sans-serif', mono: '"Space Mono", monospace' }; }
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; const n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10; return n * p; }
  function fmt(v) { if (v === null || v === undefined || !isFinite(v)) return '∞'; return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? (Math.round(v * 10) / 10).toString() : (Math.round(v * 100) / 100).toString(); }
  function tooltip(canvas, hits) {
    let tip = canvas.parentElement.querySelector('.plot-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'plot-tip'; tip.hidden = true; canvas.parentElement.style.position = 'relative'; canvas.parentElement.appendChild(tip); }
    canvas.onpointermove = (e) => { const r = canvas.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; let best = null, bd = 14; for (const h of hits) { const d = Math.hypot(x - h.x, y - h.y); if (d < bd) { bd = d; best = h; } } if (best) { tip.hidden = false; tip.textContent = best.text; tip.style.left = (x + 12) + 'px'; tip.style.top = (y - 10) + 'px'; } else tip.hidden = true; };
    canvas.onpointerleave = () => { tip.hidden = true; };
  }
  function legend(ctx, series, L, H, th) { let lx = L; ctx.font = `10px ${th.font}`; for (const s of series) { ctx.fillStyle = s.color; ctx.fillRect(lx, H - 12, 10, 10); ctx.fillStyle = th.ash; ctx.textAlign = 'left'; ctx.fillText(s.name, lx + 14, H - 3); lx += 14 + ctx.measureText(s.name).width + 14; } }

  /** continuous curves: spec = {title, xlabel, ylabel, series:[{name,color,x:[],y:[],dash?,marker?}], ylog?, ymin?, ymax?, band?, hline?} */
  function curves(canvas, spec) {
    const [ctx, W, H] = setup(canvas); const th = theme();
    const L = 50, R = 12, T = 24, B = 44; const pw = W - L - R, ph = H - T - B;
    ctx.fillStyle = th.panel; ctx.fillRect(0, 0, W, H);
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const s of spec.series) s.x.forEach((x, i) => { const y = s.y[i]; if (y === null || y === undefined || !isFinite(y)) return; xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); });
    if (spec.xmin !== undefined) xmin = spec.xmin; if (spec.xmax !== undefined) xmax = spec.xmax;
    if (spec.ylog) { ymin = spec.ymin ?? ymin; ymax = spec.ymax ?? ymax; } else { ymax = spec.ymax ?? niceMax(ymax * 1.08); ymin = spec.ymin ?? (ymin < 0 ? -niceMax(-ymin * 1.08) : 0); }
    const xp = (x) => L + (x - xmin) / ((xmax - xmin) || 1) * pw;
    const yp = (y) => spec.ylog ? T + ph - (Math.log10(y) - Math.log10(ymin)) / (Math.log10(ymax) - Math.log10(ymin)) * ph : T + ph - (y - ymin) / ((ymax - ymin) || 1) * ph;
    ctx.strokeStyle = th.grid; ctx.lineWidth = 1; ctx.font = `10px ${th.mono}`; ctx.fillStyle = th.ash; ctx.textAlign = 'right';
    if (spec.ylog) { for (let e = Math.ceil(Math.log10(ymin)); e <= Math.floor(Math.log10(ymax)); e++) { const v = Math.pow(10, e); ctx.beginPath(); ctx.moveTo(L, yp(v)); ctx.lineTo(W - R, yp(v)); ctx.stroke(); ctx.fillText(fmt(v), L - 6, yp(v) + 3); } }
    else { const step = niceMax((ymax - ymin) / 4.5); for (let v = Math.ceil(ymin / step) * step; v <= ymax + 1e-9; v += step) { ctx.beginPath(); ctx.moveTo(L, yp(v)); ctx.lineTo(W - R, yp(v)); ctx.stroke(); ctx.fillText(fmt(v), L - 6, yp(v) + 3); } }
    const xs = niceMax((xmax - xmin) / 6); ctx.textAlign = 'center';
    for (let v = Math.ceil(xmin / xs) * xs; v <= xmax + 1e-9; v += xs) { ctx.beginPath(); ctx.moveTo(xp(v), T); ctx.lineTo(xp(v), T + ph); ctx.stroke(); ctx.fillText(fmt(v), xp(v), H - B + 14); }
    if (spec.band) { ctx.fillStyle = 'rgba(217,161,63,.22)'; ctx.fillRect(L, yp(spec.band), pw, yp(-spec.band) - yp(spec.band)); }
    if (!spec.ylog && ymin < 0) { ctx.strokeStyle = th.ash; ctx.beginPath(); ctx.moveTo(L, yp(0)); ctx.lineTo(W - R, yp(0)); ctx.stroke(); }
    if (spec.hline) { ctx.setLineDash([4, 4]); ctx.strokeStyle = th.ash; ctx.beginPath(); ctx.moveTo(L, yp(spec.hline[0])); ctx.lineTo(W - R, yp(spec.hline[0])); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = th.ash; ctx.font = `10px ${th.font}`; ctx.textAlign = 'right'; ctx.fillText(spec.hline[1], W - R, yp(spec.hline[0]) - 4); }
    if (spec.vline) { ctx.setLineDash([4, 4]); ctx.strokeStyle = th.ash; ctx.beginPath(); ctx.moveTo(xp(spec.vline[0]), T); ctx.lineTo(xp(spec.vline[0]), T + ph); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = th.ash; ctx.font = `10px ${th.font}`; ctx.textAlign = 'left'; ctx.fillText(spec.vline[1], xp(spec.vline[0]) + 4, T + 12); }
    const hits = [];
    for (const s of spec.series) {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.lw || 1.8; if (s.dash) ctx.setLineDash(s.dash); ctx.beginPath(); let pen = false;
      s.x.forEach((x, i) => { const y = s.y[i]; if (y === null || y === undefined || !isFinite(y) || (spec.ylog && y <= 0)) { pen = false; return; } const px = xp(x), py = Math.max(T, Math.min(T + ph, yp(y))); pen ? ctx.lineTo(px, py) : ctx.moveTo(px, py); pen = true; });
      ctx.stroke(); ctx.setLineDash([]);
      if (s.marker) s.x.forEach((x, i) => { const y = s.y[i]; if (y === null || !isFinite(y)) { if (s.fell && s.fell[i]) { ctx.strokeStyle = s.color; ctx.lineWidth = 2; const px = xp(x), py = T + 8; ctx.beginPath(); ctx.moveTo(px - 4, py - 4); ctx.lineTo(px + 4, py + 4); ctx.moveTo(px + 4, py - 4); ctx.lineTo(px - 4, py + 4); ctx.stroke(); hits.push({ x: px, y: py, text: `${s.name} · ${fmt(x)}: fell` }); } return; } const px = xp(x), py = Math.max(T, Math.min(T + ph, yp(y))); ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(px, py, 3.2, 0, 2 * Math.PI); ctx.fill(); if (s.fell && s.fell[i]) { ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px - 5, py - 5); ctx.lineTo(px + 5, py + 5); ctx.moveTo(px + 5, py - 5); ctx.lineTo(px - 5, py + 5); ctx.stroke(); } hits.push({ x: px, y: py, text: `${s.name} · ${spec.xlabel || 'x'} ${fmt(x)}: ${fmt(y)}${s.fell && s.fell[i] ? ' (fell)' : ''}` }); });
      else { const n = s.x.length; for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 60))) { const y = s.y[i]; if (y === null || !isFinite(y)) continue; hits.push({ x: xp(s.x[i]), y: Math.max(T, Math.min(T + ph, yp(y))), text: `${s.name} · ${fmt(s.x[i])}: ${fmt(y)}` }); } }
    }
    ctx.textAlign = 'left'; ctx.fillStyle = th.ink; ctx.font = `600 11px ${th.font}`; ctx.fillText(spec.title || '', L, 14);
    ctx.fillStyle = th.ash; ctx.font = `10px ${th.font}`; ctx.textAlign = 'center'; ctx.fillText(spec.xlabel || '', L + pw / 2, H - B + 28);
    ctx.save(); ctx.translate(12, T + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(spec.ylabel || '', 0, 0); ctx.restore();
    legend(ctx, spec.series, L, H, th); tooltip(canvas, hits);
  }

  /** grouped bars: spec = {title, groups:[..], series:[{name,color,values:[..]}], ylog?, note?} */
  function bars(canvas, spec) {
    const [ctx, W, H] = setup(canvas); const th = theme();
    const L = 50, R = 10, T = 26, B = 48; const pw = W - L - R, ph = H - T - B;
    ctx.fillStyle = th.panel; ctx.fillRect(0, 0, W, H);
    let ymax = 0, ymin = Infinity; for (const s of spec.series) for (const v of s.values) if (v !== null && isFinite(v)) { ymax = Math.max(ymax, v); ymin = Math.min(ymin, v); }
    ymax = spec.ylog ? Math.pow(10, Math.ceil(Math.log10(ymax))) : niceMax(ymax * 1.12); ymin = spec.ylog ? Math.pow(10, Math.floor(Math.log10(Math.max(1e-3, ymin)))) : 0;
    const y = (v) => spec.ylog ? T + ph - (Math.log10(v) - Math.log10(ymin)) / (Math.log10(ymax) - Math.log10(ymin)) * ph : T + ph - v / ymax * ph;
    ctx.strokeStyle = th.grid; ctx.lineWidth = 1; ctx.font = `10px ${th.mono}`; ctx.fillStyle = th.ash; ctx.textAlign = 'right';
    if (spec.ylog) for (let e = Math.log10(ymin); e <= Math.log10(ymax); e++) { const v = Math.pow(10, e); ctx.beginPath(); ctx.moveTo(L, y(v)); ctx.lineTo(W - R, y(v)); ctx.stroke(); ctx.fillText(fmt(v), L - 6, y(v) + 3); }
    else { const step = niceMax(ymax / 4.5); for (let v = 0; v <= ymax + 1e-9; v += step) { ctx.beginPath(); ctx.moveTo(L, y(v)); ctx.lineTo(W - R, y(v)); ctx.stroke(); ctx.fillText(fmt(v), L - 6, y(v) + 3); } }
    const ng = spec.groups.length, ns = spec.series.length, gw = pw / ng, bw = Math.min(40, gw * 0.72 / ns), hits = [];
    spec.groups.forEach((g, gi) => {
      const x0 = L + gw * gi + gw / 2 - bw * ns / 2;
      spec.series.forEach((s, si) => {
        const v = s.values[gi]; const x = x0 + si * bw + 1;
        if (v === null || v === undefined || !isFinite(v)) { ctx.fillStyle = th.ash; ctx.font = `10px ${th.mono}`; ctx.textAlign = 'center'; ctx.fillText('∞', x + (bw - 2) / 2, T + 12); hits.push({ x: x + bw / 2, y: T + 10, text: `${s.name} · ${g}: never settles` }); return; }
        const top = y(v), h = T + ph - top; ctx.fillStyle = s.color; ctx.globalAlpha = s.alpha || 1; ctx.fillRect(x, top, bw - 2, h); ctx.globalAlpha = 1;
        ctx.fillStyle = th.ink; ctx.font = `9.5px ${th.mono}`; ctx.textAlign = 'center'; ctx.fillText(fmt(v), x + (bw - 2) / 2, top - 4);
        hits.push({ x: x + bw / 2, y: top, text: `${s.name} · ${g}: ${fmt(v)}` });
      });
      ctx.fillStyle = th.ink; ctx.font = `11px ${th.font}`; ctx.textAlign = 'center'; ctx.fillText(g, L + gw * gi + gw / 2, H - B + 14);
    });
    ctx.textAlign = 'left'; ctx.fillStyle = th.ink; ctx.font = `600 11px ${th.font}`; ctx.fillText(spec.title || '', L, 14);
    if (spec.note) { ctx.fillStyle = th.ash; ctx.font = `9.5px ${th.font}`; ctx.fillText(spec.note, L, H - 17); }
    legend(ctx, spec.series, L, H, th); tooltip(canvas, hits);
  }

  /** heat map over the (mass, CoM) grid with the two chassis marked */
  function heat(canvas, spec) {
    const [ctx, W, H] = setup(canvas); const th = theme();
    const L = 50, R = 70, T = 24, B = 40; const pw = W - L - R, ph = H - T - B;
    ctx.fillStyle = th.panel; ctx.fillRect(0, 0, W, H);
    const xs = spec.x, ys = spec.y, Z = spec.z; const nx = xs.length, ny = ys.length; const cw = pw / nx, chh = ph / ny;
    let zmin = Infinity, zmax = -Infinity; for (const row of Z) for (const v of row) if (v !== null && v >= 0 && isFinite(v)) { zmin = Math.min(zmin, v); zmax = Math.max(zmax, v); }
    if (spec.zmax) zmax = spec.zmax;
    const ramp = (t) => { t = Math.max(0, Math.min(1, t)); const a = [42, 72, 178], b = [253, 231, 76]; const c = [228, 68, 42]; const m = t < 0.5 ? a.map((v, i) => v + (b[i] - v) * t * 2) : b.map((v, i) => v + (c[i] - v) * (t - 0.5) * 2); return `rgb(${m.map(Math.round).join(',')})`; };
    const hits = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = Z[j][i]; const x = L + i * cw, y = T + ph - (j + 1) * chh;
      ctx.fillStyle = (v === null || v < 0 || !isFinite(v)) ? '#8b8778' : ramp((v - zmin) / ((zmax - zmin) || 1)); ctx.fillRect(x, y, cw + 0.5, chh + 0.5);
      hits.push({ x: x + cw / 2, y: y + chh / 2, text: `${xs[i] * 1e3} g, ${(ys[j] * 100).toFixed(1)} cm: ${(v === null || v < 0) ? 'fell' : fmt(v)} ${spec.unit || ''}` });
    }
    ctx.fillStyle = th.ash; ctx.font = `10px ${th.mono}`; ctx.textAlign = 'center';
    xs.forEach((x, i) => { if (i % 2 === 0) ctx.fillText((x * 1e3).toFixed(0), L + (i + 0.5) * cw, H - B + 14); });
    ctx.textAlign = 'right'; ys.forEach((yv, j) => { if (j % 2 === 0) ctx.fillText((yv * 100).toFixed(0), L - 6, T + ph - (j + 0.5) * chh + 3); });
    ctx.fillStyle = th.ash; ctx.font = `10px ${th.font}`; ctx.textAlign = 'center'; ctx.fillText('structure mass [g]', L + pw / 2, H - B + 28);
    ctx.save(); ctx.translate(12, T + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('body CoM above the axle [cm]', 0, 0); ctx.restore();
    // colour bar
    for (let k = 0; k < 40; k++) { ctx.fillStyle = ramp(1 - k / 39); ctx.fillRect(W - R + 14, T + k * ph / 40, 12, ph / 40 + 0.5); }
    ctx.fillStyle = th.ash; ctx.font = `9px ${th.mono}`; ctx.textAlign = 'left'; ctx.fillText(fmt(zmax), W - R + 30, T + 8); ctx.fillText(fmt(zmin), W - R + 30, T + ph); ctx.fillText('grey = fell', W - R + 14, T + ph + 14);
    // the two chassis
    for (const [name, m, l] of [['generative', spec.marks.generative[0], spec.marks.generative[1]], ['conventional', spec.marks.conventional[0], spec.marks.conventional[1]]]) {
      const i = (m - xs[0]) / (xs[nx - 1] - xs[0]) * (nx - 1), j = (l - ys[0]) / (ys[ny - 1] - ys[0]) * (ny - 1);
      const px = L + (i + 0.5) * cw, py = T + ph - (j + 0.5) * chh;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 8, 0, 2 * Math.PI); ctx.fill(); ctx.fillStyle = COL[name]; ctx.beginPath(); ctx.arc(px, py, 5.5, 0, 2 * Math.PI); ctx.fill();
      hits.push({ x: px, y: py, text: `${name}: ${(m * 1e3).toFixed(0)} g, CoM ${(l * 100).toFixed(0)} cm` });
    }
    ctx.textAlign = 'left'; ctx.fillStyle = th.ink; ctx.font = `600 11px ${th.font}`; ctx.fillText(spec.title || '', L, 14);
    tooltip(canvas, hits);
  }

  let D = null;
  function drawAll() {
    if (!D) return; const q = (id) => document.getElementById(id);
    const M = D.main, E = D.edge, G = D.gain, DL = D.delay, TL = D.tilt;
    // the paper's table vs the re-run
    if (q('pl-paper')) bars(q('pl-paper'), { title: 'the paper (Simulink, their model): settling time [s], log scale', ylog: true, groups: ['pitch', 'roll'], note: 'Table 2 of the paper; peak top-point 0.092 m vs 0.356 m',
      series: [{ name: 'generative', color: COL.generative, values: [D.paper.ts_pitch[0], D.paper.ts_roll[0]] }, { name: 'conventional', color: COL.conventional, values: [D.paper.ts_pitch[1], D.paper.ts_roll[1]] }] });
    if (q('pl-rerun')) bars(q('pl-rerun'), { title: 'this re-run, the same gains on both: settling time [s]', groups: ['pitch', 'roll'], note: `peak top-point ${(M.generative.peak_top * 100).toFixed(1)} cm vs ${(M.conventional.peak_top * 100).toFixed(1)} cm · energy ${M.generative.energy.toFixed(1)} J vs ${M.conventional.energy.toFixed(1)} J`,
      series: [{ name: 'generative', color: COL.generative, values: [M.generative.ts_pitch, M.generative.ts_roll] }, { name: 'conventional', color: COL.conventional, values: [M.conventional.ts_pitch, M.conventional.ts_roll] }] });
    if (q('pl-edgebars')) bars(q('pl-edgebars'), { title: 'the same gains ×1.5: settling time [s]  (∞ = limit cycle)', groups: ['pitch settling', 'energy in 10 s [J]'], note: 'inside the generative chassis\' margin, outside the conventional one\'s',
      series: [{ name: 'generative', color: COL.generative, values: [E.generative.ts_pitch, E.generative.energy] }, { name: 'conventional', color: COL.conventional, values: [E.conventional.ts_pitch, E.conventional.energy] }], ylog: true });
    // time series
    const ser = (key, scale, src) => ['generative', 'conventional'].map(n => ({ name: n, color: COL[n], x: src[n].series.t, y: src[n].series[key].map(v => v * scale) }));
    if (q('pl-ts-pitch')) curves(q('pl-ts-pitch'), { title: 'pitch angle, 5° release, the paper\'s gains', xlabel: 'time [s]', ylabel: 'deg', series: ser('phi', DEG, M), xmax: 3, band: 0.25, ymin: -2, ymax: 6 });
    if (q('pl-ts-roll')) curves(q('pl-ts-roll'), { title: 'roll angle', xlabel: 'time [s]', ylabel: 'deg', series: ser('rho', DEG, M), xmax: 3, band: 0.25, ymin: -2, ymax: 6 });
    if (q('pl-ts-top')) curves(q('pl-ts-top'), { title: 'top-point displacement', xlabel: 'time [s]', ylabel: 'cm', series: ser('top', 100, M), xmax: 4, ymin: -1, ymax: 4 });
    if (q('pl-ts-power')) curves(q('pl-ts-power'), { title: 'electrical power, both motors', xlabel: 'time [s]', ylabel: 'W', series: ['generative', 'conventional'].map(n => ({ name: n, color: COL[n], x: M[n].series.t, y: M[n].series.p1.map((v, i) => v + M[n].series.p2[i]) })), xmax: 2, ymin: -20, ymax: 140 });
    if (q('pl-edge-top')) curves(q('pl-edge-top'), { title: 'gains ×1.5: top-point displacement', xlabel: 'time [s]', ylabel: 'cm', series: ser('top', 100, E), ymin: -6, ymax: 6 });
    if (q('pl-edge-u')) curves(q('pl-edge-u'), { title: 'gains ×1.5: drive voltage', xlabel: 'time [s]', ylabel: 'V', series: ser('u1', 1, E).map(s => ({ ...s, lw: 0.8 })), ymin: -12, ymax: 12 });
    // sweeps
    if (q('pl-gain')) curves(q('pl-gain'), { title: 'gain margin: pitch settling time as the gain set is scaled', xlabel: 'pitch / position gain scale', ylabel: 's (12 = never)', ylog: true, ymin: 0.3, ymax: 15, vline: [1, 'the paper\'s set'],
      series: ['generative', 'conventional'].map(n => ({ name: n, color: COL[n], marker: true, x: G[n].scale, y: G[n].ts_pitch.map(v => v === null ? 12 : v) })) });
    if (q('pl-gain-energy')) curves(q('pl-gain-energy'), { title: 'energy used in 12 s against the gain scale', xlabel: 'pitch / position gain scale', ylabel: 'J', ylog: true, ymin: 3, ymax: 1000, vline: [1, 'the paper\'s set'],
      series: ['generative', 'conventional'].map(n => ({ name: n, color: COL[n], marker: true, x: G[n].scale, y: G[n].energy })) });
    if (q('pl-delay')) curves(q('pl-delay'), { title: 'loop delay: peak top-point excursion (× = fell)', xlabel: 'delay [ms]', ylabel: 'cm', ylog: true, ymin: 1, ymax: 300,
      series: ['generative', 'conventional'].map(n => ({ name: n, color: COL[n], marker: true, x: DL[n].delay_ms, y: DL[n].peak_top.map((v, i) => DL[n].fell[i] ? null : Math.min(300, v * 100)), fell: DL[n].fell })) });
    if (q('pl-rate')) curves(q('pl-rate'), { title: 'control period: peak top-point excursion (× = fell)', xlabel: 'control period [ms]', ylabel: 'cm', ylog: true, ymin: 1, ymax: 300,
      series: ['generative', 'conventional'].map(n => ({ name: n, color: COL[n], marker: true, x: DL[n].rate_ms, y: DL[n].rate_peak_top.map((v, i) => DL[n].rate_fell[i] ? null : Math.min(300, v * 100)), fell: DL[n].rate_fell })) });
    if (q('pl-tilt')) curves(q('pl-tilt'), { title: 'initial tilt: energy to recover (× = fell)', xlabel: 'tilt on both axes [deg]', ylabel: 'J', ymin: 0, ymax: 30,
      series: ['generative', 'conventional'].map(n => ({ name: n, color: COL[n], marker: true, x: TL[n].tilt, y: TL[n].energy.map((v, i) => TL[n].fell[i] ? null : v), fell: TL[n].fell })) });
    if (q('pl-push')) curves(q('pl-push'), { title: 'push at t = 1 s: peak pitch afterwards (× = fell)', xlabel: 'push [rad/s on both axes]', ylabel: 'deg', ymin: 0, ymax: 3,
      series: ['generative', 'conventional'].map(n => ({ name: n, color: COL[n], marker: true, x: TL[n].push, y: TL[n].push_peak.map((v, i) => TL[n].push_fell[i] ? null : v * DEG), fell: TL[n].push_fell })) });
    // grid
    const gk = q('pl-grid-key') ? q('pl-grid-key').value : 'pole';
    if (q('pl-grid')) {
      const Gd = D.grid; const spec = { pole: [Gd.pole, 'unstable pitch pole [1/s]', '/s'], ts: [Gd.ts_pitch, 'settling time, 5° release [s]', 's'], energy: [Gd.energy, 'energy to recover [J]', 'J'], peak30: [Gd.peak30, 'peak excursion with 30 ms delay [cm]', 'cm'] }[gk];
      heat(q('pl-grid'), { title: spec[1], x: Gd.m_struct, y: Gd.l, z: spec[0], unit: spec[2], zmax: gk === 'peak30' ? 60 : undefined, marks: { generative: [D.meta.generative.m_struct, D.meta.generative.l], conventional: [D.meta.conventional.m_struct, D.meta.conventional.l] } });
    }
    // topology optimisation: mass vs safety factor
    if (q('pl-pareto')) {
      const T = D.topopt; const cols = { side_support: COL.generative, rw_support: COL.conventional, bottom_plate: COL.green };
      curves(q('pl-pareto'), { title: 'safety factor against mass along the volume-fraction sweep (Nylon PA12, 6 mm)', xlabel: 'mass of the part [g]', ylabel: 'safety factor', ylog: true, ymin: 1, ymax: 1000, hline: [2, 'design safety factor 2'],
        series: Object.keys(T).map(k => ({ name: k.replace('_', ' '), color: cols[k], marker: true, x: T[k].mass_g, y: T[k].safety })) });
    }
    // retuned
    if (q('pl-retuned')) bars(q('pl-retuned'), { title: 'each chassis retuned by LQR: settling time [s]', groups: ['pitch', 'roll'], note: 'same weights for both; the paper\'s structure of three loops kept',
      series: [{ name: 'generative', color: COL.generative, values: [D.retuned.generative.ts_pitch, D.retuned.generative.ts_roll] }, { name: 'conventional', color: COL.conventional, values: [D.retuned.conventional.ts_pitch, D.retuned.conventional.ts_roll] }] });
  }
  fetch('assets/data/unicycle_results.json').then(r => r.json()).then(d => { D = d; drawAll(); window.UNICYCLE_RESULTS = d; document.dispatchEvent(new CustomEvent('unicycle-results', { detail: d })); }).catch(e => console.warn('unicycle results', e));
  let rt = null; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawAll, 120); });
  new MutationObserver(() => drawAll()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('change', (e) => { if (e.target && e.target.id === 'pl-grid-key') drawAll(); });
  window.UNICYCLE_PLOTS = { curves, bars, heat, redraw: drawAll };
})();

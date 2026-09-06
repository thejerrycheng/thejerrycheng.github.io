/* =============================================================================
   aerohaptix_plots.js — canvas charts for the AeroHaptix page: the numbers the
   paper reports (read from its Fig. 7/8), and the simulated re-run
   (assets/data/aerohaptix_results.json). Hover for the values; redraws on theme
   changes. Colours: NA blue, FSC aqua, VSC orange (validated categorical set).
   ============================================================================= */
(function () {
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COL = { NA: '#2a78d6', FSC: '#1baf7a', VSC: '#eb6834', FWD: '#86b6ef', R: '#2a78d6', UP: '#0d366b', forward: '#2a78d6', right: '#eb6834', upward: '#1baf7a' };
  const PAPER = {
    collisions: { by_cond: { NA: [7.5, 1.1], FSC: [4.2, 0.6], VSC: [5.2, 0.8] }, by_dir: { FWD: [2.0, 0.4], R: [7.9, 1.0], UP: [7.0, 1.1] }, label: 'number of collisions', note: 'feedback F(2,22) = 8.10, p < 0.01 · direction F(2,22) = 15.65, p < 0.001' },
    distance: { by_cond: { NA: [61.0, 2.5], FSC: [65.5, 3.0], VSC: [61.5, 2.5] }, by_dir: { FWD: [58.0, 1.5], R: [67.5, 3.0], UP: [63.0, 2.0] }, label: 'total distance [m]', note: 'feedback F(2,22) = 3.59, p < 0.05 · direction F(2,22) = 17.87, p < 0.001' },
    disagreement: { by_cond: { NA: [3.55, 0.3], FSC: [2.8, 0.3], VSC: [2.0, 0.2] }, by_dir: { FWD: [2.9, 0.3], R: [2.6, 0.3], UP: [2.75, 0.3] }, label: 'input disagreement |u_ref − u_safe| [m/s²]', note: 'feedback F(2,22) = 4.80, p < 0.05 · VSC < NA, p < 0.01' },
    tlx: { by_cond: { 'physical demand': { NA: 20, FSC: 51, VSC: 27 }, 'effort': { NA: 47, FSC: 60, VSC: 45 }, 'overall task load': { NA: 33, FSC: 42, VSC: 35 }, 'haptic usefulness (Q4)': { NA: null, FSC: 57, VSC: 82 } }, label: 'NASA-TLX (0-100) and haptic usefulness', note: 'physical demand χ²(2) = 12.95, p < 0.01 · effort χ²(2) = 7.29, p < 0.05 · Q4 χ²(2) = 21.38, p < 0.001' },
    sa: { by_cond: { FSC: [1.15, 0.2], VSC: [1.55, 0.2] }, by_dir: { FWD: [1.1, 0.2], R: [1.3, 0.2], UP: [1.6, 0.2] }, label: 'haptic obstacles reported at the pop-up', note: 'feedback F(1,11) = 7.44, p < 0.05 (VSC > FSC)' },
  };

  function setup(canvas) {
    const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [ctx, r.width, r.height];
  }
  function theme() { return { ink: css('--ink') || '#151820', panel: css('--panel') || '#fdf6e2', ash: css('--ash') || '#8f8a7a', grid: 'rgba(128,128,128,.22)', font: '"Jost", sans-serif', mono: '"Space Mono", monospace' }; }

  /** grouped bars: groups = ['FWD','R','UP'], series = [{name, color, values:[[mean, sem],...]}] */
  function bars(canvas, spec) {
    const [ctx, W, H] = setup(canvas); const th = theme();
    const L = 46, R = 10, T = 26, B = 48; const pw = W - L - R, ph = H - T - B;
    ctx.fillStyle = th.panel; ctx.fillRect(0, 0, W, H);
    let ymax = spec.ymax || 0;
    if (!spec.ymax) for (const s of spec.series) for (const v of s.values) if (v && v[0] !== null) ymax = Math.max(ymax, v[0] + (v[1] || 0));
    ymax = niceMax(ymax * 1.1);
    const y = (v) => T + ph - v / ymax * ph;
    ctx.strokeStyle = th.grid; ctx.lineWidth = 1; ctx.font = `10px ${th.mono}`; ctx.fillStyle = th.ash; ctx.textAlign = 'right';
    const step = niceStep(ymax);
    for (let v = 0; v <= ymax + 1e-9; v += step) { ctx.beginPath(); ctx.moveTo(L, y(v)); ctx.lineTo(W - R, y(v)); ctx.stroke(); ctx.fillText(fmt(v), L - 6, y(v) + 3); }
    const ng = spec.groups.length, ns = spec.series.length, gw = pw / ng, bw = Math.min(34, gw * 0.7 / ns), hits = [];
    spec.groups.forEach((g, gi) => {
      const x0 = L + gw * gi + gw / 2 - bw * ns / 2;
      spec.series.forEach((s, si) => {
        const v = s.values[gi]; if (!v || v[0] === null || v[0] === undefined) return;
        const x = x0 + si * bw + 1, h = ph * v[0] / ymax;
        ctx.fillStyle = s.color; roundRect(ctx, x, y(v[0]), bw - 2, h, 3); ctx.fill();
        if (v[1]) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + (bw - 2) / 2, y(v[0] - v[1])); ctx.lineTo(x + (bw - 2) / 2, y(v[0] + v[1])); ctx.stroke(); }
        hits.push({ x, y: y(v[0]), w: bw - 2, h, text: `${s.name} · ${g}: ${v[0]}${v[1] ? ' ± ' + v[1] : ''}` });
      });
      ctx.fillStyle = th.ink; ctx.font = `11px ${th.font}`; ctx.textAlign = 'center'; ctx.fillText(g, L + gw * gi + gw / 2, H - B + 14);
    });
    ctx.textAlign = 'left'; ctx.fillStyle = th.ink; ctx.font = `600 11px ${th.font}`; ctx.fillText(spec.title || '', L, 14);
    let lx = L; ctx.font = `10px ${th.font}`;
    for (const s of spec.series) { ctx.fillStyle = s.color; ctx.fillRect(lx, H - 12, 10, 10); ctx.fillStyle = th.ash; ctx.fillText(s.name, lx + 14, H - 3); lx += 14 + ctx.measureText(s.name).width + 14; }
    if (spec.note) { ctx.fillStyle = th.ash; ctx.font = `9.5px ${th.font}`; ctx.textAlign = 'left'; ctx.fillText(spec.note, L, H - 17); }
    tooltip(canvas, hits);
  }
  /** lines: x = [..], series = [{name, color, values:[[mean, sem], ...]}] */
  function lines(canvas, spec) {
    const [ctx, W, H] = setup(canvas); const th = theme();
    const L = 46, R = 12, T = 26, B = 36; const pw = W - L - R, ph = H - T - B;
    ctx.fillStyle = th.panel; ctx.fillRect(0, 0, W, H);
    let ymax = 0; for (const s of spec.series) for (const v of s.values) if (v) ymax = Math.max(ymax, v[0] + (v[1] || 0));
    ymax = niceMax(ymax * 1.1);
    const xs = spec.x, xmin = spec.xlog ? Math.log(xs[0]) : xs[0], xmax = spec.xlog ? Math.log(xs[xs.length - 1]) : xs[xs.length - 1];
    const xp = (v) => L + ((spec.xlog ? Math.log(v) : v) - xmin) / ((xmax - xmin) || 1) * pw, yp = (v) => T + ph - v / ymax * ph;
    ctx.strokeStyle = th.grid; ctx.font = `10px ${th.mono}`; ctx.fillStyle = th.ash; ctx.textAlign = 'right';
    const step = niceStep(ymax);
    for (let v = 0; v <= ymax + 1e-9; v += step) { ctx.beginPath(); ctx.moveTo(L, yp(v)); ctx.lineTo(W - R, yp(v)); ctx.stroke(); ctx.fillText(fmt(v), L - 6, yp(v) + 3); }
    ctx.textAlign = 'center'; xs.forEach((x, i) => ctx.fillText(spec.xlabels ? spec.xlabels[i] : fmt(x), xp(x), H - B + 14));
    ctx.fillStyle = th.ink; ctx.font = `11px ${th.font}`; ctx.fillText(spec.xlabel || '', L + pw / 2, H - B + 28);
    const hits = [];
    for (const s of spec.series) {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath();
      s.values.forEach((v, i) => { if (!v) return; i === 0 ? ctx.moveTo(xp(xs[i]), yp(v[0])) : ctx.lineTo(xp(xs[i]), yp(v[0])); });
      ctx.stroke();
      s.values.forEach((v, i) => { if (!v) return; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(xp(xs[i]), yp(v[0]), 4, 0, 2 * Math.PI); ctx.fill(); ctx.strokeStyle = th.panel; ctx.lineWidth = 1.5; ctx.stroke();
        if (v[1]) { ctx.strokeStyle = s.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xp(xs[i]), yp(v[0] - v[1])); ctx.lineTo(xp(xs[i]), yp(v[0] + v[1])); ctx.stroke(); }
        hits.push({ x: xp(xs[i]) - 8, y: yp(v[0]) - 8, w: 16, h: 16, text: `${s.name} · ${spec.xlabels ? spec.xlabels[i] : xs[i]}: ${v[0]}${v[1] ? ' ± ' + v[1] : ''}` }); });
    }
    if (spec.hline) { ctx.setLineDash([4, 4]); ctx.strokeStyle = th.ash; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, yp(spec.hline[0])); ctx.lineTo(W - R, yp(spec.hline[0])); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = th.ash; ctx.font = `10px ${th.font}`; ctx.textAlign = 'right'; ctx.fillText(spec.hline[1], W - R, yp(spec.hline[0]) - 4); }
    ctx.textAlign = 'left'; ctx.fillStyle = th.ink; ctx.font = `600 11px ${th.font}`; ctx.fillText(spec.title || '', L, 14);
    let lx = L; ctx.font = `10px ${th.font}`;
    for (const s of spec.series) { ctx.fillStyle = s.color; ctx.fillRect(lx, H - 12, 10, 10); ctx.fillStyle = th.ash; ctx.fillText(s.name, lx + 14, H - 3); lx += 14 + ctx.measureText(s.name).width + 14; }
    tooltip(canvas, hits);
  }
  function tooltip(canvas, hits) {
    let tip = canvas.parentElement.querySelector('.plot-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'plot-tip'; tip.hidden = true; canvas.parentElement.style.position = 'relative'; canvas.parentElement.appendChild(tip); }
    canvas.onpointermove = (e) => { const r = canvas.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; const h = hits.find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h); if (h) { tip.hidden = false; tip.textContent = h.text; tip.style.left = (x + 12) + 'px'; tip.style.top = (y - 10) + 'px'; } else tip.hidden = true; };
    canvas.onpointerleave = () => { tip.hidden = true; };
  }
  function roundRect(ctx, x, y, w, h, r) { r = Math.min(r, h / 2, w / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; const n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10; return n * p; }
  function niceStep(v) { return niceMax(v / 4.5); }
  function fmt(v) { return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? (Math.round(v * 10) / 10).toString() : (Math.round(v * 100) / 100).toString(); }

  let SIM = null;
  function drawAll() {
    const q = (id) => document.getElementById(id);
    /* the paper */
    for (const key of ['collisions', 'distance', 'disagreement']) {
      const c = q('paper-' + key); if (!c) continue;
      const p = PAPER[key];
      bars(c, { title: p.label, groups: ['NA', 'FSC', 'VSC', '', 'FWD', 'R', 'UP'], note: p.note,
        series: [{ name: 'by feedback condition', color: COL.NA, values: [p.by_cond.NA, p.by_cond.FSC, p.by_cond.VSC, null, null, null, null] }, { name: 'by flying direction', color: COL.VSC, values: [null, null, null, null, p.by_dir.FWD, p.by_dir.R, p.by_dir.UP] }] });
    }
    if (q('paper-tlx')) {
      const t = PAPER.tlx; const groups = Object.keys(t.by_cond);
      bars(q('paper-tlx'), { title: t.label, groups, note: t.note, ymax: 100, series: ['NA', 'FSC', 'VSC'].map(c => ({ name: c, color: COL[c], values: groups.map(g => t.by_cond[g][c] === null ? null : [t.by_cond[g][c], 0]) })) });
    }
    if (q('paper-sa')) {
      const p = PAPER.sa;
      bars(q('paper-sa'), { title: p.label, groups: ['FSC', 'VSC', '', 'FWD', 'R', 'UP'], note: p.note, series: [{ name: 'by feedback', color: COL.NA, values: [p.by_cond.FSC, p.by_cond.VSC, null, null, null, null] }, { name: 'by direction', color: COL.VSC, values: [null, null, null, p.by_dir.FWD, p.by_dir.R, p.by_dir.UP] }] });
    }
    /* the re-run */
    if (!SIM) return;
    const dirs = ['forward', 'right', 'upward'], dl = ['FWD', 'R', 'UP'];
    for (const [key, label] of [['collisions', 'collisions per flight'], ['distance', 'distance travelled [m]'], ['disagreement', 'input disagreement |u_ref − u_safe| [m/s²]'], ['time', 'flight time [s]']]) {
      const c = q('sim-' + key); if (!c || !SIM.main) continue;
      bars(c, { title: label, groups: dl, note: `${SIM.n_tunnels} tunnels per direction, mean ± SEM`, series: ['NA', 'VSC'].map(cond => ({ name: cond, color: COL[cond], values: dirs.map(d => SIM.main[cond][d][key]) })) });
    }
    if (q('sim-layout') && SIM.layout) {
      const names = ['ring8', 'ring16', 'paper32', 'grid48', 'fib96', 'continuous'], xl = ['8', '16', '32 (paper)', '48', '96', 'exact'];
      lines(q('sim-layout'), { title: 'collisions per flight vs number of actuators (VSC)', x: [0, 1, 2, 3, 4, 5], xlabels: xl, xlabel: 'actuators in the layout', series: dirs.map(d => ({ name: d, color: COL[d], values: names.map(n => SIM.layout[d][n].collisions) })) });
      if (q('sim-layout-err')) lines(q('sim-layout-err'), { title: 'angular error between the obstacle direction and the actuator that fired [deg]', x: [0, 1, 2, 3, 4, 5], xlabels: xl, xlabel: 'actuators in the layout', series: dirs.map(d => ({ name: d, color: COL[d], values: names.map(n => SIM.layout[d][n].cue_err_deg) })) });
    }
    if (q('sim-gain') && SIM.gain_delay) {
      const taus = Object.keys(SIM.gain_delay['3']).map(Number).sort((a, b) => a - b);
      lines(q('sim-gain'), { title: 'collisions per flight vs the operator\'s reaction delay to a cue', x: taus, xlabel: 'reaction delay τ_h [s]', hline: SIM.main ? [SIM.main.NA.all.collisions[0], 'no feedback'] : null,
        series: [['1', '#86b6ef'], ['3', '#2a78d6'], ['6', '#0d366b']].map(([k, col]) => ({ name: `K_v = ${k}` + (k === '3' ? ' (paper)' : ''), color: col, values: taus.map(t => SIM.gain_delay[k][t].collisions) })) });
    }
    if (q('sim-cbf') && SIM.cbf) {
      const ks = Object.keys(SIM.cbf['0.717']).map(Number).sort((a, b) => a - b);
      lines(q('sim-cbf'), { title: 'collisions per flight vs the barrier gains k₁ = k₂', x: ks, xlog: true, xlabel: 'ECBF gain', series: [['0.3', '#86b6ef'], ['0.717', '#2a78d6'], ['1.2', '#0d366b']].map(([p, col]) => ({ name: `padding ${p} m` + (p === '0.717' ? ' (paper)' : ''), color: col, values: ks.map(k => SIM.cbf[p][k].collisions) })) });
      if (q('sim-cbf-cue')) lines(q('sim-cbf-cue'), { title: 'fraction of frames with a cue', x: ks, xlog: true, xlabel: 'ECBF gain', series: [['0.3', '#86b6ef'], ['0.717', '#2a78d6'], ['1.2', '#0d366b']].map(([p, col]) => ({ name: `padding ${p} m`, color: col, values: ks.map(k => SIM.cbf[p][k].cue_frac) })) });
    }
    if (q('sim-fov') && SIM.fov) {
      const fovs = Object.keys(SIM.fov.forward.NA).map(Number).sort((a, b) => a - b);
      lines(q('sim-fov'), { title: 'collisions per flight vs the camera field of view', x: fovs, xlabel: 'horizontal field of view [deg]', series: [].concat(...dirs.map(d => ['NA', 'VSC'].map(c => ({ name: `${dl[dirs.indexOf(d)]} ${c}`, color: c === 'NA' ? COL[d] : COL[d] + '88', values: fovs.map(f => SIM.fov[d][c][f]) })))) });
    }
  }
  fetch('assets/data/aerohaptix_results.json').then(r => r.ok ? r.json() : null).then(j => { SIM = j; drawAll(); }).catch(() => drawAll());
  drawAll();
  new MutationObserver(drawAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawAll, 150); });
  window.AH_PLOTS = { drawAll };
})();

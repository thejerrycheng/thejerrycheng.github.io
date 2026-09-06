/* =============================================================================
   locomotion_plots.js — canvas charts of the balance-lab study on the locomotion
   page (assets/data/locomotion_results.json, from experiments/make_figures.py).
   Reuses the plotting kit of the unicycle page (window.UNICYCLE_PLOTS) when it
   is loaded; otherwise defines the same helpers.
   ============================================================================= */
(function () {
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function setup(canvas) { const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return [ctx, r.width, r.height]; }
  function theme() { return { ink: css('--ink') || '#151820', panel: css('--panel') || '#fdf6e2', ash: css('--ash') || '#8f8a7a', grid: 'rgba(128,128,128,.22)', font: '"Jost", sans-serif', mono: '"Space Mono", monospace' }; }
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; const n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10; return n * p; }
  function fmt(v) { if (v === null || v === undefined || !isFinite(v)) return '—'; return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? (Math.round(v * 10) / 10).toString() : (Math.round(v * 100) / 100).toString(); }
  function tooltip(canvas, hits) {
    let tip = canvas.parentElement.querySelector('.plot-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'plot-tip'; tip.hidden = true; canvas.parentElement.style.position = 'relative'; canvas.parentElement.appendChild(tip); }
    canvas.onpointermove = (e) => { const r = canvas.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; let best = null, bd = 14; for (const h of hits) { const d = Math.hypot(x - h.x, y - h.y); if (d < bd) { bd = d; best = h; } } if (best) { tip.hidden = false; tip.textContent = best.text; tip.style.left = (x + 12) + 'px'; tip.style.top = (y - 10) + 'px'; } else tip.hidden = true; };
    canvas.onpointerleave = () => { tip.hidden = true; };
  }
  function legend(ctx, series, L, H, th) { let lx = L; ctx.font = `10px ${th.font}`; for (const s of series) { ctx.fillStyle = s.color; ctx.fillRect(lx, H - 12, 10, 10); ctx.fillStyle = th.ash; ctx.textAlign = 'left'; ctx.fillText(s.name, lx + 14, H - 3); lx += 14 + ctx.measureText(s.name).width + 14; } }
  function curves(canvas, spec) {
    const [ctx, W, H] = setup(canvas); const th = theme();
    const L = 50, R = 12, T = 24, B = 44; const pw = W - L - R, ph = H - T - B;
    ctx.fillStyle = th.panel; ctx.fillRect(0, 0, W, H);
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const s of spec.series) s.x.forEach((x, i) => { const y = s.y[i]; if (y === null || !isFinite(y)) return; xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); });
    if (spec.xmin !== undefined) xmin = spec.xmin; if (spec.xmax !== undefined) xmax = spec.xmax;
    ymax = spec.ymax ?? niceMax(ymax * 1.08); ymin = spec.ymin ?? (ymin < 0 ? -niceMax(-ymin * 1.08) : 0);
    const xp = (x) => L + (x - xmin) / ((xmax - xmin) || 1) * pw, yp = (y) => T + ph - (y - ymin) / ((ymax - ymin) || 1) * ph;
    ctx.strokeStyle = th.grid; ctx.lineWidth = 1; ctx.font = `10px ${th.mono}`; ctx.fillStyle = th.ash; ctx.textAlign = 'right';
    const step = niceMax((ymax - ymin) / 4.5); for (let v = Math.ceil(ymin / step) * step; v <= ymax + 1e-9; v += step) { ctx.beginPath(); ctx.moveTo(L, yp(v)); ctx.lineTo(W - R, yp(v)); ctx.stroke(); ctx.fillText(fmt(v), L - 6, yp(v) + 3); }
    const xs = niceMax((xmax - xmin) / 6); ctx.textAlign = 'center'; for (let v = Math.ceil(xmin / xs) * xs; v <= xmax + 1e-9; v += xs) { ctx.beginPath(); ctx.moveTo(xp(v), T); ctx.lineTo(xp(v), T + ph); ctx.stroke(); ctx.fillText(fmt(v), xp(v), H - B + 14); }
    if (spec.vline) { ctx.setLineDash([4, 4]); ctx.strokeStyle = th.ash; ctx.beginPath(); ctx.moveTo(xp(spec.vline[0]), T); ctx.lineTo(xp(spec.vline[0]), T + ph); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = th.ash; ctx.font = `10px ${th.font}`; ctx.textAlign = 'left'; ctx.fillText(spec.vline[1], xp(spec.vline[0]) + 4, T + 12); }
    if (spec.hline) { ctx.setLineDash([4, 4]); ctx.strokeStyle = th.ash; ctx.beginPath(); ctx.moveTo(L, yp(spec.hline[0])); ctx.lineTo(W - R, yp(spec.hline[0])); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = th.ash; ctx.font = `10px ${th.font}`; ctx.textAlign = 'right'; ctx.fillText(spec.hline[1], W - R, yp(spec.hline[0]) - 4); }
    if (spec.vlines) for (const [xv, lab] of spec.vlines) { ctx.setLineDash([2, 3]); ctx.strokeStyle = '#D9A13F'; ctx.beginPath(); ctx.moveTo(xp(xv), T); ctx.lineTo(xp(xv), T + ph); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = th.ash; ctx.font = `9px ${th.mono}`; ctx.textAlign = 'center'; ctx.fillText(lab, xp(xv), T + 10); }
    const hits = [];
    for (const s of spec.series) {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.lw || 1.8; ctx.beginPath(); let pen = false;
      s.x.forEach((x, i) => { const y = s.y[i]; if (y === null || !isFinite(y)) { pen = false; return; } const px = xp(x), py = Math.max(T, Math.min(T + ph, yp(y))); pen ? ctx.lineTo(px, py) : ctx.moveTo(px, py); pen = true; });
      ctx.stroke();
      if (s.marker) s.x.forEach((x, i) => { const y = s.y[i]; if (y === null || !isFinite(y)) return; const px = xp(x), py = Math.max(T, Math.min(T + ph, yp(y))); ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(px, py, 3.2, 0, 2 * Math.PI); ctx.fill(); hits.push({ x: px, y: py, text: `${s.name} · ${spec.xlabel || 'x'} ${fmt(x)}: ${fmt(y)}` }); });
      else { const n = s.x.length; for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 80))) { const y = s.y[i]; if (y === null || !isFinite(y)) continue; hits.push({ x: xp(s.x[i]), y: Math.max(T, Math.min(T + ph, yp(y))), text: `${s.name} · ${fmt(s.x[i])}: ${fmt(y)}` }); } }
    }
    ctx.textAlign = 'left'; ctx.fillStyle = th.ink; ctx.font = `600 11px ${th.font}`; ctx.fillText(spec.title || '', L, 14);
    ctx.fillStyle = th.ash; ctx.font = `10px ${th.font}`; ctx.textAlign = 'center'; ctx.fillText(spec.xlabel || '', L + pw / 2, H - B + 28);
    ctx.save(); ctx.translate(12, T + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(spec.ylabel || '', 0, 0); ctx.restore();
    legend(ctx, spec.series, L, H, th); tooltip(canvas, hits);
  }

  let D = null;
  function drawAll() {
    if (!D) return; const q = (id) => document.getElementById(id); const C = D.controllers, LAB = D.labels, COL = D.colors;
    const ser = (key, f) => C.map(n => ({ name: LAB[n], color: COL[n], marker: true, ...f(D[key][n]) }));
    if (q('lp-push')) curves(q('lp-push'), { title: 'forward push at 2 s: survival [%]', xlabel: 'push [m/s]', ylabel: '%', ymin: 0, ymax: 105, series: ser('push', d => ({ x: d.mag, y: d.survive.map(v => 100 * v) })) });
    if (q('lp-push-back')) curves(q('lp-push-back'), { title: 'backward push: survival [%]', xlabel: 'push [m/s]', ylabel: '%', ymin: 0, ymax: 105, series: ser('push', d => ({ x: d.mag_back, y: d.survive_back.map(v => 100 * v) })) });
    if (q('lp-rec')) curves(q('lp-rec'), { title: 'recovery time after a forward push [s]', xlabel: 'push [m/s]', ylabel: 's', ymin: 0, ymax: 3, series: ser('push', d => ({ x: d.mag, y: d.rec_t })) });
    if (q('lp-mismatch')) curves(q('lp-mismatch'), { title: 'wrong CoM height, random pushes: falls in 10 s [%]', xlabel: 'true CoM height [m]  (the model says 0.8)', ylabel: '%', ymin: 0, ymax: 105, vline: [0.8, 'nominal'], series: ser('mismatch', d => ({ x: d.z0, y: d.fall.map(v => 100 * v) })) });
    if (q('lp-mismatch-v')) curves(q('lp-mismatch-v'), { title: 'wrong CoM height: velocity tracking error [m/s]', xlabel: 'true CoM height [m]', ylabel: 'm/s', ymin: 0, ymax: 1, vline: [0.8, 'nominal'], series: ser('mismatch', d => ({ x: d.z0, y: d.rms_verr })) });
    if (q('lp-noise')) curves(q('lp-noise'), { title: 'velocity noise (10 ms delay): falls in 10 s [%]', xlabel: 'σ of the measured velocity [m/s]', ylabel: '%', ymin: 0, ymax: 105, series: ser('noise', d => ({ x: d.sigma, y: d.fall.map(v => 100 * v) })) });
    if (q('lp-noise-d3')) curves(q('lp-noise-d3'), { title: 'velocity noise with 30 ms delay: falls [%]', xlabel: 'σ [m/s]', ylabel: '%', ymin: 0, ymax: 105, series: ser('noise', d => ({ x: d.sigma_d3, y: d.fall_d3.map(v => 100 * v) })) });
    if (q('lp-velocity')) curves(q('lp-velocity'), { title: 'velocity tracking with gentle pushes: RMS error [m/s]', xlabel: 'commanded velocity [m/s]', ylabel: 'm/s', ymin: 0, ymax: 0.6, series: ser('velocity', d => ({ x: d.v_des, y: d.rms_verr })) });
    if (q('lp-episode')) curves(q('lp-episode'), { title: 'one episode, the same five pushes: CoM velocity [m/s]', xlabel: 'time [s]', ylabel: 'm/s', ymin: -1, ymax: 2.2, hline: [0.5, 'commanded'], vlines: D.pushes.map(([t, dv]) => [t, (dv > 0 ? '+' : '') + dv]),
      series: C.map(n => { const e = D.episode[n]; return { name: LAB[n] + (e.fell ? ` (fell ${e.fall_t.toFixed(1)} s)` : ''), color: COL[n], x: e.v.map((_, i) => i * e.dt), y: e.v }; }) });
    if (q('lp-episode-z06')) curves(q('lp-episode-z06'), { title: 'the same episode on a 0.6 m CoM (model: 0.8 m)', xlabel: 'time [s]', ylabel: 'm/s', ymin: -1, ymax: 2.2, hline: [0.5, 'commanded'], vlines: D.pushes.map(([t, dv]) => [t, (dv > 0 ? '+' : '') + dv]),
      series: C.map(n => { const e = D.episode[n + '_z06']; return { name: LAB[n] + (e.fell ? ` (fell ${e.fall_t.toFixed(1)} s)` : ''), color: COL[n], x: e.v.map((_, i) => i * e.dt), y: e.v }; }) });
    if (q('lp-training') && D.training) curves(q('lp-training'), { title: 'PPO: reward per second of walking', xlabel: 'iteration (512 walkers × 48 ticks)', ylabel: 'reward / s', ymin: -6, ymax: 1.2, series: Object.keys(D.training).map(k => ({ name: LAB['learned_' + k], color: COL['learned_' + k], x: D.training[k].it, y: D.training[k].reward })) });
    if (q('lp-training-falls') && D.training) curves(q('lp-training-falls'), { title: 'falls per second during training', xlabel: 'iteration', ylabel: 'falls / s', ymin: 0, ymax: 1.2, series: Object.keys(D.training).map(k => ({ name: LAB['learned_' + k], color: COL['learned_' + k], x: D.training[k].it, y: D.training[k].falls })) });
  }
  fetch('assets/data/locomotion_results.json').then(r => r.json()).then(d => { D = d; drawAll(); window.LOCO_RESULTS = d; }).catch(e => console.warn('locomotion results', e));
  let rt = null; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawAll, 120); });
  new MutationObserver(() => drawAll()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();

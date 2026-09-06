/* =============================================================================
   geodex_runs.js — the recorded policy rollouts on the GeoDEX page:
   1. clip galleries (one to five fruits; disturbances) built from
      assets/data/geodex_runs.json (written by build_geodex_runs.py);
   2. the placement window: drop fruits on a top-down map of the table, the
      page finds the recorded episode whose initial layout is closest and plays
      it, drawing the recorded layout and what happened.
   ============================================================================= */
const FRUIT_COL = { apple: '#c62d1f', orange: '#e58a2c' };
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const X_RANGE = [-0.20, 0.20], Y_RANGE = [0.15, 0.55], PLATE = [0.0, 0.70, 0.12];

function card(run, base) {
  const fruits = run.active.map(f => f.replace('_j', '').replace(/\d+$/, '')).map(n => `<i style="background:${FRUIT_COL[n] || '#999'}"></i>`).join('');
  const left = run.active.length;                        // a removed fruit leaves the table for good
  const status = run.removed && left === 0 ? '<span class="gd-bad">the only fruit was taken away — nothing left to place</span>'
    : run.success ? `<span class="gd-ok">${left === run.k ? `all ${left}` : `the remaining ${left}`} on the plate</span>`
    : `<span class="gd-bad">${run.placed} of ${left} on the plate</span>`;
  const dist = run.kind ? `<span class="caption-box" style="margin:0 0 6px">${run.kind.toUpperCase()}</span>` : '';
  const rec = run.recovered != null ? ` · re-grasped ${run.recovered.toFixed(1)} s after the disturbance` : (run.disturbed && !run.success ? ' · never recovered' : '');
  return `<div class="card"><video muted loop playsinline preload="metadata" controls poster="${base}${run.name}.jpg"><source src="${base}${run.name}.mp4" type="video/mp4"></video>
    <div class="body">${dist}<h3>${run.title}</h3><p>${fruits} ${status} · ${run.t_end.toFixed(1)} s of simulation${run.video && run.video.speed > 1 ? `, played at ${run.video.speed}\u00d7` : ''}${rec}</p></div></div>`;
}

/** successes first, then the partial runs that were kept, up to n clips */
function pick(runs, n) {
  const withVid = runs.filter(r => r.has_video);
  return [...withVid.filter(r => r.success), ...withVid.filter(r => !r.success).sort((a, b) => (b.placed - a.placed) || (a.t_end - b.t_end))].slice(0, n);
}

export async function initRuns(ui) {
  const idx = await (await fetch('assets/data/geodex_runs.json')).json();
  const base = idx.base || 'assets/videos/geodex_runs/';
  const fruitsRuns = idx.runs.filter(r => r.mode === 'fruits'), distRuns = idx.runs.filter(r => r.mode === 'disturb');
  // galleries
  const counts = [...new Set(fruitsRuns.map(r => r.k))].sort();
  ui.fruitsGallery.innerHTML = counts.map(k => {
    const rs = pick(fruitsRuns.filter(r => r.k === k), ui.perCount || 3);
    const st = idx.stats.fruits[k] || {};
    const tally = st.success ? `${st.success} of ${st.n} episodes cleared the table (${(st.rate * 100).toFixed(0)} %)${st.mean_t ? `, ${st.mean_t.toFixed(1)} s when it did` : ''}` : `0 of ${st.n} episodes cleared the table`;
    const part = `; ${st.fruits_placed}/${st.fruits_total} individual fruits placed`;
    return `<h3 class="gd-count">${k} fruit${k > 1 ? 's' : ''} on the table <small>${tally}${part}</small></h3><div class="clip-grid three">${rs.map(r => card(r, base)).join('')}</div>`;
  }).join('');
  const dv = distRuns.filter(r => r.has_video);
  ui.distGallery.innerHTML = dv.length ? `<div class="clip-grid three">${dv.slice(0, 12).map(r => card(r, base)).join('')}</div>`
    : '<p class="plot-note">The disturbance episodes are still being recorded.</p>';
  const st = idx.stats.disturb || {};
  ui.distStats.innerHTML = Object.keys(st).map(kind => `<div class="card stat-tile"><div class="num">${st[kind].recovered}<small>/${st[kind].n}</small></div><div class="lab">${kind}</div><div class="sub">${st[kind].desc}${st[kind].mean_recover ? ` &middot; ${st[kind].mean_recover.toFixed(1)} s to re-grasp` : ''}</div></div>`).join('');
  // autoplay muted clips in view
  const io = new IntersectionObserver((es) => es.forEach(e => { const v = e.target; if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }), { threshold: 0.25 });
  document.querySelectorAll('#runs video, #disturb video').forEach(v => io.observe(v));
  initPlacement(ui, idx, base);
}

/* ---------------------------------------------------------------- the placement window */
function initPlacement(ui, idx, base) {
  const cv = ui.map, ctx = cv.getContext('2d'); let fruits = []; let chosen = null;
  const runs = idx.runs.filter(r => r.mode === 'fruits');
  const M = () => { const r = cv.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); } ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return [r.width, r.height]; };
  // table map: x across (-0.35..0.35), y towards the plate (0.05..0.85); the robot base at (0,0) at the bottom
  const XR = [-0.38, 0.38], YR = [-0.05, 0.90];
  const toPx = (x, y, W, H) => [(x - XR[0]) / (XR[1] - XR[0]) * W, H - (y - YR[0]) / (YR[1] - YR[0]) * H];
  const toWorld = (px, py, W, H) => [XR[0] + px / W * (XR[1] - XR[0]), YR[0] + (H - py) / H * (YR[1] - YR[0])];
  function draw() {
    const [W, H] = M(); const ink = css('--ink') || '#151820', ash = css('--ash') || '#8f8a7a';
    ctx.fillStyle = css('--panel') || '#fdf6e2'; ctx.fillRect(0, 0, W, H);
    // the table top, in plan
    const [tx0, ty0] = toPx(-0.34, 0.86, W, H), [tx1, ty1] = toPx(0.34, 0.02, W, H);
    ctx.fillStyle = 'rgba(196,146,74,.20)'; ctx.fillRect(tx0, ty0, tx1 - tx0, ty1 - ty0);
    ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.strokeRect(tx0, ty0, tx1 - tx0, ty1 - ty0);
    ctx.strokeStyle = 'rgba(196,146,74,.35)'; ctx.lineWidth = 1;                       // 10 cm grid
    for (let x = -0.3; x <= 0.31; x += 0.1) { const [px] = toPx(x, 0, W, H); ctx.beginPath(); ctx.moveTo(px, ty0); ctx.lineTo(px, ty1); ctx.stroke(); }
    for (let y = 0.1; y <= 0.85; y += 0.1) { const [, py] = toPx(0, y, W, H); ctx.beginPath(); ctx.moveTo(tx0, py); ctx.lineTo(tx1, py); ctx.stroke(); }
    // where the policy was trained to find fruit
    const [sx0, sy0] = toPx(X_RANGE[0], Y_RANGE[1], W, H), [sx1, sy1] = toPx(X_RANGE[1], Y_RANGE[0], W, H);
    ctx.setLineDash([5, 4]); ctx.strokeStyle = ash; ctx.lineWidth = 1.3; ctx.strokeRect(sx0, sy0, sx1 - sx0, sy1 - sy0); ctx.setLineDash([]);
    ctx.fillStyle = ash; ctx.font = '10px "Space Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText('where fruit was spawned in training', (sx0 + sx1) / 2, sy1 - 6);
    // the plate
    const [px, py] = toPx(PLATE[0], PLATE[1], W, H); const pr = PLATE[2] / (XR[1] - XR[0]) * W;
    ctx.fillStyle = '#f4efe4'; ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, pr, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ash; ctx.font = '11px Jost, sans-serif'; ctx.fillText('plate', px, py + 4);
    // the arm's base
    const [bx, by] = toPx(0, 0.0, W, H); ctx.fillStyle = ink; ctx.beginPath(); ctx.roundRect(bx - 26, by - 7, 52, 14, 4); ctx.fill();
    ctx.fillStyle = css('--panel') || '#fdf6e2'; ctx.font = '9px "Space Mono", monospace'; ctx.fillText('xArm', bx, by + 3.5);
    ctx.fillStyle = ash; ctx.textAlign = 'left';
    // the recorded layout the page matched (hollow) under the user's fruits (solid)
    if (chosen) for (const f of chosen.active) { const p = chosen.poses[f]; const [x, y] = toPx(p[0], p[1], W, H); ctx.strokeStyle = FRUIT_COL[f.replace('_j', '').replace(/\d+$/, '')]; ctx.lineWidth = 2.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(x, y, 13, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]); }
    fruits.forEach((f, i) => { const [x, y] = toPx(f[0], f[1], W, H); ctx.fillStyle = i % 2 ? FRUIT_COL.orange : FRUIT_COL.apple; ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 11, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Jost, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x, y + 4); ctx.textAlign = 'left'; });
  }
  function match() {
    if (!fruits.length) { chosen = null; ui.placeOut.textContent = 'Drop one to five fruits on the table.'; ui.placeVideo.hidden = true; draw(); return; }
    const k = fruits.length; const cands = runs.filter(r => r.k === k); if (!cands.length) { ui.placeOut.textContent = `No recorded episode with ${k} fruits.`; return; }
    // greedy nearest-neighbour assignment between the user's fruits and each episode's initial layout
    let best = null, bd = Infinity;
    for (const r of cands) {
      const pts = r.active.map(f => r.poses[f].slice(0, 2)); let d = 0; const used = new Set();
      for (const f of fruits) { let bi = -1, bb = Infinity; pts.forEach((p, i) => { if (used.has(i)) return; const dd = Math.hypot(p[0] - f[0], p[1] - f[1]); if (dd < bb) { bb = dd; bi = i; } }); used.add(bi); d += bb; }
      d /= k; if (d < bd) { bd = d; best = r; }
    }
    chosen = best; draw();
    ui.placeOut.innerHTML = `Closest recorded layout: <b>${best.title}</b> (mean fruit offset ${(bd * 100).toFixed(0)} cm from where you put them). Outcome: ${best.success ? `<span class="gd-ok">all ${k} fruits placed in ${best.t_end.toFixed(1)} s</span>` : `<span class="gd-bad">${best.events.filter(e => e.what === 'placed').length}/${k} placed before the time limit</span>`}. Dashed rings show the recorded layout.`;
    ui.placeVideo.hidden = false; ui.placeVideo.poster = base + best.name + '.jpg'; ui.placeVideo.src = base + best.name + '.mp4'; ui.placeVideo.load(); ui.placeVideo.play().catch(() => {});
  }
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect(); const [W, H] = [r.width, r.height]; const [x, y] = toWorld(e.clientX - r.left, e.clientY - r.top, W, H);
    // click near an existing fruit removes it; otherwise add (max 5)
    const hit = fruits.findIndex(f => Math.hypot(f[0] - x, f[1] - y) < 0.035);
    if (hit >= 0) fruits.splice(hit, 1); else if (fruits.length < 5) fruits.push([x, y]);
    match();
  });
  const randomLayout = (k) => { fruits = []; let tries = 0; while (fruits.length < k && tries++ < 500) { const p = [X_RANGE[0] + Math.random() * (X_RANGE[1] - X_RANGE[0]), Y_RANGE[0] + Math.random() * (Y_RANGE[1] - Y_RANGE[0])]; if (fruits.every(f => Math.hypot(f[0] - p[0], f[1] - p[1]) > 0.17) && Math.hypot(p[0] - PLATE[0], p[1] - PLATE[1]) > 0.2) fruits.push(p); } match(); };
  ui.placeClear.addEventListener('click', () => { fruits = []; match(); });
  ui.placeRandom.addEventListener('click', () => randomLayout(1 + Math.floor(Math.random() * 4)));
  new ResizeObserver(draw).observe(cv); new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  randomLayout(2);                       /* start on something rather than an empty table */
  ui.placeVideo.pause();
}

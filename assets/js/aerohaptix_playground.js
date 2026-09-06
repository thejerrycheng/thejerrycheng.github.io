/* =============================================================================
   aerohaptix_playground.js — the barrier playground: a top view with draggable
   obstacles, a draggable drone, its velocity and the operator's stick; the input
   plane with every in-range half-space A·u + b >= 0, u_ref, the global safe
   input (QP) and every per-obstacle local safe input; the horizontal ring of
   actuators that MultiCBF would drive. All maths from aerohaptix_cbf.js.
   ============================================================================= */
import { SuperEllipsoid, Cylinder, localSafe, globalSafe, renderCues, makeLayout, V, PARAMS } from './aerohaptix_cbf.js';

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const KIND = { cube: '#4cc061', sphere: '#3fb7d0', cylinder: '#b7c93a' };
const SCEN = {
  corridor: { q: [1.5, 0, 0], v: [2.0, 0, 0], stick: [3.0, 0, 0], obs: [['cube', [8, 1.3, 0], 1.6], ['sphere', [12, -1.6, 0], 1.4], ['cylinder', [16.5, 0.8, 0], 1.2], ['cube', [21, -0.4, 0], 1.3]] },
  gate: { q: [2, 0, 0], v: [2.5, 0, 0], stick: [3.5, 0, 0], obs: [['cube', [10, 2.2, 0], 1.8], ['cube', [10, -2.2, 0], 1.8], ['sphere', [17, 0, 0], 1.2]] },
  wall: { q: [2, -1, 0], v: [1.5, 0.8, 0], stick: [2.0, 1.5, 0], obs: [['cylinder', [9, 0, 0], 1.0], ['cylinder', [9, 2.4, 0], 1.0], ['cylinder', [9, -2.4, 0], 1.0], ['sphere', [15, 1.5, 0], 1.6]] },
};

export function initPlayground(root, layoutJson) {
  const layout = makeLayout(layoutJson);
  const ring = layout.dirs.map((d, i) => ({ i, d })).filter(o => Math.abs(o.d[2]) < 1e-6);   /* the 8 horizontal actuators */
  const cw = root.querySelector('#pg-world'), cu = root.querySelector('#pg-uspace'), cr = root.querySelector('#pg-ring');
  const readout = root.querySelector('#pg-readout'), sel = root.querySelector('#pg-scenario');
  const chk = (id) => root.querySelector(id);
  const st = { obs: [], q: [0, 0, 0], v: [0, 0, 0], stick: [0, 0, 0], drag: null, path: null, anim: false, tAnim: 0 };
  const world = { x0: -1, x1: 25, y0: -4, y1: 4 };   /* metres; screen y down = +y (the body's right) */

  function load(name) {
    const s = SCEN[name]; st.q = V.clone(s.q); st.v = V.clone(s.v); st.stick = V.clone(s.stick);
    st.obs = s.obs.map(([k, c, size]) => k === 'cylinder' ? new Cylinder(c, size, 2) : new SuperEllipsoid(c, size, k));
    st.path = null; draw();
  }
  function fit(canvas) { const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); if (canvas.width !== Math.round(r.width * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); } const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return [ctx, r.width, r.height]; }
  const w2s = (p, W, H) => [(p[0] - world.x0) / (world.x1 - world.x0) * W, (p[1] - world.y0) / (world.y1 - world.y0) * H];
  const s2w = (x, y, W, H) => [world.x0 + x / W * (world.x1 - world.x0), world.y0 + y / H * (world.y1 - world.y0), 0];
  const U = 6.5;                                                        /* input plane range */
  const u2s = (u, W, H) => [W / 2 + u[0] / U * (W / 2), H / 2 + u[1] / U * (H / 2)];

  function superRing(a, n, N = 64) { const pts = []; for (let k = 0; k <= N; k++) { const t = 2 * Math.PI * k / N, c = Math.cos(t), s = Math.sin(t); pts.push([a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), a * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]); } return pts; }

  function compute() {
    const q = st.q, v = st.v, uRef = V.sub(st.stick, v);
    const rows = st.obs.map((o, i) => ({ i, o, inRange: o.inRange(q) })).filter(r => r.inRange).map(r => { const [A, b] = r.o.constraint(q, v); return { ...r, A, b, s: V.dot(A, uRef) + b, uLoc: localSafe(uRef, A, b), h: r.o.h(q), hd: V.dot(r.o.grad(q), v) }; });
    const g = globalSafe(uRef, rows.map(r => r.A), rows.map(r => r.b));
    const rc = renderCues(q, v, uRef, st.obs, layout);
    return { uRef, rows, uSafe: g.u || uRef, ok: g.ok, cues: rc.cues, active: rc.active };
  }

  function simulate(assist, T = 4) {
    /* hold the stick for T s: the drone tracks v + u (u_ref, or the QP output) with the study's lag */
    let q = V.clone(st.q), v = V.clone(st.v); const pts = [q];
    for (let k = 0; k < T / PARAMS.dt; k++) {
      const uRef = V.sub(st.stick, v);
      let u = uRef;
      if (assist) { const rows = st.obs.filter(o => o.inRange(q)).map(o => o.constraint(q, v)); u = globalSafe(uRef, rows.map(r => r[0]), rows.map(r => r[1])).u; }
      const vt = V.add(v, u); v = V.add(v, V.scale(V.sub(vt, v), PARAMS.dt / PARAMS.tauDrone)); q = V.add(q, V.scale(v, PARAMS.dt));
      if (k % 5 === 0) pts.push(q);
    }
    return pts;
  }

  function draw() {
    const ink = css('--ink') || '#151820', panel = css('--panel') || '#fdf6e2', ash = css('--ash') || '#8f8a7a', hi = css('--hi') || '#e4442a', pop = css('--pop') || '#ffce0a';
    const r = compute();
    /* ---------- world ---------- */
    let [ctx, W, H] = fit(cw);
    ctx.fillStyle = panel; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(128,128,128,.25)'; ctx.lineWidth = 1;
    for (let x = Math.ceil(world.x0); x <= world.x1; x += 1) { const [sx] = w2s([x, 0], W, H); ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke(); }
    for (let y = Math.ceil(world.y0); y <= world.y1; y += 1) { const [, sy] = w2s([0, y], W, H); ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke(); }
    const kx = W / (world.x1 - world.x0), ky = H / (world.y1 - world.y0);
    st.obs.forEach((o, i) => {
      const [cx, cy] = w2s(o.c, W, H); const col = KIND[o.kind];
      const row = r.rows.find(rr => rr.i === i);
      if (chk('#pg-range').checked) { ctx.setLineDash([4, 4]); ctx.strokeStyle = row ? ash : 'rgba(128,128,128,.35)'; ctx.beginPath(); ctx.ellipse(cx, cy, (o.a + PARAMS.range) * kx, (o.a + PARAMS.range) * ky, 0, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]); }
      if (chk('#pg-levels').checked) {
        for (const [lev, alpha, lw] of [[8, .25, 1], [3, .4, 1], [1, .6, 1], [0, 1, 2]]) {
          const a = o.a * Math.pow(1 + lev, 1 / o.n); const pts = superRing(a, o.n);
          ctx.beginPath(); pts.forEach(([x, y], k) => { const [sx, sy] = w2s([o.c[0] + x, o.c[1] + y], W, H); k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
          ctx.strokeStyle = lev === 0 ? (row && row.s < 0 ? pop : (row && row.h < 0 ? hi : ash)) : `rgba(128,128,128,${alpha})`; ctx.lineWidth = lev === 0 ? lw + (row && row.s < 0 ? 1 : 0) : lw; ctx.stroke();
          if (lev === 0 && row && row.s < 0) { ctx.fillStyle = 'rgba(255,206,10,.10)'; ctx.fill(); }
        }
      }
      ctx.fillStyle = col; ctx.strokeStyle = ink; ctx.lineWidth = 1.5;
      if (o.kind === 'cube') { ctx.fillRect(cx - o.half * kx, cy - o.half * ky, o.size * kx, o.size * ky); ctx.strokeRect(cx - o.half * kx, cy - o.half * ky, o.size * kx, o.size * ky); }
      else { ctx.beginPath(); ctx.ellipse(cx, cy, o.half * kx, o.half * ky, 0, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = ink; ctx.font = '11px "Space Mono", monospace'; ctx.fillText(`${i + 1} ${o.kind} n=${o.n}`, cx + o.half * kx + 4, cy - o.half * ky - 4);
    });
    /* preview paths */
    if (st.path) {
      for (const [pts, col, dash] of [[st.path.raw, ink, [5, 4]], [st.path.assist, '#2e9e5b', []]]) {
        ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach((p, k) => { const [sx, sy] = w2s(p, W, H); k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    /* drone + arrows */
    const [qx, qy] = w2s(st.q, W, H);
    const arrow = (from, to, col, lw) => { ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(to[0], to[1]); ctx.stroke(); const a = Math.atan2(to[1] - from[1], to[0] - from[0]); ctx.beginPath(); ctx.moveTo(to[0], to[1]); ctx.lineTo(to[0] - 9 * Math.cos(a - .4), to[1] - 9 * Math.sin(a - .4)); ctx.lineTo(to[0] - 9 * Math.cos(a + .4), to[1] - 9 * Math.sin(a + .4)); ctx.closePath(); ctx.fill(); };
    const scaleV = 0.5;   /* metres of arrow per m/s */
    const vTip = w2s(V.add(st.q, V.scale(st.v, scaleV)), W, H), sTip = w2s(V.add(st.q, V.scale(st.stick, scaleV)), W, H);
    arrow([qx, qy], sTip, ink, 2.5); arrow([qx, qy], vTip, '#2a78d6', 2.5);
    const uSafeTip = w2s(V.add(st.q, V.scale(V.add(st.v, r.uSafe), scaleV)), W, H);
    if (V.norm(V.sub(r.uSafe, r.uRef)) > 1e-3) arrow([qx, qy], uSafeTip, '#2e9e5b', 2.5);
    for (const c of r.cues) { const [ox, oy] = w2s(st.obs[c.obs].c, W, H); ctx.strokeStyle = pop; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(ox, oy); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = hi; ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(qx, qy, 8, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    [[vTip, '#2a78d6'], [sTip, ink]].forEach(([p, col]) => { ctx.fillStyle = panel; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); });
    ctx.fillStyle = ash; ctx.font = '11px Jost, sans-serif';
    ctx.fillText('drag: the drone (red), its velocity v (blue tip), the operator\'s stick v_cmd (black tip), any obstacle · x forward → · y to the body\'s right ↓', 8, H - 8);
    /* ---------- input plane ---------- */
    [ctx, W, H] = fit(cu);
    ctx.fillStyle = panel; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(128,128,128,.3)'; ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    for (let g = -6; g <= 6; g += 2) { const [gx, gy] = u2s([g, g], W, H); ctx.strokeStyle = 'rgba(128,128,128,.12)'; ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
    r.rows.forEach(row => {
      const nrm = [row.A[0], row.A[1]], nn = Math.hypot(nrm[0], nrm[1]); if (nn < 1e-9) return;
      const c0 = row.A[2] * r.uRef[2] + row.b; const n2 = [nrm[0] / nn, nrm[1] / nn], d0 = -c0 / nn, tng = [-n2[1], n2[0]];
      const p0 = [n2[0] * d0, n2[1] * d0];
      const poly = [[p0[0] + 40 * tng[0], p0[1] + 40 * tng[1]], [p0[0] - 40 * tng[0], p0[1] - 40 * tng[1]], [p0[0] - 40 * tng[0] - 80 * n2[0], p0[1] - 40 * tng[1] - 80 * n2[1]], [p0[0] + 40 * tng[0] - 80 * n2[0], p0[1] + 40 * tng[1] - 80 * n2[1]]];
      const col = KIND[st.obs[row.i].kind];
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      ctx.fillStyle = col + (row.s < 0 ? '55' : '22'); ctx.beginPath(); poly.forEach((p, k) => { const [sx, sy] = u2s(p, W, H); k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = row.s < 0 ? 2.5 : 1.2; ctx.beginPath(); const a = u2s([p0[0] + 40 * tng[0], p0[1] + 40 * tng[1]], W, H), b = u2s([p0[0] - 40 * tng[0], p0[1] - 40 * tng[1]], W, H); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      const lp = u2s([p0[0] + 0.5 * n2[0], p0[1] + 0.5 * n2[1]], W, H); ctx.fillStyle = ink; ctx.font = '10px "Space Mono", monospace'; ctx.fillText(`${row.i + 1}`, lp[0], lp[1]);
      if (row.s < 0) { const l = u2s(row.uLoc, W, H); ctx.fillStyle = col; ctx.strokeStyle = ink; ctx.beginPath(); ctx.arc(l[0], l[1], 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); const ur = u2s(r.uRef, W, H); ctx.setLineDash([3, 3]); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ur[0], ur[1]); ctx.lineTo(l[0], l[1]); ctx.stroke(); ctx.setLineDash([]); }
      ctx.restore();
    });
    const ur = u2s(r.uRef, W, H), us = u2s(r.uSafe, W, H);
    ctx.strokeStyle = '#2e9e5b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ur[0], ur[1]); ctx.lineTo(us[0], us[1]); ctx.stroke();
    ctx.fillStyle = '#2e9e5b'; ctx.strokeStyle = ink; ctx.beginPath(); ctx.arc(us[0], us[1], 7, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.fillStyle = panel; ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(ur[0], ur[1], 7, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ink; ctx.font = '11px Jost, sans-serif';
    ctx.fillText('u_ref = v_cmd − v', ur[0] + 10, ur[1] - 8); ctx.fillStyle = '#2e9e5b'; ctx.fillText('u_safe (QP over all in-range constraints)', us[0] + 10, us[1] + 14);
    ctx.fillStyle = ash; ctx.fillText('input plane (u_x →, u_y ↓) · shaded: the side of each half-space that VIOLATES A·u + b ≥ 0 · small dots: per-obstacle local safe inputs', 8, 14);
    /* ---------- actuator ring ---------- */
    [ctx, W, H] = fit(cr);
    ctx.fillStyle = panel; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2 + 6, R = Math.min(W, H) * 0.36;
    ctx.fillStyle = 'rgba(128,128,128,.25)'; ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.45, R * 0.3, 0, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + R * 0.45, cy, 4, 0, 2 * Math.PI); ctx.fillStyle = ink; ctx.fill();
    ctx.fillStyle = ash; ctx.font = '10px Jost, sans-serif'; ctx.fillText('front', cx + R * 0.45 + 8, cy + 4);
    const duty = new Map(r.cues.flatMap(c => c.act.map(k => [k, c.duty])));
    const act = new Map(); for (const [k, d] of duty) act.set(k, Math.max(act.get(k) || 0, d));
    const kept = [...act.entries()].sort((a, b) => b[1] - a[1]).slice(0, PARAMS.keep);
    ring.forEach(({ i, d }) => {
      const px = cx + R * d[0], py = cy + R * d[1];        /* +y (right) drawn downward */
      const du = (kept.find(k => k[0] === i) || [0, 0])[1];
      if (du > 0) { ctx.fillStyle = 'rgba(228,68,42,.25)'; ctx.beginPath(); ctx.arc(px, py, 10 + 14 * du / 15, 0, 2 * Math.PI); ctx.fill(); }
      ctx.fillStyle = du > 0 ? hi : 'rgba(128,128,128,.6)'; ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py, 7 + 5 * du / 15, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; ctx.font = '10px "Space Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(`#${layout.ids[i]}`, px, py - 12); if (du > 0) ctx.fillText(`${du}/15`, px, py + 22); ctx.textAlign = 'left';
    });
    for (const c of r.cues) { const px = cx + R * 0.75 * c.dir[0], py = cy + R * 0.75 * c.dir[1]; ctx.strokeStyle = pop; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke(); }
    ctx.fillStyle = ash; ctx.font = '11px Jost, sans-serif'; ctx.fillText('the horizontal ring (ϑ = 90°) seen from above · yellow: obstacle directions that fire', 8, 14);
    /* ---------- readout ---------- */
    const lines = [];
    lines.push(`<b>v</b> = (${st.v.slice(0, 2).map(x => x.toFixed(2)).join(', ')}) m/s   <b>v_cmd</b> = (${st.stick.slice(0, 2).map(x => x.toFixed(2)).join(', ')}) m/s   <b>u_ref</b> = (${r.uRef.slice(0, 2).map(x => x.toFixed(2)).join(', ')})   <b>u_safe</b> = (${r.uSafe.slice(0, 2).map(x => x.toFixed(2)).join(', ')})   <b>|u_ref − u_safe|</b> = ${V.norm(V.sub(r.uRef, r.uSafe)).toFixed(2)}${r.ok ? '' : '  (infeasible: inside a shell)'}`);
    lines.push('<table class="pg-table"><tr><th>obstacle</th><th>h</th><th>ḣ = ∇h·v</th><th>A·u_ref + b</th><th>|u_ref − u_safe,i|</th><th>duty</th><th>actuator</th></tr>' + st.obs.map((o, i) => {
      const row = r.rows.find(rr => rr.i === i); if (!row) return `<tr><td>${i + 1} ${o.kind}</td><td colspan="6" class="dim">out of range (|q − c| ≥ a + 5 m)</td></tr>`;
      const cue = r.cues.find(c => c.obs === i);
      return `<tr class="${row.s < 0 ? 'viol' : ''}"><td>${i + 1} ${o.kind}</td><td>${row.h.toFixed(2)}</td><td>${row.hd.toFixed(2)}</td><td>${row.s.toFixed(2)}</td><td>${V.norm(V.sub(r.uRef, row.uLoc)).toFixed(2)}</td><td>${cue ? cue.duty : 0}</td><td>${cue ? cue.act.map(k => '#' + layout.ids[k]).join(' ') + ` (${cue.errDeg.toFixed(0)}° off)` : '—'}</td></tr>`;
    }).join('') + '</table>');
    readout.innerHTML = lines.join('');
  }

  /* ---- interaction ---- */
  function hit(x, y, W, H) {
    const near = (p, rad) => { const [sx, sy] = w2s(p, W, H); return Math.hypot(sx - x, sy - y) < rad; };
    if (near(V.add(st.q, V.scale(st.stick, 0.5)), 12)) return { kind: 'stick' };
    if (near(V.add(st.q, V.scale(st.v, 0.5)), 12)) return { kind: 'v' };
    if (near(st.q, 14)) return { kind: 'q' };
    for (let i = st.obs.length - 1; i >= 0; i--) if (near(st.obs[i].c, st.obs[i].half * W / (world.x1 - world.x0) + 6)) return { kind: 'obs', i };
    return null;
  }
  cw.addEventListener('pointerdown', (e) => { const rct = cw.getBoundingClientRect(); st.drag = hit(e.clientX - rct.left, e.clientY - rct.top, rct.width, rct.height); if (st.drag) { cw.setPointerCapture(e.pointerId); st.path = null; } });
  cw.addEventListener('pointermove', (e) => {
    const rct = cw.getBoundingClientRect(); const x = e.clientX - rct.left, y = e.clientY - rct.top;
    if (!st.drag) { cw.style.cursor = hit(x, y, rct.width, rct.height) ? 'grab' : 'default'; return; }
    const p = s2w(x, y, rct.width, rct.height);
    const clampV = (u) => { const n = V.norm(u); return n > PARAMS.vmax ? V.scale(u, PARAMS.vmax / n) : u; };
    if (st.drag.kind === 'q') st.q = p; else if (st.drag.kind === 'v') st.v = clampV(V.scale(V.sub(p, st.q), 2)); else if (st.drag.kind === 'stick') st.stick = clampV(V.scale(V.sub(p, st.q), 2)); else st.obs[st.drag.i].c = p;
    draw();
  });
  cw.addEventListener('pointerup', () => { st.drag = null; });
  ['#pg-levels', '#pg-range'].forEach(id => chk(id).addEventListener('change', draw));
  sel.addEventListener('change', () => load(sel.value));
  root.querySelector('#pg-preview').addEventListener('click', () => { st.path = { raw: simulate(false), assist: simulate(true) }; draw(); });
  root.querySelector('#pg-reset').addEventListener('click', () => load(sel.value));
  let animId = null;
  root.querySelector('#pg-animate').addEventListener('click', (e) => {
    if (animId) { cancelAnimationFrame(animId); animId = null; e.target.textContent = 'Animate (hold the stick)'; return; }
    e.target.textContent = 'Stop'; let last = performance.now(), acc = 0;
    const step = (now) => { acc += Math.min(0.1, (now - last) / 1000); last = now;
      while (acc >= PARAMS.dt) { const uRef = V.sub(st.stick, st.v); let u = uRef; if (chk('#pg-assist').checked) { const rows = st.obs.filter(o => o.inRange(st.q)).map(o => o.constraint(st.q, st.v)); u = globalSafe(uRef, rows.map(r => r[0]), rows.map(r => r[1])).u; } const vt = V.add(st.v, u); st.v = V.add(st.v, V.scale(V.sub(vt, st.v), PARAMS.dt / PARAMS.tauDrone)); st.q = V.add(st.q, V.scale(st.v, PARAMS.dt)); acc -= PARAMS.dt; }
      if (st.q[0] > world.x1 || st.q[0] < world.x0 || Math.abs(st.q[1]) > world.y1) { load(sel.value); }
      draw(); animId = requestAnimationFrame(step); };
    animId = requestAnimationFrame(step);
  });
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('resize', draw);
  load(sel.value);
  return { draw };
}

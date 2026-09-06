/* =============================================================================
   locomotion_lab.js — the balance lab of the "Evolution of Humanoid Locomotion
   Control" page. A planar linear inverted pendulum walker with foot placement and
   an ankle (ZMP) input, pushed and mis-modelled, closed by four controllers that
   stand for the survey's eras. A port of experiments/lipwalk (model.py,
   controllers.py); the learned policy runs the exported PPO weights.
   ============================================================================= */
export const G = 9.81;
export const NOM = { z0: 0.80, T: 0.40, T_min: 0.24, T_max: 0.60, A_MAX: 0.05, L_MAX: 0.65, X_FALL: 0.75, V_FALL: 3.0, dt: 0.01 };
const HIST = 4;
const clip = (v, a, b) => Math.max(a, Math.min(b, v));
const W0 = Math.sqrt(G / NOM.z0);
const periodicOffset = (w, T, L) => L / (Math.exp(w * T) - 1);

/* ---------------------------------------------------------------- one walker */
export class Walker {
  constructor(opts = {}) { this.setOptions(opts); this.reset(); }
  setOptions(o) { this.z0 = o.z0 ?? NOM.z0; this.v_des = o.v_des ?? 0.5; this.noise = o.noise ?? 0.03; this.delay = o.delay ?? 1; this.seed = o.seed ?? 1; }
  get w() { return Math.sqrt(G / this.z0); }
  rand() { /* mulberry32 */ let t = (this._s += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  gauss() { const u = 1 - this.rand(), v = this.rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  reset() {
    this._s = this.seed | 0;
    const w = W0, T = NOM.T, L = this.v_des * T, b = periodicOffset(w, T, L);
    this.x = -L / 2; this.v = w * (b + L / 2); this.t = 0; this.t_step = 0; this.a = 0; this.foot = 0; this.foot_prev = -L; this.u_last = L; this.u_cmd = L; this.T_cmd = T;
    this.vbuf = new Array(8).fill(this.v); this.hist = new Array(HIST).fill(this.v); this.fallen = false; this.nsteps = 0; this.push = 0; this.pushAge = 9; this.stepped = false;
  }
  observe() {
    const d = clip(this.delay, 1, 7); const vm = this.vbuf[this.vbuf.length - d] + this.gauss() * this.noise;
    return { obs: [this.x, vm, this.t_step / NOM.T, this.v_des, this.u_last, this.a / NOM.A_MAX, ...this.hist], vmeas: vm };
  }
  /** one tick with the controller outputs; push = velocity impulse this tick */
  step(a, u_cmd, T_cmd, push = 0) {
    const dt = NOM.dt; a = clip(a, -NOM.A_MAX, NOM.A_MAX); this.a = a; this.u_cmd = clip(u_cmd, -NOM.L_MAX, NOM.L_MAX); this.T_cmd = clip(T_cmd, NOM.T_min, NOM.T_max);
    if (push) { this.v += push; this.push = push; this.pushAge = 0; } else this.pushAge += dt;
    const w = this.w, c = Math.cosh(w * dt), s = Math.sinh(w * dt), xa = this.x - a;
    const xn = a + xa * c + this.v / w * s, vn = xa * w * s + this.v * c; this.x = xn; this.v = vn;
    this.t += dt; this.t_step += dt;
    let stepped = (this.t_step >= this.T_cmd - 1e-9 || this.t_step >= NOM.T_max - 1e-9) && this.t_step >= NOM.T_min - 1e-9;
    if (stepped) { this.foot_prev = this.foot; this.x -= this.u_cmd; this.foot += this.u_cmd; this.u_last = this.u_cmd; this.t_step = 0; this.nsteps++; }
    this.stepped = stepped;
    this.vbuf.shift(); this.vbuf.push(this.v); this.hist.shift(); this.hist.push(this.v);
    if (Math.abs(this.x) > NOM.X_FALL || Math.abs(this.v) > NOM.V_FALL) this.fallen = true;
    return stepped;
  }
}

/* ---------------------------------------------------------------- controllers */
export class ClassicalDCM {
  constructor(k = 0.8) { this.k = k; this.name = 'classical'; this.w2 = W0 * W0; }
  freq() { return W0; }
  act(o) {
    const [x, v, phase, v_des] = o; const w = this.freq(), T = NOM.T, L = v_des * T, b = periodicOffset(w, T, L);
    const xi = x + v / w, t = phase * NOM.T, xi_ref = b * Math.exp(w * t);
    const a = this.k * (xi - xi_ref), xi_T = xi * Math.exp(w * Math.max(T - t, 0));
    return [a, xi_T - b, T];
  }
}
export class AdaptiveDCM extends ClassicalDCM {
  constructor(k = 0.8, forget = 0.98) { super(k); this.name = 'adaptive'; this.forget = forget; this.P = 10; }
  reset() { this.w2 = W0 * W0; this.P = 10; }
  freq() { return Math.sqrt(this.w2); }
  update(x0, v0, a0, v1, stepped) {
    const phi = (x0 - a0) * NOM.dt, y = v1 - v0; if (stepped || Math.abs(phi) < 1e-4) return;
    const k = this.P * phi / (this.forget + phi * this.P * phi); this.w2 = clip(this.w2 + k * (y - phi * this.w2), 6, 25); this.P = (this.P - k * phi * this.P) / this.forget;
  }
}
export class StepMPC extends ClassicalDCM {
  constructor(k = 0.8) { super(k); this.name = 'predictive'; this.H = 3; this.times = [0.26, 0.31, 0.36, 0.40, 0.46, 0.54]; this.rho = 0.15; this.w_time = 0.3; }
  solve(xi_T, e, L_des, target) {
    const H = this.H, Lmax = NOM.L_MAX; const M = []; for (let j = 1; j <= H; j++) { const row = new Array(H).fill(0); for (let k = 0; k < j; k++) row[k] = Math.pow(e, j - k); M.push(row); }
    const c = []; for (let j = 1; j <= H; j++) c.push(Math.pow(e, j) * xi_T);
    const A = []; for (let i = 0; i < H; i++) { A.push([]); for (let k = 0; k < H; k++) { let s = 0; for (let j = 0; j < H; j++) s += M[j][i] * M[j][k]; A[i].push(s + (i === k ? this.rho : 0)); } }
    const rhs = []; for (let k = 0; k < H; k++) { let s = 0; for (let j = 0; j < H; j++) s += (c[j] - target) * M[j][k]; rhs.push(s + this.rho * L_des); }
    let u = solve3(A, rhs);
    for (let round = 0; round < 2; round++) {
      const active = u.map(v => Math.abs(v) > Lmax); if (!active.some(Boolean)) break;
      const uc = u.map(v => clip(v, -Lmax, Lmax)); const fr = []; for (let i = 0; i < H; i++) if (!active[i]) fr.push(i);
      if (fr.length) { const Af = fr.map(i => fr.map(k => A[i][k])); const r = fr.map(i => { let s = rhs[i]; for (let k = 0; k < H; k++) if (active[k]) s -= A[i][k] * uc[k]; return s; }); const sol = solveN(Af, r); fr.forEach((i, q) => uc[i] = sol[q]); }
      u = uc;
    }
    u = u.map(v => clip(v, -Lmax, Lmax));
    let cost = 0; for (let j = 0; j < H; j++) { let xi = c[j]; for (let k = 0; k < H; k++) xi -= M[j][k] * u[k]; cost += (xi - target) ** 2; }
    for (let k = 0; k < H; k++) cost += this.rho * (u[k] - L_des) ** 2;
    return [u, cost];
  }
  act(o) {
    const [x, v, phase, v_des] = o; const w = this.freq(), T = NOM.T, t = phase * NOM.T, L_des = v_des * T, b = periodicOffset(w, T, L_des), e = Math.exp(w * T);
    const xi = x + v / w, a = this.k * (xi - b * Math.exp(w * t)), target = b * e;
    let best = Infinity, bu = 0, bT = T;
    for (const Tc of this.times) { const Te = Math.max(Tc, t); const xi_T = xi * Math.exp(w * (Te - t)); const [u, c0] = this.solve(xi_T, e, L_des, target); const cost = c0 + this.w_time * (Te - T) ** 2 / (T * T); if (cost < best) { best = cost; bu = u[0]; bT = Te; } }
    return [a, bu, bT];
  }
}
function solveN(A, b) { const n = b.length; const M = A.map((r, i) => [...r, b[i]]); for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r; [M[i], M[p]] = [M[p], M[i]]; for (let r = 0; r < n; r++) { if (r === i) continue; const f = M[r][i] / M[i][i]; for (let k = i; k <= n; k++) M[r][k] -= f * M[i][k]; } } return M.map((r, i) => r[n] / r[i]); }
const solve3 = solveN;

export class MLPPolicy {
  constructor(d) { this.W = d.weights; this.b = d.biases; this.mu = d.obs_mean; this.sd = d.obs_std; this.name = d.meta && d.meta.randomize ? 'learned_dr' : 'learned_nodr'; }
  freq() { return W0; }
  act(o) {
    let h = o.map((v, i) => (v - this.mu[i]) / this.sd[i]);
    for (let l = 0; l < this.W.length; l++) { const Wl = this.W[l], bl = this.b[l]; const out = new Array(bl.length); for (let j = 0; j < bl.length; j++) { let s = bl[j]; for (let i = 0; i < h.length; i++) s += h[i] * Wl[i][j]; out[j] = l < this.W.length - 1 ? Math.tanh(s) : s; } h = out; }
    return [NOM.A_MAX * Math.tanh(h[0]), NOM.L_MAX * Math.tanh(h[1]), NOM.T_min + (NOM.T_max - NOM.T_min) * (0.5 + 0.5 * Math.tanh(h[2]))];
  }
}

/* ---------------------------------------------------------------- drawing */
const COL = { classical: '#2a78d6', adaptive: '#1baf7a', predictive: '#8e6bd1', learned_dr: '#E4442A', learned_nodr: '#eb6834' };
export const LABEL = { classical: 'Classical · capture point + ankle', adaptive: 'Classical + online ω estimate', predictive: 'Predictive · step MPC', learned_dr: 'Learned · PPO, domain randomised', learned_nodr: 'Learned · PPO, nominal model only' };
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function drawWalker(ctx, wk, name, X, Y, scale, z0, showMarkers) {
  const col = COL[name] || '#F4EAD2'; const ink = css('--ink') || '#151820';
  const cx = wk.foot + wk.x, cz = z0;
  // swing foot arc
  const s = clip(wk.t_step / Math.max(wk.T_cmd, 1e-3), 0, 1), x1 = wk.foot + wk.u_cmd, sx = wk.foot_prev + (x1 - wk.foot_prev) * (3 * s * s - 2 * s * s * s), sz = 0.08 * 4 * s * (1 - s);
  const P = (x, z) => [X(x), Y(z)];
  ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.lineWidth = 3.5 * scale;
  ctx.beginPath(); ctx.moveTo(...P(wk.foot, 0)); ctx.lineTo(...P(cx, cz)); ctx.stroke();
  ctx.globalAlpha = 0.7; ctx.lineWidth = 2.6 * scale; ctx.beginPath(); ctx.moveTo(...P(sx, sz)); ctx.lineTo(...P(cx, cz)); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = col; ctx.strokeStyle = ink; ctx.lineWidth = 1;
  for (const [fx, fz, al] of [[wk.foot, 0, 1], [sx, sz, 0.7]]) { ctx.globalAlpha = al; const [px, py] = P(fx - 0.06, fz + 0.012); ctx.fillRect(px, py, 0.16 * scale * 100, 0.024 * scale * 100); ctx.strokeRect(px, py, 0.16 * scale * 100, 0.024 * scale * 100); }
  ctx.globalAlpha = 1;
  const lean = clip(wk.v * 0.08, -0.12, 0.12);
  ctx.strokeStyle = col; ctx.lineWidth = 5 * scale; ctx.beginPath(); ctx.moveTo(...P(cx, cz)); ctx.lineTo(...P(cx + lean, cz + 0.32)); ctx.stroke();
  ctx.lineWidth = 2.4 * scale; ctx.globalAlpha = .7; ctx.beginPath(); ctx.moveTo(...P(cx + lean * 0.7, cz + 0.26)); ctx.lineTo(...P(cx + lean * 0.7 - 0.13, cz + 0.1)); ctx.moveTo(...P(cx + lean * 0.7, cz + 0.26)); ctx.lineTo(...P(cx + lean * 0.7 + 0.13, cz + 0.08)); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(...P(cx, cz), 0.045 * scale * 100, 0, 2 * Math.PI); ctx.fill(); ctx.strokeStyle = ink; ctx.stroke();
  ctx.fillStyle = '#F4EAD2'; ctx.beginPath(); ctx.arc(...P(cx + lean * 1.2, cz + 0.40), 0.065 * scale * 100, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  if (showMarkers) {
    const w = Math.sqrt(G / NOM.z0);
    tri(ctx, ...P(wk.foot + wk.a, 0.012), 7 * scale, '#FFCE0A', ink);
    diamond(ctx, ...P(cx + wk.v / w, 0), 6 * scale, '#E4442A', ink);
    ctx.strokeStyle = '#F4EAD2'; ctx.lineWidth = 2; const [mx, my] = P(wk.foot + wk.u_cmd, 0); ctx.beginPath(); ctx.moveTo(mx, my - 8 * scale); ctx.lineTo(mx, my + 8 * scale); ctx.stroke();
  }
  if (wk.push && wk.pushAge < 0.6) {
    const al = 1 - wk.pushAge / 0.6, d = Math.sign(wk.push), L = 0.25 + 0.25 * Math.min(Math.abs(wk.push), 2) / 2;
    ctx.globalAlpha = al; ctx.strokeStyle = '#FFCE0A'; ctx.fillStyle = '#FFCE0A'; ctx.lineWidth = 4 * scale;
    const [ax, ay] = P(cx - d * (L + 0.12), cz + 0.25), [bx, by] = P(cx - d * 0.12, cz + 0.25);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.beginPath(); ctx.moveTo(bx + d * 10 * scale, by); ctx.lineTo(bx - d * 4 * scale, by - 8 * scale); ctx.lineTo(bx - d * 4 * scale, by + 8 * scale); ctx.closePath(); ctx.fill();
    ctx.font = `${11 * scale}px "Space Mono", monospace`; ctx.textAlign = 'center'; ctx.fillText(Math.abs(wk.push).toFixed(1) + ' m/s', ax, ay - 10 * scale); ctx.globalAlpha = 1;
  }
}
function tri(ctx, x, y, r, fc, ec) { ctx.fillStyle = fc; ctx.strokeStyle = ec; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - r, y - 1.6 * r); ctx.lineTo(x + r, y - 1.6 * r); ctx.closePath(); ctx.fill(); ctx.stroke(); }
function diamond(ctx, x, y, r, fc, ec) { ctx.fillStyle = fc; ctx.strokeStyle = ec; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); ctx.stroke(); }

/* ---------------------------------------------------------------- the lab */
export function initLab(ui, policies) {
  const canvas = ui.canvas, ctx = canvas.getContext('2d');
  const names = ['classical', 'predictive', 'learned_dr', 'learned_nodr', 'adaptive'];
  const makeCtrl = (n) => n === 'classical' ? new ClassicalDCM() : n === 'adaptive' ? new AdaptiveDCM() : n === 'predictive' ? new StepMPC() : new MLPPolicy(policies[n === 'learned_dr' ? 'dr' : 'nodr']);
  const state = { active: ['classical', 'predictive', 'learned_dr', 'learned_nodr'], z0: NOM.z0, v_des: 0.5, noise: 0.03, delay: 1, speed: 1, autoPush: 0.0, pushMag: 1.0, markers: true, seed: 1, running: true };
  let walkers = {}, ctrls = {}, traces = {}, tSim = 0, nextAuto = 2.0;
  function reset() {
    tSim = 0; nextAuto = 2.0; walkers = {}; ctrls = {}; traces = {};
    for (const n of state.active) { walkers[n] = new Walker({ z0: state.z0, v_des: state.v_des, noise: state.noise, delay: state.delay, seed: state.seed }); ctrls[n] = makeCtrl(n); if (ctrls[n].reset) ctrls[n].reset(); traces[n] = []; }
  }
  function tickAll(push) {
    for (const n of state.active) {
      const wk = walkers[n]; if (wk.fallen) { wk.pushAge += NOM.dt; continue; }
      const { obs } = wk.observe(); const [a, u, T] = ctrls[n].act(obs);
      const x0 = wk.x, v0 = wk.v, a0 = clip(a, -NOM.A_MAX, NOM.A_MAX);
      const stepped = wk.step(a, u, T, push);
      if (ctrls[n].update) ctrls[n].update(x0, v0, a0, wk.v, stepped);
      const tr = traces[n]; tr.push([wk.t, wk.v]); while (tr.length && tr[0][0] < wk.t - 6) tr.shift();
    }
  }
  function pushAll(dv) { let first = true; for (const n of state.active) { const wk = walkers[n]; if (!wk.fallen) { /* apply on the next tick */ } } pending += dv; }
  let pending = 0, acc = 0;
  function frame(now) {
    if (!frame.last) frame.last = now; let dt = Math.min(0.05, (now - frame.last) / 1000); frame.last = now;
    if (state.running) {
      acc += dt * state.speed;
      while (acc >= NOM.dt) {
        let push = 0; if (pending) { push = pending; pending = 0; }
        if (state.autoPush > 0 && tSim >= nextAuto) { push += (walkers[state.active[0]].rand() < 0.5 ? -1 : 1) * state.autoPush * (0.5 + walkers[state.active[0]].rand()); nextAuto = tSim + 1.2 + 1.8 * walkers[state.active[0]].rand(); }
        tickAll(push); tSim += NOM.dt; acc -= NOM.dt;
      }
    }
    draw(); requestAnimationFrame(frame);
  }
  function draw() {
    const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(r.width * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const Wc = r.width, Hc = r.height;
    const panel = css('--panel') || '#fdf6e2', ink = css('--ink') || '#151820', ash = css('--ash') || '#8f8a7a';
    ctx.fillStyle = panel; ctx.fillRect(0, 0, Wc, Hc);
    const n = state.active.length, cols = n > 2 ? 2 : n, rows = Math.ceil(n / cols); const pw = (Wc - 10 * (cols + 1)) / cols, ph = (Hc - 10 * (rows + 1)) / rows;
    state.active.forEach((name, i) => {
      const px = 10 + (i % cols) * (pw + 10), py = 10 + Math.floor(i / cols) * (ph + 10); const wk = walkers[name];
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      ctx.fillStyle = 'rgba(128,128,128,.07)'; ctx.fillRect(px, py, pw, ph);
      const th = ph * 0.74; const scale = th / ((state.z0 + 0.67) * 100); const cx = wk.foot + wk.x; const span = pw / (scale * 100);
      const xl = cx - span * 0.45; const X = (x) => px + (x - xl) * scale * 100, Y = (z) => py + th - (z + 0.1) * scale * 100;
      // ground
      ctx.strokeStyle = ash; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, Y(0)); ctx.lineTo(px + pw, Y(0)); ctx.stroke();
      for (let gx = Math.floor(xl * 2) / 2; gx < xl + span + 0.5; gx += 0.5) { ctx.beginPath(); ctx.moveTo(X(gx), Y(0)); ctx.lineTo(X(gx), Y(0) + 6); ctx.stroke(); }
      drawWalker(ctx, wk, name, X, Y, scale, state.z0, state.markers);
      ctx.fillStyle = COL[name]; ctx.font = `13px Bangers, Impact, sans-serif`; ctx.textAlign = 'left'; ctx.fillText(LABEL[name].toUpperCase(), px + 8, py + 16);
      ctx.fillStyle = ink; ctx.font = `10px "Space Mono", monospace`; ctx.textAlign = 'right'; ctx.fillText(`v ${wk.v.toFixed(2)} m/s · ${wk.nsteps} steps` + (ctrls[name].freq && name === 'adaptive' ? ` · ω̂ ${ctrls[name].freq().toFixed(2)}` : ''), px + pw - 8, py + 16);
      if (wk.fallen) { ctx.fillStyle = '#FFCE0A'; ctx.strokeStyle = ink; ctx.lineWidth = 2; const bx = px + pw / 2 - 40, by = py + th * 0.35; ctx.fillRect(bx, by, 80, 30); ctx.strokeRect(bx, by, 80, 30); ctx.fillStyle = ink; ctx.font = `22px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('FELL', px + pw / 2, by + 23); }
      // trace
      const ty = py + th + 4, tH = ph - th - 8; ctx.fillStyle = 'rgba(128,128,128,.10)'; ctx.fillRect(px + 30, ty, pw - 36, tH);
      const tr = traces[name]; const t1 = wk.t, t0 = t1 - 6; const TX = (t) => px + 30 + (t - t0) / 6 * (pw - 36), TY = (v) => ty + tH - (v + 0.8) / 2.8 * tH;
      ctx.strokeStyle = '#D9A13F'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(px + 30, TY(state.v_des)); ctx.lineTo(px + pw - 6, TY(state.v_des)); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = COL[name]; ctx.lineWidth = 1.5; ctx.beginPath(); tr.forEach(([t, v], k) => { const X_ = TX(t), Y_ = clip(TY(v), ty, ty + tH); k ? ctx.lineTo(X_, Y_) : ctx.moveTo(X_, Y_); }); ctx.stroke();
      ctx.fillStyle = ash; ctx.font = `9px "Space Mono", monospace`; ctx.textAlign = 'left'; ctx.fillText('v [m/s], last 6 s · dashed = commanded', px + 34, ty + 10);
      ctx.restore();
    });
  }
  // wiring
  ui.pushF.addEventListener('click', () => pending += state.pushMag); ui.pushB.addEventListener('click', () => pending -= state.pushMag);
  ui.pushMag.addEventListener('input', () => { state.pushMag = parseFloat(ui.pushMag.value); ui.pushOut.textContent = state.pushMag.toFixed(1) + ' m/s'; });
  ui.z0.addEventListener('input', () => { state.z0 = parseFloat(ui.z0.value); ui.z0Out.textContent = state.z0.toFixed(2) + ' m'; for (const n in walkers) walkers[n].z0 = state.z0; });
  ui.vdes.addEventListener('input', () => { state.v_des = parseFloat(ui.vdes.value); ui.vdesOut.textContent = state.v_des.toFixed(2) + ' m/s'; for (const n in walkers) walkers[n].v_des = state.v_des; });
  ui.noise.addEventListener('input', () => { state.noise = parseFloat(ui.noise.value); ui.noiseOut.textContent = state.noise.toFixed(2); for (const n in walkers) walkers[n].noise = state.noise; });
  ui.delay.addEventListener('input', () => { state.delay = parseInt(ui.delay.value); ui.delayOut.textContent = (state.delay * 10) + ' ms'; for (const n in walkers) walkers[n].delay = state.delay; });
  ui.auto.addEventListener('input', () => { state.autoPush = parseFloat(ui.auto.value); ui.autoOut.textContent = state.autoPush ? state.autoPush.toFixed(1) + ' m/s' : 'off'; });
  ui.speed.addEventListener('change', () => state.speed = parseFloat(ui.speed.value));
  ui.markers.addEventListener('change', () => state.markers = ui.markers.checked);
  ui.reset.addEventListener('click', () => { state.seed++; reset(); });
  ui.pause.addEventListener('click', () => { state.running = !state.running; ui.pause.textContent = state.running ? 'Pause' : 'Resume'; });
  for (const cb of ui.who) cb.addEventListener('change', () => { state.active = ui.who.filter(c => c.checked).map(c => c.value); if (!state.active.length) { ui.who[0].checked = true; state.active = [ui.who[0].value]; } reset(); });
  canvas.tabIndex = 0; canvas.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { pending += state.pushMag; e.preventDefault(); } else if (e.key === 'ArrowLeft') { pending -= state.pushMag; e.preventDefault(); } else if (e.key === ' ') { state.seed++; reset(); e.preventDefault(); } });
  canvas.addEventListener('pointerdown', () => canvas.focus());
  reset(); requestAnimationFrame(frame);
  return { reset, state };
}

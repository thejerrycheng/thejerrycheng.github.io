/* =============================================================================
   unicycle_scene3d.js — the two unicycles (generative lattice vs conventional
   plates) in three.js, driven live by unicycle_sim.js. Push them, tilt them,
   change the PID gains, add loop delay, and watch the traces.
   ============================================================================= */
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { Unicycle, GENERATIVE, CONVENTIONAL, chassis, PAPER_GAINS, P, poles } from './unicycle_sim.js';

const INK = 0x151820, CREAM = 0xF4EAD2, RED = 0xE4442A, YEL = 0xFFCE0A, GOLD = 0xD9A13F, BLUE = 0x2a78d6, GREEN = 0x3fbf5a, ASH = 0x8f8a7a;
const Z_PLATE0 = 0.05, Z_PLATE1 = 0.15, Z_RW = 0.20;
const COL = { generative: '#E4442A', conventional: '#2a78d6' };
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------------------------------------------------------------- viewer */
class Viewer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); this.renderer.setClearColor(opts.clear ?? INK, 1);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(opts.fov || 30, 1, 0.01, 50);
    this.controls = new OrbitControls(this.camera, canvas); this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x2b3140, 0.85));
    const key = new THREE.DirectionalLight(0xfff2dc, 1.7); key.position.set(1.2, -0.8, 1.6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -1; key.shadow.camera.right = 1; key.shadow.camera.top = 1; key.shadow.camera.bottom = -1; key.shadow.camera.near = 0.2; key.shadow.camera.far = 6; key.shadow.bias = -0.0008;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x9ec5f4, 0.45); fill.position.set(-1.5, 1.0, 0.6); this.scene.add(fill);
    this.visible = true; this.tick = null; this.clock = new THREE.Clock();
    new ResizeObserver(() => this.resize()).observe(canvas); this.resize();
    if ('IntersectionObserver' in window) new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; }, { threshold: 0.02 }).observe(canvas);
    const loop = () => { requestAnimationFrame(loop); if (!this.visible) return; const dt = Math.min(0.05, this.clock.getDelta()); this.controls.update(); if (this.tick) this.tick(dt); this.renderer.render(this.scene, this.camera); };
    requestAnimationFrame(loop);
  }
  resize() { const w = this.canvas.clientWidth || 600, h = this.canvas.clientHeight || 400; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
}

function labelSprite(text, color = '#F4EAD2', px = 22, bg = 'rgba(21,24,32,0.75)') {
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d'); ctx.font = `${px}px Bangers, Impact, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 18, h = px + 12; cv.width = w * 2; cv.height = h * 2; ctx.scale(2, 2);
  ctx.font = `${px}px Bangers, Impact, sans-serif`; ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, 9, h / 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false })); sp.scale.set(w / 1300, h / 1300, 1); sp.renderOrder = 20; return sp;
}

/* ---------------------------------------------------------------- geometry helpers (z up, x forward, y left) */
const MAT = {
  cream: new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.55, metalness: 0.05 }),
  nylon: new THREE.MeshStandardMaterial({ color: 0xd9a13f, roughness: 0.6, metalness: 0.08 }),
  nylonDark: new THREE.MeshStandardMaterial({ color: 0xb98a34, roughness: 0.65 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa0ad, roughness: 0.35, metalness: 0.7 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.95 }),
  motor: new THREE.MeshStandardMaterial({ color: 0x3c4150, roughness: 0.5, metalness: 0.5 }),
  battery: new THREE.MeshStandardMaterial({ color: 0x3fbf5a, roughness: 0.5 }),
  board: new THREE.MeshStandardMaterial({ color: 0x2a78d6, roughness: 0.6 }),
  alu: new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 0.3, metalness: 0.85 }),
};
function mesh(geom, mat, pos, rot) { const m = new THREE.Mesh(geom, mat); if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot); m.castShadow = true; m.receiveShadow = true; return m; }
function strut(a, b, r = 0.0025, mat = MAT.nylon, r2 = null) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const L = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r2 ?? r, r, L, 8, 1); const m = new THREE.Mesh(g, mat); m.castShadow = true;
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); return m;
}
function plate(cx, cy, cz, sx, sy, sz, mat = MAT.cream) { return mesh(new THREE.BoxGeometry(sx, sy, sz), mat, [cx, cy, cz]); }
function cylinderX(cx, cy, cz, r, len, mat) { return mesh(new THREE.CylinderGeometry(r, r, len, 24), mat, [cx, cy, cz], [0, 0, Math.PI / 2]); }
function cylinderY(cx, cy, cz, r, len, mat) { return mesh(new THREE.CylinderGeometry(r, r, len, 32), mat, [cx, cy, cz]); }

function buildRobot(kind) {
  const root = new THREE.Group();                 // origin at the ground contact; rotation.x = roll; position.x = travel
  const R = P.R_WHEEL;
  const wheel = new THREE.Group(); wheel.position.set(0, 0, R); root.add(wheel);   // rotation.y = wheel angle
  wheel.add(cylinderY(0, 0, 0, R, 0.024, MAT.rubber));
  wheel.add(cylinderY(0, 0, 0, R * 0.72, 0.026, MAT.alu));
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; const s = mesh(new THREE.BoxGeometry(R * 1.3, 0.028, 0.006), MAT.alu, [0, 0, 0], [0, a, 0]); wheel.add(s); }
  const body = new THREE.Group(); body.position.set(0, 0, R); root.add(body);       // rotation.y = pitch
  // fork
  for (const s of [-1, 1]) { body.add(strut([0, s * 0.03, 0], [0, s * 0.03, Z_PLATE0], 0.003, MAT.cream)); body.add(strut([0, s * 0.03, 0.005], [-0.03, s * 0.03, Z_PLATE0 - 0.003], 0.0025, MAT.cream)); }
  body.add(cylinderY(0, 0, 0, 0.005, 0.07, MAT.steel));
  body.add(cylinderY(-0.045, 0.0, 0.022, 0.013, 0.03, MAT.motor)); body.add(cylinderY(-0.045, 0.0, 0.022, 0.0035, 0.045, MAT.steel));
  body.add(mesh(new THREE.BoxGeometry(0.02, 0.006, 0.02), MAT.alu, [-0.045, 0.026, 0.01]));  // gear
  body.add(plate(0, 0, Z_PLATE0, 0.10, 0.09, 0.006));
  body.add(mesh(new THREE.BoxGeometry(0.05, 0.04, 0.004), MAT.board, [0.02, 0.0, Z_PLATE0 + 0.012]));
  for (let i = 0; i < 6; i++) body.add(mesh(new THREE.BoxGeometry(0.006, 0.006, 0.006), MAT.motor, [0.005 + (i % 3) * 0.012, -0.012 + Math.floor(i / 3) * 0.02, Z_PLATE0 + 0.017]));
  if (kind === 'generative') {
    // four organic V-columns with cross bracing, tapered like the generated brackets
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const p0 = [sx * 0.042, sy * 0.038, Z_PLATE0 + 0.003], top = [sx * 0.03, sy * 0.034, Z_PLATE1 - 0.003];
      body.add(strut(p0, [sx * 0.03, sy * 0.034, Z_PLATE0 + 0.055], 0.0036, MAT.nylon, 0.0026));
      body.add(strut([sx * 0.03, sy * 0.034, Z_PLATE0 + 0.055], top, 0.0026, MAT.nylon, 0.0022));
      body.add(strut([sx * 0.048, sy * 0.030, Z_PLATE0 + 0.003], [sx * 0.03, sy * 0.034, Z_PLATE0 + 0.055], 0.0024, MAT.nylonDark, 0.0018));
      body.add(strut([sx * 0.034, sy * 0.044, Z_PLATE0 + 0.003], [sx * 0.03, sy * 0.034, Z_PLATE0 + 0.055], 0.0024, MAT.nylonDark, 0.0018));
      body.add(strut([sx * 0.03, sy * 0.034, Z_PLATE0 + 0.055], [sx * 0.012, sy * 0.044, Z_PLATE1 - 0.003], 0.0018, MAT.nylonDark, 0.0014));
      body.add(strut([sx * 0.03, sy * 0.034, Z_PLATE0 + 0.055], [sx * 0.046, sy * 0.012, Z_PLATE1 - 0.003], 0.0018, MAT.nylonDark, 0.0014));
    }
    // reaction-wheel support: an A-frame lattice from the top plate to the axle
    for (const sy of [-1, 1]) {
      body.add(strut([0.02, sy * 0.03, Z_PLATE1 + 0.003], [0.0, sy * 0.017, Z_RW], 0.003, MAT.nylon, 0.0022));
      body.add(strut([-0.02, sy * 0.03, Z_PLATE1 + 0.003], [0.0, sy * 0.017, Z_RW], 0.003, MAT.nylon, 0.0022));
      body.add(strut([0.0, sy * 0.036, Z_PLATE1 + 0.003], [0.0, sy * 0.017, Z_RW - 0.012], 0.0018, MAT.nylonDark, 0.0014));
    }
  } else {
    for (const sy of [-1, 1]) body.add(plate(0, sy * 0.040, (Z_PLATE0 + Z_PLATE1) / 2, 0.09, 0.006, Z_PLATE1 - Z_PLATE0 - 0.006, MAT.nylon));
    for (const sy of [-1, 1]) body.add(plate(0, sy * 0.020, (Z_PLATE1 + Z_RW) / 2 + 0.005, 0.05, 0.006, Z_RW - Z_PLATE1 + 0.01, MAT.nylon));
    body.add(plate(0, 0, (Z_PLATE0 + Z_PLATE1) / 2, 0.006, 0.086, Z_PLATE1 - Z_PLATE0 - 0.006, MAT.nylonDark)); // a back wall
  }
  for (const y of [-0.024, 0, 0.024]) { body.add(cylinderX(0, y, Z_PLATE0 + 0.045, 0.0105, 0.066, MAT.battery)); body.add(cylinderX(0.034, y, Z_PLATE0 + 0.045, 0.004, 0.004, MAT.steel)); }
  body.add(plate(0, 0, Z_PLATE1, 0.10, 0.09, 0.006));
  body.add(cylinderX(-0.032, 0, Z_RW, 0.014, 0.034, MAT.motor)); body.add(cylinderX(-0.004, 0, Z_RW, 0.004, 0.03, MAT.steel));
  const rw = new THREE.Group(); rw.position.set(0.008, 0, Z_RW); body.add(rw);       // rotation.x = reaction-wheel angle
  rw.add(mesh(new THREE.TorusGeometry(P.R_RW - 0.004, 0.005, 12, 64), MAT.alu, [0, 0, 0], [0, Math.PI / 2, 0]));
  rw.add(cylinderX(0, 0, 0, 0.009, 0.014, MAT.alu));
  for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3; rw.add(mesh(new THREE.BoxGeometry(0.006, P.R_RW - 0.008, 0.005), MAT.alu, [0, Math.cos(a) * (P.R_RW - 0.008) / 2, Math.sin(a) * (P.R_RW - 0.008) / 2], [a + Math.PI / 2 - Math.PI / 2, 0, 0])); }
  rw.children.slice(2).forEach((sp, k) => { const a = k * 2 * Math.PI / 3; sp.rotation.set(a, 0, 0); });
  // shadow disc
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.11, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.position.z = 0.0008; root.add(shadow);
  const label = labelSprite(kind.toUpperCase(), COL[kind]); label.position.set(0, 0, 0.36); root.add(label);
  return { root, wheel, body, rw, label, shadow };
}

/* ---------------------------------------------------------------- traces */
class Trace {
  constructor(canvas, opts) { this.c = canvas; this.opts = opts; this.data = { generative: [], conventional: [] }; this.span = opts.span || 6; }
  push(name, t, v) { const d = this.data[name]; d.push([t, v]); while (d.length && d[0][0] < t - this.span) d.shift(); }
  clear() { this.data = { generative: [], conventional: [] }; }
  draw(tNow) {
    const r = this.c.getBoundingClientRect(); if (!r.width) return; const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.c.width !== Math.round(r.width * dpr)) { this.c.width = Math.round(r.width * dpr); this.c.height = Math.round(r.height * dpr); }
    const ctx = this.c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const W = r.width, H = r.height;
    const ink = css('--ink') || '#151820', panel = css('--panel') || '#fdf6e2', ash = css('--ash') || '#8f8a7a';
    ctx.fillStyle = panel; ctx.fillRect(0, 0, W, H);
    const L = 34, T = 8, B = 16, Rr = 8; const pw = W - L - Rr, ph = H - T - B; const ylim = this.opts.ylim;
    const x = (t) => L + (t - (tNow - this.span)) / this.span * pw, y = (v) => T + ph / 2 - v / ylim * ph / 2;
    ctx.strokeStyle = 'rgba(128,128,128,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, y(0)); ctx.lineTo(W - Rr, y(0)); ctx.stroke();
    if (this.opts.band) { ctx.fillStyle = 'rgba(217,161,63,.25)'; ctx.fillRect(L, y(this.opts.band), pw, y(-this.opts.band) - y(this.opts.band)); }
    ctx.fillStyle = ash; ctx.font = '10px "Space Mono", monospace'; ctx.textAlign = 'right';
    ctx.fillText(String(ylim), L - 4, T + 8); ctx.fillText('0', L - 4, y(0) + 3); ctx.fillText(String(-ylim), L - 4, T + ph);
    ctx.textAlign = 'left'; ctx.fillStyle = ink; ctx.font = '600 11px Jost, sans-serif'; ctx.fillText(this.opts.label, L + 4, T + 10);
    ctx.fillStyle = ash; ctx.font = '9.5px "Space Mono", monospace'; ctx.textAlign = 'right'; ctx.fillText('last ' + this.span + ' s', W - Rr, H - 4);
    for (const name of ['generative', 'conventional']) {
      const d = this.data[name]; if (d.length < 2) continue;
      ctx.strokeStyle = COL[name]; ctx.lineWidth = 1.6; ctx.beginPath();
      d.forEach(([t, v], i) => { const px = x(t), py = Math.max(T, Math.min(T + ph, y(v))); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke();
      const [t, v] = d[d.length - 1]; ctx.fillStyle = COL[name]; ctx.beginPath(); ctx.arc(x(t), Math.max(T, Math.min(T + ph, y(v))), 3, 0, 2 * Math.PI); ctx.fill();
    }
  }
}

/* ---------------------------------------------------------------- the scene */
export function initScene(ui) {
  const canvas = ui.canvas; const vw = new Viewer(canvas, { fov: 28 });
  vw.camera.up.set(0, 0, 1); vw.controls.target.set(0, 0, 0.12); vw.controls.minDistance = 0.3; vw.controls.maxDistance = 4;
  const views = { chase: [1.15, -0.95, 0.55], front: [1.45, 0, 0.3], side: [0, -1.5, 0.3], top: [0.02, 0, 1.7], free: [1.15, -0.95, 0.55] };
  const setView = (v) => { vw.camera.position.set(...(views[v] || views.chase)); vw.controls.target.set(0, 0, 0.12); vw.controls.update(); };
  setView('chase');
  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ color: 0x1b1f2b, roughness: 0.95 })); ground.receiveShadow = true; vw.scene.add(ground);
  const grid = new THREE.GridHelper(6, 60, 0x3a4152, 0x2a3040); grid.rotation.x = Math.PI / 2; grid.position.z = 0.0005; vw.scene.add(grid);
  const robots = { generative: buildRobot('generative'), conventional: buildRobot('conventional') };
  vw.scene.add(robots.generative.root); vw.scene.add(robots.conventional.root);
  const sims = { generative: new Unicycle(GENERATIVE, { ...PAPER_GAINS }), conventional: new Unicycle(CONVENTIONAL, { ...PAPER_GAINS }) };
  const arrows = { generative: null, conventional: null };
  const traces = [new Trace(ui.plotPhi, { label: 'pitch [deg]', ylim: 8, band: 0.25 }), new Trace(ui.plotRho, { label: 'roll [deg]', ylim: 8, band: 0.25 }), new Trace(ui.plotTop, { label: 'top point [cm]', ylim: 15 })];
  const state = { mode: 'both', speed: 1, motors: true, tilt: 5, pushMag: 1.0, settled: {}, dropT: 0, tSim: 0, pushArrowT: {} };

  function layout() {
    const both = state.mode === 'both';
    robots.generative.root.visible = both || state.mode === 'generative'; robots.conventional.root.visible = both || state.mode === 'conventional';
    robots.generative.root.position.y = both ? 0.17 : 0; robots.conventional.root.position.y = both ? -0.17 : 0;
  }
  function applyGains() {
    const s = parseFloat(ui.gscale.value), g = {
      kp_pitch: parseFloat(ui.kp.value) * s, kd_pitch: parseFloat(ui.kd.value) * s, ki_pitch: PAPER_GAINS.ki_pitch * s, kp_x: parseFloat(ui.kx.value) * s, kd_x: PAPER_GAINS.kd_x * s,
      kp_roll: parseFloat(ui.kpr.value), kd_roll: parseFloat(ui.kdr.value), ki_roll: 0, kw: PAPER_GAINS.kw,
    };
    for (const n in sims) { sims[n].g = g; sims[n].delay = parseFloat(ui.delay.value) / 1000; sims[n].dtCtrl = parseFloat(ui.rate.value) / 1000; }
    ui.gainsOut.textContent = `Kp ${g.kp_pitch.toFixed(0)} · Kd ${g.kd_pitch.toFixed(1)} · Kx ${g.kp_x.toFixed(0)} V/rad, V/(rad/s), V/m · roll Kp ${g.kp_roll.toFixed(0)} · Kd ${g.kd_roll.toFixed(0)} · delay ${ui.delay.value} ms · period ${ui.rate.value} ms`;
  }
  function drop() {
    const tilt = state.tilt * Math.PI / 180;
    for (const n in sims) { sims[n].reset(tilt, tilt); state.settled[n] = null; }
    state.dropT = state.tSim; for (const t of traces) t.clear();
    for (const n in sims) { sims[n].fallAngle = Math.PI / 2.4; }
  }
  function push(dphid, drhod, who = null) {
    for (const n in sims) if (!who || who === n) if (!sims[n].fell) { sims[n].push(dphid * state.pushMag, drhod * state.pushMag); showArrow(n, dphid, drhod); }
  }
  function showArrow(n, dp, dr) {
    if (arrows[n]) { vw.scene.remove(arrows[n]); arrows[n] = null; }
    const dir = new THREE.Vector3(dp, -dr, 0).normalize(); const r = robots[n].root;
    const origin = new THREE.Vector3(r.position.x - dir.x * 0.22, r.position.y - dir.y * 0.22, 0.24);
    const a = new THREE.ArrowHelper(dir, origin, 0.12, YEL, 0.05, 0.03); vw.scene.add(a); arrows[n] = a; state.pushArrowT[n] = 0.5;
  }
  const noMotor = { kt: 1e-9, ke: 1e-9, R: 1, v_max: 0, b: 0 };
  function setMotors(on) { for (const n in sims) { sims[n].drive = on ? { kt: 0.12, ke: 0.12, R: 2.8, v_max: 11.1, b: 1e-4 } : noMotor; sims[n].rw = on ? { kt: 0.045, ke: 0.045, R: 1.5, v_max: 11.1, b: 2e-5 } : noMotor; } }

  vw.tick = (dt) => {
    const step = dt * state.speed; state.tSim += step;
    for (const n in sims) {
      if (!robots[n].root.visible) continue;
      const s = sims[n]; s.advance(step);
      const r = robots[n]; r.root.position.x = s.s[0]; r.root.rotation.x = s.s[4]; r.wheel.rotation.y = s.th1; r.body.rotation.y = s.s[2]; r.rw.rotation.x = s.s[6];
      r.shadow.position.x = 0; r.label.position.set(0, 0, 0.36);
      if (s.fell) { r.root.rotation.x = Math.sign(s.s[4] || 1) * Math.min(Math.abs(s.s[4]), Math.PI / 2.4); }
      const tRel = s.t;
      const inBand = Math.abs(s.s[2]) < 0.25 * Math.PI / 180 && Math.abs(s.s[4]) < 0.25 * Math.PI / 180;
      if (!inBand) state.settled[n] = { since: tRel, done: false }; else if (state.settled[n] && !state.settled[n].done && tRel - state.settled[n].since > 0.4) state.settled[n].done = true;
      traces[0].push(n, s.t, s.s[2] * 180 / Math.PI); traces[1].push(n, s.t, s.s[4] * 180 / Math.PI); traces[2].push(n, s.t, s.top * 100);
      if (arrows[n]) { state.pushArrowT[n] -= dt; if (state.pushArrowT[n] <= 0) { vw.scene.remove(arrows[n]); arrows[n] = null; } }
    }
    const tRef = Math.max(sims.generative.t, sims.conventional.t);
    for (const t of traces) t.draw(tRef);
    // HUD
    const rows = [];
    for (const n of ['generative', 'conventional']) {
      if (!robots[n].root.visible) continue; const s = sims[n];
      const st = s.fell ? '<b style="color:#E4442A">FELL</b>' : (state.settled[n] && state.settled[n].done ? `settled at <b>${state.settled[n].since.toFixed(2)} s</b>` : 'balancing…');
      rows.push(`<span style="color:${COL[n]};font-weight:700">${n}</span> · t ${s.t.toFixed(2)} s · pitch ${(s.s[2] * 180 / Math.PI).toFixed(2)}° · roll ${(s.s[4] * 180 / Math.PI).toFixed(2)}° · x ${(s.s[0] * 100).toFixed(1)} cm · wheel ${(s.s[7] * 60 / 2 / Math.PI).toFixed(0)} rpm · drive ${s.u1.toFixed(1)} V · P ${s.p.toFixed(0)} W · E ${s.energy.toFixed(1)} J · ${st}`);
    }
    ui.hud.innerHTML = rows.join('<br>');
  };

  // ---- wiring
  ui.mode.addEventListener('change', () => { state.mode = ui.mode.value; layout(); });
  ui.view.addEventListener('change', () => setView(ui.view.value));
  ui.reset.addEventListener('click', () => setView(ui.view.value));
  ui.tilt.addEventListener('input', () => { state.tilt = parseFloat(ui.tilt.value); ui.tiltOut.textContent = state.tilt.toFixed(0) + '°'; });
  ui.drop.addEventListener('click', drop);
  ui.pushMag.addEventListener('input', () => { state.pushMag = parseFloat(ui.pushMag.value); ui.pushOut.textContent = state.pushMag.toFixed(1) + ' rad/s'; });
  ui.pushF.addEventListener('click', () => push(1, 0)); ui.pushB.addEventListener('click', () => push(-1, 0)); ui.pushL.addEventListener('click', () => push(0, 1)); ui.pushR.addEventListener('click', () => push(0, -1));
  for (const el of [ui.kp, ui.kd, ui.kx, ui.kpr, ui.kdr, ui.gscale, ui.delay, ui.rate]) el.addEventListener('input', applyGains);
  ui.presetPaper.addEventListener('click', () => { ui.kp.value = PAPER_GAINS.kp_pitch; ui.kd.value = PAPER_GAINS.kd_pitch; ui.kx.value = PAPER_GAINS.kp_x; ui.kpr.value = PAPER_GAINS.kp_roll; ui.kdr.value = PAPER_GAINS.kd_roll; ui.gscale.value = 1; ui.delay.value = 0; ui.rate.value = 5; applyGains(); drop(); });
  ui.presetEdge.addEventListener('click', () => { ui.presetPaper.click(); ui.gscale.value = 1.5; applyGains(); drop(); });
  ui.presetDelay.addEventListener('click', () => { ui.presetPaper.click(); ui.delay.value = 35; applyGains(); drop(); });
  ui.motors.addEventListener('change', () => { state.motors = ui.motors.checked; setMotors(state.motors); drop(); });
  ui.speed.addEventListener('change', () => { state.speed = parseFloat(ui.speed.value); });
  canvas.addEventListener('keydown', (e) => {
    const k = e.key; let used = true;
    if (k === 'ArrowUp') push(1, 0); else if (k === 'ArrowDown') push(-1, 0); else if (k === 'ArrowLeft') push(0, 1); else if (k === 'ArrowRight') push(0, -1);
    else if (k === ' ') drop(); else used = false;
    if (used) e.preventDefault();
  });
  canvas.tabIndex = 0;
  canvas.addEventListener('pointerdown', () => canvas.focus());
  layout(); applyGains(); drop();
  ui.info.textContent = `Two identical controllers, two chassis. Unstable pitch poles: generative ${poles(GENERATIVE).pitch.toFixed(1)} /s, conventional ${poles(CONVENTIONAL).pitch.toFixed(1)} /s. Click the scene, then use the arrow keys to push and Space to re-drop.`;
  return { sims, drop, push };
}

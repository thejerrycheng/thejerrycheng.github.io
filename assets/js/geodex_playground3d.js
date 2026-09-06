/* =============================================================================
   geodex_playground3d.js — the GeoDEX retargeting playground, side by side in
   three dimensions: the operator's recorded Vision Pro hand on the left, the
   ORCA hand (its real MuJoCo meshes, posed by the same forward kinematics) on
   the right, both in the palm frame, synchronised frame by frame. Every term of
   the released cost is a slider. Engine: geodex_retarget.js (window.GEODEX).
   Data: assets/data/geodex_hand.json (kinematics + 134 recorded frames) and
         assets/data/geodex_hand_meshes.{json,bin} (per-body visual meshes).
   ============================================================================= */
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const FINGER = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const CHAINS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
const FCOL = [0xE4442A, 0xD9A13F, 0x3fbf5a, 0x2a78d6, 0x8e6bd1];
const TIPS = [4, 8, 12, 16, 20];
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------------------------------------------------------------- one view (renderer + camera) */
class View {
  constructor(canvas, clear) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); this.renderer.setClearColor(clear, 1);
    this.renderer.shadowMap.enabled = true;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.005, 5); this.camera.up.set(0, 0, 1);
    this.camera.position.set(0.16, -0.26, 0.20);
    this.controls = new OrbitControls(this.camera, canvas); this.controls.enableDamping = true; this.controls.dampingFactor = 0.1; this.controls.target.set(0, 0.04, 0.0);
    this.controls.minDistance = 0.12; this.controls.maxDistance = 1.2;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3f4d, 0.9));
    const key = new THREE.DirectionalLight(0xfff2dc, 1.5); key.position.set(0.3, -0.4, 0.6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -0.3; key.shadow.camera.right = key.shadow.camera.top = 0.3; key.shadow.camera.near = 0.05; key.shadow.camera.far = 2; this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x9ec5f4, 0.45); fill.position.set(-0.4, 0.3, 0.2); this.scene.add(fill);
    // a soft ground disc below the palm
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.16, 48), new THREE.MeshStandardMaterial({ color: 0x2a2f3c, roughness: 1 })); disc.position.z = -0.075; disc.receiveShadow = true; this.scene.add(disc);
    const grid = new THREE.GridHelper(0.4, 16, 0x4a5063, 0x353a48); grid.rotation.x = Math.PI / 2; grid.position.z = -0.0745; this.scene.add(grid);
    new ResizeObserver(() => this.resize()).observe(canvas); this.resize();
  }
  resize() { const w = this.canvas.clientWidth || 400, h = this.canvas.clientHeight || 300; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  render() { this.controls.update(); this.renderer.render(this.scene, this.camera); }
}

/* ---------------------------------------------------------------- the operator's hand (21 landmarks) */
export function makeHumanHand(scene) {
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b894, roughness: 0.75 });
  const g = new THREE.Group(); scene.add(g);
  const joints = {}; const bones = [];
  for (let k = 0; k <= 20; k++) {
    const r = k === 0 ? 0.012 : (TIPS.includes(k) ? 0.0085 : 0.0075);
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), TIPS.includes(k) ? new THREE.MeshStandardMaterial({ color: FCOL[TIPS.indexOf(k)], roughness: 0.6 }) : skin); m.castShadow = true; g.add(m); joints[k] = m;
  }
  const boneGeom = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
  const addBone = (a, b, r) => { const m = new THREE.Mesh(boneGeom, skin); m.castShadow = true; g.add(m); bones.push({ m, a, b, r }); };
  CHAINS.forEach((c) => { addBone(0, c[0], 0.0085); for (let i = 0; i < c.length - 1; i++) addBone(c[i], c[i + 1], 0.0072 - i * 0.0008); });
  // palm web between the wrist and the five finger bases
  const palmGeom = new THREE.BufferGeometry(); palmGeom.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 6), 3));
  palmGeom.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 1, 2, 3, 1, 3, 4, 1, 4, 5]); palmGeom.computeVertexNormals();
  const palm = new THREE.Mesh(palmGeom, new THREE.MeshStandardMaterial({ color: 0xe0ac88, roughness: 0.85, side: THREE.DoubleSide, transparent: true, opacity: 0.92 })); palm.castShadow = true; g.add(palm);
  const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
  return {
    group: g,
    set(tg) {
      const P = (k) => k === 0 ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(...tg[k]);
      for (let k = 0; k <= 20; k++) joints[k].position.copy(P(k));
      for (const b of bones) {
        const a = P(b.a), c = P(b.b); const L = a.distanceTo(c); b.m.position.copy(a).add(c).multiplyScalar(0.5); b.m.scale.set(b.r, L, b.r);
        b.m.quaternion.setFromUnitVectors(up, tmp.copy(c).sub(a).normalize());
      }
      const pos = palmGeom.attributes.position; const bases = [0, 1, 5, 9, 13, 17];
      bases.forEach((k, i) => { const p = P(k); pos.setXYZ(i, p.x, p.y, p.z); }); pos.needsUpdate = true; palmGeom.computeVertexNormals();
    },
  };
}

/* ---------------------------------------------------------------- the ORCA hand (real meshes) */
export async function makeOrcaHand(scene, kin, manifestUrl) {
  const man = await (await fetch(manifestUrl + '.json')).json();
  const buf = await (await fetch(manifestUrl + '.bin')).arrayBuffer();
  const P = new Float32Array(buf, 0, man.nvert * 3); const I = new Uint32Array(buf, man.nvert * 12, man.nindex);
  const matStruct = new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.55, metalness: 0.05 });
  const matPad = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.9 });
  const matPalm = new THREE.MeshStandardMaterial({ color: 0xd9d2bd, roughness: 0.6 });
  const groups = kin.bodies.map((b) => {
    const g = new THREE.Group(); scene.add(g);
    for (const part of (man.bodies[b.name] || [])) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(P.subarray(part.v0 * 3, (part.v0 + part.nv) * 3), 3));
      const idx = new Uint32Array(part.ni); for (let i = 0; i < part.ni; i++) idx[i] = I[part.i0 + i] - part.v0; geom.setIndex(new THREE.BufferAttribute(idx, 1));
      geom.computeVertexNormals();
      const m = new THREE.Mesh(geom, part.kind === 'pad' ? matPad : part.kind === 'palm' ? matPalm : matStruct); m.castShadow = true; m.receiveShadow = true; g.add(m);
    }
    return g;
  });
  // fingertip markers coloured per finger (at the exported keypoints)
  const tips = TIPS.map((k, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 14, 10), new THREE.MeshBasicMaterial({ color: FCOL[i], depthTest: false })); m.renderOrder = 5; scene.add(m); return m; });
  const tmpM = new THREE.Matrix4(), tmpR = new THREE.Matrix3();
  return {
    /** hand = GEODEX.Hand after fk(q): hand.pos[i], hand.rot[i] (row-major 3x3) in the model frame; rp = palm-frame keypoints */
    set(hand, rp) {
      const K = hand.k, pb = K.palm.body; const G = window.GEODEX;
      const palmR = G.mm(hand.rot[pb], G.quatToMat(K.palm.quat)); const palmP = G.add(hand.pos[pb], G.mv(hand.rot[pb], K.palm.pos));
      for (let i = 0; i < groups.length; i++) {
        const p = G.mtv(palmR, G.sub(hand.pos[i], palmP)); const R = G.mm([palmR[0], palmR[3], palmR[6], palmR[1], palmR[4], palmR[7], palmR[2], palmR[5], palmR[8]], hand.rot[i]);
        tmpM.set(R[0], R[1], R[2], p[0], R[3], R[4], R[5], p[1], R[6], R[7], R[8], p[2], 0, 0, 0, 1);
        tmpM.decompose(groups[i].position, groups[i].quaternion, groups[i].scale);
      }
      TIPS.forEach((k, i) => { tips[i].position.set(...rp[k]); });
    },
  };
}

/* ---------------------------------------------------------------- the playground */
export async function initPlayground3D(ui) {
  const G = window.GEODEX; if (!G) throw new Error('geodex_retarget.js must load first');
  const data = await (await fetch('assets/data/geodex_hand.json')).json();
  const hand = new G.Hand(data.kinematics);
  const left = new View(ui.canvasHuman, 0x151820), right = new View(ui.canvasRobot, 0x151820);
  const human = makeHumanHand(left.scene); const orca = await makeOrcaHand(right.scene, data.kinematics, 'assets/data/geodex_hand_meshes');
  // linked cameras: whichever the user drags, the other follows
  const link = (a, b) => a.controls.addEventListener('change', () => { if (ui.link.checked && !syncing) { syncing = true; b.camera.position.copy(a.camera.position); b.controls.target.copy(a.controls.target); b.controls.update(); syncing = false; } });
  let syncing = false; link(left, right); link(right, left);
  const S = { f: 0, q: new Float64Array(hand.n), playing: true, last: 0, hist: [] };
  const defaultScale = data.kinematics.scales || {};
  const weights = () => ({ rel: +ui.rel.value, cos: +ui.cos.value, smooth: +ui.smooth.value, pos: +ui.pos.value, reg: 0.02 });
  function target(f) {
    const raw = {}; data.keys.forEach((k, i) => raw[k] = data.trajectory[f][i]);
    // per-finger size factor relative to the exported calibration
    const tg = {};
    for (const k in raw) { const ci = CHAINS.findIndex(c => c.includes(+k)); const fac = ci >= 0 ? +ui.scale[ci].value / (defaultScale[FINGER[ci].toUpperCase()] || 1) : 1; tg[k] = raw[k].map(v => v * fac); }
    return tg;
  }
  function step() {
    const tg = target(S.f); const w = weights();
    hand.k.pinch_gate_sq = Math.pow(+ui.gate.value / 1000, 2);
    const t0 = performance.now(); const res = G.solve(hand, tg, S.q, w, { sweeps: 14 }); const ms = performance.now() - t0;
    S.q = res.q; const rp = hand.fk(S.q);
    human.set(tg); orca.set(hand, rp);
    const hp = G.norm(G.sub(tg[8], tg[4])) * 1000, rq = G.norm(G.sub(rp[8], rp[4])) * 1000;
    const errs = TIPS.map(k => G.norm(G.sub(rp[k], tg[k])) * 1000);
    S.hist.push({ h: hp, r: rq }); if (S.hist.length > 120) S.hist.shift();
    const pinching = hp < +ui.gate.value;
    ui.out.innerHTML = `frame <b>${S.f + 1}/${data.trajectory.length}</b> · cost <b>${res.f.toFixed(3)}</b> · ${res.evals} FK evals · <b>${ms.toFixed(1)} ms</b><br>` +
      `thumb–index &nbsp;operator <b>${hp.toFixed(1)} mm</b> &nbsp;ORCA <b>${rq.toFixed(1)} mm</b> &nbsp;pinch error <b class="${Math.abs(hp - rq) > 20 ? 'gd-bad' : 'gd-ok'}">${Math.abs(hp - rq).toFixed(1)} mm</b>${pinching ? ' <span class="gd-gate">pinching · ×5 boost on</span>' : ''}<br>` +
      `fingertip error [mm] &nbsp;` + errs.map((e, i) => `<span style="color:#${FCOL[i].toString(16).padStart(6, '0')}">${FINGER[i]} ${e.toFixed(0)}</span>`).join(' · ');
    spark(); ui.scrub.value = S.f;
  }
  function spark() {
    const c = ui.spark; const r = c.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); const w = r.width, h = r.height;
    g.fillStyle = css('--panel') || '#fdf6e2'; g.fillRect(0, 0, w, h);
    const hist = S.hist; if (hist.length < 2) return; const max = 160, pad = 18;
    const X = (i) => pad + i / (hist.length - 1) * (w - pad * 1.4), Y = (v) => h - pad + 6 - Math.min(v, max) / max * (h - pad * 1.6);
    g.strokeStyle = 'rgba(128,128,128,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(pad, h - pad + 6); g.lineTo(w - pad * .4, h - pad + 6); g.stroke();
    [['h', css('--ink') || '#151820', 2], ['r', '#E4442A', 1.7]].forEach(([key, col, lw]) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); hist.forEach((p, i) => i ? g.lineTo(X(i), Y(p[key])) : g.moveTo(X(i), Y(p[key]))); g.stroke(); });
    g.fillStyle = css('--ash') || '#8f8a7a'; g.font = '10px "Space Mono", monospace'; g.fillText('thumb–index distance [mm] — operator (ink) — ORCA (red)', pad, 12);
  }
  function tick(ts) {
    if (S.playing && ts - S.last > 1000 / (data.fps * (+ui.speed.value))) { S.f = (S.f + 1) % data.trajectory.length; S.last = ts; step(); }
    left.render(); right.render(); requestAnimationFrame(tick);
  }
  const relabel = () => { ui.relOut.textContent = ui.rel.value; ui.cosOut.textContent = ui.cos.value; ui.smoothOut.textContent = ui.smooth.value; ui.posOut.textContent = ui.pos.value; ui.gateOut.textContent = ui.gate.value + ' mm'; ui.scale.forEach((s, i) => ui.scaleOut[i].textContent = (+s.value).toFixed(2)); };
  for (const el of [ui.rel, ui.cos, ui.smooth, ui.pos, ui.gate, ...ui.scale]) el.addEventListener('input', () => { relabel(); S.hist = []; step(); });
  ui.scrub.max = data.trajectory.length - 1;
  ui.scrub.addEventListener('input', () => { S.f = +ui.scrub.value; S.playing = false; ui.play.textContent = 'Play'; step(); });
  ui.play.addEventListener('click', () => { S.playing = !S.playing; ui.play.textContent = S.playing ? 'Pause' : 'Play'; });
  ui.speed.addEventListener('input', () => ui.speedOut.textContent = ui.speed.value + '×');
  const presets = {
    paper: { rel: 100, cos: 50, smooth: 0.5, pos: 0 }, nopinch: { rel: 0, cos: 50, smooth: 0.5, pos: 0 }, joint: { rel: 0, cos: 0, smooth: 0.5, pos: 400 }, cosonly: { rel: 0, cos: 50, smooth: 0, pos: 0 },
  };
  for (const b of ui.presetButtons) b.addEventListener('click', () => { const p = presets[b.dataset.preset]; ui.rel.value = p.rel; ui.cos.value = p.cos; ui.smooth.value = p.smooth; ui.pos.value = p.pos; ui.gate.value = Math.round(Math.sqrt(data.kinematics.pinch_gate_sq) * 1000); ui.scale.forEach((s, i) => s.value = defaultScale[FINGER[i].toUpperCase()] || 1); relabel(); S.q = new Float64Array(hand.n); S.hist = []; step(); });
  ui.gate.value = Math.round(Math.sqrt(data.kinematics.pinch_gate_sq) * 1000); ui.scale.forEach((s, i) => s.value = defaultScale[FINGER[i].toUpperCase()] || 1); relabel();
  ui.resetView.addEventListener('click', () => { for (const v of [left, right]) { v.camera.position.set(0.16, -0.26, 0.20); v.controls.target.set(0, 0.04, 0); v.controls.update(); } });
  step(); requestAnimationFrame(tick);
  return { hand, data };
}

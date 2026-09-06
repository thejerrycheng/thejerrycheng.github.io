/* =============================================================================
   aerohaptix_scene3d.js — the interactive three.js scenes of the AeroHaptix page.
   1. suit():   a torso wearing the 32 vibration units at the positions the paper's
                directions map to, with the chain wiring, the direction rays, the
                46-actuator grid of the perception study, and a "poke" mode that
                lights the actuator MultiCBF would drive for any obstacle direction.
   2. unit():   the exploded vibration unit (cap, PCB, enclosure, VCA, cloth, ring).
   3. tunnel(): the study tunnel in 3-D: replay of the simulated flights (chase,
                first-person, top and free cameras, barrier shells, inputs), or fly
                it yourself with the keyboard / an Xbox controller through the same
                MultiCBF loop, with the cues on the suit and on the body map.
   Data: assets/data/aerohaptix_scene.json (experiments/export_web.py).
   ============================================================================= */
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { PARAMS, V, makeLayout, tunnelFromJson, randomTunnel, contacts, progress, globalSafe, renderCues, bodyPositions, torsoRadii, TORSO, buildBodyMap, selectActuator } from './aerohaptix_cbf.js';

const INK = 0x151820, CREAM = 0xF4EAD2, RED = 0xE4442A, YEL = 0xFFCE0A, GOLD = 0xD9A13F;
const KIND = { cube: 0x39d24a, sphere: 0x35d6e8, cylinder: 0xc9e23a };
const RING = { 30: 0xFFCE0A, 60: 0x7ED957, 90: 0x4FA3FF, 120: 0xc58cff };
const DATA_URL = 'assets/data/aerohaptix_scene.json';
const bus = { active: [], listeners: [], emit(a) { this.active = a; for (const f of this.listeners) f(a); }, on(f) { this.listeners.push(f); } };
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/* ---------------------------------------------------------------- viewer */
class Viewer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); this.renderer.setClearColor(opts.clear ?? INK, 1);
    this.scene = new THREE.Scene();
    if (opts.fog) this.scene.fog = new THREE.Fog(opts.clear ?? INK, opts.fog[0], opts.fog[1]);
    this.camera = new THREE.PerspectiveCamera(opts.fov || 45, 1, opts.near || 0.01, opts.far || 200);
    this.controls = new OrbitControls(this.camera, canvas); this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    const hemi = new THREE.HemisphereLight(0xffffff, 0x334455, opts.hemi ?? 0.9); this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff2dc, opts.key ?? 1.6); key.position.set(2, 1.5, 3); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x9ec5f4, 0.5); fill.position.set(-3, -1, 1); this.scene.add(fill);
    this.visible = true; this.tick = null; this.clock = new THREE.Clock();
    new ResizeObserver(() => this.resize()).observe(canvas); this.resize();
    if ('IntersectionObserver' in window) new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; }, { threshold: 0.02 }).observe(canvas);
    const loop = () => { requestAnimationFrame(loop); if (!this.visible) return; const dt = Math.min(0.1, this.clock.getDelta()); this.controls.update(); if (this.tick) this.tick(dt); this.render(); };
    requestAnimationFrame(loop);
  }
  resize() { const w = this.canvas.clientWidth || 600, h = this.canvas.clientHeight || 400; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  render() { this.renderer.render(this.scene, this.camera); }
}
function labelSprite(text, color = '#F4EAD2', px = 22) {
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d'); ctx.font = `bold ${px}px Jost, Arial, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 14, h = px + 10; cv.width = w * 2; cv.height = h * 2; ctx.scale(2, 2);
  ctx.font = `bold ${px}px Jost, Arial, sans-serif`; ctx.fillStyle = 'rgba(21,24,32,0.7)'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, 7, h / 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false })); sp.scale.set(w / 1400, h / 1400, 1); sp.renderOrder = 20; return sp;
}
let glowTex = null;
function glow() { if (glowTex) return glowTex; const cv = document.createElement('canvas'); cv.width = cv.height = 128; const ctx = cv.getContext('2d'); const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255,90,60,1)'); g.addColorStop(0.35, 'rgba(255,70,40,0.55)'); g.addColorStop(1, 'rgba(255,60,30,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); glowTex = new THREE.CanvasTexture(cv); return glowTex; }

/* ---------------------------------------------------------------- torso */
function torsoGeometry(rings = 28, segs = 56) {
  const pos = [], idx = [];
  for (let r = 0; r <= rings; r++) {
    const z = TORSO.bottom + (TORSO.top - TORSO.bottom) * r / rings; const [w, d] = torsoRadii(z);
    for (let s = 0; s <= segs; s++) { const t = 2 * Math.PI * s / segs, c = Math.cos(t), sn = Math.sin(t); pos.push(d * Math.sign(c) * Math.pow(Math.abs(c), 2 / TORSO.n), w * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / TORSO.n), z); }
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < segs; s++) { const a = r * (segs + 1) + s, b = a + segs + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const top = pos.length / 3; pos.push(0, 0, TORSO.top); for (let s = 0; s < segs; s++) idx.push(rings * (segs + 1) + s, rings * (segs + 1) + s + 1, top);
  const bot = pos.length / 3; pos.push(0, 0, TORSO.bottom); for (let s = 0; s < segs; s++) idx.push(s + 1, s, bot);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function mannequin(fabric = 0x24357a) {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: fabric, roughness: 0.92, metalness: 0.0 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x9aa0ad, roughness: 0.7 });
  g.add(new THREE.Mesh(torsoGeometry(), cloth));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.07, 24), skin); neck.rotation.x = Math.PI / 2; neck.position.z = TORSO.top + 0.03; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 24), skin); head.scale.set(0.85, 0.9, 1.1); head.position.z = TORSO.top + 0.17; g.add(head);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.3, 6, 16), cloth); arm.position.set(0, s * (torsoRadii(TORSO.top - 0.02)[0] + 0.06), TORSO.top - 0.2); arm.rotation.x = s * 0.12; g.add(arm); }
  return g;
}

/* ---------------------------------------------------------------- 1. the suit */
function suitScene(canvas, data, ui) {
  const layout = makeLayout(data.layout);
  const vw = new Viewer(canvas, { fov: 34, near: 0.01, far: 20, clear: 0x10131b });
  vw.camera.position.set(1.15, 0.85, 0.45); vw.camera.up.set(0, 0, 1); vw.controls.target.set(0, 0, 0.0); vw.controls.minDistance = 0.45; vw.controls.maxDistance = 4;
  vw.scene.add(mannequin());
  const P = bodyPositions(layout);
  const units = [], halos = [], rays = new THREE.Group(), labels = new THREE.Group(), wires = new THREE.Group(), grid46 = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0xe9e4d6, roughness: 0.55 });
  layout.dirs.forEach((d, i) => {
    const p = P[i]; const n = Math.abs(p[2]) > TORSO.top - 0.012 ? [0, 0, 1] : V.unit([p[0], p[1], 0]);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.022, 0.012), shell.clone()); m.userData.i = i;
    m.position.copy(v3(p)).addScaledVector(v3(n), 0.006); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v3(n));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.004, 16), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, emissive: 0xff2a10, emissiveIntensity: 0 })); core.rotation.x = Math.PI / 2; core.position.z = 0.006; m.add(core); m.userData.core = core;
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })); h.scale.set(0.08, 0.08, 1); h.position.copy(m.position).addScaledVector(v3(n), 0.01); vw.scene.add(h); halos.push(h);
    vw.scene.add(m); units.push(m);
    const ring = RING[Math.round(layout.theta[i])] || 0xffffff;
    const rg = new THREE.BufferGeometry().setFromPoints([m.position.clone(), m.position.clone().addScaledVector(v3(d), 0.11)]);
    rays.add(new THREE.Line(rg, new THREE.LineBasicMaterial({ color: ring, transparent: true, opacity: 0.85 })));
    const lb = labelSprite(String(layout.ids[i]), '#' + new THREE.Color(ring).getHexString(), 18); lb.position.copy(m.position).addScaledVector(v3(n), 0.03); labels.add(lb);
  });
  vw.scene.add(rays, labels, wires, grid46); labels.visible = false;
  /* chains: a control unit on the upper back, one wire per chain through its units in file order */
  const ctrl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.075, 0.018), new THREE.MeshStandardMaterial({ color: 0x1d1f26, roughness: 0.5 })); ctrl.position.set(-(torsoRadii(0.2)[1] + 0.012), 0, 0.2); wires.add(ctrl);
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.6 });
  for (let ch = 0; ch < 4; ch++) {
    const members = layout.ids.map((id, i) => i).filter(i => layout.chains[i] === ch);
    if (!members.length) continue;
    const pts = [ctrl.position.clone().add(new THREE.Vector3(-0.01, (ch - 1.5) * 0.012, 0))];
    for (const i of members) pts.push(units[i].position.clone().addScaledVector(units[i].position.clone().setZ(0).normalize(), 0.008));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.3);
    wires.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24 * pts.length, 0.0022, 6, false), wireMat));
  }
  /* the 46-unit grid of the perception study */
  const gridMat = new THREE.MeshStandardMaterial({ color: 0xe4442a, roughness: 0.5, transparent: true, opacity: 0.85 });
  const gpts = [];
  for (const sx of [1, -1]) for (const y of [-0.09, 0, 0.09]) for (const z of [-0.30, -0.18, -0.06, 0.06, 0.18, 0.30]) { const [w, d] = torsoRadii(z); const x = d * Math.pow(1 - Math.pow(Math.abs(y) / w, TORSO.n), 1 / TORSO.n); gpts.push([sx * x, y, z]); }
  for (const sy of [1, -1]) for (const z of [-0.30, -0.18, -0.06]) gpts.push([0, sy * torsoRadii(z)[0], z]);
  for (const sy of [1, -1]) for (const x of [-0.04, 0.04]) gpts.push([x, sy * 0.13, TORSO.top - 0.003]);
  for (const p of gpts) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 10), gridMat); s.position.copy(v3(p)); grid46.add(s); }
  grid46.visible = false;
  /* the poke orb */
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 18), new THREE.MeshStandardMaterial({ color: KIND.sphere, emissive: 0x0b5560, emissiveIntensity: 0.6 })); orb.visible = false; vw.scene.add(orb);
  const orbLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: YEL, dashSize: 0.02, gapSize: 0.012 })); orbLine.visible = false; vw.scene.add(orbLine);
  const pokeSphere = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshBasicMaterial({ visible: false })); vw.scene.add(pokeSphere);
  const bodyMap = buildBodyMap(ui.body, layout, { onHover: (i) => { hover = i; } });
  let hover = -1, active = [], t = 0, pokeDir = null, orbitOn = false;
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let ptrIn = false;
  canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ptrIn = true; });
  canvas.addEventListener('pointerleave', () => { ptrIn = false; hover = -1; });
  function setPoke(dir, duty) {
    pokeDir = dir; const sel = selectActuator(layout.dirs, dir);
    active = sel.idx.map(i => [i, duty]);
    orb.visible = true; orb.position.copy(v3(dir).multiplyScalar(0.55));
    const hit = units[sel.idx[0]].position; orbLine.geometry.setFromPoints([orb.position.clone(), hit.clone()]); orbLine.computeLineDistances(); orbLine.visible = true;
    const th = Math.acos(dir[2]) * 180 / Math.PI, ph = Math.atan2(dir[1], dir[0]) * 180 / Math.PI;
    ui.info.innerHTML = `obstacle direction ϑ = ${th.toFixed(0)}°, φ = ${ph.toFixed(0)}° → actuator <b>#${sel.idx.map(i => layout.ids[i]).join(', #')}</b> (${sel.errDeg.toFixed(1)}° off the exact direction), duty ${duty}/15${sel.idx.length > 1 ? ' — a tie: the study code drives every equally aligned unit' : ''}`;
  }
  function clearPoke() { pokeDir = null; orb.visible = false; orbLine.visible = false; active = []; }
  vw.tick = (dt) => {
    t += dt;
    const mode = ui.mode.value;
    if (mode === 'flight') { active = bus.active; orb.visible = false; orbLine.visible = false; ui.info.textContent = active.length ? 'linked to the tunnel replay above: ' + active.map(([i, d]) => `#${layout.ids[i]} duty ${d}`).join(', ') : 'linked to the tunnel replay: no cue right now'; }
    else if (mode === 'sliders') setPoke(sph(+ui.theta.value, +ui.phi.value), +ui.duty.value);
    else if (mode === 'orbit') { const ph = (t * 40) % 360, th = 75 + 40 * Math.sin(t * 0.7); ui.theta.value = th.toFixed(0); ui.phi.value = ph.toFixed(0); setPoke(sph(th, ph), 8 + Math.round(7 * Math.sin(t * 2.1))); }
    else if (mode === 'hover') {
      if (ptrIn) { ray.setFromCamera(ptr, vw.camera); const hu = ray.intersectObjects(units, false); if (hu.length) { hover = hu[0].object.userData.i; clearPoke(); ui.info.innerHTML = describe(hover); } else { const hs = ray.intersectObject(pokeSphere, false); if (hs.length) { hover = -1; setPoke(V.unit([hs[0].point.x, hs[0].point.y, hs[0].point.z]), 12); } } }
      else if (!pokeDir) ui.info.textContent = 'move the pointer over the scene: over a unit to read it, around the body to place an obstacle in that direction';
    }
    const duty = new Map(active);
    units.forEach((m, i) => {
      const d = duty.get(i) || 0, pulse = d ? 0.55 + 0.45 * Math.sin(t * (6 + 0.6 * d)) : 0;
      m.userData.core.material.emissiveIntensity = d ? 0.8 + 2.5 * pulse * d / 15 : 0;
      m.material.color.setHex(i === hover ? 0xffe28a : (d ? 0xffc9b8 : 0xe9e4d6));
      halos[i].material.opacity = d ? 0.35 + 0.55 * pulse * d / 15 : 0; halos[i].scale.setScalar(0.06 + 0.14 * d / 15 * (0.7 + 0.3 * pulse));
    });
    bodyMap.setActive(active); bodyMap.setHover(hover);
  };
  function describe(i) { const p = P[i]; return `motor <b>#${layout.ids[i]}</b> · direction ϑ = ${layout.theta[i]}°, φ = ${layout.phi[i]}° · chain ${layout.chains[i] + 1} · position (${p.map(x => (100 * x).toFixed(0)).join(', ')}) cm from the torso centre`; }
  function sph(th, ph) { const a = th * Math.PI / 180, b = ph * Math.PI / 180; return [Math.sin(a) * Math.cos(b), Math.sin(a) * Math.sin(b), Math.cos(a)]; }
  ui.rays.addEventListener('change', () => rays.visible = ui.rays.checked); ui.wires.addEventListener('change', () => wires.visible = ui.wires.checked);
  ui.labels.addEventListener('change', () => labels.visible = ui.labels.checked); ui.grid.addEventListener('change', () => grid46.visible = ui.grid.checked);
  ui.mode.addEventListener('change', () => { clearPoke(); ui.sliders.hidden = !(ui.mode.value === 'sliders' || ui.mode.value === 'orbit'); });
  ui.reset.addEventListener('click', () => { vw.camera.position.set(1.15, 0.85, 0.45); vw.controls.target.set(0, 0, 0); });
  ui.view.addEventListener('change', () => { const v = ui.view.value; const d = 1.5; const pos = { front: [d, 0, 0.1], back: [-d, 0, 0.1], left: [0, -d, 0.1], right: [0, d, 0.1], top: [0.01, 0, d], iso: [1.15, 0.85, 0.45] }[v]; vw.camera.position.set(...pos); vw.controls.target.set(0, 0, 0); });
  return { layout };
}

/* ---------------------------------------------------------------- 2. the exploded unit */
function unitScene(canvas, ui) {
  const vw = new Viewer(canvas, { fov: 30, near: 0.001, far: 5, clear: 0x10131b });
  vw.camera.position.set(0.075, -0.09, 0.075); vw.camera.up.set(0, 0, 1); vw.controls.target.set(0, 0, 0.012); vw.controls.minDistance = 0.04; vw.controls.maxDistance = 0.5;
  const mm = 0.001, L = 32 * mm, W = 22 * mm;
  const plastic = new THREE.MeshStandardMaterial({ color: 0xf0ece2, roughness: 0.5 }), plastic2 = new THREE.MeshStandardMaterial({ color: 0xe6e1d3, roughness: 0.6 });
  const parts = [];
  function part(mesh, z0, spread, label) { mesh.userData = { z0, spread }; const lb = labelSprite(label, '#F4EAD2', 16); lb.position.set(L / 2 + 0.006, 0, 0); mesh.add(lb); mesh.userData.label = lb; vw.scene.add(mesh); parts.push(mesh); return mesh; }
  /* bottom ring */
  const ring = new THREE.Group();
  for (const [x, y, w, h] of [[0, -W / 2 + 1 * mm, L + 3 * mm, 2 * mm], [0, W / 2 - 1 * mm, L + 3 * mm, 2 * mm], [-L / 2 - 0.5 * mm, 0, 2 * mm, W + 2 * mm], [L / 2 + 0.5 * mm, 0, 2 * mm, W + 2 * mm]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2 * mm), new THREE.MeshStandardMaterial({ color: 0xb59a5a, metalness: 0.5, roughness: 0.4 })); b.position.set(x, y, 0); ring.add(b); }
  part(ring, 0, 0, 'bottom ring (press-fit)');
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(L + 6 * mm, W + 6 * mm, 0.7 * mm), new THREE.MeshStandardMaterial({ color: 0x24357a, roughness: 1 })); part(cloth, 2 * mm, 5 * mm, 'cloth layer (the garment)');
  const enc = new THREE.Group();
  for (const [x, y, w, h] of [[0, -W / 2 + 0.75 * mm, L, 1.5 * mm], [0, W / 2 - 0.75 * mm, L, 1.5 * mm], [-L / 2 + 0.75 * mm, 0, 1.5 * mm, W], [L / 2 - 0.75 * mm, 0, 1.5 * mm, W]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 9 * mm), plastic2); b.position.set(x, y, 4.5 * mm); enc.add(b); }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(L, W, 1 * mm), plastic2); floor.position.z = 0.5 * mm; enc.add(floor);
  part(enc, 3 * mm, 9 * mm, 'rectangular enclosure');
  const vca = new THREE.Group();
  const coil = new THREE.Mesh(new THREE.CylinderGeometry(8.5 * mm, 8.5 * mm, 4.5 * mm, 32), new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.45, metalness: 0.3 })); coil.rotation.x = Math.PI / 2; coil.position.z = 2.25 * mm; vca.add(coil);
  const mag = new THREE.Mesh(new THREE.CylinderGeometry(4 * mm, 4 * mm, 1.2 * mm, 24), new THREE.MeshStandardMaterial({ color: 0x8c8c94, metalness: 0.8, roughness: 0.3 })); mag.rotation.x = Math.PI / 2; mag.position.z = 5.1 * mm; vca.add(mag);
  part(vca, 4 * mm, 16 * mm, 'voice-coil actuator HD-VA3222 (80–500 Hz)');
  const pcb = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(26 * mm, 16 * mm, 1 * mm), new THREE.MeshStandardMaterial({ color: 0x1f7a3a, roughness: 0.6 })); pcb.add(board);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(4 * mm, 4 * mm, 1.2 * mm), new THREE.MeshStandardMaterial({ color: 0x111111 })); chip.position.set(-4 * mm, 0, 1.1 * mm); pcb.add(chip);
  const drv = new THREE.Mesh(new THREE.BoxGeometry(3 * mm, 3 * mm, 1 * mm), new THREE.MeshStandardMaterial({ color: 0x222222 })); drv.position.set(4 * mm, 3 * mm, 1 * mm); pcb.add(drv);
  for (const s of [-1, 1]) { const con = new THREE.Mesh(new THREE.BoxGeometry(3 * mm, 5 * mm, 3 * mm), new THREE.MeshStandardMaterial({ color: 0xd9d9d9 })); con.position.set(s * 10.5 * mm, -4 * mm, 1.5 * mm); pcb.add(con); }
  part(pcb, 10 * mm, 24 * mm, 'PCB: PIC16F18313 + DRV8837 H-bridge, UART in/out');
  const cap = new THREE.Mesh(new THREE.BoxGeometry(L, W, 2 * mm), plastic); part(cap, 12 * mm, 33 * mm, 'cap');
  vw.tick = () => { const s = +ui.explode.value / 100; for (const p of parts) { p.position.z = p.userData.z0 + s * p.userData.spread; p.userData.label.visible = s > 0.35; } };
}

/* ---------------------------------------------------------------- 3. the tunnel */
function gridTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const ctx = cv.getContext('2d');
  ctx.fillStyle = '#2b3140'; ctx.fillRect(0, 0, 256, 256); ctx.strokeStyle = '#4a5468'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, 253, 253);
  ctx.strokeStyle = '#3a4356'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.moveTo(0, 128); ctx.lineTo(256, 128); ctx.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function ringPoints(a, n, N = 48) { const out = []; for (let k = 0; k <= N; k++) { const t = 2 * Math.PI * k / N, c = Math.cos(t), s = Math.sin(t); out.push([a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), a * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]); } return out; }
function shellSegments(o) {
  const pts = [];
  const push = (poly) => { for (let k = 0; k < poly.length - 1; k++) pts.push(...poly[k], ...poly[k + 1]); };
  if (o.kind === 'cylinder') {
    const ring = ringPoints(o.a, 2, 40); const [i, j] = o.idx;
    for (const off of [-2.5, 0, 2.5]) push(ring.map(([x, y]) => { const p = [0, 0, 0]; p[i] = o.c[i] + x; p[j] = o.c[j] + y; p[o.axis] = o.c[o.axis] + off; return p; }));
    for (let k = 0; k < 40; k += 5) { const p0 = [0, 0, 0]; p0[i] = o.c[i] + ring[k][0]; p0[j] = o.c[j] + ring[k][1]; p0[o.axis] = o.c[o.axis] - 2.5; const p1 = p0.slice(); p1[o.axis] = o.c[o.axis] + 2.5; push([p0, p1]); }
  } else {
    const ring = ringPoints(o.a, o.n, 48);
    for (const [i, j, k] of [[0, 1, 2], [0, 2, 1], [1, 2, 0]]) for (const frac of [0, 0.6, -0.6]) { const rem = Math.pow(1 - Math.pow(Math.abs(frac), o.n), 1 / o.n); push(ring.map(([x, y]) => { const p = [0, 0, 0]; p[i] = o.c[i] + x * rem; p[j] = o.c[j] + y * rem; p[k] = o.c[k] + frac * o.a; return p; })); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return g;
}
function buildTunnel(T, scene) {
  const grp = new THREE.Group(); const tex = gridTexture();
  for (const w of T.walls) {
    const t2 = tex.clone(); t2.repeat.set(T.length / 2.5, T.width / 2.5); t2.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(T.length, T.width), new THREE.MeshBasicMaterial({ map: t2, side: THREE.DoubleSide }));
    const tV = v3(T.t), nV = v3(w.nrm), u2 = new THREE.Vector3().crossVectors(nV, tV);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tV, u2, nV)); m.position.copy(v3(w.p)).addScaledVector(tV, T.length / 2); grp.add(m);
  }
  const shells = [];
  T.obstacles.forEach((o, i) => {
    let mesh;
    const mat = new THREE.MeshStandardMaterial({ color: KIND[o.kind], roughness: 0.55, metalness: 0.05 });
    if (o.kind === 'cube') mesh = new THREE.Mesh(new THREE.BoxGeometry(o.size, o.size, o.size), mat);
    else if (o.kind === 'sphere') mesh = new THREE.Mesh(new THREE.SphereGeometry(o.half, 32, 24), mat);
    else { mesh = new THREE.Mesh(new THREE.CylinderGeometry(o.half, o.half, T.width, 32), mat); if (o.axis === 2) mesh.rotation.x = Math.PI / 2; else if (o.axis === 0) mesh.rotation.z = -Math.PI / 2; }
    mesh.position.copy(v3(o.c)); grp.add(mesh);
    if (o.kind !== 'sphere') grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0x0d1017 })).copy(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0x0d1017 }))).translateX(0));
    const sh = new THREE.LineSegments(shellSegments(o), new THREE.LineBasicMaterial({ color: 0x9aa3b5, transparent: true, opacity: 0.3 })); grp.add(sh); shells.push(sh);
  });
  /* goal gate */
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(T.width, T.width), new THREE.MeshBasicMaterial({ color: 0x2e9e5b, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
  gate.position.copy(v3(T.t).multiplyScalar(T.length)); gate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v3(T.t)); grp.add(gate);
  scene.add(grp);
  return { group: grp, shells };
}
function droneModel() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b3140, roughness: 0.5, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.07), dark); g.add(body);
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, 0.02), dark); arm.position.set(sx * 0.13, sy * 0.13, 0); arm.rotation.z = sx * sy * Math.PI / 4; g.add(arm);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.006, 24), new THREE.MeshStandardMaterial({ color: 0xcfd3dc, transparent: true, opacity: 0.55 })); rotor.rotation.x = Math.PI / 2; rotor.position.set(sx * 0.25, sy * 0.25, 0.02); g.add(rotor); g.userData[`rotor${sx}${sy}`] = rotor;
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), new THREE.MeshStandardMaterial({ color: 0xff3322, emissive: 0xff2211, emissiveIntensity: 1.2 })); led.position.set(0.13, 0, 0.02); g.add(led);
  const cam = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0x111111 })); cam.rotation.z = -Math.PI / 2; cam.position.set(0.14, 0, -0.01); g.add(cam);
  return g;
}

function tunnelScene(canvas, data, ui) {
  const layout = makeLayout(data.layout);
  const vw = new Viewer(canvas, { fov: 60, near: 0.05, far: 200, clear: 0x0d1017, fog: [30, 90], hemi: 0.8, key: 1.2 });
  vw.camera.up.set(0, 0, 1);
  const insetCam = new THREE.PerspectiveCamera(90, 16 / 9, 0.05, 200); insetCam.up.set(0, 0, 1);
  const bodyMap = buildBodyMap(ui.body, layout);
  const drone = droneModel(); vw.scene.add(drone);
  const arrows = { v: new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0x4fa3ff, 0.2, 0.1), ur: new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0xffffff, 0.2, 0.1), us: new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0x7ed957, 0.2, 0.1) };
  for (const a of Object.values(arrows)) vw.scene.add(a);
  const TRAIL = 900; const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3)); trailGeo.setDrawRange(0, 0);
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })); vw.scene.add(trail); let trailN = 0;
  const hits = new THREE.Group(); vw.scene.add(hits);
  const cueLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: YEL, dashSize: 0.25, gapSize: 0.15 })); vw.scene.add(cueLines);
  let T = null, built = null, mode = 'replay', flight = null, playing = true, tPlay = 0, live = null;
  const state = { q: [0, 0, 0], v: [0, 0, 0], ur: [0, 0, 0], us: [0, 0, 0], h: [], active: [], cues: [], t: 0, collisions: 0, disSum: 0, disN: 0, done: false };

  function loadTunnel(tj) {
    if (built) { vw.scene.remove(built.group); }
    T = tunnelFromJson(tj); built = buildTunnel(T, vw.scene);
    hits.clear(); trailN = 0; trailGeo.setDrawRange(0, 0);
    vw.camera.position.copy(v3(T.t).multiplyScalar(-6.5).add(v3(camUp()).multiplyScalar(2.4))); vw.controls.target.set(0, 0, 0);
  }
  const camUp = () => T.direction === 'upward' ? [1, 0, 0] : T.s2;
  function addHit(q) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xffcc00, transparent: true, depthWrite: false })); s.scale.set(0.6, 0.6, 1); s.position.copy(v3(q)); hits.add(s); }

  function setFlight(idx) {
    mode = 'replay'; flight = data.flights[idx]; loadTunnel(flight.tunnel); tPlay = 0; playing = true; ui.play.textContent = 'Pause'; ui.flight.value = String(idx); state.lastK = -1;
    ui.scrub.max = flight.frames.length - 1; ui.livePanel.hidden = true; ui.replayPanel.hidden = false;
    state.collisions = 0; state.disSum = 0; state.disN = 0;
    ui.caption.innerHTML = `<b>${flight.direction}</b> tunnel, seed ${flight.seed}, <b>${flight.cond === 'NA' ? 'no feedback' : 'vibrotactile shared control'}</b> · ${flight.metrics.collisions} collisions, ${flight.metrics.distance.toFixed(1)} m in ${flight.metrics.time.toFixed(1)} s, mean |u_ref − u_safe| ${flight.metrics.disagreement.toFixed(2)} m/s², cues ${Math.round(100 * flight.metrics.cue_frac)} % of the time`;
  }
  function startLive() {
    mode = 'live'; const dir = ui.liveDir.value, seed = +ui.liveSeed.value;
    const src = data.flights.find(f => f.direction === dir);
    const tj = (seed === 0 && src) ? src.tunnel : randomTunnel(dir, seed).toJson();
    loadTunnel(tj); ui.livePanel.hidden = false; ui.replayPanel.hidden = true;
    live = { q: [0, 0, 0], v: [0, 0, 0], stick: [0, 0, 0], t: 0, acc: 0, inContact: new Set(), collisions: 0, dist: 0, disSum: 0, disN: 0, done: false, cueFrames: 0 };
    hits.clear(); trailN = 0; trailGeo.setDrawRange(0, 0);
    ui.caption.innerHTML = `<b>fly it yourself</b> · ${dir} tunnel ${seed === 0 && src ? '(the study tunnel of the replay)' : '#' + seed} · keyboard: <kbd>W</kbd>/<kbd>S</kbd> forward/back, <kbd>A</kbd>/<kbd>D</kbd> left/right, <kbd>R</kbd>/<kbd>F</kbd> up/down (or the arrow keys); Xbox controller: right stick = forward/right, left stick = up/down, like the study · the camera always faces +x`;
  }
  /* input */
  const keys = new Set();
  canvas.setAttribute('tabindex', '0');
  const keyTarget = document;
  keyTarget.addEventListener('keydown', (e) => { if (mode !== 'live') return; if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) { if (document.activeElement === canvas || canvas.matches(':hover')) e.preventDefault(); keys.add(e.code); } if (e.code === 'Enter' && live && live.done) startLive(); });
  keyTarget.addEventListener('keyup', (e) => keys.delete(e.code));
  function readStick() {
    const s = [0, 0, 0];
    if (keys.has('KeyW') || keys.has('ArrowUp')) s[0] += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) s[0] -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) s[1] += 1; if (keys.has('KeyA') || keys.has('ArrowLeft')) s[1] -= 1;
    if (keys.has('KeyR')) s[2] += 1; if (keys.has('KeyF')) s[2] -= 1;
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gps) { if (!gp) continue; const dz = (x) => Math.abs(x) < 0.12 ? 0 : x; const ax = gp.axes; if (ax.length >= 4) { s[0] += -dz(ax[3]); s[1] += dz(ax[2]); s[2] += -dz(ax[1]); ui.gamepad.textContent = 'controller: ' + gp.id.slice(0, 28); } }
    return s.map(x => Math.max(-1, Math.min(1, x)) * PARAMS.vmax);
  }
  function stepLive(dt) {
    const L = live; if (L.done) return;
    L.acc += dt;
    while (L.acc >= PARAMS.dt) {
      L.acc -= PARAMS.dt; L.t += PARAMS.dt;
      const target = readStick(); L.stick = V.add(L.stick, V.scale(V.sub(target, L.stick), PARAMS.dt / 0.12));
      const uRef = V.sub(L.stick, L.v);
      const rows = T.constraints.filter(o => o.inRange(L.q)).map(o => o.constraint(L.q, L.v));
      const g = globalSafe(uRef, rows.map(r => r[0]), rows.map(r => r[1]));
      const cues = ui.liveHaptics.checked ? renderCues(L.q, L.v, uRef, T.constraints, layout) : { cues: [], active: [] };
      const vt = V.add(L.v, ui.liveAssist.checked ? g.u : uRef);
      L.v = V.add(L.v, V.scale(V.sub(vt, L.v), PARAMS.dt / PARAMS.tauDrone));
      const qn = V.add(L.q, V.scale(L.v, PARAMS.dt)); L.dist += V.norm(V.sub(qn, L.q)); L.q = qn;
      const now = new Set();
      for (const c of contacts(T, L.q, PARAMS.rDrone)) { L.q = V.add(L.q, V.scale(c.n, c.depth)); const vn = V.dot(L.v, c.n); if (vn < 0) L.v = V.sub(L.v, V.scale(c.n, vn)); now.add(c.index); if (!L.inContact.has(c.index) && c.name !== 'floor') { L.collisions++; addHit(L.q); } }
      L.inContact = now;
      L.disSum += V.norm(V.sub(uRef, g.u)); L.disN++; if (cues.active.length) L.cueFrames++;
      Object.assign(state, { q: L.q, v: L.v, ur: uRef, us: g.u, active: cues.active, cues: cues.cues, t: L.t, collisions: L.collisions, h: T.obstacles.map(o => o.h(L.q)) });
      if (progress(T, L.q) >= T.length) { L.done = true; ui.hud.innerHTML = `<b>Finished!</b> ${L.t.toFixed(1)} s · ${L.collisions} collisions · ${L.dist.toFixed(1)} m · mean |u_ref − u_safe| ${(L.disSum / Math.max(1, L.disN)).toFixed(2)} m/s² · cues ${Math.round(100 * L.cueFrames / Math.max(1, L.disN))} % of the frames · press Enter or Restart`; }
    }
  }
  function stepReplay(dt) {
    const F = flight.frames, hz = flight.hz;
    if (playing) tPlay += dt * (+ui.speed.value);
    const tf = tPlay * hz; let k = Math.floor(tf);
    if (k >= F.length - 1) { k = F.length - 1; tPlay = k / hz; if (playing) { tPlay = 0; hits.clear(); trailN = 0; trailGeo.setDrawRange(0, 0); state.collisions = 0; state.disSum = 0; state.disN = 0; } }
    const a = F[k], b = F[Math.min(k + 1, F.length - 1)], f = Math.min(1, tf - k);
    const lerp = (x, y) => [x[0] + (y[0] - x[0]) * f, x[1] + (y[1] - x[1]) * f, x[2] + (y[2] - x[2]) * f];
    if (state.lastK !== k) {
      if (k < state.lastK) { hits.clear(); trailN = 0; trailGeo.setDrawRange(0, 0); state.collisions = 0; state.disSum = 0; state.disN = 0; }
      for (let j = (state.lastK ?? -1) + 1; j <= k; j++) { for (const h of F[j].hit) { addHit(F[j].q); state.collisions++; } state.disSum += V.norm(V.sub(F[j].ur, F[j].us)); state.disN++; }
      state.lastK = k;
    }
    Object.assign(state, { q: lerp(a.q, b.q), v: lerp(a.v, b.v), ur: a.ur, us: a.us, active: a.act, cues: a.cues.map(c => ({ obs: c.o, duty: c.d, act: c.a, dir: c.dir })), t: a.t, h: a.h });
    ui.scrub.value = k; ui.time.textContent = `${a.t.toFixed(1)} s / ${F[F.length - 1].t.toFixed(1)} s`;
  }
  let spin = 0, hudT = 0;
  vw.tick = (dt) => {
    if (!T) return;
    if (mode === 'live') stepLive(dt); else stepReplay(dt);
    const q = v3(state.q); drone.position.copy(q); spin += dt * 40;
    for (const key of ['rotor11', 'rotor1-1', 'rotor-11', 'rotor-1-1']) drone.userData[key].rotation.y = spin;
    /* trail */
    if (trailN === 0 || v3(state.q).distanceTo(new THREE.Vector3().fromArray(trailGeo.attributes.position.array, (trailN - 1) * 3)) > 0.08) { if (trailN < TRAIL) { trailGeo.attributes.position.array.set(state.q, trailN * 3); trailN++; trailGeo.setDrawRange(0, trailN); trailGeo.attributes.position.needsUpdate = true; } }
    trail.visible = ui.trail.checked;
    /* arrows */
    const showA = ui.arrows.checked;
    for (const [key, vec, minLen] of [['v', state.v, 0.05], ['ur', state.ur, 0.05], ['us', state.us, 0.05]]) {
      const a = arrows[key]; const len = V.norm(vec) * 0.5; a.visible = showA && len > minLen && !(key === 'us' && V.norm(V.sub(state.us, state.ur)) < 0.05);
      if (a.visible) { a.position.copy(q); a.setDirection(v3(vec).normalize()); a.setLength(len, Math.min(0.25, len * 0.35), Math.min(0.12, len * 0.2)); }
    }
    /* shells */
    const sm = ui.shells.value;
    built.shells.forEach((sh, i) => {
      const o = T.obstacles[i]; const inR = o.inRange(state.q); const cue = state.cues.find(c => c.obs === i); const inside = state.h && state.h[i] !== null && state.h[i] !== undefined && state.h[i] < 0;
      sh.visible = sm === 'all' || (sm === 'range' && inR) || (sm === 'violated' && !!cue);
      sh.material.color.setHex(inside ? RED : cue ? YEL : inR ? 0xd7dce8 : 0x9aa3b5); sh.material.opacity = inside ? 0.9 : cue ? 0.85 : inR ? 0.45 : 0.22;
    });
    const cl = []; for (const c of state.cues) cl.push(...state.q, ...T.obstacles[c.obs].c);
    cueLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(cl, 3)); cueLines.computeLineDistances(); cueLines.visible = cl.length > 0 && showA;
    /* cameras */
    const up = v3(camUp()), tV = v3(T.t);
    const cm = ui.cam.value;
    if (cm === 'chase') { vw.controls.enabled = false; vw.camera.up.copy(up); vw.camera.position.copy(q).addScaledVector(tV, -6.5).addScaledVector(up, 2.4); vw.camera.lookAt(q.clone().addScaledVector(tV, 5)); }
    else if (cm === 'fpv') { vw.controls.enabled = false; vw.camera.up.set(0, 0, 1); vw.camera.position.copy(q).add(new THREE.Vector3(0.14, 0, 0.02)); vw.camera.lookAt(q.clone().add(new THREE.Vector3(10, 0, 0.02))); }
    else if (cm === 'top') { vw.controls.enabled = false; vw.camera.up.copy(tV); vw.camera.position.copy(q).addScaledVector(v3(T.s2), 14); vw.camera.lookAt(q); }
    else { vw.controls.enabled = true; vw.camera.up.set(0, 0, 1); if (ui.follow.checked) vw.controls.target.lerp(q, 0.15); }
    vw.camera.fov = cm === 'fpv' ? 90 : 60; vw.camera.updateProjectionMatrix();
    drone.visible = cm !== 'fpv';
    /* inset: the operator's first-person view (or the chase view when the main view is FPV) */
    if (cm === 'fpv') { insetCam.fov = 60; insetCam.up.copy(up); insetCam.position.copy(q).addScaledVector(tV, -6.5).addScaledVector(up, 2.4); insetCam.lookAt(q.clone().addScaledVector(tV, 5)); }
    else { insetCam.fov = 90; insetCam.up.set(0, 0, 1); insetCam.position.copy(q).add(new THREE.Vector3(0.14, 0, 0.02)); insetCam.lookAt(q.clone().add(new THREE.Vector3(10, 0, 0.02))); }
    insetCam.updateProjectionMatrix();
    /* HUD + body map + bus */
    bodyMap.setActive(state.active); bus.emit(state.active);
    hudT += dt;
    if (hudT > 0.1 && !(live && live.done)) { hudT = 0; const dis = V.norm(V.sub(state.ur, state.us)); ui.hud.innerHTML = `t <b>${state.t.toFixed(1)} s</b> · |v| <b>${V.norm(state.v).toFixed(1)} m/s</b> · progress <b>${Math.max(0, progress(T, state.q)).toFixed(0)} / 50 m</b> · collisions <b>${state.collisions}</b> · |u_ref − u_safe| <b>${dis.toFixed(2)}</b>${mode === 'replay' && state.disN ? ` (mean so far ${(state.disSum / state.disN).toFixed(2)})` : ''} · cues: ${state.active.length ? state.active.map(([i, d]) => `<span class="cue">#${layout.ids[i]} ${d}/15</span>`).join(' ') : '<span class="dim">none</span>'}`; }
  };
  /* render with the inset */
  vw.render = () => {
    const r = vw.renderer, w = canvas.clientWidth, h = canvas.clientHeight; r.setScissorTest(false); r.setViewport(0, 0, w, h); r.render(vw.scene, vw.camera);
    if (ui.inset.checked && T) { const iw = Math.round(w * 0.3), ih = Math.round(iw * 9 / 16); const x = w - iw - 10, y = 10; r.setScissorTest(true); r.setViewport(x, y, iw, ih); r.setScissor(x, y, iw, ih); const dv = drone.visible; drone.visible = ui.cam.value === 'fpv'; r.render(vw.scene, insetCam); drone.visible = dv; r.setScissorTest(false); }
  };
  ui.flight.addEventListener('change', () => { if (ui.flight.value === 'live') startLive(); else setFlight(+ui.flight.value); });
  ui.play.addEventListener('click', () => { playing = !playing; ui.play.textContent = playing ? 'Pause' : 'Play'; });
  ui.scrub.addEventListener('input', () => { if (mode === 'replay') { tPlay = (+ui.scrub.value) / flight.hz; playing = false; ui.play.textContent = 'Play'; } });
  ui.liveReset.addEventListener('click', startLive); ui.liveDir.addEventListener('change', startLive); ui.liveSeed.addEventListener('change', startLive);
  ui.resetView.addEventListener('click', () => { if (T) { vw.camera.position.copy(v3(state.q)).addScaledVector(v3(T.t), -8).addScaledVector(v3(camUp()), 4); vw.controls.target.copy(v3(state.q)); } });
  data.flights.forEach((f, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${f.direction} tunnel · ${f.cond === 'NA' ? 'no feedback' : 'AeroHaptix cues (VSC)'} · ${f.metrics.collisions} collisions`; ui.flight.insertBefore(o, ui.flight.lastElementChild); });
  setFlight(1);
}

/* ---------------------------------------------------------------- boot */
async function main() {
  const q = (id) => document.getElementById(id);
  let data;
  try { data = await (await fetch(DATA_URL)).json(); } catch (e) { for (const id of ['ah-suit-info', 'ah-hud']) if (q(id)) q(id).textContent = 'Could not load assets/data/aerohaptix_scene.json (serve the page over http, not file://).'; return; }
  if (q('ah-suit-canvas')) suitScene(q('ah-suit-canvas'), data, { body: q('ah-suit-body'), info: q('ah-suit-info'), rays: q('ah-suit-rays'), wires: q('ah-suit-wires'), labels: q('ah-suit-labels'), grid: q('ah-suit-grid46'), mode: q('ah-suit-mode'), sliders: q('ah-suit-sliders'), theta: q('ah-suit-theta'), phi: q('ah-suit-phi'), duty: q('ah-suit-duty'), reset: q('ah-suit-reset'), view: q('ah-suit-view') });
  if (q('ah-unit-canvas')) unitScene(q('ah-unit-canvas'), { explode: q('ah-unit-explode') });
  if (q('ah-tunnel-canvas')) tunnelScene(q('ah-tunnel-canvas'), data, { body: q('ah-tunnel-body'), hud: q('ah-hud'), caption: q('ah-caption'), flight: q('ah-flight'), cam: q('ah-cam'), play: q('ah-play'), speed: q('ah-speed'), scrub: q('ah-scrub'), time: q('ah-time'), shells: q('ah-shells'), follow: q('ah-follow'), arrows: q('ah-arrows'), trail: q('ah-trail'), inset: q('ah-inset'), livePanel: q('ah-live-panel'), replayPanel: q('ah-replay-panel'), liveDir: q('ah-live-dir'), liveSeed: q('ah-live-seed'), liveAssist: q('ah-live-assist'), liveHaptics: q('ah-live-haptics'), liveReset: q('ah-live-reset'), resetView: q('ah-reset-view'), gamepad: q('ah-gamepad') });
  window.AH3D = { bus, data };
}
main();

/* =============================================================================
   scene.js — the IRIS studio in three.js: a desk with the arm bolted to one end,
   the arm's real link meshes driven by the MuJoCo kinematic tree, a Sony α7R III
   with a 16–150 mm servo zoom on the mount, product sets (CC0 Poly Haven models
   and procedural props), a toy car on a track, studio lights, and the camera
   feed rendered through a thin-lens depth of field. World frame = MuJoCo base
   frame: arm base at the origin on the desk top, x toward the products, z up.
   ============================================================================= */
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { TransformControls } from '../vendor/controls/TransformControls.js';
import { RoomEnvironment } from '../vendor/environments/RoomEnvironment.js';
import { Arm, M4, V3 } from './kin.js';
import { Lens, LENS, SENSOR, fovV } from './lens.js';
import { carPosition, carHeading } from './shots.js';
import { DofPass } from './dof.js';

const Z_UP = new THREE.Vector3(0, 0, 1);
const q90x = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);   /* glTF y-up -> z-up */
const gltfLoader = new GLTFLoader(); const gltfCache = new Map();
function loadGLB(url) { if (!gltfCache.has(url)) gltfCache.set(url, new Promise((res, rej) => gltfLoader.load(url, g => res(g), undefined, rej))); return gltfCache.get(url); }
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.0, ...o });
function labelTexture(text, fg = '#eee', bg = '#222', px = 40, w = 256, h = 64) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; c.font = `bold ${px}px Jost, Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }

/* ------------------------------------------------------------------ procedural props (z-up, base at z = 0) */
export const PROPS = {
  coffee_cup() {
    const g = new THREE.Group();
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.031 + 0.011 * t, 0.11 * t)); }
    const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mat(0xf3efe6, { roughness: 0.85 })); cup.rotation.x = Math.PI / 2; g.add(cup);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.031, 48), mat(0xf3efe6)); bottom.position.z = 0.001; g.add(bottom);
    const sleevePts = []; for (let i = 0; i <= 4; i++) { const t = i / 4; sleevePts.push(new THREE.Vector2(0.0355 + 0.0043 * t + 0.0015, 0.035 + 0.045 * t)); }
    const sleeve = new THREE.Mesh(new THREE.LatheGeometry(sleevePts, 48), mat(0x9c7a4d, { roughness: 0.95 })); sleeve.rotation.x = Math.PI / 2; g.add(sleeve);
    const logo = new THREE.Mesh(new THREE.RingGeometry(0.008, 0.0125, 32), mat(0x1c6b3b, { roughness: 0.8, side: THREE.DoubleSide })); logo.position.set(0.0415, 0, 0.058); logo.rotation.y = Math.PI / 2; g.add(logo);
    const logo2 = new THREE.Mesh(new THREE.CircleGeometry(0.004, 24), mat(0x1c6b3b, { side: THREE.DoubleSide })); logo2.position.copy(logo.position); logo2.rotation.y = Math.PI / 2; g.add(logo2);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.044, 0.012, 48), mat(0xf7f7f4, { roughness: 0.5 })); lid.rotation.x = Math.PI / 2; lid.position.z = 0.116; g.add(lid);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.02, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf7f7f4, { roughness: 0.5 })); dome.rotation.x = Math.PI / 2; dome.position.z = 0.122; dome.scale.set(1, 1, 0.4); g.add(dome);
    return g;
  },
  perfume() {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.028, 0.078), new THREE.MeshPhysicalMaterial({ color: 0xf6c9d2, transmission: 0.92, thickness: 0.03, roughness: 0.05, ior: 1.5, metalness: 0 })); glass.position.z = 0.039; g.add(glass);
    const liquid = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.022, 0.06), new THREE.MeshPhysicalMaterial({ color: 0xe88aa0, transmission: 0.7, thickness: 0.02, roughness: 0.2, ior: 1.33 })); liquid.position.z = 0.032; g.add(liquid);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.008, 24), mat(0xd6b25e, { metalness: 0.9, roughness: 0.3 })); neck.rotation.x = Math.PI / 2; neck.position.z = 0.082; g.add(neck);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.012, 0.028, 32), mat(0xd6b25e, { metalness: 0.9, roughness: 0.25 })); cap.rotation.x = Math.PI / 2; cap.position.z = 0.1; g.add(cap);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.014), new THREE.MeshBasicMaterial({ map: labelTexture('IRIS', '#222', '#fbf7f0', 30, 256, 120) })); label.position.set(0.0235, 0, 0.04); label.rotation.y = Math.PI / 2; g.add(label);
    return g;
  },
  lipstick() {
    const g = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.05, 32), mat(0x111111, { roughness: 0.35, metalness: 0.4 })); tube.rotation.x = Math.PI / 2; tube.position.z = 0.025; g.add(tube);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0098, 0.0098, 0.006, 32), mat(0xd6b25e, { metalness: 0.9, roughness: 0.3 })); band.rotation.x = Math.PI / 2; band.position.z = 0.05; g.add(band);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.022, 32), mat(0xc4123a, { roughness: 0.35 })); stick.rotation.x = Math.PI / 2; stick.position.z = 0.064; g.add(stick);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xc4123a, { roughness: 0.35 })); tip.rotation.x = Math.PI / 2; tip.position.z = 0.075; tip.scale.set(1, 1, 0.6); g.add(tip);
    return g;
  },
  cream_jar() {
    const g = new THREE.Group();
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.038, 48), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.35, roughness: 0.4, thickness: 0.01 })); jar.rotation.x = Math.PI / 2; jar.position.z = 0.019; g.add(jar);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.014, 48), mat(0x1d1d1d, { roughness: 0.3, metalness: 0.5 })); lid.rotation.x = Math.PI / 2; lid.position.z = 0.045; g.add(lid);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.012), new THREE.MeshBasicMaterial({ map: labelTexture('crème', '#333', '#f5f2ea', 40, 256, 100) })); label.position.set(0.0305, 0, 0.02); label.rotation.y = Math.PI / 2; g.add(label);
    return g;
  },
  toy_car() {
    const g = new THREE.Group(); const red = mat(0xd8261f, { roughness: 0.3, metalness: 0.1 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.044, 0.022), red); body.position.z = 0.022; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.02), new THREE.MeshPhysicalMaterial({ color: 0x223344, roughness: 0.1, metalness: 0.2 })); cabin.position.set(-0.004, 0, 0.043); g.add(cabin);
    const wheelMat = mat(0x151515, { roughness: 0.8 }); const hub = mat(0xcfcfcf, { metalness: 0.7, roughness: 0.3 });
    for (const [x, y] of [[0.028, 0.026], [0.028, -0.026], [-0.028, 0.026], [-0.028, -0.026]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 24), wheelMat); w.position.set(x, y, 0.011); g.add(w); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.009, 16), hub); h.position.copy(w.position); g.add(h); }
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.03, 0.008), new THREE.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffe08a, emissiveIntensity: 0.8 })); lamp.position.set(0.0435, 0, 0.026); g.add(lamp);
    g.userData.isCar = true; return g;
  },
};

/* ------------------------------------------------------------------ the camera rig on the mount */
export function buildRig() {
  const rig = new THREE.Group();   /* mount frame: +z = optical axis, -y = up */
  const black = mat(0x121214, { roughness: 0.55, metalness: 0.2 }), rubber = mat(0x1a1a1c, { roughness: 0.95 }), silver = mat(0xc9ccd2, { roughness: 0.35, metalness: 0.8 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.008), mat(0x2a2c30, { metalness: 0.6, roughness: 0.4 })); plate.position.z = 0.032; rig.add(plate);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.127, 0.096, 0.062), black); body.position.set(0.0, -0.006, 0.067); rig.add(body);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.09, 0.03), rubber); grip.position.set(-0.07, -0.003, 0.104); rig.add(grip);
  const evf = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.026, 0.05), black); evf.position.set(-0.01, -0.06, 0.06); rig.add(evf);
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.006, 0.02), silver); shoe.position.set(-0.01, -0.075, 0.06); rig.add(shoe);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.05), new THREE.MeshBasicMaterial({ color: 0x0b0d10 })); screen.position.set(0.004, -0.004, 0.0355); screen.rotation.y = Math.PI; rig.add(screen);
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.008), new THREE.MeshBasicMaterial({ map: labelTexture('α7R III', '#eee', '#121214', 40, 256, 64) })); badge.position.set(0.024, -0.03, 0.0355); badge.rotation.y = Math.PI; rig.add(badge);
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.004, 40), silver); throat.rotation.x = Math.PI / 2; throat.position.set(0.0, 0.0, 0.1); rig.add(throat);
  /* the zoom lens: fixed rear barrel, the extending front barrel, the two servo-driven rings and their motors */
  const lens = new THREE.Group(); lens.position.set(0.0, 0.0, 0.1); rig.add(lens);
  const rear = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.034, 0.05, 48), black); rear.rotation.x = Math.PI / 2; rear.position.z = 0.025; lens.add(rear);
  const zoomRing = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.016, 48), rubber); zoomRing.rotation.x = Math.PI / 2; zoomRing.position.z = 0.018; lens.add(zoomRing);
  const zoomGear = new THREE.Mesh(new THREE.CylinderGeometry(0.0405, 0.0405, 0.01, 60), mat(0x2f3136, { roughness: 0.5, metalness: 0.5 })); zoomGear.rotation.x = Math.PI / 2; zoomGear.position.z = 0.018; lens.add(zoomGear);
  const focusRing = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.014, 48), rubber); focusRing.rotation.x = Math.PI / 2; focusRing.position.z = 0.042; lens.add(focusRing);
  const focusGear = new THREE.Mesh(new THREE.CylinderGeometry(0.0395, 0.0395, 0.009, 60), mat(0x2f3136, { roughness: 0.5, metalness: 0.5 })); focusGear.rotation.x = Math.PI / 2; focusGear.position.z = 0.042; lens.add(focusGear);
  const ext = new THREE.Group(); ext.position.z = 0.05; lens.add(ext);
  const front = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.033, 0.04, 48), black); front.rotation.x = Math.PI / 2; front.position.z = 0.02; ext.add(front);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.034, 0.012, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.6, side: THREE.DoubleSide })); hood.rotation.x = Math.PI / 2; hood.position.z = 0.044; ext.add(hood);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.026, 48), new THREE.MeshPhysicalMaterial({ color: 0x1b2a3a, roughness: 0.05, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 })); glass.position.z = 0.0401; ext.add(glass);
  const scale = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.007), new THREE.MeshBasicMaterial({ map: labelTexture('16 · 24 · 35 · 50 · 70 · 100 · 150', '#ddd', '#121214', 26, 512, 64) })); scale.position.set(0, -0.0345, 0.03); scale.rotation.x = Math.PI / 2; scale.rotation.z = Math.PI; rear.add(scale);
  /* servos: a zoom motor and a focus motor on a bracket under the lens (the next IRIS drives the rings precisely) */
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.075), mat(0x2a2c30, { metalness: 0.6, roughness: 0.4 })); bracket.position.set(0.0, 0.056, 0.03); lens.add(bracket);
  const servo = (z) => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.014), mat(0x2b2b30, { roughness: 0.5, metalness: 0.6 })); g.add(m); const pinion = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.016, 24), mat(0x9aa0aa, { metalness: 0.8, roughness: 0.35 })); pinion.rotation.x = Math.PI / 2; pinion.position.set(0, -0.012, 0); g.add(pinion); g.position.set(0, 0.062, z); g.userData.pinion = pinion; return g; };
  const zoomServo = servo(0.018), focusServo = servo(0.042); lens.add(zoomServo, focusServo);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.07, 0.03), new THREE.Vector3(0, 0.08, 0.0), new THREE.Vector3(-0.02, 0.06, -0.06)]), 16, 0.0015, 6), mat(0x222222)); lens.add(cable);
  /* the three.js camera on the optical axis: looks down -z with +y up, so rotate pi about x to match the mount */
  const cam = new THREE.PerspectiveCamera(fovV(35), 3 / 2, 0.03, 30); cam.position.set(0.0, 0.0, 0.14);   /* = kin.TOOL_OFFSET */ cam.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI); rig.add(cam);
  rig.userData = { cam, lens, ext, zoomRing, focusRing, zoomGear, focusGear, zoomServo, focusServo };
  return rig;
}

/* ------------------------------------------------------------------ studio */
export class Studio {
  constructor(canvas, spec, model, opts = {}) {
    this.canvas = canvas; this.spec = spec; this.arm = new Arm(model); this.lens = new Lens(); this.opts = opts;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture });
    this.renderer.setPixelRatio(opts.capture ? 1 : Math.min(window.devicePixelRatio || 1, 2)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.9; this.renderer.setClearColor(0x0d1017, 1);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x151820);
    const pmrem = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.5;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.02, 60); this.camera.up.copy(Z_UP); this.camera.position.set(-0.75, -1.15, 0.85);
    this.controls = new OrbitControls(this.camera, canvas); this.controls.target.set(0.4, 0, 0.12); this.controls.enableDamping = true; this.controls.dampingFactor = 0.08; this.controls.maxPolarAngle = Math.PI * 0.52; this.controls.minDistance = 0.25; this.controls.maxDistance = 6;
    this.q = this.arm.home.slice(); this.t = 0; this.carT = 0; this.products = new THREE.Group(); this.scene.add(this.products); this.setId = null; this.viewport = { main: null, feed: null };
    this.buildStudio(); this.rig = buildRig(); this.feedCam = this.rig.userData.cam;
    this.dof = new DofPass(960, 640); this.dofEnabled = true;
    this.armReady = this.loadArm(); this.ready = Promise.all([this.armReady, this.loadSet(spec.default_set)]);
    /* the end-effector target gizmo */
    this.handle = new THREE.Object3D(); this.scene.add(this.handle);
    this.gizmo = new TransformControls(this.camera, canvas); this.gizmo.setSize(0.7); this.gizmo.attach(this.handle); this.gizmo.enabled = false; this.gizmoHelper = this.gizmo.getHelper ? this.gizmo.getHelper() : this.gizmo; this.gizmoHelper.visible = false; this.scene.add(this.gizmoHelper);
    this.gizmo.addEventListener('dragging-changed', (e) => { this.controls.enabled = !e.value; });
    this.trail = null;
    new ResizeObserver(() => this.resize()).observe(canvas); this.resize();
  }
  /* ---- static studio: floor, desk, backdrop, lights ---- */
  buildStudio() {
    const s = this.scene, d = this.spec.desk;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), mat(0x2a2d33, { roughness: 0.9 })); floor.position.z = -d.height; floor.receiveShadow = true; s.add(floor);
    const wood = mat(0x7a5c3e, { roughness: 0.75 }); const top = new THREE.Mesh(new THREE.BoxGeometry(d.x[1] - d.x[0], d.y[1] - d.y[0], d.thickness), wood); top.position.set((d.x[0] + d.x[1]) / 2, 0, -d.thickness / 2); top.receiveShadow = true; top.castShadow = true; s.add(top);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(top.geometry), new THREE.LineBasicMaterial({ color: 0x5a4430 })); edge.position.copy(top.position); s.add(edge);
    const legMat = mat(0x3a3c40, { metalness: 0.5, roughness: 0.5 });
    for (const [x, y] of [[d.x[0] + 0.06, d.y[0] + 0.06], [d.x[1] - 0.06, d.y[0] + 0.06], [d.x[0] + 0.06, d.y[1] - 0.06], [d.x[1] - 0.06, d.y[1] - 0.06]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, d.height - d.thickness), legMat); leg.position.set(x, y, -(d.height + d.thickness) / 2); leg.castShadow = true; s.add(leg); }
    /* the base clamp: a plate under the arm base */
    const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.012, 48), mat(0x1f2126, { metalness: 0.5, roughness: 0.5 })); clamp.rotation.x = Math.PI / 2; clamp.position.z = 0.006; clamp.castShadow = true; s.add(clamp);
    /* cyclorama backdrop: a wall behind the desk with a curved fillet to the floor */
    const cyc = mat(0xb9b4a8, { roughness: 1 }); const wall = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), cyc); wall.position.set(2.0, 0, 0.45); wall.rotation.y = -Math.PI / 2; wall.receiveShadow = true; s.add(wall);
    const fillet = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 6, 32, 1, true, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb9b4a8, roughness: 1, side: THREE.BackSide })); fillet.rotation.z = Math.PI / 2; fillet.rotation.y = 0; fillet.position.set(2.0 - 0.6, 0, -d.height + 0.6); s.add(fillet);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), mat(0x3a3f4a, { roughness: 1 })); side.position.set(0, 2.2, 0.45); side.rotation.x = Math.PI / 2; s.add(side);
    /* lights: a soft key through a softbox, a fill, a rim, and a little ambient */
    s.add(new THREE.HemisphereLight(0xfff4e6, 0x2b3040, 0.35));
    const key = new THREE.SpotLight(0xfff0dc, 38, 6, 0.75, 0.6, 1.2); key.position.set(0.9, -1.0, 1.1); key.target.position.set(0.5, 0, 0.05); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.radius = 4; s.add(key, key.target);
    const fill = new THREE.SpotLight(0xdfe8ff, 16, 6, 0.9, 0.9, 1.2); fill.position.set(0.2, 1.1, 0.8); fill.target.position.set(0.5, 0, 0.05); s.add(fill, fill.target);
    const rim = new THREE.SpotLight(0xffffff, 30, 6, 0.6, 0.7, 1.2); rim.position.set(1.5, 0.5, 1.0); rim.target.position.set(0.5, 0, 0.1); s.add(rim, rim.target);
    const softbox = (light, w, h) => { const g = new THREE.Group(); const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.25), mat(0x222222, { roughness: 0.9 })); g.add(box); const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, h * 0.92), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 2.5 })); face.position.z = 0.126; g.add(face); g.position.copy(light.position); g.lookAt(light.target.position); const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, light.position.z + d.height, 12), legMat); stand.rotation.x = Math.PI / 2; stand.position.set(light.position.x, light.position.y, (light.position.z - d.height) / 2); s.add(stand); return g; };
    s.add(softbox(key, 0.6, 0.45), softbox(fill, 0.45, 0.35));
    /* the car's track: a thin ring on the desk */
    const c = this.spec.car; const track = new THREE.Mesh(new THREE.RingGeometry(c.radius - 0.012, c.radius + 0.012, 96), mat(0x4b4f58, { roughness: 0.9 })); track.position.set(c.centre[0], c.centre[1], 0.0006); s.add(track);
    this.car = PROPS.toy_car(); this.car.castShadow = true; this.car.traverse(o => { if (o.isMesh) o.castShadow = true; }); s.add(this.car); this.updateCar(0);
  }
  /* ---- the arm from the MuJoCo tree + decimated link meshes ---- */
  async loadArm() {
    const g = await loadGLB('assets/models/iris/iris_links.glb'); const meshes = {}; g.scene.updateMatrixWorld(true);
    g.scene.traverse(o => { if (o.isMesh) { const geo = o.geometry.clone().applyMatrix4(o.matrixWorld); if (!geo.attributes.normal) geo.computeVertexNormals(); meshes[o.name] = { geometry: geo }; } });
    const dark = mat(0x16171b, { roughness: 0.5, metalness: 0.35 }), alu = mat(0x33363d, { roughness: 0.4, metalness: 0.75 });
    this.bodies = {}; this.jointFrames = []; const root = new THREE.Group(); this.scene.add(root); const parents = { world: root };
    for (const b of this.arm.bodies) {
      const frame = new THREE.Group(); frame.position.set(...b.pos); frame.quaternion.set(b.quat[1], b.quat[2], b.quat[3], b.quat[0]); parents[b.parent].add(frame);
      let inner = frame; if (b.joint) { inner = new THREE.Group(); frame.add(inner); this.jointFrames.push({ group: inner, axis: new THREE.Vector3(...b.joint.axis) }); }
      for (const ge of b.geoms) { const src = meshes[ge.mesh]; if (!src) continue; const m = new THREE.Mesh(src.geometry, ge.rgba[0] < 0.5 ? dark : alu); m.position.set(...ge.pos); m.quaternion.set(ge.quat[1], ge.quat[2], ge.quat[3], ge.quat[0]); m.castShadow = true; m.receiveShadow = true; inner.add(m); }
      parents[b.name] = inner; this.bodies[b.name] = inner;
    }
    this.bodies.ee_mount.add(this.rig); this.setQ(this.q);
  }
  setQ(q) { this.q = q.slice(); if (!this.jointFrames) return; this.jointFrames.forEach((j, k) => j.group.quaternion.setFromAxisAngle(j.axis, q[k])); }
  eePose() { const T = this.arm.fk(this.q); return { pos: M4.pos(T), R: M4.rot(T), T }; }
  /* ---- products ---- */
  async loadSet(setId) {
    const set = this.spec.sets[setId]; if (!set) return; this.setId = setId; this.products.clear(); const byId = Object.fromEntries(this.spec.products.map(p => [p.id, p]));
    const place = [[set.near, this.spec.near[0], this.spec.near[1], 0], [set.far, this.spec.far[0], this.spec.far[1], 0], ...set.extras];
    await Promise.all(place.map(async ([id, x, y, yaw]) => {
      const prod = byId[id]; let obj;
      if (prod.procedural) obj = PROPS[prod.procedural]();
      else { const g = await loadGLB(prod.asset); obj = g.scene.clone(true); obj.quaternion.copy(q90x); obj.scale.setScalar(prod.scale || 1); obj.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(obj); obj.position.set(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -bb.min.z); const holder = new THREE.Group(); holder.add(obj); obj = holder; }
      obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); obj.position.set(x, y, 0); obj.rotation.z = (yaw || 0) * Math.PI / 180; obj.userData.productId = id; this.products.add(obj);
    }));
  }
  /** Spin the hero product (a motorised turntable on the desk). */
  setTurntable(angle) { const id = this.spec.sets[this.setId].near; for (const o of this.products.children) if (o.userData.productId === id) o.rotation.z = angle; }
  updateCar(t) { this.carT = t; const p = carPosition(this.spec.car, t); this.car.position.set(p[0], p[1], 0); this.car.rotation.z = carHeading(this.spec.car, t); }
  /* ---- per-frame ---- */
  update(dt) {
    this.lens.update(dt); const u = this.rig.userData; const ext = this.lens.extension; u.ext.position.z = 0.05 + ext;
    u.zoomRing.rotation.z = u.zoomGear.rotation.z = (this.lens.f - LENS.fmin) / (LENS.fmax - LENS.fmin) * 1.6; u.focusRing.rotation.z = u.focusGear.rotation.z = Math.log(this.lens.S / LENS.mfd) * 0.9;
    u.zoomServo.userData.pinion.rotation.y = -u.zoomRing.rotation.z * 5; u.focusServo.userData.pinion.rotation.y = -u.focusRing.rotation.z * 5;
    this.feedCam.fov = fovV(this.lens.f); this.feedCam.updateProjectionMatrix();
    this.controls.update();
  }
  /* ---- viewports: the main canvas hosts the studio view, the feed is drawn into the rect of another element ---- */
  setViewports(mainEl, feedEl) { this.viewport.main = mainEl; this.viewport.feed = feedEl; }
  resize() {
    const w = this.canvas.clientWidth || 800, h = this.canvas.clientHeight || 500; this.renderer.setSize(w, h, false);
    const r = this.feedRect(); if (r) { this.dof.setSize(Math.max(64, Math.round(r.w * this.renderer.getPixelRatio())), Math.max(64, Math.round(r.h * this.renderer.getPixelRatio()))); }
  }
  feedRect() {
    const el = this.viewport.feed; if (!el) return null; const c = this.canvas.getBoundingClientRect(), f = el.getBoundingClientRect();
    return { x: f.left - c.left, y: c.bottom - f.bottom, w: f.width, h: f.height };
  }
  render() {
    const r = this.renderer, W = this.canvas.clientWidth, H = this.canvas.clientHeight, pr = r.getPixelRatio();
    const c = this.canvas.getBoundingClientRect(); const mainRect = this.viewport.main ? this.viewport.main.getBoundingClientRect() : null;
    r.setScissorTest(true); r.autoClear = true;
    /* 1. the studio view into its rect */
    let mx = 0, my = 0, mw = W, mh = H;
    if (mainRect) { mx = mainRect.left - c.left; my = c.bottom - mainRect.bottom; mw = mainRect.width; mh = mainRect.height; }
    r.setViewport(mx * pr, my * pr, mw * pr, mh * pr); r.setScissor(mx * pr, my * pr, mw * pr, mh * pr);
    this.camera.aspect = mw / mh; this.camera.updateProjectionMatrix(); this.gizmoHelper.visible = this.gizmo.enabled; this.rig.visible = true; r.render(this.scene, this.camera);
    /* 2. the camera feed: scene -> DOF target (the target's own viewport), composite into the feed rect (scissored clear) */
    const fr = this.feedRect();
    if (fr && fr.w > 8) {
      const gv = this.gizmoHelper.visible; this.gizmoHelper.visible = false; if (this.trail) this.trail.visible = false; this.rig.visible = false;
      this.feedCam.aspect = fr.w / fr.h; this.feedCam.updateProjectionMatrix();
      r.setViewport(fr.x * pr, fr.y * pr, fr.w * pr, fr.h * pr); r.setScissor(fr.x * pr, fr.y * pr, fr.w * pr, fr.h * pr);
      this.dof.render(r, this.scene, this.feedCam, this.lens, this.dofEnabled && !this.feedNoDof);
      this.rig.visible = true; this.gizmoHelper.visible = gv; if (this.trail) this.trail.visible = true;
    }
    r.setScissorTest(false);
  }
  /** Composite the DOF quad into a rect (called by render through DofPass with the viewport set). */
  /* ---- helpers for the app ---- */
  subjectWorld(name, ctx) { return ctx.subject(name); }
  /** Project a world point into the feed image: returns [u, v] in [0,1] (v down) and whether it is in front of the camera. */
  projectToFeed(p) { const v = new THREE.Vector3(p[0], p[1], p[2]).project(this.feedCam); return { u: (v.x + 1) / 2, v: (1 - v.y) / 2, inFront: v.z < 1 && v.z > -1 }; }
  /** Read the feed's pixels (downsampled) for the pixel tracker. */
  readFeed(w = 64, h = 43) {
    if (!this._pick) { this._pick = new THREE.WebGLRenderTarget(w, h); this._pickBuf = new Uint8Array(w * h * 4); this._pickCam = this.feedCam.clone(); }
    const r = this.renderer; this._pickCam.copy(this.feedCam); this._pickCam.aspect = w / h; this._pickCam.updateProjectionMatrix();
    this.rig.getWorldPosition(this._pickCam.position); this.feedCam.getWorldQuaternion(this._pickCam.quaternion); this._pickCam.matrixWorldNeedsUpdate = true;
    const prev = r.getRenderTarget(); const rigVis = this.rig.visible; this.rig.visible = false; const gv = this.gizmoHelper.visible; this.gizmoHelper.visible = false; r.setRenderTarget(this._pick); r.render(this.scene, this._pickCam); r.readRenderTargetPixels(this._pick, 0, 0, w, h, this._pickBuf); r.setRenderTarget(prev); this.rig.visible = rigVis; this.gizmoHelper.visible = gv;
    return { data: this._pickBuf, w, h };
  }
  /** Draw a polyline trail of end-effector positions. */
  setTrail(points) {
    if (this.trail) { this.scene.remove(this.trail); this.trail.geometry.dispose(); this.trail = null; }
    if (!points || points.length < 2) return;
    const g = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
    this.trail = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffce0a, transparent: true, opacity: 0.85 })); this.scene.add(this.trail);
  }
  /** Position the gizmo handle at the current end-effector pose. */
  syncHandle() { const T = this.arm.fk(this.q); this.handle.position.set(T[0][3], T[1][3], T[2][3]); const m = new THREE.Matrix4().set(T[0][0], T[0][1], T[0][2], 0, T[1][0], T[1][1], T[1][2], 0, T[2][0], T[2][1], T[2][2], 0, 0, 0, 0, 1); this.handle.quaternion.setFromRotationMatrix(m); }
  handlePose() { const p = this.handle.position, m = new THREE.Matrix4().makeRotationFromQuaternion(this.handle.quaternion), e = m.elements; return { pos: [p.x, p.y, p.z], R: [[e[0], e[4], e[8]], [e[1], e[5], e[9]], [e[2], e[6], e[10]]] }; }
}

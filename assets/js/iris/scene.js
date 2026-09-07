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
    const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mat(0xd9d5cc, { roughness: 0.92 })); cup.rotation.x = Math.PI / 2; g.add(cup);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.031, 48), mat(0xd9d5cc)); bottom.position.z = 0.001; g.add(bottom);
    const sleevePts = []; for (let i = 0; i <= 4; i++) { const t = i / 4; sleevePts.push(new THREE.Vector2(0.0355 + 0.0043 * t + 0.0015, 0.035 + 0.045 * t)); }
    const sleeve = new THREE.Mesh(new THREE.LatheGeometry(sleevePts, 48), mat(0x9c7a4d, { roughness: 0.95 })); sleeve.rotation.x = Math.PI / 2; g.add(sleeve);
    const logo = new THREE.Mesh(new THREE.RingGeometry(0.008, 0.0125, 32), mat(0x1c6b3b, { roughness: 0.8, side: THREE.DoubleSide })); logo.position.set(0.0415, 0, 0.058); logo.rotation.y = Math.PI / 2; g.add(logo);
    const logo2 = new THREE.Mesh(new THREE.CircleGeometry(0.004, 24), mat(0x1c6b3b, { side: THREE.DoubleSide })); logo2.position.copy(logo.position); logo2.rotation.y = Math.PI / 2; g.add(logo2);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.044, 0.012, 48), mat(0xcfcfca, { roughness: 0.72 })); lid.rotation.x = Math.PI / 2; lid.position.z = 0.116; g.add(lid);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.02, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xcfcfca, { roughness: 0.72 })); dome.rotation.x = Math.PI / 2; dome.position.z = 0.122; dome.scale.set(1, 1, 0.4); g.add(dome);
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

/* ------------------------------------------------------------------ the camera rig on the mount
   Built to the manufacturers' published dimensions, because no redistributable mesh of this camera
   exists: Sony alpha-7R III body 126.9 x 95.6 x 73.7 mm with an E mount (46.1 mm throat, 18 mm flange
   distance); a cine-style servo zoom with 0.8-module gear rings; and two Feetech HLS3915M bus servos
   (34 x 20 x 23 mm, 36 g, aluminium case, dual 25T output shafts, 14.2 kg-cm at 12 V, TTL serial bus)
   on 15 mm rods, which is how a follow-focus motor is actually mounted.
   Frame: +z is the optical axis, -y is up, +x is the image's right (so the grip is at +x).         */
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}
/** A rounded slab extruded along z, centred on (0,0,z0 + depth/2). */
function slab(w, h, d, r, material, bevel = 0.0025) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w, h, r), { depth: d - 2 * bevel, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 12 });
  g.translate(0, 0, bevel);
  return new THREE.Mesh(g, material);
}
/** A knurled dial: a cylinder with fine ribs, axis along y (camera up). */
function dial(r, hgt, mat, ribs = 28) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hgt, 36), mat); g.add(body);
  const rib = new THREE.BoxGeometry(0.0014, hgt * 0.8, 0.0022);
  for (let i = 0; i < ribs; i++) { const m = new THREE.Mesh(rib, mat); const a = (i / ribs) * Math.PI * 2; m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); m.rotation.y = -a; g.add(m); }
  return g;
}
/** A 0.8-module cine gear ring (the pitch a follow-focus motor drives), axis along z. */
function gearRing(radius, width, teeth, mat) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 48), mat); core.rotation.x = Math.PI / 2; g.add(core);
  const tooth = new THREE.BoxGeometry(0.0011, width, 0.0016);
  for (let i = 0; i < teeth; i++) { const m = new THREE.Mesh(tooth, mat); const a = (i / teeth) * Math.PI * 2; m.position.set(Math.cos(a) * (radius + 0.0006), Math.sin(a) * (radius + 0.0006), 0); m.rotation.z = a; m.rotation.x = Math.PI / 2; g.add(m); }
  return g;
}
export function buildRig() {
  const rig = new THREE.Group();
  const mag = new THREE.MeshStandardMaterial({ color: 0x131418, roughness: 0.68, metalness: 0.15, envMapIntensity: 0.35 });   /* magnesium shell, painted matte black */
  const black = new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.72, metalness: 0.15, envMapIntensity: 0.3 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.96, metalness: 0.0 });
  const dialMat = new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.45, metalness: 0.6, envMapIntensity: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.3, metalness: 0.9, envMapIntensity: 0.7 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 1.0 });
  const alu = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.4, metalness: 0.8, envMapIntensity: 0.5 });   /* anodised aluminium servo case */
  const W = 0.1269, H = 0.0956;                                                                          /* published body width and height */
  const Z0 = 0.030, SLAB = 0.049;                                                                        /* rear face, and the slab's depth without the grip */

  /* ---- quick-release plate and tripod socket under the body ---- */
  const plate = slab(0.070, 0.050, 0.008, 0.004, new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.45, metalness: 0.55, envMapIntensity: 0.45 }));
  plate.rotation.x = Math.PI / 2; plate.position.set(0, H / 2 + 0.004, Z0 + 0.030); rig.add(plate);

  /* ---- body ---- */
  const body = slab(W, H, SLAB, 0.009, mag); body.position.z = Z0; rig.add(body);
  /* the front shoulder that carries the mount, slightly proud of the slab */
  const front = slab(0.086, H - 0.004, 0.012, 0.010, mag); front.position.z = Z0 + SLAB; rig.add(front);
  /* grip: a rounded lobe on the +x side that swells forward */
  const grip = slab(0.036, H - 0.010, 0.030, 0.012, mag); grip.position.set(W / 2 - 0.020, 0.002, Z0 + SLAB); rig.add(grip);
  const gripSkin = slab(0.031, H - 0.020, 0.028, 0.012, rubber); gripSkin.position.set(W / 2 - 0.019, 0.002, Z0 + SLAB + 0.001); rig.add(gripSkin);
  const thumb = slab(0.020, 0.030, 0.010, 0.006, rubber); thumb.position.set(W / 2 - 0.030, -0.020, Z0 - 0.008); rig.add(thumb);

  /* ---- top plate (camera up is -y) ---- */
  const evf = slab(0.040, 0.020, 0.040, 0.006, mag); evf.position.set(-0.008, -H / 2 - 0.008, Z0 + 0.014); rig.add(evf);
  const eyecup = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.024, 0.010), rubber); eyecup.position.set(-0.008, -H / 2 - 0.007, Z0 - 0.004); rig.add(eyecup);
  const shoeBase = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.004, 0.020), black); shoeBase.position.set(-0.008, -H / 2 - 0.020, Z0 + 0.016); rig.add(shoeBase);
  for (const sx of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.020), steel); rail.position.set(-0.008 + sx * 0.0115, -H / 2 - 0.021, Z0 + 0.016); rig.add(rail); }
  const modeDial = dial(0.0145, 0.010, dialMat); modeDial.position.set(-0.040, -H / 2 - 0.004, Z0 + 0.020); rig.add(modeDial);
  const compDial = dial(0.0145, 0.009, dialMat); compDial.position.set(0.032, -H / 2 - 0.004, Z0 + 0.012); rig.add(compDial);
  const driveDial = dial(0.0125, 0.008, dialMat); driveDial.position.set(0.049, -H / 2 - 0.004, Z0 + 0.030); rig.add(driveDial);
  const shutter = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 20), steel); shutter.position.set(W / 2 - 0.026, -H / 2 - 0.004, Z0 + 0.056); shutter.rotation.z = 0.12; rig.add(shutter);
  const frontDial = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 24), dialMat); frontDial.rotation.z = Math.PI / 2; frontDial.position.set(W / 2 - 0.018, -H / 2 + 0.006, Z0 + 0.066); rig.add(frontDial);
  for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.0025, 16), black); b.position.set(0.010 + i * 0.011, -H / 2 - 0.003, Z0 + 0.030); rig.add(b); }

  /* ---- rear: screen, viewfinder controls ---- */
  const screenFrame = slab(0.072, 0.052, 0.004, 0.003, black); screenFrame.position.set(-0.014, 0.008, Z0 - 0.004); rig.add(screenFrame);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.046), new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.18, metalness: 0.1 }));
  screen.position.set(-0.014, 0.008, Z0 - 0.0045); screen.rotation.y = Math.PI; rig.add(screen);
  const rearDial = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0035, 10, 28), dialMat); rearDial.position.set(0.040, 0.014, Z0 - 0.002); rig.add(rearDial);
  const joystick = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.005, 12), black); joystick.rotation.x = Math.PI / 2; joystick.position.set(0.040, -0.012, Z0 - 0.003); rig.add(joystick);

  /* ---- E mount: 46.1 mm throat, ten gold contacts, index dot ---- */
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0305, 0.0035, 12, 48), steel); ring.position.z = Z0 + SLAB + 0.013; rig.add(ring);
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.0231, 0.0231, 0.014, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.8, side: THREE.DoubleSide }));
  throat.rotation.x = Math.PI / 2; throat.position.z = Z0 + SLAB + 0.008; rig.add(throat);
  for (let i = 0; i < 10; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.0015, 0.004), gold); const a = -0.55 + i * 0.12; c.position.set(Math.sin(a) * 0.0215, Math.cos(a) * 0.0215, Z0 + SLAB + 0.010); c.rotation.z = -a; rig.add(c); }
  const indexDot = new THREE.Mesh(new THREE.CircleGeometry(0.0022, 16), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4 }));
  indexDot.position.set(0, -0.036, Z0 + SLAB + 0.0122); rig.add(indexDot);
  const release = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.003, 16), black); release.rotation.x = Math.PI / 2; release.position.set(-0.040, 0.004, Z0 + SLAB + 0.012); rig.add(release);

  /* ---- badges ---- */
  const badge = (text, w, h, px) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: labelTexture(text, '#c8cad0', '#131418', px, 256, 64), transparent: false }));
  const sony = badge('SONY', 0.030, 0.0075, 34); sony.position.set(-0.030, -H / 2 - 0.0005, Z0 + 0.040); sony.rotation.x = Math.PI / 2; rig.add(sony);
  const model = badge('a7R III', 0.024, 0.006, 30); model.position.set(0.030, 0.030, Z0 - 0.0042); model.rotation.y = Math.PI; rig.add(model);

  /* ---- the servo zoom lens ---- */
  const lens = new THREE.Group(); lens.position.z = Z0 + SLAB + 0.013; rig.add(lens);
  const rear = new THREE.Mesh(new THREE.CylinderGeometry(0.0345, 0.0325, 0.030, 48), black); rear.rotation.x = Math.PI / 2; rear.position.z = 0.015; lens.add(rear);
  const zoomRing = new THREE.Mesh(new THREE.CylinderGeometry(0.0385, 0.0385, 0.020, 40), rubber); zoomRing.rotation.x = Math.PI / 2; zoomRing.position.z = 0.040; lens.add(zoomRing);
  const zoomGear = gearRing(0.0405, 0.008, 64, dialMat); zoomGear.position.z = 0.040; lens.add(zoomGear);
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.0375, 0.0375, 0.014, 48), black); mid.rotation.x = Math.PI / 2; mid.position.z = 0.057; lens.add(mid);
  const focusRing = new THREE.Mesh(new THREE.CylinderGeometry(0.0375, 0.0375, 0.018, 40), rubber); focusRing.rotation.x = Math.PI / 2; focusRing.position.z = 0.073; lens.add(focusRing);
  const focusGear = gearRing(0.0395, 0.008, 62, dialMat); focusGear.position.z = 0.073; lens.add(focusGear);
  /* an index mark on each ring so the roll is legible */
  for (const [ring2, r0] of [[zoomRing, 0.0387], [focusRing, 0.0377]]) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.004, 0.013), new THREE.MeshStandardMaterial({ color: 0xdad6ca, roughness: 0.45 }));
    mark.position.set(r0, 0, 0); mark.rotation.x = Math.PI / 2; ring2.add(mark);
  }
  const scale = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.008), new THREE.MeshBasicMaterial({ map: labelTexture('16  24  35  50  70  100  150', '#cfcfcf', '#0e0f12', 26, 512, 64) }));
  scale.position.set(0, -0.0346, 0.057); scale.rotation.x = -Math.PI / 2; scale.rotation.z = Math.PI; lens.add(scale);
  const ext = new THREE.Group(); ext.position.z = 0.084; lens.add(ext);
  const frontBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0345, 0.0365, 0.030, 48), black); frontBarrel.rotation.x = Math.PI / 2; frontBarrel.position.z = 0.015; ext.add(frontBarrel);
  const filterRing = new THREE.Mesh(new THREE.CylinderGeometry(0.0355, 0.0345, 0.008, 48), dialMat); filterRing.rotation.x = Math.PI / 2; filterRing.position.z = 0.033; ext.add(filterRing);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.0405, 0.0355, 0.024, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.75, side: THREE.DoubleSide }));
  hood.rotation.x = Math.PI / 2; hood.position.z = 0.048; ext.add(hood);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.0315, 48), new THREE.MeshPhysicalMaterial({ color: 0x121d2e, roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, reflectivity: 0.6 }));
  glass.position.z = 0.036; ext.add(glass);
  const innerBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0318, 0.0318, 0.02, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.95, side: THREE.BackSide }));
  innerBarrel.rotation.x = Math.PI / 2; innerBarrel.position.z = 0.026; ext.add(innerBarrel);

  /* ---- 15 mm rod baseplate under the lens ---- */
  const rods = new THREE.Group(); rig.add(rods);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.010, 0.040), alu); base.position.set(0, H / 2 - 0.004, Z0 + SLAB + 0.010); rods.add(base);
  for (const sx of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.115, 20), steel);
    rod.rotation.x = Math.PI / 2; rod.position.set(sx * 0.030, H / 2 - 0.012, Z0 + SLAB + 0.060); rods.add(rod);
  }

  /* ---- two Feetech HLS3915M bus servos (34 x 20 x 23 mm) on the rods ---- */
  const servo = (label) => {
    const g = new THREE.Group();
    const shell = slab(0.020, 0.023, 0.026, 0.002, alu); shell.rotation.y = Math.PI / 2; shell.position.z = 0; g.add(shell);   /* aluminium mid-case, 34 mm long overall */
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.023, 0.020), black); cap.position.x = -0.017; g.add(cap);         /* moulded end caps */
    const cap2 = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.023, 0.020), black); cap2.position.x = 0.017; g.add(cap2);
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.004, 20), black); boss.rotation.z = Math.PI / 2; boss.position.x = 0.019; g.add(boss);
    const spline = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.006, 25), steel); spline.rotation.z = Math.PI / 2; spline.position.x = 0.023; g.add(spline);   /* 25T, OD 4.95 mm */
    const idler = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.004, 12), steel); idler.rotation.z = Math.PI / 2; idler.position.x = -0.021; g.add(idler);        /* the dual shaft's rear stub */
    const pinion = gearRing(0.0075, 0.008, 14, dialMat); pinion.rotation.y = Math.PI / 2; pinion.position.x = 0.026; g.add(pinion);
    for (const s2 of [-1, 1]) { const jst = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.006, 0.008), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 })); jst.position.set(-0.019, 0.006, s2 * 0.008); g.add(jst); }
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.024, 0.007), new THREE.MeshBasicMaterial({ map: labelTexture(label, '#dcdcdc', '#24272c', 26, 256, 64) }));
    lbl.position.set(0, -0.0116, 0); lbl.rotation.x = Math.PI / 2; g.add(lbl);
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.026, 0.014), alu); clamp.position.set(0, 0.020, 0); g.add(clamp);
    g.userData.pinion = pinion; return g;
  };
  const zoomServo = servo('HLS3915M'), focusServo = servo('HLS3915M');
  zoomServo.position.set(-0.052, H / 2 - 0.020, Z0 + SLAB + 0.053); zoomServo.rotation.z = 0;      /* pinion meshes with the zoom ring */
  focusServo.position.set(-0.052, H / 2 - 0.020, Z0 + SLAB + 0.086);                               /* and with the focus ring */
  rig.add(zoomServo, focusServo);
  const wire = (from, to) => {
    const curve = new THREE.CatmullRomCurve3([from, from.clone().add(new THREE.Vector3(-0.012, 0.010, 0)), to.clone().add(new THREE.Vector3(-0.012, 0.010, 0)), to]);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0016, 6, false), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.7 }));
  };
  rig.add(wire(new THREE.Vector3(-0.071, H / 2 - 0.014, Z0 + SLAB + 0.045), new THREE.Vector3(-0.071, H / 2 - 0.014, Z0 + SLAB + 0.078)));
  rig.add(wire(new THREE.Vector3(-0.071, H / 2 - 0.014, Z0 + SLAB + 0.045), new THREE.Vector3(-0.030, H / 2 + 0.002, Z0 + 0.020)));

  /* the three.js camera on the optical axis: it looks down -z with +y up, so rotate pi about x */
  const cam = new THREE.PerspectiveCamera(fovV(35), 3 / 2, 0.03, 30);
  cam.position.set(0, 0, 0.14);                       /* = kin.TOOL_OFFSET, the entrance pupil */
  cam.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI); rig.add(cam);
  rig.userData = { cam, lens, ext, zoomRing, focusRing, zoomGear, focusGear, zoomServo, focusServo };
  return rig;
}

/* ------------------------------------------------------------------ studio */
export class Studio {
  constructor(canvas, spec, model, opts = {}) {
    this.canvas = canvas; this.spec = spec; this.arm = new Arm(model); this.lens = new Lens(); this.opts = opts;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture });
    this.renderer.setPixelRatio(opts.capture ? 1 : Math.min(window.devicePixelRatio || 1, 2)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.64; this.renderer.setClearColor(0x0d1017, 1);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x151820);
    const pmrem = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.45;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.02, 60); this.camera.up.copy(Z_UP); this.camera.position.set(-0.75, -1.15, 0.85);
    this.controls = new OrbitControls(this.camera, canvas); this.controls.target.set(0.4, 0, 0.12); this.controls.enableDamping = true; this.controls.dampingFactor = 0.08; this.controls.maxPolarAngle = Math.PI * 0.52; this.controls.minDistance = 0.25; this.controls.maxDistance = 6;
    this.q = this.arm.home.slice(); this.t = 0; this.carT = 0; this.products = new THREE.Group(); this.scene.add(this.products); this.setId = null; this.viewport = { main: null, feed: null };
    this.buildStudio(); this.rig = buildRig(); this.feedCam = this.rig.userData.cam;
    this.dof = new DofPass(960, 640); this.dofEnabled = true;
    this.armReady = this.loadArm(); this.ready = Promise.all([this.armReady, this.loadSet(spec.default_set)]);
    /* the end-effector target gizmo */
    this.handle = new THREE.Object3D(); this.scene.add(this.handle);
    this.gizmo = new TransformControls(this.camera, canvas); this.gizmo.setSize(0.55); this.gizmo.attach(this.handle); this.gizmo.enabled = false; this.gizmoHelper = this.gizmo.getHelper ? this.gizmo.getHelper() : this.gizmo; this.gizmoHelper.visible = false; this.scene.add(this.gizmoHelper);
    this.gizmo.addEventListener('dragging-changed', (e) => { this.controls.enabled = !e.value; });
    this.trail = null;
    new ResizeObserver(() => this.resize()).observe(canvas); this.resize();
  }
  /* ---- the set: floor, desk, a cyclorama well clear of the arm, and studio lights ---- */
  buildStudio() {
    const s = this.scene, d = this.spec.desk;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), mat(0x1b1d21, { roughness: 0.95 })); floor.position.z = -d.height; floor.receiveShadow = true; s.add(floor);
    const wood = mat(0x6a5a4a, { roughness: 0.78 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(d.x[1] - d.x[0], d.y[1] - d.y[0], d.thickness), wood);
    top.position.set((d.x[0] + d.x[1]) / 2, 0, -d.thickness / 2); top.receiveShadow = true; top.castShadow = true; s.add(top);
    const legMat = mat(0x2c2e33, { metalness: 0.55, roughness: 0.45 });
    for (const [x, y] of [[d.x[0] + 0.06, d.y[0] + 0.06], [d.x[1] - 0.06, d.y[0] + 0.06], [d.x[0] + 0.06, d.y[1] - 0.06], [d.x[1] - 0.06, d.y[1] - 0.06]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, d.height - d.thickness), legMat); leg.position.set(x, y, -(d.height + d.thickness) / 2); leg.castShadow = true; s.add(leg);
    }
    /* the base clamp under the arm */
    const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.012, 48), mat(0x1a1c20, { metalness: 0.5, roughness: 0.5 }));
    clamp.rotation.x = Math.PI / 2; clamp.position.z = 0.006; clamp.castShadow = true; s.add(clamp);

    /* Cyclorama: one cylinder wrapping the whole set, 3.4 m out — far outside the arm's 0.7 m
       reach — with a coved skirt into the floor. A single surface has no corners, so no hard
       vertical seam can ever appear behind a product. */
    const CYC_R = 3.4, CYC_C = [0.45, 0], cycCol = 0x9d9a94;
    const cycMat = new THREE.MeshStandardMaterial({ color: cycCol, roughness: 1.0, metalness: 0.0, side: THREE.BackSide });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(CYC_R, CYC_R, 6, 96, 1, true), cycMat);
    wall.rotation.x = Math.PI / 2; wall.position.set(CYC_C[0], CYC_C[1], -d.height + 2.6); wall.receiveShadow = true; s.add(wall);
    const cove = new THREE.Mesh(new THREE.CylinderGeometry(CYC_R, CYC_R - 0.85, 0.85, 96, 1, true), cycMat);
    cove.rotation.x = Math.PI / 2; cove.position.set(CYC_C[0], CYC_C[1], -d.height + 0.425); cove.receiveShadow = true; s.add(cove);
    const cycFloor = new THREE.Mesh(new THREE.CircleGeometry(CYC_R - 0.84, 96), new THREE.MeshStandardMaterial({ color: cycCol, roughness: 1.0 }));
    cycFloor.position.set(CYC_C[0], CYC_C[1], -d.height + 0.002); cycFloor.receiveShadow = true; s.add(cycFloor);

    /* Lights: a big soft key through a scrim, a broad fill, a rim, and a low ambient.
       Softer and dimmer than a hard spot, so black anodised parts stay black. */
    s.add(new THREE.HemisphereLight(0xfaf7f2, 0x24262c, 0.34));
    const key = new THREE.SpotLight(0xfff6f0, 12, 8, 0.9, 0.9, 1.4);
    key.position.set(1.05, -1.15, 1.25); key.target.position.set(0.55, 0, 0.06);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.radius = 8; key.shadow.camera.near = 0.4; key.shadow.camera.far = 6; s.add(key, key.target);
    const fill = new THREE.SpotLight(0xeef3ff, 5.5, 8, 0.98, 0.98, 1.4); fill.position.set(0.1, 1.3, 0.95); fill.target.position.set(0.55, 0, 0.06); s.add(fill, fill.target);
    const rim = new THREE.SpotLight(0xffffff, 6.5, 8, 0.75, 0.85, 1.4); rim.position.set(1.8, 0.7, 1.15); rim.target.position.set(0.5, 0, 0.12); s.add(rim, rim.target);
    const bounce = new THREE.DirectionalLight(0xf3ece0, 0.25); bounce.position.set(-1.2, 0.2, 0.4); s.add(bounce);
    const softbox = (light, w, h) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.22), mat(0x1d1f23, { roughness: 0.9 })));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, h * 0.94), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3e4, emissiveIntensity: 1.6 }));
      face.position.z = 0.112; g.add(face);
      g.position.copy(light.position); g.lookAt(light.target.position);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, light.position.z + d.height, 12), legMat);
      stand.rotation.x = Math.PI / 2; stand.position.set(light.position.x, light.position.y, (light.position.z - d.height) / 2); s.add(stand);
      return g;
    };
    s.add(softbox(key, 0.75, 0.55), softbox(fill, 0.6, 0.45));

    /* the toy car's track */
    const c = this.spec.car;
    const track = new THREE.Mesh(new THREE.RingGeometry(c.radius - 0.012, c.radius + 0.012, 96), mat(0x3f434b, { roughness: 0.9 }));
    track.position.set(c.centre[0], c.centre[1], 0.0006); s.add(track);
    this.car = PROPS.toy_car(); this.car.traverse(o => { if (o.isMesh) o.castShadow = true; }); s.add(this.car); this.updateCar(0);
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
    /* the rings roll about the barrel: their geometry axis is local +y, so after the rotation.x = pi/2
       that lays them along the optical axis, the spin is rotation.y (Euler XYZ applies it first) */
    u.zoomRing.rotation.y = u.zoomGear.rotation.y = (this.lens.f - LENS.fmin) / (LENS.fmax - LENS.fmin) * 2.4;
    u.focusRing.rotation.y = u.focusGear.rotation.y = Math.log(this.lens.S / LENS.mfd) * 1.2;
    u.zoomServo.userData.pinion.rotation.y = -u.zoomRing.rotation.y * 5; u.focusServo.userData.pinion.rotation.y = -u.focusRing.rotation.y * 5;
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
      /* the path and the floating frames are director's furniture: the lens must never see them
         (a static shot puts its own key frames a few centimetres in front of the glass) */
      const kg = this.keyGroup ? this.keyGroup.visible : false, pv = this.pathLine ? this.pathLine.visible : false;
      if (this.keyGroup) this.keyGroup.visible = false; if (this.pathLine) this.pathLine.visible = false;
      this.feedCam.aspect = fr.w / fr.h; this.feedCam.updateProjectionMatrix();
      r.setViewport(fr.x * pr, fr.y * pr, fr.w * pr, fr.h * pr); r.setScissor(fr.x * pr, fr.y * pr, fr.w * pr, fr.h * pr);
      this.dof.render(r, this.scene, this.feedCam, this.lens, this.dofEnabled && !this.feedNoDof);
      this.rig.visible = true; this.gizmoHelper.visible = gv; if (this.trail) this.trail.visible = true;
      if (this.keyGroup) this.keyGroup.visible = kg; if (this.pathLine) this.pathLine.visible = pv;
    }
    r.setScissorTest(false);
  }
  /** Composite the DOF quad into a rect (called by render through DofPass with the viewport set). */
  /* ---- helpers for the app ---- */
  subjectWorld(name, ctx) { return ctx.subject(name); }
  /** Project a world point into the feed image: returns [u, v] in [0,1] (v down) and whether it is in front of the camera. */
  projectToFeed(p) { const v = new THREE.Vector3(p[0], p[1], p[2]).project(this.feedCam); return { u: (v.x + 1) / 2, v: (1 - v.y) / 2, inFront: v.z < 1 && v.z > -1 }; }
  /** Read the feed's pixels (downsampled) for the pixel tracker. */
  readFeed(w = 132, h = 88) {
    if (!this._pick) { this._pick = new THREE.WebGLRenderTarget(w, h); this._pickBuf = new Uint8Array(w * h * 4); this._pickCam = this.feedCam.clone(); }
    const r = this.renderer; this._pickCam.fov = this.feedCam.fov; this._pickCam.aspect = this.feedCam.aspect; this._pickCam.near = this.feedCam.near; this._pickCam.far = this.feedCam.far; this._pickCam.updateProjectionMatrix();
    this.feedCam.getWorldPosition(this._pickCam.position); this.feedCam.getWorldQuaternion(this._pickCam.quaternion);   /* the lens, not the mount */
    this._pickCam.updateMatrixWorld(true);
    const prev = r.getRenderTarget(); const rigVis = this.rig.visible; this.rig.visible = false; const gv = this.gizmoHelper.visible; this.gizmoHelper.visible = false;
    const kg = this.keyGroup ? this.keyGroup.visible : false, pv = this.pathLine ? this.pathLine.visible : false, tv = this.trail ? this.trail.visible : false;
    if (this.keyGroup) this.keyGroup.visible = false; if (this.pathLine) this.pathLine.visible = false; if (this.trail) this.trail.visible = false;
    r.setRenderTarget(this._pick); r.render(this.scene, this._pickCam); r.readRenderTargetPixels(this._pick, 0, 0, w, h, this._pickBuf); r.setRenderTarget(prev);
    this.rig.visible = rigVis; this.gizmoHelper.visible = gv; if (this.keyGroup) this.keyGroup.visible = kg; if (this.pathLine) this.pathLine.visible = pv; if (this.trail) this.trail.visible = tv;
    return { data: this._pickBuf, w, h };
  }
  /** Draw a polyline trail of end-effector positions. */
  setTrail(points) {
    if (this.trail) { this.scene.remove(this.trail); this.trail.geometry.dispose(); this.trail = null; }
    if (!points || points.length < 2) return;
    const g = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
    this.trail = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffce0a, transparent: true, opacity: 0.85 })); this.scene.add(this.trail);
  }
  /* ================= timeline visualisation in the 3-D view ================= */

  /** Draw the camera's path as a soft tube through the sampled points. */
  setPath(points, colour = 0x0a84ff) {
    if (this.pathLine) { this.scene.remove(this.pathLine); this.pathLine.geometry.dispose(); this.pathLine = null; }
    if (!points || points.length < 2) return;
    const pts = points.map(p => new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.4);
    const geo = new THREE.TubeGeometry(curve, Math.min(400, pts.length * 3), 0.0035, 8, false);
    this.pathLine = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.75 }));
    this.pathLine.renderOrder = 3; this.scene.add(this.pathLine);
  }

  /** A frame preview at every key: a wire frustum plus a plane showing what the camera would see. */
  setKeyMarkers(keys, opts = {}) {
    if (!this.keyGroup) { this.keyGroup = new THREE.Group(); this.scene.add(this.keyGroup); this.keyMeshes = []; }
    for (const m of this.keyMeshes) { m.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.keyGroup.remove(m.group); }
    this.keyMeshes = [];
    const size = opts.size ?? 0.075;
    for (const k of keys) {
      const g = new THREE.Group();
      const R = k.R; const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(R[0][0], R[0][1], R[0][2], 0, R[1][0], R[1][1], R[1][2], 0, R[2][0], R[2][1], R[2][2], 0, 0, 0, 0, 1));
      g.position.set(...k.pos); g.quaternion.copy(q);
      const h = size * Math.tan(fovV(k.f) * Math.PI / 360) / Math.tan(fovV(35) * Math.PI / 360);
      const w = h * 1.5;
      const pts = [[0, 0, 0], [-w, -h, size], [w, -h, size], [w, h, size], [-w, h, size]];
      const idx = [0, 1, 0, 2, 0, 3, 0, 4, 1, 2, 2, 3, 3, 4, 4, 1];
      const pos = []; for (const i of idx) pos.push(...pts[i]);
      const wire = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)),
        new THREE.LineBasicMaterial({ color: 0x0a84ff, transparent: true, opacity: 0.9 }));
      g.add(wire);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(2 * w, 2 * h), new THREE.MeshBasicMaterial({ color: 0x11141a, toneMapped: false, side: THREE.DoubleSide }));
      screen.position.z = size; screen.rotation.y = Math.PI;      /* the frame sits at the far end, facing back down the axis */
      g.add(screen);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), new THREE.MeshBasicMaterial({ color: 0x0a84ff, transparent: true, opacity: 0.85 }));
      g.add(hit);
      this.keyGroup.add(g);
      this.keyMeshes.push({ id: k.id, group: g, screen, wire, hit });
    }
    return this.keyMeshes;
  }
  /** Render what the camera sees at a key and paste it onto that key's floating frame. */
  renderKeyThumbnail(key, marker) {
    const w = 128, h = 86;
    const px = this.keyImage(key, w, h);                 /* bottom-up RGBA, the same read-back the strip uses */
    let tex = marker.ownTex;
    if (!tex || tex.image.width !== w) { tex = marker.ownTex = new THREE.DataTexture(new Uint8Array(px), w, h, THREE.RGBAFormat); tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; }
    else tex.image.data.set(px);
    tex.needsUpdate = true;
    marker.screen.material.map = tex; marker.screen.material.color.set(0xffffff); marker.screen.material.needsUpdate = true;
    return tex;
  }
  /** Pixels of what the camera would see at a key, for the strip of stops (bottom-up RGBA). */
  keyImage(key, w = 96, h = 64) {
    if (!this._kiRT || this._kiRT.width !== w) { if (this._kiRT) this._kiRT.dispose(); this._kiRT = new THREE.WebGLRenderTarget(w, h); this._kiRT.texture.colorSpace = THREE.SRGBColorSpace; this._kiBuf = new Uint8Array(w * h * 4); this._kiCam = new THREE.PerspectiveCamera(50, w / h, 0.03, 30); }
    const cam = this._kiCam; cam.fov = fovV(key.f); cam.aspect = w / h; cam.updateProjectionMatrix();
    cam.position.set(...key.pos);
    const R = key.R; const m = new THREE.Matrix4().set(R[0][0], R[0][1], R[0][2], 0, R[1][0], R[1][1], R[1][2], 0, R[2][0], R[2][1], R[2][2], 0, 0, 0, 0, 1);
    cam.quaternion.setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
    cam.updateMatrixWorld(true);
    const r = this.renderer, prev = r.getRenderTarget(), st = r.getScissorTest();
    const vis = [this.rig.visible, this.keyGroup ? this.keyGroup.visible : false, this.pathLine ? this.pathLine.visible : false, this.gizmoHelper.visible, this.trail ? this.trail.visible : false];
    this.rig.visible = false; if (this.keyGroup) this.keyGroup.visible = false; if (this.pathLine) this.pathLine.visible = false; this.gizmoHelper.visible = false; if (this.trail) this.trail.visible = false;
    r.setScissorTest(false); r.setRenderTarget(this._kiRT); r.setViewport(0, 0, w, h); r.clear(); r.render(this.scene, cam);
    r.readRenderTargetPixels(this._kiRT, 0, 0, w, h, this._kiBuf);
    r.setRenderTarget(prev); r.setScissorTest(st);
    this.rig.visible = vis[0]; if (this.keyGroup) this.keyGroup.visible = vis[1]; if (this.pathLine) this.pathLine.visible = vis[2]; this.gizmoHelper.visible = vis[3]; if (this.trail) this.trail.visible = vis[4];
    return this._kiBuf;
  }
  /** Highlight one key marker. */
  highlightKey(id) { for (const m of this.keyMeshes || []) { const on = m.id === id; m.wire.material.color.set(on ? 0xffd60a : 0x0a84ff); m.hit.material.color.set(on ? 0xffd60a : 0x0a84ff); m.group.scale.setScalar(on ? 1.15 : 1); } }
  /** Ray-pick a key marker from a normalised pointer position. */
  pickKey(nx, ny) {
    if (!this.keyMeshes || !this.keyMeshes.length) return null;
    const ray = this._ray || (this._ray = new THREE.Raycaster());
    ray.setFromCamera({ x: nx, y: ny }, this.camera);
    const hits = ray.intersectObjects(this.keyMeshes.map(m => m.group), true);
    if (!hits.length) return null;
    for (const m of this.keyMeshes) { let found = false; m.group.traverse(o => { if (o === hits[0].object) found = true; }); if (found) return m.id; }
    return null;
  }

  /** The live camera's frustum, drawn in the studio view. */
  setFrustumVisible(on) {
    if (!this.frustum) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(16 * 3), 3));
      this.frustum = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffd60a, transparent: true, opacity: 0.55 }));
      this.frustum.frustumCulled = false; this.rig.add(this.frustum);
    }
    this.frustum.visible = !!on;
  }
  /** A screen floating at the focus distance showing exactly what the lens sees. */
  setProjectedFeedVisible(on) {
    if (!this.projScreen) {
      const geo = new THREE.PlaneGeometry(1, 1);
      this.projScreen = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.dof.rt.texture, toneMapped: false, side: THREE.DoubleSide, transparent: true, opacity: 0.96 }));
      this.projScreen.rotation.y = Math.PI; this.rig.add(this.projScreen);
      this.projEdge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffd60a })); this.projScreen.add(this.projEdge);
    }
    this.projScreen.visible = !!on;
  }
  updateProjection(distance) {
    const d = Math.max(0.12, Math.min(1.6, distance));
    if (this.frustum && this.frustum.visible) {
      const h = d * Math.tan(fovV(this.lens.f) * Math.PI / 360), w = h * (this.feedCam.aspect || 1.5);
      const c = [[0, 0, 0], [-w, -h, d], [w, -h, d], [w, h, d], [-w, h, d]];
      const idx = [0, 1, 0, 2, 0, 3, 0, 4, 1, 2, 2, 3, 3, 4, 4, 1]; const arr = this.frustum.geometry.attributes.position.array;
      idx.forEach((i, k) => { arr[k * 3] = c[i][0]; arr[k * 3 + 1] = c[i][1]; arr[k * 3 + 2] = c[i][2]; });
      this.frustum.geometry.attributes.position.needsUpdate = true;
    }
    if (this.projScreen && this.projScreen.visible) {
      const h = 2 * d * Math.tan(fovV(this.lens.f) * Math.PI / 360), w = h * (this.feedCam.aspect || 1.5);
      this.projScreen.scale.set(w, h, 1); this.projScreen.position.set(0, 0, d);
    }
  }
  /** Sharpness of the feed inside a centred box, for contrast-detect autofocus (variance of the Laplacian). */
  sharpness(boxFrac = 0.34) {
    const f = this.readFeed(); const W = f.w, H = f.h;
    const x0 = Math.floor(W * (0.5 - boxFrac / 2)), x1 = Math.ceil(W * (0.5 + boxFrac / 2));
    const y0 = Math.floor(H * (0.5 - boxFrac / 2)), y1 = Math.ceil(H * (0.5 + boxFrac / 2));
    let sum = 0, sum2 = 0, n = 0;
    const lum = (x, y) => { const i = (y * W + x) * 4; return 0.299 * f.data[i] + 0.587 * f.data[i + 1] + 0.114 * f.data[i + 2]; };
    for (let y = y0 + 1; y < y1 - 1; y++) for (let x = x0 + 1; x < x1 - 1; x++) {
      const l = 4 * lum(x, y) - lum(x - 1, y) - lum(x + 1, y) - lum(x, y - 1) - lum(x, y + 1);
      sum += l; sum2 += l * l; n++;
    }
    if (!n) return 0;
    const mean = sum / n; return Math.max(0, sum2 / n - mean * mean);
  }

  /** ---------------------------------------------------------------------
      Depth from the camera's own view.  The scene is re-rendered from the lens
      with a depth material into a small RGBA target; unpacking that gives
      gl_FragCoord.z, and the perspective relation

          z_view = 2 n f / (f + n - (2 z_ndc - 1)(f - n))

      turns it into metres.  Sampling a patch and taking the median rejects the
      background showing between a subject's edges, which is what makes a naive
      centre-pixel reading rack focus to the back wall.  Returns metres or null.
      --------------------------------------------------------------------- */
  depthAt(u = 0.5, v = 0.5, boxFrac = 0.13) {
    const W = 96, H = 64;
    if (!this._depthRT) {
      this._depthRT = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      this._depthBuf = new Uint8Array(W * H * 4);
      this._depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      this._depthCam = new THREE.PerspectiveCamera(50, 1.5, 0.03, 30);
      this._depthVals = [];
    }
    const r = this.renderer, cam = this._depthCam;
    cam.fov = this.feedCam.fov; cam.aspect = this.feedCam.aspect || 1.5; cam.near = this.feedCam.near; cam.far = this.feedCam.far; cam.updateProjectionMatrix();
    this.feedCam.getWorldPosition(cam.position); this.feedCam.getWorldQuaternion(cam.quaternion); cam.updateMatrixWorld(true);
    const prevRT = r.getRenderTarget(), st = r.getScissorTest(), rigVis = this.rig.visible, gv = this.gizmoHelper.visible;
    const kg = this.keyGroup ? this.keyGroup.visible : false, pl = this.pathLine ? this.pathLine.visible : false;
    this.rig.visible = false; this.gizmoHelper.visible = false; if (this.keyGroup) this.keyGroup.visible = false; if (this.pathLine) this.pathLine.visible = false;
    this.scene.overrideMaterial = this._depthMat;
    r.setScissorTest(false); r.setRenderTarget(this._depthRT); r.setViewport(0, 0, W, H); r.clear(); r.render(this.scene, cam);
    r.readRenderTargetPixels(this._depthRT, 0, 0, W, H, this._depthBuf);
    this.scene.overrideMaterial = null;
    r.setRenderTarget(prevRT); r.setScissorTest(st);
    this.rig.visible = rigVis; this.gizmoHelper.visible = gv; if (this.keyGroup) this.keyGroup.visible = kg; if (this.pathLine) this.pathLine.visible = pl;
    /* the read-back is bottom-up, the caller's v is top-down */
    const cx = Math.round(u * W), cy = Math.round((1 - v) * H);
    const rad = Math.max(1, Math.round(boxFrac * W / 2));
    const n = cam.near, fq = cam.far, vals = this._depthVals; vals.length = 0;
    for (let y = Math.max(0, cy - rad); y <= Math.min(H - 1, cy + rad); y++)
      for (let x = Math.max(0, cx - rad); x <= Math.min(W - 1, cx + rad); x++) {
        const i = (y * W + x) * 4, b = this._depthBuf;
        const z = (b[i] * 16711680 + b[i + 1] * 65280 + b[i + 2] * 255 + b[i + 3]) / 4294967295;   /* unpack RGBA -> [0,1] */
        if (z >= 0.999999) continue;                                                              /* the clear value: nothing there */
        vals.push(2 * n * fq / (fq + n - (2 * z - 1) * (fq - n)));
      }
    if (vals.length < 4) return null;
    vals.sort((a, b) => a - b);
    return vals[Math.floor(vals.length * 0.35)];      /* lean to the near side: the subject, not the gap around it */
  }

  /** Position the gizmo handle at the current end-effector pose. */
  syncHandle() { const T = this.arm.fk(this.q); this.handle.position.set(T[0][3], T[1][3], T[2][3]); const m = new THREE.Matrix4().set(T[0][0], T[0][1], T[0][2], 0, T[1][0], T[1][1], T[1][2], 0, T[2][0], T[2][1], T[2][2], 0, 0, 0, 0, 1); this.handle.quaternion.setFromRotationMatrix(m); }
  handlePose() { const p = this.handle.position, m = new THREE.Matrix4().makeRotationFromQuaternion(this.handle.quaternion), e = m.elements; return { pos: [p.x, p.y, p.z], R: [[e[0], e[4], e[8]], [e[1], e[5], e[9]], [e[2], e[6], e[10]]] }; }
}

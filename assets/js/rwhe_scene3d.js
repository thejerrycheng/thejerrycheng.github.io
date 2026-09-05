/* =============================================================================
   rwhe_scene3d.js — interactive three.js scenes for the certifiable RWHEC page.
   1. experiment(): the real eight-camera rig replayed through the mocap room
      with the sixteen AprilTags at their certified poses (rotate / pan / zoom,
      play at constant speed, scrub, click a tag or a camera).
   2. results(): the certified camera cluster and the tag constellation, with the
      linear two-stage solution and the unknown-scale solution as ghosts.
   3. demo(): a 6-axis robot arm for the live demo (IK to each hand pose, smooth
      motion), driven by demo_rwhe.js through window.RW3D.demoView.update().
   Data: assets/data/rwhe_scene.json (experiments/export_scene.py).
   ============================================================================= */
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const INK = 0x151820, CREAM = 0xF4EAD2, GOLD = 0xD9A13F, BLUE = 0x1E88E5, RED = 0xD81B60, GREEN = 0x43A047, ASH = 0x8f8a7a, YEL = 0xFFD54F;
const PAL = [0x1E88E5, 0xD81B60, 0x43A047, 0xD9A13F, 0x8E24AA, 0x00ACC1, 0xF4511E, 0xC0CA33];
const TAG_IDS = [0, 1, 2, 6, 8, 11, 12, 13, 14, 15, 16, 18, 19, 20, 22, 23];
const DATA_URL = 'assets/data/rwhe_scene.json';
const ATLAS_URL = 'assets/images/projects/rwhe/tags/atlas36h11.png';

/* ---------- small helpers ---------- */
function viridis(t) { t = Math.min(1, Math.max(0, t)); const c = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]]; const x = t * 4, i = Math.min(3, Math.floor(x)), f = x - i; return new THREE.Color(((1 - f) * c[i][0] + f * c[i + 1][0]) / 255, ((1 - f) * c[i][1] + f * c[i + 1][1]) / 255, ((1 - f) * c[i][2] + f * c[i + 1][2]) / 255); }
function lerpColor(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t))); }
function labelSprite(text, color, px) {
  px = px || 26; const cv = document.createElement('canvas'), ctx = cv.getContext('2d'); ctx.font = 'bold ' + px + 'px Jost, Arial, sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 16, h = px + 12; cv.width = w * 2; cv.height = h * 2; ctx.scale(2, 2);
  ctx.font = 'bold ' + px + 'px Jost, Arial, sans-serif'; ctx.fillStyle = 'rgba(21,24,32,0.55)'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#' + new THREE.Color(color).getHexString(); ctx.textBaseline = 'middle'; ctx.fillText(text, 8, h / 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false })); sp.scale.set(w / 1500, h / 1500, 1); sp.renderOrder = 10; return sp;   /* screen-space size, independent of distance */
}
function poseGroup(t, q) { const g = new THREE.Group(); g.position.set(t[0], t[1], t[2]); g.quaternion.set(q[0], q[1], q[2], q[3]); return g; }
function eulerXYZdeg(rpy) { const D = Math.PI / 180; return new THREE.Quaternion().setFromEuler(new THREE.Euler(rpy[0] * D, rpy[1] * D, rpy[2] * D, 'ZYX')); }  /* scipy 'xyz' extrinsic = Rz Ry Rx */
function frustumLines(size, color, opacity, fov, aspect) {
  fov = fov || 62; aspect = aspect || 1.33; const hw = size * Math.tan(fov / 2 * Math.PI / 180), hh = hw / aspect;
  const c = [[-hw, -hh, size], [hw, -hh, size], [hw, hh, size], [-hw, hh, size]], pts = [];
  for (let i = 0; i < 4; i++) { pts.push(0, 0, 0, c[i][0], c[i][1], c[i][2]); pts.push(c[i][0], c[i][1], c[i][2], c[(i + 1) % 4][0], c[(i + 1) % 4][1], c[(i + 1) % 4][2]); }
  pts.push(-hw * 0.35, hh, size, 0, hh * 1.35, size, hw * 0.35, hh, size, 0, hh * 1.35, size);   /* "up" tick */
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: color, transparent: opacity < 1, opacity: opacity === undefined ? 1 : opacity }));
}
function cameraModel(size, color, opacity) {
  const g = new THREE.Group(); g.add(frustumLines(size, color, opacity));
  const body = new THREE.Mesh(new THREE.BoxGeometry(size * 0.5, size * 0.4, size * 0.45), new THREE.MeshStandardMaterial({ color: 0x2b2f3a, metalness: 0.4, roughness: 0.5, transparent: opacity < 1, opacity: opacity === undefined ? 1 : opacity }));
  body.position.z = -size * 0.22; g.add(body);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.16, size * 0.16, size * 0.16, 20), new THREE.MeshStandardMaterial({ color: color, metalness: 0.6, roughness: 0.3, transparent: opacity < 1, opacity: opacity === undefined ? 1 : opacity }));
  lens.rotation.x = Math.PI / 2; lens.position.z = size * 0.06; g.add(lens);
  g.userData.lines = g.children[0]; return g;
}
let atlasTex = null;
function atlas() { if (!atlasTex) { atlasTex = new THREE.TextureLoader().load(ATLAS_URL); atlasTex.magFilter = THREE.NearestFilter; atlasTex.minFilter = THREE.NearestFilter; atlasTex.colorSpace = THREE.SRGBColorSpace; } return atlasTex; }
function tagObject(index, size, frontZ) {
  /* tag frame: x right, y down, z into the tag; the cameras sit on the frontZ side (-1 in this data set) */
  const g = new THREE.Group(); const geo = new THREE.PlaneGeometry(size, size); const uv = geo.attributes.uv; const col = index % 4, row = Math.floor(index / 4);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / 4, ((3 - row) + uv.getY(i)) / 4);
  if (frontZ < 0) geo.rotateX(Math.PI);   /* face -z, image y down */
  const face = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: atlas(), side: THREE.FrontSide })); g.add(face);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.28, size * 1.28), new THREE.MeshStandardMaterial({ color: 0x3a3d45, roughness: 0.9, side: THREE.DoubleSide })); board.position.z = -0.003 * frontZ; g.add(board);
  const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(size * 1.3, size * 1.3)), new THREE.LineBasicMaterial({ color: 0x6b5d2a })); border.position.z = -0.004 * frontZ; g.add(border);
  g.userData.face = face; g.userData.border = border; return g;
}
function rigModel(cams, size) {
  size = size || 0.12; const g = new THREE.Group(); const pts = cams.map(c => new THREE.Vector3(c.t[0], c.t[1], c.t[2]));
  const bb = new THREE.Box3().setFromPoints(pts); const c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
  const body = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.12, s.x * 0.85), Math.max(0.1, s.y * 0.85), Math.max(0.12, s.z * 0.85)), new THREE.MeshStandardMaterial({ color: 0x353a47, metalness: 0.35, roughness: 0.55 })); body.position.copy(c); g.add(body);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 12), new THREE.MeshStandardMaterial({ color: 0x8c8c8c, metalness: 0.7, roughness: 0.3 })); bar.position.copy(c).add(new THREE.Vector3(0, -0.2, 0)); g.add(bar);   /* handle */
  const markerMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, emissive: 0x666666, roughness: 0.4 });
  [[0.5, 0.6, 0.5], [-0.5, 0.6, 0.5], [0.5, 0.6, -0.5], [-0.5, 0.6, -0.5], [0, 0.95, 0], [0.55, 0.2, 0]].forEach(m => { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), markerMat); sp.position.set(c.x + m[0] * body.geometry.parameters.width, c.y + m[1] * body.geometry.parameters.height, c.z + m[2] * body.geometry.parameters.depth); g.add(sp); });
  const imu = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.024, 0.036), new THREE.MeshStandardMaterial({ color: 0xc44b1f, roughness: 0.6 })); imu.position.copy(c).add(new THREE.Vector3(0, body.geometry.parameters.height / 2 + 0.012, 0)); g.add(imu);
  g.userData.cams = cams.map((cam, k) => { const cg = poseGroup(cam.t, cam.q); const m = cameraModel(size, PAL[k % PAL.length], 0.9); cg.add(m); const lb = labelSprite('cam ' + cam.id, PAL[k % PAL.length], 22); lb.position.set(0, 0.07, -0.03); cg.add(lb); cg.userData.model = m; cg.userData.label = lb; g.add(cg); return cg; });
  g.add(new THREE.AxesHelper(0.12)); return g;
}

/* ---------- viewer ---------- */
class Viewer {
  constructor(canvas, opts) {
    opts = opts || {}; this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); this.renderer.setClearColor(INK, 1);
    this.scene = new THREE.Scene(); this.scene.fog = opts.fog ? new THREE.Fog(INK, opts.fog[0], opts.fog[1]) : null;
    this.camera = new THREE.PerspectiveCamera(opts.fov || 45, 1, opts.near || 0.02, opts.far || 300);
    this.controls = new OrbitControls(this.camera, canvas); this.controls.enableDamping = true; this.controls.dampingFactor = 0.08; this.controls.screenSpacePanning = true; this.controls.maxDistance = opts.maxDistance || 60;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x223, 0.95)); const d = new THREE.DirectionalLight(0xffffff, 0.9); d.position.set(3, 6, 4); this.scene.add(d);
    this.visible = true; this.tick = null; this.clock = new THREE.Clock();
    this.resize(); if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(canvas);
    if (window.IntersectionObserver) new IntersectionObserver(es => { es.forEach(e => { this.visible = e.isIntersecting; }); }, { threshold: 0.02 }).observe(canvas);
    const loop = () => { requestAnimationFrame(loop); if (!this.visible) return; const dt = Math.min(0.1, this.clock.getDelta()); if (this.tick) this.tick(dt); this.controls.update(); this.renderer.render(this.scene, this.camera); };
    requestAnimationFrame(loop);
  }
  resize() { const r = this.canvas.getBoundingClientRect(); const w = Math.max(200, Math.round(r.width)), h = Math.max(200, Math.round(r.height)); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  view(pos, target) { this.camera.position.set(pos[0], pos[1], pos[2]); this.controls.target.set(target[0], target[1], target[2]); this.controls.update(); }
  pick(event, objects) {
    const r = this.canvas.getBoundingClientRect(); const v = new THREE.Vector2(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.params.Line.threshold = 0.05; rc.setFromCamera(v, this.camera); const hits = rc.intersectObjects(objects, true); return hits.length ? hits[0] : null;
  }
}
function floorGrid(size, y) { const g = new THREE.GridHelper(size, size, 0x4a5060, 0x2b3040); g.position.y = y; g.material.transparent = true; g.material.opacity = 0.7; return g; }
function worldAxes(scene, len) { const ax = new THREE.AxesHelper(len); scene.add(ax); [['x', [len, 0, 0], 0xff5555], ['y (up)', [0, len, 0], 0x66ff66], ['z', [0, 0, len], 0x6688ff]].forEach(a => { const l = labelSprite(a[0], a[2], 20); l.position.set(a[1][0], a[1][1], a[1][2]); scene.add(l); }); }

let dataPromise = null;
function loadData() { if (!dataPromise) dataPromise = fetch(DATA_URL).then(r => r.json()); return dataPromise; }

/* ============================================================================ 1. the experiment */
export async function experiment(root) {
  const $ = id => root.querySelector('#' + id); const canvas = root.querySelector('canvas'); const data = await loadData();
  const v = new Viewer(canvas, { fog: [14, 40] }); const S = v.scene; const frontZ = data.meta.tag_front_z || -1; const N = data.poses.length;
  const tagY = Math.min(...data.tags.map(t => t.t[1])); const floorY = Math.min(0, tagY) - 0.03;
  S.add(floorGrid(16, floorY)); worldAxes(S, 0.5);
  /* tags */
  const tagObjs = data.tags.map((t, j) => { const g = poseGroup(t.t, t.q); const o = tagObject(TAG_IDS.indexOf(t.id), data.meta.tag_size_m, frontZ); g.add(o); const lb = labelSprite('tag ' + t.id, YEL, 22); lb.position.set(0, 0, 0); lb.center.set(0.5, -0.9); g.add(lb); g.userData = { kind: 'tag', j: j, obj: o, label: lb }; S.add(g); return g; });
  /* trajectory */
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3); data.poses.forEach((p, i) => { pos.set(p.t, 3 * i); const c = viridis(i / (N - 1)); col.set([c.r, c.g, c.b], 3 * i); });
  const trajGeo = new THREE.BufferGeometry(); trajGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); trajGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const traj = new THREE.Line(trajGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 })); S.add(traj);
  const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3)); const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: GOLD, linewidth: 2 })); S.add(trail);
  /* rig */
  const rig = rigModel(data.cams, 0.11); S.add(rig);
  /* rays + observation dots */
  const rayGeo = new THREE.BufferGeometry(); rayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 6), 3)); const rays = new THREE.LineSegments(rayGeo, new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.9 })); S.add(rays);
  const dotsGeo = new THREE.BufferGeometry(); dotsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); const dots = new THREE.Points(dotsGeo, new THREE.PointsMaterial({ color: YEL, size: 0.035 })); dots.visible = false; S.add(dots);
  /* camera placement */
  const cen = data.poses.reduce((a, p) => [a[0] + p.t[0] / N, a[1] + p.t[1] / N, a[2] + p.t[2] / N], [0, 0, 0]);
  const home = () => v.view([cen[0] + 3.2, cen[1] + 2.6, cen[2] + 5.2], [cen[0], cen[1] - 0.3, cen[2]]); home();
  /* arc length for constant-speed playback */
  const cum = [0]; for (let i = 1; i < N; i++) { const a = data.poses[i - 1].t, b = data.poses[i].t; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); }
  const total = cum[N - 1]; let dist = 0, playing = true, speed = 1, follow = false, selected = null;
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), pa = new THREE.Vector3(), pb = new THREE.Vector3();
  function indexAt(d) { let lo = 0, hi = N - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; } return lo; }
  function setInfo(html) { if ($('rw3-info')) $('rw3-info').innerHTML = html; }
  function applyPose(d) {
    const i = indexAt(d), a = data.poses[i], b = data.poses[Math.min(N - 1, i + 1)]; const seg = Math.max(1e-6, cum[i + 1] - cum[i]); const f = Math.min(1, (d - cum[i]) / seg);
    pa.set(a.t[0], a.t[1], a.t[2]); pb.set(b.t[0], b.t[1], b.t[2]); rig.position.lerpVectors(pa, pb, f); qa.set(a.q[0], a.q[1], a.q[2], a.q[3]); qb.set(b.q[0], b.q[1], b.q[2], b.q[3]); rig.quaternion.slerpQuaternions(qa, qb, f);
    const k = f < 0.5 ? i : Math.min(N - 1, i + 1); const obs = data.poses[k].obs;
    /* rays and lit cameras */
    rig.updateMatrixWorld(true); const arr = rayGeo.attributes.position.array; let n = 0; const litCams = new Set(), litTags = new Set();
    obs.forEach(o => { if (n >= 64) return; const cg = rig.userData.cams[o[0]]; const cw = new THREE.Vector3().setFromMatrixPosition(cg.matrixWorld); const t = data.tags[o[1]].t; arr.set([cw.x, cw.y, cw.z, t[0], t[1], t[2]], n * 6); n++; litCams.add(o[0]); litTags.add(o[1]); });
    rayGeo.setDrawRange(0, n * 2); rayGeo.attributes.position.needsUpdate = true;
    rig.userData.cams.forEach((cg, kk) => { const lit = litCams.has(kk); cg.userData.model.userData.lines.material.opacity = lit ? 1 : 0.35; cg.userData.model.userData.lines.material.transparent = true; cg.userData.model.userData.lines.material.color.set(lit ? PAL[kk % PAL.length] : 0x777777); cg.userData.model.userData.lines.material.linewidth = lit ? 2 : 1; });
    tagObjs.forEach((tg, j) => { const lit = litTags.has(j); const sel = selected && selected.kind === 'tag' && selected.j === j; tg.userData.obj.userData.border.material.color.set(sel ? RED : (lit ? YEL : 0x6b5d2a)); });
    /* trail */
    const ta = trailGeo.attributes.position.array; let m = 0; for (let s = Math.max(0, k - 58); s <= k; s++) { ta.set(data.poses[s].t, m * 3); m++; } ta.set([rig.position.x, rig.position.y, rig.position.z], m * 3); m++; trailGeo.setDrawRange(0, m); trailGeo.attributes.position.needsUpdate = true;
    if ($('rw3-scrub') && document.activeElement !== $('rw3-scrub')) $('rw3-scrub').value = k; if ($('rw3-pose')) $('rw3-pose').textContent = 'pose ' + (k + 1) + ' / ' + N + ' · ' + obs.length + ' detection' + (obs.length === 1 ? '' : 's') + ' · ' + (d).toFixed(1) + ' m of ' + total.toFixed(1) + ' m walked';
    if (follow) { v.controls.target.lerp(rig.position, 0.15); }
    return k;
  }
  v.tick = dt => { if (playing) { dist += 0.55 * speed * dt; if (dist >= total) dist = 0; } applyPose(dist); };
  /* controls */
  if ($('rw3-play')) $('rw3-play').addEventListener('click', () => { playing = !playing; $('rw3-play').textContent = playing ? 'Pause' : 'Play'; });
  if ($('rw3-speed')) $('rw3-speed').addEventListener('change', e => { speed = +e.target.value; });
  if ($('rw3-scrub')) { $('rw3-scrub').max = N - 1; $('rw3-scrub').addEventListener('input', e => { playing = false; if ($('rw3-play')) $('rw3-play').textContent = 'Play'; dist = cum[+e.target.value]; applyPose(dist); }); }
  if ($('rw3-follow')) $('rw3-follow').addEventListener('change', e => { follow = e.target.checked; if (!follow) home(); });
  const bind = (id, fn) => { if ($(id)) $(id).addEventListener('change', e => fn(e.target.checked)); };
  bind('rw3-traj', on => { traj.visible = on; trail.visible = on; }); bind('rw3-rays', on => { rays.visible = on; }); bind('rw3-labels', on => { tagObjs.forEach(t => t.userData.label.visible = on); rig.userData.cams.forEach(c => c.userData.label.visible = on); });
  bind('rw3-frusta', on => { rig.userData.cams.forEach(c => c.userData.model.userData.lines.visible = on); });
  if ($('rw3-reset')) $('rw3-reset').addEventListener('click', () => { follow = false; if ($('rw3-follow')) $('rw3-follow').checked = false; home(); selected = null; dots.visible = false; setInfo('Click a tag or a camera on the rig for its statistics.'); });
  /* picking */
  const pickables = tagObjs.map(t => t.userData.obj.userData.face).concat(rig.userData.cams.map(c => c.userData.model.children[1]));
  let downAt = null; canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return; const hit = v.pick(e, pickables); if (!hit) return;
    let o = hit.object; while (o && !(o.userData && (o.userData.kind === 'tag'))) { if (o.parent && o.parent.userData && o.parent.userData.model === o) break; o = o.parent; }
    const ti = tagObjs.findIndex(t => t.userData.obj.userData.face === hit.object); const ci = rig.userData.cams.findIndex(c => c.userData.model.children[1] === hit.object);
    if (ti >= 0) {
      selected = { kind: 'tag', j: ti }; const t = data.tags[ti]; const cams = new Map(); let n = 0; const arr = dotsGeo.attributes.position.array; let m = 0;
      data.poses.forEach(p => { let seen = false; p.obs.forEach(o => { if (o[1] === ti) { n++; seen = true; cams.set(o[0], (cams.get(o[0]) || 0) + 1); } }); if (seen) { arr.set(p.t, m * 3); m++; } });
      dotsGeo.setDrawRange(0, m); dotsGeo.attributes.position.needsUpdate = true; dots.visible = true;
      const camList = Array.from(cams.entries()).sort((a, b) => b[1] - a[1]).map(e => 'cam ' + data.cams[e[0]].id + ' (' + e[1] + (data.grid[e[0]][ti] === 1 ? ', identifiable alone' : ', needs the graph') + ')').join(', ');
      setInfo('<b>tag ' + t.id + '</b> at (' + t.t.map(x => x.toFixed(2)).join(', ') + ') m · seen ' + n + ' times from ' + m + ' rig poses (yellow dots) by ' + camList + '.');
    } else if (ci >= 0) {
      selected = { kind: 'cam', k: ci }; const c = data.cams[ci]; const tags = new Map(); let n = 0; const arr = dotsGeo.attributes.position.array; let m = 0;
      data.poses.forEach(p => { let seen = false; p.obs.forEach(o => { if (o[0] === ci) { n++; seen = true; tags.set(o[1], (tags.get(o[1]) || 0) + 1); } }); if (seen) { arr.set(p.t, m * 3); m++; } });
      dotsGeo.setDrawRange(0, m); dotsGeo.attributes.position.needsUpdate = true; dots.visible = true;
      const tl = Array.from(tags.entries()).sort((a, b) => b[1] - a[1]).map(e => 'tag ' + data.tags[e[0]].id + ' (' + e[1] + ')').join(', ');
      setInfo('<b>camera ' + c.id + '</b> · ' + (100 * Math.hypot(c.t_rel[0], c.t_rel[1], c.t_rel[2])).toFixed(1) + ' cm from camera 0 on the rig · ' + n + ' detections from ' + m + ' rig poses of ' + tl + '.');
    }
  });
  setInfo('Click a tag or a camera on the rig for its statistics. Drag to orbit, right-drag to pan, wheel to zoom.');
  applyPose(0);
  return { viewer: v };
}

/* ============================================================================ 2. the results */
export async function results(root) {
  const $ = id => root.querySelector('#' + id); const canvas = root.querySelector('canvas'); const data = await loadData();
  const v = new Viewer(canvas, { near: 0.01 }); const S = v.scene; const frontZ = data.meta.tag_front_z || -1;
  const cluster = new THREE.Group(), constellation = new THREE.Group(); S.add(cluster); S.add(constellation);
  /* --- cluster: cameras in the frame of camera 0 --- */
  const linG = new THREE.Group(), monoG = new THREE.Group(), arrowG = new THREE.Group(), baseG = new THREE.Group(); cluster.add(linG, monoG, arrowG, baseG);
  data.cams.forEach((c, k) => {
    const g = poseGroup(c.t_rel, c.q_rel); g.add(cameraModel(0.09, PAL[k % PAL.length], 1)); const lb = labelSprite('cam ' + c.id, PAL[k % PAL.length], 22); lb.position.set(0, 0.06, -0.03); g.add(lb); cluster.add(g);
    const gl = poseGroup(c.t_lin_rel, c.q_lin_rel); gl.add(frustumLines(0.09, RED, 0.7)); linG.add(gl);
    const dtx = new THREE.Vector3(c.t_rel[0] - c.t_lin_rel[0], c.t_rel[1] - c.t_lin_rel[1], c.t_rel[2] - c.t_lin_rel[2]); const len = dtx.length();
    if (len > 0.002) { const ar = new THREE.ArrowHelper(dtx.clone().normalize(), new THREE.Vector3(c.t_lin_rel[0], c.t_lin_rel[1], c.t_lin_rel[2]), len, RED, Math.min(0.02, len * 0.5), Math.min(0.012, len * 0.3)); arrowG.add(ar); const l2 = labelSprite('Δ ' + (100 * len).toFixed(1) + ' cm', RED, 18); l2.position.set(c.t_lin_rel[0] + dtx.x / 2, c.t_lin_rel[1] + dtx.y / 2 + 0.03, c.t_lin_rel[2] + dtx.z / 2); arrowG.add(l2); }
    if (k > 0) { const bg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(c.t_rel[0], c.t_rel[1], c.t_rel[2])]); const ln = new THREE.Line(bg, new THREE.LineDashedMaterial({ color: ASH, dashSize: 0.02, gapSize: 0.012 })); ln.computeLineDistances(); baseG.add(ln); const lb2 = labelSprite((100 * Math.hypot(c.t_rel[0], c.t_rel[1], c.t_rel[2])).toFixed(1) + ' cm', CREAM, 16); lb2.position.set(c.t_rel[0] * 0.55, c.t_rel[1] * 0.55 + 0.02, c.t_rel[2] * 0.55); baseG.add(lb2); }
  });
  data.cams_mono_rel.forEach((c, k) => { const g = new THREE.Group(); g.position.set(c.t[0], c.t[1], c.t[2]); g.quaternion.copy(eulerXYZdeg(c.rpy_deg)); g.add(frustumLines(0.09, GOLD, 0.8)); monoG.add(g); });
  const clusterAxes = new THREE.AxesHelper(0.08); cluster.add(clusterAxes);
  /* --- constellation: tags in the mocap world --- */
  const N = data.poses.length; const resT = data.tags.map(() => []); data.poses.forEach(p => p.obs.forEach(o => { if (o[2] !== null) resT[o[1]].push(o[2]); }));
  const linT = new THREE.Group(), arrowT = new THREE.Group(); constellation.add(linT, arrowT);
  const tagY = Math.min(...data.tags.map(t => t.t[1])); constellation.add(floorGrid(16, Math.min(0, tagY) - 0.03));
  data.tags.forEach((t, j) => {
    const g = poseGroup(t.t, t.q); const o = tagObject(TAG_IDS.indexOf(t.id), data.meta.tag_size_m * 1.6, frontZ); g.add(o); const mean = resT[j].length ? resT[j].reduce((a, b) => a + b, 0) / resT[j].length : 0;
    o.userData.border.material.color.copy(lerpColor(GREEN, RED, mean / 8)); const lb = labelSprite('tag ' + t.id + ' · ' + mean.toFixed(1) + ' cm', CREAM, 20); lb.center.set(0.5, -1.0); g.add(lb); constellation.add(g);
    const gl = poseGroup(t.t_lin, t.q_lin); const sq = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(data.meta.tag_size_m * 1.6, data.meta.tag_size_m * 1.6)), new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: 0.8 })); gl.add(sq); linT.add(gl);
    const d = new THREE.Vector3(t.t[0] - t.t_lin[0], t.t[1] - t.t_lin[1], t.t[2] - t.t_lin[2]); const len = d.length();
    if (len > 0.005) { arrowT.add(new THREE.ArrowHelper(d.clone().normalize(), new THREE.Vector3(t.t_lin[0], t.t_lin[1], t.t_lin[2]), len, RED, Math.min(0.06, len * 0.4), Math.min(0.03, len * 0.2))); const l2 = labelSprite((100 * len).toFixed(0) + ' cm', RED, 16); l2.position.set(t.t_lin[0] + d.x / 2, t.t_lin[1] + d.y / 2 + 0.08, t.t_lin[2] + d.z / 2); arrowT.add(l2); }
  });
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3); data.poses.forEach((p, i) => { pos.set(p.t, 3 * i); const c = viridis(i / (N - 1)); col.set([c.r, c.g, c.b], 3 * i); });
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); constellation.add(new THREE.Line(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5 })));
  worldAxes(constellation, 0.5);
  const cen = data.poses.reduce((a, p) => [a[0] + p.t[0] / N, a[1] + p.t[1] / N, a[2] + p.t[2] / N], [0, 0, 0]);
  function show(view) { cluster.visible = view === 'cluster'; constellation.visible = view !== 'cluster'; if (view === 'cluster') v.view([0.9, 0.6, 1.1], [0.15, 0.05, 0.05]); else v.view([cen[0] + 5, cen[1] + 4.5, cen[2] + 8], cen); if ($('rw3r-info')) $('rw3r-info').innerHTML = view === 'cluster' ? 'The eight cameras in the frame of camera 0 (certified, solid). <span style="color:#D81B60">Red</span>: where the linear two-stage solution put them, with the correction the certified optimum applies. <span style="color:#D9A13F">Gold</span>: the unknown-scale solution (α = ' + data.meta.alpha_mono.toFixed(4) + '). Baselines dashed.' : 'The sixteen tags at their certified poses, drawn 1.6× life size, border coloured by their mean loop-closure residual (green 0 → red 8 cm). <span style="color:#D81B60">Red</span> outlines and arrows: the linear two-stage solution and how far the certified optimum moved each tag. The rig trajectory is the coloured line.'; }
  if ($('rw3r-view')) $('rw3r-view').addEventListener('change', e => show(e.target.value));
  const bind = (id, fn) => { if ($(id)) $(id).addEventListener('change', e => fn(e.target.checked)); };
  bind('rw3r-linear', on => { linG.visible = on; linT.visible = on; arrowG.visible = on && $('rw3r-arrows').checked; arrowT.visible = on && $('rw3r-arrows').checked; }); bind('rw3r-mono', on => { monoG.visible = on; }); bind('rw3r-arrows', on => { arrowG.visible = on && $('rw3r-linear').checked; arrowT.visible = on && $('rw3r-linear').checked; });
  if ($('rw3r-reset')) $('rw3r-reset').addEventListener('click', () => show($('rw3r-view') ? $('rw3r-view').value : 'cluster'));
  show($('rw3r-view') ? $('rw3r-view').value : 'cluster');
  return { viewer: v };
}

/* ============================================================================ 3. the robot arm for the live demo */
export function demo(canvas) {
  const v = new Viewer(canvas, { near: 0.01, maxDistance: 20 }); const S = v.scene;
  const W = new THREE.Group(); W.rotation.x = -Math.PI / 2; S.add(W);   /* demo maths is z-up; three.js is y-up */
  const FLOOR = -0.9; S.add(floorGrid(6, FLOOR));
  /* arm */
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, metalness: 0.35, roughness: 0.45 }), dark = new THREE.MeshStandardMaterial({ color: 0x2f333d, metalness: 0.5, roughness: 0.5 }), accent = new THREE.MeshStandardMaterial({ color: 0xD9A13F, metalness: 0.3, roughness: 0.5 });
  const L1 = 0.85, L2 = 0.80, D6 = 0.12, SH = FLOOR + 0.42;   /* upper arm, forearm, flange offset, shoulder height */
  const base = new THREE.Group(); base.position.set(0, 0, FLOOR); W.add(base);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.22, 32), dark); ped.rotation.x = Math.PI / 2; ped.position.z = 0.11; base.add(ped);
  const j1 = new THREE.Group(); j1.position.z = 0.22; base.add(j1);
  const j1m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.2, 32), metal); j1m.rotation.x = Math.PI / 2; j1m.position.z = 0.1; j1.add(j1m);
  const shoulder = new THREE.Group(); shoulder.position.set(0.06, 0, SH - FLOOR - 0.22); j1.add(shoulder);
  const shm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 24), accent); shm.position.y = 0.0; shoulder.add(shm);   /* joint 2 axis = local y */
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, L1, 24), metal); upper.rotation.z = -Math.PI / 2; upper.position.x = L1 / 2; shoulder.add(upper);
  const elbow = new THREE.Group(); elbow.position.x = L1; shoulder.add(elbow);
  const elm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 24), accent); elbow.add(elm);
  const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, L2, 24), metal); fore.rotation.z = -Math.PI / 2; fore.position.x = L2 / 2; elbow.add(fore);
  const wrist = new THREE.Group(); wrist.position.x = L2; elbow.add(wrist);
  const wm = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 16), accent); wrist.add(wm);
  const hand = new THREE.Group(); wrist.add(hand);   /* orientation forced to the commanded hand pose */
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, D6, 20), dark); flange.rotation.x = Math.PI / 2; flange.position.z = D6 / 2; hand.add(flange);
  hand.add(new THREE.AxesHelper(0.12));
  /* camera on the hand, target tag, measured-pose ghost, estimate ghost */
  const camG = new THREE.Group(); camG.add(cameraModel(0.14, BLUE, 1)); W.add(camG);
  const xLink = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: GOLD })); W.add(xLink);
  const tagG = new THREE.Group(); tagG.add(tagObject(0, 0.36, 1)); W.add(tagG);   /* target: 36 cm tag, cameras on its +z side in the demo convention */
  const measG = new THREE.Group(); measG.add(frustumLines(0.14, GREEN, 0.9)); W.add(measG);
  const estCam = new THREE.Group(); estCam.add(frustumLines(0.14, GREEN, 1)); estCam.visible = false; W.add(estCam);
  const estTag = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.4, 0.4)), new THREE.LineBasicMaterial({ color: GREEN })); estTag.visible = false; W.add(estTag);
  const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 3), 3)); const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.55 })); W.add(trail);
  const ghosts = new THREE.Group(); W.add(ghosts);
  const lbl = { base: labelSprite('base', CREAM, 20), hand: labelSprite('hand  A_i', 0xff6b6b, 20), cam: labelSprite('camera  (A_i X)', BLUE, 20), tag: labelSprite('target  Y', YEL, 20), meas: labelSprite('measured B_i', GREEN, 18) };
  Object.values(lbl).forEach(l => S.add(l)); lbl.base.position.set(0, FLOOR + 0.05, 0.3);
  v.view([2.6, 1.4, 2.4], [0.3, -0.2, 0]);
  /* state and smooth motion */
  const cur = { p: new THREE.Vector3(0.9, 0, 0.3), q: new THREE.Quaternion() }, goal = { p: cur.p.clone(), q: cur.q.clone() }; let st = null, nTrail = 0, lastIdx = -1;
  function ik(p, q) {
    /* wrist centre in base coordinates (z-up), elbow-up 2R solution in the vertical plane, base yaw */
    const zAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(q); const w = p.clone().sub(zAxis.multiplyScalar(D6)); const s = new THREE.Vector3(0, 0, SH);
    const d = w.clone().sub(s); const yaw = Math.atan2(d.y, d.x); let r = Math.hypot(d.x, d.y) - 0.06, h = d.z; let reach = Math.hypot(r, h); const max = L1 + L2 - 0.01; if (reach > max) { r *= max / reach; h *= max / reach; reach = max; }
    let c3 = (r * r + h * h - L1 * L1 - L2 * L2) / (2 * L1 * L2); c3 = Math.max(-1, Math.min(1, c3)); const q3 = -Math.acos(c3); const q2 = Math.atan2(h, r) - Math.atan2(L2 * Math.sin(q3), L1 + L2 * Math.cos(q3));
    j1.rotation.z = yaw; shoulder.rotation.y = -q2; elbow.rotation.y = -q3;
    /* hand orientation exactly as commanded, expressed in the wrist's frame */
    W.updateMatrixWorld(true); const wq = new THREE.Quaternion(); wrist.getWorldQuaternion(wq); const Wq = new THREE.Quaternion(); W.getWorldQuaternion(Wq); hand.quaternion.copy(wq.invert().multiply(Wq).multiply(q));
  }
  function place(g, T) { g.position.set(T.t[0], T.t[1], T.t[2]); g.quaternion.copy(quatOf(T.R)); }
  function quatOf(R) { const m = new THREE.Matrix4().set(R[0][0], R[0][1], R[0][2], 0, R[1][0], R[1][1], R[1][2], 0, R[2][0], R[2][1], R[2][2], 0, 0, 0, 0, 1); return new THREE.Quaternion().setFromRotationMatrix(m); }
  function compose(A, B) { const qa = quatOf(A.R), qb = quatOf(B.R); const t = new THREE.Vector3(B.t[0], B.t[1], B.t[2]).applyQuaternion(qa).add(new THREE.Vector3(A.t[0], A.t[1], A.t[2])); const q = qa.clone().multiply(qb); return { t: [t.x, t.y, t.z], q: q }; }
  function toWorld(vec) { return vec.clone().applyQuaternion(W.quaternion); }
  v.tick = dt => {
    const a = 1 - Math.exp(-dt / 0.13); cur.p.lerp(goal.p, a); cur.q.slerp(goal.q, a); ik(cur.p, cur.q);
    if (!st) return;
    const X = st.X, Y = st.Y; const cam = { t: cur.p.clone().add(new THREE.Vector3(X.t[0], X.t[1], X.t[2]).applyQuaternion(cur.q)), q: cur.q.clone().multiply(quatOf(X.R)) };
    camG.position.copy(cam.t); camG.quaternion.copy(cam.q); xLink.geometry.setFromPoints([cur.p, cam.t]);
    place(tagG, Y); if (st.B) { const bm = compose(Y, st.B); measG.position.set(bm.t[0], bm.t[1], bm.t[2]); measG.quaternion.copy(bm.q); measG.visible = true; } else measG.visible = false;
    if (st.est) { const ec = compose({ R: st.A.R, t: st.A.t }, st.est.X); estCam.position.set(ec.t[0], ec.t[1], ec.t[2]); estCam.quaternion.copy(ec.q); estCam.visible = true; place(estTag, st.est.Y); estTag.visible = true; } else { estCam.visible = false; estTag.visible = false; }
    lbl.hand.position.copy(toWorld(cur.p)).add(new THREE.Vector3(0, 0.12, 0)); lbl.cam.position.copy(toWorld(cam.t)).add(new THREE.Vector3(0, -0.14, 0)); lbl.tag.position.copy(toWorld(new THREE.Vector3(Y.t[0], Y.t[1], Y.t[2]))).add(new THREE.Vector3(0, 0.3, 0)); lbl.meas.visible = measG.visible; if (st.B) { const bm = compose(Y, st.B); lbl.meas.position.copy(toWorld(new THREE.Vector3(bm.t[0], bm.t[1], bm.t[2]))).add(new THREE.Vector3(0, 0.1, 0)); }
  };
  return {
    update(state) {
      /* state: { X, Y, A (current hand pose), B (current measured target pose, in the target frame), idx, est, reset } */
      st = state; if (state.reset) { nTrail = 0; trailGeo.setDrawRange(0, 0); ghosts.clear(); lastIdx = -1; }
      if (state.A) { goal.p.set(state.A.t[0], state.A.t[1], state.A.t[2]); goal.q.copy(quatOf(state.A.R)); if (state.snap) { cur.p.copy(goal.p); cur.q.copy(goal.q); } }
      if (state.A && state.idx !== undefined && state.idx !== lastIdx) {
        lastIdx = state.idx; const cam = compose(state.A, state.X); if (nTrail < 400) { trailGeo.attributes.position.array.set(cam.t, nTrail * 3); nTrail++; trailGeo.setDrawRange(0, nTrail); trailGeo.attributes.position.needsUpdate = true; }
        if (state.idx % 3 === 0) { const g = new THREE.Group(); g.position.set(cam.t[0], cam.t[1], cam.t[2]); g.quaternion.copy(cam.q); g.add(frustumLines(0.07, BLUE, 0.35)); ghosts.add(g); }
      }
    },
    viewer: v,
  };
}

window.RW3D = { experiment, results, demo };
document.querySelectorAll('[data-rw3d="experiment"]').forEach(el => experiment(el).catch(e => console.error('rw3d experiment', e)));
document.querySelectorAll('[data-rw3d="results"]').forEach(el => results(el).catch(e => console.error('rw3d results', e)));
const demoCanvas = document.getElementById('rw-scene');
if (demoCanvas) { try { window.RW3D.demoView = demo(demoCanvas); } catch (e) { console.error('rw3d demo', e); } }
document.dispatchEvent(new Event('rw3d-ready'));

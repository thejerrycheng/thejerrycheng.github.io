/* Live gripper-carry demo (#live-gripper), WUJI live-section style. The simulation and the shared policy (both robots)
 * run on the lab computer (~/M2/mjlab/scripts/live_server.py, CPU only, user unit m2-live.service); this page renders
 * the scene itself with three.js from the meshes and body poses the server streams.
 *   SETUP (physics off): pick an object in the carousel, drag the box and each robot (TransformControls gizmos, or the
 *     sliders) inside the trained start regions; the server clamps every request and previews it.
 *   CARRY: physics on from exactly that setup: the robots drive in, close, lift; then the visitor drives the desired
 *     box pose with the sliders (absolute offset; roll first) or held keys (arrows = horizontal, camera-relative;
 *     W/S = up/down; T/G = roll; R/F = pitch; E/D = yaw).
 * Endpoints + token come from data attributes of the (encrypted) section: the local server first, then the public one. */
(() => {
  'use strict';
  const root = document.getElementById('live-gripper');
  if (!root) return;
  const $ = s => root.querySelector(s);
  const $$ = s => [...root.querySelectorAll(s)];
  const THREE_V = '0.147.0';
  const IMG = 'assets/projects/m2/live_objects/';
  const KEYS = {                                  // key -> [axis, sign]; axes = [forward, left, up, roll, pitch, yaw]
    ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [1, 1], ArrowRight: [1, -1],
    w: [2, 1], s: [2, -1], t: [3, 1], g: [3, -1], r: [4, 1], f: [4, -1], e: [5, 1], d: [5, -1]
  };
  const DRIVE = {0: ['m', 2], 1: ['m', 2], 2: ['m', 3], 3: ['°', 1], 4: ['°', 1], 5: ['°', 0]};   // unit, decimals
  const TINT = [[0.95, 0.55, 0.16], [0.13, 0.75, 0.75]];                                        // MABEL, MILO regions
  const held = new Set();
  let ws = null, role = null, connected = false, connecting = false;
  let mode = 'setup', ended = false, paused = false, unlocked = false, level = null, limits = null, bounds = null;
  let presets = [], setup = null, placement = null, lastState = null, trial = -1, framed = false;
  let view = null, sceneMsg = null, payloadMsg = null, expect = null, poses = 0, lastPoseAt = 0;
  let pick = 'payload', tmode = 'translate', dragging = false;
  let sendTimer = null, goalTimer = null, goalDirty = false, setupTimer = null, setupDirty = null;
  const touched = {};                              // last user input time per slider key (ms)

  const fmt = (v, d = 2) => Number.isFinite(v) ? (v >= 0 ? '+' : '') + v.toFixed(d) : '—';
  const keyOf = e => (e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key);
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const isCtl = () => connected && role === 'controller';
  const canSetup = () => isCtl() && mode === 'setup';
  const canControl = () => isCtl() && mode === 'run' && !ended && !paused && unlocked;
  function status(text, kind = 'idle') { const n = $('.lg-status'); n.dataset.kind = kind; $('.lg-st').textContent = text; }

  // ---------------------------------------------------------------- three.js
  function whenThree() {
    const base = `https://cdn.jsdelivr.net/npm/three@${THREE_V}/`;
    const list = [base + 'build/three.min.js', base + 'examples/js/controls/OrbitControls.js',
                  base + 'examples/js/controls/TransformControls.js'];
    const need = () => !(window.THREE && THREE.OrbitControls && THREE.TransformControls);
    if (need()) {
      const todo = list.filter((u, i) => !(i === 0 && window.THREE) && !(i === 1 && window.THREE && THREE.OrbitControls)
                                         && !document.querySelector(`script[src="${u}"]`));
      (function load(l) { if (!l.length) return; const sc = document.createElement('script'); sc.src = l[0];
        sc.onload = sc.onerror = () => load(l.slice(1)); document.body.appendChild(sc); })(todo);
    }
    return new Promise((res, rej) => {
      const t0 = performance.now();
      (function poll() { if (!need()) res(); else if (performance.now() - t0 > 25000) rej(new Error('three.js did not load'));
        else setTimeout(poll, 60); })();
    });
  }
  function makeView() {
    const el = $('.lg-3d');
    const r = new THREE.WebGLRenderer({antialias: true, alpha: true});
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    el.replaceChildren(r.domElement);
    const s = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, 1, 0.05, 120); cam.up.set(0, 0, 1);
    cam.position.set(-3.6, -4.2, 2.6);
    s.add(new THREE.HemisphereLight(0xffffff, 0x8a96a6, 0.9));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.8); d1.position.set(3, -4, 8); s.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.28); d2.position.set(-4, 3, 2); s.add(d2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({color: 0xe3e6ea, roughness: 0.95}));
    floor.position.z = -0.003; s.add(floor);
    const grid = new THREE.GridHelper(60, 120, 0xb4bcc6, 0xcfd4db); grid.rotation.x = Math.PI / 2;
    grid.material.transparent = true; grid.material.opacity = 0.7; s.add(grid);
    const ctl = new THREE.OrbitControls(cam, r.domElement); ctl.enableDamping = true; ctl.dampingFactor = 0.12;
    ctl.maxPolarAngle = Math.PI * 0.495; ctl.target.set(0, 0, 0.5);
    const v = {r, s, cam, ctl, el, dirty: true, groups: [], payload: new THREE.Group(), ghost: new THREE.Group(),
               ref: new THREE.Group(), regions: new THREE.Group(), proxies: {}, ring: null, tc: null};
    [v.payload, v.ghost, v.ref, v.regions].forEach(g => s.add(g));
    ctl.addEventListener('change', () => { v.dirty = true; });
    // arena outline (where the box may be placed)
    const A = 2.5, pts = [[-A, -A], [A, -A], [A, A], [-A, A], [-A, -A]].map(p => new THREE.Vector3(p[0], p[1], 0.002));
    const arena = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({color: 0x7d8794, dashSize: 0.12, gapSize: 0.08}));
    arena.computeLineDistances(); v.arena = arena; s.add(arena);
    // setup proxies: the gizmo moves an invisible object; its pose becomes a (clamped) setup request
    for (const k of ['payload', '0', '1']) { const o = new THREE.Object3D(); o.position.set(0, 0, 0.3); v.proxies[k] = o; s.add(o); }
    v.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.48, 48), new THREE.MeshBasicMaterial({color: 0x0a84ff, transparent: true, opacity: 0.85, depthWrite: false}));
    v.ring.position.z = 0.004; s.add(v.ring);
    const tc = new THREE.TransformControls(cam, r.domElement);
    tc.setSize(1.05); tc.setSpace('world');
    tc.addEventListener('dragging-changed', e => { ctl.enabled = !e.value; dragging = e.value;
      if (!e.value) { onGizmo(true); } v.dirty = true; });
    tc.addEventListener('objectChange', () => { onGizmo(false); v.dirty = true; });
    tc.addEventListener('change', () => { v.dirty = true; });
    s.add(tc); v.tc = tc;
    const size = () => { const w = el.clientWidth || 800, h = el.clientHeight || 500;
      r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); v.dirty = true; };
    size(); window.addEventListener('resize', size);
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(el);
    let visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(el);
    (function loop() { requestAnimationFrame(loop); if (!visible) return; if (ctl.update()) v.dirty = true;
      if (v.dirty) { r.render(s, cam); v.dirty = false; } })();
    return v;
  }
  const mq = a => new THREE.Quaternion(a[1], a[2], a[3], a[0]);               // wxyz -> three xyzw
  const mats = {};
  function mat(rgb, op = 1) {
    const k = rgb.join(',') + '|' + op;
    return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({color: new THREE.Color(rgb[0], rgb[1], rgb[2]), roughness: 0.7,
      metalness: 0.05, transparent: op < 1, opacity: op, depthWrite: op >= 1}));
  }
  function geometries(meta, buf) {
    // buf: 4-byte tag, float32 positions, [int8 normals (meta.nbytes)], uint32 indices
    const nb = meta.nbytes || 0, V = new Float32Array(buf, 4, meta.vbytes / 4);
    const N = nb ? new Int8Array(buf, 4 + meta.vbytes, nb) : null, I = new Uint32Array(buf.slice(4 + meta.vbytes + nb));
    return meta.meshes.map(m => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(V.slice(m.v, m.v + 3 * m.nv), 3));
      g.setIndex(new THREE.BufferAttribute(I.slice(m.i, m.i + m.ni), 1));
      if (N) g.setAttribute('normal', new THREE.BufferAttribute(N.slice(m.v, m.v + 3 * m.nv), 3, true));
      else g.computeVertexNormals();
      return g;
    });
  }
  function buildRobots(meta, buf) {
    const geos = geometries(meta, buf);
    view.groups.forEach(g => view.s.remove(g)); view.groups = [];
    for (let r = 0; r < 2; r++) for (let b = 0; b < meta.nrobot_body; b++) { const g = new THREE.Group(); view.groups.push(g); view.s.add(g); }
    meta.robot_geoms.forEach(e => {
      for (let r = 0; r < 2; r++) {
        const m = new THREE.Mesh(geos[e.mesh], mat(e.tint ? meta.tints[r] : e.rgba));
        m.position.set(e.pos[0], e.pos[1], e.pos[2]); m.quaternion.copy(mq(e.quat));
        view.groups[r * meta.nrobot_body + e.body].add(m);
      }
    });
    view.dirty = true;
  }
  function buildPayload(meta, buf) {
    const geos = geometries(meta, buf);
    [view.payload, view.ghost, view.ref].forEach(g => g.clear());
    const blue = new THREE.Color('#3b82f6');
    meta.geoms.forEach(e => {
      view.payload.add(new THREE.Mesh(geos[e.mesh], mat(e.rgba)));
      view.ghost.add(new THREE.Mesh(geos[e.mesh], new THREE.MeshBasicMaterial({color: blue, transparent: true, opacity: 0.2, depthWrite: false})));
      view.ghost.add(new THREE.LineSegments(new THREE.EdgesGeometry(geos[e.mesh], 35), new THREE.LineBasicMaterial({color: blue, transparent: true, opacity: 0.75})));
      view.ref.add(new THREE.LineSegments(new THREE.EdgesGeometry(geos[e.mesh], 35), new THREE.LineBasicMaterial({color: 0x333333, transparent: true, opacity: 0.25})));
    });
    trial = meta.trial; view.dirty = true;
  }
  function onPose(buf) {
    if (!view || !sceneMsg || !view.groups.length) return;
    const F = new Float32Array(buf, 4), NB = 2 * sceneMsg.nrobot_body;
    if (F.length < (NB + 3) * 7) return;
    for (let b = 0; b < NB; b++) { const o = 7 * b;
      view.groups[b].position.set(F[o], F[o + 1], F[o + 2]); view.groups[b].quaternion.set(F[o + 4], F[o + 5], F[o + 6], F[o + 3]); }
    const put = (g, o) => { g.position.set(F[o], F[o + 1], F[o + 2]); g.quaternion.set(F[o + 4], F[o + 5], F[o + 6], F[o + 3]); };
    put(view.payload, 7 * NB); put(view.ghost, 7 * NB + 7); put(view.ref, 7 * NB + 14);
    view.ghost.visible = mode === 'run' && unlocked;
    view.ref.visible = mode === 'run';
    if (!framed && lastState) {                    // first frame after connecting: frame the pair from the box's side
      framed = true;
      const c = [F[7 * NB], F[7 * NB + 1], Math.max(0.5, F[7 * NB + 2])], az = rad(lastState.camera_azimuth_deg);
      view.cam.position.set(c[0] - 5.0 * Math.cos(az), c[1] - 5.0 * Math.sin(az), c[2] + 2.6);
      view.ctl.target.set(c[0], c[1], c[2] * 0.8); view.ctl.update();
    }
    view.dirty = true; poses += 1; lastPoseAt = performance.now();
  }
  function camAzimuthDeg() {                               // horizontal direction the camera looks: "forward" for the arrows
    if (!view) return null;
    const d = new THREE.Vector3().subVectors(view.ctl.target, view.cam.position);
    return (deg(Math.atan2(d.y, d.x)) + 360) % 360;
  }

  // ---------------------------------------------------------------- setup: regions, proxies, gizmo
  function stationFrame(k) {
    const st = placement.robots[k].station, f = rad(st.face_deg);
    return {S: [st.x, st.y], f: [Math.cos(f), Math.sin(f)], L: [-Math.sin(f), Math.cos(f)], face: f};
  }
  function drawRegions() {
    if (!view || !placement || !bounds) return;
    view.regions.clear();
    for (let k = 0; k < 2; k++) {
      const {S, f, L, face} = stationFrame(k);
      const [b0, b1] = bounds.back, [s0, s1] = bounds.side;
      const g = new THREE.PlaneGeometry(b1 - b0, s1 - s0);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({color: new THREE.Color(...TINT[k]), transparent: true, opacity: 0.32, depthWrite: false}));
      const cb = (b0 + b1) / 2, cs = (s0 + s1) / 2;            // region centre: S - cb f + cs L (events.place_pair)
      m.position.set(S[0] - cb * f[0] + cs * L[0], S[1] - cb * f[1] + cs * L[1], 0.003);
      m.rotation.z = face;
      view.regions.add(m);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({color: new THREE.Color(...TINT[k])}));
      edge.position.copy(m.position); edge.rotation.z = face; view.regions.add(edge);
      // turn wedge: the allowed facing (+-dyaw) drawn at the robot's chassis
      const R = placement.robots[k], d0 = rad(bounds.dyaw_deg[0]), d1 = rad(bounds.dyaw_deg[1]);
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32, face + d0, d1 - d0),
        new THREE.MeshBasicMaterial({color: new THREE.Color(...TINT[k]), transparent: true, opacity: 0.22, depthWrite: false}));
      w.position.set(R.x, R.y, 0.005); view.regions.add(w);
      const pt = rad(R.yaw_deg), arrow = new THREE.Line(new THREE.BufferGeometry().setFromPoints(
        [new THREE.Vector3(R.x, R.y, 0.006), new THREE.Vector3(R.x + 0.48 * Math.cos(pt), R.y + 0.48 * Math.sin(pt), 0.006)]),
        new THREE.LineBasicMaterial({color: new THREE.Color(...TINT[k])}));
      view.regions.add(arrow);
    }
    view.regions.visible = mode === 'setup';
    view.dirty = true;
  }
  function boxTop() {                                      // the box's gizmo floats just above it (not hidden inside)
    const pr = setup && presets.find(p => p.id === setup.object);
    return pr ? Math.max(pr.height, pr.bar_height) + 0.12 : 1.0;
  }
  function syncProxies() {                                 // proxies follow the server's (clamped) placement unless dragged
    if (!view || !placement || dragging) return;
    const P = placement.payload;
    view.proxies.payload.position.set(P.x, P.y, boxTop()); view.proxies.payload.rotation.set(0, 0, rad(P.yaw_deg));
    for (let k = 0; k < 2; k++) { const R = placement.robots[k];
      view.proxies[String(k)].position.set(R.x, R.y, 0.3); view.proxies[String(k)].rotation.set(0, 0, rad(R.yaw_deg)); }
    placeRing();
  }
  function placeRing() {
    if (!view) return;
    const o = view.proxies[pick];
    view.ring.position.set(o.position.x, o.position.y, 0.004);
    const pr = setup && presets.find(p => p.id === setup.object);
    const r = pick === 'payload' && pr ? 0.5 * Math.hypot(pr.length, pr.width) + 0.12 : 0.45;   // ring radius, m
    view.ring.scale.setScalar(r / 0.45);
    view.ring.visible = mode === 'setup' && isCtl();
    view.dirty = true;
  }
  function attachGizmo() {
    if (!view) return;
    const on = canSetup();
    if (!on) { view.tc.detach(); view.tc.visible = false; placeRing(); return; }
    view.tc.attach(view.proxies[pick]); view.tc.visible = true;
    view.tc.setMode(tmode);
    view.tc.showX = tmode === 'translate'; view.tc.showY = tmode === 'translate'; view.tc.showZ = tmode === 'rotate';
    placeRing();
  }
  function clampRobot(k, x, y, yaw) {                       // world pose -> clamped {back, side, dyaw_deg} + its pose
    const {S, f, L, face} = stationFrame(k);
    const d = [S[0] - x, S[1] - y];
    let back = d[0] * f[0] + d[1] * f[1], side = -(d[0] * L[0] + d[1] * L[1]);
    back = Math.min(bounds.back[1], Math.max(bounds.back[0], back));
    side = Math.min(bounds.side[1], Math.max(bounds.side[0], side));
    let dy = deg(wrap(yaw - face));
    dy = Math.min(bounds.dyaw_deg[1], Math.max(bounds.dyaw_deg[0], dy));
    return {back, side, dyaw_deg: dy, x: S[0] - back * f[0] + side * L[0], y: S[1] - back * f[1] + side * L[1], yaw: face + rad(dy)};
  }
  function onGizmo(final) {
    if (!canSetup() || !placement) return;
    const o = view.proxies[pick];
    if (pick === 'payload') {
      const A = 2.5;
      o.position.x = Math.min(A, Math.max(-A, o.position.x)); o.position.y = Math.min(A, Math.max(-A, o.position.y));
      o.position.z = boxTop();
      const yaw = deg(wrap(o.rotation.z));
      queueSetup({payload: {x: o.position.x, y: o.position.y, yaw_deg: yaw}}, final);
    } else {
      const k = Number(pick), c = clampRobot(k, o.position.x, o.position.y, o.rotation.z);
      o.position.set(c.x, c.y, 0.3); o.rotation.set(0, 0, c.yaw);           // the gizmo cannot leave the trained region
      const rb = [{}, {}]; rb[k] = {back: c.back, side: c.side, dyaw_deg: c.dyaw_deg};
      queueSetup({robots: rb}, final);
    }
    placeRing();
  }
  function merge(a, b) {                                   // shallow-deep merge of setup requests (robots by index)
    const out = Object.assign({}, a);
    for (const k of Object.keys(b)) {
      if (k === 'robots') { out.robots = [Object.assign({}, (a.robots || [])[0], b.robots[0]), Object.assign({}, (a.robots || [])[1], b.robots[1])]; }
      else if (k === 'payload') out.payload = Object.assign({}, a.payload, b.payload);
      else out[k] = b[k];
    }
    return out;
  }
  function flushSetup() {
    if (setupDirty && canSetup()) { send(Object.assign({type: 'setup'}, setupDirty)); }
    setupDirty = null; clearInterval(setupTimer); setupTimer = null;
  }
  function queueSetup(req, now) {                           // ~8 Hz while dragging; the server previews the newest
    setupDirty = merge(setupDirty || {}, req);
    if (now) { flushSetup(); return; }
    if (!setupTimer) setupTimer = setInterval(flushSetup, 120);
  }

  // ---------------------------------------------------------------- object carousel
  function buildCarousel() {
    const box = $('.lg-objects');
    box.replaceChildren();
    for (const p of presets) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lg-tile'; b.dataset.obj = p.id;
      b.setAttribute('aria-label', `${p.name}: ${p.length}×${p.width}×${p.height} m, ${p.mass} kg`);
      const im = document.createElement('img');
      im.src = IMG + p.id + '.webp'; im.srcset = `${IMG}${p.id}.webp 1x, ${IMG}${p.id}@2x.webp 2x`;
      im.alt = ''; im.loading = 'lazy'; im.width = 320; im.height = 200;
      const t = document.createElement('span'); t.className = 't'; t.textContent = p.name;
      const s = document.createElement('span'); s.className = 's';
      s.textContent = `${p.length.toFixed(2)} × ${p.width.toFixed(2)} × ${p.height.toFixed(2)} m`;
      const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = p.mass + ' kg';
      b.append(im, badge, t, s);
      b.addEventListener('click', () => { if (canSetup()) { queueSetup({object: p.id}, true); markObject(p.id); } });
      box.append(b);
    }
    const strip = box, endc = () => strip.classList.toggle('end', strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4);
    strip.addEventListener('scroll', endc, {passive: true}); endc();
  }
  function markObject(id) {
    $$('.lg-tile').forEach(b => b.classList.toggle('on', b.dataset.obj === id));
    const p = presets.find(q => q.id === id);
    $('.lg-osel').textContent = p ? `${p.name} · ${p.mass} kg` : '';
    setSummary();
  }
  // CARRY folds Object + Place to one line: the object and the robots' start offsets, with Edit setup
  function setSummary() {
    let el = $('.lg-setsum');
    if (!el) {
      el = document.createElement('span'); el.className = 'lg-setsum';
      el.innerHTML = '<span></span><button type="button" class="lg-btn lg-edit3">Edit setup</button>';
      $('.lg-c-obj h3').appendChild(el);
      el.querySelector('button').addEventListener('click', () => send({type: 'reset'}));
    }
    const p = setup && presets.find(q => q.id === setup.object);
    const rb = setup && setup.robots ? setup.robots.map((r, k) => `${k ? 'MILO' : 'MABEL'} ${Math.round(r.back * 100)} cm`).join(', ') : '';
    el.querySelector('span').textContent = [p ? p.name : '', rb].filter(Boolean).join(' · ');
    el.querySelector('button').disabled = !isCtl();
  }

  // ---------------------------------------------------------------- UI state
  function updateControls() {
    const ctl = isCtl(), su = canSetup(), run = mode === 'run';
    $('.lg-launch').hidden = connected || connecting;
    $('.lg-ph').hidden = (connected && poses > 0) || connecting;
    $('.lg-load').classList.toggle('on', connecting || (connected && !poses));
    $('.lg-stop').hidden = !connected;
    $('.lg-carry').disabled = !su;
    $('.lg-carry').hidden = run && connected;
    $('.lg-edit').hidden = !(run && connected);
    $('.lg-edit').disabled = !ctl;
    $('.lg-pause').hidden = !(run && connected && !ended);
    $('.lg-pause').disabled = !ctl;
    $('.lg-pause').textContent = paused ? 'Resume' : 'Pause';
    $('.lg-shuffle').disabled = !su; $('.lg-reset').disabled = !su;
    $$('.lg-modes button').forEach(b => { b.classList.toggle('on', b.dataset.mode === mode); b.disabled = !ctl; });
    $('.lg-tools').hidden = !su; $('.lg-legend').hidden = !(connected && poses);
    if (!su) $('.lg-tip').hidden = true;                    // the placement tip belongs to setup
    $$('.lg-tile').forEach(b => { b.disabled = !su; });
    $$('.lg-c-place input').forEach(i => { i.disabled = !su; });
    $$('.lg-pick2 button, .lg-pick button, .lg-tmode button').forEach(b => { b.disabled = !su; });
    $('.lg-c-place').classList.toggle('off', !su);
    $('.lg-c-obj').classList.toggle('off', !su && connected);
    $('.lg-c-drive').classList.toggle('off', !canControl());
    $$('[data-lg-key]').forEach(b => { b.disabled = !canControl(); });
    $$('.lg-slider input').forEach(i => { i.disabled = !canControl(); });
    $('.lg-center').disabled = !canControl();
    $$('.lg-levels button').forEach(b => { b.disabled = !su; b.classList.toggle('on', Number(b.dataset.level) === level); });
    $('.lg-dsel').textContent = canControl() ? 'live' : run && !ended ? 'unlocking…' : 'after Carry';
    $('.lg-role').textContent = !connected ? '' : role === 'controller' ? 'You have control' : 'Watching · another visitor has control';
    $('.lg-keynote').textContent = !connected ? 'Controls unlock once the robots have grasped and lifted the box.'
      : mode === 'setup' ? 'Press Carry: the robots drive in, close and lift; then the box follows these controls.'
      : ended ? 'Trial ended. Carry again, or edit the setup.'
      : paused ? 'Paused. Resume to move the goal.'
      : !unlocked ? 'Grasping and lifting… the controls unlock in a moment.'
      : role === 'controller' ? 'Drag the sliders, or hold keys / buttons; release to hold. Roll, pitch and yaw turn the box about its own axes.'
      : 'Another visitor is driving.';
    const vw = $('.lg-vw'); vw.classList.toggle('st-setup', mode === 'setup'); vw.classList.toggle('st-live', mode === 'run' && !ended);
    attachGizmo();
    if (view) { view.regions.visible = mode === 'setup'; view.dirty = true; }
  }
  function badge(s) {
    const b = $('.lg-bdg'); b.classList.remove('st-start', 'st-live', 'st-end');
    let t, sub;
    if (!connected) { t = 'OFFLINE'; sub = 'launch the live sim to start'; }
    else if (mode === 'setup') { t = 'SETUP · PHYSICS OFF'; sub = 'arrange the scene, nothing is simulated yet'; }
    else if (ended) { b.classList.add('st-end'); t = 'TRIAL ENDED'; sub = 'carry again or edit the setup'; }
    else if (s && s.regrasping) { b.classList.add('st-start'); t = 'RE-GRASPING';
      sub = s.regrasp_phase === 'lift' ? 'grasped again: lifting from where it landed' : 'box dropped: the planner sends the grippers to where it is now'; }
    else if (!unlocked) { b.classList.add('st-start'); t = 'CARRY · PHYSICS ON'; sub = 'the robots drive in, close their grippers and lift'; }
    else { b.classList.add('st-live'); t = 'LIVE · PHYSICS ON'; sub = paused ? 'paused' : 'the box follows your pose'; }
    $('.lg-bdg-t').textContent = t; $('.lg-bdg-s').textContent = sub;
  }
  function hud(s) {
    if (!s || !connected) { $('.lg-hud').replaceChildren(); return; }
    const phase = {setup: 'Setup', grasp: 'Driving in · closing', lift: 'Lifting', teleop: 'Teleop', ended: 'Ended', paused: 'Paused',
                   regrasp: 'Re-grasping'}[s.phase] || s.phase;
    const left = Math.max(0, s.session_left_s || 0);
    const err = s.tracking_error_m * 100;
    $('.lg-hud').innerHTML = `<b>${phase}</b> · ${s.t.toFixed(1)} s<br>load <b>${s.mass_kg.toFixed(1)} kg</b>`
      + (s.mode === 'run' ? ` · error <span class="${err < 3 ? 'ok' : err < 8 ? 'w' : 'bad'}">${err.toFixed(1)} cm</span>` : '')
      + `<br>${s.rtf ? s.rtf.toFixed(2) + '× real time' : 'physics off'} · session ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  }
  function showPose(kind, p) {
    const xyz = (p && p.position) || [];
    ['x', 'y', 'z'].forEach((a, i) => { $(`.lg-${kind}-${a}`).textContent = fmt(xyz[i]); });
    ['roll', 'pitch', 'yaw'].forEach(a => { $(`.lg-${kind}-${a}`).textContent = fmt(p ? p[a + '_deg'] : NaN, 1); });
  }
  function setRanges(L) {
    limits = L;
    const rng = {0: [-L.move_m, L.move_m], 1: [-L.move_m, L.move_m], 2: [L.lift_m[0], L.lift_m[1]],
                 3: [-L.roll_deg, L.roll_deg], 4: [-L.pitch_deg, L.pitch_deg], 5: [-L.yaw_deg, L.yaw_deg]};
    $$('.lg-slider').forEach(row => { const i = Number(row.dataset.i), inp = row.querySelector('input');
      inp.min = rng[i][0]; inp.max = rng[i][1]; inp.step = 'any'; });   // "any": no grid anchored at min (exact 0)
    $('.lg-limits').textContent = `Goal limits: roll ±${L.roll_deg}° · pitch ±${L.pitch_deg}° · yaw ±${L.yaw_deg}° · `
      + `move ≤ ${L.move_m} m · lift ${L.lift_m[0]}–${L.lift_m[1]} m · handles ≤ ${L.bar_z_max_m} m; the box follows at up to `
      + `${L.speed_m_s} m/s and ${L.turn_deg_s}°/s.`;
  }
  function placeSliders() {                                // card 2 follows the server's setup unless just touched
    if (!setup) return;
    const now = performance.now(), k = pick === 'payload' ? null : Number(pick);
    $('.lg-place-box').hidden = k !== null; $('.lg-place-rob').hidden = k === null;
    $('.lg-psel').textContent = k === null ? 'Box' : (k === 0 ? 'MABEL' : 'MILO');
    $$('.lg-c-place input').forEach(inp => {
      const [grp, key] = inp.dataset.set.split('.');
      const src = grp === 'payload' ? setup.payload : (k === null ? null : setup.robots[k]);
      if (!src) return;
      if (now - (touched[inp.id] || 0) > 700) inp.value = src[key];
      const v = Number(inp.value), out = inp.nextElementSibling;
      out.textContent = key.endsWith('deg') ? v.toFixed(0) + '°' : (grp === 'robot' ? (v * 100).toFixed(0) + ' cm' : v.toFixed(2) + ' m');
    });
  }
  function onState(s) {
    lastState = s;
    root.dataset.phase = s.phase; root.dataset.t = s.t; root.dataset.mode = s.mode || 'run';      // (read by the tests)
    role = s.role; ended = !!s.ended; paused = !!s.paused; unlocked = !!s.unlocked; level = s.level;
    const newMode = s.mode || 'run';
    if (newMode !== mode) { mode = newMode; if (mode === 'run') releaseAll(); }
    if (s.limits) setRanges(s.limits);
    const prevPlace = JSON.stringify(placement);
    setup = s.setup || setup; placement = s.placement || placement;
    if (JSON.stringify(placement) !== prevPlace) { drawRegions(); syncProxies(); }
    if (setup) markObject(setup.object);
    placeSliders();
    showPose('des', s.desired); showPose('mea', s.measured);
    const now = performance.now();
    $$('.lg-slider').forEach(row => {
      const i = Number(row.dataset.i), inp = row.querySelector('input');
      if (now - (touched['d' + i] || 0) > 600 && Number.isFinite(s.offset[i])) inp.value = s.offset[i];
      row.querySelector('output').textContent = fmt(Number(inp.value), DRIVE[i][1]) + ' ' + DRIVE[i][0];
    });
    const res = $('.lg-res');
    if (ended && mode === 'run') {
      const why = {gripper_lost: 'A gripper lost the handle', payload_off_reference: 'The box left the planned pose',
        'session time limit': 'Session time is up', 'server error': 'The simulation hit an error',
        time_out_success: 'Episode time is up'}[s.outcome] || (s.outcome || 'Trial ended');
      res.classList.add('on', 'bad'); $('.lg-res-t').textContent = 'Trial ended';
      $('.lg-res-d').textContent = why + '. Carry again from the same setup, or edit it.';
      $('.lg-res .ic').textContent = '!';
    } else res.classList.remove('on', 'bad');
    if (!canControl()) releaseAll();
    badge(s); hud(s);
    status(mode === 'setup' ? 'Live · set up the scene' : ended ? 'Trial ended' : paused ? 'Paused' : unlocked ? 'Live · you are driving' : 'Live · grasping and lifting',
           ended ? 'error' : 'live');
    updateControls();
    root.dispatchEvent(new CustomEvent('lg-state', {detail: s}));          // telemetry plots (m2-live-tele.js)
  }
  function onHello(h) {
    role = h.role; level = h.level; bounds = h.bounds; presets = h.presets || [];
    if (h.limits) setRanges(h.limits);
    $('.lg-policy').textContent = h.policy;
    buildCarousel();
    const box = $('.lg-levels'); box.replaceChildren();
    for (const l of h.levels) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.level = l.id; b.textContent = 'L' + l.id; b.title = l.label;
      b.addEventListener('click', () => { if (canSetup()) queueSetup({level: l.id}, true); });
      box.append(b);
    }
    updateControls();
  }

  // ---------------------------------------------------------------- connection
  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN && role === 'controller') { ws.send(JSON.stringify(msg)); return true; }
    return false;
  }
  function onMessage(ev) {
    if (typeof ev.data !== 'string') {
      const tag = String.fromCharCode(...new Uint8Array(ev.data, 0, 4));
      if (tag === 'POSE') onPose(ev.data);
      else if (tag === 'MESH' && expect === 'scene' && view) { buildRobots(sceneMsg, ev.data); expect = null; }
      else if (tag === 'MSHZ' && expect === 'scene' && view) {     // gzipped robot meshes: inflate off the socket
        const msg = sceneMsg; expect = null;
        new Response(new Blob([new Uint8Array(ev.data, 4)]).stream().pipeThrough(new DecompressionStream('gzip')))
          .arrayBuffer().then(b => { const u = new Uint8Array(b.byteLength + 4); u.set([77, 83, 72, 90]); u.set(new Uint8Array(b), 4);
            if (sceneMsg === msg) buildRobots(msg, u.buffer); });
      }
      else if (tag === 'PAYM' && expect === 'payload' && view) { buildPayload(payloadMsg, ev.data); expect = null; }
      if (poses === 1) updateControls();
      return;
    }
    let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
    if (m.type === 'hello') onHello(m);
    else if (m.type === 'state') onState(m);
    else if (m.type === 'scene') { sceneMsg = m; expect = 'scene'; }
    else if (m.type === 'payload') { payloadMsg = m; expect = 'payload'; }
    else if (m.type === 'error' && m.message !== 'another visitor has control') status(m.message, 'error');
  }
  function disconnect(message, kind = 'idle') {
    if (ws) { const w = ws; ws = null; try { w.close(); } catch (_) {} }
    connected = false; connecting = false; role = null; releaseAll();
    if (message) status(message, kind);
    badge(null); hud(null);
    updateControls();
    root.dispatchEvent(new CustomEvent('lg-connected', {detail: false}));
  }
  function endpoints() {
    const tok = root.dataset.lgToken || '', out = [];
    for (const u of [root.dataset.lgLocal, root.dataset.lgPublic]) {
      if (!u) continue;
      try {
        const url = new URL(u);
        const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if (!['wss:', 'https:'].includes(url.protocol) && !(local && ['ws:', 'http:'].includes(url.protocol))) continue;
        url.protocol = ['wss:', 'https:'].includes(url.protocol) ? 'wss:' : 'ws:';
        url.pathname = url.pathname.replace(/\/$/, '').replace(/\/ws$/, '') + '/ws';
        url.search = '?token=' + encodeURIComponent(tok);
        out.push({url: url.href, local, wait: local ? 2500 : 12000});
      } catch (_) { /* bad url: skip */ }
    }
    return out;
  }
  function open(ep) {                              // resolves with an open socket once the server says hello
    return new Promise((resolve, reject) => {
      let sock;
      try { sock = new WebSocket(ep.url); } catch (e) { reject(e); return; }
      sock.binaryType = 'arraybuffer';
      const timer = setTimeout(() => { try { sock.close(); } catch (_) {} reject(new Error('timeout')); }, ep.wait);
      sock.onmessage = ev => {
        if (typeof ev.data === 'string' && ev.data.indexOf('"hello"') >= 0) {
          clearTimeout(timer); sock.onmessage = null; sock.onerror = null; sock.onclose = null; resolve({sock, first: ev}); }
      };
      sock.onerror = () => { clearTimeout(timer); reject(new Error('unreachable')); };
      sock.onclose = () => { clearTimeout(timer); reject(new Error('closed')); };
    });
  }
  async function connect() {
    connecting = true; poses = 0; framed = false; updateControls(); status('Finding the live simulation…', 'waiting');
    $('.lg-load-t').textContent = 'Connecting to the lab computer…';
    const eps = endpoints();
    if (!eps.length) { disconnect('Live simulation is not configured on this page.', 'error'); return; }
    try { await whenThree(); if (!view) view = makeView(); } catch (e) { disconnect('3-D view unavailable: ' + e.message, 'error'); return; }
    for (const ep of eps) {
      if (!connecting) return;                    // the visitor pressed Disconnect meanwhile
      try {
        const {sock, first} = await open(ep);
        if (!connecting) { sock.close(); return; }
        ws = sock; connected = true; connecting = false;
        $('.lg-load-t').textContent = 'Loading the robots…';
        sock.onmessage = ev => { if (ws === sock) onMessage(ev); };
        sock.onclose = () => { if (ws === sock) disconnect('Disconnected.', 'idle'); };
        sock.onerror = () => {};
        onMessage(first);
        status('Connected · ' + (ep.local ? 'local server' : 'lab server') + ' · loading the scene', 'live');
        updateControls();
        let seen = '1'; try { seen = localStorage.getItem('m2LgTip'); } catch (_) {}
        if (!seen) $('.lg-tip').hidden = false;
        return;
      } catch (_) { /* try the next endpoint */ }
    }
    disconnect('Server not reachable — the live simulation runs on the lab computer and is offline right now. The recorded rollouts below always work.', 'error');
  }

  // ---------------------------------------------------------------- input: keys
  function axes() {
    const a = [0, 0, 0, 0, 0, 0];
    for (const k of held) { const m = KEYS[k]; if (m) a[m[0]] += m[1]; }
    return a.map(v => Math.max(-1, Math.min(1, v)));
  }
  function pump() {                       // 20 Hz while keys are held; the server stops the goal 1 s after silence
    if (!held.size) { clearInterval(sendTimer); sendTimer = null; send({type: 'teleop', axes: [0, 0, 0, 0, 0, 0], az: camAzimuthDeg()}); return; }
    if (canControl()) send({type: 'teleop', axes: axes(), az: camAzimuthDeg()});
  }
  function press(k) {
    if (!KEYS[k] || held.has(k)) return;
    held.add(k); showKeys();
    if (!sendTimer) { pump(); sendTimer = setInterval(pump, 50); }
  }
  function release(k) { if (held.delete(k)) { showKeys(); if (!held.size) pump(); } }
  function releaseAll() { if (held.size) { held.clear(); showKeys(); pump(); } }
  function showKeys() { $$('[data-lg-key]').forEach(b => b.classList.toggle('is-held', held.has(b.dataset.lgKey))); }

  // ---------------------------------------------------------------- input: drive sliders (absolute goal offset)
  function sliderOffset() {
    const o = [0, 0, 0, 0, 0, 0];
    $$('.lg-slider').forEach(row => { o[Number(row.dataset.i)] = Number(row.querySelector('input').value); });
    return o;
  }
  function flushGoal() {
    if (goalDirty && canControl()) { send({type: 'goal', offset: sliderOffset()}); goalDirty = false; }
    if (!goalDirty) { clearInterval(goalTimer); goalTimer = null; }
  }
  function queueGoal() { goalDirty = true; if (!goalTimer) { flushGoal(); goalTimer = setInterval(flushGoal, 100); } }  // ~10 Hz
  $$('.lg-slider').forEach(row => {
    const i = Number(row.dataset.i), inp = row.querySelector('input');
    inp.addEventListener('input', () => { touched['d' + i] = performance.now();
      row.querySelector('output').textContent = fmt(Number(inp.value), DRIVE[i][1]) + ' ' + DRIVE[i][0]; queueGoal(); });
    inp.addEventListener('change', () => { touched['d' + i] = performance.now(); queueGoal(); });
  });
  $('.lg-center').addEventListener('click', () => {
    if (!limits) return;
    const lift = Math.min(limits.lift_m[1], Math.max(limits.lift_m[0], limits.live_lift_m || 0.1));
    $$('.lg-slider').forEach(row => { const i = Number(row.dataset.i);
      row.querySelector('input').value = i === 2 ? lift : 0; touched['d' + i] = performance.now(); });
    queueGoal();
  });

  // ---------------------------------------------------------------- input: setup sliders + pickers
  $$('.lg-c-place input').forEach(inp => {
    const go = final => {
      touched[inp.id] = performance.now();
      if (!canSetup()) return;
      const [grp, key] = inp.dataset.set.split('.'), v = Number(inp.value);
      if (grp === 'payload') queueSetup({payload: {[key]: v}}, final);
      else { const k = Number(pick); if (!(k === 0 || k === 1)) return; const rb = [{}, {}]; rb[k] = {[key]: v}; queueSetup({robots: rb}, final); }
      placeSliders();
    };
    inp.addEventListener('input', () => go(false));
    inp.addEventListener('change', () => go(true));
  });
  function setPick(t) {
    pick = t;
    $$('.lg-pick button, .lg-pick2 button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    placeSliders(); attachGizmo();
  }
  $$('.lg-pick button, .lg-pick2 button').forEach(b => b.addEventListener('click', () => setPick(b.dataset.t)));
  $$('.lg-tmode button').forEach(b => b.addEventListener('click', () => {
    tmode = b.dataset.m; $$('.lg-tmode button').forEach(x => x.classList.toggle('on', x === b)); attachGizmo(); }));
  $('.lg-tip button').addEventListener('click', () => { $('.lg-tip').hidden = true; try { localStorage.setItem('m2LgTip', '1'); } catch (_) {} });

  // ---------------------------------------------------------------- wiring
  $('.lg-launch').addEventListener('click', () => { if (!connected && !connecting) connect(); });
  $('.lg-stop').addEventListener('click', () => disconnect('Disconnected.'));
  $('.lg-carry').addEventListener('click', () => { if (canSetup()) { flushSetup(); send({type: 'carry'}); } });
  $('.lg-edit').addEventListener('click', () => send({type: 'reset'}));
  $('.lg-edit2').addEventListener('click', () => send({type: 'reset'}));
  $('.lg-again').addEventListener('click', () => { send({type: 'reset'}); setTimeout(() => send({type: 'carry'}), 400); });
  $('.lg-pause').addEventListener('click', () => send({type: 'pause', paused: !paused}));
  $('.lg-shuffle').addEventListener('click', () => { if (canSetup()) send({type: 'shuffle'}); });
  $('.lg-reset').addEventListener('click', () => { if (canSetup()) queueSetup({payload: {x: 0, y: 0, yaw_deg: 0},
    robots: [{back: 0.2, side: 0, dyaw_deg: 0}, {back: 0.2, side: 0, dyaw_deg: 0}]}, true); });
  $$('.lg-modes button').forEach(b => b.addEventListener('click', () => {
    if (!isCtl() || b.dataset.mode === mode) return;
    if (b.dataset.mode === 'run') { flushSetup(); send({type: 'carry'}); } else send({type: 'reset'});
  }));
  $$('[data-lg-key]').forEach(b => {
    const k = b.dataset.lgKey;
    b.addEventListener('pointerdown', e => { if (!b.disabled) { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); press(k); } });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => b.addEventListener(t, () => release(k)));
  });
  document.addEventListener('keydown', e => {
    const k = keyOf(e);
    if (!KEYS[k] || !canControl() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input:not([type=range]), textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();                       // arrows must not scroll the page (or nudge a slider) while driving
    press(k);
  });
  document.addEventListener('keyup', e => release(keyOf(e)));
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  setInterval(() => {                         // stale stream
    if (connected && poses && mode === 'run' && !paused && !ended && performance.now() - lastPoseAt > 3000) status('Waiting for the simulation…', 'waiting');
  }, 1000);
  // test hook (scripts/tests/test_live_browser.py drags the real gizmo handles): screen points of world points and of the
  // TransformControls pickers of the selected proxy (r147 gizmo: world size = factor * size / 4 per gizmo unit, the
  // X / Y translate pickers span 0..0.6 units along their axis, the Z rotate picker is a ring of radius 0.5)
  root.lgView = () => view;                   // m2-live-tele.js draws the planner's per-hand trajectories into this scene
  root.lgDebug = {
    project(x, y, z) { const v = new THREE.Vector3(x, y, z).project(view.cam), b = view.r.domElement.getBoundingClientRect();
      return [b.left + (v.x + 1) / 2 * b.width, b.top + (1 - v.y) / 2 * b.height]; },
    unit() { const o = view.proxies[pick], p = new THREE.Vector3(); o.getWorldPosition(p);
      const factor = p.distanceTo(view.cam.position) * Math.min(1.9 * Math.tan(Math.PI * view.cam.fov / 360) / view.cam.zoom, 7);
      return factor * view.tc.size / 4; },
    handle(kind, a = 0) { const o = view.proxies[pick], u = this.unit();
      if (kind === 'x') return this.project(o.position.x + a * u, o.position.y, o.position.z);
      if (kind === 'y') return this.project(o.position.x, o.position.y + a * u, o.position.z);
      return this.project(o.position.x + 0.5 * u * Math.cos(a), o.position.y + 0.5 * u * Math.sin(a), o.position.z); },
    proxy() { const o = view.proxies[pick]; return [o.position.x, o.position.y, o.rotation.z]; },
    state() { return {pick, tmode, mode, setup, placement, limits}; }
  };
  badge(null);
  updateControls();
})();

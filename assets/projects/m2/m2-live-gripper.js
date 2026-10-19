/* Live teleop of the gripper carry policy (#live-gripper). The simulation and the shared policy (both robots) run on
 * the lab computer (~/M2/mjlab/scripts/live_server.py, CPU only, user unit m2-live.service); this page renders the
 * scene itself with three.js from the meshes and body poses the server streams, and sends the desired pose:
 * held keys (arrows = horizontal, camera-relative; W/S = up/down; E/D = yaw; R/F = pitch; T/G = roll) or the sliders
 * (absolute offset from the start pose). Endpoints + token come from data attributes of the (encrypted) section:
 * the local server is tried first (this page opened on the lab computer), then the public one. */
(() => {
  'use strict';
  const root = document.getElementById('live-gripper');
  if (!root) return;
  const $ = s => root.querySelector(s);
  const KEYS = {                                  // key -> [axis, sign]; axes = [forward, left, up, roll, pitch, yaw]
    ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [1, 1], ArrowRight: [1, -1],
    w: [2, 1], s: [2, -1], t: [3, 1], g: [3, -1], r: [4, 1], f: [4, -1], e: [5, 1], d: [5, -1]
  };
  const SLIDERS = [                               // offset index, label, unit, decimals
    [0, 'X', 'm', 2], [1, 'Y', 'm', 2], [2, 'Lift', 'm', 3], [3, 'Roll', '°', 1], [4, 'Pitch', '°', 1], [5, 'Yaw', '°', 0]];
  const held = new Set();
  let ws = null, role = null, connected = false, connecting = false, ended = false, paused = false, unlocked = false;
  let sendTimer = null, lastPoseAt = 0, poses = 0, level = null, limits = null, trial = -1, camTrial = -1;
  let view = null, sceneMsg = null, payloadMsg = null, expect = null, lastState = null;
  const sliderTouched = new Array(6).fill(0);     // last user input time per slider (ms)
  let goalTimer = null, goalDirty = false;

  const status = (text, kind = 'idle') => { const n = $('.lg-status'); n.textContent = text; n.dataset.kind = kind; };
  const fmt = (v, d = 2) => Number.isFinite(v) ? (v >= 0 ? '+' : '') + v.toFixed(d) : '—';
  const keyOf = e => (e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key);
  const canControl = () => connected && role === 'controller' && !ended && !paused && unlocked;

  // ---------------------------------------------------------------- three.js view
  function whenThree() {
    const src = 'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js';
    if (!window.THREE && !document.querySelector(`script[src="${src}"]`)) {
      const list = [src, 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js'];
      if (window.M2Load) window.M2Load(list);
      else (function load(l) { if (!l.length) return; const sc = document.createElement('script'); sc.src = l[0]; sc.onload = sc.onerror = () => load(l.slice(1)); document.body.appendChild(sc); })(list);
    }
    return new Promise((res, rej) => {
      const t0 = performance.now();
      (function poll() { if (window.THREE && THREE.OrbitControls) res(); else if (performance.now() - t0 > 20000) rej(new Error('three.js did not load')); else setTimeout(poll, 60); })();
    });
  }
  const dark = () => { const t = document.documentElement.getAttribute('data-theme');
    return t === 'dark' || (t !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); };

  function makeView() {
    const el = $('.lg-3d');
    const r = new THREE.WebGLRenderer({antialias: true, alpha: true});
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    el.replaceChildren(r.domElement);
    const s = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, 1, 0.05, 80); cam.up.set(0, 0, 1);
    s.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.85));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.85); d1.position.set(3, -4, 8); s.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.3); d2.position.set(-4, 3, 2); s.add(d2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({color: dark() ? 0x2b3440 : 0xdfe4ea, roughness: 0.95}));
    floor.position.z = -0.002; s.add(floor);
    const grid = new THREE.GridHelper(40, 80, dark() ? 0x55606e : 0xb8c0ca, dark() ? 0x3a4350 : 0xcdd3da); grid.rotation.x = Math.PI / 2;
    grid.material.transparent = true; grid.material.opacity = 0.6; s.add(grid);
    const ctl = new THREE.OrbitControls(cam, r.domElement); ctl.enableDamping = true; ctl.dampingFactor = 0.12;
    ctl.maxPolarAngle = Math.PI * 0.495;
    const v = {r, s, cam, ctl, el, dirty: true, groups: [], payload: new THREE.Group(), ghost: new THREE.Group(), ref: new THREE.Group()};
    s.add(v.payload); s.add(v.ghost); s.add(v.ref);
    ctl.addEventListener('change', () => { v.dirty = true; });
    const size = () => { const w = el.clientWidth || 640, h = el.clientHeight || Math.round(w * 0.625);
      r.setSize(w, h, false);
      cam.aspect = w / h; cam.updateProjectionMatrix(); v.dirty = true; };
    size(); window.addEventListener('resize', size);
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
    const V = new Float32Array(buf, 4, meta.vbytes / 4), I = new Uint32Array(buf.slice(4 + meta.vbytes));
    return meta.meshes.map(m => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(V.slice(m.v, m.v + 3 * m.nv), 3));
      g.setIndex(new THREE.BufferAttribute(I.slice(m.i, m.i + m.ni), 1));
      g.computeVertexNormals(); return g;
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
      view.ref.add(new THREE.LineSegments(new THREE.EdgesGeometry(geos[e.mesh], 35), new THREE.LineBasicMaterial({color: dark() ? 0xffffff : 0x333333, transparent: true, opacity: 0.25})));
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
    view.ghost.visible = unlocked;
    if (camTrial !== trial && lastState) {                 // a new trial: frame both robots from the payload's side
      camTrial = trial;
      const c = [F[7 * NB], F[7 * NB + 1], Math.max(0.5, F[7 * NB + 2])], az = lastState.camera_azimuth_deg * Math.PI / 180;
      view.cam.position.set(c[0] - 4.2 * Math.cos(az), c[1] - 4.2 * Math.sin(az), c[2] + 1.9);
      view.ctl.target.set(c[0], c[1], c[2]); view.ctl.update();
    }
    view.dirty = true; poses += 1; lastPoseAt = performance.now();
    $('.lg-placeholder').hidden = true;
  }
  function camAzimuthDeg() {                               // horizontal direction the camera looks: "forward" for the arrows
    if (!view) return null;
    const d = new THREE.Vector3().subVectors(view.ctl.target, view.cam.position);
    return (Math.atan2(d.y, d.x) * 180 / Math.PI + 360) % 360;
  }

  // ---------------------------------------------------------------- UI state
  function updateControls() {
    $('.lg-connect').textContent = connecting ? 'Connecting…' : connected ? 'Stop' : 'Launch live sim';
    $('.lg-connect').disabled = connecting;
    $('.lg-pause').disabled = !(connected && role === 'controller' && !ended);
    $('.lg-pause').textContent = paused ? 'Resume' : 'Pause';
    $('.lg-reset').disabled = !(connected && role === 'controller');
    root.querySelectorAll('[data-lg-key]').forEach(b => { b.disabled = !canControl(); });
    root.querySelectorAll('.lg-slider input').forEach(i => { i.disabled = !canControl(); });
    $('.lg-center').disabled = !canControl();
    root.querySelectorAll('[data-lg-level]').forEach(b => {
      b.disabled = !(connected && role === 'controller');
      b.setAttribute('aria-pressed', String(Number(b.dataset.lgLevel) === level));
    });
    root.dataset.armed = String(canControl());
    $('.lg-role').textContent = !connected ? 'Not connected' : role === 'controller' ? 'You have control' : 'Watching · another visitor has control';
    $('.lg-keynote').textContent = !connected ? 'Controls unlock once the robots have grasped and lifted the load.'
      : ended ? 'Trial ended. Reset to start a new one.'
      : paused ? 'Paused. Resume to move the goal.'
      : !unlocked ? 'Grasping and lifting… pose control unlocks in a moment.'
      : role === 'controller' ? 'Drag the sliders, or hold keys / buttons. Release to hold the pose.' : 'Another visitor is driving.';
  }
  function showPose(kind, p) {
    const xyz = (p && p.position) || [];
    ['x', 'y', 'z'].forEach((a, i) => { $(`.lg-${kind}-${a}`).textContent = fmt(xyz[i]); });
    ['roll', 'pitch', 'yaw'].forEach(a => { $(`.lg-${kind}-${a}`).textContent = fmt(p ? p[a + '_deg'] : NaN, 1); });
  }
  function onState(s) {
    lastState = s;
    role = s.role; ended = !!s.ended; paused = !!s.paused; unlocked = !!s.unlocked; level = s.level;
    showPose('des', s.desired); showPose('mea', s.measured);
    const phase = {grasp: 'Grasping', lift: 'Lifting', teleop: 'Teleop', ended: 'Ended', paused: 'Paused'}[s.phase] || s.phase;
    $('.lg-phase').textContent = phase;
    $('.lg-clock').textContent = s.t.toFixed(1) + ' s';
    $('.lg-err').textContent = (s.tracking_error_m * 100).toFixed(1) + ' cm';
    $('.lg-rtf').textContent = s.rtf ? s.rtf.toFixed(2) + '× real time' : '—';
    $('.lg-mass').textContent = s.mass_kg.toFixed(1) + ' kg';
    $('.lg-left').textContent = Math.floor(s.session_left_s / 60) + ':' + String(Math.floor(s.session_left_s % 60)).padStart(2, '0');
    // sliders follow the goal offset unless the visitor touched them in the last moment
    const now = performance.now();
    root.querySelectorAll('.lg-slider').forEach(row => {
      const i = Number(row.dataset.i), inp = row.querySelector('input');
      if (now - sliderTouched[i] > 600 && Number.isFinite(s.offset[i])) inp.value = s.offset[i];
      row.querySelector('output').textContent = fmt(Number(inp.value), SLIDERS[i][3]) + ' ' + SLIDERS[i][2];
    });
    const notice = $('.lg-notice');
    notice.hidden = !(ended || paused);
    if (ended) {
      const why = {gripper_lost: 'A gripper lost the handle', payload_off_reference: 'The load left the planned pose',
        'session time limit': 'Session time is up', 'server error': 'The simulation hit an error'}[s.outcome] || (s.outcome || 'Trial ended');
      $('.lg-notice-title').textContent = 'Trial ended';
      $('.lg-notice-text').textContent = why + '. Reset to start a new trial.';
    } else if (paused) {
      $('.lg-notice-title').textContent = 'Paused';
      $('.lg-notice-text').textContent = 'Resume to keep going.';
    }
    if (!canControl()) releaseAll();
    status(ended ? 'Trial ended' : paused ? 'Paused' : unlocked ? 'Live · teleop' : 'Live · ' + phase.toLowerCase(), ended ? 'error' : 'live');
    updateControls();
  }
  function onHello(h) {
    role = h.role; level = h.level; limits = h.limits;
    $('.lg-policy').textContent = h.policy;
    const L = h.limits;
    $('.lg-limits').textContent = `Goal limits at this level: move ≤ ${L.move_m} m, lift ${L.lift_m[0]}–${L.lift_m[1]} m, `
      + `yaw ±${L.yaw_deg}°, roll/pitch ±${L.tilt_deg}°, handles ≤ ${L.bar_z_max_m} m; the load follows at up to `
      + `${L.speed_m_s} m/s and ${L.turn_deg_s}°/s. Session ${Math.round(h.session_limit_s / 60)} min.`;
    // step "any": a range input snaps to a grid anchored at min, so with min -8.6 and step 0.5 there is no exact 0
    const rng = [[-L.move_m, L.move_m], [-L.move_m, L.move_m], [L.lift_m[0], L.lift_m[1]],
                 [-L.tilt_deg, L.tilt_deg], [-L.tilt_deg, L.tilt_deg], [-L.yaw_deg, L.yaw_deg]];
    root.querySelectorAll('.lg-slider').forEach(row => {
      const i = Number(row.dataset.i), inp = row.querySelector('input'), [lo, hi] = rng[i];
      inp.min = lo; inp.max = hi; inp.step = 'any';
    });
    const box = $('.lg-levels');
    box.replaceChildren();
    for (const l of h.levels) {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.lgLevel = l.id; b.textContent = 'L' + l.id + ' · ' + l.label;
      b.addEventListener('click', () => send({type: 'reset', level: l.id}));
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
      else if (tag === 'PAYM' && expect === 'payload' && view) { buildPayload(payloadMsg, ev.data); expect = null; }
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
    if (!poses) $('.lg-placeholder').hidden = false;
    updateControls();
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
    connecting = true; updateControls(); status('Finding the live simulation…', 'waiting');
    const eps = endpoints();
    if (!eps.length) { disconnect('Live simulation is not configured on this page.', 'error'); return; }
    try { await whenThree(); if (!view) view = makeView(); } catch (e) { disconnect('3-D view unavailable: ' + e.message, 'error'); return; }
    for (const ep of eps) {
      if (!connecting) return;                    // the visitor pressed Stop meanwhile
      try {
        const {sock, first} = await open(ep);
        if (!connecting) { sock.close(); return; }
        ws = sock; connected = true; connecting = false; poses = 0; camTrial = -1;
        sock.onmessage = ev => { if (ws === sock) onMessage(ev); };
        sock.onclose = () => { if (ws === sock) disconnect('Disconnected.', 'idle'); };
        sock.onerror = () => {};
        onMessage(first);
        status('Connected · ' + (ep.local ? 'local server' : 'lab server') + ' · loading the scene', 'live');
        updateControls();
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
  function showKeys() { root.querySelectorAll('[data-lg-key]').forEach(b => b.classList.toggle('is-held', held.has(b.dataset.lgKey))); }

  // ---------------------------------------------------------------- input: sliders (absolute goal offset)
  function sliderOffset() {
    const o = [0, 0, 0, 0, 0, 0];
    root.querySelectorAll('.lg-slider').forEach(row => { o[Number(row.dataset.i)] = Number(row.querySelector('input').value); });
    return o;
  }
  function flushGoal() {
    if (goalDirty && canControl()) { send({type: 'goal', offset: sliderOffset()}); goalDirty = false; }
    if (!goalDirty) { clearInterval(goalTimer); goalTimer = null; }
  }
  function queueGoal() { goalDirty = true; if (!goalTimer) { flushGoal(); goalTimer = setInterval(flushGoal, 100); } }  // ~10 Hz
  root.querySelectorAll('.lg-slider').forEach(row => {
    const i = Number(row.dataset.i), inp = row.querySelector('input');
    inp.addEventListener('input', () => { sliderTouched[i] = performance.now();
      row.querySelector('output').textContent = fmt(Number(inp.value), SLIDERS[i][3]) + ' ' + SLIDERS[i][2]; queueGoal(); });
    inp.addEventListener('change', () => { sliderTouched[i] = performance.now(); queueGoal(); });
  });
  $('.lg-center').addEventListener('click', () => {
    if (!limits) return;
    const lift = Math.min(limits.lift_m[1], Math.max(limits.lift_m[0], limits.live_lift_m || 0.1));
    root.querySelectorAll('.lg-slider').forEach(row => { const i = Number(row.dataset.i);
      row.querySelector('input').value = i === 2 ? lift : 0; sliderTouched[i] = performance.now(); });
    queueGoal();
  });

  // ---------------------------------------------------------------- wiring
  $('.lg-connect').addEventListener('click', () => (connected || connecting) ? disconnect('Stopped.') : connect());
  $('.lg-pause').addEventListener('click', () => send({type: 'pause', paused: !paused}));
  $('.lg-reset').addEventListener('click', () => send({type: 'reset', level}));
  $('.lg-notice-action').addEventListener('click', () => (ended ? send({type: 'reset', level}) : send({type: 'pause', paused: false})));
  root.querySelectorAll('[data-lg-key]').forEach(b => {
    const k = b.dataset.lgKey;
    b.addEventListener('pointerdown', e => { if (!b.disabled) { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); press(k); } });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => b.addEventListener(t, () => release(k)));
  });
  document.addEventListener('keydown', e => {
    const k = keyOf(e);
    if (!KEYS[k] || !(connected && role === 'controller') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input:not([type=range]), textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();                       // arrows must not scroll the page (or nudge a slider) while driving
    if (canControl()) press(k);
  });
  document.addEventListener('keyup', e => release(keyOf(e)));
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  setInterval(() => {                         // stale stream
    if (connected && poses && !paused && !ended && performance.now() - lastPoseAt > 3000) status('Waiting for the simulation…', 'waiting');
  }, 1000);
  updateControls();
})();

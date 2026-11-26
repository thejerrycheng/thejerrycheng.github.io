/* Live scene: place the two cubes, press Run, the learned policy stacks them in a MuJoCo twin on the server.
   Needs three.js r128 + OrbitControls (loaded before this file) and an element <div id="he-live"></div>.
   Protocol: real_stack/live_server.py. The 3-D look is the Stack Data Studio's (same meshes, table, light). */

// The one switch: where the simulation server is. Tailscale address now; a public wss:// address later.
const LIVE_WS_URL = 'ws://100.120.87.113:8811/ws';

(function () {
  'use strict';
  const root = document.getElementById('he-live');
  if (!root) return;
  const here = document.currentScript ? new URL('.', document.currentScript.src).href : '';
  const A = { robots: root.dataset.robots || here + 'robots', scene: root.dataset.scene || here + 'scene', json: root.dataset.json || here + 'scene.json' };
  const local = /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname);
  const WS_URL = (local && new URLSearchParams(location.search).get('ws')) || root.dataset.ws || LIVE_WS_URL;   // ?ws= only on a local page (testing)
  const CONNECT_TIMEOUT_MS = 5000, PLACE_MS = 33, FORCE_MS = 100;
  const touch = matchMedia('(pointer: coarse)').matches;

  // ---------- DOM
  root.classList.add('hl');
  root.innerHTML =
    '<div class="hl-stage" aria-label="3-D scene: Franka arm, table, a yellow and a blue cube"><div class="hl-veil"><span></span><b></b></div><div class="hl-note" hidden></div><div class="hl-view" role="group" aria-label="View"><button type="button" data-view="3d" aria-pressed="true">3-D view</button><button type="button" data-view="cam" aria-pressed="false">Camera view</button></div><button type="button" class="hl-cam" hidden aria-label="Camera view: what the policy sees. Click to enlarge."><img alt=""><span>Camera view · what the policy sees</span></button></div>' +
    '<div class="hl-pol" role="radiogroup" aria-label="Policy" hidden><span>Policy</span><div></div></div>' +
    '<div class="hl-pol hl-camsel" role="radiogroup" aria-label="Camera" hidden><span>Camera</span><div></div><button type="button" class="hl-mini" data-cam="move">Move the camera</button><button type="button" class="hl-mini" data-cam="home">Recording pose</button></div>' +
    '<div class="hl-pol hl-layers"><span>Show</span><label><input type="checkbox" data-layer="est" checked> What perception estimates</label><label><input type="checkbox" data-layer="path" checked> What the policy plans</label></div>' +
    '<div class="hl-tour"><div class="hl-tour-head"><b></b><span></span></div><p></p><div class="hl-tour-nav"><button type="button" data-tour="-1">Back</button><button type="button" data-tour="1" class="main">Next</button></div></div>' +
    '<div class="hl-bar"><p class="hl-status" role="status" aria-live="polite"><i></i><span></span><button type="button" class="hl-retry" hidden>Try again</button></p>' +
    '<div class="hl-btns"><button type="button" data-act="run" class="main">Run</button><button type="button" data-act="pause">Pause</button><button type="button" data-act="reset">Reset</button></div></div>' +
    '<p class="hl-hint"></p>';
  const stage = root.querySelector('.hl-stage'), statusEl = root.querySelector('.hl-status'), statusTxt = statusEl.querySelector('span'),
    retry = root.querySelector('.hl-retry'), hint = root.querySelector('.hl-hint'), btn = {},
    veil = root.querySelector('.hl-veil'), veilTxt = veil.querySelector('span'), note = root.querySelector('.hl-note'),
    camBox = root.querySelector('.hl-cam'), camImg = camBox.querySelector('img');
  let camUrl = null, camTex = null, camFrames = 0;
  const viewBox = root.querySelector('.hl-view');
  let viewMode = '3d';                                  // '3d' = orbit scene with a small camera inset; 'cam' = the policy's camera fills the stage
  try { viewMode = localStorage.getItem('hl-view') === 'cam' ? 'cam' : '3d'; } catch (e) {}
  function setView(v) {
    viewMode = v;
    try { localStorage.setItem('hl-view', v); } catch (e) {}
    viewBox.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    applyView();
  }
  function applyView() {
    const full = !!camFrames && (glBroken || viewMode === 'cam');
    camBox.classList.toggle('only', full);
    if (full) camBox.classList.remove('big');
    camBox.setAttribute('aria-label', full ? 'Camera view: what the policy sees.' : 'Camera view: what the policy sees. Click to enlarge.');
    viewBox.hidden = false;                           // always offered; an option that cannot work right now is disabled, not hidden
    viewBox.querySelectorAll('button').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.view === (full ? 'cam' : '3d')));
      b.disabled = b.dataset.view === '3d' ? glBroken : !camFrames;
      b.title = b.disabled ? (b.dataset.view === '3d' ? '3-D graphics are not available in this browser' : 'The camera view starts once the simulation is connected') : '';
    });
  }
  viewBox.onclick = ev => { const b = ev.target.closest('button[data-view]'); if (b) setView(b.dataset.view); };
  viewBox.onpointerdown = ev => ev.stopPropagation();
  camBox.onclick = () => { if (!camBox.classList.contains('only')) camBox.classList.toggle('big'); };
  camImg.onload = () => { if (camTex) { camTex.image = camImg; camTex.needsUpdate = true; dirty = 2; } };
  function camFrame(blob) {                          // one JPEG from the server: the image the policy is given, live
    const u = URL.createObjectURL(blob), old = camUrl; camUrl = u; camImg.src = u; if (old) setTimeout(() => URL.revokeObjectURL(old), 500);
    if (!camFrames++) ui();
  }
  root.querySelectorAll('[data-act]').forEach(b => { btn[b.dataset.act] = b; b.onclick = () => act(b.dataset.act); });

  // ---------- state
  let S = null, view = null, sc = null, franka = null, mesh = {}, regions = {}, pullLine = null, pullDot = null;
  let ws = null, conn = 'connecting', hello = null, st = null, visible = false, started = false;
  let ready = false, glLost = false, glBroken = false, waitRun = 0;     // scene assets loaded; WebGL context lost; render failed; time Run was pressed
  let drag = null, pull = null, hold = {};            // hold[cube] = {x, y, until}: optimistic placement shown until the server confirms

  const STATUS = {
    connecting: ['Connecting', ''], offline: ['The live server is offline right now', 'off'], busy: ['Busy · both simulations are in use', 'off'],
    idle: ['Idle', ''], running: ['Running', 'on'], paused: ['Paused', ''], stacked: ['Stacked', 'ok'], missed: ['Missed', 'off'], nogl: ['3-D is not available in this browser', 'off'],
  };
  function ui() {
    // the stage never sits there black and silent: a veil while the scene loads or the 3-D context is being
    // restored, and a small note between pressing Run and the arm's first motion (the first plan takes ~0.3 s,
    // longer on a slow connection)
    const v = glBroken && camFrames ? '' : glBroken ? '3-D graphics could not start in this browser. Close other tabs that use 3-D, or restart the browser, then reload this page.' : glLost ? 'Restoring the 3-D view' : !ready ? 'Loading the scene' : conn === 'connecting' ? 'Connecting to the simulation' : '';
    veil.hidden = !v; veilTxt.textContent = v; veil.dataset.s = glBroken ? 'off' : '';
    if (waitRun && (conn !== 'open' || !st || st.phase === 'done' || (st.phase === 'running' && st.t > 0.4) || performance.now() - waitRun > 8000)) waitRun = 0;
    const unseen = !!(st && st.phase === 'running' && st.unseen);     // perception has no pose for a cube (outside the camera image)
    note.hidden = !waitRun && !unseen; note.textContent = unseen ? 'The camera cannot see both cubes, so the policy has nothing to plan from. Move the cube into view.' : 'The policy is planning its first move';
    const noView = glBroken && !camFrames;            // without 3-D the camera view alone still shows the run
    const phase = noView ? 'nogl' : conn !== 'open' ? conn : !st ? 'connecting' : st.phase === 'done' ? (st.result || 'missed') : st.phase === 'running' && st.result === 'stacked' ? 'stacked' : st.phase;
    const [label, cls] = STATUS[phase] || STATUS.connecting;
    statusTxt.textContent = label;                    // no timer: the policy runs until Pause or Reset
    camBox.hidden = !camFrames || conn !== 'open'; applyView();
    statusEl.dataset.s = cls;
    retry.hidden = !(conn === 'offline' || conn === 'busy');
    const live = conn === 'open' && st && !noView;        // no blind runs: without any view the controls stay off
    btn.run.disabled = !live || st.phase === 'running';
    btn.pause.disabled = !live || st.phase !== 'running';
    btn.reset.disabled = !live;
    btn.run.textContent = live && st.phase === 'paused' ? 'Resume' : live && st.phase === 'done' ? 'Run again' : 'Run';
    hint.textContent = !live ? (conn === 'offline' || conn === 'busy' ? 'You can still look around the scene.' : ' ')
      : st.phase === 'idle' ? (glBroken ? 'Press Run. Reset deals a new layout.' : 'Drag a cube to place it, then press Run. Reset deals a new random layout.')
      : st.phase === 'done' ? 'Reset to try another layout.'
      : st.phase === 'running' && st.result === 'stacked' ? 'The policy stacked the cubes on its own. It keeps running; Reset deals a new layout.'
      : touch ? 'Drag a cube to push it.' : 'Hold ⌘ or Ctrl and drag a cube to push it.';
  }
  const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  // policy picker: the server lists the policies it has loaded; choosing one restarts the scene with the same cube layout
  const polBox = root.querySelector('.hl-pol:not(.hl-camsel)'), polList = polBox.querySelector('div');
  let policyId = null;
  function drawPolicies(list, current) {
    polList.textContent = '';
    (list || []).forEach(p => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.id = p.id; b.textContent = p.label;
      polList.appendChild(b);
    });
    polBox.hidden = !list || list.length < 2;
    markPolicy(current);
  }
  function markPolicy(id) {
    if (!id || id === policyId && polList.querySelector('[aria-checked="true"]')) return;
    policyId = id;
    polList.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.id === id)));
  }
  // camera picker: which camera the deployment uses (perception runs on its frame; the policy gets it rectified to the Magic Leap view)
  const csBox = root.querySelector('.hl-camsel'), csList = csBox.querySelector('div');
  csBox.querySelectorAll('[data-cam]').forEach(b => { b.onclick = () => send({ type: 'camera_move', random: b.dataset.cam === 'move' }); });
  root.querySelectorAll('[data-layer]').forEach(cb => { cb.onchange = () => { show[cb.dataset.layer] = cb.checked; applyOverlays(); dirty = 2; }; });
  // ---- walkthrough: five steps, each sets what is shown and where the viewer stands
  const TOUR = [
    { t: 'The scene, rebuilt from the recording', p: 'This is the real workcell reconstructed in simulation: the robot arm, the table with its real texture, and the two cubes. Drag in the view to look around. Drag a cube to put it somewhere else.', view: '3d', est: false, path: false, eye: [1.12, -1.22, 0.86], at: [0.26, -0.14, 0.16] },
    { t: 'The camera', p: 'The orange pyramid is the camera, with its live image on the image plane. Pick the Magic Leap 2 or a RealSense D435, or press "Move the camera" to put it at a new position and angle that still sees the whole cube region. The dots mark where it has been.', view: '3d', est: false, path: false, eye: [0.75, -1.45, 0.70], at: [0.24, -0.45, 0.20] },
    { t: 'What perception estimates', p: 'The policy is never told where the cubes are. The wire boxes are the cube positions estimated from the camera\'s colour and depth image. Press Run, then drag a cube: the wire box follows once the camera sees it again.', view: '3d', est: true, path: false, eye: [0.70, -0.85, 0.55], at: [0.27, -0.22, 0.02] },
    { t: 'What the policy plans', p: 'The orange line is the next second of hand motion the policy has planned. It re-plans several times a second from the newest camera frame, so the line bends when the scene changes.', view: '3d', est: true, path: true, eye: [0.85, -0.95, 0.60], at: [0.27, -0.22, 0.08] },
    { t: 'Through the camera', p: 'Switch to the camera view to see what the system sees. Then try to break it: move a cube while the arm is on its way, pull the cube out of the gripper, or press Reset for a new layout.', view: 'cam', est: true, path: true, eye: [1.12, -1.22, 0.86], at: [0.26, -0.14, 0.16] },
  ];
  const tourBox = root.querySelector('.hl-tour'), tourT = tourBox.querySelector('b'), tourN = tourBox.querySelector('.hl-tour-head span'), tourP = tourBox.querySelector('p');
  let tourI = 0, fly = null;
  function tour(i, moveView) {
    tourI = Math.max(0, Math.min(TOUR.length - 1, i)); const s = TOUR[tourI];
    tourT.textContent = s.t; tourN.textContent = (tourI + 1) + ' of ' + TOUR.length; tourP.textContent = s.p;
    tourBox.querySelector('[data-tour="-1"]').disabled = tourI === 0; tourBox.querySelector('[data-tour="1"]').disabled = tourI === TOUR.length - 1;
    if (!moveView) return;
    show.est = s.est; show.path = s.path; root.querySelectorAll('[data-layer]').forEach(cb => { cb.checked = show[cb.dataset.layer]; });
    setView(s.view); applyOverlays();
    if (view) fly = { t0: performance.now(), p0: view.cam.position.clone(), a0: view.ctl.target.clone(), p1: new THREE.Vector3(...s.eye), a1: new THREE.Vector3(...s.at) };
    dirty = 3;
  }
  function stepFly() {
    if (!fly || !view) return;
    const w = Math.min(1, (performance.now() - fly.t0) / 900), e = w * w * (3 - 2 * w);
    view.cam.position.lerpVectors(fly.p0, fly.p1, e); view.ctl.target.lerpVectors(fly.a0, fly.a1, e); view.ctl.update(); dirty = 2;
    if (w >= 1) fly = null;
  }
  tourBox.querySelectorAll('[data-tour]').forEach(b => { b.onclick = () => tour(tourI + Number(b.dataset.tour), true); });
  tour(0, false);
  let cameraId = null;
  function drawCameras(list, current) {
    csList.textContent = '';
    (list || []).forEach(p => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.id = p.id; b.textContent = p.label; csList.appendChild(b); });
    csBox.hidden = !list || list.length < 2;
    markCamera(current);
  }
  function markCamera(id) {
    if (!id || id === cameraId && csList.querySelector('[aria-checked="true"]')) return;
    cameraId = id;
    csList.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.id === id)));
  }
  csList.onclick = ev => {
    const b = ev.target.closest('button[data-id]');
    if (!b || b.dataset.id === cameraId) return;
    markCamera(b.dataset.id); send({ type: 'camera', id: b.dataset.id });
  };
  polList.onclick = ev => {
    const b = ev.target.closest('button[data-id]');
    if (!b || b.dataset.id === policyId) return;
    markPolicy(b.dataset.id); send({ type: 'policy', id: b.dataset.id });
  };
  function act(a) { if (a === 'reset') { hold = {}; waitRun = 0; send({ type: 'reset', random: true }); ui(); return; } if (a === 'run' && st && st.phase !== 'paused') waitRun = performance.now(); if (a !== 'run') waitRun = 0; send({ type: a }); ui(); }

  // ---------- connection
  function connect() {
    if (ws) { ws.onclose = ws.onmessage = ws.onerror = null; try { ws.close(); } catch (e) {} }
    conn = 'connecting'; st = null; ui();
    let sock, settled = false;
    try { sock = new WebSocket(WS_URL); } catch (e) { conn = 'offline'; ui(); return; }
    ws = sock; sock.binaryType = 'blob';
    const timer = setTimeout(() => { if (!settled && ws === sock) { settled = true; conn = 'offline'; ui(); try { sock.close(); } catch (e) {} } }, CONNECT_TIMEOUT_MS);
    sock.onmessage = ev => {
      if (ws !== sock) return;
      if (typeof ev.data !== 'string') { camFrame(ev.data); return; }
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type === 'state') { st = m; if (m.policy) markPolicy(m.policy); if (m.camera) markCamera(m.camera); if (conn !== 'open') { conn = 'open'; } apply(); ui(); }
      else if (m.type === 'hello') { settled = true; clearTimeout(timer); hello = m; conn = 'open'; drawPolicies(m.policies, policyId && (m.policies || []).some(p => p.id === policyId) ? policyId : m.policy); if (policyId && policyId !== m.policy) send({ type: 'policy', id: policyId }); drawCameras(m.cameras, cameraId && (m.cameras || []).some(p => p.id === cameraId) ? cameraId : m.camera); if (cameraId && cameraId !== m.camera) send({ type: 'camera', id: cameraId }); drawRegions(m.bounds); ui(); }
      else if (m.type === 'busy') { settled = true; clearTimeout(timer); conn = 'busy'; ui(); }
      else if (m.type === 'bye') { settled = true; conn = 'offline'; ui(); }
      else if (m.type === 'error' && drag) { hold[drag.cube] = null; }
    };
    sock.onclose = () => { if (ws !== sock) return; clearTimeout(timer); settled = true; drag = null; endPull(); if (conn !== 'busy') conn = 'offline'; ui(); if (view) view.ctl.enabled = true; };
    sock.onerror = () => {};
  }
  retry.onclick = connect;
  setInterval(() => { if (visible && !document.hidden) send({ type: 'ping' }); }, 20000);   // an open, visible page is never timed out
  addEventListener('pagehide', () => { if (ws) try { ws.close(); } catch (e) {} });

  // ---------- 3-D scene (functions from the Stack Data Studio, unchanged in look)
  let dirty = 3;                                    // frames still to draw; the scene is redrawn only when something changed
  const TEX = new THREE.TextureLoader();
  function tex(url) { const t = TEX.load(url, () => { dirty = 3; }); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; }
  async function pandaAsset() { const meta = await fetch(A.robots + '/panda.json').then(r => r.json()), buf = await fetch(A.robots + '/panda.bin').then(r => r.arrayBuffer()); return { meta, buf }; }
  function makeFranka(P) {
    const g0 = new THREE.Group(), nodes = {}, byJoint = {};
    for (const b of P.meta.bodies) {
      const fixed = new THREE.Group(); fixed.position.set(...b.pos); fixed.quaternion.set(b.quat[1], b.quat[2], b.quat[3], b.quat[0]); const jg = new THREE.Group(); fixed.add(jg);
      if (b.mesh) {
        const g = new THREE.BufferGeometry(), m = b.mesh; g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P.buf, m.offset, m.nv * 3), 3));
        g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(P.buf, m.offset + m.nv * 12, m.nv * 3), 3, true)); g.setIndex(new THREE.BufferAttribute(new Uint32Array(P.buf, m.index_offset, m.nt * 3), 1)); g.computeVertexNormals();
        const me = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .42, metalness: .12 })); me.castShadow = true; me.receiveShadow = true; jg.add(me);
      }
      nodes[b.id] = { fixed, jg, b }; if (b.joint) byJoint[b.joint.name] = { jg, b }; (b.parent < 0 || !nodes[b.parent] ? g0 : nodes[b.parent].jg).add(fixed);
    }
    return { root: g0, byJoint };
  }
  const AX = new THREE.Vector3();
  function poseFranka(fr, q, widthM) {
    if (!fr) return;
    for (let i = 0; i < 7; i++) { const n = fr.byJoint['joint' + (i + 1)]; if (n) n.jg.quaternion.setFromAxisAngle(AX.set(...n.b.joint.axis), q[i]); }
    ['finger_joint1', 'finger_joint2'].forEach(nm => { const n = fr.byJoint[nm]; if (n) n.jg.position.set(...n.b.joint.axis).multiplyScalar(Math.max(0, Math.min(0.04, widthM / 2))); });
  }
  function headset() { // stylised Magic Leap 2: visor, two lens pods, temple arms, rear band
    const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: .5, metalness: .4 }), glass = new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: .08, metalness: .9 });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.042, 0.022), dark); visor.position.set(0, 0, -0.011); g.add(visor);
    [-0.036, 0.036].forEach(x => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.006, 28), glass); l.rotation.x = Math.PI / 2; l.position.set(x, 0.002, 0.002); g.add(l); });
    [-0.079, 0.079].forEach(x => { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.15), dark); arm.position.set(x, -0.004, -0.092); g.add(arm); });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.079, 0.007, 10, 28, Math.PI), dark); band.rotation.x = Math.PI / 2; band.rotation.z = Math.PI; band.position.set(0, -0.004, -0.167); g.add(band);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
  }
  function camPose(S) { const T = S.T_base_cam, m = new THREE.Matrix4(); m.set(T[0][0], T[0][1], T[0][2], T[0][3], T[1][0], T[1][1], T[1][2], T[1][3], T[2][0], T[2][1], T[2][2], T[2][3], 0, 0, 0, 1); return m; }
  // ---- camera rig: frustum + image plane + headset at a pose T (3x4, base frame) with intrinsics K = [fx, fy, cx, cy] (1280 x 720)
  let rig = null, rigKey = '', rigFrom = null, rigGoal = null, rigT0 = 0, rigK = null;
  const trail = [];
  function rigMatrix(T) { const m = new THREE.Matrix4(); m.set(T[0][0], T[0][1], T[0][2], T[0][3], T[1][0], T[1][1], T[1][2], T[1][3], T[2][0], T[2][1], T[2][2], T[2][3], 0, 0, 0, 1); return m; }
  function buildRig(K) {
    const W = 1280, H = 720, d = .22, g0 = new THREE.Group();
    const pt = (u, v) => new THREE.Vector3((u - K[2]) / K[0] * d, (v - K[3]) / K[1] * d, d);
    const c = [pt(0, 0), pt(W, 0), pt(W, H), pt(0, H)], g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([].concat(...c.map(p => [p.x, p.y, p.z]))), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
    g0.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: camTex, side: THREE.DoubleSide, transparent: true, opacity: .96 })));
    const o = new THREE.Vector3(), pts = []; c.forEach((p, i) => { pts.push(o, p, p, c[(i + 1) % 4]); });
    g0.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xC25B2A })));
    const hs = headset(); hs.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI)); g0.add(hs);
    g0.matrixAutoUpdate = false;
    return g0;
  }
  function rigTo(T, K, instant) {                     // move (or rebuild, when the intrinsics change) the rig; animated over 0.6 s
    if (!sc || !T) return;
    const key = K.join(','), goal = rigMatrix(T);
    if (!rig || key !== rigKey) { if (rig) sc.remove(rig); rig = buildRig(K); rigKey = key; rigK = K; sc.add(rig); instant = instant || !rigGoal; }
    if (rigGoal && rigGoal.equals(goal) && !instant) return;
    if (instant || !rigGoal) { rig.matrix.copy(goal); rigFrom = null; }
    else { rigFrom = rig.matrix.clone(); rigT0 = performance.now(); const p = new THREE.Vector3().setFromMatrixPosition(rigFrom); addTrail(p); }
    rigGoal = goal; dirty = 3;
  }
  function addTrail(p) {                              // where the camera has been
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0xC25B2A, transparent: true, opacity: .55 })); m.position.copy(p); sc.add(m); trail.push(m);
    if (trail.length > 12) sc.remove(trail.shift());
  }
  function stepRig() {
    if (!rig || !rigFrom) return;
    const w = Math.min(1, (performance.now() - rigT0) / 600), e = w * w * (3 - 2 * w);
    const p0 = new THREE.Vector3(), q0 = new THREE.Quaternion(), s0 = new THREE.Vector3(), p1 = new THREE.Vector3(), q1 = new THREE.Quaternion();
    rigFrom.decompose(p0, q0, s0); rigGoal.decompose(p1, q1, s0);
    rig.matrix.compose(p0.lerp(p1, e), q0.slerp(q1, e), new THREE.Vector3(1, 1, 1)); dirty = 2;
    if (w >= 1) rigFrom = null;
  }
  // ---- overlays: what perception estimates (wire cubes) and what the policy plans (tool path)
  const show = { est: true, path: true };
  let estBox = {}, pathLine = null;
  function buildOverlays(edge) {
    const col = { yellow: 0xFFD23F, blue: 0x5AA9FF };
    for (const c of ['yellow', 'blue']) {
      const b = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(edge * 1.06, edge * 1.06, edge * 1.06)), new THREE.LineBasicMaterial({ color: col[c], depthTest: false, transparent: true, opacity: .95 }));
      b.renderOrder = 8; b.visible = false; sc.add(b); estBox[c] = b;
    }
    pathLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xFF9500, depthTest: false, transparent: true, opacity: .9 })); pathLine.renderOrder = 8; pathLine.visible = false; pathLine.frustumCulled = false; sc.add(pathLine);
  }
  function applyOverlays() {
    if (!pathLine || !st) return;
    for (const c of ['yellow', 'blue']) {
      const e = st.est && st.est[c], b = estBox[c];
      b.visible = !!(show.est && e); if (e) { b.position.set(...e.pos); b.quaternion.set(...e.quat); }
    }
    const P = st.path || [];
    pathLine.visible = show.path && P.length > 1;
    if (pathLine.visible) pathLine.geometry.setFromPoints(P.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    if (st.cam_T) { const cam = (hello && hello.cameras || []).find(x => x.id === (st.camera || cameraId)); rigTo(st.cam_T, cam && cam.K ? cam.K : (rigK || [1038.5, 1038.5, 634, 364.5]), false); }
  }
  function addSetup(sc, S) {
    const zt = S.table_z, out = {};
    sc.add(new THREE.HemisphereLight(0xffffff, 0x3a3632, 0.55));
    const L = new THREE.DirectionalLight(0xffffff, 0.95), l = S.light_base || [0, -0.5, -0.86], ctr = new THREE.Vector3(0.38, -0.05, zt);
    L.position.set(ctr.x - l[0] * 2.2, ctr.y - l[1] * 2.2, ctr.z - l[2] * 2.2); L.target.position.copy(ctr); L.castShadow = true; L.shadow.mapSize.set(1024, 1024);
    Object.assign(L.shadow.camera, { left: -0.9, right: 0.9, top: 0.9, bottom: -0.9, near: 0.2, far: 5 }); L.shadow.bias = -0.0006; L.shadow.radius = 4; sc.add(L, L.target);
    const tt = S.table_texture; if (tt) {           // the REAL table: clean-background pixels re-projected onto the table plane
      const w = tt.x[1] - tt.x[0], h = tt.y[1] - tt.y[0];
      const top = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex(A.scene + '/table.jpg'), roughness: .55, metalness: .25 })); top.position.set((tt.x[0] + tt.x[1]) / 2, (tt.y[0] + tt.y[1]) / 2, zt); top.receiveShadow = true; sc.add(top);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), new THREE.MeshStandardMaterial({ color: 0x161412, roughness: .8 })); slab.position.set(top.position.x, top.position.y, zt - 0.0255); sc.add(slab);
    }
    // the camera the policy sees through: headset model, frustum, and the live image on its image plane (rebuilt when the camera moves)
    camTex = tex(A.scene + '/bg.jpg'); camTex.minFilter = THREE.LinearFilter; camTex.generateMipmaps = false;   // replaced by the live camera frames
    rigTo([S.T_base_cam[0], S.T_base_cam[1], S.T_base_cam[2]], [S.fx, S.fy, S.cx, S.cy], true);
    out.cubeMat = (rgb, fallback) => new THREE.MeshStandardMaterial({ color: rgb ? new THREE.Color(rgb[0], rgb[1], rgb[2]).convertSRGBToLinear() : fallback, roughness: .7 });
    return out;
  }
  function cube(sc, e, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(e, e, e), mat); m.castShadow = true; m.receiveShadow = true; sc.add(m); return m; }

  // Safari can hand back a dead WebGL context when the power preference is left at its default (measured on Safari 26.5:
  // 'default' -> lost at creation, 'high-performance' and 'low-power' -> fine), so ask explicitly and fall back in turn.
  function makeGL(opts){let r=null,err=null;for(const pp of ['high-performance','low-power','default']){try{r=new THREE.WebGLRenderer(Object.assign({},opts,{powerPreference:pp}));if(!r.getContext().isContextLost())return r;r.dispose();}catch(e){err=e;r=null;}}if(r)return r;throw err||new Error('no WebGL');}
  function orbit(el, target, pos) {
    const r = makeGL({ antialias: true }); r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    // a lost WebGL context (GPU busy, tab in the background, driver reset) would leave a black stage for good:
    // keep it restorable, say so, and draw again when it is back
    r.domElement.addEventListener('webglcontextlost', ev => { ev.preventDefault(); glLost = true; ui(); });
    r.domElement.addEventListener('webglcontextrestored', () => { glLost = false; dirty = 3; ui(); }); r.outputEncoding = THREE.sRGBEncoding; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; el.appendChild(r.domElement);
    const cam = new THREE.PerspectiveCamera(38, 1, 0.01, 12); cam.up.set(0, 0, 1); cam.position.set(...pos);
    pointer(r.domElement, cam);                      // registered BEFORE OrbitControls so a cube grab can switch the orbit off first
    const ctl = new THREE.OrbitControls(cam, r.domElement); ctl.target.set(...target); ctl.enablePan = false; ctl.minDistance = 0.35; ctl.maxDistance = 2.6; ctl.maxPolarAngle = Math.PI * 0.495; ctl.update(); ctl.addEventListener('change', () => { dirty = 2; });
    let fit = 0;                                     // a portrait stage needs the camera further back to keep the arm in view (until the visitor moves it)
    const size = () => { const b = el.getBoundingClientRect(); if (b.width < 2 || b.height < 2) return; dirty = 3; r.setSize(b.width, b.height, false); cam.aspect = b.width / b.height; cam.updateProjectionMatrix();
      const k = cam.aspect < 1 ? 1.45 : 1; if (k !== fit && !moved) { fit = k; cam.position.set(...pos).sub(ctl.target).multiplyScalar(k).add(ctl.target); ctl.update(); } };
    let moved = false; ctl.addEventListener('start', () => { moved = true; });
    size(); new ResizeObserver(size).observe(el);
    return { r, cam, ctl };
  }

  // ---------- pointer: place (idle) and push (running), mouse and touch
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3(), tmp = new THREE.Vector3();
  function cast(ev, cam, el) { const b = el.getBoundingClientRect(); ndc.set((ev.clientX - b.left) / b.width * 2 - 1, -(ev.clientY - b.top) / b.height * 2 + 1); ray.setFromCamera(ndc, cam); }
  function pick() { const h = ray.intersectObjects([mesh.yellow, mesh.blue].filter(Boolean)); return h.length ? h[0] : null; }
  function allowed(c, x, y) {                        // clamp to the region, keep clear of the other cube; null = no valid spot
    const b = hello.bounds[c], o = mesh[c === 'yellow' ? 'blue' : 'yellow'].position, dmin = hello.edge * Math.SQRT2 + 0.006;
    const cl = () => { x = Math.min(Math.max(x, b.x[0]), b.x[1]); y = Math.min(Math.max(y, b.y[0]), b.y[1]); };
    cl();
    let d = Math.hypot(x - o.x, y - o.y);
    if (d < dmin) { const ux = d > 1e-6 ? (x - o.x) / d : 0, uy = d > 1e-6 ? (y - o.y) / d : -1; x = o.x + ux * dmin; y = o.y + uy * dmin; cl(); d = Math.hypot(x - o.x, y - o.y); if (d < dmin - 1e-6) return null; }
    return [x, y];
  }
  function pointer(el, cam) {
    el.addEventListener('pointerdown', ev => {
      if (conn !== 'open' || !st || !mesh.yellow || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      cast(ev, cam, el); const h = pick(); if (!h) return;
      const c = h.object === mesh.yellow ? 'yellow' : 'blue', mod = ev.ctrlKey || ev.metaKey || ev.pointerType !== 'mouse';
      if (st.phase === 'idle' && !(ev.ctrlKey || ev.metaKey)) {
        drag = { cube: c, id: ev.pointerId, dx: h.point.x - h.object.position.x, dy: h.point.y - h.object.position.y, z: h.point.z, last: 0 };
      } else if ((st.phase === 'running' || st.phase === 'paused') && mod) {
        pull = { cube: c, id: ev.pointerId, local: h.object.worldToLocal(h.point.clone()), point: h.point.clone(), target: h.point.clone(), timer: 0 };
        send({ type: 'force', cube: c, target: pull.target.toArray(), point: pull.point.toArray() });
        pull.timer = setInterval(() => pull && send({ type: 'force', cube: pull.cube, target: pull.target.toArray() }), FORCE_MS);   // the server drops a force that is not refreshed
      } else return;
      view.ctl.enabled = false; el.setPointerCapture(ev.pointerId); ev.preventDefault(); el.style.cursor = 'grabbing';
    });
    el.addEventListener('pointermove', ev => {
      if (drag && ev.pointerId === drag.id) {
        cast(ev, cam, el); plane.set(tmp.set(0, 0, 1), -drag.z);
        if (!ray.ray.intersectPlane(plane, hit)) return;
        const p = allowed(drag.cube, hit.x - drag.dx, hit.y - drag.dy); if (!p) return;
        hold[drag.cube] = { x: p[0], y: p[1], until: Infinity }; mesh[drag.cube].position.x = p[0]; mesh[drag.cube].position.y = p[1];
        const now = performance.now(); if (now - drag.last > PLACE_MS) { drag.last = now; send({ type: 'place', cube: drag.cube, x: p[0], y: p[1] }); }
      } else if (pull && ev.pointerId === pull.id) {
        cast(ev, cam, el); cam.getWorldDirection(tmp); plane.setFromNormalAndCoplanarPoint(tmp, pull.point);   // drag in the plane facing the viewer
        if (ray.ray.intersectPlane(plane, hit)) { pull.target.copy(hit); pull.target.z = Math.max(pull.target.z, S.table_z + 0.005); }
      } else if (!drag && !pull && ev.pointerType === 'mouse' && mesh.yellow && conn === 'open' && st) {
        cast(ev, cam, el); const can = st.phase === 'idle' || ((st.phase === 'running' || st.phase === 'paused') && (ev.ctrlKey || ev.metaKey));
        el.style.cursor = can && pick() ? 'grab' : '';
      }
    });
    const up = ev => {
      if (drag && ev.pointerId === drag.id) {
        const h = hold[drag.cube]; if (h) { send({ type: 'place', cube: drag.cube, x: h.x, y: h.y }); h.until = performance.now() + 400; }
        drag = null;
      } else if (pull && ev.pointerId === pull.id) endPull(); else return;
      view.ctl.enabled = true; el.style.cursor = '';
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', ev => ev.preventDefault());
  }
  function endPull() { if (!pull) return; clearInterval(pull.timer); pull = null; send({ type: 'release' }); if (pullLine) pullLine.visible = pullDot.visible = false; dirty = 2; }

  // ---------- drawing
  function drawRegions(bounds) {                     // where each cube may go: the area the training demonstrations cover
    if (!sc) return;
    for (const c of ['yellow', 'blue']) {
      if (regions[c]) sc.remove(regions[c]);
      const b = bounds[c], z = S.table_z + 0.0012, e = hello ? hello.edge / 2 : S.cube_edge / 2;
      const pts = [[b.x[0] - e, b.y[0] - e], [b.x[1] + e, b.y[0] - e], [b.x[1] + e, b.y[1] + e], [b.x[0] - e, b.y[1] + e], [b.x[0] - e, b.y[0] - e]].map(p => new THREE.Vector3(p[0], p[1], z));
      const col = new THREE.Color(...S[c + '_rgb']).convertSRGBToLinear();
      regions[c] = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: col, dashSize: 0.012, gapSize: 0.01, transparent: true, opacity: 0.75 }));
      regions[c].computeLineDistances(); regions[c].visible = false; sc.add(regions[c]);
    }
  }
  function apply() {
    if (!sc || !st) return;
    const fin = a => Array.isArray(a) && a.every(Number.isFinite);
    if (!fin(st.q) || !fin(st.yellow.pos) || !fin(st.yellow.quat) || !fin(st.blue.pos) || !fin(st.blue.quat)) return;   // never draw a broken state
    dirty = 2;
    const now = performance.now();
    for (const c of ['yellow', 'blue']) {
      const m = mesh[c], s = st[c], h = hold[c];
      m.position.set(...s.pos); m.quaternion.set(...s.quat);
      if (h && st.phase === 'idle') { if (now < h.until) { m.position.x = h.x; m.position.y = h.y; } else hold[c] = null; }
    }
    poseFranka(franka, st.q, st.width);
    applyOverlays();
  }
  function frame() {
    requestAnimationFrame(frame);
    if (!visible || !view || glLost || glBroken) return;
    stepRig(); stepFly();
    if (drag || pull) dirty = 2;
    if (dirty <= 0) return;
    dirty--;
    for (const c of ['yellow', 'blue']) if (regions[c]) regions[c].visible = !!(drag && drag.cube === c);
    if (pull && mesh[pull.cube]) {
      const a = mesh[pull.cube].localToWorld(tmp.copy(pull.local));
      pullLine.geometry.setFromPoints([a.clone(), pull.target]); pullLine.visible = pullDot.visible = true; pullDot.position.copy(pull.target);
    }
    try { view.r.render(sc, view.cam); } catch (e) { glBroken = true; console.error('live scene render failed', e); ui(); }
  }

  async function build() {
    try { S = await fetch(A.json).then(r => r.json()); } catch (e) { conn = 'offline'; ui(); return; }
    try { view = orbit(stage, [0.26, -0.14, 0.16], [1.12, -1.22, 0.86]); if (view.r.getContext().isContextLost()) throw new Error('WebGL context lost at creation'); }
    catch (e) { view = null; glBroken = true; ready = true; stage.querySelectorAll('canvas').forEach(c => c.remove()); ui(); return; }   // e.g. the browser's GPU process is out of contexts
    sc = new THREE.Scene(); sc.background = new THREE.Color(0x0a0908);
    const U = addSetup(sc, S), e = S.cube_edge, z = S.table_z + e / 2, P = S.live.place;
    mesh.yellow = cube(sc, e, U.cubeMat(S.yellow_rgb, 0xe7c24b)); mesh.blue = cube(sc, e, U.cubeMat(S.blue_rgb, 0x2a55c0));
    for (const c of ['yellow', 'blue']) { mesh[c].position.set(P[c].x, P[c].y, z); mesh[c].rotation.z = P[c].yaw; }
    buildOverlays(S.cube_edge);
    const accent = new THREE.Color(getComputedStyle(root).getPropertyValue('--hl-accent').trim() || '#FF9500');
    pullLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: accent, depthTest: false })); pullLine.renderOrder = 9; pullLine.visible = false; pullLine.frustumCulled = false; sc.add(pullLine);
    pullDot = new THREE.Mesh(new THREE.SphereGeometry(0.004, 16, 12), new THREE.MeshBasicMaterial({ color: accent, depthTest: false })); pullDot.renderOrder = 9; pullDot.visible = false; sc.add(pullDot);
    if (hello) drawRegions(hello.bounds);
    frame();
    try { franka = makeFranka(await pandaAsset()); sc.add(franka.root); poseFranka(franka, S.live.q_start, 0.08); apply(); } catch (err) { console.warn('Franka meshes not loaded', err); }
    ready = true; dirty = 3; ui();
  }

  // start (scene + connection) only when the section comes into view: a visitor who never scrolls here takes no simulation
  ui();
  new IntersectionObserver(es => {
    visible = es[0].isIntersecting; if (visible) dirty = 3;
    if (visible && !started) { started = true; build(); connect(); }
  }, { rootMargin: '200px' }).observe(stage);
  window.heLive = { get state() { return st; }, get conn() { return conn; }, get meshes() { return mesh; }, get view() { return view; }, get viewMode() { return viewMode; }, get ready() { return ready; }, get glLost() { return glLost; }, get camFrames() { return camFrames; } };   // for tests
})();

/* Live teleop of the gripper carry policy. The simulation and the policy run on the host machine
 * (~/M2/mjlab/scripts/live_server.py); this client only sends the desired-pose velocity of held keys and draws the
 * frames and measurements the server streams. Keys: arrows = horizontal (camera-relative), W/S = up/down,
 * E/D = yaw, R/F = pitch, T/G = roll. */
(() => {
  'use strict';
  const root = document.getElementById('live-gripper');
  if (!root) return;
  const $ = s => root.querySelector(s);
  const canvas = $('.lg-canvas'), ctx = canvas.getContext('2d');
  // key -> [axis, sign]; axes = [forward, left, up, roll, pitch, yaw]
  const KEYS = {
    ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [1, 1], ArrowRight: [1, -1],
    w: [2, 1], s: [2, -1], t: [3, 1], g: [3, -1], r: [4, 1], f: [4, -1], e: [5, 1], d: [5, -1]
  };
  const held = new Set();
  let ws = null, role = null, connected = false, connecting = false, ended = false, paused = false, unlocked = false;
  let sendTimer = null, lastFrameAt = 0, frames = 0, level = null, endpoint = null;

  const status = (text, kind = 'idle') => { const n = $('.lg-status'); n.textContent = text; n.dataset.kind = kind; };
  const fmt = (v, d = 2) => Number.isFinite(v) ? (v >= 0 ? '+' : '') + v.toFixed(d) : '—';
  const keyOf = e => (e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key);
  const canControl = () => connected && role === 'controller' && !ended && !paused && unlocked;

  function axes() {
    const a = [0, 0, 0, 0, 0, 0];
    for (const k of held) { const m = KEYS[k]; if (m) a[m[0]] += m[1]; }
    return a.map(v => Math.max(-1, Math.min(1, v)));
  }
  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN && role === 'controller') { ws.send(JSON.stringify(msg)); return true; }
    return false;
  }
  function pump() {                       // 20 Hz while keys are held; the server stops the goal 1 s after silence
    if (!held.size) { clearInterval(sendTimer); sendTimer = null; send({type: 'teleop', axes: [0, 0, 0, 0, 0, 0]}); return; }
    if (canControl()) send({type: 'teleop', axes: axes()});
  }
  function press(k) {
    if (!KEYS[k] || held.has(k)) return;
    held.add(k); showKeys();
    if (!sendTimer) { pump(); sendTimer = setInterval(pump, 50); }
  }
  function release(k) { if (held.delete(k)) { showKeys(); if (!held.size) pump(); } }
  function releaseAll() { if (held.size) { held.clear(); showKeys(); pump(); } }
  function showKeys() { root.querySelectorAll('[data-lg-key]').forEach(b => b.classList.toggle('is-held', held.has(b.dataset.lgKey))); }

  function updateControls() {
    $('.lg-connect').textContent = connecting ? 'Connecting…' : connected ? 'Stop' : 'Launch live sim';
    $('.lg-connect').disabled = connecting;
    $('.lg-pause').disabled = !(connected && role === 'controller' && !ended);
    $('.lg-pause').textContent = paused ? 'Resume' : 'Pause';
    $('.lg-reset').disabled = !(connected && role === 'controller');
    root.querySelectorAll('[data-lg-key]').forEach(b => { b.disabled = !canControl(); });
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
      : role === 'controller' ? 'Hold keys (or press the buttons) to move the desired pose. Release to hold it.' : 'Another visitor is driving.';
  }
  function showPose(kind, p) {
    const xyz = (p && p.position) || [];
    ['x', 'y', 'z'].forEach((a, i) => { $(`.lg-${kind}-${a}`).textContent = fmt(xyz[i]); });
    ['roll', 'pitch', 'yaw'].forEach(a => { $(`.lg-${kind}-${a}`).textContent = fmt(p ? p[a + '_deg'] : NaN, 1); });
  }
  function onState(s) {
    role = s.role; ended = !!s.ended; paused = !!s.paused; unlocked = !!s.unlocked; level = s.level;
    showPose('des', s.desired); showPose('mea', s.measured);
    const phase = {grasp: 'Grasping', lift: 'Lifting', teleop: 'Teleop', ended: 'Ended', paused: 'Paused'}[s.phase] || s.phase;
    $('.lg-phase').textContent = phase;
    $('.lg-clock').textContent = s.t.toFixed(1) + ' s';
    $('.lg-err').textContent = (s.tracking_error_m * 100).toFixed(1) + ' cm';
    $('.lg-rtf').textContent = s.rtf ? s.rtf.toFixed(2) + '× real time' : '—';
    $('.lg-rtf').title = s.rtf && s.rtf < 0.9 ? 'Slower than real time: the lab GPU is shared with training runs' : '';
    $('.lg-mass').textContent = s.mass_kg.toFixed(1) + ' kg';
    $('.lg-left').textContent = Math.floor(s.session_left_s / 60) + ':' + String(Math.floor(s.session_left_s % 60)).padStart(2, '0');
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
    role = h.role; level = h.level;
    $('.lg-policy').textContent = h.policy;
    const L = h.limits;
    $('.lg-limits').textContent = `Goal limits at this level: move ≤ ${L.move_m} m, lift ${L.lift_m[0]}–${L.lift_m[1]} m, `
      + `yaw ±${L.yaw_deg}°, roll/pitch ±${L.tilt_deg}°, handles ≤ ${L.bar_z_max_m} m; the load follows at up to `
      + `${L.speed_m_s} m/s and ${L.turn_deg_s}°/s. Session ${Math.round(h.session_limit_s / 60)} min.`;
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
  async function drawFrame(blob) {
    try {
      const bmp = await createImageBitmap(blob);
      if (canvas.width !== bmp.width) { canvas.width = bmp.width; canvas.height = bmp.height; }
      ctx.drawImage(bmp, 0, 0); bmp.close && bmp.close();
      canvas.hidden = false; $('.lg-placeholder').hidden = true;
      frames += 1; lastFrameAt = performance.now();
    } catch (_) { /* a corrupt frame: skip */ }
  }
  function disconnect(message, kind = 'idle') {
    if (ws) { const w = ws; ws = null; try { w.close(); } catch (_) {} }
    connected = false; connecting = false; role = null; releaseAll();
    if (message) status(message, kind);
    if (!frames) { $('.lg-placeholder').hidden = false; }
    updateControls();
  }
  async function connect() {
    connecting = true; updateControls(); status('Finding the live simulation…', 'waiting');
    try {
      const r = await fetch('assets/projects/m2/live-gripper-endpoint.json?t=' + Date.now(), {cache: 'no-store'});
      if (!r.ok) throw new Error('The live endpoint is not published.');
      endpoint = await r.json();
      if (!endpoint.enabled || !endpoint.url) throw new Error(endpoint.message || 'The live simulation is offline.');
      const url = new URL(endpoint.url);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (!['wss:', 'https:'].includes(url.protocol) && !(local && ['ws:', 'http:'].includes(url.protocol))) throw new Error('Insecure endpoint refused.');
      url.protocol = ['wss:', 'https:'].includes(url.protocol) ? 'wss:' : 'ws:';
      url.pathname = url.pathname.replace(/\/$/, '').replace(/\/ws$/, '') + '/ws';
      const sock = new WebSocket(url.href);
      ws = sock; sock.binaryType = 'blob';
      const timer = setTimeout(() => { if (ws === sock && !connected) disconnect(offlineText(), 'error'); }, 8000);
      sock.onopen = () => { clearTimeout(timer); connected = true; connecting = false; status('Connected · preparing the scene', 'live'); updateControls(); };
      sock.onmessage = ev => {
        if (ws !== sock) return;
        if (typeof ev.data !== 'string') { drawFrame(ev.data); return; }
        let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
        if (m.type === 'hello') onHello(m);
        else if (m.type === 'state') onState(m);
        else if (m.type === 'error' && m.message !== 'another visitor has control') status(m.message, 'error');
      };
      sock.onerror = () => { if (ws === sock) disconnect(offlineText(), 'error'); };
      sock.onclose = () => { clearTimeout(timer); if (ws === sock) disconnect(connected ? 'Disconnected.' : offlineText(), connected ? 'idle' : 'error'); };
    } catch (err) {
      disconnect(err.message || offlineText(), 'error');
    }
  }
  function offlineText() {
    const local = endpoint && /127\.0\.0\.1|localhost/.test(endpoint.url || '');
    return local ? 'Live simulation offline — it runs on the lab computer; start it there with scripts/live_up.sh and open this page on that machine. The recorded rollouts above always work.'
      : 'Live simulation offline — the server is not running right now. The recorded rollouts above always work.';
  }

  // ---------------------------------------------------------------- input
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
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();                       // arrows must not scroll the page while driving
    if (canControl()) press(k);
  });
  document.addEventListener('keyup', e => release(keyOf(e)));
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  setInterval(() => {                         // stale stream
    if (connected && frames && !paused && !ended && performance.now() - lastFrameAt > 3000) status('Waiting for the simulation…', 'waiting');
  }, 1000);
  updateControls();
})();

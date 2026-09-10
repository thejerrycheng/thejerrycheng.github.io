/* Interactive references for the live MuJoCo worker. Frames and measurements
 * come from the server; this client never animates or alters robot state. */
(() => {
  'use strict';
  const root = document.getElementById('live-demo');
  if (!root) return;
  const el = id => document.getElementById('live-' + id);
  const canvas = el('canvas'), context = canvas.getContext('2d');
  const held = new Set();
  const keys = {
    w: [0, 1], s: [0, -1], a: [1, 1], d: [1, -1],
    r: [2, 1], f: [2, -1], q: [3, 1], e: [3, -1],
    i: [4, 1], k: [4, -1]
  };
  let socket = null, connecting = false, connected = false, role = null;
  let paused = false, commandReady = false, objectId = null, generation = 0, drawing = false;
  let frameCount = 0, lastState = 0, connectTimer, fetchAbort, stopped = false;

  function status(text, kind = 'idle') {
    el('status').textContent = text;
    el('status').dataset.kind = kind;
  }
  function clearKeys() {
    held.clear();
    root.querySelectorAll('[data-live-key]').forEach(b => b.classList.remove('is-held'));
  }
  function updateControls() {
    const canControl = connected && role === 'controller';
    el('connect').disabled = connecting;
    el('connect').textContent = connecting ? 'Connecting…' : connected ? 'Disconnect' : 'Start live demo';
    el('pause').disabled = !canControl;
    el('pause').textContent = paused ? 'Resume' : 'Pause';
    el('pause').setAttribute('aria-pressed', String(paused));
    el('reset').disabled = !canControl;
    root.querySelectorAll('[data-live-key]').forEach(b => { b.disabled = !canControl || paused || !commandReady; });
    root.querySelectorAll('[data-live-object]').forEach(b => {
      b.disabled = !canControl;
      b.setAttribute('aria-pressed', String(b.dataset.liveObject === objectId));
    });
    root.dataset.controllable = String(canControl && !paused && commandReady);
    el('command-note').textContent = !connected ? 'Pose controls unlock when the simulation is ready.'
      : stopped ? 'The trial stopped. Reset the scene to begin again.'
      : !commandReady ? 'Approaching and lifting; pose control unlocks after support.'
      : paused ? 'Resume the simulation to adjust the reference.' : 'Pose reference control is ready.';
    el('role').textContent = !connected ? 'Not connected' : role === 'controller' ? 'You have control' : 'Watching · another visitor has control';
  }
  function send(message) {
    if (!connected || role !== 'controller' || socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }
  function nudge(names) {
    if (paused || !commandReady) return;
    const command = {type: 'command', translation_delta: [0, 0, 0], pitch_delta_deg: 0, yaw_delta_deg: 0};
    for (const name of names) {
      const key = keys[name];
      if (!key) continue;
      const [axis, sign] = key;
      if (axis < 3) command.translation_delta[axis] += sign * .02;
      else if (axis === 3) command.yaw_delta_deg += sign * 2;
      else command.pitch_delta_deg += sign * 2;
    }
    send(command);
  }
  function format(value, decimals = 2) {
    return Number.isFinite(value) ? (value >= 0 ? '+' : '') + value.toFixed(decimals) : '—';
  }
  function showPose(name, pose) {
    const xyz = pose?.position || [];
    ['x', 'y', 'z'].forEach((axis, i) => { el(name + '-' + axis).textContent = format(xyz[i]); });
    el(name + '-pitch').textContent = format(pose?.pitch_deg, 1);
    el(name + '-yaw').textContent = format(pose?.yaw_deg, 1);
  }
  function populateObjects(objects) {
    el('objects').replaceChildren();
    for (const item of objects || []) {
      if (!item || typeof item.id !== 'string' || typeof item.label !== 'string') continue;
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = item.label;
      button.dataset.liveObject = item.id;
      button.addEventListener('click', () => {
        clearKeys();
        if (send({type: 'reset', object_id: item.id})) status('Preparing ' + item.label.toLowerCase() + '…', 'waiting');
      });
      el('objects').append(button);
    }
  }
  function onMessage(data) {
    if (data.type === 'hello') {
      if (data.protocol !== 1) { disconnect('The demo server needs an interface update.'); return; }
      connected = true; connecting = false; clearTimeout(connectTimer);
      role = data.role === 'controller' ? 'controller' : 'spectator';
      el('policy').textContent = data.controller?.label || 'Controller provenance unavailable';
      el('grasp').textContent = data.controller?.grasp_model || 'Unknown grasp model';
      const limits = data.limits || {};
      el('limits').textContent = Number.isFinite(limits.pitch_deg)
        ? 'Pitch reference limited to ±' + limits.pitch_deg + '°. Translation and height stay inside the server’s operating range.'
        : 'Reference changes stay inside the server’s operating range.';
      populateObjects(data.objects);
      status('Connected · preparing the first measured frame', 'waiting');
      updateControls();
      return;
    }
    if (data.type === 'role') {
      role = data.role === 'controller' ? 'controller' : 'spectator';
      clearKeys(); updateControls(); return;
    }
    if (data.type === 'error') {
      clearKeys(); status(data.message || data.error || 'The server could not accept that request.', 'error'); return;
    }
    if (data.type !== 'state') return;
    lastState = performance.now();
    paused = Boolean(data.paused); commandReady = data.command_ready === true; objectId = data.object_id || objectId;
    stopped = Boolean(data.error) || ['terminated', 'time limit', 'server error'].includes(data.status);
    if (!commandReady || paused) clearKeys();
    showPose('desired', data.desired); showPose('measured', data.measured);
    el('phase').textContent = data.phase || 'Preparing';
    el('clock').textContent = Number.isFinite(data.sim_time) ? data.sim_time.toFixed(1) + ' s' : '—';
    el('rtf').textContent = Number.isFinite(data.rtf) ? data.rtf.toFixed(2) + '× real time' : '—';
    const support = [];
    if (Number.isFinite(data.mass_kg)) support.push(data.mass_kg.toFixed(2) + ' kg');
    for (const [robot, attached] of Object.entries(data.robot_grasps || {})) {
      support.push(robot.toUpperCase() + ': ' + (attached ? 'attached' : 'open'));
    }
    el('support').textContent = support.join(' · ');
    if (data.policy_label) el('policy').textContent = data.policy_label;
    if (data.grasp_model) el('grasp').textContent = data.grasp_model;
    status(data.error || data.status || (paused ? 'Simulation paused' : 'Live simulation'), data.error ? 'error' : paused ? 'waiting' : 'live');
    updateControls();
  }
  async function drawFrame(blob, identity) {
    if (drawing || identity !== generation || !connected) return;
    drawing = true;
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob);
      if (identity !== generation || !connected) return;
      if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
        canvas.width = bitmap.width; canvas.height = bitmap.height;
      }
      context.drawImage(bitmap, 0, 0);
      canvas.hidden = false; el('placeholder').hidden = true;
      canvas.dataset.frames = String(++frameCount);
    } catch (_) {
      if (identity === generation) status('A simulation frame could not be decoded. Waiting for the next one.', 'waiting');
    } finally {
      bitmap?.close(); drawing = false;
    }
  }
  function disconnect(message) {
    generation += 1; clearTimeout(connectTimer); fetchAbort?.abort(); fetchAbort = null;
    clearKeys(); connected = false; connecting = false; role = null;
    const previous = socket; socket = null;
    if (previous) { previous.onclose = null; previous.onerror = null; previous.close(); }
    status(message || (frameCount ? 'Disconnected · last received frame shown' : 'Ready when you are'), 'idle');
    updateControls();
  }
  async function connect() {
    if (connected) { disconnect(); return; }
    if (connecting) return;
    const identity = ++generation;
    connecting = true; frameCount = 0; lastState = 0; paused = false; commandReady = false; stopped = false;
    canvas.hidden = true; el('placeholder').hidden = false;
    el('placeholder-note').textContent = 'Connecting to the MuJoCo simulation…';
    status('Finding the live simulation server…', 'waiting'); updateControls();
    fetchAbort = new AbortController();
    connectTimer = setTimeout(() => disconnect('The simulation server is unavailable. Try again shortly.'), 20000);
    try {
      const response = await fetch('assets/projects/m2/live-demo-endpoint.json?t=' + Date.now(), {cache: 'no-store', signal: fetchAbort.signal});
      if (!response.ok) throw new Error('The live demo endpoint has not been published yet.');
      const endpoint = await response.json();
      if (identity !== generation) return;
      if (!endpoint.enabled || !endpoint.url) throw new Error(endpoint.message || 'The simulation server is offline. Recorded trials remain available below.');
      if (endpoint.schema_version !== 1) throw new Error('The live demo configuration needs an update.');
      const url = new URL(endpoint.url);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (!['https:', 'wss:'].includes(url.protocol) && !(local && ['http:', 'ws:'].includes(url.protocol))) {
        throw new Error('The demo requires a secure simulation connection.');
      }
      url.protocol = ['https:', 'wss:'].includes(url.protocol) ? 'wss:' : 'ws:';
      url.pathname = url.pathname.replace(/\/$/, '') + '/ws'; url.search = ''; url.hash = '';
      socket = new WebSocket(url.href); socket.binaryType = 'blob';
      socket.onopen = () => { if (identity === generation) status('Connected · waiting for the simulation', 'waiting'); };
      socket.onmessage = event => {
        if (identity !== generation) return;
        if (event.data instanceof Blob) { drawFrame(event.data, identity); return; }
        try { onMessage(JSON.parse(event.data)); }
        catch (_) { status('Received an unreadable server message.', 'error'); }
      };
      socket.onerror = () => { if (identity === generation) disconnect('The live server is unreachable. Try again shortly.'); };
      socket.onclose = () => { if (identity === generation) disconnect('Simulation connection closed. Start again to reconnect.'); };
      root.focus({preventScroll: true});
    } catch (error) {
      if (identity !== generation) return;
      disconnect(error.name === 'AbortError' ? 'The simulation connection timed out.' : error.message);
      el('placeholder-note').textContent = 'A running server is needed for live control. Recorded trials remain available on this page.';
    }
  }
  el('connect').addEventListener('click', connect);
  el('pause').addEventListener('click', () => { clearKeys(); send({type: 'pause', paused: !paused}); });
  el('reset').addEventListener('click', () => { clearKeys(); send({type: 'reset', object_id: objectId}); });
  root.querySelectorAll('[data-live-key]').forEach(button => {
    button.addEventListener('click', () => nudge([button.dataset.liveKey]));
  });
  root.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (!keys[key] || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (!connected || role !== 'controller' || paused || !commandReady) return;
    event.preventDefault();
    if (!held.has(key)) nudge([key]);
    held.add(key); root.querySelector('[data-live-key="' + key + '"]')?.classList.add('is-held');
  });
  window.addEventListener('keyup', event => {
    const key = event.key.toLowerCase(); held.delete(key);
    root.querySelector('[data-live-key="' + key.replace(/[^a-z]/g, '') + '"]')?.classList.remove('is-held');
  });
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) clearKeys(); });
  window.addEventListener('blur', clearKeys);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearKeys(); });
  window.addEventListener('pagehide', () => disconnect());
  setInterval(() => { if (held.size) nudge(held); }, 100);
  setInterval(() => {
    if (connected && lastState && performance.now() - lastState > 15000) {
      clearKeys(); status('Waiting for simulation measurements…', 'waiting');
    }
  }, 1000);
  updateControls();
})();

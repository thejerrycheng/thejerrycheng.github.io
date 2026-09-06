/* =============================================================================
   app.js — the IRIS studio application: shots, joint control, task-space
   control with a draggable end-effector, the lens desk, the camera monitor,
   demonstration recording and in-browser policy training. Exposes window.IRIS
   for the video-capture harness (deterministic stepping).
   ============================================================================= */
import * as THREE from 'three';
import { Studio } from './scene.js';
import { evalShot, makeContext, EASE, carPosition } from './shots.js';
import { M4, V3, R3, lookAtRotation, yawPitchRoll, rollAbout, SEEDS_DEG } from './kin.js';
import { LENS, SENSOR, dof, fovH, fovV } from './lens.js';
import { Recorder, Policy, Ensembler, thumbnail, goalVector, HIST, FUT, IMG_W, IMG_H } from './policy.js';

const $ = (id) => document.getElementById(id);
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const fmt = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);

export class App {
  constructor(spec, model, opts = {}) {
    this.spec = spec; this.opts = opts; this.capture = !!opts.capture;
    this.studio = new Studio($('studio-canvas'), spec, model, { capture: this.capture });
    this.studio.setViewports($('view-main'), $('view-feed'));
    this.arm = this.studio.arm; this.lens = this.studio.lens;
    this.mode = 'shots'; this.shot = null; this.tShot = 0; this.playing = false; this.loop = true; this.speed = 1; this.setId = spec.default_set; this.ctx = makeContext(spec, this.setId);
    this.trackingMode = 'gt'; this.gaze = null; this.aimHold = 'lookat'; this.qTarget = this.arm.home.slice(); this.ikInfo = { ok: true, it: 0, posErr: 0 };
    this.recorder = new Recorder(); this.policy = new Policy(spec.shots.length); this.ensembler = new Ensembler(); this.policyRun = null; this.recEvery = false; this.recTimer = 0; this.recAccum = 0;
    this.trailPts = []; this.frame = 0; this.time = 0; this.carRunning = false; this.telemetryLog = []; this.logTelemetry = false;
    this.buildUI(); this.bindKeys();
    this.studio.ready.then(() => { this.setStatus('ready'); this.selectShot(spec.shots[0].id, false); this.studio.syncHandle(); });
    if (!this.capture) { this.last = performance.now(); requestAnimationFrame((t) => this.raf(t)); }
    window.IRIS = this;
  }
  /* ------------------------------------------------------------ UI */
  buildUI() {
    const groups = {}; for (const s of this.spec.shots) (groups[s.group] = groups[s.group] || []).push(s);
    const names = { basics: 'Basics', moves: 'Camera moves', orbits: 'Orbits & arcs', lens: 'The lens', tracking: 'Tracking', combos: 'Combos' };
    $('shot-list').innerHTML = Object.entries(groups).map(([g, list]) => `<div class="shot-group"><div class="shot-group-title">${names[g] || g}</div>${list.map(s => `<button class="shot-btn" data-id="${s.id}" title="${s.blurb || ''}"><span class="shot-name">${s.name}</span><span class="shot-meta">${s.duration}s · ${typeof s.lens.f === 'number' ? s.lens.f + ' mm' : Array.isArray(s.lens.f) ? s.lens.f[0] + '→' + s.lens.f[1] + ' mm' : 'dolly zoom'}</span></button>`).join('')}</div>`).join('');
    $('shot-list').addEventListener('click', (e) => { const b = e.target.closest('.shot-btn'); if (b) { this.selectShot(b.dataset.id, true); } });
    $('set-select').innerHTML = Object.entries(this.spec.sets).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join(''); $('set-select').value = this.setId;
    $('set-select').addEventListener('change', async () => { this.setId = $('set-select').value; this.ctx = makeContext(this.spec, this.setId); this.setStatus('loading ' + this.spec.sets[this.setId].label + '…'); await this.studio.loadSet(this.setId); this.setStatus('ready'); this.gaze = null; });
    /* joints */
    $('joint-sliders').innerHTML = this.arm.names.map((n, i) => `<label class="jrow"><span class="jname">J${i + 1}</span><input type="range" class="jslider" data-i="${i}" min="${this.arm.lo[i] * R2D}" max="${this.arm.hi[i] * R2D}" step="0.5" value="${this.arm.home[i] * R2D}"><span class="jval" id="jval-${i}">${fmt(this.arm.home[i] * R2D, 0)}°</span></label>`).join('');
    $('joint-sliders').addEventListener('input', (e) => { if (!e.target.classList.contains('jslider')) return; this.setMode('joints'); const q = this.studio.q.slice(); q[+e.target.dataset.i] = +e.target.value * D2R; this.qTarget = q; this.studio.setQ(q); this.studio.syncHandle(); this.updateJointUI(); });
    $('btn-home').addEventListener('click', () => { this.setMode('joints'); this.qTarget = this.arm.home.slice(); });
    /* task space */
    $('gizmo-mode').addEventListener('change', () => { this.studio.gizmo.setMode($('gizmo-mode').value); });
    $('aim-mode').addEventListener('change', () => { this.aimHold = $('aim-mode').value; });
    this.studio.gizmo.addEventListener('objectChange', () => { if (this.mode !== 'task') this.setMode('task'); this.solveHandle(); });
    document.querySelectorAll('[data-jog]').forEach(b => { let timer = null; const step = () => this.jog(b.dataset.jog, +b.dataset.amt); b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.setMode('task'); step(); timer = setInterval(step, 60); }); const stop = () => { clearInterval(timer); timer = null; }; b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); });
    /* lens */
    for (const [id, fn] of [['lens-f', (v) => this.lens.zoom.set(+v)], ['lens-focus', (v) => this.lens.focus.set(Math.exp(+v))], ['lens-n', (v) => { this.lens.N = +v; }]]) $(id).addEventListener('input', (e) => { this.manualLens = true; fn(e.target.value); });
    $('btn-af').addEventListener('click', () => { const d = this.subjectDistance(); this.lens.focus.set(d); this.manualLens = true; });
    $('dof-toggle').addEventListener('change', () => { this.studio.dofEnabled = $('dof-toggle').checked; });
    /* transport */
    $('btn-play').addEventListener('click', () => this.togglePlay()); $('btn-restart').addEventListener('click', () => { this.tShot = 0; this.playing = true; this.updateTransport(); });
    $('loop-toggle').addEventListener('change', () => { this.loop = $('loop-toggle').checked; }); $('speed-select').addEventListener('change', () => { this.speed = +$('speed-select').value; });
    $('scrub').addEventListener('input', () => { if (this.shot) { this.tShot = +$('scrub').value / 1000 * this.shot.duration; this.playing = false; this.updateTransport(); } });
    $('tracking-mode').addEventListener('change', () => { this.trackingMode = $('tracking-mode').value; this.gaze = null; });
    /* views */
    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => this.setView(b.dataset.view)));
    document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => this.showTab(b.dataset.tab)));
    /* record & train */
    $('btn-rec').addEventListener('click', () => this.toggleRecord()); $('rec-every').addEventListener('change', () => { this.recEvery = $('rec-every').checked; });
    $('btn-export').addEventListener('click', () => this.exportDataset()); $('file-import').addEventListener('change', (e) => this.importDataset(e.target.files[0]));
    $('btn-clear').addEventListener('click', () => { this.recorder.clear(); this.updateDatasetUI(); });
    $('btn-train').addEventListener('click', () => this.trainPolicy()); $('btn-run-policy').addEventListener('click', () => this.runPolicy()); $('btn-stop-policy').addEventListener('click', () => this.stopPolicy());
    $('btn-demo-all').addEventListener('click', () => this.demoAll());
    this.setView('studio'); this.showTab('shots');
  }
  showTab(name) { document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === name)); document.querySelectorAll('.pane').forEach(p => { p.hidden = p.dataset.pane !== name; }); if (name === 'joints') this.setMode('joints'); if (name === 'task') this.setMode('task'); if (name === 'shots') { /* keep */ } }
  setView(name) { this.view = name; document.body.dataset.view = name; document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === name)); setTimeout(() => this.studio.resize(), 30); }
  setStatus(s) { $('status').textContent = s; }
  setMode(m) {
    if (this.mode === m) return; this.mode = m; this.stopPolicy();
    this.studio.gizmo.enabled = (m === 'task'); this.studio.gizmo.visible = (m === 'task');
    if (m === 'task') { this.studio.syncHandle(); this.qTarget = this.studio.q.slice(); }
    if (m !== 'shots') { this.playing = false; }
    document.body.dataset.mode = m; this.updateTransport();
  }
  /* ------------------------------------------------------------ shots */
  selectShot(id, play) {
    const shot = this.spec.shots.find(s => s.id === id); if (!shot) return;
    this.shot = shot; this.tShot = 0; this.ctx.d0 = undefined; this.gaze = null; this.manualLens = false; this.trailPts = []; this.studio.setTrail(null);
    document.querySelectorAll('.shot-btn').forEach(b => b.classList.toggle('on', b.dataset.id === id));
    $('shot-title').textContent = shot.name; $('shot-blurb').textContent = shot.blurb || ''; $('tracking-row').hidden = shot.aim.type !== 'track';
    this.setMode('shots'); this.playing = !!play; this.updateTransport(); this.studio.setTurntable(0);
    if (this.recEvery && play) this.startRecord();
    this.carRunning = shot.aim.type === 'track';
    if (!this.carRunning) this.studio.updateCar(0);
  }
  togglePlay() { if (this.mode !== 'shots') this.setMode('shots'); this.playing = !this.playing; this.updateTransport(); }
  updateTransport() { $('btn-play').textContent = this.playing ? '❚❚ Pause' : '▶ Play'; if (this.shot) { $('scrub').value = Math.round(this.tShot / this.shot.duration * 1000); $('time-label').textContent = `${fmt(this.tShot, 1)} / ${this.shot.duration.toFixed(1)} s`; } }
  subjectDistance() { const p = this.studio.eePose().pos; const t = this.shot && this.shot.aim.subject && this.shot.aim.type !== 'track' ? this.ctx.subject(this.shot.aim.subject) : (this.shot && this.shot.aim.type === 'track' ? this.ctx.car(this.time) : this.ctx.subject('far')); return V3.norm(V3.sub(t, p)); }
  /** One shot frame: evaluate the preset, solve IK, move the servos. */
  stepShot(dt) {
    const shot = this.shot; if (!shot) return;
    if (this.playing) { this.tShot += dt * this.speed; if (this.tShot >= shot.duration) { if (this.loop) { this.tShot = 0; this.trailPts = []; this.ctx.d0 = undefined; if (this.recorder.recording && this.recEvery) { this.stopRecord(); this.startRecord(); } } else { this.tShot = shot.duration; this.playing = false; if (this.recorder.recording) this.stopRecord(); } } }
    if (this.carRunning) this.studio.updateCar(this.tShot);
    if (shot.turntable) this.studio.setTurntable(2 * Math.PI * EASE[shot.ease || 'linear'](this.tShot / shot.duration));
    this.ctx.t = this.tShot;
    const e = evalShot(shot, this.tShot, this.ctx);
    let R = e.R, target = e.target;
    if (shot.aim.type === 'track' && this.trackingMode === 'vision') { const g = this.visionAim(e.pos); if (g) { R = g.R; target = g.target; } }
    const r = this.arm.ikMulti(e.pos, { R }, this.qTarget); if (r.ok) this.qTarget = r.q; this.ikInfo = r;
    if (!this.manualLens) { this.lens.zoom.set(e.f); this.lens.focus.set(e.S); this.lens.N = e.N; }
    this.aimTarget = target; this.shotEval = e;
    if (this.playing && (this.frame % 3 === 0)) { this.trailPts.push(this.studio.eePose().pos); if (this.trailPts.length > 400) this.trailPts.shift(); if (this.frame % 9 === 0) this.studio.setTrail(this.trailPts); }
  }
  /** Pixel tracker: find the red car in the feed and steer the gaze (yaw/pitch of the optical axis) to centre it. */
  visionAim(pos) {
    if (!this.gaze) { const t = this.ctx.car(this.tShot); const d = V3.unit(V3.sub(t, pos)); this.gaze = { yaw: Math.atan2(d[1], d[0]), pitch: Math.asin(d[2]) }; this.trackErr = null; }
    if (this.frame % 2 === 0) {
      const f = this.studio.readFeed(64, 43); let sx = 0, sy = 0, n = 0;
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) { const i = (y * f.w + x) * 4; const r = f.data[i], g = f.data[i + 1], b = f.data[i + 2]; if (r > 90 && r > 1.7 * g && r > 1.7 * b) { sx += x; sy += y; n++; } }
      if (n >= 3) { const u = sx / n / f.w, v = 1 - sy / n / f.h; this.trackErr = { u: u - 0.5, v: v - 0.5, n }; const kx = fovH(this.lens.f) * D2R, ky = fovV(this.lens.f) * D2R; this.gaze.yaw -= this.trackErr.u * kx * 0.6; this.gaze.pitch -= this.trackErr.v * ky * 0.6; }
      else this.trackErr = { u: 0, v: 0, n: 0 };
    }
    const R = yawPitchRoll(this.gaze.yaw, this.gaze.pitch, 0, pos); const fwd = [R[0][2], R[1][2], R[2][2]]; return { R, target: V3.add(pos, V3.scale(fwd, 0.5)) };
  }
  /* ------------------------------------------------------------ task space */
  solveHandle() {
    const h = this.studio.handlePose(); let opts;
    if (this.aimHold === 'lookat') opts = { lookAt: this.ctx.subject('far') }; else if (this.aimHold === 'lookat-near') opts = { lookAt: this.ctx.subject('near') }; else opts = { R: h.R };
    const r = this.arm.ikMulti(h.pos, opts, this.studio.q); if (r.ok) this.qTarget = r.q; this.ikInfo = r;
    if (this.aimHold !== 'free') { const T = this.arm.fk(r.q); const m = new THREE.Matrix4().set(T[0][0], T[0][1], T[0][2], 0, T[1][0], T[1][1], T[1][2], 0, T[2][0], T[2][1], T[2][2], 0, 0, 0, 0, 1); this.studio.handle.quaternion.setFromRotationMatrix(m); }
  }
  jog(kind, amt) {
    const T = this.arm.fk(this.studio.q); const p = M4.pos(T), R = M4.rot(T); const fwd = [R[0][2], R[1][2], R[2][2]], right = [R[0][0], R[1][0], R[2][0]], up = [-R[0][1], -R[1][1], -R[2][1]];
    let np = p, opts = null;
    if (kind === 'dolly') np = V3.add(p, V3.scale(fwd, amt)); else if (kind === 'truck') np = V3.add(p, V3.scale(right, amt)); else if (kind === 'pedestal') np = V3.add(p, V3.scale(up, amt)); else if (kind === 'x') np = V3.add(p, [amt, 0, 0]); else if (kind === 'y') np = V3.add(p, [0, amt, 0]); else if (kind === 'z') np = V3.add(p, [0, 0, amt]);
    if (kind === 'pan' || kind === 'tilt' || kind === 'roll') { const axis = kind === 'pan' ? [0, 0, 1] : kind === 'tilt' ? right : fwd; const Rn = R3.mul(R3.axisAngle(axis, amt), R); opts = { R: Rn }; this.aimHold = 'free'; $('aim-mode').value = 'free'; }
    else opts = this.aimHold === 'lookat' ? { lookAt: this.ctx.subject('far') } : this.aimHold === 'lookat-near' ? { lookAt: this.ctx.subject('near') } : { R };
    const r = this.arm.ikMulti(np, opts, this.studio.q); if (r.ok) { this.qTarget = r.q; } this.ikInfo = r; this.studio.syncHandle();
  }
  /* ------------------------------------------------------------ recording & policy */
  startRecord() { if (!this.shot) return; this.recorder.start({ shotId: this.shot.id, shotIndex: this.spec.shots.findIndex(s => s.id === this.shot.id), set: this.setId, near: this.ctx.subject('near'), far: this.ctx.subject('far'), t0: Date.now() }); this.recAccum = 0; this.updateDatasetUI(); }
  stopRecord() { const ep = this.recorder.stop(); this.updateDatasetUI(); return ep; }
  toggleRecord() { if (this.recorder.recording) this.stopRecord(); else { if (this.mode === 'shots' && !this.playing) { this.tShot = 0; this.playing = true; this.updateTransport(); } this.startRecord(); } }
  recordFrame(dt) {
    if (!this.recorder.recording) return; this.recAccum += dt; if (this.recAccum < 0.1) return; this.recAccum -= 0.1;
    const img = thumbnail(this.studio.readFeed(64, 43)); this.recorder.push({ t: this.tShot, q: this.studio.q.map(v => +v.toFixed(5)), f: +this.lens.f.toFixed(2), S: +this.lens.S.toFixed(4), img: Array.from(img) });
    if (this.recorder.current.frames.length % 10 === 0) this.updateDatasetUI();
  }
  updateDatasetUI() { const r = this.recorder; $('btn-rec').textContent = r.recording ? '■ Stop recording' : '● Record this shot'; $('btn-rec').classList.toggle('rec', r.recording); $('dataset-stats').innerHTML = `<b>${r.episodes.length}</b> episodes · <b>${r.nFrames}</b> frames${r.recording ? ` · recording ${r.current.frames.length} frames…` : ''}<br><span class="dim">${[...new Set(r.episodes.map(e => e.meta.shotId))].join(', ') || 'no demonstrations yet'}</span>`; }
  exportDataset() { const blob = new Blob([JSON.stringify(this.recorder.toJSON())], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `iris_demos_${Date.now()}.json`; a.click(); }
  async importDataset(file) { if (!file) return; this.recorder.fromJSON(JSON.parse(await file.text())); this.updateDatasetUI(); }
  async demoAll() {
    /* record one demonstration of every preset, back to back, at 3x speed */
    const prevSpeed = this.speed, prevLoop = this.loop; this.speed = 3; this.loop = false; this.recEvery = false;
    for (const s of this.spec.shots) { if (s.aim.type === 'track' && this.trackingMode === 'vision') continue; this.selectShot(s.id, true); this.startRecord(); await new Promise(res => { const chk = () => { if (!this.playing) res(); else setTimeout(chk, 100); }; setTimeout(chk, 200); }); this.stopRecord(); }
    this.speed = prevSpeed; this.loop = prevLoop; $('speed-select').value = String(prevSpeed); this.updateDatasetUI();
  }
  async ensureTF() { if (window.tf) return true; this.setStatus('loading TensorFlow.js…'); await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tensorflow/4.22.0/tf.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); this.setStatus('ready'); return true; }
  async trainPolicy() {
    if (!this.recorder.episodes.length) { $('train-log').textContent = 'Record a few demonstrations first (or press "Demo every preset").'; return; }
    await this.ensureTF(); const { buildSamples } = await import('./policy.js'); const samples = buildSamples(this.recorder.episodes, this.spec.shots.length);
    const epochs = +$('epochs').value; $('train-log').textContent = `${samples.X.length} samples from ${this.recorder.episodes.length} episodes · training ${epochs} epochs…`; $('btn-train').disabled = true;
    const cv = $('loss-canvas'); const draw = () => { const ctx = cv.getContext('2d'); const W = cv.width = cv.clientWidth * 2, H = cv.height = cv.clientHeight * 2; ctx.fillStyle = '#151820'; ctx.fillRect(0, 0, W, H); const L = this.policy.losses; if (!L.length) return; const mx = Math.max(...L.flat()); ctx.lineWidth = 3; for (const [k, col] of [[0, '#4FA3FF'], [1, '#FFCE0A']]) { ctx.strokeStyle = col; ctx.beginPath(); L.forEach((l, i) => { const x = 20 + (W - 40) * i / Math.max(1, epochs - 1), y = H - 16 - (H - 32) * l[k] / mx; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); } ctx.fillStyle = '#F4EAD2'; ctx.font = '22px Space Mono'; ctx.fillText(`loss ${L[L.length - 1][0].toExponential(2)}  val ${L[L.length - 1][1].toExponential(2)}`, 24, 30); };
    try { await this.policy.train(samples, epochs, (ep, logs) => { $('train-log').textContent = `epoch ${ep + 1}/${epochs} · loss ${logs.loss.toExponential(2)} · val ${logs.val_loss.toExponential(2)} · ${this.policy.paramCount()} parameters`; draw(); }); $('train-log').textContent += ' · done. Pick a shot and press "Run the policy".'; $('btn-run-policy').disabled = false; }
    catch (e) { $('train-log').textContent = 'training failed: ' + e.message; }
    $('btn-train').disabled = false;
  }
  runPolicy() {
    if (!this.policy.model || !this.shot) return; this.setMode('policy'); this.ensembler.reset();
    this.policyRun = { hist: [], t: 0, acc: 0, goal: goalVector(this.spec.shots.findIndex(s => s.id === this.shot.id), this.spec.shots.length, this.ctx.subject('near'), this.ctx.subject('far')), duration: this.shot.duration * 1.3, still: 0 };
    this.trailPts = []; this.studio.setTrail(null); this.carRunning = this.shot.aim.type === 'track'; $('policy-status').textContent = 'running…';
  }
  stopPolicy() { if (this.policyRun) { this.policyRun = null; $('policy-status').textContent = 'stopped'; } }
  stepPolicy(dt) {
    const P = this.policyRun; if (!P) return; P.acc += dt; P.t += dt; if (this.carRunning) this.studio.updateCar(P.t);
    if (P.acc < 0.1) return; P.acc -= 0.1;
    const frame = { q: this.studio.q.slice(), f: this.lens.f, S: this.lens.S }; P.hist.push(frame); if (P.hist.length > HIST) P.hist.shift();
    if (P.hist.length < HIST) return;
    const img = thumbnail(this.studio.readFeed(64, 43)); const chunks = this.policy.predict(P.hist, P.goal, img); this.ensembler.push(chunks); const a = this.ensembler.action(); if (!a) return;
    const qn = this.arm.clamp(this.studio.q.map((v, i) => v + a.dq[i])); this.qTarget = qn; this.lens.zoom.set(this.lens.f + a.df); this.lens.focus.set(Math.exp(Math.log(this.lens.S) + a.dlogS));
    const mv = Math.hypot(...a.dq); P.still = mv < 0.002 ? P.still + 0.1 : 0; $('policy-status').textContent = `t ${fmt(P.t, 1)} s · |Δq| ${mv.toExponential(1)} rad/step · f ${fmt(this.lens.f, 0)} mm`;
    if (P.t > P.duration || P.still > 2.5) { $('policy-status').textContent += ' · finished'; this.policyRun = null; }
    if (this.frame % 3 === 0) { this.trailPts.push(this.studio.eePose().pos); this.studio.setTrail(this.trailPts); }
  }
  /* ------------------------------------------------------------ loop */
  raf(now) { requestAnimationFrame((t) => this.raf(t)); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.step(dt); }
  step(dt) {
    this.frame++; this.time += dt;
    if (this.mode === 'shots') this.stepShot(dt); else if (this.mode === 'policy') this.stepPolicy(dt);
    /* joint tracking toward the target with the speed cap */
    const vmax = (this.shot && this.shot.vmax && this.mode === 'shots') ? this.shot.vmax : this.arm.vmax;
    if (this.mode !== 'joints') this.studio.setQ(this.arm.track(this.studio.q, this.qTarget, dt, vmax)); else this.studio.setQ(this.qTarget);
    if (this.mode !== 'task') this.studio.syncHandle();
    this.studio.update(dt); this.recordFrame(dt); this.studio.render(); this.updateHUD();
    if (this.logTelemetry) this.telemetryLog.push(this.telemetry());
  }
  /** Deterministic step for the capture harness. */
  stepFrame(dt = 1 / 30) { this.step(dt); }
  updateHUD() {
    if (this.frame % 4 !== 0 && !this.capture) return;
    const q = this.studio.q; q.forEach((v, i) => { const el = $('jval-' + i); if (el) el.textContent = fmt(v * R2D, 0) + '°'; if (this.mode !== 'joints') { const s = document.querySelector(`.jslider[data-i="${i}"]`); if (s) s.value = v * R2D; } });
    const ee = this.studio.eePose(); const L = this.lens; const d = dof(L.f, L.N, L.S);
    $('hud-ee').textContent = `x ${fmt(ee.pos[0])}  y ${fmt(ee.pos[1])}  z ${fmt(ee.pos[2])} m`;
    $('hud-ik').textContent = this.ikInfo.ok ? `IK ok · ${this.ikInfo.it} it · ${fmt((this.ikInfo.posErr || 0) * 1000, 1)} mm` : `IK: out of reach (${fmt((this.ikInfo.posErr || 0) * 1000, 0)} mm)`; $('hud-ik').classList.toggle('bad', !this.ikInfo.ok);
    $('vf-f').textContent = `${fmt(L.f, 0)} mm`; $('vf-n').textContent = `f/${fmt(L.N, 1)}`; $('vf-s').textContent = L.S > 20 ? '∞' : `${fmt(L.S, 2)} m`; $('vf-dof').textContent = `${fmt(d.near, 2)}–${d.far === Infinity ? '∞' : fmt(d.far, 2)} m`; $('vf-fov').textContent = `${fmt(fovH(L.f), 0)}°`;
    $('vf-tc').textContent = this.tcode(); $('vf-rec').classList.toggle('on', this.recorder.recording || this.logTelemetry);
    $('lens-f').value = L.f; $('lens-focus').value = Math.log(L.S); $('lens-n').value = L.N; $('lens-f-val').textContent = fmt(L.f, 0) + ' mm'; $('lens-focus-val').textContent = (L.S > 20 ? '∞' : fmt(L.S, 2) + ' m'); $('lens-n-val').textContent = 'f/' + fmt(L.N, 1);
    /* the reticle on the aim target */
    const ret = $('vf-reticle'); if (this.aimTarget && this.mode !== 'joints') { const p = this.studio.projectToFeed(this.aimTarget); ret.hidden = !p.inFront; ret.style.left = (p.u * 100) + '%'; ret.style.top = (p.v * 100) + '%'; } else ret.hidden = true;
    const te = $('vf-track'); if (this.trackErr && this.shot && this.shot.aim.type === 'track' && this.trackingMode === 'vision') { te.hidden = false; te.textContent = this.trackErr.n ? `tracker: ${this.trackErr.n} px · err (${fmt(this.trackErr.u * 100, 0)}, ${fmt(this.trackErr.v * 100, 0)}) %` : 'tracker: target lost'; } else te.hidden = true;
    if (this.shot && this.mode === 'shots') this.updateTransport();
  }
  tcode() { const t = this.mode === 'shots' ? this.tShot : this.time; const s = Math.floor(t), f = Math.floor((t - s) * 30); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(f).padStart(2, '0')}`; }
  telemetry() { const ee = this.studio.eePose(); const proj = this.aimTarget ? this.studio.projectToFeed(this.aimTarget) : null; return { t: this.tShot, q: this.studio.q.map(v => +v.toFixed(5)), ee: ee.pos.map(v => +v.toFixed(4)), f: +this.lens.f.toFixed(2), S: +this.lens.S.toFixed(4), N: this.lens.N, ik: this.ikInfo.ok ? 1 : 0, posErr: +(this.ikInfo.posErr || 0).toFixed(5), aim: proj ? [+proj.u.toFixed(4), +proj.v.toFixed(4)] : null, track: this.trackErr ? [this.trackErr.u, this.trackErr.v, this.trackErr.n] : null, car: this.carRunning ? carPosition(this.spec.car, this.tShot) : null }; }
  bindKeys() {
    document.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; if (e.code === 'Space') { e.preventDefault(); this.togglePlay(); } if (e.key === 'r') this.toggleRecord(); if (e.key === 'h') { this.setMode('joints'); this.qTarget = this.arm.home.slice(); } if (e.key === '1') this.setView('studio'); if (e.key === '2') this.setView('monitor'); if (e.key === '3') this.setView('film'); });
  }
}

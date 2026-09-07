/* =============================================================================
   studio_app.js — IRIS Studio.

   The interface a camera operator sees: a set, a monitor, and a strip of
   moments along the bottom. You place the camera by dragging the ball, mark the
   moment, and the arm works out how to be there. Everything on screen is named
   the way a crew names it — stops, framing, zoom, how much blur behind the
   subject — and the robotics stays underneath.

   Exposes window.IRIS for the deterministic capture harness.
   ============================================================================= */
import * as THREE from 'three';
import { Studio } from './scene.js';
import { evalShot, makeContext, EASE, carPosition } from './shots.js';
import { M4, V3, R3, lookAtRotation, yawPitchRoll } from './kin.js';
import { LENS, SENSOR, dof, fovH, fovV } from './lens.js';
import { Timeline, Key } from './timeline.js';
import { Recorder, Policy, Ensembler, thumbnail, goalVector, HIST } from './policy.js';

const $ = (id) => document.getElementById(id);
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const fmt = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/* plain words for the aperture: what the audience actually sees */
const blurWord = (N) => N <= 3.2 ? 'Very soft' : N <= 5 ? 'Soft' : N <= 9 ? 'Some' : N <= 16 ? 'Little' : 'None';
const mm = (f) => Math.round(f) + ' mm';
const metres = (d) => d > 20 ? 'far away' : fmt(d, 2) + ' m';

export class StudioApp {
  constructor(spec, model, opts = {}) {
    this.spec = spec; this.opts = opts; this.capture = !!opts.capture;
    this.studio = new Studio($('studio-canvas'), spec, model, { capture: this.capture });
    this.studio.setViewports($('view-main'), $('view-feed'));
    this.arm = this.studio.arm; this.lens = this.studio.lens;
    this.setId = spec.default_set; this.ctx = makeContext(spec, this.setId);

    this.mode = 'shots';                 /* shots | free | policy   (kept for the harness) */
    this.playMode = 'preset';            /* preset = the exact planned move; timeline = the user's keys */
    this.shot = null; this.tl = null; this.t = 0; this.playing = false; this.loop = true; this.speed = 1;
    this.selKey = null; this.tool = 'move'; this.firstPerson = false;
    this.qTarget = this.arm.home.slice(); this.ikInfo = { ok: true, it: 0, posErr: 0 };
    this.af = true; this.afPoint = { u: 0.5, v: 0.5 }; this.afLocked = false; this.subjectDist = 0.5; this.iso = 400;
    this.trackingMode = 'gt'; this.gaze = null; this.trailPts = [];
    this.frame = 0; this.time = 0; this.carRunning = false;
    this.telemetryLog = []; this.logTelemetry = false;
    this.recorder = new Recorder(); this.policy = new Policy(spec.shots.length); this.ensembler = new Ensembler();
    this.policyRun = null; this.recEvery = false; this.recAccum = 0;
    this._settling = false; this._settleFrames = 0; this._settleWait = 0;

    this.buildUI(); this.bindPointer(); this.bindKeys();
    if (this.capture) {                       /* a recorded clip shows the shot, not the director's furniture */
      this.showPath = false; this.showFrames = false; this.showBeam = false;
      this.studio.gizmo.enabled = false; this.studio.gizmoHelper.visible = false;
      /* frame the rig in the half of the picture the monitor leaves free */
      this.studio.camera.position.set(-0.46, -1.08, 0.74);
      this.studio.controls.target.set(0.30, 0.02, 0.16); this.studio.controls.update();
    }
    this.studio.ready.then(() => { this.setStatus('Ready'); this.selectShot(spec.shots[0].id, false); this.studio.syncHandle(); this.refreshScene(); });
    if (!this.capture) { this.last = performance.now(); requestAnimationFrame((t) => this.raf(t)); }
    window.IRIS = this;
  }
  /* the harness talks in tShot */
  get tShot() { return this.t; } set tShot(v) { this.t = v; }
  get settling() { return !!this._settling; }
  get duration() { return this.playMode === 'timeline' && this.tl ? this.tl.duration : (this.shot ? this.shot.duration : 1); }

  /* ============================================================ interface */
  buildUI() {
    /* ---- presets, grouped, in a drawer ---- */
    const groups = {}; for (const s of this.spec.shots) (groups[s.group] = groups[s.group] || []).push(s);
    const names = { basics: 'The basics', moves: 'Camera moves', orbits: 'Around the subject', lens: 'Lens moves', tracking: 'Follow something', combos: 'Put together' };
    $('preset-grid').innerHTML = Object.entries(groups).map(([g, list]) => `
      <div class="pgroup"><h4>${names[g] || g}</h4><div class="pcards">${list.map(s => `
        <button class="pcard" data-id="${s.id}"><b>${s.name}</b><span>${s.blurb || ''}</span></button>`).join('')}</div></div>`).join('');
    $('preset-grid').addEventListener('click', (e) => { const b = e.target.closest('.pcard'); if (b) { this.selectShot(b.dataset.id, true); this.closeDrawer(); } });
    $('btn-presets').addEventListener('click', () => this.openDrawer('presets'));
    $('btn-teach').addEventListener('click', () => this.openDrawer('teach'));
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.closeDrawer()));

    /* ---- the set ---- */
    $('set-select').innerHTML = Object.entries(this.spec.sets).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
    $('set-select').value = this.setId;
    $('set-select').addEventListener('change', async () => {
      this.setId = $('set-select').value; this.ctx = makeContext(this.spec, this.setId);
      this.setStatus('Changing the set…'); await this.studio.loadSet(this.setId); this.setStatus('Ready'); this.gaze = null; this.refreshScene();
    });

    /* ---- lens ---- */
    this.bindSlider('s-zoom', (v) => { this.manualLens = true; this.lens.zoom.set(v); this.touchKey('f', v); });
    this.bindSlider('s-blur', (v) => { this.manualLens = true; this.lens.N = v; this.touchKey('N', v); });
    this.bindSlider('s-focus', (v) => { this.manualLens = true; this.af = false; this.syncSwitch('sw-af', false); this.lens.focus.set(Math.exp(v)); });
    this.bindSwitch('sw-af', this.af, (on) => { this.af = on; if (on) this.manualLens = false; });
    this.bindSwitch('sw-blur', true, (on) => { this.studio.dofEnabled = on; });

    /* ---- what to show in the set ---- */
    this.bindSwitch('sw-path', true, (on) => { this.showPath = on; this.refreshScene(); });
    this.bindSwitch('sw-frames', true, (on) => { this.showFrames = on; this.refreshScene(); });
    this.bindSwitch('sw-beam', false, (on) => { this.showBeam = on; this.studio.setFrustumVisible(on); this.studio.setProjectedFeedVisible(on); });
    this.showPath = true; this.showFrames = true; this.showBeam = false;

    /* ---- move / aim tool ---- */
    document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => this.setTool(b.dataset.tool)));
    this.studio.gizmo.addEventListener('objectChange', () => this.onHandleDragged());
    this.studio.gizmo.addEventListener('dragging-changed', (e) => { if (!e.value) this.commitKeyEdit(); });

    /* ---- transport ---- */
    $('btn-play').addEventListener('click', () => this.togglePlay());
    $('btn-start').addEventListener('click', () => this.restart());
    this.bindSwitch('sw-loop', true, (on) => { this.loop = on; });
    $('speed').addEventListener('input', () => { this.speed = +$('speed').value; $('speed-val').textContent = fmt(this.speed, 1) + '×'; });
    this.bindSlider('s-smooth', (v) => { if (this.tl) { this.tl.smoothness = v; this.toTimeline(); this.refreshScene(); } });
    $('dur').addEventListener('input', () => { const d = +$('dur').value; $('dur-val').textContent = fmt(d, 1) + ' s'; if (this.tl) { this.tl.setDuration(d); this.toTimeline(); this.t = clamp(this.t, 0, d); this.renderTimeline(); this.refreshScene(); } });

    /* ---- timeline ---- */
    $('btn-addkey').addEventListener('click', () => this.addKeyHere());
    $('btn-delkey').addEventListener('click', () => this.deleteKey());
    $('btn-look').addEventListener('click', () => this.toggleFirstPerson());
    $('btn-reset').addEventListener('click', () => this.selectShot(this.shot.id, false));
    this.bindTrack();

    /* ---- views ---- */
    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => this.setView(b.dataset.view)));
    /* ---- teach panel ---- */
    $('btn-rec').addEventListener('click', () => this.toggleRecord());
    $('btn-demo-all').addEventListener('click', () => this.demoAll());
    $('btn-train').addEventListener('click', () => this.trainPolicy());
    $('btn-run-policy').addEventListener('click', () => this.runPolicy());
    $('btn-export').addEventListener('click', () => this.exportDataset());
    $('file-import').addEventListener('change', (e) => this.importDataset(e.target.files[0]));

    this.setView('studio'); this.setTool('move');
  }
  bindSlider(id, fn) { const el = $(id); el.addEventListener('input', () => fn(+el.value)); }
  bindSwitch(id, initial, fn) { const el = $(id); el.classList.toggle('on', initial); el.addEventListener('click', () => { const on = !el.classList.contains('on'); el.classList.toggle('on', on); fn(on); }); }
  syncSwitch(id, on) { $(id).classList.toggle('on', on); }
  openDrawer(which) { $('drawer').hidden = false; document.querySelectorAll('.dpane').forEach(p => { p.hidden = p.dataset.dpane !== which; }); $('drawer-title').textContent = which === 'presets' ? 'Pick a shot' : 'Teach the robot a shot'; }
  closeDrawer() { $('drawer').hidden = true; }
  setStatus(s) { $('rig-state').textContent = s; }
  toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(this._toast); this._toast = setTimeout(() => t.classList.remove('on'), 2200); }
  setView(name) {
    this.view = name; document.body.dataset.view = name;
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === name));
    $('monitor').classList.toggle('big', name === 'monitor');
    setTimeout(() => this.studio.resize(), 40);
  }
  setTool(t) {
    this.tool = t; document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
    this.studio.gizmo.setMode(t === 'aim' ? 'rotate' : 'translate');
    this.studio.gizmo.enabled = true;
  }

  /* ============================================================ shots */
  selectShot(id, play) {
    const shot = this.spec.shots.find(s => s.id === id); if (!shot) return;
    this.shot = shot; this.t = 0; this.ctx.d0 = undefined; this.gaze = null; this.manualLens = false;
    this.trailPts = []; this.studio.setTrail(null); this.playMode = 'preset'; this.firstPerson = false;
    this.tl = Timeline.fromShot(shot, this.ctx, evalShot, shot.duration > 7 ? 6 : 5);
    this.tl.name = shot.name; this.selKey = this.tl.keys[0].id;
    $('shot-name').value = shot.name; $('shot-note').textContent = shot.blurb || '';
    $('dur').value = shot.duration; $('dur-val').textContent = fmt(shot.duration, 1) + ' s';
    $('s-smooth').value = this.tl.smoothness;
    this.mode = 'shots'; this.playing = !!play; this._settling = true; this._settleFrames = 0; this._settleWait = 0;
    this.studio.setTurntable(0); this.carRunning = shot.aim.type === 'track'; if (!this.carRunning) this.studio.updateCar(0);
    if (this.recEvery && play) this.startRecord();
    this.renderTimeline(); this.refreshScene(); this.updateTransport();
  }
  /** Any edit switches the shot from the planned preset to the user's own keys. */
  toTimeline() { if (this.playMode !== 'timeline') { this.playMode = 'timeline'; $('shot-note').textContent = 'Your version of this shot.'; $('btn-reset').hidden = false; } }
  togglePlay() { this.playing = !this.playing; if (this.playing && this.t >= this.duration - 1e-3) this.t = 0; this.updateTransport(); }
  restart() { this.t = 0; this.playing = true; this._settling = true; this._settleFrames = 0; this._settleWait = 0; this.trailPts = []; this.studio.setTrail(null); this.ctx.d0 = undefined; this.updateTransport(); }

  /* ---- keys ---- */
  get key() { return this.tl ? this.tl.keys.find(k => k.id === this.selKey) : null; }
  selectKey(id, fly = true) {
    this.selKey = id; const k = this.key; if (!k) return;
    this.playing = false; this.t = k.t; this.studio.highlightKey(id); this.renderTimeline(); this.updateTransport();
    if (this.firstPerson) this.flyToKey(k, true); else if (fly) this.flyToKey(k, false);
  }
  addKeyHere() {
    if (!this.tl) return;
    const p = this.studio.eePose(); const fwd = [p.R[0][2], p.R[1][2], p.R[2][2]];
    const k = new Key({ t: this.t, pos: p.pos, look: V3.add(p.pos, V3.scale(fwd, this.subjectDist || 0.5)), f: this.lens.f, S: this.lens.S, N: this.lens.N });
    this.toTimeline(); this.tl.add(k); this.selKey = k.id;
    this.renderTimeline(); this.refreshScene(); this.toast('Stop added');
  }
  deleteKey() {
    if (!this.tl || this.tl.keys.length <= 2) { this.toast('A shot needs at least two stops'); return; }
    this.toTimeline(); this.tl.remove(this.selKey); this.selKey = this.tl.keys[0].id;
    this.renderTimeline(); this.refreshScene(); this.toast('Stop removed');
  }
  /** Called while the ball is dragged: move the selected stop with it. */
  onHandleDragged() {
    const h = this.studio.handlePose();
    const k = this.key;
    if (k && !this.playing) {
      this.toTimeline();
      if (this.tool === 'move') { const d = V3.norm(V3.sub(k.look, k.pos)); const fwd = [h.R[0][2], h.R[1][2], h.R[2][2]]; k.pos = h.pos.slice(); k.look = V3.add(h.pos, V3.scale(fwd, d)); }
      else { const fwd = [h.R[0][2], h.R[1][2], h.R[2][2]]; k.look = V3.add(k.pos, V3.scale(fwd, V3.norm(V3.sub(k.look, k.pos)))); }
      this.t = k.t;
    }
    /* always solve so the arm follows the ball live */
    const r = this.arm.ikMulti(h.pos, { R: h.R }, this.studio.q); if (r.ok) this.qTarget = r.q; this.ikInfo = r;
  }
  commitKeyEdit() { if (this.playMode === 'timeline') { this.renderTimeline(); this.refreshScene(); } }
  touchKey(field, v) { const k = this.key; if (k && !this.playing) { this.toTimeline(); k[field] = v; this.scheduleThumb(k); } }

  /** Fly the studio camera to a stop: either beside it, or right behind the lens. */
  flyToKey(k, firstPerson) {
    const c = this.studio.camera, ctr = this.studio.controls;
    if (firstPerson) { c.position.set(k.pos[0], k.pos[1], k.pos[2]); ctr.target.set(k.look[0], k.look[1], k.look[2]); }
    else {
      const d = V3.unit(V3.sub(k.pos, k.look)); const side = V3.unit([-d[1], d[0], 0]);
      const p = V3.add(V3.add(k.pos, V3.scale(side, 0.42)), [0, 0, 0.16]);
      c.position.set(p[0], p[1], p[2]); ctr.target.set(k.pos[0], k.pos[1], k.pos[2]);
    }
    ctr.update();
  }
  toggleFirstPerson() {
    this.firstPerson = !this.firstPerson; $('btn-look').classList.toggle('on', this.firstPerson);
    $('btn-look').textContent = this.firstPerson ? 'Step back' : 'Stand behind the camera';
    const k = this.key; if (k) this.flyToKey(k, this.firstPerson);
    this.toast(this.firstPerson ? 'You are behind the camera at this stop — drag the ball to reframe' : 'Back to the wide view');
  }

  /* ============================================================ the strip of stops */
  bindTrack() {
    const track = $('tl-track'), inner = $('tl-inner');
    let dragKey = null;
    const timeAt = (ev) => { const r = inner.getBoundingClientRect(); return clamp((ev.clientX - r.left) / r.width, 0, 1) * this.duration; };
    track.addEventListener('pointerdown', (ev) => {
      const chip = ev.target.closest('.tl-key');
      if (chip) { dragKey = +chip.dataset.id; this.selectKey(dragKey, false); track.setPointerCapture(ev.pointerId); this._dragged = false; }
      else { this.playing = false; this.t = timeAt(ev); this.updateTransport(); }
    });
    track.addEventListener('pointermove', (ev) => {
      if (dragKey == null) return; this._dragged = true;
      this.toTimeline(); this.tl.move(dragKey, timeAt(ev)); this.t = timeAt(ev); this.renderTimeline(); this.refreshScene();
    });
    const up = (ev) => { if (dragKey != null && !this._dragged) this.selectKey(dragKey, true); dragKey = null; };
    track.addEventListener('pointerup', up); track.addEventListener('pointercancel', up);
  }
  renderTimeline() {
    if (!this.tl) return;
    const d = this.duration, keys = this.tl.keys;
    const ruler = []; const step = d > 12 ? 4 : d > 6 ? 2 : 1;
    for (let s = 0; s <= d + 1e-6; s += step) ruler.push(`<span style="left:${(s / d * 100).toFixed(2)}%">${s}s</span>`);
    $('tl-ruler').innerHTML = ruler.join('');
    $('tl-keys').innerHTML = keys.map((k, i) => `
      <div class="tl-key${k.id === this.selKey ? ' sel' : ''}" data-id="${k.id}" style="left:${(k.t / d * 100).toFixed(2)}%">
        <canvas width="96" height="64" data-thumb="${k.id}"></canvas><span class="n">${i + 1}</span></div>`).join('');
    this.thumbQueue = keys.slice();
    $('btn-delkey').disabled = keys.length <= 2;
    $('tl-count').textContent = `${keys.length} stops`;
  }
  scheduleThumb(k) { (this.thumbQueue = this.thumbQueue || []).push(k); }
  /** Paint one pending stop thumbnail per frame, so a long shot never stalls the view. */
  drawThumbs() {
    if (!this.thumbQueue || !this.thumbQueue.length || this.capture) return;
    const k = this.thumbQueue.shift(); const cv = document.querySelector(`canvas[data-thumb="${k.id}"]`); if (!cv) return;
    const px = this.studio.keyImage(k, 96, 64); if (!px) return;
    const ctx = cv.getContext('2d'); const img = ctx.createImageData(96, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 96; x++) {          /* the read-back is bottom-up */
      const s = ((63 - y) * 96 + x) * 4, t = (y * 96 + x) * 4;
      img.data[t] = px[s]; img.data[t + 1] = px[s + 1]; img.data[t + 2] = px[s + 2]; img.data[t + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  /** Redraw the path and the floating frames in the set. */
  refreshScene() {
    if (!this.tl) return;
    this.studio.setPath(this.showPath ? this.tl.path(140) : null);
    this.studio.setKeyMarkers(this.showFrames ? this.tl.keys : []);
    if (this.showFrames) { for (const m of this.studio.keyMeshes) { const k = this.tl.keys.find(x => x.id === m.id); if (k) this.studio.renderKeyThumbnail(k, m); } this.studio.highlightKey(this.selKey); }
    this.renderTimeline();
  }

  /* ============================================================ playing */
  settleCheck() {
    const dq = this.arm.wrapDelta(this.qTarget.map((t, i) => t - this.studio.q[i]));
    const worst = Math.max(...dq.map(Math.abs));
    const lens = Math.abs(this.lens.f - this.lens.zoom.target) + Math.abs(this.lens.S - this.lens.focus.target) * 10;
    return worst < 0.004 && lens < 0.5;
  }
  stepShot(dt) {
    if (!this.shot) return;
    const D = this.duration;
    if (this._settling) {
      this.t = 0;
      if (this.settleCheck() && ++this._settleFrames > 3) { this._settling = false; this._settleFrames = 0; }
      else if (++this._settleWait > 900) this._settling = false;
    }
    if (this.playing && !this._settling) {
      this.t += dt * this.speed * (this.playMode === 'timeline' ? this.tl.speed : 1);
      if (this.t >= D) {
        if (this.loop) { this.t = 0; this.trailPts = []; this.ctx.d0 = undefined; if (this.recorder.recording && this.recEvery) { this.stopRecord(); this.startRecord(); } }
        else { this.t = D; this.playing = false; if (this.recorder.recording) this.stopRecord(); }
      }
    }
    if (this.carRunning) this.studio.updateCar(this.t);
    let pos, R, target, f, S, N;
    if (this.playMode === 'preset') {
      if (this.shot.turntable) this.studio.setTurntable(2 * Math.PI * EASE[this.shot.ease || 'linear'](this.t / D));
      this.ctx.t = this.t;
      const e = evalShot(this.shot, this.t, this.ctx);
      pos = e.pos; R = e.R; target = e.target; f = e.f; S = e.S; N = e.N;
      if (this.shot.aim.type === 'track' && this.trackingMode === 'vision') { const g = this.visionAim(pos); if (g) { R = g.R; target = g.target; } }
    } else {
      const s = this.tl.sample(this.t); if (!s) return;
      pos = s.pos; target = s.look; R = lookAtRotation(pos, target);
      if (s.roll) R = R3.mul(R3.axisAngle([R[0][2], R[1][2], R[2][2]], s.roll), R);
      f = s.f; N = s.N; S = s.S == null ? V3.norm(V3.sub(target, pos)) : s.S;
    }
    const r = this.arm.ikMulti(pos, { R }, this.qTarget); if (r.ok) this.qTarget = r.q; this.ikInfo = r;
    if (!this.manualLens) { this.lens.zoom.set(f); this.lens.N = N; if (!this.afDrives) this.lens.focus.set(S); }
    this.aimTarget = target;
    if (this.playing && !this._settling && this.frame % 3 === 0) { this.trailPts.push(this.studio.eePose().pos); if (this.trailPts.length > 400) this.trailPts.shift(); }
  }

  /* ---- autofocus: measure how far the subject is, using the camera's own view ---- */
  stepFocus(dt) {
    this._afTimer = (this._afTimer || 0) + dt;
    if (this._afTimer < 0.12) return; this._afTimer = 0;
    /* where to look: the tracked blob if we have one, else the middle of the frame */
    let u = 0.5, v = 0.5;
    if (this.aimTarget) { const p = this.studio.projectToFeed(this.aimTarget); if (p.inFront) { u = clamp(p.u, 0.08, 0.92); v = clamp(p.v, 0.08, 0.92); } }
    this.afPoint = { u, v };
    const d = this.studio.depthAt(u, v, 0.13);
    if (d && d > 0.05 && d < 25) {
      this.subjectDist = this.subjectDist ? this.subjectDist + (d - this.subjectDist) * 0.5 : d;    /* a little damping, like a real AF */
      if (this.afDrives) this.lens.focus.set(this.subjectDist);
    }
    this.afLocked = Math.abs(this.lens.S - this.subjectDist) / Math.max(this.subjectDist, 0.1) < 0.02;
  }
  /** Autofocus only takes the lens when nothing else has a plan for it: the user's own shot,
      or a preset that asked for focus on the subject. A preset with a written focus track
      (a rack, or a fixed distance chosen for the depth of field) keeps it. */
  get afDrives() { return this.af && !this.manualLens && this.playMode === 'timeline'; }
  /** What the focus is currently obeying, in words. */
  get focusSource() {
    if (this.manualLens) return 'set by hand';
    if (this.playMode === 'timeline') return this.af ? 'following your subject' : 'set by hand';
    return 'following the shot';
  }

  /* ---- the pixel tracker (kept from the experiments; used by the follow presets) ---- */
  visionAim(pos) {
    const T = this.arm.fk(this.studio.q); const fwd = [T[0][2], T[1][2], T[2][2]];
    let yaw = Math.atan2(fwd[1], fwd[0]), pitch = Math.asin(clamp(fwd[2], -1, 1));
    if (!this.gaze) { const t = this.ctx.car(this.t); const d = V3.unit(V3.sub(t, pos)); this.gaze = { yaw: Math.atan2(d[1], d[0]), pitch: Math.asin(d[2]) }; this.trackErr = null; }
    const f = this.studio.readFeed(); const W = f.w, H = f.h, m = this._mask || (this._mask = new Uint8Array(W * H));
    m.fill(0); let count = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; const r = f.data[i], g = f.data[i + 1], bl = f.data[i + 2]; const sum = r + g + bl;
      if (sum > 40 && r / sum > 0.66 && r - Math.max(g, bl) > 35) { m[y * W + x] = 1; count++; }
    }
    let best = null;
    if (count) {
      const seen = this._seen || (this._seen = new Uint8Array(W * H)); seen.fill(0);
      const stack = this._stack || (this._stack = new Int32Array(W * H));
      for (let p0 = 0; p0 < W * H; p0++) {
        if (!m[p0] || seen[p0]) continue;
        let top = 0; stack[top++] = p0; seen[p0] = 1; let n2 = 0, x0 = W, x1 = -1, y0 = H, y1 = -1, red = 0;
        while (top) {
          const p1 = stack[--top]; const x = p1 % W, y = (p1 - x) / W; n2++;
          const j = p1 * 4; red += f.data[j] / Math.max(f.data[j] + f.data[j + 1] + f.data[j + 2], 1);
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          if (x > 0 && m[p1 - 1] && !seen[p1 - 1]) { seen[p1 - 1] = 1; stack[top++] = p1 - 1; }
          if (x < W - 1 && m[p1 + 1] && !seen[p1 + 1]) { seen[p1 + 1] = 1; stack[top++] = p1 + 1; }
          if (y > 0 && m[p1 - W] && !seen[p1 - W]) { seen[p1 - W] = 1; stack[top++] = p1 - W; }
          if (y < H - 1 && m[p1 + W] && !seen[p1 + W]) { seen[p1 + W] = 1; stack[top++] = p1 + W; }
        }
        const chroma = red / n2; const score = n2 < 3 ? 0 : n2 * Math.pow(Math.max(0, chroma - 0.6), 2);
        if (score > 0 && (!best || score > best.score)) best = { score, n: n2, x: (x0 + x1) / 2, y: (y0 + y1) / 2, edge: x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1 };
      }
    }
    if (best && best.n >= 3) {
      const u = best.x / W - 0.5, v = (1 - best.y / H) - 0.5;
      this.trackErr = { u, v, n: best.n, edge: best.edge };
      const aYaw = Math.atan(2 * u * Math.tan(fovH(this.lens.f) * D2R / 2));
      const aPit = Math.atan(2 * v * Math.tan(fovV(this.lens.f) * D2R / 2));
      const k = best.edge ? 0.3 : 1.0;
      this.gaze = { yaw: yaw - k * aYaw, pitch: clamp(pitch - k * aPit, -1.4, 1.4) };
    } else this.trackErr = { u: 0, v: 0, n: 0 };
    const R = yawPitchRoll(this.gaze.yaw, this.gaze.pitch, 0, pos); const f2 = [R[0][2], R[1][2], R[2][2]];
    return { R, target: V3.add(pos, V3.scale(f2, 0.5)) };
  }

  /* ============================================================ teaching */
  startRecord() { if (!this.shot) return; this.recorder.start({ shotId: this.shot.id, shotIndex: this.spec.shots.findIndex(s => s.id === this.shot.id), set: this.setId, near: this.ctx.subject('near'), far: this.ctx.subject('far'), t0: Date.now() }); this.recAccum = 0; this.updateDatasetUI(); }
  stopRecord() { const ep = this.recorder.stop(); this.updateDatasetUI(); return ep; }
  toggleRecord() { if (this.recorder.recording) this.stopRecord(); else { if (!this.playing) this.restart(); this.startRecord(); } }
  recordFrame(dt) {
    if (!this.recorder.recording || this._settling) return; this.recAccum += dt; if (this.recAccum < 0.1) return; this.recAccum -= 0.1;
    const img = thumbnail(this.studio.readFeed());
    this.recorder.push({ t: this.t, q: this.studio.q.map(v => +v.toFixed(5)), f: +this.lens.f.toFixed(2), S: +this.lens.S.toFixed(4), img: Array.from(img) });
    if (this.recorder.current.frames.length % 10 === 0) this.updateDatasetUI();
  }
  updateDatasetUI() {
    const r = this.recorder;
    $('btn-rec').textContent = r.recording ? 'Stop the take' : 'Record this take';
    $('btn-rec').classList.toggle('rec', r.recording);
    $('dataset-stats').innerHTML = `<b>${r.episodes.length}</b> takes · <b>${r.nFrames}</b> moments captured${r.recording ? ` · recording…` : ''}`;
    $('btn-train').disabled = !r.episodes.length;
  }
  exportDataset() { const blob = new Blob([JSON.stringify(this.recorder.toJSON())], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `iris_takes_${Date.now()}.json`; a.click(); }
  async importDataset(file) { if (!file) return; this.recorder.fromJSON(JSON.parse(await file.text())); this.updateDatasetUI(); }
  async demoAll() {
    const prevSpeed = this.speed, prevLoop = this.loop; this.speed = 3; this.loop = false; this.recEvery = false;
    $('train-log').textContent = 'Running every shot once and recording it…';
    for (const s of this.spec.shots) {
      if (s.aim.type === 'track' && this.trackingMode === 'vision') continue;
      this.selectShot(s.id, true); this.startRecord();
      await new Promise(res => { const chk = () => { if (!this.playing) res(); else setTimeout(chk, 100); }; setTimeout(chk, 200); });
      this.stopRecord();
    }
    this.speed = prevSpeed; this.loop = prevLoop; this.updateDatasetUI();
    $('train-log').textContent = 'Done. Now press "Learn from these takes".';
  }
  async ensureTF() { if (window.tf) return true; $('train-log').textContent = 'Getting the learning library…'; await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tensorflow/4.22.0/tf.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); return true; }
  async trainPolicy() {
    if (!this.recorder.episodes.length) { $('train-log').textContent = 'Record a few takes first.'; return; }
    await this.ensureTF(); const { buildSamples } = await import('./policy.js');
    const samples = buildSamples(this.recorder.episodes, this.spec.shots.length);
    const epochs = +$('epochs').value; $('btn-train').disabled = true;
    try {
      await this.policy.train(samples, epochs, (ep, logs) => { $('train-log').textContent = `Learning… pass ${ep + 1} of ${epochs}. It is off by ${(Math.sqrt(logs.loss) * 1000).toFixed(1)} thousandths on the practice takes.`; });
      $('train-log').textContent = 'Learned. Close this, pick a shot, and press "Let it try".';
      $('btn-run-policy').disabled = false;
    } catch (e) { $('train-log').textContent = 'Learning failed: ' + e.message; }
    $('btn-train').disabled = false;
  }
  runPolicy() {
    if (!this.policy.model || !this.shot) return;
    this.mode = 'policy'; this.ensembler.reset(); this.closeDrawer();
    this.policyRun = { hist: [], t: 0, acc: 0, goal: goalVector(this.spec.shots.findIndex(s => s.id === this.shot.id), this.spec.shots.length, this.ctx.subject('near'), this.ctx.subject('far')), duration: this.shot.duration, still: 0 };
    this.trailPts = []; this.studio.setTrail(null); this.carRunning = this.shot.aim.type === 'track';
    this.toast('The robot is flying this one on its own');
  }
  stopPolicy() { if (this.policyRun) { this.policyRun = null; this.mode = 'shots'; } }
  stepPolicy(dt) {
    const P = this.policyRun; if (!P) return; P.acc += dt; P.t += dt; this.t = P.t; if (this.carRunning) this.studio.updateCar(P.t);
    if (P.acc < 0.1) return; P.acc -= 0.1;
    P.hist.push({ q: this.studio.q.slice(), f: this.lens.f, S: this.lens.S }); if (P.hist.length > HIST) P.hist.shift();
    if (P.hist.length < HIST) return;
    const img = thumbnail(this.studio.readFeed()); const chunks = this.policy.predict(P.hist, P.goal, img);
    this.ensembler.push(chunks); const a = this.ensembler.action(); if (!a) return;
    this.qTarget = this.arm.clamp(this.studio.q.map((v, i) => v + a.dq[i]));
    this.lens.zoom.set(this.lens.f + a.df); this.lens.focus.set(Math.exp(Math.log(this.lens.S) + a.dlogS));
    const mv = Math.hypot(...a.dq); P.still = mv < 0.002 ? P.still + 0.1 : 0;
    if (P.t > P.duration || P.still > 2.5) { this.policyRun = null; this.mode = 'shots'; this.toast('That was the robot on its own'); }
  }

  /* ============================================================ loop */
  raf(now) { requestAnimationFrame((t) => this.raf(t)); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.step(dt); }
  step(dt) {
    this.frame++; this.time += dt;
    if (this.mode === 'policy') this.stepPolicy(dt); else this.stepShot(dt);
    const vmax = (this.shot && this.shot.vmax && this.playMode === 'preset') ? this.shot.vmax : this.arm.vmax;
    this.studio.setQ(this.arm.track(this.studio.q, this.qTarget, dt, vmax));
    if (!this.studio.gizmo.dragging) this.studio.syncHandle();
    this.studio.update(dt);
    this.stepFocus(dt);
    if (this.showBeam) this.studio.updateProjection(this.subjectDist);
    if (this.playing && this.frame % 9 === 0 && this.trailPts.length > 2) this.studio.setTrail(this.trailPts);
    this.recordFrame(dt);
    this.studio.render();
    this.drawThumbs();
    this.updatePanels();
    if (this.logTelemetry) this.telemetryLog.push(this.telemetry());
  }
  stepFrame(dt = 1 / 30) { this.step(dt); }

  /* ============================================================ readouts */
  updatePanels() {
    if (this.frame % 3 !== 0 && !this.capture) return;
    const L = this.lens, d = dof(L.f, L.N, L.S);
    /* the lens card */
    $('v-zoom').textContent = mm(L.f); $('s-zoom').value = L.f;
    $('v-blur').textContent = blurWord(L.N); $('v-blur-n').textContent = 'f/' + fmt(L.N, 1); $('s-blur').value = L.N;
    $('v-focus').textContent = metres(L.S); if (!this._focusDrag) $('s-focus').value = Math.log(L.S);
    $('v-sharp').textContent = `${fmt(d.near, 2)} m to ${d.far === Infinity ? 'far away' : fmt(d.far, 2) + ' m'} is sharp`;
    $('v-focus-src').textContent = this.focusSource + (this.subjectDist ? ` · your subject is ${fmt(this.subjectDist, 2)} m away` : '');
    $('v-fov').textContent = `sees ${fmt(fovH(L.f), 0)}° across`;
    /* the rig card */
    const ok = this.ikInfo.ok;
    $('rig-reach').className = 'pill' + (ok ? '' : ' bad'); $('rig-reach').innerHTML = `<i class="dot"></i>${ok ? 'Every position reachable' : 'This spot is out of reach'}`;
    $('rig-state').textContent = this._settling ? 'Moving into place' : this.playing ? 'Rolling' : 'Ready';
    $('rig-motors').innerHTML = `<i class="dot"></i>All six motors healthy`;
    /* the monitor overlay */
    $('m-zoom').textContent = mm(L.f); $('m-blur').textContent = 'f/' + fmt(L.N, 1); $('m-iso').textContent = 'ISO ' + this.iso;
    $('m-focus').textContent = metres(L.S); $('m-tc').textContent = this.tcode();
    $('m-rec').classList.toggle('on', this.recorder.recording || this.logTelemetry);
    const box = $('af-box');
    if (this.af && !this.capture) {
      box.hidden = false; const s = 13;
      box.style.left = `calc(${(this.afPoint.u * 100).toFixed(1)}% - ${s}px)`; box.style.top = `calc(${(this.afPoint.v * 100).toFixed(1)}% - ${s}px)`;
      box.style.width = box.style.height = (2 * s) + 'px'; box.classList.toggle('locked', this.afLocked);
    } else box.hidden = true;
    /* the playhead */
    const D = this.duration;
    $('tl-play').style.left = (clamp(this.t / D, 0, 1) * 100).toFixed(2) + '%';
    $('t-now').textContent = fmt(this.t, 1); $('t-total').textContent = fmt(D, 1);
    this.updateTransport();
  }
  updateTransport() {
    const b = $('btn-play'); b.innerHTML = this.playing ? '<b>❚❚</b> Pause' : '<b>▶</b> Play';
    $('tl-state').textContent = this._settling ? 'Moving into place…' : this.playMode === 'timeline' ? 'Your shot' : 'Preset shot';
  }
  tcode() { const t = this.t; const s = Math.floor(t), f = Math.floor((t - s) * 30); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(f).padStart(2, '0')}`; }
  telemetry() {
    const ee = this.studio.eePose(); const proj = this.aimTarget ? this.studio.projectToFeed(this.aimTarget) : null;
    return { t: this.t, q: this.studio.q.map(v => +v.toFixed(5)), ee: ee.pos.map(v => +v.toFixed(4)), f: +this.lens.f.toFixed(2), S: +this.lens.S.toFixed(4), N: this.lens.N, ik: this.ikInfo.ok ? 1 : 0, posErr: +(this.ikInfo.posErr || 0).toFixed(5), aim: proj ? [+proj.u.toFixed(4), +proj.v.toFixed(4)] : null, track: this.trackErr ? [this.trackErr.u, this.trackErr.v, this.trackErr.n] : null, car: this.carRunning ? carPosition(this.spec.car, this.t) : null };
  }
  /* clicking in the picture sets where the camera focuses */
  bindPointer() {
    const mon = $('view-feed');
    mon.addEventListener('pointerdown', (ev) => {
      const r = mon.getBoundingClientRect();
      this.afPoint = { u: clamp((ev.clientX - r.left) / r.width, 0, 1), v: clamp((ev.clientY - r.top) / r.height, 0, 1) };
      const d = this.studio.depthAt(this.afPoint.u, this.afPoint.v, 0.1);
      if (d) { this.subjectDist = d; this.lens.focus.set(d); this.toast(`Focused on what is ${fmt(d, 2)} m away`); }
    });
    /* clicking a floating frame in the set opens that stop */
    const cv = $('studio-canvas');
    cv.addEventListener('click', (ev) => {
      if (this.studio.gizmo.dragging) return;
      const r = cv.getBoundingClientRect();
      const id = this.studio.pickKey(((ev.clientX - r.left) / r.width) * 2 - 1, -(((ev.clientY - r.top) / r.height) * 2 - 1));
      if (id != null) this.selectKey(id, true);
    });
  }
  bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); this.togglePlay(); }
      if (e.key === 'k') this.addKeyHere();
      if (e.key === 'Backspace') this.deleteKey();
      if (e.key === 'f') this.toggleFirstPerson();
      if (e.key === '1') this.setView('studio'); if (e.key === '2') this.setView('monitor'); if (e.key === '3') this.setView('film');
      if (e.key === 'Escape') this.closeDrawer();
    });
  }
}

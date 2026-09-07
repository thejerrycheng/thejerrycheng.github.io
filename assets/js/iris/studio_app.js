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

const SPEED_MIN = 0.25, SPEED_MAX = 3;

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
      this.showGizmo(false);
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
    $('btn-cut').addEventListener('click', () => this.cutHere());
    $('btn-label').addEventListener('click', () => this.labelKey());
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

    this.buildRightPanel();
    this.buildCameraControls();
    this.bindSpeedGraph();
    this.setView('studio'); this.setTool('move');
  }

  /* ============================================================ the right panel
     The presets live here as a plain list rather than behind a drawer, next to the two control modes
     the arm actually has: task space (drag or jog the lens where you want it, the solver finds the
     joints) and joint space (drive the six motors directly). */
  buildRightPanel() {
    const groups = {}; for (const sh of this.spec.shots) (groups[sh.group] = groups[sh.group] || []).push(sh);
    const names = { basics: 'The basics', moves: 'Camera moves', orbits: 'Around the subject', lens: 'Lens moves', tracking: 'Follow something', combos: 'Put together' };
    $('shot-list').innerHTML = Object.entries(groups).map(([g, list]) =>
      `<div class="sgroup">${names[g] || g}</div>` +
      list.map(sh => `<button data-id="${sh.id}">${sh.name}</button>`).join('')).join('');
    $('shot-list').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (b) this.selectShot(b.dataset.id, true); });

    $('gizmo-mode').addEventListener('change', () => this.setTool($('gizmo-mode').value === 'rotate' ? 'aim' : 'move'));
    $('aim-mode').addEventListener('change', () => { this.aimHold = $('aim-mode').value; });
    this.aimHold = 'lookat';
    $('tracking-mode').addEventListener('change', () => { this.trackingMode = $('tracking-mode').value; this.gaze = null; });

    $('joint-sliders').innerHTML = this.arm.names.map((n, i) =>
      `<label class="jrow"><span class="jname">J${i + 1}</span>` +
      `<input type="range" class="jslider" data-i="${i}" min="${(this.arm.lo[i] * 180 / Math.PI).toFixed(0)}" max="${(this.arm.hi[i] * 180 / Math.PI).toFixed(0)}" step="0.5" value="${(this.arm.home[i] * 180 / Math.PI).toFixed(1)}">` +
      `<span class="jval" id="jval-${i}">${fmt(this.arm.home[i] * 180 / Math.PI, 0)}°</span></label>`).join('');
    $('joint-sliders').addEventListener('input', (e) => {
      if (!e.target.classList.contains('jslider')) return;
      this.playing = false;                                   /* driving a joint is a manual override */
      const q = this.studio.q.slice(); q[+e.target.dataset.i] = +e.target.value * Math.PI / 180;
      this.qTarget = q; this.studio.setQ(q); this.studio.syncHandle(); this.selKey = null; this.studio.highlightKey(null);
    });
    $('btn-home').addEventListener('click', () => { this.playing = false; this.selKey = null; this.qTarget = this.arm.home.slice(); });

    for (const b of document.querySelectorAll('[data-jog]')) {
      const fire = () => this.jog(b.dataset.jog, +b.dataset.amt * this.jogStep(b.dataset.jog));
      b.addEventListener('click', fire);
      b.addEventListener('pointerdown', () => { this._jogT = setTimeout(() => { this._jogI = setInterval(fire, 70); }, 380); });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel'])
        b.addEventListener(ev, () => { clearTimeout(this._jogT); clearInterval(this._jogI); });
    }
  }
  jogStep(kind) {
    const s = this._mcStep || 1;                              /* 1 unit = 1 cm of travel, 1 degree of turn */
    return (kind === 'pan' || kind === 'tilt' || kind === 'roll') ? s * Math.PI / 180 : s * 0.01;
  }
  /** Nudge the camera in its own frame. With a stop selected the stop moves; otherwise the arm does. */
  jog(kind, amt) {
    const k = this.editingKey() ? this.key : null;
    const base = k ? { pos: k.pos.slice(), R: k.R } : (() => { const T = this.arm.fk(this.studio.q); return { pos: [T[0][3], T[1][3], T[2][3]], R: [[T[0][0], T[0][1], T[0][2]], [T[1][0], T[1][1], T[1][2]], [T[2][0], T[2][1], T[2][2]]] }; })();
    const R = base.R, fwd = [R[0][2], R[1][2], R[2][2]], right = [R[0][0], R[1][0], R[2][0]], up = [-R[0][1], -R[1][1], -R[2][1]];
    let pos = base.pos, Rn = R;
    if (kind === 'dolly') pos = V3.add(pos, V3.scale(fwd, amt));
    else if (kind === 'truck') pos = V3.add(pos, V3.scale(right, amt));
    else if (kind === 'pedestal') pos = V3.add(pos, V3.scale(up, amt));
    else { const axis = kind === 'pan' ? [0, 0, 1] : kind === 'tilt' ? right : fwd; Rn = R3.mul(R3.axisAngle(axis, amt), R); }
    if (k) {
      this.toTimeline();
      const d = V3.norm(V3.sub(k.look, k.pos));
      k.pos = pos; k.look = V3.add(pos, V3.scale([Rn[0][2], Rn[1][2], Rn[2][2]], d));
      this.gizmoOnKey(); this.scheduleThumb(k); this.renderTimeline(); this.refreshScene();
    } else {
      const r = this.arm.ikMulti(pos, { R: Rn }, this.studio.q); if (r.ok) this.qTarget = r.q; this.ikInfo = r; this.studio.syncHandle();
    }
  }

  /* ============================================================ the camera's controls, by the monitor */
  buildCameraControls() {
    this._mcStep = 1;
    $('mc-step').addEventListener('input', () => {
      this._mcStep = +$('mc-step').value;
      $('mc-step-v').textContent = `${fmt(this._mcStep, 1)} cm · ${fmt(this._mcStep, 1)}°`;
    });
    const lensSlider = (id, apply) => $(id).addEventListener('input', () => apply(+$(id).value));
    lensSlider('mc-zoom', (v) => { this.manualLens = true; this.lens.zoom.set(v); this.touchKey('f', v); $('s-zoom').value = v; });
    lensSlider('mc-ap', (v) => { this.manualLens = true; this.lens.N = v; this.touchKey('N', v); $('s-blur').value = v; });
    lensSlider('mc-focus', (v) => {
      this.manualLens = true; this.af = false; this.syncSwitch('sw-af', false);
      this.lens.focus.set(Math.exp(v)); this.touchKey('S', Math.exp(v)); $('s-focus').value = v;
    });
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
    this.showGizmo(true);
  }
  /** The ball and its arrows are for the operator. A recorded clip must never contain them, so every
      place that turns them on goes through here rather than setting the flags itself. */
  showGizmo(on) {
    const v = !!on && !this.capture;
    this.studio.gizmo.enabled = v;
    this.studio.gizmoHelper.visible = v;
    if (this.studio.ball) this.studio.ball.visible = v;
  }

  /* ============================================================ shots */
  selectShot(id, play) {
    const shot = this.spec.shots.find(s => s.id === id); if (!shot) return;
    this.shot = shot; this.t = 0; this.ctx.d0 = undefined; this.gaze = null; this.manualLens = false;
    this.trailPts = []; this.studio.setTrail(null); this.playMode = 'preset'; this.firstPerson = false;
    this.tl = Timeline.fromShot(shot, this.ctx, evalShot, shot.duration > 7 ? 6 : 5);
    this.tl.name = shot.name; this.selKey = this.tl.keys[0].id;
    $('shot-name').value = shot.name; $('shot-note').textContent = shot.blurb || '';
    const blurb = $('shot-blurb'); if (blurb) blurb.textContent = shot.blurb || '';
    document.querySelectorAll('#shot-list button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
    const trow = $('tracking-row'); if (trow) trow.hidden = shot.aim.type !== 'track';
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
  /** Select a stop. The viewer's own camera never moves for this — the user's viewpoint is theirs.
      The gizmo goes to the stop instead, so the stop itself is what you drag. */
  selectKey(id) {
    this.selKey = id; const k = this.key; if (!k) return;
    this.playing = false; this.t = k.t; this.studio.highlightKey(id); this.renderTimeline(); this.updateTransport();
    this.gizmoOnKey();
    if (this.firstPerson) this.flyToKey(k, true);
  }
  /** True while the gizmo is parked on a selected stop rather than on the arm's end effector. */
  editingKey() { return !!(this.key && !this.playing); }
  gizmoOnKey() {
    const k = this.key; if (!k) return;
    this.studio.setHandlePose(k.pos, k.R);
    this.showGizmo(true);
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
  /** Split the move at the playhead. The new stop holds exactly the state the shot already has there,
      so the picture does not change — the move simply becomes two segments you can retime apart. */
  cutHere() {
    if (!this.tl) return;
    this.toTimeline();
    const k = this.tl.splitAt(this.t, this.tl.sample(this.t));
    if (!k) return;
    this.selKey = k.id; this.renderTimeline(); this.refreshScene(); this.scheduleThumb(k);
    this.toast('Cut — the move is now two segments');
  }
  /** Name a stop, the way you would label a marker in an edit. */
  labelKey() {
    const k = this.key; if (!k) { this.toast('Select a stop first'); return; }
    const name = window.prompt('Name this stop', k.label || '');
    if (name === null) return;
    this.toTimeline(); k.label = name.trim(); this.renderTimeline();
  }
  /* ---- the speed ramp: one point per stop, straight lines between, dragged vertically ---- */
  bindSpeedGraph() {
    const cv = $('tl-speed'); if (!cv) return;
    const at = (ev) => { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height }; };
    const nearest = (x) => {
      if (!this.tl) return null; const d = this.duration; let best = null, bd = 1e9;
      for (const k of this.tl.keys) { const dx = Math.abs(k.t / d - x); if (dx < bd) { bd = dx; best = k; } }
      return bd < 0.06 ? best : null;
    };
    let drag = null;
    cv.addEventListener('pointerdown', (ev) => {
      const { x, y } = at(ev); drag = nearest(x); if (!drag) return;
      cv.setPointerCapture(ev.pointerId); this.selectKey(drag.id); this.setSpeedFrom(drag, y);
    });
    cv.addEventListener('pointermove', (ev) => { if (!drag) return; this.setSpeedFrom(drag, at(ev).y); });
    const end = () => { drag = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('dblclick', (ev) => { const k = nearest(at(ev).x); if (k) { this.toTimeline(); k.speed = 1; this.drawSpeedGraph(); } });
    new ResizeObserver(() => this.drawSpeedGraph()).observe(cv);
  }
  setSpeedFrom(k, y) {
    this.toTimeline();
    k.speed = clamp(SPEED_MAX - (SPEED_MAX - SPEED_MIN) * clamp(y, 0, 1), SPEED_MIN, SPEED_MAX);
    this.drawSpeedGraph(); $('sp-hint').textContent = `stop ${this.tl.index(k.id) + 1} at ${fmt(k.speed, 2)}×`;
  }
  drawSpeedGraph() {
    const cv = $('tl-speed'); if (!cv || !this.tl) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 600, h = cv.clientHeight || 54;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const d = this.duration;
    const X = (t) => (t / d) * w, Y = (v) => (SPEED_MAX - v) / (SPEED_MAX - SPEED_MIN) * h;
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1;                      /* the 1x line */
    g.beginPath(); g.moveTo(0, Y(1)); g.lineTo(w, Y(1)); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.font = '9px ui-monospace, monospace';
    g.fillText('1.0×', 4, Y(1) - 3);
    const keys = this.tl.keys;
    g.strokeStyle = '#0a84ff'; g.lineWidth = 2; g.beginPath();
    keys.forEach((k, i) => { const x = X(k.t), y = Y(k.speed || 1); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
    keys.forEach((k) => {
      const x = X(k.t), y = Y(k.speed || 1); const on = k.id === this.selKey;
      g.fillStyle = on ? '#ffd60a' : '#0a84ff'; g.beginPath(); g.arc(x, y, on ? 5 : 4, 0, 2 * Math.PI); g.fill();
    });
    g.strokeStyle = 'rgba(255,214,10,.8)'; g.lineWidth = 1.5;                      /* the playhead */
    g.beginPath(); g.moveTo(X(this.t), 0); g.lineTo(X(this.t), h); g.stroke();
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
      if (chip) { dragKey = +chip.dataset.id; this.selectKey(dragKey); track.setPointerCapture(ev.pointerId); this._dragged = false; }
      else { this.playing = false; this.t = timeAt(ev); this.updateTransport(); }
    });
    track.addEventListener('pointermove', (ev) => {
      if (dragKey == null) return; this._dragged = true;
      this.toTimeline(); this.tl.move(dragKey, timeAt(ev)); this.t = timeAt(ev); this.renderTimeline(); this.refreshScene();
    });
    const up = (ev) => { if (dragKey != null && !this._dragged) this.selectKey(dragKey); dragKey = null; };
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
        <canvas width="96" height="64" data-thumb="${k.id}"></canvas><span class="n">${i + 1}</span>${k.label ? `<span class="kname">${k.label}</span>` : ''}</div>`).join('');
    this.thumbQueue = keys.slice();
    $('btn-delkey').disabled = keys.length <= 2;
    $('tl-count').textContent = `${keys.length} stops`;
    this.drawSpeedGraph();
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
      /* the speed ramp: the clock runs at the rate the graph asks for at this moment */
      const ramp = this.playMode === 'timeline' ? this.tl.speed * this.tl.speedAt(this.t) : 1;
      this.t += dt * this.speed * ramp;
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
    if (!this.studio.gizmo.dragging) { if (this.editingKey()) this.gizmoOnKey(); else this.studio.syncHandle(); }
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
    /* the right panel: where the lens is, whether the solver got there, and the six joints */
    const ee = this.studio.eePose();
    $('hud-ee').textContent = `${fmt(ee.pos[0], 3)}  ${fmt(ee.pos[1], 3)}  ${fmt(ee.pos[2], 3)} m`;
    $('hud-ik').textContent = ok ? `solved · ${fmt((this.ikInfo.posErr || 0) * 1000, 1)} mm` : `out of reach · ${fmt((this.ikInfo.posErr || 0) * 1000, 0)} mm`;
    $('hud-ik').classList.toggle('bad', !ok);
    this.studio.q.forEach((v, i) => {
      const lab = $('jval-' + i); if (lab) lab.textContent = fmt(v * 180 / Math.PI, 0) + '°';
      const sl = document.querySelector(`.jslider[data-i="${i}"]`); if (sl && document.activeElement !== sl) sl.value = v * 180 / Math.PI;
    });
    /* the camera's own controls mirror the lens, unless a slider is being dragged */
    if (document.activeElement !== $('mc-zoom')) $('mc-zoom').value = L.f;
    if (document.activeElement !== $('mc-ap')) $('mc-ap').value = L.N;
    if (document.activeElement !== $('mc-focus')) $('mc-focus').value = Math.log(L.S);
    $('mc-zoom-v').textContent = mm(L.f); $('mc-ap-v').textContent = 'f/' + fmt(L.N, 1); $('mc-focus-v').textContent = metres(L.S);
    const selK = this.key;
    $('mc-target').textContent = this.editingKey() && selK ? `stop ${this.tl.index(selK.id) + 1}${selK.label ? ' · ' + selK.label : ''}` : 'the whole shot';
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
      if (id != null) this.selectKey(id);
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

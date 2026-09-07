/* =============================================================================
   timeline.js — the shot as a list of key moments.

   A key moment holds where the camera is, where it points, and how the lens is
   set. Playing the shot interpolates between them: a Catmull-Rom spline through
   the positions so the move curves naturally, spherical interpolation of the
   aiming, and eased timing per segment. Speed and smoothness are single numbers
   a filmmaker can feel: speed scales the clock, smoothness blends between a
   linear move and a fully eased one.
   ============================================================================= */
import { V3, R3, lookAtRotation, smoothstep } from './kin.js';

let nextId = 1;

export class Key {
  constructor({ t = 0, pos = [0.4, 0, 0.2], look = [0.4, 0, 0.05], roll = 0, f = 35, S = null, N = 4, hold = 0, name = '' } = {}) {
    this.id = nextId++; this.t = t; this.pos = pos.slice(); this.look = look.slice(); this.roll = roll;
    this.f = f; this.S = S; this.N = N; this.hold = hold; this.name = name;
  }
  get R() { return lookAtRotation(this.pos, this.look); }
  get distance() { return V3.norm(V3.sub(this.look, this.pos)); }
  clone() { const k = new Key(this); k.id = nextId++; return k; }
  toJSON() { return { t: this.t, pos: this.pos, look: this.look, roll: this.roll, f: this.f, S: this.S, N: this.N, hold: this.hold, name: this.name }; }
}

/** Catmull-Rom through p0..p3 at u, with a tension that keeps it from overshooting. */
function catmull(p0, p1, p2, p3, u, tension = 0.5) {
  const u2 = u * u, u3 = u2 * u; const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const m1 = tension * (p2[i] - p0[i]), m2 = tension * (p3[i] - p1[i]);
    out[i] = (2 * p1[i] - 2 * p2[i] + m1 + m2) * u3 + (-3 * p1[i] + 3 * p2[i] - 2 * m1 - m2) * u2 + m1 * u + p1[i];
  }
  return out;
}

export class Timeline {
  constructor(keys = [], opts = {}) {
    this.keys = keys; this.speed = opts.speed ?? 1; this.smoothness = opts.smoothness ?? 0.85;
    this.name = opts.name || 'Untitled shot'; this.listeners = [];
  }
  onChange(fn) { this.listeners.push(fn); }
  changed() { for (const f of this.listeners) f(this); }
  get duration() { return this.keys.length ? Math.max(0.1, this.keys[this.keys.length - 1].t) : 0; }
  sort() { this.keys.sort((a, b) => a.t - b.t); }
  add(key) { this.keys.push(key); this.sort(); this.changed(); return key; }
  remove(id) { const i = this.keys.findIndex(k => k.id === id); if (i >= 0 && this.keys.length > 1) { this.keys.splice(i, 1); this.changed(); } }
  move(id, t) { const k = this.keys.find(k => k.id === id); if (k) { k.t = Math.max(0, t); this.sort(); this.changed(); } }
  index(id) { return this.keys.findIndex(k => k.id === id); }
  /** Re-time so the whole shot lasts `d` seconds, keeping the spacing. */
  setDuration(d) { const old = this.duration; if (old <= 0) return; const s = d / old; for (const k of this.keys) k.t *= s; this.changed(); }

  /** Camera state at time t: position, aim point, rotation, focal length, focus, aperture. */
  sample(t) {
    const K = this.keys; if (!K.length) return null;
    if (K.length === 1 || t <= K[0].t) return this.stateAt(K[0]);
    if (t >= K[K.length - 1].t) return this.stateAt(K[K.length - 1]);
    let i = 0; while (i < K.length - 2 && t > K[i + 1].t) i++;
    const a = K[i], b = K[i + 1];
    const span = Math.max(1e-4, b.t - a.t);
    let u = (t - a.t) / span;
    /* hold: a key can sit still for a moment before the next move begins */
    if (a.hold > 0) { const h = Math.min(0.95, a.hold / span); u = u < h ? 0 : (u - h) / (1 - h); }
    const e = this.smoothness; const ue = (1 - e) * u + e * smoothstep(u);
    const p0 = K[Math.max(0, i - 1)].pos, p3 = K[Math.min(K.length - 1, i + 2)].pos;
    const pos = catmull(p0, a.pos, b.pos, p3, ue);
    const l0 = K[Math.max(0, i - 1)].look, l3 = K[Math.min(K.length - 1, i + 2)].look;
    const look = catmull(l0, a.look, b.look, l3, ue);
    const roll = a.roll + (b.roll - a.roll) * ue;
    const f = a.f + (b.f - a.f) * ue;
    const N = a.N + (b.N - a.N) * ue;
    const S = (a.S == null || b.S == null) ? null : Math.exp(Math.log(a.S) + (Math.log(b.S) - Math.log(a.S)) * ue);
    return { pos, look, roll, f, S, N, seg: i, u: ue };
  }
  stateAt(k) { return { pos: k.pos.slice(), look: k.look.slice(), roll: k.roll, f: k.f, S: k.S, N: k.N, seg: this.index(k), u: 0 }; }
  /** The path as a polyline, for drawing in the scene. */
  path(samples = 160) {
    const out = []; const d = this.duration;
    for (let i = 0; i <= samples; i++) { const s = this.sample(d * i / samples); if (s) out.push(s.pos); }
    return out;
  }
  /** Peak speed of the camera along the path (m/s), to warn about a move that is too fast. */
  peakSpeed(samples = 200) {
    const d = this.duration; let peak = 0; let prev = null;
    for (let i = 0; i <= samples; i++) { const t = d * i / samples; const s = this.sample(t); if (prev) peak = Math.max(peak, V3.norm(V3.sub(s.pos, prev)) / (d / samples) * this.speed); prev = s.pos; }
    return peak;
  }
  toJSON() { return { name: this.name, speed: this.speed, smoothness: this.smoothness, keys: this.keys.map(k => k.toJSON()) }; }
  static fromJSON(j) { return new Timeline((j.keys || []).map(k => new Key(k)), j); }
  /** Build a timeline from one of the built-in presets by sampling its parametric definition. */
  static fromShot(shot, ctx, evalShot, n = 5) {
    const keys = [];
    for (let i = 0; i < n; i++) {
      const t = shot.duration * i / (n - 1);
      const e = evalShot(shot, t, ctx);
      keys.push(new Key({ t, pos: e.pos, look: e.target, f: e.f, S: e.S, N: e.N, roll: 0 }));
    }
    return new Timeline(keys, { name: shot.name, speed: 1, smoothness: shot.ease === 'linear' ? 0.15 : 0.85 });
  }
}

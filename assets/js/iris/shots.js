/* =============================================================================
   shots.js — the shot evaluator: turns a preset from assets/data/iris_studio.json
   into a camera pose (position + rotation), a look target and a lens state at a
   normalised time tau in [0, 1]. The Python twin (experiments/irisstudio/shots.py)
   implements the same rules, so the planned trajectories in the report are the
   moves the studio plays live.
   ============================================================================= */
import { V3, R3, lookAtRotation, yawPitchRoll, rollAbout, smoothstep, easeOutExpo } from './kin.js';
const D2R = Math.PI / 180;
export const EASE = { smooth: smoothstep, linear: (t) => Math.max(0, Math.min(1, t)), expo: easeOutExpo, inout: smoothstep };
const lerp = (a, b, t) => a + (b - a) * t;

/** ctx: { subject(name) -> [x,y,z] centre, car(t) -> [x,y,z], t (absolute seconds), duration } */
export function resolvePoint(ref, ctx) {
  if (Array.isArray(ref)) return ref.slice();
  if (ref === 'car') return ctx.car(ctx.t);
  return ctx.subject(ref);
}
export function evalPath(path, tau, ctx) {
  switch (path.type) {
    case 'static': return path.at.slice();
    case 'line': return V3.lerp(path.from, path.to, tau);
    case 'orbit': { const c = resolvePoint(path.subject, ctx); const a = lerp(path.a[0], path.a[1], tau) * D2R; return [c[0] - path.radius * Math.cos(a), c[1] + path.radius * Math.sin(a), path.height]; }
    case 'varc': { const c = resolvePoint(path.subject, ctx); const e = lerp(path.elevation[0], path.elevation[1], tau) * D2R, az = (path.azimuth || 0) * D2R; return [c[0] - path.radius * Math.cos(e) * Math.cos(az), c[1] - path.radius * Math.cos(e) * Math.sin(az), c[2] + path.radius * Math.sin(e)]; }
    default: throw new Error('path ' + path.type);
  }
}
/** Returns { R, target } where target is the look point when the aim is a look-at (null for yaw/pitch/roll aims). */
export function evalAim(aim, pos, tau, ctx) {
  const roll = aim.roll ? lerp(aim.roll[0], aim.roll[1], tau) * D2R : 0;
  switch (aim.type) {
    case 'lookat': { const t = aim.point ? aim.point.slice() : resolvePoint(aim.subject, ctx); return { R: rollAbout(lookAtRotation(pos, t), roll), target: t }; }
    case 'lookat_moving': { const t = V3.lerp(resolvePoint(aim.from, ctx), resolvePoint(aim.to, ctx), tau); return { R: rollAbout(lookAtRotation(pos, t), roll), target: t }; }
    case 'track': { const t = ctx.car(ctx.t); return { R: rollAbout(lookAtRotation(pos, t), roll), target: t }; }
    case 'ypr': { const yaw = lerp(aim.yaw[0], aim.yaw[1], tau) * D2R, pitch = lerp(aim.pitch[0], aim.pitch[1], tau) * D2R; const R = yawPitchRoll(yaw, pitch, roll, pos); const f = [R[0][2], R[1][2], R[2][2]]; return { R, target: V3.add(pos, V3.scale(f, 0.45)) }; }
    default: throw new Error('aim ' + aim.type);
  }
}
export function evalLens(lens, pos, target, tau, ctx, shot) {
  const d = V3.norm(V3.sub(target, pos));
  let f;
  if (lens.f === 'dollyzoom') {
    /* Size constancy for a body of finite radius r: a sphere/cylinder of radius r at distance d
       subtends a half-width r / sqrt(d^2 - r^2) (its silhouette is the tangent, not its centre plane),
       so holding f * r / sqrt(d^2 - r^2) fixed keeps the *silhouette* the same size, not just a point
       at the subject distance. r = 0 collapses to the textbook law f = f0 d / d0. */
    if (ctx.d0 === undefined) { const p0 = evalPath(shot.path, 0, ctx); const a0 = evalAim(shot.aim, p0, 0, ctx); ctx.d0 = V3.norm(V3.sub(a0.target, p0)); }
    const r = lens.radius || 0, g = (x) => Math.sqrt(Math.max(x * x - r * r, 1e-6));
    f = lens.f0 * g(d) / g(ctx.d0);
  }
  else if (Array.isArray(lens.f)) f = lerp(lens.f[0], lens.f[1], tau);
  else f = lens.f;
  let S;
  if (lens.focus === 'auto') S = d;
  else if (typeof lens.focus === 'number') S = lens.focus;
  else if (Array.isArray(lens.focus)) S = lerp(lens.focus[0], lens.focus[1], tau);
  else if (lens.focus && lens.focus.type === 'rack') {
    const seq = lens.focus.seq.map(s => V3.norm(V3.sub(resolvePoint(s, ctx), pos))); const hold = lens.focus.hold || 0.2; const n = seq.length - 1;
    const segLen = 1 / n; const k = Math.min(n - 1, Math.floor(tau / segLen)); let u = (tau - k * segLen) / segLen;    /* within segment k: hold, move, hold */
    u = u < hold ? 0 : u > 1 - hold ? 1 : smoothstep((u - hold) / (1 - 2 * hold)); S = lerp(seq[k], seq[k + 1], u);
  } else S = d;
  return { f, S, N: lens.N || 4, d };
}
/** Full evaluation at absolute time t (s) of a shot; ctx.t is set here. */
export function evalShot(shot, t, ctx) {
  ctx.t = t; const tau = EASE[shot.ease || 'smooth'](t / shot.duration);
  const pos = evalPath(shot.path, tau, ctx); const aim = evalAim(shot.aim, pos, tau, ctx); const lens = evalLens(shot.lens, pos, aim.target, tau, ctx, shot);
  return { pos, R: aim.R, target: aim.target, f: lens.f, S: lens.S, N: lens.N, d: lens.d, tau };
}
/** The toy car's position on its circular track at time t. */
export function carPosition(car, t) { const a = (car.a0_deg * D2R) + 2 * Math.PI * t / car.lap_s; return [car.centre[0] + car.radius * Math.cos(a), car.centre[1] + car.radius * Math.sin(a), 0.0]; }
export function carHeading(car, t) { const a = (car.a0_deg * D2R) + 2 * Math.PI * t / car.lap_s; return a + Math.PI / 2; }
/** Build the subject resolver for a product set of the spec. */
export function makeContext(spec, setId) {
  const set = spec.sets[setId]; const byId = Object.fromEntries(spec.products.map(p => [p.id, p]));
  const place = { near: [spec.near[0], spec.near[1], 0], far: [spec.far[0], spec.far[1], 0] };
  const ids = { near: set.near, far: set.far };
  set.extras.forEach((e, i) => { place['extra' + i] = [e[1], e[2], 0]; ids['extra' + i] = e[0]; });
  return { subject(name) { const p = place[name]; if (!p) throw new Error('subject ' + name); const prod = byId[ids[name]]; return [p[0], p[1], p[2] + prod.centre_z]; }, car: (t) => { const c = carPosition(spec.car, t); c[2] += byId.toy_car.centre_z; return c; }, t: 0, place, ids };
}

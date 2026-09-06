/* =============================================================================
   lens.js — the camera and the motorised zoom lens on IRIS's mount.
   Body: Sony α7R III (full-frame 35.9 × 24.0 mm, 3:2). Lens: a 16–150 mm zoom
   whose zoom and focus rings are driven by servos (slew-rate limited), so a
   shot can command focal length and focus distance as continuous tracks.
   Thin-lens optics: field of view, depth of field, circle of confusion, and the
   dolly-zoom law f/d = const that keeps a subject the same size on the sensor.
   ============================================================================= */
export const SENSOR = { w: 35.9, h: 24.0, px: 7952, name: 'Sony α7R III · full frame 42 MP' };
export const LENS = { fmin: 16, fmax: 150, Nmin: 2.8, Nmax: 22, mfd: 0.20, zoomRate: 60, focusRate: 4.0, name: '16–150 mm f/2.8–4 servo zoom' };
export const fovV = (f) => 2 * Math.atan(SENSOR.h / (2 * f)) * 180 / Math.PI;           /* degrees, vertical (three.js fov) */
export const fovH = (f) => 2 * Math.atan(SENSOR.w / (2 * f)) * 180 / Math.PI;
/** Image height (fraction of the frame) of an object of size `size` m at distance d m. */
export const imageFraction = (size, d, f) => (f / 1000) * size / d / (SENSOR.h / 1000);
/** Dolly zoom: the focal length that keeps the subject size when moving from d0 to d. */
export const dollyZoomF = (f0, d0, d) => f0 * d / d0;
/** Circle of confusion (mm on the sensor) of a point at distance d when focused at S, aperture N, focal f (mm; d, S in m). */
export function coc(f, N, S, d) { const s = S * 1000, dd = Math.max(d * 1000, 1); const A = f / N; return A * Math.abs(dd - s) / dd * f / Math.max(s - f, 1); }
/** Depth of field limits (m) for an acceptable CoC c (mm, 0.03 for full frame). */
export function dof(f, N, S, c = 0.03) { const s = S * 1000, H = f * f / (N * c) + f; const near = H * s / (H + (s - f)); const far = (H - s) > 0 ? H * s / (H - (s - f)) : Infinity; return { near: near / 1000, far: far === Infinity ? Infinity : far / 1000, hyperfocal: H / 1000 }; }
/** A servo-driven ring: slews toward its target at a rate limit with a little first-order smoothing. */
export class Servo {
  constructor(value, rate, lo, hi, tau = 0.08) { this.value = value; this.target = value; this.rate = rate; this.lo = lo; this.hi = hi; this.tau = tau; this.vel = 0; }
  set(t) { this.target = Math.max(this.lo, Math.min(this.hi, t)); }
  update(dt) { const want = (this.target - this.value) / Math.max(dt, 1e-3); const v = Math.max(-this.rate, Math.min(this.rate, want)); this.vel += (v - this.vel) * Math.min(1, dt / this.tau); this.value += this.vel * dt; if ((this.vel > 0 && this.value > this.target) || (this.vel < 0 && this.value < this.target)) { this.value = this.target; this.vel = 0; } return this.value; }
  jump(v) { this.value = this.target = Math.max(this.lo, Math.min(this.hi, v)); this.vel = 0; }
}
export class Lens {
  constructor() { this.zoom = new Servo(35, LENS.zoomRate, LENS.fmin, LENS.fmax); this.focus = new Servo(0.5, LENS.focusRate, LENS.mfd, 50); this.N = 4.0; }
  get f() { return this.zoom.value; } get S() { return this.focus.value; }
  update(dt) { this.zoom.update(dt); this.focus.update(dt); }
  /** Barrel extension of a real travel zoom: 0 at 16 mm, ~35 mm at 150 mm. */
  get extension() { return 0.035 * (this.f - LENS.fmin) / (LENS.fmax - LENS.fmin); }
}

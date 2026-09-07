/* =============================================================================
   tracker.js — draw a box round something in the picture and the camera keeps it.

   The operator's box is turned into a colour model of whatever is inside it, and
   that model is searched for in each new frame. The method is CAMShift: a colour
   histogram back-projected into a likelihood image, then mean shift to the mode,
   with the window growing and shrinking from the second moments so the lock
   survives a zoom or a dolly.

   One refinement matters more than the rest here: the model is divided by a
   histogram of the ring of background around the box, so a colour that is common
   just outside the selection counts for little inside it. Without that, a box
   drawn round a product on a wooden desk locks onto the desk, because the desk
   fills most of the box's surroundings and a good part of the box itself.

   The tracker works in the read-back's own pixel grid, which is bottom-up, and
   converts to top-down normalised coordinates only at its edges.
   ============================================================================= */

const BINS = 8;                       /* per channel: 8^3 = 512 bins */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const bin = (r, g, b) => ((r >> 5) * BINS + (g >> 5)) * BINS + (b >> 5);

export class BoxTracker {
  constructor() { this.reset(); }
  reset() {
    this.model = null; this.win = null; this.conf = 0; this.lost = 0; this.state = 'idle';
    this.trail = [];
  }
  get active() { return !!this.model; }

  /** Learn what is inside `rect` (normalised, top-down) from one frame. */
  learn(frame, rect) {
    const { w, h } = frame;
    const win = this.toPixels(rect, w, h);
    if (win.w < 4 || win.h < 4) return false;
    const fg = new Float32Array(BINS ** 3), bg = new Float32Array(BINS ** 3);
    let nf = 0, nb = 0;
    /* the background ring is the box grown by half its size, minus the box itself */
    const gx = Math.round(win.w * 0.6), gy = Math.round(win.h * 0.6);
    const outer = { x: win.x - gx, y: win.y - gy, w: win.w + 2 * gx, h: win.h + 2 * gy };
    for (let y = Math.max(0, outer.y); y < Math.min(h, outer.y + outer.h); y++) {
      for (let x = Math.max(0, outer.x); x < Math.min(w, outer.x + outer.w); x++) {
        const i = (y * w + x) * 4;
        const b = bin(frame.data[i], frame.data[i + 1], frame.data[i + 2]);
        const inside = x >= win.x && x < win.x + win.w && y >= win.y && y < win.y + win.h;
        if (inside) { fg[b]++; nf++; } else { bg[b]++; nb++; }
      }
    }
    if (nf < 16) return false;
    /* divide the object's colours by the background's, so shared colours count for little */
    const model = new Float32Array(BINS ** 3); let max = 0;
    for (let k = 0; k < model.length; k++) {
      const p = fg[k] / nf, q = bg[k] / Math.max(nb, 1);
      model[k] = p <= 0 ? 0 : p / (p + 2.2 * q);          /* in [0,1]: 1 = only in the object */
      model[k] *= Math.min(1, p * nf / 6);                 /* a bin seen a handful of times is noise */
      if (model[k] > max) max = model[k];
    }
    if (max <= 0) return false;
    for (let k = 0; k < model.length; k++) model[k] /= max;
    this.model = model; this.win = win; this.state = 'locked'; this.conf = 1; this.lost = 0;
    this.trail = [];
    this.size0 = { w: win.w / w, h: win.h / h };
    return true;
  }

  /** Find the object in a new frame. Returns the box in normalised top-down coordinates. */
  step(frame) {
    if (!this.model) return null;
    const { w, h } = frame;
    let win = { ...this.win };
    const like = (x, y) => {
      const i = (y * w + x) * 4;
      return this.model[bin(frame.data[i], frame.data[i + 1], frame.data[i + 2])];
    };
    /* mean shift: walk the window to the centre of mass of the likelihood */
    let m00 = 0;
    for (let it = 0; it < 8; it++) {
      const sx = Math.max(0, Math.round(win.x - win.w * 0.35)), ex = Math.min(w, Math.round(win.x + win.w * 1.35));
      const sy = Math.max(0, Math.round(win.y - win.h * 0.35)), ey = Math.min(h, Math.round(win.y + win.h * 1.35));
      let m10 = 0, m01 = 0; m00 = 0;
      for (let y = sy; y < ey; y++) for (let x = sx; x < ex; x++) {
        const p = like(x, y); if (p <= 0.02) continue;
        m00 += p; m10 += p * x; m01 += p * y;
      }
      if (m00 < 1e-3) break;
      const cx = m10 / m00, cy = m01 / m00;
      const nx = cx - win.w / 2, ny = cy - win.h / 2;
      const moved = Math.hypot(nx - win.x, ny - win.y);
      win.x = nx; win.y = ny;
      if (moved < 0.4) break;
    }
    /* scale from the spread of the likelihood inside the window, damped hard so a
       momentary distraction cannot inflate the box */
    if (m00 > 1e-3) {
      const cx = win.x + win.w / 2, cy = win.y + win.h / 2;
      let s2x = 0, s2y = 0, tot = 0;
      const sx = Math.max(0, Math.round(win.x - win.w * 0.3)), ex = Math.min(w, Math.round(win.x + win.w * 1.3));
      const sy = Math.max(0, Math.round(win.y - win.h * 0.3)), ey = Math.min(h, Math.round(win.y + win.h * 1.3));
      for (let y = sy; y < ey; y++) for (let x = sx; x < ex; x++) {
        const p = like(x, y); if (p <= 0.02) continue;
        s2x += p * (x - cx) ** 2; s2y += p * (y - cy) ** 2; tot += p;
      }
      if (tot > 1e-3) {
        /* the window may breathe with the subject but never run away with it: a blob that keeps
           growing has stopped being the thing that was selected */
        const maxW = Math.min(w * 0.9, this.size0.w * w * 2.5), maxH = Math.min(h * 0.9, this.size0.h * h * 2.5);
        const minW = Math.max(6, this.size0.w * w * 0.45), minH = Math.max(6, this.size0.h * h * 0.45);
        const tw = 4 * Math.sqrt(s2x / tot), th = 4 * Math.sqrt(s2y / tot);
        if (isFinite(tw) && tw > 3) win.w += (clamp(tw, minW, maxW) - win.w) * 0.12;
        if (isFinite(th) && th > 3) win.h += (clamp(th, minH, maxH) - win.h) * 0.12;
      }
    }
    /* confidence: how much of the window actually looks like the object */
    let hit = 0, n = 0;
    const bx0 = Math.max(0, Math.round(win.x)), bx1 = Math.min(w, Math.round(win.x + win.w));
    const by0 = Math.max(0, Math.round(win.y)), by1 = Math.min(h, Math.round(win.y + win.h));
    for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) { n++; if (like(x, y) > 0.25) hit++; }
    this.conf = n ? hit / n : 0;
    const m = 2;                                   /* only really at the border counts as an edge */
    const onEdge = bx0 <= m || by0 <= m || bx1 >= w - m || by1 >= h - m;
    if (this.conf < 0.12 || n < 9) {
      this.lost++; this.state = this.lost > 12 ? 'lost' : 'searching';
      /* hold the last good window rather than chasing noise */
      if (this.state === 'lost') return null;
    } else {
      this.lost = 0; this.state = onEdge ? 'edge' : 'locked'; this.win = win;
    }
    const out = this.toNorm(this.win, w, h);
    out.conf = this.conf; out.state = this.state; out.edge = onEdge;
    this.trail.push([out.u, out.v]); if (this.trail.length > 90) this.trail.shift();
    return out;
  }

  toPixels(rect, w, h) {
    /* normalised, top-down -> the read-back's bottom-up pixel grid */
    const x = Math.round(rect.x * w), wpx = Math.round(rect.w * w);
    const yTop = rect.y * h, hpx = Math.round(rect.h * h);
    const y = Math.round(h - yTop * 1 - hpx);
    return { x, y, w: wpx, h: hpx };
  }
  toNorm(win, w, h) {
    const u = (win.x + win.w / 2) / w;
    const v = 1 - (win.y + win.h / 2) / h;
    return { u, v, w: win.w / w, h: win.h / h,
             x: win.x / w, y: 1 - (win.y + win.h) / h };
  }
}

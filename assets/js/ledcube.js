/* ============================================================================
   ledcube.js — an 8×8×8 LED cube in the browser.

   The hardware is 512 LEDs driven by nine daisy-chained shift registers over
   SPI: eight registers hold one layer's 64 anodes, the ninth selects which of
   the eight cathode layers is grounded. Only one layer is ever lit. The whole
   cube is an illusion held together by refreshing the layers faster than the
   eye can follow — which is what the refresh-rate slider takes away from you.

   Everything below writes into one 512-bit frame buffer, exactly as the
   Arduino library did; the multiplexer and the persistence-of-vision model
   live in the UI.
   ========================================================================= */
(function () {
  'use strict';
  const N = 8;
  const idx = (x, y, z) => (z * N + y) * N + x;

  class Cube {
    constructor() {
      this.buf = new Uint8Array(N * N * N);
      this.layer = 0;
      this.N = N;
    }
    clear() { this.buf.fill(0); }
    set(x, y, z, v) {
      x = Math.round(x); y = Math.round(y); z = Math.round(z);
      if (x < 0 || y < 0 || z < 0 || x >= N || y >= N || z >= N) return;
      this.buf[idx(x, y, z)] = v ? 1 : 0;
    }
    get(x, y, z) {
      if (x < 0 || y < 0 || z < 0 || x >= N || y >= N || z >= N) return 0;
      return this.buf[idx(x, y, z)];
    }
    tickLayer() { this.layer = (this.layer + 1) % N; }
  }

  /* ── an 8×8 bitmap font, enough for the whole alphabet and the digits ──
     Each glyph is 8 rows of 8 bits, top row first. Drawn narrow so a letter
     reads cleanly on a face only eight LEDs across. */
  const FONT = {
    '0': [0x3C,0x66,0x6E,0x76,0x66,0x66,0x3C,0x00], '1': [0x18,0x38,0x18,0x18,0x18,0x18,0x7E,0x00],
    '2': [0x3C,0x66,0x06,0x0C,0x30,0x60,0x7E,0x00], '3': [0x3C,0x66,0x06,0x1C,0x06,0x66,0x3C,0x00],
    '4': [0x0C,0x1C,0x3C,0x6C,0x7E,0x0C,0x0C,0x00], '5': [0x7E,0x60,0x7C,0x06,0x06,0x66,0x3C,0x00],
    '6': [0x1C,0x30,0x60,0x7C,0x66,0x66,0x3C,0x00], '7': [0x7E,0x06,0x0C,0x18,0x30,0x30,0x30,0x00],
    '8': [0x3C,0x66,0x66,0x3C,0x66,0x66,0x3C,0x00], '9': [0x3C,0x66,0x66,0x3E,0x06,0x0C,0x38,0x00],
    'A': [0x18,0x3C,0x66,0x66,0x7E,0x66,0x66,0x00], 'B': [0x7C,0x66,0x66,0x7C,0x66,0x66,0x7C,0x00],
    'C': [0x3C,0x66,0x60,0x60,0x60,0x66,0x3C,0x00], 'D': [0x78,0x6C,0x66,0x66,0x66,0x6C,0x78,0x00],
    'E': [0x7E,0x60,0x60,0x7C,0x60,0x60,0x7E,0x00], 'F': [0x7E,0x60,0x60,0x7C,0x60,0x60,0x60,0x00],
    'G': [0x3C,0x66,0x60,0x6E,0x66,0x66,0x3E,0x00], 'H': [0x66,0x66,0x66,0x7E,0x66,0x66,0x66,0x00],
    'I': [0x3C,0x18,0x18,0x18,0x18,0x18,0x3C,0x00], 'J': [0x1E,0x0C,0x0C,0x0C,0x6C,0x6C,0x38,0x00],
    'K': [0x66,0x6C,0x78,0x70,0x78,0x6C,0x66,0x00], 'L': [0x60,0x60,0x60,0x60,0x60,0x60,0x7E,0x00],
    'M': [0x63,0x77,0x7F,0x6B,0x63,0x63,0x63,0x00], 'N': [0x66,0x76,0x7E,0x7E,0x6E,0x66,0x66,0x00],
    'O': [0x3C,0x66,0x66,0x66,0x66,0x66,0x3C,0x00], 'P': [0x7C,0x66,0x66,0x7C,0x60,0x60,0x60,0x00],
    'Q': [0x3C,0x66,0x66,0x66,0x6E,0x6C,0x36,0x00], 'R': [0x7C,0x66,0x66,0x7C,0x78,0x6C,0x66,0x00],
    'S': [0x3E,0x60,0x60,0x3C,0x06,0x06,0x7C,0x00], 'T': [0x7E,0x18,0x18,0x18,0x18,0x18,0x18,0x00],
    'U': [0x66,0x66,0x66,0x66,0x66,0x66,0x3C,0x00], 'V': [0x66,0x66,0x66,0x66,0x66,0x3C,0x18,0x00],
    'W': [0x63,0x63,0x63,0x6B,0x7F,0x77,0x63,0x00], 'X': [0x66,0x66,0x3C,0x18,0x3C,0x66,0x66,0x00],
    'Y': [0x66,0x66,0x66,0x3C,0x18,0x18,0x18,0x00], 'Z': [0x7E,0x06,0x0C,0x18,0x30,0x60,0x7E,0x00],
    ' ': [0,0,0,0,0,0,0,0], '!': [0x18,0x18,0x18,0x18,0x18,0x00,0x18,0x00],
    '?': [0x3C,0x66,0x06,0x0C,0x18,0x00,0x18,0x00], '.': [0,0,0,0,0,0,0x18,0x00],
    '-': [0,0,0,0x7E,0,0,0,0], ':': [0,0x18,0x18,0,0x18,0x18,0,0],
    '<': [0x0C,0x18,0x30,0x60,0x30,0x18,0x0C,0x00], '>': [0x30,0x18,0x0C,0x06,0x0C,0x18,0x30,0x00]
  };

  /** Paint one glyph on the plane y = plane, shifted horizontally by dx. */
  function glyph(c, ch, plane, dx) {
    const g = FONT[ch] || FONT['?'];
    for (let row = 0; row < 8; row++) {
      const bits = g[row];
      for (let col = 0; col < 8; col++) {
        if (bits & (0x80 >> col)) c.set(col + dx, plane, N - 1 - row, 1);
      }
    }
  }

  // ---- animations ------------------------------------------------------------
  const ANIM = {
    wave(c, t) {
      c.clear();
      for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
        const d = Math.hypot(x - 3.5, y - 3.5);
        c.set(x, y, Math.round(3.5 + 3.0 * Math.sin(d * 0.9 - t * 3.2)), 1);
      }
    },
    rain(c, t, st) {
      if (!st.drops) {
        st.drops = [];
        for (let i = 0; i < 22; i++) {
          st.drops.push([Math.floor(Math.random() * N), Math.floor(Math.random() * N), Math.random() * N]);
        }
      }
      c.clear();
      st.drops.forEach((d) => {
        d[2] -= 0.09;
        if (d[2] < 0) { d[0] = Math.floor(Math.random() * N); d[1] = Math.floor(Math.random() * N); d[2] = N - 1; }
        c.set(d[0], d[1], d[2], 1);
      });
    },
    firework(c, t, st) {
      if (!st.t0 || t - st.t0 > 2.4) {
        st.t0 = t; st.cx = 1 + Math.random() * 5; st.cy = 1 + Math.random() * 5;
      }
      c.clear();
      const dt = t - st.t0;
      if (dt < 0.9) {
        c.set(st.cx, st.cy, dt / 0.9 * 6, 1);
      } else {
        const r = (dt - 0.9) * 4.5;
        for (let a = 0; a < 14; a++) for (let b = 0; b < 7; b++) {
          const th = a / 14 * 2 * Math.PI, ph = b / 6 * Math.PI;
          c.set(st.cx + r * Math.sin(ph) * Math.cos(th),
                st.cy + r * Math.sin(ph) * Math.sin(th),
                6 + r * Math.cos(ph), 1);
        }
      }
    },
    spin(c, t) {
      c.clear();
      const a = t * 1.6;
      for (let z = 0; z < N; z++) for (let k = -4; k <= 4; k++) {
        c.set(3.5 + k * Math.cos(a + z * 0.25), 3.5 + k * Math.sin(a + z * 0.25), z, 1);
      }
    },
    /* the countdown the console shows before a game starts */
    countdown(c, t, st) {
      const total = 4.6;
      const dt = t % total;
      c.clear();
      if (dt < 3.6) {
        const n = String(3 - Math.floor(dt / 1.2));
        const pulse = 1 - (dt % 1.2) / 1.2;
        if (pulse > 0.12) glyph(c, n, 0, 0);
        if (pulse > 0.12) glyph(c, n, N - 1, 0);
      } else {
        // GO! sweeps through the cube
        const k = Math.floor((dt - 3.6) / 1.0 * N);
        for (let p = 0; p < N; p++) if (Math.abs(p - k) < 1.5) glyph(c, p % 2 ? 'O' : 'G', p, 0);
      }
    },
    /* text scrolling front to back, the way a marquee would */
    letters(c, t, st) {
      const msg = (st.text || 'MIE438 LED CUBE ') .toUpperCase();
      c.clear();
      const per = 0.62;                       // seconds a letter spends in view
      const i = Math.floor(t / per) % msg.length;
      const frac = (t / per) % 1;
      // the current letter walks from the back plane to the front
      const plane = (1 - frac) * (N - 1);
      glyph(c, msg[i], Math.round(plane), 0);
    },
    /* a double helix, because a cube of lights should have one */
    helix(c, t) {
      c.clear();
      for (let z = 0; z < N; z++) {
        const a = t * 1.8 + z * 0.7;
        c.set(3.5 + 3 * Math.cos(a), 3.5 + 3 * Math.sin(a), z, 1);
        c.set(3.5 - 3 * Math.cos(a), 3.5 - 3 * Math.sin(a), z, 1);
        if (z % 3 === 0) {
          for (let s = -2; s <= 2; s++) {
            c.set(3.5 + s * Math.cos(a), 3.5 + s * Math.sin(a), z, 1);
          }
        }
      }
    },
    /* an expanding shell, the cheapest way to make a cube look spherical */
    pulse(c, t) {
      c.clear();
      const r = 0.5 + 3.4 * (0.5 + 0.5 * Math.sin(t * 2.0));
      for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
        const d = Math.hypot(x - 3.5, y - 3.5, z - 3.5);
        if (Math.abs(d - r) < 0.55) c.set(x, y, z, 1);
      }
    },
    /* a ball bouncing off all six faces */
    bounce(c, t, st) {
      if (!st.p) { st.p = [3.5, 3.5, 6]; st.v = [0.11, 0.07, 0]; }
      st.v[2] -= 0.012;
      for (let i = 0; i < 3; i++) {
        st.p[i] += st.v[i];
        if (st.p[i] < 0) { st.p[i] = 0; st.v[i] = Math.abs(st.v[i]) * (i === 2 ? 0.92 : 1); }
        if (st.p[i] > N - 1) { st.p[i] = N - 1; st.v[i] = -Math.abs(st.v[i]); }
      }
      if (st.p[2] < 0.05 && Math.abs(st.v[2]) < 0.06) st.v[2] = 0.30;
      c.clear();
      const [px, py, pz] = st.p;
      for (const d of [[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,1,1]]) {
        c.set(Math.floor(px) + d[0], Math.floor(py) + d[1], Math.floor(pz) + d[2], 1);
      }
      for (let x = 0; x < N; x++) if (x === Math.round(px)) c.set(x, Math.round(py), 0, 1);
    },
    /* a rotating wireframe cube inside the cube */
    tumble(c, t) {
      c.clear();
      const a = t * 0.9, b = t * 0.6;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      const V = [];
      for (const s of [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]) {
        let [x, y, z] = s.map((v) => v * 2.4);
        let X = x * ca - y * sa, Y = x * sa + y * ca;
        let Z = z * cb - X * sb; X = z * sb + X * cb;
        V.push([X + 3.5, Y + 3.5, Z + 3.5]);
      }
      const E = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
      E.forEach(([i, j]) => {
        for (let k = 0; k <= 12; k++) {
          const u = k / 12;
          c.set(V[i][0] + (V[j][0]-V[i][0])*u, V[i][1] + (V[j][1]-V[i][1])*u, V[i][2] + (V[j][2]-V[i][2])*u, 1);
        }
      });
    },
    /* a heart, beating */
    heart(c, t) {
      c.clear();
      const s = 0.85 + 0.15 * Math.abs(Math.sin(t * 3.0));
      const rows = [0x00,0x66,0xFF,0xFF,0xFF,0x7E,0x3C,0x18];
      for (let r = 0; r < 8; r++) for (let col = 0; col < 8; col++) {
        if (!(rows[r] & (0x80 >> col))) continue;
        const x = (col - 3.5) * s + 3.5, z = (7 - r - 3.5) * s + 3.5;
        for (let y = 2; y <= 5; y++) c.set(x, y, z, 1);
      }
    },
    /* random sparkle, the classic first thing anybody writes */
    sparkle(c, t, st) {
      if (!st.pts || t - (st.t0 || 0) > 0.09) {
        st.t0 = t; st.pts = [];
        for (let i = 0; i < 26; i++) {
          st.pts.push([Math.floor(Math.random()*N), Math.floor(Math.random()*N), Math.floor(Math.random()*N)]);
        }
      }
      c.clear();
      st.pts.forEach((p) => c.set(p[0], p[1], p[2], 1));
    }
  };

  const ANIM_LIST = [
    ['countdown', 'Countdown', '3… 2… 1… GO'],
    ['letters',   'Letters',   'text through the cube'],
    ['wave',      'Wave',      'a ripple from the middle'],
    ['helix',     'Helix',     'two strands and rungs'],
    ['firework',  'Firework',  'launch and burst'],
    ['pulse',     'Pulse',     'an expanding shell'],
    ['bounce',    'Bounce',    'off all six faces'],
    ['tumble',    'Tumble',    'a wireframe cube inside'],
    ['rain',      'Rain',      'falling drops'],
    ['spin',      'Spin',      'a bar sweeping round'],
    ['heart',     'Heart',     'beating'],
    ['sparkle',   'Sparkle',   'pure noise']
  ];

  /* ── liquid ───────────────────────────────────────────────────────────
     A shallow-water height field, which is the right model for a cube of
     columns: instead of tracking particles, track one water depth h(x, y) per
     column and the depth-averaged velocity through each face between columns.
     That is the standard formulation for tilt-sloshing (and what the pipe
     model in fluid-in-a-box demos reduces to), and it renders for free — a
     column is simply lit from the floor up to its own depth.

         du/dt = -g_z ∂h/∂x + g_x          (pressure gradient, plus tilt)
         dh/dt = -∂(h u)/∂x - ∂(h v)/∂y    (mass conservation)

     Velocities live on the faces between columns and the fluxes are upwinded,
     which is what keeps it stable without a fine time step. Gravity is
     resolved into the cube's own frame from the cube's orientation, so tipping
     the cube is what drives the whole thing. */
  class Liquid {
    constructor(fill) {
      this.fill = fill == null ? 1 / 3 : fill;
      this.h = new Float64Array(N * N);
      this.ux = new Float64Array((N + 1) * N);      // faces along x
      this.uy = new Float64Array(N * (N + 1));      // faces along y
      this.reset();
    }
    reset() {
      const h0 = N * this.fill;                     // 1/3 full => 2.67 cells deep
      this.h.fill(h0);
      this.ux.fill(0); this.uy.fill(0);
      this.volume = h0 * N * N;
    }
    /** Advance the sim. (gx, gy) is gravity's in-plane part in cube
        coordinates and gz its restoring part; both come from the cube's
        orientation, so the caller never has to think about frames. */
    step(dt, gx, gy, gz, damp) {
      const h = this.h, ux = this.ux, uy = this.uy;
      const D = 1 - (damp == null ? 0.9 : damp) * dt;
      gz = Math.max(gz, 0.15);                      // upside down still settles

      // face velocities from the surface gradient and the tilt
      for (let j = 0; j < N; j++) {
        for (let i = 1; i < N; i++) {
          const k = i * N + j;
          ux[k] = (ux[k] + dt * (-gz * (h[i * N + j] - h[(i - 1) * N + j]) + gx)) * D;
        }
        ux[j] = 0; ux[N * N + j] = 0;               // walls
      }
      for (let i = 0; i < N; i++) {
        for (let j = 1; j < N; j++) {
          const k = i * (N + 1) + j;
          uy[k] = (uy[k] + dt * (-gz * (h[i * N + j] - h[i * N + j - 1]) + gy)) * D;
        }
        uy[i * (N + 1)] = 0; uy[i * (N + 1) + N] = 0;
      }

      // upwind fluxes, then mass conservation
      const fx = new Float64Array((N + 1) * N), fy = new Float64Array(N * (N + 1));
      for (let j = 0; j < N; j++) for (let i = 1; i < N; i++) {
        const k = i * N + j;
        fx[k] = ux[k] * (ux[k] > 0 ? h[(i - 1) * N + j] : h[i * N + j]);
      }
      for (let i = 0; i < N; i++) for (let j = 1; j < N; j++) {
        const k = i * (N + 1) + j;
        fy[k] = uy[k] * (uy[k] > 0 ? h[i * N + j - 1] : h[i * N + j]);
      }
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        h[i * N + j] -= dt * ((fx[(i + 1) * N + j] - fx[i * N + j])
                            + (fy[i * (N + 1) + j + 1] - fy[i * (N + 1) + j]));
        if (h[i * N + j] < 0) h[i * N + j] = 0;
        if (h[i * N + j] > N) h[i * N + j] = N;
      }
      // the scheme leaks a little at the clamps; put the volume back so the
      // cube never quietly empties itself
      let tot = 0;
      for (let k = 0; k < N * N; k++) tot += h[k];
      if (tot > 1e-6) {
        const s = this.volume / tot;
        for (let k = 0; k < N * N; k++) h[k] *= s;
      }
    }
    render(c) {
      c.clear();
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const d = this.h[i * N + j];
        const full = Math.floor(d);
        for (let z = 0; z < Math.min(full, N); z++) c.set(i, j, z, 1);
        if (full < N && d - full > 0.45) c.set(i, j, full, 1);   // the surface cell
      }
    }
    depth() {
      let mn = 1e9, mx = -1e9;
      for (let k = 0; k < N * N; k++) { mn = Math.min(mn, this.h[k]); mx = Math.max(mx, this.h[k]); }
      return [mn, mx];
    }
  }

  /** Gravity in the cube's own frame, for a cube drawn at (yaw, pitch).

      The renderer maps a cube point to screen-up through
          v = -sin(p)sin(y)·x - sin(p)cos(y)·y + cos(p)·z
      so that row is the world-up direction expressed in cube coordinates, and
      gravity is minus it. Tipping the cube with the mouse therefore drives the
      fluid without the sim ever knowing about the camera. */
  function gravityInCube(yaw, pitch, g) {
    g = g == null ? 9.0 : g;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const sp = Math.sin(pitch), cp = Math.cos(pitch);
    return { gx: g * sp * sy, gy: g * sp * cy, gz: g * cp };
  }

  // ---- 3-D snake, the game they actually built --------------------------------
  const wrap = (v) => ((v % N) + N) % N;

  class Snake {
    constructor() { this.best = 0; this.reset(); }
    reset() {
      this.body = [[3, 3, 3], [2, 3, 3], [1, 3, 3]];
      this.dir = [1, 0, 0];
      this.next = [1, 0, 0];
      this.food = this.spawn();
      this.dead = false;
      this.score = 0;
      this.ate = false;
    }
    spawn() {
      for (;;) {
        const f = [0, 0, 0].map(() => Math.floor(Math.random() * N));
        if (!this.body.some((b) => b[0] === f[0] && b[1] === f[1] && b[2] === f[2])) return f;
      }
    }
    steer(d) {
      const h = this.dir;
      if (d[0] === -h[0] && d[1] === -h[1] && d[2] === -h[2]) return;
      this.next = d;
    }
    step() {
      this.ate = false;
      if (this.dead) return;
      this.dir = this.next;
      const h = this.body[0];
      // the walls wrap: run off one face and come back on the opposite one
      const nh = [wrap(h[0] + this.dir[0]), wrap(h[1] + this.dir[1]), wrap(h[2] + this.dir[2])];
      if (this.body.some((b) => b[0] === nh[0] && b[1] === nh[1] && b[2] === nh[2])) {
        this.dead = true;
        this.best = Math.max(this.best, this.score);
        return;
      }
      this.body.unshift(nh);
      if (nh[0] === this.food[0] && nh[1] === this.food[1] && nh[2] === this.food[2]) {
        this.score++; this.ate = true; this.food = this.spawn();
      } else this.body.pop();
    }
    render(c, blink) {
      c.clear();
      this.body.forEach((b) => c.set(b[0], b[1], b[2], 1));
      if (blink) c.set(this.food[0], this.food[1], this.food[2], 1);
    }
  }

  // ---- 3-D pong, human against the machine ------------------------------------
  class Pong {
    constructor() { this.human = 0; this.robot = 0; this.reset(true); }
    reset(full) {
      // paddles live on the two y-faces; the ball travels along y
      this.pad = [3.5, 3.5];            // human paddle centre (x, z) at y = 0
      this.ai = [3.5, 3.5];             // machine paddle at y = N-1
      this.serve(full ? 1 : (Math.random() < 0.5 ? 1 : -1));
      this.event = null;
      if (full) { this.human = 0; this.robot = 0; }
    }
    serve(dir) {
      this.p = [3.5, 3.5, 3.5];
      const s = 7.8;                    // cells per second, along y
      this.v = [(Math.random() - 0.5) * 5.4, dir * s, (Math.random() - 0.5) * 5.4];
      this.wait = 0.7;
    }
    movePad(dx, dz) {
      this.pad[0] = Math.max(1, Math.min(N - 2, this.pad[0] + dx));
      this.pad[1] = Math.max(1, Math.min(N - 2, this.pad[1] + dz));
    }
    /** The machine: predict where the ball crosses its face, and go there.
        `skill` in [0,1] blends perfect prediction with a lazy chase, and adds
        the reaction lag that makes it beatable. */
    think(skill, dt) {
      let tx = this.p[0], tz = this.p[2];
      if (this.v[1] > 0) {
        const t = (N - 1 - this.p[1]) / this.v[1];
        tx = this.p[0] + this.v[0] * t;
        tz = this.p[2] + this.v[2] * t;
        // reflect the prediction off the side walls, as the ball will
        const fold = (u) => {
          const p = 2 * (N - 1);
          u = ((u % p) + p) % p;
          return u > N - 1 ? p - u : u;
        };
        tx = fold(tx); tz = fold(tz);
      }
      // aim: contact off the paddle centre imparts lateral velocity (see step),
      // so bias the intercept to throw the ball away from the human's paddle.
      // Must stay inside the 1.5-cell half-width or the machine misses its own shot.
      const aim = 0.9 * skill;
      tx -= Math.sign(3.5 - this.pad[0] || 1) * aim;
      tz -= Math.sign(3.5 - this.pad[1] || 1) * aim;
      const rate = (2.6 + 6.2 * skill) * dt;   // cells/s, the only thing that makes it beatable
      const slop = (1 - skill) * 2.8;
      const gx = tx + (Math.random() - 0.5) * slop, gz = tz + (Math.random() - 0.5) * slop;
      this.ai[0] += Math.max(-rate, Math.min(rate, gx - this.ai[0]));
      this.ai[1] += Math.max(-rate, Math.min(rate, gz - this.ai[1]));
      this.ai[0] = Math.max(1, Math.min(N - 2, this.ai[0]));
      this.ai[1] = Math.max(1, Math.min(N - 2, this.ai[1]));
    }
    step(dt, skill) {
      this.event = null;
      if (this.wait > 0) { this.wait -= dt; return; }
      this.think(skill, dt);
      for (let i = 0; i < 3; i += 2) {           // x and z bounce off the walls
        this.p[i] += this.v[i] * dt;
        if (this.p[i] < 0) { this.p[i] = 0; this.v[i] = Math.abs(this.v[i]); }
        if (this.p[i] > N - 1) { this.p[i] = N - 1; this.v[i] = -Math.abs(this.v[i]); }
      }
      this.p[1] += this.v[1] * dt;

      const hit = (pad) => Math.abs(this.p[0] - pad[0]) <= 1.5 && Math.abs(this.p[2] - pad[1]) <= 1.5;
      if (this.p[1] <= 0.5 && this.v[1] < 0) {
        if (hit(this.pad)) {
          this.v[1] = Math.abs(this.v[1]) * 1.04;
          this.v[0] += (this.p[0] - this.pad[0]) * 2.7;
          this.v[2] += (this.p[2] - this.pad[1]) * 2.7;
          this.p[1] = 0.5; this.event = 'save';
        } else { this.robot++; this.event = 'robot'; this.serve(1); }
      } else if (this.p[1] >= N - 1.5 && this.v[1] > 0) {
        if (hit(this.ai)) {
          this.v[1] = -Math.abs(this.v[1]) * 1.04;
          this.v[0] += (this.p[0] - this.ai[0]) * 2.7;
          this.v[2] += (this.p[2] - this.ai[1]) * 2.7;
          this.p[1] = N - 1.5; this.event = 'block';
        } else { this.human++; this.event = 'human'; this.serve(-1); }
      }
      const sp = Math.hypot(this.v[0], this.v[2]);
      if (sp > 9.6) { this.v[0] *= 9.6 / sp; this.v[2] *= 9.6 / sp; }
      if (Math.abs(this.v[1]) > 18) this.v[1] = Math.sign(this.v[1]) * 18;
    }
    render(c) {
      c.clear();
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        c.set(this.pad[0] + a, 0, this.pad[1] + b, 1);
        c.set(this.ai[0] + a, N - 1, this.ai[1] + b, 1);
      }
      c.set(this.p[0], this.p[1], this.p[2], 1);
    }
  }

  window.LEDCUBE = { N, Cube, ANIM, ANIM_LIST, FONT, glyph, Snake, Pong, Liquid, gravityInCube };
})();

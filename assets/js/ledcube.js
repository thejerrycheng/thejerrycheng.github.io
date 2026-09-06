/* ============================================================================
   ledcube.js — an 8×8×8 LED cube in the browser.

   The hardware is 512 LEDs driven by nine daisy-chained shift registers over
   SPI: eight registers hold one layer's 64 anodes, the ninth selects which of
   the eight cathode layers is grounded. Only one layer is ever lit. The whole
   cube is an illusion held together by refreshing the layers faster than the
   eye can follow — which is what the refresh-rate slider on the page takes
   away from you.
   ========================================================================= */
(function () {
  'use strict';
  const N = 8;
  const idx = (x, y, z) => (z * N + y) * N + x;

  class Cube {
    constructor() {
      this.buf = new Uint8Array(N * N * N);
      this.layer = 0;                 // the layer the hardware is lighting now
      this.N = N;
    }
    clear() { this.buf.fill(0); }
    set(x, y, z, v) {
      if (x < 0 || y < 0 || z < 0 || x >= N || y >= N || z >= N) return;
      this.buf[idx(x, y, z)] = v ? 1 : 0;
    }
    get(x, y, z) {
      if (x < 0 || y < 0 || z < 0 || x >= N || y >= N || z >= N) return 0;
      return this.buf[idx(x, y, z)];
    }
    /** Advance the multiplexer by one layer, as the ISR does on the Mega. */
    tickLayer() { this.layer = (this.layer + 1) % N; }
  }

  // ---- animations ------------------------------------------------------------
  const ANIM = {
    wave(c, t) {
      c.clear();
      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          const d = Math.hypot(x - 3.5, y - 3.5);
          const z = Math.round(3.5 + 3.0 * Math.sin(d * 0.9 - t * 3.2));
          c.set(x, y, z, 1);
        }
      }
    },
    rain(c, t, st) {
      if (!st.drops) {
        st.drops = [];
        for (let i = 0; i < 22; i++) {
          st.drops.push([Math.floor(Math.random() * N), Math.floor(Math.random() * N),
                         Math.random() * N]);
        }
      }
      c.clear();
      st.drops.forEach((d) => {
        d[2] -= 0.09;
        if (d[2] < 0) { d[0] = Math.floor(Math.random() * N); d[1] = Math.floor(Math.random() * N); d[2] = N - 1; }
        c.set(d[0], d[1], Math.round(d[2]), 1);
      });
    },
    firework(c, t, st) {
      if (!st.t0 || t - st.t0 > 2.4) {
        st.t0 = t;
        st.cx = 1 + Math.random() * 5; st.cy = 1 + Math.random() * 5;
      }
      c.clear();
      const dt = t - st.t0;
      if (dt < 0.9) {
        c.set(Math.round(st.cx), Math.round(st.cy), Math.round(dt / 0.9 * 6), 1);
      } else {
        const r = (dt - 0.9) * 4.5;
        for (let a = 0; a < 14; a++) {
          for (let b = 0; b < 7; b++) {
            const th = a / 14 * 2 * Math.PI, ph = b / 6 * Math.PI;
            c.set(Math.round(st.cx + r * Math.sin(ph) * Math.cos(th)),
                  Math.round(st.cy + r * Math.sin(ph) * Math.sin(th)),
                  Math.round(6 + r * Math.cos(ph)), 1);
          }
        }
      }
    },
    spin(c, t) {
      c.clear();
      const a = t * 1.6;
      for (let z = 0; z < N; z++) {
        for (let k = -4; k <= 4; k++) {
          c.set(Math.round(3.5 + k * Math.cos(a + z * 0.25)),
                Math.round(3.5 + k * Math.sin(a + z * 0.25)), z, 1);
        }
      }
    }
  };

  // ---- 3-D snake, the game they actually built --------------------------------
  class Snake {
    constructor() { this.reset(); }
    reset() {
      this.body = [[3, 3, 3], [2, 3, 3], [1, 3, 3]];
      this.dir = [1, 0, 0];
      this.next = [1, 0, 0];
      this.food = this.spawn();
      this.dead = false;
      this.score = 0;
    }
    spawn() {
      for (;;) {
        const f = [0, 0, 0].map(() => Math.floor(Math.random() * N));
        if (!this.body.some((b) => b[0] === f[0] && b[1] === f[1] && b[2] === f[2])) return f;
      }
    }
    /** Turn, refusing a straight reversal the way the PS2 build did. */
    steer(d) {
      const h = this.dir;
      if (d[0] === -h[0] && d[1] === -h[1] && d[2] === -h[2]) return;
      this.next = d;
    }
    step() {
      if (this.dead) return;
      this.dir = this.next;
      const h = this.body[0];
      const nh = [h[0] + this.dir[0], h[1] + this.dir[1], h[2] + this.dir[2]];
      if (nh.some((v) => v < 0 || v >= N)
          || this.body.some((b) => b[0] === nh[0] && b[1] === nh[1] && b[2] === nh[2])) {
        this.dead = true; return;
      }
      this.body.unshift(nh);
      if (nh[0] === this.food[0] && nh[1] === this.food[1] && nh[2] === this.food[2]) {
        this.score++; this.food = this.spawn();
      } else this.body.pop();
    }
    render(c, blink) {
      c.clear();
      this.body.forEach((b) => c.set(b[0], b[1], b[2], 1));
      if (blink) c.set(this.food[0], this.food[1], this.food[2], 1);
    }
  }

  window.LEDCUBE = { N, Cube, ANIM, Snake };
})();

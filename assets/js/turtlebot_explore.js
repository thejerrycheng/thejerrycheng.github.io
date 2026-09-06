/* ============================================================================
   turtlebot_explore.js — occupancy-grid exploration of a 6 × 6 m room.

   The MIE443 Contest 1 question: which exploration strategy covers the most of
   an unknown room inside the time limit? The robot is a TurtleBot 2 — a
   differential base with a 57° Kinect, three front bumpers and odometry,
   running GMapping. Here the map is an occupancy grid updated by ray casting,
   which is what GMapping is doing underneath once the pose is good.

   Same four strategies and the same constants as scripts/tools/explore.py in
   the repo.
   ========================================================================= */
(function () {
  'use strict';
  const RES = 0.05, SIZE = 6.0, N = Math.round(SIZE / RES);
  const FOV = 57 * Math.PI / 180, MAX_RANGE = 4.0, N_BEAMS = 31;
  const V = 0.25, W = 1.2, DT = 0.1;
  const UNKNOWN = 0, FREE = 1, OCC = 2;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function makeRoom(seed, nObst) {
    const rng = mulberry32(seed);
    const g = new Uint8Array(N * N);
    for (let i = 0; i < N; i++) { g[i * N] = 1; g[i * N + N - 1] = 1; g[i] = 1; g[(N - 1) * N + i] = 1; }
    for (let k = 0; k < (nObst == null ? 7 : nObst); k++) {
      const w = 6 + Math.floor(rng() * 16), h = 6 + Math.floor(rng() * 16);
      const x = 8 + Math.floor(rng() * (N - w - 16)), y = 8 + Math.floor(rng() * (N - h - 16));
      for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) g[i * N + j] = 1;
    }
    return g;
  }

  class Robot {
    constructor(room, seed) {
      this.room = room;
      this.rng = mulberry32(seed ^ 0x9e37);
      let i, j;
      for (;;) {
        i = 4 + Math.floor(this.rng() * (N - 8));
        j = 4 + Math.floor(this.rng() * (N - 8));
        let clear = true;
        for (let a = -3; a <= 3 && clear; a++) for (let b = -3; b <= 3; b++) {
          if (room[(i + a) * N + (j + b)]) { clear = false; break; }
        }
        if (clear) break;
      }
      this.p = [i * RES, j * RES];
      this.th = this.rng() * 2 * Math.PI - Math.PI;
      this.map = new Uint8Array(N * N);
      this.t = 0; this.bumps = 0; this.stuck = 0; this.lastSeen = 0;
      this.path = null; this.goalAge = 0;
      this.trail = [this.p.slice()];
      this.freeCells = 0;
      for (let k = 0; k < N * N; k++) if (!room[k]) this.freeCells++;
    }
    cell(p) {
      return [Math.max(0, Math.min(N - 1, Math.floor(p[0] / RES))),
              Math.max(0, Math.min(N - 1, Math.floor(p[1] / RES)))];
    }
    scan() {
      const r = new Float64Array(N_BEAMS);
      for (let b = 0; b < N_BEAMS; b++) {
        const a = -FOV / 2 + b / (N_BEAMS - 1) * FOV;
        const th = this.th + a, c = Math.cos(th), s = Math.sin(th);
        let d = 0, hit = false;
        while (d < MAX_RANGE) {
          d += RES * 0.7;
          const i = Math.max(0, Math.min(N - 1, Math.floor((this.p[0] + d * c) / RES)));
          const j = Math.max(0, Math.min(N - 1, Math.floor((this.p[1] + d * s) / RES)));
          const k = i * N + j;
          if (this.room[k]) { this.map[k] = OCC; hit = true; break; }
          if (this.map[k] < FREE) this.map[k] = FREE;
        }
        r[b] = hit ? d : MAX_RANGE;
      }
      return r;
    }
    coverage() {
      let n = 0;
      for (let k = 0; k < N * N; k++) if (this.map[k] === FREE && !this.room[k]) n++;
      return n / Math.max(this.freeCells, 1);
    }
    drive(v, w) {
      const nth = this.th + w * DT;
      const np = [this.p[0] + v * DT * Math.cos(nth), this.p[1] + v * DT * Math.sin(nth)];
      const [i, j] = this.cell(np);
      if (this.room[i * N + j]) {
        this.bumps++;
        this.th = nth + 2.0 + this.rng() * 2.3;
        return false;
      }
      this.p = np; this.th = nth;
      if (this.trail.length < 4000 && this.trail.length % 1 === 0) this.trail.push(np.slice());
      return true;
    }
    front(r) { let m = 1e9; for (let k = 12; k <= 18; k++) m = Math.min(m, r[k]); return m; }
    side(r, hi) { let m = 1e9; for (let k = 0; k < 8; k++) m = Math.min(m, r[hi ? N_BEAMS - 1 - k : k]); return m; }

    actRandom(r) {
      if (this.front(r) < 0.5) return [0, W * (this.rng() < 0.5 ? 1 : -1)];
      return [V, (this.rng() - 0.5) * 0.5];
    }
    actReactive(r) {
      const f = this.front(r), l = this.side(r, true), R = this.side(r, false);
      if (f < 0.6) return [0, W * (l > R ? 1 : -1)];
      const near = Math.min(l, R), sign = l < R ? 1 : -1;
      return [V, Math.max(-W, Math.min(W, (0.7 - near) * 2.0)) * sign];
    }
    frontierPath(minCells) {
      minCells = minCells == null ? 12 : minCells;
      const [si, sj] = this.cell(this.p);
      if (this.map[si * N + sj] !== FREE) return null;
      const parent = new Int32Array(N * N).fill(-2);
      const dist = new Int32Array(N * N);
      const q = new Int32Array(N * N);
      let head = 0, tail = 0;
      const s0 = si * N + sj;
      parent[s0] = -1; q[tail++] = s0;
      let goal = -1, fallback = -1;
      while (head < tail) {
        const c = q[head++], i = (c / N) | 0, j = c % N, d = dist[c];
        const nb = [(i+1)*N+j, (i-1)*N+j, i*N+j+1, i*N+j-1];
        let touchesUnknown = false;
        if (i > 0 && i < N-1 && j > 0 && j < N-1) {
          for (const k of nb) if (this.map[k] === UNKNOWN) { touchesUnknown = true; break; }
        }
        if (touchesUnknown) {
          if (d >= minCells) { goal = c; break; }
          if (fallback < 0) fallback = c;
        }
        for (const k of nb) {
          if (k < 0 || k >= N * N) continue;
          if (parent[k] === -2 && this.map[k] === FREE) {
            parent[k] = c; dist[k] = d + 1; q[tail++] = k;
          }
        }
      }
      if (goal < 0) goal = fallback;
      if (goal < 0) return null;
      const path = [];
      let c = goal;
      while (c >= 0) { path.push([(c / N) | 0, c % N]); c = parent[c]; }
      path.reverse();
      const out = [];
      for (let k = 0; k < path.length; k += 4) out.push(path[k]);
      out.push(path[path.length - 1]);
      return out;
    }
    actFrontier(r) {
      if (!this.path || !this.path.length || this.goalAge > 120) {
        this.path = this.frontierPath(); this.goalAge = 0;
      }
      this.goalAge++;
      if (!this.path || !this.path.length) return this.actRandom(r);
      let gp = [this.path[0][0] * RES, this.path[0][1] * RES];
      while (Math.hypot(gp[0] - this.p[0], gp[1] - this.p[1]) < 0.12) {
        this.path.shift();
        if (!this.path.length) { this.path = null; return [0, 0]; }
        gp = [this.path[0][0] * RES, this.path[0][1] * RES];
      }
      const want = Math.atan2(gp[1] - this.p[1], gp[0] - this.p[0]);
      const err = ((want - this.th + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      if (this.front(r) < 0.35) { this.path = null; return [0, W * (err >= 0 ? 1 : -1)]; }
      const w = Math.max(-W, Math.min(W, 2.5 * err));
      return Math.abs(err) > 0.6 ? [0, w] : [V, w];
    }
    actHybrid(r) {
      let seen = 0;
      for (let k = 0; k < N * N; k++) if (this.map[k] === FREE) seen++;
      if (seen - this.lastSeen < 12) this.stuck += DT;
      else { this.stuck = 0; this.lastSeen = seen; }
      if (this.stuck > 8.0) return this.actFrontier(r);
      this.path = null;
      return this.actReactive(r);
    }
    step(strategy) {
      const r = this.scan();
      const fn = { random: 'actRandom', reactive: 'actReactive',
                   frontier: 'actFrontier', hybrid: 'actHybrid' }[strategy];
      const [v, w] = this[fn](r);
      this.drive(v, w);
      this.t += DT;
      return r;
    }
  }

  window.TURTLEBOT = { N, RES, SIZE, UNKNOWN, FREE, OCC, makeRoom, Robot, mulberry32,
                       STRATEGIES: ['random', 'reactive', 'frontier', 'hybrid'] };
})();

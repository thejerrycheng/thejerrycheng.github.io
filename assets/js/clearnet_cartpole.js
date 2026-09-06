/* ============================================================================
   clearnet_cartpole.js — CartPole-v1 and tabular Q-learning, in the browser.

   The dynamics are Gymnasium's CartPole-v1 exactly (semi-implicit Euler,
   tau = 0.02 s, 10 N force, 0.5 m pole half-length, ±12° and ±2.4 m limits),
   and the observation noise is the wrapper from the project's
   environment_with_noise.py:

       obs = s + N(0, sigma) * [2, 0.5, radians(2), radians(0.5)]

   so sigma scales a per-component range rather than being an absolute standard
   deviation. Same equations as scripts/tools/cartpole.py in the repo, so a
   Q-table trained here behaves like one trained offline.
   ========================================================================= */
(function () {
  'use strict';

  const P = {
    g: 9.8, mCart: 1.0, mPole: 0.1, length: 0.5, forceMag: 10.0, tau: 0.02,
    thetaLimit: 12 * Math.PI / 180, xLimit: 2.4, maxSteps: 500
  };
  P.mTotal = P.mCart + P.mPole;
  P.poleMassLength = P.mPole * P.length;
  const NOISE_RANGES = [2.0, 0.5, 2 * Math.PI / 180, 0.5 * Math.PI / 180];

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(rng) {
    const u = Math.max(rng(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }

  class CartPole {
    constructor(opts) {
      const o = opts || {};
      this.noise = o.noise || 0;
      this.rng = o.rng || Math.random;
      this.maxSteps = o.maxSteps || P.maxSteps;
      this.reset();
    }
    reset(state) {
      this.s = state ? state.slice()
        : [0, 1, 2, 3].map(() => this.rng() * 0.1 - 0.05);
      this.steps = 0; this.done = false;
      return this.observe();
    }
    observe() {
      if (this.noise <= 0) return this.s.slice();
      return this.s.map((v, i) => v + gauss(this.rng) * this.noise * NOISE_RANGES[i]);
    }
    step(action) {
      let [x, xd, th, thd] = this.s;
      const force = action === 1 ? P.forceMag : -P.forceMag;
      const c = Math.cos(th), s = Math.sin(th);
      const temp = (force + P.poleMassLength * thd * thd * s) / P.mTotal;
      const thAcc = (P.g * s - c * temp)
        / (P.length * (4 / 3 - P.mPole * c * c / P.mTotal));
      const xAcc = temp - P.poleMassLength * thAcc * c / P.mTotal;
      xd += P.tau * xAcc; x += P.tau * xd;
      thd += P.tau * thAcc; th += P.tau * thd;
      this.s = [x, xd, th, thd];
      this.steps++;
      this.done = Math.abs(x) > P.xLimit || Math.abs(th) > P.thetaLimit
                  || this.steps >= this.maxSteps;
      return this.observe();
    }
  }

  // ---- tabular Q-learning ---------------------------------------------------
  const BINS = [8, 12, 8, 12];
  // The limits the released QLearning.py uses. The first is (-2.4, 24) —
  // almost certainly a typo for (-2.4, 2.4). Reachable positions then occupy
  // 18 % of the range, so every legal cart position lands in bin 0 or 1.
  const LIMITS_RELEASED = [[-2.4, 24.0], [-10, 10],
                           [-12 * Math.PI / 180, 12 * Math.PI / 180],
                           [-10 * Math.PI / 180, 10 * Math.PI / 180]];
  const LIMITS_FIXED = [[-2.4, 2.4], [-10, 10],
                        [-12 * Math.PI / 180, 12 * Math.PI / 180],
                        [-10 * Math.PI / 180, 10 * Math.PI / 180]];

  class QTable {
    constructor(bins, limits) {
      this.bins = bins || BINS;
      this.limits = limits || LIMITS_FIXED;
      this.n = this.bins.reduce((a, b) => a * b, 1);
      this.q = new Float32Array(this.n * 2);
      this.visits = new Uint32Array(this.n);
      this.episodes = 0;
      this.eps = 1.0;
    }
    index(obs) {
      let idx = 0;
      for (let i = 0; i < 4; i++) {
        const [lo, hi] = this.limits[i];
        let b = Math.round((this.bins[i] - 1) * (obs[i] - lo) / (hi - lo));
        b = Math.max(0, Math.min(this.bins[i] - 1, b));
        idx = idx * this.bins[i] + b;
      }
      return idx;
    }
    greedy(obs) {
      const i = this.index(obs) * 2;
      return this.q[i + 1] > this.q[i] ? 1 : 0;
    }
    /** One episode of Q-learning; returns the number of steps survived. */
    episode(env, opts) {
      const o = Object.assign({ alpha: 0.1, gamma: 0.99, epsDecay: 0.9985,
                                epsMin: 0.02, shaped: true }, opts || {});
      let obs = env.reset();
      let s = this.index(obs), steps = 0;
      for (;;) {
        const a = env.rng() < this.eps ? (env.rng() < 0.5 ? 0 : 1)
                                       : (this.q[s * 2 + 1] > this.q[s * 2] ? 1 : 0);
        obs = env.step(a);
        let r = 1;
        if (o.shaped) {
          r = 1 - 0.5 * Math.abs(env.s[0]) / P.xLimit
                - 0.5 * Math.abs(env.s[2]) / P.thetaLimit;
        }
        const s2 = this.index(obs);
        const best = env.done ? 0 : Math.max(this.q[s2 * 2], this.q[s2 * 2 + 1]);
        const k = s * 2 + a;
        this.q[k] += o.alpha * (r + o.gamma * best - this.q[k]);
        this.visits[s]++;
        s = s2; steps++;
        if (env.done) break;
      }
      this.episodes++;
      this.eps = Math.max(o.epsMin, this.eps * o.epsDecay);
      return steps;
    }
    statesVisited() {
      let n = 0;
      for (let i = 0; i < this.n; i++) if (this.visits[i]) n++;
      return n;
    }
  }

  window.CLEARNET = { P, CartPole, QTable, BINS, LIMITS_FIXED, LIMITS_RELEASED,
                      mulberry32, NOISE_RANGES };
})();

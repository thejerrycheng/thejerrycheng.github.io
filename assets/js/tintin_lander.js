/* ============================================================================
   tintin_lander.js — a browser transliteration of RocketGym-planar, the
   planar (x, z, theta) slice of the 6-DoF RocketGym environment from the
   TINTIN report (ROB-GY 7863, Project 2).

   Every constant below is Table I of the report, and the equations are the
   same ones in scripts/tools/rocketgym_planar.py in the project repo, so
   flying this by hand and running the offline Monte Carlo exercise the same
   dynamics.
   ========================================================================= */
(function () {
  'use strict';

  // ---- Table I: rocket physical and propulsion parameters (lunar) ----------
  const P = {
    gMoon: 1.62, g0: 9.81, Isp: 400,
    mWet: 5.0e6, dryFrac: 0.10,
    twr: 3.0,
    Lveh: 100, Lgim: 30,
    gimbalMax: 30 * Math.PI / 180,
    zTouch: 55,
    dt: 0.05, maxSteps: 2000,
    maxLateral: 700, maxSpeed: 200, maxTilt: 100 * Math.PI / 180,
    okRadius: 80, okTilt: 15 * Math.PI / 180, okVz: 20
  };
  const derived = (p) => {
    const mDry = p.dryFrac * p.mWet;
    return { mDry, mProp: p.mWet - mDry,
             Tmax: p.twr * p.mWet * p.gMoon,
             I0: p.mWet * p.Lveh * p.Lveh / 12 };
  };

  // ---- deterministic RNG so a seed reproduces a flight ----------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---- the environment ------------------------------------------------------
  class Rocket {
    constructor(p) { this.p = Object.assign({}, P, p || {}); this.d = derived(this.p); this.reset(); }
    setParam(k, v) { this.p[k] = v; this.d = derived(this.p); }

    reset(opts) {
      const o = opts || {};
      const rnd = o.rng || Math.random;
      this.x = o.x != null ? o.x : 500 + (rnd() * 40 - 20);
      this.z = o.z != null ? o.z : 500 + (rnd() * 100 - 50);
      if (o.vx != null) { this.vx = o.vx; this.vz = o.vz; }
      else {
        const sp = rnd() * 50, ang = rnd() * 2 * Math.PI;
        this.vx = sp * Math.cos(ang); this.vz = -Math.abs(sp * Math.sin(ang));
      }
      this.th = o.th != null ? o.th : (rnd() * 0.3 - 0.15);
      this.om = 0; this.m = this.p.mWet; this.t = 0; this.steps = 0;
      this.propUsed = 0; this.reward = 0; this.done = false; this.outcome = null;
      this.trail = [[this.x, this.z]];
      this.lastT = 0; this.lastG = 0;
      return this;
    }

    step(uT, uG) {
      if (this.done) return this;
      const p = this.p, d = this.d;
      uT = Math.max(-1, Math.min(1, uT)); uG = Math.max(-1, Math.min(1, uG));
      let T = d.Tmax * (uT + 1) / 2;
      const gim = p.gimbalMax * uG;
      if (this.m <= d.mDry) { T = 0; this.m = d.mDry; }

      const phi = this.th + gim;
      const ax = T * Math.sin(phi) / this.m;
      const az = T * Math.cos(phi) / this.m - p.gMoon;
      const inertia = d.I0 * this.m / p.mWet;
      const alpha = (-T * Math.sin(gim) * p.Lgim) / inertia;

      const dt = p.dt;
      this.vx += ax * dt; this.vz += az * dt;
      this.x += this.vx * dt; this.z += this.vz * dt;
      this.om += alpha * dt; this.th += this.om * dt;

      const burn = Math.min(T / (p.Isp * p.g0) * dt, Math.max(this.m - d.mDry, 0));
      this.m -= burn; this.propUsed += burn;
      this.t += dt; this.steps++;
      this.lastT = T; this.lastG = gim;

      if (this.steps % 4 === 0) this.trail.push([this.x, this.z]);
      this.reward += this.shaping();
      this.checkDone();
      return this;
    }

    /* Table III shaping terms, per step. */
    shaping() {
      return 15 * Math.cos(this.th) - 1 * Math.abs(this.vz) * 0.02
             - 0.05 * Math.abs(this.x) * 0.02 - 0.01;
    }

    checkDone() {
      const p = this.p, sp = Math.hypot(this.vx, this.vz);
      if (this.z <= p.zTouch) {
        this.done = true;
        const ok = Math.abs(this.x) <= p.okRadius && Math.abs(this.th) <= p.okTilt
                   && -this.vz >= 0 && -this.vz <= p.okVz;
        if (ok) {
          this.outcome = 'success';
          this.reward += 1000 + 5 * ((this.p.mWet - this.propUsed - this.d.mDry) / this.p.mWet);
        } else {
          this.outcome = Math.abs(this.th) > p.okTilt ? 'tilt'
                        : (-this.vz > p.okVz ? 'impact' : 'drift');
          this.reward += Math.abs(this.x) < 100 ? -90 : -100;
        }
      } else if (Math.abs(this.x) > p.maxLateral) { this.done = true; this.outcome = 'drift'; this.reward -= 500; }
      else if (sp > p.maxSpeed) { this.done = true; this.outcome = 'overspeed'; this.reward -= 500; }
      else if (Math.abs(this.th) > p.maxTilt) { this.done = true; this.outcome = 'tilt'; this.reward -= 500; }
      else if (this.steps >= p.maxSteps) { this.done = true; this.outcome = 'timeout'; }
    }
  }

  // ---- the report's cascaded PD baseline ------------------------------------
  const GAINS = { kpX: 0.004, kdX: 0.10, kdZ: 0.70, kpAtt: 0.16, kdAtt: 0.72, glide: 0.065 };

  function pid(r, gains) {
    const g = Object.assign({}, GAINS, gains || {}), p = r.p, d = r.d;
    const h = Math.max(r.z - p.zTouch, 0);
    const vzRef = -Math.max(1, Math.min(40, g.glide * h));
    const axDes = g.kpX * (0 - r.x) + g.kdX * (0 - r.vx);
    const azDes = g.kdZ * (vzRef - r.vz);
    const axT = axDes, azT = Math.max(azDes + p.gMoon, 0);
    let Tdes = Math.min(r.m * Math.hypot(axT, azT), d.Tmax);
    let phiDes = Math.atan2(axT, Math.max(azT, 0.2 * p.gMoon));
    const lim = 30 * Math.PI / 180;
    phiDes = Math.max(-lim, Math.min(lim, phiDes));
    const alphaDes = g.kpAtt * (phiDes - r.th) - g.kdAtt * r.om;
    const inertia = d.I0 * r.m / p.mWet;
    const lever = Math.max(Tdes, 0.05 * d.Tmax) * p.Lgim;
    const s = Math.max(-1, Math.min(1, alphaDes * inertia / lever));
    const thG = -Math.asin(s);
    return [Math.max(-1, Math.min(1, 2 * Tdes / d.Tmax - 1)),
            Math.max(-1, Math.min(1, thG / p.gimbalMax))];
  }

  // ---- drawing --------------------------------------------------------------
  const INK = '#151820', BONE = '#F4EAD2', HI = '#E4442A', POP = '#FFCE0A', GOLD = '#D9A13F';

  function fitView(cv) {
    const w = cv.width, h = cv.height;
    const worldW = 900, worldH = 640;        // metres
    const s = Math.min(w / worldW, h / worldH);
    const ox = w / 2 - 150 * s;              // pad slightly left of centre
    const oy = h - 40;
    return { s, X: (x) => ox + x * s, Y: (z) => oy - z * s };
  }

  function drawScene(cv, r, opts) {
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    const v = fitView(cv), o = opts || {};
    g.clearRect(0, 0, w, h);

    // sky
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0B0E16'); sky.addColorStop(1, '#1C2333');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);

    // stars (stable positions)
    g.fillStyle = 'rgba(244,234,210,0.55)';
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 8461) % 1000) / 1000 * w, sy = ((i * 3719) % 1000) / 1000 * h * 0.7;
      g.fillRect(sx, sy, 1.6, 1.6);
    }

    // ground
    const gy = v.Y(0);
    g.fillStyle = '#2A3245'; g.fillRect(0, gy, w, h - gy);
    g.strokeStyle = BONE; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, gy); g.lineTo(w, gy); g.stroke();
    g.fillStyle = 'rgba(244,234,210,0.14)';
    for (let i = 0; i < 9; i++) {
      const cx = (i * 137) % w, rr = 8 + (i * 13) % 22;
      g.beginPath(); g.ellipse(cx, gy + 12 + (i % 3) * 9, rr, rr * 0.32, 0, 0, 7); g.fill();
    }

    // success box (+-80 m) and pad
    g.setLineDash([6, 5]); g.strokeStyle = 'rgba(255,206,10,0.75)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(v.X(-r.p.okRadius), gy); g.lineTo(v.X(-r.p.okRadius), v.Y(120));
    g.moveTo(v.X(r.p.okRadius), gy); g.lineTo(v.X(r.p.okRadius), v.Y(120)); g.stroke();
    g.setLineDash([]);
    g.fillStyle = POP; g.fillRect(v.X(-22), gy - 5, 44 * v.s, 6);
    g.font = '11px "Space Mono", monospace'; g.fillStyle = POP;
    g.fillText('TARGET  ±80 m', v.X(-r.p.okRadius), v.Y(132));

    // trajectory trail
    if (r.trail.length > 1) {
      g.strokeStyle = 'rgba(228,68,42,0.85)'; g.lineWidth = 2; g.beginPath();
      r.trail.forEach((pt, i) => i ? g.lineTo(v.X(pt[0]), v.Y(pt[1])) : g.moveTo(v.X(pt[0]), v.Y(pt[1])));
      g.stroke();
    }

    // ghost bundle from a Monte Carlo run
    if (o.bundle) {
      g.lineWidth = 1;
      o.bundle.forEach((b) => {
        g.strokeStyle = b.ok ? 'rgba(126,217,87,0.28)' : 'rgba(228,68,42,0.20)';
        g.beginPath();
        b.pts.forEach((pt, i) => i ? g.lineTo(v.X(pt[0]), v.Y(pt[1])) : g.moveTo(v.X(pt[0]), v.Y(pt[1])));
        g.stroke();
      });
    }

    // rocket
    const px = v.X(r.x), py = v.Y(r.z), L = r.p.Lveh * v.s, W = Math.max(4, L * 0.14);
    g.save(); g.translate(px, py); g.rotate(r.th);
    g.fillStyle = BONE; g.strokeStyle = INK; g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -L / 2);                     // nose
    g.lineTo(W / 2, -L / 2 + W * 1.1);
    g.lineTo(W / 2, L / 2); g.lineTo(-W / 2, L / 2);
    g.lineTo(-W / 2, -L / 2 + W * 1.1); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = HI; g.fillRect(-W / 2, -L / 6, W, W * 0.5);   // stripe
    // fins
    g.fillStyle = GOLD;
    g.beginPath(); g.moveTo(-W / 2, L / 2); g.lineTo(-W * 1.25, L / 2 + W * 0.7); g.lineTo(-W / 2, L / 2 - W * 0.9); g.fill();
    g.beginPath(); g.moveTo(W / 2, L / 2); g.lineTo(W * 1.25, L / 2 + W * 0.7); g.lineTo(W / 2, L / 2 - W * 0.9); g.fill();
    // plume, rotated by the gimbal
    const thr = r.lastT / r.d.Tmax;
    if (thr > 0.02) {
      g.save(); g.translate(0, L / 2); g.rotate(r.lastG);
      const pl = W * (2 + 9 * thr);
      const grad = g.createLinearGradient(0, 0, 0, pl);
      grad.addColorStop(0, 'rgba(255,206,10,0.95)');
      grad.addColorStop(0.5, 'rgba(228,68,42,0.7)');
      grad.addColorStop(1, 'rgba(228,68,42,0)');
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(-W * 0.42, 0); g.lineTo(W * 0.42, 0);
      g.lineTo(W * 0.16, pl); g.lineTo(-W * 0.16, pl); g.closePath(); g.fill();
      g.restore();
    }
    g.restore();
  }

  // ---- Monte Carlo ----------------------------------------------------------
  function monteCarlo(n, seed, params, gains, keepTraces) {
    const rng = mulberry32(seed >>> 0);
    const out = { n, success: 0, modes: {}, radius: [], tilt: [], vz: [], prop: [], bundle: [] };
    for (let i = 0; i < n; i++) {
      const r = new Rocket(params);
      r.reset({ rng });
      const pts = [[r.x, r.z]];
      while (!r.done) {
        const u = pid(r, gains);
        r.step(u[0], u[1]);
        if (r.steps % 12 === 0) pts.push([r.x, r.z]);
      }
      pts.push([r.x, r.z]);
      const ok = r.outcome === 'success';
      if (ok) out.success++;
      out.modes[r.outcome] = (out.modes[r.outcome] || 0) + 1;
      out.radius.push(Math.abs(r.x)); out.tilt.push(Math.abs(r.th) * 180 / Math.PI);
      out.vz.push(Math.abs(r.vz)); out.prop.push(r.propUsed / r.d.mProp);
      if (keepTraces && i < 120) out.bundle.push({ ok, pts });
    }
    return out;
  }

  const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };

  window.TINTIN = { P, Rocket, pid, drawScene, monteCarlo, mulberry32, GAINS, mean, median, derived };
})();

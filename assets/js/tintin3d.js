/* ============================================================================
   tintin3d.js — the 6-DoF lunar lander in the browser.

   A transliteration of the MuJoCo vehicle in
   assets/mjcf/realistic_param.xml, as driven by
   rocket_env/rocket_dr_env.py in github.com/thejerrycheng/space_robot_mujoco:

     - 5,000 t dry, 1,000 t of propellant, Isp 250 s, lunar gravity 1.62 m/s^2
     - single engine 30 m below the centre of mass, 2-DoF gimbal, +-30 deg
     - 25 MN maximum thrust  (thrust-to-weight 3 at the wet mass)
     - inertia diag(1.2e9, 1.2e9, 3.0e7) kg m^2, scaled with the mass burnt off
     - RK4, dt = 0.01 s, exactly as MuJoCo integrates it

   The gimbal servos are treated as instantaneous: their joints carry 1e-4 kg m^2
   against a unit-gain position servo, so they settle two orders of magnitude
   faster than the vehicle.

   Both controllers on the page run against this model: the cascaded 3-D PD from
   scripts/tools/pd3d.py, and the SAC policy, whose weights are loaded from JSON
   and evaluated with the same observation the training environment builds.
   ========================================================================= */
(function () {
  'use strict';

  const P = {
    g: 1.62, g0: 1.62, isp: 250,
    dryMass: 5.0e6, fuel: 1.0e6,
    maxThrust: 25.0e6,
    gimbalMax: 30 * Math.PI / 180,
    L: 30.0,
    I0: [1.2e9, 1.2e9, 3.0e7],
    dt: 0.01,
    maxSteps: 4500,
    targetZ: 1.0,
    maxLateral: 150, maxSpeed: 100,
    okLateral: 10, okSpeed: 3, okTiltDeg: 15,   // angle from vertical
    // Touchdown height depends on tilt.  Bisecting the resting height of the
    // MuJoCo mesh over a range of tilts gives
    //     z_contact = 1.000 + 0.2475 * tilt[deg]      (R^2 > 0.999)
    // because the vehicle is 100 m long with a ~17 m fin radius: a tilted
    // lander puts a fin into the ground with its centre of mass ten metres up.
    contactZ: 0.995, contactSlope: 0.2475,
    // The gimbal servos are not instantaneous.  A commanded step of 0.3 rad in
    // MuJoCo overshoots to 0.415 and rings out over ~0.2 s, which fits a
    // second-order system with wn = 54.5 rad/s and zeta = 0.30.  Modelling it
    // matters: without it the browser and MuJoCo trajectories part company
    // after about twenty seconds of flight.
    gimbalWn: 54.5, gimbalZeta: 0.30
  };

  // ---- quaternion helpers (w, x, y, z) --------------------------------------
  function qmul(a, b) {
    return [a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
            a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
            a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],
            a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
  }
  function qnorm(q) {
    const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
    return [q[0]/n, q[1]/n, q[2]/n, q[3]/n];
  }
  function qmat(q) {
    const [w,x,y,z] = q;
    return [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w),
            2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w),
            2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)];
  }
  const rot = (R, v) => [R[0]*v[0]+R[1]*v[1]+R[2]*v[2],
                         R[3]*v[0]+R[4]*v[1]+R[5]*v[2],
                         R[6]*v[0]+R[7]*v[1]+R[8]*v[2]];
  const rotT = (R, v) => [R[0]*v[0]+R[3]*v[1]+R[6]*v[2],
                          R[1]*v[0]+R[4]*v[1]+R[7]*v[2],
                          R[2]*v[0]+R[5]*v[1]+R[8]*v[2]];

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const gauss = (rng) => {
    const u = Math.max(rng(), 1e-9), v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // ---- the vehicle ----------------------------------------------------------
  class Lander {
    constructor(opts) {
      this.P = Object.assign({}, P, opts || {});
      this.dr = { mass: 1, fuel: 1, isp: 1, thrust: 1, biasY: 0, biasP: 0, wind: [0, 0, 0] };
      this.reset({});
    }

    /** Resample the vehicle the way rocket_dr_env does at every reset. */
    randomizeVehicle(rng, amount) {
      const k = amount == null ? 1 : amount;
      const u = (lo, hi) => 1 + ((lo + rng() * (hi - lo)) - 1) * k;
      this.dr.mass = u(0.85, 1.15);
      this.dr.fuel = u(0.70, 1.30);
      this.dr.isp = u(0.90, 1.10);
      this.dr.thrust = u(0.85, 1.15);
      const b = 2 * Math.PI / 180 * k;
      this.dr.biasY = (rng() * 2 - 1) * b;
      this.dr.biasP = (rng() * 2 - 1) * b;
      const ang = rng() * 2 * Math.PI, w = rng() * 0.25 * k;
      this.dr.wind = [w * Math.cos(ang), w * Math.sin(ang), 0];
    }

    reset(o) {
      o = o || {};
      const rng = o.rng || Math.random;
      if (o.randomize) this.randomizeVehicle(rng, o.drAmount);
      else this.dr = { mass: 1, fuel: 1, isp: 1, thrust: 1, biasY: 0, biasP: 0, wind: [0, 0, 0] };

      this.dryMass = this.P.dryMass * this.dr.mass;
      this.startFuel = this.P.fuel * this.dr.fuel;
      this.isp = this.P.isp * this.dr.isp;
      this.maxThrust = this.P.maxThrust * this.dr.thrust;
      this.wetMass = this.dryMass + this.startFuel;
      this.fuel = this.startFuel;

      const alt = o.altitude != null ? o.altitude : 120;
      const lat = o.lateral != null ? o.lateral : 40;
      const vstd = o.velStd != null ? o.velStd : 4;
      const tiltDeg = o.tiltDeg != null ? o.tiltDeg : 12;

      const rad = Math.sqrt(rng()) * lat, th = rng() * 2 * Math.PI;
      this.p = [rad * Math.cos(th), rad * Math.sin(th), this.P.targetZ + Math.max(alt, 5)];
      this.v = [gauss(rng) * vstd, gauss(rng) * vstd, gauss(rng) * vstd - 2];
      if (tiltDeg > 0) {
        const t = rng() * tiltDeg * Math.PI / 180, ax = rng() * 2 * Math.PI;
        this.q = [Math.cos(t / 2), Math.cos(ax) * Math.sin(t / 2), Math.sin(ax) * Math.sin(t / 2), 0];
      } else this.q = [1, 0, 0, 0];
      this.w = [0, 0, 0];

      this.t = 0; this.steps = 0; this.done = false; this.outcome = null;
      this.thrust = 0;
      this.gy = 0; this.gp = 0;          // actual gimbal angles
      this.gyd = 0; this.gpd = 0;        // their rates
      this.trail = [this.p.slice()];
      return this;
    }

    mass() { return this.dryMass + this.fuel; }
    inertia() {
      const s = this.mass() / this.wetMass;
      return [this.P.I0[0] * s, this.P.I0[1] * s, this.P.I0[2] * s];
    }
    alt() { return this.p[2] - this.P.targetZ; }
    lateral() { return Math.hypot(this.p[0], this.p[1]); }
    speed() { return Math.hypot(this.v[0], this.v[1], this.v[2]); }
    /* Angle between the body axis and vertical.  NOT 2 acos|q_w|, which also
       counts rotation about the vehicle's own axis — unactuated here, and
       harmless. */
    tiltDeg() {
      const R = qmat(this.q);
      return Math.acos(Math.max(-1, Math.min(1, R[8]))) * 180 / Math.PI;
    }
    contactHeight() { return this.P.contactZ + this.P.contactSlope * this.tiltDeg(); }

    /** Continuous-time derivative for a given state, used by RK4. */
    deriv(s, T, gyCmd, gpCmd) {
      const [px, py, pz, vx, vy, vz, qw, qx, qy, qz, wx, wy, wz, gy, gyd, gp, gpd] = s;
      const q = qnorm([qw, qx, qy, qz]);
      const R = qmat(q);
      const cg = Math.cos(gp);
      const Fb = [T * Math.sin(gp), -T * Math.sin(gy) * cg, T * Math.cos(gy) * cg];
      const Fw = rot(R, Fb);
      const m = this.mass();
      const a = [Fw[0] / m + this.dr.wind[0], Fw[1] / m + this.dr.wind[1],
                 Fw[2] / m - this.P.g + this.dr.wind[2]];
      // tau = r x F with r = (0, 0, -L)
      const L = this.P.L;
      const tau = [L * Fb[1], -L * Fb[0], 0];
      const I = this.inertia();
      const Iw = [I[0] * wx, I[1] * wy, I[2] * wz];
      const cross = [wy * Iw[2] - wz * Iw[1], wz * Iw[0] - wx * Iw[2], wx * Iw[1] - wy * Iw[0]];
      const dw = [(tau[0] - cross[0]) / I[0], (tau[1] - cross[1]) / I[1], (tau[2] - cross[2]) / I[2]];
      const dq = qmul(q, [0, wx, wy, wz]).map((x) => 0.5 * x);
      const wn = this.P.gimbalWn, ze = this.P.gimbalZeta;
      const gydd = wn * wn * (gyCmd - gy) - 2 * ze * wn * gyd;
      const gpdd = wn * wn * (gpCmd - gp) - 2 * ze * wn * gpd;
      return [vx, vy, vz, a[0], a[1], a[2], dq[0], dq[1], dq[2], dq[3],
              dw[0], dw[1], dw[2], gyd, gydd, gpd, gpdd];
    }

    step(action) {
      if (this.done) return this;
      const cl = (x) => Math.max(-1, Math.min(1, x));
      let T = (cl(action[0]) + 1) * 0.5 * this.maxThrust;
      const gyCmd = Math.max(-this.P.gimbalMax, Math.min(this.P.gimbalMax,
                  cl(action[1]) * this.P.gimbalMax + this.dr.biasY));
      const gpCmd = Math.max(-this.P.gimbalMax, Math.min(this.P.gimbalMax,
                  cl(action[2]) * this.P.gimbalMax + this.dr.biasP));

      const dt = this.P.dt;
      if (this.fuel > 0) {
        const mdot = T / (this.isp * this.P.g0);
        const used = mdot * dt;
        if (used > this.fuel) { T *= this.fuel / Math.max(used, 1e-9); this.fuel = 0; }
        else this.fuel -= used;
      } else T = 0;
      this.thrust = T;

      let s = [this.p[0], this.p[1], this.p[2], this.v[0], this.v[1], this.v[2],
               this.q[0], this.q[1], this.q[2], this.q[3], this.w[0], this.w[1], this.w[2],
               this.gy, this.gyd, this.gp, this.gpd];
      const f = (x) => this.deriv(x, T, gyCmd, gpCmd);
      const add = (a, b, h) => a.map((x, i) => x + h * b[i]);
      const k1 = f(s), k2 = f(add(s, k1, dt / 2)),
            k3 = f(add(s, k2, dt / 2)), k4 = f(add(s, k3, dt));
      s = s.map((x, i) => x + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));

      this.p = s.slice(0, 3); this.v = s.slice(3, 6);
      this.q = qnorm(s.slice(6, 10)); this.w = s.slice(10, 13);
      this.gy = s[13]; this.gyd = s[14]; this.gp = s[15]; this.gpd = s[16];
      this.t += dt; this.steps++;
      if (this.steps % 5 === 0) this.trail.push(this.p.slice());
      this.checkDone();
      return this;
    }

    checkDone() {
      const P = this.P;
      if (this.lateral() > P.maxLateral) { this.done = true; this.outcome = 'drift'; }
      else if (this.speed() > P.maxSpeed) { this.done = true; this.outcome = 'overspeed'; }
      else if (this.tiltDeg() > 90) { this.done = true; this.outcome = 'tumble'; }
      else if (this.p[2] <= this.contactHeight()) {
        this.done = true;
        const ok = this.speed() < P.okSpeed
                && this.tiltDeg() < P.okTiltDeg
                && this.lateral() < P.okLateral;
        this.outcome = ok ? 'success' : 'hard';
        this.p[2] = this.contactHeight();
      } else if (this.steps >= P.maxSteps) { this.done = true; this.outcome = 'timeout'; }
    }

    /** The 17-dim observation rocket_dr_env builds, without the sensor noise. */
    obs() {
      const pos = [this.p[0], this.p[1], this.alt()];
      return new Float64Array([
        pos[0] / 100, pos[1] / 100, pos[2] / 100,
        this.v[0] / 50, this.v[1] / 50, this.v[2] / 50,
        this.q[0], this.q[1], this.q[2], this.q[3],
        this.w[0] / 2, this.w[1] / 2, this.w[2] / 2,
        this.fuel / Math.max(this.startFuel, 1e-9),
        this.mass() / (P.dryMass + P.fuel),
        Math.hypot(pos[0], pos[1]) / 100,
        Math.max(0, Math.min(400, this.alt())) / 100
      ]);
    }
  }

  // ---- the cascaded 3-D PD from scripts/tools/pd3d.py ------------------------
  const PD = {
    kd_xy: 0.95, kd_z: 0.90, t_lag: 3.0, v_lat_max: 16.0,
    a_up_frac: 0.55, flare: 6.0, vz_max: 26.0, touch_vz: 1.2, lat_hold: 110.0,
    kp_att: 1.1, kd_att: 2.41, tilt_max_deg: 35.0,
    // Lateral authority is set by the tilt cap, not by TWR: near hover the
    // thrust vector is about m*g, so a_lat <= g tan(theta_max) = 1.13 m/s^2.
    a_lat_max: 1.1,
    // Measured on the MuJoCo model: the centre of mass touches down at
    // z = 1.00 + 0.2475 * tilt[deg], because the vehicle is 100 m long with a
    // ~17 m fin radius. Any tilt above 4 (alt - 1.5) degrees is a fin strike.
    contact_slope: 2.0, contact_z0: 2.0,
    thrust_floor: 1.0,
    gate_alt: 55.0, gate_lateral: 8.0, gate_hspeed: 0.8, gate_tilt_deg: 8.0
  };

  function pd3d(r, gains) {
    const g = Object.assign({}, PD, gains || {});
    const m = r.mass(), I = r.inertia(), alt = Math.max(r.alt(), 0);
    const lat = r.lateral(), hsp = Math.hypot(r.v[0], r.v[1]);
    const gmoon = r.P.g;

    // vertical guidance by stopping distance
    const twr = r.maxThrust / (m * gmoon);
    const aUp = g.a_up_frac * (twr * gmoon - gmoon);
    const h = Math.max(alt - g.flare, 0);
    const latHold = Math.max(0.30, Math.min(1, 1 - lat / g.lat_hold));
    let vzRef = -Math.min(Math.sqrt(2 * aUp * h) * latHold, g.vz_max);
    vzRef = alt > g.flare ? Math.min(vzRef, -0.5) : -g.touch_vz;

    const composed = lat < g.gate_lateral && hsp < g.gate_hspeed && r.tiltDeg() < g.gate_tilt_deg;
    if (alt < g.gate_alt && !composed) vzRef = Math.max(vzRef, -0.2);

    // lateral guidance with an attitude-lag allowance
    let aLat;
    if (lat > 1e-6) {
      const a = g.a_lat_max, tl = g.t_lag;
      const vMag = Math.min(a * (-tl + Math.sqrt(tl * tl + 2 * lat / a)), g.v_lat_max);
      aLat = [g.kd_xy * (-r.p[0] / lat * vMag - r.v[0]),
              g.kd_xy * (-r.p[1] / lat * vMag - r.v[1])];
    } else aLat = [-g.kd_xy * r.v[0], -g.kd_xy * r.v[1]];
    const n = Math.hypot(aLat[0], aLat[1]);
    if (n > g.a_lat_max) { aLat[0] *= g.a_lat_max / n; aLat[1] *= g.a_lat_max / n; }

    let f = [m * aLat[0], m * aLat[1], m * (g.kd_z * (vzRef - r.v[2]) + gmoon)];
    if (f[2] < 0.2 * m * gmoon) f[2] = 0.2 * m * gmoon;
    // you cannot steer while falling: hold hover thrust while there is
    // downrange left, or the tilt buys no lateral acceleration
    if (lat > g.gate_lateral) f[2] = Math.max(f[2], g.thrust_floor * m * gmoon);

    const tiltCap = Math.min(g.tilt_max_deg, Math.max(0, g.contact_slope * (alt - g.contact_z0)));
    const tmax = tiltCap * Math.PI / 180, hor = Math.hypot(f[0], f[1]);
    if (hor > f[2] * Math.tan(tmax) && hor > 1e-9) {
      const k = f[2] * Math.tan(tmax) / hor; f[0] *= k; f[1] *= k;
    }
    let T = Math.min(Math.hypot(f[0], f[1], f[2]), r.maxThrust);
    const fn = Math.hypot(f[0], f[1], f[2]) || 1;
    const uDes = [f[0] / fn, f[1] / fn, f[2] / fn];

    const R = qmat(r.q), ub = rotT(R, uDes);
    const e = [-ub[1], ub[0], 0];
    const tau = [I[0] * (g.kp_att * e[0] - g.kd_att * r.w[0]),
                 I[1] * (g.kp_att * e[1] - g.kd_att * r.w[1]), 0];
    const lever = Math.max(T, 0.04 * r.maxThrust) * r.P.L;
    const gp = Math.asin(Math.max(-1, Math.min(1, -tau[1] / lever)));
    const gy = Math.asin(Math.max(-1, Math.min(1, -tau[0] / (lever * Math.max(Math.cos(gp), 0.3)))));
    return [Math.max(-1, Math.min(1, 2 * T / r.maxThrust - 1)),
            Math.max(-1, Math.min(1, gy / r.P.gimbalMax)),
            Math.max(-1, Math.min(1, gp / r.P.gimbalMax))];
  }

  // ---- the SAC actor: two hidden layers, ReLU, tanh-squashed mean ------------
  class Policy {
    constructor(spec) {
      this.W = spec.layers.map((l) => ({
        w: Float64Array.from(l.w), b: Float64Array.from(l.b),
        inn: l.in, out: l.out, act: l.act
      }));
      this.stage = spec.stage;
      this.steps = spec.steps;
    }
    act(obs) {
      let x = obs;
      for (const L of this.W) {
        const y = new Float64Array(L.out);
        for (let o = 0; o < L.out; o++) {
          let s = L.b[o];
          const base = o * L.inn;
          for (let i = 0; i < L.inn; i++) s += L.w[base + i] * x[i];
          y[o] = L.act === 'relu' ? (s > 0 ? s : 0) : s;
        }
        x = y;
      }
      // SAC's deterministic action is tanh(mean); the mean is the first half.
      const n = 3, out = new Array(n);
      for (let i = 0; i < n; i++) out[i] = Math.tanh(x[i]);
      return out;
    }
  }

  window.TINTIN3D = { P, Lander, pd3d, PD, Policy, qmat, rot, rotT, mulberry32, qnorm };
})();

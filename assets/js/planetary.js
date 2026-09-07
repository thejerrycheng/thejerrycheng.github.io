/* planetary.js — the geometry, kinematics and feasibility of a planetary gear
   set, matching scripts/tools/fsae_gearbox.py so the page and the harness
   cannot disagree. Defaults are the capstone's design: 30 sun, 30 planet,
   90 ring, module 2 mm, four planets, ring held. */
(function () {
  'use strict';

  const DEG = Math.PI / 180;

  /** Ring teeth are fixed by the coaxial condition: zr = zs + 2 zp. */
  const ringTeeth = (zs, zp) => zs + 2 * zp;

  /** Planetary type, ring held, sun in, carrier out. */
  const ratio = (zs, zp) => ringTeeth(zs, zp) / zs + 1;

  /** Every check a planetary set has to pass before it can be built. */
  function feasibility(zs, zp, n, module) {
    const zr = ringTeeth(zs, zp);
    const a = module * (zs + zp) / 2;             // sun-planet centre distance
    const tip = module * (zp + 2);                // planet tip diameter
    const gap = 2 * a * Math.sin(Math.PI / n);    // centre-to-centre of neighbours
    return {
      zr, a, tip, gap,
      // equal spacing needs (zs + zr) divisible by the number of planets
      assembly: (zs + zr) % n === 0,
      // neighbouring planets must not touch
      neighbour: tip < gap,
      // below ~17 teeth a 20-degree spur pinion undercuts without correction
      undercut: zs >= 17 && zp >= 17,
      ringDia: module * zr,
    };
  }

  /** Angular rates, in units of the input rate. Ring is held. */
  function kinematics(zs, zp) {
    const R = ratio(zs, zp);
    const carrier = 1 / R;
    // planet spin relative to the carrier, then back to ground
    const planetRel = -(zs / zp) * (1 - carrier);
    return { R, sun: 1, carrier, planet: carrier + planetRel, ring: 0 };
  }

  /** Gear-mesh frequency in Hz for a ring-held set at a given input speed. */
  function meshHz(zs, zp, rpm) {
    const zr = ringTeeth(zs, zp);
    const fCarrier = (rpm / 60) / ratio(zs, zp);
    return zr * fCarrier;
  }

  /** Tooth phase a planet must carry to mesh with the sun, for a planet sitting
      at carrier angle theta. Derived from "a tooth of one falls in a space of
      the other, on the line of centres". */
  function planetPhase(zs, zp, sunPhase, theta) {
    return theta + Math.PI - ((theta - sunPhase) * zs + Math.PI) / zp;
  }

  /** Ring phase that meshes with the planet at `theta` (internal mesh), used to
      draw the ring against planet 0. Note this only phases the drawing; whether
      the OTHER planets can simultaneously mesh is the assembly condition, which
      is checked separately in feasibility() rather than inferred from here. */
  function ringPhase(zr, zp, planetPh, theta) {
    return theta - ((theta - planetPh) * zp - Math.PI) / zr;
  }

  /** How far planet i is out of phase with the ring, in tooth pitches, 0 = meshes
      and 0.5 = tooth on tooth. Standard planetary assembly condition: rotating
      the carrier by 2*pi/n turns the sun by that times the ratio, and the sun
      must come back to an identical tooth pattern, which needs (zs+zr)/n whole. */
  function phaseError(zs, zr, n, i) {
    const x = ((i * (zs + zr) / n) % 1 + 1) % 1;
    return Math.min(x, 1 - x);
  }

  /** Outline of one gear: pitch circle with n trapezoidal teeth.
      `internal` draws the teeth pointing inward, for a ring gear. */
  function toothPath(g, cx, cy, teeth, module, phase, internal) {
    const rp = module * teeth / 2;
    const ha = module * 1.0;                       // addendum, exaggerated slightly
    const ro = internal ? rp - ha : rp + ha;
    const ri = internal ? rp + ha * 0.8 : rp - ha * 0.8;
    const step = 2 * Math.PI / teeth;
    const w = step * 0.30;                         // half tooth thickness at pitch
    g.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = phase + i * step;
      const pts = [[a - step / 2 + w * 0.55, ri], [a - w * 0.62, ro],
                   [a + w * 0.62, ro], [a + step / 2 - w * 0.55, ri]];
      pts.forEach(([ang, r], k) => {
        const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
        if (i === 0 && k === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
    }
    g.closePath();
  }

  window.PLANETARY = { DEG, ringTeeth, ratio, feasibility, kinematics, meshHz,
                       planetPhase, ringPhase, phaseError, toothPath };
})();

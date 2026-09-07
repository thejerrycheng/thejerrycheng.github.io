/* se3_ui.js — the Assignment 3 sandbox: a 6-DoF path, a stereo camera, 40
   landmarks, and a window-size knob that runs from a filter to full batch. */
(function () {
  'use strict';
  const S3 = window.SE3;
  const $ = (id) => document.getElementById(id);
  const cv = $('s3-canvas');
  if (!S3 || !cv) return;

  const WINDOWS = [1, 2, 5, 10, 20, null];
  const S = { p: null, res: null, dr: null, gt: null, yaw: -0.62, pitch: 0.58, drag: null, zoom: 1 };

  const css = (n, f) => (getComputedStyle(document.documentElement).getPropertyValue(n) || f).trim();
  function sizeCanvas(c) {
    const r = c.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(320, r.width * d); c.height = Math.max(220, r.height * d);
    return d;
  }

  function build() {
    const T = +$('s3-steps').value;
    const nl = +$('s3-land').value;
    const seed = +$('s3-seed').value;
    const bl = $('s3-blackout').checked ? [Math.round(T * 0.5), Math.round(T * 0.62)] : null;
    S.p = S3.makeProblem({ T, nLand: nl, seed, blackout: bl,
                           sigmaPx: +$('s3-px').value });
    S.dr = S3.positions(S3.deadReckon(S.p));
    S.gt = S3.positions(S.p.Ttrue);
    const w = WINDOWS[+$('s3-window').value];
    $('s3-window-v').textContent = w === null ? 'batch (all poses)' : `${w} step${w > 1 ? 's' : ''} back`;
    $('s3-out').innerHTML = 'solving…';
    setTimeout(() => {
      S.res = S3.estimate(S.p, w);
      draw(); report(w);
    }, 15);
  }

  function project(q, w, h, cam) {
    const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
    const cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
    const x = q[0] - cam.c[0], y = q[1] - cam.c[1], z = q[2] - cam.c[2];
    const a = x * cy - y * sy, b = x * sy + y * cy;
    const u = a;
    const v = z * cp - b * sp;
    const d = b * cp + z * sp + cam.r;
    const f = Math.min(w, h) * 0.9 * cam.k;
    return [w / 2 + f * u / Math.max(d, 0.1), h / 2 - f * v / Math.max(d, 0.1), d];
  }

  function camera() {
    const all = S.gt.concat(S.dr, S.p.land);
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    all.forEach((q) => { for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], q[i]); hi[i] = Math.max(hi[i], q[i]); } });
    const c = [0, 1, 2].map((i) => (lo[i] + hi[i]) / 2);
    const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1);
    return { c, r: span * 1.5 / S.zoom, k: 1.1 * S.zoom };
  }

  function draw() {
    const dpr = sizeCanvas(cv);
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    const ink = css('--ink', '#151820'), gold = css('--gold', '#D9A13F');
    const hi = css('--hi', '#E4442A'), ash = css('--ash', '#7A7466');
    g.clearRect(0, 0, w, h);
    g.fillStyle = css('--panel', '#FDF6E2'); g.fillRect(0, 0, w, h);
    const cam = camera();
    const P = (q) => project(q, w, h, cam);

    // ---- the scene is drawn as one depth-sorted display list, so landmarks,
    // path segments, drop lines and the ground grid occlude each other the way
    // they should. Painting them in fixed layers is what made it read flat.
    const items = [];
    const push = (depth, fn) => items.push([depth, fn]);

    // The ground is referenced to the TRAJECTORY, not to the landmark cloud --
    // dropping it to the lowest landmark puts the path metres in the air and
    // turns every stalk into a skyscraper.
    let lo = [1e9, 1e9, 1e9], hi3 = [-1e9, -1e9, -1e9];
    S.gt.concat(S.dr).forEach((q) => { for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], q[i]); hi3[i] = Math.max(hi3[i], q[i]); } });
    const z0 = lo[2] - Math.max(0.5, (hi3[2] - lo[2]) * 0.35);
    const span = Math.max(hi3[0] - lo[0], hi3[1] - lo[1], 1);
    const stepG = Math.max(1, Math.round(span / 8));
    const gx0 = Math.floor((lo[0] - stepG) / stepG) * stepG, gx1 = Math.ceil((hi3[0] + stepG) / stepG) * stepG;
    const gy0 = Math.floor((lo[1] - stepG) / stepG) * stepG, gy1 = Math.ceil((hi3[1] + stepG) / stepG) * stepG;

    // ---- ground grid -----------------------------------------------------
    const seg = (a, b, col, lw, dash, alpha) => {
      const A = P(a), B = P(b);
      push((A[2] + B[2]) / 2 + 1e3, () => {       // +1e3 keeps the ground behind
        g.setLineDash(dash || []); g.globalAlpha = alpha == null ? 1 : alpha;
        g.strokeStyle = col; g.lineWidth = lw * dpr; g.lineCap = 'round';
        g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
        g.setLineDash([]); g.globalAlpha = 1;
      });
    };
    for (let x = gx0; x <= gx1 + 1e-9; x += stepG) seg([x, gy0, z0], [x, gy1, z0], 'rgba(21,24,32,0.16)', 1);
    for (let y = gy0; y <= gy1 + 1e-9; y += stepG) seg([gx0, y, z0], [gx1, y, z0], 'rgba(21,24,32,0.16)', 1);

    // ---- polylines, split into segments so they sort correctly ------------
    const poly = (pts, col, lw, dash, shadow) => {
      for (let i = 1; i < pts.length; i++) {
        const A = P(pts[i - 1]), B = P(pts[i]);
        const d = (A[2] + B[2]) / 2;
        // near segments are drawn a touch heavier: cheap but effective depth cue
        const t = Math.max(0.35, Math.min(1.4, cam.r / Math.max(d, 0.2)));
        push(d, () => {
          g.setLineDash(dash || []); g.strokeStyle = col; g.lineWidth = lw * t * dpr;
          g.lineCap = 'round';
          g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
          g.setLineDash([]);
        });
      }
      if (shadow) {                                // the path's shadow on the ground
        for (let i = 1; i < pts.length; i++) {
          const a = [pts[i - 1][0], pts[i - 1][1], z0], b = [pts[i][0], pts[i][1], z0];
          seg(a, b, 'rgba(21,24,32,0.13)', 2.2);
        }
      }
    };

    poly(S.dr, ash, 1.8, [6 * dpr, 4 * dpr]);
    poly(S.gt, ink, 2.0, null, true);
    if (S.res) poly(S3.positions(S.res.est), hi, 3.2);

    // ---- drop lines from the truth to the ground, every few steps ---------
    for (let i = 0; i < S.gt.length; i += Math.max(2, Math.round(S.gt.length / 26))) {
      const q = S.gt[i];
      seg(q, [q[0], q[1], z0], 'rgba(21,24,32,0.26)', 1.2, [3 * dpr, 3 * dpr]);
    }

    // ---- landmarks: a ball, a stalk down to the ground, and a foot --------
    S.p.land.forEach((l) => {
      const q = P(l);
      const foot = P([l[0], l[1], Math.min(l[2], z0)]);
      push(q[2] + 0.5, () => {                    // stalk sits just behind its ball
        g.setLineDash([2.5 * dpr, 3 * dpr]);
        g.strokeStyle = 'rgba(217,161,63,0.32)'; g.lineWidth = 1 * dpr;
        g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(foot[0], foot[1]); g.stroke();
        g.setLineDash([]);
        g.fillStyle = 'rgba(21,24,32,0.14)';
        g.beginPath(); g.ellipse(foot[0], foot[1], 3.2 * dpr, 1.5 * dpr, 0, 0, 7); g.fill();
      });
      push(q[2], () => {
        const r = Math.max(1.6, 110 * cam.k / Math.max(q[2], 1)) * dpr;
        const a = Math.max(0.30, Math.min(1, cam.r * 1.25 / Math.max(q[2], 0.5)));
        g.globalAlpha = a;
        const grd = g.createRadialGradient(q[0] - r * 0.3, q[1] - r * 0.3, r * 0.1, q[0], q[1], r);
        grd.addColorStop(0, '#F3D089'); grd.addColorStop(1, gold);
        g.fillStyle = grd;
        g.beginPath(); g.arc(q[0], q[1], r, 0, 7); g.fill();
        g.strokeStyle = 'rgba(21,24,32,0.55)'; g.lineWidth = 0.9 * dpr; g.stroke();
        g.globalAlpha = 1;
      });
    });

    // ---- body triads on the estimate, so orientation is visible ----------
    if (S.res) {
      const est = S.res.est;
      const stepT = Math.max(1, Math.round(est.length / 9));
      for (let i = 0; i < est.length; i += stepT) {
        const Ti = S3.inv4rt(est[i]);
        const o = [Ti[3], Ti[7], Ti[11]];
        const axes = [[Ti[0], Ti[4], Ti[8]], [Ti[1], Ti[5], Ti[9]], [Ti[2], Ti[6], Ti[10]]];
        const L = Math.max(0.5, span * 0.055);
        axes.forEach((ax, c) => {
          const tip = [o[0] + ax[0] * L, o[1] + ax[1] * L, o[2] + ax[2] * L];
          const A = P(o), B = P(tip);
          push((A[2] + B[2]) / 2 - 0.2, () => {
            g.strokeStyle = ['#E4442A', '#2E9E5B', '#1F6FB2'][c];
            g.lineWidth = 2.1 * dpr; g.lineCap = 'round';
            g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
          });
        });
      }
    }

    if ($('s3-blackout').checked) {
      const a = Math.round(S.p.T * 0.5), b = Math.round(S.p.T * 0.62);
      const sl = S.gt.slice(a, b);
      for (let i = 1; i < sl.length; i++) {
        const A = P(sl[i - 1]), B = P(sl[i]);
        push((A[2] + B[2]) / 2 - 0.5, () => {
          g.strokeStyle = 'rgba(228,68,42,0.28)'; g.lineWidth = 9 * dpr; g.lineCap = 'round';
          g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
        });
      }
    }

    items.sort((a, b) => b[0] - a[0]).forEach(([, fn]) => fn());

    // ---- overlay ---------------------------------------------------------
    g.font = `${11 * dpr}px "Space Mono", monospace`;
    [['estimate', hi], ['ground truth (on top)', ink], ['dead reckoning', ash], ['landmarks', gold]]
      .forEach(([t, c], i) => {
        g.fillStyle = c; g.fillRect(12 * dpr, 12 * dpr + i * 16 * dpr, 14 * dpr, 3 * dpr);
        g.fillStyle = ink; g.fillText(t, 32 * dpr, 17 * dpr + i * 16 * dpr);
      });
    ['x', 'y', 'z'].forEach((t, i) => {
      g.fillStyle = ['#E4442A', '#2E9E5B', '#1F6FB2'][i];
      g.fillText(t, 12 * dpr + i * 14 * dpr, 17 * dpr + 4.6 * 16 * dpr);
    });
    g.fillStyle = ash;
    g.fillText('body axes', 12 * dpr + 46 * dpr, 17 * dpr + 4.6 * 16 * dpr);
    g.fillStyle = ink;
    g.fillText('drag to orbit · scroll to zoom', w - 210 * dpr, h - 12 * dpr);
  }

  function report(w) {
    const est = S3.positions(S.res.est);
    const rms = (a) => Math.sqrt(a.reduce((s, q, i) =>
      s + (q[0] - S.gt[i][0]) ** 2 + (q[1] - S.gt[i][1]) ** 2 + (q[2] - S.gt[i][2]) ** 2, 0) / a.length);
    let rot = 0;
    for (let k = 0; k <= S.p.T; k++) {
      const e = S3.logSE3(S3.mul4(S.res.est[k], S3.inv4rt(S.p.Ttrue[k])));
      rot += e[3] ** 2 + e[4] ** 2 + e[5] ** 2;
    }
    rot = Math.sqrt(rot / (S.p.T + 1));
    let cons = '';
    if (S.res.cov) {
      let ok = 0;
      for (let k = 1; k <= S.p.T; k++) {
        const e = S3.logSE3(S3.mul4(S.res.est[k], S3.inv4rt(S.p.Ttrue[k])));
        if (e.every((v, i) => Math.abs(v) <= 3 * Math.sqrt(S.res.cov[k][i]))) ok++;
      }
      cons = `<br>inside its own 3σ <b>${(ok / S.p.T * 100).toFixed(1)} %</b>`;
    }
    const vis = S.p.visible.reduce((a, b) => a + b, 0) / S.p.visible.length;
    $('s3-out').innerHTML =
      `window <b>${w === null ? 'batch' : w}</b> &nbsp; poses solved together <b>${w === null ? S.p.T + 1 : w + 1}</b><br>` +
      `translation RMS <b>${rms(est).toFixed(4)} m</b> ` +
      `<span class="dim">(dead reckoning ${rms(S.dr).toFixed(3)} m)</span><br>` +
      `rotation RMS <b>${(rot * 1000).toFixed(1)} mrad</b><br>` +
      `landmarks in view, mean <b>${vis.toFixed(1)}</b><br>` +
      `solved in <b>${S.res.ms < 1 ? '<1' : S.res.ms.toFixed(0)} ms</b>` + cons;
  }

  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    S.zoom = Math.max(0.45, Math.min(3.2, S.zoom * (e.deltaY > 0 ? 0.92 : 1.087)));
    draw();
  }, { passive: false });
  cv.addEventListener('pointerdown', (e) => { S.drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    if (!S.drag) return;
    S.yaw += (e.clientX - S.drag[0]) * 0.008;
    S.pitch = Math.max(-1.2, Math.min(1.2, S.pitch + (e.clientY - S.drag[1]) * 0.006));
    S.drag = [e.clientX, e.clientY];
    draw();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => cv.addEventListener(ev, () => { S.drag = null; }));

  ['s3-window', 's3-steps', 's3-land', 's3-seed', 's3-px', 's3-blackout'].forEach((id) => {
    const el = $(id), out = $(id + '-v');
    const sync = () => { if (out && el.type === 'range') out.textContent = el.value; };
    el.addEventListener('change', () => { sync(); build(); });
    el.addEventListener('input', sync);
    sync();
  });
  $('s3-reroll').addEventListener('click', () => {
    $('s3-seed').value = String((Math.random() * 99) | 0);
    $('s3-seed-v').textContent = $('s3-seed').value;
    build();
  });
  window.addEventListener('resize', () => S.res && draw());
  build();
})();

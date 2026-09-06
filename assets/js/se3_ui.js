/* se3_ui.js — the Assignment 3 sandbox: a 6-DoF path, a stereo camera, 40
   landmarks, and a window-size knob that runs from a filter to full batch. */
(function () {
  'use strict';
  const S3 = window.SE3;
  const $ = (id) => document.getElementById(id);
  const cv = $('s3-canvas');
  if (!S3 || !cv) return;

  const WINDOWS = [1, 2, 5, 10, 20, null];
  const S = { p: null, res: null, dr: null, gt: null, yaw: -0.7, pitch: 0.5, drag: null };

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
    return { c, r: span * 1.5, k: 1.1 };
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

    // landmarks, depth-sorted so near ones sit on top
    S.p.land.map((l) => [P(l), l]).sort((a, b) => b[0][2] - a[0][2]).forEach(([q]) => {
      const r = Math.max(1.5, 90 / Math.max(q[2], 1)) * dpr;
      g.fillStyle = gold; g.globalAlpha = 0.85;
      g.beginPath(); g.arc(q[0], q[1], r, 0, 7); g.fill();
      g.globalAlpha = 1;
    });

    const line = (pts, col, lw, dash) => {
      g.setLineDash(dash || []); g.strokeStyle = col; g.lineWidth = lw * dpr;
      g.beginPath();
      pts.forEach((q, i) => { const s = P(q); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); });
      g.stroke(); g.setLineDash([]);
    };
    line(S.dr, ash, 1.8, [6 * dpr, 4 * dpr]);
    if (S.res) line(S3.positions(S.res.est), hi, 4.0);
    line(S.gt, ink, 1.6);

    if ($('s3-blackout').checked) {
      const a = Math.round(S.p.T * 0.5), b = Math.round(S.p.T * 0.62);
      g.strokeStyle = 'rgba(228,68,42,0.3)'; g.lineWidth = 9 * dpr; g.lineCap = 'round';
      g.beginPath();
      S.gt.slice(a, b).forEach((q, i) => { const s = P(q); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); });
      g.stroke();
    }

    g.font = `${11 * dpr}px "Space Mono", monospace`;
    [['estimate', hi], ['ground truth (on top)', ink], ['dead reckoning', ash], ['landmarks', gold]]
      .forEach(([t, c], i) => {
        g.fillStyle = c; g.fillRect(12 * dpr, 12 * dpr + i * 16 * dpr, 14 * dpr, 3 * dpr);
        g.fillStyle = ink; g.fillText(t, 32 * dpr, 17 * dpr + i * 16 * dpr);
      });
    g.fillStyle = ink;
    g.fillText('drag to orbit', w - 96 * dpr, h - 12 * dpr);
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

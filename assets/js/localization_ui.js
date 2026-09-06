/* localization_ui.js — the window-size sandbox: drag from a filter to full
   batch and watch the estimate, the error and the 3-sigma bounds move. */
(function () {
  'use strict';
  const L = window.LOCALIZATION;
  const $ = (id) => document.getElementById(id);
  const cv = $('lc-canvas');
  if (!L || !cv) return;

  const S = { p: null, res: null, dr: null, view: null };
  const WINDOWS = [1, 2, 5, 10, 20, 50, null];

  function css(n, f) {
    return (getComputedStyle(document.documentElement).getPropertyValue(n) || f).trim();
  }
  function sizeCanvas(c) {
    const r = c.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(320, r.width * d); c.height = Math.max(200, r.height * d);
    return d;
  }

  function build() {
    const T = +$('lc-steps').value;
    const nl = +$('lc-land').value;
    const seed = +$('lc-seed').value;
    const bl = $('lc-blackout').checked ? [Math.round(T * 0.5), Math.round(T * 0.67)] : null;
    S.p = L.makeProblem(T, nl, seed, bl);
    S.dr = L.deadReckon(S.p);
    const w = WINDOWS[+$('lc-window').value];
    $('lc-window-v').textContent = w === null ? 'batch (all poses)' : `${w} step${w > 1 ? 's' : ''} back`;
    const t0 = performance.now();
    S.res = L.estimate(S.p, w);
    draw(); report(w, performance.now() - t0);
  }

  function fit() {
    let lo = [1e9, 1e9], hi = [-1e9, -1e9];
    const all = S.p.xTrue.concat(S.dr, S.p.land.map((l) => [l[0], l[1], 0]));
    all.forEach((x) => {
      lo[0] = Math.min(lo[0], x[0]); lo[1] = Math.min(lo[1], x[1]);
      hi[0] = Math.max(hi[0], x[0]); hi[1] = Math.max(hi[1], x[1]);
    });
    return { lo, hi };
  }

  function draw() {
    const dpr = sizeCanvas(cv);
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    const ink = css('--ink', '#151820'), panel = css('--panel', '#FDF6E2');
    const hi = css('--hi', '#E4442A'), gold = css('--gold', '#D9A13F');
    const green = css('--green', '#2E9E5B'), ash = css('--ash', '#7A7466');
    g.clearRect(0, 0, w, h); g.fillStyle = panel; g.fillRect(0, 0, w, h);

    const { lo, hi: hh } = fit();
    const pad = 26 * dpr;
    const sx = (w - pad * 2) / Math.max(hh[0] - lo[0], 1e-6);
    const sy = (h - pad * 2) / Math.max(hh[1] - lo[1], 1e-6);
    const s = Math.min(sx, sy);
    const X = (x) => pad + (x - lo[0]) * s + (w - pad * 2 - (hh[0] - lo[0]) * s) / 2;
    const Y = (y) => h - pad - (y - lo[1]) * s - (h - pad * 2 - (hh[1] - lo[1]) * s) / 2;

    const line = (pts, col, lw, dash) => {
      g.setLineDash(dash || []); g.strokeStyle = col; g.lineWidth = lw * dpr;
      g.beginPath();
      pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])));
      g.stroke(); g.setLineDash([]);
    };

    // landmarks
    S.p.land.forEach((lm) => {
      g.fillStyle = gold; g.strokeStyle = ink; g.lineWidth = 1.2 * dpr;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 3 : 7) * dpr;
        const px = X(lm[0]) + r * Math.cos(a), py = Y(lm[1]) + r * Math.sin(a);
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.fill(); g.stroke();
    });

    // estimate underneath, truth on top, so you can see the truth showing
    // through wherever the estimate is right — which is almost everywhere
    line(S.dr, ash, 1.8, [6 * dpr, 4 * dpr]);
    line(S.res.est, hi, 4.0);
    line(S.p.xTrue, ink, 1.6);

    // the blackout stretch
    if ($('lc-blackout').checked) {
      const a = Math.round(S.p.T * 0.5), b = Math.round(S.p.T * 0.67);
      g.strokeStyle = 'rgba(228,68,42,0.28)'; g.lineWidth = 9 * dpr; g.lineCap = 'round';
      g.beginPath();
      S.p.xTrue.slice(a, b).forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])));
      g.stroke();
    }

    g.font = `${11 * dpr}px "Space Mono", monospace`;
    const key = [['estimate', hi], ['ground truth (on top)', ink], ['dead reckoning', ash], ['landmarks', gold]];
    key.forEach(([t, c], i) => {
      g.fillStyle = c; g.fillRect(12 * dpr, 12 * dpr + i * 16 * dpr, 14 * dpr, 3 * dpr);
      g.fillStyle = ink; g.fillText(t, 32 * dpr, 17 * dpr + i * 16 * dpr);
    });
  }

  function report(w, ms) {
    const rms = (a) => {
      let s = 0;
      for (let i = 0; i < a.length; i++) {
        s += (a[i][0] - S.p.xTrue[i][0]) ** 2 + (a[i][1] - S.p.xTrue[i][1]) ** 2;
      }
      return Math.sqrt(s / a.length);
    };
    const rmsTh = (a) => {
      let s = 0;
      for (let i = 0; i < a.length; i++) s += L.wrap(a[i][2] - S.p.xTrue[i][2]) ** 2;
      return Math.sqrt(s / a.length);
    };
    let cons = '';
    if (S.res.cov) {
      let ok = 0, n = 0;
      for (let k = 1; k <= S.p.T; k++) {
        const e = [S.res.est[k][0] - S.p.xTrue[k][0], S.res.est[k][1] - S.p.xTrue[k][1],
                   L.wrap(S.res.est[k][2] - S.p.xTrue[k][2])];
        const good = e.every((v, i) => Math.abs(v) <= 3 * Math.sqrt(S.res.cov[k][i]));
        if (good) ok++;
        n++;
      }
      cons = `<br>inside its own 3σ <b>${(ok / n * 100).toFixed(1)} %</b>`;
    }
    $('lc-out').innerHTML =
      `window <b>${w === null ? 'batch' : w}</b> &nbsp; poses solved together <b>${w === null ? S.p.T + 1 : w + 1}</b><br>` +
      `position RMS <b>${rms(S.res.est).toFixed(4)} m</b> ` +
      `<span class="dim">(dead reckoning ${rms(S.dr).toFixed(3)} m)</span><br>` +
      `heading RMS <b>${rmsTh(S.res.est).toFixed(4)} rad</b><br>` +
      `solved in <b>${ms < 1 ? '<1' : ms.toFixed(0)} ms</b>` + cons;
  }

  ['lc-window', 'lc-steps', 'lc-land', 'lc-seed', 'lc-blackout'].forEach((id) => {
    const el = $(id), out = $(id + '-v');
    const sync = () => { if (out && el.type === 'range') out.textContent = el.value; };
    el.addEventListener('input', () => { sync(); build(); });
    el.addEventListener('change', () => { sync(); build(); });
    sync();
  });
  $('lc-reroll').addEventListener('click', () => {
    $('lc-seed').value = String((Math.random() * 999) | 0);
    $('lc-seed-v') && ($('lc-seed-v').textContent = $('lc-seed').value);
    build();
  });
  window.addEventListener('resize', draw);
  build();
})();

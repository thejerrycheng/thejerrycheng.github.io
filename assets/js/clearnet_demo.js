/* clearnet_demo.js — the cart-pole sandbox: balance it yourself, train a
   Q-table in the page, and watch observation noise take it apart. */
(function () {
  'use strict';
  const C = window.CLEARNET;
  const $ = (id) => document.getElementById(id);
  const cv = $('cn-canvas');
  if (!C || !cv) return;

  const S = { env: null, q: null, mode: 'agent', running: false, raf: 0,
              last: 0, acc: 0, keys: {}, curve: [], best: null, seed: 7,
              trained: false, evalStats: null };

  function rng() { return Math.random; }

  function limits() {
    return $('cn-limits').value === 'released' ? C.LIMITS_RELEASED : C.LIMITS_FIXED;
  }
  function bins() { return $('cn-bins').value.split(',').map(Number); }
  function noise() { return +$('cn-noise').value; }

  function newEnv() {
    return new C.CartPole({ noise: noise(), rng: rng() });
  }

  function reset() {
    S.env = newEnv();
    S.obs = S.env.reset();
    draw();
    status();
  }

  function sizeCanvas(c) {
    const r = c.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(320, r.width * d); c.height = Math.max(180, r.height * d);
    return d;
  }

  function css(name, fallback) {
    return (getComputedStyle(document.documentElement).getPropertyValue(name) || fallback).trim();
  }

  function draw() {
    const dpr = sizeCanvas(cv);
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    const ink = css('--ink', '#151820'), panel = css('--panel', '#FDF6E2');
    const hi = css('--hi', '#E4442A'), gold = css('--gold', '#D9A13F');
    g.clearRect(0, 0, w, h);
    g.fillStyle = panel; g.fillRect(0, 0, w, h);

    const scale = w / (2 * C.P.xLimit * 1.25);
    const ground = h * 0.74;
    const cx = w / 2 + S.env.s[0] * scale;

    // track and limits
    g.strokeStyle = ink; g.lineWidth = 2 * dpr;
    g.beginPath(); g.moveTo(0, ground); g.lineTo(w, ground); g.stroke();
    g.setLineDash([6 * dpr, 5 * dpr]); g.strokeStyle = hi; g.lineWidth = 1.5 * dpr;
    [-C.P.xLimit, C.P.xLimit].forEach((x) => {
      const px = w / 2 + x * scale;
      g.beginPath(); g.moveTo(px, ground - 60 * dpr); g.lineTo(px, ground + 12 * dpr); g.stroke();
    });
    g.setLineDash([]);
    g.strokeStyle = 'rgba(21,24,32,.3)'; g.lineWidth = 1 * dpr;
    g.beginPath(); g.moveTo(w / 2, ground - 14 * dpr); g.lineTo(w / 2, ground + 10 * dpr); g.stroke();

    // cart
    const cwid = 52 * dpr, chei = 26 * dpr;
    g.fillStyle = ink;
    g.fillRect(cx - cwid / 2, ground - chei, cwid, chei);
    g.fillStyle = gold;
    [-1, 1].forEach((k) => {
      g.beginPath(); g.arc(cx + k * cwid * 0.28, ground, 6 * dpr, 0, 7); g.fill();
    });

    // pole
    const L = 110 * dpr, th = S.env.s[2];
    const tipx = cx + L * Math.sin(th), tipy = ground - chei - L * Math.cos(th);
    g.strokeStyle = hi; g.lineWidth = 7 * dpr; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, ground - chei); g.lineTo(tipx, tipy); g.stroke();
    g.fillStyle = gold; g.strokeStyle = ink; g.lineWidth = 1.6 * dpr;
    g.beginPath(); g.arc(tipx, tipy, 8 * dpr, 0, 7); g.fill(); g.stroke();

    // what the agent actually sees, if the observation is noisy
    if (noise() > 0 && S.obs) {
      const ox = w / 2 + S.obs[0] * scale;
      const oth = S.obs[2];
      g.globalAlpha = 0.4; g.setLineDash([4 * dpr, 4 * dpr]);
      g.strokeStyle = ink; g.lineWidth = 4 * dpr;
      g.beginPath(); g.moveTo(ox, ground - chei);
      g.lineTo(ox + L * Math.sin(oth), ground - chei - L * Math.cos(oth)); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
    }

    g.fillStyle = ink; g.font = `${11 * dpr}px "Space Mono", monospace`;
    g.fillText(`x ${S.env.s[0].toFixed(2)} m   θ ${(S.env.s[2] * 180 / Math.PI).toFixed(1)}°   ` +
               `step ${S.env.steps}`, 12 * dpr, 20 * dpr);
    if (noise() > 0) {
      g.globalAlpha = .55;
      g.fillText('dashed = what the agent sees', 12 * dpr, 36 * dpr);
      g.globalAlpha = 1;
    }
  }

  function act() {
    if (S.mode === 'manual') {
      return S.keys.right ? 1 : (S.keys.left ? 0 : (S.env.s[2] > 0 ? 1 : 0));
    }
    if (S.mode === 'random') return Math.random() < 0.5 ? 0 : 1;
    if (!S.q) return S.env.s[2] > 0 ? 1 : 0;
    return S.q.greedy(S.obs);
  }

  function tick(ts) {
    if (!S.running) return;
    S.acc += Math.min((ts - S.last) / 1000 || 0, 0.1) * (+$('cn-speed').value);
    S.last = ts;
    let n = 0;
    while (S.acc >= C.P.tau && n < 40) {
      S.obs = S.env.step(act());
      S.acc -= C.P.tau; n++;
      if (S.env.done) break;
    }
    draw();
    if (S.env.done) {
      $('cn-last').textContent = `episode ended after ${S.env.steps} steps`;
      S.env = newEnv(); S.obs = S.env.reset();
    }
    S.raf = requestAnimationFrame(tick);
  }

  // ---- training, live in the page -------------------------------------------
  function train() {
    const btn = $('cn-train');
    btn.disabled = true; btn.textContent = 'training…';
    setTimeout(() => {
      const eps = +$('cn-episodes').value;
      const q = new C.QTable(bins(), limits());
      const env = new C.CartPole({ noise: noise(), rng: rng() });
      const curve = new Float32Array(eps);
      const t0 = performance.now();
      for (let e = 0; e < eps; e++) curve[e] = q.episode(env);
      const ms = performance.now() - t0;
      S.q = q; S.curve = curve; S.trained = true;

      // greedy evaluation, same noise
      let steps = 0, drift = 0;
      const n = 40;
      for (let i = 0; i < n; i++) {
        let o = env.reset(); let k = 0, dx = 0;
        while (!env.done) { o = env.step(q.greedy(o)); dx += Math.abs(env.s[0]); k++; }
        steps += k; drift += dx / Math.max(k, 1);
      }
      S.evalStats = { steps: steps / n, drift: drift / n, ms, states: q.statesVisited() };
      drawCurve();
      status();
      btn.disabled = false; btn.textContent = 'Train again';
      reset();
    }, 20);
  }

  function drawCurve() {
    const c = $('cn-curve');
    const dpr = sizeCanvas(c), g = c.getContext('2d'), w = c.width, h = c.height;
    const ink = css('--ink', '#151820'), hi = css('--hi', '#E4442A');
    g.clearRect(0, 0, w, h);
    g.fillStyle = css('--panel', '#FDF6E2'); g.fillRect(0, 0, w, h);
    if (!S.curve.length) return;
    const pad = 34 * dpr;
    const win = Math.max(20, Math.floor(S.curve.length / 60));
    const sm = [];
    let acc = 0;
    for (let i = 0; i < S.curve.length; i++) {
      acc += S.curve[i];
      if (i >= win) acc -= S.curve[i - win];
      if (i >= win) sm.push(acc / win);
    }
    const max = Math.max(120, Math.max.apply(null, sm) * 1.1);
    const X = (i) => pad + i / (sm.length - 1) * (w - pad * 1.4);
    const Y = (v) => h - pad - v / max * (h - pad * 1.7);
    g.strokeStyle = ink; g.lineWidth = 1.3 * dpr;
    g.beginPath(); g.moveTo(pad, pad * 0.6); g.lineTo(pad, h - pad); g.lineTo(w - pad * 0.4, h - pad); g.stroke();
    g.strokeStyle = hi; g.lineWidth = 2 * dpr; g.beginPath();
    sm.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)));
    g.stroke();
    g.fillStyle = ink; g.font = `${10 * dpr}px "Space Mono", monospace`;
    g.fillText(`steps survived (${win}-episode mean)`, pad + 4 * dpr, pad * 0.5 + 8 * dpr);
    g.fillText('training episode', w / 2 - 40 * dpr, h - 10 * dpr);
    g.fillText(String(Math.round(max)), 4 * dpr, pad * 0.6 + 10 * dpr);
  }

  function status() {
    const b = bins();
    const total = b.reduce((a, x) => a * x, 1) * 2;
    const lim = $('cn-limits').value;
    let s = `grid <b>${b.join('×')}</b> = ${total.toLocaleString()} Q entries<br>` +
            `cart-position bins span <b>${limits()[0][0]} … ${limits()[0][1]} m</b>`;
    if (lim === 'released') {
      const frac = 4.8 / (limits()[0][1] - limits()[0][0]) * 100;
      s += ` <span class="cn-warn">— only ${frac.toFixed(0)} % of that is reachable</span>`;
    }
    if (S.evalStats) {
      s += `<br>trained in <b>${S.evalStats.ms.toFixed(0)} ms</b>, ` +
           `${S.evalStats.states.toLocaleString()} states visited<br>` +
           `greedy: <b>${S.evalStats.steps.toFixed(0)} steps</b>, ` +
           `mean |x| <b>${S.evalStats.drift.toFixed(3)} m</b>`;
    }
    $('cn-out').innerHTML = s;
  }

  // ---- bindings -------------------------------------------------------------
  const KEY = { ArrowLeft: 'left', ArrowRight: 'right', a: 'left', d: 'right' };
  window.addEventListener('keydown', (e) => {
    if (S.mode === 'manual' && KEY[e.key]) { S.keys[KEY[e.key]] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { if (KEY[e.key]) S.keys[KEY[e.key]] = false; });

  $('cn-mode').addEventListener('change', (e) => {
    S.mode = e.target.value;
    $('cn-keys').hidden = S.mode !== 'manual';
    reset();
  });
  ['cn-noise', 'cn-bins', 'cn-limits', 'cn-episodes'].forEach((id) => {
    const el = $(id), out = $(id + '-v');
    el.addEventListener('input', () => { if (out) out.textContent = el.value; status(); reset(); });
    el.addEventListener('change', () => { status(); reset(); });
    if (out) out.textContent = el.value;
  });
  $('cn-speed').addEventListener('input', () => { $('cn-speed-v').textContent = $('cn-speed').value + '×'; });
  $('cn-go').addEventListener('click', () => {
    S.running = !S.running;
    $('cn-go').textContent = S.running ? 'Pause' : 'Run';
    if (S.running) { S.last = performance.now(); S.acc = 0; S.raf = requestAnimationFrame(tick); }
  });
  $('cn-train').addEventListener('click', train);
  window.addEventListener('resize', () => { draw(); drawCurve(); });

  reset();
  drawCurve();
})();

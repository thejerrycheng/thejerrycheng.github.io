/* RollView — the rollout panel of the studio: synced A/B player, per-step reward signals with a playhead, checkpoint
   filmstrip of GIFs, recording controls. Rollouts that carry a .replay.json play as an interactive 3-D replay (Replay3D:
   drag to orbit, wheel / pinch to zoom, right-drag / two fingers to pan); older ones fall back to the video. Mounted at
   the top of the plots view; the iterations being watched are published via onPick so the training plots can mark them. */
"use strict";
class RollView {
  constructor(host, h) {
    this.h = h;            // hooks: api, media, esc, fmt, pct, isPct, shortTag, ago, toast, store, valueAt, state(), run(), detail(), onPick(iters)
    this.picks = []; this.u = null; this.t = []; this.raf = 0; this.sig = null;
    this.view = h.store.get("rv.view", "both"); this.loop = h.store.get("rv.loop", true); this.rate = 1;
    this.mode = window.RLDASH_STATIC ? "3d" : h.store.get("rv.mode", "3d"); this.link = h.store.get("rv.link", true); this.follow = true;
    this.r3d = []; this.time = 0; this.dur = 0; this.playing = true; this.active = null;
    this.hidden = new Set(h.store.get("rv.hidden", ["r/success"]));
    host.innerHTML = `
    <div class="rv">
      <div class="rv-bar">
        <span class="rv-title" data-r="title">rollout</span><span class="mono dim rv-sub" data-r="sub"></span>
        <div class="rv-tools">
          <div class="seg" data-r="mode" title="interactive 3-D replay or the recorded video"><button data-v="3d">3D</button><button data-v="video">video</button></div>
          <div class="seg" data-r="cam" title="camera presets"><button data-v="task">task</button><button data-v="wide">wide</button><button data-v="top">top</button><button data-v="side">side</button></div>
          <button class="gbtn" data-r="camReset" title="reset the camera to the task view">⟲ reset</button>
          <button class="gbtn" data-r="follow" title="the camera follows the tracked body, as the task video does">◎ follow</button>
          <button class="gbtn" data-r="link" title="A and B share one camera">⛓ link</button>
          <div class="seg" data-r="viewSel"><button data-v="both">both</button><button data-v="task">task</button><button data-v="scene">scene</button></div>
          <div class="seg" data-r="speed"><button data-v="0.25">¼×</button><button data-v="0.5">½×</button><button class="on" data-v="1">1×</button><button data-v="2">2×</button></div>
          <button class="gbtn" data-r="loop">↻ loop</button>
          <button class="gbtn" data-r="fs" title="fullscreen">⛶</button>
        </div>
      </div>
      <div class="rv-stage" data-r="stage">
        <div class="rv-videos" data-r="videos"></div>
        <div class="rv-sig"><div class="pl-legend" data-r="legend"></div><div data-r="chart"></div></div>
      </div>
      <div class="rv-handle" data-r="handle" title="drag to resize the player"></div>
      <div class="rv-transport">
        <button class="ibtn" data-r="play">▶</button>
        <input type="range" data-r="scrub" min="0" max="1000" value="0" />
        <span class="mono" data-r="tc">0.00 s</span>
      </div>
      <div class="rv-strip-head">
        <span class="sec-title" style="padding:0">Checkpoints<span class="n" data-r="n"></span></span>
        <span class="mono dim" data-r="queue" style="font-size:10px"></span>
        <div class="rv-rec">
          <label class="mono lab">size <input type="range" data-r="size" min="120" max="360" value="180" /></label>
          <select class="mono rv-ck" data-r="ck"></select><button class="gbtn primary" data-r="rec">● Record</button>
          <label class="mono lab">every <input class="num mono" data-r="every" type="number" value="500" min="50" step="50" /></label>
          <button class="gbtn" data-r="sweep">● Record all</button>
        </div>
      </div>
      <div class="rv-strip" data-r="strip"></div>
    </div>`;
    this.el = host.querySelector(".rv");
    this.$ = (r) => this.el.querySelector(`[data-r="${r}"]`);
    this._wire();
  }

  /* ---------- wiring ---------- */
  _seg(r, initial, fn) {
    const el = this.$(r); [...el.querySelectorAll("button")].forEach((b) => b.classList.toggle("on", b.dataset.v === String(initial)));
    el.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; [...el.querySelectorAll("button")].forEach((x) => x.classList.toggle("on", x === b)); fn(b.dataset.v); });
  }
  _wire() {
    const h = this.h;
    const H = h.store.get("rv.h", 420); this.el.style.setProperty("--rv-h", H + "px");
    const S = h.store.get("rv.size", 180); this.$("size").value = S; this.el.style.setProperty("--rv-thumb", S + "px");
    this.$("size").addEventListener("input", (e) => { this.el.style.setProperty("--rv-thumb", e.target.value + "px"); h.store.set("rv.size", +e.target.value); });
    const hd = this.$("handle");
    hd.addEventListener("pointerdown", (e) => {
      e.preventDefault(); hd.setPointerCapture(e.pointerId); hd.classList.add("drag");
      const y0 = e.clientY, h0 = this.$("stage").getBoundingClientRect().height;
      const mv = (ev) => { const nh = Math.max(200, Math.min(window.innerHeight * 0.85, h0 + ev.clientY - y0)); this.el.style.setProperty("--rv-h", nh + "px"); h.store.set("rv.h", nh); this._resizeChart(); };
      const up = () => { hd.classList.remove("drag"); hd.removeEventListener("pointermove", mv); hd.removeEventListener("pointerup", up); };
      hd.addEventListener("pointermove", mv); hd.addEventListener("pointerup", up);
    });
    this._seg("speed", "1", (v) => { this.rate = +v; this._vids().forEach((x) => { x.playbackRate = +v; }); });
    this._seg("viewSel", this.view, (v) => { this.view = v; h.store.set("rv.view", v); this._applyView(); });
    this._seg("mode", this.mode, (v) => { this.mode = v; h.store.set("rv.mode", v); this._renderPlayer(true); });
    this._seg("cam", "task", (v) => { this._setFollow(v === "task"); this.r3d.forEach((r) => r.preset(v)); });
    this.$("camReset").addEventListener("click", () => { this._setFollow(true); this.r3d.forEach((r) => r.preset("task")); [...this.$("cam").querySelectorAll("button")].forEach((b) => b.classList.toggle("on", b.dataset.v === "task")); });
    this.$("follow").addEventListener("click", () => this._setFollow(!this.follow));
    const lk = this.$("link"); const sk = () => lk.classList.toggle("primary", this.link); sk();
    lk.addEventListener("click", () => { this.link = !this.link; h.store.set("rv.link", this.link); sk(); this._setFollow(this.follow); });
    const lb = this.$("loop"); const sl = () => lb.classList.toggle("primary", this.loop); sl();
    lb.addEventListener("click", () => { this.loop = !this.loop; h.store.set("rv.loop", this.loop); this._vids().forEach((v) => { v.loop = this.loop; }); sl(); });
    this.$("fs").addEventListener("click", () => {
      if (document.fullscreenElement) return document.exitFullscreen();
      if (this.el.requestFullscreen) return this.el.requestFullscreen();
      if (this.el.webkitRequestFullscreen) return this.el.webkitRequestFullscreen();
      this._vids()[0]?.webkitEnterFullscreen?.();          // iPhone Safari: only <video> can go full screen
    });
    this.$("play").addEventListener("click", () => this.setPlaying(!this.playing));
    this.$("scrub").addEventListener("input", (e) => this.seek(+e.target.value / 100));
    this.$("rec").addEventListener("click", async () => {
      try { await h.api("/api/rollout", { id: h.run()?.id, checkpoint: this.$("ck").value, steps: 250, task: h.detail()?.task }); h.toast("recording…"); } catch (e) { h.toast(e.message); }
    });
    this.$("sweep").addEventListener("click", async () => {
      try { const r = await h.api("/api/rollout_sweep", { id: h.run()?.id, every: +this.$("every").value || 500, steps: 250, task: h.detail()?.task });
            h.toast(r.queued ? `queued ${r.queued} rollouts` : "every checkpoint on that grid is recorded"); } catch (e) { h.toast(e.message); }
    });
    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input,select,textarea") || !this._hasPlayer() || this.el.offsetParent === null) return;
      if (e.code === "Space") { e.preventDefault(); this.setPlaying(!this.playing); }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const step = this.r3d.length ? (this.r3d[0].d?.dt || 0.04) : 0.02;
        this.setPlaying(false); this.seek(Math.max(0, this.time + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 1 : step)));
      }
    });
    new ResizeObserver(() => this._resizeChart()).observe(this.$("stage"));
  }

  /* ---------- data ---------- */
  reset() { this.picks = []; this.sig = null; this._renderPlayer(); }
  videos() {
    const by = new Map();
    for (const v of this.h.detail()?.videos || []) { const k = v.iter ?? v.name; if (!by.has(k) || by.get(k).mtime < v.mtime) by.set(k, v); }
    return [...by.values()].sort((a, b) => (a.iter ?? 1e12) - (b.iter ?? 1e12));
  }
  update() {          // called on every state / detail refresh
    const h = this.h, d = h.detail(), r = h.run(); if (!r) return;
    const vids = this.videos();
    const st = h.state(); const jobs = (st?.rollouts || []).filter((j) => j.run === r.id && (j.state === "queued" || j.state === "running"));
    const q = (st?.rollouts || []).filter((j) => j.state === "queued" || j.state === "running");
    this.$("queue").textContent = q.length ? `${q.filter((j) => j.state === "running").length} recording · ${q.filter((j) => j.state === "queued").length} queued` : st?.auto_rollout?.enabled ? `auto: every ${st.auto_rollout.every} it` : "";
    this.$("n").textContent = vids.length;
    const cks = (d?.checkpoints || []).slice().reverse(), ck = this.$("ck"), keep = ck.value;
    if (ck._sig !== cks.join()) { ck._sig = cks.join(); ck.innerHTML = cks.map((c) => `<option>${h.esc(c)}</option>`).join(""); if (cks.includes(keep)) ck.value = keep; }
    if (!this.picks.length && vids.length) { this.picks = [vids[vids.length - 1].path]; this._renderPlayer(); }   // newest by default
    else if (this._pickSig !== this._pickSignature()) this._renderPlayer();     // e.g. a replay appeared for a picked rollout
    const sig = JSON.stringify([r.id, vids.map((v) => v.path + v.gif + v.replay), jobs.map((j) => j.id + j.state), this.picks]);
    if (sig === this.sig) return; this.sig = sig;
    const km = (st?.key_metrics || []).slice(0, 2), strip = this.$("strip");
    strip.innerHTML = vids.map((v, i) => {
      const k = this.picks.indexOf(v.path);
      return `<div class="gcard ${k === 0 ? "sel" : k === 1 ? "sel2" : ""}" data-i="${i}">
        <div class="img">${v.gif ? `<img src="${h.media(v.gif)}" />` : `<span class="wait">video only</span>`}${k >= 0 ? `<span class="num-badge" style="${k ? "background:#6FA8DC" : ""}">${k ? "B" : "A"}</span>` : ""}${v.replay ? `<span class="tag3d" title="interactive 3-D replay">3D</span>` : ""}</div>
        <div class="cap"><span class="it">${v.iter != null ? "iter " + v.iter : h.esc(v.name)}</span>
          ${km.map((t) => { const x = h.valueAt(t, v.iter); return x == null ? "" : `<span class="m">${h.esc(h.shortTag(t))} <b>${h.isPct(t) ? h.pct(x) : h.fmt(x)}</b></span>`; }).join("")}</div></div>`;
    }).join("") + jobs.map((j) => `<div class="gcard pending"><div class="img"><span class="wait">${j.state === "running" ? "◌ recording" : "· queued"}</span></div>
        <div class="cap"><span class="it">${h.esc(j.ckpt.replace(/\.pt$/, "").replace("model_", "iter "))}</span></div></div>`).join("")
      || `<div class="note">No rollouts yet — <b>Record</b> a checkpoint, or <b>Record all</b> for the learning progression.</div>`;
    [...strip.querySelectorAll(".gcard[data-i]")].forEach((c) => c.addEventListener("click", (e) => {
      const v = vids[+c.dataset.i];
      this.picks = e.shiftKey && this.picks.length ? [this.picks[0], v.path].filter((p, i, a) => a.indexOf(p) === i) : [v.path];
      this.sig = null; this.update();          // the pick changed: update() re-renders the player
    }));
  }

  /* ---------- player: one clock drives the 3-D replays and any videos ---------- */
  _vids() { return [...this.el.querySelectorAll(".rv-videos video")]; }
  _hasPlayer() { return this.r3d.length > 0 || this._vids().length > 0; }
  _picked() { const all = this.videos(); return this.picks.map((p) => all.find((v) => v.path === p)).filter(Boolean); }
  _pickSignature() { return JSON.stringify([this.mode, this._picked().map((v) => v.path + "|" + (v.replay || ""))]); }
  _playAllPaused() { this.setPlaying(false); }
  _playAll(p) { this.setPlaying(p); }
  setPlaying(p) {
    if (p && this.dur && this.time >= this.dur - 1e-3) this.seek(0);
    this.playing = p;
    for (const v of this._vids()) p ? v.play().catch(() => {}) : v.pause();
  }
  seek(t) {
    this.time = Math.max(0, Math.min(t, this.dur || t));
    for (const v of this._vids()) v.currentTime = Math.min(this.time, v.duration || this.time);
    this.r3d.forEach((r) => r.setTime(this.time));
  }
  _applyView() { this.$("videos").dataset.view = this.view; }
  _badge(v, k, n) {
    const h = this.h, km = (h.state()?.key_metrics || []).slice(0, 2);
    return `<span class="badge">${n > 1 ? (k ? "B · " : "A · ") : ""}${v.iter != null ? "iter " + v.iter : h.esc(v.name)}${km.map((t) => { const x = h.valueAt(t, v.iter); return x == null ? "" : ` · ${h.esc(h.shortTag(t))} <b>${h.isPct(t) ? h.pct(x) : h.fmt(x)}</b>`; }).join("")}</span>`;
  }
  _videoCell(v, k, n) {
    return `<div class="clip"><video src="${this.h.media(v.path)}" muted playsinline preload="auto" ${this.loop ? "loop" : ""}></video></div>${this._badge(v, k, n)}`;
  }
  _disposeR3d() { this.r3d.forEach((r) => r.dispose()); this.r3d = []; }
  _renderPlayer(keepTime) {
    const h = this.h, picks = this._picked();
    cancelAnimationFrame(this.raf);
    this._disposeR3d();
    const box = this.$("videos"), t0 = keepTime ? this.time : 0;
    this._pickSig = this._pickSignature();
    h.onPick(picks.map((v) => v.iter).filter((x) => x != null));
    const any3d = picks.some((v) => v.replay);
    this.$("mode").style.display = any3d ? "" : "none";
    if (!picks.length) { box.innerHTML = `<div class="rv-empty">No rollout selected</div>`; this.$("title").textContent = "rollout"; this.$("sub").textContent = ""; this._drawSignals([]); this._tools(); return; }
    this.$("title").textContent = picks.map((v) => v.iter != null ? "iter " + v.iter : v.name).join("  vs  ");
    const use3d = (v) => this.mode === "3d" && v.replay;
    this.$("sub").textContent = (picks.some(use3d) ? "drag orbit · wheel / pinch zoom · right-drag pan · " : "")
      + (picks.length > 1 ? "A left · B right · synced" : "shift-click another checkpoint to compare");
    box.innerHTML = picks.map((v, k) => use3d(v)
      ? `<div class="cell r3d" data-k="${k}"><div class="r3d-host"></div><span class="r3d-load mono">loading 3-D replay…</span>${this._badge(v, k, picks.length)}</div>`
      : `<div class="cell" data-k="${k}">${this._videoCell(v, k, picks.length)}</div>`).join("");
    box.dataset.n = picks.length;
    this._applyView();
    this.time = t0; this.dur = 0;
    picks.forEach((v, k) => {
      if (!use3d(v)) return;
      const cell = box.querySelector(`.cell[data-k="${k}"]`), host = cell.querySelector(".r3d-host");
      const viewer = new Replay3D.Viewer(host, { onCamera: (src) => this._camSync(src) });
      viewer.pick = k; this.r3d.push(viewer);
      const mark = () => { this.active = viewer; };
      ["pointerdown", "wheel", "touchstart"].forEach((ev) => host.addEventListener(ev, mark, { passive: true }));
      viewer.load(h.media(v.replay)).then(() => {
        cell.querySelector(".r3d-load")?.remove();
        if (this.link && this.r3d[0] !== viewer && this.r3d[0]?.d) viewer.copyCamera(this.r3d[0]);
        const cam = this.$("cam").querySelector("button.on")?.dataset.v; if (cam && cam !== "task") viewer.preset(cam);
        this._setFollow(this.follow); viewer.setTime(this.time, true); this._tools();
      }).catch((e) => {                         // broken / missing replay: this cell falls back to its video
        console.warn("replay failed, video fallback", e);
        viewer.dispose(); this.r3d = this.r3d.filter((r) => r !== viewer);
        cell.classList.remove("r3d"); cell.innerHTML = this._videoCell(v, k, picks.length); this._wireVideos(); this._tools();
      });
    });
    this._wireVideos();
    this._tools();
    this._loadSignals(picks);
    this.setPlaying(this.playing || !keepTime);
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
      const vs = this._vids();
      if (this.r3d.length) {
        this.dur = Math.max(0, ...this.r3d.map((r) => r.duration), ...vs.map((v) => v.duration || 0));
        if (this.playing && this.dur) {
          this.time += dt * this.rate;
          if (this.time > this.dur) { if (this.loop) this.time %= this.dur; else { this.time = this.dur; this.playing = false; } }
        }
        for (const r of this.r3d) if (r.d) r.setTime(Math.min(this.time, r.duration));
        if (this.link && this.r3d.length > 1) {   // A leads (and follows); a drag on B is pushed to A by _camSync
          const lead = this.r3d[0];
          for (const r of this.r3d) if (r !== lead && r.d && lead.d) r.copyCamera(lead);
        }
        for (const r of this.r3d) r.frame();
        for (const v of vs) {                     // a video beside a replay follows the clock
          v.playbackRate = this.rate;
          const end = v.duration || 0, want = Math.min(this.time, end);
          if (this.playing && v.paused && this.time < end) v.play().catch(() => {});
          if (!this.playing && !v.paused) v.pause();
          if (Math.abs(v.currentTime - want) > 0.15 && !v.seeking) v.currentTime = want;
        }
      } else if (vs.length) {                     // videos only: the first video is the clock
        this.time = vs[0].currentTime; this.dur = vs[0].duration || 0; this.playing = !vs[0].paused;
        for (const v of vs.slice(1)) if (Math.abs(v.currentTime - this.time) > 0.08 && !v.seeking) v.currentTime = Math.min(this.time, v.duration || this.time);
      }
      if (this.dur) this.$("scrub").max = Math.round(this.dur * 100);
      this.$("scrub").value = Math.round(this.time * 100); this.$("tc").textContent = `${this.time.toFixed(2)} s`; this.$("play").textContent = this.playing ? "❚❚" : "▶";
      this.u?.redraw(false, false);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  _wireVideos() {
    this._vids().forEach((v) => {
      if (v._wired) return; v._wired = true;
      v.muted = true; v.playbackRate = this.rate;                // muted + playsinline: iOS autoplay
      if (this.playing) v.play().catch(() => {});
    });
  }
  _tools() {          // show the controls that apply to what is on screen
    const n3 = this.r3d.length, nv = this._vids().length;
    this.$("cam").style.display = n3 ? "" : "none"; this.$("camReset").style.display = n3 ? "" : "none";
    this.$("link").style.display = n3 > 1 ? "" : "none";
    this.$("follow").style.display = n3 && this.r3d.some((r) => !r.d || r.d.trackF) ? "" : "none";
    this.$("viewSel").style.display = nv ? "" : "none";
  }
  _setFollow(on) {
    this.follow = on; this.$("follow").classList.toggle("primary", on);
    this.r3d.forEach((r, i) => { r.follow = on && (!this.link || i === 0); r._look = null; if (r.d && r.follow) r._look = r.lookAt(r.t); });
  }
  _camSync(src) {
    if (!this.link || this.r3d.length < 2) return;
    if (this.active && src !== this.active) return;     // only the viewer being dragged leads
    for (const r of this.r3d) if (r !== src && r.d) r.copyCamera(src);
  }

  /* ---------- per-step signals ---------- */
  async _loadSignals(picks) {
    const sets = await Promise.all(picks.map(async (v) => { try { return await (await fetch(this.h.media(v.path.replace(/\.mp4$/, ".json")))).json(); } catch { return null; } }));
    this._drawSignals(sets.map((s, k) => s && { ...s, tag: picks.length > 1 ? (k ? "B" : "A") : "" }).filter(Boolean));
  }
  _drawSignals(sets) {
    const h = this.h, COLS = ["#efeae3", "#C25B2A", "#6FA8DC", "#3FB56B", "#E9C46A", "#B48EAD", "#8FBCBB", "#E07A9B", "#A3BE8C", "#D08770", "#88C0D0", "#EBCB8B", "#BF616A"];
    this.u?.destroy(); this.u = null; this.$("chart").innerHTML = "";
    if (!sets.length) { this.$("legend").innerHTML = `<span class="note">${this.picks.length ? "no per-step signals for this recording" : "per-step reward terms appear here"}</span>`; return; }
    const names = Object.keys(sets[0].signals).filter((k) => k !== "done");
    const n = Math.max(...sets.map((s) => s.signals.reward.length)), dt = sets[0].dt;
    this.t = Array.from({ length: n }, (_, i) => +(i * dt).toFixed(4));
    const series = [], data = [this.t];
    sets.forEach((s, k) => names.forEach((nm, i) => {
      const col = COLS[i % COLS.length];
      series.push({ _key: nm, stroke: col, width: nm === "reward" ? 1.8 : 1.2, dash: k ? [5, 4] : undefined, show: !this.hidden.has(nm), points: { show: false } });
      const ys = s.signals[nm] || []; data.push(Array.from({ length: n }, (_, j) => ys[j] ?? null));
    }));
    const resets = sets.flatMap((s) => s.signals.done.map((x, i) => x ? this.t[i] : null).filter((x) => x != null));
    const axis = { stroke: "#97908a", grid: { stroke: "rgba(242,238,230,.06)", width: 1 }, ticks: { stroke: "rgba(242,238,230,.1)", width: 1, size: 4 }, font: "10px Geist Mono, monospace" };
    const host = this.$("chart");
    this.u = new uPlot({
      width: host.clientWidth || 600, height: this._chartH(), legend: { show: false }, cursor: { points: { size: 4 } }, scales: { x: { time: false } },
      axes: [{ ...axis, size: 22, values: (u, v) => v.map((x) => x.toFixed(1) + "s") }, { ...axis, size: 44 }], series: [{}, ...series],
      hooks: { draw: [(u) => {
        const g = u.ctx; g.save(); g.strokeStyle = "rgba(210,59,42,.55)"; g.setLineDash([3, 3]);
        for (const t of resets) { const x = u.valToPos(t, "x", true); g.beginPath(); g.moveTo(x, u.bbox.top); g.lineTo(x, u.bbox.top + u.bbox.height); g.stroke(); }
        const x = u.valToPos(this.time || 0, "x", true);
        g.setLineDash([]); g.strokeStyle = "#f0b68b"; g.lineWidth = 2; g.beginPath(); g.moveTo(x, u.bbox.top); g.lineTo(x, u.bbox.top + u.bbox.height); g.stroke(); g.restore();
      }] },
    }, data, host);
    this.u.over.addEventListener("click", () => { const i = this.u.cursor.idx; if (i != null) this.seek(this.t[i]); });
    this.$("legend").innerHTML = names.map((nm, i) => `<button class="${this.hidden.has(nm) ? "" : "on"}" data-k="${h.esc(nm)}"><i style="background:${COLS[i % COLS.length]}"></i>${h.esc(nm.replace(/^r\//, ""))}</button>`).join("")
      + `<span class="mono dim" style="font-size:10px">${sets.length > 1 ? "solid A · dashed B · " : ""}red = reset · click to seek</span>`;
    [...this.$("legend").querySelectorAll("button")].forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.k, show = this.hidden.has(k); show ? this.hidden.delete(k) : this.hidden.add(k); h.store.set("rv.hidden", [...this.hidden]); b.classList.toggle("on", show);
      this.u.series.forEach((s, i) => { if (s._key === k) this.u.setSeries(i, { show }); });
      this._resizeChart();
    }));
    this._resizeChart();
  }
  _chartH() { const sig = this.el.querySelector(".rv-sig"); return Math.max(80, sig.clientHeight - this.$("legend").offsetHeight - 12); }
  _resizeChart() { if (this.u) this.u.setSize({ width: this.$("chart").clientWidth, height: this._chartH() }); }
}

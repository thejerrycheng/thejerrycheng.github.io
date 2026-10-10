/* RL Training Studio — live runs, queue, rollouts and machine telemetry.
   Everything polls the local rldash server: state every 2 s, run scalars every 3 s (incremental), system every 2 s. */
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const RUN_COLORS = ["#C25B2A", "#6FA8DC", "#3FB56B", "#E9C46A", "#B48EAD", "#8FBCBB", "#E07A9B", "#A3BE8C"];
/* the read-only website snapshot (static.js) serves the same app from an encrypted bundle: no server actions there */
const STATIC = window.RLDASH_STATIC || null;
if (STATIC) document.body.classList.add("static");
const store = {
  get(k, d) { try { const v = localStorage.getItem("rldash." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("rldash." + k, JSON.stringify(v)); } catch {} },
};

const S = {
  state: null, sel: store.get("sel", null), compare: new Set(store.get("compare", [])),
  scalars: {}, lastStep: {}, detail: null, stageTab: "plots", dockTab: "queue",
  smooth: store.get("smooth", 0.6), xmode: "step", tagFilter: "", runFilter: "", scope: store.get("scope", "active"),
  collapsed: new Set(store.get("collapsed", ["Perf", "Terminations"])), sys: [], sysWin: 3600, evFilter: "all",
  charts: [], sysCharts: [], cfgVs: "",
};

async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json", "X-Rldash": "1" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), 2600); }
const fmt = (v, d = 3) => v == null || !isFinite(v) ? "—" : Math.abs(v) >= 1000 ? v.toFixed(0) : Math.abs(v) >= 100 ? v.toFixed(1) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(d);
const pct = (v) => v == null ? "—" : (100 * v).toFixed(1) + "%";
const clock = (t) => { const d = new Date(t * 1000), now = new Date(); const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }); return d.toDateString() === now.toDateString() ? hm : d.toLocaleDateString([], { weekday: "short" }) + " " + hm; };
const ago = (t) => { const s = Math.max(0, Date.now() / 1000 - t); return s < 60 ? `${s | 0}s` : s < 3600 ? `${(s / 60) | 0}m` : s < 86400 ? `${(s / 3600).toFixed(1)}h` : `${(s / 86400) | 0}d`; };
const shortTag = (t) => t.replace(/^(Episode_Reward|Episode_Metrics|Episode_Termination|Curriculum|Metrics)\//, "");
const runById = (id) => S.state?.runs.find((r) => r.id === id);
function runColor(id) { if (id === S.sel) return RUN_COLORS[0]; const c = [...S.compare].filter((x) => x !== S.sel); return RUN_COLORS[1 + (c.indexOf(id) % (RUN_COLORS.length - 1))]; }
function isPct(tag) { return /success|frac|_ema$/.test(tag) && !/reward/i.test(tag); }

/* ================= draggable panel borders ================= */
(function () {
  const root = document.documentElement;
  for (const e of $$(".edge")) {
    const v = e.dataset.var, saved = store.get("edge" + v, null);
    if (saved) root.style.setProperty(v, saved + "px");
    e.addEventListener("dblclick", () => { root.style.setProperty(v, e.dataset.def + "px"); store.set("edge" + v, null); window.dispatchEvent(new Event("resize")); });
    e.addEventListener("pointerdown", (ev) => {
      ev.preventDefault(); e.setPointerCapture(ev.pointerId); e.classList.add("drag"); document.body.classList.add("resizing");
      const x = e.dataset.axis === "x", start = x ? ev.clientX : ev.clientY;
      const cur = parseFloat(getComputedStyle(root).getPropertyValue(v));
      const max = +e.dataset.max * (x ? window.innerWidth : window.innerHeight);
      const mv = (m) => { const nv = Math.max(+e.dataset.min, Math.min(max, cur + ((x ? m.clientX : m.clientY) - start) * +e.dataset.sign)); root.style.setProperty(v, nv + "px"); store.set("edge" + v, nv); };
      const up = () => { e.classList.remove("drag"); document.body.classList.remove("resizing"); e.removeEventListener("pointermove", mv); e.removeEventListener("pointerup", up); };
      e.addEventListener("pointermove", mv); e.addEventListener("pointerup", up);
    });
  }
})();

/* ================= state poll ================= */
async function pollState() {
  try {
    S.state = await api("/api/state");
    $("#live").className = "live mono on"; $("#liveText").textContent = STATIC ? `snapshot ${clock(STATIC.generated)}` : "live";
    if (!S.sel || !runById(S.sel)) { const r = S.state.runs.find((r) => r.status === "running") || S.state.runs[0]; if (r) select(r.id, false); }
    renderTop(); renderRuns(); renderHead(); renderQueue(); renderTimeline();
    if (S.dockTab === "rollouts") renderRollouts();
    renderGallery();
  } catch (e) {
    $("#live").className = "live mono off"; $("#liveText").textContent = "offline";
  }
}

function renderTop() {
  $("#project").textContent = S.state.project;
  document.title = `${S.state.project} · Training Studio`;
}

/* ---- run browser ---- */
function renderRuns() {
  const f = S.runFilter.toLowerCase();
  let runs = S.state.runs.filter((r) => !f || r.name.toLowerCase().includes(f) || r.experiment.toLowerCase().includes(f));
  if (S.scope === "active") runs = runs.filter((r) => r.status === "running" || r.status === "stale" || r.id === S.sel || S.compare.has(r.id) || Date.now() / 1000 - r.last_write < 6 * 3600);
  const groups = [["Running", runs.filter((r) => r.status === "running" || r.status === "stale")], ["Recent", runs.filter((r) => !(r.status === "running" || r.status === "stale"))]];
  const km = S.state.key_metrics.slice(0, 2);
  $("#runList").innerHTML = groups.filter(([, rs]) => rs.length).map(([g, rs]) => `
    <div class="sec-title">${g}<span class="n">${rs.length}</span></div>
    ${rs.map((r) => {
      const p = r.iter != null && r.max_iter ? Math.min(1, r.iter / r.max_iter) : null;
      const cmp = S.compare.has(r.id) || r.id === S.sel;
      return `<div class="run ${r.id === S.sel ? "sel" : ""}" data-id="${r.id}" title="${esc(r.experiment)} / ${esc(r.name)}">
        <span class="sd ${r.status}"></span><span class="nm">${esc(r.name)}</span>
        <button class="cmp ${cmp ? "on" : ""}" data-cmp="${r.id}" title="overlay on plots" style="${cmp ? `background:${runColor(r.id)}` : ""}"></button>
        <div class="meta">${r.iter != null ? `<span>${r.iter}${r.max_iter ? "/" + r.max_iter : ""}</span>` : ""}
          ${km.map((k) => r.keys[k] != null ? `<span>${esc(shortTag(k))} <b>${isPct(k) ? pct(r.keys[k]) : fmt(r.keys[k])}</b></span>` : "").join("")}
          ${r.status === "running" && r.pct != null ? `<span><b>${r.pct.toFixed(1)}%</b></span>` : ""}
          ${r.status === "running" && r.finish ? `<span class="fin">⟶ ${clock(r.finish)}</span>` : r.status === "running" ? "" : `<span>${ago(r.last_write)} ago</span>`}</div>
        ${p != null && r.status === "running" ? `<div class="bar"><i style="width:${(100 * p).toFixed(1)}%"></i></div>` : ""}
      </div>`;
    }).join("")}`).join("") || `<div class="note">no runs match</div>`;
}

$("#runList").addEventListener("click", (e) => {
  const c = e.target.closest("[data-cmp]");
  if (c) { e.stopPropagation(); const id = c.dataset.cmp; if (id === S.sel) return; S.compare.has(id) ? S.compare.delete(id) : S.compare.add(id); store.set("compare", [...S.compare]); renderRuns(); rebuildPlots(); return; }
  const r = e.target.closest(".run"); if (r) { select(r.dataset.id); if (MQ.matches) setMTab("plots"); }
});
$("#runFilter").addEventListener("input", (e) => { S.runFilter = e.target.value; renderRuns(); });
seg("#runScope", S.scope, (v) => { S.scope = v; store.set("scope", v); renderRuns(); });

async function select(id, render = true) {
  S.sel = id; store.set("sel", id); S.compare.delete(id); S.detail = null; S.cfgVs = "";
  if (render) { renderRuns(); renderHead(); }
  S.specVs = ""; rebuildPlots(); loadDetail(); if (S.stageTab === "log") pollLog(true); if (S.stageTab === "spec") renderSpec();
}
async function loadDetail() {
  if (!S.sel) return;
  try { S.detail = await api(`/api/run?id=${S.sel}`); } catch { return; }
  renderHead(); renderGallery(); if (S.dockTab === "rollouts") renderRollouts(); if (S.dockTab === "config") renderConfig(); if (S.dockTab === "evals") renderEvals();
}

/* ---- run header ---- */
function renderHead() {
  const r = runById(S.sel); const el = $("#runHead");
  if (!r) { el.innerHTML = `<div class="empty">select a run</div>`; return; }
  const p = r.iter != null && r.max_iter ? Math.min(1, r.iter / r.max_iter) : null;
  const km = S.state.key_metrics;
  const task = S.detail?.task || r.task;
  el.innerHTML = `<div class="rh-top"><span class="rh-name" title="switch run">${esc(r.name)}</span><span class="pill ${r.status}">${r.status}</span>
      <span class="mono dim" style="font-size:11px">${esc(r.experiment)}</span>
      <div class="rh-actions">
        <button class="gbtn" id="btnRoll">● Rollouts</button>
        ${r.status === "running" ? `<button class="gbtn danger" id="btnStop">■ Stop</button>` : ""}
      </div></div>
    <div class="rh-stats">
      ${km.map((k) => `<div class="st"><span class="k">${esc(shortTag(k))}</span><span class="v big">${isPct(k) ? pct(r.keys[k]) : fmt(r.keys[k])}</span></div>`).join("")}
      <div class="st"><span class="k">iteration</span><span class="v">${r.iter ?? "—"}${r.max_iter ? " / " + r.max_iter : ""}</span></div>
      ${r.pct != null ? `<div class="st"><span class="k">trained</span><span class="v">${r.pct.toFixed(1)}%</span></div>` : ""}
      ${r.status === "running" ? `<div class="st"><span class="k">eta</span><span class="v">${esc(r.eta || "—")}</span></div>
        <div class="st"><span class="k">finishes</span><span class="v">${r.finish ? clock(r.finish) : "—"}</span></div>
        <div class="st"><span class="k">gpu mem</span><span class="v">${r.gpu_mb ? (r.gpu_mb / 1024).toFixed(1) + " GB" : "—"}</span></div>
        <div class="st"><span class="k">ram</span><span class="v">${r.rss_gb ? r.rss_gb.toFixed(1) + " GB" : "—"}</span></div>
        <div class="st"><span class="k">pid</span><span class="v">${r.pid}</span></div>` :
        `<div class="st"><span class="k">last write</span><span class="v">${ago(r.last_write)} ago</span></div>`}
      ${task ? `<div class="st"><span class="k">task</span><span class="v" style="font-size:12px">${esc(task)}</span></div>` : ""}
    </div>
    ${p != null ? `<div class="prog"><i style="width:${(100 * p).toFixed(2)}%"></i></div>` : ""}
    ${r.error && r.status !== "running" ? `<div class="err">${esc(r.error)}</div>` : ""}`;
  $("#btnStop")?.addEventListener("click", async () => {
    if (!confirm(`Stop ${r.name}? The scheduler frees its slot and starts the next queued job.`)) return;
    try { toast((await api("/api/stop", { id: r.id })).msg); } catch (e) { toast(e.message); }
  });
  $("#btnRoll")?.addEventListener("click", () => { if (MQ.matches) return setMTab("rollouts"); $(`#stageTabs [data-v="rollouts"]`).click(); setDock("rollouts"); });
  $(".rh-name", el).addEventListener("click", () => { if (MQ.matches) setMTab("runs"); });   // phone: the name switches runs
}

/* ================= plots ================= */
function groupOf(tag) {
  for (const [g, pats] of Object.entries(S.state?.groups || {})) if (pats.some((p) => new RegExp(p).test(tag))) return g;
  return "Other";
}
function ema(ys, w) {
  if (!w) return ys;
  let last = 0, n = 0; const out = new Array(ys.length);
  for (let i = 0; i < ys.length; i++) { const y = ys[i]; if (y == null) { out[i] = null; continue; } last = last * w + (1 - w) * y; n++; out[i] = last / (1 - Math.pow(w, n)); }
  return out;
}

async function pollScalars() {
  const ids = [S.sel, ...S.compare].filter((id) => id && runById(id));
  let changed = false;
  await Promise.all(ids.map(async (id) => {
    const since = S.lastStep[id] == null ? -1 : S.lastStep[id] - 2;
    try {
      const d = await api(`/api/scalars?id=${id}&since=${since}`);
      const cur = S.scalars[id] || (S.scalars[id] = {});
      for (const [t, pts] of Object.entries(d.data)) {
        if (!pts.length) continue;
        const a = cur[t] || (cur[t] = []); const s0 = pts[0][0];
        while (a.length && a[a.length - 1][0] >= s0) a.pop();
        for (const p of pts) a.push(p);
        changed = true;
      }
      S.lastStep[id] = d.last_step;
    } catch {}
  }));
  if (changed) { if (!S.charts.length) rebuildPlots(); else updatePlots(); }
}

function chartOpts(title, w, series, xTime) {
  const axis = { stroke: "#97908a", grid: { stroke: "rgba(242,238,230,.06)", width: 1 }, ticks: { stroke: "rgba(242,238,230,.1)", width: 1, size: 4 }, font: "10px Geist Mono, monospace", size: 38, gap: 4 };
  return {
    width: w, height: 150, legend: { show: false }, cursor: { drag: { x: true, y: false }, points: { size: 5 } },
    scales: { x: { time: !!xTime } },
    axes: [{ ...axis, size: 26, values: xTime ? (u, v) => v.map((t) => t == null ? "" : new Date(t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })) : undefined },
           { ...axis, size: 46 }],
    series: [{}, ...series], hooks: { setCursor: [tipHook], draw: [markHook] },
  };
}
function markHook(u) {          // iterations being watched in the rollout panel (A orange, B blue)
  if (u.scales.x.time || !S.markIters?.length) return;
  const g = u.ctx; g.save(); g.setLineDash([4, 3]); g.lineWidth = 1.5;
  S.markIters.forEach((it, k) => { const x = u.valToPos(it, "x", true); if (x < u.bbox.left || x > u.bbox.left + u.bbox.width) return;
    g.strokeStyle = k ? "rgba(111,168,220,.9)" : "rgba(240,182,139,.9)"; g.beginPath(); g.moveTo(x, u.bbox.top); g.lineTo(x, u.bbox.top + u.bbox.height); g.stroke(); });
  g.restore();
}
const tipEl = Object.assign(document.createElement("div"), { className: "tip hidden" }); document.body.appendChild(tipEl);
function tipHook(u) {
  const i = u.cursor.idx;
  if (i == null || u.cursor.left < 0) { tipEl.classList.add("hidden"); return; }
  const rows = u.series.slice(1).map((s, k) => s.show !== false && s._label ? `<div><span class="sw" style="background:${s._color}"></span>${esc(s._label)} <b>${fmt(u.data[k + 1][i], 4)}</b></div>` : "").join("");
  const x = u.data[0][i];
  tipEl.innerHTML = `<div class="dim">${u.scales.x.time ? new Date(x * 1000).toLocaleTimeString() : "iter " + x}</div>${rows}`;
  const b = u.over.getBoundingClientRect();
  tipEl.style.left = Math.min(window.innerWidth - 220, b.left + u.cursor.left + 14) + "px"; tipEl.style.top = b.top + u.cursor.top + 10 + "px";
  tipEl.classList.remove("hidden");
}

function plotData(tag) {
  const ids = [S.sel, ...[...S.compare].filter((x) => x !== S.sel)].filter((id) => S.scalars[id]?.[tag]);
  const xi = S.xmode === "time" ? 2 : 0;
  const xs = [...new Set(ids.flatMap((id) => S.scalars[id][tag].map((p) => p[xi])))].sort((a, b) => a - b);
  const pos = new Map(xs.map((x, i) => [x, i]));
  const data = [xs], series = [];
  ids.forEach((id) => {
    const ys = new Array(xs.length).fill(null);
    for (const p of S.scalars[id][tag]) ys[pos.get(p[xi])] = p[1];
    const col = runColor(id), r = runById(id);
    if (id === S.sel && S.smooth > 0) { data.push(ys); series.push({ stroke: col + "40", width: 1, spanGaps: true, points: { show: false } }); }
    data.push(ema(ys, S.smooth)); series.push({ stroke: col, width: 1.6, spanGaps: true, points: { show: false }, _label: r?.name || id, _color: col });
  });
  return { data, series, ids };
}

function rebuildPlots() {
  S.charts.forEach((c) => c.u.destroy()); S.charts = [];
  const root = $("#plots");
  if (!S.sel) { root.innerHTML = ""; return; }
  const sc = S.scalars[S.sel];
  if (!sc) { root.innerHTML = `<div class="note">loading scalars…</div>`; return; }
  const f = S.tagFilter.toLowerCase();
  const tags = Object.keys(sc).filter((t) => !f || t.toLowerCase().includes(f));
  const km = (S.state?.key_metrics || []).filter((k) => tags.includes(k));
  const groups = new Map([["Key metrics", km]]);
  for (const t of tags.sort()) { if (km.includes(t)) continue; const g = groupOf(t); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(t); }
  root.innerHTML = [...groups].filter(([, ts]) => ts.length).map(([g, ts]) => `
    <div class="group ${S.collapsed.has(g) ? "collapsed" : ""}" data-g="${esc(g)}">
      <div class="group-head"><span class="chev">▼</span><span class="t">${esc(g)}</span><span class="n">${ts.length}</span></div>
      <div class="grid">${ts.map((t) => `<div class="chart" data-tag="${esc(t)}"><div class="ct"><span class="t" title="${esc(t)}">${esc(shortTag(t))}</span><span class="v"></span></div><div class="cv"></div></div>`).join("")}</div>
    </div>`).join("");
  $$(".group", root).forEach((g) => {
    $(".group-head", g).addEventListener("click", () => { const n = g.dataset.g; S.collapsed.has(n) ? S.collapsed.delete(n) : S.collapsed.add(n); store.set("collapsed", [...S.collapsed]); rebuildPlots(); });
    if (g.classList.contains("collapsed")) return;
    $$(".chart", g).forEach((el) => {
      const tag = el.dataset.tag; const { data, series } = plotData(tag);
      const cv = $(".cv", el);
      const u = new uPlot(chartOpts(tag, Math.max(200, cv.clientWidth), series, S.xmode === "time"), data, cv);
      S.charts.push({ tag, el, u, n: series.length });
      setLatest(el, tag);
    });
  });
  if (!S._ro) { S._ro = new ResizeObserver(() => { for (const c of S.charts) c.u.setSize({ width: Math.max(200, $(".cv", c.el).clientWidth), height: 150 }); for (const c of S.sysCharts) c.u.setSize({ width: Math.max(200, c.cv.clientWidth), height: c.h }); }); S._ro.observe($(".stage-body")); }
}
function setLatest(el, tag) {
  const a = S.scalars[S.sel]?.[tag]; if (!a?.length) return;
  $(".v", el).textContent = isPct(tag) ? pct(a[a.length - 1][1]) : fmt(a[a.length - 1][1], 4);
}
function updatePlots() {
  for (const c of S.charts) {
    const { data, series } = plotData(c.tag);
    if (series.length !== c.n) { rebuildPlots(); return; }
    c.u.setData(data); setLatest(c.el, c.tag);
  }
}
$("#tagFilter").addEventListener("input", (e) => { S.tagFilter = e.target.value; clearTimeout(S._tf); S._tf = setTimeout(rebuildPlots, 200); });
$("#smooth").value = S.smooth; $("#smoothVal").textContent = (+S.smooth).toFixed(2);
$("#smooth").addEventListener("input", (e) => { S.smooth = +e.target.value; $("#smoothVal").textContent = S.smooth.toFixed(2); store.set("smooth", S.smooth); clearTimeout(S._sm); S._sm = setTimeout(rebuildPlots, 120); });
seg("#xAxis", S.xmode, (v) => { S.xmode = v; rebuildPlots(); });

/* ================= system ================= */
const SYS = [
  { t: "GPU load", u: "%", k: ["gpu_utilization_gpu"], max: 100 },
  { t: "GPU power", u: "W", k: ["gpu_power_draw", "gpu_power_limit"], lab: ["draw", "limit"] },
  { t: "GPU memory", u: "GB", k: ["gpu_memory_used", "gpu_memory_total"], f: (v) => v / 1024, lab: ["used", "total"] },
  { t: "GPU temperature", u: "°C", k: ["gpu_temperature_gpu"] },
  { t: "GPU SM clock", u: "MHz", k: ["gpu_clocks_sm"] },
  { t: "GPU fan", u: "%", k: ["gpu_fan_speed"] },
  { t: "CPU load", u: "%", k: ["cpu"], max: 100 },
  { t: "CPU package power", u: "W", k: ["cpu_power"] },
  { t: "CPU temperature", u: "°C", k: ["cpu_temp"] },
  { t: "RAM", u: "GB", k: ["ram_used", "swap_used"], lab: ["used", "swap"] },
  { t: "Disk", u: "MB/s", k: ["disk_read", "disk_write"], lab: ["read", "write"] },
  { t: "Network", u: "MB/s", k: ["net_rx", "net_tx"], lab: ["rx", "tx"] },
];
async function pollSystem() {
  const t0 = S.sys.length ? S.sys[S.sys.length - 1].t : 0;
  try {
    const d = await api(`/api/system?since=${t0}`);
    S.sys.push(...d.samples); S.sysStatic = d.static;
    const cut = Date.now() / 1000 - 6 * 3600; while (S.sys.length && S.sys[0].t < cut) S.sys.shift();
  } catch { return; }
  renderSysStrip();
  if (S.stageTab === "system") { if (!S.sysCharts.length) buildSystem(); else updateSystem(); }
}
function sysSeries(def) {
  const cut = Date.now() / 1000 - S.sysWin; const pts = S.sys.filter((s) => s.t >= cut);
  const f = def.f || ((v) => v);
  return [pts.map((s) => s.t), ...def.k.map((k) => pts.map((s) => s[k] == null ? null : f(s[k])))];
}
function buildSystem() {
  S.sysCharts.forEach((c) => c.u.destroy()); S.sysCharts = [];
  const root = $("#system");
  const gpu = S.sysStatic?.gpu_name || "GPU";
  root.innerHTML = `<div class="group"><div class="group-head"><span class="t">${esc(gpu)}</span></div><div class="grid" id="sysGpu"></div></div>
    <div class="group"><div class="group-head"><span class="t">CPU · ${S.sysStatic?.n_cores || ""} threads</span></div><div class="cores" id="cores"></div><div class="grid" id="sysCpu"></div></div>
    <div class="group"><div class="group-head"><span class="t">Memory · IO</span></div><div class="grid" id="sysMem"></div></div>`;
  SYS.forEach((def, i) => {
    const host = i < 6 ? "#sysGpu" : i < 9 ? "#sysCpu" : "#sysMem";
    const el = document.createElement("div"); el.className = "chart";
    el.innerHTML = `<div class="ct"><span class="t">${esc(def.t)} <span class="dim">${def.u}</span></span><span class="v"></span></div><div class="cv"></div>`;
    $(host).appendChild(el);
    const cv = $(".cv", el);
    const series = def.k.map((k, j) => ({ stroke: j === 0 ? "#C25B2A" : "#6b655f", width: j === 0 ? 1.6 : 1, dash: j ? [4, 4] : undefined, spanGaps: true, points: { show: false }, _label: def.lab?.[j] || def.t, _color: j === 0 ? "#C25B2A" : "#6b655f", fill: j === 0 ? "rgba(194,91,42,.08)" : undefined }));
    const o = chartOpts(def.t, Math.max(200, cv.clientWidth), series, true); o.height = 130;
    if (def.max) o.scales.y = { range: [0, def.max] };
    const u = new uPlot(o, sysSeries(def), cv);
    S.sysCharts.push({ def, el, cv, u, h: 130 });
  });
  updateSystem();
}
function updateSystem() {
  for (const c of S.sysCharts) {
    const d = sysSeries(c.def); c.u.setData(d);
    const last = d[1].length ? d[1][d[1].length - 1] : null; $(".v", c.el).textContent = last == null ? "—" : fmt(last, 1);
  }
  const s = S.sys[S.sys.length - 1];
  if (s?.cores) $("#cores").innerHTML = s.cores.map((v, i) => `<div class="core" title="cpu${i} ${v.toFixed(0)}%"><i style="height:${v.toFixed(0)}%"></i><span>${i}</span></div>`).join("");
}
seg("#sysWin", "3600", (v) => { S.sysWin = +v; updateSystem(); });

function renderSysStrip() {
  const s = S.sys[S.sys.length - 1]; if (!s) return;
  const m = [
    ["gpu", `${fmt(s.gpu_utilization_gpu, 0)}%`, "gpu_utilization_gpu"],
    ["gpu w", `${fmt(s.gpu_power_draw, 0)} W`, "gpu_power_draw"],
    ["vram", s.gpu_memory_used != null ? `${(s.gpu_memory_used / 1024).toFixed(1)}/${(s.gpu_memory_total / 1024).toFixed(0)} GB` : "—", "gpu_memory_used"],
    ["gpu °c", `${fmt(s.gpu_temperature_gpu, 0)}`, "gpu_temperature_gpu"],
    ["cpu", `${fmt(s.cpu, 0)}%`, "cpu"],
    ["cpu w", s.cpu_power != null ? `${fmt(s.cpu_power, 0)} W` : "—", "cpu_power"],
    ["ram", `${fmt(s.ram_used, 1)} GB`, "ram_used"],
  ];
  const el = $("#sysstrip");
  if (!el.children.length) el.innerHTML = m.map(([k]) => `<div class="sysm"><span class="k">${k}</span><span class="v"></span><canvas width="108" height="36"></canvas></div>`).join("");
  const recent = S.sys.slice(-90);
  m.forEach(([, v, key], i) => {
    const box = el.children[i]; $(".v", box).textContent = v;
    const cv = $("canvas", box), g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height);
    const ys = recent.map((p) => p[key]).filter((y) => y != null); if (ys.length < 2) return;
    const lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
    g.strokeStyle = "#C25B2A"; g.lineWidth = 2; g.beginPath();
    ys.forEach((y, j) => { const x = (j / (ys.length - 1)) * cv.width, yy = cv.height - 3 - ((y - lo) / span) * (cv.height - 6); j ? g.lineTo(x, yy) : g.moveTo(x, yy); });
    g.stroke();
  });
}

/* ================= rollouts gallery ================= */
const media = (p) => STATIC ? STATIC.media(p) : `/media?path=${encodeURIComponent(p)}`;
function valueAt(tag, it) {
  const a = S.scalars[S.sel]?.[tag]; if (!a?.length || it == null) return null;
  let best = a[0]; for (const p of a) { if (p[0] <= it) best = p; else break; } return best[1];
}
let RV = null;
function renderGallery() {
  if (S.stageTab !== "rollouts") { if (RV) RV._playAllPaused?.(); return; }
  if (!RV) {
    RV = new RollView($("#rollouts"), { api, media, esc, fmt, pct, isPct, shortTag, ago, toast, store: { get: store.get, set: store.set },
      valueAt, state: () => S.state, run: () => runById(S.sel), detail: () => S.detail,
      onPick: (iters) => { S.markIters = iters; S.charts.forEach((c) => c.u.redraw(false, false)); } });
  }
  if (RV._run !== S.sel) { RV._run = S.sel; RV.reset(); }
  RV.update();
}

/* ---- player: video + per-step signals with a synced cursor ---- */
const PL = { u: null, t: [], raf: 0, hidden: new Set(store.get("plHidden", [])) };
async function openPlayer(v) {
  const m = $("#player"), vid = $("#plVideo");
  $("#plTitle").textContent = v.iter != null ? `iter ${v.iter}` : v.name;
  $("#plSub").innerHTML = `${esc(runById(S.sel)?.name || "")} · ${esc(v.name)} · <a href="/rollouts.html?run=${S.sel}" target="rldash-rollouts" style="color:var(--accent-soft)">open in rollout window ↗</a>`;
  vid.src = media(v.path); m.classList.remove("hidden"); vid.play().catch(() => {});
  PL.u?.destroy(); PL.u = null; $("#plChart").innerHTML = ""; $("#plLegend").innerHTML = "";
  try {
    const j = await (await fetch(media(v.path.replace(/\.mp4$/, ".json")))).json();
    const names = Object.keys(j.signals).filter((k) => k !== "done");
    const n = j.signals.reward.length; PL.t = Array.from({ length: n }, (_, i) => +(i * j.dt).toFixed(4));
    const cols = ["#C25B2A", "#6FA8DC", "#3FB56B", "#E9C46A", "#B48EAD", "#8FBCBB", "#E07A9B", "#A3BE8C", "#D08770", "#88C0D0", "#EBCB8B", "#BF616A"];
    const series = names.map((k, i) => ({ _label: k.replace(/^r\//, ""), _color: k === "reward" ? "#efeae3" : cols[i % cols.length], stroke: k === "reward" ? "#efeae3" : cols[i % cols.length],
      width: k === "reward" ? 1.8 : 1.2, show: !PL.hidden.has(k), points: { show: false } }));
    const resets = j.signals.done.map((x, i) => x ? PL.t[i] : null).filter((x) => x != null);
    const o = chartOpts("signals", $("#plChart").clientWidth || 900, series, false); o.height = 180;
    o.axes[0].values = (u, vs) => vs.map((x) => x.toFixed(1) + "s");
    o.hooks.draw = [(u) => {
      const g = u.ctx; g.save();
      g.strokeStyle = "rgba(210,59,42,.55)"; g.setLineDash([3, 3]);
      for (const t of resets) { const x = u.valToPos(t, "x", true); g.beginPath(); g.moveTo(x, u.bbox.top); g.lineTo(x, u.bbox.top + u.bbox.height); g.stroke(); }
      const x = u.valToPos(vid.currentTime || 0, "x", true); g.setLineDash([]); g.strokeStyle = "#f0b68b"; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, u.bbox.top); g.lineTo(x, u.bbox.top + u.bbox.height); g.stroke(); g.restore();
    }];
    PL.u = new uPlot(o, [PL.t, ...names.map((k) => j.signals[k])], $("#plChart"));
    $("#plLegend").innerHTML = names.map((k, i) => `<button class="${PL.hidden.has(k) ? "" : "on"}" data-k="${esc(k)}" data-i="${i + 1}"><i style="background:${series[i]._color}"></i>${esc(series[i]._label)}</button>`).join("") + `<span class="mono dim" style="font-size:10px;margin-left:6px">dashed red = episode reset · click the chart to seek</span>`;
    $$("#plLegend button").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.k, on = PL.hidden.has(k); on ? PL.hidden.delete(k) : PL.hidden.add(k); store.set("plHidden", [...PL.hidden]);
      b.classList.toggle("on", on); PL.u.setSeries(+b.dataset.i, { show: on });
    }));
    PL.u.over.addEventListener("click", () => { const i = PL.u.cursor.idx; if (i != null) vid.currentTime = PL.t[i]; });
  } catch { $("#plLegend").innerHTML = `<span class="note">no per-step signals for this recording (recorded before signal export)</span>`; }
  cancelAnimationFrame(PL.raf);
  const tick = () => { PL.u?.redraw(false, false); PL.raf = requestAnimationFrame(tick); }; tick();
}
function closePlayer() { const vid = $("#plVideo"); vid.pause(); vid.removeAttribute("src"); vid.load(); $("#player").classList.add("hidden"); cancelAnimationFrame(PL.raf); }
$("#plClose").addEventListener("click", closePlayer);
$("#player").addEventListener("click", (e) => { if (e.target.id === "player") closePlayer(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#player").classList.contains("hidden")) closePlayer(); });
seg("#plSpeed", "1", (v) => { $("#plVideo").playbackRate = +v; });

/* ================= spec: terminations, DR, rewards, I/O, parameters — with what changed ================= */
const SPEC_QUIET = new Set(["PPO.resume from", "PPO.seed", "Simulation.seed", "Resets & events.ladder_stage"]);   // differ every run; not "what is tested"
S.specVs = ""; S.specMode = store.get("specMode", "all");
async function renderSpec() {
  if (S.stageTab !== "spec" || !S.sel) return;
  const el = $("#spec");
  let d; try { d = await api(`/api/spec?id=${S.sel}${S.specVs ? "&vs=" + S.specVs : ""}`); } catch (e) { el.innerHTML = `<div class="note">${esc(e.message)}</div>`; return; }
  const vs = $("#specVs");
  vs.innerHTML = `<option value="">auto: ${esc(d.auto !== false && d.base ? d.base : "warm-start parent")}</option><option value="none" ${S.specVs === "none" ? "selected" : ""}>— no baseline —</option>`
    + S.state.runs.filter((r) => r.id !== S.sel).map((r) => `<option value="${r.id}" ${r.id === S.specVs ? "selected" : ""}>${esc(r.name)}</option>`).join("");
  const diffs = [];
  for (const [sec, rows] of Object.entries(d.sections)) for (const r of rows) if (r.status !== "same" && !SPEC_QUIET.has(`${sec}.${r.key}`)) diffs.push([sec, r]);
  const line = ([sec, r]) => {
    let what;
    if (r.status === "added") what = `<span style="color:var(--live)">+ ${esc(r.key)}</span> ${esc(r.fn || "")} ${r.value != null && r.value !== "" ? esc(String(r.value)) : ""} ${esc(r.params || "")}`;
    else if (r.status === "removed") what = `<span style="color:#f3a99e">− ${esc(r.key)}</span>`;
    else {
      const parts = [];
      if (r.was?.value !== undefined) parts.push(`${esc(String(r.was.value))} → <b class="hl">${esc(String(r.value))}</b>`);
      if (r.was?.fn !== undefined) parts.push(`${esc(r.was.fn)} → <b class="hl">${esc(r.fn)}</b>`);
      for (const [k, [a, b]] of Object.entries(r.sub || {})) parts.push(`${esc(k)}: ${esc(a ?? "∅")} → <b class="hl">${esc(b ?? "∅")}</b>`);
      if (r.was?.params !== undefined && !Object.keys(r.sub || {}).length) parts.push(`params → <b class="hl">${esc(r.params)}</b>`);
      what = `${esc(r.key)} &nbsp; ${parts.join(" · ")}`;
    }
    return `<li><span class="s">${esc(sec)}</span><span>${what}</span></li>`;
  };
  const tests = d.base ? `<div class="sp-tests"><h4>What this run tests<span class="base">vs ${esc(d.base)}${d.auto ? " (warm-start parent)" : ""}</span></h4>
      ${diffs.length ? `<ul>${diffs.map(line).join("")}</ul>` : `<div class="none">identical configuration — differs only in seed / starting checkpoint</div>`}</div>` : "";
  const cell = (r) => {
    const val = r.value == null ? "" : String(r.value);
    const vcell = r.was?.value !== undefined ? `<span class="hl">${esc(val)}</span><span class="was">${esc(String(r.was.value))}</span>` : esc(val);
    const fcell = r.was?.fn !== undefined ? `<span class="hl">${esc(r.fn)}</span><span class="was">${esc(r.was.fn)}</span>` : esc(r.fn || "");
    const sub = Object.entries(r.sub || {}).map(([k, [a, b]]) => `${esc(k)}: <s>${esc(a ?? "∅")}</s> → ${esc(b ?? "∅")}`).join(" · ");
    return `<tr class="${r.status}"><td class="k" title="${esc(r.key)}">${esc(r.key)}</td><td class="f" title="${esc(r.fn || "")}">${fcell}</td><td class="v">${vcell}</td>
      <td class="p" title="${esc(r.params || "")}">${esc(r.params || "")}${sub ? `<span class="sub">${sub}</span>` : ""}</td></tr>`;
  };
  const q = (S.state?.queue || []).slice(0, 6);
  const nextUp = q.length ? `<div class="sp-next"><span class="t">Up next</span>${q.map((j) => {
      const extra = j.text.split(/\s+/).slice(3).filter((a) => !/^--agent\.(resume|load-run|load-checkpoint)$/.test(a));
      return `<div class="row"><b>${esc(j.name)}</b><span class="dim">${esc(j.task.replace(/^.*Chopsticks-/, ""))}</span>${extra.length ? `<span class="hl">${esc(extra.join(" "))}</span>` : ""}</div>`;
    }).join("")}</div>` : "";
  const only = S.specMode === "changes";
  el.innerHTML = tests + nextUp + `<div class="sp-grid">${Object.entries(d.sections).map(([sec, rows]) => {
    const shown = only ? rows.filter((r) => r.status !== "same") : rows;
    if (!shown.length) return "";
    const nch = rows.filter((r) => r.status !== "same" && !SPEC_QUIET.has(`${sec}.${r.key}`)).length;
    return `<div class="sp-sec"><div class="hd"><span class="t">${esc(sec)}</span><span class="n">${rows.length}</span>${nch ? `<span class="chg">${nch} changed</span>` : ""}</div>
      <table class="sp-tbl">${shown.map(cell).join("")}</table></div>`;
  }).join("") || `<div class="note">no differences</div>`}</div>`;
  $$(".sp-tbl tr", el).forEach((tr) => tr.addEventListener("click", () => tr.classList.toggle("open")));
}
$("#specVs").addEventListener("change", (e) => { S.specVs = e.target.value; renderSpec(); });
seg("#specMode", S.specMode, (v) => { S.specMode = v; store.set("specMode", v); renderSpec(); });

/* ================= log ================= */
async function pollLog(force) {
  if (S.stageTab !== "log" || !S.sel) return;
  try {
    const d = await api(`/api/log?id=${S.sel}&bytes=60000`); const pre = $("#logText");
    const atEnd = force || pre.parentElement.scrollTop + pre.parentElement.clientHeight >= pre.parentElement.scrollHeight - 40;
    pre.textContent = d.text || "(no console log for this run)";
    if (atEnd) $(".stage-body").scrollTop = 1e9;
  } catch {}
}

/* ================= dock ================= */
function setDock(v) {
  S.dockTab = v; $$("#dockTabs .dock-tab").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  $$(".dock-pane").forEach((p) => p.classList.toggle("on", p.id === "pane-" + v));
  ({ queue: renderQueue, rollouts: renderRollouts, config: renderConfig, evals: renderEvals })[v]();
}
$("#dockTabs").addEventListener("click", (e) => { const b = e.target.closest(".dock-tab"); if (b) setDock(b.dataset.v); });

function renderQueue() {
  if (S.dockTab !== "queue" || !S.state) return;
  const el = $("#pane-queue"); const keepDraft = $("#qAdd")?.value;
  const q = S.state.queue;
  el.innerHTML = `<div class="add"><textarea id="qAdd" class="mono" placeholder="task run_name iters [args…]   — inserted at the front"></textarea>
      <div class="row"><button class="gbtn" id="qTpl">from selected run</button><button class="gbtn primary" id="qAddBtn">+ Add</button></div></div>
    <div class="sec-title">Queued<span class="n">${q.length}</span></div>
    ${q.map((j, k) => `<div class="q ${k === 0 ? "next" : ""}"><span class="i">${k + 1}</span><span class="nm">${esc(j.name)}</span>
        <span class="ops"><button class="ibtn" data-op="top" data-l="${j.line}" title="move to front">⤒</button><button class="ibtn" data-op="up" data-l="${j.line}" title="up">↑</button><button class="ibtn" data-op="down" data-l="${j.line}" title="down">↓</button><button class="ibtn" data-op="remove" data-l="${j.line}" title="remove">×</button></span>
        <span class="tk" title="${esc(j.text)}">${esc(j.task)} · ${esc(j.iters)} it ${esc(j.text.split(/\s+/).slice(3).join(" "))}</span></div>`).join("") || `<div class="note">queue is empty</div>`}`;
  if (keepDraft) $("#qAdd").value = keepDraft;
  $$("[data-op]", el).forEach((b) => b.addEventListener("click", async () => {
    if (b.dataset.op === "remove" && !confirm("Remove this job from the queue?")) return;
    try { await api("/api/queue", { op: b.dataset.op, line: +b.dataset.l }); pollState(); } catch (e) { toast(e.message); }
  }));
  $("#qAddBtn").addEventListener("click", async () => {
    const t = $("#qAdd").value.trim(); if (!t) return;
    try { await api("/api/queue", { op: "add", text: t }); $("#qAdd").value = ""; toast("queued"); pollState(); } catch (e) { toast(e.message); }
  });
  $("#qTpl").addEventListener("click", () => {
    const r = runById(S.sel); if (!r) return; const task = S.detail?.task || r.task || "TASK";
    const ck = S.detail?.checkpoints?.slice(-1)[0];
    $("#qAdd").value = `${task} ${r.name}_v2 ${r.max_iter || 1000}${ck ? ` --agent.resume True --agent.load-run <warm_dir> --agent.load-checkpoint ${ck}` : ""}`;
  });
}

function renderRollouts() {
  const el = $("#pane-rollouts"); const r = runById(S.sel); const d = S.detail;
  if (!r) { el.innerHTML = `<div class="note">select a run</div>`; return; }
  if (el.contains(document.activeElement) && el._for === r.id) { renderJobs(); return; }   // don't clobber the form while typing
  el._for = r.id;
  const cks = d?.checkpoints || [];
  el.innerHTML = `<div class="sec-title">Record</div>
    <div class="form">
      <label>task</label><input id="roTask" value="${esc(d?.task || r.task || "")}" spellcheck="false" />
      <label>checkpoint</label><select id="roCk">${cks.slice().reverse().map((c) => `<option>${esc(c)}</option>`).join("")}</select>
      <label>steps</label><input id="roSteps" type="number" value="300" min="20" max="3000" />
      <label>envs</label><input id="roEnvs" type="number" value="1" min="1" max="64" />
    </div>
    <div class="row" style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="gbtn primary" id="roGo" ${cks.length ? "" : "disabled"}>● Record rollout</button></div>
    <div id="roJobs"></div>
    <div class="sec-title">Videos<span class="n">${d?.videos?.length || 0}</span></div>
    <div class="thumbs">${(d?.videos || []).slice(0, 24).map((v, i) => `<div class="thumb" data-vi="${i}">${v.gif ? `<img loading="lazy" src="${media(v.gif)}" />` : `<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />`}
      <div>${v.iter != null ? "iter " + v.iter : esc(v.name)} · ${ago(v.mtime)}</div></div>`).join("")}</div>
    ${(d?.videos || []).length ? "" : `<div class="note">no videos yet — record one above</div>`}`;
  $$(".thumb", el).forEach((t) => t.addEventListener("click", () => {
    $(`#stageTabs [data-v="rollouts"]`).click(); renderGallery(); RV.picks = [d.videos[+t.dataset.vi].path]; RV.sig = null; RV.update(); RV._renderPlayer();
  }));
  $("#roGo")?.addEventListener("click", async () => {
    try {
      await api("/api/rollout", { id: r.id, task: $("#roTask").value.trim(), checkpoint: $("#roCk").value, steps: +$("#roSteps").value, envs: +$("#roEnvs").value });
      toast("recording on the GPU…"); pollState();
    } catch (e) { toast(e.message); }
  });
  renderJobs();
}
function renderJobs() {
  const box = $("#roJobs"); if (!box) return;
  const jobs = (S.state?.rollouts || []).filter((j) => j.run === S.sel).slice(0, 6);
  const lab = { running: "◌ recording", queued: "· queued", done: "✓ done", failed: "× failed" };
  box.innerHTML = jobs.map((j) => `<div class="job ${j.state}">${lab[j.state]} · ${esc(j.ckpt)}${j.auto ? " · auto" : ""} · ${ago(j.started || j.queued)} ago${j.tail ? `<pre>${esc(j.tail)}</pre>` : ""}</div>`).join("");
  if (jobs.some((j) => j.state === "done") && S._lastDone !== jobs.filter((j) => j.state === "done").length) { S._lastDone = jobs.filter((j) => j.state === "done").length; loadDetail(); }
}

async function renderConfig() {
  const el = $("#pane-config"); const r = runById(S.sel);
  if (!r) { el.innerHTML = `<div class="note">select a run</div>`; return; }
  const others = S.state.runs.filter((x) => x.id !== r.id);
  el.innerHTML = `<div class="form"><label>diff vs</label><select id="cfgVs"><option value="">— none (show files) —</option>${others.map((o) => `<option value="${o.id}" ${o.id === S.cfgVs ? "selected" : ""}>${esc(o.name)}</option>`).join("")}</select></div><div id="cfgBody" class="note">loading…</div>`;
  $("#cfgVs").addEventListener("change", (e) => { S.cfgVs = e.target.value; renderConfig(); });
  try {
    const d = await api(`/api/config?id=${r.id}${S.cfgVs ? "&vs=" + S.cfgVs : ""}`);
    const body = $("#cfgBody"); if (!body) return;
    if (S.cfgVs) {
      body.outerHTML = Object.entries(d.diff).map(([k, t]) => `<div class="sec-title">${esc(k)}</div><div class="code">${t ? t.split("\n").map((l) => `<span class="${l.startsWith("+") && !l.startsWith("+++") ? "a" : l.startsWith("-") && !l.startsWith("---") ? "d" : l.startsWith("@@") ? "h" : ""}">${esc(l)}</span>`).join("\n") : "identical"}</div>`).join("");
    } else {
      body.outerHTML = Object.entries(d.files).map(([k, t]) => `<div class="sec-title">${esc(k)}</div><div class="code">${esc(t)}</div>`).join("") || `<div class="note">no params/ directory for this run</div>`;
    }
  } catch (e) { $("#cfgBody").textContent = e.message; }
}

function flatten(o, p = "", out = {}) { for (const [k, v] of Object.entries(o)) { const key = p ? `${p}.${k}` : k; v && typeof v === "object" && !Array.isArray(v) ? flatten(v, key, out) : (out[key] = v); } return out; }
function renderEvals() {
  const el = $("#pane-evals"); const ev = S.detail?.evals || [];
  if (!ev.length) { el.innerHTML = `<div class="note">no eval files matched to this run</div>`; return; }
  el.innerHTML = ev.map((e) => {
    const f = flatten(e.data);
    return `<div class="sec-title">${esc(e.file)}<span class="n">${ago(e.mtime)} ago</span></div><table class="kv"><tr><th>key</th><th>value</th></tr>${Object.entries(f).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="${/success/.test(k) ? "hi" : ""}">${typeof v === "number" ? (v <= 1 && v >= 0 && /success|rate|frac/.test(k) ? pct(v) : fmt(v, 4)) : esc(JSON.stringify(v))}</td></tr>`).join("")}</table>`;
  }).join("");
}

/* ================= timeline ================= */
function renderTimeline() {
  const ev = S.state.events.filter((e) => S.evFilter === "all" || e.kind === S.evFilter);
  $("#bandCount").textContent = `${ev.length} events`;
  $("#timeline").innerHTML = ev.slice().reverse().map((e) => `<div class="ev"><span class="tm">${esc(e.time)}</span><span class="kd ${e.kind}">${e.kind}</span><span class="ms" title="${esc(e.msg)}">${esc(e.msg)}</span></div>`).join("");
}
seg("#evFilter", "all", (v) => { S.evFilter = v; renderTimeline(); });

/* ================= tabs / boot ================= */
function seg(sel, initial, fn) {
  const el = $(sel);
  $$("button", el).forEach((b) => b.classList.toggle("on", b.dataset.v === String(initial)));
  el.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; $$("button", el).forEach((x) => x.classList.toggle("on", x === b)); fn(b.dataset.v); });
}
seg("#stageTabs", "plots", (v) => {
  S.stageTab = v; if (MQ.matches && document.body.dataset.m !== v) markMTab(v); $$(".pane").forEach((p) => p.classList.toggle("on", p.id === v));
  $("#plotTools").classList.toggle("hidden", v !== "plots"); $("#sysTools").classList.toggle("hidden", v !== "system");
  $("#rollTools").classList.toggle("hidden", v !== "rollouts"); $("#specTools").classList.toggle("hidden", v !== "spec");
  if (v === "spec") renderSpec();
  if (v === "system") buildSystem(); if (v === "plots") rebuildPlots(); if (v === "log") pollLog(true);
  if (v === "rollouts") { renderGallery(); loadDetail(); } else if (RV) RV._playAllPaused();
});

/* ================= phone layout: bottom tab bar picks one section ================= */
const MQ = matchMedia("(max-width: 800px)");
const STAGE_TABS = ["plots", "rollouts", "spec", "system", "log"];
function markMTab(v) {
  document.body.dataset.m = v; store.set("mtab", v);
  $$("#mTabs button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
}
function setMTab(v) {
  markMTab(v);
  if (STAGE_TABS.includes(v) && S.stageTab !== v) $(`#stageTabs [data-v="${v}"]`).click();
  if (v === "queue") setDock(S.dockTab);
  if (v !== "rollouts" && RV) RV._playAllPaused?.();
  window.scrollTo(0, 0);
}
$("#mTabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setMTab(b.dataset.v); });
markMTab(store.get("mtab", S.sel ? "plots" : "runs"));
MQ.addEventListener("change", () => { if (MQ.matches) setMTab(document.body.dataset.m || "plots"); });

pollState().then(() => {
  pollScalars(); pollSystem();
  const h = location.hash.slice(1);
  if (["system", "log", "rollouts", "spec"].includes(h)) $(`#stageTabs [data-v="${h}"]`).click();
  if (["config", "evals"].includes(h)) setDock(h);
  if (MQ.matches) setMTab(["runs", "queue", ...STAGE_TABS].includes(h) ? h : document.body.dataset.m);
});
setInterval(pollState, 2000);
setInterval(pollScalars, 3000);
setInterval(pollSystem, 2000);
setInterval(() => pollLog(false), 3000);
setInterval(() => { if (S.sel) loadDetail(); }, 15000);
setInterval(() => { if (S.sel && (S.state?.rollouts || []).some((j) => j.run === S.sel && j.state === "running")) loadDetail(); }, 4000);

/* bipednav-demo.js — in-browser stair / obstacle geometry from ONE photo.
   1. monocular depth (Depth Anything V2 small, ONNX, runs locally via transformers.js)
   2. metric scale from the camera height: the shift of the affine-invariant
      inverse depth is chosen so the dominant up-facing surface is planar, the
      scale so that surface lies at the given height below the camera
   3. the BipedNav geometry pipeline (a port of experiments/stair_perception.py
      and obstacle_perception.py): grid normals -> predominant normal modes ->
      tread/riser (or floor/obstacle) points -> 1-D offset lattices
   Output: stair rise + run (+ pitch), or obstacle distance + depth + height.   */

import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.2";

env.allowLocalModels = false;
const MODEL = "onnx-community/depth-anything-v2-small";
const $ = (s) => document.querySelector(s);

// ---------------------------------------------------------------- UI state
const ui = {
  drop: $("#bn-drop"), file: $("#bn-file"), run: $("#bn-run"), status: $("#bn-status"),
  cin: $("#bn-canvas-in"), cdepth: $("#bn-canvas-depth"), cseg: $("#bn-canvas-seg"), cprof: $("#bn-canvas-profile"),
  camh: $("#bn-camh"), fov: $("#bn-fov"), mode: $("#bn-mode"), result: $("#bn-result"), stock: $("#bn-stock"),
};
let depthPipe = null, currentImage = null, currentRef = null;

function setStatus(t, busy = false) { ui.status.textContent = t; ui.status.classList.toggle("busy", busy); }

async function getPipe() {
  if (depthPipe) return depthPipe;
  const device = ("gpu" in navigator) ? "webgpu" : "wasm";
  setStatus(`loading the depth network (${device}, ~27 MB, once)…`, true);
  try {
    depthPipe = await pipeline("depth-estimation", MODEL, { dtype: "q8", device, progress_callback: (p) => {
      if (p.status === "progress" && p.file && p.file.endsWith(".onnx")) setStatus(`downloading ${p.file.split("/").pop()} ${Math.round(p.progress || 0)} %`, true);
    } });
  } catch (e) {
    setStatus("WebGPU failed, retrying on WASM…", true);
    depthPipe = await pipeline("depth-estimation", MODEL, { dtype: "q8", device: "wasm" });
  }
  return depthPipe;
}

// ---------------------------------------------------------------- image in
function loadImageFile(file) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(file); });
}
function loadImageURL(url) {
  return new Promise((res, rej) => { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => res(img); img.onerror = rej; img.src = url; });
}
function drawInput(img) {
  const W = 640, H = Math.round(640 * img.naturalHeight / img.naturalWidth);
  for (const c of [ui.cin, ui.cdepth, ui.cseg]) { c.width = W; c.height = H; }
  ui.cin.getContext("2d").drawImage(img, 0, 0, W, H);
}

import { percentile, median, backproject, gridNormals, sphereModes, offsetClusters, latticeSpacing, upAxis, stairPipeline, obstaclePipeline, metricCloud, dot3, cross3, unit, sub3, scale3 } from "./bipednav-geom.js";

// ---------------------------------------------------------------- drawing
function turbo(t) { t = Math.max(0, Math.min(1, t)); const r = 34.61 + t * (1172.33 - t * (10793.56 - t * (33300.12 - t * (38394.49 - t * 14825.05)))), g = 23.31 + t * (557.33 + t * (1225.33 - t * (3574.96 - t * (1073.77 + t * 707.56)))), b = 27.2 + t * (3211.1 - t * (15327.97 - t * (27814 - t * (22569.18 - t * 6838.66)))); return [r, g, b].map((x) => Math.max(0, Math.min(255, x))); }
function drawDepth(z, W, H, canvas) {
  const ctx = canvas.getContext("2d"), img = ctx.createImageData(canvas.width, canvas.height);
  const valid = Array.from(z).filter((x) => x > 0), lo = percentile(valid, 2), hi = percentile(valid, 98);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const u = Math.floor(x * W / canvas.width), v = Math.floor(y * H / canvas.height), zz = z[v * W + u];
    const o = 4 * (y * canvas.width + x);
    if (zz > 0) { const [r, g, b] = turbo(1 - (zz - lo) / (hi - lo)); img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255; }
    else { img.data[o] = 21; img.data[o + 1] = 24; img.data[o + 2] = 32; img.data[o + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0);
}
function drawSeg(pix, groups, W, H, canvas) {
  const ctx = canvas.getContext("2d"); ctx.drawImage(ui.cin, 0, 0); ctx.fillStyle = "rgba(244,234,210,0.55)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const sx = canvas.width / W, sy = canvas.height / H, r = Math.max(2, 1.5 * sx);
  for (const g of groups) { ctx.fillStyle = g.color; for (const i of g.idx) { const [u, v] = pix[i]; ctx.fillRect(u * sx - r / 2, v * sy - r / 2, r, r); } }
}
function drawProfile(pts, up, fwd, groups, lines, canvas, title) {
  const ctx = canvas.getContext("2d"); const Wc = canvas.width, Hc = canvas.height;
  ctx.fillStyle = "#FDF6E2"; ctx.fillRect(0, 0, Wc, Hc);
  const lat = cross3(up, fwd), lm = median(pts.map((p) => dot3(p, lat)));
  const band = []; for (let i = 0; i < pts.length; i++) if (Math.abs(dot3(pts[i], lat) - lm) < 0.25) band.push(i);
  const F = band.map((i) => dot3(pts[i], fwd)), U = band.map((i) => dot3(pts[i], up));
  const f0 = percentile(F, 1), f1 = percentile(F, 99), u0 = percentile(U, 1), u1 = percentile(U, 99);
  const pad = 36, sc = Math.min((Wc - 2 * pad) / (f1 - f0 + 1e-6), (Hc - 2 * pad) / (u1 - u0 + 1e-6));
  const X = (f) => pad + (f - f0) * sc, Y = (u) => Hc - pad - (u - u0) * sc;
  ctx.fillStyle = "rgba(109,101,81,0.45)"; for (let j = 0; j < band.length; j++) ctx.fillRect(X(F[j]) - 1, Y(U[j]) - 1, 2, 2);
  const inBand = new Set(band);
  for (const g of groups) { ctx.fillStyle = g.color; for (const i of g.idx) if (inBand.has(i)) { const f = dot3(pts[i], fwd), u = dot3(pts[i], up); ctx.fillRect(X(f) - 1.5, Y(u) - 1.5, 3, 3); } }
  ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
  for (const l of lines) { ctx.strokeStyle = l.color; ctx.beginPath(); if (l.axis === "up") { ctx.moveTo(pad, Y(l.v)); ctx.lineTo(Wc - pad, Y(l.v)); } else { ctx.moveTo(X(l.v), pad); ctx.lineTo(X(l.v), Hc - pad); } ctx.stroke(); }
  ctx.setLineDash([]); ctx.strokeStyle = "#151820"; ctx.lineWidth = 1.5; ctx.strokeRect(pad, pad, Wc - 2 * pad, Hc - 2 * pad);
  ctx.fillStyle = "#151820"; ctx.font = "12px 'Space Mono', monospace"; ctx.fillText(title, pad, pad - 12); ctx.fillText("forward →", Wc - pad - 70, Hc - pad + 22); ctx.save(); ctx.translate(pad - 22, pad + 40); ctx.rotate(-Math.PI / 2); ctx.fillText("up →", 0, 0); ctx.restore();
  // 0.5 m scale bar
  ctx.fillRect(Wc - pad - 0.5 * sc, pad + 8, 0.5 * sc, 3); ctx.fillText("0.5 m", Wc - pad - 0.5 * sc, pad + 24);
}

// ---------------------------------------------------------------- main run
async function run() {
  if (!currentImage) { setStatus("drop a photo first"); return; }
  ui.run.disabled = true;
  try {
    const pipe = await getPipe();
    setStatus("estimating depth…", true);
    const t0 = performance.now();
    const out = await pipe(currentImage.src);
    const pd = out.predicted_depth; const [Hd, Wd] = pd.dims.slice(-2); const data = pd.data;
    // work on a 256-wide grid
    const W = 256, H = Math.round(256 * Hd / Wd), disp = new Float32Array(W * H);
    for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) disp[v * W + u] = data[Math.min(Hd - 1, Math.floor((v + 0.5) * Hd / H)) * Wd + Math.min(Wd - 1, Math.floor((u + 0.5) * Wd / W))];
    const hfov = parseFloat(ui.fov.value) * Math.PI / 180, fx = (W / 2) / Math.tan(hfov / 2), fy = fx, cx = W / 2, cy = H / 2;
    const camH = parseFloat(ui.camh.value);
    setStatus("recovering metric scale from the camera height…", true);
    const { z, shiftFrac } = metricCloud(disp, W, H, fx, fy, cx, cy, camH);
    drawDepth(z, W, H, ui.cdepth);
    const P = backproject(z, W, H, fx, fy, cx, cy); const { pts, nrm, pix } = gridNormals(P, W, H, 2, 2);
    setStatus("extracting planes…", true);
    const mode = ui.mode.value;
    let st = null, ob = null, useStairs = mode === "stairs";
    if (mode !== "obstacle") st = stairPipeline(pts, nrm);
    if (mode !== "stairs") ob = obstaclePipeline(pts, nrm);
    if (mode === "auto") useStairs = st && st.nTreads >= 2 && st.rise > 0.06 && st.rise < 0.45 && (!ob || !ob.found || ob.plateaus >= 2);
    const ms = Math.round(performance.now() - t0);
    const ref = currentRef ? ` <span class="muted">tape: rise ${currentRef.rise.toFixed(1)} cm, run ${currentRef.run.toFixed(1)} cm</span>` : "";
    if (useStairs && st) {
      drawSeg(pix, [{ idx: st.tread, color: "rgba(35,87,126,0.9)" }, { idx: st.riser, color: "rgba(228,68,42,0.9)" }], W, H, ui.cseg);
      drawProfile(pts, st.up, st.fwd, [{ idx: st.tread, color: "#23577E" }, { idx: st.riser, color: "#E4442A" }],
        [...st.tOff.map((v) => ({ axis: "up", v, color: "#23577E" })), ...st.rOff.map((v) => ({ axis: "fwd", v, color: "#E4442A" }))], ui.cprof, "side profile (0.5 m band)");
      ui.result.innerHTML = `<div class="bn-big"><span>rise <b>${(st.rise * 100).toFixed(1)} cm</b></span><span>run <b>${(st.run * 100).toFixed(1)} cm</b></span><span>pitch <b>${(Math.atan2(st.rise, st.run) * 180 / Math.PI).toFixed(0)}°</b></span></div>
        <p>${st.nTreads} treads and ${st.nRisers} risers found · ${st.runNote} · camera pitched ${st.camPitch.toFixed(0)}° down · scale from a camera height of ${camH.toFixed(2)} m (inverse-depth shift ${shiftFrac}) · ${ms} ms${ref}</p>`;
    } else if (ob && ob.found) {
      drawSeg(pix, [{ idx: ob.floorIdx, color: "rgba(35,87,126,0.7)" }, { idx: ob.obsIdx, color: "rgba(217,161,63,0.95)" }], W, H, ui.cseg);
      drawProfile(pts, ob.up, ob.fwd, [{ idx: ob.floorIdx, color: "#23577E" }, { idx: ob.obsIdx, color: "#D9A13F" }],
        [{ axis: "fwd", v: ob.dist, color: "#E4442A" }, { axis: "fwd", v: ob.dist + ob.depth, color: "#E4442A" }, { axis: "up", v: ob.floorC + ob.height, color: "#D9A13F" }], ui.cprof, "side profile (0.5 m band)");
      ui.result.innerHTML = `<div class="bn-big"><span>distance <b>${ob.dist.toFixed(2)} m</b></span><span>depth <b>${(ob.depth * 100).toFixed(0)} cm</b></span><span>height <b>${(ob.height * 100).toFixed(0)} cm</b></span></div>
        <p>first obstacle in the walking corridor (${ob.note}) · camera ${ob.camH.toFixed(2)} m above the floor, pitched ${ob.camPitch.toFixed(0)}° down · ${ms} ms · a walker with 0.5 m shanks steps over boxes up to 25 cm high and 30 cm deep (see the planner below)</p>`;
    } else {
      ui.result.innerHTML = `<p>No staircase or obstacle found (${ob ? ob.note : "no planes"}). Try a photo taken from ~1–2 m above the floor, looking down at the steps.</p>`;
      drawSeg(pix, [], W, H, ui.cseg);
    }
    setStatus(`done in ${ms} ms — everything ran in your browser`);
  } catch (e) {
    console.error(e); setStatus("failed: " + (e.message || e));
  } finally { ui.run.disabled = false; }
}

// ---------------------------------------------------------------- wiring
async function useImage(img, ref = null) { currentImage = img; currentRef = ref; drawInput(img); if (ref) ui.camh.value = ref.camH.toFixed(2); ui.result.innerHTML = ""; setStatus("ready — press Run"); }
if (ui.drop) {
  ui.drop.addEventListener("dragover", (e) => { e.preventDefault(); ui.drop.classList.add("over"); });
  ui.drop.addEventListener("dragleave", () => ui.drop.classList.remove("over"));
  ui.drop.addEventListener("drop", async (e) => { e.preventDefault(); ui.drop.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) useImage(await loadImageFile(f)); });
  ui.drop.addEventListener("click", () => ui.file.click());
  ui.file.addEventListener("change", async () => { if (ui.file.files[0]) useImage(await loadImageFile(ui.file.files[0])); });
  ui.run.addEventListener("click", run);
  document.querySelectorAll("#bn-stock img").forEach((im) => im.addEventListener("click", async () => {
    const ref = { rise: parseFloat(im.dataset.rise), run: parseFloat(im.dataset.run), camH: parseFloat(im.dataset.camh) };
    useImage(await loadImageURL(im.src), ref);
  }));
  setStatus("drop a staircase or obstacle photo, or pick a stock scene");
  const qs = new URLSearchParams(location.search);
  if (qs.has("autorun")) {
    const im = document.querySelectorAll("#bn-stock img")[parseInt(qs.get("autorun")) || 3];
    (async () => { await useImage(await loadImageURL(im.src), { rise: parseFloat(im.dataset.rise), run: parseFloat(im.dataset.run), camH: parseFloat(im.dataset.camh) }); await run(); document.body.dataset.bnDone = "1"; })();
  }
}

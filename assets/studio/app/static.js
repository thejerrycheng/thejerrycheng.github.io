/* static.js — runs this same studio as a read-only snapshot (the encrypted website copy).
   The page sets window.RLDASH_STATIC = {generated, state, system, runs: {id: {info, sc}}, media: {path: {f, t, run}}, meshes, dir}
   before this script. Every API call the app makes is answered from that bundle: small parts are inline, per-run pieces
   (detail / spec / config / log, scalars, 3-D replays, thumbnails) are fetched, decrypted (window.JCPrivate, kept by the
   site's studio.html shell) and unpacked the first time the app asks for them. Server actions answer "read-only". */
"use strict";
(function () {
  const B = window.RLDASH_STATIC; if (!B) return;
  const P = window.JCPrivate, dir = B.dir || "assets/private/studio/";
  const memo = new Map();
  const once = (k, f) => { if (!memo.has(k)) { const p = f(); memo.set(k, p); p.catch(() => memo.delete(k)); } return memo.get(k); };

  /* ---- encrypted, gzipped pieces ---- */
  function gunzip(buf) {
    if (!window.DecompressionStream) return Promise.reject(new Error("this browser cannot unpack the snapshot"));
    return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  }
  const raw = (f) => once("raw:" + f, () => P.bytes(dir + f).then(gunzip));
  const json = (f) => once("json:" + f, () => raw(f).then((b) => JSON.parse(new TextDecoder().decode(b))));
  function unpack(ab) {          // 'RPB1' | u32 header length | header JSON | blobs
    const u8 = new Uint8Array(ab);
    if (u8[0] !== 82 || u8[1] !== 80 || u8[2] !== 66 || u8[3] !== 49) throw new Error("not a packed file");
    const hl = new DataView(ab).getUint32(4, true), h = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + hl))), b0 = 8 + hl;
    h.blob = (n) => { const e = h.blobs[n]; return u8.subarray(b0 + e[0], b0 + e[0] + e[1]); };
    return h;
  }
  const packed = (f) => once("pk:" + f, () => raw(f).then(unpack));
  function i16(bytes) { const n = bytes.length >> 1, out = new Int16Array(n); for (let i = 0; i < n; i++) out[i] = (bytes[n + i] << 8) | bytes[i]; return out; }
  function f16(bytes) {            // little-endian IEEE half floats (NaN = no value)
    const n = bytes.length >> 1, out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const h = bytes[2 * i] | (bytes[2 * i + 1] << 8), s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023;
      out[i] = e === 0 ? s * m * 5.960464477539063e-8 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * Math.pow(2, e - 15);
    }
    return out;
  }
  function f32(bytes) { return new Float32Array(bytes.slice().buffer); }
  function f64(bytes) { return new Float64Array(bytes.slice().buffer); }
  function u32(bytes) { return new Uint32Array(bytes.slice().buffer); }

  /* ---- per-run pieces ---- */
  const info = (id) => B.runs[id] ? json(B.runs[id].info) : Promise.reject(new Error("this run is not in the snapshot"));
  const scalars = (id) => once("sc:" + id, () => {
    if (!B.runs[id]) return Promise.resolve({ data: {}, last_step: -1 });
    return packed(B.runs[id].sc).then((h) => {
      const ts = f64(h.blob("tt")), tsS = u32(h.blob("ts"));     // step -> wall time table (interpolated)
      const timeAt = (s) => { let lo = 0, hi = tsS.length - 1; if (hi < 0) return 0; if (s <= tsS[0]) return ts[0]; if (s >= tsS[hi]) return ts[hi];
        while (hi - lo > 1) { const m = (lo + hi) >> 1; tsS[m] <= s ? (lo = m) : (hi = m); } const a = (s - tsS[lo]) / Math.max(1, tsS[hi] - tsS[lo]); return ts[lo] + a * (ts[hi] - ts[lo]); };
      const data = {};
      h.tags.forEach((t, k) => {
        const d = u32(h.blob("s" + k)), v = h.kinds[k] === "f" ? f32(h.blob("v" + k)) : f16(h.blob("v" + k)), pts = []; let s = 0;
        for (let i = 0; i < d.length; i++) { s += d[i]; if (!isNaN(v[i])) pts.push([s, v[i], timeAt(s)]); }
        data[t] = pts;
      });
      return { data, last_step: h.last_step };
    });
  });
  const meshLib = () => once("meshes", () => packed(B.meshes).then((h) => {
    const out = {};
    for (const k of Object.keys(h.meshes)) {
      const m = h.meshes[k], q = i16(h.blob("v:" + k)), v = new Float32Array(m.nv * 3);
      for (let j = 0; j < v.length; j++) v[j] = m.lo[j % 3] + (q[j] + 32767) * m.sc[j % 3];
      const d = i16(h.blob("i:" + k)), I = new Uint16Array(m.ni);
      for (let t = 0, a = 0; t < m.ni; t++) { a = (a + d[t]) & 0xffff; I[t] = a; }
      out[k] = { v, i: I };
    }
    return out;
  }));
  function replay(f) {
    return Promise.all([meshLib(), packed(f)]).then(([L, h0]) => {
      const h = Object.assign({}, h0), nb = h.nb, w = nb * 7, q = i16(h0.blob("poses")), n = h.n;
      for (let i = w; i < q.length; i++) q[i] = q[i - w] + q[i];        // time deltas (Int16Array wraps like the encoder)
      const F = new Float32Array(q.length), lo = h.pose_lo, sc = h.pose_sc;
      for (let k = 0; k < n * nb; k++) { const o = k * 7;
        for (let c = 0; c < 3; c++) F[o + c] = lo[c] + (q[o + c] + 32767) * sc[c];
        for (let c = 3; c < 7; c++) F[o + c] = q[o + c] / 32767; }
      h.posesF = F; h.trackF = h.track ? f32(h0.blob("track")) : null;
      h.meshes = h0.meshes.map((m) => { if (!L[m]) throw new Error("mesh library out of date, reload"); return L[m]; });
      delete h.blob; delete h.blobs;
      return h;
    });
  }

  /* ---- what the app calls ---- */
  B.media = (p) => "static:" + p;
  const mediaOf = (u) => B.media && typeof u === "string" && u.startsWith("static:") ? B.mediaMap[u.slice(7)] : null;
  window.Replay3DSource = (url) => { const m = mediaOf(url); return m && m.t === "replay" ? replay(m.f) : null; };

  const reply = (obj, code = 200) => new Response(JSON.stringify(obj), { status: code, headers: { "Content-Type": "application/json" } });
  async function answer(path, init) {
    const u = new URL(path, "http://x"), q = (k) => u.searchParams.get(k), id = q("id");
    if (init && init.method === "POST") return reply({ error: "read-only snapshot: open the studio on the training machine to do this" }, 403);
    switch (u.pathname) {
      case "/api/state": return reply(B.state);
      case "/api/system": { const t = +q("since") || 0; return reply({ samples: B.system.samples.filter((s) => s.t > t), static: B.system.static }); }
      case "/api/run": return reply((await info(id)).run);
      case "/api/scalars": {
        const all = await scalars(id), since = +(q("since") ?? -1);
        if (since >= all.last_step - 2 && since >= 0) return reply({ data: {}, last_step: all.last_step });   // nothing new in a snapshot
        const data = {}; for (const [t, pts] of Object.entries(all.data)) data[t] = pts.filter((p) => p[0] > since);
        return reply({ data, last_step: all.last_step });
      }
      case "/api/spec": { const d = await info(id), vs = q("vs") || "";
        if (!vs) return reply(d.spec); if (vs === "none") return reply(d.spec_none);
        return reply({ error: "the snapshot holds the comparison with the warm-start parent only" }, 404); }
      case "/api/config": { const d = await info(id);
        if (q("vs")) return reply({ error: "config diffs need the live studio" }, 404);
        return reply({ files: d.config || {} }); }
      case "/api/log": return reply({ text: (await info(id)).log || "" });
    }
    return reply({ error: "not in the snapshot" }, 404);
  }
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input && input.url;
    if (typeof url === "string") {
      if (url.startsWith("/api/")) return answer(url, init).catch((e) => reply({ error: e.message }, 500));
      const m = mediaOf(url);
      if (url.startsWith("static:")) {
        if (m && m.t === "sig") return info(m.run).then((d) => reply(d.signals[m.p] || {}, d.signals[m.p] ? 200 : 404));
        return Promise.resolve(reply({ error: "not in the snapshot" }, 404));
      }
    }
    return realFetch(input, init);
  };

  /* thumbnails: <img src="static:..."> -> decrypted blob URL */
  const blobs = new Map();
  function fix(img) {
    const s = img.getAttribute("src"); if (!s || !s.startsWith("static:")) return;
    const m = mediaOf(s); img.removeAttribute("src");
    if (!m || m.t !== "jpg") return;
    if (!blobs.has(m.f)) blobs.set(m.f, P.blobUrl(dir + m.f, "image/jpeg"));
    blobs.get(m.f).then((b) => { img.src = b; }).catch(() => {});
  }
  new MutationObserver((ms) => {
    for (const r of ms) {
      if (r.type === "attributes") { if (r.target.tagName === "IMG") fix(r.target); continue; }
      r.addedNodes.forEach((n) => { if (n.nodeType !== 1) return; if (n.tagName === "IMG") fix(n); else n.querySelectorAll && n.querySelectorAll('img[src^="static:"]').forEach(fix); });
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] });

  /* a newer snapshot: offer it (a reload keeps the selected run / tab, which the app stores locally) instead of reloading */
  const whenReady = (f) => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", f) : f();
  whenReady(() => {
    const pill = Object.assign(document.createElement("button"), { className: "snap-pill", type: "button" });
    pill.innerHTML = "New snapshot available · <b>refresh</b>"; pill.onclick = () => location.reload();
    document.body.appendChild(pill);
    let first = null;
    const sig = () => realFetch("assets/private/studio.enc", { method: "HEAD", cache: "no-store" })
      .then((r) => r.ok ? (r.headers.get("etag") || r.headers.get("last-modified") || r.headers.get("content-length")) : null);
    sig().then((s) => { first = s; }).catch(() => {});
    setInterval(() => { if (document.hidden || !first) return; sig().then((s) => { if (s && s !== first) pill.classList.add("on"); }).catch(() => {}); }, 180000);
  });
})();

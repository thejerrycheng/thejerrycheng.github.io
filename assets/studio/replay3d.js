/* Replay3D (copy of rldash/web/replay3d.js for the studio snapshot) — interactive 3-D replay of a recorded rollout (<rollout>.replay.json written by record_mjlab.py).
   Builds the scene once (MuJoCo Z-up), then setTime(t) poses every body (interpolated between the ~25 Hz frames) and
   the task's debug markers. Orbit: drag · zoom: wheel / pinch · pan: right-drag / two fingers. Renders on demand. */
"use strict";
const Replay3D = (() => {
  const T = { PLANE: 0, HFIELD: 1, SPHERE: 2, CAPSULE: 3, ELLIPSOID: 4, CYLINDER: 5, BOX: 6, MESH: 7, ARROW: 100, ARROW1: 101, ARROW2: 102, LINE: 103, LINEBOX: 104 };
  const BG = 0x14120f;
  const cache = new Map();                      // url -> Promise<decoded replay>; a few kept for quick A/B switching

  function b64(s, Type) {
    const bin = atob(s), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Type(u8.buffer);
  }
  /* url: a .replay.json URL, or {key, get()} whose get() resolves to a replay already decoded into typed arrays
     (posesF, trackF, meshes [{v, i}]) — the published studio snapshot decrypts and unpacks its replays itself. */
  function load(url) {
    const src = typeof url === "string" ? null : url;
    if (src) url = src.key;
    if (cache.has(url)) return cache.get(url);
    const got = src ? src.get() : fetch(url).then((r) => { if (!r.ok) throw new Error(`replay ${r.status}`); return r.json(); });
    const p = got.then((d) => {
      if (d.posesF) { d.duration = Math.max(0, (d.n - 1) * d.dt); return d; }
      d.posesF = b64(d.poses, Float32Array); delete d.poses;
      d.trackF = d.track ? b64(d.track, Float32Array) : null; delete d.track;
      d.meshes = d.meshes.map((m) => ({ v: b64(m.v, Float32Array), i: b64(m.i, m.i32 ? Uint32Array : Uint16Array) }));
      d.duration = Math.max(0, (d.n - 1) * d.dt);
      return d;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
    while (cache.size > 4) cache.delete(cache.keys().next().value);
    return p;
  }

  function capsuleGeom(r, h, seg = 20) {   // r128 has no CapsuleGeometry: lathe a stadium profile (y axis), then turn to z
    const pts = [], n = 8;
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI / 2; pts.push(new THREE.Vector2(r * Math.cos(a), -h + r * Math.sin(a))); }
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push(new THREE.Vector2(r * Math.cos(a), h + r * Math.sin(a))); }
    pts[0].x = 0; pts[pts.length - 1].x = 0;
    return new THREE.LatheGeometry(pts, seg).rotateX(Math.PI / 2);
  }
  function primGeom(t, s) {
    switch (t) {
      case T.BOX: return new THREE.BoxGeometry(2 * s[0], 2 * s[1], 2 * s[2]);
      case T.SPHERE: return new THREE.SphereGeometry(s[0], 24, 16);
      case T.ELLIPSOID: return new THREE.SphereGeometry(1, 24, 16).scale(s[0], s[1], s[2]);
      case T.CYLINDER: return new THREE.CylinderGeometry(s[0], s[0], 2 * s[1], 28).rotateX(Math.PI / 2);
      case T.CAPSULE: return capsuleGeom(s[0], s[1]);
    }
    return null;
  }

  // unit marker geometries (scaled per marker by the mjvGeom size)
  let UNIT = null;
  function unit() {
    if (UNIT) return UNIT;
    const arrow = (() => {                       // along +z from 0 to 1, shaft radius 1, head radius 2
      const shaft = new THREE.CylinderGeometry(1, 1, 0.78, 12).rotateX(Math.PI / 2).translate(0, 0, 0.39);
      const head = new THREE.ConeGeometry(2.2, 0.22, 14).rotateX(Math.PI / 2).translate(0, 0, 0.89);
      return [shaft, head];
    })();
    UNIT = {
      sphere: new THREE.SphereGeometry(1, 20, 14), box: new THREE.BoxGeometry(2, 2, 2),
      cyl: new THREE.CylinderGeometry(1, 1, 2, 20).rotateX(Math.PI / 2), arrow,
      line: new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1)]),
      linebox: new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)),
    };
    return UNIT;
  }

  class Viewer {
    constructor(host, opts = {}) {
      this.host = host; this.opts = opts; this.t = -1; this.follow = true; this._look = null; this.dirty = true; this.d = null; this.set = -1; this.markPool = [];
      this.canvasWrap = document.createElement("div"); this.canvasWrap.className = "r3d-canvas"; host.appendChild(this.canvasWrap);
      const R = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }));
      R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); R.setClearColor(BG, 1);
      R.outputEncoding = THREE.sRGBEncoding; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
      this.canvasWrap.appendChild(R.domElement);
      const S = (this.scene = new THREE.Scene()); S.fog = new THREE.Fog(BG, 4, 14);
      const C = (this.camera = new THREE.PerspectiveCamera(45, 1, 0.005, 60)); C.up.set(0, 0, 1);
      S.add(new THREE.HemisphereLight(0xfff4e6, 0x2a2622, 0.85));
      const key = (this.key = new THREE.DirectionalLight(0xffffff, 0.9)); key.castShadow = true;
      key.shadow.mapSize.set(1536, 1536); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.002;
      S.add(key); S.add(key.target);
      const fill = new THREE.DirectionalLight(0xc9d8ff, 0.3); fill.position.set(-2, 1.5, 1.2); S.add(fill);
      this.root = new THREE.Group(); S.add(this.root);
      this.marks = new THREE.Group(); S.add(this.marks);
      const ctl = (this.controls = new THREE.OrbitControls(C, R.domElement));
      ctl.enableDamping = true; ctl.dampingFactor = 0.12; ctl.screenSpacePanning = true; ctl.rotateSpeed = 0.8; ctl.zoomSpeed = 1.1;
      ctl.minDistance = 0.05; ctl.maxDistance = 20;
      ctl.addEventListener("change", () => { this.dirty = true; if (!this._silent && this.opts.onCamera) this.opts.onCamera(this); });
      this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(host);
      this.resize();
    }

    async load(url) {
      const d = await load(url);
      if (this.disposed) return d;
      this.d = d; this._build(); this.preset("task"); this.setTime(0, true);
      return d;
    }

    _mat(c) {
      this._mats = this._mats || new Map();
      const k = c.join(",");
      if (!this._mats.has(k)) {
        const col = new THREE.Color(c[0], c[1], c[2]).convertSRGBToLinear();
        this._mats.set(k, new THREE.MeshStandardMaterial({ color: col, roughness: 0.62, metalness: 0.08, transparent: c[3] < 0.999, opacity: c[3],
          depthWrite: c[3] >= 0.999, flatShading: false, side: THREE.FrontSide }));
      }
      return this._mats.get(k);
    }

    _build() {
      const d = this.d;
      this.bodies = d.bodies.map(() => { const o = new THREE.Group(); this.root.add(o); return o; });
      const meshGeo = d.meshes.map((m) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(m.v, 3)); g.setIndex(new THREE.BufferAttribute(m.i, 1));
        g.computeVertexNormals(); return g;
      });
      this.sets = d.geomsets.map((gs) => gs.geoms.map((e) => {
        const geo = e.t === T.MESH ? meshGeo[e.m] : primGeom(e.t, e.s);
        if (!geo) return null;
        const mat = this._mat(e.c);
        const mesh = new THREE.Mesh(geo, e.t === T.MESH ? this._flat(mat) : mat);
        mesh.position.set(e.p[0], e.p[1], e.p[2]); mesh.quaternion.set(e.q[1], e.q[2], e.q[3], e.q[0]);
        mesh.castShadow = e.c[3] > 0.5; mesh.receiveShadow = true; mesh.visible = false;
        this.bodies[e.b].add(mesh); return mesh;
      }).filter(Boolean));
      // floor at the render floor height, with a soft grid; sized from the motion bounds
      const lo = d.bounds.min, hi = d.bounds.max;
      const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2;
      const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], 0.4);
      this.center = new THREE.Vector3(cx, cy, (lo[2] + hi[2]) / 2); this.span = Math.max(span, hi[2] - lo[2], 0.4);
      const fz = d.floor_z != null ? d.floor_z : lo[2] - 0.002;
      const size = Math.max(4, span * 6);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color: 0x24211d, roughness: 0.95, metalness: 0 }));
      floor.position.set(cx, cy, fz - 0.0005); floor.receiveShadow = true; this.scene.add(floor);
      const grid = new THREE.GridHelper(size, Math.round(size / 0.1), 0x4a443d, 0x332f2a);
      grid.rotation.x = Math.PI / 2; grid.position.set(cx, cy, fz + 0.0005);
      grid.material.transparent = true; grid.material.opacity = 0.55; grid.material.depthWrite = false; this.scene.add(grid);
      const ax = new THREE.AxesHelper(0.08); ax.position.set(cx - span * 0.75, cy - span * 0.75, fz + 0.001); this.scene.add(ax);
      // key light / shadow camera framing the workspace
      const k = this.key, ext = Math.max(this.span, hi[2] - fz) * 0.9 + 0.2;
      k.position.set(cx + ext * 1.2, cy - ext * 0.8, hi[2] + ext * 2.2); k.target.position.set(cx, cy, fz);
      Object.assign(k.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.05, far: ext * 8 });
      k.shadow.camera.updateProjectionMatrix();
      this.scene.fog.near = this.span * 6; this.scene.fog.far = this.span * 25;
    }
    _flat(mat) {                               // decimated meshes read better faceted
      this._flats = this._flats || new Map();
      if (!this._flats.has(mat)) { const m = mat.clone(); m.flatShading = true; this._flats.set(mat, m); }
      return this._flats.get(mat);
    }

    get duration() { return this.d ? this.d.duration : 0; }

    setTime(t, force) {
      const d = this.d; if (!d) return;
      t = Math.max(0, Math.min(t, d.duration));
      if (!force && Math.abs(t - this.t) < 1e-4) return;
      this.t = t;
      const f = t / d.dt, i0 = Math.min(d.n - 1, Math.floor(f)), i1 = Math.min(d.n - 1, i0 + 1), a = f - i0;
      // geometry set (a new one only if world 0's geometry changed mid-rollout)
      let s = 0; for (let k = 0; k < d.geomsets.length; k++) if (d.geomsets[k].f0 <= i0) s = k;
      if (s !== this.set) { this.sets.forEach((ms, k) => ms.forEach((m) => { m.visible = k === s; })); this.set = s; }
      const P = d.posesF, nb = d.bodies.length, q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion();
      for (let b = 0; b < nb; b++) {
        const o0 = (i0 * nb + b) * 7, o1 = (i1 * nb + b) * 7, node = this.bodies[b];
        const dx = P[o1] - P[o0], dy = P[o1 + 1] - P[o0 + 1], dz = P[o1 + 2] - P[o0 + 2];
        const w = dx * dx + dy * dy + dz * dz > 0.04 ? 0 : a;        // a reset teleports: no smear
        node.position.set(P[o0] + dx * w, P[o0 + 1] + dy * w, P[o0 + 2] + dz * w);
        q0.set(P[o0 + 4], P[o0 + 5], P[o0 + 6], P[o0 + 3]); q1.set(P[o1 + 4], P[o1 + 5], P[o1 + 6], P[o1 + 3]);
        node.quaternion.copy(q0).slerp(q1, w);
      }
      this._marks(d.marks?.[Math.round(f)] || []);
      if (this.follow && d.trackF) {             // the task camera tracks a body: carry the orbit along with it
        const L = this.lookAt(t);
        if (this._look) { const dl = L.clone().sub(this._look); this.camera.position.add(dl); this.controls.target.add(dl); }
        this._look = L;
      } else this._look = null;
      this.dirty = true;
    }
    lookAt(t) {                                  // the tracked look-at point at time t (static camera: first frame's)
      const d = this.d, cam = d.camera;
      if (!d.trackF) return new THREE.Vector3(...(cam ? cam.lookat : this.center.toArray()));
      const f = Math.max(0, Math.min(t / d.dt, d.n - 1)), i0 = Math.floor(f), i1 = Math.min(d.n - 1, i0 + 1), a = f - i0, T = d.trackF;
      const p0 = new THREE.Vector3(T[3 * i0], T[3 * i0 + 1], T[3 * i0 + 2]), p1 = new THREE.Vector3(T[3 * i1], T[3 * i1 + 1], T[3 * i1 + 2]);
      return p0.distanceTo(p1) > 0.2 ? p0 : p0.lerp(p1, a);
    }

    _marks(list) {
      const U = unit(); let used = 0; const pool = this.markPool;
      const kind = (t) => t === T.SPHERE ? "sphere" : t === T.ELLIPSOID ? "sphere" : t === T.BOX ? "box" : (t === T.CYLINDER || t === T.CAPSULE) ? "cyl"
        : (t === T.ARROW || t === T.ARROW1 || t === T.ARROW2) ? "arrow" : t === T.LINE ? "line" : t === T.LINEBOX ? "linebox" : null;
      const m4 = new THREE.Matrix4();
      for (const g of list) {
        const k = kind(g[0]); if (!k) continue;
        const s = [g[1], g[2], g[3]], p = [g[4], g[5], g[6]], R = g.slice(7, 16), c = g.slice(16, 20);
        let sc;
        if (k === "sphere") sc = g[0] === T.SPHERE ? [s[0], s[0], s[0]] : s;
        else if (k === "cyl") sc = [s[0], s[0], g[0] === T.CAPSULE ? s[2] + s[0] : s[2]];
        else if (k === "arrow") sc = [s[0], s[1], s[2]];
        else if (k === "line") sc = [1, 1, s[2]];
        else sc = s;
        let o = pool[used];
        if (!o || o.userData.k !== k) {
          if (o) { this.marks.remove(o); }
          o = this._markObj(k, U); o.userData.k = k; pool[used] = o; this.marks.add(o);
        }
        used++;
        o.visible = true;
        m4.set(R[0] * sc[0], R[1] * sc[1], R[2] * sc[2], p[0], R[3] * sc[0], R[4] * sc[1], R[5] * sc[2], p[1], R[6] * sc[0], R[7] * sc[1], R[8] * sc[2], p[2], 0, 0, 0, 1);
        o.matrix.copy(m4);
        const col = o.userData.mat.color; col.setRGB(c[0], c[1], c[2]).convertSRGBToLinear();
        o.userData.mat.opacity = Math.max(0.15, c[3]); o.userData.mat.transparent = c[3] < 0.999;
      }
      for (let i = used; i < pool.length; i++) pool[i].visible = false;
    }
    _markObj(k, U) {
      let o, mat;
      if (k === "line" || k === "linebox") { mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true }); o = new THREE.LineSegments(k === "line" ? U.line : U.linebox, mat); }
      else if (k === "arrow") { mat = new THREE.MeshStandardMaterial({ roughness: 0.5, transparent: true }); o = new THREE.Group(); U.arrow.forEach((g) => o.add(new THREE.Mesh(g, mat))); }
      else { mat = new THREE.MeshStandardMaterial({ roughness: 0.5, transparent: true, depthWrite: false }); o = new THREE.Mesh(U[k], mat); }
      o.matrixAutoUpdate = false; o.userData.mat = mat; o.renderOrder = 2;
      return o;
    }

    /* ---------- camera ---------- */
    preset(name) {
      const d = this.d; if (!d) return;
      const cam = d.camera || { lookat: this.center.toArray(), distance: this.span * 1.6, azimuth: 330, elevation: -22, fovy: 45 };
      const look = this.lookAt(Math.max(0, this.t));
      let az = cam.azimuth, el = cam.elevation, dist = cam.distance;
      const span = this.span;
      if (name === "wide") { dist = Math.max(dist * 2.4, span * 2.2); el = Math.min(el, -25); look.copy(this.center); }
      else if (name === "top") { dist = Math.max(dist * 1.8, span * 1.9); el = -89.5; look.copy(this.center); }
      else if (name === "side") { dist = Math.max(dist * 1.8, span * 1.9); el = -4; az = 270; look.copy(this.center); }
      this._place(look, az, el, dist, cam.fovy || 45);
      this._look = this.follow && d.trackF ? this.lookAt(Math.max(0, this.t)) : null;
    }
    _place(look, az, el, dist, fovy) {
      const A = (az * Math.PI) / 180, E = (el * Math.PI) / 180;
      const fwd = new THREE.Vector3(Math.cos(E) * Math.cos(A), Math.cos(E) * Math.sin(A), Math.sin(E));
      this.camera.fov = fovy; this.camera.updateProjectionMatrix();
      this.camera.position.copy(look).addScaledVector(fwd, -dist);
      this.controls.target.copy(look); this.controls.update(); this.dirty = true;
      if (this.opts.onCamera) this.opts.onCamera(this);
    }
    copyCamera(o) {                            // linked A/B cameras
      if (this.camera.position.equals(o.camera.position) && this.controls.target.equals(o.controls.target)) return;
      this._silent = true;
      this.camera.position.copy(o.camera.position); this.controls.target.copy(o.controls.target); this.controls.update();
      this._silent = false; this.dirty = true;
    }

    resize() {
      const w = this.host.clientWidth, h = this.host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.dirty = true;
    }
    frame() {                                  // called every animation frame by the owner
      if (this.disposed) return;
      this.controls.update();
      if (!this.dirty || !this.host.clientWidth) return;
      this.dirty = false;
      this.renderer.render(this.scene, this.camera);
    }
    dispose() {
      this.disposed = true; this._ro.disconnect(); this.controls.dispose();
      this.scene.traverse((o) => { if (o.geometry && !Object.values(UNIT || {}).flat().includes(o.geometry)) o.geometry.dispose(); });
      (this._mats || new Map()).forEach((m) => m.dispose()); (this._flats || new Map()).forEach((m) => m.dispose());
      this.renderer.dispose(); this.renderer.forceContextLoss?.(); this.canvasWrap.remove();
    }
  }
  return { Viewer, load };
})();

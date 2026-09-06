/* =============================================================================
   policy.js — collect demonstrations in the studio and train a small
   VisionJointPlanner-style policy in the browser (TensorFlow.js).
   Sample = a window of the last 5 states (joints, zoom, focus) + a goal token
   (which shot, where the hero is) + a 24x16 grey thumbnail of the camera feed
   -> the next 5 joint/lens deltas (action chunking, as in the thesis's FCL head
   and in ACT). Inference uses ACT-style temporal ensembling over the chunks.
   Honest scale: a few thousand samples, a two-layer MLP, seconds of training.
   ============================================================================= */
export const HIST = 5, FUT = 5, IMG_W = 24, IMG_H = 16;

export class Recorder {
  constructor() { this.episodes = []; this.current = null; }
  start(meta) { this.current = { meta, frames: [] }; }
  push(frame) { if (this.current) this.current.frames.push(frame); }
  stop() { if (this.current && this.current.frames.length >= HIST + FUT + 2) this.episodes.push(this.current); const ep = this.current; this.current = null; return ep; }
  get recording() { return !!this.current; }
  get nFrames() { return this.episodes.reduce((s, e) => s + e.frames.length, 0); }
  toJSON() { return { version: 1, hist: HIST, fut: FUT, img: [IMG_W, IMG_H], episodes: this.episodes }; }
  fromJSON(j) { if (j && j.episodes) this.episodes = this.episodes.concat(j.episodes); }
  clear() { this.episodes = []; }
}

/** Goal encoding: one-hot of the shot id (K shots) + the hero position (3) + the far position (3). */
export function goalVector(shotIndex, K, near, far) { const g = new Array(K).fill(0); if (shotIndex >= 0) g[shotIndex] = 1; return g.concat([near[0], near[1], near[2], far[0], far[1], far[2]]); }
const stateVec = (f) => [...f.q.map(v => v / 3), f.f / 150, Math.log(f.S) / 4];   /* 8 numbers, roughly unit scale */

export function buildSamples(episodes, K) {
  const X = [], I = [], Y = [];
  for (const ep of episodes) {
    const fr = ep.frames; const g = goalVector(ep.meta.shotIndex, K, ep.meta.near, ep.meta.far);
    for (let t = HIST - 1; t + FUT < fr.length; t++) {
      const hist = []; for (let k = t - HIST + 1; k <= t; k++) hist.push(...stateVec(fr[k]));
      X.push(hist.concat(g)); I.push(fr[t].img);
      const y = []; for (let k = 1; k <= FUT; k++) { const a = fr[t + k], b = fr[t]; y.push(...a.q.map((v, i) => (v - b.q[i]) * 10), (a.f - b.f) / 15, (Math.log(a.S) - Math.log(b.S)) * 4); }
      Y.push(y);
    }
  }
  return { X, I, Y };
}

export class Policy {
  constructor(K) { this.K = K; this.model = null; this.losses = []; this.useImage = true; }
  build(nState) {
    const tf = window.tf; const sIn = tf.input({ shape: [nState] }); const iIn = tf.input({ shape: [IMG_H, IMG_W, 1] });
    let v = tf.layers.conv2d({ filters: 8, kernelSize: 3, strides: 2, activation: 'relu', padding: 'same' }).apply(iIn);
    v = tf.layers.conv2d({ filters: 16, kernelSize: 3, strides: 2, activation: 'relu', padding: 'same' }).apply(v);
    v = tf.layers.flatten().apply(v); v = tf.layers.dense({ units: 32, activation: 'relu' }).apply(v);
    let s = tf.layers.dense({ units: 64, activation: 'relu' }).apply(sIn);
    let h = tf.layers.concatenate().apply([s, v]); h = tf.layers.dense({ units: 256, activation: 'relu' }).apply(h); h = tf.layers.layerNormalization().apply(h); h = tf.layers.dense({ units: 256, activation: 'relu' }).apply(h);
    const out = tf.layers.dense({ units: FUT * 8 }).apply(h);
    this.model = tf.model({ inputs: [sIn, iIn], outputs: out }); this.model.compile({ optimizer: tf.train.adam(1e-3), loss: 'meanSquaredError' });
    return this.model;
  }
  async train(samples, epochs = 60, onEpoch = null) {
    const tf = window.tf; if (!samples.X.length) throw new Error('no samples');
    if (!this.model || this.model.inputs[0].shape[1] !== samples.X[0].length) this.build(samples.X[0].length);
    const flat = new Float32Array(samples.I.length * IMG_H * IMG_W);
    samples.I.forEach((a, i) => { for (let k = 0; k < a.length; k++) flat[i * IMG_H * IMG_W + k] = a[k] / 255; });
    const xs = tf.tensor2d(samples.X), im = tf.tensor4d(flat, [samples.I.length, IMG_H, IMG_W, 1]), ys = tf.tensor2d(samples.Y);
    this.losses = [];
    await this.model.fit([xs, im], ys, { epochs, batchSize: 64, shuffle: true, validationSplit: 0.1, callbacks: { onEpochEnd: async (ep, logs) => { this.losses.push([logs.loss, logs.val_loss]); if (onEpoch) onEpoch(ep, logs); await tf.nextFrame(); } } });
    xs.dispose(); im.dispose(); ys.dispose();
  }
  /** Predict the next FUT deltas for a history of frames (length >= HIST) and a goal vector. */
  predict(histFrames, goal, img) {
    const tf = window.tf; const hist = []; for (const f of histFrames.slice(-HIST)) hist.push(...stateVec(f));
    const flat = Float32Array.from(img, (v) => v / 255);
    const out = tf.tidy(() => this.model.predict([tf.tensor2d([hist.concat(goal)]), tf.tensor4d(flat, [1, IMG_H, IMG_W, 1])]).dataSync());
    const chunks = []; for (let k = 0; k < FUT; k++) { const o = out.slice(k * 8, k * 8 + 8); chunks.push({ dq: o.slice(0, 6).map(v => v / 10), df: o[6] * 15, dlogS: o[7] / 4 }); }
    return chunks;
  }
  paramCount() { return this.model ? this.model.countParams() : 0; }
}

/** ACT-style temporal ensembling: keep the chunks predicted at previous steps and average the actions they proposed for now. */
export class Ensembler {
  constructor(m = 0.35) { this.hist = []; this.m = m; }
  reset() { this.hist = []; }
  push(chunks) { this.hist.push(chunks); if (this.hist.length > FUT) this.hist.shift(); }
  /** The action for the next step: chunk predicted j steps ago contributes its (j+1)-th action with weight exp(-m j). */
  action() {
    let dq = [0, 0, 0, 0, 0, 0], df = 0, dS = 0, wsum = 0;
    for (let j = 0; j < this.hist.length; j++) { const c = this.hist[this.hist.length - 1 - j]; if (j >= c.length) continue; const w = Math.exp(-this.m * j); const a = c[j]; dq = dq.map((v, i) => v + w * a.dq[i]); df += w * a.df; dS += w * a.dlogS; wsum += w; }
    if (!wsum) return null; return { dq: dq.map(v => v / wsum), df: df / wsum, dlogS: dS / wsum };
  }
}
/** Grey thumbnail (IMG_W x IMG_H, Uint8) from a readFeed() buffer. */
export function thumbnail(feed) {
  const { data, w, h } = feed; const out = new Uint8Array(IMG_W * IMG_H);
  for (let y = 0; y < IMG_H; y++) for (let x = 0; x < IMG_W; x++) { const sx = Math.floor((x + 0.5) / IMG_W * w), sy = Math.floor((1 - (y + 0.5) / IMG_H) * h); const i = (sy * w + sx) * 4; out[y * IMG_W + x] = Math.round(0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]); }
  return out;
}

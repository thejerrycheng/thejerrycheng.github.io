/* =============================================================================
   dof.js — a thin-lens depth-of-field post-process for the camera feed.
   The feed is rendered into a colour + depth target; this pass turns each
   pixel's depth into its circle of confusion for the current focal length,
   f-number and focus distance (full-frame sensor), and gathers a Poisson-disk
   blur of that radius. Foreground bleeding is limited by weighting each tap by
   its own CoC. Exact enough to show focus pulls, shallow f/2.8 product shots
   and the deep focus of a 16 mm wide angle.
   ============================================================================= */
import * as THREE from 'three';

const POISSON = [[0.0, 0.0], [0.53, 0.25], [-0.36, 0.5], [-0.55, -0.22], [0.2, -0.58], [0.9, -0.12], [-0.85, 0.35], [0.35, 0.82], [-0.2, -0.9], [0.68, 0.6], [-0.7, -0.66], [0.05, 0.42], [-0.44, 0.05], [0.4, -0.3], [0.95, 0.3], [-0.95, -0.05], [0.15, 0.95], [-0.55, 0.78], [0.72, -0.62], [-0.15, -0.5], [0.3, 0.15], [-0.28, -0.3], [0.62, -0.85], [-0.8, 0.62]];

export class DofPass {
  constructor(width, height) {
    this.rt = new THREE.WebGLRenderTarget(width, height, { depthTexture: new THREE.DepthTexture(width, height, THREE.UnsignedIntType), depthBuffer: true, samples: 0 });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, near: { value: 0.01 }, far: { value: 50 }, focusM: { value: 0.5 }, fMm: { value: 35 }, N: { value: 4 }, sensorH: { value: 24 }, texel: { value: new THREE.Vector2(1 / width, 1 / height) }, maxRadius: { value: 22 }, enabled: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        precision highp float; varying vec2 vUv;
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform float near, far, focusM, fMm, N, sensorH, maxRadius, enabled; uniform vec2 texel;
        const int NT = ${POISSON.length};
        vec2 taps[NT];
        float viewDist(vec2 uv){ float d = texture2D(tDepth, uv).x; float z = 2.0*d - 1.0; float vz = (2.0*near*far) / (far + near - z*(far - near)); return vz; }
        float cocPx(float dM){ float d = max(dM, 0.02) * 1000.0; float s = max(focusM, 0.03) * 1000.0; float A = fMm / N; float c = A * abs(d - s) / d * fMm / max(s - fMm, 1.0); return min(maxRadius, c / sensorH * (1.0 / texel.y)); }
        void main(){
          ${POISSON.map((p, i) => `taps[${i}] = vec2(${p[0].toFixed(3)}, ${p[1].toFixed(3)});`).join('\n          ')}
          float c0 = cocPx(viewDist(vUv)) * enabled;
          if (c0 < 0.75) { gl_FragColor = texture2D(tColor, vUv); return; }
          vec3 acc = vec3(0.0); float wsum = 0.0;
          for (int i = 0; i < NT; i++) {
            vec2 off = taps[i] * c0 * texel; vec2 uv = vUv + off;
            float ci = cocPx(viewDist(uv)); float dist = length(taps[i]) * c0;
            float w = clamp((ci + 0.5) / (dist + 0.5), 0.0, 1.0);        /* a tap only contributes if its own blur reaches this pixel */
            acc += texture2D(tColor, uv).rgb * w; wsum += w;
          }
          gl_FragColor = vec4(acc / max(wsum, 1e-4), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material); this.quadScene = new THREE.Scene(); this.quadScene.add(this.quad);
  }
  setSize(w, h) { this.rt.setSize(w, h); this.material.uniforms.texel.value.set(1 / w, 1 / h); }
  /** Render `scene` through `camera` into the target, then composite with DOF into the current viewport. */
  render(renderer, scene, camera, lens, enabled = true) {
    const u = this.material.uniforms; u.near.value = camera.near; u.far.value = camera.far; u.focusM.value = lens.S; u.fMm.value = lens.f; u.N.value = lens.N; u.enabled.value = enabled ? 1 : 0;
    const prevRT = renderer.getRenderTarget(); const st = renderer.getScissorTest(); renderer.setScissorTest(false); renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(prevRT); renderer.setScissorTest(st);
    renderer.render(this.quadScene, this.quadCam);
  }
}

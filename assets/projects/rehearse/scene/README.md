# Scene viewer

```js
import {mountScene} from './scene.js';
const viewer = mountScene(element, {dataUrl: '../kitchen/sim/scene.json'});
await viewer.ready;
// When removing the viewer:
viewer.destroy();
```

Load `scene.css` and the site's Three.js import map. The viewer uses the site's
existing Three, Spark, GLTFLoader, TransformControls and MuJoCo 3.15 modules.
Multiple instances have independent controls and DOM state.

The JSON contract uses metres, kilograms, seconds, +Z up and **wxyz** quaternions.
All file references resolve relative to `dataUrl`.

- `physics`: self-contained browser MJCF, with a `rest` keyframe.
- `bodies`: unique MuJoCo names/IDs, parent, local and rest-world pose, optional
  local bounds, Gaussian count, polished/scan GLB paths and owning asset.
- `objects`: display label, category, body and joint names, free-joint names,
  contact/material assumptions, source, limitations and optional `stored_in`.
- `joints`: scalar joint name, asset/body, label, type, local axis/pivot, range,
  rest, qpos/dof addresses, and optional inertia-scaled drag `control` gains.
- `polished_pack`: one GLB with body groups named exactly as MuJoCo bodies.
  Its body geometry and per-body SPZ/GLBs use each body's local coordinate frame.
- `background`, `counts`: static SPZ and per-body Gaussian counts.
- `views`, `intrinsics`, `trajectory`: calibrated CV camera-to-world matrices,
  camera intrinsics and world-space capture path. These are capture viewpoints;
  the simulation clock is independent of the source video.
- `flexes`: vertex offsets/counts, surface triangles, colour and asset. Positions
  come from `flexvert_xpos` every rendered simulation update.
- `rules`: data-driven latches, detents and releases consumed by `runtime.js`.
- `stored`: free bodies held at a rest/container pose with contacts disabled.
  Opening the listed container joints beyond the threshold, or dragging the item,
  releases it until reset. This is a kinematic approximation, not a topology weld.
- `timing.timestep_s`, `metric_scale`, `browser_compatibility`: simulation step,
  scale provenance and documented engine adaptations.

`ready` waits for secondary scan meshes too; `element.dataset.ready` marks initial
interaction readiness. `metrics` exposes observed load, simulation-step and frame
times. It does not certify real-time performance. `reset`, `view`, `setLook`,
`select`, `focus`, `tryPose`, `tryJoint`, `press`, and `setPhysics` are also exposed
for testing. A slider edits a collision-checked pose when paused; when running it
sets a force-driven target. Force arrows show actual applied generalized forces
or world-space node forces, not measured human force.

Scan coverage fill is a camera-direction heuristic. Missing observations use a
mesh. Native dynamics, browser reductions and browser acceptance
results must be assessed separately.

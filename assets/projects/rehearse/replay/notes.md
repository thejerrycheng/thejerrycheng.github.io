# Kitchen reconstruction replay

The replay geometry and initial framing have been corrected after reviewing the supplied `claude_initial_view.png`. Numerical validation and code review passed. **The updated browser screenshots and `data/kitchen/replay.mp4` still require the outside-sandbox `run_capture.sh`.** No browser/server launch was attempted in this follow-up, as requested; the existing `shots/browser-test.json` is the earlier blocked run, not a result for these changes.

## Viewer

Open `assets/projects/rehearse/replay/rehearse-replay.html` from a server at the website root. The demo is inside this folder to respect the requested write boundary; no root page or navigation was changed.

- Vendored three.js and Spark render a regenerated 109,962-Gaussian SPZ in the current metric world frame. The existing kitchen web splat used an older world alignment, so this replay owns a new aligned copy rather than changing the existing kitchen scene.
- An 8 mm-radius continuous tube encodes source time from blue to amber; both ring positions and colors use the same time parameter. The 193 displayed keyframe frustums are at least 1 s apart, with 1 px lines at 35% opacity. Their image planes are 0.12 m wide and 0.12672 m from the camera, preserving calibrated intrinsics. The current frustum has a 0.30 m-wide photo plane at 0.31680 m depth.
- Initial/reset orbit looks from the open (+X,+Y) side at 35° elevation toward the time-sampled path centroid. It fits the union of the entire dense path (with helper padding) and loaded splat bounds, including Gaussian scale extents. Horizontal and vertical FOV, depth, viewport resizing and film orbit phase all enter the fit.
- Timeline scrubbing, play/pause, 0.5–8× playback, orbit/reset, path toggle, and calibrated six-degree-of-freedom follow mode. The follow projection preserves the full portrait sensor with the original intrinsics; the photo blend aligns with that sensor region.
- HUD shows source time, nearest frame ID, world XYZ, speed, and yaw/pitch/roll. Angles use intrinsic ZYX decomposition of the three.js camera-to-world rotation, in degrees; XYZ uses metres, z up.
- Picture-in-picture shows the nearest registered photo, its timestamp, and its offset from the smooth replay time. Photos update only at captured observations; no uncaptured source images are synthesized.
- Annotation rectangles are clipped against the current camera frustum and listed in the panel. This is a projection test, not occlusion testing or asset recognition. Articulated rectangles use the annotation's reference configuration.
- Responsive layout, labelled controls, keyboard focus, space for play/pause and arrow keys for one-second scrubbing when the replay panel is focused. `dispose()` releases renderer resources and observers.

Embedding (include `replay.css` and the site's `three` import map):

```js
import {mountReplay} from '/assets/projects/rehearse/replay/replay.js';
const replay = await mountReplay(document.querySelector('#replay'), {
  dataUrl: '/assets/projects/rehearse/replay/data/kitchen/'
});
await replay.seek(42); // absolute source-video seconds
replay.setMode('follow');
// replay.dispose();
```

`dataUrl` also accepts the full `trajectory.json` URL. Each mount owns its DOM and rendering state.

## Export and accuracy

`real2sim/kitchen/k12_replay.py` exports exact keyframes, a 30 Hz dense trajectory, reusable curve coefficients, 320 px-wide WebP thumbnails and 640 px-wide comparison photos, annotation rectangles, and statistics.

Camera names encode the source frame at 30 fps. Replay spans **0.266667–232.4 s**, lasting **232.133333 s**, with **673 poses** and **6,965 dense samples**. The kept-frame file lists 699 frames out of 6,988 source frames. The earlier SfM report lists 685 registered cameras; the current camera archive contains 673. Statistics preserve both counts and explain the discrepancy.

Positions and rotations are transformed by `T_world_from_colmap`; the similarity scale is removed from the rotation block only. Keyframe matrices are not rounded or modified. Scale is inferred from DA3, **0.1632594913 metres per COLMAP unit**, not independently measured ground truth.

Position: locally weighted quadratic regression with five Huber reweighting iterations estimates robust velocity and acceleration at each keyframe. A quintic Hermite/Bernstein spline uses these shared derivatives while interpolating every original position exactly, making position, velocity and acceleration continuous. Robust smoothing applies to the derivatives and between-observation motion; it does not remove or relocate SfM outliers. Consequently, a discontinuity already present in the measured poses can still require rapid motion.

Orientation: local robust regression in each camera's rotation-vector tangent space estimates angular velocity. Time-aware quaternion SQUAD uses the original endpoint rotations and derived control quaternions, evaluated through nested shortest-arc SLERP. The browser evaluates the exported curves directly, preserving exact keyframes at arbitrary scrub times rather than linearly interpolating dense samples.

Measured at all original keyframe timestamps:

| Measurement | Result |
| --- | ---: |
| Position RMS deviation | **0 m** |
| Orientation RMS deviation | **2.99 × 10⁻¹⁵ degrees** |
| Maximum orientation deviation | 1.56 × 10⁻¹⁴ degrees |
| Original c2w matrices | Bitwise equal to transformed source |
| Maximum position-velocity discontinuity | 1.76 × 10⁻¹⁴ m/s |
| Maximum position-acceleration discontinuity | 4.20 × 10⁻¹² m/s² |
| Dense path length | 55.1093 m |
| Raw keyframe polyline length | 53.4671 m |
| Mean sampled speed | 0.2377 m/s |
| Maximum sampled speed | 5.0751 m/s |

The error limits of 2 cm and 1 degree are satisfied at every SfM observation. These are interpolation fidelity measurements, not ground-truth reconstruction accuracy; intermediate poses have no independent reference. All original poses remain available separately in `keyframes`.

## Follow-up findings and screenshot checklist

The excessive lines were caused by shared `Vector3` references in frustum edge endpoints. Applying each keyframe transform in-place repeatedly transformed shared corners, including repeated translations. Every endpoint now owns its vector and is transformed exactly once. `test_geometry.mjs` checks this regression at all 193 displayed poses, both calibrated plane widths and nine orbit fits across desktop/mobile aspect ratios and film phases.

World alignment was checked against the actual SPZ payload: all **109,962** Gaussian centers match `splat/full.ply` transformed by the same current `T_world_from_colmap` used for the camera trajectory. Maximum error is **0.000210 m**, consistent with SPZ fixed-point quantization. The vendored Spark decoder preserves XYZ; the viewer applies no second scale/axis transformation. The SPZ center extent is **[-2.037, -2.488, -0.683] to [2.597, 2.287, 3.536] m**, including reconstruction outliers. Framing uses loaded bounds rather than the tighter percentile bounds in `scene.json`.

Floor is z=0 in this inferred world frame. **617/673 camera centers** are within 1.1–1.8 m; the 5th/50th/95th percentiles are **1.177/1.480/1.822 m**, and the full source range is **0.685–2.072 m**. These source poses are preserved. A blanket claim that all cameras are 1.1–1.8 m above the floor would be incorrect. Camera placement in the empty floor area in front of counters still needs visual confirmation in the corrected screenshots; shared metric coordinates are verified numerically, not independent physical ground truth.

Code review against the supplied screenshot checklist:

- **Frustums / kitchen visibility:** independent vertices prevent stretched lines; 1 s spacing reduces clutter; the current frame is textured with matching UV corner order. Path colors follow time rather than arc-length remapping.
- **Initial view:** waits for splat initialization before fitting its bounds; orbit reset, resize and film motion use the same 35° fit. Actual appearance remains pending external rendering.
- **Console errors:** ES-module syntax passed, module/data paths and vendored APIs were reviewed, and all observation files passed validation. An error-free browser run is not claimed. The external runner rejects console errors, page errors and HTTP failures both before and after capture.
- **Scrub:** timeline pauses playback, clamps time, samples position/quaternion and updates HUD, projected parts, photo and texture. A request counter prevents an older image load from replacing a newer scrubbed frame; `photoLoaded` now checks the requested frame index. `seek()` waits for that photo.
- **Follow:** uses the same metric pose with `q_cv * (1,0,0,0)` to convert CV camera axes into three.js axes; hides the path/current-frustum helpers and preserves calibrated letterboxed projection. Numeric axis checks passed. The runner verifies position/quaternion and blend, then switches back to orbit/reset.
- **Capture:** seeks deterministic source times, waits for photo decode and Spark sorting, records orbit/follow/blend/mobile and film screenshots, verifies MP4 metadata with ffprobe, and reports actual capture wall time. Browser checks and video remain pending the external run.

## Checks completed

- `validate_export.py`: source matrices, timestamps, 30 Hz spacing, exact C2 continuity, all 673 thumbnails and 673 comparison photos, and regenerated-splat camera alignment passed. The follow-up also decoded and checked every SPZ center against the transformed source PLY. Results: `shots/export-test.json`.
- `test_trajectory.mjs`, run with modern Node: browser curve evaluator matched all 6,965 Python samples within 2.24 × 10⁻¹⁶ m and 0.000058 degrees; maximum speed difference 8.89 × 10⁻¹⁶ m/s. Exact keyframe position, endpoint clamping and OpenCV-to-three.js camera-axis checks passed. Results: `shots/numerical-test.json`.
- `test_geometry.mjs`: 193 bounded frustums, independent endpoints, calibrated plane sizes, and nine 35° bounding-box fits passed. Results: `shots/geometry-test.json`.
- JavaScript syntax checks passed with the Playwright-bundled Node. Python source compilation passed.
- Headless interaction and appearance checks are **not verified**, because the browser could not start under the current sandbox. There are no rendered screenshots in `shots/` yet.

## Reproduce

Use the simulation Python for export and the Playwright Python environment for rendering. Run the exporter from any directory, supplying the scene and output folders:

```sh
nice -n 19 env OPENBLAS_NUM_THREADS=4 OMP_NUM_THREADS=4 "$SIM_PYTHON" \
  "$REAL2SIM/kitchen/k12_replay.py" --root "$SCENE_ROOT" --out "$REPLAY/data/kitchen"
```

The aligned SPZ was regenerated using the existing `real2sim.kitchen.k12_web` module, with `--ply splat/full.ply` and the same output directory. `splat_art/full.ply` was absent. Keep that export aligned when replacing the source world transform.

The supplied executable `run_capture.sh` in the scene’s `web_replay` workspace starts the site-root server, runs this command using the requested Playwright/Chromium/ffmpeg installations, and stops its server on success or failure. It prints the final output path and probed duration. Run that script outside the sandbox. The equivalent direct command is:

```sh
"$PW_PYTHON" render_replay.py --chrome "$CHROMIUM" --ffmpeg "$FFMPEG" --video
```

The runner starts `python -m http.server 8793` at the site root, tests scrub/follow/blend/play/speed/restart/mobile/disposal, rejects browser and HTTP errors, and writes screenshots. Use `--external-server` if the site is already served on port 8793.

The film covers the complete capture at an explicitly labelled **4×** playback rate: approximately 58.1 s, **1280×720, 30 fps, H.264**, with orbit motion, camera path/frustum/photo, PiP and HUD. The runner pipes rendered PNGs to ffmpeg, uses four encoder threads, caps inherited total CPU affinity at four CPUs, runs at nice 19, caps bitrate, verifies H.264 / 1280×720 / 30 fps, frame count and duration with ffprobe, and verifies the result is ≤60 MB before replacing `replay.mp4`. `--rate 1` requests a real-time film and adjusts the bitrate budget accordingly. This describes the prepared capture pipeline; **the MP4 has not been rendered**.

This is an offline reconstruction replay, not online estimation. The SfM report records 328.17 s matching and 166.46 s mapping; the effectively zero extraction timing appears to be a cached stage and is retained as reported, not advertised as reconstruction speed. No commits or publication were performed.

# Rehearse video to simulation harness

This harness records and reruns the reconstruction experiments for the egocentric room capture. It separates camera calibration, per-frame object tracking, visual reconstruction, object completion, collision geometry, and validation. The current scenes remain research prototypes. A successful export or attractive source-view render does not establish accurate contact geometry or successful robot transfer.

## Inputs and conventions

The example configuration is `harness/configs/scene2.json`. Paths are relative to the project root. The example video is the exact 960 by 720, 30 fps clip served by the website. It contains 471 decoded frames. Tracking uses their actual presentation timestamps. Reconstruction uses 31 sampled views at approximately 2 Hz; these are different sampling requirements.

Camera geometry uses a shared world frame in meters with Z upward. COLMAP starts at arbitrary scale. The example assumes a 17 cm cup to establish metric scale; replace that with a measured dimension before training. OpenCV cameras look along positive Z with Y downward; Three.js cameras look along negative Z with Y upward. `cameras.json` includes both conventions. Never apply a coordinate conversion to mesh vertices without also converting cameras, poses and joint axes.

## Environments

- `.venv`: Python 3.11, PyTorch, pycolmap, OpenCV, trimesh, MuJoCo and Playwright. Learned depth and SAM 2 currently run on CPU.
- `third_party/numpy126`: isolated NumPy 1.26 used by the Open3D TSDF and mesh-decimation subprocesses. Importing those binary packages with the main environment's NumPy 2 caused crashes. Keep these stages in separate processes.
- `.venv-mlx`: Python 3.13 and `mlx-spatial` for an experimental Apple-silicon SAM 3D path. The current execution session cannot access a Metal device for model inference. Installation is not a completed model run.
- Blender 2.93 provides independent texture/geometry renders. The scripts import OBJ with explicit axis conventions to preserve the world frame.

Model sources, sizes, checksums and installed versions are recorded in `model_inventory.json`. Model weights stay local and are not included in the public harness download. Read the upstream model licenses before reuse.

## Reconstruction stages

1. **Decode and sample.** Preserve the original capture. Make the website clip without audio/location metadata. Decode every frame and record its PTS for tracking. Sample reconstruction keyframes separately. Frame counts and strictly increasing timestamps must match the decoded video.
2. **Recover cameras.** `scenes/test_scene_2/scripts/run_colmap.py` extracts SIFT features, exhaustively matches the 31 reference images and performs incremental SfM. The example registered all 31 views with a mean reprojection residual of 0.79 pixels at 960 by 720. This measures consistency with the fitted camera model, not independent 3D accuracy.
3. **Establish the world frame.** `calibrate_world.py` fits a floor plane from a manually selected carpet region. `metric_scene.py` triangulates the correspondences in `calibration/annotations.json`, applies the scale assumption and exports camera and landmark transforms. The floor polygon, landmark labels and scale are capture-specific inputs.
4. **Compare depth.** `predict_depth.py` runs Depth Anything V2 Small. `run_da3.py --model small` and `run_da3.py --model large` run camera-conditioned Depth Anything 3. `evaluate_depth.py` fits depth scale/shift using 80% of sparse tracks and evaluates the remaining 20%. These tracks come from the shared reconstruction; they are not ground-truth depth. The models use different published sizes and resolutions.
5. **Separate and track objects.** `segment_objects.py` uses box-prompted SAM ViT-B on selected reference views. The full-rate tracker uses those masks as temporal anchors and processes every decoded frame with SAM 2. Table masks exclude the cup and laptop. An object outside a prompted view does not need a prompt in that view. Every processed frame still receives all tracked object IDs, including empty masks for occlusion when predicted.
6. **Fuse geometry.** `fuse_geometry.py --variant da3_large` aligns dense depth to SfM. `fuse_tsdf.py` integrates depth into a TSDF surface. `prepare_mesh.py` creates the original semantic mesh. `clean_instances.py` replaces sparse ownership with evidence across 31 views, removes ambiguous fixed-room fragments inside movable-object envelopes and filters/smooths disconnected surface noise. Its versioned baseline is under `assets/variants/`. This cleanup does not reconstruct unseen object backs.
7. **Build object assets.** `solid_assets.py` fits table, cup and laptop surfaces. The coffee body and lid share a rigid root. The laptop lid has an explicit pivot and axis. Its fitted lower edge is regularized to the keyboard plane with thickness clearance because the original triangulated edge intersected the base. Chairs and the backpack require complete object reconstruction or explicit modeled completion before they can be considered accurate manipulation assets.
8. **Apply appearance.** `texture_mesh.py` assigns source-image UVs, independently owned object nodes and inferred clean plates. Generated floor/table appearance is labeled as inferred. Captured illumination is baked into these textures; this is not calibrated relighting. `render_blender.py` checks exported surfaces from recovered camera poses.
9. **Export physics.** `build_mujoco.py` exports free bodies, a laptop hinge, collision proxies and cameras. It explicitly enables lid-to-base contact, since parent-child collision filtering would otherwise omit it. Joint limits and contact settings are tested separately from browser transforms. Mass, friction, compliance and the backpack's rigid approximation are documented assumptions.
10. **Validate and publish.** Run source-view image comparisons, package loading/stepping, hinge stress tests, object-ownership checks and browser interactions. Publish assets only after inspecting the corresponding visual and numeric results. Keep failed experiments and their reports separate from the selected artifact.

## Commands

Run these from the project root:

```sh
.venv/bin/python harness/run.py plan --config harness/configs/scene2.json
.venv/bin/python harness/run.py run --config harness/configs/scene2.json --stage tracking
.venv/bin/python harness/run.py run --config harness/configs/scene2.json --stage tracking-export
.venv/bin/python harness/run.py run --config harness/configs/scene2.json --stage cleanup
.venv/bin/python harness/run.py run --config harness/configs/scene2.json --stage texture
.venv/bin/python harness/run.py run --config harness/configs/scene2.json --stage physics
.venv/bin/python harness/run.py run --config harness/configs/scene2.json --stage contacts
.venv/bin/python scripts/serve_site.py
.venv/bin/python scripts/check_site.py --interactions
```

Each harness run saves its command, configuration hash, timestamps, exit status and log under `harness/runs/`. A failed stage stays failed. The runner does not substitute a different model silently or claim skipped stages succeeded.

## Full-rate tracking and browser synchronization

`track_video.py` extracts all decoded frames with `ffmpeg -fps_mode passthrough` and gets PTS from ffprobe. The example uses SAM 2.1 Hiera Tiny at a 512-pixel model input to make CPU processing practical; masks are exported at the displayed video's 960 by 720 resolution. This resolution differs from the earlier 1024-pixel, 31-frame tracking experiment and must be recorded when comparing mask quality.

Outputs are in `calibration/sam2_fullrate/`: decoded frames, timestamps, masks, a progress file, the completed run report and validation. `export_tracking.py` refuses to publish incomplete coverage. It produces one contour record per decoded frame. The website uses `requestVideoFrameCallback` and the presented frame's `mediaTime`; it no longer rounds playback to a nearby 2 Hz reconstruction keyframe. This fixes temporal sampling delay. It does not guarantee perfect segmentation at boundaries or occlusions.

## Interaction and collision tests

The website supports selecting and dragging objects directly. Shift-drag constrains motion vertically; dragging the background orbits the camera. The object list selects bodies and the laptop hinge. A highlight toggle shows movable bounds and the hinge handle. R restores the selected pose.

The hinge controller sweeps small angular steps and bisects the first collision, testing the lid against convex base/table volumes and the floor. It checks both normal closure and an obstructing table. Browser object dragging is a pose editor, not a dynamics engine. The downloadable MuJoCo scene performs actual contact dynamics. `validate_contacts.py` independently tests forced closure and reports maximum numerical penetration.

## Reuse on a new capture

Create a new directory under `scenes/`, copy the configuration and set its video/object identities. Collect overlapping views with sharp frames and record a measured dimension. Supply new segmentation prompts and landmark correspondences, then rerun camera, depth and tracking stages. Do not reuse the example's floor polygon, fitted furniture bounds, collision dimensions or physical properties in another room.

The example asset-fitting scripts contain capture-specific geometry. The runner deliberately rejects a different scene directory for those stages until an appropriate script set and annotations have been supplied. The full-frame tracker accepts a different configuration immediately. This boundary prevents an apparently successful run from silently placing the old furniture into a new capture.

## Training readiness

Before policy training, require clean object ownership under movement, complete collision meshes, finite inertias, stable contacts, correctly constrained joints, held-out-view rendering checks and robot-to-scene calibration. Measure dimensions, mass and friction or expose their uncertainty through domain randomization. Validate contact-rich skills on the real objects. No reconstruction experiment here establishes successful policy fine-tuning or sim-to-real transfer.

## Candidate generation and audits

`triposr_cpu.py --object chair_left` and `--object backpack` run the CPU baseline. `fit_generated.py` performs multi-start pose/scale fitting and records silhouette agreement. `poisson_completion.py` tests a traditional smooth completion baseline in the isolated NumPy environment. Their outputs remain under `assets/variants/`; neither is automatically selected. `audit_assets.py` checks exported topology after welding UV seams. See `research.md` for the measured outcomes and rejection reasons.

The public archive contains stage scripts, example calibration and prompt masks, model inventory, documented assumptions, validation reports and dependency provenance. Large captures and model weights are separate inputs. Download the public case-study video into the path in `configs/scene2.json`; preserve the original high-resolution source locally for higher-quality reconstruction. The archive is a reusable experiment harness, not a self-contained pretrained reconstruction appliance.

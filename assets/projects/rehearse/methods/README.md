# Rehearse video to simulation harness

## SimFoundry rebuild — prepared, GPU execution pending

The requested replacement now follows [NVIDIA SimFoundry](https://research.nvidia.com/labs/gear/simfoundry/) and its [released implementation](https://github.com/NVlabs/SimFoundry), pinned to `9e34ebefcd020583fbb755a8b57268dce78eca26`. The live reconstructed meshes and SHARP predictions below are **earlier baselines**, not results from this rebuild. No new SimFoundry Gaussian, object mesh or MuJoCo scene has been generated yet.

`harness/simfoundry/scene2.json` configures the room capture. `pipeline.py` provides separate `prepare`, `foreground`, `background` and `preflight` commands; it prints a command plan unless `--execute` is supplied. The background phase invokes upstream stages directly with explicit output paths instead of its hard-coded `Data/` shell wrapper. All reconstruction products stay under `scenes/test_scene_2/simfoundry/room`. Dependencies remain in `third_party/SimFoundry`.

The implementation uses generated complete textured object meshes as separately simulated bodies and a **trained multi-view Gaussian background**. Following the automatic-background recipe: remove foreground with tracked masks and two-pass VOID; estimate original-camera poses and cleaned-frame depths with DA3; align the cleaned depth to the original camera world; seed at most 200,000 points; train `splatfacto-big` for 80,000 iterations with SO3xR3 camera optimization and confidence-masked L1 depth loss (weight 0.5). Background Gaussians supply appearance, not collision geometry. Moving the cup must reveal an inpainted background rather than a second baked-in cup.

The local preparation completed in **100.37 seconds** (upstream stage timer). The original has 471 frames over 15.7 seconds. The audited 400-frame selection includes both endpoints and covers the entire capture. Frames decode directly from the original, then resize to aspect-preserving 512 × 384. The 12 fps processing video lasts 33.33 seconds: this is a model input clock, **not** the capture clock or inference throughput. `capture_manifest.json` maps every processing row to the original frame/PTS and records hashes. All nine capture checks passed, including direct-source correspondence and byte-exact resizing from the original decoded PNGs. Seventy-one unsampled source frames are reserved for RGB view auditing. They are from the same capture, not independent measured geometry.

The initial 512 × 384 size preserves the upstream 384-pixel image height while retaining this capture's 4:3 aspect ratio. It is a memory-conscious first run, not a demonstrated optimum. Evaluate higher-resolution inpainting and Gaussian training after recording GPU memory/timing and reference-view error. Keep high-resolution originals locally for object crops and final appearance comparison.

### Reproduce on a Linux CUDA machine

Install the pinned upstream checkout and its documented environments/checkpoints, including the optional articulation environments and the supplied Nerfstudio depth-loss patch. The full upstream installation is approximately 250 GB. Its 24 GB GPU recipe requires low-memory object generation; the actual room run has not been profiled. Hugging Face gated model access (including SAM3 and VOID) and authenticated Gemini/Vertex services are also required. Authenticate on the worker; do not put tokens in configs or logs.

```sh
git clone https://github.com/NVlabs/SimFoundry third_party/SimFoundry
git -C third_party/SimFoundry checkout 9e34ebefcd020583fbb755a8b57268dce78eca26
git -C third_party/SimFoundry apply ../../harness/simfoundry/patches/capture-and-paths.patch
# Follow upstream docs/INSTALL.md and the auto-background README for GPU setup.
python harness/simfoundry/pipeline.py preflight
python harness/simfoundry/pipeline.py prepare --video capture.mov --execute
python harness/simfoundry/audit_capture.py --video capture.mov --scene scenes/test_scene_2/simfoundry/room
python harness/simfoundry/pipeline.py foreground --video capture.mov --execute
python harness/simfoundry/pipeline.py background --video capture.mov --execute
python harness/simfoundry/export_cameras.py --scene scenes/test_scene_2/simfoundry/room --out scenes/test_scene_2/simfoundry/room/web/cameras.json
```

Use the lightweight preparation Python with NumPy/Pillow/OpenCV/Hydra/OmegaConf installed. GPU phases switch to upstream mamba environments. Preparation is already available locally; transferring the audited prepared scene can avoid repeating it. No cloud instance has been provisioned or capture uploaded. `preflight` currently fails because this execution environment has neither Linux/CUDA nor the required mamba environments/service configuration. A GPU host and service/model access are required to continue actual reconstruction.

### Local fixes and validation

`capture-and-paths.patch` records changes against the pinned upstream code:

- `1b_process_raw_video.py`: uniform endpoint-preserving sampling fixes truncation of 471 frames to the first 400; explicit 12 fps concat input prevents duplicated processing frames; direct original-frame decoding avoids an additional lossy encode. Standardized preview excludes audio and metadata.
- `stage_utils.py`: JSON bookkeeping no longer imports Open3D/Torch. The original dependency chain crashed before CPU video preparation with an OpenMP shared-memory error.
- `6_bridge_bg_splat_to_og.py`: camera/world alignment honors `root_dir` instead of silently looking under the checkout's `Data/` directory.

Run `python harness/simfoundry/test_pipeline.py`: three regression tests cover endpoint sampling, every configured override against upstream schemas, and scaled-world/OpenCV/OpenGL camera conventions. The foreground runner dry run resolves its stages locally. Its warning that articulation is "not available in this release" actually means optional dependencies are missing here; the stage script exists. Our execution preflight blocks that silent skip. Neither dry runs nor these tests establish successful model inference.

`export_cameras.py` requires a real trained PLY, the real pose sidecar and matching DA3 rows. It applies the simulator transform once, exports source timestamps and both camera conventions, and leaves Gaussian SH/covariances in their original frame. It currently exports **original DA3 cameras**, not the final optimized splatfacto cameras; final source-view evaluation must extract the trained camera adjustments too.

### Room adaptation and acceptance gates

The paper's tabletop recipe assumes one flat support and closed articulated objects. This capture includes floor-supported chairs, table and backpack, table-supported cup/laptop, and an open laptop. The recipe selects the floor as the scene plane, expands the object-height search and settles all objects together. The support graph in `scene2.json` is a hypothesis to validate, not a constraint already enforced by upstream. Verify all six objects were recovered despite cropping/occlusion in the chosen anchor. Check the laptop's generated base/lid separation, hinge location/direction/limits and collisions explicitly.

Before replacing the website scene or training policies:

1. Compare the prior baseline, full SimFoundry recipe, no-camera-optimization ablation, and no-depth-loss ablation with fixed seeds, selected frames, compute budgets and evaluation cameras. Record actual GPU memory and each stage's wall time. These GPU experiments are pending.
2. Render identical source cameras and reserved frames. Report PSNR/SSIM/LPIPS and side-by-side crops for observed pixels. Score inferred/previously occluded regions separately. Do not evaluate fit against generated frames as though they were real observations.
3. Move each entire object and sweep the laptop hinge. Reject fragments left behind, duplicated object images in the background, holes, part detachment or discontinuities at inpainting chunk boundaries. Review original and cleaned masks at every processing frame. This 400-frame reconstruction selection does not replace the existing 471-frame SAM tracking audit.
4. Verify component ownership, watertight contact geometry, penetration and support stability. Use one fixed floor and separate object roots; the Gaussian background has no contacts. URDF-to-MuJoCo export with texture preservation, local hinge transforms, limits, inertia and contact geometry is **still pending generated assets**. Do not substitute old mesh assets and call them new SimFoundry output.
5. Resolve metric scale with a measured object dimension before physical training. Recheck contact torque, lifting and settling in MuJoCo, and render through the Gaussian/mesh compositor for visual-policy observations. Standard MuJoCo rasterization alone does not render Gaussians.

The three-image first scene needs its own sparse-view evaluation; it is not equivalent to the paper's video recipe and has not been rebuilt by this adapter. Generative completion proposes hidden surfaces and cannot guarantee the exact unseen room. Promotion requires review of the actual outputs, not installation success.

## Earlier reconstruction baseline

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
7. **Build object assets.** `solid_assets.py` fits table, cup and laptop surfaces. The coffee body and lid share a rigid root. The laptop lid has an explicit pivot and axis. Its fitted lower edge is regularized to the keyboard plane with thickness clearance because the original triangulated edge intersected the base. Chairs use observed-surface-preserving shell completion, followed by occupancy union and intersection repair. The backpack uses multi-view carving. These close the assets but do not establish the accuracy of unobserved shape.
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

### Multi-view completion and repair

The selected completion path preserves the original scan under `assets/variants/carved/baseline.npz`. Run `carving`, `shells`, `resolve-shells`, `repair-intersections`, `evaluate-completion`, then `select-completion` using the stage runner. These are capture-specific experiments, not a general automatic object-reconstruction service. The selection stage writes `labeled_mesh.npz` only after its geometry and silhouette gates pass. It saves `objects_selected.npz` before optional structural experiments.

`carve_objects.py` uses 8 mm voxels, source masks and aligned depth from 25 views. Six SAM reference views are excluded from carving. Silhouette contradictions carve a voxel only when predicted foreground depth does not explain its occlusion. Three contradiction thresholds are tested. The backpack uses the 0.04 candidate. Chair carving is rejected because it creates implausibly thick shapes.

`shell_completion.py` retains the observed chair fronts and closes their backs with a 12 mm inferred shell. Raw shells pass edge-based watertight checks but contain self-intersections. `remesh_shells.py` unions occupancy at 4 mm, reconstructs the boundary and simplifies to 30,000 faces. `resolve_local_intersections.py` removes the remaining intersection in the right chair, moving affected vertices by at most 3.87 mm. All three selected objects pass an independent Open3D manifold/watertight/self-intersection audit. The chairs contain four and three closed parts respectively; each set belongs to one movable body.

`evaluate_completion.py` compares standalone 320 × 240 silhouettes against SAM pseudo-reference masks. Four reference views select candidates; frames 1 and 19 form a reserved audit. All cameras and depths still come from the shared capture. Occlusion is not subtracted from silhouettes; these scores are neither ground-truth geometry accuracy nor independent novel-view validation. `completion_selection.json` records before/after scores and acceptance gates.

`decompose_contacts.py` fits CoACD convex pieces separately to each closed part. Compare coarse and `--fine` settings before selecting contact assets. Algorithm concavity settings are not achieved physical-error guarantees. `validate_completed_assets.py` measures 2,000 visual-surface samples against the nearest convex-piece surface, including internal boundaries. This one-sided distance is not a union Hausdorff test. Inferred chair support primitives remain necessary because the capture does not establish the full lower structure. Backpack and cushions remain rigid.

`spatial_contacts.py` also tests a denser local convex cover: 60 mm chair patches and 30 mm backpack patches. Flat patches receive a 0.5 mm half-thickness regularization instead of being silently discarded. `compare_contacts.py` requires completed run reports, checks every convex piece and samples 2,000 points in each direction between visual and contact surfaces. It selects the lower worst-direction 95th-percentile discrepancy and records visual hashes. Run stages `spatial-contacts`, `select-contacts`, then `physics`. The selected dense profile uses 586/504/901 pieces for left chair/right chair/backpack, versus 51/29/12 in the lighter CoACD profile. Local convexification may bridge concavities; neither profile is measured real geometry.

The runtime archive provides `scene.xml` for the denser selected contact cover and `scene-coacd.xml` for the lighter profile. Run `coacd-profile` after `physics` to regenerate the alternative XML and its separate contact files. `benchmark_physics.py --label spatial` measures three 2-second CPU stepping trials without rendering or a robot. The dense profile achieved 6.04 simulated seconds per wall second, versus 16.26 for the lighter profile in this CPU test. Compare `physics_timing_*.json`, fit and contact stability before choosing a policy-training profile. GPU/mjlab batched throughput has not been tested. `verify_packages.py` loads and steps both XML profiles from the extracted archive.

The independent Open3D intersection audit completed successfully before contact comparison. Later Open3D reruns hit an OpenMP shared-memory initialization failure in this execution session. Contact comparison therefore uses the separate trimesh/Rtree distance implementation. The initial incomplete fine-contact audit is explicitly marked invalid; only completed decomposition reports enter selection.

Never accept topology alone: rerun texture baking, inspect Blender renders from all three reference cameras, audit exported OBJ files, rebuild MuJoCo and stress-test contacts. Missing texture receives an explicit inferred material instead of dropping faces. Laptop shell edges use a fitted neutral metal finish because their subpixel source silhouettes create unstable projected triangles. `regularize_structure.py` is a separate experimental planar-room completion and is not part of the default stage sequence.

`triposr_cpu.py --object chair_left` and `--object backpack` run the CPU baseline. `fit_generated.py` performs multi-start pose/scale fitting and records silhouette agreement. `poisson_completion.py` tests a traditional smooth completion baseline in the isolated NumPy environment. Their outputs remain under `assets/variants/`; neither is automatically selected. `audit_assets.py` checks exported topology after welding UV seams. See `research.md` for the measured outcomes and rejection reasons.

The public archive contains stage scripts, example calibration and prompt masks, model inventory, documented assumptions, validation reports and dependency provenance. Large captures and model weights are separate inputs. Download the public case-study video into the path in `configs/scene2.json`; preserve the original high-resolution source locally for higher-quality reconstruction. The archive is a reusable experiment harness, not a self-contained pretrained reconstruction appliance.

# Reconstruction methods and evidence

The most suitable direction for this capture is a composition of calibrated multi-view geometry, complete object assets, explicit physics and a separate photographic rendering representation. This is a design choice informed by the following work, not a claim that one model has been proven best on this dataset.

| Work | Relevant contribution | Application to this capture |
| --- | --- | --- |
| [RE3Sim](https://github.com/InternRobotics/Re3Sim) | Combines reconstruction, Gaussian appearance and physics-based robotic data generation. | Preserve calibration and image appearance while validating collision assets separately. Its provided stack uses CUDA and Isaac Sim; it has not been run end-to-end here. |
| [SplatSim](https://splatsim.github.io/) | Uses Gaussian rendering with simulated robot/object motion for RGB manipulation policies. | Splats can move with rigid bodies, but visual primitives do not replace contact geometry or object ownership. |
| [SAM 3D Objects](https://github.com/facebookresearch/sam-3d-objects) | Generates complete masked-object geometry, appearance and placement from an image. | Candidate for chair and backpack completion. Generated hidden shape must be fitted and checked against all available real views. Official code is downloaded; native CUDA execution is unavailable in this session. |
| [SAM3D Phys](https://arxiv.org/abs/2605.30239) | Combines complete object priors with reconstructed scene pose/appearance for multi-object simulation. | Supports object-by-object completion and reinsertion as a remedy for partial scanned objects. The paper's results are not results on this capture. |
| [Physics constrained Real2Sim](https://github.com/physics-constrained-Real2Sim/physics-constrained-Real2Sim) | Models inter-object physical consistency in cluttered scenes from RGB-D. | Contact and placement are explicit validation targets. This capture contains RGB video, not measured depth. |
| [TRELLIS 2](https://github.com/microsoft/TRELLIS.2) | Produces object meshes and PBR attributes from images. | Candidate for textured complete assets. The official implementation requires a Linux NVIDIA GPU with at least 24 GB memory; no completed inference is claimed here. |
| [TripoSR](https://github.com/VAST-AI-Research/TripoSR) | Feedforward single-image 3D object reconstruction with a CPU execution path. | CPU completion baseline for the captured chair/backpack masks. Its older model and different extraction backend must be recorded when comparing results. |
| [Apple SHARP](https://github.com/apple-aiml-research/ml-sharp) | Predicts Gaussian appearance from one image. | Completed independent predictions for both captures. Strong source-view appearance does not validate large novel views or complete object backs. |
| [mlx spatial](https://github.com/appautomaton/mlx-spatial) | Community Apple-silicon implementations, including SAM 3D Gaussian and mesh export. | Installed in a separate Python 3.13 environment. A direct inference-device probe fails because this session cannot access Metal. This is a runtime blocker, not a failed reconstruction quality result. |
| [sam3d cpp](https://github.com/localai-org/sam3d.cpp) | Experimental CPU/Vulkan SAM 3D Objects implementation with geometry export. | Being assessed as a CPU route. Port claims require local validation; raw geometry is not an automatically repaired, textured simulation asset. |

## Experiments on these captures

Depth Anything V2 Small, DA3 Small and DA3 Large were compared against withheld sparse tracks from the shared COLMAP map. The median relative disagreements were 2.13%, 1.11% and 0.73% respectively. Different model input resolutions and compute budgets mean this is not an equal-compute architecture comparison.

SAM ViT-B reference masks and SAM 2 video propagation provide semantic evidence. The original 31-mask overlay could visibly lag a 30 fps clip. The new experiment processes every decoded frame and uses presentation timestamps for display. Its completeness check must pass before publication; mask accuracy still requires inspection.

The TSDF cleanup experiment uses object-mask evidence across all 31 reconstructed views, removes ambiguous fixed-room surfaces in movable-object envelopes, and filters small connected components before smoothing. A pre-cleanup mesh and GLB are retained under `assets/variants/`. Removing residual fragments is useful, but does not make partial scans watertight or recover unseen surfaces.

## Acceptance criteria

1. Move each object and verify that no part of that object remains in the fixed scene, including its texture painted onto nearby surfaces.
2. Check finite vertices, face degeneracy, connected components, boundary edges, winding, watertight collision volumes and physically valid inertia.
3. Fit generated object pose and scale against multiple calibrated images; report source-view and held-out-view silhouette/image error separately.
4. Mark inferred surfaces, assumed physical parameters and generated texture explicitly. Do not call them measured ground truth.
5. Exercise hinge limits and contact under torque, not only by setting a final pose. Record penetration and solver warnings.
6. Keep a failed or unaligned generated object out of the selected simulation scene. Preserve its report for comparison.
7. Require robot calibration and real-task validation before claiming policy-training or sim-to-real readiness.

## Completed object-completion trials

TripoSR ran on the captured chair and backpack masks (20.7 and 22.3 seconds excluding loading, CPU, 192³ extraction). Both raw outputs were watertight with two components. Largest-component selection and smoothing yielded one closed component. A 24-orientation trimmed similarity fit still produced mean SAM silhouette IoU 0.535 for the chair and 0.381 for the backpack, versus 0.888 and 0.676 for the partial scans. These candidates are retained, not adopted. The masks are pseudo-references; the fit uses the shared map, and occlusion is not removed from standalone rendered silhouettes.

[Open3D screened Poisson reconstruction](https://www.open3d.org/docs/release/tutorial/geometry/surface_reconstruction.html) was also tested at depth 7 on three segmented objects. Its smooth extrapolation produced below-floor geometry and did not pass the watertightness audit after simplification. It is not adopted. The official tutorial also notes extrapolation in low-density regions.

The table, cup, keyboard and laptop lid now retain every face regardless of texture availability. Each exports as one watertight visual component after welding UV seams, without degenerate faces. Hidden surfaces use explicit inferred color. Table-side illumination is a smooth robust fit to captured colors; it avoids projecting a jagged source silhouette onto an approximate plane. This is an appearance approximation, not measured albedo.

Full-rate tracking completed: 471 frames, 2,826 masks, 1,055 seconds CPU at 512-pixel model input. Browser checks sampled 60 presented playback frames with zero overlay media-time difference and seven seeks with matching frame indices. This validates synchronization, not mask ground truth.

## Selected multi-view completion

[Open3D voxel carving](https://www.open3d.org/html/tutorial/geometry/voxelization.html) informs a bounded silhouette/depth carving baseline. On this capture, carving produced an acceptable backpack closure but implausibly thick chairs. The selected backpack has one closed component and 24,000 faces. Its reserved SAM silhouette audit increased from 0.8705 to 0.9010.

The chair fronts are preserved with an inferred 12 mm backing, occupancy union at 4 mm, simplification and local intersection repair. A simple watertight test originally missed 364 and 753 self-intersection pairs in the raw shells. The final 30,000-face candidates have zero pairs, manifold vertices/edges and closed surfaces. The right chair required a maximum 3.87 mm local displacement. Left/right reserved silhouette scores are 0.8780/0.3210 versus 0.8814/0.3202 for the original scans. Low right-chair agreement reflects occluded standalone geometry as well as reconstruction error. The protocol uses SAM pseudo-reference masks and shared calibration, not independent ground truth.

[CoACD](https://github.com/SarahWeiii/CoACD), described in the [collision-aware decomposition paper](https://arxiv.org/abs/2205.02961), produces convex contact pieces for MuJoCo. Both 15 mm requested concavity with automatic preprocessing and a 5 mm setting without preprocessing were tested. Hull caps prevent those settings from guaranteeing achieved error. The reports separately measure visual-to-contact surface distance and physical contact stability. The decomposition represents inferred visual closure; real contact shape still requires measurement.

The fitted floor previously stopped before the recovered camera's visible carpet extent. Extending it fills that void, with inferred appearance beyond the photographed region. The keyboard footprint is refitted from four reviewed pixels in frame 13 onto its estimated plane, preventing carpet triangles along an oversized edge. Final input-view PSNR is 13.61, 17.90 and 15.07 dB at frames 1, 13 and 25. These are source-view comparisons, not held-out novel-view performance. A planar structural-room completion trial was rejected because it worsened one view and did not resolve reflective glass artifacts.

A separate local convex-cover baseline improved the collision fit at higher computational cost. It convexifies 60 mm spatial patches on chairs and 30 mm patches on the backpack, retaining flat patches with 0.5 mm half-thickness regularization. Selected visual→contact / contact→visual 95th-percentile distances are 6.11/7.06 mm, 5.25/6.80 mm and 1.51/4.47 mm respectively. These are sampled surface-set distances including internal piece faces, not union Hausdorff errors or real-object accuracy. The selected profile has 1,991 convex pieces across those three objects. A lighter 92-piece CoACD profile is retained for comparison. Local convex patches can bridge concavities, and both profiles inherit the uncertainty of the completed visual shape.

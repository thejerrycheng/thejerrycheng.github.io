# -*- coding: utf-8 -*-
R = {}

R["real2sim2real-ego"] = dict(
 why="""<p>This is now one of your four live projects, so the review matters more than the others. The pitch is a
 loop: capture a scene egocentrically, rebuild it as something a simulator can step, learn a policy inside it,
 and put the policy back in the real scene. Each leg of that loop is individually mature — 3D reconstruction,
 sim training, sim-to-real — and the interesting claim is that stitching them with the <em>ego view as the
 shared interface</em> gives you scene-specific policies without scene-specific robot data.</p>
 <p>The reason to care is economics. A robot demonstration costs a robot, an operator and a scene. An
 egocentric capture costs a person walking through a kitchen with a headset. If the exchange rate is even
 modest, the data equation changes.</p>""",
 state="""<p><b>The full loop has been built.</b> [[egoengine]] (June 2026) reconstructs a simulation scene
 from egocentric video that preserves task-relevant geometry and object layout, recovering hand pose and
 scene entities jointly, then trains in that twin. [[video2sim2real]] (June 2026) goes further and closes
 the whole loop from a <em>single</em> human video to a deployed dexterous skill, with an explicit division
 of labour: imitation learning produces the transferable base trajectory, and a residual RL policy learns
 the local corrections that contact discrepancies demand. If you were going to write down the architecture
 for this project, that is the architecture.</p>
 <p><b>The reconstruction leg is the bottleneck, and the field knows it.</b> [[r2s-ego]] (Aug 2026) exists
 precisely because egocentric capture gives you sparse, badly-distributed views — dual-proxy refinement for
 sparse-capture real-to-sim. Expect this to consume most of your engineering time, not the policy learning.</p>
 <p><b>The humanoid version came earlier.</b> [[videomimic]] reconstructs both the human motion and the
 terrain from ordinary video and trains a terrain-aware humanoid policy in the reconstruction. It is the
 cleanest demonstration that reconstructing the <em>scene</em>, not just the human, is what makes this work.</p>
 <p><b>Real-to-sim is also being used for evaluation, not just training.</b> [[polaris]] builds twins so
 generalist policies can be benchmarked cheaply and reproducibly. That is a lower-risk use of the same
 machinery and worth adopting regardless of what your training story ends up being.</p>
 <p><b>What closes the last gap.</b> [[asap]]'s delta-action model — collect real rollouts, learn a residual
 correction to the simulator, retrain against the corrected sim — is the most convincing published answer to
 the dynamics half of the gap, and it composes with everything above. [[real2sim]] is the older, simpler
 statement of the same loop on a deformable.</p>""",
 threads=[
  """<b>Ego capture → scene reconstruction.</b> [[egoengine]], [[r2s-ego]], [[videomimic]]. The geometry and
  layout have to be task-relevant, not photorealistic — a lesson that saves a lot of Gaussian-splatting time.""",
  """<b>IL base + residual RL.</b> [[video2sim2real]], [[hil-serl]], [[pld]]. The consensus structure: get a
  transferable trajectory by imitation, fix contact with RL.""",
  """<b>Dynamics-gap correction.</b> [[asap]], [[dexndm]], [[dexsim2real]]. Learn the correction rather than
  randomize over your ignorance.""",
  """<b>Rendering-gap correction.</b> [[simweaver]], [[phantom]]. Editing pixels is often cheaper than
  matching them.""",
  """<b>Real-to-sim for evaluation.</b> [[polaris]]. Underrated; it makes your ablations affordable.""",
  """<b>Viewpoint robustness.</b> [[egodemogen]]. Ego policies overfit to camera placement badly.""",
 ],
 gap="""<p>The loop is built, so the contribution has to be in the loop's <em>closure</em>. Two things are
 missing from all of the above. <b>First, iteration.</b> Every published system runs the loop once: capture,
 reconstruct, train, deploy. Nobody feeds the real-world failure back into the reconstruction and goes
 round again, even though that is the obvious thing to do and [[asap]] gives you the mechanism.
 <b>Second, scene generalization.</b> These systems build a twin of <em>the</em> kitchen. The question nobody
 answers is how many reconstructed kitchens you need before the policy stops needing a new one.</p>
 <p>A paper that runs the loop N times on the same task and reports the error trajectory — reconstruction
 fidelity, sim-real dynamics gap, and task success, all as functions of iteration count — would be a genuine
 contribution, and it is a systems result you are well set up to produce.</p>""",
 plan=[
  """Reproduce [[video2sim2real]] on one task first. Do not start by building your own pipeline; start by
  confirming you can run theirs, because the reconstruction stage will otherwise silently eat a month.""",
  """Instrument the three gaps separately: geometry error against a scanned ground truth, dynamics error
  against real rollouts ([[asap]]'s delta-action residual is a good scalar), and rendering error.""",
  """Add the second iteration. Feed real failure rollouts back into the delta-action model and the scene
  estimate, re-train, re-deploy. Report the curve.""",
  """Then the generalization experiment: 1, 3, 10 reconstructed scenes, evaluate on a held-out scene. This
  is the number the field actually wants.""",
  """Use [[polaris]]-style twins as the evaluation harness so you can afford the ablations.""",
 ],
 risks=[
  """<b>Reconstruction quality dominates every result.</b> If the twin is bad, everything downstream measures
  your reconstruction, not your method. [[r2s-ego]] exists because of this. Budget accordingly and report
  reconstruction quality as a first-class variable.""",
  """<b>The loop may not converge.</b> Iterating a real-to-sim loop can diverge if the correction model
  overfits to the last batch of failures. Hold out rollouts and watch for it.""",
  """<b>It becomes a graphics project.</b> Very easy to spend six months on splatting. The published systems
  all use task-relevant geometry, not beauty — copy that discipline.""",
 ],
 read=[
  dict(id="video2sim2real", why="Start here. Single human video to deployed dexterous skill, with the IL-plus-residual-RL split you want."),
  dict(id="egoengine", why="The reconstruction leg done properly — hand pose and scene entities recovered together."),
  dict(id="videomimic", why="The humanoid/terrain version, and the clearest argument for reconstructing the scene rather than just the human."),
  dict(id="asap", why="The dynamics-gap correction that composes with all of this. The delta-action idea is the one to reuse."),
  dict(id="r2s-ego", why="Sparse-capture reconstruction — the engineering problem that will actually cost you time."),
  dict(id="polaris", why="Real-to-sim as an evaluation harness. Adopt this early; it makes ablations affordable."),
  dict(id="hil-serl", why="If the RL fine-tuning stage is on real hardware, this is the sample budget to beat."),
  dict(id="real2sim", why="The original, simplest statement of the loop. Short; read for framing."),
  dict(id="simweaver", why="The rendering half of the gap, on deformables where it is worst."),
 ])

R["rl-post-training"] = dict(
 why="""<p>A pretrained VLA is a strong prior and a mediocre policy. It has seen a million trajectories and
 still fails the specific task in your specific scene maybe a third of the time, and no amount of additional
 demonstration data fixes that efficiently, because demonstrations teach the policy what success looks like
 and never what recovery looks like. RL is the only mechanism that reliably converts broad competence into
 task reliability.</p>
 <p>This is also the cheapest of your ideas to start: the base models are open, the algorithms are published,
 and the experiment fits on one arm.</p>""",
 state="""<p><b>The base result is settled.</b> [[hil-serl]] gets near-100% success on genuinely hard
 contact-rich tasks in one to two and a half hours of real training, with human corrections folded into the
 replay buffer. [[serl]] is the infrastructure that makes that possible and [[rlpd]] is the algorithm
 underneath — symmetric sampling from offline and online buffers, LayerNorm on critics, critic ensembles.
 Three unglamorous tricks. If you only read three things, read those.</p>
 <p><b>Applying it to VLAs specifically is now a small field.</b> [[iRe-VLA]] alternates RL on the action head
 with supervised fine-tuning of the whole model, because pure RL on a full VLA destabilizes the language
 backbone. [[ript-vla]] post-trains with nothing but binary task success, which is attractive because success
 is the one signal you can always instrument. [[conrft]] makes the diffusion action head tractable for RL by
 cutting the denoising chain.</p>
 <p><b>And 2025-26 produced a clear winner architecture.</b> [[pld]] — probe, learn, distill — trains
 lightweight <em>residual</em> actors off-policy to fix the base VLA's failures, collects the successful
 rollouts, and distills them back into the base model. This sidesteps the destabilization problem entirely
 because the big model is never the thing being RL'd. [[expo-ft]] attacks sample efficiency,
 [[stare-vla]] attacks long-horizon credit assignment, [[dlr-vla]] inverts the whole thing and uses RL as a
 <em>data generator</em> for pretraining, and [[rlinf-vla]] is the shared infrastructure (RSS 2026).</p>
 <p><b>The destabilization problem got a name and a diagnosis.</b> [[knowledge-insulation]] (Physical
 Intelligence) is the cleanest account of why naive VLA fine-tuning degrades the backbone's language and
 semantic knowledge, and of how to insulate it from the action-expert gradients. Read it next to
 [[iRe-VLA]] and [[pld]] — three different answers to the same failure.</p>
 <p><b>The commercial confirmation.</b> [[pi06]] is Physical Intelligence's statement of the same thesis with
 far more robot time behind it: RECAP, advantage-conditioned RL over demonstrations, on-policy rollouts and
 expert teleoperated interventions, producing espresso, box assembly and laundry. When the group with the
 most data says post-training is where the gains are, that is worth weighting.</p>""",
 threads=[
  """<b>Real-world off-policy RL.</b> [[rlpd]] → [[serl]] → [[hil-serl]]. The foundation. Everything else is
  this plus a bigger initial policy.""",
  """<b>Residual rather than full-model RL.</b> [[pld]], [[omnitactune]]. Currently the most practical answer,
  and the one least likely to wreck a model you cannot afford to retrain.""",
  """<b>Reward without instrumentation.</b> [[ript-vla]] (binary success), [[vip]] (value from human video).
  The unglamorous blocker for real-world RL is always the reward.""",
  """<b>Human-in-the-loop corrections.</b> [[hil-serl]], [[pi06]]. DAgger's descendant; still the highest
  value-per-minute of operator time.""",
  """<b>Infrastructure.</b> [[rlinf-vla]], [[serl]], [[harbor]]. Do not write your own rollout loop.""",
 ],
 gap="""<p>The methods are converging; the <em>evaluation</em> is not. Every paper here reports success rate
 on its own tasks with its own base model, so the field cannot answer the question a practitioner actually
 has: <b>given a fixed budget of one hour of robot time, which post-training method buys the most
 reliability, and on what kind of task?</b></p>
 <p>You have an arm, a base model you can run, and — through IRIS — a task suite with a real notion of
 precision. A controlled budget-matched comparison of residual RL ([[pld]]), interactive post-training
 ([[ript-vla]]), and human-in-the-loop ([[hil-serl]]) on one base policy would be cited constantly, and it
 is a week of compute rather than a year of method development. It also doubles as the pilot for your
 real-world RL harness idea.</p>""",
 plan=[
  """Pick one open base VLA you can actually run and fine-tune — [[openvla]] with [[openvla-oft]]'s continuous
  action head, or a π0-class model if you have access.""",
  """Build the reward instrumentation before the algorithm. Binary success detection that works unattended is
  the thing that decides whether this project happens.""",
  """Implement [[pld]]-style residual RL first. It is the least likely to destroy the base model and the
  easiest to debug.""",
  """Budget-match the comparison: same base policy, same tasks, one hour of wall-clock robot time each.
  Report reliability as a function of minutes, not epochs.""",
  """Report the failure modes the aggregate hides — which task properties (precision, contact, horizon) each
  method fixes and which it does not.""",
 ],
 risks=[
  """<b>Reward engineering eats the project.</b> This is the real reason real-world RL papers are rare. Solve
  it first or pick tasks where success is trivially detectable.""",
  """<b>Catastrophic forgetting of the base model.</b> Exactly why [[pld]] keeps the big model out of the RL
  loop. If you do fine-tune the whole model, hold out an OOD eval set and watch it.""",
  """<b>Hardware wear.</b> An hour of contact-rich RL is hard on a gripper. Plan the consumables.""",
 ],
 read=[
  dict(id="rlpd", why="The algorithm underneath everything. Short, and the three tricks are the whole paper."),
  dict(id="hil-serl", why="The result that proves real-world RL post-training is a two-hour job, not a research programme."),
  dict(id="pld", why="The current best architecture: residual actors fix failures, then distil back. Start your implementation here."),
  dict(id="pi06", why="The commercial confirmation, with RECAP and far more robot time than anyone else has."),
  dict(id="ript-vla", why="Post-training from binary success alone — the most deployable reward signal."),
  dict(id="iRe-VLA", why="Why you cannot naively RL a full VLA, and the alternating fix."),
  dict(id="rlinf-vla", why="The infrastructure. Use it instead of writing your own."),
  dict(id="serl", why="The reset/reward plumbing, and the direct template for your RL harness idea."),
  dict(id="expo-ft", why="Sample efficiency, which is the binding constraint on real hardware."),
  dict(id="knowledge-insulation", why="Why fine-tuning wrecks a VLA's semantics, and how to stop it. Read before you touch the backbone."),
 ])

R["wam-umi-gloves"] = dict(
 why="""<p>A world-action model predicts the future and the action that causes it. The bottleneck is data with
 both halves — you need observations <em>and</em> the actions that produced them, at scale, in the wild. UMI
 solved exactly that problem for grippers: a handheld device that records deployable demonstrations with no
 robot present. Pointing that data at a world-action model rather than a behaviour-cloning policy is the idea,
 and it is the one on your list with the clearest data story.</p>""",
 state="""<p><b>The capture side is solved and then some.</b> [[umi]] established the pattern; [[fast-umi]]
 made the tracking easier; [[dexumi]] extended it to dexterous hands with a wearable exoskeleton plus video
 inpainting; [[ume]] added compliance and whole-body reach; [[realdexumi]] (June 2026) is a wearable UMI
 purpose-built for dexterous hands; [[dexcap]] and [[doglove]] do the glove version, the latter with force
 feedback at $600. Commercially, [[sunday-gelato]] shipped a handheld Skill Capture device, which is this
 thesis with a company behind it. <b>The interface is no longer the contribution.</b></p>
 <p><b>The modelling side matured in parallel.</b> [[genie]] showed you can learn a <em>latent action space</em>
 from unlabelled video with no action labels at all — which is the key enabler if your capture ever gives you
 observations without clean actions. [[vjepa2]] made the case for predicting in latent space rather than
 pixels, and demonstrated zero-shot manipulation from 62 hours of unlabelled robot video. [[gr2]] and
 [[unipi]] are the generative-video branch. [[flare]] is the cheap version — world modelling as an auxiliary
 alignment loss on top of an ordinary policy.</p>
 <p><b>And the world model as a data engine is now the strongest result in the area.</b> [[dreamgen]]
 (NVIDIA GEAR) adapts an image-to-video world model to a robot's embodiment, generates photorealistic
 trajectories of tasks it has never performed, extracts pseudo-actions, and trains on them — reporting 22
 new behaviours from teleop on a single pick-and-place task. [[robocurate]] adds the necessary filter:
 verify the generated actions are physically executable before training on them. If UMI capture gives you
 the seed data, DreamGen is the multiplier on top of it, and that pairing is the sharpest version of this
 idea.</p>
 <p><b>And the explicit WAM line now exists.</b> [[mobilewam]] and [[decowam]] in your own M2 library bridge
 world-action models to mobile and legged manipulation; [[dream-tac]] does the tactile version on a Tac-UMI
 gripper. The phrase "world-action model" went from unused to crowded inside about a year.</p>""",
 threads=[
  """<b>In-the-wild capture.</b> [[umi]], [[realdexumi]], [[dexumi]], [[ume]], [[dexcap]]. Pick one; do not
  build another.""",
  """<b>Latent action learning.</b> [[genie]]. The trick that makes unlabelled video usable.""",
  """<b>Latent vs generative prediction.</b> [[vjepa2]] vs [[gr2]]/[[unipi]]. Latent is cheaper and less
  distracted by texture; generative gives you something to look at.""",
  """<b>WAM on real robots.</b> [[mobilewam]], [[decowam]], [[dream-tac]]. Read these for what breaks.""",
  """<b>The cheap first step.</b> [[flare]] — add a future-latent prediction loss to a policy you already
  have, and see whether it buys anything before building a world model.""",
 ],
 gap="""<p>The opening is the property UMI data has that robot-teleop data does not: <b>it is collected in
 hundreds of different real scenes, cheaply</b>. Every world-action model published so far is trained on
 data from a handful of lab environments, which is exactly the regime where a world model's main selling
 point — generalizing the dynamics rather than the policy — cannot be tested.</p>
 <p>So the experiment is: hold scene diversity as the independent variable. Train the same WAM on N scenes
 of UMI capture for N across two orders of magnitude, and measure prediction error and downstream policy
 success on held-out scenes. Nobody can run that with teleop data because nobody can afford to. You can,
 because the capture is a person walking around with a stick. <b>That is the paper.</b> Collaboration with
 Rooholla and Joseph on the capture scale-up is the right move.</p>""",
 plan=[
  """Standardise on one capture rig. [[realdexumi]] if you want hands, plain [[umi]] if you want to maximise
  scenes per hour. Resist redesigning it.""",
  """Start with [[flare]], not a full world model — an auxiliary future-latent loss on a diffusion policy
  tells you within two weeks whether the signal is there.""",
  """Then the real thing: a [[vjepa2]]-style latent predictive model over the UMI stream, with [[genie]]-style
  latent actions as a fallback for any capture where the action track is unreliable.""",
  """The scene-scaling curve is the headline. Prediction error and task success against number of distinct
  capture scenes, log x-axis.""",
  """Deploy on MABEL via the [[umi-on-legs]] interface — end-effector trajectories in the task frame, whole-body
  controller underneath. Do not couple the WAM to the embodiment.""",
 ],
 risks=[
  """<b>UMI action quality.</b> The recorded actions come from SLAM pose tracking, and the noise floor there
  sets a ceiling on anything you learn. Measure it before you model it.""",
  """<b>Someone runs the scaling experiment first.</b> [[generalist-ai]] is explicitly claiming robot-data
  scaling laws off a 270k-hour corpus. Your differentiator is open, reproducible, in-the-wild scenes, not raw volume.""",
  """<b>The world model does not beat the policy.</b> Entirely possible, and worth reporting. [[flare]]-first
  keeps that discovery cheap.""",
 ],
 read=[
  dict(id="umi", why="The interface, and the hardware section is the part people skip and should not."),
  dict(id="vjepa2", why="The architecture to build on. Latent prediction, zero-shot transfer, and an honest ablation section."),
  dict(id="genie", why="Latent actions from unlabelled video — your fallback when the action track is bad."),
  dict(id="flare", why="The two-week version of this project. Do it first."),
  dict(id="realdexumi", why="2026 wearable UMI for dexterous hands — the capture rig if you want fingers."),
  dict(id="mobilewam", why="WAM on a mobile manipulator; in your own M2 library. Read for what breaks in practice."),
  dict(id="dream-tac", why="The tactile WAM on a Tac-UMI gripper — the closest neighbour to this idea."),
  dict(id="umi-on-legs", why="How to deploy a UMI policy on a mobile base without coupling the two."),
  dict(id="dreamgen", why="The world model as a data engine — 22 new behaviours from one task's teleop. The multiplier on top of UMI capture."),
  dict(id="robocurate", why="Verifying generated trajectories are executable. The filter DreamGen needs."),
  dict(id="oa-wam", why="Object-addressable WAM — structure that keeps long rollouts from degrading."),
  dict(id="dyna2", why="Unaudited, but an unsaturated scaling curve on human rather than robot data. The shape is the point."),
  dict(id="sunday-gelato", why="Competitive intelligence: the commercial version of this thesis."),
 ])

R["mobile-dex-umi"] = dict(
 why="""<p>You called this a low-hanging fruit, and the components genuinely do exist: UMI-style capture, a
 dexterous hand, a mobile base, and a whole-body controller that will track end-effector trajectories. The
 combination is what does not exist as a working system.</p>
 <p>The reason it matters is reach. Static bimanual setups can only learn tasks that fit inside their
 workspace, which excludes most of what a home robot would do. Mobility plus dexterity is where the useful
 tasks live, and it is also where nobody has good data.</p>""",
 state="""<p><b>Mobility is solved to a usable standard.</b> [[tidybot2]] gives you an open holonomic base
 with a powered-caster drive at around $6k and a phone-based whole-body teleop interface. [[mobile-aloha]]
 showed the co-training result that matters: adding static bimanual data lifts mobile task success by up to
 90%, which means you do not need all your data to be mobile. [[behavior-robot-suite]] decomposes household
 tasks into the three capabilities that actually matter — bimanual coordination, stable navigation, extensive
 reach — and builds the platform around them. [[yor]] and [[homer]] are the 2026 entries.</p>
 <p><b>The interface between manipulation and mobility is solved too.</b> [[umi-on-legs]] is the key paper:
 the manipulation policy speaks end-effector trajectories in the task frame, and an RL whole-body controller
 figures out how to deliver them. That decomposition is what lets you develop the two halves independently.</p>
 <p><b>Dexterous capture is now commodity.</b> [[dexumi]] (exoskeleton adapter plus video inpainting),
 [[realdexumi]] (wearable UMI for dexterous hands, 2026), [[ume]] (whole-body exoskeleton with compliance),
 [[dexcap]] (portable glove plus SLAM). Any of these will give you data.</p>
 <p><b>What is missing is the combination.</b> Nobody has published a mobile base + multi-finger hand +
 in-the-wild dexterous capture system working end to end. The dexterous UMI papers all evaluate on static
 arms; the mobile manipulation papers all use grippers.</p>""",
 threads=[
  """<b>The base.</b> [[tidybot2]] holonomic, or MABEL's swerve platform. Holonomic matters more than it
  sounds — you want the base drivable <em>during</em> demonstration, not parked.""",
  """<b>The manipulation/mobility interface.</b> [[umi-on-legs]], [[falcon]], [[deep-wbc]]. Task-frame
  end-effector trajectories, whole-body controller underneath.""",
  """<b>Dexterous capture.</b> [[realdexumi]], [[dexumi]], [[ume]], [[wt-umi]].""",
  """<b>Co-training static with mobile.</b> [[mobile-aloha]]. The single highest-value trick in this area.""",
  """<b>Task decomposition.</b> [[behavior-robot-suite]] — read its capability analysis before specifying
  anything.""",
 ],
 gap="""<p>This is a <b>systems</b> contribution, and you should be honest that it is. There is no new
 algorithm here; there is an integration nobody has done, and integrations of this kind have historically been
 very well cited when the hardware and data are released ([[umi]], [[aloha]], [[tidybot2]] are all in that
 category).</p>
 <p>The concrete claim to aim for: <b>in-the-wild dexterous demonstrations, collected with no robot present,
 executed by a multi-finger hand on a mobile base in scenes the robot has never been in.</b> The
 [[mobile-aloha]] co-training result suggests the mobile data requirement may be far smaller than expected,
 which is the finding that would make this cheap.</p>""",
 plan=[
  """Fix the stack early and stop redesigning it: MABEL's base, one hand, [[realdexumi]]- or
  [[dexumi]]-style capture, [[umi-on-legs]] as the interface.""",
  """Validate the interface before the data. Can the whole-body controller track a recorded end-effector
  trajectory to a few centimetres? If not, nothing downstream works.""",
  """Collect in at least 10 distinct real scenes. The whole argument for in-the-wild capture is scene
  diversity; three scenes proves nothing.""",
  """Run the [[mobile-aloha]] co-training ablation: static-only, mobile-only, mixed. The mixing ratio is a
  publishable number on its own.""",
  """Release the hardware and the data. That is what makes a systems paper matter.""",
 ],
 risks=[
  """<b>Integration debt.</b> Four subsystems means four failure modes multiplying. Stage the bring-up and
  keep a working configuration you can fall back to.""",
  """<b>Base motion corrupts the capture.</b> UMI pose tracking assumes a reasonably static world; a moving
  base plus a moving hand is harder. Check the SLAM quality early.""",
  """<b>Hand reliability.</b> Multi-finger hands break. [[orca-hand]] and [[ruka-v2]] are explicitly engineered
  for repairability — that is not a minor consideration for a data-collection campaign.""",
 ],
 read=[
  dict(id="umi-on-legs", why="The interface that makes this tractable. Read first."),
  dict(id="mobile-aloha", why="The co-training result that may make the mobile data requirement small."),
  dict(id="tidybot2", why="The base design, and the phone-teleop trick worth stealing."),
  dict(id="realdexumi", why="2026 wearable dexterous UMI — the most likely capture rig."),
  dict(id="dexumi", why="The two-part embodiment-gap strategy: exoskeleton for kinematics, inpainting for pixels."),
  dict(id="behavior-robot-suite", why="The capability decomposition to write your spec against."),
  dict(id="ume", why="Whole-body exoskeleton capture with compliance — the force half UMI leaves out."),
  dict(id="falcon", why="Force-adaptive whole-body control for when the payload fights back."),
 ])

R["hand-22dof"] = dict(
 why="""<p>Everything in your dexterity agenda — egocentric learning, tactile world models, the dexterous UMI —
 needs a hand you control, can repair, and can simulate. Buying one means inheriting someone else's kinematics
 and a support contract; building one means the hardware stops being the excuse.</p>
 <p>The 1X Redwood hand is the target aesthetic: high DOF, tendon-driven, soft-covered, built for a home
 robot rather than a lab bench. The open-source version of that does not exist yet at 22 DOF.</p>""",
 state="""<p><b>The open-hand field got crowded in 2026, and you should know exactly how crowded before
 committing.</b> [[leap-hand]] (2023, ~$2000) made dexterity research affordable and contributed real
 kinematics — the MCP design that keeps fingers dexterous in every pose. [[orca-hand]] (ETH, IROS 2025) is
 17 DOF, tendon-driven, under 2000 CHF, assembles in under eight hours, survived 10,000+ continuous cycles,
 and is engineered for repairability rather than peak spec. [[ruka]] (NYU) contributed the idea that matters
 most for high DOF: <b>stop modelling tendon coupling analytically and learn the motor-to-joint map from
 glove data</b>.</p>
 <p>Then 2026: [[ruka-v2]] adds a decoupled 2-DOF parallel wrist and finger abduction, fully open-sourced,
 demonstrated across 13 teleoperated dexterous tasks. [[mm-hand]] is <b>21 DOF</b> with remote tendon
 actuation, modular printed fingers, and joint-angle + tactile + motor + in-palm stereo sensing — which is
 close to a line-by-line match for the spec you wrote down. [[aero-hand]] is a five-finger, 16-joint,
 seven-motor, 374 g hand for $314 of parts, shipped simulation-ready.</p>
 <p><b>The mechanism literature is separate and worth reading.</b> [[dlr-hand]] for variable stiffness and
 impact tolerance, [[faive-ball]] for rolling-contact joints (the ETH lineage behind [[mimic-robotics]]),
 [[midas-hand]] for the direct-drive counter-argument, [[dexwrist]] for the joint everyone under-designs,
 [[pds-joint]] for spiral-joint mechanisms.</p>""",
 threads=[
  """<b>Cheap and repairable.</b> [[orca-hand]], [[aero-hand]], [[leap-hand]]. Reliability beats spec for
  anything you plan to collect data with.""",
  """<b>High DOF with learned kinematics.</b> [[ruka]], [[ruka-v2]], [[mm-hand]]. The learned motor-to-joint
  map is the enabling idea.""",
  """<b>Joint mechanisms.</b> [[faive-ball]] rolling contact, [[pds-joint]] spiral, [[dlr-hand]] variable
  stiffness, [[midas-hand]] direct drive.""",
  """<b>Sensing integrated from the start.</b> [[mm-hand]], [[dexskin]], [[anyskin]]. Retrofitting touch onto
  a finished hand is much worse than designing for it.""",
  """<b>The wrist.</b> [[dexwrist]], [[ruka-v2]]. A brilliant hand on a bad wrist is a bad manipulator.""",
 ],
 gap="""<p>Be blunt about this one: <b>21-DOF open tendon hands now exist</b> ([[mm-hand]]), and so does an
 open tendon hand with wrist and abduction ([[ruka-v2]]). "22 DOF, tendon-driven, open source" is no longer a
 contribution by itself, and a paper making that claim would be rejected on novelty.</p>
 <p>What is still open, in descending order of value. <b>Durability as a measured quantity</b> — [[orca-hand]]
 reports 10,000 cycles and is almost alone in reporting anything; a hand with a published wear model and
 field-replaceable tendons would be genuinely useful to everyone doing data collection. <b>Sensing density</b>
 — nobody has combined [[dexskin]]-class conformable coverage with a 20+ DOF open hand, and that combination
 is exactly what your tactile world-model project needs. <b>Simulation fidelity</b> — [[aero-hand]] ships
 simulation-ready, most do not, and a hand whose MuJoCo model actually matches measured tendon behaviour
 would unblock sim-to-real for everyone.</p>
 <p>The honest framing: build the hand as <em>infrastructure</em> for your other projects, and publish it when
 it has a property the others lack — most plausibly full-coverage touch, or a validated sim model.</p>""",
 plan=[
  """Before designing anything, build one [[orca-hand]] or [[aero-hand]]. Two weeks, and it will change your
  design opinions more than any amount of reading.""",
  """Adopt [[ruka]]'s learned motor-to-joint mapping from the start. It removes the hardest modelling problem
  in tendon hands and it is the only reason 20+ DOF is tractable for one person.""",
  """Design the sensing in, not on. Route for [[dexskin]]/[[anyskin]]-class coverage at the fingers and palm
  before the mechanical design is frozen.""",
  """Publish a wear protocol: cycles to tendon replacement, drift after N cycles, time to repair. Nobody does
  this and everybody needs it.""",
  """Validate the MuJoCo model against measured joint trajectories under load, and release both.""",
 ],
 risks=[
  """<b>Novelty.</b> Addressed above — this is infrastructure first, paper second.""",
  """<b>Tendon maintenance eats the research.</b> The reason [[orca-hand]]'s reliability focus exists. Design
  for field replacement or you will spend your PhD restringing.""",
  """<b>Sim-to-real for tendon hands is genuinely hard.</b> Friction and hysteresis are not well modelled by
  any simulator. [[dexndm]]'s joint-wise learned dynamics is the most promising escape hatch.""",
 ],
 read=[
  dict(id="ruka-v2", why="The current state of the art for exactly this idea. Read first and decide what you would do differently."),
  dict(id="mm-hand", why="21 DOF, modular, multi-modal sensing — essentially your written spec, already built."),
  dict(id="orca-hand", why="The reliability argument, and the only hand reporting a durability number. Build one."),
  dict(id="ruka", why="The learned motor-to-joint map. The single most important idea for making high DOF tractable."),
  dict(id="aero-hand", why="$314, 374 g, simulation-ready. Cheapest credible entry point."),
  dict(id="leap-hand", why="The kinematic contribution that made cheap hands actually dexterous."),
  dict(id="dexskin", why="The sensing you should design in from the start."),
  dict(id="dexwrist", why="Do not under-design the wrist."),
  dict(id="dexndm", why="How to close the sim-to-real gap for a tendon hand once you have one."),
 ])

R["learned-retargeting"] = dict(
 why="""<p>Retargeting is the silent tax on every teleoperation and human-video pipeline you run. The standard
 formulation minimizes distance between human and robot keypoints, which is the wrong objective: it optimizes
 for the hand <em>looking</em> right rather than for the contacts being right. Two fingers that should touch
 end up a centimetre apart, a box that should be gripped is held by fingertips that are not quite on it, and
 the policy trained on that data learns a task that does not physically work.</p>""",
 state="""<p><b>The classical formulation is well established and well understood.</b> [[dexpilot]] introduced
 the fingertip-distance cost that most systems still use, [[anyteleop]] generalized it across hands and arms
 with camera-only input, and [[dex-retargeting]] is the library that made it a solved engineering problem
 rather than a research one. For whole-body, [[h2o]] fits the human shape to the robot's kinematics before
 tracking, [[omnih2o]] extends that to dexterous hands and many interfaces, and [[hover]] distils multiple
 command modes into one masked policy.</p>
 <p><b>The contact-aware reformulation has arrived.</b> [[c2dex]] (Aug 2026, in your own M2 library) does
 <em>contact-consistent</em> reconstruction and retargeting — preserving which surfaces touch rather than
 which joints match. That is the idea you wrote down, published. [[x-op]] takes the optimization route with
 MPC-based cross-morphology retargeting.</p>
 <p><b>The learned-mapping precedent is on the hardware side.</b> [[ruka]] learns the motor-to-joint map from
 glove data rather than modelling it, which is the same move one level lower in the stack. [[dexumi]] avoids
 the problem entirely by making the human wear the robot's kinematics.</p>
 <p><b>And the masking insight generalizes.</b> [[maskedmimic]] and [[hover]] both show that training with
 randomly masked goal specifications produces one policy that serves many interfaces — which is directly
 applicable if you want a retargeter that accepts whatever signal the capture happens to provide.</p>""",
 threads=[
  """<b>Keypoint retargeting.</b> [[dexpilot]], [[anyteleop]], [[dex-retargeting]]. The baseline you must beat.""",
  """<b>Contact-consistent retargeting.</b> [[c2dex]]. Read this before writing anything.""",
  """<b>Optimization-based cross-morphology.</b> [[x-op]], [[h2o]].""",
  """<b>Avoiding retargeting by construction.</b> [[dexumi]], [[ume]] — make the human wear the robot.""",
  """<b>Learned kinematic maps.</b> [[ruka]] — the same trick, applied to tendons.""",
  """<b>Interface-agnostic policies.</b> [[hover]], [[maskedmimic]].""",
 ],
 gap="""<p>[[c2dex]] takes the headline framing, so the opening has to be sharper. Two remain.</p>
 <p><b>The benchmark.</b> There is no standard way to evaluate a retargeter. Papers report task success of a
 downstream policy, which confounds retargeting quality with policy quality. A benchmark that measures
 retargeting directly — contact-set agreement, force-closure preservation, fingertip-contact recall on a
 set of human demonstrations with ground-truth contact — would be used by everyone in this list, and it is
 exactly the kind of contribution that makes a lab's work citable for years.</p>
 <p><b>Task-conditioned retargeting.</b> Every method above retargets the same way regardless of what the
 hand is doing. But the correct retargeting for a precision pinch and for a power grasp are different, and
 the information about which one is happening is right there in the demonstration. Nobody conditions on it.</p>""",
 plan=[
  """Build the evaluation first. Take human demonstrations with measured contact (a [[doglove]]-class force
  glove, or vision plus a tactile object), retarget with [[dex-retargeting]], and measure contact-set
  agreement. That number is your baseline and the paper's spine.""",
  """Reproduce [[c2dex]] as the strong baseline. Do not skip this; it defines the current bar.""",
  """Train the task-conditioned version: a small network that predicts the retargeting objective's weights
  from the demonstration segment, supervised by downstream contact agreement.""",
  """Evaluate on the two-fingers-touching and holding-a-box cases you named — they are good tests precisely
  because keypoint methods fail on them in visible, diagnosable ways.""",
  """Close the loop: show the downstream policy trained on better-retargeted data actually succeeds more often.""",
 ],
 risks=[
  """<b>Ground-truth contact is hard to get.</b> The whole benchmark rests on it. Settle the measurement
  method before collecting anything — a tactile-instrumented object is usually more reliable than a glove.""",
  """<b>Retargeting may not be the bottleneck.</b> Possible that policy capacity dominates. The benchmark
  answers this honestly either way, which is why it is the right first step.""",
  """<b>Hand mismatch caps the achievable score.</b> If your robot hand cannot make the contact the human
  made, no retargeter can fix it. Report the achievable ceiling per hand.""",
 ],
 read=[
  dict(id="c2dex", why="Contact-consistent retargeting, 2026, already in your library. Read first — it is the closest prior work."),
  dict(id="anyteleop", why="The general camera-only system and the practical baseline."),
  dict(id="dex-retargeting", why="The library. Your baseline implementation, not a paper to argue with."),
  dict(id="ruka", why="Learning the kinematic map instead of modelling it — the same move one layer down."),
  dict(id="hover", why="Masked training so one policy serves many command interfaces."),
  dict(id="dexumi", why="The alternative: remove the retargeting problem by construction."),
  dict(id="x-op", why="The MPC-based cross-morphology answer, for contrast."),
  dict(id="doglove", why="Force-feedback capture, if you need demonstrations with measured contact."),
 ])

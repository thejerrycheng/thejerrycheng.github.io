# -*- coding: utf-8 -*-
R = {}

R["multi-robot-marl"] = dict(
 why="""<p>M2 is the project where the hard part is not any single robot's competence but the fact that two of
 them share one rigid object. The moment a payload couples two mobile manipulators, the system stops being
 two control problems and becomes one under-actuated, over-constrained, partially-observed problem where
 every local decision imposes a force on the other agent. That coupling is what makes the literature here
 worth reading carefully rather than skimming.</p>
 <p>There is also a strategic reason. Single-robot manipulation is the most crowded area in robotics right
 now. Multi-robot physical collaboration is not — the datasets do not exist, the benchmarks are thin, and
 most published work is either simulation-only or two drones carrying a stick. A working two-manipulator
 physical collaboration result with real contact forces is still a publishable systems contribution.</p>""",
 state="""<p>The field splits cleanly into two camps that barely cite each other. On one side, <b>model-based
 distributed control</b>: ADMM-decomposed MPC, control barrier functions for safety, event-triggered
 communication to keep bandwidth down. This camp has guarantees, handles the rigid-constraint case properly,
 and is what most of your <em>distributed_mpc</em> and <em>collaborative_transport</em> folders contain. On the
 other, <b>multi-agent RL</b>: [[mappo]] as the pragmatic default, [[qmix]] for value factorization,
 [[maddpg]] as the original centralized-critic template. This camp scales to messy observations and
 discovers coordination strategies nobody scripted, and offers essentially no guarantees.</p>
 <p>The honest summary of MARL-for-robotics as of now: <b>[[mappo]] with a well-shaped reward beats almost
 every specialized MARL algorithm</b> once you actually tune it, which is the same lesson single-agent RL
 learned about PPO. Do not start by implementing QMIX. Start by implementing centralized-critic PPO and
 spending your time on the reward and the observation space instead.</p>
 <p>The most convincing recent physical result in your library is [[decentralized-aerial]] — multiple aerial
 vehicles manipulating a cable-suspended load with decentralized policies. It matters because the cable
 imposes exactly the kind of shared constraint your two ground manipulators will face, and because the
 policies are genuinely decentralized at execution time rather than a centralized controller in disguise.
 On the ground side, [[h2compact]] handles the human-humanoid case with adaptive contact trajectories, which
 is the same problem with a far less predictable partner.</p>
 <p>Worth noting what is <em>missing</em> from the literature: almost nobody reports what happens when the
 two agents disagree about the object's pose. Estimation error is the dominant real-world failure mode in
 coupled transport and it is systematically under-reported.</p>""",
 threads=[
  """<b>Centralized training, decentralized execution (CTDE).</b> The organizing principle of the whole area.
  [[mappo]], [[qmix]], [[maddpg]]. Read MAPPO first and treat the others as context.""",
  """<b>Distributed MPC and ADMM.</b> Your M2 <em>distributed_mpc</em> folder has ~17 papers here. The
  relevant question is not which solver is fastest but which formulation lets you write the rigid-body
  constraint exactly rather than as a soft penalty.""",
  """<b>Cooperative transport with physical coupling.</b> [[decentralized-aerial]] is the cleanest learned
  result; the quadruped and box-transport papers in your <em>collaborative_transport</em> folder are the
  ground-robot equivalents.""",
  """<b>Human-in-the-loop co-manipulation.</b> [[h2compact]] and the carbon-fibre-ply and co-manipulation
  papers in your library. This is the bridge to your separate HRI idea — the human is just an agent whose
  policy you cannot train.""",
  """<b>Force sensing versus force inference.</b> A recurring split: measure the interaction wrench, or
  infer it from proprioception. Cheaper robots force the second choice, and it is where most of the
  interesting recent work sits.""",
 ],
 gap="""<p>The opening is <b>learned coordination that respects a hard physical constraint, evaluated on real
 hardware with reported force data</b>. Almost all learned cooperative transport is either simulated or
 reports only task success. Nobody is publishing the internal-force time series — the squeeze the two robots
 put on the object when they disagree — even though that is the quantity that determines whether the object
 survives.</p>
 <p>M2 is unusually well positioned for this because you control both robots end to end and can instrument
 them. A paper that (a) trains decentralized policies for two mobile manipulators carrying a shared rigid
 object, (b) reports internal wrench alongside success rate, and (c) shows graceful degradation when one
 robot's state estimate drifts, would be filling a real hole rather than adding to a pile.</p>""",
 plan=[
  """Build the sim first: two M2 bases plus arms holding one rigid box in MuJoCo or Isaac Lab, with the
  grasp modelled as a compliant constraint so internal forces are observable rather than infinitely stiff.""",
  """Baseline with centralized MPC — you need to know what the model-based answer looks like before claiming
  RL beats it. Use your existing <em>distributed_mpc</em> reading for the formulation.""",
  """Train [[mappo]] with the internal wrench in the reward as a penalty, not just task progress. Sweep the
  penalty weight; the tradeoff curve between speed and squeeze is the headline figure.""",
  """Add the realistic failure: inject drift into one agent's object-pose estimate and measure how far the
  policy degrades versus the MPC baseline. This is where learned policies usually win and nobody shows it.""",
  """Transfer to the two real M2 platforms. Report the sim-to-real force gap honestly — it will be large.""",
 ],
 risks=[
  """<b>Reward shaping eats the project.</b> Multi-agent reward design is harder than single-agent because
  credit assignment and force penalties interact. Budget for this and consider [[eureka]]-style automated
  reward search rather than hand-tuning for months.""",
  """<b>Sim contact fidelity.</b> Two robots squeezing a box is exactly the regime where soft-constraint
  contact solvers misbehave. Validate the simulator against a static squeeze test on real hardware early.""",
  """<b>It becomes a communication paper.</b> Easy to drift into bandwidth and latency questions that are
  well covered by the DMPC literature and not what makes M2 distinctive. Keep the contribution physical.""",
 ],
 read=[
  dict(id="mappo", why="Start here. The baseline you should actually run, and the paper that explains why the fancy alternatives usually are not needed."),
  dict(id="decentralized-aerial", why="The cleanest recent demonstration that decentralized learned policies can hold a shared rigid constraint."),
  dict(id="h2compact", why="The human-in-the-loop version — read for how they handle a partner whose policy is unknown."),
  dict(id="qmix", why="Context for the value-factorization alternative, so you can say why you did not use it."),
  dict(id="falcon", why="Not multi-agent, but the force-curriculum idea transfers directly to the squeeze-penalty problem."),
  dict(id="maddpg", why="Historical anchor for centralized-critic methods; skim."),
  dict(id="crossformer", why="If M2 ever needs one policy across heterogeneous robots, this is the reference."),
 ])

R["tactile-wm"] = dict(
 why="""<p>Every world model in this library predicts pixels or latents derived from pixels. That is a
 modality choice, not a law, and it is the wrong one for manipulation. The events that determine whether a
 grasp succeeds — first contact, incipient slip, the moment a finger loses normal force — are frequently
 invisible to a camera, occluded by the hand itself, or happening faster than the frame rate. A world model
 that cannot represent them cannot predict the failures that actually occur.</p>
 <p>This is a real gap rather than a fashionable one. The tactile-learning literature is large but almost
 entirely <em>reactive</em> — touch as an extra observation channel for a policy. Touch as something you
 <em>predict</em>, as a learned forward model over contact state, is close to unexplored.</p>""",
 state="""<p><b>Hardware is no longer the bottleneck.</b> [[gelsight]] turned tactile sensing into a vision
 problem; [[digit]] shrank it to fingertip scale and open-sourced it; [[anyskin]] made sensors
 <em>replaceable without recalibration</em>, which is quietly the most important property for any learning
 pipeline because it means your policy survives a broken finger. [[dexskin]] extends coverage from fingertips
 to conformable full-hand skin, which matters because fingertip-only sensing misses most of the contact in a
 real grasp.</p>
 <p><b>Touch-only control already works.</b> [[rotate-without-seeing]] does in-hand rotation with binary
 contact sensors and no vision at all. That is the existence proof: contact signals carry enough state for
 dexterity. If a reactive policy can do it, a predictive model over the same signals should be learnable.</p>
 <p><b>The world-model side is mature but blind.</b> [[dreamerv3]] and [[dreamerv4]] give you the training
 machinery; [[vjepa2]] argues convincingly that predicting in latent space beats predicting pixels. None of
 them have touch. [[flare]] is the closest in spirit — world modelling as an auxiliary alignment loss rather
 than a separate generative model — and that formulation is the easiest to extend to a second modality.</p>
 <p><b>Data is the actual obstacle.</b> [[robotacdex]] in your library is a paired visual-tactile dataset for
 humanoid manipulation, and it is the kind of thing that did not exist two years ago. [[omnitactune]] shows
 tactile residual RL working on top of an existing policy. Between them, the ingredients exist.</p>
 <p><b>And then 2026 happened.</b> A live search turns up an entire cluster that did not exist when this idea
 was written down: [[dream-tac]] is a unified tactile <em>world-action</em> model that jointly predicts
 actions, future images and tactile dynamics on a Tac-UMI gripper; [[omnivta]], [[vt-wam]], [[tactile-wam]]
 and [[tacforesight]] all attack the same target from slightly different angles (visuo-tactile fusion,
 asymmetric attention, force-guided prediction). [[wt-umi]] does the hardware half on a whole-body system.
 The honest read: <b>the general idea is taken</b>. What is not taken is the evaluation — none of these
 report slip-prediction lead time as a primary metric, and none run on a high-DOF multi-finger hand.</p>""",
 threads=[
  """<b>Sensor hardware.</b> Optical ([[gelsight]], [[digit]]) versus magnetic ([[anyskin]], [[reskin]])
  versus conformable high-coverage ([[dexskin]]). For a world model you want coverage and calibration
  stability over resolution — which argues for AnySkin/DexSkin rather than GelSight.""",
  """<b>Tactile representation learning.</b> The tactile analogue of [[r3m]]: pretrain an encoder on
  unlabelled contact data. Thinner literature than vision, which is an opportunity.""",
  """<b>Touch-only and touch-primary control.</b> [[rotate-without-seeing]], [[omnitactune]]. Evidence that
  the signal is sufficient.""",
  """<b>Latent predictive architectures.</b> [[vjepa2]] and [[flare]] are the right backbones — predicting a
  latent that happens to be predictive of touch is far more tractable than generating tactile images.""",
  """<b>Force feedback in capture.</b> [[doglove]] collects demonstrations <em>with</em> force feedback at
  $600, which means the human's contact strategy is recorded rather than guessed.""",
 ],
 gap="""<p>As of mid-2026 the claim "nobody predicts contact" is no longer available — [[dream-tac]] and friends got
 there first, and you should cite them rather than compete with them on framing. Two openings survive, and
 both are sharper than the original idea. <b>First, the metric.</b> Every one of these papers evaluates on
 task success; none of them answers the question that would actually justify the architecture — does the
 model see the failure coming, and how early? <b>Second, the hand.</b> The 2026 tactile-WAM cluster runs on
 grippers and simple end-effectors. On a 20+ DOF hand the contact state is far higher-dimensional and the
 vision occlusion far worse, which is precisely where the argument for touch is strongest and where nobody
 has data.</p>
 <p>The formulation worth trying: a [[vjepa2]]-style joint-embedding predictive model over a <em>fused</em>
 vision-plus-tactile stream, where the training objective includes predicting the tactile latent one step
 ahead. Then evaluate it on the only thing that matters — <b>does it predict slip before it happens?</b></p>
 <p>That evaluation is the paper. "Our world model predicts contact events N milliseconds before they are
 visible in RGB" is a crisp, falsifiable, previously-unmeasured claim, and it does not require beating
 anyone on task success to be interesting.</p>""",
 plan=[
  """Instrument one GeoDex hand with [[anyskin]] or [[dexskin]]-style coverage. Prioritize calibration
  stability over resolution — you need the sensor to mean the same thing next month.""",
  """Collect a paired vision+touch dataset on deliberately slip-prone tasks: lifting a smooth object with
  marginal force, a slow pull-out-of-grasp, a re-grasp. Label slip events from the tactile stream itself.""",
  """Train a [[flare]]-style auxiliary predictive head on frozen visual features plus tactile, since it is
  far cheaper than a full [[dreamerv3]] and isolates the question you care about.""",
  """Headline experiment: slip prediction lead time, tactile-included versus vision-only, as a distribution
  not a single number. Report the false-positive rate too.""",
  """Only then close the loop — use the predicted contact latent as an observation for a re-grasp policy and
  measure whether recovery improves.""",
 ],
 risks=[
  """<b>Sensor drift makes the model unlearnable.</b> Optical gels change with wear and temperature. This
  kills more tactile projects than any modelling issue; it is why AnySkin's replaceability matters.""",
  """<b>Slip labels are ambiguous.</b> Defining ground-truth slip onset is genuinely hard. Settle the
  definition before collecting, with an external measurement (object-mounted marker) as arbiter.""",
  """<b>Scope creep into a full world model.</b> The auxiliary-head version answers the question. Resist
  building a generative tactile simulator first.""",
 ],
 read=[
  dict(id="rotate-without-seeing", why="The existence proof that contact alone carries enough state. Read first — it sets the ceiling."),
  dict(id="anyskin", why="The sensor property that makes tactile learning reproducible: swap a skin without recalibrating."),
  dict(id="dexskin", why="High-coverage conformable skin — fingertip-only sensing is not enough for a world model."),
  dict(id="vjepa2", why="The architecture to extend. Latent prediction, not pixel generation."),
  dict(id="flare", why="The cheap version: world modelling as an auxiliary loss. This is what to build first."),
  dict(id="robotacdex", why="Paired visual-tactile data for pretraining — check whether it covers your task regime."),
  dict(id="gelsight", why="Origin of vision-based tactile sensing; read for what the signal physically is."),
  dict(id="doglove", why="If you need human demonstrations with recorded contact, this is the $600 way."),
  dict(id="omnitactune", why="Recent tactile residual RL — the closest existing work to closing the loop."),
  dict(id="dream-tac", why="Read before anything else you write on this. It is your idea, published, on a Tac-UMI gripper."),
  dict(id="omnivta", why="The earliest of the 2026 visuo-tactile world-model cluster; the baseline the others compare to."),
  dict(id="vt-wam", why="Same target, different fusion. Read with Tactile-WAM to see what the architecture fight is actually about."),
  dict(id="tacforesight", why="Force-guided prediction — closest to the slip-before-it-is-visible framing you want."),
  dict(id="wt-umi", why="The hardware side: a tactile UMI driving whole-body manipulation."),
 ])

R["ego-dex"] = dict(
 why="""<p>Robot dexterity data is the scarcest resource in the field, and human hand data is one of the most
 abundant. The whole bet of this idea is that the exchange rate between them can be made good enough to
 matter. Everything hinges on the embodiment gap — the human hand has ~27 degrees of freedom, soft skin,
 tendon coupling and a lifetime of learned priors; your robot hand has none of that.</p>
 <p>Three strategies exist for closing that gap, and the field has not settled which wins: make the
 <em>hardware</em> match (exoskeleton adapters), make the <em>pixels</em> match (inpaint the robot into human
 video), or make the <em>representation</em> match (learn a shared action space). Each is a paper.</p>""",
 state="""<p><b>The data exists.</b> [[ego4d]] gives 3,670 hours of egocentric video; [[egoexo4d]] adds
 time-synchronized third-person views of the same skilled activity, which makes the ego-versus-exo question
 an experiment rather than an argument. [[open-aoe]] in your library is an open egocentric manipulation
 dataset shipped <em>with</em> its capture toolchain, which is the more useful artefact.</p>
 <p><b>Representation transfer was established first.</b> [[r3m]] showed that pretraining a frozen visual
 encoder on Ego4D cuts the number of robot demonstrations needed by roughly an order of magnitude. [[vip]]
 went further and extracted a dense reward function from human video. These are the safe, well-replicated
 results.</p>
 <p><b>Action transfer is where the current fight is.</b> [[egomimic]] puts Aria glasses on a human and
 co-trains with humanoid teleop by normalizing hand and robot action spaces into a common frame.
 [[humanoid-policy]] makes the same move at larger scale — one policy, human and humanoid data in the same
 batch. [[phantom]] takes the opposite and more audacious route: edit the human hand out of the video and
 paint the robot in, then train ordinary BC on the edited frames, with <em>zero</em> robot demonstrations.
 [[dexumi]] splits the difference with a wearable hand exoskeleton for kinematics plus video inpainting for
 appearance.</p>
 <p><b>And then the data got two orders of magnitude bigger.</b> Between November 2025 and April 2026,
 egocentric capture went from thousands of hours to a million: Build AI's Egocentric-1M
 (~1,000,000 h, 14,228 factory workers, 10.8 billion frames, Apache 2.0 on Hugging Face) after a
 10K → 100K → 1M ladder in five months, and Ropedia's Xperience-10M (10,000 h but with six synchronised
 RGB streams, stereo depth, SLAM pose and full hand-plus-body mocap — roughly a petabyte). See the Datasets
 tab for the full table.</p>
 <p><b>More importantly, the scaling question stopped being rhetorical.</b> [[egoscale]] (NVIDIA GEAR) trains
 a VLA on <b>20,854 hours</b> of action-labelled egocentric video and reports a <b>log-linear scaling law</b>
 between human data scale and validation loss, with that loss correlating with real-robot success. [[ego2robot]]
 supplies the missing conversion step — retarget, synthesise the robot into the pixels, curate — producing
 18,561 hours of robot training data across 15 morphologies. [[humannet]] pushes at the million-hour regime
 directly, and [[ace-ego-0]] reports the robot/sim/human mixing ratio almost nobody else publishes.</p>
 <p><b>But read [[humanego]] before you believe any of it.</b> Thirty minutes of human video per task gives
 92.5% success across four real tasks — beating matched-time robot teleoperation by 41%. If half an hour is
 enough for a task, then a million hours is buying <em>generality</em>, not competence, and those are very
 different research programmes.</p>
 <p><b>The area is now crowded and moving fast.</b> Your own M2 library already holds [[human-video-survey]]
 (2026), [[do-as-i-do]], [[simdex]] and [[c2dex]]. A live search adds [[egoengine]] (egocentric video to a
 simulatable scene to dexterous demonstrations), [[video2sim2real]] (one human video to a dexterous skill,
 end to end), [[realdexumi]] (a wearable UMI purpose-built for dexterous hands) and [[egodemogen]]
 (synthesising novel egocentric viewpoints so the policy stops memorising camera placement). Generic
 "learn dexterity from human video" is no longer a claimable contribution — you need a specific angle.</p>""",
 threads=[
  """<b>Representation pretraining.</b> [[r3m]], [[vip]], [[vjepa2]]. Reliable, incremental, well understood.""",
  """<b>Co-training with normalized action spaces.</b> [[egomimic]], [[humanoid-policy]]. Currently the most
  practical approach if you have <em>some</em> robot data.""",
  """<b>Pixel-level embodiment editing.</b> [[phantom]], [[dexumi]], and the video-diffusion inpainting work
  ([[dreamhand]] in your library). Zero robot data, but you inherit every artefact of the generative model.""",
  """<b>Hardware adapters.</b> [[dexumi]]'s exoskeleton, [[dexcap]]'s glove-plus-SLAM rig, [[ume]]'s
  whole-body exoskeleton. Sidesteps the gap by constraining the human instead.""",
  """<b>Retrieval rather than training on everything.</b> [[simdex]] mines similar egocentric clips for the
  task at hand — a cheap lever that most pipelines skip.""",
  """<b>Contact-consistent retargeting.</b> [[c2dex]] — see your separate learned-retargeting idea; it is
  the same problem viewed from the other end.""",
 ],
 gap="""<p>Given how crowded this has become, the defensible angle is not "learn dexterity from ego video" but
 <b>a controlled comparison of the three gap-closing strategies on the same hand, the same tasks and the same
 human data</b>. Nobody has run that — and the 2026 scaling results make it more valuable, not less, because
 [[egoscale]] tells you the curve exists without telling you <em>which transfer mechanism</em> that curve is
 a property of.</p>
 <p>There is a second, sharper opening the million-hour releases opened up: <b>nobody has characterised what
 kind of hours matter</b>. Egocentric-1M is a million hours of repetitive industrial labour; Xperience-10M is
 ten thousand hours with full mocap; [[humanego]] gets most of the way there on thirty minutes. Diversity,
 annotation depth and raw volume are three different axes and the field is currently conflating them.
 A study that holds total hours fixed and varies only diversity, or only annotation depth, would be cited
 by everyone building a capture programme. Every paper advocates its own strategy against weak versions of the
 others, so the field genuinely does not know whether hardware adapters, pixel editing or shared
 representations win, or under what conditions.</p>
 <p>You are unusually well placed to run it: GeoDex gives you the hand, [[egoexo4d]] gives you paired data,
 and your library already contains all three camps. A rigorous three-way ablation would be cited by everyone
 in the area, and it doubles as the groundwork for whichever strategy you then build on.</p>""",
 plan=[
  """Fix the substrate: one hand, one set of 5-8 tasks spanning power grasp to in-hand reorientation, one
  egocentric capture rig. Everything else varies.""",
  """Implement all three arms honestly: (a) [[r3m]]/[[vjepa2]] frozen-encoder pretraining + small robot
  dataset, (b) [[egomimic]]-style normalized-action co-training, (c) [[phantom]]-style inpainting with zero
  robot data.""",
  """Measure the exchange rate directly: how many robot demonstrations does each strategy save, as a curve,
  not a point. That curve is the contribution.""",
  """Add the failure analysis everyone omits — which task properties (contact richness, occlusion, force
  precision) break which strategy.""",
  """Read [[human-video-survey]] first and position against it explicitly; it will tell you what has already
  been claimed.""",
 ],
 risks=[
  """<b>Someone publishes the comparison first.</b> Real risk given the pace. Mitigate by scoping tightly to
  dexterous multi-finger tasks rather than general manipulation, where you have the hardware advantage.""",
  """<b>Inpainting artefacts confound the comparison.</b> The [[phantom]] arm's performance depends heavily
  on the video model. Report the inpainting quality separately so a reader can discount it.""",
  """<b>Hand mismatch dominates everything.</b> If your robot hand is kinematically far from a human hand,
  all three strategies degrade and you learn about your hardware, not the strategies. Argues for running this
  after the 22-DOF hand exists.""",
 ],
 read=[
  dict(id="human-video-survey", why="Read first. The most recent map of the area — it will give you the citation skeleton and tell you what is already taken."),
  dict(id="egomimic", why="The most practical co-training recipe; the action-space normalization is the part to copy."),
  dict(id="phantom", why="The zero-robot-data extreme. Cheap, slightly absurd, and it works — a required baseline."),
  dict(id="dexumi", why="The hardware-adapter answer, and the paper standing closest to your own plan."),
  dict(id="r3m", why="The reliable baseline. Anything you build must beat frozen-encoder pretraining."),
  dict(id="humanoid-policy", why="Scaled co-training; also relevant to MABEL."),
  dict(id="egoexo4d", why="The paired ego/exo data that makes your comparison possible."),
  dict(id="simdex", why="Retrieval instead of training on everything — a cheap win worth folding in."),
  dict(id="c2dex", why="Contact-consistent retargeting; connects this to your retargeting idea."),
  dict(id="dexcap", why="If you need to collect your own glove data, this is the portable rig."),
  dict(id="egoengine", why="2026. Egocentric video to a simulatable scene to dexterous demos — the pipeline, already built."),
  dict(id="realdexumi", why="2026. A wearable UMI for dexterous hands; the capture hardware is no longer the contribution."),
  dict(id="egodemogen", why="Cheap viewpoint augmentation any ego pipeline should include."),
  dict(id="egoscale", why="The scaling law. 20,854 hours, log-linear validation loss, correlated with real-robot success. Read this before planning any collection."),
  dict(id="ego2robot", why="How a million human hours become robot actions — retarget, synthesise, curate. 18,561 h across 15 morphologies."),
  dict(id="humanego", why="The counterargument: 30 minutes per task, 92.5% success, beating matched-time teleop. Take it seriously."),
  dict(id="ace-ego-0", why="The robot/sim/human mixing ratio, actually reported."),
  dict(id="egokit", why="If you collect your own rather than consume someone else's."),
 ])

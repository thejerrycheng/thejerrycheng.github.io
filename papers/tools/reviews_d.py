# -*- coding: utf-8 -*-
R = {}

R["transformer-robot"] = dict(
 why="""<p>A car that stands up and walks. The reason to take it seriously as research rather than as a stunt
 is that it is the cleanest instance of a problem the field has barely touched: <b>control through a change of
 topology</b>. Not a robot that reconfigures its joints, but one whose kinematic tree is genuinely different
 before and after — where the chassis becomes the torso and a structural panel becomes a limb.</p>
 <p>It is also honest work. The robot either stands up and walks or it does not, and no benchmark choice can
 hide the answer.</p>""",
 state="""<p><b>First, the distinction that matters.</b> The wheel-legged robots this gets confused with —
 [[x2n]], [[swheg]], [[reconfig-wheelleg]] — keep the same topology throughout: they are legged robots with
 wheels at the feet, and the "transformation" is a joint reconfiguration. [[x2n]] (April 2026) is the most
 advanced of these, with RL whole-body control spanning hybrid locomotion, reconfiguration and manipulation.
 Worth reading closely, but it is a different and easier problem than a car whose body opens into a humanoid.</p>
 <p><b>The real car ↔ humanoid machines exist, and every one of them scripts the transformation.</b>
 [[jdeite]] is the landmark: a 4 m rideable robot from BRAVE ROBOTICS, Asratec and Sansei that drives at
 60 kph on wheels and walks as a biped, converting in <b>about one minute</b> under Asratec's V-Sido
 controller. The conversion is quasi-static and open-loop, and the bipedal walking is slow and statically
 stable. [[letrons]] converts a drivable BMW into a 4.5 m robot that articulates arms and fingers but
 <b>does not walk</b> — which tells you where the difficulty actually is. [[robosen]] is the most
 under-appreciated reference here: a consumer product with 34 servos that converts <em>automatically</em>
 between a walking biped and a vehicle at roughly half a metre, proving the mechanism is tractable once you
 stop trying to build it at four metres.</p>
 <p><b>The modelling tool for a changing kinematic tree now exists.</b> [[changing-morph-dyn]] gives closed-form,
 singularity-free whole-body Lagrangian dynamics for legged robots whose morphology changes — each limb
 modelled independently and reassembled according to the current configuration, so you do not re-derive the
 dynamics per mode. [[var-topology-truss]] is the formal treatment of planning when members change role, which
 is the abstract version of a panel becoming a limb.</p>
 <p><b>One policy across changing bodies is a solved-ish architecture question.</b> [[gcnt]] is a graph
 transformer that accepts an arbitrary module count and generalises zero-shot to unseen morphologies;
 [[morph-hypernet]] distils morphology-conditioned hypernetworks so one network emits weights for whatever body
 it is handed, which is cheaper at inference — and inference cost matters when the policy runs on the robot.
 [[getup-morphologies]] is the proof this works in practice: one policy recovering seven different humanoids,
 transferring zero-shot at ~86%.</p>
 <p><b>Falling and getting up is now a real sub-field and you will need all of it.</b> [[humanup]] is the
 reference getting-up result. [[unirelo]] unifies recovery and locomotion into one policy rather than bolting
 them together — directly relevant to counting policies. [[fall-safety]] does the under-studied half, falling
 <em>well</em>, from a few demonstrations. [[stablemimic]] handles structured post-fall behaviour when a
 tracking policy leaves its distribution, and [[kungfu-bot]] contributes a balance-challenging dynamic motion
 dataset with autonomous fall-resilient tracking.</p>
 <p><b>And for actually building it:</b> [[berkeley-humanoid-lite]] (printable, ~$5k, printed cycloidal
 gearboxes), [[toddlerbot]] (small, repairable, sim-fidelity-first), [[disney-bdx]] (expressive motion on a real
 biped), and [[mit-cheetah]] for the actuator argument that dominates everything.</p>""",
 threads=[
  """<b>Topology change vs joint reconfiguration.</b> [[jdeite]], [[letrons]], [[robosen]] on one side;
  [[x2n]], [[swheg]] on the other. Know which problem you are solving.""",
  """<b>Dynamics of a changing kinematic tree.</b> [[changing-morph-dyn]], [[var-topology-truss]],
  [[opt-legged-control]].""",
  """<b>One policy, many bodies.</b> [[gcnt]], [[morph-hypernet]], [[getup-morphologies]],
  [[cross-humanoid-wbc]].""",
  """<b>Falling and recovering.</b> [[humanup]], [[unirelo]], [[fall-safety]], [[stablemimic]],
  [[kungfu-bot]].""",
  """<b>Compressing behaviours into few policies.</b> [[hover]] and [[maskedmimic]] — masked training and
  distillation are how several behaviours fit in one network.""",
  """<b>Buildable small platforms.</b> [[berkeley-humanoid-lite]], [[toddlerbot]], [[robosen]],
  [[mit-cheetah]].""",
 ],
 gap="""<p>The machines exist; the <em>control</em> does not. Every real car ↔ humanoid robot converts with a
 scripted, open-loop, quasi-static sequence — J-deite takes sixty seconds. Two claims follow, and the second is
 the one worth chasing.</p>
 <p><b>1. Closed-loop, dynamic transformation.</b> A morphology-conditioned policy that controls the robot
 <em>continuously through</em> the topology change: balance maintained across the transition, the contact set
 migrating from four wheels through multi-contact to two feet, and the manoeuvre abortable and reversible
 partway. Target under two seconds against J-deite's sixty. [[changing-morph-dyn]] gives you the model,
 [[gcnt]]/[[morph-hypernet]] give the policy architecture, and nobody has put them together on a
 topology-changing machine.</p>
 <p><b>2. Transformation as a recovery primitive.</b> This is the part nobody has. Every getting-up paper treats
 a fallen posture as something to escape by learning a get-up trajectory for it, and the long tail of postures
 is exactly where those policies fail. A transforming robot has a second option: <em>fold into the wheeled form,
 right itself, unfold</em>. That converts the morphology change from a feature into a controller primitive, and
 it may be dramatically more reliable than posture-specific get-up across the tail. Compare it head-to-head
 against [[humanup]]-style recovery on the same hardware and the same fallen-posture distribution. If it wins,
 it is a clean and slightly delightful result; if it loses, the failure analysis is still worth publishing.</p>
 <p><b>And the systems question underneath both:</b> the <b>policy budget</b>. Every paper here reports what its
 robot can do; none reports how many policies it took or what merging them costs. For a small robot with a small
 compute budget that is the binding constraint, and [[hover]]/[[maskedmimic]] give you the method to measure it.</p>""",
 plan=[
  """Read [[jdeite]] and [[robosen]] before drawing anything, and be clear with yourself that you are solving
  the control problem, not the mechanism problem — the mechanism is demonstrated.""",
  """<b>Build small.</b> [[robosen]] scale (~0.5 m) or [[berkeley-humanoid-lite]] scale, printed, off-the-shelf
  quasi-direct-drive actuators. A transforming robot falls constantly during development and four metres of it
  falling is a research programme in itself.""",
  """Fix the actuator double-duty problem in the design phase: driving wants high speed and low torque,
  standing wants the opposite. Either two actuators (mass) or a transmission (complexity) — decide early,
  because it determines everything downstream. [[mit-cheetah]] is the reference.""",
  """Get driving and walking working as separate policies first in Isaac Lab ([[rudin2021]]). Do not attempt
  the transition until both endpoints are solid.""",
  """Model the transition with [[changing-morph-dyn]] and train the transformation policy with the morphology
  parameter in the observation, [[getup-morphologies]]-style. Reward: stay within the support polygon through
  the contact-set migration, and finish in under two seconds.""",
  """<b>Headline experiment:</b> drop the robot into N randomised fallen postures and compare a learned get-up
  policy against fold-to-wheeled-and-right-yourself. Report success rate, time and energy for each, and the
  postures where each one fails.""",
  """<b>Systems result:</b> distil the specialists into one masked policy ([[hover]]-style) and measure exactly
  what each behaviour loses. That is the number the field is missing.""",
 ],
 risks=[
  """<b>The mechanism eats the year.</b> Transforming joints carry reversed structural loads and a printed
  version will break. Budget three revisions and keep a non-transforming fallback that still walks, so the
  learning work is never blocked on the hardware.""",
  """<b>Sim-to-real across a changing kinematic chain.</b> Contact and inertia both change mid-manoeuvre, which
  is where simulators are least trustworthy. [[asap]]-style delta-action correction is the escape hatch, and
  [[wheeled-payload]]'s real-to-sim equilibrium estimation is the closest precedent for a body whose plant
  changes.""",
  """<b>Packaging.</b> Everything must fold into a car silhouette, which leaves no room for conventional
  actuator placement. This is the constraint that makes the design genuinely hard and the reason [[robosen]]'s
  packaging is worth studying line by line.""",
  """<b>It reads as a demo.</b> Transforming robots are charismatic, which cuts both ways. The
  recovery-by-transformation comparison and the policy-budget measurement are what make it a paper rather than
  a video.""",
 ],
 read=[
  dict(id="jdeite", why="The landmark: a real 4 m car↔humanoid that walks and drives. Sixty-second scripted conversion — that is what you are beating."),
  dict(id="robosen", why="Automatic conversion of a walking biped at half a metre. The scale to build at, and a packaging masterclass."),
  dict(id="changing-morph-dyn", why="Whole-body dynamics for a robot whose kinematic tree changes. The modelling tool."),
  dict(id="getup-morphologies", why="One policy recovering seven bodies, zero-shot to unseen ones. Your morphology conditioning."),
  dict(id="humanup", why="The reference getting-up result, and the baseline the fold-and-right idea must beat."),
  dict(id="gcnt", why="Graph-transformer policy for arbitrary morphologies — the architecture for a changing body."),
  dict(id="morph-hypernet", why="The cheaper inference-time alternative, which matters for on-board compute."),
  dict(id="unirelo", why="Recovery and locomotion in one policy — directly relevant to the policy-budget question."),
  dict(id="hover", why="Masked training to compress several behaviours into one network."),
  dict(id="x2n", why="The wheel-legged cousin. Read to be precise about how your problem differs."),
  dict(id="mit-cheetah", why="Actuator selection dominates. Settle the double-duty problem before geometry."),
  dict(id="berkeley-humanoid-lite", why="Printable, cheap, buildable — the platform to base the hardware on."),
 ])

R["robot-dj"] = dict(
 why="""<p>Turntablism is an unusually good robotics benchmark hiding inside a fun idea. It demands continuous
 force regulation against a <em>moving</em> surface, bimanual coordination where the two hands have completely
 different jobs (one works the platter, one works the crossfader), timing precision in the tens of
 milliseconds, and — the property that makes it worth building — <b>the task's own output is a dense,
 objective, real-time evaluation signal</b>.</p>
 <p>Every other contact-rich benchmark needs an external judge: did the peg seat, did the cloth fold. Here the
 robot's actions produce sound, the sound can be compared to a target, and that comparison is available at
 audio rate with no human and no instrumentation. That is rare enough to build a benchmark around.</p>""",
 state="""<p><b>Audio as a robot modality is well established — and it is always used the same way.</b>
 [[maniwav]] is closest to your setup: an <em>ear-in-hand</em> contact microphone on a UMI-style handheld
 gripper, collecting audio-visual demonstrations in the wild and learning policies directly from them.
 [[hearing-touch]] does audio-visual pretraining with piezo contact mics and reports the finding that matters
 here — sound helps most in the <b>low-data</b> regime and under texture change. [[sonicsense]] (Duke) puts a
 contact microphone in <em>every fingertip</em> of a four-finger hand and recovers material, contents and 3D
 shape from tapping and shaking. [[audio-vla]] folds contact audio into a VLA backbone. [[vibecheck]] goes
 active — inject a vibration and listen to the response rather than waiting for the task to make noise.
 [[miccheck]] shows the whole sensing stack can be off-the-shelf pin microphones for a few dollars.</p>
 <p><b>Fusion has a reference study and a representation trick.</b> [[see-hear-feel]] remains the cleanest
 account of when vision, touch and audio each actually contribute. [[robot-synesthesia]] contributes the idea
 worth copying: project the modalities into a <em>shared 3D space</em> rather than concatenating their feature
 vectors. [[av-contact]] estimates <b>extrinsic</b> contact — where the held object meets the world, not where
 the hand meets the object — from vision and sound together, which for a stylus riding a groove is the entire
 state estimation problem.</p>
 <p><b>The music-side literature is where your evaluation comes from, and roboticists never read it.</b>
 [[dj-mix-analysis]] (ISMIR 2020) aligns real DJ mixes back to their source tracks to recover cue points,
 transition lengths, mix segmentation and the musical edits the DJ made. It is the only body of work that
 quantifies <em>what a DJ did</em> rather than whether a listener enjoyed it. Alongside it sits the
 <b>Turntablist Transcription Methodology</b> (TTM, 2000) — a gridded staff notation for scratches encoding
 record position, hand motion and crossfader state, and the de-facto standard among turntablists. TTM is the
 piece that turns this from a demo into a benchmark, because it gives you a <em>score</em>: a written target
 the robot can be asked to perform and measured against.</p>
 <p><b>Hardware for the contact side is ready.</b> [[dexskin]] for conformable coverage, [[anyskin]] for
 sensors you can replace without recalibrating, [[doglove]] if you want force-feedback human demonstrations,
 and [[falcon]]'s external-force curriculum for the control problem of pushing against something that pushes
 back.</p>
 <p><b>What does not exist anywhere:</b> robot learning where audio is the <em>objective</em>. In every paper
 above, sound is an input used to infer a state that some other signal scores. Musical robotics has the
 objective — Shimon and the marimba-playing lineage at Georgia Tech — but those systems strike discrete notes
 under scripted or planned control, rather than modulating continuous friction against a moving platter.</p>""",
 threads=[
  """<b>Contact microphones as sensors.</b> [[sonicsense]], [[miccheck]], [[vibecheck]]. A piezo disc costs a
  dollar — the cheapest new modality you can add to a hand.""",
  """<b>Policies learned from audio.</b> [[maniwav]], [[hearing-touch]], [[audio-vla]].""",
  """<b>Multimodal fusion.</b> [[see-hear-feel]] for when each modality helps, [[robot-synesthesia]] for how to
  combine them, [[av-contact]] for extrinsic contact.""",
  """<b>Force against a moving surface.</b> [[falcon]]'s force curriculum, [[force-grasp-s2r]], and the
  contact-rich RL literature.""",
  """<b>Evaluation from music information retrieval.</b> [[dj-mix-analysis]], plus TTM notation and the beat
  tracking / onset detection literature. This is the half that makes it measurable.""",
  """<b>In-the-wild capture with sound.</b> [[maniwav]]'s ear-in-hand rig, worn by an actual DJ, generates
  exactly the demonstrations you need.""",
 ],
 gap="""<p>The novel claim is structural rather than incremental: <b>turntablism is the first manipulation task
 where the reward and the observation are the same modality</b>. The policy acts, the action makes sound, and
 the sound is simultaneously what it observes and what it is scored on. That buys three things no other
 contact-rich benchmark has:</p>
 <ul>
 <li><b>No reward instrumentation.</b> The blocker that kills most real-world RL projects — building a reliable
 automatic success detector — simply is not present. That connects this directly to your real-world RL harness
 idea: this is a task that can run unattended overnight.</li>
 <li><b>A dense, continuous reward at audio rate</b> rather than a sparse success bit at episode end.</li>
 <li><b>An evaluation any human can judge instantly</b>, which makes listening studies cheap and honest.</li>
 </ul>
 <p>On top of that it forces three things the dexterity benchmarks avoid: regulating normal force against a
 <em>moving</em> surface with a real friction budget; timing where being 30 ms early is exactly as wrong as
 being 30 ms late; and bimanual asymmetry with a hard real-time coupling between the hands.</p>""",
 diagram=dict(
   title="System flow",
   caption="Three loops at three rates. The inner impedance loop keeps the stylus alive; the policy runs at "
           "control rate; the reward closes over audio and needs no human. Dashed path is training-time only.",
   svg="""<svg viewBox="0 0 980 560" role="img" aria-label="Robot DJ system flow chart">
 <defs>
  <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
   <path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker>
 </defs>
 <style>
  .bx{fill:var(--panel);stroke:var(--line);stroke-width:2;rx:8}
  .bx2{fill:var(--bone);stroke:var(--line-soft);stroke-width:1.5;rx:7}
  .hi{fill:var(--yellow);stroke:var(--line);stroke-width:2;rx:8}
  .t{font:600 13px var(--font-sans);fill:var(--ink)}
  .s{font:400 11px var(--font-mono);fill:var(--ash)}
  .lb{font:700 10px var(--font-mono);fill:var(--imp);letter-spacing:.06em}
  .ln{stroke:currentColor;stroke-width:2;fill:none;marker-end:url(#ah);color:var(--line)}
  .dash{stroke-dasharray:6 5}
 </style>
 <!-- world -->
 <rect class="bx" x="18" y="26" width="196" height="96"/>
 <text class="t" x="34" y="52">Turntable + mixer</text>
 <text class="s" x="34" y="72">belt drive · crossfader</text>
 <text class="s" x="34" y="88">line-out, not a room mic</text>
 <text class="s" x="34" y="104">scratch record, cheap stylus</text>
 <!-- sensing -->
 <rect class="bx" x="18" y="156" width="196" height="150"/>
 <text class="lb" x="34" y="180">SENSING</text>
 <text class="s" x="34" y="200">line-out audio  48 kHz</text>
 <text class="s" x="34" y="218">fingertip piezo ×4</text>
 <text class="s" x="34" y="236">wrist force/torque  1 kHz</text>
 <text class="s" x="34" y="254">wrist camera  platter angle</text>
 <text class="s" x="34" y="272">joint encoders</text>
 <text class="s" x="34" y="292">crossfader position</text>
 <!-- encoders -->
 <rect class="bx2" x="266" y="156" width="186" height="150"/>
 <text class="lb" x="280" y="180">REPRESENTATION</text>
 <text class="s" x="280" y="200">log-mel, 10 ms hop</text>
 <text class="s" x="280" y="218">contact spectrogram</text>
 <text class="s" x="280" y="236">force / velocity</text>
 <text class="s" x="280" y="256">→ shared 3D latent</text>
 <text class="s" x="280" y="274">  (Robot Synesthesia)</text>
 <text class="s" x="280" y="294">audio enc. pretrained</text>
 <!-- policy -->
 <rect class="hi" x="504" y="156" width="196" height="150"/>
 <text class="lb" x="520" y="180" style="fill:#8a4a10">POLICY   50–100 Hz</text>
 <text class="t" x="520" y="204" style="fill:#151820">flow-matching head</text>
 <text class="s" x="520" y="224" style="fill:#3a3320">action chunk, 200 ms</text>
 <text class="s" x="520" y="242" style="fill:#3a3320">out: fingertip wrench</text>
 <text class="s" x="520" y="260" style="fill:#3a3320">     platter torque ref</text>
 <text class="s" x="520" y="278" style="fill:#3a3320">     crossfader position</text>
 <text class="s" x="520" y="296" style="fill:#3a3320">cond: bar phase, score</text>
 <!-- low level -->
 <rect class="bx" x="752" y="156" width="210" height="150"/>
 <text class="lb" x="768" y="180">LOW LEVEL   1 kHz</text>
 <text class="s" x="768" y="202">impedance control</text>
 <text class="s" x="768" y="220">normal-force regulation</text>
 <text class="s" x="768" y="238">hard force ceiling</text>
 <text class="s" x="768" y="258">(protects the stylus —</text>
 <text class="s" x="768" y="276">below the policy, not</text>
 <text class="s" x="768" y="294">inside it)</text>
 <!-- reward -->
 <rect class="bx" x="266" y="378" width="434" height="144"/>
 <text class="lb" x="282" y="402">REWARD   no human, no instrumentation</text>
 <text class="s" x="282" y="424">multi-resolution STFT distance to target audio</text>
 <text class="s" x="282" y="442">+ onset-timing alignment  (|Δt| in ms)</text>
 <text class="s" x="282" y="460">+ beat/phase F-measure against the click</text>
 <text class="s" x="282" y="478">− force penalty, − stylus-skip penalty</text>
 <text class="s" x="282" y="498">reward available every 10 ms → dense, unattended</text>
 <!-- target -->
 <rect class="bx2" x="752" y="378" width="210" height="144"/>
 <text class="lb" x="768" y="402">TARGET</text>
 <text class="s" x="768" y="424">TTM-notated score</text>
 <text class="s" x="768" y="442">or reference recording</text>
 <text class="s" x="768" y="462">baby · tear · chirp</text>
 <text class="s" x="768" y="480">flare · crab · transformer</text>
 <text class="s" x="768" y="500">+ tempo, bar grid</text>
 <!-- arrows -->
 <path class="ln" d="M116 122 L116 152"/>
 <path class="ln" d="M214 231 L262 231"/>
 <path class="ln" d="M452 231 L500 231"/>
 <path class="ln" d="M700 231 L748 231"/>
 <path class="ln" d="M857 306 L857 340 L240 340 L240 74 L214 74"/>
 <text class="s" x="470" y="334">actuation → the robot makes a sound</text>
 <path class="ln" d="M116 306 L116 450 L262 450"/>
 <text class="s" x="126" y="372">produced audio</text>
 <path class="ln dash" d="M700 450 L748 450" style="color:var(--hi)"/>
 <path class="ln dash" d="M483 378 L483 330 L560 330 L560 310" style="color:var(--hi)"/>
 <text class="s" x="496" y="366" style="fill:var(--hi)">gradient / RL update (training only)</text>
</svg>"""),
 plan=[
  """<b>Rig.</b> Belt-drive turntable (torque you can fight without destroying it), dexterous hand with a
  [[sonicsense]]-style piezo in each fingertip, a [[miccheck]] pin mic on the tonearm, wrist F/T, and a wrist
  camera for platter angle. Take audio from the <b>mixer line-out</b>, never a room microphone — you want the
  signal the task produces, not the room's opinion of it.""",
  """<b>Representation.</b> Log-mel at 10–20 ms hop for the policy; keep the raw waveform for the reward. Fuse
  with vision and force via [[robot-synesthesia]]'s shared-space trick rather than feature concatenation, and
  pretrain the audio encoder [[hearing-touch]]-style on unlabelled scratching before any policy training.""",
  """<b>Reward.</b> Multi-resolution STFT distance to the target (borrowed from neural vocoders, because it is
  differentiable and perceptually reasonable), plus an onset-alignment term from onset detection, plus a force
  penalty and a stylus-skip penalty. Build and validate this <em>first</em> — everything downstream is
  standard, and this is the piece that is actually novel.""",
  """<b>Method: three stages.</b> (1) Human demonstrations with a [[maniwav]]-style ear-in-hand rig worn by a
  real DJ — scratch motions are highly stereotyped, so a few hundred should go far. (2) Behaviour cloning with
  a <b>flow-matching</b> action head ([[manflow]]) rather than diffusion, because the loop budget is ~20 ms and
  a denoising chain will not fit. (3) Residual RL on the real rig ([[pld]], [[hil-serl]]) against the spectral
  reward — which needs no human, so it can run unattended.""",
  """<b>Curriculum.</b> Baby scratch → forward/reverse → tear → chirp (crossfader cuts) → flare → transformer,
  then two-deck beat-matching, which adds tempo estimation and a second platter.""",
  """<b>Ablations that make it a paper.</b> audio-in-observation vs vision-only; audio-in-reward-only vs both;
  force sensing on/off; and the one that tests the actual claim — does having reward and observation in the
  <em>same</em> modality improve sample efficiency versus the identical task scored by an external judge?""",
 ],
 metrics=dict(
   title="What makes a good DJ — three tiers of metric",
   tiers=[
     dict(name="Tier 1 · Objective and automatic (per technique)",
          items=[
       "<b>Onset timing error.</b> Mean |Δt| between produced and target onsets, and the fraction landing "
       "within ±10 ms. Trained listeners reliably detect rhythmic error around 20 ms, so ±10 ms is the bar.",
       "<b>Beat / phase F-measure.</b> Standard beat-tracking F-measure of the produced audio against the "
       "reference click — the MIR community's metric, directly reusable.",
       "<b>Spectral distance.</b> Multi-resolution STFT loss against a reference performance of the same "
       "notated pattern. Doubles as the training reward.",
       "<b>Fréchet Audio Distance.</b> Distributional, reference-free, against a corpus of human scratches — "
       "catches 'technically aligned but sounds wrong' in a way per-onset metrics cannot.",
       "<b>Platter velocity tracking.</b> Variance of hand-imposed platter velocity during a held note. This "
       "is the pure motor-control number, isolated from musical judgement.",
       "<b>Crossfader gate accuracy.</b> Fraction of cuts opening and closing inside the intended window — "
       "the bimanual-coordination number.",
       "<b>Damage rate.</b> Stylus skips and excess-force events per minute. A policy that scores well and "
       "destroys records has not solved the task.",
     ]),
     dict(name="Tier 2 · Musical, from the turntablism literature",
          items=[
       "<b>TTM score-following.</b> The Turntablist Transcription Methodology gives a written notation for "
       "scratches (record position, hand, crossfader). Define a task suite as TTM scores, have the robot "
       "perform them, transcribe the output audio back to TTM, and score the edit distance. This is a clean, "
       "objective, musically meaningful benchmark that does not exist for robots and would be the paper's "
       "central artefact.",
       "<b>Technique taxonomy coverage.</b> Report per-technique success across the standard vocabulary — "
       "baby, forward, chirp, tear, flare, crab, transformer, orbit — rather than one aggregate number. They "
       "stress different capabilities: chirp and transformer are crossfader-dominant, flare and crab are "
       "bimanual, tear is pure platter control.",
       "<b>Mix-level metrics.</b> For the beat-matching half, [[dj-mix-analysis]]'s mix-to-track alignment "
       "recovers cue points, transition length and segmentation from a produced mix — giving objective "
       "measures of transition quality against how human DJs actually do it.",
       "<b>Tempo robustness.</b> Hold the pattern, sweep the BPM. Where does it break? Human turntablists "
       "degrade gracefully; a policy overfit to one tempo will not.",
     ]),
     dict(name="Tier 3 · Human judgement (the only ground truth for 'good')",
          items=[
       "<b>MUSHRA-style listening test.</b> Robot performance against human DJs of varying skill and a hidden "
       "anchor, on the same notated pattern at the same tempo. This is the standard audio-quality protocol "
       "and it transfers directly.",
       "<b>Pairwise preference with expert DJs.</b> Cheaper than MUSHRA and better suited to 'which of these "
       "two is better', which is the question that actually matters.",
       "<b>Turing test.</b> Can turntablists tell robot from human above chance, per technique? Reporting the "
       "techniques where they cannot is a stronger result than any aggregate score.",
       "<b>Correlation study.</b> Regress the Tier-1 automatic metrics against Tier-3 human preference. If "
       "spectral distance plus onset timing predicts expert preference well, you have contributed an "
       "<em>automatic evaluator</em> for the whole area — arguably more valuable than the policy.",
     ]),
   ]),
 risks=[
  """<b>It reads as a novelty act.</b> The defence is the benchmark framing — same-modality reward, force
  against a moving surface, millisecond timing, TTM score-following. Lead with that, not with the music.""",
  """<b>Latency.</b> Meaningful audio feedback means the whole perception-action loop must fit in roughly
  20 ms. A diffusion head will not; use [[manflow]] or [[consistency-policy]], or run the reward off-policy.""",
  """<b>Hardware wear.</b> Styluses and records are consumables and a bad policy eats both quickly. Cheap
  cartridge, scratch-specific record, and a hard force ceiling <em>below</em> the policy in the control stack.""",
  """<b>The reward is gameable.</b> Spectral distance can be satisfied by scraping in a way that sounds roughly
  right and ruins the record. Keep the force penalty, the skip counter, and a human listening check in the
  evaluation — and report the gaming attempts you found, because they are interesting.""",
  """<b>Musicians may disagree with the metric.</b> Good turntablism has expressive timing that deliberately
  sits off the grid. That is why Tier 3 exists and why the correlation study matters — if your automatic
  metrics anti-correlate with expert preference, that is a finding, not a failure.""",
 ],
 read=[
  dict(id="maniwav", why="Read first. Ear-in-hand contact mic on a UMI-style gripper, policies learned from in-the-wild audio-visual data — the capture rig you want."),
  dict(id="dj-mix-analysis", why="Where your evaluation comes from. The only literature that quantifies what a DJ actually did."),
  dict(id="sonicsense", why="A contact microphone in every fingertip. The hardware pattern for a dexterous audio hand, and it is cheap."),
  dict(id="hearing-touch", why="Audio-visual pretraining, and the finding that sound helps most in low-data and under texture change."),
  dict(id="see-hear-feel", why="When each modality actually helps. Read before designing the fusion."),
  dict(id="robot-synesthesia", why="Fuse modalities in a shared 3D space instead of concatenating features."),
  dict(id="av-contact", why="Extrinsic contact from vision plus sound — stylus-on-record is exactly that problem."),
  dict(id="vibecheck", why="Active acoustic sensing. The platter is already vibrating, so the probe is free."),
  dict(id="manflow", why="Flow matching, because a diffusion head will not fit inside a 20 ms loop."),
  dict(id="audio-vla", why="The baseline once the hand exists: does audio survive being fed to a large pretrained action model?"),
  dict(id="miccheck", why="Pin microphones as contact sensors. Build this in an afternoon before designing anything custom."),
  dict(id="falcon", why="Force regulation with an explicit curriculum — the platter pushes back."),
  dict(id="hil-serl", why="The real-world RL loop this ends in — and here the reward needs no instrumentation."),
 ])

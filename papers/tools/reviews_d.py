# -*- coding: utf-8 -*-
R = {}

R["transformer-robot"] = dict(
 why="""<p>Two morphologies, one machine: wheels when the ground is flat and speed matters, legs when it is not.
 The appeal is that it is a <em>whole-stack</em> project — mechanism, actuator selection, several policies, and
 the transitions between them — which is exactly the kind of thing that is hard to do well and therefore hard
 to be scooped on in its entirety.</p>
 <p>It is also the most honest kind of robotics project: the robot either stands up after it falls or it does
 not, and no benchmark choice can hide the answer.</p>""",
 state="""<p><b>Start by reading the paper that already did most of it.</b> [[x2n]] (April 2026) is a high-DOF
 transformable wheel-legged humanoid that reconfigures between a humanoid and a wheeled vehicle by joint
 reconfiguration, with a single RL whole-body control framework spanning hybrid locomotion, the transformation,
 and manipulation. The mechanism and the mode-switch are taken. Knowing that up front is worth more than a
 month of design work.</p>
 <p><b>The mechanism literature is older and useful.</b> [[swheg]] is the important one: a wheel-leg
 transformable robot that reconfigures with a <em>single extra actuator per wheel</em>. That is the design
 discipline to copy — a transformation that costs one actuator, not a second robot. [[reconfig-wheelleg]] is a
 further design point.</p>
 <p><b>Falling and getting up is now a real sub-field, and you will need all of it.</b> [[humanup]] is the
 reference: learned policies that stand a real humanoid back up from varied fallen configurations, later
 extended to slippery and inclined terrain. [[getup-morphologies]] trains <em>one</em> policy that recovers
 seven different humanoids and transfers zero-shot to unseen morphologies at ~86% — directly relevant, because
 a transforming robot is a robot whose morphology changes underneath the policy. [[unirelo]] unifies fall
 recovery and locomotion in one policy rather than bolting them together. [[fall-safety]] does the
 under-studied half — falling <em>well</em> — and [[stablemimic]] handles structured post-fall behaviour when a
 tracking policy leaves its training distribution. [[kungfu-bot]] contributes a balance-challenging dynamic
 motion dataset with autonomous fall-resilient tracking.</p>
 <p><b>Morphology change with learning in the loop has precedent.</b> [[dyret]] is a quadruped that physically
 changes its own leg lengths and evolves morphology in the real world — the closest thing to a robot whose body
 is a control variable. [[cross-humanoid-wbc]] and [[hugwbc]] show how far a single controller can stretch
 across bodies and gaits.</p>
 <p><b>And the cheap-platform lineage matters for actually building it.</b> [[berkeley-humanoid-lite]]
 (printable, ~$5k, printed cycloidal gearboxes), [[toddlerbot]] (small, repairable, sim-fidelity-first), and
 [[disney-bdx]] (expressive motion on a real biped) are the three builds to study before cutting metal. The
 Open-Duck-class machines you mentioned sit in this family: small, cheap, a handful of policies on board.</p>""",
 threads=[
  """<b>Transformable mechanisms.</b> [[x2n]], [[swheg]], [[reconfig-wheelleg]]. Read for actuator count, not
  for the learning.""",
  """<b>Getting up.</b> [[humanup]], [[getup-morphologies]], [[unirelo]] — and note the trend towards
  <em>one</em> policy covering recovery and locomotion.""",
  """<b>Falling well.</b> [[fall-safety]], [[stablemimic]], [[kungfu-bot]]. Cheaper than replacing hardware and
  much less studied than getting up.""",
  """<b>One controller, many bodies.</b> [[cross-humanoid-wbc]], [[hugwbc]], [[hover]], [[maskedmimic]] — the
  masking and distillation tricks are how you fit several behaviours into one network.""",
  """<b>Buildable small humanoids.</b> [[berkeley-humanoid-lite]], [[toddlerbot]], [[disney-bdx]],
  [[mit-cheetah]] for the actuator argument.""",
  """<b>Morphology as a variable.</b> [[dyret]], [[transform2act]], [[derl]].""",
 ],
 gap="""<p>Given [[x2n]], "build a transforming wheel-legged humanoid" is no longer the contribution. Two
 narrower claims survive, and the second is the good one.</p>
 <p><b>The policy budget.</b> Every paper in this area reports what its robot can do; none reports how many
 policies it took, or what is lost by merging them. For a small robot with a small compute budget, that is the
 binding engineering constraint. A study that measures the cost of compression — one policy for
 drive/walk/transform/recover versus four specialists, on the same hardware, with the same total parameters —
 is a genuinely useful systems result, and [[hover]] and [[maskedmimic]] give you the method.</p>
 <p><b>Transformation as a recovery action.</b> This is the part nobody has. Every getting-up paper treats the
 fallen posture as something to escape by learning a get-up trajectory for it. A transforming robot has a
 second option: <em>fold into the wheeled form, right itself, and unfold</em>. That turns the morphology change
 from a mode switch into a controller primitive, and it may be far more reliable than a get-up policy for the
 long tail of postures nobody trained on. Neither [[x2n]] nor any of the recovery papers does this. If it
 works, it is a clean, demonstrable, slightly delightful result; if it does not, the failure analysis is still
 publishable.</p>""",
 plan=[
  """Read [[x2n]] and [[swheg]] before drawing anything. Fix the actuator count for the transformation first —
  if it is more than one or two extra actuators per limb, the design is wrong.""",
  """Build small. [[berkeley-humanoid-lite]] scale, printed, with off-the-shelf quasi-direct-drive actuators.
  A transforming robot will fall a great deal during development and you want that to be cheap.""",
  """Get walking and driving working as separate policies first, in Isaac Lab ([[rudin2021]] parallel training).
  Do not attempt the transformation until both endpoints are solid.""",
  """Train the transformation as its own policy with the morphology parameter in the observation — this is
  where [[getup-morphologies]]'s cross-morphology conditioning transfers directly.""",
  """Then the headline experiment: <b>fall from N random postures</b> and compare a learned get-up policy
  against fold-to-wheeled-and-right-yourself. Report success rate, time, and energy for both.""",
  """Finally the compression study: distil the specialists into one masked policy ([[hover]]-style) and measure
  what each behaviour loses.""",
 ],
 risks=[
  """<b>The mechanism eats the year.</b> Transforming joints are mechanically demanding and a printed version
  will break. Budget for three revisions and keep a non-transforming fallback that still walks.""",
  """<b>Sim-to-real for a changing kinematic chain.</b> Contact and inertia both change mid-transformation,
  which is exactly where simulators are least reliable. [[asap]]-style delta-action correction is the escape
  hatch, and [[wheeled-payload]]'s real-to-sim equilibrium estimation is the closest precedent.""",
  """<b>It reads as a demo.</b> Transforming robots are charismatic, which cuts both ways. The policy-budget
  measurement and the recovery-by-transformation comparison are what make it a paper rather than a video.""",
 ],
 read=[
  dict(id="x2n", why="Read first. It is your idea, built, in April 2026 — and it tells you exactly what is left."),
  dict(id="getup-morphologies", why="One policy recovering seven bodies, zero-shot to unseen ones. The cross-morphology conditioning you need."),
  dict(id="humanup", why="The reference getting-up result, and the baseline your fold-and-right idea must beat."),
  dict(id="swheg", why="Transformation for one extra actuator. The mechanical discipline."),
  dict(id="unirelo", why="Recovery and locomotion unified in one policy — directly relevant to the policy-budget question."),
  dict(id="hover", why="How to compress several behaviours into one policy via masked training."),
  dict(id="berkeley-humanoid-lite", why="The buildable, printable, cheap platform to base the hardware on."),
  dict(id="fall-safety", why="Falling well. Under-studied, and your robot will do a lot of it."),
  dict(id="mit-cheetah", why="Actuator selection dominates dynamic performance. Settle this before geometry."),
  dict(id="dyret", why="A robot whose morphology is a real-world control variable — the closest precedent."),
 ])

R["robot-dj"] = dict(
 why="""<p>Turntablism is an unusually good robotics benchmark hiding inside a fun idea. It demands continuous
 force regulation against a <em>moving</em> surface, bimanual coordination with completely different roles per
 hand (one scratches, one rides the crossfader), timing precision in the tens of milliseconds, and — the part
 that makes it special — <b>the task's own output is a dense, objective, real-time evaluation signal</b>.</p>
 <p>Every other contact-rich benchmark needs an external judge: did the peg go in, did the cloth fold. Here the
 robot's actions produce sound, the sound can be compared to a target, and the comparison is differentiable-ish
 and available at audio rate. That is a rare property and it is the reason to take this seriously rather than
 treat it as a stunt.</p>""",
 state="""<p><b>Audio as a robot modality is established, and it is always used the same way.</b> [[maniwav]] is
 the paper closest to your setup: an <em>ear-in-hand</em> contact microphone on a UMI-style handheld gripper,
 collecting audio-visual demonstrations in the wild and learning policies directly from them. [[hearing-touch]]
 does audio-visual pretraining with piezo contact mics and reports the useful finding that sound helps most in
 the <b>low-data</b> regime and under texture change. [[sonicsense]] (Duke) puts a contact microphone in
 <em>every fingertip</em> of a four-finger hand and recovers material, contents and shape from tapping and
 shaking. [[audio-vla]] folds contact audio into a VLA. [[vibecheck]] goes active — inject a vibration and
 listen to the response. [[miccheck]] shows you can do all of this with off-the-shelf pin microphones for
 almost nothing.</p>
 <p><b>Multimodal fusion has a reference study.</b> [[see-hear-feel]] is still the cleanest account of when
 vision, touch and audio each actually help, and [[robot-synesthesia]] contributes the representation trick
 worth copying: put the modalities in a shared 3D space rather than concatenating their features.
 [[av-contact]] estimates <em>extrinsic</em> contact — where the held object meets the world — from vision and
 sound, which for a stylus on a record is the entire task.</p>
 <p><b>Tactile and force hardware is ready.</b> [[dexskin]] for conformable coverage, [[anyskin]] for
 recalibration-free replacement, [[doglove]] if you want force-feedback human demonstrations.</p>
 <p><b>What does not exist:</b> any robot-learning work where audio is the <em>objective</em>. In every paper
 above, sound is an input used to infer a state that some other signal scores. Musical robotics has the
 objective (Shimon and the marimba-playing lineage at Georgia Tech) but those systems are largely scripted or
 planned, not learned from contact, and they strike discrete notes rather than modulate continuous friction
 against a moving platter.</p>""",
 threads=[
  """<b>Contact microphones as sensors.</b> [[sonicsense]], [[miccheck]], [[vibecheck]]. A piezo disc costs a
  dollar; this is the cheapest new modality you can add to a hand.""",
  """<b>Learning policies from audio.</b> [[maniwav]], [[hearing-touch]], [[audio-vla]].""",
  """<b>Multimodal fusion.</b> [[see-hear-feel]], [[robot-synesthesia]], [[av-contact]].""",
  """<b>Force regulation against motion.</b> [[falcon]]'s force curriculum, [[force-grasp-s2r]], and the
  contact-rich RL literature — the turntable is a compliant, continuously moving surface.""",
  """<b>In-the-wild capture with sound.</b> [[maniwav]]'s ear-in-hand is directly reusable: a human DJ wearing
  it generates exactly the demonstrations you need.""",
 ],
 gap="""<p>The novel claim is structural, not incremental: <b>turntablism is the first manipulation task where
 the reward and the observation are the same modality</b>. The policy acts, the acting makes sound, and the
 sound is both what you observe and what you are scored on. That means:</p>
 <ul>
 <li>no external reward instrumentation — the blocker that kills most real-world RL projects simply is not
 there;</li>
 <li>a dense, continuous reward at audio rate rather than a sparse success bit;</li>
 <li>an evaluation any human can judge instantly, which makes user studies cheap and honest.</li>
 </ul>
 <p>On top of that it forces three things the dexterity benchmarks avoid: regulating normal force against a
 <em>moving</em> surface, timing where being early is exactly as wrong as being late, and bimanual asymmetry
 with a hard real-time coupling between the two hands.</p>""",
 plan=[
  """<b>Rig.</b> A belt-drive turntable (torque you can fight without damaging it), a dexterous hand with a
  [[sonicsense]]-style piezo in each fingertip, a [[miccheck]] pin mic on the tonearm, and an F/T sensor at the
  wrist. Take the line-out from the mixer as ground-truth audio — do not use a room microphone.""",
  """<b>Representation.</b> Log-mel spectrogram at 10-20 ms hop for the policy observation, plus the raw
  waveform kept for the reward. Fuse with vision using [[robot-synesthesia]]'s shared-space trick rather than
  feature concatenation, and pretrain the audio encoder [[hearing-touch]]-style on unlabelled scratching before
  any policy training.""",
  """<b>Reward.</b> Spectral distance between produced and target audio (multi-resolution STFT loss, borrowed
  from neural vocoders), plus a beat-alignment term from onset detection, plus a force penalty so the stylus
  survives. This is the piece to get right first — everything else is standard.""",
  """<b>Learn in three stages.</b> (1) Human demonstrations with a [[maniwav]]-style ear-in-hand rig worn by an
  actual DJ — the motions are highly stereotyped, so a small dataset should go far. (2) Behaviour cloning with
  a diffusion or flow action head ([[dp]], [[manflow]]) at 50 Hz+. (3) Residual RL on the real rig
  ([[pld]], [[hil-serl]]) using the spectral reward — and note that the reward needs no human in the loop, so
  this can run unattended, which connects it to your real-world RL harness idea.""",
  """<b>Curriculum.</b> Baby scratch → tear → chirp → transformer, and only then beat-matching two decks, which
  adds a second turntable and a tempo-estimation problem.""",
  """<b>Ablations that make it a paper.</b> Audio-in-observation vs vision-only vs audio-in-reward-only; force
  sensing on vs off; and the one that tests the novelty claim directly — does having reward and observation in
  the same modality actually improve sample efficiency, measured against the same task scored by an external
  judge?""",
 ],
 risks=[
  """<b>It reads as a novelty act.</b> The defence is the benchmark framing: same-modality reward, continuous
  force against a moving surface, millisecond timing. Lead with that, not with the music.""",
  """<b>Latency.</b> Audio feedback at 20 ms means the whole perception-action loop must fit inside that. A
  diffusion head will not; use [[manflow]] or [[consistency-policy]], or run the audio reward off-policy.""",
  """<b>Hardware wear.</b> Styluses and records are consumables and a bad policy destroys both quickly. Start
  with a cheap cartridge and a scratch-specific record, and put a hard force limit below the policy.""",
  """<b>The reward may be gameable.</b> Spectral distance can be satisfied by scraping in a way that sounds
  approximately right and ruins the record. Keep the force penalty and a human listening check in the eval.""",
 ],
 read=[
  dict(id="maniwav", why="Read first. Ear-in-hand contact mic on a UMI-style gripper, policies learned from in-the-wild audio-visual data — the capture rig you want."),
  dict(id="sonicsense", why="A contact microphone in every fingertip. The hardware pattern for a dexterous audio hand, and it is cheap."),
  dict(id="hearing-touch", why="Audio-visual pretraining, and the finding that sound helps most in low-data and under texture change."),
  dict(id="see-hear-feel", why="When each modality actually helps. Read before designing the fusion."),
  dict(id="robot-synesthesia", why="Fuse modalities in a shared 3D space instead of concatenating features."),
  dict(id="av-contact", why="Extrinsic contact from vision plus sound — stylus-on-record is exactly that problem."),
  dict(id="vibecheck", why="Active acoustic sensing. The platter is already vibrating, so you get the probe free."),
  dict(id="audio-vla", why="The baseline once you have the hand: does audio survive being fed to a large pretrained action model?"),
  dict(id="miccheck", why="Pin microphones as contact sensors. Build this in an afternoon before designing anything custom."),
  dict(id="falcon", why="Force regulation with an explicit curriculum — the turntable pushes back."),
  dict(id="hil-serl", why="The real-world RL loop this ends in, and here the reward needs no instrumentation."),
 ])

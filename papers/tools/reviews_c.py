# -*- coding: utf-8 -*-
R = {}

R["rl-harness"] = dict(
 why="""<p>Real-world RL is rare not because the algorithms are missing but because the <em>apparatus</em> is.
 Every hour of on-robot RL needs automatic reset, automatic success detection, automatic logging, and
 something to stop the arm destroying itself at 3am. Labs that have built that apparatus publish real-world
 RL results constantly; labs that have not, publish none. The harness is the moat.</p>""",
 state="""<p><b>The canonical example is [[serl]]</b> — a software suite with RLPD-style off-policy RL, learned
 reward classifiers, and forward-backward reset controllers, which turns real-robot RL from a research
 project into a two-hour job. [[hil-serl]] adds the human-correction channel and reaches near-100% on
 contact-rich tasks in one to two and a half hours.</p>
 <p><b>The 2026 development is that the harness itself became the paper.</b> [[harbor]] is a harness framework
 for agentic robot RL that automates the whole simulation-RL workflow across 6 benchmarks and 16 tasks
 spanning manipulation, locomotion and bimanual dexterous control, with policies transferring to real robots.
 That is your idea, in simulation. [[polaris]] does the evaluation-harness half using real-to-sim twins.</p>
 <p><b>Reward without instrumentation is the recurring blocker.</b> [[vip]] gets a dense reward from human
 video; [[ript-vla]] shows binary success is enough if you have it; [[eureka]] and [[rf-agent]] generate
 reward code automatically.</p>""",
 threads=[
  """<b>Reset.</b> Forward-backward policies ([[serl]]), scripted resets, or task design that is
  self-resetting. This is the unglamorous thing that decides whether the harness works overnight.""",
  """<b>Reward.</b> Learned classifiers ([[serl]]), binary success ([[ript-vla]]), video-derived value
  ([[vip]]), LLM-written reward code ([[eureka]], [[rf-agent]]).""",
  """<b>Orchestration.</b> [[harbor]], [[rlinf-vla]]. Someone else's rollout loop is better than yours.""",
  """<b>Evaluation.</b> [[polaris]] — twins so the ablations are affordable.""",
  """<b>Safety and wear.</b> Under-discussed and it is what actually stops unattended running.""",
 ],
 gap="""<p>[[harbor]] automates the <b>simulation</b> RL workflow. The real-world harness — the one that runs
 unattended on physical hardware for days — is still bespoke per lab, and [[serl]] is the closest thing to a
 shared artefact. That gap is your opening, and it is a systems-and-infrastructure contribution rather than
 an algorithmic one.</p>
 <p>Concretely: <b>a standing set of physical tasks with automatic reset, automatic scoring, and continuous
 logging, that any RL algorithm can be pointed at.</b> Release it with baseline curves for three or four
 algorithms and you have given the field something it has wanted for a decade. It also unblocks your own
 RL-post-training and agentic-auto-research ideas, both of which need exactly this.</p>""",
 plan=[
  """Pick 5-8 physical tasks that are genuinely self-resetting or cheaply resettable — peg insertion into a
  fixture, a hinged door, a sliding drawer, a tethered object. Resist tasks that need a human to tidy up.""",
  """Build reward detection per task before anything else, and validate it against human labels for a few
  hundred episodes. A harness with 5% reward-detection error is worse than no harness.""",
  """Wrap [[serl]]/[[rlinf-vla]] rather than writing a new trainer.""",
  """Run it unattended for 72 hours and report what broke. That failure log is a more valuable contribution
  than the learning curves.""",
  """Publish baselines: [[rlpd]], [[hil-serl]], [[pld]] on the same tasks and the same time budget.""",
 ],
 risks=[
  """<b>Hardware wear and unattended failure.</b> The reason this is rare. Design for graceful failure and
  instrument for it; assume a gripper is a consumable.""",
  """<b>Reward detection is the whole project in disguise.</b> Budget most of your time here.""",
  """<b>Nobody adopts it.</b> Mitigated by making the hardware cheap and the task fixtures printable —
  the [[aloha]]/[[so100]] lesson.""",
 ],
 read=[
  dict(id="serl", why="The closest existing artefact to what you want to build. Read the reset and reward sections closely."),
  dict(id="harbor", why="2026. The simulation version of this idea, already done — read it to scope yours to the real-world half."),
  dict(id="hil-serl", why="What a working harness enables: near-100% on hard tasks in two hours."),
  dict(id="polaris", why="The evaluation half, via real-to-sim twins."),
  dict(id="rlpd", why="The algorithm your baselines should start from."),
  dict(id="eureka", why="If reward code generation becomes part of the harness."),
  dict(id="vip", why="Reward from human video, for tasks you cannot instrument."),
 ])

R["auto-research-dex"] = dict(
 why="""<p>You wrote "you can try now" next to this one, and that is the right instinct — of everything on
 your list, this needs the least new hardware and the least new theory. The loop is: an agent writes the
 reward, launches the training, reads the curves, diagnoses the failure, and revises. Every piece of that has
 been demonstrated separately.</p>""",
 state="""<p><b>[[eureka]] is the proof of concept</b>: GPT-4 writes reward <em>code</em>, trains a policy,
 reads the training statistics, and mutates — producing human-level reward functions and a pen-spinning
 Shadow Hand. [[dreureka]] extends it to writing the domain-randomization config, i.e. the sim-to-real knobs.
 [[rf-agent]] (Feb 2026) replaces Eureka's evolutionary search with language agent tree search over reward
 functions.</p>
 <p><b>And [[harbor]] (June 2026) closes the loop</b>: a harness framework for agentic robot RL that automates
 the whole simulation-RL workflow across 16 tasks including bimanual dexterous control, with real-robot
 transfer. Read it before you plan anything — this is the idea, implemented.</p>
 <p><b>The general auto-research literature is more sobering.</b> [[ai-scientist]] and [[agent-laboratory]]
 run the full hypothesis-to-paper loop outside robotics, and the consistent finding is that agents are good
 at writing code and running experiments, and weak at judging whether a result is interesting. [[voyager]]'s
 growing skill library and self-proposed curriculum is the architecture that works best when the environment
 gives clean feedback — which simulated dexterity does and real dexterity does not.</p>""",
 threads=[
  """<b>Reward generation.</b> [[eureka]], [[rf-agent]], [[dreureka]]. The most mature component.""",
  """<b>Workflow automation.</b> [[harbor]], [[rlinf-vla]].""",
  """<b>Self-improving loops.</b> [[robocat]] (adapt, self-generate data, fold back), [[voyager]] (skill
  library plus self-curriculum), [[pld]] (probe, learn, distil).""",
  """<b>The honest limits.</b> [[ai-scientist]], [[agent-laboratory]] — read the criticism as well as the papers.""",
 ],
 gap="""<p>[[harbor]] occupies the simulated version. Two openings remain and both are specific to dexterity.</p>
 <p><b>The agent cannot currently diagnose a dexterity failure.</b> Reward-generation systems read scalar
 training curves. A failed in-hand rotation is not diagnosable from a reward curve — you need to look at the
 contact history and see that the thumb lost purchase at 40% of the rollout. An agent that reads <em>contact
 and trajectory traces</em> rather than scalars, and proposes targeted fixes, is a real and unclaimed
 contribution — and it plugs straight into your tactile work.</p>
 <p><b>Nobody runs the loop on real hardware.</b> Simulated auto-research is cheap and mostly solved.
 Real-world auto-research needs the harness from your other idea, which is precisely why these two ideas
 belong together.</p>""",
 plan=[
  """Reproduce [[eureka]] on one in-hand task this week. It is genuinely a week, and it calibrates every
  intuition you have about what the agent can and cannot do.""",
  """Replace the scalar feedback with structured traces: contact events, joint limits hit, object drop times.
  Give the agent something it can actually diagnose from.""",
  """Benchmark against [[rf-agent]] and the [[harbor]] pipeline rather than against hand-tuned rewards only.""",
  """Measure the thing that matters: agent iterations to reach a target success rate, versus a human
  researcher's iterations on the same task. Nobody reports this honestly.""",
  """Then, and only then, point it at real hardware through the harness.""",
 ],
 risks=[
  """<b>It is a wrapper.</b> The failure mode of this whole area is producing a nicely-engineered loop with
  no research claim. The contact-trace diagnosis angle is what keeps it a contribution.""",
  """<b>Reward hacking.</b> LLM-written rewards get gamed by the RL agent in creative and hard-to-detect ways.
  Hold out an honest evaluation the reward cannot touch.""",
  """<b>Cost.</b> Many LLM calls times many training runs. Cap it and report the budget.""",
 ],
 read=[
  dict(id="harbor", why="Read first. It is this idea, implemented, in simulation — it tells you exactly what is left."),
  dict(id="eureka", why="The proof of concept, and a one-week reproduction that will calibrate everything."),
  dict(id="rf-agent", why="2026 successor: tree search over reward functions instead of evolution."),
  dict(id="dreureka", why="Extends the loop to the sim-to-real knobs."),
  dict(id="voyager", why="The skill-library + self-curriculum architecture for open-ended improvement."),
  dict(id="agent-laboratory", why="The honest reference point for what agent-run research does and does not do."),
  dict(id="serl", why="What the real-world version needs underneath it."),
 ])

R["codesign-dex-agentic"] = dict(
 why="""<p>Hand design is currently a craft: someone with taste iterates on tendon routing and link lengths
 until it feels right. That loop is slow, undocumented, and does not transfer. If an agent can propose a
 morphology, build it in simulation, train a policy, read the result and revise, then hand design becomes a
 search problem — and search problems scale.</p>""",
 state="""<p><b>Co-design has a long history and a clear modern formulation.</b> [[sims1994]] evolved bodies
 and brains together in 1994 and the framing has barely changed. [[transform2act]] gives the cleanest modern
 statement — make design choices <em>actions</em> in an extended MDP so one RL algorithm handles both.
 [[derl]] showed morphology and learning speed co-evolve (the "morphological Baldwin effect"), which is the
 result to cite when arguing co-design is more than hyperparameter tuning. [[robogrammar]] constrains the
 search with a grammar so results are buildable, and [[neural-graph-evo]] (Toronto) does the GNN version.</p>
 <p><b>For hands specifically, the gradient-based line is strongest.</b> [[hardware-as-policy]] treats the
 mechanism as part of the policy network so hardware parameters get gradients from the same backward pass,
 demonstrated on underactuated hands. [[diff-contact-design]] differentiates through contact. [[fit2form]]
 generates gripper geometry from the task. Those three are the technical core for dexterity co-design.</p>
 <p><b>The agentic layer arrived in 2024-26.</b> [[text2robot]] goes from a text prompt through a 3D
 generative model to a printable quadruped with an evolved controller in under a day. [[robomorph]] uses an
 LLM as the mutation operator with automatic reward design alongside. [[diffusebot]] puts a diffusion model
 over morphologies with differentiable physics steering the sampling. [[eureka]] and [[rf-agent]] supply the
 reward half.</p>""",
 threads=[
  """<b>Formulations.</b> [[transform2act]] (design-as-action), [[codesign-rl]] (distribution over designs),
  [[coros-codesign]]/[[dinev-codesign]] (differentiate through the solver).""",
  """<b>Search-space constraints.</b> [[robogrammar]], [[lipson2000]]. An agent proposing in free space
  produces unbuildable garbage; a grammar fixes that.""",
  """<b>Hands and contact.</b> [[hardware-as-policy]], [[diff-contact-design]], [[fit2form]].""",
  """<b>Generative proposal.</b> [[text2robot]], [[diffusebot]], [[robomorph]].""",
  """<b>Benchmarks.</b> [[evogym]], [[taskagnostic-morph]].""",
 ],
 gap="""<p>Everything above optimizes for locomotion or for simple grippers. <b>Nobody has run an agentic
 co-design loop on a multi-finger dexterous hand</b>, and the reason is technical, not accidental: the
 objective for dexterity is contact behaviour, which is expensive to simulate, poorly differentiable, and
 badly captured by any scalar. That is exactly why it is worth doing.</p>
 <p>The tractable version couples this to your other work: use [[hardware-as-policy]]-style differentiable
 hardware parameters within a [[robogrammar]]-style constrained space, with an LLM agent proposing structural
 changes and a [[eureka]]-style component writing the task reward. Evaluate on in-hand reorientation, where
 the literature ([[chen-inhand]], [[chen-visual-inhand]]) gives you a hard baseline. And make the output
 <em>buildable</em> — validate on the real hand from your 22-DOF project.</p>""",
 plan=[
  """Fix the design space first: tendon routing, link ratios, joint axes, actuator selection — parameterised,
  bounded, and buildable. This is most of the work and it is where domain knowledge beats the agent.""",
  """Baseline with [[transform2act]] or [[hardware-as-policy]] before adding an LLM. You need to know what
  plain optimization achieves.""",
  """Add the agent as the <em>structural</em> proposer only (add a finger joint, change the thumb opposition
  axis), leaving continuous parameters to gradients. Agents are better at discrete choices than at numbers.""",
  """Evaluate on in-hand reorientation success across an object set — a measure with real prior art to
  compare against.""",
  """Build the best candidate. An unbuilt co-design result is a simulation paper.""",
 ],
 risks=[
  """<b>Simulation fidelity for tendon hands.</b> The optimizer will exploit whatever the simulator gets
  wrong. Constrain aggressively and sanity-check candidates against a physical prototype early.""",
  """<b>Compute.</b> Every design evaluation is an RL training run. [[meta-rl-legged]]'s design-conditioned
  policy trick is the standard escape — adopt it from the start.""",
  """<b>The agent adds nothing.</b> Very possible. The honest ablation — agent proposer vs random proposer vs
  evolutionary proposer — should be in the paper whichever way it comes out.""",
 ],
 read=[
  dict(id="hardware-as-policy", why="The most directly relevant formulation: hardware parameters inside the policy network, demonstrated on hands."),
  dict(id="transform2act", why="The cleanest general formulation — design choices as actions."),
  dict(id="text2robot", why="2025. The closest existing agentic co-design system, end to end and printable."),
  dict(id="robogrammar", why="Why you need a grammar, not free-space proposal."),
  dict(id="diff-contact-design", why="Differentiating through contact — the hard part for dexterity."),
  dict(id="derl", why="The argument that co-design changes learnability, not just performance."),
  dict(id="robomorph", why="LLM as mutation operator; the mechanism you are proposing."),
  dict(id="meta-rl-legged", why="The design-conditioned-policy trick that makes the compute affordable."),
  dict(id="fit2form", why="Generating gripper geometry from the task."),
 ])

R["codesign-dog-rl"] = dict(
 why="""<p>A single brutally clear objective — top speed — with body and controller optimized together. Adding
 an articulated trunk makes it richer: the spine is the one part of a running animal that every quadruped robot
 leaves out, and it is not decorative. In a galloping cheetah the trunk contributes a large fraction of stride
 length.</p>
 <p>And the framing you landed on — <em>derive the kinematic chain from real dog footage</em> — is what turns
 this from a co-design exercise into a question about animals that a robot can answer.</p>""",
 state="""<p><b>The nearest work is [[s-cheetah]] (May 2026) — and it is simulation-only.</b> It presents a quadruped
 with a bio-inspired serial 3-DOF active spine giving tri-axial rotation, trained with RL, reporting 6.9 m/s on
 a rotary G2 gallop, 7.2 rad/s in-place turning, and emergent feline aerial self-righting. But the paper states
 plainly that it <em>“currently focuses on the design and simulation phases prior to hardware deployment”</em>:
 training is in Isaac Sim with a MuJoCo cross-check, both headline numbers are simulated, and the 20 kg /
 625 mm / 33.5 N·m leg / 50 N·m spine figures are <b>design parameters, not measurements</b>.</p>
 <p>That distinction matters enormously for what is left to do. S-Cheetah establishes the <em>hypothesis</em>
 that a 3-DOF spine helps, at simulated scale, with hand-chosen proportions. It does not establish that the
 advantage survives fabrication — and 6.9 m/s is fast enough to be suspicious: MIT Cheetah 2 reached roughly
 6 m/s on real hardware and Cheetah 3 about 3 m/s, both without an actuated trunk. Free-fall aerial righting
 from arbitrary orientations is likewise exactly the kind of behaviour that depends on inertia and actuator
 bandwidth being modelled correctly.</p>
 <p><b>The mechanism behind it has also been identified.</b> [[spine-phase]] shows that high-speed running
 performance is set by the <b>phase relationship between spinal motion and limb support</b>, under asymmetric
 spinal stiffness — not by spinal range of motion. That is a gift for a co-design study, because it tells you
 which variable to parameterise. [[twisting-waist]] is the minimal counterpoint: a single twisting waist joint,
 useful for asking how much of the benefit one DOF buys.</p>
 <p><b>The co-design machinery is mature.</b> [[transform2act]] makes design choices actions in an extended MDP;
 [[derl]] shows morphology and learning speed co-evolve; [[meta-rl-legged]] trains a design-conditioned policy
 once so candidate morphologies can be evaluated without retraining — the trick without which this search is
 unaffordable. [[coros-codesign]] and [[dinev-codesign]] give the model-based gradients, which for a quadruped
 with a good model are far more sample-efficient than RL. [[mit-cheetah]] remains the actuator argument that
 dominates top speed, and [[dyret]] is the only robot that changes its own morphology in the real world.</p>
 <p><b>And the animal-measurement side has quietly become tractable.</b> [[dogmo]] (Oct 2025) provides 1,200
 multi-view RGB-D motion sequences from 10 real dogs — the first dog dataset with enough fidelity to measure
 how a trunk actually bends at speed. [[barc]] and [[corgi]] regress 3D dog shape from ordinary images,
 [[animal-avatars]] reconstructs animatable 3D animals from casual video, and [[hsmal]] shows the parametric
 quadruped approach generalises across species. Five years ago 'design the robot from dog footage' was a
 slogan; it is now a data pipeline.</p>""",
 threads=[
  """<b>Spined quadrupeds.</b> [[s-cheetah]] (3-DOF, RL, 6.9 m/s), [[twisting-waist]] (1-DOF), [[spine-phase]]
  (the mechanism).""",
  """<b>Co-design formulations.</b> [[transform2act]], [[derl]], [[codesign-rl]], with [[coros-codesign]] and
  [[dinev-codesign]] for the model-based route.""",
  """<b>Making the search affordable.</b> [[meta-rl-legged]]'s design-conditioned policy — adopt from day one.""",
  """<b>Actuators.</b> [[mit-cheetah]]. Top speed is an actuator problem before it is a geometry problem.""",
  """<b>Measuring the animal.</b> [[dogmo]], [[barc]], [[corgi]], [[animal-avatars]], [[hsmal]].""",
  """<b>Real-world morphology change.</b> [[dyret]], and [[text2robot]] for the fast generative path to a
  printable quadruped.""",
 ],
 gap="""<p>Given [[s-cheetah]], the open question is no longer <em>whether</em> a spine helps but <b>which
 spine</b> — and that is exactly where your framing has purchase.</p>
 <p><b>2. Co-design the whole kinematic chain, not just the spine.</b> Link-length optimization on its own is
 standard co-design — [[transform2act]], [[derl]] and [[robogrammar]] all do it. A multi-DOF spine on its own is
 now S-Cheetah's. What nobody has done is optimize <b>segment lengths jointly with spine DOF count, joint
 placement and stiffness</b>, and the coupling is not incidental: [[spine-phase]] shows performance is set by
 the phase relationship between spinal motion and limb support, which is a function of <em>both</em> trunk and
 limb geometry. Optimizing one with the other fixed is optimizing a projection of the real problem. This is
 also where [[meta-rl-legged]]'s design-conditioned policy stops being a convenience and becomes necessary —
 the joint space is far larger.</p>
 <p><b>3. Derive the trunk from the animal, do not assume it.</b> Every spined quadruped in the literature has a
 hand-chosen DOF count, hand-chosen joint placement and hand-tuned stiffness. [[s-cheetah]] picked three DOF
 because a cheetah's spine rotates about three axes; that is a reasonable argument, not a measurement.
 [[dogmo]] now makes the measurement possible: fit a variable-DOF trunk model to real canine motion and ask how
 many joints the data actually supports, where they sit, and what stiffness profile reproduces the observed
 bending — and take the limb segment ratios from the same footage. Then co-design against that.</p>
 <p>Two falsifiable outputs, both novel:</p>
 <ul>
 <li><b>The DOF count the data justifies.</b> Is three right? Model selection on real dog motion will give a
 number, and it may not be three. That is a result about animals, obtained with robotics tooling, and it is
 publishable on its own.</li>
 <li><b>Data-derived vs hand-designed, at matched mass and actuator budget.</b> Build both spines on the same
 robot and race them. If the derived one wins, biomimetic measurement beats intuition; if it does not, that is
 an equally interesting and much-needed negative result.</li>
 </ul>
 <p>A note on scope, because all three at once is a lot: the hardware claim (1) is the one that cannot be
 scooped by a simulation paper, and it is the one that makes (2) and (3) credible rather than another
 simulated morphology search. If you only do one, do that one.</p>""",
 plan=[
  """Start from [[dogmo]]. Fit a trunk model with a variable number of joints to the measured motion and do
  honest model selection — this is a week of work and it determines the whole design.""",
  """Parameterise properly: link lengths, mass distribution, gear ratio, actuator selection from a real
  catalogue, <b>and</b> spine DOF count, joint placement and stiffness profile. A search over link lengths
  alone will find nothing.""",
  """Adopt [[meta-rl-legged]]'s design-conditioned policy immediately, and [[rudin2021]]/[[isaaclab]] for
  parallel training. Otherwise every design evaluation costs an RL run.""",
  """Optimize against [[spine-phase]]'s finding — make the spine-limb phase relationship an explicit term
  rather than hoping RL discovers it.""",
  """<b>Build it, and build small.</b> S-Cheetah's design point is 20 kg and 625 mm; a 5\u20138 kg version on
  off-the-shelf quasi-direct-drive actuators ([[mit-cheetah]] lineage, or the [[berkeley-humanoid-lite]]
  printed-gearbox approach) is far more iterable and still galloping-capable. Design the spine for
  <em>serviceability</em> — you will be replacing it.""",
  """Instrument the trunk from the start: joint torque, deflection under load, and a way to lock the spine
  rigid. A lockable spine gives you the cleanest possible ablation on the same hardware — same mass, same
  actuators, spine on versus spine off.""",
  """Build two spines if you can: the data-derived one and an [[s-cheetah]]-style hand-designed 3-DOF one,
  matched on mass and actuators. Measure top speed, turning rate, and cost of transport.""",
  """<b>Report the design sim-to-real gap</b> with the discrepancy decomposed into actuator bandwidth,
  structural compliance and contact. Also try to reproduce the simulated aerial-righting behaviour — it is a
  sharp test of whether the inertia model was right, and a clean negative result if it is not.""",
 ],
 risks=[
  """<b>The optimizer exploits the simulator.</b> Guaranteed at some level, and a compliant spine gives it more
  to exploit. Constrain to buildable ranges, penalise anything relying on unmodelled compliance, and validate
  candidates physically early.""",
  """<b>Model selection on dog motion is under-determined.</b> Marker-free reconstruction has real error, and
  trunk bending is exactly where it is worst. Report the uncertainty on the DOF count rather than a point
  estimate, and cross-check [[dogmo]]'s RGB-D against reconstructions from [[animal-avatars]].""",
  """<b>A spine is heavy and fragile.</b> Actuating the trunk adds mass at the worst place for a running robot.
  [[twisting-waist]]'s 1-DOF result is the honest baseline — it may be that most of the benefit is available
  for a third of the cost.""",
  """<b>Fabrication is slow.</b> This is what turns a six-month project into eighteen. Printable, off-the-shelf
  actuators, and [[text2robot]]'s pipeline if you want a fast first article.""",
  """<b>The simulated advantage may not survive.</b> Three series joints accumulate backlash, and a compliant
  trunk under gallop loads is the worst case for a rigid-body simulator. Treat \u201cthe spine does not help on
  real hardware at this scale\u201d as a legitimate outcome and design the experiment so that result is
  publishable \u2014 the lockable-spine ablation is what makes it so.""",
  """<b>Someone else builds it first.</b> S-Cheetah's authors say hardware deployment is future work, so
  assume they are doing it. Your differentiators are the data-derived structure and the joint
  length-plus-spine co-design, neither of which they have signalled.""",
 ],
 read=[
  dict(id="s-cheetah", why="Read first. A 3-DOF active spine, RL-trained, 6.9 m/s — your premise, already built and measured."),
  dict(id="spine-phase", why="The mechanism: spine-limb phase, not range of motion, sets high-speed performance. This is what to optimize."),
  dict(id="dogmo", why="1,200 multi-view RGB-D sequences from 10 dogs. The measurement that makes 'derive the spine' possible."),
  dict(id="meta-rl-legged", why="The design-conditioned policy that makes the search affordable. Adopt on day one."),
  dict(id="mit-cheetah", why="Actuator selection dominates top speed. Settle it before geometry."),
  dict(id="transform2act", why="The co-design formulation to implement — design choices as actions."),
  dict(id="twisting-waist", why="The 1-DOF baseline. How much of the benefit does one joint buy?"),
  dict(id="barc", why="3D dog shape from ordinary images — body proportions before kinematics."),
  dict(id="animal-avatars", why="Animatable 3D animals from casual video; the cross-check on DogMo."),
  dict(id="dyret", why="The only robot that changes its morphology in the real world."),
  dict(id="derl", why="Evidence that co-design changes learnability, not just performance."),
 ])

R["agentic-physical"] = dict(
 why="""<p>Software agents plan, call tools, observe results and replan. Robots mostly do not — they execute a
 policy. The idea is to put the agent loop on a physical body: high-level reasoning that decomposes a task,
 calls learned skills, watches what happens, and revises. You called it a wild idea with low-hanging fruit,
 and both halves of that are right.</p>""",
 state="""<p><b>The dual-system architecture already converged on something close.</b> [[groot-n1]] splits a
 slow VLM reasoning system from a fast diffusion controller; [[helix]] makes the same split at 7-9 Hz and
 200 Hz; [[pi05]] predicts high-level subtasks before acting. These are agent loops in all but name — what
 they lack is <em>persistent</em> state across attempts and genuine replanning after failure.</p>
 <p><b>The reasoning half now has a purpose-built model.</b> [[cosmos-reason]] is NVIDIA's VLM for physical
 AI — it watches video, reasons in long chains of thought about physics and common sense, and emits an
 embodied decision in language. [[groot-n16]] plugs it in as System 2. If you are building an agent loop on
 a body, this is the reasoning component you would start from rather than a general-purpose LLM.</p>
 <p><b>The agent literature supplies the missing half.</b> [[voyager]] maintains a growing library of
 executable skills with a self-proposed curriculum; [[robocat]] adapts, self-generates data and folds it back;
 [[tidybot]] uses an LLM for the narrow and correct thing — summarising a few user examples into a
 generalizable preference rule.</p>
 <p><b>And the harness exists now.</b> [[harbor]] automates agentic robot RL workflows; [[agent-laboratory]]
 and [[ai-scientist]] show the general loop outside robotics, along with its honest limitation: agents are
 strong at generating and executing, weak at evaluating.</p>""",
 threads=[
  """<b>Dual-system VLAs.</b> [[groot-n1]], [[helix]], [[pi05]].""",
  """<b>Skill libraries and self-curriculum.</b> [[voyager]], [[robocat]].""",
  """<b>LLMs used narrowly and well.</b> [[tidybot]].""",
  """<b>Failure recovery.</b> [[hil-serl]], [[pi06]] — corrections as a first-class data source.""",
  """<b>Orchestration.</b> [[harbor]], [[rlinf-vla]].""",
 ],
 gap="""<p>The low-hanging fruit is real and specific: <b>memory across attempts</b>. Every system above
 starts each episode fresh. A robot that remembers that this particular drawer sticks, that this mug is
 heavier than it looks, and that the last three attempts at this grasp failed the same way — and conditions
 its next attempt on that — is a small change to the architecture and a large change to the behaviour.
 Nobody has published it properly for physical manipulation.</p>
 <p>It also composes with everything else you are doing: the memory is exactly the place a world model
 ([[vjepa2]], [[flare]]) or a tactile trace ([[dream-tac]]) belongs.</p>""",
 plan=[
  """Start from an existing dual-system stack ([[groot-n1]] is open) rather than building an agent framework.""",
  """Add a per-object, per-scene memory: failure modes, observed masses, successful grasp poses. Keep it
  small and structured, not a vector database.""",
  """Evaluate on repeated attempts at the same task, and report success rate as a function of attempt number.
  That curve is the whole claim, and no current system has a positive slope on it.""",
  """Add the [[voyager]]-style skill library only if the memory result holds.""",
  """Use the tasks from your real-world RL harness so the repeated-attempt experiment can run unattended.""",
 ],
 risks=[
  """<b>Framework without a finding.</b> The dominant failure mode. The attempt-number curve keeps you honest.""",
  """<b>Latency.</b> A reasoning call per attempt is fine; per timestep is not. Keep the agent above the
  control loop, as the dual-system papers do.""",
  """<b>Evaluation is hard.</b> Agentic behaviour resists single-number evaluation. Commit to the repeated-attempt
  metric early rather than arguing about it later.""",
 ],
 read=[
  dict(id="groot-n1", why="The open dual-system stack to start from."),
  dict(id="voyager", why="Skill library plus self-curriculum — the architecture for open-ended improvement."),
  dict(id="harbor", why="The agentic-RL harness, so you are not writing orchestration."),
  dict(id="pi05", why="High-level subtask prediction inside a VLA — reasoning without a separate agent."),
  dict(id="robocat", why="Self-improvement: adapt, generate data, fold back."),
  dict(id="tidybot", why="The example of using an LLM for exactly the right narrow thing."),
  dict(id="cosmos-reason", why="The physical-reasoning VLM to use as System 2 rather than a generic LLM."),
  dict(id="groot-n16", why="Cosmos Reason wired into a humanoid foundation model — the reference integration."),
  dict(id="pi06", why="Corrections and experience as first-class data, at scale."),
 ])

R["wm-residual"] = dict(
 why="""<p>World models learn physics from scratch, which is absurd when you already have a simulator and a
 robot model that are right about most of it. Giving the model that structure and learning only the residual
 should cut sample complexity enormously, and should produce rollouts that stay physically plausible instead
 of drifting into nonsense.</p>""",
 state="""<p><b>The residual idea is proven at the actuator and dynamics level.</b> [[anymal-hwangbo]]'s
 learned actuator network is the canonical instance — identify the real actuator's torque response from data
 and put <em>that</em> in the simulator, rather than randomizing over your ignorance. [[asap]] is the modern
 whole-body version: learn a delta-action model from real rollouts and fine-tune the policy against the
 corrected simulator. [[dexndm]] does the same joint-wise for a dexterous hand. All three are residual
 physics, and all three work.</p>
 <p><b>The world-model side has the machinery but not the prior.</b> [[dreamerv3]] and [[dreamerv4]] are
 domain-agnostic by design; [[tdmpc2]] is decoder-free and cheap; [[vjepa2]] predicts in latent space;
 [[pwm]] uses first-order gradients through a learned smooth model, which is the closest to a differentiable
 hybrid. None of them are given a simulator to start from.</p>
 <p><b>And a better prior may be arriving.</b> [[newton]] is NVIDIA, Google DeepMind and Disney Research
 building one GPU physics engine together, with rigid and flexible bodies in the same scene. If its contact
 model is materially better than MuJoCo's, the residual you need to learn gets smaller — which is the whole
 argument. Benchmark it rather than assuming.</p>
 <p><b>Differentiable simulation is the other half.</b> [[diff-contact-design]] and [[genesis]] make the
 analytic model differentiable, which is what you need if the residual is to be trained end to end against
 the prior.</p>""",
 threads=[
  """<b>Residual dynamics.</b> [[anymal-hwangbo]], [[asap]], [[dexndm]]. Read all three; they are the same
  idea at three scales.""",
  """<b>Latent world models.</b> [[dreamerv3]], [[dreamerv4]], [[tdmpc2]], [[vjepa2]].""",
  """<b>Differentiable physics.</b> [[genesis]], [[diff-contact-design]], [[pwm]].""",
  """<b>Auxiliary-loss world modelling.</b> [[flare]] — the cheap way to test whether the prior helps.""",
 ],
 gap="""<p>Nobody has built a world model whose <b>backbone is a simulator</b>. The residual-physics literature
 corrects a simulator to help a policy; the world-model literature learns dynamics from scratch. The hybrid —
 roll out MuJoCo, predict the residual with a learned model, and train the agent inside the sum — is an
 obvious construction that has not been done for robot manipulation.</p>
 <p>The claim to test is sharp and falsifiable: <b>sample complexity versus a pure learned world model, at
 matched final performance.</b> And a second one that matters more for safety — rollouts from a
 physics-backed model should stay plausible for far longer horizons, which you can measure directly as
 divergence from ground truth over time.</p>""",
 plan=[
  """Pick a task where the analytic model is good but not perfect: contact-rich insertion, or in-hand
  rotation. Free-space reaching will not show anything.""",
  """Implement the baseline pure world model ([[tdmpc2]] is cheapest) and the sim-only baseline. You need both.""",
  """Add the residual: MuJoCo rollout plus a learned correction on the state delta, trained on real or
  higher-fidelity rollouts. This is exactly [[asap]]'s delta-action model used as a dynamics model rather
  than an action corrector.""",
  """Headline figure: sample complexity to a fixed success rate, three ways.""",
  """Second figure: rollout divergence versus horizon length. This is where physics-backed should win big.""",
 ],
 risks=[
  """<b>The residual absorbs everything.</b> If it is high-capacity it will just learn the dynamics and you
  are back where you started. Constrain capacity and report what fraction of the prediction the prior explains.""",
  """<b>Differentiating through contact is unstable.</b> Well known. Consider keeping the prior non-differentiable
  and training the residual on rollouts instead.""",
  """<b>The prior is wrong in the regime you care about.</b> Contact is exactly where simulators are weakest,
  which is both the risk and the reason the experiment is interesting.""",
 ],
 read=[
  dict(id="asap", why="The delta-action model. This is your residual, already built and validated — repurpose it as a dynamics model."),
  dict(id="anymal-hwangbo", why="The original residual-physics argument, and still the clearest."),
  dict(id="dexndm", why="The dexterous-hand version: joint-wise learned dynamics closing the reality gap."),
  dict(id="tdmpc2", why="The cheapest pure world-model baseline to beat."),
  dict(id="vjepa2", why="Latent prediction, for the architecture of the learned half."),
  dict(id="flare", why="The cheap first experiment before building anything."),
  dict(id="pwm", why="First-order gradients through a learned smooth model, if you want it differentiable end to end."),
  dict(id="newton", why="The new joint NVIDIA/DeepMind/Disney physics engine — a better prior means a smaller residual."),
  dict(id="dreamgen", why="The opposite bet: skip the prior and let a video world model generate the data."),
 ])

R["auto-research-wm"] = dict(
 why="""<p>Real-robot experiments are the scarce resource. If an agent can form hypotheses, test them inside a
 learned world model, and spend physical robot time only on the survivors, the throughput of a lab changes
 qualitatively rather than incrementally.</p>""",
 state="""<p><b>Training agents entirely inside a world model now works.</b> [[dreamerv4]] learns Minecraft
 diamonds from offline data alone by training the agent purely in imagination — which is the strongest
 existing signal that a learned model can substitute for interaction. [[genie3]] generates interactive worlds
 in real time with minute-scale consistency. [[dreamerv3]] established that one hyperparameter set works
 across 150+ domains.</p>
 <p><b>The agentic research loop exists separately.</b> [[ai-scientist]] and [[agent-laboratory]] run the
 hypothesis-to-paper loop; [[eureka]] and [[rf-agent]] run the narrower reward-design loop with actual
 training in it; [[harbor]] automates the robot RL workflow; [[real-deep-research]] does agentic analysis of
 the literature itself.</p>
 <p><b>And the world model is already being used as a data engine, which is one step short of this idea.</b>
 [[dreamgen]] generates trajectories for behaviours the robot has never performed and trains on them;
 [[robocurate]] verifies they are executable first. Substitute "hypotheses" for "trajectories" and you have
 the loop you are proposing.</p>
 <p><b>What is missing is the join.</b> Nobody uses a learned world model as the <em>cheap experiment
 substrate</em> for an agent that is doing research. The two literatures do not cite each other.</p>""",
 threads=[
  """<b>Agents inside world models.</b> [[dreamerv4]], [[genie3]], [[dreamerv3]].""",
  """<b>Agentic experiment loops.</b> [[eureka]], [[rf-agent]], [[harbor]], [[ai-scientist]].""",
  """<b>Self-improvement.</b> [[robocat]], [[voyager]], [[pld]].""",
  """<b>Model fidelity as the gating variable.</b> [[asap]], [[dexndm]] — how wrong the model is determines
  whether any of this is sound.""",
 ],
 gap="""<p>The join is the contribution, and it has a sharp, testable form: <b>does hypothesis triage inside a
 learned world model actually save real-robot time?</b> Run the agent loop twice — once with every hypothesis
 tested on hardware, once with the world model filtering first — and report robot-hours to reach the same
 conclusion.</p>
 <p>The failure mode is well defined too, and worth measuring: the model's false-negative rate. A world model
 that confidently rejects a hypothesis that would have worked is worse than no filter at all, and nobody has
 quantified that for robot dynamics.</p>""",
 plan=[
  """Start narrow. One task family, one world model ([[tdmpc2]] or [[flare]]-style), a hypothesis space of
  reward and controller variants rather than open-ended ideas.""",
  """Calibrate the model before trusting it: rank 20 known-outcome variants in the model and compare with
  their real ranking. That correlation is the gating result — if it is weak, stop.""",
  """Then the triage experiment: robot-hours to a fixed conclusion, with and without model filtering.""",
  """Report false negatives explicitly. This is the number that decides whether anyone should use this.""",
  """Use [[harbor]] for orchestration and the physical harness for the real-robot arm of the comparison.""",
 ],
 risks=[
  """<b>Model error is correlated with what is interesting.</b> Novel hypotheses are exactly the ones the model
  has least data on. This is a real and possibly fatal objection — confront it in the calibration step.""",
  """<b>Compounding automation error.</b> An agent on top of a world model on top of a simulator is three
  layers of approximation. Keep the hypothesis space narrow.""",
  """<b>It becomes an LLM paper.</b> Keep the contribution measured in robot-hours saved, not in prompt design.""",
 ],
 read=[
  dict(id="dreamerv4", why="Agents trained entirely inside the model, from offline data. The enabling result."),
  dict(id="harbor", why="The orchestration layer, already built for robot RL."),
  dict(id="eureka", why="The narrow version of the loop that demonstrably works."),
  dict(id="genie3", why="What interactive world generation now looks like."),
  dict(id="ai-scientist", why="The honest limits of agent-run research — read the criticism too."),
  dict(id="asap", why="How wrong your model is, and how to make it less wrong."),
  dict(id="dreamgen", why="The world model already used as a generator of things that never happened — one step from hypothesis testing."),
  dict(id="robocurate", why="Verifying what the model generated is physically real. The credibility step."),
  dict(id="real-deep-research", why="Agentic analysis of the literature; the other half of a research loop."),
 ])

R["third-person"] = dict(
 why="""<p>Third-person human video is the single most abundant demonstration source that exists — every
 cooking video, every assembly tutorial, every sports clip. It is also the hardest to use, because you have
 both an embodiment gap and a viewpoint gap at once, and the viewpoint gap changes with every clip.</p>""",
 state="""<p><b>The paired data now exists.</b> [[egoexo4d]] gives time-synchronized first- and third-person
 video of the same skilled activity, which turns "is ego better than exo?" from an argument into an
 experiment. That dataset is the reason this idea is tractable now and was not three years ago.</p>
 <p><b>Representation transfer works from either viewpoint.</b> [[r3m]] pretrains on Ego4D and cuts robot
 demonstrations by roughly an order of magnitude; [[vip]] extracts a dense reward. Neither is viewpoint-specific.</p>
 <p><b>Action transfer is where viewpoint bites.</b> [[mimicplay]] uses human play video for the high-level
 planner and a small amount of teleop for the low-level controller — a sensible division that sidesteps the
 viewpoint problem by only asking the video for coarse information. [[vid2robot]] conditions the policy on a
 human video of the task instead of a language string. [[mimicfunc]] imitates tool manipulation from a single
 human video via functional correspondence.</p>
 <p><b>Pixel editing works from third person too.</b> [[phantom]] edits the human out and paints the robot in,
 training with zero robot demonstrations — and that approach is largely viewpoint-agnostic, which makes it a
 surprisingly strong baseline here.</p>
 <p><b>And viewpoint robustness has its own line now.</b> [[egodemogen]] synthesises novel egocentric views;
 the same trick applies to exocentric capture.</p>""",
 threads=[
  """<b>Paired ego/exo data.</b> [[egoexo4d]] — the substrate for any honest comparison.""",
  """<b>Viewpoint-agnostic representations.</b> [[r3m]], [[vip]], [[vjepa2]].""",
  """<b>Coarse-from-video, fine-from-teleop.</b> [[mimicplay]]. The most robust practical split.""",
  """<b>Video-conditioned policies.</b> [[vid2robot]], [[mimicfunc]].""",
  """<b>Pixel editing.</b> [[phantom]] — works from either viewpoint.""",
  """<b>View augmentation.</b> [[egodemogen]], [[one-demo]].""",
 ],
 gap="""<p>The field has quietly assumed egocentric is better, because it matches the robot's wrist camera, and
 has mostly stopped asking. But third-person video is far more abundant, and [[egoexo4d]] makes the comparison
 runnable. <b>The unclaimed result is the controlled ego-versus-exo study</b>: same task, same paired data,
 same policy class, varying only viewpoint — and reported per task type, because the answer is almost
 certainly "ego for fine manipulation, exo for anything involving the whole body or the scene layout".</p>
 <p>That finding would be immediately useful to everyone building capture rigs, and it is a study rather than
 a system, which makes it fast.</p>""",
 plan=[
  """Use [[egoexo4d]] directly. The paired structure is the entire reason this is cheap.""",
  """Fix everything but viewpoint: one policy class, one pretraining recipe, one task set.""",
  """Run three arms: ego-only, exo-only, both. Report per task category.""",
  """Add [[phantom]]-style editing as a fourth arm, since it should be the most viewpoint-robust and nobody
  has checked that claim.""",
  """Close with the practical recommendation — which viewpoint to buy a camera for, given a task type.""",
 ],
 risks=[
  """<b>Confounds in the dataset.</b> Ego and exo clips differ in resolution, motion blur and framing as well
  as viewpoint. Control for what you can and report what you cannot.""",
  """<b>The answer is boring.</b> "It depends on the task" is the likely result — which is fine if the
  dependence is characterised precisely enough to act on.""",
  """<b>Someone runs it first.</b> It is an obvious study. Move quickly or scope to dexterous tasks where you
  have the hardware advantage.""",
 ],
 read=[
  dict(id="egoexo4d", why="The paired dataset that makes the study possible. Start here."),
  dict(id="mimicplay", why="The coarse-from-video, fine-from-teleop split — the most robust practical recipe."),
  dict(id="phantom", why="Viewpoint-agnostic pixel editing; a strong and cheap baseline."),
  dict(id="r3m", why="The representation baseline everything must beat."),
  dict(id="vid2robot", why="Conditioning the policy on a human video rather than a language string."),
  dict(id="mimicfunc", why="Single human video to tool manipulation via functional correspondence."),
  dict(id="human-video-survey", why="The 2026 map of the area — position against it explicitly."),
 ])

R["hri-collab"] = dict(
 why="""<p>Physical collaboration with a person is the hardest case of the M2 problem: your partner's policy
 is unknown, non-stationary, and cannot be retrained. It is also the case with the clearest path to something
 people actually want, since most useful physical tasks in a home or a workshop involve a human.</p>""",
 state="""<p><b>Humanoid co-manipulation has a concrete recent instance.</b> [[h2compact]] does
 human-humanoid co-manipulation with adaptive contact trajectory policies — in your own M2 library. The
 related work in your <em>collaborative_transport</em> folder (carbon-fibre plies, co-manipulated systems,
 human-guided transport) covers the industrial side.</p>
 <p><b>Force-adaptive whole-body control is the enabling capability.</b> [[falcon]]'s decoupled upper/lower-body
 formulation with an explicit external-force curriculum is exactly what a robot carrying one end of something
 with a person needs, and it is directly portable to MABEL.</p>
 <p><b>Intent prediction now has purpose-built data and a sharper framing.</b> [[interact]] predicts human
 intent <em>conditioned on what the robot is doing</em> — most datasets treat the human as if the robot were
 not there, which is precisely the assumption that fails in collaboration. [[intention-tracking]] adds a
 hierarchical version that both avoids interrupting the human and intervenes when the human is failing, and
 [[workspace-opt]] makes the genuinely contrarian move of arranging the workspace so the human moves more
 predictably instead of modelling the variance. On the data side, Kaiwu records human, environment and robot
 synchronously, and MoGaze pairs full-body motion with workspace geometry and eye gaze — see the Datasets tab.</p>
 <p><b>Intent inference is the part borrowed from elsewhere.</b> The MARL literature's opponent modelling
 ([[mappo]] and the belief-based opponent-shaping work in your library) is the formal version of "guess what
 your partner is about to do", and human-video work ([[r3m]], [[vip]]) is where the perception side comes
 from.</p>
 <p><b>And corrections-as-data is the loop that makes it improve.</b> [[hil-serl]] and [[pi06]] both treat
 human intervention as a first-class training signal rather than a nuisance.</p>""",
 threads=[
  """<b>Physical human-robot co-manipulation.</b> [[h2compact]], and the co-manipulation papers in your M2
  collaborative_transport folder.""",
  """<b>Force-adaptive control.</b> [[falcon]], [[deep-wbc]].""",
  """<b>Intent inference.</b> Opponent modelling from MARL, adapted to a partner you cannot train.""",
  """<b>Corrections as data.</b> [[hil-serl]], [[pi06]].""",
  """<b>Handovers.</b> The task-oriented handover work in your whole_body_loco_manipulation folder.""",
 ],
 gap="""<p>The measurement is missing. Physical HRI papers report task success and occasionally a subjective
 comfort survey. What they do not report is <b>who is doing the adapting</b>. In almost every deployed system
 the human silently adapts to the robot, and the paper claims the collaboration worked.</p>
 <p>The data to do it now exists — Kaiwu records all three streams at once, MoGaze gives gaze as an early
 intent signal, and [[interact]] provides the robot-conditioned framing — so this is a study you could run
 rather than a dataset you would first have to build.</p>
 <p>An experiment that quantifies the division of adaptation — how much the human's trajectory changes when
 partnered with the robot versus with another human, on the same task — would be a genuinely novel measurement,
 and it is the one that distinguishes a collaborative robot from a compliant one. It connects directly to M2,
 where you already have the two-agent infrastructure and can substitute a human for one agent.</p>""",
 plan=[
  """Reuse the M2 collaborative-transport setup with a human replacing one robot. The instrumentation is
  already there.""",
  """Collect the human-human baseline on the same task. Without it there is nothing to compare against, and
  this is the step everyone skips.""",
  """Measure adaptation on both sides: trajectory deviation from solo behaviour, internal force, lead/follow
  switching frequency.""",
  """Then intervene: give the robot an intent-inference module and show the human's adaptation burden drops.
  That is the result.""",
  """Report the subjective measures too, but lead with the objective ones.""",
 ],
 risks=[
  """<b>Human-subject approval and variance.</b> Budget time for ethics approval and enough participants for
  the variance, which will be large.""",
  """<b>Safety.</b> A force-adaptive whole-body controller sharing a payload with a person needs a real safety
  case, not a software limit.""",
  """<b>The human adapts anyway.</b> People are extremely good at compensating. Designing a task where that
  compensation is measurable rather than invisible is the hard experimental-design problem.""",
 ],
 read=[
  dict(id="h2compact", why="Human-humanoid co-manipulation with adaptive contact policies — the closest prior work, in your own library."),
  dict(id="falcon", why="The force-adaptive whole-body control this needs underneath."),
  dict(id="mappo", why="The formal frame for reasoning about a partner whose policy you do not control."),
  dict(id="hil-serl", why="Human corrections as a first-class training signal."),
  dict(id="pi06", why="The same idea at scale — interventions during autonomous execution."),
  dict(id="interact", why="Human intent predicted conditioned on the robot's actions — the framing most datasets miss."),
  dict(id="intention-tracking", why="Assistive intervention, not just collision avoidance. The behaviour that makes a collaborator."),
  dict(id="workspace-opt", why="Reduce the human's motion variance instead of modelling it better. Cheap and clever."),
  dict(id="roco", why="Its human-in-the-loop mode is the bridge between your multi-robot and HRI ideas."),
  dict(id="deep-wbc", why="Whole-body control with arm and legs in one policy."),
 ])

R["soft-sim2real"] = dict(
 why="""<p>Deformables break sim-to-real twice at once. The physics is wrong — cloth, rope and soft objects are
 badly modelled by every general-purpose simulator — and the rendering is wrong, because a simulated towel
 does not look like a real one to a CNN. Most work attacks one gap and inherits the other.</p>""",
 state="""<p><b>The field is unusually honest about being stuck.</b> The recent literature states plainly that
 widely-used simulators exhibit unreliable contact dynamics for thin structures, that demonstration-synthesis
 pipelines built for rigid bodies transfer poorly to deformables, and that pixel-based end-to-end policy
 learning for deformables has stagnated on precisely this gap. That is a refreshing starting point.</p>
 <p><b>The rendering gap has recent attacks.</b> [[simweaver]] (June 2026) claims zero-shot RGB sim-to-real
 for deformable manipulation. [[phantom]]'s editing approach sidesteps rendering entirely by working on real
 video.</p>
 <p><b>The physics gap has its own line.</b> [[real2sim]] identifies dynamics for a cable from real rollouts;
 [[dist-r2s2r]] does the distributional version for deformable linear objects; [[soft-gentle]] makes "do not
 break it" a differentiable stress-guided objective; [[genesis]] offers unified multi-material simulation
 (rigid, MPM, SPH, cloth), which is the main practical reason to care about it.</p>
 <p><b>And the residual-physics escape hatch applies here too.</b> [[asap]] and [[dexndm]] correct the
 simulator from real data rather than trying to make it right a priori, which for deformables may be the only
 tractable route.</p>""",
 threads=[
  """<b>Rendering gap.</b> [[simweaver]], [[phantom]]. Editing real pixels often beats matching them.""",
  """<b>Physics gap.</b> [[real2sim]], [[dist-r2s2r]], [[genesis]], [[soft-gentle]].""",
  """<b>Residual correction.</b> [[asap]], [[dexndm]] — learn the discrepancy instead of removing it.""",
  """<b>Tactile as the missing observation.</b> [[dexskin]], [[dream-tac]] — for deformables, contact tells
  you things vision cannot, and this is barely explored.""",
  """<b>Real-to-sim loops.</b> [[egoengine]], [[video2sim2real]] — reconstruct the specific object rather
  than modelling the class.""",
 ],
 gap="""<p>The two gaps are always attacked separately, and that is the opening. <b>An ablation that separates
 them — same task, same policy, four conditions (real physics/real render, sim physics/real render via
 editing, real physics/sim render, sim/sim) — would tell the field which gap to spend money on.</b> That
 experiment is buildable with [[phantom]]-style editing for the rendering axis and [[asap]]-style residual
 correction for the physics axis, and nobody has run it.</p>
 <p>The second opening is tactile. Every deformable sim-to-real paper is vision-based, and for cloth and rope
 the contact signal is exactly what disambiguates the state. Combining this with your tactile world-model
 project is the natural move.</p>""",
 plan=[
  """Pick one task with a clean metric — towel folding, or rope threading. Avoid anything where success is
  subjective.""",
  """Build the four-condition ablation. This is the contribution; the policy is incidental.""",
  """Add the residual-physics arm ([[asap]]-style delta model fitted to real rollouts) and report how much of
  the physics gap it closes.""",
  """Add tactile observation as a fifth condition, since for deformables it should help disproportionately.""",
  """Report the decomposition, not just the best number.""",
 ],
 risks=[
  """<b>Simulator choice determines the result.</b> [[genesis]]'s multi-material support may or may not
  hold up; benchmark it against a rigid-only baseline before building on it.""",
  """<b>Deformable state is hard to measure.</b> Ground truth for "did the fold succeed" needs care.""",
  """<b>Both gaps may be irreducible with current tools.</b> That is a publishable negative result if the
  decomposition is clean.""",
 ],
 read=[
  dict(id="simweaver", why="The most recent attack on the rendering half, and the honest framing of why this area stalled."),
  dict(id="real2sim", why="The physics half via identification from real rollouts, on a cable."),
  dict(id="asap", why="Residual correction — the most likely tractable route for deformables."),
  dict(id="soft-gentle", why="Stress-guided reward: making 'do not break it' differentiable."),
  dict(id="genesis", why="Multi-material simulation, if it holds up. Benchmark before trusting."),
  dict(id="phantom", why="Editing real pixels instead of matching them — your rendering-axis tool."),
  dict(id="dream-tac", why="Tactile prediction, which deformable work has almost entirely ignored."),
  dict(id="dist-r2s2r", why="The distributional real2sim2real treatment for deformable linear objects."),
 ])

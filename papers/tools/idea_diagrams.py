# -*- coding: utf-8 -*-
"""One pipeline diagram per research idea. Each is the concrete experiment, not a
generic ML loop — read left to right, top to bottom; dashed orange is feedback."""
from diagrams import B, A, dia
D = {}

D["multi-robot-marl"] = dia("Pipeline — coupled two-robot transport",
 "The contribution is the wrench sensor, not the policy. Everything is instrumented so the internal force "
 "is a reported quantity rather than a hidden one.",
 [B("sim",0,0,"1 · SIM",["2 M2 bases + arms","one rigid box","compliant grasp so","internal force is visible"]),
  B("mpc",1,0,"2 · BASELINE",["centralised MPC","from your distributed_mpc","reading — you need the","model-based answer first"]),
  B("rl",2,0,"3 · MAPPO",["centralised critic,","decentralised execution","reward = progress","− internal wrench"],kind="hi"),
  B("sweep",3,0,"4 · SWEEP",["penalty weight","speed vs squeeze","tradeoff curve","= headline figure"]),
  B("drift",1,1,"5 · INJECT DRIFT",["corrupt one agent's","object-pose estimate","measure degradation","vs the MPC baseline"]),
  B("real",2,1,"6 · TRANSFER",["two real M2 platforms","F/T at both wrists","report sim-to-real","force gap honestly"]),
  B("out",3,1,"RESULT",["internal wrench time","series + success rate","+ graceful-degradation","curve"],kind="out")],
 [A("sim","mpc"),A("mpc","rl"),A("rl","sweep"),A("sweep","drift",route="elbow"),
  A("drift","real"),A("real","out"),A("drift","rl",route="up",label="retune",style="fb")])

D["tactile-wm"] = dia("Pipeline — does the model see slip before the camera does?",
 "The whole design is arranged so slip-prediction lead time is measurable. The closed loop at the end is "
 "optional; the measurement is the paper.",
 [B("hand",0,0,"1 · INSTRUMENT",["GeoDex hand +","AnySkin / DexSkin","prioritise calibration","stability over resolution"]),
  B("data",1,0,"2 · SLIP DATA",["marginal-force lifts,","slow pull-outs, re-grasps","label slip onset from","tactile + object marker"]),
  B("model",2,0,"3 · FLARE-STYLE HEAD",["frozen visual encoder","+ tactile stream","predict future latent","(cheap — not a full WM)"],kind="hi"),
  B("eval",3,0,"4 · MEASURE",["slip lead time, as a","distribution not a mean","tactile vs vision-only","+ false-positive rate"],kind="out"),
  B("wm",1,1,"5 · SCALE UP",["V-JEPA2-style latent","predictive model over","fused vision+touch","only if step 4 holds"]),
  B("loop",2,1,"6 · CLOSE THE LOOP",["predicted contact latent","→ re-grasp policy","does recovery improve?"])],
 [A("hand","data"),A("data","model"),A("model","eval"),A("eval","wm",route="elbow"),
  A("wm","loop"),A("data","wm",route="down",label="same data",style="fb")])

D["ego-dex"] = dia("Pipeline — the three-way transfer comparison",
 "One hand, one task set, one capture rig. Everything except the transfer mechanism is held fixed — that is "
 "the whole point, and it is what nobody has run.",
 [B("fix",0,0,"1 · FIX THE SUBSTRATE",["one hand","5–8 tasks: power grasp","→ in-hand reorientation","one ego capture rig"]),
  B("a",1,0,"ARM A · REPRESENTATION",["R3M / V-JEPA2 frozen","encoder pretrained on","human video","+ small robot dataset"]),
  B("b",2,0,"ARM B · CO-TRAINING",["EgoMimic-style","normalised action spaces","human + robot in the","same batch"]),
  B("c",3,0,"ARM C · PIXEL EDIT",["Phantom-style inpainting","zero robot demonstrations","report inpainting quality","separately"]),
  B("curve",1,1,"2 · EXCHANGE RATE",["robot demos saved,","as a curve not a point","this curve is the","contribution"],kind="hi",span=2),
  B("axis",3,1,"3 · WHICH HOURS?",["hold total hours fixed,","vary diversity OR","annotation depth","(the 1M-hour question)"],kind="out")],
 [A("fix","a"),A("a","b"),A("b","c"),A("c","curve",route="elbow"),A("curve","axis"),
  A("curve","fix",route="around",side="l",label="add tasks where arms disagree",style="fb")])

D["rl-post-training"] = dia("Pipeline — budget-matched post-training comparison",
 "Reward instrumentation first: it is the thing that decides whether this project happens at all. Then three "
 "methods on one base policy, matched on wall-clock robot time.",
 [B("base",0,0,"1 · BASE POLICY",["one open VLA you can","actually fine-tune","OpenVLA + OFT head,","or a pi0-class model"]),
  B("rew",1,0,"2 · REWARD FIRST",["unattended binary","success detection","validate against human","labels before anything"],kind="hi"),
  B("pld",2,0,"3 · METHOD A",["PLD residual RL","lightweight actor fixes","failures, distil back","— backbone untouched"]),
  B("ript",3,0,"METHOD B / C",["RIPT-VLA: binary success","HIL-SERL: human","corrections in the buffer"]),
  B("budget",1,1,"4 · BUDGET MATCH",["same base, same tasks,","ONE HOUR of robot","time each"],span=2),
  B("out",3,1,"RESULT",["reliability vs minutes","+ which task properties","(precision / contact /","horizon) each fixes"],kind="out")],
 [A("base","rew"),A("rew","pld"),A("pld","ript"),A("ript","budget",route="elbow"),A("budget","out"),
  A("budget","rew",route="up",label="reward failures poison everything",style="fb")])

D["wam-umi-gloves"] = dia("Pipeline — recorded actions vs retargeted pseudo-actions",
 "Hours are no longer scarce, so the experiment is about action quality, not volume. Same model, same hours, "
 "two sources of action labels.",
 [B("cap",0,0,"1 · CAPTURE",["one rig, do not redesign","UMI for scenes/hour","RealDexUMI if you","need fingers"]),
  B("rec",1,0,"2A · RECORDED ACTIONS",["6-DoF EE pose from SLAM","gripper width","measure the pose-noise","floor before modelling it"],kind="hi"),
  B("ret",2,0,"2B · PSEUDO-ACTIONS",["Ego2Robot-style","retarget + visual synthesis","from the same footage","(the control condition)"]),
  B("flare",3,0,"3 · CHEAP TEST FIRST",["FLARE auxiliary","future-latent loss on a","diffusion policy","two weeks, not six months"]),
  B("wm",1,1,"4 · THE WAM",["V-JEPA2-style latent","predictive model","Genie latent actions as","fallback for bad tracks"],span=2),
  B("out",3,1,"RESULT",["scene-scaling curve","(log x-axis) +","recorded vs retargeted","at matched hours"],kind="out")],
 [A("cap","rec"),A("rec","ret"),A("ret","flare"),A("flare","wm",route="elbow"),A("wm","out"),
  A("wm","cap",route="around",side="l",label="more scenes, not more hours in one scene",style="fb")])

D["mobile-dex-umi"] = dia("Pipeline — in-the-wild dexterity on a moving base",
 "Validate the interface before collecting anything. The co-training ablation is the result that decides how "
 "much mobile data you actually need.",
 [B("stack",0,0,"1 · FIX THE STACK",["MABEL base","one hand","DexUMI / RealDexUMI","UMI-on-Legs interface"]),
  B("iface",1,0,"2 · VALIDATE FIRST",["can the whole-body","controller track a recorded","EE trajectory to a few cm?","if not, stop here"],kind="hi"),
  B("cap",2,0,"3 · CAPTURE",["≥10 distinct real scenes","three proves nothing —","scene diversity is the","entire argument"]),
  B("train",3,0,"4 · TRAIN",["diffusion / flow policy","on task-frame EE","trajectories"]),
  B("abl",1,1,"5 · CO-TRAINING ABLATION",["static-only / mobile-only / mixed","the mixing ratio is publishable","on its own (Mobile ALOHA saw 90%)"],kind="hi",span=2),
  B("out",3,1,"RESULT",["success in scenes the","robot never entered","+ released hardware","and data"],kind="out")],
 [A("stack","iface"),A("iface","cap"),A("cap","train"),A("train","abl",route="elbow"),A("abl","out"),
  A("abl","cap",route="up",label="collect where mixing fails",style="fb")])

D["hand-22dof"] = dia("Pipeline — build it as infrastructure, publish the property nobody measures",
 "DOF count is not a contribution any more. Durability, designed-in sensing and a validated sim model are.",
 [B("build",0,0,"1 · BUILD SOMEONE ELSE'S",["ORCA or Aero Hand first","two weeks","changes your design","opinions more than reading"]),
  B("map",1,0,"2 · LEARNED KINEMATICS",["RUKA's motor→joint map","from glove data","removes the hardest","modelling problem"],kind="hi"),
  B("sense",2,0,"3 · SENSING DESIGNED IN",["route for DexSkin /","AnySkin coverage BEFORE","freezing the mechanics","— retrofitting is worse"]),
  B("wear",3,0,"4 · WEAR PROTOCOL",["cycles to tendon","replacement, drift after N,","time to repair","nobody publishes this"],kind="out"),
  B("sim",1,1,"5 · VALIDATED MODEL",["MuJoCo model checked","against measured joint","trajectories under load","release both"],span=2),
  B("use",3,1,"6 · USE IT",["it is infrastructure for","ego-dex, tactile-WM and","the dexterous UMI"])],
 [A("build","map"),A("map","sense"),A("sense","wear"),A("wear","sim",route="elbow"),A("sim","use"),
  A("wear","sense",route="up",label="redesign what broke",style="fb")])

D["learned-retargeting"] = dia("Pipeline — build the benchmark, then beat it",
 "Retargeting is always evaluated through downstream policy success, which confounds it with policy quality. "
 "Measure it directly first.",
 [B("data",0,0,"1 · GROUND TRUTH CONTACT",["human demos with measured","contact — tactile-instrumented","object beats a glove","settle this before collecting"]),
  B("base",1,0,"2 · BASELINES",["dex-retargeting library","+ C2Dex (contact-consistent)","+ GMR","these define the bar"]),
  B("bench",2,0,"3 · THE BENCHMARK",["contact-set agreement","force-closure preservation","fingertip-contact recall","← the real contribution"],kind="hi"),
  B("cond",3,0,"4 · TASK-CONDITIONED",["predict the objective's","weights from the demo","segment — a pinch and a","power grasp differ"]),
  B("test",1,1,"5 · THE NAMED CASES",["two fingertips touching","holding a box","keypoint methods fail","visibly here"],span=2),
  B("out",3,1,"RESULT",["benchmark + a retargeter","that wins on it, and the","achievable ceiling per hand"],kind="out")],
 [A("data","base"),A("base","bench"),A("bench","cond"),A("cond","test",route="elbow"),A("test","out"),
  A("test","bench",route="up",label="cases the metric misses",style="fb")])

D["codesign-dex-agentic"] = dia("Pipeline — agentic co-design of a dexterous hand",
 "The agent proposes structure; gradients handle the numbers. Agents are better at discrete choices than at "
 "continuous parameters, and the loop is gated by a buildability check.",
 [B("space",0,0,"1 · DESIGN SPACE",["tendon routing, link ratios,","joint axes, actuator choice","bounded and BUILDABLE","(RoboGrammar's lesson)"]),
  B("agent",1,0,"2 · AGENT PROPOSES",["structural changes only:","add an MCP joint, move","the thumb opposition axis","— not the numbers"],kind="hi"),
  B("grad",2,0,"3 · GRADIENTS",["Hardware-as-Policy:","mechanism params inside","the policy network","differentiable contact"]),
  B("train",3,0,"4 · EVALUATE",["design-conditioned policy","(Meta-RL-legged trick) —","otherwise every candidate","costs an RL run"]),
  B("task",1,1,"5 · THE OBJECTIVE",["in-hand reorientation success","across an object set —","real prior art to beat","(Chen, DeXtreme)"],span=2),
  B("build",3,1,"6 · BUILD THE WINNER",["an unbuilt co-design","result is a simulation","paper"],kind="out")],
 [A("space","agent"),A("agent","grad"),A("grad","train"),A("train","task",route="elbow"),A("task","build"),
  A("task","agent",route="up",label="curves + failure traces back to the agent",style="fb")])

D["auto-research-dex"] = dia("Pipeline — an agent that can actually diagnose",
 "The difference from Eureka is the feedback channel: contact and trajectory traces instead of a scalar reward "
 "curve. A failed in-hand rotation is not diagnosable from a number.",
 [B("repro",0,0,"1 · REPRODUCE EUREKA",["one in-hand task, one week","calibrates every intuition","about what the agent","can and cannot do"]),
  B("trace",1,0,"2 · STRUCTURED FEEDBACK",["contact events, joint limits","hit, object drop times","'thumb lost purchase at","40% of the rollout'"],kind="hi"),
  B("agent",2,0,"3 · AGENT LOOP",["writes reward code,","reads the traces,","diagnoses, revises","(RF-Agent tree search)"]),
  B("train",3,0,"4 · TRAIN",["Isaac Lab, parallel","hold out an honest eval","the reward cannot touch"]),
  B("bench",1,1,"5 · THE MEASUREMENT",["agent iterations to a target","success rate, vs a human","researcher on the same task","— nobody reports this"],kind="out",span=2),
  B("real",3,1,"6 · THEN REAL",["through the physical","RL harness — HARBOR","already did simulation"])],
 [A("repro","trace"),A("trace","agent"),A("agent","train"),A("train","bench",route="elbow"),A("bench","real"),
  A("train","trace",route="up",label="traces, not scalars",style="fb")])

D["codesign-dog-rl"] = dia("Pipeline — derive the spine from the dog, then build it",
 "S-Cheetah is simulation-only, so the hardware leg is the claim that cannot be scooped by a simulation paper. "
 "The lockable spine gives the cleanest possible ablation on identical hardware.",
 [B("dogmo",0,0,"1 · MEASURE THE ANIMAL",["DogMo: 1.2k multi-view","RGB-D sequences, 10 dogs","+ BARC / CORGI for shape","cross-check with Animal-Avatars"]),
  B("fit",1,0,"2 · FIT A TRUNK MODEL",["variable number of joints","honest model selection","→ how many DOF does the","data actually support?"],kind="hi"),
  B("co",2,0,"3 · JOINT CO-DESIGN",["segment lengths AND spine","DOF / placement / stiffness","coupled via the spine–limb","phase relationship"]),
  B("policy",3,0,"4 · DESIGN-CONDITIONED",["one policy over designs","(Meta-RL-legged)","Isaac Lab parallel","else the search is unaffordable"]),
  B("build",1,1,"5 · BUILD IT SMALL",["5–8 kg, not S-Cheetah's 20","off-the-shelf QDD actuators","spine LOCKABLE + instrumented","design it to be serviced"],kind="hi",span=2),
  B("out",3,1,"RESULT",["spine on vs off, same","hardware · derived vs","hand-designed · DESIGN","sim-to-real gap"],kind="out")],
 [A("dogmo","fit"),A("fit","co"),A("co","policy"),A("policy","build",route="elbow"),A("build","out"),
  A("build","co",route="up",label="what broke → constrain the search",style="fb")])

D["transformer-robot"] = dia("Pipeline — control through a topology change",
 "The mechanism is demonstrated (J-deite, Robosen); the control is not. Everything here is arranged around the "
 "one comparison nobody has run: get-up policy vs fold-and-right.",
 [B("small",0,0,"1 · BUILD SMALL",["~0.5 m, Robosen scale","printed, QDD actuators","it will fall constantly —","make that cheap"]),
  B("act",1,0,"2 · ACTUATOR DOUBLE DUTY",["driving: high speed, low torque","standing: the opposite","two actuators (mass) or a","transmission (complexity) — decide"],kind="hi"),
  B("ends",2,0,"3 · ENDPOINTS FIRST",["driving policy","walking policy","separately, in Isaac Lab","do not attempt the transition yet"]),
  B("dyn",3,0,"4 · MODEL THE CHANGE",["changing-morphology","Lagrangian dynamics —","reassemble per mode rather","than re-derive"]),
  B("trans",1,1,"5 · TRANSFORMATION POLICY",["morphology parameter in the observation (GCNT / hypernet)","reward: stay in the support polygon through the contact-set","migration, finish in under 2 s (vs J-deite's 60)"],kind="hi",span=2),
  B("recov",3,1,"6 · THE EXPERIMENT",["drop from N postures:","learned get-up  vs","fold-to-wheeled-and-right","success, time, energy"],kind="out"),
  B("budget",1,2,"7 · POLICY BUDGET",["distil the specialists into one masked policy (HOVER-style)","and measure exactly what each behaviour loses","— the systems number the field is missing"],kind="out",span=2)],
 [A("small","act"),A("act","ends"),A("ends","dyn"),A("dyn","trans",route="elbow"),A("trans","recov"),
  A("trans","budget",route="down"),A("recov","trans",route="up",label="postures where each fails",style="fb")])

D["agentic-physical"] = dia("Pipeline — memory across attempts",
 "Dual-system VLAs already reason and act. The change is small: a structured per-object memory, and an "
 "evaluation curve no current system has a positive slope on.",
 [B("stack",0,0,"1 · START FROM A STACK",["GR00T N1 is open","do not build an agent","framework from scratch","Cosmos-Reason as System 2"]),
  B("mem",1,0,"2 · ADD MEMORY",["per object / per scene:","failure modes, observed mass,","grasp poses that worked","small and structured, not a vector DB"],kind="hi"),
  B("attempt",2,0,"3 · ATTEMPT",["act · observe outcome ·","write to memory","condition the next attempt","on what happened"]),
  B("eval",3,0,"4 · THE CURVE",["success rate vs ATTEMPT","NUMBER on the same task","instance — no current","system has a positive slope"],kind="out"),
  B("skill",1,1,"5 · ONLY IF IT HOLDS",["Voyager-style growing","skill library + self-","proposed curriculum"],span=2),
  B("harness",3,1,"6 · RUN IT UNATTENDED",["on the physical RL","harness tasks — repeated","attempts need no operator"])],
 [A("stack","mem"),A("mem","attempt"),A("attempt","eval"),A("eval","skill",route="elbow"),A("skill","harness"),
  A("attempt","mem",route="up",label="what happened",style="fb")])

D["rl-harness"] = dia("Pipeline — the physical harness HARBOR did not build",
 "HARBOR automated the simulated workflow. This is the real-world half: reward detection is most of the work, "
 "and the 72-hour failure log is more valuable than the learning curves.",
 [B("tasks",0,0,"1 · SELF-RESETTING TASKS",["peg into a fixture, hinged","door, sliding drawer,","tethered object","refuse anything a human tidies"]),
  B("rew",1,0,"2 · REWARD DETECTION",["per task, validated against","human labels over a few","hundred episodes","5% error is worse than none"],kind="hi"),
  B("wrap",2,0,"3 · WRAP, DON'T WRITE",["SERL / RLinf-VLA","reset controllers","logging + safety limits"]),
  B("run",3,0,"4 · 72 HOURS UNATTENDED",["and write down","everything that broke"],kind="hi"),
  B("base",1,1,"5 · BASELINES",["RLPD · HIL-SERL · PLD","same tasks, same time budget","on the same hardware"],span=2),
  B("out",3,1,"RELEASE",["printable fixtures,","the failure log, and the","baseline curves"],kind="out")],
 [A("tasks","rew"),A("rew","wrap"),A("wrap","run"),A("run","base",route="elbow"),A("base","out"),
  A("run","rew",route="up",label="every false positive",style="fb")])

D["wm-residual"] = dia("Pipeline — a world model whose backbone is a simulator",
 "The residual must be capacity-constrained, or it just learns the dynamics and you are back where you started. "
 "Two falsifiable numbers at the end.",
 [B("task",0,0,"1 · PICK THE REGIME",["contact-rich insertion or","in-hand rotation — where the","analytic model is GOOD but","not perfect. Not free space."]),
  B("base",1,0,"2 · TWO BASELINES",["pure learned world model","(TD-MPC2 is cheapest)","and sim-only","you need both"]),
  B("res",2,0,"3 · THE HYBRID",["MuJoCo rollout +","learned residual on the","state delta — ASAP's","delta-action as a DYNAMICS model"],kind="hi"),
  B("cap",3,0,"4 · CONSTRAIN IT",["cap residual capacity and","report what fraction of the","prediction the PRIOR explains","— else it absorbs everything"],kind="hi"),
  B("m1",1,1,"5 · SAMPLE COMPLEXITY",["steps to a fixed success rate,","three ways, matched final","performance"],span=2),
  B("m2",3,1,"6 · ROLLOUT DIVERGENCE",["error vs horizon length","— where physics-backed","should win by a lot"],kind="out")],
 [A("task","base"),A("base","res"),A("res","cap"),A("cap","m1",route="elbow"),A("m1","m2"),
  A("cap","res",route="up",label="shrink until the prior carries it",style="fb")])

D["auto-research-wm"] = dia("Pipeline — does model-based triage save robot time?",
 "Calibration is the gate: if the model cannot rank known-outcome variants, stop. The false-negative rate is "
 "the number that decides whether anyone should use this.",
 [B("narrow",0,0,"1 · NARROW IT",["one task family","hypothesis space = reward","and controller variants,","not open-ended ideas"]),
  B("wm",1,0,"2 · A WORLD MODEL",["TD-MPC2 or a FLARE-","style auxiliary head","cheap beats faithful here"]),
  B("cal",2,0,"3 · CALIBRATE — THE GATE",["rank 20 variants whose real","outcome you already know","weak correlation → STOP,","the rest is meaningless"],kind="hi"),
  B("triage",3,0,"4 · TRIAGE RUN",["agent proposes, model","filters, only survivors","reach the robot","(HARBOR orchestrates)"]),
  B("out",1,1,"5 · THE MEASUREMENT",["robot-hours to the same conclusion, with and without","model filtering — and the FALSE-NEGATIVE rate, because a","model that rejects a good hypothesis is worse than no filter"],kind="out",span=3)],
 [A("narrow","wm"),A("wm","cal"),A("cal","triage"),A("triage","out",route="elbow"),
  A("triage","wm",route="up",label="real outcomes correct the model",style="fb")])

D["third-person"] = dia("Pipeline — the ego-vs-exo study nobody has run",
 "Ego-Exo4D's paired structure is the entire reason this is cheap. Fix everything but viewpoint and report per "
 "task category, because the answer is certainly 'it depends'.",
 [B("data",0,0,"1 · PAIRED DATA",["Ego-Exo4D: 1,286 h,","time-synchronised ego +","exo of the SAME activity","740 participants"]),
  B("fix",1,0,"2 · FIX EVERYTHING ELSE",["one policy class","one pretraining recipe","one task set","viewpoint is the only variable"],kind="hi"),
  B("arms",2,0,"3 · FOUR ARMS",["ego-only · exo-only · both","+ Phantom-style editing,","which should be the most","viewpoint-robust"]),
  B("cat",3,0,"4 · PER CATEGORY",["fine manipulation vs","whole-body vs scene layout","— the aggregate number","hides the finding"]),
  B("conf",1,1,"5 · CONTROL CONFOUNDS",["ego and exo clips differ in","resolution, blur and framing","as well as viewpoint","report what you cannot control"],span=2),
  B("out",3,1,"RESULT",["which camera to buy,","given a task type —","currently folklore,","not a measurement"],kind="out")],
 [A("data","fix"),A("fix","arms"),A("arms","cat"),A("cat","conf",route="elbow"),A("conf","out"),
  A("cat","arms",route="up",label="add the augmentation arm",style="fb")])

D["hri-collab"] = dia("Pipeline — measuring who adapts to whom",
 "The human-human baseline is the step everyone skips and the only thing that makes the measurement mean "
 "anything. This is a novel measurement, not a novel controller.",
 [B("rig",0,0,"1 · REUSE M2",["collaborative transport rig,","human replaces one robot","instrumentation already there","+ ethics approval, budget time"]),
  B("hh",1,0,"2 · HUMAN–HUMAN BASELINE",["the SAME task, two people","without this there is nothing","to compare against — and it","is what everyone skips"],kind="hi"),
  B("meas",2,0,"3 · MEASURE BOTH SIDES",["trajectory deviation from","solo behaviour, internal force,","lead/follow switching rate","(Kaiwu, MoGaze, InteRACT)"]),
  B("intent",3,0,"4 · INTERVENE",["add intent inference","(robot-conditioned, InteRACT-","style) + FALCON force-","adaptive whole-body control"]),
  B("out",1,1,"5 · THE RESULT",["does the human's adaptation burden drop when the robot","infers intent? Report objective measures first, subjective","comfort second — the field does it the other way round"],kind="out",span=3)],
 [A("rig","hh"),A("hh","meas"),A("meas","intent"),A("intent","out",route="elbow"),
  A("intent","meas",route="up",label="re-measure with the module on",style="fb")])

D["soft-sim2real"] = dia("Pipeline — separate the two gaps",
 "Everyone attacks one gap and inherits the other. The 2×2 is the contribution; the policy is incidental. "
 "Tactile is the fifth condition because touch disambiguates cloth state that vision cannot.",
 [B("task",0,0,"1 · ONE CLEAN TASK",["towel folding or rope","threading — avoid anything","where success is subjective","settle ground truth first"]),
  B("grid",1,0,"2 · THE 2×2",["physics: real | sim","rendering: real | sim","four conditions, one task,","one policy class"],kind="hi",span=2),
  B("tools",3,0,"3 · THE TWO AXES",["rendering: Phantom-style","pixel editing / SimWeaver","physics: ASAP-style learned","delta model"]),
  B("res",1,1,"4 · RESIDUAL ARM",["how much of the physics","gap does a learned delta","model close?"]),
  B("tac",2,1,"5 · TACTILE ARM",["add touch as a fifth","condition — should help","disproportionately for","cloth and rope"]),
  B("out",3,1,"RESULT",["the decomposition:","which gap to spend","money on. Nobody has","measured it."],kind="out")],
 [A("task","grid"),A("grid","tools"),A("tools","res",route="elbow"),A("res","tac"),A("tac","out"),
  A("res","grid",route="up",label="fold the corrected physics back in",style="fb")])

# -*- coding: utf-8 -*-
"""Curated Imitation-Learning tree."""
ROWS = []
def P(id, title, **k):
    k["id"] = id; k["title"] = title; k["tree"] = "il"; ROWS.append(k)

# ---------------------------------------------------------------- foundations
P("alvinn","ALVINN: An Autonomous Land Vehicle in a Neural Network",
  a="Dean A. Pomerleau", inst="Carnegie Mellon University", v="NeurIPS", vt="conference",
  y=1989, d="1989-12-01", br="foundations", top="behaviour cloning, end-to-end driving", par="BC",
  st=2, note="Behaviour cloning, 1989. Worth keeping in the tree as the reminder that the architecture "
             "changed and the failure mode (compounding error off-distribution) did not.",
  rel="dagger,bc-zero")
P("dagger","A Reduction of Imitation Learning and Structured Prediction to No-Regret Online Learning",
  a="Stéphane Ross; Geoffrey J. Gordon; J. Andrew Bagnell", corr="Stéphane Ross",
  inst="Carnegie Mellon University", v="AISTATS", vt="conference", y=2011, d="2010-11-02",
  br="foundations", top="covariate shift, interactive imitation", par="BC",
  meth="iteratively aggregate expert labels on the learner's own state distribution", arx="1011.0686", st=3,
  note="The formal statement of why naive BC drifts, and the fix. Every 'human-in-the-loop correction' "
       "system since — including HIL-SERL — is DAgger with better ergonomics.",
  rel="alvinn,hil-serl,bc-zero")
P("gail","Generative Adversarial Imitation Learning",
  a="Jonathan Ho; Stefano Ermon", inst="Stanford University", v="NeurIPS", vt="conference",
  y=2016, d="2016-06-10", br="foundations", top="adversarial imitation, occupancy matching", par="adversarial IL",
  arx="1606.03476", st=2, note="Imitation as distribution matching rather than action regression. AMP is "
  "this idea moved into physics-based character control.", rel="amp,add")
P("implicit-bc","Implicit Behavioral Cloning",
  a="Pete Florence; Corey Lynch; Andy Zeng; Oscar Ramirez; Ayzaan Wahid; Laura Downs; Adrian Wong; Johnny Lee; Igor Mordatch; Jonathan Tompson",
  inst="Google", lab="Robotics at Google", v="CoRL", vt="conference", y=2021, d="2021-09-01",
  br="foundations", top="energy-based policies, multimodality", par="BC",
  meth="EBM over (observation, action) instead of explicit regression", arx="2109.00137", st=2,
  note="Identified the problem diffusion policy later solved better: regressing to the mean of a multimodal "
       "demonstration set produces an action that satisfies nobody.",
  rel="dp,act")

# ---------------------------------------------------------------- visuomotor architectures
P("act","Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware",
  a="Tony Z. Zhao; Vikash Kumar; Sergey Levine; Chelsea Finn", corr="Tony Z. Zhao",
  inst="Stanford University; UC Berkeley; Meta AI", lab="Stanford IRIS Lab (Chelsea Finn)",
  v="RSS", vt="conference", y=2023, d="2023-04-23", br="visuomotor",
  top="action chunking, bimanual manipulation, low-cost hardware", par="IL, CVAE",
  meth="action-chunking transformer with CVAE latent, temporal ensembling", arx="2304.13705", st=3,
  note="ACT + ALOHA, the paper your IRIS CVAE stack descends from. The two ideas that carried: predict a "
       "chunk of future actions rather than one step (kills compounding error), and ensemble overlapping "
       "chunks at inference (kills jitter). The CVAE latent matters less than either.",
  rel="aloha2,mobile-aloha,dp,pi0,alohaunleashed", pr="iris", id_="learned-retargeting")
P("dp","Diffusion Policy: Visuomotor Policy Learning via Action Diffusion",
  a="Cheng Chi; Siyuan Feng; Yilun Du; Zhenjia Xu; Eric Cousineau; Benjamin Burchfiel; Shuran Song",
  corr="Cheng Chi; Shuran Song", inst="Columbia University; Toyota Research Institute; MIT",
  lab="Columbia/Stanford REALab (Shuran Song)", v="RSS", vt="conference", y=2023, d="2023-03-07",
  br="visuomotor", top="diffusion policy, multimodal actions, visuomotor control", par="IL, diffusion",
  meth="DDPM over action sequences, receding-horizon execution, FiLM-conditioned U-Net", arx="2303.04137", st=3,
  note="Sitting on your Desktop as 2303.04137v5-3.pdf. The action-decoder that became the default. It beats "
       "ACT mainly on multimodal tasks where averaging demonstrations is fatal; ACT is still faster and "
       "simpler when demonstrations are unimodal.",
  rel="act,dp3,manflow,consistency-policy,pi0,implicit-bc", pr="iris")
P("dp3","3D Diffusion Policy: Generalizable Visuomotor Policy Learning via Simple 3D Representations",
  a="Yanjie Ze; Gu Zhang; Kangning Zhang; Chenyuan Hu; Muhan Wang; Huazhe Xu",
  corr="Yanjie Ze", inst="Shanghai Qi Zhi Institute; Tsinghua University; Stanford University",
  v="RSS", vt="conference", y=2024, d="2024-03-06", br="visuomotor",
  top="3D representations, point clouds, sample efficiency", par="IL, diffusion",
  meth="sparse point-cloud encoder + diffusion action head", arx="2403.03954", st=2,
  note="Swapping RGB for a compact point cloud buys a large jump in sample efficiency and view robustness. "
       "Relevant to IRIS if you ever move off pure RGB.",
  rel="dp,manflow", pr="iris")
P("consistency-policy","Consistency Policy: Accelerated Visuomotor Policies via Consistency Distillation",
  a="Aaditya Prasad; Kevin Lin; Jimmy Wu; Linqi Zhou; Jeannette Bohg",
  inst="Stanford University", lab="Stanford IPRL (Bohg)", v="RSS", vt="conference", y=2024,
  d="2024-05-13", br="visuomotor", top="policy distillation, inference speed", par="IL, diffusion",
  arx="2405.07503", st=2, note="Diffusion policy at usable control rates via consistency distillation. "
  "Matters the moment you want DP on a 200 Hz arm.", rel="dp,manflow,conrft")
P("manflow","ManiFlow: A General Robot Manipulation Policy via Consistency Flow Training",
  a="Ge Yan; Jiyue Zhu; Yuquan Deng; Shiqi Yang; Ri-Zhao Qiu; Xuxin Cheng; Marius Memmel; Ranjay Krishna; Ankit Goyal; Xiaolong Wang; Dieter Fox",
  inst="UC San Diego; University of Washington; NVIDIA", v="CoRL", vt="conference", y=2025,
  br="visuomotor", top="flow matching, general manipulation policy", par="IL, flow matching",
  st=2, note="From your CoRL 2025 folder. Flow matching is quietly displacing DDPM as the action decoder — "
             "same multimodality, far fewer inference steps.",
  rel="dp,consistency-policy,pi0")
P("alohaunleashed","ALOHA Unleashed: A Simple Recipe for Robot Dexterity",
  a="Tony Z. Zhao; Jonathan Tompson; Danny Driess; Pete Florence; Kamyar Ghasemipour; Chelsea Finn; Ayzaan Wahid",
  inst="Google DeepMind", lab="DeepMind Robotics", v="CoRL", vt="conference", y=2024,
  d="2024-10-17", br="visuomotor", top="bimanual dexterity, diffusion, scale", par="IL, diffusion",
  arx="2410.13126", st=2, note="In your CRV_iris/imitation folder. The 'just scale demonstrations + a "
  "transformer diffusion head' recipe, on genuinely hard bimanual tasks (shoelaces, shirt hanging).",
  rel="act,dp,aloha2", pr="iris")
P("rt1","RT-1: Robotics Transformer for Real-World Control at Scale",
  a="Anthony Brohan; Noah Brown; Justice Carbajal; Yevgen Chebotar; Joseph Dabis; et al.",
  inst="Google", lab="Robotics at Google", v="RSS", vt="conference", y=2023, d="2022-12-13",
  br="visuomotor", top="robot transformer, tokenized actions, scale", par="IL, transformer",
  arx="2212.06817", st=3, note="The first convincing demonstration that robot policies follow the "
  "data-scaling curve. Discretized action tokens, 130k episodes, 700 tasks.",
  rel="rt2,octo,oxe,pi0")
P("octo","Octo: An Open-Source Generalist Robot Policy",
  a="Octo Model Team: Dibya Ghosh; Homer Walke; Karl Pertsch; Kevin Black; Oier Mees; et al.",
  inst="UC Berkeley; Stanford University; Google DeepMind", lab="BAIR (RAIL)", v="RSS", vt="conference",
  y=2024, d="2024-05-20", br="visuomotor", top="generalist policy, open weights, cross-embodiment", par="IL, transformer",
  meth="transformer with diffusion action head, trained on Open X-Embodiment", arx="2405.12213", st=2,
  note="The open baseline before OpenVLA. Still the easiest generalist policy to actually fine-tune.",
  rel="oxe,openvla,crossformer,rt1")
P("crossformer","Scaling Cross-Embodied Learning: One Policy for Manipulation, Navigation, Locomotion and Aviation",
  a="Ria Doshi; Homer Walke; Oier Mees; Sudeep Dasari; Sergey Levine", corr="Ria Doshi",
  inst="UC Berkeley", lab="BAIR (RAIL)", v="CoRL", vt="conference", y=2024, d="2024-08-21",
  br="visuomotor", top="cross-embodiment, unified policy", par="IL, transformer",
  arx="2408.11812", st=2, note="One transformer across arms, quadrupeds, drones and navigation, with no "
  "shared action space. Relevant to M2 if you want one policy across heterogeneous robots.",
  rel="octo,oxe,multi-loco", pr="m2")

# ---------------------------------------------------------------- VLA
P("rt2","RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control",
  a="Anthony Brohan; Noah Brown; Justice Carbajal; Yevgen Chebotar; Xi Chen; et al.",
  inst="Google DeepMind", lab="DeepMind Robotics", v="CoRL", vt="conference", y=2023, d="2023-07-28",
  br="vla", top="vision-language-action, web knowledge transfer", par="VLA",
  meth="co-fine-tune a VLM on web VQA and robot trajectories, actions as text tokens", arx="2307.15818", st=3,
  note="Defined the VLA category: actions as another language the VLM speaks, so web semantics leak into "
       "the policy. Everything from OpenVLA to π0.5 is arguing with this design.",
  rel="rt1,openvla,pi0,gemini-robotics")
P("openvla","OpenVLA: An Open-Source Vision-Language-Action Model",
  a="Moo Jin Kim; Karl Pertsch; Siddharth Karamcheti; Ted Xiao; Ashwin Balakrishna; et al.",
  corr="Moo Jin Kim", inst="Stanford University; UC Berkeley; Toyota Research Institute; Google DeepMind",
  lab="Stanford IRIS", v="CoRL", vt="conference", y=2024, d="2024-06-13", br="vla",
  top="open-source VLA, 7B, LoRA fine-tuning", par="VLA",
  meth="Prismatic VLM backbone + discretized actions, trained on 970k OXE episodes", arx="2406.09246", st=3,
  note="The VLA everyone actually fine-tunes, because the weights and the training code are both open. "
       "OpenVLA-OFT later showed the discretized action head was the bottleneck, not the backbone.",
  rel="rt2,openvla-oft,pi0,oxe,iRe-VLA", id_="rl-post-training")
P("openvla-oft","Fine-Tuning Vision-Language-Action Models: Optimizing Speed and Success",
  a="Moo Jin Kim; Chelsea Finn; Percy Liang", inst="Stanford University", lab="Stanford IRIS",
  v="arXiv", vt="preprint", y=2025, d="2025-02-27", br="vla",
  top="VLA fine-tuning, action chunking, parallel decoding", par="VLA",
  meth="continuous actions + parallel decoding + action chunking instead of autoregressive tokens",
  arx="2502.19645", st=2,
  note="26x faster inference and higher success by dropping autoregressive action tokens. A useful corrective "
       "to the assumption that VLA quality lives in the language model.",
  rel="openvla,act,pi0")
P("pi0","π0: A Vision-Language-Action Flow Model for General Robot Control",
  a="Kevin Black; Noah Brown; Danny Driess; Adnan Esmail; Michael Equi; Chelsea Finn; Niccolo Fusai; et al.",
  inst="Physical Intelligence", lab="Physical Intelligence (π)", v="RSS", vt="conference", y=2025,
  d="2024-10-31", br="vla", top="flow matching VLA, generalist control, dexterity", par="VLA, flow matching",
  meth="PaliGemma VLM + flow-matching action expert at 50 Hz, trained on 10k+ hours", arx="2410.24164", st=3,
  note="The model that made continuous high-frequency VLA action heads standard. Flow matching gives you "
       "50 Hz dexterous output that discretized tokens cannot reach — laundry folding as the headline task.",
  rel="pi05,rt2,openvla,manflow,pi06", pr="iris", id_="rl-post-training")
P("pi05","π0.5: a Vision-Language-Action Model with Open-World Generalization",
  a="Kevin Black; Noah Brown; James Darpinian; Karan Dhabalia; Danny Driess; Adnan Esmail; et al.",
  inst="Physical Intelligence", lab="Physical Intelligence (π)", v="CoRL", vt="conference", y=2025,
  d="2025-04-22", br="vla", top="open-world generalization, heterogeneous co-training, mobile manipulation",
  par="VLA, flow matching",
  meth="co-training on robot data + web data + high-level subtask prediction; discrete then flow decoding",
  arx="2504.16054", st=3,
  note="In your CoRL 2025 folder. Cleans an unseen kitchen it has never entered. The lesson is the data "
       "recipe, not the architecture: heterogeneous co-training (web VQA, subtask labels, other robots) is "
       "what produces open-world behaviour.",
  rel="pi0,pi06,rt2,tidybot2", pr="iris")
P("pi06","π*0.6: a VLA That Learns From Experience",
  a="Physical Intelligence", inst="Physical Intelligence", lab="Physical Intelligence (π)",
  v="arXiv", vt="preprint", y=2025, d="2025-11-05", br="vla",
  top="RL from experience, advantage-conditioned policy, real-world improvement", par="VLA, RL",
  meth="RECAP: RL with experience and corrections via advantage conditioning", arx="2511.03207", st=3,
  note="The direct precedent for your RL-post-training idea, from the people with the most robot data. "
       "Demonstrations get you a policy; on-robot experience plus corrections is what roughly halves the "
       "failure rate. Verify the exact numbers against the paper before citing.",
  rel="pi05,hil-serl,ript-vla,iRe-VLA", id_="rl-post-training")
P("groot-n1","GR00T N1: An Open Foundation Model for Generalist Humanoid Robots",
  a="NVIDIA: Johan Bjorck; Fernando Castañeda; Nikita Cherniadev; Xingye Da; Runyu Ding; et al.",
  inst="NVIDIA", lab="NVIDIA GEAR Lab", v="arXiv", vt="preprint", y=2025, d="2025-03-18",
  br="vla", top="humanoid foundation model, dual-system architecture", par="VLA, diffusion",
  meth="System-2 VLM for reasoning + System-1 diffusion transformer for 120 Hz actions", arx="2503.14734", st=3,
  note="The open humanoid foundation model, and the clearest statement of the dual-system (slow reasoning / "
       "fast control) split that most 2025-26 VLAs converged on.",
  rel="pi0,gemini-robotics,humanoid-policy,helix", pr="mabel")
P("gemini-robotics","Gemini Robotics: Bringing AI into the Physical World",
  a="Google DeepMind Robotics Team", inst="Google DeepMind", lab="DeepMind Robotics",
  v="arXiv", vt="preprint", y=2025, d="2025-03-25", br="vla",
  top="VLA, embodied reasoning, dexterity", par="VLA",
  meth="Gemini 2.0 backbone + embodied reasoning (ER) variant + action decoder", arx="2503.20020", st=3,
  note="The frontier-lab entry. The interesting half is Gemini Robotics-ER: spatial and physical reasoning "
       "evaluated separately from control, which is the right way to attribute VLA failures.",
  rel="rt2,pi05,groot-n1")
P("helix","Helix: A Vision-Language-Action Model for Generalist Humanoid Control",
  a="Figure AI", inst="Figure AI", lab="Figure AI", v="blog", vt="industry", y=2025, d="2025-02-20",
  br="vla", top="humanoid VLA, dual-system, upper-body control", par="VLA",
  site="https://www.figure.ai/news/helix", st=2,
  note="Industry blog, not a paper — included because the S1/S2 split (7-9 Hz VLM, 200 Hz visuomotor) became "
       "a reference architecture and because you asked for startup blogs. Treat claims as unreviewed.",
  rel="groot-n1,pi0,sunday-gelato", pr="mabel")
P("dexvla","DexVLA: Vision-Language Model with Plug-In Diffusion Expert for General Robot Control",
  a="Junjie Wen; Yichen Zhu; Jinming Li; Zhibin Tang; Chaomin Shen; Feifei Feng",
  inst="Midea Group; East China Normal University", v="CoRL", vt="conference", y=2025, d="2025-02-09",
  br="vla", top="plug-in diffusion expert, dexterous VLA", par="VLA, diffusion",
  arx="2502.05855", st=2, note="From your CoRL 2025 folder. A billion-parameter diffusion 'expert' that plugs "
  "into a frozen VLM — a modular alternative to co-training everything.", rel="pi0,groot-n1,openvla")
P("rdt1b","RDT-1B: a Diffusion Foundation Model for Bimanual Manipulation",
  a="Songming Liu; Lingxuan Wu; Bangguo Yu; Hengkai Tan; Huayu Chen; Zhengyi Wang; Chengyang Xu; Hang Su; Jun Zhu",
  corr="Jun Zhu", inst="Tsinghua University", lab="Tsinghua TSAIL", v="ICLR", vt="conference",
  y=2025, d="2024-10-10", br="vla", top="bimanual foundation model, diffusion transformer", par="VLA, diffusion",
  arx="2410.07864", st=2, note="Largest open bimanual diffusion foundation model at release, with a "
  "physically-interpretable unified action space across embodiments.", rel="pi0,groot-n1,act", pr="mabel")
P("humanoid-policy","Humanoid Policy ~ Human Policy",
  a="Ri-Zhao Qiu; Shiqi Yang; Xuxin Cheng; Chaitanya Chawla; Jialong Li; Tairan He; Ge Yan; et al.",
  inst="UC San Diego; Carnegie Mellon University; University of Washington", v="CoRL", vt="conference",
  y=2025, d="2025-03-17", br="vla", top="human-humanoid co-training, egocentric data", par="VLA, IL",
  arx="2503.13441", st=3,
  note="In your library twice (RL/corl_final.pdf and the CoRL folder). Trains one policy on human egocentric "
       "video and humanoid teleop jointly by making the action spaces commensurate. Central to your "
       "egocentric-video-for-dexterity idea.",
  rel="egomimic,groot-n1,phantom,ego4d", pr="mabel", id_="ego-dex,third-person")

# ---------------------------------------------------------------- in-context / few-shot
P("icrt","In-Context Imitation Learning via Next-Token Prediction",
  a="Letian Fu; Huang Huang; Gaurav Datta; Lawrence Yunliang Chen; William Chung-Ho Panitch; Fangchen Liu; Hui Li; Ken Goldberg",
  corr="Letian Fu", inst="UC Berkeley", lab="AUTOLAB", v="CVPR", vt="conference", y=2025,
  d="2024-08-28", br="in-context", top="in-context learning, next-token prediction, few-shot", par="IL, transformer",
  meth="prompt the policy with a handful of demo trajectories at test time, no weight updates",
  arx="2408.15980", st=3,
  note="You asked for in-context learning specifically — this is the cleanest robot instantiation. Give the "
       "transformer a few demos as context and it performs the new task without fine-tuning.",
  rel="robocat,one-demo,vid2robot,rt1")
P("robocat","RoboCat: A Self-Improving Generalist Agent for Robotic Manipulation",
  a="Konstantinos Bousmalis; Giulia Vezzani; Dushyant Rao; Coline Devin; Alex X. Lee; et al.",
  inst="Google DeepMind", lab="DeepMind Robotics", v="TMLR", vt="journal", y=2023, d="2023-06-20",
  br="in-context", top="self-improvement, few-shot adaptation, multi-embodiment", par="IL",
  meth="fine-tune on 100-1000 demos, then self-generate data for the next round", arx="2306.11706", st=2,
  note="The self-improvement loop: adapt, generate your own data, fold it back in. A concrete template for "
       "the auto-research idea, minus the hypothesis generation.",
  rel="icrt,gato,auto-research-ref", id_="auto-research-wm,agentic-physical")
P("one-demo","One Demo is Worth a Thousand Trajectories: Action-View Augmentation for Visuomotor Policies",
  a="Chuer Pan; Litian Liang; Dominik Bauer; et al.", inst="Stanford University; Columbia University",
  v="CoRL", vt="conference", y=2025, br="in-context", top="data augmentation, single demonstration", par="IL",
  st=2, note="From your CoRL 2025 folder. Augmenting the viewpoint and action of one demo to synthesize many "
             "— the cheap alternative to collecting more.", rel="icrt,dp,umi")
P("vid2robot","Vid2Robot: End-to-end Video-conditioned Policy Learning with Cross-Attention Transformers",
  a="Vidhi Jain; Maria Attarian; Nikhil J Joshi; Ayzaan Wahid; Danny Driess; Quan Vuong; et al.",
  inst="Carnegie Mellon University; Google DeepMind", v="RSS", vt="conference", y=2024, d="2024-03-19",
  br="in-context", top="video-conditioned policy, human prompt video", par="IL",
  arx="2403.12943", st=2, note="Condition the policy on a human video of the task instead of a language "
  "string. A bridge between in-context learning and learning from human video.",
  rel="icrt,mimicfunc,human-video-survey", id_="third-person")

# ---------------------------------------------------------------- world models / WAM
P("worldmodels","World Models",
  a="David Ha; Jürgen Schmidhuber", inst="Google Brain; IDSIA", v="NeurIPS", vt="conference",
  y=2018, d="2018-03-27", br="world-models", top="latent dynamics, learning in imagination", par="world model",
  arx="1803.10122", st=3, note="The paper that named the idea. VAE + RNN + tiny controller, trained entirely "
  "inside the learned dream. Everything below is scale and architecture on top of this skeleton.",
  rel="dreamerv3,genie,unipi", id_="wm-residual")
P("genie","Genie: Generative Interactive Environments",
  a="Jake Bruce; Michael Dennis; Ashley Edwards; Jack Parker-Holder; Yuge Shi; et al.",
  inst="Google DeepMind", lab="DeepMind", v="ICML", vt="conference", y=2024, d="2024-02-23",
  br="world-models", top="generative environments, latent actions, unlabelled video", par="world model",
  meth="latent action model learned from unlabelled internet video", arx="2402.15391", st=3,
  note="Learns a *latent action space* from unlabelled video with no action labels at all. That trick is the "
       "key enabler for building world-action models from human video — including UMI-glove capture.",
  rel="genie3,worldmodels,unipi,latent-action", id_="wam-umi-gloves,ego-dex")
P("genie3","Genie 3: A New Frontier for World Models",
  a="Google DeepMind", inst="Google DeepMind", lab="DeepMind", v="blog", vt="industry",
  y=2025, d="2025-08-05", br="world-models", top="interactive world model, real-time generation", par="world model",
  site="https://deepmind.google/discover/blog/genie-3-a-new-frontier-for-world-models/", st=2,
  note="Real-time interactive 720p world generation with minute-scale consistency. Industry announcement, "
       "not a reviewed paper — but it sets the bar for what 'train the agent inside the model' now means.",
  rel="genie,dreamerv4,cosmos", id_="auto-research-wm")
P("unipi","Learning Universal Policies via Text-Guided Video Generation",
  a="Yilun Du; Sherry Yang; Bo Dai; Hanjun Dai; Ofir Nachum; Joshua B. Tenenbaum; Dale Schuurmans; Pieter Abbeel",
  inst="MIT; UC Berkeley; Google DeepMind", v="NeurIPS", vt="conference", y=2023, d="2023-02-01",
  br="world-models", top="video generation as planning, universal policy", par="world model, diffusion",
  meth="generate a video plan, then infer actions with an inverse dynamics model", arx="2302.00111", st=2,
  note="Plan in pixel space, act with inverse dynamics. The clean statement of 'video prediction is a policy "
       "if you can invert it'.", rel="genie,gr1,wall-osS,worldmodels")
P("gr1","Unleashing Large-Scale Video Generative Pre-training for Visual Robot Manipulation",
  a="Hongtao Wu; Ya Jing; Chilam Cheang; Guangzeng Chen; Jiafeng Xu; Xinghang Li; Minghuan Liu; Hang Li; Tao Kong",
  corr="Tao Kong", inst="ByteDance Research", lab="ByteDance Seed / Robotics", v="ICLR", vt="conference",
  y=2024, d="2023-12-20", br="world-models", top="video pretraining, manipulation, GPT-style", par="world model, IL",
  arx="2312.13139", st=2, note="Pretrain on video prediction, fine-tune to predict actions and future frames "
  "jointly. The direct ancestor of the world-action-model family.", rel="gr2,unipi,wall-osS")
P("gr2","GR-2: A Generative Video-Language-Action Model with Web-Scale Knowledge",
  a="Chi-Lam Cheang; Guangzeng Chen; Ya Jing; Tao Kong; Hanbo Zhang; Hang Li; et al.",
  inst="ByteDance Research", lab="ByteDance Seed", v="arXiv", vt="preprint", y=2024, d="2024-10-08",
  br="world-models", top="video-language-action, web-scale pretraining", par="world model, VLA",
  arx="2410.06158", st=2, note="Video pretraining at 38M clips, then joint video+action prediction. The "
  "'predict the future you are about to cause' formulation in its most scaled form.", rel="gr1,unipi,vjepa2")
P("vjepa2","V-JEPA 2: Self-Supervised Video Models Enable Understanding, Prediction and Planning",
  a="Mido Assran; Adrien Bardes; Nicolas Ballas; Michael Rabbat; Yann LeCun; et al.",
  inst="Meta AI", lab="FAIR", v="arXiv", vt="preprint", y=2025, d="2025-06-11", br="world-models",
  top="self-supervised video, latent prediction, zero-shot planning", par="world model",
  meth="joint-embedding predictive architecture, 1M+ hours of video, action-conditioned head", arx="2506.09985", st=3,
  note="Predicts in latent space rather than pixels — cheaper and less distracted by texture. Zero-shot "
       "pick-and-place on a new lab's robot from 62 hours of unlabelled robot video. The strongest current "
       "argument for the latent (not generative) branch of world models.",
  rel="genie,gr2,dreamerv4,flare", id_="wm-residual,wam-umi-gloves")
P("cosmos","Cosmos World Foundation Model Platform for Physical AI",
  a="NVIDIA", inst="NVIDIA", lab="NVIDIA", v="arXiv", vt="preprint", y=2025, d="2025-01-07",
  br="world-models", top="world foundation model, physical AI, synthetic data", par="world model",
  arx="2501.03575", st=2, note="Open world-foundation-model weights plus tokenizers and a data pipeline. "
  "Practical if you want a pretrained video prior rather than training one.", rel="genie3,vjepa2,dreamerv4")
P("flare","FLARE: Robot Learning with Implicit World Modeling",
  a="Ruijie Zheng; Jing Wang; Scott Reed; Johan Bjorck; Yu Fang; Fengyuan Hu; et al.",
  inst="NVIDIA; University of Maryland", lab="NVIDIA GEAR", v="arXiv", vt="preprint", y=2025,
  d="2025-05-21", br="world-models", top="implicit world modelling, latent future alignment", par="world model, IL",
  arx="2505.15659", st=2, note="In your M2 learning_from_human_video folder. Aligns policy latents with future "
  "observation embeddings — world modelling as an auxiliary loss rather than a separate model.",
  rel="vjepa2,gr2,decowam", pr="m2", id_="wm-residual")
P("mobilewam","MobileWAM: Bridging World-Action Models to Mobile Manipulation",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-08-04", br="world-models",
  top="world-action model, mobile manipulation", par="world model, VLA", arx="2608.04657", st=2,
  note="From your M2 whole_body_loco_manipulation folder. Directly relevant to the mobile-dexterous-UMI and "
       "WAM threads — read alongside DECOWAM.", rel="decowam,vjepa2,flare", pr="m2,mabel", id_="wam-umi-gloves,mobile-dex-umi")
P("decowam","DECOWAM: Decoupled Whole-Body World-Action Model for Legged Manipulation",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-08-20", br="world-models",
  top="world-action model, whole-body, legged manipulation", par="world model", arx="2608.20114", st=2,
  note="From your M2 library. Decoupling locomotion and manipulation inside the world model is the same "
       "structural choice FALCON makes in pure RL.", rel="mobilewam,falcon,flare", pr="m2,mabel", id_="wam-umi-gloves")

# ---------------------------------------------------------------- learning from human video
P("ego4d","Ego4D: Around the World in 3,000 Hours of Egocentric Video",
  a="Kristen Grauman; Andrew Westbury; Eugene Byrne; Zachary Chavis; Antonino Furnari; et al.",
  corr="Kristen Grauman", inst="Meta AI; UT Austin; 88 institutions", lab="FAIR",
  v="CVPR", vt="conference", y=2022, d="2021-10-13", br="human-video",
  top="egocentric video dataset, benchmark", par="dataset", arx="2110.07058", st=3,
  note="The substrate for the whole egocentric-learning agenda. 3,670 hours, 74 locations, 9 countries. "
       "If you are building an egocentric dexterity pipeline this is the pretraining corpus.",
  rel="egoexo4d,r3m,egomimic,humanoid-policy", id_="ego-dex")
P("egoexo4d","Ego-Exo4D: Understanding Skilled Human Activity from First- and Third-Person Perspectives",
  a="Kristen Grauman; Andrew Westbury; Lorenzo Torresani; Kris Kitani; Jitendra Malik; et al.",
  inst="Meta AI; 15 universities", lab="FAIR", v="CVPR", vt="conference", y=2024, d="2023-11-30",
  br="human-video", top="ego-exo paired video, skilled activity", par="dataset", arx="2311.18259", st=3,
  note="Time-synchronized first- and third-person video of the same skilled activity. This is the dataset "
       "that makes your third-person-vs-egocentric comparison an experiment rather than a debate.",
  rel="ego4d,third-person-ref,humanoid-policy", id_="third-person,ego-dex")
P("r3m","R3M: A Universal Visual Representation for Robot Manipulation",
  a="Suraj Nair; Aravind Rajeswaran; Vikash Kumar; Chelsea Finn; Abhinav Gupta",
  corr="Suraj Nair", inst="Stanford University; Meta AI", lab="Stanford IRIS; FAIR",
  v="CoRL", vt="conference", y2=None, y=2022, d="2022-03-23", br="human-video",
  top="visual representation, Ego4D pretraining", par="representation learning",
  meth="time-contrastive + video-language alignment on Ego4D", arx="2203.12601", st=3,
  note="Pretrain a frozen visual encoder on human video, then do BC on top with 10x fewer demos. The first "
       "widely-used demonstration that human video transfers to robot control at all.",
  rel="ego4d,vip,mvp,vjepa2", id_="ego-dex")
P("vip","VIP: Towards Universal Visual Reward and Representation via Value-Implicit Pre-Training",
  a="Yecheng Jason Ma; Shagun Sodhani; Dinesh Jayaraman; Osbert Bastani; Vikash Kumar; Amy Zhang",
  inst="University of Pennsylvania; Meta AI", v="ICLR", vt="conference", y=2023, d="2022-09-30",
  br="human-video", top="visual reward, goal-conditioned value, human video", par="representation learning",
  arx="2210.00030", st=2, note="Gets a dense reward function out of human video via implicit value learning. "
  "Useful if you want to reward real-world RL without instrumenting the task.", rel="r3m,mvp,serl", id_="rl-harness")
P("egomimic","EgoMimic: Scaling Imitation Learning via Egocentric Video",
  a="Simar Kareer; Dhruv Patel; Ryan Punamiya; Pranay Mathur; Shuo Cheng; Chen Wang; Judy Hoffman; Danfei Xu",
  corr="Simar Kareer", inst="Georgia Tech", lab="Georgia Tech RIPL (Danfei Xu)", v="ICRA", vt="conference",
  y=2025, d="2024-10-31", br="human-video", top="egocentric human data, co-training, Aria glasses", par="IL",
  meth="Project Aria glasses capture + humanoid co-training with normalized hand/robot action spaces",
  arx="2410.24221", st=3,
  note="Human wears Aria glasses, robot learns from it. The interesting engineering is the action-space "
       "normalization that lets human hand trajectories and robot trajectories go in the same batch. "
       "Closest published thing to your egocentric-dexterity plan.",
  rel="humanoid-policy,ego4d,phantom,dexcap", pr="mabel", id_="ego-dex,wam-umi-gloves")
P("phantom","Phantom: Training Robots Without Robots Using Only Human Videos",
  a="Marion Lepert; Jiaying Fang; Jeannette Bohg", corr="Marion Lepert",
  inst="Stanford University", lab="Stanford IPRL (Bohg)", v="arXiv", vt="preprint", y=2025,
  d="2025-03-01", br="human-video", top="human video only, zero robot data, inpainting", par="IL",
  meth="edit human hands out of video and paint the robot in, then train BC on the edited video",
  arx="2503.00779", st=3,
  note="Zero robot demonstrations — close the embodiment gap by *editing the video* rather than by learning "
       "a correspondence. Cheap, slightly absurd, and it works. Worth trying for GeoDex.",
  rel="egomimic,humanoid-policy,dreamhand,mimicplay", pr="geodex", id_="ego-dex,third-person")
P("mimicplay","MimicPlay: Long-Horizon Imitation Learning by Watching Human Play",
  a="Chen Wang; Linxi Fan; Jiankai Sun; Ruohan Zhang; Li Fei-Fei; Danfei Xu; Anima Anandkumar; Yuke Zhu",
  inst="Stanford University; NVIDIA; Georgia Tech; UT Austin", v="CoRL", vt="conference", y=2023,
  d="2023-02-24", br="human-video", top="human play data, hierarchical planning", par="IL",
  arx="2302.12422", st=2, note="Human play video trains the high-level planner; a small amount of teleop "
  "trains the low-level controller. A good division of labour for expensive robot time.",
  rel="egomimic,vid2robot,mimicfunc", id_="third-person")
P("dexmv","DexMV: Imitation Learning for Dexterous Manipulation from Human Videos",
  a="Yuzhe Qin; Yueh-Hua Wu; Shaowei Liu; Hanwen Jiang; Ruihan Yang; Yang Fu; Xiaolong Wang",
  corr="Yuzhe Qin", inst="UC San Diego", lab="UCSD Xiaolong Wang Lab", v="ECCV", vt="conference",
  y=2022, d="2021-08-12", br="human-video", top="dexterous manipulation from video, hand pose", par="IL, RL",
  arx="2108.05877", st=2, note="Early and still-useful pipeline: 3D hand-object pose from video -> "
  "retargeted demonstrations -> RL/IL on a multi-finger hand.", rel="videodex,dexcap,c2dex", pr="geodex", id_="ego-dex")
P("videodex","VideoDex: Learning Dexterity from Internet Videos",
  a="Kenneth Shaw; Shikhar Bahl; Deepak Pathak", corr="Kenneth Shaw",
  inst="Carnegie Mellon University", lab="CMU Pathak Lab", v="CoRL", vt="conference", y=2022,
  d="2022-12-08", br="human-video", top="internet video, dexterity priors", par="IL",
  arx="2212.04498", st=2, note="Internet video as a prior over *how hands move*, transferred to a LEAP-style "
  "hand. Same lab as LEAP Hand — hardware and learning co-designed.", rel="dexmv,leap-hand,ego4d", pr="geodex", id_="ego-dex")
P("human-video-survey","Robot Learning from Human Videos: A Survey",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-04-27", br="human-video",
  top="survey, human video, robot learning", par="survey", arx="2604.27621", st=3,
  note="In your M2 literature. Start your egocentric-video literature review here — it is the most recent "
       "map of the area and will give you the citation skeleton for free.",
  rel="ego4d,egomimic,phantom,simdex", pr="m2", id_="ego-dex,third-person")
P("simdex","SiMDex: Mining Similar Egocentric Videos for Cross-Embodiment Dexterous Manipulation",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-08-04", br="human-video",
  top="egocentric retrieval, cross-embodiment dexterity", par="IL", arx="2608.04196", st=2,
  note="From your M2 library. Retrieval over egocentric video as a way to get task-relevant data instead of "
       "training on everything — a cheap lever for the ego-dexterity idea.",
  rel="human-video-survey,egomimic,do-as-i-do", pr="m2", id_="ego-dex")
P("do-as-i-do","Do as I Do: Dexterous Manipulation Data from Everyday Human Video",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-06-19", br="human-video",
  top="everyday human video, dexterous data", par="IL", arx="2606.19333", st=2,
  note="From your M2 library. Same thesis as your idea, recent enough that it should be a primary comparison "
       "point rather than background.", rel="simdex,human-video-survey,phantom", pr="m2", id_="ego-dex")
P("c2dex","C2Dex: Contact-Consistent Reconstruction and Retargeting for Dexterous Manipulation",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-08-07", br="retargeting",
  top="contact-consistent retargeting, hand reconstruction", par="IL", arx="2608.07045", st=3,
  note="From your M2 library — and almost exactly your learned-retargeting idea (retarget so that contacts "
       "are preserved, not joint angles). Read this before you write that proposal.",
  rel="dex-retargeting,anyteleop,learned-retarget-ref", pr="m2,geodex", id_="learned-retargeting,ego-dex")

# ---------------------------------------------------------------- retargeting & teleop
P("dexpilot","DexPilot: Vision-Based Teleoperation of Dexterous Robotic Hand-Arm System",
  a="Ankur Handa; Karl Van Wyk; Wei Yang; Jacky Liang; Yu-Wei Chao; Qian Wan; Stan Birchfield; Nathan Ratliff; Dieter Fox",
  inst="NVIDIA", lab="NVIDIA Seattle Robotics Lab", v="ICRA", vt="conference", y=2020, d="2019-10-07",
  br="retargeting", top="vision-based teleoperation, hand retargeting", par="teleop",
  arx="1910.03135", st=2, note="Markerless hand teleop of a 23-DOF hand-arm. The retargeting cost function "
  "here (fingertip distances, not joint angles) is the ancestor of most later work.",
  rel="anyteleop,dex-retargeting,c2dex", pr="geodex", id_="learned-retargeting")
P("anyteleop","AnyTeleop: A General Vision-Based Dexterous Robot Arm-Hand Teleoperation System",
  a="Yuzhe Qin; Wei Yang; Binghao Huang; Karl Van Wyk; Hao Su; Xiaolong Wang; Yu-Wei Chao; Dieter Fox",
  corr="Yuzhe Qin", inst="UC San Diego; NVIDIA", lab="UCSD Xiaolong Wang Lab", v="RSS", vt="conference",
  y=2023, d="2023-07-10", br="retargeting", top="general teleoperation, cross-hand retargeting", par="teleop",
  arx="2307.04577", st=3,
  note="One system, many hands and arms, camera-only. The open dex-retargeting library that came out of this "
       "is the practical starting point for MABEL/GeoDex teleop.",
  rel="dexpilot,dex-retargeting,open-television,c2dex", pr="mabel,geodex", id_="learned-retargeting")
P("dex-retargeting","Dex-Retargeting: A Unified Motion Retargeting Library for Dexterous Hands",
  a="Yuzhe Qin; et al.", inst="UC San Diego", v="software", vt="software", y=2023,
  br="retargeting", top="retargeting library, open source", par="teleop",
  code="https://github.com/dexsuite/dex-retargeting", st=2,
  note="The library, not a paper. Vector/position/DexPilot retargeting for most common hands — use it as the "
       "baseline your learned retargeting has to beat.",
  rel="anyteleop,c2dex", pr="geodex", id_="learned-retargeting")
P("h2o","Learning Human-to-Humanoid Real-Time Whole-Body Teleoperation",
  a="Tairan He; Zhengyi Luo; Wenli Xiao; Chong Zhang; Kris Kitani; Changliu Liu; Guanya Shi",
  corr="Tairan He", inst="Carnegie Mellon University", lab="CMU LeCAR", v="IROS", vt="conference",
  y=2024, d="2024-03-07", br="retargeting", top="whole-body teleoperation, human-to-humanoid", par="RL, teleop",
  meth="shape-fitted retargeting + privileged RL tracking policy, RGB-only human input", arx="2403.04436", st=3,
  note="Real-time whole-body humanoid teleop from a single RGB camera. The retargeting half — fit the human "
       "shape to the robot's kinematics first, then track — is the part MABEL needs.",
  rel="omnih2o,hover,exbody,deepmimic,x-op", pr="mabel", id_="learned-retargeting")
P("omnih2o","OmniH2O: Universal and Dexterous Human-to-Humanoid Whole-Body Teleoperation and Learning",
  a="Tairan He; Zhengyi Luo; Xialin He; Wenli Xiao; Chong Zhang; Weinan Zhang; Kris Kitani; Changliu Liu; Guanya Shi",
  corr="Tairan He", inst="Carnegie Mellon University; Shanghai Jiao Tong University", lab="CMU LeCAR",
  v="CoRL", vt="conference", y=2024, d="2024-06-13", br="retargeting",
  top="dexterous whole-body teleop, multiple interfaces", par="RL, teleop", arx="2406.08858", st=3,
  note="In your library. Extends H2O to dexterous hands and to many control interfaces (VR, RGB, language, "
       "autonomous), plus a demonstration dataset. The interface-agnostic framing leads straight to HOVER.",
  rel="h2o,hover,maskedmimic", pr="mabel", id_="learned-retargeting")
P("hover","HOVER: Versatile Neural Whole-Body Controller for Humanoid Robots",
  a="Tairan He; Wenli Xiao; Toru Lin; Zhengyi Luo; Zhenjia Xu; Zhenyu Jiang; Jan Kautz; Changliu Liu; Guanya Shi; Xiaolong Wang; Yuke Zhu; Zhen Fu",
  inst="NVIDIA; Carnegie Mellon University; UC Berkeley; UT Austin; UC San Diego", lab="NVIDIA GEAR; CMU LeCAR",
  v="ICRA", vt="conference", y=2025, d="2024-10-28", br="retargeting",
  top="unified whole-body controller, mode switching", par="RL",
  meth="distill multiple control modes into one masked policy", arx="2410.21229", st=3,
  note="In your library (twice). One controller that covers joint-angle, root-velocity and kinematic-target "
       "modes by masking the command at train time — MaskedMimic's trick on real hardware. Direct blueprint "
       "for a MABEL whole-body controller.",
  rel="omnih2o,maskedmimic,h2o,x-op", pr="mabel", id_="learned-retargeting")
P("exbody","Expressive Whole-Body Control for Humanoid Robots",
  a="Xuxin Cheng; Yandong Ji; Junming Chen; Ruihan Yang; Ge Yang; Xiaolong Wang",
  corr="Xuxin Cheng", inst="UC San Diego; MIT", lab="UCSD Xiaolong Wang Lab", v="RSS", vt="conference",
  y=2024, d="2024-02-26", br="retargeting", top="expressive motion, upper-body tracking", par="RL",
  arx="2402.16796", st=2, note="Track the upper body expressively, keep the lower body robust. The asymmetry "
  "is the insight — you do not need the legs to imitate, you need them to not fall.",
  rel="h2o,hover,deepmimic", pr="mabel")
P("open-television","Open-TeleVision: Teleoperation with Immersive Active Visual Feedback",
  a="Xuxin Cheng; Jialong Li; Shiqi Yang; Ge Yang; Xiaolong Wang", corr="Xuxin Cheng",
  inst="UC San Diego; MIT", lab="UCSD Xiaolong Wang Lab", v="CoRL", vt="conference", y=2024,
  d="2024-07-01", br="retargeting", top="VR teleoperation, active vision, open hardware", par="teleop",
  arx="2407.01512", st=2, note="Open-source stereo VR teleop with active head tracking. Cheap way to get "
  "high-quality bimanual demonstrations — a MABEL-relevant build.", rel="anyteleop,bunny-visionpro,umi", pr="mabel")
P("x-op","X-OP: Cross-Morphology Whole-Body Teleoperation via MPC Retargeting",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-06-07", br="retargeting",
  top="cross-morphology retargeting, MPC", par="teleop", arx="2606.07934", st=2,
  note="In your MABEL teleop_and_retargeting folder. MPC-based retargeting across morphologies — the "
       "optimization-based counterpoint to learned retargeting.", rel="hover,h2o,c2dex", pr="mabel,m2", id_="learned-retargeting")

# ---------------------------------------------------------------- data scaling
P("oxe","Open X-Embodiment: Robotic Learning Datasets and RT-X Models",
  a="Open X-Embodiment Collaboration (Abby O'Neill; Abdul Rehman; Abhinav Gupta; et al.)",
  inst="34 labs worldwide", v="ICRA", vt="conference", y=2024, d="2023-10-13", br="data-scaling",
  top="cross-embodiment dataset, RT-X", par="dataset", arx="2310.08864", st=3,
  note="1M+ trajectories, 22 embodiments, 34 labs. The ImageNet moment for robot data, and the training set "
       "underneath Octo, OpenVLA and most open generalist policies.",
  rel="rt1,octo,openvla,droid,crossformer")
P("droid","DROID: A Large-Scale In-the-Wild Robot Manipulation Dataset",
  a="Alexander Khazatsky; Karl Pertsch; Suraj Nair; Ashwin Balakrishna; Sudeep Dasari; et al.",
  inst="Stanford University; UC Berkeley; 13 institutions", v="RSS", vt="conference", y=2024,
  d="2024-03-19", br="data-scaling", top="in-the-wild dataset, Franka, diversity", par="dataset",
  arx="2403.12945", st=3, note="76k trajectories across 564 scenes, collected with one standardized hardware "
  "setup. Standardization is what makes it more useful per-episode than OXE.", rel="oxe,bridgedata,umi")
P("bridgedata","BridgeData V2: A Dataset for Robot Learning at Scale",
  a="Homer Walke; Kevin Black; Abraham Lee; Moo Jin Kim; Max Du; Chongyi Zheng; et al.",
  inst="UC Berkeley; Stanford University; Google DeepMind", lab="BAIR (RAIL)", v="CoRL", vt="conference",
  y=2023, d="2023-08-24", br="data-scaling", top="dataset, generalization", par="dataset",
  arx="2308.12952", st=2, note="60k trajectories on WidowX. The standard low-cost-arm generalization "
  "benchmark before DROID.", rel="oxe,droid,octo")
P("agibot-world","AgiBot World Colosseo: A Large-scale Manipulation Platform for Scalable and Intelligent Embodied Systems",
  a="AgiBot-World-Contributors", inst="AgiBot; Shanghai AI Laboratory", v="arXiv", vt="preprint",
  y=2025, d="2025-03-09", br="data-scaling", top="large-scale dataset, standardized platform", par="dataset",
  arx="2503.06669", st=2, note="1M+ trajectories from a standardized fleet. The industrial answer to DROID, "
  "with hardware uniformity as the design principle.", rel="droid,oxe,pi05")
P("open-aoe","Open-AoE: An Open Egocentric Manipulation Dataset and Toolchain",
  a="(see PDF)", inst="", v="arXiv", vt="preprint", y=2026, d="2026-07-14", br="data-scaling",
  top="egocentric dataset, open toolchain", par="dataset", arx="2607.14183", st=2,
  note="From your M2 library. An open egocentric manipulation dataset *with* the capture toolchain — "
       "directly usable for the ego-dexterity and UMI-WAM ideas.",
  rel="ego4d,egoexo4d,umi,human-video-survey", pr="m2", id_="ego-dex,wam-umi-gloves")

(()=>{'use strict';const d=window.M2NativeGrasp,$=id=>document.getElementById(id);if(!d)return;
const screen=d.evaluations.find(e=>e.id==='native_grasp_scene_screen_v2');
const chosen=['living_room_doorway','warehouse_crate_doorway','workshop_beam_doorway'];
for(const id of chosen){const row=screen?.rows.find(r=>r.id===id);if(!row)continue;const clip=d.clips.find(c=>c.label===id.replaceAll('_',' ')+' · failed'&&Math.abs(c.duration_s-row.duration_s)<1e-5);if(!clip)continue;
 const card=document.createElement('article');card.className='failure-card';const h=document.createElement('h3');h.textContent={living_room_doorway:'Couch · acquisition stopped',warehouse_crate_doorway:'Crate · acquisition stopped',workshop_beam_doorway:'Beam · unsupported motion'}[id];const v=document.createElement('video');v.controls=true;v.playsInline=true;v.preload='none';v.src=clip.video;v.poster=clip.poster;v.setAttribute('aria-label',h.textContent+' failed attempt');const p=document.createElement('p');p.textContent=`Seed ${row.seed} · ${clip.duration_s.toFixed(2)} s. Logged stop: ${row.terminations.join(', ').replaceAll('_',' ')}.`;
 const b=document.createElement('button');b.textContent='Inspect contact and grasp plots';b.onclick=()=>{const category=$('native-category');category.value='scenes';category.onchange();const choices=d.clips.filter(c=>c.group==='scenes');const index=choices.findIndex(c=>c.video===clip.video);$('native-recording').value=String(index);$('native-recording').onchange();document.querySelector('[data-native-plot="distance"]').click();$('native-plot').scrollIntoView({behavior:'smooth',block:'center'});};card.append(h,v,p,b);$('failure-gallery').append(card);}
const run=d.runs.findLast(r=>r.settings?.environment?.task?.recovery?.observe_planner_hand_targets)||d.runs.find(r=>r.id==='native_grasp_guided_continue_004');if(!run)return;const cfg=run.settings.environment.task.recovery,w=cfg.rewards,c=cfg.physical_grasp,pw=c.rewards;
const contact=[
 ['Hand pose alignment','pose_alignment','−Δt ⟨1 − Aₕ⟩','Aₕ = exp(−(dₕ/σp)² − (θₕ/σθ)²); held hands use their captured frame.'],
 ['Aligned finger closure','aligned_closure','Ψt − Ψt−1','Ψ = ⟨Aₕ clip(curlₕ / ctarget, 0, 1)⟩, using measured finger joints. Holding the same curl earns no progress credit.'],
 ['Held-hand adjustment','held_adjustment','−Δt ⟨aₕ clip(‖vrel,ₕ/σhv‖² + ‖ωrel,ₕ/σhω‖²,0,1)⟩','Velocity relative to the rigid object at the hand; intended carrying motion is not penalized.'],
 ['First acquisition','acquisition','ΔN','One credit per hand’s first qualified acquisition.','event'],
 ['Distance','distance','−Δt ⟨tanh(dₕ / σd)⟩','Palm distance to its assigned / captured target.'],
 ['Separation speed','separation_speed','−Δt ⟨clip(vout,ₕ / σv, 0, 1)⟩','Penalizes moving away from the object-relative target.'],
 ['Secure contact','secure_contact','−Δt ⟨1 − qₕ⟩','qₕ = 1 for qualified opposing contacts.'],
 ['Firmness','firmness','−Δt ⟨1 − fₕ⟩','fₕ is the monitored contact firmness.'],
 ['Contact slip','contact_slip','−Δt ⟨vslip,ₕ⟩','Tangential contact slip speed (m/s).'],
 ['Friction reserve','friction_margin','−Δt ⟨1 − fₕ mₕ⟩','mₕ is the monitored friction margin.'],
 ['Excess grip force','excess_normal_force','−Δt ⟨max(Fn,ₕ / Fmax − 1, 0)²⟩','Penalizes excessive summed normal force.'],
 ['Finger work','mechanical_work','−ΔW','ΔW = ∫ Σⱼ |τⱼ q̇ⱼ| dt (J).','interval'],
 ['Holding effort','holding_effort','−ΔE','ΔE = ∫ Σⱼ τⱼ² dt (N² m² s).','interval'],
 ['Premature closure','precontact_closure','−Δt Σₕ 𝟙[dnom,ₕ > 0.06] cₕ²','Closing while far from the nominal grasp.'],
 ['Contact frame','contact_constellation','−Δt Σₕ meanₖ ‖pₕ + Rₕ uₖ − p*ₕ − R*ₕ uₖ‖²','Four frame points: origin and 4 cm along each axis.']
];
const task=[
 ['Grasp progress','grasp_progress','clip(gprev − g, −0.05, 0.05)','g: robot grasp-position error (m).'],
 ['Rotation progress','grasp_rotation_progress','clip(αprev − α, −0.02, 0.02)','Reduction in grasp orientation error (rad).'],
 ['Contact potential','contact_progress','Φt − Φt−1','Φ = Σₕ [exp(−(dₕ/0.04)²) clip(cₕ/c*,0,1) + aₕ].'],
 ['Grasp loss','grasp_loss','−Nrelease','Counts measured releases; injected self-opening is excluded.'],
 ['Proximity','grasp_proximity','Δt exp(−(g / 0.08)²)','Dense approach reward.'],
 ['Supported path progress','supported_progress','G(Δs)','s: path progress; G blocks positive credit without team support.'],
 ['Goal pose progress','goal_pose_progress','G(‖D eprev‖ − ‖D e‖)','D = diag(1,1,1,ρ,ρ,ρ), weighting translation and rotation.'],
 ['Supported lift progress','supported_lift_progress','G(|ez,prev| − |ez|)','Actual reduction in object-height error; no positive credit without support at both endpoints.'],
 ['Stable goal','stable_goal','Δt 𝟙[good]','Environment’s supported, stable goal condition.'],
 ['Unsupported travel','unsupported_travel','−Δℓxy 𝟙[not supported]','Horizontal object travel without required support.'],
 ['Anchor slip','slip','−Δt min(δ, 0.1) 𝟙[engaged]','δ: grasp drift from its captured frame (m).'],
 ['Load','load','−Δt (‖Fᵢ‖ / max(1, 2Fcap))²','Fcap is the configured grasp force scale.'],
 ['Object orientation error','tilt','−Δt ‖eR‖²','Rotation error relative to the nearby object reference (rad).'],
 ['Torso posture','upright_torso','−Δt ψᵢ²','Local torso pitch (rad).'],
 ['Action change','action_rate','−Δt ‖at − at−1‖²','Penalty on changing normalized policy actions.'],
 ['Time','time','−Δt','Per-second cost.'],
 ['Success','success','𝟙[success]','Terminal success bonus.'],
 ['Failure','failure','−𝟙[terminated]','Physical termination penalty.']
];
$('reward-config').textContent=`Configuration: ${run.id}. Δt = 0.02 s; σd = ${c.distance_scale_m} m; σv = ${c.separation_speed_scale_m_s} m/s; Fmax = ${c.maximum_normal_force_n} N. Pose scales: ${c.alignment_distance_m??.03} m / ${c.alignment_rotation_rad??.25} rad. Curl target: ${c.closure_reward_target??.6}. Held-motion scales: ${c.held_linear_speed_m_s??.03} m/s / ${c.held_angular_speed_rad_s??.2} rad/s. Weights are read from the exported run configuration.`;
function table(mode){const rows=mode==='contact'?contact:task,weights=mode==='contact'?pw:w;$('reward-rows').replaceChildren();for(const [name,key,equation,definition] of rows){const tr=document.createElement('tr');for(const [index,value]of [name,weights[key]??0,equation,definition].entries()){const td=document.createElement('td');td.textContent=value;if(index===2)td.className='reward-equation';tr.append(td);}$('reward-rows').append(tr);}document.querySelectorAll('[data-reward-table]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rewardTable===mode)));}
document.querySelectorAll('[data-reward-table]').forEach(b=>b.textContent=b.dataset.rewardTable==='contact'?`Physical grasp · ${contact.length} terms`:`Task and regularization · ${task.length} terms`);
document.querySelectorAll('[data-reward-table]').forEach(b=>b.onclick=()=>table(b.dataset.rewardTable));table('contact');
})();

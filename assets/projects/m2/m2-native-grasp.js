(() => {
  const d=window.M2NativeGrasp, root=document.getElementById('native-grasp');
  if(!d || !root) return;
  const $=id=>document.getElementById(id), colors=['#d18a00','#2876bd','#21a5a6','#8b58ae','#c66061'];
  const runs=d.runs.filter(r=>r.completed||r.demonstrations?.length||r.imitation_history?.length||r.dataset_import?.labelled_samples), clips=[...(d.replay_review?.clips||[]),...d.clips.map(c=>({group:'diagnostics',...c})),...d.runs.flatMap(r=>r.clips.map(c=>({...c,group:'checkpoints',label:`${r.id} · ${c.label}`})))];
  let run=runs.at(-1), clip=clips[0], mode='3d';
  const layout=title=>({title:{text:title,font:{size:15}},paper_bgcolor:'transparent',plot_bgcolor:'transparent',
    margin:{l:55,r:18,t:44,b:65},font:{family:'inherit',size:12},legend:{orientation:'h',y:-.22},
    xaxis:{title:'Simulation time (s)'},yaxis:{automargin:true}});
  const line=(name,x,y,i)=>({name,x,y,type:'scatter',mode:'lines',line:{color:/mabel/i.test(name)?'#ff9500':/milo/i.test(name)?'#0abab5':colors[i%colors.length],width:2,dash:/right/i.test(name)?'dash':'solid'}});
  const pendingTraces=new Map();
  function trajectory(c){
    if(c.trajectory)return Promise.resolve(c.trajectory);
    const key=c.trajectory_key;
    if(window.M2NativeTraces?.[key])return Promise.resolve(window.M2NativeTraces[key]);
    if(!pendingTraces.has(key))pendingTraces.set(key,new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=c.trajectory_file;
      script.onload=()=>{const rows=window.M2NativeTraces?.[key];Array.isArray(rows)?resolve(rows):reject(new Error('Measurements are unavailable'));};
      script.onerror=()=>reject(new Error('Measurements could not load'));document.head.append(script);
    }));
    return pendingTraces.get(key);
  }
  async function plot(){
    if(!clip) return;
    const selected=clip;let rows;
    try{rows=await trajectory(selected);}catch(error){if(clip===selected)$('native-caption').textContent=selected.label+' · '+error.message;return;}
    if(selected!==clip||!rows.length)return;
    const t=rows.map(r=>r.time_s), hands=Object.keys(rows[0].hands_xyz_m||{});
    let traces=[], l=layout('Object and four hand paths');
    if(mode==='3d'){
      traces=['Object',...hands].map((name,i)=>{const points=rows.map(r=>i?r.hands_xyz_m[name]:r.centroid_xyz_m);
        return {name,type:'scatter3d',mode:'lines',x:points.map(p=>p[0]),y:points.map(p=>p[1]),z:points.map(p=>p[2]),line:{color:/mabel/i.test(name)?'#ff9500':/milo/i.test(name)?'#0abab5':'#b39ddb',width:4,dash:/right/i.test(name)?'dash':'solid'}};});
      l.scene={aspectmode:'data',xaxis:{title:'World X (m)'},yaxis:{title:'World Y (m)'},zaxis:{title:'World Z (m)'}};
    } else if(['palm','closure','bar'].includes(mode)){
      const metric={palm:['palm_angle_to_target_deg',1,'Palm-normal error to assigned orientation','Angle (deg)'],closure:['measured_finger_curl',1,'Measured finger curl and closure commands','Normalized closure'],bar:['bar_axis_above_tcp_m',1000,'Bar axis above each hand TCP along its palm normal','Signed distance (mm)']}[mode];
      traces=hands.map((h,i)=>line(h.replaceAll('_',' '),t,rows.map(r=>r.hand_support_geometry?.[h]?.[metric[0]]!=null?metric[1]*r.hand_support_geometry[h][metric[0]]:null),i+1));
      if(mode==='closure')traces.push(...hands.map((h,i)=>{const trace=line(h.replaceAll('_',' ')+' command',t,rows.map(r=>r.hand_support_geometry?.[h]?.closure_command??null),i+1);trace.line.dash='dot';return trace;}));
      l.title.text=metric[2];l.yaxis.title=metric[3];
      if(!rows.some(r=>r.hand_support_geometry))l.annotations=[{text:'This older recording predates palm-support telemetry.',xref:'paper',yref:'paper',x:.5,y:.5,showarrow:false}];
    } else if(mode==='distance'){
      traces=hands.map((h,i)=>line(h.replaceAll('_',' '),t,rows.map(r=>r.assigned_grasp_distance_m?.[h]!=null?1000*r.assigned_grasp_distance_m[h]:null),i+1));
      l.title.text='Palm distance to assigned grasp frame';l.yaxis.title='Distance (mm)';
    } else if(mode==='centroid'){
      traces=['mabel','milo'].map((robot,i)=>line(robot.toUpperCase(),t,rows.map(r=>r.robot_centroid_distance_m?.[robot]??null),i+1));
      l.title.text='Base origin to object centroid · 3D distance';l.yaxis.title='Distance (m)';
    } else if(mode==='contact'){
      traces=hands.map((h,i)=>line(h.replaceAll('_',' '),t,rows.map(r=>{const q=r.physical_grasps?.[h.replace('_','/')];return q?.qualified==null?null:Number(q.qualified);}),i+1));
      traces.forEach(t=>t.line.shape='hv');l.title.text='Measured grasp qualification · recorded configuration';l.yaxis.title='Qualified contact (0 / 1)';l.yaxis.range=[-.05,1.05];
    } else if(mode==='reward'){
      const keys=Object.keys(rows.find(r=>r.reward_components)?.reward_components||{});
      traces=keys.length?keys.map((k,i)=>line(k.replaceAll('_',' '),t,rows.map(r=>r.reward_components?.[k]??null),i)):
        [line('Reward',t,rows.map(r=>r.reward??null),0)];l.title.text='Reward components per control step';l.yaxis.title='Reward';
    } else {
      const settings={force:['normal_force_n',1,'Normal force (N)'],support:['palm_support_force_n',1,'Palm support along measured palm normal (N)'],slip:['slip_speed_m_s',1000,'Contact slip (mm/s)'],firmness:['firmness',1,'Firmness proxy (0–1)']};
      if(mode==='work'){
        traces=['mabel','milo'].map((r,i)=>line(r.toUpperCase(),t,rows.map(row=>row.grasp_mechanical_work_j?.[r]??row.render?.robots?.[r]?.grasp_work_j??null),i+1));l.yaxis.title='Finger mechanical work (J)';
      } else {
        const [key,factor,label]=settings[mode];
        traces=hands.map((h,i)=>{const parts=h.split('_'),robot=parts[0],side=parts[1];
          return line(`${robot} ${side}`,t,rows.map(r=>{const q=r.physical_grasps?.[`${robot}/${side}`]??r.render?.robots?.[robot]?.hands?.[side]?.physical_grasp;return q?.[key]!=null?factor*q[key]:null;}),i+1);});l.yaxis.title=label;
        if(mode==='support'&&!traces.some(t=>t.y.some(v=>v!==null)))l.annotations=[{text:'Palm contact force was not logged in this older recording.',xref:'paper',yref:'paper',x:.5,y:.5,showarrow:false}];
      }
      l.title.text=l.yaxis.title;
    }
    await Plotly.react($('native-plot'),traces,l,{responsive:true,displaylogo:false});
    $('native-plot').dataset.recording=selected.video;$('native-plot').dataset.mode=mode;
  }
  root.querySelectorAll('.native-choice-group').forEach(group=>{
    let selected;
    const update=()=>group.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.value===group.value)));
    Object.defineProperty(group,'value',{get:()=>selected??group.querySelector('button')?.value??'',set:value=>{selected=String(value);update();}});
    group.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||b.parentElement!==group)return;group.value=b.value;if(group.onchange)group.onchange();});
    new MutationObserver(update).observe(group,{childList:true});update();
  });
  const option=(value,label)=>{const e=document.createElement('button');e.type='button';e.value=String(value);e.textContent=label;return e;};
  for(const [key,label] of [['review','Replay comparison'],['diagnostics','Grasp diagnostics'],['checkpoints','Learned checkpoints'],['scenes','Scene evaluations']]){
    if(clips.some(c=>c.group===key))$('native-category').append(option(key,label));
  }
  function category(){const choices=clips.filter(c=>c.group===$('native-category').value);$('native-recording').replaceChildren();
    choices.forEach((c,i)=>$('native-recording').append(option(i,c.label)));
    $('native-recording').onchange=()=>{clip=choices[Number($('native-recording').value)];select();};
    clip=choices[0];select();}
  $('native-category').onchange=category;
  let replayRows=[];
  function select(){if(!clip) return;
    const selected=clip,v=$('native-video');v.pause();v.src=clip.video;v.poster=clip.poster;
    v.playbackRate=Number($('native-speed')?.value||1);
    $('native-caption').textContent=clip.label+' · '+(clip.summary||clip.scope||'Native contact dynamics. Recorded failures remain visible.');
    if($('native-replay-note'))$('native-replay-note').textContent=clip.group==='review'?(d.replay_review?.scope||''):'';
    if($('native-chapters')){
      $('native-chapters').replaceChildren();
      for(const event of clip.chapters||[]){const b=option(event.time_s,event.label+' · '+event.time_s.toFixed(2)+' s');
        b.onclick=()=>{v.pause();v.currentTime=Math.min(Math.max(0,event.time_s-(replayRows[0]?.time_s||0)),Math.max(0,(v.duration||0)-.01));};$('native-chapters').append(b);}
    }
    replayRows=[];if($('native-now'))$('native-now').textContent='Loading measured replay state…';
    trajectory(selected).then(rows=>{if(clip===selected){replayRows=rows;replayState();}}).catch(()=>{});plot();
  }
  function replayState(){if(!$('native-now')||!replayRows.length)return;
    const time=$('native-video').currentTime+(replayRows[0].time_s||0);
    const row=replayRows.reduce((a,b)=>Math.abs(a.time_s-time)<Math.abs(b.time_s-time)?a:b);
    const start=replayRows[0].centroid_xyz_m,p=row.centroid_xyz_m;
    const qualities=Object.values(row.physical_grasps||{}).filter(q=>q.qualified!=null);
    const contacts=qualities.length?`${qualities.filter(q=>q.qualified).length}/${qualities.length} contacts qualify`:'Historical attachment model';
    $('native-now').textContent=`t = ${row.time_s.toFixed(2)} s · ${contacts} · rise ${((p[2]-start[2])*1000).toFixed(1)} mm · horizontal travel ${(Math.hypot(p[0]-start[0],p[1]-start[1])*1000).toFixed(1)} mm. Nearest sampled measurement.`;
  }
  $('native-video').addEventListener('timeupdate',replayState);
  if($('native-speed'))$('native-speed').onchange=()=>{$('native-video').playbackRate=Number($('native-speed').value);};
  root.querySelectorAll('[data-native-plot]').forEach(b=>b.onclick=()=>{mode=b.dataset.nativePlot;root.querySelectorAll('[data-native-plot]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));plot();});
  if(clip)category();else $('native-caption').textContent='Complete checkpoint videos will appear after their recording jobs finish.';
  const query=new URLSearchParams(location.search),requested=clips.find(c=>c.id===query.get('replay'));
  if(requested){$('native-category').value=requested.group;category();const choices=clips.filter(c=>c.group===requested.group);
    $('native-recording').value=String(choices.indexOf(requested));$('native-recording').onchange();
    if(query.get('play')==='1'){$('native-video').muted=true;$('native-video').play().catch(()=>{});}}
  const frozen=(d.evaluations||[]).filter(e=>e.complete&&e.acceptance_eligible&&e.completed>0);
  const latestAcquisition=frozen.findLast(e=>e.id.startsWith('native_grasp_acquisition_'));
  const latestScenes=frozen.findLast(e=>e.id.startsWith('native_grasp_scene_screen_'));
  const rate=e=>`${e.successes}/${e.completed} (${(100*e.successes/e.completed).toFixed(1)}%)`;
  if($('native-validation-rate'))$('native-validation-rate').textContent=[
    `Latest frozen grasp-and-lift test: ${latestAcquisition?rate(latestAcquisition):'pending'}.`,
    `Latest cross-scene screen: ${latestScenes?rate(latestScenes):'pending'}.`,
    `Full-mission >90% validation: ${d.validation.target_met?'passed':'not achieved'}.`
  ].join(' ');
  const comparison=d.actor_comparison;
  if(comparison&&$('native-architecture-rows')){
    for(const [key,label] of [['transformer','Transformer'],['mlp','MLP · 128 → 128']]){
      const r=d.runs.find(r=>r.id===comparison[key+'_run']),e=d.evaluations?.find(e=>e.id===comparison[key+'_evaluation']);
      const parameters=r?.method?.actor_parameters??comparison[key+'_actor_parameters'];
      const tr=document.createElement('tr');
      const outcome=e?`${e.successes}/${e.completed} passed · ${e.completed}/${e.expected} trials${e.complete?' complete':' so far'}`:'Frozen evaluation pending';
      [label,parameters?.toLocaleString()??'Not recorded',outcome].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});
      $('native-architecture-rows').append(tr);
    }
    $('native-architecture-note').textContent=`Same 24 recorded episodes, eight-frame local history, rewards, physics and ${comparison.fit_epochs} fitting epochs. Initial screening uses the same ${comparison.paired_screen_episodes} starts (seed ${comparison.paired_screen_seed_start} onward). Different parameter counts; one training seed. Acquisition only. Teacher outcomes are excluded.`;
  }
  function training(){
    const reused=Boolean(run?.dataset_import?.labelled_samples);
    const supervised=!run?.completed&&Boolean(run?.demonstrations?.length||reused||run?.method?.algorithm==='supervised_imitation');
    const fractions=supervised?[...new Set(run.demonstrations.map(e=>e.teacher_fraction??1))]:[];
    const perturbed=supervised&&run.demonstrations.some(e=>(e.action_perturbation_scale??1)>0&&e.action_perturbation_std?.some(s=>s>0));
    const control=fractions.length===1&&fractions[0]===1?(perturbed?'Scripted teacher with action disturbances':'Scripted teacher'):`Teacher/student mixture (${fractions.map(f=>(100*f).toFixed(0)+'% teacher').join(', ')})`;
    $('native-status').textContent=reused ? `${run.id}: refitting ${run.dataset_import.labelled_samples.toLocaleString()} recorded examples · ${run.imitation_history?.length??0} fitting epochs. No new collection trials; frozen learned evaluation is reported separately.` : supervised ? `${run.id}: ${control} · ${run.demonstrations.filter(e=>e.success).length}/${run.demonstrations.length} collection episodes passed. These are initialization outcomes; learned full-mission >90% validation is not achieved.` : run ? `${run.id}: ${run.completed} completed training episodes · ${run.successes} successes (${run.completed?(100*run.successes/run.completed).toFixed(1):'0.0'}%). Full-mission >90% validation: ${d.validation.target_met?'passed':'not achieved'}.` : 'Native-contact training is starting. Full-mission >90% validation is not achieved.';
    $('native-failures').textContent=run ? Object.entries(run.failures).map(([k,v])=>`${k.replaceAll('_',' ')}: ${v}`).join(' · ') : 'No completed training episodes yet.';
    $('native-settings').textContent=JSON.stringify(run?.settings??d.runs.at(-1)?.settings??{},null,2);
    if(!run)return;
    const metric=$('native-training-metric').value;
    if(metric==='value'||metric==='objective'){
      const rows=run.metrics||[],x=rows.map(r=>r.steps),l=layout(metric==='value'?'Critic learning from simulated returns':'PPO objective · demonstration influence');
      l.xaxis.title='Environment steps';let traces=[];
      if(metric==='value'){
        l.yaxis.title='Value loss';l.yaxis2={title:'Explained variance',overlaying:'y',side:'right'};l.margin.r=75;
        traces=[line('Value loss',x,rows.map(r=>r.value_loss??null),1),{...line('Explained variance · pre-update',x,rows.map(r=>r.value_explained_variance??null),0),yaxis:'y2'}];
      }else{
        const t=run.settings?.training||{};l.yaxis.title='Auxiliary coefficient';l.yaxis2={title:'PPO policy loss',overlaying:'y',side:'right'};l.margin.r=75;
        traces=[line('Teacher weight · logged / configured schedule',x,rows.map(r=>r.teacher_auxiliary_coef??((t.native_teacher_auxiliary_coef||0)*(t.native_teacher_auxiliary_decay??1)**Math.max(0,r.update-1))),0),
          {...line('PPO policy loss',x,rows.map(r=>r.policy_loss??null),1),yaxis:'y2'}];
      }
      if(!rows.length)l.annotations=[{text:'This run fits demonstrations; it has no PPO value updates.',xref:'paper',yref:'paper',x:.5,y:.5,showarrow:false}];
      Plotly.react($('native-training'),traces,l,{responsive:true,displaylogo:false});return;
    }
    if(supervised&&$('native-training-metric').value==='fit'){const rows=run.imitation_history||[],x=rows.map(r=>r.epoch),l=layout('Supervised initialization · held-out episodes');
      l.xaxis.title='Fit epoch';l.yaxis.title='Weighted action prediction MSE';
      Plotly.react($('native-training'),[line('Fitting episodes',x,rows.map(r=>r.train_weighted_mse),1),line('Held-out episodes',x,rows.map(r=>r.validation_weighted_mse),0)],l,{responsive:true,displaylogo:false});return;}
    const episodes=supervised?run.demonstrations:run.episodes;
    const x=episodes.map((e,i)=>e.episode??i+1), returns=episodes.map(e=>e.return);
    const success=episodes.map((_,i)=>{const window=episodes.slice(Math.max(0,i-39),i+1);return 100*window.filter(e=>e.success).length/window.length;});
    const l=layout(supervised?'Initialization collection · '+control:'PPO training return and success');l.xaxis.title='Completed episode';l.yaxis.title='Episode return';
    if(reused){l.title.text='Recorded dataset refit · no new rollout rewards';l.annotations=[{text:'Select “Supervised fitting loss” to inspect learning.',xref:'paper',yref:'paper',x:.5,y:.5,showarrow:false}];}
    l.yaxis2={title:'Success (%) · last 40',overlaying:'y',side:'right',range:[0,100]};l.margin.r=65;
    Plotly.react($('native-training'),[line('Return',x,returns,1),{...line(supervised?'Rolling collection success':'Rolling training success',x,success,0),yaxis:'y2'}],l,{responsive:true,displaylogo:false});
  }
  runs.forEach((r,i)=>$('native-run').append(option(i,r.id)));
  if(runs.length)$('native-run').value=String(runs.length-1);
  function defaultMetric(){if(run?.dataset_import?.labelled_samples)$('native-training-metric').value='fit';}
  $('native-run').onchange=()=>{run=runs[Number($('native-run').value)];defaultMetric();training();};$('native-training-metric').onchange=training;defaultMetric();training();
  const evaluations=d.evaluations?.filter(e=>e.rows.some(r=>r.duration_s>0))||[];
  evaluations.forEach((e,i)=>$('native-evaluation').append(option(i,e.id)));
  if(evaluations.length)$('native-evaluation').value=String(Math.max(0,evaluations.findLastIndex(e=>e.acceptance_eligible)));
  function evaluation(){const e=evaluations[Number($('native-evaluation').value)];$('native-evaluations').replaceChildren();
    $('native-evaluation-summary').textContent=e ? `${e.successes}/${e.completed} successful trials; ${e.completed}/${e.expected} completed. ${e.scope} ${e.audit.scope||''}` : 'Scene evaluation is pending.';
    for(const row of e?.rows||[]){const tr=document.createElement('tr');
      [row.id.replaceAll('_',' ')+` · seed ${row.seed}`,row.success?'Passed':'Failed',(row.terminations||[]).map(x=>x.replaceAll('_',' ')).join(', ')||row.error||''].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});$('native-evaluations').append(tr);}}
  $('native-evaluation').onchange=evaluation;evaluation();
})();

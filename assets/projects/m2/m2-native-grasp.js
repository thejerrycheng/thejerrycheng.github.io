(() => {
  const d=window.M2NativeGrasp, root=document.getElementById('native-grasp');
  if(!d || !root) return;
  const $=id=>document.getElementById(id), colors=['#d18a00','#2876bd','#21a5a6','#8b58ae','#c66061'];
  const runs=d.runs.filter(r=>r.completed), run=runs.at(-1), clips=[...d.clips,...d.runs.flatMap(r=>r.clips)];
  $('native-status').textContent=run ? `${run.id}: ${run.completed} completed training episodes · ${run.successes} successes (${(100*run.successes/run.completed).toFixed(1)}%). Full-mission >90% validation: ${d.validation.target_met?'passed':'not achieved'}.` : 'Native-contact training is starting. Full-mission >90% validation is not achieved.';
  const failure=run ? Object.entries(run.failures).map(([k,v])=>`${k.replaceAll('_',' ')}: ${v}`).join(' · ') : 'No completed training episodes yet.';
  $('native-failures').textContent=failure;
  let clip=clips[0], mode='3d';
  const layout=title=>({title:{text:title,font:{size:15}},paper_bgcolor:'transparent',plot_bgcolor:'transparent',
    margin:{l:55,r:18,t:44,b:65},font:{family:'inherit',size:12},legend:{orientation:'h',y:-.22},
    xaxis:{title:'Simulation time (s)'},yaxis:{automargin:true}});
  const line=(name,x,y,i)=>({name,x,y,type:'scatter',mode:'lines',line:{color:colors[i%colors.length],width:2}});
  function plot(){
    if(!clip) return;
    const rows=clip.trajectory, t=rows.map(r=>r.time_s), hands=Object.keys(rows[0].hands_xyz_m||{});
    let traces=[], l=layout('Object and four hand paths');
    if(mode==='3d'){
      traces=['Object',...hands].map((name,i)=>{const points=rows.map(r=>i?r.hands_xyz_m[name]:r.centroid_xyz_m);
        return {name,type:'scatter3d',mode:'lines',x:points.map(p=>p[0]),y:points.map(p=>p[1]),z:points.map(p=>p[2]),line:{color:colors[i],width:4}};});
      l.scene={aspectmode:'data',xaxis:{title:'World X (m)'},yaxis:{title:'World Y (m)'},zaxis:{title:'World Z (m)'}};
    } else if(mode==='reward'){
      const keys=Object.keys(rows.find(r=>r.reward_components)?.reward_components||{});
      traces=keys.length?keys.map((k,i)=>line(k.replaceAll('_',' '),t,rows.map(r=>r.reward_components?.[k]??null),i)):
        [line('Reward',t,rows.map(r=>r.reward??null),0)];l.title.text='Reward components per control step';l.yaxis.title='Reward';
    } else {
      const settings={force:['normal_force_n',1,'Normal force (N)'],slip:['slip_speed_m_s',1000,'Contact slip (mm/s)'],firmness:['firmness',1,'Firmness proxy (0–1)']};
      if(mode==='work'){
        traces=['mabel','milo'].map((r,i)=>line(r.toUpperCase(),t,rows.map(row=>row.grasp_mechanical_work_j?.[r]??row.render?.robots?.[r]?.grasp_work_j??null),i+1));l.yaxis.title='Finger mechanical work (J)';
      } else {
        const [key,factor,label]=settings[mode];
        traces=hands.map((h,i)=>{const parts=h.split('_'),robot=parts[0],side=parts[1];
          return line(`${robot} ${side}`,t,rows.map(r=>{const q=r.physical_grasps?.[`${robot}/${side}`]??r.render?.robots?.[robot]?.hands?.[side]?.physical_grasp;return q?factor*q[key]:null;}),i+1);});l.yaxis.title=label;
      }
      l.title.text=l.yaxis.title;
    }
    Plotly.react($('native-plot'),traces,l,{responsive:true,displaylogo:false});
  }
  clips.forEach((c,i)=>{const b=document.createElement('button');b.textContent=c.label;b.setAttribute('aria-pressed',i===0?'true':'false');
    b.onclick=()=>{clip=c;for(const x of $('native-clips').children)x.setAttribute('aria-pressed',String(x===b));select();};$('native-clips').append(b);});
  function select(){if(!clip) return;$('native-video').src=clip.video;$('native-video').poster=clip.poster;$('native-caption').textContent=clip.label+' · Native contact dynamics. Recorded failures remain visible.';plot();}
  root.querySelectorAll('[data-native-plot]').forEach(b=>b.onclick=()=>{mode=b.dataset.nativePlot;root.querySelectorAll('[data-native-plot]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));plot();});
  if(clip)select();else $('native-caption').textContent='Complete checkpoint videos will appear after their recording jobs finish.';
  if(run){const x=run.episodes.map((e,i)=>e.episode??i+1), returns=run.episodes.map(e=>e.return);
    const success=run.episodes.map((_,i)=>{const window=run.episodes.slice(Math.max(0,i-39),i+1);return 100*window.filter(e=>e.success).length/window.length;});
    const l=layout('Training return and success');l.xaxis.title='Completed training episode';l.yaxis.title='Episode return';
    l.yaxis2={title:'Success (%) · last 40',overlaying:'y',side:'right',range:[0,100]};l.margin.r=65;
    Plotly.react($('native-training'),[line('Return',x,returns,1),{...line('Rolling training success',x,success,0),yaxis:'y2'}],l,{responsive:true,displaylogo:false});}
  $('native-settings').textContent=JSON.stringify(run?.settings??d.runs.at(-1)?.settings??{},null,2);
})();

(() => {
  'use strict';
  const d=window.M2Rollouts, $=id=>document.getElementById(id), root=$('rollouts');
  if(!d||!root)return;
  const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
  let selected=d.clips.find(c=>c.trace&&c.success)||d.clips.find(c=>c.trace), mode='position', plotted=false;
  const cards=[];
  const stageOrder=['grasp','lift','move','scenes','rotate'];
  // Show one of each movement first, then the remaining trials.
  const ordered=stageOrder.map(s=>d.clips.find(c=>c.stage===s&&c.id.startsWith('shared-lift-'))||d.clips.find(c=>c.stage===s)).filter(Boolean);
  ordered.push(...d.clips.filter(c=>!ordered.includes(c)));
  for(const c of ordered){
    const card=make('article','rollout-card');card.dataset.stage=c.stage;
    const v=make('video');v.controls=true;v.playsInline=true;v.preload='none';v.muted=true;
    v.src=c.video;v.poster=c.poster;v.setAttribute('aria-label',c.title+' — '+c.label);
    const meta=make('div','rollout-meta');meta.append(make('span','',c.label),make('span','rollout-outcome'+(c.success?'':' missed'),c.success?'Completed':'Target missed'));
    card.append(v,meta,make('h3','',c.title),make('p','',c.caption));
    if(c.trace){const b=make('button','rollout-measure','View motion plots ↗');b.onclick=()=>{select(c);$('rollout-feature').scrollIntoView({behavior:'smooth',block:'start'});};card.append(b);}
    $('rollout-grid').append(card);cards.push(card);
  }
  function filter(stage){
    let count=0;cards.forEach(c=>{c.hidden=stage!=='all'&&c.dataset.stage!==stage;if(c.hidden)c.querySelector('video').pause();else count++;});
    root.querySelectorAll('[data-rollout-stage]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rolloutStage===stage)));
    $('rollout-count').textContent=`${count} recordings`;
  }
  root.querySelectorAll('[data-rollout-stage]').forEach(b=>b.onclick=()=>filter(b.dataset.rolloutStage));filter('all');
  root.addEventListener('play',event=>{root.querySelectorAll('video').forEach(v=>{if(v!==event.target)v.pause();});},true);
  const colors=['#b77513','#078b8f','#7564b2'];
  const common=()=>({paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{family:'Jost, Arial, sans-serif',color:getComputedStyle(root).color,size:12},
    margin:{l:48,r:12,t:18,b:66},legend:{orientation:'h',y:-.25,font:{size:10}},xaxis:{title:'Simulation time · s',zeroline:false},yaxis:{automargin:true,zeroline:false}});
  async function plot(){
    if(!selected||!window.Plotly)return;
    const rows=selected.trace, t=rows.map(r=>r.t), l=common();let traces=[];
    if(mode==='path'){
      traces=[{type:'scatter3d',mode:'lines',name:'Measured',x:rows.map(r=>r.xyz[0]),y:rows.map(r=>r.xyz[1]),z:rows.map(r=>r.xyz[2]),line:{color:'#078b8f',width:5}},
        {type:'scatter3d',mode:'markers',name:'Target',x:[selected.target_xyz[0]],y:[selected.target_xyz[1]],z:[selected.target_xyz[2]],marker:{color:'#e89916',size:6,symbol:'diamond'}}];
      l.scene={aspectmode:'data',xaxis:{title:'X · m'},yaxis:{title:'Y · m'},zaxis:{title:'Z · m'}};l.margin={l:0,r:0,t:5,b:35};
    }else if(mode==='grasp'){
      traces=[{name:'Qualified hands',x:t,y:rows.map(r=>r.secured),mode:'lines',line:{color:'#078b8f',shape:'hv',width:2}},
        {name:'Hold time · s',x:t,y:rows.map(r=>r.hold),mode:'lines',line:{color:'#b77513',width:2}}];
      l.yaxis.title='Hands / hold seconds';l.yaxis.range=[-.15,4.3];
    }else{
      const rotation=mode==='rotation',names=rotation?['Roll','Pitch','Yaw']:['X','Y','Height'];
      names.forEach((name,i)=>{
        traces.push({name,x:t,y:rows.map(r=>rotation?r.rpy[i]:r.xyz[i]-rows[0].xyz[i]),mode:'lines',line:{color:colors[i],width:2}});
        const target=rotation?selected.target_rpy[i]:selected.target_xyz[i]-rows[0].xyz[i];
        traces.push({name:name+' target',x:[t[0],t.at(-1)],y:[target,target],mode:'lines',showlegend:false,hoverinfo:'skip',line:{color:colors[i],width:1,dash:'dot'}});
      });
      l.yaxis.title=rotation?'Relative orientation · °':'Displacement · m';
    }
    if(mode!=='path')l.shapes=[{type:'line',xref:'x',yref:'paper',x0:$('rollout-feature-video').currentTime,x1:$('rollout-feature-video').currentTime,y0:0,y1:1,line:{color:'#888',width:1,dash:'dot'}}];
    await Plotly.react($('rollout-motion-plot'),traces,l,{responsive:true,displayModeBar:false});plotted=true;
    $('rollout-motion-plot').dataset.clip=selected.id;$('rollout-motion-plot').dataset.mode=mode;
  }
  function now(){
    if(!selected)return;const time=$('rollout-feature-video').currentTime;
    const row=selected.trace.reduce((a,b)=>Math.abs(a.t-time)<Math.abs(b.t-time)?a:b);
    $('rollout-now').textContent=`${row.t.toFixed(2)} s · ${row.secured}/4 hands secured · ${(100*(row.xyz[2]-selected.trace[0].xyz[2])).toFixed(1)} cm rise`;
    if(plotted&&mode!=='path')Plotly.relayout($('rollout-motion-plot'),{'shapes[0].x0':time,'shapes[0].x1':time});
  }
  function select(c){
    selected=c;const v=$('rollout-feature-video');v.pause();v.src=c.video;v.poster=c.poster;
    $('rollout-feature-caption').textContent=`${c.title} · ${c.success?'Completed':'Target missed'} · seed ${c.seed}. Solid: measured; dotted: final target.`;
    $('rollout-chapters').replaceChildren();
    const start=c.trace[0],secured=c.trace.find(r=>r.secured===4),lifted=c.trace.find(r=>r.xyz[2]-start.xyz[2]>.04);
    const moved=c.trace.find(r=>Math.hypot(r.xyz[0]-start.xyz[0],r.xyz[1]-start.xyz[1])>.04);
    for(const [title,row] of [['Start',start],['Grasp',secured],['Lift',lifted],['Move',moved]]){
      if(!row)continue;const b=make('button','',title+' · '+row.t.toFixed(1)+' s');b.onclick=()=>{v.currentTime=row.t;now();};$('rollout-chapters').append(b);
    }
    plotted=false;plot();now();
  }
  root.querySelectorAll('[data-rollout-plot]').forEach(b=>b.onclick=()=>{mode=b.dataset.rolloutPlot;root.querySelectorAll('[data-rollout-plot]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));plot();});
  $('rollout-feature-video').addEventListener('timeupdate',now);
  if(selected)select(selected);else $('rollout-feature').hidden=true;
  const scores=d.evaluations;
  const translation=scores.find(s=>s.label==='Translate');
  if(translation&&$('rollout-progress-note'))$('rollout-progress-note').textContent=`Established couch benchmarks: lift completes 198/200 trials; corrected final-target translation completes ${translation.passed}/${translation.total} with a 30-second allowance. Full six-axis tracking is still in development.`;
  if(scores.length&&window.Plotly){
    const l=common();l.margin={l:75,r:28,t:12,b:38};l.xaxis={title:'Successful trials · %',range:[0,110],ticksuffix:'%'};l.yaxis={autorange:'reversed'};l.showlegend=false;
    Plotly.newPlot($('rollout-success-plot'),[{type:'bar',orientation:'h',y:scores.map(s=>s.label),x:scores.map(s=>100*s.passed/s.total),
      text:scores.map(s=>`${s.passed}/${s.total}`),textposition:'auto',marker:{color:['#84aaa0','#078b8f','#c18c39']},
      customdata:scores.map(s=>s.note),hovertemplate:'%{y}: %{text}<br>%{customdata}<extra></extra>'}],l,{responsive:true,displayModeBar:false});
  }
  if(d.comparison&&$('rollout-comparison-plot')&&window.Plotly){
    const comparison=d.comparison, traces=[], palette={ppo:'#078b8f',sac:'#c18c39'};
    for(const algorithm of ['ppo','sac']){
      const groups=comparison.groups.filter(g=>g.algorithm===algorithm),offset=algorithm==='ppo'?-.17:.17;
      traces.push({type:'bar',name:algorithm.toUpperCase(),x:groups.map((g,i)=>i+offset),
        y:groups.map(g=>100*g.seeds.reduce((sum,s)=>sum+s.passed/s.total,0)/g.seeds.length),
        width:.28,marker:{color:palette[algorithm]},hovertemplate:algorithm.toUpperCase()+' mean: %{y:.1f}%<extra></extra>'});
      groups.forEach((g,i)=>traces.push({type:'scatter',mode:'markers',name:algorithm.toUpperCase()+' seeds',showlegend:false,
        x:g.seeds.map((s,j)=>i+offset+(j-1)*.065),y:g.seeds.map(s=>100*s.passed/s.total),
        text:g.seeds.map(s=>`${algorithm.toUpperCase()} · seed ${s.seed}: ${s.passed}/${s.total}`),
        marker:{color:palette[algorithm],size:7,line:{color:getComputedStyle(root).color,width:1}},hovertemplate:'%{text}<extra></extra>'}));
    }
    const l=common();l.margin={l:46,r:15,t:12,b:68};l.xaxis={tickvals:[0,1],ticktext:['MLP actor','Temporal actor'],range:[-.5,1.5]};
    l.yaxis={title:'Lift success · %',range:[-4,100],ticksuffix:'%'};l.barmode='overlay';l.legend.y=-.23;
    Plotly.newPlot($('rollout-comparison-plot'),traces,l,{responsive:true,displayModeBar:false});
    $('rollout-comparison-note').textContent=`${comparison.steps.toLocaleString()} environment steps per run · 3 training seeds per condition. Bars: mean. Dots: individual seeds, each evaluated on 40 paired trials. This comparison starts from the same grasp policy; it is separate from the best controller above.`;
  }else if($('rollout-comparison'))$('rollout-comparison').hidden=true;
  if(d.response&&$('rollout-response-plot')&&window.Plotly){
    const renderResponse=async name=>{
      const c=d.response.cases[name], l=common(),traces=[];
      c.lines.forEach((line,i)=>{
        const color=i?'#078b8f':'#b77513';
        traces.push({type:'scatter',mode:'lines',name:line.label,x:line.time_s,y:line.measured,line:{color,width:2.5},
          hovertemplate:`%{x:.2f} s · %{y:.2f} ${c.unit}<extra>${line.label}</extra>`});
        traces.push({type:'scatter',mode:'markers',name:line.success?'Held':'Trial stopped',showlegend:false,
          x:[line.time_s.at(-1)],y:[line.measured.at(-1)],marker:{color,size:10,symbol:line.success?'circle':'x'},
          hovertemplate:line.label+(line.success?' · held at target':' · trial stopped')+'<extra></extra>'});
      });
      const end=Math.max(...c.lines.map(line=>line.time_s.at(-1))),target=c.lines[0].target;
      traces.push({type:'scatter',mode:'lines',name:'Target',x:[0,end],y:[target,target],line:{color:'#6f7a83',width:1.3,dash:'dot'},hoverinfo:'skip'});
      l.yaxis.title=name==='x_positive'?'Object displacement · cm':'Object yaw · °';l.xaxis.range=[0,end*1.03];
      l.legend={orientation:'h',x:0,y:1.12,xanchor:'left',yanchor:'bottom',font:{size:11}};
      l.margin.t=60;l.margin.b=50;l.xaxis.title={text:'Simulation time · s',standoff:10};
      await Plotly.react($('rollout-response-plot'),traces,l,{responsive:true,displayModeBar:false});
      $('rollout-response-plot').dataset.command=name;
      $('rollout-response-note').textContent=d.response.scope+' × marks a stopped trial; ● marks a completed hold.';
      root.querySelectorAll('[data-response-case]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.responseCase===name)));
    };
    root.querySelectorAll('[data-response-case]').forEach(b=>b.onclick=()=>renderResponse(b.dataset.responseCase));
    renderResponse('x_positive');
  }else if($('rollout-response'))$('rollout-response').hidden=true;
  // The large historical snapshot is fetched only when the archive is opened.
  const archive=$('experiment-archive');let loaded=false;
  async function loadArchive(){
    if(!archive.open||loaded)return;loaded=true;
    const notice=make('p','archive-load-note','Loading recorded experiments…');archive.querySelector('summary').after(notice);
    try{
      for(const placeholder of document.querySelectorAll('script[data-archive-src]')){
        await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=placeholder.dataset.archiveSrc;script.onload=resolve;script.onerror=reject;document.head.append(script);});
        placeholder.remove();
      }
      notice.remove();
    }catch(e){loaded=false;notice.textContent='The experiment archive could not load. Close and reopen it to retry.';}
  }
  archive?.addEventListener('toggle',loadArchive);
  document.addEventListener('toggle',event=>{if(event.target.open)requestAnimationFrame(()=>event.target.querySelectorAll('.js-plotly-plot').forEach(p=>Plotly.Plots.resize(p)));},true);
  function revealAnchor(){const target=document.getElementById(location.hash.slice(1));if(target&&archive?.contains(target)){archive.open=true;loadArchive();}}
  window.addEventListener('hashchange',revealAnchor);revealAnchor();
})();

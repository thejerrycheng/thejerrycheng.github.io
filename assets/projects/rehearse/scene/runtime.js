/** Storage LOD and mechanism laws shared verbatim by browser and Node tests.
 * No qpos/qvel pinning: holds are equality constraints / joint forces.
 * eq_active is in mjData (not mjModel) in the vendored 3.15 build.
 */
export function sceneRuntime(mj,model,data,meta,onChange=()=>{}){
  const ev=e=>e?.value??e;
  const id=(kind,name)=>{const i=mj.mj_name2id(model,ev(mj.mjtObj[kind]),name);if(i<0)throw new Error(`Missing ${kind}: ${name}`);return i;};
  const jid=n=>id('mjOBJ_JOINT',n),bid=n=>id('mjOBJ_BODY',n),eid=n=>id('mjOBJ_EQUALITY',n);
  const initialEq=Float64Array.from(model.eq_data);
  const rules=(meta.rules||[]).map(r0=>{
    const r={...r0},j=jid(r.joint);r.q=model.jnt_qposadr[j];r.v=model.jnt_dofadr[j];
    if(r.button)r.bq=model.jnt_qposadr[jid(r.button)];
    if(r.equality)r.eq=eid(r.equality);
    if(r.actuator)r.act=id('mjOBJ_ACTUATOR',r.actuator);
    r.hasOpened=false;r.overloadTime=0;return r;
  });
  const holds=(meta.holds||[]).map(h=>({...h,q:model.jnt_qposadr[jid(h.joint)],act:id('mjOBJ_ACTUATOR',h.actuator)}));
  const stored=Object.entries(meta.storage||{}).map(([asset,s])=>{
    const container=meta.bodies.find(b=>b.name===s.container);
    return {...s,asset,opened:false,container,
      doors:s.door_joints.map(n=>{const j=jid(n);return {q:model.jnt_qposadr[j],lo:model.jnt_range[2*j],range:model.jnt_range[2*j+1]-model.jnt_range[2*j]};}),
      welds:s.welds.map(w=>({...w,eq:eid(w.equality),b:bid(w.body),support:bid(w.support_body)})),
      locks:s.part_locks.map(l=>({eq:eid(l.equality),q:model.jnt_qposadr[jid(l.joint)]}))};
  });
  const fallbacks=(meta.fallback_welds||[]).map(s=>({...s,eqs:[...s.welds,...s.part_locks].map(w=>eid(w.equality)),released:false}));
  // Release policy per stored object: 'open' releases when the enclosing door passes 15 % (only safe where the
  // bundle verified the contents stay put); 'grab' keeps the weld (contents travel with the door/bin) until the
  // user grabs the object. Bundles without the field default to 'grab'.
  for(const s of stored)s.release_on=s.release_on||'grab';
  function bodyMasks(){
    // Broadphase uses per-body aggregates compiled from geom masks. Recompute
    // when changing masks, or zero-mask XML bodies never regain contacts.
    model.body_contype.fill(0);model.body_conaffinity.fill(0);
    for(let g=0;g<model.ngeom;g++){const b=model.geom_bodyid[g];model.body_contype[b]|=model.geom_contype[g];model.body_conaffinity[b]|=model.geom_conaffinity[g];}
  }
  const contactSupports=new Set((meta.fallback_contact_supports||[]).map(bid));
  function masks(s,on){for(const g of s.original_masks){const enabled=on||(s.eqs&&contactSupports.has(model.geom_bodyid[g.id]));model.geom_contype[g.id]=enabled?g.contype:0;model.geom_conaffinity[g.id]=enabled?g.conaffinity:0;}}
  function fraction(s){let x=0;for(const d of s.doors)x=Math.max(x,Math.abs(data.qpos[d.q]-d.lo)/Math.max(d.range,1e-9));return x;}
  function release(s){s.opened=true;for(const w of s.welds)data.eq_active[w.eq]=0;for(const l of s.locks)data.eq_active[l.eq]=0;masks(s,true);onChange(s);}
  function localPosition(a,b){const x=data.xpos,R=data.xmat,dx=x[3*b]-x[3*a],dy=x[3*b+1]-x[3*a+1],dz=x[3*b+2]-x[3*a+2],i=9*a;return [R[i]*dx+R[i+3]*dy+R[i+6]*dz,R[i+1]*dx+R[i+4]*dy+R[i+7]*dz,R[i+2]*dx+R[i+5]*dy+R[i+8]*dz];}
  function relativeQuat(a,b){const Q=data.xquat,i=4*a,j=4*b,w=Q[i],x=-Q[i+1],y=-Q[i+2],z=-Q[i+3],W=Q[j],X=Q[j+1],Y=Q[j+2],Z=Q[j+3];return [w*W-x*X-y*Y-z*Z,w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W];}
  function canRecapture(s){
    for(const w of s.welds){const v=data.cvel,i=6*w.b,speed=Math.hypot(v[i+3],v[i+4],v[i+5])+.1*Math.hypot(v[i],v[i+1],v[i+2]);if(speed>=.02)return false;
      if(s.container?.bounds){const p=localPosition(s.container.id,w.b),[lo,hi]=s.container.bounds;if(p.some((v,k)=>v<lo[k]-.03||v>hi[k]+.03))return false;}}
    return true;
  }
  function recapture(s){
    for(const w of s.welds){model.eq_data.set(localPosition(w.support,w.b),11*w.eq+3);model.eq_data.set(relativeQuat(w.support,w.b),11*w.eq+6);data.eq_active[w.eq]=1;}
    for(const l of s.locks){model.eq_data[11*l.eq]=data.qpos[l.q];data.eq_active[l.eq]=1;}
    s.opened=false;masks(s,false);onChange(s);
  }
  function activate(name){
    // Clicking cannot release hidden contents through a closed cabinet.
    const s=stored.find(s=>s.asset===name);if(s){if(!s.opened&&fraction(s)>.15){release(s);bodyMasks();}return s.opened;}
    // Held objects (failed settle candidates) are released the moment the user grabs them.
    const f=fallbacks.find(f=>f.asset===name);if(f){if(!f.released){f.released=true;for(const i of f.eqs)data.eq_active[i]=0;masks(f,true);bodyMasks();}return true;}
    return true;
  }
  function isHeld(name){const f=fallbacks.find(f=>f.asset===name);return !!f&&!f.released;}
  function canGrab(name){const s=stored.find(s=>s.asset===name);return !s||s.opened||fraction(s)>.15;}
  function resetStorage(){
    model.eq_data.set(initialEq);
    for(const r of rules){r.hasOpened=false;r.overloadTime=0;}
    for(const s of stored){s.opened=false;for(const w of s.welds)data.eq_active[w.eq]=1;for(const l of s.locks)data.eq_active[l.eq]=1;masks(s,false);onChange(s);}
    for(const f of fallbacks){f.released=false;for(const i of f.eqs)data.eq_active[i]=1;masks(f,false);}
    bodyMasks();
  }
  // Kinematic pose edits move a support body without its welded contents (their free joints keep the old world
  // pose); the weld would then snap them back the moment physics runs, and until then they float where the closed
  // door used to be. Re-pose every actively welded free body from its support and the weld's relative pose.
  const welds=[...stored.flatMap(s=>s.welds),...fallbacks.flatMap(f=>f.welds.map(w=>({...w,eq:eid(w.equality),b:bid(w.body),support:bid(w.support_body)})))]
    .map(w=>{const j=model.body_jntadr[w.b];return {...w,q:j>=0&&model.jnt_type[j]===0?model.jnt_qposadr[j]:-1};}).filter(w=>w.q>=0);
  function followSupports(){
    for(let pass=0;pass<3;pass++){let moved=false;
      for(const w of welds){if(!data.eq_active[w.eq])continue;const e=11*w.eq,x=data.xpos,i=3*w.support,R=data.xmat,r=9*w.support,Q=data.xquat,k=4*w.support;
        const px=model.eq_data[e+3],py=model.eq_data[e+4],pz=model.eq_data[e+5];
        const tx=x[i]+R[r]*px+R[r+1]*py+R[r+2]*pz,ty=x[i+1]+R[r+3]*px+R[r+4]*py+R[r+5]*pz,tz=x[i+2]+R[r+6]*px+R[r+7]*py+R[r+8]*pz;
        const w1=Q[k],x1=Q[k+1],y1=Q[k+2],z1=Q[k+3],w2=model.eq_data[e+6],x2=model.eq_data[e+7],y2=model.eq_data[e+8],z2=model.eq_data[e+9];
        const qw=w1*w2-x1*x2-y1*y2-z1*z2,qx=w1*x2+x1*w2+y1*z2-z1*y2,qy=w1*y2-x1*z2+y1*w2+z1*x2,qz=w1*z2+x1*y2-y1*x2+z1*w2;
        const q=w.q,qp=data.qpos;if(Math.abs(qp[q]-tx)+Math.abs(qp[q+1]-ty)+Math.abs(qp[q+2]-tz)+Math.abs(qp[q+3]-qw)+Math.abs(qp[q+4]-qx)+Math.abs(qp[q+5]-qy)+Math.abs(qp[q+6]-qz)<1e-9)continue;
        qp[q]=tx;qp[q+1]=ty;qp[q+2]=tz;qp[q+3]=qw;qp[q+4]=qx;qp[q+5]=qy;qp[q+6]=qz;data.qvel.fill(0,model.jnt_dofadr[model.body_jntadr[w.b]],model.jnt_dofadr[model.body_jntadr[w.b]]+6);moved=true;}
      if(!moved)break;mj.mj_kinematics(model,data);}
  }
  function relatch(name){const r=rules.find(r=>r.joint===name);if(!r||r.eq===undefined)return false;if(Math.abs(data.qpos[r.q])<r.angle&&data.qpos[r.bq]<r.rearm){data.eq_active[r.eq]=1;r.overloadTime=0;r.hasOpened=false;return true;}return false;}
  function update(){
    const qpos=data.qpos,ctrl=data.ctrl,active=data.eq_active;
    for(const r of rules){const q=qpos[r.q];
      if(r.type==='spring_latch'){
        const b=qpos[r.bq];if(active[r.eq]&&b>=r.release){active[r.eq]=0;r.hasOpened=false;}
        if(q>r.opened)r.hasOpened=true;
        if(!active[r.eq]&&r.hasOpened&&q<r.angle&&b<r.rearm){active[r.eq]=1;r.hasOpened=false;}
        data.qfrc_applied[r.v]+=Math.max(0,r.spring_torque-r.spring_slope*q);
      }else if(r.type==='breakaway_latch'){
        if(!active[r.eq])continue;let reaction=0;
        for(let i=0;i<data.nefc;i++)if(data.efc_type[i]===0&&data.efc_id[i]===r.eq)reaction=Math.max(reaction,Math.abs(data.efc_force[i]));
        r.overloadTime=reaction>r.reaction?r.overloadTime+meta.timing.timestep_s:0;
        if(qpos[r.bq]>=r.release||r.overloadTime>=r.duration)active[r.eq]=0;
      }else if(r.type==='detent')ctrl[r.act]=-r.torque*Math.sin(r.count*q);
    }
    for(const h of holds){const q=qpos[h.q];ctrl[h.act]=(Math.abs(q)<h.window?Math.max(-h.force_limit,Math.min(h.force_limit,-h.stiffness*q)):0)+h.counterbalance*(h.kind==='hinge'?Math.cos(q):1);}
    let changed=false;
    for(const s of stored){const open=fraction(s)>.15;if(open&&!s.opened&&s.release_on==='open'){release(s);changed=true;}else if(!open&&s.opened&&canRecapture(s)){recapture(s);changed=true;}}
    if(changed)bodyMasks();
  }
  resetStorage();
  return {rules,holds,stored,fallbacks,update,activate,isHeld,canGrab,followSupports,resetStorage,relatch};
}

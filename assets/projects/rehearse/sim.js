import * as THREE from 'three';
import {OrbitControls} from '../../js/vendor/OrbitControls.js';
import {TransformControls} from '../../js/vendor/controls/TransformControls.js';
import {GLTFLoader} from '../../js/vendor/loaders/GLTFLoader.js';
import {SplatMesh,SparkRenderer} from '../../js/vendor/spark.module.js';
import {RoomEnvironment} from '../../js/vendor/environments/RoomEnvironment.js';

// Gaussian room + per-link Gaussians in their MuJoCo body frames (metres, z up), driven by MuJoCo (WASM)
// running real2sim's MJCF with its collision geometry (physics.xml). MuJoCo qpos is the single source of
// truth: drags and joint sliders write qpos and are only accepted if they create no new penetration.
const BASE='assets/projects/rehearse/real2sim/';
const NAMES={laptop:'Laptop',cup:'Coffee cup',backpack:'Backpack',chair_0:'Left chair',chair_1:'Right chair'};
const JNAMES={laptop_hinge:'Lid hinge',chair_0_swivel:'Seat swivel',chair_1_swivel:'Seat swivel'};
const COLORS={laptop:0x0071e3,cup:0xe8590c,backpack:0x2f9e44,chair_0:0x9c36b5,chair_1:0xc08a00,static:0x868e96};
const STATIC_LABEL={floor:'the floor',pedestal:'the table'};
const TOL=0.0008, DT=0.002;

const $=s=>document.querySelector(s);
const host=$('#sim-view'),statusEl=$('#sim-status'),toast=$('#sim-toast');
const renderer=new THREE.WebGLRenderer({antialias:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0xf5f5f7);host.appendChild(renderer.domElement);
const scene=new THREE.Scene(),spark=new SparkRenderer({renderer});scene.add(spark);
const camera=new THREE.PerspectiveCamera(50,4/3,.02,80);camera.up.set(0,0,1);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.15;controls.maxDistance=12;
const helpers=new THREE.Group();scene.add(helpers);
// polished view: part models (AgentSTAR-style fits) under studio light, on a clean floor and table
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
scene.environment=new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.35;
const sun=new THREE.DirectionalLight(0xfff6ec,1.7);sun.position.set(2.2,-1.6,4.5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-2.5,right:2.5,top:2.5,bottom:-2.5,near:.5,far:12});sun.shadow.bias=-.0004;sun.shadow.normalBias=.02;
scene.add(sun,sun.target,new THREE.HemisphereLight(0xffffff,0x6f665c,.45));
const wxyz=w=>new THREE.Quaternion(w[1],w[2],w[3],w[0]);
const _v=new THREE.Vector3(),_q=new THREE.Quaternion(),_m=new THREE.Matrix4();
let meta,bg,aspect=4/3,meshOn=false,look='scan',studio=null;
let mj=null,model=null,data=null,physics=false,simTime=0,lastT=0;
const objs=[],joints=[],cover=[],pickables=[],staticCol=new THREE.Group();helpers.add(staticCol);staticCol.visible=false;
let sel=null,hold=null,mode='translate',dragging=false,toastTimer=0,blockedAt=0;

function resize(){const w=host.clientWidth,h=Math.round(Math.min(w/aspect,innerHeight*.74));host.style.height=h+'px';renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(host);addEventListener('resize',resize);
function say(msg,ms=0){toast.textContent=msg;toast.hidden=!msg;clearTimeout(toastTimer);if(ms)toastTimer=setTimeout(hint,ms);}
function hint(){say(!model?'Loading physics…':sel?`${sel.label} · drag the ${mode==='translate'?'arrows to move':'rings to rotate'} · Esc to deselect`:'Click any object to move it');}

function view(i){ // OpenCV camera-to-world -> three.js camera
  const v=meta.views[i],M=v.c2w_cv,R=c=>new THREE.Vector3(M[0][c],M[1][c],M[2][c]),t=new THREE.Vector3(M[0][3],M[1][3],M[2][3]);
  const K=meta.intrinsics.K;camera.fov=2*Math.atan(meta.intrinsics.height/2/K[1][1])*180/Math.PI;camera.position.copy(t);camera.up.copy(R(1).negate());
  const fwd=R(2),ped=new THREE.Vector3(...meta.pedestal.box.center);ped.z=meta.pedestal.box.size[2];
  controls.target.copy(t.clone().addScaledVector(fwd,Math.max(.5,ped.clone().sub(t).dot(fwd))));camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.update();camera.up.set(0,0,1);
}

async function loadMesh(url,center){ // unlit mesh, shrunk slightly so observed Gaussians stay in front
  const g=(await new GLTFLoader().loadAsync(url)).scene;
  g.traverse(o=>{if(o.isMesh){const map=o.material.map;if(map)map.colorSpace=THREE.SRGBColorSpace;o.material=new THREE.MeshBasicMaterial({map,color:map?0xffffff:o.material.color});}});
  const s=.985,wrap=new THREE.Group();wrap.add(g);wrap.scale.setScalar(s);wrap.position.copy(center.clone().multiplyScalar(1-s));return wrap;
}

function lineMat(color,opacity=1){return new THREE.LineBasicMaterial({color,depthTest:false,transparent:true,opacity});}

async function buildObject(obj){
  const root=new THREE.Group(),nodes={},waits=[],fills=[],parts=[];
  for(const l of obj.links){
    const content=new THREE.Group();let splat=null;
    if(l.has_gaussians){splat=new SplatMesh({url:BASE+l.name+'.spz'});content.add(splat);waits.push(splat.initialized);}
    const lb=new THREE.Box3(new THREE.Vector3(...l.bounds_local[0]),new THREE.Vector3(...l.bounds_local[1]));
    waits.push(loadMesh(BASE+l.name+'.glb',lb.getCenter(new THREE.Vector3())).then(m=>{
      m.name='fill';content.add(m);pickables.push(m);m.userData.owner=obj.name;
      if(!splat||l.count<2000)m.userData.always=true;else{fills.push(m);m.visible=meshOn;}
      // view coverage: outside the directions the capture saw this link from, its Gaussians smear -> draw the mesh
      if(splat&&l.coverage&&l.count>=2000)cover.push({content,splat,mesh:m,o:new THREE.Vector3(...l.coverage.origin),dirs:l.coverage.dirs.map(d=>new THREE.Vector3(...d)),cos:Math.cos(l.coverage.deg*Math.PI/180),covered:true});
    }));
    if(l.parts)waits.push(new GLTFLoader().loadAsync(BASE+l.name+'.parts.glb').then(gl=>{
      const g=gl.scene;g.name='parts';g.userData.owner=obj.name;g.visible=look==='polished';
      g.traverse(m=>{if(m.isMesh){m.castShadow=m.receiveShadow=true;const mt=m.material;mt.color.convertSRGBToLinear();if(mt.metalness>.5){mt.metalness=.75;mt.roughness=.25;}}});
      content.add(g);pickables.push(g);parts.push({splat,content,parts:g});
    }));
    if(l.parent==='world'){root.position.set(...l.pos_world);root.quaternion.copy(wxyz(l.quat_world_wxyz));root.add(content);nodes[l.name]={pivot:root,content};}
    else{const pivot=new THREE.Group();pivot.position.set(...l.pos_in_parent);content.quaternion.copy(wxyz(l.quat_in_parent_wxyz));pivot.add(content);nodes[l.parent].pivot.add(pivot);nodes[l.name]={pivot,content};}
  }
  await Promise.all(waits);
  scene.add(root);root.updateMatrixWorld(true);
  const inv=root.matrixWorld.clone().invert(),bounds=new THREE.Box3();
  obj.links.forEach(l=>bounds.union(new THREE.Box3().setFromObject(nodes[l.name].content.getObjectByName('fill')).applyMatrix4(inv)));
  const color=COLORS[obj.name]||0x0071e3;
  const box=new THREE.Box3Helper(bounds,color);box.material=lineMat(color);box.renderOrder=1000;root.add(box);
  const o={name:obj.name,label:NAMES[obj.name]||obj.name,root,nodes,fills,parts,bounds,box,color,center:bounds.getCenter(new THREE.Vector3()),
    show:{box:false,joint:false,col:false},joints:[],col:new THREE.Group(),bodies:new Set(),validPos:root.position.clone(),validQuat:root.quaternion.clone()};
  o.col.visible=false;helpers.add(o.col);
  for(const j of obj.joints){
    const n=nodes[j.child],axis=new THREE.Vector3(...j.axis_local).applyQuaternion(n.content.quaternion).normalize();
    const cb=new THREE.Box3().setFromObject(n.content.getObjectByName('fill')).applyMatrix4(n.pivot.matrixWorld.clone().invert()),c=cb.getCenter(new THREE.Vector3());
    const radial=c.clone().sub(axis.clone().multiplyScalar(c.dot(axis)));const rlen=Math.max(radial.length()*1.6,.25);
    const handleLocal=axis.clone().multiplyScalar(c.dot(axis)).add((radial.lengthSq()>1e-6?radial.normalize():new THREE.Vector3(1,0,0)).multiplyScalar(rlen));
    const width=cb.getSize(new THREE.Vector3()).length()*.6;
    // helper: axis line (in the parent pivot frame) + handle on the moving link
    const g=new THREE.Group();g.renderOrder=1001;
    const axLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([axis.clone().multiplyScalar(-width/2),axis.clone().multiplyScalar(width/2)]),lineMat(0xe8590c));axLine.renderOrder=1001;
    n.pivot.position&&n.pivot.parent.add(g);g.position.copy(n.pivot.position);g.add(axLine);
    const handle=new THREE.Mesh(new THREE.SphereGeometry(.022,16,12),new THREE.MeshBasicMaterial({color:0xe8590c,depthTest:false}));handle.renderOrder=1003;handle.position.copy(handleLocal);n.pivot.add(handle);
    const spoke=new THREE.Line(new THREE.BufferGeometry().setFromPoints([axis.clone().multiplyScalar(c.dot(axis)),handleLocal]),lineMat(0xe8590c,.8));spoke.renderOrder=1002;n.pivot.add(spoke);
    const r=j.range_rad;
    const J={name:j.name,label:JNAMES[j.name]||j.name,obj:o,pivot:n.pivot,q0:n.pivot.quaternion.clone(),axis,min:r?r[0]:-Math.PI,max:r?r[1]:Math.PI,limited:!!r,
      captured:r?-r[0]:0,angle:0,parts:[g,handle,spoke],handle};
    handle.userData.joint=J;
    o.joints.push(J);joints.push(J);
  }
  objs.push(o);
  return o;
}

// ---------------------------------------------------------------- MuJoCo
const enumv=e=>e?.value??e;
async function loadPhysics(){
  const {default:load}=await import('../../js/vendor/mujoco/mujoco.js');
  const [M,xml]=await Promise.all([load(),fetch(BASE+'physics.xml').then(r=>r.text())]);
  mj=M;model=(mj.MjModel.from_xml_string||mj.from_xml_string).call(mj.MjModel,xml);data=new mj.MjData(model);mj.mj_forward(model,data);
}
const id=(type,name)=>mj.mj_name2id(model,enumv(mj.mjtObj[type]),name);
function bindPhysics(){
  const rootid=model.body_rootid,nb=model.nbody;
  for(const o of objs){
    const jid=id('mjOBJ_JOINT',o.name+'_free');o.qadr=model.jnt_qposadr[jid];o.dadr=model.jnt_dofadr[jid];
    const rb=id('mjOBJ_BODY',meta.objects.find(x=>x.name===o.name).links[0].name);
    for(let b=0;b<nb;b++)if(rootid[b]===rb)o.bodies.add(b);
    for(const J of o.joints){const k=id('mjOBJ_JOINT',J.name);J.qadr=model.jnt_qposadr[k];J.dadr=model.jnt_dofadr[k];}
  }
  buildCollisionOverlay();
}
const bodyOwner=b=>objs.find(o=>o.bodies.has(b));
function geomLabel(g){const b=model.geom_bodyid[g],o=bodyOwner(b);if(o)return o.label;const n=mj.mj_id2name(model,enumv(mj.mjtObj.mjOBJ_GEOM),g)||'';return STATIC_LABEL[n]||STATIC_LABEL[mj.mj_id2name(model,enumv(mj.mjtObj.mjOBJ_BODY),b)]||'the room';}

function buildCollisionOverlay(){
  const T=model.geom_type,S=model.geom_size,B=model.geom_bodyid;
  for(let g=0;g<model.ngeom;g++){
    const t=T[g],s=[S[3*g],S[3*g+1],S[3*g+2]];let geo=null;
    if(t===6)geo=new THREE.BoxGeometry(2*s[0],2*s[1],2*s[2]);
    else if(t===5)geo=new THREE.CylinderGeometry(s[0],s[0],2*s[1],28).rotateX(Math.PI/2);
    else if(t===2)geo=new THREE.SphereGeometry(s[0],20,14);
    else if(t===3)geo=new THREE.CapsuleGeometry(s[0],2*s[1],8,16).rotateX(Math.PI/2);
    else if(t===7){const m=model.geom_dataid[g],va=model.mesh_vertadr[m],vn=model.mesh_vertnum[m],fa=model.mesh_faceadr[m],fn=model.mesh_facenum[m];
      geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(Float32Array.from(model.mesh_vert.subarray(3*va,3*(va+vn))),3));geo.setIndex(Array.from(model.mesh_face.subarray(3*fa,3*(fa+fn))));}
    if(!geo)continue; // floor plane: drawn as a grid below
    const o=bodyOwner(B[g]),color=o?o.color:COLORS.static;
    const grp=new THREE.Group();grp.matrixAutoUpdate=false;grp.userData.geom=g;
    const face=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.16,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));face.renderOrder=990;
    const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geo,28),lineMat(color,.85));edge.renderOrder=991;
    grp.add(face,edge);(o?o.col:staticCol).add(grp);
  }
  const grid=new THREE.GridHelper(4,20,0x868e96,0xadb5bd);grid.rotateX(Math.PI/2);grid.material.depthTest=false;grid.material.transparent=true;grid.material.opacity=.5;grid.renderOrder=989;
  const ped=meta.pedestal.box;grid.position.set(ped.center[0],ped.center[1],0.001);staticCol.add(grid);
}
function poseCollision(group){
  const xp=data.geom_xpos,xm=data.geom_xmat;
  for(const grp of group.children){const g=grp.userData.geom;if(g===undefined)continue;
    grp.matrix.set(xm[9*g],xm[9*g+1],xm[9*g+2],xp[3*g],xm[9*g+3],xm[9*g+4],xm[9*g+5],xp[3*g+1],xm[9*g+6],xm[9*g+7],xm[9*g+8],xp[3*g+2],0,0,0,1);grp.matrixWorldNeedsUpdate=true;}
}

// qpos <-> three.js
function setPivot(J,a){J.angle=a;J.pivot.quaternion.copy(J.q0).multiply(_q.setFromAxisAngle(J.axis,a));}
function pull(){
  const q=data.qpos;
  for(const o of objs){const a=o.qadr;o.root.position.set(q[a],q[a+1],q[a+2]);o.root.quaternion.set(q[a+4],q[a+5],q[a+6],q[a+3]);}
  for(const J of joints)setPivot(J,q[J.qadr]);
}
function writeObj(o,p,r){const q=data.qpos,a=o.qadr;q[a]=p.x;q[a+1]=p.y;q[a+2]=p.z;q[a+3]=r.w;q[a+4]=r.x;q[a+5]=r.y;q[a+6]=r.z;}
function zeroVel(o){const v=data.qvel;for(let i=0;i<6;i++)v[o.dadr+i]=0;for(const J of o.joints)v[J.dadr]=0;}
// deepest penetration between this object's bodies and anything else, at the current qpos
function penetration(o){
  mj.mj_kinematics(model,data);mj.mj_collision(model,data);
  const n=data.ncon;if(!n)return {pen:0};
  const cs=data.contact,gb=model.geom_bodyid;let pen=0,who=-1;
  for(let i=0;i<n;i++){const c=cs.get(i);const a=o.bodies.has(gb[c.geom1]),b=o.bodies.has(gb[c.geom2]);
    if(a!==b&&-c.dist>pen){pen=-c.dist;who=a?c.geom2:c.geom1;}c.delete?.();}
  cs.delete?.();return {pen,who};
}
const allowed=o=>Math.max(TOL,(o.basePen||0)+3e-4);
function tryPose(o,p,r){ // move toward (p, r); stop at the last collision-free pose
  writeObj(o,p,r);let res=penetration(o),hit=-1;
  if(res.pen>allowed(o)){hit=res.who;let lo=0,hi=1;const p0=o.validPos.clone(),r0=o.validQuat.clone(),pp=new THREE.Vector3(),rr=new THREE.Quaternion();
    for(let k=0;k<12;k++){const t=(lo+hi)/2;pp.lerpVectors(p0,p,t);rr.slerpQuaternions(r0,r,t);writeObj(o,pp,rr);if(penetration(o).pen>allowed(o))hi=t;else lo=t;}
    pp.lerpVectors(p0,p,lo);rr.slerpQuaternions(r0,r,lo);writeObj(o,pp,rr);p=pp;r=rr;}
  o.validPos.copy(p);o.validQuat.copy(r);zeroVel(o);
  if(!physics)mj.mj_kinematics(model,data);
  return hit;
}
function tryJoint(J,target){
  const o=J.obj;target=THREE.MathUtils.clamp(target,J.min,J.max);
  if(!J.limited)target=THREE.MathUtils.euclideanModulo(target-J.angle+Math.PI,2*Math.PI)-Math.PI+J.angle; // shortest way round
  const q=data.qpos,start=q[J.qadr];o.basePen=penetration(o).pen;let ok=start,hit=-1;
  const steps=Math.max(1,Math.ceil(Math.abs(target-start)/.02));
  for(let i=1;i<=steps;i++){const a=start+(target-start)*i/steps;q[J.qadr]=a;const r=penetration(o);
    if(r.pen>allowed(o)){hit=r.who;let lo=ok,hi=a;for(let k=0;k<10;k++){const m=(lo+hi)/2;q[J.qadr]=m;if(penetration(o).pen>allowed(o))hi=m;else lo=m;}ok=lo;break;}ok=a;}
  q[J.qadr]=ok;data.qvel[J.dadr]=0;setPivot(J,ok);
  if(hit>=0)say(`${J.label} stopped: it would hit ${geomLabel(hit)}`,1600);
  return ok;
}

// ---------------------------------------------------------------- interaction
const tc=new TransformControls(camera,renderer.domElement);tc.setSpace('world');tc.setSize(.85);
const proxy=new THREE.Object3D();scene.add(proxy);scene.add(tc.getHelper());
function placeProxy(){if(!sel)return;proxy.quaternion.copy(sel.root.quaternion);proxy.position.copy(sel.center).applyQuaternion(sel.root.quaternion).add(sel.root.position);}
tc.addEventListener('dragging-changed',e=>{
  controls.enabled=!e.value;dragging=e.value;
  if(e.value&&sel){sel.validPos.copy(sel.root.position);sel.validQuat.copy(sel.root.quaternion);sel.basePen=penetration(sel).pen;hold={obj:sel};}
  else if(!e.value){hold=null;placeProxy();if(performance.now()-blockedAt>1200)hint();}
});
tc.addEventListener('objectChange',()=>{
  if(!sel||!dragging)return;
  const r=proxy.quaternion.clone(),p=proxy.position.clone().sub(sel.center.clone().applyQuaternion(r));
  const hit=tryPose(sel,p,r);
  sel.root.position.copy(sel.validPos);sel.root.quaternion.copy(sel.validQuat);placeProxy();
  if(hit>=0){blockedAt=performance.now();say(`Blocked: ${sel.label} would go into ${geomLabel(hit)}`,1600);}
});
function select(o){
  sel=o;if(o&&model){placeProxy();tc.attach(proxy);tc.setMode(mode);}else tc.detach();
  objs.forEach(x=>x.row?.classList.toggle('on',x===o));hint();
}
function setMode(m){mode=m;tc.setMode(m);document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===m)));hint();}

// click to select; drag an orange joint handle to turn the joint
const ray=new THREE.Raycaster(),canvas=renderer.domElement;let down=null,jdrag=null;
function setRay(e){const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);}
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;down={x:e.clientX,y:e.clientY};if(!model||tc.axis)return;setRay(e);
  const hs=joints.filter(J=>J.handle.visible&&isShown(J.handle)).map(J=>J.handle),h=ray.intersectObjects(hs,false)[0];
  if(h){const J=h.object.userData.joint,pivot=J.pivot.getWorldPosition(new THREE.Vector3()),axis=J.axis.clone().applyQuaternion(J.pivot.parent.getWorldQuaternion(new THREE.Quaternion()));
    const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(axis,pivot),p=ray.ray.intersectPlane(plane,new THREE.Vector3());if(!p)return;
    jdrag={J,pivot,axis,plane,start:p.sub(pivot).normalize(),a0:J.angle};hold={joint:J};controls.enabled=false;canvas.setPointerCapture(e.pointerId);e.stopImmediatePropagation();
    say(`${J.label} · ${describe(J)}`);}
},true);
canvas.addEventListener('pointermove',e=>{
  if(!jdrag)return;setRay(e);const p=ray.ray.intersectPlane(jdrag.plane,new THREE.Vector3());if(!p)return;p.sub(jdrag.pivot).normalize();
  const d=Math.atan2(new THREE.Vector3().crossVectors(jdrag.start,p).dot(jdrag.axis),jdrag.start.dot(p));
  tryJoint(jdrag.J,jdrag.a0+d);updateSliders();
});
canvas.addEventListener('pointerup',e=>{
  if(jdrag){jdrag=null;hold=null;controls.enabled=true;hint();return;}
  if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5||tc.dragging||!model)return;
  setRay(e);const h=ray.intersectObjects(pickables,true)[0];let o=null;
  if(h){let n=h.object;while(n&&!n.userData.owner)n=n.parent;o=objs.find(x=>x.name===n?.userData.owner)||null;}
  select(o);
});
addEventListener('keydown',e=>{if(e.target.closest?.('input,textarea'))return;if(e.key==='Escape')select(null);});
function isShown(n){while(n){if(!n.visible)return false;n=n.parent;}return true;}

// ---------------------------------------------------------------- panel
const describe=J=>J.limited?`${Math.round((J.captured+J.angle)*180/Math.PI)}° open`:`${Math.round(THREE.MathUtils.euclideanModulo(J.angle*180/Math.PI+180,360)-180)}°`;
function toggle(label,on,fn){const b=document.createElement('button');b.type='button';b.className='tg';b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',String(on));b.onclick=()=>{fn(b.getAttribute('aria-pressed')!=='true');};return b;}
const COLS=['box','joint','col'];
function buildPanel(){
  const body=$('#sim-layers');body.replaceChildren();
  for(const o of objs){
    const tr=document.createElement('tr');tr.className='obj';o.row=tr;
    const name=document.createElement('td'),nb=document.createElement('button');nb.type='button';nb.className='name';nb.innerHTML=`<i style="background:#${o.color.toString(16).padStart(6,'0')}"></i>${o.label}`;nb.onclick=()=>select(sel===o?null:o);name.append(nb);tr.append(name);
    o.toggles={};
    for(const c of COLS){const td=document.createElement('td');
      if(c==='joint'&&!o.joints.length){td.innerHTML='<span class="na">–</span>';}
      else{const b=toggle(`${o.label} ${c==='col'?'collision':c}`,o.show[c],v=>{o.show[c]=v;syncPanel();});o.toggles[c]=b;td.append(b);}
      tr.append(td);}
    body.append(tr);
    for(const J of o.joints){
      const jr=document.createElement('tr');jr.className='joint';const td=document.createElement('td');td.colSpan=4;
      const deg=x=>x*180/Math.PI;
      td.innerHTML=`<label><span>${J.label}</span><input type="range" min="${deg(J.min).toFixed(1)}" max="${deg(J.max).toFixed(1)}" step="0.5" value="0" aria-label="${o.label} ${J.label}"><output></output></label>`;
      const inp=td.querySelector('input');J.slider=inp;J.out=td.querySelector('output');
      inp.addEventListener('pointerdown',()=>{hold={joint:J};});inp.addEventListener('change',()=>{hold=null;});
      inp.oninput=()=>{if(!model)return;hold={joint:J};tryJoint(J,+inp.value*Math.PI/180);updateSliders();};
      jr.append(td);body.append(jr);}
  }
  // header row: one switch per column for everything
  const allRow=$('#sim-all');allRow.querySelectorAll('[data-all]').forEach(b=>b.onclick=()=>{const c=b.dataset.all,on=!objs.every(o=>o.show[c]||(c==='joint'&&!o.joints.length));
    objs.forEach(o=>{if(c!=='joint'||o.joints.length)o.show[c]=on;});if(c==='col')staticOn=on;syncPanel();});
  $('#sim-static').onclick=()=>{staticOn=!staticOn;syncPanel();};
  syncPanel();updateSliders();
}
let staticOn=false;
function syncPanel(){
  for(const o of objs)for(const c of COLS)o.toggles[c]?.setAttribute('aria-pressed',String(o.show[c]));
  document.querySelectorAll('#sim-all [data-all]').forEach(b=>{const c=b.dataset.all,rel=objs.filter(o=>c!=='joint'||o.joints.length),n=rel.filter(o=>o.show[c]).length;
    b.setAttribute('aria-pressed',String(n===rel.length&&(c!=='col'||staticOn)));b.classList.toggle('mixed',n>0&&n<rel.length);});
  $('#sim-static').setAttribute('aria-pressed',String(staticOn));
}
function updateSliders(){for(const J of joints){if(document.activeElement!==J.slider)J.slider.value=(J.angle*180/Math.PI).toFixed(1);J.out.textContent=describe(J);}}

function setPhysics(on){
  physics=on;const b=$('#sim-physics');b.setAttribute('aria-pressed',String(on));b.querySelector('span').textContent=on?'Pause physics':'Start physics';
  $('#sim-root').classList.toggle('running',on);lastT=performance.now();
  if(on)objs.forEach(o=>zeroVel(o));
  say(on?'Physics on · gravity and contact are live. Drag objects or joints to push the scene.':'Physics paused',2200);
}
function reset(){
  if(!model)return;mj.mj_resetData(model,data);mj.mj_forward(model,data);simTime=0;pull();
  objs.forEach(o=>{o.validPos.copy(o.root.position);o.validQuat.copy(o.root.quaternion);});placeProxy();updateSliders();say('Scene reset to the captured state',1600);
}

function step(now){
  const dt=Math.min((now-lastT)/1000,1/20);lastT=now;
  const n=Math.max(1,Math.round(dt/DT));
  for(let i=0;i<n;i++){applyHold();mj.mj_step(model,data);}
  applyHold();simTime+=n*DT;
  const q=data.qpos;for(let i=0;i<model.nq;i++)if(!Number.isFinite(q[i])){reset();setPhysics(false);say('Simulation became unstable and was reset',2500);return;}
  pull();
}
function applyHold(){
  if(!hold)return;
  if(hold.obj){writeObj(hold.obj,hold.obj.validPos,hold.obj.validQuat);zeroVel(hold.obj);}
  if(hold.joint){data.qpos[hold.joint.qadr]=hold.joint.angle;data.qvel[hold.joint.dadr]=0;}
}

// ---------------------------------------------------------------- frame loop
function updateCoverage(){if(look!=='scan')return;for(const c of cover){c.content.updateMatrixWorld();_v.copy(camera.position).applyMatrix4(_m.copy(c.content.matrixWorld).invert()).sub(c.o).normalize();
  let best=-1;for(const d of c.dirs){const x=d.dot(_v);if(x>best)best=x;}const ok=best>=c.cos;if(ok!==c.covered){c.covered=ok;c.splat.visible=ok;c.mesh.visible=!ok||meshOn;}}}
let frameN=0;
function frame(now){
  requestAnimationFrame(frame);controls.update();
  if(model){
    if(physics)step(now);
    if(sel&&!dragging)placeProxy();
    for(const o of objs){o.box.visible=o.show.box||sel===o;o.box.material.opacity=sel===o?1:.75;
      for(const J of o.joints)J.parts.forEach(p=>p.visible=o.show.joint||sel===o);
      o.col.visible=o.show.col;if(o.col.visible)poseCollision(o.col);}
    staticCol.visible=staticOn;if(staticOn)poseCollision(staticCol);
    if(physics&&++frameN%6===0){updateSliders();$('#sim-time').textContent=`t = ${simTime.toFixed(1)} s`;}
  }
  updateCoverage();renderer.render(scene,camera);
}

function buildStudio(){
  const g=new THREE.Group(),cv=document.createElement('canvas');cv.width=cv.height=256;const x=cv.getContext('2d');
  for(let i=0;i<2;i++)for(let j=0;j<2;j++){x.fillStyle=(i+j)%2?'#8c8378':'#9d9489';x.fillRect(i*128,j*128,128,128);}
  const tex=new THREE.CanvasTexture(cv);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(10,10);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshStandardMaterial({map:tex,roughness:.92}));floor.receiveShadow=true;floor.name='floor';
  const ped=meta.pedestal.box,c=new THREE.Vector3(...ped.center);floor.position.set(c.x,c.y,0);
  const table=new THREE.Mesh(new THREE.BoxGeometry(...ped.size),new THREE.MeshStandardMaterial({color:0xe9e7e2,roughness:.65}));
  table.position.copy(c);table.rotation.z=(ped.yaw_deg||0)*Math.PI/180;table.castShadow=table.receiveShadow=true;
  sun.target.position.set(c.x+.4,c.y+.6,0);sun.position.set(c.x+2.6,c.y-1.2,4.8);
  g.add(floor,table);g.visible=false;scene.add(g);return g;
}
function setLook(v){
  look=v;const pol=v==='polished';
  document.querySelectorAll('[data-look]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.look===v)));
  $('#sim-root').classList.toggle('polished',pol);
  const room=$('#sim-room');room.checked=!pol;if(bg)bg.visible=!pol;
  studio.visible=pol;studio.getObjectByName('floor').visible=true;
  for(const o of objs){
    for(const p of o.parts){p.parts.visible=pol;if(p.splat)p.splat.visible=!pol;
      const f=p.content.getObjectByName('fill');if(f)f.visible=!pol&&(f.userData.always||meshOn);}
  }
  if(!pol)cover.forEach(c=>{c.covered=true;c.splat.visible=true;c.mesh.visible=c.mesh.userData.always||meshOn;});
  try{localStorage.setItem('rehearse-look',v);}catch(e){}
}

async function init(){
  meta=await fetch(BASE+'scene.json').then(r=>r.json());aspect=meta.intrinsics.width/meta.intrinsics.height;resize();view(0);
  bg=new SplatMesh({url:BASE+'background.spz'});scene.add(bg);
  const physicsP=loadPhysics();
  await Promise.all([bg.initialized,...meta.objects.map(buildObject)]);
  objs.sort((a,b)=>meta.objects.findIndex(x=>x.name===a.name)-meta.objects.findIndex(x=>x.name===b.name));
  objs.forEach(o=>o.joints.forEach(J=>J.parts.forEach(p=>p.visible=false)));
  studio=buildStudio();statusEl.hidden=true;buildPanel();hint();
  let saved='scan';try{saved=localStorage.getItem('rehearse-look')||'scan';}catch(e){}
  if(/[?#&]look=polished/.test(location.href))saved='polished';
  setLook(saved==='polished'?'polished':'scan');
  const total=Object.values(meta.counts).reduce((a,b)=>a+b,0);$('#sim-count').textContent=(total/1e6).toFixed(2)+' M Gaussians';
  try{await physicsP;bindPhysics();pull();$('#sim-root').classList.add('ready');hint();}
  catch(err){console.error(err);say('Physics could not load in this browser; the scene is view-only.');}
  window.rehearseSim={ready:!!model,setLook,get look(){return look;},meta,scene,camera,renderer,objs,joints,view,select,setPhysics,reset,tryPose,tryJoint,penetration,get model(){return model;},get data(){return data;},get mj(){return mj;}};
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>meta&&view(+b.dataset.view));
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('#sim-physics').onclick=()=>model&&setPhysics(!physics);
$('#sim-reset').onclick=reset;
$('#sim-room').onchange=e=>{if(bg)bg.visible=e.target.checked;if(studio&&look==='polished')studio.getObjectByName('floor').visible=!e.target.checked;};
document.querySelectorAll('[data-look]').forEach(b=>b.onclick=()=>studio&&setLook(b.dataset.look));
$('#sim-mesh').onchange=e=>{meshOn=e.target.checked;if(look!=='scan')return;objs.forEach(o=>o.fills.forEach(m=>m.visible=meshOn));cover.forEach(c=>{c.covered=true;c.splat.visible=true;});};
init().catch(e=>{console.error(e);statusEl.hidden=false;statusEl.textContent='This viewer needs WebGL 2.';});requestAnimationFrame(frame);

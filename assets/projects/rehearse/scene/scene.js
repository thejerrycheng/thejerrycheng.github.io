import * as THREE from 'three';
import {OrbitControls} from '../../../js/vendor/OrbitControls.js';
import {TransformControls} from '../../../js/vendor/controls/TransformControls.js';
import {GLTFLoader} from '../../../js/vendor/loaders/GLTFLoader.js';
import {SplatMesh,SparkRenderer} from '../../../js/vendor/spark.module.js';
import {RoomEnvironment} from '../../../js/vendor/environments/RoomEnvironment.js';
import {sceneRuntime} from './runtime.js';

let mujocoModule;
const loadMuJoCo=()=>mujocoModule??=(import('../../../js/vendor/mujoco/mujoco.js').then(({default:load})=>load()));
const enumValue=e=>e?.value??e;
const quat=q=>new THREE.Quaternion(q[1],q[2],q[3],q[0]);
const clamp=THREE.MathUtils.clamp;
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const button=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};
const shown=n=>{while(n){if(!n.visible)return false;n=n.parent;}return true;};

/** Lightweight retained reconstruction preview; call only when its panel opens. */
export async function mountSplatPreview(host,{dataUrl,splatUrl,camerasEl,pathInput,statusEl}){
  const meta=await fetch(dataUrl).then(r=>r.json());
  const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.setClearColor(0xf5f5f7);host.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.02,60),controls=new OrbitControls(camera,renderer.domElement);camera.up.set(0,0,1);controls.enableDamping=true;
  scene.add(new SparkRenderer({renderer}));const splat=new SplatMesh({url:splatUrl});scene.add(splat);
  const path=new THREE.Line(new THREE.BufferGeometry().setFromPoints(meta.path.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:0x0071e3}));path.visible=pathInput.checked;scene.add(path);pathInput.onchange=()=>path.visible=pathInput.checked;
  const view=i=>{const M=meta.views[i].c2w_cv,R=c=>new THREE.Vector3(M[0][c],M[1][c],M[2][c]);camera.position.set(M[0][3],M[1][3],M[2][3]);camera.up.copy(R(1).negate());controls.target.copy(camera.position).addScaledVector(R(2),.8);camera.fov=2*Math.atan(meta.intrinsics.height/2/meta.intrinsics.K[1][1])*180/Math.PI;camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.update();[...camerasEl.querySelectorAll('button')].forEach((b,k)=>b.setAttribute('aria-pressed',String(k===i)));};
  meta.views.forEach((v,i)=>camerasEl.append(button(String.fromCharCode(65+i),()=>view(i))));view(0);
  const resize=()=>{const w=host.clientWidth;if(!w)return;const h=Math.min(w*.75,innerHeight*.7);host.style.height=h+'px';renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(host);resize();
  let visible=false;new IntersectionObserver(entries=>visible=entries[0].isIntersecting).observe(host);renderer.setAnimationLoop(()=>{if(visible&&host.closest('details')?.open){controls.update();renderer.render(scene,camera);}});
  await splat.initialized;statusEl.hidden=true;
}

/** Mount a Z-up scene.json bundle. All state, DOM queries and handlers are local.
 * Returns an API with ready, reset, destroy and diagnostic access for smoke tests.
 * Models own their joints/labels/rules; this module has no kitchen-specific names.
 */
export function mountScene(host,{dataUrl}={}){
  if(!host||!dataUrl)throw new Error('mountScene requires an element and dataUrl');
  const started=performance.now(),base=new URL('.',new URL(dataUrl,document.baseURI));
  host.classList.add('scene-viewer');host.tabIndex=0;
  const stage=el('div','scene-stage'),viewport=el('div','scene-viewport'),panel=el('aside','scene-panel');
  panel.setAttribute('aria-label','Scene controls');stage.append(viewport);host.replaceChildren(stage,panel);
  const status=el('p','scene-status','Loading scene…'),toast=el('p','scene-toast','Loading…'),hud=el('div','scene-hud'),badge=el('div','scene-badge');
  status.setAttribute('role','status');toast.setAttribute('aria-live','polite');stage.append(status,hud,badge,toast);
  const lookGroup=el('div','scene-segment'),cameraGroup=el('div','scene-segment');hud.append(lookGroup,cameraGroup);
  lookGroup.setAttribute('aria-label','Appearance');cameraGroup.setAttribute('aria-label','Capture camera');
  const countLabel=el('span'),timeLabel=el('span'),forceLabel=el('span');badge.append(countLabel,timeLabel,forceLabel);
  const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power'});
  renderer.shadowMap.enabled=innerWidth>760;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0xf4f4f5);viewport.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.015,40);camera.up.set(0,0,1);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.08;controls.maxDistance=15;
  const spark=new SparkRenderer({renderer});scene.add(spark);
  const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(new RoomEnvironment(),.04);scene.environment=env.texture;scene.environmentIntensity=.6;
  const sun=new THREE.DirectionalLight(0xfff4e7,2);sun.position.set(1,-1,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-3;sun.shadow.camera.right=3;sun.shadow.camera.top=3;sun.shadow.camera.bottom=-3;sun.shadow.bias=-.0005;scene.add(sun,new THREE.HemisphereLight(0xffffff,0x665e54,1));
  const overlays=new THREE.Group();scene.add(overlays);
  const proxy=new THREE.Object3D();scene.add(proxy);
  const tc=new TransformControls(camera,renderer.domElement);tc.setSpace('world');tc.setSize(.8);scene.add(tc.getHelper());
  const forceArrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(),.1,0xe8590c,.04,.022);forceArrow.visible=false;scene.add(forceArrow);
  const ac=new AbortController(),listen=(target,name,fn,opts={})=>target.addEventListener(name,fn,{...opts,signal:ac.signal});
  const bodies=new Map(),objects=new Map(),joints=new Map(),flexes=[],pickables=[],collision=[];
  let mj,model,data,meta,runtime,bg,studio,pathLine,selected=null,look='scan',physics=false,mode='translate',meshOn=false,roomOn=true,staticCollision=false,alive=true,visible=true;
  let drag=false,jdrag=null,softDrag=null,hold=null,down=null,raf=0,last=performance.now(),accumulator=0,lastPanel=0,steps=0,stepTotal=0,frameMs=0,loadMs=0,frames=0,activeWallMs=0;
  const stepSamples=[],frameSamples=[];
  const loaded=[],stored=[],rules=[],collisionBuilt=new Set();
  const url=p=>new URL(p,base).href;
  const say=text=>{toast.textContent=text;};
  const hint=()=>say(selected?`${selected.label} · ${selected.soft?'drag its surface to press':selected.free_joints.length?'drag arrows to move':'use the joint sliders or orange handles'}`:'Select an object or search by name. Drag empty space to orbit.');
  const id=(kind,name)=>mj.mj_name2id(model,enumValue(mj.mjtObj[kind]),name);
  const resize=()=>{const w=viewport.clientWidth,h=Math.max(innerWidth<=760?360:320,Math.min(innerHeight*.74,w*.78));viewport.style.height=h+'px';renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
  const ro=new ResizeObserver(resize);ro.observe(viewport);resize();
  const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=performance.now();},{rootMargin:'200px'});io.observe(host);
  const actions=el('div','scene-actions'),physicsButton=button('Start physics',()=>setPhysics(!physics),'scene-primary'),resetButton=button('Reset',reset);
  physicsButton.dataset.action='physics';resetButton.dataset.action='reset';actions.append(physicsButton,resetButton);panel.append(actions);
  const tools=el('div','scene-segment');tools.setAttribute('aria-label','Drag tool');
  for(const m of ['translate','rotate']){const b=button(m==='translate'?'Move':'Rotate',()=>{mode=m;tc.setMode(m);for(const x of tools.children)x.setAttribute('aria-pressed',String(x===b));});b.dataset.tool=m;b.setAttribute('aria-pressed',String(m===mode));tools.append(b);}panel.append(tools);
  const search=el('input','scene-search');search.type='search';search.placeholder='Find an object or joint';search.setAttribute('aria-label','Search scene objects');panel.append(search);
  const totals=el('div','scene-total'),all=el('div','scene-overlay-all');all.append(el('span',null,'Show all'));
  for(const key of ['box','joint','collision']){const b=button(key==='collision'?'Collisions':key==='box'?'Boxes':'Joints',()=>{const on=b.getAttribute('aria-pressed')!=='true';for(const o of objects.values())o.show[key]=on;if(key==='collision')staticCollision=on;b.setAttribute('aria-pressed',String(on));syncOverlays();});b.setAttribute('aria-pressed','false');all.append(b);}panel.append(totals,all);
  const list=el('div','scene-object-list');panel.append(list);
  const options=el('div','scene-options');panel.append(options);
  function check(label,value,fn){const lab=el('label'),input=el('input');input.type='checkbox';input.checked=value;input.onchange=()=>fn(input.checked);lab.append(input,document.createTextNode(label));options.append(lab);return input;}
  check('Room',true,on=>{roomOn=on;if(bg)bg.visible=on&&look==='scan';});
  check('Scan meshes',false,on=>{meshOn=on;setLook(look);});
  check('Camera path',false,on=>{if(pathLine)pathLine.visible=on;});
  panel.append(el('p','scene-help','Select an object, then drag arrows or rotation rings. Use sliders or orange handles for joints. Soft items keep their scanned shape. Open storage before picking up its contents. Esc deselects. Physics and reset work in either look.'));
  const lookButtons={};for(const value of ['scan','polished']){const b=button(value==='scan'?'Scan':'Polished',()=>setLook(value));b.dataset.sceneLook=value;lookButtons[value]=b;lookGroup.append(b);}

  function view(i){
    if(!meta)return;
    const M=meta.views[i].c2w_cv,R=c=>new THREE.Vector3(M[0][c],M[1][c],M[2][c]);camera.position.set(M[0][3],M[1][3],M[2][3]);
    const K=meta.intrinsics.K;camera.fov=Math.min(80,2*Math.atan(meta.intrinsics.height/(2*K[1][1]))*180/Math.PI);camera.up.copy(R(1).negate());
    controls.target.copy(camera.position).addScaledVector(R(2),1.25);camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.update();camera.up.set(0,0,1);
    [...cameraGroup.children].forEach((b,k)=>b.setAttribute('aria-pressed',String(k===i)));
  }
  function setLook(v){
    look=v;for(const key in lookButtons)lookButtons[key].setAttribute('aria-pressed',String(key===v));
    if(bg)bg.visible=v==='scan'&&roomOn;if(studio)studio.visible=v==='polished';
    for(const b of bodies.values()){
      if(b.splat)b.splat.visible=v==='scan';
      if(b.polished)b.polished.visible=v==='polished'||(!b.splat&&!b.scan);
      if(b.scan)b.scan.visible=v==='scan'&&(meshOn||!b.splat);
      // A sparse observation keeps the source mesh as a coverage fill.
      if(b.polished&&v==='scan'&&b.count<80)b.polished.visible=true;
    }
  }
  function updateCoverage(){
    if(look!=='scan')return;
    const local=new THREE.Vector3();
    for(const b of bodies.values())if(b.splat&&b.coverage&&b.polished){
      b.root.worldToLocal(local.copy(camera.position));local.sub(new THREE.Vector3(...b.coverage.origin)).normalize();
      const covered=b.coverage.dirs.some(d=>local.x*d[0]+local.y*d[1]+local.z*d[2]>=b.coverage.cos);
      b.splat.visible=covered;b.polished.visible=!covered||b.count<80;
      if(b.scan)b.scan.visible=meshOn||!covered;
    }
  }
  function makeStudio(){
    studio=new THREE.Group();scene.add(studio);
    const f=meta.studio?.floor;if(f){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...f.size),new THREE.MeshStandardMaterial({color:0xd5d1c9,roughness:.85}));mesh.position.set(...f.center);mesh.receiveShadow=true;studio.add(mesh);}
    if(!meta.studio?.modeled_counters)for(const b of meta.studio?.counters||[]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...b.size),new THREE.MeshStandardMaterial({color:0xe2ddd1,roughness:.6}));mesh.position.set(...b.center);mesh.rotation.z=(b.yaw_deg||0)*Math.PI/180;studio.add(mesh);}
  }
  function bodyPose(b,X,Q){const i=b.id;b.root.position.fromArray(X,3*i);b.root.quaternion.set(Q[4*i+1],Q[4*i+2],Q[4*i+3],Q[4*i]);}
  function pull(){const X=data.xpos,Q=data.xquat,V=data.flexvert_xpos;for(const b of bodies.values())bodyPose(b,X,Q);for(const f of flexes){f.geometry.attributes.position.array.set(V.subarray(3*f.vertex_start,3*(f.vertex_start+f.vertex_count)));f.geometry.attributes.position.needsUpdate=true;f.geometry.computeVertexNormals();f.geometry.computeBoundingSphere();}if(selected&&!drag)placeProxy();}
  function rootBody(o,bodyName){if(bodyName){let b=id('mjOBJ_BODY',bodyName);while(b>0){const j=model.body_jntadr[b];if(j>=0&&model.jnt_type[j]===0)return {j,b,q:model.jnt_qposadr[j],v:model.jnt_dofadr[j]};b=model.body_parentid[b];}}const free=o.free_joints[0];if(!free)return null;const j=id('mjOBJ_JOINT',free);return {j,b:model.jnt_bodyid[j],q:model.jnt_qposadr[j],v:model.jnt_dofadr[j]};}
  function placeProxy(){if(!selected?.free)return;const b=bodies.get(model.body_rootid?mj.mj_id2name(model,enumValue(mj.mjtObj.mjOBJ_BODY),selected.free.b):'');if(!b)return;proxy.position.copy(b.root.position);proxy.quaternion.copy(b.root.quaternion);}
  function select(o,bodyName){
    if(typeof o==='string')o=objects.get(o);
    selected=o||null;tc.detach();
    for(const x of objects.values())x.row?.classList.toggle('selected',x===o);
    if(o){o.free=rootBody(o,bodyName);if(o.free&&!o.soft&&!meta.fallback_welds?.some(f=>f.asset===o.name)){placeProxy();tc.attach(proxy);tc.setMode(mode);}o.row?.closest('details.scene-category')?.setAttribute('open','');o.row?.setAttribute('open','');}
    syncOverlays();hint();
  }
  function focus(name){
    const o=typeof name==='string'?objects.get(name):name;if(!o)return;
    const box=new THREE.Box3();for(const n of o.bodies){const b=bodies.get(n);if(!b?.bounds)continue;b.root.updateMatrixWorld(true);box.union(new THREE.Box3(new THREE.Vector3(...b.bounds[0]),new THREE.Vector3(...b.bounds[1])).applyMatrix4(b.root.matrixWorld));}
    if(box.isEmpty())return;const center=box.getCenter(new THREE.Vector3()),distance=Math.max(.35,box.getSize(new THREE.Vector3()).length()*1.5),direction=camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,distance);controls.update();select(o);
  }
  function penetration(o){
    mj.mj_kinematics(model,data);mj.mj_collision(model,data);let depth=0;
    const cs=data.contact;for(let k=0;k<data.ncon;k++){const c=cs.get(k);if(c.geom1>=0&&c.geom2>=0){const a=o.ids.has(model.geom_bodyid[c.geom1]),b=o.ids.has(model.geom_bodyid[c.geom2]);if(a!==b)depth=Math.max(depth,-c.dist);}c.delete?.();}cs.delete?.();return depth;
  }
  function tryPose(o,p,q){
    if(typeof o==='string')o=objects.get(o);const f=o.free||rootBody(o);if(!f)return false;if(!runtime.activate(o.name)){say(meta.storage?.[o.name]?'Open the enclosing door before moving this object.':'This object is held because its support fit needs correction.');return false;}
    const start=Float64Array.from(data.qpos.subarray(f.q,f.q+7)),a=new THREE.Vector3(...start.slice(0,3)),aq=quat(start.slice(3));const baseline=penetration(o),write=(p,q)=>{data.qpos.set([p.x,p.y,p.z,q.w,q.x,q.y,q.z],f.q);};
    write(p,q);let ok=true;if(penetration(o)>Math.max(.001,baseline+.0005)){ok=false;let lo=0,hi=1;const pp=new THREE.Vector3(),qq=new THREE.Quaternion();for(let i=0;i<10;i++){const t=(lo+hi)/2;pp.lerpVectors(a,p,t);qq.slerpQuaternions(aq,q,t);write(pp,qq);if(penetration(o)>Math.max(.001,baseline+.0005))hi=t;else lo=t;}write(pp.lerpVectors(a,p,lo),qq.slerpQuaternions(aq,q,lo));say(`${o.label} stopped at a contact.`);}
    data.qvel.fill(0,f.v,f.v+6);activate(o.name);mj.mj_forward(model,data);pull();return ok;
  }
  function jointValue(J,target){
    if(typeof J==='string')J=joints.get(J);target=clamp(target,...J.range);
    if(meta.storage?.[J.asset]&&!runtime.activate(J.asset)){say('Open the enclosing door first.');return data.qpos[J.qadr];}
    const latch=rules.find(r=>r.type.endsWith('latch')&&r.joint===J.name);
    if(latch&&data.eq_active[latch.eq]&&target>J.rest+.01){say('Press the release button to unlatch the door.');return data.qpos[J.qadr];}
    if(physics){hold={joint:J,target};if(J.position_actuator!==undefined)data.ctrl[J.position_actuator]=target;return data.qpos[J.qadr];}
    const o=objects.get(J.asset),old=data.qpos[J.qadr],baseline=penetration(o);let accepted=old;
    const n=Math.min(100,Math.max(1,Math.ceil(Math.abs(target-old)/(J.type==='slide'?.01:.04))));
    for(let i=1;i<=n;i++){data.qpos[J.qadr]=old+(target-old)*i/n;if(penetration(o)>Math.max(.001,baseline+.0005)){say(`${J.label} stopped at a contact.`);break;}accepted=data.qpos[J.qadr];}
    data.qpos[J.qadr]=accepted;data.qvel[J.dadr]=0;if(J.position_actuator!==undefined)data.ctrl[J.position_actuator]=accepted;applyRules();mj.mj_forward(model,data);pull();updateSliders();return accepted;
  }
  function activate(name){return runtime.activate(name);}
  function applyRules(){runtime.update();}
  function showForce(J,value){
    const b=bodies.get(J.body);if(!b)return;b.root.updateMatrixWorld(true);
    const origin=J.handle.getWorldPosition(new THREE.Vector3()),axis=new THREE.Vector3(...J.axis).applyQuaternion(b.root.quaternion).normalize();
    let direction=axis;if(J.type==='hinge'){const radial=origin.clone().sub(b.root.localToWorld(new THREE.Vector3(...J.pos)));direction=new THREE.Vector3().crossVectors(axis,radial).normalize();}direction.multiplyScalar(Math.sign(value)||1);
    forceArrow.position.copy(origin);forceArrow.setDirection(direction);forceArrow.setLength(.06+Math.min(.35,Math.abs(value)*.012),.035,.018);forceArrow.visible=Math.abs(value)>.0001;
    forceLabel.textContent=`Applied ${value.toFixed(2)} ${J.type==='slide'?'N':'N m'}`;
  }
  function applyHold(){
    data.qfrc_applied.fill(0);data.xfrc_applied.fill(0);
    if(hold?.joint){const J=hold.joint,error=hold.target-data.qpos[J.qadr],C=J.control||{max_force:J.type==='slide'?40:8,kp:J.type==='slide'?900:22,kd:J.type==='slide'?18:2.4};
      data.qfrc_applied[J.dadr]=hold.force??clamp(C.kp*error-C.kd*data.qvel[J.dadr]+Math.sign(error)*(C.friction_compensation||0),-C.max_force,C.max_force);showForce(J,data.qfrc_applied[J.dadr]);if(hold.until!==undefined&&data.time>=hold.until)hold=null;
    }else if(softDrag){
      const b=softDrag.body,dx=softDrag.target.clone().sub(new THREE.Vector3().fromArray(data.xpos,3*b));dx.multiplyScalar(100);if(dx.length()>8)dx.setLength(8);data.xfrc_applied.set([dx.x,dx.y,dx.z,0,0,0],6*b);forceLabel.textContent=`Applied ${dx.length().toFixed(2)} N`;forceArrow.position.copy(softDrag.point);forceArrow.setDirection(dx.clone().normalize());forceArrow.setLength(.1+dx.length()*.02);forceArrow.visible=true;
    }else{forceArrow.visible=false;forceLabel.textContent='';}
    if(drag&&selected?.free){const f=selected.free;data.qpos.set([proxy.position.x,proxy.position.y,proxy.position.z,proxy.quaternion.w,proxy.quaternion.x,proxy.quaternion.y,proxy.quaternion.z],f.q);data.qvel.fill(0,f.v,f.v+6);}
  }
  function setPhysics(on){if(!model)return;physics=on;physicsButton.textContent=on?'Pause physics':'Start physics';physicsButton.setAttribute('aria-pressed',String(on));last=performance.now();accumulator=0;if(!on){hold=null;data.qfrc_applied.fill(0);data.xfrc_applied.fill(0);forceArrow.visible=false;forceLabel.textContent='';}say(on?'Gravity and contact are live. Orange arrows show the force applied by the drag tool.':'Physics paused · sliders edit collision-checked poses.');}
  function reset(){
    if(!model)return;setPhysics(false);mj.mj_resetDataKeyframe(model,data,id('mjOBJ_KEY','rest'));runtime.resetStorage();
    hold=null;jdrag=null;softDrag=null;drag=false;steps=0;stepTotal=0;activeWallMs=0;stepSamples.length=0;frameSamples.length=0;
    applyRules();mj.mj_forward(model,data);pull();updateSliders();say('Reset to the assembled rest state.');
  }
  function press(J){if(typeof J==='string')J=joints.get(J);if(!J)return;select(objects.get(J.asset));setPhysics(true);hold={joint:J,target:J.range[1],force:Math.max(12,J.friction*2+2),until:data.time+.4};}
  function syncOverlays(){
    if(model){for(const o of objects.values())if(o.show.collision)makeCollisions(o);if(staticCollision)makeCollisions(null);}
    for(const o of objects.values()){
      for(const n of o.bodies){const b=bodies.get(n);if(b?.box)b.box.visible=o.show.box||selected===o;}
      for(const name of o.joints){const J=joints.get(name);if(J)J.handle.visible=J.axisLine.visible=o.show.joint||selected===o;}
      for(const [key,b] of Object.entries(o.toggles||{}))b.setAttribute('aria-pressed',String(o.show[key]));
    }
    for(const c of collision)c.mesh.visible=c.asset?(objects.get(c.asset)?.show.collision||false):staticCollision;
  }
  function updateSliders(){for(const J of joints.values()){if(J.slider&&document.activeElement!==J.slider)J.slider.value=data.qpos[J.qadr];if(J.output)J.output.textContent=J.type==='slide'?`${((data.qpos[J.qadr]-J.rest)*1000).toFixed(0)} mm`:`${((data.qpos[J.qadr]-J.rest)*180/Math.PI).toFixed(0)}°`;}}
  function buildPanel(){
    const groups=new Map();for(const o of objects.values()){
      if(!groups.has(o.category)){const details=el('details','scene-category'),summary=el('summary',null,o.category);details.append(summary);list.append(details);groups.set(o.category,details);}
      const group=groups.get(o.category),row=el('details','scene-object'),summary=el('summary'),name=button(o.label,()=>select(o),'scene-object-name');summary.append(name);row.append(summary);row.dataset.object=o.name;o.row=row;
      const toggles=el('div','scene-object-overlays');o.toggles={};
      toggles.append(button('Focus',()=>focus(o)));
      if(meta.fallback_welds?.some(f=>f.asset===o.name)){summary.append(el('span','scene-stored','Held'));row.append(el('p','scene-fallback','Held in place; support fit needs correction.'));}
      if(o.stored_in){o.storedBadge=el('span','scene-stored','Stored');o.storedBadge.title=`Stored in ${o.stored_in.replaceAll('_',' ')}`;summary.append(o.storedBadge);}
      for(const key of ['box','joint','collision']){if(key==='joint'&&!o.joints.length)continue;const b=button(key==='collision'?'Collision':key==='joint'?'Joint':'Box',()=>{o.show[key]=!o.show[key];syncOverlays();});b.setAttribute('aria-pressed','false');toggles.append(b);o.toggles[key]=b;}row.append(toggles);
      for(const n of o.joints){const J=joints.get(n);if(!J)continue;const label=el('label','scene-joint'),text=el('span',null,J.label),input=el('input'),output=el('output');input.type='range';input.min=J.range[0];input.max=J.range[1];input.step=J.type==='slide'?.0001:.005;input.value=J.rest;input.setAttribute('aria-label',o.label+' '+J.label);input.dataset.joint=n;label.append(text,input,output);row.append(label);J.slider=input;J.output=output;
        input.oninput=()=>{select(o);jointValue(J,+input.value);};input.onchange=()=>{if(!physics)hold=null;};
        if(J.type==='slide'&&J.range[1]<=.015){const b=button('Press '+J.label,()=>press(J),'scene-press');b.dataset.press=n;row.append(b);}
      }
      if(o.limitations?.includes('Rigid fallback'))row.append(el('p','scene-fallback','Rigid fallback · deformation is not simulated.'));
      for(const r of rules.filter(r=>r.type==='breakaway_latch'&&o.joints.includes(r.joint)))row.append(button('Relatch lid',()=>{say(runtime.relatch(r.joint)?'Lid latched.':'Close the lid and release its button first.');}));
      group.append(row);
    }
    for(const [name,g] of groups)g.firstChild.textContent=`${name} · ${g.children.length-1}`;
    search.oninput=()=>{const term=search.value.trim().toLowerCase();for(const o of objects.values()){o.row.hidden=!!term&&!(o.label+' '+o.category+' '+o.joints.join(' ')).toLowerCase().includes(term);if(term&&!o.row.hidden)o.row.closest('.scene-category').open=true;}for(const g of groups.values())g.hidden=![...g.children].slice(1).some(x=>!x.hidden);};
    totals.textContent=`${objects.size} objects · ${joints.size} joints`;updateSliders();
  }
  function makeJoint(J){
    const body=bodies.get(J.body);if(!body)return;
    let p=body.bounds?new THREE.Vector3(...body.bounds[1]):new THREE.Vector3(.06,0,.02);
    if(p.length()<.035)p.set(.055,0,.025);p.add(new THREE.Vector3(...J.pos));
    const handle=new THREE.Mesh(new THREE.SphereGeometry(.015,10,8),new THREE.MeshBasicMaterial({color:0xe8590c,depthTest:false}));handle.position.copy(p);handle.renderOrder=20;handle.userData.joint=J;body.root.add(handle);J.handle=handle;
    const axis=new THREE.Vector3(...J.axis).multiplyScalar(.13),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([axis.clone().negate(),axis]),new THREE.LineBasicMaterial({color:0xe8590c,depthTest:false}));line.position.set(...J.pos);body.root.add(line);J.axisLine=line;handle.visible=line.visible=false;
  }
  function makeCollisions(object){
    for(let g=0;g<model.ngeom;g++){if(collisionBuilt.has(g)||(object?!object.ids.has(model.geom_bodyid[g]):model.geom_bodyid[g]!==0))continue;collisionBuilt.add(g);const s=Array.from(model.geom_size.subarray(3*g,3*g+3)),type=model.geom_type[g];let geo;
      if(type===0)geo=new THREE.PlaneGeometry(2*s[0],2*s[1]);else if(type===6)geo=new THREE.BoxGeometry(...s.map(x=>2*x));else if(type===2)geo=new THREE.SphereGeometry(s[0],10,8);else if(type===5)geo=new THREE.CylinderGeometry(s[0],s[0],2*s[1],12).rotateX(Math.PI/2);
      else if(type===3)geo=new THREE.CapsuleGeometry(s[0],2*s[1],4,8).rotateX(Math.PI/2);
      else if(type===7){const n=model.geom_dataid[g],va=model.mesh_vertadr[n],vn=model.mesh_vertnum[n],fa=model.mesh_faceadr[n],fn=model.mesh_facenum[n];geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(Array.from(model.mesh_vert.subarray(3*va,3*(va+vn))),3));geo.setIndex(Array.from(model.mesh_face.subarray(3*fa,3*(fa+fn))));}
      if(!geo)continue;const mesh=new THREE.LineSegments(new THREE.EdgesGeometry(geo,28),new THREE.LineBasicMaterial({color:0x0071e3,transparent:true,opacity:.6,depthTest:false}));geo.dispose();mesh.visible=false;overlays.add(mesh);const b=[...bodies.values()].find(x=>x.id===model.geom_bodyid[g]);collision.push({g,mesh,asset:b?.asset});
    }
  }
  function poseCollisions(){const m=new THREE.Matrix4();for(const c of collision){if(!c.mesh.visible)continue;const g=c.g,x=data.geom_xmat,p=data.geom_xpos;m.set(x[9*g],x[9*g+1],x[9*g+2],p[3*g],x[9*g+3],x[9*g+4],x[9*g+5],p[3*g+1],x[9*g+6],x[9*g+7],x[9*g+8],p[3*g+2],0,0,0,1);c.mesh.matrixAutoUpdate=false;c.mesh.matrix.copy(m);c.mesh.matrixWorldNeedsUpdate=true;}}
  const ray=new THREE.Raycaster(),canvas=renderer.domElement;
  const setRay=e=>{const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2(2*(e.clientX-r.left)/r.width-1,1-2*(e.clientY-r.top)/r.height),camera);};
  tc.addEventListener('dragging-changed',e=>{drag=e.value;controls.enabled=!e.value;if(e.value&&selected&&!activate(selected.name)){drag=false;controls.enabled=true;say('Open the enclosing door first.');}});
  tc.addEventListener('objectChange',()=>{if(drag&&selected){tryPose(selected,proxy.position.clone(),proxy.quaternion.clone());placeProxy();}});
  listen(canvas,'pointerdown',e=>{
    if(e.button!==0||!model)return;down={x:e.clientX,y:e.clientY};if(tc.axis)return;setRay(e);
    const hit=ray.intersectObjects([...joints.values()].filter(j=>j.handle?.visible).map(j=>j.handle),false)[0];
    if(hit){const J=hit.object.userData.joint,b=bodies.get(J.body),axis=new THREE.Vector3(...J.axis).applyQuaternion(b.root.quaternion).normalize(),pivot=b.root.localToWorld(new THREE.Vector3(...J.pos));
      const normal=J.type==='hinge'?axis:camera.getWorldDirection(new THREE.Vector3()),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,hit.point),point=ray.ray.intersectPlane(plane,new THREE.Vector3());
      if(point){select(objects.get(J.asset));jdrag={J,axis,pivot,plane,start:point.clone(),q0:data.qpos[J.qadr]};setPhysics(true);controls.enabled=false;canvas.setPointerCapture(e.pointerId);e.stopImmediatePropagation();}return;
    }
    const soft=ray.intersectObjects(flexes.map(x=>x.mesh),false)[0];
    if(soft){const f=soft.object.userData.flex;let closest=-1,dist=Infinity;const prefix=f.asset+'__';for(let b=1;b<model.nbody;b++){const name=mj.mj_id2name(model,enumValue(mj.mjtObj.mjOBJ_BODY),b)||'';if(!name.startsWith(prefix)||model.body_dofnum[b]===0)continue;const p=new THREE.Vector3().fromArray(data.xpos,3*b),dd=p.distanceToSquared(soft.point);if(dd<dist){dist=dd;closest=b;}}
      if(closest>=0){setPhysics(true);const target=new THREE.Vector3().fromArray(data.xpos,3*closest);softDrag={body:closest,point:soft.point.clone(),target,start:soft.point.clone(),initial:target.clone(),plane:new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),soft.point)};controls.enabled=false;canvas.setPointerCapture(e.pointerId);e.stopImmediatePropagation();}}
  },{capture:true});
  listen(canvas,'pointermove',e=>{
    if(jdrag){setRay(e);const p=ray.ray.intersectPlane(jdrag.plane,new THREE.Vector3());if(!p)return;let delta;if(jdrag.J.type==='slide')delta=p.clone().sub(jdrag.start).dot(jdrag.axis);else{const a=jdrag.start.clone().sub(jdrag.pivot).normalize(),b=p.clone().sub(jdrag.pivot).normalize();delta=Math.atan2(new THREE.Vector3().crossVectors(a,b).dot(jdrag.axis),a.dot(b));}jointValue(jdrag.J,jdrag.q0+delta);}
    if(softDrag){setRay(e);const p=ray.ray.intersectPlane(softDrag.plane,new THREE.Vector3());if(p)softDrag.target.copy(softDrag.initial).add(p.sub(softDrag.start));}
  });
  const release=e=>{if(jdrag||softDrag){jdrag=null;softDrag=null;hold=null;controls.enabled=true;forceArrow.visible=false;return;}if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5||tc.dragging||!model)return;setRay(e);const hits=ray.intersectObjects(pickables,true).filter(h=>shown(h.object));if(hits.length){let n=hits[0].object;while(n&&!n.userData.asset)n=n.parent;select(objects.get(n?.userData.asset),n?.userData.body);}else select(null);down=null;};
  listen(canvas,'pointerup',release);listen(canvas,'pointercancel',()=>{jdrag=softDrag=hold=null;drag=false;controls.enabled=true;});
  listen(host,'keydown',e=>{if(e.key==='Escape')select(null);});

  function frame(now){
    if(!alive)return;raf=requestAnimationFrame(frame);if(!visible){last=now;return;}const began=performance.now();controls.update();
    if(model&&physics){activeWallMs+=now-last;
      for(let n=0;n<4;n++){const t=performance.now(),previous=data.time;applyHold();applyRules();mj.mj_step(model,data);const elapsed=performance.now()-t;stepTotal+=elapsed;stepSamples.push(elapsed);if(stepSamples.length>2048)stepSamples.shift();steps++;
        if(data.time<previous||[...data.qpos].some(x=>!Number.isFinite(x))){reset();say('The solver reset an unstable state. Physics is paused.');break;}}
      // Exactly four 2 ms integration steps per visible physics frame. The
      // actual simulation / wall-time ratio is measured in metrics below.
      pull();
    }
    if(now-last<1000){frameSamples.push(now-last);if(frameSamples.length>240)frameSamples.shift();}frames++;last=now;if(model){poseCollisions();if(now-lastPanel>150){updateSliders();timeLabel.textContent=`t ${data.time.toFixed(2)} s${steps?' · '+(stepTotal/steps).toFixed(2)+' ms/step':''}`;lastPanel=now;}}
    updateCoverage();renderer.render(scene,camera);frameMs=performance.now()-began;
  }
  async function init(){
    const response=await fetch(dataUrl);if(!response.ok)throw new Error(`Scene data: HTTP ${response.status}`);meta=await response.json();
    for(const o of meta.objects)objects.set(o.name,{...o,ids:new Set(),show:{box:false,joint:false,collision:false}});
    for(const b of meta.bodies){const root=new THREE.Group();root.name=b.name;root.position.set(...b.pos_world);root.quaternion.copy(quat(b.quat_world));root.userData.asset=b.asset;root.userData.body=b.name;scene.add(root);bodies.set(b.name,{...b,root});objects.get(b.asset)?.ids.add(b.id);}
    for(const J of meta.joints)joints.set(J.name,{...J});
    meta.views.forEach((v,i)=>{const b=button(String.fromCharCode(65+i),()=>view(i));b.title=v.name;b.dataset.camera=i;cameraGroup.append(b);});view(0);makeStudio();
    if(meta.trajectory){pathLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(meta.trajectory.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:0x0071e3,depthTest:false}));pathLine.visible=false;scene.add(pathLine);}
    status.textContent='Loading geometry and physics…';
    const physicsPromise=(async()=>{const [M,response]=await Promise.all([loadMuJoCo(),fetch(url(meta.physics))]);if(!response.ok)throw new Error('Physics download failed');mj=M;const xml=await response.text();model=(mj.MjModel.from_xml_string||mj.from_xml_string).call(mj.MjModel,xml);data=new mj.MjData(model);mj.mj_resetDataKeyframe(model,data,id('mjOBJ_KEY','rest'));mj.mj_forward(model,data);})();
    const visualsPromise=(async()=>{const gl=await new GLTFLoader().loadAsync(url(meta.polished_pack));for(const b of bodies.values()){const group=gl.scene.getObjectByName(b.name);if(!group)continue;group.removeFromParent();group.position.set(0,0,0);group.quaternion.identity();group.traverse(x=>{if(x.isMesh){x.castShadow=x.receiveShadow=true;if((meta.soft_fallbacks||[]).some(f=>f.asset===b.asset)){const soften=mat=>{mat=mat.clone();mat.metalness=0;mat.roughness=b.asset==='bread_package'?.58:1;mat.flatShading=false;mat.needsUpdate=true;return mat;};x.material=Array.isArray(x.material)?x.material.map(soften):soften(x.material);}}});b.root.add(group);b.polished=group;group.userData.asset=b.asset;group.userData.body=b.name;pickables.push(group);loaded.push(group);}
      for(const b of bodies.values())if(b.bounds){const box=new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(...b.bounds[0]),new THREE.Vector3(...b.bounds[1])),0x0071e3);box.material.depthTest=false;box.visible=false;b.root.add(box);b.box=box;}})();
    const splatsPromise=(async()=>{bg=new SplatMesh({url:url(meta.background)});scene.add(bg);const promises=[bg.initialized];for(const b of bodies.values())if(b.has_gaussians){b.splat=new SplatMesh({url:url(b.name+'.spz')});b.root.add(b.splat);promises.push(b.splat.initialized);}await Promise.all(promises);})();
    await Promise.all([physicsPromise,visualsPromise,splatsPromise]);
    runtime=sceneRuntime(mj,model,data,meta,r=>{const badge=objects.get(r.asset)?.storedBadge;if(badge){badge.textContent=r.opened?'Active':'Stored';badge.dataset.active=String(r.opened);}});rules.push(...runtime.rules);stored.push(...runtime.stored);
    for(const f of meta.flexes||[]){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(3*f.vertex_count),3));geometry.setIndex(f.faces.flat());const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:new THREE.Color(...f.color.slice(0,3)),roughness:.9,side:THREE.DoubleSide}));const F={...f,geometry,mesh};mesh.userData.flex=F;scene.add(mesh);flexes.push(F);pickables.push(mesh);}
    for(const J of joints.values())makeJoint(J);applyRules();mj.mj_forward(model,data);pull();buildPanel();setLook('scan');syncOverlays();
    countLabel.textContent=(Object.values(meta.counts).reduce((a,b)=>a+b,0)/1000).toFixed(0)+'k Gaussians';status.hidden=true;hint();loadMs=performance.now()-started;host.dataset.ready='true';
    // Scan fills are secondary downloads; interaction is ready before they finish.
    const scans=[...bodies.values()].filter(b=>b.scan_glb);let i=0;
    await Promise.all(Array.from({length:Math.min(4,scans.length)},async()=>{while(i<scans.length&&alive){const b=scans[i++],gl=await new GLTFLoader().loadAsync(url(b.scan_glb));if(!alive)return;b.scan=gl.scene;b.scan.userData.asset=b.asset;b.scan.userData.body=b.name;b.root.add(b.scan);pickables.push(b.scan);setLook(look);}}));
    return api;
  }
  const api={ready:null,view,setLook,select,focus,setPhysics,reset,tryPose,tryJoint:jointValue,press,
    setJoint(name,q){if(!joints.has(name))throw new Error('Unknown joint '+name);return jointValue(name,q);},
    getJoint(name){const J=joints.get(name);if(!J)throw new Error('Unknown joint '+name);return data.qpos[J.qadr];},
    bodyPose(name){const b=id('mjOBJ_BODY',name);if(b<0)throw new Error('Unknown body '+name);return {position:Array.from(data.xpos.subarray(3*b,3*b+3)),quaternion:Array.from(data.xquat.subarray(4*b,4*b+4))};},
    stepMs(){return api.metrics.stepMeanMs;},fps(){return api.metrics.fps;},get meta(){return meta;},get model(){return model;},get data(){return data;},get mj(){return mj;},get look(){return look;},get physics(){return physics;},get selected(){return selected;},get metrics(){const sorted=[...stepSamples].sort((a,b)=>a-b);return {loadMs,stepMeanMs:steps?stepTotal/steps:0,stepP50Ms:sorted[Math.floor(sorted.length*.5)]||0,stepP95Ms:sorted[Math.floor(sorted.length*.95)]||0,stepMaxMs:sorted.at(-1)||0,steps,frameMs,frames,fps:frameSamples.length?1000*frameSamples.length/frameSamples.reduce((a,b)=>a+b,0):0,simulationHz:activeWallMs?1000*steps/activeWallMs:0,realtimeRatio:activeWallMs?steps*(meta?.timing.timestep_s||0)*1000/activeWallMs:0,maxSubstepsPerFrame:4};},objects,joints,bodies,flexes,stored,scene,camera,renderer,transform:tc,
    destroy(){alive=false;cancelAnimationFrame(raf);ac.abort();ro.disconnect();io.disconnect();controls.dispose();tc.dispose();scene.traverse(o=>{o.geometry?.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms)if(m){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose?.();}if(o instanceof SplatMesh)o.dispose?.();});data?.delete();model?.delete();env.dispose();pmrem.dispose();renderer.dispose();host.replaceChildren();}};
  api.ready=init().catch(error=>{host.dataset.error=String(error);status.hidden=false;status.textContent='Could not load this scene. '+error.message;say('Reload to retry.');throw error;});
  raf=requestAnimationFrame(frame);return api;
}

import * as THREE from 'three';
import {OrbitControls} from '../../../js/vendor/OrbitControls.js';
import {TransformControls} from '../../../js/vendor/controls/TransformControls.js';
import {GLTFLoader} from '../../../js/vendor/loaders/GLTFLoader.js';
import {RoomEnvironment} from '../../../js/vendor/environments/RoomEnvironment.js';
import {assetURL} from './library.js';
import {boundedForce, forceText, lowPass, staticForce, METRES_PER_NEWTON} from './force.js';

let enginePromise;
const engine=()=>enginePromise ||= import('../../../js/vendor/mujoco/mujoco.js').then(({default:load})=>load()).catch(e=>{enginePromise=null;throw e;});
const enumv=v=>v?.value??v;
const V=(a,i=0)=>new THREE.Vector3(a[i],a[i+1],a[i+2]);
const Q=(a,i=0)=>new THREE.Quaternion(a[i+1],a[i+2],a[i+3],a[i]);
const clamp=THREE.MathUtils.clamp;
const number=(n,p=2)=>Number.isFinite(n)?n.toFixed(p):'—';
const UP=new THREE.Vector3(0,0,1),UNIT=new THREE.Vector3(1,1,1);
const Y_TO_Z=new THREE.Matrix4().makeRotationX(Math.PI/2);

export class AssetViewer {
  constructor(host,meta,ui){
    this.dirty=true;this.host=host;this.meta=meta;this.ui=ui;this.abort=new AbortController();this.disposed=false;this.physics=false;this.demo=null;this.joints=[];this.visuals=[];this.bodyGroups=new Map();this.collision=[];this.flexes=[];this.massMarkers=[];this.overlays={};this.last=0;this.accumulator=0;this.press=null;this.drag=null;this.selection=null;this.targets=new Map();
    this.$=s=>ui.querySelector(s);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.setClearColor(0xf5f5f7);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.18;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.append(this.renderer.domElement);
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(37,1,.001,100);this.camera.up.copy(UP);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.09;
    const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environment=pmrem.fromScene(room,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.65;room.dispose();pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xffffff,0xa4a9b4,1.2));
    this.sun=new THREE.DirectionalLight(0xfffaf3,3);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.scene.add(this.sun,this.sun.target);
    const fill=new THREE.DirectionalLight(0xe2ecff,1.2);fill.position.set(-3,1,3);this.scene.add(fill);
    this.content=new THREE.Group();this.scene.add(this.content);
    this.hulls=new THREE.Group();this.hulls.visible=false;this.scene.add(this.hulls);
    this.axes=new THREE.Group();this.axes.visible=false;this.scene.add(this.axes);
    this.coms=new THREE.Group();this.coms.visible=false;this.scene.add(this.coms);
    this.softGroup=new THREE.Group();this.scene.add(this.softGroup);
    this.proxy=new THREE.Object3D();this.scene.add(this.proxy);
    this.tc=new TransformControls(this.camera,this.renderer.domElement);this.tc.setSize(.7);this.tc.setSpace('world');this.scene.add(this.tc.getHelper());
    this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();
    this.forceArrow=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(),.1,0xc7843f);this.forceArrow.visible=false;this.scene.add(this.forceArrow);
    this.hand=this.makeHand();this.hand.visible=false;this.scene.add(this.hand);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
    this.bindUI();this.frame=this.frame.bind(this);this.raf=requestAnimationFrame(this.frame);
  }
  listen(el,event,fn){el?.addEventListener(event,fn,{signal:this.abort.signal});}
  id(kind,name){return this.mj.mj_name2id(this.model,enumv(this.mj.mjtObj['mjOBJ_'+kind]),name);}
  name(kind,id){return this.mj.mj_id2name(this.model,enumv(this.mj.mjtObj['mjOBJ_'+kind]),id)||'';}
  say(s){this.$('#interaction-status').textContent=s;}
  resize(){if(this.disposed)return;this.dirty=true;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  async load(){
    const [mj,gltf,xml]=await Promise.all([engine(),new GLTFLoader().loadAsync(assetURL(this.meta.id,'model.glb')),fetch(assetURL(this.meta.id,'physics.xml'),{signal:this.abort.signal}).then(r=>{if(!r.ok)throw new Error('Physics file unavailable.');return r.text();})]);
    if(this.disposed){this.disposeObject(gltf.scene);return;}
    this.mj=mj;this.model=(mj.MjModel.from_xml_string||mj.from_xml_string).call(mj.MjModel,xml);this.data=new mj.MjData(this.model);
    this.resetData();const m=this.model,d=this.data;
    gltf.scene.updateMatrixWorld(true);
    const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
    for(const o of meshes){
      let node=o,part=null;while(node&&!part){part=node.userData.library_part;node=node.parent;}
      const b=this.id('BODY',this.meta.bindings[part]||'');const body=b>=0?b:0;
      let group=this.bodyGroups.get(body);
      if(!group){group=new THREE.Group();group.userData.body=body;group.matrixAutoUpdate=false;this.content.add(group);this.bodyGroups.set(body,group);}
      const mat=Y_TO_Z.clone().multiply(o.matrixWorld);const local=this.bodyMatrix(body).invert().multiply(mat);
      o.removeFromParent();group.add(o);o.matrixAutoUpdate=false;o.matrix.copy(local);o.userData.body=body;o.castShadow=o.receiveShadow=true;
      const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats){if(mat.map)mat.map.colorSpace=THREE.SRGBColorSpace;mat.envMapIntensity=1;}
      this.visuals.push(o);
    }
    this.syncBodies();this.content.updateMatrixWorld(true);
    this.bounds=new THREE.Box3().setFromObject(this.content);this.center=this.bounds.getCenter(new THREE.Vector3());this.span=Math.max(this.bounds.getSize(new THREE.Vector3()).length(),.03);
    this.ground=new THREE.Mesh(new THREE.PlaneGeometry(this.span*200,this.span*200),new THREE.MeshStandardMaterial({color:0xf5f5f7,roughness:1,metalness:0}));this.ground.position.set(this.center.x,this.center.y,this.bounds.min.z-this.span*.002);this.ground.receiveShadow=true;this.scene.add(this.ground);
    this.sun.position.copy(this.center).add(new THREE.Vector3(1,-1.8,3).multiplyScalar(this.span));this.sun.target.position.copy(this.center);Object.assign(this.sun.shadow.camera,{left:-this.span,right:this.span,top:this.span,bottom:-this.span,near:this.span*.01,far:this.span*8});this.sun.shadow.bias=-.0002;this.sun.shadow.normalBias=this.span*.001;
    this.camera.near=this.span*.003;this.camera.far=this.span*150;this.controls.minDistance=this.span*.15;this.controls.maxDistance=this.span*8;
    this.homeCamera();
    this.box=new THREE.Box3Helper(this.bounds,0x899cab);this.box.visible=false;this.scene.add(this.box);
    this.buildJoints();this.buildHulls();this.buildMass();this.buildFlex();
    this.hand.scale.setScalar(this.span*.045);
    this.$('#viewer-loading').hidden=true;
    this.ui.querySelectorAll('button:disabled,input[data-joint]').forEach(b=>b.disabled=false);
    if(!this.joints.length&&!this.meta.soft){this.$('#demo-toggle').disabled=true;this.$('#demo-toggle').textContent='No articulated joints';}
    this.say(this.meta.soft?'Enable physics to press the soft surface.':'Select a part to move it, or explore a joint with its slider.');
    this.sync();this.loaded=true;
  }
  homeCamera(){
    const aspect=this.camera.aspect;const distance=this.span*(aspect<1?2.05:1.55);
    this.camera.position.copy(this.center).add(new THREE.Vector3(1.15,-2.55,1.15).normalize().multiplyScalar(distance));this.controls.target.copy(this.center);this.controls.update();this.camera.updateProjectionMatrix();
  }
  bodyMatrix(b){return new THREE.Matrix4().compose(V(this.data.xpos,3*b),Q(this.data.xquat,4*b),UNIT);}
  resetData(){
    this.mj.mj_resetData(this.model,this.data);const rest=this.id('KEY','rest');if(rest>=0)this.mj.mj_resetDataKeyframe(this.model,this.data,rest);this.mj.mj_forward(this.model,this.data);
  }
  buildJoints(){
    const m=this.model,d=this.data;
    for(let i=0;i<this.meta.joints.length;i++){
      const info=this.meta.joints[i],id=this.id('JOINT',info.name);if(id<0)continue;
      const body=m.jnt_bodyid[id],q=m.jnt_qposadr[id],v=m.jnt_dofadr[id],site=info.handle_site?this.id('SITE',info.handle_site):-1;
      const axis=V(d.xaxis,3*id),anchor=V(d.xanchor,3*id);let point;
      if(site>=0)point=V(d.site_xpos,3*site);
      else{
        const group=this.bodyGroups.get(body);const box=group?new THREE.Box3().setFromObject(group):this.bounds;
        point=box.getCenter(new THREE.Vector3());
        // Choose the exposed side furthest from the hinge, rather than the body's COM.
        if(info.type!=='prismatic'){
          let best=-1;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z);const r=p.clone().sub(anchor);r.addScaledVector(axis,-r.dot(axis));if(r.lengthSq()>best){best=r.lengthSq();point=p;}}
          point.lerp(box.getCenter(new THREE.Vector3()),.25);
        }
      }
      const handleLocal=point.clone().applyMatrix4(this.bodyMatrix(body).invert());
      const radial=point.clone().sub(anchor);radial.addScaledVector(axis,-radial.dot(axis));const lever=Math.max(radial.length(),.001);
      const g=new THREE.Group();const len=this.span*.16;g.add(new THREE.ArrowHelper(UP,new THREE.Vector3(0,0,-len*.5),len,0xc18346,len*.18,len*.09));
      if(info.type==='prismatic')g.add(new THREE.ArrowHelper(UP.clone().negate(),new THREE.Vector3(0,0,len*.5),len,0xc18346,len*.18,len*.09));
      else{
        const pts=[];for(let s=0;s<=50;s++){const a=info.range[0]+(info.range[1]-info.range[0])*s/50;pts.push(new THREE.Vector3(Math.cos(a)*len*.65,Math.sin(a)*len*.65,0));}
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xc18346,transparent:true,opacity:.7,depthTest:false})));
      }
      this.axes.add(g);
      const J={...info,id,body,q,v,site,handleLocal,lever,axisHelper:g,slider:this.$(`#joint-${i}`),readout:this.$(`#joint-value-${i}`),forceReadout:this.$(`#joint-force-${i}`),force:0,index:i};this.joints.push(J);
      this.listen(J.slider,'input',()=>{this.stopDemo();const target=+J.slider.value;if(this.physics){this.targets.set(J,target);this.say('The joint is driven toward the slider target with a bounded force.');}else{const reached=this.kinematicJoint(J,target);d.qvel.fill(0);this.mechanismControllers();this.mj.mj_forward(m,d);this.sync();this.showJointForce(J,0,1);this.say(reached?'Kinematic mode. Sliders place joints directly.':`${J.label} stopped at a contact; collision stays on in kinematic mode.`);}});
    }
    this.latches=[];
    for(let i=0;i<m.neq;i++){
      const name=this.name('EQUALITY',i);if(!name.includes('latch'))continue;
      const rice=name.includes('rice'),micro=name.includes('microwave');
      if(rice||micro){const button=this.joints.find(j=>j.name.includes(rice?'rice_button':'release_slide'));const door=this.joints.find(j=>j.name.includes(rice?'rice_lid':'door_hinge'));if(button&&door)this.latches.push({id:i,button,door,release:micro?.0076:.0022,rearm:micro?.001:.0007,relatch:micro?.002:.012,speed:micro?.15:.08});}
    }
  }
  /** Bodies moved by joint J: its body and every descendant. */
  subtree(J){
    if(J.subtree)return J.subtree;const m=this.model,root=J.body,ids=new Set([root]);
    for(let b=root+1;b<m.nbody;b++){let p=m.body_parentid[b];while(p>root)p=m.body_parentid[p];if(p===root)ids.add(b);}
    return J.subtree=ids;
  }
  /** Deepest penetration between the subtree and the rest of the model at the current qpos (parent-child pairs
   * are filtered by MuJoCo, so a drawer is tested against a closed door but not against its own guide). */
  penetration(ids){
    const m=this.model,d=this.data;this.mj.mj_kinematics(m,d);this.mj.mj_collision(m,d);let depth=0;const cs=d.contact;
    for(let k=0;k<d.ncon;k++){const c=cs.get(k);if(c.geom1>=0&&c.geom2>=0){const a=ids.has(m.geom_bodyid[c.geom1]),b=ids.has(m.geom_bodyid[c.geom2]);if(a!==b)depth=Math.max(depth,-c.dist);}c.delete?.();}
    cs.delete?.();return depth;
  }
  /** Kinematic joint motion with collision: walk from the current value toward the target and stop at the first
   * new contact. Returns true when the target was reached. */
  kinematicJoint(J,target){
    const d=this.data,q=J.q,ids=this.subtree(J),start=d.qpos[q],limit=Math.max(.002,this.penetration(ids)+.0005);
    if(Math.abs(target-start)<1e-9)return true;
    const n=Math.min(120,Math.max(1,Math.ceil(Math.abs(target-start)/(J.type==='prismatic'?.004:.02))));let accepted=start;
    for(let i=1;i<=n;i++){d.qpos[q]=start+(target-start)*i/n;if(this.penetration(ids)>limit)break;accepted=d.qpos[q];}
    d.qpos[q]=accepted;return Math.abs(accepted-target)<1e-9;
  }
  geometry(g){
    const m=this.model,t=m.geom_type[g],s=m.geom_size.subarray(g*3,g*3+3);let geo;
    if(t===6)geo=new THREE.BoxGeometry(2*s[0],2*s[1],2*s[2]);
    else if(t===5)geo=new THREE.CylinderGeometry(s[0],s[0],2*s[1],20).rotateX(Math.PI/2);
    else if(t===2)geo=new THREE.SphereGeometry(s[0],16,10);
    else if(t===3)geo=new THREE.CapsuleGeometry(s[0],2*s[1],6,12).rotateX(Math.PI/2);
    else if(t===4)geo=new THREE.SphereGeometry(1,16,10).scale(s[0],s[1],s[2]);
    else if(t===7){const id=m.geom_dataid[g],va=m.mesh_vertadr[id],vn=m.mesh_vertnum[id],fa=m.mesh_faceadr[id],fn=m.mesh_facenum[id];geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(m.mesh_vert.slice(va*3,(va+vn)*3),3));geo.setIndex(Array.from(m.mesh_face.slice(fa*3,(fa+fn)*3)));geo.computeVertexNormals();}
    return geo;
  }
  buildHulls(){
    for(let g=0;g<this.model.ngeom;g++){
      const geo=this.geometry(g);if(!geo)continue;
      const group=new THREE.Group();group.matrixAutoUpdate=false;group.userData.geom=g;
      group.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x5f8fa9,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide})),new THREE.LineSegments(new THREE.EdgesGeometry(geo,30),new THREE.LineBasicMaterial({color:0x7399b0,transparent:true,opacity:.55,depthTest:false})));
      this.hulls.add(group);this.collision.push(group);
    }
  }
  buildMass(){
    const m=this.model;
    for(let b=1;b<m.nbody;b++)if(m.body_mass[b]>0){const radius=clamp(Math.cbrt(m.body_mass[b]/Math.max(this.meta.mass,.01))*this.span*.025,this.span*.004,this.span*.025);const o=new THREE.Mesh(new THREE.SphereGeometry(radius,10,8),new THREE.MeshBasicMaterial({color:0x809773,transparent:true,opacity:.8,depthTest:false}));o.userData.body=b;this.coms.add(o);this.massMarkers.push(o);}
    this.wholeCom=new THREE.Group();const r=this.span*.028;for(let i=0;i<3;i++){const a=new THREE.Vector3(),b=new THREE.Vector3();a.setComponent(i,-r);b.setComponent(i,r);this.wholeCom.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color:0x457054,depthTest:false})));}this.coms.add(this.wholeCom);
  }
  buildFlex(){
    const m=this.model;if(!m.nflex)return;
    for(let f=0;f<m.nflex;f++){
      const va=m.flex_vertadr[f],vn=m.flex_vertnum[f],dim=m.flex_dim[f];let indices=[];
      if(dim===3){const adr=m.flex_shelldataadr[f];indices=Array.from(m.flex_shell.slice(adr,adr+m.flex_shellnum[f]*3));}
      else if(dim===2){const adr=m.flex_elemdataadr[f];indices=Array.from(m.flex_elem.slice(adr,adr+m.flex_elemnum[f]*3));}
      if(!indices.length)continue;
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(vn*3),3));geo.setIndex(indices);
      const color=this.meta.id.includes('sponge')?0xc6ad50:this.meta.id.includes('scourer')?0x8d9994:this.meta.id.includes('bread')?0xd9ceb9:0xd4c7ba;
      const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:.85,side:THREE.DoubleSide}));mesh.castShadow=mesh.receiveShadow=true;mesh.userData.flex=f;this.softGroup.add(mesh);this.flexes.push({f,va,vn,mesh});
    }
    this.softGroup.visible=false;
  }
  makeHand(){
    const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:0xfff8ef,roughness:.58,metalness:0});
    const palm=new THREE.Mesh(new THREE.SphereGeometry(.46,16,10).scale(.85,1,.48),mat);palm.position.y=-.64;g.add(palm);
    for(const [x,y,len,r] of [[0,0,.72,.16],[-.3,-.5,.25,.14],[.29,-.48,.29,.14],[.45,-.64,.2,.13]]){const finger=new THREE.Mesh(new THREE.CapsuleGeometry(r,len,5,10),mat);finger.position.set(x,y,0);g.add(finger);}
    const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.29,.32,.3,14),new THREE.MeshStandardMaterial({color:0xd9b586,roughness:.7}));cuff.position.y=-1.08;g.add(cuff);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;
  }
  bindUI(){
    this.listen(this.$('#physics-toggle'),'click',()=>this.setPhysics(!this.physics));
    this.listen(this.$('#asset-reset'),'click',()=>this.reset());
    this.listen(this.$('#demo-toggle'),'click',()=>this.demo?this.stopDemo():this.startDemo());
    for(const el of this.ui.querySelectorAll('[data-overlay]'))this.listen(el,'change',()=>{this.overlays[el.dataset.overlay]=el.checked;this.sync();});
    for(const el of this.ui.querySelectorAll('[data-drag]'))this.listen(el,'click',()=>{this.tc.setMode(el.dataset.drag);this.ui.querySelectorAll('[data-drag]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));});
    this.listen(this.$('#press-force'),'input',()=>this.$('#press-value').textContent=number(+this.$('#press-force').value)+' N');
    this.listen(this.renderer.domElement,'pointerdown',e=>{
      this.down={x:e.clientX,y:e.clientY};
      if(this.meta.soft&&this.physics&&!this.tc.axis){const hit=this.pick(e,this.softGroup.children);if(hit){this.beginPress(hit);this.controls.enabled=false;this.renderer.domElement.setPointerCapture(e.pointerId);}}
    });
    this.listen(this.renderer.domElement,'pointerup',e=>{
      if(this.press){this.press=null;this.controls.enabled=true;return;}
      if(!this.down||Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>5||this.tc.axis||!this.loaded||this.meta.soft)return;
      const hit=this.pick(e,this.visuals);this.select(hit);
    });
    this.listen(this.renderer.domElement,'pointercancel',()=>{this.press=null;this.drag=null;this.controls.enabled=true;});
    this.listen(document,'keydown',e=>{if(e.key==='Escape'){this.tc.detach();this.selection=null;this.press=null;this.stopDemo();this.controls.enabled=true;}});
    this.tc.addEventListener('change',()=>{this.dirty=true;});
    this.tc.addEventListener('dragging-changed',e=>{
      this.controls.enabled=!e.value;if(e.value&&this.selection){this.stopDemo();this.drag={start:this.proxy.position.clone(),quat:this.proxy.quaternion.clone(),qpos:Float64Array.from(this.data.qpos),bodyQuat:Q(this.data.xquat,this.selection.body*4),body:this.selection.body,point:this.selection.local.clone()};}
      if(!e.value)this.drag=null;
    });
    this.tc.addEventListener('objectChange',()=>{if(!this.drag||this.physics)return;this.kinematicDrag();});
  }
  pick(e,objects){const r=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);return this.ray.intersectObjects(objects,true).find(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;});}
  select(hit){
    this.tc.detach();this.selection=null;if(!hit){this.say('Select a part to move it, or use a joint slider.');return;}
    const body=hit.object.userData.body;const m=this.model,d=this.data;let b=body;while(b>0&&!m.body_jntnum[b])b=m.body_parentid[b];
    if(b===0){this.say('This part is anchored in the mechanism model. Try a moving part or a joint slider.');return;}
    const jid=m.body_jntadr[b];this.selection={body,root:b,joint:jid,local:hit.point.clone().applyMatrix4(this.bodyMatrix(body).invert())};this.proxy.position.copy(hit.point);this.proxy.quaternion.identity();this.tc.attach(this.proxy);
    this.say(`${this.name('BODY',body).replaceAll('_',' ')} selected. Drag the handles${this.physics?' to apply force.':'.'}`);
  }
  kinematicDrag(){
    const s=this.selection,m=this.model,d=this.data,drag=this.drag;if(!s)return;const jid=s.joint,q=m.jnt_qposadr[jid],type=m.jnt_type[jid];const delta=this.proxy.position.clone().sub(drag.start);
    d.qpos.set(drag.qpos);
    if(type===0){d.qpos[q]+=delta.x;d.qpos[q+1]+=delta.y;d.qpos[q+2]+=delta.z;if(this.tc.mode==='rotate'){const turn=this.proxy.quaternion.clone().multiply(drag.quat.clone().invert());const rot=turn.multiply(Q(drag.qpos,q+3));d.qpos.set([rot.w,rot.x,rot.y,rot.z],q+3);}}
    else if(type===2){const axis=V(d.xaxis,3*jid);const J=this.joints.find(j=>j.id===jid);const goal=drag.qpos[q]+delta.dot(axis);if(J)this.kinematicJoint(J,m.jnt_limited[jid]?clamp(goal,m.jnt_range[jid*2],m.jnt_range[jid*2+1]):goal);else d.qpos[q]=goal;}
    else if(type===3){const axis=V(d.xaxis,3*jid),anchor=V(d.xanchor,3*jid);let angle;
      if(this.tc.mode==='rotate'){const turn=this.proxy.quaternion.clone().multiply(drag.quat.clone().invert());angle=2*Math.atan2(new THREE.Vector3(turn.x,turn.y,turn.z).dot(axis),turn.w);}
      else{const a=drag.start.clone().sub(anchor),b=this.proxy.position.clone().sub(anchor);a.addScaledVector(axis,-a.dot(axis));b.addScaledVector(axis,-b.dot(axis));angle=Math.atan2(a.clone().cross(b).dot(axis),a.dot(b));}
      const J=this.joints.find(j=>j.id===jid),goal=drag.qpos[q]+angle;if(J)this.kinematicJoint(J,m.jnt_limited[jid]?clamp(goal,m.jnt_range[jid*2],m.jnt_range[jid*2+1]):goal);else d.qpos[q]=goal;
    }
    if(m.jnt_limited[jid])d.qpos[q]=clamp(d.qpos[q],m.jnt_range[jid*2],m.jnt_range[jid*2+1]);d.qvel.fill(0);this.mj.mj_forward(m,d);this.sync();
  }
  setPhysics(on){
    if(!this.model)return;this.dirty=true;this.stopDemo();this.press=null;this.controls.enabled=true;this.physics=on;this.targets.clear();this.accumulator=0;this.data.qvel.fill(0);this.data.qfrc_applied.fill(0);this.data.xfrc_applied.fill(0);this.$('#physics-toggle').setAttribute('aria-pressed',String(on));this.$('#physics-toggle').textContent=on?'Physics on':'Physics off';this.$('#viewer-state').classList.toggle('running',on);this.$('#viewer-state span').textContent=on?'Simulating':'Kinematic';
    if(this.meta.soft){this.content.visible=!on;this.softGroup.visible=on;this.$('#viewer-hint').textContent=on?'Press and hold the surface · Drag empty space to orbit':'Enable physics to press the soft surface';if(on&&this.flexes.length)this.fitSoft();else if(!on){this.center=this.bounds.getCenter(new THREE.Vector3());this.ground.position.z=this.bounds.min.z-this.span*.002;this.homeCamera();}}
    this.joints.forEach(j=>{j.displayForce=0;j.force=0;});this.forceFilter=null;this.sync();
    this.say(on?(this.meta.soft?'Press and hold the surface. Adjust the force with the slider.':'Gravity and contacts are active. Drag a part to apply force.'):'Kinematic mode. Sliders place joints directly.');
  }
  fitSoft(){this.syncFlex();const b=new THREE.Box3().setFromObject(this.softGroup);this.center=b.getCenter(new THREE.Vector3());this.ground.position.z=Math.min(b.min.z,0)-this.span*.002;this.homeCamera();}
  reset(){this.stopDemo();this.resetData();this.targets.clear();this.press=null;this.drag=null;this.tc.detach();this.selection=null;this.accumulator=0;this.joints.forEach(j=>{j.force=0;j.displayForce=0;});this.forceFilter=null;this.sync();this.say('Returned to the rest state.');}
  startDemo(){
    if(!this.model)return;if(this.meta.soft&&!this.physics)this.setPhysics(true);this.tc.detach();this.selection=null;this.targets.clear();
    const order=[...this.joints].sort((a,b)=>Number(/button|release/.test(b.name))-Number(/button|release/.test(a.name)));
    this.demoBlocked=null;this.demo={start:performance.now(),order,baseline:Float64Array.from(this.data.qpos),previous:new Map()};this.$('#demo-toggle').setAttribute('aria-pressed','true');this.$('#demo-toggle').innerHTML='<span aria-hidden="true">Ⅱ</span> Stop demo';this.say(this.meta.soft?'Demonstrating a gentle press and release.':this.physics?'Force-driven demonstration; contacts and joint stops remain active.':'Kinematic demonstration; force comes from mechanism evidence or the static spring/friction model.');
  }
  stopDemo(){const wasDemo=!!this.demo;this.demo=null;if(wasDemo&&this.meta.soft)this.press=null;if(this.data&&!this.physics){this.data.qvel.fill(0);this.joints.forEach(j=>{j.force=0;j.displayForce=0;});this.forceFilter=null;}this.targets.clear();const b=this.$('#demo-toggle');if(b){b.setAttribute('aria-pressed','false');if(this.joints.length||this.meta.soft)b.innerHTML='<span aria-hidden="true">▶</span> Play demo';}this.hideForce();}
  mechanismControllers(){
    const d=this.data,m=this.model;
    for(const l of this.latches){if(d.qpos[l.button.q]>=l.release)d.eq_active[l.id]=0;else if(d.qpos[l.button.q]<l.rearm&&d.qpos[l.door.q]<l.relatch&&Math.abs(d.qvel[l.door.v])<l.speed)d.eq_active[l.id]=1;
      const act=this.id('ACTUATOR','small_mechanisms_rice_latch_adhesion');if(act>=0)d.ctrl[act]=d.eq_active[l.id];}
    const bayonet=this.joints.find(j=>j.name.includes('coffee_bayonet'));if(bayonet){const eq=this.id('EQUALITY','small_mechanisms_coffee_bayonet_latch');if(eq>=0&&d.qpos[bayonet.q]<.025)d.eq_active[eq]=0;}
    const kettle=this.joints.find(j=>j.name.includes('kettle_dial'));if(kettle){const a=this.id('ACTUATOR','small_mechanisms_kettle_detent');if(a>=0)d.ctrl[a]=-.008*Math.sin(24*d.qpos[kettle.q]);}
  }
  demoTarget(now){
    if(!this.demo)return null;const elapsed=(now-this.demo.start)/1000;
    if(this.meta.soft){if(elapsed>6){this.stopDemo();this.press=null;return null;}if(!this.press){this.syncFlex();const f=this.flexes[0];if(f){const b=new THREE.Box3().setFromObject(this.softGroup),p=b.getCenter(new THREE.Vector3());p.z=b.max.z;this.beginPress({point:p});}}return null;}
    const period=3.6,idx=Math.floor(elapsed/period);if(idx>=this.demo.order.length){this.stopDemo();return null;}
    const j=this.demo.order[idx],t=(elapsed%period)/period;const ease=.5-.5*Math.cos(2*Math.PI*t);const base=clamp(this.demo.baseline[j.q],j.range[0],j.range[1]);const limit=Math.abs(j.range[1]-base)>=Math.abs(j.range[0]-base)?j.range[1]:j.range[0];const q=base+(limit-base)*ease;const velocity=(limit-base)*Math.PI/period*Math.sin(2*Math.PI*t);const accel=(limit-base)*2*Math.PI*Math.PI/(period*period)*Math.cos(2*Math.PI*t);
    this.activeDemoJoint=j;return {j,q,velocity,accel};
  }
  step(now,dt){
    const m=this.model,d=this.data,target=this.demoTarget(now);
    if(!this.physics){
      if(target){const {j,q,velocity}=target;d.qvel.fill(0);for(const l of this.latches)if(l.door===j)d.qpos[l.button.q]=l.button.range[1];const reached=this.kinematicJoint(j,q);this.mechanismControllers();this.mj.mj_forward(m,d);this.showJointForce(j,0,velocity);if(!reached&&this.demoBlocked!==j){this.demoBlocked=j;this.say(`${j.label} is obstructed in this state (collision stays on); the demo holds it at the contact.`);}}
      return;
    }
    const timestep=m.opt.timestep;this.accumulator=Math.min(this.accumulator+dt,.08);const steps=Math.min(80,Math.floor(this.accumulator/timestep));this.accumulator-=steps*timestep;
    const started=performance.now();
    for(let s=0;s<steps;s++){
      d.qfrc_applied.fill(0);d.xfrc_applied.fill(0);
      this.mechanismControllers();
      if(target){this.targets.clear();this.targets.set(target.j,target.q);
        // A demonstrator presses the release while moving a latched door/lid.
        for(const l of this.latches)if(l.door===target.j)this.targets.set(l.button,l.button.range[1]);
      }
      for(const [j,q] of this.targets){const slide=j.type==='prismatic';const inertia=m.dof_M0?.[j.v]||Math.max(m.body_mass[j.body]*(slide?1:j.lever*j.lever),.0001);const kp=Math.max(slide?1000:2,inertia*250);const kd=2*Math.sqrt(kp*inertia);const vtarget=target?.j===j?target.velocity:0;const effort=kp*(q-d.qpos[j.q])+kd*(vtarget-d.qvel[j.v])+d.qfrc_bias[j.v]-d.qfrc_passive[j.v]+Math.sign(q-d.qpos[j.q])*j.friction;const maxEffort=slide?80:j.lever*120;j.force=clamp(effort,-maxEffort,maxEffort);d.qfrc_applied[j.v]+=j.force;}
      if(this.drag&&this.selection){const b=this.selection.body,point=this.selection.local.clone().applyMatrix4(this.bodyMatrix(b));const mass=Math.max(m.body_mass[b],.05);
        if(this.tc.mode==='rotate'){
          const desired=this.proxy.quaternion.clone().multiply(this.drag.quat.clone().invert()).multiply(this.drag.bodyQuat),error=desired.multiply(Q(d.xquat,4*b).invert());if(error.w<0)error.set(-error.x,-error.y,-error.z,-error.w);
          const torque=new THREE.Vector3(error.x,error.y,error.z).multiplyScalar(mass*this.span*this.span*50).clampLength(0,50);for(let k=0;k<3;k++)d.xfrc_applied[b*6+3+k]+=torque.getComponent(k);
          const radius=point.clone().sub(V(d.xipos,b*3));const dir=torque.clone().cross(radius).normalize();this.showForce(point,dir,torque.length()/Math.max(radius.length(),this.span*.02),'Torque equivalent');
        }else{const error=this.proxy.position.clone().sub(point);const f=error.multiplyScalar(mass*120).clampLength(0,150);this.applyBodyForce(b,point,f);this.showForce(point,f.clone().normalize(),f.length(),'Applied drag');}
      }
      if(this.press){let force=+(this.$('#press-force')?.value||.2);if(this.demo)force*=Math.sin(Math.PI*Math.min(1,(now-this.demo.start)/6000));this.applyPress(force);}
      this.mj.mj_step(m,d);
      // Let expensive deformable scenes run slower than real time instead of blocking input.
      if(performance.now()-started>14){this.accumulator=0;break;}
    }
    this.mj.mj_forward(m,d);
    this.updateJointForces(dt);
    if(target)this.showJointForce(target.j,target.j.force,target.velocity);
    if(!this.demo&&!this.press&&!this.drag)this.hideForce();
    if(!Number.isFinite(d.qpos[0])||this.hasWarning()){this.physics=false;this.$('#physics-toggle').textContent='Physics off';this.$('#physics-toggle').setAttribute('aria-pressed','false');this.reset();this.say('The model reached an unstable state and was reset. Try a gentler motion.');}
  }
  hasWarning(){return Array.from(this.data.qvel).some(v=>!Number.isFinite(v)||Math.abs(v)>1e5);}
  applyBodyForce(body,point,force){const d=this.data;const torque=point.clone().sub(V(d.xipos,body*3)).cross(force);for(let k=0;k<3;k++){d.xfrc_applied[body*6+k]+=force.getComponent(k);d.xfrc_applied[body*6+3+k]+=torque.getComponent(k);}}
  beginPress(hit){
    const d=this.data,m=this.model;let nearest=-1,best=Infinity,fid=0;
    for(const f of this.flexes)for(let v=f.va;v<f.va+f.vn;v++){const distance=V(d.flexvert_xpos,v*3).distanceToSquared(hit.point);if(distance<best){best=distance;nearest=v;fid=f.f;}}
    if(nearest<0)return;let direction=new THREE.Vector3(0,0,-1);if(hit.face&&hit.object){direction=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);if(direction.dot(this.ray.ray.direction)<0)direction.negate();}this.press={vertex:nearest,flex:fid,direction};this.stopDemoUnlessSoft();
  }
  stopDemoUnlessSoft(){if(!this.meta.soft)this.stopDemo();}
  applyPress(magnitude){
    const m=this.model,d=this.data,{vertex,flex}=this.press;const point=V(d.flexvert_xpos,vertex*3);const force=this.press.direction.clone().multiplyScalar(magnitude);const body=m.flex_vertbodyid[vertex];
    if(body>=0)this.applyBodyForce(body,point,force);
    else{
      // Trilinear flex vertices interpolate the eight corner nodes. Apply the same
      // interpolation weights to force, preserving the virtual work of a vertex press.
      const coord=V(m.flex_vert0,vertex*3),start=m.flex_nodeadr[flex],count=m.flex_nodenum[flex];
      if(count===8){for(let i=0;i<2;i++)for(let j=0;j<2;j++)for(let k=0;k<2;k++){const weight=(i?coord.x:1-coord.x)*(j?coord.y:1-coord.y)*(k?coord.z:1-coord.z);const b=m.flex_nodebodyid[start+i*4+j*2+k];this.applyBodyForce(b,V(d.xpos,b*3),force.clone().multiplyScalar(weight));}}
      else{let closest=0,dist=Infinity;for(let i=0;i<count;i++){const b=m.flex_nodebodyid[start+i],dd=V(d.xpos,b*3).distanceToSquared(point);if(dd<dist){dist=dd;closest=b;}}this.applyBodyForce(closest,point,force);}
    }
    this.showForce(point,force.clone().normalize(),magnitude,'Applied press');
  }
  jointForce(j){
    if(this.physics)return {value:j.displayForce||0,label:'Simulated',source:'Low-pass applied or joint constraint force at handle (150 N display cap)'};
    const latch=this.latches?.find(l=>l.door===j);
    return staticForce(j,this.data.qpos[j.q],!latch||!!this.data.eq_active[latch.id]);
  }
  updateJointForces(dt){
    for(const j of this.joints){
      const lever=j.type==='prismatic'?1:j.lever;
      // A driven joint reports the force actually applied. Otherwise show its
      // solver constraint reaction; passive spring forces are not applied forces.
      const effort=this.targets.has(j)?this.data.qfrc_applied[j.v]:(this.data.qfrc_applied[j.v]||this.data.qfrc_constraint[j.v]);
      j.displayForce=lowPass(j.displayForce,Math.abs(effort)/lever,dt);
    }
  }
  showJointForce(j,effort,velocity){
    const point=j.handleLocal.clone().applyMatrix4(this.bodyMatrix(j.body));const axis=V(this.data.xaxis,j.id*3).normalize(),origin=V(this.data.xanchor,j.id*3);const direction=j.type==='prismatic'?axis:axis.clone().cross(point.clone().sub(origin)).normalize();direction.multiplyScalar(this.physics?(Math.sign(effort)||Math.sign(velocity)||1):(Math.sign(velocity)||1));
    const force=this.jointForce(j);this.showForce(point,direction,force.value,force.label,true);
  }
  showForce(point,direction,magnitude,label,filtered=false){
    if(!Number.isFinite(magnitude)||!direction.lengthSq())return;
    magnitude=boundedForce(magnitude);
    if(this.physics&&!filtered){const now=performance.now()/1000;const previous=this.forceFilter?.label===label?this.forceFilter:null;magnitude=lowPass(previous?.value,magnitude,previous?now-previous.time:1/60);this.forceFilter={label,value:magnitude,time:now};}
    const length=magnitude*METRES_PER_NEWTON;this.forceArrow.visible=length>0;this.forceArrow.position.copy(point);this.forceArrow.setDirection(direction);this.forceArrow.setLength(length,Math.min(length*.25,this.span*.03),Math.min(length*.12,this.span*.015));
    this.hand.visible=true;this.hand.position.copy(point).addScaledVector(direction,-this.span*.04);this.hand.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
    const projected=point.clone().addScaledVector(direction,length).project(this.camera);const el=this.$('#force-label');el.hidden=projected.z>1||projected.z< -1;el.textContent=`${label} · ${forceText(magnitude)}`;el.style.left=`${clamp((projected.x+1)/2,0.1,.9)*100}%`;el.style.top=`${clamp((-projected.y+1)/2,.12,.9)*100}%`;
  }
  hideForce(){this.dirty=true;this.forceArrow.visible=false;this.hand.visible=false;const el=this.$('#force-label');if(el)el.hidden=true;}
  syncBodies(){for(const [b,g] of this.bodyGroups)g.matrix.copy(this.bodyMatrix(b));this.content.updateMatrixWorld(true);}
  syncFlex(){for(const f of this.flexes){const attr=f.mesh.geometry.attributes.position;attr.array.set(this.data.flexvert_xpos.subarray(f.va*3,(f.va+f.vn)*3));attr.needsUpdate=true;f.mesh.geometry.computeVertexNormals();f.mesh.geometry.computeBoundingSphere();}}
  sync(){
    if(!this.model)return;this.dirty=true;const m=this.model,d=this.data;this.syncBodies();if(this.meta.soft&&this.physics)this.syncFlex();
    this.hulls.visible=!!this.overlays.collision;this.axes.visible=!!this.overlays.axes;this.coms.visible=!!this.overlays.mass;
    if(this.hulls.visible){const a=d.geom_xmat;for(const g of this.collision){const i=g.userData.geom,p=i*3,r=i*9;g.matrix.set(a[r],a[r+1],a[r+2],d.geom_xpos[p],a[r+3],a[r+4],a[r+5],d.geom_xpos[p+1],a[r+6],a[r+7],a[r+8],d.geom_xpos[p+2],0,0,0,1);}}
    if(this.box){this.box.visible=!!this.overlays.bounds;if(this.box.visible)this.box.box.setFromObject(this.meta.soft&&this.physics?this.softGroup:this.content);}
    for(const j of this.joints){if(this.axes.visible){j.axisHelper.position.copy(V(d.xanchor,3*j.id));j.axisHelper.quaternion.setFromUnitVectors(UP,V(d.xaxis,3*j.id).normalize());}
      const val=d.qpos[j.q],slide=j.type==='prismatic';j.readout.textContent=slide?`${number(val*1000,1)} mm`:`${number(val*180/Math.PI,1)}°`;
      if(document.activeElement!==j.slider&&!this.targets.has(j))j.slider.value=val;
      const force=this.jointForce(j);j.forceReadout.textContent=`${forceText(force.value)} · ${force.label}`;j.forceReadout.title=force.source;
    }
    if(this.coms.visible){const center=new THREE.Vector3();let mass=0;for(const o of this.massMarkers){const b=o.userData.body;o.position.copy(V(d.xipos,3*b));center.addScaledVector(o.position,m.body_mass[b]);mass+=m.body_mass[b];}this.wholeCom.position.copy(center.divideScalar(mass||1));}
    if(this.wireframe!==!!this.overlays.wireframe){this.wireframe=!!this.overlays.wireframe;for(const mesh of [...this.visuals,...this.flexes.map(f=>f.mesh)])for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])mat.wireframe=this.wireframe;}
    if(this.selection&&!this.drag){this.proxy.position.copy(this.selection.local).applyMatrix4(this.bodyMatrix(this.selection.body));}
  }
  frame(now){
    if(this.disposed)return;this.raf=requestAnimationFrame(this.frame);const dt=Math.min((now-(this.last||now))/1000,.04);this.last=now;
    if(!document.hidden){const active=this.loaded&&(this.physics||this.demo||this.drag||this.press);if(active){try{this.step(now,dt);this.sync();}catch(error){this.loaded=false;this.stopDemo();this.say(`Simulation stopped: ${error.message}. Reload this object to retry.`);}}const orbitChanged=this.controls.update();if(active||orbitChanged||this.dirty){this.renderer.render(this.scene,this.camera);this.dirty=false;}}
  }
  disposeObject(root){const gs=new Set(),ms=new Set(),ts=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const mat of (Array.isArray(o.material)?o.material:[o.material]))if(mat){ms.add(mat);for(const value of Object.values(mat))if(value?.isTexture)ts.add(value);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());}
  dispose(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.raf);this.abort.abort();this.resizeObserver.disconnect();this.tc.detach();this.tc.dispose();this.controls.dispose();this.disposeObject(this.scene);this.environment.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.host.replaceChildren();this.data?.delete();this.model?.delete();}
}

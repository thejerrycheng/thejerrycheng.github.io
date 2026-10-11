import * as THREE from 'three';
import {OrbitControls} from '../../js/vendor/OrbitControls.js';
import {GLTFLoader} from '../../js/vendor/loaders/GLTFLoader.js';
import {SplatMesh,SparkRenderer} from '../../js/vendor/spark.module.js';
import {directManipulation} from './interactions.js';

// Gaussian room + per-link Gaussians in their MuJoCo body frames (metres, z up). Objects are kinematic here;
// contact dynamics run in MuJoCo (sim/scene.xml).
const BASE='assets/projects/rehearse/real2sim/';
const LABELS={laptop:'Laptop',cup:'Coffee cup',backpack:'Backpack',chair_0:'Swivel chair (left)',chair_1:'Swivel chair (right)'};
const JOINT_LABELS={laptop_hinge:'Laptop lid hinge',chair_0_swivel:'Left chair swivel',chair_1_swivel:'Right chair swivel'};
const host=document.querySelector('#gs-view'),status=document.querySelector('#gs-status');
const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0xf5f5f7);host.appendChild(renderer.domElement);
const scene=new THREE.Scene(),spark=new SparkRenderer({renderer});scene.add(spark);
const camera=new THREE.PerspectiveCamera(50,4/3,.02,80);camera.up.set(0,0,1);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.15;controls.maxDistance=12;
const q=w=>new THREE.Quaternion(w[1],w[2],w[3],w[0]);
let meta,bg,interaction,fills=[],roots=[],aspect=4/3,fillOn=false;

function resize(){const w=host.clientWidth,h=Math.round(Math.min(w/aspect,innerHeight*.78));host.style.height=h+'px';renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(host);addEventListener('resize',resize);

function view(i){ // OpenCV camera-to-world -> three.js camera
  const v=meta.views[i],M=v.c2w_cv,R=c=>new THREE.Vector3(M[0][c],M[1][c],M[2][c]),t=new THREE.Vector3(M[0][3],M[1][3],M[2][3]);
  const K=meta.intrinsics.K;camera.fov=2*Math.atan(meta.intrinsics.height/2/K[1][1])*180/Math.PI;camera.position.copy(t);camera.up.copy(R(1).negate());
  const fwd=R(2),ped=new THREE.Vector3(...meta.pedestal.box.center);ped.z=meta.pedestal.box.size[2];
  controls.target.copy(t.clone().addScaledVector(fwd,Math.max(.5,ped.clone().sub(t).dot(fwd))));camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.update();camera.up.set(0,0,1);
}

async function loadMesh(url,center){ // unlit textured mesh, shrunk slightly so observed Gaussians stay in front
  const g=(await new GLTFLoader().loadAsync(url)).scene;g.traverse(o=>{if(o.isMesh){const map=o.material.map;if(map)map.colorSpace=THREE.SRGBColorSpace;o.material=new THREE.MeshBasicMaterial({map,color:map?0xffffff:0x999999});}});
  const s=.985,wrap=new THREE.Group();wrap.add(g);wrap.scale.setScalar(s);wrap.position.copy(center.clone().multiplyScalar(1-s));return wrap;
}

async function buildObject(obj){
  const root=new THREE.Group(),nodes={},waits=[];
  for(const l of obj.links){
    const content=new THREE.Group();if(l.has_gaussians){const splat=new SplatMesh({url:BASE+l.name+'.spz'});content.add(splat);waits.push(splat.initialized);}
    const lb=new THREE.Box3(new THREE.Vector3(...l.bounds_local[0]),new THREE.Vector3(...l.bounds_local[1]));
    waits.push(loadMesh(BASE+l.name+'.glb',lb.getCenter(new THREE.Vector3())).then(m=>{m.name='fill';content.add(m);if(l.count<2000)m.userData.always=true;else{fills.push(m);m.visible=fillOn;}}));
    if(l.parent==='world'){root.position.set(...l.pos_world);root.quaternion.copy(q(l.quat_world_wxyz));root.add(content);nodes[l.name]={pivot:root,content};}
    else{const pivot=new THREE.Group();pivot.position.set(...l.pos_in_parent);content.quaternion.copy(q(l.quat_in_parent_wxyz));pivot.add(content);nodes[l.parent].pivot.add(pivot);nodes[l.name]={pivot,content};}
  }
  await Promise.all(waits);
  // bounds in the root frame (meshes, not stray Gaussians), for highlight boxes
  root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),bounds=new THREE.Box3();
  obj.links.forEach(l=>{const b=new THREE.Box3().setFromObject(nodes[l.name].content.getObjectByName('fill'));bounds.union(b.applyMatrix4(inv));});
  const joints=obj.joints.map(j=>{
    const n=nodes[j.child],axis=new THREE.Vector3(...j.axis_local).applyQuaternion(n.content.quaternion).normalize();
    const cb=new THREE.Box3().setFromObject(n.content.getObjectByName('fill')).applyMatrix4(n.pivot.matrixWorld.clone().invert()),c=cb.getCenter(new THREE.Vector3());
    const radial=c.clone().sub(axis.clone().multiplyScalar(c.dot(axis)));const rlen=Math.max(radial.length()*2,.3);
    const handle=axis.clone().multiplyScalar(c.dot(axis)).add((radial.lengthSq()>1e-6?radial.normalize():new THREE.Vector3(1,0,0)).multiplyScalar(rlen));
    const r=j.range_rad,captured=r?-r[0]:0;
    return {id:j.name,label:JOINT_LABELS[j.name]||j.name,owner:obj.name,object:n.pivot,axis,handleLocal:handle,width:cb.getSize(new THREE.Vector3()).length()*.6,
      min:r?r[0]:-Infinity,max:r?r[1]:Infinity,closed:0,describe:r?a=>`${Math.round((captured+a)*180/Math.PI)}° open`:a=>`${Math.round(THREE.MathUtils.euclideanModulo(a*180/Math.PI+180,360)-180)}° from captured`};
  });
  scene.add(root);roots.push(root);
  return {entry:{id:obj.name,label:LABELS[obj.name]||obj.name,object:root,bounds},joints};
}

async function init(){
  meta=await fetch(BASE+'scene.json').then(r=>r.json());aspect=meta.intrinsics.width/meta.intrinsics.height;resize();view(0);
  bg=new SplatMesh({url:BASE+'background.spz'});scene.add(bg);
  const built=await Promise.all([bg.initialized,...meta.objects.map(buildObject)]).then(r=>r.slice(1));
  interaction=directManipulation({scene,camera,renderer,controls,entries:built.map(b=>b.entry),joints:built.flatMap(b=>b.joints),roots:()=>roots,horizontal:true,ui:document.querySelector('#gs-interactions'),up:new THREE.Vector3(0,0,1)});
  const total=Object.values(meta.counts).reduce((a,b)=>a+b,0);document.querySelector('#gs-count').textContent=total.toLocaleString()+' Gaussians';status.hidden=true;
  window.rehearseReal2Sim={ready:true,meta,scene,camera,renderer,interaction,view,roots,setFill};
}
function setFill(on){fillOn=on;fills.forEach(m=>m.visible=on);}
document.querySelector('#gs-fill').onchange=e=>setFill(e.target.checked);
document.querySelector('#gs-bg').onchange=e=>{if(bg)bg.visible=e.target.checked;};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>meta&&view(+b.dataset.view));
document.querySelector('#gs-reset').onclick=()=>{if(!interaction)return;interaction.entries.forEach(e=>e.object.position.copy(e.initial));interaction.joints.forEach(j=>interaction.setJoint(j,0));interaction.select(null);};
function frame(){requestAnimationFrame(frame);controls.update();interaction?.update();renderer.render(scene,camera);}
init().catch(e=>{console.error(e);status.hidden=false;status.textContent='This Gaussian viewer needs WebGL 2.';});frame();

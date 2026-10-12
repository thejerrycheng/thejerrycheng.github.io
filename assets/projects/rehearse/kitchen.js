import * as THREE from 'three';
import {OrbitControls} from '../../js/vendor/OrbitControls.js';
import {SplatMesh,SparkRenderer} from '../../js/vendor/spark.module.js';

// Kitchen (work in progress): the current Gaussian splat in the metric world frame (metres, z up),
// capture cameras as presets, and the pipeline progress from progress.json (updated as stages land).
const BASE='assets/projects/rehearse/kitchen/';
const $=s=>document.querySelector(s);
const host=$('#k-view');if(host)init();

async function init(){
  const status=$('#k-status');
  const renderer=new THREE.WebGLRenderer({antialias:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xf5f5f7);host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),spark=new SparkRenderer({renderer});scene.add(spark);
  const camera=new THREE.PerspectiveCamera(55,3/4,.02,60);camera.up.set(0,0,1);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.1;controls.maxDistance=10;
  let aspect=4/3;
  const resize=()=>{const w=host.clientWidth,h=Math.round(Math.min(w/aspect,innerHeight*.72));host.style.height=h+'px';renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(host);resize();
  const [meta,prog]=await Promise.all([fetch(BASE+'scene.json').then(r=>r.json()),fetch(BASE+'progress.json').then(r=>r.json()).catch(()=>null)]);
  status.textContent=`Loading ${(meta.gaussians/1e3).toFixed(0)} k Gaussians…`;
  const splat=new SplatMesh({url:BASE+'scene.spz'});scene.add(splat);
  const path=new THREE.Line(new THREE.BufferGeometry().setFromPoints(meta.path.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:0x0071e3,transparent:true,opacity:.7,depthTest:false}));
  path.renderOrder=10;path.visible=false;scene.add(path);
  const view=i=>{const M=meta.views[i].c2w_cv,R=c=>new THREE.Vector3(M[0][c],M[1][c],M[2][c]),t=new THREE.Vector3(M[0][3],M[1][3],M[2][3]);
    const K=meta.intrinsics.K;camera.fov=Math.min(75,2*Math.atan(meta.intrinsics.height/2/K[1][1])*180/Math.PI);camera.position.copy(t);
    camera.up.copy(R(1).negate());controls.target.copy(t.clone().addScaledVector(R(2),.8));camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.update();camera.up.set(0,0,1);
    document.querySelectorAll('[data-kview]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.kview===i)));};
  const hud=$('#k-views');meta.views.forEach((v,i)=>{const b=document.createElement('button');b.dataset.kview=i;b.textContent=String.fromCharCode(65+i);b.onclick=()=>view(i);hud.appendChild(b);});
  $('#k-path').onchange=e=>{path.visible=e.target.checked;};
  view(0);
  await splat.initialized;status.hidden=true;
  if(prog){const ul=$('#k-progress');ul.innerHTML='';for(const s of prog.stages){const li=document.createElement('li');li.className=s.state;li.innerHTML=`<b>${s.name}</b><span>${s.detail}</span>`;ul.appendChild(li);}
    $('#k-updated').textContent=prog.updated;}
  renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
}

// Asset gallery: reconstructed / modeled objects (GLB, metres, +Y up as exported by Blender), studio-lit turntable.
import {GLTFLoader} from '../../js/vendor/loaders/GLTFLoader.js';
import {RoomEnvironment} from '../../js/vendor/environments/RoomEnvironment.js';
const ahost=document.querySelector('#k-asset-view');if(ahost)initAssets();
async function initAssets(){
  const list=await fetch(BASE+'assets.json').then(r=>r.json()).catch(()=>null);if(!list)return;
  const r=new THREE.WebGLRenderer({antialias:true});r.setPixelRatio(Math.min(devicePixelRatio,2));r.outputColorSpace=THREE.SRGBColorSpace;
  r.toneMapping=THREE.ACESFilmicToneMapping;r.setClearColor(0xeceff3);ahost.appendChild(r.domElement);
  const sc=new THREE.Scene();sc.environment=new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(),.04).texture;
  const key=new THREE.DirectionalLight(0xffffff,1.6);key.position.set(1,2,1.5);sc.add(key);
  const cam=new THREE.PerspectiveCamera(35,1,.01,20);const ctl=new OrbitControls(cam,r.domElement);ctl.enableDamping=true;ctl.autoRotate=true;ctl.autoRotateSpeed=1.2;
  const size=()=>{const w=ahost.clientWidth,h=ahost.clientHeight;r.setSize(w,h);cam.aspect=w/h;cam.updateProjectionMatrix();};new ResizeObserver(size).observe(ahost);size();
  let cur=null;const cache={};const st=document.querySelector('#k-asset-status');
  async function show(a){
    document.querySelectorAll('[data-asset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.asset===a.id)));
    document.querySelector('#k-asset-info').innerHTML=`<p><b>${a.label}</b> · ${a.size}</p><p>${a.detail}</p><p>${a.method}</p>`;
    st.hidden=false;st.textContent='Loading…';
    if(!cache[a.id])cache[a.id]=(await new GLTFLoader().loadAsync(BASE+a.file)).scene;
    if(cur)sc.remove(cur);cur=cache[a.id];sc.add(cur);st.hidden=true;
    const b=new THREE.Box3().setFromObject(cur),c=b.getCenter(new THREE.Vector3()),d=b.getSize(new THREE.Vector3()).length();
    ctl.target.copy(c);cam.position.copy(c).add(new THREE.Vector3(.9,.55,1).multiplyScalar(d));cam.near=d/100;cam.far=d*20;cam.updateProjectionMatrix();
  }
  const ul=document.querySelector('#k-asset-list');
  for(const a of list.assets){const b=document.createElement('button');b.dataset.asset=a.id;b.textContent=a.label;b.onclick=()=>show(a);ul.appendChild(b);}
  show(list.assets[0]);
  r.setAnimationLoop(()=>{ctl.update();r.render(sc,cam);});
}

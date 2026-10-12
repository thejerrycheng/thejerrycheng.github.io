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

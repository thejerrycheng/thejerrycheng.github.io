import * as THREE from 'three';
import {OrbitControls} from '../../../js/vendor/OrbitControls.js';
import {SplatMesh, SparkRenderer} from '../../../js/vendor/spark.module.js';
import {createTrajectorySampler} from './trajectory.js';
import {frustumCorners,frustumSegments,sparseKeyframes,fitOrbit} from './geometry.js';

const clamp=THREE.MathUtils.clamp;
const clock=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${(t%60).toFixed(2).padStart(5,'0')}`;
const cvToGL=new THREE.Quaternion(1,0,0,0);
const colorAt=u=>new THREE.Color().setHSL(.59-.48*u,.75,.49);

/** Mount an isolated replay. dataUrl accepts a directory or trajectory.json URL.
 * Returns {seek, setMode, setPlaying, captureAt, getState, dispose, ready}.
 * Times are absolute source-video seconds, not time since the first keyframe.
 */
export async function mountReplay(el,{dataUrl=new URL('./data/kitchen/',import.meta.url).href}={}) {
  const base=new URL(dataUrl,document.baseURI);
  const trajectoryURL=base.pathname.endsWith('.json')?base:new URL('trajectory.json',base.href.endsWith('/')?base.href:base.href+'/');
  const dir=new URL('./',trajectoryURL);
  const json=async url=>{const r=await fetch(url);if(!r.ok)throw new Error(`Replay data: HTTP ${r.status}`);return r.json();};
  el.innerHTML=`<section class="replay-shell" data-mode="orbit" aria-label="Kitchen reconstruction replay">
    <div class="replay-topbar"><div class="replay-title"><i></i> Kitchen <small> / 3D reconstruction replay</small></div><div class="replay-modes"><button data-mode="orbit" aria-pressed="true">Orbit</button><button data-mode="follow" aria-pressed="false">Follow camera</button><button data-action="reset" title="Reset orbit view">↺</button></div></div>
    <div class="replay-stage"><div class="replay-canvas"></div><img class="replay-blend" alt="Real observation blended over reconstruction">
      <div class="replay-hud"><div class="overline">CAPTURE TIME · <span data-field="mode">ORBIT</span></div><div class="replay-clock" data-field="time">00:00.00</div><dl><dt>Frame</dt><dd data-field="frame"></dd><dt>XYZ · m</dt><dd data-field="position"></dd><dt>Y/P/R · °</dt><dd data-field="rotation"></dd></dl><div class="speed-value"><span data-field="speed"></span> m/s <span style="float:right" data-field="rate">1× playback</span></div></div>
      <aside class="replay-observation"><header>REAL OBSERVATION</header><img class="replay-photo" alt="Nearest registered kitchen frame"><footer data-field="photo"></footer><details class="replay-parts" open><summary>Projected parts · <span data-field="part-count">0</span></summary><ul></ul></details></aside>
      <div class="replay-help">Drag to orbit · scroll to zoom</div><div class="replay-legend"><span>Start</span><i></i><span>End</span></div><div class="replay-status" role="status">Loading camera trajectory…</div>
    </div>
    <div class="replay-transport"><input class="replay-timeline" type="range" step="0.001" aria-label="Capture timeline"><div class="replay-ticks"></div><div class="replay-actions"><button class="play" aria-label="Play replay">▶ Play</button><label>Speed <select aria-label="Playback speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option></select></label><label><input type="checkbox" class="replay-path" checked> Path</label><label class="blend-control">Splat <input type="range" class="blend" min="0" max="1" step="0.01" value="0" aria-label="Blend real photo over splat"> Photo</label><span class="replay-count"></span></div></div>
  </section>`;
  const $=s=>el.querySelector(s), root=$('.replay-shell'), status=$('.replay-status');
  let renderer,controls,observer,splat,spark,disposed=false;
  try {
  const [data,stats]=await Promise.all([json(trajectoryURL),json(new URL('stats.json',dir))]);
  const keys=data.keyframes,qkeys=keys.map(k=>new THREE.Quaternion(...k.quaternion_xyzw));
  let t=data.start_t,playing=false,rate=1,mode='orbit',photoIndex=-1,photoPromise=Promise.resolve(),photoRequest=0,photoLoadedIndex=-1,manual=false,blend=0;
  const sample=createTrajectorySampler(data);
  renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xedf0f2);renderer.outputColorSpace=THREE.SRGBColorSpace;
  $('.replay-canvas').appendChild(renderer.domElement);
  const scene=new THREE.Scene();spark=new SparkRenderer({renderer});scene.add(spark);
  const camera=new THREE.PerspectiveCamera(47,1,.02,50);camera.up.set(0,0,1);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.15;controls.maxDistance=14;
  const positions=keys.map(k=>new THREE.Vector3(k.c2w[0][3],k.c2w[1][3],k.c2w[2][3]));
  const densePositions=data.dense.map(k=>new THREE.Vector3(...k.c2w.slice(0,3).map(r=>r[3])));
  const bounds=new THREE.Box3().setFromPoints(densePositions).expandByScalar(.4);
  const center=densePositions.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).divideScalar(densePositions.length);
  let homeView=true;
  function frameOrbit(phase=0){
    camera.up.set(0,0,1);camera.position.copy(fitOrbit(bounds,center,w/h,phase));
    camera.far=Math.max(50,camera.position.distanceTo(center)+bounds.getSize(new THREE.Vector3()).length()*2);
    controls.maxDistance=Math.max(14,camera.position.distanceTo(center)*3);
    controls.target.copy(center);camera.lookAt(center);projection();
  }
  const home=()=>{homeView=true;resize();frameOrbit();};
  controls.addEventListener('start',()=>{homeView=false;});
  const helpers=new THREE.Group();scene.add(helpers);
  class TimedCurve extends THREE.Curve {
    getPoint(u,target=new THREE.Vector3()){return target.copy(sample(data.start_t+u*data.duration).p);}
    // Tube rings and their colors must both use time, not Curve's arc-length remap.
    getPointAt(u,target){return this.getPoint(u,target);}
    getTangentAt(u,target){return this.getTangent(u,target);}
  }
  const tube=new THREE.TubeGeometry(new TimedCurve(),Math.min(7000,data.dense.length),.008,8,false),col=[];
  for(let i=0;i<=tube.parameters.tubularSegments;i++){const c=colorAt(i/tube.parameters.tubularSegments);for(let j=0;j<=8;j++)col.push(c.r,c.g,c.b);}
  tube.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  const path=new THREE.Mesh(tube,new THREE.MeshBasicMaterial({vertexColors:true,depthTest:false,transparent:true,opacity:.72}));path.renderOrder=12;helpers.add(path);
  const {K,width:iw,height:ih}=data.intrinsics;
  const corners=width=>frustumCorners(data.intrinsics,width);
  const segments=width=>frustumSegments(data.intrinsics,width);
  const miniPoints=[],miniColors=[],miniIndices=sparseKeyframes(keys);
  for(const i of miniIndices){const c=colorAt((keys[i].t-data.start_t)/data.duration);for(const p of segments(.12)){miniPoints.push(p.applyQuaternion(qkeys[i]).add(positions[i]));miniColors.push(c.r,c.g,c.b);}}
  const miniGeo=new THREE.BufferGeometry().setFromPoints(miniPoints);miniGeo.setAttribute('color',new THREE.Float32BufferAttribute(miniColors,3));
  const minis=new THREE.LineSegments(miniGeo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.35,linewidth:1,depthTest:false,depthWrite:false}));minis.renderOrder=11;helpers.add(minis);
  const current=new THREE.Group();scene.add(current);
  const frustum=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segments(.3)),new THREE.LineBasicMaterial({color:0x0071e3,depthTest:false,transparent:true}));frustum.renderOrder=20;current.add(frustum);
  const planeCorners=corners(.3),planeGeo=new THREE.BufferGeometry().setFromPoints(planeCorners);planeGeo.setIndex([0,1,2,0,2,3]);planeGeo.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,1,0,0,0],2));
  const planeMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,depthTest:false,transparent:true,opacity:.95});const plane=new THREE.Mesh(planeGeo,planeMaterial);plane.renderOrder=19;current.add(plane);
  const bead=new THREE.Mesh(new THREE.SphereGeometry(.024,12,8),new THREE.MeshBasicMaterial({color:0x0071e3,depthTest:false,transparent:true}));bead.renderOrder=21;current.add(bead);
  const stage=$('.replay-stage');let w=1,h=1;
  function resize(){w=stage.clientWidth;h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h);if(mode==='orbit'&&homeView)frameOrbit();else projection();}
  function projection(){
    if(mode==='follow'){
      // Preserve the full calibrated portrait sensor, letterboxed in the viewport.
      const photoWidth=Math.min(w,h*iw/ih),photoHeight=photoWidth*ih/iw;
      const s=photoHeight/ih,n=camera.near;
      camera.projectionMatrix.makePerspective(-(w/2+(K[0][2]-iw/2)*s)*n/(K[0][0]*s),(w/2-(K[0][2]-iw/2)*s)*n/(K[0][0]*s),(h/2+(K[1][2]-ih/2)*s)*n/(K[1][1]*s),-(h/2-(K[1][2]-ih/2)*s)*n/(K[1][1]*s),n,camera.far);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      $('.replay-blend').style.width=photoWidth+'px';$('.replay-blend').style.height=photoHeight+'px';$('.replay-blend').style.top=(h-photoHeight)/2+'px';
    } else {camera.aspect=w/h;camera.fov=47;camera.updateProjectionMatrix();}
  }
  observer=new ResizeObserver(resize);observer.observe(stage);home();
  status.textContent='Loading reconstructed room…';splat=new SplatMesh({url:new URL(data.splat,dir).href});scene.add(splat);await splat.initialized;
  // SPZ already contains T_world_from_colmap in metres. No second alignment/scale.
  splat.updateMatrixWorld(true);
  // Fit the orbit to the measured room box (scene.json) rather than the raw splat box, which floaters inflate.
  let room=null;try{const sc=await json(new URL('scene.json',dir));if(sc&&sc.bounds)room=new THREE.Box3(new THREE.Vector3(...sc.bounds[0]),new THREE.Vector3(...sc.bounds[1]));}catch(e){}
  if(room)bounds.union(room);else{const sb=splat.getBoundingBox(false).applyMatrix4(splat.matrixWorld);const lim=bounds.clone().expandByScalar(2.5);bounds.union(sb.intersect(lim));}
  home();
  const imageCache=new Map();
  function loadImage(index){
    if(imageCache.has(index))return imageCache.get(index);
    const promise=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Could not load observation '+keys[index].name));img.src=new URL(keys[index].image,dir).href;});
    imageCache.set(index,promise);if(imageCache.size>18)imageCache.delete(imageCache.keys().next().value);return promise;
  }
  function updatePhoto(index){
    if(index===photoIndex)return photoPromise;
    photoIndex=index;const request=++photoRequest;
    photoPromise=loadImage(index).then(img=>{if(disposed||request!==photoRequest)return;$('.replay-photo').src=img.src;$('.replay-blend').src=img.src;planeMaterial.map?.dispose();planeMaterial.map=new THREE.Texture(img);planeMaterial.map.colorSpace=THREE.SRGBColorSpace;planeMaterial.map.needsUpdate=true;planeMaterial.needsUpdate=true;photoLoadedIndex=index;});
    photoPromise.catch(error=>{status.textContent=error.message;status.hidden=false;});
    for(const j of [index+1,index+2])if(j<keys.length)loadImage(j).catch(()=>{});
    return photoPromise;
  }
  const fields=Object.fromEntries([...el.querySelectorAll('[data-field]')].map(x=>[x.dataset.field,x]));
  const timeline=$('.replay-timeline');timeline.min=data.start_t;timeline.max=data.end_t;timeline.value=t;
  $('.replay-ticks').innerHTML=Array.from({length:5},(_,i)=>`<span>${clock(data.start_t+i*data.duration/4)}</span>`).join('');
  $('.replay-count').textContent=`${keys.length} poses · ${stats.path_length_m.toFixed(1)} m`;
  let lastParts=-1;
  function visibleParts(pose){
    const inv=pose.q.clone().invert();
    return (data.parts||[]).filter(part=>{
      const r=part.rect,c=new THREE.Vector3(...r.center),u=new THREE.Vector3(...r.u).multiplyScalar(r.size[0]/2),v=new THREE.Vector3(...r.v).multiplyScalar(r.size[1]/2);
      // Clip the rectangle in camera space against the five sensor frustum planes.
      let polygon=[c.clone().sub(u).sub(v),c.clone().add(u).sub(v),c.clone().add(u).add(v),c.clone().sub(u).add(v)].map(x=>x.sub(pose.p).applyQuaternion(inv));
      const tests=[p=>p.z-.02,p=>K[0][0]*p.x+K[0][2]*p.z,p=>(iw-K[0][2])*p.z-K[0][0]*p.x,p=>K[1][1]*p.y+K[1][2]*p.z,p=>(ih-K[1][2])*p.z-K[1][1]*p.y];
      for(const f of tests){const out=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],fa=f(a),fb=f(b);if(fa>=0)out.push(a);if((fa>=0)!==(fb>=0))out.push(a.clone().lerp(b,fa/(fa-fb)));}polygon=out;if(!polygon.length)return false;}
      return true;
    });
  }
  function update(){
    const pose=sample(t),k=keys[pose.key];current.position.copy(pose.p);current.quaternion.copy(pose.q);
    if(mode==='follow'){camera.position.copy(pose.p);camera.quaternion.copy(pose.q).multiply(cvToGL);camera.updateMatrixWorld();}
    fields.time.textContent=clock(t);fields.frame.textContent=k.name.replace('.jpg','');fields.position.textContent=pose.p.toArray().map(x=>x.toFixed(2)).join('  ');
    const e=new THREE.Euler().setFromQuaternion(pose.q.clone().multiply(cvToGL),'ZYX');fields.rotation.textContent=[e.z,e.y,e.x].map(x=>(x*180/Math.PI).toFixed(1)).join(' / ');
    fields.speed.textContent=pose.speed.toFixed(2);fields.photo.textContent=`${k.name} · ${clock(k.t)} · Δ ${(k.t-t)>=0?'+':''}${(k.t-t).toFixed(2)} s`;timeline.value=t;
    if(Math.abs(t-lastParts)>.1||manual){const visible=visibleParts(pose);fields['part-count'].textContent=visible.length;const ul=$('.replay-parts ul');ul.replaceChildren(...visible.map(p=>{const li=document.createElement('li');li.textContent=p.name.replaceAll('_',' ');return li;}));lastParts=t;}
    updatePhoto(pose.key);return pose;
  }
  function setPlaying(value){playing=!!value;$('.play').textContent=playing?'Ⅱ Pause':'▶ Play';$('.play').setAttribute('aria-label',playing?'Pause replay':'Play replay');}
  function setMode(value){if(!['orbit','follow'].includes(value))throw new Error('Unknown camera mode');mode=value;root.dataset.mode=mode;controls.enabled=mode==='orbit';current.visible=mode==='orbit';helpers.visible=mode==='orbit'&&$('.replay-path').checked;fields.mode.textContent=mode==='follow'?'PHONE VIEW':'ORBIT';$('.blend').disabled=mode!=='follow';$('.replay-help').textContent=mode==='follow'?'Calibrated phone view · blend the nearest real observation':'Drag to orbit · scroll to zoom';el.querySelectorAll('button[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));if(mode==='orbit')home();else projection();update();}
  async function seek(time){if(!Number.isFinite(time))throw new Error('Time must be finite');t=clamp(time,data.start_t,data.end_t);update();await photoPromise;renderer.render(scene,camera);return getState();}
  function getState(){const pose=sample(t);return {t,mode,playing,rate,sourceFrame:keys[pose.key].source_frame,position:pose.p.toArray(),quaternion:pose.q.toArray(),cameraPosition:camera.position.toArray(),cameraQuaternion:camera.quaternion.toArray(),speed:pose.speed,blend,photoLoaded:photoLoadedIndex===pose.key,start:data.start_t,end:data.end_t,registered:keys.length,keyframeFrustums:miniIndices.length,orbitTarget:center.toArray(),sceneBounds:[bounds.min.toArray(),bounds.max.toArray()]};}
  $('.play').onclick=()=>{if(t>=data.end_t)t=data.start_t;setPlaying(!playing);};
  timeline.oninput=()=>{setPlaying(false);seek(+timeline.value);};
  $('.replay-actions select').onchange=e=>{rate=+e.target.value;fields.rate.textContent=`${rate}× playback`;};
  el.querySelectorAll('button[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  $('[data-action=reset]').onclick=()=>setMode('orbit');
  $('.replay-path').onchange=e=>{helpers.visible=e.target.checked&&mode==='orbit';};
  $('.blend').oninput=e=>{blend=+e.target.value;$('.replay-blend').style.opacity=blend;};$('.replay-blend').style.opacity=0;$('.blend').disabled=true;
  root.tabIndex=0;root.onkeydown=e=>{if(['INPUT','SELECT','BUTTON'].includes(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();setPlaying(!playing);}if(e.code==='ArrowRight'||e.code==='ArrowLeft'){e.preventDefault();setPlaying(false);seek(t+(e.code==='ArrowRight'?1:-1));}};
  let last=performance.now();
  renderer.setAnimationLoop(now=>{if(disposed)return;const dt=Math.min((now-last)/1000,.1);last=now;if(!manual){if(playing){t=Math.min(t+dt*rate,data.end_t);if(t===data.end_t)setPlaying(false);update();}if(mode==='orbit')controls.update();renderer.render(scene,camera);}});
  await seek(t);status.hidden=true;
  async function captureAt(time,{orbitPhase=0,playbackRate=4}={}) {
    manual=true;setPlaying(false);if(mode!=='orbit')setMode('orbit');
    fields.rate.textContent=`${playbackRate}× film`;
    frameOrbit(orbitPhase);await seek(time);
    // Spark sorts asynchronously; wait for the vendored renderer before capture.
    const deadline=performance.now()+15000;
    for(let i=0;i<3||spark.defaultView.sorting||spark.defaultView.pending;i++) {
      if(performance.now()>deadline)throw new Error('Timed out waiting for splat sort');
      await new Promise(requestAnimationFrame);renderer.render(scene,camera);
    }
    await Promise.all([$('.replay-photo').decode(),$('.replay-blend').decode()]);
    return getState();
  }
  function dispose(){disposed=true;photoRequest++;renderer.setAnimationLoop(null);observer.disconnect();controls.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});splat.dispose?.();spark.dispose?.();renderer.dispose();el.replaceChildren();}
  return {seek,setMode,setPlaying,captureAt,getState,dispose,ready:true};
  } catch(error){status.hidden=false;status.textContent=`Unable to load replay: ${error.message}`;observer?.disconnect();controls?.dispose();renderer?.setAnimationLoop(null);renderer?.dispose();throw error;}
}

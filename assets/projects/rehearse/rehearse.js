import * as THREE from 'three';
import {OrbitControls} from '../../js/vendor/OrbitControls.js';
import {GLTFLoader} from '../../js/vendor/loaders/GLTFLoader.js';
import {directManipulation} from './interactions.js';
const asset='assets/projects/rehearse/';
// UI outside WebGL remains usable even if rendering is unavailable.
let comparison='render';
const choose=document.querySelector('#capture-select');
function updateComparison(){const id=choose.value;document.querySelector('#reference-image').src=`${asset}capture-${id}.webp`;document.querySelector('#reference-image').alt=`Original capture ${id}`;document.querySelector('#result-image').src=`${asset}${comparison}-${id}.webp`;document.querySelector('#result-image').alt=`${comparison==='render'?'Current reconstruction':'Estimated relative depth'} for capture ${id}`;document.querySelector('#result-label').textContent=comparison==='render'?'Current reconstruction · CPU Blender render of exported assets':'Depth Anything 3 Large · camera-conditioned depth';}
choose.addEventListener('change',updateComparison);
document.querySelectorAll('[data-compare]').forEach(b=>b.addEventListener('click',()=>{comparison=b.dataset.compare;document.querySelectorAll('[data-compare]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));updateComparison();}));
async function init(){
const host=document.querySelector('#viewer'),status=document.querySelector('#viewer-status');
const cal=await fetch(asset+'cameras.json').then(r=>{if(!r.ok)throw Error('Camera data unavailable');return r.json();});
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xf8f8fa);renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0xf8f8fa);
const camera=new THREE.PerspectiveCamera(40,1,.005,40);camera.up.set(0,0,1);camera.position.set(1.6,-2,1.8);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,-.12,.75);controls.enableDamping=true;controls.minDistance=.25;controls.maxDistance=9;controls.update();
scene.add(new THREE.HemisphereLight(0xffffff,0x777780,2));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(-2,-3,5);scene.add(sun);
const geometry=new THREE.Group();scene.add(geometry);
function material(color){return new THREE.MeshStandardMaterial({color,roughness:.65,metalness:0});}
const table=new THREE.Mesh(new THREE.BoxGeometry(cal.table_width,cal.table_depth,cal.table_height),material(0xdededa));table.position.z=cal.table_height/2;geometry.add(table);
const cup=new THREE.Group();cup.position.fromArray(cal.cup_position);geometry.add(cup);
function cylinder(rt,rb,h,z,color){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,64),material(color));m.rotation.x=Math.PI/2;m.position.z=z;cup.add(m);return m;}
cylinder(.044,.033,.138,.081,0x68554f);cylinder(.033,.032,.012,.006,0xe3e1d7);cylinder(.045,.045,.019,.1595,0x18191a);
const ground=new THREE.GridHelper(3,30,0xc9c9ce,0xe3e3e8);ground.rotation.x=Math.PI/2;ground.position.z=-.002;geometry.add(ground);
const frusta=new THREE.Group();scene.add(frusta);const colors=[0x1681dd,0xdf783e,0x3a9566];
function transformDirection(v,R){return new THREE.Vector3(R[0][0]*v[0]+R[1][0]*v[1]+R[2][0]*v[2],R[0][1]*v[0]+R[1][1]*v[1]+R[2][1]*v[2],R[0][2]*v[0]+R[1][2]*v[1]+R[2][2]*v[2]);}
cal.cameras.forEach((c,i)=>{const C=new THREE.Vector3().fromArray(c.position),R=c.R_world_to_cv;const corners=[[-375,-500],[375,-500],[375,500],[-375,500]].map(([x,y])=>transformDirection([x/cal.K[0][0]*.18,y/cal.K[1][1]*.18,.18],R).add(C));const vertices=[];corners.forEach((p,j)=>{vertices.push(...C,...p,...p,...corners[(j+1)%4]);});const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));frusta.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:colors[i]})));const marker=new THREE.Mesh(new THREE.SphereGeometry(.014,12,8),new THREE.MeshBasicMaterial({color:colors[i]}));marker.position.copy(C);frusta.add(marker);});
let photo=null,photoCup=[],mode='photo',selected='orbit',interaction=null;
const loader=new GLTFLoader();loader.load(asset+'scene.glb',g=>{photo=g.scene;photo.traverse(o=>{if(o.isMesh){const old=o.material;o.material=new THREE.MeshBasicMaterial({map:old.map,side:THREE.DoubleSide,vertexColors:Boolean(o.geometry.attributes.color),color:old.map||o.geometry.attributes.color?0xffffff:old.color});}if(o.name==='coffee'){photoCup.push({o,z:o.position.z});}});photo.visible=mode==='photo';scene.add(photo);setupInteraction();window.rehearseScene1={ready:true,photo,photoCup,renderer,camera,scene,interaction};},undefined,e=>{console.error(e);document.querySelector('[data-mode="photo"]').disabled=true;document.querySelector('[data-mode="photo"]').title='Photo mesh unavailable';});
status.hidden=true;geometry.visible=false;table.visible=false;
function selectView(v){selected=v;controls.enabled=v==='orbit';if(v==='orbit'){camera.position.set(1.6,-2,1.8);camera.up.set(0,0,1);camera.fov=40;controls.target.set(0,-.12,.75);camera.lookAt(controls.target);controls.update();}else{const c=cal.cameras[+v],R=c.rotation_camera_to_world_opengl;camera.position.fromArray(c.position);const m=new THREE.Matrix4().set(R[0][0],R[0][1],R[0][2],0,R[1][0],R[1][1],R[1][2],0,R[2][0],R[2][1],R[2][2],0,0,0,0,1);camera.quaternion.setFromRotationMatrix(m);camera.fov=2*Math.atan(500/(c.K||cal.K)[1][1])*180/Math.PI;}resize();}
document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-camera]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));selectView(b.dataset.camera);}));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;setupInteraction();document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));geometry.visible=mode==='geometry';if(photo)photo.visible=mode==='photo';table.visible=mode==='geometry';document.querySelector('#viewer-note').textContent=mode==='photo'?'Multi-view Depth Anything 3 surfaces with photographic textures. Reflective glass and unobserved areas remain incomplete. The cup is a single independent assembly.':'Drag to orbit. Scroll to zoom. The still cameras are localized against the later video’s COLMAP map. Direct dragging previews an object pose; it is not a grasp simulation.';}));
document.querySelector('#frusta').addEventListener('change',e=>frusta.visible=e.target.checked);
function setupInteraction(){interaction?.dispose();const target=mode==='photo'?photoCup[0]?.o:cup;if(!target)return;interaction=directManipulation({scene,camera,renderer,controls,entries:[{id:'coffee',label:'Coffee cup',object:target}],roots:()=>[mode==='photo'?photo:geometry],ui:document.querySelector('#scene1-interactions'),viewport:()=>{const r=renderer.domElement.getBoundingClientRect();if(selected==='orbit')return r;const w=Math.min(r.width,r.height*.75),h=w/.75;return {left:r.left+(r.width-w)/2,top:r.top+(r.height-h)/2,width:w,height:h};}});if(window.rehearseScene1)window.rehearseScene1.interaction=interaction;}

function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=selected==='orbit'?w/h:.75;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(host);resize();function frame(){requestAnimationFrame(frame);interaction?.update();if(controls.enabled)controls.update();const w=host.clientWidth,h=host.clientHeight;renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);renderer.clear();if(selected!=='orbit'){const pw=Math.min(w,h*.75),ph=pw/.75;renderer.setViewport((w-pw)/2,(h-ph)/2,pw,ph);renderer.setScissor((w-pw)/2,(h-ph)/2,pw,ph);renderer.setScissorTest(true);}renderer.render(scene,camera);}requestAnimationFrame(frame);
}
init().catch(e=>{console.error(e);document.querySelector('#viewer-status').textContent='The interactive viewer needs WebGL. The capture comparisons below remain available.';});

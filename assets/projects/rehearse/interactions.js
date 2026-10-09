import * as THREE from 'three';

// Shared direct manipulation for textured meshes and Gaussian object groups.
export function directManipulation({scene,camera,renderer,controls,entries,joints=[],roots,ui,enabled=()=>true,viewport,onChange=()=>{},up=new THREE.Vector3(0,0,1)}) {
  const canvas=renderer.domElement,ray=new THREE.Raycaster(),helpers=new THREE.Group();scene.add(helpers);
  let selected=null,drag=null,highlight=false;const cleanups=[];
  canvas.tabIndex=0;canvas.setAttribute('aria-label','3D scene. Drag objects to move; Shift drag to lift. R restores selected pose.');
  const list=ui.querySelector('.movable-list'),state=ui.querySelector('.interaction-state'),toggle=ui.querySelector('.highlight-all');
  const boxFor=e=>e.bounds?e.bounds.clone().applyMatrix4(e.object.matrixWorld):new THREE.Box3().setFromObject(e.object);
  entries.forEach(e=>{e.initial=e.object.position.clone();e.box=new THREE.Box3Helper(new THREE.Box3(),0x0071e3);e.box.material.depthTest=false;e.box.renderOrder=1000;helpers.add(e.box);});
  joints.forEach(j=>{j.angle=0;j.initial=j.object.quaternion.clone();j.axis.normalize();j.handle=new THREE.Mesh(new THREE.SphereGeometry(.023,16,12),new THREE.MeshBasicMaterial({color:0xe77822,depthTest:false}));j.handle.renderOrder=1002;helpers.add(j.handle);j.line=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xe77822,depthTest:false}));j.line.renderOrder=1001;helpers.add(j.line);});
  const choices=[...entries,...joints];
  list.replaceChildren(...choices.map(e=>{const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.textContent=e.label;b.dataset.selectObject=e.id;b.setAttribute('aria-pressed','false');b.onclick=()=>select(e);li.append(b);e.button=b;return li;}));
  function select(e){selected=e;choices.forEach(x=>x.button.setAttribute('aria-pressed',String(x===e)));state.textContent=e?`${e.label} selected · ${joints.includes(e)?'drag the orange handle to rotate':'drag its surface to move'}`:'Click an object to select it';update();}
  toggle.onclick=()=>{highlight=!highlight;toggle.setAttribute('aria-pressed',String(highlight));toggle.textContent=highlight?'Hide highlights':'Highlight objects + joints';update();};
  function setJoint(j,target){
    target=THREE.MathUtils.clamp(target,j.min,j.max);const start=j.angle,steps=Math.max(1,Math.ceil(Math.abs(target-start)/(.02)));let accepted=start,contact='';
    for(let i=1;i<=steps;i++){const a=start+(target-start)*i/steps;contact=j.collision?.(a)||'';if(contact){let lo=accepted,hi=a;for(let n=0;n<12;n++){const mid=(lo+hi)/2;if(j.collision(mid))hi=mid;else lo=mid;}accepted=lo;break;}accepted=a;}
    j.angle=accepted;j.object.quaternion.copy(j.initial).multiply(new THREE.Quaternion().setFromAxisAngle(j.axis,accepted));j.object.updateMatrixWorld(true);onChange(j);
    state.textContent=`${j.label} · ${Math.round((j.closed-accepted)*180/Math.PI)}° open${contact?' · stopped at '+contact:''}`;update();return {angle:accepted,contact};
  }
  function update(){
    const active=enabled();helpers.visible=active;scene.updateMatrixWorld(true);
    entries.forEach(e=>{e.box.visible=active&&(highlight||selected===e);if(e.box.visible){e.box.box.copy(boxFor(e));e.box.material.color.setHex(selected===e?0x0071e3:0x48a6cc);e.box.updateMatrixWorld(true);}});
    joints.forEach(j=>{const visible=active&&(highlight||selected===j||selected?.id===j.owner);j.handle.visible=j.line.visible=visible;if(!visible)return;const pivot=j.object.getWorldPosition(new THREE.Vector3()),q=j.object.parent.getWorldQuaternion(new THREE.Quaternion()),axis=j.axis.clone().applyQuaternion(q);j.handle.position.copy(j.object.localToWorld(j.handleLocal.clone()));j.line.geometry.setFromPoints([pivot.clone().addScaledVector(axis,-j.width/2),pivot.clone().addScaledVector(axis,j.width/2),pivot,j.handle.position]);});
  }
  function setRay(e){const r=viewport?viewport():canvas.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.left+r.width||e.clientY<r.top||e.clientY>r.top+r.height)return false;ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);return true;}
  function visible(o){while(o){if(!o.visible)return false;o=o.parent;}return true;}
  function pick(){
    const h=ray.intersectObjects(joints.filter(j=>j.handle.visible).map(j=>j.handle),false)[0];if(h)return {entry:joints.find(j=>j.handle===h.object),point:h.point};
    const hits=ray.intersectObjects(roots(),true);for(const hit of hits){if(!visible(hit.object))continue;let o=hit.object;while(o){const e=entries.find(x=>x.object===o);if(e)return {entry:e,point:hit.point};o=o.parent;}return null;}return null;
  }
  function down(e){
    if(e.button!==0||!enabled()||!setRay(e))return;update();const hit=pick();if(!hit){select(null);return;}e.preventDefault();e.stopImmediatePropagation();canvas.focus({preventScroll:true});select(hit.entry);const object=selected.object;drag={id:e.pointerId,entry:selected,initial:object.position.clone(),quaternion:object.quaternion.clone(),controls:controls.enabled,start:new THREE.Vector2(e.clientX,e.clientY),angle:selected.angle};controls.enabled=false;canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';
    if(joints.includes(selected)){const pivot=object.getWorldPosition(new THREE.Vector3()),axis=selected.axis.clone().applyQuaternion(object.parent.getWorldQuaternion(new THREE.Quaternion()));drag.pivot=pivot;drag.axis=axis;drag.plane=new THREE.Plane().setFromNormalAndCoplanarPoint(axis,pivot);drag.radial=ray.ray.intersectPlane(drag.plane,new THREE.Vector3())?.sub(pivot).normalize();const handle=object.localToWorld(selected.handleLocal.clone()),tangent=new THREE.Vector3().crossVectors(axis,handle.clone().sub(pivot));const a=handle.clone().project(camera),b=handle.clone().add(tangent).project(camera),r=viewport?viewport():canvas.getBoundingClientRect();drag.screenTangent=new THREE.Vector2((b.x-a.x)*r.width/2,-(b.y-a.y)*r.height/2);
    }else{drag.world=object.getWorldPosition(new THREE.Vector3());drag.hit=hit.point;drag.plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),hit.point);drag.vertical=e.shiftKey;drag.scale=2*camera.position.distanceTo(hit.point)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/canvas.getBoundingClientRect().height;}
  }
  function move(e){
    if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopImmediatePropagation();setRay(e);const d=drag,o=d.entry.object;
    if(joints.includes(d.entry)){const v=ray.ray.intersectPlane(d.plane,new THREE.Vector3())?.sub(d.pivot).normalize();let angle;if(d.radial&&v&&Math.abs(ray.ray.direction.dot(d.axis))>.08)angle=Math.atan2(d.axis.dot(d.radial.clone().cross(v)),d.radial.dot(v));else angle=new THREE.Vector2(e.clientX,e.clientY).sub(d.start).dot(d.screenTangent)/Math.max(1,d.screenTangent.lengthSq());setJoint(d.entry,d.angle+angle);
    }else{const point=ray.ray.intersectPlane(d.plane,new THREE.Vector3());if(!point)return;const delta=d.vertical?up.clone().multiplyScalar((d.start.y-e.clientY)*d.scale):point.sub(d.hit);const world=d.world.clone().add(delta);o.position.copy(o.parent.worldToLocal(world));o.updateMatrixWorld(true);onChange(d.entry);state.textContent=`${d.entry.label} · drag to position · R restores its pose`;update();}
  }
  function end(e){if(!drag||e.pointerId!==drag.id)return;e.stopImmediatePropagation();controls.enabled=drag.controls;drag=null;canvas.style.cursor='grab';if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);update();}
  function key(e){if(e.key==='Escape'&&drag){drag.entry.object.position.copy(drag.initial);drag.entry.object.quaternion.copy(drag.quaternion);if(joints.includes(drag.entry))drag.entry.angle=drag.angle;onChange(drag.entry);end({pointerId:drag.id,stopImmediatePropagation(){}});e.preventDefault();}else if(e.key.toLowerCase()==='r'&&selected){if(joints.includes(selected))setJoint(selected,0);else{selected.object.position.copy(selected.initial);onChange(selected);}update();state.textContent=selected.label+' · captured pose restored';e.preventDefault();}}
  for(const [name,fn] of [['pointerdown',down],['pointermove',move],['pointerup',end],['pointercancel',end],['keydown',key]]){canvas.addEventListener(name,fn,true);cleanups.push(()=>canvas.removeEventListener(name,fn,true));}
  canvas.style.touchAction='none';canvas.style.cursor='grab';update();
  return {entries,joints,select,setJoint,update,get selected(){return selected;},get dragging(){return Boolean(drag);},dispose(){cleanups.forEach(f=>f());scene.remove(helpers);entries.forEach(e=>{e.box.geometry.dispose();e.box.material.dispose();});joints.forEach(j=>{j.handle.geometry.dispose();j.handle.material.dispose();j.line.geometry.dispose();j.line.material.dispose();});}};
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../../js/vendor/three.module.min.js';
import {frustumCorners,frustumSegments,sparseKeyframes,fitOrbit,boxCorners} from './geometry.js';
const d=JSON.parse(fs.readFileSync(new URL('./data/kitchen/trajectory.json',import.meta.url)));
const selected=sparseKeyframes(d.keyframes);
let maxError=0;
for(let n=0;n<selected.length;n++) {
  const k=d.keyframes[selected[n]],p=new THREE.Vector3(...k.c2w.slice(0,3).map(r=>r[3])),q=new THREE.Quaternion(...k.quaternion_xyzw);
  if(n)assert.ok(k.t-d.keyframes[selected[n-1]].t>=1);
  const points=frustumSegments(d.intrinsics,.12),local=points.map(p=>p.clone());
  assert.equal(new Set(points).size,16); // Regression: shared corners were transformed repeatedly.
  points.forEach(p0=>p0.applyQuaternion(q).add(p));
  points.forEach((p0,i)=>{maxError=Math.max(maxError,p0.distanceTo(p.clone().add(local[i].clone().applyQuaternion(q))));assert.ok(p0.distanceTo(p)<.2);});
  for(let i=0;i<16;i+=4)assert.ok(points[i].distanceTo(p)<1e-12);
}
for(const width of [.12,.3]){
  const c=frustumCorners(d.intrinsics,width);
  assert.ok(Math.abs(c[0].distanceTo(c[1])-width)<1e-12);
  for(let i=0;i<4;i++){
    assert.ok(Math.abs(d.intrinsics.K[0][0]*c[i].x/c[i].z+d.intrinsics.K[0][2]-([0,1,1,0][i]*d.intrinsics.width))<1e-9);
  }
}
const report=JSON.parse(fs.readFileSync(new URL('./shots/export-test.json',import.meta.url)));
const bounds=new THREE.Box3(...report.splat_center_bounds_m.map(p=>new THREE.Vector3(...p))).expandByScalar(.6);
const center=new THREE.Vector3(.03,.02,1.48);
for(const aspect of [2.3,1.8,.68])for(const phase of [-.42,0,.42]){
  const camera=new THREE.PerspectiveCamera(47,aspect,.02,100);
  camera.up.set(0,0,1);camera.position.copy(fitOrbit(bounds,center,aspect,phase,Infinity));camera.lookAt(center);camera.updateMatrixWorld(true);
  for(const p of boxCorners(bounds)){p.project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1&&p.z>-1);}
  const offset=camera.position.clone().sub(center);
  assert.ok(Math.abs(Math.atan2(offset.z,Math.hypot(offset.x,offset.y))*180/Math.PI-22)<1e-10);
  assert.ok(fitOrbit(bounds,center,aspect,phase).distanceTo(center)<=1.9+1e-9);
}
const result={status:'passed',keyframe_frustums:selected.length,minimum_spacing_seconds:1,keyframe_width_m:.12,keyframe_depth_m:frustumCorners(d.intrinsics,.12)[0].z,current_width_m:.3,current_depth_m:frustumCorners(d.intrinsics,.3)[0].z,max_endpoint_transform_error_m:maxError,orbit_fit_cases:9};
fs.writeFileSync(new URL('./shots/geometry-test.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createTrajectorySampler} from './trajectory.js';
import * as THREE from '../../../js/vendor/three.module.min.js';
const data=JSON.parse(fs.readFileSync(new URL('./data/kitchen/trajectory.json',import.meta.url)));
const sample=createTrajectorySampler(data);
let maxP=0,maxQ=0,maxDenseP=0,maxDenseQ=0,maxSpeed=0;
for(const k of data.keyframes){
  const a=sample(k.t),p=new THREE.Vector3(...k.c2w.slice(0,3).map(r=>r[3])),q=new THREE.Quaternion(...k.quaternion_xyzw);
  maxP=Math.max(maxP,a.p.distanceTo(p));maxQ=Math.max(maxQ,a.q.angleTo(q));
}
for(const k of data.dense){
  const a=sample(k.t),p=new THREE.Vector3(...k.c2w.slice(0,3).map(r=>r[3])),q=new THREE.Quaternion(...k.quaternion_xyzw);
  maxDenseP=Math.max(maxDenseP,a.p.distanceTo(p));maxDenseQ=Math.max(maxDenseQ,a.q.angleTo(q));maxSpeed=Math.max(maxSpeed,Math.abs(a.speed-k.speed_mps));
  assert.ok(a.p.toArray().every(Number.isFinite)&&Number.isFinite(a.speed));
}
assert.ok(maxP<1e-10&&maxQ<1e-6);assert.ok(maxDenseP<1e-10&&maxDenseQ<1e-5&&maxSpeed<1e-9);
assert.deepEqual(sample(data.start_t-1).p,sample(data.start_t).p);assert.deepEqual(sample(data.end_t+1).p,sample(data.end_t).p);
// Follow camera convention: optical axis is CV +Z / three.js -Z, image top CV -Y.
const conversion=new THREE.Quaternion(1,0,0,0);
for(const k of data.keyframes){const p=sample(k.t),gl=p.q.clone().multiply(conversion);assert.ok(new THREE.Vector3(0,0,-1).applyQuaternion(gl).distanceTo(new THREE.Vector3(0,0,1).applyQuaternion(p.q))<1e-12);assert.ok(new THREE.Vector3(0,1,0).applyQuaternion(gl).distanceTo(new THREE.Vector3(0,-1,0).applyQuaternion(p.q))<1e-12);}
const result={status:'passed',keyframes:data.keyframes.length,dense_samples:data.dense.length,max_keyframe_position_m:maxP,max_keyframe_angle_deg:maxQ*180/Math.PI,max_dense_position_m:maxDenseP,max_dense_angle_deg:maxDenseQ*180/Math.PI,max_speed_difference_mps:maxSpeed};
fs.writeFileSync(new URL('./shots/numerical-test.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);

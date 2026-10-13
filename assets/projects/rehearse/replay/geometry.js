import * as THREE from '../../../js/vendor/three.module.min.js';

// Calibrated CV camera space (+Z forward, +Y down). Width is in world metres.
export function frustumCorners({K,width,height},planeWidth) {
  const d=planeWidth*K[0][0]/width;
  return [[0,0],[width,0],[width,height],[0,height]].map(([x,y])=>
    new THREE.Vector3((x-K[0][2])*d/K[0][0],(y-K[1][2])*d/K[1][1],d));
}
export function frustumSegments(intrinsics,width) {
  const c=frustumCorners(intrinsics,width),points=[];
  // Each endpoint must be owned independently: callers transform each exactly once.
  for(let i=0;i<4;i++)points.push(new THREE.Vector3(),c[i].clone(),c[i].clone(),c[(i+1)%4].clone());
  return points;
}
export function sparseKeyframes(keys,interval=1) {
  let last=-Infinity;
  return keys.flatMap((k,i)=>{if(k.t-last<interval)return [];last=k.t;return [i];});
}
export function boxCorners(bounds) {
  const points=[];
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new THREE.Vector3(x,y,z));
  return points;
}
// Fit all eight corners, accounting for target offset, depth and both field-of-view axes.
export function fitOrbit(bounds,target,aspect,phase=0,maxDistance=1.9) {
  const elevation=THREE.MathUtils.degToRad(22),azimuth=Math.PI/4+phase;
  const outward=new THREE.Vector3(Math.cos(azimuth)*Math.cos(elevation),Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation));
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,0,1),outward).normalize();
  const up=new THREE.Vector3().crossVectors(outward,right);
  const tanY=Math.tan(THREE.MathUtils.degToRad(47)/2),tanX=tanY*aspect;
  let distance=1;
  for(const p of boxCorners(bounds)) {
    const r=p.sub(target);
    distance=Math.max(distance,r.dot(outward)+1.15*Math.max(Math.abs(r.dot(right))/tanX,Math.abs(r.dot(up))/tanY)+.1);
  }
  // The room was captured from inside: an orbit camera outside it only sees the backs of walls and ceiling,
  // so the distance is capped to keep the viewpoint inside the room.
  return target.clone().addScaledVector(outward,Math.min(distance,maxDistance));
}

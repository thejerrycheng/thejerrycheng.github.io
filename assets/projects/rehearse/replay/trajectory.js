import * as THREE from '../../../js/vendor/three.module.min.js';
const bernstein=[1,5,10,10,5,1];

// Evaluate the exported curve itself, rather than interpolating the 30 Hz samples.
// This preserves exact keyframes and continuous position, velocity and acceleration.
export function createTrajectorySampler(data) {
  const keys=data.keyframes,times=keys.map(k=>k.t),qkeys=keys.map(k=>new THREE.Quaternion(...k.quaternion_xyzw));
  const qa=data.spline.control_a.map(q=>new THREE.Quaternion(...q)),qb=data.spline.control_b.map(q=>new THREE.Quaternion(...q));
  return function sample(time) {
    time=THREE.MathUtils.clamp(time,data.start_t,data.end_t);
    let lo=0,hi=keys.length-1;
    while(lo+1<hi){const mid=(lo+hi)>>1;if(times[mid]<=time)lo=mid;else hi=mid;}
    const h=times[lo+1]-times[lo],u=(time-times[lo])/h,c=data.spline.coefficients[lo],p=new THREE.Vector3(),vel=new THREE.Vector3();
    for(let i=0;i<6;i++)p.addScaledVector(new THREE.Vector3(...c[i]),bernstein[i]*u**i*(1-u)**(5-i));
    for(let i=0;i<5;i++)vel.addScaledVector(new THREE.Vector3(...c[i+1]).sub(new THREE.Vector3(...c[i])),5*[1,4,6,4,1][i]*u**i*(1-u)**(4-i)/h);
    const q=qkeys[lo].clone().slerp(qkeys[lo+1],u).slerp(qa[lo].clone().slerp(qb[lo],u),2*u*(1-u));
    return {p,q,speed:vel.length(),key:u<.5?lo:lo+1};
  };
}

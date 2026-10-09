import * as THREE from 'three';
const faces=[[0,1,2],[4,5,6],[0,1,5],[1,2,6],[2,3,7],[3,0,4]];
const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
// Separating-axis test for convex hexahedra. No endpoint-only tunnelling: the
// interaction controller sweeps the angle before accepting any new transform.
export function convexOverlap(a,b){
 const axes=[];
 for(const v of [a,b])for(const [i,j,k] of faces)axes.push(v[j].clone().sub(v[i]).cross(v[k].clone().sub(v[i])));
 for(const [i,j] of edges)for(const [k,l] of edges)axes.push(a[j].clone().sub(a[i]).cross(b[l].clone().sub(b[k])));
 for(const axis of axes){if(axis.lengthSq()<1e-12)continue;axis.normalize();const aa=a.map(v=>v.dot(axis)),bb=b.map(v=>v.dot(axis));if(Math.max(...aa)<=Math.min(...bb)+1e-5||Math.max(...bb)<=Math.min(...aa)+1e-5)return false;}return true;
}
export function hingeContacts({lid,laptop,table,config}){
 const tableInitial=table.position.clone(),hinge=lid.position.clone(),axis=new THREE.Vector3(...config.axis),quad=config.corners_local.map(p=>new THREE.Vector3(...p));
 function prism(q,half){const normal=q[1].clone().sub(q[0]).cross(q[3].clone().sub(q[0])).normalize();return [...q.map(p=>p.clone().addScaledVector(normal,-half)),...q.map(p=>p.clone().addScaledVector(normal,half))];}
 const near=.022/quad[3].clone().sub(quad[0]).length();const trimmed=[quad[0].clone().lerp(quad[3],near),quad[1].clone().lerp(quad[2],near),quad[2],quad[3]];
 const screen=prism(trimmed,.006),base=config.base_corners_local.map(p=>new THREE.Vector3(...p)),baseNormal=base[1].clone().sub(base[0]).cross(base[3].clone().sub(base[0])).normalize(),baseBox=prism(base.map(p=>p.clone().addScaledVector(baseNormal,-.006)),.006),tableBox=config.table_corners_world.map(p=>new THREE.Vector3(...p));
 return angle=>{laptop.updateMatrixWorld(true);table.updateMatrixWorld(true);const q=new THREE.Quaternion().setFromAxisAngle(axis,angle);const a=screen.map(v=>v.clone().applyQuaternion(q).add(hinge).applyMatrix4(laptop.matrixWorld));const b=baseBox.map(v=>v.clone().applyMatrix4(laptop.matrixWorld));if(convexOverlap(a,b))return 'laptop base';const delta=table.position.clone().sub(tableInitial);if(convexOverlap(a,tableBox.map(v=>v.clone().add(delta))))return 'tabletop';if(a.some(v=>v.z<-.075+.002))return 'floor';return '';};
}

"""Independent export validation against source cameras and the saved spline."""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.interpolate import BPoly
from scipy.spatial.transform import Rotation

ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('--root',type=Path,required=True)
a=ap.parse_args()
here=Path(__file__).resolve().parent
folder=here/'data/kitchen'
d=json.loads((folder/'trajectory.json').read_text())
c=np.load(a.root/'cameras.npz')
w=json.loads((a.root/'world.json').read_text())
lookup={str(name):i for i,name in enumerate(c['names'])}
t=np.array([k['t'] for k in d['keyframes']])
poses=np.array([k['c2w'] for k in d['keyframes']])
source=np.array(w['T_world_from_colmap'])@np.linalg.inv(c['w2c'][[lookup[k['name']] for k in d['keyframes']]])
source[:,:3,:3]/=w['metres_per_unit']
assert np.array_equal(poses,source), 'Original poses changed'
assert all(k['t']==k['source_frame']/30 for k in d['keyframes'])
coeff=np.array(d['spline']['coefficients'])
curve=BPoly(coeff.transpose(1,0,2),t)
h=np.diff(t)[:,None]
v0=5*(coeff[:,1]-coeff[:,0])/h
v1=5*(coeff[:,-1]-coeff[:,-2])/h
a0=20*(coeff[:,2]-2*coeff[:,1]+coeff[:,0])/h**2
a1=20*(coeff[:,-1]-2*coeff[:,-2]+coeff[:,-3])/h**2
max_v=float(np.max(np.linalg.norm(v1[:-1]-v0[1:],axis=1)))
max_a=float(np.max(np.linalg.norm(a1[:-1]-a0[1:],axis=1)))
assert max_v<1e-10 and max_a<1e-9
pos_error=np.linalg.norm(curve(t)-poses[:,:3,3],axis=1)
angle_error=(Rotation.from_matrix(source[:,:3,:3]).inv()*Rotation.from_quat([k['quaternion_xyzw'] for k in d['keyframes']])).magnitude()*180/np.pi
assert np.sqrt(np.mean(pos_error**2))<.02 and np.sqrt(np.mean(angle_error**2))<1
assert np.allclose(np.diff([s['t'] for s in d['dense']]),1/30,rtol=0,atol=1e-12)
for key in d['keyframes']:
    for name,width in [('thumb',320),('image',640)]:
        with Image.open(folder/key[name]) as im:
            assert im.width==width and im.height==round(1707*width/1280)
            im.verify()
scene=json.loads((folder/'scene.json').read_text())
for view in scene['views']:
    actual=next(k for k in d['keyframes'] if k['name']==view['name'])
    assert np.allclose(actual['c2w'],view['c2w_cv'],rtol=0,atol=1e-12)
result=dict(status='passed',original_poses_bitwise_equal=True,position_rms_m=float(np.sqrt(np.mean(pos_error**2))),orientation_rms_deg=float(np.sqrt(np.mean(angle_error**2))),c2_max_velocity_jump_mps=max_v,c2_max_acceleration_jump_mps2=max_a,thumbnails_verified=len(t),photos_verified=len(t),splat_export_camera_alignment='exact',dense_hz=30)
# Verify the actual SPZ payload against source PLY positions, not only its metadata.
import gzip
import struct
from plyfile import PlyData
payload=gzip.decompress((folder/d['splat']).read_bytes())
magic,version,count,degree,fractional_bits,flags,reserved=struct.unpack('<IIIBBBB',payload[:16])
assert magic==0x5053474e and version==2
packed=np.frombuffer(payload,np.uint8,count*9,16).reshape(count,3,3).astype(np.int32)
fixed=packed[:,:,0] | (packed[:,:,1]<<8) | (packed[:,:,2]<<16)
spz=np.where(fixed&0x800000,fixed-(1<<24),fixed)/2**fractional_bits
vertices=PlyData.read(str(a.root/'splat/full.ply'))['vertex']
raw=np.stack([vertices[axis] for axis in ('x','y','z')],axis=1).astype(np.float32)
transform=np.asarray(w['T_world_from_colmap'])
world_xyz=(raw@transform[:3,:3].T+transform[:3,3]).astype(np.float32)
opacity=1/(1+np.exp(-np.asarray(vertices['opacity'],np.float32)))
lo=np.percentile(source[:,:3,3],1,axis=0)-1.5
hi=np.percentile(source[:,:3,3],99,axis=0)+1.5
keep=(opacity>.02)&np.all((world_xyz>lo)&(world_xyz<hi),axis=1)
expected=world_xyz[keep]
assert len(expected)==count
error=np.linalg.norm(spz-expected,axis=1)
assert np.max(error)<=np.sqrt(3)*.5/2**fractional_bits+1e-6
result.update(splat_payload_alignment='source PLY transformed by current world similarity',
              gaussians_verified=count,max_spz_position_error_m=float(error.max()),
              splat_center_bounds_m=[spz.min(0).tolist(),spz.max(0).tolist()],
              camera_height_percentiles_m=dict(zip(['min','p05','median','p95','max'],np.percentile(poses[:,2,3],[0,5,50,95,100]).tolist())),
              camera_height_in_1p1_to_1p8_m=int(np.sum((poses[:,2,3]>=1.1)&(poses[:,2,3]<=1.8))),
              floor_z_m=0,scale_source=w['scale_source'],metres_per_colmap_unit=w['metres_per_unit'])
(here/'shots/export-test.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))

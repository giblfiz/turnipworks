#!/usr/bin/env python3
"""Project our accepted native spider pictogram onto the original corbel bearing surface."""
import hashlib,io,json,pathlib,struct
import numpy as np
import trimesh
from PIL import Image
B=pathlib.Path(__file__).resolve().parents[1];sku='flavor-corbel--spiders-fct';src=B/'models-graded'/f'{sku}.glb';dst=B/'models'/f'{sku}.glb';icon=B/'icons/spiders.png'
b=src.read_bytes();length=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+length]);binary=b[28+length:]
texture=doc['textures'][doc['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']];idx=texture['source'];v=doc['bufferViews'][doc['images'][idx]['bufferView']];off=v.get('byteOffset',0)
im=Image.open(io.BytesIO(binary[off:off+v['byteLength']])).convert('RGB');rgb=np.asarray(im).copy();height,width=rgb.shape[:2]
glyph=np.asarray(Image.open(icon).convert('RGBA'));hsv=np.asarray(Image.fromarray(glyph[:,:,:3]).convert('HSV')).astype(float)/255
# Native pictogram is purple on a charcoal round button. Saturation isolates the owned glyph, retaining its silhouette.
alpha=np.clip((hsv[:,:,1]-.18)/.12,0,1)*glyph[:,:,3]/255
luma=glyph[:,:,:3].max(2)/255;ink=np.array([234,221,249])[None,None,:]*(.78+.22*luma[:,:,None])
scene=trimesh.load(src,force='scene',process=False);painted=0;faces=0
for node in scene.graph.nodes_geometry:
 transform,key=scene.graph[node];mesh=scene.geometry[key].copy();mesh.apply_transform(transform);lo,hi=mesh.bounds
 centers=mesh.triangles_center;selected=(mesh.face_normals[:,1]>.92)&(centers[:,1]>lo[1]+.94*(hi[1]-lo[1]))
 ids=np.where(selected)[0];triangles=mesh.triangles[ids];xlo,xhi=triangles[:,:,0].min(),triangles[:,:,0].max();zlo,zhi=triangles[:,:,2].min(),triangles[:,:,2].max();side=min(xhi-xlo,zhi-zlo)*.90;cx=(xlo+xhi)/2;cz=(zlo+zhi)/2
 uv=np.asarray(mesh.visual.uv);tex=np.column_stack((uv[:,0]*(width-1),(1-uv[:,1])*(height-1)))
 for faceid in ids:
  face=mesh.faces[faceid];tri=tex[face];world=mesh.vertices[face];xmin=max(0,int(np.floor(tri[:,0].min())));xmax=min(width-1,int(np.ceil(tri[:,0].max())));ymin=max(0,int(np.floor(tri[:,1].min())));ymax=min(height-1,int(np.ceil(tri[:,1].max())))
  xx,yy=np.meshgrid(np.arange(xmin,xmax+1),np.arange(ymin,ymax+1));p=np.stack((xx,yy),axis=-1);ab=tri[1]-tri[0];ac=tri[2]-tri[0];det=ab[0]*ac[1]-ab[1]*ac[0]
  if abs(det)<1e-7:continue
  rel=p-tri[0];u=(rel[:,:,0]*ac[1]-rel[:,:,1]*ac[0])/det;w=(ab[0]*rel[:,:,1]-ab[1]*rel[:,:,0])/det;inside=(u>=0)&(w>=0)&(u+w<=1)
  xyz=world[0]+u[:,:,None]*(world[1]-world[0])+w[:,:,None]*(world[2]-world[0]);gx=(xyz[:,:,0]-cx)/side+.5;gy=.5-(xyz[:,:,2]-cz)/side;inside&=(gx>=0)&(gx<=1)&(gy>=0)&(gy<=1)
  ix=np.clip((gx*(glyph.shape[1]-1)).astype(int),0,glyph.shape[1]-1);iy=np.clip((gy*(glyph.shape[0]-1)).astype(int),0,glyph.shape[0]-1);a=alpha[iy,ix]*inside
  patch=rgb[ymin:ymax+1,xmin:xmax+1];patch[:]=np.clip(patch*(1-a[:,:,None])+ink[iy,ix]*a[:,:,None],0,255).astype('uint8');painted+=int(np.count_nonzero(a));faces+=1
out=io.BytesIO();Image.fromarray(rgb).save(out,format='PNG');data=out.getvalue();pad=(-len(binary))%4;offset=len(binary)+pad;binary+=b'\0'*pad+data
vi=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(data)});doc['images'][idx]={'bufferView':vi,'mimeType':'image/png'};doc['buffers'][0]['byteLength']=len(binary)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary+=b'\0'*((-len(binary))%4)
result=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary;dst.write_bytes(result)
log={'sku':sku,'inputSha256':hashlib.sha256(b).hexdigest(),'outputSha256':hashlib.sha256(result).hexdigest(),'icon':'icons/spiders.png','iconSha256':hashlib.sha256(icon.read_bytes()).hexdigest(),'geometry':'Original graded source geometry/accessors untouched; rejected shelf deformation is not used','projection':'Upper faces normalY>.92, height>.94; square90% of smaller top-plane dimension; icon head toward+Z; UV barycentric rasterization','glyph':'Purple saturation mask from our accepted native pictogram; charcoal button omitted; lavender/ivory grade retains painted shading','faces':faces,'paintedPixels':painted}
(B/'integration/spider-inlay.json').write_text(json.dumps(log,indent=2)+'\n');print(json.dumps(log,indent=2))

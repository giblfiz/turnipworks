#!/usr/bin/env python3
"""Reproducibly lift spider front carving to pale lavender, preserving geometry and slab."""
import hashlib,io,json,pathlib,struct
import numpy as np
import trimesh
from PIL import Image,ImageDraw
B=pathlib.Path(__file__).resolve().parents[1];sku='flavor-corbel--spiders-fct'
src=B/'models-ungraded'/f'{sku}.glb';dst=B/'models'/f'{sku}.glb'
src.parent.mkdir(exist_ok=True)
if not src.exists():src.write_bytes(dst.read_bytes())
blob=src.read_bytes();length,typ=struct.unpack_from('<II',blob,12);doc=json.loads(blob[20:20+length]);binary=blob[28+length:]
texture=doc['textures'][doc['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']];idx=texture.get('source',texture.get('extensions',{}).get('EXT_texture_webp',{}).get('source'));view=doc['bufferViews'][doc['images'][idx]['bufferView']];start=view.get('byteOffset',0)
im=Image.open(io.BytesIO(binary[start:start+view['byteLength']])).convert('RGB');w,h=im.size
scene=trimesh.load(src,force='scene',process=False);mask=Image.new('L',im.size);draw=ImageDraw.Draw(mask)
selected=0
for node in scene.graph.nodes_geometry:
 transform,key=scene.graph[node];mesh=scene.geometry[key].copy();mesh.apply_transform(transform)
 pos=mesh.vertices;norm=(pos-pos.min(axis=0))/(pos.max(axis=0)-pos.min(axis=0));cent=norm[mesh.faces].mean(axis=1)
 # Front carving below the slab. The upper shelf and rear mounting block retain their original color.
 keep=(cent[:,1]<.82)&(cent[:,2]>.33);uv=np.asarray(mesh.visual.uv);coords=np.column_stack((uv[:,0]*(w-1),(1-uv[:,1])*(h-1)))
 for face in mesh.faces[keep]:draw.polygon([tuple(p) for p in coords[face]],fill=255)
 selected+=int(keep.sum())
hsv=np.asarray(im.convert('HSV')).astype(float)/255;value=hsv[...,2];sel=(np.asarray(mask)>0)&(value>.10)
# Retain deep grooves. Lift painted surfaces, keeping their gradient instead of flattening them.
hsv[...,0][sel]=.755;hsv[...,1][sel]=np.minimum(hsv[...,1][sel]*.45+.08,.28);hsv[...,2][sel]=np.minimum(value[sel]*1.65+.15,.94)
paint=Image.fromarray(np.clip(hsv*255,0,255).astype('uint8'),'HSV').convert('RGB');out=io.BytesIO();paint.save(out,format='PNG');data=out.getvalue()
padding=(-len(binary))%4;offset=len(binary)+padding;binary+=b'\0'*padding+data
viewidx=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(data)})
doc['images'][idx]={'bufferView':viewidx,'mimeType':'image/png'};texture.pop('extensions',None);texture['source']=idx;doc['buffers'][0]['byteLength']=len(binary)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary+=b'\0'*((-len(binary))%4)
result=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
dst.write_bytes(result);log={'sku':sku,'originalSha256':hashlib.sha256(blob).hexdigest(),'gradedSha256':hashlib.sha256(result).hexdigest(),'geometry':'Original accessors, buffers, transforms, and materials unchanged; new base color image appended only','frontMask':'Y-normalized < .82 and Z-normalized > .33 triangle centroids; UV rasterized','selectedFaces':selected,'selectedPixels':int(sel.sum()),'grade':'HSV: original V>.10 only; H=.755, S=min(S*.45+.08,.28), V=min(V*1.65+.15,.94); original upper slab, rear and deepest grooves retained'}
(B/'integration/spider-grade.json').write_text(json.dumps(log,indent=2)+'\n');print(json.dumps(log,indent=2))

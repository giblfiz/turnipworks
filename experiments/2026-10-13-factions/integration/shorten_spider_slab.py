#!/usr/bin/env python3
"""Shorten only the upper shelf's forward projection; preserve the spider carving."""
import hashlib,json,pathlib,struct
import numpy as np
B=pathlib.Path(__file__).resolve().parents[1];sku='flavor-corbel--spiders-fct';src=B/'models-graded'/f'{sku}.glb';dst=B/'models'/f'{sku}.glb'
src.parent.mkdir(exist_ok=True)
if not src.exists():src.write_bytes(dst.read_bytes())
b=src.read_bytes();length=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+length]);binary=bytearray(b[28+length:])
prim=doc['meshes'][0]['primitives'][0];access=doc['accessors'][prim['attributes']['POSITION']];view=doc['bufferViews'][access['bufferView']];offset=view.get('byteOffset',0)+access.get('byteOffset',0)
pos=np.frombuffer(binary,dtype='<f4',count=access['count']*3,offset=offset).reshape(-1,3)
original=pos.copy();lo=pos.min(0);span=pos.max(0)-lo;norm=(pos-lo)/span
blend=np.clip((norm[:,1]-.60)/(.76-.60),0,1);blend=blend*blend*(3-2*blend)
scale=1-.55*blend
sel=blend>0
# Shelf bearing remains 45% of its original front/back span; the spider projects beyond it.
pos[sel,2]=lo[2]+(pos[sel,2]-lo[2])*scale[sel]
access['min']=pos.min(0).tolist();access['max']=pos.max(0).tolist()
# Correct transformed shelf normals; preserve every carving vertex and normal below the shelf.
acc=doc['accessors'][prim['attributes']['NORMAL']];v=doc['bufferViews'][acc['bufferView']];o=v.get('byteOffset',0)+acc.get('byteOffset',0)
n=np.frombuffer(binary,dtype='<f4',count=acc['count']*3,offset=o).reshape(-1,3);t=np.clip((norm[:,1]-.60)/(.76-.60),0,1); dsdy=-.55*6*t*(1-t)/((.76-.60)*span[1]); shear=(original[:,2]-lo[2])*dsdy
n[sel,1]-=n[sel,2]*shear[sel]/scale[sel];n[sel,2]/=scale[sel];n[sel]/=np.maximum(np.linalg.norm(n[sel],axis=1)[:,None],1e-9)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary+=b'\0'*((-len(binary))%4)
out=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary;dst.write_bytes(out)
log={'sku':sku,'inputSha256':hashlib.sha256(b).hexdigest(),'outputSha256':hashlib.sha256(out).hexdigest(),'selectedVertices':int(sel.sum()),'totalVertices':len(pos),'rule':'Y-normalized .60-.76 smoothstep: Z scale transitions continuously 1 to .45 about rear plane. Lower carving unchanged; upper bracket/support transitions to shortened slab. Flat top Y and rear Z retained.','verticesBelowTransitionUnchanged':bool(np.array_equal(pos[~sel],original[~sel])),'shelfBearingFraction':.45}
(B/'integration/spider-slab-repair.json').write_text(json.dumps(log,indent=2)+'\n');print(json.dumps(log,indent=2))

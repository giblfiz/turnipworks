#!/usr/bin/env python3
"""Measure candidate mounting planes in glTF Y-up coordinates. Evidence only: never writes orientation decisions.

Run with ~/.local/share/tw-trimesh-venv/bin/python.
Largest-dimension scaling matches the runtime. At final yaw the front must face +Z,
wall back must face -Z, and beam-bearing top must face +Y. A large planar patch is
not proof it is the back: the motif-facing render is the independent second check.
"""
import argparse,hashlib,json,pathlib,math
import numpy as np
import trimesh

def patch(mesh, vertices, normals, centers, axis, sign, scale):
    lo,hi=vertices.min(axis=0),vertices.max(axis=0);ext=hi-lo
    # Allow matte sculptural bevels while measuring only broadly axis-facing faces.
    aligned=normals[:,axis]*sign>=math.cos(math.radians(18))
    near=(centers[:,axis]>=hi[axis]-.12*ext[axis]) if sign>0 else (centers[:,axis]<=lo[axis]+.12*ext[axis])
    candidates=np.flatnonzero(aligned & near)
    if not len(candidates):return {'projectedAreaShare':0,'faces':0,'planeInches':None,'rmsInches':None}
    coordinates=centers[candidates,axis];weights=mesh.area_faces[candidates]*abs(normals[candidates,axis])
    # Find the strongest narrow plane band, not a sparse extremum vertex/spike.
    bins=np.linspace(lo[axis],hi[axis]+1e-12,81);hist,_=np.histogram(coordinates,bins=bins,weights=weights)
    k=int(hist.argmax());band=np.abs(coordinates-(bins[k]+bins[k+1])/2)<=max(ext[axis]*.025,1e-9)
    selected=candidates[band];weights=mesh.area_faces[selected]*abs(normals[selected,axis]);coordinates=centers[selected,axis]
    average=float(np.average(coordinates,weights=weights));rms=float(np.sqrt(np.average((coordinates-average)**2,weights=weights)))
    others=[i for i in range(3) if i!=axis];box_area=float(ext[others].prod())
    return {'projectedAreaShare':round(float(weights.sum())/max(box_area,1e-12),4),'faces':len(selected),
            'planeInches':round((average-lo[axis])*scale,3),'rmsInches':round(rms*scale,4),
            'insetFromExtremeInches':round(((hi[axis]-average) if sign>0 else (average-lo[axis]))*scale,3)}

def measure(path,size,yaws):
    scene=trimesh.load(path,force='scene',process=False)
    mesh=scene.to_geometry() if hasattr(scene,'to_geometry') else scene.dump(concatenate=True)
    if not isinstance(mesh,trimesh.Trimesh) or len(mesh.faces)==0:raise ValueError('No triangles')
    v=np.asarray(mesh.vertices);n=np.asarray(mesh.face_normals);centers=np.asarray(mesh.triangles_center)
    if not np.isfinite(v).all():raise ValueError('Non-finite vertices')
    # Scaling is based on the raw bounds, as solver.js does before applying yaw.
    raw_extent=np.ptp(v,axis=0);scale=max(size)/max(raw_extent);hypotheses=[]
    for yaw in yaws:
        theta=math.radians(yaw);c,s=math.cos(theta),math.sin(theta)
        rotation=np.array([[c,0,s],[0,1,0],[-s,0,c]])
        vertices=v@rotation.T;normals=n@rotation.T;at=centers@rotation.T;ext=np.ptp(vertices,axis=0)
        hypotheses.append({'yaw':yaw,'sizeInchesWHD':[round(x*scale,3) for x in ext],
                           'rearMinusZ':patch(mesh,vertices,normals,at,2,-1,scale),
                           'frontPlusZ':patch(mesh,vertices,normals,at,2,1,scale),
                           'topPlusY':patch(mesh,vertices,normals,at,1,1,scale)})
    return {'file':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'faces':len(mesh.faces),
            'vertices':len(v),'rawBoundsXYZ':raw_extent.tolist(),'catalogWDH':size,'uniformInchesPerUnit':scale,
            'hypotheses':hypotheses,'decision':None,
            'caution':'Plane scores rank evidence, not approved yaws. Confirm motif front and flat rear from orientation renders; no automatic rejection thresholds.'}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--models',type=pathlib.Path,required=True)
    p.add_argument('--assets',type=pathlib.Path,action='append',default=[]);p.add_argument('--out',type=pathlib.Path,required=True)
    p.add_argument('--skus',nargs='*');p.add_argument('--yaw',type=float,action='append');p.add_argument('--default-size',default='24,24,30')
    a=p.parse_args();spec={}
    for f in a.assets:
        for row in json.loads(f.read_text())['assets']:spec[row['id']]=row
    a.out.mkdir(parents=True,exist_ok=True);wanted=set(a.skus or []);paths=sorted(a.models.glob('*.glb'))
    if wanted:paths=[q for q in paths if q.stem in wanted]
    if not paths:raise SystemExit('No matching meshes; nothing measured')
    for path in paths:
        size=spec.get(path.stem,{}).get('size') or list(map(float,a.default_size.split(',')))
        rec=measure(path,size,a.yaw or [0,-90,180,90]);(a.out/(path.stem+'.json')).write_text(json.dumps(rec,indent=2))
        order=sorted(rec['hypotheses'],key=lambda h:-h['rearMinusZ']['projectedAreaShare'])
        print(path.stem,'rear-plane evidence',[(h['yaw'],h['rearMinusZ']['projectedAreaShare']) for h in order],flush=True)
if __name__=='__main__':main()

#!python3
"""data/orient.json for this batch's meshes (run from tools/spawn-tuner after build_data.py), with the evidence per mesh
in orient-decisions.json:
  non-kit meshes  yaw from orient-read.json (Gemini: which of four turns faces like the partner), else 0: every plate
                  was drawn from the partner's front render, and the six Gemini read all came back yaw 0 at 100; the
                  mesh gate's match read checks the facing of all of them (gate-renders.json `facing`)
  framed-door twins  the leaf on the +Z side (assets.js OWN_DEPTH: the frame stays in the wall, the leaf stands out
                  into the room): measured on the runtime mesh (the half of the depth that spans the frame's width is the
                  frame), 180 when the leaf is at -Z. Also for the two door twins this batch did not make.
  other kit pieces  none (as their partners: the runtime tier turns them, prep/blender_runtime.py kit_fix)"""
import json, sys
from pathlib import Path
import numpy as np, trimesh
E = Path(__file__).resolve().parent.parent
L = json.load(open('data/library.json'))['objects']; O = json.load(open('data/orient.json'))
read = json.loads((E / 'orient-read.json').read_text()) if (E / 'orient-read.json').exists() else {}
dec = {}
def leaf_yaw(sku):
    v = trimesh.load(f'assets/m/{sku}.glb', force='scene').to_geometry().vertices; c = (v.min(0) + v.max(0)) / 2
    px = lambda a: np.percentile(a, 98) - np.percentile(a, 2) if len(a) > 10 else 0
    front, back = px(v[v[:, 2] > c[2], 0]), px(v[v[:, 2] < c[2], 0])
    return (0 if back > front else 180), f'frame half x-range: -Z {back:.2f}, +Z {front:.2f}'
for oid, o in L.items():
    for k in o['skus']:
        if k.get('kind') != 'mesh': continue
        if oid in ('door-plank-open', 'door-reinforced-open'):
            y, why = leaf_yaw(k['sku']); O[k['mesh']] = y; dec[k['mesh']] = {'yaw': y, 'evidence': f'leaf to +Z ({why})'}
        elif k['src'] == 'openmesh-01' and o['place'] != 'kit':
            r = read.get(k['sku']); y = r['yaw'] if r else 0
            O[k['mesh']] = y; dec[k['mesh']] = {'yaw': y, 'evidence': f"Gemini four-turn read, conf {r['conf']}" if r else 'plate drawn from the partner front render (see docstring); facing checked by the mesh gate'}
Path('data/orient.json').write_text(json.dumps(O, indent=1))
(E / 'orient-decisions.json').write_text(json.dumps(dec, indent=1))
for m, d in dec.items(): print(m, d['yaw'], d['evidence'])

#!python3
"""Where a hatch twin's floor tile is (2026-10-30). An open trapdoor / oubliette came out of TRELLIS with its shaft
under the tile, so the runtime mesh's bottom (its origin: prep/blender_runtime.py) is the shaft's bottom and the tile
floats. `sink` = the height of the tile's TOP as a share of the runtime mesh's height: the highest 2% slice whose
plan (2nd-98th percentile in x and z) still spans 85% of the mesh's. engine/client/assets.js lowers the twin so that
top meets the shut piece's top (a placement transform only; the shaft goes under the floor).
  tools/sink.py prep/results-openmesh01.jsonl SKU...      (run from tools/spawn-tuner; rewrites the results lines)"""
import json, sys
import numpy as np, trimesh
res, skus = sys.argv[1], set(sys.argv[2:])
lines = [json.loads(l) for l in open(res)]
for r in lines:
    if r.get('sku') not in skus: continue
    v = trimesh.load(f"assets/m/{r['sku']}.glb", force='scene').to_geometry().vertices
    y = v[:, 1]; y0, H = y.min(), np.ptp(y); px = lambda a: np.percentile(a, 98) - np.percentile(a, 2)
    X, Z = px(v[:, 0]), px(v[:, 2]); top = None
    for k in range(50):
        sl = v[(y >= y0 + k * H / 50) & (y < y0 + (k + 1) * H / 50)]
        if len(sl) > 20 and px(sl[:, 0]) >= 0.85 * X and px(sl[:, 2]) >= 0.85 * Z: top = (k + 1) / 50
    r['sink'] = round(top or 0, 3); print(r['sku'], 'tile top at', r['sink'], 'of the height')
open(res, 'w').write(''.join(json.dumps(r) + '\n' for r in lines))

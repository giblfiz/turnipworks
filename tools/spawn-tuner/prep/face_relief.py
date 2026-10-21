"""Which broad face of a wall panel carries the relief (niches, carving)?  Run from tools/spawn-tuner:
    python3 prep/face_relief.py SKU [SKU ...]
Ray-casts a 40 x 40 grid at the +Z and the -Z face of assets/m/<sku>.glb and prints the spread of the hit depth as a
share of the piece's thickness. A wall piece's local +Z faces the room (walls.js edgeTransform), so a panel whose
relief is on -Z needs yaw 180 in data/orient.json (prep/orient_ccm.py MANUAL). Near-equal numbers = both faces alike.
"""
import sys, numpy as np, trimesh
for sku in sys.argv[1:]:
    m = trimesh.load(f'assets/m/{sku}.glb', force='mesh'); lo, hi = m.bounds; n = 40
    X, Y = np.meshgrid(np.linspace(lo[0], hi[0], n + 2)[1:-1], np.linspace(lo[1], hi[1], n + 2)[1:-1]); P = np.c_[X.ravel(), Y.ravel()]; res = {}
    for name, z0, dz in (('+Z', hi[2] + 1, -1), ('-Z', lo[2] - 1, 1)):
        loc, _, _ = m.ray.intersects_location(np.c_[P, np.full(len(P), z0)], np.tile([0, 0, dz], (len(P), 1)), multiple_hits=False)
        res[name] = float(np.std(np.abs(loc[:, 2] - z0) - 1)) / (hi[2] - lo[2])
    a, b = res['+Z'], res['-Z']
    print(f"{sku:44s} relief +Z {a:.2f}  -Z {b:.2f}  -> {'faces the room as modelled' if a > 1.5 * b else 'TURN 180 (relief on -Z)' if b > 1.5 * a else 'both faces alike'}")

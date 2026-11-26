#!/usr/bin/env python3
"""When main carries a library built from binaries this worktree cannot see (2026-11-07: the sprawl pack's meshes were not
in main's experiments/ yet, so a local build_data.py drops its 81 objects), the branch's generated data = MAIN's
library.json / rooms.json + this lane's skus and room types (those of src cultb-*), never a local rebuild of everything.
    python3 experiments/2026-11-06-cultures-b/tools/merge_data.py"""
import json, subprocess
from pathlib import Path
W = Path(__file__).resolve().parents[3]; D = W / 'tools/spawn-tuner/data'
show = lambda p: json.loads(subprocess.run(['git', 'show', f'main:tools/spawn-tuner/data/{p}'], cwd=W, capture_output=True, text=True).stdout)
lib_m, lib_b = show('library.json'), json.loads((D / 'library.json').read_text())
mine = lambda s: str(s.get('src', '')).startswith('cultb-')
n = 0
for oid, ob in lib_b['objects'].items():
    ours = [s for s in ob['skus'] if mine(s)]
    if not ours: continue
    om = lib_m['objects'].get(oid)
    if om is None: lib_m['objects'][oid] = ob; n += len(ours); continue
    have = {s['sku'] for s in om['skus']}; om['skus'] += [s for s in ours if s['sku'] not in have]; n += len(ours)
    if ob.get('only') is not None or om.get('only') is not None: om['only'] = sorted(set(om.get('only', [])) | set(ob.get('only', []))) if (om.get('only') and ob.get('only')) else om.get('only')
(D / 'library.json').write_text(json.dumps(lib_m, indent=1))
rooms_m, rooms_b = show('rooms.json'), json.loads((D / 'rooms.json').read_text())
keys = {r['key'] for r in rooms_m}; add = [r for r in rooms_b if r['key'][:4] in ('nrs-', 'mde-', 'rus-', 'mes-') and r['key'] not in keys]
(D / 'rooms.json').write_text(json.dumps(rooms_m + add, indent=1))
print(f'library: main + {n} culture skus; rooms: main + {len(add)} culture room types')

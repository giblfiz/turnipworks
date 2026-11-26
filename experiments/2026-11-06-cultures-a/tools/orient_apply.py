#!/usr/bin/env python3
"""data/orient.json for one culture's non-kit meshes (run from tools/spawn-tuner, after build_data.py): the yaw of the
blind four-turn read (CODE/mesh-read.json, tools/mesh_read.py: the view that shows the FRONT), unless
CODE/orient-overrides.json says otherwise with a reason; a mesh with no read yet keeps yaw 0 and says so. The evidence
per mesh goes to prep/orient-sweep-CODE-01/decisions.json. A read made of an older mesh (its sha differs) is not used.
    python3 ../../experiments/2026-11-06-cultures-a/tools/orient_apply.py CODE"""
import csv, hashlib, json, sys
from pathlib import Path
E = Path(__file__).resolve().parent.parent; code = sys.argv[1]; B = E / code; run = f'{code}-01'
read = json.loads((B / 'mesh-read.json').read_text()) if (B / 'mesh-read.json').exists() else {}
over = json.loads((B / 'orient-overrides.json').read_text()) if (B / 'orient-overrides.json').exists() else {}
lib = json.load(open('data/library.json'))['objects']; orient = json.load(open('data/orient.json')); dec = {}
src_of = {r['sku']: r['source'] for r in csv.DictReader(open(E.parents[1] / f'catalog/runs/{run}/manifest.tsv'), delimiter='\t')}
sha = lambda p: hashlib.sha1(p.read_bytes()).hexdigest()[:12]
n = {'read': 0, 'override': 0, 'none': 0, 'stale': 0}
for oid, o in lib.items():
    for s in o['skus']:
        if s.get('src') != run or s.get('kind') != 'mesh' or o['place'] == 'kit': continue
        src = src_of.get(s['sku'], s['sku']); r = read.get(src, {}); glb = B / 'models' / f'{src}.glb'
        if src in over: y, why = over[src]['yaw'], 'override: ' + over[src]['why']; n['override'] += 1
        elif r and r.get('sha') == sha(glb) and r.get('front'): y, why = r.get('yaw', 0), f"blind four-turn read: front {r.get('front')} ({r.get('confidence')})"; n['read'] += 1
        elif r: y, why = 0, 'the read was of an older mesh: yaw 0 until it is read again'; n['stale'] += 1
        else: y, why = 0, 'no read yet: yaw 0'; n['none'] += 1
        orient[s['mesh']] = y; dec[s['mesh']] = {'yaw': y, 'evidence': why}
Path('data/orient.json').write_text(json.dumps(orient, indent=1))
d = Path(f'prep/orient-sweep-{run}'); d.mkdir(exist_ok=True); (d / 'decisions.json').write_text(json.dumps(dec, indent=1))
print(code, len(dec), 'orient decisions', n)

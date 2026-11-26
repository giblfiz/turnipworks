#!/usr/bin/env python3
"""data/library.json and data/rooms.json = main's committed files + this batch's additions (run from the repo root,
after tools/spawn-tuner/build_data.py). Why: main's library.json carries the sprawl batch's 87 skus whose GLBs were
not on this machine (neither in main's checkout nor in this worktree, 2026-11-07), so a local build drops them; the
culture skus are added to main's file instead, exactly as build_data.py would place them (skus of an object sorted
by name; culture objects and culture room types added; nothing of main's is changed). Refuses if main's file and
the local build disagree on anything but those missing skus and the cultures' own additions.
    python3 experiments/2026-11-06-cultures-a/tools/merge_lib.py [main]"""
import json, subprocess, sys
REF = sys.argv[1] if len(sys.argv) > 1 else 'main'
MINE = ('jpn-01', 'chn-01', 'ind-01', 'jpn-flats-01', 'chn-flats-01', 'ind-flats-01')
show = lambda p: json.loads(subprocess.run(['git', 'show', f'{REF}:{p}'], capture_output=True, text=True, check=True).stdout)
L = 'tools/spawn-tuner/data/library.json'; R = 'tools/spawn-tuner/data/rooms.json'
base, built = show(L), json.load(open(L))
bo, mo = base['objects'], built['objects']
for k in base:
    if k != 'objects' and json.dumps(base[k], sort_keys=True) != json.dumps(built[k], sort_keys=True): sys.exit(f'REFUSING: {k} differs from {REF}')
added_obj = added_sku = 0
for oid, o in mo.items():
    mine = [s for s in o['skus'] if s.get('src') in MINE]
    if oid not in bo:
        if len(mine) != len(o['skus']): sys.exit(f'REFUSING: {oid} is new here but not all its skus are the cultures\'')
        bo[oid] = o; added_obj += 1; added_sku += len(mine); continue
    if not mine: continue
    ours = {s['sku'] for s in mine}  # (a culture sku already there is REPLACED by this build's: a re-meshed piece carries its new mesh)
    bo[oid]['skus'] = sorted([s for s in bo[oid]['skus'] if s['sku'] not in ours] + mine, key=lambda s: s['sku']); added_sku += len(mine)
    for f in ('only', 'hung'):
        if f in o and f not in bo[oid]: bo[oid][f] = o[f]

base['objects'] = dict(sorted(bo.items(), key=lambda kv: min(s['sku'] for s in kv[1]['skus'])))  # build_data.py's order: by each object's first sku name
json.dump(base, open(L, 'w'), indent=1)
rb, rm = show(R), json.load(open(R))
ours = [r for r in rm if r['key'].split('-')[0] in ('jpn', 'chn', 'ind')]
keys = {r['key'] for r in rb}
json.dump(rb + [r for r in ours if r['key'] not in keys], open(R, 'w'), indent=1)
print(f'library: +{added_obj} objects, +{added_sku} culture skus onto {REF}; rooms: +{len(ours)} culture room types')

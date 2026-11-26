#!/usr/bin/env python3
"""The branch's generated data = MAIN's library.json / rooms.json + this lane's own deltas, never a local rebuild of
everything (2026-11-07: main's library carries the sprawl / cyberpunk skus whose source GLBs are in no checkout, so a local
build_data.py drops ~64 objects and ~25 skus of other lanes). Run from the worktree root AFTER build_data.py:
    python3 tools/spawn-tuner/build_data.py; python3 experiments/2026-11-07-culture-roofs/tools/merge_data.py [main]
This lane's deltas, taken from the fresh local build:
  - every sku of src croof-01 (the roof ornaments, roof-ridge--kawara/tongwa/glazed, SUCH's mes-court-endwall/ball/hip-guard),
    as a new object or added to main's object (skus sorted by name, as build_data.py does);
  - decal-mes-court-line (SUCH's centre-line flat, a new object);
  - `slides: true` on the Japanese door leaves (catalog/runs/jpn-01/manifest.tsv flags column);
  - the mes-ballcourt room type (I plan: cells, floors, end walls, ball and centre line).
Refuses if anything else of main's would change."""
import json, subprocess, sys
REF = sys.argv[1] if len(sys.argv) > 1 else 'main'
L = 'tools/spawn-tuner/data/library.json'; R = 'tools/spawn-tuner/data/rooms.json'
show = lambda p: json.loads(subprocess.run(['git', 'show', f'{REF}:{p}'], capture_output=True, text=True, check=True).stdout)
NEW_FLATS = {'decal-mes-court-line'}
SLIDES = {'door-panelled--jpn-fusuma-leaf', 'door-plank--jpn-koshido-leaf'}
ROOMS = {'mes-ballcourt'}

base, built = show(L), json.load(open(L))
bo, mo = base['objects'], built['objects']
mine = lambda s: s.get('src') == 'croof-01' or s['sku'] in NEW_FLATS
n_obj = n_sku = n_flag = 0
for oid, o in mo.items():
    ours = [s for s in o['skus'] if mine(s)]
    if oid not in bo:
        if not ours: continue
        if len(ours) != len(o['skus']): sys.exit(f'REFUSING: {oid} is new here but not all its skus are this lane\'s')
        bo[oid] = o; n_obj += 1; n_sku += len(ours); continue
    if ours:
        have = {s['sku'] for s in ours}
        bo[oid]['skus'] = sorted([s for s in bo[oid]['skus'] if s['sku'] not in have] + ours, key=lambda s: s['sku']); n_sku += len(ours)
    for s in o['skus']:
        if s['sku'] in SLIDES and s.get('slides'):
            for t in bo[oid]['skus']:
                if t['sku'] == s['sku'] and not t.get('slides'):
                    # keep build_data.py's key order: 'slides' right after 'piece'
                    items = list(t.items()); i = [k for k, _ in items].index('piece') + 1 if 'piece' in t else len(items)
                    t.clear(); t.update(items[:i] + [('slides', True)] + items[i:]); n_flag += 1
base['objects'] = dict(sorted(bo.items(), key=lambda kv: min(s['sku'] for s in kv[1]['skus'])))

# the check: against main, only additions of this lane's skus/objects and the slides flags
m0 = show(L)['objects']
for oid, o in m0.items():
    got = base['objects'][oid]; gs = {s['sku']: s for s in got['skus']}
    for s in o['skus']:
        t = dict(gs[s['sku']]); t.pop('slides', None) if s['sku'] in SLIDES else None
        if t != s: sys.exit(f'REFUSING: {s["sku"]} of main would change')
    if {k: v for k, v in o.items() if k != 'skus'} != {k: v for k, v in got.items() if k != 'skus'}: sys.exit(f'REFUSING: {oid} fields would change')
json.dump(base, open(L, 'w'), indent=1)

rooms_m, rooms_b = show(R), {r['key']: r for r in json.load(open(R))}
out = [rooms_b[r['key']] if r['key'] in ROOMS else r for r in rooms_m]
json.dump(out, open(R, 'w'), indent=1)
print(f'library: {REF} + {n_obj} objects, {n_sku} skus of this lane, {n_flag} slides flags; rooms: {REF} with {sorted(ROOMS)} from the build')

#!/usr/bin/env python3
"""data/library.json, data/rooms.json, data/factions.json = REF's committed files + this batch's additions only (faith
factions, 2026-11-07). Run from the repo root AFTER tools/spawn-tuner/build_data.py. Why (the cultures-a lesson): a
local build silently drops every sku whose binaries are not on this machine (on 2026-11-07, the sprawl batch's 87), so a
generated file is never committed from a raw rebuild. This takes REF's files and adds exactly:
  library.json  the faiths' skus (src fth-01 / fth-flats-01) in existing objects, the new faith roles (objects all
                of whose skus are the faiths'), and the `factions` / `flavorSlots` metadata as this build makes it;
  rooms.json    the `rite` flag on the room types this build marks;
  factions.json this build's (it lists faction skus only: no other batch's skus are in it).
Refuses if REF and the build disagree on anything else in those objects.
    python3 experiments/2026-11-07-faith-factions/tools/merge_faith.py [REF=HEAD]
Then restore tools/spawn-tuner/prep/{jobs,flats}.json from REF (they carry this machine's absolute paths)."""
import json, subprocess, sys
REF = sys.argv[1] if len(sys.argv) > 1 else 'HEAD'
MINE = ('fth-01', 'fth-flats-01')
show = lambda p: json.loads(subprocess.run(['git', 'show', f'{REF}:{p}'], capture_output=True, text=True, check=True).stdout)
D = 'tools/spawn-tuner/data/'
base, built = show(D + 'library.json'), json.load(open(D + 'library.json'))
bo, mo = base['objects'], built['objects']
for k in base:
    if k not in ('objects', 'factions', 'flavorSlots') and json.dumps(base[k], sort_keys=True) != json.dumps(built[k], sort_keys=True):
        sys.exit(f'REFUSING: library.{k} differs from {REF}')
add_o = add_s = 0
for oid, o in mo.items():
    mine = [s for s in o['skus'] if s.get('src') in MINE]
    if oid not in bo:
        if len(mine) != len(o['skus']): sys.exit(f'REFUSING: {oid} is new here but not all its skus are the faiths\'')
        bo[oid] = o; add_o += 1; add_s += len(mine); continue
    if not mine: continue
    rest = {k: v for k, v in o.items() if k != 'skus'}; brest = {k: v for k, v in bo[oid].items() if k != 'skus'}
    if json.dumps(rest, sort_keys=True) != json.dumps(brest, sort_keys=True): sys.exit(f'REFUSING: object {oid} differs from {REF} beyond its skus')
    ours = {s['sku'] for s in mine}
    bo[oid]['skus'] = sorted([s for s in bo[oid]['skus'] if s['sku'] not in ours] + mine, key=lambda s: s['sku']); add_s += len(mine)
base['objects'] = dict(sorted(bo.items(), key=lambda kv: min(s['sku'] for s in kv[1]['skus'])))
base['factions'], base['flavorSlots'] = built['factions'], built['flavorSlots']
json.dump(base, open(D + 'library.json', 'w'), indent=1)
rb, rm = show(D + 'rooms.json'), {r['key']: r for r in json.load(open(D + 'rooms.json'))}
rites = 0
for i, r in enumerate(rb):
    n = rm.get(r['key'])
    if n and n.get('rite'):
        if json.dumps({k: v for k, v in n.items() if k != 'rite'}, sort_keys=True) != json.dumps({k: v for k, v in r.items() if k != 'rite'}, sort_keys=True): sys.exit(f'REFUSING: room type {r["key"]} differs from {REF} beyond rite')
        rb[i] = n; rites += 1  # (the build's record: its key order)
json.dump(rb, open(D + 'rooms.json', 'w'), indent=1)
print(f'library: +{add_o} faith roles, +{add_s} faith skus onto {REF}; factions metadata from this build; rooms: rite on {rites} types')

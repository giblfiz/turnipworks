#!/usr/bin/env python3
"""data/library.json and data/rooms.json = REF's committed files + the vehicles batch (run from the repo root, AFTER
tools/spawn-tuner/build_data.py). The culture and cyberpunk lanes' method (../2026-11-07-cyberpunk-rooms/integration/merge_lib.py):
main's library.json carries skus whose GLBs are on no machine any more (the City pack's), so a local build drops them;
this batch's objects (src vehicles-03, all new roles) are ADDED to REF's file, nothing of REF's is changed.
Rooms: REF's rooms.json, unchanged, except that each room in build_data.VEH_ROOMS gets its `vehicles` slot (the ids of its
catalog/rooms-vehicles.md recipe that the merged library has, and that the room's tiers can show) and the recipe in
`borrow`. So whatever another lane did to those rooms (density, slots, programs) is kept: run this after any merge.
Refuses if REF's and the local build's non-object keys disagree.
    python3 experiments/2026-11-07-vehicles/integration/merge_lib.py [REF=main]"""
import json, re, subprocess, sys
from pathlib import Path
REF = sys.argv[1] if len(sys.argv) > 1 else 'main'
MINE = ('vehicles-03', 'moddesk-03')  # the vehicles, and Harry's cameras and desk things (catalog/objects-modern-desk.catalog.md)
show = lambda p: json.loads(subprocess.run(['git', 'show', f'{REF}:{p}'], capture_output=True, text=True, check=True).stdout)
L = 'tools/spawn-tuner/data/library.json'; R = 'tools/spawn-tuner/data/rooms.json'
base, built = show(L), json.load(open(L))
bo, mo = base['objects'], built['objects']
for k in base:
    if k != 'objects' and json.dumps(base[k], sort_keys=True) != json.dumps(built[k], sort_keys=True): sys.exit(f'REFUSING: {k} differs from {REF}')
added = []
for oid, o in mo.items():
    mine = [s for s in o['skus'] if s.get('src') in MINE]
    if not mine: continue
    if len(mine) != len(o['skus']): sys.exit(f"REFUSING: {oid} has skus of this batch and others' (every vehicles role is new)")
    if oid in bo and any(s.get('src') not in MINE for s in bo[oid]['skus']): sys.exit(f'REFUSING: {oid} is in {REF} already with skus of its own')
    bo[oid] = o; added.append(oid)
base['objects'] = dict(sorted(bo.items(), key=lambda kv: min(s['sku'] for s in kv[1]['skus'])))
json.dump(base, open(L, 'w'), indent=1)
# rooms: the Vehicles slot on REF's room types
src = Path('tools/spawn-tuner/build_data.py').read_text()
m = re.search(r"^VEH_ROOMS = (\{.*?\})", src, re.S | re.M); VEH_ROOMS = eval(m.group(1))
rec, cur = {}, None
for line in open('catalog/rooms-vehicles.md'):
    mm = re.match(r'^### (veh-[a-z-]+) P[123]$', line.strip())
    if mm: cur = rec.setdefault(mm.group(1), {}); continue
    mm = re.match(r'^- ([a-z]+): (.+)$', line.strip())
    if mm and cur is not None: cur[mm.group(1)] = [x.strip() for x in mm.group(2).split(',')]
rooms = show(R); seen = set(); slots_n = 0
for r in rooms:
    rid = VEH_ROOMS.get(r['key'])
    if not rid: continue
    seen.add(r['key'])
    vis = lambda i: i in bo and bo[i]['skus'] and (not bo[i].get('only') or any(t in bo[i]['only'] for t in r.get('tiers', [])))
    r['borrow'] = [b for b in r.get('borrow', []) if b != rid] + [rid]
    for slot, want in rec[rid].items():
        ids = [i for i in want if vis(i)]
        if slot == 'vehicles':  # (its own slot: set, so a rerun after the recipe changed is exact)
            if ids: r['slots']['vehicles'] = ids
            else: r['slots'].pop('vehicles', None)
        else:  # (a slot the room has already, the dress slot: this batch's things are added after REF's own)
            cur = r['slots'].setdefault(slot, []); cur += [i for i in ids if i not in cur]
        slots_n += len(ids)
        miss = [i for i in want if not vis(i)]
        if miss: print(f"  {r['key']} {slot}: not on its shelves (no mesh it can show): {miss}")
json.dump(rooms, open(R, 'w'), indent=1)
lost = sorted(set(VEH_ROOMS) - seen)
print(f'library: +{len(added)} objects of this batch onto {REF} ({", ".join(sorted(added))}); rooms: {len(seen)} borrow a recipe of catalog/rooms-vehicles.md, {slots_n} things in their slots'
      + (f'; NOT in {REF}\'s rooms.json: {lost}' if lost else ''))

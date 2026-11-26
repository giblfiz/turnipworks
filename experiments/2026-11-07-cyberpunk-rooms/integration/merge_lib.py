#!/usr/bin/env python3
"""data/library.json and data/rooms.json = main's committed files + this batch's additions (run from the repo root, AFTER
tools/spawn-tuner/build_data.py). The culture lanes' method (experiments/2026-11-06-cultures-a/tools/merge_lib.py): main's
library.json carries wave 1's (sprawl-01) skus whose GLBs are on no machine any more, so a local build drops them; this
batch's skus (src cyberpunk-02, cyberpunk-flats-02) are added to main's file as build_data.py would place them, nothing of
main's is changed. Rooms: the Cyberpunk room types are added (or replaced), their slots worked out against the MERGED
library from the recipes in catalog/rooms-cyberpunk.md (a local build calls wave 1's roles "missing": table-cafe ...).
Refuses if main's and the local build's non-object keys disagree.
    python3 experiments/2026-11-07-cyberpunk-rooms/integration/merge_lib.py [main]"""
import json, re, subprocess, sys
REF = sys.argv[1] if len(sys.argv) > 1 else 'main'
MINE = ('cyberpunk-02', 'cyberpunk-flats-02')
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
        if not mine: continue
        if len(mine) != len(o['skus']): sys.exit(f"REFUSING: {oid} is new here but not all its skus are this batch's")
        bo[oid] = o; added_obj += 1; added_sku += len(mine); continue
    if not mine: continue
    ours = {s['sku'] for s in mine}
    bo[oid]['skus'] = sorted([s for s in bo[oid]['skus'] if s['sku'] not in ours] + mine, key=lambda s: s['sku']); added_sku += len(mine)
    # (a shared role with a wave-2 look: its `only` is main's and the build's together, e.g. sign-neon ['cyb', 'mod']; the local
    # build saw only the cyb looks, main's file only wave 1's mod one)
    if 'only' in o or 'only' in bo[oid]: bo[oid]['only'] = sorted(set(bo[oid].get('only', [])) | set(o.get('only', [])))
    if 'hung' in o and 'hung' not in bo[oid]: bo[oid]['hung'] = o['hung']
base['objects'] = dict(sorted(bo.items(), key=lambda kv: min(s['sku'] for s in kv[1]['skus'])))
json.dump(base, open(L, 'w'), indent=1)
# rooms: ours, with slots against the merged library
rec, cur = {}, None
for line in open('catalog/rooms-cyberpunk.md'):
    m = re.match(r'^### (cyb-[a-z-]+) ', line)
    if m: cur = rec.setdefault(m.group(1), {}); continue
    m = re.match(r'^- (\w+): (.+)$', line.strip())
    if m and cur is not None: cur[m.group(1)] = [x.strip() for x in m.group(2).split(',')]
rb, rm = show(R), json.load(open(R))
ours = [r for r in rm if r['key'].startswith('cyb-')]
have = lambda i: i in bo and bool(bo[i]['skus'])
for r in ours:
    slots, miss = {}, []
    for slot, ids in rec.get(r['key'], {}).items():
        for i in ids: (slots.setdefault(slot, []).append(i) if have(i) else miss.append(i))
    r['slots'] = slots; r['missing'] = sorted(miss)
keys = {r['key'] for r in ours}
json.dump([r for r in rb if r['key'] not in keys] + ours, open(R, 'w'), indent=1)
print(f'library: +{added_obj} objects, +{added_sku} cyberpunk skus onto {REF}; rooms: {len(ours)} Cyberpunk room types; missing: {sum(len(r["missing"]) for r in ours)} {[(r["key"], r["missing"]) for r in ours if r["missing"]]}')

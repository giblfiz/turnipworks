#!/usr/bin/env python3
"""Build launcher types (Harry 2026-10-03: genre → type → room → furniture → object).

Types are the catalog's setting codes (TAV, NOB, CAS…). This turns catalog/out/by-setting/*.txt into
engine/client/data/types.json: [{code, genre, slug, label, roles: [role ids], signature: [role ids]}]. A role in several
settings is listed under each (the catalog's multi-set membership is the menu's symlink mechanism). Rooms are joined
at runtime from the tuner's rooms.json (a room's recipes 'tav-…' name its type), and only roles the live library
actually has are shown, so this file can list roles that have no mesh yet.
    python3 engine/tools/build_types.py      (both deploy scripts run it, and src/catalog_tool.py runs it whenever it rewrites
    catalog/out, so this derived file changes in the same step as its source: commit it with catalog/out)
"""
import json, os, re, glob
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
LABELS = {  # the player-facing names of the settings (genre: fantasy, the only one so far)
    'TAV': 'Tavern & inn', 'NOB': 'Mansion', 'CAS': 'Castle', 'TEM': 'Temple & chapel', 'DUN': 'Dungeon & prison',
    'CRY': 'Crypt & tomb', 'ARC': "Wizard's tower", 'CLT': 'Cult sanctum', 'CMP': 'Wilderness camp', 'GRV': 'Fey grove',
    'HUT': 'Farmstead', 'LAI': 'Monster lair', 'MIN': 'Mine', 'MKT': 'Market & village', 'RUI': 'Ruins', 'SMI': 'Smithy & workshop',
}
LINE = re.compile(r'^(!)?\s*P\d\s+([a-z0-9][a-z0-9-]*)\s+\[')
out = []
for f in sorted(glob.glob(os.path.join(REPO, 'catalog', 'out', 'by-setting', '*.txt'))):
    lines = open(f).read().splitlines()
    m = re.match(r'^([A-Z]{3}) — ([a-z-]+):', lines[0])
    if not m: continue
    code, slug = m.groups()
    roles, sig = [], []
    for l in lines[1:]:
        mm = LINE.match(l)
        if mm:
            roles.append(mm.group(2))
            if mm.group(1): sig.append(mm.group(2))
    out.append({'code': code, 'genre': 'fantasy', 'slug': slug, 'label': LABELS.get(code, slug.replace('-', ' ').capitalize()), 'roles': roles, 'signature': sig})
order = ['TAV', 'NOB', 'CAS', 'TEM', 'SMI', 'MKT', 'HUT', 'DUN', 'CRY', 'ARC', 'CLT', 'MIN', 'RUI', 'LAI', 'CMP', 'GRV']
out.sort(key=lambda t: order.index(t['code']) if t['code'] in order else 99)
dst = os.path.join(REPO, 'engine', 'client', 'data', 'types.json')
def write(path, obj):  # only when the bytes change: a deploy with no new type or role leaves the tracked file untouched
    new = json.dumps(obj, separators=(',', ':'))
    if not os.path.exists(path) or open(path).read() != new: open(path, 'w').write(new)
write(dst, {'genres': [{'key': 'fantasy', 'label': 'Fantasy'}], 'types': out})
# the Spawn Tuner groups its room palette by the same types, in the same order, under the same names (2026-10-12): a
# slim copy (no roles) beside its rooms.json; a room's first recipe ('tav-common-room') names its type, as in the Build tray
slim = os.path.join(REPO, 'tools', 'spawn-tuner', 'data', 'types.json')
write(slim, [{'code': t['code'], 'label': t['label'], 'slug': t['slug']} for t in out])
print(f'{len(out)} types, {sum(len(t["roles"]) for t in out)} role links -> {os.path.relpath(dst, REPO)} ({os.path.getsize(dst) // 1024} KB)')

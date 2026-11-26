#!/usr/bin/env python3
"""Build launcher types (Harry 2026-10-03: genre → type → room → furniture → object).

Types are the catalog's setting codes (TAV, NOB, CAS…). This turns catalog/out/by-setting/*.txt into
engine/client/data/types.json: [{code, genre, slug, label, roles: [role ids], signature: [role ids]}]. A role in several
settings is listed under each (the catalog's multi-set membership is the menu's symlink mechanism). Rooms are joined
at runtime from the tuner's rooms.json (a room's recipes 'tav-…' name its type), and only roles the live library
actually has are shown, so this file can list roles that have no mesh yet.
    python3 engine/tools/build_types.py      (both deploy scripts run it, and src/catalog_tool.py runs it whenever it rewrites
    catalog/out, so this derived file changes in the same step as its source: commit it with catalog/out)
MODERN IS BUILDINGS (Harry 2026-11-07: "types should be kinds of *building* not kinds of sub-genre (look at how fantasy got
done)"): the catalog's MOD and CYB codes are not types. engine/tools/modern_buildings.json lists the Modern genre's
buildings and, per modern room, the buildings it is in (a new modern room is ONE line there). A building type carries its
`rooms` (room keys: the Build tray joins those, not a recipe prefix), its `hub`, and the MOD / CYB roles its rooms name
(tools/spawn-tuner/data/rooms.json slots and floors, client/data/library-spawns.json), plus the pool's roles no modern
room names (so a thing no room lists still has a modern shelf). types.json's `legacy` maps an old building's code.
"""
import json, os, re, glob
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
LABELS = {  # the player-facing names of the settings
    'TAV': 'Tavern & inn', 'NOB': 'Mansion', 'CAS': 'Castle', 'TEM': 'Temple & chapel', 'DUN': 'Dungeon & prison',
    'CRY': 'Crypt & tomb', 'ARC': "Wizard's tower", 'CLT': 'Cult sanctum', 'CMP': 'Wilderness camp', 'GRV': 'Fey grove',
    'HUT': 'Farmstead', 'LAI': 'Monster lair', 'MIN': 'Mine', 'MKT': 'Market & village', 'RUI': 'Ruins', 'SMI': 'Smithy & workshop',
    'MOD': 'City', 'CYB': 'Cyberpunk',  # the catalog's modern codes (the cyberpunk pack, waves 1 and 2); NOT types since 2026-11-07: the buildings in modern_buildings.json are
    # culture packs B (2026-11-06): genre `cultures` (GENRE_OF)
    'NRS': 'Norse steading', 'MDE': 'Middle East (Mamluk)', 'RUS': "Medieval Rus'", 'MES': 'Mexica (Aztec)',
}
# genre of a setting code; every code not listed is fantasy. The genres list is in menu order (fantasy first: the Build
# tray opens on the first genre, engine/client/surfaces/build.js). Modern: the cyberpunk pack's codes (their buildings: modern_buildings.json); Regional (key 'cultures'): the culture packs (2026-11-06).
GENRE_OF = {'MOD': 'modern', 'CYB': 'modern', 'NRS': 'cultures', 'MDE': 'cultures', 'RUS': 'cultures', 'MES': 'cultures'}
GENRES = [{'key': 'fantasy', 'label': 'Fantasy'}, {'key': 'modern', 'label': 'Modern'}, {'key': 'cultures', 'label': 'Regional'}]  # (label 'Regional': Harry 2026-11-07; the key stays)
LABELS['JPN'] = 'Japan'; GENRE_OF['JPN'] = 'cultures'  # culture packs A
LABELS['CHN'] = 'China'; GENRE_OF['CHN'] = 'cultures'  # culture packs A
LABELS['IND'] = 'India'; GENRE_OF['IND'] = 'cultures'  # culture packs A
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
    out.append({'code': code, 'genre': GENRE_OF.get(code, 'fantasy'), 'slug': slug, 'label': LABELS.get(code, slug.replace('-', ' ').capitalize()), 'roles': roles, 'signature': sig})
# ---- the Modern genre's buildings (modern_buildings.json): the MOD / CYB codes' roles, regrouped by the rooms that name them
MB = json.load(open(os.path.join(HERE, 'modern_buildings.json')))
pool = [t for t in out if t['code'] in MB['replaces']]
out = [t for t in out if t['code'] not in MB['replaces']]
pool_roles = list(dict.fromkeys(r for t in pool for r in t['roles'])); pool_sig = {r for t in pool for r in t['signature']}
def read_json(*parts):
    try: return json.load(open(os.path.join(REPO, *parts)))
    except (OSError, ValueError): return None
ROOMS = {r['key']: r for r in read_json('tools', 'spawn-tuner', 'data', 'rooms.json') or []}
SPAWNS = (read_json('engine', 'client', 'data', 'library-spawns.json') or {}).get('rooms', {})
def named(key):  # what a room's recipe, floors and rules name
    r = ROOMS.get(key, {})
    return {i for k, ids in (r.get('slots') or {}).items() if k != 'sets' for i in ids} | set(r.get('floors') or []) | set(SPAWNS.get(key, []))
codes = {b['code'] for b in MB['buildings']}
for room, bs in MB['rooms'].items():
    for c in bs:
        if c not in codes: raise SystemExit(f'engine/tools/modern_buildings.json: room {room} names building {c}, which is not in its buildings')
modern_prefix = tuple(c.lower() + '-' for c, g in GENRE_OF.items() if g == 'modern')
unmapped = [k for k, r in ROOMS.items() if any(x.startswith(modern_prefix) for x in r.get('recipes') or []) and k not in MB['rooms']]
if unmapped: print(f'WARNING: modern room(s) in no building, so not in the Build menu: {", ".join(unmapped)} (add a line each to engine/tools/modern_buildings.json `rooms`)')
anywhere = set().union(*(named(k) for k in MB['rooms'])) if MB['rooms'] else set()
for b in MB['buildings']:
    rooms = [k for k, bs in MB['rooms'].items() if b['code'] in bs]
    if b.get('hub') in rooms: rooms = [b['hub']] + [k for k in rooms if k != b['hub']]
    mine = set().union(*(named(k) for k in rooms)) if rooms else set()
    roles = [r for r in pool_roles if r in mine or r not in anywhere]
    out.append({'code': b['code'], 'genre': 'modern', 'slug': b['slug'], 'label': b['label'], 'rooms': rooms, **({'hub': b['hub']} if b.get('hub') else {}), **({'hall': b['hall']} if b.get('hall') else {}), **({'lift': True} if b.get('lift') else {}),
                'roles': roles, 'signature': [r for r in roles if r in pool_sig and r in mine]})
order = ['TAV', 'NOB', 'CAS', 'TEM', 'SMI', 'MKT', 'HUT', 'DUN', 'CRY', 'ARC', 'CLT', 'MIN', 'RUI', 'LAI', 'CMP', 'GRV', *[b['code'] for b in MB['buildings']], 'NRS', 'MDE', 'RUS', 'MES', 'JPN', 'CHN', 'IND']
out.sort(key=lambda t: order.index(t['code']) if t['code'] in order else 99)
dst = os.path.join(REPO, 'engine', 'client', 'data', 'types.json')
def write(path, obj):  # only when the bytes change: a deploy with no new type or role leaves the tracked file untouched
    new = json.dumps(obj, separators=(',', ':'))
    if not os.path.exists(path) or open(path).read() != new: open(path, 'w').write(new)
GENRES = [{**g, 'pack': MB['pack']['slug'], 'was': MB['pack']['was']} if g['key'] == 'modern' else g for g in GENRES]  # (the assets page's one Modern pack, and the old links' slugs)
write(dst, {'genres': [g for g in GENRES if any(t['genre'] == g['key'] for t in out)], 'types': out, 'legacy': MB['legacy']})  # (legacy: an old saved building's type code -> the type that re-rolls it)
# the Spawn Tuner groups its room palette by the same types, in the same order, under the same names (2026-10-12): a
# slim copy (no roles) beside its rooms.json; a room's first recipe ('tav-common-room') names its type, as in the Build tray
slim = os.path.join(REPO, 'tools', 'spawn-tuner', 'data', 'types.json')
write(slim, [{'code': t['code'], 'label': t['label'], 'slug': t['slug'], **({'rooms': t['rooms']} if 'rooms' in t else {})} for t in out])  # (rooms: a modern building's own list; the tuner groups those rooms by it)
print(f'{len(out)} types, {sum(len(t["roles"]) for t in out)} role links -> {os.path.relpath(dst, REPO)} ({os.path.getsize(dst) // 1024} KB)')

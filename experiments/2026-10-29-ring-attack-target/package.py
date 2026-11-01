#!/usr/bin/env python3
"""Package the new ring pictures exactly as the 2026-10-15 pipeline does, and add them to its manifest.

  python3 package.py

Uses experiments/2026-10-15-ring-icons/tools/process.py's own prepare() (native alpha kept, transparent square padding,
Lanczos to the fifteen sizes, lossless WebP, provenance, the neutral 31 px candidate.png on the ring ground). Then:
  - plan-additions.json's pictures go into that batch's plan.json and inventory.json (replacing earlier copies);
  - their variants go into tools/spawn-tuner/assets/ui-icons/manifest.json, every other action left byte-identical.
The blind read is NOT the 10-15 paid call (gemini-vision.py, blocked since 2026-10-20): blind_read.py writes
result.json from agy-run (the Gemini subscription) into the same read directory; review decisions live in review.json.
"""
import hashlib, json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
BATCH = REPO / 'experiments/2026-10-15-ring-icons'
sys.path.insert(0, str(BATCH / 'tools'))
import process as P  # noqa: E402
sys.path.insert(0, str(HERE)); from r3refs import refs_of  # noqa: E402

adds = json.loads((HERE / 'plan-additions.json').read_text())['pictures']
key = lambda p: (p['set'], p['id'], int(p.get('alt', 0)))
new = {key(p) for p in adds}
for p in adds:
    if p.get('references') or p.get('refs'): p['references'] = refs_of(p); p['refs'] = p['references']

plan = json.loads((BATCH / 'plan.json').read_text())
plan['pictures'] = [p for p in plan['pictures'] if key(p) not in new] + adds
P.atomic_json(BATCH / 'plan.json', plan)

inv = json.loads((BATCH / 'inventory.json').read_text())
ids = {p['id'] for p in adds}
inv = [r for r in inv if r['id'] not in ids] + [
    {'id': 'pawn.attack', 'title': 'Attack', 'kinds': ['pawn'], 'current_icon': 'swords', 'picture': 'attack', 'surface': 'ring',
     'note': '2026-10-29: a pawn linked to a D&D Beyond sheet with Beyond20 at the table (engine/client/surfaces/beyond20.js).'},
    {'id': 'pawn.target', 'title': 'Target', 'kinds': ['pawn'], 'current_icon': 'crosshair', 'picture': 'target', 'surface': 'ring',
     'note': '2026-10-29: aim your pawn at this one (engine/client/surfaces/target.js); same reticle as the table decal.'}]
(BATCH / 'inventory.json').write_text(json.dumps(inv, indent=2))  # (its own existing format: ASCII, no final newline)

titles, sizes, ground = P.load_inventory(BATCH / 'inventory.json')
reviews = json.loads((BATCH / 'review.json').read_text())
manifest_path = P.ASSETS / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
for pid in ids: manifest['actions'][pid] = {'title': titles.get(pid, pid), 'variants': []}
for pic in sorted(adds, key=lambda p: (p['id'], p['set'] != 'charcoal', p.get('alt', 0))):
    item = P.prepare(pic, sizes, ground)
    if not item: print('missing source:', pic['source']); continue
    rp = item['read_dir'] / 'result.json'
    result = json.loads(rp.read_text()) if rp.exists() else {'status': 'not-read', 'read': ''}
    if result.get('model') in P.BLIND_MODELS:  # (prepare() writes the 10-15 model name; keep the one that actually read it)
        prov = json.loads(item['provenance'].read_text()); prov['blind_model'] = result['model']; P.atomic_json(item['provenance'], prov)
    review = reviews.get(f"{pic['set']}/{P.stem(pic)}", {})
    if review.get('status') in ('accepted', 'learned', 'rejected') and result.get('returncode') == 0:
        result = {**result, 'status': review['status'], 'note': review.get('note', '')}
    variant = {'set': pic['set'], 'alt': int(pic.get('alt', 0)), 'file': item['files']['128'], 'metaphor': pic['metaphor'],
               'sizes': item['files'], 'sha256': item['hashes']['128'],
               'blindRead': {'status': result['status'], 'read': result.get('read', ''), 'note': result.get('note', ''),
                             'evidence': item['read_dir'].relative_to(BATCH).as_posix(),
                             'promptSha256': hashlib.sha256(P.blind_prompt(pic).encode()).hexdigest()}}
    for action in pic['actions']: manifest['actions'][action]['variants'].append(variant)
    print(pic['set'], P.stem(pic), result['status'], item['read_dir'].relative_to(REPO))
P.atomic_json(manifest_path, manifest)

#!/usr/bin/env python3
"""Packaging the aura's ring icons, the round-3 way (experiments/2026-10-29-ring-attack-target/package3.py): the 10-15
process.py prepare() for every plan.json picture whose source exists (native alpha kept, Lanczos to the fifteen sizes,
lossless WebP into tools/spawn-tuner/assets/ui-icons/<set>/, git-ignored; provenance; the 31 px candidate.png), then
  - the pictures into the 10-15 plan.json, the commands into its inventory.json;
  - manifest.json: each picture's variants under its action, with its blind read and review (review.json here).
Every other action is left as it was.
  python3 package.py
"""
import hashlib, json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; REPO = HERE.parents[2]; BATCH = REPO / 'experiments/2026-10-15-ring-icons'
sys.path.insert(0, str(BATCH / 'tools'))
import process as P  # noqa: E402
sys.path.insert(0, str(REPO / 'experiments/2026-10-29-ring-attack-target'))
from r3refs import refs_of  # noqa: E402

KEEP = ('id', 'title', 'actions', 'set', 'alt', 'metaphor', 'prompt', 'source', 'references', 'blind_prompt')
TITLES = {'pawn.aura.': 'Aura', 'pawn.aura.up': 'Aura up', 'pawn.aura.down': 'Aura down', 'pawn.aura.off': 'Aura off',
          **{f'pawn.aura.color.{k}': f'{n} aura' for k, n in [('gold', 'Gold'), ('silver', 'Silver-white'), ('blue', 'Blue'), ('green', 'Green'), ('red', 'Red'), ('violet', 'Violet')]}}
BLIND = ("These are unlabelled buttons in the contextual ring menu around a selected pawn in a browser 3D virtual tabletop. For each "
         "lettered icon: what action does it perform on the selected pawn? Each icon is shown at its real 31-pixel size on the menu's "
         "dark ground (#1c1f24).")
plan_all = json.loads((HERE / 'plan.json').read_text())['pictures']
ready = [p for p in plan_all if (REPO / p['source']).is_file()]
for p in ready: p['references'] = refs_of(p); p['blind_prompt'] = BLIND
reads = json.loads((HERE / 'reads.json').read_text()) if (HERE / 'reads.json').exists() else {}
review = json.loads((HERE / 'review.json').read_text()) if (HERE / 'review.json').exists() else {}
key = lambda p: (p['set'], p['id'], int(p.get('alt', 0)))

plan = json.loads((BATCH / 'plan.json').read_text())
new = {key(p) for p in ready}
plan['pictures'] = [p for p in plan['pictures'] if key(p) not in new] + [{k: p[k] for k in KEEP if k in p} for p in ready]
P.atomic_json(BATCH / 'plan.json', plan)
inv = json.loads((BATCH / 'inventory.json').read_text()); have = {r['id'] for r in inv}
for a in sorted({p['id'] for p in ready}):
    if a not in have: inv.append({'id': a, 'title': TITLES[a], 'kinds': ['pawn'], 'current_icon': '', 'picture': a, 'surface': 'ring', 'note': '2026-10-30 the aura (experiments/2026-10-30-aura/icons): painted'})
(BATCH / 'inventory.json').write_text(json.dumps(inv, indent=2))
titles, sizes, ground = P.load_inventory(BATCH / 'inventory.json')

mp = P.ASSETS / 'manifest.json'; manifest = json.loads(mp.read_text()); A = manifest['actions']
for a in {p['id'] for p in ready}: A[a] = {'title': TITLES[a], 'variants': []}
for pic in sorted(ready, key=lambda p: (p['id'], p['set'] != 'charcoal')):
    item = P.prepare(pic, sizes, ground)
    k = f"{pic['set']}/{pic['id']}"; rd = reads.get(k, {}); rv = review.get(k, {})
    v = {'set': pic['set'], 'alt': 0, 'file': item['files']['128'], 'metaphor': pic['metaphor'], 'sizes': item['files'], 'sha256': item['hashes']['128'],
         'blindRead': {'status': rv.get('status', 'needs-review'), 'read': rd.get('read', ''), 'note': rv.get('note', ''), 'model': rd.get('model', ''),
                       'evidence': 'experiments/2026-10-30-aura/icons/checks', 'promptSha256': hashlib.sha256(BLIND.encode()).hexdigest()}}
    A[pic['id']]['variants'].append(v)
for a in A.values(): a['variants'].sort(key=lambda v: (v['set'] != 'charcoal', v['alt']))
P.atomic_json(mp, manifest)
print(f'packaged {len(ready)}/{len(plan_all)} aura pictures')

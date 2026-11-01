#!/usr/bin/env python3
"""Round 3 packaging, the same way as package.py: the 10-15 process.py prepare() for every plan-round3.json picture whose
source exists (candidates named *.r3 excepted: they are comparisons, not menu pictures), then
  - those pictures into the 10-15 plan.json, the audited commands into its inventory.json;
  - manifest.json: each picture's variants under every action it serves, and aliases-round3.json's commands sharing an
    existing action's variants. Every other action is left as it was.

  python3 package3.py
"""
import hashlib, json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; REPO = HERE.parents[1]; BATCH = REPO / 'experiments/2026-10-15-ring-icons'
sys.path.insert(0, str(BATCH / 'tools'))
import process as P  # noqa: E402
sys.path.insert(0, str(HERE)); from r3refs import refs_of  # noqa: E402
sys.path.insert(0, str(HERE)); from r3common import GROUP_OF, batch_prompt  # noqa: E402

KEEP = ('id', 'title', 'actions', 'set', 'alt', 'metaphor', 'prompt', 'source', 'references', 'blind_prompt')
plan3 = [p for p in json.loads((HERE / 'plan-round3.json').read_text())['pictures'] if not p['id'].endswith('.r3')]
ready = [p for p in plan3 if (REPO / p['source']).is_file()]
for p in ready: p['references'] = refs_of(p); p.pop('refs', None)
for p in plan3: p['blind_prompt'] = batch_prompt(GROUP_OF[p['category']])
aliases = json.loads((HERE / 'aliases-round3.json').read_text())
audit = {r['id']: r for r in json.loads((HERE / 'audit.json').read_text())['missing']}
key = lambda p: (p['set'], p['id'], int(p.get('alt', 0)))

plan = json.loads((BATCH / 'plan.json').read_text())
new = {key(p) for p in ready}
plan['pictures'] = [p for p in plan['pictures'] if key(p) not in new] + [{k: p[k] for k in KEEP if k in p} for p in ready]
for p in plan['pictures']:  # an alias is one more action on the existing picture (10-15's own way of sharing a painting)
    for a, src in aliases.items():
        if src in p['actions'] and a not in p['actions']: p['actions'].append(a)
P.atomic_json(BATCH / 'plan.json', plan)

inv = json.loads((BATCH / 'inventory.json').read_text())
ids = sorted({a for p in plan3 for a in p['actions']} | set(aliases))
have = {r['id'] for r in inv}
for a in ids:
    if a in have: continue
    r = audit.get(a, {})
    pic = next((p['id'] for p in plan3 if a in p['actions']), aliases.get(a))
    inv.append({'id': a, 'title': (r.get('title') or a).replace('✓ ', ''), 'kinds': [], 'current_icon': r.get('icon', ''), 'picture': pic,
                'surface': 'ring', 'note': '2026-10-29 round 3 (experiments/2026-10-29-ring-attack-target): ' + (f'shares {aliases[a]}' if a in aliases else 'painted')})
(BATCH / 'inventory.json').write_text(json.dumps(inv, indent=2))
titles, sizes, ground = P.load_inventory(BATCH / 'inventory.json')

reviews = json.loads((BATCH / 'review.json').read_text())
mp = P.ASSETS / 'manifest.json'; manifest = json.loads(mp.read_text()); A = manifest['actions']
slots = {(p['set'], int(p.get('alt', 0))) for p in ready}
for a in {a for p in ready for a in p['actions']}:  # (an existing action keeps its other alternates, e.g. Prone's alt 1)
    A[a] = {'title': titles.get(a, a), 'variants': [v for v in A.get(a, {}).get('variants', []) if (v['set'], v['alt']) not in {(p['set'], int(p.get('alt', 0))) for p in ready if a in p['actions']}]}
for pic in sorted(ready, key=lambda p: (p['id'], p['set'] != 'charcoal')):
    item = P.prepare(pic, sizes, ground)
    rp = item['read_dir'] / 'result.json'
    result = json.loads(rp.read_text()) if rp.exists() else {'status': 'not-read', 'read': ''}
    if result.get('model') in P.BLIND_MODELS:
        prov = json.loads(item['provenance'].read_text()); prov['blind_model'] = result['model']; P.atomic_json(item['provenance'], prov)
    review = reviews.get(f"{pic['set']}/{P.stem(pic)}", {})
    if review.get('status') in ('accepted', 'learned', 'rejected') and result.get('returncode') == 0:
        result = {**result, 'status': review['status'], 'note': review.get('note', '')}
    v = {'set': pic['set'], 'alt': 0, 'file': item['files']['128'], 'metaphor': pic['metaphor'], 'sizes': item['files'], 'sha256': item['hashes']['128'],
         'blindRead': {'status': result['status'], 'read': result.get('read', ''), 'note': result.get('note', ''),
                       'evidence': item['read_dir'].relative_to(BATCH).as_posix(), 'promptSha256': hashlib.sha256(P.blind_prompt(pic).encode()).hexdigest()}}
    for a in pic['actions']: A[a]['variants'].append(v)
for a, src in aliases.items():
    if A.get(src, {}).get('variants'): A[a] = {'title': titles.get(a, a), 'variants': [dict(v) for v in A[src]['variants']]}
for a in A.values(): a['variants'].sort(key=lambda v: (v['set'] != 'charcoal', v['alt']))
P.atomic_json(mp, manifest)
print(f'packaged {len(ready)}/{len(plan3)} round-3 pictures; aliases {sum(1 for a in aliases if a in A)}')

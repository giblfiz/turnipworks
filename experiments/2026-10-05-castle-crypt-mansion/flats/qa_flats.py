#!/usr/bin/env python3
"""Stage-2 keyed flats: measure (check.py), Gemini blind read, then Gemini match against the designer's own description
(castle/flats.json, mansion/flats.json). Prints one block per sku; reads are saved in raw/gemini/.
    python3 qa_flats.py sku,sku,..."""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); B = os.path.dirname(HERE)
D = {}
for t in ('castle', 'mansion'):
    for f in json.load(open(f'{B}/{t}/flats.json'))['flats']: D[f['id']] = f['desc']
MAP = {'tapestry--s3': ('tapestry', 'this is shape (s1) of the description: the verdure'), 'tapestry--s4': ('tapestry', 'this is shape (s2) of the description: the formal garden'),
       'painting-still-life--s1': ('painting-still-life', 'this is (s1)'), 'painting-still-life--s2': ('painting-still-life', 'this is (s2)'),
       'decal-blood--s1': ('decal-blood', 'one of the two shapes'), 'decal-blood--s2': ('decal-blood', 'one of the two shapes')}
EXTRA = ' Hard rules for every asset: no text or letters; no blue or purple anywhere (also not as specks or a fringe at the edges); no recognisable real people, no figures; hand-painted game art, not photographic. Soft painted fold shading and a little cloth or frame volume are wanted and are NOT a fault ("plain colour fields" only means: no emblem or device on the cloth). Dark shadow in the gaps between hanging loops and the rod is fine. Sizes in inches are measured separately: do not judge proportions.'
for n in sys.argv[1].split(','):
    if not os.path.exists(f'{HERE}/decals/{n}.jpg'): print('===', n, 'MISSING'); continue
    print('===', n, flush=True); print(subprocess.run(['python3', 'check.py', n], cwd=HERE, capture_output=True, text=True).stdout.strip(), flush=True)
    imgs = [f'raw/checks/{n}-cut-on-white.jpg'] + ([f'raw/checks/{n}-on-floor.jpg'] if os.path.exists(f'{HERE}/raw/checks/{n}-on-floor.jpg') else [])
    r = subprocess.run(['python3', '~/fauna-tools/gemini-vision.py', 'gemini-2.5-pro', 'raw/prompts/decal-blind.txt'] + imgs, cwd=HERE, capture_output=True, text=True).stdout
    open(f'{HERE}/raw/gemini/{n}.blind.txt', 'w').write(r); print(r.strip(), flush=True)
    k, note = MAP.get(n, (n, '')); spec = D[k] + (f' ({note}.)' if note else '') + EXTRA + ' (Images: the asset after background removal, on white' + ('; then laid on a stone floor at scale.)' if len(imgs) > 1 else '.)')
    r = subprocess.run(['./match.sh', n, spec] + imgs, cwd=HERE, capture_output=True, text=True).stdout
    print('--- match\n' + r.strip(), flush=True)

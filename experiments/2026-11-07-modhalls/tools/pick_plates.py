#!/usr/bin/env python3
"""Pick the best of several candidate plates per id (the SDXL seeds: sdxl-matted/<id>--s<k>.png) by the plate gate's own
BLIND read (three candidates in one agy call, as gate_plates.py does) and its MATCH step (one text call for all), then copy
the first matching candidate with the widest margin to plates/<id>.png, ready for tools/gate_plates.py.
    python3 tools/pick_plates.py SRC_DIR ID [ID ...]"""
import json, shutil, sys
from datetime import datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import gate_plates as G
B = G.B; src = Path(sys.argv[1]); ids = sys.argv[2:]
rec = {}
for i in ids:
    cands = sorted(src.glob(f'{i}--*.png')); d = B / 'work' / f'pick-{datetime.now():%H%M%S}-{i}'; d.mkdir(parents=True)
    names = {}
    for k, c in zip('abc', cands): G.small(c, d / f'{k}.jpg'); names[f'{k}.jpg'] = c
    r, raw = G.agy(d, G.BLIND.format(files=', '.join(names)))
    (d / 'answer.txt').write_text(raw)
    for f, c in names.items(): rec[c.stem] = {'path': c, 'id': i, 'blind': (r or {}).get(f) or {}, 'measure': G.measure(c)}
items = '\n'.join(f"- {k}: requested: {G.A[v['id']]['gate']['desc']}. Observer said: {json.dumps(v['blind'])}" for k, v in rec.items())
m, raw = G.agy(B / 'work', G.MATCH.format(items=items))
for i in ids:
    good = [v for k, v in rec.items() if v['id'] == i and (m or {}).get(k, {}).get('ok') and v['measure']['ok'] and not [t for t in (v['blind'].get('text') or []) if str(t).strip().lower() not in ('', 'none', 'no text', 'n/a')]]
    good.sort(key=lambda v: -v['measure'].get('margin_px', 0))
    for k, v in rec.items():
        if v['id'] == i: print(k, 'OK' if v in good else 'no', '|', v['blind'].get('object'), '/', v['blind'].get('era'), (m or {}).get(k, {}).get('problems'))
    if good: shutil.copy2(good[0]['path'], B / 'plates' / f'{i}.png'); print('PICK', i, good[0]['path'].name)
    else: print('NONE', i)

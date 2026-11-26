#!/usr/bin/env python3
"""gate-manifest.json from the batched blind plate reads (tools/plate_read.py -> work/plate-reads/*/read.json) and the
match decided by hand in work/plate-match.json ({id: {"match": true|false, "why": "..."}}): a plate is `accepted` when
Gemini read no text on it, it is whole and single, and the hand match says the blind name is the wanted thing.
    python3 tools/gate_from_reads.py"""
import json
from pathlib import Path
B = Path(__file__).resolve().parent.parent
reads = {}
for p in sorted((B / 'work/plate-reads').glob('*/read.json')): reads.update(json.loads(p.read_text()))
match = json.loads((B / 'work/plate-match.json').read_text())
gm = B / 'gate-manifest.json'; out = json.loads(gm.read_text()) if gm.exists() else {'assets': {}}
for i, r in reads.items():
    m = match.get(i)
    if m is None: continue
    ok = not r.get('text') and r.get('whole') and r.get('single', True) and m['match']
    out['assets'][i] = {'status': 'accepted' if ok else 'rejected', 'blind': r, 'match': m}
gm.write_text(json.dumps(out, indent=1) + '\n')
print({i: a['status'] for i, a in out['assets'].items()})

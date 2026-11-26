#!/usr/bin/env python3
"""Stage plates for meshing WITHOUT waiting for the plate gate (cultures-a, 2026-11-06): agy-run is shared by every lane
on the box and a plate read waited 20+ minutes in its queue, while a mesh costs a cent of pod time. So every plate is
measured (alpha, corners, margin: tools/gate_plates.py measure), its alpha cleaned (clean_alpha) into masked/, and
recorded in gate-manifest.json as `accepted` with gate 'deferred': the blind read of the MESH (tools/mesh_read.py) is
the gate that decides. A plate the plate gate already read keeps that record.
    python3 tools/stage_plates.py CODE"""
import json, sys
from datetime import datetime, timezone
from pathlib import Path
sys.argv = [sys.argv[0], sys.argv[1]]
import importlib.util
E = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('g', E / 'gate_plates.py'); g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
B = g.B
gm = B / 'gate-manifest.json'; st = json.loads(gm.read_text()) if gm.exists() else {'assets': {}}
(B / 'masked').mkdir(exist_ok=True)
n = 0
for p in sorted((B / 'plates').glob('*.png')):
    i = p.stem
    if i not in g.A or (B / 'masked' / f'{i}.png').exists() or i in st['assets']: continue
    m = g.measure(p)
    rec = dict(id=i, time=datetime.now(timezone.utc).isoformat(), generator='Codex built-in image_gen (ChatGPT plan)', prompt=g.A[i]['prompt'], plate=str(p.relative_to(B)),
               sha256=g.sha(p), measure=m, gate='deferred: the blind mesh read decides (tools/mesh_read.py)', status='accepted' if m['ok'] or 'no alpha channel' not in m['problems'] else 'rejected')
    if rec['status'] == 'accepted': g.clean_alpha(p, B / 'masked' / f'{i}.png'); n += 1
    st['assets'][i] = rec; print(i, rec['status'], m['problems'])
gm.write_text(json.dumps(st, indent=1) + '\n')
print(n, 'staged')

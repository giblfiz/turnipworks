#!/usr/bin/env python3
"""The RunPod side (pod/tools: the openmesh pod tools, renamed tw-pawns-fly / pawnsfly):
    python3 pod_prep.py prep [ids...]     pod/flies/{masked,gate-manifest.json}: every accepted plate with no mesh yet (or the ids)
    python3 pod_prep.py home              pod/flies/models/<id>.glb -> models/<id>-fly.glb (new or changed only)
Then:  cd pod && PIPE=1024_cascade TEX=2048 tools/launch_wave.sh flies auto auto ; tools/wait_wave.sh flies auto auto ;
       tools/harvest.sh flies auto auto ; tools/pod_down.sh"""
import json, shutil, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import HERE

T = HERE / 'pod' / 'flies'
if sys.argv[1] == 'prep':
    (T / 'masked').mkdir(parents=True, exist_ok=True)
    gate = json.loads((HERE / 'gate.json').read_text())
    ids = sys.argv[2:] or [i for i, r in gate.items() if r.get('status') == 'accepted' and not (HERE / 'models' / f'{i}-fly.glb').exists()]
    for i in ids: shutil.copy2(HERE / 'masked' / f'{i}.png', T / 'masked' / f'{i}.png')
    (T / 'gate-manifest.json').write_text(json.dumps({'assets': {i: {'status': 'accepted'} for i in [p.stem for p in (T / 'masked').glob('*.png')]}}, indent=1) + '\n')
    print(len(ids), 'plates for the pod:', ' '.join(ids))
else:
    n = 0
    for g in sorted((T / 'models').glob('*.glb')):
        d = HERE / 'models' / f'{g.stem}-fly.glb'
        if not d.exists() or d.stat().st_size != g.stat().st_size: shutil.copy2(g, d); d.chmod(0o664 | 0o004); n += 1
    print(n, 'meshes brought home')

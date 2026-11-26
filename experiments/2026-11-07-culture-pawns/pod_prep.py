#!/usr/bin/env python3
"""The RunPod side (pod/tools: the openmesh pod tools as the flying-pose lane used them, renamed tw-culture-pawns):
    python3 pod_prep.py prep [ids...]     pod/figs/{masked,assets.json,gate-manifest.json}: every accepted plate with no mesh yet (or the ids)
    python3 pod_prep.py home              pod/figs/models/<id>.glb -> set/models/<id>.glb (new or changed only)
Then:  cd pod && PIPE=1024_cascade TEX=2048 tools/launch_wave.sh figs auto auto ; tools/wait_wave.sh figs auto auto ;
       tools/harvest.sh figs auto auto ; tools/pod_down.sh ; ./verify_gone.sh POD_ID"""
import json, shutil, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import HERE, SET

import os
T = HERE / 'pod' / os.environ.get('POD_TYPE', 'figs')   # a wave's folder (figs: the 49; grid-<code>: a culture's race grid)
if sys.argv[1] == 'prep':
    (T / 'masked').mkdir(parents=True, exist_ok=True)
    # MESH FIRST, JUDGE THE MESH (the culture-packs-a lesson, 2026-11-06: the shared agy lock is the box's bottleneck and a
    # mesh costs about a cent): every painted plate whose matte passed goes to the pod, gate or no gate, unless the gate
    # has refused that very try. The gate and the stills' blind reads decide what is kept and what is painted again.
    P = json.loads((SET / 'plates.json').read_text()); G = json.loads((SET / 'gate.json').read_text()) if (SET / 'gate.json').exists() else {}
    def ready(i, r):
        t = r['tries'][-1]; g = G.get(i, {})
        if (t.get('matte') or {}).get('verdict') == 'fail': return False
        if g.get('judged') == t['try'] and g.get('status') != 'accepted': return False
        return True
    sent = json.loads((T / 'sent.json').read_text()) if (T / 'sent.json').exists() else {}
    only = os.environ.get('ONLY_PREFIX')   # (a culture's grid: ONLY_PREFIX=cul-ind- and not human: GRID=1)
    ids = sys.argv[2:] or [i for i, r in P.items() if r.get('tries') and ready(i, r) and sent.get(i) != r['tries'][-1]['try'] and (not only or i.startswith(only))]
    if os.environ.get('GRID'):
        R = {f['id']: f for f in json.loads((HERE / 'roster.json').read_text())['figures']}
        ids = [i for i in ids if R.get(i, {}).get('race', 'human') != 'human']
    (SET / 'masked').mkdir(exist_ok=True); (SET / 'inputs').mkdir(exist_ok=True)
    for i in ids:
        t = P[i]['tries'][-1]
        shutil.copy2(t['rgba'], T / 'masked' / f'{i}.png'); shutil.copy2(t['rgba'], SET / 'masked' / f'{i}.png'); shutil.copy2(t['plate'], SET / 'inputs' / f'{i}.jpg')
        (T / 'models' / f'{i}.glb').unlink(missing_ok=True) if (T / 'models').exists() else None   # a new try: its old mesh goes
        sent[i] = t['try']
    (T / 'sent.json').write_text(json.dumps(sent, indent=1) + '\n')
    have = [p.stem for p in (T / 'masked').glob('*.png')]
    (T / 'gate-manifest.json').write_text(json.dumps({'assets': {i: {'status': 'accepted'} for i in have}}, indent=1) + '\n')
    (T / 'assets.json').write_text(json.dumps({'assets': [{'id': i} for i in have]}, indent=1) + '\n')
    print(len(ids), 'plates for the pod:', ' '.join(ids))
else:
    n = 0
    for g in sorted((HERE / 'pod').glob('*/models/*.glb')) + sorted((HERE / 'pod2').glob('*/models/*.glb')):   # every wave's folder, the second pod's last (its meshes are the newest)
        d = SET / 'models' / g.name
        if not d.exists() or d.stat().st_size != g.stat().st_size: shutil.copy2(g, d); n += 1
    print(n, 'meshes brought home')

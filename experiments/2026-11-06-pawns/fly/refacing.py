#!/usr/bin/env python3
"""yaw.json again from the saved facing answers (gemini/<id>-facing.txt), and re-measure any id whose turn changed."""
import json, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import HERE, last_json
from review import YAW_OF, YF

Y = json.loads(YF.read_text()) if YF.exists() else {}
for f in sorted((HERE / 'gemini').glob('*-facing.txt')):
    i = f.name[:-len('-facing.txt')]; j = last_json(f.read_text()) or {}
    y = YAW_OF.get(str(j.get('front', 'A')).strip()[:1], 0); Y[i] = y
    q = HERE / 'qa' / f'{i}.json'
    if q.exists() and json.loads(q.read_text())['facing_deg'] != y:
        YF.write_text(json.dumps(Y, indent=1) + '\n')
        subprocess.run(['~/.local/share/tw-trimesh-venv/bin/python', str(HERE / 'measure_fly.py'), i], capture_output=True, text=True)
        print(i, 'turned to', y, '(re-measured)')
    print(i, 'front', j.get('front'), 'confidence', j.get('confidence'), '-> yaw', y)
YF.write_text(json.dumps(Y, indent=1) + '\n')

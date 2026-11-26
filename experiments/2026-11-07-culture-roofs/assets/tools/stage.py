#!/usr/bin/env python3
"""Plates -> masked/ (what launch_wave.sh uploads) + gate-manifest.json (status accepted), for every plate whose alpha is
clean (an alpha channel, clear corners), unless gate-plates.json or `--hold id,id` holds it back. A plate with no usable
alpha is listed (NEEDS MATTE) and not staged.   python3 tools/stage.py [--hold a,b] [--redo id,id]"""
import json, shutil, sys
from pathlib import Path
from PIL import Image
E = Path(__file__).resolve().parent.parent
hold = set(sys.argv[sys.argv.index('--hold') + 1].split(',')) if '--hold' in sys.argv else set()
redo = set(sys.argv[sys.argv.index('--redo') + 1].split(',')) if '--redo' in sys.argv else set()
gp = E / 'gate-manifest.json'; G = json.loads(gp.read_text()) if gp.exists() else {'assets': {}}
gate = json.loads((E / 'gate-plates.json').read_text()) if (E / 'gate-plates.json').exists() else {}
(E / 'masked').mkdir(exist_ok=True); n = 0
for p in sorted((E / 'plates').glob('*.png')):
    i = p.stem; dst = E / 'masked' / p.name
    if i in hold or gate.get(i, {}).get('hold'): G['assets'].pop(i, None); dst.unlink(missing_ok=True); continue
    if dst.exists() and i not in redo and G['assets'].get(i, {}).get('status') == 'accepted': continue
    im = Image.open(p)
    if im.mode != 'RGBA': print('NEEDS MATTE (no alpha):', i); continue
    a = im.getchannel('A'); w, h = im.size
    if max(a.getpixel(c) for c in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]) > 16: print('NEEDS MATTE (corners not clear):', i); continue
    shutil.copy(p, dst); G['assets'][i] = {'id': i, 'status': 'accepted', 'matte': 'native-alpha'}; n += 1
gp.write_text(json.dumps(G, indent=1)); print(f'staged {n} new; {sum(1 for v in G["assets"].values() if v["status"] == "accepted")} accepted in all')

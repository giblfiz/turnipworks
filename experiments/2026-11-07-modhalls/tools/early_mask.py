#!/usr/bin/env python3
"""EARLY meshing (wave 1's rule: agy is the bottleneck, a mesh costs cents): every plate in plates/ that passes the gate's
MEASURE stage (alpha, clear corners, margin) is copied to masked/ with no gate status, so launch_wave.sh EARLY=1 meshes it.
The semantic gate is the batched blind read afterwards (tools/plate_read.py); a plate it refuses is re-plated and re-meshed.
    python3 tools/early_mask.py            (prints what it copied and what failed the measure)"""
import json, shutil, sys
from pathlib import Path
B = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(B / 'tools'))
from gate_plates import measure, sha
(B / 'masked').mkdir(exist_ok=True); log = B / 'work' / 'early-mask.json'
seen = json.loads(log.read_text()) if log.exists() else {}
for p in sorted((B / 'plates').glob('*.png')):
    h = sha(p)
    if seen.get(p.stem, {}).get('sha') == h: continue
    m = measure(p); seen[p.stem] = dict(sha=h, measure=m)
    # a plate whose object only touches the frame (a cart's wheels on the bottom edge; corners clear): padded with 6%
    # transparent margin on every side (plates/orig/ keeps the worker's file), measured again
    if not m['ok'] and m.get('alpha_box') is not None and all('touches the frame' in q or q == 'corners not transparent' for q in m['problems']):
        from PIL import Image
        im = Image.open(p).convert('RGBA'); a = im.getchannel('A'); w, hh = im.size
        if max(a.getpixel(c) for c in [(0, 0), (w - 1, 0), (0, hh - 1), (w - 1, hh - 1)]) <= 8:
            (B / 'plates' / 'orig').mkdir(exist_ok=True); shutil.copy2(p, B / 'plates' / 'orig' / p.name)
            a = a.point(lambda v: 0 if v <= 8 else v); im.putalpha(a)
            pad = int(max(w, hh) * 0.06); out = Image.new('RGBA', (w + 2 * pad, hh + 2 * pad), (0, 0, 0, 0)); out.paste(im, (pad, pad)); out.save(p)
            m = measure(p); seen[p.stem] = dict(sha=sha(p), measure=m, padded=pad)
    if m['ok']: shutil.copy2(p, B / 'masked' / p.name); print('masked', p.stem, '(padded)' if seen[p.stem].get('padded') else '')
    else: (B / 'masked' / p.name).unlink(missing_ok=True); print('MEASURE FAIL', p.stem, m['problems'])
log.write_text(json.dumps(seen, indent=1))

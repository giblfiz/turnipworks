#!/usr/bin/env python3
"""Blind front reads for many pillars at once: one agy-run call per orientation sheet (orientation_prepare.py writes
sheet-NNN.png with up to four numbered rows, views A-D a quarter turn apart and E from above; sheet-NNN.json maps rows
to skus). Writes orientation/raw/blind-sheet-NNN.json and merges entries into integration/orientation.json.
Rule (factions-01): front in A -> yaw 0, B -> -90, C -> 180, D -> 90; no unique front -> 0, recorded as such.
    python3 integration/orient_sheets.py sheet-000 [sheet-001 ...]"""
import hashlib, json, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image
B = Path(__file__).resolve().parents[1]; RAW = B / 'orientation/raw'; OJ = B / 'integration/orientation.json'
YAW = {'A': 0, 'B': -90, 'C': 180, 'D': 90}
P = ('Look at the image file sheet.jpg in this folder. Before interpreting, note any text or labels you can read (row numbers, '
     'view letters). Each numbered row is ONE 3D prop shown from four sides A, B, C, D (each a quarter turn apart) and from directly '
     'above E. For each row, without guessing what it should be: describe it in a few words, name its motif, and say which of A-D shows '
     'its principal face most clearly (the side a carved head, face, shield or main emblem looks out from), or none if it has no unique '
     'front. Answer ONLY JSON keyed by row number: {"1": {"description": "", "motif": "", "frontView": "A|B|C|D|none", "confidence": 0-1}, ...}')
dec = json.JSONDecoder(); o = json.loads(OJ.read_text()) if OJ.exists() else {}
for tag in sys.argv[1:]:
    rows = json.loads((RAW / f'{tag}.json').read_text())
    d = Path(tempfile.mkdtemp(prefix='tw-osheet-')); im = Image.open(RAW / f'{tag}.png').convert('RGB'); im.thumbnail((1400, 1400)); im.save(d / 'sheet.jpg', quality=88)
    r = None
    for _ in range(2):
        txt = subprocess.run(['~/fauna-tools/agy-run', '-t', '300', '-C', str(d), P], capture_output=True, text=True, timeout=400).stdout
        for m in re.finditer(r'\{', txt):
            try: r = dec.raw_decode(txt[m.start():])[0]; break
            except json.JSONDecodeError: continue
        if r: break
    shutil.rmtree(d, ignore_errors=True)
    (RAW / f'blind-{tag}.json').write_text(json.dumps(r, indent=1))
    for n, sku in rows.items():
        a = (r or {}).get(n) or {}; f = a.get('frontView', 'none')
        src = B / 'models' / f'{sku}.glb'
        o[sku] = dict(yaw=YAW.get(f, 0), sourceSha256=hashlib.sha256(src.read_bytes()).hexdigest(),
                      evidence=dict(views=f'orientation/raw/{tag}.png row {n}', frontView=f, blindRead=f'orientation/raw/blind-{tag}.json',
                                    review='front from the blind sheet read' if f in YAW else 'no unique front in the blind read: yaw 0 is a reviewed decision',
                                    measurements=f'orientation/raw/measurements/{sku}.json'))
        print(sku, f, a.get('motif'), a.get('confidence'))
OJ.write_text(json.dumps(o, indent=1) + '\n')

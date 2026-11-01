#!/usr/bin/env python3
"""Blind front read for orientation (agy-run, the Gemini subscription), one mesh per call, five small JPG views A-E.
    python3 integration/orient_read.py SKU [SKU ...]   (after orientation_prepare.py --skus ...)
Writes orientation/raw/blind-<sku>.json. The yaw rule is the factions-01 one: front in A -> 0, B -> -90, C -> 180, D -> 90.
A view with no unique front (a symmetric column) is recorded as such; the yaw is then 0 by a reviewed decision.
Prints a suggested orientation.json entry; integration/orientation.json is written by the caller from it."""
import hashlib, json, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image
B = Path(__file__).resolve().parents[1]; RAW = B / 'orientation/raw'
YAW = {'A': 0, 'B': -90, 'C': 180, 'D': 90}
P = ('Look at the image files A.jpg, B.jpg, C.jpg, D.jpg and E.jpg in this folder. Before interpreting, note any text or labels you can read. '
     'They show ONE 3D prop from four sides (A, B, C, D, each a quarter turn apart) and from directly above (E). Describe the object and its parts '
     'without guessing what it should be. Which of A-D shows its principal face most clearly: the side a carved creature head, face or main emblem '
     'looks out from? Is any of A-D a flat rear or wall-mounting side? If it has no unique front, say none. Answer ONLY JSON: '
     '{"text": [], "description": "", "motif": "", "frontView": "A|B|C|D|none", "rearView": "A|B|C|D|none", "confidence": 0-1}')
dec = json.JSONDecoder()
out = {}
for sku in sys.argv[1:]:
    d = Path(tempfile.mkdtemp(prefix='tw-orient-'))
    for v in 'ABCDE':
        im = Image.open(RAW / 'views' / f'{sku}__{v}.png').convert('RGB'); im.thumbnail((300, 300)); im.save(d / f'{v}.jpg', quality=88)
    r = None
    for _ in range(2):
        txt = subprocess.run(['~/fauna-tools/agy-run', '-t', '300', '-C', str(d), P], capture_output=True, text=True, timeout=400).stdout
        for m in re.finditer(r'\{', txt):
            try: r = dec.raw_decode(txt[m.start():])[0]; break
            except json.JSONDecodeError: continue
        if r: break
    shutil.rmtree(d, ignore_errors=True)
    (RAW / f'blind-{sku}.json').write_text(json.dumps(r, indent=1))
    src = B / 'models' / f'{sku}.glb'
    f = (r or {}).get('frontView', 'none')
    out[sku] = dict(yaw=YAW.get(f, 0), sourceSha256=hashlib.sha256(src.read_bytes()).hexdigest(),
                    evidence=dict(views=f'orientation/raw/views/{sku}__[A-E].png', frontView=f, blindRead=f'orientation/raw/blind-{sku}.json',
                                  review=('front from the blind read' if f in YAW else 'no unique front in the blind read: yaw 0 is a reviewed decision'),
                                  measurements=f'orientation/raw/measurements/{sku}.json'))
    print(sku, f, (r or {}).get('motif'), (r or {}).get('confidence'))
print(json.dumps(out, indent=1))

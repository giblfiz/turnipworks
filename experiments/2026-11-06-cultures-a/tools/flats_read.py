#!/usr/bin/env python3
"""One blind Gemini read of a culture's flats (agy-run, isolated folder): every finished floor tiled 3 x 3 (does a seam
or a repeating blotch show? what is it?), every decal on grey, every icon at 64 px (what room / building does it show,
and which culture?). Neutral file names; labels read first.   python3 tools/flats_read.py CODE  -> CODE/flats/read.json"""
import json, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image
E = Path(__file__).resolve().parent.parent; F = E / sys.argv[1] / 'flats'
d = Path(tempfile.mkdtemp(prefix='agy-ca-flats-')); names = {}
for k, p in enumerate(sorted((F / 'seamless').glob('*.png'))):
    t = Image.open(p).convert('RGB').resize((256, 256)); g = Image.new('RGB', (768, 768))
    for i in range(3):
        for j in range(3): g.paste(t, (i * 256, j * 256))
    n = f'floor-{k + 1}.jpg'; g.save(d / n, quality=88); names[n] = p.stem
for k, p in enumerate(sorted((F / 'decals').glob('*.jpg'))):
    n = f'decal-{k + 1}.jpg'; Image.open(p).convert('RGB').resize((384, 384)).save(d / n, quality=88); names[n] = p.stem
for k, p in enumerate(sorted((F / 'icons').glob('*.png'))):
    im = Image.open(p).convert('RGBA').resize((64, 64), Image.LANCZOS); bg = Image.new('RGBA', (64, 64), (60, 62, 66, 255)); bg.alpha_composite(im)
    n = f'icon-{k + 1}.png'; bg.convert('RGB').save(d / n); names[n] = p.stem
P = ("Look at the image files in this folder: " + ', '.join(names) + ". Do NOT create, crop or write any files; do not run commands or open other files. "
     "floor-*.jpg: a ground texture for a tabletop game, tiled 3 x 3 (the tile repeats). For each: what material is it; does a SEAM (a line or step where the "
     "tiles meet) or a repeating blotch show; would it read as that material from above at table distance. decal-*.jpg: a flat thing laid or hung in a room: "
     "what is it (on a chroma-blue key the game removes). icon-*.png: a 64-px menu icon of a room or building: what room or building does it show, and what "
     "culture or region. First list any text you can read anywhere. Answer ONLY JSON keyed by file name: "
     '{"<file>": {"text": [], "what": "", "culture": "", "seam": false, "notes": ""}, ...}')
r = None
for _ in range(2):
    txt = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-C', str(d), '-t', '600', P], stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=2400).stdout
    for m in re.finditer(r'\{', txt):
        try: r = json.JSONDecoder().raw_decode(txt[m.start():])[0]; break
        except json.JSONDecodeError: continue
    if r: break
shutil.rmtree(d, ignore_errors=True)
res = {names[f]: v for f, v in (r or {}).items() if f in names}
(F / 'read.json').write_text(json.dumps(res, indent=1))
for k, v in res.items(): print(f"{k:28s} {v.get('what', '')[:50]:50s} | {v.get('culture', '')[:22]:22s} | seam {v.get('seam')} | {v.get('notes', '')[:80]}")

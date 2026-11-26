#!/usr/bin/env python3
"""prep/flats.py for ONE culture's flats only (run from tools/spawn-tuner): prep/flats.py rewrites every flat in
assets/flat, and in a worktree those are links into main's files, so it would write through them. Same keying and
softening (imported from prep/flats.py), same outputs (assets/flat/<sku>.webp, merged into prep/flats-out.json).
    python3 ../../experiments/2026-11-06-cultures-a/tools/flats_mine.py CODE"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
TOOL = Path.cwd(); sys.path.insert(0, str(TOOL / 'prep'))
import flats as F  # noqa: E402
code = sys.argv[1]
lib = json.loads((TOOL / 'data/library.json').read_text())['objects']
mine = {j['sku'] for j in json.loads((TOOL / 'prep/flats.json').read_text()) if f'/2026-11-06-cultures-a/{code}/flats/' in j['plate']}  # (from flats.json: the library lists a flat only once it has its picture)
out = TOOL / 'assets/flat'; info_p = TOOL / 'prep/flats-out.json'; info = json.loads(info_p.read_text()) if info_p.exists() else {}
for job in json.loads((TOOL / 'prep/flats.json').read_text()):
    if job['sku'] not in mine: continue
    dst = out / f"{job['sku']}.webp"
    if dst.is_symlink(): dst.unlink()
    im = Image.open(job['plate'])
    if job.get('opaque'):
        im.convert('RGB').resize((F.MAX, F.MAX), Image.LANCZOS).save(dst, 'WEBP', quality=85); info[job['sku']] = {'w': F.MAX, 'h': F.MAX, 'keyed': 0.0}; print(job['sku'], 'opaque'); continue
    rgba, mask = F.key_blue(im)
    if job['sku'].startswith(('decal-',)): rgba = F.soften_decal(rgba, mask)
    ys, xs = np.nonzero(mask); crop = rgba.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)); crop.thumbnail((F.MAX, F.MAX))
    crop.save(dst, 'WEBP', quality=82); info[job['sku']] = {'w': crop.width, 'h': crop.height, 'keyed': round(float(1 - mask.mean()), 3)}; print(job['sku'], info[job['sku']])
info_p.write_text(json.dumps(info, indent=1))
print(len(mine), 'flats of', code)

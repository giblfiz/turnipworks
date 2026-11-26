#!/usr/bin/env python3
"""prep/flats.py for the faiths' flats only (run from tools/spawn-tuner): native-alpha plates (fth/flats-clean, the
factions' route), cropped to their alpha and saved as assets/flat/<sku>.webp, merged into prep/flats-out.json. Only this
batch's names: prep/flats.py rewrites every flat, and in a worktree those are links into main's files.
    python3 ../../experiments/2026-11-07-faith-factions/tools/flats_faith.py"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
TOOL = Path.cwd(); sys.path.insert(0, str(TOOL / 'prep'))
import flats as F  # noqa: E402
out = TOOL / 'assets/flat'; info_p = TOOL / 'prep/flats-out.json'; info = json.loads(info_p.read_text()) if info_p.exists() else {}
n = 0
for job in json.loads((TOOL / 'prep/flats.json').read_text()):
    if '/2026-11-07-faith-factions/fth/flats-clean/' not in str(job['plate']): continue
    dst = out / f"{job['sku']}.webp"
    if dst.is_symlink(): dst.unlink()
    rgba = Image.open(job['plate']).convert('RGBA'); mask = np.asarray(rgba)[..., 3] > 0
    ys, xs = np.nonzero(mask); crop = rgba.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)); crop.thumbnail((F.MAX, F.MAX))
    crop.save(dst, 'WEBP', quality=82); info[job['sku']] = {'w': crop.width, 'h': crop.height, 'keyed': round(float(1 - mask.mean()), 3)}; n += 1; print(job['sku'], info[job['sku']])
info_p.write_text(json.dumps(info, indent=1))
print(n, 'faith flats')

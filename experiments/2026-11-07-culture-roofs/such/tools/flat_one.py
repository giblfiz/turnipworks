#!/usr/bin/env python3
"""Build ONE flat the way prep/flats.py does (its own functions), into this checkout's assets/flat, and merge its entry
into prep/flats-out.json, without rewriting every flat (which writes through the worktree's symlinks into main).
  python3 flat_one.py REPO SKU PLATE"""
import json, sys, pathlib
repo, sku, plate = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
sys.path.insert(0, str(repo / 'tools/spawn-tuner/prep')); import flats as F  # noqa: E402
from PIL import Image; import numpy as np  # noqa: E402
out = repo / 'tools/spawn-tuner/assets/flat' / f'{sku}.webp'
if out.is_symlink(): out.unlink()  # (never write through a link into main)
im = Image.open(plate); rgba, mask = F.key_blue(im); rgba = F.soften_decal(rgba, mask, feather=0.001)
ys, xs = np.nonzero(mask); crop = rgba.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)); crop.thumbnail((F.MAX, F.MAX))
crop.save(out, 'WEBP', quality=82)
fo = repo / 'tools/spawn-tuner/prep/flats-out.json'; info = json.loads(fo.read_text()) if fo.exists() else {}
info[sku] = {'w': crop.width, 'h': crop.height, 'keyed': round(float(1 - mask.mean()), 3)}; fo.write_text(json.dumps(info, indent=1))
print(sku, info[sku], out)

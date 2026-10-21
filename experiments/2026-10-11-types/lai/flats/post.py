#!/usr/bin/env python3
"""raw/room-*.png (chroma green) -> icons/<name>.png, 128 px RGBA: exactly experiments/2026-10-03-build-icons/post.py
(key, de-spill, trim, pad square 8%, 128 px), except that it writes into this folder's icons/ instead of
engine/client/data/icons/ (the integration agent copies them there). Prints residue numbers for the check."""
import os, glob, sys
from PIL import Image
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'icons')
ONLY = set(sys.argv[1].split(',')) if len(sys.argv) > 1 else None
import json; MAGENTA = set(json.load(open(os.path.join(HERE, 'magenta-icons.json'))))
for f in sorted(glob.glob(os.path.join(HERE, 'raw', 'room-*.png'))):
    name = os.path.splitext(os.path.basename(f))[0]
    if ONLY and name not in ONLY: continue
    im = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    if name in MAGENTA:      # as experiments/2026-10-05-outdoors/post.py (the Yard icon): subjects with green in them
        mg = np.minimum(r, b) - g; a = np.clip(1 - (mg - 40) / 70, 0, 1); k = np.clip(mg, 0, None) * 0.85
        rgba = np.dstack([np.where(mg > 0, r - k, r), g, np.where(mg > 0, b - k, b), a * 255]).clip(0, 255).astype(np.uint8)
    else:
        gr = g - np.maximum(r, b)
        a = np.clip(1 - (gr - 40) / 70, 0, 1)
        g2 = np.where(gr > 0, np.maximum(r, b) + gr * 0.15, g)
        rgba = np.dstack([r, g2, b, a * 255]).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    box = img.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box: print('EMPTY', name); continue
    img = img.crop(box)
    side = int(max(img.size) * 1.08)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(img, ((side - img.size[0]) // 2, (side - img.size[1]) // 2))
    sq = sq.resize((128, 128), Image.LANCZOS)
    sq.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    o = np.asarray(sq).astype(int); vis = o[..., 3] > 32
    corners = [int(o[y, x, 3]) for y in (0, 127) for x in (0, 127)]
    green = ((vis & (np.minimum(o[..., 0], o[..., 2]) > o[..., 1] + 40)) if name in MAGENTA else (vis & (o[..., 1] > np.maximum(o[..., 0], o[..., 2]) + 40))).sum() / max(vis.sum(), 1)
    print(f'{name}: raw {im.shape[1]}x{im.shape[0]}, subject box {box}, keyed {(a < 0.5).mean():.0%} of raw, visible {vis.mean():.0%} of icon, corner alpha {corners}, key colour left {green:.2%} of visible, {os.path.getsize(os.path.join(OUT, name + ".png")) // 1024} KB')

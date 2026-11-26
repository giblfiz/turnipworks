#!/usr/bin/env python3
"""Icons: CODE/flats/raw/{room,type}-*.png (magenta key) -> CODE/flats/icons/<name>.png, 128 px RGBA (the smithy's
tools/icons.py post step: key, de-spill, trim, pad square 8%). Prints the key residue for the check.
    CA_CODE=jpn python3 flats/post.py"""
import os, glob
import numpy as np
from PIL import Image
HERE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), os.environ['CA_CODE'], 'flats')
OUT = os.path.join(HERE, 'icons'); os.makedirs(OUT, exist_ok=True)
for f in sorted(glob.glob(os.path.join(HERE, 'raw', 'room-*.png')) + glob.glob(os.path.join(HERE, 'raw', 'type-*.png')) + glob.glob(os.path.join(HERE, 'raw', 'genre-*.png'))):
    name = os.path.splitext(os.path.basename(f))[0]
    im = np.asarray(Image.open(f).convert('RGB')).astype(np.float32); r, g, b = im[..., 0], im[..., 1], im[..., 2]
    mg = np.minimum(r, b) - g; a = np.clip(1 - (mg - 40) / 70, 0, 1); k = np.clip(mg, 0, None) * 0.85
    img = Image.fromarray(np.dstack([np.where(mg > 0, r - k, r), g, np.where(mg > 0, b - k, b), a * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    box = img.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box: print('EMPTY', name); continue
    img = img.crop(box); side = int(max(img.size) * 1.08)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(img, ((side - img.size[0]) // 2, (side - img.size[1]) // 2)); sq = sq.resize((128, 128), Image.LANCZOS)
    sq.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    o = np.asarray(sq).astype(int); vis = o[..., 3] > 32
    print(f"{name}: keyed {(a < 0.5).mean():.0%}, visible {vis.mean():.0%}, corner alpha {[int(o[y, x, 3]) for y in (0, 127) for x in (0, 127)]}, key colour left {(vis & (np.minimum(o[..., 0], o[..., 2]) > o[..., 1] + 40)).sum() / max(vis.sum(), 1):.2%}")

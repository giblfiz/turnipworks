#!/usr/bin/env python3
"""raw/genres-{a,b,c}.png (chroma green) -> icons/genres-{a,b,c}.png, 128 px RGBA: the same key as
experiments/2026-11-06-sprawl/flats/post.py (key, de-spill, trim, pad square 8%, 128 px). Prints residue numbers."""
import os, glob
from PIL import Image
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'icons')
for f in sorted(glob.glob(os.path.join(HERE, 'raw', 'genres-?.png'))):
    name = os.path.splitext(os.path.basename(f))[0]
    im = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    gr = g - np.maximum(r, b)
    a = np.clip(1 - (gr - 40) / 70, 0, 1)
    g2 = np.where(gr > 0, np.maximum(r, b) + gr * 0.15, g)
    rgba = np.dstack([r, g2, b, a * 255]).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    box = img.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox()
    img = img.crop(box)
    side = int(max(img.size) * 1.08)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(img, ((side - img.size[0]) // 2, (side - img.size[1]) // 2))
    sq = sq.resize((128, 128), Image.LANCZOS); sq.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    o = np.asarray(sq).astype(int); vis = o[..., 3] > 32
    corners = [int(o[y, x, 3]) for y in (0, 127) for x in (0, 127)]
    green = (vis & (o[..., 1] > np.maximum(o[..., 0], o[..., 2]) + 40)).sum() / max(vis.sum(), 1)
    print(f'{name}: raw {im.shape[1]}x{im.shape[0]}, box {box}, visible {vis.mean():.0%}, corners {corners}, green left {green:.2%}')

#!/usr/bin/env python3
"""Key out the chroma-green background of raw/<name>.png, trim to the subject, pad square and write
engine/client/data/icons/<name>.png at 128 px (shown at 56 px: crisp on 2x screens)."""
import os, glob, sys
from PIL import Image, ImageFilter
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'engine', 'client', 'data', 'icons'); os.makedirs(OUT, exist_ok=True)
ONLY = set(sys.argv[1].split(',')) if len(sys.argv) > 1 else None  # post.py tool-pawns,tool-settings: just those
for f in sorted(glob.glob(os.path.join(HERE, 'raw', '*.png'))):
    name = os.path.splitext(os.path.basename(f))[0]
    if ONLY and name not in ONLY: continue
    im = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    # greenness: how far green exceeds the other channels; full key above ~90, soft edge below
    gr = g - np.maximum(r, b)
    a = np.clip(1 - (gr - 40) / 70, 0, 1)
    # de-spill: pull green down to the other channels' max where it leaks into the subject's edges
    g2 = np.where(gr > 0, np.maximum(r, b) + gr * 0.15, g)
    rgba = np.dstack([r, g2, b, a * 255]).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    alpha = img.split()[3].point(lambda v: 255 if v > 24 else 0)
    box = alpha.getbbox()
    if not box: print('EMPTY', name); continue
    img = img.crop(box)
    side = int(max(img.size) * 1.08)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(img, ((side - img.size[0]) // 2, (side - img.size[1]) // 2))
    sq = sq.resize((128, 128), Image.LANCZOS)
    sq.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    print(name, box, os.path.getsize(os.path.join(OUT, f'{name}.png')) // 1024, 'KB')

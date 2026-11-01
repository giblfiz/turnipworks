#!/usr/bin/env python3
"""Caves (2026-10-25): key out the chroma-MAGENTA background of raw/room-cave.png, trim, pad square, write
engine/client/data/icons/room-cave.png at 128 px (the method of ../2026-10-24-hills/post_icon.py, unchanged)."""

import os
from PIL import Image
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
# the main checkout's ignored icon dir the game deploys from (the worktree's engine/client/data/icons is a symlink to it)
OUT = 'engine/client/data/icons'
for name in ['room-cave']:
    im = np.asarray(Image.open(os.path.join(HERE, 'raw', f'{name}.png')).convert('RGB')).astype(np.float32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    mg = np.minimum(r, b) - g                      # magenta-ness: red and blue both well above green
    a = np.clip(1 - (mg - 40) / 70, 0, 1)
    # de-spill: pull red and blue down toward green where magenta leaks into the subject's edges
    k = np.clip(mg, 0, None) * 0.85
    r2, b2 = np.where(mg > 0, r - k, r), np.where(mg > 0, b - k, b)
    rgba = np.dstack([r2, g, b2, a * 255]).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    box = img.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox()
    img = img.crop(box)
    side = int(max(img.size) * 1.08)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(img, ((side - img.size[0]) // 2, (side - img.size[1]) // 2))
    sq = sq.resize((128, 128), Image.LANCZOS)
    sq.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    print(name, box, os.path.getsize(os.path.join(OUT, f'{name}.png')) // 1024, 'KB')

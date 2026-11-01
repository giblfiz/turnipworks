#!/usr/bin/env python3
"""Table-distance view of a flat-roof texture, as the game would draw it: the 512 px game webp (same resize + WEBP q85 as
export.py) tiled at 5 ft per tile over a 30 x 20 ft roof, minified to ~70 px per tile (camera ~40 ft up), then put in a
gentle perspective (camera pitched ~55 deg), on a neutral dark ground with a plain stone parapet band round it.
    python3 view.py SRC.png OUT.jpg"""
import io, os, sys
import numpy as np
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
b = io.BytesIO(); Image.open(src).convert('RGB').resize((512, 512), Image.LANCZOS).save(b, 'WEBP', quality=85); t = Image.open(b).convert('RGB')
PXFT = 14; FT = float(os.environ.get('FT', '5')); TP = round(FT * PXFT); RW, RH = 30 * PXFT, 20 * PXFT   # 30 x 20 ft roof; FT feet per picture
nx, ny = -(-RW // TP), -(-RH // TP)
tile = t.resize((TP, TP), Image.LANCZOS)     # minified like a mip level
roof = Image.new('RGB', (RW, RH))
import os, random; rnd = random.Random(7); ROT = os.environ.get('ROT') == '1'   # ROT=1: each tile randomly rotated 0/90/180/270 and maybe mirrored (an engine option)
for x in range(nx):
    for y in range(ny):
        tl = tile
        if ROT:
            tl = tl.rotate(90 * rnd.randrange(4))
            if rnd.random() < 0.5: tl = tl.transpose(Image.FLIP_LEFT_RIGHT)
        roof.paste(tl, (x * TP, y * TP))
P = 10; W, H = roof.width + 2 * P, roof.height + 2 * P
flat = Image.new('RGB', (W, H), (128, 124, 116)); flat.paste(roof, (P, P))
d = ImageDraw.Draw(flat); d.rectangle((0, 0, W - 1, H - 1), outline=(90, 86, 80), width=2)
# perspective: far edge (top) narrower
OW, OH = 760, 360; top_in = 0.16
quad_dst = [(OW * top_in, 0), (OW * (1 - top_in), 0), (OW, OH), (0, OH)]
def coeffs(dst, srcpts):
    A = []; B = []
    for (x, y), (u, v) in zip(dst, srcpts):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]; B += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(B, float)).tolist()
c = coeffs(quad_dst, [(0, 0), (W, 0), (W, H), (0, H)])
big = flat.resize((W * 2, H * 2), Image.LANCZOS)
c2 = coeffs(quad_dst, [(0, 0), (2 * W, 0), (2 * W, 2 * H), (0, 2 * H)])
view = big.transform((OW, OH), Image.PERSPECTIVE, c2, Image.BICUBIC, fillcolor=(46, 52, 44))
canvas = Image.new('RGB', (OW + 80, OH + 80), (46, 52, 44)); canvas.paste(view, (40, 40), Image.new('L', (OW, OH), 255))
canvas.save(out, quality=92)

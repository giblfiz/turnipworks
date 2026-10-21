#!/usr/bin/env python3
"""Enclosed chroma-blue in a painted-line decal (decals/<sku>.jpg, in place; the untouched plate is kept in
raw/plates-before-clean/). tools/spawn-tuner/prep/flats.py keys only blue that is connected to the plate border, so the
blue INSIDE a painted ring (a warding circle) would stay as opaque blue. Here the floor must show inside the ring, so
the fill of clean_plates.py is wrong; instead each big enclosed blue area is joined to the background by ONE narrow gap
of blue cut through the paint along the shortest way out (it reads as a worn break in the painted line). Enclosed blue
specks under 400 px take the nearest paint colour (as clean_plates.py nearest).
    python3 breach.py sku [gap_px=14]"""
import os, sys, shutil
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__)); KEEP = os.path.join(HERE, 'raw', 'plates-before-clean'); os.makedirs(KEEP, exist_ok=True)
n = sys.argv[1]; gap = int(sys.argv[2]) if len(sys.argv) > 2 else 14
f = f'{HERE}/decals/{n}.jpg'; k = os.path.join(KEEP, n + '.jpg')
if not os.path.exists(k) or os.path.getmtime(f) > os.path.getmtime(k): shutil.copy(f, k)
a = np.asarray(Image.open(k).convert('RGB')).astype(np.int16)
def parts(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]; blue = (b > r + 35) & (b > g + 15); lab, m = ndimage.label(blue)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}; bg = np.isin(lab, list(edge))
    return blue, lab, m, bg
BLUE = np.median(a[:6].reshape(-1, 3), axis=0); cuts = 0; specks = 0
for _ in range(60):
    blue, lab, m, bg = parts(a); sz = ndimage.sum(blue & ~bg, lab, range(1, m + 1)); big = [i + 1 for i in np.argsort(-sz) if sz[i] >= 400]
    if not big: break
    comp = lab == big[0]
    d, idx = ndimage.distance_transform_edt(~bg, return_indices=True)          # for every pixel: the nearest background pixel
    ys, xs = np.nonzero(comp); j = np.argmin(d[ys, xs]); y0, x0 = ys[j], xs[j]; y1, x1 = idx[0][y0, x0], idx[1][y0, x0]
    L = int(np.hypot(y1 - y0, x1 - x0)) + gap; vy, vx = (y1 - y0) / max(L - gap, 1), (x1 - x0) / max(L - gap, 1)
    line = np.zeros(a.shape[:2], bool)
    for t in np.arange(-gap / 2, L, 0.5):
        y, x = int(round(y0 + vy * t)), int(round(x0 + vx * t))
        if 0 <= y < a.shape[0] and 0 <= x < a.shape[1]: line[y, x] = True
    line = ndimage.binary_dilation(line, iterations=gap // 2); a[line] = BLUE; cuts += 1
blue, lab, m, bg = parts(a); r, g, b = a[..., 0], a[..., 1], a[..., 2]
bad = ~bg & (b > np.maximum(r, g) + 4); bad = ndimage.binary_dilation(bad, iterations=2) & ~ndimage.binary_dilation(bg, iterations=3)
idx = ndimage.distance_transform_edt(bad | bg, return_distances=False, return_indices=True); a[bad] = a[idx[0][bad], idx[1][bad]]
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(f, quality=95, subsampling=0)
print(f'{n}: {cuts} gaps of {gap}px cut through the paint; {int(bad.sum())} px of enclosed blue specks repainted')

#!/usr/bin/env python3
"""A floor tile composed from ONE painted unit (cultures-a, 2026-11-06), as the lawn's stripes are imposed on a painted
lawn (the farmstead's finish.py): CODE/flats/units/<sku>.png -> CODE/flats/seamless/<sku>.png (1024 px, opaque, tiles).
    CA_CODE=jpn python3 flats/compose.py floor-tatami
floor-tatami: the plate is ONE tatami mat (portrait 1:2, its cloth borders down both long sides, plain short ends).
A 5-ft cell holds TWO mats side by side (each 2.5 x 5 ft: the Kyoto mat is 3.1 x 6.3 ft, kept in proportion to the cell),
so mat borders meet mat borders across every cell edge and the plain ends meet plain ends: the tile repeats exactly.
The unit is first evened (its low-frequency tone flattened) so a grid of copies shows no blotch; its two copies are the
same mat, the second turned 180 degrees, so the pair does not read as a stamped repeat."""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), os.environ['CA_CODE'], 'flats')
os.makedirs(os.path.join(HERE, 'seamless'), exist_ok=True)
def flatten(a, strength=0.8):
    low = np.stack([ndimage.gaussian_filter(a[..., c], a.shape[0] / 6, mode='wrap') for c in range(3)], -1)
    return a - strength * (low - low.mean(axis=(0, 1)))
for name in sys.argv[1].split(','):
    im = Image.open(os.path.join(HERE, 'units', f'{name}.png')).convert('RGB')
    w, h = im.size
    # trim any margin the painter left (a row or column much darker or lighter than the mat's body), then 512 x 1024
    a = np.asarray(im).astype(float); lum = a.mean(axis=2)
    rows = np.where(np.abs(lum.mean(axis=1) - np.median(lum)) < 60)[0]; cols = np.where(np.abs(lum.mean(axis=0) - np.median(lum)) < 90)[0]
    a = a[rows.min():rows.max() + 1, cols.min():cols.max() + 1]
    unit = np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((512, 1024), Image.LANCZOS)).astype(float)
    unit = flatten(unit)
    tile = np.concatenate([unit, unit[::-1, ::-1]], axis=1)
    Image.fromarray(np.clip(tile, 0, 255).astype(np.uint8)).save(os.path.join(HERE, 'seamless', f'{name}.png'))
    lr = np.abs(tile[:, 0] - tile[:, -1]).mean(); inner = np.abs(tile[:, 1:] - tile[:, :-1]).mean()
    print(f'{name}: unit {w}x{h} -> trimmed {a.shape[1]}x{a.shape[0]} -> tile 1024x1024 (two mats); L/R step {lr:.1f} vs inner {inner:.1f}; mean RGB {tile.mean(axis=(0, 1)).round(0)}')

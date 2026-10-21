#!/usr/bin/env python3
"""Chroma-blue left INSIDE a decal plate's subject (decals/<sku>.jpg, in place; the untouched plate is kept in
raw/plates-before-clean/). tools/spawn-tuner/prep/flats.py keys only the blue that is connected to the plate's border,
so blue enclosed by the subject (between ribs, through a pelvis, between moss tufts) would stay as opaque blue.
After experiments/2026-10-05-outdoors/clean_plates.py, with two fills:
    nearest  each enclosed blue pixel takes the colour of the nearest clean subject pixel (moss, cloth)
    shadow   enclosed blue becomes a dark neutral floor shadow (bones: what shows through a ribcage is the dark floor
             under it, not more bone); small specks still take the nearest colour
    rim      nearest, plus the 4-px rim next to the background re-coloured from inside (rugs, cloths)
    python3 clean_plates.py shadow|nearest|rim sku-prefix"""
import glob, os, sys, shutil
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__)); KEEP = os.path.join(HERE, 'raw', 'plates-before-clean'); os.makedirs(KEEP, exist_ok=True)
SHADOW = np.array([44, 40, 37])
mode, prefix = sys.argv[1], sys.argv[2]
for f in sorted(glob.glob(f'{HERE}/decals/{prefix}*.jpg')):
    k = os.path.join(KEEP, os.path.basename(f))
    if not os.path.exists(k) or os.path.getmtime(f) > os.path.getmtime(k): shutil.copy(f, k)   # a re-rolled plate replaces the kept copy
    a = np.asarray(Image.open(k).convert('RGB')).astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    blue = (b > r + 35) & (b > g + 15)                      # the key test of prep/flats.py
    lab, _ = ndimage.label(blue)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    bad = ~bg & (b > np.maximum(r, g) + 4)                  # bone, moss, stone and linen never have blue as their strongest channel
    bad = ndimage.binary_dilation(bad, iterations=2) & ~ndimage.binary_dilation(bg, iterations=3)
    out = a.copy(); idx = ndimage.distance_transform_edt(bad | bg, return_distances=False, return_indices=True)
    out[bad] = a[idx[0][bad], idx[1][bad]]; holes = 0
    if mode == 'shadow':
        l2, n2 = ndimage.label(bad); sz = ndimage.sum(bad, l2, range(1, n2 + 1)); big = np.isin(l2, 1 + np.nonzero(sz > 150)[0]); holes = int((sz > 150).sum())
        w = ndimage.gaussian_filter(big.astype(float), 1.2)[..., None]            # soft edge into the bone
        out = (out * (1 - w) + SHADOW * w)
    rim = 0
    if mode == 'rim':   # cloth and rugs are not 'decal-*', so prep/flats.py does not de-spill their edge: a burgundy rug kept a
        # purple rim. The 4-px band next to the background takes the colour of the nearest pixel further inside.
        d = ndimage.distance_transform_edt(~bg); band = (~bg) & (d <= 4); idx2 = ndimage.distance_transform_edt(~((~bg) & (d > 4)), return_distances=False, return_indices=True)
        out = np.asarray(out, dtype=float); out[band] = out[idx2[0][band], idx2[1][band]]; rim = int(band.sum())
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f, quality=95, subsampling=0)
    print(os.path.basename(f), f'{int(bad.sum())} px ({bad.sum() / (~bg).sum():.2%} of the subject) repainted' + (f', {holes} holes filled as floor shadow' if mode == 'shadow' else '') + (f', {rim} px of rim re-coloured from inside' if rim else ''))

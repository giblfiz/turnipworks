#!/usr/bin/env python3
"""Remove chroma-blue residue INSIDE a decal plate's subject (decals/<sku>.jpg in place): specks of the blue background
showing between grass blades that are not connected to the plate's border, which prep/flats.py therefore keeps opaque
(Gemini read them as purple dots along a path's edges). Each such pixel takes the colour of the nearest clean subject
pixel; the blue background itself, and the 3-px rim next to it that flats.py de-spills, are left alone.
    python3 clean_plates.py decal-path-worn        (a sku prefix)"""
import glob, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
for f in sorted(glob.glob(f'{HERE}/decals/{sys.argv[1]}*.jpg')):
    a = np.asarray(Image.open(f).convert('RGB')).astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    blue = (b > r + 35) & (b > g + 15)                      # the key test of prep/flats.py
    lab, _ = ndimage.label(blue)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    bad = ~bg & (b > np.maximum(r, g) + 4)                  # grass and earth never have blue as their strongest channel
    bad = ndimage.binary_dilation(bad, iterations=2) & ~ndimage.binary_dilation(bg, iterations=3)
    idx = ndimage.distance_transform_edt(bad | bg, return_distances=False, return_indices=True)
    out = a.copy(); out[bad] = a[idx[0][bad], idx[1][bad]]
    Image.fromarray(out.astype(np.uint8)).save(f, quality=95, subsampling=0)
    print(os.path.basename(f), f'{bad.sum()} px repainted')

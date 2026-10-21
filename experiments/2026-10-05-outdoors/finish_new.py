#!/usr/bin/env python3
"""Second batch (2026-10-05): make the NEW floor inputs tile, without re-running make_seamless.py over the whole folder
(that would overwrite the normalised grass variants and the edge-matched gravel).
Same steps as ../2026-10-01-floors2/make_seamless.py (flatten the low-frequency tone, then join each edge to a
half-offset copy of the tile), with one change: the join is a CUT along the cheapest ragged line inside the edge band
(where tile and offset copy differ least), feathered a few pixels, instead of an 18% cross-fade. The cross-fade ghosts
anything with shapes in it (cobbles, earth patches: Gemini read a blurred double-exposed grid); the cut keeps it sharp.
Then the two new grass floors' greens are pulled into floor-grass's family: a per-channel OFFSET, applied to the green
pixels only, so their mean equals floor-grass's (content and contrast left alone). Not a gain, and not on the earth:
a gain on the blue channel turned the worn floor's earth mauve (Gemini read it as pink clover).
    python3 finish_new.py [sku,sku]      inputs/<sku>.jpg -> seamless/<sku>.png"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
NEW = sys.argv[1].split(',') if len(sys.argv) > 1 else ['floor-grass-worn', 'floor-grass-meadow', 'floor-cobble-mossy']
BAND, FEATHER = 0.18, 1.5

def seam(a, axis):
    if axis == 1: return np.abs(a[:, 0] - a[:, -1]).mean() / np.abs(a[:, 1:] - a[:, :-1]).mean()
    return np.abs(a[0] - a[-1]).mean() / np.abs(a[1:] - a[:-1]).mean()
def blotch(a):
    lum = a.mean(axis=2); return ndimage.gaussian_filter(lum, a.shape[0] / 12).std() / lum.std()
def flatten(a, strength=0.75):
    low = np.stack([ndimage.gaussian_filter(a[..., c], a.shape[0] / 8, mode='wrap') for c in range(3)], -1)
    return a - strength * (low - low.mean(axis=(0, 1)))

def path(cost):
    """Cheapest top-to-bottom path through cost (rows x W), steps of -1/0/+1 column, ending in the column it started in
    (so the cut itself wraps). Tries a start every 6 columns."""
    n, W = cost.shape; best = None
    for s in range(3, W - 3, 6):
        acc = np.full(W, np.inf); acc[s] = cost[0, s]; back = np.zeros((n, W), np.int8)
        for y in range(1, n):
            c = np.stack([np.r_[np.inf, acc[:-1]], acc, np.r_[acc[1:], np.inf]])
            k = c.argmin(axis=0); back[y] = k - 1; acc = c[k, np.arange(W)] + cost[y]
        if best is None or acc[s] < best[0]:
            p = np.zeros(n, int); p[-1] = s
            for y in range(n - 1, 0, -1): p[y - 1] = p[y] + back[y, p[y]]
            best = (acc[s], p)
    return best[1]

def cut(a):
    """Join the left/right edges: inside each edge band switch from the half-offset copy (at the edge) to the tile."""
    n = a.shape[1]; W = int(BAND * n); r = np.roll(a, n // 2, axis=1)
    d = ndimage.gaussian_filter(((a - r) ** 2).sum(axis=2), 2, mode='wrap') + 1.0
    m = np.ones(a.shape[:2])                                   # 1 = tile, 0 = offset copy
    pl = path(d[:, :W]); pr = path(d[:, n - W:][:, ::-1])
    xx = np.arange(n)[None, :]
    m[xx < pl[:, None]] = 0; m[xx > (n - 1 - pr)[:, None]] = 0
    m = ndimage.gaussian_filter(m, FEATHER, mode='wrap')[..., None]
    return a * m + r * (1 - m)

def green(a): return (a[..., 1] > a[..., 0] + 8) & (a[..., 1] > a[..., 2] + 8)
B = np.asarray(Image.open(f'{HERE}/seamless/floor-grass.png').convert('RGB')).astype(float); bm = B[green(B)].mean(axis=0)
for n in NEW:
    a = np.asarray(Image.open(f'{HERE}/inputs/{n}.jpg').convert('RGB')).astype(float)
    before = (seam(a, 1), seam(a, 0), blotch(a))
    a = flatten(a)
    a = cut(a)
    a = cut(a.transpose(1, 0, 2)).transpose(1, 0, 2)
    msg = f'{n:22s} seam LR {before[0]:4.1f}->{seam(a, 1):3.1f}  TB {before[1]:4.1f}->{seam(a, 0):3.1f}  blotch {before[2]:.2f}->{blotch(a):.2f}'
    if n.startswith('floor-grass-'):
        m = green(a); am = a[m].mean(axis=0)
        w = np.clip((a[..., 1] - a[..., 0] + 8) / 24, 0, 1)[..., None]   # 1 on grass, 0 on earth (red >= green): earth keeps its painted colour
        a = a + w * (bm - am)
        msg += f'  green {m.mean():.0%} of pixels, mean RGB {am.round(0)} -> {a[m].mean(axis=0).round(0)} (floor-grass {bm.round(0)})'
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(f'{HERE}/seamless/{n}.png'); print(msg, flush=True)

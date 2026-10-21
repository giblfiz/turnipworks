#!/usr/bin/env python3
"""Check sheets for the second batch -> raw/checks/ (git-ignored). Floors: a 3x3 tiling and the seam ratio from
make_seamless.py (mean step across the wrap / mean step inside; ~1 = invisible). Path decals: keyed and feathered with
the tuner's own prep/flats.py functions, laid end to end on a 40x25-ft floor-grass tiling; blue-key residue measured.
    python3 check_new.py"""
import os, sys, glob
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'raw', 'checks'); os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'tools', 'spawn-tuner', 'prep'))
from flats import key_blue, soften_decal
def seam(a, axis):
    if axis == 1: return np.abs(a[:, 0] - a[:, -1]).mean() / np.abs(a[:, 1:] - a[:, :-1]).mean()
    return np.abs(a[0] - a[-1]).mean() / np.abs(a[1:] - a[:-1]).mean()
for n in ['floor-grass-worn', 'floor-grass-meadow', 'floor-cobble-mossy']:
    f = f'{HERE}/seamless/{n}.png'
    if not os.path.exists(f): continue
    im = Image.open(f).convert('RGB'); a = np.asarray(im).astype(float)
    t = im.resize((512, 512), Image.LANCZOS); sheet = Image.new('RGB', (1536, 1536))
    for i in range(9): sheet.paste(t, (i % 3 * 512, i // 3 * 512))
    sheet.save(f'{OUT}/{n}-3x3.jpg', quality=92)
    print(f'{n:22s} seam LR {seam(a, 1):.2f} TB {seam(a, 0):.2f}  mean RGB {a.mean(axis=(0, 1)).round(0)}')
PX = 48  # px per foot
g = Image.open(f'{HERE}/seamless/floor-grass.png').convert('RGB').resize((5 * PX, 5 * PX), Image.LANCZOS)
def lawn():
    y = Image.new('RGB', (40 * PX, 25 * PX))
    for cx in range(8):
        for cy in range(5): y.paste(g, (cx * 5 * PX, cy * 5 * PX))
    return y
cut = {}
for f in sorted(glob.glob(f'{HERE}/decals/decal-path-worn--s*.jpg')):
    n = os.path.basename(f)[:-4]; rgba, mask = key_blue(Image.open(f)); rgba = soften_decal(rgba, mask)
    ys, xs = np.nonzero(mask); c = rgba.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    a = np.asarray(c).astype(int); vis = a[..., 3] > 32
    res = (vis & (a[..., 2] > a[..., 0] + 35) & (a[..., 2] > a[..., 1] + 15)).sum() / max(vis.sum(), 1)
    border = np.concatenate([mask[0], mask[-1], mask[:, 0], mask[:, -1]]).mean()
    print(f'{n}: keyed {1 - mask.mean():.0%} of plate, object box {c.width}x{c.height} (aspect {c.width / c.height:.2f}), touches plate border {border:.1%}, blue residue {res:.3%} of visible pixels')
    cut[n] = c.resize((5 * PX, round(5 * PX * c.height / c.width)), Image.LANCZOS)  # 60 in long
    bg = Image.new('RGB', c.size, (255, 255, 255)); bg.paste(c, (0, 0), c); bg.save(f'{OUT}/{n}-cut-on-white.jpg', quality=92)
if cut:
    names = sorted(cut)
    y = lawn()  # A: the shapes end to end, no overlap, 20 ft
    for i, n in enumerate(names): y.paste(cut[n], (10 * PX + i * 5 * PX, 12 * PX + PX // 2 - cut[n].height // 2), cut[n])
    y.save(f'{OUT}/path-A-end-to-end.jpg', quality=92)
    y = lawn(); rng = np.random.default_rng(3); x = -PX  # B: a full-width path, shapes shuffled, 20% overlap, small jitter and flips
    while x < 40 * PX:
        c = cut[names[rng.integers(len(names))]]
        if rng.random() < 0.5: c = c.transpose(Image.FLIP_LEFT_RIGHT)
        if rng.random() < 0.5: c = c.transpose(Image.FLIP_TOP_BOTTOM)
        y.paste(c, (int(x), int(12.5 * PX - c.height / 2 + rng.integers(-6, 7))), c); x += 4 * PX
    y.save(f'{OUT}/path-B-full-yard.jpg', quality=92)

#!/usr/bin/env python3
"""Check sheets -> raw/checks/ and the measured numbers.
    python3 check.py sku,...   floors/roofing: 3x3 tiling of seamless/<sku>.png + seam ratio
                               decals: keyed and feathered with the tuner's own prep/flats.py, laid on a stone floor,
                               plus cut-on-white; blue-key residue and plate-border contact measured."""
import os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'raw', 'checks'); ROOT = os.path.join(HERE, '..', '..', '..')
sys.path.insert(0, os.path.join(ROOT, 'tools', 'spawn-tuner', 'prep'))
from flats import key_blue, soften_decal
FT = {'banner-wall': 0, 'tapestry': 0, 'painting': 0, 'rug-runner': 13.3, 'rug-fur': 6.0, 'decal-blood': 2.0, 'floor-drain-grate': 2.0, 'tablecloth': 12.0, 'table-runner': 10.0,   # 0 = wall card: no floor sheet
      'decal-bones-scatter': 3.0, 'decal-grave-ledger': 7.0, 'decal-moss--s1': 5.0, 'decal-moss': 2.5, 'rite-altar-cloth': 6.0}   # largest side, ft
def seam(a, axis):
    if axis == 1: return np.abs(a[:, 0] - a[:, -1]).mean() / np.abs(a[:, 1:] - a[:, :-1]).mean()
    return np.abs(a[0] - a[-1]).mean() / np.abs(a[1:] - a[:-1]).mean()
def seam_rank(a, axis):
    """Share of the tile's own interior line-to-line steps that are at least as big as the step across the wrap (a joint
    or a course shadow lying on the border makes a big honest step: then many interior lines match it). ~0 = a real seam."""
    t = a if axis == 0 else a.transpose(1, 0, 2); inner = np.abs(t[1:] - t[:-1]).mean(axis=(1, 2)); return float((inner >= np.abs(t[0] - t[-1]).mean()).mean())
PX = 96
def ground(w, h, f):
    g = Image.open(f).convert('RGB').resize((5 * PX, 5 * PX), Image.LANCZOS); y = Image.new('RGB', (w * 5 * PX, h * 5 * PX))
    for cx in range(w):
        for cy in range(h): y.paste(g, (cx * 5 * PX, cy * 5 * PX))
    return y
for n in sys.argv[1].split(','):
    f = f'{HERE}/seamless/{n}.png'
    if os.path.exists(f):
        im = Image.open(f).convert('RGB'); a = np.asarray(im).astype(float)
        t = im.resize((512, 512), Image.LANCZOS); sheet = Image.new('RGB', (1536, 1536))
        for i in range(9): sheet.paste(t, (i % 3 * 512, i // 3 * 512))
        sheet.save(f'{OUT}/{n}-3x3.jpg', quality=92); im.save(f'{OUT}/{n}-single.jpg', quality=92)
        print(f'{n:24s} seam LR {seam(a, 1):.2f} TB {seam(a, 0):.2f}  wrap-step rank LR {seam_rank(a, 1):.0%} TB {seam_rank(a, 0):.0%}  mean RGB {a.mean(axis=(0, 1)).round(0)}'); continue
    f = f'{HERE}/decals/{n}.jpg'
    rgba, mask = key_blue(Image.open(f))
    if n.startswith('decal-'): rgba = soften_decal(rgba, mask, blob=n.startswith('decal-dirt'))
    ys, xs = np.nonzero(mask); c = rgba.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    a = np.asarray(c).astype(int); vis = a[..., 3] > 32
    res = (vis & (a[..., 2] > a[..., 0] + 35) & (a[..., 2] > a[..., 1] + 15)).sum() / max(vis.sum(), 1)
    bl = (vis & (a[..., 2] > np.maximum(a[..., 0], a[..., 1]) + 12)).sum() / max(vis.sum(), 1)
    border = np.concatenate([mask[0], mask[-1], mask[:, 0], mask[:, -1]]).mean()
    print(f'{n}: keyed {1 - mask.mean():.0%} of plate, object box {c.width}x{c.height} (aspect {c.width / c.height:.2f}), touches plate border {border:.1%}, key-blue residue {res:.3%}, bluish pixels {bl:.2%} of visible')
    bg = Image.new('RGB', c.size, (255, 255, 255)); bg.paste(c, (0, 0), c); bg.save(f'{OUT}/{n}-cut-on-white.jpg', quality=92)
    ft = next(v for k, v in FT.items() if n.startswith(k))
    if not ft: continue
    s = ft * PX / max(c.size); d = c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))), Image.LANCZOS)
    gf = f'{HERE}/seamless/floor-tomb-slabs.png' if 'ledger' in n and os.path.exists(f'{HERE}/seamless/floor-tomb-slabs.png') else f'{ROOT}/experiments/2026-10-01-floors/seamless/floor-flagstone-damp.png'
    y = ground(int(ft // 5) + 2, 2, gf); y.paste(d, ((y.width - d.width) // 2, (y.height - d.height) // 2), d); y.save(f'{OUT}/{n}-on-floor.jpg', quality=92)

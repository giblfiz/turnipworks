#!/usr/bin/env python3
"""inputs/roof-flat--<S>.jpg -> seamless/roof-flat--<S>.png (1024 px, opaque, tiles on all four edges).
Copied from experiments/2026-10-11-types/dun/flats/finish.py (flatten low-frequency tone; join each pair of edges to a
shifted copy of the tile with a CUT along the cheapest ragged line inside the edge band, no cross-fade). New here:
  * LINES (deck planks, lead rolls run along image Y): first crop the width to a whole number of plank / sheet periods
    (autocorrelation across X), resize back to 1024, and roll the L/R copy across by WHOLE periods only, so plank seams and
    rolls close at the seam. The T/B copy is rolled along Y only (cannot move a vertical line).
Prints the MEASURED seam ratio (mean step across the wrap / mean step inside the tile; ~1 = no seam), rank and blotch.
    python3 finish.py deck,lead,..."""
import os, sys, time
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
BAND, FEATHER = 0.18, 1.5
LINES = {'deck': 8}   # (lead v1/v2 had 2 rolls per tile; v3 has none)      # periods expected across X per 5-ft tile

def seam(a, axis):
    if axis == 1: return np.abs(a[:, 0] - a[:, -1]).mean() / np.abs(a[:, 1:] - a[:, :-1]).mean()
    return np.abs(a[0] - a[-1]).mean() / np.abs(a[1:] - a[:-1]).mean()
def seam_rank(a, axis):
    t = a if axis == 0 else a.transpose(1, 0, 2); inner = np.abs(t[1:] - t[:-1]).mean(axis=(1, 2)); return float((inner >= np.abs(t[0] - t[-1]).mean()).mean())
def blotch(a):
    lum = a.mean(axis=2); return ndimage.gaussian_filter(lum, a.shape[0] / 12).std() / lum.std()
def flatten(a, strength=0.75):
    low = np.stack([ndimage.gaussian_filter(a[..., c], a.shape[0] / 8, mode='wrap') for c in range(3)], -1)
    return a - strength * (low - low.mean(axis=(0, 1)))

def path(cost):
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

def cut(a, shift=None, along=0):
    n = a.shape[1]; W = int(BAND * n); r = np.roll(np.roll(a, shift or n // 2, axis=1), along, axis=0)
    d = ndimage.gaussian_filter(((a - r) ** 2).sum(axis=2), 2, mode='wrap') + 1.0
    m = np.ones(a.shape[:2])
    pl = path(d[:, :W]); pr = path(d[:, n - W:][:, ::-1])
    xx = np.arange(n)[None, :]
    m[xx < pl[:, None]] = 0; m[xx > (n - 1 - pr)[:, None]] = 0
    m = ndimage.gaussian_filter(m, FEATHER, mode='wrap')[..., None]
    return a * m + r * (1 - m)

def best_shift(a, along_ok, across=None):
    """(across, along) roll of the copy with the least band difference; `across` = allowed across-rolls in px (whole periods)."""
    s = np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((128, 128), Image.BILINEAR)).astype(float)
    s = ndimage.gaussian_filter(s, (1.5, 1.5, 0)); W = int(BAND * 128); band = np.r_[0:W, 128 - W:128]; best = None
    dxs = range(W + 3, 128 - W - 3) if across is None else sorted({round(x * 128 / a.shape[1]) for x in across})
    for dx in dxs:
        for dy in (range(128) if along_ok else [0]):
            d = ((s[:, band] - np.roll(np.roll(s, dx, axis=1), dy, axis=0)[:, band]) ** 2).mean()
            if best is None or d < best[0]: best = (d, dx, dy)
    half = ((s[:, band] - np.roll(s, 64, axis=1)[:, band]) ** 2).mean()
    dx = best[1] * a.shape[1] // 128
    if across is not None: dx = min(across, key=lambda x: abs(x - dx))
    return dx, best[2] * a.shape[0] // 128, best[0] / half

NO_ALONG = set()   # (plaster v3a had a horizontal gutter; v3b has none)   # a straight horizontal feature (the drain gutter) must not be rolled along Y in the L/R join
def join(a, across=None, along_ok=True):
    notes = []
    t = a.transpose(1, 0, 2); dx, dy, q = best_shift(t, False); a = cut(t, dx).transpose(1, 0, 2); notes.append(f'T/B copy rolled {dx}px along Y ({q:.2f} of half-offset diff)')
    dx, dy, q = best_shift(a, along_ok, across); a = cut(a, dx, dy); notes.append(f'L/R copy rolled {dx}px across, {dy}px along ({q:.2f})')
    return a, '; '.join(notes)

def period(a, expect):
    """Line period in px across X (vertical lines), searched within 30% of the expected value."""
    lum = a.mean(axis=2); g = np.abs(np.diff(lum, axis=1)).mean(axis=0); g = g - g.mean()
    ac = np.correlate(g, g, 'full')[len(g) - 1:]; lo, hi = int(expect * 0.7), int(expect * 1.3)
    return lo + int(np.argmax(ac[lo:hi])), float(ac[lo:hi].max() / ac[0])

def lines(a, name):
    N = LINES[name]; n = a.shape[1]; p, s = period(a, n / N); k = max(1, int(n / p + 0.25)); cols = min(n, round(k * p))
    a = np.asarray(Image.fromarray(np.clip(a[:, :cols], 0, 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)).astype(float)
    P = 1024 / k; lo, hi = BAND + 0.02, 1 - BAND - 0.02
    across = [round(j * P) for j in range(1, k) if lo <= j / k <= hi] or [round(P * (k // 2))]
    a, note = join(a, across)
    return a, f'period {p}px (strength {s:.2f}) -> {k} periods, kept {cols}px of width, resized; ' + note

COURSES = {'flagstone': 3}    # horizontal mortar courses expected per tile (pale joint lines along X)
def joints(a, N):
    """Centres of the pale horizontal joint lines (row-mean luminance peaks after removing the slow trend)."""
    r = a.mean(axis=(1, 2)); r = r - ndimage.uniform_filter1d(r, 61, mode='nearest'); n = len(r); out = []
    for i in np.argsort(r)[::-1]:
        if all(abs(i - p) > n / N / 2 for p in out): out.append(int(i))
        if len(out) >= N + 1: break
    return sorted(out), r

def courses(a, name):
    """Coursed slabs: no T/B cut at all (a cut across courses leaves dangling head joints). Crop the height from the
    centre of the first joint line to the centre of the last one (whole courses, half a joint on each edge, so the wrap
    makes one whole joint and head joints meet a bed joint as in any staggered bond), resize, then the usual L/R cut
    with the copy rolled across only."""
    N = COURSES[name]; j, r = joints(a, N); n = a.shape[0]
    def centre(p):      # luminance-weighted centre of the joint around p
        lo, hi = max(0, p - 12), min(n, p + 13); w = np.clip(r[lo:hi], 0, None) + 1e-6; return float((np.arange(lo, hi) * w).sum() / w.sum())
    c = [centre(p) for p in j]; y0, y1 = int(round(c[0])), int(round(c[-1]))
    a = np.asarray(Image.fromarray(np.clip(a[y0:y1], 0, 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)).astype(float)
    dx, dy, q = best_shift(a, False); a = cut(a, dx)
    return a, f'joint centres {[round(x) for x in c]} -> kept rows {y0}..{y1} ({len(c) - 1} courses), resized; L/R copy rolled {dx}px across ({q:.2f})'

if __name__ == '__main__':
    for n in sys.argv[1].split(','):
        src = f'{HERE}/inputs/roof-flat--{n}.jpg'
        a = np.asarray(Image.open(src).convert('RGB')).astype(float)
        before = (seam(a, 1), seam(a, 0), blotch(a)); a = flatten(a, float(os.environ.get('FLATTEN', '0.75')))
        a, note = lines(a, n) if n in LINES else courses(a, n) if n in COURSES else join(a, along_ok=n not in NO_ALONG)
        k = float(os.environ.get('DAMP', '0'))
        if k:   # landmark damping, as dun/flats finish.py damp(): take k of the patch-scale colour deviation off (wrap blur: still tiles)
            sig = float(os.environ.get('DAMP_SIG', '40')); res = a - a.mean(axis=(0, 1))
            low = np.stack([ndimage.gaussian_filter(res[..., c], sig, mode='wrap') for c in range(3)], -1)
            a = a - k * low; note += f'; landmarks damped {k:.0%} at sigma {sig:.0f}px (deviation {np.abs(low).mean():.1f} -> {np.abs(low).mean() * (1 - k):.1f})'
        a = np.clip(a, 0, 255)
        Image.fromarray(a.astype(np.uint8)).save(f'{HERE}/seamless/roof-flat--{n}.png')
        msg = f'{time.strftime("%F %T")} roof-flat--{n:10s} seam LR {before[0]:4.2f}->{seam(a, 1):4.2f}  TB {before[1]:4.2f}->{seam(a, 0):4.2f}  rank LR {seam_rank(a, 1):.0%} TB {seam_rank(a, 0):.0%}  blotch {before[2]:.2f}->{blotch(a):.2f}  mean RGB {a.mean(axis=(0, 1)).round(0)}  {note}'
        print(msg, flush=True); open(f'{HERE}/seamless.log', 'a').write(msg + '\n')

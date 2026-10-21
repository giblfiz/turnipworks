"""Make floor swatches tile (inputs/*.jpg -> seamless/*.png). Prints seam ratios (~1x = invisible) and blotch scores.
1. Flatten low-frequency tone (the blotches that make a 5-ft grid show when a tile repeats).
2. Patterned floors (bricks, checker, parquet, square slabs, terracotta): crop to a whole number of pattern periods
   found by autocorrelation, so the pattern itself wraps; organic floors: cross-fade with a half-offset copy."""
import glob, os
import numpy as np
from PIL import Image
from scipy import ndimage

BAND = 0.18
PATTERNED = ('brick-herringbone', 'checker-stone', 'parquet-herringbone', 'flagstone-square', 'terracotta')


def seam(a, axis):
    if axis == 1:
        return np.abs(a[:, 0] - a[:, -1]).mean() / np.abs(a[:, 1:] - a[:, :-1]).mean()
    return np.abs(a[0] - a[-1]).mean() / np.abs(a[1:] - a[:-1]).mean()


def blotch(a):  # std of heavily blurred luminance relative to overall std: how much big-scale tone varies
    lum = a.mean(axis=2)
    return ndimage.gaussian_filter(lum, a.shape[0] / 12).std() / lum.std()


def flatten(a, strength=0.75):
    low = np.stack([ndimage.gaussian_filter(a[..., c], a.shape[0] / 8, mode='wrap') for c in range(3)], -1)
    return a - strength * (low - low.mean(axis=(0, 1)))


def fade(a, axis):
    n = a.shape[axis]
    t = np.minimum(np.arange(n), n - 1 - np.arange(n)) / (BAND * n)
    w = np.clip(t, 0, 1); w = w * w * (3 - 2 * w)
    w = w[:, None, None] if axis == 0 else w[None, :, None]
    return a * w + np.roll(a, n // 2, axis=axis) * (1 - w)


def period(lum, axis, lo=40):
    x = lum - lum.mean()
    prof = np.fft.irfft(np.abs(np.fft.rfft(x, axis=axis)) ** 2, axis=axis).mean(axis=1 - axis)
    n = len(prof)
    cand = np.arange(lo, n // 2)
    return int(cand[np.argmax(prof[cand])])


def crop_periodic(a):
    lum = a.mean(axis=2)
    out = a
    for axis in (1, 0):
        p = period(lum, axis)
        n = out.shape[axis]
        k = max(1, n // p)
        size = k * p
        out = out[:, :size] if axis == 1 else out[:size]
    return out


for f in sorted(glob.glob('inputs/floor-*.jpg')):
    name = os.path.basename(f)[:-4]
    a = np.asarray(Image.open(f).convert('RGB')).astype(float)
    before = (seam(a, 1), seam(a, 0), blotch(a))
    a = flatten(a, 0.95 if 'earth-bare' in name else 0.75)
    if any(p in name for p in PATTERNED):
        a = crop_periodic(a)
        a = np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)).astype(float)
    for axis in (1, 0):
        if seam(a, axis) > 1.6:
            a = fade(a, axis)
    after = (seam(a, 1), seam(a, 0), blotch(a))
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(f'seamless/{name}.png')
    print(f'{name:28s} seam LR {before[0]:4.1f}->{after[0]:3.1f}  TB {before[1]:4.1f}->{after[1]:3.1f}  blotch {before[2]:.2f}->{after[2]:.2f}')

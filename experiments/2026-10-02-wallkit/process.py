"""Wall-kit textures: inputs/*.jpg -> seamless/<id>.png (albedo, 1024) + seamless/<id>.normal.png, plus 2x2 contact sheets.
Reuses the floors path (experiments/2026-10-01-floors/make_seamless.py): flatten low-frequency tone, crop to whole
pattern periods for coursed materials (stone courses, plank rows), cross-fade the rest. Normal map = Sobel of a blurred
luminance height (cheap; no extra generation)."""
import glob, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, '../2026-10-01-floors')
BAND = 0.18
PERIODIC = ('kit-stone', 'kit-wood')


def seam(a, axis):
    if axis == 1:
        return np.abs(a[:, 0] - a[:, -1]).mean() / np.abs(a[:, 1:] - a[:, :-1]).mean()
    return np.abs(a[0] - a[-1]).mean() / np.abs(a[1:] - a[:-1]).mean()


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


def crop_rows(a):
    """Coursed materials only need the VERTICAL period exact (course lines must meet top to bottom); horizontal seams
    are cross-faded."""
    lum = a.mean(axis=2)
    p = period(lum, 0, lo=60)
    k = max(1, a.shape[0] // p)
    return a[:k * p], p, k


def normal_from(a, strength=2.2):
    h = ndimage.gaussian_filter(a.mean(axis=2) / 255.0, 1.2, mode='wrap')
    dx = ndimage.sobel(h, axis=1, mode='wrap'); dy = ndimage.sobel(h, axis=0, mode='wrap')
    n = np.stack([-dx * strength, dy * strength, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


os.makedirs('seamless', exist_ok=True); os.makedirs('sheets', exist_ok=True)
for f in sorted(glob.glob('inputs/*.jpg')):
    name = os.path.basename(f)[:-4]
    a = np.asarray(Image.open(f).convert('RGB')).astype(float)
    before = (seam(a, 1), seam(a, 0))
    a = flatten(a)
    note = ''
    if any(name.startswith(p) for p in PERIODIC):
        a, p, k = crop_rows(a)
        note = f'rows: period {p}px x{k}'
        a = np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)).astype(float)
    for axis in (1, 0):
        if seam(a, axis) > 1.6:
            a = fade(a, axis)
    after = (seam(a, 1), seam(a, 0))
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    img.save(f'seamless/{name}.png')
    Image.fromarray(normal_from(a)).save(f'seamless/{name}.normal.png')
    sheet = Image.new('RGB', (1024, 1024))
    small = img.resize((512, 512), Image.LANCZOS)
    for i in range(2):
        for j in range(2):
            sheet.paste(small, (i * 512, j * 512))
    sheet.save(f'sheets/{name}.2x2.jpg', quality=88)
    print(f'{name:18s} seam LR {before[0]:4.1f}->{after[0]:3.1f}  TB {before[1]:4.1f}->{after[1]:3.1f}  {note}')

"""Find the courses and the single shingles in a seamless roofing plate (measurement only; build_sections.py uses it).
Image: courses along X, eaves at the BOTTOM, tiles on all four edges (flats/finish.py). Everything is periodic."""
import numpy as np
from PIL import Image
from scipy import ndimage, signal

COURSES = {'thatch': 3, 'tile': 6, 'slate': 8, 'shingle': 6}

def load(path, n=1024):
    return np.asarray(Image.open(path).convert('RGB').resize((n, n), Image.LANCZOS)).astype(float) / 255

def lip_lines(lum, C, smooth_x, ragged):
    """per course, per column: the row of the butt edge (the lit shingle above, its shadow just below). Returns (C, N) rows, top course first."""
    N = lum.shape[0]
    # the shadow under a butt: a strong lit -> dark step going DOWN the image
    step = ndimage.gaussian_filter1d(lum, 1.5, axis=0, mode='wrap'); step = step - np.roll(step, -3, axis=0)  # > 0 where it gets darker 3 px below
    prof = ndimage.gaussian_filter1d(step.mean(axis=1), 2, mode='wrap')
    pk, _ = signal.find_peaks(np.concatenate([prof, prof, prof]), distance=int(N / C * 0.6))
    pk = np.array(sorted({int(p) % N for p in pk if N <= p < 2 * N})); pk = pk[np.argsort(-prof[pk])][:C]; pk.sort()
    assert len(pk) == C, (len(pk), C)
    win = int(N / C * (0.33 if ragged else 0.12)); lines = []
    sx = ndimage.gaussian_filter1d(step, smooth_x, axis=1, mode='wrap')
    for r in pk:
        rows = (np.arange(-win, win + 1) + r) % N; band = sx[rows, :]                    # (2win+1, N)
        w = np.exp(-0.5 * (np.arange(-win, win + 1) / (win * 0.7)) ** 2)[:, None]        # prefer the nominal row
        y = (np.argmax(band * w, axis=0) - win + r).astype(float)
        y = ndimage.median_filter(y, size=max(3, int(smooth_x * 2) | 1), mode='wrap')
        lines.append(y + 1.5)                                                           # the edge sits in the middle of the 3-px step
    return np.array(lines), pk

def joints(lum, lines, k, min_w, prom):
    """vertical joints of course k (the shingles BETWEEN lip line k-1 (above) and lip line k (their own butt)): columns."""
    N = lum.shape[0]; C = len(lines)
    top = lines[(k - 1) % C] - (N if k == 0 else 0); bot = lines[k]
    xs = np.arange(N); a = np.zeros(N); cnt = np.zeros(N)
    for f in np.linspace(0.25, 0.85, 14):                         # rows through the body of the course, clear of both shadows
        y = np.round(top + (bot - top) * f).astype(int) % N; a += lum[y, xs]; cnt += 1
    col = ndimage.gaussian_filter1d(a / cnt, 1.2, mode='wrap'); base = ndimage.median_filter(col, size=int(min_w * 1.5) | 1, mode='wrap')
    dip = base - col
    pk, _ = signal.find_peaks(np.concatenate([dip, dip, dip]), distance=int(min_w), prominence=prom)
    return np.array(sorted({int(p) % N for p in pk if N <= p < 2 * N}))

#!/usr/bin/env python3
"""inputs/<sku>.jpg -> seamless/<sku>.png (1024 px, opaque, tiles on all four edges). The outdoors second-batch method
(experiments/2026-10-05-outdoors/finish_new.py): flatten the low-frequency tone, then join each pair of edges to a
shifted copy of the tile with a CUT along the cheapest ragged line inside the edge band (no cross-fade: it ghosts
anything with shapes in it). Additions here:
  * coursed roofing: first crop to a whole number of courses (and of tiles, where the tiles have one width), found by
    autocorrelation, and shift the copy by whole courses / whole tiles, so that courses and bond close at the seam;
  * variants (<sku>--vN): colour-matched to the finished base (per-channel mean/std, as outdoors normalize_variants.py).
Prints the MEASURED seam ratio (mean step across the wrap / mean step inside the tile; ~1 = no seam) and blotch score.
    python3 finish.py sku,sku,...        (bases before their variants)"""
import os, sys, re
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
BAND, FEATHER = 0.18, 1.5
# roofing: (courses expected, bonded = alternate courses shifted half a tile, tiles per course or None for random widths)
ROOF = {'roofing-thatch': (3, False, None), 'roofing-tile-clay': (6, True, 8), 'roofing-slate': (8, True, 6), 'roofing-shingle-wood': (6, False, None)}

def seam(a, axis):
    if axis == 1: return np.abs(a[:, 0] - a[:, -1]).mean() / np.abs(a[:, 1:] - a[:, :-1]).mean()
    return np.abs(a[0] - a[-1]).mean() / np.abs(a[1:] - a[:-1]).mean()
def seam_rank(a, axis):
    """Share of the tile's own interior line-to-line steps that are at least as big as the step across the wrap (a joint
    or a course shadow lying on the border makes a big honest step: then many interior lines match it). ~0 = a real seam."""
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
    """Join the left/right edges: inside each edge band switch from the shifted copy (at the edge) to the tile.
    shift = how far the copy is rolled across the seam (default half); along = extra roll along the seam."""
    n = a.shape[1]; W = int(BAND * n); r = np.roll(np.roll(a, shift or n // 2, axis=1), along, axis=0)
    d = ndimage.gaussian_filter(((a - r) ** 2).sum(axis=2), 2, mode='wrap') + 1.0
    m = np.ones(a.shape[:2])
    pl = path(d[:, :W]); pr = path(d[:, n - W:][:, ::-1])
    xx = np.arange(n)[None, :]
    m[xx < pl[:, None]] = 0; m[xx > (n - 1 - pr)[:, None]] = 0
    m = ndimage.gaussian_filter(m, FEATHER, mode='wrap')[..., None]
    return a * m + r * (1 - m)

def best_shift(a, along_ok):
    """Where to take the copy from, so that what it brings into the edge bands looks like what is already there: the
    (across, along) roll with the least mean squared difference to the tile inside the two bands. A plain half-offset
    copy carries whatever sits in the MIDDLE of the tile to its edges: a grave slab or a skull painted mid-tile came back
    as a second, clipped one on the seam. The copy's own wrap seam must stay outside the bands (across in [BAND+2%,
    1-BAND-2%]); an along-roll is allowed only once the other pair of edges already wraps."""
    s = np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((128, 128), Image.BILINEAR)).astype(float)
    s = ndimage.gaussian_filter(s, (1.5, 1.5, 0)); W = int(BAND * 128); band = np.r_[0:W, 128 - W:128]; best = None
    for dx in range(W + 3, 128 - W - 3):
        for dy in (range(128) if along_ok else [0]):
            d = ((s[:, band] - np.roll(np.roll(s, dx, axis=1), dy, axis=0)[:, band]) ** 2).mean()
            if best is None or d < best[0]: best = (d, dx, dy)
    half = ((s[:, band] - np.roll(s, 64, axis=1)[:, band]) ** 2).mean()
    return best[1] * a.shape[1] // 128, best[2] * a.shape[0] // 128, best[0] / half

def join(a):
    """Top/bottom first (copy rolled across only), then left/right (copy may also be rolled along, the tile now wrapping in y)."""
    notes = []
    t = a.transpose(1, 0, 2); dx, dy, q = best_shift(t, False); a = cut(t, dx).transpose(1, 0, 2); notes.append(f'T/B copy from {dx}px ({q:.2f} of the half-offset copy difference)')
    dx, dy, q = best_shift(a, True); a = cut(a, dx, dy); notes.append(f'L/R copy from {dx}px across, {dy}px along ({q:.2f})')
    return a, '; '.join(notes)

def period(a, axis, expect):
    """Pattern period in px along axis (0 = down the image), searched within 30% of the expected value."""
    lum = a.mean(axis=2); g = np.abs(np.diff(lum, axis=axis)).mean(axis=1 - axis); g = g - g.mean()
    ac = np.correlate(g, g, 'full')[len(g) - 1:]; lo, hi = int(expect * 0.7), int(expect * 1.3)
    return lo + int(np.argmax(ac[lo:hi])), float(ac[lo:hi].max() / ac[0])

DAMP = {'roofing-tile-clay': 0.6, 'roofing-slate': 0.6, 'roofing-shingle-wood': 0.6}   # not thatch: no pieces
def damp(a, name):
    """Tone down LANDMARK pieces (one tile much darker or yellower than its neighbours shows the 5-ft grid over a whole
    roof): take 60% off the piece-scale colour deviation. The mean of each pixel row is left alone (that is the course
    shading and overlap shadow) and the blur wraps, so the tile still tiles. Gemini A/B on 3x3 sheets: grid 5 of 5 -> 1 of 5
    on all three, 'has not lost its piece-to-piece variation'."""
    k = DAMP.get(name)
    if not k: return a, ''
    res = a - a.mean(axis=1, keepdims=True); sig = 1024 / ROOF[name][0] * 0.22
    low = np.stack([ndimage.gaussian_filter(res[..., c], sig, mode='wrap') for c in range(3)], -1)
    return a - k * low, f'; landmark pieces damped {k:.0%} (piece-tone deviation {np.abs(low).mean():.1f} -> {np.abs(low).mean() * (1 - k):.1f})'

def roof(a, name):
    """Crop to whole courses (an even number when bonded) and whole tiles, back to 1024, then cut with whole-period shifts."""
    N, bonded, T = ROOF[name]; n = a.shape[0]; note = []
    h, sh = period(a, 0, n / N); k = int(n / h + 0.25)
    if bonded and k % 2: k -= 1
    rows = min(n, round(k * h)); note.append(f'course {h}px (strength {sh:.2f}) -> {k} courses, keep {rows}px of height')
    a = a[:rows]
    if T:
        w, sw = period(a, 1, n / T); t = int(n / w + 0.25); cols = min(n, round(t * w)); a = a[:, :cols]
        note.append(f'tile {w}px (strength {sw:.2f}) -> {t} tiles, keep {cols}px of width')
    a = np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)).astype(float)
    hh = 1024 / k; ww = 1024 / t if T else None
    vs = round(hh * (2 * round(k / 4) if bonded else round(k / 2))) or round(hh)     # whole courses, bond parity kept
    hs = round(ww * round(t / 2)) if T else 512
    if seam(a, 1) > 1.25: a = cut(a, hs); note.append(f'L/R cut, copy shifted {hs}px')
    if seam(a, 0) > 1.25: a = cut(a.transpose(1, 0, 2), vs).transpose(1, 0, 2); note.append(f'T/B cut, copy shifted {vs}px')
    a, dn = damp(a, name)
    return a, '; '.join(note) + dn

# ---- stage 2: exact lattice floors and the striped lawn
GRID = {'floor-marble-cabochon': 2, 'floor-parquet-versailles': 2, 'floor-tile-encaustic': 5}   # pattern periods per 5-ft tile

def lattice_period(a, axis, expect):
    """Pattern period along axis by autocorrelation of the luminance itself, within 25% of the expected value."""
    lum = a.mean(axis=2); lum = lum - ndimage.gaussian_filter(lum, 40)
    f = np.fft.rfft(lum, axis=axis); ac = np.fft.irfft(np.abs(f) ** 2, axis=axis).mean(axis=1 - axis)
    lo, hi = int(expect * 0.75), int(expect * 1.25); p = lo + int(np.argmax(ac[lo:hi]))
    y0, y1, y2 = ac[p - 1], ac[p], ac[p + 1]; d = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2 + 1e-9)     # sub-pixel peak
    return p + float(np.clip(d, -1, 1)), float(ac[p] / ac[0])

def grid(a, name, base=None):
    """Crop to K whole pattern periods each way (K x K units = one 5-ft tile) and resize to 1024; mend what is left of the
    seam with a cut whose copy is shifted by whole periods (that cannot break the pattern); then ROLL the now-wrapping tile
    so that its borders lie on a line where the pattern is mirror-symmetric (a joint line), searched within a third of a
    period of where the plate had it. A variant is rolled to the phase of its base instead, so variants can be mixed."""
    K = GRID[name]; n = a.shape[0]; notes = []
    px, sx = lattice_period(a, 1, n / K); py, sy = lattice_period(a, 0, n / K)
    w, h = min(n, int(round(K * px))), min(n, int(round(K * py)))
    notes.append(f'period {px:.1f} x {py:.1f} px (strength {sx:.2f}, {sy:.2f}; {n / K:.1f} = exact), kept {w}x{h} px')
    a = np.asarray(Image.fromarray(np.clip(a[:h, :w], 0, 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)).astype(float)
    P = 1024 // K; sh = P * max(1, K // 2)
    if seam(a, 1) > 1.15: a = cut(a, sh); notes.append('L/R cut')
    if seam(a, 0) > 1.15: a = cut(a.transpose(1, 0, 2), sh).transpose(1, 0, 2); notes.append('T/B cut')
    if base is None:
        def sym(prof):
            best = None
            for o in range(-P // 3, P // 3 + 1):
                k = np.arange(1, P // 2); d = np.abs(prof[(o + k) % 1024] - prof[(o - k) % 1024]).mean()
                if best is None or d < best[0]: best = (d, o)
            return best[1]
        ox, oy = sym(a.mean(axis=(0, 2))), sym(a.mean(axis=(1, 2)))
    else:                         # the base's phase: circular cross-correlation of luminance, searched within one period
        A = np.fft.fft2(a.mean(axis=2) - a.mean()); Bf = np.fft.fft2(base.mean(axis=2) - base.mean()); c = np.fft.ifft2(Bf * np.conj(A)).real
        c = np.roll(np.roll(c, P // 2, axis=0), P // 2, axis=1)[:P, :P]; dy, dx = np.unravel_index(np.argmax(c), c.shape); ox, oy = -(dx - P // 2), -(dy - P // 2)
    a = np.roll(np.roll(a, -oy, axis=0), -ox, axis=1); notes.append(f'rolled ({-ox},{-oy}) px ' + ('onto the symmetry lines' if base is None else 'to the base phase'))
    return a, '; '.join(notes)

def lawn(a):
    """Mowing stripes are IMPOSED, not painted: two 30-in stripes per 5-ft tile running along image X (top half lighter,
    bottom half darker, +/-12% with a soft edge; +/-7% was too faint for Gemini to see), so they are exact and run on from cell to cell. The plate is a plain
    lawn; its own tone is flattened harder first."""
    a = flatten(a, 0.9); a, note = join(a); n = a.shape[0]; y = (np.arange(n) + 0.5) / n
    edge = np.minimum.reduce([np.abs(y - 0.0), np.abs(y - 0.5), np.abs(y - 1.0)]) / 0.0125
    g = np.where(y < 0.5, 1.0, -1.0) * np.clip(edge, 0, 1)
    return a * (1 + 0.12 * g)[:, None, None], note + "; mowing stripes imposed: top half +12%, bottom half -12%"

for n in sys.argv[1].split(','):
    a = np.asarray(Image.open(f'{HERE}/inputs/{n}.jpg').convert('RGB')).astype(float)
    before = (seam(a, 1), seam(a, 0), blotch(a)); a = flatten(a); note = ''
    b0 = n.split('--')[0]; isvar = b0 != n
    if b0 in GRID:
        a = np.asarray(Image.open(f'{HERE}/inputs/{n}.jpg').convert('RGB')).astype(float)      # no tone flattening before the period search
        a, note = grid(a, b0, np.asarray(Image.open(f'{HERE}/seamless/{b0}.png').convert('RGB')).astype(float) if isvar else None)
        a = flatten(a, 0.6)
    elif b0 == 'floor-lawn-mown': a, note = lawn(np.asarray(Image.open(f'{HERE}/inputs/{n}.jpg').convert('RGB')).astype(float))
    elif n.split('--')[0] in ROOF: a, note = roof(a, n.split('--')[0])
    else: a, note = join(a)
    base = re.sub(r'--v\d$', '', n)
    if base != n:   # colour-match the variant to the finished base
        b = np.asarray(Image.open(f'{HERE}/seamless/{base}.png').convert('RGB')).astype(float)
        a = (a - a.mean(axis=(0, 1))) / (a.std(axis=(0, 1)) + 1e-6) * b.std(axis=(0, 1)) + b.mean(axis=(0, 1)); note += f' matched to {base}'
    a = np.clip(a, 0, 255)
    Image.fromarray(a.astype(np.uint8)).save(f'{HERE}/seamless/{n}.png')
    msg = f'{n:24s} seam LR {before[0]:4.1f}->{seam(a, 1):4.2f}  TB {before[1]:4.1f}->{seam(a, 0):4.2f}  rank LR {seam_rank(a, 1):.0%} TB {seam_rank(a, 0):.0%}  blotch {before[2]:.2f}->{blotch(a):.2f}  mean RGB {a.mean(axis=(0, 1)).round(0)}  {note}'
    print(msg, flush=True); open(f'{HERE}/seamless.log', 'a').write(msg + '\n')

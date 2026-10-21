#!/usr/bin/env python3
"""raw/strips-in/<sku>.png (as painted, edge to edge) -> decals/<sku>.jpg: an OPAQUE plate with no chroma margin.
Strips (chasm-strip*, sewer-channel-strip*) repeat LEFT-RIGHT in a row of 5-ft tiles, so only the left/right pair of
edges is closed: finish.py's seam step restricted to the X axis (tone flattened along X only, then a CUT along the
cheapest ragged line inside each 18% edge band, the copy rolled along X only). Top and bottom (rock lips / kerbs) are
never touched by a blend: they stay as painted. `pit-open` gets no seam step (it is laid alone).
`chasm-strip-wide` is brought to 1024 x 2048 (5 ft x 10 ft): if the plate is less tall than 1:2, the top and bottom
12% (the lips) keep their scale and only the drop between them is stretched.
Key guard: tools/spawn-tuner/prep/flats.py keys `b > r+35 and b > g+15` when it is connected to the plate border. Any
such pixel here (blue-grey mist) has its blue lowered until the test fails, so the box flats.py crops to is the whole
plate. That box is measured with flats.py's own key_blue and printed.
Sheets -> raw/checks/: <sku>-3x1.jpg (three in a row) and <sku>-in-floor.jpg (the row between two rows of floor).
    python3 finish_strips.py sku,sku,..."""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__)); MAIN = '<repo>'
sys.path.insert(0, os.path.join(MAIN, 'tools', 'spawn-tuner', 'prep'))
from flats import key_blue
BAND, FEATHER = 0.18, 1.5

def seam(a): return np.abs(a[:, 0] - a[:, -1]).mean() / np.abs(a[:, 1:] - a[:, :-1]).mean()
def seam_rank(a):
    t = a.transpose(1, 0, 2); inner = np.abs(t[1:] - t[:-1]).mean(axis=(1, 2)); return float((inner >= np.abs(t[0] - t[-1]).mean()).mean())

def path(cost):                       # finish.py
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

def cut_x(a, shift):                  # finish.py cut(), copy rolled along X only (rows are never moved)
    n = a.shape[1]; W = int(BAND * n); r = np.roll(a, shift, axis=1)
    d = ndimage.gaussian_filter(((a - r) ** 2).sum(axis=2), 2, mode='wrap') + 1.0
    m = np.ones(a.shape[:2]); pl = path(d[:, :W]); pr = path(d[:, n - W:][:, ::-1]); xx = np.arange(n)[None, :]
    m[xx < pl[:, None]] = 0; m[xx > (n - 1 - pr)[:, None]] = 0
    m = ndimage.gaussian_filter1d(m, FEATHER, axis=1, mode='wrap')[..., None]     # feather across the cut only (X)
    return a * m + r * (1 - m)

def best_shift_x(a):                  # finish.py best_shift() with along_ok=False
    s = np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((128, 128), Image.BILINEAR)).astype(float)
    s = ndimage.gaussian_filter(s, (1.5, 1.5, 0)); W = int(BAND * 128); band = np.r_[0:W, 128 - W:128]; best = None
    for dx in range(W + 3, 128 - W - 3):
        d = ((s[:, band] - np.roll(s, dx, axis=1)[:, band]) ** 2).mean()
        if best is None or d < best[0]: best = (d, dx)
    half = ((s[:, band] - np.roll(s, 64, axis=1)[:, band]) ** 2).mean()
    return best[1] * a.shape[1] // 128, best[0] / half

def flatten_x(a, strength=0.75):
    """Low-frequency tone ALONG X only (each row keeps its own mean: the drop stays dark, the lips stay light)."""
    low = ndimage.gaussian_filter1d(ndimage.gaussian_filter1d(a, 24, axis=0, mode='nearest'), a.shape[1] / 6, axis=1, mode='wrap')
    return a - strength * (low - low.mean(axis=1, keepdims=True))

def margin(a):
    """How much of each side is a flat single-colour border (a painted margin would leave gaps in the row)."""
    out = []
    for side in (a[:, :8], a[:, -8:], a[:8], a[-8:]): out.append(float(side.reshape(-1, 3).std(axis=0).mean()))
    return out

for n in sys.argv[1].split(','):
    im = Image.open(f'{HERE}/raw/strips-in/{n}.png').convert('RGB'); src = im.size; note = []
    if n.startswith('chasm-strip-wide'):
        w, h = im.size; s = 1024 / w; im = im.resize((1024, round(h * s)), Image.LANCZOS); h = im.height
        if h != 2048:
            lip = round(0.12 * h); a = np.asarray(im)
            mid = Image.fromarray(a[lip:h - lip]).resize((1024, 2048 - 2 * lip), Image.LANCZOS)
            im = Image.fromarray(np.vstack([a[:lip], np.asarray(mid), a[h - lip:]])); note.append(f'plate {src[0]}x{src[1]}: lips ({lip}px top and bottom) kept, the drop stretched x{(2048 - 2 * lip) / (h - 2 * lip):.2f} in height')
    else:
        if abs(im.width / im.height - 1) > 0.02: note.append(f'plate {src[0]}x{src[1]} is not square: resized')
        im = im.resize((1024, 1024), Image.LANCZOS)
    a = np.asarray(im).astype(float); mg = margin(a); before = seam(a)
    if not n.startswith('pit-open'):
        a = flatten_x(a); dx, q = best_shift_x(a); a = cut_x(a, dx); note.append(f'L/R cut, copy rolled {dx}px along X ({q:.2f} of the half-offset copy difference)')
    a = np.clip(a, 0, 255); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    risky = (b > r + 25) & (b > g + 8); a[..., 2] = np.where(risky, np.maximum(r + 25, g + 8), b); note.append(f'key guard lowered blue on {risky.mean():.2%} of pixels')
    out = f'{HERE}/decals/{n}.jpg'; Image.fromarray(a.astype(np.uint8)).save(out, quality=95, subsampling=0)
    saved = Image.open(out); rgba, mask = key_blue(saved); ys, xs = np.nonzero(mask); box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    sa = np.asarray(saved.convert('RGB')).astype(float); W, H = saved.size
    full = box == (0, 0, W, H) and mask.all()
    print(f'{n}: {W}x{H}; prep/flats.py box {box} keyed {1 - mask.mean():.3%} -> {"FULL PLATE, opaque" if full else "NOT THE FULL PLATE"}; seam L/R {before:.2f} -> {seam(sa):.2f} (wrap-step rank {seam_rank(sa):.0%}); flat-border score L,R,T,B {[round(m, 1) for m in mg]} (near 0 = a painted margin); ' + '; '.join(note), flush=True)
    open(f'{HERE}/strips.log', 'a').write(f'{n}: box {box} of {W}x{H}, seam L/R {before:.2f}->{seam(sa):.2f}; ' + '; '.join(note) + '\n')
    t = saved.convert('RGB').resize((384, 384 * H // W), Image.LANCZOS); sh = Image.new('RGB', (384 * 3, t.height))
    for i in range(3): sh.paste(t, (i * 384, 0))
    sh.save(f'{HERE}/raw/checks/{n}-3x1.jpg', quality=92)
    gf = f'{HERE}/seamless/floor-cut-rock.png' if n.startswith('chasm') and os.path.exists(f'{HERE}/seamless/floor-cut-rock.png') else f'{MAIN}/experiments/2026-10-01-floors/seamless/floor-flagstone-damp.png'
    fl = Image.open(gf).convert('RGB').resize((384, 384), Image.LANCZOS); ctx = Image.new('RGB', (384 * 3, 384 * 2 + t.height))
    for i in range(3): ctx.paste(fl, (i * 384, 0)); ctx.paste(t, (i * 384, 384)); ctx.paste(fl, (i * 384, 384 + t.height))
    ctx.save(f'{HERE}/raw/checks/{n}-in-floor.jpg', quality=92)

"""Flagstone floors as a 20x20-ft PERIODIC stone layout (relaxed Voronoi on a torus), cut into 4x4 cell tiles g00..g33.
Neighbouring cells continue each other exactly; the layout repeats only every 20 ft. Stones are filled with the painted
Gemini flagstone texture (random source/offset/tint per stone), mortar on Voronoi edges, a soft bevel; the broken variant
drops ~18% of stones to dirt and cracks ~30% of the rest.  python compose_flag.py"""
import glob
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree

C, N = 512, 4          # px per 5-ft cell, cells per side
S = C * N              # 2048 px = 20 ft
MORTAR = np.array([58, 54, 50], float)


def relaxed_seeds(rng, n, iters=3):
    pts = rng.uniform(0, S, (n, 2))
    yy, xx = np.mgrid[0:S:4, 0:S:4]
    q = np.stack([xx.ravel(), yy.ravel()], 1).astype(float)
    for _ in range(iters):  # Lloyd relaxation on the torus (coarse grid)
        tree = cKDTree(np.concatenate([pts + [ox, oy] for ox in (-S, 0, S) for oy in (-S, 0, S)]))
        _, k = tree.query(q); k %= n
        for i in range(n):
            m = q[k == i]
            if len(m):
                # circular mean on the torus
                ang = m / S * 2 * np.pi
                pts[i] = (np.arctan2(np.sin(ang).mean(0), np.cos(ang).mean(0)) / (2 * np.pi) * S) % S
    return pts


def compose(rng, sources, dirt, broken):
    n = 60 if not broken else 71
    pts = relaxed_seeds(rng, n)
    allp = np.concatenate([pts + [ox, oy] for ox in (-S, 0, S) for oy in (-S, 0, S)])
    ids = np.tile(np.arange(n), 9)
    yy, xx = np.mgrid[0:S, 0:S]
    d, k = cKDTree(allp).query(np.stack([xx.ravel(), yy.ravel()], 1).astype(float), k=2)
    owner = ids[k[:, 0]].reshape(S, S); gap = (d[:, 1] - d[:, 0]).reshape(S, S)
    cen = allp[k[:, 0]]
    img = np.zeros((S, S, 3))
    missing = set(rng.choice(n, int(n * 0.18), replace=False)) if broken else set()
    for i in range(n):
        m = owner == i
        if i in missing:
            src, scale = dirt, 1.0
        else:
            src = sources[rng.integers(len(sources))]
        a = np.asarray(src).astype(float) * rng.uniform(0.9, 1.08) * rng.uniform(0.97, 1.03, 3)
        h, w = a.shape[:2]
        # sample WITHOUT wrap (the painted sources aren't seamless): keep the whole stone inside the source image
        relx = xx[m] - cen.reshape(S, S, 2)[m][:, 0]; rely = yy[m] - cen.reshape(S, S, 2)[m][:, 1]
        rx, ry = int(np.abs(relx).max()) + 2, int(np.abs(rely).max()) + 2
        ox = rng.integers(rx, max(rx + 1, w - rx)); oy = rng.integers(ry, max(ry + 1, h - ry))
        lx = np.clip(relx + ox, 0, w - 1).astype(int); ly = np.clip(rely + oy, 0, h - 1).astype(int)
        img[m] = a[ly, lx]
    # bevel toward the joints, mortar on the joints (missing stones: no bevel, softer edge)
    stone = ~np.isin(owner, list(missing)) if missing else np.ones_like(owner, bool)
    shade = np.clip(gap / 22, 0, 1) ** 0.5
    img[stone] *= (0.72 + 0.28 * shade[stone])[:, None]
    joint = gap < 7
    img[joint & stone] = MORTAR + rng.normal(0, 4, (int((joint & stone).sum()), 3))
    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    if broken:  # cracks across ~30% of the remaining stones (wrapped drawing)
        dr = ImageDraw.Draw(out)
        for i in rng.choice([j for j in range(n) if j not in missing], int(n * 0.3), replace=False):
            x0, y0 = pts[i]
            pts_line = [(x0 + rng.normal(0, 30), y0 + rng.normal(0, 30))]
            ang = rng.uniform(0, np.pi)
            for t in range(5):
                x, y = pts_line[-1]; ang += rng.normal(0, 0.5)
                pts_line.append((x + np.cos(ang) * 28, y + np.sin(ang) * 28))
            for ox in (-S, 0, S):
                for oy in (-S, 0, S):
                    dr.line([(x + ox, y + oy) for x, y in pts_line], fill=tuple(int(v) for v in MORTAR - 10), width=3)
    return out


if __name__ == '__main__':
    src = [Image.open(f).convert('RGB').resize((768, 768)) for f in sorted(glob.glob('inputs/floor-flagstone-large*.jpg'))]
    dirt = Image.open('seamless/floor-earth-bare.png').convert('RGB').resize((768, 768))
    for name, broken in (('floor-flagstone-large', False), ('floor-flagstone-broken', True)):
        rng = np.random.default_rng(7 if not broken else 11)
        big = compose(rng, src, dirt, broken)
        big.save(f'/tmp/scratch/{name}-super.png')
        for gi in range(N):
            for gj in range(N):
                big.crop((gi * C, gj * C, (gi + 1) * C, (gj + 1) * C)).save(f'composed/{name}--g{gi}{gj}.png')
    print('ok')

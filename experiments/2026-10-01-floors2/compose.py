"""Patterned floors composed from Gemini-painted tile pieces on EXACT grids (Gemini can't paint an exact 4x4 checker or a
periodic herringbone). Every output tiles perfectly by construction; each tile gets a random painted variant, rotation and a
slight tint jitter so it still reads hand-painted. 1024 px = one 5-ft cell.  python compose.py -> composed/<floor>--c{1,2,3}.png"""
import glob, math
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

CELLS, PX = 4, 512   # a 20x20-ft periodic layout (4x4 cells of 512 px) cut into g00..g33: repeats only every 20 ft
S = CELLS * PX
GROUT = np.array([62, 55, 48], float)
import os
HB_MODE = os.environ.get('HB_MODE', 'strand')
SKIP = {'piece-delft--p2', 'piece-delft--p3'}  # Gemini put several tiles in these


def pieces(color):
    out = []
    for f in sorted(glob.glob(f'inputs/piece-{color}--p*.jpg')):
        if any(s in f for s in SKIP): continue
        im = Image.open(f).convert('RGB'); w, h = im.size
        out.append(im.crop((int(w * .14), int(h * .14), int(w * .86), int(h * .86))))  # drop painted bevels/edges
    return out


def tex(rng, plist, size, rotate=True):
    im = plist[rng.integers(len(plist))].resize(size, Image.LANCZOS)
    if rotate: im = im.rotate(90 * int(rng.integers(4)), expand=True).resize(size)
    a = np.asarray(im).astype(float) * rng.uniform(0.95, 1.05) * rng.uniform(0.98, 1.02, 3)
    return a


def grout_grid(img, cells_x, cells_y, g):
    cw, ch = S / cells_x, S / cells_y
    for i in range(cells_x + 1):
        x = int(round(i * cw)); img[:, max(0, x - g // 2):min(S, x + (g + 1) // 2)] = GROUT
    for j in range(cells_y + 1):
        y = int(round(j * ch)); img[max(0, y - g // 2):min(S, y + (g + 1) // 2), :] = GROUT
    return img


def squares(rng, n, colour_of, g=3):
    n *= CELLS
    img = np.zeros((S, S, 3)); c = S // n
    for j in range(n):
        for i in range(n):
            img[j * c:(j + 1) * c, i * c:(i + 1) * c] = tex(rng, colour_of(i, j, rng), (c, c))
    return grout_grid(img, n, n, g)


def herringbone(rng, black, white, g=3):
    n, u = 8 * CELLS, S // (8 * CELLS)  # rule found by find_herringbone.py: H at (x+y)%4==0, V at (x+y)%4==2
    img = np.zeros((S, S, 3)); mask = np.zeros((S, S), bool)
    for y in range(n):
        for x in range(n):
            k = (x + y) % 4
            if k not in (0, 2): continue
            horiz = k == 0
            w, h = (2 * u, u) if horiz else (u, 2 * u)
            # colour by diagonal strand (zigzag bands) unless HB_MODE == 'orient' (black horizontals, white verticals)
            dark = horiz if HB_MODE == 'orient' else ((x - y) // 4) % 2 == 0
            t = tex(rng, black if dark else white, (w, h), rotate=False)
            for oy in range(h):
                yy = (y * u + oy) % S
                xs = [(x * u + ox) % S for ox in range(w)]
                img[yy, xs] = t[oy]
            # grout on the brick outline
            x0, y0 = x * u, y * u
            for ox in range(w):
                for gy in range(g // 2 + 1): mask[(y0 + gy) % S, (x0 + ox) % S] = True; mask[(y0 + h - 1 - gy) % S, (x0 + ox) % S] = True
            for oy in range(h):
                for gx in range(g // 2 + 1): mask[(y0 + oy) % S, (x0 + gx) % S] = True; mask[(y0 + oy) % S, (x0 + w - 1 - gx) % S] = True
    img[mask] = GROUT
    return img


def harlequin(rng, a, b, P=128, g=3):
    yy, xx = np.mgrid[0:S, 0:S].astype(float)
    u, v = (xx + yy) / P, (xx - yy) / P
    iu, iv = np.floor(u).astype(int), np.floor(v).astype(int)
    img = np.zeros((S, S, 3))
    ids = {}
    for key in set(zip(iu.ravel()[::97], iv.ravel()[::97])) | set(zip(iu.ravel(), iv.ravel())):
        pass
    T = {}
    flat_u, flat_v = iu.ravel(), iv.ravel()
    keys = np.unique(np.stack([flat_u, flat_v], 1), axis=0)
    res = 160
    for ku, kv in keys:
        # diamonds that wrap across the tile edge share a texture with their wrapped twin (keyed modulo the period)
        wrap = (ku % (S // P), kv % (S // P))  # x+S shifts (u, v) by (+4, +4), y+S by (+4, -4)
        if wrap not in T: T[wrap] = tex(rng, a if (ku + kv) % 2 == 0 else b, (res, res))
    fu, fv = ((u - iu) * (res - 1)).astype(int), ((v - iv) * (res - 1)).astype(int)
    for (ku, kv) in keys:
        m = (iu == ku) & (iv == kv)
        t = T[(ku % (S // P), kv % (S // P))]
        img[m] = t[fu[m], fv[m]]
    edge = (np.minimum(u - iu, 1 - (u - iu)) * P < g / 1.4) | (np.minimum(v - iv, 1 - (v - iv)) * P < g / 1.4)
    img[edge] = GROUT
    return img


def hexes(rng, plist, g=3):
    cols, rows = 8 * CELLS, 7 * CELLS
    dx, dy = S / cols, S / rows
    cen = [(i * dx, j * dy + (i % 2) * dy / 2, i, j) for i in range(cols) for j in range(rows)]
    pts, ids = [], []
    for (x, y, i, j) in cen:
        for ox in (-S, 0, S):
            for oy in (-S, 0, S): pts.append((x + ox, y + oy)); ids.append(i * rows + j)
    tree = cKDTree(pts)
    yy, xx = np.mgrid[0:S, 0:S]
    d, k = tree.query(np.stack([xx.ravel(), yy.ravel()], 1).astype(float), k=2)
    ids = np.array(ids)
    owner = ids[k[:, 0]].reshape(S, S)
    edge = (d[:, 1] - d[:, 0]).reshape(S, S) < g
    img = np.zeros((S, S, 3)); res = int(dx * 1.3)
    T = [tex(rng, plist, (res, res)) for _ in range(cols * rows)]
    P = np.array(pts)[k[:, 0]]  # centre of the owning hex (possibly a wrapped copy): sample relative to it
    ox = np.clip((xx.ravel() - P[:, 0] + res / 2), 0, res - 1).astype(int).reshape(S, S)
    oy = np.clip((yy.ravel() - P[:, 1] + res / 2), 0, res - 1).astype(int).reshape(S, S)
    for t in range(cols * rows):
        m = owner == t
        img[m] = T[t][oy[m], ox[m]]
    img[edge] = GROUT
    return img


if __name__ == '__main__':
    R, W, B, TC, D = pieces('red'), pieces('white'), pieces('black'), pieces('terracotta'), pieces('delft')
    for v in (1,):
        rng = np.random.default_rng(1000 + v)
        out = {
            'floor-checker-red': squares(rng, 4, lambda i, j, r: R if (i + j) % 2 == 0 else W),
            'floor-checker-bw': squares(rng, 4, lambda i, j, r: B if (i + j) % 2 == 0 else W),
            'floor-tile-kitchen-small': squares(rng, 8, lambda i, j, r: TC if r.random() < 0.72 else W, g=5),
            'floor-tile-delft': squares(rng, 4, lambda i, j, r: D if (i + j) % 2 == 0 else W),
            'floor-brick-herringbone-bw': herringbone(rng, B, W),
            'floor-tile-harlequin': harlequin(rng, R, W),
            'floor-tile-hex': hexes(rng, TC),
        }
        for name, a in out.items():
            big = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
            for gi in range(CELLS):
                for gj in range(CELLS):
                    big.crop((gi * PX, gj * PX, (gi + 1) * PX, (gj + 1) * PX)).save(f'composed/{name}--g{gi}{gj}.png')
    print('composed', len(out), 'floors x', CELLS * CELLS, 'tiles')

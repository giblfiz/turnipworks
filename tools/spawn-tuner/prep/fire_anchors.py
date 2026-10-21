"""Derive per-sku flame anchors from the mesh geometry -> data/fire_anchors.json (2026-10-02, Fauna).

Anchors are stored NORMALISED to the GLB's own bounding box (u = (p - min) / size per axis), so the runtime can map
them onto whatever geometry is on screen (shipping GLB or a faces-ladder LOD with its own scale) through the mesh
root's transform: catalog scale, orient.json yaw and LOD swaps all come along for free.

Methods (native GLB frame: y up, base at y = 0, centred in x/z):
  tips    candles, candlesticks, candelabra, stubs, chandeliers: local maxima of an x/z height map (wick tops)
  head    torches: centroid of the topmost vertices (the torch head)
  cavity  hearths, ovens: ray-cast a grid; cavity = roof above, floor below, walls left+right, open to exactly one
          of +z/-z (the mouth). Anchor = cavity floor centre; also stores the mouth direction and cavity width
  body    lanterns: centre of the widest horizontal band (the body), off the post for lamp posts
Also measures every anchor (old heuristic and new) against the mesh: distance to the nearest surface in inches at
catalog size, and for interior anchors whether rays in 4 horizontal directions are all blocked (enclosed).

python prep/fire_anchors.py            (from tools/spawn-tuner; needs trimesh + rtree: fauna-tools/browser-venv)
"""
import json, re, sys, math
from pathlib import Path
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parents[1] / 'server'))
from reviews_home import reviews_dir  # noqa: E402  the live records are outside the checkout (TW_REVIEWS_DIR)
lib = json.loads((ROOT / 'data/library.json').read_text())
orient = json.loads((ROOT / 'data/orient.json').read_text())
try:  # Harry's R-key corrections (latest per sku) win over the file, as in the tuner
    for line in (reviews_dir() / 'tuner/orient.jsonl').read_text().splitlines():
        r = json.loads(line); v = (r.get('data') or {}).get('yaw_deg', r.get('yaw_deg'))
        if v is not None: orient[r['name']] = float(v)
except FileNotFoundError:
    pass


def fire_type(i):  # mirror of js/fx/fire.js fireType()
    if re.match(r'^(fireplace|cook-hearth|hearth)', i) or re.search(r'-hearth$|^hearth-', i): return 'hearth'
    if re.search(r'rug|rake|mat\b', i): return None
    if 'oven' in i: return 'oven'
    if re.search(r'brazier|fire-pit|firepit', i): return 'brazier'
    if 'torch' in i: return 'torch'
    if 'chandelier' in i: return 'chandelier'
    if 'candelabra' in i: return 'candelabra'
    if 'candle-stubs' in i: return 'stubs'
    if 'candle' in i: return 'candle'
    if re.search(r'lantern|lamp', i): return 'lantern'
    if 'athanor' in i: return 'oven'
    if 'cresset' in i: return 'torch'
    if re.search(r'signal-beacon|boiling-oil|fire-basket|cauldron-crane|pig-on-spit', i): return 'brazier'
    if 'flame-bowl' in i: return 'brazier'
    if 'sand-tray' in i: return 'stubs'
    if i.startswith('flavor-censer'): return 'candle'
    return None


# the pre-2026-10-02 heuristic, as fractions of the item's catalog box (group-local, yaw applied by the mesh)
OLD = {'hearth': ('vol', 0.09, -0.08), 'oven': ('vol', 0.3, 0.32), 'brazier': ('vol', 1.0, 0), 'torch': ('vol', 0.82, 0.3),
       'lantern': ('one', 0.42), 'candle': ('one', 1.0), 'candelabra': ('row3', 1.0), 'stubs': ('cluster4', 1.0), 'chandelier': ('ring8', 1.0)}


def old_anchors(t, lo, hi, yaw):
    size = hi - lo; w, h, d = size
    o = OLD[t]
    if o[0] == 'vol': pts = [(0, o[1] * h, o[2] * d)]
    elif o[0] == 'row3': pts = [(f * w, o[1] * h, 0) for f in (-0.33, 0, 0.33)]
    elif o[0] == 'cluster4': pts = [(a * w, o[1] * h, c * d) for a, c in ((-0.18, -0.12), (0.15, -0.15), (-0.1, 0.16), (0.17, 0.12))]
    elif o[0] == 'ring8': pts = [(math.cos(i * math.pi / 4) * 0.42 * w, o[1] * h, math.sin(i * math.pi / 4) * 0.42 * d) for i in range(8)]
    else: pts = [(0, o[1] * h, 0)]
    a = -math.radians(yaw); c, s = math.cos(a), math.sin(a)  # local -> native: undo the mesh yaw
    out = []
    for x, y, z in pts:
        out.append(np.array([c * x + s * z, y + lo[1], -s * x + c * z]))
    return out


def heightmap_peaks(m, n_max, min_frac, exclude_axis=0.0, G=56, r=3):
    V = m.vertices; lo, hi = m.bounds; size = hi - lo
    ext = max(size[0], size[2]); cell = ext / G
    ix = np.clip(((V[:, 0] - lo[0]) / cell).astype(int), 0, G); iz = np.clip(((V[:, 2] - lo[2]) / cell).astype(int), 0, G)
    H = np.full((G + 1, G + 1), -1.0)
    np.maximum.at(H, (ix, iz), V[:, 1])
    peaks = []
    for i in range(G + 1):
        for j in range(G + 1):
            hv = H[i, j]
            if hv < lo[1] + min_frac * size[1]: continue
            win = H[max(0, i - r):i + r + 1, max(0, j - r):j + r + 1]
            if hv < win.max() - 1e-9: continue
            x, z = lo[0] + (i + 0.5) * cell, lo[2] + (j + 0.5) * cell
            if exclude_axis and math.hypot(x, z) < exclude_axis * ext / 2: continue
            peaks.append((hv, i, j))
    peaks.sort(reverse=True)
    out = []
    for hv, i, j in peaks:  # refine to the centroid of the topmost vertices of that cell neighbourhood; dedupe
        sel = (abs(ix - i) <= 1) & (abs(iz - j) <= 1) & (V[:, 1] > hv - 0.015 * size[1])
        p = V[sel].mean(axis=0); p[1] = hv
        if all(np.hypot(p[0] - q[0], p[2] - q[2]) > 2.5 * cell for q in out): out.append(p)
        if len(out) >= n_max: break
    return out


def rays_hit(m, origins, dirs):
    return m.ray.intersects_any(np.asarray(origins, float), np.asarray(dirs, float))


def cavity(m):
    lo, hi = m.bounds; size = hi - lo
    xs = np.linspace(lo[0] + 0.1 * size[0], hi[0] - 0.1 * size[0], 15)
    zs = np.linspace(lo[2] + 0.1 * size[2], hi[2] - 0.1 * size[2], 9)
    ys = np.linspace(lo[1] + 0.12 * size[1], lo[1] + 0.6 * size[1], 8)
    P = np.array([(x, y, z) for x in xs for y in ys for z in zs])
    D = {k: np.tile(v, (len(P), 1)) for k, v in {'u': (0, 1, 0), 'd': (0, -1, 0), 'l': (-1, 0, 0), 'r': (1, 0, 0), 'f': (0, 0, 1), 'b': (0, 0, -1)}.items()}
    hit = {k: rays_hit(m, P, D[k]) for k in D}
    cav = hit['u'] & hit['d'] & hit['l'] & hit['r'] & (hit['f'] ^ hit['b'])
    if cav.sum() < 3: return None
    mouth = 1.0 if (cav & ~hit['f']).sum() >= (cav & ~hit['b']).sum() else -1.0
    C = P[cav & (~hit['f'] if mouth > 0 else ~hit['b'])]
    # floor under each cavity point (first hit straight down), anchor on the median floor at the cavity's centre
    locs, idx, _ = m.ray.intersects_location(C, np.tile((0, -1, 0), (len(C), 1)), multiple_hits=False)
    floor = np.full(len(C), np.nan); floor[idx] = locs[:, 1]
    cx, cz = np.median(C[:, 0]), np.median(C[:, 2])
    near = np.hypot(C[:, 0] - cx, (C[:, 2] - cz) * 0.5) < 0.25 * size[0]
    fy = np.nanmedian(floor[near]) if np.any(near & ~np.isnan(floor)) else np.nanmedian(floor)
    width = (C[:, 0].max() - C[:, 0].min()) / size[0]
    return np.array([cx, fy, cz]), mouth, float(width)


def body(m, lamp_post=False):
    V = m.vertices; lo, hi = m.bounds; size = hi - lo
    if lamp_post:  # the lantern hangs off the post: upper vertices away from the post's axis
        base = V[V[:, 1] < lo[1] + 0.2 * size[1]]; ax = base[:, [0, 2]].mean(axis=0)
        rp = np.percentile(np.hypot(base[:, 0] - ax[0], base[:, 2] - ax[1]), 90)
        sel = (V[:, 1] > lo[1] + 0.45 * size[1]) & (np.hypot(V[:, 0] - ax[0], V[:, 2] - ax[1]) > 1.8 * rp)
        if sel.sum() > 20:
            U = V[sel]; c = np.median(U, axis=0)
            return np.array([c[0], (np.percentile(U[:, 1], 15) + np.percentile(U[:, 1], 70)) / 2, c[2]])
    bands = np.linspace(lo[1], hi[1], 21); rad = []
    cx, cz = np.median(V[:, 0]), np.median(V[:, 2])
    for a, b in zip(bands[:-1], bands[1:]):
        s = V[(V[:, 1] >= a) & (V[:, 1] < b)]
        rad.append(np.percentile(np.hypot(s[:, 0] - cx, s[:, 2] - cz), 90) if len(s) > 10 else 0)
    rad = np.array(rad); wide = np.where(rad >= 0.75 * rad.max())[0]
    y = (bands[wide.min()] + bands[wide.max() + 1]) / 2
    return np.array([cx, y, cz])


def measure(m, p, inch):
    _, dist, _ = trimesh.proximity.closest_point(m, [p])
    enclosed = bool(all(rays_hit(m, [p], [d])[0] for d in ((1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1))))
    below = m.ray.intersects_location([p], [(0, -1, 0)], multiple_hits=False)[0]
    drop = float(p[1] - below[0][1]) * inch if len(below) else None
    return float(dist[0]) * inch, enclosed, drop


def main():
    out, rows = {}, []
    for oid, obj in lib['objects'].items():
        t = fire_type(oid)
        if not t: continue
        for s in obj['skus']:
            if not s.get('url', '').endswith('.glb'): continue
            if not (ROOT / s['url']).exists(): print('missing mesh', s['url']); continue
            m = trimesh.load(ROOT / s['url'], force='mesh')
            lo, hi = m.bounds; size = hi - lo
            inch = max(obj['size']) / max(size)  # inches per native unit at catalog size
            yaw = float(orient.get(s['sku'], 0) or 0)
            rec = {'type': t, 'src': 'auto'}
            if t in ('candle', 'candlestick'):  # one wick, or every wick at the top level (double / triple sconces)
                n = 2 if 'double' in oid else 3 if 'triple' in oid else 5 if re.search(r'tree|pricket|box-sconce|candlestand', oid) else 1
                pk = heightmap_peaks(m, 12, 0.5, r=4); top = max(p[1] for p in pk); ext = max(size[0], size[2])
                keep = []
                for p in pk:  # distinct wicks: well apart, near the top level
                    if p[1] > top - 0.12 * size[1] and all(math.hypot(p[0] - q[0], p[2] - q[2]) > 0.15 * ext for q in keep): keep.append(p)
                pts, rec['method'] = keep[:n], 'tips'
            elif t == 'candelabra':
                pts, rec['method'] = heightmap_peaks(m, 5, 0.7), 'tips'
            elif t == 'stubs':
                pts, rec['method'] = heightmap_peaks(m, 6, 0.45), 'tips'
            elif t == 'chandelier':
                pk = heightmap_peaks(m, 24, 0.2, exclude_axis=0.25)
                top = max(p[1] for p in pk) if pk else 0  # candles share one level: keep the highest level's peaks
                pts, rec['method'] = [p for p in pk if p[1] > top - 0.12 * size[1]][:12], 'tips'
            elif t == 'torch':
                V = m.vertices; sel = V[:, 1] > hi[1] - 0.1 * size[1]; p = V[sel].mean(axis=0); p[1] = hi[1] - 0.04 * size[1]
                pts, rec['method'] = [p], 'head'
            elif t in ('hearth', 'oven', 'brazier'):
                cv = cavity(m)
                if cv is None:  # open fire (fire pit, raised hearth): on the bed, straight down the middle
                    c0 = np.array([(lo[0] + hi[0]) / 2, hi[1] + 0.01, (lo[2] + hi[2]) / 2])
                    loc = m.ray.intersects_location([c0], [(0, -1, 0)], multiple_hits=False)[0]
                    pts, rec['method'] = [loc[0] if len(loc) else np.array([c0[0], hi[1], c0[2]])], 'bed'
                else:
                    pts = [cv[0]]; rec['method'] = 'cavity'; rec['mouth'] = cv[1]; rec['width'] = round(cv[2], 3)
            else:  # lantern
                pts, rec['method'] = [body(m, lamp_post='post' in oid)], 'body'
            rec['anchors'] = [[round(float((p[i] - lo[i]) / size[i]), 4) for i in range(3)] for p in pts]
            rec['mesh'] = s.get('mesh')  # anchors were derived from THIS mesh; the runtime ignores them for any other
            out[s['sku']] = rec
            new = [measure(m, p, inch) for p in pts]
            old = [measure(m, p, inch) for p in old_anchors(t, lo, hi, yaw)]
            rows.append((s['sku'], t, rec['method'], len(pts), old, new))
    (ROOT / 'data/fire_anchors.json').write_text(json.dumps(out, indent=1))
    print(f"{'sku':26s} {'type':10s} {'method':7s} n  old: worst/mean dist in (encl)   new: worst/mean dist in (encl)")
    for sku, t, meth, n, old, new in rows:
        f = lambda ms: f"{max(d for d, _, _ in ms):6.2f} /{np.mean([d for d, _, _ in ms]):6.2f} ({sum(e for _, e, _ in ms)}/{len(ms)})"
        print(f"{sku:26s} {t:10s} {meth:7s} {n:2d}  {f(old)}       {f(new)}")
    allo = [d for r in rows for d, _, _ in r[4]]; alln = [d for r in rows for d, _, _ in r[5]]
    print(f"ALL anchors: old worst {max(allo):.2f} in, mean {np.mean(allo):.2f} in | new worst {max(alln):.2f} in, mean {np.mean(alln):.2f} in  ({len(rows)} lit skus)")


if __name__ == '__main__':
    main()

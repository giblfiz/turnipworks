#!/usr/bin/env python3
"""ROOF SECTIONS (2026-10-11, Harry: "Our programatic roofs look tacky. Let's make some small shingles-sections for each
type in the system"). One 5 ft x 5 ft modelled patch of roofing per style, built to tile with copies of itself.

  python3 build_sections.py [style,...]   ->  out/roof-section--<style>.glb (+ previews, report.json)
  ... --install   also copies the GLBs to engine/client/data/roof/ and writes engine/client/data/roofsections.json

HOW A SECTION IS MADE. The picture is the roofing plate we already own (flats/seamless/roofing-*.png: our own text
prompt + our own style reference, Codex image generation, measured to tile on all four edges). detect.py MEASURES it:
the butt line of every course, column by column, and the joints between the single shingles of each course. Every
shingle found is then built as a wedge standing on the roof plane: thick at its butt (the lower, exposed end), running
down to nothing where it goes under the course above, with a butt face and two sides. The plate is projected straight
down onto the wedges, so from above the section IS the plate, and the relief is exactly where the painting says a
shingle ends. Thatch has no single pieces: each of its layers is a rounded band with a ragged lower edge.

WHY IT TILES. The plate is periodic, the measurement is periodic, and every wedge that crosses the section's edge is
cut at the edge, both halves made from the same triangle: the vertices on opposite edges are the same numbers.

Local frame (feet): X along the eave 0..5, Z up the slope 0..5 (eaves at Z = 0), Y the relief above the roof plane.
Two meshes in one file: `near` (the wedges) and `far` (one quad at the mean height, with a normal map baked from the
same wedges). One colour texture for both.
"""
import sys, os, io, json, struct, hashlib, shutil
import numpy as np
from PIL import Image
from scipy import ndimage
import detect as D

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
PLATES = 'experiments/2026-10-05-castle-crypt-mansion/flats/seamless/roofing-%s.png'
N = 1024; FT = 5.0
# T: butt thickness in feet (miniature-thick on purpose: at table distance 5 ft is about 60 px, so a true 1/4-in slate is nothing);
# var: spread of thickness between shingles; lift: the odd one that stands proud; roll: one side higher than the other
STYLES = {
    'thatch':  dict(plate='thatch',       smooth=14, ragged=True,  joints=None,        T=0.50, var=0.16, roll=0.0,  lift=0.0,  rough=0.97, cols=12),
    'tile':    dict(plate='tile-clay',    smooth=4,  ragged=False, joints=(70, 0.05),  T=0.27, var=0.18, roll=0.08, lift=0.05, rough=0.80),
    'slate':   dict(plate='slate',        smooth=4,  ragged=False, joints=(90, 0.04),  T=0.22, var=0.20, roll=0.09, lift=0.06, rough=0.80),
    'shingle': dict(plate='shingle-wood', smooth=5,  ragged=True,  joints=(48, 0.06),  T=0.30, var=0.24, roll=0.12, lift=0.07, rough=0.95),
}
MARGIN = 8  # px: how far a wedge runs on under the butt above it

def rnd(*key):  # a number in 0..1 from a name: the same wedge is the same on both sides of an edge and in every build
    return int(hashlib.sha1('|'.join(map(str, key)).encode()).hexdigest()[:8], 16) / 0xffffffff

def clip_poly(poly, axis, bound, keep_less):  # Sutherland-Hodgman on one axis; vertices are (x, y, h)
    out = []
    for i in range(len(poly)):
        p, q = poly[i], poly[(i + 1) % len(poly)]; dp = (bound - p[axis]) if keep_less else (p[axis] - bound); dq = (bound - q[axis]) if keep_less else (q[axis] - bound)
        if dp >= 0: out.append(p)
        if (dp > 0 and dq < 0) or (dp < 0 and dq > 0):
            t = dp / (dp - dq); out.append(tuple(p[j] + (q[j] - p[j]) * t for j in range(len(p))))
    return out

def wedges(st, S, a):
    """the triangles of one style, in plate pixels (x right, y DOWN, h feet), before wrapping: [(kind, (p0, p1, p2))]"""
    lum = a.mean(axis=2); C = D.COURSES[st]; lines, _ = D.lip_lines(lum, C, S['smooth'], S['ragged'])
    tris = []; n_pieces = 0; T = S['T']
    for k in range(C):
        bot = lines[k]; top = lines[(k - 1) % C] - (N if k == 0 else 0)   # this course's own butt line; the butt line of the course above
        if S['joints'] is None:  # thatch: one band, cols columns, a rounded lip
            cols = S['cols']; xs = [j * N / cols for j in range(cols + 1)]; rows = []
            for j, x in enumerate(xs):
                jj = j % cols; xi = int(x) % N; yb = float(bot[xi]) + (rnd(st, k, jj, 'rag') - 0.5) * 16; yt = float(np.min(top)) - MARGIN
                t = T * (1 + (rnd(st, k, jj, 't') - 0.5) * 2 * S['var']); E = yb - yt
                rows.append([(x, yb, 0.0, yb + 3), (x, yb - 1.5, 0.62 * t, yb - 2), (x, yb - 0.10 * E, t), (x, yb - 0.5 * E, 0.74 * t), (x, yt, 0.04 * t)])
            for j in range(cols):
                L, R = rows[j], rows[j + 1]
                for r in range(4):
                    kind = 'butt' if r == 0 else 'smooth'
                    tris.append((kind, (L[r], R[r], R[r + 1]))); tris.append((kind, (L[r], R[r + 1], L[r + 1])))
            n_pieces += 1; continue
        js = list(D.joints(lum, lines, k, *S['joints']))
        if not S['ragged'] and len(js) > 2:  # regular courses: a joint that splits a piece into two short ones is a painted crack, not a joint
            w = np.diff(js + [js[0] + N]); med = np.median(w); keep = []
            for i, x in enumerate(js):
                if w[i] < 0.65 * med and w[i - 1] < 0.65 * med and (w[i] + w[i - 1]) < 1.35 * med: continue
                keep.append(x)
            js = keep
        for i, x0 in enumerate(js):
            x1 = js[(i + 1) % len(js)] + (N if i == len(js) - 1 else 0); cols_ = np.arange(x0 + 2, x1 - 1) % N
            if len(cols_) < 4: continue
            half = len(cols_) // 2
            if S['ragged']: ybL, ybR = float(np.median(bot[cols_[:half]])), float(np.median(bot[cols_[half:]]))   # a split shingle's butt may run at a slant
            else: ybL = ybR = float(np.median(bot[cols_]))
            yt = float(np.min(top[cols_])) - MARGIN
            t = T * (1 + (rnd(st, k, i, 't') - 0.5) * 2 * S['var']) * (1.35 if rnd(st, k, i, 'lift') < S['lift'] else 1)
            roll = (rnd(st, k, i, 'roll') - 0.5) * 2 * S['roll']; tL, tR = t * (1 + roll), t * (1 - roll)
            A, B, Cc, Dd = (x0, ybL, tL), (x1, ybR, tR), (x1, yt, 0.0), (x0, yt, 0.0)
            up = 9; dn = 3; ins = min(8, (x1 - x0) * 0.2)  # a butt face runs from the piece's painted edge down into the painted shadow under it (dark: at the table view the course lines ARE the relief; butts in the piece's own colour read as flat, Gemini 4 of 4); the sides wear the piece's own colour from inside its outline (the outline made black specks)
            A0, B0 = (x0, ybL, 0.0, ybL + dn, x0 + ins), (x1, ybR, 0.0, ybR + dn, x1 - ins); Ab, Bb = (x0, ybL, tL, ybL - 1, x0 + ins), (x1, ybR, tR, ybR - 1, x1 - ins); As, Bs, At, Bt = (x0, ybL, 0.0, ybL - up, x0 + ins), (x1, ybR, 0.0, ybR - up, x1 - ins), (x0, ybL, tL, ybL - up, x0 + ins), (x1, ybR, tR, ybR - up, x1 - ins); Ds, Cs = (x0, yt, 0.0, yt, x0 + ins), (x1, yt, 0.0, yt, x1 - ins)
            tris += [('top', (A, B, Cc)), ('top', (A, Cc, Dd)), ('butt', (A0, B0, Bb)), ('butt', (A0, Bb, Ab)), ('side', (As, At, Ds)), ('side', (Bs, Cs, Bt))]
            n_pieces += 1
    return tris, lines, n_pieces

def build(st):
    S = STYLES[st]; a0 = D.load(PLATES % S['plate'], N)
    # roll the plate so the section's lower edge (the eave) lies just under a butt line: a roof starts with a whole course
    lum = a0.mean(axis=2); lines0, _ = D.lip_lines(lum, D.COURSES[st], S['smooth'], S['ragged'])
    shift = N - int(np.ceil(lines0[-1].max() + 4 + (8 if S['joints'] is None else 0))); a = np.roll(a0, shift, axis=0)
    tris, lines, n_pieces = wedges(st, S, a)
    # wrap: every triangle, moved by whole plates, cut to the plate
    out = []  # (kind, polygon [(x, y, h)])
    for kind, tri in tris:
        for dx in (0, -N, N):
            for dy in (0, N, -N):
                poly = [(p[0] + dx, p[1] + dy, p[2], (p[3] if len(p) > 3 else p[1]) + dy, (p[4] if len(p) > 4 else p[0]) + dx) for p in tri]
                if max(p[0] for p in poly) <= 0 or min(p[0] for p in poly) >= N or max(p[1] for p in poly) <= 0 or min(p[1] for p in poly) >= N: continue
                for axis, bound, less in ((0, 0, False), (0, N, True), (1, 0, False), (1, N, True)):
                    poly = clip_poly(poly, axis, bound, less)
                    if len(poly) < 3: break
                if len(poly) >= 3: out.append((kind, poly))
    P, Nn, UV, I = [], [], [], []
    loc = lambda p: np.array([p[0] / N * FT, p[2], (1 - p[1] / N) * FT])
    smooth = {}  # thatch: one normal per place on the rounded bands
    faces = []
    for kind, poly in out:
        pts = [loc(p) for p in poly]
        for i in range(1, len(pts) - 1):
            tri = [pts[0], pts[i], pts[i + 1]]; uv = [(poly[j][4] / N, poly[j][3] / N) for j in (0, i, i + 1)]
            n = np.cross(tri[1] - tri[0], tri[2] - tri[0]); ln = np.linalg.norm(n)
            if ln < 1e-9: continue
            n = n / ln
            want_up = kind in ('top', 'smooth'); flip = (n[1] < 0) if want_up else (n[2] > 0) if kind == 'butt' else False
            if kind == 'side':  # outward: away from the piece's middle (the third point of the triangle is its far top corner)
                flip = False
            if flip: tri = [tri[0], tri[2], tri[1]]; uv = [uv[0], uv[2], uv[1]]; n = -n
            faces.append((kind, tri, uv, n, ln))
    for kind, tri, uv, n, ln in faces:
        if kind == 'smooth':
            for p in tri: key = (round(p[0] % FT, 4), round(p[1], 4), round(p[2] % FT, 4)); smooth[key] = smooth.get(key, 0) + n * ln
    for kind, tri, uv, n, ln in faces:
        for p, t in zip(tri, uv):
            nn = n
            if kind == 'smooth': s = smooth[(round(p[0] % FT, 4), round(p[1], 4), round(p[2] % FT, 4))]; nn = s / np.linalg.norm(s)
            I.append(len(P)); P.append(p); Nn.append(nn); UV.append(t)
    # the roof plane itself under the wedges (two triangles): whatever a trim cut opens up shows the same painting, never the room below
    for q in ((0, 0), (FT, FT), (FT, 0), (0, 0), (0, FT), (FT, FT)): I.append(len(P)); P.append(np.array([q[0], 0.0, q[1]])); Nn.append(np.array([0.0, 1.0, 0.0])); UV.append((q[0] / FT, 1 - q[1] / FT))
    P = np.array(P, np.float32); Nn = np.array(Nn, np.float32); UV = np.array(UV, np.float32); I = np.array(I, np.uint32)
    # weld (same place, normal and uv)
    key = np.round(np.hstack([P, Nn, UV]), 4); _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    P, Nn, UV, I = P[first], Nn[first], UV[first], inv[I].astype(np.uint32)
    # the height picture (for the far tier's normal map, the mean height and the checks): the highest wedge over each pixel
    R = 512; H = np.zeros((R, R), np.float32)
    for kind, poly in out:
        if kind in ('butt', 'side'): continue
        q = np.array(poly)[:, :3]; x0, x1 = int(np.floor(q[:, 0].min() / N * R)), int(np.ceil(q[:, 0].max() / N * R)); y0, y1 = int(np.floor(q[:, 1].min() / N * R)), int(np.ceil(q[:, 1].max() / N * R))
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, R), min(y1, R)
        if x1 <= x0 or y1 <= y0: continue
        gx, gy = np.meshgrid((np.arange(x0, x1) + 0.5) * N / R, (np.arange(y0, y1) + 0.5) * N / R)
        for i in range(1, len(q) - 1):
            a_, b_, c_ = q[0], q[i], q[i + 1]; den = (b_[1] - c_[1]) * (a_[0] - c_[0]) + (c_[0] - b_[0]) * (a_[1] - c_[1])
            if abs(den) < 1e-9: continue
            w0 = ((b_[1] - c_[1]) * (gx - c_[0]) + (c_[0] - b_[0]) * (gy - c_[1])) / den; w1 = ((c_[1] - a_[1]) * (gx - c_[0]) + (a_[0] - c_[0]) * (gy - c_[1])) / den; w2 = 1 - w0 - w1
            m = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6); h = w0 * a_[2] + w1 * b_[2] + w2 * c_[2]
            sub = H[y0:y1, x0:x1]; sub[m] = np.maximum(sub[m], h[m])
    mean_h = float(H.mean()); holes = float((H <= 1e-6).mean())
    Hs = ndimage.gaussian_filter(H, 1.0, mode='wrap'); px = FT / R
    dX = (np.roll(Hs, -1, axis=1) - np.roll(Hs, 1, axis=1)) / (2 * px); dZ = (np.roll(Hs, 1, axis=0) - np.roll(Hs, -1, axis=0)) / (2 * px)  # +Z is up the picture
    nrm = np.dstack([-dX, -dZ, np.ones_like(Hs)]); nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
    nimg = Image.fromarray(((nrm * 0.5 + 0.5) * 255).round().astype('uint8'))
    cimg = Image.fromarray((a * 255).round().astype('uint8'))
    # the far tier: one quad at the mean height
    fP = np.array([[0, mean_h, 0], [FT, mean_h, 0], [FT, mean_h, FT], [0, mean_h, FT]], np.float32); fN = np.array([[0, 1, 0]] * 4, np.float32)
    fUV = np.array([[0, 1], [1, 1], [1, 0], [0, 0]], np.float32); fI = np.array([0, 2, 1, 0, 3, 2], np.uint32)
    os.makedirs(f'{HERE}/out', exist_ok=True)
    glb = write_glb(f'{HERE}/out/roof-section--{st}.glb', [('near', P, Nn, UV, I, 0), ('far', fP, fN, fUV, fI, 1)], cimg, nimg, S['rough'])
    cimg.resize((512, 512)).save(f'{HERE}/out/{st}-colour.jpg', quality=88); nimg.save(f'{HERE}/out/{st}-normal.png')
    Image.fromarray((np.clip(H / max(H.max(), 1e-6), 0, 1) * 255).astype('uint8')).save(f'{HERE}/out/{st}-height.png')
    # the tiling check, measured: every vertex on an edge has its twin on the opposite edge (same height, same place along the edge)
    def edge(axis, at): m = np.abs(P[:, axis] - at) < 1e-4; o = 2 - axis; return sorted({(round(float(p[o]), 3), round(float(p[1]), 3)) for p in P[m]})
    tile_x = edge(0, 0) == edge(0, FT); tile_z = edge(2, 0) == edge(2, FT)
    rep = dict(style=st, plate=os.path.relpath(PLATES % S['plate'], '<repo>'), pieces=n_pieces, triangles=int(len(I) // 3), vertices=int(len(P)), far_triangles=2,
               butt_ft=S['T'], max_ft=round(float(P[:, 1].max()), 3), mean_ft=round(mean_h, 4), uncovered=round(holes, 4), rolled_px=int(shift),
               edge_vertices=[len(edge(0, 0)), len(edge(2, 0))], tiles_along_eave=bool(tile_x), tiles_up_slope=bool(tile_z), kb=round(glb / 1024), sha=hashlib.sha1(open(f'{HERE}/out/roof-section--{st}.glb', 'rb').read()).hexdigest()[:8])
    print(json.dumps(rep)); return rep

def write_glb(path, meshes, colour, normal, rough):
    bins = []; views = []; accs = []
    def add(data, target=None):
        b = data.tobytes() if hasattr(data, 'tobytes') else data; off = sum(len(x) for x in bins); pad = (-len(b)) % 4; bins.append(b + b'\0' * pad)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(b), **({'target': target} if target else {})}); return len(views) - 1
    def acc(arr, typ, ctype, target, mm=False):
        v = add(arr, target); a = {'bufferView': v, 'componentType': ctype, 'count': int(len(arr)), 'type': typ}
        if mm: a['min'] = [float(x) for x in arr.min(axis=0)]; a['max'] = [float(x) for x in arr.max(axis=0)]
        accs.append(a); return len(accs) - 1
    gm = []
    for name, P, Nn, UV, I, mat in meshes:
        idx = I.astype(np.uint16) if len(P) < 65535 else I
        gm.append({'name': name, 'primitives': [{'attributes': {'POSITION': acc(P, 'VEC3', 5126, 34962, True), 'NORMAL': acc(Nn, 'VEC3', 5126, 34962), 'TEXCOORD_0': acc(UV, 'VEC2', 5126, 34962)},
                                                  'indices': acc(idx, 'SCALAR', 5123 if idx.dtype == np.uint16 else 5125, 34963), 'material': mat}]})
    def webp(im, q):
        f = io.BytesIO(); im.save(f, 'WEBP', quality=q, method=6); return f.getvalue()
    iv = [add(webp(colour, 90)), add(webp(normal, 92))]
    j = {'asset': {'version': '2.0', 'generator': 'turnip-works roof sections (experiments/2026-10-11-roof-sections/build_sections.py)'},
         'extensionsUsed': ['EXT_texture_webp'], 'extensionsRequired': ['EXT_texture_webp'], 'scene': 0, 'scenes': [{'nodes': [0, 1]}],
         'nodes': [{'mesh': 0, 'name': 'near'}, {'mesh': 1, 'name': 'far'}], 'meshes': gm,
         'materials': [{'name': 'near', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': rough}},
                       {'name': 'far', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': rough}, 'normalTexture': {'index': 1}}],
         'textures': [{'sampler': 0, 'extensions': {'EXT_texture_webp': {'source': 0}}}, {'sampler': 0, 'extensions': {'EXT_texture_webp': {'source': 1}}}],
         'images': [{'bufferView': iv[0], 'mimeType': 'image/webp', 'name': 'colour'}, {'bufferView': iv[1], 'mimeType': 'image/webp', 'name': 'normal'}],
         'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
         'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': sum(len(x) for x in bins)}]}
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4); bn = b''.join(bins)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bn))); f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js); f.write(struct.pack('<II', len(bn), 0x004E4942)); f.write(bn)
    return os.path.getsize(path)

if __name__ == '__main__':
    args = [x for x in sys.argv[1:] if not x.startswith('--')]; which = args[0].split(',') if args else list(STYLES)
    reps = [build(st) for st in which]
    json.dump(reps, open(f'{HERE}/out/report.json', 'w'), indent=1)
    if '--install' in sys.argv:
        dst = f'{ROOT}/engine/client/data/roof'; os.makedirs(dst, exist_ok=True)
        for r in reps: shutil.copy(f"{HERE}/out/roof-section--{r['style']}.glb", dst)
        man = {'about': 'Roof sections: one modelled 5 ft x 5 ft patch of roofing per roof style, laid out instanced by engine/client/roofs.js. Built by experiments/2026-10-11-roof-sections/build_sections.py --install; never edit by hand.',
               'size_ft': FT, 'sections': {r['style']: {'url': f"roof/roof-section--{r['style']}.glb", 'rev': r['sha'], 'triangles': r['triangles'], 'far_triangles': 2, 'mean_ft': r['mean_ft'], 'max_ft': r['max_ft'], 'kb': r['kb']} for r in reps}}
        json.dump(man, open(f'{ROOT}/engine/client/data/roofsections.json', 'w'), indent=1); print('installed', dst)

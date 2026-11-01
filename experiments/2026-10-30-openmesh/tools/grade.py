#!python3
"""Bring a new mesh's colours to its partner's (2026-10-30; after experiments/2026-10-27-bars/tools/grade_post.py, which
did it for luminance and chroma). The mesh gate's render-vs-render read (gate-renders.json) found five of the new meshes
the same design as their partner but in another colour ("bright yellow vs natural brown", "violet-blue vs slate-blue",
"dark brown vs honey wood", "orange with red accent bricks"). Each colour channel of the new colour map is mapped onto the
partner colour map's mean and spread (over the texels in use), written back into the source GLB in models/; the original
is kept in models-ungraded/. The texture only: geometry untouched.
  tools/grade.py ID ...        [--measure]"""
import json, shutil, sys
from pathlib import Path
import numpy as np, trimesh
from PIL import Image
E = Path(__file__).resolve().parent.parent
T = {t['id']: t for t in json.loads((E / 'targets.json').read_text())}

def tex(sc):
    for g in sc.geometry.values():
        im = getattr(g.visual.material, 'baseColorTexture', None)
        if im is not None: return g.visual.material, im
    return None, None

def used(im):
    a = np.asarray(im.convert('RGBA')).astype(float) / 255; m = (a[..., 3] > 0.5) & (a[..., :3].max(-1) > 0.02)  # (unused atlas texels are black)
    return a, m

for i in [x for x in sys.argv[1:] if not x.startswith('--')]:
    _, pim = tex(trimesh.load(T[i]['partner_glb'])); pa, pm = used(pim); pr = pa[..., :3][pm]
    src = E / 'models-ungraded' / f'{i}.glb'
    if not src.exists(): src.parent.mkdir(exist_ok=True); shutil.copy2(E / 'models' / f'{i}.glb', src)
    sc = trimesh.load(src); mat, im = tex(sc); a, m = used(im); r = a[..., :3][m]
    print(f'{i}: partner mean {np.round(pr.mean(0) * 255)} sd {np.round(pr.std(0) * 255)} | new mean {np.round(r.mean(0) * 255)} sd {np.round(r.std(0) * 255)}')
    if '--measure' in sys.argv: continue
    out = a.copy(); rgb = out[..., :3]
    rgb[:] = np.clip((rgb - r.mean(0)) / np.maximum(r.std(0), 1e-4) * pr.std(0) + pr.mean(0), 0, 1)
    out[..., :3][~m] = a[..., :3][~m]
    mat.baseColorTexture = Image.fromarray((out * 255).round().astype('uint8')).convert(im.mode)
    sc.export(E / 'models' / f'{i}.glb')
    _, im2 = tex(trimesh.load(E / 'models' / f'{i}.glb')); a2, m2 = used(im2); print('   after mean', np.round(a2[..., :3][m2].mean(0) * 255))

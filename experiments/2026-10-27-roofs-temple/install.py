#!/usr/bin/env python3
"""THE GABLE KIT (2026-10-27): everything the gable ends and the marble roof wear, put beside the roof sections.
    python3 install.py   -> engine/client/data/roof/{roofing-marble, gable-wall--<family>(.normal), gable-<kind>, pediment-tympanum,
                            cornice-marble, trim-wood(.normal), trim-stone(.normal)}.webp (binaries, git-ignored like the sections)
                            engine/client/data/gables.json (tracked: the manifest, sizes, provenance)
Sources (nothing hand-made): plates/roofing-marble.png (finish.py), raw/<plate>.png (gen.py: Codex image generation, our prompt,
our style anchor), bake/out/gable-wall--*.webp (bake.py: each family's own generated wall mesh), the wall kit's generated
stone and wood textures (tools/spawn-tuner/assets/wallkit). Chroma-blue plates are keyed here (alpha) and cropped."""
import hashlib, json, os, shutil, glob
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
DST = os.path.join(ROOT, 'engine/client/data/roof'); MAN = os.path.join(ROOT, 'engine/client/data/gables.json')
WALLKIT = os.path.join(ROOT, 'tools/spawn-tuner/assets/wallkit')
rev = lambda p: hashlib.sha1(open(p, 'rb').read()).hexdigest()[:8]

def key(path, keep_triangle=False):
    """chroma blue -> alpha (soft edge, blue spill taken out), cropped to what is left"""
    a = np.asarray(Image.open(path).convert('RGB')).astype(float); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = b - np.maximum(r, g)                                     # how blue
    alpha = np.clip(1 - (k - 50) / 90, 0, 1)
    alpha = ndimage.grey_erosion(alpha, size=3)                  # a pixel of fringe off the edge
    a[..., 2] = np.where(alpha < 0.999, np.minimum(b, np.maximum(r, g)), b)   # despill
    m = alpha > 0.5; ys, xs = np.where(m); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([a, alpha * 255]).clip(0, 255).astype(np.uint8)[y0:y1, x0:x1]
    return Image.fromarray(rgba), dict(crop=[int(x0), int(y0), int(x1), int(y1)], opaque=round(float(m.mean()), 4))

def save(im, name, q=90):
    p = os.path.join(DST, name); im.save(p, 'WEBP', quality=q, method=6); return {'url': 'roof/' + name, 'rev': rev(p), 'px': list(im.size), 'kb': round(os.path.getsize(p) / 1024)}

def main():
    os.makedirs(DST, exist_ok=True); man = {'about': 'The gable kit and the marble roof\'s painted picture (engine/client/roofs.js GABLE, buildRoof; world.js). Built by experiments/2026-10-27-roofs-temple/install.py; never edit by hand.'}
    # the marble roof's painted picture (the far look's fallback, the "painted" switch, the menu swatch)
    man['roofing'] = {'marble': save(Image.open(os.path.join(HERE, 'plates/roofing-marble.png')).convert('RGB').resize((512, 512), Image.LANCZOS), 'roofing-marble.webp')}
    # the walls, per family: the picture is 5 ft wide and `body_ft` tall (bake.py)
    bake = json.load(open(os.path.join(HERE, 'bake/out/bake.json'))); walls = {}
    for fam, b in sorted(bake.items()):
        c = os.path.join(HERE, f'bake/out/gable-wall--{fam}.webp'); n = os.path.join(HERE, f'bake/out/gable-wall--{fam}.normal.webp')
        shutil.copy(c, DST); shutil.copy(n, DST)
        mean = np.asarray(Image.open(c).convert('RGB')).reshape(-1, 3).mean(axis=0)
        walls[fam] = {'mean': [round(float(v) / 255, 4) for v in mean], 'url': f'roof/gable-wall--{fam}.webp', 'normal': f'roof/gable-wall--{fam}.normal.webp', 'rev': rev(c), 'ft': [5.0, round(b['body_ft'][1] - b['body_ft'][0], 3)], 'from': b['sku']}
    man['walls'] = walls
    # the openings and the pediment: keyed plates, size in ft as the planner places them (roofs.js GABLE_OPENINGS)
    ops = {}
    for kind, plate, px in (('window', 'gable-window', 256), ('vent', 'gable-vent', 256), ('oculus', 'gable-oculus', 256), ('tympanum', 'pediment-tympanum', 1024)):
        im, info = key(os.path.join(HERE, 'raw', plate + '.png')); im.thumbnail((px, px), Image.LANCZOS)
        px_ = np.asarray(im).reshape(-1, 4); mean = px_[px_[:, 3] > 128, :3].mean(axis=0)
        ops[kind] = {**save(im, f'{plate}.webp'), **info, 'mean': [round(float(v) / 255, 4) for v in mean], 'plate': f'experiments/2026-10-27-roofs-temple/raw/{plate}.png'}
    man['openings'] = ops
    # the trim: a cornice strip for a marble pediment (keyed, cropped to the band), the wall kit's wood and stone for boards and copings
    if os.path.exists(os.path.join(HERE, 'raw/cornice-marble.png')):
        im, info = key(os.path.join(HERE, 'raw/cornice-marble.png')); im = im.convert('RGB'); w, h = im.size; im = im.resize((1024, max(32, round(1024 * h / w))), Image.LANCZOS)
        man['cornice'] = {**save(im, 'cornice-marble.webp'), **info, 'ft': round(1.0 * im.size[0] / im.size[1], 3)}  # the strip is 1 ft tall: this many ft long
    trim = {}
    for t in ('wood', 'stone'):
        c = sorted(glob.glob(os.path.join(WALLKIT, f'{t}.[0-9a-f]*.webp'))); n = sorted(glob.glob(os.path.join(WALLKIT, f'{t}.normal.*.webp')))
        shutil.copy(c[0], os.path.join(DST, f'trim-{t}.webp')); shutil.copy(n[0], os.path.join(DST, f'trim-{t}.normal.webp'))
        trim[t] = {'url': f'roof/trim-{t}.webp', 'normal': f'roof/trim-{t}.normal.webp', 'rev': rev(c[0]), 'ft': 6, 'from': os.path.relpath(c[0], ROOT)}
    man['trim'] = trim
    json.dump(man, open(MAN, 'w'), indent=1); print(json.dumps({k: (list(v) if isinstance(v, dict) else v) for k, v in man.items()}, indent=1))

main()

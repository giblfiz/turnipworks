"""Edge-matched variants (seamless/<mat>[--vN].png -> seamless/<mat>--c1..cN.png, the v-named files removed).
The tuner lays a floor's `c1..cN` variants mixed per cell WITHOUT rotation (look.js floorSpecs, "exact" variants). For that
to show no seams, every variant must have the SAME border: here each variant's outer band is cross-faded into the base
variant's (which already tiles with itself), so any variant sits seamlessly next to any other, and the lawn repeats far
less than one tile would. Run after make_seamless.py and normalize_variants.py."""
import glob, os, re
import numpy as np
from PIL import Image
BAND = 0.16
MATS = ('floor-gravel',)  # fine even noise takes it (Gemini: grid invisible); grass does not (each variant's interior reads as its own patch: 3/5), so grass keeps v-named variants and lays its base variant straight by default
groups = {}
for f in sorted(glob.glob('seamless/*.png')):
    if re.search(r'--c\d$', f[:-4]): continue
    groups.setdefault(re.sub(r'--v\d$', '', os.path.basename(f)[:-4]), []).append(f)
for mat, files in groups.items():
    if mat not in MATS: continue
    base = next(f for f in files if '--v' not in os.path.basename(f))
    B = np.asarray(Image.open(base).convert('RGB')).astype(float)
    n = B.shape[0]
    t = np.minimum(np.arange(n), n - 1 - np.arange(n)) / (BAND * n)
    e = np.clip(t, 0, 1); e = e * e * (3 - 2 * e)
    inner = np.minimum(e[:, None], e[None, :])[..., None]            # 0 at the border, 1 inside
    for i, f in enumerate([base] + [x for x in files if x != base], 1):
        V = np.asarray(Image.open(f).convert('RGB').resize((n, n), Image.LANCZOS)).astype(float)
        out = B * (1 - inner) + V * inner
        Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f'seamless/{mat}--c{i}.png')
    for f in files: os.remove(f)
    print(f'{mat}: {len(files)} edge-matched variants c1..c{len(files)} (band {BAND:.0%})')

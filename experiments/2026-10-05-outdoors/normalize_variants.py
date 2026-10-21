"""Make a ground material's variants interchangeable (seamless/*.png in place): colour-match every variant to the BASE
variant's mean/std per channel (Reinhard in RGB), so mixed cells don't patchwork. Like ../2026-10-01-floors2/
normalize_variants.py, but to the base (v1) rather than the group mean: the grass variants drifted yellow and brown,
and the base is the calm moss green that was asked for. Run after ../2026-10-01-floors2/make_seamless.py."""
import glob, os, re
import numpy as np
from PIL import Image
groups = {}
for f in sorted(glob.glob('seamless/*.png')):
    groups.setdefault(re.sub(r'--v\d$', '', os.path.basename(f)[:-4]), []).append(f)
for mat, files in groups.items():
    base = next(f for f in files if '--v' not in os.path.basename(f))
    ims = {f: np.asarray(Image.open(f).convert('RGB')).astype(float) for f in files}
    mu, sd = ims[base].mean(axis=(0, 1)), ims[base].std(axis=(0, 1))
    spread = np.ptp([a.mean() for a in ims.values()])
    for f, a in ims.items():
        if f == base: continue
        b = (a - a.mean(axis=(0, 1))) / (a.std(axis=(0, 1)) + 1e-6) * sd + mu
        Image.fromarray(np.clip(b, 0, 255).astype(np.uint8)).save(f)
    print(f'{mat:20s} {len(files)} variants, brightness spread before {spread:5.1f}/255 -> matched to {os.path.basename(base)}')

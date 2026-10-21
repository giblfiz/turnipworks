"""Make a material's variants interchangeable (seamless/*.png in place):
1. directional floors (planks/boards): turn any variant whose grain runs the other way (gradient energy) to match v1
2. colour-match every variant to the material's mean/std per channel (Reinhard in RGB), so cells don't patchwork."""
import glob, os, re
import numpy as np
from PIL import Image

groups = {}
for f in sorted(glob.glob('seamless/*.png')):
    groups.setdefault(re.sub(r'--v\d$', '', os.path.basename(f)[:-4]), []).append(f)


def grain(a):  # >1: features run top-bottom (strong horizontal gradients)
    l = a.mean(axis=2)
    return np.abs(np.diff(l, axis=1)).mean() / np.abs(np.diff(l, axis=0)).mean()


for mat, files in groups.items():
    ims = {f: np.asarray(Image.open(f).convert('RGB')).astype(float) for f in files}
    notes = []
    if re.search('plank|board', mat):
        ref = grain(ims[files[0]]) > 1
        for f in files[1:]:
            if (grain(ims[f]) > 1) != ref:
                ims[f] = np.rot90(ims[f]).copy(); notes.append(os.path.basename(f)[:-4].split('--')[-1] + ' turned')
    mu = np.mean([a.mean(axis=(0, 1)) for a in ims.values()], axis=0)
    sd = np.mean([a.std(axis=(0, 1)) for a in ims.values()], axis=0)
    spread = np.ptp([a.mean() for a in ims.values()])
    for f, a in ims.items():
        b = (a - a.mean(axis=(0, 1))) / (a.std(axis=(0, 1)) + 1e-6) * sd + mu
        Image.fromarray(np.clip(b, 0, 255).astype(np.uint8)).save(f)
    print(f'{mat:28s} {len(files)} variants, brightness spread before {spread:5.1f}/255 -> matched  {" ".join(notes)}')

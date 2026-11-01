#!/usr/bin/env python3
"""raw/roofing-marble.png -> plates/roofing-marble.png: made seamless by the castle/crypt/mansion flats' own finisher
(experiments/2026-10-05-castle-crypt-mansion/flats/finish.py: whole courses and tiles by autocorrelation, cut joins with
whole-period shifts, landmark pieces damped), with the marble plate's course count added. Prints the measured seams."""
import os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(ROOT, 'experiments/2026-10-05-castle-crypt-mansion/flats/finish.py')
code = open(SRC).read(); code = code[:code.index("for n in sys.argv[1].split(',')")]
F = {'__file__': SRC, '__name__': 'finish'}; exec(compile(code, SRC, 'exec'), F)
F['ROOF']['roofing-marble'] = (4, False, 5); F['DAMP']['roofing-marble'] = 0.6
name = 'roofing-marble'
a = np.asarray(Image.open(f'{HERE}/raw/{name}.png').convert('RGB').resize((1024, 1024), Image.LANCZOS)).astype(float)
before = (F['seam'](a, 1), F['seam'](a, 0), F['blotch'](a))
# the plate painted five courses of ~212 px in 1024 (they do not close at the seam): keep FOUR whole courses, measured, and
# let roof() stretch them back to 1024 (15-in courses of 12-in pan tiles: a Greek pan tile is longer than it is wide)
h, _ = F['period'](a, 0, 1024 / 5); a = a[:round(4 * h)]; print('course', h, 'px: kept', round(4 * h))
a = F['flatten'](a); a, note = F['roof'](a, name); a = np.clip(a, 0, 255)
Image.fromarray(a.astype(np.uint8)).save(f'{HERE}/plates/{name}.png')
print(f"{name} seam LR {before[0]:.1f}->{F['seam'](a, 1):.2f} TB {before[1]:.1f}->{F['seam'](a, 0):.2f} rank LR {F['seam_rank'](a, 1):.0%} TB {F['seam_rank'](a, 0):.0%} blotch {before[2]:.2f}->{F['blotch'](a):.2f} mean {a.mean(axis=(0, 1)).round(0)} {note}")

#!/usr/bin/env python3
"""raw/roofing-<style>.png -> seamless/roofing-<style>.png (1024 px, seamless): the castle/crypt/mansion flats' own finisher
(experiments/2026-10-05-castle-crypt-mansion/flats/finish.py: whole courses and tiles by autocorrelation, cut joins with
whole-period shifts, landmark pieces damped), as experiments/2026-10-27-roofs-temple/finish.py used it, with the five
culture plates' course and piece counts (as their prompts asked: gen_plates.py). Prints the measured seams.
    python3 finish.py [name,...]"""
import os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
SRC = os.path.join(ROOT, 'experiments/2026-10-05-castle-crypt-mansion/flats/finish.py')
code = open(SRC).read(); code = code[:code.index("for n in sys.argv[1].split(',')")]
F = {'__file__': SRC, '__name__': 'finish'}; exec(compile(code, SRC, 'exec'), F)
# (courses, bonded, pieces per course or None)
F['ROOF'].update({'roofing-kawara': (6, False, 6), 'roofing-tongwa': (6, False, 6), 'roofing-glazed': (6, False, 6),
                  'roofing-sod': (4, False, None), 'roofing-tes': (2, False, 6)})
F['DAMP'].update({'roofing-kawara': 0.6, 'roofing-tongwa': 0.9,   # tongwa 0.9: Gemini r2 saw repeating warm blotches at 0.6
                  'roofing-glazed': 0.6, 'roofing-tes': 0.6})
names = sys.argv[1].split(',') if len(sys.argv) > 1 else ['roofing-kawara', 'roofing-tongwa', 'roofing-glazed', 'roofing-sod', 'roofing-tes']
os.makedirs(os.path.join(HERE, 'seamless'), exist_ok=True)
for name in names:
    a = np.asarray(Image.open(f'{HERE}/raw/{name}.png').convert('RGB').resize((1024, 1024), Image.LANCZOS)).astype(float)
    before = (F['seam'](a, 1), F['seam'](a, 0), F['blotch'](a))
    a = F['flatten'](a); a, note = F['roof'](a, name); a = np.clip(a, 0, 255)
    Image.fromarray(a.astype(np.uint8)).save(f'{HERE}/seamless/{name}.png')
    print(f"{name} seam LR {before[0]:.1f}->{F['seam'](a, 1):.2f} TB {before[1]:.1f}->{F['seam'](a, 0):.2f} rank LR {F['seam_rank'](a, 1):.0%} TB {F['seam_rank'](a, 0):.0%}"
          f" blotch {before[2]:.2f}->{F['blotch'](a):.2f} mean {a.mean(axis=(0, 1)).round(0)} | {note}", flush=True)

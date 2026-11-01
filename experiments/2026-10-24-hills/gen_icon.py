#!/usr/bin/env python3
"""Hills (2026-10-24): the Hill room icon, generated with Codex's built-in image tool (`codex exec`, ChatGPT login: no
API spend), the same route and prompt as experiments/2026-10-05-outdoors/gen.py (chroma magenta: the subject is grass).
    python3 gen_icon.py      -> raw/room-hill.png ; then post_icon.py -> engine/client/data/icons/room-hill.png"""
import os, subprocess, shutil, tempfile, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'experiments/2026-10-05-outdoors'))
MAIN = '<repo>'   # the anchor icon is a git-ignored binary: read from the main checkout
ANCHOR = os.path.join(MAIN, 'experiments/2026-10-03-build-icons/raw/type-TAV.png')
from gen import ICON
subject = "a small grassy hill seen as a vignette: a flat-topped raised mound of green grass one storey high, with a steep soft grassy bank on every side, a little bare brown earth showing on the steepest part of the bank, and two grey boulders resting on the bank"
name = 'room-hill'
wd = tempfile.mkdtemp(prefix='hill-icon-')
prompt = ICON.format(subject=subject, name=name)
r = subprocess.run(['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write', '-i', ANCHOR, '-'], input=prompt, capture_output=True, text=True, timeout=900)
open(os.path.join(HERE, 'raw', f'{name}.log'), 'a').write(r.stdout[-4000:] + r.stderr[-2000:])
got = os.path.join(wd, f'{name}.png')
if os.path.exists(got): shutil.move(got, os.path.join(HERE, 'raw', f'{name}.png')); print('ok')
else: print('FAILED')

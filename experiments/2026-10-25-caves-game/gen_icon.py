#!/usr/bin/env python3
"""Caves (2026-10-25): the Cave room icon, generated with Codex's built-in image tool (`codex exec`, ChatGPT login: no
API spend), the same route and prompt as ../2026-10-24-hills/gen_icon.py and ../2026-10-05-outdoors/gen.py.
The ICON template asks for a chroma MAGENTA background; grey-brown rock keys cleanly against it (post_icon.py).
Only the template's grass-specific parenthetical is reworded for a rock subject.
    python3 gen_icon.py      -> raw/room-cave.png ; then post_icon.py -> engine/client/data/icons/room-cave.png"""
import os, subprocess, shutil, tempfile, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'experiments/2026-10-05-outdoors'))
MAIN = '<repo>'   # the anchor icon is an ignored binary: read from the main checkout
ANCHOR = os.path.join(MAIN, 'experiments/2026-10-03-build-icons/raw/type-TAV.png')
from gen import ICON
subject = ("a small natural cave seen from above as a vignette: an irregular rounded chamber of grey-brown rock, its floor "
           "of dark uneven rock, rough overlapping rock walls round it with no straight lines, two stalagmites and a thick "
           "rock pillar standing on the floor")
name = 'room-cave'
template = ICON.replace('(the subject has green grass, so green cannot be the key colour)', '(the subject is grey-brown rock)')
wd = tempfile.mkdtemp(prefix='cave-icon-')
prompt = template.format(subject=subject, name=name)
os.makedirs(os.path.join(HERE, 'raw'), exist_ok=True)
r = subprocess.run(['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write', '-i', ANCHOR, '-'], input=prompt, capture_output=True, text=True, timeout=900)
open(os.path.join(HERE, 'raw', f'{name}.log'), 'a').write(r.stdout[-4000:] + r.stderr[-2000:])
got = os.path.join(wd, f'{name}.png')
if os.path.exists(got): shutil.move(got, os.path.join(HERE, 'raw', f'{name}.png')); print('ok')
else: print('FAILED')

#!/usr/bin/env python3
"""seamless/roof-flat--S.png -> engine/client/data/roof/roof-flat--S.webp (512 x 512, WEBP q85, sRGB, opaque).
Never overwrites an existing game file.   python3 export.py deck,lead,..."""
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
DST = os.path.normpath(os.path.join(HERE, '../../../engine/client/data/roof'))
for n in sys.argv[1].split(','):
    o = os.path.join(DST, f'roof-flat--{n}.webp')
    if os.path.exists(o): print('EXISTS, not overwritten:', o); continue
    Image.open(os.path.join(HERE, 'seamless', f'roof-flat--{n}.png')).convert('RGB').resize((512, 512), Image.LANCZOS).save(o, 'WEBP', quality=85, method=6)
    w = Image.open(o); print(o, w.size, w.mode, os.path.getsize(o), 'bytes')

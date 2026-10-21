#!/usr/bin/env python3
"""4x4 sheets of mixed variants -> raw/checks/<base>-mix-turned.jpg / -mix-straight.jpg (fixed seed), for the lay-mode read.
    python3 family.py base,base"""
import sys, glob, os, random
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
for b in sys.argv[1].split(','):
    fs = sorted(glob.glob(f'{HERE}/seamless/{b}.png') + glob.glob(f'{HERE}/seamless/{b}--v*.png')); ims = [Image.open(f).convert('RGB').resize((384, 384), Image.LANCZOS) for f in fs]
    for turned in (1, 0):
        random.seed(7); s = Image.new('RGB', (1536, 1536))
        for i in range(16): t = random.choice(ims); s.paste(t.rotate(90 * random.randrange(4)) if turned else t, (i % 4 * 384, i // 4 * 384))
        s.save(f'{HERE}/raw/checks/{b}-mix-{"turned" if turned else "straight"}.jpg', quality=92)
    print(b, len(fs), 'variants')

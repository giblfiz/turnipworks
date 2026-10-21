#!/usr/bin/env python3
"""Floor variants mixed per cell -> raw/checks/<floor>-family-{rot,straight}.jpg (4x4 cells = 20 ft; variants v1..v4
drawn at random, 'rot' with random quarter turns as the tuner's shuffle mode does, 'straight' unrotated)."""
import numpy as np
from PIL import Image
rng = np.random.default_rng(5)
import sys
for m in (sys.argv[1].split(',') if len(sys.argv) > 1 else ['floor-tomb-slabs', 'floor-bone-strewn']):
    t = [Image.open(f'seamless/{m}{s}.png').convert('RGB').resize((384, 384), Image.LANCZOS) for s in ['', '--v2', '--v3', '--v4']]
    for mode in ['rot', 'straight']:
        s = Image.new('RGB', (1536, 1536))
        for i in range(16):
            c = t[rng.integers(4)]
            if mode == 'rot': c = c.rotate(90 * int(rng.integers(4)))
            s.paste(c, (i % 4 * 384, i // 4 * 384))
        s.save(f'raw/checks/{m}-family-{mode}.jpg', quality=92)

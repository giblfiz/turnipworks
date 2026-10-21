#!/usr/bin/env python3
"""Alpha bounding box width / height of gated plates (masked/<id>.png). A wall parent wants under about 0.6.
    python3 tools/mask_box.py TYPE_DIR id [id ...]"""
import sys
from pathlib import Path
from PIL import Image
T = Path(sys.argv[1])
for s in sys.argv[2:]:
    im = Image.open(T / "masked" / f"{s}.png"); b = im.split()[-1].point(lambda v: 255 if v > 32 else 0).getbbox()
    print(f"{s}: image {im.size}, alpha box {b[2]-b[0]} x {b[3]-b[1]}, w:h {(b[2]-b[0])/(b[3]-b[1]):.2f}")

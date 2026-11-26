#!/usr/bin/env python3
"""Copy an image into a blind-read folder with a labelled 10x10 grid (cell names col,row from 0), for Gemini to point at.
usage: gridify.py src out.png"""
import sys
from PIL import Image, ImageDraw
im = Image.open(sys.argv[1]).convert('RGB'); W, H = im.size
d = ImageDraw.Draw(im)
for i in range(1, 10):
    d.line([(W * i / 10, 0), (W * i / 10, H)], fill=(255, 255, 255), width=1)
    d.line([(0, H * i / 10), (W, H * i / 10)], fill=(255, 255, 255), width=1)
for i in range(10):
    d.text((W * i / 10 + 3, 3), f'c{i}', fill=(255, 255, 0)); d.text((3, H * i / 10 + 14), f'r{i}', fill=(255, 255, 0))
im.save(sys.argv[2]); print(sys.argv[2], W, H)

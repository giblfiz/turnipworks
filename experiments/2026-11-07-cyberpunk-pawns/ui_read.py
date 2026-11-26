#!/usr/bin/env python3
"""One Gemini read (agy-run) of the Pawns menu stills from browser_pawnsmenu.py --shots: labels first, then layout."""
import sys; from pathlib import Path
HERE = Path(__file__).resolve().parent; sys.path.insert(0, str(HERE)); from agy import gemini
S = HERE.parents[1] / 'engine/test/shots'
P = """These four images are screenshots of one menu of a browser tabletop game. First, for EACH image, list every label,
heading and key letter you can read, in order. Then for each: is it a grid of picture tiles? Does every tile show a
picture (a figure thumbnail) or are some blank or broken? Is anything cut off, overlapping, or is there a horizontal
scrollbar? In img3 and img4, what kinds of figures do the thumbnails show (people, peoples, robots)? Be short and plain."""
print(gemini(P, [(S / f'pawnsmenu-{n}.png', f'img{k}.png') for k, n in enumerate(['home-gm', 'tree-cyberpunk', 'tree-samurai', 'tree-robots'], 1)]))

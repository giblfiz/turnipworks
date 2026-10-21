#!/usr/bin/env python3
"""Measured answer to "do the slope and ground colours match?": mean RENDERED colour of level grass on the pieces
against the flat ground beside them, straight-down view, same light, with and without the colour normalisation.
    python3 colour_check.py BASE_URL
"""
import sys, io, json, time
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
base = sys.argv[1].rstrip('/') + '/'
SPOTS = {"blobs": {"piece: top mound": (-3, 9.0, -2), "ground": (30, 0, 26), "ground 2": (-30, 0, -26)},
         "cliff": {"piece: outcrop top": (0, 10.2, -15), "terrace top (ground tile)": (0, 10, 5), "ground": (34, 0, 30)},
         "plateau": {"piece: upper shelf of the stepped piece": (-18.5, 10.1, 0), "terrace top (ground tile)": (0, 10, 6), "ground": (-44, 0, 36)}}
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
    pg = b.new_page(viewport={'width': 1600, 'height': 1000})
    for match in (1, 0):
        for sc, spots in SPOTS.items():
            pg.goto(f'{base}?scene={sc}&view=top&ui=0&pawns=0&grid=0&match={match}')
            pg.wait_for_function('window.__ready === true', timeout=120000); time.sleep(2)
            im = np.asarray(Image.open(io.BytesIO(pg.screenshot())).convert('RGB')).astype(float)
            for name, (x, y, z) in spots.items():
                px, py = pg.evaluate(f'window.__project({x},{y},{z})')
                patch = im[int(py) - 14:int(py) + 14, int(px) - 14:int(px) + 14].reshape(-1, 3)
                out.setdefault(f"{sc} / {name}", {})["matched" if match else "as generated"] = [int(round(v)) for v in patch.mean(0)]
    b.close()
print(json.dumps(out, indent=1))

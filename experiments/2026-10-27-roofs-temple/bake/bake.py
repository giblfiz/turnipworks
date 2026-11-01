#!/usr/bin/env python3
"""GABLE WALLS (2026-10-27): the look of each wall family, for the triangle under a gable's verge, BAKED from the family's own
generated wall mesh (wall-straight--<family>.glb, the library's base sku): its exterior face seen straight on, unlit colour
plus a normal map, cropped to the BODY band (above the plinth, below the cap) so that it can repeat up a gable.
Nothing is painted here: every pixel is the generated wall's own texture as the game's renderer draws it.
    python3 bake.py [family,...]   -> out/gable-wall--<family>.webp (+ .normal.webp), out/bake.json"""
import asyncio, base64, io, json, os, subprocess, sys, time, urllib.request
from PIL import Image
import numpy as np
from scipy import ndimage
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
LIB = json.load(open(os.path.join(ROOT, 'tools/spawn-tuner/data/library.json')))
PORT = int(os.environ.get('BAKE_PORT', '18977'))
BODY = (1.0 / 9, 8.6 / 9)   # share of the wall's height: the plinth below, the cap above are cut away (they belong at the wall's foot and head)
PX_FT = 64

def skus():
    out = {}
    for s in LIB['objects']['wall-straight']['skus']:
        f = s.get('family')
        if f and f not in out and not s.get('shape') and s.get('kind') == 'mesh' and s.get('url') and (s.get('model') or {}).get('stars', 3) > 1: out[f] = s
    for s in LIB['objects']['wall-straight']['skus']:  # a family with only shaped skus (log-cabin is rough-timber--s3), or whose base was retired (1 star): its first good one
        f = s.get('family')
        if f and f not in out and s.get('kind') == 'mesh' and s.get('url') and (s.get('model') or {}).get('stars', 3) > 1: out[f] = s
    return out

async def main(which):
    S = skus(); fams = which or sorted(S)
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            time.sleep(0.1)
            try: urllib.request.urlopen(f'http://127.0.0.1:{PORT}/experiments/2026-10-27-roofs-temple/bake/bake.html', timeout=1); break
            except Exception: pass
        os.makedirs(os.path.join(HERE, 'out'), exist_ok=True); rep = {}
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            pg = await b.new_page(); await pg.goto(f'http://127.0.0.1:{PORT}/experiments/2026-10-27-roofs-temple/bake/bake.html'); await pg.wait_for_function('window.ready')
            for f in fams:
                s = S[f]; r = await pg.evaluate('([u, k]) => bake(u, k)', [f"/tools/spawn-tuner/{s['url']}", PX_FT * 9])
                ims = {k: Image.open(io.BytesIO(base64.b64decode(r[k].split(',')[1]))).convert('RGB') for k in ('colour', 'normal')}
                W, H = ims['colour'].size; y0, y1 = round(H * (1 - BODY[1])), round(H * (1 - BODY[0]))
                # the picture is 5 ft wide in the game (kitfit stretches the mesh to the 60-in edge): resample to 5 ft x body height at PX_FT
                size = (5 * PX_FT, round((BODY[1] - BODY[0]) * 9 * PX_FT))
                # where the mesh has a gap (the background shows through: black colour AND the flat background normal) take the nearest wall pixel
                c, n = np.asarray(ims['colour']).astype(int), np.asarray(ims['normal']).astype(int)
                hole = (c.sum(2) < 12) & (np.abs(n - [128, 128, 255]).sum(2) < 6)
                if hole.any():
                    _, (iy, ix) = ndimage.distance_transform_edt(hole, return_indices=True)
                    ims = {k: Image.fromarray(np.asarray(im)[iy, ix]) for k, im in ims.items()}
                for k, im in ims.items():
                    im = im.crop((0, y0, W, y1)).resize(size, Image.LANCZOS)
                    im.save(os.path.join(HERE, 'out', f"gable-wall--{f}{'' if k == 'colour' else '.normal'}.webp"), 'WEBP', quality=88, method=6)
                rep[f] = dict(holes=round(float(hole.mean()), 4), sku=s['sku'], mesh=s.get('mesh'), size=size, body_ft=[round(BODY[0] * 9, 2), round(BODY[1] * 9, 2)], box=r['box'])
                print(f, s['sku'], size, flush=True)
            await b.close()
        json.dump(rep, open(os.path.join(HERE, 'out', 'bake.json'), 'w'), indent=1)
    finally: srv.terminate()

asyncio.run(main([x for a in sys.argv[1:] for x in a.split(',') if x]))

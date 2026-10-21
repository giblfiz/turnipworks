#!/usr/bin/env python3
"""Step 4 (right-sized face tiers): single props at 10,000 faces against the rung 'fit' gives them, in the study's
bench page (experiments/2026-10-11-asset-cost/trials/bench.html: the game's prop material, one hemisphere + one
directional light, 55 degrees down).   python props.py   (starts the study's serve.py on :8497 itself)
Sizes: table = 14 px per foot (the table view), lean = 50 px per foot (the closest ordinary zoom, camera about 30 ft
out), fp = 160 px per foot capped at 480 (first person, the thing about 8 ft away).
-> /var/tmp/tw-delivery/tiers/shots/<sku>__f<N>__<size>.png, diff.json, sheets/ (blind side-by-sides for Gemini), sheets.json"""
import base64, io, json, os, random, subprocess, sys, time, numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
TR = 'experiments/2026-10-11-asset-cost/trials'; OUT = '/var/tmp/tw-delivery/tiers'
LIB = json.load(open('tools/spawn-tuner/data/library.json'))['objects']
BIG = {'2x2', '1x3', '2x3', '3x3'}; rnd = random.Random(20261012)
small, mid = [], []
for o in LIB.values():
    for s in o['skus']:
        if s.get('kind') != 'mesh' or not s.get('bounds') or not o.get('size'): continue
        rec = dict(sku=s['sku'], tex=s.get('tex') or 256, ft=max(o['size']) / 12, fp=o.get('fp'), place=o.get('place'))
        if s.get('lod') == 'small' or o.get('fp') == 'tiny': small.append({**rec, 'fit': 1500})
        elif o.get('fp') not in BIG: mid.append({**rec, 'fit': 5000})
props = rnd.sample(small, 12) + rnd.sample(mid, 12)
os.makedirs(OUT + '/shots', exist_ok=True); os.makedirs(OUT + '/sheets', exist_ok=True)
srv = subprocess.Popen([sys.executable, 'serve.py', '8497'], cwd=TR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.5)
SIZES = lambda p: {'table': max(4, round(p['ft'] * 14)), 'lean': min(480, max(8, round(p['ft'] * 50))), 'fp': min(480, max(16, round(p['ft'] * 160)))}
img = {}
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
        pg = b.new_context(viewport=dict(width=800, height=600)).new_page(); pg.goto('http://127.0.0.1:8497/bench.html'); pg.wait_for_function('window.READY === true', timeout=30000)
        for p in props:
            sz = SIZES(p); px = sorted(set(sz.values()))
            for f in sorted({10000, p['fit'], 3000}):
                r = pg.evaluate(f"T.shot({json.dumps(dict(glb=f'assets/lod/f{f}/{p['sku']}.glb', tex=f'assets/tex/t{p['tex']}/{p['sku']}.webp', how='TextureLoader', px=px))})")
                for name, n in sz.items():
                    im = Image.open(io.BytesIO(base64.b64decode(r['shots'][str(n)].split(',')[1]))).convert('RGB'); img[(p['sku'], f, name)] = im; im.save(f"{OUT}/shots/{p['sku']}__f{f}__{name}.png")
        b.close()
finally: srv.terminate()
def diff(a, b):
    A = np.asarray(a).astype(np.int16); B = np.asarray(b).astype(np.int16); bg = A[0, 0]
    mask = (np.abs(A - bg).max(axis=2) > 6) | (np.abs(B - bg).max(axis=2) > 6); D = np.abs(A - B).max(axis=2)[mask]
    return dict(px=int(mask.sum()), mean=round(float(D.mean()), 2) if D.size else 0, over16=round(float((D > 16).mean() * 100), 2) if D.size else 0, over32=round(float((D > 32).mean() * 100), 2) if D.size else 0)
res = []
for p in props:
    for f in sorted({p['fit'], 3000}):
        res.append(dict(sku=p['sku'], fit=p['fit'], rung=f, ft=round(p['ft'], 2), **{n: diff(img[(p['sku'], 10000, n)], img[(p['sku'], f, n)]) for n in ('table', 'lean', 'fp')}))
json.dump(res, open(OUT + '/diff.json', 'w'), indent=1)
for fit in (1500, 5000):
    for rung in sorted({fit, 3000}):
        rows = [r for r in res if r['fit'] == fit and r['rung'] == rung]
        print(f"props that 'fit' sends to {fit}, drawn at {rung} against 10000 (n={len(rows)}):")
        for n in ('table', 'lean', 'fp'):
            m = sorted(r[n]['mean'] for r in rows); o = sorted(r[n]['over16'] for r in rows); w = max(rows, key=lambda r: r[n]['over16'])
            print(f"   {n:5}: mean diff median {m[len(m) // 2]} worst {m[-1]}; pixels >16 off median {o[len(o) // 2]}% worst {o[-1]}% ({w['sku']}, {w[n]['px']} px)")
# blind sheets: one prop per row, two cells (sides randomised): each cell = lean-size render at 3x beside the fp render
key = {}
def cell(sku, f):
    c = Image.new('RGB', (760, 520), (200, 200, 200)); a = img[(sku, f, 'lean')]; bx = a.getbbox(); t = img[(sku, f, 'table')]
    c.paste(img[(sku, f, 'fp')].resize((500, 500)), (10, 10)); c.paste(a.resize((230, 230), Image.NEAREST), (520, 10)); c.paste(t.resize((230, 230), Image.NEAREST), (520, 260)); return c
for k, p in enumerate(props):
    flip = rnd.random() < 0.5; L, R = (p['fit'], 10000) if flip else (10000, p['fit'])
    sh = Image.new('RGB', (1560, 580), (255, 255, 255)); sh.paste(cell(p['sku'], L), (10, 50)); sh.paste(cell(p['sku'], R), (790, 50))
    d = ImageDraw.Draw(sh); d.text((20, 15), 'LEFT   (big: close up.  top right: closest ordinary zoom, enlarged.  bottom right: table distance, enlarged)', fill=(0, 0, 0)); d.text((800, 15), 'RIGHT', fill=(0, 0, 0))
    sh.save(f'{OUT}/sheets/sheet{k:02d}.png'); key[f'sheet{k:02d}'] = dict(sku=p['sku'], left=L, right=R, fit=p['fit'])
json.dump(key, open(OUT + '/sheets.json', 'w'), indent=1); print('sheets', len(key))

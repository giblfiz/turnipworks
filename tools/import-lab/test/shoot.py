#!/usr/bin/env python3
"""Drive the Import Lab headless and photograph it.
  python3 test/shoot.py OUTDIR [--base URL] [--sample gnome] [--budgets 5000,20000]
      [--views table,lean,close] [--bake 1] [--tex 1024] [--file path.stl] [--light night] [--look pewter]
Writes OUTDIR/<sample>-<budget>-<view>.png (the two panes side by side as the page shows them), per-pane crops
(-orig.png / -conv.png), and results.json with every readout plus a pixel difference between the panes."""
import argparse, asyncio, json, pathlib, io
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('--base', default='http://127.0.0.1:8377/import-lab/')
ap.add_argument('--sample', default='gnome'); ap.add_argument('--budgets', default='20000'); ap.add_argument('--views', default='table')
ap.add_argument('--bake', default='1'); ap.add_argument('--tex', default='1024'); ap.add_argument('--file'); ap.add_argument('--light', default='night'); ap.add_argument('--look', default='pewter')
ap.add_argument('--clean', action='store_true', help='hide the pane labels (blind shots)'); ap.add_argument('--stand', type=int, default=0, help='press Stand it up N times'); ap.add_argument('--height', type=float)
ap.add_argument('--soft', action='store_true', help='software GL instead of the GPU'); ap.add_argument('--size', default='1680x900')
A = ap.parse_args()
GPU = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
SOFT = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

async def main():
    out = pathlib.Path(A.out); out.mkdir(parents=True, exist_ok=True)
    W, H = map(int, A.size.split('x'))
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=SOFT if A.soft else GPU)
        page = await b.new_page(viewport={'width': W, 'height': H})
        logs = []
        page.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        first = A.budgets.split(',')[0]
        await page.goto(f"{A.base}?capture=1{'&clean=1' if A.clean else ''}&sample={'none' if A.file else A.sample}&budget={first}&bake={A.bake}&tex={A.tex}&light={A.light}&look={A.look}")
        await page.wait_for_function('window.__lab', timeout=60000)
        if A.file:
            await page.set_input_files('#file', A.file)
        results = []
        if A.stand or A.height:
            await page.wait_for_function("window.__lab.model && !window.__lab.busy", timeout=600000)
            for _ in range(A.stand): await page.click('#tip')
            if A.height: await page.fill('#height', str(A.height)); await page.dispatch_event('#height', 'change')
        name = pathlib.Path(A.file).stem if A.file else A.sample
        for budget in A.budgets.split(','):
            await page.evaluate(f"(() => {{ const l = window.__lab; if (l.S.budget !== {budget}) {{ l.set('budget', {budget}); l.runConvert(); }} }})()")
            await page.wait_for_function(f"window.__lab.current && window.__lab.current.stats.budget === {budget} && !window.__lab.busy && window.__lab.current.key === `${{window.__lab.S.budget}}|${{window.__lab.S.bake ? window.__lab.S.tex : 0}}`", timeout=600000)
            rec = await page.evaluate("window.__lab.record('test')")
            for view in A.views.split(','):
                await page.evaluate(f"window.__lab.setView('{view}'); window.__lab.redraw()")
                await page.wait_for_timeout(1500)
                stem = f'{name}-{budget}-{view}'
                await page.screenshot(path=str(out / f'{stem}.png'))
                boxes = []
                for sel, tag in (('#paneA', 'orig'), ('#paneB', 'conv')):
                    el = page.locator(sel); await el.screenshot(path=str(out / f'{stem}-{tag}.png')); boxes.append(await el.bounding_box())
                diff = None
                try:
                    from PIL import Image
                    import numpy as np
                    a = np.asarray(Image.open(out / f'{stem}-orig.png').convert('RGB'), dtype=np.float32); c = np.asarray(Image.open(out / f'{stem}-conv.png').convert('RGB'), dtype=np.float32)
                    h, w = min(a.shape[0], c.shape[0]), min(a.shape[1], c.shape[1]); a, c = a[60:h - 40, :w], c[60:h - 40, :w]  # skip the name tags and the hud line
                    d = np.abs(a - c).mean(axis=2)
                    diff = {'mean': round(float(d.mean()), 3), 'p99': round(float(np.percentile(d, 99)), 2), 'max': round(float(d.max()), 1), 'changed_px_gt8': int((d > 8).sum()), 'px': int(d.size)}
                except Exception as e:  # noqa: BLE001
                    diff = {'err': str(e)}
                results.append({**rec, 'shot': stem, 'view': view, 'pane_diff': diff, 'pxTall': await page.evaluate('window.__lab.record("t").camera.pxTall')})
                print(stem, json.dumps({'tris': rec['result']['triangles'], 'glb': rec['result']['glbBytes'], 'webp': rec['result']['glbBytesWebp'], 'ms': rec['result']['convertMs'], 'ingest': rec['result']['ingestMs'], 'err': [rec['result']['errorMeanPctHeight'], rec['result']['errorMaxPctHeight']], 'diff': diff, 'px': results[-1]['pxTall']}))
        (out / 'results.json').write_text(json.dumps(results, indent=1))
        if logs: print('\n'.join(logs[:30]))
        await b.close()

asyncio.run(main())

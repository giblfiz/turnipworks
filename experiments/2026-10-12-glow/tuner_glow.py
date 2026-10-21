#!/usr/bin/env python3
"""The Far-fire glow panel in the Spawn Tuner, driven: build the test room, take the three views as stills, and read the
panel's own "difference from real" for the old floor disc and the projected stand-in at several pool sizes.
  tw-slot python3 experiments/2026-10-12-glow/tuner_glow.py [tag] [--quick]
Writes shots/tuner-<tag>-*.png and results/tuner-<tag>.json. Test writes go to the sandbox (tests/tw_sandbox.py)."""
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
PORT = 18643; args = [a for a in sys.argv[1:] if not a.startswith('--')]; TAG = args[0] if args else 'a'; QUICK = '--quick' in sys.argv
os.makedirs(os.path.join(HERE, 'shots'), exist_ok=True); os.makedirs(os.path.join(HERE, 'results'), exist_ok=True)
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=os.path.join(REPO, 'tools', 'spawn-tuner'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{PORT}/index.html', timeout=1); break
        except Exception: pass
    out = {'tag': TAG}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--no-sandbox', *GL])
            pg = await (await b.new_context(viewport={'width': 1700, 'height': 1900})).new_page()
            errs = []; pg.on('pageerror', lambda e: (errs.append(str(e)), print('pageerror', e)))
            pg.on('console', lambda m: print('console', m.text[:300]) if m.type == 'error' and 'favicon' not in m.text else None)
            await tw_sandbox.aproxy(pg, 'http://127.0.0.1:8096')
            await pg.goto(f'http://127.0.0.1:{PORT}/index.html?nobg&seed=7&atmos=clear')
            await pg.wait_for_selector('body[data-ready="1"]', timeout=120000); await pg.wait_for_function('!!window.fx && !!fx.glowTools', timeout=60000)
            await pg.evaluate("document.querySelector('details.major[data-key=\"farglow\"]').open = true; localStorage.removeItem('tuner.fx.farglow.current')")
            await pg.evaluate("fx.glowTools.buildRoom()")
            await pg.wait_for_function("tuner.episodes() === 0 && fx.glowTools.extras().length >= 4", timeout=180000); await pg.wait_for_timeout(6000)
            await pg.evaluate("tuner.hideLabels(true); fx.fire.setLite(true)")
            out['stats'] = await pg.evaluate("(() => { const s = fx.stats(); return { lights: fx.fire.lights().filter(l => l.userData.lit).map(l => ({ type: l.userData.ftype, y: +l.position.y.toFixed(1), i: +(l.userData.i0 ?? l.intensity).toFixed(2), d: +l.distance.toFixed(1), decay: l.decay })), walls: s.farglow_walls }; })()")
            print('lights', json.dumps(out['stats']), flush=True)
            canvas = pg.locator('canvas').first; print('canvas', await canvas.bounding_box())
            async def shot(name): await pg.wait_for_timeout(900); await canvas.screenshot(path=os.path.join(HERE, 'shots', f'tuner-{TAG}-{name}.png'))
            res = {}
            for pool in ([0] if QUICK else [0, 2, 4]):
                await pg.evaluate(f"fx.glowTools.setPool({pool})")
                for mode in ('floor', 'projected'):
                    await pg.evaluate(f"(() => {{ const p = fx.params('farglow'); p.how.mode = '{mode}'; fx.setParams('farglow', p); }})()")
                    await pg.wait_for_timeout(300)
                    m = await pg.evaluate("fx.glowTools.measure()"); res[f'pool{pool}-{mode}'] = m; print(f'pool {pool} {mode}:', json.dumps(m), flush=True)
                    if pool in (0, 2):
                        await pg.evaluate("fx.glowTools.setView('glow', true)"); await shot(f'pool{pool}-3-standin-{mode}')
                        if mode == 'projected':
                            await pg.evaluate("fx.farglow.setView('gain')"); await shot(f'pool{pool}-gain'); await pg.evaluate("fx.farglow.setView('picture')")
                if pool in (0, 2):
                    await pg.evaluate("fx.glowTools.setView('none', true)"); await shot(f'pool{pool}-2-none')
            await pg.evaluate("fx.glowTools.setView('real', true)"); await shot('1-real')
            # WHERE THE LIGHT LANDS: named world points, read off the stills (pool 0: every light is a stand-in)
            box = await canvas.bounding_box()
            pts = await pg.evaluate("""(() => { const R = { x0: 15, z0: 210, x1: 50, z1: 240 }, P = {}, add = (k, x, y, z) => { const q = tuner.project3(x, y, z); P[k] = [q.x, q.y]; };
              for (let t = 0; t <= 20; t += 1) add('floor from the brazier +' + t + ' ft', R.x0 + 8 + t * 0.7, 0.03, R.z1 - 7 - t * 0.7);
              for (const y of [2, 3.5, 5.5, 7]) add('wall beside the sconce, ' + y + ' ft up', R.x1 - 0.52, y, R.z0 + 9 - 1.6);
              for (const d of [2, 4, 6, 8]) add('next room floor, ' + d + ' ft past the shared wall', R.x1 + 0.5 + d, 0.03, R.z0 + 9);
              const c = fx.glowTools.extras().find(it => it.spec.id === 'candlestick'); if (c) { add('table top by the candle', c.rest.x - 0.9, c.rest.y + 0.02, c.rest.z + 0.3); P.candleY = c.rest.y; }
              return P; })()""")
            from PIL import Image
            import numpy as np
            ims = {k: np.asarray(Image.open(os.path.join(HERE, 'shots', f'tuner-{TAG}-{n}.png')).convert('RGB')).astype(float) for k, n in (('real', '1-real'), ('none', 'pool0-2-none'), ('disc', 'pool0-3-standin-floor'), ('proj', 'pool0-3-standin-projected'))}
            sx = ims['real'].shape[1] / box['width']; land = {}
            for k, q in pts.items():
                if k == 'candleY': continue
                x, y = int((q[0] - box['x']) * sx), int((q[1] - box['y']) * sx)
                if not (3 <= x < ims['real'].shape[1] - 3 and 3 <= y < ims['real'].shape[0] - 3): continue
                v = {m: ims[m][y - 2:y + 3, x - 2:x + 3].reshape(-1, 3).mean(0) for m in ims}
                land[k] = {m: [round(float(c), 1) for c in (v[m] - v['none'])] for m in ('real', 'disc', 'proj')}
            out['lands'] = land
            lit = np.abs(ims['real'] - ims['none']).max(2) > 8
            out['whole'] = {m: {'white_pixels_pct': round(float((ims[m].min(2) >= 250).mean() * 100), 2), 'added_rgb': [round(float(c), 1) for c in (ims[m] - ims['none'])[lit].mean(0)], 'mean_abs_diff_from_real': round(float(np.abs(ims[m] - ims['real'])[lit].mean()), 2), 'max_diff': round(float(np.abs(ims[m] - ims['real']).mean(2)[lit].max()), 1)} for m in ims}
            print('whole', json.dumps(out['whole'])); print('lands', json.dumps(land)[:3000], flush=True)
            d = (ims['proj'] - ims['real']).mean(2); Image.fromarray(np.stack([np.clip(128 + d * 3, 0, 255), np.full_like(d, 128), np.clip(128 - d * 3, 0, 255)], 2).astype(np.uint8)).save(os.path.join(HERE, 'shots', f'tuner-{TAG}-diff-projected-minus-real.png'))
            # THE POP: a pool of 2, the view moved so the pool changes; the largest change of the whole picture between two frames, with and without the cross-fade
            pop = {}
            for fade in (0, 0.4):
                await pg.evaluate(f"(() => {{ const p = fx.params('farglow'); p.swap.fade = {fade}; p.how.mode = 'projected'; fx.setParams('farglow', p); fx.glowTools.setPool(2); }})()")
                for v in ('none', 'glow'):
                    await pg.evaluate(f"fx.glowTools.setView('{v}', true)"); await pg.wait_for_timeout(700)
                    pop[f'{v}, fade {fade} s'] = await pg.evaluate("""() => new Promise(res => { const c = tuner.cam, x0 = c.focus.x, cv = document.createElement('canvas'); cv.width = 160; cv.height = 100; const g = cv.getContext('2d', { willReadFrequently: true }); let prev = null, worst = 0, n = 0, sw0 = fx.fire.pool().swaps;
                      const src = document.querySelector('canvas');
                      const tick = () => { if (n > 4) { g.drawImage(src, 0, 0, 160, 100); const d = g.getImageData(0, 0, 160, 100).data; if (prev) { let s = 0; for (let i = 0; i < d.length; i += 4) s += Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2]); worst = Math.max(worst, s / (d.length / 4) / 3); } prev = d; }
                        n++; if (n === 11) fx.fire.setRankPoint({ x: x0 + 22, y: 0, z: c.focus.z }); // (the pool is chosen round another point: the camera, and so the picture, holds still)
                        if (n < 120) requestAnimationFrame(tick); else { fx.fire.setRankPoint(null); res({ worst_frame_change: +worst.toFixed(2), swaps: fx.fire.pool().swaps - sw0 }); } }; requestAnimationFrame(tick); })""")
            out['pop'] = pop; print('pop', json.dumps(pop), flush=True)
            await pg.evaluate("(() => { const p = fx.params('farglow'); p.swap.fade = 0.4; fx.setParams('farglow', p); })()")
            out['diff'] = res; out['fx'] = await pg.evaluate("(() => { const s = fx.stats(); return Object.fromEntries(Object.entries(s).filter(([k]) => k.startsWith('farglow'))); })()"); out['errors'] = errs
            await pg.evaluate("fx.glowTools.setView('glow', true)"); await pg.wait_for_timeout(500)
            out['panel'] = await pg.evaluate("document.querySelector('#fx-glow-diff').textContent + ' | ' + document.querySelector('#fx-glow-state').textContent")
            await pg.screenshot(path=os.path.join(HERE, 'shots', f'tuner-{TAG}-page.png'))
            await b.close()
    finally:
        srv.terminate()
    json.dump(out, open(os.path.join(HERE, 'results', f'tuner-{TAG}.json'), 'w'), indent=1); print(json.dumps(out.get('fx')), out.get('panel'))
asyncio.run(main())

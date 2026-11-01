#!/usr/bin/env python3
"""Which library things stand tall or float off the plane (a perspective camera draws those bigger than their place,
over a neighbour): every thing's mesh box in world space, its height over the plane and its lowest point.
  TW_GPU=1 .../browser-venv/bin/python probe_heights.py [--room common] [--local]"""
import asyncio, json, os, sys, argparse
HERE = os.path.dirname(os.path.abspath(__file__)); sys.argv += [] ; sys.path.insert(0, HERE)
ap = argparse.ArgumentParser(); ap.add_argument('--room', default='common'); ap.add_argument('--page', default='http://127.0.0.1:8180/'); ap.add_argument('--local', action='store_true')
B = ap.parse_args(); sys.argv = [sys.argv[0]] + (['--local'] if B.local else ['--page', B.page])
import audit  # noqa: E402  (start_local, open_lib, the sandbox)
from playwright.async_api import async_playwright

PROBE = """(() => { const w = tw.worlds.get(tw.library.info().area), out = []; w.layers.things.updateMatrixWorld(true);
  for (const r of w.recs.values()) { const e = r.entity; if (e.kind !== 'object') continue; let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    r.group.traverse(o => { if (!o.isMesh || o.userData?.halo || !o.geometry) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; if (!b || !isFinite(b.min.x)) return;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const p = o.localToWorld(new o.position.constructor(x, y, z)); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); } });
    if (y1 > y0) out.push({ cat: e.cat, sku: e.sku, place: e.place, k: +(e.libK || 1).toFixed(2), tilt: e.tiltZ ? 'side' : e.tiltX ? 'back' : 'up', y0: +y0.toFixed(2), top: +y1.toFixed(2), side: +Math.max(x1 - x0, z1 - z0).toFixed(2), ph: !!r.visual?.userData?.placeholder }); }
  return out.sort((a, b) => b.top - a.top); })()"""

async def main():
    page = audit.start_local() if B.local else B.page
    url = page + ('&' if '?' in page else '?') + 'nointro&atmos=morning-mist'
    async with async_playwright() as p:
        br = await p.chromium.launch(args=['--no-sandbox', *audit.GL])
        pg = await (await br.new_context(viewport={'width': 1400, 'height': 900})).new_page(); await pg.goto(url)
        await pg.fill('#newCampaign input[name=gm]', 'Harry'); await pg.click('#newCampaign button')
        await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000); await pg.wait_for_timeout(1500)
        await pg.evaluate("tw.settings.setPref('libEven', true)")
        print('opened', await audit.open_lib(pg, B.room))
        sz = await pg.evaluate("tw.worlds.get(tw.library.info().area).lay.size"); await pg.evaluate("tw.library.touched()")
        for fx in (0.2, 0.5, 0.8):
            for fz in (0.2, 0.5, 0.8):
                await pg.evaluate(f"(() => {{ const g = tw.pip.grab; g.focus.set({sz[0] * fx}, 0, {sz[1] * fz}); g.dist = 30; g.update(); }})()"); await pg.wait_for_timeout(700)
        try: await pg.wait_for_function("(() => { const l = tw.library.loaded(); return l && l.withUrl >= l.total && l.drawn >= l.total * 0.97; })()", timeout=90000)
        except Exception: pass
        await pg.wait_for_timeout(1500)
        out = await pg.evaluate(PROBE)
        print('things', len(out)); print('tallest:'); [print('  ', x) for x in out[:12]]
        fl = [x for x in out if x['y0'] > 0.15]; print('off the plane (lowest point > 0.15 ft):', len(fl)); [print('  ', x) for x in fl[:12]]
        json.dump(out, open(os.path.join(HERE, f'heights-{B.room}-{"local" if B.local else "dev"}.json'), 'w'), indent=1)
        await br.close()

try: asyncio.run(main())
finally:
    for pr in audit.procs: pr.terminate()

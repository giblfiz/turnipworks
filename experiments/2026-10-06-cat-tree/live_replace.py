#!/usr/bin/env python3
"""Does a cat tree that is ALREADY on a table show a replaced mesh? Two runs round one deploy.
    TW_GPU=1 browser-venv/bin/python live_replace.py before     # a throwaway campaign on live with one cat tree; kept (replace-state.json)
    (deploy)
    TW_GPU=1 browser-venv/bin/python live_replace.py after      # the same campaign reopened; what it loads; then the campaign is deleted"""
import asyncio, json, os, sys, time, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
PHASE = sys.argv[1]; STATE = os.path.join(HERE, 'replace-state.json'); TUNER = 'https://implausible.enterprises/projects/turnip-works/tuner/'
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
def size_of(u):
    r = urllib.request.urlopen(urllib.request.Request(u if u.startswith('http') else TUNER + u, method='HEAD', headers={'User-Agent': 'Mozilla/5.0'}), timeout=20); return int(r.headers.get('content-length') or 0), r.headers.get('last-modified')
INFO = """(async () => { const w = tw.worldOf(tw.area()); const es = Object.values(tw.entities()).filter(e => e.cat === 'cat-tree'); const out = [];
  for (const e of es) { const r = w.recs.get(e.id); await r.ready; await new Promise(s => setTimeout(s, 3000)); let tris = 0; r.visual?.traverse?.(o => { if (o.isMesh && o.geometry) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    out.push({ id: e.id, dims: e.dims, drawn: !!r.visual && !r.visual.userData?.placeholder, tris }); }
  const res = performance.getEntriesByType('resource').filter(r => r.name.includes('cat-tree')).map(r => [r.name.split('/tuner/')[1] || r.name, r.decodedBodySize]);
  const s = tw.lib.objects['cat-tree'].skus[0]; return { placed: out, loaded: res, lib: { mesh: s.mesh, bounds: s.bounds }, faces: tw.assets.faces() }; })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL]); ctx = await b.new_context(viewport={'width': 1280, 'height': 820}); gm = await ctx.new_page()
        made = {}
        async def note(resp):
            try:
                if resp.request.method == 'POST' and resp.url.rstrip('/').endswith('/campaigns'):
                    j = await resp.json(); made.update(relay=resp.url.rsplit('/campaigns', 1)[0], campaign=j.get('campaign'), token=j.get('token'))
            except Exception: pass
        gm.on('response', lambda r: asyncio.ensure_future(note(r)))
        if PHASE == 'before':
            await gm.goto('https://turnipworks.net/?nopost&nointro')
            await gm.fill('#newCampaign input[name=gm]', 'Fauna'); await gm.fill('#newCampaign input[name=name]', 'TEST cat tree replace ' + time.strftime('%H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
            await gm.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
            await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(12.5, 0, 12.5); g.pitch = 55; g.yaw = 0; g.dist = 45; g.update(); tw.main.rule = 'free'; tw.modes.place(tw.assets.catById.get('cat-tree')); })()"); await gm.wait_for_timeout(500)
            pt = await gm.evaluate("tw.screenOf(12.5, 12.5, tw.main, 0)"); await gm.mouse.move(pt['x'], pt['y']); await gm.wait_for_timeout(300); await gm.mouse.click(pt['x'], pt['y']); await gm.wait_for_timeout(1500); await gm.keyboard.press('Escape')
            info = await gm.evaluate(INFO); await gm.wait_for_timeout(1500)
            json.dump({**made, 'url': gm.url, 'before': info}, open(STATE, 'w'), indent=1); print('url', gm.url.split('?')[0], 'campaign', made.get('campaign'), 'token saved:', bool(made.get('token')))
        else:
            st = json.load(open(STATE)); await gm.goto(st['url']); await gm.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
            await gm.wait_for_function("Object.values(tw.entities()).some(e => e.cat === 'cat-tree')", timeout=20000)
            await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(12.5, 2, 12.5); g.pitch = 35; g.yaw = 30; g.dist = 16; g.update(); tw.main.rule = 'free'; })()")
            info = await gm.evaluate(INFO); await gm.screenshot(path=os.path.join(HERE, 'shots', 'live-replaced-lean.png'))
            st['after'] = info; json.dump(st, open(STATE, 'w'), indent=1)
            print('deleted the throwaway campaign:', tw_sandbox.delete_campaign(st['relay'], st['campaign'], st['token']))
        print(json.dumps(info))
        for u, n in info['loaded']:
            if u.endswith('.glb') or u.endswith('.webp'): print('  on the server now:', u, size_of(u), ' the page got', n, 'bytes')
        await b.close()
asyncio.run(main())

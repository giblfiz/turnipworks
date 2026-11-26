#!/usr/bin/env python3
"""Before / after stills for the pawn Size control (Harry 2026-11-07: "the 'size' options on pawns should just use the same
design language as the object resize (same image, and drag in&out on track)"). Runs against any checkout (main's old
code or this branch) on a throwaway local relay, painted ring pictures (charcoal), and saves:
  <tag>-pawn-menu.png     a pawn's ☰ open (before: the Size ▸ group; after: the Size drag button)
  <tag>-pawn-size.png     before: ☰ ▸ Size's list open;  after: the Size handle dragged out to large, its track drawn
  <tag>-prop-resize.png   a prop's resize handle mid-drag (the design language the pawn's now copies)

  TW_GPU=1 python3 stills.py ROOT TAG OUTDIR [ports a,b]
"""
import asyncio, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request, shutil
from playwright.async_api import async_playwright
ROOT, TAG, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
RP, SP = (int(v) for v in (sys.argv[4] if len(sys.argv) > 4 else '18657,19257').split(','))
ENGINE = os.path.join(ROOT, 'engine'); os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, os.path.join(ROOT, 'tests')); import tw_sandbox  # noqa: E402
tw_sandbox.pawn_snap('always'); tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
procs, tmp = [], []
def start():
    data = tempfile.mkdtemp(prefix='tw-pstill-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(ROOT, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro'
async def main():
    url = start()
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
        pg = await (await br.new_context(viewport={'width': 1280, 'height': 820})).new_page()
        await pg.goto(url)
        await pg.fill('#newCampaign input[name=gm]', 'Harry'); await pg.fill('#newCampaign input[name=name]', f'TEST pawnsize stills {TAG} (throwaway)'); await pg.click('#newCampaign button')
        await pg.wait_for_function('window.tw?.ready?.()', timeout=90000)
        await pg.evaluate("tw.dispatch('campaign.set', { defaults: { fogOfWar: false } })")
        await pg.evaluate('tw.spawnRoom("common", 0, 0, 6, 5, 7711)')
        await pg.wait_for_function('tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', timeout=120000)
        await pg.evaluate("ops => tw.batch(ops)", [{'type': 'token.create', 'args': {'id': 'tok_stillfight1', 'name': 'Fighter', 'x': 15, 'z': 12.5, 'fig': 'hero-fighter-human-m'}}])
        await pg.wait_for_function("tw.worldOf(tw.area()).figureOf('tok_stillfight1')?.loaded === true", timeout=30000)
        await pg.evaluate("(() => { const b = tw.ringSettings(); tw.ringSettingsOverride = () => ({ ...b, iconSet: 'charcoal' }); })()")
        async def look(x, y, z, dist):
            await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.dist = {dist}; g.pitch = 50; g.yaw = 0; g.update(); }})()"); await pg.wait_for_timeout(500)
        async def menu(id):
            await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.evaluate(f"tw.select('{id}')"); await pg.wait_for_timeout(300)
            await pg.evaluate("document.querySelector('#ring .rbtn[data-menu]').click()"); await pg.wait_for_timeout(1300)
        # the ring is world-sized: back the camera off until every ☰ button is on screen, clear of the command bar
        CLEAR = "(() => { const bs = [...document.querySelectorAll('#ring .rbtn')]; return bs.length > 0 && bs.every(b => { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.top > 64 && r.left > 4 && r.right < innerWidth - 4 && e?.closest('.rbtn') === b; }); })()"
        dd = 40
        for _ in range(8):
            await look(15, 5 + dd * 0.35, 12.5, dd); await menu('tok_stillfight1')
            if await pg.evaluate(CLEAR) and await pg.evaluate("(document.querySelector('#ring .rbtn[data-cmd=\"pawn.resize\"]')?.getBoundingClientRect().top ?? 999) > 320"): break
            dd *= 1.25
        await pg.screenshot(path=os.path.join(OUT, f'{TAG}-pawn-menu.png'))
        if await pg.evaluate("!!document.querySelector('#ring .rbtn[data-cmd=\"pawn.resize\"]')"):
            b = await pg.evaluate("(() => { const r = document.querySelector('#ring .rbtn[data-cmd=\"pawn.resize\"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
            await pg.mouse.move(*b); await pg.mouse.down(); await pg.wait_for_timeout(100)
            d = await pg.evaluate("tw.ringDrag()"); ux, uy = d['dir']; t = d['track']; a = next(m for m in t['marks'] if m['label'] == 'medium'); c = next(m for m in t['marks'] if m['label'] == 'large')
            pitch = ((c['at'][0] - a['at'][0]) ** 2 + (c['at'][1] - a['at'][1]) ** 2) ** 0.5
            for i in range(1, 11): await pg.mouse.move(b[0] + ux * pitch * 1.15 * i / 10, b[1] + uy * pitch * 1.15 * i / 10); await pg.wait_for_timeout(30)
            await pg.wait_for_timeout(700); await pg.screenshot(path=os.path.join(OUT, f'{TAG}-pawn-size.png'))
            print('  pawn track marks:', [(m['label'], m['at']) for m in (await pg.evaluate('tw.ringDrag()'))['track']['marks']], 'grab', b)
            await pg.keyboard.press('Escape'); await pg.mouse.up(); await pg.wait_for_timeout(300)
        else:
            await pg.click('#ring .rbtn.ex[data-group="pawn.size."]'); await pg.wait_for_timeout(1200)
            await pg.screenshot(path=os.path.join(OUT, f'{TAG}-pawn-size.png'))
        prop = await pg.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'object' && e.place !== 'tile' && !e.locked && !e.parent && e.dims && e.dims[1] > 2 && e.dims[0] > 2.5).sort((a, b) => (Math.abs(a.x - 15) + Math.abs(a.z - 12.5)) - (Math.abs(b.x - 15) + Math.abs(b.z - 12.5)))[0]")
        dd = 30
        for _ in range(8):
            await look(prop['x'], 2 + dd * 0.3, prop['z'], dd); await pg.keyboard.press('Escape'); await pg.evaluate(f"tw.select('{prop['id']}')"); await pg.wait_for_timeout(900)
            if await pg.evaluate(CLEAR): break
            dd *= 1.25
        b = await pg.evaluate("(() => { const r = document.querySelector('#ring .rbtn[data-cmd=\"edit.resize\"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
        await pg.mouse.move(*b); await pg.mouse.down(); await pg.wait_for_timeout(100); d = await pg.evaluate("tw.ringDrag()"); ux, uy = d['dir']
        for i in range(1, 11): await pg.mouse.move(b[0] + ux * 60 * i / 10, b[1] + uy * 60 * i / 10); await pg.wait_for_timeout(30)
        await pg.wait_for_timeout(700); await pg.screenshot(path=os.path.join(OUT, f'{TAG}-prop-resize.png'))
        await pg.keyboard.press('Escape'); await pg.mouse.up()
        await br.close()
try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
print('stills:', sorted(f for f in os.listdir(OUT) if f.startswith(TAG)))

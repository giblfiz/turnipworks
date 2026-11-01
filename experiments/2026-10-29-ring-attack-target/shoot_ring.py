#!/usr/bin/env python3
"""Screenshots of the REAL pawn ring wearing a painted set, for the visual check of the new Attack / Target icons.

  TW_PORTS=a,b python3 shoot_ring.py [--set charcoal] [--out DIR]

A local relay + static server on this worktree (as engine/test/browser_beyond20.py --local). Mira's tab has Beyond20
"Loaded" and the house ring forced to the painted set. Thorin (Mira's, linked to a D&D Beyond sheet) shows the Attack
button; Goblin 1 (not hers) shows Target. Writes ring-<set>-attack.png, ring-<set>-target.png (crops round the ring's
buttons) and ring-<set>.png (the two side by side) into --out.
"""
import argparse, asyncio, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
ap = argparse.ArgumentParser(); ap.add_argument('--set', default='charcoal'); ap.add_argument('--out', default=os.path.join(HERE, 'shots')); A = ap.parse_args()
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18951,18952').split(','))
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
procs, tmp = [], []

def start_local():
    for port in (RP, SP):
        with socket.socket() as sk:
            if sk.connect_ex(('127.0.0.1', port)) == 0: sys.exit(f'port {port} is in use')
    data = tempfile.mkdtemp(prefix='tw-ringshot-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=15000):
    try: await pg.wait_for_function(js, timeout=timeout, polling=100); return True
    except Exception: print('  timed out:', js[:100]); return False

LOOK = "(x, z, dist) => { const g = tw.main.grab; g.focus.set(x, 0, z); g.dist = dist; g.pitch = 55; g.yaw = 0; g.update(); }"
SEND = "([name, detail]) => document.dispatchEvent(new CustomEvent('Beyond20_' + name, { detail }))"
BOX = """(() => { const bs = [...document.querySelectorAll('.rbtn')].filter(b => b.offsetParent && b.getBoundingClientRect().width > 4);
  if (!bs.length) return null; const r = bs.map(b => b.getBoundingClientRect());
  return { x: Math.min(...r.map(q => q.left)), y: Math.min(...r.map(q => q.top)), x2: Math.max(...r.map(q => q.right)), y2: Math.max(...r.map(q => q.bottom)),
    ids: bs.map(b => (b.dataset.id || '') + (b.classList.contains('painted') ? ':painted' : ':line')) }; })()"""

async def main():
    os.makedirs(A.out, exist_ok=True)
    page = start_local()
    hring = {'settings': {}}
    try:
        h = json.load(urllib.request.urlopen('http://127.0.0.1:8180/api/tw-ratings/tuner/house', timeout=5))
        if (h.get('ring') or {}).get('settings'): hring = h['ring']
    except Exception as e: print('house ring unavailable:', e)
    hring['settings'].update({'iconSet': A.set, 'iconAlternates': {}})
    init = "(() => { const H = %s, F = window.fetch; window.fetch = (u, ...r) => { const s = String(u?.url || u); if (!/\\/tw-icon-api\\//.test(s)) return F(u, ...r); return Promise.resolve(/\\/tuner\\/house(\\?|$)/.test(s) ? new Response(JSON.stringify(H), { status: 200, headers: { 'content-type': 'application/json' } }) : new Response('', { status: 404 })); }; })()" % json.dumps({'ring': hring})
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
        gctx = await browser.new_context(viewport={'width': 1280, 'height': 820}); gm = await gctx.new_page(); await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST ringshot (throwaway)'); await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw?.ready?.() && tw.b20', 90000), 'GM did not come up'
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        invite = invite.replace('api=&', 'api=/tw-icon-api&') if 'api=&' in invite else invite + ('&' if '?' in invite else '?') + 'api=/tw-icon-api'
        pctx = await browser.new_context(viewport={'width': 1280, 'height': 820}, device_scale_factor=2, reduced_motion='reduce'); await pctx.add_init_script(init)
        pl = await pctx.new_page(); await pl.goto(invite)
        assert await wait(pl, f'window.tw?.ready?.() && tw.b20 && tw.ringSettings().iconSet === "{A.set}"', 90000), 'player did not join with the painted set'
        seat = await pl.evaluate('tw.me()')
        await gm.evaluate('tw.spawnRoom("common", 0, 0, 6, 5, 7711)')
        await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        TH, GB = 'tok_shotthorin1', 'tok_shotgobln01'
        await gm.evaluate('tw.batch(' + json.dumps([
            {'type': 'token.create', 'args': {'id': TH, 'name': 'Thorin', 'x': 7.5, 'z': 12.5, 'owner': seat, 'sheet': 'https://www.dndbeyond.com/characters/111111', 'main': True}},
            {'type': 'token.create', 'args': {'id': GB, 'name': 'Goblin 1', 'x': 17.5, 'z': 12.5}}]) + ')')
        await wait(pl, f"!!tw.entities()['{GB}'] && !!tw.entities()['{TH}']")
        await pl.evaluate(SEND, ['Loaded', [{'custom-domains': ['https://dev.turnipworks.net/*']}]])
        await wait(pl, 'tw.b20.connected', 8000)
        shots = []
        for name, who, x in (('attack', TH, 7.5), ('target', GB, 17.5)):
            await pl.evaluate("tw.select([])"); await pl.evaluate(f"({LOOK})({x}, 12.5, 30)"); await pl.wait_for_timeout(800)
            await pl.evaluate(f"tw.select(['{who}'])"); await pl.wait_for_timeout(1500)
            await wait(pl, "[...document.querySelectorAll('.rbtn img.paint')].every(i => i.complete && i.naturalWidth > 0)", 8000)
            box = await pl.evaluate(BOX); print(name, box and box['ids'])
            m = 40; clip = {'x': max(0, box['x'] - m), 'y': max(0, box['y'] - m), 'width': box['x2'] - box['x'] + 2 * m, 'height': box['y2'] - box['y'] + 2 * m}
            f = os.path.join(A.out, f'ring-{A.set}-{name}.png'); await pl.screenshot(path=f, clip=clip); shots.append(f)
        await browser.close()
    ims = [Image.open(f) for f in shots]; W = sum(i.width for i in ims) + 20; H = max(i.height for i in ims)
    sheet = Image.new('RGB', (W, H), (16, 16, 16)); x = 0
    for i in ims: sheet.paste(i, (x, 0)); x += i.width + 20
    sheet.save(os.path.join(A.out, f'ring-{A.set}.png')); print('wrote', os.path.join(A.out, f'ring-{A.set}.png'))

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)

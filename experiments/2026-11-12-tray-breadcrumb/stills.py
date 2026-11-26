#!/usr/bin/env python3
"""Before/after stills of the tray breadcrumbs (2026-11-12): the Build tray at each depth and the Pawns tree at each depth,
on a computer (1280x820) and a phone (390x844, touch). Own relay + site on TW_PORTS (default 18196,18825).
  python3 stills.py OUTDIR [--page URL]   (no --page: a local relay and site from this tree)"""
import asyncio, os, sys, json, tempfile, subprocess, time, urllib.request, urllib.parse
from playwright.async_api import async_playwright
REPO = '<repo>'; ENGINE = REPO + '/engine'
sys.path.insert(0, REPO + '/tests'); import tw_sandbox
tw_sandbox.remove_campaigns()
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
PAGE = sys.argv[sys.argv.index('--page') + 1] if '--page' in sys.argv else None
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18196,18825').split(','))
procs = []
DUMP = {}
def start_local():
    data = tempfile.mkdtemp(prefix='tw-crumb-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500'
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
PHONE = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
DESK = dict(viewport={'width': 1280, 'height': 820}, device_scale_factor=1)

async def shoot(pg, sel, name):
    await pg.wait_for_timeout(500)
    el = await pg.query_selector(sel)
    if el and await el.is_visible(): await el.screenshot(path=os.path.join(OUT, name + '.png'))
    else: await pg.screenshot(path=os.path.join(OUT, name + '.png'))
    dom = await pg.evaluate(f"""(() => {{ const t = document.querySelector('{sel}'); if (!t || t.hidden) return {{ hidden: true }};
      const r = (e) => {{ const b = e.getBoundingClientRect(); return Math.round(b.height); }};
      return {{ chips: [...t.querySelectorAll('.bchip')].map(c => ({{ text: c.innerText.replace(/\\s+/g, ' ').trim(), h: r(c), icon: (c.querySelector('img')?.getAttribute('src') || c.querySelector('.nic')?.className || '').split('?')[0] }})),
        where: t.querySelector('.bwhere') ? {{ text: t.querySelector('.bwhere').innerText, icon: (t.querySelector('.bwhere img')?.getAttribute('src') || '').split('?')[0], lines: Math.round(r(t.querySelector('.bwhere')) / 20) }} : null,
        head: t.querySelector('.blevel')?.innerText || null }}; }})()""")
    DUMP[name] = dom
    print('  shot', name, json.dumps(dom), flush=True)

async def run(browser, page, kind):
    ctx = await browser.new_context(**(PHONE if kind == 'phone' else DESK)); pg = await ctx.new_page(); pg.set_default_timeout(90000)
    await pg.goto(page + '&nointro')
    await pg.fill('#newCampaign input[name=gm]', 'Harry'); await pg.fill('#newCampaign input[name=name]', 'TEST crumbs (throwaway)'); await pg.click('#newCampaign button')
    await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000); await pg.wait_for_timeout(2500)
    await pg.evaluate("document.querySelectorAll('#introHint, #phoneBanner').forEach(e => e.hidden = true)")
    # BUILD at each depth
    for i, path in enumerate([['g:fantasy'], ['g:fantasy', 't:TAV'], ['g:fantasy', 't:TAV', 'r:TAV:common']]):
        await pg.evaluate(f"(() => {{ tw.build.close(); tw.build.restore({json.dumps(path)}); tw.build.open(); }})()")
        await shoot(pg, '#buildMenu', f'{kind}-build-{i}')
    await pg.evaluate("tw.build.close()")
    # PAWNS tree: Monsters, Monsters > Goblins, a culture three deep
    await pg.evaluate("tw.pawns.open ? tw.pawns.open() : tw.registry.run('pawns.menu')"); await pg.wait_for_timeout(600)
    st = await pg.evaluate('tw.pawns.state()')
    await shoot(pg, '#pawnsTray', f'{kind}-pawns-0home')
    T = await pg.evaluate("tw.pawnTree.roots.map(r => ({ id: r.id, label: r.label, kids: (r.children || []).map(c => ({ id: c.id, kids: (c.children || []).map(x => x.id) })) }))")
    deep = next((r, c, c['kids'][0]) for r in T for c in r['kids'] if c['kids'] for _ in [0] if r['id'] not in ('heroes', 'townsfolk', 'monsters', 'animals'))
    for i, ids in enumerate([['monsters'], ['monsters', 'monsters/goblins'], [deep[0]['id'], deep[1]['id']], [deep[0]['id'], deep[1]['id'], deep[2]]]):
        await pg.evaluate(f"tw.pawns.goTree({json.dumps(ids)})")
        await shoot(pg, '#pawnsTray', f'{kind}-pawns-{i + 1}')
    await ctx.close()

async def main():
    page = PAGE or start_local()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
        for kind in ('desk', 'phone'): await run(browser, page, kind)
        json.dump(DUMP, open(os.path.join(OUT, 'dom.json'), 'w'), indent=1)
        await browser.close()
try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()

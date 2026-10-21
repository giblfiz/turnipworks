#!/usr/bin/env python3
"""Settings (Harry 2026-10-04; docs/UI.md "Settings"): the modal window and its five sections, through the real
commands and permissions. GM tab + player tab (+ an arriving tab), real clicks where it matters.
  1 World navigation   list, open here / in PiP, create / rename / delete (GM); arriving never opens it
  2 Me                 name + colour (relay), zoom / rotate speed + invert (camera), graphics (faces at reload),
                       ring + text size, announce off, cursors, reduced motion, sound stored, my agents, reset
  3 Area               lighting profile, grid, free moves (enforced), visibility + grants, inherit / override / reset
  4 Global defaults    inherited by areas; campaign-wide items stored
  5 Campaign admin     snapshots, export / import, invites + revoke, agent seats with ticked permissions, requests

  local:  python3 engine/test/browser_settings.py --local
  live:   ... browser_settings.py --page https://turnipworks.net/
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
# TW_GPU=1: render on the GPU (Vulkan) instead of software GL: several times faster, and steadier on a loaded machine
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

procs = []
RP, SP = int(os.environ.get('TW_RP', 18099)), int(os.environ.get('TW_SP', 18728))  # overridable: two suites at once must not share a relay
def start_local():
    data = tempfile.mkdtemp(prefix='tw-settings-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=80); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def tap(pg, sel):  # a real click at the element's centre (headless at a few fps: no stability wait)
    r = await pg.evaluate(f"(() => {{ const e = document.querySelector({json.dumps(sel)}); if (!e) return null; e.scrollIntoView({{ block: 'center' }}); const r = e.getBoundingClientRect(); return {{ x: r.left + r.width / 2, y: r.top + r.height / 2 }}; }})()")
    if not r: print(f'    (no element {sel})'); return False
    await pg.mouse.click(r['x'], r['y']); await pg.wait_for_timeout(150); return True
async def fill(pg, sel, text):  # type into a field and commit (change event)
    await pg.evaluate(f"(() => {{ const e = document.querySelector({json.dumps(sel)}); e.value = {json.dumps(text)}; e.dispatchEvent(new Event('input', {{ bubbles: true }})); e.dispatchEvent(new Event('change', {{ bubbles: true }})); }})()")
    await pg.wait_for_timeout(150)
async def pick(pg, sel, value): await fill(pg, sel, value)
section = lambda pg, s: tap(pg, f'#settingsModal .scat[data-sec={s}]')
C = "tw.sync.campaign"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}, permissions=['clipboard-read', 'clipboard-write'])
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            pg.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' else None)
            await pg.goto(url); return pg
        gm = await tab(page + '&nointro')
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST settings ' + __import__('time').strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000), 'GM tab live')
        check(await gm.evaluate("!tw.settings.state().open"), 'a new campaign opens straight into the game: Settings is closed')
        tok = await gm.evaluate("tw.createSeat({ kind: 'human', role: 'player', name: 'Brakka', color: '#6fc36f' })")
        link = await gm.evaluate(f"tw.inviteLink('{tok}')")
        base, frag = link.split('#', 1)
        pl = await tab(base.replace('nopost', 'nofx&nopost') + '#' + frag)
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 40000), 'player tab live')
        PL = await pl.evaluate('tw.me()'); A1 = await gm.evaluate('tw.area()')

        print('1. WORLD NAVIGATION')
        await gm.bring_to_front()
        await tap(gm, '.launcher[data-l=settings]')
        st = await gm.evaluate('tw.settings.state()')
        check(st['open'] and st['section'] == 'nav' and await gm.evaluate("document.querySelector('#settingsModal .sarea.here .san small').textContent.includes('you are here')"), 'the gear opens the modal on World navigation; the current area says "you are here"')
        await fill(gm, '#settingsModal .newname', 'Cellar'); await tap(gm, '#settingsModal [data-act=create]')  # (2026-10-06: a new area starts hidden; there is no visibility choice)
        ok = await wait(gm, f"{C}.areas.some(a => a.name === 'Cellar') && !!document.querySelector('#settingsModal .sarea:nth-child(2)')", 8000, 'create')
        A2 = await gm.evaluate(f"{C}.areas.find(a => a.name === 'Cellar')?.id")
        check(ok and A2 and await gm.evaluate(f"{C}.areas.find(a => a.name === 'Cellar').visibility") == 'hidden', 'the GM creates an area (it starts hidden from players) and it is listed')
        await pl.wait_for_timeout(600)
        check(await pl.evaluate(f"!{C}.areas.some(a => a.name === 'Cellar')"), 'a player does not see a GM-only area in their list')
        await fill(gm, f'#settingsModal .sarea[data-area="{A2}"] .aname', 'Wine cellar')
        check(await wait(gm, f"{C}.areas.find(a => a.id === '{A2}')?.name === 'Wine cellar'", 8000, 'rename'), 'editing the name renames the area (area.set)')
        await tap(gm, f'#settingsModal .sarea[data-area="{A2}"] [data-act=pip]')
        check(await wait(gm, f"tw.pip?.area === '{A2}'", 6000, 'pip'), 'Open in PiP shows that area in the PiP')
        await tap(gm, f'#settingsModal .sarea[data-area="{A2}"] [data-act=here]')
        check(await wait(gm, f"tw.area() === '{A2}' && !tw.settings.state().open", 6000, 'here'), 'Open here makes it the main view and closes Settings')
        await gm.evaluate(f"tw.setMain('{A1}')"); await gm.evaluate("tw.closePip()")
        await tap(gm, '.launcher[data-l=settings]')
        await tap(gm, f'#settingsModal .sarea[data-area="{A2}"] [data-act=del]')
        armed = await gm.evaluate(f"document.querySelector('#settingsModal .sarea[data-area=\"{A2}\"] [data-act=del]').textContent")
        await tap(gm, f'#settingsModal .sarea[data-area="{A2}"] [data-act=del]')
        check('Really' in armed and await wait(gm, f"!{C}.areas.some(a => a.id === '{A2}')", 8000, 'delete'), 'delete asks once more ("Really delete?"), then removes the area')
        check(await gm.evaluate("document.querySelector('#settingsModal .sarea [data-act=del]').disabled"), 'the last area cannot be deleted')
        await pl.bring_to_front()
        await tap(pl, '.launcher[data-l=settings]')
        pst = await pl.evaluate("({ ...tw.settings.state(), create: !!document.querySelector('#settingsModal .newname'), del: !!document.querySelector('#settingsModal [data-act=del]'), names: !!document.querySelector('#settingsModal .aname') })")
        check(pst['sections'] == ['nav', 'me', 'feedback'] and not pst['create'] and not pst['del'] and not pst['names'], 'a player gets World navigation, Me and Feedback only (2026-10-19), with no create / rename / delete', pst)
        # arriving as a person would (no webdriver flag, a fresh browser): straight into the game, in the seat's area
        tok2 = await gm.evaluate("tw.createSeat({ kind: 'human', role: 'player', name: 'Arrive', color: '#c36f9f' })")
        frag2 = (await gm.evaluate(f"tw.inviteLink('{tok2}')")).split('#', 1)[1]
        actx = await browser.new_context(viewport={'width': 1280, 'height': 820})
        await actx.add_init_script("Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })")
        land = await actx.new_page(); await land.goto(base.replace('nopost', 'nofx&nopost') + '&landing#' + frag2)
        await wait(land, 'window.tw && tw.ready && tw.ready()', 40000)
        await land.wait_for_timeout(2500)
        arr = await land.evaluate("({ wd: navigator.webdriver, open: tw.settings.state().open, modal: !document.querySelector('#settingsModal') || document.querySelector('#settingsModal').hidden, area: tw.area(), my: tw.sync.campaign.my.location, areas: tw.sync.campaign.areas.map(a => a.id) })")
        check(arr['wd'] is False and not arr['open'] and arr['modal'] and arr['area'] and arr['area'] in arr['areas'], 'joining a campaign goes straight into the game, in an area, with Settings closed (a person arriving; even with the old ?landing switch)', arr)
        await land.reload(); await wait(land, 'window.tw && tw.ready && tw.ready()', 40000); await land.wait_for_timeout(1500)
        arr2 = await land.evaluate("({ open: tw.settings.state().open, area: tw.area() })")
        check(not arr2['open'] and arr2['area'] == arr['area'], 'a reload comes back to the same area, Settings still closed', arr2)
        await land.close()

        print('KEYS: S opens Settings on World navigation; a letter picks a section (shown on each entry)')
        await gm.bring_to_front(); await gm.evaluate("tw.settings.close()"); await gm.mouse.move(640, 420)
        await gm.keyboard.press('s')
        st = await gm.evaluate("({ ...tw.settings.state(), keys: [...document.querySelectorAll('#settingsModal .scat kbd')].map(k => k.textContent), labels: [...document.querySelectorAll('#settingsModal .scat span')].map(k => k.textContent) })")
        check(st['open'] and st['section'] == 'nav' and st['keys'] == ['N', 'M', 'A', 'G', 'C', 'F'] and not any(l[:1].isdigit() for l in st['labels']), 'S opens Settings on World navigation; each section shows its letter (N M A G C F: Feedback since 2026-10-19), no numbers', st)
        seen = []
        for k in ('m', 'a', 'g', 'c', 'f', 'n'):
            await gm.keyboard.press(k); seen.append(await gm.evaluate('tw.settings.state().section'))
        check(seen == ['me', 'area', 'defaults', 'admin', 'feedback', 'nav'], 'then M, A, G, C, F, N switch sections', seen)
        await gm.keyboard.press('m'); await gm.keyboard.press('s')
        closed = not await gm.evaluate('tw.settings.state().open')
        await gm.keyboard.press('s')
        check(closed and await gm.evaluate("tw.settings.state().open && tw.settings.state().section === 'nav'"), 'S again closes it, and it always reopens on World navigation')
        await gm.keyboard.press('c'); await gm.keyboard.press('Escape'); await tap(gm, '.launcher[data-l=settings]')
        check(await gm.evaluate("tw.settings.state().open && tw.settings.state().section === 'nav'"), 'the Settings button too: last on Campaign admin, closed with Esc, it reopens on World navigation')
        await gm.evaluate("tw.settings.close()")

        print('PICTURES: a 3/4 thumbnail per area, framed on its structures, hidden things left out')
        rid = await gm.evaluate("tw.spawnRoom('common', 2, 2, 6, 4, 4242)")
        await wait(gm, f"!!tw.entities()['{rid}']", 8000, 'room'); await gm.wait_for_timeout(4000)
        await gm.evaluate("tw.dispatch('object.place', { id: 'obj_secret0001', name: 'secret chest', cat: 'chest-plain', x: 20, z: 15, hidden: true, dims: [3, 2, 2] })")
        await wait(gm, "!!tw.worldOf(tw.area()).recs.get('obj_secret0001')", 6000, 'hidden obj')
        # Reproduce the stale-cache race deterministically: the player visits before the GM uploads.
        # Reopening immediately afterwards must fetch current metadata, without waiting out a cache TTL.
        await pl.evaluate("tw.settings.open('nav')")
        await pl.evaluate("tw.thumbs.refreshMeta()")
        await pl.evaluate("tw.settings.close()")
        r = await gm.evaluate(f"tw.thumbs.renderNow('{A1}').then(r => ({{ up: r, last: tw.thumbs.lastRender }}))")
        lr = r['last']
        b64 = await gm.evaluate(f"fetch(tw.thumbs.url('{A1}')).then(r => r.arrayBuffer()).then(b => btoa(String.fromCharCode(...new Uint8Array(b))))")
        import base64; os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots'), exist_ok=True); open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots', 'area-thumb.webp'), 'wb').write(base64.b64decode(b64))
        check(r['up'] and r['up'].get('ok') and lr['bytes'] > 2000 and not lr['blank'], 'the GM\'s client renders the area (480×300 WebP) and uploads it', [lr['bytes'], r['up'] and r['up'].get('bytes')])
        check('obj_secret0001' in lr['excluded'] and await gm.evaluate("tw.worldOf(tw.area()).recs.get('obj_secret0001').group.visible && tw.worldOf(tw.area()).layers.deco.visible"), 'hidden things are left out of the picture (and shown again after)', lr['excluded'])
        b = lr['frame']['box']
        check(b['x0'] == 10 and b['z0'] == 10 and b['x1'] == 40 and b['z1'] == 30, 'framed on the structures: the room\'s own box', b)
        await gm.keyboard.press('s')
        await wait(gm, "!!document.querySelector('#settingsModal .sarea .sthumb img')", 8000, 'thumb shown')
        ti = await gm.evaluate("(() => { const i = document.querySelector('#settingsModal .sarea .sthumb img'); return i ? { src: i.src.includes('/thumb'), cap: i.parentElement.querySelector('small').textContent } : null; })()")
        check(ti and ti['src'] and 'updated' in ti['cap'], 'World navigation shows the picture with "updated …" under it', ti)
        await gm.evaluate("tw.settings.close()")
        await pl.bring_to_front(); await pl.evaluate("tw.settings.close()"); await pl.keyboard.press('s')
        fogged = await pl.evaluate(f"tw.fog.active() && tw.thumbs.url('{A1}') === null && !document.querySelector('#settingsModal .sarea[data-area=\"{A1}\"] .sthumb img')")
        check(fogged, 'a fogged player is not shown the GM\'s unmasked area picture')
        await gm.evaluate("tw.dispatch('campaign.set', { defaults: { fogOfWar: false } })")
        await wait(pl, '!tw.fog.active()', 10000, 'fog off for picture test')
        await pl.evaluate("tw.settings.close()"); await pl.keyboard.press('s')
        ok = await wait(pl, f"tw.thumbs.meta['{A1}']?.at >= {r['up']['at']} && !!document.querySelector('#settingsModal .sarea .sthumb img') && document.querySelector('#settingsModal .sarea .sthumb img').complete && document.querySelector('#settingsModal .sarea .sthumb img').naturalWidth === 480", 10000, 'player current thumb')
        if not ok:
            state = await pl.evaluate(f"""(() => {{ const i = document.querySelector('#settingsModal .sarea .sthumb img'); return {{ uploadedAt: {r['up']['at']}, meta: tw.thumbs.meta['{A1}'] || null, fetchedAt: tw.thumbs.fetchedAt, settings: tw.settings.state(), image: i && {{ src: i.src, complete: i.complete, width: i.naturalWidth, loading: i.loading, visible: !!i.getClientRects().length }} }}; }})()""")
            print('    player current thumb state: ' + str(state), flush=True)
        check(ok, 'a player sees the picture of an area they can see (480 px wide)')

        print('CAMERAS: opening from World navigation starts on the picture\'s view; a PiP swap keeps each area\'s camera')
        await gm.bring_to_front(); await gm.evaluate("tw.closePip(); tw.settings.close()")
        near = lambda a, b, tol=0.02: all(abs(x - y) <= tol + 0.002 * abs(y) for x, y in zip(a, b))
        flat = lambda p: [p['focus'][0], p['focus'][2], p['yaw'], p['pitch'], p['dist']]
        VA = "(v => v.aspect(document.querySelector('#c').clientWidth, document.querySelector('#c').clientHeight))"
        fr = await gm.evaluate(f"tw.thumbs.refreshMeta().then(m => m['{A1}'].frame)")
        check(fr and fr['aspect'] == 1.6 and near([fr['focus'][0], fr['focus'][2], fr['yaw'], fr['pitch']], [25, 20, -20, 52]) and near([fr['dist']], [lr['frame']['dist']]), 'the picture is stored with the camera it was shot from', fr)
        await gm.keyboard.press('s'); await fill(gm, '#settingsModal .newname', 'Annex'); await tap(gm, '#settingsModal [data-act=create]')
        await wait(gm, f"{C}.areas.some(a => a.name === 'Annex')", 8000, 'annex'); A3 = await gm.evaluate(f"{C}.areas.find(a => a.name === 'Annex').id")
        await tap(gm, f'#settingsModal .sarea[data-area="{A3}"] [data-act=here]'); await wait(gm, f"tw.area() === '{A3}' && tw.worlds.get('{A3}')?.loaded", 20000, 'annex open'); await gm.wait_for_timeout(1200)
        e3 = await gm.evaluate("({ pose: tw.main.pose(), want: tw.thumbs.frameFor(tw.area()), asp: " + VA + "(tw.main) })")
        check(near(flat(e3['pose']), [e3['want']['focus'][0], e3['want']['focus'][2], -20, 52, e3['want']['dist'] * max(1, 1.6 / e3['asp'])]), 'an area with no picture yet opens on the view its picture would be taken from', e3)
        # wander off in the Annex, then open Area 1 from its picture
        await gm.evaluate("tw.main.setPose({ focus: [200, 0, -100], yaw: 70, pitch: 30, dist: 300 })")
        await gm.keyboard.press('s'); await wait(gm, f"!!document.querySelector('#settingsModal .sarea[data-area=\"{A1}\"] .sthumb img')", 8000, 'a1 thumb')
        await tap(gm, f'#settingsModal .sarea[data-area="{A1}"] .sthumb img')
        await wait(gm, f"tw.area() === '{A1}' && !tw.settings.state().open", 6000, 'open from picture'); await gm.wait_for_timeout(600)
        e1 = await gm.evaluate("({ pose: tw.main.pose(), asp: " + VA + "(tw.main), rule: tw.main.rule })")
        want1 = [fr['focus'][0], fr['focus'][2], fr['yaw'], fr['pitch'], fr['dist'] * max(1, 1.6 / e1['asp'])]
        check(near(flat(e1['pose']), want1), 'clicking an area\'s picture opens it on the picture\'s camera: same focus, heading, pitch; distance fitted to the view (narrower than 1.6: backs away to keep the width)', {'got': flat(e1['pose']), 'want': want1, 'aspect': e1['asp']})
        # what the picture shows is on screen: the framed box's corners all project inside the main view
        inside = await gm.evaluate("(() => { const b = tw.thumbs.frameFor(tw.area()).box, c = document.querySelector('#c'); return [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]].map(([x, z]) => tw.screenOf(x, z)).every(s => s.x >= 0 && s.x <= c.clientWidth && s.y >= 0 && s.y <= c.clientHeight); })()")
        check(inside, 'everything the picture frames is in view')
        await gm.keyboard.press('s'); await tap(gm, f'#settingsModal .sarea[data-area="{A3}"] [data-act=pip]'); await wait(gm, f"tw.pip?.area === '{A3}' && tw.worlds.get('{A3}')?.loaded", 20000, 'annex pip'); await gm.wait_for_timeout(1200)
        ep = await gm.evaluate("({ pose: tw.pip.pose(), rule: tw.pip.rule, asp: " + VA + "(tw.pip), want: tw.thumbs.frameFor(tw.pip.area) })")
        check(ep['rule'] == 'pinned' and near(flat(ep['pose']), [ep['want']['focus'][0], ep['want']['focus'][2], -20, 52, ep['want']['dist'] * max(1, 1.6 / ep['asp'])]), 'Open in PiP holds the picture\'s view too (fitted to the PiP\'s shape)', ep)
        await gm.evaluate("tw.settings.close()")
        # the swap: distinct cameras on each side, a pawn in Area 1 that a following PiP would chase
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_swapbait01', name: 'Bait', x: 300, z: 300 })"); await wait(gm, "!!tw.entities()['tok_swapbait01']", 6000, 'bait')
        Pm, Pp = {'focus': [33, 0, 12], 'yaw': 40, 'pitch': 35, 'dist': 70}, {'focus': [-8, 0, 6], 'yaw': -75, 'pitch': 64, 'dist': 44}
        await gm.evaluate(f"(tw.main.setPose({json.dumps(Pm)}), tw.pip.setPose({json.dumps(Pp)}))")
        asp = await gm.evaluate("[" + VA + "(tw.main), " + VA + "(tw.pip)]"); am, ap = asp
        await tap(gm, '#pipSwap'); await gm.wait_for_timeout(1500)
        sw = await gm.evaluate("({ main: tw.main.area, pip: tw.pip.area, m: tw.main.pose(), p: tw.pip.pose(), rule: tw.pip.rule })")
        wm = [Pp['focus'][0], Pp['focus'][2], Pp['yaw'], Pp['pitch'], Pp['dist'] * max(1, ap / am)]; wp = [Pm['focus'][0], Pm['focus'][2], Pm['yaw'], Pm['pitch'], Pm['dist'] * max(1, am / ap)]
        check(sw['main'] == A3 and sw['pip'] == A1, 'swap: the PiP\'s area is the main view and the main view\'s area is in the PiP', [sw['main'], sw['pip']])
        check(near(flat(sw['m']), wm), 'swap: what was in the PiP fills the main view on the same camera (focus, heading, pitch; distance fitted to the shape)', {'got': flat(sw['m']), 'want': wm, 'aspects': asp})
        check(near(flat(sw['p']), wp) and sw['rule'] == 'pinned', 'swap: what was the main view sits in the PiP framed as it was, and stays there (no jump to a default, no chasing the pawns)', {'got': flat(sw['p']), 'want': wp, 'rule': sw['rule']})
        await tap(gm, '#pipSwap'); await gm.wait_for_timeout(800)
        sb = await gm.evaluate("({ main: tw.main.area, pip: tw.pip.area, m: tw.main.pose(), p: tw.pip.pose() })")
        check(sb['main'] == A1 and sb['pip'] == A3 and near(flat(sb['m']), flat(Pm), 0.001) and near(flat(sb['p']), flat(Pp), 0.001), 'swapping back returns both cameras exactly', {'m': flat(sb['m']), 'p': flat(sb['p'])})
        await gm.evaluate("tw.dispatch('token.delete', { id: 'tok_swapbait01' }); tw.closePip()")
        await gm.keyboard.press('s'); await wait(gm, f"!!document.querySelector('#settingsModal .sarea[data-area=\"{A3}\"] [data-act=del]')", 6000, 'del annex')
        await tap(gm, f'#settingsModal .sarea[data-area="{A3}"] [data-act=del]'); await tap(gm, f'#settingsModal .sarea[data-area="{A3}"] [data-act=del]')
        await wait(gm, f"!{C}.areas.some(a => a.id === '{A3}')", 8000, 'annex deleted'); await gm.evaluate("tw.settings.close()")

        print('2. ME')
        await pl.bring_to_front()
        await section(pl, 'me')
        await fill(pl, '#settingsModal .myname', 'Brakka Stonefist'); await fill(pl, '#settingsModal .mycolor', '#3366cc')
        ok = await wait(gm, f"(s => s?.name === 'Brakka Stonefist' && s.color === '#3366cc')({C}.seats.find(s => s.id === '{PL}'))", 8000, 'name')
        check(ok, 'a player renames and recolours their own seat (seat.set, the seat.self class); the GM sees it')
        z = await pl.evaluate("""(() => { const G = tw.main.grab, d0 = G.dist; tw.settings.setPref('zoomSpeed', 2); G.zoomAt(640, 400, 0.9); const k2 = G.dist / d0; const d1 = G.dist; tw.settings.setPref('invertZoom', true); G.zoomAt(640, 400, 0.9); const k3 = G.dist / d1; tw.settings.setPref('zoomSpeed', 1); tw.settings.setPref('invertZoom', false); return [k2, k3]; })()""")
        check(abs(z[0] - 0.81) < 0.01 and z[1] > 1.2, 'zoom speed doubles a notch (0.9 → 0.81) and invert zoom reverses it', [round(v, 3) for v in z])
        r = await pl.evaluate("""(() => { const G = tw.main.grab, y0 = G.yaw; tw.settings.setPref('rotateSpeed', 2); G.beginGrab(640, 400, 'orbit'); G.dragTo(690, 400); G.endGrab(); const d2 = ((G.yaw - y0 + 540) % 360) - 180; tw.settings.setPref('invertRotate', true); const y1 = G.yaw; G.beginGrab(640, 400, 'orbit'); G.dragTo(690, 400); G.endGrab(); const d3 = ((G.yaw - y1 + 540) % 360) - 180; tw.settings.setPref('rotateSpeed', 1); tw.settings.setPref('invertRotate', false); return [d2, d3]; })()""")
        check(abs(r[0] + 40) < 0.5 and abs(r[1] - 40) < 0.5, 'rotate speed doubles an orbit drag (−20° → −40°) and invert rotate reverses it', r)
        await pick(pl, '#settingsModal [data-pref=graphics]', 'low')
        check(await pl.evaluate("tw.settings.prefs().graphics === 'low' && tw.settings.prefs().post === true"), 'Geometry detail Low (its own row since 2026-10-11: the Graphics presets are browser_graphics.py)', await pl.evaluate('tw.settings.prefs()'))
        check(await pl.evaluate("!!document.querySelector('#settingsModal .reload') || tw.facesUsed === '1500'"), 'the geometry tier applies (this URL pins ?faces=, so it says reload; otherwise it swaps live)')
        await pl.evaluate("tw.settings.setPref('ringScale', 1.4); tw.settings.setPref('textScale', 1.2)")
        ts = await pl.evaluate("getComputedStyle(document.getElementById('bar')).zoom")
        check(abs(float(ts) - 1.2) < 0.01, 'text size scales the chrome (the bar here)', ts)
        await pl.evaluate("tw.settings.setPref('cursors', false); tw.settings.setPref('reducedMotion', true); tw.settings.setPref('music', false); tw.settings.setPref('sfxVol', 0.3)")
        await pl.wait_for_timeout(300)
        st = await pl.evaluate("({ cur: tw.worldOf(tw.area()).layers.cursors.visible, rm: document.documentElement.classList.contains('reduce-motion'), saved: JSON.parse(localStorage.getItem('tw.prefs')) })")
        check(not st['cur'] and st['rm'] and st['saved']['music'] is False and st['saved']['sfxVol'] == 0.3, "others' cursors off hides them; reduce motion sets the page class; sound settings are stored", {k: st['saved'][k] for k in ('music', 'sfxVol', 'cursors', 'reducedMotion')})
        await pl.evaluate("tw.settings.setPref('announce', false)")
        await gm.bring_to_front(); await gm.evaluate("tw.sync.submit('chat.say', { id: 'msg_' + Math.random().toString(36).slice(2, 10), text: 'hello there' }, tw.area())")
        await pl.bring_to_front(); await pl.wait_for_timeout(1500)
        check(await pl.evaluate("!tw.announce.info().showing && (tw.view().chat || []).some(c => c.text === 'hello there')"), 'announcements off: the line just lands in the log, no big box')
        await pl.evaluate("tw.settings.close(); tw.settings.open('me')")
        await fill(pl, '#settingsModal .agentname', 'Brakka bot'); await tap(pl, '#settingsModal [data-act=agent]')
        ok = await wait(pl, f"{C}.seats.some(s => s.kind === 'llm' && s.creator === '{PL}' && s.name === 'Brakka bot') && !!document.querySelector('#settingsModal .skey code')", 10000, 'agent')
        key = await pl.evaluate("document.querySelector('#settingsModal .skey code')?.textContent || ''")
        check(ok and '/card?seat=' in key, 'My agents: a player creates an LLM seat and gets its key (the rules card URL)', key[:60])
        await tap(pl, '#settingsModal li[data-seat] [data-act=revoke]')
        check(await wait(pl, f"!{C}.seats.some(s => s.kind === 'llm' && s.name === 'Brakka bot')", 8000, 'revoke agent'), 'and can revoke it')
        await tap(pl, '#settingsModal [data-act=reset]')
        check(await pl.evaluate("(() => { const p = tw.settings.prefs(); return p.zoomSpeed === 1 && p.graphics === 'high' && p.post === true && p.gfx === 'auto' && p.idleFps === 20 && p.fogFx === true && p.lights === 'all' && p.maxFps === 60 && p.density === 'native' && p.cursors === true && p.reducedMotion === false && p.ringScale === 1 && p.textScale === 1 && p.sfxVol === 0.8 && p.music === true; })()") and await pl.evaluate("tw.worldOf(tw.area()).layers.cursors.visible"), 'Reset to defaults restores every personal setting')

        print('REQUESTS: players ask, the GM approves or denies')
        await tap(pl, '#settingsModal [data-act=req-export]')
        await gm.bring_to_front()
        ok = await wait(gm, f"{C}.requests.some(r => r.by === '{PL}' && r.kind === 'export' && r.status === 'pending')", 8000, 'req')
        dot = await gm.evaluate("(d => d && !d.hidden && d.textContent)(document.querySelector('.launcher[data-l=settings] .dot'))")
        check(ok and dot == '1', 'the GM is told: a count on the gear (and a toast)', dot)
        await gm.evaluate("tw.settings.show('admin')")
        await wait(gm, "!!document.querySelector('#settingsModal li[data-req] [data-act=approve]')", 6000, 'req row')
        await tap(gm, '#settingsModal li[data-req] [data-act=approve]')
        await pl.bring_to_front()
        check(await wait(pl, "!!document.querySelector('#settingsModal [data-act=export]')", 8000, 'approved'), 'approved: the player gets "Export now"')
        await pl.evaluate("tw.settings.exportJson()")
        exp = await pl.evaluate("tw.settings.lastExport && tw.settings.lastExport.areas.map(a => a.name)")
        check(exp and 'Wine cellar' not in exp, 'their export holds only what they can see', exp)
        payload = {'v': 1, 'kind': 'turnip-works-campaign', 'name': 'From Brakka', 'areas': [{'name': "Brakka's camp", 'visibility': 'open', 'settings': {'grid': False}, 'entities': {'tok_camp00001': {'id': 'tok_camp00001', 'kind': 'token', 'name': 'Campfire', 'x': 10, 'z': 10, 'rot': 0, 'color': '#e5c07b'}}}]}
        fpath = os.path.join(tempfile.mkdtemp(), 'camp.json'); open(fpath, 'w').write(json.dumps(payload))
        await pl.set_input_files('#settingsModal .reqfile', fpath)
        await gm.bring_to_front()
        await wait(gm, f"{C}.requests.some(r => r.kind === 'import' && r.status === 'pending') && !!document.querySelector('#settingsModal li[data-req]')", 8000, 'import req')
        await tap(gm, '#settingsModal li[data-req] [data-act=approve]')
        ok = await wait(gm, f"{C}.areas.some(a => a.name === \"Brakka's camp\")", 10000, 'import area')
        if not ok: print('    DBG import', await gm.evaluate(f"JSON.stringify({{ reqs: {C}.requests.map(r => [r.kind, r.status]), areas: {C}.areas.map(a => a.name), btn: !!document.querySelector('#settingsModal li[data-req] [data-act=approve]'), sec: tw.settings.state().section, pending: tw.sync.pendingCount?.() }})"))
        AC = await gm.evaluate(f"{C}.areas.find(a => a.name === \"Brakka's camp\")?.id")
        ok2 = AC and await wait(gm, f"!!tw.sync.view('{AC}')?.entities.tok_camp00001", 8000, 'import ents')
        check(ok and ok2 and await gm.evaluate(f"{C}.areas.find(a => a.id === '{AC}').settings.grid === false"), "approving an import applies the player's file as a new area (things and settings)")
        await tap(gm, '.launcher[data-l=settings]') if not await gm.evaluate('tw.settings.state().open') else None
        await gm.evaluate("tw.settings.show('admin')")
        await pl.bring_to_front(); await tap(pl, '#settingsModal [data-act=req-export]'); await gm.bring_to_front()
        await wait(gm, "!!document.querySelector('#settingsModal li[data-req] [data-act=deny]')", 8000, 'deny btn')
        await tap(gm, '#settingsModal li[data-req] [data-act=deny]')
        check(await wait(pl, f"{C}.requests.some(r => r.status === 'denied')", 8000, 'denied'), 'a denied request shows as denied for the player')

        print('3. AREA SETTINGS')
        await gm.evaluate("tw.settings.show('area')")
        await pick(gm, '#settingsModal [data-rule=light]', 'night')
        ok = await wait(gm, f"{C}.areas.find(a => a.id === '{A1}').settings.light === 'night' && tw.worldOf('{A1}').lightProfile === 'night'", 8000, 'night')
        check(ok, 'Lighting: Night is stored on the area and the lighting profile changes')
        await tap(gm, '#settingsModal [data-rule=grid]')
        ok = await wait(gm, f"{C}.areas.find(a => a.id === '{A1}').settings.grid === false && !tw.worldOf('{A1}').grid.visible", 8000, 'grid')
        lab = await gm.evaluate("[...document.querySelectorAll('#settingsModal .srow')].find(r => r.querySelector('[data-rule=grid]'))?.querySelector('.sinh')?.textContent")
        check(ok and lab == 'overridden here', 'Grid off hides the grid; the field says "overridden here"', lab)
        await tap(gm, '#settingsModal [data-reset=grid][data-scope=area]')
        ok = await wait(gm, f"!('grid' in {C}.areas.find(a => a.id === '{A1}').settings) && tw.worldOf('{A1}').grid.visible", 8000, 'reset')
        lab = await gm.evaluate("[...document.querySelectorAll('#settingsModal .srow')].find(r => r.querySelector('[data-rule=grid]'))?.querySelector('.sinh')?.textContent")
        check(ok and lab == 'using default', 'Reset returns it to "using default"', lab)
        await gm.evaluate(f"tw.sync.submit('token.create', {{ id: 'tok_brak0001', name: 'Brakka', x: 10, z: 10, owner: '{PL}', color: '#3366cc' }}, '{A1}')")
        await tap(gm, '#settingsModal [data-rule=freeMoves]')
        await wait(gm, f"{C}.areas.find(a => a.id === '{A1}').settings.freeMoves === false", 8000, 'free')
        await pl.bring_to_front(); await wait(pl, "!!tw.entities().tok_brak0001", 8000, 'tok')
        res = await pl.evaluate(f"(async () => {{ const m = await tw.await(tw.sync.submit('token.move', {{ id: 'tok_brak0001', x: 20, z: 20 }}, '{A1}')); return [m ? 'ok' : 'refused', tw.entities().tok_brak0001.x]; }})()")
        check(res[0] == 'refused', 'free moves off: the relay refuses the player moving their own pawn', res)
        await gm.bring_to_front(); await tap(gm, '#settingsModal [data-reset=freeMoves][data-scope=area]')
        # (2026-10-06: an area is open or hidden, one switch; the three-way rule and the per-seat grants are gone)
        await tap(gm, '#settingsModal [data-areaopen]')
        await pl.bring_to_front()
        ok = await wait(pl, f"!{C}.areas.some(a => a.id === '{A1}')", 8000, 'hidden')
        await gm.bring_to_front(); gone = await gm.evaluate("!document.querySelector('#settingsModal [data-grant]') && !document.querySelector('#settingsModal select[data-vis]')")
        await tap(gm, '#settingsModal [data-areaopen]')
        await pl.bring_to_front(); ok2 = await wait(pl, f"{C}.areas.some(a => a.id === '{A1}')", 8000, 'open again'); await gm.bring_to_front()
        check(ok and ok2 and gone, 'Area ▸ "Open to players" off hides the area from the player; on gives it back (no three-way rule, no grants)')

        print('4. GLOBAL DEFAULTS')
        await gm.evaluate("tw.settings.show('defaults')")
        await tap(gm, '#settingsModal [data-rule=grid][data-scope=defaults]')
        ok = await wait(gm, f"{C}.defaults.grid === false && !tw.worldOf('{A1}').grid.visible", 8000, 'def grid')
        check(ok, 'a default (grid off) applies to every area that does not override it')
        await gm.evaluate(f"tw.sync.submit('area.set', {{ area: '{A1}', settings: {{ grid: true }} }})")
        check(await wait(gm, f"tw.worldOf('{A1}').grid.visible", 8000, 'override'), 'an area override wins over the default')
        await gm.evaluate(f"tw.sync.submit('area.set', {{ area: '{A1}', settings: {{ grid: null }} }})")
        await pick(gm, '#settingsModal [data-camp=units]', 'm'); await pick(gm, '#settingsModal [data-camp=rolls]', 'hidden'); await pick(gm, '#settingsModal [data-camp=houseAnim]', 'harry-v1')
        ok = await wait(gm, f"{C}.defaults.units === 'm' && {C}.defaults.rolls === 'hidden' && {C}.defaults.houseAnim === 'harry-v1'", 8000, 'camp')
        check(ok and await wait(gm, "tw.settings.applied().anim === 'harry-v1'", 4000, 'anim'), 'campaign-wide items are stored (units, rolls); the house spawn animation switches')
        await fill(gm, '#settingsModal .campname', 'The Otter Inn')
        check(await wait(pl, f"{C}.name === 'The Otter Inn'", 8000, 'campname'), 'renaming the campaign reaches everyone')
        await tap(gm, '#settingsModal [data-reset=grid][data-scope=defaults]')

        print('Me, live: graphics detail and rotate settings')
        f0 = await gm.evaluate("tw.facesUsed")
        await gm.evaluate("window.__r0 = [...tw.worldOf(tw.area()).recs.values()].find(r => r.entity.url && r.visual && !r.visual.userData?.placeholder) || null; window.__v0 = window.__r0?.visual; window.__s0 = [...tw.worldOf(tw.area()).shell.values()][0]; window.__sv0 = window.__s0?.visual")
        await gm.evaluate("tw.setFaces('5000')")
        ok = await wait(gm, "tw.facesUsed === '5000' && (!window.__r0 || window.__r0.visual !== window.__v0) && (!window.__s0 || window.__s0.visual !== window.__sv0)", 15000, 'faces swap')
        check(ok and f0 != '5000' and await gm.evaluate("tw.assets.faces() === '5000'"), 'a new graphics detail tier applies at once (visuals swapped in place, no reload)', [f0, await gm.evaluate('tw.facesUsed')])
        await gm.evaluate(f"tw.setFaces('{f0}')")
        await gm.evaluate("tw.settings.setPref('rotateSpeed', 2); tw.settings.setPref('invertRotate', true)")
        y0 = await gm.evaluate("tw.main.grab.yaw"); await gm.evaluate("tw.rotateView(null, 10, 0)"); y1 = await gm.evaluate("tw.main.grab.yaw")
        await gm.evaluate("tw.settings.setPref('rotateSpeed', 1); tw.settings.setPref('invertRotate', false)")
        check(abs(((y1 - y0 + 540) % 360 - 180) + 20) < 0.01, 'rotate speed and invert reach Option-scroll, the rotate gesture and Q/E (they all turn through one rotateView)', round(y1 - y0, 2))
        print('5. CAMPAIGN ADMIN')
        await gm.evaluate("tw.settings.show('admin')")
        await fill(gm, '#settingsModal .snapname', 'Before the fight'); await tap(gm, '#settingsModal [data-act=snap]')
        ok = await wait(gm, "!!document.querySelector('#settingsModal li[data-snap]')", 8000, 'snap listed')
        rel = await gm.evaluate("fetch(`${tw.relayBase}/c/${tw.sync.campaign.id}/snapshots?seat=${encodeURIComponent(tw.sync.token)}`).then(r => r.json())")
        plr = await pl.evaluate("fetch(`${tw.relayBase}/c/${tw.sync.campaign.id}/snapshots?seat=${encodeURIComponent(tw.sync.token)}`).then(r => r.status)")
        local = await gm.evaluate("Object.keys(localStorage).filter(k => k.startsWith('tw.snaps.')).length")
        check(ok and rel.get('ok') and [x['name'] for x in rel['snapshots']] == ['Before the fight'] and plr == 403 and local == 0, 'a snapshot of the area is saved ON THE RELAY for this campaign (any of the GM\'s devices); a player is refused', [ok, str(rel)[:300], plr, local])
        await gm.evaluate(f"tw.sync.submit('token.delete', {{ id: 'tok_brak0001' }}, '{A1}')")
        await wait(gm, "!tw.entities().tok_brak0001", 6000)
        await tap(gm, '#settingsModal li[data-snap] [data-act=restore]')
        check(await wait(gm, "!!tw.entities().tok_brak0001", 8000, 'restore'), 'restoring it brings back what was deleted since')
        await gm.evaluate("tw.settings.exportJson()")
        n0 = await gm.evaluate(f"{C}.areas.length")
        exp = await gm.evaluate("tw.settings.lastExport")
        check(exp and len(exp['areas']) == n0 and any(a['entities'] for a in exp['areas']), 'export writes every area with its things and settings', [a['name'] for a in exp['areas']])
        await gm.evaluate("tw.settings.importData(tw.settings.lastExport)")
        check(await wait(gm, f"{C}.areas.length === {n0 * 2}", 15000, 'import'), 'import adds them back as new areas')
        await fill(gm, '#settingsModal .seatname', 'Mira'); await tap(gm, '#settingsModal [data-act=newseat]')
        ok = await wait(gm, f"{C}.seats.some(s => s.name === 'Mira') && !!document.querySelector('#settingsModal .skey code')", 8000, 'invite')
        inv = await gm.evaluate("document.querySelector('#settingsModal .skey code')?.textContent || ''")
        check(ok and '#s=' in inv, 'inviting a player makes a seat and shows its invite link', inv[-30:])
        mira = await gm.evaluate(f"{C}.seats.find(s => s.name === 'Mira').id")
        await tap(gm, f'#settingsModal li[data-seat="{mira}"] [data-act=revoke]')
        check(await wait(gm, f"!{C}.seats.some(s => s.id === '{mira}')", 8000, 'revoke'), 'revoke removes the seat')
        await gm.evaluate("for (const x of document.querySelectorAll('#settingsModal [data-cls]')) x.checked = ['chat', 'token.move'].includes(x.dataset.cls)")
        await fill(gm, '#settingsModal .gmagent', 'Narrator'); await tap(gm, '#settingsModal [data-act=gmagent]')
        ok = await wait(gm, f"{C}.seats.some(s => s.kind === 'llm' && s.name === 'Narrator')", 8000, 'gm agent')
        card = await gm.evaluate("[...document.querySelectorAll('#settingsModal .skey code')].map(c => c.textContent).find(t => t.includes('/card?seat=')) || ''")
        body = await gm.evaluate(f"fetch({json.dumps(card)}).then(r => r.text()).catch(e => String(e))") if '/card?seat=' in card else ''
        check(ok and 'chat.say' in body and 'token.move' in body and 'room.spawn' not in body and 'object.place' not in body, "a GM agent seat gets exactly the ticked permissions (its rules card lists only those commands)", card[:60])
        real = [e for e in errors if not any(s in e for s in ('WebSocket', 'ERR_CONNECTION', '502', 'Refused:', 'status of 403')) and not (A.local and 'Failed to load resource' in e)]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'browser settings: {passed}/{len(results)} passed')
    return passed == len(results)

try: ok = asyncio.run(main())
finally:
    for p in procs:
        try: p.terminate()
        except Exception: pass
sys.exit(0 if ok else 1)

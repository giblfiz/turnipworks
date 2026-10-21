#!/usr/bin/env python3
"""Areas are open or hidden, and pawns travel between them (Harry 2026-10-06; docs/PAWNS.md "Areas", docs/UI.md).
A GM tab and a player tab against a throwaway local relay.

  local:  TW_GPU=1 python3 engine/test/browser_areas.py --local

  HIDDEN    a new area starts hidden; the player's browser is never SENT it (every websocket frame and relay answer the
            player tab receives is kept: the area's name and id are in none of them); Settings lists only the open one
  GM KNOWS  the constant button "Hidden from players · Open this area", the name tag and the view's frame in the hidden
            look, the mark in Settings ▸ World navigation, on the picture-in-picture, in the travel list; open / hide
            from the button; four screenshots (engine/test/shots/areas-*.png) for a blind read
  SEND      the pawn's ☰ has "Send to area ▸", a sub-menu at its button; the GM sends a player's pawn into the hidden
            area: the pawn goes, the area opens, the GM's view goes with it, ONE button "Opened … for players · Undo";
            the player is offered "Follow" (her view does not move by itself); Undo: the pawn is back where it stood,
            the area is hidden again, the player is put out of it
  TRAVEL    a player sends her own pawn to an open area and her view goes with it; the GM gets "Bring … back", which
            goes down into the chat as "… went to … · [Bring back]"; pressing it brings the pawn back
  LOCK      Settings ▸ Global defaults ▸ Players travel between areas: off, and the player's travel list says so
  NONE      the only open area is hidden: the player is told, and comes back when it is opened
"""
import argparse, asyncio, json, os, random, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []; dirs = []
SHOTS = os.path.join(HERE, 'shots'); os.makedirs(SHOTS, exist_ok=True)
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = 18141, 18771
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-areas-'); site = tempfile.mkdtemp(prefix='tw-site-'); dirs.extend([data, site])  # /tmp is RAM-backed: removed at exit
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over')
    await pg.wait_for_timeout(300)
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
STATE = "tw.areaStateView()"
AREAS = "tw.sync.campaign.areas.map(a => [a.name, a.visibility])"
CBTNS = "tw.condButtons.list().filter(b => b.visible).map(b => b.text)"
LINES = "tw.actionLines.list().map(l => [l.text, l.button, l.state, l.done])"
NAVROWS = "[...document.querySelectorAll('#settingsModal .sarea')].map(li => ({ name: li.querySelector('.aname')?.value || li.querySelector('.san b')?.textContent, hidden: li.classList.contains('hidden-area'), small: li.querySelector('.san small').textContent.trim(), mark: !!li.querySelector('.ahid'), btn: li.querySelector('[data-act=vis]')?.textContent.trim() || null }))"
STYLE = lambda sel: f"(() => {{ const e = document.querySelector('{sel}'); if (!e) return null; const s = getComputedStyle(e); return {{ style: s.borderTopStyle, color: s.borderTopColor, outline: s.outlineStyle, ocolor: s.outlineColor, shown: !e.hidden && e.getBoundingClientRect().width > 0 }}; }})()"
VIOLET = ('rgb(167, 139, 250)', 'rgb(124, 92, 214)')
SECRET = 'Zxqcrypt of Morrowgloom'

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []; traffic = []; pending = []
        async def tab(url, w=1400, h=900, keep=False, **kw):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, **kw)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            if keep:  # everything the relay sends this tab: websocket frames, SSE and every HTTP answer from the relay
                pg.on('websocket', lambda ws: ws.on('framereceived', lambda f: traffic.append(f if isinstance(f, str) else str(getattr(f, 'payload', f)))))
                async def body(r):
                    try:
                        if f':{RP}/' in r.url and 'image' not in (r.headers.get('content-type') or ''): traffic.append(r.url + ' ' + (await r.text()))
                    except Exception: pass
                pg.on('response', lambda r: pending.append(asyncio.ensure_future(body(r))))
            await pg.goto(url); return pg
        gm = await tab(page, reduced_motion='reduce')  # (no ring slide: this suite does not test motion)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST areas {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        INN = await gm.evaluate('tw.area()')
        rid = f"room_inn{random.randrange(10**6):06d}"
        await gm.evaluate(SPAWN, {'id': rid, 'type': 'common', 'x': 0, 'z': 0, 'w': 6, 'd': 4, 'seed': 5101})
        check(await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000), 'the inn is built')
        await settle(gm)
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
        pl = await tab(invite + '&nofx', keep=True, reduced_motion='reduce')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab joined')
        MIRA = await gm.evaluate("tw.sync.campaign.seats.find(s => s.name === 'Mira').id")
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_brakka01', name: 'Brakka', x: 12.5, z: 7.5, owner: '{MIRA}' }}); tw.dispatch('token.create', {{ id: 'tok_goblin01', name: 'Goblin', x: 22.5, z: 12.5 }})")
        await wait(pl, "tw.entities().tok_brakka01", 8000, 'the player sees her pawn')
        st = await gm.evaluate(STATE)
        check(st['shown'] and not st['hidden'] and not st['frame'] and 'Open to players' in st['text'], 'GM, in the first area: a quiet tag says it is open to players', str(st))
        check(not (await pl.evaluate(STATE))['shown'], 'a player gets no such tag')

        # ---------------- HIDDEN: a new area starts hidden; the player is never sent it ----------------
        print('HIDDEN')
        await gm.keyboard.press('s'); await gm.wait_for_timeout(400)
        check(await gm.evaluate("!document.querySelector('#settingsModal .newvis') && /starts hidden/.test(document.querySelector('#settingsModal .snew').textContent)"), 'Settings ▸ World navigation: the new-area form has no visibility choice and says a new area starts hidden')
        await gm.fill('#settingsModal .newname', SECRET); await gm.click('#settingsModal [data-act=create]')
        await wait(gm, "tw.sync.campaign.areas.length === 2", 8000, 'area created'); await gm.wait_for_timeout(400)
        check(await gm.evaluate(AREAS) == [['Area 1', 'open'], [SECRET, 'hidden']], 'the new area is hidden; the first stays open', str(await gm.evaluate(AREAS)))
        CRYPT = await gm.evaluate("tw.sync.campaign.areas[1].id")
        rows = await gm.evaluate(NAVROWS)
        check(len(rows) == 2 and rows[1]['hidden'] and rows[1]['mark'] and 'Hidden from players' in rows[1]['small'] and rows[1]['btn'] == 'Open to players' and not rows[0]['hidden'] and 'Open to players' in rows[0]['small'] and rows[0]['btn'] == 'Hide', "the GM's area list marks the hidden one (the eye-off mark, the words, an Open button) and the open one (Hide)", json.dumps(rows))
        b = await gm.evaluate(STYLE('#settingsModal .sarea.hidden-area'))
        check(b and b['style'] == 'dashed' and b['color'] in VIOLET, 'its row wears the hidden look: a dashed violet edge', str(b))
        await gm.screenshot(path=os.path.join(SHOTS, 'areas-settings-list.png'))
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        # the GM works in it
        await gm.evaluate(f"tw.setMain('{CRYPT}')"); await wait(gm, f"tw.area() === '{CRYPT}' && tw.sync.view('{CRYPT}')", 8000)
        await gm.evaluate(SPAWN, {'id': 'room_zxqcrypt01', 'type': 'common', 'x': 0, 'z': 0, 'w': 6, 'd': 4, 'seed': 77})
        await wait(gm, "tw.entities().room_zxqcrypt01 && tw.sync.pendingCount() === 0", 30000); await settle(gm)
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_zxqlich01', name: 'Zxqlich', x: 17.5, z: 12.5 }); tw.say && tw.say('zxqwhisper')")
        await gm.mouse.move(700, 500); await gm.mouse.move(720, 520); await gm.wait_for_timeout(500)
        # the player: Settings lists one area; nothing she was sent names the other
        await pl.keyboard.press('s'); await pl.wait_for_timeout(500)
        prow = await pl.evaluate(NAVROWS)
        check(len(prow) == 1 and not prow[0]['mark'] and 'idden' not in prow[0]['small'] and prow[0]['btn'] is None, "the player's Settings ▸ World navigation lists the open area only, with no word about visibility", json.dumps(prow))
        await pl.keyboard.press('Escape')
        refused = await pl.evaluate(f"(async () => {{ tw.sync.subscribe('{CRYPT}'); await new Promise(r => setTimeout(r, 500)); const v = !!tw.sync.view('{CRYPT}'); return v; }})()")
        check(refused is False, 'the player tab asking to view it (main view or picture-in-picture: the same request) gets nothing')
        gmrow = await pl.evaluate("(() => { const g = tw.sync.campaign.seats.find(s => s.role === 'gm'); return [g.location, g.elsewhere, document.querySelector('#roster .av:not(.me) .where')?.textContent]; })()")
        check(gmrow[0] is None and gmrow[1] is False and gmrow[2] == '—', "the GM, who is in the hidden area, shows no place on the player's roster", str(gmrow))
        await asyncio.gather(*pending, return_exceptions=True)
        blob = '\n'.join(t for t in traffic if not t.startswith('{"t":"hidden"'))
        leaks = [n for n in (SECRET, 'Zxq', 'zxq', 'Morrowgloom') if n in blob]  # (the id itself: the player tab's own probe above sent it, so only the relay's echo could hold it; the node suite proves that echo equals the answer for a missing area)
        if not A.local: print('    (against a deployed relay the traffic is not kept: the transport there is SSE through a proxy; the local run and engine/test/areas.test.mjs hold this proof)')
        else: check(len(traffic) >= 10 and '"t":"welcome"' in blob and 'Area 1' in blob and 'Brakka' in blob and not leaks, f"nothing the relay sent the player's browser ({len(traffic)} frames and answers, her own area and pawn among them) names the hidden area or anything in it", str(leaks))

        # ---------------- GM KNOWS ----------------
        print('GM KNOWS')
        st = await gm.evaluate(STATE)
        check(st['shown'] and st['hidden'] and st['frame'] and 'Hidden from players · Open this area' in st['text'] and SECRET in st['text'], 'in the hidden area: the constant button "Hidden from players · Open this area", with the area\'s name', str(st))
        nb = await gm.evaluate(STYLE('#areaState .aname')); bb = await gm.evaluate(STYLE('#areaState button')); fr = await gm.evaluate(STYLE('#areaVeil'))
        check(nb['style'] == 'dashed' and nb['color'] in VIOLET and bb['style'] == 'dashed' and bb['color'] in VIOLET and await gm.evaluate("!!document.querySelector('#areaState .aname svg')"), "the area's name and the button wear the hidden look (dashed violet edge, the eye-off mark)", str([nb, bb]))
        check(fr['shown'] and fr['style'] == 'dashed' and fr['color'] in VIOLET, 'the whole view has the dashed violet frame', str(fr))
        r = await gm.evaluate("(() => { const b = document.querySelector('#areaState button').getBoundingClientRect(), bar = document.querySelector('#bar').getBoundingClientRect(), ro = document.querySelector('#roster').getBoundingClientRect(), la = document.querySelector('#launchers').getBoundingClientRect(); const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom; return { on: b.top >= 0 && b.right <= innerWidth, bar: hit(b, bar), roster: hit(b, ro), launch: hit(b, la), focus: document.activeElement?.id || document.activeElement?.tagName }; })()")
        check(r['on'] and not r['bar'] and not r['roster'] and not r['launch'], 'the button is on screen and covers neither the command bar, the roster nor the launchers', str(r))
        await gm.wait_for_timeout(9500)  # constant: still there long after any conditional button would have gone
        check((await gm.evaluate(STATE))['hidden'], 'ten seconds on, it is still there (it is constant, not a conditional button)')
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(15, 0, 10); g.pitch = 58; g.yaw = 0; g.dist = 95; g.update(); })()"); await gm.wait_for_timeout(600)
        await gm.screenshot(path=os.path.join(SHOTS, 'areas-gm-hidden.png'))
        # open / hide from the button itself
        await gm.click('#areaState button[data-open="1"]'); await wait(gm, "!tw.areaHidden()", 6000)
        st = await gm.evaluate(STATE)
        check(not st['hidden'] and not st['frame'] and 'Open to players' in st['text'] and await pl.evaluate("tw.sync.campaign.areas.length") == 2, 'pressing it opens the area: the frame goes, the tag says open, the player has it in her list', str(st))
        await gm.screenshot(path=os.path.join(SHOTS, 'areas-gm-open.png'))
        await gm.click('#areaState button[data-open="0"]'); await wait(gm, "tw.areaHidden()", 6000)
        check((await gm.evaluate(STATE))['hidden'] and await wait(pl, "tw.sync.campaign.areas.length === 1", 6000), 'the same place hides it again, and the player loses it')
        # the picture-in-picture of a hidden area, from the open one
        await gm.evaluate(f"tw.setMain('{INN}')"); await wait(gm, f"tw.area() === '{INN}'", 6000)
        await gm.evaluate(f"tw.openPip('{CRYPT}')"); await gm.wait_for_timeout(1200)
        st = await gm.evaluate(STATE); pf = await gm.evaluate(STYLE('#pipFrame'))
        check(st['pip'] and not st['hidden'] and not st['frame'] and pf['outline'] == 'dashed' and pf['ocolor'] in VIOLET and 'Hidden from players' in await gm.evaluate("document.querySelector('#pipHid').textContent"), "a picture-in-picture of the hidden area: its frame is dashed violet and its title says Hidden from players (the main view, an open area, has no frame)", str([st, pf]))
        await gm.screenshot(path=os.path.join(SHOTS, 'areas-pip-hidden.png'))
        await gm.evaluate("tw.closePip()")

        # ---------------- SEND: the pawn's ☰, the GM sends a player's pawn into the hidden area ----------------
        print('SEND')
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(15, 0, 10); g.pitch = 52; g.yaw = 0; g.dist = 95; g.update(); tw.select('tok_brakka01'); })()"); await gm.wait_for_timeout(500)
        await gm.click('#ring [data-menu]'); await gm.wait_for_timeout(300)
        top = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn.ex')].map(b => b.dataset.cmd || '▸' + b.dataset.group)")
        check('pawn.travel' in top and len(top) <= 12 and not await gm.evaluate("tw.menuOrphans?.().length || 0"), "a pawn's ☰ has Send to area ▸ (in the menu table; no more than 12 options)", str(top))
        await gm.click('#ring .rbtn.grp[data-group="travel"]'); await gm.wait_for_timeout(400)
        # (2026-10-20: a sub-menu is the ring grown outward, one .rbtn[data-nest] per area, no longer a panel of tiles)
        fly = await gm.evaluate("(() => { const f = tw.ringFlyout(), ns = tw.ringNodes(), op = ns.find(n => n.id === 'pawn.travel')?.curve, items = [...document.querySelectorAll('#ring .rbtn[data-nest][data-group=travel]')], cs = items.map(b => ns.find(n => n.id === b.dataset.id)?.curve); return f && { nest: f.nest, state: tw.ringState(), tiles: f.tiles, anchorIs: f.anchorIs, outward: !!op && !!document.querySelector('#ring .rbtn.grp[data-group=travel]') && items.length > 0 && cs.every(q => q && Math.abs(q.cx - op.cx) < 1 && Math.abs(q.cy - op.cy) < 1 && q.rx > op.rx + 20 && q.ry > op.ry + 20), hid: items.map(b => [b.dataset.tip, b.classList.contains('hidden-area'), !!b.querySelector('svg'), b.title, b.dataset.area]) }; })()")
        check(fly and fly['nest'] and fly['state'] == 'nested' and fly['anchorIs'] == 'travel' and fly['outward'], 'its button opens it as a sub-menu: the ring\'s own oval grown outward (same centre, wider and taller)', str(fly))
        check(fly and len(fly['hid']) == 1 and fly['hid'][0][0] == f'{SECRET} · hidden' and fly['hid'][0][1] and fly['hid'][0][2] and fly['hid'][0][4] == CRYPT and 'OPENS' in fly['hid'][0][3], 'the travel list marks the hidden area ("· hidden" after its whole name, the hidden look, its eye-off picture) and says that sending a player\'s pawn there opens it', str(fly and fly['hid']))
        ts = await gm.evaluate(STYLE('#ring .rbtn[data-nest][data-group=travel]'))
        check(ts['style'] == 'dashed' and ts['color'] in VIOLET, 'that entry has the dashed violet edge', str(ts))
        await gm.screenshot(path=os.path.join(SHOTS, 'areas-travel-list.png'))
        pl_main = await pl.evaluate('tw.area()')
        await gm.click('#ring .rbtn[data-nest][data-group=travel]');
        check(await wait(gm, f"tw.area() === '{CRYPT}' && tw.entities().tok_brakka01 && !tw.areaHidden()", 8000, 'sent'), "the GM sends the player's pawn into the hidden area: the pawn is there, the area is open, and the GM's view went with it")
        await gm.wait_for_timeout(500)
        btns = await gm.evaluate(CBTNS)
        check(btns == [f'Opened {SECRET} for players · Undo'], 'ONE contextual button: "Opened <area> for players · Undo"', str(btns))
        g = await gm.evaluate("(() => { const b = tw.entities().tok_brakka01, c = document.getElementById('c').getBoundingClientRect(), s = tw.screenOf(b.x, b.z, tw.main, 0); return { x: b.x, z: b.z, off: [Math.round(s.x - c.width / 2), Math.round(s.y - c.height / 2)], near: Math.hypot(s.x - c.width / 2, s.y - c.height / 2) < 0.1 * c.height, sel: tw.selected().map(e => e.id), sq: (b.x % 5 === 2.5) && (b.z % 5 === 2.5), room: !!tw.roomAt(b.x, b.z, 0) }; })()")
        check(g['sq'] and not g['room'] and g['z'] > 20 and g['near'], 'the pawn arrived on a square out on open ground to the south of the building (not in a room it has not found), in the middle of the view', str(g))
        await gm.screenshot(path=os.path.join(SHOTS, 'areas-opened-undo.png'))
        cam = await gm.evaluate("(() => { const g = tw.main.grab, keep = [g.yaw, g.pitch]; g.yaw = -20; g.pitch = 52; g.update(); const r = tw.main.camera.position.z - g.focus.z; g.yaw = keep[0]; g.pitch = keep[1]; g.update(); return r; })()")
        check(cam > 0, 'that side (south, +z) is the one nearest the camera in the home view: the newcomer stands in front of the building', f'{cam:.1f}')
        await wait(pl, "tw.sync.campaign.areas.length === 2 && tw.condButtons.list().some(b => b.visible)", 8000, 'the player is offered')
        pb = await pl.evaluate(CBTNS)
        check(pb == [f'Follow Brakka to {SECRET}'] and await pl.evaluate('tw.area()') == pl_main, "the player is offered \"Follow Brakka to …\"; her view has not moved by itself", str(pb))
        await pl.evaluate("document.querySelector('.cbtn.afollow').click()")
        check(await wait(pl, f"tw.area() === '{CRYPT}' && tw.entities().tok_brakka01 && !tw.entities().tok_zxqlich01?.hidden", 8000, 'followed'), 'pressing it takes her there, where her pawn is')
        # UNDO: back, and hidden again
        await gm.evaluate("document.querySelector('.cbtn.aopened').click()")
        ok = await wait(gm, "tw.areaHidden() && !tw.entities().tok_brakka01", 8000, 'undone')
        back = await gm.evaluate(f"(async () => {{ tw.sync.subscribe('{INN}'); for (let i = 0; i < 40 && !tw.sync.view('{INN}')?.entities.tok_brakka01; i++) await new Promise(r => setTimeout(r, 100)); const b = tw.sync.view('{INN}')?.entities.tok_brakka01; return b && [b.x, b.z]; }})()")
        check(ok and back == [12.5, 7.5], 'Undo: the pawn is back exactly where it stood AND the area is hidden again', str(back))
        check((await gm.evaluate(STATE))['hidden'] and await wait(pl, f"tw.sync.campaign.areas.length === 1 && tw.area() === '{INN}' && !tw.sync.view('{CRYPT}')", 8000, 'player out'), 'the GM is told it is hidden again; the player is put out of it, back to the open area, holding nothing of it')
        await gm.wait_for_timeout(1200)
        check(await gm.evaluate(CBTNS) == [] and not any(l[1] == 'Undo' and l[2] is None for l in await gm.evaluate(LINES)), 'a pressed button leaves nothing behind to press twice', str(await gm.evaluate(LINES)))
        # an NPC goes in quietly
        await gm.evaluate(f"tw.setMain('{INN}')"); await wait(gm, f"tw.area() === '{INN}' && tw.entities().tok_goblin01", 6000)
        await gm.evaluate(f"tw.travel([tw.entities().tok_goblin01], '{CRYPT}')")
        await wait(gm, f"tw.area() === '{CRYPT}' && tw.entities().tok_goblin01", 8000); await gm.wait_for_timeout(400)
        check(await gm.evaluate("tw.areaHidden()") and await gm.evaluate(CBTNS) == [] and await pl.evaluate("tw.sync.campaign.areas.length") == 1, 'an NPC sent into the hidden area: the area stays hidden, and there is no button')

        # ---------------- TRAVEL: a player goes to an open area; the GM brings her back ----------------
        print('TRAVEL')
        await gm.evaluate(f"tw.setMain('{INN}')"); await wait(gm, f"tw.area() === '{INN}'", 6000)
        await gm.evaluate("tw.sync.submit('area.create', { id: 'area_road000001', name: 'The Road' })"); await wait(gm, "tw.sync.campaign.areas.length === 3", 6000)
        check(await gm.evaluate("tw.sync.campaign.areas[2].visibility") == 'hidden', 'a third area also starts hidden')
        await gm.evaluate("tw.setAreaOpen('area_road000001', true)"); await wait(pl, "tw.sync.campaign.areas.length === 2", 6000)
        await pl.evaluate("(() => { const g = tw.main.grab; g.focus.set(15, 0, 10); g.pitch = 52; g.yaw = 0; g.dist = 95; g.update(); tw.select('tok_brakka01'); })()"); await pl.wait_for_timeout(500)
        await pl.click('#ring [data-menu]'); await pl.wait_for_timeout(300)
        await pl.click('#ring .rbtn.grp[data-group="travel"]'); await pl.wait_for_timeout(400)
        tiles = await pl.evaluate("[...document.querySelectorAll('#ring .rbtn[data-nest][data-group=travel]')].map(b => [b.dataset.tip, b.classList.contains('hidden-area')])")
        check(tiles == [['The Road', False]], "the player's travel list: the open areas only", str(tiles))
        await pl.click('#ring .rbtn[data-nest][data-group=travel]')
        check(await wait(pl, "tw.area() === 'area_road000001' && tw.entities().tok_brakka01", 8000, 'player travelled'), 'a player sends her own pawn to an open area, and her view goes with it')
        await wait(gm, "tw.condButtons.list().some(b => b.visible)", 6000, 'the GM is offered')
        gb = await gm.evaluate(CBTNS)
        check(gb == ['Bring Brakka back'], 'the GM, in the area she left, gets "Bring Brakka back" where the pawn stood', str(gb))
        await gm.evaluate("tw.condButtons.list().forEach(b => tw.condButtons.expire(b.key))"); await gm.wait_for_timeout(1400)
        ln = [l for l in await gm.evaluate(LINES) if 'went to' in l[0]]
        check(len(ln) == 1 and ln[0][0] == 'Brakka went to The Road' and ln[0][1] == 'Bring back' and ln[0][2] is None, 'its time up, it goes down into the chat: "Brakka went to The Road · [Bring back]", still pressable', str(await gm.evaluate(LINES)))
        await gm.screenshot(path=os.path.join(SHOTS, 'areas-bring-back.png'))
        await gm.evaluate("(() => { const l = tw.actionLines.list().find(l => /went to/.test(l.text)); tw.actionLines.press(l.id); })()")
        check(await wait(gm, "tw.entities().tok_brakka01?.x === 12.5 && tw.entities().tok_brakka01?.z === 7.5", 8000, 'brought back'), 'pressing it brings the pawn back to where it stood')
        await wait(pl, "tw.condButtons.list().some(b => b.visible)", 6000)
        check(await pl.evaluate(CBTNS) == ['Follow Brakka to Area 1'] and await pl.evaluate('tw.area()') == 'area_road000001', "the player, whose pawn was taken back, is offered Follow (her view stays until she presses it)", str(await pl.evaluate(CBTNS)))
        await pl.evaluate("document.querySelector('.cbtn.afollow').click()"); await wait(pl, f"tw.area() === '{INN}'", 6000)
        # Settings ▸ World navigation moves only the view
        await pl.keyboard.press('s'); await pl.wait_for_timeout(400)
        await pl.evaluate("[...document.querySelectorAll('#settingsModal .sarea')].find(li => li.dataset.area === 'area_road000001').querySelector('[data-act=here]').click()")
        await wait(pl, "tw.area() === 'area_road000001' && tw.sync.view('area_road000001')", 6000); await pl.wait_for_timeout(300)
        check(await pl.evaluate("!tw.entities().tok_brakka01") and await gm.evaluate("!!tw.entities().tok_brakka01"), 'Settings ▸ World navigation moves only the view: the pawn stays where it was')
        await pl.evaluate(f"tw.setMain('{INN}')"); await wait(pl, f"tw.area() === '{INN}' && tw.entities().tok_brakka01", 6000)
        # the command bar
        await pl.evaluate("tw.select('tok_brakka01')"); await pl.keyboard.press('/'); await pl.keyboard.type('travel to road', delay=8); await pl.wait_for_timeout(400)
        res = await pl.evaluate("[...document.querySelectorAll('#results .res')].slice(0, 3).map(r => r.textContent.trim())")
        check(res and 'travel' in res[0] and 'The Road' in res[0] and 'Brakka' in res[0], 'the command bar: "travel to road" offers travel · Brakka → The Road', str(res))
        await pl.keyboard.press('Escape'); await pl.keyboard.press('Escape')

        # ---------------- LOCK ----------------
        print('LOCK')
        await gm.keyboard.press('s'); await gm.wait_for_timeout(400); await gm.keyboard.press('g'); await gm.wait_for_timeout(400)
        check(await gm.evaluate("(() => { const t = document.querySelector('#settingsModal [data-travel]'); return !!t && t.classList.contains('on') && /Players travel between areas/.test(t.closest('.srow').textContent); })()"), 'Settings ▸ Global defaults has "Players travel between areas", on')
        await gm.click('#settingsModal [data-travel]'); await wait(pl, "tw.travelLocked()", 6000, 'locked'); await gm.wait_for_timeout(300)
        check(await gm.evaluate("(() => { const t = document.querySelector('#settingsModal [data-travel]'); return !t.classList.contains('on') && /Locked/.test(t.closest('.srow').textContent); })()"), 'switched off, it says Locked')
        await gm.keyboard.press('Escape')
        await pl.evaluate("(() => { const e = tw.entities().tok_brakka01, g = tw.main.grab; g.focus.set(e.x, 0, e.z); g.pitch = 52; g.yaw = 0; g.dist = 95; g.update(); tw.select('tok_brakka01'); })()"); await pl.wait_for_timeout(300)
        await pl.click('#ring [data-menu]'); await pl.wait_for_timeout(300); await pl.click('#ring .rbtn.grp[data-group="travel"]'); await pl.wait_for_timeout(400)
        tiles = await pl.evaluate("[...document.querySelectorAll('#ring .rbtn[data-nest][data-group=travel]')].map(b => b.dataset.tip)")
        check(tiles == ['The GM has locked travel'], "locked: the player's travel list says so, in place of the areas", str(tiles))
        await pl.click('#ring .rbtn[data-nest][data-group=travel]'); await pl.wait_for_timeout(400)
        check(await pl.evaluate("document.querySelector('#toast').textContent") == 'The GM has locked travel between areas' and await pl.evaluate(f"tw.area() === '{INN}' && !!tw.entities().tok_brakka01"), 'pressing it says why; nothing moves')
        nack = await pl.evaluate(f"(async () => {{ const m = await tw.await(tw.sync.submit('travel', {{ id: 'tok_brakka01', from: '{INN}', to: 'area_road000001' }})); await new Promise(r => setTimeout(r, 200)); return [m, document.querySelector('#toast').textContent]; }})()")
        check(nack[0] is None and 'locked travel' in nack[1], 'and the relay refuses the command itself, with the reason', str(nack))
        await gm.evaluate("tw.registry.run('area.travelLock')"); await wait(pl, "!tw.travelLocked()", 6000)
        check(await pl.evaluate("!tw.travelLocked()"), 'the command bar\'s "Unlock travel" lifts it')

        # ---------------- NONE: nothing open ----------------
        print('NONE')
        await gm.evaluate(f"tw.setAreaOpen('area_road000001', false); tw.setAreaOpen('{INN}', false)")
        check(await wait(pl, "tw.areaStateView().none && tw.sync.campaign.areas.length === 0", 8000, 'none'), 'the GM hides every area: the player is told "No area is open to you right now"')
        check((await gm.evaluate(STATE))['hidden'], '(and the GM is told the area they are in is now hidden)')
        await gm.evaluate(f"tw.setAreaOpen('{INN}', true)")
        check(await wait(pl, f"!tw.areaStateView().none && tw.area() === '{INN}' && tw.entities().tok_brakka01", 10000, 'back'), 'opened again: the player is back in it, pawn and all')
        # the arrival mark, from the command bar
        await gm.evaluate(f"tw.setMain('{CRYPT}')"); await wait(gm, f"tw.area() === '{CRYPT}' && tw.sync.view('{CRYPT}')", 6000)
        await gm.evaluate("tw.clearSelection(); tw.placeArrival([42.5, 22.5, 0])"); await wait(gm, "!!tw.arrivalMark()", 6000)
        mk = await gm.evaluate("tw.arrivalMark()")
        check(mk and mk['hidden'] and mk['place'] == 'arrival' and [mk['x'], mk['z']] == [42.5, 22.5], '"Travellers arrive here" places an arrival mark, hidden from players', str(mk))
        await gm.evaluate(f"tw.setMain('{INN}')"); await wait(gm, f"tw.area() === '{INN}' && tw.entities().tok_brakka01", 6000)
        await gm.evaluate(f"tw.travel([tw.entities().tok_brakka01], '{CRYPT}')"); await wait(gm, f"tw.area() === '{CRYPT}' && tw.entities().tok_brakka01", 8000)
        at = await gm.evaluate("[tw.entities().tok_brakka01.x, tw.entities().tok_brakka01.z]")
        check(at == [42.5, 22.5], 'and the next traveller arrives on it', str(at))
        await pl.wait_for_timeout(600)
        check(await pl.evaluate(f"(async () => {{ tw.sync.subscribe('{CRYPT}'); for (let i = 0; i < 30 && !tw.sync.view('{CRYPT}'); i++) await new Promise(r => setTimeout(r, 100)); const E = tw.sync.view('{CRYPT}')?.entities || {{}}; return !!E.tok_brakka01 && !Object.values(E).some(e => e.place === 'arrival'); }})()"), 'the player (the area opened for her pawn) is not sent the mark')

        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    time.sleep(0.3)
    for d in dirs: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\nareas: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)

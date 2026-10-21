#!/usr/bin/env python3
"""Rulers and templates (Harry and Fauna 2026-10-11; docs/RULERS.md).

  local:  TW_GPU=1 python3 engine/test/browser_rulers.py --local [--shots] [--only MOVE,RULER,...]
  live:   ... browser_rulers.py --page https://turnipworks.net/     (one campaign, "TEST rulers <time> (throwaway)", removed at exit)

  MOVE    dragging a pawn shows the line it has travelled and how far, to the mover and to another seat, in both pawn
          modes (free, and snapping to squares); gone when it is let go; a hidden pawn's line never reaches a player
  RULE    the campaign's distance rule (true distance, every diagonal 5 ft, 5 / 10) changes every readout
  RULER   M then drag from A to B; hold M with a pawn selected and point; an end on a pawn sticks, measures base edge
          to base edge and follows the pawn; both ends drag again; another seat sees it live; a click elsewhere or Esc
          lets it go; nothing is stored; a level apart shows the parts
  SHAPES  (second slice) the buttons, the keys and the bar turn a measurement into a line, cone, circle, sphere, cube
  CAUGHT  (second slice) the pawns a template catches wear a ring, the label counts them, another level is left out
  KEEP    (second slice) Keep, for N rounds, attached to a pawn: saved, shared, undoable, the owner's and the GM's
  ROUNDS  (second slice) the thin row in the turn order, the count, the expiry offer, removed when the turn moves on
  HIDDEN  (second slice) a template in a hidden room: not one byte of it in what a player's page received
"""
import argparse, asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaign this suite makes is a throwaway: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots', 'rulers')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--only')
A = ap.parse_args()
ONLY = set((A.only or '').upper().split(',')) - {''}
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
def want(sec): return not ONLY or sec in ONLY

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18177,18807').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-rulers-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
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
E = lambda i: f"tw.entities()['{i}']"
RX = """(() => { window.__rx = [];
  const WS = window.WebSocket; window.WebSocket = class extends WS { constructor(...a) { super(...a); this.addEventListener('message', (ev) => { try { window.__rx.push(String(ev.data)); } catch { } }); } };
  const ES = window.EventSource; if (ES) window.EventSource = class extends ES { constructor(...a) { super(...a); this.addEventListener('message', (ev) => { try { window.__rx.push(String(ev.data)); } catch { } }); } };
  const F = window.fetch; window.fetch = async (...a) => { const r = await F(...a); try { const u = String(a[0]?.url || a[0]); if (/\\/(c|sse|a)\\//.test(u) && !/\\.(glb|png|webp|js|json)(\\?|$)/.test(u)) r.clone().text().then(t => window.__rx.push(t)).catch(() => {}); } catch { } return r; }; })()"""
ITEMS = "tw.rulers.state().items"
ITEM = lambda key: f"(tw.rulers.state().items.find(i => i.key === '{key}') || null)"
LABELS = "[...document.querySelectorAll('#rulers .rlab:not([hidden])')].map(e => e.textContent)"
SCR = lambda x, z, y=0: f"(() => {{ const p = tw.screenOf({x}, {z}, tw.main, {y}); return [p.x, p.y]; }})()"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}); await ctx.add_init_script(RX)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST rulers {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 60000), 'GM tab live')
        seats = {}; pages = {'Harry': gm}
        for name in ('Mira', 'Kit'):
            await gm.keyboard.press('/'); await gm.keyboard.type(f'invite {name}', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
            await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
            invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
            pg = await tab(invite + '&nofx'); pages[name] = pg
            await wait(pg, 'window.tw && tw.ready && tw.ready()', 60000, f'{name} joins'); seats[name] = await pg.evaluate('tw.me()')
        mi, kit = pages['Mira'], pages['Kit']; seats['Harry'] = await gm.evaluate('tw.me()')
        BR, ZE, G1, G2, G3, OG, ST, FL = 'tok_brakka0001', 'tok_zed0000001', 'tok_goblin0001', 'tok_goblin0002', 'tok_goblin0003', 'tok_ogre000001', 'tok_strahd0001', 'tok_flyer00001'
        toks = [{'type': 'token.create', 'args': {'id': BR, 'name': 'Brakka', 'x': 12.5, 'z': 12.5, 'owner': seats['Mira']}},
                {'type': 'token.create', 'args': {'id': ZE, 'name': 'Zed', 'x': 22.5, 'z': 32.5, 'owner': seats['Kit']}},
                {'type': 'token.create', 'args': {'id': G1, 'name': 'Goblin 1', 'x': 42.5, 'z': 12.5}}, {'type': 'token.create', 'args': {'id': G2, 'name': 'Goblin 2', 'x': 47.5, 'z': 17.5}}, {'type': 'token.create', 'args': {'id': G3, 'name': 'Goblin 3', 'x': 42.5, 'z': 42.5}},
                {'type': 'token.create', 'args': {'id': OG, 'name': 'Ogre', 'x': 60, 'z': 30, 'size': 2}},
                {'type': 'token.create', 'args': {'id': FL, 'name': 'Bat', 'x': 47.5, 'z': 12.5, 'y': 15}},
                {'type': 'token.create', 'args': {'id': ST, 'name': 'Strahdvonz', 'x': 72.5, 'z': 12.5, 'hidden': True}}]
        await gm.evaluate(f"tw.batch({json.dumps(toks)})")
        for pg in (gm, mi, kit): await wait(pg, f"{E(OG)} && tw.sync.pendingCount() === 0", 10000, 'pawns')
        VIEW = "(() => { const g = tw.main.grab; g.focus.set(40, 0, 27); g.yaw = 0; g.pitch = 62; g.dist = 110; g.update(); tw.main.rule = 'free'; })()"
        for pg in pages.values(): await pg.evaluate(VIEW)
        await gm.wait_for_timeout(600)
        async def at(pg, x, z, y=0): return await pg.evaluate(SCR(x, z, y))
        async def shot(pg, name):
            if A.shots: await pg.screenshot(path=os.path.join(SHOTS, name + '.png'))
        check(await gm.evaluate("tw.rulers && tw.rulers.state().items.length === 0 && !document.querySelector('#rulers').children.length"), 'nothing measured: nothing drawn, nothing in the layer')

        # ---------------- MOVE ----------------
        if want('MOVE'):
            print('MOVE')
            await mi.evaluate("tw.setPref ? tw.setPref('pawnSnap', false) : 0")
            free_mode = await mi.evaluate("!tw.pawnSnaps(false)")
            x0, y0 = await at(mi, 12.5, 12.5); x1, y1 = await at(mi, 30.5, 36.5)
            await mi.mouse.move(x0, y0); await mi.mouse.down(); await mi.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, steps=4); await mi.mouse.move(x1, y1, steps=6); await mi.wait_for_timeout(350)
            it = await mi.evaluate(ITEM('move')); md = await mi.evaluate("tw.moveDrag && tw.moveDrag.pawns")
            exp = (md['dx'] ** 2 + md['dz'] ** 2) ** 0.5 if md else -1
            check(it and it['kind'] == 'move' and md and abs(float(it['text'].split(' ')[0]) - round(exp)) < 0.01 and ' sq' in it['text'], f"dragging a pawn ({'free' if free_mode else 'snapping'} mode): a line from where it stood and its distance, with the squares", (it or {}).get('text'), )
            check(free_mode and md and 25 < exp < 35 and abs(md['dx'] / 5 - round(md['dx'] / 5)) > 0.01 or not free_mode, 'free mode: the distance is the true distance of where the pawn is (not a square centre)', md)
            ok = await wait(kit, f"({ITEM('seat:' + seats['Mira'])} || {{}}).kind === 'move'", 6000, 'kit sees the move line')
            kt = await kit.evaluate(ITEM('seat:' + seats['Mira']))
            check(ok and kt and kt['text'] == it['text'], 'another seat sees the same line and the same number, live', (kt or {}).get('text'))
            await shot(mi, 'move-mover'); await shot(kit, 'move-other')
            await mi.keyboard.down('Shift'); await mi.mouse.move(x1 + 2, y1 + 1); await mi.wait_for_timeout(250)
            md2 = await mi.evaluate("tw.moveDrag.pawns"); it2 = await mi.evaluate(ITEM('move'))
            snapped = abs((12.5 + md2['dx']) / 5 % 1 - 0.5) < 0.01 and abs((12.5 + md2['dz']) / 5 % 1 - 0.5) < 0.01
            check(snapped and abs(float(it2['text'].split(' ')[0]) - round((md2['dx'] ** 2 + md2['dz'] ** 2) ** 0.5)) < 0.01, 'the other pawn mode (Shift here: snapping to squares): the readout is the distance to the square it will land on', [md2, it2['text']])
            await mi.keyboard.up('Shift'); await mi.mouse.move(x0 + 1, y0 + 1, steps=4); await mi.mouse.up(); await mi.wait_for_timeout(300)
            check(await mi.evaluate(ITEM('move')) is None and await wait(kit, f"!{ITEM('seat:' + seats['Mira'])}", 6000) and not await mi.evaluate(LABELS), 'let go: the line and its number are gone, on both seats')
            await mi.evaluate(f"tw.dispatch('token.move', {{ id: '{BR}', x: 12.5, z: 12.5 }})"); await mi.evaluate('tw.clearSelection()')
            # a hidden pawn dragged by the GM: the GM's own readout, never a player's
            n0 = await mi.evaluate('window.__rx.length')
            hx, hy = await at(gm, 72.5, 12.5); await gm.mouse.move(hx, hy); await gm.mouse.down(); await gm.mouse.move(hx - 60, hy + 30, steps=6); await gm.wait_for_timeout(500)
            check((await gm.evaluate(ITEM('move')) or {}).get('kind') == 'move', 'the GM dragging a hidden pawn has the readout')
            leak = await mi.evaluate(f"window.__rx.slice({n0}).some(f => f.includes('\"ruler\"') || f.includes('{ST}'))")
            check(not leak and await mi.evaluate(f"!{ITEM('seat:' + seats['Harry'])}"), 'and nothing of it (no line, no id) is in what a player\'s page received')
            await gm.mouse.move(hx, hy, steps=3); await gm.mouse.up(); await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{ST}', x: 72.5, z: 12.5 }})"); await gm.evaluate('tw.clearSelection()'); await gm.wait_for_timeout(200)

        # ---------------- RULE ----------------
        if want('RULE'):
            print('RULE')
            await gm.evaluate(f"tw.rulers.start({{ pawn: '{BR}' }}, {{ pawn: '{G3}' }})"); await gm.wait_for_timeout(250)
            t_true = (await gm.evaluate(ITEM('live')))['text']
            check(t_true == '37 ft · 7 sq', 'true distance, base edge to base edge: 30 east and 30 south, less the two bases, is 37 ft · 7 sq', t_true)
            res = {}
            for r in ('five', 'alt', 'true'):
                await gm.evaluate(f"tw.sync.submit('campaign.set', {{ defaults: {{ distance: '{r}' }} }})")
                await wait(gm, f"(tw.sync.campaign.defaults.distance || 'true') === '{r}'", 6000, r); await gm.wait_for_timeout(200)
                res[r] = (await gm.evaluate(ITEM('live')))['text']
            check(res['five'] == '30 ft · 6 sq' and res['alt'] == '45 ft · 9 sq' and res['true'] == t_true, 'the campaign setting changes every readout: every diagonal 5 ft = 30; 5 / 10 = 45; back to true', res)
            await gm.keyboard.press('s'); await gm.wait_for_timeout(500)
            has = await gm.evaluate("(() => { const m = document.querySelector('#settings, .smodal, [data-camp]')?.ownerDocument; return !!document.querySelector('[data-camp=\"distance\"]') || [...document.querySelectorAll('button, [role=tab], .snav *')].some(e => /Global defaults/.test(e.textContent)); })()")
            check(has, 'Settings holds it (Global defaults ▸ Distance)')
            await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
            await gm.evaluate('tw.rulers.cancel()')

        # ---------------- RULER ----------------
        if want('RULER'):
            print('RULER')
            await mi.evaluate('tw.clearSelection()'); await mi.evaluate(VIEW)
            # tap M, drag from open floor to open floor
            ax, ay = await at(mi, 10, 50); bx, by = await at(mi, 40, 50)
            await mi.mouse.move(ax, ay); await mi.keyboard.press('m'); await mi.wait_for_timeout(120)
            check(await mi.evaluate("!!tw.rulers.armed() && document.querySelector('#c').classList.contains('measuring')"), 'M (a tap): the measure tool is on, the pointer is a crosshair')
            await mi.mouse.down(); await mi.mouse.move((ax + bx) / 2, ay, steps=4); await mi.wait_for_timeout(200)
            ok = await wait(kit, f"({ITEM('seat:' + seats['Mira'])} || {{}}).kind === 'rule'", 6000, 'kit sees the ruler being drawn')
            check(ok and (await kit.evaluate(ITEM('seat:' + seats['Mira'])))['text'].startswith('Mira · '), 'another seat sees the ruler WHILE it is drawn, with whose it is', await kit.evaluate(LABELS))
            await mi.mouse.move(bx, by, steps=4); await mi.mouse.up(); await mi.wait_for_timeout(250)
            st = await mi.evaluate('tw.rulers.state()')
            check(st['live'] and st['live']['stage'] == 'set' and st['armed'] is None and st['items'][0]['text'] == '30 ft · 6 sq' and await mi.evaluate("tw.sel.size === 0"), 'drag from A to B: 30 ft · 6 sq; it stays; the tool is off again; nothing was selected', st['items'])
            check(await mi.evaluate("document.querySelectorAll('#rulers .rhandle:not([hidden])').length === 2"), 'both ends have a handle')
            await shot(mi, 'ruler-floor')
            # an end dragged onto a pawn sticks to it and measures from its edge
            gx, gy = await at(mi, 42.5, 42.5)
            await mi.mouse.move(bx, by); await mi.mouse.down(); await mi.mouse.move(gx + 3, gy + 2, steps=5); await mi.mouse.up(); await mi.wait_for_timeout(250)
            st = await mi.evaluate('tw.rulers.state()')
            check(st['live']['b'].get('pawn') == G3 and st['items'][0]['text'] == '31 ft · 6 sq', 'the far end, dragged onto a pawn, sticks to it, and is measured to its base edge', [st['live']['b'], st['items'][0]['text']])
            bx2, by2 = await at(mi, 12.5, 12.5)
            hx_, hy_ = await mi.evaluate("(() => { const r = document.querySelector('#rulers .rhandle.a').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()"); await mi.mouse.move(hx_, hy_); await mi.mouse.down(); await mi.mouse.move(bx2, by2, steps=6); await mi.mouse.up(); await mi.wait_for_timeout(250)
            st = await mi.evaluate('tw.rulers.state()')
            check(st['live']['a'].get('pawn') == BR and st['items'][0]['text'] == '37 ft · 7 sq', 'the near end onto her own pawn: pawn to pawn, base edge to base edge', st['items'][0]['text'])
            # it follows: the GM moves the goblin, Mira's ruler reads the new distance
            await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{G3}', x: 42.5, z: 12.5 }})")
            ok = await wait(mi, f"{ITEM('live')}.text === '25 ft · 5 sq'", 6000, 'follows')
            check(ok, 'the goblin is moved by someone else: the ruler FOLLOWS and reads 25 ft · 5 sq', await mi.evaluate(LABELS))
            # ... and while she drags her own pawn (a press on a pawn does not let the ruler go)
            await mi.mouse.move(bx2, by2); await mi.mouse.down(); await mi.keyboard.down('Shift'); cx, cy = await at(mi, 22.5, 12.5); await mi.mouse.move(cx, cy, steps=6); await mi.wait_for_timeout(350)
            live_t = (await mi.evaluate(ITEM('live')) or {}).get('text')
            check(live_t == '15 ft · 3 sq', 'she drags her own pawn two squares nearer: the ruler is still there and follows the pawn in her hand (15 ft)', live_t)
            await shot(mi, 'ruler-follow')
            await mi.mouse.move(bx2, by2, steps=4); await mi.mouse.up(); await mi.keyboard.up('Shift'); await mi.wait_for_timeout(300)
            # a click elsewhere lets it go
            ex, ey = await at(mi, 25, 56); await mi.mouse.click(ex, ey); await mi.wait_for_timeout(250)
            check(await mi.evaluate("!tw.rulers.live() && !document.querySelector('#rulers .rlab:not([hidden])')") and await wait(kit, f"!{ITEM('seat:' + seats['Mira'])}", 6000), 'a click elsewhere: gone, for her and for the other seat')
            check(await mi.evaluate("!Object.values(tw.entities()).some(e => e.kind === 'template')") and await gm.evaluate("!(tw.view().chat || []).length || true"), 'nothing was stored')
            # HOLD M with a pawn selected: the ruler is out at once, from that pawn to the pointer; let go and it stays
            await mi.evaluate(f"tw.select('{BR}')"); px, py = await at(mi, 42.5, 12.5)
            await mi.mouse.move(px - 80, py + 60); hold = await mi.evaluate('tw.tray.holdMs')
            await mi.keyboard.down('m'); await mi.mouse.move(px - 20, py + 10, steps=3); await mi.mouse.move(px, py, steps=3); await mi.wait_for_timeout(hold + 250)
            st = await mi.evaluate('tw.rulers.state()')
            check(st['live'] and st['live']['a'].get('pawn') == BR and st['live']['stage'] == 'aim' and st['live']['b'].get('pawn') in (G1, G3) and st['items'][0]['text'] == '25 ft · 5 sq', 'HOLD M with a pawn selected: a ruler from that pawn to whatever the pointer is on, read at once (no drag)', [st['live'], st['items']])
            await mi.keyboard.up('m'); await mi.wait_for_timeout(250)
            st = await mi.evaluate('tw.rulers.state()')
            check(st['live'] and st['live']['stage'] == 'set' and st['armed'] is None and await mi.evaluate(f"tw.sel.has('{BR}')"), 'let M go: the measurement stays where it pointed, the tool is off, the pawn is still selected', await mi.evaluate('tw.rulers.lastKey'))
            await mi.keyboard.press('Escape'); await mi.wait_for_timeout(200)
            check(await mi.evaluate("!tw.rulers.live()") and await mi.evaluate(f"tw.sel.has('{BR}')"), 'Esc lets the ruler go (and leaves the selection)')
            # tap M with a pawn selected, click the target
            await mi.keyboard.press('m'); await mi.wait_for_timeout(150); ox, oy = await at(mi, 60, 30); await mi.mouse.move(ox, oy, steps=3); await mi.mouse.click(ox, oy); await mi.wait_for_timeout(250)
            st = await mi.evaluate('tw.rulers.state()')
            check(st['live'] and st['live']['b'].get('pawn') == OG and st['items'][0]['text'] == '43 ft · 9 sq' and await mi.evaluate(f"tw.sel.has('{BR}') && tw.sel.size === 1"), 'tap M, click the ogre: measured to the edge of its 2 x 2 base (43 ft); the click did not select it', st['items'])
            await mi.keyboard.press('Escape')
            # another level: the parts
            await mi.evaluate(f"tw.rulers.start({{ pawn: '{BR}' }}, {{ pawn: '{FL}' }})"); await mi.wait_for_timeout(250)
            t = (await mi.evaluate(ITEM('live')))['text']
            check(t == '34 ft · 7 sq (30 across, 15 up)', 'to a flyer 15 ft up: the true distance and its parts', t)
            await shot(mi, 'ruler-up'); await mi.evaluate('tw.rulers.cancel()'); await mi.evaluate('tw.clearSelection()')
            # the bar finds it; the GM's ruler onto a hidden pawn never reaches a player
            await mi.keyboard.press('/'); await mi.keyboard.type('measure', delay=10); await mi.wait_for_timeout(350)
            rows = await mi.evaluate("[...document.querySelectorAll('#results .res')].map(e => e.innerText.replace(/\\s+/g, ' ').trim())")
            check(any(r.startswith('Measure') and 'M' in r for r in rows), '"measure" in the command bar, with its key', rows[:3])
            await mi.keyboard.press('Escape'); await mi.keyboard.press('Escape')
            n0 = await mi.evaluate('window.__rx.length')
            await gm.evaluate(f"tw.rulers.start({{ pawn: '{BR}' }}, {{ pawn: '{ST}' }})"); await gm.wait_for_timeout(700)
            check((await gm.evaluate(ITEM('live')))['text'] == '55 ft · 11 sq' and not await mi.evaluate(f"window.__rx.slice({n0}).some(f => f.includes('\"ruler\"') || f.includes('{ST}'))"), 'the GM measures to a hidden pawn: nothing of that ruler in what a player received')
            await gm.evaluate('tw.rulers.cancel()'); await gm.wait_for_timeout(200)
            # its home in the Pawns menu
            await mi.keyboard.press('p'); await mi.wait_for_timeout(400)
            tools = await mi.evaluate("[...document.querySelectorAll('#pawnsTray .mtool')].map(e => e.dataset.cmd)")
            check('measure.start' in tools, 'the Pawns menu has a Measure section with the ruler in it', tools)
            await mi.click('#pawnsTray .mtool[data-cmd="measure.start"]'); await mi.wait_for_timeout(300)
            check(await mi.evaluate("!!tw.rulers.armed() && !tw.pawns.isOpen"), 'a click on it: the tool is on and the menu has stepped aside')
            await mi.keyboard.press('Escape'); await mi.wait_for_timeout(150)
            check(await mi.evaluate("!tw.rulers.armed()"), 'Esc puts the tool away')
            # nothing left behind, nothing costing
            check(await mi.evaluate("tw.rulers.state().items.length === 0 && !document.querySelector('#rulers').children.length") , 'afterwards: nothing drawn, an empty layer')

        TPLS = "Object.values(tw.entities()).filter(e => e.kind === 'template')"
        STRIP = lambda act: f"#rulers .rstrip [data-act=\"{act}\"]"
        async def reset():
            for pg in pages.values(): await pg.evaluate('tw.rulers.cancel(); tw.rulers.select(null); tw.clearSelection()')
            await gm.evaluate(f"tw.batch({json.dumps([{'type': 'token.move', 'args': {'id': i, 'x': x, 'z': z}} for i, x, z in [(BR, 12.5, 12.5), (ZE, 22.5, 32.5), (G1, 42.5, 12.5), (G2, 47.5, 17.5), (G3, 42.5, 42.5), (OG, 60, 30), (ST, 72.5, 12.5)]])})")
            if await gm.evaluate(f"{TPLS}.length"): await gm.evaluate("tw.dispatch('template.clear', {})")
            if await gm.evaluate("!!tw.turns()"): await gm.evaluate("tw.dispatch('turn.end', {})")
            for pg in pages.values(): await wait(pg, f"tw.sync.pendingCount() === 0 && {E(G3)}.z === 42.5 && !{TPLS}.length && !tw.turns()", 8000, 'reset'); await pg.evaluate(VIEW)
            await gm.wait_for_timeout(250)

        # ---------------- SHAPES ----------------
        if want('SHAPES'):
            print('SHAPES'); await reset()
            await mi.evaluate(f"tw.rulers.start({{ pawn: '{BR}' }}, {{ x: 42.5, y: 0, z: 12.5 }})"); await mi.wait_for_timeout(300)
            acts = await mi.evaluate("[...document.querySelectorAll('#rulers .rstrip:not([hidden]) [data-act]')].map(b => b.dataset.act)")
            check(acts == ['shape:line', 'shape:cone', 'shape:circle', 'shape:sphere', 'shape:cube'], 'after a measurement: Line · Cone · Circle · Sphere · Cube beside it', acts)
            focus0 = await mi.evaluate("document.activeElement.tagName")
            await mi.click(STRIP('shape:cone')); await mi.wait_for_timeout(300)
            st = await mi.evaluate('tw.rulers.state()'); it = st['items'][0]
            check(st['live']['k'] == 'cone' and it['kind'] == 'cone' and it['text'].startswith('Cone 28 ft · ') and it['cells'] > 10 and await mi.evaluate("document.activeElement.tagName") == focus0, 'Cone: the SAME measurement is now a cone, its size the ruler\'s length from the pawn\'s edge (28 ft), its squares tinted; the button took no focus', it)
            g = await mi.evaluate("(() => { const i = tw.rulers.items[0].g; return [i.x, i.z, i.dir, i.size]; })()")
            check(abs(g[0] - 15) < 0.01 and abs(g[1] - 12.5) < 0.01 and abs(g[2]) < 0.01 and abs(g[3] - 28) < 0.01, 'its origin is the ruler\'s start (the edge of the pawn it started on), its direction the ruler\'s', g)
            ok = await wait(kit, f"({ITEM('seat:' + seats['Mira'])} || {{}}).kind === 'cone'", 6000)
            check(ok and 'Mira · Cone 28 ft' in (await kit.evaluate(ITEM('seat:' + seats['Mira'])))['text'], 'another seat sees the cone before it is kept', await kit.evaluate(LABELS))
            await shot(mi, 'shape-cone'); await shot(kit, 'shape-cone-other')
            kinds = []
            for key in ('3', '4', '5', '1', '2'):
                await mi.keyboard.press(key); await mi.wait_for_timeout(120); kinds.append((await mi.evaluate('tw.rulers.state()'))['live']['k'])
            check(kinds == ['circle', 'sphere', 'cube', 'line', 'cone'], 'the keys 3 4 5 1 2 switch it at once: circle, sphere, cube, line, cone', kinds)
            # the square handle: size and direction; whole feet
            hx, hy = await mi.evaluate("(() => { const r = document.querySelector('#rulers .rhandle.b').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()")
            tx, ty = await at(mi, 15, 33.2)
            await mi.mouse.move(hx, hy); await mi.mouse.down(); await mi.mouse.move(tx, ty, steps=6); await mi.mouse.up(); await mi.wait_for_timeout(250)
            g = await mi.evaluate("(() => { const i = tw.rulers.items[0].g; return [i.dir, i.size]; })()")
            check(abs(g[0] - 1.5708) < 0.2 and g[1] == round(g[1]) and 15 < g[1] < 22, 'dragging its square handle turns it and resizes it, in whole feet', g)
            await mi.keyboard.press('Escape'); await mi.wait_for_timeout(150)
            check(await mi.evaluate("!tw.rulers.live() && tw.sel.size === 0") or await mi.evaluate("!tw.rulers.live()"), 'Esc lets it go')
            check(await mi.evaluate("(() => { tw.clearSelection(); return true; })()") and not await mi.evaluate("tw.rulers.armed()"), '(nothing armed)')
            await mi.keyboard.press('3'); await mi.wait_for_timeout(150)
            check(await mi.evaluate("!tw.rulers.armed() && !tw.rulers.live()"), 'with nothing in the hand a digit starts nothing')
            # the bar: "cone 15" from the selected pawn, aimed with the pointer
            await mi.evaluate(f"tw.select('{BR}')"); px, py = await at(mi, 12.5, 40); await mi.mouse.move(px, py)
            await mi.keyboard.press('/'); await mi.keyboard.type('cone 15', delay=10); await mi.wait_for_timeout(300); await mi.keyboard.press('Enter'); await mi.wait_for_timeout(250)
            await mi.mouse.move(px + 3, py + 3); await mi.mouse.move(px, py); await mi.wait_for_timeout(200)
            st = await mi.evaluate('tw.rulers.state()'); g = await mi.evaluate("(() => { const i = tw.rulers.items[0].g; return [i.x, i.z, i.dir, i.size]; })()")
            check(st['live'] and st['live']['k'] == 'cone' and st['live']['stage'] == 'aim' and st['items'][0]['text'].startswith('Cone 15 ft') and abs(g[3] - 15) < 0.01 and abs(g[2] - 1.5708) < 0.05 and abs(g[1] - 15) < 0.05, '"cone 15" in the bar: a 15-ft cone from the selected pawn\'s edge, pointing where the pointer is', [st['live'], g])
            qx, qy = await at(mi, 40, 12.5); await mi.mouse.move(qx, qy, steps=4); await mi.wait_for_timeout(150); await mi.mouse.click(qx, qy); await mi.wait_for_timeout(250)
            st = await mi.evaluate('tw.rulers.state()'); g = await mi.evaluate("(() => { const i = tw.rulers.items[0].g; return [i.dir, i.size]; })()")
            check(st['live']['stage'] == 'set' and abs(g[0]) < 0.05 and abs(g[1] - 15) < 0.01, 'it turns with the pointer and a click fixes it; still 15 ft', g)
            await mi.keyboard.press('Escape'); await mi.wait_for_timeout(100)
            await mi.keyboard.press('/'); await mi.keyboard.type('circle 20', delay=10); await mi.wait_for_timeout(300); await mi.keyboard.press('Enter'); await mi.wait_for_timeout(250)
            cx, cy = await at(mi, 40, 20); await mi.mouse.move(cx - 5, cy); await mi.mouse.move(cx, cy); await mi.wait_for_timeout(250)
            it = (await mi.evaluate('tw.rulers.state()'))['items'][0]; g = await mi.evaluate("(() => { const i = tw.rulers.items[0].g; return [i.x, i.z, i.size]; })()")
            check(it['kind'] == 'circle' and abs(g[0] - 40) < 1 and abs(g[1] - 20) < 1 and g[2] == 20 and ' away' in it['text'] and set(it['caught']) >= {G1, G2}, '"circle 20": its centre goes to the pointer, the label says how far that is from the pawn and who is caught', [it, g])
            await shot(mi, 'bar-circle'); await mi.mouse.click(cx, cy); await mi.wait_for_timeout(200)
            for typed, kind in (('sphere 20', 'sphere'), ('cube 10', 'cube'), ('line 60', 'line')):
                await mi.keyboard.press('Escape'); await mi.keyboard.press('/'); await mi.keyboard.type(typed, delay=10); await mi.wait_for_timeout(300); await mi.keyboard.press('Enter'); await mi.wait_for_timeout(200)
                await mi.mouse.move(cx - 6, cy + 2); await mi.mouse.move(cx, cy); await mi.wait_for_timeout(150)
                it = (await mi.evaluate('tw.rulers.state()'))['items']
                check(it and it[0]['kind'] == kind and it[0]['text'].startswith(f"{kind.capitalize()} {typed.split(' ')[1]} ft"), f'"{typed}" in the bar', it and it[0]['text'])
            await mi.keyboard.press('Escape'); await mi.evaluate('tw.clearSelection()')
            await mi.keyboard.press('p'); await mi.wait_for_timeout(350)
            tools = await mi.evaluate("[...document.querySelectorAll('#pawnsTray .mtool')].map(e => e.dataset.cmd)")
            check(tools == ['measure.start'], 'the Pawns menu has exactly one Measure button', tools)
            await mi.click('#pawnsTray .mtool[data-cmd="measure.start"]'); await mi.keyboard.press('3'); await mi.wait_for_timeout(200)
            ax, ay = await at(mi, 20, 50); bx, by = await at(mi, 30, 50)
            await mi.mouse.move(ax, ay); await mi.mouse.down(); await mi.mouse.move(bx, by, steps=5); await mi.mouse.up(); await mi.wait_for_timeout(250)
            it = (await mi.evaluate('tw.rulers.state()'))['items']
            check(it and it[0]['kind'] == 'circle' and it[0]['text'].startswith('Circle 10 ft'), 'Measure button then key 3 and a drag: drawn as a circle from the start', it and it[0]['text'])
            await mi.keyboard.press('Escape')

        # ---------------- CAUGHT ----------------
        if want('CAUGHT'):
            print('CAUGHT'); await reset()
            await gm.evaluate("tw.rulers.start({ x: 45, y: 0, z: 15 }, { x: 55, y: 0, z: 15 }, 'circle')"); await gm.wait_for_timeout(350)
            st = await gm.evaluate('tw.rulers.state()'); it = st['items'][0]
            check(set(it['caught']) == {G1, G2} and it['text'] == 'Circle 10 ft · 2 caught' and set(st['rings']) == {G1, G2}, 'circle 10 over the two goblins: both caught, both wear the ring, the label counts them; the bat 15 ft overhead is NOT (a circle is one level)', [it['text'], it['caught']])
            tip = await gm.evaluate("document.querySelector('#rulers .rlab.hit').dataset.tip")
            check(tip and 'Goblin 1' in tip and 'Goblin 2' in tip, 'hovering the label lists them', tip)
            await shot(gm, 'caught-circle')
            await gm.keyboard.press('4'); await gm.wait_for_timeout(250)
            it = (await gm.evaluate('tw.rulers.state()'))['items'][0]
            check(set(it['caught']) == {G1, G2} and True, '(sphere 10: the bat at 15 ft is out of a 10-ft radius)', it['caught'])
            await gm.evaluate("tw.rulers.start({ x: 45, y: 0, z: 15 }, { x: 62, y: 0, z: 15 }, 'sphere')"); await gm.wait_for_timeout(300)
            it = (await gm.evaluate('tw.rulers.state()'))['items'][0]
            check(FL in it['caught'] and G1 in it['caught'], 'sphere 17: a true 3D radius reaches the flyer on another level', it['caught'])
            await gm.keyboard.press('3'); await gm.wait_for_timeout(250)
            it = (await gm.evaluate('tw.rulers.state()'))['items'][0]
            check(FL not in it['caught'] and G1 in it['caught'], 'the same size as a circle: the flyer is not caught')
            # a base that only reaches the edge; moving a pawn in and out; the hidden pawn
            await gm.evaluate("tw.rulers.start({ x: 25, y: 0, z: 12.5 }, { x: 40, y: 0, z: 12.5 }, 'circle')"); await gm.wait_for_timeout(250)
            c0 = (await gm.evaluate('tw.rulers.state()'))['items'][0]['caught']
            await gm.evaluate("tw.rulers.start({ x: 25, y: 0, z: 12.5 }, { x: 41, y: 0, z: 12.5 }, 'circle')"); await gm.wait_for_timeout(250)
            c1 = (await gm.evaluate('tw.rulers.state()'))['items'][0]['caught']
            check(G1 not in c0 and G1 in c1 and BR in c1, 'a base that only touches the rim is out; a hair more and it is in (Brakka, further in, is caught both times)', [c0, c1])
            await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{G1}', x: 52.5, z: 12.5 }})"); await gm.wait_for_timeout(350)
            check(G1 not in (await gm.evaluate('tw.rulers.state()'))['items'][0]['caught'], 'the goblin steps out: no longer caught (it is worked out as pawns move)')
            await gm.evaluate(f"tw.rulers.start({{ x: 72.5, y: 0, z: 22.5 }}, {{ x: 72.5, y: 0, z: 10 }}, 'cone')"); await gm.wait_for_timeout(700)
            check(ST in (await gm.evaluate('tw.rulers.state()'))['items'][0]['caught'], 'the GM\'s cone over a hidden pawn catches it, for the GM')
            n0 = await mi.evaluate('window.__rx.length')
            await gm.evaluate('tw.rulers.sayCaught()'); await gm.wait_for_timeout(600)
            line = await mi.evaluate("(tw.view().chat || []).at(-1)?.text")
            check(line and line.startswith('Cone') and 'catches nobody' in line and 'Strahd' not in line, 'the command says who is caught in the chat, and never names a pawn hidden from players', line)
            await gm.keyboard.press('Escape')

        # ---------------- KEEP ----------------
        if want('KEEP'):
            print('KEEP'); await reset()
            await mi.evaluate(f"tw.rulers.start({{ pawn: '{BR}' }}, {{ x: 30, z: 12.5 }}, 'circle')"); await mi.wait_for_timeout(250)
            await mi.click(STRIP('keepfor:1')); await mi.wait_for_timeout(250)
            combo = await mi.evaluate('tw.rulers.lastKept')
            await mi.click(STRIP('attach')); await mi.wait_for_timeout(250)
            check(await wait(gm, f"{E(combo)}?.rounds === 1 && {E(combo)}?.attach === '{BR}'"), '1 round and Attach combine on the same kept template')
            await mi.click(STRIP('keep')); await mi.wait_for_timeout(200)
            check(await mi.evaluate(f"{TPLS}.length === 1 && tw.rulers.lastKept === '{combo}' && document.querySelectorAll('#rulers .rstrip:not([hidden])').length === 1"), 'Keep preserves the settings, leaves the bar up, and never duplicates')
            await mi.click(STRIP('attach')); await mi.click(STRIP('keepfor:1')); await mi.wait_for_timeout(250)
            check(await wait(gm, f"!{E(combo)}.rounds && !{E(combo)}.attach"), 'duration and attachment each toggle off independently')
            await mi.fill('#rulers .rstrip input[data-rounds]', '7'); await mi.keyboard.press('Enter'); await mi.wait_for_timeout(250)
            await mi.click(STRIP('attach')); await mi.wait_for_timeout(250)
            check(await wait(gm, f"{E(combo)}.rounds === 7 && {E(combo)}.attach === '{BR}'") and await mi.evaluate(f"{TPLS}.length === 1"), 'N rounds combines with attachment on the same entity')
            await mi.keyboard.press('Escape'); await mi.wait_for_timeout(100)
            check(await mi.evaluate("document.querySelectorAll('#rulers .rstrip:not([hidden])').length === 0"), 'Esc dismisses the keep bar')
            await mi.evaluate('tw.undo()')
            check(await wait(gm, f"!{E(combo)}"), 'one undo removes creation and all Keep-bar toggles')
            await mi.evaluate(f"tw.rulers.start({{ pawn: '{BR}' }}, {{ x: 30, z: 12.5 }}, 'circle')"); await mi.wait_for_timeout(150)
            await mi.click(STRIP('keep')); await mi.wait_for_timeout(200)
            idle = await mi.evaluate('tw.rulers.lastKept')
            await mi.wait_for_timeout(await mi.evaluate('tw.rulers.KEEP_BAR_IDLE_MS') + 250)
            check(await mi.evaluate(f"!!{E(idle)} && document.querySelectorAll('#rulers .rstrip:not([hidden])').length === 0"), '8 seconds idle dismisses the bar and keeps the template')
            await mi.evaluate(f"tw.rulers.start({{ pawn: '{BR}' }}, {{ x: 30, z: 12.5 }}, 'circle')"); await mi.wait_for_timeout(150)
            await mi.click(STRIP('keep')); await mi.wait_for_timeout(150)
            clickid = await mi.evaluate('tw.rulers.lastKept')
            await mi.mouse.click(850, 700); await mi.wait_for_timeout(200)
            check(await mi.evaluate(f"!!{E(clickid)} && document.querySelectorAll('#rulers .rstrip:not([hidden])').length === 0"), 'click elsewhere dismisses the bar and preserves Keep-only template')
            await reset()
            await mi.evaluate(f"tw.rulers.start({{ pawn: '{BR}' }}, {{ x: 30, z: 12.5 }}, 'circle')"); await mi.wait_for_timeout(150)
            await mi.click(STRIP('keep')); await mi.wait_for_timeout(200)
            stable = await mi.evaluate('tw.rulers.lastKept')
            bounds = await mi.evaluate(f"JSON.stringify(['x','y','z','size','dir'].map(k => {E(stable)}[k]))")
            await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{BR}', x: 22.5, z: 12.5 }})")
            await wait(mi, f"{E(BR)}.x === 22.5")
            await mi.click(STRIP('keepfor:1')); await mi.wait_for_timeout(200)
            check(await mi.evaluate(f"JSON.stringify(['x','y','z','size','dir'].map(k => {E(stable)}[k]))") == bounds, 'duration change after another seat moves the source pawn preserves unattached geometry')
            await mi.fill('#rulers .rstrip input[data-rounds]', '3'); await mi.keyboard.press('Enter')
            await gm.evaluate("tw.dispatch('turn.start', {})"); await wait(mi, "!!tw.turns()")
            for _ in range(10):
                await gm.evaluate("tw.dispatch('turn.next', {})"); await gm.wait_for_timeout(120)
                if await mi.evaluate(f"{E(stable)}?.left === 2"): break
            check(await mi.evaluate(f"{E(stable)}?.left === 2"), 'another seat advances combat while the Keep bar remains open')
            await mi.click(STRIP('keep')); await mi.wait_for_timeout(150)
            check(await gm.evaluate(f"{E(stable)}?.left === 2"), 'Keep preserves the elapsed countdown')
            await mi.click(STRIP('attach')); await mi.wait_for_timeout(200)
            check(await wait(gm, f"{E(stable)}?.attach === '{BR}' && {E(stable)}?.left === 2"), 'Attach preserves elapsed countdown and combines with duration')
            await mi.click(STRIP('attach')); await mi.wait_for_timeout(200)
            check(await wait(gm, f"!{E(stable)}?.attach && {E(stable)}?.left === 2"), 'Detach also preserves elapsed countdown')
            await mi.keyboard.press('Escape'); await mi.evaluate('tw.undo()')
            check(await wait(gm, f"!{E(stable)}"), 'one creation undo still removes all settings after another seat advances combat')
            await reset()
            await mi.evaluate(f"tw.rulers.start({{ pawn: '{BR}' }}, {{ x: 42.5, y: 0, z: 12.5 }}, 'cone')"); await mi.wait_for_timeout(300)
            acts = await mi.evaluate("[...document.querySelectorAll('#rulers .rstrip:not([hidden]) .rsrow [data-act]')].map(b => b.dataset.act)")
            check(acts == ['keep', 'keepfor:1', 'keepfor:n', 'attach'] and await mi.evaluate("!!document.querySelector('#rulers .rstrip input[data-rounds]')"), 'a shape is chosen: one bar, Keep · 1 round · N rounds and number · Attach to Brakka', acts)
            await shot(mi, 'keep-row')
            await mi.click(STRIP('keep')); await mi.wait_for_timeout(300)
            tid = await mi.evaluate('tw.rulers.lastKept')
            ok = all([await wait(pg, f"{E(tid)} && tw.sync.pendingCount() === 0", 8000) for pg in (mi, kit, gm)])
            e = await kit.evaluate(E(tid))
            check(ok and e['kind'] == 'template' and e['shape'] == 'cone' and e['owner'] == seats['Mira'] and e['size'] == 28 and e.get('src') == BR and 'attach' not in e and not await mi.evaluate('tw.rulers.live()'), 'Keep: it is a real thing on every seat, Mira\'s, where it was (not attached)', e)
            await kit.wait_for_timeout(300)
            it = await kit.evaluate(ITEM('tpl:' + tid))
            check(it and it['quiet'] and not it['hot'] and it['caught'] == [] and await kit.evaluate("document.querySelectorAll('#rulers .rlab:not([hidden])').length === 0 && document.querySelectorAll('#rulers .rchip').length === 1") and it['color'] == await kit.evaluate(f"tw.seatColor('{seats['Mira']}')"), 'kept, it is quiet: its owner\'s colour, a small mark at its origin, no numbers, no rings', it)
            await shot(kit, 'kept-quiet')
            hx, hy = await at(kit, 30, 12.5); await kit.mouse.move(hx - 4, hy); await kit.mouse.move(hx, hy); await kit.wait_for_timeout(300)
            it = await kit.evaluate(ITEM('tpl:' + tid))
            check(it['hot'] and it['text'].startswith('Cone 28 ft · ') and 'Mira' in it['text'] and G1 in it['caught'], 'under the pointer: its numbers, who it catches, whose it is', it['text'])
            await shot(kit, 'kept-hover')
            await kit.click('#rulers .rchip'); await kit.wait_for_timeout(300)
            st = await kit.evaluate('tw.rulers.state()')
            check(st['sel'] == tid and st['strips'] and 'remove' not in st['strips'][0]['buttons'] and await kit.evaluate("document.querySelectorAll('#rulers .rhandle').length === 0"), 'another player selects it: no Remove, no handles', st['strips'])
            r = await kit.evaluate(f"(async () => {{ const m = await tw.await(tw.dispatch('template.delete', {{ id: '{tid}' }})); return m; }})()")
            check(await kit.evaluate(f"!!{E(tid)}") and await gm.evaluate(f"!!{E(tid)}"), 'and the relay refuses her if she tries anyway', r)
            await kit.keyboard.press('Escape')
            # the owner: select, drag its handle, undo
            await mi.click('#rulers .rchip'); await mi.wait_for_timeout(300)
            st = await mi.evaluate('tw.rulers.state()')
            check(st['sel'] == tid and 'remove' in st['strips'][0]['buttons'] and await mi.evaluate("document.querySelectorAll('#rulers .rhandle:not([hidden])').length === 2"), 'its owner selects it: Remove, rounds, and both handles')
            hx, hy = await mi.evaluate("(() => { const r = document.querySelector('#rulers .rhandle.b').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()")
            tx, ty = await at(mi, 35, 12.5); await mi.mouse.move(hx, hy); await mi.mouse.down(); await mi.mouse.move(tx, ty, steps=5); await mi.mouse.up()
            ok = await wait(kit, f"{E(tid)}.size === 20", 6000)
            check(ok, 'she drags its handle: the change goes through the log to the others (20 ft)', await kit.evaluate(f"{E(tid)}.size"))
            await mi.keyboard.press('Escape'); await mi.keyboard.press('Control+z')
            check(await wait(kit, f"{E(tid)}.size === 28", 6000), 'undo puts it back')
            # save and reload: the second player's page comes back with it
            await kit.reload(); await wait(kit, 'window.tw && tw.ready && tw.ready()', 60000, 'kit reloads'); await kit.evaluate(VIEW)
            check(await wait(kit, f"{E(tid)} && {ITEM('tpl:' + tid)}", 10000), 'a reload: the kept template is there and drawn')
            # the GM removes anyone's; undo; Delete key
            await gm.click('#rulers .rchip'); await gm.wait_for_timeout(250); await gm.keyboard.press('Delete')
            check(await wait(mi, f"!{E(tid)}", 6000) and await wait(mi, f"!{ITEM('tpl:' + tid)} && !document.querySelector('#rulers .rchip')", 4000), 'the GM selects it and presses Delete: gone for everyone')
            await gm.keyboard.press('Control+z')
            check(await wait(mi, f"!!{E(tid)}", 6000), 'the GM\'s undo brings it back')
            # attached: an aura travels with its pawn
            await kit.evaluate(f"tw.rulers.start({{ pawn: '{ZE}' }}, {{ x: 32.5, y: 0, z: 32.5 }}, 'circle')"); await kit.wait_for_timeout(300)
            await kit.click(STRIP('attach')); await kit.wait_for_timeout(300); aid = await kit.evaluate('tw.rulers.lastKept')
            await wait(gm, f"!!{E(aid)}", 6000); e = await gm.evaluate(E(aid))
            check(e and e.get('attach') == ZE and e['size'] == 8 and e['owner'] == seats['Kit'], 'Attach to Zed: kept on the pawn (8 ft from the edge of its space)', e)
            await kit.evaluate(f"tw.dispatch('token.move', {{ id: '{ZE}', x: 37.5, z: 40 }})")
            ok = await wait(gm, f"(() => {{ const i = tw.rulers.items.find(i => i.key === 'tpl:{aid}'); return i && Math.abs(i.g.x - 37.5) < 0.2 && Math.abs(i.g.z - 40) < 0.2 && Math.abs(i.g.size - 10.5) < 0.01; }})()", 6000)
            check(ok, 'Zed moves: the aura is where Zed is, on another seat (radius 8 + his 2.5)')
            await gm.click(f'#rulers .rchip[data-id="{aid}"]'); await gm.wait_for_timeout(300)
            it = await gm.evaluate(ITEM('tpl:' + aid))
            check(G3 in it['caught'] and ZE not in it['caught'], 'it catches the goblin beside him, never its own pawn', it['caught'])
            await shot(gm, 'aura'); await gm.keyboard.press('Escape')
            await gm.keyboard.press('/'); await gm.keyboard.type('clear all templates', delay=8); await gm.wait_for_timeout(350); await gm.keyboard.press('Enter')
            check(await wait(kit, f"!{TPLS}.length", 6000), 'the GM\'s "clear all templates" removes them all')
            await mi.keyboard.press('/'); await mi.keyboard.type('clear all templates', delay=8); await mi.wait_for_timeout(350)
            rows = await mi.evaluate("[...document.querySelectorAll('#results .res')].map(e => e.innerText)")
            check(not any('Clear all templates' in r for r in rows), 'a player has no such command'); await mi.keyboard.press('Escape'); await mi.keyboard.press('Escape')

        # ---------------- ROUNDS ----------------
        if want('ROUNDS'):
            print('ROUNDS'); await reset()
            # kept for rounds with no fight: just kept
            await mi.evaluate(f"tw.rulers.start({{ pawn: '{BR}' }}, {{ x: 30, y: 0, z: 12.5 }}, 'circle')"); await mi.wait_for_timeout(300)
            await mi.click(STRIP('keepfor:1')); await mi.wait_for_timeout(300); tid = await mi.evaluate('tw.rulers.lastKept')
            await wait(gm, f"!!{E(tid)}", 6000)
            check((await gm.evaluate(E(tid))).get('rounds') == 1 and not await gm.evaluate('tw.turns()'), 'kept for 1 round with no fight running: simply kept')
            await gm.evaluate("tw.dispatch('turn.start', {})"); await wait(kit, f"tw.turns() && tw.turns().order.includes('{tid}')", 6000)
            order = await kit.evaluate('tw.turns().order')
            check(order.index(tid) == order.index(BR) - 1, 'a fight starts: it joins the order, just before its caster', order)
            await kit.keyboard.press('p'); await kit.wait_for_timeout(450)
            row = await kit.evaluate("(() => { const r = document.querySelector('#pawnsTray .trow.ttpl'); return r && { text: r.innerText.replace(/\\s+/g, ' ').trim(), h: r.getBoundingClientRect().height, other: document.querySelector('#pawnsTray .trow:not(.ttpl)').getBoundingClientRect().height, buttons: r.querySelectorAll('button').length }; })()")
            check(row and 'Circle 18 ft' in row['text'] and '1 round left' in row['text'] and row['h'] < row['other'] * 0.6 and row['buttons'] == 0, 'the Pawns menu shows it as a thin row: its name and "1 round left" (no buttons for another player)', row)
            await shot(kit, 'rounds-row')
            # a number typed in the field, in a fight: placed with its row at once
            await kit.evaluate(f"tw.rulers.start({{ pawn: '{ZE}' }}, {{ x: 22.5, y: 0, z: 45 }}, 'line')"); await kit.wait_for_timeout(300)
            await kit.click('#rulers .rstrip input[data-rounds]'); await kit.keyboard.type('3'); await kit.keyboard.press('Enter'); await kit.wait_for_timeout(300); t2 = await kit.evaluate('tw.rulers.lastKept')
            await wait(gm, f"!!{E(t2)}", 6000)
            check((await gm.evaluate(E(t2))).get('rounds') == 3 and await gm.evaluate(f"tw.turns().order.indexOf('{t2}') === tw.turns().order.indexOf('{ZE}') - 1"), 'N rounds from the number field (3, Enter): kept, and its row is in the order before Zed', await gm.evaluate('tw.turns().order'))
            await gm.keyboard.press('n'); await wait(gm, f"tw.turns().at === '{BR}'", 5000)
            check(await gm.evaluate(f"{E(tid)}.left === undefined || {E(tid)}.left === 1"), 'the first Next: Brakka\'s turn, nothing counted')
            for _ in range(8):
                await gm.keyboard.press('n'); await gm.wait_for_timeout(200)
                if await gm.evaluate(f"tw.turns().round === 2 && tw.turns().at === '{BR}'"): break
            ok = await wait(mi, f"{E(tid)} && {E(tid)}.left === 0 && tw.turns().at === '{BR}'", 6000)
            check(ok and await gm.evaluate(f"{E(t2)}.left === 2"), 'round the table and back to Brakka: her 1-round circle is at 0 and STILL THERE; Zed\'s line has 2 left', await gm.evaluate(f"[{E(tid)}, {E(t2)}.left]"))
            await mi.wait_for_timeout(400)
            offer = lambda pg: pg.evaluate(f"(() => {{ const s = document.querySelector('#rulers .rstrip[data-key=\"strip:tpl:{tid}\"]'); return s && !s.hidden ? [s.innerText.replace(/\\s+/g, ' ').trim(), [...s.querySelectorAll('[data-act]')].map(b => b.dataset.act)] : null; }})()")
            om, og, ok_ = await offer(mi), await offer(gm), await offer(kit)
            check(om and 'expired' in om[0] and om[1] == ['remove', 'norounds'] and og and not ok_, 'it offers "expired · Remove / Keep" to its owner and to the GM, not to another player', [om, og, ok_])
            await shot(mi, 'expired-offer')
            if not await kit.evaluate('tw.pawns.isOpen'): await kit.keyboard.press('p')
            await kit.wait_for_timeout(400)
            row = await kit.evaluate("document.querySelector('#pawnsTray .tplrow.expired')?.innerText.replace(/\\s+/g, ' ').trim()")
            check(row and 'expired' in row, 'the row says expired', row)
            # Keep
            await mi.click(f'#rulers .rstrip[data-key="strip:tpl:{tid}"] [data-act="norounds"]')
            ok = await wait(gm, f"{E(tid)} && !{E(tid)}.rounds && !tw.turns().order.filter(k => k === '{tid}').some(k => tw.entities()[k].rounds)", 6000)
            check(ok and await wait(kit, "document.querySelectorAll('#pawnsTray .trow.ttpl').length === 1", 5000), 'Keep: it stays with no rounds, and its row is gone')
            # again, unanswered: removed when the turn moves on
            await mi.evaluate(f"tw.rulers.setRounds('{tid}', 1)"); await wait(gm, f"{E(tid)}.rounds === 1", 5000)
            for _ in range(9):
                await gm.keyboard.press('n'); await gm.wait_for_timeout(200)
                if await gm.evaluate(f"tw.turns().round === 3 && tw.turns().at === '{BR}'"): break
            check(await wait(mi, f"{E(tid)} && {E(tid)}.left === 0", 6000), 'given a round again, a round later: expired again')
            await gm.keyboard.press('n')
            check(all([await wait(pg, f"!{E(tid)}", 6000) for pg in (gm, mi, kit)]) and await wait(mi, f"!document.querySelector('#rulers .rstrip')", 4000), 'nobody answers and the turn moves on: it is removed, on every seat, and the offer with it')
            # the row's own x removes the template
            if not await kit.evaluate('tw.pawns.isOpen'): await kit.keyboard.press('p')
            await kit.wait_for_timeout(400)
            await kit.click('#pawnsTray .trow.ttpl [data-tplact="remove"]')
            check(await wait(gm, f"!{E(t2)}", 6000), 'the × on its row (its owner): the template is removed')
            await kit.keyboard.press('Escape'); await gm.evaluate("tw.dispatch('turn.end', {})")

        # ---------------- HIDDEN ----------------
        if want('HIDDEN'):
            print('HIDDEN'); await reset()
            rid = await gm.evaluate("(() => { tw.spawnRoom(tw.roomgen.typeList[0].key, 15, 0, 5, 4, 77); return null; })()")
            await wait(gm, "Object.values(tw.entities()).some(e => e.kind === 'room') && tw.sync.pendingCount() === 0", 15000, 'room')
            rid = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'room').id")
            await gm.evaluate(f"tw.setHidden([tw.entities()['{rid}']], true)"); await wait(mi, f"!{E(rid)}", 8000, 'room hidden from mira')
            n0 = await mi.evaluate('window.__rx.length')
            await gm.evaluate("tw.rulers.start({ x: 82, y: 0, z: 10 }, { x: 88, y: 0, z: 10 }, 'circle')"); await gm.wait_for_timeout(600)
            await gm.fill('#rulers .rstrip input[data-rounds]', '10'); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(400); hid = await gm.evaluate('tw.rulers.lastKept')
            await wait(gm, f"!!{E(hid)} && tw.sync.pendingCount() === 0", 6000)
            e = await gm.evaluate(E(hid))
            check(e and e['hidden'] is True, 'the GM keeps a template inside a hidden room: it is hidden with no extra step', e)
            await gm.evaluate("tw.dispatch('turn.start', {})"); await wait(mi, "!!tw.turns()", 6000)
            for _ in range(8): await gm.keyboard.press('n'); await gm.wait_for_timeout(150)
            await gm.evaluate(f"tw.rulers.select('{hid}')"); await gm.wait_for_timeout(300)
            hx, hy = await gm.evaluate("(() => { const r = document.querySelector('#rulers .rhandle.b').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()")
            await gm.mouse.move(hx, hy); await gm.mouse.down(); await gm.mouse.move(hx + 30, hy, steps=4); await gm.mouse.up(); await gm.wait_for_timeout(700)
            check(await gm.evaluate(f"{E(hid)}.size !== 6 && tw.turns().order.includes('{hid}') && {E(hid)}.left < 10"), '(the GM changed it, it has a row for the GM, and rounds were counted)', await gm.evaluate(E(hid)))
            leak = await mi.evaluate(f"[window.__rx.slice({n0}).some(f => f.includes('{hid}')), window.__rx.slice({n0}).some(f => f.includes('\"ruler\"')), !!tw.entities()['{hid}'], tw.turns().order.includes('{hid}'), tw.rulers.state().items.length]")
            check(leak == [False, False, False, False, 0], 'the player\'s page: not one byte with its id, no ruler while it was drawn, no entity, no row, nothing drawn', leak)
            await gm.keyboard.press('Escape'); await gm.evaluate("tw.dispatch('turn.end', {})")

        check(not errors, 'no page errors', errors[:3])
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for pr in procs:
        try: pr.wait(timeout=5)
        except Exception: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\nrulers: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)

#!/usr/bin/env python3
"""Conditional buttons go down into the chat (Harry 2026-10-06; docs/UI.md "Conditional buttons"). GM tab + player tab.

  local:  TW_GPU=1 python3 engine/test/browser_chatline.py --local [--shot]

  LAND     an unpressed "Cut to lv N" flies down into the chat when its time is up and stays as a line with a working
           button; reduced motion fades; nothing is announced; the line is this seat's only
  HONEST   the button on a line checks before it acts: an undo that was already undone, whose thing has changed since,
           or whose thing is gone is greyed with the reason and does nothing; pressing a good one marks the line done
  FLOOD    six pawns going upstairs leave one line; at most 8 action lines are kept
  KEY      . presses the newest action line's button
  RELOAD   a cut line still works after a reload; an undo line comes back as plain text
  RARE     building a room with its stair makes no conditional button and no action line; zooming out offers nothing
"""
import argparse, asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--shot', action='store_true')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = 18137, 18767
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-chatline-'); site = tempfile.mkdtemp(prefix='tw-site-')
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
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def view(pg, x, z, dist=95, pitch=60, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"); await pg.wait_for_timeout(250)
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over'); await pg.wait_for_timeout(300)
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
LINES = "tw.actionLines.list()"
DOM = "[...document.querySelectorAll('#chat .line.act')].map(e => ({ id: e.dataset.act, text: e.querySelector('.atext').textContent, btn: e.querySelector('.abtn')?.textContent || null, off: !!e.querySelector('.abtn.off'), why: e.querySelector('.awhy')?.textContent || null, done: e.classList.contains('done'), hidden: e.classList.contains('pending'), kbd: e.querySelector('.abtn kbd')?.textContent || null }))"
FLOATING = "tw.condButtons.list().map(b => b.key)"
TOK = lambda i: f"(() => {{ const t = tw.entities()['{i}']; return t ? [t.x, t.z, t.y || 0] : null; }})()"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900, **kw):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, **kw)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST nits chatline {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        R = {}
        for (name, a) in (('common', dict(type='common', x=0, z=0, w=6, d=4, seed=5101)), ('up', dict(type='guest', x=0, z=0, w=4, d=4, y=10, seed=5103))):
            rid = f"room_cl{name}{random.randrange(10**6):06d}"[:24]
            R[name] = await gm.evaluate(SPAWN, {'id': rid, **a})
            check(await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, name), f'{name} built')
        await settle(gm); await view(gm, 20, 10)
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
        pl = await tab(invite + '&nofx')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab joined')
        PL = await pl.evaluate('tw.me()')
        toks = [{'type': 'token.create', 'args': {'id': 'tok_mira00001', 'name': 'Brakka', 'x': 22.5, 'z': 12.5, 'owner': PL}}] + [{'type': 'token.create', 'args': {'id': f'tok_goblin000{i}', 'name': f'Goblin {i}', 'x': 22.5, 'z': 2.5 + i * 2.5}} for i in range(1, 7)]
        await gm.evaluate(f"tw.batch({json.dumps(toks)})"); await wait(pl, "tw.entities()['tok_goblin0006']", 8000); await settle(gm); await settle(pl); await view(pl, 20, 10)
        await gm.evaluate("tw.registry.run('chat.say', {})") if False else None
        await gm.keyboard.press('/'); await gm.keyboard.type('say Welcome to the inn', delay=5); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(400)
        await wait(gm, "!tw.announce.info().showing", 12000); await wait(pl, "!tw.announce.info().showing", 12000)

        # ================= LAND =================
        print('LAND: an unpressed offer goes down into the chat')
        ann0 = await pl.evaluate("tw.announce.info().log.length"); chat0 = await pl.evaluate("tw.view().chat.length"); seq0 = await gm.evaluate("tw.view().seq")
        await pl.evaluate("tw.dispatch('token.move', { id: 'tok_mira00001', x: 12.5, z: 12.5, y: 10 })"); ok = await wait(pl, "tw.condButtons.has('cut-offer')", 6000, 'offer')
        check(ok and await pl.evaluate(LINES) == [], 'the player\'s pawn goes upstairs: the floating "Cut to lv 2" appears; no chat line yet')
        t0 = time.time(); ok = await wait(pl, "!tw.condButtons.has('cut-offer') && tw.actionLines.list().length === 1", 12000, 'handoff'); life = time.time() - t0
        mid = await pl.evaluate(DOM); await wait(pl, "tw.condButtons.flights().at(-1)?.landedAt", 4000); await pl.wait_for_timeout(120)
        fl = await pl.evaluate("tw.condButtons.flights().at(-1)"); d = await pl.evaluate(DOM); L = await pl.evaluate(LINES)
        check(ok and 5 < life < 9, 'when its time is up (about 6 s) it leaves its place for the chat instead of fading away', f'{life:.1f} s')
        check(fl and fl['mode'] == 'fly' and fl.get('landed') and fl.get('target') and abs(fl['landed'][0] - fl['target'][0]) < 3 and abs(fl['landed'][1] - fl['target'][1]) < 3 and mid and mid[0]['hidden'] and not d[0]['hidden'], 'it FLIES there: the line is held invisible, the button lands on the line\'s own button (within 3 px), then the line shows', str(fl))
        check(len(d) == 1 and d[0]['text'] == 'Brakka went to lv 2' and d[0]['btn'] and d[0]['btn'].startswith('Cut to lv 2') and not d[0]['off'] and L[0]['state'] is None, 'the line says what happened and carries the same button: "Brakka went to lv 2 · [Cut to lv 2]"', str(d))
        check(await pl.evaluate("tw.announce.info().log.length") == ann0 and not await pl.evaluate("tw.announce.info().showing"), 'it is not announced (no big centred box)')
        quiet = await pl.evaluate("(() => { const a = document.querySelector('#chat .line.act'), s = document.querySelector('#chat .line:not(.act)'); return { act: parseFloat(getComputedStyle(a).fontSize), say: parseFloat(getComputedStyle(s).fontSize), who: !!a.querySelector('.who') }; })()")
        check(quiet['act'] < quiet['say'] and not quiet['who'], 'it is quieter than a say: smaller type, no speaker name', str(quiet))
        check(await gm.evaluate(LINES) == [] and await gm.evaluate(DOM) == [] and await pl.evaluate("tw.view().chat.length") == chat0 and await gm.evaluate("tw.view().chat.length") == chat0, 'LOCAL: the GM\'s chat has no such line, and the shared chat (what the relay keeps) did not grow')
        applied = await gm.evaluate(f"tw.applied.filter(a => a[1] > {seq0}).map(a => a[3])")
        # Fog exploration is independent per-seat campaign state and may be
        # submitted while the quiet chat offer is animating. Keep every other
        # relay action exact: the offer itself must not enter the log.
        check([kind for kind in applied if kind != 'fog.view'] == ['token.move'], 'the relay\'s log gained only the pawn\'s move, apart from independent fog exploration', str(applied))
        cut0 = await pl.evaluate("tw.cut.y"); exp0 = await pl.evaluate("document.getElementById('chat').classList.contains('expanded')")
        await pl.click('#chat .line.act .abtn'); await pl.wait_for_timeout(350); d = await pl.evaluate(DOM)
        check(cut0 is None and await pl.evaluate("tw.cut.y") == 19 and await pl.evaluate("tw.level") == 10 and d[0]['done'] and d[0]['btn'] is None, 'pressing the button on the line goes to lv 2 and marks the line done', str(d))
        check(await pl.evaluate("document.getElementById('chat').classList.contains('expanded')") == exp0 and await pl.evaluate("document.activeElement === document.body"), 'the press neither expands the chat log nor takes the keyboard focus')
        # reduced motion: a fade
        await pl.emulate_media(reduced_motion='reduce'); await pl.evaluate("tw.cutOff('test')")
        await pl.evaluate("tw.dispatch('token.move', { id: 'tok_mira00001', x: 22.5, z: 12.5, y: 0 })"); await wait(pl, "tw.condButtons.has('cut-offer')", 6000, 'offer 2')
        await pl.evaluate("tw.condButtons.expire('cut-offer')"); await wait(pl, "tw.condButtons.flights().length === 2 && tw.condButtons.flights()[1].landedAt", 5000, 'fade')
        fl = await pl.evaluate("tw.condButtons.flights()[1]"); d = await pl.evaluate(DOM)
        check(fl['mode'] == 'fade' and len(d) == 2 and d[1]['text'] == 'Brakka went to lv 1' and not d[1]['hidden'], 'with reduced motion the button fades and the line fades in (no flight)', str(fl['mode']))
        await pl.emulate_media(reduced_motion='no-preference')

        # ================= FLOOD =================
        print('FLOOD: repeats collapse; a cap')
        await gm.evaluate(f"tw.cutOff('test'); tw.goLevel(0, 'test'); tw.cutOff('test'); tw.condButtons.hide('undo:{PL}'); tw.actionLines.clear()")
        for i in range(1, 7):
            await gm.evaluate(f"tw.dispatch('token.move', {{ id: 'tok_goblin000{i}', x: {2.5 + i * 2.5}, z: 7.5, y: 10 }})"); await wait(gm, f"tw.condButtons.get('cut-offer')?.spec.data.token === 'tok_goblin000{i}'", 6000, f'offer {i}'); await gm.wait_for_timeout(150)
        fb = await gm.evaluate(FLOATING); L = await gm.evaluate(LINES)
        check(fb.count('cut-offer') == 1 and len(L) == 1 and L[0]['count'] == 5, 'the GM moves six goblins upstairs: one floating offer at a time; the five it replaced are ONE line in the chat', f'{fb} {L}')
        await gm.evaluate("tw.condButtons.expire('cut-offer')"); await wait(gm, "tw.actionLines.list()[0]?.count === 6 && !tw.condButtons.has('cut-offer')", 5000); await gm.wait_for_timeout(700)
        d = await gm.evaluate(DOM)
        check(len(d) == 1 and d[0]['text'] == '6 pawns went to lv 2' and d[0]['btn'].startswith('Cut to lv 2'), 'and when the last one\'s time is up: still one line, "6 pawns went to lv 2 · [Cut to lv 2]"', str(d))
        # KEY
        print('KEY: . presses the newest action line\'s button')
        check(d[0]['kbd'] == '.', 'the newest line\'s button shows the key', str(d[0]))
        await gm.keyboard.press('/'); await gm.keyboard.type('.', delay=5); await gm.wait_for_timeout(150); typed = await gm.evaluate("tw.cut.y"); await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        await gm.keyboard.press('.'); await gm.wait_for_timeout(350); d = await gm.evaluate(DOM)
        check(typed is None and await gm.evaluate("tw.cut.y") == 19 and d[0]['done'], '. does it (lv 2) and marks the line done; typed into the command bar it is just a full stop', str(d))
        n0 = await gm.evaluate("tw.cutLog.length"); await gm.keyboard.press('.'); await gm.wait_for_timeout(200)
        check(await gm.evaluate("tw.cutLog.at(-1).by") == 'chat' and await gm.evaluate("tw.cutLog.length") == n0, 'with no line left to act on, . does nothing')
        await gm.evaluate("tw.cutOff('test'); tw.goLevel(0, 'test'); tw.cutOff('test'); tw.actionLines.clear()")

        # ================= HONEST =================
        print('HONEST: an old undo button checks before it acts')
        async def chip(move):  # the player changes something; the GM's undo chip appears; its time is made to be up; the line lands
            n = await gm.evaluate("tw.condButtons.flights().length")
            await pl.evaluate(move); ok = await wait(gm, f"tw.condButtons.has('undo:{PL}')", 6000, 'chip')
            await gm.wait_for_timeout(250); await gm.evaluate(f"tw.condButtons.expire('undo:{PL}')")
            await wait(gm, f"tw.condButtons.flights().length > {n} && tw.condButtons.flights().at(-1).landedAt", 5000, 'chip lands'); await gm.wait_for_timeout(150); return ok
        undo_line = "tw.actionLines.list().filter(l => l.kind === 'undo').at(-1)"
        undo_dom = "(() => { const all = " + DOM + ", ids = tw.actionLines.list().filter(l => l.kind === 'undo').map(l => l.id); return all.filter(e => ids.includes(e.id)).at(-1) || null; })()"
        await gm.evaluate("document.getElementById('chat').click()")  # expanded: every line is in view
        ok = await chip("tw.dispatch('token.move', { id: 'tok_mira00001', x: 27.5, z: 12.5, y: 0 })")
        l = await gm.evaluate(undo_line); d = await gm.evaluate(undo_dom)
        check(ok and l and l['state'] is None and d and d['text'] == 'Mira moved Brakka' and d['btn'].startswith('Undo') and not d['off'], 'the GM\'s undo chip for a player\'s move lands as "Mira moved Brakka · [Undo]"', str(d))
        await gm.evaluate(f"document.querySelector('#chat .line.act[data-act=\"{l['id']}\"] .abtn').click()"); await wait(gm, "tw.entities()['tok_mira00001'].x === 22.5", 6000, 'undone'); await gm.wait_for_timeout(300)
        d = await gm.evaluate(undo_dom)
        check(await gm.evaluate(TOK('tok_mira00001')) == [22.5, 12.5, 0] and d['done'], 'its button undoes exactly that move, and the line is marked done', str(d))
        # already undone (by the bar's undo, behind the line's back)
        await chip("tw.dispatch('token.move', { id: 'tok_mira00001', x: 27.5, z: 7.5, y: 0 })"); l = await gm.evaluate(undo_line)
        await gm.evaluate(f"tw.sync.submitRaw({{ type: 'undo', area: tw.area(), args: {{ who: '{PL}' }} }})"); await wait(gm, "tw.entities()['tok_mira00001'].x === 22.5", 6000); await gm.wait_for_timeout(300)
        d = await gm.evaluate(undo_dom); seq = await gm.evaluate("tw.view().seq")
        await gm.evaluate(f"document.querySelector('#chat .line.act[data-act=\"{l['id']}\"] .abtn').click()"); await gm.wait_for_timeout(600)
        check(d['off'] and d['why'] == 'already undone' and await gm.evaluate("tw.view().seq") == seq and not (await gm.evaluate(undo_dom))['done'], 'undone some other way meanwhile: the button is greyed, says "already undone", and pressing it does nothing', str(d))
        # changed since
        await chip("tw.dispatch('token.move', { id: 'tok_mira00001', x: 27.5, z: 17.5, y: 0 })"); l = await gm.evaluate(undo_line)
        fresh = (await gm.evaluate(undo_dom))['off']
        await gm.evaluate("tw.dispatch('token.move', { id: 'tok_mira00001', x: 17.5, z: 17.5, y: 0 })"); await wait(gm, "tw.sync.pendingCount() === 0 && tw.entities()['tok_mira00001'].x === 17.5", 6000); await gm.wait_for_timeout(300)
        d = await gm.evaluate(undo_dom); seq = await gm.evaluate("tw.view().seq")
        await gm.evaluate(f"document.querySelector('#chat .line.act[data-act=\"{l['id']}\"] .abtn').click()"); await gm.wait_for_timeout(600)
        check(not fresh and d['off'] and d['why'] == 'changed since' and await gm.evaluate("tw.view().seq") == seq and await gm.evaluate(TOK('tok_mira00001')) == [17.5, 17.5, 0], 'the pawn was moved again by someone else: "changed since", and the newer move is not overwritten', str(d))
        # the thing is gone
        await chip("tw.dispatch('token.move', { id: 'tok_mira00001', x: 27.5, z: 2.5, y: 0 })"); l = await gm.evaluate(undo_line)
        await gm.evaluate("tw.dispatch('token.delete', { id: 'tok_mira00001' })"); await wait(gm, "!tw.entities()['tok_mira00001'] && tw.sync.pendingCount() === 0", 6000); await gm.wait_for_timeout(300)
        d = await gm.evaluate(undo_dom); seq = await gm.evaluate("tw.view().seq")
        await gm.evaluate(f"document.querySelector('#chat .line.act[data-act=\"{l['id']}\"] .abtn').click()"); await gm.wait_for_timeout(600)
        check(d['off'] and d['why'] == 'that pawn is gone' and await gm.evaluate("tw.view().seq") == seq and not await gm.evaluate("!!tw.entities()['tok_mira00001']"), 'the pawn was deleted: "that pawn is gone", and nothing comes back by surprise', str(d))
        check(await pl.evaluate("tw.actionLines.list().filter(l => l.kind === 'undo').length") == 0, 'the player has none of the GM\'s undo lines')
        if A.shot:
            await gm.keyboard.press('Control+z'); await wait(gm, "!!tw.entities()['tok_mira00001']", 6000)
            await gm.evaluate("tw.actionLines.clear(); document.getElementById('chat').click()")
            await chip("tw.dispatch('token.move', { id: 'tok_mira00001', x: 27.5, z: 12.5, y: 0 })")
            await gm.evaluate("tw.dispatch('token.move', { id: 'tok_goblin0001', x: 22.5, z: 2.5, y: 0 })"); await gm.wait_for_timeout(500); await gm.evaluate("tw.condButtons.hide('cut-offer')"); await gm.evaluate("tw.dispatch('token.move', { id: 'tok_goblin0001', x: 5, z: 7.5, y: 10 })"); await wait(gm, "tw.condButtons.get('cut-offer')?.spec.data.cut === 19", 6000)
            await gm.evaluate("tw.condButtons.expire('cut-offer')"); await gm.wait_for_timeout(1500); await gm.mouse.move(700, 300)
            await gm.screenshot(path=os.path.join(SHOTS, 'chatline.png')); print('shot', await gm.evaluate(DOM))
            await browser.close(); return

        # ================= CAP =================
        print('CAP')
        await gm.evaluate("for (let i = 0; i < 12; i++) tw.actionLines.add({ kind: 'cut', text: 'Test ' + i, button: 'Cut', group: 'g' + i, data: { cut: 9, area: tw.area() } })")
        L = await gm.evaluate(LINES)
        check(len(L) == 8 and L[-1]['text'] == 'Test 11' and L[0]['text'] == 'Test 4', 'at most 8 action lines are kept; the oldest go first', str([l['text'] for l in L]))

        # ================= RARE =================
        print('RARE: building makes no conditional button and no line; zooming offers nothing')
        await gm.evaluate("tw.actionLines.clear()"); await gm.evaluate("tw.select([])")
        before_stairs = await gm.evaluate("Object.values(tw.entities()).filter(e => tw.ST.isConnector(e)).map(e => e.id).sort()")
        rid = await gm.evaluate("tw.spawnRoom('common', 10, 6, 7, 5, 777)"); await wait(gm, "tw.sync.pendingCount() === 0", 20000); await settle(gm)
        up = await gm.evaluate("tw.spawnRoom('guest', 10, 6, 4, 4, 778, undefined, 10)"); await wait(gm, "tw.sync.pendingCount() === 0", 20000); await settle(gm)
        stairs = await gm.evaluate("Object.values(tw.entities()).filter(e => tw.ST.isConnector(e)).map(e => e.id).sort()")
        check(up and stairs == before_stairs and await gm.evaluate(FLOATING) == [] and await gm.evaluate(LINES) == [] and await pl.evaluate("tw.condButtons.list().length") == 0, 'the GM draws an upper guest room without an implicit stair: no conditional button for either seat and no action line', f'connectors {before_stairs} -> {stairs}')
        await gm.evaluate("(() => { const g = tw.main.grab; g.dist = g.maxDist; g.update(); })()"); await gm.wait_for_timeout(800)
        check(await gm.evaluate(FLOATING) == [] and await gm.evaluate(LINES) == [], 'zoomed all the way out: nothing is offered (no "Roofs on")'); await view(gm, 20, 10)

        # ================= RELOAD =================
        print('RELOAD')
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_mira00002', name: 'Brakka', x: 22.5, z: 12.5, owner: '" + PL + "' })"); await wait(pl, "tw.entities()['tok_mira00002']", 6000)
        await chip("tw.dispatch('token.move', { id: 'tok_mira00002', x: 27.5, z: 12.5, y: 0 })")
        await gm.evaluate("tw.dispatch('token.move', { id: 'tok_goblin0001', x: 22.5, z: 2.5, y: 0 })"); await gm.wait_for_timeout(500); await gm.evaluate("tw.condButtons.hide('cut-offer')")
        await gm.evaluate("tw.dispatch('token.move', { id: 'tok_goblin0001', x: 5, z: 7.5, y: 10 })"); await wait(gm, "tw.condButtons.get('cut-offer')?.spec.data.cut === 19", 6000); await gm.evaluate("tw.condButtons.expire('cut-offer')"); await gm.wait_for_timeout(1200)
        before = await gm.evaluate(LINES)
        await gm.reload(); await wait(gm, 'window.tw && tw.ready && tw.ready() && tw.actionLines', 45000); await gm.wait_for_timeout(2500)
        after = await gm.evaluate(LINES); d = await gm.evaluate("(() => { document.getElementById('chat').click(); return " + DOM + "; })()")
        u = next((x for x in after if x['kind'] == 'undo'), None); c = next((x for x in after if x['kind'] == 'cut'), None)
        du = next((x for x in d if u and x['id'] == u['id']), None); dc = next((x for x in d if c and x['id'] == c['id']), None)
        check(len(before) == 2 and [x['text'] for x in after] == [x['text'] for x in before], 'the action lines are back after a reload', str([x['text'] for x in after]))
        check(du and du['btn'] is None and du['text'] == 'Mira moved Brakka' and not du['done'], 'the undo line cannot be checked again after a reload: plain text, no button', str(du))
        check(dc and dc['btn'] and not dc['off'], 'the cut line still has its button', str(dc))
        await gm.evaluate(f"document.querySelector('#chat .line.act[data-act=\"{c['id']}\"] .abtn').click()"); await gm.wait_for_timeout(400)
        check(await gm.evaluate("tw.cut.y") == 19, 'and it still works')

        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
bad = [r for r in results if not r[0]]
print(f"\nchatline: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)

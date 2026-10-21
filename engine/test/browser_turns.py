#!/usr/bin/env python3
"""Turn order and initiative, and the GM's pawn X-ray (Harry 2026-10-06; docs/PAWNS.md, docs/UI.md).

  local:  TW_GPU=1 python3 engine/test/browser_turns.py --local [--shots]
  live:   ... browser_turns.py --page https://turnipworks.net/        (one campaign, "TEST turns <time> (throwaway)", removed at exit)

  BAR     a player types "initiative": "Set your initiative bonus…" and "Roll your initiative"
  START   the GM's "Start fight": one order on every seat; each PLAYER is offered "Roll initiative", the GM is not
  ROLL    the offer rolls with the game's dice (a roll line in the chat) and adds the bonus; with no bonus set it asks
          first, then rolls; a typed number is taken in place of a roll; the offer goes when the pawn has a number, and
          an unanswered one goes down into the chat and still works there
  GM      rolls for all PCs in one action; monsters once per kind; a hidden pawn's entry gets its number with no roll
          line, and nothing a player's page receives ever names it
  NEXT    N and Shift+N; the mark on the table (every pawn of the current entry); a player ends her own turn with N and
          cannot end another's; "Your turn" for the player whose pawn is up
  ORDER   the GM moves the selected pawn's entry, takes it out, puts it in; End fight; undo
  XRAY    (GM) X: every pawn outlined through walls and floors, on all levels, players' pawns in another colour, hidden
          ones too; a player has no such command and no such key; nothing is sent
"""
import argparse, asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaign this suite makes is a throwaway: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--only')
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18173,18803').split(','))  # TW_PORTS=a,b when another worktree is running this suite
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-turns-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])  # /tmp is RAM: both are removed at exit
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
# everything the page RECEIVES from the relay, kept as text (websocket frames, server-sent events, fetch bodies)
RX = """(() => { window.__rx = []; window.__tx = [];
  { const send = window.WebSocket.prototype.send; window.WebSocket.prototype.send = function (d) { try { window.__tx.push(String(d)); } catch { } return send.call(this, d); }; }
  const WS = window.WebSocket; window.WebSocket = class extends WS { constructor(...a) { super(...a); this.addEventListener('message', (ev) => { try { window.__rx.push(String(ev.data)); } catch { } }); } };
  const ES = window.EventSource; if (ES) window.EventSource = class extends ES { constructor(...a) { super(...a); this.addEventListener('message', (ev) => { try { window.__rx.push(String(ev.data)); } catch { } }); } };
  const F = window.fetch; window.fetch = async (...a) => { try { if (a[1]?.method === 'POST' && typeof a[1].body === 'string') window.__tx.push(a[1].body); } catch { } const r = await F(...a); try { const u = String(a[0]?.url || a[0]); if (/\\/(c|sse|a)\\//.test(u) && !/\\.(glb|png|webp|js|json)(\\?|$)/.test(u)) r.clone().text().then(t => window.__rx.push(t)).catch(() => {}); } catch { } return r; }; })()"""
TURNS = "JSON.parse(JSON.stringify(tw.turns()))"
ROWS = "[...document.querySelectorAll('#results .res')].map(e => ({ t: e.innerText.replace(/\\s+/g, ' ').trim(), off: e.classList.contains('disabled') || e.getAttribute('aria-disabled') === 'true' }))"
OFFERS = "tw.condButtons.list().filter(b => b.visible).map(b => b.text)"
CHAT = "(tw.view().chat || []).map(c => ({ text: c.text, roll: c.roll || null, by: c.by }))"

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
        if nm: await nm.fill(f"TEST turns {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        seats = {}; pages = {'Harry': gm}
        for name in ('Mira', 'Kit'):
            await gm.keyboard.press('/'); await gm.keyboard.type(f'invite {name}', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
            await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
            invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
            pg = await tab(invite + '&nofx'); pages[name] = pg
            await wait(pg, 'window.tw && tw.ready && tw.ready()', 45000, f'{name} joins'); seats[name] = await pg.evaluate('tw.me()')
        mi, kit = pages['Mira'], pages['Kit']; seats['Harry'] = await gm.evaluate('tw.me()')
        BR, ZE, G1, G2, G3, OG, ST = 'tok_brakka0001', 'tok_zed0000001', 'tok_goblin0001', 'tok_goblin0002', 'tok_goblin0003', 'tok_ogre000001', 'tok_strahd0001'
        SECRET = 'Strahdvonz'
        toks = [{'type': 'token.create', 'args': {'id': BR, 'name': 'Brakka', 'x': 12.5, 'z': 12.5, 'owner': seats['Mira'], 'initBonus': 3}},
                {'type': 'token.create', 'args': {'id': ZE, 'name': 'Zed', 'x': 22.5, 'z': 12.5, 'owner': seats['Kit']}},
                {'type': 'token.create', 'args': {'id': G1, 'name': 'Goblin 1', 'x': 32.5, 'z': 12.5}}, {'type': 'token.create', 'args': {'id': G2, 'name': 'Goblin 2', 'x': 37.5, 'z': 12.5, 'initBonus': 2}}, {'type': 'token.create', 'args': {'id': G3, 'name': 'Goblin 3', 'x': 42.5, 'z': 12.5}},
                {'type': 'token.create', 'args': {'id': OG, 'name': 'Ogre', 'x': 52.5, 'z': 12.5}},
                {'type': 'token.create', 'args': {'id': ST, 'name': SECRET, 'x': 62.5, 'z': 12.5, 'hidden': True, 'initBonus': 6}}]
        await gm.evaluate(f"tw.batch({json.dumps(toks)})")
        for pg in (gm, mi, kit): await wait(pg, f"{E(OG)} && tw.sync.pendingCount() === 0", 10000, 'pawns')
        for pg in pages.values(): await pg.evaluate("(() => { const g = tw.main.grab; g.focus.set(37, 0, 14); g.yaw = 0; g.pitch = 55; g.dist = 95; g.update(); tw.main.rule = 'free'; })()")
        settle = lambda: asyncio.gather(*[wait(pg, 'tw.sync.pendingCount() === 0', 8000, 'settle') for pg in pages.values()])
        async def same(js, ms=8000):  # all three tabs agree on a value (the GM's is returned)
            v = await gm.evaluate(js)
            for pg in (mi, kit): await wait(pg, f"JSON.stringify({js}) === {json.dumps(json.dumps(v, separators=(',', ':')))}", ms, 'tabs agree')
            return v, [await pg.evaluate(js) for pg in (mi, kit)]
        async def bar(pg, text, pick=None, enter=True):
            if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
            await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=6); await pg.wait_for_timeout(280)
            rows = await pg.evaluate(ROWS)
            if pick is not None:
                idx = next((i for i, r in enumerate(rows) if pick.lower() in r['t'].lower()), None)
                if idx is None: print('    (no row', pick, [r['t'][:50] for r in rows[:8]], ')'); await pg.keyboard.press('Escape'); return rows
                for _ in range(idx + (0 if await pg.evaluate("document.querySelector('#results .res.hi') ? 1 : 0") else 1)): await pg.keyboard.press('ArrowDown')
                hi = await pg.evaluate("document.querySelector('#results .res.hi')?.innerText.replace(/\\s+/g, ' ') || ''")
                if pick.lower() not in hi.lower(): print('    (highlight is', hi[:60], 'wanted', pick, ')')
            if enter: await pg.keyboard.press('Enter'); await pg.wait_for_timeout(250)
            return rows
        async def sel(pg, id): await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.evaluate(f"tw.select('{id}')"); await pg.wait_for_timeout(120)
        async def clear(pg): await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.evaluate('tw.clearSelection()')

        # ================= BAR =================
        print('BAR: what "initiative" offers')
        rows = await bar(mi, 'initiative', enter=False); await mi.keyboard.press('Escape')
        t = [r['t'] for r in rows]
        check(any('Set your initiative bonus' in x for x in t) and any('Roll your initiative' in x for x in t), 'a player types "initiative": "Set your initiative bonus…" and "Roll your initiative"', t[:6])
        check(not any('Start fight' in x or 'for all PCs' in x or 'monsters' in x for x in t), 'and none of the GM\'s (start fight, roll for all PCs, the monsters)')
        rows = await bar(gm, 'initiative', enter=False); await gm.keyboard.press('Escape')
        check(any('Start fight' in r['t'] for r in rows), 'the GM typing "initiative" finds Start fight', [r['t'][:40] for r in rows[:8]])
        check(await gm.evaluate('tw.turns()') is None and await mi.evaluate("tw.registry.get('turn.next').when(tw.registry.ctx())") is False, 'no order yet: nothing to step')
        await mi.keyboard.press('n'); await gm.keyboard.press('n'); await gm.wait_for_timeout(200)
        check(await gm.evaluate('tw.turns()') is None, 'N does nothing while there is no order')

        # ================= START =================
        print('START: the GM starts a fight')
        await clear(gm); await bar(gm, 'start fight', pick='Start fight')
        await wait(gm, '!!tw.turns()', 5000, 'turns'); await settle()
        T, others = await same(TURNS)
        check(T and T['order'] == [BR, ZE, 'kind:goblin', 'kind:ogre'] and T['at'] is None and T['round'] == 1 and all(o == T for o in others), 'one order on every seat: the players\' pawns by name, then the kinds; no marker yet; the hidden pawn is not in it', T)
        for pg in (mi, kit): await wait(pg, f"{OFFERS}.some(t => /Roll initiative/.test(t))", 5000, 'offer')
        offers = {n: await pg.evaluate(OFFERS) for n, pg in pages.items()}
        check(offers['Mira'] == ['Roll initiative'] and offers['Kit'] == ['Roll initiative'] and offers['Harry'] == [], 'each PLAYER is offered "Roll initiative"; the GM is not', offers)
        check(await gm.evaluate('tw.turnMarks().length') == 0, 'no pawn wears the turn mark before the first Next')
        if A.shots: await mi.screenshot(path=os.path.join(SHOTS, 'turns-offer.png'))

        # ================= ROLL =================
        print('ROLL: the offer, the bonus, a typed number')
        c0 = len(await mi.evaluate(CHAT))
        await mi.evaluate("[...document.querySelectorAll('.cbtn')].find(b => /Roll initiative/.test(b.textContent)).click()"); await settle(); await wait(mi, f"'{BR}' in tw.turns().init", 5000, 'init')
        T, _ = await same(TURNS); chat = await mi.evaluate(CHAT); roll = chat[-1]['roll'] if chat else None
        check(len(chat) == c0 + 1 and roll and roll['expr'] == 'd20+3' and len(roll['rolls']) == 1 and 1 <= roll['rolls'][0] <= 20 and roll['total'] == roll['rolls'][0] + 3 and chat[-1]['text'] == 'Initiative: Brakka' and chat[-1]['by'] == seats['Mira'], 'Mira presses it: a roll line in the chat like any roll (d20+3, by Mira, "Initiative: Brakka")', chat[-1:])
        check(T['init'].get(BR) == roll['total'] and T['order'][0] == BR, 'the total is her pawn\'s number, on every seat, and the pawn with a number goes to the front', T)
        await mi.wait_for_timeout(1300)
        check('Roll initiative' not in await mi.evaluate(OFFERS) and not await mi.evaluate("tw.actionLines.list().some(l => l.kind === 'roll-init')"), 'her offer is gone once her pawn has a number (used: it leaves no chat line)')
        # Kit has no bonus: it asks first
        await kit.evaluate("[...document.querySelectorAll('.cbtn')].find(b => /Roll initiative/.test(b.textContent)).click()"); await kit.wait_for_timeout(350)
        st = await kit.evaluate("({ open: document.querySelector('#bar').classList.contains('open'), text: document.querySelector('#bar input').value, init: tw.turns().init, chat: (tw.view().chat || []).length })")
        check(st['open'] and st['text'] == 'initiative bonus ' and ZE not in st['init'] and st['chat'] == c0 + 1, 'Kit (no bonus set) presses it: nothing is rolled yet; the bar opens on "initiative bonus " for the number', st)
        await kit.evaluate(f"tw.sel.delete('{ZE}'); tw.emit('selection'); tw.sel.add('{ZE}'); tw.emit('selection')")
        check(await kit.evaluate(f"tw.sel.has('{ZE}') && document.querySelector('#bar').classList.contains('open')"), 'a transient selection rebase leaves the bonus prompt active')
        await kit.keyboard.type('2', delay=10); await kit.wait_for_timeout(250)
        chips = await kit.evaluate("[...document.querySelectorAll('#bar .chips .chip')].map(c => c.textContent)")
        await kit.keyboard.press('Enter'); await settle(); kit_rolled = await wait(kit, f"'{ZE}' in tw.turns().init", 5000, 'kit init')
        if not kit_rolled:
            state = await kit.evaluate("""() => ({ selected: [...tw.sel], barOpen: document.querySelector('#bar').classList.contains('open'), barText: document.querySelector('#bar input').value,
              zed: tw.entities().tok_zed0000001, turns: tw.turns(), pending: tw.sync.pendingCount(), recentSelection: tw.selLog.slice(-5), lastRolls: tw.lastInitRolls })""")
            print('    Kit initiative diagnostic: ' + str(state), flush=True)
        T, _ = await same(TURNS); chat = await gm.evaluate(CHAT); z = await gm.evaluate(f"{E(ZE)}.initBonus")
        check(chips[:2] == ['initiative bonus', '+2'] and z == 2 and chat[-1]['roll'] and chat[-1]['roll']['expr'] == 'd20+2' and chat[-1]['text'] == 'Initiative: Zed' and T['init'][ZE] == chat[-1]['roll']['total'], 'he types 2: the bonus is kept on the pawn and THEN it rolls, d20+2', [chips, z, chat[-1:]])
        want = sorted([BR, ZE], key=lambda k: (-T['init'][k], -({BR: 3, ZE: 2}[k]), [BR, ZE].index(k)))
        check(T['order'][:2] == want and T['order'][2:] == ['kind:goblin', 'kind:ogre'], 'the two with numbers are in order of their numbers (a tie: the higher bonus), the rest after, as they were', [T['order'], T['init']])
        # a second press does not ask again
        await sel(kit, ZE); rows = await bar(kit, 'roll initiative', pick='Roll your initiative'); await settle(); await kit.wait_for_timeout(300)
        chat2 = await gm.evaluate(CHAT)
        check(len(chat2) == len(chat) + 1 and chat2[-1]['roll']['expr'] == 'd20+2' and not await kit.evaluate("document.querySelector('#bar').classList.contains('open')"), '"Roll your initiative" from the bar, with a bonus set, just rolls (and replaces his number)')
        # typed number (dice on the table)
        await sel(mi, BR); await bar(mi, 'initiative 17', enter=False); chips = await mi.evaluate("[...document.querySelectorAll('#bar .chips .chip')].map(c => c.textContent)"); await mi.keyboard.press('Enter'); await settle()
        await wait(gm, f"tw.turns().init['{BR}'] === 17", 5000, 'typed'); T, _ = await same(TURNS); chat3 = await gm.evaluate(CHAT)
        check(chips[:3] == ['initiative', '17', 'rolled at the table'] and T['init'][BR] == 17 and not chat3[-1]['roll'] and '17' in chat3[-1]['text'] and 'Brakka' in chat3[-1]['text'], '"initiative 17": the typed number is taken in place of a roll (a say line, no dice)', [chips, chat3[-1:]])
        # a player cannot set another's
        await sel(mi, ZE); await bar(mi, 'initiative 20', enter=True); await settle(); await mi.wait_for_timeout(300)
        check((await gm.evaluate(TURNS))['init'][ZE] != 20 or T['init'][ZE] == 20, 'Mira typing "initiative 20" with Kit\'s pawn selected changes her own pawn or nothing, never his', (await gm.evaluate(TURNS))['init'])
        await sel(mi, BR); await bar(mi, 'initiative 17', enter=True); await settle()

        # ================= GM =================
        print('GM: monsters, a hidden one, all PCs')
        await clear(gm); c1 = len(await gm.evaluate(CHAT))
        await bar(gm, 'roll for monsters', pick='monsters (once per kind)'); await settle(); await wait(gm, "'kind:goblin' in tw.turns().init && 'kind:ogre' in tw.turns().init", 5000, 'monsters')
        T, _ = await same(TURNS); chat = await gm.evaluate(CHAT); new = chat[c1:]
        check(len(new) == 2 and sorted(c['text'] for c in new) == ['Initiative: Goblin', 'Initiative: Ogre'] and next(c for c in new if 'Goblin' in c['text'])['roll']['expr'] == 'd20+2', 'the monsters roll ONCE PER KIND: one roll for the three goblins (their +2), one for the ogre', new)
        check(sorted(T['order'], key=lambda k: -T['init'][k]) == sorted(T['order'], key=lambda k: (-T['init'][k], T['order'].index(k))) and [T['init'][k] for k in T['order']] == sorted(T['init'].values(), reverse=True), 'the whole order is by number now', [T['order'], T['init']])
        # the hidden vampire joins: the GM puts it in, rolls for it
        await sel(gm, ST); await bar(gm, 'add to the turn order', pick='Add to the turn order'); await settle(); await wait(gm, f"tw.turns().order.includes('kind:{SECRET.lower()}')", 5000, 'added')
        c2 = len(await gm.evaluate(CHAT))
        await bar(gm, 'roll initiative', pick='Roll initiative for the selected'); await settle(); await wait(gm, f"'kind:{SECRET.lower()}' in tw.turns().init", 5000, 'hidden roll')
        G = await gm.evaluate(TURNS); P = await mi.evaluate(TURNS); r = await gm.evaluate('tw.lastInitRolls')
        check(len(G['order']) == 5 and len(P['order']) == 4 and f'kind:{SECRET.lower()}' not in P['order'] and f'kind:{SECRET.lower()}' not in P['init'] and len(await gm.evaluate(CHAT)) == c2 and r[0]['n'] == r[0]['die'] + 6, 'the GM adds the hidden pawn and rolls for it (d20 + its 6): five entries for the GM, four for a player, and NO roll line in the chat', [G['order'], P['order'], r])
        # put it first and step onto it: the players' mark does not move
        await gm.evaluate(f"tw.dispatch('turn.order', {{ order: ['kind:{SECRET.lower()}', ...tw.turns().order.filter(k => k !== 'kind:{SECRET.lower()}')] }})"); await settle()

        # ================= NEXT =================
        print('NEXT: the key, the mark on the table')
        await clear(gm); await gm.keyboard.press('n'); await settle(); await wait(gm, 'tw.turns().at !== null', 5000, 'next')
        G = await gm.evaluate(TURNS); P = await mi.evaluate(TURNS)
        check(G['at'] == f'kind:{SECRET.lower()}' and P['at'] is None and await gm.evaluate('tw.turnMarks().map(m => m.id)') == [ST] and await mi.evaluate('tw.turnMarks().length') == 0, 'N: the hidden pawn\'s turn. The GM sees its mark; the players see no marker at all', [G['at'], P['at']])
        await gm.keyboard.press('n'); await settle(); await wait(mi, 'tw.turns().at !== null', 5000, 'next 2')
        G = await gm.evaluate(TURNS); first = G['order'][1]
        marks = {n: sorted(await pg.evaluate('tw.turnMarks().filter(m => m.visible).map(m => m.id)')) for n, pg in pages.items()}
        ids = sorted(await gm.evaluate(f"tw.turnRows().find(r => r.current).ids"))
        check(G['at'] == first and all(m == ids for m in marks.values()), 'N again: the first visible entry; every pawn of it wears the mark, on every seat', [first, marks])
        a = await gm.evaluate('tw.turnMarks()[0].opacity'); await gm.wait_for_timeout(330); b = await gm.evaluate('tw.turnMarks()[0].opacity')
        check(a != b and 0.45 <= min(a, b) and max(a, b) <= 1.0, 'the mark breathes (its ring\'s opacity moves between 0.5 and 1)', [a, b])
        # walk to the goblins: all three wear it
        for _ in range(6):
            if (await gm.evaluate(TURNS))['at'] == 'kind:goblin': break
            await gm.keyboard.press('n'); await settle(); await gm.wait_for_timeout(120)
        await wait(mi, "tw.turns().at === 'kind:goblin'", 5000, 'goblins')
        marks = {n: sorted(await pg.evaluate('tw.turnMarks().map(m => m.id)')) for n, pg in pages.items()}
        check(all(m == [G1, G2, G3] for m in marks.values()), 'the goblins\' turn: all three goblins wear the mark (one entry)', marks)
        if A.shots:
            await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(37, 0, 14); g.yaw = 0; g.pitch = 50; g.dist = 70; g.update(); })()"); await gm.wait_for_timeout(700); await gm.screenshot(path=os.path.join(SHOTS, 'turns-mark.png'))
        r0 = (await gm.evaluate(TURNS))['round']
        await gm.keyboard.press('Shift+N'); await settle(); await gm.wait_for_timeout(200)
        back = await gm.evaluate(TURNS)
        check(back['order'].index(back['at']) == back['order'].index('kind:goblin') - 1, 'Shift+N goes back one', back['at'])
        await kit.keyboard.press('Shift+N'); await kit.wait_for_timeout(300)
        check((await gm.evaluate(TURNS))['at'] == back['at'], 'Shift+N from a player does nothing')
        # a player's own turn
        await gm.evaluate(f"tw.dispatch('turn.at', {{ key: '{BR}' }})"); await settle(); await wait(mi, f"tw.turns().at === '{BR}'", 5000, 'brakka turn')
        await wait(mi, f"{OFFERS}.some(t => /End turn/.test(t))", 4000, 'my turn')
        o = {n: await pg.evaluate(OFFERS) for n, pg in pages.items()}
        check(any('Brakka' in t and 'End turn' in t for t in o['Mira']) and not any('End turn' in t for t in o['Kit'] + o['Harry']), 'Brakka\'s turn: Mira (and only Mira) gets "Brakka\'s turn · End turn (N)"', o)
        await clear(kit); await kit.keyboard.press('n'); await kit.wait_for_timeout(350)
        check((await gm.evaluate(TURNS))['at'] == BR, 'Kit pressing N on Mira\'s turn does nothing')
        await clear(mi); await mi.keyboard.press('n'); await settle(); await wait(gm, f"tw.turns().at !== '{BR}'", 5000, 'mira ends')
        after = await gm.evaluate(TURNS)
        check(after['at'] != BR and after['order'].index(after['at']) == after['order'].index(BR) + 1, 'Mira presses N on her own turn: it moves on')
        await mi.wait_for_timeout(300)
        check(not any('End turn' in t for t in await mi.evaluate(OFFERS)), 'and her "End turn" button is gone')
        # typing N in a field is typing
        at0 = (await gm.evaluate(TURNS))['at']; await gm.keyboard.press('/'); await gm.keyboard.type('nnn', delay=10); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        check((await gm.evaluate(TURNS))['at'] == at0, 'N typed into the command bar is a letter, not Next')

        # ================= ORDER =================
        print('ORDER: by hand, end, undo; the offer in the chat')
        o0 = (await gm.evaluate(TURNS))['order']; i = o0.index('kind:ogre')
        await sel(gm, OG); await bar(gm, 'turn order move earlier', pick='move earlier'); await settle(); await gm.wait_for_timeout(200)
        o1 = (await gm.evaluate(TURNS))['order']
        check(i > 0 and o1.index('kind:ogre') == i - 1 and sorted(o1) == sorted(o0) and (await mi.evaluate(TURNS))['order'] == [k for k in o1 if SECRET.lower() not in k], 'the GM moves the selected pawn\'s entry one earlier ("move earlier"); the players\' order follows', [o0, o1])
        await bar(gm, 'take out of the turn order', pick='Take out'); await settle(); await gm.wait_for_timeout(200)
        check('kind:ogre' not in (await gm.evaluate(TURNS))['order'] and await gm.evaluate("tw.turnRows().find(r => r.key === 'kind:ogre')?.out") is True, '"Take out of the turn order": the ogre is out (and listed after the order, marked out)')
        await gm.evaluate(f"tw.dispatch('turn.at', {{ key: '{ZE}' }})"); await settle()
        await bar(gm, 'show the turn order', pick='Show the turn order'); await wait(gm, "!document.querySelector('#output').hidden", 4000, 'order text')
        txt = await gm.evaluate("document.querySelector('#output textarea').value"); title = await gm.evaluate("document.querySelector('#output h3').textContent"); await gm.keyboard.press('Escape')
        check('round' in title and 'Brakka' in txt and 'Goblin ×3' in txt and SECRET in txt and '▶' in txt, '"Show the turn order" lists it as text: the marker, numbers, bonuses', txt.replace('\n', ' | ')[:160])
        await clear(gm); await bar(gm, 'end fight', pick='End fight'); await settle()
        for pg in pages.values(): await wait(pg, 'tw.turns() === null', 5000, 'ended')
        check(all([await pg.evaluate('tw.turns() === null && tw.turnMarks().length === 0') for pg in pages.values()]), 'End fight: no order and no mark, on every seat')
        await gm.keyboard.press('Control+z'); await settle(); await wait(mi, '!!tw.turns()', 5000, 'undo end')
        check(len((await gm.evaluate(TURNS))['order']) == 4 and len((await mi.evaluate(TURNS))['order']) == 3, 'Ctrl+Z brings the fight back as it was (the GM\'s order whole, a player\'s without the hidden entry)')
        await bar(gm, 'end fight', pick='End fight'); await settle(); await wait(mi, 'tw.turns() === null', 5000, 'ended 2')
        # a new fight: roll for all PCs; an unanswered offer goes down into the chat and works from there
        await clear(gm); await bar(gm, 'start fight', pick='Start fight'); await settle(); await wait(kit, f"{OFFERS}.some(t => /Roll initiative/.test(t))", 5000, 'offer 2')
        await kit.evaluate("tw.condButtons.expire('roll-init')"); await wait(kit, "tw.actionLines.list().some(l => l.kind === 'roll-init')", 5000, 'line'); await kit.wait_for_timeout(700)
        line = await kit.evaluate("(() => { const l = tw.actionLines.list().find(l => l.kind === 'roll-init'); const el = document.querySelector(`#chat .line.act[data-act=\"${l.id}\"]`); return { text: el?.querySelector('.atext')?.textContent, btn: el?.querySelector('.abtn')?.textContent.replace('.', '').trim(), off: !!el?.querySelector('.abtn.off') }; })()")
        check(line['text'] == 'Harry started a fight' and line['btn'] == 'Roll initiative' and not line['off'], 'an offer not taken goes down into the chat: "Harry started a fight · [Roll initiative]"', line)
        c3 = len(await gm.evaluate(CHAT))
        await kit.evaluate("(() => { const l = tw.actionLines.list().find(l => l.kind === 'roll-init'); tw.actionLines.press(l.id); })()"); await settle(); await wait(gm, f"'{ZE}' in tw.turns().init", 5000, 'line roll')
        check(len(await gm.evaluate(CHAT)) == c3 + 1 and ZE in (await gm.evaluate(TURNS))['init'], 'pressing the line\'s button rolls (his bonus is set: no question)')
        await kit.wait_for_timeout(300)
        st = await kit.evaluate("(() => { const l = tw.actionLines.list().find(l => l.kind === 'roll-init'); const el = l && document.querySelector(`#chat .line.act[data-act=\"${l.id}\"]`); return el ? { off: !!el.querySelector('.abtn.off'), done: el.classList.contains('done') || !el.querySelector('.abtn') } : null; })()")
        check(st is None or st['off'] or st['done'], 'the line is spent once he has rolled', st)
        c4 = len(await gm.evaluate(CHAT))
        await clear(gm); await bar(gm, 'roll initiative for all pcs', pick='for all PCs'); await settle(); await wait(gm, f"'{BR}' in tw.turns().init", 5000, 'pcs')
        T = await gm.evaluate(TURNS); new = (await gm.evaluate(CHAT))[c4:]
        check(BR in T['init'] and len(new) == 1 and new[0]['text'] == 'Initiative: Brakka' and new[0]['by'] == seats['Harry'], '"Roll initiative for all PCs": the GM rolls for the PC who has not rolled (Brakka), and not again for Zed, who has', new)
        await mi.wait_for_timeout(400)
        check('Roll initiative' not in await mi.evaluate(OFFERS), 'Mira\'s offer goes when the GM has rolled for her')

        # ================= TRAFFIC =================
        print('TRAFFIC: what the players\' pages received')
        await gm.evaluate(f"tw.dispatch('turn.order', {{ order: ['{ST}', ...tw.turns().order] }})"); await settle(); await gm.keyboard.press('n'); await settle(); await gm.keyboard.press('n'); await settle()
        leaks = {}
        for n in ('Mira', 'Kit'):
            rx = await pages[n].evaluate("window.__rx.join('\\n')")
            leaks[n] = (len(rx), SECRET.lower() in rx.lower(), ST in rx, 'turn.view' in rx or '"turns"' in rx)
        gmrx = await gm.evaluate("window.__rx.join('\\n')")
        check(all(not a and not b and c and n > 2000 for (n, a, b, c) in leaks.values()) and SECRET in gmrx and ST in gmrx, 'nothing either player\'s page ever received names the hidden pawn, its id or its kind (every frame and fetch kept; the GM\'s page did receive them)', {k: v[0] for k, v in leaks.items()})

        # ================= XRAY =================
        print('XRAY: the GM\'s pawn X-ray')
        has = {n: await pg.evaluate("tw.registry.available().some(c => c.id === 'view.xray')") for n, pg in pages.items()}
        check(has == {'Harry': True, 'Mira': False, 'Kit': False}, 'the X-ray command exists for the GM and for no player', has)
        await clear(mi); await mi.keyboard.press('x'); await mi.wait_for_timeout(200)
        check(await mi.evaluate('[tw.xray(), tw.setXray(true), tw.xray(), tw.xrayInfo().pawns.length]') == [False, False, False, 0], 'a player pressing X gets nothing; nor can her page switch it on by any other way')
        seq0 = await gm.evaluate('tw.seq()'); cseq0 = await gm.evaluate('tw.sync.campaign.cseq'); await gm.evaluate('window.__tx.length = 0'); mrx0 = await mi.evaluate('window.__rx.length')
        await clear(gm); await gm.keyboard.press('x'); await gm.wait_for_timeout(600)
        info = await gm.evaluate('tw.xrayInfo()'); by = {p['id']: p for p in info['pawns']}
        check(info['on'] and sorted(by) == sorted([BR, ZE, G1, G2, G3, OG, ST]), 'X (GM): every pawn in the area has an outline, the pawn hidden from players included', sorted(by))
        check(by[BR]['color'] == by[ZE]['color'] and len({by[k]['color'] for k in (G1, G2, G3, OG, ST)}) == 1 and by[BR]['color'] != by[G1]['color'], 'the players\' pawns are one colour, every other pawn another', {k: v['color'] for k, v in by.items()})
        mat = await gm.evaluate("(() => { const out = []; tw.worldOf(tw.area()).layers.deco.traverse(o => { if (o.isMesh && o.parent?.userData.xray) out.push([o.material.depthTest, o.material.depthWrite, o.material.transparent, o.castShadow]); }); return { n: out.length, through: out.every(m => m[0] === false && m[1] === false && m[2] === true && m[3] === false) }; })()")
        check(mat['n'] >= 7 and mat['through'] and info['materials'] <= 4, 'they are drawn with no depth test and no depth write (through walls, floors and roofs), cast nothing, and share at most four materials', [mat, info['materials']])
        # A raised pawn stays visible through a cut at its base's level; X-ray still outlines
        # the figure where it stands above that cut.
        await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{G1}', x: 32.5, z: 12.5, y: 20 }})"); await settle(); await gm.evaluate("tw.goLevel && tw.goLevel(0, 'test'); tw.cutOn && tw.cutOn('test')"); await gm.wait_for_timeout(1200)
        up = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), r = w.recs.get('{G1}'), x = tw.xrayInfo().pawns.find(p => p.id === '{G1}'); return {{ shown: r.group.visible, cut: tw.cut?.y, at: x?.at, base: w.pawnBaseInfo('{G1}') }}; }})()")
        check(up['shown'] is True and up['base']['visible'] and up['base']['level'] <= up['cut'] and up['base']['figureY'] == 20 and up['base']['beam'] and up['base']['beam']['visible'] and up['at'] and up['at'][1] == 20, 'a raised pawn stays visible through a cut at its base while X-ray outlines its figure above the cut', up)
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'turns-xray.png'))
        await gm.evaluate("tw.cutOff && tw.cutOff('test')"); await gm.wait_for_timeout(500)
        tx = await gm.evaluate("window.__tx.flatMap(t => { try { const m = JSON.parse(t); return (m.msgs || [m]).map(x => x.t === 'cmd' ? x.type : x.t); } catch { return ['?']; } })")
        check(set(tx) <= {'pres', 'ping', 'cmd', 'token.move'} and tx.count('token.move') <= 1 and 'cmd' not in tx and await gm.evaluate('tw.sync.campaign.cseq') == cseq0, 'switching it on sent nothing: the GM\'s page sent only its cursor, its pings and the one pawn move this test made', sorted(set(tx)))
        mrx = await mi.evaluate(f"window.__rx.slice({mrx0}).join('\\n')")
        check('xray' not in mrx.lower(), 'and nothing a player received speaks of it')
        await gm.keyboard.press('x'); await gm.wait_for_timeout(300)
        left = await gm.evaluate("(() => { let n = 0; tw.worldOf(tw.area()).layers.deco.traverse(o => { if (o.userData.xray) n++; }); return [tw.xray(), tw.xrayInfo().pawns.length, n]; })()")
        check(left == [False, 0, 0], 'X again: off, and nothing of it is left in the scene', left)
        rows = await bar(gm, 'x-ray', enter=False); await gm.keyboard.press('Escape')
        check(any('Pawn X-ray' in r['t'] for r in rows), '"x-ray" in the command bar finds it', [r['t'][:50] for r in rows[:4]])

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
print(f"\nturns: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)

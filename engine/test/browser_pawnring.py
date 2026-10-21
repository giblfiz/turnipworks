#!/usr/bin/env python3
"""The pawn's ring (Harry 2026-10-06, docs/UI.md "Pawn ring"): turn · sheet · damage · menu, and what is behind each.

  local:  TW_GPU=1 python3 engine/test/browser_pawnring.py --local [--shots]

  RING    the closed ring is four items in order; a seat that does not own the pawn gets sheet · damage · menu; every
          closed button says its name on hover; the open circle's buttons carry their names in words
  DAMAGE  the handle's track: it starts at 0, a FIXED number of pixels per point on an unhurt and a hurt pawn, ticks
          every 5, no far end (it grows with the value); the readout "20 -> 27 (+7)"; release commits; never below 0;
          Shift goes to the fives; Escape cancels
  TYPED   a plain click opens the field: 7 and +7 take 7, -5 heals 5, =12 sets it; Enter applies, Escape cancels
  UNDO    "Brakka took 7 (14 damage) by Tobias · [Undo]" for the changer, the owner and the GM, never a fourth seat;
          quick changes are one line with the total; the owner may undo; a stale line is greyed with its reason; the
          relay refuses a fourth seat
  SHEET   the card: paste when empty, http/https only, a new tab, the host on hover; Notes shared; GM notes never reach
          a player seat (entity, and every byte the page received)
  MENU    each entry of the open ring: conditions, indicators (seen by another seat, cleared), raise / lower, hide,
          send to area: FIVE since the cuts of 2026-10-11. Off the ring: Delete (its key, and the "?" sheet says so),
          Duplicate (Ctrl/⌘+D). On the SHEET CARD: the pawn's name and who moves it (the GM picks). DROPPED: the pawn lock
  KEYS    = and - change a selected pawn's damage; [ and ] only step levels
"""
import argparse, asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18141,18771').split(','))  # TW_PORTS=a,b when another worktree is running this suite
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-pawnring-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])  # /tmp is RAM: both are removed at exit
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
RX = """(() => { window.__rx = [];
  const WS = window.WebSocket; window.WebSocket = class extends WS { constructor(...a) { super(...a); this.addEventListener('message', (ev) => { try { window.__rx.push(String(ev.data)); } catch { } }); } };
  const ES = window.EventSource; if (ES) window.EventSource = class extends ES { constructor(...a) { super(...a); this.addEventListener('message', (ev) => { try { window.__rx.push(String(ev.data)); } catch { } }); } };
  const F = window.fetch; window.fetch = async (...a) => { const r = await F(...a); try { const u = String(a[0]?.url || a[0]); if (/\\/(c|sse|a)\\//.test(u) && !/\\.(glb|png|webp|js|json)(\\?|$)/.test(u)) r.clone().text().then(t => window.__rx.push(t)).catch(() => {}); } catch { } return r; }; })()"""
CLOSED = "[...document.querySelectorAll('#ring .rbtn:not(.ex)')].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map(b => b.dataset.menu ? 'menu' : b.dataset.cmd)"
LINES = "[...document.querySelectorAll('#chat .line.act')].map(e => ({ id: e.dataset.act, text: e.querySelector('.atext').textContent, btn: e.querySelector('.abtn')?.textContent.replace('.', '') || null, off: !!e.querySelector('.abtn.off'), why: e.querySelector('.awhy')?.textContent || null, done: e.classList.contains('done') }))"
CHIPS = "tw.damageChips()"
MINUS = '−'; ARROW = '→'

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, reduced_motion='reduce'); await ctx.add_init_script(RX)  # (no slide: this suite does not test motion)
            await ctx.route('**/sheets.example.com/**', lambda r: r.fulfill(status=200, content_type='text/html', body='<title>sheet</title>sheet'))
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST pawn ring {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        # This suite exercises the open tabletop; vision fog has its own three-seat suite.
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
        await wait(gm, "tw.sync.campaign.defaults.fogOfWar === false && tw.sync.pendingCount() === 0", 15000, 'open-table fixture')
        seats = {}; pages = {'Harry': gm}
        for name in ('Tobias', 'Mira', 'Kit'):
            await gm.keyboard.press('/'); await gm.keyboard.type(f'invite {name}', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
            await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
            invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
            pg = await tab(invite + '&nofx'); pages[name] = pg
            await wait(pg, 'window.tw && tw.ready && tw.ready()', 45000, f'{name} joins'); seats[name] = await pg.evaluate('tw.me()')
        he, mi, kit = pages['Tobias'], pages['Mira'], pages['Kit']
        check(len(set(seats.values())) == 3, 'three player tabs joined (Tobias, Mira, Kit)')
        BR, GO, DR, GH = 'tok_brakka0001', 'tok_goblin0001', 'tok_dragon0001', 'tok_ghost00001'
        toks = [{'type': 'token.create', 'args': {'id': BR, 'name': 'Brakka', 'x': 12.5, 'z': 12.5, 'owner': seats['Mira'], 'damage': 7}},
                {'type': 'token.create', 'args': {'id': GO, 'name': 'Goblin', 'x': 27.5, 'z': 12.5}},
                {'type': 'token.create', 'args': {'id': DR, 'name': 'Dragon', 'x': 42.5, 'z': 12.5, 'damage': 20}},
                {'type': 'token.create', 'args': {'id': GH, 'name': 'Ghost', 'x': 57.5, 'z': 12.5}}]
        await gm.evaluate(f"tw.batch({json.dumps(toks)})")
        for pg in pages.values(): await wait(pg, f"{E(GH)} && tw.sync.pendingCount() === 0", 10000, 'pawns')
        AREA = await gm.evaluate('tw.area()')

        async def sel(pg, id, dist=95):  # (the ring is world-sized since 2026-10-20: framed like the play view, its ring is on screen and clear of the top bar)
            await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
            await pg.evaluate(f"(() => {{ const e = {E(id)}, g = tw.main.grab; g.focus.set(e.x, 0, e.z); g.yaw = 0; g.pitch = 52; g.dist = {dist}; g.update(); tw.main.rule = 'free'; tw.select('{id}'); }})()"); await pg.wait_for_timeout(600)
        async def at(pg, css):
            return await pg.evaluate(f"(() => {{ const r = document.querySelector('{css}').getBoundingClientRect(); return {{ x: r.left + r.width / 2, y: r.top + r.height / 2 }}; }})()")
        HPB = '#ring .rbtn[data-cmd=\\"pawn.damage\\"]'
        hp = lambda pg, id: pg.evaluate(f"{E(id)}?.damage || 0")  # a pawn's damage (0 = unhurt: the field is absent)
        async def quiet():  # no floating HP buttons, no action lines, anywhere
            for pg in pages.values(): await pg.evaluate("(() => { for (const b of tw.condButtons.list()) tw.condButtons.hide(b.key); tw.actionLines.clear(); })()")
        async def typed(pg, id, text, key='Enter'):
            await sel(pg, id); b = await at(pg, HPB); await pg.mouse.click(b['x'], b['y']); await wait(pg, '!!tw.ringDamageEdit()', 3000, 'damage field')
            await pg.keyboard.type(text, delay=15); st = await pg.evaluate('tw.ringDamageEdit()'); await pg.keyboard.press(key); await pg.wait_for_timeout(250); return st

        # ================= RING =================
        print('RING: the closed ring, and names')
        await sel(gm, BR)
        ring = await gm.evaluate(CLOSED)
        check(ring == ['edit.rotate', 'pawn.sheet', 'pawn.damage', 'menu'], 'GM, a pawn: the closed ring is exactly turn · sheet · damage · menu, in that order', ring)
        tips = {}
        for cmd in ('edit.rotate', 'pawn.sheet', 'pawn.damage'):
            b = await at(gm, f'#ring .rbtn[data-cmd=\\"{cmd}\\"]'); await gm.mouse.move(b['x'], b['y']); await gm.wait_for_timeout(120)
            tips[cmd] = await gm.evaluate(f"(() => {{ const el = document.querySelector('#ring .rbtn[data-cmd=\"{cmd}\"]'), s = getComputedStyle(el, '::after'); return [s.content, s.display !== 'none' && s.visibility !== 'hidden', el.matches(':hover')]; }})()")
        b = await at(gm, '#ring .rbtn[data-menu]'); await gm.mouse.move(b['x'], b['y']); await gm.wait_for_timeout(120)
        tips['menu'] = await gm.evaluate("(() => { const el = document.querySelector('#ring .rbtn[data-menu]'), s = getComputedStyle(el, '::after'); return [s.content, s.display !== 'none', el.matches(':hover')]; })()")
        # (the ring's label style decides HOW a name shows: "hover" = the tip at once on hover; the house ring's "over" /
        # "under" / "below" = the name drawn by every button all the time, so no tip is needed: 2026-10-20)
        mode = await gm.evaluate("tw.ringSettings().labelMode")
        drawn = await gm.evaluate("[...document.querySelectorAll('#ring > .rl-label-svg text, #ring > .rl-tip')].map(t => t.textContent.trim())")
        named = (tips['edit.rotate'][0] == '"Turn"' and tips['pawn.sheet'][0] == '"Sheet"' and tips['pawn.damage'][0] == '"Damage"' and tips['menu'][0] == '"All options"' and all(v[1] and v[2] for v in tips.values())) if mode == 'hover' else all(n in drawn for n in ('Turn', 'Sheet', 'Damage', 'All options'))
        check(named, f'each closed button says its name (label style "{mode}"): Turn, Sheet, Damage, All options', tips if mode == 'hover' else drawn)
        if A.shots: b = await at(gm, HPB); await gm.mouse.move(b['x'], b['y']); await gm.wait_for_timeout(200); await gm.screenshot(path=os.path.join(SHOTS, 'pawnring-closed.png'))
        await gm.mouse.move(5, 300)
        check(await gm.evaluate(f"document.querySelector('{HPB.replace(chr(92), '')} .badge')?.textContent") == '7' and await gm.evaluate(f"!('hp' in {E(BR)}) && !('hpMax' in {E(BR)})"), 'the damage button shows the pawn\'s damage (7); a pawn has no hit points')
        await sel(kit, BR); ring = await kit.evaluate(CLOSED)
        check(ring == ['pawn.sheet', 'pawn.damage', 'menu'], 'a player on someone else\'s pawn: sheet · damage · menu (no turn: not theirs to move)', ring)
        await sel(mi, BR); ring = await mi.evaluate(CLOSED)
        check(ring == ['edit.rotate', 'pawn.sheet', 'pawn.damage', 'menu'], 'the pawn\'s owner gets all four', ring)
        await sel(gm, BR); await gm.click('#ring .rbtn[data-menu]'); await gm.wait_for_timeout(350)
        menu = await gm.evaluate("tw.ringMenu().map(n => n.cmd || '▸' + n.group)")
        check(menu == ['▸pawn.cond.', '▸pawn.mark.', 'edit.lift', 'thing.hide', 'pawn.travel'], 'open, exactly (the cuts of 2026-10-11): Conditions ▸, Indicators ▸, raise / lower, hide, send to area', menu)
        # (2026-10-20: the names are drawn in the ring's label style from each button's data-tip, not in a .cap inside it)
        caps = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn.ex')].map(b => [b.dataset.tip || '', b.title || ''])")
        check(len(caps) == 5 and all(c[0] for c in caps) and [c[0] for c in caps] == ['Conditions', 'Indicators', 'Raise / lower', 'Hide from players', 'Send to area'], 'the open circle shows names, not only icons', [c[0] for c in caps])
        check(not any('HP' in c[0] or 'Damage' in c[0] or 'Delete' in c[0] or 'Lock' in c[0] or 'Duplicate' in c[0] for c in caps) and await gm.evaluate("!tw.registry.get('pawn.hp-5') && !tw.registry.get('pawn.hp+1') && !tw.registry.get('pawn.hp')"), 'no Delete, Lock or Duplicate on the ring; the four HP buttons are gone', caps)
        # Delete left the ring: its key must still be findable. The "?" sheet lists it, with the pawn selected.
        await gm.keyboard.press('Escape'); await gm.evaluate("tw.emit('sheet.toggle')"); await gm.wait_for_timeout(250)
        rows = await gm.evaluate("[...document.querySelectorAll('#sheet .row')].map(r => [r.querySelector('span').textContent, [...r.querySelectorAll('kbd')].map(k => k.textContent)])")
        dl = next((r for r in rows if r[0] == 'Delete'), None); du = next((r for r in rows if r[0] == 'Duplicate'), None)
        check(dl and any(k.lower() in ('del', 'delete') for k in dl[1]) and du and any('D' in k for k in du[1]), 'the "?" sheet still shows Delete with its key (and Duplicate with Ctrl/⌘+D): what left the ring is still discoverable', [dl, du])
        await gm.evaluate("tw.emit('sheet.toggle')"); await sel(gm, BR); await gm.click('#ring .rbtn[data-menu]'); await gm.wait_for_timeout(350)
        clipped = []
        for c in caps:
            el = f"#ring .rbtn.ex[data-tip=\\\"{c[0]}\\\"]"
            b = await at(gm, el); await gm.mouse.move(b['x'], b['y']); await gm.wait_for_timeout(120)
            got = await gm.evaluate(f"(() => {{ const el = document.querySelector('{el}'), s = getComputedStyle(el, '::after'); return [s.content, s.whiteSpace, el.matches(':hover')]; }})()")
            if got[0] != json.dumps(c[0]) or got[1] != 'nowrap' or not got[2]: clipped.append([c[0], got])
        await gm.mouse.move(5, 300)
        if mode != 'hover':  # (names drawn all the time: each one whole, as the label text)
            drawn = await gm.evaluate("[...document.querySelectorAll('#ring > .rl-label-svg text, #ring > .rl-tip')].map(t => t.textContent.trim())")
            clipped = [c[0] for c in caps if c[0] not in drawn]
        check(clipped == [], f'and every name is shown whole (label style "{mode}"; the whole name, none cut short)', clipped)
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'pawnring-open.png'))
        check(await gm.evaluate('tw.menuOrphans().length') == 0, 'no menu command is missing from the menu table')

        # ================= DAMAGE DRAG =================
        print('DAMAGE: the handle and its track')
        PX = await gm.evaluate('tw.ringDamage.px')
        STATE = "(() => { const d = tw.ringDrag(); return d && { ...d, readout: document.querySelector('#ring .readout')?.innerText || '' }; })()"
        async def grab(id):
            await sel(gm, id); b = await at(gm, HPB); await gm.mouse.move(b['x'], b['y']); await gm.mouse.down(); await gm.wait_for_timeout(120); return b
        async def slide(b, s, px, steps=8, shift=False):
            if shift: await gm.keyboard.down('Shift')
            for i in range(1, steps + 1): await gm.mouse.move(b['x'] + s['dir'][0] * px * i / steps, b['y'] + s['dir'][1] * px * i / steps); await gm.wait_for_timeout(25)
            await gm.wait_for_timeout(100)
            if shift: await gm.keyboard.up('Shift')
        dist = lambda a, c: ((a[0] - c[0]) ** 2 + (a[1] - c[1]) ** 2) ** 0.5
        spans = {}
        for id, name, d0, end in ((GO, 'goblin', 0, 20), (DR, 'dragon', 20, 40)):
            b = await grab(id); s = await gm.evaluate(STATE); t = s['track']
            check(s['kind'] == 'damage' and [m['label'] for m in t['marks']] == ['0 · unhurt'] and t['marks'][0]['v'] == 0 and t['min'] == 0, f'{name}: grabbing damage draws its track from 0, with ONE mark, at zero (no half, no max)', t['marks'])
            check(abs(dist(t['marks'][0]['at'], [b['x'], b['y']]) - d0 * PX) < 2 and dist(t['knob'], [b['x'], b['y']]) < 8, f'{name}: the zero mark is {d0} points inward of the handle; the dot is under the handle at {d0}', t['marks'][0]['at'])
            tv = [k['v'] for k in t['ticks']]
            check(all(v % 5 == 0 for v in tv) and len(tv) == end // 5 + 1 and t['max'] == end, f'{name}: ticks every 5; with no maximum the rail runs to the next ten past its damage + 10 ({end})', f"{len(tv)} ticks to {t['max']}")
            per = dist(t['ends'][0], t['ends'][1]) / end; spans[name] = per
            check(abs(per - PX) < 0.02, f'{name}: {PX} px per point', f'{per:.3f} px/pt')
            await slide(b, s, 7 * PX); s1 = await gm.evaluate(STATE)
            want = f'{d0} {ARROW} {d0 + 7} (+7) damage'
            check(s1['damage'] == d0 + 7 and s1['readout'] == want, f'{name}: the SAME drag ({7 * PX} px outward) is 7 damage; the readout shows the change and the total', s1['readout'])
            if A.shots and name == 'dragon': await gm.screenshot(path=os.path.join(SHOTS, 'pawnring-damage-track.png'))
            await gm.mouse.up(); await wait(gm, f"{E(id)}.damage === {d0 + 7} && tw.sync.pendingCount() === 0", 6000, 'committed')
            check(await hp(gm, id) == d0 + 7 and await hp(kit, id) == d0 + 7 and (await gm.evaluate('tw.ringDragLast'))['committed'], f'{name}: release commits it, for every seat', await hp(kit, id))
        check(abs(spans['goblin'] - spans['dragon']) < 0.02, 'the track is the same pixels per point on an unhurt pawn and a hurt one', spans)
        b = await grab(DR); s = await gm.evaluate(STATE); await slide(b, s, -4 * PX); s1 = await gm.evaluate(STATE)
        check(s1['readout'] == f'27 {ARROW} 23 ({MINUS}4) damage', 'inward heals: "27 -> 23 (-4) damage"', s1['readout'])
        await slide(b, s, -4 * PX, steps=2, shift=True); s2 = await gm.evaluate(STATE)
        check(s2['damage'] == 25, 'Shift goes to the fives', s2['damage'])
        await slide(b, s, -60 * PX, steps=6); s3 = await gm.evaluate(STATE)
        check(s3['damage'] == 0 and s3['readout'] == f'27 {ARROW} 0 ({MINUS}27) damage', 'it stops at zero: damage never goes below 0', s3['readout'])
        await slide(b, s, 40 * PX, steps=8); s4 = await gm.evaluate(STATE)
        check(s4['damage'] == 67 and s4['track']['max'] == 80 and await gm.evaluate("document.querySelectorAll('#ring .rtrack').length") == 1, 'there is no far end: dragged past it, the rail grows with the value (67 damage, rail to 80), one track drawn', [s4['damage'], s4['track']['max']])
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150); await gm.mouse.up(); await gm.wait_for_timeout(300)
        check(await hp(gm, DR) == 27 and not (await gm.evaluate('tw.ringDragLast'))['committed'], 'Escape during the drag changes nothing', await hp(gm, DR))
        # a player who does not own it can drag it too
        await sel(kit, DR); b = await at(kit, HPB); await kit.mouse.move(b['x'], b['y']); await kit.mouse.down(); await kit.wait_for_timeout(120)
        s = await kit.evaluate(STATE)
        for i in range(1, 7): await kit.mouse.move(b['x'] + s['dir'][0] * 3 * PX * i / 6, b['y'] + s['dir'][1] * 3 * PX * i / 6); await kit.wait_for_timeout(25)
        await kit.mouse.up(); ok = await wait(gm, f"{E(DR)}.damage === 30", 6000, 'kit hits the dragon')
        check(ok, 'everyone can change everyone\'s damage: a player drags the GM\'s dragon from 27 to 30', await hp(gm, DR))

        # ================= TYPED =================
        print('TYPED: a plain click opens the field')
        D = lambda n: f"({E(BR)}.damage || 0) === {n}"
        await quiet()
        st = await typed(gm, BR, '7'); await wait(gm, D(14), 5000)
        check(st and st['hint'] == f'7 {ARROW} 14 (+7)' and st['now'] == '7 damage' and await hp(gm, BR) == 14 and await gm.evaluate('!tw.ringDamageEdit()'), '"7" and Enter takes 7 (the field shows "7 -> 14 (+7)" as you type)', st)
        await typed(gm, BR, '+3'); await wait(gm, D(17), 5000); check(await hp(gm, BR) == 17, '"+3" takes 3 as well', await hp(gm, BR))
        await typed(gm, BR, '-5'); await wait(gm, D(12), 5000); check(await hp(gm, BR) == 12, '"-5" heals 5', await hp(gm, BR))
        await typed(gm, BR, '=20'); await wait(gm, D(20), 5000); check(await hp(gm, BR) == 20, '"=20" sets it to 20', await hp(gm, BR))
        await typed(gm, BR, '-99'); await wait(gm, D(0), 5000)
        check(await hp(gm, BR) == 0 and await gm.evaluate(f"!('damage' in {E(BR)})"), 'healing more than there is stops at 0: unhurt, and the pawn carries no damage at all', await hp(gm, BR))
        st = await typed(gm, BR, '2', key='Escape'); await gm.wait_for_timeout(300)
        check(st['now'] == 'No damage' and await hp(gm, BR) == 0 and await gm.evaluate('!tw.ringDamageEdit()') and await gm.evaluate(f"tw.sel.has('{BR}')"), 'Escape cancels: nothing changes, the field goes, the pawn stays selected', st)
        st = await typed(gm, BR, 'lots'); bad = await gm.evaluate('tw.ringDamageEdit()')
        check(bad and bad['bad'] and await hp(gm, BR) == 0, 'nonsense is refused and the field stays', bad); await gm.keyboard.press('Escape')
        st = await typed(kit, BR, '2'); await wait(gm, D(2), 5000)
        check(await hp(gm, BR) == 2, 'a player types "2" on someone else\'s pawn', await hp(gm, BR))
        await typed(gm, BR, '=7'); await wait(kit, D(7), 5000)

        # ================= UNDO =================
        print('UNDO: who gets the line, merging, stale')
        await gm.wait_for_timeout(2800); await quiet()
        for pg in pages.values(): await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
        await typed(he, BR, '7'); await wait(gm, D(14), 5000); await gm.wait_for_timeout(400)
        chips = {n: await pg.evaluate(CHIPS) for n, pg in pages.items()}
        want = 'Undo: Brakka took 7 (14 damage) by Tobias'
        check(all(len(chips[n]) == 1 and chips[n][0]['text'] == want for n in ('Tobias', 'Mira', 'Harry')), 'Tobias takes 7 from Mira\'s Brakka: the changer, the owner and the GM each get the undo beside the pawn', {n: [c['text'] for c in v] for n, v in chips.items()})
        check(chips['Kit'] == [], 'a fourth seat gets none')
        if A.shots: await mi.screenshot(path=os.path.join(SHOTS, 'pawnring-undo-float.png'))
        for pg in (he, mi, gm): await pg.evaluate("for (const b of tw.damageChips()) tw.condButtons.expire(b.key)")
        for pg in (he, mi, gm): await wait(pg, "tw.damageChips().length === 0 && document.querySelector('#chat .line.act:not(.pending)')", 6000, 'line landed')
        await gm.wait_for_timeout(700)
        lines = {n: await pg.evaluate(LINES) for n, pg in pages.items()}
        check(all(len(lines[n]) == 1 and lines[n][0]['text'] == 'Brakka took 7 (14 damage) by Tobias' and lines[n][0]['btn'] == 'Undo' and not lines[n][0]['off'] for n in ('Tobias', 'Mira', 'Harry')), 'its time up, it goes down into the chat of those three: "Brakka took 7 (14 damage) by Tobias · [Undo]"', lines)
        check(lines['Kit'] == [], 'the fourth seat\'s chat has no such line')
        if A.shots: await mi.screenshot(path=os.path.join(SHOTS, 'pawnring-undo-line.png'))
        seq = await gm.evaluate("tw.view().seq")
        r = await kit.evaluate(f"tw.await(tw.sync.submitRaw({{ type: 'undo', area: '{AREA}', args: {{ who: '{seats['Tobias']}', seq: {seq} }} }})).then(m => !!m)")
        await kit.wait_for_timeout(300)
        check(r is False and await hp(gm, BR) == 14, 'the relay refuses the fourth seat\'s attempt to undo it by number', r)
        await mi.click('#chat .line.act .abtn'); ok = await wait(gm, D(7), 6000, 'owner undo')
        check(ok, 'the OWNER presses Undo on her line: Brakka is back at 7 damage')
        await gm.wait_for_timeout(500)
        lines = {n: await pg.evaluate(LINES) for n, pg in pages.items()}
        check(lines['Mira'][0]['done'] and all(lines[n][0]['off'] and lines[n][0]['why'] == 'already undone' for n in ('Tobias', 'Harry')), 'her line is marked done; the other two grey out with "already undone"', lines)
        h0 = await hp(gm, BR); await gm.click('#chat .line.act .abtn', force=True); await gm.wait_for_timeout(500)
        check(await hp(gm, BR) == h0, 'pressing a greyed Undo does nothing')
        # merging
        await quiet()
        await he.evaluate(f"(async () => {{ tw.damageDelta([{E(BR)}], 3); await new Promise(r => setTimeout(r, 500)); tw.damageDelta([{E(BR)}], 4); }})()")
        await wait(gm, D(14), 6000); await gm.wait_for_timeout(400)
        chips = {n: await pg.evaluate(CHIPS) for n, pg in pages.items()}
        check(all(len(chips[n]) == 1 and chips[n][0]['text'] == want and len(chips[n][0]['seqs']) == 2 for n in ('Tobias', 'Mira', 'Harry')), 'two quick changes by one seat to one pawn (3, then 4) are ONE button with the total: took 7 (14 damage)', {n: [(c['text'], c['seqs']) for c in v] for n, v in chips.items()})
        await gm.wait_for_timeout(2700)
        await he.evaluate(f"tw.damageDelta([{E(BR)}], 1)"); await wait(gm, D(15), 6000); await gm.wait_for_timeout(900)
        chips = await mi.evaluate(CHIPS); lines = await mi.evaluate(LINES)
        check(len(chips) == 1 and chips[0]['text'] == 'Undo: Brakka took 1 (15 damage) by Tobias' and len(lines) == 1 and lines[0]['text'] == 'Brakka took 7 (14 damage) by Tobias', 'a change a few seconds later is its own button; the earlier one goes down into the chat with its total', [chips, lines])
        check(lines[0]['off'] and lines[0]['why'] == 'changed since', 'that older line is now stale: greyed, "changed since" (undoing it would overwrite the newer change)', lines)
        # the floating button itself, pressed by the GM
        await gm.evaluate("document.querySelector('#undoChips .dmgchip').click()"); ok = await wait(gm, D(14), 6000, 'gm presses the float')
        check(ok, 'the GM presses the floating Undo: the 1 is taken back')
        await gm.wait_for_timeout(1300); await quiet()
        # a merged line undoes every change it names
        await he.evaluate(f"(async () => {{ tw.damageDelta([{E(BR)}], -2); await new Promise(r => setTimeout(r, 400)); tw.damageDelta([{E(BR)}], -2); }})()"); await wait(gm, D(10), 6000); await gm.wait_for_timeout(300)
        healed = await he.evaluate(CHIPS)
        check(len(healed) == 1 and healed[0]['text'] == 'Undo: Brakka healed 4 (10 damage) by Tobias', 'healing reads "Brakka healed 4 (10 damage) by Tobias"', healed)
        await he.evaluate("for (const b of tw.damageChips()) tw.condButtons.expire(b.key)"); await wait(he, "document.querySelector('#chat .line.act:not(.pending) .abtn')", 6000); await he.wait_for_timeout(600)
        await he.click('#chat .line.act .abtn'); ok = await wait(gm, D(14), 8000, 'merged undo')
        check(ok, 'Undo on a merged line (healed 2, healed 2) takes back both: 10 -> 14', await hp(gm, BR))
        await typed(gm, BR, '=7'); await gm.wait_for_timeout(300); await quiet()

        # ================= SHEET =================
        print('SHEET: the card')
        SECRET, SHARED = 'ZXQ-secret-lair-7731', 'ZXQ-shared-fears-fire-4402'
        SB = '#ring .rbtn[data-cmd=\\"pawn.sheet\\"]'
        FLY = 'tw.ringFlyout()'
        await sel(gm, BR); b = await at(gm, SB); await gm.mouse.click(b['x'], b['y']); await gm.wait_for_timeout(350)
        f = await gm.evaluate(FLY)
        check(f and f['group'] == 'sheet' and f['anchorIs'] == 'sheet' and f['sheet']['paste'] and f['sheet']['link'] is None and f['sheet']['tabs'] == ['notes', 'gm'], 'one click on Sheet opens the card at its button; with no link yet it is where you paste one; two tabs', f and f['sheet'])
        for bad_url in ('javascript:alert(1)', 'ftp://sheets.example.com/a', 'data:text/html,hi', 'file:///etc/passwd'):
            await gm.fill('.flyout.sheet .sh-url', bad_url); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(200)
            f = await gm.evaluate(FLY)
            check(f['sheet']['error'] and f['sheet']['paste'] and await gm.evaluate(f"!{E(BR)}.sheet"), f'not accepted as a sheet link: {bad_url}', f['sheet']['error'])
        await gm.fill('.flyout.sheet .sh-url', 'sheets.example.com/characters/42'); await gm.keyboard.press('Enter'); await wait(gm, f"{E(BR)}.sheet", 5000); await gm.wait_for_timeout(300)
        f = await gm.evaluate(FLY)
        check(await gm.evaluate(f"{E(BR)}.sheet") == 'https://sheets.example.com/characters/42' and f['sheet']['link'] == 'https://sheets.example.com/characters/42' and not f['sheet']['paste'], 'an ordinary web link is kept (https:// added to a bare address) and shown as the large link', f['sheet'])
        check(f['sheet']['target'] == '_blank' and 'noopener' in f['sheet']['rel'] and f['sheet']['host'] == 'sheets.example.com', 'the link opens a new tab (noopener) and knows its site', f['sheet'])
        await gm.hover('.flyout.sheet .sheetlink'); await gm.wait_for_timeout(150)
        tip = await gm.evaluate("getComputedStyle(document.querySelector('.flyout.sheet .sheetlink'), '::after').content")
        check(tip == '"sheets.example.com"', 'hovering the link shows the site\'s host name', tip)
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'pawnring-sheet.png'))
        game_url = gm.url
        async with gm.context.expect_page(timeout=8000) as pop:
            await gm.click('.flyout.sheet .sheetlink')
        newp = await pop.value; await newp.wait_for_load_state('domcontentloaded')
        check(newp.url == 'https://sheets.example.com/characters/42' and len(gm.context.pages) == 2 and gm.url == game_url, 'clicking it opens the sheet in a NEW tab; the game stays where it is', newp.url); await newp.close()
        await gm.fill('.flyout.sheet .sh-notes', SHARED); await gm.click('.flyout.sheet .sh-tabs [data-tab=gm]'); await gm.wait_for_timeout(200)
        await gm.fill('.flyout.sheet .sh-notes', SECRET); await gm.wait_for_timeout(1600)
        ok = await wait(gm, f"{E(BR)}.gmNotes === '{SECRET}' && {E(BR)}.notes === '{SHARED}' && tw.sync.pendingCount() === 0", 6000, 'notes saved')
        check(ok, 'Notes and GM notes are saved from the two tabs (leaving a tab, and a moment after typing)')
        await typed(he, BR, '1'); await gm.wait_for_timeout(600)
        f = await gm.evaluate(FLY)
        check(f and f['group'] == 'sheet' and f['sheet']['tab'] == 'gm' and f['sheet']['text'] == SECRET, 'the card stays open, on its tab, when someone else changes the pawn\'s damage under it', f and f['sheet'])
        await typed(gm, BR, '=7'); await gm.wait_for_timeout(300)
        await wait(kit, f"{E(BR)}.notes === '{SHARED}'", 6000)
        check(all([await pg.evaluate(f"{E(BR)}.notes === '{SHARED}' && !('gmNotes' in {E(BR)})") for pg in (he, mi, kit)]), 'every player seat has the shared Notes, and no GM notes on the pawn at all')
        # more ways the GM note could travel: an undo of it, a duplicate of the pawn, hiding and revealing it, a fresh join
        await gm.evaluate(f"tw.dispatch('token.set', {{ id: '{BR}', gmNotes: '{SECRET} second' }})"); await gm.wait_for_timeout(300); await gm.evaluate("tw.undo()"); await gm.wait_for_timeout(400)
        await gm.evaluate(f"tw.dispatch('token.set', {{ id: '{BR}', gmNotes: '{SECRET}', name: 'Brakka' }})"); await gm.wait_for_timeout(300)
        await gm.evaluate(f"tw.flag(['{BR}'], {{ hidden: true }})"); await gm.wait_for_timeout(400); await gm.evaluate(f"tw.flag(['{BR}'], {{ hidden: false }})"); await gm.wait_for_timeout(400)
        await kit.reload(); await wait(kit, f'window.tw && tw.ready && tw.ready() && {E(BR)}', 45000, 'kit back'); await kit.wait_for_timeout(800)
        rx = {n: await pg.evaluate(f"(() => {{ const t = window.__rx.join('\\n'); return [t.length, t.includes('{SHARED}'), t.includes('{SECRET}'), t.includes('gmNotes')]; }})()") for n, pg in pages.items()}
        check(all(rx[n][0] > 2000 and rx[n][1] and not rx[n][2] and not rx[n][3] for n in ('Tobias', 'Mira', 'Kit')), 'in everything a player\'s page RECEIVED from the relay (owner included; live, after an undo, a hide and reveal, and a fresh load): the shared note is there, the GM note and the very field name are not', rx)
        check(rx['Harry'][2], '(the GM\'s page did receive it: the capture works)', rx['Harry'])
        await sel(kit, BR); b = await at(kit, SB); await kit.mouse.click(b['x'], b['y']); await kit.wait_for_timeout(350)
        f = await kit.evaluate(FLY)
        check(f and f['sheet']['tabs'] == ['notes'] and f['sheet']['text'] == SHARED and not f['sheet']['editable'] and f['sheet']['link'] and not f['sheet']['paste'] and await kit.evaluate("!document.querySelector('.flyout.sheet .sh-change')"), 'a player who does not own the pawn: the link, the Notes to read, no GM tab, nothing to edit', f and f['sheet'])
        await kit.keyboard.press('Escape')
        await sel(mi, BR); b = await at(mi, SB); await mi.mouse.click(b['x'], b['y']); await mi.wait_for_timeout(350)
        f = await mi.evaluate(FLY)
        check(f and f['sheet']['tabs'] == ['notes'] and f['sheet']['editable'], 'its owner may write the Notes (and still has no GM tab)', f and f['sheet'])
        await mi.fill('.flyout.sheet .sh-notes', SHARED + ' (and spiders)'); await mi.keyboard.press('Escape'); ok = await wait(gm, f"{E(BR)}.notes.endsWith('(and spiders)')", 6000, 'owner note')
        check(ok and await gm.evaluate(f"{E(BR)}.gmNotes === '{SECRET}'"), 'what the owner wrote is saved when the card closes, and the GM\'s note is untouched by it')
        await gm.keyboard.press('Escape')

        # ================= MENU =================
        print('MENU: each entry')
        async def open_menu(pg, id):
            await sel(pg, id); await pg.click('#ring .rbtn[data-menu]'); await pg.wait_for_timeout(350)
        NEST = '#ring .rbtn[data-nest][data-cmd="%s"]'  # an item of an open sub-menu (the grown ring, 2026-10-20)
        async def press(pg, what):  # a top-level entry by command id or group
            await pg.click(f'#ring .rbtn.ex[data-cmd="{what}"], #ring .rbtn.ex[data-group="{what}"]'); await pg.wait_for_timeout(350)
        await open_menu(gm, BR); await press(gm, 'pawn.cond.')
        f = await gm.evaluate(FLY)
        check(f and f['group'] == 'pawn.cond.' and f.get('nest') and f['anchorIs'] == 'pawn.cond.' and 'pawn.cond.prone' in f['tiles'] and len(f['tiles']) == 10 and await gm.evaluate("tw.ringState() === 'nested' && document.querySelectorAll('#ring .rbtn[data-nest][data-group=\"pawn.cond.\"]').length === 10"), 'Conditions ▸ opens the list of conditions as the grown ring, from its button', f and f['tiles'])
        await gm.click(NEST % 'pawn.cond.prone'); ok = await wait(kit, f"({E(BR)}.conditions || []).includes('prone')", 5000)
        check(ok, 'choosing one sets it, for every seat')
        await open_menu(gm, BR); await press(gm, 'pawn.mark.')
        f = await gm.evaluate(FLY)
        check(f and f['tiles'] == ['pawn.mark.' + k for k in ('star', 'circle', 'diamond', 'triangle', 'moon', 'square', 'cross', 'skull')], 'Indicators ▸ lists the eight markers', f and f['tiles'])
        await gm.wait_for_function("[...document.querySelectorAll('#ring .rbtn[data-nest] img')].every(i => i.complete)", timeout=5000)
        pics = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn[data-nest]')].map(b => [b.querySelector('img')?.naturalWidth || 0, b.dataset.tip])")
        check(all(p_[0] > 0 for p_ in pics) and [p_[1] for p_ in pics] == ['Star', 'Circle', 'Diamond', 'Triangle', 'Moon', 'Square', 'Cross', 'Skull'], 'each with its picture and its name', pics)
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'pawnring-indicators.png'))
        await gm.click(NEST % 'pawn.mark.skull'); ok = await wait(kit, f"{E(BR)}.mark === 'skull'", 5000); await kit.wait_for_timeout(500)
        mk = await kit.evaluate(f"tw.worldOf(tw.area()).markOf('{BR}')")
        check(ok and mk and mk['mark'] == 'skull' and mk['visible'], 'a second seat sees the skull floating over the pawn', mk)
        if A.shots:
            await kit.keyboard.press('Escape'); await kit.keyboard.press('Escape'); await kit.evaluate(f"(() => {{ const e = {E(GO)}, g = tw.main.grab; g.focus.set(e.x, 0, e.z); g.yaw = 0; g.pitch = 52; g.dist = 95; g.update(); tw.main.rule = 'free'; tw.select([]); }})()"); await kit.wait_for_timeout(700)
            await kit.screenshot(path=os.path.join(SHOTS, 'pawnring-mark-table.png'))
        await open_menu(kit, GO)
        menu = await kit.evaluate("tw.ringMenu().map(n => n.cmd || '▸' + n.group)")
        check(menu == ['▸pawn.mark.'], 'a player on a pawn that is not theirs: the menu holds Indicators ▸ and nothing else', menu)
        await press(kit, 'pawn.mark.'); await kit.click(NEST % 'pawn.mark.star'); ok = await wait(gm, f"{E(GO)}.mark === 'star'", 5000)
        check(ok, 'and may point at it: the goblin gets a star, seen by the GM')
        await open_menu(gm, BR); await press(gm, 'pawn.mark.')
        f = await gm.evaluate(FLY)
        check(f and f['tiles'][-1] == 'pawn.mark.none', 'a marked pawn\'s list ends with Clear', f and f['tiles'])
        await gm.click(NEST % 'pawn.mark.none'); ok = await wait(kit, f"!{E(BR)}.mark", 5000); await kit.wait_for_timeout(300)
        check(ok and await kit.evaluate(f"tw.worldOf(tw.area()).markOf('{BR}')") is None, 'Clear removes it for every seat')
        await open_menu(gm, BR)
        check(await gm.evaluate("!!document.querySelector('#ring .rbtn.ex.drag[data-cmd=\"edit.lift\"]')"), 'Raise / lower is there, a drag button as before')
        # ---- THE SHEET CARD holds the pawn's NAME and WHO MOVES IT (2026-10-11: they left the ring) ----
        await sel(gm, BR); b = await at(gm, SB); await gm.mouse.click(b['x'], b['y']); await gm.wait_for_timeout(350)
        f = await gm.evaluate(FLY)
        check(f and f['sheet']['name'] == 'Brakka' and f['sheet']['owner'] == seats['Mira'] and set(f['sheet']['owners']) == {*seats.values(), await gm.evaluate('tw.me()'), ''}, 'the GM\'s sheet card: a Name field holding the name, and "Moved by": the people at the table and No one, the owner chosen', f and f['sheet'])
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'pawnring-sheet-who.png'))
        await gm.fill('.flyout.sheet .sh-name', 'Brakka the Bold'); await gm.keyboard.press('Enter'); ok2 = await wait(kit, f"{E(BR)}.name === 'Brakka the Bold'", 5000); await gm.wait_for_timeout(300)
        f = await gm.evaluate(FLY)
        check(ok2 and f and f['sheet']['name'] == 'Brakka the Bold' and await gm.evaluate("document.querySelector('.flyout.sheet header span').textContent") == 'Brakka the Bold', 'Name: typed on the card, Enter saves; a second seat sees it; the card stays open with the new name', f and f['sheet']['name'])
        await gm.fill('.flyout.sheet .sh-name', 'Oops'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(400)
        check(await gm.evaluate(f"{E(BR)}.name") == 'Brakka the Bold' and await gm.evaluate('!tw.ringFlyout()'), 'Escape in the name field puts the old name back (and closes the card): nothing is sent')
        await sel(gm, BR); b = await at(gm, SB); await gm.mouse.click(b['x'], b['y']); await gm.wait_for_timeout(350)
        await gm.fill('.flyout.sheet .sh-name', '   '); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(400)
        check(await gm.evaluate(f"{E(BR)}.name") == 'Brakka the Bold', 'an empty name is not saved')
        await gm.keyboard.press('Escape'); await sel(gm, BR); await gm.keyboard.press('F2'); await gm.wait_for_timeout(400)
        check(await gm.evaluate("!!tw.ringFlyout()?.sheet && document.activeElement?.classList.contains('sh-name')"), 'F2 on a pawn opens its sheet card with the caret in the name')
        await gm.keyboard.press('Escape')
        await sel(mi, BR); b = await at(mi, SB); await mi.mouse.click(b['x'], b['y']); await mi.wait_for_timeout(350); fm = await mi.evaluate(FLY)
        await sel(kit, BR); b = await at(kit, SB); await kit.mouse.click(b['x'], b['y']); await kit.wait_for_timeout(350); fk = await kit.evaluate(FLY)
        check(fm and fm['sheet']['name'] == 'Brakka the Bold' and fm['sheet']['owner'] is None and fm['sheet']['ownedBy'] == 'Mira' and fk and fk['sheet']['name'] is None and fk['sheet']['owner'] is None and fk['sheet']['ownedBy'] == 'Mira', 'the pawn\'s owner may rename it on her card and reads who moves it (no list: giving control is the GM\'s); another player has neither field, and reads "Moved by Mira"', {'owner': fm and fm['sheet'], 'other': fk and fk['sheet']})
        await mi.fill('.flyout.sheet .sh-name', 'Brakka'); await mi.keyboard.press('Enter'); ok = await wait(gm, f"{E(BR)}.name === 'Brakka'", 5000)
        await mi.keyboard.press('Escape'); await kit.keyboard.press('Escape'); await sel(mi, BR); await mi.keyboard.press('F2'); await mi.keyboard.press('Control+a'); await mi.keyboard.type('Brakka the Bold', delay=10); await mi.keyboard.press('Enter'); ok2 = await wait(gm, f"{E(BR)}.name === 'Brakka the Bold'", 5000); await mi.keyboard.press('Escape')
        check(ok and ok2, 'the owner renames her pawn on the card, and by F2, type, Enter')
        # ---- THE PAWN LOCK IS DROPPED: no control, no command, and the relay refuses one sent by hand ----
        await sel(gm, BR)
        avail = await gm.evaluate("(() => { const R = tw.registry, ctx = R.ctx(); return R.available(ctx).filter(c => c.id === 'thing.lock' && R.isEnabled(c, ctx)).length; })()")
        await gm.evaluate(f"tw.flag(['{BR}'], {{ locked: true }})"); await gm.wait_for_timeout(900)
        toast = await gm.evaluate("document.querySelector('#toast').textContent")
        check(avail == 0 and await gm.evaluate(f"{E(BR)}.locked") is False and 'cannot be locked' in toast, 'a pawn has no Lock: not on the ring, not a command for it, and a lock sent by hand is refused with the reason', toast)
        p0 = await mi.evaluate(f"[{E(BR)}.x, {E(BR)}.z]"); await sel(mi, BR); await mi.keyboard.press('ArrowRight'); okm = await wait(gm, f"{E(BR)}.x !== {p0[0]}", 5000); await mi.keyboard.press('ArrowLeft'); await wait(gm, f"{E(BR)}.x === {p0[0]}", 5000)
        check(okm, 'and its owner moves it (arrow nudge), as ever')
        await open_menu(gm, BR); await press(gm, 'thing.hide'); ok = await wait(kit, f"!{E(BR)}", 5000)
        await open_menu(gm, BR); await press(gm, 'thing.hide'); ok2 = await wait(kit, f"!!{E(BR)}", 5000)
        check(ok and ok2, 'Hide from players takes it off a player\'s table; Reveal brings it back')
        n0 = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').length")
        await sel(gm, BR); await gm.keyboard.press('Control+d'); await wait(gm, f"Object.values(tw.entities()).filter(e => e.kind === 'token').length === {n0 + 1} && tw.sync.pendingCount() === 0", 6000)
        dup = await gm.evaluate(f"(() => {{ const d = Object.values(tw.entities()).find(e => e.kind === 'token' && e.name === 'Brakka the Bold' && e.id !== '{BR}'); return d && {{ id: d.id, hp: d.damage, sheet: d.sheet, notes: d.notes, gm: d.gmNotes, cond: d.conditions }}; }})()")
        check(dup and dup['hp'] == 7 and dup['sheet'] and dup['gm'] == SECRET and dup['cond'] == ['prone'], 'Duplicate (Ctrl/⌘+D now: it left the ring) makes a second one with its damage, conditions, sheet link and notes', dup)
        await kit.wait_for_timeout(500)
        check(await kit.evaluate(f"!!{E(dup['id'])} && !('gmNotes' in {E(dup['id'])}) && !window.__rx.join('').includes('{SECRET}')"), 'the copy reaches a player without the GM note')
        await sel(gm, dup['id']); b = await at(gm, SB); await gm.mouse.click(b['x'], b['y']); await gm.wait_for_timeout(350)
        f = await gm.evaluate(FLY)
        check(f and f['group'] == 'sheet' and set(f['sheet']['owners']) == {*seats.values(), await gm.evaluate('tw.me()'), ''}, 'Give control is "Moved by" on the sheet card: the people at the table, and no one', f and f['sheet'])
        await gm.select_option('.flyout.sheet .sh-owner', seats['Tobias']); ok = await wait(he, f"{E(dup['id'])}.owner === '{seats['Tobias']}'", 5000); await gm.wait_for_timeout(300)
        f = await gm.evaluate(FLY)
        check(ok and f and f['sheet']['owner'] == seats['Tobias'] and f['sheet']['ownedBy'] == 'Tobias', 'choosing Tobias gives him the pawn (token.owner); the card stays open and says so', f and f['sheet'])
        await gm.select_option('.flyout.sheet .sh-owner', ''); okn = await wait(he, f"!{E(dup['id'])}.owner", 5000); await gm.keyboard.press('Control+z'); oku = await wait(he, f"{E(dup['id'])}.owner === '{seats['Tobias']}'", 5000)
        check(okn and oku, '"No one (the GM moves it)" takes it back; undo gives it to Tobias again')
        await gm.keyboard.press('Escape'); await gm.keyboard.press('/'); await gm.keyboard.type('give control', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(400)
        check(await gm.evaluate("!!tw.ringFlyout()?.sheet && document.activeElement?.classList.contains('sh-owner')"), '"give control" in the command bar opens the card on that list')
        await gm.keyboard.press('Escape')
        await sel(he, dup['id']); ring = await he.evaluate(CLOSED)
        check(ok and ring == ['edit.rotate', 'pawn.sheet', 'pawn.damage', 'menu'], 'given to Tobias, it is his: his ring on it has all four', ring)
        await sel(gm, dup['id']); await gm.keyboard.press('/'); await gm.keyboard.type('delete', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter'); ok = await wait(kit, f"!{E(dup['id'])}", 5000)
        await gm.keyboard.press('Control+z'); oku = await wait(kit, f"!!{E(dup['id'])}", 5000); await wait(gm, f"!!{E(dup['id'])}", 5000, 'back on the GM tab'); await sel(gm, dup['id']); await gm.keyboard.press('Delete'); ok2 = await wait(kit, f"!{E(dup['id'])}", 5000)
        check(ok and oku and ok2, 'Delete from the command bar removes it; undo brings it back; the Delete key removes it again')
        await sel(gm, GH); await gm.keyboard.press('Delete'); ok = await wait(kit, f"!{E(GH)}", 5000)
        check(ok, 'the Delete key is the one-key kill')

        # ================= KEYS =================
        print('KEYS: = and - for damage; [ and ] only levels')
        await quiet(); await sel(gm, GO); h0 = await hp(gm, GO); lv0 = await gm.evaluate('tw.level || 0')
        await gm.keyboard.press('='); await gm.keyboard.press('='); await wait(gm, f"({E(GO)}.damage || 0) === {h0 + 2}", 5000); up = await hp(gm, GO)
        await gm.keyboard.press('-'); await wait(gm, f"({E(GO)}.damage || 0) === {h0 + 1}", 5000); dn = await hp(gm, GO)
        check(up == h0 + 2 and dn == h0 + 1, 'with a pawn selected, = adds one damage and - removes one', [h0, up, dn])
        await gm.keyboard.press(']'); await gm.wait_for_timeout(450); lv1 = await gm.evaluate('tw.level || 0'); h1 = await hp(gm, GO)
        await gm.keyboard.press('['); await gm.wait_for_timeout(450); lv2 = await gm.evaluate('tw.level || 0'); h2 = await hp(gm, GO)
        check(lv1 > lv0 and lv2 == lv0 and h1 == dn and h2 == dn, '] and [ step the level even with a pawn selected, and never touch its damage', [lv0, lv1, lv2, h1, h2])
        keys = await gm.evaluate("[tw.registry.get('pawn.damageUp').keys, tw.registry.get('pawn.damageDown').keys, tw.registry.get('level.up').keys, tw.registry.get('level.down').keys]")
        check(keys == [['='], ['-'], [']'], ['[']], 'the keys as registered', keys)
        lab = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); return [w.recs.get('{GO}').labelKey, w.recs.get('{DR}').labelKey, w.recs.get('{BR}').labelKey]; }})()")
        check(lab[0].startswith(f'Goblin  {dn} dmg|') and lab[1].startswith('Dragon  30 dmg|'), 'over the pawn: its name and its damage ("Goblin  8 dmg"); no bar, no maximum', lab)

        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for pr in procs:
        try: pr.wait(timeout=5)
        except Exception: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\npawnring: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)

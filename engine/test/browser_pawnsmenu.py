#!/usr/bin/env python3
"""The Pawns menu (Harry and Fauna 2026-10-06, docs/PAWNS.md), and hold / tap / pin on all three launchers.

  local:  TW_GPU=1 python3 engine/test/browser_pawnsmenu.py --local [--shots] [--only TRAY,PARTY]
          TW_PORTS=18163,18793 when another worktree is running this suite

  TRAY    hold = shown while held, tap = stays until tap or Esc (or a click outside), pin = stays while working on the
          map; the same for Build and Settings; a pinned menu takes letters only under the pointer
  PARTY   one wide row per player: portrait (the figure's thumbnail; a click goes to the pawn), names, damage number,
          conditions, the indicator, pets as smaller portraits, action icons with hover names; the GM's chores; rows
          group by area when the party is split; drag = marching order; party notes; follow; whisper (and, from the
          traffic every other tab received, that a whisper reaches nobody else)
  MINE    my pawns, my bench (bring on, send back), "New pawn" -> Settings > Me > My pawns (define, edit, forget)
  TREE    placing a pawn: two levels then a grid of thumbnails, from the figures' data; "more..."; the search button
  CAST    the GM's named individuals and saved groups; Save as group; never in a player's traffic
  TABLE   On the table: kinds with counts and damage, go to, select all of a kind, the GM's hidden pawns and reveal
  TURNS   an order shown on the same rows with a marker (area.turns)
"""
import argparse, asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--only', default='')
A = ap.parse_args()
ONLY = [s.strip().upper() for s in A.only.split(',') if s.strip()]
want = lambda s: not ONLY or s in ONLY
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18163,18793').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-pawnsmenu-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])  # /tmp is RAM: both are removed at exit
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
    except Exception:
        print(f'    (timed out: {what or js[:90]})', flush=True)
        try: print('    LOAD STATE', await pg.evaluate('({ready:document.readyState,tw:typeof window.tw,loading:document.querySelector("#loading")?.textContent})'), flush=True)
        except Exception: pass
        return False
E = lambda i: f"tw.entities()['{i}']"
# everything the page RECEIVES from the relay, kept as text (websocket frames, server-sent events, fetch bodies)
RX = """(() => { window.__rx = [];
  const WS = window.WebSocket; window.WebSocket = class extends WS { constructor(...a) { super(...a); this.addEventListener('message', (ev) => { try { window.__rx.push(String(ev.data)); } catch { } }); } };
  const ES = window.EventSource; if (ES) window.EventSource = class extends ES { constructor(...a) { super(...a); this.addEventListener('message', (ev) => { try { window.__rx.push(String(ev.data)); } catch { } }); } };
  const F = window.fetch; window.fetch = async (...a) => { const r = await F(...a); try { const u = String(a[0]?.url || a[0]); if (/\\/(c|sse|a)\\//.test(u) && !/\\.(glb|png|webp|js|json)(\\?|$)/.test(u)) r.clone().text().then(t => window.__rx.push(t)).catch(() => {}); } catch { } return r; }; })()"""
ST = 'tw.pawns.state()'
ROW = lambda seat: f"tw.pawns.state().rows.find(r => r.seat === '{seat}')"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}); await ctx.add_init_script(RX)
            await ctx.route('**/sheets.example.com/**', lambda r: r.fulfill(status=200, content_type='text/html', body='<title>sheet</title>sheet'))
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: (errors.append(f'pageerror: {e}'), print(f'    PAGEERROR {e}\n{e.stack}', flush=True)))
            pg.on('requestfailed', lambda r: print(f'    REQUEST FAILED {urllib.parse.urlsplit(r.url).path}: {r.failure}', flush=True))
            pg.on('console', lambda m: print(f'    CONSOLE {m.text}', flush=True) if m.type == 'error' else None)
            await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST pawns menu {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
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
        seats['Harry'] = await gm.evaluate('tw.me()')
        check(len(set(seats.values())) == 4, 'three player tabs joined (Tobias, Mira, Kit)')
        AREA = await gm.evaluate('tw.area()')
        # a room to stand in, and the party: Mira's dwarf fighter (hurt, prone, marked) with a bear and a hawk, Tobias's
        # elf wizard, Kit with no pawn yet; two goblins and an owlbear that are nobody's
        await gm.evaluate("tw.spawnRoom('common', 0, 0, 8, 6, 4242)"); await wait(gm, "Object.values(tw.entities()).some(e => e.kind === 'room') && tw.sync.pendingCount() === 0", 15000, 'room')
        BR, BE, HA, WI, G1, G2, OW = 'tok_brakka0001', 'tok_bear000001', 'tok_hawk000001', 'tok_wizard0001', 'tok_goblin0001', 'tok_goblin0002', 'tok_owlbear001'
        toks = [{'type': 'token.create', 'args': {'id': BR, 'name': 'Brakka', 'x': 12.5, 'z': 12.5, 'owner': seats['Mira'], 'damage': 7, 'fig': 'hero-fighter-dwarf-f', 'main': True, 'conditions': ['prone'], 'mark': 'star', 'sheet': 'https://sheets.example.com/brakka'}},
                {'type': 'token.create', 'args': {'id': BE, 'name': 'Bear', 'x': 17.5, 'z': 12.5, 'owner': seats['Mira'], 'fig': 'beast-bear', 'damage': 3}},
                {'type': 'token.create', 'args': {'id': HA, 'name': 'Hawk', 'x': 17.5, 'z': 17.5, 'owner': seats['Mira'], 'fig': 'beast-hawk'}},
                {'type': 'token.create', 'args': {'id': WI, 'name': 'Elowen', 'x': 22.5, 'z': 12.5, 'owner': seats['Tobias'], 'fig': 'hero-wizard-elf-f', 'main': True}},
                {'type': 'token.create', 'args': {'id': G1, 'name': 'Goblin 1', 'x': 32.5, 'z': 22.5, 'fig': 'foe-goblin-spear'}},
                {'type': 'token.create', 'args': {'id': G2, 'name': 'Goblin 2', 'x': 37.5, 'z': 22.5, 'fig': 'foe-goblin-bow', 'damage': 4}},
                {'type': 'token.create', 'args': {'id': OW, 'name': 'Owlbear', 'x': 30, 'z': 10, 'fig': 'foe-owlbear', 'size': 2}}]
        await gm.evaluate(f"tw.batch({json.dumps(toks)})")
        for pg in pages.values(): await wait(pg, f"{E(OW)} && tw.sync.pendingCount() === 0 && tw.sync.campaign.party.pawns.length >= 4", 10000, 'pawns')
        for pg in pages.values(): await pg.evaluate("(() => { const g = tw.main.grab; g.focus.set(22, 0, 16); g.yaw = 0; g.pitch = 55; g.dist = 70; g.update(); tw.main.rule = 'free'; })()")
        async def at(pg, css):
            return await pg.evaluate(f"(() => {{ const r = document.querySelector('{css}').getBoundingClientRect(); return {{ x: r.left + r.width / 2, y: r.top + r.height / 2 }}; }})()")
        async def closed(pg):
            await pg.evaluate("(() => { for (const n of ['pawns', 'build', 'settings']) { tw.tray.setPin(n, false); tw[n].close(); } })()"); await pg.mouse.move(900, 500); await pg.wait_for_timeout(80)
        async def shot(pg, name, clip=None):
            if A.shots: await pg.wait_for_timeout(500); await pg.screenshot(path=os.path.join(SHOTS, name), **({'clip': clip} if clip else {}))
        async def tray_clip(pg, css='#pawnsTray', pad=8):
            r = await pg.evaluate(f"(() => {{ const r = document.querySelector('{css}').getBoundingClientRect(), l = document.querySelector('#launchers').getBoundingClientRect(); return {{ x: Math.max(0, l.left - {pad}), y: Math.max(0, l.top - {pad}), width: Math.max(r.right, l.right) - l.left + {pad} * 2, height: r.bottom - l.top + {pad} * 2 }}; }})()"); return r

        # ================= TRAY: hold, tap, pin =================
        if want('TRAY'):
            print('TRAY: hold, tap, pin on Pawns, Build and Settings')
            await closed(gm)
            order = await gm.evaluate("[...document.querySelectorAll('#launchers .launcher:not([hidden])')].map(b => b.dataset.l + ':' + b.querySelector('kbd').textContent)")
            check(order == ['pawns:P', 'build:B', 'settings:S'], 'the launchers: Pawns, Build, Settings, each with its key', order)
            HOLD = await gm.evaluate('tw.tray.holdMs')  # (longer in a driven browser than for a person: surfaces/tray.js)
            check(await gm.evaluate('tw.tray.HOLD_MS') == 350 and HOLD >= 350, 'a hold is 350 ms for a person (a driven browser is given longer: its key events are stamped late)', HOLD)
            opened = lambda n: f"tw.{n}.isOpen"
            vis = {'pawns': "!document.getElementById('pawnsTray').hidden", 'build': "!document.getElementById('buildMenu').hidden", 'settings': "!document.getElementById('settingsModal').hidden"}
            for name, key in (('pawns', 'p'), ('build', 'b'), ('settings', 's')):
                await closed(gm)
                # TAP
                await gm.keyboard.press(key); await gm.wait_for_timeout(150)
                a = await gm.evaluate(f"{opened(name)} && {vis[name]}")
                await gm.wait_for_timeout(tw_hold := 500)
                b = await gm.evaluate(opened(name))
                await gm.keyboard.press(key); await gm.wait_for_timeout(150)
                c = await gm.evaluate(opened(name))
                check(a and b and not c, f'{name}: a TAP of {key.upper()} opens it and it stays; a tap again closes it', [a, b, c])
                await gm.keyboard.press(key); await gm.wait_for_timeout(120); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(120)
                check(not await gm.evaluate(opened(name)), f'{name}: Escape closes a tapped-open menu')
                # a click outside (what each did before: closes)
                await gm.keyboard.press(key); await gm.wait_for_timeout(150)
                await gm.mouse.click(1320, 860) if name != 'settings' else await gm.mouse.click(30, 880)
                await gm.wait_for_timeout(150)
                check(not await gm.evaluate(opened(name)), f'{name}: a click outside closes a tapped-open menu (as it did before)')
                # HOLD
                await gm.keyboard.down(key); await gm.wait_for_timeout(120)
                a = await gm.evaluate(f"{opened(name)} && {vis[name]}")
                await gm.wait_for_timeout(HOLD + 300); b = await gm.evaluate(opened(name))
                await gm.keyboard.up(key); await gm.wait_for_timeout(150)
                c = await gm.evaluate(opened(name))
                check(a and b and not c, f'{name}: HOLD {key.upper()}: shown while held, gone when let go', [a, b, c])
                # PIN
                await gm.keyboard.press(key); await gm.wait_for_timeout(150)
                pin = '.smodal .tpin' if name == 'settings' else ('#pawnsTray .tpin' if name == 'pawns' else '#buildMenu .tpin')
                check(await gm.evaluate(f"!!document.querySelector('{pin}')"), f'{name}: the menu has a pin')
                await gm.click(pin); await gm.wait_for_timeout(150)
                st = await gm.evaluate(f"({{ pinned: tw.tray.pinned('{name}'), on: document.querySelector('{pin}').classList.contains('on'), open: {opened(name)} }})")
                await gm.mouse.click(1320, 860) if name != 'settings' else await gm.mouse.click(30, 880)
                await gm.wait_for_timeout(150); a = await gm.evaluate(opened(name))
                await gm.mouse.move(1000, 700); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150); b = await gm.evaluate(opened(name))
                check(st['pinned'] and st['on'] and st['open'] and a and b, f'{name}: PINNED, it stays through a click outside and through Escape', [st, a, b])
                if name == 'pawns':
                    # pinned and the pointer on the map: letters and digits are the game's (1 does not go to a pawn; the map still selects)
                    await gm.evaluate("tw.clearSelection(); tw.pawns.lastGo = null"); await gm.mouse.move(1000, 700); await gm.keyboard.press('1'); await gm.wait_for_timeout(200)
                    away = await gm.evaluate("tw.pawns.lastGo")
                    r = await at(gm, '#pawnsTray .prow'); await gm.mouse.move(r['x'], r['y']); await gm.keyboard.press('1'); await gm.wait_for_timeout(300)
                    over = await gm.evaluate("tw.pawns.lastGo && tw.pawns.lastGo.id")
                    check(away is None and over, 'pawns: pinned, the digit keys are the menu\'s only while the pointer is over it', [away, over])
                    sc = await gm.evaluate(f"(() => {{ const e = {E(G1)}; return tw.screenOf(e.x, e.z, tw.main, 2); }})()")
                    await gm.mouse.click(sc['x'], sc['y']); await gm.wait_for_timeout(250)
                    check(await gm.evaluate(f"tw.sel.has('{G1}') && tw.pawns.isOpen"), 'pawns: pinned, a click on the map works on the map (a goblin is selected) and the menu is still there')
                    await gm.evaluate('tw.clearSelection()')
                if name == 'settings':
                    check(await gm.evaluate("document.getElementById('settingsModal').classList.contains('pinned') && getComputedStyle(document.getElementById('settingsModal')).pointerEvents === 'none'"), 'settings: pinned, its backdrop is gone and the map behind takes the pointer')
                await gm.mouse.move(1000, 700); await gm.keyboard.press(key); await gm.wait_for_timeout(150)
                check(not await gm.evaluate(opened(name)), f'{name}: its key closes a pinned menu')
                await gm.keyboard.press(key); await gm.wait_for_timeout(150)
                check(await gm.evaluate(f"{opened(name)} && tw.tray.pinned('{name}')"), f'{name}: and it comes back pinned')
                await gm.click(pin); await gm.wait_for_timeout(120); await gm.mouse.click(1320, 860) if name != 'settings' else await gm.mouse.click(30, 880); await gm.wait_for_timeout(150)
                check(not await gm.evaluate(f"{opened(name)} || tw.tray.pinned('{name}')"), f'{name}: unpinned, a click outside closes it again')
            # one at a time; hold + a key of the menu
            await closed(gm); await gm.keyboard.press('p'); await gm.wait_for_timeout(120); await gm.keyboard.press('s'); await gm.wait_for_timeout(150)
            a = await gm.evaluate("[tw.pawns.isOpen, tw.settings.isOpen]"); dbg = await gm.evaluate("JSON.stringify(tw.tray.last)"); await gm.keyboard.press('b'); await gm.wait_for_timeout(150)
            b = await gm.evaluate("[tw.pawns.isOpen, tw.settings.isOpen, tw.build.isOpen]")
            check(a == [False, True] and b == [False, False, True], 'one menu at a time: S closes Pawns, B closes Settings', [a, b, dbg])
            await closed(gm); await gm.evaluate("tw.pawns.lastGo = null; tw.clearSelection()")
            await gm.keyboard.down('p'); await gm.wait_for_timeout(100); await gm.keyboard.press('1'); await gm.wait_for_timeout(80); await gm.keyboard.up('p'); await gm.wait_for_timeout(250)
            st = await gm.evaluate("({ go: tw.pawns.lastGo && tw.pawns.lastGo.id, open: tw.pawns.isOpen, sel: [...tw.sel] })")
            check(st['go'] and not st['open'] and st['sel'] == [st['go']], 'P held, 1, P let go (quickly): the first player\'s pawn is selected and the menu is gone', st)
            await gm.keyboard.press('/'); await gm.keyboard.type('pbs', delay=20); await gm.wait_for_timeout(150)
            check(not await gm.evaluate("tw.pawns.isOpen || tw.build.isOpen || tw.settings.isOpen"), 'typing p, b, s in the command bar opens nothing'); await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
            await kit.keyboard.press('b'); await kit.wait_for_timeout(150)
            check(not await kit.evaluate('tw.build.isOpen'), 'a player who cannot build: B does nothing (no Build launcher)')
            await closed(gm); await gm.evaluate('tw.clearSelection()')

        # ================= PARTY =================
        if want('PARTY'):
            print('PARTY: one wide row per player')
            await closed(gm); await gm.keyboard.press('p'); await gm.wait_for_timeout(300)
            st = await gm.evaluate(ST)
            rows = {r['seat']: r for r in st['rows']}
            m, h, k, g = rows[seats['Mira']], rows[seats['Tobias']], rows[seats['Kit']], rows[seats['Harry']]
            check('party' in st['sections'] and len(st['rows']) == 4 and st['rows'][-1]['seat'] == seats['Harry'], 'a row per player, and the GM\'s last', [r['player'] for r in st['rows']])
            check(m['player'].startswith('Mira') and m['pawn'] == 'Brakka' and h['pawn'] == 'Elowen' and 'no pawn' in k['pawn'], 'each row carries the player\'s name and the pawn\'s name; a player with no pawn says so', [m['player'], m['pawn'], k['pawn']])
            check(m['portrait'] and 'hero-fighter-dwarf-f' in m['portrait'] and h['portrait'] and 'hero-wizard-elf-f' in h['portrait'] and k['portrait'] is None, 'the portrait is the figure\'s own thumbnail', [m['portrait'], h['portrait']])
            ok = await wait(gm, "[...document.querySelectorAll('#pawnsTray .pface img, #pawnsTray .ppet img')].length === 4 && [...document.querySelectorAll('#pawnsTray .pface img, #pawnsTray .ppet img')].every(i => i.complete && i.naturalWidth > 0)", 8000, 'thumbnails')
            check(ok, 'and the pictures load (two pawns, two pets)', await gm.evaluate("[...document.querySelectorAll('#pawnsTray img.pimg')].map(i => [i.src.split('/').pop(), i.complete, i.naturalWidth])"))
            # Every supported text size and ring size: the portrait's clipping box stays inside its button.
            for pref, values in [('textScale', [round(.8 + i * .05, 2) for i in range(15)]), ('ringScale', [round(.7 + i * .05, 2) for i in range(19)])]:
                fits = []
                for value in values:
                    await gm.evaluate("([p,v]) => tw.settings.setPref(p,v)", [pref, value])
                    fits.append(await gm.evaluate("[...document.querySelectorAll('.pface')].every(e => { const a=e.getBoundingClientRect(), b=e.querySelector('.player-portrait').getBoundingClientRect(); return b.left >= a.left && b.right <= a.right && b.top >= a.top && b.bottom <= a.bottom; })"))
                check(all(fits), f'portrait fits its button at every {pref} setting', values)
                await gm.evaluate("p => tw.settings.setPref(p,1)", pref)
            await mi.evaluate('tw.pawns.open()')
            await mi.evaluate(f"tw.setMainPawn(tw.entities()['{BE}'])")
            for pg, label in [(gm, 'GM'), (mi, 'player')]:
                check(await wait(pg, f"({ROW(seats['Mira'])})?.portrait?.includes('beast-bear')"), f'{label}: portrait follows changed main pawn')
            await mi.evaluate(f"tw.setMainPawn(tw.entities()['{BR}'])")
            for pg in [gm, mi]: await wait(pg, f"({ROW(seats['Mira'])})?.portrait?.includes('hero-fighter-dwarf-f')")
            await mi.evaluate(f"tw.setMainPawn(tw.entities()['{BR}'], false)")
            for pg, label in [(gm, 'GM'), (mi, 'player')]:
                check(await wait(pg, f"({ROW(seats['Mira'])})?.portrait === null && document.querySelector('#pawnsTray .prow[data-seat=\"{seats['Mira']}\"] .player-initial')?.textContent === 'M'"), f'{label}: no explicit main pawn falls back to initial even with owned pawns')
            await mi.evaluate(f"tw.setMainPawn(tw.entities()['{BR}'], true)")
            for pg in [gm, mi]: await wait(pg, f"({ROW(seats['Mira'])})?.portrait?.includes('hero-fighter-dwarf-f')")
            await mi.evaluate('tw.pawns.close()')
            check(await gm.evaluate("[...document.querySelectorAll('#pawnsTray .mtools [data-cmd]')].map(e=>e.dataset.cmd).join() === 'measure.start'"), 'Pawns has exactly one Measure button and no shape palette')
            await gm.evaluate('tw.clearSelection()')
            await gm.click('#pawnsTray [data-cmd="measure.start"]')
            from_button = await gm.evaluate('tw.rulers.state().armed')
            await gm.keyboard.press('Escape'); await closed(gm)
            await gm.keyboard.press('m')
            from_key = await gm.evaluate('tw.rulers.state().armed')
            check(from_button == from_key and from_key is not None, 'Measure button arms exactly the same ruler as M', [from_button, from_key])
            await gm.keyboard.press('Escape'); await gm.evaluate('tw.pawns.open()')
            check(m['damage'] == '7' and m['conditions'] == ['prone'] and m['mark'] == 'star' and h['damage'] == '' and h['conditions'] == [], 'damage as a number, the condition and the indicator are on the row, with no click (an unhurt pawn shows none)', [m['damage'], m['conditions'], m['mark']])
            check(m['pets'] == [BE, HA] and h['pets'] == [], 'pets and familiars are smaller portraits in the same row, not rows of their own', m['pets'])
            sizes = await gm.evaluate(f"(() => {{ const r = document.querySelector('#pawnsTray .prow[data-seat=\"{seats['Mira']}\"]'); return [r.querySelector('.pface').offsetWidth, r.querySelector('.ppet').offsetWidth]; }})()")
            check(sizes[0] >= 56 and sizes[1] <= sizes[0] / 1.8, 'the pet portraits are smaller than the pawn\'s', sizes)
            check([r['key'] for r in st['rows']][:2] == ['1', '2'] and k['key'] == '' and set(['1', '2', 'o']) <= set(st['keys']), 'every row that has a key shows it (1, 2; party notes O)', [[r['key'] for r in st['rows']], st['keys']])
            check(m['acts'] == ['sheet', 'follow', 'whisper', 'here', 'send' if 'send' in m['acts'] else 'control', 'control'][:len(m['acts'])] and {'sheet', 'follow', 'whisper', 'here', 'control'} <= set(m['acts']), 'the GM\'s row of a player: sheet, follow, whisper, and the chores (bring here, take or give control)', m['acts'])
            check(g['acts'] == [] or 'whisper' not in g['acts'], 'no whisper to yourself', g['acts'])
            check(all(t and len(t) > 8 for r in st['rows'] for t in r['tips']), 'every action icon has a hover name', [t for r in st['rows'] for t in r['tips']][:3])
            # The tray was just reopened after Measure. Its 180 ms entrance transform moves icons;
            # finish that motion before sampling an actual hover (the tooltip itself has no delay).
            await gm.locator('#pawnsTray').evaluate("async el => { await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))); }")
            tips = []
            for a in m['acts']:
                await gm.locator(f'#pawnsTray .prow[data-seat="{seats["Mira"]}"] .pact[data-act="{a}"]').hover()
                await gm.wait_for_timeout(60)
                tips.append(await gm.evaluate('tw.trayTip()'))
            check(all(tips) and tips[0].startswith('Sheet') and tips[1].startswith('Follow') and tips[2].startswith('Whisper'), 'hovering an icon shows its name at once', tips)
            await shot(gm, 'pawnsmenu-party-gm.png', await tray_clip(gm))
            if A.shots:
                await closed(gm); await gm.keyboard.press('b'); await gm.wait_for_timeout(700); await shot(gm, 'pawnsmenu-build-beside.png', await tray_clip(gm, '#buildMenu')); await closed(gm); await gm.keyboard.press('p'); await gm.wait_for_timeout(250)
            print('    dbg', await gm.evaluate("[tw.pawns.isOpen, document.getElementById('pawnsTray').hidden, tw.build.isOpen, JSON.stringify(tw.tray.state())]"))
            await gm.mouse.move(900, 500)
            # a player's own view of it
            await closed(mi); await mi.keyboard.press('p'); await mi.wait_for_timeout(300)
            sm = await mi.evaluate(ST); rm = {r['seat']: r for r in sm['rows']}
            check(rm[seats['Mira']]['acts'] == ['sheet', 'follow'] and rm[seats['Tobias']]['acts'] == ['follow', 'whisper'] and rm[seats['Harry']]['acts'] == ['whisper'] and rm[seats['Kit']]['acts'] == ['whisper'], 'a player: sheet and follow on her own row, follow and whisper on another\'s, whisper to the GM; none of the GM\'s chores', {k2: v['acts'] for k2, v in rm.items()})
            check(rm[seats['Mira']]['damage'] == '7' and rm[seats['Tobias']]['pawn'] == 'Elowen', 'and the same names and numbers')
            await shot(mi, 'pawnsmenu-party-player.png', await tray_clip(mi))

            print('PARTY: go to, sheet, follow')
            await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(60, 0, 60); g.update(); tw.clearSelection(); })()")
            await gm.click(f'#pawnsTray .prow[data-seat="{seats["Mira"]}"] .pface'); await gm.wait_for_timeout(700)
            st = await gm.evaluate(f"(() => {{ const e = {E(BR)}, f = tw.main.grab.focus; return {{ sel: [...tw.sel], d: Math.hypot(f.x - e.x, f.z - e.z), open: tw.pawns.isOpen }}; }})()")
            check(st['sel'] == [BR] and st['d'] < 3 and st['open'], 'a click on the portrait goes to that pawn: the view centres on it and it is selected (the tapped menu stays)', st)
            await gm.click(f'#pawnsTray .ppet[data-go="{BE}"]'); await gm.wait_for_timeout(600)
            check(await gm.evaluate("[...tw.sel]") == [BE], 'a click on a pet\'s portrait goes to the pet')
            async with gm.context.expect_page() as newp:
                await gm.click(f'#pawnsTray .prow[data-seat="{seats["Mira"]}"] .pact[data-act="sheet"]')
            sp = await newp.value; await sp.wait_for_load_state()
            check('sheets.example.com/brakka' in sp.url, 'the sheet icon opens the pawn\'s sheet link in a new tab', sp.url); await sp.close()
            await gm.click(f'#pawnsTray .prow[data-seat="{seats["Tobias"]}"] .pact[data-act="follow"]'); await gm.wait_for_timeout(300)
            a = await gm.evaluate("({ f: tw.pawns.following(), pill: !document.getElementById('followPill').hidden && document.getElementById('followPill').textContent })")
            await he.evaluate(f"tw.dispatch('token.move', {{ id: '{WI}', x: 32.5, z: 22.5 }})"); await gm.wait_for_timeout(1200)
            d = await gm.evaluate(f"(() => {{ const e = {E(WI)}, f = tw.main.grab.focus; return Math.hypot(f.x - e.x, f.z - e.z); }})()")
            check(a['f'] and a['f']['id'] == WI and a['pill'] and 'Following Elowen' in a['pill'] and d < 1.5, 'follow locks my view to that pawn: it moved 14 ft and my view went with it', [a['pill'], round(d, 2)])
            g0 = await gm.evaluate("tw.main.grab.dist")
            await gm.mouse.move(900, 500); await gm.mouse.wheel(0, -300); await gm.wait_for_timeout(500)
            st = await gm.evaluate(f"(() => {{ const e = {E(WI)}, f = tw.main.grab.focus; return {{ d: Math.hypot(f.x - e.x, f.z - e.z), dist: tw.main.grab.dist, f: !!tw.pawns.following() }}; }})()")
            check(st['f'] and st['d'] < 2.5 and st['dist'] != g0, 'zooming while following keeps the lock (zoom and heading stay mine)', st)
            await shot(gm, 'pawnsmenu-follow.png')
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
            a = await gm.evaluate("[tw.pawns.isOpen, !!tw.pawns.following()]")
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
            check(a == [False, True] and not await gm.evaluate("tw.pawns.following()") and await gm.evaluate("document.getElementById('followPill').hidden"), 'Escape closes the menu first, and a second Escape (or a click on the "Following" pill) stops following', a)
            await he.evaluate(f"tw.dispatch('token.move', {{ id: '{WI}', x: 22.5, z: 12.5 }})")
            await gm.keyboard.press('p') if not await gm.evaluate('tw.pawns.isOpen') else None; await gm.wait_for_timeout(200)
            await gm.keyboard.down('Shift'); await gm.click(f'#pawnsTray .prow[data-seat="{seats["Tobias"]}"] .pact[data-act="follow"]'); await gm.keyboard.up('Shift'); await gm.wait_for_timeout(400)
            pip = await gm.evaluate("tw.pip && { area: tw.pip.area, rule: tw.pip.rule, follow: tw.pip.follow }")
            check(pip and pip['rule'] == 'follow' and pip['follow'] == {'owner': seats['Tobias']}, 'Shift + follow opens that player\'s pawns in the picture-in-picture, following them', pip)
            await gm.evaluate('tw.closePip()')

            print('PARTY: whisper')
            await closed(mi); await mi.keyboard.press('p'); await mi.wait_for_timeout(250)
            await mi.click(f'#pawnsTray .prow[data-seat="{seats["Kit"]}"] .pact[data-act="whisper"]'); await mi.wait_for_timeout(300)
            bar = await mi.evaluate("({ v: document.querySelector('#bar input').value, focus: document.activeElement === document.querySelector('#bar input') })")
            check(bar['v'] == 'whisper Kit ' and bar['focus'], 'the whisper icon fills the command bar with "whisper Kit " and puts the cursor there', bar)
            SECRET = 'WHISPER-SECRET meet me behind the stable'
            await mi.keyboard.type(SECRET, delay=4); await mi.wait_for_timeout(200); await mi.keyboard.press('Enter')
            got = await wait(kit, f"tw.whispers().some(w => w.text === {json.dumps(SECRET)})", 5000, 'whisper arrives')
            line = await kit.evaluate("document.querySelector('#chat .line.whisper')?.textContent || ''")
            mine = await mi.evaluate("document.querySelector('#chat .line.whisper')?.textContent || ''")
            check(got and 'Mira to you' in line and SECRET in line and 'you to Kit' in mine, 'Kit receives it as a line in his chat ("Mira to you"); Mira keeps her own ("you to Kit")', [line, mine])
            await gm.wait_for_timeout(500)
            leak = {n: await pg.evaluate("window.__rx.some(t => t.includes('WHISPER-SECRET'))") for n, pg in pages.items()}
            dom = {n: await pg.evaluate("document.body.innerText.includes('WHISPER-SECRET')") for n, pg in pages.items()}
            check(leak == {'Harry': False, 'Tobias': False, 'Mira': True, 'Kit': True} if 'Mira' in leak and leak['Mira'] else leak == {'Harry': False, 'Tobias': False, 'Mira': False, 'Kit': True}, 'from the traffic every tab received: the whisper reached Kit, and not a byte of it reached the GM or the third player', leak)
            check(not dom['Harry'] and not dom['Tobias'] and dom['Kit'], 'and it is on nobody else\'s screen', dom)
            await kit.reload(); await wait(kit, 'window.tw && tw.ready && tw.ready()', 45000, 'Kit reloads')
            check(await kit.evaluate(f"tw.whispers().some(w => w.text === {json.dumps(SECRET)}) && !!document.querySelector('#chat .line.whisper')"), 'after a reload Kit still has the line (kept in his own browser)')
            await kit.evaluate("(() => { const g = tw.main.grab; g.focus.set(22, 0, 16); g.yaw = 0; g.pitch = 55; g.dist = 70; g.update(); })()")

            print('PARTY: notes, the marching order')
            await closed(mi); await mi.keyboard.press('p'); await mi.wait_for_timeout(250); await mi.keyboard.press('o'); await mi.wait_for_timeout(250)
            check(await mi.evaluate("tw.pawns.state().notesOpen && document.activeElement === document.querySelector('#pawnsTray .pnotes textarea')"), 'O (or the notes icon) opens the party notes, ready to type')
            await mi.keyboard.type('We owe the innkeeper 3 gp. po'); await mi.wait_for_timeout(1400)
            check(await wait(kit, "tw.sync.campaign.party.notes === 'We owe the innkeeper 3 gp. po'", 5000, 'notes reach Kit') and await mi.evaluate('tw.pawns.isOpen'), 'what is typed is saved a second later and reaches the other seats (typing p and o in the notes does not close or toggle anything)')
            await closed(kit); await kit.keyboard.press('p'); await kit.wait_for_timeout(250); await kit.click('#pawnsTray [data-notes]'); await kit.wait_for_timeout(250)
            v = await kit.evaluate("document.querySelector('#pawnsTray .pnotes textarea').value")
            await kit.keyboard.press('Control+End'); await kit.keyboard.type(' Kit: paid.'); await kit.keyboard.press('Escape'); await kit.wait_for_timeout(400)
            check(v == 'We owe the innkeeper 3 gp. po' and await wait(mi, "tw.sync.campaign.party.notes.endsWith('Kit: paid.')", 5000, 'Kit\'s edit'), 'another player opens the same page and adds to it; leaving the field saves')
            check(await kit.evaluate("document.querySelector('#pawnsTray [data-notes]').classList.contains('has')"), 'the notes icon shows when there is something written')
            await mi.keyboard.press('Escape'); await closed(mi); await closed(kit)
            await closed(gm); await gm.keyboard.press('p'); await gm.wait_for_timeout(250)
            before = [r['seat'] for r in (await gm.evaluate(ST))['rows']]
            a = await at(gm, f'#pawnsTray .prow[data-seat=\\"{seats["Kit"]}\\"] .pname'); b2 = await at(gm, f'#pawnsTray .prow[data-seat=\\"{before[0]}\\"] .pname')
            await gm.mouse.move(a['x'], a['y']); await gm.mouse.down(); await gm.mouse.move(a['x'], a['y'] - 20, steps=4); await gm.mouse.move(b2['x'], b2['y'] - 22, steps=8); await gm.wait_for_timeout(100)
            mark = await gm.evaluate("!!document.querySelector('#pawnsTray .prow.drop-before') && !!document.querySelector('#pawnsTray .prow.dragging')")
            await gm.mouse.up(); await wait(gm, f"tw.sync.campaign.party.order[0] === '{seats['Kit']}'", 10000, 'the order reaches the relay and comes back'); await gm.wait_for_timeout(300)
            after = [r['seat'] for r in (await gm.evaluate(ST))['rows']]
            check(mark and after[0] == seats['Kit'] and after[-1] == seats['Harry'] and sorted(after) == sorted(before), 'dragging a row sets the marching order (the drop place is marked while dragging)', [mark, after[0] == seats['Kit']])
            await wait(he, f"tw.sync.campaign.party.order[0] === '{seats['Kit']}'", 10000, 'the order reaches Tobias'); await closed(he); await he.keyboard.press('p'); await he.wait_for_timeout(300)
            check([r['seat'] for r in (await he.evaluate(ST))['rows']][0] == seats['Kit'] and await he.evaluate(f"tw.sync.campaign.party.order[0] === '{seats['Kit']}'"), 'and every seat sees the same order')
            await closed(he)

            print('PARTY: the GM\'s chores; a split party')
            await gm.click(f'#pawnsTray .prow[data-seat="{seats["Mira"]}"] .pact[data-act="control"]'); await gm.wait_for_timeout(200)
            popst = await gm.evaluate("tw.pawns.state().pop")
            check(popst and 'Brakka' in popst['title'] and any('Kit' in i for i in popst['items']) and any('No one' in i for i in popst['items']), 'take or give control: the people at the table, and no one', popst)
            await shot(gm, 'pawnsmenu-control.png')
            await gm.click(".ppop .ppi:has-text('Kit')"); await wait(gm, f"{E(BR)}.owner === '{seats['Kit']}'", 4000, 'owner')
            await gm.wait_for_timeout(300)
            r2 = {r['seat']: r for r in (await gm.evaluate(ST))['rows']}
            check(r2[seats['Kit']]['pawn'] == 'Brakka' and r2[seats['Mira']]['pawn'] in ('Bear', 'Hawk'), 'given to Kit: Brakka is on Kit\'s row now, at once', [r2[seats['Kit']]['pawn'], r2[seats['Mira']]['pawn']])
            await gm.evaluate(f"tw.giveTo({E(BR)}, '{seats['Mira']}')"); await wait(gm, f"{E(BR)}.owner === '{seats['Mira']}'", 4000)
            await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(32.5, 0, 12.5); g.update(); })()"); await gm.wait_for_timeout(200)
            await gm.click(f'#pawnsTray .prow[data-seat="{seats["Tobias"]}"] .pact[data-act="here"]'); await gm.wait_for_timeout(600)
            pos = await gm.evaluate(f"[{E(WI)}.x, {E(WI)}.z, JSON.stringify(tw.pawns.lastBring || null), document.querySelector('#toast').textContent]")
            check(abs(pos[0] - 32.5) <= 5 and abs(pos[1] - 12.5) <= 5, 'bring here (same area): the pawn comes to the middle of the GM\'s view, on a square', pos)
            # a second area; the GM sends Tobias's pawn there: the party is split
            A2 = await gm.evaluate("tw.createArea('The Crypt')"); await wait(gm, f"tw.sync.campaign.areas.some(a => a.id === '{A2}')", 5000, 'second area')
            await gm.wait_for_timeout(300)
            await gm.click(f'#pawnsTray .prow[data-seat="{seats["Tobias"]}"] .pact[data-act="send"]'); await gm.wait_for_timeout(250)
            popst = await gm.evaluate("({ ...tw.pawns.state().pop, hid: [...document.querySelectorAll('.ppop .ppi.hid')].map(x => x.textContent) })")
            check(popst['items'] == ['The Crypt'] and popst['hid'] and 'hidden from players' in popst['hid'][0], 'send to area: the other areas; a hidden one wears the hidden look and says "hidden from players"', popst)
            await shot(gm, 'pawnsmenu-send.png')
            await gm.click(".ppop .ppi:has-text('The Crypt')")
            await wait(gm, f"!{E(WI)} && tw.sync.campaign.party.pawns.some(p => p.id === '{WI}' && p.area === '{A2}')", 6000, 'travelled')
            await gm.wait_for_timeout(400)
            st = await gm.evaluate(ST)
            check(await gm.evaluate('tw.area()') == AREA and len(st['areas']) >= 2 and any('The Crypt' in a for a in st['areas']) and any('here' in a for a in st['areas']), 'the pawn went (the GM\'s view stayed); the party is split, so the rows group by area, this area first', st['areas'])
            rh = next(r for r in st['rows'] if r['seat'] == seats['Tobias'])
            check(rh['pawn'] == 'Elowen' and rh['area'] == A2 and 'here' in rh['acts'] and 'control' not in rh['acts'], 'Tobias\'s row is under The Crypt, still with his pawn\'s name and picture (and no "control": it is not on this table)', rh['acts'])
            await shot(gm, 'pawnsmenu-split.png', await tray_clip(gm))
            await closed(mi); await mi.keyboard.press('p'); await mi.wait_for_timeout(300)
            sm = await mi.evaluate(ST)
            check(any('The Crypt' in a for a in sm['areas']), 'a player sees the same grouping (the area was opened by sending a player\'s pawn into it)', sm['areas'])
            await closed(mi)
            await gm.click(f'#pawnsTray .prow[data-seat="{seats["Tobias"]}"] .pface'); await wait(gm, f"tw.area() === '{A2}' && !!{E(WI)}", 8000, 'go to another area'); await gm.wait_for_timeout(600)
            check(await gm.evaluate(f"tw.area() === '{A2}' && tw.sel.has('{WI}')"), 'go to a pawn in another area: the view goes to that area and the pawn is selected')
            await gm.evaluate(f"tw.setMain('{AREA}')"); await wait(gm, f"tw.area() === '{AREA}' && !!{E(BR)}", 8000); await gm.wait_for_timeout(300)
            if not await gm.evaluate('tw.pawns.isOpen'): await gm.keyboard.press('p'); await gm.wait_for_timeout(250)
            await gm.click(f'#pawnsTray .prow[data-seat="{seats["Tobias"]}"] .pact[data-act="follow"]'); await gm.wait_for_timeout(400)
            pip = await gm.evaluate("tw.pip && { area: tw.pip.area, rule: tw.pip.rule }")
            check(pip and pip['area'] == A2 and pip['rule'] == 'follow', 'follow, for a pawn in another area: it opens in the picture-in-picture', pip)
            await gm.evaluate('tw.closePip()')
            await gm.click(f'#pawnsTray .prow[data-seat="{seats["Tobias"]}"] .pact[data-act="here"]')
            await wait(gm, f"!!{E(WI)}", 8000, 'brought back'); await gm.wait_for_timeout(400)
            st = await gm.evaluate(ST)
            check(await gm.evaluate(f"!!{E(WI)}") and st['areas'] == [], 'bring here (from another area): the pawn travels to this area, and the rows are one list again', st['areas'])
            await closed(gm)

        async def map_click(pg, x, z, **kw):
            sc = await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, 0)"); await pg.mouse.click(sc['x'], sc['y'], **kw)
        # DRAG A TILE OUT (2026-10-06): press on it, move to the map point (or back to the screen point `to`), let go
        TOK = "Object.values(tw.entities()).filter(e => e.kind === 'token')"
        async def drag_from(pg, css, x, z, up=True, to=None):
            await pg.locator(css).scroll_into_view_if_needed(); await pg.wait_for_timeout(60)
            src = await at(pg, css); dst = to or await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, 0)")
            await pg.mouse.move(src['x'], src['y']); await pg.mouse.down()
            for i in range(1, 11): await pg.mouse.move(src['x'] + (dst['x'] - src['x']) * i / 10, src['y'] + (dst['y'] - src['y']) * i / 10); await pg.wait_for_timeout(16)
            await pg.wait_for_timeout(120)
            mid = await pg.evaluate("({ pawn: !!tw.mode?.pawn, via: !!tw.mode?.viaDrag, n: tw.mode?.pawn?.n || 0, def: tw.mode?.pawn?.def?.name || null, cells: tw.worldOf(tw.area()).cellMarks?.get('pawn-tool')?.lit.count || 0, vis: getComputedStyle(document.getElementById('pawnsTray')).visibility })")
            if up: await pg.mouse.up(); await pg.wait_for_timeout(450)
            return mid
        async def view_home(pg):
            await pg.evaluate("(() => { const g = tw.main.grab; g.focus.set(22, 0, 16); g.yaw = 0; g.pitch = 55; g.dist = 70; g.update(); tw.main.rule = 'free'; tw.clearSelection(); if (tw.mode) tw.modes.cancel(); })()")
        async def open_p(pg):
            await closed(pg); await pg.keyboard.press('p'); await pg.wait_for_timeout(300)
        async def pop_click(pg, text):
            await pg.click(f".ppop .ppi:has-text('{text}')"); await pg.wait_for_timeout(250)

        # ================= MINE: my pawns, my bench, Settings > Me > My pawns =================
        if want('MINE'):
            print('MINE: a new player defines a pawn (Settings > Me > My pawns), brings it on, sends it back')
            for pg in (gm, kit): await view_home(pg)
            await open_p(kit)
            st = await kit.evaluate(ST)
            check(st['sections'][0] == 'mine' and st['mine'] == [] and st['newPawn'] and 'n' in st['keys'] and 'place' not in st['sections'] and 'cast' not in st['sections'], 'a player with no pawns: Mine is first and holds one tile, "New pawn" (N); no cast, no placing tree', st['sections'])
            await shot(kit, 'pawnsmenu-mine-empty.png', await tray_clip(kit))
            await kit.keyboard.press('n'); await kit.wait_for_timeout(400)
            ss = await kit.evaluate("({ ...tw.settings.state(), ed: !!document.querySelector('#settingsModal .mped'), pawns: tw.pawns.isOpen, edit: tw.settings.pawnEdit() })")
            check(ss['open'] and ss['section'] == 'me' and ss['ed'] and not ss['pawns'] and ss['edit']['isNew'], '"New pawn" opens Settings > Me > My pawns on a new pawn', ss['section'])
            roots = await kit.evaluate("[...document.querySelectorAll('.mptree .btile')].map(b => b.querySelector('.bl').textContent)")
            check(roots == ['Heroes', 'Townsfolk', 'Monsters', 'Animals'], 'the figure picker is the Build-style tree: Heroes, Townsfolk, Monsters, Animals', roots)
            await kit.click(".mptree .btile:has-text('Heroes')"); await kit.wait_for_timeout(200)
            classes = await kit.evaluate("[...document.querySelectorAll('.mptree .btile')].map(b => b.querySelector('.bl').textContent)")
            await kit.click(".mptree .btile:has-text('Rogue')"); await kit.wait_for_timeout(250)
            figs = await kit.evaluate("[...document.querySelectorAll('.mptree .btile[data-fig]')].map(b => [b.dataset.fig, b.querySelector('.bl').textContent, !!b.querySelector('img')])")
            check(len(classes) == 12 and 'Wizard' in classes and len(figs) == 14 and all(f[2] for f in figs) and figs[0][1] == 'Human woman', 'Heroes > the twelve classes > a grid of that class by race and gender, with pictures', [len(classes), figs[:2]])
            await shot(kit, 'pawnsmenu-mypawns-picker.png')
            await kit.click(".mptree .btile[data-fig='hero-rogue-small-m']"); await kit.wait_for_timeout(250)
            ed = await kit.evaluate("({ e: tw.settings.pawnEdit(), name: document.querySelector('.mpname').value, prev: document.querySelector('.mpprev b').textContent, sel: !!document.querySelector('.mptree .btile.sel[data-fig=\"hero-rogue-small-m\"]') })")
            check(ed['e']['fig'] == 'hero-rogue-small-m' and ed['name'] and ed['sel'], 'picking a figure sets it (and offers its name as the pawn\'s name)', [ed['name'], ed['prev']])
            await kit.fill('.mpname', 'Sly'); await kit.fill('.mpsheet', 'sheets.example.com/sly'); await kit.fill('.mpnotes', 'KITNOTE-ONLY daggers, lockpicks')
            await kit.click("[data-act='pawn-save']")
            check(await wait(kit, "tw.sync.campaign.pawns.some(d => d.name === 'Sly')", 5000, 'defined'), 'saved: it is one of Kit\'s pawns')
            d = await kit.evaluate("tw.sync.campaign.pawns.find(d => d.name === 'Sly')")
            check(d['owner'] == seats['Kit'] and d['fig'] == 'hero-rogue-small-m' and d['sheet'] == 'https://sheets.example.com/sly' and d['main'] is True and d['at'] is None, 'kept with the campaign: its figure, name, sheet link (made a web link) and notes; a first pawn is the main one; it is on the bench', d)
            card = await kit.evaluate("document.querySelector('.mpl .mpcard')?.textContent || ''")
            check('Sly' in card and 'on the bench' in card, 'My pawns lists it: "on the bench"', card)
            await shot(kit, 'pawnsmenu-mypawns.png')
            await gm.wait_for_timeout(400)
            check(await gm.evaluate("tw.sync.campaign.pawns.some(d => d.name === 'Sly')") and not await mi.evaluate("(tw.sync.campaign.pawns || []).some(d => d.name === 'Sly') || window.__rx.some(t => t.includes('KITNOTE-ONLY'))"), 'the GM is sent it; another player is not (her client, and every byte her tab received)')
            await kit.keyboard.press('Escape'); await open_p(kit)
            st = await kit.evaluate(ST)
            check([(m['name'], m['kind'], m['main']) for m in st['mine']] == [('Sly', 'bench', True)] and 'hero-rogue-small-m' in (st['mine'][0]['pic'] or ''), 'the Pawns menu: Sly is on Kit\'s bench (its picture, dimmed, marked "bench")', st['mine'])
            await shot(kit, 'pawnsmenu-mine-bench.png', await tray_clip(kit))
            await kit.click('#pawnsTray [data-mine="0"]'); await kit.wait_for_timeout(300)
            md = await kit.evaluate("tw.mode && tw.mode.pawn && { def: tw.mode.pawn.def && tw.mode.pawn.def.name, open: tw.pawns.isOpen }")
            check(md and md['def'] == 'Sly' and not md['open'], 'a click on a bench tile picks it up (the menu steps aside): click a square to bring it on', md)
            await map_click(kit, 7.5, 22.5)
            check(await wait(gm, "Object.values(tw.entities()).some(e => e.kind === 'token' && e.name === 'Sly')", 6000, 'brought on'), 'a player brings her own pawn onto the table: no GM step')
            sly = await gm.evaluate("Object.values(tw.entities()).find(e => e.name === 'Sly')"); SLY = sly['id']
            check(sly['owner'] == seats['Kit'] and sly['fig'] == 'hero-rogue-small-m' and sly['main'] is True and sly['def'] == d['id'] and abs(sly['x'] - 7.5) < 0.01 and abs(sly['z'] - 22.5) < 0.01, 'it is Kit\'s, with the defined figure, sheet and notes, on the clicked square', {k: sly.get(k) for k in ('owner', 'fig', 'x', 'z')})
            await open_p(kit); st = await kit.evaluate(ST)
            rk = next(r for r in st['rows'] if r['seat'] == seats['Kit'])
            check(st['mine'][0]['kind'] == 'on' and st['mine'][0]['key'] == '0' and rk['pawn'] == 'Sly' and rk['portrait'] and 'rogue' in rk['portrait'], 'now it is on the table: its tile says so (key 0 goes to it) and Kit\'s party row has it', [st['mine'], rk['pawn']])
            await shot(kit, 'pawnsmenu-mine-player.png', await tray_clip(kit))
            await kit.evaluate("tw.main.grab.focus.set(80, 0, 80); tw.main.grab.update(); tw.clearSelection()"); await kit.mouse.move(100, 400); await kit.keyboard.press('0'); await kit.wait_for_timeout(600)
            check(await kit.evaluate(f"tw.sel.has('{SLY}') && Math.hypot(tw.main.grab.focus.x - 7.5, tw.main.grab.focus.z - 22.5) < 3"), '0 goes to my pawn')
            # the tile's menu: travel, send back, lend, edit
            A3 = await gm.evaluate("tw.createArea('The Cellar')"); await wait(gm, f"tw.sync.campaign.areas.some(a => a.id === '{A3}')", 5000); await gm.evaluate(f"tw.setAreaOpen('{A3}', true)")
            await wait(kit, f"tw.sync.campaign.areas.some(a => a.id === '{A3}')", 5000, 'the cellar is open'); await kit.wait_for_timeout(200)
            await open_p(kit); await kit.click('#pawnsTray [data-menu="0"]'); await kit.wait_for_timeout(200)
            items = (await kit.evaluate(ST))['pop']['items']
            check(items[0] == 'Go to Sly' and 'Travel to The Cellar' in items and 'Send back to the bench' in items and 'Lend to Mira' in items and 'Lend to the GM' in items and items[-1] == 'Edit…', 'the tile\'s menu: go to, travel (the open areas), send back to the bench, lend, edit', items)
            await shot(kit, 'pawnsmenu-mine-menu.png')
            await pop_click(kit, 'Lend to Mira'); await wait(gm, f"{E(SLY)}.owner === '{seats['Mira']}'", 4000, 'lent')
            check(await gm.evaluate(f"{E(SLY)}.lender === '{seats['Kit']}'") and await wait(kit, "tw.pawns.state().mine[0]?.kind === 'lent'", 4000, 'lent tile'), 'lend to another player: Mira moves it now; Kit\'s tile says "lent"')
            await kit.click('#pawnsTray [data-menu="0"]'); await kit.wait_for_timeout(200); await pop_click(kit, 'Take it back')
            check(await wait(gm, f"{E(SLY)}.owner === '{seats['Kit']}' && !{E(SLY)}.lender", 4000, 'back'), 'and takes it back')
            await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { travelLocked: true } })"); await wait(kit, "tw.sync.campaign.defaults.travelLocked === true", 4000)
            await open_p(kit); await kit.click('#pawnsTray [data-menu="0"]'); await kit.wait_for_timeout(200)
            items = (await kit.evaluate(ST))['pop']['items']
            check('The GM has locked travel' in items and not any(i.startswith('Travel to') for i in items), 'while the GM has locked travel, the travel entries are the one line "The GM has locked travel"', items)
            await kit.keyboard.press('Escape'); await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { travelLocked: null } })"); await wait(kit, "!tw.sync.campaign.defaults.travelLocked", 4000)
            await open_p(kit); await kit.click('#pawnsTray [data-menu="0"]'); await kit.wait_for_timeout(200); await pop_click(kit, 'Travel to The Cellar')
            ok = await wait(kit, f"tw.area() === '{A3}' && !!{E(SLY)}", 8000, 'travelled')
            check(ok and await gm.evaluate(f"!{E(SLY)}"), 'travel: my pawn goes to the other area and my view goes with it')
            await kit.wait_for_timeout(400); await open_p(kit); await kit.click('#pawnsTray [data-menu="0"]'); await kit.wait_for_timeout(200); await pop_click(kit, 'Send back to the bench')
            check(await wait(kit, "tw.pawns.state().mine[0]?.kind === 'bench'", 5000, 'benched') and await kit.evaluate(f"!{E(SLY)}"), 'send back to the bench: the pawn leaves the table, its definition stays')
            await kit.evaluate(f"tw.setMain('{AREA}')"); await wait(kit, f"tw.area() === '{AREA}' && !!{E(G1)}", 8000); await view_home(kit)
            # edit: the pawn on the table changes with its definition; a pet
            await open_p(kit); await kit.click('#pawnsTray [data-mine="0"]'); await kit.wait_for_timeout(250); await map_click(kit, 7.5, 22.5)
            await wait(kit, "Object.values(tw.entities()).some(e => e.name === 'Sly')", 6000, 'on again'); SLY = await kit.evaluate("Object.values(tw.entities()).find(e => e.name === 'Sly').id")
            await open_p(kit); await kit.click('#pawnsTray [data-menu="0"]'); await kit.wait_for_timeout(200); await pop_click(kit, 'Edit'); await kit.wait_for_timeout(300)
            ed = await kit.evaluate("({ e: tw.settings.pawnEdit(), name: document.querySelector('.mpname')?.value })")
            check(ed['name'] == 'Sly' and ed['e']['tree']['labels'] == ['Heroes', 'Rogue'], 'Edit opens My pawns on that pawn, the picker already at its figure', ed['e']['tree']['labels'])
            await kit.fill('.mpname', 'Sly the Quick'); await kit.click(".mptree .btile[data-fig='hero-rogue-elf-f']"); await kit.wait_for_timeout(200); await kit.click("[data-act='pawn-save']")
            check(await wait(gm, f"{E(SLY)} && {E(SLY)}.name === 'Sly the Quick' && {E(SLY)}.fig === 'hero-rogue-elf-f'", 6000, 'edit reaches the table'), 'saving the change renames and re-figures the pawn standing on the table')
            await kit.click("[data-act='pawn-new']"); await kit.wait_for_timeout(250)
            await kit.click(".mptree .btile:has-text('Animals')"); await kit.wait_for_timeout(200); await kit.click(".mptree .btile[data-fig='beast-cat']"); await kit.wait_for_timeout(200)
            await kit.select_option('.mppet', label='Sly the Quick'); await kit.click("[data-act='pawn-save']")
            await wait(kit, "tw.sync.campaign.pawns.length === 2", 5000, 'the cat')
            cat = await kit.evaluate("tw.sync.campaign.pawns.find(d => d.fig === 'beast-cat')")
            check(cat and cat['name'] == 'Cat' and cat['petOf'] == d['id'] and not cat.get('main'), 'a second pawn, marked as the first one\'s pet (and not the main one)', cat)
            cards = await kit.evaluate("[...document.querySelectorAll('.mpl .mpcard')].map(c => c.textContent)")
            check(len(cards) == 2 and any('Sly the Quick\'s' in c for c in cards), 'My pawns says whose pet it is', cards)
            await kit.keyboard.press('Escape'); await open_p(kit)
            check([m['kind'] for m in (await kit.evaluate(ST))['mine']] == ['on', 'bench'], 'the menu: Sly on the table, the cat on the bench')
            # DRAG a bench tile out: it is brought on where it is let go (a player may, as by click)
            md = await drag_from(kit, '#pawnsTray [data-mine="1"]', 27.5, 22.5)
            ok = await wait(gm, "Object.values(tw.entities()).some(e => e.name === 'Cat')", 6000, 'cat dragged on')
            catp = await gm.evaluate("Object.values(tw.entities()).find(e => e.name === 'Cat')")
            check(md['pawn'] and md['via'] and md['def'] == 'Cat' and md['vis'] == 'hidden' and md['cells'] == 1, 'a bench tile is dragged out: the pawn is in hand over the map, the menu steps aside', md)
            check(ok and catp and catp['x'] == 27.5 and catp['z'] == 22.5 and catp['owner'] == seats['Kit'] and catp['def'] == cat['id'] and not await kit.evaluate('tw.pawns.isOpen || !!tw.mode'), 'let go on a square: it is brought on THERE, hers, for every seat (no GM step); the menu has closed', catp and [catp['x'], catp['z']])
            await kit.keyboard.press('/'); await kit.keyboard.type('goblin', delay=8); await kit.wait_for_timeout(250)
            kb = await kit.evaluate("({ drags: document.querySelectorAll('#results .res.drags').length, tiles: document.querySelectorAll('#pawnsTray [data-fig], #pawnsTray [data-cast]').length })")
            await kit.keyboard.press('Escape'); await kit.wait_for_timeout(120)
            check(kb == {'drags': 0, 'tiles': 0}, 'a player has no figure rows in the bar and no placing tiles to drag (what she may not click she cannot drag)', kb)
            await open_p(kit); await kit.click('#pawnsTray [data-menu="1"]'); await kit.wait_for_timeout(200); await pop_click(kit, 'Send back to the bench')
            await wait(kit, "tw.pawns.state().mine[1]?.kind === 'bench'", 5000, 'cat benched again'); await open_p(kit)
            await kit.click('#pawnsTray [data-mine="1"]'); await kit.wait_for_timeout(250); await map_click(kit, 12.5, 22.5)
            await wait(kit, "Object.values(tw.entities()).some(e => e.name === 'Cat')", 6000, 'cat on'); await open_p(kit)
            rk = next(r for r in (await kit.evaluate(ST))['rows'] if r['seat'] == seats['Kit'])
            check(rk['pawn'] == 'Sly the Quick' and len(rk['pets']) == 1, 'brought on, the cat is a small portrait on Kit\'s row beside Sly', rk['pets'])
            await kit.click('#pawnsTray [data-menu="1"]'); await kit.wait_for_timeout(200); await pop_click(kit, 'Send back to the bench'); await kit.wait_for_timeout(400)
            await kit.click('#pawnsTray [data-menu="1"]'); await kit.wait_for_timeout(200); await pop_click(kit, 'Forget this pawn')
            check(await wait(kit, "tw.sync.campaign.pawns.length === 1", 5000, 'forgotten'), 'a pawn on the bench can be forgotten')
            await closed(kit)

        # ================= TREE: placing a pawn =================
        if want('TREE'):
            print('TREE: placing a pawn is a tree, like Build')
            await view_home(gm); await open_p(gm)
            st = await gm.evaluate(ST)
            check(st['placeRoots'] == ['H:Heroes', 'T:Townsfolk', 'M:Monsters', 'A:Animals'] and {'h', 't', 'm', 'a', 'f'} <= set(st['keys']), 'Place a pawn: Heroes, Townsfolk, Monsters, Animals, each with its key; the search button (F)', st['placeRoots'])
            await shot(gm, 'pawnsmenu-home-gm.png', await tray_clip(gm))
            await gm.mouse.move(100, 400); await gm.keyboard.press('m'); await gm.wait_for_timeout(250)
            st = await gm.evaluate(ST); T = st['tree']
            check(st['view'] == 'tree' and T['chips'][0].endswith('Pawns') and 'Monsters' in T['chips'][-1] and len(T['tiles']) >= 20 and all(t['pic'] for t in T['tiles']) and all(t['key'] for t in T['tiles']) and any(t['label'] == 'Goblins' for t in T['tiles']), 'M: Monsters > its families, each a picture tile with a key; the levels above are chips, as in Build', [T['chips'], len(T['tiles'])])
            await shot(gm, 'pawnsmenu-tree-families.png', await tray_clip(gm))
            gk = next(t['key'] for t in T['tiles'] if t['label'] == 'Goblins')
            await gm.keyboard.press(gk.lower()); await gm.wait_for_timeout(250)
            T = (await gm.evaluate(ST))['tree']
            check(len(T['chips']) == 3 and 'Goblins' in T['chips'][-1] and len(T['tiles']) == 12 and all(t['fig'] and t['fig'].startswith('foe-goblin') and t['pic'] for t in T['tiles']), 'its letter: Goblins > a grid of the twelve goblins\' thumbnails (two levels, then the grid)', [t['label'] for t in T['tiles']][:4])
            check(await wait(gm, "[...document.querySelectorAll('#pawnsTray .bgrid img')].every(i => i.complete && i.naturalWidth > 0)", 8000, 'thumbs'), 'the thumbnails load')
            await shot(gm, 'pawnsmenu-tree-grid.png', await tray_clip(gm))
            await gm.click("#pawnsTray .btile[data-fig='foe-goblin-spear']"); await gm.wait_for_timeout(300)
            md = await gm.evaluate("tw.mode && tw.mode.pawn && { fig: tw.mode.pawn.fig && tw.mode.pawn.fig.id, open: tw.pawns.isOpen }")
            check(md and md['fig'] == 'foe-goblin-spear' and not md['open'], 'a click on a thumbnail picks that figure up (the pawn tool; the menu steps aside)', md)
            n0 = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').length")
            await map_click(gm, 37.5, 7.5); await gm.wait_for_timeout(500)
            check(await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').length") == n0 + 1 and await gm.evaluate("Object.values(tw.entities()).some(e => e.fig === 'foe-goblin-spear' && Math.abs(e.x - 37.5) < .01 && Math.abs(e.z - 7.5) < .01)"), 'and a click on a square places it')
            await gm.evaluate("tw.undo()"); await gm.wait_for_timeout(400); await view_home(gm)
            await gm.keyboard.press('p'); await gm.wait_for_timeout(250)
            st = await gm.evaluate(ST)
            check(st['view'] == 'tree' and 'Goblins' in st['tree']['chips'][-1], 'P again: the menu is where it was left, in the goblins')
            await gm.mouse.move(100, 400); await gm.keyboard.press('Backspace'); await gm.wait_for_timeout(150); a = (await gm.evaluate(ST))['tree']['chips']
            ik = next(t['key'] for t in (await gm.evaluate(ST))['tree']['tiles'] if t['label'] == 'Giants'); await gm.keyboard.press(ik.lower()); await gm.wait_for_timeout(200)
            T = (await gm.evaluate(ST))['tree']; ogre = next(t for t in T['tiles'] if t['fig'] == 'foe-ogre')
            check(len(a) == 2 and ogre['size'] == '2×2' and next(t for t in T['tiles'] if t['fig'] == 'foe-minotaur') is not None, 'Backspace goes up a level; a large creature sits in its family (Giants) with a size mark', ogre)
            await gm.keyboard.press('Backspace'); await gm.keyboard.press('Backspace'); await gm.wait_for_timeout(200)
            check((await gm.evaluate(ST))['view'] == 'home', 'Backspace at the top goes back to the menu')
            await gm.keyboard.press('a'); await gm.wait_for_timeout(250); T = (await gm.evaluate(ST))['tree']
            check(T['figs'] and len(T['figs']) == 27 and len(T['tiles']) == 15 and T['tiles'][-1]['label'].startswith('more…') and T['more'] == 'animal', 'Animals is one grid; too many for a screen, it ends in "more…"', [len(T['tiles']), T['tiles'][-1]['label']])
            await gm.click('#pawnsTray .btile[data-more]'); await gm.wait_for_timeout(300)
            bar = await gm.evaluate("({ v: document.querySelector('#bar input').value, focus: document.activeElement === document.querySelector('#bar input'), rows: [...document.querySelectorAll('#results .row, #results [role=option]')].length, open: tw.pawns.isOpen })")
            check(bar['v'] == 'place pawn animal ' and bar['focus'] and not bar['open'], '"more…" fills the command bar with that family', bar)
            await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await gm.keyboard.press('p'); await gm.wait_for_timeout(200); await gm.mouse.move(100, 400)
            await gm.keyboard.press('Backspace'); await gm.wait_for_timeout(150); await gm.keyboard.press('h'); await gm.wait_for_timeout(150); await gm.keyboard.press('i'); await gm.wait_for_timeout(250)
            T = (await gm.evaluate(ST))['tree']
            c2 = await gm.evaluate("document.querySelector('#pawnsTray .bgrid').classList.contains('c2')")
            check(T['labels'] == ['Heroes', 'Wizard'] and len(T['tiles']) == 14 and [t['label'] for t in T['tiles']][:4] == ['Human woman', 'Human man', 'Elf woman', 'Elf man'] and c2, 'Heroes > Wizard: a grid by race (rows) and gender (two columns)', [t['label'] for t in T['tiles']][:4])
            await shot(gm, 'pawnsmenu-tree-heroes.png', await tray_clip(gm))
            await gm.keyboard.press('Backspace'); await gm.keyboard.press('Backspace'); await gm.keyboard.press('Backspace'); await gm.wait_for_timeout(200)
            await gm.keyboard.press('t'); await gm.wait_for_timeout(200); T = (await gm.evaluate(ST))['tree']
            check('Innkeeper' in [t['label'] for t in T['tiles']] and 'Tavern' in [t['label'] for t in T['tiles']], 'Townsfolk > roles', [t['label'] for t in T['tiles']][:6])
            await gm.keyboard.press('Backspace'); await gm.wait_for_timeout(200)
            await gm.keyboard.press('f'); await gm.wait_for_timeout(300)
            bar = await gm.evaluate("({ v: document.querySelector('#bar input').value, focus: document.activeElement === document.querySelector('#bar input'), chips: document.querySelector('#bar .chips').textContent, open: tw.pawns.isOpen })")
            check(bar['v'] == 'place pawn ' and bar['focus'] and 'place pawn' in bar['chips'] and not bar['open'], 'the search button (F) fills the command bar with "place pawn" and puts the cursor there', bar)
            await gm.keyboard.type('owlbear', delay=10); await gm.wait_for_timeout(300)
            check(await gm.evaluate("document.querySelector('#results').textContent.includes('Owlbear')"), 'and typing a name there finds the figure')
            await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await closed(gm)
            # DRAG a thumbnail out of the grid onto the map
            await view_home(gm); await open_p(gm); await gm.mouse.move(100, 400); await gm.keyboard.press('m'); await gm.wait_for_timeout(250)
            gk = next(t['key'] for t in (await gm.evaluate(ST))['tree']['tiles'] if t['label'] == 'Goblins'); await gm.keyboard.press(gk.lower()); await gm.wait_for_timeout(300)
            n0 = await gm.evaluate(f"{TOK}.length")
            md = await drag_from(gm, '#pawnsTray .btile[data-fig="foe-goblin-bow"]', 37.5, 7.5)
            placed = await gm.evaluate(f"{TOK}.filter(e => e.fig === 'foe-goblin-bow' && Math.abs(e.x - 37.5) < .01 && Math.abs(e.z - 7.5) < .01)")
            check(md['pawn'] and md['via'] and md['vis'] == 'hidden' and md['cells'] == 1, 'a thumbnail is dragged out of the grid: the figure is in hand over the map, the menu steps aside', md)
            check(await gm.evaluate(f"{TOK}.length") == n0 + 1 and len(placed) == 1 and not await gm.evaluate('tw.pawns.isOpen || !!tw.mode'), 'let go on a square: it is placed there; the menu has closed, the tool is put away')
            check(placed and await wait(he, f"{E(placed[0]['id'])} && {E(placed[0]['id'])}.fig === 'foe-goblin-bow'", 5000, 'other seat'), 'the other seats see the dragged pawn, as a clicked one')
            await gm.evaluate('tw.undo()'); await gm.wait_for_timeout(400)
            await gm.keyboard.press('p'); await gm.wait_for_timeout(250); await gm.evaluate("tw.tray.setPin('pawns', true)"); await gm.wait_for_timeout(200)
            back = await at(gm, '#pawnsTray .btile[data-fig="foe-goblin-spear"]')
            md = await drag_from(gm, '#pawnsTray .btile[data-fig="foe-goblin-bow"]', 0, 0, to=back)
            check(md['via'] and md['vis'] == 'visible' and md['cells'] == 0 and await gm.evaluate(f"{TOK}.length") == n0 and await gm.evaluate('tw.pawns.isOpen && !tw.mode'), 'pinned, the menu stays while dragging; let go back over the menu: nothing is placed, nothing is picked up', md)
            md = await drag_from(gm, '#pawnsTray .btile[data-fig="foe-goblin-bow"]', 37.5, 7.5)
            check(await gm.evaluate(f"{TOK}.length") == n0 + 1 and await gm.evaluate('tw.pawns.isOpen && !tw.mode'), 'pinned and let go on the map: placed, and the menu is still open')
            await gm.evaluate("tw.undo(); tw.tray.setPin('pawns', false)"); await gm.wait_for_timeout(400)
            await gm.mouse.move(100, 400); await gm.keyboard.press('Backspace'); await gm.keyboard.press('Backspace'); await gm.keyboard.press('Backspace'); await gm.wait_for_timeout(200); await closed(gm)
            src = open(os.path.join(ENGINE, 'client', 'pawntree.js')).read()
            check('export const PAWN_TREE = [' in src and await gm.evaluate("tw.pawnTree.roots.reduce((a, r) => a + r.n, 0) === tw.figures.count"), 'the tree\'s shape is one table (client/pawntree.js PAWN_TREE), and every published figure has a place in it')

        # ================= CAST =================
        if want('CAST'):
            print('CAST: the GM\'s named individuals and saved groups')
            await view_home(gm); await open_p(gm)
            st = await gm.evaluate(ST)
            check('cast' in st['sections'] and st['cast'] == [] and st['saveRow'] is None, 'the GM has a cast section; with nothing selected there is no "Save as group" row')
            await gm.evaluate(f"tw.select(['{G1}', '{G2}'])"); await gm.wait_for_timeout(250)
            st = await gm.evaluate(ST)
            check(st['saveRow'] and 'Save as group' in st['saveRow'] and '2 pawns selected' in st['saveRow'] and 'g' in st['keys'], 'with several pawns selected, "Save as group…" is a row at the top of the cast (G)', st['saveRow'])
            inmenu = await gm.evaluate("(() => { const ctx = tw.registry.ctx(), c = tw.registry.get('cast.saveGroup'); return { menu: !!c.menu, when: c.when(ctx), flat: tw.registry.flat(ctx).some(n => n.cmd.id === 'cast.saveGroup') }; })()")
            check(inmenu['menu'] and inmenu['when'] and inmenu['flat'], 'and it is in the selection\'s own menu (the ring\'s options for several pawns)', inmenu)
            await shot(gm, 'pawnsmenu-cast-save.png', await tray_clip(gm))
            await gm.mouse.move(100, 400); await gm.keyboard.press('g'); await gm.wait_for_timeout(300)
            v = await gm.evaluate("document.querySelector('#bar input').value")
            await gm.keyboard.type('CASTSECRET goblin patrol', delay=5); await gm.wait_for_timeout(250); await gm.keyboard.press('Enter')
            check(v == 'save group ' and await wait(gm, "(tw.sync.campaign.cast || []).some(c => c.name === 'CASTSECRET goblin patrol')", 5000, 'saved'), 'it asks for a name in the command bar ("save group …") and saves it')
            c = await gm.evaluate("tw.sync.campaign.cast.find(c => c.kind === 'group')")
            check(len(c['members']) == 2 and [m['name'] for m in c['members']] == ['Goblin', 'Goblin'] and c['members'][0]['fig'] == 'foe-goblin-spear' and c['members'][1]['dx'] == 5, 'the group keeps each pawn\'s kind and figure, and where they stood', c['members'])
            await gm.evaluate(f"tw.select(['{OW}'])"); await gm.wait_for_timeout(200); await open_p(gm)
            st = await gm.evaluate(ST)
            check(st['saveRow'] and 'Add to the cast' in st['saveRow'], 'with one pawn selected the row offers to keep it as a named individual', st['saveRow'])
            await gm.click('#pawnsTray [data-savecast]'); await wait(gm, "tw.sync.campaign.cast.length === 2", 4000, 'one saved'); await gm.wait_for_timeout(300)
            st = await gm.evaluate(ST)
            check([(x['name'], x['group'], x['n']) for x in st['cast']] == [('Owlbear', False, ''), ('CASTSECRET goblin patrol', True, '×2')], 'the cast: the most recent first; a group shows its count', st['cast'])
            await shot(gm, 'pawnsmenu-cast.png', await tray_clip(gm))
            await gm.evaluate('tw.clearSelection()'); await gm.click(f"#pawnsTray [data-cast='{c['id']}']"); await gm.wait_for_timeout(300)
            md = await gm.evaluate("tw.mode && tw.mode.pawn && { n: tw.mode.pawn.n, cast: tw.mode.pawn.cast && tw.mode.pawn.cast.kind }")
            await map_click(gm, 7.5, 7.5); await gm.wait_for_timeout(600)
            new = await gm.evaluate("tw.lastPawns")
            names = await gm.evaluate("tw.lastPawns.ids.map(id => tw.entities()[id]).map(e => [e.name, e.fig, e.x, e.z])")
            check(md == {'n': 2, 'cast': 'group'} and [n[0] for n in names] == ['Goblin 3', 'Goblin 4'] and names[0][2:] == [7.5, 7.5] and names[1][1] == 'foe-goblin-bow', 'dropping the group places all of it in one click and numbers it on from the goblins already there (Goblin 3, Goblin 4)', names)
            await gm.evaluate('tw.undo()'); await gm.wait_for_timeout(500)
            check(await gm.evaluate("tw.lastPawns.ids.every(id => !tw.entities()[id])"), 'one undo takes the whole group away')
            await wait(gm, "tw.sync.campaign.cast[0].kind === 'group'", 3000, 'recents'); await open_p(gm)
            check((await gm.evaluate(ST))['cast'][0]['group'], 'using an entry brings it to the front (recents)')
            ow = await gm.evaluate("tw.sync.campaign.cast.find(c => c.kind === 'one').id")
            await gm.click(f"#pawnsTray [data-cast='{ow}']"); await gm.wait_for_timeout(250); await map_click(gm, 12.5, 7.5); await gm.wait_for_timeout(500)
            one = await gm.evaluate("tw.lastPawns.ids.map(id => tw.entities()[id]).map(e => [e.name, e.fig, e.size || 1, e.def])")
            check(len(one) == 1 and one[0][0].startswith('Owlbear') and one[0][1] == 'foe-owlbear' and one[0][2] == 2 and one[0][3] == ow, 'a named individual drops as one pawn with its figure', one)
            await gm.evaluate('tw.undo()'); await gm.wait_for_timeout(300)
            for i in range(6): await gm.evaluate(f"tw.sync.submit('cast.save', {{ id: 'cast_extra0000{i}', kind: 'one', name: 'CASTSECRET extra {i}', fig: 'town-human-guard' }})")
            await wait(gm, "tw.sync.campaign.cast.length === 8", 5000, 'eight'); await open_p(gm)
            st = await gm.evaluate(ST); hb = await gm.evaluate("document.querySelector('#pawnsTray [data-castall]')?.textContent || ''")
            await gm.mouse.move(100, 400); await gm.keyboard.press('c'); await gm.wait_for_timeout(250); st2 = await gm.evaluate(ST)
            check(len(st['cast']) == 6 and 'All 8' in hb and len(st2['cast']) == 8, 'the cast does not over-grow the menu: the six most recent show, the rest are behind "All 8" (C)', [len(st['cast']), hb, len(st2['cast'])])
            await gm.wait_for_timeout(300)
            # DRAG the saved group out: the whole group where it is let go, numbered, one undo
            n0 = await gm.evaluate(f"{TOK}.length")
            md = await drag_from(gm, f'#pawnsTray [data-cast="{c["id"]}"]', 27.5, 7.5)
            names = await gm.evaluate("tw.lastPawns.ids.map(id => tw.entities()[id]).filter(Boolean).map(e => [e.name, e.fig, e.x, e.z])")
            check(md['via'] and md['n'] == 2 and md['cells'] == 2 and md['vis'] == 'hidden' and await gm.evaluate(f"{TOK}.length") == n0 + 2 and [n[0] for n in names] == ['Goblin 3', 'Goblin 4'] and names[0][2:] == [27.5, 7.5], 'a saved group is dragged out of the cast: the whole group drops where it is let go, numbered', [md, names])
            await gm.evaluate('tw.undo()'); await gm.wait_for_timeout(500)
            check(await gm.evaluate(f"{TOK}.length") == n0, 'and one undo takes it away'); await open_p(gm)
            leaks = {n: await pg.evaluate("window.__rx.some(t => t.includes('CASTSECRET')) || 'cast' in tw.sync.campaign") for n, pg in pages.items() if n != 'Harry'}
            check(not any(leaks.values()) and await gm.evaluate("window.__rx.some(t => t.includes('CASTSECRET'))"), 'from the traffic: no player tab ever received a word of the cast (the GM\'s tab did)', leaks)
            await open_p(mi); check('cast' not in (await mi.evaluate(ST))['sections'], 'a player\'s menu has no cast section'); await closed(mi)
            await closed(gm)

        # ================= TABLE =================
        if want('TABLE'):
            print('TABLE: On the table, by kind')
            await view_home(gm); await gm.evaluate(f"tw.setHidden([{E(G2)}], false)"); await gm.wait_for_timeout(200); await open_p(gm)
            st = await gm.evaluate(ST); ks = {k['key']: k for k in st['kinds']}
            check('table' in st['sections'] and 'goblin' in ks and ks['goblin']['name'] == 'Goblin' and ks['goblin']['n'] == '×2' and ks['goblin']['damage'] == ['4'] and 'all' in ks['goblin']['acts'] and ks['owlbear']['n'] == '' and ks['owlbear']['pic'], 'every pawn here that is nobody\'s, by kind, with a count and the damage ("Goblin ×2", 4); a kind of one is just its name', st['kinds'])
            check(not any(k['key'] in ('brakka', 'elowen') for k in st['kinds']), 'the players\' pawns are not in it')
            await gm.click('#pawnsTray .krow[data-kind="goblin"] [data-kact="all"]'); await gm.wait_for_timeout(200)
            check(sorted(await gm.evaluate('[...tw.sel]')) == sorted([G1, G2]), 'select all of a kind')
            await gm.evaluate('tw.clearSelection()'); await gm.click('#pawnsTray .krow[data-kind="goblin"] [data-kgo]'); await gm.wait_for_timeout(500); a = await gm.evaluate('[...tw.sel]')
            await gm.click('#pawnsTray .krow[data-kind="goblin"] [data-kgo]'); await gm.wait_for_timeout(500); b = await gm.evaluate('[...tw.sel]')
            check(a == [G1] and b == [G2], 'go to: a click goes to the first of the kind, another click to the next', [a, b])
            await gm.evaluate(f"tw.setHidden([{E(G2)}], true)"); await wait(gm, f"{E(G2)}.hidden === true", 4000); await gm.wait_for_timeout(300)
            st = await gm.evaluate(ST); hid = [k for k in st['kinds'] if k['hidden']]
            look = await gm.evaluate("(() => { const r = document.querySelector('#pawnsTray .krow.hid'); const cs = getComputedStyle(r); return [cs.borderTopStyle, r.textContent.includes('hidden from players')]; })()")
            check(len(hid) == 1 and hid[0]['name'] == 'Goblin 2' and 'reveal' in hid[0]['acts'] and look == ['dashed', True] and next(k for k in st['kinds'] if k['key'] == 'goblin')['n'] == '', 'the GM: a hidden pawn is a row of its own in the hidden look (dashed, "hidden from players") with a Reveal button', hid)
            await shot(gm, 'pawnsmenu-table-gm.png', await tray_clip(gm))
            await open_p(mi); sm = await mi.evaluate(ST)
            check('table' in sm['sections'] and [k for k in sm['kinds'] if k['key'].startswith('goblin')] == [next(k for k in sm['kinds'] if k['key'] == 'goblin')] and not any(k['hidden'] for k in sm['kinds']) and not any('reveal' in k['acts'] for k in sm['kinds']) and await mi.evaluate(f"!{E(G2)}"), 'a player gets the section too, from what her client was sent: one goblin, no hidden row, no reveal', sm['kinds'])
            await shot(mi, 'pawnsmenu-table-player.png', await tray_clip(mi)); await closed(mi)
            await gm.click('#pawnsTray .krow.hid [data-kact="reveal"]'); await wait(gm, f"{E(G2)}.hidden === false", 4000); await gm.wait_for_timeout(300)
            st = await gm.evaluate(ST)
            check(not any(k['hidden'] for k in st['kinds']) and next(k for k in st['kinds'] if k['key'] == 'goblin')['n'] == '×2' and await wait(mi, f"!!{E(G2)}", 4000), 'Reveal: the goblins are one row of two again, and the player has the second goblin')
            await closed(gm)

        # ================= TURNS =================
        if want('TURNS'):
            print('TURNS: an order shown on the same rows')
            await view_home(gm); await open_p(gm)
            real = await gm.evaluate("!!tw.registry.get('turn.next') && typeof tw.turns === 'function'")
            if not real:
                # the turn order's data is another branch's work: draw the agreed shape (docs/PAWNS.md) from a stand-in
                await gm.evaluate(f"tw.turns = () => ({{ order: ['{BR}', 'kind:goblin', '{WI}'], at: 'kind:goblin', round: 2, init: {{ '{BR}': 17, 'kind:goblin': 12 }} }}); tw.refresh()"); await gm.wait_for_timeout(300)
            else:
                await gm.evaluate(f"tw.dispatch('turn.order', {{ order: ['{BR}', 'kind:goblin', '{WI}'] }}); tw.dispatch('turn.at', {{ key: 'kind:goblin' }})"); await wait(gm, "tw.view().turns && tw.view().turns.at === 'kind:goblin'", 5000, 'turns')
                await gm.wait_for_timeout(300)
            st = await gm.evaluate(ST)
            check(st['sections'][0] == 'turns' and [t['key'] for t in st['turns']] == [BR, 'kind:goblin', WI] and [t['cur'] for t in st['turns']] == [False, True, False] and st['turns'][0]['text'] == 'Brakka' and st['turns'][1]['text'] == 'Goblin', 'with a turn order, the party rows and the kinds are ONE list in that order, the marker on whose turn it is', st['turns'])
            head = await gm.evaluate("document.querySelector('#pawnsTray .psec[data-sec=turns] .blevel').textContent")
            rest = await gm.evaluate("[...document.querySelectorAll('#pawnsTray .psec[data-sec=turns] .blevel.sub ~ .prows .prow, #pawnsTray .psec[data-sec=turns] .blevel.sub ~ .krows .krow')].length")
            check('Turn order' in head and rest >= 2 and 'table' not in st['sections'], 'the round is in the header; whoever is not in the order is listed after it', [head, rest])
            await shot(gm, 'pawnsmenu-turns.png', await tray_clip(gm))
            if real:
                a = await at(gm, f'#pawnsTray .trow[data-tkey=\\"{WI}\\"] .pname'); b2 = await at(gm, f'#pawnsTray .trow[data-tkey=\\"{BR}\\"] .pname')
                await gm.mouse.move(a['x'], a['y']); await gm.mouse.down(); await gm.mouse.move(a['x'], a['y'] - 20, steps=4); await gm.mouse.move(b2['x'], b2['y'] - 30, steps=8); await gm.mouse.up()
                check(await wait(gm, f"tw.view().turns.order[0] === '{WI}'", 5000, 'reordered') and await gm.evaluate("tw.view().turns.at === 'kind:goblin'"), 'the GM drags a row: the order changes for everyone, the marker stays on the same one')
                await open_p(mi); sm = await mi.evaluate(ST)
                check([t['key'] for t in sm['turns']][0] == WI and not await mi.evaluate("!!document.querySelector('#pawnsTray .prows.turns.can')"), 'a player sees the same order and cannot drag it')
                await closed(mi); await gm.evaluate("tw.dispatch('turn.end', {})"); await gm.wait_for_timeout(300)
            else:
                check(not await gm.evaluate("!!document.querySelector('#pawnsTray .prows.turns.can')"), '(no turn.order command on this build yet: no drag is offered)')
                await gm.evaluate("delete tw.turns; tw.refresh()")
            await closed(gm)

        fails = [r for r in results if not r[0]]
        if errors: print('page errors:', errors[:5])
        check(not errors, 'no page errors', errors[:3])
        await browser.close()

try:
    asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
n = sum(1 for r in results if r[0])
print(f'pawnsmenu: {n}/{len(results)} passed')
sys.exit(0 if n == len(results) and results else 1)

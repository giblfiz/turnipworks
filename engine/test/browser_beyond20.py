#!/usr/bin/env python3
"""BEYOND20 INTAKE (2026-10-29; docs/BEYOND20.md). Two seats: the GM (Harry) and a player (Mira). Beyond20 is SIMULATED in
Mira's tab by dispatching the DOM CustomEvents its generic-site content script sends (src/common/utils.js
forwardMessageToDOM: Beyond20_<Name> with an array `detail`), the request objects shaped exactly as its RollRenderer builds
them (roll_renderer.js postDescription; dice.js toJSON), each carrying a SECRET description, html, roll_info, source and
feature list that must never reach anything.
  B1  without Beyond20 nothing shows: no note, not connected (the Attack button is there regardless)
  B2  Beyond20_Loaded: a small "Beyond20 connected" note; connected
  B3  a roll maps BY SHEET URL (the pawn whose sheet is the same D&D Beyond character) and is thrown from that pawn
  B4  FORCED FACES: Beyond20's numbers land on the 3D dice on BOTH tabs (one recording, one synced dice.roll); the line's
      total and dice are Beyond20's; advantage is one throw of two d20s
  B5  by NAME (a pawn of the seat's with the character's name): offered "Link <character>'s sheet to <pawn>"; one click sets
      the pawn's sheet (token.set)
  B6  via the MAIN pawn, and the offer for it
  B7  nothing matches (the GM, a monster): the offer is for the selected pawn; one click links it
  B8  an attack: to hit then damage, two throws, one after the other; the lines say what they were
  B9  NO DESCRIPTION TEXT anywhere: not in either tab's chat state or page text, not in any byte either page sent or received,
      not on the relay's disk (journal, snapshot: local runs)
  B10 initiative into the existing turn order
  B11 UpdateHP -> damage = max - current; UpdateConditions -> the pawn's conditions (prone, paralyzed; unmatched words as text labels: browser_statusfx.py)
  B12 the Attack button: on the ring of a linked pawn only (not an unlinked one, not on the GM's tab with no Beyond20); it
      lists the attacks seen; picking one and clicking a target logs "<pawn> attacks <target>: d20+5 = N" in both tabs
  B15 targeting: T over a pawn aims your pawn at it, T over ground and Esc clear it, the ring's Target button; both seats draw
      the reticle (the line where either end is selected); a Beyond20 attack logs "<pawn> attacks <target>"; GET state/scene
      list it and the card explains it
  B16 no engine: "+ Add attack" saves name / to hit / damage on the pawn; picking it rolls at the target then damage; edit, remove
  B17 saved attacks last: after a reload (Beyond20 silent) the linked pawn still lists Beyond20's Longsword; so does the GM
  B18 an AI seat sets saved attacks over GET; one with a description is refused
  B13 a whispered roll never reaches the table: the GM gets it as a whisper
  B14 UpdateCombat is ignored; no page errors
Stills: engine/test/shots/b20-*.png
  local: python3 engine/test/browser_beyond20.py --local   (TW_PORTS=relay,site)
  dev:   ... browser_beyond20.py --page http://127.0.0.1:8180/
"""
import argparse, asyncio, glob, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request, shutil
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox
tw_sandbox.remove_campaigns()  # the campaign this suite makes is a throwaway
SOFT = os.environ.get('TW_GPU', '1') == '0'
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] if SOFT else ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
JOIN_MS = 240000 if SOFT else 90000
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE); SHOTS = os.path.join(HERE, 'shots')
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); A = ap.parse_args()
results = []; procs = []; tmp = []; DATA = None
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:500] if detail != '' else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18391,18392').split(','))
def start_local():
    global DATA
    import socket
    for port in (RP, SP):
        with socket.socket() as sk:
            if sk.connect_ex(('127.0.0.1', port)) == 0: sys.exit(f'port {port} is in use (a stale test server?): stop it first, or TW_PORTS=a,b')
    DATA = tempfile.mkdtemp(prefix='tw-b20-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([DATA, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(DATA, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': DATA, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=50); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
# every byte the page receives and sends (websocket frames, server-sent events, POST bodies)
RX = """(() => { window.__rx = []; window.__tx = [];
  { const send = window.WebSocket.prototype.send; window.WebSocket.prototype.send = function (d) { try { window.__tx.push(String(d)); } catch { } return send.call(this, d); }; }
  const WS = window.WebSocket; window.WebSocket = class extends WS { constructor(...a) { super(...a); this.addEventListener('message', (ev) => { try { window.__rx.push(String(ev.data)); } catch { } }); } };
  const ES = window.EventSource; if (ES) window.EventSource = class extends ES { constructor(...a) { super(...a); this.addEventListener('message', (ev) => { try { window.__rx.push(String(ev.data)); } catch { } }); } };
  const F = window.fetch; window.fetch = async (...a) => { try { if (typeof a[1]?.body === 'string') window.__tx.push(a[1].body); } catch { } const r = await F(...a); try { const u = String(a[0]?.url || a[0]); if (!/\\.(glb|png|webp|js|json|ktx2|bin|jpg|wasm)(\\?|$)/.test(u)) r.clone().text().then(t => window.__rx.push(t)).catch(() => {}); } catch { } return r; }; })()"""
LAST = "tw.view().chat.slice(-1)[0]"
INFO = "tw.dice.info()"
def throw_of(i): return f"{INFO}.find(t => t.id === '{i}')"
LOOK = "(x, z, dist) => { const g = tw.main.grab; g.focus.set(x, 0, z); g.dist = dist; g.pitch = 55; g.yaw = 0; g.update(); }"
SECRET = 'SECRET-WOTC-TEXT-91c2'

# ---------- Beyond20's shapes (its dice.js toJSON and roll_renderer.js postDescription) ----------
def die(faces, rolls, mods=''):
    rs = [{'roll': r} if isinstance(r, int) else r for r in rolls]
    return {'total': sum(r['roll'] for r in rs if not r.get('discarded')), 'formula': f"{len(rs)}d{faces}{mods}", 'rolls': rs, 'amount': len(rs), 'faces': faces, 'modifiers': mods}
def roll(parts, kind='to-hit', discarded=False, crit=False, fumble=False):
    t, add = 0, True
    for p in parts:
        if p in ('+', '-'): add = p == '+'
        else: v = p if isinstance(p, (int, float)) else p['total']; t += v if add else -v
    return {'formula': ' '.join(p['formula'] if isinstance(p, dict) else str(p) for p in parts), 'parts': parts, 'fail-limit': None, 'critical-limit': None, 'critical-failure': fumble, 'critical-success': crit, 'discarded': discarded, 'type': kind, 'total': t}
def char(name, cid, kind='characters', hp=30, maxhp=30, conds=()):
    url = f"https://www.dndbeyond.com/{kind}/{cid}" + ('-' + name.lower().replace(' ', '-') if kind == 'monsters' else '')
    return {'name': name, 'type': 'Character' if kind == 'characters' else 'Monster', 'url': url, 'id': str(cid), 'source': 'D&D Beyond', 'avatar': 'https://www.dndbeyond.com/avatars/1.png',
            'abilities': [['Strength', 'STR', '16', '+3']], 'classes': {'Fighter': 3}, 'level': '3', 'race': 'Dwarf', 'ac': '16', 'proficiency': '+2', 'speed': 25,
            'hp': hp, 'max-hp': maxhp, 'temp-hp': 0, 'exhaustion': 0, 'conditions': list(conds), 'class-features': [SECRET], 'racial-traits': [SECRET], 'feats': [SECRET], 'actions': [SECRET], 'settings': {}}
def rendered(c, req, attack_rolls=(), damage_rolls=(), whisper=0):
    request = {'action': 'roll', 'character': c, 'roll': '1d20', 'advantage': 0, 'whisper': whisper, 'preview': 'https://www.dndbeyond.com/x.png', **req}
    return {'action': 'rendered-roll', 'rendered': 'fallback', 'request': request, 'title': req.get('name') or req.get('skill') or 'Roll',
            'html': f"<div class='beyond20-message'><details><summary>{SECRET}</summary><div class='beyond20-description'>{SECRET}</div></details></div>",
            'character': c['name'], 'whisper': whisper, 'play_sound': True, 'source': SECRET, 'attributes': {'Range': SECRET}, 'description': SECRET,
            'attack_rolls': list(attack_rolls), 'roll_info': [['Effects', SECRET]], 'damage_rolls': list(damage_rolls), 'total_damages': {}, 'open': False}
SEND = "([name, detail]) => document.dispatchEvent(new CustomEvent('Beyond20_' + name, { detail }))"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}, device_scale_factor=1); await ctx.add_init_script(RX)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.on('console', lambda m: errors.append(m.text[:200]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
            await pg.goto(url); return pg
        async def action(pg, code):
            await pg.evaluate(code); await wait(pg, 'tw.sync.pendingCount() === 0', 15000, 'command accepted'); await pg.wait_for_timeout(250)
        async def b20(pg, name, *detail):
            await pg.evaluate(SEND, [name, list(detail)])
        async def idle(pg, t=20000):  # the Beyond20 queue has finished (each roll's dice settled) and nothing is unconfirmed
            await pg.wait_for_timeout(300)
            return await wait(pg, "(() => { const s = tw.b20; return !!s && tw.sync.pendingCount() === 0 && !tw.dice.busy() && (window.__b20busy = (window.__b20busy || 0)) >= 0; })()", t, 'b20 idle')
        async def done_rolls(pg, n, t=30000):
            return await wait(pg, f"tw.b20.seen.rolls >= {n} && tw.b20.log.filter(l => l.ev === 'roll').length >= {n} && tw.sync.pendingCount() === 0", t, f'{n} rolls handled')

        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', f"TEST beyond20 {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw?.ready?.() && tw.fog && tw.dice && tw.b20', JOIN_MS), 'GM did not come up'
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        pl = await tab(invite)
        assert await wait(pl, 'window.tw?.ready?.() && tw.fog && tw.dice && tw.b20', JOIN_MS), 'player did not join'
        seat = await pl.evaluate('tw.me()')
        await gm.evaluate('tw.spawnRoom("common", 0, 0, 6, 5, 7711)')
        await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        TH, BR, MI, GB = 'tok_b20thorin1', 'tok_b20brakka1', 'tok_b20mira001', 'tok_b20gobln01'
        await action(gm, 'tw.batch(' + json.dumps([
            {'type': 'token.create', 'args': {'id': TH, 'name': 'Thorin', 'x': 7.5, 'z': 12.5, 'owner': seat, 'sheet': 'https://www.dndbeyond.com/characters/111111'}},
            {'type': 'token.create', 'args': {'id': BR, 'name': 'Brakka', 'x': 12.5, 'z': 12.5, 'owner': seat}},
            {'type': 'token.create', 'args': {'id': MI, 'name': 'Mira', 'x': 17.5, 'z': 12.5, 'owner': seat, 'main': True}},
            {'type': 'token.create', 'args': {'id': GB, 'name': 'Goblin 1', 'x': 12.5, 'z': 20}}]) + ')')
        await wait(pl, f"!!tw.entities()['{GB}'] && !!tw.entities()['{TH}']", 15000)
        for pg in (gm, pl): await pg.evaluate(f"({LOOK})(12.5, 14, 34)")
        await pl.wait_for_timeout(1500)

        print('B1 WITHOUT BEYOND20')
        await pl.evaluate(f"tw.select(['{TH}'])"); await pl.wait_for_timeout(600)
        b1 = await pl.evaluate("({ connected: tw.b20.connected, toast: document.querySelector('#toast')?.textContent || '', btn: !!document.querySelector('.rbtn[data-id=\"pawn.attack\"]') })")
        check(not b1['connected'] and 'Beyond20' not in b1['toast'] and b1['btn'], 'B1 without Beyond20: no note, not connected; the Attack button is there anyway (it always is, on a pawn one acts for)', b1)

        print('B2 LOADED')
        await b20(pl, 'Loaded', {'custom-domains': ['https://dev.turnipworks.net/*']})
        ok2 = await wait(pl, "tw.b20.connected && /Beyond20 connected/.test(document.querySelector('#toast')?.textContent || '')", 5000)
        check(ok2, 'B2 Beyond20_Loaded: "Beyond20 connected" note', await pl.evaluate("document.querySelector('#toast')?.textContent"))
        await b20(pl, 'NewSettings', {'whisper-type': 0}, 'chrome-extension://x/')

        print('B3 + B4 BY SHEET URL, FORCED FACES, ADVANTAGE')
        thorin = char('Thorin Oakenshield', 111111)
        await pl.evaluate("tw.select([])")
        await b20(pl, 'RenderedRoll', rendered(thorin, {'type': 'skill', 'skill': 'Athletics', 'ability': 'STR', 'modifier': '+5', 'proficiency': 'Proficient', 'advantage': 3},
                                              [roll([die(20, [17]), '+', 5], 'skill-check'), roll([die(20, [4]), '+', 5], 'skill-check', discarded=True)]))
        await done_rolls(pl, 1)
        lg = await pl.evaluate("tw.b20.log.filter(l => l.ev === 'roll').slice(-1)[0]")
        rid = lg['ids'][0] if lg and lg.get('ids') else None
        last = await pl.evaluate('tw.dice.last')
        check(lg and lg['pawn'] == TH and lg['how'] == 'sheet' and last and abs(last['from']['x'] - 7.5) < 0.01 and abs(last['from']['z'] - 12.5) < 0.01, 'B3 mapped BY SHEET URL to Thorin; the dice are thrown from Thorin', {'log': lg, 'from': last and last['from']})
        await wait(pl, f"{throw_of(rid)}?.settled", 15000); await wait(gm, f"{throw_of(rid)}?.settled", 15000)
        a = await pl.evaluate(throw_of(rid)); g = await gm.evaluate(throw_of(rid))
        line = await gm.evaluate(f"tw.view().chat.find(c => c.id === '{rid}')")
        check(a and g and [d['reads'] for d in a['dice']] == [17, 4] and [d['reads'] for d in g['dice']] == [17, 4] and line and line['roll']['total'] == 22 and line['roll']['rolls'] == [17, 4] and line['roll']['expr'] == 'd20+5 adv' and line['roll']['info']['adv'] == 'adv',
              'B4 FORCED FACES: Beyond20\'s 17 and 4 land face up on BOTH tabs (one throw, two d20s); the line is Beyond20\'s: d20+5 adv = 22', {'player': [d['reads'] for d in a['dice']] if a else None, 'gm': [d['reads'] for d in g['dice']] if g else None, 'line': line and line['roll']})
        same = a and g and all(abs(x - y) < 1e-4 for da, db in zip(a['dice'], g['dice']) for x, y in zip(da['p'] + da['q'], db['p'] + db['q']))
        check(same, 'B4b one recording: both seats end with identical final poses')
        cx = sum(d['p'][0] for d in a['dice']) / len(a['dice']) if a else 8; cz = sum(d['p'][2] for d in a['dice']) / len(a['dice']) if a else 13
        await pl.evaluate(f"({LOOK})({cx}, {cz}, 16)"); await pl.wait_for_timeout(900)
        await pl.screenshot(path=os.path.join(SHOTS, 'b20-dice-landed.png'))
        await pl.evaluate(f"({LOOK})(12.5, 14, 34)")

        print('B5 BY NAME, AND THE LINK OFFER')
        brakka = char('Brakka', 222222, hp=18, maxhp=24)
        await b20(pl, 'RenderedRoll', rendered(brakka, {'type': 'ability', 'name': 'Strength', 'ability': 'STR', 'modifier': '+3'}, [roll([die(20, [9]), '+', 3], 'ability-check')]))
        await done_rolls(pl, 2)
        lg5 = await pl.evaluate("tw.b20.log.filter(l => l.ev === 'roll').slice(-1)[0]")
        offer = await pl.evaluate("tw.condButtons.list().filter(b => b.visible).map(b => b.text)")
        await pl.screenshot(path=os.path.join(SHOTS, 'b20-link-offer.png'))
        clicked = await pl.evaluate("(() => { const b = [...document.querySelectorAll('.cbtn')].find(b => /Link Brakka's sheet to Brakka/.test(b.textContent)); if (!b) return false; b.click(); return true; })()")
        linked5 = await wait(gm, f"tw.entities()['{BR}']?.sheet === 'https://www.dndbeyond.com/characters/222222'", 8000)
        check(lg5 and lg5['pawn'] == BR and lg5['how'] == 'name' and any("Link Brakka's sheet to Brakka" in t for t in offer) and clicked and linked5, 'B5 mapped BY NAME to Brakka; "Link Brakka\'s sheet to Brakka" offered; one click sets the sheet (seen by the GM)', {'log': lg5, 'offers': offer})

        print('B6 VIA THE MAIN PAWN')
        zed = char('Zedd the Bold', 333333)
        await b20(pl, 'RenderedRoll', rendered(zed, {'type': 'saving-throw', 'name': 'Dexterity', 'ability': 'DEX', 'modifier': '+2'}, [roll([die(20, [11]), '+', 2], 'saving-throw')]))
        await done_rolls(pl, 3)
        lg6 = await pl.evaluate("tw.b20.log.filter(l => l.ev === 'roll').slice(-1)[0]")
        off6 = await pl.evaluate("tw.b20.offer")
        check(lg6 and lg6['pawn'] == MI and lg6['how'] == 'main' and off6 and off6['id'] == MI, 'B6 no sheet, no name: the seat\'s MAIN pawn (Mira); the link is offered for it', {'log': lg6, 'offer': off6})

        print('B7 NOTHING MATCHES (the GM, a monster)')
        await b20(gm, 'Loaded', {})
        await gm.evaluate(f"tw.select(['{GB}'])"); await gm.wait_for_timeout(400)
        ogre = char('Ogre', 16907, kind='monsters')
        await b20(gm, 'RenderedRoll', rendered(ogre, {'type': 'ability', 'name': 'Strength', 'ability': 'STR', 'modifier': '+4'}, [roll([die(20, [6]), '+', 4], 'ability-check')]))
        await done_rolls(gm, 1)
        lg7 = await gm.evaluate("tw.b20.log.filter(l => l.ev === 'roll').slice(-1)[0]"); off7 = await gm.evaluate("tw.b20.offer")
        c7 = await gm.evaluate("(() => { const b = [...document.querySelectorAll('.cbtn')].find(b => /Link Ogre's sheet to Goblin 1/.test(b.textContent)); if (!b) return false; b.click(); return true; })()")
        linked7 = await wait(pl, f"(tw.entities()['{GB}']?.sheet || '').startsWith('https://www.dndbeyond.com/monsters/16907')", 8000)
        check(lg7 and lg7['pawn'] is None and off7 and off7['id'] == GB and c7 and linked7, 'B7 nothing matches: "Link Ogre\'s sheet to Goblin 1" (the selected pawn); one click links it', {'log': lg7, 'offer': off7})
        await gm.evaluate("tw.select([])")

        print('B8 AN ATTACK: TO HIT, THEN DAMAGE')
        await pl.evaluate("tw.dice.clear()")
        SEEN = "(() => { window.__seen = {}; setInterval(() => { for (const t of tw.dice.info()) if (t.settled && !window.__seen[t.id]) window.__seen[t.id] = t.dice.map(d => d.reads); }, 50); })()"
        for pg in (gm, pl): await pg.evaluate(SEEN)
        n0 = await gm.evaluate("tw.view().chat.length")
        await b20(pl, 'RenderedRoll', rendered(thorin, {'type': 'attack', 'name': 'Longsword', 'description': SECRET, 'to-hit': '+5', 'damages': ['1d8+3'], 'damage-types': ['Slashing'],
                                                       'critical-damages': ['1d8'], 'critical-damage-types': ['Slashing'], 'rollAttack': True, 'rollDamage': True, 'rollCritical': False, 'attack-source': 'item', 'attack-type': 'Melee', 'reach': '5 ft.', 'properties': ['Versatile'], 'proficient': True},
                                              [roll([die(20, [14]), '+', 5])], [['Slashing', roll([die(8, [6]), '+', 3], 'damage'), 1], [SECRET, '', 0]]))
        await done_rolls(pl, 4, 40000)
        await wait(gm, f"tw.view().chat.length >= {n0 + 2}", 15000)
        new = await gm.evaluate(f"tw.view().chat.slice({n0}).map(c => ({{ text: c.text, roll: c.roll }}))")
        lg8 = await pl.evaluate("tw.b20.log.filter(l => l.ev === 'roll').slice(-1)[0]")
        await wait(gm, f"Object.keys(window.__seen).length >= 2", 15000, 'gm saw both throws settle')
        seen_p = await pl.evaluate("window.__seen"); seen_g = await gm.evaluate("window.__seen")
        ids8 = lg8['ids'] if lg8 else []
        t1 = [seen_p.get(ids8[0]), seen_g.get(ids8[0])] if ids8 else None; t2 = [seen_p.get(ids8[1]), seen_g.get(ids8[1])] if len(ids8) > 1 else None
        check(len(new) == 2 and new[0]['roll']['expr'] == 'd20+5' and new[0]['roll']['total'] == 19 and new[0]['text'] == 'Thorin rolls Longsword' and new[1]['roll']['expr'] == 'd8+3' and new[1]['roll']['total'] == 9 and new[1]['roll']['info']['types'] == ['Slashing']
              and t1 == [[14], [14]] and t2 == [[6], [6]], 'B8 an attack with no target: "Thorin rolls Longsword"; two lines (to hit 19, damage 9 slashing), two throws one after the other, each landing on Beyond20\'s die on both tabs', {'lines': new, 'to_hit': t1, 'damage': t2})

        print('B9 NO DESCRIPTION TEXT ANYWHERE')
        await pl.wait_for_timeout(800)
        leaks = {}
        for nm, pg in (('gm', gm), ('mira', pl)):
            leaks[nm] = await pg.evaluate(f"""(() => {{ const S = '{SECRET}'; return {{
              chat: JSON.stringify(tw.view().chat).includes(S), page: document.body.innerText.includes(S), html: document.body.innerHTML.includes(S),
              rx: window.__rx.filter(x => x.includes(S)).length, tx: window.__tx.filter(x => x.includes(S)).length, rxN: window.__rx.length, txN: window.__tx.length }}; }})()""")
        disk = None
        if DATA:
            disk = {'files': 0, 'hits': []}
            for f in glob.glob(os.path.join(DATA, '**', '*'), recursive=True):
                if os.path.isfile(f) and not f.endswith('relay.log'):
                    disk['files'] += 1
                    with open(f, 'rb') as fh:
                        if SECRET.encode() in fh.read(): disk['hits'].append(os.path.relpath(f, DATA))
        clean = all(not v['chat'] and not v['page'] and not v['html'] and v['rx'] == 0 and v['tx'] == 0 and v['txN'] > 0 for v in leaks.values()) and (disk is None or (disk['files'] > 0 and not disk['hits']))
        check(clean, f"B9 NO description, spell or feature text anywhere: chat state, page text, every byte sent and received{', the relay disk' if disk else ''}", {'tabs': leaks, 'disk': disk})

        print('B10 INITIATIVE INTO THE TURN ORDER')
        await action(gm, "tw.registry.run('turn.start')")
        await wait(pl, "!!tw.turns()", 8000)
        await b20(pl, 'RenderedRoll', rendered(thorin, {'type': 'initiative', 'initiative': '+2', 'advantage': 0}, [roll([die(20, [16]), '+', 2], 'initiative')]))
        await done_rolls(pl, 5)
        ok10 = await wait(gm, f"tw.turns()?.init?.['{TH}'] === 18", 8000)
        t10 = await gm.evaluate("JSON.parse(JSON.stringify(tw.turns()))")
        check(ok10 and t10['order'][0] == TH, 'B10 an initiative roll of 18 sets Thorin\'s number in the turn order (and puts him first)', t10)

        print('B11 HP AND CONDITIONS')
        await b20(pl, 'UpdateHP', {'action': 'hp-update', 'character': {**thorin, 'hp': 21, 'max-hp': 30}}, thorin['name'], 21, 30, 0)
        ok11 = await wait(gm, f"tw.entities()['{TH}']?.damage === 9", 8000)
        await b20(pl, 'UpdateHP', {'action': 'hp-update', 'character': {**thorin, 'hp': 40, 'max-hp': 30}}, thorin['name'], 40, 30, 5)
        ok11b = await wait(gm, f"!tw.entities()['{TH}']?.damage", 8000)
        await b20(pl, 'UpdateConditions', {'action': 'conditions-update', 'character': {**thorin, 'conditions': ['Prone', 'Paralyzed']}}, thorin['name'], ['Prone', 'Paralyzed'], 0)
        ok11c = await wait(gm, f"JSON.stringify(tw.entities()['{TH}']?.conditions) === '[\"prone\",\"paralyzed\"]'", 8000)
        check(ok11 and ok11b and ok11c, 'B11 HP 21/30 -> damage 9; 40/30 -> 0 (never below); conditions Prone + Paralyzed -> prone, paralyzed (both TW words since 2026-10-29)', await gm.evaluate(f"(({{ damage, conditions }}) => ({{ damage, conditions }}))(tw.entities()['{TH}'])"))

        print('B12 THE ATTACK BUTTON')
        await pl.evaluate("tw.dice.clear()")
        await pl.evaluate(f"tw.select(['{MI}'])"); await pl.wait_for_timeout(700)
        unlinked = await pl.evaluate("!!document.querySelector('.rbtn[data-id=\"pawn.attack\"]')")
        await gm.evaluate(f"tw.select(['{TH}'])"); await gm.wait_for_timeout(700)
        gm_btn = await gm.evaluate("!!document.querySelector('.rbtn[data-id=\"pawn.attack\"]')")  # (the GM's Beyond20 has seen no attack for Thorin; but it IS connected and Thorin linked: the button shows, its list says none yet)
        await gm.evaluate("tw.select([])")
        await pl.evaluate(f"({LOOK})(7.5, 9, 46)"); await pl.evaluate(f"tw.select(['{TH}'])"); await pl.wait_for_timeout(900)
        linked_btn = await pl.evaluate("!!document.querySelector('.rbtn[data-id=\"pawn.attack\"]')")
        await pl.screenshot(path=os.path.join(SHOTS, 'b20-attack-button.png'))
        await pl.evaluate("document.querySelector('.rbtn[data-id=\"pawn.attack\"]')?.click()"); await pl.wait_for_timeout(900)
        fly = await pl.evaluate("tw.ringFlyout()")
        await pl.screenshot(path=os.path.join(SHOTS, 'b20-attack-list.png'))
        saved8 = await gm.evaluate(f"tw.entities()['{TH}']?.attacks || null")
        check(unlinked and linked_btn and gm_btn and fly and fly['group'] == 'attack' and fly['tiles'][:1] == ['Longsword +5'] and '+ Add attack' in fly['tiles'] and saved8 == [{'name': 'Longsword', 'hit': '+5', 'dmg': 'd8+3'}],
              'B12a the Attack button on every pawn one acts for (Thorin, unlinked Mira; the GM on Thorin); Beyond20\'s Longsword was SAVED on Thorin (seen by the GM) and is listed, with "+ Add attack"', {'unlinked': unlinked, 'linked': linked_btn, 'gm_tab': gm_btn, 'list': fly, 'saved': saved8})
        await pl.evaluate("document.querySelector('.rbtn[data-nest][data-id=\"attack:0\"]')?.click()"); await pl.wait_for_timeout(400)
        picking = await pl.evaluate("tw.attacks.picking")
        n1 = await gm.evaluate("tw.view().chat.length")
        await pl.evaluate(f"tw.select(['{GB}'])")
        ok12 = await wait(gm, f"tw.view().chat.slice({n1}).some(c => c.text === 'Thorin attacks Goblin 1') && tw.view().chat.slice({n1}).some(c => c.text === 'Thorin: Longsword damage on Goblin 1')", 20000)
        l12 = await gm.evaluate(f"tw.view().chat.slice({n1}).find(c => c.text === 'Thorin attacks Goblin 1')")
        d12 = await gm.evaluate(f"tw.view().chat.slice({n1}).find(c => c.text === 'Thorin: Longsword damage on Goblin 1')")
        DOM = f"(document.querySelector('#chat .line[data-id=\"{l12['id'] if l12 else ''}\"]:not(.pending)')?.textContent || '')"
        await wait(pl, f"{DOM}.includes('Thorin attacks Goblin 1')", 15000, 'player line shown'); await wait(gm, f"{DOM}.includes('Thorin attacks Goblin 1')", 15000, 'gm line shown')
        txt = await pl.evaluate(DOM); txt_g = await gm.evaluate(DOM)
        check(picking and ok12 and l12['roll']['expr'] == 'd20+5' and l12['roll']['info'].get('src') == 'tw' and l12['roll']['info'].get('target') == 'Goblin 1' and all('Thorin attacks Goblin 1: d20+5 = ' in ' '.join(x.split()) for x in (txt, txt_g)) and d12 and d12['roll']['expr'] == 'd8+3',
              'B12b pick Longsword, click Goblin 1: TW rolls d20+5 then d8+3; the log reads "Thorin attacks Goblin 1: d20+5 = N" (both tabs), then "Thorin: Longsword damage on Goblin 1"', {'picking': picking, 'line': l12 and {'text': l12['text'], 'roll': l12['roll']}, 'damage': d12 and d12['roll'], 'shown': [txt, txt_g]})

        tgt12 = await wait(gm, f"tw.entities()['{TH}']?.target === '{GB}'", 8000)
        check(tgt12, 'B12c the target picked for the attack is now Thorin\'s target (seen by the GM)', await gm.evaluate(f"tw.entities()['{TH}']?.target"))

        print('B15 TARGETING: T, THE RING BUTTON, BOTH SEATS, BEYOND20, THE GET API')
        await pl.evaluate("tw.dice.clear()"); await pl.evaluate(f"({LOOK})(12.5, 15, 30)"); await gm.evaluate(f"({LOOK})(12.5, 15, 30)"); await pl.wait_for_timeout(600)
        async def hover(pg, x, z):
            await wait(pg, "!tw.announce.info().showing", 15000, 'the roll announce has gone')  # (the big announce sits mid-screen and takes the pointer)
            pt = await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, 1)"); await pg.mouse.move(pt['x'], pt['y']); await pg.wait_for_timeout(250); await pg.mouse.move(pt['x'] + 1, pt['y'] + 1); await pg.wait_for_timeout(250)
        await pl.evaluate(f"tw.select(['{TH}'])"); await pl.wait_for_timeout(400); await pl.evaluate("tw.select([])"); await pl.wait_for_timeout(300)  # (Thorin is Mira's last selected pawn; his ring is shut so it covers nothing)
        await hover(pl, 12.5, 12.5); hov = await pl.evaluate("tw.hover")
        await pl.keyboard.press('t')
        okT = await wait(gm, f"tw.entities()['{TH}']?.target === '{BR}'", 8000)
        await pl.evaluate(f"tw.select(['{TH}'])"); await pl.wait_for_timeout(300)
        await gm.evaluate("tw.select([])"); await gm.wait_for_timeout(500)
        gi = await gm.evaluate("tw.targets.info()"); pi = await pl.evaluate("tw.targets.info()")
        both = any(t['attacker'] == TH and t['target'] == BR and not t['line'] and t['picture'] == 'reticle' for t in gi) and any(t['attacker'] == TH and t['target'] == BR and t['line'] for t in pi)
        check(okT and both, 'B15a T over Brakka (Thorin selected) aims Thorin at Brakka; BOTH seats draw the reticle on Brakka; the line shows where Thorin is selected (Mira), not on the GM\'s screen', {'hover': hov, 'gm': gi, 'mira': pi})
        await pl.screenshot(path=os.path.join(SHOTS, 'b20-target-line.png'))
        await hover(pl, 2.5, 24.5); await pl.keyboard.press('t')
        okC = await wait(gm, f"!tw.entities()['{TH}']?.target", 8000)
        check(okC and not await gm.evaluate("tw.targets.info().length"), 'B15b T over empty ground clears it (the reticle goes on both)', await gm.evaluate(f"tw.entities()['{TH}']?.target || null"))
        await pl.evaluate(f"({LOOK})(12.5, 20, 30)"); await pl.evaluate(f"tw.select(['{GB}'])"); await pl.wait_for_timeout(800)
        tb = await pl.evaluate("(() => { const b = document.querySelector('.rbtn[data-id=\"pawn.target\"]'); return b ? { title: b.title || b.dataset.tip || '', shown: true } : null; })()")
        await pl.screenshot(path=os.path.join(SHOTS, 'b20-target-button.png'))
        await pl.evaluate("document.querySelector('.rbtn[data-id=\"pawn.target\"]')?.click()")
        okR = await wait(gm, f"tw.entities()['{TH}']?.target === '{GB}'", 8000)
        check(tb and okR, 'B15c the ring\'s Target button on Goblin 1 aims Mira\'s last pawn (Thorin) at it', tb)
        await pl.evaluate("tw.select([])"); await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(12.5, 0, 17); g.dist = 22; g.pitch = 62; g.yaw = Math.PI; g.update(); })()"); await gm.wait_for_timeout(1500)
        await gm.screenshot(path=os.path.join(SHOTS, 'b20-target-reticle.png'))
        await gm.evaluate(f"({LOOK})(12.5, 15, 30)")
        await pl.wait_for_timeout(300)
        n4 = await gm.evaluate("tw.view().chat.length")
        await b20(pl, 'RenderedRoll', rendered(thorin, {'type': 'attack', 'name': 'Longsword', 'description': SECRET, 'to-hit': '+5', 'damages': ['1d8+3'], 'damage-types': ['Slashing'], 'rollAttack': True, 'rollDamage': False},
                                              [roll([die(20, [8]), '+', 5])]))
        await wait(gm, f"tw.view().chat.length > {n4}", 20000)
        l15 = await gm.evaluate(LAST)
        check(l15 and l15['text'] == 'Thorin attacks Goblin 1' and l15['roll']['total'] == 13 and l15['roll']['info'].get('target') == 'Goblin 1', 'B15d a Beyond20 attack from Thorin uses his target: "Thorin attacks Goblin 1: d20+5 = 13"', l15 and {'text': l15['text'], 'roll': l15['roll']})
        card = await gm.evaluate("async () => tw.cardUrl(await tw.createSeat({kind:'llm', name:'Helper', scope:{areas:'*', classes:['chat','pawn']}}))")
        cbase, tok = card.split('/card?')[0], urllib.parse.parse_qs(urllib.parse.urlparse(card).query)['seat'][0]
        area = await gm.evaluate('tw.area()')
        def get(u):
            with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'TurnipWorks-acceptance/1.0', **tw_sandbox.HEADERS}), timeout=30) as r: return r.read().decode()
        st = json.loads(get(f"{cbase}/a/{area}/state?seat={tok}")); sc = json.loads(get(f"{cbase}/a/{area}/scene?seat={tok}")); ctext = get(card)
        th_s = next((t for t in st.get('tokens', []) if t['id'] == TH), None); th_c = next((t for t in sc.get('pawns', []) if t['id'] == TH), None); br_s = next((t for t in st.get('tokens', []) if t['id'] == BR), None)
        check(th_s and th_s.get('target') == GB and th_s.get('targetName') == 'Goblin 1' and th_c and th_c.get('target') == GB and br_s and 'target' not in br_s and 'TARGET:' in ctext and '"attack"' in ctext,
              'B15e the GET API: state and scene list Thorin\'s target (Goblin 1); a pawn with none has none; the card says a player\'s "attack" means it', {'state': th_s, 'scene': th_c, 'card': [l for l in ctext.splitlines() if 'TARGET' in l][:1]})
        await pl.evaluate(f"tw.select(['{TH}'])"); await pl.wait_for_timeout(300); await pl.evaluate("tw.select([])"); await pl.wait_for_timeout(300)
        esc_open = await pl.evaluate("tw.escapeStack.length")
        await pl.mouse.move(5, 400)
        for _ in range(4):  # Esc closes whatever is open first (newest first); the press after that clears the target
            if not await pl.evaluate("tw.escapeStack.length"): break
            await pl.keyboard.press('Escape'); await pl.wait_for_timeout(200)
        await pl.keyboard.press('Escape')
        okE = await wait(gm, f"!tw.entities()['{TH}']?.target", 6000)
        check(okE, 'B15f Esc (nothing else open) clears Thorin\'s target', {'escapeStack': esc_open})

        print('B16 NO ENGINE: ADD, ROLL, EDIT, REMOVE (Mira, no sheet)')
        await pl.evaluate("tw.dice.clear()"); await pl.evaluate(f"({LOOK})(17.5, 10, 46)")
        await pl.evaluate(f"tw.select(['{MI}'])"); await pl.wait_for_timeout(800)
        await pl.evaluate("document.querySelector('.rbtn[data-id=\"pawn.attack\"]')?.click()"); await pl.wait_for_timeout(800)
        fly0 = await pl.evaluate("tw.ringFlyout()")
        await pl.evaluate("document.querySelector('.rbtn[data-nest][data-id=\"attack:add\"]')?.click()"); await pl.wait_for_timeout(600)
        form0 = await pl.evaluate("!!document.querySelector('.flyout.atk .atk-name')")
        await pl.screenshot(path=os.path.join(SHOTS, 'b20-attack-form.png'))
        await pl.fill('.flyout.atk .atk-name', 'Dagger'); await pl.fill('.flyout.atk .atk-hit', '4'); await pl.fill('.flyout.atk .atk-dmg', '1d4 + 2')
        await pl.click('.flyout.atk .atk-save')
        okA = await wait(gm, f"JSON.stringify(tw.entities()['{MI}']?.attacks) === JSON.stringify([{{name:'Dagger',hit:'+4',dmg:'1d4+2'}}])", 8000)
        check(fly0 and fly0['tiles'] == ['+ Add attack'] and form0 and okA, 'B16a no engine: Mira\'s Attack menu is just "+ Add attack"; the form saves Dagger +4, 1d4+2 on the pawn (seen by the GM)', {'tiles': fly0 and fly0['tiles'], 'saved': await gm.evaluate(f"tw.entities()['{MI}']?.attacks || null")})
        await pl.keyboard.press('Escape'); await pl.evaluate("tw.select([])"); await pl.wait_for_timeout(300)
        await pl.evaluate(f"tw.select(['{MI}'])"); await pl.wait_for_timeout(700)
        n5 = await gm.evaluate("tw.view().chat.length")
        await pl.evaluate("document.querySelector('.rbtn[data-id=\"pawn.attack\"]')?.click()"); await pl.wait_for_timeout(700)
        await pl.evaluate("document.querySelector('.rbtn[data-nest][data-id=\"attack:0\"]')?.click()"); await pl.wait_for_timeout(400)
        await pl.evaluate(f"tw.select(['{GB}'])")
        okR = await wait(gm, f"tw.view().chat.slice({n5}).some(c => c.text === 'Mira attacks Goblin 1' && c.roll.expr === 'd20+4') && tw.view().chat.slice({n5}).some(c => c.text === 'Mira: Dagger damage on Goblin 1' && c.roll.expr === 'd4+2')", 20000)
        check(okR and await gm.evaluate(f"tw.entities()['{MI}']?.target === '{GB}'"), 'B16b Dagger, click Goblin 1: "Mira attacks Goblin 1: d20+4 = N", then "Mira: Dagger damage on Goblin 1: d4+2 = N"; Goblin 1 is now Mira\'s target', await gm.evaluate(f"tw.view().chat.slice({n5}).map(c => c.text + ': ' + c.roll?.expr + ' = ' + c.roll?.total)"))
        await pl.evaluate(f"tw.select(['{MI}'])"); await pl.wait_for_timeout(600)
        await pl.evaluate("document.querySelector('.rbtn[data-id=\"pawn.attack\"]')?.click()"); await pl.wait_for_timeout(600)
        tiles1 = (await pl.evaluate("tw.ringFlyout()") or {}).get('tiles')
        await pl.evaluate("document.querySelector('.rbtn[data-nest][data-id=\"attack:edit\"]')?.click()"); await pl.wait_for_timeout(600)
        await pl.click('.flyout.atk .atk-edit[data-i="0"]'); await pl.wait_for_timeout(300)
        await pl.fill('.flyout.atk .atk-hit', '+5'); await pl.click('.flyout.atk .atk-save')
        okE = await wait(gm, f"tw.entities()['{MI}']?.attacks?.[0]?.hit === '+5'", 8000)
        await pl.wait_for_timeout(300); await pl.click('.flyout.atk .atk-del[data-i="0"]')
        okD = await wait(gm, f"!tw.entities()['{MI}']?.attacks", 8000)
        check(tiles1 and tiles1[:1] == ['Dagger +4'] and 'Edit attacks' in tiles1 and okE and okD, 'B16c the menu lists Dagger (+ Add, Edit); Edit changes it to +5; Remove takes it away (the field is gone)', tiles1)
        await pl.keyboard.press('Escape'); await pl.evaluate("tw.select([])")

        print('B18 THE GET API SETS SAVED ATTACKS')
        def do(q):
            try:
                with urllib.request.urlopen(urllib.request.Request(f"{cbase}/a/{area}/do?{q}&seat={tok}", headers={'User-Agent': 'TurnipWorks-acceptance/1.0', **tw_sandbox.HEADERS}), timeout=30) as r: return json.loads(r.read())
            except urllib.error.HTTPError as e: return json.loads(e.read() or b'{}')
        good = urllib.parse.quote(json.dumps([{'name': 'Greataxe', 'hit': '+6', 'dmg': '1d12+4'}]))
        bad = urllib.parse.quote(json.dumps([{'name': 'Fireball', 'dmg': '8d6', 'description': SECRET}]))
        r1 = do(f"cmd=token.set&id={BR}&attacks={good}&nonce=atk1"); r2 = do(f"cmd=token.set&id={BR}&attacks={bad}&nonce=atk2")
        okG = await wait(pl, f"tw.entities()['{BR}']?.attacks?.[0]?.name === 'Greataxe'", 8000)
        st2 = json.loads(get(f"{cbase}/a/{area}/state?seat={tok}")); br2 = next((t for t in st2.get('tokens', []) if t['id'] == BR), None)
        check(r1.get('ok') and not r2.get('ok') and 'description' in json.dumps(r2) and okG and br2 and br2.get('attacks') == [{'name': 'Greataxe', 'hit': '+6', 'dmg': '1d12+4'}] and 'SAVED ATTACKS' in ctext,
              'B18 an AI seat saves Brakka\'s Greataxe over GET (seen by Mira; listed in state); one carrying a description is refused; the card says how', {'ok': r1, 'refused': r2, 'state': br2 and br2.get('attacks')})

        print('B13 A WHISPERED ROLL')
        n2 = await gm.evaluate("tw.view().chat.length"); w0 = await gm.evaluate("tw.whispers().length")
        await b20(pl, 'RenderedRoll', rendered(thorin, {'type': 'skill', 'skill': 'Stealth', 'ability': 'DEX', 'modifier': '+1'}, [roll([die(20, [13]), '+', 1], 'skill-check')], whisper=1))
        await done_rolls(pl, 6)
        got = await wait(gm, f"tw.whispers().length > {w0} && /Stealth/.test(tw.whispers().slice(-1)[0].text)", 8000)
        await gm.wait_for_timeout(500)
        n3 = await gm.evaluate("tw.view().chat.length"); wt = await gm.evaluate("tw.whispers().slice(-1)[0]?.text")
        check(got and n3 == n2 and SECRET not in (wt or ''), 'B13 a whispered roll is not on the table: no chat line; the GM gets it as a whisper', wt)

        print('B14 UPDATECOMBAT IS IGNORED; NO ERRORS')
        s0 = await gm.evaluate("JSON.stringify(tw.turns())")
        await b20(pl, 'UpdateCombat', {'action': 'update-combat', 'combat': [{'name': 'Thorin Oakenshield', 'initiative': 3, 'turn': True, 'tags': ['character']}]}, [{'name': 'Thorin Oakenshield', 'initiative': 3, 'turn': True, 'tags': ['character']}], {})
        await pl.wait_for_timeout(800)
        check(await pl.evaluate("tw.b20.seen.combat") == 1 and await gm.evaluate("JSON.stringify(tw.turns())") == s0, 'B14a UpdateCombat: seen, ignored (the turn order is unchanged)')
        print('B17 SAVED ATTACKS LAST: A FRESH VISIT, AND THE OTHER SEAT')
        await pl.reload(); assert await wait(pl, 'window.tw?.ready?.() && tw.attacks', JOIN_MS), 'player did not come back'
        await pl.evaluate(f"({LOOK})(7.5, 9, 46)"); await pl.evaluate(f"tw.select(['{TH}'])"); await pl.wait_for_timeout(900)
        await pl.evaluate("document.querySelector('.rbtn[data-id=\"pawn.attack\"]')?.click()"); await pl.wait_for_timeout(800)
        fresh = await pl.evaluate("({ connected: tw.b20.connected, list: tw.ringFlyout()?.tiles })")
        await gm.evaluate(f"({LOOK})(7.5, 9, 46)"); await gm.evaluate(f"tw.select(['{TH}'])"); await gm.wait_for_timeout(900)
        await gm.evaluate("document.querySelector('.rbtn[data-id=\"pawn.attack\"]')?.click()"); await gm.wait_for_timeout(800)
        other = await gm.evaluate("tw.ringFlyout()?.tiles")
        check(not fresh['connected'] and fresh['list'] and fresh['list'][0] == 'Longsword +5' and other and other[0] == 'Longsword +5', 'B17 after a reload (Beyond20 silent this visit) Thorin\'s menu still lists Longsword +5; the GM\'s seat sees the same list', {'fresh': fresh, 'gm': other})
        check(not errors, 'B14b no page errors', errors[:4])
        await browser.close()
    for pr in procs: pr.terminate()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
    n = sum(1 for r in results if r[0]); print(f'\nbrowser beyond20: {n}/{len(results)} passed'); sys.exit(0 if n == len(results) else 1)

asyncio.run(main())

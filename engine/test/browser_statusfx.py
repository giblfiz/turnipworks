#!/usr/bin/env python3
"""CONDITIONS ON THE TABLE (2026-10-29; docs/PAWNS.md "Conditions on the table"; client/statusfx.js, core/conditions.js).
Two seats: the GM (Harry) and a player (Mira).
  S1  the ring: Conditions ▸ prone lays Mira's figure on its side, for both seats
  S2  orbiters: charmed + stunned are pictures on the ring over the head, for both seats; three draw calls at most
  S3  unconscious beats prone (on its back, Z's); dead beats both (face down, greyed, no Z's)
  S4  a custom word typed in the bar ("condition Hexed") is a text label for both seats; the ring has "✓ Hexed"; pressing it
      takes it off
  S5  past four: three shown and "+N", the text labels counted
  S6  exhaustion: the ring's +1 twice -> "exhaustion 2", the drain ring at 2; typed "exhaustion 6": the skull; −1; "exhaustion 0"
  S7  incapacitated dims the rim (not the seat's colour, not the disc's grey); cleared, the rim is the seat's colour again
  S8  concentrating: the rune circle
  S9  INVISIBLE: Mira's own pawn is glass for Mira and the GM; the GM's invisible goblin is glass for the GM and a shimmer for
      Mira
  S10 HIDDEN: a pawn the GM hides (with conditions) is not drawn for Mira at all: no entity, no instances; the GM sees its look
  S10b FOG OF WAR: a pawn out of the player's sight draws none of its conditions for her
  S11 BEYOND20: unmatched D&D Beyond conditions (Deafened, Petrified) and exhaustion 2 arrive as text labels and the drain
  S12 GET: the GM's AI seat sets "Hexed,prone" over GET (both seats draw it) and clears it
  S13 hover names: over a SELECTED pawn's ring the names show; not over an unselected one
  S15 NOTHING UNDER THE RING (2026-10-29): with a pawn's ring open (shut, ☰, ☰ ▸ Conditions, ☰ ▸ Indicators; the painted set)
      no condition picture, plate or indicator on the table has its screen box under a ring button (they fade out there);
      S15b each Indicator button shows one picture, its own (the painting had pushed it out under the button)
  S16 HOW HIGH: the ring's near edge just over the crown, its far edge not far above, the indicator standing on it
  S14 Clear all conditions: everything goes for both seats; no page errors
Stills: engine/test/shots/statusfx-*.png
  local: python3 engine/test/browser_statusfx.py --local   (TW_PORTS=relay,site)
  dev:   ... browser_statusfx.py --page http://127.0.0.1:8180/
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox
tw_sandbox.remove_campaigns()
SOFT = os.environ.get('TW_GPU', '1') == '0'
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] if SOFT else ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
JOIN_MS = 240000 if SOFT else 90000
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE); SHOTS = os.path.join(HERE, 'shots')
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--relay', default='http://127.0.0.1:8098', help='the relay the GET checks talk to (dev: 8098)'); A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:500] if detail != '' else ''}", flush=True)
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18491,18492').split(','))
RELAY = None
def start_local():
    global RELAY
    import socket
    for port in (RP, SP):
        with socket.socket() as sk:
            if sk.connect_ex(('127.0.0.1', port)) == 0: sys.exit(f'port {port} is in use (a stale test server?): stop it first, or TW_PORTS=a,b')
    data = tempfile.mkdtemp(prefix='tw-sfx-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=open(os.path.join(data, 'relay.log'), 'a'), stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    RELAY = f'http://127.0.0.1:{RP}'
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(RELAY) + '&api=&nointro&faces=1500'
async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=50); return True
    except Exception: print(f'    (timed out: {what or js[:110]})'); return False
LOOK = "(x, z, dist) => { const g = tw.main.grab; g.focus.set(x, 0, z); g.dist = dist; g.pitch = 50; g.yaw = 0; g.update(); }"
ROWS = "[...document.querySelectorAll('#bar .row, #bar li')].map(r => ({ t: r.textContent }))"
# S16's band (the house heights of 2026-10-29, statusfx.js STATUS.clear / fig; at this test's camera): in figure heights
NEAR, FAR_MAX, MARK_OVER = (-0.2, 0.05), 1.4, 0.15  # (measured -0.09..-0.16, 0.86..1.25, +0.05..0.08; the old heights: near -0.25..-0.39, the pictures over the faces)
def I(id): return f"tw.statusInfo('{id}')"
def C(id): return f"(tw.entities()['{id}']?.conditions || [])"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    relay = RELAY or A.relay
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}, device_scale_factor=1)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.on('console', lambda m: errors.append(m.text[:200]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
            await pg.goto(url); return pg
        async def settle(*pgs):
            for pg in pgs: await wait(pg, 'tw.sync.pendingCount() === 0', 15000, 'commands accepted')
            await pgs[0].wait_for_timeout(450)
        NEST = '#ring .rbtn[data-nest][data-cmd="%s"]'
        async def sel(pg, id): await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.evaluate(f"tw.select('{id}')"); await pg.wait_for_timeout(150)
        async def open_menu(pg, id):
            if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
            await sel(pg, id); await wait(pg, "!!document.querySelector('#ring .rbtn[data-menu]')", 5000, 'ring'); await pg.evaluate("document.querySelector('#ring .rbtn[data-menu]').click()"); await pg.wait_for_timeout(350)
        async def press(pg, what): await pg.evaluate("w => document.querySelector(`#ring .rbtn.ex[data-cmd=\"${w}\"], #ring .rbtn.ex[data-group=\"${w}\"]`).click()", what); await pg.wait_for_timeout(350)
        async def nest(pg, cmd): await wait(pg, f"!!document.querySelector('{NEST % cmd}')", 5000, cmd); await pg.evaluate("q => document.querySelector(q).click()", NEST % cmd); await pg.wait_for_timeout(300)
        async def ring_pick(pg, id, cmd):
            await open_menu(pg, id); await press(pg, 'pawn.cond.'); await nest(pg, cmd)
        async def bar(pg, text):
            if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
            await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=6); await pg.wait_for_timeout(300); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)

        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', f"TEST statusfx {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw?.ready?.() && !!tw.statusInfo', JOIN_MS), 'GM did not come up'
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        pl = await tab(invite)
        assert await wait(pl, 'window.tw?.ready?.()', JOIN_MS), 'player did not join'
        seat = await pl.evaluate('tw.me()')
        await gm.evaluate('tw.spawnRoom("common", 0, 0, 6, 5, 7711)')
        await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        figs = await gm.evaluate("tw.assets.figures.list.filter(f => /^hero-/.test(f.id)).slice(0, 2).map(f => f.id).concat(tw.assets.figures.list.filter(f => /gob/.test(f.id)).slice(0, 1).map(f => f.id))")
        MI, KI, GB, HD = 'tok_sfxmira0001', 'tok_sfxkit00001', 'tok_sfxgobln001', 'tok_sfxhiddn001'
        await gm.evaluate('ops => tw.batch(ops)', [
            {'type': 'token.create', 'args': {'id': MI, 'name': 'Mira', 'x': 7.5, 'z': 12.5, 'owner': seat, 'main': True, 'fig': figs[0], 'sheet': 'https://www.dndbeyond.com/characters/555555'}},
            {'type': 'token.create', 'args': {'id': KI, 'name': 'Kit', 'x': 12.5, 'z': 12.5, 'owner': seat, 'fig': figs[1]}},
            {'type': 'token.create', 'args': {'id': GB, 'name': 'Goblin 1', 'x': 17.5, 'z': 12.5, 'fig': figs[-1]}},
            {'type': 'token.create', 'args': {'id': HD, 'name': 'Lurker', 'x': 22.5, 'z': 12.5, 'hidden': True, 'conditions': ['charmed', 'Hexed']}}])
        await settle(gm); await wait(pl, f"!!tw.entities()['{GB}']", 15000)
        for pg in (gm, pl): await pg.evaluate(f"({LOOK})(14, 13, 34)")
        await wait(gm, "tw.statusCounts()?.ready === true", 20000, 'status pictures loaded')
        await gm.wait_for_timeout(1500)

        print('S1 PRONE FROM THE RING')
        await ring_pick(pl, MI, 'pawn.cond.prone'); await settle(pl, gm)
        a, b = await pl.evaluate(I(MI)), await gm.evaluate(I(MI))
        check(a and b and a['pose'] == 'side' and b['pose'] == 'side' and abs(a['rot'][1] - 1.571) < 0.01 and a['poseTop'] and a['standTop'] and a['poseTop'] < 0.8 * a['standTop'], 'S1 the ring\'s Conditions ▸ prone: Mira lies on her side for both seats (lower than she stands)', [a, b])

        print('S2 ORBITERS')
        await ring_pick(pl, MI, 'pawn.cond.charmed'); await ring_pick(pl, MI, 'pawn.cond.stunned'); await settle(pl, gm)
        a, b = await pl.evaluate(I(MI)), await gm.evaluate(I(MI)); cnt = await gm.evaluate('tw.statusCounts()')
        check(a and b and [o.get('art') for o in a['orbit']] == ['charmed', 'stunned'] and a['orbit'] == b['orbit'] and a['live'] and a['shown'] and cnt['orbiters'] >= 4 and cnt['drawCalls'] <= 3,
              'S2 charmed + stunned are pictures on the ring over the head (two each), the same for both seats; at most three draw calls', {'mira': a and a['orbit'], 'gm': b and b['orbit'], 'counts': cnt})
        await pl.evaluate(f"({LOOK})(7.5, 12.5, 18)"); await pl.wait_for_timeout(900); await pl.screenshot(path=os.path.join(SHOTS, 'statusfx-orbit.png')); await pl.evaluate(f"({LOOK})(14, 13, 34)")

        print('S3 UNCONSCIOUS, DEAD')
        await gm.evaluate(f"tw.dispatch('token.set', {{ id: '{KI}', conditions: ['prone', 'unconscious'] }})"); await settle(gm, pl)
        k = await pl.evaluate(I(KI))
        await gm.evaluate(f"tw.dispatch('token.set', {{ id: '{GB}', conditions: ['unconscious', 'dead', 'prone'] }})"); await settle(gm, pl)
        g = await pl.evaluate(I(GB))
        check(k and k['pose'] == 'back' and k['zzz'] and g and g['pose'] == 'down' and not g['zzz'] and 'grey' in g['body'], 'S3 unconscious beats prone (on its back, Z\'s); dead beats both (face down, greyed, no Z\'s)', [k, g])

        print('S4 A CUSTOM WORD')
        await sel(pl, MI); await bar(pl, 'condition Hexed'); await settle(pl, gm)
        a, b = await pl.evaluate(I(MI)), await gm.evaluate(I(MI)); cond = await gm.evaluate(C(MI))
        check('Hexed' in cond and {'text': 'Hexed'} in (a['orbit'] if a else []) and {'text': 'Hexed'} in (b['orbit'] if b else []), 'S4 "condition Hexed" in the bar: kept as typed and drawn as a text label for both seats', {'cond': cond, 'mira': a and a['orbit']})
        await open_menu(pl, MI); await press(pl, 'pawn.cond.')
        tile = await pl.evaluate("(() => { const b = document.querySelector('#ring .rbtn[data-nest][data-cmd=\"pawn.cond.other.0\"]'); return b ? (b.getAttribute('aria-label') || b.dataset.tip || b.title || b.textContent) : null; })()")
        other = await pl.evaluate("!!document.querySelector('#ring .rbtn[data-nest][data-cmd=\"pawn.cond.other\"]')")
        if tile: await nest(pl, 'pawn.cond.other.0'); await settle(pl, gm)
        gone = await wait(gm, f"!{C(MI)}.includes('Hexed')", 5000)
        check(tile and 'Hexed' in tile and other and gone, 'S4b the ring lists "✓ Hexed" (and "Other…"); pressing it takes it off for everyone', {'tile': tile, 'other': other})
        await open_menu(pl, MI); await press(pl, 'pawn.cond.'); await nest(pl, 'pawn.cond.other')
        st = await pl.evaluate("({ open: document.querySelector('#bar').classList.contains('open'), text: document.querySelector('#bar .chips').innerText + ' ' + document.querySelector('#bar textarea').value })")  # ("condition" is the chip)
        check(st['open'] and st['text'] == 'condition ', '"Other…" opens the bar on "condition " with the cursor there', st); await pl.keyboard.press('Escape')

        print('S5 PAST FOUR')
        await pl.evaluate(f"tw.dispatch('token.set', {{ id: '{MI}', conditions: ['charmed', 'stunned', 'Hexed', 'poisoned', 'Blessed', 'blinded'] }})"); await settle(pl, gm)
        a = await gm.evaluate(I(MI))
        check(a and len(a['orbit']) == 3 and len(a['more']) == 3 and 'Blessed' in a['more'], 'S5 six on the ring: three shown and "+3" (the text labels counted)', a and {'orbit': a['orbit'], 'more': a['more']})
        await pl.evaluate(f"tw.dispatch('token.set', {{ id: '{MI}', conditions: [] }})"); await settle(pl, gm)

        print('S6 EXHAUSTION')
        await ring_pick(pl, MI, 'pawn.cond.exhaustion.up'); await settle(pl); await ring_pick(pl, MI, 'pawn.cond.exhaustion.up'); await settle(pl, gm)
        c2 = await gm.evaluate(C(MI)); d2 = (await gm.evaluate(I(MI)))['drain']
        await sel(pl, MI); await bar(pl, 'exhaustion 6'); await settle(pl, gm)
        c6 = await gm.evaluate(C(MI)); d6 = await pl.evaluate(I(MI))
        await ring_pick(pl, MI, 'pawn.cond.exhaustion.down'); await settle(pl, gm); c5 = await gm.evaluate(C(MI))
        await sel(pl, MI); await bar(pl, 'exhaustion 0'); await settle(pl, gm); c0 = await gm.evaluate(C(MI))
        check(c2 == ['exhaustion 2'] and d2 == 2 and c6 == ['exhaustion 6'] and d6['drain'] == 6 and c5 == ['exhaustion 5'] and c0 == [], 'S6 exhaustion: +1 twice = "exhaustion 2" (drain 2); "exhaustion 6" (the black ring, the skull); −1 = 5; "exhaustion 0" clears', {'2': c2, '6': c6, '5': c5, '0': c0})

        print('S7 INCAPACITATED')
        r0 = (await pl.evaluate(I(MI)))['rim']
        await ring_pick(pl, MI, 'pawn.cond.incapacitated'); await settle(pl, gm)
        a, b = await pl.evaluate(I(MI)), await gm.evaluate(I(MI))
        await ring_pick(pl, MI, 'pawn.cond.incapacitated'); await settle(pl, gm)
        r1 = (await pl.evaluate(I(MI)))['rim']
        check(a['dim'] and b['dim'] and a['rim'] != r0 and r1 == r0, 'S7 incapacitated dims the rim for both seats; taken off, the rim is the seat\'s colour again', {'seat': r0, 'dim': a['rim'], 'after': r1})

        print('S8 CONCENTRATING')
        await ring_pick(pl, KI, 'pawn.cond.concentrating'); await settle(pl, gm)
        check((await gm.evaluate(I(KI)))['runes'] and (await pl.evaluate(I(KI)))['runes'], 'S8 concentrating: the rune circle, for both seats')

        print('S9 INVISIBLE')
        await ring_pick(pl, MI, 'pawn.cond.invisible'); await gm.evaluate(f"tw.dispatch('token.set', {{ id: '{GB}', conditions: ['invisible'] }})"); await settle(pl, gm)
        mm, mg, gm_m, gm_g = await pl.evaluate(I(MI)), await pl.evaluate(I(GB)), await gm.evaluate(I(MI)), await gm.evaluate(I(GB))
        check(mm['invisible'] == 'glass' and gm_m['invisible'] == 'glass' and 'glass' in mm['body'] and gm_g['invisible'] == 'glass' and mg['invisible'] == 'shimmer' and 'shimmer' in mg['body'],
              'S9 invisible: Mira\'s own pawn is glass for Mira and the GM; the GM\'s goblin is glass for the GM, a shimmer for Mira', {'mira_sees_mira': mm['body'], 'gm_sees_mira': gm_m['body'], 'gm_sees_gob': gm_g['body'], 'mira_sees_gob': mg['body']})
        await pl.evaluate(f"({LOOK})(12.5, 12.5, 22)"); await pl.wait_for_timeout(900); await pl.screenshot(path=os.path.join(SHOTS, 'statusfx-invisible-player.png'))
        await gm.evaluate(f"({LOOK})(12.5, 12.5, 22)"); await gm.wait_for_timeout(900); await gm.screenshot(path=os.path.join(SHOTS, 'statusfx-invisible-gm.png'))

        print('S10 HIDDEN')
        hp = await pl.evaluate(f"({{ ent: !!tw.entities()['{HD}'], info: {I(HD)} }})"); hg = await gm.evaluate(I(HD))
        check(not hp['ent'] and hp['info'] is None and hg and [o.get('art') or o.get('text') for o in hg['orbit']] == ['charmed', 'Hexed'], 'S10 a pawn hidden from players: Mira has neither it nor its look; the GM sees charmed and Hexed on it', {'mira': hp, 'gm': hg and hg['orbit']})

        print('S10b FOG OF WAR')
        FG = 'tok_sfxfar00001'
        await gm.evaluate("tw.registry.run('area.fogOfWar.on')"); await settle(gm)
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: '{FG}', name: 'Far goblin', x: 182.5, z: 182.5, conditions: ['charmed', 'Hexed', 'exhaustion 3'] }})"); await settle(gm, pl)
        await wait(pl, f"!!tw.entities()['{FG}'] && !!{I(FG)}", 8000)
        far = await pl.evaluate(f"({{ unseen: !!tw.worldOf(tw.area()).fogRule?.(tw.entities()['{FG}']), active: !!tw.worldOf(tw.area()).fogActive, info: {I(FG)}, near: {I(MI)} }})")
        check(far['active'] and far['unseen'] and far['info'] and not far['info']['shown'] and far['near']['shown'], 'S10b fog of war: a pawn out of the player\'s sight draws none of its conditions for her (its pawn is not drawn either); her own still show', far)
        await gm.evaluate(f"tw.dispatch('token.delete', {{ id: '{FG}' }})"); await gm.evaluate("tw.registry.run('area.fogOfWar.off')"); await settle(gm, pl)

        print('S11 BEYOND20: UNMATCHED WORDS ARE TEXT LABELS')
        await pl.evaluate("document.dispatchEvent(new CustomEvent('Beyond20_Loaded', { detail: [{}] }))")
        ch = {'name': 'Mira Vale', 'type': 'Character', 'url': 'https://www.dndbeyond.com/characters/555555', 'id': '555555', 'hp': 30, 'max-hp': 30, 'conditions': ['Deafened', 'Petrified', 'Prone'], 'exhaustion': 2}
        await pl.evaluate("d => document.dispatchEvent(new CustomEvent('Beyond20_UpdateConditions', { detail: d }))", [{'action': 'update-conditions', 'character': ch}, 'Mira Vale', ['Deafened', 'Petrified', 'Prone'], 2])
        ok11 = await wait(gm, f"{C(MI)}.includes('deafened') && {C(MI)}.includes('exhaustion 2')", 8000)
        a = await gm.evaluate(I(MI)); cond = await gm.evaluate(C(MI))
        check(ok11 and 'invisible' not in cond and 'prone' in cond and {'text': 'deafened'} in a['orbit'] and {'text': 'petrified'} in a['orbit'] and a['drain'] == 2, 'S11 Beyond20: Deafened and Petrified (no TW look) arrive as text labels, exhaustion 2 as the drain ring; prone follows; invisible goes (D&D Beyond did not list it)', {'cond': cond, 'orbit': a and a['orbit']})
        await pl.evaluate("d => document.dispatchEvent(new CustomEvent('Beyond20_UpdateConditions', { detail: d }))", [{'action': 'update-conditions', 'character': {**ch, 'conditions': [], 'exhaustion': 0}}, 'Mira Vale', [], 0])
        ok11b = await wait(gm, f"!{C(MI)}.includes('deafened') && !{C(MI)}.includes('exhaustion 2')", 8000)
        check(ok11b, 'S11b gone on D&D Beyond: gone here (the text labels too)', await gm.evaluate(C(MI)))

        print('S12 GET: AN AI SEAT')
        r12 = None
        if relay:
            def get(path):
                with urllib.request.urlopen(relay + path, timeout=10) as r: return json.loads(r.read())
            cid = await gm.evaluate("tw.sync.campaign?.id || tw.campaignId?.() || null"); tok = await gm.evaluate("tw.sync.token || null"); area = await gm.evaluate('tw.area()')
            try:
                h = get(f"/c/{cid}/do?cmd=seat.create&kind=llm&name=Helper&scope={urllib.parse.quote(json.dumps({'areas': '*', 'classes': '*'}))}&seat={urllib.parse.quote(tok)}")
                t = urllib.parse.quote(h['token'])
                r12 = get(f"/c/{cid}/a/{area}/do?cmd=token.set&id={KI}&conditions={urllib.parse.quote('Hexed,prone')}&nonce=sfxget01&seat={t}")
                ok12 = await wait(pl, f"JSON.stringify({C(KI)}) === '[\"Hexed\",\"prone\"]'", 8000)
                k = await pl.evaluate(I(KI))
                r12b = get(f"/c/{cid}/a/{area}/do?cmd=token.set&id={KI}&conditions=&nonce=sfxget02&seat={t}")
                ok12b = await wait(gm, f"{C(KI)}.length === 0", 8000); kb = await gm.evaluate(I(KI))
                check(r12['ok'] and ok12 and k['pose'] == 'side' and {'text': 'Hexed'} in k['orbit'] and r12b['ok'] and ok12b and not kb['live'] and kb['pose'] is None, 'S12 GET: the AI seat\'s "Hexed,prone" is drawn for the player (a text label, on its side); conditions= clears it for the GM', {'set': r12, 'k': k and k['orbit']})
            except Exception as ex: check(False, 'S12 GET', repr(ex))
        else: check(False, 'S12 GET: no relay address')

        print('S13 HOVER NAMES')
        await gm.evaluate(f"tw.dispatch('token.set', {{ id: '{KI}', conditions: ['charmed', 'Hexed'] }})"); await settle(gm, pl)
        for pg in (gm,): await pg.evaluate(f"({LOOK})(12.5, 12.5, 26)")
        await gm.wait_for_timeout(700)
        await gm.evaluate("tw.clearSelection()"); await gm.wait_for_timeout(200)
        sc = await gm.evaluate(f"tw.statusScreen('{KI}')")
        await gm.mouse.move(*sc['body']); await gm.wait_for_timeout(150); await gm.mouse.move(sc['x'], sc['y']); await gm.wait_for_timeout(250); none = await gm.evaluate("tw.statusTip()")
        await gm.evaluate(f"tw.select('{KI}')"); await gm.wait_for_timeout(300)
        sc = await gm.evaluate(f"tw.statusScreen('{KI}')"); await gm.mouse.move(*sc['body']); await gm.wait_for_timeout(150); await gm.mouse.move(sc['body'][0] + 1, sc['body'][1] + 1); await gm.wait_for_timeout(250); allt = await gm.evaluate("tw.statusTip()")
        sc = await gm.evaluate(f"tw.statusScreen('{KI}')"); await gm.mouse.move(*sc['first']); await gm.wait_for_timeout(120); one = await gm.evaluate("tw.statusTip()")
        check(none is None and allt and 'charmed' in allt and 'Hexed' in allt and one in ('charmed', 'Hexed'), 'S13 over a SELECTED pawn its conditions are named (the whole list over the figure; the orbiter under the pointer by itself); nothing over an unselected one', {'unselected': none, 'ring': allt, 'orbiter': one})

        print('S15 NOTHING UNDER THE RING')
        # (the house's painted set, as dev has it: the Indicators' own pictures were pushed out under painted buttons)
        await gm.evaluate("(() => { const b = tw.ringSettings(); tw.ringSettingsOverride = () => ({ ...b, iconSet: 'charcoal' }); })()")
        await gm.evaluate('ops => tw.batch(ops)', [
            {'type': 'token.set', 'args': {'id': MI, 'conditions': ['charmed', 'stunned']}}, {'type': 'token.mark', 'args': {'id': MI, 'mark': 'skull'}},
            {'type': 'token.set', 'args': {'id': KI, 'conditions': ['poisoned', 'restrained', 'Hexed']}},
            {'type': 'token.set', 'args': {'id': GB, 'conditions': ['frightened']}}, {'type': 'token.mark', 'args': {'id': GB, 'mark': 'star'}}]); await settle(gm)
        await gm.evaluate(f"({LOOK})(12.5, 8.5, 30)"); await gm.evaluate('tw.statusBoxes()'); await gm.wait_for_timeout(600)
        UNDER = """() => { const B = [...document.querySelectorAll('#ring .rbtn:not(.leaving)')].map(b => b.getBoundingClientRect()).filter(r => r.width > 0).map(r => [r.left + r.width / 2, r.top + r.height / 2, r.width / 2]);
          const L = tw.statusBoxes() || [], bad = [];
          for (const p of L) { if (p.a <= 0.02) continue; for (const [X, Y, R] of B) { const dx = Math.max(Math.abs(X - p.x) - p.hw, 0), dy = Math.max(Math.abs(Y - p.y) - p.hh, 0); if (Math.hypot(dx, dy) < R - 1) bad.push({ p, button: [X, Y, R].map(Math.round) }); } }
          return { buttons: B.length, pictures: L.length, faded: L.filter(p => p.a < 1).length, marks: L.filter(p => p.mark).length, bad: bad.slice(0, 4) }; }"""
        states = {}
        await gm.evaluate(f"tw.select('{MI}')"); await gm.wait_for_timeout(900); states['ring'] = await gm.evaluate(UNDER)
        await gm.evaluate("document.querySelector('#ring .rbtn[data-menu]').click()"); await gm.wait_for_timeout(900); states['menu'] = await gm.evaluate(UNDER)
        await press(gm, 'pawn.cond.'); await gm.wait_for_timeout(900); states['conditions'] = await gm.evaluate(UNDER)
        await press(gm, 'pawn.mark.'); await gm.wait_for_timeout(900); states['indicators'] = await gm.evaluate(UNDER)
        await gm.screenshot(path=os.path.join(SHOTS, 'statusfx-ring-indicators.png'))
        pics = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn[data-nest][data-cmd^=\"pawn.mark.\"]')].map(b => ({ cmd: b.dataset.cmd, imgs: b.querySelectorAll('img').length, painted: b.classList.contains('painted'), svg: b.querySelectorAll(':scope > svg').length }))")
        check(all(not s['bad'] and s['buttons'] >= 3 and s['pictures'] >= 5 for s in states.values()) and sum(s['faded'] for s in states.values()) > 0 and all(s['marks'] for s in states.values()),
              'S15 with a pawn\'s ring open (shut, ☰, ☰ ▸ Conditions, ☰ ▸ Indicators), no condition picture, plate or indicator drawn on the table is under a ring button (the ones that would be fade out)', states)
        check(len([p for p in pics if p['cmd'] != 'pawn.mark.none']) == 8 and all((p['imgs'] + p['svg']) == 1 for p in pics), 'S15b ☰ ▸ Indicators with the painted set: each indicator\'s button shows ONE picture, its own (none pushed out under it)', pics)
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await gm.evaluate('tw.clearSelection(); tw.ringSettingsOverride = null'); await gm.wait_for_timeout(300)

        print('S16 HOW HIGH')
        await gm.evaluate(f"({LOOK})(12.5, 12.5, 40)"); await gm.wait_for_timeout(700)
        hs = {n: await gm.evaluate(f"tw.statusScreen('{i}')") for n, i in (('mira', MI), ('kit', KI), ('goblin', GB))}
        def band(h):  # in figure heights on screen (crown to feet), how far the ring's near edge and the indicator's foot are over the crown
            fh = max(1, h['foot'] - h['crown']); return {'near': round((h['crown'] - h['nearBottom']) / fh, 3), 'far': round((h['crown'] - h['farTop']) / fh, 3), 'mark': round((h['crown'] - h['mark'][1]) / fh, 3) if h.get('mark') else None, 'fh': round(fh)}
        bands = {n: band(h) for n, h in hs.items() if h}
        check(len(bands) == 3 and all(NEAR[0] <= b['near'] <= NEAR[1] and b['far'] <= FAR_MAX for b in bands.values()) and all(b['mark'] is None or (b['mark'] >= b['far'] - 0.02 and b['mark'] <= b['far'] + MARK_OVER) for b in bands.values()),
              f'S16 the ring of pictures sits just over the head (its near edge {NEAR[0]}..{NEAR[1]} of the figure\'s height over the crown, its far edge at most {FAR_MAX}); the indicator stands on it, no more than {MARK_OVER} higher', bands)

        print('S14 CLEAR ALL')
        await sel(pl, MI); await pl.evaluate("tw.select(['" + MI + "', '" + KI + "'])"); await bar(pl, 'clear all conditions'); await settle(pl, gm)
        a, b = await gm.evaluate(I(MI)), await gm.evaluate(I(KI))
        check(await gm.evaluate(f"{C(MI)}.length === 0 && {C(KI)}.length === 0") and not a['live'] and a['pose'] is None and a['body'] == ['plain'] and not b['live'], 'S14 Clear all conditions: every look goes, for both seats (the glass body back to its paint)', [a, b])
        await gm.evaluate(f"({LOOK})(14, 13, 34)"); await gm.wait_for_timeout(500); await gm.screenshot(path=os.path.join(SHOTS, 'statusfx-cleared.png'))
        bad = [e for e in errors if 'WebGL' not in e and 'GPU stall' not in e]
        check(not bad, 'no page errors', bad[:5])
        await browser.close()
    for pr in procs: pr.terminate()
    n = sum(1 for r in results if r[0]); print(f"\nbrowser_statusfx: {n}/{len(results)} passed")
    sys.exit(0 if n == len(results) else 1)
try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass

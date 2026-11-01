#!/usr/bin/env python3
"""A PAWN'S AURA (2026-10-30; docs/PAWNS.md "Aura"; client/aurafx.js, core/aura.js). Two seats: the GM (Harry) and a player (Mira).
  A1  the ring: Mira's own pawn, ☰ ▸ Aura ▸ Aura up three times: burning (3), gold, drawn for both seats
  A2  a colour from the ring: Blue (✓ Blue after), for both seats; Aura down; Aura off keeps the colour (Aura up: blue again)
  A3  the bar on the GM's goblin: "aura 4", "aura up" (5: the sun emblem, it has no faction), "aura down", "aura red",
      "aura emblem dragons" (at 5: the dragons emblem), "aura off" (not drawn)
  A4  the relay is strict: a level 9, a pink, an unknown field are refused; Mira cannot set the GM's goblin's aura
  A5  GET: the GM's AI seat sets aura=3,violet on Kit (both seats draw it), aura=up, aura=off
  A6  levels: each of 1..5 is drawn taller (or wider at 1 -> 2) than the one before; 4 and 5 well over the figure
  A7  hidden: a pawn the GM hides (with an aura) is never sent to Mira; the GM sees its aura. Fog of war: a far pawn out of
      Mira's sight draws none of its aura for her. Invisible: the goblin's aura is not drawn for Mira, it is for the GM
  A8  replay: Mira reloads: her pawn's aura is drawn as it was
  A9  NOTHING UNDER THE RING: with a pawn's ☰ open over an aura, the mask is on, and the picture inside the ring's buttons
      (the buttons hidden for the comparison) is the same with and without the aura; outside them the aura shows
  A10 LOW GRAPHICS and reduce motion: the static version (time stands, no sparks)
  A11 cost: every aura on the table in three draw calls at most
  A12 first person: Mira looks through her own pawn (aura 4): her aura is not drawn for her; the GM still sees it
Stills: engine/test/shots/aura-*.png
  local: python3 engine/test/browser_aura.py --local   (TW_PORTS=relay,site)
  dev:   ... browser_aura.py --page http://127.0.0.1:8180/
"""
import argparse, asyncio, io, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
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
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:600] if detail != '' else ''}", flush=True)
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18741,18742').split(','))
RELAY = None
def start_local():
    global RELAY
    import socket
    for port in (RP, SP):
        with socket.socket() as sk:
            if sk.connect_ex(('127.0.0.1', port)) == 0: sys.exit(f'port {port} is in use (a stale test server?): stop it first, or TW_PORTS=a,b')
    data = tempfile.mkdtemp(prefix='tw-aura-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
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
def I(id): return f"tw.auraInfo('{id}')"
def AU(id): return f"(tw.entities()['{id}']?.aura || null)"

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
        async def nest(pg, cmd):
            ok = await wait(pg, f"!!document.querySelector('{NEST % cmd}')", 5000, cmd)
            if ok: await pg.evaluate("q => document.querySelector(q).click()", NEST % cmd); await pg.wait_for_timeout(300)
            return ok
        async def ring_aura(pg, id, cmd): await open_menu(pg, id); await press(pg, 'pawn.aura.'); return await nest(pg, cmd)
        async def bar(pg, text):
            if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
            await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=6); await pg.wait_for_timeout(300); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)

        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', f"TEST aura {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw?.ready?.() && !!tw.auraInfo', JOIN_MS), 'GM did not come up'
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        pl = await tab(invite)
        assert await wait(pl, 'window.tw?.ready?.()', JOIN_MS), 'player did not join'
        seat = await pl.evaluate('tw.me()')
        await gm.evaluate('tw.spawnRoom("common", 0, 0, 6, 5, 7711)')
        await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        figs = await gm.evaluate("tw.assets.figures.list.filter(f => /^hero-/.test(f.id)).slice(0, 2).map(f => f.id).concat(tw.assets.figures.list.filter(f => /gob/.test(f.id)).slice(0, 1).map(f => f.id))")
        MI, KI, GB, HD = 'tok_aurmira0001', 'tok_aurkit00001', 'tok_aurgobln001', 'tok_aurhiddn001'
        await gm.evaluate('ops => tw.batch(ops)', [
            {'type': 'token.create', 'args': {'id': MI, 'name': 'Mira', 'x': 7.5, 'z': 12.5, 'owner': seat, 'main': True, 'fig': figs[0]}},
            {'type': 'token.create', 'args': {'id': KI, 'name': 'Kit', 'x': 12.5, 'z': 12.5, 'owner': seat, 'fig': figs[1]}},
            {'type': 'token.create', 'args': {'id': GB, 'name': 'Goblin 1', 'x': 17.5, 'z': 12.5, 'fig': figs[-1]}},
            {'type': 'token.create', 'args': {'id': HD, 'name': 'Lurker', 'x': 22.5, 'z': 12.5, 'hidden': True, 'aura': {'level': 4, 'color': 'violet'}}}])
        await settle(gm); await wait(pl, f"!!tw.entities()['{GB}']", 15000)
        for pg in (gm, pl): await pg.evaluate(f"({LOOK})(14, 13, 40)")
        await gm.wait_for_timeout(1500)

        print('A1 THE RING: AURA UP')
        for _ in range(3): await ring_aura(pl, MI, 'pawn.aura.up'); await settle(pl)
        await wait(gm, f"{AU(MI)}?.level === 3", 8000)
        a, ig, ip = await pl.evaluate(AU(MI)), await gm.evaluate(I(MI)), await pl.evaluate(I(MI))
        check(a == {'level': 3, 'color': 'gold'} and ig['drawn'] and ip['drawn'] and ig['level'] == 3, 'A1 ☰ ▸ Aura ▸ Aura up three times on her own pawn: burning, gold, drawn for both seats', {'aura': a, 'gm': ig, 'mira': ip})

        print('A2 A COLOUR FROM THE RING; DOWN; OFF KEEPS THE COLOUR')
        await ring_aura(pl, MI, 'pawn.aura.color.blue'); await settle(pl); await wait(gm, f"{AU(MI)}?.color === 'blue'", 8000)
        await open_menu(pl, MI); await press(pl, 'pawn.aura.'); await pl.wait_for_timeout(300)
        tip = await pl.evaluate("(() => { const b = document.querySelector('#ring .rbtn[data-nest][data-cmd=\"pawn.aura.color.blue\"]'); return b ? (b.dataset.tip || b.title || b.getAttribute('aria-label') || '') : null; })()")
        tiles = await pl.evaluate("[...document.querySelectorAll('#ring .rbtn[data-nest][data-group=\"pawn.aura.\"]')].map(b => b.dataset.cmd)")
        await pl.keyboard.press('Escape'); await pl.keyboard.press('Escape')
        ig = await gm.evaluate(I(MI))
        check((await pl.evaluate(AU(MI))) == {'level': 3, 'color': 'blue'} and ig['color'] == 'blue' and tip and '✓' in tip, 'A2 Blue from the ring: blue for both seats, the tile reads "✓ Blue aura"', {'tip': tip, 'gm': ig})
        check(tiles[:3] == ['pawn.aura.up', 'pawn.aura.down', 'pawn.aura.off'] and len(tiles) == 9, 'A2 ☰ ▸ Aura holds up, down, off and the six colours', tiles)
        await ring_aura(pl, MI, 'pawn.aura.down'); await settle(pl); a1 = await pl.evaluate(AU(MI))
        await ring_aura(pl, MI, 'pawn.aura.off'); await settle(pl); a2 = await pl.evaluate(AU(MI)); i2 = await gm.evaluate(I(MI))
        await ring_aura(pl, MI, 'pawn.aura.up'); await settle(pl); a3 = await pl.evaluate(AU(MI))
        check(a1 == {'level': 2, 'color': 'blue'} and a2 == {'level': 0, 'color': 'blue'} and not i2['drawn'] and a3 == {'level': 1, 'color': 'blue'}, 'A2 Aura down (2), Aura off (nothing drawn, blue kept), Aura up (1, blue again)', [a1, a2, i2, a3])

        print('A3 THE BAR')
        steps = []
        for text, want in [('aura 4', {'level': 4, 'color': 'gold'}), ('aura up', {'level': 5, 'color': 'gold'}), ('aura down', {'level': 4, 'color': 'gold'}), ('aura red', {'level': 4, 'color': 'red'}), ('aura 5', {'level': 5, 'color': 'red'})]:
            await sel(gm, GB); await bar(gm, text); await settle(gm); steps.append((text, await gm.evaluate(AU(GB)), want))
        check(all(g == w for _, g, w in steps), 'A3 typed: aura 4, aura up, aura down, aura red, aura 5', steps)
        await wait(gm, f"{I(GB)}?.emblem?.id === 'sun'", 8000); e5 = await gm.evaluate(I(GB))
        check(e5['emblem'] and e5['emblem']['id'] == 'sun', 'A3 level 5 on a pawn with no faction: the sun emblem hangs in it', e5)
        await sel(gm, GB); await bar(gm, 'aura emblem dragons'); await settle(gm); await wait(gm, f"{I(GB)}?.emblem?.id === 'dragons'", 8000)
        e6 = await gm.evaluate(I(GB)); ae = await gm.evaluate(AU(GB))
        check(ae.get('emblem') == 'dragons' and e6['emblem'] and e6['emblem']['id'] == 'dragons', 'A3 "aura emblem dragons": the dragons emblem (the faction\'s own, reused)', [ae, e6])
        await gm.screenshot(path=os.path.join(SHOTS, 'aura-gm-levels.png'))
        await sel(gm, GB); await bar(gm, 'aura off'); await settle(gm); off = await gm.evaluate(I(GB))
        check(not off['drawn'] and (await gm.evaluate(AU(GB)))['level'] == 0, 'A3 "aura off": nothing drawn', off)

        print('A4 THE RELAY IS STRICT')
        before = await gm.evaluate(AU(KI))
        for bad in [{'level': 9, 'color': 'gold'}, {'level': 3, 'color': 'pink'}, {'level': 3, 'color': 'gold', 'glow': 2}]:
            await gm.evaluate("([id, a]) => tw.dispatch('token.set', { id, aura: a })", [KI, bad])
        await settle(gm); await gm.wait_for_timeout(500)
        await pl.evaluate("id => tw.dispatch('token.set', { id, aura: { level: 3, color: 'green' } })", GB); await settle(pl); await pl.wait_for_timeout(800)
        gob = await gm.evaluate(AU(GB)); kit = await gm.evaluate(AU(KI))
        check(kit == before and gob['level'] == 0, 'A4 a level 9, a pink, an unknown field: refused; Mira cannot set the GM\'s goblin\'s aura', {'kit': kit, 'goblin': gob})
        await open_menu(pl, GB); has = await pl.evaluate("!!document.querySelector('#ring .rbtn.ex[data-group=\"pawn.aura.\"]')"); await pl.keyboard.press('Escape'); await pl.keyboard.press('Escape')
        check(not has, 'A4 the GM\'s goblin offers Mira no Aura in its ☰', has)

        print('A5 GET: AN AI SEAT')
        if relay:
            def get(path):
                with urllib.request.urlopen(relay + path, timeout=10) as r: return json.loads(r.read())
            cid = await gm.evaluate("tw.sync.campaign?.id || tw.campaignId?.() || null"); tok = await gm.evaluate("tw.sync.token || null"); area = await gm.evaluate('tw.area()')
            try:
                h = get(f"/c/{cid}/do?cmd=seat.create&kind=llm&name=Helper&scope={urllib.parse.quote(json.dumps({'areas': '*', 'classes': '*'}))}&seat={urllib.parse.quote(tok)}")
                t = urllib.parse.quote(h['token'])
                r1 = get(f"/c/{cid}/a/{area}/do?cmd=token.set&id={KI}&aura={urllib.parse.quote('3,violet')}&nonce=aurget01&seat={t}")
                ok1 = await wait(pl, f"{AU(KI)}?.level === 3 && {AU(KI)}?.color === 'violet' && {I(KI)}?.drawn", 8000); k1 = await pl.evaluate(I(KI))
                r2 = get(f"/c/{cid}/a/{area}/do?cmd=token.set&id={KI}&aura=up&nonce=aurget02&seat={t}"); ok2 = await wait(gm, f"{AU(KI)}?.level === 4", 8000)
                r3 = get(f"/c/{cid}/a/{area}/do?cmd=token.set&id={KI}&aura=off&nonce=aurget03&seat={t}"); ok3 = await wait(gm, f"{AU(KI)}?.level === 0 && !{I(KI)}.drawn", 8000)
                check(r1['ok'] and ok1 and k1['color'] == 'violet' and r2['ok'] and ok2 and r3['ok'] and ok3, 'A5 GET: aura=3,violet is drawn for the player; aura=up -> 4; aura=off clears it for the GM', {'r1': r1, 'k1': k1})
            except Exception as ex: check(False, 'A5 GET', repr(ex))
        else: check(False, 'A5 GET: no relay address')

        print('A6 THE LEVELS')
        hs = []
        for L in range(1, 6):
            await gm.evaluate(f"tw.dispatch('token.set', {{ id: '{GB}', aura: {{ level: {L}, color: 'gold' }} }})"); await settle(gm); await gm.wait_for_timeout(250)
            hs.append(await gm.evaluate(I(GB)))
        H = [x['height'] for x in hs]
        check(all(x['drawn'] for x in hs) and H[0] < H[1] < H[2] < H[3] and H[3] <= H[4] and H[3] > 3 * hs[3]['crown'] * 0.95 and hs[4]['emblem'] and not hs[3]['emblem'] and hs[0]['sparks'] == 0 and hs[2]['sparks'] > 0 and hs[3]['sparks'] > hs[2]['sparks'],
              'A6 each level drawn taller than the one before (1 at the base, 3 over the crown, 4 and 5 three figure heights up), sparks from 3, the emblem only at 5', [(x['level'], x['height'], x['crown'], x['sparks'], bool(x['emblem'])) for x in hs])

        print('A7 HIDDEN, FOG, INVISIBLE')
        hp = await pl.evaluate(f"({{ ent: !!tw.entities()['{HD}'], info: {I(HD)} }})"); hg = await gm.evaluate(I(HD))
        check(not hp['ent'] and hp['info'] is None and hg and hg['drawn'] and hg['color'] == 'violet', 'A7 a pawn hidden from players: Mira has neither it nor its aura; the GM sees it drawn', {'mira': hp, 'gm': hg})
        FG = 'tok_aurfar00001'
        await gm.evaluate("tw.registry.run('area.fogOfWar.on')"); await settle(gm)
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: '{FG}', name: 'Far goblin', x: 182.5, z: 182.5, aura: {{ level: 4, color: 'red' }} }})"); await settle(gm, pl)
        await wait(pl, f"!!tw.entities()['{FG}'] && !!{I(FG)}", 8000); await pl.wait_for_timeout(500)
        far = await pl.evaluate(f"({{ unseen: !!tw.worldOf(tw.area()).fogRule?.(tw.entities()['{FG}']), active: !!tw.worldOf(tw.area()).fogActive, info: {I(FG)}, near: {I(GB)} }})")
        check(far['active'] and far['unseen'] and far['info'] and not far['info']['drawn'] and far['near']['drawn'], 'A7 fog of war: a pawn out of the player\'s sight draws none of its aura for her; one in sight does', far)
        await gm.evaluate(f"tw.dispatch('token.delete', {{ id: '{FG}' }})"); await gm.evaluate("tw.registry.run('area.fogOfWar.off')"); await settle(gm, pl)
        await gm.evaluate(f"tw.dispatch('token.set', {{ id: '{GB}', conditions: ['invisible'] }})"); await settle(gm, pl); await pl.wait_for_timeout(600)
        iv = [await pl.evaluate(I(GB)), await gm.evaluate(I(GB))]
        check(not iv[0]['drawn'] and iv[1]['drawn'], 'A7 an invisible pawn\'s aura: not drawn for Mira, drawn for the GM (who sees it as glass)', iv)
        await gm.evaluate(f"tw.dispatch('token.set', {{ id: '{GB}', conditions: [] }})"); await settle(gm, pl)

        print('A8 REPLAY')
        await pl.evaluate(f"tw.dispatch('token.set', {{ id: '{MI}', aura: {{ level: 4, color: 'green' }} }})"); await settle(pl)
        await pl.reload(); await wait(pl, 'window.tw?.ready?.() && !!tw.auraInfo', JOIN_MS); await wait(pl, f"!!{I(MI)}?.drawn", 20000)
        rp = await pl.evaluate(I(MI))
        check(rp and rp['drawn'] and rp['level'] == 4 and rp['color'] == 'green', 'A8 after a reload Mira\'s pawn wears its aura as it was', rp)
        await pl.evaluate(f"({LOOK})(14, 13, 40)")

        print('A9 NOTHING UNDER THE RING')
        await gm.evaluate(f"tw.dispatch('token.set', {{ id: '{GB}', aura: {{ level: 4, color: 'gold' }} }})"); await settle(gm)
        await gm.evaluate("(() => { const b = tw.ringSettings(); tw.ringSettingsOverride = () => ({ ...b, iconSet: 'charcoal' }); })()")
        await gm.evaluate(f"({LOOK})(17.5, 12.5, 26)"); await gm.wait_for_timeout(500)
        await open_menu(gm, GB); await gm.wait_for_timeout(900)
        cnt = await gm.evaluate('tw.auraCounts()')
        # the buttons as circles (client px), then the ring hidden so the canvas under it is seen
        # the ring's own mask (what nothing may be drawn under: each laid-out button's circle, open panels' boxes), and every
        # button's centre must lie in it
        MK = await gm.evaluate("tw.ringMask()"); B = [tuple(c) for c in MK['circles']]
        dom = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn:not(.leaving)')].map(b => b.getBoundingClientRect()).filter(r => r.width > 0).map(r => [r.left + r.width / 2, r.top + r.height / 2])")
        covered = all(any((x - X) ** 2 + (y - Y) ** 2 <= R * R for X, Y, R in B) for x, y in dom)
        box = await gm.evaluate(f"tw.auraScreen('{GB}')")
        await gm.evaluate("document.querySelector('#ring').style.visibility = 'hidden'"); await gm.wait_for_timeout(300)
        from PIL import Image, ImageChops
        async def shot(): return Image.open(io.BytesIO(await gm.screenshot())).convert('RGB')
        # (motion parked for the comparison: the figure's own aura light breathes, and it is the figure's, under the ring as the figure is)
        await gm.evaluate("document.documentElement.classList.add('reduce-motion')"); await gm.wait_for_timeout(500)
        # two pairs, interleaved (with, without, with, without): a difference the aura makes is in BOTH pairs; something
        # passing on the table (another seat's cursor, a toast) is in one, so per pixel the smaller of the two is the aura's
        async def held(on): await gm.evaluate(f'tw.auraHold({str(on).lower()})'); await gm.wait_for_timeout(400)
        with_a = await shot(); await held(True); without = await shot(); await held(False); with_b = await shot(); await held(True); again = await shot(); await held(False)
        await gm.evaluate("document.documentElement.classList.remove('reduce-motion')")
        diff = ImageChops.darker(ImageChops.difference(with_a, without), ImageChops.difference(with_b, again)).convert('L')
        noise = ImageChops.darker(ImageChops.difference(without, again), ImageChops.difference(with_a, with_b)).convert('L') # (the control: the same, with no change of aura)
        inside, outside, ninside = [], [], []
        W, Hh = diff.size
        for y in range(0, Hh, 2):
            for x in range(0, W, 2):
                ins = any((x - X) ** 2 + (y - Y) ** 2 < max(1, R - 2) ** 2 for X, Y, R in B) or any(l + 2 < x < r - 2 and t + 2 < y < b - 2 for l, t, r, b in MK['rects'])
                near = any((x - X) ** 2 + (y - Y) ** 2 < (R + 16) ** 2 for X, Y, R in B)
                v = diff.getpixel((x, y))
                if ins: inside.append(v); ninside.append(noise.getpixel((x, y)))
                elif not near and box and box[0] <= x <= box[2] and box[1] <= y <= box[3]: outside.append(v)
        mean = lambda L: sum(L) / max(1, len(L))
        hot_in = sum(1 for v in inside if v > 24); hot_noise = sum(1 for v in ninside if v > 24)
        await gm.evaluate("document.querySelector('#ring').style.visibility = ''")
        with_a.save(os.path.join(SHOTS, 'aura-ring-hidden.png')); diff.point(lambda v: min(255, v * 8)).save(os.path.join(SHOTS, 'aura-ring-diff.png')); noise.point(lambda v: min(255, v * 8)).save(os.path.join(SHOTS, 'aura-ring-noise.png')); json.dump({'circles': B, 'rects': MK['rects']}, open(os.path.join(SHOTS, 'aura-ring-mask.json'), 'w'))
        check(cnt['maskOn'] and cnt['masked'] >= 1 and len(B) >= 3 and covered and len(inside) > 200 and mean(inside) <= mean(ninside) + 1.0 and hot_in <= 2 * hot_noise + len(inside) * 0.003 and mean(outside) > 6, 'A9 ☰ open over an aura: the mask is on and under the ring\'s buttons the picture is the same with and without the aura; beside them it shows',
              {'counts': cnt, 'buttons': len(B), 'covered': covered, 'inside': [len(inside), round(mean(inside), 2), hot_in], 'control': [round(mean(ninside), 2), hot_noise], 'outside': [len(outside), round(mean(outside), 2)], 'box': box})
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await gm.evaluate('tw.clearSelection(); tw.ringSettingsOverride = null'); await gm.wait_for_timeout(300)

        print('A10 LOW GRAPHICS AND REDUCE MOTION')
        c0 = await gm.evaluate('tw.auraCounts()')
        await gm.evaluate("tw.settings.setPref('gfx', 'low')"); await gm.wait_for_timeout(700)
        c1 = await gm.evaluate('tw.auraCounts()'); await gm.wait_for_timeout(400); c2 = await gm.evaluate('tw.auraCounts()'); i1 = await gm.evaluate(I(GB))
        await gm.evaluate("tw.settings.setPref('gfx', 'high')"); await gm.wait_for_timeout(500)
        await gm.evaluate("document.documentElement.classList.add('reduce-motion')"); await gm.wait_for_timeout(500)
        c3 = await gm.evaluate('tw.auraCounts()'); i3 = await gm.evaluate(I(GB))
        await gm.evaluate("document.documentElement.classList.remove('reduce-motion')"); await gm.wait_for_timeout(500); c4 = await gm.evaluate('tw.auraCounts()')
        check(not c0['still'] and c1['still'] and c1['time'] == c2['time'] and i1['sparks'] == 0 and i1['drawn'] and c3['still'] and i3['sparks'] == 0 and not c4['still'],
              'A10 Low graphics and reduce motion: the static version (the light stands still, no sparks), still drawn; back to moving after', [c0, c1, c2['time'], i1, c3, c4['still']])

        print('A11 COST')
        await gm.evaluate('ops => tw.batch(ops)', [{'type': 'token.set', 'args': {'id': i, 'aura': {'level': L, 'color': c}}} for i, L, c in [(MI, 2, 'blue'), (KI, 3, 'red'), (GB, 5, 'violet')]]); await settle(gm)
        await gm.evaluate(f"({LOOK})(14, 13, 40)"); await gm.wait_for_timeout(800)
        cc = await gm.evaluate('tw.auraCounts()')
        check(cc['live'] >= 4 and cc['tubes'] >= 4 and cc['drawCalls'] <= 3, 'A11 every aura on the table in three draw calls at most', cc)
        await gm.screenshot(path=os.path.join(SHOTS, 'aura-table.png'))

        print('A12 FIRST PERSON')
        await pl.evaluate(f"tw.dispatch('token.set', {{ id: '{MI}', aura: {{ level: 4, color: 'gold' }} }})"); await settle(pl)
        await pl.evaluate(f"tw.fpv.enter('{MI}')"); await pl.wait_for_timeout(1500)
        fp = await pl.evaluate(I(MI)); fk = await pl.evaluate(I(KI)); fg = await gm.evaluate(I(MI)); fc = await pl.evaluate('tw.auraCounts()')
        await pl.screenshot(path=os.path.join(SHOTS, 'aura-fpv.png'))
        await pl.evaluate("tw.fpv.exit()"); await pl.wait_for_timeout(800); back = await pl.evaluate(I(MI))
        check(not fp['drawn'] and fg['drawn'] and back['drawn'], 'A12 first person: her own aura is not drawn for her while she looks through her pawn (the GM still sees it); back on the map it is', {'fpv': fp, 'kit': fk, 'gm': fg, 'counts': fc, 'after': back})

        errs = [e for e in errors if 'WebGL' not in e and 'GPU stall' not in e]
        check(not errs, 'no page errors', errs[:5])
        await browser.close()

if __name__ == '__main__':
    try: asyncio.run(main())
    finally:
        for pr in procs:
            try: pr.terminate()
            except Exception: pass
    n = sum(1 for r in results if r[0]); print(f'\nbrowser_aura: {n}/{len(results)}')
    sys.exit(0 if results and n == len(results) else 1)

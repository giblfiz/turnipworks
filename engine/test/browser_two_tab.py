#!/usr/bin/env python3
"""Two-tab browser acceptance for the engine core's first milestone.

  local:  python3 engine/test/browser_two_tab.py --local
  live:   ... browser_two_tab.py --page https://implausible.enterprises/projects/turnip-works/engine/client/ \
              --relay https://implausible.enterprises/api/tw-relay --restart "sudo systemctl restart tw-relay"

A GM tab and a player tab (separate browser contexts = separate people) driven with real mouse events and the real
panel buttons; two LLM seats (one GM-created, one player-created) acting over plain GET. Every milestone item:
  M1 live cursors both ways; drags show live in the other tab; drops land in the same order everywhere
  M2 the GM spawns a room by seed; both tabs show identical layouts (hash matches, re-solved in each tab)
  M3 a tab closes and rejoins with the full state; the relay restarts mid-session with no state lost
  M4 two LLM seats act via GET; ghost cursors glide; the player's agent is refused a GM-only command and can't
     read a GM-only area
  M5 a second area watched by the GM in a follow-group PiP while in area 1; a cross-area transfer is atomic
  M6 GM undo
Screenshots land in engine/test/shots/ for a Gemini triage pass.
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
# TW_GPU=1: render on the GPU (Vulkan) instead of software GL: several times faster, and steadier on a loaded machine
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
SHOTS = os.path.join(HERE, 'shots')
ap = argparse.ArgumentParser()
ap.add_argument('--local', action='store_true')
ap.add_argument('--page'); ap.add_argument('--relay'); ap.add_argument('--restart')
ap.add_argument('--headed', action='store_true')
A = ap.parse_args()

results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail))
    print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + detail if detail else ''}", flush=True)

UA = {'User-Agent': 'TurnipWorks-acceptance/1.0'}  # Cloudflare bans the default Python-urllib signature (error 1010)
def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')

procs = []
def port_free(port):
    """a stale relay or web server left by an interrupted run would silently serve OLD code: refuse to start"""
    import socket
    with socket.socket() as so:
        so.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)  # as node does: a TIME_WAIT is not a live server
        try: so.bind(('127.0.0.1', port)); return True
        except OSError: return False

def start_local():
    for port in (18098, 18723):
        if not port_free(port): sys.exit(f'port {port} is in use (a stale test server?): stop it first')
    data = tempfile.mkdtemp(prefix='tw-b2t-')
    site = tempfile.mkdtemp(prefix='tw-site-')  # mirrors the deploy: /engine next to /tuner (the game imports the tuner live)
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(os.path.dirname(ENGINE), 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    def relay():
        log = open(os.path.join(data, 'relay.log'), 'a')
        p = subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': '18098', 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT)
        procs.append(p)
        for _ in range(100):
            time.sleep(0.1)
            try:
                urllib.request.urlopen('http://127.0.0.1:18098/health', timeout=1); break
            except Exception: pass
        return p
    web = subprocess.Popen([sys.executable, '-m', 'http.server', '18723', '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    procs.append(web)
    state = {'relay': relay()}
    def restart():
        state['relay'].terminate(); state['relay'].wait()
        state['relay'] = relay()
    time.sleep(0.8)
    return 'http://127.0.0.1:18723/engine/client/index.html', 'http://127.0.0.1:18098', restart, state

async def wait(page, js, timeout=15000, what=''):
    try:
        await page.wait_for_function(js, timeout=timeout, polling=50)
        return True
    except Exception:
        print(f'    (timed out: {what or js})')
        return False

async def bar(pg, text):
    if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
    await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=8); await pg.wait_for_timeout(250); await pg.keyboard.press('Enter')

async def output(pg, contains=''):
    await wait(pg, f"!document.querySelector('#output').hidden && document.querySelector('#output textarea').value.includes('{contains}')", 10000, 'output panel')
    v = await pg.evaluate("document.querySelector('#output textarea').value"); await pg.keyboard.press('Escape'); return v

async def drag(page, frm, to, steps=12, during=None):
    """real mouse drag from world point frm to world point to; `during` runs mid-drag (before the drop)"""
    a = await page.evaluate(f"tw.screenOf({frm[0]}, {frm[1]})")
    b = await page.evaluate(f"tw.screenOf({to[0]}, {to[1]})")
    await page.mouse.move(a['x'], a['y'] - 6)  # aim at the token's body, slightly above its base
    await page.mouse.down()
    for i in range(1, steps + 1):
        await page.mouse.move(a['x'] + (b['x'] - a['x']) * i / steps, a['y'] - 6 + (b['y'] - a['y']) * i / steps)
        await page.wait_for_timeout(30)
    if during: await during()
    await page.mouse.up()

async def main():
    if A.local:
        page_url, relay, restart, _ = start_local()
        page_url += f'?relay={urllib.parse.quote(relay)}&api=&nofx&boxes&nointro'
    else:
        page_url, relay = A.page + ('&' if '?' in A.page else '?') + 'nofx&boxes&nointro', A.relay.rstrip('/')  # catalog boxes, no FX: this test is about the netcode, keep software GL light
        restart = lambda: subprocess.run(A.restart, shell=True, check=True)
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def new_tab(url):
            ctx = await browser.new_context(viewport={'width': 1200, 'height': 760})
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            pg.on('console', lambda m: errors.append(f'console: {m.text}') if m.type == 'error' else None)
            await pg.goto(url)
            return pg

        # ---------- GM starts a campaign; invites a player through the panel ----------
        gm = await new_tab(page_url)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST two tab ' + __import__('time').strftime('%m-%d %H:%M:%S') + ' (throwaway)')
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 25000, 'gm ready'), 'GM tab live', 'transport: ' + str(await gm.evaluate('window.tw && tw.transport()')))
        # This suite exercises the open tabletop; vision fog has its own three-seat suite.
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
        await wait(gm, "tw.sync.campaign.defaults.fogOfWar === false && tw.sync.pendingCount() === 0", 15000, 'open-table fixture')
        await bar(gm, 'invite Brakka')
        invite = await output(gm, '#s=')
        pl = await new_tab(invite)
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 25000, 'player ready'), 'player tab joined from the invite link')
        player_seat = await pl.evaluate('tw.sync.me')
        T1 = await gm.evaluate('tw.area()')

        # one token for the player, one NPC, through the panel
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_brakka0001', name: 'Brakka', x: tw.main.grab.focus.x - 2, z: tw.main.grab.focus.z + 1, owner: '{player_seat}', color: '#5aa9e6' }})")
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_keeper0001', name: 'Innkeeper', x: tw.main.grab.focus.x + 3, z: tw.main.grab.focus.z - 2, color: '#e5734f' })")
        await wait(pl, "Object.values(tw.entities()).filter(e => e.kind === 'token').length === 2", 10000, 'tokens on player tab')
        toks = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').map(e => ({id: e.id, name: e.name, x: e.x, z: e.z, owner: e.owner}))")
        brakka = next(t for t in toks if t['name'] == 'Brakka'); keeper = next(t for t in toks if t['name'] == 'Innkeeper')

        # ---------- M1: cursors ----------
        print('M1 cursors, drags, order')
        for pg in (gm, pl):
            c = await pg.evaluate("tw.screenOf(tw.main.grab.focus.x + 8, tw.main.grab.focus.z + 4)")
            await pg.mouse.move(c['x'], c['y']); await pg.mouse.move(c['x'] + 3, c['y'] + 2)
        await wait(pl, f"tw.cursors().some(c => c.name === 'Harry' && c.pos)", 5000, 'GM cursor on player tab')
        await wait(gm, f"tw.cursors().some(c => c.name === 'Brakka' && c.pos)", 5000, 'player cursor on GM tab')
        # the receiving tab glides toward the latest sample: wait for it to settle, then measure
        near = lambda name, other: f"(() => {{ const want = {other}; const c = tw.cursors().find(c => c.name === '{name}'); return c && c.pos && Math.hypot(c.pos[0] - want[0], c.pos[1] - want[1]) < 0.05; }})()"
        gmc = await gm.evaluate("tw.ps.cur.cursor")
        await wait(pl, near('Harry', json.dumps(gmc)), 5000, 'GM cursor settles')
        seen = await pl.evaluate("tw.cursors().find(c => c.name === 'Harry')?.pos")
        err = ((gmc[0] - seen[0]) ** 2 + (gmc[1] - seen[1]) ** 2) ** 0.5 if seen else 999
        check(err < 0.2, 'GM cursor appears on the player tab as a world ground point', f'error {err:.3f} ft')
        plc = await pl.evaluate("tw.ps.cur.cursor")
        await wait(gm, near('Brakka', json.dumps(plc)), 5000, 'player cursor settles')
        seen2 = await gm.evaluate("tw.cursors().find(c => c.name === 'Brakka')?.pos")
        err2 = ((plc[0] - seen2[0]) ** 2 + (plc[1] - seen2[1]) ** 2) ** 0.5 if seen2 else 999
        check(err2 < 0.2, 'player cursor appears on the GM tab', f'error {err2:.3f} ft')

        # player drags their token; the GM tab sees it move during the drag, before the drop
        mid = {}
        async def peek():
            await gm.wait_for_timeout(350)
            mid['drawn'] = await gm.evaluate(f"tw.drawn('{brakka['id']}')")
            mid['state'] = await gm.evaluate(f"[tw.entities()['{brakka['id']}'].x, tw.entities()['{brakka['id']}'].z]")
        target = [brakka['x'] + 14, brakka['z'] + 6]
        await drag(pl, [brakka['x'], brakka['z']], target, during=peek)
        moved_live = mid.get('drawn') and abs(mid['drawn'][0] - brakka['x']) > 5 and abs(mid['state'][0] - brakka['x']) < 0.01
        check(moved_live, 'drag shows live on the other tab before the drop (presence, not state)', f"drawn {mid.get('drawn')} while state still {mid.get('state')}")
        await wait(gm, f"Math.abs(tw.entities()['{brakka['id']}'].x - {target[0]}) < 1.5 && tw.sync.pendingCount() === 0", 8000, 'drop lands')
        e1 = await gm.evaluate(f"tw.entities()['{brakka['id']}']"); e2 = await pl.evaluate(f"tw.entities()['{brakka['id']}']")
        check(abs(e1['x'] - target[0]) < 1.5 and e1 == e2, 'drop lands in both tabs at the drop point', f"({e1['x']:.2f}, {e1['z']:.2f}) vs target ({target[0]:.2f}, {target[1]:.2f})")
        # player may not drag the NPC: the drag never starts (and the relay would refuse it anyway)
        await drag(pl, [keeper['x'], keeper['z']], [keeper['x'] + 10, keeper['z']])
        await pl.wait_for_timeout(500)
        check(await gm.evaluate(f"tw.entities()['{keeper['id']}'].x") == keeper['x'], "player can't drag the GM's NPC")
        # both tabs grab the SAME token at the same moment and drop it in different places: the relay's order
        # decides, and both tabs must end up applying the same entries in the same order (and the same state)
        n0 = len(await gm.evaluate(f"tw.applied.filter(e => e[0] === '{T1}')"))
        for i in range(4):
            await wait(pl, f"tw.seq() === {await gm.evaluate('tw.seq()')} && tw.sync.pendingCount() === 0", 8000, 'tabs in step')
            cur = await gm.evaluate(f"tw.entities()['{brakka['id']}']")
            await asyncio.gather(drag(gm, [cur['x'], cur['z']], [cur['x'] - 4 - i, cur['z'] + 3], steps=6),
                                 drag(pl, [cur['x'], cur['z']], [cur['x'] + 3 + i, cur['z'] - 2], steps=6))
            await wait(gm, 'tw.sync.pendingCount() === 0', 8000); await wait(pl, 'tw.sync.pendingCount() === 0', 8000)
        a1 = await gm.evaluate(f"tw.applied.filter(e => e[0] === '{T1}').map(e => e[1] + ':' + e[2])")
        a2 = await pl.evaluate(f"tw.applied.filter(e => e[0] === '{T1}').map(e => e[1] + ':' + e[2])")
        common = set(a1) & set(a2)
        same_state = await gm.evaluate('JSON.stringify(tw.entities())') == await pl.evaluate('JSON.stringify(tw.entities())')
        order_ok = [x for x in a1 if x in common] == [x for x in a2 if x in common]
        check(order_ok and same_state and len(common) - n0 >= 6, 'simultaneous drops on one token land in the same order everywhere', f'{len(common) - n0} drops landed from 4 rounds of both tabs grabbing at once (a grab aims at where the token is drawn, so a late grab can miss), same seq order in both tabs; states identical: {same_state}')

        # ---------- M2: room by seed ----------
        print('M2 room by seed')
        await gm.evaluate("(() => { const f = tw.main.grab.focus; tw.spawnRoom('common', Math.round(f.x / 5) - 3, Math.round(f.z / 5) - 8, 6, 4, 4242); })()")
        await wait(pl, "tw.hashCheck().length === 1", 15000, 'room on player tab')
        await wait(gm, "tw.hashCheck().length === 1", 15000, 'room on gm tab')
        h1 = await gm.evaluate('tw.hashCheck()[0]'); h2 = await pl.evaluate('tw.hashCheck()[0]')
        lay_same = await gm.evaluate("JSON.stringify(Object.values(tw.entities()).find(e => e.kind === 'room').layout)") == await pl.evaluate("JSON.stringify(Object.values(tw.entities()).find(e => e.kind === 'room').layout)")
        check(h1['creator'] == h2['creator'] and h1['match'] and h2['match'] and lay_same, 'both tabs show identical layouts; each re-solved the seed to the creator hash', f"hash {h1['creator']} (gm re-solve {h1['mine']}, player re-solve {h2['mine']})")
        await gm.screenshot(path=os.path.join(SHOTS, 'gm-room.png')); await pl.screenshot(path=os.path.join(SHOTS, 'player-room.png'))

        # ---------- M4: two LLM seats over GET ----------
        print('M4 LLM seats')
        await bar(gm, 'assistant'); card_as = await output(gm, '/card?seat=')
        await bar(pl, 'advisor'); card_ad = await output(pl, '/card?seat=')
        tok_as = urllib.parse.parse_qs(urllib.parse.urlparse(card_as).query)['seat'][0]
        tok_ad = urllib.parse.parse_qs(urllib.parse.urlparse(card_ad).query)['seat'][0]
        cbase = card_as.split('/card?')[0]
        with urllib.request.urlopen(urllib.request.Request(card_ad, headers=UA)) as r: card_text = r.read().decode()
        check("Advisor (Brakka's agent)" in card_text and 'room.spawn' not in card_text, "advisor's rules card says whose agent it is and offers no GM commands")
        st, s = get(f'{cbase}/a/{T1}/state?seat={tok_as}')
        await wait(gm, "tw.cursors().some(c => c.ghost && c.name === 'Assistant' && c.thinking)", 6000, 'ghost thinking')
        g = await gm.evaluate("tw.cursors().find(c => c.ghost && c.name === 'Assistant')")
        check(g and g['thinking'] and "Harry's GM assistant" in (g['label'] or ''), 'GM assistant read the area: ghost cursor shows "thinking" with whose agent', json.dumps(g))
        kx, kz = keeper['x'] + 20, keeper['z'] + 12
        st, r = get(f"{cbase}/a/{T1}/do?cmd=token.move&id={keeper['id']}&x={kx}&z={kz}&based_on={s['area']['seq']}&nonce=as-1&seat={tok_as}")
        check(r.get('ok'), 'GM assistant moves the NPC via GET', json.dumps(r)[:120])
        # the ghost glides to what it acted on: sample it in the player tab
        samples = []
        for _ in range(50):  # until it arrives (≤ 4 s): background tabs under software GL draw slowly
            c = await pl.evaluate("tw.cursors().find(c => c.ghost && c.name === 'Assistant')")
            if c and c['pos']: samples.append(c['pos'])
            if samples and ((samples[-1][0] - kx) ** 2 + (samples[-1][1] - kz) ** 2) ** 0.5 < 0.5: break
            await pl.wait_for_timeout(80)
        d = [((x - kx) ** 2 + (z - kz) ** 2) ** 0.5 for x, z in samples]
        inter = [v for v in d if 0.3 < v < (d[0] if d else 0)]
        check(len(d) > 5 and d[-1] < 1.0 and len(inter) >= 3 and all(b <= a + 0.05 for a, b in zip(d, d[1:])), 'ghost cursor glides to the acted-on token (seen in the player tab)', 'distance ' + ' → '.join(f'{v:.1f}' for v in d[::2]))
        st, r = get(f"{cbase}/a/{T1}/do?cmd=room.spawn&id=room_advisor001&type=privy&x=20&z=20&w=2&d=2&seed=1&nonce=ad-1&seat={tok_ad}")
        check(r.get('ok') is False and r.get('code') == 'forbidden', 'player-created seat REFUSED a GM-only command (room.spawn)', r.get('why', ''))
        st, s2 = get(f'{cbase}/a/{T1}/state?seat={tok_ad}')
        bx = s2['tokens'][[t['id'] for t in s2['tokens']].index(brakka['id'])]
        st, r = get(f"{cbase}/a/{T1}/do?cmd=token.move&id={brakka['id']}&x={bx['x'] + 5}&z={bx['z']}&based_on={s2['area']['seq']}&nonce=ad-2&seat={tok_ad}")
        check(r.get('ok'), "player's advisor moves the player's own token via GET")
        await wait(gm, f"Math.abs(tw.entities()['{brakka['id']}'].x - {bx['x'] + 5}) < 0.01", 5000)
        await wait(gm, "tw.cursors().some(c => c.ghost && c.name === 'Advisor')", 5000, 'advisor ghost on GM tab')
        ga = await gm.evaluate("tw.cursors().find(c => c.ghost && c.name === 'Advisor')")
        check(ga and "Brakka's agent" in (ga['label'] or ''), "advisor's ghost shows on the GM tab as Brakka's agent")

        # ---------- M5: second area (GM-only), follow-group PiP, atomic transfer ----------
        print('M5 second area, PiP, transfer')
        await bar(gm, 'new area The cellar')
        await wait(gm, 'tw.sync.campaign.areas.length === 2', 8000, 'second area')
        T2 = await gm.evaluate("tw.sync.campaign.areas.find(t => t.name === 'The cellar').id")
        st, r = get(f'{cbase}/a/{T2}/state?seat={tok_ad}')
        check(st == 404 and r.get('code') == 'invisible', "player-created seat can't read the GM-only area", f'HTTP {st}')
        check(await pl.evaluate('tw.sync.campaign.areas.length') == 1, 'player tab does not even list the GM-only area')
        await gm.evaluate(f"tw.openPip('{T2}')")
        await wait(gm, f"tw.pipInfo() && tw.pipInfo().area === '{T2}' && tw.sync.view('{T2}')", 8000, 'pip open')
        # select the NPC with a click, send it to the cellar through the panel; probe every frame for atomicity
        # Concurrent drops above leave Brakka at either winner's position. Keep the transfer target
        # clear of that pawn and the generated room, so this tests transfer rather than occlusion.
        await gm.evaluate(f"tw.dispatch('token.move', {{id: '{keeper['id']}', x: 100, z: 100}})")
        await wait(gm, f"tw.entities()['{keeper['id']}'].x === 100 && tw.sync.pendingCount() === 0", 5000, 'isolated transfer target')
        await gm.wait_for_timeout(500)
        kp = await gm.evaluate(f"tw.entities()['{keeper['id']}']")
        await gm.evaluate(f"""window.__probe = []; (function f() {{ const a = !!tw.sync.view('{T1}')?.entities['{keeper['id']}'], b = !!tw.sync.view('{T2}')?.entities['{keeper['id']}']; __probe.push(a + ',' + b); window.__after = (window.__after || 0) + (b ? 1 : 0); if (__probe.length < 3000 && window.__after < 30) requestAnimationFrame(f); }})();""")
        # Pan to the NPC, then locate a canvas pixel whose real picking ray hits it. A fixed six-pixel
        # offset from the ground projection can miss its body as the camera settles or the scale changes.
        await gm.evaluate(f"tw.main.rule = 'free'; tw.main.glide = null; tw.main.grab.focus.set({kp['x']}, 0, {kp['z']}); tw.main.grab.update()")
        hit = """() => { const e = tw.entities()[%s], w = tw.worldOf(tw.area());
          const c = tw.screenOf(e.x, e.z, tw.main, (e.y || 0) + 1.5);
          for (const dy of [0, -3, 3, -6, 6, -12, 12]) for (const dx of [0, -3, 3, -6, 6, -12, 12]) {
            const x = c.x + dx, y = c.y + dy;
            const r = document.getElementById('c').getBoundingClientRect();
            if (tw.pip?.contains(x - r.left, y - r.top, r.width, r.height)) continue;
            if (document.elementFromPoint(x, y)?.id === 'c' && tw.selectionFor(w.pick(tw.rayAt(x, y))) === e.id) return { x, y };
          } return null;
        }""" % json.dumps(keeper['id'])
        await gm.wait_for_function(hit, timeout=8000)
        c = await gm.evaluate(hit)
        # Rings/labels follow the camera on animation frames. Let that DOM and the pointer's hover
        # state settle before trusting elementFromPoint; a pre-render hit can be covered at mouse-down.
        for _ in range(8):
            await gm.mouse.move(c['x'], c['y'])
            await gm.evaluate('new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))')
            target = await gm.evaluate("({x,y}) => { const el = document.elementFromPoint(x,y); return { canvas: el?.id === 'c', tag: el?.tagName, id: el?.id, cls: el?.className, text: el?.textContent?.slice(0,80) }; }", c)
            if target['canvas'] and await gm.evaluate("({x,y}) => tw.selectionFor(tw.worldOf(tw.area()).pick(tw.rayAt(x,y))) === %s" % json.dumps(keeper['id']), c):
                break
            print('    M5 pre-render target became covered', {'point': c, 'target': target}, flush=True)
            await gm.wait_for_function(hit, timeout=8000)
            c = await gm.evaluate(hit)
        else:
            raise AssertionError('NPC has no stable, unobscured canvas hit')
        await gm.evaluate("({x,y}) => { window.__npcClick = { requested: {x,y}, floatHit: tw.selectionFor(tw.worldOf(tw.area()).pick(tw.rayAt(x,y))), integerHit: tw.selectionFor(tw.worldOf(tw.area()).pick(tw.rayAt(Math.trunc(x),Math.trunc(y)))) }; document.addEventListener('pointerdown', e => { Object.assign(__npcClick, { target: { tag: e.target.tagName, id: e.target.id, cls: e.target.className }, actual: {x:e.clientX,y:e.clientY}, actualHit: tw.selectionFor(tw.worldOf(tw.area()).pick(tw.rayAt(e.clientX,e.clientY))), rule: tw.main.rule, glide: !!tw.main.glide }); }, { capture: true, once: true }); }", c)
        await gm.mouse.click(c['x'], c['y'])
        print('    M5 pointer evidence', await gm.evaluate('__npcClick'), flush=True)
        selected = await wait(gm, f"tw.sel.has('{keeper['id']}')", 3000, 'npc selected')
        detail = await gm.evaluate('({ press: tw.lastPress, down: tw.lastDown, selected: [...tw.sel], pointer: tw.pointerView, view: tw.main.describe() })') if not selected else ''
        check(selected, 'M5 real pointer click selects the NPC before transfer', str(detail) if detail else '')
        await bar(gm, 'send to The cellar')
        await wait(gm, f"tw.sync.view('{T2}')?.entities['{keeper['id']}']", 8000, 'transfer landed')
        await gm.wait_for_timeout(300)
        probe = await gm.evaluate('[...new Set(__probe)]')
        check('true,true' not in probe and 'false,false' not in probe and 'false,true' in probe, 'cross-area transfer is atomic (never on both areas, never on neither, frame by frame)', f'states seen: {probe}')
        await wait(pl, f"!tw.entities()['{keeper['id']}']", 5000)
        check(not await pl.evaluate(f"tw.entities()['{keeper['id']}']"), 'player sees the NPC leave area 1 (and nothing of the cellar)')
        # the GM watches the cellar in a follow-group PiP while in area 1: move the NPC there (via the assistant) and the PiP follows
        f0 = await gm.evaluate('tw.pipInfo().focus')
        st, r = get(f"{cbase}/a/{T2}/do?cmd=token.move&id={keeper['id']}&x=60&z=-30&nonce=as-2&seat={tok_as}")
        await wait(gm, "Math.hypot(tw.pipInfo().focus[0] - 60, tw.pipInfo().focus[1] + 30) < 3", 8000, 'pip follows')
        info = await gm.evaluate('tw.pipInfo()')
        check(r.get('ok') and await gm.evaluate('tw.area()') == T1 and info['rule'] == 'follow' and abs(info['focus'][0] - 60) < 3 and abs(info['focus'][1] + 30) < 3,
              'GM in area 1 watches the cellar in a follow-group PiP that follows the token', f"PiP focus {f0} → {info['focus']} (token at 60, -30); main view in area 1")
        await gm.screenshot(path=os.path.join(SHOTS, 'gm-pip.png'))

        # ---------- M6: GM undo ----------
        print('M6 undo')
        cur = await gm.evaluate(f"tw.entities()['{brakka['id']}']")
        await gm.evaluate(f"tw.main.grab.focus.set({cur['x']}, 0, {cur['z']}); tw.main.grab.update()")  # clear of the PiP inset
        await gm.wait_for_timeout(150)
        await drag(gm, [cur['x'], cur['z']], [cur['x'] + 10, cur['z'] + 10], steps=6)
        seen = await wait(pl, f"Math.abs(tw.entities()['{brakka['id']}'].x - {cur['x'] + 10}) < 1.5", 5000, 'gm move seen')
        if not seen: print('    after', cur, await gm.evaluate(f"JSON.stringify([tw.entities()['{brakka['id']}'], tw.sync.pendingCount(), tw.applied.slice(-3)])"), await pl.evaluate(f"JSON.stringify(tw.entities()['{brakka['id']}'])"))
        check(seen, 'GM drags the pawn (seen on the player tab)')
        await gm.keyboard.press('Control+z')
        await wait(pl, f"Math.abs(tw.entities()['{brakka['id']}'].x - {cur['x']}) < 0.001 && Math.abs(tw.entities()['{brakka['id']}'].z - {cur['z']}) < 0.001", 5000, 'undo seen')
        b2 = await pl.evaluate(f"tw.entities()['{brakka['id']}']")
        check(abs(b2['x'] - cur['x']) < 0.001 and abs(b2['z'] - cur['z']) < 0.001, 'GM undo puts the token back, in both tabs', f"({b2['x']:.2f}, {b2['z']:.2f})")
        await gm.keyboard.press('Control+z')  # the GM's next own action in area 1: the transfer
        await wait(gm, f"tw.sync.view('{T1}')?.entities['{keeper['id']}'] && !tw.sync.view('{T2}')?.entities['{keeper['id']}']", 5000, 'undo transfer')
        check(await gm.evaluate(f"!!tw.sync.view('{T1}').entities['{keeper['id']}']"), 'GM undo in area 1 reverses the transfer (atomically, back from the cellar)')

        # ---------- M3: tab close + rejoin; relay restart mid-session ----------
        print('M3 rejoin and relay restart')
        await pl.context.close()
        cur = await gm.evaluate(f"tw.entities()['{brakka['id']}']")
        await drag(gm, [cur['x'], cur['z']], [cur['x'] - 6, cur['z'] - 6], steps=6)
        await wait(gm, 'tw.sync.pendingCount() === 0', 5000)
        pl = await new_tab(invite)
        await wait(pl, 'window.tw && tw.ready && tw.ready()', 20000, 'rejoin')
        await wait(pl, f"tw.seq() === {await gm.evaluate('tw.seq()')}", 8000)
        # the same world, except room and building labels, which never reach a seat that may not edit rooms (core/labels.js)
        unlabelled = "JSON.stringify(Object.fromEntries(Object.entries(tw.entities()).sort().map(([k, e]) => [k, e.kind === 'room' ? (({ name, ...r }) => r)(e) : e.kind === 'building' ? { ...e, name: 'Building' } : e])))"
        same = await gm.evaluate(unlabelled) == await pl.evaluate(unlabelled)
        check(same, 'closed tab rejoins with the full state (labels excepted: players never receive them)', f"seq {await pl.evaluate('tw.seq()')}")
        before = await gm.evaluate('JSON.stringify([tw.seq(), tw.entities(), tw.sync.view(%r)?.entities])' % T2)
        restart()
        await gm.wait_for_timeout(1500)
        ok1 = await wait(gm, "tw.sync.status === 'live'", 20000, 'gm reconnect'); ok2 = await wait(pl, "tw.sync.status === 'live'", 20000, 'player reconnect')
        await gm.wait_for_timeout(800)
        after = await gm.evaluate('JSON.stringify([tw.seq(), tw.entities(), tw.sync.view(%r)?.entities])' % T2)
        st, sx = get(f'{cbase}/a/{T1}/state?seat={tok_as}')
        check(ok1 and ok2 and before == after and st == 200 and sx['area']['seq'] == json.loads(after)[0], 'relay restarted mid-session: both tabs reconnect by themselves, nothing lost', f"seq {json.loads(after)[0]} before and after; relay agrees")
        cur = await pl.evaluate(f"tw.entities()['{brakka['id']}']")
        await drag(pl, [cur['x'], cur['z']], [cur['x'] + 5, cur['z']], steps=6)
        await wait(gm, f"Math.abs(tw.entities()['{brakka['id']}'].x - {cur['x'] + 5}) < 1.5", 6000, 'post-restart drag')
        check(abs(await gm.evaluate(f"tw.entities()['{brakka['id']}'].x") - (cur['x'] + 5)) < 1.5, 'play continues after the restart (player drag lands on the GM tab)')
        await gm.screenshot(path=os.path.join(SHOTS, 'gm-final.png')); await pl.screenshot(path=os.path.join(SHOTS, 'player-final.png'))
        real_errors = [e for e in errors if 'WebSocket' not in e and 'ERR_CONNECTION_REFUSED' not in e and '502' not in e and not (A.local and 'Failed to load resource' in e)]
        check(not real_errors, 'no page errors', '; '.join(real_errors[:5]))
        await browser.close()

    passed = sum(1 for r in results if r[0])
    print(f'browser two-tab: {passed}/{len(results)} passed')
    for p in procs: p.terminate()
    return passed == len(results)

try:
    ok = asyncio.run(main())
finally:
    for p in procs:
        try: p.terminate()
        except Exception: pass
sys.exit(0 if ok else 1)

#!/usr/bin/env python3
"""The game on a phone (2026-10-24, docs/UI.md "On a phone"): the layout, the finger, two-finger camera gestures.

  local:  TW_GPU=1 python3 engine/test/browser_handheld.py --local [--shots]
  dev:    ... browser_handheld.py --page 'https://dev.turnipworks.net/'

Chromium with is_mobile + has_touch (a coarse pointer: html.tw-hand) at 390 x 844 (portrait) and 844 x 390
(landscape); every finger is a CDP Input.dispatchTouchEvent, so two fingers are two real touch points.

  LAYOUT  laid out for a phone: the command bar, the launchers, the avatars, the area pills and "Other games" do not
          overlap and are whole on screen; each launcher opens its tray / window with a tap, whole on screen; finger
          targets at least 40 px (launchers, Other games, the area's Hide, a tray's pin, the live tool's Cancel)
  RING    a tap on a pawn selects it and its ring comes up (buttons >= 40 px); a tap on ☰ opens it; a tap on bare
          ground clears it
  PLACE   the command bar: a tapped row arms the tool (its ghost click does not open Settings); the chip says what to
          do and has Cancel; a finger down, moved and lifted on the map puts the thing down where it was lifted; the
          tool ends; Cancel ends a tool and nothing is placed. The Pawns tray: a figure tile arms "place a pawn", the
          tray gets out of the way, a tap puts the pawn down. Build: Fantasy ▸ Tavern ▸ Common room, the tray gets out
          of the way, a finger drag draws the room; a second finger during the drag drops that stroke
  CAMERA  two fingers: a twist turns the view (yaw), the map turning WITH the fingers; both fingers up tilts (pitch
          lower), down tilts back; a spread zooms in, without turning; one finger still pans; one of two lifted, the
          other pans on; no page errors
  DESK    1280 x 800 with a mouse: none of it (no tw-hand, no chip), the ring on a click as before; no Move or
          Delete on its ring, its shape without the full clock, the crumbs and Other games as they were
  TWEAKS  (Harry 2026-10-24: "blood price", Delete and Move on the ring, the full clock, no selection popup, "player
          on the road"), both orientations:
    CHROME   Other games, the area pills, the crumbs (the selection's name), the connection line (live), the avatars'
             area tags and a one-storey level meter are not shown; Settings still has Other games / New game
    RING     a GM's thing: Move first and Delete last on the main row (Delete in the painted bin), the full clock, the
             ring whole on screen under the top chrome, shut and open (the oval not grown); a tap on Delete deletes
             it, one undo brings it back
    MOVE     a tap on Move moves nothing; dragged, the ring freezes, the handle rides under the finger, the pawn
             follows the finger's travel and is put down there; one undo; a finger on a SELECTED pawn drags it
    PIP      none on a phone: openPip / openLocalPip refuse, the bar has no PiP command or "PiP" alt, following a
             pawn in another area goes there in the main view, Build ▸ a room shows no library PiP (DESK: it opens and
             swaps as before)
    PLAYER   the invite link on a phone: the camera on my pawn, its ring whole on screen with Move and no Delete;
             neither on the GM's pawn; the empty bar's Roll d20 rolls with one tap
"""
import argparse, asyncio, json, math, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()
SHOTS = os.path.join(REPO, 'experiments', '2026-10-24-phone-play', 'stills')  # (the tweaks pass writes tweaks-*.jpg beside them)
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true')
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:300] if detail != '' else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18323,18953').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-hand-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'
def cleanup():
    for pr in procs:
        pr.terminate()
        try: pr.wait(5)
        except Exception: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def touch(cdp, typ, pts):
    await cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
async def tap(cdp, x, y):
    await touch(cdp, 'touchStart', [(x, y)]); await asyncio.sleep(0.05); await touch(cdp, 'touchEnd', [])
async def drag(cdp, p0, p1, steps=12, lift=True):
    await touch(cdp, 'touchStart', p0)
    for s in range(1, steps + 1):
        f = s / steps; await touch(cdp, 'touchMove', [(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f) for a, b in zip(p0, p1)]); await asyncio.sleep(0.016)
    if lift: await touch(cdp, 'touchEnd', [])
async def at(pg, sel):  # the middle of the first visible match, scrolled into its list's view
    return await pg.evaluate(f"(() => {{ const e = [...document.querySelectorAll({json.dumps(sel)})].find(e => e.getBoundingClientRect().height > 0); if (!e) return null; e.scrollIntoView({{ block: 'center' }}); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }})()")
BOX = "(sel) => { const e = document.querySelector(sel); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return r.width ? [r.left, r.top, r.right, r.bottom] : null; }"
def overlap(a, b): return bool(a and b and a[0] < b[2] - 1 and b[0] < a[2] - 1 and a[1] < b[3] - 1 and b[1] < a[3] - 1)
CAM = "(() => { const g = tw.main.grab; return { yaw: g.yaw, pitch: g.pitch, dist: g.dist, fx: g.focus.x, fz: g.focus.z }; })()"
VIEW = "(() => { const g = tw.main.grab; g.focus.set(20, 0, 20); g.yaw = 0; g.pitch = 55; g.dist = 85; g.update(); tw.main.rule = 'free'; })()"
COUNT = lambda kind: f"Object.values(tw.entities()).filter(e => e.kind === '{kind}').length"

async def phone(p, page, W, H):
    tag = 'portrait' if H > W else 'landscape'
    print(f'--- {tag} {W} x {H}')
    br = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
    ctx = await br.new_context(viewport={'width': W, 'height': H}, is_mobile=True, has_touch=True, device_scale_factor=2, reduced_motion='reduce')
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    await pg.goto(page + '&phone=0')  # (the banner has its own suite, browser_phone.py)
    await pg.wait_for_selector('#newCampaign input[name=gm]', timeout=30000)
    await pg.fill('#newCampaign input[name=gm]', 'Harry')
    nm = await pg.query_selector('#newCampaign input[name=name]')
    if nm: await nm.fill(f"TEST phone play {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
    await pg.click('#newCampaign button')
    check(await wait(pg, 'window.tw && tw.ready && tw.ready()', 60000), f'{tag}: the table is live')
    await pg.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
    await pg.evaluate("document.querySelector('.lmcard .lm-x')?.click()")  # (the GM-link card: its own suite)
    cdp = await ctx.new_cdp_session(pg)
    shot = lambda name: pg.screenshot(path=os.path.join(SHOTS, f'{tag}-{name}.jpg'), type='jpeg', quality=70) if A.shots else asyncio.sleep(0)
    await pg.evaluate(VIEW); await pg.wait_for_timeout(600)

    # ================= LAYOUT =================
    hand = await pg.evaluate("document.documentElement.classList.contains('tw-hand')")
    boxes = {k: await pg.evaluate(f"({BOX})('{s}')") for k, s in (('bar', '#bar'), ('launchers', '#launchers'), ('roster', '#roster'), ('area', '#areaState'), ('other', '#otherGames'), ('chat', '#chat'))}
    pairs = [(a, b) for i, a in enumerate(boxes) for b in list(boxes)[i + 1:] if overlap(boxes[a], boxes[b])]
    whole = [k for k, b in boxes.items() if b and (b[0] < -1 or b[1] < -1 or b[2] > W + 1 or b[3] > H + 1)]
    check(hand and not pairs and not whole and all(boxes[k] for k in ('bar', 'launchers', 'roster', 'chat')), f'LAYOUT {tag}: laid out for a phone; bar, launchers, avatars, area pills, Other games and chat apart and on screen', {'overlaps': pairs, 'off': whole, **boxes})
    await shot('table')
    opened = {}
    for i, (name, sel) in enumerate((('pawns', '#pawnsTray'), ('build', '#buildMenu'), ('settings', '.smodal'))):
        b = await at(pg, f'#launchers .launcher:nth-child({i + 1})'); await tap(cdp, *b); await pg.wait_for_timeout(700)
        box = await pg.evaluate(f"({BOX})('{sel}')")
        opened[name] = box and box[0] >= -1 and box[1] >= -1 and box[2] <= W + 1 and box[3] <= H + 1
        await shot(f'open-{name}')
        if name == 'build': small_tpin = await pg.evaluate("(() => { const b = document.querySelector('#buildMenu .tpin'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.width, r.height]; })()")
        await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        if name == 'settings': await pg.evaluate("document.querySelector('#settingsModal .sclose, #settingsModal [data-close], .smodal .sx')?.click()"); await pg.wait_for_timeout(200)
    check(all(opened.values()), f'LAYOUT {tag}: Pawns, Build and Settings each open with a tap, whole on screen', opened)
    sizes = await pg.evaluate("""(() => { const s = (sel) => [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width).map(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }); return { launchers: s('#launchers .launcher'), other: s('#otherGames'), hide: s('#areaState button'), bar: s('#bar') }; })()""")
    small = {k: v for k, v in sizes.items() if any(x < 40 for x in v)}
    check(not small and small_tpin and min(small_tpin) >= 40, f'LAYOUT {tag}: finger targets at least 40 px (launchers, Other games, the area\'s Hide, the bar, a tray\'s pin)', {**sizes, 'pin': small_tpin})

    # ================= RING =================
    await pg.evaluate("tw.batch([{type:'token.create', args:{id:'tok_hand00001', name:'Brakka', x:22.5, z:22.5}}])")
    await wait(pg, "tw.entities()['tok_hand00001'] && tw.sync.pendingCount() === 0", 10000, 'pawn')
    await pg.evaluate("(() => { const g = tw.main.grab; g.focus.set(22.5, 0, 22.5); g.yaw = 0; g.pitch = 55; g.dist = 70; g.update(); tw.main.rule = 'free'; })()"); await pg.wait_for_timeout(700)
    s = await pg.evaluate("(() => { const e = tw.entities()['tok_hand00001']; return tw.screenOf(e.x, e.z, tw.main, 2); })()")
    await tap(cdp, s['x'], s['y']); await pg.wait_for_timeout(900)
    rg = await pg.evaluate("({ sel: [...tw.sel], hidden: document.getElementById('ring').hidden, n: document.querySelectorAll('#ring .rbtn').length, min: Math.min(...[...document.querySelectorAll('#ring .rbtn')].map(b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); })) })")
    check(rg['sel'] == ['tok_hand00001'] and not rg['hidden'] and rg['n'] >= 3 and rg['min'] >= 40, f'RING {tag}: a tap on a pawn selects it and its ring comes up, buttons >= 40 px', rg)
    await shot('ring')
    mb = await at(pg, '#ring .rbtn[data-menu]')
    top = mb and await pg.evaluate(f"!!document.elementFromPoint({mb[0]}, {mb[1]})?.closest('#ring')")
    if mb: await tap(cdp, *mb); await pg.wait_for_timeout(900)
    check(mb and top and await pg.evaluate("tw.ringState()") == 'expanded', f'RING {tag}: ☰ is not under the HUD, and a tap on it opens the ring', [top, await pg.evaluate("tw.ringState()")])
    await shot('ring-open')
    await tap(cdp, W * 0.5, H * 0.7 if H > W else H * 0.78); await pg.wait_for_timeout(700)
    check(await pg.evaluate("tw.sel.size === 0 && document.getElementById('ring').hidden"), f'RING {tag}: a tap on bare ground clears it')
    await pg.evaluate("tw.batch([{type:'token.delete', args:{id:'tok_hand00001'}}])"); await pg.evaluate(VIEW); await pg.wait_for_timeout(400)

    # ================= PLACE: the command bar =================
    async def bar_pick(word):
        b = await at(pg, '#bar textarea'); await tap(cdp, *b); await pg.wait_for_timeout(300)
        await pg.keyboard.type(word, delay=15); await pg.wait_for_timeout(700)
        r = await at(pg, '#results .res'); await tap(cdp, *r); await pg.wait_for_timeout(700)
    await bar_pick('chair plain')
    st = await pg.evaluate("({ mode: tw.mode?.kind, chip: tw.handTool, chipShown: !document.getElementById('handTool').hidden, results: document.getElementById('results').hidden, settings: !!document.querySelector('.smodal') && getComputedStyle(document.querySelector('#settingsModal') || document.body).display !== 'none' && !document.querySelector('#settingsModal')?.hidden })")
    cancel = await pg.evaluate(f"({BOX})('#handTool button')")
    check(st['mode'] == 'place' and st['chipShown'] and 'lift your finger' in (st['chip'] or '') and st['results'] and cancel and min(cancel[2] - cancel[0], cancel[3] - cancel[1]) >= 40, f'PLACE {tag}: a tapped bar row arms the tool; the chip says what to do and has Cancel (>= 40 px)', {**st, 'cancel': cancel})
    check(not st['settings'], f'PLACE {tag}: the row\'s ghost click did not open Settings underneath', st)
    await shot('place-armed')
    n0 = await pg.evaluate(COUNT('object'))
    x0, y0, x1, y1 = W * 0.45, H * 0.5, W * 0.55, H * 0.56
    await drag(cdp, [(x0, y0)], [(x1, y1)], steps=8)
    await pg.wait_for_timeout(900)
    lift = await pg.evaluate(f"tw.groundAt({x1}, {y1})")
    obj = await pg.evaluate("(() => { const o = Object.values(tw.entities()).filter(e => e.kind === 'object').pop(); return o ? [o.x, o.z, o.cat] : null; })()")
    near = obj and lift and math.hypot(obj[0] - lift[0], obj[1] - lift[1]) < 3.5
    check(await pg.evaluate(COUNT('object')) == n0 + 1 and near and await pg.evaluate("!tw.mode && document.getElementById('handTool').hidden"), f'PLACE {tag}: down, moved and lifted on the map, the chair is put down where the finger lifted; the tool ends', {'obj': obj, 'lift': lift})
    await bar_pick('chair plain')
    cb = await at(pg, '#handTool button'); await tap(cdp, *cb); await pg.wait_for_timeout(500)
    check(await pg.evaluate("!tw.mode && document.getElementById('handTool').hidden") and await pg.evaluate(COUNT('object')) == n0 + 1, f'PLACE {tag}: Cancel ends the tool, nothing is placed')

    # ================= PLACE: the Pawns tray =================
    await tap(cdp, *(await at(pg, '#launchers .launcher:nth-child(1)'))); await pg.wait_for_timeout(800)
    for _ in range(5):
        if await pg.evaluate("tw.mode?.kind"): break
        t = await at(pg, '#pawnsTray .btile:not(.newp)')
        if not t: break
        await tap(cdp, *t); await pg.wait_for_timeout(900)
    pm = await pg.evaluate("({ mode: tw.mode?.kind, pawn: !!tw.mode?.pawn, open: tw.pawns.isOpen, chip: tw.handTool })")
    t0 = await pg.evaluate(COUNT('token'))
    await tap(cdp, W * 0.5, H * 0.55); await pg.wait_for_timeout(1200)
    check(pm['mode'] == 'place' and pm['pawn'] and not pm['open'] and await pg.evaluate(COUNT('token')) == t0 + 1, f'PLACE {tag}: a figure tile in Pawns arms "place a pawn", the tray gets out of the way, a tap puts the pawn down', pm)
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')

    # ================= PLACE: Build, a room =================
    await pg.evaluate(VIEW); await pg.wait_for_timeout(300)
    await tap(cdp, *(await at(pg, '#launchers .launcher:nth-child(2)'))); await pg.wait_for_timeout(700)
    await tap(cdp, *(await at(pg, '#buildMenu .btile[data-id^="g:fantasy"]'))); await pg.wait_for_timeout(700)
    await tap(cdp, *(await at(pg, '#buildMenu .btile[data-id="t:TAV"]'))); await pg.wait_for_timeout(700)
    mid = await pg.evaluate("({ mode: tw.mode?.kind, open: tw.build.isOpen })")
    await tap(cdp, *(await at(pg, '#buildMenu .btile[data-id="r:TAV:common"]'))); await pg.wait_for_timeout(900)
    bm = await pg.evaluate("({ mode: tw.mode?.kind, type: tw.mode?.type, open: tw.build.isOpen, chip: tw.handTool })")
    check(mid['mode'] == 'building' and mid['open'] and bm['mode'] == 'room' and not bm['open'] and 'draw the room' in (bm['chip'] or ''), f'PLACE {tag}: Build ▸ Fantasy ▸ Tavern keeps the tray (its rooms); ▸ Common room arms the room tool and the tray gets out of the way', {'type': mid, 'room': bm})
    await pg.evaluate("tw.library?.hide?.()")  # (the room's library picture-in-picture: not under test here)
    r0 = await pg.evaluate(COUNT('room'))
    a0, a1 = (W * 0.3, H * 0.5), (W * 0.7, H * 0.68)
    await touch(cdp, 'touchStart', [a0]); await touch(cdp, 'touchMove', [(a0[0] + 40, a0[1] + 30)]); await asyncio.sleep(0.05)
    await touch(cdp, 'touchStart', [(a0[0] + 40, a0[1] + 30), (a0[0] + 160, a0[1] + 30)]); await asyncio.sleep(0.05)
    await touch(cdp, 'touchMove', [(a0[0] + 50, a0[1] + 30), (a0[0] + 170, a0[1] + 30)]); await touch(cdp, 'touchEnd', []); await pg.wait_for_timeout(1500)
    check(await pg.evaluate(COUNT('room')) == r0 and await pg.evaluate("tw.mode?.kind") == 'room', f'PLACE {tag}: a second finger during a room stroke drops the stroke (no room), the tool stays')
    await pg.evaluate(VIEW); await pg.wait_for_timeout(300)
    await drag(cdp, [a0], [a1], steps=10); await pg.wait_for_timeout(2500)
    check(await pg.evaluate(COUNT('room')) == r0 + 1, f'PLACE {tag}: a finger drag draws the room', await pg.evaluate(COUNT('room')) - r0)
    await shot('room-drawn')
    cb = await at(pg, '#handTool button'); await tap(cdp, *cb); await pg.wait_for_timeout(400)
    check(await pg.evaluate("!tw.mode && document.getElementById('handTool').hidden"), f'PLACE {tag}: Cancel ends the Build tool')

    # ================= CAMERA =================
    await pg.evaluate("tw.library?.hide?.()"); await pg.evaluate(VIEW); await pg.wait_for_timeout(400)
    check(await pg.evaluate("document.getElementById('pipFrame').hidden"), f'CAMERA {tag}: (fixture) no picture-in-picture over the map')
    cx, cy, R = W / 2, H / 2 + (40 if H > W else 20), 70
    c0 = await pg.evaluate(CAM)
    probe = await pg.evaluate(f"(() => {{ const p = tw.groundAt({cx + R}, {cy}); return [p[0], p[1]]; }})()")  # the ground under the right-hand finger
    await touch(cdp, 'touchStart', [(cx - R, cy), (cx + R, cy)])
    for s in range(1, 15):
        a = math.radians(40 * s / 14); await touch(cdp, 'touchMove', [(cx - R * math.cos(a), cy - R * math.sin(a)), (cx + R * math.cos(a), cy + R * math.sin(a))]); await asyncio.sleep(0.016)
    sp = await pg.evaluate(f"tw.screenOf({probe[0]}, {probe[1]}, tw.main, 0)")
    await touch(cdp, 'touchEnd', []); await pg.wait_for_timeout(200)
    c1 = await pg.evaluate(CAM)
    turned = math.degrees(math.atan2(sp['y'] - cy, sp['x'] - cx))  # where that ground point is now, seen from the fingers' middle (the finger is at +40°)
    check(abs(abs(c1['yaw'] - c0['yaw']) - 30) < 6 and abs(c1['pitch'] - c0['pitch']) < 1 and abs(c1['dist'] - c0['dist']) / c0['dist'] < 0.05 and 20 < turned < 50, f'CAMERA {tag}: a twist of 40° turns the view about 30° (past a 10° deadband), the map turning with the fingers; no tilt, no zoom', {'yaw': [round(c0['yaw'], 1), round(c1['yaw'], 1)], 'ground point at': round(turned, 1)})
    await drag(cdp, [(cx - 60, cy), (cx + 60, cy)], [(cx - 60, cy - 100), (cx + 60, cy - 100)], steps=12); await pg.wait_for_timeout(200)
    c2 = await pg.evaluate(CAM)
    await drag(cdp, [(cx - 60, cy - 60), (cx + 60, cy - 60)], [(cx - 60, cy), (cx + 60, cy)], steps=12); await pg.wait_for_timeout(200)
    c3 = await pg.evaluate(CAM)
    check(c2['pitch'] < c1['pitch'] - 20 and abs(c2['yaw'] - c1['yaw']) < 1 and abs(c2['dist'] - c1['dist']) < 0.5 and c3['pitch'] > c2['pitch'] + 10 and await pg.evaluate("tw.twoFinger.lock") == 'tilt', f'CAMERA {tag}: two fingers up tilt the view (pitch lower), down tilt it back; no turn, no zoom', {'pitch': [round(c1['pitch'], 1), round(c2['pitch'], 1), round(c3['pitch'], 1)]})
    await drag(cdp, [(cx - 40, cy), (cx + 40, cy)], [(cx - 120, cy), (cx + 120, cy)], steps=12); await pg.wait_for_timeout(200)
    c4 = await pg.evaluate(CAM)
    check(c4['dist'] < c3['dist'] * 0.6 and abs(c4['yaw'] - c3['yaw']) < 1 and abs(c4['pitch'] - c3['pitch']) < 1, f'CAMERA {tag}: a spread zooms in, without turning or tilting', {'dist': [round(c3['dist'], 1), round(c4['dist'], 1)]})
    await drag(cdp, [(cx, cy)], [(cx + 80, cy + 60)], steps=10); await pg.wait_for_timeout(200)
    c5 = await pg.evaluate(CAM)
    await touch(cdp, 'touchStart', [(cx - 50, cy), (cx + 50, cy)]); await touch(cdp, 'touchMove', [(cx - 70, cy), (cx + 70, cy)])
    await touch(cdp, 'touchMove', [(cx - 70, cy)]); await asyncio.sleep(0.03)  # (CDP: a point missing from the list has lifted: finger 1 is up)
    for s in range(1, 8): await touch(cdp, 'touchMove', [(cx - 70 + s * 10, cy + s * 6)]); await asyncio.sleep(0.016)
    await touch(cdp, 'touchEnd', []); await pg.wait_for_timeout(200)
    c6 = await pg.evaluate(CAM)
    check(math.hypot(c5['fx'] - c4['fx'], c5['fz'] - c4['fz']) > 1 and math.hypot(c6['fx'] - c5['fx'], c6['fz'] - c5['fz']) > 0.5 and not errs, f'CAMERA {tag}: one finger pans; one of two fingers lifted, the other pans on; no page errors', errs[:3])
    # a finger on a room's label: a drag pans (the room stays); with a second finger on the map, a spread zooms
    await pg.evaluate(VIEW); await pg.wait_for_timeout(500)
    lab = await pg.evaluate("(() => { const l = [...document.querySelectorAll('#labels .rlabel')].find(l => { const r = l.getBoundingClientRect(); return r.width && r.top > 140 && r.bottom < innerHeight - 140 && r.left > 60 && r.right < innerWidth - 60; }); if (!l) return null; const r = l.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
    rooms0 = await pg.evaluate("JSON.stringify(Object.values(tw.entities()).filter(e => e.kind === 'room').map(r => [r.recipe?.x, r.recipe?.z]))")
    if lab:
        k0 = await pg.evaluate(CAM)
        await drag(cdp, [tuple(lab)], [(lab[0] + 60, lab[1] + 50)], steps=10); await pg.wait_for_timeout(300)
        k1 = await pg.evaluate(CAM)
        await drag(cdp, [tuple(lab), (lab[0] + 90, lab[1] + 60)], [(lab[0] - 30, lab[1] - 20), (lab[0] + 170, lab[1] + 110)], steps=12); await pg.wait_for_timeout(300)
        k2 = await pg.evaluate(CAM)
        rooms1 = await pg.evaluate("JSON.stringify(Object.values(tw.entities()).filter(e => e.kind === 'room').map(r => [r.recipe?.x, r.recipe?.z]))")
    check(lab and math.hypot(k1['fx'] - k0['fx'], k1['fz'] - k0['fz']) > 1 and rooms1 == rooms0 and k2['dist'] < k1['dist'] * 0.8 and not errs, f'CAMERA {tag}: a finger on a room\'s label pans (the room stays put); with a second finger on the map a spread zooms', lab and {'pan': round(math.hypot(k1['fx'] - k0['fx'], k1['fz'] - k0['fz']), 1), 'dist': [round(k1['dist'], 1), round(k2['dist'], 1)], 'rooms moved': rooms1 != rooms0})
    await br.close()

async def desktop(p, page):
    print('--- a computer, 1280 x 800')
    br = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
    ctx = await br.new_context(viewport={'width': 1280, 'height': 800}); pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    await pg.goto(page); await pg.wait_for_selector('#newCampaign input[name=gm]', timeout=30000)
    await pg.fill('#newCampaign input[name=gm]', 'Harry'); await pg.click('#newCampaign button')
    await wait(pg, 'window.tw && tw.ready && tw.ready()', 60000)
    await pg.evaluate("tw.batch([{type:'token.create', args:{id:'tok_hand00002', name:'Desk', x:22.5, z:22.5}}])"); await wait(pg, "tw.entities()['tok_hand00002']", 10000)
    await pg.evaluate("(() => { const g = tw.main.grab; g.focus.set(22.5, 0, 22.5); g.yaw = 0; g.pitch = 55; g.dist = 70; g.update(); tw.main.rule = 'free'; })()"); await pg.wait_for_timeout(700)
    s = await pg.evaluate("(() => { const e = tw.entities()['tok_hand00002']; return tw.screenOf(e.x, e.z, tw.main, 2); })()")
    await pg.mouse.click(s['x'], s['y']); await pg.wait_for_timeout(700)
    d = await pg.evaluate("({ hand: document.documentElement.classList.contains('tw-hand') || !!window.TW_HAND, chip: !!document.getElementById('handTool'), banner: !!document.getElementById('phoneBanner'), ring: !document.getElementById('ring').hidden, sel: [...tw.sel], ids: tw.ringNodes().map(n => n.id), full: !!tw.ringSettings().fullClock, crumbs: !document.getElementById('crumbs').hidden && getComputedStyle(document.getElementById('crumbs')).display !== 'none', other: getComputedStyle(document.getElementById('otherGames')).display !== 'none' })")
    check(not d['hand'] and not d['chip'] and not d['banner'] and d['ring'] and d['sel'] == ['tok_hand00002'] and not errs, 'DESK a computer: no phone layout, no chip, no banner; a click on a pawn brings its ring as before', d)
    await pg.evaluate("tw.clearSelection(); tw.sync.submit('area.create', { id: 'area_pipdesk001', name: 'Desk Road' })"); await wait(pg, "tw.sync.campaign.areas.length === 2", 8000, 'second area')
    a0 = await pg.evaluate("tw.area()")
    await pg.evaluate("tw.openPip('area_pipdesk001')"); await pg.wait_for_timeout(1200)
    po = await pg.evaluate("({ allowed: tw.pipAllowed(), pip: tw.pip?.area || null, frame: !document.getElementById('pipFrame').hidden })")
    await pg.evaluate("tw.swapPip()"); await pg.wait_for_timeout(1200)
    ps = await pg.evaluate("({ main: tw.area(), pip: tw.pip?.area || null })")
    await pg.evaluate("tw.closePip()"); await pg.evaluate(f"tw.setMain('{a0}')"); await pg.wait_for_timeout(600)
    check(po['allowed'] and po['pip'] == 'area_pipdesk001' and po['frame'] and ps['main'] == 'area_pipdesk001' and ps['pip'] == a0, 'DESK a computer: picture-in-picture opens and swaps as before', {'open': po, 'swapped': ps})
    check(not any(i.startswith('hand.') for i in d['ids']) and not d['full'] and d['crumbs'] and d['other'], 'DESK a computer: no Move or Delete on the ring, no full clock; the crumbs and Other games as before', d)
    await br.close()

async def tweaks(p, page, W, H):
    tag = 'portrait' if H > W else 'landscape'
    print(f'--- tweaks, {tag} {W} x {H}')
    br = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
    ctx = await br.new_context(viewport={'width': W, 'height': H}, is_mobile=True, has_touch=True, device_scale_factor=2, reduced_motion='reduce')
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    await pg.goto(page + '&phone=0'); await pg.wait_for_selector('#newCampaign input[name=gm]', timeout=30000)
    await pg.fill('#newCampaign input[name=gm]', 'Harry')
    nm = await pg.query_selector('#newCampaign input[name=name]')
    if nm: await nm.fill(f"TEST phone tweaks {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
    await pg.click('#newCampaign button')
    await wait(pg, 'window.tw && tw.ready && tw.ready()', 60000)
    await pg.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
    await pg.evaluate("document.querySelector('.lmcard .lm-x')?.click()")
    cdp = await ctx.new_cdp_session(pg)
    shot = lambda name: pg.screenshot(path=os.path.join(SHOTS, f'tweaks-{tag}-{name}.jpg'), type='jpeg', quality=70) if A.shots else asyncio.sleep(0)
    await pg.evaluate("tw.spawnRoom('common', 0, 0, 6, 4, 4242)"); await wait(pg, "Object.values(tw.entities()).filter(e => e.kind === 'object').length > 4", 15000, 'room things')
    await pg.evaluate("tw.batch([{type:'token.create', args:{id:'tok_tweak0001', name:'Brakka', x:12.5, z:42.5}}])"); await wait(pg, "tw.entities()['tok_tweak0001'] && tw.sync.pendingCount() === 0", 10000, 'pawn')
    await pg.wait_for_timeout(1500)
    # ---- CHROME ----
    shown = await pg.evaluate(VISIBLE_CHROME)
    await pg.evaluate("tw.select(['tok_tweak0001'])"); await pg.wait_for_timeout(500)
    crumbs = await pg.evaluate("(() => { const e = document.getElementById('crumbs'); return !e.hidden && getComputedStyle(e).display !== 'none'; })()")
    await pg.evaluate("tw.clearSelection()")
    sett = await pg.evaluate("(() => { tw.settings.open(); const b = document.querySelector('.smodal .other-games'); const ok = !!b && b.getBoundingClientRect().width > 0; tw.settings.close(); return ok; })()")
    check(not any(v for k, v in shown.items() if k not in ('hudOk', 'flat')) and shown['hudOk'] and shown['flat'] and not crumbs and sett and not errs, f'CHROME {tag}: no Other games, area pills, crumbs, connection line, area tags or one-storey meter; Settings has Other games / New game', {**shown, 'crumbs': crumbs, 'settings other games': sett, 'errs': errs[:2]})
    await shot('table')
    # ---- RING: a thing ----
    thing = await pg.evaluate("(() => { const o = Object.values(tw.entities()).filter(e => e.kind === 'object' && !e.locked && !['tile', 'kit', 'wall', 'surface'].includes(e.place) && !e.parent).sort((a, b) => (a.x - 15) ** 2 + (a.z - 10) ** 2 - ((b.x - 15) ** 2 + (b.z - 10) ** 2))[0]; return o && { id: o.id, x: o.x, z: o.z, name: o.name }; })()")
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({thing['x']}, 0, {thing['z']}); g.yaw = 0; g.pitch = 55; g.dist = 40; g.update(); tw.main.rule = 'free'; tw.select(['{thing['id']}']); }})()"); await pg.wait_for_timeout(1200)
    rg = await pg.evaluate(RING_INFO)
    inside0 = await pg.evaluate(INSIDE)
    check('hand.move' in rg['ids'] and 'hand.delete' in rg['ids'] and rg['ids'][0] == 'hand.move' and rg['ids'][-2] == 'hand.delete' and rg['full'] and rg['bin'] and inside0, f"RING {tag}: a thing's ring has Move first and Delete last on the main row (the painted bin), the full clock, whole on screen under the top chrome", {**rg, 'thing': thing['name'], 'inside': inside0})
    await shot('ring')
    await pg.evaluate("tw.ringOpen('expanded')"); await pg.wait_for_timeout(900)
    op = await pg.evaluate("({ state: tw.ringState(), grown: tw.ringSlid()?.grown || null, warn: tw.ringWarnings(), n: tw.ringNodes().length })")
    inside1 = await pg.evaluate(INSIDE)
    # (grown only when the row is longer than the whole clock: on dev's house ring, Harry's, 11 buttons need x1.01; a computer's ring grows x1.11 for a thing to keep out of 3-6)
    check(op['state'] == 'expanded' and (not op['grown'] or op['grown'] <= 1.05) and 'button overlap' not in op['warn'] and inside1, f'RING {tag}: open, the row runs on round the full clock: the oval grown at most a few percent (only past a whole lap), no overlap, whole on screen', {**op, 'inside': inside1})
    await shot('ring-open')
    await pg.evaluate("tw.ringOpen('closed')"); await pg.wait_for_timeout(600)
    db = await at(pg, '#ring .rbtn[data-id="hand.delete"]'); await tap(cdp, *db); await pg.wait_for_timeout(1200)
    gone = await pg.evaluate(f"!tw.entities()['{thing['id']}']")
    await pg.evaluate("tw.undo()"); await pg.wait_for_timeout(1200)
    back = await pg.evaluate(f"!!tw.entities()['{thing['id']}']")
    check(gone and back, f'RING {tag}: a tap on Delete deletes the thing; one undo brings it back', {'gone': gone, 'back': back})
    # ---- MOVE ----
    POS = "(() => { const e = tw.entities()['tok_tweak0001']; return [e.x, e.z]; })()"
    await pg.evaluate("(() => { const g = tw.main.grab; g.focus.set(12.5, 0, 42.5); g.yaw = 0; g.pitch = 55; g.dist = 50; g.update(); tw.main.rule = 'free'; tw.select(['tok_tweak0001']); })()"); await pg.wait_for_timeout(1200)
    p0 = await pg.evaluate(POS)
    mv = await at(pg, '#ring .rbtn[data-id="hand.move"]')
    await tap(cdp, *mv); await pg.wait_for_timeout(600)
    still = await pg.evaluate(POS)
    mv = await at(pg, '#ring .rbtn[data-id="hand.move"]')
    g0 = await pg.evaluate(f"tw.groundAt({mv[0]}, {mv[1]}, 0)")
    await touch(cdp, 'touchStart', [tuple(mv)])
    for k in range(1, 13): await touch(cdp, 'touchMove', [(mv[0] + 5 * k, mv[1] + 6 * k)]); await asyncio.sleep(0.02)
    await pg.wait_for_timeout(100)
    mid = await pg.evaluate(MOVE_MID)
    g1 = await pg.evaluate(f"tw.groundAt({mv[0] + 60}, {mv[1] + 72}, 0)")
    await touch(cdp, 'touchEnd', []); await pg.wait_for_timeout(1200)
    p1 = await pg.evaluate(POS)
    want = [p0[0] + g1[0] - g0[0], p0[1] + g1[1] - g0[1]]
    near_hand = math.hypot(mid['handle'][0] - mv[0] - 60, mid['handle'][1] - mv[1] - 72) < 6
    check(still == p0 and mid['frozen'] and mid['live'] and mid['preview'] and near_hand and math.hypot(p1[0] - want[0], p1[1] - want[1]) < 3.5 and math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 3, f"MOVE {tag}: a tap on Move moves nothing; dragged, the ring freezes, the handle rides under the finger, the pawn follows the finger's travel and is put down there", {'p0': p0, 'still': still, 'p1': p1, 'want': [round(v, 1) for v in want], 'mid': mid, 'last': await pg.evaluate('tw.ringDragLast')})
    await pg.evaluate("tw.undo()"); await pg.wait_for_timeout(1000)
    pu = await pg.evaluate(POS)
    check(math.hypot(pu[0] - p0[0], pu[1] - p0[1]) < 0.01, f'MOVE {tag}: one undo puts it back', {'after undo': pu})
    await pg.evaluate("tw.select(['tok_tweak0001'])"); await pg.wait_for_timeout(600)
    s0 = await pg.evaluate("(() => { const e = tw.entities()['tok_tweak0001']; return tw.screenOf(e.x, e.z, tw.main, 1); })()")
    c0 = await pg.evaluate(CAM)
    await drag(cdp, [(s0['x'], s0['y'])], [(s0['x'] - 50, s0['y'] + 40)], steps=10); await pg.wait_for_timeout(1200)
    p2 = await pg.evaluate(POS); c2 = await pg.evaluate(CAM)
    check(math.hypot(p2[0] - p0[0], p2[1] - p0[1]) > 2 and math.hypot(c2['fx'] - c0['fx'], c2['fz'] - c0['fz']) < 0.3, f'MOVE {tag}: one finger on the SELECTED pawn drags it (the camera stays)', {'p0': p0, 'p2': p2})
    await shot('moved')
    # ---- PIP: none on a phone (Harry 2026-10-24: "we can't really afford the real estate for picture in picture") ----
    await pg.evaluate("tw.sync.submit('area.create', { id: 'area_pipoff0001', name: 'Cellar Road' })"); await wait(pg, "tw.sync.campaign.areas.length === 2", 8000, 'second area')
    home = await pg.evaluate("tw.area()")
    direct = await pg.evaluate("({ allowed: tw.pipAllowed(), ret: tw.openPip('area_pipoff0001'), local: tw.openLocalPip('lib:test'), pip: !!tw.pip, frame: !document.getElementById('pipFrame').hidden, views: tw.views.length })")
    b = await at(pg, '#bar textarea'); await tap(cdp, *b); await pg.wait_for_timeout(300)
    await pg.keyboard.type('picture in picture', delay=10); await pg.wait_for_timeout(600)
    pipRows = await pg.evaluate("[...document.querySelectorAll('#results .res')].map(r => r.innerText.replace(/\\s+/g, ' ')).filter(t => /picture-in-picture/i.test(t))")
    await pg.fill('#bar textarea', 'Cellar Road'); await pg.wait_for_timeout(600)
    alts = await pg.evaluate("document.querySelectorAll('#results [data-alt]').length")
    placeRow = await pg.evaluate("[...document.querySelectorAll('#results .res')].some(r => /Cellar Road/.test(r.innerText))")
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    await pg.evaluate("tw.pawns.followRow({ id: 'tok_pipoff0002', name: 'Wanderer', area: 'area_pipoff0001', owner: null }, { pip: true })"); await pg.wait_for_timeout(1500)
    fol = await pg.evaluate("({ area: tw.area(), pip: !!tw.pip, last: tw.pawns.lastFollow || null, frame: !document.getElementById('pipFrame').hidden })")
    await pg.evaluate(f"tw.setMain('{home}')"); await wait(pg, f"tw.area() === '{home}' && tw.ready()", 10000, 'back home')
    await tap(cdp, *(await at(pg, '#launchers .launcher:nth-child(2)'))); await pg.wait_for_timeout(700)
    await tap(cdp, *(await at(pg, '#buildMenu .btile[data-id^="g:fantasy"]'))); await pg.wait_for_timeout(600)
    await tap(cdp, *(await at(pg, '#buildMenu .btile[data-id="t:TAV"]'))); await pg.wait_for_timeout(600)
    await tap(cdp, *(await at(pg, '#buildMenu .btile[data-id="r:TAV:common"]'))); await pg.wait_for_timeout(1200)
    lib = await pg.evaluate("({ mode: tw.mode?.kind, pip: !!tw.pip, frame: !document.getElementById('pipFrame').hidden, shown: !!tw.library?.shown?.() })")
    await pg.evaluate("tw.modes.cancel?.()"); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    check(not direct['allowed'] and direct['ret'] is False and direct['local'] is False and not direct['pip'] and not direct['frame'] and direct['views'] == 1, f'PIP {tag}: no picture-in-picture can open (openPip and the library\'s openLocalPip refuse)', direct)
    check(not pipRows and alts == 0 and placeRow, f'PIP {tag}: the bar offers no PiP command and no "PiP" beside an area', {'pip rows': pipRows, 'alts': alts, 'area row': placeRow})
    check(fol['area'] == 'area_pipoff0001' and not fol['pip'] and not fol['frame'], f'PIP {tag}: following a pawn in another area goes there in the main view (no PiP), even when asked for the small window', fol)
    check(lib['mode'] == 'room' and not lib['pip'] and not lib['frame'] and not lib['shown'] and not errs, f'PIP {tag}: Build ▸ a room arms the tool without the library\'s picture-in-picture', {**lib, 'errs': errs[:2]})
    # ---- PLAYER ----
    tok = await pg.evaluate("tw.createSeat({ kind: 'human', role: 'player', name: 'Pat', color: '#33aa77', placeholder: false })")
    seat = await pg.evaluate("tw.sync.campaign.seats.find(s => s.name === 'Pat').id")
    await pg.evaluate(f"tw.batch([{{type:'token.create', args:{{id:'tok_tweakpat1', name:'Pat', x:22.5, z:12.5, owner:'{seat}'}}}}])"); await pg.wait_for_timeout(1000)
    link = await pg.evaluate('t => tw.inviteLink(t)', tok)
    pctx = await br.new_context(viewport={'width': W, 'height': H}, is_mobile=True, has_touch=True, device_scale_factor=2, reduced_motion='reduce')
    await pctx.add_init_script("try { const p = JSON.parse(localStorage.getItem('tw.prefs') || '{}'); p.arrivalCentre = true; localStorage.setItem('tw.prefs', JSON.stringify(p)); } catch (e) {}")  # (as a player gets it: the camera goes to my pawn)
    pl = await pctx.new_page(); perrs = []; pl.on('pageerror', lambda e: perrs.append(str(e)[:200]))
    await pl.goto(link.replace('#', '&phone=0#'))
    await wait(pl, "window.tw && tw.ready && tw.ready() && !!tw.entities()['tok_tweakpat1']", 60000, 'player')
    await wait(pl, "!!tw.arrival?.centred", 10000, 'arrival'); await pl.wait_for_timeout(800)
    pc = await pl.evaluate(CAM); pcdp = await pctx.new_cdp_session(pl)
    sp = await pl.evaluate("(() => { const e = tw.entities()['tok_tweakpat1']; return tw.screenOf(e.x, e.z, tw.main, 2); })()")
    await tap(pcdp, sp['x'], sp['y']); await pl.wait_for_timeout(1200)
    mine = await pl.evaluate("({ sel: [...tw.sel], ids: tw.ringNodes().map(n => n.id) })")
    pinside = await pl.evaluate(INSIDE)
    if A.shots: await pl.screenshot(path=os.path.join(SHOTS, f'tweaks-{tag}-player-ring.jpg'), type='jpeg', quality=70)
    await pl.evaluate("tw.select(['tok_tweak0001'])"); await pl.wait_for_timeout(800)
    theirs = await pl.evaluate("tw.ringNodes().map(n => n.id)"); theirs_in = await pl.evaluate(INSIDE)
    check(abs(pc['fx'] - 22.5) < 1.5 and abs(pc['fz'] - 12.5) < 1.5 and mine['sel'] == ['tok_tweakpat1'] and 'hand.move' in mine['ids'] and 'hand.delete' not in mine['ids'] and pinside and theirs and theirs_in and 'hand.move' not in theirs and 'hand.delete' not in theirs, f"PLAYER {tag}: the link opens on my pawn; a tap brings its ring, whole on screen, with Move and no Delete; the GM's pawn: neither", {'cam': [round(pc['fx'], 1), round(pc['fz'], 1)], 'mine': mine, 'inside': pinside, 'theirs': theirs})
    if A.shots: await pl.screenshot(path=os.path.join(SHOTS, f'tweaks-{tag}-player-theirs.jpg'), type='jpeg', quality=70)
    await pl.evaluate("tw.clearSelection()"); await pl.wait_for_timeout(300)
    b = await at(pl, '#bar textarea'); await tap(pcdp, *b); await pl.wait_for_timeout(600)
    rows = await pl.evaluate("[...document.querySelectorAll('#results .res')].slice(0, 2).map(r => r.innerText.replace(/\\s+/g, ' ').trim())")
    if A.shots: await pl.screenshot(path=os.path.join(SHOTS, f'tweaks-{tag}-player-bar.jpg'), type='jpeg', quality=70)
    r = await at(pl, '#results .res'); await tap(pcdp, *r)
    rolled = await wait(pl, "(tw.sync.view(tw.area())?.chat || []).some(c => c.roll && c.roll.expr === 'd20')", 8000, 'roll')
    check(rows and rows[0].lower().startswith('roll d20') and len(rows) > 1 and rows[1].startswith('Say') and rolled and not perrs, f'PLAYER {tag}: the empty bar offers Roll d20 and Say…; one tap on Roll d20 rolls it', {'rows': rows, 'errs': perrs[:2]})
    await pctx.close(); await br.close()

VISIBLE_CHROME = """(() => { const vis = (sel) => { const e = document.querySelector(sel); if (!e || e.hidden) return false; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  return { other: vis('#otherGames'), area: vis('#areaState'), hud: vis('#hud'), hudOk: document.getElementById('hud').classList.contains('ok'), where: [...document.querySelectorAll('.av .where')].some(e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none'), meter: vis('#levelMeter'), flat: document.getElementById('levelMeter').classList.contains('flat') }; })()"""
TOPQ = "(() => { let b = 0; for (const id of ['bar', 'launchers', 'roster']) { const r = document.getElementById(id).getBoundingClientRect(); if (r.height && r.top < innerHeight / 3) b = Math.max(b, r.bottom); } return b; })()"
INSIDE = f"(() => {{ const top = {TOPQ}, c = document.getElementById('chat').getBoundingClientRect(), foot = c.width > innerWidth * 0.6 && c.top > innerHeight / 2 ? c.top : innerHeight; const N = tw.ringNodes(); return N.length > 0 && N.every(n => n.x - n.size / 2 >= -1 && n.x + n.size / 2 <= innerWidth + 1 && n.y - n.size / 2 >= top - 1 && n.y + n.size / 2 <= foot + 1); }})()"  # (whole on screen, under the top chrome and above a chat line across the bottom)
RING_INFO = """({ ids: tw.ringNodes().map(n => n.id), full: !!tw.ringSettings().fullClock, grown: tw.ringSlid()?.grown || null, bin: !!document.querySelector('#ring .rbtn[data-id="hand.delete"] img.paint[src*="template.remove"]') || !document.querySelector('#ring .rbtn img.paint') })"""
MOVE_MID = """({ frozen: document.getElementById('ring').classList.contains('dragging'), live: tw.handMove.live(), handle: (() => { const r = document.querySelector('#ring .rbtn[data-id="hand.move"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })(), preview: !!tw.localDrags.get('tok_tweak0001') })"""

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    if A.shots: os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        await phone(p, page, 390, 844)
        await phone(p, page, 844, 390)
        await tweaks(p, page, 390, 844)
        await tweaks(p, page, 844, 390)
        await desktop(p, page)

try: asyncio.run(main())
finally: cleanup()
n = sum(1 for r in results if r[0])
print(f'handheld: {n}/{len(results)} checks passed')
sys.exit(0 if n == len(results) and results else 1)

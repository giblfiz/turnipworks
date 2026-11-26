#!/usr/bin/env python3
"""A pawn's size and a flying pawn (Harry 2026-11-06; docs/PAWNS.md "A pawn's size", "A flying pawn"). GM tab + player
tab, a local relay.

  RING     (2026-11-07) a pawn's ☰ has ONE Size button, the props' resize: the same picture (line and painted), a drag
           button; no Size ▸ list on the ring; ≤ 12 top-level. Dragged out one step it makes it large for both seats: the
           figure twice as big, the base 8 ft across (its 10-ft square's 80%)
  TRACK    (2026-11-07, Harry: "same design language as the object resize (same image, and drag in&out on track)") the
           resize track along the handle's ray, its stops the sizes (tiny ... gargantuan named, the one it has where it
           was grabbed); the dot and readout step to the nearest; the pawn is previewed at it; a release commits it
           (app.setSize: one undo, both seats); inward two steps from large is tiny; Escape and a bare click change
           nothing; a player drags her own pawn by TOUCH; a player's ☰ on the GM's pawn has no Size; the keyboard's
           chord tree keeps Space ▸ Size ▸ the list (Huge), with no drag button in it
  PROPCLEAR (2026-11-07, lane trackclear) a PROP high on the screen: its resize track's far end, ticks and labels clear
           of the command bar, area pills, crumbs, launchers and avatars (fails on f939b9b7); the mapping is softK(d/d0)
           as ever; low on the screen the track is as long as it always was
  BAR      "size huge", "make it tiny", "bigger", "15 ft"; undo goes back for both seats
  SQUARES  a huge pawn's 3 x 3 squares are taken: a group placed beside it keeps off them; a tiny pawn shares a square
  PICK     a click on the edge of a huge base selects it; the same point misses it once it is medium again
  FIT      a large pawn in a room: it fits in the middle, not over a wall; the bar / arrow move onto the wall is refused
           (it stays, and is told so); dragged at the wall it is held where it last had room; placed at the wall from
           the pawn tool: refused; a medium pawn goes where it always went; made huge beside a wall it steps inward
  FLY      a dragon raised to 20 ft wears its flying pose for both seats, a shadow on the floor under it; lowered, it
           stands again; undo; a figure with no flying pose stays standing, lifted, with the shadow
  --shots DIR   stills for Harry: a large and a huge pawn beside a medium one; the dragon on the ground and in the air;
                the Size button and its track mid-drag (pawn) beside a prop's resize mid-drag

  TW_GPU=1 python3 engine/test/browser_size.py --local [--shots DIR]
  ... TW_PORTS=a,b for other ports (default 18619,19219)
"""
import argparse, asyncio, json, math, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402  test writes go to a sandbox
tw_sandbox.pawn_snap('always')
tw_sandbox.remove_campaigns()
SOFT = os.environ.get('TW_GPU', '1') == '0'
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] if SOFT else ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
JOIN_MS = 240000 if SOFT else 90000
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots'); ap.add_argument('--only', default='')
A = ap.parse_args(); ONLY = set(x.strip().upper() for x in A.only.split(',') if x.strip())
def want(s): return not ONLY or s in ONLY
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:700] if detail != '' and not ok else ''}", flush=True)
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18619,19219').split(','))
def start_local():
    import socket
    for port in (RP, SP):
        with socket.socket() as sk:
            if sk.connect_ex(('127.0.0.1', port)) == 0: sys.exit(f'port {port} is in use (a stale test server?): stop it first, or TW_PORTS=a,b')
    data = tempfile.mkdtemp(prefix='tw-size-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=open(os.path.join(data, 'relay.log'), 'a'), stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'
async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=50); return True
    except Exception: print(f'    (timed out: {what or js[:110]})'); return False
LOOK = "(a) => { const g = tw.main.grab; g.focus.set(a[0], 0, a[1]); g.dist = a[2]; g.pitch = a[3] ?? 55; g.yaw = a[4] ?? 0; g.update(); }"
def E(id): return f"tw.entities()['{id}']"
def FIG(id): return f"tw.worldOf(tw.area()).figureOf('{id}')"
def BASE(id): return f"tw.pawnBase('{id}')"
OX, OZ = 82.5, 12.5   # open ground, east of the room
FIGHTER = 'hero-fighter-human-m'

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    if A.shots: os.makedirs(A.shots, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}, device_scale_factor=1)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
            await pg.goto(url); return pg
        async def settle(*pgs):
            for pg in pgs: await wait(pg, 'tw.sync.pendingCount() === 0', 15000, 'commands accepted')
            await pgs[0].wait_for_timeout(400)
        async def figs_in(pg, id, ms=30000): return await wait(pg, f"{FIG(id)}?.loaded === true", ms, f'figure {id}')
        NEST = '#ring .rbtn[data-nest][data-cmd="%s"]'
        async def sel(pg, id): await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.evaluate(f"tw.select('{id}')"); await pg.wait_for_timeout(150)
        async def open_menu(pg, id):
            if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
            await sel(pg, id); await wait(pg, "!!document.querySelector('#ring .rbtn[data-menu]')", 5000, 'ring'); await pg.evaluate("document.querySelector('#ring .rbtn[data-menu]').click()"); await pg.wait_for_timeout(350)
        async def bar(pg, text):
            if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
            await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=6); await pg.wait_for_timeout(300); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        async def shot(pg, name):
            if not A.shots: return
            await pg.keyboard.press('Escape'); await pg.evaluate("tw.select([])"); await pg.wait_for_timeout(900)
            await pg.screenshot(path=os.path.join(A.shots, name)); print(f'    (still: {name})')

        # the ring's Size handle (a pawn's ☰): grab it with the mouse; the drag's state; slide along the handle's ray
        DRAG = "(() => { const d = tw.ringDrag(); return d && { ...d, pitch: (() => { const t = d.track; if (!t) return null; const m = t.marks, a = m.find(x => x.label === 'medium') || m[0], b = m.find(x => x.v === a.v + 1) || t.ticks.find(x => x.v === a.v + 1); return b ? Math.hypot(b.at[0] - a.at[0], b.at[1] - a.at[1]) : null; })(), readout: document.querySelector('#ring .readout')?.innerText || '', trackEls: document.querySelectorAll('#ring .rtrack').length }; })()"
        HIT = """(() => { const g = document.querySelector('#ring .rtrack'); if (!g) return null; const pts = []; for (const el of g.querySelectorAll('line, circle, text')) { const r = el.getBoundingClientRect(); pts.push([r.left + r.width / 2, r.top + r.height / 2]); }
          let bad = 0; for (const [x, y] of pts) for (const el of document.elementsFromPoint(x, y)) if (el.closest?.('.rtrack') || el.classList?.contains('readout')) bad++; return { n: pts.length, bad, pe: getComputedStyle(g).pointerEvents }; })()"""
        GONE = "!document.querySelector('.rtrack') && !document.querySelector('.rtrack-out') && !document.querySelector('#ring .readout')"
        # a TOUCH drag on the Size button, outward by px along its ray (synthetic pointers, as browser_lift_hard.py's)
        TOUCH = """async ([px]) => { const el = document.querySelector('#ring [data-cmd="pawn.resize"]'), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, pid = 81;
          const ev = (t, xx, yy, tgt = window) => tgt.dispatchEvent(new PointerEvent(t, { pointerId: pid, pointerType: 'touch', isPrimary: true, clientX: xx, clientY: yy, buttons: t === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true }));
          ev('pointerdown', x, y, el); const d = tw.ringDrag(); if (!d) return null; const [ux, uy] = d.dir, t = d.track, a = t.marks.find(m => m.cls === 'start'), b = t.ticks.find(k => k.v === a.v + 1), pitch = Math.hypot(b.at[0] - a.at[0], b.at[1] - a.at[1]), go = pitch * 1.1;
          for (let i = 1; i <= 8; i++) { ev('pointermove', x + ux * go * i / 8, y + uy * go * i / 8); await new Promise(r => setTimeout(r, 25)); }
          ev('pointerup', x + ux * go, y + uy * go); await new Promise(r => setTimeout(r, 150)); return tw.ringDragLast; }"""
        dist = lambda a, b: ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
        BTN = "(() => { const e = document.querySelector('#ring .rbtn[data-cmd=\"pawn.resize\"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, left: r.left, right: r.right, under: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.rbtn')?.dataset.cmd || null }; })()"
        async def grab(pg, id):
            b = await frame_size(pg, id)
            await pg.mouse.move(b['x'], b['y']); await pg.mouse.down(); await pg.wait_for_timeout(80)
            if not await pg.evaluate('!!tw.ringDrag()'): print(f"    (no drag: {b})")
            return b
        async def frame_size(pg, id):
            # the ring is world-sized and may run off screen by design (docs/UI.md): back the camera off until the Size
            # button is on screen and nothing covers it (the command bar sits at the top)
            e = await pg.evaluate(E(id)); dd = 45; hy = (await pg.evaluate(f"{FIG(id)}?.height_ft || 6")) * 0.85
            for _ in range(7):
                await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({e['x']}, {hy + dd * 0.3}, {e['z']}); g.dist = {dd}; g.pitch = 55; g.yaw = 0; g.update(); }})()"); await pg.wait_for_timeout(250)
                await open_menu(pg, id); await wait(pg, f"!!{BTN}", 5000, 'Size button')
                await pg.wait_for_timeout(500)   # (the ☰ slide settles: the button is where it stays)
                b = await pg.evaluate(BTN)
                if b and b['under'] == 'pawn.resize' and b['top'] > 300 and b['left'] > 0: break   # (room above it for the track's outward stops, clear of the bar)
                dd *= 1.35
            return b
        async def slide(pg, b, u, to_px, from_px=0.0, steps=10):   # the pointer from from_px to to_px along u, from the grab point
            for i in range(1, steps + 1):
                d = from_px + (to_px - from_px) * i / steps
                await pg.mouse.move(b['x'] + u[0] * d, b['y'] + u[1] * d); await pg.wait_for_timeout(25)
            await pg.wait_for_timeout(120)

        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', f"TEST size {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw?.ready?.()', JOIN_MS), 'GM did not come up'
        await gm.evaluate("tw.dispatch('campaign.set', { defaults: { fogOfWar: false } })"); await settle(gm)
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        pl = await tab(invite)
        assert await wait(pl, 'window.tw?.ready?.()', JOIN_MS), 'player did not join'
        seat = await pl.evaluate('tw.me()')
        await gm.evaluate('tw.spawnRoom("common", 0, 0, 6, 5, 7711)')   # x 0..30, z 0..25
        await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000, 'room')
        for pg in (gm, pl): await pg.evaluate(f"({LOOK})([{OX}, {OZ}, 60])")

        # ---------------- RING ----------------
        F1, MI = 'tok_szfighter01', 'tok_szmira00001'
        await gm.evaluate('ops => tw.batch(ops)', [
            {'type': 'token.create', 'args': {'id': F1, 'name': 'Fighter', 'x': OX, 'z': OZ, 'fig': FIGHTER}},
            {'type': 'token.create', 'args': {'id': MI, 'name': 'Mira', 'x': OX + 20, 'z': OZ, 'owner': seat, 'fig': 'hero-wizard-elf-f'}}])
        await settle(gm); await figs_in(gm, F1); await wait(pl, f"!!{E(F1)}", 15000); await figs_in(pl, F1)
        m0 = await gm.evaluate(FIG(F1))
        if want('RING'):
            print('RING')
            await open_menu(gm, F1)
            top = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn.ex:not([data-nest])')].map(b => b.dataset.group || b.dataset.cmd)")
            check('pawn.resize' in top and 'pawn.size.' not in top and len(top) <= 12, 'the pawn\'s ☰ has the one Size drag button (no Size ▸ list), and still at most 12 top-level entries', top)
            pb = await gm.evaluate("(() => { const b = document.querySelector('#ring .rbtn.ex[data-cmd=\"pawn.resize\"]'); return b && { drag: b.classList.contains('drag'), svg: b.querySelector('svg')?.outerHTML || '', tip: b.dataset.tip }; })()")
            prop = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'object' && e.place !== 'tile' && !e.locked && !e.parent && e.dims && e.dims[1] > 1.5)?.id")
            await sel(gm, prop); await wait(gm, "!!document.querySelector('#ring .rbtn[data-cmd=\"edit.resize\"]')", 5000, 'prop resize')
            ob = await gm.evaluate("(() => { const b = document.querySelector('#ring .rbtn[data-cmd=\"edit.resize\"]'); return b && { drag: b.classList.contains('drag'), svg: b.querySelector('svg')?.outerHTML || '' }; })()")
            check(pb and ob and pb['drag'] and ob['drag'] and pb['svg'] and pb['svg'] == ob['svg'] and pb['tip'] == 'Size', 'it is a drag button with the props\' resize picture (the same line icon), named Size', [pb and {**pb, 'svg': pb['svg'][:60]}, ob and ob['svg'][:60]])
            # the painted set (the house ring names one): the same painted picture as the props' resize
            await gm.evaluate("(() => { const b = tw.ringSettings(); tw.ringSettingsOverride = () => ({ ...b, iconSet: 'charcoal' }); })()")
            await sel(gm, prop); await wait(gm, "!!document.querySelector('#ring .rbtn[data-cmd=\"edit.resize\"] img.paint')", 8000, 'painted prop resize')
            osrc = await gm.evaluate("document.querySelector('#ring .rbtn[data-cmd=\"edit.resize\"] img.paint')?.getAttribute('src') || ''")
            await open_menu(gm, F1); await wait(gm, "!!document.querySelector('#ring .rbtn[data-cmd=\"pawn.resize\"] img.paint')", 8000, 'painted pawn size')
            psrc = await gm.evaluate("document.querySelector('#ring .rbtn[data-cmd=\"pawn.resize\"] img.paint')?.getAttribute('src') || ''")
            check(osrc and psrc == osrc and 'edit.resize' in psrc, 'painted: the pawn\'s Size wears the props\' resize picture', [psrc, osrc])
                        # dragged out one step: large
            b = await grab(gm, F1); st = await gm.evaluate(DRAG)
            await slide(gm, b, st['dir'], st['pitch'] * 1.1); await gm.mouse.up(); await settle(gm)
            await wait(gm, f"{E(F1)}.size === 2 && {FIG(F1)}?.size === 2 && {FIG(F1)}?.loaded", 15000, 'large')
            m1 = await gm.evaluate(FIG(F1))
            check(m1['size'] == 2 and abs(m1['base_width_ft'] - 8) < 0.05, 'dragged out one step: large; the base is 8 ft across (80% of its 10-ft square)', m1['base_width_ft'])
            check(abs(m1['size_k'] - 2) < 1e-6 and abs(m1['height_ft'] / m0['height_ft'] - 2) < 0.05, 'large: the figure is drawn twice as big', [m0['height_ft'], m1['height_ft']])
            check(await wait(pl, f"{E(F1)}?.size === 2 && {FIG(F1)}?.size === 2 && Math.abs({FIG(F1)}?.base_width_ft - 8) < 0.05", 15000), 'the player\'s seat draws it large too')

        # ---------------- TRACK ----------------
        if want('TRACK'):
            print('TRACK')
            await gm.evaluate(f"tw.setSize([{E(F1)}], 1)"); await settle(gm); await wait(gm, f"!{E(F1)}.size", 6000)
            b = await grab(gm, F1); st = await gm.evaluate(DRAG); t = st['track'] or {}
            labs = {m['label']: m for m in t.get('marks', [])}
            check(st['trackEls'] == 1 and all(k in labs for k in ('tiny', 'medium', 'large', 'huge', 'gargantuan')), 'grabbed: the track along the handle\'s ray, its stops named tiny, medium, large, huge, gargantuan', list(labs))
            check('medium' in labs and dist(labs['medium']['at'], [b['x'], b['y']]) < 14 and labs['medium']['cls'] == 'start', 'the size it has (medium) is where the handle was grabbed', labs.get('medium'))
            cdist = lambda k: dist(labs[k]['at'], st['centre'])
            check(cdist('tiny') < cdist('medium') < cdist('large') < cdist('huge') < cdist('gargantuan') and abs((cdist('large') - cdist('medium')) - st['pitch']) < 1.5, 'smaller toward the centre, bigger outward, one step apart', {k: round(cdist(k)) for k in labs})
            ux, uy = st['dir']; perp = lambda pt: (pt[0] - st['centre'][0]) * (-uy) + (pt[1] - st['centre'][1]) * ux
            check(all(abs(perp(k['at'])) < 1.5 for k in t['ticks']), 'every stop is on the handle\'s ray (the props\' track: a line from the centre outward)')
            await slide(gm, b, st['dir'], st['pitch'] * 0.6)   # past half a step: large
            s1 = await gm.evaluate(DRAG)
            check(s1['k'] == 2 and s1['readout'].startswith('large') and dist(s1['track']['knob'], labs['large']['at']) < 1.5, 'past half a step out: the dot is on large, the readout says "large · 10 ft"', [s1['k'], s1['readout']])
            pv = await gm.evaluate(f"tw.localDrags.get('{F1}')?.scale ?? null")
            check(pv == 2, 'the pawn is previewed at that size while the handle is held', pv)
            await slide(gm, b, st['dir'], st['pitch'] * 2.1, st['pitch'] * 0.6)   # two steps: huge
            s2 = await gm.evaluate(DRAG)
            check(s2['k'] == 3 and s2['readout'].startswith('huge') and dist(s2['track']['knob'], labs['huge']['at']) < 1.5, 'two steps out: huge', [s2['k'], s2['readout']])
            hit = await gm.evaluate(HIT)
            check(hit and hit['bad'] == 0 and hit['pe'] == 'none', 'nothing in the track or its readout is hit-testable', hit)
            if A.shots: await gm.screenshot(path=os.path.join(A.shots, 'pawnsize-track-huge.png')); print('    (still: pawnsize-track-huge.png)')
            await gm.mouse.up(); await settle(gm, pl)
            last = await gm.evaluate('tw.ringDragLast')
            okg = await wait(gm, f"{E(F1)}.size === 3 && {FIG(F1)}?.size === 3", 8000, 'huge'); okp = await wait(pl, f"{E(F1)}?.size === 3", 8000, 'player huge')
            check(okg and okp and last['committed'] and last['value'] == 3, 'let go: it is huge, for both seats (the value the readout showed)', last)
            check(await gm.evaluate(f"!tw.localDrags.has('{F1}')") and await wait(gm, GONE, 1500), 'the preview and the track are gone after release')
            # inward from huge: one step is large, two medium, three tiny
            b = await grab(gm, F1); st = await gm.evaluate(DRAG)
            await slide(gm, b, st['dir'], -st['pitch'] * 3.2); s3 = await gm.evaluate(DRAG)
            check(s3['k'] == 0.5 and s3['readout'].startswith('tiny'), 'dragged inward three steps from huge: tiny', [s3['k'], s3['readout']])
            await gm.mouse.up(); await settle(gm, pl)
            check(await wait(gm, f"{E(F1)}.size === 0.5", 8000) and await wait(pl, f"{E(F1)}?.size === 0.5", 8000), 'let go: tiny, both seats')
            await gm.evaluate('tw.undo()'); await settle(gm, pl)
            check(await wait(gm, f"{E(F1)}.size === 3", 6000) and await wait(pl, f"{E(F1)}?.size === 3", 6000), 'one undo: huge again, both seats')
            # Escape cancels; a bare click changes nothing and says how
            b = await grab(gm, F1); st = await gm.evaluate(DRAG); await slide(gm, b, st['dir'], st['pitch'] * 1.2); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(80); await gm.mouse.up(); await settle(gm)
            last = await gm.evaluate('tw.ringDragLast')
            check(last['how'] == 'escape' and not last['committed'] and await gm.evaluate(f"{E(F1)}.size === 3 && !tw.localDrags.has('{F1}')"), 'Escape mid-drag: nothing changes', last)
            b = await grab(gm, F1); await gm.mouse.up(); await gm.wait_for_timeout(250)
            toast = await gm.evaluate("document.querySelector('#toast')?.textContent || ''")
            check(await gm.evaluate(f"{E(F1)}.size === 3") and 'Drag Size' in toast, 'a click without a drag changes nothing and says how', toast)
            # a player: her own pawn, by touch (synthetic touch pointers: the window listeners carry the drag)
            await gm.evaluate(f"tw.setSize([{E(MI)}], 1)"); await settle(gm); await wait(pl, f"!{E(MI)}?.size", 6000)
            await frame_size(pl, MI)
            tr = await pl.evaluate(TOUCH, [70])
            okt = await wait(gm, f"{E(MI)}?.size === 2", 8000, 'touch large')
            check(okt and tr and tr['committed'] and tr['value'] == 2, 'a player drags her own pawn\'s Size by touch: large, and the GM sees it', tr)
            await open_menu(pl, F1)
            ptop = await pl.evaluate("[...document.querySelectorAll('#ring .rbtn.ex:not([data-nest])')].map(b => b.dataset.group || b.dataset.cmd)")
            check('pawn.resize' not in ptop, 'a player\'s ☰ on the GM\'s pawn has no Size (not hers to touch)', ptop)
            # the keyboard: the chord tree keeps the list (and has no drag button)
            await sel(gm, F1); await gm.mouse.move(5, 400); await gm.keyboard.press('Space'); await gm.wait_for_timeout(150)
            cs = await gm.evaluate('tw.chordState()')
            gi = cs and cs['items'].index('▸pawn.size.') if cs and '▸pawn.size.' in cs['items'] else -1
            check(cs and gi >= 0 and 'pawn.resize' not in cs['items'], 'the keyboard\'s chord tree has Size ▸ (the list) and no drag button', cs)
            if gi >= 0:
                await gm.keyboard.press(cs['keys'][gi]); await gm.wait_for_timeout(150); c2 = await gm.evaluate('tw.chordState()')
                hk = c2 and c2['keys'][c2['items'].index('pawn.size.medium')] if c2 and 'pawn.size.medium' in c2['items'] else None
                if hk: await gm.keyboard.press(hk); await settle(gm)
                check(hk and await wait(gm, f"!{E(F1)}.size", 6000), 'Space ▸ Size ▸ Medium from the keyboard makes it medium', c2)

        # ---------------- PROPCLEAR ----------------
        # (2026-11-07, lane trackclear) a PROP's resize track stops short of the top-of-screen chrome too, as the pawn's
        # does: with the prop high on the screen its far end is not under the command bar, the area pills, the crumbs,
        # the launchers or the avatars; the mapping (k = softK(distance / grab distance)) is the same as ever; low on
        # the screen its track is as long as it always was
        if want('PROPCLEAR'):
            print('PROPCLEAR')
            CHROME = """(() => { const rs = []; for (const s of ['#bar', '#launchers', '#roster', '#underBar > *']) for (const el of document.querySelectorAll(s)) { if (el.hidden) continue; const r = el.getBoundingClientRect(); if (r.width && r.height && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden') rs.push({ id: el.id || el.className || s, l: r.left, t: r.top, r: r.right, b: r.bottom }); } return rs; })()"""
            RBTN = "(() => { const e = document.querySelector('#ring .rbtn[data-cmd=\"edit.resize\"]'); if (!e) return null; const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, under: document.elementFromPoint(x, y)?.closest('.rbtn')?.dataset.cmd || null }; })()"
            prop = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'object' && e.place !== 'tile' && !e.locked && !e.parent && e.dims && e.dims[1] > 1.5).sort((a, b) => (Math.abs(a.x - 15) + Math.abs(a.z - 12.5)) - (Math.abs(b.x - 15) + Math.abs(b.z - 12.5)))[0]")
            async def frame_prop(want_y):   # the camera moved until the prop's resize button sits near want_y, uncovered
                best = None
                for dz in [k * 1.5 for k in range(-16, 17)]:
                    await gm.evaluate(f"({LOOK})([{prop['x']}, {prop['z'] + dz}, 60, 55])"); await sel(gm, prop['id']); await gm.wait_for_timeout(250)
                    b = await gm.evaluate(RBTN)
                    if b and b['under'] == 'edit.resize' and (best is None or abs(b['y'] - want_y) < abs(best[1]['y'] - want_y)): best = (dz, b)
                await gm.evaluate(f"({LOOK})([{prop['x']}, {prop['z'] + best[0]}, 60, 55])"); await sel(gm, prop['id']); await gm.wait_for_timeout(500)
                return await gm.evaluate(RBTN)
            async def grab_prop(b):
                await gm.mouse.move(b['x'], b['y']); await gm.mouse.down(); await gm.wait_for_timeout(80); return await gm.evaluate(DRAG)
            def under_chrome(pts, rs):
                return [(p, r['id']) for p in pts for r in rs if r['l'] <= p[0] <= r['r'] and r['t'] <= p[1] <= r['b']]
            b = await frame_prop(170)
            st = await grab_prop(b); t = st and st['track'] or {}; rs = await gm.evaluate(CHROME)
            lbl = await gm.evaluate("[...document.querySelectorAll('#ring .rtrack text')].map(e => { const r = e.getBoundingClientRect(); return [[r.left, r.top], [r.right, r.bottom], [r.left + r.width / 2, r.top + r.height / 2]]; }).flat()")
            e0, e1 = (t.get('ends') or [[0, 0], [0, 0]])
            pts = [e1] + [k['at'] for k in t.get('ticks', [])] + [m['at'] for m in t.get('marks', [])] + lbl + [[e0[0] + (e1[0] - e0[0]) * i / 20, e0[1] + (e1[1] - e0[1]) * i / 20] for i in range(21)]
            bad = under_chrome(pts, rs)
            check(st and st['kind'] == 'size' and st['dir'][1] < -0.5 and b['y'] < 260, 'a prop high on the screen: its resize handle grabbed, the track heading up toward the bars', [b, st and st['dir']])
            check(st and not bad, 'its far end, ticks and labels are clear of the command bar, the area pills, the crumbs, the launchers and the avatars', {'end': e1, 'under': bad[:4], 'chrome': rs})
            check(st and t.get('max', 0) > 1.005, 'it still runs past 100% (there is room to grow)', t.get('max'))
            # the mapping is the props' own: k = softK(d / d0) at any point along the ray, rail or not
            if st:
                ux, uy = st['dir']; await slide(gm, b, st['dir'], 30, steps=6); s1 = await gm.evaluate(DRAG)
                d = (b['x'] + ux * 30 - st['centre'][0]) * ux + (b['y'] + uy * 30 - st['centre'][1]) * uy
                want_k = await gm.evaluate(f"tw.ringSoftK({d} / {st['d0']})")
                check(abs(s1['k'] - want_k) < 1e-3 and s1['readout'].startswith(f"{round(want_k * 100)}%"), 'the resize maps as before: 30 px out is softK(d / d0), and the readout says it', [s1['k'], want_k, s1['readout']])
            if A.shots: await gm.screenshot(path=os.path.join(A.shots, 'trackclear-prop-high.png')); print('    (still: trackclear-prop-high.png)')
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(80); await gm.mouse.up(); await settle(gm)
            # low on the screen (nothing above it within reach): the track is as long as ever (420 px from the centre at most)
            b = await frame_prop(620); st = await grab_prop(b); t = st and st['track'] or {}
            if st:
                ux, uy = st['dir']; cx, cy = st['centre']
                reach = min([v for v in [(1280 - 24 - cx) / ux if ux > 0.05 else (24 - cx) / ux if ux < -0.05 else float('inf'), (820 - 24 - cy) / uy if uy > 0.05 else (24 - cy) / uy if uy < -0.05 else float('inf')] if v > 0] + [420])
                want_max = await gm.evaluate(f"Math.max(1.25, tw.ringSoftK(Math.max(1.3, {reach} / {st['d0']})))")
            check(st and abs(t.get('max', 0) - want_max) < 1e-6, 'low on the screen: the track runs as far as it always did', [t.get('max'), st and want_max, b])
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(80); await gm.mouse.up(); await settle(gm)
            await gm.evaluate(f"({LOOK})([{OX}, {OZ}, 60])")

        # ---------------- BAR ----------------
        if want('BAR'):
            print('BAR')
            steps = []
            for text, size in (('size huge', 3), ('make it tiny', 0.5), ('bigger', 1), ('15 ft', 3), ('medium', 1)):
                await sel(gm, F1); await bar(gm, text); await settle(gm)
                await wait(gm, f"({E(F1)}.size ?? 1) === {size}", 6000, text); steps.append((text, await gm.evaluate(f"{E(F1)}.size ?? 1"), size))
            check(all(a == b for _, a, b in steps), 'the bar: "size huge", "make it tiny", "bigger", "15 ft", "medium"', steps)
            await sel(gm, F1); await bar(gm, 'make it tiny'); await settle(gm); await wait(gm, f"{E(F1)}.size === 0.5", 6000)
            tb = await gm.evaluate(f"(async () => {{ await new Promise(r => setTimeout(r, 400)); return {FIG(F1)}; }})()")
            check(tb and abs(tb['base_width_ft'] - 2) < 0.05 and abs(tb['size_k'] - 0.5) < 1e-6, 'tiny: a 2-ft base, the figure half its size', tb and [tb['base_width_ft'], tb['size_k']])
            await gm.evaluate('tw.undo()'); await settle(gm)
            u1 = await wait(gm, f"({E(F1)}.size ?? 1) === 1", 6000) and await wait(pl, f"({E(F1)}.size ?? 1) === 1", 6000)
            check(u1, 'undo: back to medium for both seats', [await gm.evaluate(f"{E(F1)}.size"), await pl.evaluate(f"{E(F1)}.size")])
            await sel(pl, MI); await bar(pl, 'size large'); await settle(pl)
            check(await wait(gm, f"{E(MI)}?.size === 2", 6000), 'a player makes her own pawn large from the bar; the GM sees it')
            await sel(pl, F1); await bar(pl, 'size huge'); await settle(pl); await pl.wait_for_timeout(300)
            check(await gm.evaluate(f"({E(F1)}.size ?? 1) === 1"), 'a player cannot resize the GM\'s pawn')

        # ---------------- SQUARES ----------------
        if want('SQUARES'):
            print('SQUARES')
            await gm.evaluate(f"tw.setSize([{E(F1)}], 3)"); await settle(gm); await wait(gm, f"{E(F1)}.size === 3", 6000)
            f = await gm.evaluate(E(F1))
            spots = await gm.evaluate(f"tw.pawnFormation({f['x'] + 12.5}, {f['z']}, {{ size: 1, n: 12 }})")
            def inside(x, z): return abs(x - f['x']) < 7.5 - 0.01 and abs(z - f['z']) < 7.5 - 0.01
            check(not any(inside(x, z) for x, z in spots[1:]), 'a group placed beside a huge pawn keeps off its 3 x 3 squares', {'huge': [f['x'], f['z']], 'spots': spots})
            # a tiny pawn takes a quarter of a square: another tiny one stands in the same square, never on its quarter
            await gm.evaluate(f"tw.batch([{{ type: 'token.create', args: {{ id: 'tok_sztiny00001', name: 'Imp', x: 51.25, z: 11.25, fig: 'foe-imp', size: 0.5 }} }}])"); await settle(gm)
            tiny = await gm.evaluate("tw.pawnFormation(53.75, 13.75, { size: 0.5, n: 4 })")
            check(len(tiny) == 4 and len(set(map(tuple, tiny))) == 4 and [51.25, 11.25] not in tiny and all(abs((x / 2.5) % 1 - 0.5) < 1e-6 for x, _ in tiny)
                  and (math.floor(tiny[0][0] / 5), math.floor(tiny[0][1] / 5)) == (10, 2), 'tiny pawns stand on quarters: one shares the imp\'s square, none takes its quarter', tiny)
            med = await gm.evaluate("tw.pawnFormation(57.5, 12.5, { size: 1, n: 6 })")
            check(not any(50 <= x < 55 and 10 <= z < 15 for x, z in med[1:]), 'a medium group keeps off the square a tiny pawn is in', med)

        # ---------------- PICK ----------------
        if want('PICK'):
            print('PICK')
            await gm.evaluate(f"tw.setSize([{E(F1)}], 3)"); await settle(gm); await wait(gm, f"{E(F1)}.size === 3 && {FIG(F1)}?.size === 3", 6000)
            for pg in (gm,): await pg.evaluate(f"({LOOK})([{OX}, {OZ}, 50, 88])"); await gm.wait_for_timeout(600)
            f = await gm.evaluate(E(F1))
            pt = await gm.evaluate(f"tw.screenOf({f['x'] + 5.3}, {f['z']}, tw.main, 0.25)")
            hit = await gm.evaluate(f"(() => {{ const p = tw.worldOf(tw.area()).pick(tw.rayAt({pt['x']}, {pt['y']})); return p?.entity?.id || null; }})()")
            check(hit == F1, 'a pick 5.3 ft from the middle (on a huge base) finds it', hit)
            await gm.evaluate(f"tw.setSize([{E(F1)}], 1)"); await settle(gm); await wait(gm, f"!{E(F1)}.size && {FIG(F1)}?.size === 1", 6000); await gm.wait_for_timeout(500)
            hit2 = await gm.evaluate(f"(() => {{ const p = tw.worldOf(tw.area()).pick(tw.rayAt({pt['x']}, {pt['y']})); return p?.entity?.id || null; }})()")
            check(hit2 != F1, 'the same point misses it once it is medium', hit2)

        # ---------------- FIT ----------------
        if want('FIT'):
            print('FIT')
            L1, M1 = 'tok_szlarge0001', 'tok_szmedium001'
            await gm.evaluate('ops => tw.batch(ops)', [
                {'type': 'token.create', 'args': {'id': L1, 'name': 'Ogre', 'x': 15, 'z': 12.5, 'fig': 'foe-ogre', 'size': 2}},
                {'type': 'token.create', 'args': {'id': M1, 'name': 'Guard', 'x': 12.5, 'z': 7.5, 'fig': FIGHTER}}])
            await settle(gm); await gm.evaluate(f"({LOOK})([15, 12.5, 45, 70])"); await gm.wait_for_timeout(800)
            fits = await gm.evaluate("[tw.pawnFits(15, 12.5, 2, 0), tw.pawnFits(15, 0, 2, 0), tw.pawnFits(15, 0.5, 1, 0), tw.pawnFits(2, 12.5, 2, 0), tw.pawnFits(2, 12.5, 1, 0)]")
            check(fits == [True, False, True, False, True], 'a large base fits in the room\'s middle, not over its wall; a medium one anywhere', fits)
            await gm.evaluate(f"tw.moveBy([{E(L1)}], 0, -12.5)"); await settle(gm); await gm.wait_for_timeout(200)
            e = await gm.evaluate(E(L1)); ref = await gm.evaluate("tw.lastRefusal")
            check(e['z'] == 12.5 and ref and ref.get('what') == 'pawn.fit', 'moved (the bar, the arrow keys) onto the wall: refused, it stays, and is told so', [e['z'], ref])
            await gm.evaluate(f"tw.moveBy([{E(M1)}], 0, -7.5)"); await settle(gm)
            check(await gm.evaluate(f"{E(M1)}.z") == 0, 'a medium pawn goes onto the wall line as it always did (unchanged)', await gm.evaluate(f"{E(M1)}.z"))
            # drag at the wall: held where it last had room
            await figs_in(gm, L1); await gm.evaluate("tw.lastRefusal = null"); await sel(gm, L1)
            a = await gm.evaluate(f"tw.screenOf(15, 12.5, tw.main, 1.5)"); t = await gm.evaluate("tw.screenOf(15, -2, tw.main, 0)")
            await gm.mouse.move(a['x'], a['y']); await gm.mouse.down(); await gm.wait_for_timeout(80)
            lbl = None
            for k in range(1, 15):
                await gm.mouse.move(a['x'] + (t['x'] - a['x']) * k / 14, a['y'] + (t['y'] - a['y']) * k / 14); await gm.wait_for_timeout(40)
                if k == 14: lbl = await gm.evaluate("(() => { const l = document.getElementById('modeLabel'); return l && !l.hidden ? { text: l.textContent, bad: l.classList.contains('bad') } : null; })()")
            await gm.mouse.up(); await settle(gm); await gm.wait_for_timeout(300)
            e = await gm.evaluate(E(L1)); ref = await gm.evaluate("tw.lastRefusal")
            check(lbl and lbl['bad'] and 'too big' in lbl['text'], 'dragged at the wall: the label says it is too big to fit, in red', lbl)
            check(e['z'] >= 4 - 0.01 and ref and ref.get('what') == 'pawn.fit', 'let go there: it is held where it last had room (its disc clear of the wall)', [e['z'], ref])
            # placed at the wall from the pawn tool: refused
            n0 = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').length")
            await gm.evaluate("tw.pawnTool.start('foe-ogre')"); r = await gm.evaluate("tw.pawnTool.placeAt(null, Object.assign([15, 0], { y: 0 }), null)")
            n1 = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').length"); await gm.keyboard.press('Escape')
            check(r is False and n1 == n0, 'placing a large figure over the wall from the pawn tool: refused', [r, n0, n1])
            # made huge beside the wall: it steps inward
            await gm.evaluate(f"tw.batch([{{ type: 'token.move', args: {{ id: '{M1}', x: 2.5, z: 12.5 }} }}])"); await settle(gm)
            await gm.evaluate(f"tw.setSize([{E(M1)}], 3)"); await settle(gm)
            e = await gm.evaluate(E(M1)); ls = await gm.evaluate("tw.lastSize")
            check(e.get('size') == 3 and e['x'] >= 6 - 0.01 and M1 in (ls or {}).get('moved', []) and await gm.evaluate(f"tw.pawnFits({e['x']}, {e['z']}, 3, 0)"), 'made huge beside a wall: it steps inward to where it has room (one command)', [e, ls])
            await gm.evaluate('tw.undo()'); await settle(gm)
            check(await wait(gm, f"!{E(M1)}.size && {E(M1)}.x === 2.5", 6000), 'one undo puts back both its size and its place', await gm.evaluate(E(M1)))

        # ---------------- FLY ----------------
        if want('FLY'):
            print('FLY')
            DR, HF = 'tok_szdragon001', 'tok_szhero00001'
            WYV = 'foe-dragon-young-red'
            real = await gm.evaluate(f"tw.assets.figures.canFly('{WYV}')")
            if not real:  # the flying figures are not built here: a stand-in mesh (another winged figure's) carries the pose, both tabs
                inject = f"(() => {{ const F = tw.assets.figures, s = F.get('foe-giant-eagle'); F.get('{WYV}').fly = {{ url: s.url, k: s.k, c: s.c, yaw: s.yaw, h: s.h, oh: s.oh }}; return true; }})()"
                for pg in (gm, pl): await pg.evaluate(inject)
                print('    (no flying pose built here: a stand-in mesh carries it)')
            await gm.evaluate('ops => tw.batch(ops)', [
                {'type': 'token.create', 'args': {'id': DR, 'name': 'Red dragon', 'x': OX + 5, 'z': OZ + 25, 'fig': WYV, 'size': 2}},
                {'type': 'token.create', 'args': {'id': HF, 'name': 'Hero', 'x': OX + 20, 'z': OZ + 25, 'fig': FIGHTER}}])
            await settle(gm); await figs_in(gm, DR); await wait(pl, f"!!{E(DR)}", 15000); await figs_in(pl, DR)
            for pg in (gm, pl): await pg.evaluate(f"({LOOK})([{OX + 10}, {OZ + 27}, 75, 40])")
            b0 = await gm.evaluate(BASE(DR))
            check(b0['pose'] == 'stand' and not b0['flying'] and not b0['shadow'], 'on the ground: the standing figure, no shadow', b0)
            await shot(gm, 'size-dragon-ground.png')
            await gm.evaluate(f"tw.batch([{{ type: 'token.move', args: {{ id: '{DR}', x: {OX + 5}, z: {OZ + 25}, y: 20 }} }}, {{ type: 'token.move', args: {{ id: '{HF}', x: {OX + 20}, z: {OZ + 25}, y: 20 }} }}])"); await settle(gm)
            okg = await wait(gm, f"{BASE(DR)}?.pose === 'fly'", 20000, 'GM fly pose')
            b1 = await gm.evaluate(BASE(DR)); h1 = await gm.evaluate(BASE(HF))
            check(okg and b1['flying'] and b1['shadow'] and abs(b1['figureY'] - 20) < 0.01 and abs(b1['drop'] - 20) < 0.05, 'raised to 20 ft: the flying pose, the base on the ground, a shadow under it', b1)
            okp = await wait(pl, f"{BASE(DR)}?.pose === 'fly'", 20000, 'player fly pose')
            check(okp and (await pl.evaluate(BASE(DR)))['shadow'], 'the player sees it flying too (the same pose, the shadow)', await pl.evaluate(BASE(DR)))
            fm = await gm.evaluate(FIG(DR))
            check(fm and fm['pose'] == 'fly' and fm['loaded'] and fm['drawn_tris'] > 0, 'the flying figure is the one drawn (and nothing else in its holder)', fm and {k: fm[k] for k in ('pose', 'drawn_tris', 'height_ft')})
            check(h1['pose'] == 'stand-lifted' and h1['shadow'], 'a figure with no flying pose stays standing, lifted, with the shadow', h1)
            await shot(gm, 'size-dragon-air.png')
            await gm.evaluate(f"tw.batch([{{ type: 'token.move', args: {{ id: '{DR}', x: {OX + 5}, z: {OZ + 25}, y: 0 }} }}])"); await settle(gm)
            check(await wait(gm, f"{BASE(DR)}?.pose === 'stand' && !{BASE(DR)}.shadow", 10000) and await wait(pl, f"{BASE(DR)}?.pose === 'stand'", 10000), 'lowered to the ground: standing again for both seats', await gm.evaluate(BASE(DR)))
            await gm.evaluate('tw.undo()'); await settle(gm)
            check(await wait(gm, f"{BASE(DR)}?.pose === 'fly'", 10000) and await wait(pl, f"{BASE(DR)}?.pose === 'fly'", 10000), 'undo: up again, flying again, both seats', await gm.evaluate(BASE(DR)))
            await gm.evaluate(f"tw.batch([{{ type: 'token.move', args: {{ id: '{DR}', x: {OX + 5}, z: {OZ + 25}, y: 3 }} }}])"); await settle(gm); await gm.wait_for_timeout(400)
            b3 = await gm.evaluate(BASE(DR))
            check(b3['pose'] != 'fly' and not b3['shadow'], 'under 5 ft over its base it is not flying', b3)

        # ---------------- stills of sizes ----------------
        if A.shots and want('RING'):
            S = ['tok_szshot00001', 'tok_szshot00002', 'tok_szshot00003']
            await gm.evaluate('ops => tw.batch(ops)', [
                {'type': 'token.create', 'args': {'id': S[0], 'name': 'Medium', 'x': OX - 2.5, 'z': OZ + 50, 'fig': FIGHTER}},
                {'type': 'token.create', 'args': {'id': S[1], 'name': 'Large', 'x': OX + 10, 'z': OZ + 50, 'fig': FIGHTER, 'size': 2}},
                {'type': 'token.create', 'args': {'id': S[2], 'name': 'Huge', 'x': OX + 27.5, 'z': OZ + 52.5, 'fig': FIGHTER, 'size': 3}}])
            await settle(gm)
            for s in S: await figs_in(gm, s)
            await gm.evaluate(f"({LOOK})([{OX + 12}, {OZ + 50}, 70, 45])"); await gm.wait_for_timeout(1200)
            await shot(gm, 'size-medium-large-huge.png')

        bad = [e for e in errors if 'WebGL' not in e]
        check(not bad, 'no page errors', bad[:5])
        await browser.close()

try:
    asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate(); pr.wait(5)
        except Exception: pass
    import shutil
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
n = len(results); good = sum(1 for r in results if r[0])
print(f'size: {good}/{n}')
sys.exit(0 if n and good == n else 1)

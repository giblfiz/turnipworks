#!/usr/bin/env python3
"""The ring's drag buttons never lose a release (Harry 2026-10-05: "raise is now dropping everything instantly back to
the floor. Can't levitate stuff and also can't place it on tables"). browser_lift.py is the plain regression; this one
ends the drag in every way a headless mouse normally does not.

  ROOT CAUSE   with ANY thing in the area hidden from players (the GM's "Hidden" pill is a sprite in that thing's
               group), releasing a raise / lower threw inside world.surfaceBelow (three's Sprite.raycast needs a camera
               on the raycaster): the drag previewed, the release sent nothing, the thing fell back. Tested first.
  ENDINGS      released far outside the window; released over other UI; a pointercancel mid-drag; the window losing
               focus mid-drag; a touch pointer and a pen pointer; a touch whose capture is lost with no pointerup; a slow
               drag; a fast flick; a ring rebuild and a change arriving from the relay mid-drag. Every one COMMITS the last
               previewed height: the thing ends there, the second tab sees it (so the relay took it), a reload keeps it.
  ESCAPE       the one way to cancel: nothing is sent.
  NOT SILENT   a release the relay refuses (the thing was locked meanwhile) and a release that throws both say why.
  TURN, SIZE   the same ending rules for the other two drag buttons.
  TABLE        raised to just above a table, a thing rests on the table top.
  HOVER        a pawn let go or moved to under 5 ft above its base lands on it: no beam, no "0.5 ft" (2026-10-19); 4.9 ft
               lands, 5 ft stays; Shift steps a pawn by 5 ft; a pawn stored 0.43 ft up settles when moved (arrow, drag).
  OTHER ENGINES  Firefox (and WebKit when Playwright has it) run the same gesture, if the game runs there at all.

  local:  python3 engine/test/browser_lift_hard.py --local
  live:   ... browser_lift_hard.py --page https://turnipworks.net/
Live runs make one campaign named "TEST lift endings (throwaway)".
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # noqa: E402,F401
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits

GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--no-other-engines', action='store_true'); ap.add_argument('--shots-dir')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
def note(text): print(f'  note {text}', flush=True)

RP, SP = 18112, 18739
def start_local():
    data = tempfile.mkdtemp(prefix='tw-lifth-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro'

SEEN = "((id) => { const e = tw.entities()[id], r = tw.worldOf(tw.area()).recs.get(id); return e && r ? { y: +(e.y || 0).toFixed(2), drawn: +r.group.position.y.toFixed(2), parent: e.parent || null, rot: +(e.rot || 0).toFixed(3), size: +Math.max(...(e.dims || [1])).toFixed(3) } : null; })"
MOVES = "tw.applied.filter(a => a[3] === 'object.move' || a[3] === 'token.move' || a[3] === 'object.set' || a[3] === 'batch').length"

async def ready(pg, t=45000):
    try: await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=t); return True
    except Exception: return False

async def handle(pg, id, cmd='edit.lift'):
    """frame the thing, select it, open ☰ if the button lives there; returns the drag button's centre and feet-per-pixel"""
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
    await pg.evaluate(f"(() => {{ const e = tw.entities()['{id}'], g = tw.main.grab; g.focus.set(e.x, e.y || 0, e.z); g.yaw = 0; g.pitch = 52; g.dist = 95; g.update(); tw.main.rule = 'free'; tw.select('{id}'); }})()")  # (the ring is world-sized since 2026-10-20: framed at the thing's height so its ring is on screen, clear of the top bar)
    await pg.wait_for_timeout(600)
    if not await pg.evaluate(f"!!document.querySelector('#ring [data-cmd=\"{cmd}\"]')"):
        await pg.click('#ring [data-menu]'); await pg.wait_for_timeout(850)  # (☰ slides the buttons along the oval: ~520 ms + stagger)
        grp = await pg.query_selector('#ring .rbtn.grp[data-group="edit"]')  # (the grouped menu of the morning of 2026-10-05, for runs against an older build)
        if grp: await grp.click(); await pg.wait_for_timeout(250)
    return await pg.evaluate(f"""(() => {{ const el = document.querySelector('#ring [data-cmd="{cmd}"]'); if (!el) return null; const r = el.getBoundingClientRect(), e = tw.entities()['{id}'];
        return {{ x: r.left + r.width / 2, y: r.top + r.height / 2, y0: e.y || 0, ppf: Math.max(4, Math.abs(tw.screenOf(e.x, e.z, tw.main, e.y || 0).y - tw.screenOf(e.x, e.z, tw.main, (e.y || 0) + 1).y)) }}; }})()""")

async def main():
    page = start_local() if A.local else (A.page or 'http://127.0.0.1:8180/') + ('&' if '?' in (A.page or '') else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, br=None):
            ctx = await (br or browser).new_context(viewport={'width': 1280, 'height': 820})
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)[:200])); await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Fauna-test')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill('TEST lift endings (throwaway)')
        await gm.click('#newCampaign button')
        check(await ready(gm), 'GM tab live')
        ids = await gm.evaluate("""async () => {
          const rid = 'room_lifh' + Math.random().toString(36).slice(2, 8), a = { id: rid, type: 'kitchen', x: 0, z: 0, w: 6, d: 5, seed: 77 };
          await tw.dispatch('room.spawn', { ...a, engineVersion: tw.roomgen.version, layout: tw.roomgen.solve(tw.entities(), a, 1) });
          const tok = 'tok_lifh' + Math.random().toString(36).slice(2, 8); await tw.dispatch('token.create', { id: tok, name: 'Brakka', x: 40, z: 12 });
          await new Promise(r => setTimeout(r, 9000));
          const es = Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === rid), riders = (t) => es.filter(c => c.parent === t.id);
          const table = es.filter(e => riders(e).length && e.dims[1] > 2 && e.dims[1] < 4 && e.dims[0] > 3).sort((p, q) => riders(p).length - riders(q).length)[0];
          const floor = es.filter(e => e.place === 'floor' && !e.parent && !e.flat && e.dims[1] < 3.2 && !riders(e).length && e.id !== table.id);
          return { rid, tok, table: table.id, tableTop: table.dims[1], tableAt: [table.x, table.z], floor: floor.map(e => e.id), other: es.find(e => riders(e).length === 0 && e.parent)?.id || floor[floor.length - 1].id }; }""")
        check(len(ids['floor']) >= 3, 'a kitchen with a table and a few things on its floor', f"{len(ids['floor'])} floor things")
        T, U, V = ids['floor'][0], ids['floor'][1], ids['floor'][2]
        async def invite():
            await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
            await gm.wait_for_function("!document.querySelector('#output').hidden", timeout=10000)
            link = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape'); return link
        link = await invite()
        pl = await tab(link + '&nofx')
        check(await ready(pl), 'second tab joined')
        await gm.evaluate("window.__pid = null; addEventListener('pointerdown', e => { window.__pid = e.pointerId; }, true)")

        async def lands(id, want, what, tol=0.3, how=None, parent=None):
            try: await gm.wait_for_function('tw.sync.pendingCount() === 0', timeout=6000)
            except Exception: pass
            try: await pl.wait_for_function(f"Math.abs(((tw.entities()['{id}'] || {{}}).y || 0) - {want}) < {tol}", timeout=8000)
            except Exception: pass
            await gm.wait_for_timeout(900)
            a, b, last = await gm.evaluate(SEEN + f"('{id}')"), await pl.evaluate(SEEN + f"('{id}')"), await gm.evaluate('tw.ringDragLast || null')
            ok = lambda s: s and abs(s['y'] - want) < tol and abs(s['drawn'] - want) < tol + 0.1 and (parent is None or s['parent'] == parent)
            check(ok(a) and ok(b) and last and last['committed'] and (how is None or last['how'] == how), f'{what}: the thing ends at the dragged height, drawn there, and the second tab sees it', {'gm': a, 'second tab': b, 'ended by': last and last['how']})
        async def mouse_drag(b, to_y, steps=10, ms=30, end='up', mid=None):
            dy = (to_y - b['y0']) * b['ppf']
            await gm.mouse.move(b['x'], b['y']); await gm.mouse.down()
            for i in range(1, steps + 1): await gm.mouse.move(b['x'] + (3 if i % 2 else -3), b['y'] - dy * i / steps); await gm.wait_for_timeout(ms)
            if mid: await mid()
            if end == 'up': await gm.mouse.up()
            return b['y'] - dy

        print('ROOT CAUSE: a thing hidden from players elsewhere in the area')
        await gm.evaluate(f"tw.flag(['{ids['other']}'], {{ hidden: true }})"); await gm.wait_for_function(f"tw.entities()['{ids['other']}'].hidden === true && tw.sync.pendingCount() === 0", timeout=8000); await gm.wait_for_timeout(700)
        pill = await gm.evaluate(f"(() => {{ let n = 0; tw.worldOf(tw.area()).recs.get('{ids['other']}').group.traverse(o => {{ if (o.isSprite) n++; }}); return n; }})()")
        direct = await gm.evaluate(f"(() => {{ try {{ tw.worldOf(tw.area()).surfaceBelow(tw.entities()['{T}'].x, 3, tw.entities()['{T}'].z, new Set(['{T}'])); return 'ok'; }} catch (e) {{ return 'THREW ' + e.message; }} }})()")
        check(pill >= 1 and direct == 'ok', 'with a "Hidden" pill (a sprite) on another thing, finding the surface below a point does not throw (it did: every raise / lower release was lost while anything was hidden)', f'{pill} sprite(s) on the hidden thing; surfaceBelow: {direct}')
        b = await handle(gm, T); await mouse_drag(b, 3)
        await lands(T, 3, 'raised to 3 ft while another thing is hidden', how='up')

        print('ENDINGS: every way a drag can end commits the last previewed height')
        b = await handle(gm, T); y_ = await mouse_drag(b, 4.5, end=None)
        await gm.mouse.move(b['x'] + 500, -400); await gm.wait_for_timeout(80)  # far above the window's top edge
        mid = await gm.evaluate('tw.ringDrag()'); await gm.mouse.up()
        want = (mid or {}).get('y') or 4.5
        await lands(T, want, f'released far OUTSIDE the window (the pointer at y = -400; the preview read {round(want, 2)} ft)')
        b = await handle(gm, T); n0 = await gm.evaluate(MOVES)
        await mouse_drag(b, 2, end=None); await gm.mouse.move(640, 22); await gm.wait_for_timeout(60); mid = await gm.evaluate('tw.ringDrag()'); over = await gm.evaluate("document.elementFromPoint(640, 22)?.closest('[id]')?.id"); await gm.mouse.up()
        await lands(T, mid['y'], f'released over other UI (the top bar: #{over})')
        check(await gm.evaluate(MOVES) == n0 + 1, 'one release = one command', f"{await gm.evaluate(MOVES) - n0} sent")
        b = await handle(gm, T); n0 = await gm.evaluate(MOVES)
        await mouse_drag(b, 5, end=None)
        await gm.evaluate("window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.__pid, pointerType: 'mouse', bubbles: true }))"); await gm.wait_for_timeout(200)
        await gm.mouse.up()
        await lands(T, 5, 'a pointercancel mid-drag (the browser took the gesture)', how='cancel')
        check(await gm.evaluate(MOVES) == n0 + 1, 'the pointerup that follows a cancel sends nothing more', f"{await gm.evaluate(MOVES) - n0} sent")
        b = await handle(gm, T); await mouse_drag(b, 1.5, end=None)
        await gm.evaluate("window.dispatchEvent(new Event('blur'))"); await gm.wait_for_timeout(150); await gm.mouse.up()
        await lands(T, 1.5, 'the window losing focus mid-drag', how='blur')
        async def rebuilds():
            await gm.evaluate("tw.refresh(); tw.emit('refresh'); tw.emit('change')")
            # a change arrives from the relay mid-drag
            n_ = await gm.evaluate('tw.applied.length')
            await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{ids['tok']}', x: 42, z: 14 }})")
            await gm.wait_for_function(f"tw.applied.length > {n_} && tw.sync.pendingCount() === 0", timeout=6000); await gm.wait_for_timeout(150)
        b = await handle(gm, T); await mouse_drag(b, 3.5, mid=rebuilds)
        await lands(T, 3.5, "a ring rebuild and a change arriving from the relay mid-drag", how='up')
        b = await handle(gm, T); await mouse_drag(b, 6, steps=40, ms=60)
        await lands(T, 6, 'a slow drag (2.4 s)', how='up')
        b = await handle(gm, T)
        await gm.mouse.move(b['x'], b['y']); await gm.mouse.down(); await gm.mouse.move(b['x'], b['y'] + (6 - 2) * b['ppf']); await gm.mouse.up()  # one move, no pause
        await lands(T, 2, 'a fast flick (one move between press and release)', how='up')
        # touch and pen: the same handlers through synthetic pointer events (capture cannot be taken for these: the window listeners must carry it)
        SYN = """async ([cmd, type, pid, dy, end]) => { const el = document.querySelector(`#ring [data-cmd="${cmd}"]`), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
          const ev = (t, yy, tgt = window) => tgt.dispatchEvent(new PointerEvent(t, { pointerId: pid, pointerType: type, isPrimary: true, clientX: x, clientY: yy, buttons: t === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true }));
          ev('pointerdown', y, el);
          for (let i = 1; i <= 8; i++) { ev('pointermove', y - dy * i / 8); await new Promise(r => setTimeout(r, 25)); }
          if (end === 'up') ev('pointerup', y - dy); else if (end === 'lost') el.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: pid, pointerType: type, bubbles: true }));
          await new Promise(r => setTimeout(r, 120)); return tw.ringDragLast; }"""
        for typ, pid, to, end, what in (('touch', 71, 4, 'up', 'a touch pointer'), ('pen', 72, 2.5, 'up', 'a pen pointer'), ('touch', 73, 5.5, 'lost', 'a touch whose capture is lost with no pointerup')):
            b = await handle(gm, T); await gm.evaluate(SYN, ['edit.lift', typ, pid, (to - b['y0']) * b['ppf'], end])
            await lands(T, to, what, how='up' if end == 'up' else 'lost-capture')

        print('ESCAPE: the one way to cancel')
        b = await handle(gm, T); n0 = await gm.evaluate(MOVES); before = await gm.evaluate(SEEN + f"('{T}')")
        await mouse_drag(b, 7, end=None); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150); await gm.mouse.up(); await gm.wait_for_timeout(900)
        after, last = await gm.evaluate(SEEN + f"('{T}')"), await gm.evaluate('tw.ringDragLast')
        check(last['how'] == 'escape' and not last['committed'] and after['y'] == before['y'] and abs(after['drawn'] - before['y']) < 0.3 and await gm.evaluate(MOVES) == n0, 'Escape mid-drag cancels: nothing is sent and the thing is back where it was', {'before': before['y'], 'after': after, 'toast': await gm.evaluate("document.querySelector('#toast').textContent")})

        print('NOT SILENT: a refused or failed release says why')
        b = await handle(gm, U)
        async def lock_it(): await gm.evaluate(f"tw.flag(['{U}'], {{ locked: true }})"); await gm.wait_for_function(f"tw.entities()['{U}'].locked === true", timeout=6000)
        await mouse_drag(b, 3, mid=lock_it); await gm.wait_for_timeout(1200)
        toast = await gm.evaluate("({ text: document.querySelector('#toast').textContent, bad: document.querySelector('#toast').classList.contains('bad') })"); su = await gm.evaluate(SEEN + f"('{U}')")
        check(su['y'] == 0 and ('locked' in toast['text'].lower() or 'refused' in toast['text'].lower()), 'the thing was locked while it was being raised: the release is refused and the reason is shown', {**toast, 'y': su['y']})
        await gm.evaluate(f"tw.flag(['{U}'], {{ locked: false }})"); await gm.wait_for_function(f"!tw.entities()['{U}'].locked", timeout=6000)
        b = await handle(gm, U); await gm.evaluate("window.__lift = tw.liftTo; tw.liftTo = () => { throw new Error('boom (test)'); }; null")
        await mouse_drag(b, 3); await gm.wait_for_timeout(500)
        toast = await gm.evaluate("({ text: document.querySelector('#toast').textContent, bad: document.querySelector('#toast').classList.contains('bad') })"); last = await gm.evaluate('tw.ringDragLast'); await gm.evaluate('tw.liftTo = window.__lift; null')
        check('could not be sent' in toast['text'] and 'boom' in toast['text'] and toast['bad'] and last.get('error') and not last['committed'], 'a release that throws is reported (a red toast with the reason), not swallowed', {**toast})
        errors[:] = [e for e in errors if 'boom (test)' not in e]

        print('TURN and SIZE: the same endings')
        b = await handle(gm, U, 'edit.rotate'); r0 = (await gm.evaluate(SEEN + f"('{U}')"))['rot']
        await gm.mouse.move(b['x'], b['y']); await gm.mouse.down()
        for i in range(1, 9): await gm.mouse.move(b['x'] + 14 * i, b['y'] - 6 * i); await gm.wait_for_timeout(30)
        mid = await gm.evaluate('tw.ringDrag()')
        await gm.evaluate("window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.__pid, pointerType: 'mouse', bubbles: true }))"); await gm.wait_for_timeout(150); await gm.mouse.up()
        await gm.wait_for_function('tw.sync.pendingCount() === 0', timeout=6000); await pl.wait_for_timeout(900)
        ra, rb, last = await gm.evaluate(SEEN + f"('{U}')"), await pl.evaluate(SEEN + f"('{U}')"), await gm.evaluate('tw.ringDragLast')
        check(last['how'] == 'cancel' and last['committed'] and abs(ra['rot'] - (r0 + mid['delta'])) < 0.01 and abs(mid['delta']) > 0.2 and abs(rb['rot'] - ra['rot']) < 0.01, 'a turn cut off by a pointercancel keeps the angle it had reached (both tabs)', {'from': r0, 'turned': round(mid['delta'], 3), 'gm': ra['rot'], 'second tab': rb['rot']})
        b = await handle(gm, U, 'edit.resize'); s0 = (await gm.evaluate(SEEN + f"('{U}')"))['size']
        if b:
            c = await gm.evaluate('tw.ringCenter()'); ux, uy = b['x'] - c[0], b['y'] - c[1]; ul = (ux * ux + uy * uy) ** 0.5; ux, uy = ux / ul, uy / ul
            await gm.mouse.move(b['x'], b['y']); await gm.mouse.down()
            for i in range(1, 9): await gm.mouse.move(b['x'] + ux * 9 * i, b['y'] + uy * 9 * i); await gm.wait_for_timeout(30)
            mid = await gm.evaluate('tw.ringDrag()'); await gm.mouse.move(b['x'] + ux * 72, -300); await gm.wait_for_timeout(60); mid = await gm.evaluate('tw.ringDrag()'); await gm.mouse.up()
            await gm.wait_for_function('tw.sync.pendingCount() === 0', timeout=6000); await pl.wait_for_timeout(900)
            sa, sb, last = await gm.evaluate(SEEN + f"('{U}')"), await pl.evaluate(SEEN + f"('{U}')"), await gm.evaluate('tw.ringDragLast')
            check(last['committed'] and abs(sa['size'] - s0 * mid['k']) < 0.02 and abs(mid['k'] - 1) > 0.05 and abs(sb['size'] - sa['size']) < 0.01, 'a resize released outside the window keeps the size it had reached (both tabs)', {'from': s0, 'k': round(mid['k'], 3), 'gm': sa['size'], 'second tab': sb['size']})
        else: check(False, 'the resize handle is on the ring')

        print('TABLE: raised to just above a table, a thing rests on it (with something hidden in the room)')
        top = ids['tableTop']
        await gm.evaluate(f"tw.dispatch('object.move', {{ id: '{V}', x: {ids['tableAt'][0]}, z: {ids['tableAt'][1]}, y: 0, parent: '' }})"); await gm.wait_for_timeout(700)
        b = await handle(gm, V); await mouse_drag(b, top + 0.8)
        await gm.wait_for_function('tw.sync.pendingCount() === 0', timeout=6000); await gm.wait_for_timeout(1200)
        sv = await gm.evaluate(SEEN + f"('{V}')")
        check(sv['parent'] == ids['table'] and abs(sv['y'] - top) < 0.6, 'it lands on the table top (parent = the table)', {**sv, 'top': top})
        await lands(V, sv['y'], 'the thing on the table', parent=ids['table'])

        print('HOVER: a pawn under 5 ft above its base settles onto it (Harry 2026-10-19: "a 0.5 foot ruler ... over the pawn at all times"; then "based on D&D rules, anything less than 5 feet off the ground should probably settle to the ground for pawns")')
        # His Bloorg was lowered by hand from 19 ft and let go at 0.43 ft; a pawn more than 0.3 ft up wears a height beam,
        # so it floated there for good under a "0.5 ft" label, wherever it was dragged after.
        P = ids['tok']
        HL = f"(tw.worldOf(tw.area()).heightLabels().find(h => h.id === '{P}') || null)"
        Y = f"(tw.entities()['{P}'].y || 0)"
        async def settle_(): 
            try: await gm.wait_for_function('tw.sync.pendingCount() === 0', timeout=6000)
            except Exception: pass
            await gm.wait_for_timeout(700)
        async def pawn_at(y):
            await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{P}', x: 40, z: 12, y: {y} }})"); await settle_()
        async def lower_to(to, shift=False):
            b = await handle(gm, P)
            if shift: await gm.keyboard.down('Shift')
            await mouse_drag(b, to)
            if shift: await gm.keyboard.up('Shift')
            await settle_(); await gm.wait_for_timeout(200)
            return await gm.evaluate('tw.ringDragLast'), await gm.evaluate(Y), await gm.evaluate(f"tw.pawnBase('{P}')"), await gm.evaluate(HL)
        await pawn_at(10); last, y_, pb, hl = await lower_to(0.42)
        try: await pl.wait_for_function(f"{Y} === 0", timeout=6000)
        except Exception: pass
        y2 = await pl.evaluate(Y); hl2 = await pl.evaluate(HL)
        check(last and last['committed'] and y_ == 0 and y2 == 0 and pb and pb['drop'] == 0 and pb['beam'] is None and hl is None and hl2 is None, 'lowered by hand from 10 ft to a few inches up: it lands ON the ground, stored at 0, no beam and no "0.5 ft" over it, on either tab', {'last': last, 'y': y_, 'second tab y': y2, 'base': pb, 'label': hl, 'second tab label': hl2})
        await pawn_at(10); last, y_, pb, hl = await lower_to(4.6)
        check(last and last['committed'] and last['value'] == 0 and y_ == 0 and hl is None, 'lowered by hand to about 4.6 ft: the preview already reads the ground, and it lands there', {'last': last, 'y': y_, 'label': hl})
        await pawn_at(10); last, y_, pb, hl = await lower_to(7.3)
        check(abs(y_ - last['value']) < 0.01 and 6.8 < y_ < 7.8 and pb['beam'] and hl, 'control: let go about 7.3 ft up it stays up, with its beam and height', {'y': y_, 'label': hl})
        await pawn_at(10); last, y_, pb, hl = await lower_to(6.2, shift=True)
        check(y_ == 5 and hl and hl['text'] == '5 ft', 'Shift steps a pawn by 5 ft: about 6.2 becomes exactly 5 ft, which stays up', {'y': y_, 'value': last and last['value'], 'label': hl})
        await pawn_at(10); last, y_, pb, hl = await lower_to(2.2, shift=True)
        check(y_ == 0 and hl is None, 'Shift near 2 ft: the nearest 5-ft step is the ground', {'y': y_, 'value': last and last['value']})
        for want_in, want_out in ((4.9, 0), (5, 5), (0.43, 0)):
            await pawn_at(10); await gm.evaluate(f"tw.liftTo(tw.entities()['{P}'], {want_in})"); await settle_(); y_ = await gm.evaluate(Y); hl = await gm.evaluate(HL)
            check(y_ == want_out and ((hl is None) if want_out == 0 else (hl and hl['text'] == '5 ft')), f'raise / lower released at exactly {want_in} ft: {"lands on the ground" if want_out == 0 else "stays at 5 ft with its beam"}', {'y': y_, 'label': hl})
        # HIS DATA: a pawn already stored 0.43 ft up (an old lowering) settles the next time it is moved
        await pawn_at(0.43); hl = await gm.evaluate(HL)
        check(hl and hl['text'] == '0.5 ft', 'a pawn stored 0.43 ft up (as his Bloorg is) still shows "0.5 ft" until it is touched (data is never rewritten by itself)', hl)
        await handle(gm, P); await gm.keyboard.press('Escape'); await gm.evaluate(f"tw.select('{P}')"); await gm.keyboard.press('ArrowRight'); await settle_()
        e_ = await gm.evaluate(f"tw.entities()['{P}']"); hl = await gm.evaluate(HL)
        check((e_.get('y') or 0) == 0 and abs(e_['x'] - 45) < 0.01 and hl is None, 'moved one square with an arrow key: it settles to the ground, the "0.5 ft" is gone', {'x': e_['x'], 'y': e_.get('y'), 'label': hl})
        await pawn_at(0.43); await gm.evaluate('tw.clearSelection()')
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(40, 0, 12); g.yaw = 0; g.pitch = 55; g.dist = 34; g.update(); tw.main.rule = 'free'; })()"); await gm.wait_for_timeout(500)
        sx, sy = await gm.evaluate("(() => { const p = tw.screenOf(40, 12, tw.main, 0.6); return [p.x, p.y]; })()")
        await gm.mouse.move(sx, sy); await gm.mouse.down(); await gm.mouse.move(sx + 40, sy + 10, steps=5); await gm.mouse.move(sx + 90, sy + 20, steps=5); await gm.mouse.up(); await settle_()
        e_ = await gm.evaluate(f"tw.entities()['{P}']"); hl = await gm.evaluate(HL)
        check(abs(e_['x'] - 40) > 1 and (e_.get('y') or 0) == 0 and hl is None, 'dragged with the mouse: it settles to the ground too', {'x': e_['x'], 'z': e_['z'], 'y': e_.get('y'), 'label': hl})
        await pawn_at(0)
        if A.shots_dir: # the gesture, framed for a still: lowered from 10 ft and let go a few inches up, deselected
            await pawn_at(10); await lower_to(0.42); await gm.evaluate('tw.clearSelection()')
            await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(40, 0, 12); g.yaw = 0; g.pitch = 50; g.dist = 22; g.update(); tw.main.rule = 'free'; })()")
            await gm.mouse.move(5, 5); await gm.wait_for_timeout(1500); await gm.screenshot(path=os.path.join(A.shots_dir, 'hover-lowered-to-0.42.png'))
            await pawn_at(0)

        print('RELOAD: what was raised is still raised')
        before = {k: await gm.evaluate(SEEN + f"('{k}')") for k in (T, U, V)}
        await gm.reload(); check(await ready(gm), 'GM tab back after a reload'); await gm.wait_for_timeout(5000)
        for k, what in ((T, 'the raised thing'), (U, 'the turned and resized thing'), (V, 'the thing on the table')):
            a, b0 = await gm.evaluate(SEEN + f"('{k}')"), before[k]
            check(a and abs(a['y'] - b0['y']) < 0.05 and abs(a['drawn'] - b0['y']) < 0.4 and a['parent'] == b0['parent'] and abs(a['rot'] - b0['rot']) < 0.01 and abs(a['size'] - b0['size']) < 0.01, f'{what} is as it was after the reload', {'before': b0, 'after': a})
        real = [e for e in errors if not any(s in e for s in ('WebSocket', 'ERR_CONNECTION', '502', 'favicon'))]
        check(not real, 'no page errors', '; '.join(real[:3]))

        if not A.no_other_engines:
            print('OTHER ENGINES: the same gesture where the game runs')
            for name in ('firefox', 'webkit'):
                try: br = await getattr(p, name).launch(headless=True)
                except Exception as e: note(f'{name}: Playwright cannot launch it here ({str(e).splitlines()[0][:110]}): not tested'); continue
                try:
                    pg = await tab(link.replace('&nofx', '') + '&nofx', br)
                    if not await ready(pg, 60000): note(f'{name}: the game did not come up in headless {name} on this machine: not tested'); await br.close(); continue
                    await pg.wait_for_timeout(4000)
                    hb = await handle(pg, ids['tok'])
                    if not hb: note(f'{name}: no raise / lower button for the second seat\'s pawn: not tested'); await br.close(); continue
                    dy = (3 - hb['y0']) * hb['ppf']
                    await pg.mouse.move(hb['x'], hb['y']); await pg.mouse.down()
                    for i in range(1, 11): await pg.mouse.move(hb['x'], hb['y'] - dy * i / 10); await pg.wait_for_timeout(40)
                    await pg.mouse.move(hb['x'], -200); await pg.wait_for_timeout(60); m_ = await pg.evaluate('tw.ringDrag()'); await pg.mouse.up(); await pg.wait_for_timeout(1500)
                    try: await gm.wait_for_function(f"Math.abs((tw.entities()['{ids['tok']}'].y || 0) - {m_['y']}) < 0.3", timeout=8000)
                    except Exception: pass
                    a, g_ = await pg.evaluate(SEEN + f"('{ids['tok']}')"), await gm.evaluate(SEEN + f"('{ids['tok']}')")
                    check(abs(a['y'] - m_['y']) < 0.3 and abs(g_['y'] - m_['y']) < 0.3, f'{name}: a pawn raised and released outside the window stays up, and the GM tab (Chromium) sees it', {'here': a, 'gm': g_, 'preview': m_['y']})
                except Exception as e: check(False, f'{name}: the gesture ran', str(e).splitlines()[0][:160])
                await br.close()
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'browser lift endings: {passed}/{len(results)} passed')
    for ok_, name in results:
        if not ok_: print(f'  FAILED: {name}')
    return passed == len(results)

try: ok = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
sys.exit(0 if ok else 1)

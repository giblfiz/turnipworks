#!/usr/bin/env python3
"""The speed levers (2026-11-06, the SPEED lane; engine/client/levers.js; docs/PERF.md "Light use on a weak machine").

  local:  python3 engine/test/browser_levers.py --local

A common room with a cellar under it (the underground shows faintly through the ground from above), a pawn, one GM tab
on an ordinary (1x) screen. The governor is driven by a pretended frame time (tw.interact.pretend), so nothing here
depends on how fast this machine is. Each lever is checked ON (the default) and OFF (tw.levers: the code as before):
  DYNRES   far over the target on a 1x screen, the last stage draws the picture at fewer pixels while moving (3/4 each
           way), the same size on screen; at rest the full density again. Off: never under one per CSS pixel (as before)
  EARLY    with Low (no fire shadow, no contact shadows, no fog) the stages that would change nothing are not put on
           trial; off, each is tried and found to buy nothing. The pixel stage is learned (the next move starts with it),
           and kept in this browser for the next visit (tw.governor), for the same graphics chip only
  UNDER    while the hand moves the underground is not drawn (no redraw, nothing shown); a moment after it stops it is
           drawn again and fades back in to its setting. Off: redrawn every moving frame, as before
  STILL    the picture at rest, at one frozen instant, after all of it, is the picture before any of it (pixel for pixel)
  ERRORS   no page errors
"""
import argparse, asyncio, io, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # throwaway campaigns: deleted from the relay when this exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '17641,17642').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-levers-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
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
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
INFO = "tw.interact.info()"
W = "tw.worldOf(tw.area())"
UNDER = f"(() => {{ const w = {W}; return {{ shown: w.underShown || 0, draws: w.underDraws || 0, skipped: w.underSkipped || 0 }}; }})()"
CANVAS = "[document.getElementById('c').width, document.getElementById('c').height]"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1000, 'height': 700}, device_scale_factor=1)
        gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', f"TEST levers {time.strftime('%m-%d %H:%M:%S')} (throwaway)"); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        url = gm.url
        rid = await gm.evaluate("tw.spawnRoom('common', 0, 0, 6, 5, 6401)"); await wait(gm, f"!!tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 20000)
        cid = await gm.evaluate("tw.spawnRoom('cellar', 0, 0, 6, 5, 6402, undefined, -10)"); await wait(gm, f"!!tw.entities()['{cid}'] && tw.sync.pendingCount() === 0", 20000)
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_levers0001', name: 'Hand', x: 12.5, z: 12.5 })")
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(15, 0, 12.5); g.pitch = 58; g.yaw = 0; g.dist = 70; g.update(); tw.main.rule = 'free'; })()")
        await wait(gm, f"tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && {W}.settler.pending() === 0", 90000, 'settled'); await gm.wait_for_timeout(1500)
        await gm.evaluate("tw.interactForce = true")
        async def rest(ms=1300): await gm.mouse.move(5, 5); await gm.wait_for_timeout(ms)
        async def pan(n=80, hold=None):
            await gm.mouse.move(500, 350); await gm.mouse.down(button='right')
            for i in range(n): await gm.mouse.move(500 + (i % 30) * 5, 350 + (i % 20) * 3); await gm.wait_for_timeout(20)
            r = await gm.evaluate(hold) if hold else None
            await gm.mouse.up(button='right'); return r
        async def levers(v): await gm.evaluate(f"(() => {{ tw.levers = {v}; tw.interact.reset(); try {{ localStorage.removeItem('tw.governor'); }} catch (e) {{}} }})()")

        # ================= STILL (before) =================
        # (one instant, the same both times; the fog off for both, its fluid has a history a frozen clock does not stop)
        await gm.evaluate("tw.settings.setPref('fogFx', false)"); await gm.wait_for_timeout(500)
        await gm.evaluate("tw.frozenAt = 1e6"); await gm.wait_for_timeout(600)
        still0 = await gm.screenshot(); await gm.evaluate("tw.frozenAt = null; tw.settings.setPref('fogFx', true)")
        STATE = f"(() => {{ const w = {W}, fx = w.fx; return {{ pr: tw.gfx.renderer.getPixelRatio(), c: {CANVAS}, shed: {INFO}.shed, sh: fx.lighting.shedding, every: fx.atmos.shedEvery, nap: w.napPx || 0, under: w.underShown || 0 }}; }})()"
        s0 = await gm.evaluate(STATE)

        # ================= DYNRES =================
        print('DYNRES: fewer pixels while moving, on a 1x screen too')
        heavy = "tw.interact.pretend((shed) => 70 - 9 * shed.length)"  # (every stage buys 9 ms of a 70 ms frame: all five are needed)
        await levers('{}'); await gm.evaluate(heavy)
        c0 = await gm.evaluate(CANVAS)
        mid = await pan(110, f"({{ i: {INFO}, c: {CANVAS}, css: [document.getElementById('c').clientWidth, document.getElementById('c').clientHeight] }})")
        await rest(); c1 = await gm.evaluate(CANVAS)
        check(c0 == [1000, 700] and 'pixels' in mid['i']['shed'] and mid['c'] == [750, 525] and mid['css'] == [1000, 700], 'far over the target on a 1x screen: the picture is drawn at 3/4 of its pixels each way while moving, the same size on screen', f"{c0} -> {mid['c']} (css {mid['css']}), shed {mid['i']['shed']}")
        check(c1 == c0 and not (await gm.evaluate(f"{INFO}.shed")), 'and at its full density again when the hand stops', c1)
        await levers('{ dynres: false }'); await gm.evaluate(heavy)
        mid = await pan(110, f"({{ i: {INFO}, c: {CANVAS} }})"); await rest()
        check('pixels' not in mid['i']['shed'] and mid['c'] == [1000, 700], 'dynres off: never under one per CSS pixel (as before)', f"{mid['c']}, shed {mid['i']['shed']}")

        # ================= EARLY =================
        print('EARLY: no trials for what would change nothing; the pixel stage learned and kept')
        await gm.evaluate("tw.settings.setGfx('low')"); await gm.wait_for_timeout(900)
        await levers('{}'); await gm.evaluate(heavy)
        LOG = "((t) => tw.interact.state.log.filter(l => l[0] >= t))"
        t0 = await gm.evaluate('performance.now()'); g = await pan(110, INFO); await rest()
        tried = {l[2] for l in await gm.evaluate(LOG, t0) if l[1] in ('shed', 'no gain', 'kept')}
        check(not (tried & {'shadow-still', 'contact-shadows', 'fog-half'}) and 'small-things' in tried and 'pixels' in g['shed'], 'Low: the fire shadow, contact shadows and the fog are never put on trial (already off); small things and pixels are', sorted(tried))
        await levers('{ early: false }'); await gm.evaluate(heavy)
        t0 = await gm.evaluate('performance.now()'); g2 = await pan(110, INFO); await rest()
        tried2 = {l[2] for l in await gm.evaluate(LOG, t0) if l[1] in ('shed', 'no gain', 'kept')}
        check({'shadow-still', 'contact-shadows'} <= tried2, 'early off: each is tried, as before', sorted(tried2))
        await gm.evaluate("tw.settings.setGfx('high')"); await gm.wait_for_timeout(900)
        await levers('{}'); await gm.evaluate(heavy)
        await pan(110); await rest()
        i1 = await gm.evaluate(INFO)
        check('pixels' in i1['learned'], 'the pixel stage is learned like the others', i1['learned'])
        first = await pan(4, f"({{ i: {INFO}, c: {CANVAS} }})"); await rest()
        check('pixels' in first['i']['shed'] and first['c'][0] < 1000, 'so the next move STARTS with fewer pixels (not 2 s into it)', f"{first['c']} {first['i']['shed']}")
        kept = await gm.evaluate("JSON.parse(localStorage.getItem('tw.governor') || 'null')")
        check(kept and 'pixels' in kept.get('learned', []) and kept.get('chip'), "what this machine's moves needed is kept in this browser (tw.governor), with the graphics chip", kept and kept.get('learned'))
        g2p = await ctx.new_page(); g2p.on('pageerror', lambda e: errors.append(f'pageerror (2nd tab): {e}'))
        await g2p.goto(url); await wait(g2p, 'window.tw && tw.ready && tw.ready()', 45000)
        await g2p.evaluate("tw.interactForce = true; tw.interact.pretend((shed) => 70 - 9 * shed.length)"); await g2p.wait_for_timeout(1500)
        await g2p.mouse.move(500, 350); await g2p.mouse.down(button='right')
        for i in range(4): await g2p.mouse.move(510 + i * 5, 352); await g2p.wait_for_timeout(25)
        v2 = await g2p.evaluate(INFO); await g2p.mouse.up(button='right')
        check('pixels' in v2['shed'] and 'small-things' in v2['shed'], "the next visit's first move starts where this machine's last one ended", v2['shed'])
        await g2p.evaluate("(() => { const k = JSON.parse(localStorage.getItem('tw.governor') || 'null') || { learned: ['pixels'], at: Date.now() }; k.chip = 'some other chip'; localStorage.setItem('tw.governor', JSON.stringify(k)); })()")
        await g2p.reload(); await wait(g2p, 'window.tw && tw.ready && tw.ready()', 45000)
        check((await g2p.evaluate(f"{INFO}.kept")) is None, 'kept for the same graphics chip only (another chip starts from nothing)')
        await g2p.close()
        # the very first move of a picture that is already slow standing still starts lean (a fresh browser: nothing kept)
        c4 = await browser.new_context(viewport={'width': 1000, 'height': 700}); fp = await c4.new_page(); fp.on('pageerror', lambda e: errors.append(f'pageerror (fresh): {e}'))
        await fp.goto(url); await wait(fp, 'window.tw && tw.ready && tw.ready()', 45000)
        await fp.evaluate("tw.interactForce = true; tw.interact.pretend(70)"); await fp.wait_for_timeout(2500)
        await fp.mouse.move(500, 350); await fp.mouse.down(button='right')
        for i in range(3): await fp.mouse.move(510 + i * 5, 352); await fp.wait_for_timeout(25)
        v4 = await fp.evaluate(f"({{ i: {INFO}, log: tw.interact.state.log.slice() }})"); await fp.mouse.up(button='right')
        check(any(l[1] == 'start lean' for l in v4['log']) and 'pixels' in v4['i']['shed'] and 'small-things' in v4['i']['shed'], 'a picture already twice the target standing still: its very first move starts lean, fewer pixels and all', v4['i']['shed'])
        await c4.close()
        await gm.evaluate("tw.interact.pretend(null)")

        # ================= UNDER =================
        print('UNDER: the underground left out while the hand moves')
        await levers('{}'); await rest(1500)
        u0 = await gm.evaluate(UNDER)
        check(u0['shown'] > 0.15, 'at rest the cellar shows faintly through the ground', u0)
        mid = await pan(40, UNDER)
        check(mid['shown'] == 0 and mid['skipped'] > u0['skipped'] and mid['draws'] <= u0['draws'] + 1, 'while the hand moves it is not drawn and not shown', mid)
        await gm.mouse.move(5, 5); await gm.wait_for_timeout(450); fading = await gm.evaluate(UNDER); await gm.wait_for_timeout(900); back = await gm.evaluate(UNDER)
        check(back['shown'] > 0.19 and back['draws'] > mid['draws'] and 0 < fading['shown'] < back['shown'] + 1e-9, 'a moment after it stops it is drawn again and fades back in to its setting', f"{fading['shown']:.3f} -> {back['shown']:.3f}")
        await levers('{ underMove: false }'); await rest(800)
        b0 = await gm.evaluate(UNDER); mid2 = await pan(40, UNDER); await rest()
        check(mid2['shown'] > 0.15 and mid2['draws'] - b0['draws'] > 10, 'underMove off: drawn again every moving frame (as before)', f"{mid2['draws'] - b0['draws']} redraws")

        # ================= STILL (after) =================
        await levers('{}'); await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(15, 0, 12.5); g.pitch = 58; g.yaw = 0; g.dist = 70; g.update(); tw.main.rule = 'free'; })()"); await rest(2000)
        s1 = await gm.evaluate(STATE)
        check(s1 == s0, 'STILL: at rest every switch is where it was before any move (density, buffers, shadow, contact shadows, fog, small things, underground)', f'{s0} / {s1}')
        await gm.evaluate("tw.settings.setPref('fogFx', false)"); await gm.wait_for_timeout(500)
        await gm.evaluate("tw.frozenAt = 1e6"); await gm.wait_for_timeout(600)
        still1 = await gm.screenshot(); await gm.evaluate("tw.frozenAt = null; tw.settings.setPref('fogFx', true)")
        from PIL import Image, ImageChops
        a, b = Image.open(io.BytesIO(still0)).convert('RGB'), Image.open(io.BytesIO(still1)).convert('RGB')
        a, b = a.crop((240, 60, a.size[0], a.size[1])), b.crop((240, 60, b.size[0], b.size[1]))  # (the picture, not the page: the levels rail on the left comes and goes with what was clicked)
        diff = ImageChops.difference(a, b); bbox = diff.getbbox(); n = sum(1 for px in diff.getdata() if max(px) > 8)
        check(n < a.size[0] * a.size[1] * 0.005, 'STILL: the picture at rest, at one frozen instant, is the picture before any of it (flames aside: their particles have a history)', f'{n} pixels differ by more than 8 (bbox {bbox})')
        if n >= a.size[0] * a.size[1] * 0.005: print('    (at 100,350 now:', await gm.evaluate("(() => { const e = document.elementFromPoint(100, 350); return e && (e.id || e.className || e.tagName) + ' < ' + (e.parentElement?.id || e.parentElement?.className); })()"), ')')
        if os.environ.get('TW_LEVERS_SHOTS'): a.save(os.path.join(os.environ['TW_LEVERS_SHOTS'], 'still0.png')); b.save(os.path.join(os.environ['TW_LEVERS_SHOTS'], 'still1.png'))

        # ================= AUTO =================
        print('AUTO: frames slower than the whole measurement are still measured')
        c3 = await browser.new_context(viewport={'width': 1000, 'height': 700}); ap_ = await c3.new_page(); ap_.on('pageerror', lambda e: errors.append(f'pageerror (auto): {e}'))
        await ap_.goto(url); await wait(ap_, 'window.tw && tw.ready && tw.ready() && tw.loaded()', 45000)
        await wait(ap_, f"tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && {W}.settler.pending() === 0", 60000, 'settled')
        # (every frame made to take 300 ms: Auto's 20 frames thrown away after a change would take 6 s, more than its 4 s)
        await ap_.evaluate("(() => { tw.on((w) => { if (w === 'frame') { const t = performance.now(); while (performance.now() - t < 300) ; } }); tw.gfxForce = true; tw.gfx.restartAuto(); })()")
        ok_ = await wait(ap_, "tw.gfx.info().auto.done", 60000, 'Auto done')
        au = await ap_.evaluate("tw.gfx.info().auto")
        check(ok_ and au['last'] and (au['last'].get('ms') or 0) > 250, 'Auto measures frames slower than its whole measurement (it found ~300 ms; before it caught no frame and called that "not slow")', au['last'])
        check(au.get('note') == 'not-graphics', 'and, since stepping down bought nothing (the time is not the picture), it put the preset back and stopped', au)
        await c3.close()
        c5 = await browser.new_context(viewport={'width': 1000, 'height': 700}); a5 = await c5.new_page(); a5.on('pageerror', lambda e: errors.append(f'pageerror (auto 2): {e}'))
        await a5.goto(url); await wait(a5, 'window.tw && tw.ready && tw.ready() && tw.loaded()', 45000)
        await a5.evaluate("(() => { tw.gfxForce = true; tw.gfx.pretend((p) => ({ ms: p === 'high' ? 133 : p === 'medium' ? 117 : 60 })); tw.gfx.restartAuto(); })()")
        ok5 = await wait(a5, "tw.gfx.info().auto.done", 60000, 'Auto done (2)')
        a5i = await a5.evaluate("({ pick: tw.settings.prefs().gfxAuto, note: tw.gfx.info().auto.note })")
        check(ok5 and a5i['pick'] == 'low', "the front web server's caves: High 133 ms, Medium 117 (not the 10% asked), Low 60: Auto tries the second step and keeps Low (before: High put back, 'not the picture')", a5i)
        await c5.close()

        check(not errors, 'no page errors', str(errors[:3]))
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    import shutil
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\n{len(results) - len(bad)}/{len(results)} passed" + (f"; FAILED: {[b[1] for b in bad]}" if bad else ''))
sys.exit(1 if bad else 0)

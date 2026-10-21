#!/usr/bin/env python3
"""Task H: command-bar multi-pick and session-only last-list recall.

Run through tw-slot with --local or --page https://turnipworks.net/play.
Real mouse/keyboard interactions; isolated GM and player contexts; throwaway campaign cleanup.
"""
import argparse, asyncio, atexit, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--shots')
A = ap.parse_args()
if not A.local and not A.page: ap.error('choose --local or --page URL')
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
@atexit.register
def _cleanup():
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
    for pr in procs:
        try: pr.wait(timeout=5)
        except subprocess.TimeoutExpired: pr.kill(); pr.wait()
    procs.clear()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)   # the throwaway campaign lives here: nothing is left behind

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18179,18809').split(','))  # TW_PORTS=18167,18797 when another worktree is running this suite
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-bar-picks-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

UA = {'User-Agent': 'tw-figs-test'}
def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def view(pg, x, z, dist=110, pitch=58, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; tw.main.glide = null; }})()")
    await pg.wait_for_timeout(250)
TOKENS = "Object.values(tw.entities()).filter(e => e.kind === 'token')"
OBJECTS = "Object.values(tw.entities()).filter(e => e.kind === 'object')"
PICKED = '#results .res.picked'
PAWNS = '#results .res[data-pick-kind=pawn]'
PROPS = '#results .res[data-pick-kind=object]'

async def bar(pg, text):
    if not await pg.locator('#bar').evaluate("e => e.classList.contains('open')"):
        await pg.keyboard.press('/')
    await pg.locator('#bar input').fill(text)
    await pg.wait_for_timeout(180)

async def closed(pg):
    for _ in range(3):
        await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(100)

async def undo(pg, expr, count):
    await pg.keyboard.press('Control+z')
    return await wait(pg, f'{expr}.length === {count} && tw.sync.pendingCount() === 0')

async def drag_row(pg, row, mods=(), cancel=None):
    await row.scroll_into_view_if_needed()
    box = await row.bounding_box()
    a = {'x': box['x'] + box['width'] / 2, 'y': box['y'] + box['height'] / 2}
    b = {'x': 1100, 'y': 650}
    for mod in mods: await pg.keyboard.down(mod)
    await pg.mouse.move(a['x'], a['y']); await pg.mouse.down()
    for i in range(1, 13):
        await pg.mouse.move(a['x'] + (b['x'] - a['x']) * i / 12, a['y'] + (b['y'] - a['y']) * i / 12)
        await pg.wait_for_timeout(20)
    await pg.wait_for_timeout(200)
    check(await pg.evaluate("!!tw.mode && tw.mode.kind === 'place'"), 'drag shows a placement ghost')
    check(not await pg.locator('#toolCursor').is_visible(), 'group uses one placement label without duplicate cursor badge')
    if A.shots:
        await wait(pg, "tw.mode.pick.members.every(m => m.kind !== 'pawn' || !m.fig || m.ghost.children[0]?.userData.loaded)", 30000, 'group figure silhouettes loaded')
        await pg.screenshot(path=os.path.join(A.shots, 'bar-group-preview-' + str(len(results)) + '.png'))
    if cancel == 'escape': await pg.keyboard.press('Escape')
    elif cancel == 'outside':
        box = await pg.locator('#bar input').bounding_box()
        await pg.mouse.move(box['x'] + 20, box['y'] + 10)
    await pg.mouse.up()
    for mod in mods: await pg.keyboard.up(mod)
    await pg.wait_for_timeout(400)

async def snapshot(pg):
    return await pg.evaluate("""(() => { const l = document.querySelector('#results'); return {
      titles: [...l.querySelectorAll('.res .t')].map(e => e.textContent),
      hi: l.querySelector('.res.hi')?.dataset.i, scroll: l.scrollTop,
      value: document.querySelector('#bar input').value
    }; })()""")

async def main():
    url = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL,
            '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1400, 'height': 900})
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
            await pg.goto(url)
            return pg
        gm = await tab(url)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', f"TEST bar picks {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready?.()', 60000), 'GM ready')
        await gm.evaluate("tw.setVisibility('open')")
        await bar(gm, 'invite Mira'); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden")
        invite = await gm.locator('#output textarea').input_value()
        await closed(gm)
        player = await tab(invite + '&nofx&nointro')
        check(await wait(player, 'window.tw && tw.ready?.()', 60000), 'second seat ready')
        await view(gm, 0, 0, 110, 70)
        await gm.evaluate("tw.settings.setPref('pawnSnap', 'always')")
        await bar(gm, 'orc')
        n = await gm.locator(PAWNS).count()
        check(n >= 5, 'orc search offers five different figure rows', n)
        for i in range(5): await gm.locator(PAWNS).nth(i).click(modifiers=['Shift'])
        check(await gm.locator(PICKED).count() == 5, 'Shift-click checks five rows without placing')
        check(await gm.locator('.pick-count').inner_text() == '5 picked', 'five-picked count is visible')
        check(await gm.evaluate(f'{TOKENS}.length') == 0, 'picking does not create pawns')
        seq = await gm.evaluate('tw.seq()')
        if A.shots:
            os.makedirs(A.shots, exist_ok=True)
            await gm.screenshot(path=os.path.join(A.shots, 'bar-five-picked.png'))
        await drag_row(gm, gm.locator(PICKED).nth(2))
        check(await wait(gm, f'{TOKENS}.length === 5 && tw.sync.pendingCount() === 0'), 'one drag places five pawns')
        ts = await gm.evaluate(TOKENS)
        check(len({t.get('fig') for t in ts}) == 5, 'all five chosen figures are distinct')
        check(len({(t['x'], t['z']) for t in ts}) == 5, 'five pawns occupy different free squares')
        check(all(t['x'] % 5 == 2.5 and t['z'] % 5 == 2.5 for t in ts), 'always-snap group lands on square centres')
        check(await gm.evaluate('tw.seq()') == seq + 1, 'whole drop is one logged command')
        check(await wait(player, f'{TOKENS}.length === 5'), 'second seat sees all five')
        check(await undo(gm, TOKENS, 0), 'one undo removes all five')
        check(await wait(player, f'{TOKENS}.length === 0'), 'second seat sees the single undo')

        await bar(gm, 'orc')
        await gm.locator(PAWNS).nth(0).hover()
        await gm.locator('#bar input').focus()
        await gm.keyboard.press('Shift+Enter'); await gm.keyboard.press('ArrowDown'); await gm.keyboard.press('Shift+Space')
        check(await gm.locator(PICKED).count() == 2, 'Shift+Enter and Shift+Space pick by keyboard')
        await gm.locator(PICKED).first.click(modifiers=['Control'])
        check(await gm.locator(PICKED).count() == 1, 'Ctrl-click toggles one picked row off')
        await gm.keyboard.press('Escape')
        check(await gm.locator(PICKED).count() == 0 and await gm.locator('#bar').evaluate("e => e.classList.contains('open')"), 'Esc clears picks and keeps the list available')
        await gm.locator(PAWNS).nth(0).click(modifiers=['Shift'])
        await gm.locator(PAWNS).nth(1).click()
        check(await gm.evaluate('!!tw.mode') and await gm.locator(PICKED).count() == 0, 'plain click clears the pick and starts one-row placement')
        await closed(gm)

        await bar(gm, '6 goblins')
        await gm.locator(PAWNS).first.click(modifiers=['Shift'])
        check(await gm.locator('.pick-count').inner_text() == '6 picked', 'counted row contributes six to the pick')
        await gm.locator('#bar input').focus(); await gm.keyboard.press('Enter')
        check(await gm.evaluate("tw.mode?.kind === 'place'"), 'Enter arms the picked group')
        await gm.mouse.move(1100, 650); await gm.wait_for_timeout(150); await gm.mouse.click(1100, 650)
        check(await wait(gm, f'{TOKENS}.length === 6 && tw.sync.pendingCount() === 0'), 'counted group places six goblins')
        check(await undo(gm, TOKENS, 0), 'six counted pawns undo together')

        await bar(gm, 'orc'); await gm.locator(PAWNS).first.click(modifiers=['Shift'])
        await gm.locator('#bar input').fill('cup'); await gm.wait_for_timeout(180)
        await gm.locator(PROPS).first.click(modifiers=['Shift'])
        check(await gm.locator('.pick-count').inner_text() == '2 picked', 'figures and objects can share a pick across searches')
        await gm.locator('[data-pick-place]').click()
        await gm.mouse.move(1100, 650); await gm.wait_for_timeout(150); await gm.mouse.click(1100, 650)
        check(await wait(gm, f'{TOKENS}.length === 1 && {OBJECTS}.length === 1 && tw.sync.pendingCount() === 0'), 'mixed group places pawn and cup')
        check(await wait(player, f'{TOKENS}.length === 1 && {OBJECTS}.length === 1'), 'second seat sees the mixed group')
        check(await undo(gm, TOKENS, 0) and await gm.evaluate(f'{OBJECTS}.length') == 0, 'one undo removes both kinds')

        # A mixed existing cluster is deliberately left at the same drop point.
        await bar(gm, 'orc'); await gm.locator(PAWNS).first.click(modifiers=['Shift'])
        await gm.locator('#bar input').fill('cup'); await gm.wait_for_timeout(180)
        await gm.locator(PROPS).first.click(modifiers=['Shift'])
        await gm.locator('[data-pick-place]').click()
        await gm.mouse.move(1100, 650); await gm.wait_for_timeout(150); await gm.mouse.click(1100, 650)
        await wait(gm, f'{TOKENS}.length === 1 && {OBJECTS}.length === 1 && tw.sync.pendingCount() === 0')
        blockers = await gm.evaluate("Object.values(tw.entities()).filter(e => ['token','object'].includes(e.kind)).map(e => e.id)")
        await bar(gm, 'owlbear'); await gm.locator(PAWNS).first.click(modifiers=['Shift'])
        await gm.locator('#bar input').fill('orc'); await gm.wait_for_timeout(180)
        await gm.locator(PAWNS).first.click(modifiers=['Shift'])
        await drag_row(gm, gm.locator(PICKED).first)
        check(await wait(gm, f'{TOKENS}.length === 3 && {OBJECTS}.length === 1 && tw.sync.pendingCount() === 0'), 'large/small pick places beside existing pawn and object')
        occupied = await gm.evaluate("""(() => {
          const cells = new Set(); let overlaps = 0;
          for (const e of Object.values(tw.entities()).filter(e => ['token','object'].includes(e.kind))) {
            const w = e.kind === 'token' ? (e.size || 1) * 5 : e.dims[0];
            const d = e.kind === 'token' ? (e.size || 1) * 5 : e.dims[2];
            for (let x = Math.floor((e.x-w/2+.001)/5); x <= Math.floor((e.x+w/2-.001)/5); x++)
              for (let z = Math.floor((e.z-d/2+.001)/5); z <= Math.floor((e.z+d/2-.001)/5); z++) {
                const k = `${x}:${z}`; if (cells.has(k)) overlaps++; cells.add(k);
              }
          }
          return overlaps;
        })()""")
        check(occupied == 0, 'cluster avoids every prior and new occupied footprint', occupied)
        large = await gm.evaluate(f"{TOKENS}.find(t => t.size === 2)")
        check(large and large['x'] % 5 == 0 and large['z'] % 5 == 0, 'large picked pawn snaps to a four-square crossing')
        check(await undo(gm, TOKENS, 1), 'undo removes new cluster and preserves old pawn')
        check(await gm.evaluate('(ids) => ids.every(id => tw.entities()[id])', blockers), 'old pawn and object both survive group undo')
        check(await undo(gm, TOKENS, 0) and await gm.evaluate(f'{OBJECTS}.length') == 0, 'original mixed blockers undo together')

        for how in ('escape', 'outside'):
            await bar(gm, 'orc')
            for i in range(2): await gm.locator(PAWNS).nth(i).click(modifiers=['Shift'])
            await drag_row(gm, gm.locator(PICKED).first, cancel=how)
            check(await gm.evaluate(f'!tw.mode && {TOKENS}.length === 0'), f'{how} during drag cancels without placing')
            if how == 'escape': check(await gm.locator(PICKED).count() == 0, 'Escape during drag clears the pick')
            await closed(gm)

        for snap_pref, held, snapped in (('always', True, False), ('shift', False, False), ('shift', True, True)):
            await gm.evaluate('(mode) => tw.settings.setPref("pawnSnap", mode)', snap_pref)
            await bar(gm, 'orc')
            for i in range(2): await gm.locator(PAWNS).nth(i).click(modifiers=['Shift'])
            await drag_row(gm, gm.locator(PICKED).first, mods=['Shift'] if held else [])
            await wait(gm, f'{TOKENS}.length === 2 && tw.sync.pendingCount() === 0')
            ts = await gm.evaluate(TOKENS)
            on_grid = all(t['x'] % 5 == 2.5 and t['z'] % 5 == 2.5 for t in ts)
            check(len(ts) == 2 and on_grid == snapped, f'group snap preference {snap_pref}, Shift {held}', [(t['x'], t['z']) for t in ts])
            check(await undo(gm, TOKENS, 0), 'snap-rule group is one undo')

        await bar(gm, 'orc')
        await gm.locator(PAWNS).first.click(modifiers=['Shift'])
        await gm.locator('#bar input').focus()
        for _ in range(6): await gm.keyboard.press('ArrowDown')
        await gm.keyboard.press('Escape')  # clear the pick first; second Escape closes the list
        await gm.locator('#results').evaluate('e => e.scrollTop = 120')
        before = await snapshot(gm)
        await gm.keyboard.press('Escape')
        check(not await gm.locator('#bar').evaluate("e => e.classList.contains('open')"), 'Escape closes the prior list')
        await gm.keyboard.press('/')
        after = await snapshot(gm)
        check(after['value'] == '', 'reopening starts with empty text')
        check(after['titles'] == before['titles'], 'reopening preserves previous result list')
        check(after['hi'] == before['hi'], 'reopening preserves highlighted row')
        check(abs(after['scroll'] - before['scroll']) < 2, 'reopening preserves list scroll', [before['scroll'], after['scroll']])
        check(await gm.locator('.bar-last').inner_text() == 'last: orc', 'recalled query is labelled subtly')
        check(await gm.locator(PICKED).count() == 0, 'multi-pick is not carried over')
        await gm.keyboard.type('owlbear')
        after_type = await snapshot(gm)
        check(after_type['titles'] != before['titles'] and any('Owlbear' in s for s in after_type['titles']), 'typing replaces the recalled list')
        await closed(gm)
        await gm.reload(); check(await wait(gm, 'window.tw && tw.ready?.()', 60000), 'reload rejoins campaign')
        await gm.keyboard.press('/')
        check(not await gm.locator('.bar-last').is_visible(), 'reload resets last-list recall')
        check(await gm.locator('#bar input').input_value() == '', 'reload keeps empty input')
        check(not errors, 'no page errors', errors[:4])
        await browser.close()

try:
    asyncio.run(main())
finally:
    _cleanup()
bad = [r for r in results if not r[0]]
print(f'\nbar picks: {len(results) - len(bad)}/{len(results)} passed')
sys.exit(1 if bad else 0)

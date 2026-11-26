#!/usr/bin/env python3
"""No native drag-and-drop from the table, in Firefox (streetfix, 2026-11-07). Harry on dev: "when I click an object and
then try to drag it, I end up grabbing like an image of the whole screen? this seems to be a firefox issue? and sometimes
it goes away? doesn't happen with the buttons."

The cause: a text selection on the page that takes in the table's canvas (a triple-click, a drag-select run on past a
panel's edge, select-all). Firefox treats a press inside a selection as the start of a native drag of that selection,
and from the canvas the drag ghost is the whole full-window canvas; the thing under the pointer never moves. A plain click
that collapses the selection was the "sometimes goes away". The fix (client/input.js, style.css #c): a press on the table
drops any page selection, the canvas is user-select none, and a native dragstart from the canvas, from an image not marked
draggable, or carrying the canvas, is cancelled. Checked here:
  ghost     with the whole page selected, click an object then drag it: no native drag starts (a dragstart that is not
            cancelled), and the object moves
  press     the same with no click first (press straight on the selected object and drag)
  icons     a drag that starts on a launcher icon (an <img>) is cancelled (it would steal the pointer the same way)
  marquee   a box-select drag on empty floor with the page selected: no native drag
  kept      dragging selected text out of the command bar's input is still the browser's own text drag
The legit drag-and-drop the app has, dropping FILES on the page, is engine/test/browser_uploads.py and the share suite
(window dragover/drop: never a dragstart on this page).

  local:  python3 engine/test/browser_ghostdrag.py --local
  (Firefox needs a display for WebGL: with no DISPLAY the suite starts its own Xvfb and stops it by PID)
"""
import argparse, asyncio, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--browser', default='firefox')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
procs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '19571,19572').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-ghost-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500'
def display():
    """Firefox draws WebGL only with a display: use $DISPLAY, else start a private Xvfb (killed by PID at the end)."""
    if os.environ.get('DISPLAY') or A.browser != 'firefox': return {}
    if not shutil.which('Xvfb'): return {}
    for n in range(171, 199):
        if not os.path.exists(f'/tmp/.X11-unix/X{n}') and not os.path.exists(f'/tmp/.X{n}-lock'):
            procs.append(subprocess.Popen(['Xvfb', f':{n}', '-screen', '0', '1600x1000x24'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
            for _ in range(50):
                time.sleep(0.1)
                if os.path.exists(f'/tmp/.X11-unix/X{n}'): break
            return {'DISPLAY': f':{n}', 'LIBGL_ALWAYS_SOFTWARE': '1'}
    return {}
sys.path.insert(0, os.path.join(HERE, '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()
# every dragstart on the page, and whether it was cancelled once every handler had run (a bubbling listener on window, the last to see it)
LOG = """(() => { window.__drags = []; window.addEventListener('dragstart', (e) => window.__drags.push({ t: e.target?.id || e.target?.tagName || e.target?.nodeName, cancelled: e.defaultPrevented }), false); })()"""
LIVE = "window.__drags.filter(d => !d.cancelled)"
SELECT_ALL = "(() => { getSelection().selectAllChildren(document.body); return !getSelection().isCollapsed && getSelection().getRangeAt(0).intersectsNode(document.getElementById('c')); })()"

async def main():
    env = display()
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500'
    async with async_playwright() as p:
        if A.browser == 'firefox':
            browser = await p.firefox.launch(headless=False, env={**os.environ, **env}, firefox_user_prefs={'webgl.force-enabled': True, 'webgl.disabled': False}) if env or os.environ.get('DISPLAY') else await p.firefox.launch(headless=True)
        else:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 820})
        gm = await ctx.new_page()
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await gm.goto(page + '&nointro')
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST ghostdrag ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        try: await gm.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000); live = True
        except Exception: live = False
        check(live, f'GM tab live in {A.browser} (WebGL drew)', '' if live else await gm.evaluate("document.body.innerText.slice(0, 160)"))
        if not live: return
        await gm.add_style_tag(content='#linkMail{display:none!important}')
        await gm.evaluate("tw.spawnRoom('common', 0, 0, 6, 4, 4242)")
        await gm.wait_for_function("Object.values(tw.entities()).some(e => e.cat === 'settle')", timeout=15000)
        await gm.wait_for_timeout(8000)
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(15, 0, 10); g.pitch = 60; g.yaw = 0; g.dist = 45; g.update(); tw.main.rule = 'free'; })()")
        await gm.wait_for_timeout(1500)
        await gm.evaluate(LOG)
        sid = await gm.evaluate("Object.values(tw.entities()).find(e => e.cat === 'settle').id")
        at = lambda: gm.evaluate(f"(() => {{ const e = tw.entities()['{sid}']; return [e.x, e.z]; }})()")
        async def spot():
            e = await gm.evaluate(f"(() => {{ const e = tw.entities()['{sid}']; return [e.x, e.z, e.y || 0]; }})()")
            return await gm.evaluate(f"tw.screenOf({e[0]}, {e[1]}, tw.main, {e[2] + 0.5})")
        async def drag_from(s, dx=110, dy=40):
            await gm.mouse.move(s['x'] + 6, s['y'] + 2); await gm.mouse.down()
            for i in range(1, 15): await gm.mouse.move(s['x'] + 6 + dx * i / 14, s['y'] + 2 + dy * i / 14); await gm.wait_for_timeout(30)
            await gm.mouse.up(); await gm.wait_for_timeout(500)

        print('GHOST: the page selected (select-all), click the settle, then drag it')
        check(await gm.evaluate(SELECT_ALL), 'the page selection takes in the table canvas (the state that made the ghost)')
        s = await spot(); await gm.mouse.click(s['x'], s['y']); await gm.wait_for_timeout(600)
        check(sid in await gm.evaluate("[...tw.sel]"), 'the click selects the settle')
        await gm.evaluate(SELECT_ALL)  # (and selected again after the click: a selection made after selecting the object)
        n0 = len(await gm.evaluate(LIVE)); p0 = await at()
        await drag_from(await spot())
        ghosts = (await gm.evaluate(LIVE))[n0:]
        check(not ghosts, 'no native drag starts: no ghost picture of the table', ghosts)
        p1 = await at(); far = lambda a, b: ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5 > 2
        check(far(p0, p1), 'the settle moves with the pointer (more than 2 ft: the drag, not a twitch before a native drag took over)', f'{p0} -> {p1}')

        print('PRESS: the page selected, press straight on the (selected) settle and drag')
        await gm.evaluate(SELECT_ALL); n0 = len(await gm.evaluate(LIVE))
        await drag_from(await spot(), -90, 30)
        ghosts = (await gm.evaluate(LIVE))[n0:]; p2 = await at()
        check(not ghosts, 'no native drag on a press inside the selection', ghosts)
        check(far(p1, p2), 'the settle moves again', f'{p1} -> {p2}')
        check(await gm.evaluate("getSelection().isCollapsed"), 'the press on the table dropped the page selection')

        print('MARQUEE: the page selected, a box-select drag on empty floor')
        await gm.keyboard.press('Escape'); await gm.evaluate(SELECT_ALL); n0 = len(await gm.evaluate(LIVE))
        await gm.mouse.move(1150, 760); await gm.mouse.down()
        for i in range(1, 12): await gm.mouse.move(1150 - i * 12, 760 - i * 8); await gm.wait_for_timeout(25)
        await gm.mouse.up(); await gm.wait_for_timeout(300)
        ghosts = (await gm.evaluate(LIVE))[n0:]; check(not ghosts, 'no native drag from a box-select', ghosts)

        print('ICONS: a drag that starts on a launcher icon')
        icon = await gm.evaluate("(() => { const i = [...document.querySelectorAll('img')].find(i => i.offsetParent && i.getBoundingClientRect().width > 20); if (!i) return null; const r = i.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()")
        if icon:
            n0 = len(await gm.evaluate(LIVE)); seen0 = len(await gm.evaluate("window.__drags"))
            await gm.mouse.move(icon['x'], icon['y']); await gm.mouse.down()
            for i in range(1, 12): await gm.mouse.move(icon['x'] + i * 9, icon['y'] + i * 7); await gm.wait_for_timeout(25)
            await gm.mouse.up(); await gm.wait_for_timeout(300)
            ghosts = (await gm.evaluate(LIVE))[n0:]
            check(not ghosts, 'a drag from a launcher icon is no native image drag', ghosts)
            for _ in range(3):
                if not await gm.evaluate("!!tw.mode || tw.build?.isOpen"): break
                await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
        else: check(False, 'a launcher icon to drag from')

        print('KEPT: dragging selected text out of the command bar input is the browser\'s own text drag')
        inp = '#bar textarea' if await gm.evaluate("!!document.querySelector('#bar textarea')?.offsetParent") else None
        if inp:
            await gm.click(inp); await gm.fill(inp, 'dragthiswordplease'); await gm.evaluate(f"document.querySelector('{inp}').select()"); await gm.wait_for_timeout(200)
            box = await gm.locator(inp).bounding_box()
            seen0 = len(await gm.evaluate("window.__drags"))
            await gm.mouse.move(box['x'] + 30, box['y'] + box['height'] / 2); await gm.mouse.down()
            for i in range(1, 12): await gm.mouse.move(box['x'] + 30 + i * 10, box['y'] + box['height'] / 2 + i * 12); await gm.wait_for_timeout(25)
            await gm.mouse.up(); await gm.wait_for_timeout(300)
            d = (await gm.evaluate("window.__drags"))[seen0:]
            check(not d or not any(x['cancelled'] for x in d), 'a text drag from an input is never cancelled', d or '(this browser started none: nothing to cancel)')
            await gm.fill(inp, ''); await gm.keyboard.press('Escape')
        else: check(False, 'a text input on the page to drag text out of')
        check(not errors, 'no page errors', errors[:3])
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.kill()
        except Exception: pass
n = sum(1 for r in results if not r[0])
print(f"\n{len(results) - n}/{len(results)} passed"); sys.exit(1 if n or not results else 0)

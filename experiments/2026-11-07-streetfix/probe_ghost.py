#!/usr/bin/env python3
"""Probe: Firefox, click an object then drag it; log dragstart / selection / what moved (streetfix lane, 2026-11-07)."""
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
RP, SP = 19577, 19578
BROWSER = sys.argv[1] if len(sys.argv) > 1 else 'firefox'
procs = []
def start():
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
LOG = """(() => { window.__ev = []; const L = (t) => (e) => window.__ev.push([t, e.target?.id || e.target?.tagName || String(e.target), String(getSelection()).slice(0, 60), getSelection().rangeCount, getSelection().isCollapsed]);
  for (const t of ['dragstart', 'drag', 'dragend', 'selectstart']) document.addEventListener(t, L(t), true);
  document.addEventListener('pointerdown', L('pointerdown'), true); document.addEventListener('pointerup', L('pointerup'), true); })()"""
async def main():
    page = start()
    async with async_playwright() as p:
        b = await (p.firefox.launch(headless=not os.environ.get('DISPLAY'), firefox_user_prefs={'webgl.force-enabled': True, 'webgl.disabled': False, 'webgl.enable-webgl2': True}) if BROWSER == 'firefox' else p.chromium.launch(headless=True, args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']))
        pg = await (await b.new_context(viewport={'width': 1280, 'height': 820})).new_page()
        pg.on('pageerror', lambda e: print('pageerror', e)); pg.on('console', lambda m: print('console', m.type, m.text[:300]) if m.type in ('error', 'warning') else None)
        await pg.goto(page + '&nointro')
        await pg.fill('#newCampaign input[name=gm]', 'Harry'); await pg.fill('#newCampaign input[name=name]', 'TEST ghost (throwaway)'); await pg.click('#newCampaign button')
        try: await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
        except Exception:
            await pg.screenshot(path='/mnt/usb/turnip-works/lanes-2026-11-07/streetfix/ff-notready.png'); print('not ready', await pg.evaluate("[!!window.tw, document.title, document.body.innerText.slice(0, 400)]")); raise
        rid = await pg.evaluate("tw.spawnRoom('common', 0, 0, 6, 4, 4242)")
        await pg.wait_for_timeout(9000)
        await pg.evaluate("(() => { const g = tw.main.grab; g.focus.set(15, 0, 10); g.pitch = 60; g.yaw = 0; g.dist = 45; g.update(); tw.main.rule = 'free'; })()")
        await pg.wait_for_timeout(1500)
        objs = await pg.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'object' && !e.flat && e.place === 'floor' && e.dims && e.dims[0] > 1.5).map(e => ({ id: e.id, cat: e.cat, x: e.x, z: e.z, y: e.y || 0 }))")
        print(len(objs), 'objects')
        await pg.evaluate(LOG)
        settle = [o for o in objs if o['cat'] == 'settle'][0]
        async def seldrag(tag):
            s = await pg.evaluate(f"tw.screenOf({settle['x']}, {settle['z']}, tw.main, {settle['y'] + 0.5})")
            n0 = await pg.evaluate("window.__ev.filter(e => e[0] === 'dragstart').length")
            await pg.mouse.click(s['x'], s['y']); await pg.wait_for_timeout(600)
            sel = await pg.evaluate("[...tw.sel]"); pre = sel and await pg.evaluate(f"(() => {{ const e = tw.entities()['{sel[0]}']; return [e.x, e.z]; }})()")
            st = await pg.evaluate("[String(getSelection()).slice(0, 80), getSelection().rangeCount, getSelection().isCollapsed, getSelection().rangeCount && getSelection().getRangeAt(0).intersectsNode(document.getElementById('c'))]")
            await pg.mouse.move(s['x'] + 6, s['y'] + 2); await pg.mouse.down()
            for i in range(1, 15): await pg.mouse.move(s['x'] + i * 8, s['y'] + i * 3); await pg.wait_for_timeout(30)
            await pg.mouse.up(); await pg.wait_for_timeout(500)
            post = sel and await pg.evaluate(f"(() => {{ const e = tw.entities()['{sel[0]}']; return [e.x, e.z]; }})()")
            ds = await pg.evaluate(f"window.__ev.filter(e => e[0] === 'dragstart').slice({n0})")
            print(tag, '| selection before drag:', st, '| moved:', pre != post, pre, post, '| dragstarts:', ds)
            # put it back
            if sel and pre != post: await pg.evaluate("tw.undo && tw.undo()")
        s0 = await pg.evaluate(f"tw.screenOf({settle['x']}, {settle['z']}, tw.main, {settle['y'] + 0.5})")
        await pg.mouse.click(s0['x'], s0['y']); await pg.wait_for_timeout(800)
        print('at point:', await pg.evaluate(f"document.elementsFromPoint({s0['x']}, {s0['y']}).map(e => e.tagName + '#' + e.id + '.' + e.className).slice(0, 6)"))
        print('visible overlays:', await pg.evaluate('''[...document.querySelectorAll('body *')].filter(e => e.offsetParent && getComputedStyle(e).pointerEvents !== 'none' && e.id !== 'c').map(e => { const r = e.getBoundingClientRect(); return r.width * r.height > 0 && r.width < 1280 ? [e.tagName, e.id, String(e.className).slice(0, 30), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), e.draggable, getComputedStyle(e).userSelect] : null; }).filter(Boolean).filter(r => r[0] === 'IMG' || r[0] === 'CANVAS' || r[0] === 'svg' || r[0] === 'A').slice(0, 30)'''))
        print('canvas/body user-select:', await pg.evaluate("[getComputedStyle(document.getElementById('c')).userSelect, getComputedStyle(document.body).userSelect, document.getElementById('c').draggable]"))
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        await seldrag('A plain')
        async def rawdrag(tag, x, y, dx=80, dy=30):
            n0 = await pg.evaluate("window.__ev.filter(e => e[0] === 'dragstart').length")
            await pg.mouse.move(x, y); await pg.mouse.down()
            for i in range(1, 15): await pg.mouse.move(x + dx * i / 14, y + dy * i / 14); await pg.wait_for_timeout(30)
            await pg.mouse.up(); await pg.wait_for_timeout(400)
            print(tag, 'dragstarts:', await pg.evaluate(f"window.__ev.filter(e => e[0] === 'dragstart').slice({n0})"), 'selection:', await pg.evaluate("[String(getSelection()).slice(0, 80), getSelection().isCollapsed, getSelection().rangeCount && getSelection().getRangeAt(0).intersectsNode(document.getElementById('c'))]"))
        await rawdrag('launcher img', 62, 41)
        st = await pg.evaluate("(() => { const all = [...document.querySelectorAll('body *')].filter(e => e.offsetParent && e.children.length === 0 && e.textContent.trim().length > 6 && getComputedStyle(e).userSelect !== 'none'); const e = all.find(e => /live|build|Area/.test(e.textContent)) || all[0]; const r = e.getBoundingClientRect(); return [e.tagName, e.className, e.textContent.trim().slice(0, 30), r.x, r.y, r.width, r.height]; })()")
        print('text target', st)
        await rawdrag('across text', st[3] + 2, st[4] + st[6] / 2, max(20, st[5] - 4), 0)
        await pg.evaluate("getSelection().selectAllChildren(document.body)")
        print('select-all (programmatic):', await pg.evaluate("[getSelection().isCollapsed, getSelection().getRangeAt(0).intersectsNode(document.getElementById('c'))]"))
        await seldrag('F with everything selected')
        await pg.evaluate("getSelection().removeAllRanges()")
        await seldrag('G selection cleared again')
        return
        await seldrag('A2 after label drag')
        # B: a marquee across the view (crossing the room's label and the HUD) first
        labs = await pg.evaluate("[...document.querySelectorAll('.rlabel')].filter(l => l.offsetParent).map(l => { const r = l.getBoundingClientRect(); return [l.textContent.trim().slice(0, 20), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })")
        print('labels', labs)
        await pg.mouse.move(300, 760); await pg.mouse.down()
        for i in range(1, 25): await pg.mouse.move(300 + i * 35, 760 - i * 28); await pg.wait_for_timeout(25)
        await pg.mouse.up(); await pg.wait_for_timeout(400)
        print('after marquee selection:', await pg.evaluate("[String(getSelection()).slice(0, 120), getSelection().rangeCount, getSelection().isCollapsed]"))
        await seldrag('B after marquee')
        await pg.mouse.dblclick(640, 700); await pg.wait_for_timeout(400)
        print('after dblclick selection:', await pg.evaluate("[String(getSelection()).slice(0, 120), getSelection().rangeCount, getSelection().isCollapsed]"))
        await seldrag('C after dblclick')
        s1 = await pg.evaluate(f"tw.screenOf({settle['x']}, {settle['z']}, tw.main, {settle['y'] + 0.5})")
        await pg.mouse.click(s1['x'], s1['y'], click_count=3); await pg.wait_for_timeout(400)
        print('after triple click selection:', await pg.evaluate("[String(getSelection()).slice(0, 120), getSelection().rangeCount, getSelection().isCollapsed, getSelection().rangeCount && getSelection().getRangeAt(0).intersectsNode(document.getElementById('c'))]"))
        await seldrag('E after triple click')
        await pg.keyboard.press('Escape'); await pg.mouse.click(1200, 500); await pg.wait_for_timeout(300)
        await pg.keyboard.press('Control+a'); await pg.wait_for_timeout(300)
        print('after ctrl+a selection:', await pg.evaluate("[String(getSelection()).slice(0, 120), getSelection().rangeCount, getSelection().isCollapsed]"))
        await seldrag('D after ctrl+a')
        await b.close()
try: asyncio.run(main())
finally:
    for pr in procs: pr.kill()

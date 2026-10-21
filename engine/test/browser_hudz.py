#!/usr/bin/env python3
"""The ring under the HUD, and L for labels (Harry 2026-10-20).

Z: the selection ring is drawn under every camera-locked piece of UI ("the ones that are entirely camera locked, like
menus and the quickbar") and over the world's labels. With a zoomed-in room's ring button moved under the command bar,
the Build launcher, the level meter, the avatar, the chat log, the crumbs and the PiP's frame, `elementFromPoint` there
must be the UI, and a click goes to the UI. The table itself: engine/client/style.css ":root z-order".
L: room and building labels off and on for this browser (view.labels); typing an l in the command bar does nothing to
them; with only lightable things selected L is still Light / Put out.

  local:  TW_GPU=1 python3 engine/test/browser_hudz.py --local
  stills: --shots DIR  (a zoomed-in room ring under the top bar)
"""
import argparse, asyncio, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaign this suite makes is a throwaway

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--shots')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

procs = []; tmpdirs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18990,18991').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-hudz-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmpdirs.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500&nointro'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=60); return True
    except Exception: print(f'    (timed out: {what or js[:100]})'); return False

# PLACE: pan the camera (heading, tilt and zoom kept) until ring button `id`'s centre is at (px, py); returns the node
PLACE = """async ([id, px, py]) => { const g = tw.main.grab, sleep = (ms) => new Promise(r => setTimeout(r, ms)), node = () => tw.ringNodes().find(n => n.id === id); let last = 0;
  for (let i = 0, k = 1; i < 24; i++) { const n = node(); if (!n) return null; const ex = n.x - px, ey = n.y - py, d = Math.hypot(ex, ey); if (d < 2) break;
    if (i && d > last) k *= 0.5; last = d;  // (the screen is not linear in the ground: a step that overshoots is halved)
    const p0 = tw.screenOf(g.focus.x, g.focus.z), p1 = tw.screenOf(g.focus.x + 1, g.focus.z), p2 = tw.screenOf(g.focus.x, g.focus.z + 1);
    const a11 = p1.x - p0.x, a12 = p2.x - p0.x, a21 = p1.y - p0.y, a22 = p2.y - p0.y, det = a11 * a22 - a12 * a21; if (!det) break;
    g.focus.x += k * (a22 * ex - a12 * ey) / det; g.focus.z += k * (-a21 * ex + a11 * ey) / det; tw.main.rule = 'free'; g.update(); await sleep(140); }
  await sleep(200); return node(); }"""
# what is on top at a point, and is a ring button's box under it at all
TOP = """([px, py, id]) => { const t = document.elementFromPoint(px, py), b = [...document.querySelectorAll('#ring .rbtn')].find(b => b.dataset.cmd === id || (!b.dataset.cmd && id === 'menu'));
  const r = b?.getBoundingClientRect(), under = !!r && px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
  return { top: t ? (t.id || t.closest('[id]')?.id || t.tagName) + (t.className && typeof t.className === 'string' ? '.' + t.className.split(' ')[0] : '') : null, ring: !!t?.closest('#ring'), under, z: t ? getComputedStyle(t.closest('#app > *') || t).zIndex : null, hud: !!t && !t.closest('#ring') && +getComputedStyle(t.closest('#app > *') || t).zIndex > +getComputedStyle(document.getElementById('ring')).zIndex }; }"""

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500&nointro'
    GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}, reduced_motion='reduce')
        gm = await ctx.new_page()
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        gm.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' else None)
        await gm.goto(page)
        NAME = f"TEST hudz {time.strftime('%m-%d %H:%M:%S')} (throwaway)"
        await gm.fill('#newCampaign input[name=name]', NAME); await gm.fill('#newCampaign input[name=gm]', 'Fauna-test'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 60000), 'GM tab live', NAME)
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
        await wait(gm, "tw.sync.campaign.defaults.fogOfWar === false && tw.sync.pendingCount() === 0", 15000, 'open table')
        await gm.evaluate("tw.setLabels(true)")
        await gm.evaluate("tw.buildAt(tw.buildingNode('inn'), 12, 8, { seed: 7 })")
        built = await wait(gm, "Object.values(tw.entities()).filter(e => e.kind === 'room').length >= 6 && Object.values(tw.entities()).some(e => e.kind === 'building') && tw.sync.pendingCount() === 0", 60000, 'inn built')
        await wait(gm, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", 60000, 'spawn over'); await gm.wait_for_timeout(400)
        bid = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'building').id")
        room = await gm.evaluate("(() => { const rs = Object.values(tw.entities()).filter(e => e.kind === 'room' && (e.y || 0) === 0); rs.sort((a, b) => b.recipe.w * b.recipe.d - a.recipe.w * a.recipe.d); return rs[0].id; })()")
        bx, bz = await gm.evaluate(f"(() => {{ const r = tw.entities()['{room}'].recipe; return [(r.x + r.w / 2) * 5, (r.z + r.d / 2) * 5]; }})()")
        await gm.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({bx}, 0, {bz}); g.pitch = 55; g.yaw = 0; g.dist = 70; g.update(); tw.main.rule = 'free'; }})()")
        await gm.wait_for_timeout(700)
        check(built, 'an inn: a building and its rooms', f'{bid} · room {room}')

        print('L: room and building labels off and on (this browser)')
        on0 = await gm.evaluate("(() => { const li = tw.labelInfo(); return { rooms: li.filter(l => l.kind === 'room' && l.visible).length, blds: li.filter(l => l.kind === 'building' && l.visible).length }; })()")
        check(on0['rooms'] >= 2 and on0['blds'] >= 1, 'to start with, room labels and the building label are shown', on0)
        await gm.mouse.move(640, 600); await gm.keyboard.press('l'); await gm.wait_for_timeout(500)
        off = await gm.evaluate("({ on: tw.labelsOn(), shown: tw.labelInfo().filter(l => l.visible).length, drawn: [...document.querySelectorAll('#labels .rlabel')].filter(el => el.getBoundingClientRect().width && +getComputedStyle(el).opacity > 0.05).length, stored: localStorage.getItem('tw.labels') })")
        check(not off['on'] and off['shown'] == 0 and off['drawn'] == 0 and off['stored'] == 'off', 'L: every room and building label goes (and the browser remembers it)', off)
        await gm.keyboard.press('/'); await gm.keyboard.type('hall', delay=10); await gm.wait_for_timeout(300)
        typed = await gm.evaluate("({ on: tw.labelsOn(), value: document.querySelector('#bar input').value })")
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        check(not typed['on'] and typed['value'] == 'hall', 'typing "hall" in the command bar puts the l\'s in the bar and leaves the labels alone', typed)
        await gm.keyboard.press('l'); await gm.wait_for_timeout(600)
        back = await gm.evaluate("(() => { const li = tw.labelInfo(); return { on: tw.labelsOn(), rooms: li.filter(l => l.kind === 'room' && l.visible).length, blds: li.filter(l => l.kind === 'building' && l.visible).length }; })()")
        check(back['on'] and back['rooms'] == on0['rooms'] and back['blds'] == on0['blds'], 'L again: they come back, the same ones', back)
        await gm.keyboard.press('/'); await gm.keyboard.type('labels', delay=10); await gm.wait_for_timeout(350)
        row = await gm.evaluate("[...document.querySelectorAll('#results .res')].map(e => e.innerText.replace(/\\s+/g, ' ')).find(t => /room labels/i.test(t)) || null")
        await gm.keyboard.press('Escape')
        check(row and 'L' in row.split(), 'the bar\'s "Hide room labels" row shows its key, L', row)
        await gm.evaluate("tw.emit('sheet.toggle')"); await gm.wait_for_timeout(200)
        sheet = await gm.evaluate("[...document.querySelectorAll('#sheet .row')].map(r => r.innerText.replace(/\\s+/g, ' ')).filter(t => /labels|Light/.test(t))")
        await gm.evaluate("document.getElementById('sheet').hidden = true")
        check(any('labels' in s and s.strip().endswith('L') for s in sheet), 'the "?" sheet lists L for the labels', sheet)
        # O is "change this thing's state" (Harry 2026-10-20): Open / Close an openable, Light / Put out a light; L stays the labels
        both = await gm.evaluate("(() => { const L = tw.assets.lib?.objects || {}; return Object.keys(L).filter(c => tw.assets.openable(c) && tw.assets.lightable(c)); })()")
        print(f'    (catalogue entries both openable and lightable: {both})')
        lamp = await gm.evaluate("(() => { const o = Object.values(tw.entities()).find(e => e.kind === 'object' && tw.assets.lightable(e.cat) && !tw.assets.openable(e.cat) && !e.locked && (e.y || 0) < 5); return o ? { id: o.id, lit: o.lit !== false } : null; })()")
        door = await gm.evaluate("(() => { const o = Object.values(tw.entities()).find(e => e.kind === 'object' && tw.assets.openable(e.cat) && !tw.assets.lightable(e.cat) && !e.locked && tw.canOpen(e) && (e.y || 0) < 5); return o ? { id: o.id, open: !!o.open } : null; })()")
        check(lamp and door, 'the inn has a light and a door to try O on', {'lamp': lamp, 'door': door})
        if lamp and door:
            st = lambda: gm.evaluate(f"({{ lit: tw.entities()['{lamp['id']}'].lit !== false, open: !!tw.entities()['{door['id']}'].open, on: tw.labelsOn() }})")
            await gm.evaluate(f"tw.select(['{lamp['id']}'])"); await gm.wait_for_timeout(300); await gm.mouse.move(640, 600)
            await gm.keyboard.press('l'); await gm.wait_for_timeout(400); s1 = await st()
            check(s1['lit'] == lamp['lit'] and not s1['on'], 'with a candle selected, L still hides the labels and leaves the candle as it was', s1)
            await gm.keyboard.press('l'); await gm.wait_for_timeout(300)
            await gm.keyboard.press('o'); await wait(gm, f"(tw.entities()['{lamp['id']}'].lit !== false) !== {str(lamp['lit']).lower()} && tw.sync.pendingCount() === 0", 4000); s2 = await st()
            check(s2['lit'] != lamp['lit'] and s2['on'], 'O lights (or puts out) the selected candle', s2)
            await gm.keyboard.press('/'); await gm.keyboard.type('lo', delay=10); await gm.wait_for_timeout(300); s3 = await st()
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
            check(s3 == s2, 'typing "lo" in the command bar: no labels change, no light', s3)
            await gm.evaluate(f"tw.select(['{door['id']}'])"); await gm.wait_for_timeout(300); await gm.mouse.move(640, 600)
            await gm.keyboard.press('o'); await wait(gm, f"!!tw.entities()['{door['id']}'].open !== {str(door['open']).lower()} && tw.sync.pendingCount() === 0", 4000); s4 = await st()
            check(s4['open'] != door['open'] and s4['lit'] == s2['lit'], 'O opens (or shuts) the selected door', s4)
            await gm.keyboard.press('/'); await gm.keyboard.type('o', delay=10); await gm.wait_for_timeout(300); s5 = await st()
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
            check(s5 == s4, 'typing "o" in the bar with the door selected does not open it', s5)
            await gm.evaluate(f"tw.select(['{door['id']}', '{lamp['id']}'])"); await gm.wait_for_timeout(300); await gm.mouse.move(640, 600)
            await gm.keyboard.press('o'); await gm.wait_for_timeout(500); s6 = await st()
            print(f'    (door + candle selected, O: {s4} -> {s6})')
            await gm.evaluate("tw.select([])")
        print('Z: a zoomed-in room ring under the camera-locked UI')
        await gm.evaluate(f"tw.select(['{room}'])"); await gm.wait_for_timeout(500)
        await gm.evaluate(f"(() => {{ const g = tw.main.grab; g.dist = 34; g.pitch = 55; g.update(); }})()"); await gm.wait_for_timeout(600)
        nodes = await gm.evaluate("tw.ringNodes()")
        btn = max(nodes, key=lambda n: n['size'])['id'] if nodes else None
        check(nodes and max(n['size'] for n in nodes) >= 60, 'zoomed in, the room\'s ring buttons are big', [(n['id'], round(n['size'])) for n in nodes])
        # the PiP: open one so its frame (title bar, swap, close) is on screen
        await gm.evaluate("tw.openPip(tw.area())"); await gm.wait_for_timeout(500)
        targets = {
            'command bar': ('#bar', "(() => { const r = document.querySelector('#bar').getBoundingClientRect(); return [r.left + r.width * 0.3, r.top + r.height / 2]; })()"),
            'Build launcher': ('#launchers', "(() => { const b = document.querySelector('#launchers [data-l=\"build\"]') || document.querySelector('#launchers > *'); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()"),
            'level meter': ('#levelMeter', "(() => { const r = document.querySelector('#levelMeter').getBoundingClientRect(); return [r.left + 9, r.top + r.height * 0.4]; })()"),
            'avatar (roster)': ('#roster', "(() => { const b = document.querySelector('#roster > *'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()"),
            'chat log': ('#chat', "(() => { const r = document.querySelector('#chat').getBoundingClientRect(); return [r.left + r.width / 2, r.bottom - 10]; })()"),
            'crumbs': ('#crumbs', "(() => { const c = document.querySelector('#crumbs'); if (c.hidden) return null; const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()"),
            'PiP frame bar': ('#pipFrame', "(() => { const c = document.querySelector('#pipFrame'); if (c.hidden) return null; const r = c.querySelector('.bar').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()"),
        }
        for nm, (sel, js) in targets.items():
            pt = await gm.evaluate(js)
            if not pt: check(False, f'{nm}: on screen to test', sel); continue
            low = nm in ('chat log', 'PiP frame bar')  # (low on the screen: the ring's lowest button, so its centre stays on screen)
            use = await gm.evaluate("(() => { const ns = tw.ringNodes(); ns.sort((a, b) => b.y - a.y); return ns[0].id; })()") if low else btn
            n = await gm.evaluate(PLACE, [use, pt[0], pt[1]])
            r = await gm.evaluate(TOP, [pt[0], pt[1], use])
            hit = await gm.evaluate(f"!!document.elementFromPoint({pt[0]}, {pt[1]})?.closest('{sel}')")
            # (the crumbs and the area pills under the bar overlap each other: either is the UI winning)
            check(r['under'] and not r['ring'] and (hit or r['hud']), f'{nm}: a ring button lies under it, and the {nm} is what is there (it gets the click)', {**r, 'button': n and [round(n['x']), round(n['y'])], 'at': [round(pt[0]), round(pt[1])]})
            if A.shots and nm in ('command bar', 'chat log', 'PiP frame bar'):
                os.makedirs(A.shots, exist_ok=True); await gm.screenshot(path=os.path.join(A.shots, 'ring-under-' + nm.split()[0].lower() + '.png'))
        # a click there goes to the UI: the bar opens, the room ring button does not fire
        pt = await gm.evaluate(targets['command bar'][1]); await gm.evaluate(PLACE, [btn, pt[0], pt[1]])
        rect0 = await gm.evaluate(f"JSON.stringify(tw.entities()['{room}'].recipe)")
        await gm.mouse.click(pt[0], pt[1]); await gm.wait_for_timeout(400)
        clk = await gm.evaluate(f"({{ open: document.querySelector('#bar').classList.contains('open') || document.activeElement === document.querySelector('#bar input'), same: JSON.stringify(tw.entities()['{room}'].recipe) === {rect0!r} }})")
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        check(clk['open'] and clk['same'], 'clicking the bar where a ring button lies under it opens the bar; the room is untouched', clk)
        # the ring still covers the world's labels: a room label under a ring button is under it
        cov = await gm.evaluate("""(() => { for (const b of document.querySelectorAll('#ring .rbtn')) { const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
            for (const el of document.querySelectorAll('#labels .rlabel.on')) { const q = el.getBoundingClientRect(); if (x > q.left && x < q.right && y > q.top && y < q.bottom) return { over: true, top: !!document.elementFromPoint(x, y)?.closest('#ring') }; } }
            const z = (s) => +getComputedStyle(document.querySelector(s)).zIndex; return { over: false, ring: z('#ring'), labels: z('#labels') }; })()""")
        check(cov.get('top') if cov['over'] else cov['ring'] > cov['labels'], 'the ring stays over the room and building labels', cov)
        # the table: every camera-locked layer above the ring, every world layer under it
        zs = await gm.evaluate("""(() => { const z = (s) => { const el = document.querySelector(s); return el ? +getComputedStyle(el).zIndex : null; };
            const ring = z('#ring'), hud = ['#bar', '#results', '#launchers', '#levelMeter', '#roster', '#areaState', '#chat', '#crumbs', '#pipFrame', '#fpsMeter', '#hud', '#buildMenu', '#pawnsTray', '#whichkey', '#output', '#sheet', '#toast', '#announce', '#followPill', '#areaNone'];
            return { ring, labels: z('#labels'), bubbles: z('#bubbles'), low: hud.filter(s => z(s) !== null && !(z(s) > ring)).map(s => s + ':' + z(s)) }; })()""")
        check(not zs['low'] and zs['labels'] < zs['ring'] and zs['bubbles'] < zs['ring'], 'every camera-locked layer is above the ring; labels and speech bubbles are under it', zs)
        # inside the ring: a hovered button (its name tip) rises over its neighbours; the damage box and readouts over the buttons
        inner = await gm.evaluate("""(() => { const s = (sel) => { for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) if (r.selectorText === sel) return r.style.zIndex; } catch {} } return null; };
            return { hover: s('#ring .rbtn:hover'), dmg: s('#ring > .dmg-edit'), readout: s('#ring .readout'), flyout: s('#ring > .flyout.grid'), names: s('#ring > .rl-label-svg') }; })()""")
        check(inner['hover'] and inner['dmg'] and inner['readout'] and int(inner['hover']) > int(inner['names']) and min(int(inner['dmg']), int(inner['readout'])) > int(inner['hover']), 'inside the ring: names over the buttons, a hovered button over its neighbours, the damage box and readouts over all of them', inner)

        real = [e for e in errors if not any(s in e for s in ('WebSocket', 'ERR_CONNECTION', '502', 'Refused:', 'favicon', 'Failed to load resource'))]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'browser hudz: {passed}/{len(results)} passed')
    for ok_, name, detail in results:
        if not ok_: print(f'  FAILED: {name} — {detail}')
    return passed == len(results)

try: ok = asyncio.run(main())
finally:
    for p in procs:
        try: p.terminate(); p.wait(timeout=5)
        except Exception: pass
    for d in tmpdirs: shutil.rmtree(d, ignore_errors=True)
sys.exit(0 if ok else 1)

#!/usr/bin/env python3
"""The drag track (Harry 2026-10-06, docs/UI.md "The handle's track"): what is drawn while a ring handle is dragged.

  local:  TW_GPU=1 python3 engine/test/browser_track.py --local [--shots]

  SIZE    grab: a track along the handle's ray, a "100%" mark where it was grabbed, ticks; the dot rides it; the readout
          at release is the committed size; a resized thing gets "now" and "catalog size" marks
  LIFT    a vertical track from the floor mark up, a tick per foot, a "lands" mark at the top of the table under it;
          the readout at release is the committed height
  TURN    a circle with the eight 45-degree notches (same strokes), the caught notch heavier; readout = committed turn
  ALL     nothing in a track is hit-testable; gone shortly after release (at once with reduced motion); Esc, a
          cancelled pointer and a blurred window remove it and commit as before; no track without a drag
  PIECE   surfaces/track.js called the way a pawn's HP slider would call it (0, half, max)
"""
import argparse, asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = 18135, 18765
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-track-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro' + ('' if A.shots else '&faces=1500')

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
E = lambda i: f"tw.entities()['{i}']"
# every element under a set of points along the track: is any of them part of a track?
HIT = """(() => { const g = document.querySelector('#ring .rtrack'); if (!g) return null; const pts = []; for (const el of g.querySelectorAll('line, circle, text')) { const r = el.getBoundingClientRect(); pts.push([r.left + r.width / 2, r.top + r.height / 2]); }
  const ro = document.querySelector('#ring .readout'); if (ro) { const r = ro.getBoundingClientRect(); pts.push([r.left + r.width / 2, r.top + r.height / 2]); }
  let bad = 0; for (const [x, y] of pts) for (const el of document.elementsFromPoint(x, y)) if (el.closest?.('.rtrack') || el.classList?.contains('readout')) bad++;
  return { n: pts.length, bad, pe: getComputedStyle(g).pointerEvents, peLine: getComputedStyle(g.querySelector('line')).pointerEvents, peRo: ro ? getComputedStyle(ro).pointerEvents : 'none' }; })()"""
GONE = "!document.querySelector('.rtrack') && !document.querySelector('.rtrack-out') && !document.querySelector('#ring .readout')"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}); gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(str(e)))
        await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST nits track {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        ids = await gm.evaluate("""async () => {
          const rid = 'room_trk' + Math.random().toString(36).slice(2, 8), a = { id: rid, type: 'kitchen', x: 0, z: 0, w: 6, d: 5, seed: 77 };
          await tw.dispatch('room.spawn', { ...a, engineVersion: tw.roomgen.version, layout: tw.roomgen.solve(tw.entities(), a, 1) });
          await new Promise(r => setTimeout(r, 9000));
          const es = Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === rid), riders = (t) => es.filter(c => c.parent === t.id);
          const table = es.filter(e => riders(e).length && e.dims[1] > 2 && e.dims[1] < 4 && e.dims[0] > 3).sort((p, q) => riders(p).length - riders(q).length)[0];
          const floor = es.find(e => e.place === 'floor' && !e.parent && !e.flat && e.dims[1] < 3 && !riders(e).length);
          const rider = riders(table)[0];
          return { floor: floor.id, table: table.id, tableTop: table.dims[1], rider: rider.id, riderY: rider.y || 0 }; }""")
        await wait(gm, "tw.spawningNow().anims === 0 && tw.sync.pendingCount() === 0", 60000, 'settled'); await gm.wait_for_timeout(500)
        check(await gm.evaluate(GONE), 'no drag: no track anywhere')

        async def grab(id, cmd):
            await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
            await gm.evaluate(f"(() => {{ const e = {E(id)}, g = tw.main.grab; g.focus.set(e.x, 0, e.z); g.yaw = 0; g.pitch = 55; g.dist = 34; g.update(); tw.main.rule = 'free'; tw.select('{id}'); }})()")
            await gm.wait_for_timeout(700)
            if not await gm.evaluate(f"!!document.querySelector('#ring [data-cmd=\"{cmd}\"]')"): await gm.click('#ring [data-menu]'); await gm.wait_for_timeout(300)
            b = await gm.evaluate(f"(() => {{ const r = document.querySelector('#ring [data-cmd=\"{cmd}\"]').getBoundingClientRect(); return {{ x: r.left + r.width / 2, y: r.top + r.height / 2 }}; }})()")
            await gm.mouse.move(b['x'], b['y']); await gm.mouse.down(); return b
        async def slide(b, dx, dy, steps=8):
            for i in range(1, steps + 1): await gm.mouse.move(b['x'] + dx * i / steps, b['y'] + dy * i / steps); await gm.wait_for_timeout(30)
            await gm.wait_for_timeout(120)
        STATE = "(() => { const d = tw.ringDrag(); return d && { ...d, readout: document.querySelector('#ring .readout')?.innerText || '', trackEls: document.querySelectorAll('#ring .rtrack').length, handle: (() => { const r = document.querySelector('#ring .active').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })() }; })()"
        dist = lambda a, b: ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
        async def release_and_gone(label):
            await gm.mouse.up(); await gm.wait_for_timeout(40)
            fading = await gm.evaluate("!!document.querySelector('.rtrack-out') && !document.querySelector('#ring .rtrack')")
            ok = await wait(gm, GONE, 1500, 'track gone')
            check(fading and ok, f'{label}: on release the track leaves the ring, fades, and is gone within a moment')
            await wait(gm, 'tw.sync.pendingCount() === 0', 8000)

        # ================= SIZE =================
        print('SIZE: the track along the resize handle')
        b = await grab(ids['floor'], 'edit.resize'); await gm.wait_for_timeout(120)
        s0 = await gm.evaluate(STATE); t = s0['track']
        ux, uy = s0['dir']; base = next((m for m in t['marks'] if m['label'] == '100%'), None)
        check(s0['trackEls'] == 1 and t and base and dist(base['at'], [b['x'], b['y']]) < 14, 'on grab a track appears along the handle\'s ray, with the "100%" mark where the handle was grabbed', str(t and t['marks']) + await gm.evaluate(f"JSON.stringify([{E(ids['floor'])}.dims, {E(ids['floor'])}.cat, {E(ids['floor'])}.sku, tw.roomgen.sizeOf({E(ids['floor'])}.cat, {E(ids['floor'])}.sku)])"))
        along = lambda pt: (pt[0] - s0['centre'][0]) * (-uy) + (pt[1] - s0['centre'][1]) * ux
        check(all(abs(along(k['at'])) < 1.5 for k in t['ticks']) and abs(along(t['ends'][0])) < 1.5 and abs(along(t['ends'][1])) < 1.5 and len(t['ticks']) >= 4 and t['min'] < 0.3 and t['max'] >= 1.25, 'the rail runs from the smallest size (at the centre) to the largest along that ray, with ticks at steps', f"{t['min']:.2f}..{t['max']:.2f}, {len(t['ticks'])} ticks")
        t50 = next((k for k in t['ticks'] if abs(k['v'] - 0.5) < 1e-6), None)
        check(t50 and abs(dist(t50['at'], s0['centre']) - 0.5 * s0['d0']) < 2, 'the 50% tick is half-way from the centre to the grab point')
        await slide(b, ux * 70, uy * 70)
        s1 = await gm.evaluate(STATE); t1 = s1['track']
        check(s1['k'] > 1.2 and dist(t1['knob'], s1['handle']) < 6 and abs(t1['value'] - s1['k']) < 1e-9, 'dragged outward the handle rides the track and the dot marks the size', f"k {s1['k']:.2f}")
        check(re.match(rf"^{round(s1['k'] * 100)}% · ", s1['readout'] or ''), 'the readout by the handle says the size', s1['readout'])
        hit = await gm.evaluate(HIT)
        check(hit and hit['n'] > 6 and hit['bad'] == 0 and hit['pe'] == 'none' and hit['peLine'] == 'none' and hit['peRo'] == 'none', 'nothing in the track or its readout is hit-testable', str(hit))
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'track-size.png'))
        dims0 = await gm.evaluate(f"{E(ids['floor'])}.dims"); await release_and_gone('size')
        await wait(gm, f"Math.abs({E(ids['floor'])}.dims[0] - {dims0[0]}) > 1e-6", 6000, 'resized')
        last = await gm.evaluate('tw.ringDragLast'); dims1 = await gm.evaluate(f"{E(ids['floor'])}.dims")
        check(last['committed'] and abs(dims1[0] / dims0[0] - s1['k']) < 1e-6 and abs(last['value'] - s1['k']) < 1e-9, 'the committed size is the one the readout showed', f"{dims1[0] / dims0[0]:.3f} vs {s1['k']:.3f} ({s1['readout']})")
        b = await grab(ids['floor'], 'edit.resize'); await gm.wait_for_timeout(120); s2 = await gm.evaluate(STATE)
        labs = {m['label']: m for m in s2['track']['marks']}
        check('now' in labs and 'catalog size' in labs and abs(labs['catalog size']['v'] - 1 / s1['k']) < 2e-2 and dist(labs['catalog size']['at'], s2['centre']) < dist(labs['now']['at'], s2['centre']), 'a thing already resized: "now" where it is grabbed and "catalog size" where its original size is', str({k: round(v['v'], 3) for k, v in labs.items()}))
        await slide(b, s2['dir'][0] * 30, s2['dir'][1] * 30); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(60)
        check(await gm.evaluate(GONE) and not (await gm.evaluate('tw.ringDragLast'))['committed'], 'Esc during the drag removes the track at once and changes nothing'); await gm.mouse.up()

        # ================= LIFT =================
        print('LIFT: the vertical track of raise / lower')
        b = await grab(ids['rider'], 'edit.lift'); await gm.wait_for_timeout(120)
        s0 = await gm.evaluate(STATE); t = s0['track']; labs = {m['label']: m for m in t['marks']}
        ppf = await gm.evaluate(f"(() => {{ const e = {E(ids['rider'])}; return Math.max(4, Math.abs(tw.screenOf(e.x, e.z, tw.main, e.y || 0).y - tw.screenOf(e.x, e.z, tw.main, (e.y || 0) + 1).y)); }})()")
        check(t and all(abs(k['at'][0] - b['x']) < 1.5 for k in t['ticks']) and t['ends'][0][1] > t['ends'][1][1], 'on grab a vertical track appears through the handle, the floor at the bottom', str(t['ends']))
        fl = labs.get('floor') or labs.get('ground')
        check(fl and abs(fl['v']) < 1e-6 and abs((fl['at'][1] - b['y']) - ids['riderY'] * ppf) < 2.5, 'the floor mark is as far below the handle as the thing is above the floor', f"{fl and fl['at']} handle {b['y']:.0f} y {ids['riderY']:.2f} ppf {ppf:.1f}")
        check('lands' in labs and abs(labs['lands']['v'] - ids['tableTop']) < 0.15, 'a "lands" mark at the top of the table under it', f"{labs.get('lands')} table top {ids['tableTop']:.2f}")
        feet = [k for k in t['ticks']]
        check(len(feet) >= 5 and all(abs((feet[i]['at'][1] - feet[i + 1]['at'][1]) - (feet[i + 1]['v'] - feet[i]['v']) * ppf) < 1.2 for i in range(len(feet) - 1)) and sum(1 for k in feet if k['major']) >= 2, 'a tick per foot (a longer one every 5 ft), spaced as the thing moves', f'{len(feet)} ticks')
        await slide(b, 2, -3.0 * ppf)
        s1 = await gm.evaluate(STATE); t1 = s1['track']
        check(abs(t1['knob'][1] - s1['handle'][1]) < 4 and abs(s1['y'] - (ids['riderY'] + 3)) < 0.15 and re.match(r'^\d+ ft( \d+ in)? up$', s1['readout'] or ''), 'dragged up 3 ft the dot and the handle are together and the readout gives the height in feet', f"{s1['readout']} (y {s1['y']:.2f})")
        hit = await gm.evaluate(HIT); check(hit and hit['bad'] == 0, 'not hit-testable', str(hit))
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'track-lift.png'))
        await release_and_gone('raise / lower'); await gm.wait_for_timeout(600)
        y1 = await gm.evaluate(f"{E(ids['rider'])}.y || 0"); m = re.match(r'^(\d+) ft(?: (\d+) in)? up$', s1['readout']); shown = int(m.group(1)) + int(m.group(2) or 0) / 12
        check(abs(y1 - s1['y']) < 1e-6 and abs(shown - y1) < 0.05, 'the committed height is the one the readout showed', f'{y1:.3f} vs "{s1["readout"]}"')
        # a cancelled pointer and a blurred window: the track goes; the drag commits what it showed (the 2026-10-05 rule)
        for how, js in (('a cancelled pointer', "document.querySelector('#ring .active').dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }))"), ('a blurred window', "window.dispatchEvent(new Event('blur'))")):
            b = await grab(ids['rider'], 'edit.lift'); await slide(b, 0, -1.0 * ppf); pid = await gm.evaluate("1")
            await gm.evaluate(js.replace('pointerId: 1', 'pointerId: 1')) if 'blur' in js else await gm.evaluate("(() => { const h = document.querySelector('#ring .active'); for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) window.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: id })); })()")
            ok = await wait(gm, GONE + " && !tw.ringDrag()", 1500, how); await gm.mouse.up(); await gm.wait_for_timeout(300)
            check(ok, f'{how} ends the drag and the track goes with it', str(await gm.evaluate('tw.ringDragLast')))

        # ================= TURN =================
        print('TURN: the circle and its notches')
        b = await grab(ids['floor'], 'edit.rotate'); await gm.wait_for_timeout(120)
        s0 = await gm.evaluate(STATE); t = s0['track']; rr = dist([b['x'], b['y']], s0['centre'])
        check(t and s0['ticks'] == 8 and len(t['ticks']) == 8 and all(abs(dist(k['at'], s0['centre']) - rr) < 1.5 for k in t['ticks']) and t['min'] == -180 and t['max'] == 180, 'on grab a circle through the handle appears, with the eight 45° notches on it', f"{s0['ticks']} ticks, r {rr:.0f}")
        vs = sorted(k['v'] for k in t['ticks']); check(all(abs((vs[i + 1] - vs[i]) - 45) < 1e-6 for i in range(7)), 'the notches are 45° apart')
        same = await gm.evaluate("(() => { const a = getComputedStyle(document.querySelector('#ring .rtrack .tick')), r = getComputedStyle(document.querySelector('#ring .rtrack .rail')); return [a.strokeWidth, r.strokeWidth, a.stroke === r.stroke]; })()")
        check(same == ['1.5px', '1.5px', True], 'its notches and rail are drawn with the same strokes as the other two tracks', str(same))
        # drag round the circle by about a quarter turn
        import math
        a0 = math.atan2(b['x'] - s0['centre'][0], -(b['y'] - s0['centre'][1]))
        for i in range(1, 13):
            a = a0 + (math.pi / 2 + 0.02) * i / 12; await gm.mouse.move(s0['centre'][0] + rr * math.sin(a), s0['centre'][1] - rr * math.cos(a)); await gm.wait_for_timeout(30)
        await gm.wait_for_timeout(120); s1 = await gm.evaluate(STATE); t1 = s1['track']
        on = await gm.evaluate("document.querySelectorAll('#ring .guide .tick.on').length")
        check(dist(t1['knob'], s1['handle']) < 8 and abs(abs(t1['value']) - 90) < 4.5 and re.match(r'^-?\d+°', s1['readout'] or '') and (on == 1) == ('◆' in s1['readout']), 'the handle rides the circle; the dot and the readout give the turn; a caught notch is the heavier tick', f"{s1['readout']} · {on} on")
        hit = await gm.evaluate(HIT); check(hit and hit['bad'] == 0, 'not hit-testable', str(hit))
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'track-turn.png'))
        rot0 = await gm.evaluate(f"{E(ids['floor'])}.rot || 0"); await release_and_gone('turn'); await gm.wait_for_timeout(500)
        rot1 = await gm.evaluate(f"{E(ids['floor'])}.rot || 0"); deg = -(rot1 - rot0) * 180 / math.pi
        check(abs(round(deg) - int(re.match(r'^(-?\d+)°', s1['readout']).group(1))) <= 1, 'the committed turn is the one the readout showed', f'{deg:.1f}° vs {s1["readout"]}')
        # a click on the turn handle (no drag): no fade left behind
        b = await grab(ids['floor'], 'edit.rotate'); await gm.mouse.up(); await gm.wait_for_timeout(80)
        check(await gm.evaluate(GONE), 'a click without a drag leaves no track behind')

        # ================= REDUCED MOTION =================
        await gm.emulate_media(reduced_motion='reduce')
        b = await grab(ids['floor'], 'edit.resize'); await slide(b, 20, 0); await gm.mouse.up(); await gm.wait_for_timeout(30)
        check(await gm.evaluate(GONE), 'with reduced motion the track is gone at once on release (no fade)')
        await gm.emulate_media(reduced_motion='no-preference'); await gm.keyboard.press('Escape'); await gm.evaluate("tw.select([])"); await gm.wait_for_timeout(300)

        # ================= THE PIECE, as an HP slider would call it =================
        print('PIECE: makeTrack called for a 0..max value on a line')
        hp = await gm.evaluate("""(() => { const NS = 'http://www.w3.org/2000/svg', layer = document.getElementById('ring'), svg = document.createElementNS(NS, 'svg'); svg.classList.add('guide'); layer.append(svg);
          const max = 24, T = tw.ringTrack(svg, { min: 0, max, value: 17, layer, ticks: Array.from({ length: max + 1 }, (_, i) => i), marks: [{ v: 0, label: '0' }, { v: max / 2, label: 'half' }, { v: max, label: 'max' }], format: (v) => `${Math.round(v)} / ${max} HP`, direction: { from: [500, 400], to: [740, 400] } });
          T.set(9, [590, 400]); const i = T.info(), hit = document.elementsFromPoint(590, 400).some(e => e.closest('.rtrack')), fillD = svg.querySelector('.fill').getAttribute('d');
          T.remove(); const left = !!svg.querySelector('.rtrack') || !!layer.querySelector('.readout'); svg.remove(); return { i, hit, left, fillD }; })()""")
        i = hp['i']; mk = {m['label']: m['at'] for m in i['marks']}
        check(mk == {'0': [500, 400], 'half': [620, 400], 'max': [740, 400]} and len(i['ticks']) == 25 and i['knob'] == [590, 400] and i['text'] == '9 / 24 HP' and i['start'] == 17 and hp['fillD'].startswith('M670 400') and not hp['hit'] and not hp['left'], 'the same piece draws a 0 / half / max track for an HP value: marks in place, the dot at the value, the stretch from the start value, the readout formatted, nothing hit-testable, nothing left after remove()', str({'marks': mk, 'knob': i['knob'], 'text': i['text'], 'fill': hp['fillD']}))
        arc = await gm.evaluate("""(() => { const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); document.body.append(svg); const T = tw.ringTrack(svg, { min: 0, max: 90, value: 0, direction: { centre: [300, 300], radius: 100, zero: 0, per: Math.PI / 180 } }); const r = [T.at(0), T.at(90)]; T.remove(); svg.remove(); return r.map(p => p.map(Math.round)); })()""")
        check(arc == [[300, 200], [400, 300]], 'and an arc: value 0 straight up, 90 to the right', str(arc))

        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
bad = [r for r in results if not r[0]]
print(f"\ntrack: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)

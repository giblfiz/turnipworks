#!/usr/bin/env python3
"""The hand comes first (2026-10-06; engine/client/interact.js; docs/UI.md "Lighter picture while moving").

  local:  TW_GPU=1 python3 engine/test/browser_interaction.py --local

Two small buildings 300 ft apart, a pawn, one GM tab. The governor is driven by a pretended frame time
(tw.interact.pretend), so the checks do not depend on how fast this machine is.
  MOVING   at rest nothing is shed; a pan, a turn, a wheel zoom and a pawn drag (real mouse events) each count as the
           hand moving, and stop counting a moment after
  GOVERNOR under the target nothing is shed; over it, effects are shed one at a time in the fixed order until the
           frame is back under; each is really off (the fire's shadow holds still, the fog steps every second frame,
           the smallest things leave the scene, the contact-shadow pass is skipped); a stage that buys nothing is put
           back; what was needed is remembered for the next move
  RESTORE  a moment after the hand stops everything is back, and contact shadows FADE in (no pop)
  SWITCH   Settings > Me > "Lighter picture while moving" off: nothing is ever shed
  PIXELS   on a 2x screen the last stage draws fewer pixels and puts them back
  YIELDS   while the hand moves no far room is put to sleep and no area picture is taken; a burst of changes is
           applied to the scene once a frame, and a reader still sees every one of them
"""
import argparse, asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = 18143, 18773
def start_local():
    import shutil
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-interact-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
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
async def view(pg, x, z, dist=70, pitch=58, yaw=0, ms=250):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.maxDist = Math.max(g.maxDist, {dist}); g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; tw.main.glide = null; }})()")
    await pg.wait_for_timeout(ms)
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over')
    await pg.wait_for_timeout(300)
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
W = "tw.worldOf(tw.area())"
INFO = "tw.interact.info()"
FX = f"(() => {{ const s = {W}.fx.stats(), a = {W}.fx.atmos; return {{ dance: s.shed_dance, ao: s.shed_ao, aoOn: s.ao_enabled, aoK: s.ao_intensity, fogEvery: a.shedEvery, nap: {W}.napPx || 0, napping: {W}.sleepStats().napping, why: s.shadow_why }}; }})()"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1400, 'height': 900})
        gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); gm.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' and '404' not in m.text and 'Failed to load resource' not in m.text else None)
        await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST interaction {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        R = {}
        for i, (name, typ, x, z, w, d) in enumerate([('a', 'common', 0, 0, 6, 4), ('b', 'kitchen', 60, 0, 4, 4)]):
            rid = f"room_int{name}{random.randrange(10**6):06d}"[:24]
            R[name] = await gm.evaluate(SPAWN, {'id': rid, 'type': typ, 'x': x, 'z': z, 'w': w, 'd': d, 'seed': 6300 + i})
            check(await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 40000, name), f'{name} built')
        await gm.evaluate("tw.interactForce = true; tw.interact.pretend(10)") # (under a test driver the shedding waits to be asked for: interact.js; and until the checks say otherwise the governor believes every frame takes 10 ms, whatever this box is doing)
        await settle(gm); await view(gm, 15, 10, 70)
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_hand000001', name: 'Hand', x: 12.5, z: 27.5 })"); await wait(gm, "tw.entities()['tok_hand000001']", 8000)
        await wait(gm, f"[...{W}.recs.values()].every(r => !r.visual?.userData?.placeholder || !r.entity.url) && {W}.settler.pending() === 0", 60000, 'meshes in, things seated')
        await gm.wait_for_timeout(1500)
        async def rest(ms=700): await gm.mouse.move(5, 5); await gm.wait_for_timeout(ms)
        async def drag(button, n=14, pause=25, hold=None):
            await gm.mouse.move(700, 500); await gm.mouse.down(button=button)
            for i in range(n): await gm.mouse.move(700 + (i + 1) * 9, 500 + i * 2); await gm.wait_for_timeout(pause)
            r = await gm.evaluate(hold) if hold else None
            await gm.mouse.up(button=button); return r

        # ================= MOVING =================
        print('MOVING: what counts as the hand moving')
        i0 = await gm.evaluate(INFO); f0 = await gm.evaluate(FX)
        check(i0['on'] and not i0['active'] and not i0['shed'] and not f0['dance'] and not f0['ao'] and f0['aoOn'] and f0['fogEvery'] == 1 and f0['nap'] == 0, 'at rest: on by default, the hand is not moving, nothing is shed', str(i0['shed']))
        check(abs(i0['target'] - 16.67) < 0.1, 'the target while moving is a 60th of a second', i0['target'])
        await gm.evaluate("tw.interact.reset(); tw.interact.pretend(10)")
        seen = {}
        for name, fn in (('pan', lambda: drag('right', hold=INFO)), ('turn', lambda: drag('middle', hold=INFO))):
            seen[name] = await fn(); await rest(600)
        check(all(seen[k]['active'] and seen[k]['moving'] for k in seen) and seen['pan']['why'] in ('camera', 'button'), 'a pan and a turn with the mouse: the hand is moving', {k: v['why'] for k, v in seen.items()})
        check(not seen['pan']['shed'] and not seen['turn']['shed'], 'frames under the target: nothing is shed (a small map never changes)')
        check(not (await gm.evaluate(INFO))['active'], 'and a moment after the hand stops it no longer counts')
        await gm.mouse.move(700, 450); await gm.mouse.wheel(0, -120); await wait(gm, "tw.interact.info().active", 3000, 'the frame after the wheel'); w1 = await gm.evaluate(INFO); await gm.mouse.wheel(0, 120); await rest(700)
        check(w1['active'], 'a wheel zoom counts', w1['why'])
        s = await gm.evaluate("tw.screenOf(12.5, 27.5, tw.main, 1.5)")
        await gm.mouse.move(s['x'], s['y']); await gm.wait_for_timeout(150); await gm.mouse.down()
        for i in range(10): await gm.mouse.move(s['x'] + (i + 1) * 8, s['y'] + i); await gm.wait_for_timeout(25)
        d1 = await gm.evaluate(f"({{ i: {INFO}, drags: tw.localDrags.size }})"); await gm.mouse.up(); await rest(900)
        check(d1['drags'] >= 1 and d1['i']['active'] and d1['i']['why'] in ('drag', 'button'), 'dragging a pawn counts', d1['i']['why'])
        ip = (await gm.evaluate(INFO))['isInputPending']; ff = os.environ.get('TW_BROWSER', '').lower() in ('firefox', 'webkit')
        check(ip is (not ff), 'this browser can say when input is waiting (isInputPending), so work that can wait gives way to it' if not ff else 'Firefox and Safari have no isInputPending: there, work that can wait only waits for the hand to stop', ip)

        # ================= GOVERNOR =================
        print('GOVERNOR: shed one at a time, in order, only what buys time')
        await gm.evaluate("tw.interact.reset(); tw.interact.pretend((shed) => 40 - 6.5 * shed.length)") # each stage "buys" 6.5 ms of a 40 ms frame
        g = await drag('right', n=70, pause=22, hold=f"({{ i: {INFO}, f: {FX} }})"); await gm.wait_for_timeout(50)
        want = ['shadow-still', 'fog-half', 'small-things', 'contact-shadows']
        check(g['i']['shed'] == want, 'over the target: the fire\'s shadow, the fog, small things, contact shadows, in that order, and no further than needed', str(g['i']['shed']))
        kept = [l[2] for l in g['i']['log'] if l[1] == 'kept']; order = [l[2] for l in g['i']['log'] if l[1] == 'shed']
        check(order[:4] == want and kept[:4] == want, 'each was tried, measured and kept in turn', str(g['i']['log'][-9:]))
        check(g['f']['dance'] and g['f']['fogEvery'] == 2 and g['f']['nap'] > 0 and g['f']['ao'] and not g['f']['aoOn'], 'and each is really off: the shadow holds still, the fog steps every second frame, small things may nap, the contact-shadow pass is skipped', str(g['f']))
        check('pixels' not in g['i']['shed'], 'the pixel stage is not used on a screen of ordinary density')

        # ================= RESTORE =================
        print('RESTORE: back a moment after the hand stops, contact shadows fading in')
        t0 = time.time(); samples = []
        while time.time() - t0 < 1.6: samples.append(await gm.evaluate(f"({{ t: performance.now(), i: {INFO}, f: {FX} }})")); await gm.wait_for_timeout(40)
        back = next((s for s in samples if not s['i']['active']), None); last = samples[-1]
        check(back is not None and not last['i']['shed'] and not last['f']['dance'] and last['f']['fogEvery'] == 1 and last['f']['nap'] == 0 and last['f']['aoOn'], 'everything is back', str(last['i']['shed']))
        ramp = [s['f']['aoK'] for s in samples if s['f']['aoOn']]
        check(len(ramp) > 3 and ramp[0] < ramp[-1] * 0.6 and ramp[-1] > 1 and all(b >= a - 1e-6 for a, b in zip(ramp, ramp[1:])) and any(ramp[0] < k < ramp[-1] for k in ramp), 'contact shadows fade in rather than popping back', f"{ramp[0]} … {ramp[len(ramp) // 2]} … {ramp[-1]}")
        check(last['i']['learned'] == want, 'what was needed is remembered', str(last['i']['learned']))
        d0 = await gm.evaluate(FX); await gm.wait_for_timeout(900); d1 = await gm.evaluate(FX)
        check(d1['why']['dance'] > d0['why']['dance'], 'the fire\'s shadow dances again')
        # the next move starts where the last one ended
        await gm.mouse.move(700, 500); await gm.mouse.down(button='right'); await gm.mouse.move(712, 503); await gm.wait_for_timeout(120)
        nx = await gm.evaluate(INFO); await gm.mouse.up(button='right'); await rest(900)
        check(nx['shed'] == want, 'the next move starts with those already shed (it does not find them again)', str(nx['shed']))
        # time to spare: the next moves start one stage richer each time
        await gm.evaluate("tw.interact.pretend(7)"); seq = []
        for k in range(3): await drag('right', n=22, pause=22); await rest(800); seq.append(len((await gm.evaluate(INFO))['learned']))
        check(seq == [3, 2, 1], 'a move that ends with time to spare gives one stage back for the next (a lighter map is not left short)', str(seq))
        # a stage that buys nothing is put back
        await gm.evaluate("tw.interact.reset(); tw.interact.pretend(40)")
        g = await drag('right', n=70, pause=22, hold=f"({{ i: {INFO}, f: {FX} }})"); await rest(900)
        nog = [l[2] for l in g['i']['log'] if l[1] == 'no gain']
        check(not g['i']['shed'] and set(want) <= set(nog) and g['f']['aoOn'] and not g['f']['dance'], 'a stage that buys no time on this machine is put straight back', f"shed {g['i']['shed']}, no gain: {nog}")

        # ================= small things =================
        print('SMALL THINGS: out of the scene while moving, zoomed far out')
        await gm.evaluate("tw.interact.reset(); tw.interact.pretend((shed) => shed.includes('small-things') ? 15 : 40 - 6.5 * shed.length)")
        thing = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{R['a']}' && e.dims && Math.max(...e.dims) < 1.5).map(e => e.id)")
        await view(gm, 15, 10, 420); await gm.evaluate(f"tw.select('{thing[0]}')" if thing else "1"); await gm.wait_for_timeout(400)
        n = await drag('right', n=60, pause=22, hold=f"(() => {{ const w = {W}; return {{ i: {INFO}, napping: w.sleepStats().napping, out: [...w.recs.values()].filter(r => r.nap).every(r => !r.group.parent), small: {json.dumps(thing)}.map(id => [!!w.recs.get(id).nap, !!w.recs.get(id).group.parent]), pawn: !!w.recs.get('tok_hand000001').group.parent, lights: (() => {{ let n = 0; w.scene.traverse(o => {{ if (o.isLight && o.visible) n++; }}); return n; }})() }}; }})()")
        lights0 = await gm.evaluate(f"(() => {{ let n = 0; {W}.scene.traverse(o => {{ if (o.isLight && o.visible) n++; }}); return n; }})()")
        check(n['napping'] > 0 and n['out'], 'zoomed far out and over time: things a few pixels across are out of the scene while the hand moves', f"{n['napping']} napping")
        check(len(thing) > 1 and n['small'][0] == [False, True] and any(x[0] for x in n['small'][1:]), 'never the selected thing', str(n['small'][:4]))
        check(n['pawn'], 'never a pawn')
        await rest(1000); a = await gm.evaluate(f"(() => {{ const w = {W}; return {{ napping: w.sleepStats().napping, all: [...w.recs.values()].filter(r => r.entity.kind === 'object' && !r.asleep).every(r => r.group.parent), any: [...w.recs.values()].some(r => r.nap) }}; }})()")
        check(a['napping'] == 0 and not a['any'] and a['all'] and n['lights'] == lights0, 'they are back when the hand stops; the lights never changed', str(a))
        await gm.evaluate("tw.select([])"); await view(gm, 15, 10, 70)

        # ================= SWITCH =================
        print('SWITCH: Settings > Me > Lighter picture while moving')
        await gm.keyboard.press('s'); await gm.wait_for_timeout(400)
        await gm.evaluate("tw.settings.show('me')"); await gm.wait_for_timeout(300)
        tog = await gm.query_selector('[data-pref="lightMoves"]')
        check(tog is not None and await gm.evaluate("tw.settings.prefs().lightMoves === true"), 'the switch is in Settings > Me, on by default')
        if tog: await tog.click(); await gm.wait_for_timeout(200)
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(300)
        if await gm.evaluate("tw.settings.prefs().lightMoves !== false"): await gm.evaluate("tw.settings.setPref('lightMoves', false)")
        await gm.evaluate("tw.interact.reset(); tw.interact.pretend((shed) => 40 - 6.5 * shed.length)")
        g = await drag('right', n=50, pause=22, hold=f"({{ i: {INFO}, f: {FX} }})"); await rest(800)
        check(not g['i']['on'] and g['i']['active'] and not g['i']['shed'] and g['f']['aoOn'] and not g['f']['dance'] and g['f']['fogEvery'] == 1, 'off: the hand still counts as moving, and nothing is ever shed', str(g['i']['shed']))
        await gm.evaluate("tw.settings.setPref('lightMoves', true)"); await gm.reload(); await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000); await gm.evaluate("tw.interactForce = true"); await gm.wait_for_timeout(1500)
        check(await gm.evaluate("tw.settings.prefs().lightMoves === true && tw.interact.info().on"), 'remembered over a reload (this browser), and on again')
        await gm.evaluate("tw.settings.setPref('lightMoves', false)"); await gm.reload(); await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000); await gm.evaluate("tw.interactForce = true"); await gm.wait_for_timeout(1500)
        check(await gm.evaluate("tw.settings.prefs().lightMoves === false && !tw.interact.info().on"), 'and off stays off')
        await gm.evaluate("tw.settings.setPref('lightMoves', true)"); await view(gm, 15, 10, 70); await gm.wait_for_timeout(2500)

        # ================= YIELDS =================
        print('YIELDS: what is not the picture waits for the hand')
        await gm.evaluate("tw.interact.pretend(10)")
        z0 = await gm.evaluate(f"{W}.unitAsleep('{R['b']}')")
        # glide the view away from room a for 2.6 s (longer than the sleep dwell): a must not be put to sleep meanwhile
        res = await gm.evaluate(f"new Promise(res => {{ const g = tw.main.grab, t0 = performance.now(); let slept = false, busy = true, n = 0; const off = tw.on((what) => {{ if (what !== 'frame') return; const t = (performance.now() - t0) / 2600; if ({W}.unitAsleep('{R['a']}')) slept = true; if (n++ > 1 && !tw.interact.busy()) busy = false; if (t < 1) {{ g.focus.x = 15 + t * 900; g.update(); }} else {{ off(); res({{ slept, busy, frames: n }}); }} }}); }})") # (the view is moved from inside the game's own frame, so every frame sees it moved)
        check(z0 and not res['slept'] and res['busy'], 'while the view is moving no room is put to sleep (far rooms sleep only when the hand has stopped)', str(res))
        await gm.wait_for_timeout(2600)
        check(await gm.evaluate(f"{W}.unitAsleep('{R['a']}')"), 'once it stops, the room left behind goes to sleep')
        await view(gm, 15, 10, 70); await gm.wait_for_timeout(600)
        # a burst of changes: applied to the scene once a frame, and a reader sees them all
        b = await gm.evaluate(f"""(async () => {{ const w0 = tw.worlds.get(tw.area()); let syncs = 0; const s = w0.sync; w0.sync = function (...a) {{ syncs++; return s.apply(this, a); }}; const held0 = tw.syncsHeld || 0;
          for (let i = 1; i <= 30; i++) tw.dispatch('token.move', {{ id: 'tok_hand000001', x: 12.5 + i, z: 27.5 }});
          const seenNow = tw.worldOf(tw.area()).recs.get('tok_hand000001').entity.x;   // a reader, in the same task
          await new Promise(r => setTimeout(r, 1200)); delete w0.sync;
          return {{ syncs, held: (tw.syncsHeld || 0) - held0, seenNow, at: tw.entities()['tok_hand000001'].x, drawn: tw.worlds.get(tw.area()).recs.get('tok_hand000001').group.position.x }}; }})()""")
        check(b['at'] == 42.5 and abs(b['drawn'] - 42.5) < 0.01, 'thirty moves sent at once all land (the pawn is where the last one put it)', str(b))
        check(b['held'] >= 20 and b['syncs'] <= 14, 'the scene was brought up to date a few times, not once per change', f"{b['syncs']} syncs for 60 changes (30 sent, 30 confirmed), {b['held']} held to the next frame")
        check(b['seenNow'] == 42.5, 'and a reader in between (app.worldOf) saw every change that had arrived', b['seenNow'])
        # an area picture waits for the hand
        t = await gm.evaluate(f"""(async () => {{ const t0 = performance.now(); const g = tw.main.grab; let on = true; const step = () => {{ if (!on) return; g.focus.x += 0.5; g.update(); requestAnimationFrame(step); }}; step();
          while (!tw.interact.active) await new Promise(r => setTimeout(r, 30)); const t1 = performance.now(); const p = tw.thumbs.render(tw.area()); setTimeout(() => {{ on = false; }}, 1200); const blob = await p; return {{ ms: performance.now() - t1, bytes: blob ? blob.size : 0 }}; }})()""")
        check(t['ms'] > 1200 and t['bytes'] > 1500, 'an area picture asked for while the view is moving is taken after it stops', f"{round(t['ms'])} ms")
        await gm.evaluate("tw.interact.pretend(null); tw.interact.reset()")

        # ================= a high-density screen: the last stage =================
        print('PIXELS: on a high-density screen the last stage draws fewer pixels, and puts them back')
        url = gm.url
        ctx2 = await browser.new_context(viewport={'width': 1000, 'height': 700}, device_scale_factor=2)
        hi = await ctx2.new_page(); hi.on('pageerror', lambda e: errors.append(f'pageerror (2x): {e}'))
        await hi.goto(url); check(await wait(hi, 'window.tw && tw.ready && tw.ready()', 45000), 'the same seat on a 2x screen')
        await hi.evaluate("tw.interactForce = true; tw.interact.pretend((shed) => 60 - 6.5 * shed.length)"); await hi.wait_for_timeout(2500)
        c0 = await hi.evaluate("[document.getElementById('c').width, document.getElementById('c').height]")
        await hi.mouse.move(500, 350); await hi.mouse.down(button='right')
        for i in range(90): await hi.mouse.move(500 + (i % 30) * 6, 350 + i); await hi.wait_for_timeout(22)
        mid = await hi.evaluate("({ i: tw.interact.info(), c: [document.getElementById('c').width, document.getElementById('c').height], css: [document.getElementById('c').clientWidth, document.getElementById('c').clientHeight] })")
        await hi.mouse.up(button='right'); await hi.mouse.move(5, 5); await hi.wait_for_timeout(1200)
        c1 = await hi.evaluate("[document.getElementById('c').width, document.getElementById('c').height]")
        check(c0[0] == 2000 and 'pixels' in mid['i']['shed'] and mid['i']['shed'][-1] == 'pixels' and 1000 <= mid['c'][0] < c0[0] and mid['css'] == [1000, 700], 'far over the target on a 2x screen: after everything else, the picture is drawn at fewer pixels (never under one per CSS pixel), the same size on screen', f"{c0} -> {mid['c']}, shed {mid['i']['shed']}")
        check(c1 == c0 and not (await hi.evaluate("tw.interact.info().shed")), 'and at full sharpness again when the hand stops', str(c1))
        await ctx2.close()

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

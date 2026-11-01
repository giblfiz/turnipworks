#!/usr/bin/env python3
"""A building of several storeys (Harry 2026-10-22, second take): "we build one floor with our full spin-in animations
that they get to watch ... and then we show the multi-story by using the *fast* animation of adding/removing a level ...
leave them off on floor 1 of the building". world.js animateStoreys, main.js startTour (the storey tour).

  Every storey starts its spin-in on the same frame; the seat that made the building watches from the TOP storey; once
  all of it has played and settled its view steps down one storey at a time (the ordinary level change), resting
  STOREY_HOLD_MS on each after the fly lands, and ends on the ground storey (never a cellar). Another seat's view never
  moves. A manual level change stops the tour. One-level buildings, drawn rooms and re-rolls play as before.

  local:  tw-slot python3 engine/test/browser_storeydrop.py --local
  --shots DIR   also save pictures (top storey mid-spin, each step down)
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request, shutil
from playwright.async_api import async_playwright
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--shots')
A = ap.parse_args()
HOLD = 300  # main.js STOREY_HOLD_MS
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
procs = []; tmp = []
def start_local():
    import socket
    def free():
        with socket.socket() as so: so.bind(('127.0.0.1', 0)); return so.getsockname()[1]
    rp, sp = free(), free()
    data = tempfile.mkdtemp(prefix='tw-sd-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(rp), 'DATA_DIR': data, 'ORIENT_API': '', 'TUNER_DIR': os.path.join(REPO, 'tools', 'spawn-tuner', 'js'), 'TUNER_DATA': os.path.join(REPO, 'tools', 'spawn-tuner', 'data')}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(sp), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(150):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{rp}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{sp}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{sp}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{rp}') + '&api=&nopost&faces=1500'
async def wait(pg, js, timeout=15000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=80); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
W = "tw.worlds.get(tw.main.area)"
# every frame while a drop is in: the level and cut this seat shows, and how many pieces still animate
SAMPLER = """(() => { if (window.__sd) return; window.__sd = { frames: [] };
  const loop = () => { const w = tw.worlds.get(tw.main.area); if (w && (w.drops?.length || w.anims.size || tw.storeyTour && !tw.storeyTour.end) && __sd.frames.length < 40000) __sd.frames.push({ t: performance.now(), level: tw.level, cut: tw.cut.y, anim: w.anims.size, drops: (w.drops || []).length });
    requestAnimationFrame(loop); };
  requestAnimationFrame(loop); })()"""
DONE = f"(() => {{ const w = {W}; return !w.drops?.length && w.lastStoreys && w.lastStoreys.settled != null; }})()"
TOUR_DONE = "(() => !!(tw.storeyTour && tw.storeyTour.end))"
STATE = f"(() => {{ const w = {W}, T = tw.storeyTour; return {{ drop: w.lastStoreys, tour: T && {{ t0: T.t0, levels: T.levels, log: T.log, spin: T.spin, end: T.end, endAt: T.endAt }}, frames: window.__sd.frames.splice(0), level: tw.level, cut: tw.cut.y }}; }})()"

def together(tag, d):
    S = d['storeys']; starts = [s['start'] for s in S]
    print(f"    {tag}: meshes in at {d['loaded']} ms; " + '; '.join(f"y{s['y']}: {s['rooms']} rooms {s['n']} pieces, start {s['start']} end {s['end']}" for s in S) + f"; all played {d['end']}, settled {d['settled']} ms")
    check(None not in starts and max(starts) - min(starts) <= 40, f'{tag}: every storey starts its spin-in on the same frame (within 40 ms)', starts)

def tour_ok(tag, st, want_levels):
    d, T, F = st['drop'], st['tour'], st['frames']
    together(tag, d)
    if d['settled'] is None or not T['log']: check(False, f'{tag}: the tour ran to the end', T); return []
    log = T['log']; off = d['t0'] - T['t0']  # the drop's clock to the tour's
    spin_end = d['settled'] + off
    print(f"    {tag} tour: " + ', '.join(f"lv y{e['y']} at {e['at']} (fly landed {e.get('landed')})" for e in log) + f"; spin-in done {T['spin']} ms; end '{T['end']}' at {T['endAt']} ms")
    check([e['y'] for e in log] == want_levels and T['end'] == 'ground', f'{tag}: the view goes to the top storey, then down one storey at a time to the ground storey, and stops there', [e['y'] for e in log])
    check(log[0]['at'] <= d['start'] + off, f'{tag}: it is at the top storey before the spin-in starts', f"cut at {log[0]['at']} ms, spin-in from {round(d['start'] + off)} ms")
    spin = [f for f in F if d['start'] + off <= f['t'] - T['t0'] <= spin_end - 20]
    check(spin and all(f['level'] == want_levels[0] for f in spin), f'{tag}: during the spin-in every frame shows the top storey', f"{len(spin)} frames, levels {sorted(set(f['level'] for f in spin))}")
    check(len(log) > 1 and log[1]['at'] >= T['spin'] >= spin_end - 40, f'{tag}: the first step down comes only after everything has played and settled', f"step {log[1]['at'] if len(log) > 1 else None} ms, settled {round(spin_end)} ms")
    holds = [log[k + 1]['at'] - (log[k]['landed'] if k else max(log[k].get('landed') or 0, T['spin'])) for k in range(len(log) - 1)]
    check(all(HOLD - 5 <= h <= HOLD + 120 for h in holds), f'{tag}: each step waits for the last fly to land, then rests ~{HOLD} ms', f'holds {holds} ms')
    return holds

async def main():
    page = (start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500') + '&nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}); pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); pg.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' else None)
            await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST storey drop ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000), 'GM tab live')
        await gm.evaluate("tw.setVisibility('open'); tw.registry.run('area.fogOfWar.off')")  # (the player seat has no pawn: with vision fog it would see nothing being built)
        invite = await gm.evaluate("(async () => { tw.registry.run('people.invite', { name: 'Mira' }); for (let i = 0; i < 100 && document.querySelector('#output').hidden; i++) await new Promise(r => setTimeout(r, 50)); return document.querySelector('#output textarea')?.value || ''; })()")
        await gm.keyboard.press('Escape')
        pl = await tab(invite + '&nopost&faces=1500&nointro')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 90000), 'player tab live')
        for pg in (gm, pl): await pg.evaluate(SAMPLER); await pg.evaluate(f"{W}.lastStoreys = 'none'")

        print('ONE LEVEL: a crypt of one level, a farmstead with a cellar, a drawn room, a room re-roll: as before (no tour)')
        n0 = await gm.evaluate("tw.cutLog.length")
        for js, what in [("tw.buildAt(tw.buildingNode('crypt'), 14, 10, { seed: 3, storeys: 1 })", 'a one-level crypt'), ("tw.buildAt(tw.buildingNode('farmstead'), 10, 8, { seed: 3, storeys: 1 })", 'a one-storey farmstead with a cellar'), ("(() => { const r = tw.freeGroundFor(5, 4); tw.spawnRoom('common', r.x, r.z, 5, 4, 4101); })()", 'a drawn room')]:
            at0 = await gm.evaluate(f"{W}.lastEpisode?.at ?? 0")
            await gm.evaluate(js)
            ok = await wait(gm, f"{W}.lastEpisode && {W}.lastEpisode.at !== {at0} && !{W}.lastEpisode.loading && !{W}.anims.size", 60000, what)
            check(ok and await gm.evaluate(f"{W}.lastStoreys === 'none' && !tw.storeyTour && tw.cutLog.length === {n0}"), f'{what} plays its rooms as before: no all-storeys drop, no tour, the view untouched')
        rid = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'room').id")
        at0 = await gm.evaluate(f"{W}.lastEpisode.at")
        await gm.evaluate(f"tw.rerollRoom(tw.entities()['{rid}'])")
        ok = await wait(gm, f"{W}.lastEpisode.at !== {at0} && !{W}.lastEpisode.loading", 30000, 're-roll')
        check(ok and await gm.evaluate(f"{W}.lastStoreys === 'none' && !tw.storeyTour && tw.cutLog.length === {n0}"), 'a room re-roll brings its furniture in as before')
        await gm.wait_for_timeout(1500)
        for pg in (gm, pl): await pg.evaluate("window.__sd.frames = []")

        print('INN (2 storeys + cellar), every level showing: all storeys spin in together, watched from lv 2; then down to lv 1')
        pn0, pc0 = await pl.evaluate("tw.cutLog.length"), await pl.evaluate("tw.cut.y")
        await gm.evaluate("tw.buildAt(tw.buildingNode('inn'), 12, 8, { seed: 7 })")
        if A.shots:
            os.makedirs(A.shots, exist_ok=True)
            if await wait(gm, f"{W}.lastStoreys && {W}.lastStoreys.start != null", 60000): await gm.wait_for_timeout(1500); await gm.screenshot(path=os.path.join(A.shots, 'inn-spin-top.png'))
        ok = await wait(gm, TOUR_DONE, 120000, 'inn tour')
        st = await gm.evaluate(STATE)
        check(ok, 'the inn comes in and the tour ends')
        tour_ok('inn (GM)', st, [10, 0])
        check(st['level'] == 0 and st['cut'] == 9, 'the GM is left on lv 1 (the ground storey: cut 9), not in the cellar', [st['level'], st['cut']])
        log = await gm.evaluate(f"tw.cutLog.slice({n0}).map(c => [c.y, c.by])")
        check(log == [[19, 'build'], [9, 'build']], 'the cut writes are the tour\'s, each by: build', log)
        ok = await wait(pl, DONE, 60000, 'inn on the player seat')
        sp = await pl.evaluate(STATE)
        together('inn (player)', sp['drop'])
        check(await pl.evaluate(f"tw.cutLog.length === {pn0} && tw.cut.y === {json.dumps(pc0)} && !tw.storeyTour") and all(f['cut'] == pc0 for f in sp['frames']), 'the player seat\'s view never moved (it was not their building)', sp['cut'])

        print('INN made again with 3 storeys (the offer): watched from lv 3; then lv 2, lv 1')
        n1 = await gm.evaluate("tw.cutLog.length")
        await gm.evaluate("tw.regenBuilding(tw.lastBuilding, { storeys: 3 })")
        if A.shots:
            if await wait(gm, f"{W}.lastStoreys && {W}.lastStoreys.storeys.length === 4 && {W}.lastStoreys.start != null", 60000): await gm.wait_for_timeout(1500); await gm.screenshot(path=os.path.join(A.shots, 'inn3-spin-top.png'))
            for k, lv in enumerate((10, 0)):
                if await wait(gm, f"tw.storeyTour && tw.storeyTour.log.length > {k + 1} && tw.storeyTour.log[{k + 1}].landed != null", 60000): await gm.screenshot(path=os.path.join(A.shots, f'inn3-step{k + 1}-y{lv}.png'))
        ok = await wait(gm, TOUR_DONE, 150000, '3-storey tour')
        st3 = await gm.evaluate(STATE)
        check(ok, 'the three-storey inn comes in and the tour ends')
        holds3 = tour_ok('3-storey inn (GM)', st3, [20, 10, 0])
        check(await gm.evaluate(f"tw.cutLog.slice({n1}).every(c => c.by === 'build')") and st3['level'] == 0, 'left on lv 1 again', st3['level'])
        ok = await wait(pl, f"{DONE} && {W}.lastStoreys.storeys.length === 4", 60000, '3 storeys on the player seat')
        together('3-storey inn (player)', (await pl.evaluate(STATE))['drop'])
        check(await pl.evaluate(f"tw.cutLog.length === {pn0}"), 'the player seat\'s view still never moved')

        print('TAKING THE WHEEL: a manual level change during the tour stops it')
        await gm.evaluate("tw.regenBuilding(tw.lastBuilding, { seed: 99 })")
        ok = await wait(gm, "tw.storeyTour && tw.storeyTour.log.length >= 2 && !tw.storeyTour.end", 150000, 'tour under way')
        await gm.keyboard.press(']')  # (the ordinary level-up key)
        await gm.wait_for_timeout(2500)
        T = await gm.evaluate("(() => { const T = tw.storeyTour; return { end: T.end, steps: T.log.map(e => e.y), level: tw.level, last: tw.cutLog[tw.cutLog.length - 1].by }; })()")
        check(ok and T['end'] == 'level' and T['last'] == 'key' and len(T['steps']) == 2 and T['level'] == 20, 'after "]" the tour is over: no more steps, the view stays where the seat put it', T)

        print('  timeline:', json.dumps({'inn': {'drop': st['drop'], 'tour': st['tour']}, 'inn3': {'drop': st3['drop'], 'tour': st3['tour']}}))
        bad = [e for e in errors if 'favicon' not in e and '404' not in e and 'Failed to load resource' not in e and "Couldn't load texture blob" not in e]
        check(not bad, 'no page errors', bad[:4])
        await browser.close()
    fails = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(fails)}/{len(results)} passed"); return 1 if fails else 0
try: rc = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
sys.exit(rc)

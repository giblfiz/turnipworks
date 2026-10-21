#!/usr/bin/env python3
"""Whole buildings in the game (docs/BUILDINGS.md, Harry 2026-10-11): a type and a footprint become a coherent building
with storeys, a stair core, planned doors, a cellar and a yard, as ONE command; the storey offers and the re-roll make
it again as one undoable step; the command bar builds one from words; a gallery link builds one from its address.

  local:  tw-slot python3 engine/test/browser_buildings.py --local
  live:   ... browser_buildings.py --page https://turnipworks.net/
  --shots DIR   also save a top-down picture of every level of every building made (for the blind reads)
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request, shutil
from playwright.async_api import async_playwright
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--shots')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
procs = []; tmp = []
def start_local():
    import socket
    def free():
        with socket.socket() as so: so.bind(('127.0.0.1', 0)); return so.getsockname()[1]
    rp, sp = free(), free()
    data = tempfile.mkdtemp(prefix='tw-bld-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
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
ROOMS = "Object.values(tw.entities()).filter(e => e.kind === 'room')"
SUMMARY = """(() => { const E = tw.entities(), rs = Object.values(E).filter(e => e.kind === 'room'), b = E[tw.lastBuilding], W = tw.roomgen.edges(E);
  const doors = [...W.edges.values()].filter(e => e.kind === 'door');
  return { n: rs.length, ids: rs.map(r => r.id).sort().join(), types: rs.map(r => r.recipe.type), ys: [...new Set(rs.map(r => r.recipe.y || 0))].sort((a, b) => a - b), buildings: new Set(rs.map(r => r.building)).size,
    gen: b && b.gen, name: b && b.name, stairs: Object.values(E).filter(e => e.kind === 'object' && tw.ST.isConnector(e)).length, shaped: rs.filter(r => r.recipe.outline).length,
    planDoors: doors.filter(e => /building plan/.test(e.why || '')).length, forced: doors.filter(e => e.flag === 'reachability' || e.flag === 'forced').length, street: doors.filter(e => e.sides.length === 1 && E[e.sides[0].room].recipe.plan && !e.yard).length,
    planLinks: tw.lastPlan ? tw.lastPlan.rooms.reduce((s, r) => s + Object.keys(r.links).length, 0) / 2 : 0, planRooms: tw.lastPlan ? tw.lastPlan.rooms.length : 0, fails: tw.lastBuildOut ? tw.lastBuildOut.fails : [], left: tw.lastBuildOut ? tw.lastBuildOut.left : [], objects: Object.values(E).filter(e => e.kind === 'object').length }; })()"""
async def shots(pg, tag):
    if not A.shots: return
    os.makedirs(A.shots, exist_ok=True)
    g = await pg.evaluate("tw.entities()[tw.lastBuilding].gen"); ys = await pg.evaluate(f"[...new Set({ROOMS}.map(r => r.recipe.y || 0))].sort((a, b) => a - b)")
    cx, cz, span = (g['x'] + g['w'] / 2) * 5, (g['z'] + g['d'] / 2) * 5, max(g['w'], g['d'] + 8) * 5
    for y in ys:
        await pg.evaluate(f"(() => {{ tw.setLevel({y}); tw.setCut({y} + 9, {{ by: 'api' }}); const gr = tw.main.grab; gr.focus.set({cx}, {y}, {cz}); gr.pitch = 62; gr.yaw = 0; gr.dist = {span * 1.25}; gr.update(); tw.main.rule = 'free'; }})()")
        await pg.wait_for_timeout(6000 if A.local else 9000)
        await pg.screenshot(path=os.path.join(A.shots, f"{tag}-lv{int(y / 10) + (1 if y >= 0 else 0)}.png"))
    await pg.evaluate("tw.setLevel(0); tw.setCut(null, { by: 'api' })")

async def main():
    page = (start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500') + '&nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}); gm = await ctx.new_page()
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); gm.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' else None)
        await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST buildings ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000), 'GM tab live')
        check(await gm.evaluate("!!tw.buildingNode('inn') && !!tw.buildingNode('crypt') && !!tw.buildingNode('mansion') && !!tw.buildingNode('castle')"), 'the four types are known by name (inn, mansion, castle, crypt)')

        print('INN: one command makes a two-storey inn with a stair core, a cellar and a yard')
        await gm.evaluate("tw.buildAt(tw.buildingNode('inn'), 12, 8, { seed: 7 })")
        ok = await wait(gm, f"{ROOMS}.length >= 8 && Object.values(tw.entities()).filter(e => e.kind === 'object').length > 100", 60000, 'inn built')
        s = await gm.evaluate(SUMMARY)
        check(ok and s['n'] == s['planRooms'] - len(s['left']) and s['buildings'] == 1, 'every room of the plan is in the area, in one building', f"{s['n']} rooms, {s['objects']} things")
        check(s['gen'] and s['gen']['code'] == 'TAV' and s['gen']['storeys'] == 2 and s['gen']['seed'] == 7, 'the building remembers its recipe (type, footprint, seed, storeys)', s['gen'])
        check(s['ys'] == [-10, 0, 10], 'an inn is two storeys by default, with a cellar under it', s['ys'])
        check({'common', 'kitchen', 'hallway', 'guest', 'cellar'} <= set(s['types']), 'common room, kitchen, hallway, guest rooms, cellar', sorted(set(s['types'])))
        check(s['stairs'] == 2, 'one stair core to the upper storey and a short stair to the cellar: two stairs, not one per room', s['stairs'])
        check(s['planDoors'] >= s['planLinks'] - 1 and s['forced'] == 0 and s['street'] == 1, 'the doors are the plan\'s doors; the wall engine added none; one street door', f"{s['planDoors']} of {s['planLinks']} planned, {s['forced']} forced, {s['street']} street")
        check(not s['fails'], 'every room got its key piece', s['fails'])
        kitchen_hub = await gm.evaluate("(() => { const E = tw.entities(), W = tw.roomgen.edges(E), t = (id) => E[id].recipe.type; return [...W.edges.values()].some(e => e.kind === 'door' && e.sides.length === 2 && e.sides.map(x => t(x.room)).sort().join() === 'common,kitchen'); })()")
        check(kitchen_hub, 'the kitchen opens off the common room')
        up = await gm.evaluate("(() => { const E = tw.entities(), st = Object.values(E).find(e => tw.ST.isConnector(e) && tw.ST.stairBase(e) === 0), L = tw.ST.stairLinks(E, st); return [E[L.from]?.recipe.type, E[L.to]?.recipe.type]; })()")
        check(up == ['common', 'hallway'], 'the stair climbs from the common room and arrives in the upstairs hallway', up)
        b = await gm.evaluate("tw.condButtons.list().filter(x => x.key.startsWith('bld-'))")
        check({x['key'] for x in b} == {'bld-cut', 'bld-st-1', 'bld-st-3', 'bld-reroll'} and all(x['visible'] for x in b), 'beside the new inn: "Cut to lv 1", "1 storey", "3 storeys" and "Re-roll" (conditional buttons, not a dialog)', [(x['key'], x['text'], x['visible']) for x in b])
        focus = await gm.evaluate("document.activeElement === document.body || document.activeElement.tagName")

        print('STOREYS: an offer makes the building again, as one step')
        ids0 = s['ids']
        btn = gm.locator('.cbtn', has_text='3 storeys'); await btn.click()
        ok = await wait(gm, f"new Set({ROOMS}.map(r => r.recipe.y || 0)).has(20)", 60000, '3 storeys')
        s3 = await gm.evaluate(SUMMARY)
        check(ok and s3['ys'] == [-10, 0, 10, 20] and s3['gen']['storeys'] == 3 and s3['buildings'] == 1 and s3['stairs'] == 3, 'pressing "3 storeys" makes it again with three (two flights in one dog-leg core, and the cellar stair)', f"{s3['ys']}, {s3['stairs']} stairs")
        core = await gm.evaluate("Object.values(tw.entities()).filter(e => tw.ST.isConnector(e) && tw.ST.stairBase(e) >= 0).map(e => [Math.round(e.x), Math.round(e.z), tw.ST.stairBase(e)])")
        check(len(core) == 2 and abs(core[0][0] - core[1][0]) <= 5 and abs(core[0][1] - core[1][1]) <= 5, 'the two flights stand side by side through the storeys (one core)', core)
        b = await gm.evaluate("tw.condButtons.list().filter(x => x.key.startsWith('bld-')).map(x => x.key).sort()")
        check([k for k in b if k != 'bld-cut'] == ['bld-reroll', 'bld-st-1', 'bld-st-2'], 'the offers follow: now "1 storey", "2 storeys", "Re-roll"', b)
        await shots(gm, 'inn-12x8-s3')
        await gm.keyboard.press('Control+z')
        ok = await wait(gm, f"!new Set({ROOMS}.map(r => r.recipe.y || 0)).has(20) && {ROOMS}.length === {s['n']}", 30000, 'undo storeys')
        s2 = await gm.evaluate(SUMMARY)
        check(ok and s2['ids'] == ids0 and s2['gen']['storeys'] == 2, 'ONE Ctrl+Z puts the two-storey inn back exactly (same rooms)', f"{s2['n']} rooms")
        await shots(gm, 'inn-12x8-s2')
        await gm.evaluate("(() => { tw.select(tw.lastBuilding); })()"); await gm.wait_for_timeout(200)
        can = await gm.evaluate("['building.storeys.1', 'building.storeys.3', 'building.reroll'].map(id => !!tw.registry.available().find(c => c.id === id))")
        check(all(can), 'with the building selected the same are commands (the bar and its menu): never only a button', can)
        await gm.evaluate("tw.registry.run('building.reroll')")
        ok = await wait(gm, f"tw.entities()[tw.lastBuilding] && tw.entities()[tw.lastBuilding].gen.seed !== 7 && {ROOMS}.length >= 6", 60000, 're-roll')
        sr = await gm.evaluate(SUMMARY)
        check(ok and sr['ids'] != ids0 and sr['gen']['storeys'] == 2 and sr['gen']['w'] == 12 and sr['forced'] == 0, 'Re-roll: a new seed, the same footprint and storeys, a new layout', sr['gen'])
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Control+z')
        check(await wait(gm, f"tw.entities()[tw.lastBuilding] && tw.entities()[tw.lastBuilding].gen.seed === 7", 30000, 'undo re-roll'), 'one Ctrl+Z undoes the re-roll')
        await gm.keyboard.press('Control+z')
        check(await wait(gm, f"{ROOMS}.length === 0", 30000, 'undo build'), 'and one more takes the whole inn away (the building was one command)')
        await gm.keyboard.press('Control+Shift+z')
        check(await wait(gm, f"{ROOMS}.length === {s['n']}", 30000, 'redo'), 'redo brings it back')

        print('CRYPT: carved, with corridors that bend, from the command bar')
        await gm.keyboard.press('/'); await gm.keyboard.type('build crypt 20x14 seed 8', delay=10); await gm.wait_for_timeout(500); await gm.keyboard.press('Enter')
        ok = await wait(gm, f"tw.entities()[tw.lastBuilding] && tw.entities()[tw.lastBuilding].gen && tw.entities()[tw.lastBuilding].gen.code === 'CRY' && {ROOMS}.filter(r => r.building === tw.lastBuilding).length >= 5", 60000, 'crypt')
        c = await gm.evaluate("(() => { const E = tw.entities(), rs = Object.values(E).filter(e => e.kind === 'room' && e.building === tw.lastBuilding), W = tw.roomgen.edges(E), ids = new Set(rs.map(r => r.id)); const doors = [...W.edges.values()].filter(e => e.kind === 'door' && e.sides.some(x => ids.has(x.room))); return { n: rs.length, shaped: rs.filter(r => r.recipe.outline).length, pass: rs.filter(r => r.recipe.type === 'crypt-passage').length, links: doors.filter(e => e.sides.length === 2).length, forced: doors.filter(e => e.flag).length, street: doors.filter(e => e.sides.length === 1).length, loops: tw.lastPlan.checks.filter(k => /loop|choice/.test(k.rule)).map(k => [k.rule, k.ok, k.detail]), fails: tw.lastBuildOut.fails, gen: E[tw.lastBuilding].gen }; })()")
        check(ok and c['pass'] >= 3 and c['links'] >= c['n'] and c['street'] == 1, '"build crypt 20x14 seed 8" in the bar: big rooms in rock, passages between, more doors than a tree needs (loops), one way in', c)
        check(c['shaped'] >= 1, 'passages bend: some are L- or Z-shaped rooms (stored outlines)', c['shaped'])
        check(all(k[1] for k in c['loops']), 'the plan has a loop and a choice near the door', c['loops'])
        check(not c['fails'] and c['forced'] == 0, 'every crypt room furnished; the wall engine forced no door', c['fails'])
        b = await gm.evaluate("tw.condButtons.list().filter(x => x.key.startsWith('bld-')).map(x => x.text)")
        check('2 levels' in b and '3 levels' in b, 'a crypt is one level by default and offers "2 levels", "3 levels" (they go DOWN)', b)
        await gm.locator('.cbtn', has_text='2 levels').click()
        ok = await wait(gm, f"{ROOMS}.some(r => r.building === tw.lastBuilding && (r.recipe.y || 0) === -10)", 60000, 'crypt level 2')
        c2 = await gm.evaluate("(() => { const E = tw.entities(), st = Object.values(E).filter(e => tw.ST.isConnector(e) && E[e.room] && E[e.room].building === tw.lastBuilding); return st.map(x => { const L = tw.ST.stairLinks(E, x); return [E[L.from] && E[L.from].recipe.type, E[L.to] && E[L.to].recipe.type, tw.ST.stairBase(x)]; }); })()")
        check(ok and len(c2) == 1 and c2[0][2] == -10 and all(c2[0][:2]), 'the second level is below the first, joined by one stair between a landing and a stair room', c2)
        await shots(gm, 'crypt-20x14-2lv')

        print('MANSION and CASTLE; then the gallery link')
        for word, w, d, need in [('mansion', 16, 12, {'mansion-hall', 'mansion-dining', 'mansion-kitchen', 'mansion-bedroom', 'mansion-corridor'}), ('castle', 16, 12, {'great-hall', 'castle-kitchen', 'barracks', 'armoury', 'castle-passage', 'throne-room'})]:
            await gm.evaluate(f"tw.buildAt(tw.buildingNode('{word}'), {w}, {d}, {{ seed: 11 }})")
            ok = await wait(gm, f"tw.lastPlan && tw.lastPlan.label.toLowerCase() === '{word}' && tw.entities()[tw.lastBuilding] && {ROOMS}.filter(r => r.building === tw.lastBuilding).length >= 6", 90000, word)
            m = await gm.evaluate("(() => { const E = tw.entities(), rs = Object.values(E).filter(e => e.kind === 'room' && e.building === tw.lastBuilding); return { types: [...new Set(rs.map(r => r.recipe.type))], ys: [...new Set(rs.map(r => r.recipe.y || 0))].sort((a, b) => a - b), fails: tw.lastBuildOut.fails, left: tw.lastBuildOut.left, bad: tw.lastPlan.checks.filter(k => !k.ok).map(k => k.rule) }; })()")
            check(ok and need <= set(m['types']) and 10 in m['ys'] and not m['bad'], f'{word} {w}x{d}: its rooms, two storeys, every rule kept', f"{sorted(m['types'])} {m['ys']} {m['bad']}")
            check(not m['fails'], f'{word}: every room got its key piece', m['fails'])
            await shots(gm, f'{word}-{w}x{d}')
        n0 = await gm.evaluate(f"{ROOMS}.length")
        url = await gm.evaluate("location.href")
        sep = '&' if '?' in url.split('#')[0] else '?'
        link = url.split('#')[0] + sep + 'build=TAV&w=10&d=8&seed=21&storeys=1' + '#' + url.split('#')[1]
        await gm.goto(link); await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000, 'reload with ?build')
        ok = await wait(gm, f"{ROOMS}.length > {n0} && tw.lastBuilding && tw.entities()[tw.lastBuilding] && tw.entities()[tw.lastBuilding].gen.seed === 21", 90000, 'link build')
        g = await gm.evaluate("tw.lastBuilding && tw.entities()[tw.lastBuilding] && tw.entities()[tw.lastBuilding].gen")
        check(ok and g['w'] == 10 and g['storeys'] == 1 and 'build=' not in await gm.evaluate('location.href'), 'a gallery link (?build=TAV&w=10&d=8&seed=21&storeys=1) builds that building once and cleans the address', g)
        await wait(gm, 'tw.sync.pendingCount() === 0', 30000, 'the relay has the building')  # (on the live site an answer takes a moment: a reload before it would drop the command)
        n1 = await gm.evaluate(f"{ROOMS}.length")
        await gm.reload(); await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000, 'reload'); await gm.wait_for_timeout(2500)
        n2 = await gm.evaluate(f"{ROOMS}.length")
        check(n2 == n1, 'after a reload everything is still there, and nothing was built twice (the relay took every command)', f'{n1} → {n2}')
        bad = [e for e in errors if 'favicon' not in e and '404' not in e and 'Failed to load resource' not in e and "Couldn't load texture blob" not in e]  # (a texture the GPU process dropped under load: seen only on a busy box)
        check(not bad, 'no page errors', bad[:4])
        await browser.close()
    fails = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(fails)}/{len(results)} passed"); return 1 if fails else 0
try: rc = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
sys.exit(rc)

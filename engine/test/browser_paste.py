#!/usr/bin/env python3
"""PASTE LANDS ON THE LEVEL YOU ARE ACTING ON (2026-11-25; client/clipboard.js "The level a paste lands on").

Harry on dev: "I'm trying to copy and paste a mimic. The copy seems to work ('copied 1 thing'), but when I hit paste I'm
not seeing the mimic go in." Then: "Those mimics got pasted, but not onto the level that I was acting on." The paste sent
no height: every copy went to y 0, which from a cellar is the room above, hidden by the cut (and so dropped from the
selection too). In a real browser, with the real keys (Ctrl+C, Ctrl+V) and the command bar's "Paste at cursor":

  1. a hidden mimic with damage and a condition, copied in a vault 20 ft down, pasted at the pointer on lv -2, lv -1, the
     ground and lv 2: lands on the floor under the pointer at that level, shows under the cut, is selected, gets a ring
     and a word, stays hidden with its damage, condition, figure and size; three pastes at one pointer never stack
  2. a pawn flying 8 ft up keeps its 8 ft over the floor it is pasted onto
  3. the pointer off the table (over the command bar): beside the original, at its height, never on top of it
  4. a multi-selection (two pawns and a thing) keeps its layout and lands on the level in view
  5. a thing on its own (a chest from the vault) lands on the floor under the pointer upstairs
  6. a room copied on lv -1 lands on the level you are on (lv -1, the ground), its things with it

  local:  TW_GPU=1 python3 engine/test/browser_paste.py --local [--shots DIR]
"""
import argparse, asyncio, os, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--shots')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
procs = []; tmp = []
def free():
    with socket.socket() as so: so.bind(('127.0.0.1', 0)); return so.getsockname()[1]
RP, SP = free(), free()
def start_local():
    data = tempfile.mkdtemp(prefix='tw-paste-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': '', 'TUNER_DIR': os.path.join(REPO, 'tools', 'spawn-tuner', 'js'), 'TUNER_DATA': os.path.join(REPO, 'tools', 'spawn-tuner', 'data')}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(150):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
async def shot(pg, name):  # (stills for the report: never a reason for the suite to fail)
    if not A.shots: return
    try: await pg.screenshot(path=os.path.join(A.shots, name), timeout=120000)
    except Exception as e: print(f'    (no still {name}: {str(e)[:80]})')
async def wait(pg, js, timeout=15000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=80); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False

# the building, in squares (5 ft): a great hall on the ground, a bedroom over it (lv 2), a trap corridor at -10 (lv -1)
# and a vault at -20 (lv -2), side by side under the hall
ROOMS = [('great-hall', 0, 0, 8, 6, 0), ('mansion-bedroom', 1, 1, 5, 4, 10), ('dun-trap-corridor', 0, 0, 3, 6, -10), ('dun-vault', 4, 1, 4, 4, -20)]
TOKS = "Object.values(tw.entities()).filter(e => e.kind === 'token').map(e => e.id)"
NEW = """(before) => Object.values(tw.entities()).filter(e => (e.kind === 'token' || e.kind === 'object') && !before.includes(e.id)).map(e => ({ id: e.id, kind: e.kind, name: e.name, cat: e.cat, x: e.x, z: e.z, y: e.y || 0, hidden: !!e.hidden,
  damage: e.damage || 0, conditions: e.conditions || [], fig: e.fig || null, size: e.size || 1, cut: tw.cutHides(e), sel: tw.sel.has(e.id), room: tw.roomAt(e.x, e.z, e.y || 0)?.recipe.type || null }))"""
ALL = "Object.values(tw.entities()).filter(e => e.kind === 'token' || e.kind === 'object').map(e => e.id)"

async def point(pg, x, z, y):
    await pg.evaluate(f"(() => {{ const P = tw.main.pose(); tw.main.setPose({{ ...P, focus: [{x}, {y}, {z}], dist: 60 }}); }})()"); await pg.wait_for_timeout(700)
    s = await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")
    await pg.mouse.move(s['x'] - 6, s['y'] - 6); await pg.mouse.move(s['x'], s['y']); await pg.wait_for_timeout(300)
    return await pg.evaluate("tw.cursor && [+tw.cursor[0].toFixed(2), +tw.cursor[1].toFixed(2), tw.cursor.y]")

async def paste_key(pg):
    n0 = await pg.evaluate("tw.worldOf(tw.area()).pings.length")
    await pg.keyboard.press('Control+v'); await pg.wait_for_timeout(250)
    toast = await pg.evaluate("(() => { const t = document.querySelector('#toast'); return t && t.classList.contains('show') ? t.textContent : null; })()")
    pings = await pg.evaluate("tw.worldOf(tw.area()).pings.length")
    await pg.wait_for_timeout(900)
    return toast, pings > n0

async def main():
    start_local()
    page = f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500&nointro'
    if A.shots: os.makedirs(A.shots, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}, permissions=['clipboard-read', 'clipboard-write']); gm = await ctx.new_page()
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); gm.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' else None)
        await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST paste levels ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000), 'GM tab live')
        await gm.wait_for_timeout(1500)
        for (t, x, z, w, d, y) in ROOMS:
            await gm.evaluate(f"tw.setLevel({y}); tw.spawnRoom('{t}', {x}, {z}, {w}, {d}, 7, undefined, {y})"); await gm.wait_for_timeout(400)
        ok = await wait(gm, "Object.values(tw.entities()).filter(e => e.kind === 'room').length >= 4", 20000, 'rooms')
        ys = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room').map(r => r.recipe.y || 0).sort((a, b) => a - b)")
        check(ok and ys == [-20, -10, 0, 10], 'a building on four levels: -20 (lv -2), -10 (lv -1), the ground, 10 (lv 2)', ys)
        # the mimic, in the vault, hidden, with damage and a condition
        mid = await gm.evaluate("(() => { tw.setLevel(-20); const [id] = tw.addPawns('foe-mimic', 27.5, 17.5, { y: -20, select: false }); return id; })()")
        await gm.wait_for_timeout(400)
        await gm.evaluate(f"tw.batch([{{ type: 'entity.flag', args: {{ ids: ['{mid}'], hidden: true }} }}, {{ type: 'token.damage', args: {{ id: '{mid}', damage: 4 }} }}, {{ type: 'token.set', args: {{ id: '{mid}', conditions: ['poisoned'] }} }}])"); await gm.wait_for_timeout(500)
        o = await gm.evaluate(f"(() => {{ const e = tw.entities()['{mid}']; return {{ x: e.x, z: e.z, y: e.y || 0, hidden: e.hidden, fig: e.fig, damage: e.damage, conditions: e.conditions, size: e.size || 1 }}; }})()")
        check(o['y'] == -20 and o['hidden'] and o['fig'] == 'foe-mimic' and o['damage'] == 4 and o['conditions'] == ['poisoned'], 'a hidden mimic with damage 4 and "poisoned" stands in the vault at -20', o)

        print('1. COPY IT IN THE VAULT (Ctrl+C), PASTE IT AT THE POINTER ON FOUR LEVELS (Ctrl+V twice, then the bar\'s "Paste at cursor")')
        await gm.evaluate("tw.goLevel(-20)"); await gm.wait_for_timeout(600)
        await point(gm, o['x'], o['z'], -20)
        await gm.evaluate(f"tw.select(['{mid}'])"); await gm.wait_for_timeout(200)
        await gm.keyboard.press('Control+c'); await gm.wait_for_timeout(300)
        check(await gm.evaluate("tw.clip && tw.clip.items.length === 1 && tw.clip.items[0].e.fig === 'foe-mimic'"), 'Ctrl+C copied it')
        # (lv, a spot inside that level's room, what must be under it)
        for (lv, px, pz, rtype, name) in [(-20, 32.5, 12.5, 'dun-vault', 'lv -2'), (-10, 7.5, 12.5, 'dun-trap-corridor', 'lv -1'), (0, 35.0, 25.0, 'great-hall', 'the ground'), (10, 17.5, 12.5, 'mansion-bedroom', 'lv 2')]:
            await gm.evaluate(f"tw.goLevel({lv})"); await gm.wait_for_timeout(700)
            before = await gm.evaluate(ALL)
            cur = await point(gm, px, pz, lv)
            check(cur and abs(cur[2] - lv) < 0.01, f'{name}: the pointer is on the floor at {lv}', cur)
            toast, pinged = await paste_key(gm)
            await shot(gm, f'paste-{lv}.png')
            n1 = await gm.evaluate(NEW, before)
            m = n1[0] if n1 else {}
            check(len(n1) == 1 and abs(m['y'] - lv) < 0.01 and abs(m['x'] - cur[0]) < 0.01 and abs(m['z'] - cur[1]) < 0.01, f'{name}: Ctrl+V puts it under the pointer, ON THIS LEVEL (y {lv}; it was 0 before the fix)', m)
            check(m.get('room') == rtype and not m.get('cut'), f'{name}: it is in the {rtype} and the cut shows it', [m.get('room'), m.get('cut')])
            check(m.get('sel') and pinged and toast == 'Pasted 1 thing', f'{name}: it is selected, with a ring at the spot and "Pasted 1 thing"', [m.get('sel'), pinged, toast])
            check(m.get('hidden') and m.get('damage') == 4 and m.get('conditions') == ['poisoned'] and m.get('fig') == 'foe-mimic' and m.get('size') == o['size'], f'{name}: still hidden, damage 4, poisoned, the same figure and size', m)
            await paste_key(gm)
            await gm.evaluate("tw.registry.run('edit.paste')"); await gm.wait_for_timeout(900)
            n3 = await gm.evaluate(NEW, before)
            spots = {(round(t['x'], 2), round(t['z'], 2)) for t in n3}
            check(len(n3) == 3 and len(spots) == 3 and all(abs(t['y'] - lv) < 0.01 and t['room'] == rtype and not t['cut'] for t in n3), f'{name}: three pastes at one pointer: three squares, none stacked, all on this level in the {rtype}', [(t['x'], t['z'], t['y'], t['room']) for t in n3])
            check(sum(1 for t in n3 if t['sel']) == 1 and n3[-1]['sel'] if n3 else False, f'{name}: the last paste is the selection', [t['sel'] for t in n3])
            await shot(gm, f'paste-{lv}-three.png')

        print('2. A PAWN FLYING 8 FT UP KEEPS ITS 8 FT')
        await gm.evaluate("tw.goLevel(-20)"); await gm.wait_for_timeout(500)
        bat = await gm.evaluate("(() => { const [id] = tw.addPawns(null, 37.5, 7.5, { y: -12, name: 'Bat', select: false }); return id; })()"); await gm.wait_for_timeout(500)
        by = await gm.evaluate(f"tw.entities()['{bat}'].y")
        await point(gm, 37.5, 7.5, -20); await gm.evaluate(f"tw.select(['{bat}'])")
        await gm.keyboard.press('Control+c'); await gm.wait_for_timeout(300)
        lift = await gm.evaluate("tw.clip.items[0].lift")
        check(by == -12 and lift == 8, 'the bat flies 8 ft over the vault floor and is copied with lift 8', [by, lift])
        await gm.evaluate("tw.goLevel(10)"); await gm.wait_for_timeout(600)
        before = await gm.evaluate(ALL); cur = await point(gm, 22.5, 17.5, 10); await paste_key(gm)
        n = await gm.evaluate(NEW, before)
        check(len(n) == 1 and abs(n[0]['y'] - 18) < 0.01, 'pasted on lv 2 (floor 10) it flies at 18: 8 ft over that floor', n[0] if n else None)

        print('3. THE POINTER OUT OF THE WINDOW: beside the original, at its height')
        await gm.evaluate("tw.goLevel(-20)"); await gm.wait_for_timeout(600)
        await point(gm, o['x'], o['z'], -20); await gm.evaluate(f"tw.select(['{mid}'])"); await gm.keyboard.press('Control+c'); await gm.wait_for_timeout(300)
        await gm.mouse.move(700, 450); await gm.mouse.move(700, -40); await gm.wait_for_timeout(300)  # (out of the window, over the top)
        off = await gm.evaluate("tw.pointerOff")
        before = await gm.evaluate(ALL)
        await gm.evaluate("tw.registry.run('edit.paste')"); await gm.wait_for_timeout(900)
        n = await gm.evaluate(NEW, before)
        d = n and ((n[0]['x'] - o['x']) ** 2 + (n[0]['z'] - o['z']) ** 2) ** 0.5
        check(off and len(n) == 1 and abs(n[0]['y'] + 20) < 0.01 and 4 < d < 8 and n[0]['room'] == 'dun-vault', 'one square beside the original, on its floor, in the vault (never on top of it)', [off, n[0] if n else None, d])

        print('4. A MULTI-SELECTION: two pawns and a thing, onto the ground')
        await gm.evaluate("tw.goLevel(-20)"); await gm.wait_for_timeout(500)
        chest = await gm.evaluate("(() => { const E = tw.entities(), v = Object.values(E).find(r => r.kind === 'room' && r.recipe.type === 'dun-vault'); return Object.values(E).find(e => e.kind === 'object' && e.room === v.id && !e.parent && e.place !== 'tile' && e.layer !== 'openings' && !/door|wall|window|stair/.test(e.cat || ''))?.id || null; })()")
        check(chest, 'the vault has a thing of its own to copy', chest)
        g = await gm.evaluate(f"(() => {{ const E = tw.entities(); return ['{mid}', '{bat}', '{chest}'].map(id => [id, E[id].x, E[id].z, E[id].y || 0]); }})()")
        await gm.evaluate(f"tw.select(['{mid}', '{bat}', '{chest}'])"); await point(gm, o['x'], o['z'], -20)
        await gm.keyboard.press('Control+c'); await gm.wait_for_timeout(300)
        await gm.evaluate("tw.goLevel(0)"); await gm.wait_for_timeout(600)
        before = await gm.evaluate(ALL); cur = await point(gm, 25.0, 20.0, 0); toast, _ = await paste_key(gm)
        n = await gm.evaluate(NEW, before)
        await shot(gm, 'paste-group-ground.png')
        rel0 = sorted(round(b[1] - a[1], 2) for a in g for b in g); rel1 = sorted(round(b['x'] - a['x'], 2) for a in n for b in n)
        lifts = {t['name']: round(t['y'], 2) for t in n}
        check(len(n) == 3 and rel0 == rel1 and toast == 'Pasted 3 things', 'three things pasted, their layout kept, "Pasted 3 things"', [toast, rel0, rel1])
        check(all(not t['cut'] and t['sel'] for t in n) and lifts.get('Mimic') == 0 and lifts.get('Bat') == 8, 'all on the ground, shown and selected; the mimic stands, the bat still flies 8 ft up', lifts)

        print('5. A THING ON ITS OWN, ONTO LV 2')
        await gm.evaluate("tw.goLevel(-20)"); await gm.wait_for_timeout(500)
        cy = await gm.evaluate(f"tw.entities()['{chest}'].y || 0")
        await gm.evaluate(f"tw.select(['{chest}'])"); await gm.keyboard.press('Control+c'); await gm.wait_for_timeout(300)
        await gm.evaluate("tw.goLevel(10)"); await gm.wait_for_timeout(600)
        before = await gm.evaluate(ALL); cur = await point(gm, 12.5, 12.5, 10); await paste_key(gm)
        n = await gm.evaluate(NEW, before)
        check(len(n) == 1 and abs(n[0]['y'] - (10 + cy + 20)) < 0.05 and n[0]['room'] == 'mansion-bedroom' and not n[0]['cut'] and n[0]['sel'], 'the vault\'s thing lands on the bedroom floor (lv 2), shown and selected', [cy, n[0] if n else None])

        print('6. A ROOM: copied from lv -1, it lands on the level you are on, its things with it')
        await gm.evaluate("tw.goLevel(-10)"); await gm.wait_for_timeout(600)
        rid = await gm.evaluate("Object.values(tw.entities()).find(r => r.kind === 'room' && r.recipe.type === 'dun-trap-corridor').id")
        await gm.evaluate(f"tw.select(['{rid}'])"); await point(gm, 7.5, 12.5, -10); await gm.keyboard.press('Control+c'); await gm.wait_for_timeout(300)
        RNEW = "(before) => Object.values(tw.entities()).filter(e => e.kind === 'room' && !before.includes(e.id)).map(r => ({ id: r.id, y: r.recipe.y || 0, x: r.recipe.x, z: r.recipe.z, things: Object.values(tw.entities()).filter(o => o.kind === 'object' && o.room === r.id).map(o => +(o.y || 0).toFixed(2)) }))"
        RIDS = "Object.values(tw.entities()).filter(e => e.kind === 'room').map(e => e.id)"
        src = await gm.evaluate(f"Object.values(tw.entities()).filter(o => o.kind === 'object' && o.room === '{rid}').map(o => +(o.y || 0).toFixed(2))")
        for lv in (-10, 0):
            await gm.evaluate(f"tw.goLevel({lv})"); await gm.wait_for_timeout(600)
            before = await gm.evaluate(RIDS); await point(gm, 80.0 + lv, 80.0, lv); await paste_key(gm); await gm.wait_for_timeout(600)
            n = await gm.evaluate(RNEW, before)
            check(len(n) == 1 and n[0]['y'] == lv and sorted(n[0]['things']) == sorted(round(v + lv + 10, 2) for v in src), f'pasted on the level at {lv}: the room is at {lv} and its {len(src)} things moved with it', [n, src])

        bad_err = [e for e in errors if not any(x in e for x in ('favicon', 'net::ERR', 'tuner/version.json', 'tw-ratings', 'status of 404'))]
        check(not bad_err, 'no page errors', bad_err[:3])
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
n_ok = sum(1 for r in results if r[0]); print(f'\npaste: {n_ok}/{len(results)} passed'); sys.exit(0 if n_ok == len(results) else 1)

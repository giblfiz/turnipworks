#!/usr/bin/env python3
"""LEVELS ARE ADVANCED (2026-11-12, Harry: "think of that as an advanced feature ... making everything default to layer one
until people need to actively request to go multi-layer"; docs/VERTICAL.md "Levels are advanced").

  1. every building type builds ONE storey, nothing under it; the offers beside it make it again (same seed) with 2 or 3
     storeys (a down-type: "Go deeper"), or with its cellar (nothing above the ground moves)
  2. a cave is drawn on the ground; its offer "Take it underground" takes it to lv -1
  3. every change of the level you are on moves the view, opens the meter wide and a big hand drags the marker (800 ms
     + 500 ms to fold; non-blocking; reduced motion: instant, no hand)
  2b. a missed "Take it underground" / "Re-roll" goes down into the chat log (condbutton.js rule 6, the default since 11-13)
  4. a world on the ground only folds the meter up to its Roofs button
  5. saved maps load as they were saved: a corpus campaign with three storeys, and a building generated the old way

  local:  python3 engine/test/browser_levels_advanced.py --local
  --shots DIR  before/after stills of the meter (for the blind read)
"""
import argparse, asyncio, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
CORPUS = '/mnt/usb/turnip-works/test-corpus/campaigns-2026-10-06'
OLD = 'cmp_5v7odrlr0x'  # a saved campaign with rooms on three storeys (0, 10, 20 ft)
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
    data = tempfile.mkdtemp(prefix='tw-lva-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    # a COPY of one saved campaign (the corpus is read-only: never point a relay at it)
    if os.path.isdir(os.path.join(CORPUS, OLD)): shutil.copytree(os.path.join(CORPUS, OLD), os.path.join(data, OLD), ignore=shutil.ignore_patterns('*.pre-areas'))
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': '', 'TUNER_DIR': os.path.join(REPO, 'tools', 'spawn-tuner', 'js'), 'TUNER_DATA': os.path.join(REPO, 'tools', 'spawn-tuner', 'data')}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(150):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return data
def old_token(data):
    snap = json.load(open(os.path.join(data, OLD, 'snapshot.json')))
    gm = next(s for s in snap['state']['seats'].values() if s.get('kind') == 'human' and s.get('role') == 'gm' and not s.get('revoked'))
    js = f"import('{ENGINE}/relay/tokens.js').then(m => console.log(m.makeTokens(require('fs').readFileSync('{data}/secret', 'utf8').trim()).mint('{OLD}', {json.dumps(gm)})))"
    return subprocess.check_output(['node', '-e', js.replace("require('fs')", "process.getBuiltinModule('fs')")], text=True).strip()
async def shot(pg, name, **kw):  # (stills for the blind read: never a reason for the suite to fail)
    try: await pg.screenshot(path=os.path.join(A.shots, name), timeout=120000, **kw)
    except Exception as e: print(f'    (no still {name}: {str(e)[:80]})')
async def wait(pg, js, timeout=15000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=80); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
ROOMS = "Object.values(tw.entities()).filter(e => e.kind === 'room')"
YS = f"[...new Set({ROOMS}.map(r => r.recipe.y || 0))].sort((a, b) => a - b)"
# the rooms above the ground of the last building, as (type, rectangle): what must not move when its cellar is put back
GROUND = f"JSON.stringify({ROOMS}.filter(r => r.building === tw.lastBuilding && (r.recipe.y || 0) >= 0).map(r => [r.recipe.type, r.recipe.x, r.recipe.z, r.recipe.w, r.recipe.d, r.recipe.y || 0, r.recipe.outline || null]).sort())"
OFFERS = "tw.condButtons.list().filter(x => x.key.startsWith('bld-')).map(x => x.key).sort()"
METER = "(() => { const b = tw.cutBar(); return { single: b.single, flash: b.flash, rail: b.railShown, shown: b.shown, roof: document.querySelector('#levelMeter .lm-roof').offsetHeight > 0 }; })()"

# FRAME SAMPLING of a level change (Harry: "animation would indicate a number of interim frames ... like at least 0.5 sec
# worth"): every frame, the camera's focus height, the world's cut, the hand and the meter's width, from just before the
# trigger until the move has ended (or `cap` ms)
SAMPLE = """(cap) => { const S = window.__lvs = { t0: performance.now(), s: [], clickAt: null, done: false }; let endAt = null;
  const tick = () => { const now = performance.now() - S.t0, g = tw.main.grab, w = tw.worldOf(tw.area()), v = tw.viewAnim();
    S.s.push([now, g.focus.y, w ? w.cut : null, v ? v.hand : null, v && v.handAt ? v.handAt[1] : null, document.getElementById('levelMeter').getBoundingClientRect().width, v ? 1 : 0]);
    if (v) endAt = null; else if (S.s.some(x => x[6]) && endAt == null) endAt = now;
    if ((endAt != null && now - endAt > 300) || now > cap) { S.done = true; return; } requestAnimationFrame(tick); };
  requestAnimationFrame(tick); }"""
async def sampled(pg, trigger_js, cap=4000):
    await pg.evaluate(SAMPLE, cap); await pg.wait_for_timeout(60)
    await pg.evaluate("window.__lvs.clickAt = performance.now() - window.__lvs.t0")
    await trigger_js()
    await pg.wait_for_function("window.__lvs && window.__lvs.done", timeout=cap + 30000, polling=100)
    S = await pg.evaluate("window.__lvs")
    s = S['s']; ys = [x[1] for x in s]; lo, hi = min(ys), max(ys); y0 = ys[0]; y1 = ys[-1]
    tol = 0.002
    mid = [x for x in s if lo + tol < x[1] < hi - tol]
    distinct = len({round(x[1], 3) for x in mid})
    span = (mid[-1][0] - mid[0][0]) if mid else 0
    first = next((x[0] for x in s if abs(x[1] - y0) > tol), None)
    hands = [x for x in s if x[3]]; hand_ys = {round(x[4]) for x in hands if x[4] is not None}
    return {'from': y0, 'to': y1, 'interim': distinct, 'span_ms': round(span), 'lag_ms': round(first - S['clickAt']) if first is not None else None,
            'cuts': sorted({x[2] for x in s if x[2] is not None}) if any(x[2] is not None for x in s) else [None], 'hand_phases': sorted({x[3] for x in hands}), 'hand_positions': len(hand_ys), 'meter_w_max': round(max(x[5] for x in s)), 'frames': len(s)}
def moved_ok(r, dy):
    # (2026-11-13: slowed to 800 + 500 ms; the eased ends sit inside the tolerance, so ~700 ms is measured)
    return r['interim'] >= 8 and r['span_ms'] >= 600 and abs((r['to'] - r['from']) - dy) < 0.01

async def main():
    data = start_local()
    page = f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500&nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}); gm = await ctx.new_page()
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); gm.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' else None); gm.on('response', lambda r: errors.append(f'404: {r.url[:160]}') if r.status == 404 else None)
        await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST levels advanced ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000), 'GM tab live')
        await gm.wait_for_timeout(1500)

        print('4. AN EMPTY WORLD: the meter is folded up to its Roofs button')
        m = await gm.evaluate(METER)
        check(m['single'] and not m['rail'] and m['roof'], 'nothing off the ground: no rail, no All-levels cap, the Roofs button stays', m)
        if A.shots: os.makedirs(A.shots, exist_ok=True); await shot(gm, 'after-empty.png')

        print('1. AN INN: one storey, nothing under it')
        await gm.evaluate("tw.buildAt(tw.buildingNode('inn'), 12, 8, { seed: 7 })")
        ok = await wait(gm, f"{ROOMS}.length >= 4 && tw.entities()[tw.lastBuilding]?.gen", 60000, 'inn built')
        g = await gm.evaluate("tw.entities()[tw.lastBuilding].gen"); ys = await gm.evaluate(YS)
        check(ok and ys == [0] and g['storeys'] == 1 and g.get('cellar') is False and g['seed'] == 7, 'a new inn is one storey on the ground, no cellar (gen: storeys 1, cellar false)', [ys, g])
        await gm.wait_for_timeout(600)
        offers = await gm.evaluate(OFFERS)
        check(offers == ['bld-cellar', 'bld-reroll', 'bld-st-2', 'bld-st-3'], 'beside it: "2 storeys", "3 storeys", "Add a cellar", "Re-roll"', offers)
        tip = await gm.evaluate("tw.condButtons.get('bld-st-2')?.el.title || ''")
        check('beds above' in tip and 'usually 2' in tip, "the storey offer's hint is the type's own reason for its usual count", tip)
        m = await gm.evaluate(METER)
        check(m['single'], 'a one-storey inn keeps the meter folded', m)
        if A.shots: await shot(gm, 'after-inn-1storey.png')
        await gm.evaluate("tw.condButtons.expire('bld-reroll')")
        ok = await wait(gm, "tw.actionLines.list().some(l => l.button === 'Re-roll' && l.state === null)", 8000, 're-roll line')
        check(ok, 'a missed "Re-roll" goes down into the chat too (it used to just fade)', await gm.evaluate("tw.actionLines.list().map(l => [l.text, l.button, l.state])"))
        g1 = await gm.evaluate(GROUND)

        print('1. "2 storeys": made again with the same seed')
        n0 = len(await gm.evaluate("tw.levelAnims"))
        r = await sampled(gm, lambda: gm.locator('.cbtn', has_text='2 storeys').click(), cap=60000)
        check(moved_ok(r, 10) and r['hand_positions'] >= 8 and 'grab' in r['hand_phases'] and 'release' in r['hand_phases'] and r['meter_w_max'] >= 140, '"2 storeys": the storey tour moves the VIEW up a storey over ≥ 0.5 s with ≥ 8 interim frames; the big hand grabs, drags and lets go; the meter opens wide', r)
        ok = await wait(gm, f"{YS}.includes(10)", 60000, '2 storeys')
        g = await gm.evaluate("tw.entities()[tw.lastBuilding].gen"); ys = await gm.evaluate(YS)
        check(ok and ys == [0, 10] and g['storeys'] == 2 and g['seed'] == 7 and g.get('cellar') is False, 'two storeys, same seed, still no cellar', [ys, g])
        g2 = await gm.evaluate(GROUND)
        print(f"    (ground floor of the inn, seed 7, 1 vs 2 storeys: {'identical' if json.loads(g1) == [r for r in json.loads(g2) if r[5] == 0] else 're-planned (the beds go upstairs)'})")
        await wait(gm, f"tw.levelAnims.length > {n0}", 8000, 'storey tour animates')
        check(len(await gm.evaluate("tw.levelAnims")) > n0, 'the storey tour that follows moves the level, and the meter shows each move', await gm.evaluate("tw.levelAnims.slice(-3).map(a => [a.from, a.to, a.slid])"))
        await wait(gm, f"tw.storeyTour?.end || (tw.level === 0 && !tw.levelAnimating())", 20000, 'tour over')
        await gm.wait_for_timeout(1200)
        m = await gm.evaluate(METER)
        check(not m['single'] and m['rail'], 'with a second storey the whole meter is back', m)

        print('1. "Add a cellar": nothing above the ground moves')
        await gm.evaluate("tw.offerBuilding(tw.lastBuilding, { ...tw.entities()[tw.lastBuilding].gen, name: 'Inn' })"); await gm.wait_for_timeout(400)
        before = await gm.evaluate(GROUND)
        await gm.evaluate("tw.condButtons.get('bld-cellar').el.click()")
        ok = await wait(gm, f"{YS}.includes(-10)", 60000, 'cellar')
        g = await gm.evaluate("tw.entities()[tw.lastBuilding].gen"); ys = await gm.evaluate(YS)
        check(ok and ys == [-10, 0, 10] and 'cellar' not in g and g['seed'] == 7, 'the cellar is put back under it (gen forgets cellar: false)', [ys, g])
        check(await gm.evaluate(GROUND) == before, 'every room above the ground is exactly where it was', '')
        await gm.evaluate("tw.offerBuilding(tw.lastBuilding, { ...tw.entities()[tw.lastBuilding].gen, name: 'Inn' })"); await gm.wait_for_timeout(400)
        await gm.evaluate("tw.condButtons.get('bld-st-3').el.click()")
        ok = await wait(gm, f"{YS}.includes(20)", 60000, '3 storeys')
        check(ok and await gm.evaluate(YS) == [-10, 0, 10, 20], '"3 storeys" from there: three storeys and the cellar', await gm.evaluate(YS))
        await wait(gm, "tw.storeyTour?.end", 20000, 'tour over')

        print('1. EVERY building type: one storey on the ground by default')
        codes = await gm.evaluate("[...tw.taxonomy.nodes.values()].filter(n => n.level === 'type' && !n.disabled && tw.buildingProgramme(n.code)).map(n => [n.code, n.label, !!tw.buildingProgramme(n.code).down, tw.buildingProgramme(n.code).storeys.def])")
        bad = []
        if os.environ.get('TW_LVA_FAST'): codes = codes[:2]  # (debugging the later parts)
        for code, label, down, d in codes:
            nb = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'building').length")
            bid = await gm.evaluate(f"(() => {{ const n = [...tw.taxonomy.nodes.values()].find(n => n.level === 'type' && n.code === {json.dumps(code)}); return tw.buildAt(n, 12, 10, {{ seed: 3 }}); }})()")
            if not bid: bad.append((code, 'not built')); continue
            await wait(gm, f"{ROOMS}.some(r => r.building === {json.dumps(bid)})", 30000, code)
            rys = await gm.evaluate(f"[...new Set({ROOMS}.filter(r => r.building === {json.dumps(bid)}).map(r => r.recipe.y || 0))]")
            gs = await gm.evaluate(f"tw.entities()[{json.dumps(bid)}]?.gen?.storeys")
            offers = await gm.evaluate(OFFERS)
            if rys != [0] or gs != 1: bad.append((code, rys, gs))
            if down and 'bld-st-2' in offers and 'Go deeper' not in (await gm.evaluate("tw.condButtons.get('bld-st-2')?.el.textContent || ''")): bad.append((code, 'down offer wording'))
            print(f"    {code:4} {label[:22]:22} usual {d}{' (down)' if down else ''}: levels {rys}, offers {offers}")
            await gm.keyboard.press('Control+z'); await wait(gm, f"!{ROOMS}.some(r => r.building === {json.dumps(bid)})", 20000, f'undo {code}')
        check((len(codes) >= 15 or os.environ.get('TW_LVA_FAST')) and not bad, f'all {len(codes)} building types (inn, mansion, castle, mine, dungeon, the modern ones ...) build one storey at lv 0; a down-type offers "Go deeper"', bad)

        print('2. A CAVE: on the ground, then underground')
        await gm.evaluate("tw.goLevel(0, 'test'); tw.cutOff('test')"); await gm.wait_for_timeout(1200)
        await gm.evaluate("tw.modes.roomTool('cave')"); lvl = await gm.evaluate("tw.level"); await gm.keyboard.press('Escape')
        check(lvl == 0, 'picking the Cave tool leaves you on the level you are on (it used to jump to lv -1)', lvl)
        cid = await gm.evaluate("tw.spawnRoom('cave', -40, -40, 7, 6)")
        ok = await wait(gm, f"!!tw.entities()['{cid}'] && tw.condButtons.has('cave-under')", 15000, 'cave + offer')
        cy = await gm.evaluate(f"tw.entities()['{cid}'].recipe.y || 0")
        check(ok and cy == 0, 'the cave is drawn on the ground (lv 1), with "Take it underground" beside it', [cy, await gm.evaluate("tw.condButtons.list().map(x => x.text)")])
        await gm.evaluate(f"(() => {{ const r = tw.entities()['{cid}'].recipe, g = tw.main.grab; g.focus.set((r.x + r.w / 2) * 5, 0, (r.z + r.d / 2) * 5); g.update?.(); }})()")
        await gm.wait_for_timeout(600)
        if A.shots: await shot(gm, 'cave-ground.png')
        R_CAVE = {}
        async def press_cave():
            R_CAVE['pr'] = await gm.evaluate(f"(() => {{ const b = tw.condButtons.get('cave-under'); if (!b) return {{ pressed: false }}; b.el.click(); return {{ pressed: true }}; }})()")
        r = await sampled(gm, press_cave)
        check(R_CAVE['pr']['pressed'] and moved_ok(r, -10) and r['hand_positions'] >= 8, '"Take it underground": the view goes DOWN a storey over ≥ 0.5 s with ≥ 8 interim frames, the hand dragging the marker', r)
        check(r['lag_ms'] is not None and r['lag_ms'] < 400, 'the move starts within 0.4 s of the press', r['lag_ms'])
        pr = {'pressed': R_CAVE['pr']['pressed'], 'age': 0}
        check(pr['pressed'], 'the offer is still there to press', pr)
        if not pr['pressed']: await gm.evaluate(f"tw.caveUnderground('{cid}')")
        ok = await wait(gm, f"(tw.entities()['{cid}'].recipe.y || 0) === -10 && tw.level === -10", 15000, 'underground')
        check(ok and await gm.evaluate("tw.cut.y != null && tw.cut.y < 0"), 'pressed: the cave is at lv -1, and the view went down with it (cut below the ground)', await gm.evaluate(f"[tw.entities()['{cid}'].recipe.y, tw.level, tw.cut.y]"))
        if A.shots: await gm.wait_for_timeout(2500); await shot(gm, 'cave-under.png')
        await gm.keyboard.press('Control+z'); ok = await wait(gm, f"(tw.entities()['{cid}'].recipe.y || 0) === 0", 15000, 'undo underground')
        check(ok, 'one Ctrl+Z brings it back up', '')

        print('2. A MISSED "Take it underground" GOES DOWN INTO THE CHAT (condbutton.js rule 6; Harry 2026-11-13)')
        await gm.evaluate(f"tw.offerCaveUnder('{cid}')"); await wait(gm, "tw.condButtons.has('cave-under')", 5000, 'offer again')
        await gm.evaluate("tw.condButtons.expire('cave-under')")
        ok = await wait(gm, "!tw.condButtons.has('cave-under') && tw.actionLines.list().some(l => l.button === 'Take it underground' && l.state === null && l.shown)", 8000, 'cave line in chat')
        ln = await gm.evaluate("tw.actionLines.list().filter(l => l.button === 'Take it underground')")
        check(ok, 'its time up, the offer leaves the map and lands in the chat log as a line with the same button', ln)
        await gm.evaluate("(() => { const l = tw.actionLines.list().reverse().find(l => l.button === 'Take it underground'); return tw.actionLines.press(l.id); })()")
        ok = await wait(gm, f"(tw.entities()['{cid}'].recipe.y || 0) === -10", 15000, 'underground from chat')
        check(ok, "pressing the chat line's button takes the cave underground", await gm.evaluate(f"tw.entities()['{cid}'].recipe.y"))
        await gm.wait_for_timeout(1600); await gm.keyboard.press('Control+z'); await wait(gm, f"(tw.entities()['{cid}'].recipe.y || 0) === 0", 15000, 'undo again')
        await gm.evaluate(f"tw.offerCaveUnder('{cid}')"); await gm.evaluate("tw.condButtons.expire('cave-under')"); await gm.wait_for_timeout(900)
        await gm.evaluate(f"tw.goLevel(-10, 'test')"); await gm.wait_for_timeout(200)
        st = await gm.evaluate("tw.actionLines.list().reverse().find(l => l.button === 'Take it underground')?.state")
        await gm.evaluate(f"tw.batch([{{ type: 'room.move', args: {{ id: '{cid}', dx: 0, dz: 0, dy: -10 }} }}])"); await gm.wait_for_timeout(300)
        st2 = await gm.evaluate("tw.actionLines.list().reverse().find(l => l.button === 'Take it underground')?.state")
        check(st is None and st2 == 'no longer applies', 'a chat line whose cave has gone underground some other way greys out ("no longer applies")', [st, st2])
        await gm.keyboard.press('Control+z'); await wait(gm, f"(tw.entities()['{cid}'].recipe.y || 0) === 0", 15000, 'undo move')
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(1500)

        print('3. A LEVEL CHANGE MOVES THE VIEW, THE METER AND A BIG HAND TOGETHER')
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(1500)
        r = await gm.evaluate("""(() => { const n = tw.levelAnims.length, t0 = performance.now(); tw.goLevel(10, 'test'); const ms = performance.now() - t0; return { ms, level: tw.level, rec: tw.levelAnims[n] || null }; })()""")
        check(r['ms'] < 50 and r['level'] == 10, 'the level changes at once: nothing waits on the animation', f"{r['ms']:.1f} ms")
        await gm.wait_for_timeout(1500)
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(1500)
        await gm.mouse.move(700, 450)
        r = await sampled(gm, lambda: gm.keyboard.press(']'))
        check(moved_ok(r, 10), '] : the view rises one storey over ≥ 0.5 s with ≥ 8 interim frames (camera focus sampled every frame)', r)
        check(r['hand_positions'] >= 8 and r['hand_phases'] == ['grab', 'release'] and r['meter_w_max'] >= 140, 'the big hand grabs the marker, drags it through ≥ 8 positions and lets go; the meter opens wide (≥ 140 px)', r)
        check(r['lag_ms'] is not None and r['lag_ms'] < 200, 'the move starts within 0.2 s of the key', r['lag_ms'])
        hw = await gm.evaluate("document.querySelector('#levelCursor svg')?.getAttribute('width')")
        check(hw == '40', 'the hand is twice a pointer\'s size (40 px)', hw)
        rr = await gm.evaluate("(() => { const a = tw.levelAnims[tw.levelAnims.length - 1]; return { flash: tw.levelAnimating(), ghost: !!document.querySelector('#levelMeter .lm-ghost'), hand: !document.getElementById('levelCursor').hidden, readout: !document.getElementById('levelReadout').hidden, dur: a.endAt ? a.endAt - a.at : null, text: document.getElementById('levelReadout').textContent }; })()")
        check(not rr['flash'] and not rr['ghost'] and not rr['hand'] and not rr['readout'] and rr['text'] == 'Ground \u2192 Level 2' and rr['dur'] and rr['dur'] >= 1200, 'the whole change lasts ≥ 1.2 s (Harry 11-13: "a bit too fast"), then it has folded back: no copy, no hand, no readout (it read "Ground → Level 2")', rr)
        # a second change in flight retargets from where the view is
        await gm.evaluate("tw.goLevel(0, 'test'); setTimeout(() => tw.goLevel(20, 'test'), 250)"); await gm.wait_for_timeout(2000)
        fy = await gm.evaluate("tw.main.grab.focus.y")
        check(abs(fy - 20) < 0.01 and await gm.evaluate("document.querySelectorAll('#levelMeter .lm-ghost').length") == 0, 'a change in flight retargets: the view ends on the last level asked for', fy)
        # a pointer press during a move still lands (nothing blocks input)
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(60)
        blocked = await gm.evaluate("(() => { const q = document.getElementById('levelCursor').getBoundingClientRect(), e = document.elementFromPoint(q.left + 10, q.top + 10); return e && (e.closest('#levelCursor') || e.closest('#levelReadout')) ? 'blocked' : 'through'; })()")
        check(blocked == 'through', 'the hand and the readout take no pointer: a click there reaches what is under them', blocked)
        await gm.wait_for_timeout(1500)

        print('3. REDUCED MOTION: instant, no hand')
        await gm.emulate_media(reduced_motion='reduce')
        r = await sampled(gm, lambda: gm.evaluate("tw.goLevel(10, 'test')"))
        check(r['interim'] == 0 and r['hand_phases'] == [] and abs(r['to'] - 10) < 0.01, 'prefers-reduced-motion: the view is on the new level at once, no interim frames, no hand', r)
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.emulate_media(reduced_motion='no-preference'); await gm.wait_for_timeout(1200)

        print('5. A BUILDING GENERATED THE OLD WAY loads and re-rolls as it was')
        await gm.evaluate("(() => { const r = tw.freeGroundFor(12, 8); tw.makeBuilding({ code: 'TAV', x: r.x, z: r.z, w: 12, d: 8, seed: 11, storeys: 2, front: 'S' }, { name: 'Old inn' }); })()")
        await wait(gm, f"{ROOMS}.some(r => r.building === tw.lastBuilding && r.recipe.y === -10)", 60000, 'old inn')
        oid = await gm.evaluate("tw.lastBuilding")
        sig = f"JSON.stringify({ROOMS}.filter(r => r.building === '{oid}').map(r => [r.id, r.recipe.type, r.recipe.x, r.recipe.z, r.recipe.y || 0]).sort())"
        s0 = await gm.evaluate(sig); g0 = await gm.evaluate(f"tw.entities()['{oid}'].gen")
        check('cellar' not in g0 and g0['storeys'] == 2, 'a building made before this change stores no cellar flag (storeys 2)', g0)
        await wait(gm, "tw.storeyTour?.end || !tw.storeyTour", 20000, 'tour over')
        await gm.reload(wait_until='domcontentloaded', timeout=90000); check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000), 'reloaded')
        await wait(gm, f"!!tw.entities()['{oid}']", 30000, 'old inn back'); await gm.wait_for_timeout(1500)
        check(await gm.evaluate(sig) == s0, 'after a reload: the same rooms, on the same storeys', '')
        check(await gm.evaluate("tw.levelAnims.length") == 0, 'a reload putting you back on your level is not animated', await gm.evaluate("tw.levelAnims"))
        await gm.evaluate(f"tw.regenBuilding('{oid}', {{ seed: 12 }})")
        ok = await wait(gm, f"tw.entities()['{oid}'].gen.seed === 12 && {ROOMS}.some(r => r.building === '{oid}' && r.recipe.y === -10) && {ROOMS}.some(r => r.building === '{oid}' && r.recipe.y === 10)", 60000, 'old reroll')
        check(ok, 'its re-roll keeps two storeys and the cellar (the old default is what it stored)', await gm.evaluate(f"[...new Set({ROOMS}.filter(r => r.building === '{oid}').map(r => r.recipe.y || 0))]"))

        print('5. A SAVED CAMPAIGN WITH THREE STOREYS (corpus copy) loads unchanged')
        if os.path.isdir(os.path.join(data, OLD)):
            tok = old_token(data)
            stS = json.load(open(os.path.join(data, OLD, 'snapshot.json')))['state']  # (the campaign as saved)
            want = {}
            AR = stS.get('areas') or {}
            for aid, a in (AR.items() if isinstance(AR, dict) else [(a.get('id'), a) for a in AR]):
                for e in (a.get('entities') or {}).values():
                    if e.get('kind') == 'room': want[e['id']] = [aid, e['recipe'].get('y', 0), e['recipe']['x'], e['recipe']['z'], e['recipe']['w'], e['recipe']['d']]
            p2 = await ctx.new_page(); p2.on('pageerror', lambda e: errors.append(f'pageerror(old): {e}'))
            await p2.goto(page + f'#s={tok}', wait_until='domcontentloaded', timeout=90000); await p2.bring_to_front()  # (a tab in the background gets no animation frames)
            check(await wait(p2, 'window.tw && tw.ready && tw.ready()', 90000), 'the old campaign opens')
            await p2.wait_for_timeout(2500)
            got = await p2.evaluate("(() => { const out = {}, v = tw.sync.view(tw.area()); for (const e of Object.values(v.entities)) if (e.kind === 'room') out[e.id] = [tw.area(), e.recipe.y || 0, e.recipe.x, e.recipe.z, e.recipe.w, e.recipe.d]; return out; })()")
            here = {k: v for k, v in want.items() if v[0] == await p2.evaluate('tw.area()')}
            check(here and got == here, f"its area's {len(here)} rooms are exactly as saved, storeys included", sorted({v[1] for v in got.values()}))
            m = await p2.evaluate(METER)
            check(not m['single'] and m['rail'], 'with rooms on several storeys its meter is open as before', m)
            check(await p2.evaluate("tw.levelAnims.length") == 0, 'opening it is not animated', '')
            await p2.close()
        else: check(False, 'the corpus campaign is there', OLD)

        bad_err = [e for e in errors if not any(x in e for x in ('favicon', 'net::ERR', 'tuner/version.json', 'tw-ratings', 'status of 404'))]  # (the local test server has no tuner version stamp and no ratings service)
        check(not bad_err, 'no page errors', bad_err[:3])
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
n_ok = sum(1 for r in results if r[0]); print(f'\nlevels advanced: {n_ok}/{len(results)} passed'); sys.exit(0 if n_ok == len(results) else 1)

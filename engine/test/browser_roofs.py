#!/usr/bin/env python3
"""Roofs (storeys, Stage F; docs/VERTICAL.md "Roofs", docs/UI.md "Roofs"). GM tab + player tab.

  local:  TW_GPU=1 python3 engine/test/browser_roofs.py --local
  shots:  ... browser_roofs.py --local --shots     (full look; engine/test/shots/roofs-<style>.png for a Gemini blind read)

An inn: a common room and a kitchen on the ground, one guest room upstairs over part of the common room (the rest of the
common room's top is a flat deck), and a cottage standing apart with a room hidden from players beside it.
  SWITCH     no roof until "Roofs on"; on, one roof per room with nothing above it; a yard and a cellar get none
  CUT        a roof hides when the cut goes into the room under it and returns when the cut lifts; double-click a roof
  STYLE      per building and per room; syncs to the other tab; survives a reload; AI seats read it
  TRIM       a chimney exactly over each fireplace; re-roll changes the seed and the same seed gives the same trim
  SELECT     a roof is selected by a click ('roof:<room>'), has a ring (re-roll, menu: Style, Hide roof); hide and show
  TOUCH      "everything on screen is touchable" with roofs on; nothing under a roof can be picked through it
  STAND      a pawn dropped on the flat deck stands at deck height; on a pitched roof it goes to the ridge
  SECRETS    a hidden room's roof never reaches the player; the GM gets none for it either
  LAMPS      rooms under a roof that is showing have their lamps out
"""
import argparse, asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
from audit import AUDIT  # noqa: E402
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = 18091, 18716
def start_local(full=False):
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-roofs-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro' + ('' if full else '&faces=1500')

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def view(pg, x, z, dist=110, pitch=58, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(250)
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over')
    await pg.wait_for_timeout(300)

SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
# FRAME (2026-10-20, the world-sized ring): the ring is sized in feet at the piece and may run under the top bar, so a
# suite that clicks ring buttons first puts the selection's ring centre (tw.ringAnchor()) at a point of the screen
# (fy: a share of its height) by moving the camera's focus; returns the anchor
FRAME = """async ([dist, pitch, fy]) => { const g = tw.main.grab, sleep = (ms) => new Promise(r => setTimeout(r, ms));
  g.pitch = pitch; g.yaw = 0; g.dist = dist; tw.main.rule = 'free'; g.update(); await sleep(150);
  for (let i = 0; i < 8; i++) { const an = tw.ringAnchor(); if (!an) break; const ex = an.x - innerWidth / 2, ey = an.y - innerHeight * fy; if (Math.hypot(ex, ey) < 4) break;
    const p0 = tw.screenOf(g.focus.x, g.focus.z), p1 = tw.screenOf(g.focus.x + 1, g.focus.z), p2 = tw.screenOf(g.focus.x, g.focus.z + 1);
    const a11 = p1.x - p0.x, a12 = p2.x - p0.x, a21 = p1.y - p0.y, a22 = p2.y - p0.y, det = a11 * a22 - a12 * a21; if (!det) break;
    g.focus.x += (a22 * ex - a12 * ey) / det; g.focus.z += (-a21 * ex + a11 * ey) / det; g.update(); await sleep(150); }
  await sleep(200); return tw.ringAnchor(); }"""
ROOFS = "(() => { const w = tw.worldOf(tw.area()); return Object.fromEntries(w.roofReport().map(r => [r.room, r])); })()"
# a screen point over a roof plane of this room (its box's top centre, nudged), or null
ROOF_PT = """(id) => { const w = tw.worldOf(tw.area()), rec = w.roofRecs.get(id); if (!rec) return null; const b = rec.box;
  for (const [fx, fz] of [[0.5, 0.5], [0.3, 0.5], [0.7, 0.5], [0.5, 0.3], [0.5, 0.7], [0.25, 0.25], [0.75, 0.75]]) { const x = b.min.x + (b.max.x - b.min.x) * fx, z = b.min.z + (b.max.z - b.min.z) * fz, y = w.roofPlan.heightAt(x, z); if (y == null) continue;
    const s = tw.screenOf(x, z, tw.main, y), h = w.pickAll(tw.rayAt(s.x, s.y))[0]; if (h && h.roof === id) return { x: s.x, y: s.y, wx: x, wz: z }; }
  return null; }"""
ROOF_AUDIT = """(() => { const w = tw.worldOf(tw.area()), c = document.getElementById('c').getBoundingClientRect(); let tested = 0, bad = 0, through = 0;
  for (let i = 0; i < 64; i++) for (let j = 0; j < 40; j++) { const x = c.left + (i + 0.5) * c.width / 64, y = c.top + (j + 0.5) * c.height / 40, ray = tw.rayAt(x, y);
    const h = ray.intersectObjects([w.roofLayer], true).find(h => h.object.isMesh && h.object.visible && h.object.parent?.visible !== false); if (!h) continue;
    let o = h.object, vis = true; for (let q = o; q; q = q.parent) if (!q.visible) vis = false; if (!vis) continue;
    tested++; const hits = w.pickAll(ray), sel = hits.map(x => tw.selectionFor(x)).filter(Boolean);
    if (!sel.some(s => s.startsWith('roof:'))) bad++;
    for (const k of hits) { const e = k.entity; if (e && (e.kind === 'object' || e.kind === 'room') && k.point && k.point.distanceTo(ray.ray.origin) > h.distance + 0.5) through++; } }
  return { tested, bad, through }; })()"""

async def main():
    full = A.shots
    page = start_local(full) if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, permissions=['clipboard-read', 'clipboard-write'], reduced_motion='reduce')  # (the ring's slide is not what this suite tests)
            if os.environ.get('TW_SLOW_ASSETS'):  # every mesh arrives late (ms), as on a slow line: stand-ins and placeholders stay up longer
                async def _slow(route): await asyncio.sleep(int(os.environ['TW_SLOW_ASSETS']) / 1000); await route.continue_()
                await ctx.route('**/*.glb', _slow)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url); return pg
        gm = await tab(page, *((1920, 1080) if full else (1400, 900)))
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST roofs {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')

        R = {}
        for (name, a) in (('common', dict(type='common', x=0, z=0, w=6, d=4, seed=6101)), ('kitchen', dict(type='kitchen', x=6, z=0, w=4, d=4, seed=6102)),
                          ('up', dict(type='guest', x=0, z=0, w=4, d=4, y=10, seed=6103)), ('cellar', dict(type='cellar', x=6, z=0, w=3, d=3, y=-10, seed=6105)),
                          ('yard', dict(type='yard', x=0, z=4, w=6, d=3, seed=6106)),
                          ('cottage', dict(type='guest', x=14, z=6, w=4, d=3, seed=6107)), ('secret', dict(type='storeroom', x=18, z=6, w=3, d=3, seed=6108))):
            rid = f"room_rf{name}{random.randrange(10**6):06d}"[:24]
            R[name] = await gm.evaluate(SPAWN, {'id': rid, **a})
            check(await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, name), f'{name} built' + (f" at {a.get('y')} ft" if a.get('y') else ''))
        await settle(gm)
        E = lambda id: f"tw.entities()['{id}']"
        b_inn = await gm.evaluate(E(R['common']) + '.building'); b_cot = await gm.evaluate(E(R['cottage']) + '.building')
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{R['secret']}'], hidden: true }})"); await gm.wait_for_timeout(400)
        await view(gm, 45, 18, 150, 55)

        if A.shots: return await shots(gm, R, b_inn, b_cot, browser)

        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
        pl = await tab(invite + '&nofx')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab joined')
        await settle(pl)

        # ================= SWITCH =================
        print('SWITCH: roofs only after "Roofs on"')
        r = await gm.evaluate(ROOFS)
        check(r == {} and not await gm.evaluate('tw.roofs'), 'no roof is drawn until asked (today\'s open-topped look is unchanged)')
        lit0 = await gm.evaluate('tw.worldOf(tw.area()).litCount()')
        cutlog0 = await gm.evaluate('tw.cutLog.length')
        await gm.evaluate("(() => { const g = tw.main.grab; g.dist = g.maxDist; g.update(); })()"); await gm.wait_for_timeout(700)
        check(not await gm.evaluate("tw.condButtons.has('roofs-on')") and not await gm.evaluate('tw.roofs') and await gm.evaluate(ROOFS) == {}, 'zoomed all the way out: nothing is offered and nothing has changed by itself (the "Roofs on" button is gone, 2026-10-06)')
        rb = await gm.evaluate("tw.cutBar().roof"); await gm.mouse.click(8, rb['at'][1]); await gm.mouse.move(700, 400); await gm.wait_for_timeout(700)
        r = await gm.evaluate(ROOFS)
        check(await gm.evaluate('tw.roofs') and all(r.get(R[k], {}).get('shown') for k in ('common', 'kitchen', 'up', 'cottage')), 'the roofs position at the top of the level meter draws the roofs: one per room with nothing above it', {k: (r.get(R[k]) or {}).get('kind') for k in R})
        check(R['yard'] not in r and R['cellar'] not in r, 'a yard and a cellar get no roof')
        check(R['secret'] not in r, 'a room hidden from players gets no roof on the GM\'s side either')
        check(r[R['common']]['kind'] == 'flat' and r[R['up']]['kind'] in ('gable', 'hip') and r[R['common']]['base'] == 10 and r[R['up']]['base'] == 20, 'the part of the common room with nothing built on it is a flat deck at 10 ft; the upper room carries the pitched roof at 20 ft', {k: (r[R[k]]['kind'], r[R[k]]['base']) for k in ('common', 'up', 'kitchen')})
        bar = await gm.evaluate('tw.cutBar()')
        check('roofs on' in bar['textShown'].lower(), 'the level indicator says roofs are on', bar['textShown'])
        await view(gm, 45, 18, 150, 55)
        lit1 = await gm.evaluate('tw.worldOf(tw.area()).litCount()')
        check(lit1 < lit0 or lit0 == 0, 'lamps in rooms under a roof that is showing are out', f'{lit0} -> {lit1}')
        labels = await gm.evaluate(f"['{R['kitchen']}', '{R['cottage']}'].map(id => tw.roomCovered(tw.entities()[id]))")
        check(all(labels), 'a room under its roof counts as covered (no label over it; its building\'s label stays)')

        # ================= CUT =================
        print('CUT: a roof hides when you look into the room under it')
        pt = await gm.evaluate(ROOF_PT, R['kitchen'])
        check(bool(pt), 'a point on the kitchen roof picks the roof', pt)
        await gm.mouse.dblclick(pt['x'], pt['y']); await gm.wait_for_timeout(500)
        r = await gm.evaluate(ROOFS)
        check(await gm.evaluate('tw.cut.y') == 9 and not r[R['kitchen']]['shown'] and not r[R['up']]['shown'] and not r[R['common']]['shown'], 'double-click a roof: the cut goes to the ceiling of the room under it; roofs above that cut are not drawn', {'cut': await gm.evaluate('tw.cut.y')})
        check(await gm.evaluate('tw.roofs'), 'the roofs switch itself is unchanged by the cut')
        await gm.evaluate("tw.setCut(19, { by: 'test' })"); await gm.wait_for_timeout(300)
        r = await gm.evaluate(ROOFS)
        check(r[R['kitchen']]['shown'] and r[R['common']]['shown'] and not r[R['up']]['shown'], 'cut at lv 2: the ground floor\'s roofs (base 10 ft) show, the upper room\'s (base 20 ft) does not')
        await gm.evaluate("tw.cutOff('test')"); await gm.wait_for_timeout(300)
        r = await gm.evaluate(ROOFS)
        check(all(v['shown'] for v in r.values()), 'the cut lifts off: every roof is back')

        # ================= STYLE =================
        print('STYLE: per building, per room; synced; survives a reload')
        auto = r[R['kitchen']]['style']
        await pl.evaluate("tw.setRoofs(true, 'test')"); await pl.wait_for_timeout(600)
        rp = await pl.evaluate(ROOFS)
        check(R['kitchen'] in rp and rp[R['kitchen']]['style'] == auto and R['secret'] not in rp, f'the player, roofs on, sees the same roofs in the same style ({auto}: from the wall family)')
        await gm.evaluate(f"tw.dispatch('building.set', {{ id: '{b_inn}', roof: 'slate' }})")
        await wait(pl, f"tw.worldOf(tw.area()).roofReport().find(r => r.room === '{R['kitchen']}')?.style === 'slate'", 8000, 'style sync')
        r = await gm.evaluate(ROOFS); rp = await pl.evaluate(ROOFS)
        check(all(r[R[k]]['style'] == 'slate' and rp[R[k]]['style'] == 'slate' for k in ('kitchen', 'up')) and r[R['cottage']]['style'] != 'slate' or r[R['cottage']]['style'] == auto, "a building's style changes all its roofs, in both tabs; the cottage keeps its own", {k: r[R[k]]['style'] for k in ('kitchen', 'up', 'cottage')})
        await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{R['kitchen']}', roof: {{ style: 'tile' }} }})")
        await wait(pl, f"tw.worldOf(tw.area()).roofReport().find(r => r.room === '{R['kitchen']}')?.style === 'tile'", 8000, 'room style sync')
        r = await gm.evaluate(ROOFS)
        check(r[R['kitchen']]['style'] == 'tile' and r[R['up']]['style'] == 'slate', 'one room can wear its own style (the kitchen: clay tile) while the rest keep the building\'s')
        await gm.reload(); check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab back after a reload')
        await settle(gm); await gm.wait_for_timeout(800)
        r = await gm.evaluate(ROOFS)
        check(await gm.evaluate('tw.roofs') and r.get(R['kitchen'], {}).get('style') == 'tile' and r.get(R['up'], {}).get('style') == 'slate' and r[R['up']]['shown'], 'after the reload: roofs still on, the styles as they were set')
        await view(gm, 45, 18, 150, 55)

        # ================= TRIM =================
        print('TRIM: a chimney over each fireplace; re-roll by seed')
        fires = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'object' && /^(fireplace|hearth|cook-hearth)/.test(e.cat || '') && (e.y || 0) >= 0 && !e.hidden).map(e => ({ id: e.id, x: e.x, z: e.z, cat: e.cat, room: e.room }))")
        stacks = [p for v in r.values() for p in v['props'] if p['role'] == 'chimney']
        ok = len(fires) > 0 and len(stacks) == len(fires) and all(any(abs(s['x'] - f['x']) < 1e-6 and abs(s['z'] - f['z']) < 1e-6 and s['fire'] == f['id'] for s in stacks) for f in fires)
        check(ok, 'every fireplace has a chimney straight above it (same x and z), out of the topmost roof over it', f"{len(fires)} fires {[f['cat'] for f in fires]}, {len(stacks)} chimneys")
        tops = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()); return w.roofReport().flatMap(r => r.props.filter(p => p.role === 'chimney').map(p => [p.y + p.dims[1], w.roofPlan.heightAt(p.x, p.z)])); })()")
        check(all(t[0] > t[1] + 2 for t in tops), 'each chimney rises above the roof where it comes out', tops[:3])
        # THE KIT'S OWN TRIM, MEASURED where it stands (2026-10-06): nothing floats, nothing is stretched out of shape
        await wait(gm, "(() => { const k = tw.worldOf(tw.area()).kitReport().filter(k => k.kind === 'roof'); return k.length > 0 && k.every(x => x.loaded || x.standIn); })()", 40000, 'trim meshes')
        kr = [k for k in await gm.evaluate("tw.worldOf(tw.area()).kitReport()") if k['kind'] == 'roof']
        boxes = await gm.evaluate("(() => { const L = tw.roomgen.lib, out = {}; for (const id of ['chimney-stack', 'roof-dormer', 'parapet-straight', 'parapet-corner', 'roof-finial', 'roof-ridge']) for (const k of L.objects[id]?.skus || []) { const s = k.size?.length === 3 ? k.size : L.objects[id].size; if (s) out[k.sku] = [s[0] / 12, s[2] / 12, s[1] / 12]; } return out; })()")  # each sku's stated box [w, h, d] ft
        ch = [k for k in kr if k['role'] == 'chimney']
        def shape_ok(k):
            b = boxes.get(k['sku']); w = sorted([k['max'][0] - k['min'][0], k['max'][2] - k['min'][2]]); h = k['max'][1] - k['min'][1]
            return b and abs((h / w[1]) / (b[1] / max(b[0], b[2])) - 1) < 0.12 and abs((h / w[0]) / (b[1] / min(b[0], b[2])) - 1) < 0.12
        check(ch and all(not k['standIn'] and k['min'][1] <= k['roofAt'] + 0.01 and k['max'][1] > k['ridgeY'] and shape_ok(k) for k in ch), 'every chimney is the kit\'s stack: its foot at or below the roof where it comes out, its top above the ridge, in its own proportions (a taller stack is chosen, none is stretched)', str([(k['sku'], k['min'][1], k['roofAt'] and round(k['roofAt'], 2), k['max'][1], round(k['ridgeY'], 2)) for k in ch]))
        pa = [k for k in kr if k['role'] == 'parapet']; co = [k for k in kr if k['role'] == 'corner']
        check(pa and all(not k['standIn'] and abs(max(k['max'][0] - k['min'][0], k['max'][2] - k['min'][2]) - 5) < 0.15 and min(k['max'][0] - k['min'][0], k['max'][2] - k['min'][2]) < 1.3 and abs(k['min'][1] - k['roofAt']) < 0.2 for k in pa), 'the ledge round a flat roof is the kit\'s parapet: 5-ft sections end to end, standing on the deck', f"{len(pa)} sections, {len(co)} piers; e.g. {pa[0]['min'] if pa else None} {pa[0]['max'] if pa else None}")
        rg = [k for k in kr if k['role'] == 'ridge']
        check(rg and all(not k['standIn'] and k['loaded'] and k['min'][1] < k['ridgeY'] < k['max'][1] + 0.01 and k['max'][1] - k['ridgeY'] < 1.2 for k in rg), 'the ridge cap is the kit\'s ridge section laid along every ridge, sunk over the ridge line', f"{len(rg)} sections, sku {rg[0]['sku'] if rg else None}")
        do = [k for k in kr if k['role'] == 'dormer']
        check(all(not k['standIn'] and k['min'][1] <= k['roofAt'] - 0.4 for k in do), 'a dormer is sunk into its slope (no floating front)', str([(k['sku'], k['min'][1], round(k['roofAt'], 2)) for k in do]))
        def trim(v): return sorted((p['role'], round(p['x'], 2), round(p['z'], 2)) for p in v['props'] if p['role'] != 'chimney')
        seen = {}
        for seed in (11, 12, 13, 14, 15, 16, 17, 18, 11):
            await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{R['cottage']}', roof: {{ seed: {seed} }} }})"); await gm.wait_for_timeout(350)
            v = (await gm.evaluate(ROOFS))[R['cottage']]
            if seed in seen: check(seen[seed] == trim(v), 'the same seed gives the same trim again (deterministic)', trim(v))
            seen[seed] = trim(v)
        check(len({json.dumps(t) for t in seen.values()}) > 1, 're-rolling (a new seed) changes the trim', {k: len(v) for k, v in seen.items()})
        kit = await gm.evaluate("tw.worldOf(tw.area()).roofPlan.kit")
        print('    trim pieces:', {k: (v['cat'], 'stand-in' if v['standIn'] else 'real') for k, v in kit.items()})

        # ================= SELECT =================
        print('SELECT: a roof is selected and edited like a room')
        pt = await gm.evaluate(ROOF_PT, R['cottage'])
        await gm.mouse.click(pt['x'], pt['y']); await gm.wait_for_timeout(500)
        sel = await gm.evaluate('[...tw.sel]')
        check(sel == ['roof:' + R['cottage']], "a click on a roof selects it ('roof:<room>')", sel)
        sig = await gm.evaluate("tw.worldOf(tw.area()).lastSignals")
        check(any(s.startswith('roof:' + R['cottage']) for s in sig), 'it wears the selection look', sig)
        ring = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn')].map(b => b.dataset.cmd || (b.dataset.menu !== undefined ? 'menu' : b.className))")
        check('roof.reroll' in ring and 'menu' in ring, 'its ring: re-roll (a die) and the menu', ring)
        seed0 = await gm.evaluate(E(R['cottage']) + '.roof?.seed')
        await gm.click('#ring [data-cmd="roof.reroll"]'); await gm.wait_for_timeout(500)
        check(await gm.evaluate(E(R['cottage']) + '.roof?.seed') != seed0, 'the die re-rolls the roof (a new seed on the room)')
        await gm.evaluate(FRAME, [110, 52, 0.6])  # (the world-sized ring: its open circle on screen, clear of the top bar)
        await gm.click('#ring [data-menu]'); await gm.wait_for_timeout(800)
        opened = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn')].map(b => b.dataset.cmd || b.dataset.group || '').filter(Boolean)")
        check('roof.style.' in opened and 'roof.hide' in opened and not any(c in opened for c in ('edit.delete', 'thing.hide', 'thing.lock', 'thing.pin')), 'the open menu: Style and Hide roof, and none of a thing\'s options', opened)
        check(await gm.evaluate('tw.menuOrphans?.length || 0') == 0, 'no command is missing from the menu table', await gm.evaluate('tw.menuOrphans'))
        await gm.click('#ring [data-group="roof.style."]'); await gm.wait_for_timeout(800)
        # (2026-10-20: a sub-menu is the ring grown outward, one button per item, not a panel of tiles)
        tiles = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn[data-nest]')].map(b => ({ cmd: b.dataset.cmd, pic: !!b.querySelector('img.pic') && !b.querySelector('img.pic').src.endsWith('/null') }))")
        check(len([t for t in tiles if (t['cmd'] or '').startswith('roof.style.')]) >= 4 and sum(t['pic'] for t in tiles) >= 3 and (await gm.evaluate('tw.ringFlyout()') or {}).get('group') == 'roof.style.', 'Style lists the roofings as buttons of the grown ring, the textured ones with a swatch', tiles)
        await gm.click('#ring .rbtn[data-nest][data-cmd="roof.style.thatch"]') if any(t['cmd'] == 'roof.style.thatch' for t in tiles) else await gm.click('#ring .rbtn[data-nest][data-cmd="roof.style.slate"]')
        want = 'thatch' if any(t['cmd'] == 'roof.style.thatch' for t in tiles) else 'slate'
        await wait(pl, f"tw.worldOf(tw.area()).roofReport().find(r => r.room === '{R['cottage']}')?.style === '{want}'", 8000, 'menu style sync')
        check((await gm.evaluate(ROOFS))[R['cottage']]['style'] == want and (await pl.evaluate(ROOFS))[R['cottage']]['style'] == want, f'picking one changes that roof here and in the other tab ({want})')
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        await gm.evaluate(f"tw.select('roof:{R['cottage']}')"); await gm.wait_for_timeout(200)
        await gm.keyboard.press('/'); await gm.keyboard.type('hide roof', delay=8); await gm.wait_for_timeout(350); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(600)
        r = await gm.evaluate(ROOFS)
        check(R['cottage'] not in r and await gm.evaluate(E(R['cottage']) + '.roof?.off') is True and await gm.evaluate('tw.sel.size') == 0, '"Hide roof" (from the bar): the cottage goes without a roof, and the roof is no longer selected')
        await wait(pl, f"!tw.worldOf(tw.area()).roofReport().some(r => r.room === '{R['cottage']}')", 8000, 'hide sync')
        check(R['cottage'] not in await pl.evaluate(ROOFS), 'the other tab loses it too')
        await gm.evaluate("tw.undo()"); await gm.wait_for_timeout(700)
        check(R['cottage'] in await gm.evaluate(ROOFS), 'undo brings the roof back')
        await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{R['cottage']}', roof: {{ off: true }} }})"); await gm.wait_for_timeout(400)
        await gm.evaluate(f"tw.select('{R['cottage']}')"); await gm.wait_for_timeout(200)
        await gm.keyboard.press('/'); await gm.keyboard.type('show roof', delay=8); await gm.wait_for_timeout(350); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(600)
        check(R['cottage'] in await gm.evaluate(ROOFS), 'a room without a roof offers "Show roof", which puts it back')
        await gm.evaluate("tw.select([])")

        # ================= TOUCH =================
        print('TOUCH: everything on screen is touchable with roofs on; nothing is picked through a roof')
        for (nm_, v) in (('table distance', (25, 10, 90, 58)), ('overhead', (25, 10, 120, 88))):
            await view(gm, *v); await gm.wait_for_timeout(300)
            a = await gm.evaluate(AUDIT); ra = await gm.evaluate(ROOF_AUDIT)
            check(a['nbad'] == 0, f'{nm_}: the touchable audit holds with roofs on', f"{a['tested']} tested, {a['nbad']} bad {a['kinds']}")
            check(ra['tested'] > 100 and ra['bad'] == 0 and ra['through'] == 0, f'{nm_}: every point of a roof picks that roof, and nothing beyond it', ra)
        await view(gm, 45, 18, 150, 55)

        # ================= STAND =================
        print('STAND: flat decks and ridges')
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_roofwalk01', name: 'Cat', x: 40, z: 40 })"); await wait(gm, "tw.entities()['tok_roofwalk01']", 5000)
        deck = await gm.evaluate("(() => { const s = tw.screenOf(27.5, 12.5, tw.main, 10); const g = tw.worldOf(tw.area()).floorPoint(tw.rayAt(s.x, s.y).ray, { max: tw.floorMax() }); return { s, g }; })()")
        check(deck['g'] and deck['g']['y'] == 10 and deck['g'].get('roof') == R['common'], 'the pointer over the flat deck is on the deck, at 10 ft', deck['g'])
        s0 = await gm.evaluate("(() => { const e = tw.entities()['tok_roofwalk01']; return tw.screenOf(e.x, e.z, tw.main, 1.5); })()")
        await gm.mouse.move(s0['x'], s0['y']); await gm.mouse.down()
        for i in range(1, 13): await gm.mouse.move(s0['x'] + (deck['s']['x'] - s0['x']) * i / 12, s0['y'] + (deck['s']['y'] - s0['y']) * i / 12); await gm.wait_for_timeout(25)
        await gm.mouse.up(); await gm.wait_for_timeout(900)
        cat = await gm.evaluate("tw.entities()['tok_roofwalk01']")
        check(abs((cat.get('y') or 0) - 10) < 0.01 and abs(cat['x'] - 27.5) < 3 and abs(cat['z'] - 12.5) < 3, 'a pawn dropped on the flat deck stands on it, at deck height', {k: cat.get(k) for k in ('x', 'y', 'z')})
        rid = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), rec = w.roofRecs.get('{R['kitchen']}'), b = rec.box, x = b.min.x + (b.max.x - b.min.x) * 0.5, z = b.min.z + (b.max.z - b.min.z) * 0.25, y = w.roofPlan.heightAt(x, z), s = tw.screenOf(x, z, tw.main, y); return {{ g: w.floorPoint(tw.rayAt(s.x, s.y).ray, {{ max: tw.floorMax() }}), ridgeY: rec.roof.ridgeY, spots: rec.roof.standable.length }}; }})()")
        check(rid['g'] and rid['g'].get('snapped') and abs(rid['g']['y'] - rid['ridgeY']) < 1e-6, 'the pointer over a pitched slope goes to the nearest place to stand: a point on the ridge', rid)

        # ================= SECRETS =================
        print('SECRETS: a hidden room\'s roof never reaches the player')
        rp = await pl.evaluate(ROOFS)
        check(R['secret'] not in rp and not await pl.evaluate(E(R['secret'])) and not any(p for v in rp.values() for p in v['props'] if 34 * 2.5 < p['x'] < 105 and 30 < p['z'] < 45 and v['room'] != R['cottage']), 'the player has roofs for the rooms they have and nothing over the hidden room', sorted(rp.keys()))
        raw = await pl.evaluate("JSON.stringify(tw.sync.view(tw.area()).entities)")
        check(R['secret'] not in raw, 'nothing in the player\'s state names it')
        # an AI seat reads roof styles over GET (local relay only)
        if A.local:
            st = await gm.evaluate("""async () => { const c = tw.sync.campaign.id, t = new URL(location.href).searchParams.get('seat') || tw.seatToken?.() || localStorage.getItem('tw.seat.' + c); if (!t) return null;
              const r = await fetch(`${tw.relayBase}/c/${c}/a/${tw.area()}/state?seat=${encodeURIComponent(t)}`); return r.ok ? r.json() : { err: r.status }; }""")
            if st and st.get('rooms'):
                k = next((x for x in st['rooms'] if x['id'] == R['kitchen']), None); y = next((x for x in st['rooms'] if x['id'] == R['yard']), None)
                check(k and k.get('roof', {}).get('style') == 'tile' and k['roof'].get('own') and y and 'roof' not in y and any(b.get('roof') == 'slate' for b in st.get('buildings', [])), 'an AI seat\'s "state" gives each room its roof style (and none for a yard), each building its style', k and k.get('roof'))
            else: print('    (no seat token reachable from the page: the GET read is covered by relay.test.mjs)', st)

        # ================= OFF =================
        print('OFF: "Roofs off" puts everything back')
        await gm.keyboard.press('/'); await gm.keyboard.type('roofs off', delay=8); await gm.wait_for_timeout(350); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(500)
        check(not await gm.evaluate('tw.roofs') and await gm.evaluate(ROOFS) == {} and await gm.evaluate('tw.worldOf(tw.area()).litCount()') >= lit1, '"Roofs off" in the bar: no roof is drawn, the rooms are open again')
        check(await gm.evaluate(f"tw.select('roof:{R['kitchen']}'), tw.selected().length") == 0, 'a roof that is not drawn cannot be selected')
        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'roofs: {passed}/{len(results)} passed')
    return passed == len(results)

async def shots(gm, R, b_inn, b_cot, browser):
    """full look, table distance, one picture per style, for a Gemini blind read"""
    await gm.evaluate("tw.setRoofs(true, 'shots'); tw.cutOff('shots')"); await gm.wait_for_timeout(1500)
    await gm.evaluate("document.body.classList.add('shot')")
    for style in ('thatch', 'tile', 'slate', 'shingle', 'flat'):
        await gm.evaluate(f"tw.batch([{{ type: 'building.set', args: {{ id: '{b_inn}', roof: '{style}' }} }}, {{ type: 'building.set', args: {{ id: '{b_cot}', roof: '{style}' }} }}])")
        await gm.wait_for_timeout(2500)
        await view(gm, 38, 14, 95, 48, -25); await gm.wait_for_timeout(1500)
        await gm.screenshot(path=os.path.join(SHOTS, f'roofs-{style}.png'))
        print('  shot', style, json.dumps([(r['kind'], r['style'], [(p['role'], p['cat']) for p in r['props']]) for r in await gm.evaluate("tw.worldOf(tw.area()).roofReport()")])[:400])
    await browser.close(); return True

try: ok = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
sys.exit(0 if ok else 1)

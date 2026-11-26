#!/usr/bin/env python3
"""PICKING AND DRAWING FIXES (bug sweep, 2026-11-06; docs/KNOWN_BUGS.md, docs/UI.md "What a click takes").

  TW_GPU=1 python3 engine/test/browser_pickfixes.py --local [--only WALL,CURSOR] [--shots]

  WALL      a click on a wall takes the wall, not the pawn standing behind it (the old stack order put every pawn
            under the ray first); a pawn in front of a wall, or its head showing over the wall's top, is still taken
            first, and a click again still cycles down to what is behind
  CURSOR    the hover cursor sits under the mouse on anything raised (Nick 2026-11-01: "a hover cursor effect that never
            comes out distant from the mouse"): over a table top it is drawn on the table, not on the floor under it
  TILT      things on a tilted table ride the table's top (they used to float at the flat table's height)
  REROLL    a re-roll keeps the walls the GM deleted deleted
  ROOFPAWN  with roofs switched off, a pawn standing on a roof is not drawn
"""
import argparse, asyncio, json, math, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--only', default='')
A = ap.parse_args()
ONLY = {s.strip().upper() for s in A.only.split(',') if s.strip()}
def want(s): return not ONLY or s in ONLY
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '23117,23118').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-pickfixes-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    import served; served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def view(pg, x, z, dist=60, pitch=40, yaw=0, y=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(400)
W = "tw.worldOf(tw.area())"
async def idle(pg): await wait(pg, "tw.sync.pendingCount() === 0", 30000, 'commands settled'); await pg.wait_for_timeout(350)
async def shot(pg, name):
    if A.shots: os.makedirs(SHOTS, exist_ok=True); await pg.screenshot(path=os.path.join(SHOTS, f'pickfixes-{name}.png'))

# every distinct thing under the screen point, as pickAll answers it, with how far from the camera its hit is
STACK = """((sx, sy) => { const w = %s, r = tw.rayAt(sx, sy, tw.main), cam = tw.main.camera.position;
  return w.pickAll(r).map(h => ({ id: h.entity?.id || (h.wall ? 'wall:' + h.wall : h.roof ? 'roof:' + h.roof : null), kind: h.wall ? 'wall' : h.entity?.kind, floor: !!h.floor, d: h.point ? cam.distanceTo(h.point) : null })); })""" % W

async def wall_section(gm):
    print('WALL: a click on a wall takes the wall, not the pawn behind it')
    await gm.evaluate("tw.spawnRoom('common', 0, 0, 6, 5, 4401)"); await idle(gm)
    # the camera looks from the south, over the near wall, at the FAR wall (z = 0): a pawn outside it, whose lower body
    # the wall hides and whose top shows over it, and a pawn inside, in front of that same wall
    await gm.evaluate("tw.dispatch('token.create', { id: 'tok_behind0001', name: 'Behind', x: 12.5, z: -10, fig: 'hero-fighter-dwarf-f' })")
    await gm.evaluate("tw.dispatch('token.create', { id: 'tok_front00001', name: 'Front', x: 17.5, z: 2.5, fig: 'hero-fighter-dwarf-f' })")
    await wait(gm, f"{W}.recs.has('tok_behind0001') && {W}.recs.has('tok_front00001')", 15000, 'pawns'); await idle(gm)
    await gm.evaluate("tw.select([])")
    await view(gm, 15, 2, 45, 35, 0, 3)
    await wait(gm, f"{W}.anims.size === 0", 20000, 'the room has finished building'); await gm.wait_for_timeout(500)  # (its walls rise one by one, the near ones last)
    await shot(gm, 'wall')
    # find screen points over the BEHIND pawn: one where a wall is the first hit and the pawn is behind it (the wall
    # face), one where the pawn is the first hit (its head over the wall's top)
    pts = await gm.evaluate(f"""(() => {{ const w = {W}, r = w.recs.get('tok_behind0001'), b = w.boundsOf(r), S = {STACK}, out = {{ wall: null, head: null, n: 0 }};
      const c = document.getElementById('c').getBoundingClientRect();
      const corners = []; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) corners.push(tw.screenOf(x, z, tw.main, y));
      const x0 = Math.max(c.left, Math.min(...corners.map(p => p.x))), x1 = Math.min(c.right, Math.max(...corners.map(p => p.x))), y0 = Math.max(c.top, Math.min(...corners.map(p => p.y))), y1 = Math.min(c.bottom, Math.max(...corners.map(p => p.y)));
      for (let sy = y0; sy <= y1; sy += 3) for (let sx = x0; sx <= x1; sx += 3) {{
        const st = S(sx, sy), i = st.findIndex(h => h.id === 'tok_behind0001'); if (i < 0) continue; out.n++;
        const wl = st.find(h => h.kind === 'wall'), me = st[i];
        const first = st.filter(h => !h.floor && h.d != null).sort((a, b) => a.d - b.d)[0];
        if (!out.wall && wl && first === wl && wl.d < me.d - 0.3) out.wall = {{ x: sx, y: sy, stack: st }}; // (the wall is the nearest thing there)
        if (!out.head && (!wl || wl.d > me.d)) out.head = {{ x: sx, y: sy, stack: st }};
      }}
      return out; }})()""")
    check(pts['wall'], 'the scene has a spot where the wall is nearer than the pawn behind it', {k: (v and v.get('stack')) for k, v in pts.items() if k != 'n'})
    check(pts['head'], 'and one where the pawn shows over the wall', pts['n'])
    if pts['wall']:
        p = pts['wall']; await gm.mouse.move(p['x'], p['y']); await gm.wait_for_timeout(250)
        hov = await gm.evaluate("tw.hover ? (tw.hover.id || tw.hover) : null")
        await gm.mouse.click(p['x'], p['y']); await gm.wait_for_timeout(500)
        sel = await gm.evaluate("[...tw.sel]")
        check(sel and sel[0].startswith('wall:'), 'a real click on the wall face selects the wall, not the pawn behind it', [sel, p['stack']])
        check(hov is None or 'tok_behind0001' not in json.dumps(hov), 'and the hover there is not the pawn', hov)
        await gm.mouse.click(p['x'], p['y']); await gm.wait_for_timeout(500)
        sel2 = await gm.evaluate("[...tw.sel]")
        check('tok_behind0001' in sel2, 'a click again at the same spot cycles down to the pawn behind', sel2)
        await gm.evaluate("tw.select([])"); await gm.mouse.move(5, 300); await gm.wait_for_timeout(300)
    if pts['head']:
        p = pts['head']; await gm.mouse.click(p['x'], p['y']); await gm.wait_for_timeout(500)
        sel = await gm.evaluate("[...tw.sel]")
        check(sel == ['tok_behind0001'], 'a click on the head over the wall still takes the pawn', [sel, p['stack']])
        await gm.evaluate("tw.select([])")
    # the pawn outside, in front of the same wall: taken first wherever it is hit
    fr = await gm.evaluate(f"""(() => {{ const w = {W}, b = w.boundsOf(w.recs.get('tok_front00001')), S = {STACK}; let n = 0, bad = [];
      for (let k = 0; k < 40; k++) {{ const x = b.min.x + (b.max.x - b.min.x) * (0.3 + 0.4 * (k % 5) / 4), y = b.min.y + (b.max.y - b.min.y) * (0.15 + 0.7 * Math.floor(k / 5) / 7), z = (b.min.z + b.max.z) / 2, p = tw.screenOf(x, z, tw.main, y), st = S(p.x, p.y);
        if (!st.some(h => h.id === 'tok_front00001')) continue; n++; if (st[0].id !== 'tok_front00001') bad.push(st.slice(0, 3)); }}
      return {{ n, bad: bad.slice(0, 3) }}; }})()""")
    check(fr['n'] >= 10 and not fr['bad'], 'a pawn in front of a wall is still first under the pointer wherever it is hit', fr)

async def invite(gm, tab, name='Mira'):
    await gm.keyboard.press('Escape'); await gm.keyboard.press('/'); await gm.keyboard.type(f'invite {name}', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
    await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
    link = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
    pl = await tab(link + '&nofx')
    check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), f'player tab ({name}) joined')
    return pl

async def cursor_section(gm, pl):
    print('CURSOR: another seat draws my cursor on what I point at, not on the floor behind it')
    if not await gm.evaluate(f"{W}.recs.has('tok_front00001')"):  # (run alone: the WALL scene)
        await gm.evaluate("tw.spawnRoom('common', 0, 0, 6, 5, 4401)"); await idle(gm)
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_front00001', name: 'Front', x: 17.5, z: 2.5, fig: 'hero-fighter-dwarf-f' })"); await idle(gm)
    await view(gm, 15, 12, 45, 35, 0, 3); await view(pl, 15, 12, 45, 50, 90, 3)  # (the player looks from the east: a floor point behind a table is far from it there)
    await wait(gm, f"{W}.anims.size === 0", 20000, 'built')
    # a spot over a thing's top (a raised surface: table, chair, shelf), one over the pawn, one over open ground
    spots = await gm.evaluate(f"""(() => {{ const S = {STACK}, c = document.getElementById('c').getBoundingClientRect(), out = {{}};
      for (let sy = c.top + 200; sy < c.bottom - 120 && !(out.thing && out.pawn); sy += 6) for (let sx = c.left + 150; sx < c.right - 150; sx += 6) {{
        const st = S(sx, sy), h = st[0]; if (!h || h.floor) continue;
        const r = tw.rayAt(sx, sy, tw.main), w = {W}, hit = w.pick(r);
        if (!out.thing && h.kind === 'object' && hit.point.y > 1.5) out.thing = {{ x: sx, y: sy, id: h.id, p: hit.point.toArray() }};
        if (!out.pawn && h.id === 'tok_front00001' && hit.point.y > 2) out.pawn = {{ x: sx, y: sy, id: h.id, p: hit.point.toArray() }};
      }}
      return out; }})()""")
    check(spots.get('thing') and spots.get('pawn'), 'the scene has a raised thing and a pawn to point at', spots)
    async def remote(p):  # where the player's seat draws the GM's cursor, once it has stopped gliding
        await gm.mouse.move(p['x'] + 2, p['y']); await gm.wait_for_timeout(120); await gm.mouse.move(p['x'], p['y'])
        await pl.wait_for_timeout(1500)
        return await pl.evaluate(f"(() => {{ const c = [...{W}.cursors.values()][0]; return c ? c.obj.position.toArray() : null; }})()")  # (where it is put: whether the fog lets it show is the fog's own suite)
    for k, what in (('thing', "a thing's top"), ('pawn', 'a pawn')):
        sp = spots.get(k)
        if not sp: continue
        at = await remote(sp)
        d = math.dist(at, sp['p']) if at else None
        check(at and d < 0.6, f"pointing at {what}, the other seat's cursor is on it (within 0.6 ft of the point under my mouse)", [at, sp['p'], d])
    g = await gm.evaluate("(() => { const c = document.getElementById('c').getBoundingClientRect(); for (let sy = c.top + 120; sy < c.bottom - 40; sy += 8) for (let sx = c.left + 60; sx < c.right - 60; sx += 8) { const h = tw.worldOf(tw.area()).pickAll(tw.rayAt(sx, sy, tw.main)); if (!h.length) { const p = tw.groundAt(sx, sy); return { x: sx, y: sy, p: [p[0], p.y || 0, p[1]] }; } } return null; })()")
    if g:
        at = await remote(g)
        check(at and math.dist(at, g['p']) < 0.6, 'over open ground it is on the ground, as before', [at, g['p']])
    pres = await pl.evaluate("tw.cursors()")
    check(len(pres) == 1, 'one cursor, the GM seat\'s', pres)

async def bar(pg, text):
    if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
    await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=8); await pg.wait_for_timeout(300); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(150)

# how far each thing standing on T floats over (or sinks under) what is under it, as drawn: its lowest drawn point
# against the highest surface (a thing's top that faces up, else the floor) under its middle
GAPS = """((ids) => { const w = %s, E = tw.entities(), out = [];
  for (const e of ids.map(id => E[id]).filter(Boolean)) { const r = w.recs.get(e.id); if (!r) continue; const b = w.boundsOf(r); if (!b) continue;
    const s = w.surfaceBelow(e.x, b.min.y + 0.3, e.z, new Set([e.id]), 0), under = s ? s.y : 0; out.push({ id: e.id, name: e.name, gap: +(b.min.y - under).toFixed(2), on: s?.parent || 'floor', parent: e.parent || null, y: e.y || 0 }); }
  return out; })""" % W

async def tilt_section(gm):
    print('TILT: what stands on a tipped table comes down onto what is under it')
    await gm.evaluate("tw.spawnRoom('common', 12, 0, 6, 5, 4402)"); await idle(gm)
    # a table the roll put things on (the one with the most), in this room
    T = await gm.evaluate("""(() => { const E = tw.entities(), n = new Map(); for (const e of Object.values(E)) if (e.kind === 'object' && e.parent && E[e.parent]?.kind === 'object' && E[e.parent].x > 58) n.set(e.parent, (n.get(e.parent) || 0) + 1);
      return [...n].sort((a, b) => b[1] - a[1]).map(([id]) => id).find(id => !E[id].locked && !['stair', 'tile', 'kit'].includes(E[id].place) && !E[id].fromEdge && (E[id].dims || [0])[0] >= 2.5) || null; })()""")  # (one that can be rolled: not a kit piece like a bar counter)
    check(T, 'the rolled room has a table with things on it', T)
    if not T: return
    ON = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.parent === '{T}').map(e => e.id)")  # what stood on it
    t = await gm.evaluate(f"tw.entities()['{T}']"); await view(gm, t['x'], t['z'], 30, 45, 0, 2)
    await wait(gm, f"{W}.anims.size === 0 && [...{W}.recs.values()].every(r => r.visual)", 30000, 'built and loaded'); await gm.wait_for_timeout(800)
    g0 = await gm.evaluate(f"{GAPS}({json.dumps(ON)})")
    sat = [g['id'] for g in g0 if abs(g['gap']) < 0.35]; ON = sat
    if len(sat) < len(g0): print('    (already floating upright, left out: the room roll\'s own business)', [(g['name'], g['gap']) for g in g0 if g['id'] not in sat])
    check(len(sat) >= 2, 'upright, at least two things sit on its top', g0)
    async def roll(deg):  # the command the bar's "roll N" runs, on the selected table
        await gm.evaluate(f"tw.select(['{T}'])"); await gm.wait_for_timeout(200)
        ok = await gm.evaluate(f"(() => {{ const c = tw.registry.available().some(c => c.id === 'thing.tilt'); if (c) tw.registry.run('thing.tilt', {{ deg: {deg} }}); return c; }})()")
        if not ok: print('    (thing.tilt not available)', await gm.evaluate(f"(() => {{ const e = tw.entities()['{T}']; return {{ sel: [...tw.sel], place: e?.place, locked: e?.locked, fromEdge: e?.fromEdge, touch: tw.canTouch?.(e), cat: e?.cat, avail: tw.registry.available().map(c => c.id).slice(0, 40) }}; }})()"))
        await idle(gm); await gm.evaluate("tw.select([])"); await gm.wait_for_timeout(800)
    async def gaps(): return await gm.evaluate(f"{GAPS}({json.dumps(ON)})")
    await roll(90); await shot(gm, 'tilt-90')
    g1 = await gaps()
    check(g1 and all(abs(g['gap']) < 0.35 for g in g1), 'on its side: nothing it carried hangs in the air where its top was', g1)
    check(any(abs(g['y'] - y0) > 0.3 for g, y0 in zip(g1, [x['y'] for x in g0 if x['id'] in ON])), 'and the data says so: what stood on it is lower now (on the floor, or on the side it lies on)', [(g['name'], g['y'], g['on']) for g in g1])
    q = await gm.evaluate(f"tw.entities()['{T}']?.quat || null")
    check(q, 'the table is rolled', q)
    await gm.keyboard.press('Control+z'); await idle(gm); await gm.wait_for_timeout(600)
    g2 = await gaps()
    check(not await gm.evaluate(f"tw.entities()['{T}'].quat || null") and all(g['parent'] == T for g in g2) and all(abs(g['gap']) < 0.35 for g in g2), 'ONE undo: the table upright and everything back on its top', g2)
    await roll(15); g3 = await gaps()
    check(all(g['parent'] == T for g in g3) and all(abs(g['gap']) < 0.35 for g in g3), 'tipped 15°: still on it, on its slope', g3)
    await roll(0); g4 = await gaps()
    check(all(g['parent'] == T for g in g4) and all(abs(g['gap']) < 0.35 for g in g4), 'stood up again: back on its top, not sunk into it', g4)

async def roofpawn_section(gm):
    print('ROOFPAWN: with my roofs off, a pawn standing on a roof is not drawn')
    await gm.evaluate("tw.spawnRoom('common', 30, 0, 6, 5, 4403)"); await idle(gm)  # (feet 150..180 x 0..25)
    await gm.evaluate("(tw.setRoofs(true, 'test'), tw.cutOff('test'))"); await gm.wait_for_timeout(1200)
    await gm.evaluate("tw.dispatch('token.create', { id: 'tok_inside0001', name: 'Inside', x: 157.5, z: 12.5, fig: 'hero-fighter-dwarf-f' })")
    await idle(gm)
    top = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()), b = w.pawnLevel({ id: 'probe', kind: 'token', x: 167.5, z: 12.5, y: 40 }); return b; })()")
    check(top and top > 8, "the room's top is a base (a pawn over it stands on it)", top)
    await gm.evaluate(f"tw.batch([{{ type: 'token.create', args: {{ id: 'tok_roof00001', name: 'Roofer', x: 167.5, z: 12.5, y: {top}, fig: 'hero-fighter-dwarf-f' }} }}, {{ type: 'token.create', args: {{ id: 'tok_flyer0001', name: 'Flyer', x: 172.5, z: 7.5, y: {top + 20}, fig: 'hero-fighter-dwarf-f' }} }}])")
    await wait(gm, f"['tok_roof00001', 'tok_flyer0001', 'tok_inside0001'].every(id => {W}.recs.has(id))", 15000, 'pawns'); await idle(gm)
    await view(gm, 165, 12.5, 60, 50, 0, 5); await gm.wait_for_timeout(800)
    VIS = f"(() => Object.fromEntries(['tok_roof00001', 'tok_flyer0001', 'tok_inside0001'].map(id => {{ const r = {W}.recs.get(id); return [id.slice(4, 9), !!r && r.group.visible && !r.group.userData.cutHidden]; }})))()"
    on = await gm.evaluate(VIS); await shot(gm, 'roofpawn-on')
    check(on.get('roof0') and on.get('flyer'), 'roofs on: the pawn on the roof and the one flying over it are drawn', on)
    await gm.evaluate("tw.setRoofs(false, 'test')"); await gm.wait_for_timeout(1200)
    off = await gm.evaluate(VIS); await shot(gm, 'roofpawn-off')
    check(not off.get('roof0'), 'roofs off: the pawn standing on the roof is not drawn (no roof under it)', off)
    check(off.get('flyer') and off.get('insid'), 'and a pawn flying over it, and one inside the room, still are', off)
    pt = await gm.evaluate(f"(() => {{ const r = {W}.recs.get('tok_roof00001'), p = r.group.position; return tw.screenOf(p.x, p.z, tw.main, p.y + 2); }})()")
    picked = await gm.evaluate(f"{W}.pickAll(tw.rayAt({pt['x']}, {pt['y']}, tw.main)).map(h => h.entity?.id)")
    check('tok_roof00001' not in picked, 'and the pointer does not find it', picked)
    await gm.evaluate("tw.setRoofs(true, 'test')"); await gm.wait_for_timeout(1200)
    back = await gm.evaluate(VIS)
    check(back.get('roof0'), 'roofs on again: it is back on its roof', back)
    await gm.evaluate("tw.setRoofs(false, 'test')")

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, **kw):
            ctx = await browser.new_context(**({'viewport': {'width': 1400, 'height': 900}} | kw))
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url, timeout=180000, wait_until='domcontentloaded'); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST pickfixes {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        if want('WALL'): await wall_section(gm)
        pl = None
        if want('CURSOR'):
            pl = pl or await invite(gm, tab)
            await cursor_section(gm, pl)
        if want('TILT'): await tilt_section(gm)
        if want('ROOFPAWN'): await roofpawn_section(gm)
        check(not errors, 'no page errors', '; '.join(errors[:3]))
        await browser.close()

try:
    asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
bad = [r for r in results if not r[0]]
print(f"pickfixes: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)

#!/usr/bin/env python3
"""Drag select takes the parent, not what sits on it (Harry 2026-11-02, from Nick's note: "When you drag select it selects
individual objects instead of the group object (so like a desk should get grabbed rather than individual objects on the
desk)"; docs/UI.md "Marquee"). A real rolled room, a real desk with things on it, a real marquee from the mouse.

  the box takes the desk and what is on it: the desk is selected, the things on it are not
  the box takes only the things on the desk: they stay selected
  most of it (Harry 2026-11-03): a box over 60% of the desk as drawn takes it and its contents, 40% does not, from above
    and at an angle (where a box just round the drawn desk failed the old rule); a candlestick by its own area, not the
    big rug under it; the cost on a map of 1,200 things
  Shift-add, both ways round
  "sits on" is what moving carries (`parent`): a thing set down by hand, a cup on a tray on the desk
  the detents: table distance never folds things into their room; the overview still takes rooms and buildings
  a folded selection: move (drag and arrows), hide, copy and duplicate take the things on the desk along, one undo

What stands on a thing goes with it (Harry 2026-11-02): Delete, Cut, Copy, Turn and raise / lower, one undo each; a locked thing stays and says so; a real player seat changes nothing.

  local:  TW_GPU=1 TW_PORTS=18998,18999 python3 engine/test/browser_marqueefold.py --local
"""
import argparse, asyncio, json, math, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE); import served
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

procs = []; tmpdirs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18998,18999').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-fold-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmpdirs.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500&nointro'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=60); return True
    except Exception: print(f'    (timed out: {what or js[:100]})'); return False

W, H = 1280, 720
RECT = """(id) => { const w = tw.worldOf(tw.area()), b = w.boundsOf(w.recs.get(id)); let a = [1e9, 1e9, -1e9, -1e9];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const s = tw.screenOf(x, z, tw.main, y); a = [Math.min(a[0], s.x), Math.min(a[1], s.y), Math.max(a[2], s.x), Math.max(a[3], s.y)]; } return a; }"""
EMPTY = "([x, y]) => { const w = tw.worldOf(tw.area()); return !w.pickAll(tw.rayAt(x, y)).map(h => tw.selectionFor(h)).filter(Boolean).length; }"
async def rect(pg, id): return await pg.evaluate(f"({RECT})({json.dumps(id)})")
async def sel(pg): return await pg.evaluate("[...tw.sel]")
async def clear(pg):
    await pg.keyboard.press('Escape'); await pg.evaluate("tw.clearSelection()"); await pg.wait_for_timeout(60)
async def view(pg, x, z, dist=34):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = 89.5; g.yaw = 0; g.dist = {dist}; g.update(); tw.main.rule = 'free'; tw.main.glide = null; }})()")
    await pg.wait_for_timeout(250)
async def box(pg, a, b, shift=False, steps=6):
    if shift: await pg.keyboard.down('Shift')
    await pg.mouse.move(*a); await pg.mouse.down()
    for i in range(1, steps + 1): await pg.mouse.move(a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps); await pg.wait_for_timeout(16)
    await pg.mouse.up()
    if shift: await pg.keyboard.up('Shift')
    await pg.wait_for_timeout(120)
async def empty_corner(pg, x0, y0, x1, y1):
    """a press that starts a box: a spot outside this rectangle with nothing to pick under it"""
    for m in (10, 16, 24, 34, 48, 64, 90):
        for p in ((x0 - m, y0 - m), (x1 + m, y0 - m), (x0 - m, y1 + m), (x1 + m, y1 + m), ((x0 + x1) / 2, y0 - m), ((x0 + x1) / 2, y1 + m), (x0 - m, (y0 + y1) / 2), (x1 + m, (y0 + y1) / 2)):
            if 4 < p[0] < W - 4 and 70 < p[1] < H - 70 and await pg.evaluate(f"({EMPTY})({json.dumps(p)})"): return p
    return None
def opposite(a, r, pad=4):
    """the far corner of a box from `a` that holds the rectangle r wholly"""
    return (r[2] + pad if a[0] <= (r[0] + r[2]) / 2 else r[0] - pad, r[3] + pad if a[1] <= (r[1] + r[3]) / 2 else r[1] - pad)
def union(a, b): return [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
# THE THING AS DRAWN, measured apart from the game's own rule (marquee.js samples the surface): a ray every STEP pixels over
# its world box on screen, against its own drawn meshes only (what stands on it does not hide it). The pixels it covers.
STEP = 2
SIL = """([id, step]) => { const w = tw.worldOf(tw.area()), r = w.recs.get(id), b = w.boundsOf(r); let a = [1e9, 1e9, -1e9, -1e9];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const s = tw.screenOf(x, z, tw.main, y); a = [Math.min(a[0], s.x), Math.min(a[1], s.y), Math.max(a[2], s.x), Math.max(a[3], s.y)]; }
  const ms = []; r.group.updateMatrixWorld(true);
  r.group.traverse(o => { if (!o.isMesh || o.userData.halo || o.userData.pickPad || o.material?.visible === false) return; for (let q = o; q; q = q.parent) { if (!q.visible) return; if (q === r.group) break; } ms.push(o); });
  const pts = [];
  for (let y = Math.max(0, Math.floor(a[1])); y <= Math.min(innerHeight, a[3]); y += step) for (let x = Math.max(0, Math.floor(a[0])); x <= Math.min(innerWidth, a[2]); x += step) if (tw.rayAt(x, y).intersectObjects(ms, false).length) pts.push([x, y]);
  return { pts, rect: a }; }"""
async def silhouette(pg, id):
    s = await pg.evaluate(f"({SIL})([{json.dumps(id)}, {STEP}])"); p = s['pts']
    return {'pts': p, 'aabb': s['rect'], 'box': [min(q[0] for q in p), min(q[1] for q in p), max(q[0] for q in p), max(q[1] for q in p)] if p else None}
def cut_at(sil, frac):
    """the screen x left of which `frac` of the drawn thing lies"""
    xs = sorted(q[0] for q in sil['pts']); return xs[min(len(xs) - 1, int(frac * len(xs)))] + STEP / 2
def drawn_in(sil, bx):
    """the share of the drawn thing (its pixels) inside a box [x0, y0, x1, y1]"""
    x0, y0, x1, y1 = min(bx[0], bx[2]), min(bx[1], bx[3]), max(bx[0], bx[2]), max(bx[1], bx[3])
    return sum(1 for q in sil['pts'] if x0 <= q[0] <= x1 and y0 <= q[1] <= y1) / max(1, len(sil['pts']))
async def left_box(pg, sil, x1, pads=(8, 14, 22, 32, 46)):
    """a box from empty floor left of the drawn thing to screen x = x1, top to bottom past it: (start, end) or None"""
    L, T, R, B = sil['box']
    for m in pads:
        for st, en in (((L - m, T - m), (x1, B + m)), ((L - m, B + m), (x1, T - m))):
            if 4 < st[0] and 70 < min(st[1], en[1]) and max(st[1], en[1]) < H - 70 and await pg.evaluate(f"({EMPTY})({json.dumps(st)})"): return st, en
    return None
def old_rule(aabb, st, en):
    """the rule before 2026-11-03: the thing's world box, all eight corners on screen, wholly inside the box"""
    x0, y0, x1, y1 = min(st[0], en[0]), min(st[1], en[1]), max(st[0], en[0]), max(st[1], en[1])
    return x0 <= aabb[0] and aabb[2] <= x1 and y0 <= aabb[1] and aabb[3] <= y1
async def look(pg, x, z, dist, pitch, yaw):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; tw.main.glide = null; }})()")
    await pg.wait_for_timeout(300)

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500&nointro'
    GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': W, 'height': H}, reduced_motion='reduce')
        gm = await ctx.new_page()
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await gm.goto(page)
        NAME = f"TEST fold {time.strftime('%m-%d %H:%M:%S')} (throwaway)"
        await gm.fill('#newCampaign input[name=name]', NAME); await gm.fill('#newCampaign input[name=gm]', 'Fauna-test'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 60000), 'GM tab live', NAME)
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
        await gm.evaluate("document.querySelector('.lmcard .lm-x')?.click()")

        print('A REAL ROLLED ROOM')
        FIND = """(() => { const E = Object.values(tw.entities()), kids = (o) => tw.childrenOf(o); return E.filter(e => e.kind === 'object' && /desk|table/.test(e.cat) && kids(e).length >= 2).sort((a, b) => kids(b).length - kids(a).length).map(e => ({ id: e.id, cat: e.cat, x: e.x, y: e.y || 0, z: e.z, room: e.room, kids: kids(e).map(k => k.id), kidCats: kids(e).map(k => k.cat) }))[0] || null; })()"""
        desk = None
        for seed in range(1, 12):
            await gm.evaluate(f"tw.spawnRoom('mansion-library', {2 + (seed - 1) * 14}, 2, 8, 6, {seed})")
            await wait(gm, "tw.sync.pendingCount() === 0", 15000, 'spawn sent')
            await gm.wait_for_timeout(200)
            desk = await gm.evaluate(FIND)
            if desk: break
        check(bool(desk) and len(desk['kids']) >= 2, 'a rolled room has a desk with things on it, and they carry `parent`', desk and {'cat': desk['cat'], 'on it': desk['kidCats']})
        await wait(gm, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", 90000, 'spawn over')
        await view(gm, desk['x'], desk['z'])
        await wait(gm, f"(() => {{ const w = tw.worldOf(tw.area()), r = w.recs.get({json.dumps(desk['id'])}); return r?.visual?.userData?.loaded !== false && !r?.visual?.userData?.placeholder; }})()", 30000, 'desk mesh')
        await gm.wait_for_timeout(600)
        dr = await rect(gm, desk['id']); rr = {k: await rect(gm, k) for k in desk['kids']}
        allr = dr
        for r in rr.values(): allr = union(allr, r)
        check(dr[2] - dr[0] > 60 and 0 < allr[0] and allr[2] < W and 70 < allr[1] and allr[3] < H - 70, '(fixture) the desk is framed from above', [round(v) for v in dr])

        print('THE BOX TAKES THE DESK AND WHAT IS ON IT')
        a = await empty_corner(gm, *allr); b = opposite(a, allr)
        check(a is not None, '(fixture) empty floor to start a box on', a)
        await clear(gm); await box(gm, a, b); s = await sel(gm)
        check(desk['id'] in s and not set(desk['kids']) & set(s), 'the desk is selected, the things on it are not', {'selected': len(s), 'things on it selected': len(set(desk['kids']) & set(s))})
        await gm.screenshot(path=os.path.join(os.environ.get('TW_SHOTS') or tempfile.gettempdir(), 'marqueefold-desk.png'))

        print('THE BOX TAKES ONLY WHAT IS ON THE DESK')
        side = min(desk['kids'], key=lambda k: rr[k][2] - dr[0])  # the thing nearest the desk's left edge
        far = rr[side][2] + 3
        check(far < dr[2] - 8, '(fixture) a box can hold that thing and stop short of the desk\'s far edge', [round(far), round(dr[2])])
        c = await empty_corner(gm, dr[0], dr[1], far, dr[3])
        cand = [(dr[0] - m, dr[1] - m) for m in (12, 20, 30)] + [(dr[0] - m, dr[3] + m) for m in (12, 20, 30)] + [(dr[0] - m, (dr[1] + dr[3]) / 2) for m in (12, 20, 30)]
        st = None
        for q in cand:
            if await gm.evaluate(f"({EMPTY})({json.dumps(q)})"): st = q; break
        check(st is not None, '(fixture) empty floor to the left of the desk', st)
        y1 = dr[3] + 6 if st[1] < dr[1] + 1 else (dr[1] - 6 if st[1] > dr[3] - 1 else None)
        if y1 is None: st = (st[0], dr[1] - 6); y1 = dr[3] + 6
        await clear(gm); await box(gm, st, (far, y1)); s = await sel(gm)
        check(side in s and desk['id'] not in s, 'the box holds less than half of the desk: the thing on it stays selected, as before', {'selected': len(s), 'desk': desk['id'] in s})
        only = list(s)

        print('SHIFT-ADD')
        await box(gm, a, b, shift=True); s = await sel(gm)
        check(desk['id'] in s and not set(desk['kids']) & set(s), 'things on the desk selected, then Shift + a box round the whole desk: it folds to the desk', {'selected': len(s)})
        await clear(gm); await gm.evaluate(f"tw.select({json.dumps(desk['id'])})"); await gm.wait_for_timeout(60); await box(gm, st, (far, y1), shift=True); s = await sel(gm)
        check(desk['id'] in s and not set(desk['kids']) & set(s), 'the desk selected, then Shift + a box round a thing on it: still just the desk', {'selected': len(s)})
        other = await gm.evaluate(f"(() => {{ const E = Object.values(tw.entities()), no = new Set([{json.dumps(desk['id'])}, ...{json.dumps(desk['kids'])}]); return E.find(e => e.kind === 'object' && !no.has(e.id) && !e.parent && e.place !== 'tile' && e.room === {json.dumps(desk['room'])})?.id; }})()")
        await clear(gm); await gm.evaluate(f"tw.select({json.dumps(other)})"); await gm.wait_for_timeout(60); await box(gm, a, b, shift=True); s = await sel(gm)
        check(other in s and desk['id'] in s and not set(desk['kids']) & set(s), 'Shift keeps what was selected elsewhere, and the box still folds', {'selected': len(s)})

        print('MOST OF IT (Harry 2026-11-03: "a sort of \'most of\' the object rule with drag")')
        async def most(label, move=False):
            sil = await silhouette(gm, desk['id'])
            check(sil['box'] and len(sil['pts']) > 200, f'(fixture, {label}) the desk as drawn, measured by rays', {'pixels': len(sil['pts']), 'drawn': sil['box'] and [round(v) for v in sil['box']], 'world box': [round(v) for v in sil['aabb']]})
            for frac in (0.6, 0.4):
                x1 = cut_at(sil, frac); bx = await left_box(gm, sil, x1)
                check(bx is not None, f'(fixture, {label}) empty floor to start a box over {round(frac * 100)}% of the desk', round(x1))
                if not bx: continue
                drawn = drawn_in(sil, [*bx[0], *bx[1]]); game = await gm.evaluate(f"tw.marqueeShare({json.dumps(desk['id'])}, {json.dumps([*bx[0], *bx[1]])})")
                await clear(gm); await box(gm, *bx); s = await sel(gm)
                rects = {k: await rect(gm, k) for k in desk['kids']}; outside = [k for k in desk['kids'] if rects[k][0] > x1]
                info = {'drawn in box': round(drawn, 2), 'game share': round(game, 2), 'things on it wholly outside the box': len(outside), 'selected': len(s)}
                if frac > 0.5:
                    carried = set(await gm.evaluate(f"tw.descendants(tw.entities()[{json.dumps(desk['id'])}]).map(e => e.id)"))
                    check(desk['id'] in s and not set(desk['kids']) & set(s) and set(desk['kids']) <= carried, f'{label}: a box over 60% of the desk takes the desk, and what is on it comes with it (folded)', info)
                    if move:
                        p0 = await gm.evaluate(f"Object.fromEntries([{json.dumps(desk['id'])}, ...{json.dumps(desk['kids'])}].map(i => [i, tw.entities()[i].x]))")
                        await gm.keyboard.press('ArrowRight'); await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(200)
                        p1 = await gm.evaluate(f"Object.fromEntries([{json.dumps(desk['id'])}, ...{json.dumps(desk['kids'])}].map(i => [i, tw.entities()[i].x]))")
                        check(all(abs(p1[k] - p0[k] - 5) < 0.02 for k in p0), f'{label}: an arrow key moves the desk and everything on it, the things outside the box too', len(outside))
                        await gm.keyboard.press('Control+z'); await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(250)
                else:
                    check(desk['id'] not in s, f'{label}: a box over 40% of the desk does not take it', info)
            return sil
        await most('from above', move=True)
        # A PERSPECTIVE VIEW AT AN ANGLE, where the old rule failed: the desk's world box on screen spreads past the desk drawn
        await look(gm, desk['x'], desk['z'], 26, 38, 35)
        sil = await most('at an angle')
        L, T, R, B = sil['box']; bx = None
        for m in (6, 10, 16, 24):
            bx = await left_box(gm, sil, R + m, pads=(m,))
            if bx: break
        check(bx is not None and not old_rule(sil['aabb'], *bx), '(fixture, at an angle) a box just round the desk as drawn, which the old rule (its world box wholly inside) would refuse', {'box': bx and [round(v) for v in (*bx[0], *bx[1])], 'world box': [round(v) for v in sil['aabb']]})
        if bx:
            await clear(gm); await box(gm, *bx); s = await sel(gm)
            check(desk['id'] in s and not set(desk['kids']) & set(s), 'at an angle: a box just round the desk as drawn takes the desk, folded', {'selected': len(s)})
        await clear(gm); await view(gm, desk['x'], desk['z']); await gm.wait_for_timeout(400)
        back = await rect(gm, desk['id']); check(all(abs(u - v) < 0.5 for u, v in zip(back, dr)), '(fixture) back to the view from above', [round(v) for v in back])

        print('"SITS ON" IS WHAT MOVING CARRIES')
        await clear(gm)
        free = None
        for gx in range(1, 9):
            for gy in range(1, 6):
                pt = [dr[0] + (dr[2] - dr[0]) * gx / 9, dr[1] + (dr[3] - dr[1]) * gy / 6]
                if await gm.evaluate(f"(([x, y]) => {{ const h = tw.worldOf(tw.area()).pickAll(tw.rayAt(x, y)).map(h => tw.selectionFor(h)).filter(Boolean); return h[0] === {json.dumps(desk['id'])}; }})({json.dumps(pt)})"): free = pt; break
            if free: break
        check(free is not None, '(fixture) a spot of bare desk top', free)
        n0 = await gm.evaluate("Object.keys(tw.entities()).length")
        await gm.evaluate("tw.modes.place(tw.assets.catById.get('candlestick'))"); await gm.wait_for_timeout(120)
        await gm.mouse.move(*free); await gm.wait_for_timeout(120); await gm.mouse.click(*free)
        await wait(gm, f"Object.keys(tw.entities()).length > {n0} && tw.sync.pendingCount() === 0", 8000, 'candle placed')
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(120)
        cn = await gm.evaluate("(() => { const E = Object.values(tw.entities()); const c = E.filter(e => e.cat === 'candlestick').sort((a, b) => (b.order || 0) - (a.order || 0)).at(-1); return E.filter(e => e.cat === 'candlestick').map(e => ({ id: e.id, parent: e.parent })); })()")
        hand = next((c for c in cn if c['parent'] == desk['id'] and c['id'] not in desk['kids']), None)
        check(bool(hand), 'a thing set down on the desk by hand takes it as `parent`', cn[:3])
        await clear(gm); await box(gm, a, b); s = await sel(gm)
        check(desk['id'] in s and hand and hand['id'] not in s, 'and it folds up like what the room rolled', {'selected': len(s)})
        await gm.evaluate(f"""(() => {{ const o = tw.entities()[{json.dumps(desk['kids'][0])}]; tw.batch([{{ type: 'object.place', args: {{ id: 'obj_foldchain01', name: 'cup', cat: o.cat, sku: o.sku, url: o.url, place: 'surface', layer: 'dress', x: o.x, y: (o.y || 0) + 0.3, z: o.z, rot: 0, dims: [0.2, 0.2, 0.2], s: o.s, parent: o.id, room: o.room }} }}]); }})()""")
        await wait(gm, "!!tw.entities().obj_foldchain01 && tw.sync.pendingCount() === 0", 8000, 'cup placed')
        fold = await gm.evaluate(f"[tw.foldUp(['obj_foldchain01', {json.dumps(desk['id'])}]), tw.foldUp(['obj_foldchain01', {json.dumps(desk['kids'][0])}]), tw.foldUp(['obj_foldchain01'])]")
        check(fold == [[desk['id']], [desk['kids'][0]], ['obj_foldchain01']], 'a cup on a tray on the desk folds into the desk, tray among them or not', fold)
        await gm.keyboard.press('Control+z'); await wait(gm, "!tw.entities().obj_foldchain01 && tw.sync.pendingCount() === 0", 8000, 'cup undone')

        print('THE DETENTS')
        await clear(gm); room = desk['room']
        # (a selected room is grabbed by its floor, so this box starts on the ground outside it)
        rc = await gm.evaluate(f"(() => {{ const r = tw.entities()[{json.dumps(room)}].recipe; return [r.x * 5, r.z * 5, (r.x + r.w) * 5, (r.z + r.d) * 5]; }})()")
        await view(gm, (rc[0] + rc[2]) / 2, (rc[1] + rc[3]) / 2, dist=66); await gm.wait_for_timeout(300)
        out = await gm.evaluate(f"(() => {{ const p = tw.screenOf({rc[0] - 3}, {rc[1] - 3}, tw.main, 0), q = tw.screenOf({desk['x'] + 7}, {desk['z'] + 6}, tw.main, 0); return [[p.x, p.y], [q.x, q.y]]; }})()")
        await gm.evaluate(f"tw.select({json.dumps(room)})"); await gm.wait_for_timeout(100); await box(gm, out[0], out[1], shift=True); s = await sel(gm)
        check(room in s and desk['id'] in s and not set(desk['kids']) & set(s), 'a room already selected, Shift + a box at table distance: the desk folds its things, nothing folds into the room', {'room': room in s, 'desk': desk['id'] in s, 'selected': len(s)})
        await clear(gm); await box(gm, out[0], out[1]); s = await sel(gm); kinds = await gm.evaluate(f"{json.dumps(s)}.map(i => tw.ent(i)?.kind)")
        check(s and not {'room', 'building'} & set(kinds), 'a box at table distance takes things, never the room they stand in', sorted(set(kinds)))
        ov = await gm.evaluate("(() => { const g = tw.main.grab; g.dist = 400; g.pitch = 70; g.update(); return tw.overview(); })()"); await gm.wait_for_timeout(500)
        await clear(gm); await box(gm, (150, 110), (1100, 640)); s = await sel(gm); kinds = await gm.evaluate(f"{json.dumps(s)}.map(i => tw.ent(i)?.kind)")
        check(ov and s and set(kinds) <= {'room', 'building'}, 'the overview detent still takes rooms and buildings', {'overview': ov, 'kinds': sorted(set(kinds))})
        await clear(gm); await view(gm, desk['x'], desk['z']); await gm.wait_for_timeout(400)

        print('A FOLDED SELECTION')
        ids = [desk['id']] + desk['kids'] + [hand['id']]
        POS = f"(() => {{ const E = tw.entities(); return Object.fromEntries({json.dumps(ids)}.map(i => [i, E[i] ? [E[i].x, E[i].y || 0, E[i].z, !!E[i].hidden, E[i].parent || null] : null])); }})()"
        p0 = await gm.evaluate(POS)
        await box(gm, a, b); s = await sel(gm)
        check(desk['id'] in s and hand['id'] not in s, '(fixture) folded', len(s))
        await gm.evaluate(f"tw.select({json.dumps(desk['id'])})"); await gm.wait_for_timeout(100)
        free = None  # (the candle stands on the last one)
        for gx in range(1, 9):
            for gy in range(1, 6):
                pt = [dr[0] + (dr[2] - dr[0]) * gx / 9, dr[1] + (dr[3] - dr[1]) * gy / 6]
                on = await gm.evaluate(f"(([x, y]) => {{ const h = tw.worldOf(tw.area()).pickAll(tw.rayAt(x, y)).map(h => tw.selectionFor(h)).filter(Boolean), t = document.elementFromPoint(x, y); return h[0] === {json.dumps(desk['id'])} && t?.id === 'c'; }})({json.dumps(pt)})")
                if on: free = pt; break
            if free: break
        check(free is not None, '(fixture) bare desk top beside the candle, clear of the ring', free)
        await gm.mouse.move(*free); await gm.mouse.down()
        for i in range(1, 7): await gm.mouse.move(free[0] + 8 * i, free[1] + 2 * i); await gm.wait_for_timeout(16)
        await gm.mouse.up(); await wait(gm, "tw.sync.pendingCount() === 0", 8000, 'moved'); await gm.wait_for_timeout(200)
        p1 = await gm.evaluate(POS); dx = p1[desk['id']][0] - p0[desk['id']][0]; dz = p1[desk['id']][2] - p0[desk['id']][2]
        rode = all(abs(p1[k][0] - p0[k][0] - dx) < 0.02 and abs(p1[k][2] - p0[k][2] - dz) < 0.02 for k in ids)
        check(abs(dx) + abs(dz) > 1 and rode, 'a drag: the desk moves and the things on it ride along', {'dx': round(dx, 2), 'dz': round(dz, 2)})
        await gm.keyboard.press('Control+z'); await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(250)
        p2 = await gm.evaluate(POS); check(p2 == p0, 'one undo puts the desk and everything on it back')
        await box(gm, a, b); await gm.keyboard.press('ArrowRight'); await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(200)
        p1 = await gm.evaluate(POS); dx = p1[desk['id']][0] - p0[desk['id']][0]
        check(abs(dx - 5) < 0.02 and all(abs(p1[k][0] - p0[k][0] - dx) < 0.02 for k in ids), 'an arrow key moves the desk and what is on it one square', round(dx, 2))
        await gm.keyboard.press('Control+z'); await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(250)
        await clear(gm); await box(gm, a, b)
        await gm.evaluate("tw.setHidden(tw.selected().filter(e => e.kind === 'object'), true)"); await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(200)
        p1 = await gm.evaluate(POS); check(all(p1[k][3] for k in ids), 'hide takes the things on the desk too', [p1[k][3] for k in ids])
        await gm.keyboard.press('Control+z'); await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(250)
        await clear(gm); await box(gm, a, b)
        await gm.keyboard.press('Control+c'); await gm.wait_for_timeout(200)
        cl = await gm.evaluate("(tw.clip?.items || []).map(i => i.e.id)")
        check(set(ids) <= set(cl), 'copy takes the things on the desk too', {'items': len(cl)})
        n1 = await gm.evaluate("Object.keys(tw.entities()).length")
        await gm.evaluate(f"tw.select({json.dumps(desk['id'])})"); await gm.wait_for_timeout(60); await gm.keyboard.press('Control+d'); await wait(gm, f"Object.keys(tw.entities()).length > {n1} && tw.sync.pendingCount() === 0", 8000, 'duplicated')
        n2 = await gm.evaluate("Object.keys(tw.entities()).length")
        check(n2 - n1 == len(ids), 'duplicate brings the things on the desk, on the new desk', n2 - n1)
        await gm.keyboard.press('Control+z'); await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(250)

        print('WHAT STANDS ON A THING GOES WITH IT (Harry 2026-11-02)')
        FULL = f"(() => {{ const E = tw.entities(); return Object.fromEntries({json.dumps(ids)}.map(i => [i, E[i] || null])); }})()"
        async def settle(): await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(250)
        async def folded():
            await clear(gm); await box(gm, a, b); s_ = await sel(gm); return desk['id'] in s_ and not set(ids[1:]) & set(s_)
        ring = lambda e: math.hypot(e[0], e[1])
        snap = await gm.evaluate(FULL)
        # Delete, by marquee and by click
        for how in ('a marquee', 'a click'):
            if how == 'a marquee': check(await folded(), '(fixture) folded')
            else: await clear(gm); await gm.evaluate(f"tw.select({json.dumps(desk['id'])})"); await gm.wait_for_timeout(100)
            await gm.keyboard.press('Delete'); await settle()
            p1 = await gm.evaluate(FULL)
            check(all(v is None for v in p1.values()), f'selected by {how}, Delete takes the desk and everything on it', [k for k, v in p1.items() if v])
            await gm.keyboard.press('Control+z'); await settle()
            check(await gm.evaluate(FULL) == snap, f'one undo restores all of it, exactly (selected by {how})')
        # Cut, and paste
        check(await folded(), '(fixture) folded'); n0 = await gm.evaluate("Object.keys(tw.entities()).length")
        await gm.keyboard.press('Control+x'); await settle()
        p1 = await gm.evaluate(FULL); check(all(v is None for v in p1.values()), 'Cut takes the desk and its contents: the originals do not stay behind')
        await gm.mouse.move(*free); await gm.wait_for_timeout(80); await gm.keyboard.press('Control+v'); await settle()
        pasted = await gm.evaluate(f"""(() => {{ const E = tw.entities(), o = {json.dumps(snap)}, S = Object.values(E).filter(e => e.kind === 'object' && e.cat === {json.dumps(desk['cat'])} && !o[e.id]);
          const d = S[0]; if (!d) return null; const k = tw.descendants(d); return {{ d: [d.x, d.y || 0, d.z], rot: d.rot || 0, kids: k.map(e => [e.cat, e.x - d.x, (e.y || 0) - (d.y || 0), e.z - d.z, e.rot || 0, e.parent === d.id || !!E[e.parent]]) }}; }})()""")
        want = sorted((snap[k]['cat'], round(snap[k]['x'] - snap[desk['id']]['x'], 1), round((snap[k].get('y') or 0) - (snap[desk['id']].get('y') or 0), 1), round(snap[k]['z'] - snap[desk['id']]['z'], 1)) for k in ids[1:])
        got = sorted((k[0], round(k[1], 1), round(k[2], 1), round(k[3], 1)) for k in (pasted or {'kids': []})['kids'])
        check(pasted and len(pasted['kids']) == len(ids) - 1 and all(k[5] for k in pasted['kids']) and all(abs(x[1] - y[1]) < 0.35 and abs(x[3] - y[3]) < 0.35 and abs(x[2] - y[2]) < 0.35 for x, y in zip(want, got)), 'paste lands the desk with everything on it, in place on the desk, parents re-joined', pasted and len(pasted['kids']))
        await gm.keyboard.press('Control+z'); await settle(); await gm.keyboard.press('Control+z'); await settle()
        check(await gm.evaluate(FULL) == snap, 'undo of the paste and of the cut: back as it was')
        # copy takes them too and leaves the originals
        check(await folded(), '(fixture) folded'); await gm.keyboard.press('Control+c'); await gm.wait_for_timeout(200)
        check(set(ids) <= set(await gm.evaluate("(tw.clip?.items || []).map(i => i.e.id)")) and await gm.evaluate(FULL) == snap, 'Copy holds the desk and its contents, and the originals stay')
        # Turn (R): each keeps its place on the desk, about the desk's own centre
        check(await folded(), '(fixture) folded'); await gm.keyboard.press('r'); await settle()
        p1 = await gm.evaluate(FULL); A_ = math.radians(45); D0, D1 = snap[desk['id']], p1[desk['id']]; bad = []
        for k in ids[1:]:
            ax, az = snap[k]['x'] - D0['x'], snap[k]['z'] - D0['z']; wx, wz = D0['x'] + ax * math.cos(A_) + az * math.sin(A_), D0['z'] - ax * math.sin(A_) + az * math.cos(A_)
            if abs(p1[k]['x'] - wx) > 0.02 or abs(p1[k]['z'] - wz) > 0.02 or abs((p1[k].get('rot') or 0) - (snap[k].get('rot') or 0) - A_) > 1e-6 or (p1[k].get('y') or 0) != (snap[k].get('y') or 0): bad.append(k)
        check(abs((D1.get('rot') or 0) - (D0.get('rot') or 0) - A_) < 1e-6 and D1['x'] == D0['x'] and D1['z'] == D0['z'] and not bad, 'R turns the desk on its own centre, and what is on it turns with it, each keeping its place on the desk', bad)
        await gm.keyboard.press('Control+z'); await settle()
        check(await gm.evaluate(FULL) == snap, 'one undo turns them all back')
        # raise / lower
        await gm.evaluate(f"tw.liftTo(tw.entities()[{json.dumps(desk['id'])}], (tw.entities()[{json.dumps(desk['id'])}].y || 0) + 3)"); await settle()
        p1 = await gm.evaluate(FULL); rose = (p1[desk['id']].get('y') or 0) - (snap[desk['id']].get('y') or 0)
        check(rose > 2.9 and all(abs((p1[k].get('y') or 0) - (snap[k].get('y') or 0) - rose) < 0.02 for k in ids[1:]), 'raising the desk raises what is on it', round(rose, 2))
        await gm.keyboard.press('Control+z'); await settle(); check(await gm.evaluate(FULL) == snap, 'one undo lowers them all')
        # a LOCKED thing is never deleted or turned by its parent: it stays, and says so
        lk = desk['kids'][0]; others = [k for k in ids[1:] if k != lk]
        await gm.evaluate(f"tw.flag([{json.dumps(lk)}], {{ locked: true }})"); await settle(); snap2 = await gm.evaluate(FULL)
        check(await folded(), '(fixture) folded'); await gm.keyboard.press('r'); await settle(); p1 = await gm.evaluate(FULL)
        check(p1[lk]['x'] == snap2[lk]['x'] and p1[lk]['z'] == snap2[lk]['z'] and (p1[lk].get('rot') or 0) == (snap2[lk].get('rot') or 0) and all(p1[k]['x'] != snap2[k]['x'] or p1[k]['z'] != snap2[k]['z'] for k in others), 'a turn leaves a locked thing where it is; the rest turn')
        await gm.keyboard.press('Control+z'); await settle()
        check(await folded(), '(fixture) folded'); await gm.keyboard.press('ArrowRight'); await settle(); p1 = await gm.evaluate(FULL)
        print('  NOTE move with a locked thing on the desk:', 'refused whole' if p1 == snap2 else 'it moved')
        if p1 != snap2: await gm.keyboard.press('Control+z'); await settle()
        check(await folded(), '(fixture) folded'); await gm.keyboard.press('Delete'); await gm.wait_for_timeout(120)
        said = await gm.evaluate("document.body.innerText"); await settle(); p1 = await gm.evaluate(FULL)
        check(p1[lk] and not p1[lk].get('parent') and p1[lk]['x'] == snap2[lk]['x'] and p1[desk['id']] is None and all(p1[k] is None for k in others), 'Delete keeps a locked thing, in place and standing on nothing; the desk and the rest go', {'locked left': bool(p1[lk])})
        check('stayed where it was' in said, 'and says so', [l for l in said.split('\n') if 'stayed' in l][:1])
        await gm.keyboard.press('Control+z'); await settle()
        check(await gm.evaluate(FULL) == snap2, 'one undo brings the desk back under the locked thing, parent and all')
        await gm.evaluate(f"tw.flag([{json.dumps(lk)}], {{ locked: false }})"); await settle()
        # a NON-GM SEAT, real keys in a real player tab
        hid = desk['kids'][1]
        await gm.evaluate(f"tw.setHidden([tw.entities()[{json.dumps(hid)}]], true)"); await settle(); snap3 = await gm.evaluate(FULL)
        await clear(gm); await gm.evaluate("document.activeElement?.blur?.()"); await gm.keyboard.press('/'); await gm.wait_for_timeout(150); await gm.keyboard.type('invite Mira'); await gm.wait_for_timeout(250); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden && document.querySelector('#output textarea').value.includes('#s=')", 10000, 'invite')
        invite = (await gm.evaluate("document.querySelector('#output textarea').value")).strip().split()[-1]; await gm.keyboard.press('Escape')
        ctx2 = await browser.new_context(viewport={'width': W, 'height': H}, reduced_motion='reduce'); pl = await ctx2.new_page(); perr = []; pl.on('pageerror', lambda e: perr.append(str(e)))
        await pl.goto(invite + '&nofx&nointro'); await wait(pl, 'window.tw && tw.ready && tw.ready()', 60000, 'player'); await pl.evaluate("document.querySelector('.lmcard .lm-x')?.click()")
        await wait(pl, f"!!tw.entities()[{json.dumps(desk['id'])}]", 15000, 'the desk at the player seat')
        check(await pl.evaluate(f"!tw.entities()[{json.dumps(hid)}] && !tw.gm()"), 'a player does not have the hidden thing at all')
        await pl.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({desk['x']}, 0, {desk['z']}); g.pitch = 89.5; g.yaw = 0; g.dist = 34; g.update(); tw.main.rule = 'free'; }})()"); await pl.wait_for_timeout(600)
        await box(pl, a, b); s_ = await sel(pl); await pl.mouse.move(40, 660)
        for key in ('Delete', 'r', 'Control+x'): await pl.keyboard.press(key); await pl.wait_for_timeout(200)
        await pl.evaluate(f"tw.select({json.dumps(desk['id'])})"); await pl.keyboard.press('Delete'); await pl.wait_for_timeout(300)
        raw = await pl.evaluate(f"""new Promise(res => {{ const c = tw.batch([{{ type: 'object.delete', args: {{ id: {json.dumps(desk['id'])} }} }}]); tw.await(c).then(m => res(JSON.stringify(m))); }})""")
        await gm.wait_for_timeout(500)
        check(await gm.evaluate(FULL) == snap3, "a player's keys and a raw command change nothing on or under the desk (the relay refuses)", (raw or '')[:120])
        check('obj_' not in (raw or '').replace(desk['id'], '').replace(desk['kids'][0], '') and hid not in (raw or ''), 'and the refusal names nothing hidden', (raw or '')[:120])
        check(not perr, 'no page errors at the player seat', perr[:2])
        await ctx2.close()
        await gm.evaluate(f"tw.setHidden([tw.entities()[{json.dumps(hid)}]], false)"); await settle()

        print('A BIG RUG UNDER THINGS, A SMALL THING BY ITS OWN AREA')
        await clear(gm); RX, RZ = 60, 150  # open ground, well away from the rooms
        await view(gm, RX, RZ); n0 = await gm.evaluate("Object.keys(tw.entities()).length")
        c0 = await gm.evaluate(f"(() => {{ const s = tw.screenOf({RX}, {RZ}, tw.main, 0); return [s.x, s.y]; }})()")
        await gm.evaluate("tw.modes.place(tw.assets.catById.get('rug-grand'))"); await gm.wait_for_timeout(120)
        await gm.mouse.move(*c0); await gm.wait_for_timeout(120); await gm.mouse.click(*c0)
        await wait(gm, f"Object.keys(tw.entities()).length > {n0} && tw.sync.pendingCount() === 0", 8000, 'rug placed')
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(120)
        rug = await gm.evaluate("Object.values(tw.entities()).filter(e => e.cat === 'rug-grand').map(e => e.id).at(-1)")
        await wait(gm, f"(() => {{ const r = tw.worldOf(tw.area()).recs.get({json.dumps(rug)}); return r?.visual?.userData?.loaded !== false && !r?.visual?.userData?.placeholder; }})()", 30000, 'rug mesh')
        await gm.wait_for_timeout(400)
        rs = await silhouette(gm, rug)
        check(rug and rs['box'] and rs['box'][2] - rs['box'][0] > 120, '(fixture) a big rug on open ground, from above', rs['box'] and [round(v) for v in rs['box']])
        L, T, R, B = rs['box']; n1 = await gm.evaluate("Object.keys(tw.entities()).length")
        cp = [L + 0.07 * (R - L), (T + B) / 2]
        await gm.evaluate("tw.modes.place(tw.assets.catById.get('candlestick'))"); await gm.wait_for_timeout(120)
        await gm.mouse.move(*cp); await gm.wait_for_timeout(120); await gm.mouse.click(*cp)
        await wait(gm, f"Object.keys(tw.entities()).length > {n1} && tw.sync.pendingCount() === 0", 8000, 'candle on the rug')
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(300)
        cdl = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.cat === 'candlestick' && Math.abs(e.x - {RX}) < 30 && Math.abs(e.z - {RZ}) < 30).map(e => e.id).at(-1)")
        cs = await silhouette(gm, cdl)
        check(cdl and cs['box'], '(fixture) a candlestick on the rug, near its edge', cs['box'] and [round(v) for v in cs['box']])
        # the box starts on the ground beside the rug (a press on the rug would drag it) and holds 60% of the candle
        cx1 = cut_at(cs, 0.6); m = 10
        bx = ((L - m, cs['box'][1] - m), (cx1, cs['box'][3] + m))
        check(await gm.evaluate(f"({EMPTY})({json.dumps(bx[0])})"), '(fixture) the ground beside the rug is empty', bx[0])
        rshare = await gm.evaluate(f"tw.marqueeShare({json.dumps(rug)}, {json.dumps([*bx[0], *bx[1]])})"); cshare = await gm.evaluate(f"tw.marqueeShare({json.dumps(cdl)}, {json.dumps([*bx[0], *bx[1]])})")
        await clear(gm); await box(gm, *bx); s = await sel(gm)
        check(cdl in s and rug not in s, 'a small box over 60% of a candlestick takes it by its own area, and not the big rug under it', {'candle drawn in box': round(drawn_in(cs, [*bx[0], *bx[1]]), 2), 'game: candle': round(cshare, 2), 'rug': round(rshare, 2), 'selected': len(s)})
        mid = [L + 0.4 * (R - L), T + 0.4 * (B - T), L + 0.6 * (R - L), T + 0.6 * (B - T)]
        ms_ = await gm.evaluate(f"tw.marqueeShare({json.dumps(rug)}, {json.dumps(mid)})")
        check(ms_ < 0.1, "(the rule) a small box in the rug's middle holds a small share of it (by mouse a press there drags the rug)", round(ms_, 3))
        rx1 = cut_at(rs, 0.6); bx = await left_box(gm, rs, rx1)
        if bx:
            await clear(gm); await box(gm, *bx); s = await sel(gm)
            par = await gm.evaluate(f"tw.entities()[{json.dumps(cdl)}].parent || null")
            check(rug in s and (cdl not in s if par == rug else cdl in s), 'a box over 60% of the rug takes the rug (the candle on it: folded in if it sits on the rug, else taken too)', {'parent is the rug': par == rug, 'selected': len(s)})
        else: check(False, '(fixture) empty ground to start a box over 60% of the rug')

        print('THE COST, ON A BIG MAP')
        await clear(gm)
        for i in range(24):
            await gm.evaluate(f"tw.spawnRoom('mansion-library', {2 + (i % 6) * 12}, {60 + (i // 6) * 9}, 9, 7, {200 + i})")
        await wait(gm, "tw.sync.pendingCount() === 0", 30000, 'big map sent')
        await wait(gm, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", 180000, 'big map spawned')
        await look(gm, 2 * 5 + 6 * 12 * 5 / 2, (60 + 18) * 5, 150, 55, 0); await gm.wait_for_timeout(1500)
        stats = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()); let o = 0, t = 0; for (const r of w.recs.values()) { if (r.entity.kind === 'object') o++; if (r.entity.kind === 'token') t++; } return { objects: o, tokens: t, overview: tw.overview() }; })()")
        # the worst case: every thing on screen straddles the box (each is measured with a box through its middle), first
        # with the sample cache cold, then warm; against the old rule's own work (bounds and eight corners each)
        WORST = """() => { const w = tw.worldOf(tw.area()), ids = [...w.recs.values()].filter(r => r.entity.kind === 'object' || r.entity.kind === 'token').map(r => r.entity.id);
          const run = () => { const t0 = performance.now(); let n = 0; for (const id of ids) { const r = w.recs.get(id), b = w.boundsOf(r); if (!b) continue; const c = b.min.clone().add(b.max).multiplyScalar(0.5); const s = tw.screenOf(c.x, c.z, tw.main, c.y); if (s.x < 0 || s.y < 0 || s.x > innerWidth || s.y > innerHeight) continue; n++; tw.marqueeShare(id, [s.x - 2000, s.y - 2000, s.x, s.y + 2000]); } return [performance.now() - t0, n]; };
          const old = () => { const t0 = performance.now(); for (const id of ids) { const b = w.boundsOf(w.recs.get(id)); if (b) for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) tw.screenOf(x, z, tw.main, y); } return performance.now() - t0; };
          const cold = run(), warm = run(); return { cold: cold[0], warm: warm[0], straddling: cold[1], old: old() }; }"""
        worst = await gm.evaluate(f"({WORST})()")
        real_ = []
        for bxs in (((160, 150), (1160, 600)), ((640, 150), (1160, 600)), ((300, 200), (700, 500))):
            st = None
            for dx in (0, -12, 12, -24, 24, -40, 40):
                for dy in (0, -12, 12, -24, 24):
                    q = (bxs[0][0] + dx, bxs[0][1] + dy)
                    if await gm.evaluate(f"({EMPTY})({json.dumps(q)})"): st = q; break
                if st: break
            if not st: continue
            await clear(gm); await gm.evaluate("tw.lastMarquee = null"); await box(gm, st, bxs[1]); lm = await gm.evaluate("tw.lastMarquee")
            if lm: real_.append(lm)
            else: print('  NOTE no box drawn from', st)
        print('  COST', json.dumps({**stats, 'worst': {k: round(v, 1) if isinstance(v, float) else v for k, v in worst.items()}, 'boxes': [{k: (round(v, 1) if isinstance(v, float) else v) for k, v in r.items() if k != 'box'} for r in real_]}))
        check(stats['objects'] > 300 and not stats['overview'], '(fixture) a big map at table distance', stats)
        check(real_ and max(r['ms'] for r in real_) < worst['old'], "a box on the big map is decided faster than the old rule's own work there (bounds and corners of every thing)", {'boxes ms': [round(r['ms'], 1) for r in real_], 'old rule ms': round(worst['old'], 1)})

        real = [e for e in errors if 'favicon' not in e]
        check(not real, 'no page errors', real[:3])
        await browser.close()
    bad = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(bad)}/{len(results)} checks passed")
    for r in bad: print('  FAIL', r[1], r[2])
    return 1 if bad else 0

code = 1
try: code = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for pr in procs:
        try: pr.wait(5)
        except Exception: pr.kill()
    for d in tmpdirs: shutil.rmtree(d, ignore_errors=True)
sys.exit(code)

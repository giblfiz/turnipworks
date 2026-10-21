#!/usr/bin/env python3
"""The pieces storeys generate are things of their own (Harry 2026-10-06). GM tab + player tab.

  local:  TW_GPU=1 python3 engine/test/browser_pieces.py --local
  shots:  ... browser_pieces.py --local --shots   (full look; engine/test/shots/pieces-*.png for a Gemini blind read)

Harry: "I'm looking at some pillars that are holding up an overhang, and I don't seem to be able to select them as
first-class objects" and, of the railing round a stair's hole, "I think we do need them, but just as a normal kind of
furniture that gets placed by default."

  SUPPORTS  the bracket under a jetty and the post under a two-square overhang: a click takes THE PIECE (not its room),
            it has an object's ring, Delete removes just it (undo brings it back), a drag makes it an ordinary object
            that looks the same, Replace swaps it, it is hidden from players with its room. By wall family: timber
            pieces under timber walls, stone under stone (a castle's walls count as stone); each at its own proportions
  RAILS     a stair's hole gets a railing on every open side by default, none across the way out at the top, none where
            a wall stands; it follows the stair when it is moved or turned; it goes and comes back with the stair
            (undo); a section is selected, deleted, dragged like any thing; by wall family; the player sees the same
  TALL      a tall room's upper wall pieces are pieces of their own too
  AUDIT     "everything on screen is touchable", in its strict form (the piece ITSELF, and roofs with their trim), over
            the whole scene at each level and with roofs on; and the old form is shown to have missed the supports
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
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

RP, SP = 18127, 18754
def start_local(full=False):
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-pieces-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro' + ('' if full else '&nopost&faces=1500')

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def view(pg, x, z, dist=80, pitch=60, yaw=0, y=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(300)
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over'); await pg.wait_for_timeout(300)
async def drag(pg, a, b, steps=12):
    await pg.mouse.move(a['x'], a['y']); await pg.mouse.down()
    for i in range(1, steps + 1): await pg.mouse.move(a['x'] + (b['x'] - a['x']) * i / steps, a['y'] + (b['y'] - a['y']) * i / steps); await pg.wait_for_timeout(25)
    await pg.mouse.up(); await pg.wait_for_timeout(500)

W = "tw.worldOf(tw.area())"
# a screen point where the ordinary pick's FIRST answer is this generated piece (probed over its box), or null
SEEN = """((key) => { const w = tw.worldOf(tw.area()), s = w.shell.get(key); if (!s) return null; const b = w.shellBounds(key), V = b.min.constructor;
  for (const fy of [0.5, 0.3, 0.7, 0.15, 0.85]) for (const fx of [0.5, 0.3, 0.7]) for (const fz of [0.5, 0.2, 0.8]) {
    const p = new V(b.min.x + (b.max.x - b.min.x) * fx, b.min.y + (b.max.y - b.min.y) * fy, b.min.z + (b.max.z - b.min.z) * fz), q = p.clone().project(tw.main.camera), c = document.getElementById('c').getBoundingClientRect();
    const x = c.left + (q.x + 1) / 2 * c.width, y = c.top + (1 - q.y) / 2 * c.height; if (x < c.left + 5 || y < c.top + 70 || x > c.right - 5 || y > c.bottom - 60) continue;
    if (document.elementFromPoint(x, y)?.id !== 'c') continue;
    const sel = w.pickAll(tw.rayAt(x, y)).map(h => tw.selectionFor(h)).filter(Boolean); if (sel[0] === 'wall:' + key) return { x, y }; }
  return null; })"""
# what is drawn for a key: where, how big, of what (the generated piece, or the object that took its place)
DRAWN = """((key) => { const w = tw.worldOf(tw.area()), s = w.shell.get(key);
  const box = (g) => { g.updateMatrixWorld(true); let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; const v = new (g.position.constructor)(); g.traverse(o => { if (!o.isMesh || !o.geometry?.attributes?.position || o.userData.halo) return; const p = o.geometry.attributes.position, st = Math.max(1, Math.floor(p.count / 1500)); for (let i = 0; i < p.count; i += st) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); mn = [Math.min(mn[0], v.x), Math.min(mn[1], v.y), Math.min(mn[2], v.z)]; mx = [Math.max(mx[0], v.x), Math.max(mx[1], v.y), Math.max(mx[2], v.z)]; } }); return { min: mn.map(n => +n.toFixed(2)), max: mx.map(n => +n.toFixed(2)) }; };
  if (s) return { gen: true, id: s.spec.id, sku: s.spec.sku, loaded: !!s.visual && !s.visual.userData?.placeholder, room: s.roomId, fit: s.visual?.userData?.fit?.scale || null, ...box(s.group) };
  const o = Object.values(tw.entities()).find(e => e.kind === 'object' && e.fromEdge === key), r = o && w.recs.get(o.id);
  return o ? { gen: false, obj: o.id, id: o.cat, sku: o.sku, place: o.place, room: o.room, hidden: !!o.hidden, loaded: !!r?.visual && !r.visual.userData?.placeholder, ...(r ? box(r.group) : {}) } : null; })"""
RING = "JSON.stringify({ ring: [...document.querySelectorAll('#ring [data-cmd]')].map(b => b.dataset.cmd), hidden: document.getElementById('ring').hidden, sel: [...tw.sel], kind: tw.selected()[0]?.kind, name: tw.selected()[0]?.name })"
# the audit as it was before 2026-10-06: "resolves to something selectable" (kept to show what it missed)
OLD_AUDIT_ON = """((keys) => { const w = tw.worldOf(tw.area()); let n = 0, own = 0, room = 0; for (const key of keys) { const s = w.shell.get(key); if (!s) continue; const b = w.shellBounds(key), c = b.getCenter(new b.min.constructor()), q = c.project(tw.main.camera), r = document.getElementById('c').getBoundingClientRect();
  const sel = w.pickAll(tw.rayAt(r.left + (q.x + 1) / 2 * r.width, r.top + (1 - q.y) / 2 * r.height)).map(h => tw.selectionFor(h)).filter(Boolean); n++; if (sel.includes('wall:' + key)) own++; if (sel.includes(s.roomId)) room++; } return { n, own, room }; })"""
near = lambda a, b, t=0.25: all(abs(x - y) <= t for x, y in zip(a, b))

async def main():
    full = A.shots
    page = start_local(full) if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, permissions=['clipboard-read', 'clipboard-write'])
            if os.environ.get('TW_SLOW_ASSETS'):
                async def _slow(route): await asyncio.sleep(int(os.environ['TW_SLOW_ASSETS']) / 1000); await route.continue_()
                await ctx.route('**/*.glb', _slow)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url); return pg
        gm = await tab(page, *((1920, 1080) if full else (1400, 900)))
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST nits pieces {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')

        # two buildings, each with a one-square overhang to the west and a two-square overhang to the east, and a stair:
        # a timber inn (x 0..30 ft) and one with castle walls (x 100..130 ft)
        async def build(x0, fam):
            g = await gm.evaluate(f"tw.spawnRoom('common', {x0}, 0, 6, 4, 5101)"); await wait(gm, f"tw.entities()['{g}'] && tw.sync.pendingCount() === 0", 30000, 'ground room')
            if fam: await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{g}', wallFamily: '{fam}' }})"); await gm.wait_for_timeout(300)
            u = await gm.evaluate(f"tw.spawnRoom('guest', {x0 - 1}, 0, 9, 4, 5202, undefined, 10)"); await wait(gm, f"tw.entities()['{u}'] && tw.sync.pendingCount() === 0", 30000, 'upper room')
            # (2026-10-11: a room drawn by hand gets no stair; this suite takes the offer, or the planner's stair)
            sid = await gm.evaluate(f"tw.lastStair = tw.takeStairOffer('{u}', {{ any: true }}) || tw.addStair(tw.entities()['{u}'])"); await wait(gm, "tw.lastStair && tw.entities()[tw.lastStair] && tw.sync.pendingCount() === 0", 30000, 'its stair'); await gm.evaluate("tw.condButtons.hide('stair-offer')")
            if fam: await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{u}', wallFamily: '{fam}' }})"); await gm.wait_for_timeout(300)
            return g, u, sid
        G, U, SID = await build(0, None)
        G2, U2, SID2 = await build(20, 'castle-rough')
        await settle(gm); await wait(gm, f"{W}.kitReport().filter(k => k.kind === 'support').every(k => k.loaded) && {W}.rails().every(r => r.loaded)", 40000, 'kit meshes')
        if A.shots: return await shots(gm, (G, U, SID), (G2, U2, SID2), browser)
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
        pl = await tab(invite + '&nofx')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab joined'); await settle(pl, 60000)

        # ================= SUPPORTS =================
        print('SUPPORTS: the bracket and the post under an overhang are things of their own')
        sup = await gm.evaluate(f"{W}.supports()")
        fam = await gm.evaluate("Object.fromEntries(tw.roomgen.roomsOf(tw.entities()).map(r => [r.id, r.family]))")
        tb = [s for s in sup if s['room'] == U and s['kind'] == 'bracket']; tp = [s for s in sup if s['room'] == U and s['kind'] == 'post']
        sb = [s for s in sup if s['room'] == U2 and s['kind'] == 'bracket']; sp = [s for s in sup if s['room'] == U2 and s['kind'] == 'post']
        check(len(tb) == 8 and len(tp) == 3 and len(sb) == 8 and len(sp) == 3, 'each building: a bracket per 5 ft under each one-square overhang (8), posts under the two-square one (3)', f'{len(tb)} {len(tp)} {len(sb)} {len(sp)}')
        check(all(s['id'] == 'jetty-bracket' for s in tb) and all(s['id'] == 'post-timber' and s['sku'] == 'post-timber--plain' for s in tp), f"timber walls ({fam[U]}): the jetty bracket and the plain timber post", str(sorted({(s['id'], s['sku']) for s in tb + tp})))
        check(all(s['id'] == 'corbel-stone' for s in sb) and all(s['id'] == 'pillar-square' for s in sp), f"castle walls ({fam[U2]}) count as stone: the stone corbel and a stone pier (not a timber post)", str(sorted({(s['id'], s['sku']) for s in sb + sp})))
        keys = await gm.evaluate(f"[...{W}.shell.values()].filter(s => s.spec.support).map(s => [s.key, s.spec.support, s.roomId, s.group.userData.edgeKey])")
        check(all(k[0] == k[3] for k in keys) and all((k[0].startswith('p') if k[1] == 'post' else k[0].startswith('j')) and k[0].endswith('@10') for k in keys), 'every support has its own key (p… a post, j… a bracket, at its room\'s height)', str(keys[:3]))
        # AT ITS OWN PROPORTIONS: one scale for all three axes (within 12%), standing from the ground to the slab
        PK = 'p8:2@10'; SK = 'p28:2@10'
        d = await gm.evaluate(DRAWN + f"('{PK}')"); d2 = await gm.evaluate(DRAWN + f"('{SK}')")
        uni = lambda f: f and max(f) / min(f) < 1.12
        check(d and uni(d['fit']) and abs(d['min'][1]) < 0.2 and abs(d['max'][1] - 9) < 0.2 and 1.2 < d['max'][0] - d['min'][0] < 2.6, 'the timber post is not squeezed or stretched (one scale on all axes), ground to slab, 1.2 to 2.6 ft across', json.dumps(d))
        check(d2 and uni(d2['fit']) and abs(d2['min'][1]) < 0.2 and abs(d2['max'][1] - 9) < 0.2 and 2.4 < d2['max'][0] - d2['min'][0] < 3.6, 'the stone pier likewise, 2.4 to 3.6 ft across', json.dumps(d2))
        check(d['max'][0] <= 40.55 and d2['max'][0] <= 140.55, 'a post stands in from the corner: its outer face in line with the wall above it, not past the slab\'s edge', f"{d['max'][0]} {d2['max'][0]}")
        # a click takes THE POST
        await view(gm, 37, 10, 55, 38, 55, 5)
        pt = await gm.evaluate(SEEN + f"('{PK}')")
        check(pt, 'the middle post can be seen and is the first thing under the pointer somewhere on it')
        if pt:
            await gm.mouse.click(pt['x'], pt['y']); await gm.wait_for_timeout(350)
            st = json.loads(await gm.evaluate(RING))
            check(st['sel'] == [f'wall:{PK}'] and st['kind'] == 'object' and st['name'] == 'Post' and not st['hidden'] and 'ring.menu' in ''.join(st['ring']) + 'ring.menu', 'a click on a post selects THE POST (not the room it holds up), with a thing\'s ring', json.dumps(st))
            check(U not in st['sel'], 'its room is not what got selected')
        old = await gm.evaluate(OLD_AUDIT_ON + f"({json.dumps([k[0] for k in keys])})")
        check(old['own'] > 0, 'supports now answer a pick as themselves', str(old))
        # Delete removes just it; undo brings it back
        n0 = await gm.evaluate(f"{W}.supports().length")
        await gm.evaluate(f"tw.select(['wall:{PK}']); tw.deleteSelection()")
        ok = await wait(gm, f"!{W}.shell.has('{PK}') && tw.sync.pendingCount() === 0", 8000, 'post deleted')
        check(ok and await gm.evaluate(f"{W}.supports().length") == n0 - 1 and await gm.evaluate(f"!!tw.entities()['{U}']"), 'Delete removes just that post: the others and the room stay', str(await gm.evaluate(f"{W}.supports().length")))
        check(await wait(pl, f"!{W}.shell.has('{PK}')", 8000, 'player post gone'), 'the player\'s post is gone too (it is a command, not a local change)')
        await gm.keyboard.press('Control+z'); ok = await wait(gm, f"{W}.shell.has('{PK}')", 8000, 'undo delete')
        check(ok and await wait(pl, f"{W}.shell.has('{PK}')", 8000), 'undo brings it back, for both seats')
        # a drag makes it an ordinary object that looks the same, and stays where it is put
        await wait(gm, f"{W}.kitReport().filter(k => k.kind === 'support').every(k => k.loaded)", 20000)
        before = await gm.evaluate(DRAWN + f"('{PK}')")
        await gm.evaluate(f"tw.select(['wall:{PK}']); tw.materializeSelection()"); await wait(gm, f"Object.values(tw.entities()).some(e => e.fromEdge === '{PK}') && tw.sync.pendingCount() === 0", 8000, 'post materialized')
        await wait(gm, f"(() => {{ const o = Object.values(tw.entities()).find(e => e.fromEdge === '{PK}'), r = o && {W}.recs.get(o.id); return r?.visual && !r.visual.userData?.placeholder; }})()", 20000, 'object mesh')
        after = await gm.evaluate(DRAWN + f"('{PK}')")
        check(after and not after['gen'] and after['place'] == 'kit' and after['room'] == U and near(before['min'], after['min']) and near(before['max'], after['max']) and not await gm.evaluate(f"{W}.shell.has('{PK}')"), 'made into an object it is the same post in the same place (measured), and the generated one is gone', json.dumps({'before': [before['min'], before['max']], 'after': [after['min'], after['max']]}))
        oid = after['obj']
        await gm.evaluate(f"tw.dispatch('object.move', {{ id: '{oid}', x: 45, z: 12.5, y: 0 }})"); await wait(gm, f"tw.entities()['{oid}'].x === 45", 6000)
        check(await gm.evaluate(f"!{W}.shell.has('{PK}') && tw.entities()['{oid}'].x === 45"), 'moved, it stays moved and no new post grows where it was')
        sim = await gm.evaluate(f"tw.assets.similar(tw.entities()['{oid}'].cat).length")
        check(sim >= 1, 'Replace has something to offer for it', str(sim))
        await gm.keyboard.press('Control+z'); await gm.keyboard.press('Control+z'); ok = await wait(gm, f"{W}.shell.has('{PK}') && !tw.entities()['{oid}']", 8000, 'undo move + materialize')
        check(ok, 'undo twice puts the generated post back')
        # a bracket
        await view(gm, -3, 10, 42, 18, -70, 5)
        BK = next(k[0] for k in keys if k[1] == 'bracket' and k[2] == U and k[0].startswith('jv:0:'))
        bp = None
        for k in [k[0] for k in keys if k[1] == 'bracket' and k[2] == U and k[0].startswith('jv:0:')]:
            bp = await gm.evaluate(SEEN + f"('{k}')")
            if bp: BK = k; break
        check(bp, 'a jetty bracket can be seen from below the overhang')
        if bp:
            await gm.mouse.click(bp['x'], bp['y']); await gm.wait_for_timeout(350); st = json.loads(await gm.evaluate(RING))
            check(st['sel'] == [f'wall:{BK}'] and st['name'] == 'Jetty bracket', 'a click on a bracket selects that bracket', json.dumps(st))
        b0 = await gm.evaluate(DRAWN + f"('{BK}')")
        await gm.evaluate(f"tw.select(['wall:{BK}']); tw.materializeSelection()"); await wait(gm, f"(() => {{ const o = Object.values(tw.entities()).find(e => e.fromEdge === '{BK}'), r = o && {W}.recs.get(o.id); return r?.visual && !r.visual.userData?.placeholder; }})()", 20000, 'bracket object')
        b1 = await gm.evaluate(DRAWN + f"('{BK}')")
        check(b1 and not b1['gen'] and near(b0['min'], b1['min']) and near(b0['max'], b1['max']), 'a bracket made into an object keeps its place, its turn and its size (measured)', json.dumps({'before': [b0['min'], b0['max']], 'after': b1 and [b1['min'], b1['max']]}))
        await gm.keyboard.press('Control+z'); await wait(gm, f"{W}.shell.has('{BK}')", 8000, 'undo bracket')
        # hidden with its room; an edit made in a hidden room does not reach the player
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{U2}'], hidden: true }})"); await wait(pl, f"!tw.entities()['{U2}']", 8000, 'castle upper hidden'); await pl.wait_for_timeout(600)
        check(await pl.evaluate(f"{W}.supports().filter(s => s.x > 60).length") == 0, 'hide the upper room and the player has none of its brackets or posts')
        await gm.evaluate(f"tw.select(['wall:{SK}']); tw.deleteSelection()"); await wait(gm, f"!{W}.shell.has('{SK}') && tw.sync.pendingCount() === 0", 8000)
        leak = await pl.evaluate(f"JSON.stringify(tw.entities()).includes('{SK.replace(':', 'z').replace('@', 'a')}') || Object.values(tw.entities()).some(e => e.kind === 'edge' && e.key === '{SK}')")
        check(not leak, 'deleting a post of a hidden storey does not reach the player (no trace of the edit)')
        await gm.keyboard.press('Control+z'); await wait(gm, f"{W}.shell.has('{SK}')", 8000)
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{U2}'], hidden: false }})"); await wait(pl, f"tw.entities()['{U2}']", 8000); await pl.wait_for_timeout(1200)
        check(await pl.evaluate(f"{W}.supports().length") == len(sup), 'revealed, the player draws every support again', str(await pl.evaluate(f"{W}.supports().length")))

        # ================= RAILS =================
        print('RAILS: the railing round a stair\'s hole')
        await gm.evaluate("tw.select([])")
        st = await gm.evaluate(f"(() => {{ const s = tw.entities()['{SID}'], S = tw.ST; return {{ x: s.x, z: s.z, rot: s.rot || 0, cells: S.stairCells(s), ends: S.stairEnds(s), dir: S.stairDir(s) }}; }})()")
        rails = await gm.evaluate(f"{W}.rails()")
        mine = [r for r in rails if r['stair'] == SID]; cas = [r for r in rails if r['stair'] == SID2]
        plan = await gm.evaluate(f"tw.ST.stairRails(tw.entities(), tw.entities()['{SID}']).map(r => r.key).sort()")
        check(len(mine) >= 3 and sorted(r['key'] for r in mine) == plan and all(r['y'] == 10 and r['room'] == U for r in mine), 'the stair\'s hole upstairs has a railing by default: a section per open side, on the upper floor, belonging to the upper room', f"{len(mine)} sections {plan}")
        # none across the way out at the top; none beyond a wall; every other side of the hole that is floor has one
        top = st['ends']['topCell']; last = [c for c in st['cells'] if c[0] + st['dir'][0] == top[0] and c[1] + st['dir'][1] == top[1]][0]
        exitx, exitz = (last[0] + top[0] + 1) * 2.5, (last[1] + top[1] + 1) * 2.5
        check(not any(abs(r['x'] - exitx) < 0.1 and abs(r['z'] - exitz) < 0.1 for r in mine), 'none across the way out at the top: the top landing stays clear', f'exit edge at {exitx},{exitz}')
        sides = await gm.evaluate(f"(() => {{ const E = tw.entities(), u = E['{U}'].recipe, cells = {json.dumps(st['cells'])}, hole = new Set(cells.map(c => c.join(':'))), has = (x, z) => x >= u.x && x < u.x + u.w && z >= u.z && z < u.z + u.d; let open = 0, wall = 0; for (const [x, z] of cells) for (const [a, b] of [[1,0],[-1,0],[0,1],[0,-1]]) {{ if (hole.has((x+a)+':'+(z+b))) continue; if (has(x+a, z+b)) open++; else wall++; }} return {{ open, wall }}; }})()")
        check(len(mine) == sides['open'] - 1, 'every open side of the hole but the way out has a section; none where a wall stands', f"{len(mine)} sections, {sides['open']} open sides, {sides['wall']} at walls")
        check(all(r['id'] == 'railing-wood' and 'timber' in r['sku'] for r in mine), 'a timber building gets the timber railing', str({r['sku'] for r in mine}))
        check(cas and all(r['id'] == 'railing-iron' for r in cas), 'a stone building (castle walls) gets the iron railing, not a timber one or a parapet', str({r['sku'] for r in cas}))
        rk = mine[0]['key']; dr = await gm.evaluate(DRAWN + f"('{rk}')")
        w_, h_, d_ = (dr['max'][i] - dr['min'][i] for i in (0, 1, 2))
        check(dr['loaded'] and abs(dr['min'][1] - 10) < 0.2 and 2.4 < h_ < 3.4 and abs(max(w_, d_) - 5) < 0.3 and min(w_, d_) < 0.9, 'a section is about 5 ft long, 3 ft high and thin, standing on the upper floor', json.dumps(dr))
        # see-through: most rays through a section's face pass between its bars
        thru = await gm.evaluate(f"""(() => {{ const w = {W}, out = {{}}; for (const key of ['{rk}', '{cas[0]['key'] if cas else rk}']) {{ const s = w.shell.get(key), b = w.shellBounds(key), R = new (tw.rayAt(0, 0).constructor)(), V = b.min.constructor; const alongX = (b.max.x - b.min.x) > (b.max.z - b.min.z); let hit = 0, n = 0;
          for (let i = 0; i < 24; i++) for (let j = 0; j < 8; j++) {{ const u = (i + 0.5) / 24, v = 0.25 + 0.5 * (j + 0.5) / 8, y = b.min.y + (b.max.y - b.min.y) * v; const o = alongX ? new V(b.min.x + (b.max.x - b.min.x) * u, y, b.min.z - 3) : new V(b.min.x - 3, y, b.min.z + (b.max.z - b.min.z) * u); R.set(o, alongX ? new V(0, 0, 1) : new V(1, 0, 0)); R.camera = tw.main.camera; n++; if (R.intersectObject(s.group, true).some(h => h.object.isMesh)) hit++; }}
          out[s.spec.id] = +(hit / n).toFixed(2); }} return out; }})()""")
        check(all(v < 0.85 for v in thru.values()), 'a railing is not a solid slab: its face is open between its bars and braces (share of rays through the middle band that hit something; a slab is 1.0)', json.dumps(thru))
        check(await pl.evaluate(f"{W}.rails().filter(r => r.stair === '{SID}').map(r => r.key).sort().join()") == ','.join(plan), 'the player has the same railing (it is worked out from the stair)')
        # a click takes the section; it is deleted and dragged like any thing
        await gm.evaluate("tw.setCut(19, { pinned: true, by: 'test' })"); await view(gm, st['x'], st['z'], 40, 55, 0.4, 10); await gm.wait_for_timeout(600)
        rp = None
        for r in mine:
            rp = await gm.evaluate(SEEN + f"('{r['key']}')")
            if rp: rk = r['key']; break
        check(rp, 'a railing section is the first thing under the pointer somewhere on it')
        if rp:
            await gm.mouse.click(rp['x'], rp['y']); await gm.wait_for_timeout(350); s2 = json.loads(await gm.evaluate(RING))
            check(s2['sel'] == [f'wall:{rk}'] and s2['kind'] == 'object' and s2['name'] == 'Railing' and not s2['hidden'], 'a click selects that section of railing, with a thing\'s ring', json.dumps(s2))
            await gm.keyboard.press('Delete'); ok = await wait(gm, f"!{W}.shell.has('{rk}') && tw.sync.pendingCount() === 0", 8000, 'rail deleted')
            check(ok and await gm.evaluate(f"{W}.rails().filter(r => r.stair === '{SID}').length") == len(mine) - 1, 'Delete removes that one section')
            await gm.keyboard.press('Control+z'); check(await wait(gm, f"{W}.shell.has('{rk}')", 8000, 'undo rail'), 'undo brings it back')
            await wait(gm, f"{W}.rails().every(r => r.loaded)", 20000)
            rp = await gm.evaluate(SEEN + f"('{rk}')") or rp
            r0 = next(r for r in mine if r['key'] == rk)
            to = await gm.evaluate(f"tw.screenOf({r0['x'] + (6 if r0['x'] < 20 else -6)}, {r0['z'] + 0.01}, tw.main, 10)")
            await drag(gm, rp, to); await wait(gm, f"Object.values(tw.entities()).some(e => e.fromEdge === '{rk}') && tw.sync.pendingCount() === 0", 8000, 'rail dragged')
            o = await gm.evaluate(f"Object.values(tw.entities()).find(e => e.fromEdge === '{rk}') || null")
            check(o and o['place'] == 'floor' and abs(o['y'] - 10) < 0.1 and (abs(o['x'] - r0['x']) > 2 or abs(o['z'] - r0['z']) > 2) and not await gm.evaluate(f"{W}.shell.has('{rk}')"), 'a drag moves it like furniture: it becomes an ordinary object on the upper floor where it was put, and no new section grows in the gap', json.dumps(o and {k: o[k] for k in ('x', 'y', 'z', 'place', 'room', 'cat')}))
            walls0 = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'edge' && /^[hv]:/.test(e.key)).length")
            check(walls0 == 0, 'dragging a railing never opens a wall', str(walls0))
            for _ in range(3):
                if await gm.evaluate(f"{W}.shell.has('{rk}')"): break
                await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(500)
            check(await gm.evaluate(f"{W}.shell.has('{rk}')"), 'undo puts the generated section back')
        # it follows the stair: move it a square, turn it a quarter turn
        await gm.evaluate("tw.select([])")
        mv = await gm.evaluate(f"(() => {{ const s = tw.entities()['{SID}'], S = tw.ST, E = tw.entities(), g = E['{G}'].recipe, u = E['{U}'].recipe; for (const [dx, dz] of [[5,0],[-5,0],[0,5],[0,-5],[10,0],[-10,0]]) {{ const t = {{ ...s, x: s.x + dx, z: s.z + dz }}, cs = S.stairCells(t), en = S.stairEnds(t); const inG = ([x, z]) => x >= g.x && x < g.x + g.w && z >= g.z && z < g.z + g.d, inU = ([x, z]) => x >= u.x && x < u.x + u.w && z >= u.z && z < u.z + u.d; if (cs.every(c => inG(c) && inU(c)) && inG(en.footCell) && inU(en.topCell)) return [dx, dz]; }} return null; }})()")
        if mv:
            await gm.evaluate(f"tw.dispatch('object.move', {{ id: '{SID}', x: {st['x'] + mv[0]}, z: {st['z'] + mv[1]}, y: 0 }})"); await wait(gm, f"tw.entities()['{SID}'].x === {st['x'] + mv[0]} && tw.entities()['{SID}'].z === {st['z'] + mv[1]} && tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(500)
            now = await gm.evaluate(f"{W}.rails().filter(r => r.stair === '{SID}').map(r => r.key).sort()"); want = await gm.evaluate(f"tw.ST.stairRails(tw.entities(), tw.entities()['{SID}']).map(r => r.key).sort()")
            check(now == want and now != plan, 'move the stair and its railing goes with the hole', f'{plan} -> {now}')
            await gm.keyboard.press('Control+z'); await wait(gm, f"tw.entities()['{SID}'].x === {st['x']} && tw.entities()['{SID}'].z === {st['z']}", 8000); await gm.wait_for_timeout(400)
            check(await gm.evaluate(f"{W}.rails().filter(r => r.stair === '{SID}').map(r => r.key).sort()") == plan, 'undo the move and the railing is back where it was')
        else: check(False, 'a free square to move the stair to (test scene)')
        await gm.evaluate(f"tw.dispatch('object.move', {{ id: '{SID}', x: {st['x']}, z: {st['z']}, y: 0, rot: {st['rot'] + 3.141592653589793} }})"); await wait(gm, f"Math.abs(tw.entities()['{SID}'].rot - {st['rot'] + 3.141592653589793}) < 0.01 && tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(500)
        t2 = await gm.evaluate(f"(() => {{ const s = tw.entities()['{SID}'], S = tw.ST, en = S.stairEnds(s), cs = S.stairCells(s), d = S.stairDir(s), last = cs.find(c => c[0] + d[0] === en.topCell[0] && c[1] + d[1] === en.topCell[1]); return {{ ex: (last[0] + en.topCell[0] + 1) * 2.5, ez: (last[1] + en.topCell[1] + 1) * 2.5, rails: {W}.rails().filter(r => r.stair === '{SID}').map(r => [r.key, r.x, r.z]) }}; }})()")
        check(len(t2['rails']) >= 3 and not any(abs(r[1] - t2['ex']) < 0.1 and abs(r[2] - t2['ez']) < 0.1 for r in t2['rails']) and any(abs(r[1] - exitx) < 0.1 and abs(r[2] - exitz) < 0.1 for r in t2['rails']), 'turn the stair round and the open side turns with it: the new way out is clear, the old one is railed', json.dumps(t2))
        await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(600)
        # the railing comes and goes with the stair
        await gm.evaluate(f"tw.select(['{SID}']); tw.deleteSelection()"); await wait(gm, f"!tw.entities()['{SID}'] && tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(400)
        check(await gm.evaluate(f"{W}.rails().filter(r => r.stair === '{SID}').length") == 0 and await pl.evaluate(f"{W}.rails().filter(r => r.stair === '{SID}').length") == 0, 'delete the stair and its railing goes with it (the floor closes)')
        await gm.keyboard.press('Control+z'); await wait(gm, f"tw.entities()['{SID}']", 8000); await gm.wait_for_timeout(500)
        check(await gm.evaluate(f"{W}.rails().filter(r => r.stair === '{SID}').map(r => r.key).sort()") == plan, 'undo brings the stair and its railing back')
        # hidden: a player with a hidden upper room has no hole and no railing
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{U}'], hidden: true }})"); await wait(pl, f"!tw.entities()['{U}']", 8000); await pl.wait_for_timeout(500)
        check(await pl.evaluate(f"{W}.rails().filter(r => r.y === 10 && r.x < 60).length") == 0, 'hide the upper room: the player has no railing there (and no stair, no hole)')
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{U}'], hidden: false }})"); await wait(pl, f"tw.entities()['{U}']", 8000)
        # a pawn is not kept off the landing: dropped on the stair's foot square it arrives upstairs beyond the top
        hop = await gm.evaluate(f"tw.ST.stairHop(tw.entities(), {st['x']}, {st['z']}, 0)")
        check(hop and abs(hop['y'] - 10) < 0.1 and not any(abs(r['x'] - hop['x']) < 2.4 and abs(r['z'] - hop['z']) < 2.4 for r in mine), 'the top landing a pawn arrives on has no railing on it', json.dumps(hop))

        # ================= TALL =================
        print('TALL: a tall room\'s upper walls are pieces of their own')
        T = await gm.evaluate("tw.spawnRoom('storeroom', 50, 0, 3, 3, 77)"); await wait(gm, f"tw.entities()['{T}'] && tw.sync.pendingCount() === 0", 20000)
        await gm.evaluate(f"tw.dispatch('room.tall', {{ id: '{T}', tall: 2 }})"); await wait(gm, f"tw.entities()['{T}'].recipe.tall === 2", 8000); await settle(gm)
        up = await gm.evaluate(f"[...{W}.shell.values()].filter(s => s.spec.stack && s.roomId === '{T}').map(s => [s.key, s.group.userData.edgeKey])")
        check(len(up) >= 12 and all(k == e and k.endswith('@10') for k, e in up), 'each upper wall piece and post of a tall room has the wall key of its own height', f'{len(up)} pieces, e.g. {up[:2]}')
        uk = next(k for k, _ in up if k.startswith('h:'))
        await gm.evaluate(f"tw.select(['wall:{uk}'])"); await gm.wait_for_timeout(300); s3 = json.loads(await gm.evaluate(RING))
        check(s3['sel'] == [f'wall:{uk}'] and s3['kind'] == 'object', 'an upper wall piece is selected as itself', json.dumps(s3))
        await gm.evaluate("tw.deleteSelection()"); ok = await wait(gm, f"!{W}.shell.has('{uk}') && tw.sync.pendingCount() === 0", 8000)
        check(ok and await gm.evaluate(f"{W}.shell.has('{uk.split('@')[0]}')"), 'Delete opens just that upper piece; the wall below it stands')
        await gm.keyboard.press('Control+z'); check(await wait(gm, f"{W}.shell.has('{uk}')", 8000), 'undo puts it back')

        # ================= AUDIT =================
        print('AUDIT: everything on screen is touchable AS ITSELF (the strict form), at each level and with roofs on')
        await gm.evaluate("tw.select([])"); await settle(gm)
        async def audit(name, **v):
            await view(gm, **v); await gm.wait_for_timeout(500); au = await gm.evaluate(AUDIT)
            check(au['tested'] > 60 and au['nbad'] == 0, name, f"{au['tested']} points ({au['pieces']} on generated pieces, {au['roofs']} on roofs): {au['untouchable']} untouchable, {au['notOwn']} not selectable as themselves {json.dumps(au['bad'][:3]) if au['nbad'] else ''} {au['kinds'] if au['nbad'] else ''}")
            return au
        await gm.evaluate("tw.setCut(null, { by: 'test' })")
        await audit('all levels, the timber inn from the east (posts)', x=37, z=10, dist=55, pitch=38, yaw=55, y=5)
        await audit('all levels, the timber inn from under the jetty (brackets)', x=-3, z=10, dist=42, pitch=18, yaw=-70, y=5)
        await audit('all levels, the castle-walled building (corbels, piers)', x=137, z=10, dist=55, pitch=38, yaw=55, y=5)
        await audit('all levels, the tall room', x=258, z=8, dist=45, pitch=40, yaw=30, y=8)
        await gm.evaluate("tw.setCut(19, { pinned: true, by: 'test' })")
        au = await audit('cut to lv 2, over the stair hole (railing)', x=st['x'], z=st['z'], dist=40, pitch=55, yaw=0.4, y=10)
        await audit('cut to lv 2, the castle\'s stair hole (iron railing)', x=st['x'] + 100, z=st['z'], dist=40, pitch=55, yaw=0.4, y=10)
        await gm.evaluate("tw.setCut(9, { pinned: true, by: 'test' })")
        await audit('cut to lv 1 (supports hide with the room they hold up)', x=37, z=10, dist=55, pitch=38, yaw=55, y=5)
        await gm.evaluate("tw.setCut(null, { by: 'test' }); tw.setRoofs(true, 'test')"); await gm.wait_for_timeout(2500)
        await wait(gm, f"{W}.kitReport().filter(k => k.kind === 'roof').every(k => k.loaded)", 30000, 'roof trim')
        ar = await audit('roofs on: roofs, chimneys, ridge and trim resolve to their roof', x=20, z=10, dist=80, pitch=45, yaw=30, y=8)
        check(ar['roofs'] > 50, 'the audit really sampled the roofs (it did not look at them before)', str(ar['roofs']))
        await gm.evaluate("tw.setRoofs(false, 'test')")
        # THE NEGATIVE: with a post made to answer as its room again (as before 2026-10-06), the strict audit fails
        await view(gm, 37, 10, 55, 38, 55, 5)
        neg = await gm.evaluate(f"(() => {{ const w = {W}, ps = [...w.shell.values()].filter(s => s.spec.support === 'post'); ps.forEach(s => {{ s.group.userData.edgeKey = null; s.group.userData.roomPiece = s.roomId; }}); const a = {AUDIT}; ps.forEach(s => {{ s.group.userData.edgeKey = s.key; s.group.userData.roomPiece = null; }}); return a; }})()")
        check(neg['untouchable'] == 0 and neg['notOwn'] > 0, 'the old rule would still pass a post that selects its room (0 "untouchable"); the strict audit catches it', f"untouchable {neg['untouchable']}, not selectable as themselves {neg['notOwn']}")

        real = [e for e in errors if not any(s in e for s in ('WebSocket', 'ERR_CONNECTION', '502'))]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'pieces: {passed}/{len(results)} passed')
    return passed == len(results)

async def shots(gm, a, b, browser):
    """full look, 1920x1080: what holds each overhang up, and each stair hole with a pawn beyond its railing"""
    await gm.evaluate("tw.select([])"); await gm.wait_for_timeout(4000)
    n = 0
    for name, (x, z, dist, pitch, yaw) in {'timber-posts': (37, 10, 55, 38, 55), 'timber-jetty': (-3, 10, 42, 18, -70), 'stone-piers': (137, 10, 55, 38, 55), 'stone-jetty': (97, 10, 42, 18, -70)}.items():
        await view(gm, x, z, dist, pitch, yaw, 5); await gm.wait_for_timeout(1500); await gm.screenshot(path=os.path.join(SHOTS, f'pieces-{name}.png'))
    await gm.evaluate("tw.setCut(19, { pinned: true, by: 'test' })")
    for name, (g, u, sid) in (('timber', a), ('stone', b)):
        s = await gm.evaluate(f"tw.entities()['{sid}']")
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_rail{n}0000', name: 'Mira', x: {s['x']}, z: {s['z'] - 6}, y: 10 }})"); n += 1; await gm.wait_for_timeout(1500)
        await view(gm, s['x'], s['z'], 38, 50, 0, 10); await gm.wait_for_timeout(1500); await gm.screenshot(path=os.path.join(SHOTS, f'pieces-rail-{name}-close.png'))
        await view(gm, s['x'] + 5, s['z'], 75, 58, 0.5, 10); await gm.wait_for_timeout(1500); await gm.screenshot(path=os.path.join(SHOTS, f'pieces-rail-{name}-table.png'))
    await browser.close(); print('shots written to', SHOTS); return True

if __name__ == '__main__':
    try: ok = asyncio.run(main())
    finally:
        for pr in procs: pr.terminate()
    sys.exit(0 if ok else 1)

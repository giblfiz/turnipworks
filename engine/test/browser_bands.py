#!/usr/bin/env python3
"""The band between storeys (docs/VERTICAL.md "The band between storeys", client/bands.js; Harry 2026-10-24: "for two
story rooms, we need a way to fill in the 1ft floor gaps between story 1 and 2 walls").

  local:  TW_GPU=1 python3 engine/test/browser_bands.py --local
  live:   ... browser_bands.py --page https://dev.turnipworks.net/

A storey is a 9-ft wall and a 1-ft slab. The foot between one storey's wall top and the next one's bottom showed the
slab's plain box edge (stacked rooms) or nothing at all (a tall room: a see-through slot). Now a foot of the wall kit's
own pieces fills it. Checked here:
  BANDS     which rooms get one (upper rooms, a tall room; not a ground room or a flat one), at 9-10 ft, in the very
            materials of the walls above, cut from every outer wall and corner post and from no inner wall
  SOLID     horizontal rays at 9.5 ft at every outer wall of the stacked rooms, the jetty, the setback and the tall room
            meet the band at the wall's face (positive control: with the bands hidden the tall room is see-through)
  SLAB      the drawn slab stops on the grid line, inside the wall, so its flat face cannot show through the band's relief
  PICK      a click on the band selects the wall above it; deleting that wall takes its foot out of the band, undo puts it
            back; the touchable audit passes with every band in view
  CUT       cut to lv 1: the upper rooms' bands go with them; the tall room's stays
  BUILDING  a generated two-storey inn: every upper room has its band and rays round the whole building at 9.5 ft meet it
"""
import argparse, asyncio, json, os, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways
from audit import AUDIT
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
procs = []
def start_local():
    def free():
        with socket.socket() as so: so.bind(('127.0.0.1', 0)); return so.getsockname()[1]
    rp, sp = free(), free()
    data = tempfile.mkdtemp(prefix='tw-bands-'); site = tempfile.mkdtemp(prefix='tw-site-')
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
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", ms, 'spawn animations over')
    await wait(pg, "[...tw.worldOf(tw.area()).shell.values()].every(s => s.settled)", ms, 'shell meshes in'); await pg.wait_for_timeout(400)
async def view(pg, x, y, z, dist, pitch, yaw):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(600)

SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const L = tw.roomgen.solve(v.entities, a, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
# every band now drawn: its key, room, where its geometry lies (world), its parts' keys, its materials vs the room's walls'
BANDS = """(() => { const w = tw.worldOf(tw.area()), out = {};
  for (const s of w.shell.values()) { if (!s.spec.band) continue; s.group.updateMatrixWorld(true);
    let lo = Infinity, hi = -Infinity, tris = 0, meshes = 0; const mats = new Set();
    s.visual.traverse(o => { if (!o.isMesh) return; meshes++; mats.add(o.material.uuid); const p = o.geometry.attributes.position; tris += p.count / 3; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); lo = Math.min(lo, b.min.y); hi = Math.max(hi, b.max.y); });
    const wallMats = new Set(); for (const t of w.shell.values()) if (t.roomId === s.roomId && !t.spec.band && t.spec.layer === 'walls' && t.visual) t.visual.traverse(o => { if (o.isMesh && o.material) wallMats.add(o.material.uuid); });
    out[s.key] = { room: s.roomId, y: s.group.position.y, lo, hi, tris, meshes, keys: s.spec.parts.map(p => p.key), ids: [...new Set(s.spec.parts.map(p => p.id))], ownMats: [...mats].every(m => wallMats.has(m)), visible: s.group.visible && !s.group.userData.cutHidden, standIn: !!s.visual?.userData?.placeholder }; }
  return out; })()"""
# outer wall edges of a room at its height (one side), and their outward direction, from the wall map the game draws
OUTER = """(rid) => { const w = tw.worldOf(tw.area()), out = [];
  for (const e of w.edges.values()) { if (e.owner.room !== rid || (e.sides || []).length !== 1 || e.open) continue; const s = e.sides[0];
    const c = e.dir === 'h' ? [(e.gx + 0.5) * 5, e.gz * 5] : [e.gx * 5, (e.gz + 0.5) * 5];
    const d = e.dir === 'h' ? [0, s.side === 'N' ? -1 : 1] : [s.side === 'W' ? -1 : 1, 0];
    out.push({ key: e.key, c, d, a: e.dir === 'h' ? [1, 0] : [0, 1], y: e.y || 0 }); }
  return out; }"""
# horizontal rays from 6 ft outside each probe point toward it at height y: what does the shell layer meet first?
RAYS = """([pts0, ys, hideBands]) => { const offs = [-1.6, -0.9, -0.3, 0.4, 1.1, 1.7], pts = []; for (const p of pts0) for (const o of offs) for (const y of ys) pts.push({ ...p, c: [p.c[0] + p.a[0] * o, p.c[1] + p.a[1] * o], y }); const w = tw.worldOf(tw.area()), R = new (tw.rayAt(0, 0).constructor)(), V = tw.rayAt(0, 0).ray.origin.constructor;
  const bands = [...w.shell.values()].filter(s => s.spec.band); if (hideBands) for (const s of bands) s.group.visible = false;
  w.layers.shell.updateMatrixWorld(true); const res = [];
  for (const p of pts) { R.set(new V(p.c[0] + p.d[0] * 6, p.y, p.c[1] + p.d[1] * 6), new V(-p.d[0], 0, -p.d[1])); R.far = 12;
    const vis = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    const h = R.intersectObject(w.layers.shell, true).find(h => h.object.isMesh && vis(h.object));
    let o = h && h.object; while (o && !o.userData.shellKey) o = o.parent;
    res.push({ key: p.key, dist: h ? +h.distance.toFixed(2) : null, band: !!(h && h.object.userData.band), what: o ? o.userData.shellKey : null }); }
  if (hideBands) for (const s of bands) s.group.visible = true;
  return res; }"""
# the slab's drawn boxes, as how far past the room's own edges they reach (feet)
SLAB = """(rid) => { const w = tw.worldOf(tw.area()), s = [...w.shell.values()].find(s => s.spec.slab && s.roomId === rid), r = tw.entities()[rid].recipe; if (!s?.visual) return null;
  s.group.updateMatrixWorld(true); let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  s.visual.traverse(o => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); x0 = Math.min(x0, b.min.x); x1 = Math.max(x1, b.max.x); z0 = Math.min(z0, b.min.z); z1 = Math.max(z1, b.max.z); });
  return Math.max(r.x * 5 - x0, x1 - (r.x + r.w) * 5, r.z * 5 - z0, z1 - (r.z + r.d) * 5); }"""

async def main():
    page = (start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500') + '&nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 800}); gm = await ctx.new_page()
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Fauna-test'); await gm.fill('#newCampaign input[name=name]', 'TEST bands ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 60000), 'GM tab live')
        rooms = [
            dict(id='room_bndg00001', building='bld_bndt', buildingName='Timber', type='common', x=0, z=0, w=6, d=4, seed=11, wallFamily='half-timber'),
            dict(id='room_bndua0001', building='bld_bndt', type='guest', x=0, z=0, w=3, d=5, y=10, seed=12, wallFamily='half-timber'),   # jetty: one square out on +z
            dict(id='room_bndub0001', building='bld_bndt', type='guest', x=3, z=0, w=3, d=5, y=10, seed=13, wallFamily='half-timber'),
            dict(id='room_bndg00002', building='bld_bnds', buildingName='Stone', type='common', x=12, z=0, w=5, d=4, seed=14, wallFamily='dressed-stone'),
            dict(id='room_bndu00002', building='bld_bnds', type='guest', x=12, z=0, w=3, d=4, y=10, seed=15, wallFamily='dressed-stone'),  # setback
            dict(id='room_bndc00002', building='bld_bnds', type='cellar', x=12, z=0, w=3, d=3, y=-10, seed=18),  # below the ground
            dict(id='room_bndh00003', building='bld_bndh', buildingName='Hall', type='common', x=24, z=0, w=5, d=4, seed=16, tall=2, wallFamily='rough-timber'),
            dict(id='room_bndf00004', building='bld_bndf', buildingName='Flat', type='storeroom', x=36, z=0, w=3, d=3, seed=17),
        ]
        for a in rooms: await gm.evaluate(SPAWN, a); await gm.wait_for_timeout(200)
        ok = await wait(gm, f"{json.dumps([r['id'] for r in rooms])}.every(id => tw.entities()[id]) && tw.sync.pendingCount() === 0", 30000, 'rooms')
        await view(gm, 90, 0, 15, 140, 50, 0); await settle(gm)
        check(ok and await gm.evaluate("tw.entities()['room_bndh00003'].recipe.tall") == 2, 'stacked rooms (a jetty, two rooms side by side upstairs, a setback), a tall hall and a flat room: all accepted')

        print('BANDS: who gets one, where it lies, what it is cut from')
        B = await gm.evaluate(BANDS)
        want = {'band:room_bndua0001@10', 'band:room_bndub0001@10', 'band:room_bndu00002@10', 'band:room_bndh00003@10', 'band:room_bndc00002@0'}
        check(set(B) == want, 'a band for each upper room, the tall hall and the cellar (the foot above its walls, under the ground), none for a ground room or the flat room', sorted(B))
        top = lambda k: 0 if k.endswith('@0') else 10
        check(all(abs(b['y'] - (top(k) - 1)) < 1e-6 and b['lo'] >= top(k) - 1.01 and b['hi'] <= top(k) + 0.01 and b['hi'] - b['lo'] > 0.9 for k, b in B.items()), 'every band fills the foot under the floor above (9 to 10 ft; the cellar -1 to 0) and nothing else', {k: (round(b['lo'], 3), round(b['hi'], 3)) for k, b in B.items()})
        check(all(b['ownMats'] and b['meshes'] <= 4 and b['tris'] > 50 and not b['standIn'] for b in B.values()), "each is drawn in the very materials of its room's walls, merged into at most 4 meshes", {k: (b['meshes'], b['tris'], b['ownMats']) for k, b in B.items()})
        oa = await gm.evaluate(OUTER, 'room_bndua0001'); ob = await gm.evaluate(OUTER, 'room_bndub0001')
        ka, kb = set(B['band:room_bndua0001@10']['keys']), set(B['band:room_bndub0001@10']['keys'])
        inner = [k for k in ka | kb if k.startswith('v:3:')]
        check({e['key'] for e in oa} <= ka and {e['key'] for e in ob} <= kb and not inner, 'cut from every outer wall of each upper room and from no wall between them (both slabs lie under that one)', f"outer {len(oa)}+{len(ob)}, inner keys in a band: {inner}")
        posts = [k for k in ka if k.startswith('c')]
        check(len(posts) >= 4 and 'post-timber' in B['band:room_bndua0001@10']['ids'], "the corner posts' feet too (a post is wider than the wall)", posts)
        ht = B['band:room_bndh00003@10']
        check(len(ht['keys']) >= 18 and all(k and k.endswith('@10') for k in ht['keys']), "the tall hall's band is cut from each piece it carries up (walls and posts of its second storey)", len(ht['keys']))

        print('SOLID: rays at 9.5 ft meet the band at the wall face')
        probes = {r: await gm.evaluate(OUTER, r) for r in ['room_bndua0001', 'room_bndub0001', 'room_bndu00002']}
        hall = await gm.evaluate(OUTER, 'room_bndh00003')
        allp = [p for v in probes.values() for p in v] + hall
        hits = await gm.evaluate(RAYS, [allp, [9.2, 9.5, 9.8], False])
        wall = await gm.evaluate(RAYS, [allp, [14.2, 14.5, 14.8], False])  # the same rays across the upper wall itself: the meshes' own pinholes
        # (the suite draws the 1,500-face meshes: a slice of one has a few pinholes, as the wall itself does at its own height;
        # the band must be within 4 points of the wall above it. At the game's 10,000 faces every family's slice measured 0.95-1.00.)
        offby = lambda hs: sorted({h['key']: sum(1 for g in hs if g['key'] == h['key'] and not okb(g)) for h in hs if not okb(h)}.items(), key=lambda kv: -kv[1])[:8]
        okb = lambda h: h['band'] and h['dist'] is not None and 5.3 <= h['dist'] < 6
        share = sum(map(okb, hits)) / max(1, len(hits)); wshare = sum(1 for h in wall if h['dist'] is not None and h['dist'] < 6) / max(1, len(wall))
        check(len(hits) >= 600 and share >= min(0.98, wshare) - 0.04, 'every outer wall of the stacked rooms, the jetty, the setback and the tall hall: rays at 9.2/9.5/9.8 ft meet the band at the wall face, as solid as the wall above it', f"{len(hits)} rays, band {share:.3f}, the wall itself {wshare:.3f}, off by piece: {offby(hits)}")
        await gm.evaluate("tw.setLevel(-10); tw.setCut(-1, { by: 'api' })"); await gm.wait_for_timeout(1500)  # down into the cellar: the ground opens over it
        cel = await gm.evaluate(OUTER, 'room_bndc00002'); hc = await gm.evaluate(RAYS, [cel, [-0.8, -0.5, -0.2], False]); hcw = await gm.evaluate(RAYS, [cel, [-5.8, -5.5, -5.2], False])
        await gm.evaluate("tw.setLevel(0); tw.setCut(null, { by: 'api' })"); await gm.wait_for_timeout(800)
        sc, scw = sum(map(okb, hc)) / max(1, len(hc)), sum(1 for h in hcw if h['dist'] is not None and h['dist'] < 6) / max(1, len(hcw))
        check(len(hc) >= 150 and sc >= min(0.98, scw) - 0.04, "the cellar's outside walls: rays at -0.8/-0.5/-0.2 ft meet the band, as solid as the wall under it (it was a slot under the ground's edge)", f"{len(hc)} rays, band {sc:.3f}, wall {scw:.3f}, off by piece: {offby(hc)}")
        hits0 = await gm.evaluate(RAYS, [hall, [9.5], True])
        through = [h for h in hits0 if h['dist'] is None or h['dist'] > 6.5]
        check(len(through) >= len(hits0) // 2, 'positive control: with the bands hidden, the tall hall is see-through at 9.5 ft (the slot Harry saw)', f"{len(through)}/{len(hits0)} rays pass the wall line")
        hits1 = await gm.evaluate(RAYS, [probes['room_bndua0001'], [9.5], True])
        check(all(h['what'] and h['what'].endswith(':slab') for h in hits1 if h['dist'] is not None), 'and over the stacked rooms the old foot was the slab\'s plain edge', [h['what'] for h in hits1[:3]])

        print('SLAB: kept inside the wall')
        sl = await gm.evaluate(SLAB, 'room_bndua0001')
        check(sl is not None and abs(sl) < 0.01, "the drawn slab stops on the room's edge, inside the 12-in wall the band is cut from (it ran to the wall face, 6 in out)", sl)

        print('PICK: the band is the wall above it')
        e0 = next(e for e in oa if e['d'] == [0, 1])  # a jetty face
        await view(gm, e0['c'][0], 9.5, e0['c'][1], 18, 8, 0)
        pt = await gm.evaluate(f"tw.screenOf({e0['c'][0]}, {e0['c'][1] + 0.5}, tw.main, 9.5)")
        sel = await gm.evaluate(f"(() => {{ const h = tw.worldOf(tw.area()).pickAll(tw.rayAt({pt['x']}, {pt['y']})); return h.map(x => tw.selectionFor(x)).filter(Boolean).slice(0, 3); }})()")
        check(sel and sel[0] == 'wall:' + e0['key'], 'a click on the band over the jetty selects the wall above it', f"{sel} want wall:{e0['key']}")
        await gm.evaluate(f"tw.batch([{{ type: 'edge.set', args: {{ key: '{e0['key']}', as: 'open' }} }}])")
        gone = await wait(gm, f"(() => {{ const s = tw.worldOf(tw.area()).shell.get('band:room_bndua0001@10'); return s && !s.spec.parts.some(p => p.key === '{e0['key']}'); }})()", 10000, 'band follows the deleted wall')
        await gm.evaluate("tw.undo()")
        back = await wait(gm, f"(() => {{ const s = tw.worldOf(tw.area()).shell.get('band:room_bndua0001@10'); return s && s.spec.parts.some(p => p.key === '{e0['key']}'); }})()", 10000, 'band back on undo')
        check(gone and back, 'deleting that wall takes its foot out of the band; undo puts it back')
        await settle(gm)
        for name, (x, z, d, pi, ya) in {'the stacked rooms from the jetty side': (15, 25, 45, 25, 0), 'the tall hall': (132, 10, 40, 30, 20), 'all of them': (90, 10, 120, 45, 0)}.items():
            await view(gm, x, 5, z, d, pi, ya); await gm.wait_for_timeout(800)
            au = await gm.evaluate(AUDIT)
            check(au['nbad'] == 0 and au['tested'] > 50, f'everything on screen is touchable, bands included ({name})', {k: au[k] for k in ('tested', 'pieces', 'nbad', 'bad', 'kinds')})

        print('CUT')
        await gm.evaluate("tw.setLevel(0); tw.setCut(9, { by: 'api' })"); await gm.wait_for_timeout(1500)
        B2 = await gm.evaluate(BANDS)
        check(not B2['band:room_bndua0001@10']['visible'] and not B2['band:room_bndu00002@10']['visible'] and B2['band:room_bndh00003@10']['visible'], "cut to lv 1: the upper rooms' bands go with them; the tall hall (one room from the ground) keeps its", {k: v['visible'] for k, v in B2.items()})
        await gm.evaluate("tw.setCut(null, { by: 'api' })"); await gm.wait_for_timeout(800)

        print('BUILDING: the generator')
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(40, 0, 90); g.update(); })()")
        bid = await gm.evaluate("tw.buildAt(tw.buildingNode('inn'), 10, 8, { seed: 7, storeys: 2 })")
        await wait(gm, "tw.lastBuilding && tw.sync.pendingCount() === 0", 30000, 'inn built'); await gm.wait_for_timeout(1500); await settle(gm, 120000)
        await gm.evaluate("tw.setLevel(0); tw.setCut(null, { by: 'api' })"); await gm.wait_for_timeout(1000)
        ups = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room' && e.building === tw.lastBuilding && (e.recipe.y || 0) > 0).map(e => e.id)")
        B3 = await gm.evaluate(BANDS)
        outer = {r: await gm.evaluate(OUTER, r) for r in ups}
        withOuter = [r for r in ups if outer[r]]
        check(len(ups) >= 2 and all(f'band:{r}@10' in B3 for r in withOuter), 'a generated two-storey inn: every upper room with an outside wall has its band', f"{len(withOuter)}/{len(ups)} rooms")
        pts = [p for r in withOuter for p in outer[r]]
        hb = await gm.evaluate(RAYS, [pts, [9.2, 9.5, 9.8], False]); hw = await gm.evaluate(RAYS, [pts, [14.2, 14.5, 14.8], False])
        sb = sum(map(okb, hb)) / max(1, len(hb)); sw = sum(1 for h in hw if h['dist'] is not None and h['dist'] < 6) / max(1, len(hw))
        check(len(hb) >= 300 and sb >= min(0.98, sw) - 0.04, 'rays round the whole inn at 9.2/9.5/9.8 ft meet the band at the wall face, as solid as the wall above', f"{len(hb)} rays, band {sb:.3f}, wall {sw:.3f}, off by piece: {offby(hb)}")
        check(not errors, 'no page errors', errors[:3])
        await browser.close()
    for pr in procs: pr.terminate()
    n = sum(1 for r in results if r[0]); print(f'bands: {n}/{len(results)} passed')
    sys.exit(0 if n == len(results) else 1)

asyncio.run(main())

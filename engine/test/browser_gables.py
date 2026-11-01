#!/usr/bin/env python3
"""Temple roofs and gable ends (2026-10-27; docs/VERTICAL.md "Gable ends", "The marble roof"). GM tab.

  local:  TW_GPU=1 python3 engine/test/browser_gables.py --local
  shots:  ... --local --shots     (engine/test/shots/gables-<house>.png: each gable end-on at table distance, for a Gemini read)
  dev:    ... --page https://dev.turnipworks.net/

Three buildings: a half-timbered shop, a stone hall and a temple nave.
  MARBLE    the temple's roof is marble by default (auto), at a temple's low pitch (22 deg); its sections and painted picture load;
            the ring's Style list and the building's Roof style list offer Marble with a swatch; the cathedral keeps slate
  WALLS     every gable wears its own wall family's baked look (data/gables.json), not the plain colour, and stands flush
            with the wall's outer face; its sloped edges lie ON the roof (no gap, nothing floating)
  TRIM      a bargeboard / coping / raking cornice along both verges of every free gable, standing above the roof plane;
            a pediment has its level cornice too
  OPENINGS  a window / vent / oculus in a gable with room for one, a tympanum in a pediment: in the roof's trim list with a
            stable key (gable:<part>:<end>:<kind>), drawn from the kit (not a stand-in), on the gable's face
  TOUCH     picked and selected as trim ('trim:<room>|<key>'), slid along its gable (never out of the triangle), Delete, undo
  REROLL    a re-roll changes the openings, the same seed gives them back
"""
import argparse, asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18291,18816').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-gables-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def view(pg, x, z, dist=110, pitch=58, yaw=0, y=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(250)
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over')
    await pg.wait_for_timeout(300)

SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
# per roof: style, pitch, family, every gable end (its triangle, face, trim), the meshes drawn ('gable' / 'verge': which picture), the gable pieces
REPORT = """(() => { const w = tw.worldOf(tw.area()), out = {};
  for (const rec of w.roofRecs.values()) { const r = rec.roof, parts = {};
    for (const m of rec.group.children) if (m.isMesh && ['gable', 'verge'].includes(m.userData.roofPart)) (parts[m.userData.roofPart] ||= []).push(m.userData.pic || null);
    out[r.room] = { style: r.style, family: r.family, kind: r.kind, pitch: Math.max(0, ...r.planes.map(p => p.pitch)), ridgeY: r.ridgeY, top: r.top,
      ends: r.gableEnds.map(G => ({ trim: G.trim, free: G.free, face: G.face, at: G.at, out: G.out, axis: G.axis, lo: G.lo, hi: G.hi, mid: G.mid, base: G.base, apex: G.apex, span: G.span, rise: G.rise, verges: G.verges })),
      parts, pieces: r.props.filter(p => p.role.startsWith('gable-') || p.role === 'pediment'), shown: rec.group.visible }; }
  return out; })()"""
HOUSES = (('shop', dict(type='mkt-general', x=0, z=0, w=4, d=6, seed=7301), 'half-timber'),
          ('hall', dict(type='great-hall', x=12, z=0, w=4, d=6, seed=7302), 'dressed-stone'),
          ('temple', dict(type='temple-nave', x=24, z=0, w=5, d=8, seed=7303), 'temple-stone'))

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1600, 'height': 1000}, reduced_motion='reduce')
        gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST gables {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        R = {}
        for name, a, _ in HOUSES:
            rid = f"room_gb{name}{random.randrange(10**6):06d}"[:24]
            R[name] = await gm.evaluate(SPAWN, {'id': rid, **a})
            check(await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, name), f'{name} built ({a["type"]})')
        await settle(gm)
        # (2026-10-27: a castle's rooms are flat and battlemented by default; the hall is here for a stone house's gables, so it is slated by hand)
        await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{R['hall']}', roof: {{ style: 'slate' }} }})"); await wait(gm, 'tw.sync.pendingCount() === 0', 8000)
        await gm.evaluate("tw.setRoofs(true, 'test'); tw.cutOff('test')")
        ok = await wait(gm, "(() => { const w = tw.worldOf(tw.area()); return w.roofRecs?.size >= 3 && [...w.roofRecs.values()].every(r => r.group.children.some(m => m.userData.roofPart === 'gable' && !String(m.userData.pic).startsWith('plain:'))); })()", 30000, 'gable pictures in')
        check(ok, 'roofs on: every gable has its wall picture (the gable kit loaded)')
        await gm.wait_for_timeout(800)
        rep = await gm.evaluate(REPORT)
        if A.shots: return await shots(gm, R, rep, browser)

        # ================= MARBLE =================
        print('MARBLE: the temple roof')
        t, s, h = rep[R['temple']], rep[R['shop']], rep[R['hall']]
        check(t['style'] == 'marble' and t['family'] == 'temple-stone', "a temple nave's roof is marble by default (its building's roof is 'auto')", (t['style'], t['family']))
        check(abs(t['pitch'] - 22) < 0.01 and abs(s['pitch'] - 45) < 0.01, 'marble carries its own low pitch (22 deg); the shop keeps 45', (t['pitch'], s['pitch']))
        check(abs((t['ridgeY'] - t['top']) - 12.5 * 0.40403) < 0.01, 'the temple\'s ridge stands at half its 25-ft span x tan 22', round(t['ridgeY'] - t['top'], 3))
        tiers = await gm.evaluate(f"tw.worldOf(tw.area()).roofRecs.get('{R['temple']}').group.userData.roofTiers")
        check(tiers and tiers['count'] > 0, 'the marble roof is laid in modelled roof sections', tiers and tiers['count'])
        kits = await gm.evaluate("tw.worldOf(tw.area()).roofSectionReport().kits")
        check('marble' in kits, 'the marble section is loaded beside the other four', kits)
        sw = await gm.evaluate("fetch(new URL('data/roof/roofing-marble.webp', document.baseURI)).then(r => r.status)")
        check(sw == 200, 'the marble swatch / painted picture is served', sw)
        b_t = await gm.evaluate(f"tw.entities()['{R['temple']}'].building")
        await gm.evaluate(f"tw.select('{b_t}')"); await gm.wait_for_timeout(300)
        has = await gm.evaluate("tw.registry.available().map(c => c.id).filter(x => x.startsWith('building.roof.'))")
        check('building.roof.slate' in has and 'building.roof.auto' not in has, "the temple building ('auto': marble by its walls) offers the other styles", has)
        await gm.evaluate(f"tw.select('{R['shop']}')"); await gm.wait_for_timeout(200)
        b_s = await gm.evaluate(f"tw.entities()['{R['shop']}'].building"); await gm.evaluate(f"tw.select('{b_s}')"); await gm.wait_for_timeout(300)
        has = await gm.evaluate("tw.registry.available().map(c => c.id).filter(x => x.startsWith('building.roof.'))")
        check('building.roof.marble' in has, "a building's Roof style list offers Marble", has)
        await gm.evaluate(f"tw.select('roof:{R['shop']}')"); await gm.wait_for_timeout(300)
        bar = await gm.evaluate("tw.registry.available().filter(c => c.id.startsWith('roof.style.')).map(c => [c.id, typeof c.pic === 'function' ? c.pic() : null])")
        mb = [b for b in bar if b[0] == 'roof.style.marble']
        check(mb and mb[0][1] and mb[0][1].split('?')[0].endswith('roof/roofing-marble.webp'), "a roof's Style list (ring and command bar) offers Marble, with its swatch", bar)
        await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{R['shop']}', roof: {{ style: 'marble' }} }})"); await gm.wait_for_timeout(1200)
        r2 = await gm.evaluate(REPORT)
        check(r2[R['shop']]['style'] == 'marble' and abs(r2[R['shop']]['pitch'] - 22) < 0.01 and r2[R['shop']]['ends'][0]['trim'] == 'cornice', 'room.set roof style marble: the shop turns marble, low, with pediments', (r2[R['shop']]['style'], r2[R['shop']]['pitch']))
        await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{R['shop']}', roof: {{ style: 'auto' }} }})"); await gm.wait_for_timeout(1200)
        await gm.evaluate("tw.worldOf(tw.area()).setRoofSurface('painted')"); await gm.wait_for_timeout(1500)
        pm = await gm.evaluate(f"(() => {{ const rec = tw.worldOf(tw.area()).roofRecs.get('{R['temple']}'), m = rec.group.children.find(m => m.userData.roofPart === 'surface'); return !!(m && m.material.map && m.material.visible !== false); }})()")
        check(pm, "the 'painted' switch draws the marble roof in its painted picture")
        await gm.evaluate("tw.worldOf(tw.area()).setRoofSurface('sections')"); await gm.wait_for_timeout(1500)

        # ================= WALLS =================
        print('WALLS: the gable wears its wall family, flush, under the roof')
        rep = await gm.evaluate(REPORT)
        for name, _, fam in HOUSES:
            r = rep[R[name]]
            pics = r['parts'].get('gable', [])
            check(pics and all(p == f"roof/gable-wall--{r['family']}.webp" for p in pics), f"{name}: the gable wears its own wall family's look ({r['family']})", pics)
            fr = [e for e in r['ends'] if e['free']]
            check(len(fr) == 2 and all(abs(e['face'] - 0.5) < 1e-9 for e in fr), f'{name}: two free gable ends, each flush with the wall\'s outer face (0.5 ft off the wall line)', [(e['at'], e['face']) for e in r['ends']])
        # the sloped edges of each gable face lie on the roof: sample along them against the planned roof height
        gap = await gm.evaluate("""(() => { const w = tw.worldOf(tw.area()); let worst = 0, n = 0;
          for (const rec of w.roofRecs.values()) for (const G of rec.roof.gableEnds) { if (!G.free) continue;
            for (const side of [-1, 1]) for (let k = 1; k < 20; k++) { const t = k / 20, across = side < 0 ? G.lo + (G.mid - G.lo) * t : G.hi + (G.mid - G.hi) * t, y = G.base + G.rise * t;
              const [x, z] = G.axis === 'x' ? [G.at, across] : [across, G.at], roof = w.roofPlan.heightAt(x, z); // (the roof's planes do not change along the ridge: the face, 0.5 ft out, meets the same height)
              if (roof == null) { worst = Infinity; continue; } worst = Math.max(worst, Math.abs(roof - y)); n++; } }
          return { worst, n }; })()""")
        check(gap['n'] > 100 and gap['worst'] < 1e-3, 'every gable\'s sloped edge lies on the roof\'s underside (no gap, nothing floating)', gap)

        # ================= TRIM =================
        print('TRIM: verges and cornices')
        want = {'shop': 'board', 'hall': 'coping', 'temple': 'cornice'}
        for name, _, _ in HOUSES:
            r = rep[R[name]]; fr = [e for e in r['ends'] if e['free']]
            check(all(e['trim'] == want[name] and len(e['verges']) == 2 for e in fr), f"{name}: a {want[name]} along both verges of each gable", [(e['trim'], len(e['verges'])) for e in fr])
            vp = r['parts'].get('verge', [])
            check(vp and not any(str(p).startswith('plain:') for p in vp if want[name] != 'cornice') and (want[name] != 'cornice' or 'roof/cornice-marble.webp' in vp), f"{name}: the trim wears the kit's {('wood', 'stone', 'cornice strip')[list(want).index(name)]}", sorted(set(map(str, vp))))
        above = await gm.evaluate("""(() => { const w = tw.worldOf(tw.area()); let worst = Infinity;
          for (const rec of w.roofRecs.values()) for (const m of rec.group.children) { if (m.userData.roofPart !== 'verge') continue; m.geometry.computeBoundingBox(); }
          for (const rec of w.roofRecs.values()) for (const G of rec.roof.gableEnds) for (const v of G.verges) { const mx = (v.a[0] + v.b[0]) / 2, mz = (v.a[2] + v.b[2]) / 2, my = (v.a[1] + v.b[1]) / 2;
            const back = G.axis === 'x' ? [G.at, mz] : [mx, G.at], h = w.roofPlan.heightAt(back[0], back[1]); if (h != null) worst = Math.min(worst, Math.abs(my - h)); }
          return worst; })()""")
        check(abs(above) < 1e-6, 'a verge runs along the roof\'s own edge (its line is the roof plane carried out to the verge)', above)
        lvl = await gm.evaluate(f"""(() => {{ const rec = tw.worldOf(tw.area()).roofRecs.get('{R['temple']}'); let low = Infinity; for (const m of rec.group.children) if (m.userData.roofPart === 'verge') {{ m.geometry.computeBoundingBox(); low = Math.min(low, m.geometry.boundingBox.min.y); }} return [low, rec.roof.top]; }})()""")
        check(lvl[0] < lvl[1] - 1, "the temple's pediment has its level cornice along its foot (below the wall's head)", lvl)

        # ================= OPENINGS =================
        print('OPENINGS: windows, vents, oculi, tympana')
        kits = await gm.evaluate("tw.worldOf(tw.area()).kitReport().filter(k => k.kind === 'roof' && (k.role.startsWith('gable-') || k.role === 'pediment'))")
        by = {}
        for k in kits: by.setdefault(k['room'], []).append(k)
        allowed = {'shop': ('gable-window', 'gable-vent'), 'hall': ('gable-oculus', 'gable-vent'), 'temple': ('pediment',)}
        for name, _, _ in HOUSES:
            ks = by.get(R[name], [])
            check(len(ks) == 2 and all(k['role'] in allowed[name] and k['loaded'] and not k['standIn'] for k in ks), f"{name}: one {'/'.join(allowed[name])} in each gable, drawn from the kit", [(k['role'], k['loaded'], k['sku']) for k in ks])
            pcs = rep[R[name]]['pieces']
            keys = [p['key'] for p in pcs]
            check(len(set(keys)) == len(keys) == 2 and all(k.startswith('gable:') and k.split(':')[-1] == p['kind'] for k, p in zip(keys, pcs)), f'{name}: each piece is in the roof\'s trim list with a stable key (gable : part : end : kind)', keys)
        # on the face: the piece's centre lies on its gable's outer face, inside the triangle
        onface = await gm.evaluate("""(() => { const w = tw.worldOf(tw.area()), bad = [];
          for (const rec of w.roofRecs.values()) for (const p of rec.roof.props) { if (!(p.role.startsWith('gable-') || p.role === 'pediment')) continue;
            const faceOf = (G) => G.at + (G.out[0] || G.out[1]) * G.face, G = rec.roof.gableEnds.find(G => G.free && Math.abs((G.axis === 'x' ? p.x : p.z) - faceOf(G)) < 1e-6); if (!G) { bad.push(p.key + ' on no gable face'); continue; }
            if (p.role !== 'pediment') { const top = p.y + p.dims[1] / 2, wAt = G.span * (1 - (top - G.base) / G.rise); if (wAt < p.dims[0] || p.y - p.dims[1] / 2 < G.base) bad.push(p.key + ' outside the triangle'); } }
          return bad; })()""")
        check(not onface, 'every opening stands on its gable\'s face, inside the triangle', onface)

        # ================= TOUCH =================
        print('TOUCH: a gable piece is trim like a chimney: picked, selected, slid along its gable, deleted, undone')
        sp = rep[R['shop']]['pieces'][0]; tid = f"trim:{R['shop']}|{sp['key']}"
        G = next(e for e in rep[R['shop']]['ends'] if e['free'] and abs((sp['x'] if e['axis'] == 'x' else sp['z']) - (e['at'] + (e['out'][0] or e['out'][1]) * e['face'])) < 1e-6)
        yaw = {(1, 0): 90, (-1, 0): -90, (0, 1): 0, (0, -1): 180}[tuple(G['out'])]
        await view(gm, sp['x'], sp['z'], 45, 25, yaw, sp['y'])
        pt = await gm.evaluate("(([x, y, z]) => { const s = tw.screenOf(x, z, tw.main, y); return { x: s.x, y: s.y }; })", [sp['x'], sp['y'], sp['z']])
        got = await gm.evaluate("(([x, y]) => { const h = tw.worldOf(tw.area()).pickAll(tw.rayAt(x, y))[0]; return h ? tw.selectionFor(h) : null; })", [pt['x'], pt['y']])
        check(got == tid, 'the pointer over a gable window / vent meets it, not the roof', got)
        await gm.mouse.click(pt['x'], pt['y']); await gm.wait_for_timeout(500)
        check(await gm.evaluate("[...tw.sel]") == [tid], 'a click selects it', await gm.evaluate("[...tw.sel]"))
        rel = sp['slide']['range'][1] - await gm.evaluate(f"tw.entities()['{R['shop']}'].recipe.{'z' if G['axis'] == 'x' else 'x'} * 5")
        at = [sp['x'] - await gm.evaluate(f"tw.entities()['{R['shop']}'].recipe.x * 5") if G['axis'] == 'x' else rel, rel if G['axis'] == 'x' else sp['z'] - await gm.evaluate(f"tw.entities()['{R['shop']}'].recipe.z * 5")]
        await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{R['shop']}', roof: {{ trim: {{ '{sp['key']}': {{ at: [{at[0] + (0 if G['axis'] == 'x' else 3)}, {at[1] + (3 if G['axis'] == 'x' else 0)}] }} }} }} }})"); await gm.wait_for_timeout(900)
        mv = next((p for p in (await gm.evaluate(REPORT))[R['shop']]['pieces'] if p['key'] == sp['key']), None)
        check(mv and mv.get('moved') and abs((mv['z'] if G['axis'] == 'x' else mv['x']) - sp['slide']['range'][1]) < 0.01 and abs(mv['y'] - sp['y']) < 1e-6, 'moved past its gable\'s edge: it stops at the edge of the room it has, at its own height, on the face', mv and [mv['x'], mv['y'], mv['z']])
        await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(700)
        await gm.evaluate(f"tw.select('{tid}')"); await gm.wait_for_timeout(300); await gm.mouse.move(700, 450); await gm.keyboard.press('Delete'); await gm.wait_for_timeout(900)
        left = [p['key'] for p in (await gm.evaluate(REPORT))[R['shop']]['pieces']]
        check(await gm.evaluate(f"tw.entities()['{R['shop']}'].roof?.trim?.['{sp['key']}']?.gone") is True and sp['key'] not in left and len(left) == 1, 'Delete: that one is gone (room.roof.trim), the other gable keeps its own', left)
        await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(900)
        check(len((await gm.evaluate(REPORT))[R['shop']]['pieces']) == 2, 'one undo brings it back')
        await gm.evaluate("tw.select([])")

        # ================= REROLL =================
        print('REROLL: the seed picks them')
        before = [(p['key'], p['y']) for p in rep[R['shop']]['pieces']]
        changed = False
        for sd in (11, 12, 13, 14, 15, 16):
            await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{R['shop']}', roof: {{ seed: {sd} }} }})"); await gm.wait_for_timeout(700)
            now = [(p['key'], p['y']) for p in (await gm.evaluate(REPORT))[R['shop']]['pieces']]
            if now != before: changed = True; seen = (sd, now); break
        check(changed, 're-roll changes the gable openings (kind or height)', seen if changed else before)
        if changed:
            await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{R['shop']}', roof: {{ seed: 1 }} }})"); await gm.wait_for_timeout(700)
            await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{R['shop']}', roof: {{ seed: {seen[0]} }} }})"); await gm.wait_for_timeout(700)
            again = [(p['key'], p['y']) for p in (await gm.evaluate(REPORT))[R['shop']]['pieces']]
            check(again == seen[1], 'the same seed gives the same openings', again)

        # ================= CATHEDRAL =================
        cid = f"room_gbcath{random.randrange(10**6):06d}"[:24]
        await gm.evaluate(SPAWN, {'id': cid, 'type': 'cathedral', 'x': 0, 'z': 20, 'w': 6, 'd': 10, 'seed': 7304})
        await wait(gm, f"tw.entities()['{cid}'] && tw.sync.pendingCount() === 0", 30000, 'cathedral'); await settle(gm); await gm.wait_for_timeout(800)
        c = (await gm.evaluate(REPORT)).get(cid, {})
        check(c.get('style') == 'slate', 'a cathedral (temple walls) keeps its steep slate roof', c.get('style'))
        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'gables: {passed}/{len(results)} passed')
    return passed == len(results)

async def shots(gm, R, rep, browser):
    """each house's gable end-on at table distance (a background piece at play distance), for a Gemini read"""
    await gm.evaluate("document.body.classList.add('shot')")
    for name, _, _ in HOUSES:
        r = rep[R[name]]; G = [e for e in r['ends'] if e['free']][0]
        d = G['at'] + (G['out'][0] or G['out'][1]) * 2; x, z = (d, G['mid']) if G['axis'] == 'x' else (G['mid'], d)
        # yaw: look AT the gable from outside it (the camera sits on the out side)
        yaw = {(1, 0): 90, (-1, 0): -90, (0, 1): 0, (0, -1): 180}[tuple(G['out'])]
        await view(gm, x, z, 70, 32, yaw, G['base'])
        await gm.wait_for_timeout(2500)
        await gm.screenshot(path=os.path.join(SHOTS, f'gables-{name}.png'))
        print('  shot', name, r['style'], r['family'], [(p['role'], p['key']) for p in r['pieces']], flush=True)
        if name in ('temple', 'shop'):  # and a closer look at one eave corner of the gable, three-quarter on
            cx, cz = (d, G['lo']) if G['axis'] == 'x' else (G['lo'], d)
            await view(gm, cx, cz, 26, 30, yaw + 40, G['base']); await gm.wait_for_timeout(2500)
            await gm.screenshot(path=os.path.join(SHOTS, f'gables-{name}-corner.png'))
    await browser.close(); return True

try: ok = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
sys.exit(0 if ok else 1)

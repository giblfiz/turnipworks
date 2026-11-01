#!/usr/bin/env python3
"""Flat roofs, castle edges and roof objects (2026-10-27; docs/VERTICAL.md "Flat roofs", "Roof objects").

  local:  TW_PORTS=a,b python3 engine/test/browser_roofflat.py --local
  dev:    ... browser_roofflat.py --page https://dev.turnipworks.net/
  --shots DIR   table-distance pictures for the Gemini reads (a castle with battlements and turrets; each flat surface)

  SURFACES  the five flat surfaces are roof styles (ring list, building list, bar); each makes the roof flat and wears
            its own generated texture; a saved map's 'flat' is the plank deck
  DEFAULTS  a castle is flagstoned, battlemented, with corner turrets; a cottage stays thatched; the building's and the
            room's own choices still win
  EDGES     Battlements on / off (ring button, bar words), the Edge list (battlements, parapet, railing, none, by the
            building), Corner turrets on / off; a building selected sets all its roofs; the real kit pieces are drawn
  DICE      a die thrown on a flat roof lands on it; the battlements and turrets stop it; they are never sight edges
  OBJECTS   the bar finds the roof objects (turret, water tank, flagpole, hatch, chimney); put down where a roof is
            showing they stand on its surface, and are ordinary things (selected, deleted)
"""
import argparse, asyncio, json, os, socket, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tests')); import tw_sandbox  # noqa: E402  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results, procs, tmp = [], [], []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:400] if detail != '' else ''}", flush=True)
def free():
    with socket.socket() as so: so.bind(('127.0.0.1', 0)); return so.getsockname()[1]
def start():
    ports = os.environ.get('TW_PORTS'); rp, sp = (int(v) for v in ports.split(',')) if ports else (free(), free())
    data = tempfile.mkdtemp(prefix='tw-rflat-'); site = tempfile.mkdtemp(prefix='tw-rflat-site-'); tmp.extend([data, site])
    os.symlink(ROOT / 'engine', site + '/engine'); os.symlink(ROOT / 'tools/spawn-tuner', site + '/tuner')
    log = open(data + '/relay.log', 'w')
    procs.append(subprocess.Popen(['node', str(ROOT / 'engine/relay/server.js')], env={**os.environ, 'PORT': str(rp), 'DATA_DIR': data, 'ORIENT_API': '', 'TUNER_DIR': str(ROOT / 'tools/spawn-tuner/js'), 'TUNER_DATA': str(ROOT / 'tools/spawn-tuner/data')}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(sp), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        try: urllib.request.urlopen(f'http://127.0.0.1:{rp}/health'); urllib.request.urlopen(f'http://127.0.0.1:{sp}/engine/client/index.html'); break
        except Exception: time.sleep(.1)
    return f'http://127.0.0.1:{sp}/engine/client/index.html?relay=http://127.0.0.1:{rp}&api='
async def wait(pg, js, timeout=30000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def idle(pg): await wait(pg, 'tw.sync.pendingCount() === 0')
async def settle(pg, ms=120000): await wait(pg, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', ms, 'spawn over'); await pg.wait_for_timeout(300)
async def look(pg, x, z, dist=60, pitch=58, yaw=0):
    await pg.evaluate('([x,z,d,p,y])=>{const g=tw.main.grab;g.focus.set(x,0,z);g.dist=d;g.pitch=p;g.yaw=y;g.update();tw.main.rule="free"}', [x, z, dist, pitch, yaw]); await pg.wait_for_timeout(500)
async def snap(pg, name):
    if not A.shots: return
    Path(A.shots).mkdir(parents=True, exist_ok=True); await pg.screenshot(path=str(Path(A.shots) / (name + '.png'))); print('    shot', name)

ROOFS = "(() => Object.fromEntries(tw.worldOf(tw.area()).roofReport().map(r => [r.room, r])))()"
# a roof's flat surface: which picture it wears (the file name), and its slab colour
FLATMAT = """(id) => { const rec = tw.worldOf(tw.area()).roofRecs.get(id); if (!rec) return null; const m = rec.group.children.find(c => c.userData.roofPart === 'flat');
  const img = m?.material?.map?.image; return { has: !!m, src: (img && (img.currentSrc || img.src)) || (m?.material?.map ? 'decoded' : null), mapped: !!m?.material?.map, edge: rec.roof.edge, turrets: !!rec.roof.turrets, flatStyle: rec.roof.flatStyle }; }"""
TEXOF = "(s) => { const t = tw.worldOf(tw.area()).roofTexFor?.(s); return t ? { src: t.image?.currentSrc || t.image?.src || null, w: t.image?.width || 0 } : null; }"
ROLES = "(id) => { const r = tw.worldOf(tw.area()).roofReport().find(x => x.room === id); if (!r) return null; const n = {}; for (const p of r.props) n[p.role] = (n[p.role] || 0) + 1; return n; }"
KIT = "(id) => tw.worldOf(tw.area()).kitReport().filter(k => k.kind === 'roof' && k.room === id).map(k => [k.role, k.sku, k.loaded, k.standIn])"
RUN = "([id, sel]) => { if (sel) tw.select(sel); return tw.registry.run(id); }"
AVAIL = "(sel) => { tw.select(sel); return tw.registry.available().map(c => c.id).filter(id => id.startsWith('roof.')); }"

async def main():
    base = start() if A.local else A.page
    url = base + ('&' if '?' in base else '?') + 'nointro&nopost' + ('' if A.shots else '&faces=1500')
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        ctx = await b.new_context(viewport={'width': 1600, 'height': 1000}, reduced_motion='reduce'); pg = await ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
        await pg.goto(url); await pg.fill('#newCampaign input[name=name]', 'TEST roof flat ' + time.strftime('%H:%M:%S') + ' (throwaway)'); await pg.fill('#newCampaign input[name=gm]', 'Fauna'); await pg.click('#newCampaign button')
        check(await wait(pg, 'window.tw?.ready?.()', 90000), 'GM tab live')

        # the scene: a castle (the building tool, one storey), a farm cottage, an inn's common room, a plain room for the surfaces
        castle = await pg.evaluate("(() => { const id = tw.buildAt(tw.buildingNode('castle'), 14, 10, { seed: 31, storeys: 1 }); return id || tw.lastBuilding; })()")
        await settle(pg)
        cot = await pg.evaluate("tw.spawnRoom('hut-cottage', 30, 0, 4, 3, 4201)"); com = await pg.evaluate("tw.spawnRoom('common', 30, 6, 4, 3, 4202)")
        await settle(pg)
        E = await pg.evaluate("tw.entities()")
        keep = [e for e in E.values() if e.get('kind') == 'room' and e.get('building') == castle and (e['recipe'].get('y') or 0) >= 0 and e['recipe']['type'] != 'courtyard']
        check(castle and len(keep) >= 3, 'a castle was built (its rooms above ground)', [(e['recipe']['type'], e['recipe'].get('y', 0)) for e in keep])
        await pg.evaluate("tw.setRoofs(true, 'test'); tw.cutOff?.('test')"); await pg.wait_for_timeout(2500)
        R = await pg.evaluate(ROOFS)

        # ================= DEFAULTS =================
        print('DEFAULTS: a castle is flat, battlemented and turreted; a cottage stays thatched')
        kr = [R[e['id']] for e in keep if e['id'] in R]
        check(kr and all(r['style'] == 'flagstone' and r['kind'] == 'flat' for r in kr), "every roof of the castle is a flagstone flat roof (auto: by its first room's type)", [(r['room'][-6:], r['style'], r['kind']) for r in kr])
        roles = {}
        for r in kr:
            for q in r['props']: roles[q['role']] = roles.get(q['role'], 0) + 1
        check(roles.get('battlement', 0) >= 8 and roles.get('turret', 0) >= 2 and not roles.get('parapet'), 'its edges are battlements, with corner turrets', roles)
        check(R.get(cot, {}).get('style') == 'thatch' and R[cot]['kind'] in ('gable', 'hip'), 'a farm cottage stays thatched and pitched', R.get(cot, {}).get('style'))
        await pg.wait_for_timeout(2500)
        big = max(kr, key=lambda r: len(r['props']))['room']
        kit = await pg.evaluate(KIT, big)
        loaded = [k for k in kit if k[0] in ('battlement', 'merlon', 'turret')]
        check(loaded and all(k[2] for k in loaded) and any(k[1] and k[1].startswith('wall-crenellated') for k in loaded), 'the battlements are the kit\'s own crenellated wall pieces, loaded and fitted', loaded[:6])
        tur = [k for k in kit if k[0] == 'turret']
        check(tur and all(k[1] and k[1].startswith('roof-bartizan') and not k[3] for k in tur), 'the corner turrets are the generated bartizan (not a stand-in)', tur[:4])
        meas = await pg.evaluate(f"tw.worldOf(tw.area()).kitReport().filter(k => k.kind === 'roof' && k.room === '{big}' && k.role === 'battlement' && k.min).map(k => [k.min[1], k.max[1]])")
        top = R[big]['base']
        check(meas and all(abs(m[0] - top) < 0.4 and 3.5 < m[1] - m[0] < 7 for m in meas), f'they stand on the roof (from {top} ft) and are a man high', meas[:3])
        c = await pg.evaluate(f"(() => {{ const r = tw.worldOf(tw.area()).roofRecs.get('{big}').box; return [(r.min.x + r.max.x) / 2, (r.min.z + r.max.z) / 2]; }})()"); await look(pg, c[0], c[1], 120, 50); await snap(pg, 'castle-battlements')

        # ================= SURFACES =================
        print('SURFACES: five flat surfaces as roof styles')
        sel = f'roof:{com}'
        av = await pg.evaluate(AVAIL, sel)
        check(all(f'roof.style.{s}' in av for s in ('deck', 'flagstone', 'lead', 'turf', 'plaster')) and 'roof.style.flat' not in av, "a roof's Style list offers the five flat surfaces (and the four pitched styles)", av)
        for s in ('deck', 'flagstone', 'lead', 'turf', 'plaster'):
            await pg.evaluate(RUN, [f'roof.style.{s}', sel]); await idle(pg); await pg.wait_for_timeout(900)
            r = (await pg.evaluate(ROOFS)).get(com, {}); fm = await pg.evaluate(FLATMAT, com)
            await wait(pg, f"(() => {{ const rec = tw.worldOf(tw.area()).roofRecs.get('{com}'); const m = rec && rec.group.children.find(c => c.userData.roofPart === 'flat'); return !!(m && m.material.map && m.material.map.image && (m.material.map.image.width || m.material.map.image.naturalWidth)); }})()", 8000, f'{s} texture')
            src = await pg.evaluate(f"(() => {{ const rec = tw.worldOf(tw.area()).roofRecs.get('{com}'); const m = rec.group.children.find(c => c.userData.roofPart === 'flat'); return m && m.material.map ? m.material.map.userData.url || null : null; }})()")
            check(r.get('style') == s and r.get('kind') == 'flat' and fm and fm['mapped'] and fm['flatStyle'] == s and src and f'roof-flat--{s}' in src, f'{s}: the roof is flat and wears its own texture', (r.get('style'), r.get('kind'), fm, src))
            e = {'deck': 'railing', 'flagstone': 'parapet', 'lead': 'parapet', 'turf': 'parapet', 'plaster': 'parapet'}[s]
            check(fm and fm['edge'] == e, f'{s}: its edge by default is {e}', fm and fm['edge'])
            if A.shots: c = await pg.evaluate(f"(() => {{ const r = tw.entities()['{com}'].recipe; return [(r.x + r.w / 2) * 5, (r.z + r.d / 2) * 5]; }})()"); await pg.evaluate('tw.clearSelection()'); await look(pg, c[0], c[1], 75, 50); await pg.wait_for_timeout(1500); await snap(pg, f'flat-{s}')
        # a saved map's 'flat' is the deck (journals replay)
        await pg.evaluate(f"tw.dispatch('room.set', {{ id: '{com}', roof: {{ style: 'flat' }} }})"); await idle(pg); await pg.wait_for_timeout(600)
        r = (await pg.evaluate(ROOFS)).get(com, {})
        check(r.get('style') == 'deck' and r.get('kind') == 'flat' and await pg.evaluate(f"tw.entities()['{com}'].roof.style") == 'flat', "a saved 'flat' roof (old maps, old journals) is the plank deck", r.get('style'))
        # the building's list
        bc = await pg.evaluate(f"tw.entities()['{com}'].building")
        av = await pg.evaluate("(b) => { tw.select(b); return tw.registry.available().map(c => c.id).filter(id => id.startsWith('building.roof.')); }", bc)
        check(all(f'building.roof.{s}' in av for s in ('deck', 'turf', 'plaster')), "a building's Roof style list offers them too", av)
        await pg.evaluate(RUN, ['building.roof.turf', bc]); await idle(pg); await pg.wait_for_timeout(600)
        check((await pg.evaluate(ROOFS)).get(com, {}).get('style') == 'deck', "a roof's own style still wins over its building's")
        await pg.evaluate(f"tw.dispatch('room.set', {{ id: '{com}', roof: {{ style: 'auto' }} }})"); await idle(pg); await pg.wait_for_timeout(600)
        check((await pg.evaluate(ROOFS)).get(com, {}).get('style') == 'turf', '... and with it set back to auto, the building\'s turf')

        # ================= EDGES =================
        print('EDGES: battlements on / off, the Edge list, corner turrets')
        sel = f'roof:{com}'
        av = await pg.evaluate(AVAIL, sel)
        check('roof.battlements' in av and 'roof.turrets' in av and 'roof.edge.none' in av and 'roof.edge.railing' in av and 'roof.edge.battlements' in av, 'a flat roof offers Battlements, Corner turrets and the Edge list', av)
        title = await pg.evaluate("(sel) => { tw.select(sel); const c = tw.registry.get('roof.battlements'); return String(typeof c.title === 'function' ? c.title(tw.registry.ctx()) : c.title); }", sel)
        check(title == 'Battlements on', 'the button says what it will do: "Battlements on"', title)
        await pg.evaluate(RUN, ['roof.battlements', sel]); await idle(pg); await pg.wait_for_timeout(600)
        n = await pg.evaluate(ROLES, com)
        check(n and n.get('battlement', 0) >= 10 and not n.get('parapet') and not n.get('turret'), 'Battlements on: merlons round the turf roof (no turrets: it is not a castle)', n)
        await pg.evaluate(RUN, ['roof.turrets', sel]); await idle(pg); await pg.wait_for_timeout(600)
        n = await pg.evaluate(ROLES, com)
        check(n and n.get('turret') == 4 and not n.get('merlon'), 'Corner turrets on: a turret on each of its four corners', n)
        await pg.evaluate(RUN, ['roof.battlements', sel]); await idle(pg); await pg.wait_for_timeout(600)
        n = await pg.evaluate(ROLES, com)
        check(n is not None and not n.get('battlement') and n.get('parapet', 0) >= 10 and await pg.evaluate(f"tw.entities()['{com}'].roof.edge") == 'parapet', "Battlements off: the turf roof's own edge (a stone parapet) again", (n, await pg.evaluate(f"tw.entities()['{com}'].roof")))
        for e, role in (('railing', 'railing'), ('none', None), ('parapet', 'parapet')):
            await pg.evaluate(RUN, [f'roof.edge.{e}', sel]); await idle(pg); await pg.wait_for_timeout(600)
            n = await pg.evaluate(ROLES, com)
            check((n is not None and not any(k in n for k in ('parapet', 'railing', 'battlement', 'corner', 'merlon'))) if role is None else (n and n.get(role, 0) >= 10), f'Edge ▸ {e}', n)
        await pg.wait_for_timeout(2000)
        kit = await pg.evaluate(KIT, com)
        check(any(k[0] == 'parapet' and k[2] and (k[1] or '').startswith('parapet-straight') for k in kit), 'the parapet is the kit\'s parapet piece', kit[:3])
        await pg.evaluate(RUN, ['roof.edge.railing', sel]); await idle(pg); await pg.wait_for_timeout(2500)
        kit = await pg.evaluate(KIT, com)
        check(any(k[0] == 'railing' and k[2] and (k[1] or '').startswith('railing-wood') for k in kit), 'the railing is the timber railing piece', kit[:3])
        await pg.evaluate(RUN, ['roof.edge.auto', sel]); await idle(pg); await pg.wait_for_timeout(600)
        check(await pg.evaluate(f"!tw.entities()['{com}'].roof?.edge"), 'Edge ▸ by the building: the choice is cleared (not stored)', await pg.evaluate(f"tw.entities()['{com}'].roof"))
        # the bar: "battlements on" with the roof selected
        async def bar(q, sel=None):
            await pg.keyboard.press('Escape'); await pg.evaluate('tw.modes.cancel(); tw.clearSelection()')
            if sel: await pg.evaluate("(s) => tw.select(s)", sel)
            await pg.keyboard.press('/'); await pg.locator('#bar input').fill(q); await pg.wait_for_timeout(300)
            return await pg.evaluate('[...document.querySelectorAll("#results .res")].map(el => el.dataset.ref || "")')
        got = await bar('battlements on', sel)
        check(got and got[0] == 'cmd:roof.battlements', 'bar "battlements on" (a roof selected) -> Battlements on, first', got[:3])
        await pg.keyboard.press('Enter'); await idle(pg); await pg.wait_for_timeout(600)
        check(await pg.evaluate(f"tw.entities()['{com}'].roof?.edge") == 'battlements', '... and Enter puts them on')
        await pg.evaluate(f"tw.dispatch('room.set', {{ id: '{com}', roof: {{ style: 'deck' }} }})"); await idle(pg); await pg.wait_for_timeout(600)
        for q, want in (('turrets', 'cmd:roof.turrets'), ('no parapet', 'cmd:roof.edge.none'), ('sod roof', 'cmd:roof.style.turf'), ('whitewash', 'cmd:roof.style.plaster'), ('lead roof', 'cmd:roof.style.lead'), ('flat roof', None)):
            got = await bar(q, sel)
            check(got and (got[0] == want if want else got[0].startswith('cmd:roof.style.')), f'bar "{q}" -> {want or "a flat roof style"} first', got[:3])
        await pg.keyboard.press('Escape')
        # a building selected: Battlements off for every one of its roofs (the castle)
        await pg.evaluate(RUN, ['roof.battlements', castle]); await idle(pg); await pg.wait_for_timeout(900)
        R2 = await pg.evaluate(ROOFS)
        check(all(not any(q['role'] == 'battlement' for q in R2[e['id']]['props']) for e in keep if e['id'] in R2) and all((E2 := None) is None for _ in [0]), "with the castle selected, Battlements off takes them off all its roofs (a flagstone roof's parapet instead)", [sorted({q['role'] for q in R2[e['id']]['props']}) for e in keep if e['id'] in R2][:3])
        await pg.evaluate("tw.undo?.() ?? tw.registry.run('edit.undo')"); await idle(pg); await pg.wait_for_timeout(900)
        R2 = await pg.evaluate(ROOFS)
        check(any(q['role'] == 'battlement' for e in keep if e['id'] in R2 for q in R2[e['id']]['props']), 'one undo puts them back', '')
        # the ring: the roof's menu has the buttons (chords too)
        ring = await pg.evaluate("(sel) => { tw.select(sel); const out = tw.menuFor ? tw.menuFor(tw.registry.ctx(), { ring: true }) : null; return out && out.map(n => n.cmd ? n.cmd.id : n.group); }", sel)
        if ring is not None: check('roof.battlements' in ring and 'roof.turrets' in ring and 'roof.edge.' in ring, "the roof's ring has Battlements, Turrets and Edge ▸", ring)
        chord = await pg.evaluate("['roof.battlements', 'roof.turrets', 'roof.edge.railing'].map(id => tw.chordOf ? tw.chordOf(id) : null)")
        if chord[0] is not None: check(all(chord), 'each has its chord', chord)

        # ================= DICE AND SIGHT =================
        print('DICE: a roll on a flat roof; battlements stop dice, never sight')
        dw = await pg.evaluate("""([id]) => { const w = tw.worldOf(tw.area()), E = tw.entities(), r = E[id], c = r.recipe, x = (c.x + c.w / 2) * 5, z = (c.z + c.d / 2) * 5;
          const trim = w.roofTrimFor(); const W = tw.dice.world({ entities: E, edges: w.edges, from: { x, z }, level: 10, reach: 30, roofTrim: trim, isOpen: (e) => !!e.roof?.off });
          return { tops: W.surfaces.filter(s => s.top).map(s => s.top), roof: W.boxes.filter(b => b.roof).map(b => b.roof) }; }""", [com])
        check(com in dw['tops'] and 'battlement' in dw['roof'], 'the dice see the roof top as a floor, its battlements as walls to bounce off', dw)
        segs = await pg.evaluate("(() => { const w = tw.worldOf(tw.area()); return tw.vision?.blockingSegments ? tw.vision.blockingSegments([...w.edges.values()], tw.entities(), 10).length : null; })()")
        await pg.evaluate("tw.setRoofs(false, 'test')"); await pg.wait_for_timeout(600)
        trim_off = await pg.evaluate("tw.worldOf(tw.area()).roofTrimFor().filter(p => p.role === 'battlement').length")
        check(trim_off > 0, 'with my roofs off the battlements still stop dice (the roof is there whether I look at it or not)', trim_off)
        await pg.evaluate("tw.setRoofs(true, 'test')"); await pg.wait_for_timeout(1500)
        if segs is not None:
            segs2 = await pg.evaluate("(() => { const w = tw.worldOf(tw.area()); return tw.vision.blockingSegments([...w.edges.values()], tw.entities(), 10).length; })()")
            check(segs == segs2, 'battlements add no sight-blocking segment', (segs, segs2))

        # ================= OBJECTS =================
        print('OBJECTS: roof objects from the bar, standing on the roof')
        for q, want in (('turret', 'cat:roof-bartizan'), ('water tank', 'cat:roof-cistern'), ('flagpole', 'cat:roof-flagpole'), ('roof hatch', 'cat:roof-hatch'), ('chimney', 'cat:chimney-stack')):
            places = [r for r in await bar(q) if r.startswith('cat:')]
            check(want in places[:3], f'bar "{q}" -> {want} among the first three to place', places[:4])
        await pg.keyboard.press('Escape')
        rec = await pg.evaluate(f"(() => {{ const r = tw.entities()['{com}'].recipe; return [(r.x + r.w / 2) * 5, (r.z + r.d / 2) * 5]; }})()")
        await look(pg, rec[0], rec[1], 50, 60)
        old = await pg.evaluate('Object.keys(tw.entities())')
        for i, (q, cat) in enumerate((('water tank', 'roof-cistern'), ('flagpole', 'roof-flagpole'), ('roof hatch', 'roof-hatch'))):
            await bar(q); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
            ok = await pg.evaluate(f"tw.mode?.cat?.id === '{cat}'")
            pt = await pg.evaluate(f"tw.screenOf({rec[0] - 5 + i * 5}, {rec[1]}, tw.main, 10)")
            await pg.mouse.move(pt['x'], pt['y']); await pg.wait_for_timeout(200); await pg.mouse.click(pt['x'], pt['y']); await idle(pg); await pg.wait_for_timeout(300)
            new = await pg.evaluate("old => Object.values(tw.entities()).filter(e => !old.includes(e.id))", old)
            got = [e for e in new if e.get('cat') == cat]
            base = (await pg.evaluate(ROOFS)).get(com, {}).get('base')
            check(ok and len(got) == 1 and abs((got[0].get('y') or 0) - base) < 0.06 and got[0].get('place') == 'floor', f'"{q}" put down on the flat roof stands on its surface ({base} ft), an ordinary thing', [(e.get('cat'), e.get('y'), e.get('place')) for e in new])
            old = await pg.evaluate('Object.keys(tw.entities())'); await pg.keyboard.press('Escape'); await pg.evaluate('tw.modes.cancel()')
        await pg.wait_for_timeout(2500); await snap(pg, 'roof-objects')
        tank = await pg.evaluate("Object.values(tw.entities()).find(e => e.cat === 'roof-cistern')")
        if tank:
            bx = await pg.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), r = w.recs.get('{tank['id']}'); const b = w.boundsOf(r); return b && [b.min.y, b.max.y]; }})()")
            check(bx and abs(bx[0] - tank['y']) < 0.5 and 3 < bx[1] - bx[0] < 7, 'the tank is drawn on the roof, table-sized', bx)
            await pg.evaluate(f"tw.select('{tank['id']}')"); await pg.wait_for_timeout(200)
            check(await pg.evaluate("tw.selected().length === 1 && tw.registry.available().some(c => c.id === 'edit.delete')"), 'it is selected and can be deleted like any thing')

        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await b.close()
    passed = sum(1 for r in results if r[0])
    print(f'roofflat: {passed}/{len(results)} passed')
    return passed == len(results)

try: ok = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
sys.exit(0 if ok else 1)

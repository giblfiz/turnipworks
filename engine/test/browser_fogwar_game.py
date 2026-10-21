#!/usr/bin/env python3
"""Fog-of-war LOOK in the game (2026-10-17): the war-fog bank, secrecy and the switches, end to end.
tw-slot browser-venv/bin/python engine/test/browser_fogwar_game.py --local [--shots]
A GM and one player; three rooms in a row (A | B | C, closed doors). The player's pawn stands in A. In C (never seen):
an NPC pawn, a barrel and a lit brazier; a second barrel in A is the positive control. Both barrels are tinted magenta in
the player's own tab, so if C's barrel were ever drawn its colour would show.
  G1  never-seen things are not drawn for the player at all: pawn, barrel, brazier (no flame, no light) and C's shell
  G2  the war-fog bank stands over never-seen ground (atmosphere heavy channel), nothing over A
  G3  SECRECY: 0 magenta pixels from C, high / 3/4 / low cameras x Low / Medium / High graphics, with the cursor stirring
      the bank over C; positive control: the barrel in A shows magenta from the high and 3/4 cameras
  G4  the GM sees C (unchanged); "view as" the player shows the player's look (fog pass on, C undrawn), back to GM: off
  G5  fog of war off for this area: no fog pass, and the bank over C drains away
  G6  no house look: the game's fog of war uses the built-in defaults
"""
import argparse, asyncio, io, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request, shutil
from playwright.async_api import async_playwright
from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401
tw_sandbox.remove_campaigns()
SHOTS = os.path.join(HERE, 'shots', 'fogwar')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true')
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18303,18903').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-fogwar-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False

def magenta(png):
    a = np.asarray(Image.open(io.BytesIO(png)).convert('RGB')).astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return int(((r > 150) & (b > 150) & (g < 90) & (r - g > 90) & (b - g > 90)).sum())

TINT = """(ids) => { const w = tw.worldOf(tw.area()); let n = 0; for (const id of ids) { const r = w.recs.get(id); if (!r) continue;
  r.group.traverse(o => { if (!o.isMesh) return; for (const k of ['material']) { const m = o[k].clone(); m.map = null; m.color?.set('#ff00ff'); m.emissive?.set('#ff00ff'); m.emissiveIntensity = 1; m.needsUpdate = true; o[k] = m; n++; } }); }
  return n; }"""

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}, device_scale_factor=1)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e))); await pg.goto(url); return pg
        async def action(pg, code):
            await pg.evaluate(code); await wait(pg, 'tw.sync.pendingCount() === 0', 15000, 'command accepted'); await pg.wait_for_timeout(250)
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', f"TEST fogwar look {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw?.ready?.() && tw.fog', 90000), 'GM did not come up'
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        pl = await tab(invite)
        assert await wait(pl, 'window.tw?.ready?.() && tw.fog', 90000), 'player did not join'
        seat = await pl.evaluate('tw.me()')
        for x in [0, 4, 8]:
            await gm.evaluate('(x) => tw.spawnRoom("common", x, 0, 4, 4, 7401+x)', x)
            await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        await action(gm, "tw.batch([...tw.worldOf(tw.area()).edges.values()].filter(e => e.sides.length === 1).map(e => ({type:'edge.set',args:{key:e.key,as:'wall',piece:'wall-straight'}})))")
        z = 10.0
        PA, NPC, BC, BA, FIRE = 'tok_fwmira0001', 'tok_fwhidden01', 'obj_fwbarrelc01', 'obj_fwbarrela01', 'obj_fwbrazier01'
        await action(gm, 'tw.batch(' + json.dumps([
            {'type': 'token.create', 'args': {'id': PA, 'name': 'Mira', 'x': 7.5, 'z': z, 'owner': seat}},
            {'type': 'token.create', 'args': {'id': NPC, 'name': 'Hidden sentinel', 'x': 50, 'z': z}}]) + ')')
        MOUNT = 'obj_fwmount001'
        await action(gm, f"tw.dispatch('object.place', {{ id: '{MOUNT}', x: 20.85, z: {z}, y: 4.5, cat: 'barrel', ...tw.roomgen.sizeOf('barrel'), dims: [0.6, 1.0, 0.6] }})")  # hung on B's side of the A|B wall
        for oid, cat, x, zz in [(BC, 'barrel', 52.5, 6.5), (BA, 'barrel', 14, 4.5), (FIRE, 'brazier-tripod', 47.5, 15)]:
            await action(gm, f"tw.dispatch('object.place', {{ id: '{oid}', x: {x}, z: {zz}, cat: '{cat}', ...tw.roomgen.sizeOf('{cat}') }})")
        await wait(pl, f"!!tw.entities()['{FIRE}'] && !!tw.entities()['{NPC}']", 30000)
        await pl.evaluate("tw.settings.setGfx('medium')")
        # (density checks below assume no spill tongues: this tab only, whatever the house look's spill; the house is untouched)
        await pl.evaluate("(() => { const fx = tw.worldOf(tw.area()).fx; if (!fx) return; const p = JSON.parse(JSON.stringify(fx.fogwar.params)); p.spill.push = 0; fx.setParams('fogwar', p); })()")
        await wait(pl, f"tw.fog.visible(7.5,{z},0) && !tw.fog.visible(50,{z},0)", 30000, 'player vision')
        await pl.wait_for_timeout(2500)
        drawn = lambda i: f"!!tw.worldOf(tw.area()).recs.get('{i}')?.group.visible"
        st = await pl.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()); const shell = [...w.shell.values()].filter(s => s.spec.x > 41 && s.spec.x < 59 && s.spec.z > 1 && s.spec.z < 19);
          return {{ npc: {drawn(NPC)}, barrel: {drawn(BC)}, fire: {drawn(FIRE)}, control: {drawn(BA)}, flames: w.fx.fire.flames().filter(f => f.world && f.world.x > 41).length,
            shell: shell.length, shellDrawn: shell.filter(s => s.group?.visible).length }}; }})()""")
        check(not st['npc'] and not st['barrel'] and not st['fire'] and st['flames'] == 0 and st['shellDrawn'] == 0 and st['control'],
              'G1 never-seen pawn, barrel, brazier and C\'s inner shell are not drawn for the player (A\'s barrel is)', st)
        heavy = await pl.evaluate(f"(() => {{ const a = tw.worldOf(tw.area()).fx.atmos; a.warm(120); return [a.probe('heavy', [[50, {z}], [55, 4]]), a.probe('heavy', [[7.5, {z}]])]; }})()")
        light = await pl.evaluate("(() => { const a = tw.worldOf(tw.area()).fx.atmos, f = a.readField('light'); let m = 0; for (const [x, z] of [[47.5, 15], [50, 10], [53, 5]]) { const [i, j] = a.cellOf(x, z, f.w, f.h); if (i < 0 || j < 0 || i >= f.w || j >= f.h) continue; const o = (j * f.w + i) * 4; m = Math.max(m, f.data[o], f.data[o + 1], f.data[o + 2]); } return m; })()")
        check(all((v or 0) > 0.45 for v in heavy[0]) and (heavy[1][0] or 0) < 0.05 and light < 1e-4, 'G2 the war-fog bank stands over never-seen C, nothing over A; no firelight in C', f'heavy C {heavy[0]}, A {heavy[1]}, light in C {light}')
        kw = await pl.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()); const walls = [...w.shell.values()].filter(s => s.spec.layer === 'walls');
          const drawn = walls.filter(s => s.group?.visible), ab = drawn.filter(s => s.spec.wallDir !== 'c' && Math.abs(s.spec.x - 20) < 0.6);
          return {{ drawn: drawn.length, unknownDrawn: drawn.filter(s => !w.wallKnown(s)).length, abKnown: ab.length, passKnown: w.fx.fogwar.stats().fogwar_known, mount: {drawn(MOUNT)},
            farOnly: walls.filter(s => s.spec.x > 21 && s.group?.visible).length }}; }})()""")
        check(kw['abKnown'] >= 3 and kw['unknownDrawn'] == 0 and kw['passKnown'] == kw['drawn'] and not kw['mount'] and kw['farOnly'] == 0,
              'G7 walls known through their thickness: the A|B wall (its A face seen) is known and drawn whole; every drawn wall is known; a thing hung on its far side and walls beyond stay undrawn', kw)
        n_tint = await pl.evaluate(f'({TINT})(["{BC}", "{BA}", "{NPC}"])')
        cams = {'high': (62, 70), '3/4': (40, 60), 'low': (12, 45)}
        leaks = {}; control = {}
        for gfx in ['low', 'medium', 'high']:
            await pl.evaluate(f"tw.settings.setGfx('{gfx}')"); await pl.wait_for_timeout(1500)
            for cam, (pitch, dist) in cams.items():
                await pl.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set(30, 0, 10); g.yaw = 0; g.pitch = {pitch}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
                await pl.wait_for_timeout(700)
                for i in range(16):
                    s = await pl.evaluate(f"(() => {{ const p = tw.screenOf({44 + i}, {10 + 6 * np.sin(i * 0.7):.2f}, tw.main, 1); return [p.x, p.y]; }})()")
                    if s and s[0] == s[0]: await pl.mouse.move(max(1, min(1399, s[0])), max(1, min(899, s[1]))); await pl.wait_for_timeout(25)
                png = await pl.screenshot()
                if A.shots: open(os.path.join(SHOTS, f'player-{gfx}-{cam.replace("/", "q")}.png'), 'wb').write(png)
                # C's half of the screen vs A's half: x of C's centre on screen
                cx = (await pl.evaluate(f"(() => {{ const p = tw.screenOf(50, {z}, tw.main, 0); return p.x; }})()"))
                ax = (await pl.evaluate(f"(() => {{ const p = tw.screenOf(7.5, {z}, tw.main, 0); return p.x; }})()"))
                img = Image.open(io.BytesIO(png)); mid = int(max(1, min(1399, (cx + ax) / 2)))
                right = io.BytesIO(); img.crop((mid, 0, 1400, 900) if cx > ax else (0, 0, mid, 900)).save(right, 'PNG')
                left = io.BytesIO(); img.crop((0, 0, mid, 900) if cx > ax else (mid, 0, 1400, 900)).save(left, 'PNG')
                leaks[f'{gfx}/{cam}'] = magenta(right.getvalue()); control[f'{gfx}/{cam}'] = magenta(left.getvalue())
        await pl.mouse.move(3, 3)
        check(n_tint > 0 and all(v == 0 for v in leaks.values()) and all(control[f'{g}/{c}'] > 30 for g in ['low', 'medium', 'high'] for c in ['high', '3/4']),
              'G3 SECRECY: no magenta from never-seen C at Low/Medium/High x high/3-4/low cameras while the cursor stirs; A\'s magenta barrel shows', f'C {leaks}; control A {control}; tinted meshes {n_tint}')
        await pl.evaluate("tw.settings.setGfx('medium')")
        # G8 FIRST REVEAL (2026-10-18, Harry: "an instant snap to 'remembered'"): the GM opens the A|B door; B has never been
        # seen. With a spill cap like Harry's house look (0.28), the bank over B must stay whole and B keep its checker
        # (sight clock >= 12) until the roll-back front comes, then clear; C's magenta barrel changes 0 pixels mid-reveal.
        await pl.evaluate("(() => { const fx = tw.worldOf(tw.area()).fx, p = JSON.parse(JSON.stringify(fx.fogwar.params)); p.spill.cap = 0.28; fx.setParams('fogwar', p); })()")
        dk = await gm.evaluate("(() => { const e = [...tw.worldOf(tw.area()).edges.values()].find(e => e.kind === 'door' && e.sides.length === 2 && e.key.startsWith('v:4:')); return e ? e.key : null; })()")
        # the cell: the first ground in B that comes into sight (scanned on the fog pass's own mask)
        DEN = """(() => { const w = tw.worldOf(tw.area()), a = w.fx.atmos, fw = w.fx.fogwar, f = a.readField('density');
          const at = (x, z) => { const [i, j] = a.cellOf(x, z, f.w, f.h); if (i < 0 || j < 0 || i >= f.w || j >= f.h) return null; const o = (j * f.w + i) * 4; return [+f.data[o + 1].toFixed(2), +f.data[o + 3].toFixed(2)]; };
          if (!window.__g8) for (let x = 24; x <= 29 && !window.__g8; x++) for (let z = 1; z <= 19; z++) if (fw.isPointVisible(x, z, 0) && at(x, z)) { window.__g8 = [x, z]; break; }
          const p = window.__g8 || [26, 10]; return at(p[0], p[1]) || [0, 0]; })()"""
        ABC = """() => { const w = tw.worldOf(tw.area()), r = w.recs.get('%s'), gl = document.querySelector('#c').getContext('webgl2'); if (!r) return 0;
          const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, shot = () => { w.fx.render(0); const a = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
          const was = r.group.visible; r.group.visible = true; const A = shot(); r.group.visible = false; const B = shot(); r.group.visible = was; let d = 0;
          for (let i = 0; i < A.length; i += 4) if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > 2) d++; return d; }""" % BC
        await pl.evaluate("(() => { const g = tw.main.grab; g.focus.set(28, 0, 10); g.yaw = 0; g.pitch = 55; g.dist = 60; g.update(); tw.main.rule = 'free'; })()")
        await pl.wait_for_timeout(1500)
        before = await pl.evaluate(DEN); await pl.evaluate('window.__g8 = null')
        await gm.evaluate(f"tw.toggleOpen(tw.wallItem('wall:{dk}'))"); t0 = time.time()
        held, tseen, trace = None, None, []
        while time.time() - t0 < 10:  # the first moment the cell is in sight: its sight clock says what it will do
            v = await pl.evaluate(DEN); trace.append((round(time.time() - t0, 2), v))
            if v[1] > 1.5: held, tseen = v, round(time.time() - t0, 2); break
            await pl.wait_for_timeout(50)
        abmid = await pl.evaluate(ABC)
        await pl.wait_for_timeout(6000); after = await pl.evaluate(DEN)
        await pl.evaluate("(() => { const fx = tw.worldOf(tw.area()).fx, p = JSON.parse(JSON.stringify(fx.fogwar.params)); p.spill.cap = 0; fx.setParams('fogwar', p); })()")
        check(bool(dk) and held is not None and before[0] > 0.6 and held[0] > 0.6 and held[1] >= 11.5 and after[0] <= 0.29 and abs(after[1] - 2) < 0.01 and abmid == 0,
              'G8 first reveal: the bank over never-seen B stays whole with its checker (sight clock >= 12) until the roll-back front, then clears (to the spill cap); C changes 0 pixels mid-reveal',
              dict(before=before, in_sight_at=tseen, held=held, after_6s=after, mid_reveal_C_px=abmid, trace=trace[-3:], door=dk, cell=await pl.evaluate('window.__g8')))
        # G9 a fast zoom-out never replays a reveal (2026-10-19, Harry: "when I rapidly zoom out we get the slow roll-out of
        # checkerboard, even with things that are already in view"): ground in sight around the pawn keeps a settled sight
        # clock (2: no checker hold) and no bank within 0.3 s of wheeling from close up to the whole map; never-seen C
        # still wears the bank
        await pl.evaluate("(() => { const g = tw.main.grab; g.focus.set(4, 0, 4); g.yaw = 0; g.pitch = 55; g.dist = 7; g.update(); tw.main.rule = 'free'; })()")
        await pl.wait_for_timeout(2500)
        Z = """(() => { const w = tw.worldOf(tw.area()), a = w.fx.atmos, fw = w.fx.fogwar, f = a.readField('density'); const out = { clocks: [], heavy: 0, n: 0 };
          for (let x = 1; x <= 19; x += 1) for (let z = 1; z <= 19; z += 1) { if (!fw.isPointVisible(x, z, 0)) continue; const [i, j] = a.cellOf(x, z, f.w, f.h); if (i < 0 || j < 0 || i >= f.w || j >= f.h) continue;
            const o = (j * f.w + i) * 4; out.n++; out.heavy = Math.max(out.heavy, f.data[o + 1]); out.clocks.push(f.data[o + 3]); }
          const c = out.clocks; out.clockMin = c.length ? Math.min(...c) : null; out.clockMax = c.length ? Math.max(...c) : null; delete out.clocks;
          const [i, j] = a.cellOf(50, 10, f.w, f.h); out.C = (i >= 0 && j >= 0 && i < f.w && j < f.h) ? f.data[(j * f.w + i) * 4 + 1] : null; out.window = a.stats().atmos_window_ft; return out; })()"""
        z0 = await pl.evaluate(Z)
        await pl.mouse.move(700, 450)
        for _ in range(24): await pl.mouse.wheel(0, 1200); await pl.wait_for_timeout(12)
        await pl.wait_for_timeout(300)
        z1 = await pl.evaluate(Z)
        await pl.wait_for_timeout(1500); z2 = await pl.evaluate(Z)
        check(z1['n'] > 20 and z1['window'] > z0['window'] and z1['clockMax'] < 2.01 and z1['clockMin'] > 1.99 and z1['heavy'] < 0.3 and (z2['C'] or 0) > 0.5,
              'G9 a fast zoom-out replays no reveal: ground in sight stays settled (clock 2, no bank) 0.3 s after wheeling out; never-seen C keeps its bank', dict(close=z0, after_03s=z1, after_18s=z2))
        gm_sees = await gm.evaluate(f"({drawn(NPC)}) && ({drawn(BC)}) && !(tw.worldOf(tw.area()).fx?.fogwar?.enabled)")
        await action(gm, f"tw.registry.run('vision.view.seat.{seat}')"); await gm.wait_for_timeout(2500)
        as_player = await gm.evaluate(f"!!tw.worldOf(tw.area()).fx?.fogwar?.enabled && !({drawn(NPC)}) && !({drawn(BC)}) && tw.fog.visible(7.5, {z}, 0) && !tw.fog.visible(50, {z}, 0)")
        await action(gm, "tw.registry.run('vision.view.gm')"); await gm.wait_for_timeout(1000)
        back = await gm.evaluate(f"!(tw.worldOf(tw.area()).fx?.fogwar?.enabled) && ({drawn(NPC)})")
        check(gm_sees and as_player and back, 'G4 the GM sees C; "view as" the player shows the player\'s look; back to GM: no fog pass', dict(gm=gm_sees, as_player=as_player, back=back))
        await action(gm, "tw.registry.run('area.fogOfWar.off')"); await pl.wait_for_timeout(2500)
        off = await pl.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); w.fx.atmos.warm(150); return {{ pass: !!w.fx.fogwar.enabled, bankDrawn: w.fx.atmos.stats().atmos_heavy_on }}; }})()")
        await action(gm, "tw.registry.run('area.fogOfWar.on')")
        check(not off['pass'] and off['bankDrawn'] is False, 'G5 fog of war off for the area: no fog pass and no bank', off)
        name, house = await pl.evaluate("(async () => { const api = new URLSearchParams(location.search).get('api'); let h = null; if (api !== '') { try { h = (await (await fetch((api || '/api/tw-ratings') + '/tuner/house', { cache: 'no-store' })).json()).fogwar; } catch { } } return [tw.worldOf(tw.area()).fx.fogwar.params.name, h?.name || null]; })()")
        check(name == (house or 'default'), 'G6 the game wears the house fog-of-war look (built-in defaults when none was sent)', f'{name} (house: {house})')
        check(not errors, 'no page errors', errors[:3])
        await browser.close()

if __name__ == '__main__':  # (experiments import its servers and helpers)
    try:
        asyncio.run(main())
    finally:
        for pr in procs: pr.terminate()
        for d in tmp: shutil.rmtree(d, ignore_errors=True)
    n = sum(1 for ok, *_ in results if ok)
    print(f'browser fogwar game: {n}/{len(results)} passed', flush=True)
    sys.exit(0 if results and n == len(results) else 1)

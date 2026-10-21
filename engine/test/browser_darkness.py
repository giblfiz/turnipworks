#!/usr/bin/env python3
"""Darkness in fog of war (2026-10-20; core/darkness.js, client/darksight.js), end to end in the game.
tw-slot browser-venv/bin/python engine/test/browser_darkness.py --local [--shots DIR]
A GM and one player. A 50-ft hall (A) and a room B beyond its east wall, one door between them, shut. Every light the
room generator furnished is given radius 0, so the only lights are the test's. Darkness is switched on BEFORE the player
has seen anything. The player's pawn Mira (brought on from her My pawns definition) stands at the hall's west end, in line
with the door. A torch (radius 20) stands in B in line with the door. The Fog of war look's remembered edge is 2 ft.
  D1  darkvision 30 (the default), edge 2: 27 ft visible; 29 ft explored, not visible; 31 and 35 ft nothing (the mask too)
  D2  door shut: B and the hall near the wall stay dark (a light never lights through a wall); door open: the torch's
      light is seen through the door, in B and spilling into the hall, far past darkvision
  D3  the torch put out: its cells are no longer seen, stay remembered, and the fog pours back (sight clock -> remembered)
  D4  SECRECY: an NPC in the remembered band and a magenta barrel in the dark (in line of sight) are not drawn: 0 magenta
      at Low / Medium / High x high / 3/4 / low cameras; forced into the picture, the dark barrel changes 0 pixels;
      positive control: a magenta barrel inside darkvision shows
  D5  the remembered edge follows the look's knob: edge 5 -> 27 ft is no longer visible, 24 ft is
  D6  Me > My pawns "Sees in the dark (ft)" = 60: synced to the GM's tab; Mira sees 45 ft; the bar's "darkvision 40" and
      undo; the GM's "light radius 30" on the torch
  D7  the GM sees all; "view as" the player shows the darkness
  D8  darkness off here: the player's sight is plain fog of war again (the whole hall)
"""
import argparse, asyncio, io, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request, shutil
from playwright.async_api import async_playwright
from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots')
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18313,18913').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-dark-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
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
  r.group.traverse(o => { if (!o.isMesh || o.userData.__tinted) return; const m = o.material.clone(); m.map = null; m.color?.set('#ff00ff'); m.emissive?.set('#ff00ff'); m.emissiveIntensity = 1; m.needsUpdate = true; o.material = m; o.userData.__tinted = true; n++; }); }
  return n; }"""
# force a thing into the picture and back: how many pixels change (the fog pass must cover it)
FORCE = """(id) => { const w = tw.worldOf(tw.area()), r = w.recs.get(id), gl = document.querySelector('#c').getContext('webgl2'); if (!r) return -1;
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, shot = () => { w.fx.render(0); const a = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
  const was = r.group.visible; r.group.visible = true; const A = shot(); r.group.visible = false; const B = shot(); r.group.visible = was; let d = 0;
  for (let i = 0; i < A.length; i += 4) if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > 2) d++; return d; }"""

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    if A.shots: os.makedirs(A.shots, exist_ok=True)
    async def shot(pg, name):
        if A.shots: await pg.screenshot(path=os.path.join(A.shots, name + '.png'))
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
        await gm.fill('#newCampaign input[name=name]', f"TEST darkness {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw?.ready?.() && tw.fog', 90000), 'GM did not come up'
        for x, w in [(0, 10), (10, 4)]:
            await gm.evaluate('([x, w]) => tw.spawnRoom("common", x, 0, w, 4, 8801 + x)', [x, w])
            await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        await action(gm, "tw.batch([...tw.worldOf(tw.area()).edges.values()].filter(e => e.sides.length === 1).map(e => ({type:'edge.set',args:{key:e.key,as:'wall',piece:'wall-straight'}})))")
        door = await gm.evaluate("(() => { const ds = [...tw.worldOf(tw.area()).edges.values()].filter(e => e.sides.length === 2 && e.dir === 'v' && e.gx === 10 && e.kind === 'door'); return ds.length ? { key: ds[0].key, z: ds[0].gz * 5 + 2.5 } : null; })()")
        if not door:  # make one: the middle of the hall|B wall
            await action(gm, "tw.dispatch('edge.set', { key: 'v:10:2', as: 'door' })")
            door = {'key': 'v:10:2', 'z': 12.5}
        dz = door['z']
        # every furnished light gives no light: the test's torch is the only one
        await action(gm, "tw.batch(Object.values(tw.entities()).filter(e => e.kind === 'object' && tw.assets.lightKind(e.cat)).map(e => ({ type: 'object.set', args: { id: e.id, lightRadius: 0 } })))")
        await action(gm, "tw.registry.run('area.darkness.on')")
        TORCH, NPC, BD, BC = 'obj_dktorch001', 'tok_dknpc0001', 'obj_dkbarreld1', 'obj_dkbarrelc1'
        await action(gm, f"tw.dispatch('object.place', {{ id: '{TORCH}', x: 62.5, z: {dz}, cat: 'torch-stand', ...tw.roomgen.sizeOf('torch-stand') }})")
        await action(gm, f"tw.dispatch('object.set', {{ id: '{TORCH}', lightRadius: 20 }})")
        bz = dz + 5 if dz < 10 else dz - 5
        for oid, x, zz in [(BD, 40, bz), (BC, 14, bz)]:
            await action(gm, f"tw.dispatch('object.place', {{ id: '{oid}', x: {x}, z: {zz}, cat: 'barrel', ...tw.roomgen.sizeOf('barrel') }})")
        await action(gm, f"tw.dispatch('token.create', {{ id: '{NPC}', name: 'Lurker', x: 31.5, z: {dz} }})")
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        pl = await tab(invite)
        assert await wait(pl, 'window.tw?.ready?.() && tw.fog', 90000), 'player did not join'
        seat = await pl.evaluate('tw.me()')
        DEF, PA = 'def_dkmira0001', 'tok_dkmira0001'
        await action(pl, f"tw.dispatch('pawn.define', {{ id: '{DEF}', name: 'Mira' }})")
        await action(pl, f"tw.dispatch('pawn.bring', {{ id: '{PA}', def: '{DEF}', x: 2.5, z: {dz} }})")
        await pl.evaluate("tw.settings.setGfx('medium')")
        await pl.evaluate("(() => { const fx = tw.worldOf(tw.area()).fx; if (!fx) return; const p = JSON.parse(JSON.stringify(fx.fogwar.params)); p.spill.push = 0; p.dark = { hint: 2 }; fx.setParams('fogwar', p); })()")
        ok = await wait(pl, f"tw.fog.dark() && tw.fog.visible(10, {dz}, 0) && tw.fog.info().areas.some(a => a.dark)", 30000, 'dark vision')
        await pl.wait_for_timeout(1500)
        V = lambda x, z=None: f"tw.fog.visible({x}, {dz if z is None else z}, 0)"
        K = lambda x, z=None: f"tw.fog.explored({x}, {dz if z is None else z}, 0)"
        M = lambda x, z=None: f"tw.worldOf(tw.area()).fx.fogwar.isPointVisible({x}, {dz if z is None else z}, 0)"
        async def ev(js): return await pl.evaluate(js)
        cam = lambda fx, pitch, dist: f"(() => {{ const g = tw.main.grab; g.focus.set({fx}, 0, {dz}); g.yaw = 0; g.pitch = {pitch}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"
        await pl.evaluate(cam(28, 62, 75)); await pl.wait_for_timeout(1500)
        # D1: the pawn at x 2.5; 27 ft = 29.5, 29 ft = 31.5, 31 ft = 33.5, 35 ft = 37.5
        d1 = await ev(f"({{ v27: {V(29.5)}, m27: {M(29.5)}, v29: {V(31.5)}, k29: {K(31.5)}, m29: {M(31.5)}, k31: {K(33.5)}, k35: {K(37.5)}, v35: {V(37.5)}, m35: {M(37.5)} }})")
        check(ok and d1['v27'] and d1['m27'] and not d1['v29'] and d1['k29'] and not d1['m29'] and not d1['k31'] and not d1['k35'] and not d1['v35'] and not d1['m35'],
              'D1 darkvision 30 (default), remembered edge 2: 27 ft seen; 29 ft remembered, not seen; 31 and 35 ft nothing (fog mask agrees)', d1)
        await shot(pl, 'dark-1-darkvision-edge')
        # D2: the door shut, the torch in B (radius 20) lights nothing in the hall and B is not seen
        shut = await ev(f"({{ b: {V(60)}, bk: {K(60)}, hall: {V(45)}, hallk: {K(45)}, wallside: {V(47.5, dz)} }})")
        await gm.evaluate(f"tw.toggleOpen(tw.wallItem('wall:{door['key']}'))")
        opened = await wait(pl, f"{V(60)} && {V(45)}", 20000, 'torch through the door')
        await pl.wait_for_timeout(1500)
        op = await ev(f"({{ b: {V(60)}, mb: {M(60)}, hall: {V(45)}, beside: {V(45, dz + 7 if dz < 10 else dz - 7)}, dv: {V(40, bz)}, lights: tw.fog.info().areas.find(a => a.dark)?.lights }})")
        check(not shut['b'] and not shut['bk'] and not shut['hall'] and not shut['hallk'] and opened and op['b'] and op['mb'] and op['hall'] and not op['dv'],
              'D2 a torch in the next room: door shut, nothing of B and no light through the wall; door open, its light is seen through the door (B and the hall by it, 40+ ft past darkvision)', dict(shut=shut, open=op))
        await pl.evaluate(cam(45, 55, 60)); await pl.wait_for_timeout(1500); await shot(pl, 'dark-2-torch-through-door')
        # D2b walls: every wall piece drawn for the player is one whose face she has seen or remembers (fogwar "known
        # through its thickness"); the shell drawn, by where it stands, for the record
        kw = await ev(f"""(() => {{ const w = tw.worldOf(tw.area()); const walls = [...w.shell.values()].filter(s => s.spec.layer === 'walls'), drawn = walls.filter(s => s.group?.visible);
          return {{ drawn: drawn.length, unknownDrawn: drawn.filter(s => !w.wallKnown(s)).length,
            at: drawn.map(s => [Math.round(s.spec.x), Math.round(s.spec.z), s.spec.cat || s.spec.id || '', w.fogKnown(s.spec.x, s.spec.z, 0)]).sort((a, b) => a[0] - b[0]) }}; }})()""")
        check(kw['unknownDrawn'] == 0, 'D2b every wall piece drawn for the player is a known one (seen or remembered face)', dict(drawn=kw['drawn'], unknown=kw['unknownDrawn'], at=kw['at']))
        # D4 SECRECY (the torch still lit; the NPC stands in the remembered band, the dark barrel is in line of sight but unlit)
        st = await ev(f"(() => {{ const w = tw.worldOf(tw.area()); const d = id => !!w.recs.get(id)?.group.visible; return {{ npc: d('{NPC}'), dark: d('{BD}'), control: d('{BC}'), npcSeen: tw.canSeePawn(tw.entities()['{NPC}']) }}; }})()")
        n_tint = await ev(f'({TINT})(["{NPC}", "{BD}"])')
        cams = {'high': (28, 62, 75), '3/4': (25, 45, 60), 'low': (10, 18, 40)}
        leaks = {}
        for gfx in ['low', 'medium', 'high']:
            await pl.evaluate(f"tw.settings.setGfx('{gfx}')"); await pl.wait_for_timeout(1500)
            for name, (fx, pitch, dist) in cams.items():
                await pl.evaluate(cam(fx, pitch, dist)); await pl.wait_for_timeout(700)
                for i in range(10):  # stir the fog over the dark ground
                    s = await ev(f"(() => {{ const p = tw.screenOf({30 + i}, {bz:.2f}, tw.main, 1); return [p.x, p.y]; }})()")
                    if s and s[0] == s[0]: await pl.mouse.move(max(1, min(1399, s[0])), max(1, min(899, s[1]))); await pl.wait_for_timeout(25)
                png = await pl.screenshot(); leaks[f'{gfx}/{name}'] = magenta(png)
                if A.shots and gfx == 'medium': open(os.path.join(A.shots, f'dark-4-secrecy-{name.replace("/", "q")}.png'), 'wb').write(png)
        await pl.mouse.move(3, 3)
        await pl.evaluate("tw.settings.setGfx('medium')"); await pl.evaluate(cam(28, 62, 75)); await pl.wait_for_timeout(1200)
        forced = await ev(f'({FORCE})("{BD}")')
        await ev(f'({TINT})(["{BC}"])'); await pl.wait_for_timeout(400); control = magenta(await pl.screenshot())
        check(not st['npc'] and not st['dark'] and st['control'] and not st['npcSeen'] and n_tint > 0 and all(v == 0 for v in leaks.values()) and forced == 0 and control > 30,
              'D4 SECRECY: a pawn in the remembered band and a barrel in the dark are not drawn; 0 magenta at Low/Medium/High x high/3-4/low; forced into the picture the dark barrel changes 0 px; the barrel in darkvision shows',
              dict(drawn=st, leaks=leaks, forced_px=forced, control_px=control, tinted=n_tint))
        # D3: put the torch out: B no longer seen, remembered, the fog pours back over it
        CLOCK = f"""(() => {{ const a = tw.worldOf(tw.area()).fx.atmos, f = a.readField('density'); const [i, j] = a.cellOf(60, {dz}, f.w, f.h); if (i < 0 || j < 0 || i >= f.w || j >= f.h) return null; return +f.data[(j * f.w + i) * 4 + 3].toFixed(2); }})()"""
        await pl.evaluate(cam(50, 55, 60)); await pl.wait_for_timeout(1500)
        c0 = await ev(CLOCK)
        await gm.evaluate(f"tw.toggleLit([tw.entities()['{TORCH}']])")
        out = await wait(pl, f"!{V(60)}", 15000, 'torch out')
        snap = await ev(f"({{ b: {V(60)}, bk: {K(60)}, mb: {M(60)}, hall: {V(45)} }})")
        await pl.wait_for_timeout(5000); c1 = await ev(CLOCK)
        await shot(pl, 'dark-3-snuffed')
        check(out and not snap['b'] and snap['bk'] and not snap['mb'] and not snap['hall'] and c0 is not None and c0 > 1.5 and c1 is not None and c1 <= -1.99,
              'D3 the torch put out: B is no longer seen, stays remembered, and the fog pours back (sight clock in sight -> remembered)', dict(after=snap, clock_lit=c0, clock_5s=c1))
        # D5: the remembered edge follows the knob (5 ft: the seen core is 25 ft)
        await pl.evaluate("(() => { const fx = tw.worldOf(tw.area()).fx, p = JSON.parse(JSON.stringify(fx.fogwar.params)); p.dark = { hint: 5 }; fx.setParams('fogwar', p); })()")
        h5 = await wait(pl, f"!{V(29.5)} && {V(26.5)}", 15000, 'edge 5')
        h5d = await ev(f"({{ v24: {V(26.5)}, v27: {V(29.5)}, hint: tw.fog.info().areas.find(a => a.dark)?.hint }})")
        await pl.evaluate("(() => { const fx = tw.worldOf(tw.area()).fx, p = JSON.parse(JSON.stringify(fx.fogwar.params)); p.dark = { hint: 2 }; fx.setParams('fogwar', p); })()")
        back2 = await wait(pl, V(29.5), 15000, 'edge 2 again')
        check(h5 and h5d['hint'] == 5 and back2, 'D5 the remembered edge follows the Fog of war look knob: at 5 ft, 27 ft is no longer seen and 24 ft is; back to 2', h5d)
        # D6: My pawns "Sees in the dark (ft)" = 60 (the form), synced; the bar's "darkvision 40", undo; the GM's "light radius 30"
        await pl.evaluate(f"tw.settings.editPawn('{DEF}')"); await pl.wait_for_timeout(600)
        has_field = await pl.locator('.mped .mpdark').count()
        await pl.fill('.mped .mpdark', '60'); await pl.click('.mped [data-act=pawn-save]')
        await wait(pl, 'tw.sync.pendingCount() === 0', 15000); await pl.keyboard.press('Escape')
        synced = await wait(gm, f"tw.entities()['{PA}']?.darkvision === 60 && tw.sync.campaign.pawns.find(d => d.id === '{DEF}')?.darkvision === 60", 15000, 'darkvision synced')
        sees45 = await wait(pl, V(47.5, bz), 15000, 'sees 45 ft')
        await pl.evaluate(f"tw.sel.clear(); tw.sel.add('{PA}')")
        await action(pl, f"tw.registry.run('pawn.darkvision', {{ v: 40 }})")
        dv40 = await wait(gm, f"tw.entities()['{PA}']?.darkvision === 40", 10000, 'darkvision 40')
        await action(pl, 'tw.undo()')
        undone = await wait(gm, f"tw.entities()['{PA}']?.darkvision === 60", 10000, 'undo')
        await gm.evaluate(f"tw.sel.clear(); tw.sel.add('{TORCH}')")
        await action(gm, f"tw.registry.run('thing.lightRadius', {{ v: 30 }})")
        lr = await gm.evaluate(f"[tw.entities()['{TORCH}']?.lightRadius, tw.assets.lightRadius(tw.entities()['{TORCH}'])]")
        check(has_field == 1 and synced and sees45 and dv40 and undone and lr == [30, 30],
              'D6 Me > My pawns "Sees in the dark (ft)" 60: on her definition and her pawn in the GM\'s tab; she sees 45 ft; the bar\'s darkvision 40 and undo; the GM\'s light radius 30',
              dict(field=has_field, synced=synced, sees45=sees45, dv40=dv40, undone=undone, light=lr))
        # D7: the GM sees everything; view as the player shows the darkness (Mira back to the default 30 ft first)
        await action(pl, f"tw.dispatch('token.set', {{ id: '{PA}', darkvision: null }})")
        await wait(pl, f"!{V(40, bz)}", 15000, 'darkvision 30 again')
        gmall = await gm.evaluate(f"tw.fog.visible(40, {bz}, 0) && !!tw.worldOf(tw.area()).recs.get('{BD}')?.group.visible && !(tw.worldOf(tw.area()).fx?.fogwar?.enabled)")
        await action(gm, f"tw.registry.run('vision.view.seat.{seat}')")
        asp = await wait(gm, f"tw.fog.active() && tw.fog.visible(10, {dz}, 0) && !tw.fog.visible(40, {bz}, 0) && !!tw.worldOf(tw.area()).fx?.fogwar?.enabled", 20000, 'view as')
        await action(gm, "tw.registry.run('vision.view.gm')")
        check(gmall and asp, 'D7 the GM sees all (no fog pass); "view as" the player shows her darkness', dict(gm=gmall, view_as=asp))
        # D8: darkness off here: plain fog of war again
        await action(gm, "tw.registry.run('area.darkness.off')")
        off = await wait(pl, f"!tw.fog.dark() && tw.fog.visible(40, {bz}, 0) && tw.fog.visible(48, {dz}, 0)", 20000, 'darkness off')
        check(off, 'D8 darkness off here: the player sees the whole hall again (plain fog of war)')
        check(not errors, 'no page errors', errors[:3])
        await browser.close()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    finally:
        for pr in procs: pr.terminate()
        for d in tmp: shutil.rmtree(d, ignore_errors=True)
    n = sum(1 for ok, *_ in results if ok)
    print(f'browser darkness: {n}/{len(results)} passed', flush=True)
    sys.exit(0 if results and n == len(results) else 1)

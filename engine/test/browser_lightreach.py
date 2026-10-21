#!/usr/bin/env python3
"""Light reach (2026-10-21; core/darkness.js lightTable, client/fog.js, surfaces/lightreach.js), end to end in the game.
tw-slot browser-venv/bin/python engine/test/browser_lightreach.py --local [--shots DIR]
A GM and one player. One 60 x 40 ft room, dark, walled all round. Every light the room generator furnished gives no light, so the only one
is the test's small brass oil lamp (lamp-oil-brass) at x 10. The player's pawn Mira stands at x 5 with darkvision 0: she
sees by the lamp only. No house look (the local relay has no ratings server): the game's own table.
  R1  the lamp is a LAMP (not a lantern): 45 ft by default (was 60): 40 ft from it seen, 50 ft not
  R2  a reach slider (the look's `reach.lamp`, set as the tuner panel's slider sets it) changes the fog: 20 -> 15 ft seen,
      25 ft not; "Count dim light" off -> the bright row (lamp 15); Overall light scale 1.5 -> 22.5; back to the look
  R3  a GM's own light radius on the thing still wins over every row (50 ft, dim off)
  R4  "Show light reach" is GM-only: the GM's bar and Settings ▸ Me have it; the player's have neither, and her page
      cannot switch it on
  R5  on, the GM sees the lamp's disc (kind lamp, the effective radius, clipped by the room's walls), and it follows
      the look's table; it stays on after a reload (this browser only); off, nothing is drawn
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request, shutil
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots')
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18343,18943').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-reach-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
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

# the look's params as the tuner's panel leaves them (a slider writes one number into the group; fx.setParams applies it)
LOOK = """(patch) => { const fx = tw.worldOf(tw.area()).fx, p = JSON.parse(JSON.stringify(fx.fogwar.params));
  for (const [g, o] of Object.entries(patch)) p[g] = { ...(p[g] || {}), ...o }; fx.setParams('fogwar', p); return tw.fog.lightTable(); }"""

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    if A.shots: os.makedirs(A.shots, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, ctx=None):
            ctx = ctx or await browser.new_context(viewport={'width': 1400, 'height': 900}, device_scale_factor=1)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e))); await pg.goto(url); return pg
        async def action(pg, code):
            await pg.evaluate(code); await wait(pg, 'tw.sync.pendingCount() === 0', 15000, 'command accepted'); await pg.wait_for_timeout(250)
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', f"TEST light reach {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw?.ready?.() && tw.fog', 90000), 'GM did not come up'
        await gm.evaluate('tw.spawnRoom("common", 0, 0, 12, 8, 8851)')
        await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        # its outside edges all walls (a window or an open doorway lets light out, as in the game: then the disc goes out too)
        await action(gm, "tw.batch([...tw.worldOf(tw.area()).edges.values()].filter(e => e.sides.length === 1).map(e => ({type:'edge.set',args:{key:e.key,as:'wall',piece:'wall-straight'}})))")
        await action(gm, "tw.batch(Object.values(tw.entities()).filter(e => e.kind === 'object' && tw.assets.lightKind(e.cat)).map(e => ({ type: 'object.set', args: { id: e.id, lightRadius: 0 } })))")
        await action(gm, "tw.registry.run('area.darkness.on')")
        LAMP = 'obj_rclamp0001'
        await action(gm, f"tw.dispatch('object.place', {{ id: '{LAMP}', x: 10, z: 20, cat: 'lamp-oil-brass', ...tw.roomgen.sizeOf('lamp-oil-brass') }})")
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        pl = await tab(invite)
        assert await wait(pl, 'window.tw?.ready?.() && tw.fog', 90000), 'player did not join'
        PA = 'tok_rcmira0001'
        seat = await pl.evaluate('tw.me()')
        await action(gm, f"tw.dispatch('token.create', {{ id: '{PA}', name: 'Mira', x: 5, z: 20, owner: '{seat}', darkvision: 0 }})")
        await pl.evaluate("(() => { const fx = tw.worldOf(tw.area()).fx; if (!fx) return; const p = JSON.parse(JSON.stringify(fx.fogwar.params)); p.dark = { ...p.dark, hint: 0 }; fx.setParams('fogwar', p); })()")
        V = lambda x: f"tw.fog.visible({x}, 20, 0)"
        lit = lambda near, far: f"{V(10 + near)} && !{V(10 + far)}"
        # R1: the lamp is a lamp, 45 ft
        r1 = await wait(pl, f"tw.fog.dark() && tw.fog.info().areas.some(a => a.dark) && {lit(40, 50)}", 30000, 'lamp 45')
        k = await pl.evaluate(f"[tw.assets.lightKind('lamp-oil-brass'), tw.assets.lightKind('lamp-pole'), tw.fog.lightsOf().find(L => L.id === '{LAMP}')?.radius, tw.fog.lightTable().lamp]")
        check(r1 and k == ['lamp', 'lantern', 45, 45], 'R1 a brass oil lamp is a lamp (a lamp pole stays a lantern): 45 ft, 40 ft from it seen, 50 ft not', k)
        # R2: the reach slider, Count dim light, Overall light scale
        t20 = await pl.evaluate(LOOK, {'reach': {'lamp': 20}}); s20 = await wait(pl, lit(15, 25), 15000, 'lamp 20')
        tdim = await pl.evaluate(LOOK, {'dark': {'dim': False}}); sdim = await wait(pl, lit(12, 18), 15000, 'bright only 15')
        tsc = await pl.evaluate(LOOK, {'dark': {'scale': 1.5}}); ssc = await wait(pl, lit(20, 25), 15000, 'scale 1.5 -> 22.5')
        check(s20 and t20['lamp'] == 20 and sdim and tdim['lamp'] == 15 and tdim['torch'] == 20 and ssc and tsc['lamp'] == 22.5,
              'R2 the fog follows the look: lamp slider 20 -> 15 ft seen, 25 not; Count dim light off -> bright lamp 15; scale 1.5 -> 22.5', dict(slider=t20['lamp'], dim_off=tdim, scale=tsc['lamp']))
        # R3: a GM's own radius wins (dim off, scale 1.5 still on)
        await action(gm, f"tw.dispatch('object.set', {{ id: '{LAMP}', lightRadius: 50 }})")
        r3 = await wait(pl, lit(45, 55), 15000, 'own radius 50')
        r3r = await pl.evaluate(f"tw.fog.lightsOf().find(L => L.id === '{LAMP}')?.radius")
        check(r3 and r3r == 50, "R3 a GM's own light radius on the thing (50) beats the look's rows and is never scaled", r3r)
        await action(gm, f"tw.dispatch('object.set', {{ id: '{LAMP}', lightRadius: null }})")
        await pl.evaluate(LOOK, {'dark': {'dim': True, 'scale': 1}, 'reach': {'lamp': 45}})
        # R4: GM-only
        has = {n: await pg.evaluate("tw.registry.available().some(c => c.id === 'view.lightReach')") for n, pg in (('gm', gm), ('player', pl))}
        async def settings_row(pg):
            await pg.evaluate("tw.settings.open('me')"); await pg.wait_for_timeout(500)
            n = await pg.locator('[data-lightreach]').count(); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300); return n
        rows = {'gm': await settings_row(gm), 'player': await settings_row(pl)}
        forced = await pl.evaluate("[tw.lightReach(), tw.setLightReach(true, { quiet: true }), tw.lightReach(), tw.lightReachInfo().lights.length]")
        check(has == {'gm': True, 'player': False} and rows == {'gm': 1, 'player': 0} and forced == [False, False, False, 0],
              'R4 "Show light reach" is GM-only: in the GM\'s bar and Settings ▸ Me; not in the player\'s, and her page cannot switch it on', dict(bar=has, settings=rows, player_forced=forced))
        # R5: the GM's view of it (through the Settings switch), the disc follows the table, survives a reload, off = nothing
        await gm.evaluate("tw.settings.open('me')"); await gm.wait_for_timeout(500); await gm.click('[data-lightreach]'); await gm.wait_for_timeout(300); await gm.keyboard.press('Escape')
        await wait(gm, "tw.lightReachInfo().drawn", 10000, 'reach drawn')
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(30, 0, 20); g.yaw = 0; g.pitch = 70; g.dist = 85; g.update(); tw.main.rule = 'free'; })()"); await gm.wait_for_timeout(1200)
        if A.shots: await gm.screenshot(path=os.path.join(A.shots, 'reach-1-gm-lamp.png'))
        info = await gm.evaluate('tw.lightReachInfo()')
        mine = [L for L in info['lights'] if L['id'] == LAMP]
        # the disc is clipped by the room's walls: none of its outline lies outside the 60 x 40 room (+ the wall's half)
        clipped = await gm.evaluate("""(() => { const w = tw.worldOf(tw.area()); let out = 0, n = 0; w.layers.deco.traverse(o => { if (!o.userData.lightReach || !o.geometry?.attributes?.instanceStart) return;
          const a = o.geometry.attributes.instanceStart; for (let i = 0; i < a.count; i++) { n++; const x = a.getX(i), z = a.getZ(i); if (x < -1 || x > 61 || z < -1 || z > 41) out++; } }); return { n, out }; })()""")
        await gm.evaluate(LOOK, {'reach': {'lamp': 20}})
        follow = await wait(gm, f"tw.lightReachInfo().lights.find(L => L.id === '{LAMP}')?.radius === 20", 10000, 'disc follows the table')
        await gm.evaluate(LOOK, {'reach': {'lamp': 45}})
        await gm.reload(); await wait(gm, 'window.tw?.ready?.() && tw.fog', 90000)
        kept = await wait(gm, "tw.lightReach() && tw.lightReachInfo().drawn", 20000, 'kept after reload')
        await gm.evaluate("tw.registry.run('view.lightReach')"); await gm.wait_for_timeout(400)
        off = await gm.evaluate("(() => { let n = 0; tw.worldOf(tw.area()).layers.deco.traverse(o => { if (o.userData.lightReach) n++; }); return [tw.lightReach(), n]; })()")
        await gm.evaluate("tw.setLightReach(false, { quiet: true })")
        check(len(mine) == 1 and mine[0]['kind'] == 'lamp' and mine[0]['radius'] == 45 and 'lamp' in info['sets'] and 'fill' in info['sets'] and clipped['n'] > 20 and clipped['out'] == 0 and follow and kept and off == [False, 0],
              'R5 the GM sees the lamp\'s disc (lamp, 45 ft, clipped by the walls), it follows the table, stays on after a reload; off draws nothing',
              dict(lamp=mine, sets=info['sets'], outline=clipped, follow=follow, kept=kept, off=off))
        check(not errors, 'no page errors', errors[:3])
        await browser.close()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    finally:
        for pr in procs: pr.terminate()
        for d in tmp: shutil.rmtree(d, ignore_errors=True)
    n = sum(1 for ok, *_ in results if ok)
    print(f'browser light reach: {n}/{len(results)} passed', flush=True)
    sys.exit(0 if results and n == len(results) else 1)

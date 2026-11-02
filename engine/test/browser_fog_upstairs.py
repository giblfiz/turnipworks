#!/usr/bin/env python3
"""A PLAYER WHOSE PAWN STANDS ON AN UPPER STOREY, with the view on all levels (2026-11-01, Harry: "Sammy Sample can see the
walls of his room, but none of the objects in the room, and can't see his own pawn").
tw-slot browser-venv/bin/python engine/test/browser_fog_upstairs.py --local [--shots]
A ground room with a guest room over it; the player's pawn and a barrel stand upstairs and the player has never seen the
ground. A new player's view is on all levels (the cut is off), so the fog used to lie on the ground: the atmosphere's depth
pass (fx/atmos.js lowz) drops whatever stands over cells unseen ON ITS LEVEL, and only known walls are excepted, so the
pawn, the barrel and the floor went under the ground's bank while the walls stayed. Tinted, they are counted in pixels.
  U1  the fog lies on the level of the player's own pawn while the view is on all levels (the view itself is not changed)
  U2  the pawn and the barrel upstairs reach the screen for that player
  U3  the pawn comes down: the fog lies on the ground again, and the pawn is on screen
  U6  the pawn goes back up: the fog follows it, and the pawn and the barrel reach the screen again
  U4  SECRECY: a barrel in a never-seen room on the pawn's own storey stays undrawn, and shows no pixels
  U5  the GM's view is unchanged: the fog level stays the ground's with the cut off
"""
import argparse, asyncio, io, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401
tw_sandbox.remove_campaigns()
tw_sandbox.placeholder_pawns(True)  # the game as players get it: the invite puts the pawn down, the arrival centres on it
sys.path.insert(0, HERE); import served  # noqa: E402
SHOTS = os.path.join(HERE, 'shots', 'fog-upstairs')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18317,18917').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-fogup-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False

def pixels(png):
    a = np.asarray(Image.open(io.BytesIO(png)).convert('RGB')).astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return {'magenta': int(((r > 120) & (b > 120) & (g < 110) & (r - g > 60) & (b - g > 60)).sum()), 'green': int(((g > 120) & (r < 110) & (b < 110) & (g - r > 60) & (g - b > 60)).sum())}

TINT = """([ids, col]) => { const w = tw.worldOf(tw.area()); let n = 0; for (const id of ids) { const r = w.recs.get(id); if (!r) continue;
  r.group.traverse(o => { if (!o.isMesh) return; const m = (Array.isArray(o.material) ? o.material[0] : o.material).clone(); m.map = null; m.color?.set(col); if (m.emissive) { m.emissive.set(col); m.emissiveIntensity = 1; } m.needsUpdate = true; o.material = m; n++; }); }
  return n; }"""
COUNT_FRAMES = "(() => { window.__frames = 0; const c = () => { window.__frames++; requestAnimationFrame(c); }; c(); })()"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 800, 'height': 520}, device_scale_factor=1)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e))); await pg.goto(url); await pg.add_style_tag(content='#linkMail{display:none!important}'); return pg  # (the seat-link card would sit over the pawn at this size)
        async def settle(pg, frames=45):
            # the bank is a simulated field: it only rolls back on frames actually drawn, so count frames, not seconds
            start = await pg.evaluate('window.__frames')
            for i in range(400):
                await pg.evaluate("tw.gfx?.wake?.('test')"); await pg.mouse.move(400 + i % 5, 260); await pg.wait_for_timeout(250)
                if await pg.evaluate('window.__frames') - start >= frames: break
        async def shot(pg, name):
            png = await pg.screenshot(timeout=170000)
            if A.shots: open(os.path.join(SHOTS, name + '.png'), 'wb').write(png)
            return png
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', f"TEST fog upstairs {time.strftime('%m-%d %H:%M:%S')} (throwaway)"); await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw?.ready?.() && tw.fog', 150000), 'GM did not come up'
        idle = lambda: wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 170000)
        # the ground room, the guest room over it, and a second, never-seen room on the same upper storey behind a wall
        await gm.evaluate("tw.spawnRoom('common', 0, 0, 10, 4, 7501)"); await idle()
        await gm.evaluate("tw.spawnRoom('guest', 0, 0, 4, 4, 7502, undefined, 10)"); await idle()
        await gm.evaluate("tw.spawnRoom('guest', 6, 0, 4, 4, 7503, undefined, 10)"); await idle()
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Sammy',color:'#e06c75'}))")
        assert invite and not invite.endswith('=null'), 'no invite link'
        await idle(); PAWN = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'token')?.id"); assert PAWN, 'the invite put no pawn on the table'
        NEAR = 'obj_fuupbarrel1'
        FAR = await gm.evaluate("(() => { const E = tw.entities(); return Object.values(E).find(o => o.kind === 'object' && o.room && E[o.room]?.recipe?.x === 6 && (E[o.room]?.recipe?.y || 0) === 10 && o.place !== 'kit')?.id; })()"); assert FAR, 'the second guest room has nothing in it'
        await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{PAWN}', x: 8, z: 10, y: 10 }})")
        await gm.evaluate(f"tw.dispatch('object.place', {{ id: '{NEAR}', x: 13, z: 14, y: 10, cat: 'barrel', ...tw.roomgen.sizeOf('barrel') }})")
        await idle()
        pl = await tab(invite)
        assert await wait(pl, 'window.tw?.ready?.() && tw.fog', 170000), 'player did not join'
        await pl.evaluate(COUNT_FRAMES)
        if not await wait(pl, f"!!tw.entities()['{NEAR}'] && !!tw.entities()['{PAWN}'] && tw.fog.visible(8, 10, 10)", 60000, 'player vision'):
            print('   state', await pl.evaluate(f"(() => {{ const E = tw.entities(), t = E['{PAWN}']; return {{ pawn: t && [t.x, t.y, t.z, t.owner === tw.me()], near: !!E['{NEAR}'], rooms: Object.values(E).filter(e => e.kind === 'room').map(r => [r.recipe.type, r.recipe.x, r.recipe.z, r.recipe.w, r.recipe.d, r.recipe.y || 0]), kinds: Object.values(E).reduce((o, e) => (o[e.kind] = (o[e.kind] || 0) + 1, o), {{}}), level: tw.pawnLevel?.(t), v10: tw.fog.visible(8, 10, 10), v0: tw.fog.visible(8, 10, 0), first: tw.fog.active(tw.area()) }}; }})()"))
            raise AssertionError('player has no vision upstairs')
        state = "(() => { const w = tw.worldOf(tw.area()); return { cut: tw.cut.y, level: tw.level, fogL: w.fogLevel(), base: w.fx?.atmos?.level?.().base ?? null, gfx: tw.prefs?.graphics ?? null }; })()"
        await settle(pl, 20)
        S = await pl.evaluate(state)
        check(S['cut'] is None and S['fogL'] == 10 and S['base'] == 10, 'U1 view on all levels, the fog lies on the level of the player\'s own pawn', S)
        await pl.evaluate(f"([p]) => {{ tw.centreOn({{ x: p, y: 10, z: 12 }}, tw.main, {{ ms: 0 }}); tw.main.grab.dist = 34; tw.main.grab.update(); }}", [10])
        n = await pl.evaluate(TINT, [[PAWN], '#ff00ff']); n2 = await pl.evaluate(TINT, [[NEAR], '#00ff00']); await settle(pl)
        U = pixels(await shot(pl, 'upstairs'))
        check(n > 0 and n2 > 0 and U['magenta'] > 30 and U['green'] > 15, 'U2 the pawn and the barrel upstairs reach the screen', {**U, 'tinted': [n, n2]})
        far = await pl.evaluate(f"!!tw.worldOf(tw.area()).recs.get('{FAR}')?.group.visible")
        await pl.evaluate(TINT, [[FAR], '#ffff00'])
        Y = await pl.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), e = tw.entities()['{FAR}']; return {{ drawn: !!w.recs.get('{FAR}')?.group.visible, seen: !!e && tw.fog.visible(e.x, e.z, 10), at: e && [e.x, e.y, e.z] }}; }})()")
        check(not far and not Y['drawn'] and not Y['seen'], 'U4 a never-seen room on the same storey stays undrawn', Y)
        await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{PAWN}', x: 25, z: 10, y: 0 }})")  # (the gap between the upper rooms: under a floor it has seen a pawn is hidden by that floor, and offered "Cut to lv 1")
        assert await wait(pl, f"(tw.entities()['{PAWN}'].y || 0) === 0 && tw.sync.pendingCount() === 0", 30000, 'pawn down')
        await settle(pl, 20); await pl.evaluate("tw.centreOn({ x: 25, y: 0, z: 10 }, tw.main, { ms: 0 })"); await settle(pl)
        S2 = await pl.evaluate(state); D = pixels(await shot(pl, 'ground'))
        check(S2['fogL'] == 0 and S2['base'] == 0 and D['magenta'] > 30, 'U3 the pawn comes down: the fog lies on the ground, the pawn on screen', {**S2, **D})
        await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{PAWN}', x: 8, z: 10, y: 10 }})")
        assert await wait(pl, f"tw.entities()['{PAWN}'].y === 10 && tw.sync.pendingCount() === 0", 30000, 'pawn up')
        await settle(pl, 20); await pl.evaluate("tw.centreOn({ x: 10, y: 10, z: 12 }, tw.main, { ms: 0 })"); await settle(pl, 90)
        S3 = await pl.evaluate(state); B = pixels(await shot(pl, 'back-up'))
        check(S3['fogL'] == 10 and B['magenta'] > 30 and B['green'] > 15, 'U6 the pawn goes back up: the fog follows, pawn and barrel on screen', {**S3, **B})
        G = await gm.evaluate(state)
        check(G['fogL'] == 0, 'U5 the GM\'s fog level with the cut off is still the ground', G)
        check(not errors, 'no page errors', errors[:3])
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
bad = [r for r in results if not r[0]]
print(f"{len(results) - len(bad)}/{len(results)} passed"); sys.exit(1 if bad or not results else 0)

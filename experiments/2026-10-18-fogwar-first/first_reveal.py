#!/usr/bin/env python3
"""First reveal in the GAME (2026-10-18, Harry: "an instant snap to 'remembered', then the remembered fog rolls out").
A GM and a fresh player; rooms A | B, closed door; the player's pawn by the door in A, B never seen. The GM opens the
door; the player's screen is captured at t = 0, 0.25, 0.5, 1, 2, 4 s, with the bank density and the sight clock at a
cell in B, and an in-frame A/B of a magenta barrel left in never-seen room C at 0.25 s.
  tw-slot browser-venv/bin/python first_reveal.py OUTDIR --local     (local relay; house look via the live ratings API, sandboxed)
  tw-slot browser-venv/bin/python first_reveal.py OUTDIR --page https://turnipworks.net/
"""
import asyncio, json, os, sys, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
REPO = '<repo>'
sys.path.insert(0, os.path.join(REPO, 'engine/test')); sys.argv = [sys.argv[0], *sys.argv[1:]]
OUT = sys.argv[1]; LOCAL = '--local' in sys.argv; PAGE = sys.argv[sys.argv.index('--page') + 1] if '--page' in sys.argv else None
sys.argv = [sys.argv[0]] + (['--local'] if LOCAL else ['--page', PAGE])
os.environ.setdefault('TW_PORTS', '18305,18905')
import browser_fogwar_game as G  # noqa: E402  (its servers, waits and the sandbox; its own main() is not run)
os.makedirs(OUT, exist_ok=True)

async def main():
    page = G.start_local().replace('&api=', '') if LOCAL else PAGE + ('&' if '?' in PAGE else '?') + 'nointro'
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', *G.GL, '--disable-background-timer-throttling', '--disable-renderer-backgrounding'])
        async def tab(url):
            ctx = await b.new_context(viewport={'width': 1400, 'height': 900}, device_scale_factor=1); pg = await ctx.new_page()
            if LOCAL: await G.tw_sandbox.aproxy(pg, 'http://127.0.0.1:8096')
            await pg.goto(url); return pg
        async def act(pg, code): await pg.evaluate(code); await G.wait(pg, 'tw.sync.pendingCount() === 0', 15000); await pg.wait_for_timeout(250)
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', f"TEST first reveal {time.strftime('%H:%M:%S')} (throwaway)"); await gm.click('#newCampaign button')
        await G.wait(gm, 'window.tw?.ready?.() && tw.fog', 90000)
        inv = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        pl = await tab(inv); await G.wait(pl, 'window.tw?.ready?.() && tw.fog', 90000); seat = await pl.evaluate('tw.me()')
        for x in [0, 4, 8]:
            await gm.evaluate('(x) => tw.spawnRoom("common", x, 0, 4, 4, 7501+x)', x)
            await G.wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        await act(gm, "tw.batch([...tw.worldOf(tw.area()).edges.values()].filter(e => e.sides.length === 1).map(e => ({type:'edge.set',args:{key:e.key,as:'wall',piece:'wall-straight'}})))")
        door = await gm.evaluate("(() => { const e=[...tw.worldOf(tw.area()).edges.values()].find(e => e.kind==='door' && e.sides.length===2 && e.key.startsWith('v:4:')); return e ? {key:e.key, z:+e.key.split(':')[2]*5+2.5} : null; })()")
        z = door['z']
        await act(gm, 'tw.batch(' + json.dumps([{'type': 'token.create', 'args': {'id': 'tok_frmira0001', 'name': 'Mira', 'x': 16.5, 'z': z, 'owner': seat}}]) + ')')
        await act(gm, "tw.dispatch('object.place', { id: 'obj_frbarrel001', x: 52.5, z: 6.5, cat: 'barrel', ...tw.roomgen.sizeOf('barrel') })")
        await pl.evaluate("tw.settings.setGfx('medium')")
        await G.wait(pl, f"tw.fog.visible(16.5,{z},0) && !tw.fog.visible(30,{z},0)", 30000)
        await pl.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set(24, 0, 10); g.yaw = 0; g.pitch = 55; g.dist = 58; g.update(); tw.main.rule = 'free'; }})()")
        await pl.wait_for_timeout(4000)
        await pl.evaluate(G.TINT, ['obj_frbarrel001'])
        probe = f"""(() => {{ const a = tw.worldOf(tw.area()).fx.atmos, f = a.readField('density'); const out = []; for (const [x, zz] of [[26, {z}], [31, {z} + 3]]) {{ const [i, j] = a.cellOf(x, zz, f.w, f.h); const o = (j * f.w + i) * 4; out.push([+f.data[o + 1].toFixed(2), +f.data[o + 3].toFixed(2)]); }} return out; }})()"""
        AB = """() => { const w = tw.worldOf(tw.area()), r = w.recs.get('obj_frbarrel001'), cv = document.querySelector('#c'), gl = cv.getContext('webgl2'); if (!r) return 'not drawn';
          const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, shot = () => { tw.gfx?.renderNow ? tw.gfx.renderNow() : w.fx.render(0); const a = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
          const was = r.group.visible; r.group.visible = true; const A = shot(); r.group.visible = false; const B = shot(); r.group.visible = was; let d = 0;
          for (let i = 0; i < A.length; i += 4) if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > 2) d++; return d; }"""
        series = []; ab = None
        await gm.evaluate(f"tw.toggleOpen(tw.wallItem('wall:{door['key']}'))")
        t0 = time.time()
        for t in [0, 0.25, 0.5, 1, 2, 4]:
            while time.time() - t0 < t: await asyncio.sleep(0.01)
            png = await pl.screenshot(); open(os.path.join(OUT, f'reveal-{t}.png'), 'wb').write(png)
            series.append({'t': t, 'at': round(time.time() - t0, 2), 'heavy_clock': await pl.evaluate(probe), 'B_visible': await pl.evaluate(f"tw.fog.visible(26,{z},0)")})
            if t == 0.25: ab = await pl.evaluate(AB)
        json.dump({'series': series, 'midRevealAB_barrelC': ab, 'house': await pl.evaluate("tw.worldOf(tw.area()).fx.fogwar.params.name")}, open(os.path.join(OUT, 'first_reveal.json'), 'w'), indent=1)
        print(json.dumps(series), 'AB', ab, flush=True)
        await b.close()
try: asyncio.run(main())
finally:
    for pr in G.procs: pr.terminate()

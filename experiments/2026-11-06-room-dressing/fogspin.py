#!/usr/bin/env python3
"""FOG SPIN (2026-11-06, Nick 11-01: fog of war "a little janky while the view rotates"). A GM and a player; three rooms in
a row (A | B | C), the player's pawn in A. In the PLAYER's tab the camera yaws round in small steps, one per drawn frame,
and every frame records what the fog did: setState calls (a new mask uploaded = a 0.42 s cross-fade), the fog pass's
transition flag, the worker's messages, the cut, the level the fog lies on, how many walls are drawn / known, how many
things the fog hides. Prints a per-frame summary of anything that changed while ONLY the camera moved.
  python3 experiments/2026-11-06-room-dressing/fogspin.py [--frames 180] [--step 2] [--shots DIR]
Ports: TW_PORTS (default 23407,23408)."""
import argparse, asyncio, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('TW_PORTS', '23407,23408')
import measure  # noqa: E402
from playwright.async_api import async_playwright

HOOK = """(() => { const w = tw.worldOf(tw.area()), fx = w.fx.fogwar, log = window.__fogLog = { setState: [], posts: 0, msgs: 0 };
  const ss = fx.setState.bind(fx); fx.setState = (st) => { log.setState.push({ t: performance.now(), snap: !!st.snap, enabled: st.enabled, rev: st.revision, levels: st.levels?.length ?? null, floorY: st.floorY }); return ss(st); };
  return true; })()"""
SAMPLE = """(() => { const w = tw.worldOf(tw.area()), fx = w.fx.fogwar, st = fx.stats(), g = tw.main.grab, info = tw.fog.info().areas[0] || {};
  let walls = 0, hidden = 0; for (const s of w.shell.values()) if (s.spec.layer === 'walls' && s.group?.visible) walls++;
  for (const r of w.recs.values()) if (r.group && !r.group.visible) hidden++;
  return { yaw: +g.yaw.toFixed(2), setStates: window.__fogLog.setState.length, transition: st.fogwar_transition, uploads: st.fogwar_uploads, known: st.fogwar_known, flyers: st.fogwar_flyers,
    zoom: w.fx.atmos?.stats().atmos_zoom_step ?? null, zooms: w.fx.atmos?.stats().atmos_zooms ?? null, shifts: w.fx.atmos?.stats().atmos_shifts ?? null, xfade: w.fx.atmos?.stats().atmos_xfade ?? null, win: w.fx.atmos?.stats().atmos_window_ft ?? null, t: performance.now(),
    cut: w.cut ?? null, cutGen: w.cutGen || 0, fogLevel: w.fogLevel?.() ?? null, walls, hidden, pending: !!info.pending, totalMs: info.totalMs ?? null, frame: tw.gfx?.frames?.() ?? null }; })()"""
SPIN = """async ([n, step, sample]) => { const g = tw.main.grab, out = []; const S = eval(sample);
  for (let i = 0; i < n; i++) { g.yaw = ((g.yaw + step + 540) % 360) - 180; g.update(); tw.gfx?.wake?.('test');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); out.push(S()); }
  return out; }"""

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--frames', type=int, default=180); ap.add_argument('--step', type=float, default=2); ap.add_argument('--shots'); ap.add_argument('--gfx', default='medium')
    A = ap.parse_args(); page = measure.start_local(); res = {}
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch(headless=True, args=['--no-sandbox', *measure.GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
            async def tab(url):
                pg = await (await br.new_context(viewport={'width': 1400, 'height': 900})).new_page(); await measure.tw_sandbox.aproxy(pg, 'http://127.0.0.1:8096'); await pg.goto(url, timeout=180000); return pg
            async def idle(pg): await pg.wait_for_function('tw.sync.pendingCount() === 0', timeout=30000); await pg.wait_for_timeout(250)
            gm = await tab(page)
            await gm.fill('#newCampaign input[name=gm]', 'Harry')
            await gm.fill('#newCampaign input[name=name]', f"TEST fogspin {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
            await gm.click('#newCampaign button'); await gm.wait_for_function('window.tw?.ready?.() && tw.fog', timeout=90000)
            invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
            pl = await tab(invite); await pl.wait_for_function('window.tw?.ready?.() && tw.fog', timeout=90000)
            seat = await pl.evaluate('tw.me()')
            for x in [0, 4, 8]:
                await gm.evaluate('(x) => tw.spawnRoom("common", x, 0, 4, 4, 7401+x)', x)
                await gm.wait_for_function('tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', timeout=120000)
            await gm.evaluate("tw.registry.run('area.fogOfWar.on')"); await idle(gm)
            await gm.evaluate("tw.dispatch('token.create', { id: 'tok_spinmira01', name: 'Mira', x: 7.5, z: 10, owner: '" + seat + "' })"); await idle(gm)
            await pl.evaluate(f"tw.settings.setGfx('{A.gfx}')")
            await pl.wait_for_function("tw.fog.visible(7.5,10,0) && !tw.fog.visible(50,10,0)", timeout=60000)
            await pl.evaluate("(() => { const g = tw.main.grab; g.focus.set(20, 0, 10); g.yaw = 0; g.pitch = 50; g.dist = 55; g.update(); tw.main.rule = 'free'; })()")
            await pl.wait_for_timeout(4000)
            await pl.evaluate(HOOK)
            still = await pl.evaluate(SPIN, [30, 0, SAMPLE[:-2]])  # 30 frames with the camera still: the baseline
            spin = await pl.evaluate(SPIN, [A.frames, A.step, SAMPLE[:-2]])
            if A.shots:
                os.makedirs(A.shots, exist_ok=True)
                await pl.evaluate("(() => { const g = tw.main.grab; g.yaw = 0; g.update(); })()"); await pl.wait_for_timeout(1500)
                for i in range(12):
                    await pl.evaluate(f"(() => {{ const g = tw.main.grab; g.yaw = {i * 7.5}; g.update(); }})()"); await pl.wait_for_timeout(30)
                    await pl.screenshot(path=os.path.join(A.shots, f'spin{i:02d}.png'))
            log = await pl.evaluate('window.__fogLog')
            res = {'still': still, 'spin': spin, 'log': log}
            await br.close()
    finally:
        for pr in measure.procs: pr.kill()
    def changes(rows, label):
        keys = ['setStates', 'transition', 'uploads', 'known', 'cut', 'cutGen', 'fogLevel', 'walls', 'hidden', 'pending', 'zoom', 'zooms', 'win']
        prev = rows[0]; print(f'--- {label}: {len(rows)} frames; first {json.dumps({k: prev[k] for k in keys})}')
        n = 0
        for r in rows[1:]:
            d = {k: (prev[k], r[k]) for k in keys if r[k] != prev[k]}
            if d: n += 1; print(f'  yaw {r["yaw"]:7.2f}: ' + ', '.join(f'{k} {a}->{b}' for k, (a, b) in d.items()))
            prev = r
        print(f'  {n} frames with a change')
    changes(res['still'], 'camera still'); changes(res['spin'], f'camera yawing {A.step} deg a frame')
    print('setState calls:', len(res['log']['setState']), res['log']['setState'][:12])
    json.dump(res, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fogspin.last.json'), 'w'), indent=0)

asyncio.run(main())

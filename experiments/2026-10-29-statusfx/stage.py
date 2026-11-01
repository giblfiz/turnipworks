#!/usr/bin/env python3
"""A busy table for looking at conditions: a common room, twelve figure pawns with stacked conditions, stills from table
distance (high and low), lit and dark. Also measures frame time with and without the conditions.
  TW_PORTS=a,b browser-venv/bin/python stage.py [--page URL] [--shots DIR] [--art frightened:frightened-bang,...] [--perf]"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request, socket
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.environ.get('TW_REPO') or os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox; tw_sandbox.remove_campaigns()
ap = argparse.ArgumentParser(); ap.add_argument('--page'); ap.add_argument('--shots', default=os.path.join(HERE, 'shots')); ap.add_argument('--art', default=''); ap.add_argument('--perf', action='store_true'); ap.add_argument('--tag', default=''); ap.add_argument('--n', type=int, default=0)
A = ap.parse_args()
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18471,18472').split(','))
procs = []
def start_local():
    for port in (RP, SP):
        with socket.socket() as sk:
            if sk.connect_ex(('127.0.0.1', port)) == 0: sys.exit(f'port {port} in use')
    data = tempfile.mkdtemp(prefix='tw-sfx-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=open(os.path.join(data, 'relay.log'), 'a'), stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'
FIGS = ['hero-fighter-dwarf-m', 'hero-wizard-elf-f', 'hero-rogue-halfling-m', 'hero-cleric-human-f', 'mon-goblin', 'mon-orc', 'mon-kobold', 'mon-skeleton', 'hero-ranger-elf-m', 'hero-paladin-human-m', 'mon-bandit', 'town-human-commoner-m']
SETS = [['prone'], ['charmed'], ['stunned', 'poisoned'], ['unconscious'], ['frightened', 'blinded', 'grappled'], ['restrained', 'paralyzed', 'Hexed', 'charmed', 'stunned', 'deafened'],
        ['dead'], ['invisible'], ['exhaustion 3', 'concentrating'], ['incapacitated', 'exhaustion 6'], ['Hexed', 'Blessed'], []]
async def main():
    page = A.page or start_local()
    if A.art: page += ('&' if '?' in page else '?') + 'statusart=' + A.art
    os.makedirs(A.shots, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
        ctx = await b.new_context(viewport={'width': 1280, 'height': 820}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        await pg.goto(page)
        await pg.fill('#newCampaign input[name=gm]', 'Harry'); await pg.fill('#newCampaign input[name=name]', f'TEST statusfx stage {time.strftime("%H:%M:%S")} (throwaway)'); await pg.click('#newCampaign button')
        await pg.wait_for_function('window.tw?.ready?.()', timeout=120000)
        await pg.evaluate('tw.spawnRoom("common", 0, 0, 8, 6, 7711)')
        await pg.wait_for_function('tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', timeout=120000)
        figs = await pg.evaluate("Object.values(tw.assets.figures.byId ? Object.fromEntries(tw.assets.figures.byId) : {}).map(f => f.id)")
        want = [f for f in FIGS if f in figs]; extra = [f for f in figs if f.startswith('hero-')][:12]
        use = (want + extra)[:12]
        n = A.n or 12; ops = []
        for i in range(n):
            x = 5 + (i % 4) * 8.75; z = 6 + (i // 4) * 8.75 if n <= 12 else 2.5 + (i // 8) * 5
            if n > 12: x = 2.5 + (i % 8) * 5
            ops.append({'type': 'token.create', 'args': {'id': f'tok_sfx{i:07d}', 'name': f'P{i}', 'x': x, 'z': z, 'fig': use[i % len(use)], 'conditions': [] if A.tag.startswith('none') else SETS[i % len(SETS)]}})
        await pg.evaluate('ops => tw.batch(ops)', ops)
        await pg.wait_for_function('tw.sync.pendingCount() === 0', timeout=30000); await pg.wait_for_timeout(4000)
        info = await pg.evaluate("Object.fromEntries(Object.values(tw.entities()).filter(e => e.kind === 'token').map(e => [e.name, tw.statusInfo?.(e.id)]))")
        print(json.dumps(tw_counts := await pg.evaluate('tw.statusCounts?.()')))
        if A.perf:
            await pg.evaluate("(() => { const g = tw.main.grab; g.focus.set(17.5, 0, 14); g.dist = 60; g.pitch = 55; g.yaw = 20; g.update(); })()")
            await pg.wait_for_timeout(1500)
            ms = await pg.evaluate("""() => new Promise(res => { const w = tw.worldOf(tw.area()), f0 = w.frame.bind(w), cpu = [], t = []; w.frame = (...a) => { const s = performance.now(); const r = f0(...a); cpu.push(performance.now() - s); return r; };
              tw.gfxForce = true; tw.gfx.timing(true); tw.gfx.clearGpu(); let last = performance.now(), n = 0; const rend = []; let acc = 0; const gl = [...document.querySelectorAll('canvas')].map(c => c.getContext('webgl2')).find(Boolean); const fxr = w.fx && w.fx.render.bind(w.fx); if (fxr) w.fx.render = (...a) => { const s = performance.now(); const r = fxr(...a); gl?.finish(); acc += performance.now() - s; return r; };
              const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? +b[b.length >> 1].toFixed(3) : null; }, p90 = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? +b[Math.floor(b.length * 0.9)].toFixed(3) : null; };
              const f = (now) => { t.push(now - last); last = now; rend.push(acc); acc = 0; if (++n < 400) requestAnimationFrame(f); else { w.frame = f0; if (fxr) w.fx.render = fxr; const g = tw.gfx.gpuSamples(); res({ raf: med(t.slice(60)), renderFinish: med(rend.slice(60)), renderFinishP90: p90(rend.slice(60)), worldFrameCpu: med(cpu.slice(60)), worldFrameCpuP90: p90(cpu.slice(60)), gpu: med(g.slice(20)), gpuP90: p90(g.slice(20)), gpuN: g.length, counts: tw.statusCounts?.() || null }); } }; requestAnimationFrame(f); })""")
            print('PERF', A.tag, json.dumps(ms))
        else:
            views = [('high-lit', 55, 0, 46), ('low-lit', 22, 35, 40), ('table-lit', 42, -25, 60), ('close', 35, 15, 26)]
            for name, pitch, yaw, dist in views:
                await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set(17.5, 0, 14); g.dist = {dist}; g.pitch = {pitch}; g.yaw = {yaw}; g.update(); }})()")
                await pg.wait_for_timeout(1800)
                await pg.screenshot(path=os.path.join(A.shots, f'{A.tag}{name}.png'))
            # DARKNESS as a PLAYER sees it (the GM side sees through it): a player who owns half the pawns, darkvision 60
            seat = await pg.evaluate("async () => (await tw.createSeat({ kind: 'human', role: 'player', name: 'Mira', color: '#67aadd' }))")
            await pg.wait_for_timeout(800); sid = await pg.evaluate("tw.sync.campaign.seats.find(s => s.name === 'Mira')?.id")
            invite = await pg.evaluate("s => tw.inviteLink(s)", seat)
            await pg.evaluate("ops => tw.batch(ops)", [{'type': 'token.owner', 'args': {'id': f'tok_sfx{i:07d}', 'owner': sid}} for i in range(0, n, 2)])
            await pg.wait_for_function('tw.sync.pendingCount() === 0', timeout=30000)
            await pg.evaluate("ops => tw.batch(ops)", [{'type': 'token.set', 'args': {'id': f'tok_sfx{i:07d}', 'darkvision': 60}} for i in range(0, n, 2)])
            await pg.evaluate("tw.sync.submit('area.set', { area: tw.area(), settings: { darkness: true, light: 'night' } })")
            await pg.wait_for_function('tw.sync.pendingCount() === 0', timeout=30000)
            pl = await (await b.new_context(viewport={'width': 1280, 'height': 820})).new_page(); pl.on('pageerror', lambda e: errs.append('player: ' + str(e)))
            await pl.goto(invite); await pl.wait_for_function('window.tw?.ready?.()', timeout=120000); await pl.wait_for_timeout(15000)
            for name, pitch, yaw, dist in [('high-dark', 55, 0, 46), ('low-dark', 24, 30, 40), ('player-lit-table', 42, -25, 60)]:
                if name == 'player-lit-table': await pg.evaluate("tw.sync.submit('area.set', { area: tw.area(), settings: { darkness: false, light: 'day' } })"); await pl.wait_for_timeout(3000)
                await pl.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set(17.5, 0, 14); g.dist = {dist}; g.pitch = {pitch}; g.yaw = {yaw}; g.update(); }})()")
                await pl.wait_for_timeout(4000)
                await pl.screenshot(path=os.path.join(A.shots, f'{A.tag}{name}.png'))
        print(json.dumps(info, indent=0)[:3000])
        print('ERRORS', errs[:10])
        await b.close()
    for pr in procs: pr.terminate()
try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass

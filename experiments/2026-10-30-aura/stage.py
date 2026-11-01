#!/usr/bin/env python3
"""A table for looking at auras (client/aurafx.js): a common room, the five levels in a row (gold), then a row of colours,
stills at table distance by day and by night; --perf: frame time and draw calls with 48 pawns all wearing auras.
  TW_PORTS=a,b browser-venv/bin/python stage.py [--page URL] [--shots DIR] [--tag T] [--perf] [--n 48] [--q aura=k:v]
  --scene levels | colours | single (one pawn per still, levels 0..5) | fpv"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request, socket
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.environ.get('TW_REPO') or os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox; tw_sandbox.remove_campaigns()
ap = argparse.ArgumentParser(); ap.add_argument('--page'); ap.add_argument('--shots', default=os.path.join(HERE, 'shots')); ap.add_argument('--perf', action='store_true')
ap.add_argument('--tag', default=''); ap.add_argument('--n', type=int, default=48); ap.add_argument('--q', default=''); ap.add_argument('--scene', default='levels'); ap.add_argument('--none', action='store_true')
ap.add_argument('--still', action='store_true')
A = ap.parse_args()
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18731,18732').split(','))
procs = []
def start_local():
    for port in (RP, SP):
        with socket.socket() as sk:
            if sk.connect_ex(('127.0.0.1', port)) == 0: sys.exit(f'port {port} in use')
    data = tempfile.mkdtemp(prefix='tw-aura-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=open(os.path.join(data, 'relay.log'), 'a'), stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'
FIGS = ['hero-fighter-dwarf-m', 'hero-wizard-elf-f', 'hero-rogue-halfling-m', 'hero-cleric-human-f', 'hero-paladin-human-m', 'hero-ranger-elf-m', 'mon-orc', 'mon-goblin', 'mon-skeleton', 'mon-bandit', 'town-human-commoner-m']
COLS = ['gold', 'silver', 'blue', 'green', 'red', 'violet']
async def look(pg, fx, fz, dist, pitch, yaw):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({fx}, 0, {fz}); g.dist = {dist}; g.pitch = {pitch}; g.yaw = {yaw}; g.update(); }})()")
async def main():
    page = A.page or start_local()
    if A.q: page += ('&' if '?' in page else '?') + A.q
    os.makedirs(A.shots, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
        ctx = await b.new_context(viewport={'width': 1280, 'height': 820}, reduced_motion='reduce' if A.still else 'no-preference'); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        await pg.goto(page)
        await pg.fill('#newCampaign input[name=gm]', 'Harry'); await pg.fill('#newCampaign input[name=name]', f'TEST aura stage {time.strftime("%H:%M:%S")} (throwaway)'); await pg.click('#newCampaign button')
        await pg.wait_for_function('window.tw?.ready?.()', timeout=120000)
        await pg.evaluate('tw.spawnRoom("common", 0, 0, 9, 6, 7711)')
        await pg.wait_for_function('tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', timeout=120000)
        # (the furniture out: nothing in front of the pawns but the floor)
        await pg.evaluate("tw.batch(Object.values(tw.entities()).filter(e => e.kind === 'object' && !/door|window|wall/.test(e.cat || '')).map(e => ({ type: 'object.delete', args: { id: e.id } })))")
        await pg.wait_for_function('tw.sync.pendingCount() === 0', timeout=30000)
        figs = await pg.evaluate("tw.assets.figures.list.map(f => f.id)")
        use = [f for f in FIGS if f in figs] + [f for f in figs if f.startswith('hero-')]
        ops = []
        if A.perf:
            for i in range(A.n):
                x = 2.5 + (i % 8) * 5; z = 2.5 + (i // 8) * 5
                ops.append({'type': 'token.create', 'args': {'id': f'tok_aur{i:07d}', 'name': f'P{i}', 'x': x, 'z': z, 'fig': use[i % len(use)], **({} if A.none else {'aura': {'level': 1 + i % 5, 'color': COLS[i % 6]}})}})
        elif A.scene == 'levels':  # row 1: levels 0..5 gold; row 2: level 3 in the six colours; row 3: level 4/5 blue, red, violet
            for i in range(6): ops.append({'type': 'token.create', 'args': {'id': f'tok_aurl{i:06d}', 'name': f'L{i}', 'x': 7.5 + i * 5, 'z': 7.5, 'fig': use[i % len(use)], **({'aura': {'level': i, 'color': 'gold'}} if i else {})}})
            for i, c in enumerate(COLS): ops.append({'type': 'token.create', 'args': {'id': f'tok_aurc{i:06d}', 'name': c, 'x': 7.5 + i * 5, 'z': 17.5, 'fig': use[(i + 3) % len(use)], 'aura': {'level': 3, 'color': c}}})
        elif A.scene == 'single':
            ops.append({'type': 'token.create', 'args': {'id': 'tok_aursingle01', 'name': 'Brakka', 'x': 22.5, 'z': 12.5, 'fig': use[0]}})
        # (every pawn the player's: a blue seat rim, never the GM's yellow one beside a gold aura: round 4 read it as the aura)
        mseat = await pg.evaluate("async () => (await tw.createSeat({ kind: 'human', role: 'player', name: 'Mira', color: '#67aadd' }))")
        await pg.wait_for_timeout(800); msid = await pg.evaluate("tw.sync.campaign.seats.find(s => s.name === 'Mira')?.id")
        if not A.perf:
            for o in ops: o['args']['owner'] = msid
        await pg.evaluate('ops => tw.batch(ops)', ops)
        await pg.wait_for_function('tw.sync.pendingCount() === 0', timeout=30000); await pg.wait_for_timeout(5000)
        if A.perf:
            await look(pg, 20, 17.5, 60, 55, 20); await pg.wait_for_timeout(1500)
            ms = await pg.evaluate("""() => new Promise(res => { const w = tw.worldOf(tw.area()), f0 = w.frame.bind(w), cpu = []; w.frame = (...a) => { const s = performance.now(); const r = f0(...a); cpu.push(performance.now() - s); return r; };
              let last = performance.now(), n = 0; const t = [], rend = []; let acc = 0; const gl = [...document.querySelectorAll('canvas')].map(c => c.getContext('webgl2')).find(Boolean); const fxr = w.fx && w.fx.render.bind(w.fx); if (fxr) w.fx.render = (...a) => { const s = performance.now(); const r = fxr(...a); gl?.finish(); acc += performance.now() - s; return r; };
              const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? +b[b.length >> 1].toFixed(3) : null; }, p90 = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? +b[Math.floor(b.length * 0.9)].toFixed(3) : null; };
              const ren = tw.renderer || null;
              const f = (now) => { t.push(now - last); last = now; rend.push(acc); acc = 0; if (++n < 400) requestAnimationFrame(f); else { w.frame = f0; if (fxr) w.fx.render = fxr; res({ raf: med(t.slice(60)), renderFinish: med(rend.slice(60)), renderFinishP90: p90(rend.slice(60)), worldFrameCpu: med(cpu.slice(60)), worldFrameCpuP90: p90(cpu.slice(60)), aura: tw.auraCounts?.() || null }); } }; requestAnimationFrame(f); })""")
            print('PERF', A.tag, json.dumps(ms))
        elif A.scene == 'single':
            for L in range(6):
                await pg.evaluate("L => tw.sync.submit('token.set', { id: 'tok_aursingle01', aura: { level: L, color: 'gold' } }, tw.area())", L)
                await pg.wait_for_timeout(1500); await look(pg, 22.5, 14, 46, 42, 0); await pg.wait_for_timeout(1200)
                await pg.screenshot(path=os.path.join(A.shots, f'{A.tag}single-L{L}.png'))
        else:
            views = [('table', 20, 13, 62, 48, 0), ('high', 20, 13, 50, 62, 15), ('low', 20, 12, 38, 24, -20)]
            for name, fx, fz, dist, pitch, yaw in views:
                await look(pg, fx, fz, dist, pitch, yaw); await pg.wait_for_timeout(2200)
                await pg.screenshot(path=os.path.join(A.shots, f'{A.tag}{name}-day.png'))
            # NIGHT as a PLAYER sees it (the GM side sees through darkness): she owns the back row, darkvision 30
            invite = await pg.evaluate("s => tw.inviteLink(s)", mseat)
            await pg.evaluate("ops => tw.batch(ops)", [{'type': 'token.set', 'args': {'id': f'tok_aurl{i:06d}', 'darkvision': 30}} for i in range(6)])
            await pg.evaluate("tw.sync.submit('area.set', { area: tw.area(), settings: { darkness: true, light: 'night' } })")
            await pg.wait_for_function('tw.sync.pendingCount() === 0', timeout=30000)
            pl = await (await b.new_context(viewport={'width': 1280, 'height': 820})).new_page(); pl.on('pageerror', lambda e: errs.append('player: ' + str(e)))
            await pl.goto(invite); await pl.wait_for_function('window.tw?.ready?.()', timeout=120000); await pl.wait_for_timeout(15000)
            for name, fx, fz, dist, pitch, yaw in views[:2]:
                await look(pl, fx, fz, dist, pitch, yaw); await pl.wait_for_timeout(3000)
                await pl.screenshot(path=os.path.join(A.shots, f'{A.tag}{name}-night.png'))
        print(json.dumps(await pg.evaluate("tw.auraCounts?.()")))
        print(json.dumps(await pg.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').slice(0, 14).map(e => [e.name, tw.auraInfo?.(e.id)])"))[:2500])
        print('ERRORS', errs[:10])
        await b.close()
    for pr in procs: pr.terminate()
try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass

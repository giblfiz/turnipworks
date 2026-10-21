#!/usr/bin/env python3
"""Ring Lab design table, darkness in fog of war, as Foggybottom's player sees it: before / after (2026-10-21).
tw-slot browser-venv/bin/python experiments/2026-10-21-light-reach/stills.py OUTDIR

A COPY of the dev campaign (cmp_q2bjx70ajq, area_kli7phtcd2) on a throwaway local relay (read-only on dev). No house look
(no ratings server): the game's own table. "Before" is today's table reproduced exactly (the lamp row set to 60, which is
what every lamp got as a lantern until now); "after" is the new default (lamp 45) and Count dim light off (bright only).
Also the GM's "Show light reach" over the same view, and which lights reach the yard's flowerbed (lights.json).
"""
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
CID, AREA, SRC = 'cmp_q2bjx70ajq', 'area_kli7phtcd2', '/var/lib/tw-relay-dev/data'
RP, SP = 18345, 18945
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
procs, tmp = [], []

def setup():
    data = tempfile.mkdtemp(prefix='tw-rl-'); site = tempfile.mkdtemp(prefix='tw-rl-site-'); tmp.extend([data, site])
    shutil.copytree(os.path.join(SRC, CID), os.path.join(data, CID), ignore=shutil.ignore_patterns('*.pre-areas'))
    with open(os.path.join(data, 'secret'), 'w') as f: f.write(os.urandom(32).hex())
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    # the seats' links, minted with this copy's own key
    js = f"""import {{ makeTokens }} from '{ENGINE}/relay/tokens.js'; import {{ CampaignRuntime }} from '{ENGINE}/relay/campaign.js'; import fs from 'node:fs';
      const t = makeTokens(fs.readFileSync('{data}/secret', 'utf8').trim()); const rt = new CampaignRuntime({{ id: '{CID}', dir: '{data}/{CID}', tokens: t, log: () => {{}} }}); rt.load();
      const seats = Object.values(rt.state.seats); const fb = Object.values(rt.state.areas['{AREA}'].entities).find(e => e.name === 'Foggybottom');
      console.log(JSON.stringify({{ gm: t.mint('{CID}', seats.find(s => s.role === 'gm' && s.kind === 'human')), player: t.mint('{CID}', seats.find(s => s.id === fb.owner)), pawn: {{ x: fb.x, z: fb.z, id: fb.id, dv: fb.darkvision }} }}));"""
    info = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', js]))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(150):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    base = f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro'
    return base, info

LOOK = """(patch) => { const fx = tw.worldOf(tw.area()).fx, p = JSON.parse(JSON.stringify(fx.fogwar.params));
  for (const [g, o] of Object.entries(patch)) p[g] = { ...(p[g] || {}), ...o }; fx.setParams('fogwar', p); return tw.fog.lightTable(); }"""
CAMS = {'whole': (125, 25, 0, 62, 190), 'yard': (125, 0, 0, 55, 95)}  # focus x, z, yaw, pitch, dist
CAM = "([x, z, yaw, pitch, dist]) => { const g = tw.main.grab; g.focus.set(x, 0, z); g.yaw = yaw; g.pitch = pitch; g.dist = dist; g.update(); tw.main.rule = 'free'; }"
# which lights reach a point (their own radius polygon over the walls, as the darkness rule) for three tables
REACHES = """async ([x, z, tables]) => { const D = await import(new URL('darksight.js', location.href).href), V = await import(new URL('vision.js', location.href).href);
  const w = tw.worldOf(tw.area()), E = w.view.entities, segs = V.blockingSegments(w.edges, E, 0);
  const out = {}; for (const [name, t] of Object.entries(tables)) { const L = tw.fog.lightsOf().filter(l => l.level === 0); out[name] = [];
    for (const l of L) { const r = E[l.id]?.lightRadius ?? t[l.kind]; if (Math.hypot(l.x - x, l.z - z) > r) continue; const p = D.radiusPolygon([l.x, l.z], segs, r); if (p && V.pointInPolygon(x, z, p)) out[name].push({ cat: E[l.id].cat, kind: l.kind, r, at: [l.x, l.z], d: +Math.hypot(l.x - x, l.z - z).toFixed(1) }); } }
  return out; }"""

async def main():
    base, info = setup()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
        async def tab(token):
            ctx = await browser.new_context(viewport={'width': 1600, 'height': 1000}, device_scale_factor=1)
            pg = await ctx.new_page(); await pg.goto(base + '#s=' + token)
            await pg.wait_for_function('window.tw?.ready?.() && tw.fog', timeout=120000)
            await pg.wait_for_function(f"tw.area() === '{AREA}' || (tw.setMain('{AREA}'), false)", timeout=60000)
            await pg.wait_for_function('tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading', timeout=180000)
            await pg.evaluate("tw.settings.setGfx('medium')"); return pg
        pl = await tab(info['player'])
        await pl.wait_for_function("tw.fog.dark() && tw.fog.info().areas.some(a => a.dark && !a.pending)", timeout=60000)
        lights = await pl.evaluate("tw.fog.lightsOf()")
        tables = {'before (lamps as lanterns, 60)': await pl.evaluate(LOOK, {'reach': {'lamp': 60}})}
        async def shots(tag):
            await pl.wait_for_timeout(2500)
            for name, cam in CAMS.items():
                await pl.evaluate(CAM, list(cam)); await pl.wait_for_timeout(2500)
                await pl.screenshot(path=os.path.join(OUT, f'player-{name}-{tag}.png'))
        await shots('1-before')
        tables['after (new default, lamp 45)'] = await pl.evaluate(LOOK, {'reach': {'lamp': 45}}); await shots('2-after-default')
        tables['after (Count dim light off)'] = await pl.evaluate(LOOK, {'dark': {'dim': False}}); await shots('3-after-bright-only')
        flower = await pl.evaluate("(() => { const f = Object.values(tw.entities()).find(e => e.cat === 'flowerbed'); return f && [f.x, f.z]; })()")
        reach = await pl.evaluate(REACHES, [flower[0], flower[1], tables]) if flower else None
        gm = await tab(info['gm'])
        await gm.evaluate("tw.setLightReach(true, { quiet: true })")
        for tag, patch in (('1-before', {'reach': {'lamp': 60}}), ('3-after-bright-only', {'reach': {'lamp': 45}, 'dark': {'dim': False}})):
            await gm.evaluate(LOOK, patch); await gm.wait_for_timeout(1500)
            for name, cam in CAMS.items():
                await gm.evaluate(CAM, list(cam)); await gm.wait_for_timeout(2500)
                await gm.screenshot(path=os.path.join(OUT, f'gm-reach-{name}-{tag}.png'))
        kinds = {}
        for L in lights: kinds[L['kind']] = kinds.get(L['kind'], 0) + 1
        json.dump({'pawn': info['pawn'], 'lights_lit': len(lights), 'by_kind': kinds, 'tables': tables, 'flowerbed': flower, 'lights_reaching_flowerbed': reach}, open(os.path.join(OUT, 'lights.json'), 'w'), indent=1)
        print(json.dumps({'by_kind': kinds, 'flowerbed': flower, 'reach': reach}, indent=1))
        await browser.close()

if __name__ == '__main__':
    try: asyncio.run(main())
    finally:
        for pr in procs: pr.terminate()
        for d in tmp: shutil.rmtree(d, ignore_errors=True)

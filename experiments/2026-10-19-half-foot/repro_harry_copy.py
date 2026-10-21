#!/usr/bin/env python3
"""Repro of Harry's "0.5 ft ruler over the pawn": a COPY of his campaign (The Weird Play Campaign) on a local relay,
opened as the player seat that owns Bloorg. The original data dir is only read (cp -r). Usage:
  python repro.py REPO OUTDIR [--ports 18431,18432]
"""
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
REPO = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
ENGINE = os.path.join(REPO, 'engine')
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa
from playwright.async_api import async_playwright
RP, SP = 18431, 18432
SRC = 'engine/data/cmp_jpg3k4akaf'
CID = 'cmp_jpg3k4akaf'
data = tempfile.mkdtemp(prefix='tw-halffoot-'); site = tempfile.mkdtemp(prefix='tw-site-')
shutil.copytree(SRC, os.path.join(data, CID))
os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
procs = [subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=open(os.path.join(data, 'relay.log'), 'a'), stderr=subprocess.STDOUT),
         subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)]
for _ in range(100):
    time.sleep(0.1)
    try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
    except Exception: pass
def mint(seat):
    js = f"""import fs from 'fs'; import {{ makeTokens }} from '{ENGINE}/relay/tokens.js';
const T = makeTokens(fs.readFileSync('{data}/secret','utf8').trim()); const s = JSON.parse(fs.readFileSync('{data}/{CID}/snapshot.json')).state.seats['{seat}'];
console.log(T.mint('{CID}', s));"""
    return subprocess.check_output(['node', '--input-type=module', '-e', js], text=True).strip()
PLAYER, GM = mint('seat_jrxlt1rx0q'), mint('seat_orrph4s3ks')
BASE = f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
PROBE = """(() => { const w = tw.worldOf(tw.area()); const out = { area: tw.area(), drops: [], rulers: tw.rulers.state().items.map(i => ({ key: i.key, kind: i.kind, text: i.text })), labs: [...document.querySelectorAll('#rulers .rlab:not([hidden])')].map(e => e.textContent) };
  for (const [id, l] of w.dropLines) out.drops.push({ id, name: tw.entities()[id]?.name, text: l.userData.text, drop: +(l.userData.drop || 0).toFixed(3), floor: l.userData.floor, visible: l.visible });
  const b = tw.entities()['tok_tyewau79zr']; out.bloorg = b ? { x: b.x, z: b.z, y: b.y } : null; return out; })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
        for who, tok in (('player', PLAYER), ('gm', GM)):
            ctx = await b.new_context(viewport={'width': 1400, 'height': 900}); pg = await ctx.new_page()
            await pg.goto(BASE + '#s=' + urllib.parse.quote(tok))
            await pg.wait_for_function('window.tw?.ready?.()', timeout=90000)
            if who == 'gm' and await pg.evaluate("tw.area() !== 'area_e3nqexm28f'"):
                await pg.evaluate("tw.registry?.run?.('area.go', {id:'area_e3nqexm28f'})"); await pg.wait_for_timeout(3000)
            await pg.wait_for_timeout(6000)
            await pg.evaluate("(() => { const e = tw.entities()['tok_tyewau79zr']; const g = tw.main.grab; g.focus.set(e.x, 0, e.z); g.yaw = 0; g.pitch = 50; g.dist = 22; g.update(); tw.main.rule = 'free'; })()")
            await pg.mouse.move(5, 5); await pg.wait_for_timeout(3000)
            print(who, json.dumps(await pg.evaluate(PROBE)), flush=True)
            await pg.screenshot(path=os.path.join(OUT, f'{who}.png'))
            await ctx.close()
        await b.close()
try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    shutil.rmtree(data, ignore_errors=True); shutil.rmtree(site, ignore_errors=True)

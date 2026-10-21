#!/usr/bin/env python3
"""Thumbnails for the figure-set gallery: one 320x320 WebP per figure, drawn by the gallery page itself.

    python3 thumbs.py BASE_URL SET_DIR [--ids a,b] [--force] [--firefox]

BASE_URL  where the gallery is served WITH this set's manifest.json and tiers/ (a deploy_set.sh copy), for example
          http://127.0.0.1:8851/ ; or the word  auto : make a throw-away linked copy of SET_DIR, serve it on a free
          port between 8800 and 8899 for the length of the run, and stop that server (by its pid) at the end.
SET_DIR   the published set: reads SET_DIR/manifest.json, writes SET_DIR/thumbs/<id>.webp

Makes a picture for every figure that has none yet (all of them with --force, only the named ones with --ids).
One browser and one page for the whole run: the page's own render mode (?shot=<id>&ui=0: the figure alone on its
rim base, day lighting, from a little above and to one side, framed to fill the picture whatever its height) is
opened once and re-aimed with window.__shot(id). It draws the HORDE (5k) file, shot at 512x512, saved at 320x320,
WebP quality 82. A figure that fails is reported and skipped; the run goes on. Exit code 1 if any failed.
Chromium by default; --firefox needs DISPLAY=:99 (headless Firefox has no WebGL on this box).
After a run, deploy again (deploy_set.sh) so the new pictures are published."""
import io, json, os, pathlib, socket, subprocess, sys, tempfile, time
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = lambda k: next((a.split('=', 1)[1] if '=' in a else sys.argv[sys.argv.index(a) + 1] for a in sys.argv[1:] if a == k or a.startswith(k + '=')), None)
if len(args) < 2 or '--help' in sys.argv or '-h' in sys.argv: sys.exit(__doc__)
only = opt('--ids'); args = [a for a in args if a != only]
base, set_dir = args[0], pathlib.Path(args[1]).resolve()
force, firefox = '--force' in sys.argv, '--firefox' in sys.argv
man = json.load(open(set_dir / 'manifest.json')); ids = [f['id'] for f in man['figures'] if f and f.get('id')]
if only: want = only.split(','); missing = [i for i in want if i not in ids]; ids = [i for i in want if i in ids]; [print(f'  not in manifest.json: {i}') for i in missing]
out = set_dir / 'thumbs'; out.mkdir(exist_ok=True)
todo = [i for i in ids if force or only or not (out / f'{i}.webp').exists()] if not only or force else [i for i in ids]
if only and not force: todo = ids
print(f'{len(ids)} figures listed, {len(todo)} to draw' + ('' if todo else ': nothing to do'), flush=True)
if not todo: sys.exit(0)

server = tmp = None
if base == 'auto':
    tmp = tempfile.mkdtemp(prefix='tw-thumbs-')
    subprocess.run([str(HERE / 'deploy_set.sh'), '--link', '--set', str(set_dir), tmp], check=True, stdout=subprocess.DEVNULL)
    port = next(p for p in range(8800, 8900) if socket.socket().connect_ex(('127.0.0.1', p)) != 0)
    server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '-d', tmp], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f'http://127.0.0.1:{port}/'; time.sleep(0.6)
base = base if base.endswith('/') else base + '/'
failed, t0 = [], time.time()
try:
    with sync_playwright() as p:
        if firefox: b = p.firefox.launch(headless=not os.environ.get('DISPLAY'), firefox_user_prefs={'webgl.force-enabled': True, 'layers.acceleration.force-enabled': True})
        else: b = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
        pg = b.new_page(viewport={'width': 512, 'height': 512}, device_scale_factor=1)
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        pg.goto(f'{base}?shot={todo[0]}&ui=0&v={int(time.time())}')
        pg.wait_for_function('window.__ready === true', timeout=90000)
        if pg.evaluate('window.__error || null'): sys.exit(f'the page could not read its figure list at {base}: ' + pg.evaluate('window.__error'))
        served = set(pg.evaluate('fetch("./manifest.json?v=" + Date.now()).then(r => r.json()).then(m => m.figures.map(f => f.id))'))
        for n, fid in enumerate(todo, 1):
            t1 = time.time()
            try:
                if fid not in served: raise RuntimeError(f'not in the manifest.json served at {base} (deploy the set there first, or use BASE_URL auto)')
                r = pg.evaluate('window.__firstShot' if n == 1 else f'window.__shot({json.dumps(fid)})')
                if not r or not r.get('ok'): raise RuntimeError((r or {}).get('err') or 'the page did not draw it')
                im = Image.open(io.BytesIO(pg.screenshot(clip={'x': 0, 'y': 0, 'width': 512, 'height': 512}))).convert('RGB')
                lit = sum(1 for v in im.convert('L').resize((64, 64)).tobytes() if v > 40) / 4096
                if lit < 0.02: raise RuntimeError('the picture came out empty (almost all dark)')
                tmpf = out / f'.{fid}.webp.tmp'; im.resize((320, 320), Image.LANCZOS).save(tmpf, 'WEBP', quality=82, method=6); os.chmod(tmpf, 0o644); os.replace(tmpf, out / f'{fid}.webp')
                if n <= 3 or n % 25 == 0 or n == len(todo): print(f'  {n}/{len(todo)}  {fid}  {time.time() - t1:.2f} s  ({r.get("tier")} file, {(out / f"{fid}.webp").stat().st_size // 1024} KB)', flush=True)
            except Exception as e:  # noqa: BLE001  one bad figure never stops the run
                failed.append((fid, str(e).splitlines()[0][:300])); print(f'  {n}/{len(todo)}  {fid}  FAILED: {failed[-1][1]}', flush=True)
        b.close()
finally:
    if server: server.terminate(); server.wait(timeout=5)
    if tmp: import shutil; shutil.rmtree(tmp, ignore_errors=True)
dt = time.time() - t0
print(f'done: {len(todo) - len(failed)} drawn, {len(failed)} failed, {dt:.0f} s ({dt / len(todo):.2f} s a figure) -> {out}')
for fid, why in failed: print(f'  FAILED {fid}: {why}')
if errs: print('page errors:', *list(dict.fromkeys(errs))[:5], sep='\n  ')
sys.exit(1 if failed else 0)

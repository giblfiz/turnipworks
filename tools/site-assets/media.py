#!/usr/bin/env python3
"""THE ASSETS PAGE'S PICTURES (2026-11-04; the page: docs/site/assets.md, engine/tools/site_assets.py).

  python3 tools/site-assets/media.py install [--render] [--only SKU,...] [--force]
  python3 tools/site-assets/media.py status

Every picture on /assets is a picture of the real file (never drawn by hand):
  t/<sku>.<hash>.webp   a catalog look: a MESH is rendered by tools/site-assets/render.html (headless Chromium, the figure
                        thumbnails' ground and light rig, three-quarters from the front, its orientation from the game's
                        own data: tools/spawn-tuner/data/orient.json under the corrections on the ratings server); a FLAT
                        (a floor tile, a banner) is its own picture, scaled onto the same ground. 512 drawn, 256 kept.
  f/<id>-<hash>.webp    a figure: the figure set's own thumbnail (tools/spawn-tuner/assets/figures/thumbs/), copied.
  h/<name>.webp         a pack's hero: a still of a furnished room from the game (tools/promo/capture.py --probe; the
                        shots are site-hero-* in tools/promo/shots.json), listed in docs/site/assets-packs.json.
The names come from engine/client/site/assets.json (engine/tools/build_site.py writes it): the hash is the catalog's mesh
id, so a remade mesh gets a new name and Cloudflare's 4-hour copy of the old one never shows.

The masters live on the USB disk ($TW_ASSETS_MEDIA, default /mnt/usb/turnip-works/site/assets-library/: t/, f/, h/), like
the help page's film; `install` copies what the page lists into engine/client/site/library/ (git-ignored, as every
picture), and with --render first draws the looks the masters lack. engine/deploy.sh runs `install --render`; a
picture that cannot be made is a WARNING there, never a failed deploy: its card shows the empty ground until next time.
"""
import base64, io, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent; REPO = HERE.parent.parent
TUNER = REPO / 'tools' / 'spawn-tuner'
DATA = REPO / 'engine' / 'client' / 'site' / 'assets.json'
OUT = REPO / 'engine' / 'client' / 'site' / 'library'
PACKS = REPO / 'docs' / 'site' / 'assets-packs.json'
M = Path(os.environ.get('TW_ASSETS_MEDIA', '/mnt/usb/turnip-works/site/assets-library'))
ORIENT_API = os.environ.get('ORIENT_API', 'http://127.0.0.1:8096')
BG = (119, 114, 106); DRAW, KEEP = 512, 256


def wanted():
    """[(subdir, name, how)] for every picture the page lists; how = ('mesh', sku) | ('flat', sku) | ('fig', src) | ('hero', None)"""
    d = json.load(open(DATA, encoding='utf-8')); out = []
    for t in d['things'].values():
        for look in t['l']:
            sku, h = look[0], look[1]
            out.append(('t', f'{sku}.{h}.webp', ('flat' if t.get('f') else 'mesh', sku)))
    for fid, f in d['figures'].items():
        h = f['x'].split('-')[-1]; out.append(('f', f'{fid}-{h}.webp', ('fig', f'{fid}-{h}.webp')))
    for p in json.load(open(PACKS, encoding='utf-8'))['packs'].values():
        for k in ('hero',):
            if p.get(k): out += [('h', f'{p[k]}-{w}.webp', ('hero', None)) for w in (600, 1200)]
    return out


def orientation():
    """{mesh id: yaw degrees}: the file, then the ratings server's corrections over it (tools/spawn-tuner/js/orient.js)"""
    lib = json.load(open(TUNER / 'data' / 'library.json', encoding='utf-8'))
    yaw = {k: float(v) for k, v in json.load(open(TUNER / 'data' / 'orient.json', encoding='utf-8')).items() if v is not None}
    recs = {}
    try: recs = json.load(urllib.request.urlopen(f'{ORIENT_API}/tuner/orient', timeout=5))
    except Exception as e: print(f'  (no orientation corrections from {ORIENT_API}: {e}; the file only)')  # noqa: BLE001
    sku_rec = {s['sku']: s for o in lib['objects'].values() for s in o['skus']}
    from datetime import datetime
    def when(s): return datetime.strptime(s, '%Y-%m-%dT%H:%M:%S%z')
    def mesh_at(sku, at):  # orient.js meshAtFn
        s = sku_rec.get(sku)
        if not s or not s.get('mesh'): return None
        if at is None: return (s.get('was') or [{}])[0].get('mesh') or s['mesh']
        for w in reversed(s.get('was') or []):
            if not when(at) >= when(w['until']): return w['mesh']
        return s['mesh']
    for k, rec in (recs or {}).items():
        dat = (rec or {}).get('data') or {}; v = dat.get('yaw_deg', (rec or {}).get('yaw_deg'))
        m = dat.get('mesh') or (k if '@' in k else mesh_at(dat.get('sku') or k, (rec or {}).get('at')))
        if v is not None and m: yaw[m] = float(v)
    return {s['sku']: yaw.get(s.get('mesh'), 0.0) for s in sku_rec.values()}


def onto_ground(im):
    from PIL import Image
    im = im.convert('RGBA'); im.thumbnail((DRAW - 24, DRAW - 24), Image.LANCZOS)
    g = Image.new('RGBA', (DRAW, DRAW), BG + (255,)); g.alpha_composite(im, ((DRAW - im.width) // 2, (DRAW - im.height) // 2))
    return g.convert('RGB')


def save(im, path):
    from PIL import Image
    path.parent.mkdir(parents=True, exist_ok=True); tmp = path.with_name('.' + path.name + '.tmp')
    im.resize((KEEP, KEEP), Image.LANCZOS).save(tmp, 'WEBP', quality=78, method=6); os.chmod(tmp, 0o644); os.replace(tmp, path)


def render(todo):
    """draw the meshes and flats in todo [(name, how)] into the masters' t/; -> [(name, why)] that failed"""
    from PIL import Image, ImageChops
    failed = []
    flats = [(n, h) for n, h in todo if h[0] == 'flat']; meshes = [(n, h) for n, h in todo if h[0] == 'mesh']
    for n, (_, sku) in flats:
        try: save(onto_ground(Image.open(TUNER / 'assets' / 'flat' / f'{sku}.webp')), M / 't' / n)
        except Exception as e: failed.append((n, str(e)[:200]))  # noqa: BLE001
    if not meshes: return failed
    yaw = orientation()
    # a hand-placed kit piece (a wall, door, window, fence) shows its finished face on the catalog's back (-Z): a door's
    # braces are on +Z (Gemini, 2026-11-04: "seen from behind ... the Z-brace framing"), so kit is drawn turned round
    lib = json.load(open(TUNER / 'data' / 'library.json', encoding='utf-8'))['objects']
    kit = {k['sku'] for o in lib.values() if o.get('place') == 'kit' for k in o['skus']}
    stage = Path(tempfile.mkdtemp(prefix='tw-site-thumbs-'))
    (stage / 'render.html').symlink_to(HERE / 'render.html'); (stage / 'assets').symlink_to(TUNER / 'assets')
    port = next(p for p in range(18600, 18700) if socket.socket().connect_ex(('127.0.0.1', p)) != 0)
    server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '-d', str(stage)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t0 = time.time()
    try:
        time.sleep(0.6)
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            pg = b.new_page(viewport={'width': DRAW, 'height': DRAW}, device_scale_factor=1)
            pg.goto(f'http://127.0.0.1:{port}/render.html'); pg.wait_for_function('window.__ready === true', timeout=60000)
            for i, (n, (_, sku)) in enumerate(meshes, 1):
                try:
                    r = pg.evaluate('(j) => window.__shot(j)', {'file': f'assets/m/{sku}.glb', 'yaw': yaw.get(sku, 0.0) + (180 if sku in kit else 0)})
                    if not r.get('ok'): raise RuntimeError(r.get('err'))
                    im = Image.open(io.BytesIO(base64.b64decode(r['png'].split(',', 1)[1]))).convert('RGB')  # (the canvas itself, not a screenshot of the page: a screenshot can catch the frame before)
                    # drawn = differs from the ground (a black pillar is dark, but it is there)
                    drawn = sum(1 for v in ImageChops.difference(im, Image.new('RGB', im.size, BG)).convert('L').resize((64, 64)).tobytes() if v > 10) / 4096
                    if drawn < 0.01: raise RuntimeError('the picture came out empty (nothing drawn on the ground)')
                    save(im, M / 't' / n)
                except Exception as e: failed.append((n, str(e).splitlines()[0][:200]))  # noqa: BLE001
                if i <= 2 or i % 100 == 0 or i == len(meshes): print(f'  {i}/{len(meshes)} meshes drawn ({time.time() - t0:.0f} s)', flush=True)
            b.close()
    finally:
        server.terminate(); server.wait(timeout=5); shutil.rmtree(stage, ignore_errors=True)
    return failed


def main():
    a = sys.argv[1:]
    if not a or a[0] not in ('install', 'status') or '-h' in a or '--help' in a: sys.exit(__doc__)
    want = wanted()
    only = next((a[a.index('--only') + 1].split(',') for _ in [0] if '--only' in a), None)
    have = lambda s, n: (M / s / n).is_file() and (M / s / n).stat().st_size > 0
    miss = [(s, n, h) for s, n, h in want if not have(s, n)]
    if a[0] == 'status':
        by = {}; [by.setdefault(s, [0, 0]).__setitem__(0 if have(s, n) else 1, by.setdefault(s, [0, 0])[0 if have(s, n) else 1] + 1) for s, n, h in want]
        print(f'masters {M}: ' + ', '.join(f'{s}/ {h} present, {m} missing' for s, (h, m) in sorted(by.items()))); return
    if not M.parent.is_dir(): print(f'WARNING: assets page pictures: the masters folder {M} is not reachable (TW_ASSETS_MEDIA); page cards stay blank'); return
    for s in ('t', 'f', 'h'): (M / s).mkdir(parents=True, exist_ok=True)
    # figures: copy the set's own thumbnails into the masters (they are already pictures of the files)
    for s, n, h in want:
        if h[0] == 'fig' and (not have(s, n) or '--force' in a):
            src = TUNER / 'assets' / 'figures' / 'thumbs' / h[1]
            if src.is_file(): shutil.copyfile(src, M / s / n); os.chmod(M / s / n, 0o644)
    failed = []
    if '--render' in a:
        todo = [(n, h) for s, n, h in want if s == 't' and (only and h[1] in only or not only and (not have(s, n) or '--force' in a))]
        if todo: print(f'assets page pictures: drawing {len(todo)} looks into {M / "t"}', flush=True); failed = render(todo)
    # install: exactly what the page lists, nothing else (an old name is removed, as a remade mesh's old picture)
    OUT.mkdir(parents=True, exist_ok=True); names = set(); missing = []
    for s, n, h in want:
        names.add(f'{s}/{n}'); src, dst = M / s / n, OUT / s / n
        if not src.is_file(): missing.append(f'{s}/{n}'); continue
        if not dst.is_file() or dst.stat().st_size != src.stat().st_size or dst.stat().st_mtime < src.stat().st_mtime:
            dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(src, dst); os.chmod(dst, 0o644)
    stale = [p for p in OUT.rglob('*.webp') if f'{p.parent.name}/{p.name}' not in names]
    for p in stale: p.unlink()
    size = sum(p.stat().st_size for p in OUT.rglob('*.webp'))
    print(f'assets page pictures: {len(want) - len(missing)} of {len(want)} in {OUT} ({size / 1e6:.1f} MB), {len(stale)} old removed')
    for n, why in failed[:20]: print(f'  FAILED {n}: {why}')
    if missing: print(f'WARNING: {len(missing)} assets page pictures missing (their cards show the empty ground): {", ".join(missing[:8])}{" …" if len(missing) > 8 else ""}'
                       f'\n  make them: {sys.executable} tools/site-assets/media.py install --render')


if __name__ == '__main__':
    main()

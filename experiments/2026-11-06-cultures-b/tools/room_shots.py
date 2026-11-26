#!/usr/bin/env python3
"""Rooms of one pack at table distance in a headless Spawn Tuner (this worktree's, served locally), and the BLIND read:
Gemini through agy-run, the pictures under random names in an isolated folder, "what culture and what room is this?"
(no room or culture word in the prompt or the names). The smithy's room_shots.py, with the read moved off the paid API.
  PY=python3
  $PY tools/room_shots.py shoot CODE OUTDIR [--seeds 11,12] [--keys a,b]     (needs the pack's real meshes: tools/runtime.sh)
  python3 tools/room_shots.py read OUTDIR                                     -> OUTDIR/read.json, one line per picture
Outdoor rooms are shot with a building of the same pack on their north side (alone a court is an empty square)."""
import json, os, random, re, shutil, subprocess, sys, tempfile, time
from pathlib import Path
E = Path(__file__).resolve().parent.parent; TU = E.parents[1] / 'tools/spawn-tuner'
opt = lambda k, d: next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == k and i + 1 < len(sys.argv)), d)
BESIDE = {'nrs': 'nrs-longhouse', 'mde': 'mde-audience', 'rus': 'rus-izba', 'mes': 'mes-house'}

def shoot(code, outdir):
    from playwright.sync_api import sync_playwright
    port = 18000 + random.randint(100, 899)
    http = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=TU, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    base = f'http://127.0.0.1:{port}'; seeds = opt('--seeds', '11,12').split(','); only = [k for k in opt('--keys', '').split(',') if k]
    os.makedirs(outdir, exist_ok=True)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
            types = [t for t in json.loads((TU / 'data/rooms.json').read_text()) if t['key'].startswith(code + '-') and (not only or t['key'] in only)]
            for t in types:
                w, d = t['cells']
                for seed in seeds:
                    pg = b.new_page(viewport={'width': 1500, 'height': 2300}); errs = []
                    pg.on('pageerror', lambda e: errs.append(str(e)))
                    pg.on('response', lambda r: errs.append(f'HTTP {r.status} {r.url}') if r.status >= 400 and '/api/' not in r.url else None)
                    pg.route('**/api/tw-ratings/**', lambda route: route.fulfill(status=200, content_type='application/json', body='{}'))
                    pg.goto(base + f'/index.html?nobg&seed={seed}&nofx', timeout=180000); pg.wait_for_selector('body[data-ready="1"]', timeout=180000)
                    settle = lambda: (pg.wait_for_function('tuner.episodes() === 0', timeout=300000), time.sleep(0.5))
                    if t.get('outdoor'): bk = BESIDE[code]; pg.evaluate(f"void tuner.createRoom('{bk}', 4, {5 - 4}, {w}, 4)"); settle(); time.sleep(0.5); settle()
                    pg.evaluate(f"void tuner.createRoom('{t['key']}', 4, 5, {w}, {d})"); settle(); time.sleep(1.0); settle()
                    r = pg.evaluate(f"tuner.rooms().find(r => r.type === '{t['key']}')"); L = pg.evaluate(f"tuner.layoutOf('{r['id']}')")
                    tag = f"{t['key']}-{seed}"
                    json.dump({'key': t['key'], 'cells': [w, d], 'seed': seed, 'purposeFail': L.get('purposeFail'), 'placements': [[q['id'], q['sku'], q['rule'], round(q['x'], 1), round(q['z'], 1)] for q in L['placements']],
                               'errors': errs, 'overlaps': pg.evaluate("tuner.overlapReport(0.35)"), 'outside': pg.evaluate("tuner.outsideReport(0.6)")}, open(f'{outdir}/{tag}.json', 'w'), indent=1)
                    pg.evaluate("(() => { tuner.hideLabels && tuner.hideLabels(true); })()"); pg.keyboard.press('Escape'); time.sleep(0.3); pg.add_style_tag(content='#hint { display: none !important; } #stage > *:not(canvas) { display: none !important; }')
                    stage = pg.evaluate("(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()")
                    # (stills: anything drawn over the stage that is not the 3D canvas, e.g. the tuner's bars, is hidden)
                    pg.evaluate("""((s) => { for (const el of document.body.querySelectorAll('*')) { if (el.tagName === 'CANVAS' || el.querySelector('canvas')) continue;
                      const r = el.getBoundingClientRect(); if (r.width && r.height && r.right > s.x && r.left < s.x + s.width && r.bottom > s.y && r.top < s.y + s.height) el.style.visibility = 'hidden'; } })""", stage)
                    cx, cz, span = (4 + w / 2) * 5, (5 + d / 2) * 5, max(w, d) * 5
                    for name, cam in (('table', f"tuner.cam.focus.set({cx}, 0, {cz + 2}); tuner.cam.dist = {span * 1.9 + 20}; tuner.cam.pitch = 55; tuner.cam.yaw = 0;"),
                                      ('top', f"tuner.cam.focus.set({cx}, 0, {cz}); tuner.cam.dist = {span * 1.8 + 20}; tuner.cam.pitch = 89; tuner.cam.yaw = 0;")):
                        pg.evaluate("(() => { %s tuner.cam.update(); })()" % cam); time.sleep(2.5); pg.screenshot(path=f'{outdir}/{tag}-{name}.png', clip=stage)
                    print(tag, '| things', len(L['placements']), '| purpose', L.get('purposeFail') or 'ok', '| errs', len(errs), errs[:2], flush=True)
                    pg.close()
            b.close()
    finally:
        http.kill()

def agy(d, prompt):
    for _ in range(2):
        r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-C', d, '-t', '900', prompt], stdin=subprocess.DEVNULL, capture_output=True, text=True)
        m = re.search(r'\[\s*\{.*\}\s*\]', r.stdout, re.S)
        try: return json.loads(m.group(0))
        except Exception: print('  (retry)', r.stdout[-300:], flush=True)
    return []

def read(outdir):
    from PIL import Image
    tags = sorted(f[:-10] for f in os.listdir(outdir) if f.endswith('-table.png')); res = {}
    for k in range(0, len(tags), 6):
        part = tags[k:k + 6]; d = tempfile.mkdtemp(prefix='agy-cultb-rooms-'); key = {}
        for tag in part:
            n = f'{random.getrandbits(40):010x}.jpg'; key[n] = tag; Image.open(f'{outdir}/{tag}-table.png').convert('RGB').save(Path(d) / n, quality=90)
        got = agy(d, f"These {len(key)} pictures ({', '.join(sorted(key))}) each show ONE room of a 3D tabletop game, seen from above at about the distance of players round a table.\n"
                  "Do NOT create, crop or write any files. Do not run commands or open any other files. Only look at the images.\n"
                  "For EACH picture: first report any visible labels or text; then describe in one sentence what you actually see; then answer: what CULTURE and period "
                  "does it look like (or 'generic fantasy'), what kind of ROOM is it (a few words), what is the one thing it is built around, and anything that looks wrong "
                  "(floating, clipping, out of scale, unreadable). Say what you see, not what such a room usually has.\n"
                  'Answer with ONLY a JSON array: [{"file": "<name>", "text": "...", "see": "...", "culture": "...", "room": "...", "focal": "...", "wrong": "..."}, ...]')
        for g in got:
            tag = key.get(g.get('file'))
            if tag: res[tag] = {x: g.get(x) for x in ('see', 'culture', 'room', 'focal', 'wrong')}
        shutil.rmtree(d, ignore_errors=True); json.dump(res, open(f'{outdir}/read.json', 'w'), indent=1)
        for tag in part:
            v = res.get(tag, {}); print(f"{tag:26s} culture: {str(v.get('culture'))[:34]:34s} room: {str(v.get('room'))[:40]:40s} focal: {str(v.get('focal'))[:40]} | wrong: {str(v.get('wrong'))[:70]}", flush=True)

if __name__ == '__main__':
    if sys.argv[1] == 'shoot': shoot(sys.argv[2], sys.argv[3])
    else: read(sys.argv[2])

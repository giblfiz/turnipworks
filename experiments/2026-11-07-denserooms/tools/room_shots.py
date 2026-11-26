"""Rooms of the Cyberpunk type (the cyberpunk pack, wave 2; copied from wave 1's integration/room_shots.py) at table distance, and the blind read: "what setting and what room is this?"
(the mine's tests/room_shots.py, with the read on the Gemini SUBSCRIPTION through agy-run, never a paid API).

  PY=python3
  $PY integration/room_shots.py BASE_URL OUTDIR [--seeds 11] [--sizes default] [--keys a,b] [--beside key:w:d] [--read] [--read-only]
     BASE_URL  this worktree's tuner served locally (python3 -m http.server PORT in tools/spawn-tuner)

Per room type and seed: the room laid out ALONE in a headless tuner (labels off), the game's high three-quarter view, a
second from the south-west, and a top view; plus <tag>.json (placements, overlap and outside reports, page errors).
--read: ONE agy call per room, blind: the three pictures under neutral names (view-1/2/3.png) in an empty folder, no room
or type name anywhere, labels read first; answers {setting, era, room, confidence, main_things, built_around, wrong}.
Writes OUTDIR/read.json. Wide-angle "floating" and "clipping" calls are triage, not verdicts.
"""
import sys, time, json, os, re, shutil, subprocess, tempfile, pathlib
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = lambda k, d: next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == k and i + 1 < len(sys.argv)), d)
base, outdir = args[0].rstrip('/'), args[1]
seeds = opt('--seeds', '11').split(','); sizes = opt('--sizes', 'default').split(','); READ = '--read' in sys.argv
os.makedirs(outdir, exist_ok=True)

def shoot():
    from playwright.sync_api import sync_playwright
    out = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
        pg0 = b.new_page(); pg0.goto(base + '/data/rooms.json'); types = [t for t in json.loads(pg0.inner_text('body')) if t['key'].startswith(opt('--prefix', 'cyb-'))]; pg0.close()
        only = [k for k in opt('--keys', '').split(',') if k]; types = [t for t in types if not only or t['key'] in only]
        for t in types:
            for size in sizes:
                w, d = t['cells'] if size == 'default' else [min(16, round(t['cells'][0] * 1.5)), min(16, round(t['cells'][1] * 1.5))]
                for seed in seeds:
                    pg = b.new_page(viewport={'width': 1500, 'height': 1900}); errs = []
                    pg.on('pageerror', lambda e: errs.append(str(e)))
                    pg.on('response', lambda r: errs.append(f'HTTP {r.status} {r.url}') if r.status >= 400 and '/api/' not in r.url else None)
                    pg.goto(base + f'/index.html?nobg&seed={seed}'); pg.wait_for_selector('body[data-ready="1"]', timeout=180000)
                    settle = lambda tmo=300000: (pg.wait_for_function('tuner.episodes() === 0', timeout=tmo), time.sleep(0.5))
                    bes = opt('--beside', '') if t.get('outdoor') else ''
                    if bes: bk, bw, bd = bes.split(':'); pg.evaluate(f"void tuner.createRoom('{bk}', 4, {5 - int(bd)}, {bw}, {bd})"); settle(); time.sleep(0.5); settle()
                    pg.evaluate(f"void tuner.createRoom('{t['key']}', 4, 5, {w}, {d})"); settle(); time.sleep(1.0); settle()
                    r = pg.evaluate(f"tuner.rooms().find(r => r.type === '{t['key']}')"); L = pg.evaluate(f"tuner.layoutOf('{r['id']}')")
                    tag = f"{t['key']}-{size}-{seed}"
                    json.dump({'key': t['key'], 'cells': [w, d], 'seed': seed, 'purposeFail': L.get('purposeFail'), 'summary': r.get('summary'), 'placements': [[q['id'], q['sku'], q['rule'], q['x'], q['z']] for q in L['placements']],
                               'unplaced': L.get('unplaced'), 'errors': errs, 'overlaps': pg.evaluate("tuner.overlapReport(0.35)"), 'outside': pg.evaluate("tuner.outsideReport(0.6)")}, open(f'{outdir}/{tag}.json', 'w'), indent=1)
                    pg.evaluate("(() => { tuner.hideLabels && tuner.hideLabels(true); })()"); pg.keyboard.press('Escape'); time.sleep(0.3); pg.add_style_tag(content='#hint, #hud, #fps, #fpsGraph, #net, #netGraph, #loadBound, #tooltip, #toast { display: none !important; }')
                    stage = pg.evaluate("(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()")
                    cx, cz, span = (4 + w / 2) * 5, (5 + d / 2) * 5, max(w, d) * 5
                    for name, cam in (('table', f"tuner.cam.focus.set({cx}, 0, {cz + 2}); tuner.cam.dist = {span * 1.9 + 20}; tuner.cam.pitch = 55; tuner.cam.yaw = 0;"),
                                      ('table-sw', f"tuner.cam.focus.set({cx}, 0, {cz + 2}); tuner.cam.dist = {span * 1.7 + 18}; tuner.cam.pitch = 50; tuner.cam.yaw = 40;"),
                                      ('top', f"tuner.cam.focus.set({cx}, 0, {cz}); tuner.cam.dist = {span * 1.8 + 20}; tuner.cam.pitch = 89; tuner.cam.yaw = 0;")):
                        pg.evaluate("(() => { %s tuner.cam.update(); })()" % cam); time.sleep(2.5)
                        pg.screenshot(path=f'{outdir}/{tag}-{name}.png', clip=stage)
                    print(tag, '| things', len(L['placements']), '| purpose', L.get('purposeFail') or 'ok', '| errs', len(errs), flush=True)
                    out.append(tag); pg.close()
        b.close()
    return out

PROMPT = ("Do NOT create, crop or write any files. Do not run commands or open any other files; only look at the three images "
          "view-1.png, view-2.png and view-3.png in this folder. They show ONE room or outdoor area built in a 3D tabletop game, seen from "
          "above at about the distance of players round a table: two high three-quarter views and a straight-down view. First list any text "
          "or labels you can read. Then describe what you actually see, not what such a place usually has. Then answer: what SETTING or era "
          "is this (fantasy, medieval, modern, sci-fi...), what KIND of room or place is it (a few words), how sure are you (0-100), its main "
          "things, the one thing it is built around (if any), and anything that looks wrong (floating, clipping, doubled, out of scale, "
          "unreadable at this distance). Answer ONLY with JSON: {\"text\": [], \"description\": \"...\", \"setting\": \"...\", \"room\": \"...\", "
          "\"confidence\": 0, \"main_things\": [\"...\"], \"built_around\": \"...\", \"wrong\": [\"...\"]}")
def agy(d):
    for _ in range(2):
        r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-t', '600', '-C', d, PROMPT], capture_output=True, text=True, timeout=3600, stdin=subprocess.DEVNULL)
        for m in re.finditer(r'\{', r.stdout):
            try: return json.JSONDecoder().raw_decode(r.stdout[m.start():])[0]
            except json.JSONDecodeError: continue
    return {'error': r.stdout[-400:]}
def read(tags):
    res = json.load(open(f'{outdir}/read.json')) if os.path.exists(f'{outdir}/read.json') else {}
    for tag in tags:
        d = tempfile.mkdtemp(prefix='agy-dense-room-')
        for i, name in enumerate(('table', 'table-sw', 'top'), 1): shutil.copy(f'{outdir}/{tag}-{name}.png', f'{d}/view-{i}.png')
        v = agy(d); shutil.rmtree(d, ignore_errors=True)
        res[tag] = {'key': json.load(open(f'{outdir}/{tag}.json'))['key'], **v}
        print(f"{tag:36s} setting: {str(v.get('setting'))[:24]:24s} room: {str(v.get('room'))[:50]:50s} conf {v.get('confidence')}", flush=True)
        json.dump(res, open(f'{outdir}/read.json', 'w'), indent=1)
    return res

BATCH = ("Do NOT create, crop or write any files. Do not run commands or open any other files; only look at the {n} images {files} in this folder. "
         "Each image shows a DIFFERENT room or outdoor area built in a 3D tabletop game, seen from above at about the distance of players round a table. "
         "For EACH image separately: first list any text or labels you can read; then say what SETTING or era it is (fantasy, medieval, modern, sci-fi...), "
         "what KIND of room or place it is (a few words), how sure you are (0-100), its main things, the one thing it is built around (if any), and "
         "anything that looks wrong (floating, clipping, doubled, out of scale, unreadable at this distance). Say what you actually see. "
         'Answer ONLY with a JSON array: [{{"file": "<name>", "text": [], "setting": "...", "room": "...", "confidence": 0, "main_things": ["..."], "built_around": "...", "wrong": ["..."]}}, ...]')
def read_batch(tags, view='table'):
    """ONE agy call for every room: one picture each (`view`), neutral random names, an empty folder (the shared lock is
    the bottleneck: eight calls queued behind other lanes took over an hour)."""
    import random
    res = json.load(open(f'{outdir}/read-{view}.json')) if os.path.exists(f'{outdir}/read-{view}.json') else {}
    d = tempfile.mkdtemp(prefix='agy-dense-rooms-'); names = {}
    for tag in tags:
        n = f'{random.getrandbits(32):08x}.png'; names[n] = tag; shutil.copy(f'{outdir}/{tag}-{view}.png', f'{d}/{n}')
    prompt = BATCH.format(n=len(names), files=', '.join(sorted(names)))
    got = None
    for _ in range(2):
        r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-t', '900', '-C', d, prompt], capture_output=True, text=True, timeout=7200, stdin=subprocess.DEVNULL)
        m = re.search(r'\[\s*\{.*\}\s*\]', r.stdout, re.S)
        try: got = json.loads(m.group(0)); break
        except Exception: print('  (retry)', r.stdout[-300:], flush=True)
    shutil.rmtree(d, ignore_errors=True)
    for g in got or []:
        tag = names.get(g.get('file'))
        if tag: res[tag] = {'key': json.load(open(f'{outdir}/{tag}.json'))['key'], 'view': view, **g}
    json.dump(res, open(f'{outdir}/read-{view}.json', 'w'), indent=1)
    for tag in tags:
        v = res.get(tag, {}); print(f"{tag:36s} setting: {str(v.get('setting'))[:22]:22s} room: {str(v.get('room'))[:52]:52s} conf {v.get('confidence')}", flush=True)
    return res

if __name__ == '__main__':
    if '--read-batch' in sys.argv:
        tags = sorted({f.rsplit('-', 1)[0] for f in os.listdir(outdir) if f.endswith('-top.png')})
        for view in opt('--views', 'table').split(','): read_batch(tags, view)
        sys.exit(0)
    tags = shoot() if '--read-only' not in sys.argv else sorted({f.rsplit('-', 1)[0] for f in os.listdir(outdir) if f.endswith('-top.png') and (not opt('--keys', '') or any(f.startswith(k + '-') for k in opt('--keys', '').split(',')))})
    if READ or '--read-only' in sys.argv: read(tags)

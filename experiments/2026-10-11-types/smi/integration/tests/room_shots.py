"""Rooms of one new type at table distance, and the blind read: "what kind of room is this?"
(modelled on experiments/2026-10-05-yard-props/yard_shots.py; one script for crypt, castle and mansion).

  PY=python3
  $PY tests/room_shots.py TYPE BASE_URL OUTDIR API_ORIGIN [--seeds 11,12] [--sizes default,big] [--keys key,key] [--read]
     TYPE      crypt | castle | mansion       (the `group` of the room types in data/rooms.json)
     BASE_URL  the deployed tuner, e.g. https://implausible.enterprises/projects/turnip-works/tuner
     API       origin of the ratings API the tuner calls (as yard_shots.py)

Per room type and seed: the room laid out ALONE in a headless tuner on the box's GPU (labels off, fx off), the game's
high three-quarter view, a second from the south-west, and a top view; plus <tag>.json (summary, placements, overlap
and outside reports, page errors). Needs the type's REAL meshes: run it after the runtime downsample and the deploy.

--read: Gemini, blind (model gemini-2.5-pro as the yard's read; GEMINI_API_KEY from the environment). Two calls per
room, so the judge is never primed (Harry: "describe this object to me", not "is this a sandwich"):
  1. the three pictures and "describe what you see; what kind of room is this; what are its main things; anything that
     looks wrong (floating, clipping, doubled, out of scale)". No room name, no type name anywhere in the prompt or the
     file names it is shown (pictures are sent as view-1/2/3).
  2. text only: the description + the room's intended reading (rooms.json `reads_as` of the designers) ->
     { match: yes | partly | no, named_as, focal_seen, problems[] }.
Writes OUTDIR/read.json and prints one line per room; exit 1 if any room reads `no`. Wide-angle "floating" and
"clipping" calls are triage, not verdicts (ROOMS.md, the yard's read): confirm with a close view before acting.
"""
import sys, time, json, os, base64, urllib.request, pathlib
HERE = pathlib.Path(__file__).resolve().parent; B = HERE.parents[1]
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = lambda k, d: next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == k and i + 1 < len(sys.argv)), d)
TYPE, base, outdir, api = args[0], args[1].rstrip('/'), args[2], args[3]
seeds = opt('--seeds', '11,12').split(','); sizes = opt('--sizes', 'default,big').split(','); READ = '--read' in sys.argv
os.makedirs(outdir, exist_ok=True)
intended = {r['key']: r for r in json.loads((HERE.parent.parent / 'rooms.json').read_text())['rooms']}

def shoot():
    from playwright.sync_api import sync_playwright
    out = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
        pg0 = b.new_page(); pg0.goto(base + '/data/rooms.json'); types = [t for t in json.loads(pg0.inner_text('body')) if (t.get('group') or '').lower() == TYPE]; pg0.close()
        only = [k for k in opt('--keys', '').split(',') if k]; types = [t for t in types if not only or t['key'] in only]  # --keys a,b: just these room types
        for t in types:
            for size in sizes:
                w, d = t['cells'] if size == 'default' else [min(16, round(t['cells'][0] * 1.6)), min(16, round(t['cells'][1] * 1.6))]
                for seed in seeds:
                    pg = b.new_page(viewport={'width': 1500, 'height': 2300}); errs = []  # (2026-10-12: tall, because the palette of 65 room types now takes half of a 950-px page and the stage was 253 px high)
                    pg.on('pageerror', lambda e: errs.append(str(e)))
                    pg.on('response', lambda r: errs.append(f'HTTP {r.status} {r.url}') if r.status >= 400 else None)  # a missing mesh or texture (404) counts as an error
                    pg.route('**/api/tw-ratings/**', lambda route: route.fulfill(response=route.fetch(url=api + route.request.url.split('/api/tw-ratings', 1)[1], method=route.request.method, headers=route.request.headers, post_data=route.request.post_data)))
                    pg.goto(base + f'/index.html?nobg&seed={seed}&nofx'); pg.wait_for_selector('body[data-ready="1"]', timeout=120000)
                    settle = lambda tmo=300000: (pg.wait_for_function('tuner.episodes() === 0', timeout=tmo), time.sleep(0.5))
                    # --beside key:w:d  an outdoor room is read with a building on its north side (alone it is an empty court): made first, as in the game
                    bes = opt('--beside', '') if t.get('outdoor') else ''
                    if bes: bk, bw, bd = bes.split(':'); pg.evaluate(f"void tuner.createRoom('{bk}', 4, {5 - int(bd)}, {bw}, {bd})"); settle(); time.sleep(0.5); settle()
                    pg.evaluate(f"void tuner.createRoom('{t['key']}', 4, 5, {w}, {d})"); settle(); time.sleep(1.0); settle()
                    r = pg.evaluate(f"tuner.rooms().find(r => r.type === '{t['key']}')"); L = pg.evaluate(f"tuner.layoutOf('{r['id']}')")
                    tag = f"{t['key']}-{size}-{seed}"
                    json.dump({'key': t['key'], 'cells': [w, d], 'seed': seed, 'purposeFail': L.get('purposeFail'), 'summary': r.get('summary'), 'placements': [[q['id'], q['sku'], q['rule'], q['x'], q['z']] for q in L['placements']],
                               'unplaced': L.get('unplaced'), 'errors': errs, 'overlaps': pg.evaluate("tuner.overlapReport(0.35)"), 'outside': pg.evaluate("tuner.outsideReport(0.6)")}, open(f'{outdir}/{tag}.json', 'w'), indent=1)
                    pg.evaluate("(() => { tuner.hideLabels && tuner.hideLabels(true); })()"); pg.keyboard.press('Escape'); time.sleep(0.3); pg.add_style_tag(content='#hint { display: none !important; }')
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

def gemini(parts, js=False, model='gemini-2.5-pro'):
    body = {'contents': [{'role': 'user', 'parts': parts}], 'generationConfig': {'temperature': 0.1, **({'responseMimeType': 'application/json'} if js else {})}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent', data=json.dumps(body).encode(), method='POST', headers={'Content-Type': 'application/json', 'x-goog-api-key': os.environ['GEMINI_API_KEY']})
    r = json.loads(urllib.request.urlopen(req, timeout=180).read()); txt = r['candidates'][0]['content']['parts'][0]['text']
    return json.loads(txt) if js else txt

BLIND = ("Three pictures of ONE room in a fantasy tabletop game, seen from above at about the distance of players round a table: two high three-quarter views and a top view. "
         "Describe what you see. Then answer: (1) what kind of room is this, in a few words, and how sure are you; (2) what are its main things and where do they stand; "
         "(3) is there one thing the room is built around; (4) what looks wrong, if anything: floating, clipping into a wall or each other, doubled, out of scale, unreadable at this distance. "
         "Say what you actually see, not what a room like this usually has.")
def read(tags):
    res = {}
    for tag in tags:
        key = json.load(open(f'{outdir}/{tag}.json'))['key']; want = intended.get(key, {})
        imgs = []
        for i, name in enumerate(('table', 'table-sw', 'top')):
            imgs += [{'inline_data': {'mime_type': 'image/png', 'data': base64.b64encode(open(f'{outdir}/{tag}-{name}.png', 'rb').read()).decode()}}, {'text': f'[above: view-{i + 1}]'}]
        desc = gemini(imgs + [{'text': BLIND}])
        verdict = gemini([{'text': "A viewer who was told nothing described a room like this:\n\n" + desc + "\n\nThe room was MEANT to read as: " + json.dumps(want.get('reads_as') or want.get('reads_by') or want.get('label')) +
                           " (" + json.dumps(want.get('label')) + "; the piece it is built around is one of " + json.dumps(want.get('focal')) + ").\n" +
                           'Judge only from the description. JSON: {"match": "yes|partly|no", "named_as": "...", "focal_seen": true|false, "problems": ["..."]}'}], js=True)
        res[tag] = {'key': key, 'description': desc, **verdict}
        print(f"{tag:44s} {verdict.get('match'):7s} named: {str(verdict.get('named_as'))[:60]:60s} focal {verdict.get('focal_seen')} problems {len(verdict.get('problems') or [])}", flush=True)
        json.dump(res, open(f'{outdir}/read.json', 'w'), indent=1)
    return res

if __name__ == '__main__':
    tags = shoot() if '--read-only' not in sys.argv else sorted({f.rsplit('-', 1)[0] for f in os.listdir(outdir) if f.endswith('-top.png')})
    if READ or '--read-only' in sys.argv:
        res = read(tags); bad = [t for t, v in res.items() if v.get('match') == 'no']
        print(f"blind read: {sum(v.get('match') == 'yes' for v in res.values())} yes, {sum(v.get('match') == 'partly' for v in res.values())} partly, {len(bad)} no of {len(res)}")
        sys.exit(1 if bad else 0)

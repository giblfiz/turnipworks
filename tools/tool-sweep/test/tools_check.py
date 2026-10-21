#!/usr/bin/env python3
"""The review tools, opened like Harry opens them (2026-10-12): the combined asset rater, the bench queues, the open/shut
pairs page, the "what is waiting" page and the landing block. Every write goes to the test sandbox (tests/tw_sandbox.py);
the live ratings are compared byte for byte before and after.

  python3 tools/tool-sweep/test/tools_check.py                       the live site
  python3 tools/tool-sweep/test/tools_check.py http://127.0.0.1:PORT/ --api http://127.0.0.1:8096   a local copy
"""
import hashlib, io, json, os, sys, time, urllib.request
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # noqa: E402,E702
from playwright.sync_api import sync_playwright  # noqa: E402

args = sys.argv[1:]
BASE = (args[0] if args and not args[0].startswith('--') else 'https://implausible.enterprises/projects/turnip-works/').rstrip('/') + '/'
API_LOCAL = args[args.index('--api') + 1] if '--api' in args else None
REPO = tw_sandbox.REPO
SHOTS = os.environ.get('TW_SHOTS', os.path.expanduser('~/.cache/turnip-works/tools-check/' + tw_sandbox.SID))
os.makedirs(SHOTS, exist_ok=True)
res = []
def check(ok, msg):
    res.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + msg, flush=True)
sha = lambda p: hashlib.sha1(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else None
LIVE_FILES = [os.path.join(tw_sandbox.REVIEWS, f) for f in ('latest.json', 'ratings.jsonl', 'tuner/fire_anchor.jsonl', 'tuner/water_surface.jsonl', 'tuner/hinge.jsonl', 'tuner/wallfit.jsonl')]
before = {f: sha(f) for f in LIVE_FILES}
def sandbox_ratings():
    req = urllib.request.Request((API_LOCAL or 'http://127.0.0.1:8096') + '/ratings', headers=tw_sandbox.HEADERS)
    return json.load(urllib.request.urlopen(req, timeout=10))
def fetch(pg, rel):
    return pg.evaluate(f"fetch({json.dumps(BASE + rel)}, {{cache: 'no-store'}}).then(r => r.json())")

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1600, 'height': 950})
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    if API_LOCAL: tw_sandbox.proxy(pg, API_LOCAL)
    pg.goto(BASE + 'queues/', wait_until='domcontentloaded'); pg.evaluate('localStorage.clear()')
    Q = fetch(pg, 'queues/queues.json'); lib = fetch(pg, 'review-lib/assets.json')
    batches = sorted({a['run'] for a in lib['assets']})

    # ---------------------------------------------------------------- the combined rater
    def open_rater(q=''):
        pg.goto(BASE + 'review-lib/' + q, wait_until='domcontentloaded')
        pg.wait_for_function(r'window.__twDebug && /^\d+ match/.test(document.getElementById("count").textContent)', timeout=120000)
        if pg.evaluate('__twDebug.filtered.length === 0'):
            check(pg.locator('#done').is_visible() and pg.evaluate('__twDebug.selected === null'), 'rater: a fully reviewed batch shows its completion state')
        # Inspection is valid after Harry has finished rating the entire batch.
        pg.select_option('#f-status', 'all')
        pg.wait_for_function('window.__tw && window.__tw.sku && __twDebug.VIEWS.every(v => v.pivot.children.length === 1) && document.getElementById("loading").hidden', timeout=120000)
        return pg.evaluate('window.__tw.sku')
    open_rater()
    check(pg.locator('#runlabel').inner_text() == 'Library', f"rater: the combined page loads ({len(lib['assets'])} assets, {len(batches)} batches)")
    opts = pg.evaluate('[...document.getElementById("f-batch").options].map(o => o.value).filter(Boolean)')
    check(opts == batches and not pg.evaluate('document.getElementById("f-batch-wrap").hidden'), f'rater: a Batch filter with every batch ({len(opts)})')
    # one mesh, one kit piece and one flat: three views drawn, the plate beside it
    samples = []
    for want in ('mesh', 'kit', 'flat'):
        a = next((a for a in lib['assets'] if (a['group'] == 'flat') == (want == 'flat') and ((a['placement'] == 'kit') == (want == 'kit') or want == 'flat')), None)
        if a: samples.append((want, a))
    for want, a in samples:
        sku = open_rater(f"?batch={a['run']}")
        vis = pg.evaluate('__twDebug.filtered')
        by = {x['sku']: x for x in lib['assets']}
        check(set(vis) == {x['sku'] for x in lib['assets'] if x['run'] == a['run']}, f"rater: ?batch={a['run']} shows only that batch ({len(vis)} assets with All selected)")
        pg.evaluate(f"document.querySelector('#assets button[title={json.dumps(a['sku'])}]')?.click()")
        pg.wait_for_function(f"window.__tw.sku === {json.dumps(a['sku'])} && __twDebug.VIEWS.every(v => v.pivot.children.length === 1) && document.getElementById('loading').hidden", timeout=60000)
        time.sleep(1.2)
        plate = pg.locator('#plate').evaluate('img => img.complete && img.naturalWidth > 0 && !img.src.startsWith("data:")')
        views = []
        for i in range(3):   # each of the three views really shows a model: many colours, not a flat background
            png = pg.locator('.cell.view').nth(i).screenshot()
            im = Image.open(io.BytesIO(png)).convert('RGB').resize((96, 96)); views.append(len(im.getcolors(96 * 96)))
        drawn = min(views)
        shot = f"{SHOTS}/tw-tools-rater-{want}.png"; pg.screenshot(path=shot)
        check(plate and drawn > 40, f"rater: {want} {a['run']}/{a['sku']} drawn in three views ({views} colours) beside its source plate  [{shot}]")
    # a score lands under the asset's OWN batch, in the sandbox
    a = samples[0][1]; open_rater(f"?batch={a['run']}"); first = pg.evaluate('window.__tw.sku')
    score_key = f"{a['run']}/{first}/model"
    live_before_score = json.load(urllib.request.urlopen((API_LOCAL or 'http://127.0.0.1:8096') + '/ratings', timeout=10)).get(score_key)
    pg.keyboard.press('4'); pg.wait_for_function(f'window.__tw.sku !== {json.dumps(first)}', timeout=20000); time.sleep(0.5)
    got = sandbox_ratings().get(f"{a['run']}/{first}/model")
    check(got and got['stars'] == 4, f"rater: a 4 on {first} is stored as {a['run']}/{first}/model (sandbox)")
    live = json.load(urllib.request.urlopen((API_LOCAL or 'http://127.0.0.1:8096') + '/ratings', timeout=10))
    check(live.get(score_key) == live_before_score, 'rater: the sandbox score leaves the existing live rating unchanged')

    # ---------------------------------------------------------------- the bench
    # Exercise first-time automatic guesses even for assets Harry has aligned.
    # Only these read responses are fixtures; all models/queues/guess code are real.
    def first_time_read(route):
        if route.request.method == 'GET':
            route.fulfill(status=200, content_type='application/json', body='{}')
        else:
            route.fallback()  # Any write must still reach the real sandbox backend.
    for endpoint in ('fire_anchors', 'water_surfaces', 'hinges'):
        pg.route('**/api/tw-ratings/tuner/' + endpoint, first_time_read)
    def bench(mode, sku=None):
        pg.goto(BASE + f'align/?mode={mode}&filter=all' + (f'&sku={sku}' if sku else ''), wait_until='domcontentloaded')
        pg.wait_for_function('window.bench && window.bench.cur() && document.getElementById("busy").hidden' + (f' && bench.cur().sku === {json.dumps(sku)}' if sku else ''), timeout=120000)
        time.sleep(0.8)
    bench('fire')
    n = pg.evaluate('({fire: bench.Q.fire.map(e => e.mesh), water: bench.Q.water.map(e => e.mesh), open: bench.Q.open.map(e => e.mesh)})')
    for m in ('fire', 'water', 'open'):
        check(sorted(n[m]) == sorted(Q['bench'][m]), f"bench: the {m} queue the page builds is the published list ({len(n[m])})")
    pick = lambda m, pred: next((e for e in pg.evaluate(f'bench.Q.{m}.map(e => ({{sku: e.sku, mesh: e.mesh, id: e.id, twin: e.twin && e.twin.sku}}))') if pred(e)), None)
    newest = lambda e: not e['mesh'].startswith('inn-')
    f = pick('fire', lambda e: newest(e) and 'flame-bowl' in e['id']) or pick('fire', newest)
    w = pick('water', newest); o = pick('open', lambda e: newest(e) and e['twin'])
    for mode, e in (('fire', f), ('water', w), ('open', o)):
        if not e: check(False, f'bench: no post-inn piece in the {mode} queue'); continue
        bench(mode, e['sku']); time.sleep(1.5)
        st = pg.evaluate('(() => { const s = bench.state() || {}; return {n: (s.list || []).length, found: s.found, foot: !!s.foot, mode: s.mode || (s.p && s.p.mode)}; })()')
        saved = pg.evaluate('document.getElementById("saved")?.innerText || document.body.innerText.match(/not aligned yet|aligned [0-9-]+/)?.[0] || ""')
        shot = f"{SHOTS}/tw-tools-bench-{mode}.png"; pg.screenshot(path=shot)
        ok = st['n'] >= 1 if mode == 'fire' else bool(st['found'] and st['foot']) if mode == 'water' else st['mode'] in ('swap', 'whole', 'lid', 'hinge')
        check(ok and 'not aligned' in saved, f"bench: {mode} opens {e['sku']} with an automatic guess {json.dumps(st)}; \"{saved[:40]}\"  [{shot}]")

    # ---------------------------------------------------------------- open/shut pairs
    pg.goto(BASE + 'openclose/pairs/', wait_until='domcontentloaded')
    pg.wait_for_function('window.__pairs && window.__pairs.loaded', timeout=90000); time.sleep(1)
    pairs = fetch(pg, 'queues/pairs.json')['pairs']
    check(pg.evaluate('__pairs.n') == len(pairs) == Q['pairs'] and pg.locator('#list button').count() == len(pairs), f'open/shut tester: {len(pairs)} library pairs listed')
    last = next((i for i, x in enumerate(pairs) if not x['mesh'].startswith('inn-')), 0)
    pg.locator('#list button').nth(last).click(); pg.wait_for_function(f'window.__pairs.loaded && __pairs.i === {last}', timeout=60000); time.sleep(1)
    pg.screenshot(path=f'{SHOTS}/tw-tools-pairs-side.png'); pg.keyboard.press('o'); time.sleep(0.5)
    check(pg.evaluate('__pairs.mode === "swap" && __pairs.showOpen === true'), f"open/shut tester: {pairs[last]['sku']} side by side, then O swaps to {pairs[last]['open']['sku']}  [{SHOTS}/tw-tools-pairs-side.png]")

    # ---------------------------------------------------------------- what is waiting
    pg.goto(BASE + 'queues/', wait_until='domcontentloaded')
    pg.wait_for_function('window.__twQueues', timeout=30000)
    c = pg.evaluate('window.__twQueues.then(r => r)')
    exp_total = sum(len(s) for page in Q['rater'] for s in page['runs'].values())
    check(c and c['rate']['total'] == exp_total and c['rate']['left'] <= exp_total, f"queues page: to rate {c['rate']['left']} of {c['rate']['total']}")
    check(all(c['bench'][m]['total'] == len(Q['bench'][m]) for m in ('fire', 'water', 'open')), f"queues page: fire {c['bench']['fire']['left']}/{c['bench']['fire']['total']}, water {c['bench']['water']['left']}/{c['bench']['water']['total']}, open/shut {c['bench']['open']['left']}/{c['bench']['open']['total']} to confirm")
    pg.screenshot(path=f'{SHOTS}/tw-tools-queues.png', full_page=True)
    pg.goto(BASE, wait_until='domcontentloaded')
    try:
        pg.wait_for_function('window.__twQueues', timeout=30000); pg.evaluate('window.__twQueues.then(r => r)')
        tiles = pg.locator('#tw-queues .q a').evaluate_all('nodes => nodes.map(n => ({label:n.querySelector(".lab")?.textContent, count:n.querySelector(".n")?.textContent, total:n.querySelector(".of")?.textContent}))')
        expected = [('to rate', c['rate']), ('fire anchors to confirm', c['bench']['fire']), ('water surfaces to confirm', c['bench']['water']), ('open / shut to confirm', c['bench']['open'])]
        if 'wall_families' in Q:
            expected.append(('wall families to approve', c['walls']))
        tiles_ok = len(tiles) == len(expected) and all(t['label'].startswith(label) and int(t['count']) == values['left'] and t['total'] == f"of {values['total']}" for t, (label, values) in zip(tiles, expected))
    except Exception: tiles_ok = False  # noqa: BLE001, E701
    pg.screenshot(path=f'{SHOTS}/tw-tools-landing.png')
    check(tiles_ok, f'landing page: every "Waiting for you" count matches its queue  [{SHOTS}/tw-tools-landing.png]')
    check(not errs, f'no page errors {errs[:3]}')
    b.close()

after = {f: sha(f) for f in LIVE_FILES}
check(before == after, "Harry's live ratings and bench records are byte-identical")
print(f"{'PASS' if all(res) else 'FAIL'} tools_check: {sum(res)}/{len(res)}")
sys.exit(0 if all(res) else 1)

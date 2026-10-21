#!/usr/bin/env python3
"""Does the figure-set gallery work? Opens a served copy in Chromium (default) or Firefox and checks it end to end.

    python3 gallery_check.py BASE_URL SET_DIR [--firefox] [--shots DIR] [--api http://127.0.0.1:8096]
    DISPLAY=:99 ... gallery_check.py BASE_URL SET_DIR --firefox       (headless Firefox has no WebGL on this box)

BASE_URL is a deploy_set.sh copy being served (http://127.0.0.1:8851/figures-pilot/set/), SET_DIR the set it was made
from (its manifest.json is where the expected counts come from). Checks: loads with no console or page errors and no
4xx; time to the first tiles; scrolling to the bottom and back; filter and search counts; the inspector (views, detail
files, bases, turntable speed, arrow keys with GPU memory staying flat, idle when nothing moves, released when
closed); a verdict sent through the TEST SANDBOX (tests/tw_sandbox.py: header X-TW-Test, nothing reaches the live
records); the drawing size on a pixel-ratio-2 screen; the words shown when the list or a file is missing.
--shots DIR also saves pictures of the grid and the inspector at desktop, laptop and phone size.
Exit code 0 only if every check passed."""
import json, os, pathlib, re, sys, time
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tests')); import tw_sandbox  # noqa: E402,E401  every write goes to the test sandbox
from playwright.sync_api import sync_playwright  # noqa: E402

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = lambda k, d=None: next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith(k + '=')), d)
if len(args) < 2: sys.exit(__doc__)
BASE = args[0] if args[0].endswith('/') else args[0] + '/'; SET = pathlib.Path(args[1])
FIREFOX = '--firefox' in sys.argv; SHOTS = opt('--shots'); API = opt('--api', 'http://127.0.0.1:8096'); NAME = 'firefox' if FIREFOX else 'chromium'
figs = [f for f in json.load(open(SET / 'manifest.json'))['figures'] if f and f.get('id')]; N = len(figs)

RACE = {'human': 'Human', 'elf': 'Elf', 'dwarf': 'Dwarf', 'small': 'Small folk', 'orc': 'Orc', 'tiefling': 'Tiefling', 'dragonborn': 'Dragonborn'}
GROUP = {'hero': 'Heroes Hero', 'townsfolk': 'Townsfolk', 'foe': 'Foes Foe', 'beast': 'Beasts Beast', 'large': 'Large creature'}
def hay(f):   # the page's rule, written again here: a word matches the start of a word; from four letters, anywhere
    return ' '.join(str(x) for x in [f['id'], f.get('name'), *(f.get('tags') or []), *(f.get('srd') or []), f.get('cls'), f.get('race'), RACE.get(f.get('race')), f.get('group'), GROUP.get(f.get('group')), {'m': 'man', 'f': 'woman'}.get(f.get('gender'))] if x).lower()
def found(q):
    out = []
    for f in figs:
        h = hay(f); words = [w for w in re.split(r'[^a-z0-9]+', h) if w]
        if all(any(x.startswith(w) for x in words) or (len(w) >= 4 and w in h) for w in re.split(r'[^a-z0-9]+', q.lower()) if w): out.append(f['id'])
    return out

results = []; logs = []
def check(name, ok, detail=''):
    results.append((name, bool(ok), detail)); print(f"  {'ok  ' if ok else 'FAIL'}  {name}{'  ' + str(detail) if detail != '' else ''}", flush=True)
def watch(pg, sink):
    pg.on('console', lambda m: sink.append(f'{m.type}: {m.text[:300]}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: sink.append(f'PAGEERROR: {str(e)[:400]}'))
    pg.on('response', lambda r: sink.append(f'{r.status} {r.url}') if r.status >= 400 else None)
loaded = lambda pg, t=60000: pg.wait_for_function('window.__gal.cur && window.__gal.cur.loaded === true', timeout=t)
def open_page(b, w, h, dsf=1, sink=None, path=''):
    pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=dsf); tw_sandbox.proxy(pg, API)
    if sink is not None: watch(pg, sink)
    pg.goto(BASE + path); pg.wait_for_function('window.__ready === true', timeout=60000); return pg

with sync_playwright() as p:
    if FIREFOX: b = p.firefox.launch(headless=not os.environ.get('DISPLAY'), firefox_user_prefs={'webgl.force-enabled': True, 'layers.acceleration.force-enabled': True})
    else: b = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
    print(f'== {NAME}: {BASE}  ({N} figures in {SET}/manifest.json)')

    # ---- the grid
    t0 = time.time(); pg = open_page(b, 1600, 1000, sink=logs)
    nav = pg.evaluate('({tiles: Math.round(window.__tilesAt), n: document.querySelectorAll(".tile").length, shown: window.__gal.shown.length, counts: document.querySelector("#counts").innerText})')
    check('all the figures have a tile', nav['n'] == N and nav['shown'] == N, f"{nav['n']} tiles")
    check('first tiles within 2 s of opening the page', nav['tiles'] < 2000, f"{nav['tiles']} ms (whole load as the test saw it: {time.time() - t0:.2f} s)")
    check('the header counts', f'{N} of about' in nav['counts'].replace('\n', ' ') and 'NEW since' in nav['counts'] and 'none judged yet' in nav['counts'], nav['counts'].replace('\n', ' ')[:140])
    pg.wait_for_timeout(1200)
    pics = pg.evaluate('(() => { const v = [...document.querySelectorAll(".tile")].filter(t => { const r = t.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }); return { inView: v.length, drawn: v.filter(t => t.querySelector("img")?.naturalWidth > 0).length, none: v.filter(t => t.querySelector(".pic.none")).length, requested: performance.getEntriesByType("resource").filter(e => e.name.includes("/thumbs/")).length }; })()')
    check('pictures in view are drawn, the rest are not fetched yet (lazy)', pics['drawn'] + pics['none'] == pics['inView'] and pics['requested'] < N * 0.6, pics)
    scroll = pg.evaluate('''() => new Promise(done => { const total = document.documentElement.scrollHeight - innerHeight, gaps = []; let last = performance.now(), i = 0; const steps = 150, t0 = last;
        const f = (now) => { gaps.push(now - last); last = now; i++; const k = i <= steps ? i / steps : 2 - i / steps; scrollTo(0, total * k);
          if (i < steps * 2) requestAnimationFrame(f); else done({ height: total, frames: gaps.length, fps: Math.round(gaps.length * 1000 / (now - t0)), worst_ms: Math.round(Math.max(...gaps.slice(2))), over_50ms: gaps.slice(2).filter(g => g > 50).length }); };
        requestAnimationFrame(f); })''')
    check('scrolls to the bottom and back without stalling', scroll['fps'] >= 30 and scroll['worst_ms'] < 250, scroll)
    if SHOTS: pg.wait_for_timeout(600); pg.screenshot(path=f'{SHOTS}/{NAME}-desktop-grid.png')

    # ---- filters and search
    def shown(): return pg.evaluate('window.__gal.shown')
    for g in ['hero', 'townsfolk', 'foe', 'beast', 'large']:
        pg.click(f'#groups button[data-group="{g}"]'); want = [f['id'] for f in figs if f.get('group') == g]
        check(f'group button "{g}"', sorted(shown()) == sorted(want) and f'Showing {len(want)} of {N}' in pg.inner_text('#shown') and pg.inner_text(f'#groups button[data-group="{g}"] .n') == str(len(want)), len(want))
    pg.click('#groups button[data-group="hero"]'); pg.click('#races button[data-race="dwarf"]'); pg.click('#genders button[data-gender="f"]')
    want = [f['id'] for f in figs if f.get('group') == 'hero' and f.get('race') == 'dwarf' and f.get('gender') == 'f']
    check('heroes + dwarf + women', sorted(shown()) == sorted(want) and len(want) > 0, len(want))
    pg.select_option('#cls', 'cleric'); want = [i for i in want if next(f for f in figs if f['id'] == i).get('cls') == 'cleric']
    check('... + class cleric', sorted(shown()) == sorted(want), len(want))
    vis = pg.evaluate('[...document.querySelectorAll(".tile")].filter(t => t.offsetParent !== null).length')
    check('only the matching tiles are on the page', vis == len(want), vis)
    pg.click('#clear'); check('"Clear filters" brings everything back', len(shown()) == N)
    for q in ['bugbear', 'cult fanatic', 'dwarf guard', 'orc', 'bear', 'zzzz']:
        pg.fill('#q', q); pg.wait_for_timeout(200); want = found(q)
        check(f'search "{q}"', sorted(shown()) == sorted(want) and (len(want) > 0) == (q != 'zzzz'), f'{len(want)} figures')
    check('no match: the page says so', 'No figure matches' in pg.inner_text('#empty'))
    pg.fill('#q', ''); pg.wait_for_timeout(200)
    latest = max(f['batch'] for f in figs); pg.check('#fresh'); check('"New only" = the latest batch', sorted(shown()) == sorted(f['id'] for f in figs if f['batch'] == latest), len(shown())); pg.uncheck('#fresh')
    pg.select_option('#sort', 'new'); s = shown(); by = {f['id']: f for f in figs}
    check('"Newest first" order', all(by[s[i]]['published_at'] >= by[s[i + 1]]['published_at'] for i in range(len(s) - 1)) and len(s) == N); pg.select_option('#sort', 'group')
    pg.click('#sizes button[data-size="s"]'); small = pg.evaluate('document.querySelector(".tile").getBoundingClientRect().width'); pg.click('#sizes button[data-size="l"]'); large = pg.evaluate('document.querySelector(".tile").getBoundingClientRect().width'); pg.click('#sizes button[data-size="m"]')
    check('picture size buttons', small < 160 < large, f'{small:.0f} px and {large:.0f} px')

    # ---- the inspector
    order = shown(); first = order[0]
    check('no WebGL canvas work before a figure is opened', pg.evaluate('typeof window.__gal.mem') == 'undefined')
    pg.evaluate('scrollTo(0, 0)'); pg.click(f'.tile[data-id="{first}"]'); loaded(pg)
    cur = pg.evaluate('window.__gal.cur'); f0 = by[first]
    check('opening a figure shows its game file first', cur['id'] == first and cur['tier'] == f0['recommended'], f"{first}: {cur['tier']} file, on screen after {cur['ms']} ms (first use: the 3D code is fetched too)")
    check("the game's lighting module is in use", pg.evaluate('window.__gal.fx') is True)
    feet = pg.evaluate('window.__gal.feet()'); check('feet on the base, height as stated', abs(feet['above_base_ft']) < 0.03 and abs(feet['height_ft'] - f0['overall_ft']) < 0.15, feet)
    panel = pg.inner_text('#side'); check('the facts panel', all(x in panel for x in [f0['name'], first, 'triangles', 'Stands in for' if f0.get('srd') else first]), '')
    for v in ['table', 'lean', 'close', 'front', 'side', 'top']:
        pg.click(f'#views button[data-view="{v}"]'); pg.wait_for_timeout(250)
        if SHOTS and v == 'table': pg.wait_for_timeout(900); pg.screenshot(path=f'{SHOTS}/{NAME}-desktop-inspector-table.png')
    cam = pg.evaluate('window.__gal.drawCount()'); check('view buttons move the camera and draw', cam > 10, f'{cam} frames drawn so far')
    pg.click('#views button[data-view="close"]')
    for t in pg.evaluate('[...document.querySelectorAll("#tiers button")].map(b => b.dataset.tier)'):
        pg.click(f'#tiers button[data-tier="{t}"]'); loaded(pg); c = pg.evaluate('window.__gal.cur'); ft = pg.evaluate('window.__gal.feet()')
        check(f'detail file "{t}" loads and stands the same', c['tier'] == t and abs(ft['above_base_ft']) < 0.03 and abs(ft['height_ft'] - f0['overall_ft']) < 0.15, f"{c['ms']} ms, {ft['height_ft']} ft tall")
    pg.click(f'#tiers button[data-tier="{f0["recommended"]}"]'); loaded(pg)
    for bs in ['dark', 'ring', 'none', 'rim']:
        pg.click(f'#bases button[data-base="{bs}"]'); pg.wait_for_timeout(150); ft = pg.evaluate('window.__gal.feet()')
        check(f'base "{bs}": the figure stands on it', abs(ft['above_base_ft']) < 0.03, ft['above_base_ft'])
    pg.click('#colors button[data-color="3"]'); pg.click('#look-day'); pg.wait_for_timeout(300); pg.click('#look-night'); pg.click('#colors button[data-color="0"]')
    check('Night is the look after Day then Night', pg.evaluate('document.querySelector("#look-night").classList.contains("on") && !document.querySelector("#look-day").classList.contains("on")'))
    pg.check('#spin'); pg.wait_for_timeout(300)
    turn = pg.evaluate('() => new Promise(r => { const a = window.__gal.spinNow(), t = performance.now(); setTimeout(() => r({ deg: (window.__gal.spinNow() - a) * 180 / Math.PI, s: (performance.now() - t) / 1000, fps: window.__gal.fps }), 2000); })')
    check('turntable: 72 degrees in 2 seconds (6 turns a minute)', abs(turn['deg'] - 36 * turn['s']) < 6 and 1.9 < turn['s'] < 3, f"{turn['deg']:.1f} degrees in {turn['s']:.2f} s, drawing at {turn['fps']:.0f} fps")
    pg.uncheck('#spin'); pg.wait_for_timeout(2500)
    d1 = pg.evaluate('window.__gal.drawCount()'); pg.wait_for_timeout(2000); d2 = pg.evaluate('window.__gal.drawCount()')
    check('idle when nothing moves', d2 == d1, f'{d2 - d1} frames drawn in 2 s of doing nothing; readout: {pg.inner_text("#fps")}')
    if SHOTS: pg.mouse.move(800, 500); pg.wait_for_timeout(500); pg.screenshot(path=f'{SHOTS}/{NAME}-desktop-inspector.png')

    # ---- arrow keys, GPU memory
    pg.click('#pos'); mem = []
    for i in range(30):
        pg.keyboard.press('ArrowRight'); pg.wait_for_function(f'window.__gal.cur && window.__gal.cur.id === {json.dumps(order[i + 1])} && window.__gal.cur.loaded', timeout=60000); pg.wait_for_timeout(120)
        mem.append(pg.evaluate('window.__gal.mem()'))
    g = [m['geometries'] for m in mem]; t = [m['textures'] for m in mem]
    check('right arrow 30 times: GPU memory flat', len(set(g[2:])) == 1 and len(set(t[2:])) == 1 and max(m['kept'] for m in mem) <= 4, f'geometries {g[0]} -> {g[-1]} (min {min(g)}, max {max(g)}); textures {t[0]} -> {t[-1]} (min {min(t)}, max {max(t)}); files kept parsed: {mem[-1]["kept"]}')
    pre = [e for e in pg.evaluate('performance.getEntriesByType("resource").map(e => e.name)') if order[31] in e]
    check("the next figure's game file is fetched ahead", len(pre) >= 1, order[31])
    for i in range(30): pg.keyboard.press('ArrowLeft')   # fast, without waiting
    pg.wait_for_function(f'window.__gal.cur && window.__gal.cur.id === {json.dumps(first)} && window.__gal.cur.loaded', timeout=60000); pg.wait_for_timeout(1500); m2 = pg.evaluate('window.__gal.mem()')
    check('left arrow 30 times in a row, not waiting: back at the first, memory the same', m2['geometries'] == g[-1] and m2['textures'] == t[-1] and m2['kept'] <= 4, m2)

    # ---- verdicts, through the test sandbox
    pg.evaluate('document.querySelector("#auto").checked || document.querySelector("#auto").click()')
    pg.keyboard.press('g'); pg.wait_for_function('window.__gal.lastSent', timeout=15000); sent = pg.evaluate('window.__gal.lastSent')
    check('G sends "good miniature" (test sandbox)', sent['id'] == first and sent['verdict'] == 'good_miniature' and sent['answer'].get('ok') is True and sent['answer'].get('sandbox') == tw_sandbox.SID and sent['answer'].get('kind') == 'figures_pilot', sent['answer'])
    pg.wait_for_function(f'window.__gal.cur && window.__gal.cur.id === {json.dumps(order[1])}', timeout=15000); check('after a verdict the next figure comes up', True, pg.inner_text('#sent')[:110])
    pg.fill('#note', 'TEST note from gallery_check.py'); pg.evaluate('window.__gal.lastSent = null'); pg.click('#v-bad'); pg.wait_for_function('window.__gal.lastSent', timeout=15000); sent2 = pg.evaluate('window.__gal.lastSent')
    check('"Not good enough" button with a note', sent2['id'] == order[1] and sent2['verdict'] == 'not_good_enough' and sent2['answer'].get('sandbox') == tw_sandbox.SID)
    rec = [json.loads(l) for l in open(pathlib.Path(tw_sandbox.REVIEWS) / 'test-sandbox' / tw_sandbox.SID / 'tuner' / 'figures_pilot.jsonl')]
    d = rec[-1]['data']; check('what the server stored', len(rec) == 2 and rec[0]['name'] == first and rec[1]['note'] == 'TEST note from gallery_check.py' and d['page'] == 'gallery' and d['figure'] == order[1] and set(d) >= {'verdict', 'figure', 'page', 'base', 'seat_colour', 'tier', 'night', 'camera', 'v', 'screen', 'ua'} and d['camera'] and d['v'] != '__V__', {k: d[k] for k in ('verdict', 'base', 'seat_colour', 'tier', 'night', 'v')})
    pg.wait_for_timeout(300); pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    closed = pg.evaluate('({open: document.body.classList.contains("open"), running: window.__gal.running(), mem: window.__gal.mem(), judged: document.querySelector("#judged").innerText, good: document.querySelectorAll(".tile.good").length, bad: document.querySelectorAll(".tile.bad").length, mark: document.querySelector(".tile.good .vd").innerText})')
    check('Esc closes; the 3D stops and gives the figure back', not closed['open'] and not closed['running'] and closed['mem']['geometries'] < g[-1] and closed['mem']['textures'] < t[-1], closed['mem'])
    check('verdict marks on the tiles and in the header', closed['good'] == 1 and closed['bad'] == 1 and '2 judged: 1 good, 1 not' in closed['judged'], f"{closed['judged']} / tile mark: {closed['mark']}")
    pg.check('#unjudged'); check('"Not judged yet" leaves out the two', len(shown()) == N - 2 and first not in shown()); pg.uncheck('#unjudged')
    pg.reload(); pg.wait_for_function('window.__ready === true'); check('verdicts are remembered after a reload (this browser)', '2 judged: 1 good, 1 not' in pg.inner_text('#judged'))
    if SHOTS: pg.wait_for_timeout(800); pg.screenshot(path=f'{SHOTS}/{NAME}-desktop-grid-judged.png')
    pg.close()
    errs = [l for l in dict.fromkeys(logs)]
    check('no console errors, page errors or 4xx answers in all of the above', not errs, errs[:6] if errs else '')

    # ---- a pixel-ratio-2 screen (a retina Mac)
    l2 = []; pg = open_page(b, 1280, 720, dsf=2, sink=l2, path=f'#{first}'); loaded(pg); pg.wait_for_timeout(400); buf = pg.evaluate('window.__gal.buffer()')
    check('pixel ratio 2: drawn at 1.5 x the CSS size, not 4 x', buf['dpr'] == 2 and buf['ratio'] == 1.5 and abs(buf['w'] - buf['cssW'] * 1.5) <= 1 and abs(buf['h'] - buf['cssH'] * 1.5) <= 1, buf)
    check('a link with #id opens that figure', pg.evaluate('window.__gal.cur.id') == first and not l2, l2[:3] if l2 else '')
    box = pg.evaluate('(() => { const out = {}; for (const id of ["fps", "nav", "close", "l-aids", "look-day"]) { const r = document.querySelector("#" + id).getBoundingClientRect(); out[id] = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; } out.stage = [document.querySelector("#stage").clientWidth, document.querySelector("#stage").clientHeight]; return out; })()')
    check('laptop: every control over the 3D view is inside it', box['l-aids'][2] <= box['stage'][0] and box['l-aids'][3] < 140 and box['fps'][3] <= box['stage'][1] and box['close'][1] >= 0, box)
    if SHOTS:
        pg.wait_for_timeout(900); pg.screenshot(path=f'{SHOTS}/{NAME}-laptop-inspector.png'); pg.keyboard.press('Escape'); pg.wait_for_timeout(700); pg.screenshot(path=f'{SHOTS}/{NAME}-laptop-grid.png')
    pg.close()

    # ---- a phone
    l3 = []; pg = open_page(b, 420, 860, dsf=2, sink=l3); pg.wait_for_timeout(700)
    cols = pg.evaluate('(() => { const t = [...document.querySelectorAll(".tile")].slice(0, 6).map(e => e.getBoundingClientRect()); return { across: t.filter(r => r.top === t[0].top).length, wide: document.documentElement.scrollWidth <= innerWidth }; })()')
    check('phone width: 2 or 3 tiles across, nothing wider than the screen', cols['across'] in (2, 3) and cols['wide'], cols)
    first_tile = pg.evaluate('Math.round(document.querySelector(".tile").getBoundingClientRect().top)'); check('phone width: the first tiles start in the top half of the screen', first_tile < 430, f'{first_tile} px down')
    pg.click('#more-btn'); check('phone width: "More filters" opens the rest', pg.evaluate('document.querySelector("#races").offsetParent !== null && document.querySelector("#sort").offsetParent !== null')); pg.click('#more-btn')
    if SHOTS: pg.screenshot(path=f'{SHOTS}/{NAME}-phone-grid.png')
    pg.click(f'.tile[data-id="{order[0]}"]'); loaded(pg); pg.wait_for_timeout(900); ph = pg.evaluate('(() => { const s = document.querySelector("#stage").getBoundingClientRect(), d = document.querySelector("#side").getBoundingClientRect(); return { stage: [Math.round(s.width), Math.round(s.height)], panelTop: Math.round(d.top), panelH: Math.round(d.height), wide: document.documentElement.scrollWidth <= innerWidth }; })()')
    check('phone width: inspector fills the screen, 3D above, panel below', ph['stage'][0] == 420 and ph['stage'][1] > 300 and ph['panelTop'] >= ph['stage'][1] - 1 and ph['panelH'] > 250 and ph['wide'] and not l3, ph)
    pb = pg.evaluate('(() => { const R = (q) => { const r = document.querySelector(q).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }; return { aids: R("#l-aids"), spin: R("#l-spin"), fps: R("#fps"), next: R("#next"), firstView: R("#views button"), stage: R("#stage") }; })()')
    check('phone width: the toggles sit at the foot of the 3D view, inside it, clear of the readout', pb['aids'][2] <= 420 and pb['aids'][3] <= pb['stage'][3] and pb['spin'][1] > pb['stage'][3] - 60 and pb['fps'][3] <= pb['spin'][1] and pb['next'][2] <= 420, pb)
    if SHOTS: pg.screenshot(path=f'{SHOTS}/{NAME}-phone-inspector.png'); pg.evaluate('document.querySelector("#side").scrollTo(0, 400)'); pg.wait_for_timeout(300); pg.screenshot(path=f'{SHOTS}/{NAME}-phone-inspector-scrolled.png')
    pg.close()

    # ---- when things are missing, the page says so in words (these make 404s on purpose, in pages of their own)
    pg = b.new_page(viewport={'width': 1000, 'height': 700}); pg.route('**/manifest.json*', lambda r: r.fulfill(status=404, body='no'))
    pg.goto(BASE); pg.wait_for_function('window.__ready === true'); msg = pg.inner_text('#empty'); check('list of figures missing: said in words', 'manifest.json is missing' in msg and 'Nothing to show' in msg, msg[:120]); pg.close()
    pg = b.new_page(viewport={'width': 1000, 'height': 700}); pg.route('**/manifest.json*', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps({'updated': '2026-10-06T08:00:00-07:00', 'expected_total': 450, 'batch': 0, 'figures': []})))
    pg.goto(BASE); pg.wait_for_function('window.__ready === true'); msg = pg.inner_text('#empty'); check('no figures yet: said in words', 'No figures have been published yet' in msg and '0 of about 450' in pg.inner_text('#counts').replace('\n', ' '), msg[:80]); pg.close()
    pg = b.new_page(viewport={'width': 1000, 'height': 700}); pg.route(f'**/tiers/{order[2]}--*', lambda r: r.fulfill(status=404, body='no'))
    pg.goto(BASE + f'#{order[2]}'); pg.wait_for_function('document.querySelector("#busy").classList.contains("err")', timeout=60000); msg = pg.inner_text('#busy')
    check('a 3D file missing: said in words, the rest still works', 'could not be fetched' in msg and 'not there' in msg, msg[:150])
    pg.keyboard.press('ArrowRight'); loaded(pg); check('... and the next figure still opens', pg.evaluate('window.__gal.cur.id') == order[3] and pg.evaluate('document.querySelector("#busy").style.display') == 'none'); pg.close()
    pg = b.new_page(viewport={'width': 1000, 'height': 700}); pg.add_init_script('HTMLCanvasElement.prototype.getContext = function () { return null; };')
    pg.goto(BASE + f'#{order[0]}'); pg.wait_for_function('document.querySelector("#busy").classList.contains("err")', timeout=60000); msg = pg.inner_text('#busy')
    check('no WebGL: said in words, the grid still there', 'would not start WebGL' in msg and pg.evaluate('document.querySelectorAll(".tile").length') == N, msg[:110]); pg.close()
    b.close()

bad = [r for r in results if not r[1]]
print(f"== {NAME}: {len(results) - len(bad)} of {len(results)} checks passed" + (''.join(f'\n   FAILED: {n}  {d}' for n, _, d in bad)))
sys.exit(1 if bad else 0)

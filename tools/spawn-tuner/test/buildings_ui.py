"""The Buildings bench (tools/spawn-tuner/buildings/): many generated buildings as floor plans, the three dials, notes.
G1 the page loads and draws a card per type x size x seed, each with a panel per storey, and no console errors
G2 every card says how many rules its plan keeps; the header sums them
G3 the loops dial changes a crypt's door count (more links put back); "type default" puts it back
G4 the envelope dial turns an inn's plan from packed to carved
G5 storeys, street side and outbuildings redraw the plans
G6 a card's "Open in 3D" link carries the plan (build, w, d, seed, storeys) and the overridden dials only
G7 a card's note and the global note reach the write-back (the test sandbox), with the dials and the card
python buildings_ui.py [API_ORIGIN] [--shots DIR]     (serves tools/spawn-tuner itself; API_ORIGIN e.g. http://127.0.0.1:8096)"""
import sys, os, json, threading, functools, http.server, socketserver, urllib.request, urllib.parse
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox
from playwright.sync_api import sync_playwright
args = [a for a in sys.argv[1:] if not a.startswith('--')]; api_origin = args[0] if args else 'http://127.0.0.1:8096'
shots = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT)); srv.daemon_threads = True
threading.Thread(target=srv.serve_forever, daemon=True).start(); base = f'http://127.0.0.1:{srv.server_address[1]}'
fails = 0
def check(n, ok, ev=''):
    global fails; print(('PASS ' if ok else 'FAIL ') + n + (f'  [{ev}]' if ev else ''), flush=True); fails += 0 if ok else 1
def sandbox(kind='note'):
    try:
        with urllib.request.urlopen(urllib.request.Request(f'{api_origin}/sandbox', headers=tw_sandbox.HEADERS), timeout=10) as r: ok = json.loads(r.read()).get('sandbox') == tw_sandbox.SID
    except Exception: ok = False
    # the server keeps the sandbox beside the live records (tw_sandbox.REVIEWS); the in-repo folder is for a throwaway server
    for root in (tw_sandbox.REVIEWS, os.path.join(tw_sandbox.REPO, 'reviews')):
        q = os.path.join(root, 'test-sandbox', tw_sandbox.SID, 'tuner', f'{kind}.jsonl')
        if os.path.exists(q): return ok, [json.loads(l) for l in open(q) if l.strip()]
    return ok, []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1700, 'height': 1000}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'favicon' not in m.text and 'version.json' not in m.text and '404' not in m.text else None)
    tw_sandbox.proxy(pg, api_origin)
    pg.add_init_script("try { localStorage.removeItem('tw.buildings.bench'); } catch (e) {}")
    pg.goto(base + '/buildings/index.html'); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
    cards = lambda: pg.evaluate("[...document.querySelectorAll('.card')].map(c => ({ code: c.dataset.code, size: c.dataset.size, seed: +c.dataset.seed, solver: c.dataset.solver, edges: +c.dataset.edges, rooms: +c.dataset.rooms, levels: c.querySelectorAll('svg.plan').length, checks: c.querySelector('.checks')?.textContent || '', href: c.querySelector('a.go')?.href || '' }))")
    catalog_codes = pg.evaluate("""async () => {
        const [types, rooms] = await Promise.all(['../data/types.json', '../data/rooms.json'].map(p => fetch(p).then(r => r.json())));
        return types.map(t => t.code).filter(c => bench.B.BUILDING_TYPES[c] && rooms.filter(r => (r.recipes || [])[0]?.startsWith(c.toLowerCase() + '-')).length >= 3);
    }""")
    C = cards(); codes = sorted(set(c['code'] for c in C)); n_types = len(catalog_codes)
    size_count = pg.locator('#fSize button').count(); seed_count = pg.evaluate('bench.S.seeds')
    check('G1 a card per catalog type x size x seed, a drawing per storey, no errors', codes == sorted(catalog_codes) and len(C) == n_types * size_count * seed_count and all(c['levels'] >= 1 for c in C) and any(c['levels'] >= 3 for c in C if c['code'] == 'TAV') and not errs, f"{len(C)} cards, types {codes}, expected {catalog_codes}, inn panels {sorted(set(c['levels'] for c in C if c['code'] == 'TAV'))}, errors {errs[:3]}")
    summary = pg.inner_text('#summary')
    check('G2 every card counts its rules; the header sums them', all('rules' in c['checks'] for c in C) and f'{len(C)} plans' in summary and 'keep every rule' in summary, summary[:110])
    if shots: os.makedirs(shots, exist_ok=True); pg.screenshot(path=os.path.join(shots, 'buildings-page.png'), full_page=False)
    # G3 loops
    def dial(k, v=None, default=None):
        d0 = pg.evaluate('bench.draws')
        if default is not None: pg.evaluate(f"(() => {{ const c = document.querySelector('.dial[data-dial={k}] label.def input'); c.checked = {str(default).lower()}; c.dispatchEvent(new Event('change')); }})()")
        if v is not None: pg.evaluate(f"(() => {{ const r = document.querySelector('.dial[data-dial={k}] input[type=range]'); r.value = {v}; r.dispatchEvent(new Event('input')); }})()")
        pg.wait_for_function(f'bench.draws > {d0}', timeout=30000)
    edges = lambda code, big=True: sum(c['edges'] for c in cards() if c['code'] == code and (not big or c['size'] in ('16x12', '20x14')))
    e_def = edges('CRY'); dial('loops', 0); e0 = edges('CRY'); dial('loops', 1); e1 = edges('CRY'); dial('loops', default=True); e_back = edges('CRY')
    check('G3 the loops dial changes the crypts\' doors (tree < default <= loops), and "type default" puts them back', e0 < e_def <= e1 and e_back == e_def, f'tree {e0}, type default {e_def}, loops {e1}, back {e_back}')
    # G4 carved
    inn0 = set(c['solver'] for c in C if c['code'] == 'TAV'); dial('carved', 1); inn1 = set(c['solver'] for c in cards() if c['code'] == 'TAV'); cry1 = set(c['solver'] for c in cards() if c['code'] == 'CRY')
    href_dial = next((c['href'] for c in cards() if c['code'] == 'CRY'), '')  # (a crypt's card: the link must carry the overridden dial)
    dial('carved', 0); cry0 = set(c['solver'] for c in cards() if c['code'] == 'CRY'); dial('carved', default=True)
    check('G4 the envelope dial: inns carved at one end, crypts packed at the other, both back by type', inn0 == {'packed'} and inn1 == {'carved'} and cry1 == {'carved'} and cry0 == {'packed'} and set(c['solver'] for c in cards() if c['code'] == 'CRY') == {'carved'}, f'inn {inn0} -> {inn1}; crypt packed end {cry0}; errors {errs[:2]}')
    # G5 storeys, street side, outbuildings
    def press(sel, key, **kw):
        d0 = pg.evaluate('bench.draws'); pg.click(f"{sel} button[data-key='{key}']", **kw); pg.wait_for_function(f'bench.draws > {d0}', timeout=30000)
    def tap(sel):
        d0 = pg.evaluate('bench.draws'); pg.click(sel); pg.wait_for_function(f'bench.draws > {d0}', timeout=30000)
    lv2 = max(c['levels'] for c in cards() if c['code'] == 'TAV'); press('#fStoreys', '1'); lv1 = max(c['levels'] for c in cards() if c['code'] == 'NOB' and c['size'] == '16x12')
    press('#fStoreys', '3'); lv3 = max(c['levels'] for c in cards() if c['code'] == 'TAV' and c['size'] == '16x12'); press('#fStoreys', '0')
    rooms_out = sum(c['rooms'] for c in cards() if c['code'] == 'TAV'); tap('#tOut'); rooms_in = sum(c['rooms'] for c in cards() if c['code'] == 'TAV'); tap('#tOut')
    front = lambda: pg.evaluate("bench.plans.filter(p => p.code === 'TAV').map(p => p.rooms.find(r => r.entry).entry[0]).join('')")
    f_s = front(); press('#fFront', 'E'); f_e = front(); press('#fFront', 'S')
    check('G5 storeys, the street side and outbuildings redraw', lv1 == 2 and lv3 == 4 and lv2 >= 3 and rooms_in < rooms_out and set(f_s) == {'h'} and set(f_e) == {'v'}, f'mansion at 1 storey: {lv1} panels (ground + cellar); inn at 3: {lv3}; inn rooms {rooms_out} -> {rooms_in} without outbuildings; street door on {set(f_s)} then {set(f_e)} walls')
    # G6 the 3D link
    c0 = next(c for c in cards() if c['code'] == 'TAV' and c['size'] == '12x8'); q = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(c0['href']).query)); qd = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(href_dial).query))
    check('G6 "Open in 3D" carries the plan, and a dial only when it is overridden', q.get('build') == 'TAV' and q.get('w') == '12' and q.get('d') == '8' and int(q.get('seed', 0)) == c0['seed'] and q.get('storeys') == '2' and q.get('front') == 'S' and 'carved' not in q and 'loops' not in q and qd.get('carved') == '1', f"{c0['href']} | with the dial: carved={qd.get('carved')}")
    # G7 notes
    press('#fType', 'TAV', modifiers=['Shift']); press('#fSize', '12x8', modifiers=['Shift'])
    big = cards(); one = pg.locator('.card').first
    if shots: one.screenshot(path=os.path.join(shots, 'buildings-card-inn.png')); pg.screenshot(path=os.path.join(shots, 'buildings-inn-large.png'))
    one.locator('.acts input').fill('TEST note on one plan'); one.locator('.acts button', has_text='Send').click(); pg.wait_for_function("bench.lastSent && bench.lastSent.card", timeout=15000)
    pg.fill('#note', 'TEST global note'); pg.click('#sendNote'); pg.wait_for_function("bench.lastSent && !bench.lastSent.card", timeout=15000)
    honoured, recs = sandbox(); mine = [r for r in recs if (r.get('data') or {}).get('tool') == 'buildings']
    card_rec = next((r for r in mine if r['data'].get('card')), None); glob = next((r for r in mine if not r['data'].get('card')), None)
    check('G7 a card\'s note and the global note reach the write-back sandbox with dials, filters and the card', honoured and card_rec and glob and card_rec['name'] == f"buildings TAV 12x8 seed {big[0]['seed']}" and card_rec['data']['card']['seed'] == big[0]['seed'] and card_rec['note'] == 'TEST note on one plan' and glob['name'] == 'buildings' and 'dials' in glob['data'] and glob['data']['filters']['types'] == ['TAV'], f"sandbox honoured {honoured}; {len(mine)} records; card name {card_rec and card_rec['name']}")
    check('G1b only one type and size shown: the cards are large', len(big) == pg.evaluate('bench.S.seeds') and pg.evaluate('bench.cardW') >= 520, f"{len(big)} cards at {pg.evaluate('bench.cardW')} px")
    if shots:
        for code in ('NOB', 'CAS', 'CRY'):
            press('#fType', code, modifiers=['Shift']); press('#fSize', '16x12', modifiers=['Shift']) if pg.evaluate("bench.S.sizes.size !== 1 || !bench.S.sizes.has('16x12')") else None; pg.locator('.card').first.screenshot(path=os.path.join(shots, f'buildings-card-{code}.png'))
    check('no console errors over the whole run', not errs, '; '.join(errs[:3]))
    b.close()
print(f'{fails} failed'); sys.exit(1 if fails else 0)

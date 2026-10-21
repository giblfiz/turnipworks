"""Alignment Bench acceptance (2026-10-04). Real mouse and keys against a running bench; every record it writes is
tagged "acceptance test (Fauna)" and goes to the server's test sandbox (tests/tw_sandbox.py), never the live records.
  python accept.py BENCH_URL [--tuner TUNER_URL] [--game GAME_URL] [--shots]
BENCH_URL e.g. http://127.0.0.1:8783/align/ or https://implausible.enterprises/projects/turnip-works/align/
--tuner: also check the Spawn Tuner reads the fire_anchor the bench wrote; --game: the game reads it (and hinges)."""
import sys, json, time, re
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
from playwright.sync_api import sync_playwright

args = sys.argv[1:]
URL = args[0]
opt = lambda k: args[args.index(k) + 1] if k in args else None
TUNER, GAME, SHOTS = opt('--tuner'), opt('--game'), '--shots' in args
API = re.sub(r'(https?://[^/]+).*', r'\1', URL) + '/api/tw-ratings'
NOTE = 'acceptance test (Fauna)'
res = []
def check(ok, msg):
    res.append((bool(ok), msg)); print(('PASS ' if ok else 'FAIL ') + msg, flush=True)

LAUNCH = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
def ready(pg, sku=None):
    pg.wait_for_function('window.bench && window.bench.cur() && document.getElementById("busy").hidden' + (f' && bench.cur().sku === {json.dumps(sku)}' if sku else ''), timeout=90000)
    time.sleep(0.6)
def api(pg, route):
    return json.loads(pg.evaluate(f"fetch('{API}/tuner/{route}', {{cache: 'no-store'}}).then(r => r.text())"))
def press(pg, key, wait=0.35):
    pg.keyboard.press(key); time.sleep(wait)

with sync_playwright() as p:
    b = p.chromium.launch(args=LAUNCH)
    pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(f"window.__alignTestNote = {json.dumps(NOTE)}; try {{ localStorage.clear(); }} catch (e) {{}}")

    # ---------------------------------------------------------------- queues
    pg.goto(f'{URL}?mode=fire&filter=all&sku=candelabra--common'); ready(pg, 'candelabra--common')
    Q = pg.evaluate('Object.fromEntries(Object.entries(bench.Q).map(([k, v]) => [k, v.length]))')
    print('queues', Q)
    check(Q['fire'] >= 80 and Q['water'] >= 20 and Q['open'] >= 40, f'queues load: fire {Q["fire"]}, water {Q["water"]}, open {Q["open"]}')
    for key, m in (('2', 'water'), ('3', 'open'), ('1', 'fire')):
        press(pg, key, 0.2); ready(pg)
        n = pg.locator('#list li').count()
        check(pg.evaluate('bench.mode()') == m and n == Q[m], f'key {key} -> {m} mode, its queue listed ({n} rows)')
    pg.evaluate("bench.go('candelabra--common')"); ready(pg, 'candelabra--common')
    fire_auto = pg.evaluate('bench.Q.fire.filter(e => e.auto).length')
    check(fire_auto == Q['fire'], f'every lit mesh starts from automatic anchors ({fire_auto}/{Q["fire"]})')

    # ---------------------------------------------------------------- FIRE: drag, add, delete, size, Enter
    st = pg.evaluate('bench.state()')
    check(len(st['list']) == 3 and st['source'] == 'auto', f"candelabra: 3 automatic flames ({len(st['list'])}, {st['source']})")
    s0 = st['screen'][0]
    pg.mouse.move(s0['x'], s0['y']); pg.mouse.down(); pg.mouse.move(s0['x'] + 20, s0['y'] + 10, steps=4); pg.mouse.move(s0['x'] + 40, s0['y'] + 20, steps=4); pg.mouse.up(); time.sleep(0.4)
    st2 = pg.evaluate('bench.state()')
    check(st2['list'][0] != st['list'][0] and st2['dirty'] and st2['source'] == 'override', f"drag moves flame 0: {st['list'][0]} -> {st2['list'][0]}")
    added = False
    box = pg.evaluate("(() => { const T = bench.ctx.THREE, b = new T.Box3().setFromObject(bench.ctx.cur().it.group), c = b.getCenter(new T.Vector3()); return [0.15, 0.3, 0.45, 0.6].map(f => bench.ctx.screenOf(new T.Vector3(c.x, b.min.y + (b.max.y - b.min.y) * f, c.z))); })()")
    for pt in box:
        pg.mouse.click(pt['x'], pt['y']); time.sleep(0.4)
        if len(pg.evaluate('bench.state().list')) == 4: added = True; break
    check(added, 'click on the object adds a flame (4)')
    press(pg, 'Delete')
    check(len(pg.evaluate('bench.state().list')) == 3, 'Delete removes the picked flame (3)')
    press(pg, 'Tab'); press(pg, ']')
    st3 = pg.evaluate('bench.state()')
    check(len(st3['list'][st3['pick']]) == 4 and abs(st3['list'][st3['pick']][3] - 1.15) < 0.01, f"] sizes the picked flame: {st3['list'][st3['pick']]}")
    if SHOTS: pg.screenshot(path='shots/accept-fire-edited.png')
    want = pg.evaluate('bench.state().list')
    mesh = pg.evaluate('bench.cur().mesh')
    press(pg, 'Enter', 1.2)
    rec = api(pg, 'fire_anchors').get(mesh)
    check(rec and rec['data']['aligned'] and rec['note'] == NOTE and rec['data']['anchors'] == [[round(x, 4) for x in u] for u in want], f'Enter writes fire_anchor {mesh} (aligned, tagged, anchors as edited)')
    check(pg.evaluate('bench.cur().sku') != 'candelabra--common', f"Enter advances ({pg.evaluate('bench.cur().sku')})")
    press(pg, 'k'); ready(pg)
    check(pg.evaluate('bench.cur().sku') == 'candelabra--common' and pg.evaluate('bench.state().source') == 'override', 'K goes back; the saved flames reload as an override')
    # unaligned filter hides it once we leave it
    pg.select_option('#f-status', 'unaligned'); press(pg, 'j'); ready(pg)
    rows = pg.evaluate("[...document.querySelectorAll('#list li')].map(li => li.dataset.sku)")
    check('candelabra--common' not in rows, 'the aligned candelabra drops out of the Unaligned filter')
    pg.select_option('#f-status', 'aligned'); time.sleep(0.3)
    rows = pg.evaluate("[...document.querySelectorAll('#list li')].map(li => li.dataset.sku)")
    check('candelabra--common' in rows, 'and shows under Aligned')
    prog = pg.locator('[data-mode=fire] small').inner_text()
    check(re.match(r'\d+/\d+', prog) and int(prog.split('/')[0]) >= 1, f'progress counter: Fire {prog}')
    pg.select_option('#f-status', 'all')
    # lantern: the light marker
    pg.evaluate("bench.go(bench.Q.fire.find(e => e.type === 'lantern').sku)"); ready(pg)
    check(pg.locator('#fx-light-row').is_visible(), 'lanterns show the light controls')

    # ---------------------------------------------------------------- WATER: drag the surface, inset, shape, Enter
    press(pg, '2'); pg.evaluate("bench.go('bucket--empty')"); ready(pg, 'bucket--empty')
    st = pg.evaluate('bench.state()')
    check(st['found'] and st['foot']['found'] and 0 < st['foot']['y'] < 1, f"bucket--empty: automatic interior found (level y {st['foot']['y']}, rim {st['foot']['rim']})")
    ss = st['surfScreen']; lv0 = st['p']['level']
    pg.mouse.move(ss['x'], ss['y']); pg.mouse.down(); pg.mouse.move(ss['x'], ss['y'] + 15, steps=5); pg.mouse.up(); time.sleep(0.4)
    lv1 = pg.evaluate('bench.state().p.level')
    check(lv1 < lv0 - 0.01, f'dragging the surface down lowers the level ({lv0:.2f} -> {lv1:.2f})')
    press(pg, 'ArrowUp'); lv2 = pg.evaluate('bench.state().p.level')
    check(abs(lv2 - (lv1 + 0.02)) < 0.002, f'↑ raises it 2% ({lv2:.3f})')
    press(pg, 'e'); press(pg, '[')
    st = pg.evaluate('bench.state()')
    check(st['p']['shape'] == 'poly' and abs(st['p']['inset_in'] - 0.85) < 1e-6 and len(st['foot']['poly']) >= 3, f"E -> polygon ({len(st['foot']['poly'])} points), [ -> inset {st['p']['inset_in']}")
    if SHOTS: pg.screenshot(path='shots/accept-water-edited.png')
    mesh = pg.evaluate('bench.cur().mesh'); press(pg, 'Enter', 1.2)
    rec = api(pg, 'water_surfaces').get(mesh)
    d = rec and rec['data']
    check(d and d['aligned'] and d['shape'] == 'poly' and abs(d['level'] - lv2) < 0.001 and len(d['poly']) >= 3 and all(0 <= c <= 1.05 for pt in d['poly'] for c in pt) and rec['note'] == NOTE,
          f'Enter writes water_surface {mesh} (level {d and d["level"]}, {d and len(d["poly"])}-point footprint in bbox fractions)')
    pg.evaluate("bench.go('bucket--empty')"); ready(pg, 'bucket--empty')
    check(pg.evaluate('bench.state().p.shape') == 'poly', 'the saved surface reloads')
    press(pg, 'a'); check(pg.evaluate('bench.state().p.shape') == 'ellipse' and pg.evaluate('bench.state().p.level') == 0.8, 'A goes back to the automatic fit')

    # ---------------------------------------------------------------- OPEN: lid hinge, swap, edge snap by click
    press(pg, '3'); pg.evaluate("bench.go('trunk-travel--s1')"); ready(pg, 'trunk-travel--s1')
    st = pg.evaluate('bench.state()')
    check(st['rigged'] and st['p']['mode'] == 'hinge' and st['p']['moving'] == 'above' and st['p']['edge'] == 'top back', f"trunk: automatic lid hinge on the top back edge ({st['p']['edge']}, {st['p']['openAngle']}°)")
    press(pg, 'o', 1.4); t1 = pg.evaluate('bench.state()')
    check(not t1['cycle'] and t1['t'] in (0, 1), f"O stops the cycle and toggles (t={t1['t']})")
    a0 = t1['p']['openAngle']; press(pg, 'r')
    check(pg.evaluate('bench.state().p.openAngle') == -a0, 'R reverses the swing')
    press(pg, 'r'); press(pg, 'ArrowUp')
    check(abs(pg.evaluate('bench.state().p.split') - 0.63) < 1e-6, '↑ raises the lid split')
    if SHOTS: press(pg, 'o', 1.5); pg.screenshot(path='shots/accept-open-lid.png')
    mesh = pg.evaluate('bench.cur().mesh'); press(pg, 'Enter', 1.2)
    rec = api(pg, 'hinges').get(mesh); d = rec and rec['data']
    check(d and d['aligned'] and d['mode'] == 'hinge' and d['parts']['moving'] == 'above' and abs(d['parts']['split'] - 0.63) < 1e-6 and len(d['pivot']) == 3 and len(d['axis']) == 3 and 'openAngle' in d,
          f'Enter writes hinge {mesh} in the openclose.json shape ({d and {k: d[k] for k in ("pivot", "axis", "openAngle")}})')
    # swap
    pg.evaluate("bench.go('chest-plain--s1')"); ready(pg, 'chest-plain--s1')
    st = pg.evaluate('bench.state()')
    check(st['p']['mode'] == 'swap' and not st['rigged'], 'chest-plain: automatic swap to its open twin')
    press(pg, 'o', 1.5); s1 = pg.evaluate('bench.state().openShown'); press(pg, 'o', 1.5); s2 = pg.evaluate('bench.state().openShown')
    check(s1 != s2, f'O swaps between the closed mesh and the open twin ({s1} -> {s2})')
    if not s2: press(pg, 'o', 1.5)
    if SHOTS: pg.screenshot(path='shots/accept-open-swap.png')
    press(pg, 'ArrowUp'); press(pg, 'ArrowUp')
    check(abs(pg.evaluate('bench.state().p.offset[1]') - 0.01) < 1e-6, 'swap offset nudged up')
    mesh = pg.evaluate('bench.cur().mesh'); press(pg, 'Enter', 1.2)
    rec = api(pg, 'hinges').get(mesh); d = rec and rec['data']
    check(d and d['mode'] == 'swap' and d['open']['sku'] == 'chest-plain-open--s1' and abs(d['offset'][1] - 0.01) < 1e-6, f'swap record: open twin {d and d["open"]}, offset {d and d["offset"]}')
    # click-snap on a door leaf: click near its right side -> a right edge
    pg.evaluate("bench.go('door-plank--leaf')"); ready(pg, 'door-plank--leaf'); press(pg, 'o', 1.4)
    if pg.evaluate('bench.state().t') > 0.5: press(pg, 'o', 1.4)
    pt = pg.evaluate("(() => { const T = bench.ctx.THREE, b = new T.Box3().setFromObject(bench.ctx.cur().it.group), c = b.getCenter(new T.Vector3()); return bench.ctx.screenOf(new T.Vector3(b.max.x - (b.max.x - b.min.x) * 0.06, c.y, b.max.z)); })()")
    pg.mouse.click(pt['x'], pt['y']); time.sleep(0.8)
    edge = pg.evaluate('bench.state().p.edge')
    check('right' in edge, f'clicking near the right side snaps the hinge to a right edge ({edge})')
    press(pg, 'a')

    # ---------------------------------------------------------------- keyboard flow
    press(pg, '1'); ready(pg); first = pg.evaluate('bench.cur().sku')
    press(pg, 'j'); ready(pg); second = pg.evaluate('bench.cur().sku')
    press(pg, 'ArrowLeft'); ready(pg); back = pg.evaluate('bench.cur().sku')
    check(first != second and back == first, f'J / ← step through the queue ({first} -> {second} -> {back})')
    press(pg, '/'); pg.keyboard.type('chandelier'); time.sleep(0.4)
    n = pg.evaluate('bench.visibleCount()')
    check(0 < n < Q['fire'] and pg.evaluate("document.activeElement.id") == 'f-name', f'/ filters by name ({n} chandeliers)')
    pg.keyboard.press('Escape'); pg.fill('#f-name', ''); time.sleep(0.2)
    check(not [e for e in errs if 'WebGL' not in e], f'no page errors ({errs[:3]})')
    if SHOTS: pg.screenshot(path='shots/accept-desktop.png')
    pg.close()

    # ---------------------------------------------------------------- phone width
    ph = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ph.add_init_script(f"window.__alignTestNote = {json.dumps(NOTE)};")
    ph.goto(f'{URL}?mode=water&filter=all&sku=washtub--empty'); ready(ph)
    sw = ph.evaluate('[document.documentElement.scrollWidth, document.body.scrollWidth, innerWidth]')
    cv = ph.evaluate("(() => { const r = document.getElementById('gl').getBoundingClientRect(); return [r.width, r.height, r.left, r.right]; })()")
    check(sw[0] <= sw[2] and sw[1] <= sw[2], f'phone 390 px: no sideways scroll (scrollWidth {sw})')
    check(cv[0] >= 340 and cv[1] >= 300 and cv[2] >= 0 and cv[3] <= 390, f'phone: the 3D view fills the width ({cv})')
    check(ph.locator('#b-ok').is_visible() and ph.locator('#list li').count() > 0, 'phone: queue and Looks right are there')
    if SHOTS: ph.screenshot(path='shots/accept-phone.png', full_page=True)
    ph.close()

    # ---------------------------------------------------------------- the tuner and the game read the bench's fire_anchor
    fake = "{ spec: { id: 'candelabra', sku: 'candelabra--common' }, group: { traverse() {}, updateWorldMatrix() {}, matrixWorld: { elements: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1] } } }"
    saved = api(b.new_page(), 'fire_anchors') if False else None
    if TUNER:
        tp = b.new_page(viewport={'width': 1300, 'height': 850})
        tp.goto(TUNER + ('&' if '?' in TUNER else '?') + 'nobg&nofx')
        tp.wait_for_function('window.fx && window.fx.fire', timeout=90000); time.sleep(3)
        a = tp.evaluate(f'(() => {{ const a = fx.fire.anchorsOf({fake}); return a && {{ source: a.source, sku: a.sku, list: a.list.map(x => x.u) }}; }})()')
        recs = api(tp, 'fire_anchors'); want = recs.get('inn-02/candelabra--common@f5732997', {}).get('data', {}).get('anchors')
        check(a and a['source'] == 'override' and a['list'] == want, f"the Spawn Tuner reads the bench's flames for {a and a['sku']} ({a and a['source']})")
        tp.close()
    if GAME:
        gp = b.new_page(viewport={'width': 1300, 'height': 850})
        gp.goto(GAME + ('&' if '?' in GAME else '?') + 'nopost&faces=1500&nointro')
        gp.fill('#newCampaign input[name=gm]', 'align-bench-test'); gp.fill('#newCampaign input[name=name]', 'TEST accept ' + __import__('time').strftime('%m-%d %H:%M:%S') + ' (throwaway)'); gp.click('#newCampaign button') # a throwaway campaign, as engine/test does
        gp.wait_for_function('window.tw && tw.ready && tw.ready() && tw.area() && tw.worldOf(tw.area()).fx', timeout=120000); time.sleep(3)
        a = gp.evaluate(f'(() => {{ const a = tw.worldOf(tw.area()).fx.fire.anchorsOf({fake}); return a && {{ source: a.source, sku: a.sku, list: a.list.map(x => x.u) }}; }})()')
        recs = api(gp, 'fire_anchors'); want = recs.get('inn-02/candelabra--common@f5732997', {}).get('data', {}).get('anchors')
        check(a and a['source'] == 'override' and a['list'] == want, f"the game reads the bench's flames for {a and a['sku']} ({a and a['source']})")
        lib = "tw.lib.objects['trunk-travel'].skus.find(k => k.sku === 'trunk-travel--s1')"
        sp = gp.evaluate(f"(() => {{ const k = {lib}; const s = tw.assets.specOf({{ kind: 'object', cat: 'trunk-travel', sku: k.sku, url: k.url, dims: [2.8, 2, 1.7], open: true, place: 'floor' }}); return {{ hinge: s.hinge && s.hinge.mode, moving: s.hinge && s.hinge.parts.moving, open: s.open, sku: s.sku }}; }})()")
        check(sp['hinge'] == 'hinge' and sp['open'] and sp['sku'] == 'trunk-travel--s1', f'the game turns the bench hinge into an open lid spec ({sp})')
        sw = gp.evaluate(f"(() => {{ const k = tw.lib.objects['chest-plain'].skus.find(k => k.sku === 'chest-plain--s1'); const s = tw.assets.specOf({{ kind: 'object', cat: 'chest-plain', sku: k.sku, url: k.url, dims: [3, 1.7, 1.7], open: true, place: 'floor' }}); return {{ sku: s.sku, swap: s.swap && s.swap.offset }}; }})()")
        check(sw['sku'] == 'chest-plain-open--s1' and sw['swap'] and abs(sw['swap'][1] - 0.01) < 1e-6, f'the game swaps to the variant-matched twin with the bench offset ({sw})')
        gp.close()
    b.close()

fails = [m for ok, m in res if not ok]
print(f"\n{len(res) - len(fails)}/{len(res)} passed" + (f"; FAILED: {fails}" if fails else ''))
sys.exit(1 if fails else 0)

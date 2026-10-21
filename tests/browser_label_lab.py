"""Label lab acceptance (Harry 2026-10-20: "do we already have a tuner for room and building labels? I want to play with
their size, scaling and position a little"; and: "the label should never get to more than 75% of the room width on
screen ... so when you zoom out a bunch you don't end up with a label jumble").

  TW_GPU=1 python3 tests/browser_label_lab.py [--shots DIR] [--only A,B]

Everything runs locally: this checkout's site, relay and ratings server (seeded with a COPY of the live house records,
minus any `labels` value; every write also carries the tw_sandbox header). The campaign is "TEST label lab (throwaway)".
TABLE    ?labellab=1 builds the design table (a crowded street, a three-storey mansion, loose rooms) and opens the drawer
TODAY    no house value = today's labels: this checkout and origin/main (TW_LABEL_BASE) side by side on the same table,
         at four views: every label's box, text size, opacity and state identical, and the label layer's pixels too;
         and this checkout given today's numbers AS a look (the .lb path) draws the same boxes
KNOBS    every knob the drawer shows (main and Advanced), nudged through its own slider or tick box, changes the labels
WORLD    world size follows 1/distance between the clamps (text = ft x px-per-ft at the label), and holds at each clamp
CAP      at overview zoom on the crowded street, no label is wider than 75 % of its room (building) on screen, and no two
         shown labels overlap by more than the crowd rule's 2 px
BLINK    with a world-sized, capped look, a slow zoom out across both ends of the comfort band and back: no label
         changes between shown and hidden twice within 400 ms; standing still, nothing changes
ACTS     with that look: click selects, double-click looks in, F2 renames, dragging the label moves the room, the hidden
         room's mark, the fade over a pawn
DEFAULT  "Use as default" writes ONLY `labels` (the other house fields keep their values and times); the plain game then
         reads it; the lab starts from it and says so; Undo / Redo / Revert / ↺
STILLS   today's look vs a world-sized one at near, mid and overview zoom on the crowded street (--shots)
"""
import argparse, json, math, os, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent)); import tw_sandbox  # noqa: E402
tw_sandbox.remove_campaigns()
ROOT = Path(__file__).resolve().parents[1]
ap = argparse.ArgumentParser(); ap.add_argument('--shots'); ap.add_argument('--only', default=''); A = ap.parse_args()
ONLY = set(x for x in A.only.split(',') if x)
want = lambda k: not ONLY or k in ONLY
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail != '' else ''}", flush=True)
def free(port):
    with socket.socket() as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try: s.bind(('127.0.0.1', port)); return True
        except OSError: return False

tmp = tempfile.TemporaryDirectory(prefix='tw-labellab-'); data = tmp.name
WEB, BASEWEB, RPORT, APORT = 18890, 18893, 18891, 18892
assert all(free(p) for p in (WEB, BASEWEB, RPORT, APORT)), 'test ports busy'
site = Path(data) / 'site'; site.mkdir(); os.symlink(ROOT / 'engine', site / 'engine'); os.symlink(ROOT / 'tools', site / 'tools'); os.symlink(ROOT / 'tools/spawn-tuner', site / 'tuner')
# the game before the lab: origin/main's engine (or TW_LABEL_BASE), with this checkout's tuner
BASE = os.environ.get('TW_LABEL_BASE', 'origin/main')
bsite = Path(data) / 'base'; bsite.mkdir()
subprocess.run(f"git -C {ROOT} archive {BASE} engine/client engine/core | tar -x -C {bsite}", shell=True, check=True)
os.symlink(ROOT / 'tools/spawn-tuner', bsite / 'tuner'); os.symlink(ROOT / 'tools', bsite / 'tools')
for d in (ROOT / 'engine/client/data').iterdir():  # (the untracked asset folders: icons, cursors, roof)
    if not (bsite / 'engine/client/data' / d.name).exists(): os.symlink(d, bsite / 'engine/client/data' / d.name)
procs = [subprocess.Popen([sys.executable, '-m', 'http.server', str(WEB), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL),
         subprocess.Popen([sys.executable, '-m', 'http.server', str(BASEWEB), '--bind', '127.0.0.1'], cwd=bsite, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL),
         subprocess.Popen(['node', str(ROOT / 'engine/relay/server.js')], env={**os.environ, 'PORT': str(RPORT), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=open(data + '/relay.log', 'w'), stderr=subprocess.STDOUT)]
relay = f'http://127.0.0.1:{RPORT}'
rv = Path(data) / 'reviews'; (rv / 'tuner').mkdir(parents=True)
src = Path(tw_sandbox.REVIEWS) / 'tuner' / 'house.jsonl'
if src.exists():  # a copy of the live house look, read only, WITHOUT any labels value: "no house value" is the case under test
    keep = [ln for ln in src.read_text().splitlines() if ln.strip() and 'labels' not in (json.loads(ln).get('data') or {})]
    (rv / 'tuner' / 'house.jsonl').write_text('\n'.join(keep) + '\n')
procs.append(subprocess.Popen([sys.executable, str(ROOT / 'server/ratings_server.py')], env={**os.environ, 'TW_REVIEWS_DIR': str(rv), 'TW_RATINGS_PORT': str(APORT)}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
RATINGS = f'http://127.0.0.1:{APORT}'
for _ in range(100):
    time.sleep(0.1)
    try: urllib.request.urlopen(relay + '/health', timeout=1); urllib.request.urlopen(RATINGS + '/tuner/house', timeout=1); break
    except Exception: pass  # noqa: BLE001
Q = f'relay={urllib.parse.quote(relay)}&api=/api/tw-ratings&boxes&nofx&nointro&faces=1500'
LAB = f'http://127.0.0.1:{WEB}/engine/client/index.html?labellab=1&tuner=http://127.0.0.1:{WEB}/tuner/&{Q}'
GAME = f'http://127.0.0.1:{WEB}/engine/client/index.html?tuner=http://127.0.0.1:{WEB}/tuner/&{Q}'
OLD = f'http://127.0.0.1:{BASEWEB}/engine/client/index.html?tuner=http://127.0.0.1:{BASEWEB}/tuner/&{Q}'  # (the same tuner files, served from its own origin: modules need no CORS)

req = urllib.request.Request(relay + '/campaigns', data=json.dumps({'name': 'TEST label lab (throwaway)', 'gm': 'Fauna'}).encode(), method='POST', headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 tw-test', **tw_sandbox.HEADERS})
made = json.loads(urllib.request.urlopen(req, timeout=20).read()); assert made.get('ok'), made
TOKEN = made['token']
shots = Path(A.shots) if A.shots else None
if shots: shots.mkdir(parents=True, exist_ok=True)

# every label as the DOM has it: box, state, text size, look
SIG = """() => [...document.querySelectorAll('#labels .rlabel')].map(el => { const cs = getComputedStyle(el); return { id: el.dataset.id, kind: el.dataset.kind, on: el.classList.contains('on'), over: el.classList.contains('over'),
  x: el.classList.contains('on') ? +el.dataset.x : null, y: el.classList.contains('on') ? +el.dataset.y : null, w: el.offsetWidth, h: el.offsetHeight, font: cs.fontSize, op: cs.opacity, pad: cs.padding, rad: cs.borderRadius, gap: cs.gap, lb: el.classList.contains('lb'), look: el._lb ? { ...el._lb } : null }; }).sort((a, b) => a.id < b.id ? -1 : 1)"""
CAM = "(v) => { const g = tw.main.grab; g.focus.set(v[0], 0, v[1]); g.dist = v[2]; g.pitch = v[3]; g.yaw = v[4] || 0; g.update(); tw.main.rule = 'free'; }"
# the crowded street (the two rows of small buildings span x 10-205 ft, z 10-95 ft)
NEAR, MID, OVER, FAR = [70, 50, 55, 55], [100, 55, 140, 58], [100, 60, 330, 62], [100, 60, 620, 62]
VIEWS = {'near': NEAR, 'mid': MID, 'overview': OVER, 'tilted': [120, 70, 200, 38, 25]}
NAMES = ['Lab · Smithy', 'Lab · Farm house', 'Lab · Corner inn', 'Lab · Cottage', 'Lab · Workshop', 'Lab · Chapel', 'Lab · Market hall', 'Lab · Small house', 'Lab · Mansion (3 storeys)', 'Lab · closet (2×2)', 'Lab · long gallery (12×3)', 'Lab · great hall (10×8)', 'Lab · study (4×3)']

def gl_args():
    return ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=['--no-sandbox', *gl_args(), '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'])
        def page_at(url, lab=False, draft=None):
            ctx = b.new_context(viewport={'width': 1440, 'height': 900})
            init = f"try {{ localStorage.setItem('tw.labellab.token', {json.dumps(TOKEN)}); localStorage.setItem('tw.prefs', JSON.stringify({{}})); }} catch {{}}"
            if draft is None: init += " try { if (!sessionStorage.getItem('keepDraft')) localStorage.removeItem('tw.labels.draft'); } catch {}"
            ctx.add_init_script(init)
            pg = ctx.new_page(); tw_sandbox.proxy(pg, RATINGS)
            pg._errors = []; pg.on('pageerror', lambda e: pg._errors.append(str(e)))
            pg.goto(url + '#s=' + urllib.parse.quote(TOKEN), wait_until='domcontentloaded', timeout=90000)
            pg.wait_for_function("window.tw && tw.sync.status==='live' && tw.main", timeout=90000)
            pg.wait_for_function("document.querySelector('#twl')?.hidden !== false", timeout=90000)
            if lab: pg.wait_for_function("window.labelLab", timeout=30000)
            return pg
        def settle(pg, ms=1600): pg.wait_for_timeout(ms)
        def cam(pg, v, ms=1600): pg.evaluate(CAM, v); pg.mouse.move(2, 898); settle(pg, ms)
        def look(pg, patch=None, base='starter'):
            """the lab's settings, through the panel: the starter (or today's) look with `patch` ({'size.px': 30, ...})"""
            pg.evaluate("""([base, patch]) => { const P = labelLab.presets, s = structuredClone(base === 'today' ? P[Object.keys(P)[1]] : P[Object.keys(P)[0]]);
              for (const [k, v] of Object.entries(patch || {})) { const [g, f] = k.split('.'); s[g][f] = v; } labelLab.panel.setSettings(s); }""", [base, patch or {}])

        # ---------------------------------------------------------------- TABLE
        print('TABLE', flush=True)
        lab = page_at(LAB, lab=True)
        ok = True
        try: lab.wait_for_function(f"(() => {{ const n = new Set(Object.values(tw.entities()).map(e => e.name)); return {json.dumps(NAMES)}.every(x => n.has(x)); }})()", timeout=240000)
        except Exception as e: ok = False; print('   ', lab.evaluate("Object.values(tw.entities()).map(e => e.name).filter(Boolean)"))
        check(ok, 'the design table: 9 buildings (one of 3 storeys) and 4 loose rooms')
        storeys = lab.evaluate("(() => { const b = Object.values(tw.entities()).find(e => e.name === 'Lab · Mansion (3 storeys)'); return new Set(Object.values(tw.entities()).filter(r => r.kind === 'room' && r.building === b?.id).map(r => r.recipe.y || 0)).size; })()")
        check(storeys >= 2, 'the mansion has several storeys', storeys)
        lab.wait_for_function("document.querySelector('#labellab-panel [data-role=status]').textContent.startsWith('Started from')", timeout=20000)
        st = lab.locator('#labellab-panel [data-role=status]').inner_text()
        check('built-in Starter' in st, 'with no house labels and no draft, the lab says it started from the built-in Starter', st)
        lab.evaluate("document.getElementById('labellab-panel').classList.remove('collapsed')")
        shown = lab.evaluate("[...document.querySelectorAll('#labellab-panel [data-path]')].filter(e => e.closest('details') ? true : e.offsetParent).map(e => e.dataset.path)")
        main_n = lab.evaluate("[...document.querySelectorAll('#labellab-panel [data-role=controls] [data-path]')].length")
        check(10 <= main_n <= 16, 'the main drawer holds about ten knobs, the rest in Advanced', f'{main_n} main, {len(shown) - main_n} advanced')
        cam(lab, MID)
        n = lab.evaluate("tw.labelInfo().filter(l => l.visible).length")
        check(n >= 6 and not lab._errors, 'labels show on the table, no page errors', {'shown': n, 'errors': lab._errors[:2]})

        # ---------------------------------------------------------------- TODAY
        if want('TODAY'):
            print('TODAY', flush=True)
            house = json.loads(urllib.request.urlopen(RATINGS + '/tuner/house').read())
            check(house.get('labels') is None, 'the seeded house record has no labels value', house.get('at', {}).get('labels'))
            old, new = page_at(OLD), page_at(GAME)
            check(new.evaluate("tw.labelLook() === null"), 'this checkout, no house value: no look at all (labels.js draws exactly as before)')
            for name, v in VIEWS.items():
                for pg in (old, new): cam(pg, v, 0)
                settle(old, 2200); settle(new, 200)
                a, c = old.evaluate(SIG), new.evaluate(SIG)
                strip = lambda L: [{k: x[k] for k in ('id', 'on', 'over', 'x', 'y', 'w', 'h', 'font', 'op', 'pad', 'rad', 'gap')} for x in L]
                diff = [(x, y) for x, y in zip(strip(a), strip(c)) if x != y]
                check(len(a) == len(c) and not diff and not any(x['lb'] for x in c), f'TODAY {name}: origin/main and this checkout draw identical labels', f"{sum(x['on'] for x in a)} shown of {len(a)}" + (f'; first diff {diff[0]}' if diff else ''))
                # the pixels of the label layer alone (the table hidden, so only the labels are compared)
                imgs = []
                for pg in (old, new):
                    pg.evaluate("(() => { const st = document.createElement('style'); st.id = 'onlyLabels'; st.textContent = 'body * { visibility: hidden !important; transition: none !important } #labels .rlabel.on, #labels .rlabel.on * { visibility: visible !important }'; document.head.append(st); })()"); pg.wait_for_timeout(250)
                    imgs.append(pg.screenshot()); pg.evaluate("document.getElementById('onlyLabels').remove()")
                check(imgs[0] == imgs[1], f'TODAY {name}: the label layer is pixel-identical', f'{len(imgs[0])} bytes')
                if shots and name == 'mid':
                    for tag, im in zip(('origin-main', 'this-checkout'), imgs): (shots / f'today-{tag}-labels-only.png').write_bytes(im)
            # today's numbers given AS a look: the .lb path (CSS variables) reproduces the same boxes
            new.evaluate("(s) => tw.setLabelLook(s)", lab.evaluate("labelLab.presets[Object.keys(labelLab.presets)[1]]"))
            for name, v in VIEWS.items():
                for pg in (old, new): cam(pg, v, 0)
                settle(old, 2200); settle(new, 200)
                a, c = old.evaluate(SIG), new.evaluate(SIG)
                strip = lambda L: [{k: x[k] for k in ('id', 'on', 'x', 'y', 'w', 'h', 'font', 'op', 'pad', 'rad', 'gap')} for x in L]
                diff = [(x, y) for x, y in zip(strip(a), strip(c)) if x != y]
                check(not diff and all(x['lb'] for x in c if x['on']), f'TODAY-as-a-look {name}: identical boxes, text, padding, corners, opacity', diff[:1] or f"{sum(x['on'] for x in c)} shown")
            for pg in (old, new): pg.context.close()

        # ---------------------------------------------------------------- KNOBS
        if want('KNOBS'):
            print('KNOBS', flush=True)
            # (a pawn just below the great hall's label, from straight above: for the "fade over a pawn" margin)
            hall = lab.evaluate("(() => { const r = Object.values(tw.entities()).find(e => e.name === 'Lab · great hall (10×8)'); const [x, z] = tw.labelPointOf(r.recipe); return { id: r.id, x, z }; })()")
            if not lab.evaluate("Object.values(tw.entities()).some(e => e.name === 'Lab · pawn by the label')"):
                lab.evaluate("(h) => tw.addPawns(null, h.x, h.z + 7, { name: 'Lab · pawn by the label', select: false })", hall); lab.wait_for_timeout(800)
            TOP = [hall['x'], hall['z'], 200, 89.5]
            # knob -> (camera, value, extra settings): each scenario is one where the knob has something to act on
            K = {
                'size.px': (MID, 40, {}), 'size.world': (MID, True, {}), 'size.ft': (MID, 4, {'size.world': True}),
                'size.minPx': (FAR, 30, {'size.world': True, 'size.capPct': 101}), 'size.maxPx': (NEAR, 14, {'size.world': True}),
                'size.building': (MID, 2.0, {}), 'size.capPct': (OVER, 30, {}), 'size.hidePx': (OVER, 20, {}),
                'place.ft': (MID, 30, {}), 'place.buildingFt': (MID, 20, {}), 'place.side': (MID, 15, {}), 'place.fwd': (MID, 15, {}),
                'look.opacity': (MID, 40, {}), 'look.pad': (MID, 2.5, {}), 'look.round': (MID, 0, {}),
                'when.fadeFt': (MID, 60, {}), 'when.roomsFt': (MID, 60, {}), 'when.underRoof': (MID, False, {}),
                'crowd.stepY': (OVER, 30, {'size.capPct': 101}), 'crowd.stepX': (OVER, 30, {'size.capPct': 101}), 'crowd.arriveX': (OVER, 20, {'size.capPct': 101}), 'crowd.arriveY': (OVER, 20, {'size.capPct': 101}),
                'crowd.leave': (OVER, -10, {'size.capPct': 101}), 'crowd.edgeIn': ([20, 50, 140, 58], 200, {}), 'crowd.edgeOut': ([20, 50, 140, 58], 0, {}),
                'crowd.dwell': None, 'crowd.pawn': (TOP, 40, {}),
            }
            seen = set()
            for sec_world in (False, True):
                look(lab, {'size.world': sec_world}); lab.wait_for_timeout(200)
                paths = lab.evaluate("[...document.querySelectorAll('#labellab-panel [data-path]')].map(e => e.dataset.path)")
                for path in paths:
                    if path in seen: continue
                    seen.add(path)
                    if path not in K: check(False, f'KNOB {path}: has a scenario in this test'); continue
                    if K[path] is None: continue
                    v, value, extra = K[path]
                    look(lab, {**extra, 'size.world': extra.get('size.world', sec_world) if path != 'size.world' else False})
                    if path == 'when.underRoof': lab.evaluate("tw.setRoofs(true)")
                    replay = path in ('crowd.arriveX', 'crowd.arriveY')  # (these act on a label ARRIVING: go away and come back)
                    if replay: cam(lab, NEAR, 1200)
                    cam(lab, v, 1800); s0 = lab.evaluate(SIG)
                    # through the knob's own control, as a hand would
                    lab.evaluate("([p, v]) => { const el = document.querySelector(`#labellab-panel [data-path='${p}']`); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }", [path, value])
                    if replay: cam(lab, NEAR, 1200); cam(lab, v, 0)
                    settle(lab, 1800); s1 = lab.evaluate(SIG)
                    got = lab.evaluate(f"labelLab.panel.settings().{path}")
                    strip = lambda L: [{k: x[k] for k in ('id', 'on', 'over', 'x', 'y', 'w', 'h', 'font', 'op', 'pad', 'rad')} for x in L]
                    ch = [x['id'] for x, y in zip(strip(s0), strip(s1)) if x != y] + (['(count)'] if len(s0) != len(s1) else [])
                    check(ch and got == value, f'KNOB {path} -> {value}: the labels change', f'{len(ch)} of {len(s1)} labels changed')
                    if path == 'when.underRoof': lab.evaluate("tw.setRoofs(false)")
            # the dwell: a big camera move, sampled 250 ms after: with 0 ms the labels have already changed, with 2000 they hold
            def after_move(dw):
                look(lab, {'crowd.dwell': dw}); cam(lab, MID, 1800); s0 = lab.evaluate(SIG)
                lab.evaluate(CAM, OVER); lab.wait_for_timeout(250); s1 = lab.evaluate(SIG)
                return sum(1 for x, y in zip(s0, s1) if x['on'] != y['on'])
            a0, a2 = after_move(0), after_move(2000)
            check(a0 > a2, 'KNOB crowd.dwell: a label changes at most once per that time', {'changed within 250 ms at 0 ms': a0, 'at 2000 ms': a2})
            check('crowd.dwell' in seen, 'KNOB crowd.dwell is in the drawer (Advanced)')
            cam(lab, MID)

        # ---------------------------------------------------------------- WORLD
        if want('WORLD'):
            print('WORLD', flush=True)
            hall = lab.evaluate("Object.values(tw.entities()).find(e => e.name === 'Lab · great hall (10×8)').id")
            PPF = """(id) => { const r = tw.entities()[id], [x, z] = tw.labelPointOf(r.recipe), y = (r.recipe.y || 0) + labelLab.panel.settings().place.ft, cam = tw.main.camera; cam.updateMatrixWorld(); const m = cam.matrixWorld.elements;
              const d = (x - m[12]) * -m[8] + (y - m[13]) * -m[9] + (z - m[14]) * -m[10], H = document.getElementById('c').getBoundingClientRect().height * tw.main.rect[3];
              const L = tw.labelInfo().find(l => l.id === id); return { ppf: H / (2 * Math.tan(cam.fov * Math.PI / 360) * d), depth: d, font: L?.font, on: L?.visible, why: L?.look?.why }; }"""
            look(lab, {'size.world': True, 'size.ft': 2, 'size.minPx': 6, 'size.maxPx': 80, 'size.capPct': 101})
            rows = []
            for dist in (70, 100, 140, 200, 280):
                cam(lab, [125, 140, dist, 70], 900); rows.append(lab.evaluate(PPF, hall))
            err = max(abs(r['font'] - 2 * r['ppf']) for r in rows)
            k = [r['font'] * r['depth'] for r in rows]; spread = (max(k) - min(k)) / (sum(k) / len(k))
            check(err <= 0.35 and spread < 0.03, 'WORLD: text = 2 ft x px-per-ft at the label, so it falls as 1/distance', {'fonts': [round(r['font'], 1) for r in rows], 'worst px off': round(err, 2), 'font x depth spread': f'{spread:.1%}'})
            look(lab, {'size.world': True, 'size.ft': 2, 'size.minPx': 20, 'size.maxPx': 30, 'size.capPct': 101})
            held = []
            for dist in (45, 600):
                cam(lab, [125, 140, dist, 70], 900); held.append(lab.evaluate(PPF, hall))
            check(abs(held[0]['font'] - 30) < 0.01 and held[0]['why'] == 'largest' and abs(held[1]['font'] - 20) < 0.01 and held[1]['why'] == 'smallest', 'WORLD: it holds at the largest (near) and smallest (far) limit', [(round(h['font'], 1), h['why'], round(2 * h['ppf'], 1)) for h in held])

        # ---------------------------------------------------------------- CAP
        if want('CAP'):
            print('CAP', flush=True)
            for tag, patch in (('starter', {}), ('world-sized', {'size.world': True})):
                look(lab, patch); cam(lab, OVER, 2400)
                s = [x for x in lab.evaluate(SIG) if x['on']]
                wide = [(x['id'], x['w'], x['look']['span'], x['font'], x['look']) for x in s if x['look'] and x['w'] > 0.75 * x['look']['span'] + 2]
                capped = sum(1 for x in s if x['look'] and x['look']['why'] == 'cap')
                check(s and not wide and capped > 0, f'CAP {tag}, overview: no label wider than 75 % of its room / building on screen', {'shown': len(s), 'shrunk by the cap': capped, 'too wide': wide[:3]})
                bad = []
                for i, a in enumerate(s):
                    for c in s[i + 1:]:
                        ix = min(a['x'] + a['w'], c['x'] + c['w']) - max(a['x'], c['x']); iy = min(a['y'] + a['h'], c['y'] + c['h']) - max(a['y'], c['y'])
                        if ix > 2 and iy > 2: bad.append((a['id'], c['id'], round(ix), round(iy)))
                check(not bad, f'CAP {tag}, overview: no two shown labels overlap by more than the crowd rule\'s 2 px', bad[:3])
                small = [x for x in lab.evaluate(SIG) if x['look'] and float(x['font'][:-2]) < 9 and x['on']]
                check(not small, f'CAP {tag}: no shown label is under 9 px text (Hide below)', [(x['id'], x['font']) for x in small[:3]])

        # ---------------------------------------------------------------- BLINK
        if want('BLINK'):
            print('BLINK', flush=True)
            look(lab, {'size.world': True})
            SAMPLER = """(() => { if (window.__lab) return; const L = window.__lab = { ch: {}, st: {}, last: {}, slot: {}, why: {} };
              (function loop() { const t = Math.round(performance.now()), F = tw.labelFlips();
                for (const el of document.querySelectorAll('.rlabel')) { const id = el.dataset.id, on = el.classList.contains('on'); if (L.last[id] !== undefined && L.last[id] !== on) (L.ch[id] ||= []).push(t); L.last[id] = on; if (on && el._lb) L.why[el._lb.why] = (L.why[el._lb.why] || 0) + 1;
                  const sl = F[id]?.slot ?? null; if (on && L.slot[id] != null && sl != null && sl !== L.slot[id]) (L.st[id] ||= []).push(t); L.slot[id] = on ? sl : null; }
                requestAnimationFrame(loop); })(); })()"""
            TAKE = "(() => { const c = __lab.ch, s = __lab.st; __lab.ch = {}; __lab.st = {}; return { ch: c, st: s, on: Object.values(__lab.last).filter(Boolean).length, why: __lab.why }; })()"
            lab.evaluate(SAMPLER)
            def gaps(ch):
                n = sum(len(v) for v in ch.values()); g = [b2 - a2 for v in ch.values() for a2, b2 in zip(v, v[1:])]
                return n, (min(g) if g else None)
            def sweep(name, steps_n, f, hold_every=12, ms=35):
                lab.evaluate(CAM, f(0)); lab.wait_for_timeout(1200); lab.evaluate(TAKE)
                moving, steps, still = {}, {}, 0
                for i in range(1, steps_n + 1):
                    lab.evaluate(CAM, f(i / steps_n)); lab.wait_for_timeout(ms)
                    if i % hold_every == 0:
                        t = lab.evaluate(TAKE)
                        for k2, v2 in t['ch'].items(): moving.setdefault(k2, []).extend(v2)
                        for k2, v2 in t['st'].items(): steps.setdefault(k2, []).extend(v2)
                        lab.wait_for_timeout(600); lab.evaluate(TAKE)
                        lab.wait_for_timeout(1200); t = lab.evaluate(TAKE); still += sum(len(v2) for v2 in t['ch'].values()) + sum(len(v2) for v2 in t['st'].values())
                n2, g = gaps(moving); ns, gs = gaps(steps)
                check(g is None or g >= 400, f'BLINK {name}: no label changes between shown and hidden twice within 400 ms', {'changes': n2, 'shortest gap ms': g})
                check(gs is None or gs >= 400, f'BLINK {name}: no label steps to another place twice within 400 ms', {'steps': ns, 'shortest gap ms': gs})
                check(still == 0, f'BLINK {name}: with the camera still, nothing changes or moves', still)
                return n2
            n1 = sweep('slow zoom out (world-sized, capped)', 240, lambda t: [100, 55, 30 + t * 620, 60])
            why = lab.evaluate("__lab.why")
            check(why.get('largest') and why.get('smallest') or why.get('cap'), 'BLINK: the zoom crossed the comfort band\'s ends (labels held at the largest and at the smallest or the cap)', why)
            sweep('slow zoom back in', 240, lambda t: [100, 55, 650 - t * 620, 60])

        # ---------------------------------------------------------------- ACTS
        if want('ACTS'):
            print('ACTS', flush=True)
            look(lab, {'size.world': True, 'place.side': 3})
            room = lab.evaluate("Object.values(tw.entities()).find(e => e.name === 'Lab · great hall (10×8)')")
            cam(lab, [125, 140, 120, 60], 1800)
            center = lambda: lab.evaluate(f"(() => {{ const el = document.querySelector('.rlabel[data-id=\"{room['id']}\"]'); const r = el.getBoundingClientRect(); return el.classList.contains('on') ? [(r.left + r.right) / 2, (r.top + r.bottom) / 2] : null; }})()")
            c = center(); check(c, 'ACTS: the great hall\'s label shows', c)
            lab.evaluate("tw.select([])"); lab.mouse.click(*c); lab.wait_for_timeout(700)
            check(lab.evaluate(f"tw.sel.size === 1 && tw.sel.has('{room['id']}')"), 'ACTS: a click on the label selects the room')
            lab.keyboard.press('F2'); lab.wait_for_timeout(300)
            check(lab.evaluate("!!document.querySelector('.rlabel.editing input')"), 'ACTS: F2 renames in place')
            lab.keyboard.type('Lab · great hall (10×8) x'); lab.keyboard.press('Enter'); lab.wait_for_timeout(900)
            check(lab.evaluate(f"tw.entities()['{room['id']}'].name") == 'Lab · great hall (10×8) x', 'ACTS: the new name lands')
            lab.evaluate(f"tw.dispatch('room.set', {{ id: '{room['id']}', name: 'Lab · great hall (10×8)' }})"); lab.wait_for_timeout(700)
            lab.evaluate("tw.select([])"); lab.wait_for_timeout(500); c = center()
            lab.mouse.dblclick(*c); lab.wait_for_timeout(1200)
            check(lab.evaluate("tw.cut?.y != null"), 'ACTS: a double-click looks into the room (the cut)', lab.evaluate("tw.cut?.y"))
            lab.evaluate("tw.cutOff('test')"); lab.wait_for_timeout(800)
            cam(lab, [125, 140, 120, 60], 1500); c = center(); x0 = lab.evaluate(f"tw.entities()['{room['id']}'].recipe.x")
            lab.mouse.move(*c); lab.mouse.down(); [lab.mouse.move(c[0] + i * 6, c[1], steps=2) for i in range(1, 16)]; lab.mouse.up(); lab.wait_for_timeout(1500)
            x1 = lab.evaluate(f"tw.entities()['{room['id']}'].recipe.x")
            check(x1 != x0, 'ACTS: dragging the label moves the room', f'x {x0} -> {x1}')
            if x1 != x0: lab.evaluate(f"tw.dispatch('room.move', {{ id: '{room['id']}', x: {x0}, z: {room['recipe']['z']} }})"); lab.wait_for_timeout(1200)
            lab.evaluate(f"tw.select([]); tw.flag(['{room['id']}'], {{ hidden: true }})"); lab.wait_for_timeout(1200)
            check(lab.evaluate(f"document.querySelector('.rlabel[data-id=\"{room['id']}\"]')?.classList.contains('hidden-room')"), 'ACTS: a hidden room\'s label wears the mark')
            lab.evaluate(f"tw.flag(['{room['id']}'], {{ hidden: false }})"); lab.wait_for_timeout(900)
            hp = lab.evaluate(f"(() => {{ const [x, z] = tw.labelPointOf(tw.entities()['{room['id']}'].recipe); return {{ x, z }}; }})()")
            if not lab.evaluate("Object.values(tw.entities()).some(e => e.name === 'Lab · pawn by the label')"):
                lab.evaluate("(h) => tw.addPawns(null, h.x, h.z + 7, { name: 'Lab · pawn by the label', select: false })", hp); lab.wait_for_timeout(800)
            look(lab, {'crowd.pawn': 40}); cam(lab, [hp['x'], hp['z'], 200, 89.5], 1800)
            ov = lab.evaluate("[...document.querySelectorAll('.rlabel.on.over')].map(el => [el.dataset.id, getComputedStyle(el).opacity])")
            check(ov and all(float(o) < 0.5 for _, o in ov), 'ACTS: a label over a pawn fades', ov)
            check(not lab._errors, 'ACTS: no page errors', lab._errors[:2])

        # ---------------------------------------------------------------- DEFAULT
        if want('DEFAULT'):
            print('DEFAULT', flush=True)
            get_house = lambda pg: pg.evaluate("fetch((tw.labelLabApi || '/api/tw-ratings') + '/tuner/house', { cache: 'no-store' }).then(r => r.json())")
            before = get_house(lab)
            look(lab, {'size.building': 1.6, 'place.ft': 12})
            lab.evaluate("document.getElementById('labellab-panel').classList.remove('collapsed')")
            lab.locator('#labellab-panel [data-role=name]').fill('TEST labels (throwaway)')
            lab.locator('#labellab-panel [data-role=useDefault]').click(); lab.wait_for_timeout(1200)
            after = get_house(lab)
            others = [k for k in before if k not in ('labels', 'at') and (before[k] != after.get(k) or before['at'].get(k) != after['at'].get(k))]
            check(after.get('labels', {}).get('name') == 'TEST labels (throwaway)' and after['labels']['settings'] == lab.evaluate("labelLab.panel.settings()"), 'DEFAULT: Use as default writes `labels`, exactly the drawer\'s settings', lab.locator('#labellab-panel [data-role=status]').inner_text())
            check(not others and set(before) == set(after), 'DEFAULT: every other house field keeps its value and time', others or f"{len([k for k in before if k != 'at'])} fields")
            live_lines = (Path(tw_sandbox.REVIEWS) / 'tuner' / 'house.jsonl').read_text() if (Path(tw_sandbox.REVIEWS) / 'tuner' / 'house.jsonl').exists() else ''
            check('TEST labels (throwaway)' not in live_lines, 'DEFAULT: Harry\'s real house record is untouched')
            game = page_at(GAME)
            cam(game, MID)
            g = game.evaluate("({ look: tw.labelLook(), fonts: tw.labelInfo().filter(l => l.visible).map(l => [l.kind, l.font, l.look?.why]) })")
            bf = [f for k2, f, why in g['fonts'] if k2 == 'building' and why == 'size']  # (not one the room cap shrank)
            check(g['look'] and g['look']['size']['building'] == 1.6 and bf and abs(bf[0] - 24 * 1.6) < 0.2, 'DEFAULT: the plain game (no lab) reads the house labels', {'building fonts': bf[:3]})
            game.context.close()
            lab.reload(wait_until='domcontentloaded'); lab.wait_for_function("window.labelLab && document.querySelector('#labellab-panel [data-role=status]').textContent.startsWith('Started from')", timeout=90000)
            st = lab.locator('#labellab-panel [data-role=status]').inner_text()
            check('house default · TEST labels (throwaway)' in st, 'DEFAULT: the lab now starts from the house labels and says so', st)
            lab.wait_for_function("document.querySelector('#twl')?.hidden !== false", timeout=90000)
            lab.evaluate("document.getElementById('labellab-panel').classList.remove('collapsed')")
            sl = lab.locator("#labellab-panel [data-path='size.px']")
            sl.evaluate("el => { el.value = 33; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }")
            sl2 = lab.locator("#labellab-panel [data-path='look.opacity']")
            sl2.evaluate("el => { el.value = 50; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }")
            S = lambda: lab.evaluate("labelLab.panel.settings()")
            s1 = S(); lab.locator('#labellab-panel [data-role=undo]').click(); s2 = S(); lab.locator('#labellab-panel [data-role=redo]').click(); s3 = S()
            check(s1['look']['opacity'] == 50 and s2['look']['opacity'] == 82 and s2['size']['px'] == 33 and s3 == s1, 'DEFAULT: Undo and Redo walk the changes', [s1['look']['opacity'], s2['look']['opacity'], s3['look']['opacity']])
            lab.locator("#labellab-panel [data-reset='size.px']").click()
            check(S()['size']['px'] == 24 and S()['look']['opacity'] == 50, 'DEFAULT: ↺ puts back one knob')
            rvt = lab.locator('#labellab-panel [data-role=revert]'); txt = rvt.inner_text(); rvt.click()
            check(S()['look']['opacity'] == 82 and S()['size']['building'] == 1.6 and 'house default' in txt, 'DEFAULT: Revert goes back to where it started', txt)
            check(not lab._errors, 'DEFAULT: no page errors', lab._errors[:2])

        # ---------------------------------------------------------------- STILLS
        if shots and want('STILLS'):
            print('STILLS', flush=True)
            lab.evaluate("document.getElementById('labellab-panel').classList.add('collapsed'); tw.select([])")
            for tag, set_js in (('today', "tw.setLabelLook(null)"), ('world-sized', None)):
                if set_js: lab.evaluate(set_js)
                else: look(lab, {'size.world': True})
                for vname, v in (('near', NEAR), ('mid', MID), ('overview', OVER)):
                    cam(lab, v, 2200); lab.screenshot(path=str(shots / f'{tag}-{vname}.jpg'), quality=85)
            print('   stills in', shots)
        b.close()
finally:
    for pr in procs: pr.terminate()
fails = [n for ok, n in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} passed" + (f"; FAILED: {fails}" if fails else ''))
sys.exit(1 if fails else 0)

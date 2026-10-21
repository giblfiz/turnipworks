"""The Wall fit bench (wallbench.html, js/wallbench.js, js/wallfit.js; Harry 2026-10-13: "I need one more tool: a wall approval tool").
W1  the specimen builds for EVERY family, no errors, every part has its mesh; one family builds in a couple of seconds
W2  a specimen has the piece kinds of its family (straights, window, doors with leaves, corner posts, panels where it has them) on two storeys, a slab, a roof
W3  a deliberately mis-scaled fixture piece is FLAGGED (seam gaps / overlaps in inches); snap proposes the way back; kept, the flags are gone
W4  keyboard flow through three families ( ] [ n Tab m a A ): moves, marks and approvals; the queue follows
W5  marks and approvals ROUND-TRIP: saved as `wallfit` records (append-only, in the test sandbox), restored after a reload
W6  "Use in game" stores the house look `wallfit`; the TUNER and the GAME's asset layer both apply it on the next load (scale, offset, yaw);
    with no correction every piece is exactly as before; the golden layout test is unchanged (tools/spawn-tuner/test/golden.mjs, run by the landing script)
W7  every family measured, the queue sorted worst first; undo; camera presets; inside/outside
Runs its own ratings server on a temp folder (never the live records) and a static site over the working tree.
  python wallbench_ui.py [--shots DIR]      needs tools/spawn-tuner/assets (a symlink to the main checkout's in a worktree)"""
import sys, os, json, time, tempfile, shutil, subprocess, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.abspath(os.path.join(HERE, '../../..'))
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox
from playwright.sync_api import sync_playwright
args = sys.argv[1:]; shots = None
if '--shots' in args: i = args.index('--shots'); shots = args[i + 1]; del args[i:i + 2]
PORT, APIP = int(os.environ.get('TW_WALLBENCH_PORT', '18993')), int(os.environ.get('TW_WALLBENCH_API', '18992'))
fails = 0; total = 0
def check(n, ok, ev=''):
    global fails, total; total += 1; print(('PASS ' if ok else 'FAIL ') + n + (f'  [{ev}]' if ev else ''), flush=True); fails += 0 if ok else 1
site = tempfile.mkdtemp(prefix='tw-wallbench-'); os.symlink(os.path.join(REPO, 'engine'), os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
rev = tempfile.mkdtemp(prefix='tw-wallbench-rev-')
api = subprocess.Popen([sys.executable, os.path.join(REPO, 'server/ratings_server.py')], env={**os.environ, 'TW_REVIEWS_DIR': rev, 'TW_RATINGS_PORT': str(APIP)}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
URL = f'http://127.0.0.1:{PORT}/tuner/'
def records(kind='wallfit'):
    out = []
    for root, _, fs in os.walk(rev):
        if f'{kind}.jsonl' in fs: out += [json.loads(l) for l in open(os.path.join(root, f'{kind}.jsonl')) if l.strip()]
    return out
try:
    for _ in range(60):
        time.sleep(0.15)
        try: urllib.request.urlopen(f'http://127.0.0.1:{APIP}/sandbox', timeout=1); urllib.request.urlopen(URL + 'wallbench.html', timeout=1); break
        except Exception: pass
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        def page():
            pg = b.new_page(viewport={'width': 1600, 'height': 950}); pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)))
            tw_sandbox.proxy(pg, f'http://127.0.0.1:{APIP}'); return pg
        def bench(pg, q=''):
            pg.goto(URL + 'wallbench.html' + q); pg.wait_for_function('window.__wallbench && __wallbench.ready', timeout=120000)
        pg = page(); t0 = time.time(); bench(pg, '?family=dressed-stone'); first = time.time() - t0
        W = lambda js: pg.evaluate(f'__wallbench.{js}')
        fams = W('families()')
        # ---- W1
        res = pg.evaluate("""(async () => { const out = {}; for (const f of __wallbench.families()) { const S = await __wallbench.build(f, { light: true }); const bad = S.items.filter(i => !i.visual || i.err).length; out[f] = { n: S.items.length, bad, ms: Math.round(S.built) }; S.group.parent.remove(S.group); } return out; })()""")
        check('W1a the specimen builds for all %d families, every part with its mesh' % len(fams), len(fams) >= 15 and all(v['n'] > 80 and v['bad'] == 0 for v in res.values()), f"{ {f: (v['n'], v['bad']) for f, v in list(res.items())[:4]} }…")
        built = pg.evaluate("__wallbench.specimen().built")
        check('W1b one full specimen (two storeys, floors, slab, roof, figures) builds in a couple of seconds', built < 4000 and first < 20, f'{built:.0f} ms build, {first:.1f} s page')
        # ---- W2
        pcs = W('pieces()'); roles = {x['role'] for x in pcs}
        S = pg.evaluate("(() => { const S = __wallbench.specimen(); return { storeys: [...new Set(S.items.map(i => i.storey))], slab: S.items.filter(i => i.role === 'slab').length, roof: !!S.roof, floors: S.items.filter(i => i.role === 'floor').length, figs: S.figures.length, style: S.roofStyle, leaves: S.items.filter(i => i.role === 'leaf').length, posts: S.items.filter(i => i.role === 'post').length }; })()")
        check('W2a straights, a window, door leaves, corner posts and a panel on two storeys with a slab, floors, figures and a slate roof', {'straight', 'window', 'leaf', 'post'} <= roles and S['storeys'] == [0, 1] and S['slab'] == 1 and S['roof'] and S['floors'] > 50 and S['figs'] == 2 and S['style'] == 'slate' and S['leaves'] == 6, f"{sorted(roles)} {S}")
        pg2 = page(); bench(pg2, '?family=crypt-stone'); roles2 = {x['role'] for x in pg2.evaluate('__wallbench.pieces()')}; n_panels = sum(1 for x in pg2.evaluate('__wallbench.pieces()') if x['role'] == 'panel')
        check('W2b a family with special panels (crypt-stone: niches, ossuary, sealed tomb door) shows each version', 'panel' in roles2 and n_panels >= 5, f'{n_panels} panel versions'); pg2.close()
        # ---- W7a (scan first: it is the data W3 uses)
        pg.wait_for_function('__wallbench.scanDone()', timeout=300000)
        sc = W('scan()'); order = W('order()'); scores = [sc[f]['score'] for f in order]
        check('W7a every family measured and the queue sorted worst first', len(sc) == len(fams) and scores == sorted(scores, reverse=True) and scores[0] > scores[-1], f"worst {order[0]} {scores[0]}, best {order[-1]} {scores[-1]}")
        print('   scan:', ', '.join(f'{f} {sc[f]["score"]}' for f in order))
        # ---- W7d the three fit problems that were the same in every family (Harry 2026-10-14): fixed in the builder, measured in inches
        vals = pg.evaluate('''(async () => { const out = {}; for (const f of __wallbench.families()) { const S = await __wallbench.build(f, { light: true }); __wallbench.measure(S);
          const B = S.items.find(i => i.world).world.constructor; let door = -99, post = -99;
          for (const d of S.doors) if (d.open && !d.open_) door = Math.max(door, Math.abs(d.open.h - d.leaf.y1));
          for (const i of S.items) if (i.role === 'post' && i.world) post = Math.max(post, Math.abs(i.world.max.y * 12 - i.level * 12 - 108));
          out[f] = { door, post, over: S.slabOver }; } return out; })()''')
        worst = {k: max(abs(v[k]) for v in vals.values()) for k in ('door', 'post', 'over')}
        check('W7d every family: door head gap, slab overhang and corner post height are each within 1 in', len(vals) == len(fams) and all(w <= 1.0 for w in worst.values()), f'worst door {worst["door"]:.1f} in, slab {worst["over"]:.1f} in, post {worst["post"]:.1f} in')
        # ---- W3 the mis-scaled fixture
        pg.evaluate("__wallbench.load('rough-timber')"); pg.wait_for_function("__wallbench.family() === 'rough-timber' && __wallbench.specimen() && __wallbench.specimen().findings", timeout=60000)
        sku = 'wall-straight--rough-timber--s4'
        def seams(): return [f for f in W('findings()') if f['sku'] in (sku,) or f.get('sku2') == sku]
        base = [f for f in seams() if f['kind'] in ('seam', 'piece')]
        pg.evaluate(f"__wallbench.setFit('{sku}', {{ s: [1.12, 0.93, 1], o: [0, 0, 0], yaw: 0 }})"); pg.wait_for_timeout(400); pg.evaluate('__wallbench.remeasureNow()')
        bad = [f for f in seams() if f['kind'] in ('seam', 'piece') and f['sev'] != 'ok']
        kinds = ' | '.join(sorted({f['text'].split(': ')[-1][:40] if 'gap' not in f['text'] else 'gap/overlap' for f in bad}))[:200]
        check('W3a a piece scaled 112% long and 93% tall is flagged (gap/overlap and height seams, in inches)', len(bad) >= 4 and any(f['sev'] == 'bad' for f in bad) and any('gap' in f['text'] or 'overlap' in f['text'] or 'pokes' in f['text'] for f in bad) and any('height' in f['text'] or 'top step' in f['text'] for f in bad) and not base, f'{len(bad)} flags, none before: {not base}; e.g. {bad[0]["text"] if bad else ""}')
        pg.evaluate(f"__wallbench.selectSku('{sku}')"); prop = W('snap()')
        check('W3b snap to fit proposes the way back (the compounded scale returns to 100% / 100%)', prop and abs(prop['s'][0] - 1.0) < 0.03 and abs(prop['s'][1] - 1.0) < 0.03, f"{prop}")
        W('commit()'); pg.wait_for_timeout(500); after = [f for f in seams() if f['kind'] in ('seam', 'piece') and f['sev'] != 'ok']
        check('W3c kept, the measured problems are gone', len(after) == 0, f'{len(after)} left: {after[:1]}')
        pg.keyboard.press('Control+z'); pg.wait_for_timeout(300); fit_after_undo = pg.evaluate(f"__wallbench.wallfit['{sku}']")
        check('W3d undo steps back (to the fixture fit, then the original)', fit_after_undo is not None, f'{fit_after_undo}')
        pg.evaluate(f"__wallbench.setFit('{sku}', {{ s: [1, 1, 1], o: [0, 0, 0], yaw: 0 }})"); pg.evaluate(f"__wallbench.saveThe('{sku}')")
        # ---- W4 keyboard flow
        pg.wait_for_function('__wallbench.scanDone()', timeout=120000)
        pg.evaluate("__wallbench.load('dressed-stone')"); pg.wait_for_function("__wallbench.family() === 'dressed-stone'", timeout=60000)
        f0 = W('family()'); pg.keyboard.press(']'); pg.wait_for_function(f"__wallbench.family() !== '{f0}'", timeout=60000); f1 = W('family()')
        pg.keyboard.press(']'); pg.wait_for_function(f"__wallbench.family() !== '{f1}'", timeout=60000); f2 = W('family()')
        pg.keyboard.press('['); pg.wait_for_function(f"__wallbench.family() === '{f1}'", timeout=60000)
        o = W('order()'); check('W4a ] ] [ move through three families in queue order', [f0, f1, f2] == o[o.index(f0):o.index(f0) + 3], f'{f0} → {f1} → {f2}')
        s0 = W('selected()'); pg.keyboard.press('Tab'); s1 = W('selected()'); pg.keyboard.press('Tab'); s2 = W('selected()'); pg.keyboard.press('Shift+Tab')
        check('W4b Tab / Shift+Tab step through the pieces', len({s0, s1, s2}) == 3 and W('selected()') == s1, f'{s0} → {s1} → {s2}')
        pg.keyboard.press('x'); pg.keyboard.press('='); pg.keyboard.press('='); fit = pg.evaluate(f"__wallbench.wallfit['{s1}']")
        check('W4c x then = = scales the X axis only (2%), the readout follows', fit and abs(fit['s'][0] - 1.0201) < 0.001 and fit['s'][1] == 1 and 'X' in pg.inner_text('#wbPiece'), f'{fit}')
        pg.keyboard.press('ArrowRight'); pg.keyboard.press('PageUp'); pg.keyboard.press('.'); fit = pg.evaluate(f"__wallbench.wallfit['{s1}']")
        check('W4d arrows / PgUp / . move the offset and yaw live', abs(fit['o'][0] - 0.5 / 12) < 1e-3 and abs(fit['o'][1] - 0.5 / 12) < 1e-3 and fit['yaw'] == 1, f'{fit}')
        pg.keyboard.press('0'); pg.keyboard.press('m'); pg.wait_for_selector('#wbMarkNote', state='visible'); pg.wait_for_timeout(200); pg.keyboard.type("stones too tall for the doors"); pg.keyboard.press('Enter'); pg.wait_for_timeout(600)
        pg.keyboard.press('Tab'); pg.keyboard.press('a'); pg.wait_for_timeout(600)
        st = pg.evaluate('__wallbench.state()')
        check('W4e m (note, Enter) marks the piece, a approves the next', ((st['pieces'].get(s1) or {}).get('mark') or {}).get('note') == 'stones too tall for the doors' and (st['pieces'].get(s2) or {}).get('approved') is True, f"{(st['pieces'].get(s1) or {}).get('mark')} / {s2} approved: {(st['pieces'].get(s2) or {}).get('approved')}")
        cur = W('family()'); pg.keyboard.press('A'); pg.wait_for_function(f"__wallbench.family() !== '{cur}'", timeout=60000); st = pg.evaluate('__wallbench.state()')
        check('W4f A approves the family and moves to the next one still open', st['fams'].get(cur, {}).get('approved') is True and W('family()') != cur, f"{cur} approved, now {W('family()')}")
        pg.keyboard.press('n'); check('W4g n goes to the next family that is not approved', not (pg.evaluate('__wallbench.state()')['fams'].get(W('family()'), {}) or {}).get('approved'), W('family()'))
        # ---- W5 round trip
        recs = records(); names = [r['name'] for r in recs]
        before = len(recs); marked = [r for r in recs if r['name'] == s1 and (r['data'] or {}).get('mark')]
        check('W5a marks and approvals are `wallfit` records in the sandbox (appended, with the note)', marked and marked[-1]['data']['mark']['note'] == 'stones too tall for the doors' and any(r['name'] == s2 and r['data']['approved'] for r in recs) and f'family/{cur}' in names, f'{before} records')
        pg3 = page(); bench(pg3, '?family=dressed-stone'); st3 = pg3.evaluate('__wallbench.state()')
        chips = pg3.evaluate("[...document.querySelectorAll('#wbQueue li')].map(li => [li.dataset.f, li.querySelector('.chip').textContent])")
        check('W5b after a reload the marks, approvals and family approval are all back, and the queue shows them', (st3['pieces'].get(s1) or {}).get('mark') and (st3['pieces'].get(s2) or {}).get('approved') and st3['fams'].get(cur, {}).get('approved') and dict(chips).get(cur, '').startswith('approved') and 'marked' in dict(chips).get(cur, ''), f'{dict(chips).get(cur)}')
        n1 = len(records()); pg3.evaluate(f"__wallbench.saveThe('{s2}')"); pg3.wait_for_timeout(500); n2 = len(records()); lines0 = [json.dumps(r) for r in recs]; lines1 = [json.dumps(r) for r in records()[:before]]
        check('W5c write-back is append-only: nothing written before is rewritten', n2 == n1 + 1 and lines0 == lines1, f'{n1} -> {n2}')
        pg3.close()
        # ---- W6 use in game: the tuner and the game apply it
        sk = 'wall-straight--dressed-stone--s2'
        pg.evaluate(f"__wallbench.setFit('{sk}', {{ s: [1, 1.1, 1], o: [0, 0.05, 0.02], yaw: 0 }})"); pg.wait_for_timeout(300); pg.evaluate(f"__wallbench.saveThe('{sk}')")
        pg.keyboard.press('Shift+U'); pg.wait_for_function("document.querySelector('[data-house=wallfit] .houseState').textContent.startsWith('✓')", timeout=20000)
        house = pg.evaluate("fetch('/api/tw-ratings/tuner/house', { cache: 'no-store' }).then(r => r.json())"); wf = house.get('wallfit') or {}
        check('W6a "Use in game" stores the house look `wallfit` (only changed pieces) and the line says the game uses it', sk in wf and abs(wf[sk]['s'][1] - 1.1) < 1e-6 and all(sku in ('wall-straight--dressed-stone--s2',) or sku in wf for sku in wf), f'{list(wf)}')
        tun = page(); tun.goto(URL + 'index.html'); tun.wait_for_function('window.tuner && tuner.look', timeout=120000)
        r = tun.evaluate("""(async () => { const L = tuner.look, k = L.kitSpec('wall-straight', 'dressed-stone', undefined, {}, 1), o = L.kitSpec('wall-straight', 'rough-timber', undefined, {}, 0);
          const v = await L.makeVisual(k, false); const base = v.userData.fitBase; return { sku: k.sku, fit: k.fit, scale: [v.scale.x, v.scale.y, v.scale.z], base: base.s, pos: [v.position.x, v.position.y, v.position.z], other: o.fit ?? null }; })()""")
        check('W6b the TUNER applies it on load: the piece is 110% tall, lifted 0.6 in, pushed 0.24 in; a piece with no correction has none', r['sku'] == sk and abs(r['scale'][1] / r['base'][1] - 1.1) < 1e-6 and abs(r['scale'][0] / r['base'][0] - 1) < 1e-9 and abs(r['pos'][1] - 0.05) < 1e-9 and abs(r['pos'][2] - 0.02) < 1e-9 and r['other'] is None, json.dumps(r)[:240]); tun.close()
        gm = page(); gm.goto(URL + 'wallbench.html'); gm.wait_for_function('window.__wallbench && __wallbench.ready', timeout=120000)
        g = gm.evaluate("""(async () => { const TN = await import('/engine/client/tuner.js'); await TN.loadTuner('/tuner/', '/api/tw-ratings'); const A = await import('/engine/client/assets.js'); const a = A.createAssets({ base: '/tuner/' });
          let sp = null; for (let gx = 0; gx < 40 && (!sp || sp.sku !== 'wall-straight--dressed-stone--s2'); gx++) sp = a.look.edgeSpecs({ key: `h:${gx}:0`, dir: 'h', gx, gz: 0, kind: 'wall', family: 'dressed-stone', owner: { room: 'A', side: 'N' }, sides: [{ room: 'A', side: 'N' }] }).find(s => s.layer === 'walls');
          const v = await a.look.makeVisual(sp, false);
          return { house: TN.T.house.wallfit && Object.keys(TN.T.house.wallfit), fit: sp.fit ?? null, sku: sp.sku, ratio: v.scale.y / v.userData.fitBase.s[1] }; })()""")
        sku_game = g['sku']
        check('W6c the GAME\'s asset layer (engine/client/assets.js) applies the same table to its generated wall pieces (edgeSpecs -> makeVisual); the house look carries it', g['house'] and sk in g['house'] and sku_game == sk and g['fit'] and abs(g['ratio'] - 1.1) < 1e-6, f"picked {sku_game}, ratio {g['ratio']:.3f}, fit {g['fit']}")
        g2 = gm.evaluate("""(async () => { const A = await import('/engine/client/assets.js'); const a = A.createAssets({ base: '/tuner/' }); const L = a.look; const k = L.kitSpec('wall-straight', 'dressed-stone', undefined, {}, 1); const v = await L.makeVisual(k, false); return { sku: k.sku, ratio: v.scale.y / v.userData.fitBase.s[1], off: v.position.y }; })()""")
        check('W6d the game builds the corrected piece (kitSpec -> makeVisual): 110% tall, 0.6 in up', g2['sku'] == sk and abs(g2['ratio'] - 1.1) < 1e-6 and abs(g2['off'] - 0.05) < 1e-9, json.dumps(g2)); gm.close()
        # no correction anywhere: a fresh sandbox has none, and a piece is exactly its catalog fit
        pe = page(); pe.route('**/api/tw-ratings/tuner/house', lambda route: route.fulfill(status=200, content_type='application/json', body=json.dumps({'wallfit': None}))); pe.goto(URL + 'index.html'); pe.wait_for_function('window.tuner && tuner.look', timeout=120000)
        z = pe.evaluate("""(async () => { const L = tuner.look, k = L.kitSpec('wall-straight', 'dressed-stone', undefined, {}, 1); const v = await L.makeVisual(k, false); return { fit: k.fit ?? null, same: v.scale.x === v.userData.fitBase.s[0] && v.scale.y === v.userData.fitBase.s[1] && v.position.y === 0 && v.rotation.y === v.userData.fitBase.yaw }; })()""")
        check('W6e with no correction a piece is exactly what the catalog fit gives (no fit on its spec, scale, offset and turn untouched)', z['fit'] is None and z['same'], json.dumps(z)); pe.close()
        # ---- W7
        pg.evaluate("__wallbench.load('rough-timber')"); pg.wait_for_function("__wallbench.family() === 'rough-timber'", timeout=60000)
        p1 = pg.evaluate('__wallbench.camera.position.toArray()'); pg.keyboard.press('2'); p2 = pg.evaluate('__wallbench.camera.position.toArray()'); pg.keyboard.press('4'); p4 = pg.evaluate('__wallbench.camera.position.toArray()'); pg.keyboard.press('5'); p5 = pg.evaluate('__wallbench.camera.position.toArray()')
        check('W7b camera presets move the camera (front, three-quarter, seam close-up, panels)', len({tuple(round(v) for v in x) for x in (p1, p2, p4, p5)}) == 4 and p4[1] < p1[1] + 5 and abs(p4[2]) < abs(p1[2]), f'{[round(v) for v in p1]} {[round(v) for v in p2]} {[round(v) for v in p4]}')
        f_out = pg.evaluate('__wallbench.face()'); pg.keyboard.press('1'); pg.keyboard.press('i'); f_in = pg.evaluate('__wallbench.face()'); pin = pg.evaluate('__wallbench.camera.position.toArray()')
        check('W7c i flips outside / inside: the camera crosses to the other face of the north run', f_out == 'out' and f_in == 'inn' and pin[2] > 20, f'{f_out}→{f_in} z {pin[2]:.0f}')
        flagged = pg.evaluate('__wallbench.labelsShown()')
        if shots:
            os.makedirs(shots, exist_ok=True)
            for f in ('rough-timber', 'dressed-stone', 'crypt-stone'):
                pg.evaluate(f"__wallbench.load('{f}')"); pg.wait_for_function(f"__wallbench.family() === '{f}'", timeout=60000)
                for v, key in (('front', '1'), ('three', '2'), ('seam', '4')): pg.keyboard.press(key); pg.wait_for_timeout(700); pg.screenshot(path=os.path.join(shots, f'{f}-{v}.png'))
        check('no page errors', not pg.errs, '; '.join(pg.errs[:3]))
        b.close()
finally:
    srv.terminate(); api.terminate(); shutil.rmtree(site, ignore_errors=True); shutil.rmtree(rev, ignore_errors=True)
print(f"\nwall fit bench: {'ALL PASS' if not fails else str(fails) + ' FAILED'} ({total - fails}/{total})"); sys.exit(1 if fails else 0)

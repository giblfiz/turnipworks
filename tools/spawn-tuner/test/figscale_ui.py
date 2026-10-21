"""The Figure scale bench (figures.html, js/figbench.js; Harry 2026-10-12: "the minis are mostly too big").
S1 the bench loads: three figures on their discs, a chair, a table, a door and a bed, no page error
S2 at 1.00 each figure is as tall as it was made; at 0.67 it is 0.67 of that, feet still on the disc; the base is unchanged
S3 the furniture is at its catalog size (chair 3 ft, door 6 ft 8 x 3 ft, bed 6 ft 8 long) and its seat and top are read
S4 the slider and the three buttons move the dial; the readout follows; the knee ring is at the seat's height near 0.8
S5 "Use in game" stores the house look `figures` = { scale } IN THE TEST SANDBOX and the line says the game uses it
python figscale_ui.py [API_ORIGIN] [--shots DIR]     (API_ORIGIN e.g. http://127.0.0.1:8096; without it S5 is skipped)"""
import sys, os, json, time, tempfile, shutil, subprocess, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.abspath(os.path.join(HERE, '../../..'))
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright
args = [a for a in sys.argv[1:]]; shots = None
if '--shots' in args: i = args.index('--shots'); shots = args[i + 1]; del args[i:i + 2]
api_origin = args[0] if args else None; PORT = int(os.environ.get('TW_FIGBENCH_PORT', '18991'))
fails = 0
def check(n, ok, ev=''):
    global fails; print(('PASS ' if ok else 'FAIL ') + n + (f'  [{ev}]' if ev else ''), flush=True); fails += 0 if ok else 1
site = tempfile.mkdtemp(prefix='tw-figbench-'); os.symlink(os.path.join(REPO, 'engine'), os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{PORT}/tuner/figures.html', timeout=1); break
        except Exception: pass
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = b.new_page(viewport={'width': 1600, 'height': 950}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        if api_origin: tw_sandbox.proxy(pg, api_origin)
        pg.goto(f'http://127.0.0.1:{PORT}/tuner/figures.html' + ('' if api_origin else '?api=')); pg.wait_for_function('window.__figbench && __figbench.ready', timeout=90000)
        R = lambda: pg.evaluate('__figbench.rows()'); Fn = pg.evaluate('__figbench.furniture()')
        pg.evaluate('__figbench.set(1)'); r1 = R()
        check('S1 three figures stand on their discs beside a chair, a table, a door and a bed', len(r1) == 3 and all(abs(r['feet_above_disc_ft']) <= 0.002 for r in r1) and all(k in Fn for k in ('chair-plain', 'table-square', 'door-plank', 'bed-single')), f"{[r['id'] for r in r1]}")
        check('S2a at 1.00 each figure is the height it was made at (crests and plumes within 0.9 ft)', all(r['stated_ft'] - 0.05 <= r['drawn_ft'] <= r['stated_ft'] + 0.9 for r in r1), f"{[(r['stated_ft'], r['drawn_ft']) for r in r1]}")
        pg.evaluate('__figbench.set(0.67)'); r2 = R()
        check('S2b at 0.67 each is 0.67 of that, feet on the disc, and the base is the same 4.5 ft', all(abs(a['drawn_ft'] - 0.67 * c['drawn_ft']) < 0.02 and abs(a['feet_above_disc_ft']) <= 0.002 and a['base_width_ft'] == c['base_width_ft'] == 4.5 for a, c in zip(r2, r1)), f"{[r['drawn_ft'] for r in r2]}")
        ch, tb, dr, bd = Fn['chair-plain'], Fn['table-square'], Fn['door-plank'], Fn['bed-single']
        check('S3 furniture at its catalog size: chair 3 ft with a seat, a table top, door 6 ft 8 x 3 ft, bed 6 ft 8', abs(ch['size'][1] - 3) < 0.05 and 0.9 < ch['top'] < 1.7 and 1.4 < tb['top'] < 2.7 and abs(dr['size'][1] - 6.667) < 0.01 and dr['size'][0] == 3 and abs(max(bd['size'][0], bd['size'][2]) - 6.667) < 0.05, f"chair seat {ch['top']:.2f}, table top {tb['top']:.2f}, bed {max(bd['size'][0], bd['size'][2]):.2f}")
        pg.fill('#fsScale', '0.9'); pg.dispatch_event('#fsScale', 'input'); a = pg.evaluate('__figbench.scale()'); pg.click('[data-k="0.8"]'); c = pg.evaluate('__figbench.scale()'); r8 = R()
        check('S4 the slider and the buttons move the dial, the readout follows; near 0.8 the knee is about level with the seat', a == 0.9 and c == 0.8 and pg.inner_text('#fsBig') == '0.80' and f"{r8[0]['drawn_ft']:.2f} ft" in pg.inner_text('#fsFigs') and abs(r8[0]['knee_above_feet_ft'] - ch['top']) < 0.3, f"knee {r8[0]['knee_above_feet_ft']} ft, seat {ch['top']:.2f} ft")
        if shots:
            os.makedirs(shots, exist_ok=True); pg.add_style_tag(content='#fsSide, header { display: none !important } #fsWrap { grid-template-columns: 1fr !important }'); pg.evaluate("dispatchEvent(new Event('resize'))")
            for k in (1, 0.8, 0.67):
                pg.evaluate(f'__figbench.set({k})')
                for v in ('table', 'close', 'door'): pg.evaluate(f'__figbench.views.{v}()'); pg.wait_for_timeout(350); pg.screenshot(path=os.path.join(shots, f'bench-{v}-{k:.2f}.jpg'), type='jpeg', quality=88)
            pg.reload(); pg.wait_for_function('window.__figbench && __figbench.ready', timeout=90000)
        if api_origin:
            pg.evaluate('__figbench.set(0.73)'); pg.click('#fsHouse'); pg.wait_for_timeout(1500)
            h = pg.evaluate("fetch('/api/tw-ratings/tuner/house', { cache: 'no-store' }).then(r => r.json())"); line = pg.inner_text('[data-house=figures] .houseState')
            check('S5 "Use in game" stores the house figure scale (sandboxed) and the line says the game uses it', (h.get('figures') or {}).get('scale') == 0.73 and line.startswith('✓'), f"{h.get('figures')} · {line[:70]}")
        check('no page errors', not errs, '; '.join(errs[:3]))
        b.close()
finally:
    srv.terminate(); shutil.rmtree(site, ignore_errors=True)
print(f"\nfigscale bench: {'ALL PASS' if not fails else str(fails) + ' FAILED'}"); sys.exit(1 if fails else 0)

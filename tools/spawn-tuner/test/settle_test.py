"""Settling (gravity for surface items): after rooms spawn, every surface item should touch its parent's real mesh.
python settle_test.py URL [--10k]      (use ?nobg&nofx&seed=4242 in the URL for headless runs)"""
import sys, time, json
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; LOD10K = '--10k' in sys.argv  # default faces tier (heavier headless)
OPEN_PANELS = "for (const k of ['spawn','light','atmos','fire','water','layout','bench','keys']) localStorage.setItem('tuner.fold.' + k, 'open')"
res = []
def check(n, c, ev=''): c = bool(c); res.append(c); print(('PASS ' if c else 'FAIL ') + n + (f'  [{ev}]' if ev else ''), flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox']); pg = b.new_page(viewport={'width': 1400, 'height': 850}); pg.add_init_script(OPEN_PANELS)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('body[data-ready="1"]', timeout=120000)
    if not LOD10K: pg.evaluate("document.querySelector('#lodFaces').value = 'baked'; document.querySelector('#lodFaces').dispatchEvent(new Event('change'))"); time.sleep(0.5)
    for args in ["'common', 4, 4, 7, 5", "'kitchen', 12, 4, 5, 5", "'fine', 4, 10, 4, 4", "'storeroom', 12, 10, 4, 4"]:
        pg.evaluate(f"void tuner.createRoom({args})"); time.sleep(0.5)
    t0 = time.time()
    while time.time() - t0 < 120:
        busy = pg.evaluate("tuner.busy ? tuner.busy() : 0") if pg.evaluate("typeof tuner.busy === 'function'") else 0
        if pg.evaluate("tuner.settle().pending") == 0 and not busy and time.time() - t0 > 8: break
        time.sleep(1)
    st = pg.evaluate("tuner.settle()")
    its = st['items']; done = [i for i in its if i['settle'] and i['settle']['ok']]
    before = sorted(abs(i['settle']['gap']) for i in done)
    q = lambda xs, f: xs[min(len(xs) - 1, int(f * len(xs)))] if xs else None
    print(f"surface items {len(its)}, settled {len(done)}, moved {st['moved']}, skipped {st['skipped']}, settle time {st['ms']:.0f} ms")
    print(f"initial |gap| ft: median {q(before, .5)}, p90 {q(before, .9)}, max {before[-1] if before else None}")
    gaps = [g['gap'] for g in pg.evaluate("tuner.settleGaps()") if g['gap'] is not None]
    after = sorted(abs(g) for g in gaps)
    print(f"residual |gap| ft: median {q(after, .5)}, p90 {q(after, .9)}, max {after[-1] if after else None}  (n={len(after)})")
    check('S1 most surface items had a measurable parent surface under them', len(done) >= 0.8 * len(its), f'{len(done)}/{len(its)}')
    check('S2 after settling, 95% of surface items touch (|gap| <= 0.6 in)', after and sum(1 for g in after if g <= 0.05) >= 0.95 * len(after), f'{sum(1 for g in after if g <= 0.05)}/{len(after)}')
    check('S3 settling finished in the background', st['pending'] == 0, f"pending {st['pending']} {st['pendingList'][:4]}")
    # change the faces tier: every mesh is swapped, so everything re-settles on the new geometry
    pg.evaluate("document.querySelector('#lodFaces').value = '3000'; document.querySelector('#lodFaces').dispatchEvent(new Event('change'))")
    t0 = time.time()
    while time.time() - t0 < 120:
        time.sleep(2)
        if pg.evaluate("tuner.settle().pending") == 0 and time.time() - t0 > 10: break
    after2 = sorted(abs(g['gap']) for g in pg.evaluate("tuner.settleGaps()") if g['gap'] is not None)
    check('S5 after a faces-tier swap, items re-settle onto the new meshes', after2 and sum(1 for g in after2 if g <= 0.05) >= 0.95 * len(after2), f'{sum(1 for g in after2 if g <= 0.05)}/{len(after2)}, max {after2[-1] if after2 else None}')
    check('S4 no page errors', not errs, str(errs[:2]))
    b.close()
sys.exit(sum(1 for r in res if not r))

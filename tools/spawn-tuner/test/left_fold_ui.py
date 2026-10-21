"""The tuner's left column on small screens (2026-10-18, Harry on a laptop: the room-type finder and its buttons took 3/4
of the column and could neither be folded nor scrolled). At 1280x720 and 1440x900:
  L1 Room types is a fold (open by default) whose body scrolls inside a bounded height; the panels below keep room
  L2 folding it gives the column back to the panels; the choice survives a reload (like the other sections)
  L3 "/" (find a room type) opens it again; that survives a reload too
Usage: python tools/spawn-tuner/test/left_fold_ui.py TUNER_URL [API_ORIGIN] [SHOTS_DIR]   (through tw-slot)
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests'))
import tw_sandbox  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

base = sys.argv[1].rstrip('/'); api = sys.argv[2] if len(sys.argv) > 2 else None
shots = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('TW_TEST_SHOTS')
fails = 0; n = 0
def check(name, ok, ev=''):
    global fails, n
    n += 1; fails += 0 if ok else 1
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{ev}]' if ev else ''), flush=True)

GEOM = """(() => { const L = document.querySelector('#left').getBoundingClientRect(), P = document.querySelector('#palette').getBoundingClientRect(),
  Q = document.querySelector('#leftPanels').getBoundingClientRect(), b = document.querySelector('#paletteFold .pbody'), cs = getComputedStyle(b);
  const B = b.getBoundingClientRect(); return { clipped: B.bottom > P.bottom + 1, left: L.height, palette: P.height, panels: Q.height, open: document.querySelector('#paletteFold').open, scroll: cs.overflowY, sh: b.scrollHeight, ch: b.clientHeight }; })()"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'])
    for w, h in [(1280, 720), (1440, 900)]:
        ctx = b.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page()
        if api: tw_sandbox.proxy(pg, api)
        pg.goto(base + '/index.html?nobg&nofx'); pg.wait_for_selector('body[data-ready="1"]', timeout=90000)
        g = pg.evaluate(GEOM)
        if shots: os.makedirs(shots, exist_ok=True); pg.screenshot(path=f'{shots}/left-{w}x{h}-open.png', clip={'x': 0, 'y': 0, 'width': 300, 'height': h})
        check(f'L1 {w}x{h}: Room types open by default, its body scrolls (not clipped), at most 60% of the column, panels keep >= 35%',
              g['open'] and g['scroll'] == 'auto' and g['palette'] <= 0.6 * g['left'] + 1 and g['panels'] >= 0.35 * g['left'] and not g['clipped'] and g['sh'] > g['ch'], g)
        pg.click('#paletteFold > summary'); pg.wait_for_timeout(200)
        f = pg.evaluate(GEOM)
        pg.reload(); pg.wait_for_selector('body[data-ready="1"]', timeout=90000)
        r = pg.evaluate(GEOM)
        if shots: pg.screenshot(path=f'{shots}/left-{w}x{h}-folded.png', clip={'x': 0, 'y': 0, 'width': 300, 'height': h})
        check(f'L2 {w}x{h}: folding gives the column to the panels and survives a reload', not f['open'] and f['palette'] < 60 and f['panels'] > g['panels'] + 100 and not r['open'] and r['palette'] < 60, f'folded {f}, after reload {r}')
        pg.mouse.click(w // 2, h // 2); pg.keyboard.press('/'); pg.wait_for_timeout(200)
        o = pg.evaluate("[document.querySelector('#paletteFold').open, document.activeElement?.id]")
        pg.keyboard.press('Escape'); pg.reload(); pg.wait_for_selector('body[data-ready="1"]', timeout=90000)
        o2 = pg.evaluate("document.querySelector('#paletteFold').open")
        check(f'L3 {w}x{h}: "/" opens Room types with the search focused; it stays open after a reload', o == [True, 'roomSearch'] and o2, f'{o} then {o2}')
        ctx.close()
    b.close()
print(f'{n - fails}/{n} passed'); sys.exit(1 if fails else 0)

"""FX panels acceptance (2026-10-02): the LIGHTING and FIRE panels render, a dial moves the live params, presets
save / load (built-in, this browser) and send to the server (kind "fx"; read back via GET /tuner/fx).
python fx_ui.py BASE_URL OUTDIR [API_ORIGIN]   (API_ORIGIN e.g. http://127.0.0.1:8096 when BASE_URL is a local static server)"""
import sys, time, json
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright
base, outdir = sys.argv[1].rstrip('/'), sys.argv[2]
api_origin = sys.argv[3] if len(sys.argv) > 3 else None
ok = True
def check(cond, msg):
    global ok
    print(('PASS ' if cond else 'FAIL ') + msg); ok = ok and cond
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1500, 'height': 1000})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    if api_origin:  # forward the tuner API to the real server (the static server has no /api)
        tw_sandbox.proxy(pg, api_origin)
    pg.goto(base + '/index.html?nobg')
    pg.wait_for_selector('body[data-ready="1"]', timeout=90000)
    pg.wait_for_function('!!window.fx', timeout=60000)
    for key in ('light', 'fire'):
        pg.evaluate(f"document.querySelector('details.major[data-key=\"{key}\"]').open = true")
    check(pg.locator('#fx-lighting-dials input').count() >= 20, f"lighting dials rendered ({pg.locator('#fx-lighting-dials input, #fx-lighting-dials select').count()})")
    check(pg.locator('#fx-fire-dials input').count() >= 20, f"fire dials rendered ({pg.locator('#fx-fire-dials input, #fx-fire-dials select').count()})")
    # move a dial through the UI: bloom strength
    sl = pg.locator('[data-path="lighting.bloom.strength"]')
    sl.evaluate("e => { e.value = '1.7'; e.dispatchEvent(new Event('input', { bubbles: true })); }")
    check(abs(pg.evaluate("fx.params('lighting').bloom.strength") - 1.7) < 1e-6, 'bloom dial drives the live params')
    fl = pg.locator('[data-path="fire.flame.intensity"]')
    fl.evaluate("e => { e.value = '0.9'; e.dispatchEvent(new Event('input', { bubbles: true })); }")
    check(abs(pg.evaluate("fx.params('fire').flame.intensity") - 0.9) < 1e-6, 'fire intensity dial drives the live params')
    pg.screenshot(path=f'{outdir}/ui-panels.png')
    # built-in preset load
    pg.select_option('#fx-fire-load', 'builtin:roaring')
    check(pg.evaluate("fx.params('fire').name") == 'roaring', 'built-in fire preset loads')
    # save in this browser, then load it back
    pg.fill('#fx-lighting-name', 'light-acceptance-test')
    pg.click('#fx-lighting-save')
    check(pg.locator('#fx-lighting-load option[value="local:light-acceptance-test"]').count() == 1, 'lighting preset saved in this browser')
    pg.select_option('#fx-lighting-load', 'builtin:daylight')
    pg.select_option('#fx-lighting-load', 'local:light-acceptance-test')
    check(abs(pg.evaluate("fx.params('lighting').bloom.strength") - 1.7) < 1e-6, 'local lighting preset loads back')
    if api_origin:
        pg.fill('#fx-fire-name', 'acceptance-test')
        pg.click('#fx-fire-send'); time.sleep(1.5)
        recs = json.loads(pg.evaluate("fetch('/api/tw-ratings/tuner/fx').then(r => r.text())"))
        rec = recs.get('fire-acceptance-test')
        check(bool(rec) and rec['data'].get('fx') == 'fire', 'fire preset sent as kind fx with data.fx = fire (prefixed fire-)')
        check(pg.locator('#fx-fire-load option[value="remote:fire-acceptance-test"]').count() == 1, 'sent preset appears in the Load list')
        anim = json.loads(pg.evaluate("fetch('/api/tw-ratings/tuner/presets').then(r => r.text())"))
        check('fire-acceptance-test' not in anim, 'fx presets stay out of the animation preset list')
    # edit flames: select a candle, drag its flame dot, add one by clicking the object, delete it, send, back to auto
    pg.evaluate("(() => { const s = document.querySelector('#lodFaces'); s.value = 'baked'; s.dispatchEvent(new Event('change')); })()")
    pg.evaluate("void tuner.createRoom('guest', 4, 3, 4, 4)")
    pg.wait_for_function('tuner.episodes() === 0', timeout=150000); time.sleep(2)
    tag = pg.evaluate("(() => { const t = tuner.tags().find(t => /candle|lantern/.test(t.id)); return t && t.tag; })()")
    check(bool(tag), f'a lit object to edit ({tag})')
    if tag:
        pg.evaluate(f"tuner.selectTag('{tag}')")
        it_js = f"[...fx.fire.flames().map(f => f.item)].find(i => i.tag === '{tag}')"
        pg.evaluate(f"(() => {{ const it = {it_js}; const w = it.group.getWorldPosition(new it.group.position.constructor()); tuner.cam.focus.copy(w); tuner.cam.dist = 9; tuner.cam.pitch = 40; tuner.cam.update(); }})()"); time.sleep(1)
        pg.click('#fx-anchor-edit'); time.sleep(0.5)
        n0 = pg.evaluate(f"fx.fire.anchorsOf({it_js}).list.length")
        u0 = pg.evaluate(f"fx.fire.anchorsOf({it_js}).list[0].u")
        sp = pg.evaluate(f"(() => {{ const a = fx.fire.anchorsOf({it_js}).list[0].world; return tuner.project3(a.x, a.y, a.z); }})()")
        pg.mouse.move(sp['x'], sp['y']); pg.mouse.down(); pg.mouse.move(sp['x'] + 25, sp['y'] - 10, steps=6); pg.mouse.up(); time.sleep(0.4)
        u1 = pg.evaluate(f"fx.fire.anchorsOf({it_js}).list[0].u")
        check(u1 != u0 and pg.evaluate(f"fx.fire.anchorsOf({it_js}).source") == 'override', f'dragging a flame dot moves the flame ({u0} -> {u1})')
        # click on the object's body to add a flame there, then Delete removes it again
        cp = pg.evaluate(f"(() => {{ const it = {it_js}; const b = new (it.group.position.constructor)(); it.group.getWorldPosition(b); return tuner.project3(b.x, b.y + (it.spec.dims[1] || 0.5) * 0.4, b.z); }})()")
        pg.mouse.click(cp['x'], cp['y']); time.sleep(0.4)
        n1 = pg.evaluate(f"fx.fire.anchorsOf({it_js}).list.length")
        pg.keyboard.press('Delete'); time.sleep(0.3)
        n2 = pg.evaluate(f"fx.fire.anchorsOf({it_js}).list.length")
        check(n1 == n0 + 1 and n2 == n0, f'click on the object adds a flame, Delete removes it ({n0} -> {n1} -> {n2})')
        check(pg.evaluate('tuner.rooms().length') == 1, 'Delete in edit mode removed the flame, not the room')
        if api_origin:
            pg.evaluate("window.__fxTestNote = 'acceptance test (Fauna)'")
            sku = pg.evaluate(f"fx.fire.anchorsOf({it_js}).sku")
            pg.click('#fx-anchor-send'); time.sleep(1.2)
            rec = json.loads(pg.evaluate("fetch('/api/tw-ratings/tuner/fire_anchors').then(r => r.text())")).get(sku)
            check(bool(rec) and rec['data']['anchors'] == pg.evaluate(f"fx.fire.anchorsOf({it_js}).list.map(a => a.u)"), f'Send flames writes kind fire_anchor for {sku}')
            pg.click('#fx-anchor-auto'); time.sleep(1.2)
            rec = json.loads(pg.evaluate("fetch('/api/tw-ratings/tuner/fire_anchors').then(r => r.text())")).get(sku)
            check(rec and rec['data']['anchors'] is None and pg.evaluate(f"fx.fire.anchorsOf({it_js}).source") == 'auto', 'Auto reverts to the derived flames (server record anchors = null)')
        pg.keyboard.press('Escape')
        if outdir: pg.screenshot(path=f'{outdir}/ui-anchors.png')
    check(not errs, f'no page errors {errs[:3]}')
    b.close()
print('OK' if ok else 'FAILED')
sys.exit(0 if ok else 1)

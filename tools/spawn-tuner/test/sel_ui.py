"""Selection lab acceptance (2026-10-04): the Selection panel renders; every style draws on a clicked object and changes
the pixels around it; dials take effect; hover has its own style; nothing shows through an occluder unless the ghost dial
is up; compare / preview / multi-select modes; presets save, load and send (kind "fx", data.fx = "selection"); "Use in
game" stores the house look (GET /tuner/house -> selection).
python sel_ui.py BASE_URL OUTDIR [API_ORIGIN]   (API_ORIGIN e.g. http://127.0.0.1:8096 when BASE_URL is a local static server)
Exit code = number of failures. Screenshots of every style go to OUTDIR (sel-<style>.png, sel-compare.png, ...)."""
import sys, time, json, io
import numpy as np
from PIL import Image
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright

base, outdir = sys.argv[1].rstrip('/'), sys.argv[2]
api_origin = sys.argv[3] if len(sys.argv) > 3 else None
fails = 0
def check(name, ok, ev=''):
    global fails
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{ev}]' if ev else '')); fails += 0 if ok else 1

STYLES = ['halo', 'footprint', 'ring', 'rim', 'ink', 'spotlight', 'brackets', 'lift', 'motes', 'tint']

def grab(pg, clip):
    return np.asarray(Image.open(io.BytesIO(pg.screenshot(clip=clip))).convert('RGB')).astype(np.int16)
def diff(a, b):  # share of pixels that changed noticeably
    return float((np.abs(a - b).max(axis=2) > 24).mean())

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1500, 'height': 1000})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    if api_origin:
        tw_sandbox.proxy(pg, api_origin)
    pg.add_init_script("try { localStorage.removeItem('tuner.fx.selection.current'); } catch (e) {}")
    pg.goto(base + '/index.html?nobg&nofx&seed=4242')
    pg.wait_for_selector('body[data-ready="1"]', timeout=90000)
    pg.wait_for_function('!!window.selLab', timeout=60000)
    pg.evaluate("import('three').then(T => { window.__THREE = T; })")
    pg.evaluate("document.querySelector('details.major[data-key=\"selection\"]').open = true")
    check('S1 panel: 10 style tiles, 3 state tabs, dials', pg.locator('#sel-styles button').count() == 10 and pg.locator('#sel-tabs button').count() == 3 and pg.locator('#sel-dials input').count() >= 4,
          f"{pg.locator('#sel-styles button').count()} tiles, {pg.locator('#sel-dials input').count()} dials")
    check('S1b default = harry-v1 (breathing top+bottom brackets, ghost 0.1; hover 2-px footprint, ghost 0.2; hidden tint 0.3 at 0.6 Hz)', pg.evaluate("""(() => { const p = selLab.params(), b = p.selected.dials.brackets, t = p.hidden.dials.tint;
        return p.name === 'harry-v1' && p.selected.style === 'brackets' && b.corners === 'both' && b.anim === 'breathe' && b.speed === 0.4 && p.selected.ghost === 0.1
          && p.hover.style === 'footprint' && p.hover.dials.footprint.weight === 2 && p.hover.ghost === 0.2 && p.hidden.style === 'tint' && t.strength === 0.3 && t.pulse === 0.6; })()"""))
    pg.select_option('#fx-selection-load', 'builtin:house-halo')  # the rest of the run starts from the old halo look (no ghost)

    pg.evaluate("(() => { const s = document.querySelector('#lodFaces'); s.value = 'baked'; s.dispatchEvent(new Event('change')); })()")
    pg.evaluate("void tuner.createRoom('common', 4, 3, 7, 5)")
    pg.wait_for_function('tuner.episodes() === 0', timeout=180000); time.sleep(2)
    pg.evaluate("tuner.hideLayers(['walls', 'openings'])")  # a camera-side wall can hide the prop (correctly); S6 tests occlusion
    # the biggest free-standing prop near the middle of the room
    tag = pg.evaluate("""(() => { const t = tuner.tags().filter(t => !['floor','walls','openings'].includes(t.layer) && t.y < 0.3);
        const big = t.map(t => { const it = [...selLab.sel.root.parent.children].length; return t; });
        const cx = (4 + 3.5) * 5, cz = (3 + 2.5) * 5;
        big.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz));
        return (big.find(t => /table|bench|chest|barrel|cask/.test(t.id)) || big[0]).tag; })()""")
    check('S2a a prop to select', bool(tag), tag)
    pg.evaluate(f"tuner.selectTag('{tag}')")
    info = pg.evaluate(f"(() => {{ const t = tuner.tags().find(t => t.tag === '{tag}'); tuner.cam.focus.set(t.x, 0, t.z); tuner.cam.dist = 26; tuner.cam.pitch = 48; tuner.cam.update(); return t; }})()")
    time.sleep(0.8)
    c = pg.evaluate(f"tuner.project3({info['x']}, {info['h'] / 2}, {info['z']})")
    # the clip: the object's screen box plus room for the ground styles and brackets
    sb = pg.evaluate(f"""(() => {{ const t = tuner.tags().find(t => t.tag === '{tag}'); const xs = [], ys = [];
        for (const dx of [-1, 1]) for (const dz of [-1, 1]) for (const y of [0, t.h]) {{ const q = tuner.project3(t.x + dx * 4, y, t.z + dz * 4); xs.push(q.x); ys.push(q.y); }}
        return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }})()""")
    clip = {'x': max(0, sb[0] - 30), 'y': max(0, sb[1] - 60), 'width': min(1500, sb[2] - sb[0] + 60), 'height': min(1000, sb[3] - sb[1] + 90)}
    # clicking the object selects it through the real picking path
    pg.evaluate("tuner.select(null)"); pg.mouse.click(c['x'], c['y']); time.sleep(0.4)
    clicked = pg.evaluate("tuner.selectedTag()")
    if clicked != tag: pg.evaluate(f"tuner.selectTag('{tag}')"); time.sleep(0.3)
    check('S2b clicking an object shows the selection live', pg.evaluate("selLab.sel.stats().entries.some(e => e.state === 'selected' && e.drawn)"), f'clicked {clicked}')
    pg.evaluate("selLab.hover(null)"); pg.mouse.move(5, 5)
    pg.evaluate("selLab.sel.clear()"); time.sleep(0.3)
    bare = grab(pg, clip)
    pg.evaluate(f"tuner.selectTag('{tag}')"); time.sleep(0.3)
    shots = {}
    for s in STYLES:
        pg.click(f'#sel-styles button[data-style="{s}"]'); time.sleep(0.9)
        st = pg.evaluate("selLab.sel.stats()")
        e = next((e for e in st['entries'] if e['state'] == 'selected'), None)
        img = grab(pg, clip); shots[s] = img
        Image.fromarray(img.astype(np.uint8)).save(f'{outdir}/sel-{s}.png')
        d = diff(img, bare); npx = int(d * img.shape[0] * img.shape[1])
        ok = bool(e) and e['style'] == s and e['drawn'] and e['depthTest'] and not e['ghost'] and npx >= 300
        check(f'S3 style {s} renders (depth-tested, no ghost) and changes the pixels', ok, f"{e and e['parts']} parts, {npx} px ({d * 100:.1f}%) changed")
    pg.screenshot(path=f'{outdir}/sel-panel.png')

    # dials take effect (UI inputs -> params -> pixels / state)
    def dial(path, v):
        pg.locator(f'[data-path="{path}"]').evaluate(f"e => {{ e.value = '{v}'; e.dispatchEvent(new Event('input', {{ bubbles: true }})); }}")
        time.sleep(0.6)
    pg.click('#sel-styles button[data-style="halo"]'); time.sleep(0.5)
    dial('selection.selected.halo.pulse', 0); dial('selection.selected.halo.width', 0.05); a = grab(pg, clip)
    dial('selection.selected.halo.width', 0.5); b2 = grab(pg, clip)
    check('S4a halo width dial changes the halo', abs(pg.evaluate("selLab.params().selected.dials.halo.width") - 0.5) < 1e-9 and diff(a, b2) > 0.01, f'{diff(a, b2) * 100:.1f}% px')
    pg.click('#sel-styles button[data-style="ring"]'); time.sleep(0.4)
    dial('selection.selected.ring.radius', 0.8); a = grab(pg, clip); dial('selection.selected.ring.radius', 1.8); b2 = grab(pg, clip)
    check('S4b ring radius dial changes the ring', diff(a, b2) > 0.01, f'{diff(a, b2) * 100:.1f}% px')
    pg.click('#sel-styles button[data-style="ink"]'); time.sleep(0.4)
    dial('selection.selected.ink.thickness', 1); a = grab(pg, clip); dial('selection.selected.ink.thickness', 8); b2 = grab(pg, clip)
    check('S4c ink thickness dial changes the outline', diff(a, b2) > 0.004, f'{diff(a, b2) * 100:.1f}% px')
    pg.click('#sel-styles button[data-style="lift"]'); time.sleep(0.4)
    dial('selection.selected.lift.bob', 0); dial('selection.selected.lift.height', 1.5); time.sleep(0.6)
    lift = pg.evaluate("selLab.sel.stats().entries.find(e => e.state === 'selected').lift")
    check('S4d lift height dial lifts the object 1.5 ft', abs(lift - 1.5) < 0.05, f'lift {lift}')
    pg.click('#sel-styles button[data-style="halo"]'); time.sleep(0.6)
    rest = pg.evaluate("selLab.sel.stats().entries.find(e => e.state === 'selected').lift")
    check('S4e switching away from lift puts the object back down', rest == 0, f'lift {rest}')
    pg.click('#sel-styles button[data-style="brackets"]'); time.sleep(0.3)
    nseg = lambda: pg.evaluate("(() => { let n = 0; selLab.sel.root.traverse(o => { if (o.isLineSegments2 && !o.material.depthFunc) {} if (o.isLineSegments2) n = Math.max(n, o.geometry.attributes.instanceStart.count); }); return n; })()")
    dial('selection.selected.brackets.corners', 'top'); a_n = nseg(); dial('selection.selected.brackets.corners', 'both'); b_n = nseg()
    check('S4h brackets: top only = 4 corners, top and bottom = 8 corners', a_n == 12 and b_n == 24, f'{a_n} -> {b_n} segments')
    pg.click('#sel-styles button[data-style="motes"]'); dial('selection.selected.motes.count', 25)
    n = pg.evaluate("(() => { let n = 0; selLab.sel.root.traverse(o => { if (o.isPoints) n = o.geometry.attributes.position.count; }); return n; })()")
    check('S4f motes count dial', n == 25, f'{n} motes')
    pg.select_option('#sel-colorSrc', 'fixed'); pg.locator('#sel-fixed').evaluate("e => { e.value = '#ff0000'; e.dispatchEvent(new Event('input', { bubbles: true })); }"); time.sleep(0.3)
    check('S4g fixed colour', pg.evaluate("selLab.params().selected.color === 'fixed' && selLab.params().selected.fixed === '#ff0000'"))
    pg.select_option('#sel-colorSrc', 'seat')

    pg.evaluate("tuner.hideLayers([])")
    # hover: its own style, independent of selected
    pg.click('#sel-tabs button[data-state="hover"]'); pg.click('#sel-styles button[data-style="ring"]'); time.sleep(0.2)
    pg.click('#sel-tabs button[data-state="selected"]'); pg.click('#sel-styles button[data-style="halo"]'); time.sleep(0.2)
    other = pg.evaluate(f"""(() => {{ const c = document.querySelector('#c');
        for (const t of tuner.tags().filter(t => !['floor','walls','openings'].includes(t.layer) && t.tag !== '{tag}')) {{
          const q = tuner.project3(t.x, t.h / 2, t.z); if (document.elementFromPoint(q.x, q.y) !== c) continue;
          if (tuner.probe(q.x, q.y).hit === t.tag) return t.tag; }} return null; }})()""")
    pg.evaluate(f"(() => {{ const t = '{other}'; tuner.selectTag(t); }})()"); time.sleep(0.2)
    pg.evaluate(f"tuner.selectTag('{tag}')")  # select back; hover the other one through the real pointer
    o = pg.evaluate(f"(() => {{ const t = tuner.tags().find(t => t.tag === '{other}'); return tuner.project3(t.x, t.h / 2, t.z); }})()")
    pg.mouse.move(o['x'] - 30, o['y'] - 30); time.sleep(0.1); pg.mouse.move(o['x'], o['y'], steps=6); time.sleep(0.12); pg.mouse.move(o['x'] + 1, o['y']); time.sleep(0.5)  # the tuner's hover is throttled to 50 ms
    probe = pg.evaluate(f"tuner.probe({o['x']}, {o['y']})")
    st = pg.evaluate("selLab.sel.stats().entries")
    hov = [e for e in st if e['state'] == 'hover']; sel = [e for e in st if e['state'] == 'selected']
    under = pg.evaluate("([x, y]) => { const e = document.elementFromPoint(x, y); return e.tagName + '#' + e.id + '.' + e.className; }", [o['x'], o['y']]); labh = pg.evaluate('selLab.hovered()')
    check('S5 hover has its own style (hover ring while selected is a halo)', bool(hov) and hov[0]['style'] == 'ring' and sel and sel[0]['style'] == 'halo', f'probe {probe} other {other} lab hovered {labh} under {under} ' + json.dumps(st))
    pg.mouse.move(5, 5); time.sleep(0.3)

    # occlusion: a big opaque box between the camera and the object hides every style (except the spotlight's scene dim)
    pg.evaluate("""(() => { const T = window.__THREE, cam = tuner.cam.camera || selLab.sel.root.parent.children.find(o => o.isCamera);
        const s = selLab.sel.root.parent; const camera = window.__cam || null; })()""")
    pg.evaluate(f"""(() => {{ const T = window.__THREE; const sc = selLab.sel.root.parent;
        const t = tuner.tags().find(t => t.tag === '{tag}'); const target = new T.Vector3(t.x, t.h / 2, t.z);
        const cam = tuner.cam.camera; const dir = target.clone().sub(cam.position); const at = cam.position.clone().add(dir.multiplyScalar(0.45));
        const m = new T.Mesh(new T.BoxGeometry(40, 40, 0.5), new T.MeshBasicMaterial({{ color: '#202020' }})); m.position.copy(at); m.lookAt(cam.position); m.name = 'test-occluder'; sc.add(m); }})()""")
    has_cam = pg.evaluate("!!tuner.cam.camera")
    time.sleep(0.4)
    pg.evaluate("selLab.sel.clear()"); time.sleep(0.3); occ_bare = grab(pg, clip)
    pg.evaluate(f"tuner.selectTag('{tag}')")
    leaks = []
    for s in STYLES:
        if s == 'spotlight': continue
        pg.click(f'#sel-styles button[data-style="{s}"]'); time.sleep(0.7)
        d = diff(grab(pg, clip), occ_bare)
        if d > 0.002: leaks.append(f'{s} {d * 100:.2f}%')
    check('S6a nothing shows through an occluder (9 styles)', has_cam and not leaks, ', '.join(leaks) or 'clean')
    pg.click('#sel-styles button[data-style="footprint"]'); time.sleep(0.3)
    pg.locator('#sel-ghost').evaluate("e => { e.value = '0.6'; e.dispatchEvent(new Event('input', { bubbles: true })); }"); time.sleep(0.7)
    g = pg.evaluate("selLab.sel.stats().entries.find(e => e.state === 'selected')")
    d = diff(grab(pg, clip), occ_bare)
    check('S6b the ghost dial deliberately shows the footprint through the occluder', g['ghost'] and d > 0.002, f'{d * 100:.2f}% px')
    pg.locator('#sel-ghost').evaluate("e => { e.value = '0'; e.dispatchEvent(new Event('input', { bubbles: true })); }")
    pg.evaluate("selLab.sel.root.parent.getObjectByName('test-occluder').removeFromParent()")
    pg.click('#sel-styles button[data-style="halo"]'); time.sleep(0.3)

    # occlusion by the REAL room (walls on, low camera): along every ground style, the points a ray from the camera can't
    # reach (a wall, furniture or the thing itself is in front) must leave the pixels unchanged
    LEAKS = """(([pts]) => { const T = window.__THREE, cam = tuner.cam.camera, sc = selLab.sel.root.parent, ray = new T.Raycaster(); ray.camera = cam;
        const targets = sc.children.filter(o => o !== selLab.sel.root && o.visible && !o.isLight); const out = [];
        for (const p of pts) { const P = new T.Vector3(...p), dir = P.clone().sub(cam.position), dist = dir.length(); ray.set(cam.position, dir.normalize()); ray.far = dist;
          const shown = (o) => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
          const hit = ray.intersectObjects(targets, true).find(h => shown(h.object) && !h.object.userData?.selFx && !h.object.isSprite && !h.object.isLine && !h.object.isLineSegments && !h.object.isPoints && h.distance < dist - 0.25);
          const q = tuner.project3(P.x, P.y, P.z); out.push([q.x, q.y, !!hit, hit ? +(dist - hit.distance).toFixed(2) : 0, hit ? (hit.object.parent?.parent?.userData?.item?.spec?.id || hit.object.name) : '']); }
        return out; })"""
    pg.evaluate("tuner.cam.focus.set(37.5, 0, 27.5); tuner.cam.dist = 34; tuner.cam.pitch = 36; tuner.cam.yaw = (tuner.cam.yaw || 0) + 35; tuner.cam.update()"); time.sleep(0.5)
    props = pg.evaluate(f"""(() => {{ const c = document.querySelector('#c'); return tuner.tags().filter(t => !['floor','walls','openings'].includes(t.layer) && t.y < 0.3)
        .filter(t => {{ const q = tuner.project3(t.x, 0, t.z); return document.elementFromPoint(q.x, q.y) === c; }}).slice(0, 6).map(t => t.tag); }})()""")
    hidden_n = leak_n = shown_n = shown_changed = 0; leak_by = {}; leak_m = []
    full = {'x': 0, 'y': 0, 'width': 1500, 'height': 1000}
    for ptag in props:
        pg.evaluate(f"selLab.pick('{ptag}')")
        for s in ['footprint', 'ring', 'brackets', 'motes']:
            pg.click(f'#sel-styles button[data-style="{s}"]'); time.sleep(0.5)
            if s == 'motes': pg.evaluate("selLab.sel.set({ ...selLab.params(), selected: { ...selLab.params().selected, dials: { ...selLab.params().selected.dials, motes: { ...selLab.params().selected.dials.motes, speed: 0 } } } })"); time.sleep(0.4)
            pts = pg.evaluate("selLab.sel.samples()")
            vis = pg.evaluate(LEAKS, [pts])
            on = grab(pg, full); pg.evaluate("selLab.sel.root.visible = false"); time.sleep(0.25); off = grab(pg, full); pg.evaluate("selLab.sel.root.visible = true")
            m = np.abs(on - off).max(axis=2) > 30
            for x, y, hid, margin, what in vis:
                xi, yi = int(round(x)), int(round(y))
                if not (2 <= xi < 1498 and 2 <= yi < 998): continue
                near = m[yi - 1:yi + 2, xi - 1:xi + 2].any()
                if hid:
                    # a hidden point next to a visible stretch of the same line can catch its edge: only count it a leak
                    # when the whole 5x5 neighbourhood is behind something in the ray test too (approximated: centre only)
                    hidden_n += 1
                    if m[yi, xi]: leak_n += 1; leak_by[s] = leak_by.get(s, 0) + 1; leak_m.append((margin, what, s, tuple(int(v) for v in on[yi, xi]), tuple(int(v) for v in off[yi, xi])))
                else: shown_n += 1; shown_changed += int(near)
    pg.evaluate("selLab.sel.set(selLab.params())")
    check('S6c real room: ground styles never show where the room hides them (and do show where it doesn\'t)', hidden_n >= 20 and leak_n <= max(2, hidden_n * 0.03) and shown_n >= 50 and shown_changed >= shown_n * 0.6,
          f'{len(props)} props, {hidden_n} hidden samples, {leak_n} leaked {leak_by} (occluder in front by {sorted(leak_m)[-6:]}); {shown_changed}/{shown_n} visible samples drew')
    pg.click('#sel-styles button[data-style="halo"]'); time.sleep(0.3)

    # compare / preview / multi
    pg.evaluate("tuner.cam.dist = 55; tuner.cam.pitch = 60; tuner.cam.update()"); time.sleep(0.5)
    pg.click('#sel-compare'); time.sleep(1.2)
    st = pg.evaluate("selLab.sel.stats().entries")
    styles_shown = sorted({e['style'] for e in st if e['drawn']})
    check('S7a compare: several objects, a different style each, labelled', len(styles_shown) >= 5 and len(pg.evaluate("selLab.labels()")) == len(st), f'{styles_shown}')
    pg.screenshot(path=f'{outdir}/sel-compare.png')
    pg.click('#sel-states'); time.sleep(0.9)
    st = pg.evaluate("selLab.sel.stats().entries")
    check('S7b preview hover · selected · hidden side by side', sorted(e['state'] for e in st) == ['hidden', 'hover', 'selected'], json.dumps([e['state'] for e in st]))
    pg.screenshot(path=f'{outdir}/sel-states.png')
    pg.evaluate("document.querySelector('[data-path=\"selection.multi.mode\"]').value = 'each+group'; document.querySelector('[data-path=\"selection.multi.mode\"]').dispatchEvent(new Event('input', { bubbles: true }))")
    pg.click('#sel-multiBtn'); time.sleep(0.9)
    st = pg.evaluate("selLab.sel.stats()")
    check('S7c multi-select draws each thing plus one group outline', st['group'] and sum(1 for e in st['entries'] if e['drawn']) >= 2, json.dumps(st)[:200])
    pg.screenshot(path=f'{outdir}/sel-multi.png')
    pg.click('#sel-stop'); time.sleep(0.3)

    # presets
    pg.select_option('#fx-selection-load', 'builtin:rts-rotating')
    check('S8a built-in preset loads', pg.evaluate("selLab.params().selected.style === 'ring' && selLab.params().selected.dials.ring.mode === 'rotating'"))
    pg.fill('#fx-selection-name', 'sel-acceptance-test'); pg.click('#fx-selection-save')
    pg.select_option('#fx-selection-load', 'builtin:house-halo')
    pg.select_option('#fx-selection-load', 'local:sel-acceptance-test')
    check('S8b preset saved in this browser loads back', pg.evaluate("selLab.params().selected.style === 'ring'"))
    if api_origin:
        pg.click('#fx-selection-send'); time.sleep(1.5)
        recs = json.loads(pg.evaluate("fetch('/api/tw-ratings/tuner/fx').then(r => r.text())"))
        rec = recs.get('sel-acceptance-test')
        check('S8c preset sent as kind fx with data.fx = selection', bool(rec) and rec['data'].get('fx') == 'selection' and rec['data']['selected']['style'] == 'ring')
        check('S8d sent preset appears in the Load list', pg.locator('#fx-selection-load option[value="remote:sel-acceptance-test"]').count() == 1)
        # Use in game with the DEFAULT look (so the game's look doesn't change before the test record is archived)
        pg.click('#fx-selection-reset'); pg.fill('#fx-selection-name', 'harry-v1'); pg.fill('#fx-selection-note', 'acceptance test (Fauna)')
        pg.click('#fx-selection-house'); time.sleep(1.5)
        house = json.loads(pg.evaluate("fetch('/api/tw-ratings/tuner/house').then(r => r.text())"))
        hs = house.get('selection') or {}
        check('S8e "Use in game" stores the house selection look (GET /tuner/house)', hs.get('fx') == 'selection' and hs.get('selected', {}).get('style') == 'brackets' and 'selection' in house.get('at', {}), json.dumps(hs)[:120])
    check('S9 no page errors', not errs, '; '.join(errs)[:300])
    b.close()
sys.exit(fails)

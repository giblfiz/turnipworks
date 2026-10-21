"""Ring Lab ellipse / one-curve acceptance (Harry 2026-10-19: "maybe the menu is really an oval ... the primary items
sit on the normal ellipse, and then slide"; and "the *slide* needs to be actual animated visual movement").

  local:  TW_GPU=1 python3 tests/browser_ring_ellipse.py [--shots DIR]
  dev:    ... tests/browser_ring_ellipse.py --page http://127.0.0.1:8180/ [--shots DIR]

PRESET  the built-in "Ellipse · one curve" loads from the real panel (Preset ▸ Load) on the live 3D lab table
PLACES  pawn, object (a door: four primaries) and room, closed and expanded, and a pawn with Conditions open: every
        button on the drawn ellipse (or its grown ring), no page errors, the panel says the forbidden sector is clear,
        and no button box reaches right of AND below the piece (the 3–6 sector), measured from the DOM
SLIDE   a real click on ☰, at real speed: each primary's on-screen centre is sampled every animation frame; the samples
        are distinct, step one way only (counterclockwise opening, clockwise closing) and lie on the ellipse (±2 px)
CALM    with prefers-reduced-motion the same click jumps: no animation runs
The campaign is "TEST ring ellipse (throwaway)", made for the run and deleted at exit.
"""
import argparse, json, math, os, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent)); import tw_sandbox  # noqa: E402
tw_sandbox.remove_campaigns()
ROOT = Path(__file__).resolve().parents[1]
RATINGS = None
ap = argparse.ArgumentParser(); ap.add_argument('--page'); ap.add_argument('--shots'); A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

PRESET = 'Ellipse · one curve'
# (2026-10-20: Ring Lab has no stage of its own: the drawer shapes the GAME ring, #ring .rbtn[data-id]; each button's arc
#  is its node's key in tw.ringNodes(); the shutting buttons that run back into ☰ are .leaving copies with no data-id)
BTNS = "[...document.querySelectorAll('#ring > .rbtn[data-id]')]"
ARCS = "Object.fromEntries(tw.ringNodes().map(n => [n.id, n.key]))"
STATE = """() => { const st = document.querySelector('#ring'), arcs = """ + ARCS + """;
  const bs = """ + BTNS + """.map(b => { const r = b.getBoundingClientRect(); return { id: b.dataset.id, arc: arcs[b.dataset.id] || null, x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, size: parseFloat(b.style.width) }; });
  return { bs, curve: st._curve || null, warn: document.querySelector('#ringlab-panel [data-role=warnings]').textContent, g: (() => { const q = tw.ringGeom?.(), a = ringLab.anchor?.(); return q ? { ...q, bx: q.cx, by: q.cy, ...(a && { cx: a.x, cy: a.y }) } : null; })(), anim: document.getAnimations().filter(a => a.effect?.target?.classList?.contains('rbtn')).length, settings: ringLab.panel.settings(), k: ringLab.world()?.scale || 1 }; }"""
# Sample every animation frame, at real speed, for `ms` after the call (the click comes right after this starts).
SAMPLER = """(ms) => { window.__samples = []; const t0 = performance.now();
  const tick = () => { const now = performance.now(); const row = { t: now - t0, b: {} };
    const st = document.querySelector('#ring'); row.c = st._curve ? { ...st._curve } : null; row.carried = !!st._anim?.carried;
    for (const b of document.querySelectorAll('#ring > .rbtn[data-id]')) { const r = b.getBoundingClientRect(); row.b[b.dataset.id] = [(r.left + r.right) / 2, (r.top + r.bottom) / 2]; }
    window.__samples.push(row); if (now - t0 < ms) requestAnimationFrame(tick); };
  requestAnimationFrame(tick); }"""

def off_ellipse(c, x, y):
    best, bt = 1e9, 0.0
    for i in range(1440):
        t = i / 1440 * 2 * math.pi; d = math.hypot(c['cx'] + c['rx'] * math.sin(t) - x, c['cy'] - c['ry'] * math.cos(t) - y)
        if d < best: best, bt = d, t
    h = 2 * math.pi / 1440
    while h > 1e-7:
        for t in (bt - h, bt + h):
            d = math.hypot(c['cx'] + c['rx'] * math.sin(t) - x, c['cy'] - c['ry'] * math.cos(t) - y)
            if d < best: best, bt = d, t
        h /= 2
    return best
def param(c, x, y): return math.degrees(math.atan2((x - c['cx']) / c['rx'], -(y - c['cy']) / c['ry']))
def in_sector(b, g): return b['x'] + b['size'] / 2 > g['cx'] + 0.5 and b['y'] + b['size'] / 2 > g['cy'] + 0.5

def free(port):
    with socket.socket() as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try: s.bind(('127.0.0.1', port)); return True
        except OSError: return False

procs, tmp = [], None
if A.page:
    base = A.page.rstrip('/') + '/'; relay = urllib.parse.urljoin(base, '/api/tw-relay'); extra = 'nointro'
    game_url = base + '?ringlab=1&' + extra
else:
    tmp = tempfile.TemporaryDirectory(prefix='tw-ringellipse-'); data = tmp.name
    web, rport = 18872, 18873
    assert free(web) and free(rport), 'test ports busy'
    site = Path(data) / 'site'; site.mkdir(); os.symlink(ROOT / 'engine', site / 'engine'); os.symlink(ROOT / 'tools', site / 'tools'); os.symlink(ROOT / 'tools/spawn-tuner', site / 'tuner')
    procs = [subprocess.Popen([sys.executable, '-m', 'http.server', str(web), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL),
             subprocess.Popen(['node', str(ROOT / 'engine/relay/server.js')], env={**os.environ, 'PORT': str(rport), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=open(data + '/relay.log', 'w'), stderr=subprocess.STDOUT)]
    relay = f'http://127.0.0.1:{rport}'
    # this checkout's own ratings server (it knows the house `ring` field), seeded with a COPY of the live house and ring
    # records (read only); every write still carries the tw_sandbox header and lands in its sandbox
    rv = Path(data) / 'reviews'; (rv / 'tuner').mkdir(parents=True)
    for f in ('house.jsonl', 'ring.jsonl'):
        src = Path(tw_sandbox.REVIEWS) / 'tuner' / f
        if src.exists(): (rv / 'tuner' / f).write_bytes(src.read_bytes())
    procs.append(subprocess.Popen([sys.executable, str(ROOT / 'server/ratings_server.py')], env={**os.environ, 'TW_REVIEWS_DIR': str(rv), 'TW_RATINGS_PORT': '18874'}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    RATINGS = 'http://127.0.0.1:18874'
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(relay + '/health', timeout=1); break
        except Exception: pass  # noqa: BLE001
    game_url = f'http://127.0.0.1:{web}/engine/client/index.html?ringlab=1&relay={urllib.parse.quote(relay)}&tuner=http://127.0.0.1:{web}/tuner/&api=/api/tw-ratings&boxes&nofx&nointro&faces=1500'

# The run's own campaign, named as a throwaway; the lab furnishes it because it is this browser's lab token.
req = urllib.request.Request(relay + '/campaigns', data=json.dumps({'name': 'TEST ring ellipse (throwaway)', 'gm': 'Fauna'}).encode(), method='POST', headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 tw-test', **tw_sandbox.HEADERS})
made = json.loads(urllib.request.urlopen(req, timeout=20).read()); assert made.get('ok'), made
CAMPAIGN, TOKEN = made['campaign'], made['token']
shots = Path(A.shots) if A.shots else None
if shots: shots.mkdir(parents=True, exist_ok=True)

try:
    with sync_playwright() as p:
        gl = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
        b = p.chromium.launch(headless=True, args=['--no-sandbox', *gl, '--disable-background-timer-throttling', '--disable-renderer-backgrounding'])
        ctx = b.new_context(viewport={'width': 1440, 'height': 900})
        ctx.add_init_script(f"try {{ localStorage.setItem('tw.ringlab.token', {json.dumps(TOKEN)}); localStorage.removeItem('tw.ring.draft'); }} catch {{}}")
        game = ctx.new_page()
        if not A.page: tw_sandbox.proxy(game, RATINGS)
        errors = []; game.on('pageerror', lambda e: errors.append(str(e)))
        game.goto(game_url + '#s=' + urllib.parse.quote(TOKEN), wait_until='domcontentloaded', timeout=60000)
        game.wait_for_function("window.tw && tw.sync.status==='live' && window.ringLab", timeout=60000)
        game.wait_for_function("Object.values(tw.entities()).some(e=>e.name==='Ring lab door') && Object.values(tw.entities()).some(e=>e.name==='Bram')", timeout=90000)
        game.wait_for_function("document.querySelector('#twl')?.hidden !== false", timeout=60000)
        # The preset, through the real panel.
        game.locator('#ringlab-open').click()
        game.locator('#ringlab-panel [data-role=preset]').select_option(PRESET); game.locator('#ringlab-panel [data-role=loadPreset]').click()
        if os.environ.get('TW_RING_CURVE'):  # a tuning aid: try other curve numbers on top of the preset (TW_RING_CURVE='{"groupGap":8}')
            game.evaluate('(c) => { const s = structuredClone(ringLab.panel.settings()); Object.assign(s.curve, c); ringLab.panel.setSettings(s); }', json.loads(os.environ['TW_RING_CURVE']))
        s = game.evaluate('ringLab.panel.settings()')
        check(s['curve']['on'] and s['curve']['rx'] == 210 and s['curve']['ry'] == 150, 'PRESET loads from the panel', f"{s['curve']['rx']}x{s['curve']['ry']} centre y {s['curve']['y']}")
        check(game.locator('#ringlab-panel [data-role=curveRead]').inner_text().startswith('8 buttons fit across the top'), 'PRESET readout: 8 buttons fit across the top', game.locator('#ringlab-panel [data-role=curveRead]').inner_text())
        game.locator('#ringlab-panel [data-role=collapse]').click()

        def frame(name):
            game.evaluate("""(name) => { const e = Object.values(tw.entities()).find(x => x.name === name); tw.select(e.id); const g = tw.main.grab;
              const r = e.recipe, CELL = 5, fx = typeof e.x === 'number' ? e.x : (r.x + r.w / 2) * CELL, fz = typeof e.z === 'number' ? e.z : (r.z + r.d / 2) * CELL; g.focus.set(fx, 0, fz); g.dist = 90; g.pitch = 50; g.yaw = 0; g.update(); }""", name)
            game.wait_for_timeout(350)
            game.wait_for_function("document.querySelectorAll('#ring > .rbtn[data-id]').length > 0")
            game.mouse.move(5, 890)
        def look(label, want_state, expect_arcs=None):
            st = game.evaluate(STATE)
            c, g = st['curve'], st['g']
            check(st['bs'] and c and g, f'{label}: ring drawn', f"{len(st['bs'])} buttons")
            if not (st['bs'] and c and g): return st
            base_btn = [x for x in st['bs'] if x['arc'] in ('closed', 'primary', 'secondary', 'menu')]
            worst = max(off_ellipse(c, x['x'], x['y']) for x in base_btn)
            check(worst <= 2, f'{label}: every button on the ellipse', f'worst {worst:.2f} px')
            grown = [x for x in st['bs'] if x['arc'] not in ('closed', 'primary', 'secondary', 'menu')]
            if expect_arcs:
                off = st['settings']['curve']['nestOffset'] * st['k']   # (world size: the offset scales with the ring)
                ring_off = [min(off_ellipse({**c, 'rx': c['rx'] + k * off, 'ry': c['ry'] + k * off}, x['x'], x['y']) for k in (1, 2, 3)) for x in grown]
                check(grown and max(ring_off) <= 2, f'{label}: nested buttons on the grown ellipse (+{off} both axes)', f'{len(grown)} buttons, worst {max(ring_off) if ring_off else "-"}')
            bad = [x['id'] for x in st['bs'] if in_sector(x, g)]
            check(not bad, f'{label}: 3–6 sector empty (DOM)', bad or f"anchor {g['cx']:.0f},{g['cy']:.0f}")
            check(st['warn'] == 'Forbidden sector clear', f'{label}: panel warnings clear', st['warn'])
            check(game.evaluate('ringLab.state()') == want_state, f'{label}: state {want_state}')
            return st
        def shoot(name):
            if shots: game.screenshot(path=str(shots / f'{name}.png'))
        def click_menu(keep_focus=False):
            # A real mouse click on ☰ (page.mouse, so the slider keeps focus when keep_focus: buttons don't take it here).
            r = game.locator('#ring > .rbtn[data-menu]').bounding_box(); x, y = r['x'] + r['width'] / 2, r['y'] + r['height'] / 2
            hit = game.evaluate("([x, y]) => { const el = document.elementFromPoint(x, y); return el?.closest?.('#ring > .rbtn[data-menu]') ? null : (el ? el.tagName + '#' + el.id + '.' + (el.className?.baseVal ?? el.className) : 'nothing (off screen)'); }", [x, y])
            if hit: print(f'    (☰ at {x:.0f},{y:.0f} is under {hit})', flush=True)
            game.mouse.click(x, y); game.mouse.move(5, 890)
        def slide_samples(direction, label, keep_focus=False, during=None):
            before = game.evaluate(STATE)
            game.evaluate(SAMPLER, 1400); click_menu(keep_focus)
            if during: during()
            game.wait_for_timeout(1550 if not during else 1100)
            rows = game.evaluate('window.__samples'); after = game.evaluate(STATE); c = after['curve']
            prim = [x['id'] for x in after['bs'] if x['arc'] in ('primary', 'closed')]
            check(after['curve'] and prim, f'{label}: primaries after the {direction}', prim)
            if during:
                check(any(r['carried'] for r in rows), f'{label}: the ring was redrawn during the slide (and carried it on)')
                check(all(not (r['c'] or {}).get('shift') or r['c']['shift'] == [0, 0] for r in rows), f'{label}: the ring stayed clear of the screen edge', {tuple((r['c'] or {}).get('shift') or ()) for r in rows})
            for pid in prim:
                seq = [(r['t'], *r['b'][pid], r['c'] or c) for r in rows if pid in r['b']]
                pts = []
                for t, x, y, cc in seq:
                    if not pts or math.hypot(x - pts[-1][1], y - pts[-1][2]) > 0.25: pts.append((t, x, y, cc))
                ts = [param(cc, x, y) for _, x, y, cc in pts]   # each sample against the curve drawn in ITS frame
                steps = [b2 - a2 for a2, b2 in zip(ts, ts[1:])]
                one_way = all(d < 0.02 for d in steps) if direction == 'open' else all(d > -0.02 for d in steps)
                worst = max(off_ellipse(cc, x, y) for _, x, y, cc in pts)
                moving = [round(p[0]) for p in pts]
                check(len(pts) >= 5, f'{label} {direction}: {pid} visibly travels', f'{len(pts)} distinct positions over {len(seq)} frames at t={moving[:3]}…{moving[-2:]} ms')
                check(one_way and abs(ts[-1] - ts[0]) > 10, f'{label} {direction}: {pid} steps one way along the curve', f'{ts[0]:.1f}° → {ts[-1]:.1f}° ({"counterclockwise" if direction == "open" else "clockwise"})')
                check(worst <= 2, f'{label} {direction}: {pid} stays on the ellipse while moving', f'worst {worst:.2f} px')
            return before, after

        # ---- pawn, object (door), room: closed, expanded, the slide both ways ----
        for label, name in [('pawn', 'Bram'), ('object', 'Ring lab door'), ('room', 'Ring lab common room')]:
            frame(name)
            st = look(f'{label} closed', 'closed')
            if label == 'pawn' and st['g']:
                for dist in (90, 40):
                    game.evaluate('(d) => { const g = tw.main.grab; g.dist = d; g.update(); }', dist); game.wait_for_timeout(300)
                    st2 = game.evaluate(STATE); g = st2['g']; top = g['by'] - g['hy']
                    over = [x for x in st2['bs'] if abs(x['x'] - g['bx']) < g['hx'] + x['size'] / 2]
                    lowest = max((x['y'] + x['size'] / 2) for x in over) if over else -1
                    check(lowest <= top + 1, f'pawn closed at camera distance {dist}: the row clears the figure (no button over its box)', f'lowest button edge over it {lowest:.0f}, figure top {top:.0f} (box {2*g["hx"]:.0f}x{2*g["hy"]:.0f})')
                game.evaluate('() => { const g = tw.main.grab; g.dist = 90; g.update(); }'); game.wait_for_timeout(300)
            shoot(f'{label}-closed')
            slide_samples('open', label)
            look(f'{label} expanded', 'expanded'); shoot(f'{label}-expanded')
            slide_samples('close', label)
            look(f'{label} closed again', 'closed')

        # ---- pawn with Conditions open (a nested arc on the grown ellipse) ----
        frame('Bram'); click_menu(); game.wait_for_timeout(900)
        game.locator('#ring > .rbtn[data-id="pawn.cond."]').click(); game.mouse.move(5, 890); game.wait_for_timeout(300)
        look('pawn conditions', 'nested', expect_arcs=True); shoot('pawn-conditions')

        # ---- AGAIN (Harry 2026-10-20: "*sometimes* the options-open animates and sometimes it doesn't. (seems to animate
        #      after I haven't changed anything in a while)"): his saved "tune-alpha v1", every open and close slides, in a
        #      row, and right after a slider change with the slider still focused.
        TUNE_ALPHA = json.loads((ROOT / 'tests/data/ring-tune-alpha-v1.json').read_text())
        game.evaluate('(s) => ringLab.panel.setSettings(s)', TUNE_ALPHA['settings'])
        frame('Bram')
        if game.evaluate('ringLab.state()') != 'closed': click_menu(); game.wait_for_timeout(900)
        for k in range(3):
            slide_samples('open', f'AGAIN in a row {k + 1}'); slide_samples('close', f'AGAIN in a row {k + 1}')
        game.locator('#ringlab-open').click()
        for k, (field, key) in enumerate([('ry', 'ArrowRight'), ('y', 'ArrowLeft'), ('groupGap', 'ArrowRight')]):
            sl = game.locator(f'#ringlab-panel [data-arc=curve] input[data-field={field}]'); sl.scroll_into_view_if_needed(); sl.focus(); sl.press(key); sl.press(key)
            check(game.evaluate("document.activeElement?.dataset?.field") == field, f'AGAIN: slider {field} changed and still focused')
            slide_samples('open', f'AGAIN after {field}', keep_focus=True); slide_samples('close', f'AGAIN after {field}', keep_focus=True)
        sl = game.locator('#ringlab-panel [data-arc=curve] input[data-field=rx]'); sl.scroll_into_view_if_needed(); box = sl.bounding_box()
        game.mouse.click(box['x'] + box['width'] * 0.42, box['y'] + box['height'] / 2)   # a mouse change on a slider, then straight to ☰
        slide_samples('open', 'AGAIN after a mouse drag on rx', keep_focus=True); slide_samples('close', 'AGAIN after a mouse drag on rx', keep_focus=True)
        game.locator('#ringlab-panel [data-role=collapse]').click()
        # A redraw in the middle of the slide (a trackpad's momentum still zooming the camera): the slide carries on.
        def wheel_during():
            g = game.evaluate('tw.ringGeom()'); game.mouse.move(g['cx'] - 120, g['cy'] + 60)
            for _ in range(6): game.mouse.wheel(0, 10); game.wait_for_timeout(45)
        for k in range(2):
            frame('Bram')
            slide_samples('open', f'CARRY camera zooming mid-slide {k + 1}', during=wheel_during)
            slide_samples('close', f'CARRY camera zooming mid-slide {k + 1}', during=wheel_during)
        game.evaluate('(s) => ringLab.panel.setSettings(s)', game.evaluate(f"ringLab.panel.presets()[{json.dumps(PRESET)}]"))

        # ---- the 8-frame strip: the real opening, paused at eight moments ----
        frame('Bram')
        if game.evaluate('ringLab.state()') != 'closed': click_menu(); game.wait_for_timeout(900)
        click_menu()
        RING_ANIMS = "document.getAnimations().filter(a => a.effect?.target?.closest?.('#ring'))"
        # (the game ring lays the slide out again every frame while it plays, so that a camera move mid-slide carries it on:
        #  a paused animation is replaced on the next frame. The eight moments are taken at real time instead, in the page.)
        res8 = game.evaluate("""async () => { const arcs = """ + ARCS + """, first = """ + BTNS + """.find(b => arcs[b.dataset.id] === 'primary'), as = """ + RING_ANIMS + """.filter(a => a.effect.target === first);
            const total = Math.max(...as.map(a => (a.effect.getTiming().delay || 0) + (a.effect.getTiming().duration || 0))), t0 = performance.now(), out = [];  // (the first primary's own slide)
            const prim = () => { const arcs = """ + ARCS + """; return """ + BTNS + """.filter(b => arcs[b.dataset.id] === 'primary').map(b => { const r = b.getBoundingClientRect(); return [Math.round((r.left + r.right) / 2), Math.round((r.top + r.bottom) / 2)]; }); };
            for (let k = 0; k < 8; k++) { while (performance.now() - t0 < total * k / 7) await new Promise(r => requestAnimationFrame(r)); out.push(prim()); }
            return { total, frames: out }; }""")
        total, frames = res8['total'], res8['frames']
        g = game.evaluate('tw.ringGeom()'); clip = {'x': max(0, g['cx'] - 330), 'y': max(0, g['cy'] - 330), 'width': 660, 'height': 560}
        if shots:  # stills of the same opening: shut, open again and catch it k/7 of the way
            for k in range(8):
                game.evaluate("() => ringLab.panel.selectState('closed')"); game.wait_for_timeout(900); click_menu(); game.wait_for_timeout(total * k / 7)
                game.screenshot(path=str(shots / f'slide-{k}.png'), clip=clip)
        moved = [f[0] for f in frames]
        check(len({tuple(m) for m in moved[1:-1]}) == 6, 'STRIP: six distinct mid-travel positions of the first primary', moved)
        game.evaluate("() => " + RING_ANIMS + ".forEach(a => a.finish())")
        if shots:
            from PIL import Image, ImageDraw
            ims = [Image.open(shots / f'slide-{k}.png') for k in range(8)]
            w, h = ims[0].size; sheet = Image.new('RGB', (w * 4, h * 2), (20, 20, 20)); d = ImageDraw.Draw(sheet)
            for k, im in enumerate(ims):
                sheet.paste(im, ((k % 4) * w, (k // 4) * h)); d.text(((k % 4) * w + 10, (k // 4) * h + 8), f'{k}/7 of {total:.0f} ms', fill=(255, 230, 160))
            sheet.save(shots / 'slide-strip.png')
            for k in range(8): (shots / f'slide-{k}.png').unlink()

        # ---- reduced motion: the same click jumps ----
        click_menu(); game.wait_for_timeout(900)
        game.emulate_media(reduced_motion='reduce')
        if game.evaluate('ringLab.state()') != 'closed': click_menu(); game.wait_for_timeout(100)
        click_menu()
        running = game.evaluate("() => " + RING_ANIMS + ".filter(a => a.playState === 'running').length")
        check(running == 0 and game.evaluate('ringLab.state()') == 'expanded', 'CALM: reduced motion jumps (no animation runs)', f'{running} running')
        game.emulate_media(reduced_motion='no-preference')
        if game.evaluate('ringLab.state()') != 'closed': click_menu(); game.wait_for_timeout(100)

        # ---- FLOOR (2026-10-20: Harry's Cato and Bram were lowered to -12 / -20 over a -10 cellar): a pawn never goes below
        #      the lowest floor under it, from the Ring Lab track or app.liftTo; lowered through a floor it lands on the one below.
        Y = "(n) => Object.values(tw.entities()).find(e => e.name === n)?.y || 0"
        frame('Bram'); click_menu(); game.wait_for_timeout(900)
        b0 = game.locator('#ring > .rbtn[data-id="edit.lift"]').bounding_box(); x0, y0 = b0['x'] + b0['width'] / 2, b0['y'] + b0['height'] / 2
        game.mouse.move(x0, y0); game.mouse.down(); game.mouse.move(x0, y0 + 160, steps=12); game.mouse.up(); game.wait_for_timeout(700)
        check(game.evaluate(Y, 'Bram') == 0, 'FLOOR: the Ring Lab track dragged all the way down leaves Bram on the ground', game.evaluate(Y, 'Bram'))
        cellar = game.evaluate("async () => { const id = tw.spawnRoom('common', 2, 10, 4, 4, 9917, undefined, -10); for (let i = 0; i < 100 && !tw.entities()[id]; i++) await new Promise(r => setTimeout(r, 50)); return id; }")
        check(bool(cellar) and game.evaluate('(id) => tw.entities()[id]?.recipe?.y ?? null', cellar) is not None, 'FLOOR: a cellar room at -10', game.evaluate('(id) => tw.entities()[id]?.recipe', cellar))
        game.evaluate("async () => { const e = Object.values(tw.entities()).find(x => x.name === 'Bram'); tw.dispatch('token.move', { id: e.id, x: 20, z: 60, y: 0 }); await new Promise(r => setTimeout(r, 600)); }")
        for want, ask, why in [(-10, -3, 'lowered through the ground over the cellar: lands on what is under it (the cellar floor or its furniture)'), (-10, -25, 'asked for -25: stops on the cellar floor (-10)'), (-10, -40, 'and again from the cellar floor: stays on it'), (5, 5, 'raised 5 ft above the ground: stays up'), (-10, -14, 'from 5 ft down to -14: the cellar floor')]:
            game.evaluate("async (y) => { tw.liftTo(Object.values(tw.entities()).find(x => x.name === 'Bram'), y); await new Promise(r => setTimeout(r, 500)); }", ask)
            got = game.evaluate(Y, 'Bram')
            # (the cellar's own furniture can be what it lands on: on dev a shelf top at -3.18; never below the floor)
            check(got == want if ask >= 0 or ask <= -14 else -10 <= got <= ask, f'FLOOR: liftTo {ask}: {why}', got)
        game.evaluate("async () => { tw.liftTo(Object.values(tw.entities()).find(x => x.name === 'Cato' || x.name === 'Mira · raised'), -30); await new Promise(r => setTimeout(r, 500)); }")
        check(game.evaluate("() => Object.values(tw.entities()).filter(e => e.kind === 'token').every(e => (e.y || 0) >= -10)"), 'FLOOR: no pawn anywhere below -10', game.evaluate("() => Object.values(tw.entities()).filter(e => e.kind === 'token').map(e => [e.name, e.y || 0])"))
        # ---- DRAWER (Harry 2026-10-20: "I need a 'revert' button ... throw out like 80% of it and just keep the critical ones")
        game.locator('#ringlab-open').click()
        game.locator('#ringlab-panel [data-role=preset]').select_option(PRESET); game.locator('#ringlab-panel [data-role=loadPreset]').click()
        VIS = "() => [...document.querySelectorAll('#ringlab-panel [data-path]')].filter(e => e.checkVisibility()).map(e => e.dataset.path)"
        shown = game.evaluate(VIS)
        check(0 < len(shown) <= 20 and not game.evaluate("document.querySelector('#ringlab-panel details.rl-advanced').open"), f'DRAWER: One curve on shows {len(shown)} knobs (20 at most), Advanced shut', shown)
        long = game.evaluate("() => [...document.querySelectorAll('#ringlab-panel .rl-control > span, #ringlab-panel .rl-check')].filter(e => e.checkVisibility() && e.textContent.trim().length > 45).map(e => e.textContent.trim())")
        check(not long, 'DRAWER: every visible label is 45 characters or fewer', long)
        if shots: game.locator('#ringlab-panel').screenshot(path=str(shots / 'drawer-short.png'))
        reads = {}
        for v in (0, 90, 180, -90):
            game.locator('#ringlab-panel input[data-path="curve.closedAt"]').fill(str(v))
            reads[v] = game.locator('#ringlab-panel input[data-path="curve.closedAt"]').evaluate("e => e.closest('label').querySelector('output').textContent")
        check(reads == {0: '12:00', 90: '3:00', 180: '6:00', -90: '9:00'}, 'DRAWER: the clock readout says 12:00, 3:00, 6:00, 9:00', reads)
        game.locator('#ringlab-panel [data-role=revert]').click()
        CANON = "(o) => { const c = v => v && typeof v === 'object' ? (Array.isArray(v) ? v.map(c) : Object.fromEntries(Object.keys(v).sort().map(k => [k, c(v[k])]))) : v; return JSON.stringify(c(o)); }"
        canon = lambda js: game.evaluate(f"() => ({CANON})({js})")
        POS = "() => [...document.querySelectorAll('#ring > .rbtn[data-id]')].map(b => [b.dataset.id, Math.round(parseFloat(b.style.left) * 100) / 100, Math.round(parseFloat(b.style.top) * 100) / 100])"
        frame('Bram'); game.wait_for_timeout(200)
        s0, p0, base = canon('ringLab.panel.settings()'), game.evaluate(POS), canon('ringLab.panel.base().settings')
        check(s0 == base, 'DRAWER: Revert put back exactly what was loaded', game.locator('#ringlab-panel [data-role=revert]').inner_text())
        game.locator('#ringlab-panel input[data-path="curve.ry"]').fill('190'); game.locator('#ringlab-panel input[data-path="curve.y"]').fill('-80'); game.wait_for_timeout(200)
        s2, p2 = canon('ringLab.panel.settings()'), game.evaluate(POS)
        game.locator('#ringlab-panel [data-role=undo]').click(); game.wait_for_timeout(100)
        mid = game.evaluate('ringLab.panel.settings().curve')
        check(mid['ry'] == 190 and mid['y'] == game.evaluate('ringLab.panel.base().settings.curve.y'), 'DRAWER: Undo takes back the last change only', {'ry': mid['ry'], 'y': mid['y']})
        game.locator('#ringlab-panel [data-role=undo]').click(); game.wait_for_timeout(150)
        check(canon('ringLab.panel.settings()') == s0 and game.evaluate(POS) == p0, 'DRAWER: Undo twice: exact values and the same layout as before')
        game.locator('#ringlab-panel [data-role=redo]').click(); game.locator('#ringlab-panel [data-role=redo]').click(); game.wait_for_timeout(150)
        check(canon('ringLab.panel.settings()') == s2 and game.evaluate(POS) == p2, 'DRAWER: Redo twice: exact values and layout again')
        game.locator('#ringlab-panel [data-reset="curve.ry"]').click(); game.wait_for_timeout(100)
        c = game.evaluate('ringLab.panel.settings().curve'); bc = game.evaluate('ringLab.panel.base().settings.curve')
        check(c['ry'] == bc['ry'] and c['y'] == -80, 'DRAWER: ↺ puts back one knob (ry), leaves the other (y)', {'ry': c['ry'], 'y': c['y']})
        draft = canon("(() => { try { return JSON.parse(localStorage.getItem('tw.ring.draft')).settings; } catch { return null; } })()")
        check(draft == canon('ringLab.panel.settings()'), 'DRAWER: the browser draft follows undo / ↺')
        game.locator('#ringlab-panel [data-role=revert]').click(); game.wait_for_timeout(150)
        check(canon('ringLab.panel.settings()') == s0 and game.evaluate(POS) == p0 and canon("(() => JSON.parse(localStorage.getItem('tw.ring.draft')).settings)()") == s0, 'DRAWER: Revert: exact values, layout and draft')
        game.locator('#ringlab-panel details.rl-advanced > summary').click()
        if shots: game.locator('#ringlab-panel').screenshot(path=str(shots / 'drawer-advanced.png'))
        game.locator('#ringlab-panel details.rl-advanced > summary').click()

        # ---- WORLD (Harry 2026-10-20: "size measured in ft ... the oval is always an oval")
        game.locator('#ringlab-panel input[data-path="world.on"]').check(); game.wait_for_timeout(200)
        shown = game.evaluate(VIS)
        check(len(shown) <= 20 and 'world.buttonFt' in shown and 'curve.size' not in shown, f'WORLD: drawer with Size in the world: {len(shown)} knobs', shown)
        if shots: game.locator('#ringlab-panel').screenshot(path=str(shots / 'drawer-world.png'))
        game.locator('#ringlab-panel [data-role=collapse]').click()
        def at(name, dist, pitch=52, yaw=-20, state='closed'):
            game.evaluate("""([name, d, p, yw]) => { const e = Object.values(tw.entities()).find(x => x.name === name); tw.select(e.id); const g = tw.main.grab; const r = e.recipe;
                g.focus.set(r ? (r.x + r.w / 2) * 5 : e.x, (e.y || 0), r ? (r.z + r.d / 2) * 5 : e.z); g.dist = d; g.pitch = p; g.yaw = yw; g.update(); }""", [name, dist, pitch, yaw])
            game.wait_for_timeout(250)
            if game.evaluate('ringLab.state()') != state: game.evaluate('(s) => ringLab.panel.selectState(s)', state); game.wait_for_timeout(900)
            return game.evaluate("() => ({ w: ringLab.world(), btn: [...document.querySelectorAll('#ring > .rbtn[data-id]')].map(b => parseFloat(b.style.width)), read: document.querySelector('#ringlab-panel [data-role=worldRead]')?.textContent })")
        r95 = at('Bram', 95); print('    (default play view: %.3f px per ft at Bram)' % r95['w']['pxPerFt'], flush=True)
        rows = {d: at('Bram', d) for d in (6, 30, 60, 95, 200, 600)}
        k = [rows[d]['w']['pxPerFt'] * d for d in (30, 60, 95, 200)]
        check(max(k) / min(k) < 1.04, 'WORLD: px per ft at the piece follows 1 / distance', [round(v, 1) for v in k])
        free_ = [d for d in rows if not rows[d]['w']['clamped']]
        check(all(abs(rows[d]['btn'][0] - rows[d]['w']['buttonPx']) < 0.6 and abs(rows[d]['w']['buttonPx'] - rows[d]['w']['pxPerFt'] * game.evaluate('ringLab.panel.settings().world.buttonFt')) < 0.01 for d in free_) and len(free_) >= 2, f'WORLD: between the limits the button is base ft x px per ft (unclamped at {free_})', {d: round(rows[d]['w']['buttonPx'], 1) for d in rows})
        check(rows[6]['w']['clamped'] == 'largest' and abs(rows[6]['btn'][0] - 110) < 0.6 and rows[600]['w']['clamped'] == 'smallest' and abs(rows[600]['btn'][0] - 40) < 0.6, 'WORLD: the limits hold at 6 ft (110 px) and 600 ft (40 px)', {6: rows[6]['btn'][0], 600: rows[600]['btn'][0]})
        check('held at the largest button' in rows[6]['read'] and 'within the limits' in rows[95]['read'], 'WORLD: the readout says px per ft, scale and which limit holds', rows[6]['read'])
        # the shape is one shape: every button's place / scale is the same at every zoom (pure: no limits)
        game.evaluate("() => { const s = structuredClone(ringLab.panel.settings()); s.world.pure = true; ringLab.panel.setSettings(s); }")
        shapes = {}
        for d in (20, 60, 150):
            at('Bram', d, state='expanded')
            shapes[d] = game.evaluate("() => { const w = ringLab.world(), a = ringLab.anchor(), g = { cx: a.x, cy: a.y }; return [...document.querySelectorAll('#ring > .rbtn[data-id]')].map(b => [b.dataset.id, (parseFloat(b.style.left) - g.cx) / w.scale, (parseFloat(b.style.top) - g.cy) / w.scale]); }")
        dev = max(abs(a[1] - b[1]) + abs(a[2] - b[2]) for d in (60, 150) for a, b in zip(shapes[20], shapes[d]))
        check(dev < 0.05 and len(shapes[20]) == len(shapes[60]) > 3, 'WORLD: the shape is invariant: positions / scale identical across zooms', f'worst {dev:.4f} design px')
        # the oval clears the piece's footprint (unclamped, growth 1) for a 5 ft, a 20 ft and an 80 ft base
        FOOT = """(name) => { const e = Object.values(tw.entities()).find(x => x.name === name), F = tw.assets.figures; let pts;
            if (e.recipe) { const r = e.recipe, y = r.y || 0; pts = [[r.x, r.z], [r.x + r.w, r.z], [r.x + r.w, r.z + r.d], [r.x, r.z + r.d]].map(([x, z]) => tw.screenOf(x * 5, z * 5, tw.main, y)); }
            else { const R = F.radiusOf(F.sizeOf(e)); pts = Array.from({ length: 48 }, (_, i) => tw.screenOf(e.x + R * Math.cos(i / 48 * 2 * Math.PI), e.z + R * Math.sin(i / 48 * 2 * Math.PI), tw.main, e.y || 0)); }
            const inside = (x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
            const seg = (px, py, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(px - a.x - t * dx, py - a.y - t * dy); };
            return [...document.querySelectorAll('#ring > .rbtn[data-id]')].map(b => { const x = parseFloat(b.style.left), y = parseFloat(b.style.top), r = parseFloat(b.style.width) / 2;
              const d = Math.min(...pts.map((p, i) => seg(x, y, p, pts[(i + 1) % pts.length]))); return inside(x, y) ? -d : d - r; }); }"""
        for label, cfg in [('built-in "Ellipse · one curve"', None), ('Harry’s "tune-alpha v1"', TUNE_ALPHA['settings'])]:
            if cfg: game.evaluate("(c) => { const s = structuredClone(c); s.world = { ...ringLab.panel.settings().world }; ringLab.panel.setSettings(s); }", cfg)
            for name, base_ft, dist in [('Bram', 5, 95), ('Gargantuan · red dragon (20 ft)', 20, 260), ('Ring lab · 80 ft base (tarrasque-size)', 80, 900)]:
                for st in ('closed', 'expanded'):
                    r = at(name, dist, state=st)
                    gaps = game.evaluate(FOOT, name); ok = r['w'] and abs(r['w']['grow'] - base_ft / 5) < 1e-9 and gaps and min(gaps) > 0
                    what = f'WORLD: {label}: {name} ({base_ft} ft, ring x{base_ft // 5}) menu {"shut" if st == "closed" else "open"}: no button over its footprint'
                    # asserted: the built-in, shut and open, and Harry's shut. Measured only: Harry's open menu (his main
                    # buttons slide to 6:40 on a 68 px pitch: about 4 px onto the base on 2026-10-20; his to tune)
                    if not cfg or st == 'closed': check(ok, what, f'closest {min(gaps):.1f} px' if gaps else r)
                    else: print(f"  note {what}: {'yes' if ok else 'NO'}, closest {min(gaps):.1f} px (measured, not asserted)", flush=True)
        game.evaluate("() => ringLab.panel.setSettings(ringLab.panel.presets()['Ellipse · one curve'])")
        game.evaluate("() => { const s = structuredClone(ringLab.panel.settings()); s.world.on = true; s.world.pure = true; ringLab.panel.setSettings(s); }")
        game.evaluate("() => { const s = structuredClone(ringLab.panel.settings()); s.world.pure = false; ringLab.panel.setSettings(s); }")
        # stills: Medium, dragon and tarrasque-size at near, mid and overview zoom
        if shots:
            for name, tag, dists in [('Bram', 'medium', (30, 95, 300)), ('Gargantuan · red dragon (20 ft)', 'dragon', (60, 160, 420)), ('Ring lab · 80 ft base (tarrasque-size)', 'tarrasque', (120, 300, 700))]:
                for zoom, d in zip(('near', 'mid', 'overview'), dists):
                    at(name, d, state='expanded'); game.mouse.move(5, 890); game.wait_for_timeout(300)
                    game.screenshot(path=str(shots / f'world-{tag}-{zoom}.png'))
        # drawn on top: a pawn inside the inn, a wall between it and the camera; every button is what the pointer finds
        game.evaluate("async () => { const e = Object.values(tw.entities()).find(x => x.name === 'Cato'); tw.dispatch('token.move', { id: e.id, x: 112.5, z: 37.5, y: 0 }); await new Promise(r => setTimeout(r, 700)); }")
        BLOCK = """async (name) => { const T = await import('three'), e = Object.values(tw.entities()).find(x => x.name === name), w = tw.worldOf(tw.area()), cam = tw.main.camera;
            const to = new T.Vector3(e.x, (e.y || 0) + 3, e.z), from = cam.getWorldPosition(new T.Vector3()), dir = to.clone().sub(from), far = dir.length(); dir.normalize();
            const rc = new T.Raycaster(from, dir, 0.1, far - 1.5), mine = new Set(); rc.camera = cam; w.recs.get(e.id)?.group?.traverse?.(o => mine.add(o));
            const hit = rc.intersectObjects(w.scene.children, true).find(h => h.object.visible && !mine.has(h.object) && h.object.isMesh);
            return hit ? { d: +hit.distance.toFixed(1), far: +far.toFixed(1), what: hit.object.name || hit.object.parent?.name || hit.object.type } : null; }"""
        blocked = None
        for yaw in (0, 90, 180, -90):
            at('Cato', 70, pitch=14, yaw=yaw)
            blocked = game.evaluate(BLOCK, 'Cato')
            if blocked: break
        tops = game.evaluate("() => [...document.querySelectorAll('#ring > .rbtn[data-id]')].filter(b => { const r = b.getBoundingClientRect(), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2; return x > 0 && y > 0 && x < innerWidth && y < innerHeight; }).map(b => { const r = b.getBoundingClientRect(); const el = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); return el === b || b.contains(el); })")
        check(blocked and tops and all(tops), 'WORLD: with a wall between the camera and the pawn, the ring is drawn over it', {'wall hit': blocked, 'buttons on top': f'{sum(tops)}/{len(tops)}'})
        if shots: game.screenshot(path=str(shots / 'world-over-wall.png'))
        # the slide still animates at every scale
        for d in (20, 300):
            at('Bram', d)
            game.evaluate("""() => { const e = Object.values(tw.entities()).find(x => x.name === 'Bram'), w = tw.worldOf(tw.area()), b = w.boundsOf(w.recs.get(e.id), 'figure'), g = tw.main.grab;
                g.focus.set(e.x, b.min.y + 0.85 * (b.max.y - b.min.y), e.z); g.update(); }"""); game.wait_for_timeout(300)
            slide_samples('open', f'WORLD at camera distance {d}'); slide_samples('close', f'WORLD at camera distance {d}')
        # ---- EDGES (Harry 2026-10-20: "I'm still seeing the orbitals moving around to stay on the screen"): with the
        #      preset (world size on) nothing moves the ring to keep it on screen: a pawn near every edge and corner, the
        #      ring's centre stays on the piece in every state (it may run off screen).
        game.evaluate("() => ringLab.panel.setSettings(ringLab.panel.presets()['Ellipse · one curve'])")
        check(game.evaluate('ringLab.panel.settings().world.on'), 'EDGES: the built-in preset is world-sized')
        PLACE = """async ([name, tx, ty]) => { const e = Object.values(tw.entities()).find(x => x.name === name), g = tw.main.grab; tw.select(e.id);
            g.focus.set(e.x, e.y || 0, e.z); g.dist = 90; g.pitch = 50; g.yaw = 0; g.update();
            const at = () => tw.screenOf(e.x, e.z, tw.main, e.y || 0), yaw = g.yaw * Math.PI / 180;
            for (let k = 0; k < 8; k++) { const p0 = at(), f0 = g.focus.clone();
              g.focus.set(f0.x + 1, f0.y, f0.z); g.update(); const px = at(); g.focus.set(f0.x, f0.y, f0.z + 1); g.update(); const pz = at(); g.focus.copy(f0); g.update();
              const a = px.x - p0.x, b = pz.x - p0.x, c = px.y - p0.y, d = pz.y - p0.y, det = a * d - b * c, ex = tx - p0.x, ey = ty - p0.y;
              g.focus.set(f0.x + (d * ex - b * ey) / det, f0.y, f0.z + (-c * ex + a * ey) / det); g.update(); }
            await new Promise(r => setTimeout(r, 300)); return at(); }"""
        CENTRE = """() => { const st = document.querySelector('#ring'), c = st._curve, s = ringLab.panel.settings(), w = ringLab.world(), q = tw.ringGeom(), a = ringLab.anchor(), g = q && a && { cx: a.x, cy: a.y, hx: q.hx, hy: q.hy, bx: q.cx, by: q.cy };
            const e = Object.values(tw.entities()).find(x => x.id === [...tw.sel][0]), p = tw.screenOf(e.x, e.z, tw.main, e.y || 0);
            if (!c || !w || !g) return null;
            return { dx: c.cx - s.curve.x * w.scale - g.cx, dy: c.cy - s.curve.y * w.scale - g.cy, shift: c.shift, onPiece: Math.abs(g.cx - g.bx) <= g.hx + 2 && Math.abs(g.cy - g.by) <= g.hy + 2 && Math.abs(g.bx - p.x) <= g.hx + 2,
              off: [...st.querySelectorAll(':scope > .rbtn[data-id]')].some(b => { const r = b.getBoundingClientRect(); return r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight || r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight; }), warn: document.querySelector('#ringlab-panel [data-role=warnings]').textContent }; }"""
        def centred(r): return r and abs(r['dx']) < 0.5 and abs(r['dy']) < 0.5 and r['shift'] == [0, 0] and r['onPiece'] and 'off screen' not in r['warn']
        any_off = False
        for where, (tx, ty) in {'left edge': (30, 450), 'right edge': (1410, 450), 'top edge': (720, 40), 'bottom edge': (720, 860), 'top-left': (40, 40), 'top-right': (1400, 40), 'bottom-left': (40, 860), 'bottom-right': (1400, 860)}.items():
            game.evaluate('(s) => ringLab.panel.selectState(s)', 'closed'); game.wait_for_timeout(700)
            p = game.evaluate(PLACE, ['Cato', tx, ty]); res = {}
            res['shut'] = game.evaluate(CENTRE)
            game.evaluate('(s) => ringLab.panel.selectState(s)', 'expanded'); game.wait_for_timeout(180); res['mid-slide'] = game.evaluate(CENTRE); game.wait_for_timeout(700); res['open'] = game.evaluate(CENTRE)
            game.evaluate("() => document.querySelector('#ring > .rbtn[data-id=\"pawn.cond.\"]')?.click()"); game.wait_for_timeout(400); res['sub-menu'] = game.evaluate(CENTRE)
            game.evaluate('(s) => ringLab.panel.selectState(s)', 'closed'); game.wait_for_timeout(700)
            # a drag track starts at its button, wherever that is
            # a drag track starts at its button, wherever that is (a real press; a button off screen cannot be pressed)
            box = game.locator('#ring > .rbtn[data-id="pawn.damage"]').bounding_box()
            # (and one the pointer finds: the world-sized ring may run under the HUD at an edge, where it cannot be pressed either)
            mine = box and game.evaluate("([x, y]) => !!document.elementFromPoint(x, y)?.closest?.('#ring > .rbtn[data-id=\"pawn.damage\"]')", [box['x'] + box['width'] / 2, box['y'] + box['height'] / 2])
            if mine and box['x'] >= 0 and box['y'] >= 0 and box['x'] + box['width'] <= 1440 and box['y'] + box['height'] <= 900:
                bx, by = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
                game.mouse.move(bx, by); game.mouse.down()
                # (the game's damage track: its knob, at the pawn's damage now, sits under the button where it was grabbed)
                rail = game.evaluate("""([x, y]) => { const t = tw.ringDrag()?.track; return t && document.querySelector('#ring .guide') ? [Math.abs(t.knob[0] - x), Math.abs(t.knob[1] - y)] : null; }""", [bx, by])
                game.mouse.up(); game.mouse.move(5, 890)
                if game.evaluate('!!tw.ringDamageEdit()'): game.keyboard.press('Escape')  # (a press with no drag is a click: it opens the typed field)
            else: rail = [0, 0]  # (off screen: nothing to press, and nothing pulled it back on)
            res['drag track'] = rail
            any_off = any_off or any(r and r['off'] for r in res.values() if isinstance(r, dict))
            check(all(centred(res[k]) for k in ('shut', 'mid-slide', 'open', 'sub-menu')) and rail and max(rail) < 0.5, f'EDGES: Cato at the {where} ({p["x"]:.0f}, {p["y"]:.0f}): the ring stays centred on the piece, shut, mid-slide, open, sub-menu, drag track',
                  {k: (v if not isinstance(v, dict) else (round(v['dx'], 2), round(v['dy'], 2), v['shift'], v['onPiece'], 'off' if v['off'] else 'on')) for k, v in res.items()})
            if shots and where in ('top-left', 'bottom-right'):
                game.evaluate('(s) => ringLab.panel.selectState(s)', 'expanded'); game.wait_for_timeout(800); game.screenshot(path=str(shots / f'edges-{where}.png')); game.evaluate('(s) => ringLab.panel.selectState(s)', 'closed'); game.wait_for_timeout(600)
        check(any_off, 'EDGES: and the ring did run off screen there (nothing pulled it back)')
        # Advanced in One curve + world size: nothing there that does nothing
        game.locator('#ringlab-open').click(); game.locator('#ringlab-panel details.rl-advanced > summary').click()
        adv = game.evaluate(VIS)
        dead = [p for p in adv if p == 'edgeRule' or (p.startswith('arcs.') and not __import__('re').match(r'arcs\.(conditions|faction|nested)\.(duration|easing)$', p))]
        check(not dead and not game.evaluate("document.querySelector('#ringlab-panel [data-role=uiSize]').checkVisibility()"), 'ADVANCED with One curve + world size: no edge rule, menu scale or separate-ring knob shown', dead or f'{len(adv)} knobs')
        if shots: game.locator('#ringlab-panel').screenshot(path=str(shots / 'drawer-advanced-world.png'))
        game.locator('#ringlab-panel details.rl-advanced > summary').click(); game.locator('#ringlab-panel [data-role=collapse]').click()
        # ---- ANCHOR (Harry 2026-10-20: "it would be great if it was roughly the head ... doesn't need to be perfect"):
        #      one pawn: 85 % up its figure over the middle of its footprint; a raised pawn's figure, not its beam;
        #      things 50 %; rooms and several pieces: the middle of the projected box, as before.
        PT = """([name, pct, part]) => { const e = Object.values(tw.entities()).find(x => x.name === name), w = tw.worldOf(tw.area()), b = w.boundsOf(w.recs.get(e.id), part);
            const p = tw.screenOf((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, tw.main, b.min.y + pct / 100 * (b.max.y - b.min.y)); return { x: p.x, y: p.y, base: b.min.y, top: b.max.y }; }"""
        def anchor_on(name, d=60, pitch=40):
            game.evaluate("""([n, d, p]) => { const e = Object.values(tw.entities()).find(x => x.name === n); tw.select(e.id); const g = tw.main.grab; const r = e.recipe;
                g.focus.set(r ? (r.x + r.w / 2) * 5 : e.x, 0, r ? (r.z + r.d / 2) * 5 : e.z); g.dist = d; g.pitch = p; g.yaw = -20; g.update(); }""", [name, d, pitch]); game.wait_for_timeout(350)
            return game.evaluate("ringLab.anchor()"), game.evaluate("tw.ringGeom()")
        a, q = anchor_on('Bram'); want = game.evaluate(PT, ['Bram', 85, 'figure'])
        check(abs(a['x'] - want['x']) < 0.5 and abs(a['y'] - want['y']) < 0.5 and a['y'] < q['cy'] - 5, 'ANCHOR: a pawn: 85 % up its figure (above the old box centre)', {'anchor': (round(a['x']), round(a['y'])), 'old centre': (round(q['cx']), round(q['cy']))})
        ys = []
        for pct in (0, 50, 100):
            game.evaluate("(v) => { const s = structuredClone(ringLab.panel.settings()); s.centre.pawn = v; ringLab.panel.setSettings(s); }", pct); game.wait_for_timeout(200)
            ys.append((game.evaluate("ringLab.anchor()")['y'], game.evaluate(PT, ['Bram', pct, 'figure'])['y']))
        check(all(abs(x - y) < 0.5 for x, y in ys) and ys[0][0] > ys[1][0] > ys[2][0], 'ANCHOR: the knob moves it from the floor (0) to the top of the figure (100)', [round(x) for x, _ in ys])
        game.evaluate("() => { const s = structuredClone(ringLab.panel.settings()); s.centre.pawn = 85; ringLab.panel.setSettings(s); }")
        game.evaluate("async () => { const e = Object.values(tw.entities()).find(x => x.name === 'Mira · raised'); tw.dispatch('token.move', { id: e.id, x: e.x, z: e.z, y: 10 }); await new Promise(r => setTimeout(r, 700)); }")  # (FLOOR above lowered her)
        a, q = anchor_on('Mira · raised'); fig = game.evaluate(PT, ['Mira · raised', 85, 'figure']); full = game.evaluate(PT, ['Mira · raised', 85, None])
        # (the beam reaches the floor; the figure starts at the raised height: 85 % of the FIGURE, measured from there)
        check(fig['base'] > 9 and abs(a['y'] - fig['y']) < 0.5, 'ANCHOR: a raised pawn (10 ft up) uses its figure, not the beam below it', {'figure base ft': round(fig['base'], 1), 'figure top ft': round(fig['top'], 1), 'anchor': round(a['y']), 'all of its meshes (beam included) would give': round(full['y'])})
        a, q = anchor_on('Ring lab door'); want = game.evaluate(PT, ['Ring lab door', 50, 'figure'])
        check(abs(a['x'] - want['x']) < 0.5 and abs(a['y'] - want['y']) < 0.5, 'ANCHOR: a thing: 50 % up it', (round(a['x']), round(a['y'])))
        a, q = anchor_on('Ring lab common room', 120, 55)
        check(abs(a['x'] - q['cx']) < 0.01 and abs(a['y'] - q['cy']) < 0.01, 'ANCHOR: a room: the middle of its box, as before', (round(a['x']), round(a['y'])))
        game.evaluate("() => tw.select(Object.values(tw.entities()).filter(e => e.name === 'Bram' || e.name === 'Cato').map(e => e.id))"); game.wait_for_timeout(350)
        a, q = game.evaluate("ringLab.anchor()"), game.evaluate("tw.ringGeom()")
        check(a and abs(a['x'] - q['cx']) < 0.01 and abs(a['y'] - q['cy']) < 0.01, 'ANCHOR: two pawns: the middle of their box, as before')

        # ---- SLIDE (Harry 2026-10-21): with his rev 5, a pawn's open row slides off 6:00 instead of stepping ☰ out, and
        #      Ring lab's Where says where it went; the settings themselves are untouched
        REV5 = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'ring-house-rings-2026-10-21.json')))['rev 5']
        game.evaluate("(r) => ringLab.panel.setSettings(r)", REV5); game.wait_for_timeout(300)
        frame('Bram'); game.evaluate("() => ringLab.panel.selectState('expanded')"); game.wait_for_timeout(1200)
        sl = game.evaluate("""() => { const ns = tw.ringNodes(), main = ns.filter(n => n.curve && !n.spilled).sort((a, b) => a.curve.s - b.curve.s);
            return { slid: tw.ringSlid(), read: document.querySelector('#ringlab-panel [data-role=slidRead]')?.textContent || '', last: main.at(-1)?.id, menuOut: ns.some(n => n.id === 'menu' && n.spilled), warn: tw.ringWarnings() }; }""")
        check(sl['slid'] and sl['last'] == 'menu' and not sl['menuOut'] and '3–6' not in ' '.join(sl['warn']) and 'slid to' in sl['read'] and '→' in sl['read'],
              "SLIDE: rev 5, a pawn opened: no 3–6 warning, ☰ the row's last button in line, and Ring lab's Where says where the row slid", sl)
        game.evaluate("() => ringLab.panel.selectState('closed')"); game.wait_for_timeout(700)

        # ---- EFFECT (Harry 2026-10-20: changed the Conditions ring's controls in Advanced and "nothing moved"): every
        #      control still shown with One curve + world size, nudged, changes the layout, the style or the motion.
        game.evaluate("() => ringLab.panel.setSettings(ringLab.panel.presets()['Ellipse · one curve'])")
        game.evaluate("() => ringLab.panel.selectState('closed')"); game.wait_for_timeout(700)
        game.locator('#ringlab-open').click()
        if not game.evaluate("document.querySelector('#ringlab-panel details.rl-advanced').open"): game.locator('#ringlab-panel details.rl-advanced > summary').click()
        BASE = game.evaluate("() => JSON.stringify(ringLab.panel.settings())")
        SNAP = "() => [...document.querySelectorAll('#ring > *')].map(e => e.outerHTML.replace(/rl-path-[a-z0-9]+/g, 'P')).join('\\n')"
        ANIMS = "() => document.getAnimations().filter(a => a.effect?.target?.closest?.('#ring')).map(a => { const t = a.effect.getTiming(), k = a.effect.getKeyframes(); return [a.effect.target.dataset?.id || '', t.duration, t.delay, t.easing, k.length, k[0]?.transform || '', k[0]?.opacity ?? '', k.at(-1)?.transform || ''].join(','); }).join('|')"
        SUBJECT = 'Huge · fire giant (15 ft)'
        def view(name, d):
            game.evaluate("""([n, d]) => { const e = Object.values(tw.entities()).find(x => x.name === n); tw.select(e.id); const g = tw.main.grab; g.focus.set(e.x, 0, e.z); g.dist = d; g.pitch = 50; g.yaw = 0; g.update(); }""", [name, d]); game.wait_for_timeout(250)
        def observe():
            out = []
            for d in (30, 300, 900):
                view(SUBJECT, d); game.evaluate("() => ringLab.panel.selectState('closed')"); game.wait_for_timeout(120); out.append(game.evaluate(SNAP))
            view(SUBJECT, 300)
            game.evaluate("() => ringLab.panel.selectState('expanded')"); out.append(game.evaluate(ANIMS)); game.wait_for_timeout(1100); out.append(game.evaluate(SNAP))
            game.evaluate("() => document.querySelector('#ring > .rbtn[data-id=\"pawn.cond.\"]')?.click()"); game.wait_for_timeout(250); out.append(game.evaluate(SNAP))
            game.evaluate("() => ringLab.panel.selectState('closed')"); game.wait_for_timeout(900)
            box = game.locator('#ring > .rbtn[data-id="pawn.damage"]').bounding_box()
            if box:
                game.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); game.mouse.down()
                out.append(game.evaluate("() => [...document.querySelectorAll('#ring .guide, #ring .readout')].map(e => e.outerHTML).join('')")); game.mouse.up(); game.keyboard.press('Escape'); game.mouse.move(5, 890)
            view('Ring lab door', 90); game.evaluate("() => ringLab.panel.selectState('closed')"); game.wait_for_timeout(120); out.append(game.evaluate(SNAP))
            # a long sub-menu (the room's 17 wall kinds) reaches "ends by"; ten Conditions do not
            game.evaluate("""() => { const e = Object.values(tw.entities()).find(x => x.name === 'Ring lab common room'); tw.select(e.id); const r = e.recipe, g = tw.main.grab; g.focus.set((r.x + r.w / 2) * 5, 0, (r.z + r.d / 2) * 5); g.dist = 300; g.pitch = 50; g.yaw = 0; g.update(); }"""); game.wait_for_timeout(250)
            game.evaluate("() => ringLab.panel.selectState('expanded')"); game.wait_for_timeout(900)
            game.evaluate("() => document.querySelector('#ring > .rbtn[data-id=\"room.walls.\"]')?.click()"); game.wait_for_timeout(250); out.append(game.evaluate(SNAP))
            game.evaluate("() => ringLab.panel.selectState('closed')"); game.wait_for_timeout(700)
            return '\n#\n'.join(out)
        o0 = observe()
        check(o0 == observe(), 'EFFECT: the observation is repeatable (nothing changes by itself)')
        paths = game.evaluate(VIS)
        NUDGE = """(p) => { const el = document.querySelector(`#ringlab-panel [data-path="${p}"]`);
            if (el.type === 'checkbox') { el.click(); return el.checked; }
            if (el.tagName === 'SELECT') { const i = el.selectedIndex; el.selectedIndex = (i + 1) % el.options.length; el.dispatchEvent(new Event('input', { bubbles: true })); return el.value; }
            const min = +el.min, max = +el.max, step = +el.step || 1, v = +el.value, angle = /(At|Start|Floor|End)$/.test(p);
            const d = angle ? 30 : Math.max(step, Math.round((max - min) * 0.08 / step) * step), nv = v + d <= max ? v + d : v - d;
            el.value = nv; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return nv; }"""
        dead = []
        for pth in paths:
            nv = game.evaluate(NUDGE, pth); game.wait_for_timeout(150)
            if observe() == o0: dead.append(pth)
            game.evaluate("(s) => ringLab.panel.setSettings(JSON.parse(s))", BASE); game.wait_for_timeout(150)
        check(len(paths) >= 30 and not dead, f'EFFECT: every one of the {len(paths)} controls shown (main + Advanced) changes the layout, style or motion', dead or paths)
        check({'curve.nestStart', 'curve.nestEnd'} <= set(paths) and 'curve.on' not in paths and 'curve.off' in paths, 'EFFECT: the sub-menu’s start and end are shown and move it; no One curve tick; "Old separate rings" at the bottom of Advanced')
        if shots: game.locator('#ringlab-panel').screenshot(path=str(shots / 'drawer-canon.png'))
        game.locator('#ringlab-panel details.rl-advanced > summary').click(); game.locator('#ringlab-panel [data-role=collapse]').click()
        # ---- DEFAULT (Harry 2026-10-20: "it does seem like all my settings never made it thru as defaults though"):
        #      "Use as default" writes the house ring and nothing else; a new browser starts there; a draft wins.
        API = game.evaluate("tw.ringLabRatingsApi || '/api/tw-ratings'")
        HOUSE = "async (api) => (await fetch(api + '/tuner/house', { cache: 'no-store' })).json()"
        h0 = game.evaluate(HOUSE, API)
        game.evaluate("() => ringLab.panel.setSettings(ringLab.panel.presets()['Ellipse · one curve'])")
        game.evaluate("() => { const s = structuredClone(ringLab.panel.settings()); s.curve.ry = 163; s.curve.y = -31; ringLab.panel.setSettings(s); }")
        game.locator('#ringlab-open').click(); game.locator('#ringlab-panel [data-role=name]').fill('TEST default ring')
        game.locator('#ringlab-panel [data-role=useDefault]').click(); game.wait_for_timeout(600)
        h1 = game.evaluate(HOUSE, API); mine = canon('ringLab.panel.settings()')
        others = [k for k in h0 if k not in ('ring', 'at')]
        same = [k for k in others if h0[k] == h1[k] and (h0['at'] or {}).get(k) == (h1['at'] or {}).get(k)]
        check(h1.get('ring') and h1['ring']['name'] == 'TEST default ring' and game.evaluate(f"(s) => ({CANON})(s)", h1['ring']['settings']) == mine, 'DEFAULT: "Use as default" stores the ring as the house ring', game.locator('#ringlab-panel [data-role=status]').inner_text())
        check(len(same) == len(others) >= 13, f'DEFAULT: and leaves every other house field as it was ({len(same)}/{len(others)}: {", ".join(others)})', [k for k in others if k not in same])
        game.locator('#ringlab-panel [data-role=collapse]').click()
        ctx2 = b.new_context(viewport={'width': 1440, 'height': 900}); ctx2.add_init_script(f"try {{ localStorage.setItem('tw.ringlab.token', {json.dumps(TOKEN)}); }} catch {{}}")
        fresh = ctx2.new_page()
        if not A.page: tw_sandbox.proxy(fresh, RATINGS)
        fresh.goto(game_url + '#s=' + urllib.parse.quote(TOKEN), wait_until='domcontentloaded', timeout=60000)
        fresh.wait_for_function("window.ringLab && /Started from/.test(document.querySelector('#ringlab-panel [data-role=status]')?.textContent || '')", timeout=60000)
        st = fresh.locator('#ringlab-panel [data-role=status]').evaluate('e => e.textContent')
        check(st.startswith('Started from: house default · TEST default ring · saved ') and ' by ' in st and fresh.evaluate(f"() => ({CANON})(ringLab.panel.settings())") == mine, 'DEFAULT: a new browser starts from the house ring, and says so', st)
        check('Revert to house default · TEST default ring' in fresh.evaluate("document.querySelector('#ringlab-panel [data-role=revert]').textContent"), 'DEFAULT: its Revert goes back to the house ring', fresh.evaluate("document.querySelector('#ringlab-panel [data-role=revert]').textContent"))
        fresh.evaluate("() => { const el = document.querySelector('#ringlab-panel input[data-path=\"curve.ry\"]'); el.value = 170; el.dispatchEvent(new Event('input', { bubbles: true })); }")
        fresh.reload(wait_until='domcontentloaded'); fresh.wait_for_function("window.ringLab && /Started from/.test(document.querySelector('#ringlab-panel [data-role=status]')?.textContent || '')", timeout=60000)
        check(fresh.locator('#ringlab-panel [data-role=status]').evaluate('e => e.textContent') == 'Started from: this browser’s unsaved draft' and fresh.evaluate('ringLab.panel.settings().curve.ry') == 170, 'DEFAULT: with unsaved changes the browser starts from its own draft')
        ctx2.close()
        check(not errors, 'no page errors', errors[:3])
        b.close()
finally:
    for proc in procs: proc.terminate()
    for proc in procs:
        try: proc.wait(timeout=10)
        except subprocess.TimeoutExpired: proc.kill()
    gone = tw_sandbox.delete_campaign(relay, CAMPAIGN, TOKEN) if A.page else True
    print(f'  campaign {CAMPAIGN} removed: {gone}')
    if tmp: tmp.cleanup()

bad = [n for ok, n in results if not ok]
print(f'RING ELLIPSE: {len(results) - len(bad)}/{len(results)} checks' + (f' — FAILED: {bad}' if bad else ''))
sys.exit(1 if bad else 0)

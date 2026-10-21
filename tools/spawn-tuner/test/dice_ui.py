"""DICE in the Spawn Tuner (2026-10-19): the Dice panel, its test table, and stills Harry judges.
  DU1  panel: every knob of the schema with its readout, the built-in presets, the "Use in game" box, ten Roll buttons
  DU2  every Roll button (d4 … d100, 4d6, 2d20, the combo): the throw is simulated, played, and every die's top face
       (read off the VISUAL mesh, as a viewer sees it) is the roll's number
  DU3  a number tag over each settled die (one over a d100's pair)
  DU4  linger then fade: with linger 0.5 s / fade 0.3 s the dice leave the scene; with no dice out frame() does no work
  DU5  the shapes: every die type in the close-up; a d6 is 100-200 triangles; more rounding segments = more triangles
  DU6  cost: draw calls and frame time with dice in the air vs none (reported; dice add at most 2 draw calls a die)
  DU7  built-in presets load; "Use in game" stores house.dice in the test sandbox only
  DU8  no page errors
  DU11 THE VIEW'S MIDDLE, WHAT IS THERE (Harry 2026-10-19): with Harry's sent preset "dice-default", a furnished room
       built in the tuner, the camera pointed into it: every throw lands and settles inside that room's floor, at least
       one throw touches a prop's collider, every die reads its number, and the camera never moves
Stills in OUTDIR: dice-closeup-<type>.png (each die, close), dice-lineup.png, dice-4d6-strip.png (8 frames), dice-4d6-f*.png
Usage: python tools/spawn-tuner/test/dice_ui.py BASE_URL OUTDIR [API_ORIGIN]   (through tw-slot; GPU flags on)
  local: BASE_URL a static server of tools/spawn-tuner, API_ORIGIN http://127.0.0.1:8096 (or a private ratings server)
  dev:   BASE_URL https://implausible.enterprises/projects/turnip-works/tuner and NO API_ORIGIN: the page's own
         /api/tw-ratings (https://implausible.enterprises/api/tw-ratings) answers GET /sandbox, so DU7's Use-in-game POST
         goes to the sandbox. Passing API_ORIGIN with a dev BASE_URL, or a BASE_URL whose origin has no /api/tw-ratings,
         makes tw_sandbox block the POST ("does not honour the test sandbox") and DU7 fails.
"""
import json, os, sys, time
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests'))
import tw_sandbox  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

base = sys.argv[1].rstrip('/')
outdir = os.environ.get('DICE_OUT_DIR') or sys.argv[2]
api_origin = sys.argv[3] if len(sys.argv) > 3 else None
os.makedirs(outdir, exist_ok=True)
fails = 0
results = {}


def check(name, ok, ev=''):
    global fails
    results[name] = bool(ok)
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{ev}]' if ev else ''), flush=True)
    if not ok:
        fails += 1


ARGS = ['--no-sandbox'] + (['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else [])
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1500, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
    pg.on('console', lambda m: errs.append(f'console: {m.text[:160]}') if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('response', lambda r: errs.append(f'{r.status} {r.url[:140]}') if r.status >= 400 and '/api/' not in r.url and 'favicon' not in r.url and 'delivery.json' not in r.url else None)  # (delivery.json: written by deploy.sh, absent in a plain checkout)
    if api_origin:
        tw_sandbox.proxy(pg, api_origin)
    pg.goto(base + '/index.html?nobg&seed=4242&atmos=clear')
    pg.wait_for_function('window.fx && window.fx.diceTools', timeout=90000)
    ev = pg.evaluate
    ev("document.querySelector('details[data-key=dice]').open = true; document.querySelector('#fx-prof-day')?.click()")
    pg.add_style_tag(content='#hud,.hint{display:none!important}')

    # DU1 (the Load list's built-ins come with the sent presets' fetch: wait for it)
    pg.wait_for_function("[...document.querySelectorAll('#fx-dice-load option')].some(o => o.value.startsWith('builtin:'))", timeout=20000)
    knobs = ev("(() => { const want = []; for (const g of ['look','throw','physics','reject','timing','tag']) for (const k of Object.keys(fx.params('dice')[g])) want.push('dice.' + g + '.' + k); const have = [...document.querySelectorAll('#fx-dice [data-path]')].map(e => e.dataset.path); return { want, have, missing: want.filter(w => !have.includes(w)), readouts: document.querySelectorAll('#fx-dice label.dial output').length }; })()")
    presets = ev("[...document.querySelectorAll('#fx-dice-load option')].map(o => o.value).filter(v => v.startsWith('builtin:'))")
    rolls = ev("[...document.querySelectorAll('#fx-dice button[data-roll]')].map(b => b.dataset.roll)")
    check('DU1 panel: every knob, presets, Use in game, ten Roll buttons', not knobs['missing'] and len(knobs['have']) >= 24 and len(presets) >= 4 and pg.locator('.houseBox[data-house=dice]').count() == 1 and len(rolls) == 10,
          f"knobs {len(knobs['have'])} (missing {knobs['missing']}), readouts {knobs['readouts']}, presets {len(presets)}, rolls {len(rolls)}")

    # DU2 + DU3: every Roll button, read off the visual mesh
    bad, n, tags_bad, sims = [], 0, [], []
    for r in rolls:
        ev("fx.dice.clear()")
        pg.click(f'#fx-dice button[data-roll="{r}"]')
        pg.wait_for_function("fx.dice.info().length === 1 && fx.dice.info()[0].settled", timeout=20000)
        info = ev("fx.dice.info()[0]")
        n += len(info['dice'])
        for d, v in zip(info['dice'], info['values']):
            if d['reads'] != v:
                bad.append((r, d['type'], d['reads'], v))
        want_tags = len(info['dice']) - sum(1 for d in info['dice'] if d['type'] == 'd10t')
        got_tags = ev("(() => { let n = 0; fx.dice.root.traverse(o => { if (o.userData.diceTag) n++; }); return n; })()")
        if got_tags != want_tags:
            tags_bad.append((r, got_tags, want_tags))
        sims.append(ev("fx.dice.stats().dice_last"))
    check('DU2 every Roll button: every die reads its number on top (visual mesh)', not bad and n >= 22, f'{n - len(bad)}/{n} {bad[:3]}')
    check('DU3 a number tag over each settled die (one per d100 pair)', not tags_bad, str(tags_bad[:3]))
    print('     sims:', json.dumps([{k: s[k] for k in ('tries', 'ms', 'settleAt', 'bytes')} for s in sims]))

    # DU6 cost: draw calls / frame time, dice in the air vs none
    ev("fx.dice.clear(); fx.diceTools.cam('pawn')"); pg.wait_for_timeout(600)
    idle = ev("new Promise(r => { const t = []; let l = performance.now(); const f = (n) => { t.push(n - l); l = n; if (t.length < 40) requestAnimationFrame(f); else r({ ms: t.slice(5).reduce((a, b) => a + b) / 35, calls: fx.stats().frame_draw_calls, frames: fx.dice.stats().dice_frames }); }; requestAnimationFrame(f); })")
    pg.wait_for_timeout(300)
    idle2 = ev("fx.dice.stats().dice_frames")
    ev("fx.setParams('dice', (() => { const p = fx.params('dice'); p.throw.timeScale = 0.3; return p; })())")
    ev("fx.diceTools.roll('4d6')")
    pg.wait_for_function("fx.dice.info().length === 1", timeout=20000)
    busy = ev("new Promise(r => { const t = []; let l = performance.now(); const f = (n) => { t.push(n - l); l = n; if (t.length < 40) requestAnimationFrame(f); else r({ ms: t.slice(5).reduce((a, b) => a + b) / 35, calls: fx.stats().frame_draw_calls, tris: fx.dice.stats().dice_tris }); }; requestAnimationFrame(f); })")
    check('DU6 cost: dice add at most 2 draw calls a die; none out = no dice work', busy['calls'] - idle['calls'] <= 2 * 4 + 4 and idle2 == idle['frames'],
          f"idle {idle['calls']} calls {idle['ms']:.1f} ms/frame; 4d6 in the air {busy['calls']} calls {busy['ms']:.1f} ms/frame, {busy['tris']} triangles; dice frames while none out: {idle['frames']} -> {idle2}")
    results['cost'] = {'idle': idle, 'busy': busy}

    # DU4 linger then fade
    ev("fx.dice.clear(); fx.setParams('dice', (() => { const p = fx.params('dice'); p.throw.timeScale = 1; p.timing.linger = 0.5; p.timing.fade = 0.3; return p; })())")
    ev("fx.diceTools.roll('2d20')")
    pg.wait_for_function("fx.dice.info().length === 1 && fx.dice.info()[0].settled", timeout=20000)
    t0 = time.time()
    gone = True
    try:
        pg.wait_for_function("fx.dice.active() === 0 && fx.dice.root.children.length === 0", timeout=4000)
    except Exception:
        gone = False
    check('DU4 linger then fade: the dice leave the scene', gone, f'{time.time() - t0:.2f} s after settling')
    ev("fx.setParams('dice', fx.params('dice').name ? Object.assign(fx.params('dice'), { timing: { result: 'settle', linger: 6, fade: 1.2 } }) : fx.params('dice'))")
    ev("document.querySelector('#fx-dice-load').value = ''")
    pg.select_option('#fx-dice-load', 'builtin:dice-default')

    # DU5 shapes + close-up stills
    lu = ev("fx.diceTools.lineup(false)")
    pg.wait_for_timeout(1200)
    pg.locator('#stage').screenshot(path=os.path.join(outdir, 'dice-lineup.png'))
    types = ['d4', 'd6', 'd8', 'd10t', 'd10', 'd12', 'd20']
    for i, t in enumerate(types):
        ev(f"fx.diceTools.cam({i})"); pg.wait_for_timeout(700)
        pg.locator('#stage').screenshot(path=os.path.join(outdir, f"dice-closeup-{'d100-tens' if t == 'd10t' else t}.png"))
    tris = lu['tris']
    seg3 = ev("(() => { const p = fx.params('dice'); p.look.segments = 3; fx.setParams('dice', p); const t = fx.diceTools.lineup(false).tris.d6; p.look.segments = 2; fx.setParams('dice', p); return t; })()")
    check('DU5 every die type in the close-up; a d6 is 100-200 triangles; segments add triangles', len(tris) == 7 and 100 <= tris['d6'] <= 200 and seg3 > tris['d6'], f'{tris}, d6 at segments 3: {seg3}')
    ims = [Image.open(os.path.join(outdir, f"dice-closeup-{'d100-tens' if t == 'd10t' else t}.png")) for t in types]
    w, h = ims[0].size; s = 0.5
    sheet = Image.new('RGB', (int(w * s) * 4, int(h * s) * 2), 'black')
    for i, im in enumerate(ims):
        sheet.paste(im.resize((int(w * s), int(h * s))), ((i % 4) * int(w * s), (i // 4) * int(h * s)))
    sheet.save(os.path.join(outdir, 'dice-closeups.png'))

    # the 4d6 strip (8 frames from the throw to rest, the camera behind the pawn)
    ev("fx.dice.clear(); fx.diceTools.cam('pawn')"); pg.wait_for_timeout(500)
    r = ev("fx.diceTools.roll('4d6').then(r => r.id)")
    dur = ev(f"fx.dice.duration('{r}')")
    frames = []
    for k in range(8):
        ev(f"fx.dice.seek('{r}', {dur * k / 7})"); pg.wait_for_timeout(250)
        f = os.path.join(outdir, f'dice-4d6-f{k}.png'); pg.locator('#stage').screenshot(path=f); frames.append(f)
    ims = [Image.open(f) for f in frames]; w, h = ims[0].size; s = 0.42
    strip = Image.new('RGB', (int(w * s) * 4, int(h * s) * 2))
    for i, im in enumerate(ims):
        strip.paste(im.resize((int(w * s), int(h * s))), ((i % 4) * int(w * s), (i // 4) * int(h * s)))
    strip.save(os.path.join(outdir, 'dice-4d6-strip.png'))

    # DU11 throws at the middle of the view, against the room that is there (Harry's sent "dice-default")
    HARRY = {'look': {'size': 2, 'round': 0.3, 'segments': 3, 'colorMode': 'seat', 'color': '#262c94', 'numberColor': '#ff1719', 'edgeWear': 0.4, 'paint': 'gilded'},
             'throw': {'height': 14.2, 'angle': 44, 'strength': 10.7, 'scatter': 0.35, 'spin': 26, 'realMM': 53, 'timeScale': 0.3},
             'physics': {'bounce': 0.85, 'tableBounce': 1.05, 'friction': 0.6, 'damping': 0.5, 'angDamping': 1.5},
             'reject': {'tries': 15, 'cocked': 3, 'reach': 17, 'settle': 5.2}, 'timing': {'result': 'settle', 'linger': 6, 'fade': 2.2}, 'tag': {'style': 'pill', 'size': 0.85, 'delay': 0.6, 'fadeIn': 0.5}}
    ev(f"fx.setParams('dice', {{ ...fx.params('dice'), ...{json.dumps(HARRY)}, name: 'dice-default' }})")
    ev("fx.dice.clear()")
    ev("tuner.createRoom('common', 30, -14, 6, 5)")
    pg.wait_for_function("(() => { const r = tuner.rooms().find(r => r.x === 30 && r.z === -14); return r && r.n > 6; })()", timeout=60000)
    pg.wait_for_timeout(4000)
    ev("(() => { const c = tuner.cam; c.focus.set(165, 0, -57.5); c.dist = 48; c.pitch = 55; c.yaw = 15; c.update(); })()")
    pg.wait_for_timeout(800)
    cam0 = ev("[tuner.cam.focus.x, tuner.cam.focus.z, tuner.cam.dist, tuner.cam.yaw, tuner.cam.pitch, tuner.cam.camera.position.x, tuner.cam.camera.position.z]")
    R0 = {'x0': 150, 'z0': -70, 'x1': 180, 'z1': -45}
    outs, touched, reads_bad, n10, props = [], 0, [], 0, []
    for k in range(6):
        r = ev("fx.diceTools.roll('4d6+d20').then(r => ({ id: r.id, room: r.room, colliders: r.colliders, touched: r.touched, values: r.values }))")
        props.append(r['colliders']['props'])
        pg.wait_for_function(f"(() => {{ const t = fx.dice.info().find(t => t.id === '{r['id']}'); return t && t.settled; }})()", timeout=30000)
        t = ev(f"fx.dice.info().find(t => t.id === '{r['id']}')")
        for d, v in zip(t['dice'], t['values']):
            n10 += 1
            if d['reads'] != v: reads_bad.append((d['type'], d['reads'], v))
            x, z = d['p'][0], d['p'][2]
            if not (R0['x0'] < x < R0['x1'] and R0['z0'] < z < R0['z1']): outs.append((round(x, 1), round(z, 1)))
        touched += 1 if r['touched'] else 0
        if k == 2: pg.locator('#stage').screenshot(path=os.path.join(outdir, 'dice-room-throw.png'))
    cam1 = ev("[tuner.cam.focus.x, tuner.cam.focus.z, tuner.cam.dist, tuner.cam.yaw, tuner.cam.pitch, tuner.cam.camera.position.x, tuner.cam.camera.position.z]")
    check('DU11 throws at the view\'s middle settle inside the room built there, touch its props, read true; the camera never moves',
          not outs and touched >= 1 and not reads_bad and n10 == 30 and min(props) > 3 and cam0 == cam1,
          f"dice {n10}, outside the room {outs[:4]}, throws touching a prop {touched}/6, props as colliders {props}, misreads {reads_bad[:3]}, camera still {cam0 == cam1}")
    ev("fx.dice.clear()")
    pg.select_option('#fx-dice-load', 'builtin:dice-default')

    # DU7 presets + Use in game (sandboxed)
    pg.select_option('#fx-dice-load', 'builtin:dice-ivory')
    ok_load = ev("fx.params('dice').name") == 'dice-ivory' and ev("fx.params('dice').look.colorMode") == 'fixed'
    pg.select_option('#fx-dice-load', 'builtin:dice-default')
    pg.fill('#fx-dice-name', 'test-dice-house')
    pg.click('#fx-dice-house')
    house_ok = False
    try:
        pg.wait_for_function("!document.querySelector('#toast').hidden && /GAME now uses/.test(document.querySelector('#toast').textContent)", timeout=15000)
        h_sand = ev("fetch((new URLSearchParams(location.search).get('api') || '/api/tw-ratings') + '/tuner/house', { cache: 'no-store' }).then(r => r.json())")
        house_ok = (h_sand.get('dice') or {}).get('name') == 'dice-test-dice-house'
    except Exception as e:
        h_sand = {'error': str(e)[:120]}
    check('DU7 built-in presets load; "Use in game" stores house.dice (test sandbox only)', ok_load and house_ok, f"house.dice.name={(h_sand.get('dice') or {}).get('name')}")
    # DU9 the REAL sliders (Harry 2026-10-19: "round.toFixed is not a function" after playing with the dials: the
    # dials handed back text); the new knobs: height, angle, speed, bounce, and the tag's delay + fade-in
    ev("fx.dice.clear()")
    for path, v in [('look.round', '0.22'), ('look.size', '1.6'), ('throw.height', '6'), ('throw.angle', '45'), ('throw.strength', '30'), ('throw.scatter', '0.6'), ('physics.bounce', '0.6'), ('physics.tableBounce', '1'), ('tag.delay', '0.8'), ('tag.fadeIn', '0.6'), ('throw.timeScale', '1')]:
        ev(f"(() => {{ const e = document.querySelector('#fx-dice [data-path=\"dice.{path}\"]'); e.value = '{v}'; e.dispatchEvent(new Event('input', {{ bubbles: true }})); }})()")  # (as a drag does; the dial may sit in a closed group)
    kinds = ev("(() => { const p = fx.params('dice'); return [p.look.round, p.look.size, p.throw.height, p.throw.angle, p.physics.bounce, p.tag.delay].map(v => typeof v); })()")
    pg.click('#fx-dice button[data-roll="4d6"]')
    pg.wait_for_function("fx.dice.info().length === 1 && fx.dice.info()[0].settled", timeout=20000)
    tag_n = lambda: ev("(() => { const o = []; fx.dice.root.traverse(s => { if (s.userData.diceTag) o.push(+s.material.opacity.toFixed(2)); }); return o; })()")
    at_settle = tag_n(); pg.wait_for_timeout(1100); mid = tag_n(); pg.wait_for_timeout(700); late = tag_n()
    info = ev("fx.dice.info()[0]")
    check('DU9 real sliders give numbers; a throw after moving them rolls and reads true; the tag waits, then fades in',
          set(kinds) == {'number'} and all(d['reads'] == v for d, v in zip(info['dice'], info['values'])) and not at_settle and mid and all(0 < o < 1 for o in mid) and late and all(o == 1 for o in late),
          f'types {kinds}; tags at settle {at_settle}, +1.1 s {mid}, +1.8 s {late}; reads {[d["reads"] for d in info["dice"]]} vs {info["values"]}')
    pg.select_option('#fx-dice-load', 'builtin:dice-default')
    # DU10 (Harry 2026-10-19: "the number-color is not coming thru"): gilded paint once forced gold numbers; the
    # number colour now wins in every paint style. And the eased playback through the real sliders: a slow start
    # and end make the same throw take longer to play
    for path, v in [('look.paint', 'gilded'), ('look.numberColor', '#ff1719')]:
        ev(f"(() => {{ const e = document.querySelector('#fx-dice [data-path=\"dice.{path}\"]'); e.value = '{v}'; e.dispatchEvent(new Event('input', {{ bubbles: true }})); e.dispatchEvent(new Event('change', {{ bubbles: true }})); }})()")
    ev("fx.diceTools.lineup(false)"); pg.wait_for_timeout(500)
    ink = ev("""(() => { let red = 0, gold = 0; const seen = new Set(); fx.dice.root.traverse(o => { const im = o.material?.map?.image; if (!o.isMesh || !(im instanceof HTMLCanvasElement) || seen.has(im) || !o.material.transparent) return; seen.add(im);
      const d = im.getContext('2d').getImageData(0, 0, im.width, im.height).data; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; const [r, g, b] = [d[i], d[i + 1], d[i + 2]]; if (r > 200 && g < 70 && b < 70) red++; if (r > 200 && g > 170 && b < 150) gold++; } }); return { red, gold, atlases: seen.size }; })()""")
    ev("fx.dice.clear()")
    durs = {}
    for name, vals in [('plain', [('throw.startSpeed', '1'), ('throw.easeIn', '0'), ('throw.endSpeed', '1'), ('throw.easeOut', '0')]), ('eased', [('throw.startSpeed', '0.3'), ('throw.easeIn', '0.8'), ('throw.endSpeed', '0.3'), ('throw.easeOut', '0.8')])]:
        for path, v in vals + [('throw.timeScale', '1')]:
            ev(f"(() => {{ const e = document.querySelector('#fx-dice [data-path=\"dice.{path}\"]'); e.value = '{v}'; e.dispatchEvent(new Event('input', {{ bubbles: true }})); }})()")
        ev("fx.dice.clear()")
        r = ev("fx.diceTools.roll('d20').then(r => r.id)")
        durs[name] = ev(f"[fx.dice.duration('{r}'), fx.dice.stats().dice_last.settleAt, fx.dice.info()[0].values[0]]")  # (playback s; the throw's own s; the number)
        pg.wait_for_function(f"fx.dice.settled('{r}')", timeout=20000)
        durs[name].append(ev(f"fx.dice.info()[0].dice[0].reads"))
    check('DU10 gilded dice wear the number colour; eased playback takes longer and still reads true',
          ink['red'] > 200 and ink['gold'] < ink['red'] / 10 and abs(durs['plain'][0] - durs['plain'][1]) < 0.1 and durs['eased'][0] > durs['eased'][1] + 0.8 and durs['eased'][3] == durs['eased'][2] and durs['plain'][3] == durs['plain'][2],
          f"ink {ink}; (playback s, throw s, number, reads) {durs}")
    pg.select_option('#fx-dice-load', 'builtin:dice-default')
    check('DU8 no page errors', not errs, '; '.join(errs[:3]))
    b.close()

json.dump({'results': results, 'fails': fails}, open(os.path.join(outdir, 'dice_ui.json'), 'w'), indent=1)
print(f"\n{sum(1 for k, v in results.items() if v is True)} passed, {fails} failed")
sys.exit(1 if fails else 0)

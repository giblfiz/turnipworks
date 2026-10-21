"""Fog-of-war LOOK in the Spawn Tuner: acceptance, secrecy invariants, stills (2026-10-16 Gemini 4; rewritten 2026-10-17).
The test scene (Fog of war look panel): remembered WEST room (veil), viewer pawn in the MIDDLE room (in sight), never-seen
EAST room behind a door, holding a magenta/cyan beacon, a crimson pawn and a baffle wall that are drawn on purpose (the
game would not draw them: they prove the shader's secrecy floor on its own).
  FW1  panel: every knob, defaults (9 ft bank and veil, 6.5 ft spill, no cap, blue-white glow, 2.5 ft checker at 0.2)
  FW2  vision feeds the war fog: heavy bank over never-seen, thin veil over remembered, clear in sight
  FW3  spill: rolls into seen ground only through openings (none through a closed wall); the cap slider caps it
  FW4  bubble and roll: the bank's top moves with nobody touching it, and follows the rise slider
  FW5  glow tints the bank; a burning fire in a never-seen room adds NO light to the fog
  FW6  SECRECY, in-frame A/B: drawing or not drawing the beacon / crimson pawn / baffle wall changes 0 pixels, from high,
       3/4 and low cameras, on Plain (Lighting FX off) / Low (fog & mist off) / Medium / High, while a real cursor stirs
       the bank over them; and no beacon/pawn colour in any screenshot. Positive control: once revealed, the same A/B
       and colour count DO see the beacon from each camera (so the method can see it)
  FW7  a real cursor waved over the bank stirs it and clears it toward the checker, still with 0 secret pixels
  FW8  opening the door rolls the bank back from what comes into sight; closing it leaves a veil, not the bank
  FW9  no shader compiles when the fog state changes (door, pawn moves, memory reset)
  FW10 built-in presets load; "Use in game" stores house.fogwar in the test sandbox only
  FW11 no page errors
  FW14 the dark preview (Darkness ▸ Light reach): 8 lights round a pawn in a dark field; the lamp slider and Count dim light move its disc
Stills in OUTDIR: fogwar-1-bank-above, -2-bank-low, -3-door-spill, -4-explored-veil, -5-checker-low, -6-cursor-wave, -14a-dark-preview, -14b-dark-lamp-20.
Usage: python tools/spawn-tuner/test/fogwar_ui.py BASE_URL OUTDIR [API_ORIGIN]   (through tw-slot; GPU flags on)
"""
import io, json, os, sys, time
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests'))
import tw_sandbox  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

base = sys.argv[1].rstrip('/')
outdir = os.environ.get('FOGWAR_OUT_DIR') or sys.argv[2]
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


def grab(pg, clip):
    return np.asarray(Image.open(io.BytesIO(pg.screenshot(clip=clip))).convert('RGB')).astype(np.int16)


def diff(a, b):
    return float((np.abs(a - b).max(axis=2) > 12).mean())


def secret_px(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    magenta = (r > 170) & (g < 90) & (b > 170)
    cyan = (r < 90) & (g > 170) & (b > 150)
    return int(magenta.sum() + cyan.sum())


# in-frame A/B: render twice in one task with the object drawn / not drawn and count the pixels that differ
AB = """(names) => { const o = fx.fogwarTools.testObjects(), cv = document.querySelector('#stage canvas'), gl = cv.getContext('webgl2');
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, shot = () => { fx.render(0); const a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
  const out = {}; for (const n of names) { const m = o[n], was = m.visible; m.visible = true; const A = shot(); m.visible = false; const B = shot(); m.visible = was;
    let d = 0, mx = 0; for (let i = 0; i < A.length; i += 4) { const e = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (e > 2) d++; if (e > mx) mx = e; }
    out[n] = { px: d, max: mx }; } return out; }"""

with sync_playwright() as p:
    ARGS = ['--no-sandbox'] + (['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else [])
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: (errs.append(str(e)), print('PAGEERROR:', e, flush=True)))
    if api_origin:
        tw_sandbox.proxy(pg, api_origin)
    pg.add_init_script("try { for (const k of Object.keys(localStorage)) if (k.startsWith('tuner.fx.fogwar')) localStorage.removeItem(k); } catch (e) {}")
    pg.goto(base + '/index.html?nobg&seed=4242')
    pg.wait_for_selector('body[data-ready="1"]', timeout=90000)
    pg.wait_for_function('!!window.fx && !!fx.fogwar && !!fx.fogwarTools', timeout=60000)
    ev = lambda js: pg.evaluate(js)
    setfw = lambda js: ev(f"(() => {{ const p = fx.params('fogwar'); {js}; fx.setParams('fogwar', p); }})()")

    # FW1 panel
    ev("document.querySelector('details.major[data-key=\"fogwar\"]').open = true")
    keys = ev("[...document.querySelectorAll('#fx-fogwar-dials [data-k], #fx-fogwar-dials input, #fx-fogwar-dials select')].length")
    presets = pg.locator('#fx-fogwar-load option').count()
    fp = ev("fx.params('fogwar')")
    want = {'bank.height': 9, 'veil.height': 9, 'spill.reach': 6.5, 'spill.cap': 0, 'glow.color': '#b8d8ff', 'base.checkerSize': 2.5, 'base.checkerContrast': 0.2, 'base.style': 'checker'}
    got = {k: fp[k.split('.')[0]][k.split('.')[1]] for k in want}
    knobs = ['bank.height', 'bank.density', 'bank.color', 'veil.height', 'veil.density', 'spill.push', 'spill.curl', 'spill.reach', 'spill.speed', 'spill.cap',
             'roll.back', 'roll.pour', 'roll.linger', 'roll.lip', 'bubble.rate', 'bubble.size', 'bubble.rise', 'glow.color', 'glow.strength', 'base.checkerSize', 'base.checkerContrast', 'edge.feather']
    have = [k for k in knobs if k.split('.')[1] in fp.get(k.split('.')[0], {})]
    check('FW1 panel: every knob, built-in presets and the agreed defaults', keys >= 18 and presets >= 5 and got == want and len(have) == len(knobs) and pg.locator('.houseBox[data-house=fogwar]').count() == 1,
          f'{keys} dials, {presets} options, defaults {got}, knobs {len(have)}/{len(knobs)}')

    # the scene
    pg.click('#fx-fogwar-scene')
    pg.wait_for_function('fx.fogwarTools.isReady() && tuner.episodes() === 0', timeout=180000)
    ev("tuner.hideLabels(true)")
    ev("fx.atmos.warm(150)")
    time.sleep(1.0)
    stage = ev("(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()")
    span = ev("fx.fogwarTools.doorSpan()")
    dz = (span[0] + span[1]) / 2

    # FW2
    hv = ev("fx.atmos.probe('heavy', [[120, 222.5], [140, 222.5], [160, 222.5], [166, 230]])")
    vl = ev("fx.atmos.probe('veil', [[120, 222.5], [116, 218], [140, 222.5], [160, 222.5]])")
    check('FW2 vision feeds the war fog: bank over never-seen, veil over remembered, clear in sight',
          hv[2] > 0.45 and hv[3] > 0.45 and hv[1] < 0.05 and hv[0] < 0.05 and vl[0] > 0.3 and vl[1] > 0.3 and vl[2] < 0.05 and vl[3] < 0.05,
          f'heavy W,M,E,E2={[round(x, 2) for x in hv]} veil W,W2,M,E={[round(x, 2) for x in vl]}')

    ev("fx.fogwarTools.setCameraView('high')"); ev("fx.atmos.warm(30)"); time.sleep(0.8)
    pg.screenshot(path=f'{outdir}/fogwar-1-bank-above.png', clip=stage)
    ev("fx.fogwarTools.setCameraView('veil')"); ev("fx.atmos.warm(30)"); time.sleep(0.8)
    pg.screenshot(path=f'{outdir}/fogwar-4-explored-veil.png', clip=stage)
    ev("fx.fogwarTools.setCameraView('low')"); ev("fx.atmos.warm(30)"); time.sleep(0.8)
    pg.screenshot(path=f'{outdir}/fogwar-2-bank-low.png', clip=stage)

    # FW4 bubble and roll (nobody touches anything)
    ev("fx.fogwarTools.setCameraView('high')"); ev("fx.atmos.warm(10)"); time.sleep(0.5)
    f0 = grab(pg, stage); time.sleep(0.8); f1 = grab(pg, stage)
    setfw("p.bubble.rise = 0"); time.sleep(0.6); r0 = grab(pg, stage)
    setfw("p.bubble.rise = 6"); time.sleep(0.6); r1 = grab(pg, stage)
    setfw("p.bubble.rise = 3.2")
    check('FW4 bubble and roll: the bank moves on its own and follows the rise slider', diff(f0, f1) > 0.01 and diff(r0, r1) > 0.02,
          f'still-scene change {diff(f0, f1):.3f}, rise 0 vs 6 {diff(r0, r1):.3f}')

    # FW5 glow + a lit fire in the never-seen room
    setfw("p.glow.strength = 0"); time.sleep(0.4); g0 = grab(pg, stage)
    setfw("p.glow.strength = 0.9"); time.sleep(0.4); g1 = grab(pg, stage)
    setfw("p.glow.strength = 0.3")
    lit = ev("""(() => { const it = fx.fogwarTools.extras().find(e => e.spec.id === 'brazier-tripod' && e.rest.x > 155); fx.fogwarTools.forceShow(it, true); return !!it; })()""")
    time.sleep(0.6); ev("fx.atmos.warm(6)")
    burning = ev("fx.fire.flames().filter(f => f.world && f.world.x > 155).length")
    light = ev("(() => { const f = fx.atmos.readField('light'); let m = 0; for (const [x, z] of [[161, 218], [158, 214], [164, 226], [156, 222]]) { const [i, j] = fx.atmos.cellOf(x, z, f.w, f.h); const o = (j * f.w + i) * 4; m = Math.max(m, f.data[o], f.data[o + 1], f.data[o + 2]); } return m; })()")
    ev("(() => { const it = fx.fogwarTools.extras().find(e => e.spec.id === 'brazier-tripod' && e.rest.x > 155); fx.fogwarTools.forceShow(it, false); })()")
    check('FW5 glow tints the bank blue-white; a burning fire in a never-seen room adds no light to the fog',
          float(g1[..., 2].mean()) > float(g0[..., 2].mean()) + 3 and lit and burning >= 1 and light < 1e-4,
          f'blue mean {g0[..., 2].mean():.1f} -> {g1[..., 2].mean():.1f}; hidden fire burning={burning}, fog light there={light:.5f}')

    # FW3 spill: closed walls hold it; an opening lets tongues out; the cap caps them
    ev("fx.fogwarTools.setCameraView('high')"); ev("fx.atmos.warm(60)")
    wall_side = max(v or 0 for v in ev("fx.atmos.probe('heavy', [[148.7, 226], [148.7, 230], [140, 210.9], [112, 222.5]])"))
    ev(f"(() => {{ const t = fx.fogwarTools; t.setDoorOpen(true); t.movePawnTo(149, {dz}, true); }})()")
    ev("fx.atmos.warm(90)")
    edge = ev(f"(() => {{ const pts = []; for (let x = 151; x < 166; x += 0.5) for (let z = {span[0]} + 0.3; z < 234; z += 0.5) if ([[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]].every(([a, c]) => fx.fogwar.isPointVisible(x + a, z + c, 0))) pts.push([x, z]); return [pts.length, Math.max(...fx.atmos.probe('heavy', pts).map(v => v || 0))]; }})()")
    setfw("p.spill.cap = 0.06"); ev("fx.atmos.warm(90)")
    edge_c = ev(f"(() => {{ const pts = []; for (let x = 151; x < 166; x += 0.5) for (let z = {span[0]} + 0.3; z < 234; z += 0.5) if ([[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]].every(([a, c]) => fx.fogwar.isPointVisible(x + a, z + c, 0))) pts.push([x, z]); return Math.max(...fx.atmos.probe('heavy', pts).map(v => v || 0)); }})()")
    setfw("p.spill.cap = 0"); ev("fx.atmos.warm(60)")
    check('FW3 spill rolls into sight through the open door, never through a closed wall; the cap caps it',
          wall_side < 0.05 and edge[0] > 50 and edge[1] > 0.12 and edge_c <= 0.085,
          f'beside closed walls {wall_side:.3f}; seen cells past the door {edge[0]}, spill max {edge[1]:.2f}, capped 0.06 -> {edge_c:.3f}')
    # FW3b every spill slider visibly changes the spill past the open door, min vs max of its range (2026-10-18: Harry
    # saw no effect; the tongue source had been commented out by a stray inline comment)
    sl = ev("""(async () => { const t = fx.fogwarTools; t.setCameraView('high');
      const pts = []; const sp = t.doorSpan(); for (let x = 150.5; x < 168; x += 0.5) for (let z = sp[0] + 0.3; z < 234.5; z += 0.5) if (fx.fogwar.isPointVisible(x, z, 0)) pts.push([x, z]);
      const H = () => fx.atmos.probe('heavy', pts).map(v => v || 0), V = () => fx.atmos.probe('velocity', pts).map(v => v || 0), mean = a => a.reduce((x, y) => x + y, 0) / a.length;
      const base = JSON.parse(JSON.stringify(fx.params('fogwar'))), out = {};
      for (const [k, lo, hi] of [['push', 0, 3], ['reach', 0, 14], ['cap', 0.02, 0], ['curl', 0, 3], ['speed', 0.2, 3]]) { out[k] = [];
        for (const v of [lo, hi]) { const p = JSON.parse(JSON.stringify(base)); if (k === 'speed') { p.spill.push = 3; p.spill.curl = 0; } p.spill[k] = v; // (speed with strong tongues and no curl: its own effect)
          fx.setParams('fogwar', p); fx.atmos.warm(120);
          const a = H(), vel = mean(V()); fx.atmos.warm(15); const b = H(); out[k].push({ density: mean(b), speed: vel, change: mean(a.map((x, i) => Math.abs(x - b[i]))) }); } }
      fx.setParams('fogwar', base); fx.atmos.warm(60); return out; })()""")
    ratio = lambda k, m: sl[k][1][m] / max(1e-4, sl[k][0][m])
    rs = {'push density': ratio('push', 'density'), 'reach density': ratio('reach', 'density'), 'cap off/0.02 density': ratio('cap', 'density'),
          'curl swirl speed': ratio('curl', 'speed'), 'curl churn': ratio('curl', 'change'), 'tongue speed churn (push 3, curl 0)': ratio('speed', 'change')}
    check('FW3b every spill slider visibly changes the spill past the open door (max vs min of its range >= 2x)', all(v >= 2.0 for v in rs.values()),
          ', '.join(f'{k} x{v:.1f}' for k, v in rs.items()))
    ev("fx.fogwarTools.setCameraView('door')"); ev("fx.atmos.warm(20)"); time.sleep(0.8)
    pg.screenshot(path=f'{outdir}/fogwar-3-door-spill.png', clip=stage)

    # FW8 + positive control: the opened room is seen; the method sees the beacon
    ev("fx.fogwarTools.setCameraView('high')"); ev("fx.atmos.warm(10)")
    hv_open = ev("fx.atmos.probe('heavy', [[160, 222.5]])")[0] or 0
    pos = {}
    for cam in ['high', 'door', 'low']:
        ev(f"fx.fogwarTools.setCameraView('{cam}')"); ev("fx.atmos.warm(30)"); time.sleep(0.5)
        ab = ev(f"({AB})(['unseenBeacon'])")['unseenBeacon']
        pos[cam] = (ab['px'], secret_px(grab(pg, stage)))
    ev("fx.fogwarTools.setDoorOpen(false)"); ev(f"fx.fogwarTools.movePawnTo(141, 222.5)"); ev("fx.atmos.warm(90)")
    after = ev("[fx.atmos.probe('veil', [[160, 222.5]])[0] || 0, fx.atmos.probe('heavy', [[160, 222.5]])[0] || 0]")
    check('FW8 opening the door rolls the bank back from what comes into sight; closing it leaves the veil, not the bank',
          hv_open < 0.2 and after[0] > 0.2 and after[1] < 0.2, f'heavy at the beacon open {hv_open:.2f}; after closing veil {after[0]:.2f} heavy {after[1]:.2f}')
    check('FW6a positive control: revealed, the beacon changes pixels and shows its colours from every camera',
          all(px > 200 for px, c in pos.values()) and pos['high'][1] > 30 and pos['door'][1] > 30, f'(A/B px, colour px) {pos}')

    # FW6 secrecy: fresh memory, then every preset x camera while a real cursor stirs the bank over the hidden things
    ev("fx.fogwarTools.resetMemory(true)"); ev("fx.atmos.warm(150)")
    secrets = {}
    progs0 = None
    for preset in ['plain', 'low', 'medium', 'high']:
        ev("(() => { const l = fx.params('lighting'); l.on = %s; fx.setParams('lighting', l); })()" % ('false' if preset == 'plain' else 'true'))
        ev("fx.fogwarTools.setLowMode(%s)" % ('true' if preset == 'low' else 'false'))
        if preset in ('medium', 'high'):
            ev(f"(() => {{ const a = fx.params('atmos'); a.quality.level = '{preset}'; fx.setParams('atmos', a); fx.atmos.warm(60); }})()")
        for cam in ['high', 'door', 'low']:
            ev(f"fx.fogwarTools.setCameraView('{cam}')"); ev("fx.atmos.warm(20)")
            path = [[156 + 0.6 * i, 222.5 + 4 * np.sin(i * 0.6)] for i in range(14)] + [[164 - 0.6 * i, 228 - 3 * np.cos(i * 0.5)] for i in range(14)]
            for wx, wz in path:
                s = ev(f"tuner.project3({wx}, 1.0, {wz})"); pg.mouse.move(s['x'], s['y']); time.sleep(0.02)
            ev("for (let k = 0; k < 6; k++) { fx.atmos.splat(160 + (k % 3 - 1) * 1.5, 222.5, 18, -14, -0.5, 3.2, -1.8); fx.atmos.splat(158, 228, -16, 15, -0.5, 3.2, -1.8); }")
            time.sleep(0.25)
            ab = ev(f"({AB})(['unseenBeacon', 'unseenPawn', 'unseenWall'])")
            col = secret_px(grab(pg, stage))
            secrets[f'{preset}/{cam}'] = (ab['unseenBeacon']['px'], ab['unseenPawn']['px'], ab['unseenWall']['px'], col)
            if preset == 'low' and cam == 'door':
                pg.screenshot(path=f'{outdir}/fogwar-5-checker-low.png', clip=stage)
    ev("(() => { const l = fx.params('lighting'); l.on = true; fx.setParams('lighting', l); })()"); ev("fx.fogwarTools.setLowMode(false)")
    ev("(() => { const a = fx.params('atmos'); a.quality.level = 'medium'; fx.setParams('atmos', a); fx.atmos.warm(60); })()")
    pawn_ok = ev("(() => { const o = fx.fogwarTools.testObjects(); return o.viewerPawn.visible && !o.unseenPawn.visible; })()")
    # From the LOW camera a thing standing in a never-seen cell, if it were drawn, hides whatever seen ground lies behind it,
    # so its outline can show as a patch of checker against that ground where the bank is stirred thin (the picture
    # behind it is simply not in the frame). The game never draws such things (engine/client/fog.js: never-seen things,
    # shell pieces and pawns are not drawn: browser_fogwar_game.py), so from there only the colour test is held to 0.
    low_outline = {k: v[0:3] for k, v in secrets.items() if k.endswith('/low')}
    check('FW6 SECRECY: hidden beacon / crimson pawn / baffle wall change 0 pixels from high and 3/4 cameras and no beacon colour shows from any, 3 cameras x Plain/Low/Medium/High, stirred by a real cursor',
          all(v[3] == 0 for v in secrets.values()) and all(v == (0, 0, 0, 0) for k, v in secrets.items() if not k.endswith('/low')) and len(secrets) == 12 and pawn_ok,
          f'(beacon, pawn, wall, colour px) {secrets}; viewer pawn drawn, unseen pawn undrawn={pawn_ok}')
    print(f'NOTE FW6 low-camera outline of DRAWN hidden things (beacon px, pawn px, wall px), not drawn in the game: {low_outline}', flush=True)
    results['FW6_low_outline'] = low_outline

    # FW12 walls known through their thickness (2026-10-18): the far-side fixtures (a box hung on the never-seen face of the
    # middle room's east wall; a wall joining that wall from the never-seen side) pass the game's own cull, then must
    # change 0 pixels; the fixture wall's OUTER material must change 0 pixels; and the known walls' caps and far faces now
    # draw (turning the known list off changes many pixels)
    AB2 = """(what) => { const t = fx.fogwarTools, o = t.testObjects(), cv = document.querySelector('#stage canvas'), gl = cv.getContext('webgl2');
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, shot = () => { fx.render(0); const a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
      const cnt = (A, B) => { let d = 0; for (let i = 0; i < A.length; i += 4) if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > 2) d++; return d; };
      const out = {};
      for (const n of ['farMount', 'farWall']) { const m = o[n], was = m.visible; m.visible = !!m.userData.cullVisible; const A = shot(); m.visible = false; const B = shot(); m.visible = was; out[n] = cnt(A, B); }
      { const c = o.fixtureOuter.color.getHex(); const A = shot(); o.fixtureOuter.color.set('#e0d020'); const B = shot(); o.fixtureOuter.color.setHex(c); out.outerMaterial = cnt(A, B);
        fx.fogwar.pass.enabled = false; const C = shot(); o.fixtureOuter.color.set('#e0d020'); const D = shot(); o.fixtureOuter.color.setHex(c); fx.fogwar.pass.enabled = true; out.outerOnScreen = cnt(C, D); } // (control: with no vision pass at all the outer face IS on screen)
      { const k = t.knownWalls(); fx.fogwar.setKnown(k); const A = shot(); fx.fogwar.setKnown([]); const B = shot(); fx.fogwar.setKnown(k); out.knownDraws = cnt(A, B); out.known = k.length; }
      out.drawn = { farMount: !!o.farMount.userData.cullVisible, farWall: !!o.farWall.userData.cullVisible, fixtureKnown: t.knownWalls().includes(o.fixtureWall) };
      return out; }"""
    kres = {}
    for preset in ['low', 'medium']:
        ev("fx.fogwarTools.setLowMode(%s)" % ('true' if preset == 'low' else 'false'))
        for cam in ['high', 'door', 'low']:
            ev(f"fx.fogwarTools.setCameraView('{cam}')"); ev("fx.atmos.warm(20)"); time.sleep(0.3)
            kres[f'{preset}/{cam}'] = ev(f"({AB2})()")
            if cam == 'low' and preset == 'medium':  # the still's low camera stands OUTSIDE the bank (eye ~19 ft, 22 degrees down)
                ev("(() => { const tc = tuner.cam; tc.focus.set(150, 3, 224); tc.dist = 44; tc.pitch = 22; tc.yaw = -35; tc.update?.(); fx.atmos.warm(20); })()"); time.sleep(0.5)
                kres['medium/low-outside'] = ev(f"({AB2})()")
            if cam in ('door', 'low') and preset == 'medium':
                pg.screenshot(path=f'{outdir}/fogwar-7-known-walls-{cam}.png', clip=stage)
                ev("fx.fogwar.setKnown([])"); pg.screenshot(path=f'{outdir}/fogwar-7-known-walls-{cam}-before.png', clip=stage)  # (one frame without: the old look)
                ev("fx.fogwar.setKnown(fx.fogwarTools.knownWalls())")
    ev("fx.fogwarTools.setLowMode(false)")
    check('FW12 walls known through their thickness: far-side hung box, far-side joining wall and the outer material change 0 pixels; known caps and far faces draw (Low/Medium x 3 cameras)',
          all(r['farMount'] == 0 and r['farWall'] == 0 and r['outerMaterial'] == 0 and r['knownDraws'] > 300 for r in kres.values()) and all(r['drawn']['fixtureKnown'] for r in kres.values()) and kres['medium/door']['outerOnScreen'] > 200,
          json.dumps({k: {x: v[x] for x in ('farMount', 'farWall', 'outerMaterial', 'outerOnScreen', 'knownDraws', 'known')} for k, v in kres.items()}))

    # FW13 roll back / pour in move at a watchable pace (2026-10-18, Harry: "it instantly swaps it to visible"), and secrecy
    # holds MID-transition: the A/B tests run 0.6 s into a door reveal and 0.6 s into losing sight
    ABN = """(names) => { const t = fx.fogwarTools, o = t.testObjects(), cv = document.querySelector('#stage canvas'), gl = cv.getContext('webgl2');
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, shot = () => { fx.render(0); const a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
      const out = {}; for (const n of names) { const m = o[n]; if (fx.fogwar.isPointSeen(m.position.x, m.position.z, 0)) { out[n] = 'seen'; continue; } const was = m.visible; m.visible = true; const A = shot(); m.visible = false; const B = shot(); m.visible = was;
        let d = 0; for (let i = 0; i < A.length; i += 4) if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > 2) d++; out[n] = d; } return out; }"""
    roll = ev(f"""(async () => {{ const t = fx.fogwarTools, sp = t.doorSpan(), dz = (sp[0] + sp[1]) / 2, sleep = ms => new Promise(r => setTimeout(r, ms));
      const P = [[160, 216]], H = () => fx.atmos.probe('heavy', P)[0] || 0, V = () => fx.atmos.probe('veil', P)[0] || 0;
      const ob = t.testObjects(), keep = [ob.unseenPawn.position.clone(), ob.unseenBeacon.position.clone()]; ob.unseenPawn.position.set(182, 0, 216); ob.unseenBeacon.position.set(180, 0, 222); // (deep in never-seen ground outside the east wall: nothing seen lies behind them, see FW6 NOTE)
      t.resetMemory(true); t.setDoorOpen(false); t.movePawnTo(149, dz, true); t.setCameraView('door'); await sleep(2500);
      const out = {{ reveal: [], pour: [] }}; t.setDoorOpen(true); let t0 = performance.now();
      for (const s of [0.3, 0.6, 1, 2, 4, 6]) {{ while (performance.now() - t0 < s * 1000) await sleep(10); out.reveal.push([s, +H().toFixed(2)]);
        if (s === 0.6) {{ out.midReveal = ({ABN})(['unseenBeacon', 'unseenPawn', 'unseenWall']); out.midReveal2 = ({AB2})(); }} }}
      t.movePawnTo(141, 222.5); t0 = performance.now();
      for (const s of [0.3, 0.6, 1, 2, 4, 6]) {{ while (performance.now() - t0 < s * 1000) await sleep(10); out.pour.push([s, +V().toFixed(2), +H().toFixed(2)]);
        if (s === 0.6) {{ out.midPour = ({ABN})(['unseenBeacon', 'unseenPawn', 'unseenWall']); out.midPour2 = ({AB2})(); }} }}
      t.setDoorOpen(false); ob.unseenPawn.position.copy(keep[0]); ob.unseenBeacon.position.copy(keep[1]); t.resetMemory(true); return out; }})()""")
    rv = dict((s, v) for s, v in roll['reveal']); pv = dict((s, v, ) for s, v, _ in roll['pour'])
    mids = [v for k in ('midReveal', 'midPour') for v in roll[k].values() if v != 'seen'] + [roll[k][x] for k in ('midReveal2', 'midPour2') for x in ('farMount', 'farWall', 'outerMaterial')]
    check('FW13 the bank rolls back over seconds when a door opens (dense at 0.6 s, gone by 6 s) and the veil pours in over seconds; mid-transition secrecy A/B 0 px',
          rv[0.6] > 0.6 and rv[6] < 0.1 and pv[0.3] < 0.3 and pv[6] > 0.6 and all(v == 0 for v in mids) and len(mids) >= 10,
          f"bank at (160,216) after opening {roll['reveal']}; veil/bank there after stepping back {roll['pour']}; mid-reveal {roll['midReveal']} {dict((x, roll['midReveal2'][x]) for x in ('farMount', 'farWall', 'outerMaterial'))}; mid-pour {roll['midPour']} {dict((x, roll['midPour2'][x]) for x in ('farMount', 'farWall', 'outerMaterial'))}")

    # FW7 a real cursor waving the bank away
    ev("fx.fogwarTools.setCameraView('high')"); ev("fx.atmos.warm(40)"); time.sleep(0.5)
    before = grab(pg, stage)
    wave = [[153 + 0.9 * i, 222.5 + 5 * np.sin(i * 0.55)] for i in range(18)]
    h0 = ev(f"fx.atmos.probe('heavy', {json.dumps(wave)})")
    for k in range(2):
        for wx, wz in (wave if k == 0 else wave[::-1]):
            s = ev(f"tuner.project3({wx}, 1.0, {wz})"); pg.mouse.move(s['x'], s['y']); time.sleep(0.03)
    pg.screenshot(path=f'{outdir}/fogwar-6-cursor-wave.png', clip=stage)
    after_w = grab(pg, stage)
    h1 = ev(f"fx.atmos.probe('heavy', {json.dumps(wave)})")
    v1 = ev(f"fx.atmos.probe('velocity', {json.dumps(wave)})")
    ab = ev(f"({AB})(['unseenBeacon', 'unseenPawn', 'unseenWall'])")
    pg.mouse.move(5, 5)
    check('FW7 a waved cursor stirs and clears the bank down toward the checker, with 0 secret pixels',
          max(v1) > 2 and float(np.mean(h1)) < float(np.mean(h0)) - 0.1 and diff(before, after_w) > 0.02 and secret_px(after_w) == 0 and all(x['px'] == 0 for x in ab.values()),
          f'speed max {max(v1):.1f} ft/s, heavy mean {np.mean(h0):.2f} -> {np.mean(h1):.2f}, picture change {diff(before, after_w):.3f}, A/B {ab}')

    # FW14 the dark preview (2026-10-21): one light of each kind in a dark field; the Light reach sliders move its discs
    ev("fx.fogwarTools.setDark(true)")
    pg.wait_for_function("fx.fogwarTools.isDark() && fx.fogwarTools.fieldLights().length === 8", timeout=60000)
    time.sleep(2.5)
    fl = {L['kind']: L for L in ev("fx.fogwarTools.fieldLights()")}
    lx, lz = fl['lamp']['x'], fl['lamp']['z']
    seen = lambda d: ev(f"fx.fogwarTools.fieldSeen({lx - d}, {lz})")
    d0 = {'r': fl['lamp']['radius'], 's40': seen(40), 's47': seen(47)}
    pg.screenshot(path=os.path.join(outdir, 'fogwar-14a-dark-preview.png'))
    pg.evaluate("document.querySelectorAll('#fx-fogwar-dials details').forEach(d => d.open = true)")
    slider = pg.locator('#fx-fogwar-dials input[data-path="fogwar.reach.lamp"]')
    n_sliders = pg.locator('#fx-fogwar-dials input[data-path^="fogwar.reach."], #fx-fogwar-dials input[data-path^="fogwar.bright."]').count()
    slider.evaluate("(el) => { el.value = 20; el.dispatchEvent(new Event('input')); }"); time.sleep(0.6)
    d1 = {'r': ev("fx.fogwarTools.fieldLights()[1].radius"), 's15': seen(15), 's25': seen(25), 'readout': slider.evaluate("el => el.closest('label').querySelector('output').textContent")}
    pg.screenshot(path=os.path.join(outdir, 'fogwar-14b-dark-lamp-20.png'))
    pg.locator('#fx-fogwar-dials input[type=checkbox][data-path="fogwar.dark.dim"]').click(); time.sleep(0.6)
    d2 = {'r': ev("fx.fogwarTools.fieldLights()[1].radius"), 'torch': ev("fx.fogwarTools.fieldLights()[3].radius"), 's12': seen(12), 's18': seen(18)}
    pg.locator('#fx-fogwar-dials input[type=checkbox][data-path="fogwar.dark.dim"]').click()
    slider.evaluate("(el) => { el.value = 45; el.dispatchEvent(new Event('input')); }"); time.sleep(0.4)
    ev("fx.fogwarTools.setDark(false)")
    check('FW14 dark preview: a light of each kind in a dark field; the lamp\'s reach slider (45 -> 20) and Count dim light (off: bright 15) move its disc at once',
          n_sliders == 16 and d0 == {'r': 45, 's40': True, 's47': False} and d1['r'] == 20 and d1['s15'] and not d1['s25'] and d1['readout'] == '20 ft' and d2['r'] == 15 and d2['torch'] == 20 and d2['s12'] and not d2['s18'],
          f'sliders {n_sliders}, default {d0}, slider 20 {d1}, dim off {d2}')

    # FW9 no compiles when the fog changes
    progs0 = ev("fx.stats().programs")
    ev(f"(async () => {{ const t = fx.fogwarTools; for (let i = 0; i < 4; i++) {{ t.setDoorOpen(i % 2 === 0); t.movePawnTo(141 + i * 2, 222.5); await new Promise(r => setTimeout(r, 120)); }} t.setDoorOpen(false); t.resetMemory(true); await new Promise(r => setTimeout(r, 300)); }})()")
    time.sleep(0.5)
    progs1 = ev("fx.stats().programs")
    check('FW9 no shader compiles when the fog state changes (door, pawn, memory reset)', progs0 == progs1, f'programs {progs0} -> {progs1}')

    # FW10 presets + Use in game (sandboxed)
    pg.select_option('#fx-fogwar-load', 'builtin:wild-billows')
    ok_load = ev("fx.params('fogwar').name") == 'wild-billows' and ev("fx.params('fogwar').bank.height") == 11
    pg.select_option('#fx-fogwar-load', 'builtin:default')
    pg.fill('#fx-fogwar-name', 'test-fogwar-house')
    pg.click('#fx-fogwar-house')
    pg.wait_for_function("!document.querySelector('#toast').hidden && /GAME now uses/.test(document.querySelector('#toast').textContent)", timeout=15000)
    h_sand = ev("fetch((new URLSearchParams(location.search).get('api') || '/api/tw-ratings') + '/tuner/house', { cache: 'no-store' }).then(r => r.json())")
    check('FW10 built-in presets load; "Use in game" stores house.fogwar (test sandbox only)', ok_load and (h_sand.get('fogwar') or {}).get('name') == 'fogwar-test-fogwar-house',
          f"house.fogwar.name={(h_sand.get('fogwar') or {}).get('name')}")
    check('FW11 no page errors', not errs, '; '.join(errs[:3]))
    b.close()

json.dump({'results': results, 'fails': fails}, open(os.path.join(outdir, 'fogwar_ui.json'), 'w'), indent=1)
n = len([k for k in results if k.startswith('FW') and isinstance(results[k], bool)])
print(f'{fails} failure(s), {n - fails}/{n} passed')
sys.exit(1 if fails else 0)

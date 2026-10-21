"""The Far-fire glow panel (2026-10-12; js/fx/farglow.js, js/fx/glowpanel.js; PLAN.md "Far-fire glow").
G1 the panel is there, in the pattern of the other look panels: dials, presets, "Use in game" above Send
G2 the tuner opens as ever: every flame a real light, no stand-in, its pass out of the frame
G3 the test room is built; view 2 = a pool and nothing else; view 3 = the same pool + one stand-in per light left out
G4 a dial moves the live look; "floor disc" mode draws the old discs and no pass; projected draws no disc
G5 the number: the projected stand-in is closer to the real lights than no stand-in, and the old floor disc is not
G6 walls: a light's ring of wall distances stops short of its reach on the wall's side (never crosses a wall)
G7 a swap between real and stand-in is a cross-fade: no light jumps by more than a step a frame
G8 Send leaves the game alone; Use in game stores house.farglow (in the TEST SANDBOX: the live house look is untouched)
G9 no page errors
python glow_ui.py BASE_URL [API_ORIGIN]   (BASE_URL a static server on tools/spawn-tuner; API_ORIGIN e.g. http://127.0.0.1:8096)
  --self: start that static server itself (port 18644) and use http://127.0.0.1:8096"""
import sys, time, json, os, subprocess, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); srv = None
if '--self' in sys.argv:
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '18644', '--bind', '127.0.0.1'], cwd=os.path.dirname(HERE), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.5)
    base, api_origin = 'http://127.0.0.1:18644', 'http://127.0.0.1:8096'
else:
    base = sys.argv[1].rstrip('/'); api_origin = sys.argv[2] if len(sys.argv) > 2 else None
fails = 0
def check(n, ok, ev=''):
    global fails; print(('PASS ' if ok else 'FAIL ') + n + (f'  [{ev}]' if ev != '' else ''), flush=True); fails += 0 if ok else 1
def live_house():
    from urllib.parse import urlsplit; o = urlsplit(base); u = (api_origin or f'{o.scheme}://{o.netloc}/api/tw-ratings') + '/tuner/house'
    with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0 tw-test'}), timeout=15) as r: return json.loads(r.read())
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
    pg = b.new_page(viewport={'width': 1700, 'height': 1900}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    if api_origin: tw_sandbox.proxy(pg, api_origin)
    pg.add_init_script("try { for (const k of Object.keys(localStorage)) if (k.startsWith('tuner.')) localStorage.removeItem(k); } catch (e) {}")
    before = live_house()
    pg.goto(base + '/index.html?nobg&seed=7&atmos=clear'); pg.wait_for_selector('body[data-ready="1"]', timeout=120000); pg.wait_for_function('!!window.fx && !!fx.glowTools', timeout=60000)
    pg.evaluate("document.querySelector('details.major[data-key=\"farglow\"]').open = true")
    ui = pg.evaluate("""(() => { const x = document.querySelector('.houseBox[data-house=farglow]'), u = x?.querySelector('button.houseUse'), send = x?.nextElementSibling?.querySelector('button.houseSend');
      return { dials: document.querySelectorAll('#fx-farglow-dials input, #fx-farglow-dials select').length, use: u?.textContent || '', send: send?.textContent || '', above: !!(u && send && u.getBoundingClientRect().bottom <= send.getBoundingClientRect().top + 1),
        views: [...document.querySelectorAll('.fxGlow [data-view]')].map(e => e.dataset.view), load: [...document.querySelectorAll('#fx-farglow-load option')].map(o => o.value) }; })()""")
    check('G1 the Far-fire glow panel: dials, the three views, built-in presets, "Use in game" above Send', ui['dials'] >= 18 and ui['views'] == ['real', 'none', 'glow'] and ui['use'].startswith('Use in game') and 'game unchanged' in ui['send'] and ui['above'] and 'builtin:far-glow' in ui['load'] and 'builtin:old-floor-disc' in ui['load'], json.dumps(ui)[:300])
    s0 = pg.evaluate("({ view: fx.glowTools.view, cap: fx.fire.cap === Infinity, on: fx.farglow.on, pass: fx.stats().farglow_pass, mode: fx.params('farglow').how.mode })")
    check('G2 the tuner opens as ever: every flame a real light, no stand-in, its pass out of the frame', s0 == {'view': 'real', 'cap': True, 'on': False, 'pass': False, 'mode': 'projected'}, s0)
    pg.click('#fx-glow-room'); pg.wait_for_function("tuner.episodes() === 0 && fx.glowTools.extras().length >= 4", timeout=240000); pg.wait_for_timeout(5000)
    pg.evaluate("fx.glowTools.setPool(2)"); pg.click('.fxGlow [data-view=none]'); pg.wait_for_function("fx.fire.cap === 2", timeout=60000); pg.wait_for_timeout(1500)
    v2 = pg.evaluate("({ pool: fx.fire.pool(), on: fx.farglow.on, pass: fx.stats().farglow_pass, discs: fx.fire.glowCount() })")
    pg.click('.fxGlow [data-view=glow]'); pg.wait_for_timeout(1500)
    v3 = pg.evaluate("({ pool: fx.fire.pool(), on: fx.farglow.on, s: fx.stats(), discs: fx.fire.glowCount(), kinds: [...new Set(fx.farglow.standins().map(x => x.type))].sort() })")
    check('G3 the test room has many kinds of light; view 2 is a pool of 2 and nothing else', v2['pool']['real'] == 2 and v2['pool']['lit'] >= 8 and not v2['on'] and not v2['pass'] and v2['discs'] == 0, v2)
    check('G3b view 3 is the same pool plus one stand-in for every light left out (hearth, brazier, torch, lantern, candles), in one pass', v3['pool']['real'] == 2 and v3['on'] and v3['s']['farglow_pass'] and v3['s']['farglow_lights'] == v3['pool']['lit'] - 2 and len(v3['kinds']) >= 4 and v3['discs'] == 0, {'standins': v3['s']['farglow_lights'], 'lit': v3['pool']['lit'], 'kinds': v3['kinds'], 'walls': v3['s']['farglow_walls']})
    sl = pg.locator('[data-path="farglow.light.intensity"]'); sl.evaluate("e => { e.value = '1.5'; e.dispatchEvent(new Event('input', { bubbles: true })); }")
    d1 = pg.evaluate("fx.params('farglow').light.intensity")
    pg.evaluate("(() => { const p = fx.params('farglow'); p.light.intensity = 1; p.how.mode = 'floor'; fx.setParams('farglow', p); })()"); pg.wait_for_timeout(500)
    fl = pg.evaluate("({ discs: fx.fire.glowCount(), pass: fx.stats().farglow_pass })")
    check('G4 a dial moves the live look; "floor disc" mode draws the old discs and no pass', abs(d1 - 1.5) < 1e-6 and fl['discs'] >= 1 and not fl['pass'], [d1, fl])
    pg.evaluate("fx.glowTools.setPool(0)"); mF = pg.evaluate("fx.glowTools.measure()")
    pg.evaluate("(() => { const p = fx.params('farglow'); p.how.mode = 'projected'; fx.setParams('farglow', p); })()"); pg.wait_for_timeout(300); mP = pg.evaluate("fx.glowTools.measure()")
    txt = pg.evaluate("document.querySelector('#fx-glow-diff').textContent")
    check('G5 the number (no real light at all): the projected stand-in is at most half as far from real as no stand-in', mP and mP['lit'] > 0.05 and mP['mean'] < 0.5 * mP['none_mean'] and 'stand-in: mean' in txt, {k: mP.get(k) for k in ('lit', 'mean', 'max', 'p95', 'none_mean', 'bias')} if mP else None)
    check('G5b and the old floor disc is farther from real than no stand-in at all (what Harry saw)', mF and mF['mean'] > mF['none_mean'], {k: mF.get(k) for k in ('mean', 'none_mean', 'bias')} if mF else None)
    # walls: the sconce on the wall shared with the side room: its ring is short toward the wall, long into the room
    pg.evaluate("fx.glowTools.setView('glow', true)"); pg.wait_for_timeout(600)
    ring = pg.evaluate("""(() => { const out = []; for (const s of fx.farglow.standins()) { const r = fx.farglow.ringOf(s.light); if (!r) continue; const R = s.distance; out.push({ type: s.type, min: +Math.min(...r).toFixed(2), blocked: +(r.filter(d => d < R).length / r.length).toFixed(2), reach: +R.toFixed(1) }); } return out; })()""")
    check('G6 walls: every stand-in whose reach meets a wall is cut off there (its ring of wall distances is shorter than its reach on that side)', len(ring) >= 6 and all(r['blocked'] > 0.2 and r['min'] < r['reach'] for r in ring if r['reach'] > 20) and any(r['min'] < 3 for r in ring), ring[:6])
    # the cross-fade: a pool of 2, the view moved so that the pool changes; the largest change of any light's share in a frame
    pg.evaluate("fx.glowTools.setPool(2)"); pg.wait_for_timeout(800)
    step = pg.evaluate("""() => new Promise(res => { const L = fx.fire.lights(), prev = new Map(), c = tuner.cam, x0 = c.focus.x; let worst = 0, n = 0, swaps0 = fx.fire.pool().swaps;
      const tick = () => { for (const l of L) { const k = l.userData.k ?? 1; if (prev.has(l)) worst = Math.max(worst, Math.abs(k - prev.get(l))); prev.set(l, k); }
        n++; if (n === 5) { c.focus.x = x0 + 22; c.update(); } if (n === 70) { c.focus.x = x0; c.update(); }
        if (n < 150) requestAnimationFrame(tick); else res({ worst: +worst.toFixed(3), swaps: fx.fire.pool().swaps - swaps0, fade: fx.fire.glowLook.fade }); }; requestAnimationFrame(tick); })""")
    check('G7 a swap between real light and stand-in is a cross-fade (0.4 s): lights changed places, and none jumped', step['swaps'] >= 2 and step['worst'] < 0.5 and step['fade'] == 0.4, step)
    pg.fill('#fx-farglow-name', 'glow ui test'); pg.click('#fx-farglow-send'); pg.wait_for_function("!document.querySelector('#toast').hidden && /Sent/.test(document.querySelector('#toast').textContent)", timeout=15000)
    t1 = pg.evaluate("document.querySelector('#toast').textContent"); h1 = pg.evaluate("fetch('/api/tw-ratings/tuner/house', { cache: 'no-store' }).then(r => r.json())")
    pg.click('#fx-farglow-house'); pg.wait_for_function("!document.querySelector('#toast').hidden && /GAME now uses/.test(document.querySelector('#toast').textContent)", timeout=15000); time.sleep(1.0)
    h2 = pg.evaluate("fetch('/api/tw-ratings/tuner/house', { cache: 'no-store' }).then(r => r.json())"); st = pg.evaluate("document.querySelector('.houseBox[data-house=farglow]').dataset.state")
    check('G8 Send leaves the game alone; Use in game stores house.farglow (sandboxed) and the line agrees', 'NOT changed' in t1 and not h1.get('farglow') and (h2.get('farglow') or {}).get('name') == 'glow-glow ui test' and (h2['farglow'].get('how') or {}).get('mode') == 'projected' and st == 'same', f"house.farglow: {(h2.get('farglow') or {}).get('name')}; line: {st}")
    after = live_house()
    check('G8b the LIVE house look never changed (no far-fire glow in the game)', json.dumps(before, sort_keys=True) == json.dumps(after, sort_keys=True) and not after.get('farglow'))
    check('G9 no page errors', not errs, '; '.join(errs[:3]))
    os.makedirs(os.path.join(HERE, 'shots'), exist_ok=True); pg.screenshot(path=os.path.join(HERE, 'shots', 'glow-ui.png'))
    b.close()
finally:
    if srv: srv.terminate()
print(f'{fails} failure(s)'); print('ALL 12 PASSED' if not fails else ''); sys.exit(fails)

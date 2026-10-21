""""Use in game" is unmistakable in every look panel (2026-10-05).
Harry tuned an atmosphere, pressed "Send preset to Fauna" believing it shipped, and the game went on showing another one:
the two buttons sat side by side and read alike. Now (js/fx/houselink.js) each panel leads with "Use in game", says under
it what the game is using and whether that is what is on screen, and a Send says the game did not change.
B1 every look panel (spawn, lighting, fire, selection, atmosphere, water, depth) has the box, the primary button, the line
B2 the tuner opens on a look the game is not using: the line says so and names the game's
B3 with the game's own values on screen the line says they are the same; a dial moved, it says different again
B4 Send: the toast says the GAME is NOT changed, the line turns loud, the house look is untouched
B5 Use in game: the toast says the GAME now uses it and names it; the line agrees; the (sandboxed) house look is it
B6 the LIVE house look never changed (the writes went to the test sandbox)
python house_buttons.py BASE_URL [API_ORIGIN]   (BASE_URL a static server on tools/spawn-tuner; API_ORIGIN e.g. http://127.0.0.1:8096)"""
import sys, time, json, urllib.request
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright
base = sys.argv[1].rstrip('/'); api_origin = sys.argv[2] if len(sys.argv) > 2 else None
fails = 0
def check(n, ok, ev=''):
    global fails; print(('PASS ' if ok else 'FAIL ') + n + (f'  [{ev}]' if ev else '')); fails += 0 if ok else 1
def live_house():
    from urllib.parse import urlsplit; o = urlsplit(base); u = (api_origin or f'{o.scheme}://{o.netloc}/api/tw-ratings') + '/tuner/house'
    with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0 tw-test'}), timeout=15) as r: return json.loads(r.read())
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'] + (['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('ATMOS_GPU') else []))
    pg = b.new_page(viewport={'width': 1500, 'height': 950}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    if api_origin: tw_sandbox.proxy(pg, api_origin)
    pg.add_init_script("try { for (const k of Object.keys(localStorage)) if (k.startsWith('tuner.')) localStorage.removeItem(k); } catch (e) {}")
    before = live_house()
    pg.goto(base + '/index.html?nobg&seed=4242'); pg.wait_for_selector('body[data-ready="1"]', timeout=90000); pg.wait_for_function('!!window.fx && !!fx.atmos', timeout=60000)
    pg.evaluate("document.querySelectorAll('details.major').forEach(d => d.open = true)")
    pg.wait_for_function("document.querySelector('.houseBox[data-house=atmos]')?.dataset.state && document.querySelector('.houseBox[data-house=atmos]').dataset.state !== 'unknown'", timeout=20000)
    boxes = pg.evaluate("""[...document.querySelectorAll('.houseBox')].map(x => { const u = x.querySelector('button.houseUse'), s = x.querySelector('.houseState'), send = x.nextElementSibling?.querySelector('button.houseSend');
      return { key: x.dataset.house, state: x.dataset.state, use: u?.textContent || '', primary: !!u?.classList.contains('primary'), line: s?.textContent || '', send: send?.textContent || '', sendPrimary: !!send?.classList.contains('primary'), above: !!(u && send && u.getBoundingClientRect().bottom <= send.getBoundingClientRect().top + 1), wide: u ? u.getBoundingClientRect().width / Math.max(1, x.getBoundingClientRect().width) : 0 }; })""")
    keys = sorted(x['key'] for x in boxes); want = ['anim', 'atmos', 'cutfly', 'dice', 'farglow', 'fire', 'fogwar', 'lighting', 'selection', 'water']
    ok = keys == want and all(x['primary'] and not x['sendPrimary'] and x['use'].startswith('Use in game') and 'game unchanged' in x['send'] and x['line'] and x['above'] and x['wide'] > 0.85 for x in boxes)
    check('B1 every look panel leads with "Use in game" (primary, full width, above Send) and a line about the game', ok, f"{keys}; e.g. \"{boxes[0]['use']}\" over \"{boxes[0]['send']}\"" + ('' if ok else ' | ' + json.dumps([x for x in boxes if not (x['primary'] and x['above'] and x['line'])])[:400]))
    line = lambda k='atmos': pg.evaluate(f"(() => {{ const x = document.querySelector('.houseBox[data-house={k}]'); return {{ state: x.dataset.state, text: x.querySelector('.houseState').textContent, cls: x.querySelector('.houseState').className }}; }})()")
    toast = lambda: pg.evaluate("document.querySelector('#toast').hidden ? '' : document.querySelector('#toast').textContent")
    hn = (before.get('atmos') or {}).get('name'); l0 = line()
    check('B2 the tuner opens on an atmosphere the game is not using: the line says so and names the game\'s', (l0['state'] == 'different' and 'different' in l0['text'] and 'NOT in the game' in l0['text'] and (hn or '') in l0['text']) if hn else l0['state'] == 'builtin', f"game: {hn}; line: \"{l0['text']}\"")
    built = {k: line(k)['text'] for k in ('lighting', 'fire', 'water', 'anim') if not before.get(k)}
    check('B2b a look the game has no stored choice for says the game uses its built-in', all('built-in' in t for t in built.values()), json.dumps(built)[:300])
    if hn:
        pg.evaluate(f"fx.setParams('atmos', {json.dumps(before['atmos'])})"); l1 = line()
        pg.evaluate("(() => { const p = fx.params('atmos'); p.outdoor.density = +(p.outdoor.density + 0.07).toFixed(2); fx.setParams('atmos', p); })()"); l2 = line()
        check('B3 the game\'s own values on screen read "exactly this"; one dial moved reads different again', l1['state'] == 'same' and 'exactly this' in l1['text'] and l2['state'] == 'different', f"\"{l1['text']}\" -> \"{l2['text'][:60]}…\"")
    pg.fill('#fx-atmos-name', 'buttons test mist'); pg.click('#fx-atmos-send'); pg.wait_for_function("!document.querySelector('#toast').hidden && /Sent/.test(document.querySelector('#toast').textContent)", timeout=15000)
    t1, l3 = toast(), line(); h1 = pg.evaluate("fetch((new URLSearchParams(location.search).get('api') || '/api/tw-ratings') + '/tuner/house', { cache: 'no-store' }).then(r => r.json())")
    check('B4 Send: the toast says the GAME is NOT changed, the line turns loud, the house look is untouched', 'NOT changed' in t1 and 'Use in game' in t1 and 'loud' in l3['cls'] and l3['state'] == 'different' and (h1.get('atmos') or {}).get('name') == hn, f"toast: \"{t1}\"; line class: {l3['cls']}; house still {(h1.get('atmos') or {}).get('name')}")
    pg.click('#fx-atmos-house'); pg.wait_for_function("!document.querySelector('#toast').hidden && /GAME now uses/.test(document.querySelector('#toast').textContent)", timeout=15000)
    t2 = toast(); time.sleep(1.0); l4 = line(); h2 = pg.evaluate("fetch((new URLSearchParams(location.search).get('api') || '/api/tw-ratings') + '/tuner/house', { cache: 'no-store' }).then(r => r.json())")
    check('B5 Use in game: the toast says the GAME now uses it and names it; the line agrees; the house look is it', 'GAME now uses' in t2 and 'atmos-buttons test mist' in t2 and l4['state'] == 'same' and 'loud' not in l4['cls'] and (h2.get('atmos') or {}).get('name') == 'atmos-buttons test mist', f"toast: \"{t2}\"; line: \"{l4['text']}\"; sandboxed house: {(h2.get('atmos') or {}).get('name')}")
    # the spawn panel's pair works the same way
    pg.click('#sendPreset'); pg.wait_for_function("!document.querySelector('#toast').hidden && /Sent|sent/.test(document.querySelector('#toast').textContent)", timeout=15000); time.sleep(0.3); t3 = toast()
    pg.click('#houseAnim'); pg.wait_for_function("!document.querySelector('#toast').hidden && /GAME now uses/.test(document.querySelector('#toast').textContent)", timeout=15000); t4 = toast(); time.sleep(0.6)
    check('B5b the Spawn panel: Send says not changed, Use in game says the GAME now uses it', 'NOT changed' in t3 and 'GAME now uses' in t4 and line('anim')['state'] == 'same', f"\"{t3[:70]}\" / \"{t4[:70]}\"")
    after = live_house()
    check('B6 the LIVE house look never changed (the writes went to the sandbox)', json.dumps(before, sort_keys=True) == json.dumps(after, sort_keys=True), f"live atmosphere still {(after.get('atmos') or {}).get('name')}")
    check('B7 no page errors', not errs, '; '.join(errs[:3]))
    pg.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots', 'house-buttons.png'))
    b.close()
print(fails, 'failure(s)'); sys.exit(fails)

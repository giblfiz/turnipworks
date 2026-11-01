# THE TAKE: a real recording of the real flow (Beyond20 built from source and loaded unpacked; Fauna's own D&D Beyond
# account and the Basic Rules premade Lola Jani; a throwaway dev table). Every click and keystroke on screen is a real X
# input event (xdotool), with the real pointer drawn by x11grab. Nothing of Beyond20's is simulated.
#   DISPLAY=:101 python take.py OUTDIR      (Xvfb :101 at 2560x1440)
import json, os, subprocess, sys, time, math
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.join(os.path.dirname(HERE), 'b20.7kyz/b20/build/chrome')
PROF = os.path.join(HERE, 'profile')
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
INVITE = open(os.path.join(HERE, 'invite.url')).read().strip()
SHEET = 'https://www.dndbeyond.com/characters/172939471'
W, H = 2560, 1440
LW = 1280  # each window is half the screen
EV = []; T0 = [None]
def mark(name, **kw):
    t = time.time() - T0[0] if T0[0] else -1
    try: kw['mouse'] = mouse()
    except Exception: pass
    EV.append({'t': round(t, 2), 'ev': name, **kw}); print(f'{t:7.2f}  {name} {kw if kw else ""}', flush=True)
def xdo(*a): return subprocess.run(['xdotool', *map(str, a)], capture_output=True, text=True).stdout.strip()
def mouse():
    o = dict(kv.split(':') for kv in xdo('getmouselocation').split()[:2]); return int(o['x']), int(o['y'])
def move(x, y, dur=0.7):
    x0, y0 = mouse(); n = max(2, int(dur * 60))
    for i in range(1, n + 1):
        k = i / n; e = k * k * (3 - 2 * k)
        xdo('mousemove', int(x0 + (x - x0) * e), int(y0 + (y - y0) * e)); time.sleep(dur / n)
def click(): xdo('click', 1); time.sleep(0.15)
def key(*k): xdo('key', '--delay', 60, *k)
def typ(s, delay=55): xdo('type', '--delay', delay, s)
def origin(pg):
    v = pg.evaluate('[screenX, screenY, outerHeight - innerHeight, outerWidth - innerWidth]'); return v[0] + v[3] // 2, v[1] + v[2]
def at(pg, box):  # a viewport box -> its centre on the screen
    ox, oy = origin(pg); return ox + box['x'] + box['width'] / 2, oy + box['y'] + box['height'] / 2
def to_el(pg, loc, dur=0.8):
    b = loc.bounding_box(); assert b, 'no box'; x, y = at(pg, b); move(x, y, dur); return x, y
def wheel_into_view(pg, loc, top=0.25, bot=0.7):
    last = None
    for _ in range(80):
        b = loc.bounding_box(); ih = pg.evaluate('innerHeight'); y = pg.evaluate('scrollY')
        if b and top * ih <= b['y'] <= bot * ih: return
        if last is not None and y == last: return  # the page cannot scroll further
        last = y; xdo('click', 5 if (not b or b['y'] > bot * ih) else 4); time.sleep(0.09)
def focus(title_part):
    for wid in xdo('search', '--name', title_part).split():
        xdo('windowfocus', '--sync', wid); return wid

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(PROF, headless=False, no_viewport=True, ignore_default_args=['--enable-automation'],
        args=[f'--disable-extensions-except={EXT}', f'--load-extension={EXT}', '--no-sandbox', '--window-position=0,0', f'--window-size={LW},{H}',
              '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling',
              '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--hide-crash-restore-bubble', '--no-first-run',
              '--no-default-browser-check', '--disable-features=Translate', '--lang=en-US'])
    def bounds(page, x, y, w, h):
        s = ctx.new_cdp_session(page); wid = s.send('Browser.getWindowForTarget')['windowId']
        s.send('Browser.setWindowBounds', {'windowId': wid, 'bounds': {'left': x, 'top': y, 'width': w, 'height': h}})
    for _ in range(50):
        if ctx.service_workers: break
        time.sleep(0.2)
    sw = ctx.service_workers[0]; EXTID = sw.url.split('/')[2]
    ddb = ctx.pages[0] if ctx.pages else ctx.new_page()
    for extra in ctx.pages[1:]: extra.close()
    bounds(ddb, 0, 0, LW, H)
    # ---- reset Beyond20: no custom domains, no permission for them (a first-time player) ----
    opt = ctx.new_page(); opt.goto(f'chrome-extension://{EXTID}/options.html'); time.sleep(1.5)
    opt.evaluate("new Promise(r => chrome.permissions.remove({origins: ['https://turnipworks.net/*', 'https://dev.turnipworks.net/*']}, r))")
    opt.click('#advanced'); time.sleep(0.5)
    opt.fill('#custom-domains', ''); opt.dispatch_event('#custom-domains', 'change'); time.sleep(1)
    left = opt.evaluate("new Promise(r => chrome.permissions.getAll(p => r(p.origins.filter(o => o.includes('turnip')))))")
    assert not left, left
    opt.close()
    # ---- the sheet: full HP, Actions showing ----
    ddb.goto(SHEET); ddb.wait_for_selector('.ct-combat__summary-group--initiative button', timeout=60000); time.sleep(3)
    for sel in ['#ketch-banner-button-tertiary']:
        try: ddb.click(sel, timeout=2500)
        except Exception: pass
    ddb.evaluate("document.querySelectorAll('.alertify').forEach(e => { if (!e.innerText.trim() || /parse/.test(e.innerText)) e.remove(); })")
    cur = ddb.locator('button.styles_valueButton__0rK5Z.styles_number__j1d93').first.inner_text()
    if cur.strip() != '12':
        ddb.locator('input.styles_input__coHiS').first.fill(str(12 - int(cur))); ddb.locator('button:has-text("HEAL")').first.click(); time.sleep(2)
    try: ddb.locator('button:has-text("ACTIONS")').first.click(timeout=3000)
    except Exception: pass
    # ---- the table, its own window on the right ----
    s = ctx.new_cdp_session(ddb)
    with ctx.expect_page() as pi: s.send('Target.createTarget', {'url': 'about:blank', 'newWindow': True})
    tw = pi.value; bounds(tw, LW, 0, LW, H)
    tw.goto(INVITE); tw.wait_for_function('window.tw?.ready?.() && tw.fog && tw.dice && tw.b20', timeout=120000)
    tw.wait_for_function('tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading', timeout=120000)
    assert not tw.evaluate('tw.b20.connected'), 'Beyond20 already connected?'
    LOOK = "(() => { const g = tw.main.grab; g.focus.set(17.5, 0, 13); g.dist = 30; g.pitch = 52; g.yaw = 0; g.update(); })()"
    tw.evaluate(LOOK); time.sleep(4)
    ddb.bring_to_front(); time.sleep(0.5)
    move(1900, 900, 0.1)
    # ---- record ----
    raw = os.path.join(OUT, 'raw.mkv')
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'x11grab', '-draw_mouse', '1', '-framerate', '30', '-video_size', f'{W}x{H}', '-i', os.environ.get('DISPLAY', ':101'),
                           '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '16', '-pix_fmt', 'yuv420p', raw], stdin=subprocess.PIPE)
    time.sleep(1.0); T0[0] = time.time(); mark('start')
    try:
        time.sleep(2.5); mark('both')
        # 1. Beyond20's options: what its toolbar popup's "Beyond20 Options" does (chrome.runtime.openOptionsPage), in the table's window
        move(LW + 640, 700, 0.6); click(); focus('Turnip Works')
        # (what its toolbar popup's "Beyond20 Options" link does: a new tab with its options page)
        opt = ctx.new_page(); opt.goto(f'chrome-extension://{EXTID}/options.html')
        opt.wait_for_load_state()
        opt.wait_for_selector('#advanced'); time.sleep(1.2); mark('options')
        adv = opt.locator('#advanced'); move(LW + 640, 800, 0.5); wheel_into_view(opt, adv, 0.3, 0.92); time.sleep(0.4)
        to_el(opt, adv); time.sleep(0.4); click(); time.sleep(1.0); mark('advanced')
        ta = opt.locator('#custom-domains')
        wheel_into_view(opt, ta, 0.2, 0.6); time.sleep(0.6); mark('domains-field')
        to_el(opt, ta, 0.6); click(); time.sleep(0.3)
        typ('https://turnipworks.net/*'); key('Return'); typ('https://dev.turnipworks.net/*'); time.sleep(0.8); mark('typed')
        to_el(opt, opt.locator('#beyond20-option-custom-domains button'), 0.7); time.sleep(0.3); click(); mark('apply')
        # the browser asks: Allow (Chrome's dialog, centred near the top of the window: Deny is the filled default, Allow to its right)
        granted = []
        for i in range(2):
            time.sleep(1.8); mark('permission', n=i + 1)
            move(LW + 640 + 170, 252, 0.8); time.sleep(0.5); click(); time.sleep(1.2)
            granted = opt.evaluate("new Promise(r => chrome.permissions.getAll(p => r(p.origins.filter(o => o.includes('turnip')))))")
            mark('allowed', origins=granted)
            if len(granted) == 2: break
        assert len(granted) == 2, granted
        time.sleep(1.5); mark('saved')
        # 2. back to the table, reload: "Beyond20 connected"
        key('ctrl+w'); time.sleep(0.8)
        mark('reload'); key('F5')
        tw.wait_for_function('window.tw?.ready?.() && tw.b20', timeout=120000)
        tw.wait_for_function('tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading', timeout=120000)
        tw.evaluate(LOOK)
        tw.wait_for_function('tw.b20.connected', timeout=30000); mark('connected')
        tw.wait_for_function("!!tw.b20.told && document.querySelector('#toast.show')", timeout=40000); mark('toast', text=tw.evaluate("document.querySelector('#toast').textContent"))
        time.sleep(3.2)
        # the Pawns menu (P): in a fight it is the turn order
        move(LW + 900, 900, 0.6); key('p'); time.sleep(1.2); mark('pawns-open', order=tw.evaluate('tw.turnOrderText()'))
        time.sleep(1.5)
        # 3. initiative from the sheet -> the turn order
        b = ddb.locator('.ct-combat__summary-group--initiative button').first
        to_el(ddb, b, 1.0); time.sleep(0.4); click(); mark('initiative-click')
        tw.wait_for_function("tw.view().turns?.init?.tok_lolajani01 != null", timeout=20000); mark('initiative-in', n=tw.evaluate('tw.view().turns.init.tok_lolajani01'), order=tw.evaluate('tw.turnOrderText()'))
        time.sleep(2.6)
        # close the Pawns menu (its search field may hold the keys: Escape, then a click on bare ground so the table has them)
        key('Escape'); time.sleep(0.4)
        if 'pawns' in (tw.evaluate('tw.tray.state().open') or []): key('Escape'); time.sleep(0.4)
        g = tw.evaluate("tw.screenOf(17, -4, tw.main, 1)"); ox, oy = origin(tw); move(ox + g['x'], oy + g['y'], 0.6); click(); time.sleep(0.6)
        mark('pawns-closed', open=tw.evaluate('tw.tray.state().open'))
        # 4. the link offer: a button beside the pawn (and a line in the chat)
        ln = tw.locator('#undoChips button:visible', has_text="Link Lola Jani's sheet").first
        if not ln.count(): ln = tw.locator('button.abtn:visible:has-text("Link to Lola Jani")').first
        ln.wait_for(timeout=10000); mark('offer', text=ln.inner_text(), box=ln.bounding_box())
        time.sleep(1.0); to_el(tw, ln, 1.0); time.sleep(0.6); click()
        tw.wait_for_function("!!tw.entities()['tok_lolajani01']?.sheet", timeout=10000); mark('linked')
        time.sleep(2.0)
        # 5. target Goblin 1: pointer over it, T
        pt = tw.evaluate("tw.screenOf(22.5, 10, tw.main, 1)"); ox, oy = origin(tw)
        move(ox + pt['x'], oy + pt['y'] - 25, 1.0); time.sleep(0.4); move(ox + pt['x'] + 2, oy + pt['y'] - 23, 0.1); time.sleep(0.3)
        key('t'); tw.wait_for_function("tw.entities()['tok_lolajani01']?.target === 'tok_goblin0001'", timeout=8000); mark('targeted')
        time.sleep(2.5)
        # 6. the attack from the sheet: open the Greataxe, press Beyond20's own BEYOND 20 button: to hit, then damage, at the target
        row = ddb.locator('.ddbc-combat-attack--item:has-text("Greataxe")').first
        to_el(ddb, row.locator('.ddbc-combat-attack__label').first, 1.1); time.sleep(0.4); click(); mark('greataxe-open')
        rb = ddb.locator('button.ct-beyond20-roll-button').first; rb.wait_for(timeout=8000); time.sleep(1.2)
        n0 = tw.evaluate('tw.view().chat.length')
        to_el(ddb, rb, 0.9); time.sleep(0.5); click(); mark('attack-click')
        tw.wait_for_function(f"tw.view().chat.length >= {n0} + 2", timeout=30000); time.sleep(0.5)
        tw.wait_for_function("!tw.dice.busy()", timeout=20000)
        mark('attack-dice', dice=tw.evaluate("JSON.stringify(tw.dice.info()).slice(0, 1500)"), lola=tw.evaluate("tw.screenOf(10, 12.5, tw.main, 1)"), gob=tw.evaluate("tw.screenOf(22.5, 10, tw.main, 1)"))
        mark('attack-landed', lines=tw.evaluate(f"tw.view().chat.slice({n0}).map(c => c.text + ': ' + (c.roll ? c.roll.expr + ' = ' + c.roll.total : ''))"))
        time.sleep(3.0)
        # 7. Lola takes 5 damage on the sheet -> her pawn's damage
        inp = ddb.locator('input.styles_input__coHiS').first
        to_el(ddb, inp, 1.0); click(); time.sleep(0.2); typ('5', 120); time.sleep(0.4)
        to_el(ddb, ddb.locator('button:has-text("DAMAGE")').first, 0.6); time.sleep(0.3); click(); mark('hp-click')
        tw.wait_for_function("tw.entities()['tok_lolajani01']?.damage === 5", timeout=15000); mark('hp-in')
        time.sleep(1.0)
        # select Lola so her ring shows the damage box and the Attack button
        pt = tw.evaluate("tw.screenOf(10, 12.5, tw.main, 1)")
        move(ox + pt['x'], oy + pt['y'] - 20, 1.0); time.sleep(0.3); click(); time.sleep(1.5); mark('selected')
        time.sleep(3.0)
        atk = tw.locator('.rbtn[data-id="pawn.attack"]').first
        if atk.count():
            to_el(tw, atk, 0.8); time.sleep(0.8); mark('attack-button'); click(); time.sleep(2.5); mark('attack-list', fly=tw.evaluate('JSON.stringify(tw.ringFlyout?.() || null)')[:300])
            time.sleep(2.0); key('Escape'); time.sleep(0.6)
        mark('end'); time.sleep(2.0)
    except Exception:
        try:
            print('DEBUG b20', tw.evaluate("JSON.stringify({seen: tw.b20.seen, log: tw.b20.log.slice(-3)})")[:900])
            print('DEBUG chat', tw.evaluate("JSON.stringify(tw.view().chat.slice(-3).map(c => c.text))"))
            print('DEBUG ddb alerts', ddb.evaluate("[...document.querySelectorAll('.alertify, [role=dialog]')].filter(e => e.offsetParent).map(e => e.innerText.slice(0, 300))"))
            print('DEBUG mouse', mouse())
        except Exception as e: print('debug failed', e)
        raise
    finally:
        ff.stdin.write(b'q'); ff.stdin.flush(); ff.wait(timeout=60)
        json.dump(EV, open(os.path.join(OUT, 'events.json'), 'w'), indent=1)
        # geometry for the edit (window origins on the screen, viewport sizes)
        try:
            geo = {'ddb': ddb.evaluate('[screenX, screenY, outerWidth, outerHeight, innerWidth, innerHeight]'), 'tw': tw.evaluate('[screenX, screenY, outerWidth, outerHeight, innerWidth, innerHeight]')}
            json.dump(geo, open(os.path.join(OUT, 'geo.json'), 'w'))
        except Exception as e: print('geo', e)
        ctx.close()

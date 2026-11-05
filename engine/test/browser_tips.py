#!/usr/bin/env python3
"""The loading screen's tips (Harry 2026-11-02; docs/UI.md "The loading screen", "The tips").

  python3 engine/test/browser_tips.py            (Chromium; TW_BROWSER=firefox for Firefox)
  --only P,G   --shots   TW_PORTS=relay,site (default 18236,18866)

P  the page alone, like browser_version.py: the source index.html at a made-up address, main.js an empty file, so the
   screen stays up as long as a check needs it and every audience can be made by the link. First paint with the
   scripts held back; which set for which seat and screen; the place kept across loads, a blink not counted, the pace,
   the pill and the failures, reduce motion, the room it takes on every screen size, and its contrast.
G  the real game on a local relay (never the live site): a new table's GM, a player's invite in a fresh browser, an AI
   seat's link; then every key a tip names is held to the game's own key table for the seat that reads it, and the
   tips that are not obvious are tried (a ping, the view keys, Space H, "6 goblins", "/r d20", V and W, M and 2, ...).
   The finger's gestures that the phone suite already plays (pinch, twist, tilt, drag a selected thing, placing, the
   bar's Roll d20) are engine/test/browser_handheld.py's; this one tries a held finger, the ring and the Pawns tray.
"""
import argparse, base64, io, json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns made here are throwaways: deleted from the relay when this exits

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE); CLIENT = os.path.join(ENGINE, 'client')
SHOTS = os.path.join(HERE, 'shots')
ap = argparse.ArgumentParser(); ap.add_argument('--only', default=''); ap.add_argument('--shots', action='store_true')
A = ap.parse_args()
ENG = 'firefox' if os.environ.get('TW_BROWSER', '').lower() == 'firefox' else 'chromium'
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18236,18866').split(','))
RELAY = f'http://127.0.0.1:{RP}'; API = 'http://127.0.0.1:8096'
ORIGIN = 'http://turnip.test'
SOURCE = open(os.path.join(CLIENT, 'index.html'), encoding='utf-8').read(); CSS = open(os.path.join(CLIENT, 'style.css'), encoding='utf-8').read()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail != '' else ''}", flush=True)
def want(sec): return not A.only or sec in A.only.split(',')
def b64(o): return base64.urlsafe_b64encode(json.dumps(o, separators=(',', ':')).encode()).decode().rstrip('=')
def token(sc): return b64({'c': 'camp_test', 's': 'seat_test', 'cr': None, 'sc': sc}) + '.not-a-real-signature'  # (the page reads the claims; only the relay checks the signature)
GM_TOK, PLAYER_TOK, AI_TOK = token('gm'), token('player'), token({'areas': '*', 'classes': ['chat']})
JUNK = 'tw1.bogus.token'

# ------------------------------------------------------------------------------------------------ P: the page alone
TIP = "(() => { const s = document.querySelector('#twl .twl-tip > span:last-child'); return s ? s.textContent : null; })()"
STATE = """(() => { const b = document.querySelector('#twl .twl-tip'), cs = getComputedStyle(b); return { set: twLoad.tips && twLoad.tips.set(), role: twLoad.tips && twLoad.tips.role(), tip: twLoad.tip || null,
  text: [...b.children].map(s => s.textContent).pop() || '', shown: cs.display !== 'none' && !b.hidden && !document.getElementById('twl').hidden, aria: b.getAttribute('aria-hidden'), mem: localStorage.getItem('tw.tips') }; })()"""

def part_p(browser):
    def page(link='', vw=1280, vh=800, hold=False, init=None, ctx=None, **kw):
        own = ctx is None
        if own: ctx = browser.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=1, **kw)
        pg = ctx.new_page(); pg.errs = []; pg.held = []
        pg.on('pageerror', lambda e: pg.errs.append(str(e)[:200]))
        if init: pg.add_init_script(init)
        def route(r):
            u = r.request.url
            if u.startswith(ORIGIN + '/engine/client/?') or u.split('#')[0] == ORIGIN + '/engine/client/': return r.fulfill(status=200, content_type='text/html', body=SOURCE.replace('<head>', '<head>\n<base href="/engine/client/">'))
            if hold and ('/style.css' in u or '/main.js' in u or '/phone.js' in u): pg.held.append(r); return None   # never answered
            if '/style.css' in u: return r.fulfill(status=200, content_type='text/css', body=CSS)
            if '/main.js' in u or '/phone.js' in u: return r.fulfill(status=200, content_type='text/javascript', body='')  # no game: the screen stays up
            return r.abort()
        pg.route('**/*', route)
        pg.goto(f'{ORIGIN}/engine/client/?nointro{link}', wait_until='commit'); pg.wait_for_selector('#twl .twl-name', state='visible')
        pg.ctx = ctx; pg.own = own
        return pg
    def done(pg):
        for r in pg.held:
            try: r.abort()
            except Exception: pass
        pg.unroute('**/*')
        if pg.own: pg.ctx.close()
        else: pg.close()
    tips = None

    print('P1. at first paint, with every script and the stylesheet held back')
    pg = page('#s=' + PLAYER_TOK, hold=True)
    st = pg.evaluate(STATE); tips = pg.evaluate('({ T: twLoad.tips.T, SETS: twLoad.tips.SETS, SEEN: twLoad.tips.SEEN_MS, MIN: twLoad.tips.MIN_MS })')
    lone = pg.evaluate("({ words: document.querySelector('.twl-words').textContent, sr: document.querySelector('#twl [aria-live]').textContent, lives: document.querySelectorAll('#twl [aria-live]').length, answered: performance.getEntriesByType('resource').filter(e => /\\.(js|css)(\\?|$)/.test(e.name) && e.responseEnd > 0).length })")
    check(st['shown'] and st['text'] and st['text'] in [strip(tips['T'][i]) for i in tips['SETS']['computer.player']] and len(pg.held) >= 2 and lone['answered'] == 0, 'P1a a tip is on the screen with nothing else arrived: from a player\'s set, read off the link', f"{st['text']!r}; {len(pg.held)} held")
    check(st['aria'] == 'true' and lone['lives'] == 1 and lone['sr'] == 'Turnip Works is loading' and lone['words'] == 'Fetching the game', 'P1b the tip is hidden from the screen reader; the one polite region still says only "Turnip Works is loading"', lone)
    if A.shots and ENG == 'chromium':  # (Playwright's own screenshot waits for the fonts, which wait for the held stylesheet: Chromium is asked directly)
        os.makedirs(SHOTS, exist_ok=True); open(os.path.join(SHOTS, f'tips-{ENG}-first-paint.png'), 'wb').write(base64.b64decode(pg.ctx.new_cdp_session(pg).send('Page.captureScreenshot', {'format': 'png'})['data']))
    done(pg)
    T, SETS = tips['T'], tips['SETS']
    text = lambda i: strip(T[i])

    print('P2. the set for the seat and the screen')
    MOBILE = dict(is_mobile=True, has_touch=True)
    cases = [('a GM\'s link', '#s=' + GM_TOK, {}, None, 'computer.gm'), ('a player\'s link', '#s=' + PLAYER_TOK, {}, None, 'computer.player'),
             ('a link that cannot be read (first visit)', '#s=' + JUNK, {}, None, 'computer.any'),
             ('that link again, the seat remembered as a player (tw.games)', '#s=' + JUNK, {}, [{'campaign': 'c', 'token': JUNK, 'name': 'x', 'seat': 'Pat', 'role': 'player', 'lastUsed': 5}], 'computer.player'),
             ('no link, nothing remembered: the start form (a GM about to start a table)', '', {}, None, 'computer.gm'),
             ('no link: the last game played opens, a player\'s', '', {}, [{'campaign': 'c', 'token': GM_TOK, 'name': 'a', 'seat': 'G', 'role': 'gm', 'lastUsed': 1}, {'campaign': 'd', 'token': PLAYER_TOK, 'name': 'b', 'seat': 'P', 'role': 'player', 'lastUsed': 9}], 'computer.player'),
             ('the games list (#games)', '#games', {}, None, 'computer.any'),
             ('a phone, a player\'s link', '#s=' + PLAYER_TOK, dict(viewport={'width': 390, 'height': 844}, **MOBILE), None, 'touch.player'),
             ('a phone, a GM\'s link', '#s=' + GM_TOK, dict(viewport={'width': 390, 'height': 844}, **MOBILE), None, 'touch.gm'),
             ('a tablet (touch only, a big screen)', '#s=' + PLAYER_TOK, dict(viewport={'width': 1024, 'height': 1366}, **MOBILE), None, 'touch.player'),
             ('?hand=1 on a computer', '&hand=1#s=' + GM_TOK, {}, None, 'touch.gm'), ('?hand=0 on a phone', '&hand=0#s=' + PLAYER_TOK, dict(viewport={'width': 390, 'height': 844}, **MOBILE), None, 'computer.player')]
    for name, link, kw, games, want_set in cases:
        if ENG == 'firefox' and kw.get('is_mobile'): print(f'  NOT VERIFIED in Firefox: {name} (the driver cannot emulate a phone there; ?hand=1 stands for it)'); continue
        vp = kw.pop('viewport', {'width': 1280, 'height': 800}); ctx = browser.new_context(viewport=vp, device_scale_factor=1, **kw)
        pg = page(link, ctx=ctx, init=f"try {{ localStorage.setItem('tw.games', {json.dumps(json.dumps(games))}); }} catch {{}}" if games else None)
        st = pg.evaluate(STATE); done(pg); ctx.close()
        check(st['set'] == want_set and st['shown'] and st['text'] == text(SETS[want_set][0]), f'P2 {name}: {want_set}', f"{st['set']}, {st['text']!r}")
    pg = page('#s=' + AI_TOK); pg.wait_for_timeout(300); st = pg.evaluate(STATE); done(pg)
    check(st['role'] == 'ai' and not st['shown'] and st['text'] == '', 'P2 an AI seat\'s link: no tip at all', st)
    # the table says who this is: the next tip is from that seat's set, and the one showing is not swapped
    pg = page('#s=' + JUNK); a = pg.evaluate(STATE); pg.evaluate("twLoad.seat({ kind: 'human', role: 'player' })"); pg.wait_for_timeout(200); b = pg.evaluate(STATE)
    pg.wait_for_timeout(tips['MIN'] + 600); c = pg.evaluate(STATE)
    check(a['set'] == 'computer.any' and b['text'] == a['text'] and c['set'] == 'computer.player' and c['text'] in [text(i) for i in SETS['computer.player']] and c['text'] != a['text'], 'P2 the table answers "a player": the tip showing stays, the next one is from the player\'s set', [a['text'], b['text'], c['text']])
    pg.evaluate("twLoad.seat({ kind: 'llm', role: 'gm' })"); pg.wait_for_timeout(100); d = pg.evaluate(STATE); done(pg)
    check(not d['shown'], 'P2 and an AI seat, told by the table: the tip goes', d)
    for dev in ('computer', 'touch'):
        both = set(SETS[f'{dev}.gm']) & set(SETS[f'{dev}.player'])
        check(set(SETS[f'{dev}.any']) <= both, f'P2 every {dev} tip for "any seat" is in both the GM\'s and the player\'s sets', sorted(set(SETS[f'{dev}.any']) - both))
    for s, ids in SETS.items():
        check(all(i in T for i in ids) and len(ids) == len(set(ids)) and (4 <= len(ids) <= 13), f'P2 set {s}: {len(ids)} tips, each written once', [i for i in ids if i not in T])

    print('P3. across sign-ins: the place is kept, the list wraps, a blink does not count')
    ctx = browser.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
    ids = SETS['computer.gm']; seen = []
    for n in range(len(ids) + 2):
        pg = page('#s=' + GM_TOK, ctx=ctx); seen.append(pg.evaluate(STATE)['text']); pg.wait_for_timeout(tips['SEEN'] + 250); done(pg)
    check(seen == [text(ids[n % len(ids)]) for n in range(len(ids) + 2)], f'P3a {len(ids) + 2} loads that each stayed {tips["SEEN"] + 250} ms: the whole list in order, then it starts again', [s[:24] for s in seen])
    pg = page('#s=' + GM_TOK, ctx=ctx); a = pg.evaluate(STATE)['text']; pg.wait_for_timeout(700); done(pg)
    pg = page('#s=' + GM_TOK, ctx=ctx); b = pg.evaluate(STATE)['text']; pg.wait_for_timeout(tips['SEEN'] - 500); done(pg)
    pg = page('#s=' + GM_TOK, ctx=ctx); c = pg.evaluate(STATE); done(pg)
    check(a == b == c['text'] == text(ids[2 % len(ids)]), f'P3b loads of 0.7 s and {(tips["SEEN"] - 500) / 1000} s (under {tips["SEEN"] / 1000} s) do not count: the same tip comes back', [a[:24], b[:24], c['text'][:24]])
    pg = page('#s=' + PLAYER_TOK, ctx=ctx); d = pg.evaluate(STATE); done(pg)
    check(d['text'] == text(SETS['computer.player'][0]), 'P3c each set keeps its own place: the player\'s starts at its first', d['text'])
    check(json.loads(c['mem']).keys() >= {'computer.gm'} and not any(t in (c['mem'] or '') for t in (GM_TOK, PLAYER_TOK)), 'P3d what is kept is a number per set, and no seat link', c['mem'])
    ctx.close()
    # a page in a background tab: the tip is not counted (nobody saw it)
    pg = page('#s=' + GM_TOK, init="Object.defineProperty(document, 'hidden', { get: () => true });"); pg.wait_for_timeout(tips['SEEN'] + 300); m = pg.evaluate("localStorage.getItem('tw.tips')"); done(pg)
    check(m in (None, '{}'), 'P3e a page that is not in view does not count its tip as seen', m)

    print('P4. the pace: one tip at a time, slow enough to read, longer for a long one')
    pg = page('#s=' + PLAYER_TOK, init="window.__tips = []; setInterval(() => { const s = document.querySelector('#twl .twl-tip > span:last-child'); if (s && __tips[__tips.length - 1]?.[1] !== s.textContent) __tips.push([performance.now(), s.textContent]); }, 20);")
    pg.wait_for_timeout(15500)
    log = pg.evaluate('__tips'); anims = pg.evaluate("[...document.querySelectorAll('#twl .twl-tip > span')].flatMap(s => s.getAnimations()).map(a => Object.keys(a.effect.getKeyframes()[0]).filter(k => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)))")
    held = [round(b[0] - a[0]) for a, b in zip(log, log[1:])]; want_ms = [pg.evaluate(f"twLoad.tips.readMs(twLoad.tips.T[{json.dumps(i)}])") for i in SETS['computer.player'][:len(held)]]
    check(len(log) >= 3 and all(w - 150 <= h <= w + 400 for h, w in zip(held, want_ms)) and min(held) >= tips['MIN'] - 150, f'P4a on a 15 s load the tips change by themselves, each up for its reading time (at least {tips["MIN"] / 1000} s)', f'held {held} ms, wanted {want_ms}')
    lens = {i: len(text(i)) for i in T}; long_i, short_i = max(lens, key=lens.get), min(lens, key=lens.get)
    lm, sm = (pg.evaluate(f"twLoad.tips.readMs(twLoad.tips.T[{json.dumps(i)}])") for i in (long_i, short_i))
    check(lm > sm >= tips['MIN'], 'P4b the longest tip stays longer than the shortest', f'{long_i} ({lens[long_i]} letters) {lm} ms, {short_i} ({lens[short_i]}) {sm} ms')
    check(all(set(k) <= {'opacity'} for k in anims), 'P4c the crossfade moves only opacity', anims)
    done(pg)

    print('P5. only the full screen: never the pill, never a failure; travelling has one')
    pg = page('#s=' + GM_TOK)
    pg.evaluate("twLoad.off(); twLoad.wait('net', 'The table is reconnecting…')"); pg.wait_for_selector('#twl.pill', state='visible'); a = pg.evaluate(STATE); t0 = pg.evaluate('twLoad.tip.at')
    pg.wait_for_timeout(tips['MIN'] + 500); t1 = pg.evaluate('twLoad.tip.at')
    check(not a['shown'] and t0 == t1, 'P5a the reconnecting pill: no tip, and none turning over unseen', a['shown'])
    pg.evaluate("twLoad.clear('net'); twLoad.wait('travel', 'Travelling to the cellar')"); pg.wait_for_function("twLoad.mode === 'travel' && twLoad.shown()", timeout=3000); b = pg.evaluate(STATE)
    check(b['shown'] and b['text'], 'P5b travelling: the full screen, with a tip', b['text'])
    for kind in ('relay', 'code', 'denied', 'slow'):
        pg.evaluate(f"twLoad.fail('{kind}', 'x'.repeat(300))"); c = pg.evaluate(STATE); t0 = pg.evaluate('twLoad.tip.at')
        check(not c['shown'], f'P5c a failure ({kind}): no tip, the sentence and the button have the room', c['shown'])
        pg.evaluate(f"twLoad.mend('{kind}')")
    pg.wait_for_timeout(100); d = pg.evaluate(STATE)
    check(d['shown'], 'P5d it answered after all: the tip is back', d['shown'])
    done(pg)

    print('P6. reduce motion: a plain swap, no crossfade')
    for how, kw, init in (('the browser', {'reduced_motion': 'reduce'}, None), ('Settings ▸ Me', {}, "try { localStorage.setItem('tw.prefs', JSON.stringify({ reducedMotion: true })); } catch {}")):
        ctx = browser.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1, **kw)
        pg = page('#s=' + PLAYER_TOK, ctx=ctx, init=(init or '') + "window.__a = 0; const _an = Element.prototype.animate; Element.prototype.animate = function (...x) { if (this.parentElement?.classList?.contains('twl-tip')) __a++; return _an.apply(this, x); };")
        a = pg.evaluate(STATE)['text']; pg.wait_for_timeout(tips['MIN'] + 900); b = pg.evaluate(STATE); n = pg.evaluate('({ a: __a, spans: document.querySelectorAll("#twl .twl-tip > span").length })')
        check(a != b['text'] and n['a'] == 0 and n['spans'] == 1, f'P6 reduce motion ({how}): the next tip simply replaces the last', n)
        done(pg); ctx.close()

    print('P7. the room it takes: every tip on every screen, no sideways scroll, nothing jumps')
    FIT = """(ids) => { const box = document.querySelector('#twl .twl-tip'), T = twLoad.tips.T, out = [], q = (s) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
      const shown = getComputedStyle(box).display !== 'none', bar0 = q('#twl .twl-bar'), keep = [...box.childNodes];
      for (const id of ids) { const s = document.createElement('span'); twLoad.tips.draw(s, T[id]); box.replaceChildren(s); const r = s.getBoundingClientRect(), b = box.getBoundingClientRect(); out.push([id, Math.round(r.height), Math.round(b.height), Math.round(r.left), Math.round(r.right), s.scrollWidth > s.clientWidth + 1]); }
      box.replaceChildren(...keep);
      return { shown, out, bar0, bar1: q('#twl .twl-bar'), box: q('#twl .twl-tip'), words: q('#twl .twl-words'), ver: q('#twl-ver'), mark: q('#twl .twl-mark'), W: innerWidth, H: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }; }"""
    every = list(T)
    for name, vw, vh, hand, show in (('desktop', 1280, 800, False, True), ('small desktop', 1024, 600, False, True), ('a short window', 1280, 520, False, True),
                                     ('phone', 390, 844, True, True), ('small phone', 320, 568, True, True), ('phone on its side', 667, 375, True, True),
                                     ('another on its side', 740, 360, True, True), ('a small one on its side', 568, 320, True, True), ('too short for a tip', 640, 290, True, False), ('a tablet', 1024, 1366, True, True)):
        pg = page('&hand=1#s=' + PLAYER_TOK if hand else '#s=' + PLAYER_TOK, vw=vw, vh=vh)
        f = pg.evaluate(FIT, every)
        if not show:
            check(not f['shown'] and f['sw'] <= f['W'], f'P7 {name} ({vw}×{vh}): the tip gives way, as the version line does on a failure', f['shown']); done(pg); continue
        tall = [o for o in f['out'] if o[1] > o[2] + 1]; wide = [o for o in f['out'] if o[3] < 0 or o[4] > vw or o[5] or abs((o[3] + o[4]) / 2 - vw / 2) > 2]  # (and centred)
        clear = f['ver'] is None or f['box'][3] + 4 <= f['ver'][1]
        check(f['shown'] and not tall and not wide and f['sw'] <= f['W'], f'P7 {name} ({vw}×{vh}): all {len(every)} tips fit the box ({f["out"][0][2]} px tall) and the screen', {'too tall': tall[:3], 'too wide': wide[:3], 'scrollWidth': f['sw']})
        check(f['bar0'] == f['bar1'] and clear and f['box'][1] >= f['words'][3] and f['mark'][1] >= 0, f'P7 {name}: the bar does not move as tips change, and the tip is clear of the words and the version line', {'box': f['box'], 'ver': f['ver'], 'words': f['words']})
        if A.shots: open(os.path.join(SHOTS, f'tips-{ENG}-{vw}x{vh}.png'), 'wb').write(pg.screenshot())
        done(pg)

    print('P8. contrast, measured in the picture')
    for name, vw, vh, hand in (('desktop', 1280, 800, False), ('phone', 390, 844, True), ('phone on its side', 667, 375, True)):
        pg = page('&hand=1#s=' + PLAYER_TOK if hand else '#s=' + PLAYER_TOK, vw=vw, vh=vh)
        bx = pg.evaluate("(() => { const r = document.querySelector('#twl .twl-tip').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()")
        pg.evaluate("document.querySelectorAll('#twl .twl-tip > span').forEach(s => s.style.visibility = 'hidden'); document.querySelector('#twl .twl-mark').style.animation = 'none'")  # (the words hidden; what is behind them, the tip's own shade included, kept); pg.wait_for_timeout(100)
        bg = pg.screenshot(clip={'x': bx[0], 'y': bx[1], 'width': bx[2] - bx[0], 'height': bx[3] - bx[1]})
        from PIL import Image
        import numpy as np
        im = np.asarray(Image.open(io.BytesIO(bg)).convert('RGB')).astype(float) / 255
        lin = np.where(im <= 0.04045, im / 12.92, ((im + 0.055) / 1.055) ** 2.4); L = (lin @ np.array([0.2126, 0.7152, 0.0722]))
        ink = pg.evaluate("getComputedStyle(document.querySelector('#twl .twl-tip')).color")
        rgb = [int(v) / 255 for v in re.findall(r'[\d.]+', ink)[:3]]; li = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]; Li = 0.2126 * li[0] + 0.7152 * li[1] + 0.0722 * li[2]
        worst = (Li + 0.05) / (float(L.max()) + 0.05)
        check(worst >= 7, f'P8 {name}: the tip\'s words against the lightest part of the screen behind them: at least 7 to 1', f'{worst:.1f} to 1 ({ink})')
        done(pg)

    print('P9. the load is untouched by it')
    pg = page('#s=' + GM_TOK)
    left = pg.evaluate("() => new Promise(done => { twLoad.at('code'); twLoad.at('look'); twLoad.at('welcome', 'k'); twLoad.at('state'); const t = performance.now(); twLoad.done(); const iv = setInterval(() => { if (document.getElementById('twl').hidden) { clearInterval(iv); done({ ms: Math.round(performance.now() - t), shown: twLoad.shown() }); } }, 10); })")
    check(not left['shown'] and left['ms'] <= 450, 'P9a told to leave with a tip up, the screen leaves on its own 0.2 s fade', left)
    done(pg)
    # the tips' script failing outright leaves the loading screen exactly as it was
    pg = page('#s=' + GM_TOK, init="window.MutationObserver = undefined;")
    st = pg.evaluate("({ words: twLoad.words, text: document.querySelector('#twl .twl-tip').textContent, name: document.querySelector('.twl-name').textContent, errs: 0 })")
    left = pg.evaluate("() => { twLoad.at('code'); twLoad.at('look'); twLoad.at('welcome', 'k'); twLoad.at('state'); twLoad.done(); return !!twLoad.left; }")
    check(st['words'] == ['Fetching the game'] and st['text'] == '' and left and any('MutationObserver' in e for e in pg.errs), 'P9b if the tips\' script breaks, the tip is blank and the screen loads and leaves as before', {**st, 'errs': pg.errs[:1]})
    done(pg)
    return tips

def strip(t): return re.sub(r'\{([^}]+)\}', r'\1', t)

# ------------------------------------------------------------------------------------------------ G: the real game
def start_local():
    for port in (RP, SP):
        with socket.socket() as so:
            so.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try: so.bind(('127.0.0.1', port))
            except OSError: sys.exit(f'port {port} is in use (a stale test server?): stop it first')
    data = tempfile.mkdtemp(prefix='tw-tips-'); site = tempfile.mkdtemp(prefix='tw-tips-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=open(os.path.join(data, 'relay.log'), 'a'), stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for url in (f'{RELAY}/health', f'http://127.0.0.1:{SP}/engine/client/index.html'):
        for _ in range(150):
            time.sleep(0.1)
            try: urllib.request.urlopen(url, timeout=1); break
            except Exception: pass
def stop():
    for pr in procs:
        try: pr.terminate(); pr.wait(5)
        except Exception:
            try: pr.kill()
            except Exception: pass
    for d in tmp: shutil.rmtree(d, ignore_errors=True)


GPU = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']
UA = {'User-Agent': 'Mozilla/5.0 tw-tips-test'}
def get(url): return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read())
INN = [('common', 0, 0, 6, 5), ('kitchen', 6, 0, 4, 5), ('guest', 0, 5, 5, 4)]
# keys a tip names that are not in the command registry: each is tried below, for the seat whose tips name it
ELSEWHERE = {'alt': 'Alt+click pings, Alt+drag turns the view (input.js)', 'q': 'turn the view (input.js RATE)', 'e': 'turn the view (input.js RATE)',
             'w': 'walk in first person (surfaces/fpv.js)', 'a': 'walk in first person', 'd': 'walk in first person', 'space': 'the chords (surfaces/keys.js)', 'h': 'Space H, the chord',
             'pageup': 'tilt (input.js RATE)', 'pagedown': 'tilt (input.js RATE)'}
KEYS = r"""(ids) => { const R = tw.registry, T = twLoad.tips.T, ctx = R.ctx(), map = R.keymap('default'), out = [];
  for (const id of ids) { const re = /\{([^}]+)\}(?:\+\{([^}]+)\})?/g; let m;
    while ((m = re.exec(T[id]))) { const k = m[2] ? `${m[1] === 'Ctrl' ? 'mod' : m[1].toLowerCase()}+${m[2].toLowerCase()}` : m[1].toLowerCase();
      const cmds = map.get(k) || []; out.push({ id, key: k, cmds: cmds.map(c => c.id), mine: cmds.filter(c => R.permitted(c, ctx)).map(c => c.id) }); } }
  return out; }"""

def part_g(browser, tips):
    T, SETS = tips['T'], tips['SETS']
    base = f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(RELAY) + '&nointro&faces=1500'
    def tab(link='', vw=1280, vh=800, ctx=None, init=None, **kw):
        ctx = ctx or browser.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=1, **kw)
        pg = ctx.new_page(); pg.set_default_timeout(90000); pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)[:200]))
        pg.add_init_script("window.__tipLog = []; setInterval(() => { const L = window.twLoad, s = document.querySelector('#twl .twl-tip > span:last-child'), b = document.querySelector('#twl .twl-tip'); if (!L || !b) return; const v = [L.tips?.set?.() || null, b.hidden || getComputedStyle(b).display === 'none' || document.getElementById('twl').hidden ? null : s?.textContent || '']; const z = __tipLog[__tipLog.length - 1]; if (!z || z[1] !== v[0] || z[2] !== v[1]) __tipLog.push([Math.round(performance.now()), ...v]); }, 15);")
        if init: pg.add_init_script(init)
        tw_sandbox.proxy(pg, API)
        pg.goto(base + link, wait_until='commit'); pg.ctx = ctx
        return pg
    ready = lambda pg: pg.wait_for_function('window.tw && tw.ready && tw.ready() && !!twLoad.left && document.getElementById("twl").hidden', timeout=120000)
    def waitfor(pg, js, ms=15000):
        try: pg.wait_for_function(js, timeout=ms); return True
        except Exception: return False
    def settle(pg): pg.wait_for_function('tw.sync.pendingCount() === 0', timeout=30000); pg.wait_for_timeout(250)

    print('G1. a new table from the start form: a GM\'s tips throughout')
    gm = tab(); gm.wait_for_selector('#newCampaign button', state='visible')
    gm.fill('#newCampaign input[name=name]', 'TEST tips (throwaway)'); gm.click('#newCampaign button'); ready(gm)
    log = gm.evaluate('__tipLog'); sets = {l[1] for l in log if l[2]}
    check(sets == {'computer.gm'} and any(l[2] for l in log), 'G1 the screen before the form and after "Start a campaign": only the GM\'s computer set', sorted(sets))
    gtok = gm.evaluate("decodeURIComponent(location.hash.slice(3))"); camp = gm.evaluate('tw.sync.campaign.id'); area = gm.evaluate('tw.area()')
    for i, (t, x, z, w, d) in enumerate(INN): get(f"{RELAY}/c/{camp}/a/{area}/do?" + urllib.parse.urlencode({'cmd': 'room.spawn', 'type': t, 'x': (x - 4) * 5, 'z': (z - 4) * 5, 'w': w * 5, 'd': d * 5, 'seed': 7100 + i, 'nonce': f't{i}', 'seat': gtok}))
    settle(gm)
    ptok = gm.evaluate("tw.createSeat({ kind: 'human', role: 'player', name: 'Pat', color: '#33aa77' })")
    atok = gm.evaluate("tw.createSeat({ kind: 'llm', name: 'assistant', color: '#b48cff', scope: { areas: '*', classes: ['chat', 'token.move'] } })")
    settle(gm)
    psid = json.loads(base64.urlsafe_b64decode(ptok.split('.')[0] + '==='))['s']
    if not gm.evaluate(f"Object.values(tw.entities()).some(e => e.kind === 'token' && e.owner === '{psid}')"):  # (no placeholder came: give Pat a pawn of their own, as a GM would)
        gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_pattips', name: 'Pat', x: -12.5, z: -12.5, owner: '{psid}', main: true }})"); settle(gm)

    print('G2. a player\'s invite, opened in a browser that has never seen it')
    pl = tab('#s=' + urllib.parse.quote(ptok)); pl.wait_for_selector('#twl .twl-name', state='visible'); first = pl.evaluate('__tipLog.find(l => l[2])')
    ready(pl); log = pl.evaluate('__tipLog'); sets = {l[1] for l in log if l[2]}
    check(first and first[1] == 'computer.player' and first[2] == strip(T[SETS['computer.player'][0]]), 'G2a at first paint: the player\'s set, read off the link (no visit before)', first)
    check(sets == {'computer.player'} and pl.evaluate("twLoad.tips.role()") == 'player', 'G2b and only that, to the end of the load', sorted(sets))
    check(pl.evaluate("JSON.parse(localStorage.getItem('tw.games'))[0].role") == 'player', 'G2c the browser remembers the seat as a player\'s (tw.games, for a link it could not read)')
    print('G3. an AI seat\'s link opened in a browser')
    ai = tab('#s=' + urllib.parse.quote(atok)); ready(ai); log = ai.evaluate('__tipLog')
    check(not any(l[2] for l in log) and ai.evaluate("twLoad.tips.role()") == 'ai', 'G3 never a tip, from first paint to the table', log[:3]); ai.ctx.close()

    print('G4. every key a tip names is a key of the game, for the seat that reads it')
    for who, pg, sid in (('GM', gm, 'computer.gm'), ('player', pl, 'computer.player')):
        rows = pg.evaluate(KEYS, SETS[sid])
        bad = [r for r in rows if not r['mine'] and r['key'] not in ELSEWHERE]
        check(rows and not bad, f'G4 the {who}\'s tips name {len(rows)} keys: each runs a command this seat may use, or is one of the keys tried below', bad[:4])
        gmonly = [r for r in rows if r['cmds'] and not r['mine']]
        check(not gmonly, f'G4 no tip for the {who} names a key that seat cannot use', gmonly[:3])
    prow = pl.evaluate(KEYS, SETS['computer.gm']); refused = sorted({r['key'] for r in prow if r['cmds'] and not r['mine']})
    check({'b', 'x'} <= set(refused), 'G4 (and the test can tell: the GM\'s B and X are refused to the player\'s seat)', refused)
    named = {r['key'] for s in ('computer.gm', 'computer.player') for r in (gm if s == 'computer.gm' else pl).evaluate(KEYS, SETS[s])}
    check(named & set(ELSEWHERE) == {k for k in ELSEWHERE if k in named}, 'G4 keys outside the registry, each tried below', sorted(named & set(ELSEWHERE)))
    # the bar's words the tips name: each is a command this seat's bar takes
    WORDS = r"""(texts) => { const R = tw.registry, ctx = R.ctx(); return texts.map(t => [t, R.all().filter(c => c.parse && R.permitted(c, ctx)).filter(c => { try { return !!c.parse(t, ctx); } catch { return false; } }).map(c => c.id)]); }"""
    for who, pg, words in (('GM', gm, ['/r d20', 'say hello', 'invite Sam']), ('player', pl, ['/r d20', 'say hello'])):  # ("6 goblins" is the bar's figure search, not a command's words: tried in G5)
        got = pg.evaluate(WORDS, words); check(all(ids for _, ids in got), f'G4 the {who}\'s bar takes the words the tips use', got)
    check(not [i for _, i in pl.evaluate(WORDS, ['invite Sam']) if i], 'G4 a player\'s bar does not take "invite" (that tip is the GM\'s)')

    print('G5. the GM\'s tips, tried')
    cv = lambda pg: pg.evaluate("(() => { const r = document.getElementById('c').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
    pose = lambda pg: pg.evaluate("tw.main.pose()")
    def key(pg, k, ms=0):
        if ms: pg.keyboard.down(k); pg.wait_for_timeout(ms); pg.keyboard.up(k)
        else: pg.keyboard.press(k)
        pg.wait_for_timeout(150)
    def bar(pg, text):
        pg.mouse.click(*cv(pg)); pg.keyboard.press('Escape'); pg.keyboard.press('/'); pg.wait_for_timeout(150); pg.keyboard.type(text, delay=10); pg.wait_for_timeout(350); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    gm.evaluate("tw.frameAll?.() || tw.resetView()"); gm.wait_for_timeout(500); x, y = cv(gm)
    key(gm, 'b'); check(gm.evaluate("!!tw.build?.isOpen || !document.getElementById('buildMenu').hidden"), 'G5 B opens Build'); key(gm, 'Escape')
    gm.keyboard.press('Escape'); key(gm, '?'); sh = gm.evaluate("({ up: !document.getElementById('sheet').hidden, t: document.getElementById('sheet').textContent })")
    check(sh['up'] and 'Mouse and touch' in sh['t'] and 'Trackpad' in sh['t'], 'G5 ? shows the keys, the mouse moves and the trackpad\'s'); key(gm, 'Escape')
    p0 = pose(gm); gm.mouse.move(x, y); gm.mouse.wheel(0, -120); gm.wait_for_timeout(400); p1 = pose(gm)
    check(p1['dist'] < p0['dist'] - 0.5, 'G5 the mouse wheel zooms', f"{p0['dist']:.1f} -> {p1['dist']:.1f}")
    gm.mouse.move(x, y); gm.mouse.down(button='right'); gm.mouse.move(x + 120, y + 60, steps=8); gm.mouse.up(button='right'); gm.wait_for_timeout(300); p2 = pose(gm)
    check(abs(p2['focus'][0] - p1['focus'][0]) + abs(p2['focus'][2] - p1['focus'][2]) > 1 and abs(p2['dist'] - p1['dist']) < 0.5, 'G5 a right-button drag pans', [p1['focus'], p2['focus']])
    gm.evaluate(f"(() => {{ const c = document.getElementById('c'); for (let i = 0; i < 12; i++) c.dispatchEvent(new WheelEvent('wheel', {{ deltaX: 2.5, deltaY: 6.25, deltaMode: 0, clientX: {x}, clientY: {y}, bubbles: true, cancelable: true }})); }})()"); gm.wait_for_timeout(300); p3 = pose(gm)
    check(abs(p3['focus'][0] - p2['focus'][0]) + abs(p3['focus'][2] - p2['focus'][2]) > 0.3 and abs(p3['dist'] - p2['dist']) < 0.3, 'G5 a trackpad\'s two-finger scroll pans', [p2['focus'], p3['focus'], p2['dist'], p3['dist']])
    gm.evaluate(f"(() => {{ const c = document.getElementById('c'); for (let i = 0; i < 10; i++) c.dispatchEvent(new WheelEvent('wheel', {{ deltaY: -4.5, deltaMode: 0, ctrlKey: true, clientX: {x}, clientY: {y}, bubbles: true, cancelable: true }})); }})()"); gm.wait_for_timeout(300); p4 = pose(gm)
    check(p4['dist'] < p3['dist'] - 0.3, 'G5 a pinch zooms', f"{p3['dist']:.1f} -> {p4['dist']:.1f}")
    gm.evaluate('tw.lastPing = null'); gm.mouse.move(x, y); gm.mouse.down(); gm.wait_for_timeout(700); gm.mouse.up(); gm.wait_for_timeout(150)
    check(gm.evaluate('!!tw.lastPing && tw.sel.size === 0'), 'G5 holding the mouse button still for half a second pings (and selects nothing)', gm.evaluate('tw.lastPing'))
    gm.wait_for_timeout(700); gm.evaluate('tw.lastPing = null'); gm.keyboard.down('Alt'); gm.mouse.click(x + 30, y + 10); gm.keyboard.up('Alt'); gm.wait_for_timeout(150)  # (the wait: one ping per 600 ms from a seat)
    check(gm.evaluate('!!tw.lastPing'), 'G5 Alt+click pings at once', gm.evaluate("({ now: performance.now(), sel: [...tw.sel], mode: tw.mode?.kind || null, touch: tw.touchState() })"))
    p5 = pose(gm); gm.mouse.move(x, y); gm.keyboard.down('Alt'); gm.mouse.down(); gm.mouse.move(x + 140, y + 50, steps=10); gm.mouse.up(); gm.keyboard.up('Alt'); gm.wait_for_timeout(300); p6 = pose(gm)
    check(abs(p6['yaw'] - p5['yaw']) > 0.1 and abs(p6['pitch'] - p5['pitch']) > 0.02, 'G5 Alt and drag turns and tilts the view', {k: [round(p5[k], 3), round(p6[k], 3)] for k in ('yaw', 'pitch')})
    for k in ('q', 'e', 'PageUp', 'PageDown'):
        a = pose(gm); key(gm, k, 400); b = pose(gm); f = 'yaw' if k in ('q', 'e') else 'pitch'
        check(abs(b[f] - a[f]) > 0.05, f'G5 {k} (held) changes the view\'s {"turn" if f == "yaw" else "tilt"}', f'{a[f]:.3f} -> {b[f]:.3f}')
    bar(gm, '/r d20'); check(waitfor(gm, "tw.applied.some(a => a[3] === 'dice.roll')"), 'G5 "/r d20" in the command bar rolls (GM)')
    room = gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'room').id"); gm.evaluate(f"tw.select('{room}')"); gm.wait_for_timeout(200)
    gm.keyboard.press('Space'); gm.wait_for_timeout(200); hint = gm.evaluate("!document.getElementById('whichkey').hidden"); gm.keyboard.press('h'); settle(gm)
    check(hint and gm.evaluate(f"!!tw.entities()['{room}'].hidden"), 'G5 a room selected, Space then H hides it from players', hint)
    gm.evaluate(f"tw.select('{room}')"); gm.keyboard.press('Space'); gm.wait_for_timeout(150); gm.keyboard.press('h'); settle(gm)
    n0 = gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').length")
    bar(gm, '6 goblins'); placing = gm.evaluate("tw.mode?.kind || null"); gm.mouse.click(x, y); settle(gm); gm.wait_for_timeout(500)
    n1 = gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').length"); gm.keyboard.press('Escape')
    check(placing and n1 - n0 == 6, 'G5 "6 goblins", then a click on the map, sets down six', f'{placing}; {n0} -> {n1} pawns')
    bar(gm, 'invite Sam'); gm.wait_for_function("tw.sync.campaign.seats.some(s => s.name === 'Sam')", timeout=10000); gm.keyboard.press('Escape')
    check(True, 'G5 "invite Sam" makes Sam\'s seat and link')
    lv = gm.evaluate('tw.level || 0'); key(gm, ']'); lv1 = gm.evaluate('tw.level || 0'); key(gm, '['); lv2 = gm.evaluate('tw.level || 0'); c0 = gm.evaluate('tw.cut?.y ?? null'); key(gm, '\\'); c1 = gm.evaluate('tw.cut?.y ?? null')
    check(lv1 > lv and lv2 == lv and c0 != c1, 'G5 ] and [ go up and down a level, \\ switches between this level and all of them', [lv, lv1, lv2, c0, c1]); key(gm, '\\')
    gm.mouse.click(x, y); gm.keyboard.press('Escape'); key(gm, 'x'); check(gm.evaluate('tw.xrayInfo().on'), 'G5 X: every pawn through the walls, on this screen'); key(gm, 'x')

    print('G6. the player\'s tips, tried')
    me = pl.evaluate('tw.me()'); pawn = pl.evaluate(f"Object.values(tw.entities()).find(e => e.kind === 'token' && e.owner === '{me}')?.id")
    check(pawn, 'G6 the player has a pawn of their own to try them with', pawn or pl.evaluate("[tw.me(), Object.values(tw.entities()).filter(e => e.kind === 'token').map(e => [e.id, e.owner, e.name])]"))
    x, y = cv(pl)
    pl.evaluate(f"tw.select('{pawn}')"); a = pl.evaluate(f"tw.entities()['{pawn}']"); key(pl, 'ArrowRight'); settle(pl); b = pl.evaluate(f"tw.entities()['{pawn}']")
    check(abs(abs(b['x'] - a['x']) + abs(b['z'] - a['z']) - 5) < 0.6, 'G6 the pawn selected, an arrow key moves it one square', [a['x'], a['z'], b['x'], b['z']])
    sp = pl.evaluate(f"(() => {{ const e = tw.entities()['{pawn}'], v = new tw.THREE.Vector3(e.x, (e.y || 0) + 1, e.z).project(tw.main.camera), r = document.getElementById('c').getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }})()")
    pl.mouse.move(*sp); pl.mouse.down(); pl.mouse.move(sp[0] + 60, sp[1] + 20, steps=10); pl.mouse.up(); settle(pl); c = pl.evaluate(f"tw.entities()['{pawn}']")
    check(abs(c['x'] - b['x']) + abs(c['z'] - b['z']) > 1, 'G6 dragging their pawn moves it', [b['x'], b['z'], c['x'], c['z']])
    pl.mouse.click(x + 200, y + 150); pl.keyboard.press('Escape'); bar(pl, '/r d20'); check(waitfor(pl, "tw.applied.some(a => a[3] === 'dice.roll')"), 'G6 "/r d20" in the command bar rolls (player)')
    bar(pl, 'say hello from the tips test'); check(waitfor(pl, "tw.applied.some(a => a[3] === 'chat.say')"), 'G6 "say" and the words talk to the table')
    pl.keyboard.press('Escape'); pl.evaluate('tw.clearSelection()'); key(pl, 'v'); fp = pl.evaluate('tw.fpv.info()')
    check(fp and fp['id'] == pawn, 'G6 V, nothing selected: through the player\'s own pawn\'s eyes', fp and fp['id'])
    moved = []
    for k in ('w', 'a', 's', 'd'):
        e0 = pl.evaluate('tw.fpv.info().eye'); key(pl, k, 450); pl.wait_for_timeout(150); e1 = pl.evaluate('tw.fpv.info().eye'); moved.append(round(abs(e1[0] - e0[0]) + abs(e1[2] - e0[2]), 2))
    check(all(m > 0.5 for m in moved), 'G6 W A S D walk (each held a moment)', moved)
    key(pl, 'v'); check(not pl.evaluate('tw.fpv.info()'), 'G6 V again comes back to the map')
    key(pl, 'm'); pl.mouse.move(x - 80, y); pl.mouse.down(); pl.mouse.move(x + 80, y + 30, steps=8); pl.mouse.up(); pl.wait_for_timeout(200); key(pl, '2'); r = pl.evaluate('tw.rulers.state()')
    check(r['live'] and r['live']['k'] == 'cone', 'G6 M and a drag measures; 2 makes it a cone', r['live'] and r['live']['k']); pl.keyboard.press('Escape'); pl.keyboard.press('Escape')
    pl.evaluate(f"tw.select('{pawn}')"); d0 = pl.evaluate(f"tw.entities()['{pawn}'].damage || 0"); key(pl, '='); settle(pl); d1 = pl.evaluate(f"tw.entities()['{pawn}'].damage || 0"); key(pl, '-'); settle(pl); d2 = pl.evaluate(f"tw.entities()['{pawn}'].damage || 0")
    check(d1 == d0 + 1 and d2 == d0, 'G6 = adds a point of damage, - takes one off', [d0, d1, d2])
    # the doors the rooms make (in their walls), selected and O, as a player: it opens
    gk = pl.evaluate("(() => { for (const e of tw.worldOf(tw.area()).edges.values()) if (e.kind === 'door' && !e.open && tw.canOpen(tw.wallItem('wall:' + e.key))) return e.key; return null; })()")
    if gk:
        pl.evaluate(f"tw.select('wall:{gk}')"); pl.wait_for_timeout(150); key(pl, 'o'); settle(pl)
        check(waitfor(pl, f"Object.values(tw.entities()).some(e => e.kind === 'object' && e.fromEdge === '{gk}' && e.open)"), 'G6 a door in a wall selected, O opens it (a player)', gk)
    else: check(False, 'G6 a door in a wall a player may open: none in the inn')
    door = pl.evaluate("Object.values(tw.entities()).find(e => e.kind === 'object' && tw.canOpen(e) && !e.fromEdge)?.id")
    if door:
        o0 = pl.evaluate(f"!!tw.entities()['{door}'].open"); pl.evaluate(f"tw.select('{door}')"); key(pl, 'o'); settle(pl); o1 = pl.evaluate(f"!!tw.entities()['{door}'].open")
        check(o1 != o0, 'G6 a door (or chest) selected, O opens or closes it', [door, o0, o1]); key(pl, 'o'); settle(pl)
    else: check(False, 'G6 a door to open: the inn has none a player may open')
    pl.keyboard.press('Escape'); key(pl, 's'); pl.wait_for_timeout(300)
    up = pl.evaluate("!!document.querySelector('.scat[data-sec=me]')?.getClientRects().length"); pl.click('.scat[data-sec=me]'); pl.wait_for_timeout(300)
    pane = pl.evaluate("document.querySelector('.spane')?.textContent || ''"); check(up and 'My pawns' in pane, 'G6 S opens Settings, and Me has My pawns', [up, pane[:80]]); pl.keyboard.press('Escape')
    check(not gm.errs and not pl.errs, 'G6 no page errors', (gm.errs + pl.errs)[:3])
    pl.ctx.close(); gm.ctx.close()

    print('G7. on a phone (an emulated one: hand=1, touch only), the finger\'s tips')
    SCR = "((id) => { const e = tw.ent(id), v = new tw.THREE.Vector3(e.x, (e.y || 0) + 0.5, e.z).project(tw.main.camera), r = document.getElementById('c').getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; })"
    def phone(tok):
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        pg = tab('&hand=1#s=' + urllib.parse.quote(tok), ctx=ctx); ready(pg); pg.wait_for_timeout(600); pg.cdp = ctx.new_cdp_session(pg); return pg
    def touch(pg, typ, pts): pg.cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
    def frame(pg, id): pg.evaluate(f"(() => {{ tw.select('{id}'); tw.frameSelection(); tw.clearSelection(); }})()"); pg.wait_for_timeout(900)
    OPEN = "(() => { const W = innerWidth, H = innerHeight; for (let j = 4; j < 9; j++) for (let i = 1; i < 8; i++) { const x = W * i / 8, y = H * j / 10, hits = tw.worldOf(tw.area()).pickAll(tw.rayAt(x, y)); if (!hits.some(h => tw.selectionFor(h)) && document.elementFromPoint(x, y)?.id === 'c') return [x, y]; } return null; })()"
    def tap(pg, x, y): touch(pg, 'touchStart', [(x, y)]); pg.wait_for_timeout(50); touch(pg, 'touchEnd', []); pg.wait_for_timeout(300)
    def fingers(pg, p0, p1, steps=14, hold=0):
        touch(pg, 'touchStart', p0)
        if hold: pg.wait_for_timeout(hold)
        for i in range(1, steps + 1):
            f = i / steps; touch(pg, 'touchMove', [(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f) for a, b in zip(p0, p1)]); pg.wait_for_timeout(16)
        touch(pg, 'touchEnd', []); pg.wait_for_timeout(300)
    ph = phone(ptok); me = ph.evaluate('tw.me()'); pawn = ph.evaluate(f"Object.values(tw.entities()).find(e => e.kind === 'token' && e.owner === '{me}')?.id")
    ph.evaluate(f"tw.dispatch('token.move', {{ id: '{pawn}', x: 47.5, z: 42.5 }})"); settle(ph)  # (out on open ground, away from the goblins and the furniture)
    check(ph.evaluate("twLoad.tips.set()") == 'touch.player' and {l[1] for l in ph.evaluate('__tipLog') if l[2]} == {'touch.player'}, 'G7 a player on a phone: the touch set, from first paint to the table')
    ph.evaluate(f"tw.frameSelection ? (tw.select('{pawn}'), tw.frameSelection(), tw.clearSelection()) : 0"); ph.wait_for_timeout(700)
    W, H = 390, 844; mid = (W / 2, H * 0.62)
    a = pose(ph); fingers(ph, [mid], [(mid[0] + 80, mid[1] + 40)]); b = pose(ph)
    check(abs(b['focus'][0] - a['focus'][0]) + abs(b['focus'][2] - a['focus'][2]) > 1, 'G7 one finger dragged on the ground looks around (pans)')
    a = pose(ph); fingers(ph, [(mid[0] - 40, mid[1]), (mid[0] + 40, mid[1])], [(mid[0] - 110, mid[1]), (mid[0] + 110, mid[1])]); b = pose(ph)
    check(b['dist'] < a['dist'] - 0.5, 'G7 a pinch zooms', f"{a['dist']:.1f} -> {b['dist']:.1f}")
    import math
    c0 = [(mid[0] + 70 * math.cos(t), mid[1] + 70 * math.sin(t)) for t in (math.pi, 0)]; c1 = [(mid[0] + 70 * math.cos(t + 0.6), mid[1] + 70 * math.sin(t + 0.6)) for t in (math.pi, 0)]
    a = pose(ph); fingers(ph, c0, c1, steps=20); b = pose(ph)
    check(abs(b['yaw'] - a['yaw']) > 0.1, 'G7 a twist of two fingers turns the view', f"{a['yaw']:.2f} -> {b['yaw']:.2f}")
    a = pose(ph); fingers(ph, [(mid[0] - 60, mid[1]), (mid[0] + 60, mid[1])], [(mid[0] - 60, mid[1] - 120), (mid[0] + 60, mid[1] - 120)], steps=20); b = pose(ph)
    check(abs(b['pitch'] - a['pitch']) > 0.05, 'G7 two fingers slid up together tilt the view', f"{a['pitch']:.2f} -> {b['pitch']:.2f}")
    g0 = ph.evaluate(OPEN) or mid; ph.evaluate('tw.lastPing = null'); touch(ph, 'touchStart', [g0]); ph.wait_for_timeout(750); st = ph.evaluate('tw.touchState()'); ping = ph.evaluate('!!tw.lastPing')
    for i in range(1, 9): touch(ph, 'touchMove', [(g0[0] + 9 * i, g0[1] + 7 * i)]); ph.wait_for_timeout(16)
    st2 = ph.evaluate('tw.touchState()'); touch(ph, 'touchEnd', []); ph.wait_for_timeout(300)
    check(ping, 'G7 a finger held still on a spot pings it', st)
    check(st2['gesture'] == 'marquee', 'G7 held on open ground, then dragged: a selection box', st2)
    frame(ph, pawn); xy = ph.evaluate(SCR, pawn); tap(ph, *xy); ph.wait_for_timeout(400)
    ring = ph.evaluate("[...document.querySelectorAll('#ring .rbtn')].filter(b => b.getClientRects().length).map(b => b.dataset.cmd || b.dataset.id)")
    check(ph.evaluate(f"tw.sel.has('{pawn}')") and 'pawn.eyes' in ring and 'pawn.damage' in ring, 'G7 a tap on their pawn: its ring, with Eyes and Damage', ring)
    a = ph.evaluate(f"tw.entities()['{pawn}']"); xy = ph.evaluate(SCR, pawn); fingers(ph, [xy], [(xy[0] + 70, xy[1] + 50)], steps=16); settle(ph); b = ph.evaluate(f"tw.entities()['{pawn}']")
    check(abs(b['x'] - a['x']) + abs(b['z'] - a['z']) > 1, 'G7 then a drag on it moves it', [a['x'], a['z'], b['x'], b['z']])
    xy = ph.evaluate(SCR, pawn); tap(ph, *xy); ph.wait_for_timeout(400); eb = ph.evaluate("(() => { const b = [...document.querySelectorAll('#ring .rbtn')].find(b => b.dataset.cmd === 'pawn.eyes' && b.getClientRects().length); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
    if eb: tap(ph, *eb); ph.wait_for_timeout(500)
    check(eb and ph.evaluate('tw.fpv.info()?.id') == pawn, 'G7 and Eyes looks through its eyes', eb)
    ph.evaluate('tw.fpv.exit?.() || tw.registry.run("view.eyesOut")'); ph.wait_for_timeout(400)
    bx = ph.evaluate("(() => { const r = document.querySelector('#bar textarea').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()"); tap(ph, *bx); ph.wait_for_timeout(500)
    rows = ph.evaluate("[...document.querySelectorAll('#results [role=option], #results .row, #results li, #results > *')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 6)")
    check(any(r.lower().startswith('roll') and 'd20' in r for r in rows) and any(r.startswith('Say') for r in rows), 'G7 a tap on the command bar offers Roll d20 and Say', rows[:3])
    ph.keyboard.press('Escape'); ph.wait_for_timeout(200)
    lb = ph.evaluate("(() => { const b = document.querySelector('.launcher[data-l=pawns]'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()"); tap(ph, *lb); ph.wait_for_timeout(500)
    check(ph.evaluate("!!document.querySelector('#pawnsTray [data-act=follow]')"), 'G7 Pawns shows the party, with Follow', lb)
    check(not ph.errs, 'G7 no page errors (player)', ph.errs[:3]); ph.ctx.close()
    gp = phone(gtok)
    check(gp.evaluate("twLoad.tips.set()") == 'touch.gm', 'G7 the GM on a phone: the touch set for a GM')
    lb = gp.evaluate("(() => { const b = document.querySelector('.launcher[data-l=build]'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
    tap(gp, *lb); check(gp.evaluate("!!tw.build?.isOpen || !document.getElementById('buildMenu').hidden"), 'G7 Build is a tap away for the GM', lb); tap(gp, *lb)
    room = gp.evaluate("Object.values(tw.entities()).find(e => e.kind === 'room').id"); gp.evaluate('tw.resetView()'); gp.wait_for_timeout(900); lab = gp.evaluate(f"(() => {{ const el = document.querySelector('#labels .rlabel[data-id=\"{room}\"]'); if (!el || !el.getClientRects().length) return null; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }})()")
    if lab: gp.evaluate('tw.clearSelection()'); tap(gp, *lab)
    check(lab and gp.evaluate(f"tw.sel.has('{room}')"), 'G7 a tap on a room\'s name selects the room', lab)
    gp.evaluate('tw.clearSelection()'); gp.wait_for_timeout(200)
    thing = gp.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'object' && !e.locked && !['kit', 'tile', 'wall', 'arrival'].includes(e.place) && !e.parent && !e.fromEdge && e.dims).sort((a, b) => b.dims[0] * b.dims[2] - a.dims[0] * a.dims[2])[0]?.id")  # (the biggest piece of furniture: a table)
    if not thing: print('    (objects:', gp.evaluate("[...new Set(Object.values(tw.entities()).filter(e => e.kind === 'object').map(e => e.place + '/' + !!e.parent + '/' + !!e.dims))]"), ')')
    frame(gp, thing); xy = gp.evaluate(SCR, thing); tap(gp, *xy); gp.wait_for_timeout(300)
    got = gp.evaluate("(() => { const id = [...tw.sel][0], e = id && tw.entities()[id]; return e && e.kind === 'object' ? id : null; })()")  # (whatever thing is under the finger there)
    a = got and gp.evaluate(f"tw.entities()['{got}']"); fingers(gp, [xy], [(xy[0] + 60, xy[1] + 40)], steps=16); settle(gp); b = got and gp.evaluate(f"tw.entities()['{got}']")
    check(got and abs(b['x'] - a['x']) + abs(b['z'] - a['z']) > 0.5, 'G7 a thing tapped, then dragged, moves (the GM)', [got, a and a['x'], b and b['x']])
    n0 = gp.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').length")
    bx = gp.evaluate("(() => { const r = document.querySelector('#bar textarea').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()"); tap(gp, *bx); gp.keyboard.type('6 goblins', delay=10); gp.wait_for_timeout(400); gp.keyboard.press('Enter'); gp.wait_for_timeout(500)
    placing = gp.evaluate('tw.mode?.kind || null'); p0, p1 = (W / 2 - 40, H * 0.55), (W / 2 + 30, H * 0.6); fingers(gp, [p0], [p1], steps=10); settle(gp); gp.wait_for_timeout(500)
    n1 = gp.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').length")
    near = gp.evaluate(f"(() => {{ const at = (x, y) => tw.pointAt(x, y), a = at({p0[0]}, {p0[1]}), b = at({p1[0]}, {p1[1]}), ts = Object.values(tw.entities()).filter(e => e.kind === 'token').slice(-6), d = (p, e) => Math.hypot(p.x - e.x, p.z - e.z); return a && b ? Math.min(...ts.map(e => d(b, e))) < Math.min(...ts.map(e => d(a, e))) : null; }})()")
    check(placing == 'place' and n1 - n0 == 6 and near, 'G7 "6 goblins" from the bar, then a finger pressed, moved and lifted: all six go down where it lifts', [placing, n0, n1, near])
    check(not gp.errs, 'G7 no page errors (GM)', gp.errs[:3]); gp.ctx.close()

def main():
    if want('G'): start_local()
    with sync_playwright() as p:
        browser = getattr(p, ENG).launch(headless=True, args=['--no-sandbox'] if ENG == 'chromium' else [])
        tips = part_p(browser) if want('P') else None
        browser.close()
        if want('G'):
            browser = p.chromium.launch(headless=True, args=GPU)
            if tips is None:  # (G alone: the lists, from the page)
                pg = browser.new_page(); pg.goto(f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(RELAY) + '&nointro#games', wait_until='commit'); pg.wait_for_function('window.twLoad && twLoad.tips')
                tips = pg.evaluate('({ T: twLoad.tips.T, SETS: twLoad.tips.SETS, SEEN: twLoad.tips.SEEN_MS, MIN: twLoad.tips.MIN_MS })'); pg.close()
            part_g(browser, tips)
            browser.close()
    bad = [r for r in results if not r[0]]
    print(f"\nbrowser_tips ({ENG}): {len(results) - len(bad)}/{len(results)} checks passed")
    for r in bad: print('  FAILED:', r[1], r[2])
    return 1 if bad else 0

t_start = time.time()
try: code = main()
finally: stop()
print(f'{time.time() - t_start:.0f} s')
sys.exit(code)

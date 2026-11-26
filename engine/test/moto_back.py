#!/usr/bin/env python3
"""ANDROID BACK ON THE REAL PHONE (2026-11-11, docs/UI.md "On a phone": Back closes what is open).

  python3 engine/test/moto_back.py [--page http://127.0.0.1:8180/] [--serial ZY22N28LQ4]

The Moto G Play on USB: Chrome's DevTools socket is forwarded (adb forward tcp:9333 localabstract:chrome_devtools_remote),
the page under test is served to the phone through `adb reverse` on its own port, and the hardware Back is a real
`adb shell input keyevent KEYCODE_BACK` (the system's Back, not a script's history.back()). Taps are adb `input tap`
in device pixels (the page's CSS pixels times devicePixelRatio, plus Chrome's top bar).

  BACK-TRAY   Build opened with a tap on its launcher; Back closes it and the game is still on screen (same URL)
  BACK-BAR    the command bar's list open; Back closes it
  BACK-NEST   Settings, then Back, then Back again with nothing open: the second Back leaves the game (not a trap)
Prints what it saw at each step (the URL, the tray, history.length): the 'before' run on the old build is the same script.
"""
import argparse, asyncio, json, os, subprocess, sys, time, urllib.parse
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox

ap = argparse.ArgumentParser(); ap.add_argument('--page', default='http://127.0.0.1:8180/'); ap.add_argument('--serial', default='ZY22N28LQ4'); ap.add_argument('--cdp', type=int, default=9333)
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:400] if detail != '' else ''}", flush=True)
def adb(*a): return subprocess.run(['adb', '-s', A.serial, *a], capture_output=True, text=True, timeout=30).stdout
def back(): adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')

async def tap_el(pg, sel):
    """a real tap (adb input) on the middle of the first visible match"""
    r = await pg.evaluate(f"(() => {{ const e = [...document.querySelectorAll({json.dumps(sel)})].find(e => e.getBoundingClientRect().height > 0); if (!e) return null; const r = e.getBoundingClientRect(); return {{ x: r.left + r.width / 2, y: r.top + r.height / 2, dpr: devicePixelRatio, top: (screen.height - innerHeight) }}; }})()")
    if not r: return False
    # Chrome's own toolbar sits above the page: the page's top in device pixels is the screen height less the viewport
    # height, less the system's bottom navigation bar; measured once below and kept in OFFSET
    adb('shell', 'input', 'tap', str(int(r['x'] * r['dpr'])), str(int(r['y'] * r['dpr'] + OFFSET[0])))
    return True
OFFSET = [0]

STATE = "(() => ({ url: location.href.slice(-12), open: tw?.escapable?.open?.(), log: (tw?.escapable?.log || []).slice(-4).map(l => l.what + ':' + l.n + '/' + l.d), act: document.activeElement?.tagName, hist: history.length, game: !!(window.tw && tw.ready && tw.ready()), build: !!tw?.build?.isOpen, pawns: !!tw?.pawns?.isOpen, settings: !!tw?.settings?.isOpen, bar: !!document.querySelector('#bar.open, #bar[data-open], #results:not([hidden]) .res'), esc: tw?.escapable?.depth?.() ?? null }))()"

async def main():
    ports = {urllib.parse.urlparse(A.page).port or 80}
    rel = urllib.parse.parse_qs(urllib.parse.urlparse(A.page).query).get('relay')
    if rel: ports.add(urllib.parse.urlparse(rel[0]).port or 80)
    for port in ports: adb('reverse', f'tcp:{port}', f'tcp:{port}')  # (the page, and a local relay of its own)
    adb('forward', f'tcp:{A.cdp}', 'localabstract:chrome_devtools_remote')
    async with async_playwright() as p:
        br = await p.chromium.connect_over_cdp(f'http://127.0.0.1:{A.cdp}')
        ctx = br.contexts[0]
        pg = ctx.pages[0] if ctx.pages else await ctx.new_page()
        await pg.bring_to_front()
        url = A.page + ('&' if '?' in A.page else '?') + 'nointro&phone=0'
        await pg.goto('about:blank'); await pg.goto(url)
        await pg.evaluate("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}")  # (a fresh visit: no table reopened)
        await pg.goto('about:blank'); await pg.goto(url)
        await pg.wait_for_selector('#newCampaign input[name=gm]', timeout=60000)
        await pg.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await pg.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST moto back {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await pg.evaluate("document.querySelector('#newCampaign button').click()")  # (a card can sit over it on a small screen)
        await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=90000)
        # the GM-link card comes up by itself a moment after the table (surfaces/linkmail.js): let it come, then close it
        try: await pg.wait_for_selector('#linkMail .lm-x', timeout=9000)
        except Exception: pass
        await pg.evaluate("document.querySelector('#linkMail .lm-x, .lmcard .lm-x')?.click()")
        await pg.wait_for_timeout(1500)
        # where the page starts on the screen, in device pixels (the status bar + Chrome's toolbar)
        info = await pg.evaluate("({ dpr: devicePixelRatio, ih: innerHeight, iw: innerWidth, sh: screen.height, hand: document.documentElement.classList.contains('tw-hand') })")
        size = adb('shell', 'wm', 'size'); dev_h = int(size.strip().split()[-1].split('x')[1])
        nav = 48 * info['dpr']  # the gesture / button bar under the page (Moto: 3-button nav ~48 dp)
        OFFSET[0] = dev_h - nav - info['ih'] * info['dpr']
        print('page', info, 'device h', dev_h, 'page top px', OFFSET[0])
        game_url = pg.url
        s0 = await pg.evaluate(STATE); print('  start', s0)

        # ---- BACK-TRAY ----
        await tap_el(pg, '#launchers .launcher:nth-child(2)'); await pg.wait_for_timeout(1200)
        s1 = await pg.evaluate(STATE); print('  build tapped', s1)
        back(); await pg.wait_for_timeout(2000)
        try: s2 = await pg.evaluate(STATE)
        except Exception as e: s2 = {'url': pg.url, 'err': str(e)[:120]}
        print('  after Back', s2)
        check(s1.get('build') and s2.get('game') and not s2.get('build') and s2.get('url') == game_url[-12:], 'BACK-TRAY: Back closes the Build tray and stays in the game', {'before': s1.get('build'), 'after': s2})
        if not s2.get('game'):
            # the old build: Back left. Come back to report the rest as not reached.
            print('  Back left the game; no further steps'); await br.close(); return
        # ---- BACK-BAR ----
        await tap_el(pg, '#bar textarea'); await pg.wait_for_timeout(1000)
        await pg.evaluate("document.activeElement?.blur?.()")  # (the keyboard: Android's first Back would hide it)
        await pg.wait_for_timeout(2000)
        ime = 'mInputShown=true' in adb('shell', 'dumpsys', 'input_method')
        print('  keyboard shown before Back:', ime)
        if ime: back(); await pg.wait_for_timeout(1200)  # (a real person's first Back hides the keyboard; that one is Android's)
        b1 = await pg.evaluate(STATE)
        back(); await pg.wait_for_timeout(1500); b2 = await pg.evaluate(STATE)
        print('  bar', b1, '->', b2)
        check(b1.get('bar') and not b2.get('bar') and b2.get('game'), 'BACK-BAR: Back closes the command bar list', {'before': b1, 'after': b2})
        # ---- BACK-NEST ----
        await tap_el(pg, '#launchers .launcher:nth-child(3)'); await pg.wait_for_timeout(1500)
        n1 = await pg.evaluate(STATE)
        back(); await pg.wait_for_timeout(1500); n2 = await pg.evaluate(STATE)
        print('  settings', n1, '->', n2)
        back(); await pg.wait_for_timeout(2500)
        left = pg.url.split('#')[0] != game_url.split('#')[0]
        print('  second Back: url now', pg.url)
        check(n1.get('settings') and not n2.get('settings') and n2.get('game') and left, 'BACK-NEST: Back closes Settings; Back with nothing open leaves the game (no trap)', {'settings': [n1.get('settings'), n2.get('settings')], 'left_to': pg.url})
        await br.close()

asyncio.run(main())
n = sum(1 for r in results if r[0])
print(f'moto back: {n}/{len(results)} checks passed')
sys.exit(0 if n == len(results) and results else 1)

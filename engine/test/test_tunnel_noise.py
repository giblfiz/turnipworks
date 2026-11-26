#!/usr/bin/env python3
"""THE DICE-WALL SUITE PASSES OVER THE TUNNEL'S WEBSOCKET 404, AND ONLY THAT (2026-11-06; engine/test/tunnel_noise.py).

  python3 engine/test/test_tunnel_noise.py

browser_dice_wall.py W7 (no page errors) failed on every dev run (--page https://dev.turnipworks.net/...): Cloudflare
answers the websocket upgrade 404, Chrome logs it as a console error, and the seat goes on over SSE as designed.
Nothing here touches dev or any live host.

  FILTER   the dev line is passed over; a local ws:// 404, another path, another code, an ordinary error are not
  CHROME   Chrome's own wording, from a real headless Chrome refused by a local server that 404s the upgrade: with the
           tunnel's host it is passed over, as it came (a local ws://) it is not
  SUITE    browser_dice_wall.py's console handler uses the filter, and still counts every other console error
"""
import asyncio, os, re, socket, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'tests')); import tw_sandbox  # (the browser below only opens a blank local page; the sandbox is for the house-look lint and any later change)
results = []
def check(ok, name, detail=''):
    results.append(bool(ok)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

try:
    from tunnel_noise import is_tunnel_ws_404
except ImportError as e:
    is_tunnel_ws_404 = None; check(False, 'engine/test/tunnel_noise.py loads', e)

DEV = "WebSocket connection to 'wss://dev.turnipworks.net/api/tw-relay/ws' failed: Error during WebSocket handshake: Unexpected response code: 404"
if is_tunnel_ws_404:
    print('FILTER')
    check(is_tunnel_ws_404(DEV), 'the dev websocket 404 is passed over', DEV)
    check(is_tunnel_ws_404("WebSocket connection to 'wss://turnipworks.net/api/tw-relay/ws' failed: Error during WebSocket handshake: Unexpected response code: 404"), 'and the same from the prod host (the same tunnel)')
    for text, why in (
        ("WebSocket connection to 'ws://127.0.0.1:23315/ws' failed: Error during WebSocket handshake: Unexpected response code: 404", 'a LOCAL relay refusing the upgrade (plain ws://: a real fault)'),
        ("WebSocket connection to 'wss://dev.turnipworks.net/api/tw-relay/ws' failed: Error during WebSocket handshake: Unexpected response code: 500", 'the tunnel answering 500'),
        ("WebSocket connection to 'wss://dev.turnipworks.net/api/tw-relay/other' failed: Error during WebSocket handshake: Unexpected response code: 404", 'a 404 on another websocket path'),
        ("WebSocket connection to 'wss://dev.turnipworks.net/api/tw-relay/ws' failed: ", 'a websocket failure with no 404 in it'),
        ("TypeError: Cannot read properties of undefined (reading 'dice')", 'an ordinary script error'),
        ("Uncaught (in promise) Error: Unexpected response code: 404", 'a 404 that is not the websocket handshake'),
        (DEV + ' and then something else', 'the dev line with more after it'),
    ): check(not is_tunnel_ws_404(text), f'counted: {why}', text[:90])

    print('CHROME: the wording, from a real Chrome')
    site = tempfile.mkdtemp(prefix='tw-tunnelnoise-'); open(os.path.join(site, 'index.html'), 'w').write('<!doctype html><title>x</title>')
    port = int(os.environ.get('TW_PORTS', '23313').split(',')[0])  # a local page server that 404s every websocket upgrade
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try: socket.create_connection(('127.0.0.1', port), 0.2).close(); break
            except OSError: time.sleep(0.1)
        from playwright.async_api import async_playwright
        async def chrome_line():
            async with async_playwright() as p:
                b = await p.chromium.launch(headless=True, args=['--no-sandbox']); pg = await b.new_page(); out = []
                pg.on('console', lambda m: out.append(m.text) if m.type == 'error' else None)
                await pg.goto(f'http://127.0.0.1:{port}/index.html'); await pg.evaluate(f"new WebSocket('ws://127.0.0.1:{port}/api/tw-relay/ws')")
                await pg.wait_for_timeout(1500); await b.close(); return out
        lines = asyncio.run(chrome_line())
    finally: srv.terminate()
    ws = [l for l in lines if l.startswith('WebSocket connection')]
    check(len(ws) == 1, 'Chrome logs the refused upgrade as one console error', lines)
    if ws:
        check(not is_tunnel_ws_404(ws[0]), 'as it came (a local ws:// relay) it is counted', ws[0])
        through = re.sub(r"'ws://127\.0\.0\.1:\d+/", "'wss://dev.turnipworks.net/", ws[0])
        check(is_tunnel_ws_404(through), "Chrome's wording with the tunnel's host is passed over", through)

print('SUITE: browser_dice_wall.py uses it')
src = open(os.path.join(HERE, 'browser_dice_wall.py')).read()
handler = [l for l in src.splitlines() if "pg.on('console'" in l]
check(len(handler) == 1 and 'is_tunnel_ws_404' in handler[0], "the suite's console handler passes over the tunnel's websocket 404", handler)
check(len(handler) == 1 and "m.type == 'error'" in handler[0] and 'errors.append' in handler[0], 'and still records every other console error', handler)

print(f"\ntunnel noise: {sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)

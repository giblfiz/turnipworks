#!/usr/bin/env python3
"""Interactive probe for the fog-of-war look (dev tool, 2026-10-17): serves the worktree's tuner, opens it in a GPU
Chromium, then executes commands dropped into DIR/in.json ({"js": "...", "shot": "name.png", "reload": true,
"wait": seconds}) and answers in DIR/out.json. Run under tw-slot, in the background:
    tw-slot python probe.py DIR [query-string]
"""
import http.server, json, os, sys, threading, time, traceback, socket
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../tests'))
import tw_sandbox  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

TUNER = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../tools/spawn-tuner'))
D = sys.argv[1]; QS = sys.argv[2] if len(sys.argv) > 2 else 'nobg&seed=4242'
os.makedirs(D, exist_ok=True)

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=TUNER, **k)
    def end_headers(self): self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(self, *a): pass

with socket.socket() as s: s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{port}'

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    log = []
    pg.on('pageerror', lambda e: log.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: log.append(m.type + ' ' + m.text) if m.type in ('error', 'warning') else None)
    tw_sandbox.proxy(pg, 'http://127.0.0.1:8096')
    pg.add_init_script("try { for (const k of Object.keys(localStorage)) if (k.startsWith('tuner.fx.fogwar')) localStorage.removeItem(k); } catch (e) {}")
    def load():
        pg.goto(f'{base}/index.html?{QS}')
        pg.wait_for_selector('body[data-ready="1"]', timeout=90000)
        pg.wait_for_function('!!window.fx && !!fx.fogwar', timeout=60000)
    load()
    open(os.path.join(D, 'ready'), 'w').write(base)
    while True:
        f = os.path.join(D, 'in.json')
        if not os.path.exists(f):
            time.sleep(0.1); continue
        try: cmd = json.load(open(f))
        except Exception: time.sleep(0.1); continue
        os.remove(f)
        if cmd.get('quit'): break
        out = {}
        try:
            if cmd.get('reload'): load()
            if cmd.get('js'): out['result'] = pg.evaluate(cmd['js'])
            if cmd.get('wait'): time.sleep(cmd['wait'])
            if cmd.get('mouse'):
                for x, y in cmd['mouse']: pg.mouse.move(x, y); time.sleep(cmd.get('mouse_dt', 0.03))
            if cmd.get('shot'):
                clip = pg.evaluate("(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()")
                pg.screenshot(path=os.path.join(D, cmd['shot']), clip=clip); out['shot'] = os.path.join(D, cmd['shot'])
        except Exception as e:
            out['error'] = ''.join(traceback.format_exception_only(type(e), e))[-2000:]
        out['log'] = log[-15:]; log.clear()
        json.dump(out, open(os.path.join(D, 'out.tmp'), 'w')); os.replace(os.path.join(D, 'out.tmp'), os.path.join(D, 'out.json'))
    b.close()

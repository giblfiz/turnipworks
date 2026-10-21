#!/usr/bin/env python3
"""A rough second opinion from other engines on this same box: Playwright's WebKit and Firefox (whatever GL they get here,
usually software), and Chromium on SwiftShader. NOT a measurement of a Mac: only "does it load, and how does the frame
scale from the small map to the bigger one in a different engine".
  python3 other_browsers.py --data <relay data dir> --rooms 15 52
"""
import argparse, json, sys, time
import mm, layout
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--rooms', nargs='+', type=int); ap.add_argument('--out', default='results/other_browsers.jsonl'); ap.add_argument('--engines', default='webkit,firefox,swiftshader')
A = ap.parse_args()
Bs = [json.loads(l) for l in open(__import__('os').environ.get('BUILD_JSONL', 'results/build.jsonl'))]
SIMPLE = """(ms) => new Promise(res => { let n = 0, t0 = null; const tick = (now) => { if (t0 === null) t0 = now; else n++; if (now - t0 < ms) requestAnimationFrame(tick); else res({ frames: n, wall: now - t0 }); }; requestAnimationFrame(tick); })"""
GPU = """(() => { const c = document.querySelector('#c'); const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return 'no webgl'; const e = gl.getExtension('WEBGL_debug_renderer_info'); return (e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) + (gl.isContextLost() ? ' [LOST]' : ''); })()"""
mm.start_local(A.data)
try:
    with sync_playwright() as p:
        for eng in A.engines.split(','):
            for n in A.rooms:
                B = [b for b in Bs if b.get('counts', {}).get('room') == n][-1]; rs, lots = layout.rooms(B['asked']); C = (lots[0]['x'] + 40, lots[0]['z'] + 22)
                out = {'engine': eng, 'rooms': n, 'at': time.strftime('%H:%M:%S')}
                try:
                    if eng == 'webkit': b = p.webkit.launch()
                    elif eng == 'firefox': b = p.firefox.launch(firefox_user_prefs={'webgl.force-enabled': True, 'layout.frame_rate': 0})
                    else: b = p.chromium.launch(args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-frame-rate-limit', '--disable-gpu-vsync'])
                    ctx = b.new_context(viewport=mm.VIEWPORT, device_scale_factor=1); pg = ctx.new_page(); errs = []
                    pg.on('pageerror', lambda e: errs.append(str(e)[:200])); mm.tw_sandbox.proxy(pg, mm.API)
                    t0 = time.time(); pg.goto(mm.page_url() + '#s=' + B['token']); pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=180000); out['ready_s'] = round(time.time() - t0, 1)
                    out['renderer'] = pg.evaluate(GPU); pg.evaluate(mm.cam_js(*C, 110))
                    ok, s, st = mm.wait_settled(pg, timeout=600); out['settled'] = ok; out['all_streamed_s'] = round(time.time() - t0 - 2, 1)
                    pg.wait_for_timeout(3000); m = pg.evaluate(SIMPLE, 6000); out['frames'] = m['frames']; out['mean_ms'] = round(m['wall'] / max(1, m['frames']), 1)
                    out['renderer_after'] = pg.evaluate(GPU); out['errors'] = errs[:3]; b.close()
                except Exception as e:
                    out['failed'] = str(e)[:300]
                    try: b.close()
                    except Exception: pass
                open(A.out, 'a').write(json.dumps(out) + '\n'); mm.say(json.dumps(out))
finally: mm.stop()

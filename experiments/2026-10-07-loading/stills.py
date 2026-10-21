#!/usr/bin/env python3
"""Stills of the loading screen at several moments, with neutral file names, for a blind read (Gemini).
  stills.py <out dir>      TW_BROWSER=firefox for Firefox
The screen is held where wanted by keeping the table from answering; the last two are a real load just after the
screen left and six seconds later."""
import json, os, sys
import stack
from stack import tw_sandbox
from playwright.sync_api import sync_playwright
tw_sandbox.remove_campaigns()
S = sys.argv[1]; os.makedirs(S, exist_ok=True)
try:
    stack.start_local(); c = stack.make_campaign(stack.RELAY, 'TEST loading stills (throwaway)'); stack.build_rooms(stack.RELAY, c, 15)
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=stack.GPU)
        def held(vw, vh, name, at_ms, scheme='dark', touch=False):
            ctx = b.new_context(viewport={'width': vw, 'height': vh}, color_scheme=scheme, has_touch=touch); pg = ctx.new_page(); tw_sandbox.proxy(pg, stack.API)
            pg.add_init_script("try { localStorage.setItem('tw.load', JSON.stringify(%s)); } catch {}" % json.dumps({'toState': 1600, 'toLook': 500, 'roomLast': 2500, 'filesToCode': 66}))
            pg.route('**/sse/**', lambda r: None); pg.route('**/ws', lambda r: r.abort())
            pg.goto(stack.page_url('&transport=sse') + '#s=' + c['token'], wait_until='commit'); pg.wait_for_function('window.twLoad && twLoad.times.code != null'); pg.wait_for_timeout(at_ms); pg.screenshot(path=f'{S}/{name}.png'); ctx.close()
        held(1440, 900, 'view-a', 150); held(1440, 900, 'view-b', 900); held(1440, 900, 'view-c', 3600); held(390, 844, 'view-d', 3600, touch=True); held(1440, 900, 'view-e', 3600, scheme='light')
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark'); pg = ctx.new_page(); tw_sandbox.proxy(pg, stack.API)
        pg.goto(stack.page_url() + '#s=' + c['token']); pg.wait_for_function('window.tw && tw.ready && tw.ready() && window.twLoad.left'); pg.wait_for_timeout(350); pg.screenshot(path=f'{S}/view-f.png'); pg.wait_for_timeout(8000 if not stack.FIREFOX else 30000); pg.screenshot(path=f'{S}/view-g.png')
        ctx.close(); b.close()
finally: stack.stop()

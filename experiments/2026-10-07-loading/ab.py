#!/usr/bin/env python3
"""First real frame before and after, in turn (A, B, A, B ...) in one run on one relay: the same campaign served from
the main checkout (before) on one static server and from this worktree (after) on another.
  ab.py [--rooms 5 50] [--rounds 8]      TW_BROWSER=firefox for Firefox
Each load is a cold browser context. Reported: the median and spread of 'first real frame' (ms from navigation)."""
import argparse, json, os, statistics, subprocess, sys, time, urllib.parse, tempfile, shutil
import stack
from stack import tw_sandbox, say
from playwright.sync_api import sync_playwright
tw_sandbox.remove_campaigns()
ap = argparse.ArgumentParser(); ap.add_argument('--rooms', nargs='*', type=int, default=[5, 50]); ap.add_argument('--rounds', type=int, default=8); ap.add_argument('--before', default='<repo>')
A = ap.parse_args()
def site(repo, port):
    d = tempfile.mkdtemp(prefix='tw-loading-ab-'); stack.dirs.append(d)
    os.symlink(os.path.join(repo, 'engine'), os.path.join(d, 'engine')); os.symlink(os.path.join(repo, 'tools', 'spawn-tuner'), os.path.join(d, 'tuner'))
    stack.procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=d, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)); time.sleep(0.8)
    return f'http://127.0.0.1:{port}/engine/client/index.html?relay=' + urllib.parse.quote(stack.RELAY) + '&nointro'
def one(browser, url, token):
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1, color_scheme='dark'); pg = ctx.new_page(); pg.set_default_timeout(240000); pg.add_init_script(stack.PROBE); tw_sandbox.proxy(pg, stack.API)
    pg.goto(url + '#s=' + token, wait_until='commit'); pg.wait_for_function('window.__tl && __tl.marks.all_in != null', timeout=240000)
    m = pg.evaluate('__tl.marks'); ctx.close(); return m
try:
    stack.start_local(); after = stack.page_url(); before = site(A.before, stack.SP + 1); out = {'script': 'ab', 'engine': 'firefox' if stack.FIREFOX else 'chromium', 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'sizes': {}}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=stack.GPU)
        for n in A.rooms:
            c = stack.make_campaign(stack.RELAY, f'TEST loading ab {n} (throwaway)'); stack.build_rooms(stack.RELAY, c, n)
            one(browser, before, c['token']); one(browser, after, c['token'])  # warm the box's file cache; not counted
            R = {'before': [], 'after': []}
            for i in range(A.rounds):
                for tag, url in ((('before', before), ('after', after)) if i % 2 == 0 else (('after', after), ('before', before))): R[tag].append(one(browser, url, c['token']))
            o = {}
            for tag in R:
                for k in ('boot', 'frame1', 'all_in'):
                    v = sorted(m[k] for m in R[tag]); o[f'{tag}_{k}'] = {'median': round(statistics.median(v)), 'min': v[0], 'max': v[-1]}
            o['frame1_runs'] = {t: [m['frame1'] for m in R[t]] for t in R}; out['sizes'][str(n)] = o
            say(n, 'rooms:', json.dumps({k: v for k, v in o.items() if k != 'frame1_runs'})); say('   ', o['frame1_runs'])
        browser.close()
    open('results/ab.jsonl', 'a').write(json.dumps(out) + '\n')
finally: stack.stop()

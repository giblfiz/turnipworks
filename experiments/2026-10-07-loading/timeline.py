#!/usr/bin/env python3
"""Where the time goes between pressing Enter on a join link and a finished table, and what is on screen meanwhile.
  timeline.py [--live] [--sizes 5 50] [--runs 3] [--tag before] [--film] [--waits]
    first load   cold browser context -> navigation, first paint, client code running, state arrived, first real frame,
                 the view's meshes in, every mesh in; main-thread gaps (a 20 ms heartbeat) in each stretch
    --film       the same load with screenshots as fast as the browser gives them: brightness and "is anything drawn" per shot
    --waits      creating a campaign from the start form, travelling to an area not loaded yet, the relay restarting
  TW_BROWSER=firefox for Firefox (a window on Xvfb, software GL: its absolute numbers are this box's, not a Mac's).
Appends to results/timeline.jsonl."""
import argparse, io, json, os, statistics, sys, time
import stack
from stack import tw_sandbox, say
from playwright.sync_api import sync_playwright
tw_sandbox.remove_campaigns()
ap = argparse.ArgumentParser(); ap.add_argument('--live', action='store_true'); ap.add_argument('--sizes', nargs='*', type=int, default=[5, 50]); ap.add_argument('--runs', type=int, default=3)
ap.add_argument('--tag', default=''); ap.add_argument('--film', action='store_true'); ap.add_argument('--waits', action='store_true'); ap.add_argument('--out', default='results/timeline.jsonl'); ap.add_argument('--extra', default=''); ap.add_argument('--scheme', default='dark')
A = ap.parse_args()
ENGINE_NAME = 'firefox' if stack.FIREFOX else 'chromium'
LIVE = 'https://turnipworks.net'; LIVE_RELAY = LIVE + '/api/tw-relay'
VIEW = {'width': 1440, 'height': 900}
def med(xs): xs = [x for x in xs if x is not None]; return round(statistics.median(xs)) if xs else None

def new_page(browser):
    ctx = browser.new_context(viewport=VIEWPORT if (VIEWPORT := VIEW) else None, device_scale_factor=1, color_scheme=A.scheme); pg = ctx.new_page(); pg.set_default_timeout(180000)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.on('console', lambda m: errs.append(('console.' + m.type + ': ' + m.text)[:300]) if m.type in ('error',) or 'load:' in m.text else None)
    pg.add_init_script(stack.PROBE)
    return ctx, pg, errs
def url_for(token, live): return (f'{LIVE}/?nointro{A.extra}' if live else stack.page_url(A.extra)) + (f'#s={token}' if token else '')

def first_load(browser, token, live, film=False, timeout=240):
    ctx, pg, errs = new_page(browser)
    if not live: tw_sandbox.proxy(pg, stack.API)
    shots = []; t0 = time.time()
    pg.goto(url_for(token, live), wait_until='commit')
    deadline = time.time() + timeout
    while time.time() < deadline:
        if film:
            a = time.time()
            try: shots.append((round((a - t0) * 1000), round((time.time() - a) * 1000), pg.screenshot(type='png')))
            except Exception as e: say('shot failed', e)
        else: pg.wait_for_timeout(150)
        tl = pg.evaluate('window.__tl ? { m: __tl.marks, left: __tl.left } : null')
        if tl and tl['m'].get('all_in') is not None: break
    if film:
        for _ in range(4): pg.wait_for_timeout(400); a = time.time(); shots.append((round((a - t0) * 1000), 0, pg.screenshot(type='png')))
    else: pg.wait_for_timeout(1500)
    out = pg.evaluate("""() => { const n = performance.getEntriesByType('navigation')[0] || {}, rs = performance.getEntriesByType('resource');
      return { tl: window.__tl, nav: { responseStart: Math.round(n.responseStart), domInteractive: Math.round(n.domInteractive), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) },
        res: { n: rs.length, kb: Math.round(rs.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024), lastScriptEnd: Math.round(Math.max(0, ...rs.filter(r => /\\.js(\\?|$)/.test(r.name)).map(r => r.responseEnd))), scripts: rs.filter(r => /\\.js(\\?|$)/.test(r.name)).length },
        things: window.__tl.things, fps: window.tw?.fps, rooms: window.tw ? Object.values(tw.entities()).filter(e => e.kind === 'room').length : null, v: window.TW_V }; }""")
    out['errors'] = errs[:8]; out['shots'] = shots
    ctx.close(); return out

def summarize(runs):
    keys = ['body', 'boot', 'tw', 'welcome', 'snap', 'frame1', 'view_in', 'all_in']
    o = {'first_paint': med([r['tl']['paints'].get('first-contentful-paint', r['tl']['paints'].get('first-paint')) for r in runs]), 'response': med([r['nav']['responseStart'] for r in runs]), 'last_script': med([r['res']['lastScriptEnd'] for r in runs])}
    for k in keys: o[k] = med([r['tl']['marks'].get(k) for r in runs])
    # main-thread gaps in each stretch (the median run by frame1)
    r = sorted(runs, key=lambda r: r['tl']['marks'].get('frame1') or 1e9)[len(runs) // 2]; m = r['tl']['marks']
    stretch = [('to code', 0, m.get('boot')), ('code to state', m.get('boot'), m.get('snap')), ('state to first frame', m.get('snap'), m.get('frame1')), ('first frame to all in', m.get('frame1'), m.get('all_in'))]
    o['gaps'] = {name: stack.gaps_between(r['tl'], a or 0, b if b is not None else 1e12) for name, a, b in stretch if a is not None}
    # the frame1 mark is taken by a timer AFTER the frame: a gap that ends at it started before it
    o['blocked_before_frame1'] = max([d for (s, d) in r['tl']['gaps'] if s < (m.get('frame1') or 0) and s + d >= (m.get('snap') or 0)] or [0])
    o['res'] = r['res']; o['rooms'] = r['rooms']; o['things'] = r['things']; o['errors'] = sum((x['errors'] for x in runs), [])[:6]
    o['frame1_runs'] = [x['tl']['marks'].get('frame1') for x in runs]
    return o

def film_stats(shots, name):
    from PIL import Image
    import numpy as np
    os.makedirs('results/shots', exist_ok=True); rows = []
    for i, (t, took, png) in enumerate(shots):
        im = np.asarray(Image.open(io.BytesIO(png)).convert('RGB')).astype(int); lum = im.mean(axis=2)
        bg = im[2, 2]; drawn = float((np.abs(im - bg).sum(axis=2) > 24).mean())
        rows.append({'t': t, 'took': took, 'mean': round(float(lum.mean()), 1), 'darkest_block': round(float(min(lum[y:y + 90, x:x + 144].mean() for y in range(0, lum.shape[0] - 89, 90) for x in range(0, lum.shape[1] - 143, 144))), 1), 'corner': [int(v) for v in bg], 'drawn': round(drawn, 3)})
        open(f'results/shots/{name}-{i:03d}-{t:06d}ms.png', 'wb').write(png)
    return rows

def waits(browser, big, small, data):
    """the three other waits, on the local stack"""
    out = {}
    # 1. creating a campaign from the start form
    ctx, pg, errs = new_page(browser); tw_sandbox.proxy(pg, stack.API)
    pg.goto(stack.page_url(A.extra)); pg.wait_for_selector('#newCampaign button'); form_paint = pg.evaluate('__tl.marks.startForm')
    pg.fill('#newCampaign input[name=name]', 'TEST loading create (throwaway)'); t0 = time.time(); pg.click('#newCampaign button')
    seen = {}; shots = []
    while time.time() - t0 < 60:
        try: tl = pg.evaluate('window.__tl && location.hash.length > 3 ? __tl.marks : null')
        except Exception: tl = None
        now = round((time.time() - t0) * 1000)
        if tl:
            for k in ('boot', 'tw', 'welcome', 'snap', 'frame1'):
                if k in tl and k not in seen: seen[k] = now
            if 'frame1' in tl: break
        pg.wait_for_timeout(25)
    out['create'] = {'form_shown_ms': form_paint, 'click_to': seen, 'in_page': pg.evaluate('__tl.marks'), 'gaps': pg.evaluate('__tl.gaps')}
    ctx.close()
    # 2. travelling to an area that is not loaded yet (a second area of the big campaign holding the small town)
    ctx, pg, errs = new_page(browser); tw_sandbox.proxy(pg, stack.API)
    pg.goto(url_for(big['token'], False)); pg.wait_for_function('window.__tl && __tl.marks.all_in != null', timeout=240000); pg.wait_for_timeout(1500)
    area2 = big['area2']
    r = pg.evaluate("""(area) => new Promise(done => { const t0 = performance.now(), o = { gaps: [] }; let last = t0, fr0 = tw.stats.frames;
      const iv = setInterval(() => { const now = performance.now(); if (now - last > 80) o.gaps.push([Math.round(last - t0), Math.round(now - last)]); last = now;
        const v = tw.sync.view(area), w = tw.worlds.get(area);
        if (v && o.snap == null) { o.snap = Math.round(now - t0); fr0 = tw.stats.frames; }
        if (o.snap != null && o.frame1 == null && tw.stats.frames > fr0 && tw.lastRenders.some(r => r.view === 'main' && r.area === area)) o.frame1 = Math.round(now - t0);
        if (o.frame1 != null && w?.loaded) { let all = 0; for (const r of w.recs.values()) if (r.entity.kind === 'object' && r.entity.url && r.visual?.userData?.placeholder) all++; for (const s of w.shell.values()) if (s.visual?.userData?.placeholder) all++;
          if (!all) { o.all_in = Math.round(now - t0); o.things = w.recs.size + w.shell.size; clearInterval(iv); done(o); } }
        if (now - t0 > 120000) { clearInterval(iv); done(o); } last = performance.now(); }, 20);
      tw.setMain(area); })""", area2)
    out['travel'] = r
    # and back to the first area (already built in this tab? no: leaving unsubscribes; the world object is kept)
    r2 = pg.evaluate("""(area) => new Promise(done => { const t0 = performance.now(), o = {}; let fr0 = tw.stats.frames; const had = !!tw.worlds.get(area);
      const iv = setInterval(() => { const now = performance.now(); const v = tw.sync.view(area);
        if (v && o.snap == null) { o.snap = Math.round(now - t0); fr0 = tw.stats.frames; }
        if (o.snap != null && tw.stats.frames > fr0 + 1) { o.frame1 = Math.round(now - t0); o.world_kept = had; clearInterval(iv); done(o); }
        if (now - t0 > 120000) { clearInterval(iv); done(o); } }, 20); tw.setMain(area); })""", big['area'])
    out['travel_back'] = r2
    # 3. the relay restarts (every deploy): what the page shows, and for how long
    pg.evaluate("""() => { const o = window.__rc = { t0: performance.now(), log: [] }; let was = tw.sync.status; setInterval(() => { const s = tw.sync.status; if (s !== was) { o.log.push([Math.round(performance.now() - o.t0), s]); was = s; } }, 10); }""")
    t0 = time.time(); stack.relay_stop(); pg.wait_for_timeout(1200)
    shot = pg.screenshot(type='png'); os.makedirs('results/shots', exist_ok=True); open(f'results/shots/{A.tag or "x"}-{ENGINE_NAME}-relay-down.png', 'wb').write(shot)
    hud = pg.evaluate("document.querySelector('#hud').textContent"); toast = pg.evaluate("document.querySelector('#toast').className + '|' + document.querySelector('#toast').textContent")
    visible = pg.evaluate("[...document.querySelectorAll('[role=status], #hud, #toast, #tw-wait')].filter(e => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && e.textContent.trim(); }).map(e => (e.id || e.className) + ': ' + e.textContent.trim().slice(0, 80))")
    stack.procs[0] = stack.relay_start(data); back_at = time.time() - t0
    pg.wait_for_function("tw.sync.status === 'live' && __rc.log.length >= 2", timeout=60000); pg.wait_for_timeout(600)
    out['reconnect'] = {'relay_down_for_s': round(back_at, 2), 'statuses': pg.evaluate('__rc.log'), 'hud_while_down': hud, 'toast_while_down': toast, 'visible_while_down': visible}
    ctx.close()
    return out

def main():
    rec = {'script': 'timeline', 'tag': A.tag, 'engine': ENGINE_NAME, 'live': A.live, 'repo': stack.REPO, 'commit': os.popen(f'git -C {stack.REPO} rev-parse --short HEAD').read().strip(), 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'loads': {}}
    data = None; camps = {}
    if A.live:
        relay = LIVE_RELAY
    else:
        data = stack.start_local(); relay = stack.RELAY
    for n in A.sizes:
        c = stack.make_campaign(relay, f'TEST loading {n} rooms (throwaway)'); ok, _ = stack.build_rooms(relay, c, n); c['rooms'] = ok; camps[n] = c; say(f'built {ok} rooms ({n} asked) on {relay}')
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=stack.GPU)
        if A.waits and not A.live:
            big = camps[max(camps)]
            ctx, pg, errs = new_page(browser); pg.goto(url_for(big['token'], False)); pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=240000)
            big['area2'] = pg.evaluate("""() => new Promise(done => { const id = 'area_' + Math.random().toString(36).slice(2, 10); tw.sync.submit('area.create', { id, name: 'Second town' }); const iv = setInterval(() => { if (tw.sync.campaign.areas.some(a => a.id === id)) { clearInterval(iv); done(id); } }, 50); })""")
            ctx.close(); ok, _ = stack.build_rooms(relay, big, 15, area=big['area2'], tag='ld2'); say('second area', big['area2'], ok, 'rooms')
        for n, c in camps.items():
            runs = [first_load(browser, c['token'], A.live) for _ in range(A.runs)]
            s = summarize(runs); rec['loads'][str(n)] = s; say(json.dumps({'rooms': n, **{k: v for k, v in s.items() if k not in ('errors',)}}))
            if s['errors']: say('  errors:', s['errors'][:3])
            if A.film:
                f = first_load(browser, c['token'], A.live, film=True); rows = film_stats(f['shots'], f"{A.tag or 'x'}-{ENGINE_NAME}-{'live' if A.live else 'local'}-{n}")
                rec['loads'][str(n)]['film'] = {'marks': f['tl']['marks'], 'paints': f['tl']['paints'], 'rows': rows}
                say('  film:', [(r['t'], r['mean'], r['drawn']) for r in rows][:40]); say('  film marks:', f['tl']['marks'])
        if A.waits and not A.live:
            rec['waits'] = waits(browser, camps[max(camps)], camps[min(camps)], data); say(json.dumps(rec['waits'])[:3000])
        browser.close()
    open(A.out, 'a').write(json.dumps(rec) + '\n')
try: main()
finally: stack.stop()

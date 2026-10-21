#!/usr/bin/env python3
"""Announce-then-settle (Harry 2026-10-04): a said line or a roll appears big and centred for everyone who receives it,
hangs 1 s + reading time (1 + words/4 s, max 8 s), then shrinks and flies into its exact line in the chat log.
Rolls show "Name · d20+5 → 17" with the dice small. Lines queue in order (shorter dwell while backlogged); a click or
Esc sends one to the log early; prefers-reduced-motion fades instead. Two tabs (GM + player), real input.

  local:  python3 engine/test/browser_announce.py --local
  live:   ... browser_announce.py --page https://turnipworks.net/
"""
import argparse, asyncio, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
# TW_GPU=1: render on the GPU (Vulkan) instead of software GL: several times faster, and steadier on a loaded machine
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

procs = []
RP, SP = 18098, 18727
def start_local():
    data = tempfile.mkdtemp(prefix='tw-ann-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=50); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
INFO = 'tw.announce.info()'
async def landed(pg, mid, timeout=15000):
    await wait(pg, f"{INFO}.log.some(r => r.id === '{mid}' && r.landedAt != null) && !{INFO}.showing", timeout, f'land {mid}')
    return await pg.evaluate(f"{INFO}.log.find(r => r.id === '{mid}')")
def aligned(rec):
    if not rec or not rec.get('box') or not rec.get('line'): return False, rec
    b, l = rec['box'], rec['line']
    dx, dy = abs(b['x'] - l['x']), abs((b['y'] + b['h'] / 2) - (l['y'] + l['h'] / 2))
    return dx <= 2 and dy <= 2, {'dx': round(dx, 2), 'dy': round(dy, 2), 'box': b, 'line': l}
SAY = lambda t: f"(() => {{ const id = 'msg_' + Math.random().toString(36).slice(2, 12); tw.dispatch('chat.say', {{ id, text: {t!r} }}); return id; }})()"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1280, 'height': 820})
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            pg.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' else None)
            await pg.goto(url); return pg
        gm = await tab(page + '&nointro')
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST announce ' + __import__('time').strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000), 'GM tab live')
        await gm.evaluate(SAY('said before the player joined'))
        await gm.wait_for_timeout(500)
        tok = await gm.evaluate("tw.createSeat({ kind: 'human', role: 'player', name: 'Brakka', color: '#6fc36f' })")
        pl = await tab((await gm.evaluate(f"tw.inviteLink('{tok}')")).replace('nopost', 'nofx'))
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 40000), 'player tab live')
        await wait(gm, f"{INFO}.log.length >= 1 && !{INFO}.showing", 15000, 'first settles')
        await pl.wait_for_timeout(1500)
        check(await pl.evaluate(f"{INFO}.log.length === 0 && !{INFO}.showing"), 'joining never replays history: the player sees no announce for an older line')

        print('SAY: big and centred for everyone, 1 s + words/4, then into its log line')
        mid = await gm.evaluate(SAY('hello there brave friends'))
        ok = await wait(gm, f"{INFO}.showing?.id === '{mid}'", 4000, 'gm shows') and await wait(pl, f"{INFO}.showing?.id === '{mid}'", 8000, 'player shows')
        geo = await pl.evaluate("(() => { const e = document.querySelector('#announce .ann'), r = e.getBoundingClientRect(), fs = parseFloat(getComputedStyle(e.querySelector('.aline')).fontSize); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, fs, text: e.textContent, pending: !!document.querySelector('#chat .line.pending') }; })()")
        check(ok and abs(geo['cx'] - 640) < 3 and 250 < geo['cy'] < 450 and geo['fs'] >= 38 and 'Harry' in geo['text'] and 'brave friends' in geo['text'], 'it appears at once on BOTH tabs, centred, about 30 pt, with the speaker\'s name', geo)
        check(geo['pending'], 'meanwhile its log line holds its place, invisible')
        r_gm, r_pl = await landed(gm, mid), await landed(pl, mid)
        took = (r_pl['dismissedAt'] - r_pl['shownAt']) / 1000
        check(r_pl['dwell'] == 2 and abs(took - 2) < 0.35, 'it hangs 1 s + reading time: 4 words → 2 s', f'dwell {r_pl["dwell"]} s, measured {took:.2f} s')
        for who, r in (('GM', r_gm), ('player', r_pl)):
            ok, d = aligned(r)
            check(ok and r['mode'] == 'fly', f'then it flies and lands on its own chat-log line within 2 px ({who})', d)
        check(await pl.evaluate(f"!document.querySelector('#chat .line.pending') && !document.querySelector('#announce .ann') && !!document.querySelector('#chat .line[data-id=\"{mid}\"]')"), 'the hand-off: the real log line shows, the box is gone')
        d = await gm.evaluate("[0, 3, 12, 28, 40, 200].map(n => tw.announce.dwellOf({ text: Array(n).fill('w').join(' ') }, 0))")
        check(d == [1, 1.75, 4, 8, 8, 8], 'dwell = min(8, 1 + words/4)', d)

        print('LONG + CLICK: a long line hangs up to 8 s; a click sends it to the log early')
        mid = await gm.evaluate(SAY(' '.join(['word'] * 40)))
        await wait(pl, f"{INFO}.showing?.id === '{mid}'", 8000, 'long shows')
        await pl.wait_for_timeout(900)
        await pl.click('#announce .ann')
        r = await landed(pl, mid)
        check(r['dwell'] == 8 and (r['dismissedAt'] - r['shownAt']) < 2500 and aligned(r)[0], 'a 40-word line would hang 8 s (the cap); a click flies it to the log at once', f"dwell {r['dwell']}, dismissed after {(r['dismissedAt'] - r['shownAt']) / 1000:.2f} s")

        print('ESC')
        mid = await gm.evaluate(SAY('escape sends me down'))
        await wait(pl, f"{INFO}.showing?.id === '{mid}'", 8000, 'esc shows')
        await pl.mouse.move(640, 700); await pl.wait_for_timeout(300)
        await pl.keyboard.press('Escape')
        r = await landed(pl, mid)
        check((r['dismissedAt'] - r['shownAt']) < 1500 and r['mode'] == 'fly', 'Esc sends it to the log early too', f"{(r['dismissedAt'] - r['shownAt']) / 1000:.2f} s")

        print('QUEUE: several at once show in order, quicker while others wait')
        ids = [await gm.evaluate(SAY(t)) for t in ('first of three', 'second of three here', 'third and last of three')]
        await wait(pl, f"{INFO}.showing?.id === '{ids[0]}'", 8000, 'queue starts')
        q = await pl.evaluate(INFO)
        check(q['queue'] == ids[1:], 'the next ones wait in a queue, in order', q['queue'])
        recs = [await landed(pl, i, 20000) for i in ids]
        order = sorted(ids, key=lambda i: next(r for r in recs if r['id'] == i)['shownAt'])
        check(order == ids and all(aligned(r)[0] for r in recs), 'they show one after another in the order said, each landing on its own line', [aligned(r)[1].get('dy') if isinstance(aligned(r)[1], dict) else None for r in recs])
        check(recs[0]['dwell'] < 1.75 and recs[1]['dwell'] < 2, 'with a backlog the dwell shortens (1.75 s → %.2f s)' % recs[0]['dwell'], [r['dwell'] for r in recs])

        print('ROLL: who, expression and total big; the dice small; the roller\'s colour')
        mid = await pl.evaluate("tw.roll('d20+5')")
        await wait(gm, f"{INFO}.showing && {INFO}.showing.text.includes('d20+5')", 8000, 'roll shows')
        rv = await gm.evaluate("(() => { const e = document.querySelector('#announce .ann'); const c = tw.view().chat.slice(-1)[0]; return { text: e.querySelector('.aline').textContent.replace(/\\s+/g, ' ').trim(), dice: [...e.querySelectorAll('.die')].map(d => +d.textContent), diceFs: parseFloat(getComputedStyle(e.querySelector('.dice')).fontSize), accent: getComputedStyle(e).getPropertyValue('--c').trim(), total: c.roll.total, rolls: c.roll.rolls, nat: e.classList.contains('nat20') || e.classList.contains('nat1') }; })()")
        os.makedirs(os.path.join(HERE, 'shots'), exist_ok=True); await gm.screenshot(path=os.path.join(HERE, 'shots', 'announce-roll.png'))
        want = f"Brakka · d20+5 → {rv['total']}"
        check(rv['text'] == want and rv['dice'] == rv['rolls'] and rv['diceFs'] < 20 and rv['accent'].lower() == '#6fc36f', 'a roll reads "Brakka · d20+5 → total", the individual dice small, in the roller\'s seat colour', rv)
        check(rv['nat'] == (rv['rolls'][0] in (1, 20)), 'natural 20 / natural 1 get the quiet emphasis (and only they)', rv['rolls'])
        cls = await gm.evaluate("""(() => { const el = document.createElement('div'); el.className = 'ann nat20'; el.style.setProperty('--c', '#fff'); el.innerHTML = '<div class="aline"><b class="total">20</b></div>'; document.getElementById('announce').append(el);
          const c = getComputedStyle(el.querySelector('.total')).color, sh = getComputedStyle(el).boxShadow; el.remove(); return { c, glow: sh.includes('rgba(240, 198, 92') }; })()""")
        check(cls['c'] in ('rgb(243, 198, 90)',) and cls['glow'], 'the nat-20 look: a gold total and a soft gold ring', cls)
        await landed(gm, (await gm.evaluate("tw.view().chat.slice(-1)[0].id")))

        print('REDUCED MOTION: a fade, no flight')
        await pl.emulate_media(reduced_motion='reduce')
        mid = await gm.evaluate(SAY('quiet please'))
        await wait(pl, f"{INFO}.showing?.id === '{mid}'", 8000, 'rm shows')
        await pl.click('#announce .ann')
        r = await landed(pl, mid)
        check(r['mode'] == 'fade' and await pl.evaluate(f"!document.querySelector('#chat .line.pending')"), 'prefers-reduced-motion: it fades out where it is and the log line fades in', r['mode'])

        real = [e for e in errors if not any(s in e for s in ('WebSocket', 'ERR_CONNECTION', '502', 'Refused:')) and not (A.local and 'Failed to load resource' in e)]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'browser announce: {passed}/{len(results)} passed')
    return passed == len(results)

try: ok = asyncio.run(main())
finally:
    for p in procs:
        try: p.terminate()
        except Exception: pass
sys.exit(0 if ok else 1)

#!/usr/bin/env python3
"""The reopened command bar is blank (Harry 2026-11-02, from Nick's note: "when you click it and it is presenting the last
option, that should never actually populate the bar itself. This mostly comes up if you do a 'say hello there' ... the
bar should itself be blank, and just give options from the last time below it.. which might include saying the thing.")

Real keystrokes and clicks. Say something, reopen with / and by clicking:
  no text and no chips in the bar, the placeholder as for an empty bar, "last: ..." below it, the say row listed below
  a bare Enter sends no second message; nor does Enter with the mouse resting on the row
  the Down arrow then Enter does send it; so does a click
  the same for a roll; a refresh while it is open brings no chips back
  what stays: typing replaces the list; Up fills the field; an ordinary list keeps its highlight and Enter runs it

  local:  TW_GPU=1 TW_PORTS=19000,19001 python3 engine/test/browser_barrecall.py --local
"""
import argparse, asyncio, json, math, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE); import served
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

procs = []; tmpdirs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '19000,19001').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-recall-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmpdirs.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500&nointro'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=60); return True
    except Exception: print(f'    (timed out: {what or js[:100]})'); return False

W, H = 1280, 720
STATE = """(() => { const i = document.querySelector('#bar textarea'), b = document.getElementById('bar').getBoundingClientRect(), l = document.querySelector('.bar-last'), res = [...document.querySelectorAll('#results .res')];
  return { open: document.getElementById('bar').classList.contains('open'), value: i.value, placeholder: i.placeholder, chips: document.querySelector('#bar .chips').innerText, chipEls: document.querySelectorAll('#bar .chips .chip').length, focused: document.activeElement === i,
    rows: res.map(e => e.innerText.replace(/\\s+/g, ' ').trim()), refs: res.map(e => e.dataset.ref || ''), hi: res.findIndex(e => e.classList.contains('hi')), last: l?.innerText || null, lastBelow: l ? l.getBoundingClientRect().top >= b.bottom : null, lastInBar: !!l && document.getElementById('bar').contains(l) }; })()"""
said = lambda pg, text: pg.evaluate(f"(tw.view()?.chat || []).filter(c => JSON.stringify(c).includes({json.dumps(text)})).length")
async def st(pg): return await pg.evaluate(STATE)
async def off(pg):  # the bar closed, the focus on the page, the pointer clear of the list
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(80)
    if (await st(pg))['open']: await pg.keyboard.press('Escape'); await pg.wait_for_timeout(80)
    await pg.evaluate("document.activeElement?.blur?.()"); await pg.mouse.move(640, 640); await pg.wait_for_timeout(80)
async def say(pg, text):
    await pg.keyboard.press('/'); await pg.wait_for_timeout(120); await pg.keyboard.type(f'say {text}'); await pg.wait_for_timeout(200); await pg.keyboard.press('Enter')
    await wait(pg, f"(tw.view()?.chat || []).some(c => JSON.stringify(c).includes({json.dumps(text)})) && tw.sync.pendingCount() === 0", 8000, 'said'); await pg.wait_for_timeout(150)
    await pg.evaluate("document.activeElement?.blur?.()"); await pg.mouse.move(640, 640); await pg.wait_for_timeout(80)

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500&nointro'
    GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': W, 'height': H}, reduced_motion='reduce')
        gm = await ctx.new_page()
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await gm.goto(page)
        NAME = f"TEST recall {time.strftime('%m-%d %H:%M:%S')} (throwaway)"
        await gm.fill('#newCampaign input[name=name]', NAME); await gm.fill('#newCampaign input[name=gm]', 'Fauna-test'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 60000), 'GM tab live', NAME)
        await gm.evaluate("document.querySelector('.lmcard .lm-x')?.click()"); await gm.wait_for_timeout(300)
        blank = (await st(gm))['placeholder']

        print('SAY SOMETHING, REOPEN')
        await gm.keyboard.press('/'); await gm.wait_for_timeout(120); await gm.keyboard.type('say hello there'); await gm.wait_for_timeout(200)
        t = await st(gm); check(t['value'] == 'hello there' and t['chips'] == 'say' and t['chipEls'] == 1, 'while typing, the bar shows the words once: "say" is the chip, the words plain text (Harry 2026-11-03, browser_barchips.py)', [t['chips'], t['value']])
        await gm.keyboard.press('Enter')
        await wait(gm, "(tw.view()?.chat || []).some(c => JSON.stringify(c).includes('hello there')) && tw.sync.pendingCount() === 0", 8000, 'said')
        check(await said(gm, 'hello there') == 1, 'one message sent')
        await gm.evaluate("document.activeElement?.blur?.()"); await gm.mouse.move(640, 640); await gm.wait_for_timeout(150)
        for how in ('/', 'a click'):
            if how == '/': await gm.keyboard.press('/')
            else: await gm.click('#bar textarea')
            await gm.wait_for_timeout(250)
            s = await st(gm)
            check(s['open'] and s['focused'] and s['value'] == '' and s['chips'] == '' and s['chipEls'] == 0, f'reopened by {how}: no text and no chips in the bar', {'value': s['value'], 'chips': s['chips']})
            check(s['placeholder'] == blank, f'reopened by {how}: the placeholder, as for an empty bar', s['placeholder'][:40])
            check(any('hello there' in r for r in s['rows']), f'reopened by {how}: the say row is listed below', s['rows'][:2])
            check(s['last'] == 'last: say hello there' and s['lastBelow'] and not s['lastInBar'], f'reopened by {how}: "last: ..." sits with the list, below the bar', s['last'])
            check(s['hi'] == -1, f'reopened by {how}: the say row is not the highlight (nothing says what Enter would do)', s['hi'])
            await gm.keyboard.press('Enter'); await gm.wait_for_timeout(350)
            check(await said(gm, 'hello there') == 1, f'reopened by {how}: a bare Enter sends no second message', await said(gm, 'hello there'))
            s2 = await st(gm); check(s2['open'] and s2['value'] == '', f'reopened by {how}: and leaves the bar as it was', s2['open'])
            await off(gm)
        print('A REFRESH WHILE IT IS OPEN')
        await gm.keyboard.press('/'); await gm.wait_for_timeout(200); await gm.evaluate("tw.refresh()"); await gm.wait_for_timeout(250)
        s = await st(gm); check(s['chips'] == '' and s['chipEls'] == 0 and s['hi'] == -1 and any('hello there' in r for r in s['rows']), 'a scene refresh brings no chips back and no highlight', s['chips'])

        print('CHOOSING IT')
        rowbox = await gm.locator('#results .res').first.bounding_box()
        await gm.mouse.move(rowbox['x'] + 40, rowbox['y'] + rowbox['height'] / 2); await gm.mouse.move(rowbox['x'] + 60, rowbox['y'] + rowbox['height'] / 2); await gm.wait_for_timeout(120)
        s = await st(gm); check(s['hi'] == 0, '(fixture) the mouse over the row lights it', s['hi'])
        await gm.keyboard.press('Enter'); await gm.wait_for_timeout(350)
        check(await said(gm, 'hello there') == 1, 'Enter with the mouse merely resting on the row sends nothing', await said(gm, 'hello there'))
        await off(gm)
        await gm.keyboard.press('/'); await gm.wait_for_timeout(200); await gm.keyboard.press('ArrowDown'); await gm.wait_for_timeout(100)
        s = await st(gm); check(s['hi'] == 0 and s['value'] == '' and s['chips'] == '', 'the Down arrow lights the row, and the bar stays blank', s['hi'])
        await gm.keyboard.press('Enter')
        await wait(gm, "(tw.view()?.chat || []).filter(c => JSON.stringify(c).includes('hello there')).length === 2 && tw.sync.pendingCount() === 0", 8000, 'said again')
        check(await said(gm, 'hello there') == 2, 'arrowed to, Enter sends it', await said(gm, 'hello there'))
        await gm.evaluate("document.activeElement?.blur?.()"); await gm.mouse.move(640, 640); await gm.wait_for_timeout(150)
        await gm.keyboard.press('/'); await gm.wait_for_timeout(250)
        await gm.locator('#results .res').first.click()
        await wait(gm, "(tw.view()?.chat || []).filter(c => JSON.stringify(c).includes('hello there')).length === 3 && tw.sync.pendingCount() === 0", 8000, 'said by click')
        check(await said(gm, 'hello there') == 3, 'a click on the row sends it', await said(gm, 'hello there'))

        print('A ROLL, THE SAME')
        await gm.evaluate("document.activeElement?.blur?.()"); await gm.mouse.move(640, 640); await gm.wait_for_timeout(100)
        ROLLS = "(tw.view()?.chat || []).length + (tw.view()?.rolls || []).length + (tw.view()?.dice || []).length"
        r0 = await gm.evaluate(ROLLS)
        await gm.keyboard.press('/'); await gm.wait_for_timeout(120); await gm.keyboard.type('roll d20+5'); await gm.wait_for_timeout(250); await gm.keyboard.press('Enter')
        await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(1200)
        n0 = await gm.evaluate(ROLLS); check(n0 > r0, '(fixture) a typed roll shows in the count', [r0, n0])
        await gm.evaluate("document.activeElement?.blur?.()"); await gm.mouse.move(640, 640); await gm.wait_for_timeout(100)
        await gm.keyboard.press('/'); await gm.wait_for_timeout(250); s = await st(gm)
        check(s['value'] == '' and s['chips'] == '' and s['hi'] == -1 and any('d20' in r for r in s['rows']), 'after a roll: blank, the roll row below', s['rows'][:1])
        await gm.keyboard.press('Enter'); await gm.wait_for_timeout(1000)
        check(await gm.evaluate(ROLLS) == n0, 'a bare Enter does not roll again', [n0, await gm.evaluate(ROLLS)])

        print('WHAT STAYS')
        await gm.keyboard.type('owlbear'); await gm.wait_for_timeout(250); s = await st(gm)
        check(s['value'] == 'owlbear' and not any('d20' in r for r in s['rows']) and s['last'] is None, 'typing replaces the list', s['rows'][:1])
        await off(gm)
        await gm.keyboard.press('/'); await gm.wait_for_timeout(200); await gm.keyboard.press('ArrowUp'); await gm.wait_for_timeout(200); s = await st(gm)
        check(s['value'] == 'd20+5' and s['chips'] == 'roll' and s['chipEls'] == 1, 'Up-arrow history still fills the bar, its chip and the words (you asked for that one)', [s['value'], s['chips']])
        await off(gm)
        await gm.keyboard.press('/'); await gm.wait_for_timeout(120); await gm.keyboard.press('ArrowUp'); await gm.wait_for_timeout(120); await gm.keyboard.press('ArrowUp'); await gm.wait_for_timeout(200); s = await st(gm)
        check(s['value'] == 'hello there' and s['chips'] == 'say' and s['chipEls'] == 1, 'Up to the say: the chip and the words are back, because you asked', [s['value'], s['chips']])
        n = await said(gm, 'hello there'); await gm.keyboard.press('Enter')
        await wait(gm, f"(tw.view()?.chat || []).filter(c => JSON.stringify(c).includes('hello there')).length === {n + 1} && tw.sync.pendingCount() === 0", 8000, 'said from history')
        check(await said(gm, 'hello there') == n + 1, 'and Enter on it sends: the text was there to see', await said(gm, 'hello there'))
        await gm.evaluate("document.activeElement?.blur?.()"); await gm.mouse.move(640, 640); await gm.wait_for_timeout(100)
        await gm.keyboard.press('/'); await gm.wait_for_timeout(120); await gm.keyboard.type('zoom in'); await gm.wait_for_timeout(250); s = await st(gm)
        await gm.keyboard.press('ArrowDown'); await gm.wait_for_timeout(80); before = await st(gm); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(120)
        if (await st(gm))['open']: await gm.keyboard.press('Escape'); await gm.wait_for_timeout(120)
        await gm.evaluate("document.activeElement?.blur?.()"); await gm.mouse.move(640, 640); await gm.wait_for_timeout(100)
        await gm.keyboard.press('/'); await gm.wait_for_timeout(250); s = await st(gm)
        check(s['hi'] == before['hi'] and before['hi'] >= 0 and s['rows'] == before['rows'] and s['chips'] == '', 'an ordinary list keeps its restored highlight', {'hi': s['hi'], 'row': s['rows'][s['hi']] if s['hi'] >= 0 else None})
        ref = s['refs'][s['hi']]
        await gm.keyboard.press('Enter'); await gm.wait_for_timeout(350)
        s2 = await st(gm)
        check(not s2['open'], 'and Enter runs it, as ever', ref)
        real = [e for e in errors if 'favicon' not in e]
        check(not real, 'no page errors', real[:3])
        await browser.close()
    bad = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(bad)}/{len(results)} checks passed")
    for r in bad: print('  FAIL', r[1], r[2])
    return 1 if bad else 0

code = 1
try: code = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for pr in procs:
        try: pr.wait(5)
        except Exception: pr.kill()
    for d in tmpdirs: shutil.rmtree(d, ignore_errors=True)
sys.exit(code)

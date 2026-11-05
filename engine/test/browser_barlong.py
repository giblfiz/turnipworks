#!/usr/bin/env python3
"""Long text grows the command bar (Harry 2026-11-02: "when I type like a freaking essay into the quickbar, it doesn't scale
to let me keep going, I just sort of get a visual mess as I'm typing").

Real keystrokes and a real paste, at a computer's width, a phone in both orientations, and text size 1.5:
  the bar grows line by line and stops at the limit; past it you keep typing and the caret stays in view
  nothing overlaps: the results and the column under the bar stay below it; the one chip (the verb) stays beside the text
  Enter sends the whole message and never breaks a line; Shift+Enter does not either; pasted line breaks become spaces
  the bar collapses afterward; the blank-bar rule holds
  the arrows move the caret by line inside wrapped text; Up recalls only from the first line
  short forms: the verb is the chip, the rest the text; a leading / is still dropped

  local:  TW_GPU=1 TW_PORTS=19002,19003 python3 engine/test/browser_barlong.py --local
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
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '19002,19003').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-long-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmpdirs.extend([data, site])
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

ESSAY = ' '.join(['the old road bends past the mill and the river runs brown under the bridge where the tolls were taken before the war'] * 14)  # about 300 words
GEO = """(() => { const b = document.getElementById('bar'), i = b.querySelector('textarea'), r = document.getElementById('results'), c = b.querySelector('.chips'), ub = document.getElementById('underBar'), a = document.getElementById('areaState');
  const R = (e) => { const q = e.getBoundingClientRect(); return { t: q.top, b: q.bottom, l: q.left, r: q.right, h: q.height, w: q.width }; }, cs = getComputedStyle(i);
  return { open: b.classList.contains('open'), bar: R(b), input: R(i), results: r.hidden ? null : R(r), chips: getComputedStyle(c).display === 'none' ? null : R(c), chipText: c.innerText, under: R(ub), area: a && getComputedStyle(a).display !== 'none' ? R(a) : null, value: i.value, scrollH: i.scrollHeight, clientH: i.clientHeight, scrollTop: i.scrollTop, caret: i.selectionStart, line: parseFloat(cs.lineHeight), H: innerHeight, W: innerWidth, grow: getComputedStyle(b.parentElement).getPropertyValue('--bar-grow').trim() }; })()"""
geo = lambda pg: pg.evaluate(GEO)
said = lambda pg, n: pg.evaluate(f"(tw.view()?.chat || []).filter(c => (c.text || '').length >= {n}).map(c => c.text)")

async def boot(browser, name, errors, **kw):
    ctx = await browser.new_context(reduced_motion='reduce', permissions=['clipboard-read', 'clipboard-write'], **kw)
    pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    await pg.goto(PAGE)
    await pg.fill('#newCampaign input[name=name]', f"TEST long bar {name} {time.strftime('%H:%M:%S')} (throwaway)"); await pg.fill('#newCampaign input[name=gm]', 'Fauna-test'); await pg.click('#newCampaign button')
    check(await wait(pg, 'window.tw && tw.ready && tw.ready()', 60000), f'{name}: live')
    await pg.evaluate("document.querySelector('.lmcard .lm-x')?.click()"); await pg.wait_for_timeout(400)
    return ctx, pg
async def closed(pg):
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(60)
    if (await geo(pg))['open']: await pg.keyboard.press('Escape'); await pg.wait_for_timeout(60)
async def opened(pg): await pg.evaluate("tw.emit('bar.open')"); await pg.wait_for_timeout(120)

async def sizes(pg, name, lines=6):
    """type, and watch the bar"""
    g0 = await geo(pg); rest = g0['bar']['h']
    await opened(pg)
    hs = []; text = 'say ' + ESSAY[:900]
    await pg.keyboard.type(text[:20]); hs.append((await geo(pg))['bar']['h'])
    for i in range(20, len(text), 24):  # (under a line at a time, on a phone too: the verb chip takes some of the width)
        await pg.keyboard.type(text[i:i + 24]); g = await geo(pg); hs.append(g['bar']['h'])
        if g['results'] and g['results']['t'] < g['bar']['b'] - 0.5: check(False, f'{name}: the results stayed under the bar as it grew', g['results'])
    g = await geo(pg)
    grown = sorted(set(round(h) for h in hs))
    limit = rest + (lines - 1) * g['line'] * (1.5 if name.startswith('text size') else 1)
    check(all(b >= a - 0.5 for a, b in zip(hs, hs[1:])) and len(grown) >= lines - 1, f'{name}: the bar grows line by line as you type', grown)
    check(abs(g['bar']['h'] - limit) < 2.5, f'{name}: it stops at {lines} lines', {'bar': round(g['bar']['h'], 1), 'limit': round(limit, 1), 'rest': round(rest, 1)})
    await pg.keyboard.type(' and on and on past the limit'); await pg.wait_for_timeout(100); g2 = await geo(pg)
    check(abs(g2['bar']['h'] - g['bar']['h']) < 0.6 and g2['value'].endswith('past the limit') and g2['scrollH'] > g2['clientH'] and abs(g2['scrollTop'] + g2['clientH'] - g2['scrollH']) < 3, f'{name}: past the limit you keep typing, the field scrolls and the caret stays in view', {'scrollH': g2['scrollH'], 'clientH': g2['clientH'], 'top': g2['scrollTop']})
    check(g2['results'] and g2['results']['t'] >= g2['bar']['b'] - 0.5 and g2['results']['b'] <= g2['H'] + 0.5, f'{name}: the results are under the bar and on screen', {'bar bottom': g2['bar']['b'], 'results': [g2['results'] and g2['results']['t'], g2['results'] and g2['results']['b']], 'H': g2['H']})
    check(g2['chips'] and g2['chipText'] == 'say' and g2['chips']['r'] <= g2['input']['l'] + 0.5 and g2['input']['w'] > g2['bar']['w'] * 0.6, f'{name}: one chip in the bar, the verb, beside the text (Harry 2026-11-03: the words are not a chip too); the text has the width', {'chip': g2['chipText'], 'field': round(g2['input']['w']), 'bar': round(g2['bar']['w'])})
    v = await pg.evaluate("(() => { const c = document.querySelector('#results .res.intent .chip.verb'), w = document.querySelector('#results .res.intent .chip:not(.verb)'); return c && [c.innerText, c.scrollWidth <= c.clientWidth + 1, !w]; })()")
    check(v and v[0] == 'say' and v[1] and v[2], f'{name}: the row below shows the verb whole, and not the words again', v)
    if g2['area'] and g2['area']['h']: check(g2['area']['t'] >= g2['bar']['b'] - 0.5, f'{name}: the column under the bar moved down with it', {'area top': g2['area']['t'], 'bar bottom': g2['bar']['b']})
    return g2, rest

async def main():
    global PAGE
    PAGE = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500&nointro'
    GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx, gm = await boot(browser, 'computer', errors, viewport={'width': 1280, 'height': 720})

        print('A COMPUTER: TYPING')
        g, rest = await sizes(gm, 'computer')
        print('ENTER SENDS IT WHOLE')
        whole = g['value']  # (the words: "say" is the chip)
        await gm.keyboard.press('Enter')
        await wait(gm, f"(tw.view()?.chat || []).some(c => (c.text || '').length >= {len(whole)}) && tw.sync.pendingCount() === 0", 8000, 'sent')
        got = await said(gm, len(whole)); check(got == [whole], 'Enter sends the whole message, once', {'sent': len(whole), 'arrived': [len(x) for x in got]})
        await gm.wait_for_timeout(150); g2 = await geo(gm)
        check(not g2['open'] and abs(g2['bar']['h'] - rest) < 0.6 and g2['value'] == '' and g2['grow'] == '0px', 'the bar collapses to its height, the text clears', {'h': g2['bar']['h'], 'grow': g2['grow']})
        ann = await gm.evaluate("(() => { const a = document.querySelector('#announce .ann'); if (!a) return null; const r = a.getBoundingClientRect(); return [r.top, r.bottom, r.left, r.right]; })()")
        check(ann and ann[0] >= 52 and ann[1] <= 720 and ann[2] >= 0 and ann[3] <= 1280, 'the centred announce of a long message stays on screen, clear of the bar', ann and [round(v) for v in ann])
        await gm.wait_for_timeout(300)
        if ann: await gm.locator('#announce .ann').first.click(force=True)
        await gm.wait_for_timeout(500)
        log = await wait(gm, f"[...document.querySelectorAll('#chat .line')].some(l => l.innerText.includes({json.dumps(whole[-24:])}))", 6000, 'the log line')
        if not log: print('   ', await gm.evaluate("(() => { const a = document.querySelector('#announce .ann'), l = [...document.querySelectorAll('#chat .line')].at(-1), c = getComputedStyle(l); return { ann: !!a, cls: a?.className, line: l.className, vis: c.visibility, disp: c.display, len: l.textContent.length, inner: l.innerText.length, log: tw.announce?.log?.slice?.(-1) }; })()"))
        check(log, 'the chat log has the end of it')
        await gm.evaluate("document.activeElement?.blur?.()"); await gm.keyboard.press('/'); await gm.wait_for_timeout(250); g3 = await geo(gm)
        check(g3['value'] == '' and g3['chips'] is None and abs(g3['bar']['h'] - rest) < 0.6, 'reopened: blank, at its resting height (the blank-bar rule holds after a long message)', {'value': g3['value'], 'h': g3['bar']['h']})
        await closed(gm)

        print('PASTING')
        await gm.evaluate(f"navigator.clipboard.writeText({json.dumps('say first line' + chr(10) + 'second line' + chr(13) + chr(10) + ESSAY[:700] + chr(10) + 'the last line')})")
        await opened(gm); await gm.keyboard.press('Control+v'); await gm.wait_for_timeout(250); g = await geo(gm)
        check('\n' not in g['value'] and 'first line second line' in g['value'] and g['value'].endswith('the last line'), 'pasted line breaks become spaces', g['value'][:44])
        check(abs(g['bar']['h'] - (rest + 5 * g['line'])) < 2.5 and g['results']['t'] >= g['bar']['b'] - 0.5, 'a paste grows the bar at once, to the limit', round(g['bar']['h']))
        await closed(gm); g = await geo(gm); check(abs(g['bar']['h'] - rest) < 0.6 and g['value'] == '', 'Escape closes it to its height, the text clears', g['bar']['h'])

        print('THE ARROWS IN WRAPPED TEXT')
        await opened(gm); await gm.keyboard.type('say ' + ESSAY[:300]); await gm.wait_for_timeout(120); g0 = await geo(gm)
        await gm.keyboard.press('ArrowUp'); await gm.wait_for_timeout(60); g1 = await geo(gm)
        check(g1['value'] == g0['value'] and g1['caret'] < g0['caret'], 'Up moves the caret up a line, the text stays', [g0['caret'], g1['caret']])
        await gm.keyboard.press('ArrowDown'); await gm.wait_for_timeout(60); g2 = await geo(gm)
        check(g2['value'] == g0['value'] and g2['caret'] > g1['caret'] and await gm.evaluate("document.querySelector('#results .res.hi')?.dataset.i") == '0', 'Down moves it back, the results are not entered', [g1['caret'], g2['caret']])
        await gm.keyboard.press('ArrowLeft'); await gm.keyboard.type('Q'); await gm.wait_for_timeout(60); g3 = await geo(gm)
        check(len(g3['value']) == len(g0['value']) + 1 and g3['value'][g3['caret'] - 1] == 'Q', 'typing in the middle goes where the caret is', g3['caret'])
        await gm.keyboard.press('Home'); await gm.keyboard.press('ArrowUp'); await gm.keyboard.press('ArrowUp'); await gm.keyboard.press('ArrowUp'); await gm.keyboard.press('Home'); await gm.wait_for_timeout(60); g4 = await geo(gm)
        await gm.keyboard.press('ArrowUp'); await gm.wait_for_timeout(120); g5 = await geo(gm)
        check(g4['caret'] == 0 and g5['value'] != g4['value'], 'on the first line Up recalls history, as ever', g5['value'][:30])
        await closed(gm)
        await gm.evaluate(f"navigator.clipboard.writeText({json.dumps('/say ' + ESSAY[:240])})")
        await opened(gm); await gm.keyboard.press('Control+v'); await gm.wait_for_timeout(200); g = await geo(gm)
        check(g['chipText'] == 'say' and g['value'].startswith('the old'), 'a leading / is still dropped', [g['chipText'], g['value'][:20]]); await closed(gm)

        print('SHIFT+ENTER')
        await opened(gm); await gm.keyboard.type('say one'); await gm.keyboard.press('Shift+Enter')
        await wait(gm, "(tw.view()?.chat || []).some(c => c.text === 'one') && tw.sync.pendingCount() === 0", 8000, 'shift-enter')
        check(await gm.evaluate("(tw.view()?.chat || []).some(c => c.text === 'one')"), 'Shift+Enter breaks no line: on a row that is no pick it runs it, as it always did (picks: browser_bar_picks)')
        await gm.evaluate("document.querySelectorAll('#announce .ann').forEach(a => a.click())"); await gm.wait_for_timeout(300)
        await closed(gm)

        print('SHORT FORMS, AND THE CUT AT 4000')
        for line in ('roll d20', 'say hello there'):
            await opened(gm); await gm.keyboard.type(line); await gm.wait_for_timeout(200); g = await geo(gm)
            check(g['chips'] is not None and g['chipText'] == line.split()[0] and g['value'] == line.split(' ', 1)[1] and abs(g['bar']['h'] - rest) < 0.6 and g['input']['w'] > 200, f'"{line}": its verb is the chip, the rest the text, on the one line', {'chip': g['chipText'], 'value': g['value'], 'field': round(g['input']['w'])})
            await closed(gm)
        await gm.evaluate(f"navigator.clipboard.writeText({json.dumps('say ' + (ESSAY + ' ') * 3)})")
        await opened(gm); await gm.keyboard.press('Control+v'); await gm.wait_for_timeout(250); await gm.keyboard.press('Enter')
        await wait(gm, "(tw.view()?.chat || []).some(c => (c.text || '').length === 4000) && tw.sync.pendingCount() === 0", 8000, 'cut message')
        check(len(await said(gm, 4000)) == 1, 'past 4000 characters a message is cut there and sent')
        check('cut to 4000' in await gm.evaluate("document.body.innerText"), 'and it says so')
        await gm.evaluate("document.querySelectorAll('#announce .ann').forEach(a => a.click())"); await gm.wait_for_timeout(400)
        await ctx.close()

        print('TEXT SIZE 1.5')
        ctx, gm = await boot(browser, 'text size', errors, viewport={'width': 1280, 'height': 800})
        await gm.evaluate("(() => { document.documentElement.style.setProperty('--ts', 1.5); })()"); await gm.wait_for_timeout(250)
        await sizes(gm, 'text size 1.5'); await closed(gm); await ctx.close()

        print('A PHONE')
        for name, w, h in (('phone portrait', 390, 844), ('phone landscape', 844, 390)):
            ctx, pg = await boot(browser, name, errors, viewport={'width': w, 'height': h}, is_mobile=True, has_touch=True, device_scale_factor=2)
            check(await pg.evaluate("document.documentElement.classList.contains('tw-hand')"), f'{name}: (fixture) the phone layout')
            g, rest = await sizes(pg, name)
            check(g['input']['w'] > 200, f'{name}: the field keeps its width', round(g['input']['w']))
            whole = g['value']
            over = await pg.evaluate("(() => { const a = document.getElementById('bar').getBoundingClientRect(), b = document.getElementById('roster').getBoundingClientRect(); return a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1 ? [a.right, b.left] : null; })()")
            check(not over, f'{name}: the grown bar does not run under the avatars', over)
            await pg.keyboard.press('Enter'); await wait(pg, f"(tw.view()?.chat || []).some(c => (c.text || '').length >= {len(whole)}) && tw.sync.pendingCount() === 0", 8000, 'sent')
            await wait(pg, "!!document.querySelector('#announce .ann')", 4000, 'announce'); await pg.wait_for_timeout(250)
            ann = await pg.evaluate("(() => { const a = document.querySelector('#announce .ann'); if (!a) return null; const r = a.getBoundingClientRect(), b = document.getElementById('bar').getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, H: innerHeight, W: innerWidth, bar: b.bottom }; })()")
            check(ann and ann['t'] >= ann['bar'] and ann['b'] <= ann['H'] and ann['l'] >= 0 and ann['r'] <= ann['W'], f'{name}: the announce stays on screen, clear of the bar', ann)
            await pg.evaluate("document.querySelectorAll('#announce .ann').forEach(a => a.click())"); await pg.wait_for_timeout(450)
            g2 = await geo(pg)
            check(await said(pg, len(whole)) == [whole] and abs(g2['bar']['h'] - rest) < 0.6, f'{name}: Enter sends it whole, the bar collapses', g2['bar']['h'])
            await ctx.close()

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

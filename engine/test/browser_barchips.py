#!/usr/bin/env python3
"""What you type in the command bar is shown once (Harry 2026-11-03: "you shouldn't be putting what I type into a chip and
into the bar simultaneously. Like if I 'say hello there everyone' it's fine for 'Say' to turn into a chip, but why are we
turning 'hello there everyone' into a chip... and worse we are turning it into a chip AND showing the typed text, so every
letter I type adds two to the bar.")

Real keystrokes, letter by letter, at a computer and on a phone:
  "say hello there everyone": "say" becomes the bar's one chip, the words stay plain text in the field, once; nothing else
  on screen shows them (not a chip in the bar, not the row below); Enter sends exactly them
  the same for a whisper (to a second tab) and a roll; then a long paragraph (the bar grows, nothing scrolls sideways)
  Backspace at the start of the field puts the word back as text; editing in the middle; paste; Esc; the 500 cut of a
  whisper; the reopened bar is blank and its list has the line, once
  stills for a blind read: engine/test/shots/barchips/

  local:  TW_GPU=1 TW_PORTS=19020,19021 python3 engine/test/browser_barchips.py --local
"""
import argparse, asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE); import served
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--no-shots', action='store_true')
A = ap.parse_args()
SHOTS = os.path.join(HERE, 'shots', 'barchips')
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

procs = []; tmpdirs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '19020,19021').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-chips-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmpdirs.extend([data, site])
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

# what is on screen: the bar's chip, its field, the line the bar works on, and how often a piece of text shows ANYWHERE
# else on the page (innerText: what is drawn; a field's value is not in it, so the field is counted apart)
SEEN = """(arg) => { const b = document.getElementById('bar'), i = b.querySelector('textarea'), chip = [...b.querySelectorAll('.chips .chip')].map(c => c.innerText);
  const n = (s, t) => { if (!t) return 0; let k = 0, at = 0; s = s.toLowerCase(); t = t.toLowerCase(); while ((at = s.indexOf(t, at)) >= 0) { k++; at += t.length; } return k; };
  const row = document.querySelector('#results .res.intent'), rowChips = row ? [...row.querySelectorAll('.chip')].map(c => c.innerText) : [];
  const bh = b.getBoundingClientRect().height, se = document.scrollingElement;
  return { open: b.classList.contains('open'), chip, value: i.value, line: (chip.length ? chip.join(' ') + ' ' : '') + i.value, caret: i.selectionStart, placeholder: i.placeholder,
    elsewhere: n(document.body.innerText, arg), where: arg ? [...document.querySelectorAll('body *')].filter(e => !e.children.length && e.innerText && n(e.innerText, arg)).map(e => `${e.className || e.tagName}: ${e.innerText.slice(0, 60)}`).slice(0, 3) : [], inField: n(i.value, arg), inPlaceholder: n(i.placeholder, arg), row: row ? row.innerText.replace(/\\s+/g, ' ').trim() : null, rowChips, barH: bh,
    hscroll: se.scrollWidth > innerWidth + 1 || b.scrollWidth > b.clientWidth + 1 || i.scrollWidth > i.clientWidth + 1 }; }"""
async def seen(pg, arg=''): return await pg.evaluate(SEEN, arg)
chat = lambda pg, text: pg.evaluate("(t) => (tw.view()?.chat || []).filter(c => c.text === t).length", text)
async def off(pg):
    for _ in range(2):
        if (await seen(pg))['open']: await pg.keyboard.press('Escape'); await pg.wait_for_timeout(80)
    await pg.evaluate("document.activeElement?.blur?.(); document.querySelectorAll('#announce .ann').forEach(a => a.click())"); await pg.mouse.move(640, 640); await pg.wait_for_timeout(150)
async def opened(pg): await pg.evaluate("document.activeElement?.blur?.()"); await pg.keyboard.press('/'); await pg.wait_for_timeout(150)
async def shot(pg, name, h=260):
    if A.no_shots: return
    os.makedirs(SHOTS, exist_ok=True); vw = pg.viewport_size
    await pg.screenshot(path=os.path.join(SHOTS, name), clip={'x': 0, 'y': 0, 'width': vw['width'], 'height': min(h, vw['height'])})

async def letter_by_letter(pg, verb, words, tag, min_len=5, skip=0):
    """type '<verb> <words>' a key at a time; after every key: the line is what was typed, the chip is the verb once the
    space is in, the words are in the field once and nowhere else on screen (past `skip`: a whisper's name may be named
    in the row, as the person it found). Returns the screen at the end."""
    typed, bad = '', []
    for ch in f'{verb} {words}':
        await pg.keyboard.type(ch); typed += ch; await pg.wait_for_timeout(25)
        arg = typed[len(verb) + 1:] if len(typed) > len(verb) else ''; w = arg[skip:].strip()
        s = await seen(pg, w if len(w) >= min_len else '')
        want_chip = [verb] if len(typed) > len(verb) else []
        if s['line'] != typed and s['line'] != typed.rstrip() + ' ': bad.append((typed, 'line', s['line']))
        if s['chip'] != want_chip: bad.append((typed, 'chip', s['chip']))
        if want_chip and s['value'] != arg: bad.append((typed, 'field', s['value']))
        if len(w) >= min_len and (s['elsewhere'] or s['inField'] != 1): bad.append((typed, 'shown', s['elsewhere'], s['inField'], s['where']))
        if len(w) >= 2 and any(w.lower() in c.lower() for c in s['rowChips'][1:]): bad.append((typed, 'row chip', s['rowChips']))
        if s['hscroll']: bad.append((typed, 'hscroll'))
    check(not bad, f'{tag}: typed "{verb} {words}" a key at a time: "{verb}" is the chip, the words are in the field once and nowhere else', bad[:4])
    return await seen(pg, words[skip:])

ESSAY = ' '.join(f'the old road bends past mill {k} and the river runs brown under bridge {k}, where the tolls were taken' for k in range(1, 12))

async def boot(browser, name, errors, url=None, **kw):
    ctx = await browser.new_context(reduced_motion='reduce', permissions=['clipboard-read', 'clipboard-write'], **kw)
    pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    await pg.goto(url or PAGE)
    if not url:
        await pg.fill('#newCampaign input[name=name]', f"TEST bar chips {name} {time.strftime('%H:%M:%S')} (throwaway)"); await pg.fill('#newCampaign input[name=gm]', 'Fauna-test'); await pg.click('#newCampaign button')
    check(await wait(pg, 'window.tw && tw.ready && tw.ready()', 60000), f'{name}: live')
    await pg.evaluate("document.querySelector('.lmcard .lm-x')?.click()"); await pg.wait_for_timeout(400)
    return ctx, pg

async def main():
    global PAGE
    PAGE = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500&nointro'
    if not A.no_shots: shutil.rmtree(SHOTS, ignore_errors=True)
    GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx, gm = await boot(browser, 'computer', errors, viewport={'width': 1280, 'height': 720})
        rest = (await seen(gm))['barH']

        print('SAY, A KEY AT A TIME')
        await opened(gm)
        s = await letter_by_letter(gm, 'say', 'hello there everyone', 'say')
        check(s['row'] and s['rowChips'][:1] == ['say'] and 'hello' not in s['row'], 'the row below says what Enter does, without the words', s['row'])
        await shot(gm, 'say-typing.png')
        await gm.keyboard.press('Enter')
        await wait(gm, "(tw.view()?.chat || []).some(c => c.text === 'hello there everyone') && tw.sync.pendingCount() === 0", 8000, 'said')
        check(await chat(gm, 'hello there everyone') == 1 and await chat(gm, 'say hello there everyone') == 0, 'Enter sends exactly "hello there everyone", once')
        await off(gm); await opened(gm); s = await seen(gm, 'hello there everyone')
        check(s['value'] == '' and s['chip'] == [] and s['row'] and 'hello there everyone' in s['row'] and s['elsewhere'] >= 1, 'reopened: the bar is blank, the last list below it has the whole say (the only copy of it in the bar\'s space)', {'row': s['row'], 'shown': s['elsewhere']})
        await gm.keyboard.press('Enter'); await gm.wait_for_timeout(300)
        check(await chat(gm, 'hello there everyone') == 1, 'and a bare Enter there sends nothing (the blank-bar rule)')
        await off(gm)

        print('A ROLL')
        await opened(gm)
        s = await letter_by_letter(gm, 'roll', 'd20+5', 'roll', min_len=4)
        check(s['rowChips'][:1] == ['roll'] and not any(x in ('d20', '+5', 'd20+5') for x in s['rowChips']), 'the roll row: the verb, no d20 ▸ +5 echoing the field', s['rowChips'])
        await shot(gm, 'roll-typing.png')
        n0 = await gm.evaluate("(tw.view()?.chat || []).filter(c => c.roll).length")
        await gm.keyboard.press('Enter')
        await wait(gm, f"(tw.view()?.chat || []).filter(c => c.roll).length > {n0} && tw.sync.pendingCount() === 0", 8000, 'rolled')
        r = await gm.evaluate("(tw.view()?.chat || []).filter(c => c.roll).at(-1)?.roll")
        check(r and r.get('expr') == 'd20+5' and 6 <= r['total'] <= 25, 'Enter rolls exactly d20+5', r and [r.get('expr'), r.get('total')])
        await off(gm)

        print('BACKSPACE INTO THE CHIP, EDITING IN THE MIDDLE, PASTE, ESC')
        await opened(gm); await gm.keyboard.type('say hi there'); await gm.keyboard.press('Home'); await gm.wait_for_timeout(60)
        await gm.keyboard.press('Backspace'); await gm.wait_for_timeout(80); s = await seen(gm)
        check(s['chip'] == [] and s['value'] == 'say hi there' and s['caret'] == 3, 'Backspace at the start of the field puts "say" back as text, the caret after it', [s['chip'], s['value'], s['caret']])
        await gm.keyboard.press('Backspace'); await gm.keyboard.type('y'); await gm.wait_for_timeout(80); s = await seen(gm)
        check(s['chip'] == [] and s['value'] == 'say hi there', 'editing the word: it stays text while the caret is in it', [s['chip'], s['value']])
        await gm.keyboard.press('End'); await gm.keyboard.type(' now'); await gm.wait_for_timeout(80); s = await seen(gm)
        check(s['chip'] == ['say'] and s['value'] == 'hi there now', 'typing on after it: the word is the chip again', [s['chip'], s['value']])
        await gm.keyboard.press('Enter'); await wait(gm, "(tw.view()?.chat || []).some(c => c.text === 'hi there now') && tw.sync.pendingCount() === 0", 8000, 'said 2')
        check(await chat(gm, 'hi there now') == 1, 'and Enter sends "hi there now"')
        await off(gm)
        await opened(gm); await gm.keyboard.type('say hello world')
        for _ in range(5): await gm.keyboard.press('ArrowLeft')
        await gm.keyboard.type('big '); await gm.wait_for_timeout(80); s = await seen(gm, 'hello big world')
        check(s['chip'] == ['say'] and s['value'] == 'hello big world' and s['inField'] == 1 and not s['elsewhere'], 'typing in the middle goes where the caret is; the chip stays', [s['chip'], s['value']])
        await gm.keyboard.press('Enter'); await wait(gm, "(tw.view()?.chat || []).some(c => c.text === 'hello big world') && tw.sync.pendingCount() === 0", 8000, 'said 3')
        check(await chat(gm, 'hello big world') == 1, 'Enter sends the edited line')
        await off(gm)
        await gm.evaluate(f"navigator.clipboard.writeText({json.dumps('say pasted one' + chr(10) + 'pasted two')})")
        await opened(gm); await gm.keyboard.press('Control+v'); await gm.wait_for_timeout(200); s = await seen(gm, 'pasted one pasted two')
        check(s['chip'] == ['say'] and s['value'] == 'pasted one pasted two' and not s['elsewhere'], 'a pasted say: the chip and the words, once, its line break a space', [s['chip'], s['value']])
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(120); s = await seen(gm)
        check(not s['open'] and s['value'] == '' and s['chip'] == [], 'Esc closes it: no text, no chip', s)
        await off(gm)
        await opened(gm); await gm.keyboard.type('say /shrug'); await gm.wait_for_timeout(80); s = await seen(gm)
        check(s['chip'] == ['say'] and s['value'] == '/shrug', 'a "/" after the chip is kept (only a leading one is the open key)', s['value'])
        await off(gm)

        print('A LONG PARAGRAPH')
        await opened(gm); await gm.keyboard.type('say '); bad = []
        for i in range(0, 700, 35):
            await gm.keyboard.type(ESSAY[i:i + 35]); s = await seen(gm, ESSAY[max(0, i - 5):i + 35].strip()[-28:])
            if s['chip'] != ['say'] or s['elsewhere'] or not s['inField'] or s['hscroll']: bad.append((i, s['chip'], s['elsewhere'], s['where'], s['hscroll']))
        s = await seen(gm)
        check(not bad and s['value'] == ESSAY[:700] and s['barH'] > rest + 60, 'a long paragraph: the bar grows, the words are in it once, nothing scrolls sideways', {'bad': bad[:3], 'h': [rest, s['barH']]})
        await shot(gm, 'long-typing.png', 360)
        whole = ESSAY[:700]
        await gm.keyboard.press('Enter'); await wait(gm, f"(tw.view()?.chat || []).some(c => c.text === {json.dumps(whole.strip())}) && tw.sync.pendingCount() === 0", 8000, 'long said')
        check(await chat(gm, whole.strip()) == 1, 'Enter sends the whole paragraph, once')
        await off(gm)

        print('A WHISPER, TO A SECOND TAB')
        invite = await gm.evaluate("(async () => { tw.registry.run('people.invite', { name: 'Mira' }); for (let i = 0; i < 100 && document.querySelector('#output').hidden; i++) await new Promise(r => setTimeout(r, 50)); return document.querySelector('#output textarea')?.value || ''; })()")
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
        pctx, mi = await boot(browser, 'Mira', errors, url=invite.replace('nopost', 'nofx'), viewport={'width': 900, 'height': 640})
        await wait(gm, "(tw.sync.campaign?.seats || []).some(s => s.name === 'Mira' && s.kind === 'human')", 8000, 'Mira seat')
        await off(gm); await opened(gm)
        s = await letter_by_letter(gm, 'whisper', 'Mira the north gate at dusk', 'whisper', skip=len('Mira '))
        check(s['inField'] == 1 and not s['elsewhere'] and 'to Mira' in s['rowChips'], 'the whisper row names who it goes to (a seat, found), not the message', s['rowChips'])
        await shot(gm, 'whisper-typing.png')
        await gm.keyboard.press('Enter')
        got = await wait(mi, "tw.whispers().some(w => w.text === 'the north gate at dusk')", 6000, 'whisper arrives')
        check(got and await mi.evaluate("tw.whispers().filter(w => w.text === 'the north gate at dusk').length") == 1, 'Enter whispers exactly "the north gate at dusk" to Mira, once')
        await off(gm)
        LONGW = ('a secret ' * 70).strip()
        await gm.evaluate(f"navigator.clipboard.writeText({json.dumps('whisper Mira ' + LONGW)})")
        await opened(gm); await gm.keyboard.press('Control+v'); await gm.wait_for_timeout(200); s = await seen(gm)
        check(s['chip'] == ['whisper'] and s['value'] == 'Mira ' + LONGW, 'a long pasted whisper: the chip and the words', s['chip'])
        await gm.keyboard.press('Enter')
        got = await wait(mi, f"tw.whispers().some(w => w.text === {json.dumps(LONGW[:500].strip())})", 6000, 'long whisper')
        check(got, 'a whisper over 500 characters arrives cut at 500, as before', len(LONGW))
        await off(gm); await pctx.close()
        await ctx.close()

        print('A PHONE')
        ctx, ph = await boot(browser, 'phone', errors, viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        check(await ph.evaluate("document.documentElement.classList.contains('tw-hand')"), 'phone: (fixture) the phone layout')
        await ph.evaluate("tw.emit('bar.open')"); await ph.wait_for_timeout(200)
        say_row = ph.locator('#results .res[data-ref="hand:say"]')
        if await say_row.count():
            await say_row.click(); await ph.wait_for_timeout(250); s = await seen(ph)
            check(s['chip'] == ['say'] and s['value'] == '' and s['placeholder'] == 'what to say…', 'phone: "Say…" opens the bar on the say chip, the field empty with "what to say…"', [s['chip'], s['value'], s['placeholder']])
            await ph.keyboard.press('Escape'); await ph.wait_for_timeout(150)
        else: check(False, 'phone: the empty bar has its Say… row')
        await ph.evaluate("tw.emit('bar.open')"); await ph.wait_for_timeout(150)
        s = await letter_by_letter(ph, 'say', 'hello from the phone', 'phone')
        await shot(ph, 'phone-typing.png', 300)
        await ph.keyboard.press('Enter'); await wait(ph, "(tw.view()?.chat || []).some(c => c.text === 'hello from the phone') && tw.sync.pendingCount() === 0", 8000, 'phone said')
        check(await chat(ph, 'hello from the phone') == 1, 'phone: Enter sends exactly the words')
        await ph.evaluate("tw.emit('bar.open')"); await ph.wait_for_timeout(150); await ph.keyboard.type('say ' + ESSAY[:400]); await ph.wait_for_timeout(150); s = await seen(ph, ESSAY[370:400])
        check(s['chip'] == ['say'] and s['value'] == ESSAY[:400] and s['inField'] and not s['elsewhere'] and not s['hscroll'] and s['barH'] > 80, 'phone: a long say grows the bar, once, nothing sideways', {'h': s['barH'], 'hscroll': s['hscroll'], 'where': s['where']})
        await shot(ph, 'phone-long.png', 360)
        await ph.keyboard.press('Escape'); await ctx.close()

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

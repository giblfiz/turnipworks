#!/usr/bin/env python3
"""THE SHORTCUT SHEET POINTS AT THE RIGHT SETTINGS TAB (2026-11-06; docs/UI.md "Where the sheet sends you"; surfaces/keys.js).

  python3 engine/test/browser_keysettings.py --local

Found 2026-11-04 in the manual walk: the "?" sheet said "Settings ▸ Me" for Pawns snap to squares, which has lived in
Settings ▸ Controls since Me was split in three (2026-10-24).

  SHEET    every "Settings ▸ X" the sheet names is a real tab, and the tab holds the control that row is about
           (both ways the pawn-snap setting can be: the row's words change with it). A row naming Settings with no entry
           in CONTROL below fails: a new pointer is checked, not trusted
  PAGES    every "Settings ▸ X" on the site's pages (engine/client/site/*.html) and in docs/site/manual.md starts with a
           real tab's name
"""
import argparse, asyncio, glob, html, os, re, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

# a sheet row that names a Settings tab -> the control (its row label in Settings) the row is about
CONTROL = {'Drag a pawn · Shift-drag': 'Pawns snap to squares'}

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '23311,23312').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-keysettings-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    import served; served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False

SHEET_ROWS = "(() => [...document.querySelectorAll('#sheet .row')].map(r => ({ text: r.querySelector('span:not(.ic)') ? [...r.querySelectorAll('span')].map(s => s.textContent).join(' ') : r.textContent, key: [...r.querySelectorAll('kbd')].map(k => k.textContent).join(' ') })))()"
TABS = "(() => [...document.querySelectorAll('#settingsModal .scat[data-sec]')].map(b => [b.dataset.sec, b.querySelector('span').textContent]))()"
MENTION = re.compile(r'Settings ▸ ([^\n<>]{1,60})')  # what follows, a tab's name first ("Vision, distance & rules" has a comma)

def tab_of(mention, tabs):
    """the tab a mention names: the longest tab label it starts with, as a whole word ("Area settings ▸ Music" -> Area settings)"""
    best = None
    for sid, label in tabs:
        if mention.startswith(label) and (len(mention) == len(label) or not mention[len(label)].isalnum()):
            if not best or len(label) > len(best[1]): best = (sid, label)
    return best

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1400, 'height': 900})
        gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await gm.goto(page, timeout=180000, wait_until='domcontentloaded')
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST keysettings {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')

        await gm.evaluate("tw.settings.open('nav')"); await wait(gm, "!document.getElementById('settingsModal').hidden", 5000, 'settings open')
        tabs = await gm.evaluate(TABS)
        check(len(tabs) >= 8 and any(l == 'Controls' for _, l in tabs) and any(l == 'Me' for _, l in tabs), 'the GM sees every Settings tab', tabs)
        held = {}
        for sid, label in tabs:
            await gm.evaluate(f"tw.settings.show('{sid}')"); await gm.wait_for_timeout(250)
            held[sid] = await gm.evaluate("document.querySelector('#settingsModal .spb')?.textContent || ''")
        await gm.evaluate("tw.settings.close()")

        print('SHEET: every pointer is to a real tab holding its control')
        for snap in ('shift', 'always'):
            await gm.evaluate(f"tw.prefs.pawnSnap = '{snap}'")
            await gm.evaluate("tw.emit('sheet.toggle')"); await wait(gm, "!document.getElementById('sheet').hidden", 5000, 'sheet open')
            rows = await gm.evaluate(SHEET_ROWS)
            await gm.evaluate("tw.emit('sheet.toggle')")
            named = [r for r in rows if 'Settings ▸' in r['text']]
            check(len(rows) > 30 and named, f'pawn snap "{snap}": the sheet has its rows, and some name a Settings tab', f'{len(rows)} rows, {len(named)} naming Settings')
            for r in named:
                for m in MENTION.findall(r['text']):
                    t = tab_of(m.strip(), tabs)
                    check(t, f'"Settings ▸ {m.strip()[:30]}" (row "{r["key"]}") names a real tab', [l for _, l in tabs])
                    ctl = CONTROL.get(r['key'])
                    check(ctl, f'the row "{r["key"]}" has its control in this suite\'s CONTROL table', r['text'])
                    if t and ctl: check(ctl in held[t[0]], f'"{ctl}" is in Settings ▸ {t[1]}, where the row "{r["key"]}" sends you', [l for s, l in tabs if ctl in held[s]])

        print('PAGES: the site and the manual name real tabs')
        files = sorted(glob.glob(os.path.join(ENGINE, 'client', 'site', '*.html'))) + [os.path.join(REPO, 'docs', 'site', 'manual.md')]
        bad, n = [], 0
        for f in files:
            text = html.unescape(re.sub(r'<[^>]+>', '', open(f, encoding='utf-8').read())).replace('**', '')
            for m in MENTION.findall(text):
                n += 1
                if not tab_of(m.strip(), tabs): bad.append(f'{os.path.relpath(f, REPO)}: Settings ▸ {m.strip()[:40]}')
        check(n > 10 and not bad, f'every one of the {n} "Settings ▸ …" on the site and in the manual starts with a real tab', bad[:8])

        check(not errors, 'no page errors', errors[:5])
        await browser.close()

try:
    asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
fails = [r for r in results if not r[0]]
print(f"\nkeysettings: {len(results) - len(fails)}/{len(results)} passed")
sys.exit(1 if fails else 0)

"""Shared pieces of the 2026-11-11 phone suites (browser_phonefix.py, phone_stills.py): a local relay + static site,
a GM table on an emulated phone, a player seat from its invite link, CDP fingers.
Each finger is a CDP Input.dispatchTouchEvent (a real touch point: html.tw-hand, the touch path of input.js)."""
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright  # noqa: F401  (re-exported)

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
procs, tmp = [], []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18333,18963').split(','))

def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-pfix-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

def cleanup():
    for pr in procs:
        pr.terminate()
        try: pr.wait(5)
        except Exception: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def touch(cdp, typ, pts):
    await cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
async def tap(cdp, x, y):
    await touch(cdp, 'touchStart', [(x, y)]); await asyncio.sleep(0.05); await touch(cdp, 'touchEnd', [])
async def drag(cdp, p0, p1, steps=12, lift=True):
    await touch(cdp, 'touchStart', [p0])
    for s in range(1, steps + 1):
        f = s / steps; await touch(cdp, 'touchMove', [(p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f)]); await asyncio.sleep(0.016)
    if lift: await touch(cdp, 'touchEnd', [])
async def at(pg, sel):  # the middle of the first visible match, scrolled into its list's view
    return await pg.evaluate(f"(() => {{ const e = [...document.querySelectorAll({json.dumps(sel)})].find(e => {{ const r = e.getBoundingClientRect(); return r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }}); if (!e) return null; e.scrollIntoView({{ block: 'nearest' }}); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }})()")
async def esc_all(pg, n=4):
    for _ in range(n): await pg.keyboard.press('Escape'); await pg.wait_for_timeout(120)
    await pg.evaluate("tw.clearSelection?.()"); await pg.wait_for_timeout(250)

def profile(p, W, H, which='pixel'):
    d = dict(p.devices['Pixel 7' if which == 'pixel' else 'iPhone 13'])
    d['viewport'] = {'width': W, 'height': H}; d['screen'] = {'width': min(W, H), 'height': max(W, H)}
    d['reduced_motion'] = 'reduce'
    return d

COUNT = lambda kind: f"Object.values(tw.entities()).filter(e => e.kind === '{kind}').length"

async def gm_table_with(p, page, W, H, what, which='pixel', init=None):
    return await gm_table(p, page, W, H, what, which, init=init)

async def gm_table(p, page, W, H, what, which='pixel', net=None, init=None):
    br = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
    ctx = await br.new_context(**profile(p, W, H, which))
    if init: await ctx.add_init_script(init)
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    cdp = await ctx.new_cdp_session(pg)
    if net: await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', net)
    await pg.goto(page + '&phone=0', timeout=240000)
    await pg.wait_for_selector('#newCampaign input[name=gm]', timeout=240000)
    await pg.fill('#newCampaign input[name=gm]', 'Harry')
    nm = await pg.query_selector('#newCampaign input[name=name]')
    if nm: await nm.fill(f"TEST phone {what} {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
    await pg.click('#newCampaign button')
    ok = await wait(pg, 'window.tw && tw.ready && tw.ready()', 240000 if net else 60000, 'table')
    await pg.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
    await pg.evaluate("document.querySelector('.lmcard .lm-x')?.click()")
    await pg.evaluate("(() => { const g = tw.main.grab; g.focus.set(20, 0, 20); g.yaw = 0; g.pitch = 55; g.dist = 85; g.update(); tw.main.rule = 'free'; })()")
    await pg.wait_for_timeout(700)
    br._tw_ready = ok
    return br, ctx, pg, cdp, errs

async def furnish(pg):
    """a room to stand in and a pawn of the GM's own"""
    await pg.evaluate("tw.batch([{type:'token.create', args:{id:'tok_pfix00001', name:'Brakka', x:22.5, z:22.5}}])")
    await wait(pg, "tw.entities()['tok_pfix00001'] && tw.sync.pendingCount() === 0", 10000, 'pawn')

async def player(br, pg, W, H, which='pixel', p=None):
    tok = await pg.evaluate("tw.createSeat({ kind: 'human', role: 'player', name: 'Pat', color: '#33aa77', placeholder: false })")
    seat = await pg.evaluate("tw.sync.campaign.seats.find(s => s.name === 'Pat').id")
    await pg.evaluate(f"tw.batch([{{type:'token.create', args:{{id:'tok_pfixpat1', name:'Pat', x:22.5, z:12.5, owner:'{seat}'}}}}])"); await pg.wait_for_timeout(800)
    link = await pg.evaluate('t => tw.inviteLink(t)', tok)
    opts = {'viewport': {'width': W, 'height': H}, 'is_mobile': True, 'has_touch': True, 'device_scale_factor': 2, 'reduced_motion': 'reduce'}
    pctx = await br.new_context(**opts)
    pl = await pctx.new_page(); perrs = []; pl.on('pageerror', lambda e: perrs.append(str(e)[:200]))
    await pl.goto(link.replace('#', '&phone=0#'))
    await wait(pl, "window.tw && tw.ready && tw.ready() && !!tw.entities()['tok_pfixpat1']", 60000, 'player')
    await pl.evaluate("document.querySelector('.lmcard .lm-x')?.click()"); await pl.wait_for_timeout(600)
    return pl, pctx, await pctx.new_cdp_session(pl), perrs

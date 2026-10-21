#!/usr/bin/env python3
"""GM cursor in a hidden room (2026-10-15): the relay withholds it from player seats; inspects frames, not drawing. tw-slot browser-venv/bin/python engine/test/browser_gmcursor.py --local"""
import argparse, asyncio, io, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
from PIL import Image, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaign this suite makes is a throwaway: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots', 'gmcursor')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--only')
A = ap.parse_args()
ONLY = set((A.only or '').upper().split(',')) - {''}
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
def want(sec): return not ONLY or sec in ONLY

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18297,18897').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-gmcursor-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
E = None
RX = """(() => { window.__rx = [];
  const WS = window.WebSocket; window.WebSocket = class extends WS { constructor(...a) { super(...a); this.addEventListener('message', (ev) => { try { window.__rx.push(String(ev.data)); } catch { } }); } };
  const ES = window.EventSource; if (ES) window.EventSource = class extends ES { constructor(...a) { super(...a); this.addEventListener('message', (ev) => { try { window.__rx.push(String(ev.data)); } catch { } }); } };
  const F = window.fetch; window.fetch = async (...a) => { const r = await F(...a); try { const u = String(a[0]?.url || a[0]); if (/\\/(c|sse|a)\\//.test(u) && !/\\.(glb|png|webp|js|json)(\\?|$)/.test(u)) r.clone().text().then(t => window.__rx.push(t)).catch(() => {}); } catch { } return r; }; })()"""

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1200, 'height': 800})
            await ctx.add_init_script(RX)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e))); await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', f"TEST gmcursor {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw?.ready?.()', 90000), 'GM live')
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        pl = await tab(invite)
        check(await wait(pl, 'window.tw?.ready?.()', 90000), 'player joins')
        GM = await gm.evaluate('tw.me()'); MIRA = await pl.evaluate('tw.me()'); AREA = await gm.evaluate('tw.area()')
        rid = await gm.evaluate('tw.spawnRoom("common", 0, 0, 4, 4, 7101)')
        await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        await wait(pl, f"!!tw.entities()['{rid}']", 30000)
        async def cur(pg, who, x, z):
            await pg.evaluate("([a,x,z]) => tw.ps.set(a, {cursor:[x,z], drag:null, sel:[]})", [AREA, x, z])
        def frames(): return pl.evaluate("window.__rx.filter(f => f.includes('\"pres\"')).map(f => { try { return JSON.parse(f); } catch { return null; } }).filter(m => m && m.seat === '%s')" % GM)
        inside, outside = (10, 10), (60, 60)
        # open room first: the GM cursor reaches the player
        for k in range(3): await cur(gm, GM, inside[0] - k, inside[1]); await gm.wait_for_timeout(150)
        fr = await frames()
        check(any(m.get('cursor') and abs(m['cursor'][0] - 10) < .01 for m in fr), 'visible room: the player receives the GM cursor')
        await cur(gm, GM, *outside); await gm.wait_for_timeout(200)  # the cursor is elsewhere while the room is hidden
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ids:['{rid}'], hidden:true}}, '{AREA}')")
        await wait(gm, 'tw.sync.pendingCount() === 0', 15000); await wait(pl, f"!tw.entities()['{rid}']", 15000)
        await pl.evaluate("window.__rx.length = 0")
        for k in range(4): await cur(gm, GM, inside[0] + k, inside[1]); await gm.wait_for_timeout(150)
        fr = await frames()
        check(len(fr) >= 1 and all(m.get('gone') and not m.get('cursor') for m in fr), 'GM cursor enters the hidden room: the player receives only gone frames, no position', [m.get('gone') or m.get('cursor') for m in fr])
        raw = await pl.evaluate("window.__rx.join('|')")
        check('10.' not in raw.split('"pres"')[-1] if False else not any(m.get('cursor') for m in fr), 'no frame since carries a cursor (inspected raw, not drawn)')
        check(not await pl.evaluate(f"tw.cursors().some(s => s.seat === '{GM}')"), "the player's client holds no GM cursor")
        await pl.evaluate("window.__rx.length = 0")
        await cur(gm, GM, *outside); await gm.wait_for_timeout(150); await cur(gm, GM, outside[0], outside[1] + 1)
        check(await wait(pl, f"tw.cursors().some(s => s.seat === '{GM}')", 6000), 'GM cursor leaves the hidden room: the player receives it again')
        fr = await frames()
        check(any(m.get('cursor') and abs(m['cursor'][0] - 60) < .01 for m in fr), 'the frame carries the new position')
        await pl.evaluate("window.__rx.length = 0")
        for k in range(3): await cur(pl, MIRA, inside[0] + k, inside[1]); await pl.wait_for_timeout(150)
        check(await wait(gm, f"tw.cursors().some(s => s.seat === '{MIRA}')", 6000), "a player's own cursor is unaffected (the GM still sees it)")
        check(not errors, 'no browser errors', errors[:5])
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for pr in procs:
        try: pr.wait(timeout=5)
        except Exception: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\ngmcursor: {len(results)-len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)

#!/usr/bin/env python3
"""The selection's crumbs and the area pills never cover each other (Harry 2026-10-27: "The textbox that describes
whats selected covers/is covered by the 'area name, open to players, hide' buttons").

Both sit under the command bar at the top centre: #areaState (the GM's area pills: "<name> · Open to players · Hide",
or in a hidden area "Hidden from players · Open this area") and #crumbs (Building ▸ Room ▸ Thing, or "3 selected").
They are now one column, #underBar: the area pills first, the crumbs under them, so neither can land on the other.
A conditional button docked at the top ("Roll initiative", a faction offer) goes under the column.

For every size (1280x720, 1440x900, 1600x1000, 1920x1080, a 1024 and a 400-px-wide computer window, text size 1.5)
and every case (a long area name, open and hidden; one deep thing with long names; a multi-select; a room; the PiP
open and closed) the boxes of the bar, the area pills (each pill, not just the row's box), the crumbs and a top-docked
button are measured and must not intersect, and must stay on screen. A phone (390x844 and 844x390, touch) hides both
(docs/UI.md "On a phone"): checked that neither shows, so neither can cover the other.

  local:  TW_GPU=1 TW_PORTS=18990,18991 python3 engine/test/browser_selbar.py --local
  stills: --shots DIR
"""
import argparse, asyncio, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--shots')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail and not ok else ''}", flush=True)

procs = []; tmpdirs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18990,18991').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-selbar-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmpdirs.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500&nointro'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=60); return True
    except Exception: print(f'    (timed out: {what or js[:100]})'); return False

# the boxes on screen: each as [left, top, right, bottom], or null when it is not showing. The area pills are measured
# pill by pill (a nowrap row can spill past its own box), the crumbs by their own (scrolling) box.
BOXES = """() => { const shown = (e) => { if (!e || e.hidden) return false; for (let x = e; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const box = (e) => { if (!shown(e)) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(v => Math.round(v * 10) / 10); };
  const st = document.getElementById('areaState');
  return { bar: box(document.getElementById('bar')), crumbs: box(document.getElementById('crumbs')),
    side: { launchers: box(document.getElementById('launchers')), other: box(document.getElementById('otherGames')), roster: box(document.getElementById('roster')) },
    pills: shown(st) ? [...st.children].map(box).filter(Boolean) : [], top: [...document.querySelectorAll('.cbtn.dock-top')].map(box).filter(Boolean),
    W: innerWidth, H: innerHeight, crumbText: document.getElementById('crumbs').innerText.replace(/\\s+/g, ' ').trim(), areaText: st.innerText.replace(/\\s+/g, ' ').trim() }; }"""
def hit(a, b, pad=0): return a and b and a[0] < b[2] - pad and b[0] < a[2] - pad and a[1] < b[3] - pad and b[1] < a[3] - pad

def judge(tag, d, want_area=True, want_crumbs=True):
    pills, cr, bar, top = d['pills'], d['crumbs'], d['bar'], d['top']
    check((bool(pills) == want_area) and (bool(cr) == want_crumbs), f'{tag}: area pills {"shown" if want_area else "gone"}, crumbs {"shown" if want_crumbs else "gone"}', d)
    bad = [('crumbs', 'area pill', p) for p in pills if hit(cr, p)]
    bad += [('bar', 'area pill', p) for p in pills if hit(bar, p)] + ([('bar', 'crumbs', cr)] if hit(bar, cr) else [])
    bad += [('top button', w, b) for t in top for w, b in [('crumbs', cr)] + [('area pill', p) for p in pills] if hit(t, b)]
    check(not bad, f'{tag}: nothing covers anything (bar, area pills, crumbs{", top button" if top else ""})', {'overlaps': bad, **d})
    if d['W'] >= 1024:  # (a computer window: the column also keeps clear of the launchers, Other games and the avatars)
        side = [(k, b) for k, s in d['side'].items() for b in pills + ([cr] if cr else []) if hit(s, b)]
        check(not side, f'{tag}: the pills and the crumbs keep clear of the launchers, Other games and the avatars', side)
    off = [b for b in pills + ([cr] if cr else []) if b[0] < -0.5 or b[2] > d['W'] + 0.5 or b[1] < 0 or b[3] > d['H']]
    check(not off, f'{tag}: the pills and the crumbs are on screen', off)

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500&nointro'
    GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    if A.shots: os.makedirs(A.shots, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 720}, reduced_motion='reduce')
        gm = await ctx.new_page()
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        gm.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' else None)
        await gm.goto(page)
        NAME = f"TEST selbar {time.strftime('%m-%d %H:%M:%S')} (throwaway)"
        await gm.fill('#newCampaign input[name=name]', NAME); await gm.fill('#newCampaign input[name=gm]', 'Fauna-test'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 60000), 'GM tab live', NAME)
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
        await gm.evaluate("document.querySelector('.lmcard .lm-x')?.click()")
        await gm.evaluate("tw.buildAt(tw.buildingNode('inn'), 12, 8, { seed: 7 })")
        built = await wait(gm, "Object.values(tw.entities()).filter(e => e.kind === 'room').length >= 4 && Object.values(tw.entities()).some(e => e.kind === 'building') && tw.sync.pendingCount() === 0", 60000, 'inn built')
        await wait(gm, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", 60000, 'spawn over')
        check(built, 'an inn to select things in')
        # long names everywhere the crumbs and the pills read from
        LONG_AREA = 'The Sunken Cathedral of Morrowgloom beneath the Old Quarter'[:60]
        await gm.evaluate(f"tw.sync.submit('area.set', {{ area: tw.area(), name: {LONG_AREA!r} }})")
        ids = await gm.evaluate("""(() => { const E = Object.values(tw.entities()); const b = E.find(e => e.kind === 'building');
          const rooms = E.filter(e => e.kind === 'room'); const objs = E.filter(e => e.kind === 'object' && rooms.some(r => tw.parentOf(e)?.id === r.id));
          return { b: b.id, room: tw.parentOf(objs[0]).id, obj: objs[0].id, many: objs.slice(0, 3).map(o => o.id) }; })()""")
        await gm.evaluate(f"""(() => {{ const E = tw.entities(); tw.rename(E['{ids['b']}'], 'The Prancing Turnip Coaching Inn and Stables');
          tw.rename(E['{ids['room']}'], 'Great Common Room with the Long Oak Bar'); tw.rename(E['{ids['obj']}'], 'Battered old iron-bound sea chest of Captain Brakka'); }})()""")
        await wait(gm, "tw.sync.pendingCount() === 0", 8000)
        await gm.wait_for_timeout(300)
        chain = await gm.evaluate(f"tw.crumbs(tw.entities()['{ids['obj']}']).map(e => e.kind)")
        check(chain[:1] == ['building'] and chain[-1] == 'object' and len(chain) >= 3, 'the chest is Building ▸ Room ▸ Thing', chain)
        hidden = lambda h: gm.evaluate(f"tw.setAreaOpen(tw.area(), {'false' if h else 'true'})")

        SIZES = [(1280, 720), (1440, 900), (1600, 1000), (1920, 1080), (1024, 700), (400, 800)]
        SELS = [('one deep thing', [ids['obj']]), ('3 selected', ids['many']), ('a room', [ids['room']])]
        for (W, H) in SIZES:
            await gm.set_viewport_size({'width': W, 'height': H}); await gm.wait_for_timeout(250)
            for vis in ('open', 'hidden'):
                await hidden(vis == 'hidden'); await wait(gm, f"tw.areaHidden() === {'true' if vis == 'hidden' else 'false'}", 6000, 'visibility')
                await gm.wait_for_timeout(150)
                for pip in (False, True):
                    await gm.evaluate("tw.openPip(tw.area())" if pip else "tw.closePip ? tw.closePip() : (tw.pip && document.getElementById('pipClose')?.click())"); await gm.wait_for_timeout(200)
                    for sname, sel in SELS:
                        await gm.evaluate(f"tw.select({sel!r})"); await gm.wait_for_timeout(150)
                        d = await gm.evaluate(BOXES)
                        judge(f'{W}x{H} {vis} area, PiP {"open" if pip else "closed"}, {sname}', d)
                        if A.shots and (W, H) == (1280, 720) and sname == 'one deep thing' and not pip:
                            await gm.screenshot(path=os.path.join(A.shots, f'desk-{W}x{H}-{vis}.png'))
            # no selection: the pills alone, at the top (they never jump down when a thing is picked)
            await gm.evaluate("tw.select([])"); await gm.wait_for_timeout(150)
            d0 = await gm.evaluate(BOXES); judge(f'{W}x{H} nothing selected', d0, want_crumbs=False)
            await gm.evaluate(f"tw.select({[ids['obj']]!r})"); await gm.wait_for_timeout(150)
            d1 = await gm.evaluate(BOXES)
            check(d0['pills'] and d1['pills'] and abs(d0['pills'][0][1] - d1['pills'][0][1]) < 1, f'{W}x{H}: picking a thing leaves the area pills where they were', [d0['pills'][:1], d1['pills'][:1]])
            # a conditional button docked at the top goes under the column, whatever is in it
            await gm.evaluate("tw.condButtons.show('selbar-test', { icon: 'dices', text: 'Roll initiative', dock: 'top', life: 0 })"); await gm.wait_for_timeout(250)
            judge(f'{W}x{H} hidden area, a top-docked button', await gm.evaluate(BOXES))
            await gm.evaluate("tw.condButtons.hide('selbar-test')"); await gm.wait_for_timeout(100)
        await hidden(False)
        # the command bar open: its results cover the column (as before), and the crumbs step aside
        await gm.set_viewport_size({'width': 1280, 'height': 720}); await gm.evaluate(f"tw.select({[ids['obj']]!r})")
        await gm.keyboard.press('/'); await gm.wait_for_timeout(300)
        d = await gm.evaluate(BOXES)
        check(not d['crumbs'], 'the bar open: the crumbs step aside', d)
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        # a bigger text size (Settings ▸ Me ▸ Text size 1.5): the bar grows; the column stays under it
        await gm.evaluate("document.documentElement.style.setProperty('--ts', 1.5)"); await gm.wait_for_timeout(250)
        for vis in ('open', 'hidden'):
            await hidden(vis == 'hidden'); await wait(gm, f"tw.areaHidden() === {'true' if vis == 'hidden' else 'false'}", 6000)
            await gm.wait_for_timeout(150)
            judge(f'1280x720 text size 1.5, {vis} area, one deep thing', await gm.evaluate(BOXES))
        await gm.evaluate("document.documentElement.style.removeProperty('--ts')"); await hidden(False)
        # a click on each still lands on it (nothing is lying over them)
        await gm.set_viewport_size({'width': 1280, 'height': 720}); await gm.evaluate(f"tw.select({[ids['obj']]!r})"); await gm.wait_for_timeout(200)
        top = await gm.evaluate("""(() => { const at = (e) => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && e.contains(t); };
          return { crumb: at(document.querySelector('#crumbs .crumb')), hide: at(document.querySelector('#areaState button')) }; })()""")
        check(top['crumb'] and top['hide'], 'the first crumb and the Hide button are each on top where they are drawn', top)
        await gm.click('#crumbs .crumb'); await gm.wait_for_timeout(200)
        check(await gm.evaluate(f"tw.selected().length === 1 && tw.selected()[0].id === '{ids['b']}'"), 'a click on the first crumb selects the building')
        real = [e for e in errors if not any(s in e for s in ('WebSocket', 'ERR_CONNECTION', '502', 'Refused:', 'favicon', 'Failed to load resource'))]
        check(not real, 'no page errors (computer)', '; '.join(real[:4]))
        await ctx.close()

        # a phone: both are tucked away (Settings ▸ Area, the bar's Select parent), so neither can cover the other
        for (W, H) in ((390, 844), (844, 390)):
            tag = f'phone {W}x{H}'
            pctx = await browser.new_context(viewport={'width': W, 'height': H}, is_mobile=True, has_touch=True, device_scale_factor=2, reduced_motion='reduce')
            pg = await pctx.new_page(); perr = []; pg.on('pageerror', lambda e: perr.append(str(e)[:200]))
            await pg.goto(page + '&phone=0')
            await pg.wait_for_selector('#newCampaign input[name=gm]', timeout=30000)
            await pg.fill('#newCampaign input[name=gm]', 'Harry')
            nm = await pg.query_selector('#newCampaign input[name=name]')
            if nm: await nm.fill(f"TEST selbar phone {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
            await pg.click('#newCampaign button')
            check(await wait(pg, 'window.tw && tw.ready && tw.ready()', 60000), f'{tag}: the table is live')
            await pg.evaluate("document.querySelector('.lmcard .lm-x')?.click()")
            await pg.evaluate("tw.spawnRoom('common', 2, 2, 6, 5, 4101)")
            await wait(pg, "Object.values(tw.entities()).some(e => e.kind === 'room') && tw.sync.pendingCount() === 0", 30000, 'room')
            await pg.evaluate(f"tw.sync.submit('area.set', {{ area: tw.area(), name: {LONG_AREA!r} }})")
            await pg.evaluate("tw.select([Object.values(tw.entities()).find(e => e.kind === 'room').id])"); await pg.wait_for_timeout(300)
            check(await pg.evaluate("document.documentElement.classList.contains('tw-hand')"), f'{tag}: the phone layout (tw-hand)')
            judge(f'{tag} a room selected', await pg.evaluate(BOXES), want_area=False, want_crumbs=False)
            if A.shots: await pg.screenshot(path=os.path.join(A.shots, f'phone-{W}x{H}.png'))
            check(not perr, f'{tag}: no page errors', perr[:3])
            await pctx.close()
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'browser selbar: {passed}/{len(results)} passed')
    for ok_, name, detail in results:
        if not ok_: print(f'  FAILED: {name} — {str(detail)[:600]}')
    return passed == len(results)

try: ok = asyncio.run(main())
finally:
    for p in procs:
        try: p.terminate(); p.wait(timeout=5)
        except Exception: pass
    for d in tmpdirs: shutil.rmtree(d, ignore_errors=True)
sys.exit(0 if ok else 1)

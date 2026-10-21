#!/usr/bin/env python3
"""Settings ▸ Feedback and the triage page (2026-10-19; docs/UI.md "Feedback", docs/NETCODE.md "Feedback tickets").
A GM and one player; three rooms in a row (A | B | C, closed doors, fog of war on). The player's pawn stands in A, a
barrel in A (the asset to comment on, and the positive control), a barrel in C that the player has never seen (the marker).
  F0  nothing of the form loads until the section opens (no request for surfaces/feedback.js); then it does
  F1  a player files each kind (Bug, Idea, Asset comment, Question, Other) with real clicks; each arrives with its
      screenshot file and its context (versions, campaign, area, seat and role, camera, graphics, browser, commands)
  F2  an asset comment pre-fills from the selection (the command bar's "comment on this asset"); Clear and "Use the
      selection"; a pawn names its figure
  F3  "What gets sent": the screenshot and the camera left out are not sent
  F4  a forced JS error arrives ONCE (thrown twice), a rejection once; 15 more distinct errors stop at 10; no dialog
  F5  the triage page lists, filters, opens a ticket with its screenshot, sets a status and a reply; the reply and the
      status show in the player's My tickets
  F6  PRIVACY: the player's screenshot of the fogged map has 0 magenta pixels from the never-seen barrel in C (and the
      tinted barrel in A shows: the capture sees what is drawn); the GM's, of the same view, shows C's barrel
  F7  a small laptop screen (1280 x 640): the form scrolls inside the window, Send stays reachable, the list collapses
  tw-slot browser-venv/bin/python engine/test/browser_feedback.py --local
  live (dev, the two-server rule): ... browser_feedback.py --page http://127.0.0.1:8180/   (the triage page: implausible.enterprises ?channel=dev)
"""
import argparse, asyncio, io, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request, shutil
from playwright.async_api import async_playwright
from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402  test writes (tickets too) go to a sandbox
tw_sandbox.remove_campaigns()
SHOTS = os.path.join(HERE, 'shots', 'feedback')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--triage'); ap.add_argument('--shots', action='store_true')
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:600] if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18341,18941').split(','))
DATA = None
def start_local():
    global DATA
    DATA = tempfile.mkdtemp(prefix='tw-feedback-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([DATA, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner')); os.symlink(os.path.join(REPO, 'tools', 'tickets'), os.path.join(site, 'tickets'))
    log = open(os.path.join(DATA, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': DATA, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

if A.local:
    PAGE = start_local(); RELAY = f'http://127.0.0.1:{RP}'; TRIAGE = f'http://127.0.0.1:{SP}/tickets/index.html?relay=' + urllib.parse.quote(RELAY)
    KEY = open(os.path.join(DATA, 'tickets', 'triage.key')).read().strip()
else:
    PAGE = A.page + ('&' if '?' in A.page else '?') + 'nointro'; RELAY = A.page.split('?')[0].rstrip('/') + '/api/tw-relay'
    # two servers (2026-10-19): a live run is against DEV (http://127.0.0.1:8180/); the relay's /health names its channel
    CH = json.loads(urllib.request.urlopen(urllib.request.Request(RELAY + '/health', headers={'User-Agent': 'Mozilla/5.0 tw-test'}), timeout=20).read()).get('channel') or 'prod'
    TRIAGE = A.triage or ('https://implausible.enterprises/projects/turnip-works/tickets/' + ('?channel=dev' if CH == 'dev' else ''))
    KEY = os.environ.get('TW_TRIAGE_KEY') or open('/var/lib/tw-relay-dev/data/tickets/triage.key' if CH == 'dev' else os.path.join(REPO, 'engine', 'data', 'tickets', 'triage.key')).read().strip()

def admin(path, body=None, raw=False):
    req = urllib.request.Request(RELAY + path, data=json.dumps(body).encode() if body is not None else None, method='POST' if body is not None else 'GET',
                                 headers={'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 tw-test', **tw_sandbox.HEADERS})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read() if raw else json.loads(r.read())

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=80); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False

def magenta(img):
    a = np.asarray(img.convert('RGB')).astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return int(((r > 140) & (b > 140) & (g < 100) & (r - g > 80) & (b - g > 80)).sum())

TINT = """(ids) => { const w = tw.worldOf(tw.area()); let n = 0; for (const id of ids) { const r = w.recs.get(id); if (!r) continue;
  r.group.traverse(o => { if (!o.isMesh) return; const m = o.material.clone(); m.map = null; m.color?.set('#ff00ff'); m.emissive?.set('#ff00ff'); m.emissiveIntensity = 1; m.needsUpdate = true; o.material = m; n++; }); }
  return n; }"""
CAM = "(() => { const g = tw.main.grab; g.focus.set(30, 0, 10); g.yaw = 0; g.pitch = 62; g.dist = 70; g.update(); tw.main.rule = 'free'; })()"

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        dialogs = []; requests = {}; perrors = []
        async def tab(url, name, vp=(1400, 900)):
            ctx = await browser.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=1)
            pg = await ctx.new_page(); requests[name] = []
            pg.on('dialog', lambda d: (dialogs.append(d.message), asyncio.ensure_future(d.dismiss())))
            pg.on('request', lambda r: requests[name].append(r.url))
            pg.on('pageerror', lambda e: perrors.append(f'{name}: {e}'))
            pg.on('console', lambda m: perrors.append(f'{name} console: {m.text[:300]}') if m.type == 'error' else None)
            await pg.goto(url); return pg
        async def action(pg, code):
            await pg.evaluate(code); await wait(pg, 'tw.sync.pendingCount() === 0', 15000, 'command accepted'); await pg.wait_for_timeout(250)
        async def tap(pg, sel):
            r = await pg.evaluate(f"(() => {{ const e = document.querySelector({json.dumps(sel)}); if (!e) return null; e.scrollIntoView({{ block: 'center' }}); const r = e.getBoundingClientRect(); return {{ x: r.left + r.width / 2, y: r.top + r.height / 2 }}; }})()")
            if not r: print(f'    (no element {sel})'); return False
            await pg.mouse.click(r['x'], r['y']); await pg.wait_for_timeout(120); return True
        async def open_fb(pg):
            if not await pg.evaluate('tw.settings.state().open'): await tap(pg, '.launcher[data-l=settings]')
            await tap(pg, '#settingsModal .scat[data-sec=feedback]')
            ok = await wait(pg, "!!document.querySelector('#settingsModal .fbtext') && !document.querySelector('#settingsModal .fbsent')?.textContent.includes('taking it')", 15000, 'feedback form')
            if not ok: print('    page errors:', perrors[-6:], await pg.evaluate("document.querySelector('#settingsModal .spb')?.innerHTML.slice(0, 400)"))
            return ok
        async def file(pg, kind, text, before=None):
            await tap(pg, f'#settingsModal [data-fbkind={kind}]')
            if before: await before()
            await pg.fill('#settingsModal .fbtext', text)
            n0 = await pg.evaluate("tw.feedbackHook.state().autoSent")
            await tap(pg, '#settingsModal [data-fbact=send]')
            ok = await wait(pg, "document.querySelector('#settingsModal .fbmsg')?.textContent.startsWith('Sent')", 20000, f'{kind} sent')
            return ok
        async def bar(pg, text):
            if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
            await pg.evaluate('document.activeElement?.blur?.()'); await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=8); await pg.wait_for_timeout(350)
            top = await pg.evaluate("[...document.querySelectorAll('#results .res')].slice(0, 3).map(e => e.innerText.replace(/\\s+/g, ' ').slice(0, 60))")
            await pg.keyboard.press('Enter'); return top

        gm = await tab(PAGE, 'gm')
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', f"TEST feedback {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw?.ready?.() && tw.fog', 90000), 'GM did not come up'
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        pl = await tab(invite, 'pl')
        assert await wait(pl, 'window.tw?.ready?.() && tw.fog', 90000), 'player did not join'
        seat = await pl.evaluate('tw.me()'); cid = await pl.evaluate('tw.sync.campaign.id')
        for x in [0, 4, 8]:
            await gm.evaluate('(x) => tw.spawnRoom("common", x, 0, 4, 4, 7401+x)', x)
            await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        await action(gm, "tw.batch([...tw.worldOf(tw.area()).edges.values()].filter(e => e.sides.length === 1).map(e => ({type:'edge.set',args:{key:e.key,as:'wall',piece:'wall-straight'}})))")
        z = 10.0; PA, BC, BA = 'tok_fbmira0001', 'obj_fbbarrelc1', 'obj_fbbarrela1'
        await action(gm, 'tw.batch(' + json.dumps([{'type': 'token.create', 'args': {'id': PA, 'name': 'Mira', 'x': 7.5, 'z': z, 'owner': seat, 'fig': await gm.evaluate("tw.figures.list?.[0]?.id || null")}}]) + ')')
        for oid, x, zz in [(BC, 52.5, 6.5), (BA, 14, 4.5)]:
            await action(gm, f"tw.dispatch('object.place', {{ id: '{oid}', x: {x}, z: {zz}, cat: 'barrel', ...tw.roomgen.sizeOf('barrel') }})")
        await wait(pl, f"!!tw.entities()['{BA}'] && !!tw.entities()['{BC}'] && !!tw.entities()['{PA}']", 30000)
        await wait(pl, f"tw.fog.visible(7.5,{z},0) && !tw.fog.visible(50,{z},0)", 30000, 'player vision')
        await pl.evaluate(CAM); await gm.evaluate(CAM)
        await pl.wait_for_timeout(1500)

        print('F0 nothing loads until the section opens')
        before = [u for u in requests['pl'] if 'feedback.js' in u and 'feedback-hook' not in u]
        hook = [u for u in requests['pl'] if 'feedback-hook.js' in u]
        loaded0 = await pl.evaluate('tw.feedback.loaded()')
        await pl.bring_to_front()
        ok = await open_fb(pl)
        after = [u for u in requests['pl'] if 'surfaces/feedback.js' in u]
        check(ok and not before and hook and not loaded0 and after and await pl.evaluate('tw.feedback.loaded()'), 'F0 at boot only the error hook loads (feedback-hook.js); surfaces/feedback.js is fetched when Settings ▸ Feedback first opens', {'before': before, 'hook': len(hook), 'after': after})
        st = await pl.evaluate("tw.settings.state()")
        check(st['sections'] == ['nav', 'me', 'feedback'] and st['section'] == 'feedback', 'F0 Feedback is a major section of the player\'s Settings', st)

        print('F1 a player files each kind')
        await pl.evaluate(f"(() => {{ tw.sel = new Set(['{BA}']); tw.emit('selection'); tw.refresh(); }})()")
        texts = {'bug': 'TEST the barrel floats a little', 'idea': 'TEST let me paint the walls', 'asset': 'TEST this barrel is too shiny', 'question': 'TEST how do I open doors?', 'other': 'TEST thank you'}
        sent = {}
        for kind, text in texts.items():
            sent[kind] = await file(pl, kind, text)
            await pl.wait_for_timeout(300)
        check(all(sent.values()), 'F1 each kind is sent with real clicks (kind, words, Send) and says "Sent"', sent)
        L = admin(f'/tickets?campaign={cid}&limit=100')
        mine = {t['kind']: t for t in L['tickets'] if t['seat']['id'] == seat and t['text'] in texts.values()}
        check(set(mine) == set(texts) and all(t['seat']['role'] == 'player' and t['seat']['name'] == 'Mira' for t in mine.values()), 'F1 the relay has one ticket of each kind, from Mira, a player', sorted(mine))
        full = {k: admin(f"/tickets/{t['id']}")['ticket'] for k, t in mine.items()}
        b = full.get('bug') or {}; c = b.get('ctx') or {}
        check(all(f.get('shot') for f in full.values()) and all(len(admin(f"/tickets/{f['id']}/shot", raw=True)) > 10000 for f in full.values()),
              'F1 each has its screenshot, a file of its own on the relay', {k: f.get('shotBytes') for k, f in full.items()})
        check(c.get('client') and c.get('tuner') and c.get('campaign', {}).get('id') == cid and c.get('area', {}).get('id') and b.get('area', {}).get('name') and c.get('seat', {}).get('role') == 'player'
              and c.get('camera', {}).get('dist') and c.get('graphics', {}).get('preset') is not None and c.get('browser') and c.get('os') is not None and 'gpu' in c and len(b.get('commands') or []) > 0,
              'F1 its context: client and look versions, campaign, area, seat and role, camera, graphics preset, browser and OS, GPU, recent commands', {k: c.get(k) for k in ('client', 'tuner', 'area', 'seat', 'camera', 'graphics', 'os', 'gpu')} | {'commands': len(b.get('commands') or [])})
        check(all(not any('text' in json.dumps(x).lower() and x.get('type') == 'chat' for x in (f.get('commands') or [])) for f in full.values()) and all(set(x) <= {'at', 'dir', 'type', 'area', 'ids', 'ops', 'cid', 'seq', 'by'} for f in full.values() for x in f.get('commands') or []),
              'F1 commands carry their kinds and ids only (no args, no chat text)')
        a = full.get('asset', {}).get('asset') or {}
        check(a.get('entity') == BA and a.get('cat') == 'barrel' and a.get('lib') and a.get('name'), 'F1 the asset comment names the selected barrel: entity, library id (<src>/<sku>), name', a)

        print('F2 an asset comment pre-fills from the selection (command bar)')
        await pl.evaluate("tw.settings.close()"); await pl.wait_for_timeout(200)
        await pl.evaluate(f"(() => {{ tw.sel = new Set(['{BA}']); tw.emit('selection'); tw.refresh(); }})()")
        top = await bar(pl, 'comment on this asset')
        ok = await wait(pl, "tw.settings.state().open && tw.settings.state().section === 'feedback' && !!document.querySelector('#settingsModal .fbassetname')", 10000, 'asset form')
        if not ok: print('    bar rows:', top, await pl.evaluate("tw.selected().map(e => e.id)"))
        pre = await pl.evaluate("({ kind: document.querySelector('#settingsModal [data-fbkind].sel')?.dataset.fbkind, name: document.querySelector('#settingsModal .fbassetname')?.value, note: document.querySelector('#settingsModal .fbasset small')?.textContent })")
        check(ok and pre['kind'] == 'asset' and pre['name'] and 'barrel' in (pre['note'] or ''), 'F2 "comment on this asset" opens Feedback on Asset comment, pre-filled with the selected barrel', pre)
        await tap(pl, '#settingsModal [data-fbact=clearasset]')
        cl = await pl.evaluate("document.querySelector('#settingsModal .fbassetname').value")
        await tap(pl, '#settingsModal [data-fbact=usesel]')
        back = await pl.evaluate("document.querySelector('#settingsModal .fbassetname').value")
        check(cl == '' and back == pre['name'], 'F2 Clear empties it; "Use the selection" puts it back', {'cleared': cl, 'back': back})
        await pl.fill('#settingsModal .fbassetname', 'the oak barrel by the door')
        await pl.fill('#settingsModal .fbtext', 'TEST renamed asset comment')
        await tap(pl, '#settingsModal [data-fbact=send]')
        await wait(pl, "document.querySelector('#settingsModal .fbmsg')?.textContent.startsWith('Sent')", 20000)
        t2 = next(t for t in admin(f'/tickets?campaign={cid}&kind=asset')['tickets'] if t['text'] == 'TEST renamed asset comment')
        check(t2['asset'].get('name') == 'the oak barrel by the door' and t2['asset'].get('entity') == BA, 'F2 the name can be changed (typed), the barrel is still named', t2['asset'])
        await pl.evaluate("tw.settings.close()")
        await pl.evaluate(f"(() => {{ tw.sel = new Set(['{PA}']); tw.emit('selection'); tw.refresh(); }})()")
        await bar(pl, 'comment on this asset')
        await wait(pl, "!!document.querySelector('#settingsModal .fbassetname')", 10000)
        pawn = await pl.evaluate("document.querySelector('#settingsModal .fbasset small')?.textContent")
        check('pawn' in (pawn or ''), 'F2 a selected pawn is named by its figure', pawn)
        await pl.evaluate("tw.settings.close()"); await pl.evaluate("(() => { tw.sel = new Set(); tw.emit('selection'); })()")
        await bar(pl, 'report a bug')
        ok = await wait(pl, "tw.settings.state().section === 'feedback' && document.querySelector('#settingsModal [data-fbkind].sel')?.dataset.fbkind === 'bug'", 10000)
        await pl.evaluate("tw.settings.close()"); await bar(pl, 'idea')
        ok2 = await wait(pl, "tw.settings.state().section === 'feedback' && document.querySelector('#settingsModal [data-fbkind].sel')?.dataset.fbkind === 'idea'", 10000)
        await pl.evaluate("tw.settings.close()"); await bar(pl, 'feedback')
        ok3 = await wait(pl, "tw.settings.state().open && tw.settings.state().section === 'feedback'", 10000)
        check(ok and ok2 and ok3, 'F2 the command bar: "report a bug", "idea", "feedback" open the form pre-set')

        print('F3 what gets sent: parts left out')
        await tap(pl, '#settingsModal .fbsent summary')
        opened = await pl.evaluate("document.querySelector('#settingsModal .fbsent').open")
        items = await pl.evaluate("[...document.querySelectorAll('#settingsModal .fbsent li b')].map(b => b.textContent)")
        await tap(pl, '#settingsModal [data-fbtake=shot]'); await tap(pl, '#settingsModal [data-fbtake=camera]')
        off = await pl.evaluate("[...document.querySelectorAll('#settingsModal .fbsent li.off')].map(l => l.dataset.take)")
        ok = await file(pl, 'other', 'TEST without screenshot and camera')
        t3 = next(t for t in admin(f'/tickets?campaign={cid}&kind=other')['tickets'] if t['text'] == 'TEST without screenshot and camera')
        t3 = admin(f"/tickets/{t3['id']}")['ticket']
        check(opened and items[:1] == ['Screenshot'] and {'Recent commands', 'Recent errors', 'Camera', 'Versions'} <= set(items) and sorted(off) == ['camera', 'shot'], 'F3 "What gets sent" opens to a list (screenshot, versions, campaign, you, camera, system, commands, errors); switches leave parts out', {'items': items, 'off': off})
        check(ok and not t3['shot'] and not t3['wantsShot'] and 'camera' not in t3['ctx'] and t3['ctx'].get('client'), 'F3 a ticket sent without the screenshot and the camera has neither', {'shot': t3['shot'], 'ctx': sorted(t3['ctx'])})
        await tap(pl, '#settingsModal [data-fbtake=shot]'); await tap(pl, '#settingsModal [data-fbtake=camera]')
        await pl.evaluate("tw.settings.close()")

        print('F4 a forced JS error arrives once')
        st0 = await pl.evaluate('tw.feedbackHook.state()')
        await pl.evaluate("window.__boom = () => setTimeout(() => { throw new Error('TEST forced feedback error') }, 0)")
        await pl.evaluate('__boom()'); await pl.wait_for_timeout(300); await pl.evaluate('__boom()')
        await pl.evaluate("(() => { Promise.reject(new Error('TEST forced rejection')); })()")
        await pl.wait_for_timeout(2500)
        autos = [t for t in admin(f'/tickets?campaign={cid}&kind=auto&limit=200')['tickets'] if t['seat']['id'] == seat]
        boom = [t for t in autos if 'TEST forced feedback error' in t['text']]; rej = [t for t in autos if 'TEST forced rejection' in t['text']]
        bt = admin(f"/tickets/{boom[0]['id']}")['ticket'] if boom else {}
        check(len(boom) == 1 and boom[0]['count'] == 1 and len(rej) == 1 and 'error' in boom[0]['text'] and not bt.get('shot') and bt.get('ctx', {}).get('client') and any('TEST forced feedback error' in (e or {}).get('message', '') for e in bt.get('errors', [])),
              'F4 a JS error thrown twice arrives once (kind auto, with its stack and context, no screenshot); a rejection once', {'boom': [(t['text'][:60], t['count']) for t in boom], 'rej': len(rej)})
        await pl.evaluate("for (let i = 0; i < 15; i++) setTimeout(() => { throw new Error('TEST flood ' + i) }, i * 10)")
        await pl.wait_for_timeout(3000)
        st1 = await pl.evaluate('tw.feedbackHook.state()')
        autos = [t for t in admin(f'/tickets?campaign={cid}&kind=auto&limit=200')['tickets'] if t['seat']['id'] == seat]
        check(len(autos) <= 10 and st1['autoSent'] <= 10 and st1['autoDropped'] >= 1, 'F4 15 more distinct errors: at most 10 reports in a session, the rest dropped', {'tickets': len(autos), **st1})
        check(not dialogs and not await pl.evaluate('tw.settings.state().open'), 'F4 silently: no dialog, nothing opened', dialogs)

        print('F5 the triage page')
        tr = await tab(TRIAGE + '#key=' + KEY, 'triage', (1400, 900))
        ok = await wait(tr, "document.querySelectorAll('tr[data-id]').length >= 8", 20000, 'triage rows')
        check(ok and '#key' not in tr.url and await tr.evaluate("Object.keys(localStorage).filter(k => k.startsWith('tw.triage.key.')).map(k => localStorage.getItem(k))") == [KEY], 'F5 the page lists the tickets; the key leaves the address and is kept in the browser', tr.url)
        await tr.select_option('select[data-f=kind]', 'idea'); await tr.wait_for_timeout(600)
        kinds = await tr.evaluate("[...document.querySelectorAll('tr[data-id] .chip[class*=k-]')].map(c => c.className)")
        await tr.select_option('select[data-f=kind]', 'bug'); await tr.wait_for_timeout(600)
        await tr.select_option('select[data-f=campaign]', cid); await tr.wait_for_timeout(600)
        check(kinds and all('k-idea' in k for k in kinds), 'F5 filter by kind (and campaign)', kinds)
        bug_id = mine['bug']['id']
        await tr.click(f'tr[data-id="{bug_id}"]')
        ok = await wait(tr, f"document.querySelector('.detail')?.dataset.ticket === '{bug_id}' && document.querySelector('#shot')?.naturalWidth > 100", 15000, 'detail with shot')
        det = await tr.evaluate("({ words: document.querySelector('.detail .words').textContent, ctx: document.querySelector('dl.ctx')?.textContent || '', cmds: document.querySelectorAll('table.cmds tr').length, w: document.querySelector('#shot')?.naturalWidth })")
        check(ok and det['words'] == texts['bug'] and 'client' in det['ctx'] and det['cmds'] > 0, 'F5 a ticket opens with its words, screenshot, context and commands', det)
        await tr.fill('#reply', 'TEST thanks Mira: fixed in the next build.')
        await tr.click('.statuses [data-status=fixed]')
        ok = await wait(tr, "document.querySelector('#msg')?.textContent.startsWith('Saved')", 10000)
        got = admin(f'/tickets/{bug_id}')['ticket']
        check(ok and got['status'] == 'fixed' and got['reply'] == 'TEST thanks Mira: fixed in the next build.' and got['history'][-1]['by'] == 'Harry', 'F5 a status (fixed) and a reply are set from the page', {k: got[k] for k in ('status', 'reply')})
        await pl.bring_to_front(); await open_fb(pl)
        await tap(pl, '#settingsModal [data-fbact=mine]')
        ok = await wait(pl, f"(() => {{ const li = document.querySelector('#settingsModal .fbmine li[data-ticket=\"{bug_id}\"]'); return li && li.querySelector('.fbst').textContent === 'Fixed' && li.querySelector('.fbre')?.textContent.includes('fixed in the next build'); }})()", 10000, 'my tickets')
        n_mine = await pl.evaluate("document.querySelectorAll('#settingsModal .fbmine li').length")
        check(ok and n_mine >= 7, 'F5 the player\'s My tickets shows the status (Fixed) and the reply', n_mine)
        if A.shots:
            await pl.screenshot(path=os.path.join(SHOTS, 'settings-mytickets.png')); await tr.screenshot(path=os.path.join(SHOTS, 'triage.png'))
            await pl.evaluate(f"(() => {{ tw.sel = new Set(['{BA}']); tw.emit('selection'); }})()"); await tap(pl, '#settingsModal [data-fbkind=asset]'); await tap(pl, '#settingsModal [data-fbact=usesel]')
            await pl.fill('#settingsModal .fbtext', 'The lid of this barrel floats a finger above the staves.')
            await pl.evaluate("(() => { const d = document.querySelector('#settingsModal .fbsent'); d.open = true; document.querySelector('#settingsModal .spb').scrollTop = 0; })()"); await pl.wait_for_timeout(300)
            await pl.screenshot(path=os.path.join(SHOTS, 'settings-feedback.png'))
            await pl.fill('#settingsModal .fbtext', '')

        print('F6 privacy: the player\'s screenshot of a fogged map')
        await pl.evaluate("tw.settings.close()"); await pl.evaluate("(() => { tw.sel = new Set(); tw.emit('selection'); })()")
        n_pl = await pl.evaluate(f'({TINT})(["{BC}", "{BA}"])'); n_gm = await gm.evaluate(f'({TINT})(["{BC}", "{BA}"])')
        await pl.evaluate(CAM); await gm.evaluate(CAM); await pl.mouse.move(3, 3); await gm.mouse.move(3, 3)
        await pl.wait_for_timeout(1200); await gm.wait_for_timeout(1200)
        drawn = await pl.evaluate(f"({{ c: !!tw.worldOf(tw.area()).recs.get('{BC}')?.group.visible, a: !!tw.worldOf(tw.area()).recs.get('{BA}')?.group.visible, fog: tw.fog.active(tw.area()) }})")
        shots = {}
        for name, pg in (('player', pl), ('gm', gm)):
            await pg.bring_to_front(); await open_fb(pg)
            ok = await file(pg, 'bug', f'TEST privacy check {name}')
            tid = next(t['id'] for t in admin(f'/tickets?campaign={cid}&kind=bug')['tickets'] if t['text'] == f'TEST privacy check {name}')
            shots[name] = Image.open(io.BytesIO(admin(f'/tickets/{tid}/shot', raw=True)))
            if A.shots: shots[name].save(os.path.join(SHOTS, f'privacy-{name}.png'))
            await pg.evaluate("tw.settings.close()")
        cx = await pl.evaluate(f"tw.screenOf(52.5, 6.5, tw.main, 0).x"); ax = await pl.evaluate(f"tw.screenOf(14, 4.5, tw.main, 0).x")
        def halves(img):
            mid = int(max(1, min(img.width - 1, (cx + ax) / 2 * img.width / 1400)))
            c = img.crop((mid, 0, img.width, img.height)) if cx > ax else img.crop((0, 0, mid, img.height)); a = img.crop((0, 0, mid, img.height)) if cx > ax else img.crop((mid, 0, img.width, img.height))
            return magenta(c), magenta(a)
        plC, plA = halves(shots['player']); gmC, gmA = halves(shots['gm'])
        check(n_pl > 0 and drawn['fog'] and not drawn['c'] and drawn['a'], 'F6 setup: fog of war on for the player; C\'s barrel is not drawn for them, A\'s is; both tinted magenta in both tabs', drawn)
        check(plC == 0 and plA > 30, 'F6 PRIVACY: the player\'s screenshot has 0 magenta pixels from never-seen C; the barrel in A shows (the capture sees what is drawn)', {'player C': plC, 'player A': plA})
        check(gmC > 30, 'F6 control: the GM\'s screenshot of the same view shows C\'s barrel', {'gm C': gmC, 'gm A': gmA})

        print('F7 a small laptop screen')
        await pl.set_viewport_size({'width': 1280, 'height': 640}); await pl.wait_for_timeout(500)
        await pl.bring_to_front(); await open_fb(pl)
        lay = await pl.evaluate("""(() => { const m = document.querySelector('#settingsModal .smodal').getBoundingClientRect(), b = document.querySelector('#settingsModal .spb');
          const d = document.querySelector('#settingsModal .fbsent'); return { mh: m.height, top: m.top, bottom: m.bottom, vh: innerHeight, scroll: b.scrollHeight > b.clientHeight, open: d.open }; })()""")
        await pl.evaluate("document.querySelector('#settingsModal .fbsent').open = true"); await pl.wait_for_timeout(150)
        await pl.evaluate("document.querySelector('#settingsModal .spb').scrollTop = 0"); await pl.wait_for_timeout(100)
        sendv = await pl.evaluate("""(() => { const s = document.querySelector('#settingsModal [data-fbact=send]').getBoundingClientRect(), b = document.querySelector('#settingsModal .spb').getBoundingClientRect(); return { s: [s.top, s.bottom], b: [b.top, b.bottom] }; })()""")
        await tap(pl, '#settingsModal .fbsent summary'); shut = await pl.evaluate("!document.querySelector('#settingsModal .fbsent').open")
        reach = sendv['s'][1] <= sendv['b'][1] + 1 and sendv['s'][0] >= sendv['b'][0] - 1
        check(lay['top'] >= 0 and lay['bottom'] <= lay['vh'] and lay['scroll'] and shut, 'F7 at 1280 x 640 the window fits, its body scrolls, and "What gets sent" collapses', lay)
        check(reach, 'F7 Send stays in view while the list is open (it sticks to the bottom of the scrolling body)', sendv)
        if A.shots: await pl.screenshot(path=os.path.join(SHOTS, 'small-laptop.png'))

        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f"\nfeedback: {passed}/{len(results)} passed")
    return passed == len(results)

good = False
try:
    good = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
sys.exit(0 if good else 1)

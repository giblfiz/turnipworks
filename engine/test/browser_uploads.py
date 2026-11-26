#!/usr/bin/env python3
"""UPLOADED MODELS in the game (2026-11-06; client/uploads.js, relay/uploads.js, relay/dmca.js; docs/UPLOADS.md).
A GM uploads model files in Settings ▸ Uploaded models, places one, a player sees it, the GM deletes one, Fauna takes one
down by notice, and the player's table shows the marked box.

  python3 engine/test/browser_uploads.py --local [--shots] [--model PATH]
  (needs relay/upload-worker's node_modules: npm ci there; --model: a real model for the pictures, e.g. the Import Lab's
  garden gnome; without it the test's own textured box is used)
  TW_PORTS=relay,static picks the local ports (default 18461,18464)

  SECTION  Settings has "Uploaded models" for the GM (U), not for a player; the bar's "upload" opens it; no horizontal scroll
  ATTEST   Upload without the box ticked: refused in the window, nothing sent
  UPLOAD   a GLB and an STL: in the list with their size, triangles and a picture rendered from the converted copy
  HOSTILE  an HTML page named .glb: refused, with the reason in the window
  PLACE    Place: the model rides the pointer as a ghost; a click lands ONE thing carrying `upload`; it draws as the model
  PLAYER   a player's tab draws the same model (the mesh fetched with the seat in a header)
  DELETE   Delete: the model leaves the list and every place it stood, for the GM and the player
  NOTICE   the copyright page and its form; a notice; the admin takedown; the player's next load draws the marked box; the
           GM's list says "Removed after a copyright notice" and offers the counter-notice, which is sent from the game
  (2026-11-23, the tester's findings)
  LINKS    the attestation links BOTH the upload terms (Terms, "Models you upload") and the copyright policy, and both answer
  FIGURE   one of OUR textured 20,000-triangle figures uploads through the window (all 9 the tester tried were refused)
  CUT-OFF  three notices end the campaign's uploading: each model a notice holds still names its notice and keeps
           Counter-notice; the one only the cut-off holds says so; a forwarded counter-notice does not promise "back
           after"; the refusal to upload says what to do; withdrawing a notice reinstates it and the models come back
  PHONE    placing on a phone: the phone's chip alone (no desktop "R turns it · Esc cancels" toast over it), its words whole
"""
import argparse, asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true')
ap.add_argument('--model', default=os.environ.get('TW_UPLOAD_SAMPLE', '')); ap.add_argument('--figure', default='hero-bard-human-f--20k1024-f9a47b5c.glb'); ap.add_argument('--out', default=os.path.join(HERE, 'shots', 'uploads'))
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:300] if detail else ''}", flush=True)

RP, SP = [int(p) for p in os.environ.get('TW_PORTS', '18461,18464').split(',')]
DATA = None
def start_local():
    global DATA
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    DATA = tempfile.mkdtemp(prefix='tw-uploads-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(DATA, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': DATA, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro'

def http(path, method='GET', body=None, headers=None):
    req = urllib.request.Request(f'http://127.0.0.1:{RP}{path}', method=method, data=body, headers={'User-Agent': 'tw-test', **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return r.status, r.read().decode('utf8', 'replace')
    except urllib.error.HTTPError as e: return e.code, e.read().decode('utf8', 'replace')
def admin(path, body=None):
    key = open(os.path.join(DATA, 'admin-key')).read().strip()
    return http(path, 'POST' if body is not None else 'GET', json.dumps(body).encode() if body is not None else None, {'x-tw-admin': key, 'content-type': 'application/json'})

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=80); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def idle(pg): await wait(pg, "tw.sync.pendingCount() === 0", 30000, 'commands settled'); await pg.wait_for_timeout(300)
async def bar(pg, text):
    if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
    await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=4); await pg.wait_for_timeout(350); await pg.keyboard.press('Enter')
async def shot(pg, name):
    if A.shots: os.makedirs(A.out, exist_ok=True); await pg.screenshot(path=os.path.join(A.out, name)); print(f'    shot {os.path.join(A.out, name)}')
DRAWN = "((id) => { const r = tw.worlds.get(tw.area())?.recs.get(id); let up = false, gone = false; r?.visual?.traverse(o => { if (o.userData?.upload) up = true; if (o.userData?.goneUpload) gone = true; }); return up ? 'model' : gone ? 'gone' : r ? 'box' : 'none'; })"

async def main():
    page = start_local()
    fx = tempfile.mkdtemp(prefix='tw-upfx-')
    subprocess.run(['node', os.path.join(ENGINE, 'relay', 'upload-worker', 'test-fixtures.mjs'), fx], check=True, stdout=subprocess.DEVNULL)
    model = A.model if A.model and os.path.exists(A.model) else os.path.join(fx, 'good.glb')
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900):
            ctx = await browser.new_context(viewport={'width': w, 'height': h})
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.goto(url, timeout=180000, wait_until='domcontentloaded'); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST uploads {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready() && !!tw.view()', 60000), 'GM tab live')
        await gm.evaluate("tw.spawnRoom('common', 0, 0, 6, 5, 82241)"); await idle(gm)
        # an open table (no fog of war), so the player's pictures show the room and what stands in it
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
        await wait(gm, "tw.sync.campaign.defaults.fogOfWar === false && tw.sync.pendingCount() === 0", 15000, 'open-table fixture')

        print('SECTION')
        check(await wait(gm, "tw.uploads?.on === true", 15000), 'the relay takes uploads (dev)')
        await bar(gm, 'upload')
        check(await wait(gm, "tw.settings.state().open && tw.settings.state().section === 'models'", 8000), 'the bar\'s "upload" opens Settings ▸ Uploaded models')
        check(await gm.evaluate("tw.settings.state().sections.includes('models')"), 'the GM has the section')
        await wait(gm, "!!document.querySelector('#settingsModal .upform')", 8000)
        hs = await gm.evaluate("(() => { const b = document.querySelector('#settingsModal .spb'); return [b.scrollWidth, b.clientWidth]; })()")
        check(hs[0] <= hs[1] + 1, 'no horizontal scroll in the section', hs)
        await shot(gm, '01-section.png')

        print('ATTEST')
        await gm.set_input_files('#settingsModal .upfile', model)
        await wait(gm, "!!tw.uploads.form.file", 5000)
        await gm.fill('#settingsModal .upname', 'Garden gnome' if A.model else 'Red box')
        await gm.fill('#settingsModal .upheight', '4')
        await gm.click('#settingsModal [data-upact=go]')
        check(await wait(gm, "/Tick the box/.test(document.querySelector('#settingsModal .upform')?.textContent || '')", 5000) and await gm.evaluate("tw.uploads.list.length === 0"), 'without the attestation ticked: refused in the window, nothing uploaded')

        print('UPLOAD')
        await gm.check('#settingsModal .upattestbox')
        await gm.click('#settingsModal [data-upact=go]')
        check(await wait(gm, "tw.uploads.list.length === 1 && tw.uploads.list[0].status === 'ok'", 60000), 'uploaded: in the list')
        it = await gm.evaluate("tw.uploads.list[0]")
        check(it['height'] == 4 and len(it['tris']) == 3 and it['bounds'], 'with its height, its three tiers and its box', it)
        check(await wait(gm, "!!document.querySelector('#settingsModal li.upitem .uppic img')", 20000), 'a picture, rendered from the converted copy and kept on the relay')
        th = http(f"/c/{await gm.evaluate('tw.sync.campaign.id')}/uploads/{it['id']}/thumb", headers={'authorization': 'Bearer ' + await gm.evaluate('tw.sync.token')})
        check(th[0] == 200, 'the relay has its picture', th[0])
        await gm.set_input_files('#settingsModal .upfile', os.path.join(fx, 'pyramid.stl'))
        await gm.fill('#settingsModal .upname', 'Pyramid'); await gm.fill('#settingsModal .upheight', '3')
        await gm.check('#settingsModal .upattestbox'); await gm.click('#settingsModal [data-upact=go]')
        check(await wait(gm, "tw.uploads.list.length === 2", 60000), 'an STL too')
        await gm.wait_for_timeout(1500)
        await shot(gm, '02-list.png')

        print('LINKS')
        links = await gm.evaluate("[...document.querySelectorAll('#settingsModal .upattest a')].map(a => [a.className, a.href])")
        lk = dict(links)
        check(set(lk) == {'upterms', 'uppolicy'} and (lk['upterms'].endswith('terms.html#uploads') or lk['upterms'].endswith('/terms#uploads')), 'the attestation links the upload terms (the Terms, "Models you upload")', links)
        check(lk.get('uppolicy', '').endswith('/dmca') and '/api/tw-relay/' not in lk.get('uppolicy', ''), 'and the copyright policy at /dmca', links)
        for cls, href in links:
            try:
                with urllib.request.urlopen(href.split('#')[0], timeout=10) as r: body = r.read().decode('utf8', 'replace'); ok_ = r.status == 200
            except Exception as e: body, ok_ = str(e), False
            check(ok_ and (cls != 'upterms' or 'id="uploads"' in body), f'  {cls}: it answers 200' + (' and has the section' if cls == 'upterms' else ''), href)

        print('FIGURE')
        fig = next((p for p in (os.path.join(REPO, 'tools/spawn-tuner/assets/figures', A.figure), os.path.join(os.environ.get('TW_MAIN', '<repo>'), 'tools/spawn-tuner/assets/figures', A.figure)) if os.path.exists(p)), None)
        check(fig, f'our figure {A.figure} is on this box', fig)
        if fig:
            n0 = await gm.evaluate("tw.uploads.list.length")
            await gm.set_input_files('#settingsModal .upfile', fig); await wait(gm, "!!tw.uploads.form.file", 5000)
            await gm.fill('#settingsModal .upname', 'Bard'); await gm.fill('#settingsModal .upheight', '6')
            await gm.check('#settingsModal .upattestbox'); t = time.time(); await gm.click('#settingsModal [data-upact=go]')
            await gm.wait_for_timeout(150); await wait(gm, "!tw.uploads.busy", 120000, 'conversion')
            secs = round(time.time() - t, 1)
            fg = await gm.evaluate("tw.uploads.list.find(x => x.name === 'Bard') || null")
            check(fg and fg['status'] == 'ok' and len(fg['tris']) == 3 and fg['tris'][2] <= 4500, f'our textured 20k figure uploads through the window ({secs} s; tiers {fg and fg["tris"]})', await gm.evaluate("tw.uploads.error || ''"))
            check(await gm.evaluate("tw.uploads.list.length") == n0 + 1, '  and it is in the list')

        print('HOSTILE')
        n_before = await gm.evaluate("tw.uploads.list.length")
        await gm.set_input_files('#settingsModal .upfile', os.path.join(fx, 'html.glb'))
        await gm.check('#settingsModal .upattestbox'); await gm.click('#settingsModal [data-upact=go]')
        check(await wait(gm, "/not a model we read/.test(document.querySelector('#settingsModal .upform')?.textContent || '')", 30000) and await gm.evaluate(f"tw.uploads.list.length === {n_before}"), 'an HTML page named .glb: refused, the reason in the window', await gm.evaluate("[tw.uploads.error, tw.uploads.list.length]"))

        print('PLACE')
        await gm.click(f"#settingsModal li.upitem[data-up='{it['id']}'] [data-upact=place]")
        check(await wait(gm, "tw.mode?.kind === 'place' && !!tw.mode.upload", 5000) and not await gm.evaluate("tw.settings.state().open"), 'Place: the window closes and the model rides the pointer')
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(15, 0, 12); g.pitch = 40; g.yaw = -25; g.dist = 34; g.update(); tw.main.rule = 'free'; })()")
        await gm.wait_for_timeout(400)
        box = await gm.evaluate("(() => { const r = document.getElementById('c').getBoundingClientRect(), p = tw.screenOf(15, 12, tw.main, 0); return [p.x, p.y]; })()")
        await gm.mouse.move(box[0] - 10, box[1] - 10); await gm.mouse.move(box[0], box[1]); await gm.wait_for_timeout(300)
        await gm.mouse.click(box[0], box[1]); await idle(gm)
        placed = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.upload === '{it['id']}')")
        check(len(placed) == 1 and abs(placed[0]['dims'][1] - 4) < 0.05, 'a click lands one thing carrying the upload, 4 ft tall', placed)
        pid = placed[0]['id'] if placed else ''
        check(await wait(gm, f"{DRAWN}('{pid}') === 'model'", 20000), 'it draws as the model (not the box)')
        await gm.wait_for_timeout(800); await shot(gm, '03-placed-gm.png')
        # it is an ordinary thing: selectable, its ring and crumbs open, it moves (no library piece behind it to trip on)
        await gm.evaluate(f"tw.select(['{pid}'])"); await gm.wait_for_timeout(600)
        ring = await gm.evaluate("tw.selected().map(e => e.id)")
        check(ring == [pid], 'it can be selected like any thing', ring)
        await gm.evaluate(f"tw.dispatch('object.move', {{ id: '{pid}', x: 16, z: 12 }})"); await idle(gm)
        check(await gm.evaluate(f"tw.ent('{pid}').x === 16 && tw.ent('{pid}').upload === '{it['id']}'"), 'and moved, keeping its model')
        await gm.evaluate("tw.select([])")

        print('PLAYER')
        tok = await gm.evaluate("tw.createSeat({ kind: 'human', role: 'player', name: 'Mira', color: '#6fc36f' })")
        pl = await tab(await gm.evaluate(f"tw.inviteLink('{tok}')"))
        check(await wait(pl, "window.tw && tw.ready && tw.ready() && !!tw.view()", 60000), 'a player tab')
        check(await wait(pl, f"{DRAWN}('{pid}') === 'model'", 30000), 'the player draws the same model')
        check(not await pl.evaluate("tw.settings.state().sections.includes('models')"), 'a player has no Uploaded models section')
        await pl.evaluate("(() => { const g = tw.main.grab; g.focus.set(15, 0, 12); g.pitch = 40; g.yaw = -25; g.dist = 34; g.update(); tw.main.rule = 'free'; })()")
        await pl.wait_for_timeout(1200); await shot(pl, '04-placed-player.png')

        print('DELETE')
        await gm.evaluate("tw.settings.show('models')"); await wait(gm, "!!document.querySelector('#settingsModal li.upitem')", 8000)
        pyr = await gm.evaluate("tw.uploads.list.find(x => x.name === 'Pyramid').id")
        await gm.evaluate(f"tw.uploads.place('{pyr}')")
        await gm.mouse.move(box[0] + 120, box[1] + 30); await gm.wait_for_timeout(250); await gm.mouse.click(box[0] + 120, box[1] + 30); await idle(gm)
        ppid = await gm.evaluate(f"Object.values(tw.entities()).find(e => e.upload === '{pyr}')?.id || ''")
        check(ppid and await wait(pl, f"!!tw.ent('{ppid}')", 10000), 'a second model placed (the player has it too)')
        await gm.evaluate("tw.settings.show('models')"); await wait(gm, "!!document.querySelector('#settingsModal li.upitem')", 8000)
        await gm.click(f"#settingsModal li.upitem[data-up='{pyr}'] [data-upact=delete]")
        check(await wait(gm, f"!tw.uploads.list.some(x => x.id === '{pyr}') && !tw.ent('{ppid}')", 15000), 'Delete: gone from the list and from where it stood')
        check(await wait(pl, f"!tw.ent('{ppid}')", 10000), 'and from the player\'s table')

        print('NOTICE')
        st, pagehtml = http('/dmca')
        check(st == 200 and 'DRAFT' in pagehtml and '<form' in pagehtml, 'the copyright page and its form')
        form = urllib.parse.urlencode({'name': 'Ann Sculptor', 'role': 'owner', 'email': 'fixture@example.invalid', 'address': '1 Main St', 'work': 'my gnome sculpt', 'material': 'a gnome in a campaign', 'goodfaith': 'on', 'accurate': 'on', 'signature': 'Ann Sculptor'}).encode()
        st, receipt = http('/dmca/notice', 'POST', form, {'content-type': 'application/x-www-form-urlencoded'})
        nid = (re.search(r'ntc_[0-9a-z]{12}', receipt) or [None])[0]
        check(st == 200 and nid, 'a notice is received', st)
        st, td = admin('/admin/dmca/takedown', {'notice': nid, 'id': it['id']})
        check(st == 200 and json.loads(td).get('ok'), 'the admin takedown', td[:200])
        await pl.reload(wait_until='domcontentloaded')
        check(await wait(pl, "window.tw && tw.ready && tw.ready() && !!tw.view()", 60000), 'the player reloads')
        check(await wait(pl, f"{DRAWN}('{pid}') === 'gone'", 30000), 'and the thing draws as the marked box (Model removed)')
        await pl.evaluate("(() => { const g = tw.main.grab; g.focus.set(15, 0, 12); g.pitch = 40; g.yaw = -25; g.dist = 34; g.update(); tw.main.rule = 'free'; })()")
        await pl.wait_for_timeout(1200); await shot(pl, '05-removed-player.png')
        await gm.evaluate("tw.uploads.refresh().then(() => tw.settings.show('models'))")
        check(await wait(gm, "/Removed after a copyright notice/.test(document.querySelector('#settingsModal .uplist')?.textContent || '')", 10000), 'the GM\'s list says it was removed after a copyright notice, with the notice number')
        await gm.click(f"#settingsModal li.upitem[data-up='{it['id']}'] [data-upact=counter]")
        await wait(gm, "!!document.querySelector('#settingsModal .upcounter')", 5000)
        for k, v in (('name', 'Harry Gm'), ('address', '2 Elm St'), ('phone', '555-0101'), ('signature', 'Harry Gm')): await gm.fill(f"#settingsModal [data-ctr={k}]", v)
        for k in ('mistake', 'jurisdiction', 'service'): await gm.check(f"#settingsModal [data-ctrchk={k}]")
        await shot(gm, '06-counter.png')
        await gm.click('#settingsModal [data-upact=sendcounter]')
        check(await wait(gm, "/counter-notice received/.test(document.querySelector('#settingsModal .uplist')?.textContent || '')", 10000), 'the counter-notice is sent from the game, and the list says so')
        hs = await gm.evaluate("(() => { const b = document.querySelector('#settingsModal .spb'); return [b.scrollWidth, b.clientWidth]; })()")
        check(hs[0] <= hs[1] + 1, 'still no horizontal scroll', hs)

        print('CUT-OFF')
        cid_ = await gm.evaluate('tw.sync.campaign.id'); gtok = await gm.evaluate('tw.sync.token')
        st_, ctrs = admin('/admin/dmca'); ctr = [c for c in json.loads(ctrs)['counters'] if c['campaign'] == cid_][-1]['id']
        admin(f'/admin/dmca/counter/{ctr}/forward', {})
        # two more models of its own (each its own file), each taken down by its own notice: three notices end its uploading
        def upfile(path, name):
            with open(path, 'rb') as f: b = f.read() + b' ' * (sum(map(ord, name)) % 97 + 3)  # (a file of its own: another hash)
            st, body = http(f"/c/{cid_}/uploads?name={urllib.parse.quote(name)}&height=3&ext=stl&attest={urllib.parse.quote(ATTEST)}", 'POST', b, {'authorization': 'Bearer ' + gtok, 'content-type': 'application/octet-stream'})
            return json.loads(body).get('upload', {}).get('id')
        ATTEST = await gm.evaluate("tw.uploads.info.attest.version")
        extra = [upfile(os.path.join(fx, 'pyramid.stl'), n) for n in ('Cut one', 'Cut two', 'Never noticed')]
        check(all(extra), 'three more models', extra)
        for i, mid in enumerate(extra[:2]):
            f2 = urllib.parse.urlencode({'name': 'Ann Sculptor', 'role': 'owner', 'email': 'fixture@example.invalid', 'address': '1 Main St', 'work': f'my work {i}', 'material': f'cut {i}', 'goodfaith': 'on', 'accurate': 'on', 'signature': 'Ann Sculptor'}).encode()
            n_ = re.search(r'ntc_[0-9a-z]{12}', http('/dmca/notice', 'POST', f2, {'content-type': 'application/x-www-form-urlencoded'})[1])[0]
            st, td = admin('/admin/dmca/takedown', {'notice': n_, 'id': mid})
        check(json.loads(td).get('ended') == [cid_], 'the third notice ends the campaign\'s uploading', td[:200])
        await gm.evaluate("tw.uploads.refresh().then(() => tw.settings.show('models'))"); await gm.wait_for_timeout(800)
        row = lambda i: gm.evaluate(f"(() => {{ const li = document.querySelector(\"#settingsModal li.upitem[data-up='{i}']\"); return li ? [li.querySelector('small.bad')?.textContent || '', !!li.querySelector('[data-upact=counter]')] : null; }})()")
        r_it, r_cut, r_never = await row(it['id']), await row(extra[0]), await row(extra[2])
        check(r_it and 'Removed after a copyright notice' in r_it[0] and 'uploading has also ended' in r_it[0], 'cut off: the model a notice holds still names the notice, and says the uploading has ended', r_it)
        check(r_it and 'back after' not in r_it[0] and 'stays hidden while uploading is ended' in r_it[0], '  its forwarded counter-notice does not promise "back after" while the campaign is cut off', r_it)
        check(r_cut and 'Removed after a copyright notice' in r_cut[0] and r_cut[1], 'another model a notice holds keeps its Counter-notice button while cut off', r_cut)
        check(r_never and 'repeat-infringer policy' in r_never[0] and not r_never[1], 'the one no notice holds: removed by the cut-off, no counter-notice', r_never)
        await shot(gm, '07-cutoff-list.png')
        if True:
            await gm.set_input_files('#settingsModal .upfile', os.path.join(fx, 'pyramid.stl')); await wait(gm, "!!tw.uploads.form.file", 5000)
            await gm.check('#settingsModal .upattestbox'); await gm.click('#settingsModal [data-upact=go]'); await wait(gm, "!tw.uploads.busy && !!tw.uploads.error", 20000)
            err = await gm.evaluate("tw.uploads.error || ''")
            check('counter-notice' in err and 'write to' in err and 'docs' not in err, 'the refusal to upload says what a person can do (and no internal path)', err)
        # a withdrawn notice brings it below the line: reinstated
        st, ad = admin('/admin/dmca'); ntcs = [n['id'] for n in json.loads(ad)['notices'] if any(extra[1] in str(a) or cid_ in a.get('campaigns', []) for a in n.get('actions', []))]
        admin(f'/admin/dmca/notice/{ntcs[-1]}/withdraw', {'why': 'TEST'})
        await gm.evaluate("tw.uploads.refresh().then(() => tw.settings.show('models'))")
        check(await wait(gm, f"tw.uploads.list.find(x => x.id === '{extra[2]}')?.status === 'ok' && !!document.querySelector(\"#settingsModal li.upitem[data-up='{extra[2]}'] [data-upact=place]\")", 10000), 'a notice withdrawn: reinstated, the model only the cut-off held is back (Place)')

        print('PHONE')
        pctx = await browser.new_context(**p.devices['Pixel 7']); ph = await pctx.new_page(); ph.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await ph.goto(page + '#s=' + gtok, timeout=180000, wait_until='domcontentloaded')
        check(await wait(ph, 'window.tw && tw.ready && tw.ready() && !!tw.view()', 90000) and await ph.evaluate("document.documentElement.classList.contains('tw-hand')"), 'the GM on a phone')
        await wait(ph, "tw.uploads?.on === true && tw.uploads.list.length > 0", 15000)
        ok_id = await ph.evaluate("tw.uploads.list.find(x => x.status === 'ok')?.id")
        await ph.evaluate("tw.toast('Uploaded “Something”.')")  # (a toast still up when the tool comes up: the tester's second overlap)
        await ph.evaluate(f"tw.uploads.place('{ok_id}')"); await ph.wait_for_timeout(700)
        chip = await ph.evaluate("(() => { const c = document.getElementById('handTool'), w = c?.querySelector('.ht-what'), r = c?.getBoundingClientRect(), t = document.getElementById('toast'); return { shown: !!c && !c.hidden, words: w?.textContent || '', whole: !!w && w.scrollHeight <= w.clientHeight + 1 && w.scrollWidth <= w.clientWidth + 1, inside: !!r && r.left >= 0 && r.right <= innerWidth, toast: t?.classList.contains('show') ? t.textContent : '' }; })()")
        check(chip['shown'] and 'tap the table' in chip['words'] and chip['whole'] and chip['inside'], 'placing on a phone: the chip, its words whole and on screen', chip)
        check(chip['toast'] == '', 'and no toast over it (not the desktop hint, not one already up)', chip['toast'])
        await shot(ph, '08-phone-placing.png'); await pctx.close()
        real = [e for e in errors if 'favicon' not in e]
        check(not real, 'no page errors', real[:3])
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
n_ok = sum(1 for r in results if r[0]); print(f'\nbrowser_uploads: {n_ok}/{len(results)} passed')
sys.exit(0 if n_ok == len(results) else 1)

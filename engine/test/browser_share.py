#!/usr/bin/env python3
"""SHARED BUILDS (2026-10-29; client/share.js, core/share.js, relay/shares.js; docs/UI.md "Sharing builds").
A GM builds a small inn (common room, kitchen, a guest room upstairs, a hidden crypt, a goblin, a barrel and a trap) and
exports the AREA; a second GM imports builds into another campaign. A selection is NOT exported (Harry 2026-10-29: "drop
export of selections"; parked until the player object tuner / prop assembler): the room, building and prop-group files
the import checks need are made with tw.share.build (the format still has every kind), not by any button.

  python3 engine/test/browser_share.py --local [--shots] [--out DIR]
  (from a checkout that has the ignored models: the main checkout, or a worktree with them linked)
  TW_PORTS=relay,static picks the local ports (default 18471,18472)

  MENU     no selection has an export anywhere (ring ☰, chords, the bar); "export" / "share link" in the bar mean the area
  EXPORT   the area from the window's Download button: the file, its kind, its picture; room / building / group files by tw.share.build
  STRIP    the window names what "Strip secrets" takes out; ticked, the file has no hidden room, creature, trap, GM note
  GHOST    in another campaign the building rides the pointer: its footprint lit in my colour, red over a room
  IMPORT   a click lands it as ONE step at another spot; every id new; undo takes it all away
  HILL     dropped wholly on a hill it stands on the hilltop (10 ft)
  STANDIN  a piece the library lacks: a stand-in, and the toast says so
  LINK     the area's Copy share link -> the preview page (noindex) -> "import <link>" in the bar -> a new area; Delete link -> gone
  AREA     a whole area comes in as a new area, hidden from players
  DROP     a .turnip.json dropped on the window starts the ghost; ?share=<id> on the page address does too
  XSS      a build named <img onerror=…> is shown as text, never as markup
  BEST     a good area with broken and hostile pieces in it: the rest comes in, the toast counts them, a window lists them
           (names as text, nothing runs), nothing refused lands; a campaign file with a broken area: the other area comes in
  STARTER  the starter builds are listed in Invites and exports and one imports
"""
import argparse, asyncio, base64, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--relay'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true')
ap.add_argument('--out', default=os.path.join(HERE, 'shots', 'share'))
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:300] if detail else ''}", flush=True)

RP, SP = [int(p) for p in os.environ.get('TW_PORTS', '18471,18472').split(',')]
RELAY = None
def start_local():
    global RELAY
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-share-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    RELAY = f'http://127.0.0.1:{RP}'
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(RELAY) + '&api=&nointro'

def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={**tw_sandbox.HEADERS, 'User-Agent': 'Mozilla/5.0 tw-test'}), timeout=20) as r: return r.status, dict(r.headers), r.read().decode('utf8', 'replace')
    except urllib.error.HTTPError as e: return e.code, dict(e.headers), e.read().decode('utf8', 'replace')

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=60); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over')
    await pg.wait_for_timeout(400)
async def idle(pg): await wait(pg, "tw.sync.pendingCount() === 0", 30000, 'commands settled'); await pg.wait_for_timeout(300)
async def topdown(pg, x, z, dist=150):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = 89; g.yaw = 0; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(250)
async def screen(pg, x, z, y=0):
    s = await pg.evaluate(f"(() => {{ const r = document.getElementById('c').getBoundingClientRect(), p = tw.screenOf({x}, {z}, tw.main, {y}); return [p.x + 0, p.y + 0]; }})()")
    return s
async def menu_ids(pg, ring=False):
    return await pg.evaluate(f"(async () => {{ const M = await import(new URL('menu.js', document.baseURI).href); return M.menuFor(tw.registry, tw.registry.ctx(), {{ ring: {'true' if ring else 'false'} }}).flatMap(n => n.cmd ? [n.cmd.id] : n.children.map(c => c.cmd.id)); }})()")
async def bar(pg, text):
    if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
    await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=4); await pg.wait_for_timeout(350); await pg.keyboard.press('Enter')
async def download(pg, sel_js, strip=False):
    """open the share window for a selection, wait for its picture, tick strip, press Download: -> (file name, doc, thumb data URL)"""
    await pg.evaluate(f"tw.share.open({sel_js})")
    await wait(pg, "tw.share.isOpen() && !!document.querySelector('#shareModal .shpic img, #shareModal .shpic span:not(:empty)') && !/Taking/.test(document.querySelector('#shareModal .shpic').textContent)", 60000, 'the picture')
    if strip: await pg.click('#shareModal .shstripbox'); await pg.wait_for_timeout(150)
    async with pg.expect_download(timeout=30000) as dl:
        await pg.click('#shareModal [data-act=download]')
    d = await dl.value
    path = os.path.join(A.out, d.suggested_filename); await d.save_as(path)
    thumb = await pg.evaluate("document.querySelector('#shareModal .shpic img')?.src || null")
    await pg.evaluate("tw.share.close()")
    return d.suggested_filename, json.load(open(path)), thumb

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    global RELAY
    if not A.local: RELAY = A.relay or urllib.parse.urljoin(page, '/api/tw-relay')
    os.makedirs(A.out, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, accept_downloads=True, permissions=['clipboard-read', 'clipboard-write'])
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url, timeout=180000, wait_until='domcontentloaded'); return pg
        async def new_campaign(name):
            pg = await tab(page)
            await pg.fill('#newCampaign input[name=gm]', 'Harry')
            nm = await pg.query_selector('#newCampaign input[name=name]')
            if nm: await nm.fill(f"TEST share {name} {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
            await pg.click('#newCampaign button')
            check(await wait(pg, 'window.tw && tw.ready && tw.ready() && !!tw.view()', 60000), f'{name}: GM tab live')
            return pg

        # ---------------- the source: a small inn ----------------
        gm = await new_campaign('source')
        await gm.evaluate("tw.spawnRoom('common', 2, 1, 6, 5, 82241)"); await idle(gm)
        await gm.evaluate("tw.spawnRoom('kitchen', 8, 1, 4, 5, 6113)"); await idle(gm)
        await gm.evaluate("tw.spawnRoom('guest', 2, 1, 6, 5, 4307, undefined, 10)"); await idle(gm)
        await gm.evaluate("tw.spawnRoom('crypt-vault', 20, 1, 4, 4, 11)"); await idle(gm)
        crypt = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'room' && e.recipe.type === 'crypt-vault').id")
        await gm.evaluate(f"tw.setHidden([tw.ent('{crypt}')], true)"); await idle(gm)
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_goblin0001', name: 'Goblin', x: 20, z: 15, fig: 'foe-goblin-club', gmNotes: 'ambush on a 15+' })")
        await gm.evaluate("(() => { for (const [id, cat, x, z] of [['obj_barrel0001', 'barrel', 2, 42], ['obj_trap000001', 'trap-spikes', 8, 44]]) { const s = tw.roomgen.sizeOf(cat); tw.dispatch('object.place', { id, name: cat.replace(/-/g, ' '), cat, sku: s.sku, url: s.url, flat: s.flat, place: s.place || 'floor', x, z, y: 0, rot: 0, yaw: s.yaw, s: s.s, dims: s.dims }); } })()")
        await idle(gm)
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(35, 0, 20); g.pitch = 55; g.yaw = -20; g.dist = 90; g.update(); tw.main.rule = 'free'; })()")
        await settle(gm)
        common = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'room' && e.recipe.type === 'common').id")
        kitchen = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'room' && e.recipe.type === 'kitchen').id")
        bld = await gm.evaluate(f"tw.ent('{common}').building")

        print('MENU: no selection export anywhere (Harry 2026-10-29: "drop export of selections")')
        check(await gm.evaluate("!tw.registry.get('share.export') && !tw.registry.get('share.link')"), 'the selection commands are gone (share.export, share.link)')
        for what, ids in (('room', [kitchen]), ('building', [bld]), ('selection', ['obj_barrel0001', 'obj_trap000001']), ('pawn', ['tok_goblin0001'])):
            await gm.evaluate(f"tw.select({json.dumps(ids)})"); await gm.wait_for_timeout(150)
            rm, cm = await menu_ids(gm, ring=True), await menu_ids(gm)
            check(not [i for i in rm + cm if i.startswith('share.')], f"a {what}: no share entry on its ring ☰ or in its Space chords", (rm + cm)[-5:])
        await gm.evaluate(f"tw.select(['{kitchen}'])"); await gm.wait_for_timeout(150)
        tops = await gm.evaluate("""(async () => { const out = {}; for (const q of ['export', 'share link']) { tw.emit('bar.open', q); await new Promise(r => setTimeout(r, 300)); out[q] = document.querySelector('#results .res')?.dataset.ref || ''; document.querySelector('#bar textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise(r => setTimeout(r, 80)); } return out; })()""")
        check(tops.get('export') == 'cmd:share.area' and tops.get('share link') == 'cmd:share.areaLink', 'the bar, with a room selected: "export" and "share link" mean the AREA (Export this area…, Share link to this area…)', tops)
        await bar(gm, 'export')
        check(await wait(gm, "tw.share.isOpen()", 10000), 'the bar: "export" opens the window')
        head = await gm.evaluate("document.querySelector('#shareModal .shhead b')?.textContent || ''")
        check(head == 'Share this area', 'and it is the area\'s, not the selected room\'s', head)
        await gm.evaluate("tw.share.close()"); await gm.wait_for_timeout(150)
        await gm.evaluate("tw.settings.show('area')"); await gm.wait_for_timeout(800)
        check(await gm.evaluate("!!document.querySelector('#settingsModal [data-act=share-area]')"), 'Settings ▸ Area settings keeps "Export this area…"')
        await gm.click('#settingsModal [data-act=share-area]')
        check(await wait(gm, "tw.share.isOpen()", 10000), 'and it opens the window')
        await gm.evaluate("tw.share.close()"); await gm.wait_for_timeout(150)
        orph = await gm.evaluate("(async () => (await import(new URL('menu.js', document.baseURI).href)).menuOrphans(tw.registry))()")
        check(not orph, 'no menu orphans', orph)

        print('EXPORT')
        await gm.evaluate("tw.share.open({ area: true })"); await gm.wait_for_timeout(400)
        note = await gm.evaluate("document.querySelector('#shareModal').innerText")
        check('Strip secrets' in note and 'hidden room' in note and 'creature' in note and 'trap' in note and 'GM note' in note, 'the window names what Strip secrets takes out', note[:300])
        await gm.evaluate("tw.share.close()")
        name, adoc, thumb = await download(gm, "{ area: true }")
        check(name.endswith('.turnip.json') and adoc['format'] == 'turnip-works-share' and adoc['kind'] == 'area' and len(adoc['rooms']) == 4 and any(r.get('hidden') for r in adoc['rooms']) and adoc['pawns'], 'the whole area: Download gives a .turnip.json of every room, the hidden crypt marked hidden, the goblin', name)
        check(thumb and thumb.startswith('data:image/webp;base64,') and adoc.get('thumb') == thumb, 'with the 3/4 picture the game rendered, in the file too')
        check(len(json.dumps(adoc)) < 300000 and 'url' not in json.dumps(adoc['objects'][:5]), 'small (library references, not meshes)', len(json.dumps(adoc)))
        if A.shots and thumb: open(os.path.join(A.out, 'thumb-area.webp'), 'wb').write(base64.b64decode(thumb.split(',', 1)[1]))
        name, sdoc, _ = await download(gm, "{ area: true }", strip=True)
        st = json.dumps(sdoc)
        check(sdoc['secrets'] is False and not any(r.get('hidden') for r in sdoc['rooms']) and not sdoc['pawns'] and 'trap-spikes' not in st and 'ambush' not in st, 'strip secrets: no hidden room, no creature, no trap, no GM note')
        # (no button makes these any more; the import of every kind is still tested)
        bdoc = await gm.evaluate(f"tw.share.build({{ kind: 'building', ids: ['{bld}'], name: 'Inn' }}).doc")
        check(bdoc['kind'] == 'building' and len(bdoc['rooms']) == 3 and len(bdoc['pawns']) == 1 and bdoc['secrets'] is True, 'a building file (tw.share.build): its three rooms and the goblin, secrets included', [len(bdoc['rooms']), len(bdoc['pawns'])])
        gdoc = await gm.evaluate("tw.share.build({ kind: 'group', ids: ['obj_barrel0001', 'obj_trap000001'] }).doc")
        check(gdoc['kind'] == 'group' and len(gdoc['objects']) == 2 and not gdoc['rooms'], 'a prop-group file: the barrel and the trap')

        print('LINK: make it (the area)')
        await gm.evaluate("tw.share.open({ area: true })"); await gm.wait_for_timeout(500)
        await gm.click('#shareModal [data-act=link]')
        check(await wait(gm, "!!document.querySelector('#shareModal .shlink code')", 20000, 'the link'), 'Copy share link makes a link and shows it')
        link = await gm.evaluate("document.querySelector('#shareModal .shlink code').textContent")
        lid = link.rsplit('/', 1)[-1]
        check(link.startswith(RELAY.replace('/api/tw-relay', '')) and len(lid) == 22, 'an unlisted link: .../s/<22 characters>', link)
        st_, hd, body = get(link)
        check(st_ == 200 and 'noindex' in hd.get('X-Robots-Tag', hd.get('x-robots-tag', '')) and '<script' not in body.lower() and 'Use in my campaign' in body, 'its page: noindex, no script, "Use in my campaign"', st_)
        check(get(RELAY + '/s/')[0] == 404, 'and no listing of links')
        await gm.evaluate("tw.share.close()")

        # ---------------- the target: another campaign with a hill ----------------
        print('GHOST + IMPORT (another campaign)')
        g2 = await new_campaign('target')
        await g2.evaluate("tw.spawnRoom('common', 0, 0, 6, 6, 9)"); await idle(g2)
        await g2.evaluate("tw.spawnRoom('hill', 30, 0, 14, 10, 3, undefined, 10)"); await idle(g2)
        await settle(g2)
        n0 = await g2.evaluate("Object.keys(tw.entities()).length"); seq0 = await g2.evaluate("tw.view().seq")
        await topdown(g2, 90, 30, 260)
        await g2.evaluate(f"tw.share.importText({json.dumps(json.dumps(bdoc))})")
        check(await wait(g2, "tw.mode?.share?.doc?.kind === 'building'", 8000), 'the import starts the ghost (a place tool)')
        sx, sy = await screen(g2, 120, 80)
        await g2.mouse.move(sx - 20, sy - 20); await g2.mouse.move(sx, sy, steps=4); await g2.wait_for_timeout(300)
        gh = await g2.evaluate("tw.share.ghost")
        check(gh and gh.get('cells', 0) >= 30 + 20 and not gh.get('clash'), 'the ghost: its footprint lit on the ground (both storeys), in my colour', gh)
        lit = await g2.evaluate("[...(tw.worldOf(tw.area()).cellMarks?.keys() || [])].filter(k => k.startsWith('share-ghost'))")
        check(len(lit) == 2, 'one lit footprint per level', lit)
        lab = await g2.evaluate("(() => { const l = document.getElementById('modeLabel'); return { shown: !l.hidden, text: l.textContent, bad: l.classList.contains('bad') }; })()")
        check(lab['shown'] and 'click to place' in lab['text'] and not lab['bad'], 'beside the pointer: its name, "click to place"', lab)
        if A.shots: await g2.screenshot(path=os.path.join(A.out, 'ghost.jpg'), type='jpeg', quality=85)
        # over the room already there: red, refused
        rx, ry = await screen(g2, 15, 15)
        await g2.mouse.move(rx, ry, steps=4); await g2.wait_for_timeout(300)
        gh2 = await g2.evaluate("tw.share.ghost"); lab2 = await g2.evaluate("document.getElementById('modeLabel').className + ' ' + document.getElementById('modeLabel').textContent")
        check(gh2.get('clash') and 'bad' in lab2 and 'overlaps' in lab2, 'over a room that is there: red, "overlaps …"', lab2)
        await g2.mouse.click(rx, ry); await g2.wait_for_timeout(700)
        check(await g2.evaluate("Object.keys(tw.entities()).length") == n0 and await g2.evaluate("!!tw.mode?.share"), 'a click there is refused: nothing lands, the ghost stays')
        await g2.mouse.move(sx, sy, steps=4); await g2.wait_for_timeout(200); await g2.mouse.click(sx, sy)
        check(await wait(g2, f"Object.keys(tw.entities()).length > {n0} + 20 && tw.sync.pendingCount() === 0", 20000), 'a click on open ground lands it')
        imp = await g2.evaluate("tw.share.lastImport")
        check(imp and imp['steps'] == 1 and await g2.evaluate("tw.view().seq") == seq0 + 1, 'as ONE step (one log entry)', imp and imp.get('steps'))
        rooms = await g2.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room' && !['hill'].includes(e.recipe.type)).map(e => ({ id: e.id, type: e.recipe.type, x: e.recipe.x, y: e.recipe.y || 0 }))")
        new_rooms = [r for r in rooms if r['type'] in ('common', 'kitchen', 'guest') and r['x'] >= 10]
        check(len(new_rooms) == 3 and any(r['y'] == 10 for r in new_rooms) and all(r['id'] not in json.dumps(bdoc) for r in new_rooms), 'three rooms at the new spot, the guest room upstairs; ids new', new_rooms)
        check(await g2.evaluate("Object.values(tw.entities()).some(e => e.kind === 'token' && e.name === 'Goblin' && !e.owner)"), 'the goblin came too (owned by nobody)')
        check(await g2.evaluate("tw.selected().some(e => e.kind === 'building')"), 'what landed is selected (the building)')
        await settle(g2)
        if A.shots: await g2.screenshot(path=os.path.join(A.out, 'placed.jpg'), type='jpeg', quality=85)
        await g2.evaluate("tw.undo()")
        check(await wait(g2, f"Object.keys(tw.entities()).length === {n0}", 15000), 'one undo takes it all away again')

        print('HILL')
        await g2.evaluate(f"tw.share.importText({json.dumps(json.dumps(bdoc))})"); await g2.wait_for_timeout(200)
        hx, hy = await screen(g2, 185, 25, 10)
        await g2.mouse.move(hx, hy, steps=5); await g2.wait_for_timeout(300)
        gh3 = await g2.evaluate("tw.share.ghost")
        check(gh3.get('dy') == 10 and not gh3.get('clash') and gh3.get('levels') == [10, 20], 'over the hill: the ghost is lifted to the hilltop (10 ft), its upstairs at 20', gh3)
        if A.shots: await g2.screenshot(path=os.path.join(A.out, 'ghost-hill.jpg'), type='jpeg', quality=85)
        await g2.mouse.click(hx, hy)
        check(await wait(g2, f"Object.keys(tw.entities()).length > {n0} + 20 && tw.sync.pendingCount() === 0", 20000), 'it lands on the hill')
        onhill = await g2.evaluate("(() => { const E = tw.entities(); return Object.values(E).filter(e => e.kind === 'room' && e.recipe.x >= 30 && e.recipe.type !== 'hill').map(e => e.recipe.y || 0).sort(); })()")
        check(onhill == [10, 10, 20], 'the inn stands on the hilltop, its upstairs a storey above', onhill)
        await settle(g2)
        if A.shots:
            await g2.evaluate("(() => { const g = tw.main.grab; g.focus.set(185, 10, 25); g.pitch = 40; g.yaw = -25; g.dist = 120; g.update(); })()"); await g2.wait_for_timeout(1500)
            await g2.screenshot(path=os.path.join(A.out, 'on-hill.jpg'), type='jpeg', quality=85)
        await g2.evaluate("tw.undo()"); await wait(g2, f"Object.keys(tw.entities()).length === {n0}", 15000)
        await topdown(g2, 90, 30, 260)

        print('STAND-INS')
        odd = json.loads(json.dumps(gdoc)); odd['objects'][0]['cat'] = 'no-such-thing'; odd['objects'][0]['sku'] = 'no-such-thing--a'; odd['objects'][0]['name'] = 'mystery crate'
        await g2.evaluate(f"tw.share.importText({json.dumps(json.dumps(odd))})"); await g2.wait_for_timeout(200)
        px, py = await screen(g2, 100, 120); await g2.mouse.move(px, py, steps=3); await g2.wait_for_timeout(200); await g2.mouse.click(px, py)
        check(await wait(g2, "tw.share.lastImport?.report?.standIns?.length === 1", 15000), 'a piece the library lacks: reported')
        toast = await g2.evaluate("document.getElementById('toast').textContent")
        check('1 piece your library lacks: shown as stand-ins' in toast, 'the toast says so', toast)
        check(await g2.evaluate("Object.values(tw.entities()).some(e => e.name === 'mystery crate' && !e.url && e.dims)"), 'it stands there as a stand-in (no mesh, its own size)')
        await g2.evaluate("tw.undo()"); await idle(g2)

        print('LINK: import it in the bar, then delete it')
        na0 = await g2.evaluate("tw.sync.campaign.areas.length")
        await bar(g2, f"import {link}")
        check(await wait(g2, f"tw.sync.campaign.areas.length === {na0 + 1} && tw.share.lastImport?.area && tw.share.lastImport?.name === {json.dumps(adoc['name'])}", 30000), '"import <link>" in the command bar fetches it (from our relay): the area comes in as a new area')
        await gm.bring_to_front()
        listed = await gm.evaluate("tw.share.refreshLinks().then(L => L.map(l => l.id))")
        check(lid in listed, "the GM's links are listed (Settings ▸ Invites and exports ▸ Shared builds)", listed)
        await gm.evaluate(f"tw.share.deleteLink('{lid}')"); await gm.wait_for_timeout(500)
        check(get(link)[0] == 404 and get(f"{RELAY}/s/{lid}/json")[0] == 404, 'Delete link: the page and the build are gone')

        print('AREA')
        await g2.bring_to_front()
        na0 = await g2.evaluate("tw.sync.campaign.areas.length")
        await g2.evaluate(f"tw.share.importText({json.dumps(json.dumps(adoc))})")
        check(await wait(g2, f"tw.sync.campaign.areas.length === {na0 + 1} && tw.share.lastImport?.area", 30000), 'a whole area comes in as a new area')
        na = await g2.evaluate("tw.share.lastImport.area")
        check(await g2.evaluate(f"tw.sync.campaign.areas.find(a => a.id === '{na}').visibility") == 'hidden', 'hidden from players, like any new area')

        print('DROP and ?share=')
        await g2.evaluate(f"""(() => {{ const dt = new DataTransfer(); dt.items.add(new File([{json.dumps(json.dumps(gdoc))}], 'props.turnip.json', {{ type: 'application/json' }})); window.dispatchEvent(new DragEvent('dragover', {{ dataTransfer: dt, cancelable: true }})); window.dispatchEvent(new DragEvent('drop', {{ dataTransfer: dt, cancelable: true }})); }})()""")
        check(await wait(g2, "tw.mode?.share?.doc?.kind === 'group'", 8000), 'a .turnip.json dropped on the window starts the ghost')
        await g2.keyboard.press('Escape'); await g2.wait_for_timeout(200)
        check(await g2.evaluate("!tw.mode && !(tw.worldOf(tw.area()).cellMarks && [...tw.worldOf(tw.area()).cellMarks.keys()].some(k => k.startsWith('share-ghost')))"), 'Esc cancels it, ghost and footprint gone')
        await gm.bring_to_front()
        await gm.evaluate("tw.share.open({ area: true })"); await gm.wait_for_timeout(300)
        await gm.click('#shareModal [data-act=link]'); await wait(gm, "!!document.querySelector('#shareModal .shlink code')", 20000)
        link2 = await gm.evaluate("document.querySelector('#shareModal .shlink code').textContent"); await gm.evaluate("tw.share.close()")
        me2 = await g2.evaluate("tw.inviteLink(tw.sync.token)")
        base2, frag2 = me2.split('#', 1)
        na1 = await g2.evaluate("tw.sync.campaign.areas.length")
        g3 = await tab(base2 + '&share=' + link2.rsplit('/', 1)[-1] + '#' + frag2)
        check(await wait(g3, f"window.tw && tw.ready && tw.ready() && tw.sync.campaign.areas.length === {na1 + 1} && !!tw.share.lastImport?.area", 60000), '"Use in my campaign" (?share=<id>): the game opens and the area comes in as a new area')
        check(await g3.evaluate("!new URLSearchParams(location.search).has('share')"), 'and the address forgets it (a reload does not import twice)')
        await g3.close()

        print('XSS')
        bad = json.loads(json.dumps(gdoc)); evil = '<img src=x onerror="window.__xss=1">'
        bad['name'] = evil; bad['objects'][0]['name'] = evil
        await g2.evaluate(f"tw.share.importText({json.dumps(json.dumps(bad))})"); await g2.wait_for_timeout(200)
        await g2.mouse.move(px, py, steps=3); await g2.wait_for_timeout(300)
        await g2.mouse.click(px, py); await wait(g2, "tw.share.lastImport?.name?.startsWith('<img')", 15000)
        xs = await g2.evaluate("({ fired: window.__xss === 1, imgs: document.querySelectorAll('img[src=\"x\"]').length, text: document.getElementById('toast').textContent.includes('<img src=x') })")
        check(not xs['fired'] and xs['imgs'] == 0 and xs['text'], 'a build named <img onerror=…> is shown as text (its toast): nothing runs, no element is made', xs)
        await g2.evaluate("tw.undo()"); await idle(g2)

        print('BEST EFFORT')
        await g2.bring_to_front()
        trap = '<img src=x onerror="window.__xss=2">'
        broke = json.loads(json.dumps(adoc)); broke['name'] = 'Broken map'; broke['area'] = {'name': 'Broken map'}
        n_good = sum(len(broke[k]) for k in ['rooms', 'objects', 'edges', 'pawns', 'water'])
        broke['objects'] += [{'ref': 'o90001', 'cat': 'barrel', 'x': 200, 'z': 200, 'url': 'https://evil.example/x.glb'}, {'ref': 'o90002', 'cat': 'barrel', 'x': 200, 'z': 200, 'parent': 'o90001'}, {'ref': 'o90003', 'cat': 'barrel', 'name': trap, 'x': 'not a number', 'z': 200}]
        broke['pawns'] += [{'ref': 'p90001', 'name': 'Thief', 'x': 5, 'z': 5, 'owner': 'seat_mira000001'}]
        na0 = await g2.evaluate("tw.sync.campaign.areas.length")
        await g2.evaluate(f"tw.share.importText({json.dumps(json.dumps(broke))})")
        check(await wait(g2, f"tw.sync.campaign.areas.length === {na0 + 1} && tw.share.lastImport?.name === 'Broken map' && tw.share.lastImport?.steps > 0 && !!document.querySelector('#shareModal .shleft')", 30000), 'a good area with broken pieces in it comes in as a new area, and a window says what was left out')
        line = await g2.evaluate("document.querySelector('#shareModal .shwhat').textContent")
        check(line == f'Imported {n_good} of {n_good + 4} pieces; left out 4', 'the sentence: "Imported N of M pieces; left out 4"', line)
        toast = await g2.evaluate("document.getElementById('toast').textContent")
        check(f'Imported {n_good} of {n_good + 4} pieces; left out 4' in toast, 'the toast says it too', toast)
        li = await g2.evaluate("document.querySelector('#shareModal .shreport').textContent")
        check('an unknown field (url)' in li and 'what it rested on was left out' in li and 'Thief' in li and 'not a number' in li, 'the list gives each reason in words', li[:300])
        xs = await g2.evaluate("({ fired: window.__xss === 2, imgs: document.querySelectorAll('#shareModal img, img[src=\"x\"]').length, shown: document.querySelector('#shareModal .shreport').textContent.includes('<img src=x') })")
        check(not xs['fired'] and xs['imgs'] == 0 and xs['shown'], 'a name in the list is text: nothing runs, no element is made', xs)
        await g2.click('#shareModal [data-act=copyleft]'); await g2.wait_for_timeout(200)
        copied = await g2.evaluate("tw.share.lastCopied")
        check('left out 4' in copied and 'Broken map' in copied, 'Copy this list copies it as plain text', copied[:160])
        await g2.click('#shareModal .sbtn.primary'); await g2.wait_for_timeout(200)
        check(await g2.evaluate("tw.share.isOpen() === false"), 'OK closes the window')
        na = await g2.evaluate("tw.share.lastImport.area")
        await g2.evaluate(f"tw.sync.subscribe('{na}')"); await wait(g2, f"!!tw.sync.view('{na}')", 15000)
        ins = await g2.evaluate(f"(() => {{ const E = Object.values(tw.sync.view('{na}').entities); return {{ pieces: E.filter(e => ['room', 'object', 'edge', 'token', 'water'].includes(e.kind)).length, owned: E.filter(e => e.owner).length, thief: E.some(e => e.name === 'Thief'), evil: JSON.stringify(E).includes('evil.example') }}; }})()")
        check(ins['pieces'] == n_good and not ins['owned'] and not ins['thief'] and not ins['evil'], 'what landed is the good pieces: no owner, no link, no thief', ins)
        await g2.evaluate(f"tw.sync.unsubscribe('{na}')")
        na0 = await g2.evaluate("tw.sync.campaign.areas.length")
        camp = {'v': 1, 'kind': 'turnip-works-campaign', 'name': 'x', 'areas': ['not an area', {'name': 'Campaign area', 'entities': {'room_camp0000001': {'kind': 'room', 'recipe': {'type': 'common', 'x': 0, 'z': 0, 'w': 3, 'd': 3, 'seed': 7}}, 'obj_broken00001': {'kind': 'object', 'cat': 'barrel'}}}]}
        n = await g2.evaluate(f"tw.settings.importData({json.dumps(camp)})")
        check(n == 1 and await wait(g2, f"tw.sync.campaign.areas.length === {na0 + 1} && !!document.querySelector('#shareModal .shleft')", 15000), 'a campaign file: the area that is an area comes in, the window lists the rest', n)
        li2 = await g2.evaluate("document.querySelector('#shareModal .shreport').textContent")
        check('This file' in li2 and 'Campaign area' in li2, 'one window, area by area', li2[:300])
        await g2.evaluate("tw.share.close()")

        print('STARTER')
        await g2.evaluate("tw.settings.show('admin')"); await g2.wait_for_timeout(1500)
        btn = await g2.query_selector('#settingsModal [data-starter]')
        check(btn is not None and 'Test cottage' in (await btn.inner_text()), 'Invites and exports ▸ Shared builds lists the starter builds')
        if btn:
            await btn.click()
            check(await wait(g2, "tw.mode?.share?.doc?.name === 'Test cottage'", 10000), 'a starter build imports like any other (the ghost)')
            await g2.keyboard.press('Escape')

        print('PLAYER')
        tok = await gm.evaluate("tw.createSeat({ kind: 'human', role: 'player', name: 'Mira', color: '#6fc36f' })")
        pl_link = await gm.evaluate(f"tw.inviteLink('{tok}')")
        pl = await tab(pl_link)
        check(await wait(pl, "window.tw && tw.ready && tw.ready() && !!tw.view()", 60000), 'a player tab')
        await pl.evaluate("tw.select(['tok_goblin0001'].filter(id => tw.ent(id)).length ? [] : [])")
        pm = await pl.evaluate("['share.import', 'share.area', 'share.areaLink'].map(id => tw.registry.permitted(tw.registry.get(id), tw.registry.ctx()))")
        check(not any(pm), 'a player has none of the share commands', pm)

        real = [e for e in errors if 'favicon' not in e]
        check(not real, 'no page errors', real[:3])
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
n_ok = sum(1 for r in results if r[0]); print(f'\nbrowser_share: {n_ok}/{len(results)} passed')
sys.exit(0 if n_ok == len(results) else 1)

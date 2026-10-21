#!/usr/bin/env python3
"""Figures as pawns, and the command bar brought up to date (Harry 2026-10-06; docs/UI.md). GM tab + player tab + an AI seat.

  local:  TW_GPU=1 python3 engine/test/browser_figs.py --local [--only BAR,AUDIT] [--shots DIR]

  LIST     the figure list loads as data: no mesh and no picture is fetched until asked for; a search is fast
  BAR      a figure is found by name, id, group, class, race, tag and SRD monster name; its row carries a thumbnail;
           at most 8 rows (and 8 pictures) are drawn; "add pawn", "place figure", "mini", "spawn" lead to the same list
  PLACE    pick a figure in the bar, click a square: a pawn wearing it, on the square's centre, labelled; R turns the
           ghost; the figure stands ON its disc (lowest vertex to disc top), at its stated height, facing as set
  RIM      the rim is the owner seat's colour (nobody's: the placer's) and follows a change of seat colour; the facing
           mark is a contrasting tone and points the way the pawn faces
  SEATS    the player's tab shows the same figure, measured the same
  LARGE    a large creature covers 2 x 2 squares, stands where they meet, drags from crossing to crossing
  COUNT    "6 goblins": one click, six pawns on six different squares, numbered, one undo; the next group carries on
  CHANGE   "change figure" on a selected pawn; back to the plain stand-in; the old stand-in is untouched
  DRAG     a figure row is DRAGGED out of the bar onto the map: the ghost follows, snaps to the squares (Shift: free),
           a large creature on its four, a count drops the group, R turns it, it lands on the floor that shows; Esc or
           a release off the map cancels; a click is still a click; a "change figure" row dropped ONTO a pawn; touch
  PAWN     a figure pawn through select, ring, snap, drag, stairs, raise, hide, label, HP, conditions, copy / paste
  NAME     a figure pawn's name is lettered round its base, toward the camera (or fixed), long names cut; the floating
           label keeps HP and conditions; "pawn names" switches back; every choice is one parameter
  MAIN     a player's main pawn: the game tier first, then the original mesh swapped in with no jump; one per seat
  AI       an AI seat finds a figure (figures?q=) and places it by id through GET; a wrong id is refused with a hint
  AUDIT    every registered command: found in the bar by its own title wherever it applies, and runs without an error
  COST     (--cost) tables of 5, 20 and 60 different figures: megabytes fetched, texture memory, frame time
"""
import argparse, asyncio, atexit, json, os, random, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--only'); ap.add_argument('--shots'); ap.add_argument('--cost', action='store_true')
A = ap.parse_args(); ONLY = set((A.only or '').upper().split(',')) - {''}
on = lambda name: not ONLY or name in ONLY
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
@atexit.register
def _cleanup():
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
    for d in tmp: shutil.rmtree(d, ignore_errors=True)   # the throwaway campaign lives here: nothing is left behind

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18157,18787').split(','))  # TW_PORTS=18167,18797 when another worktree is running this suite
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-figs-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

UA = {'User-Agent': 'tw-figs-test'}
def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def acknowledged(pg, what):
    """Optimistic entities are immediate; seq/undo belong to the relay's acknowledgement."""
    before = await pg.evaluate('({pending: tw.sync.pendingCount(), seq: tw.seq()})')
    await pg.wait_for_function('tw.sync.pendingCount() === 0', timeout=20000)
    if before['pending']:
        print(f"    acknowledged {what}: {before['pending']} pending, seq {before['seq']} -> {await pg.evaluate('tw.seq()')}", flush=True)

async def view(pg, x, z, dist=110, pitch=58, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; tw.main.glide = null; }})()")
    await pg.wait_for_timeout(250)
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over')
    await pg.wait_for_timeout(300)
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")
async def click_at(pg, x, z, y=0, **kw):
    p = await scr(pg, x, z, y); await pg.mouse.move(p['x'], p['y']); await pg.wait_for_timeout(120); await pg.mouse.click(p['x'], p['y'], **kw); await pg.wait_for_timeout(250)
async def drag(pg, a, b, steps=12, mods=()):
    for m in mods: await pg.keyboard.down(m)
    await pg.mouse.move(a['x'], a['y']); await pg.mouse.down()
    for i in range(1, steps + 1): await pg.mouse.move(a['x'] + (b['x'] - a['x']) * i / steps, a['y'] + (b['y'] - a['y']) * i / steps); await pg.wait_for_timeout(16)
    await pg.wait_for_timeout(80); await pg.mouse.up()
    for m in mods: await pg.keyboard.up(m)
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
# the bar's rows as drawn: [{ sec } | { title, sub, pic, disabled }]
ROWS = """[...document.querySelectorAll('#results > *')].map(el => el.classList.contains('sec') ? { sec: el.textContent } : el.classList.contains('res') ? { title: el.querySelector('.t').textContent, sub: el.querySelector('.s')?.textContent || '', pic: el.querySelector('.pic img')?.getAttribute('src') || null, disabled: el.classList.contains('disabled'), chips: [...el.querySelectorAll('.chip')].map(c => c.textContent) } : { empty: el.textContent })"""
async def bar(pg, text, enter=False):
    """type into the command bar (as a person does); returns the rows drawn"""
    if not await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('/'); await pg.wait_for_timeout(120)
    await pg.evaluate("(() => { const i = document.querySelector('#bar input'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()")
    await pg.keyboard.type(text, delay=6); await pg.wait_for_timeout(150)
    rows = await pg.evaluate(ROWS)
    if enter: await pg.keyboard.press('Enter'); await pg.wait_for_timeout(250)
    return rows
def figs_of(rows):
    out, inside = [], False
    for r in rows:
        if 'sec' in r: inside = r['sec'].startswith('Figures'); continue
        if inside and 'title' in r: out.append(r)
    return out
FIG = lambda id: f"tw.worldOf(tw.area()).figureOf('{id}')"
ENT = lambda id: f"tw.entities()['{id}']"
TOKENS = "Object.values(tw.entities()).filter(e => e.kind === 'token')"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, *(['--disable-frame-rate-limit', '--disable-gpu-vsync'] if os.environ.get('TW_UNCAP') else []), '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []; fetched = {'glb': [], 'thumb': []}
        def track(req):
            u = req.url
            u = u.replace('/assets/d/figures/', '/assets/figures/')  # (a delivered copy: assets/d/figures/<name>.<token>.glb, docs/ASSET_DELIVERY.md)
            if '/assets/figures/' in u: fetched['thumb' if '/thumbs/' in u else 'glb'].append(u.split('/assets/figures/')[1].split('?')[0])
        async def tab(url, w=1400, h=900, **kw):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, **kw)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e.stack}')); pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and errors.append(f'console: {m.text[:200]}'))
            await pg.goto(url); return pg
        gm = await tab(page); gm.on('request', track)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST figs {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        R = {}
        for (name, a) in (('common', dict(type='common', x=0, z=0, w=8, d=6, seed=6101)), ('up', dict(type='guest', x=0, z=0, w=4, d=4, y=10, seed=6103))):
            rid = f"room_fig{name}{random.randrange(10**6):06d}"[:24]
            R[name] = await gm.evaluate(SPAWN, {'id': rid, **a})
            check(await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, name), f'{name} built')
        await settle(gm)
        # the common room's furniture is in the way of a clean table: clear it (the test is about pawns)
        await gm.evaluate(f"tw.batch(Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{R['common']}' && !tw.ST.isConnector(e)).map(e => ({{ type: 'object.delete', args: {{ id: e.id }} }})))"); await gm.wait_for_timeout(500)
        await gm.evaluate("tw.cutToRoom?.(tw.entities()['%s'], 'test')" % R['common']); await gm.wait_for_timeout(600)
        await view(gm, 20, 15, 80, 62)
        CID = await gm.evaluate('tw.sync.campaign.id'); AREA = await gm.evaluate('tw.area()'); GMC = (await gm.evaluate('tw.myColor()')).lower()
        N = await gm.evaluate('tw.figures.count')

        if on('LIST'):
            print('LIST')
            check(N >= 300, 'the figure list is loaded as data', f'{N} figures')
            check(not fetched['glb'] and not fetched['thumb'] and await gm.evaluate('tw.figures.stats.loads') == 0, 'nothing of it is fetched up front: no mesh, no picture', f"{len(fetched['glb'])} meshes, {len(fetched['thumb'])} pictures")
            t = await gm.evaluate("(() => { const qs = ['owlbear', 'elf wizard', 'goblin spear', 'townsfolk', 'hero', 'large', 'paladin', 'tiefling', 'dragon', 'x', 'woman dwarf cleric', 'zzzz']; const t0 = performance.now(); let n = 0; for (let i = 0; i < 50; i++) for (const q of qs) n += tw.figures.search(q).length; return { ms: (performance.now() - t0) / (50 * qs.length), n }; })()")
            check(t['ms'] < 2.0, 'a search of the whole list takes well under a frame', f"{t['ms']:.3f} ms a search")
            sizes = await gm.evaluate("tw.figures.list.map(f => [f.id, f.size, f.base, f.tier, f.tris, f.group])")
            hero = [s for s in sizes if s[5] == 'hero']; town = [s for s in sizes if s[5] in ('townsfolk',)]
            check(all(s[3] == 'hero' and 15000 <= s[4] <= 21000 for s in hero) and all(s[3] == 'horde' and 6000 <= s[4] <= 8500 for s in town), 'tiers: heroes about 20k triangles, townsfolk about 8k', f"{len(hero)} heroes {min(s[4] for s in hero)}..{max(s[4] for s in hero)}; {len(town)} townsfolk {min(s[4] for s in town)}..{max(s[4] for s in town)}")
            check(all((s[1] == 2) == (s[2] == 10) for s in sizes), 'a 10-ft base is 2 squares a side, a 5-ft base 1', f"{sum(s[1] == 2 for s in sizes)} large")
            lib = await gm.evaluate("Object.keys(tw.lib.objects).filter(k => tw.figures.byId.has(k)).length + tw.assets.catalog.filter(c => tw.figures.byId.has(c.id)).length")
            check(lib == 0, 'no figure is in the furniture library or the catalog (room generation never sees one)')

        if on('BAR'):
            print('BAR')
            rows = await bar(gm, 'owlbear'); f = figs_of(rows)
            check(f and f[0]['title'] == 'Owlbear' and 'large' in f[0]['sub'], '"owlbear" finds the owlbear, and says it is large', str(f[:1]))
            check(f and f[0]['pic'] and '/assets/figures/thumbs/foe-owlbear-' in f[0]['pic'], 'its row carries a thumbnail', str(f and f[0]['pic']))
            await gm.wait_for_timeout(600)
            check(len(fetched['thumb']) <= 24 and not fetched['glb'], 'only the pictures of rows that were drawn while typing were fetched (8 at most per keystroke); still no mesh', f"{len(fetched['thumb'])} pictures of {N}")
            for q, want, why in (('elf wizard', lambda t: t.startswith('Elf wizard'), 'race + class'), ('goblin spear', lambda t: t == 'Goblin, spear', 'name words'), ('hero-paladin-small-f', lambda t: t == 'Small-folk paladin (woman)', 'its id'),
                                 ('gorilla', lambda t: t == 'Ape', 'a tag'), ('baboon', lambda t: t == 'Ape', 'an SRD monster name'), ('worg', lambda t: t == 'Dire wolf', 'an SRD monster name'), ('tiefling', lambda t: 'iefling' in t, 'a race'), ('paladin', lambda t: 'paladin' in t.lower(), 'a class')):
                f = figs_of(await bar(gm, q)); check(f and want(f[0]['title']), f'"{q}" ({why})', f[0]['title'] if f else 'nothing')
            for g in ('townsfolk', 'beast', 'foe', 'hero', 'large'):
                f = figs_of(await bar(gm, g)); subs = [r['sub'].split(' · ')[0] for r in f]
                check(len(f) == 8 and all(s == g for s in subs), f'the group "{g}" lists figures of that group', f'{len(f)} rows: {sorted(set(subs))}')
            f = figs_of(await bar(gm, 'hero')); n_img = await gm.evaluate("document.querySelectorAll('#results img').length"); n_res = await gm.evaluate("document.querySelectorAll('#results .res').length")
            check(len(f) == 8 and n_img <= 20 and n_res <= 40, 'a search that matches 161 figures draws 8 of them', f'{len(f)} figure rows, {n_img} pictures in the list, {n_res} rows in all')
            for q in ('add pawn owlbear', 'place figure owlbear', 'mini owlbear', 'spawn owlbear', 'add an owlbear', 'place a figure owlbear'):
                rows = await bar(gm, q); f = figs_of(rows)
                check(f and (f[0]['title'] == 'Owlbear' or f[0]['chips'] == ['add pawn', 'Owlbear', 'click a square']), f'"{q}" leads to the owlbear', str(f[:1])[:140])
            rows = await bar(gm, 'add pawn'); titles = [r.get('title', '') for r in rows]
            check(any(t.startswith('Add pawn') for t in titles), '"add pawn" finds the Add pawn command, with a line saying what to type', str(titles[:4]))
            for q in ('figure', 'mini', 'spawn', 'place figure', 'creature', 'monster'):
                rows = await bar(gm, q); check(any(r.get('title', '').startswith('Add pawn') for r in rows), f'"{q}" finds Add pawn', str([r.get('title') for r in rows][:3]))
            chips = await gm.evaluate("(async () => { const i = document.querySelector('#bar input'); i.value = '6 goblins'; i.dispatchEvent(new Event('input', { bubbles: true })); return [...document.querySelectorAll('#bar .chips .chip')].map(c => c.textContent); })()")
            check(chips[:2] == ['add pawn', '6 ×'] and chips[-1] == 'click a square', 'a count shows as chips in the bar: add pawn ▸ 6 × ▸ the figure ▸ click a square', str(chips))
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)

        ids = {}
        if on('PLACE') or on('RIM') or on('SEATS') or on('CHANGE') or on('PAWN'):
            print('PLACE')
            await bar(gm, 'goblin spear', enter=True)
            m = await gm.evaluate("tw.mode && { kind: tw.mode.kind, fig: tw.mode.pawn?.fig?.id, n: tw.mode.pawn?.n }")
            check(m and m['kind'] == 'place' and m['fig'] == 'foe-goblin-spear', 'Enter on a figure row starts the pawn tool', str(m))
            p = await scr(gm, 11.2, 13.9); await gm.mouse.move(p['x'], p['y']); await gm.wait_for_timeout(250)
            cells = await gm.evaluate("(() => { const c = tw.worldOf(tw.area()).cellMarks?.get('pawn-tool'); return c ? c.lit.count : 0; })()")
            check(cells == 1, 'the square it would stand on is lit while the ghost rides the pointer', f'{cells} square')
            await gm.keyboard.press('r'); await gm.wait_for_timeout(80)
            n0 = await gm.evaluate(f"{TOKENS}.length"); await gm.mouse.click(p['x'], p['y']); await gm.wait_for_timeout(500)
            toks = await gm.evaluate(TOKENS); new = [t for t in toks if t.get('fig') == 'foe-goblin-spear']
            check(len(toks) == n0 + 1 and len(new) == 1, 'a click on a square places one pawn wearing the figure', str([{k: t.get(k) for k in ('name', 'fig', 'x', 'z', 'rot', 'color')} for t in new]))
            g = new[0]; ids['goblin'] = g['id']
            check(g['x'] == 12.5 and g['z'] == 12.5, "it stands on the centre of the clicked square", f"clicked (11.2, 13.9) -> ({g['x']}, {g['z']})")
            check(g['name'] == 'Goblin' and await gm.evaluate('tw.mode') is None and await gm.evaluate(f"tw.sel.has('{g['id']}')"), 'it is labelled by its figure ("Goblin"), the tool is put away, and the new pawn is selected', g['name'])
            check(len(fetched['glb']) == 1 and fetched['glb'][0].startswith('foe-goblin-spear--8k512-'), 'ONE mesh was fetched: the figure placed, at its horde tier', str(fetched['glb']))
            await wait(gm, f"{FIG(g['id'])}?.loaded", 20000, 'goblin mesh')
            M = await gm.evaluate(FIG(g['id']))
            check(M and M.get('feet_above_disc_ft') is not None and abs(M['feet_above_disc_ft']) <= 0.002, 'its lowest point is on the top of its disc', f"{M and M['feet_above_disc_ft']} ft (disc top at {M and M['disc_top_ft']} ft)")
            check(M and abs(M['height_ft'] - M['overall_ft'] * M['scale']) <= 0.06 * M['overall_ft'] * M['scale'] and M['overall_ft'] >= M['stated_ft'], 'it is as tall as the set says', f"{M and M['height_ft']} ft measured; stated {M and M['stated_ft']} ft body, {M and M['overall_ft']} ft to its spear tip")
            check(M and abs(M['base_width_ft'] - 4.5) < 0.01, 'its base is 4.5 ft across in its 5-ft square', str(M and M['base_width_ft']))
            check(M and abs(M['facing_deg'] - 45) < 0.5 and abs(g['rot'] - 0.79) < 0.01, 'R turned the ghost 45 degrees and the pawn faces that way', f"{M and M['facing_deg']} deg")
            check(M and M['point'][0] > 1.5 and M['point'][1] > 1.5, "the base's point is on the side it faces", str(M and M['point']))
            await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{g['id']}', x: 12.5, z: 12.5, rot: {3.14159265 * 1.5} }})"); await gm.wait_for_timeout(300)
            M2 = await gm.evaluate(FIG(g['id'])); check(abs(M2['facing_deg'] - 270) < 0.5 and M2['point'][0] < -2.4 and abs(M2['point'][1]) < 0.1, 'turned to face -X, the figure and the point both face -X', f"{M2['facing_deg']} deg, point {M2['point']}")
            # Shift keeps placing; Esc puts the tool away
            await bar(gm, 'grey wolf', enter=True); a = await scr(gm, 22.5, 7.5); b = await scr(gm, 27.5, 7.5)
            await gm.keyboard.down('Shift'); await gm.mouse.click(a['x'], a['y']); await gm.wait_for_timeout(250); await gm.mouse.click(b['x'], b['y']); await gm.wait_for_timeout(250); await gm.keyboard.up('Shift')
            still = await gm.evaluate('!!tw.mode?.pawn'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
            wolves = [t for t in await gm.evaluate(TOKENS) if t.get('fig') == 'foe-wolf']
            check(len(wolves) == 2 and still and await gm.evaluate('tw.mode') is None and sorted(t['name'] for t in wolves) == ['Grey wolf 1', 'Grey wolf 2'], 'Shift+click keeps placing (and numbers them); Esc puts the tool away', str(sorted(t['name'] for t in wolves)))
            ids['wolf'] = wolves[0]['id']

        if on('RIM') or on('SEATS') or on('PAWN'):
            print('RIM + SEATS')
            await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
            await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
            invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
            pl = await tab(invite + '&nofx&nointro', reduced_motion='reduce')
            check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab live')
            PL = await pl.evaluate('tw.me()'); PLC = (await pl.evaluate('tw.myColor()')).lower()
            gid = ids['goblin']
            M = await gm.evaluate(FIG(gid)); check(M['rim'] == GMC and M['wedge'] != M['rim'], "nobody's pawn: the rim is the colour of the seat that placed it; the facing wedge is another tone", f"rim {M['rim']} (GM {GMC}), wedge {M['wedge']}")
            # a pawn that belongs to a seat wears that seat's colour (made hers here by the data, as the GM's tools will)
            g0 = await gm.evaluate(ENT(gid)); await gm.evaluate(f"tw.batch([{{ type: 'token.delete', args: {{ id: '{gid}' }} }}, {{ type: 'token.create', args: {{ id: 'tok_mirasgob01', name: 'Goblin', x: 12.5, z: 12.5, rot: {g0['rot']}, color: '{g0['color']}', owner: '{PL}', fig: 'foe-goblin-spear' }} }}])"); gid = ids['goblin'] = 'tok_mirasgob01'; await gm.wait_for_timeout(500)
            e = await gm.evaluate(ENT(gid)); await wait(gm, f"{FIG(gid)}?.loaded", 15000)
            M = await gm.evaluate(FIG(gid)); check(e['owner'] == PL and M['rim'] == PLC and PLC != GMC, "Mira's pawn: its rim is her colour, not the placer's", f"rim {M['rim']} (Mira {PLC}, GM {GMC})")
            await wait(pl, f"{FIG(gid)}?.loaded", 25000, 'figure on the player tab')
            P = await pl.evaluate(FIG(gid)); pe = await pl.evaluate(ENT(gid))
            check(pe and pe.get('fig') == 'foe-goblin-spear' and P and P['fig'] == 'foe-goblin-spear', 'the player sees the same figure (it is pawn data through the relay)', str(pe and pe.get('fig')))
            check(P and P['rim'] == PLC and abs(P['feet_above_disc_ft']) <= 0.002 and abs(P['height_ft'] - M['height_ft']) < 0.01 and abs(P['facing_deg'] - M['facing_deg']) < 0.5, 'measured the same there: on its disc, same height, same facing, her colour on the rim', f"{P and {k: P[k] for k in ('feet_above_disc_ft', 'height_ft', 'facing_deg', 'rim')}}")
            await pl.evaluate("tw.dispatch('seat.set', { who: tw.me(), color: '#33cc88' })"); await gm.wait_for_timeout(900)
            M = await gm.evaluate(FIG(gid)); check(M['rim'] == '#33cc88', 'she changes her seat colour: the rim follows at once', M['rim'])
            # the player may move her pawn; it snaps to a square like any pawn
            await pl.evaluate("tw.cutToRoom(tw.entities()['%s'], 'test')" % R['common']); await pl.wait_for_timeout(500)
            await view(pl, 20, 15, 80, 62); a = await scr(pl, 12.5, 12.5, 1.5); b = await scr(pl, 16.4, 18.2)
            await drag(pl, a, b); await pl.wait_for_timeout(500); e = await gm.evaluate(ENT(gid))
            check(e['x'] == 17.5 and e['z'] == 17.5, 'the player drags her figure pawn by the figure itself: it lands on a square centre', f"({e['x']}, {e['z']})")

        if on('LARGE'):
            print('LARGE')
            await bar(gm, 'owlbear', enter=True); p = await scr(gm, 31.0, 21.5); await gm.mouse.move(p['x'], p['y']); await gm.wait_for_timeout(250)
            cells = await gm.evaluate("tw.worldOf(tw.area()).cellMarks?.get('pawn-tool')?.lit.count")
            await gm.mouse.click(p['x'], p['y']); await gm.wait_for_timeout(500)
            o = [t for t in await gm.evaluate(TOKENS) if t.get('fig') == 'foe-owlbear'][-1]; ids['owlbear'] = o['id']
            check(cells == 4 and o.get('size') == 2 and o['x'] == 30 and o['z'] == 20, 'a large creature lights and takes 2 x 2 squares, standing where the four meet', f"{cells} squares lit; at ({o['x']}, {o['z']}), size {o.get('size')}")
            await wait(gm, f"{FIG(o['id'])}?.loaded", 20000, 'owlbear mesh'); M = await gm.evaluate(FIG(o['id']))
            check(abs(M['base_width_ft'] - 9) < 0.01 and abs(M['feet_above_disc_ft']) <= 0.002 and abs(M['height_ft'] - 8 * M['scale']) < 0.5 * M['scale'], 'its base is 9 ft across, it stands on it, and it is 8 ft tall times the figure scale', f"{M['base_width_ft']} ft base, {M['height_ft']} ft tall, feet {M['feet_above_disc_ft']}")
            check(fetched['glb'][-1].startswith('foe-owlbear--20k1024-') and 15000 <= M['tris'] <= 21000, 'a large creature loads at the hero tier (about 20k triangles)', f"{M['tris']} triangles")
            await gm.evaluate("tw.clearSelection()"); await gm.wait_for_timeout(150)
            a = await scr(gm, 30, 20, 3); b = await scr(gm, 23.6, 13.4); await drag(gm, a, b)  # (grabbed 3 ft up its body: the ground under that point is 1.6 ft behind it); await gm.wait_for_timeout(500)
            e = await gm.evaluate(ENT(o['id'])); check(e['x'] == 25 and e['z'] == 15, 'dragged, it snaps from crossing to crossing (never to a square centre)', f"({e['x']}, {e['z']})")
            await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{o['id']}', x: 30, z: 20 }})"); await gm.wait_for_timeout(250)

        if on('COUNT'):
            print('COUNT')
            await acknowledged(gm, 'before count baseline')
            n0 = await gm.evaluate(f"{TOKENS}.length"); rows = await bar(gm, '6 goblins'); f = figs_of(rows)
            check(f and f[0]['chips'][:2] == ['add pawn', '6 ×'] and f[0]['chips'][2].startswith('Goblin'), '"6 goblins": the rows offer six of each goblin', str(f[:1])[:160])
            await gm.keyboard.press('Enter'); await gm.wait_for_timeout(250); p = await scr(gm, 7.5, 22.5); await gm.mouse.move(p['x'], p['y']); await gm.wait_for_timeout(250)
            cells = await gm.evaluate("tw.worldOf(tw.area()).cellMarks?.get('pawn-tool')?.lit.count"); seq0 = await gm.evaluate('tw.seq()')
            await gm.mouse.click(p['x'], p['y']); await gm.wait_for_timeout(700)
            await acknowledged(gm, 'six-pawn placement')
            L = await gm.evaluate('tw.lastPawns'); toks = {t['id']: t for t in await gm.evaluate(TOKENS)}; six = [toks[i] for i in L['ids'] if i in toks]
            spots = {(t['x'], t['z']) for t in six}
            check(cells == 6 and len(six) == 6 and len(toks) == n0 + 6, 'ONE click drops all six (six squares were lit under the ghost)', f'{cells} lit, {len(six)} placed')
            check(len(spots) == 6 and all(x % 5 == 2.5 and z % 5 == 2.5 for x, z in spots) and all(abs(x - 7.5) <= 10 and abs(z - 22.5) <= 10 for x, z in spots), 'on six different squares round the one clicked', str(sorted(spots)))
            name = six[0]['name'].rsplit(' ', 1)[0]; k0 = int(six[0]['name'].rsplit(' ', 1)[1])
            had = sorted(t['name'] for t in toks.values() if t['id'] not in L['ids'] and t['name'].startswith(name))
            check([t['name'] for t in six] == [f'{name} {i}' for i in range(k0, k0 + 6)] and k0 == len(had) + 1, 'numbered as they land, carrying on from the ones already on the table', f"{[t['name'] for t in six]} (there before: {had})")
            check(await gm.evaluate('tw.seq()') == seq0 + 1, 'it is one command', f"seq {seq0} -> {await gm.evaluate('tw.seq()')}")
            await gm.keyboard.press('Escape'); await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(600)
            await acknowledged(gm, 'six-pawn undo')
            check(await gm.evaluate(f"{TOKENS}.length") == n0, 'one undo takes all six away')
            await gm.keyboard.press('Control+Shift+z'); await gm.wait_for_timeout(600)
            await acknowledged(gm, 'six-pawn redo')
            check(await gm.evaluate(f"{TOKENS}.length") == n0 + 6, 'redo brings them back')
            await bar(gm, f'add 2 {L["fig"]}', enter=True); p2 = await scr(gm, 32.5, 7.5); await gm.mouse.click(p2['x'], p2['y']); await gm.wait_for_timeout(600)
            await acknowledged(gm, 'next counted group')
            L2 = await gm.evaluate('tw.lastPawns'); check(L2['names'] == [f'{name} {k0 + 6}', f'{name} {k0 + 7}'], 'the next group carries the count on', str(L2['names']))
            taken = await gm.evaluate(f"(() => {{ const seen = new Map(); for (const t of {TOKENS}) {{ const k = t.x + ':' + t.z + ':' + (t.y || 0); seen.set(k, (seen.get(k) || 0) + 1); }} return [...seen.values()].filter(n => n > 1).length; }})()")
            check(taken == 0, 'no two pawns were put on one square')
            rows = await bar(gm, 'goblin x3'); f = figs_of(rows); check(f and f[0]['chips'][:2] == ['add pawn', '3 ×'], '"goblin x3" is a count too', str(f[:1])[:120]); await gm.keyboard.press('Escape')

        if on('CHANGE'):
            print('CHANGE')
            wid = ids['wolf']; await gm.evaluate(f"tw.select('{wid}')")
            rows = await bar(gm, 'change figure'); check(any(r.get('title', '').startswith('Change figure') for r in rows), '"change figure" is offered for a selected pawn', str([r.get('title') for r in rows][:3]))
            f = figs_of(await bar(gm, 'change figure dire wolf', enter=True)); await gm.wait_for_timeout(500)
            e = await gm.evaluate(ENT(wid)); await wait(gm, f"{FIG(wid)}?.loaded", 20000); M = await gm.evaluate(FIG(wid))
            check(e['fig'] == 'foe-dire-wolf' and M['fig'] == 'foe-dire-wolf' and e['name'].startswith('Grey wolf'), '"change figure dire wolf": the pawn wears the dire wolf and keeps its name', f"{e['fig']} · {e['name']}")
            await bar(gm, 'change figure owlbear', enter=True); await gm.wait_for_timeout(500); e = await gm.evaluate(ENT(wid))
            check(e['fig'] == 'foe-owlbear' and e.get('size') == 2 and e['x'] % 5 == 0 and e['z'] % 5 == 0, 'changed to a large creature it takes 2 x 2 squares and moves onto their crossing', f"size {e.get('size')} at ({e['x']}, {e['z']})")
            await bar(gm, 'remove figure', enter=True); await gm.wait_for_timeout(500); e = await gm.evaluate(ENT(wid)); M = await gm.evaluate(FIG(wid))
            look = await gm.evaluate(f"(() => {{ const r = tw.worldOf(tw.area()).recs.get('{wid}'); const out = []; r.visual.traverse(c => {{ if (c.geometry) out.push(c.geometry.type); }}); return out.sort(); }})()")  # (the disc and the facing cone are in the pawn's foot group since 2026-10-13: docs/PAWNS.md "A raised pawn")
            check('fig' not in e and 'size' not in e and M is None and look == ['CapsuleGeometry', 'ConeGeometry', 'CylinderGeometry'] and e['x'] % 5 == 2.5, '"remove figure": back to the old stand-in pawn, untouched (disc, capsule, cone), on one square', f"{look} at ({e['x']}, {e['z']})")
            await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(500); e = await gm.evaluate(ENT(wid)); check(e.get('fig') == 'foe-owlbear', 'undo puts the figure back', str(e.get('fig')))
            await bar(gm, 'change figure grey wolf', enter=True); await gm.wait_for_timeout(400)
            # a pawn made with no figure (as every pawn before today) looks as it did
            await gm.evaluate("tw.dispatch('token.create', { id: 'tok_plainold01', name: 'Brakka', x: 37.5, z: 27.5, color: '#5aa9e6' })"); await gm.wait_for_timeout(400)
            e = await gm.evaluate(ENT('tok_plainold01')); look = await gm.evaluate("(() => { const out = []; tw.worldOf(tw.area()).recs.get('tok_plainold01').visual.traverse(c => { if (c.geometry) out.push(c.geometry.type); }); return out.sort(); })()")
            check('fig' not in e and 'size' not in e and look == ['CapsuleGeometry', 'ConeGeometry', 'CylinderGeometry'], 'a pawn with no figure chosen is stored and drawn exactly as before', str(sorted(e.keys())))
            await gm.evaluate("tw.clearSelection()"); await bar(gm, 'plain pawn', enter=True); await click_at(gm, 37.5, 22.5); e = [t for t in await gm.evaluate(TOKENS) if t['name'] == 'Pawn']
            check(len(e) == 1 and 'fig' not in e[0], '"plain pawn" places a stand-in from the bar', str(e[:1])[:120])

        if on('DRAG'):
            print('DRAG: a figure row is dragged out of the command bar onto the map')
            await gm.evaluate("(() => { tw.clearSelection(); if (tw.mode) tw.modes.cancel(); tw.cutToRoom?.(tw.entities()['%s'], 'test'); })()" % R['common']); await view(gm, 20, 15, 80, 62)
            ROWC = "(() => { const r = document.querySelector('#results .res.drags').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()"
            LIST = "(() => { const l = document.querySelector('#results'); return { vis: l.hidden ? 'gone' : getComputedStyle(l).visibility, open: document.querySelector('#bar').classList.contains('open'), text: document.querySelector('#bar input').value }; })()"
            MID = "({ fig: tw.mode?.pawn?.fig?.id || null, n: tw.mode?.pawn?.n || 0, via: !!tw.mode?.viaDrag, rot: tw.mode?.rot || 0, cells: tw.worldOf(tw.area()).cellMarks?.get('pawn-tool')?.lit.count || 0, list: %s, label: document.getElementById('modeLabel').textContent, body: document.body.classList.contains('dragging-out') })" % LIST
            NT = f"{TOKENS}.length"
            async def out(text, x, z, y=0, up=True, shift=False, key=None, to=None, shot=None):
                """press on the first figure row for `text`, drag to the map point (or the screen point `to`), let go"""
                await acknowledged(gm, 'before drag')
                await bar(gm, text); src = await gm.evaluate(ROWC); dst = to or await scr(gm, x, z, y)
                await gm.mouse.move(src['x'], src['y']); await gm.mouse.down(); await gm.mouse.move(src['x'] + 3, src['y'] + 2); await gm.wait_for_timeout(40)
                early = await gm.evaluate('!!tw.mode')
                for i in range(1, 11): await gm.mouse.move(src['x'] + (dst['x'] - src['x']) * i / 10, src['y'] + (dst['y'] - src['y']) * i / 10); await gm.wait_for_timeout(16)
                await gm.wait_for_timeout(120)
                if key: await gm.keyboard.press(key); await gm.wait_for_timeout(100)
                mid = await gm.evaluate(MID); mid['early'] = early
                if shot and A.shots: os.makedirs(A.shots, exist_ok=True); await gm.wait_for_timeout(700); await gm.screenshot(path=os.path.join(A.shots, shot))
                if up:
                    if shift: await gm.keyboard.down('Shift'); await gm.mouse.move(dst['x'] + 1, dst['y']); await gm.wait_for_timeout(60)
                    await gm.mouse.up()
                    if shift: await gm.keyboard.up('Shift')
                    await gm.wait_for_timeout(450)
                    await acknowledged(gm, 'drag release')
                return mid
            new_of = lambda toks, before: [t for t in toks if t['id'] not in before]
            ids0 = {t['id'] for t in await gm.evaluate(TOKENS)}
            PIC = ROWC.replace('.res.drags', '.res.drags .pic img'); ROWC, ROW0 = PIC, ROWC   # the first drag is by the row's PICTURE (an <img> must not start the browser's own image drag)
            await bar(gm, 'goblin bow'); dr = await gm.evaluate("document.querySelector('#results .res.drags .pic img')?.draggable")
            m = await out('goblin bow', 26.2, 23.9); ROWC = ROW0
            check(dr is False, 'the row\'s picture is not a browser-draggable image (the first drag below is by the picture)', dr)
            check(not m['early'], 'a press that moves 3 px is not yet a drag (no tool, nothing in hand)')
            check(m['fig'] == 'foe-goblin-bow' and m['via'] and m['cells'] == 1 and m['body'], 'past the threshold the figure is in hand: its ghost rides the pointer over the map, its square lit', {k: m[k] for k in ('fig', 'via', 'cells')})
            check(m['list']['vis'] == 'hidden' and 'let go on a square' in m['label'], 'the list steps aside while it is dragged; the pointer says "let go on a square"', [m['list']['vis'], m['label']])
            toks = await gm.evaluate(TOKENS); new = new_of(toks, ids0)
            check(len(new) == 1 and new[0].get('fig') == 'foe-goblin-bow' and new[0]['x'] == 27.5 and new[0]['z'] == 22.5, 'let go on the map: one pawn wearing the figure, on the centre of the square under the pointer', [(t.get('fig'), t['x'], t['z']) for t in new])
            st = await gm.evaluate("({ mode: !!tw.mode, sel: [...tw.sel], open: document.querySelector('#bar').classList.contains('open'), done: tw.lastDragOut?.done, body: document.body.classList.contains('dragging-out') })")
            check(not st['mode'] and st['sel'] == [new[0]['id']] and not st['open'] and st['done'] and not st['body'], 'the tool is put away, the bar is closed, the new pawn is selected', st)
            A1 = new[0]['id']; seq = await gm.evaluate('tw.seq()')
            # Esc, and a release off the map: nothing happened, the list is back
            ids1 = {t['id'] for t in await gm.evaluate(TOKENS)}
            m = await out('goblin bow', 32.5, 22.5, up=False); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
            L = await gm.evaluate(LIST); n = len(new_of(await gm.evaluate(TOKENS), ids1))
            check(m['via'] and n == 0 and await gm.evaluate('tw.mode') is None and L['vis'] == 'visible' and L['open'] and L['text'] == 'goblin bow', 'Esc while dragging: no pawn, the tool is gone, the list is back with what was typed', L)
            await gm.mouse.up(); await gm.wait_for_timeout(150)
            check(len(new_of(await gm.evaluate(TOKENS), ids1)) == 0 and await gm.evaluate('tw.mode') is None, 'and letting go afterwards does nothing')
            box = await gm.evaluate("(() => { const r = document.querySelector('#bar').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()")
            m = await out('goblin bow', 0, 0, to=box)
            L = await gm.evaluate(LIST)
            check(m['via'] and m['cells'] == 0 and len(new_of(await gm.evaluate(TOKENS), ids1)) == 0 and await gm.evaluate('tw.mode') is None and L['vis'] == 'visible' and L['open'], 'let go back over the bar: nothing is placed, the list is back', L)
            check(await gm.evaluate('tw.seq()') == seq, 'neither sent a command')
            # a plain click is still the click
            src = await gm.evaluate(ROWC); await gm.mouse.click(src['x'], src['y']); await gm.wait_for_timeout(250)
            c = await gm.evaluate("({ fig: tw.mode?.pawn?.fig?.id, via: !!tw.mode?.viaDrag, open: document.querySelector('#bar').classList.contains('open') })")
            check(c['fig'] == 'foe-goblin-bow' and not c['via'] and not c['open'], 'a plain click on the row still picks the figure up for a click on a square', c)
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
            # Shift: off the squares.  R turns it (and is not typed into the bar)
            m = await out('goblin bow', 31.3, 18.9, shift=True, key='r')
            new = new_of(await gm.evaluate(TOKENS), ids1)
            check(len(new) == 1 and abs(new[0]['x'] - 31.3) < 0.8 and abs(new[0]['z'] - 18.9) < 0.8 and (abs(new[0]['x'] - 32.5) > 0.3 or abs(new[0]['z'] - 17.5) > 0.3), 'Shift held at the release: it stands where the pointer is, off the squares', [(t['x'], t['z']) for t in new])
            check(abs(m['rot'] - 0.785) < 0.01 and new and abs(new[0]['rot'] - 0.79) < 0.01 and m['list']['text'] == 'goblin bow', 'R while dragging turns the ghost 45 degrees (and no letter is typed into the bar)', [m['rot'], m['list']['text']])
            # a large creature; a count
            ids2 = {t['id'] for t in await gm.evaluate(TOKENS)}
            m = await out('owlbear', 13.1, 21.2, shot='drag-out-owlbear.png'); new = new_of(await gm.evaluate(TOKENS), ids2)
            check(m['cells'] == 4 and len(new) == 1 and new[0].get('size') == 2 and new[0]['x'] % 5 == 0 and new[0]['z'] % 5 == 0 and abs(new[0]['x'] - 13.1) <= 2.5 and abs(new[0]['z'] - 21.2) <= 2.5, 'a large creature: its 2 x 2 squares are lit under the ghost and it lands where the four meet', [(t['x'], t['z'], t.get('size')) for t in new])
            ids3 = {t['id'] for t in await gm.evaluate(TOKENS)}; seq = await gm.evaluate('tw.seq()')
            m = await out('5 kobolds', 22.5, 12.5); new = new_of(await gm.evaluate(TOKENS), ids3)
            sq = {(t['x'], t['z']) for t in new}
            check(m['n'] == 5 and m['cells'] == 5 and len(new) == 5 and len(sq) == 5 and (22.5, 12.5) in sq and len({t['name'] for t in new}) == 5, 'a count dragged out ("5 kobolds") drops the whole group where it is let go: the lead on that square, numbered', sorted(t['name'] for t in new))
            await gm.evaluate('tw.undo()'); await gm.wait_for_timeout(500)
            await acknowledged(gm, 'dragged group undo')
            check(len(new_of(await gm.evaluate(TOKENS), ids3)) == 0, 'one undo takes the dragged group away')
            # the floor that shows under the pointer: upstairs
            await gm.evaluate("tw.cutOff('test')"); await gm.wait_for_timeout(600)
            ids4 = {t['id'] for t in await gm.evaluate(TOKENS)}
            m = await out('goblin bow', 12.5, 12.5, y=10); new = new_of(await gm.evaluate(TOKENS), ids4)
            check(len(new) == 1 and new[0].get('y') == 10 and new[0]['x'] == 12.5 and new[0]['z'] == 12.5, 'let go over the upstairs floor: it stands on that floor (10 ft up)', [(t['x'], t.get('y'), t['z']) for t in new])
            await gm.evaluate("tw.undo(); tw.cutToRoom?.(tw.entities()['%s'], 'test')" % R['common']); await gm.wait_for_timeout(600)
            await acknowledged(gm, 'upstairs pawn undo')
            # a "change figure" row dropped ONTO a pawn
            # the target: a pawn other than the selected one that the pointer really reaches at its own spot (on a full
            # run the table is crowded: a large creature's body can stand between the camera and a small pawn)
            b_id = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()); for (const t of {TOKENS}) {{ if (t.id === '{A1}' || (t.size || 1) > 1) continue; const p = tw.screenOf(t.x, t.z, tw.main, (t.y || 0) + 1.2); if (p.y < 120 || p.y > 860 || p.x < 380 || p.x > 1380) continue; if (w.pick(tw.rayAt(p.x, p.y))?.entity?.id === t.id) return t.id; }} return null; }})()""")
            b_was = await gm.evaluate(f"{ENT(b_id)}.fig || null")
            await gm.evaluate(f"tw.select(['{A1}'])"); await gm.wait_for_timeout(150)
            want_fig = await gm.evaluate("tw.figures.search('dire wolf')[0].fig.id")
            be = await gm.evaluate(ENT(b_id)); tgt = await scr(gm, be['x'], be['z'], (be.get('y') or 0) + 1.2)
            await bar(gm, 'change figure dire wolf'); src = await gm.evaluate(ROWC)
            await gm.mouse.move(src['x'], src['y']); await gm.mouse.down()
            for i in range(1, 11): await gm.mouse.move(src['x'] + (tgt['x'] - src['x']) * i / 10, src['y'] + (tgt['y'] - src['y']) * i / 10); await gm.wait_for_timeout(16)
            await gm.wait_for_timeout(150)
            mid = await gm.evaluate("({ chip: (() => { const c = document.querySelector('#dragFig'), i = c?.querySelector('img'), r = c?.getBoundingClientRect(); return !!i && i.complete && i.naturalWidth > 0 && r.width > 40 && r.left > 0 && r.top > 0 && getComputedStyle(c).visibility === 'visible'; })(), hover: tw.hover, label: document.getElementById('modeLabel').textContent, mode: !!tw.mode, under: (() => { const el = document.elementFromPoint(%d, %d); return el ? (el.id || el.className || el.tagName) : null; })(), pick: tw.worldOf(tw.area()).pick(tw.rayAt(%d, %d))?.entity?.id || null })" % (tgt['x'], tgt['y'], tgt['x'], tgt['y']))
            if A.shots: await gm.screenshot(path=os.path.join(A.shots, 'drag-out-change-figure.png'))
            await gm.mouse.up(); await gm.wait_for_timeout(450)
            await acknowledged(gm, 'change figure drop')
            a_fig = await gm.evaluate(f"{ENT(A1)}.fig"); b_fig = await gm.evaluate(f"{ENT(b_id)}.fig")
            check(mid['chip'] and mid['hover'] == b_id and not mid['mode'] and '→' in mid['label'], 'a "change figure" row dragged over a pawn: its picture is in hand and the pawn under it lights up', mid)
            check(b_fig == want_fig and b_was != want_fig and a_fig == 'foe-goblin-bow' and not await gm.evaluate("!!document.querySelector('#dragFig')"), 'let go ON a pawn: THAT pawn wears the figure (not the selected one)', [a_fig, b_fig])
            await gm.evaluate('tw.undo()'); await gm.wait_for_timeout(300)
            await acknowledged(gm, 'change figure undo')
            await gm.evaluate(f"tw.select(['{A1}'])"); await bar(gm, 'change figure dire wolf'); src = await gm.evaluate(ROWC); seq = await gm.evaluate('tw.seq()')
            # Start the real drag before looking for its destination: the results cover the room until the
            # drag crosses the threshold. Looking through that still-open list found no canvas point at all.
            await gm.mouse.move(src['x'], src['y']); await gm.mouse.down(); await gm.mouse.move(src['x'] + 16, src['y'] + 16, steps=3)
            await gm.wait_for_function("!!document.querySelector('#dragFig') && getComputedStyle(document.querySelector('#results')).visibility === 'hidden'")
            e = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()); for (let z = 27.5; z > 2; z -= 5) for (let x = 37.5; x > 2; x -= 5) { const p = tw.screenOf(x, z, tw.main, 0); if (p.y < 150 || document.elementFromPoint(p.x, p.y)?.id !== 'c') continue; if (w.pick(tw.rayAt(p.x, p.y))?.entity?.kind !== 'token') return p; } return null; })()")
            assert e, 'change-figure cancellation fixture needs a visible floor point without a pawn'
            await gm.mouse.move(e['x'], e['y'], steps=8); await gm.wait_for_timeout(100); await gm.mouse.up(); await gm.wait_for_timeout(300)
            L = await gm.evaluate(LIST)
            check(await gm.evaluate('tw.seq()') == seq and L['vis'] == 'visible' and L['open'], 'let go on the bare floor: nothing changes, the list is back', L)
            await gm.keyboard.press('Escape'); await gm.evaluate('tw.clearSelection()'); await gm.wait_for_timeout(150)
            # touch: a finger on the row, dragged onto the map
            ids5 = {t['id'] for t in await gm.evaluate(TOKENS)}
            await bar(gm, 'goblin bow'); src = await gm.evaluate(ROWC); dst = await scr(gm, 7.5, 22.5)
            ta = await gm.evaluate("getComputedStyle(document.querySelector('#results .res.drags')).touchAction")
            cdp = await gm.context.new_cdp_session(gm)
            pt = lambda x, y: [{'x': round(x), 'y': round(y), 'id': 1}]
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': pt(src['x'], src['y'])})
            for i in range(1, 11): await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': pt(src['x'] + (dst['x'] - src['x']) * i / 10, src['y'] + (dst['y'] - src['y']) * i / 10)}); await gm.wait_for_timeout(20)
            await gm.wait_for_timeout(120); tm = await gm.evaluate(MID)
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); await gm.wait_for_timeout(450)
            new = new_of(await gm.evaluate(TOKENS), ids5)
            check(ta == 'none' and tm['via'] and tm['cells'] == 1 and len(new) == 1 and new[0]['x'] == 7.5 and new[0]['z'] == 22.5, 'by touch: a finger on the row, dragged onto the map and lifted, places it on that square (the row does not scroll the list)', [ta, tm['via'], [(t['x'], t['z']) for t in new]])
            await cdp.detach()
            await gm.evaluate(f"tw.batch({TOKENS}.filter(t => !{json.dumps(sorted(ids0))}.includes(t.id)).map(t => ({{ type: 'token.delete', args: {{ id: t.id }} }})))"); await gm.wait_for_timeout(400)
            await gm.evaluate("tw.clearSelection(); if (document.querySelector('#bar').classList.contains('open')) tw.bar?.close?.()"); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)

        if on('PAWN'):
            print('PAWN')
            gid = ids['goblin']; await gm.keyboard.press('Escape'); await gm.evaluate("tw.modes.cancel(); tw.clearSelection()"); await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{gid}', x: 12.5, z: 12.5, rot: 0 }})"); await gm.wait_for_timeout(400)
            p = await scr(gm, 12.5, 12.5, 1.8); await gm.mouse.move(p['x'], p['y']); await gm.wait_for_timeout(200)
            check(await gm.evaluate('tw.hover') == gid, 'hover: the pointer over the figure finds the pawn', str(await gm.evaluate('tw.hover')))
            await gm.mouse.click(p['x'], p['y']); await gm.wait_for_timeout(350)
            check(await gm.evaluate(f"tw.sel.has('{gid}') && tw.sel.size === 1"), 'a click on the figure selects the pawn')
            pb = await scr(gm, 12.5 + 1.9, 12.5, 0.2); await gm.evaluate("tw.clearSelection()"); await gm.mouse.click(pb['x'], pb['y']); await gm.wait_for_timeout(350)
            check(await gm.evaluate(f"tw.sel.has('{gid}')"), 'a click on its base selects it too')
            ring = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn')].map(b => b.dataset.cmd || 'menu')")
            check('edit.rotate' in ring and 'menu' in ring and 'edit.resize' not in ring, "it has a pawn's ring (turn, label, ☰; no size handle)", str(ring))
            sig = await gm.evaluate(f"tw.signals().filter(s => s.id === '{gid}').length"); check(sig >= 1, 'the selection look is drawn round the figure pawn', f'{sig} signal')
            rb = await gm.evaluate("(() => { const b = [...document.querySelectorAll('#ring .rbtn')].map(x => x.getBoundingClientRect()); return { top: Math.min(...b.map(r => r.top)), bottom: Math.max(...b.map(r => r.bottom)) }; })()")
            head = await scr(gm, 12.5, 12.5, 4.3); check(rb['bottom'] <= head['y'] + 30, "the ring sits above the figure's head, not on it", f"ring bottom {rb['bottom']:.0f}px, head {head['y']:.0f}px")
            await gm.evaluate("tw.clearSelection()"); await gm.wait_for_timeout(150)
            a = await scr(gm, 12.5, 12.5, 1.8); b = await scr(gm, 21.1, 16.3); await drag(gm, a, b); await gm.wait_for_timeout(500); e = await gm.evaluate(ENT(gid))
            check(e['x'] == 22.5 and e['z'] == 17.5, 'dragged by the figure, it snaps to the centre of the square under the pointer', f"({e['x']}, {e['z']})")
            await gm.evaluate("tw.clearSelection()"); await gm.wait_for_timeout(150)
            a = await scr(gm, 22.5, 17.5, 1.8); b = await scr(gm, 26.3, 18.9); await drag(gm, a, b, mods=('Shift',)); await gm.wait_for_timeout(500); e = await gm.evaluate(ENT(gid))
            check(e['x'] % 5 != 2.5 and abs(e['x'] - 26.3) < 1.2, 'Shift moves it freely', f"({e['x']}, {e['z']})")
            await gm.evaluate(f"tw.select('{gid}')"); await gm.keyboard.press('r'); await gm.wait_for_timeout(300); M = await gm.evaluate(FIG(gid)); check(abs(M['facing_deg'] - 45) < 0.5, 'R turns it 45 degrees', str(M['facing_deg']))
            await gm.keyboard.press('ArrowRight'); await gm.wait_for_timeout(250); e2 = await gm.evaluate(ENT(gid))
            await gm.keyboard.press('Shift+ArrowRight'); await gm.wait_for_timeout(250); e3 = await gm.evaluate(ENT(gid))
            check(abs(e2['x'] - e['x'] - 5) < 0.01 and abs(e3['x'] - e2['x'] - 1) < 0.01, 'arrow keys nudge it: an arrow one square (5 ft), Shift+arrow the fine 1 ft (Harry 2026-10-15)', f"{e['x']} -> {e2['x']} -> {e3['x']}")
            e = e3
            # label, damage (it was HP until the pawn ring landed the same day: a pawn counts damage up from 0), conditions
            await gm.evaluate(f"tw.select('{gid}')"); await bar(gm, '+3', enter=True); await gm.wait_for_timeout(300)
            await bar(gm, 'poisoned', enter=True); await gm.wait_for_timeout(300); e = await gm.evaluate(ENT(gid))
            lab = await gm.evaluate(f"(() => {{ const r = tw.worldOf(tw.area()).recs.get('{gid}'); return {{ key: r.labelKey, y: r.label.position.y }}; }})()")
            check(e.get('damage') == 3 and e['conditions'] == ['poisoned'] and '3 dmg' in lab['key'] and 'poisoned' in lab['key'], 'damage and conditions work on it and show in its label', lab['key'])
            KF = await gm.evaluate('tw.figures.scale()'); check(0.3 + 4.25 * KF + 0.5 < lab['y'] < 0.3 + 4.25 * KF + 1.7, "the label floats over the figure's head (its spear tip is at 4.3 ft, times the figure scale)", f"{lab['y']:.2f} ft at scale {KF}")
            await bar(gm, 'clear all conditions', enter=True); await gm.wait_for_timeout(300); e = await gm.evaluate(ENT(gid)); check(e['conditions'] == [], '"clear all conditions"', str(e['conditions']))
            # stairs and height
            # (2026-10-11: a room drawn by hand gets no stair; ask for the planner's, the room laid again round it)
            await gm.evaluate("tw.takeStairOffer('%s', { any: true }) || tw.addStair(tw.entities()['%s'])" % (R['up'], R['up'])); await gm.wait_for_timeout(800)
            stair = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'object' && tw.ST.isConnector(e))")
            if stair:
                foot = await gm.evaluate(f"tw.ST.stairEnds(tw.entities()['{stair['id']}'], tw.entities()).foot")  # the square before its low end
                await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{gid}', x: {foot['x']}, z: {foot['z']}, rot: 0 }})"); await gm.wait_for_timeout(300)
                e0 = await gm.evaluate(ENT(gid)); await gm.evaluate(f"tw.moveBy([{ENT(gid)}], {stair['x']} - {e0['x']}, {stair['z']} - {e0['z']})"); await gm.wait_for_timeout(500); e = await gm.evaluate(ENT(gid))
                await gm.evaluate("tw.cutOff('test')"); await gm.wait_for_timeout(500); M = await gm.evaluate(FIG(gid))
                check(e.get('y') == 10 and abs(M['disc_top_ft'] - 10.3) < 0.01 and abs(M['feet_above_disc_ft']) <= 0.002, 'moved onto the stair, it goes to the top: its base on the upper floor, the figure on its base', f"y {e.get('y')}, disc top {M['disc_top_ft']} ft, feet {M['feet_above_disc_ft']}")
                await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{gid}', x: 12.5, z: 12.5, y: 0 }})"); await gm.evaluate("tw.cutToRoom(tw.entities()['%s'], 'test')" % R['common']); await gm.wait_for_timeout(500)
            else: check(False, 'the upper room came with a stair (needed for the stair check)')
            await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{gid}', x: 12.5, z: 12.5, y: 6 }})"); await gm.wait_for_timeout(500)
            hl = await gm.evaluate(f"tw.worldOf(tw.area()).heightLabels().filter(h => h.id === '{gid}')"); M = await gm.evaluate(FIG(gid))
            check(hl and hl[0]['text'] == '6 ft' and abs(M['disc_top_ft'] - 6.3) < 0.01, 'raised 6 ft it flies: drop line and height label, as a stand-in pawn gets', str(hl))
            await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{gid}', x: 12.5, z: 12.5, y: 0 }})"); await gm.wait_for_timeout(300)
            # hide
            if 'pl' in dir():
                await gm.evaluate(f"tw.setHidden([{ENT(gid)}], true)"); await gm.wait_for_timeout(700)
                ghost = await gm.evaluate(f"(() => {{ const r = tw.worldOf(tw.area()).recs.get('{gid}'); let n = 0, t = 0; r.visual.traverse(o => {{ if (o.isMesh) {{ n++; if (o.material.transparent && o.material.opacity < 0.6) t++; }} }}); return {{ n, t, pill: r.labelKey }}; }})()")
                await wait(gm, f"{FIG(gid)}?.loaded", 15000); ghost = await gm.evaluate(f"(() => {{ const r = tw.worldOf(tw.area()).recs.get('{gid}'); let n = 0, t = 0; r.visual.traverse(o => {{ if (o.isMesh) {{ n++; if (o.material.transparent && o.material.opacity < 0.6) t++; }} }}); return {{ n, t, pill: r.labelKey }}; }})()")
                gone = await pl.evaluate(f"!tw.entities()['{gid}'] && !tw.worldOf(tw.area()).recs.has('{gid}')")
                check(gone and ghost['t'] == ghost['n'] and 'true' in ghost['pill'], 'hidden from players: the player has no trace of it; the GM sees it see-through, marked Hidden', f"{ghost['t']} of {ghost['n']} meshes see-through")
                await gm.evaluate(f"tw.setHidden([{ENT(gid)}], false)"); await gm.wait_for_timeout(700)
                check(await pl.evaluate(f"tw.entities()['{gid}']?.fig") == 'foe-goblin-spear', 'revealed: the player has the figure again')
            # copy / paste keeps the figure
            await gm.evaluate(f"tw.select('{gid}')"); n0 = await gm.evaluate(f"{TOKENS}.length"); await gm.evaluate("tw.duplicate()"); await gm.wait_for_timeout(500)
            dup = [t for t in await gm.evaluate(TOKENS) if t.get('fig') == 'foe-goblin-spear' and t['id'] != gid and abs(t['x'] - 15) < 0.1]
            check(await gm.evaluate(f"{TOKENS}.length") == n0 + 1 and dup, 'duplicate keeps the figure', str(dup[:1])[:120])
            # delete
            await gm.evaluate(f"tw.select('{dup[0]['id']}')" if dup else "0"); await gm.keyboard.press('Delete'); await gm.wait_for_timeout(400)
            check(await gm.evaluate(f"{TOKENS}.length") == n0, 'Delete removes it')
            # the campaign reloads with its figures (saved state)
            await gm.reload(); check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'reload'); await wait(gm, f"{FIG(gid)}?.loaded", 25000, 'figure after reload')
            M = await gm.evaluate(FIG(gid)); check(M and M['fig'] == 'foe-goblin-spear' and abs(M['feet_above_disc_ft']) <= 0.002, 'after a reload the pawn still wears its figure', str(M and M['fig']))
            await view(gm, 20, 15, 80, 62)

        if on('NAME'):
            print('NAME')
            await gm.keyboard.press('Escape'); await gm.evaluate("tw.modes.cancel(); tw.clearSelection(); tw.figures.setName({ ...tw.figures.nameDefaults }, { save: false })")
            await gm.evaluate("tw.batch([{ type: 'token.create', args: { id: 'tok_name000001', name: 'Grishnak', x: 32.5, z: 12.5, fig: 'foe-goblin-spear' } }, { type: 'token.create', args: { id: 'tok_name000002', name: 'Old Tom', x: 37.5, z: 12.5 } }])"); await gm.wait_for_timeout(600)
            LAB = lambda i: f"(() => {{ const r = tw.worldOf(tw.area()).recs.get('{i}'); return {{ label: !!r.label, key: r.labelKey }}; }})()"
            M = await gm.evaluate(FIG('tok_name000001')); L = await gm.evaluate(LAB('tok_name000001'))
            check(M['name'] and M['name']['text'] == 'Grishnak' and M['name']['shown'] == 'Grishnak' and not L['label'], "a figure pawn's name is lettered on its base, and nothing floats over it", f"{M['name']} · floating label: {L['label']}")
            L2 = await gm.evaluate(LAB('tok_name000002')); check(L2['label'] and L2['key'].startswith('Old Tom'), 'a plain pawn keeps its floating label', L2['key'])
            await gm.evaluate("tw.batch([{ type: 'token.damage', args: { id: 'tok_name000001', damage: 5 } }, { type: 'token.set', args: { id: 'tok_name000001', conditions: ['prone'] } }])"); await gm.wait_for_timeout(300); L = await gm.evaluate(LAB('tok_name000001'))
            check(L['label'] and L['key'].startswith('5 dmg|prone') and 'Grishnak' not in L['key'], 'damage and conditions still float (without the name: it is on the base)', L['key'])
            want = await gm.evaluate("(() => { const c = tw.main.camera.position; return Math.atan2(c.x - 32.5, c.z - 12.5) * 180 / Math.PI; })()")
            check(abs(((M['name']['at_deg'] - want + 180) % 360) - 180) < 2, 'the lettering sits on the side of the base nearest the camera', f"at {M['name']['at_deg']} deg, camera at {want:.1f}")
            ltr = await gm.evaluate(f"(() => {{ const m = {FIG('tok_name000001')}.name.ends.map(p => tw.screenOf(p[0], p[2], tw.main, p[1])); return [m[0].x, m[1].x, m[0].y, m[1].y]; }})()")
            check(ltr[0] < ltr[1] - 10, 'it reads left to right on the screen (the line starts at the left end of the arc: not mirrored)', f"starts at x {ltr[0]:.0f} px, ends at x {ltr[1]:.0f} px")
            await view(gm, 20, 15, 80, 62, 90); await gm.wait_for_timeout(200); M2 = await gm.evaluate(FIG('tok_name000001')); want2 = await gm.evaluate("(() => { const c = tw.main.camera.position; return Math.atan2(c.x - 32.5, c.z - 12.5) * 180 / Math.PI; })()")
            check(abs(((M2['name']['at_deg'] - want2 + 180) % 360) - 180) < 2 and abs(want2 - want) > 45, 'turn the view a quarter turn: the lettering slides round to stay toward the camera', f"{M['name']['at_deg']} -> {M2['name']['at_deg']} deg")
            await view(gm, 20, 15, 80, 62)
            await gm.evaluate("tw.dispatch('token.move', { id: 'tok_name000001', x: 32.5, z: 12.5, rot: 2.0 })"); await gm.wait_for_timeout(300); M3 = await gm.evaluate(FIG('tok_name000001'))
            check(abs(((M3['name']['at_deg'] + 2.0 * 180 / 3.14159265 - want + 180) % 360) - 180) < 2, 'turn the pawn: the lettering stays toward the camera (the facing mark turns, the name does not)', f"{M3['name']['at_deg']} deg relative to the base")
            await gm.evaluate("tw.figures.setName({ faceCamera: false }, { save: false })"); await gm.wait_for_timeout(300); M4 = await gm.evaluate(FIG('tok_name000001'))
            check(abs(M4['name']['at_deg'] - 180) < 0.5, 'with "stay toward the camera" off it is fixed at the back of the base and turns with the pawn', str(M4['name']['at_deg']))
            await gm.evaluate("tw.figures.setName({ faceCamera: true }, { save: false })")
            await gm.evaluate("tw.dispatch('token.set', { id: 'tok_name000001', name: 'Bartholomew Quillfeather the Unreasonably Long-Named' })"); await gm.wait_for_timeout(400); M5 = await gm.evaluate(FIG('tok_name000001'))
            check(M5['name']['shown'].endswith('…') and len(M5['name']['shown']) < 40 and M5['name']['arc_deg'] <= 211, 'a long name is squeezed, then cut with an ellipsis: it never wraps right round', f"\"{M5['name']['shown']}\" over {M5['name']['arc_deg']} deg")
            await gm.evaluate("tw.dispatch('token.set', { id: 'tok_name000001', name: 'Grishnak' })"); await gm.wait_for_timeout(300)
            rows = await bar(gm, 'pawn names'); check(any('Pawn names: float' in r.get('title', '') for r in rows), '"pawn names" in the bar offers the floating label', str([r.get('title') for r in rows][:3]))
            await gm.keyboard.press('Escape'); await gm.evaluate("tw.registry.run('view.pawnNames')"); await gm.wait_for_timeout(300); M6 = await gm.evaluate(FIG('tok_name000001')); L = await gm.evaluate(LAB('tok_name000001'))
            check(M6['name'] is None and L['label'] and L['key'].startswith('Grishnak'), 'switched off, the name floats over the figure as before', L['key'])
            await gm.evaluate("tw.registry.run('view.pawnNames')"); await gm.wait_for_timeout(300); M7 = await gm.evaluate(FIG('tok_name000001')); check(M7['name'] and M7['name']['shown'] == 'Grishnak', 'and back on the base')
            await gm.evaluate("tw.figures.setName({ height: 0.9, where: 'side', color: '#ffcc00' }, { save: false })"); await gm.wait_for_timeout(300); M8 = await gm.evaluate(FIG('tok_name000001')); P = await gm.evaluate('tw.figures.name()')
            check(M8['name'] and P['where'] == 'side' and P['height'] == 0.9 and set(P.keys()) >= {'on', 'where', 'faceCamera', 'at', 'height', 'arc', 'color', 'minScale', 'font', 'plate'}, 'every choice is a parameter in one place: changing some reletters the pawns at once', str(sorted(P.keys())))
            await gm.evaluate("tw.figures.setName({ ...tw.figures.nameDefaults }, { save: false }); tw.batch(['tok_name000001', 'tok_name000002'].map(id => ({ type: 'token.delete', args: { id } })))"); await gm.wait_for_timeout(300)

        if on('MAIN'):
            print('MAIN')
            await gm.keyboard.press('Escape'); await gm.evaluate("tw.modes.cancel(); tw.clearSelection()")
            if 'pl' not in dir():
                await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter'); await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
                invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape'); pl = await tab(invite + '&nofx&nointro', reduced_motion='reduce'); await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000); PL = await pl.evaluate('tw.me()')
            HERO = 'hero-fighter-human-m'
            await gm.evaluate(f"tw.batch([{{ type: 'token.create', args: {{ id: 'tok_main000001', name: 'Brakka', x: 32.5, z: 22.5, fig: '{HERO}', owner: '{PL}' }} }}, {{ type: 'token.create', args: {{ id: 'tok_main000002', name: 'Brakka alt', x: 37.5, z: 22.5, fig: '{HERO}', owner: '{PL}' }} }}, {{ type: 'token.create', args: {{ id: 'tok_main000003', name: 'Guard', x: 37.5, z: 17.5, fig: '{HERO}' }} }}])")
            await wait(gm, f"{FIG('tok_main000001')}?.loaded && {FIG('tok_main000002')}?.loaded", 25000, 'hero meshes'); n_full0 = len([u for u in fetched['glb'] if u.startswith('full/')])
            A0 = await gm.evaluate(FIG('tok_main000001'))
            check(A0['detail'] == 'hero' and 15000 <= A0['drawn_tris'] <= 21000 and n_full0 == 0, 'a pawn that is not a main pawn wears its normal tier (a hero: about 20k); no original has been fetched', f"{A0['drawn_tris']} triangles drawn")
            await pl.evaluate("tw.cutToRoom(tw.entities()['%s'], 'test')" % R['common']); await pl.evaluate("tw.select('tok_main000001')"); await pl.wait_for_timeout(200)
            rows = await bar(pl, 'main pawn'); check(any(r.get('title', '').startswith('Make this my main pawn') for r in rows), 'the player finds "Make this my main pawn" for her own pawn', str([r.get('title') for r in rows][:3]))
            await pl.keyboard.press('Enter'); await gm.wait_for_timeout(500); e = await gm.evaluate(ENT('tok_main000001'))
            check(e.get('main') is True, 'it is stored on the pawn', str(e.get('main')))
            first = await gm.evaluate(FIG('tok_main000001'))
            check(first and first['loaded'], 'the game tier is on the table at once: a main pawn never waits for the big file to appear', f"{first and first['detail']} · {first and first['drawn_tris']} triangles while the original loads")
            await wait(gm, f"{FIG('tok_main000001')}?.swapped", 40000, 'the original swapped in'); A1 = await gm.evaluate(FIG('tok_main000001')); fl = await gm.evaluate(f"tw.figures.get('{HERO}')")
            check(A1['detail'] == 'full' and A1['drawn_tris'] > 40000 and any(u.startswith(f'full/{HERO}-') for u in fetched['glb']), 'then the ORIGINAL mesh is swapped in (about 50k triangles)', f"{A1['drawn_tris']} triangles; file {fl['full_kb']} KB against {fl['kb']} KB")
            B = A1['before']
            check(abs(A1['feet_above_disc_ft']) <= 0.002 and abs(B['feet_above_disc_ft']) <= 0.002 and abs(A1['height_ft'] - B['height_ft']) <= 0.03 and abs(A1['mid'][0] - B['mid'][0]) <= 0.03 and abs(A1['mid'][1] - B['mid'][1]) <= 0.03, 'nothing jumps at the swap: still on its disc, the same height, the same place (measured before and after)', f"height {B['height_ft']} -> {A1['height_ft']} ft; middle {B['mid']} -> {A1['mid']}; feet {B['feet_above_disc_ft']} -> {A1['feet_above_disc_ft']}")
            G = await gm.evaluate(FIG('tok_main000003')); check(G['detail'] == 'hero' and G['drawn_tris'] < 21000, 'the same figure placed as anything else keeps its 20k tier', f"{G['drawn_tris']} triangles")
            await wait(pl, f"{FIG('tok_main000001')}?.swapped", 40000, 'swapped on the player tab'); check((await pl.evaluate(FIG('tok_main000001')))['detail'] == 'full', 'every seat sees the main pawn at full detail')
            seq0 = await gm.evaluate('tw.seq()'); await gm.evaluate("tw.select('tok_main000002')"); await bar(gm, 'main pawn', enter=True); await gm.wait_for_timeout(700)
            e1 = await gm.evaluate(ENT('tok_main000001')); e2 = await gm.evaluate(ENT('tok_main000002'))
            check(e2.get('main') is True and 'main' not in e1 and await gm.evaluate('tw.seq()') == seq0 + 1, "the GM marks her other pawn: it is the main pawn now and the first is not (one per player, one command)", f"first main: {e1.get('main')}, second main: {e2.get('main')}")
            await wait(gm, f"{FIG('tok_main000001')}?.loaded && !{FIG('tok_main000001')}.swapped", 15000); check((await gm.evaluate(FIG('tok_main000001')))['detail'] == 'hero', 'the first goes back to its 20k tier')
            await gm.evaluate("tw.undo()"); await gm.wait_for_timeout(600); e1 = await gm.evaluate(ENT('tok_main000001')); e2 = await gm.evaluate(ENT('tok_main000002'))
            check(e1.get('main') is True and 'main' not in e2, 'one undo puts both back')
            await gm.evaluate("tw.select('tok_main000003')"); await pl.evaluate("tw.select('tok_main000003')"); rows = await bar(pl, 'main pawn'); await pl.keyboard.press('Escape')
            check(not any('main pawn' in r.get('title', '') for r in rows), "the player is not offered it for a pawn that is not hers", str([r.get('title') for r in rows][:2]))
            await gm.evaluate("tw.select('tok_main000001')"); n0 = await gm.evaluate(f"{TOKENS}.length"); await gm.evaluate("tw.duplicate()"); await gm.wait_for_timeout(500)
            dup = [t for t in await gm.evaluate(TOKENS) if t['name'] == 'Brakka' and t['id'] != 'tok_main000001']
            check(dup and 'main' not in dup[0], 'a copy of a main pawn is not a main pawn', str(dup[:1])[:100])
            await gm.evaluate(f"tw.batch({TOKENS}.filter(t => t.id.startsWith('tok_main') || t.name === 'Brakka').map(t => ({{ type: 'token.delete', args: {{ id: t.id }} }})))"); await gm.wait_for_timeout(300); await gm.evaluate("tw.clearSelection()")

        if on('AI'):
            print('AI')
            tokn = await gm.evaluate("tw.createSeat({ kind: 'llm', name: 'Assistant', color: '#b48cff', scope: { areas: '*', classes: ['token.move', 'token.edit', 'pawn', 'chat'] } })")
            base = f'http://127.0.0.1:{RP}' if A.local else await gm.evaluate('tw.relayBase.startsWith("http") ? tw.relayBase : location.origin + tw.relayBase')
            c = f'{base}/c/{CID}'
            st, r = get(f'{c}/figures?q=owlbear&seat={tokn}'); check(st == 200 and r.get('figures') and r['figures'][0]['id'] == 'foe-owlbear' and r['figures'][0]['squares'] == 2, 'GET figures?q=owlbear finds the id, and says it covers 2 squares a side', str(r.get('figures', r))[:160])
            st, r = get(f'{c}/figures?q=elf+wizard&seat={tokn}'); check(st == 200 and len(r.get('figures', [])) == 2 and all(f['id'].startswith('hero-wizard-elf') for f in r['figures']), 'GET figures?q=elf+wizard', str([f['id'] for f in r.get('figures', [])]))
            st, r = get(f'{c}/figures?seat={tokn}'); check(st == 200 and r.get('total') == N and r.get('groups', {}).get('hero', 0) > 100, 'GET figures (no q) says how many there are, by group', str(r.get('groups')))
            st, r = get(f'{c}/a/{AREA}/do?cmd=token.create&fig=foe-owlbear&x=10&z=25&nonce=ai-fig-1&seat={tokn}')
            check(st == 200 and r.get('ok') and r.get('id'), 'GET do?cmd=token.create&fig=foe-owlbear places one', str(r)[:160])
            aid = r.get('id'); await wait(gm, f"!!tw.entities()['{aid}']", 8000); e = await gm.evaluate(ENT(aid)) if aid else None
            check(e and e['fig'] == 'foe-owlbear' and e.get('size') == 2 and e['name'] == 'Owlbear', 'it arrives as a pawn wearing the owlbear, its size and name filled in from the list', str(e and {k: e.get(k) for k in ('name', 'fig', 'size', 'x', 'z')}))
            await wait(gm, f"{FIG(aid)}?.loaded", 20000); M = await gm.evaluate(FIG(aid)); check(M and M.get('feet_above_disc_ft') is not None and abs(M['feet_above_disc_ft']) <= 0.002 and M['size'] == 2, 'and is drawn on its 9-ft base in the browser', str(M and M['base_width_ft']))
            st, r2 = get(f'{c}/a/{AREA}/do?cmd=token.create&fig=foe-owlbear&x=10&z=25&nonce=ai-fig-1&seat={tokn}')
            check(r2.get('id') == aid and len([t for t in await gm.evaluate(TOKENS) if t['id'] == aid]) == 1, 'the same nonce again does not place a second one', str(r2)[:120])
            st, r = get(f'{c}/a/{AREA}/do?cmd=token.create&fig=owl-bear&x=10&z=25&nonce=ai-fig-2&seat={tokn}')
            check(not r.get('ok') and 'no figure' in r.get('why', '') and 'figures?q=' in r.get('why', ''), 'a figure id that does not exist is refused, with how to search', r.get('why', '')[:160])
            st, r = get(f'{c}/a/{AREA}/do?cmd=token.set&id={aid}&fig=foe-goblin-spear&nonce=ai-fig-3&seat={tokn}'); await gm.wait_for_timeout(500); e = await gm.evaluate(ENT(aid))
            check(r.get('ok') and e['fig'] == 'foe-goblin-spear' and 'size' not in e, 'token.set&fig= changes the figure (and its size)', str(r)[:100])
            st, r = get(f'{c}/a/{AREA}/do?cmd=token.set&id={aid}&fig=none&nonce=ai-fig-4&seat={tokn}'); await gm.wait_for_timeout(500); e = await gm.evaluate(ENT(aid))
            check(r.get('ok') and 'fig' not in e, 'fig=none goes back to the plain pawn', str(r)[:100])
            st, s = get(f'{c}/a/{AREA}/state?seat={tokn}'); toks = s.get('tokens', [])
            wf = [t for t in toks if t.get('figure')]; check(st == 200 and wf and all('figure' in t for t in wf) and any(t.get('squares') == 2 for t in toks) == any(t.get('size') == 2 for t in await gm.evaluate(TOKENS)), '"state" lists each pawn\'s figure (and squares for a large one)', str([(t['name'], t.get('figure'), t.get('squares')) for t in toks][:5]))
            with urllib.request.urlopen(urllib.request.Request(f'{c}/card?seat={tokn}', headers=UA)) as rr: card = rr.read().decode()
            with urllib.request.urlopen(urllib.request.Request(f'{c}/help/pawns?seat={tokn}', headers=UA)) as rr: card += rr.read().decode()  # (2026-10-20: the detail is on the card's help pages)
            check('fig=FIGURE_ID' in card and '/figures?q=owlbear' in card, 'the rules card (and its pawns page) tells an AI seat how to place a figure and where to search')
            await gm.evaluate(f"tw.dispatch('token.delete', {{ id: '{aid}' }})"); await gm.wait_for_timeout(300)

        if on('AUDIT'):
            print('AUDIT')
            await gm.keyboard.press('Escape'); await gm.evaluate("tw.clearSelection()")
            # fixtures: something of every kind a command can apply to
            fx = await gm.evaluate("""(async (room) => {
              const E = () => tw.entities(), out = { room };
              const sz = tw.roomgen.sizeOf('crate'); await tw.dispatch('object.place', { id: 'obj_auditcrate1', name: 'crate', cat: 'crate', ...sz, x: 32, z: 12, room });
              const ch = tw.assets.catalog.find(c => tw.assets.openable(c.id) && !c.flat && /chest/.test(c.id)); const cs = tw.roomgen.sizeOf(ch.id, ch.sku); await tw.dispatch('object.place', { id: 'obj_auditchest1', name: ch.name, cat: ch.id, ...cs, x: 34, z: 16, room });
              const li = tw.assets.catalog.find(c => tw.assets.lightable(c.id) && !c.flat && c.place === 'floor'); if (li) { const ls = tw.roomgen.sizeOf(li.id, li.sku); await tw.dispatch('object.place', { id: 'obj_auditlight1', name: li.name, cat: li.id, ...ls, x: 36, z: 12, room }); }
              await tw.dispatch('token.create', { id: 'tok_auditpawn01', name: 'Audit', x: 32.5, z: 22.5, damage: 4, mark: 'star', fig: 'foe-goblin-spear' }); // (a mark, so the ring's Clear is offered)
              return { ...out, prop: 'obj_auditcrate1', chest: 'obj_auditchest1', light: li ? 'obj_auditlight1' : null, pawn: 'tok_auditpawn01', building: E()[room].building };
            })""", R['common'])
            await gm.wait_for_timeout(800)
            wall = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()); const s = [...w.shell.values()].find(s => s.spec.layer === 'walls' && s.group.userData.edgeKey && !/@/.test(s.group.userData.edgeKey)); return s ? 'wall:' + s.group.userData.edgeKey : null; })()")
            await gm.evaluate("tw.setRoofs(true, 'test'); tw.cutOff('test')"); await gm.wait_for_timeout(600)
            roof = await gm.evaluate(f"tw.roofItem ? (tw.roofItem('roof:{R['up']}') ? 'roof:{R['up']}' : null) : null")
            ctxs = [('nothing', None), ('prop', fx['prop']), ('chest', fx['chest']), ('light', fx['light']), ('pawn', fx['pawn']), ('room', fx['room']), ('upper room', R['up']), ('building', fx['building']), ('wall', wall), ('roof', roof)]
            # commands the harness leaves alone, and why
            NOT_RUN = {'edit.undo': 'run on purpose after each changing command', 'edit.redo': 'the same', 'view.bar': 'opens the bar the harness drives', 'edit.deselect': 'clears the fixture selection',
                       'help.intro': 'plays the intro over the table for 20 s', 'pref.reset': 'run once at the end',
                       'view.labelLab': 'reloads the page into the Label lab (?labellab=1)', 'view.ringLab': 'reloads the page into Ring Lab (?ringlab=1)'}
            # typed commands are run with what their own parser makes of a sample line
            SAMPLES = {'pawn.damageTyped': '+2', 'chat.say': 'say audit', 'chat.roll': 'roll d20', 'area.new': 'new area Audit annex', 'people.invite': 'invite Audit guest', 'level.goto': 'level 2', 'area.rename': 'rename area Audit hall', 'chat.assistant': None, 'measure.typed': 'circle 10', 'measure.keepRounds': 'keep 2'}
            STEP = """async ({ sel, done, notRun, samples, kind }) => {
              const R = tw.registry, sleep = (ms) => new Promise(r => setTimeout(r, ms)), barS = R.surfaces.find(s => s.name === 'bar');
              const tidy = () => { try { document.querySelector('#bar input').blur(); } catch {} if (barS?.isOpen()) barS.close(); if (tw.settings?.isOpen) tw.settings.close(); if (tw.mode) tw.modes.cancel(); tw.rulers?.cancel(); if (tw.build?.isOpen) tw.build.close(); if (tw.pawns?.isOpen) tw.pawns.close(); const o = document.querySelector('#output'); if (o && !o.hidden) o.hidden = true; document.querySelector('.ring-edit')?.blur?.();
                if (tw.visionViewer !== 'gm') tw.setVisionViewer('gm'); // view-as commands alter later fixtures; audit each command from the GM's same visible table
                if ((tw.level || 0) !== 0) tw.setLevel(0); if (tw.cut?.y != null) tw.cutOff('test'); if (!!tw.roofs !== (kind === 'roof')) tw.setRoofs(kind === 'roof', 'test'); }; // the view as each command should meet it
              tidy(); for (let i = 0; i < 60 && tw.sync.pendingCount() > 0; i++) await sleep(50);
              if (!sel) tw.clearSelection(); else tw.select(sel);
              if (sel && (tw.selected().length !== 1 || (kind && tw.selected()[0].kind !== kind))) return { lost: true, why: `selected ${JSON.stringify(tw.selected().map(e => e.kind))}` };
              const ctx = R.ctx(), avail = R.available(ctx), c = avail.find(c => !done.includes(c.id));
              if (!c) return { end: true, n: avail.length };
              const title = R.titleOf(c, ctx), out = { id: c.id, title, group: c.group, found: true, ran: true, err: null, seq: 0, sent: [], area: tw.area() };
              // RESOLVES: its own title, typed into the bar, finds it (stubs and typed-only commands are reached by their text)
              if (!c.stub && !(c.hidden && c.parse) && c.id !== 'view.bar') {
                tw.emit('bar.open'); const i = document.querySelector('#bar input'); i.value = title; i.dispatchEvent(new Event('input', { bubbles: true }));
                const titles = [...document.querySelectorAll('#results .res .t')].map(e => e.textContent); out.found = titles.includes(title); if (!out.found) out.got = titles.slice(0, 3);
                tidy(); if (!sel) tw.clearSelection(); else tw.select(sel);
              }
              // RUNS: with no error
              if (c.id in notRun || c.stub || !R.isEnabled(c, ctx)) { out.skipped = true; return out; }
              let args; if (c.parse && c.id in samples) { if (!samples[c.id]) { out.skipped = true; return out; } args = c.parse(samples[c.id], ctx); if (!args) { out.ran = false; out.err = `its parser refused "${samples[c.id]}"`; return out; } }
              const onErr = (ev) => { out.err = out.err || String(ev.reason?.message || ev.message || ev.reason || ev).slice(0, 240); }; addEventListener('error', onErr); addEventListener('unhandledrejection', onErr);
              const seq0 = tw.seq(); out.seq0 = seq0;
              const submit = tw.sync.submit, submitRaw = tw.sync.submitRaw;
              tw.sync.submit = function(type, args, area) { const cid = submit.call(this, type, args, area); if (cid) out.sent.push({ type, area }); return cid; };
              tw.sync.submitRaw = function(command) { const cid = submitRaw.call(this, command); if (cid) out.sent.push({ type: command.type, area: command.area }); return cid; };
              try { out.ran = R.run(c, args, R.ctx()); await sleep(70);
                for (let i = 0; i < 60 && tw.sync.pendingCount() > 0; i++) await sleep(50);
              } catch (e) { out.err = String(e?.stack || e).slice(0, 300); }
              finally { tw.sync.submit = submit; tw.sync.submitRaw = submitRaw; }
              removeEventListener('error', onErr); removeEventListener('unhandledrejection', onErr);
              out.seq = tw.seq() - seq0; tidy(); return out; }"""
            KIND = {'prop': 'object', 'chest': 'object', 'light': 'object', 'pawn': 'token', 'room': 'room', 'upper room': 'room', 'building': 'building', 'roof': 'roof'}
            total = 0; missing = []; broken = []; allc = set(); per = {}
            for cname, sel in ctxs:
                if cname != 'nothing' and not sel: check(False, f'audit fixture: a {cname}'); continue
                done = []; per[cname] = 0
                for _ in range(700):
                    r = await gm.evaluate(STEP, {'sel': sel, 'done': done, 'notRun': NOT_RUN, 'samples': SAMPLES, 'kind': KIND.get(cname)})
                    if r.get('lost'): check(False, f'audit: the {cname} stays selected', f"{r['why']} after {done[-3:]}"); break
                    if r.get('end'): break
                    done.append(r['id']); allc.add(r['id']); total += 1; per[cname] += 1
                    if not r['found']: missing.append(f"{r['id']} [{cname}]: \"{r['title']}\" -> {r.get('got')}")
                    if r['err'] or not r['ran']: broken.append(f"{r['id']} [{cname}]: {r['err'] or 'refused to run'}")
                    if r.get('sent'):   # an acknowledgement may arrive AFTER STEP returned; wait before deciding whether to undo
                        await wait(gm, "tw.sync.pendingCount() === 0", 8000)
                        committed = await gm.evaluate('tw.seq()') > r['seq0']
                        # The area sequence also advances for another seat's fog
                        # exploration. Reverse only this command's submissions;
                        # pressing a chat Undo offer must be restored with Redo.
                        own = [cmd for cmd in r['sent'] if cmd['type'] != 'fog.view' and (cmd['area'] == r['area'] or cmd['type'] in ('fog.reset', 'travel', 'transfer'))]
                        if committed:
                            for cmd in reversed(own[-4:]):
                                await gm.evaluate('tw.redo()' if cmd['type'] == 'undo' else 'tw.undo()')
                                await gm.wait_for_timeout(120); await wait(gm, "tw.sync.pendingCount() === 0", 8000)
                print(f'    audited {cname}: {per[cname]} command/selection pairs', flush=True)
            # commands that only exist in a state the walk never rests in (a cut on, a tall room, a roof hidden …): set the state, then the same two checks
            SPECIAL = [('cut.off', None, "tw.goLevel(0, 'test')"), ('level.ground', None, "tw.setLevel(10)"), ('view.pipSwap', None, "tw.openPip(tw.area())"),
                       ('room.walls.auto', fx['room'], f"await tw.setRoom(tw.entities()['{fx['room']}'], 'wallFamily', 'fieldstone')"), ('room.floor.auto', fx['room'], f"await tw.setRoom(tw.entities()['{fx['room']}'], 'floor', 'floor-cobble')"),
                       ('room.height.shorter', R['up'], f"await tw.dispatch('room.tall', {{ id: '{R['up']}', tall: 2 }})"), ('room.roofShow', R['up'], f"await tw.dispatch('room.set', {{ id: '{R['up']}', roof: {{ off: true }} }})"),
                       ('roof.style.auto', roof, f"tw.setRoofs(true, 'test'); await tw.dispatch('room.set', {{ id: '{R['up']}', roof: {{ style: 'slate' }} }})"),
                       ('building.roof.auto', fx['building'], f"await tw.dispatch('building.set', {{ id: '{fx['building']}', roof: 'slate' }})"), ('pawn.cond.clear', fx['pawn'], f"await tw.dispatch('token.set', {{ id: '{fx['pawn']}', conditions: ['prone'] }})"),
                       ('stair.flip', 'obj_auditstair1', "await tw.dispatch('object.place', { id: 'obj_auditstair1', name: 'stair', cat: 'stair-straight', layer: 'furnish', ...tw.roomgen.sizeOf('stair-straight'), x: 12.5, y: 0, z: 10, rot: 0 })"),  # Stairs down / Stairs up: only with a stair selected
                       ('pawns.unfollow', None, f"tw.pawns.follow('{fx['pawn']}')"),
                       ('cast.saveGroup', [fx['pawn'], 'tok_audit00002'], f"await tw.dispatch('token.create', {{ id: 'tok_audit00002', name: 'Audit 2', x: {{...tw.entities()['{fx['pawn']}']}}.x + 5, z: tw.entities()['{fx['pawn']}'].z }})")]  # (the Pawns menu's follow: only while the view is locked to a pawn)
            # A generated roof may already use any catalog style. Reach each
            # registry command from a DIFFERENT style so a valid no-op filter
            # cannot leave a command unvisited by chance.
            for cid in await gm.evaluate("tw.registry.all().filter(c => c.id.startsWith('roof.style.') && c.id !== 'roof.style.auto').map(c => c.id)"):
                other = 'thatch' if cid == 'roof.style.slate' else 'slate'
                SPECIAL.append((cid, roof, f"tw.setRoofs(true, 'test'); await tw.dispatch('room.set', {{ id: '{R['up']}', roof: {{ style: '{other}' }} }})"))
            # State-dependent commands need real fixtures; don't waive new registry entries just because
            # the generic selection walk cannot reach a rolled object, a generated building or a kept shape.
            SPECIAL.append(('thing.upright', '$setup', """const id = 'obj_auditupright1';
              const size = tw.roomgen.sizeOf('crate');
              await tw.await(tw.dispatch('object.place', { id, name: 'upright audit crate', cat: 'crate', ...size, x: 42, z: 12 }));
              for (let i = 0; i < 100 && !tw.entities()[id]; i++) await new Promise(r => setTimeout(r, 50));
              if (!tw.entities()[id]) throw new Error('upright fixture crate was not placed');
              await tw.await(tw.dispatch('object.set', { id, quat: [0, 0, 0.70710678, 0.70710678] }));
              for (let i = 0; i < 100 && !tw.entities()[id]?.quat; i++) await new Promise(r => setTimeout(r, 50));
              if (!tw.entities()[id]?.quat) throw new Error('upright fixture did not receive its tilted orientation');
              return id;"""))
            generated = await gm.evaluate("tw.registry.all().filter(c => c.id.startsWith('building.storeys.') || c.id === 'building.reroll').map(c => c.id)")
            for cid in generated:
                target = int(cid.rsplit('.', 1)[1]) if cid.startswith('building.storeys.') else None
                setup = "const P = tw.buildingProgramme('TAV'); const opts = tw.registry.all().filter(c => c.id.startsWith('building.storeys.')).map(c => +c.id.split('.').at(-1)); const storeys = opts.find(n => n >= P.storeys.min && n <= P.storeys.max && n !== %s); return tw.buildAt(tw.buildingNode('inn'), 8, 6, { seed: 7741, storeys, outbuildings: false });" % json.dumps(target)
                SPECIAL.append((cid, '$setup', setup))
            ruler_commands = await gm.evaluate("tw.registry.all().filter(c => c.id.startsWith('measure.') || c.id.startsWith('template.')).map(c => c.id)")
            for cid in ruler_commands:
                setup = "tw.rulers.cancel(); tw.rulers.select(null);"
                if cid.startswith('template.'):
                    setup += "await tw.await(tw.dispatch('template.place', { id: 'tpl_audit00001', shape: 'circle', x: 32, z: 22, size: 10 })); tw.rulers.select('tpl_audit00001');"
                elif cid != 'measure.start' and not cid.startswith('measure.shape.'):
                    setup += "tw.rulers.start({ pawn: '%s' }, { x: 42, z: 22 }, 'circle');" % fx['pawn']
                SPECIAL.append((cid, None, setup))
            SPEC = """async ({ id, sel, setup, samples }) => { const R = tw.registry, sleep = (ms) => new Promise(r => setTimeout(r, ms)), settle = async () => { for (let i = 0; i < 80 && tw.sync.pendingCount() > 0; i++) await sleep(50); };
              tw.rulers.cancel(); tw.rulers.select(null); tw.clearSelection(); tw.setRoofs(false, 'test'); if ((tw.level || 0) !== 0) tw.setLevel(0); tw.cutOff('test'); await settle(); const seq0 = tw.seq();
              const made = await (new Function('tw', 'return (async () => { ' + setup + ' })()'))(tw); if (sel === '$setup') sel = made; await sleep(250); await settle(); if (sel) tw.select(sel); await sleep(80);
              const c = R.get(id), ctx = R.ctx(), ok = R.available(ctx).includes(c), title = ok ? R.titleOf(c, ctx) : null, out = { id, available: ok, title, found: false, ran: false, err: null,
                ...(!ok && id === 'thing.upright' && { fixture: { selected: ctx.sel.map(e => ({ id: e.id, place: e.place, quat: e.quat, tiltZ: e.tiltZ, locked: e.locked })), raw: tw.entities()[sel]?.quat || null, pending: tw.sync.pendingCount() } }) };
              if (ok) { tw.emit('bar.open'); const i = document.querySelector('#bar input'); i.value = c.hidden && c.parse ? samples[id] : title; i.dispatchEvent(new Event('input', { bubbles: true })); const expected = c.hidden && c.parse ? c.chips(c.parse(samples[id], ctx), ctx).join('') : title; out.found = [...document.querySelectorAll('#results .res .t')].map(e => e.textContent).includes(expected); R.surfaces.find(s => s.name === 'bar').close(); if (sel) tw.select(sel);
                try { const args = c.parse && samples[id] ? c.parse(samples[id], R.ctx()) : undefined; out.ran = R.run(c, args, R.ctx()); await sleep(120); } catch (e) { out.err = String(e?.stack || e).slice(0, 240); } }
              await settle(); out.seq = tw.seq() - seq0; if (tw.pip) tw.closePip(); return out; }"""
            for cid, sel, setup in SPECIAL:
                r = await gm.evaluate(SPEC, {'id': cid, 'sel': sel, 'setup': setup, 'samples': SAMPLES}); total += 1
                if r['available']: allc.add(cid)
                if not r['available'] or not r['found']: missing.append(f"{cid} [its own state]: {'not offered' if not r['available'] else 'not found by its title'}{': ' + str(r['fixture']) if r.get('fixture') else ''}")
                if r['available'] and (r['err'] or not r['ran']): broken.append(f"{cid} [its own state]: {r['err'] or 'refused to run'}")
                for _u in range(min(4, r.get('seq', 0))): await gm.evaluate("tw.undo()"); await gm.wait_for_timeout(120); await wait(gm, "tw.sync.pendingCount() === 0", 8000)
            n_all = await gm.evaluate("tw.registry.all().length"); never = await gm.evaluate("(seen) => tw.registry.all().filter(c => !seen.includes(c.id)).map(c => c.id)", sorted(allc))
            print(f"    {n_all} commands registered; whole-building types: {await gm.evaluate("tw.registry.all().filter(c => c.id.startsWith('build.type.')).map(c => c.short)")}")
            print(f"    commands by selection: {per}"); print(f"    never offered in this table ({len(never)}): {never}  (chat.act needs an offer in the chat: browser_chatline.py; wall.door is a stub)")
            FIGHT_ONLY = {'turn.end', 'turn.next', 'turn.prev', 'turn.typed', 'turn.rollPcs', 'turn.rollMonsters', 'turn.here', 'turn.up', 'turn.down', 'turn.remove', 'turn.show'}  # offered only while a fight is on: browser_turns.py runs them
            check(total > 400 and set(never) <= {'chat.act', 'wall.door'} | FIGHT_ONLY, 'the registry was walked for every kind of selection', f'{len(allc)} of {n_all} commands met, {total} command × selection pairs')
            check(not missing, 'every command is found in the bar by its own title wherever it applies', f'{total - len(missing)}/{total}' + (': ' + ' | '.join(missing) if missing else ''))
            check(not broken, 'every command runs without an error', f'{total - len(broken)}/{total}' + (': ' + ' | '.join(broken) if broken else ''))
            # what the walk left changed that undo does not reach (this area's play settings, a second area, the PiP): put back
            await gm.evaluate("(async () => { tw.sync.submit('area.set', { area: tw.area(), settings: { light: null, grid: null, freeMoves: null, touch: null } }); tw.setVisibility('open'); if (tw.pip) tw.closePip(); })()"); await gm.wait_for_timeout(500)
            await gm.evaluate("tw.settings.resetPrefs(); tw.clearSelection(); tw.cutOff('test')")
            # typed commands claim their text
            await gm.evaluate(f"tw.select('{fx['pawn']}')")
            for q, want in (('+3', 'damage'), ('-2', 'heal'), ('=5', 'set damage'), ('level 2', 'go to'), ('lv -1', 'go to'), ('roll 2d6+1', 'roll'), ('say hello there', 'say'), ('new area Cellar', 'new area'), ('rename area The Inn', 'rename area'), ('invite Bob', 'invite')):
                rows = await bar(gm, q); top = next((r for r in rows if 'title' in r), {})
                check(top.get('chips', [None])[0] == want, f'typed "{q}" is claimed as chips: {want} ▸ …', str(top.get('chips'))[:100])
            await gm.keyboard.press('Escape')
            for q, want in (('lighting night', 'Lighting here: night'), ('grid', 'the grid'), ('scroll wheel', 'Scroll wheel:'), ('graphics', 'Graphics quality:'), ('reduce motion', 'Reduce motion'), ('settings me', 'Settings: Me'), ('snapshots', 'Settings: Campaign admin'), ('rotate view', 'Turn the view'), ('pip', 'picture-in-picture'), ('whole building', 'Build a whole'), ('lock moves', "players' moves"), ('free moves', "players' moves"), ('fps', 'FPS meter'), ('roofs', 'Roofs o'), ('levels', 'evel'), ('ping', 'Ping here')):
                await gm.evaluate("tw.clearSelection()"); rows = await bar(gm, q); t = [r.get('title', '') for r in rows]
                check(any(want in x for x in t), f'"{q}" finds "{want}…"', str(t[:3]))
            await gm.keyboard.press('Escape')
            stale = [r.get('title') for r in await bar(gm, 'torchlight') if '(later)' in r.get('title', '')] + [r.get('title') for r in await bar(gm, 'dusk light') if '(later)' in r.get('title', '')]
            check(not stale, 'the stale "Dusk light (later)" and "Torchlight (later)" cue rows are gone (lighting is a real command now)', str(stale)); await gm.keyboard.press('Escape')
            await gm.evaluate("tw.batch(['obj_auditcrate1', 'obj_auditchest1', 'obj_auditlight1'].filter(i => tw.entities()[i]).map(id => ({ type: 'object.delete', args: { id } })).concat(tw.entities()['tok_auditpawn01'] ? [{ type: 'token.delete', args: { id: 'tok_auditpawn01' } }] : []))"); await gm.wait_for_timeout(300)

        if A.shots:
            print('SHOTS'); os.makedirs(A.shots, exist_ok=True)
            await gm.evaluate("tw.clearSelection(); tw.setRoofs(false, 'test')"); await gm.evaluate(f"tw.batch({TOKENS}.map(t => ({{ type: 'token.delete', args: {{ id: t.id }} }})))"); await gm.wait_for_timeout(400)
            await gm.evaluate("tw.cutToRoom(tw.entities()['%s'], 'test')" % R['common']); await gm.wait_for_timeout(500)
            # six pawns, each facing a different way (the key is written beside the shots, never in a file name)
            lay = [('hero-fighter-human-m', 7.5, 7.5, 0), ('foe-goblin-spear', 17.5, 7.5, 90), ('hero-wizard-elf-f', 27.5, 7.5, 180), ('foe-wolf', 7.5, 22.5, 270), ('town-human-smith', 17.5, 22.5, 135), ('foe-owlbear', 30, 20, 315)]
            lay = [l for l in lay if await gm.evaluate(f"tw.figures.byId.has('{l[0]}')")]
            await gm.evaluate("tw.batch(Object.values(tw.entities()).filter(e => e.kind === 'object' && tw.ST.isConnector(e)).map(e => ({ type: 'object.delete', args: { id: e.id } })))")
            for i, (fid, x, z, deg) in enumerate(lay): await gm.evaluate(f"tw.addPawns('{fid}', {x}, {z}, {{ rot: {deg} * Math.PI / 180, select: false, name: '{'ABCDEF'[i]}' }})")  # lettered, so the read is blind
            await gm.wait_for_timeout(500); await wait(gm, f"{TOKENS}.every(t => tw.worldOf(tw.area()).figureOf(t.id)?.loaded)", 40000, 'all shot figures loaded'); await gm.evaluate("tw.clearSelection()"); await gm.mouse.move(5, 880)
            key = {'pawns': [{'n': i + 1, 'fig': l[0], 'x': l[1], 'z': l[2], 'faces_deg_from_plusZ_toward_plusX': l[3]} for i, l in enumerate(lay)], 'note': 'camera yaw 0 looks toward -Z: +Z is toward the viewer (screen down), +X is screen right'}
            DIRS = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right']
            for name, (x, z, dist, pitch) in (('view-a', (20, 15, 80, 62)), ('view-b', (20, 15, 55, 48)), ('view-c', (20, 15, 110, 68))):
                await view(gm, x, z, dist, pitch); await gm.wait_for_timeout(1500); await gm.screenshot(path=os.path.join(A.shots, f'{name}.png'))
                # the truth in SCREEN terms, worked out from the projection (the base's centre and the tip of its point)
                key[name] = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()), out = {{}}; for (const t of {TOKENS}) {{ const m = w.figureOf(t.id), c = tw.screenOf(t.x, t.z, tw.main, 0.3), p = tw.screenOf(t.x + m.point[0], t.z + m.point[1], tw.main, 0.3); const a = Math.atan2(p.y - c.y, p.x - c.x) * 180 / Math.PI; out[t.name] = {{ fig: t.fig, cx: Math.round(c.x), cy: Math.round(c.y), head_y: Math.round(tw.screenOf(t.x, t.z, tw.main, m.overall_ft + 0.3).y), screen_deg: Math.round(a), faces: {json.dumps(DIRS)}[((Math.round(a / 45) % 8) + 8) % 8], point_px: Math.round(Math.hypot(p.x - c.x, p.y - c.y)), base_px: Math.round(2 * Math.hypot(tw.screenOf(t.x + m.base_width_ft / 2, t.z, tw.main, 0.3).x - c.x, 0)) }}; }} return out; }})()""")
            # a control: the same bases with no figure standing on them (does the figure hide its own mark?)
            await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); for (const t of {TOKENS}) w.recs.get(t.id).visual.userData.holder.visible = false; }})()")
            for name, (x, z, dist, pitch) in (('bare-a', (20, 15, 80, 62)), ('bare-b', (20, 15, 55, 48))): await view(gm, x, z, dist, pitch); await gm.wait_for_timeout(900); await gm.screenshot(path=os.path.join(A.shots, f'{name}.png'))
            await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); for (const t of {TOKENS}) w.recs.get(t.id).visual.userData.holder.visible = true; }})()")
            json.dump(key, open(os.path.join(A.shots, 'key.json'), 'w'), indent=1)
            await bar(gm, 'elf wizard'); await gm.wait_for_timeout(1200); await gm.screenshot(path=os.path.join(A.shots, 'bar-a.png')); await gm.keyboard.press('Escape')
            await bar(gm, '6 goblins'); await gm.wait_for_timeout(1200); await gm.screenshot(path=os.path.join(A.shots, 'bar-b.png')); await gm.keyboard.press('Escape')
            print(f'    shots in {A.shots}')

        if A.shots or A.cost:
            # NAMES ON BASES (both ways) and MAIN PAWNS (full detail against the 20k tier): pictures for a blind read, and what each costs
            print('NAMES + DETAIL'); out = A.shots or tempfile.mkdtemp(prefix='tw-figshots-'); os.makedirs(out, exist_ok=True); A.shots or tmp.append(out)
            await gm.evaluate("tw.clearSelection(); tw.setRoofs(false, 'test')"); await gm.evaluate(f"tw.batch({TOKENS}.map(t => ({{ type: 'token.delete', args: {{ id: t.id }} }})).concat(Object.values(tw.entities()).filter(e => e.kind === 'object' && tw.ST.isConnector(e)).map(e => ({{ type: 'object.delete', args: {{ id: e.id }} }}))))"); await gm.wait_for_timeout(400)
            await gm.evaluate("tw.cutToRoom(tw.entities()['%s'], 'test')" % R['common']); await gm.evaluate("tw.figures.setName({ ...tw.figures.nameDefaults }, { save: false })")
            named = [('hero-fighter-human-m', 7.5, 7.5, 0, 'Brakka'), ('foe-goblin-spear', 17.5, 7.5, 90, 'Grishnak'), ('hero-wizard-elf-f', 27.5, 7.5, 180, 'Mira Vale'), ('foe-wolf', 7.5, 22.5, 270, 'Fang'), ('town-human-smith', 17.5, 22.5, 135, 'Old Tom Hobb'), ('foe-owlbear', 30, 20, 315, 'Hootclaw')]
            for fid, x, z, deg, nm in named: await gm.evaluate(f"tw.addPawns('{fid}', {x}, {z}, {{ rot: {deg} * Math.PI / 180, select: false, name: '{nm}' }})")
            await wait(gm, f"{TOKENS}.every(t => tw.worldOf(tw.area()).figureOf(t.id)?.loaded)", 40000, 'figures for the name shots'); await gm.evaluate("tw.clearSelection()"); await gm.mouse.move(5, 880)
            nkey = {'names_left_to_right_top_row_first': [n[4] for n in named], 'pictures': {}}
            k = 0
            for face in (True, False):
                await gm.evaluate(f"tw.figures.setName({{ faceCamera: {'true' if face else 'false'} }}, {{ save: false }})")
                for vn, (dist, pitch) in (('table', (80, 62)), ('leaning-in', (48, 40))):
                    k += 1; await view(gm, 20, 15, dist, pitch); await gm.wait_for_timeout(1200); await gm.screenshot(path=os.path.join(out, f'names-{k}.png')); nkey['pictures'][f'names-{k}'] = {'lettering': 'toward the camera' if face else 'fixed to the base (at its back)', 'view': vn}
            json.dump(nkey, open(os.path.join(out, 'names-key.json'), 'w'), indent=1)
            await gm.evaluate("tw.figures.setName({ ...tw.figures.nameDefaults }, { save: false })"); await gm.evaluate(f"tw.batch({TOKENS}.map(t => ({{ type: 'token.delete', args: {{ id: t.id }} }})))"); await gm.wait_for_timeout(400)
            # five heroes in a row: first at their 20k tier, then as main pawns (the original mesh)
            five = ['hero-fighter-human-m', 'hero-wizard-elf-f', 'hero-rogue-dwarf-m', 'hero-cleric-dwarf-f', 'hero-ranger-orc-f']; five = [f for f in five if await gm.evaluate(f"tw.figures.byId.has('{f}')")]
            for i, fid in enumerate(five): await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_detail00{i}0', name: 'P{i + 1}', x: {7.5 + i * 5}, z: 12.5, rot: 0.35, fig: '{fid}', color: '#e0b04a' }})")
            await wait(gm, f"{TOKENS}.every(t => tw.worldOf(tw.area()).figureOf(t.id)?.loaded)", 40000, 'five heroes'); await gm.wait_for_timeout(800)
            FRAMES = "(async () => { const frames = []; let last = performance.now(); await new Promise(res => { const tick = () => { const now = performance.now(); frames.push(now - last); last = now; frames.length < 200 ? requestAnimationFrame(tick) : res(); }; requestAnimationFrame(tick); }); frames.sort((a, b) => a - b); return +frames[100].toFixed(2); })()"
            STAT = f"(() => {{ const w = tw.worldOf(tw.area()), F = tw.figures, ts = {TOKENS}; let tris = 0, kb = 0, tex = 0; for (const t of ts) {{ const m = w.figureOf(t.id), f = F.get(t.fig), full = m.detail === 'full'; tris += m.drawn_tris; kb += full ? f.full_kb + f.kb : f.kb; tex += F.texBytes(f.url) + (full ? F.texBytes(f.full) : 0); }} return {{ pawns: ts.length, triangles: tris, download_mb: +(kb / 1024).toFixed(1), texture_mb: Math.round(tex / 1048576) }}; }})()"
            VIEWS = (('table', (17.5, 12.5, 80, 62)), ('leaning-in', (17.5, 12.5, 32, 30)), ('first-person', (17.5, 12.5, 15, 12)))
            dkey = {}; order = [('one', 'two'), ('two', 'one'), ('one', 'two')]
            for variant in ('20k tier', 'main pawns (original mesh)'):
                if variant.startswith('main'):
                    await gm.evaluate(f"tw.batch({TOKENS}.map(t => ({{ type: 'token.set', args: {{ id: t.id, main: true }} }})))"); await wait(gm, f"{TOKENS}.every(t => tw.worldOf(tw.area()).figureOf(t.id)?.swapped)", 60000, 'originals in'); await gm.wait_for_timeout(800)
                st = await gm.evaluate(STAT)
                for vi, (vn, (x, z, dist, pitch)) in enumerate(VIEWS):
                    await view(gm, x, z, dist, pitch); await gm.wait_for_timeout(1000); st[f'frame_ms_{vn}'] = await gm.evaluate(FRAMES)
                    if vn != 'table': name = f"detail-{vn}-{order[vi][0 if variant.startswith('20k') else 1]}"; await gm.screenshot(path=os.path.join(out, name + '.png')); dkey[name] = variant
                print(f'    {variant}: {json.dumps(st)}')
            json.dump(dkey, open(os.path.join(out, 'detail-key.json'), 'w'), indent=1)
            await gm.evaluate(f"tw.batch({TOKENS}.map(t => ({{ type: 'token.delete', args: {{ id: t.id }} }})))"); await gm.wait_for_timeout(300)

        if A.cost:
            print('COST')
            await gm.evaluate("tw.clearSelection()"); await gm.evaluate(f"tw.batch({TOKENS}.map(t => ({{ type: 'token.delete', args: {{ id: t.id }} }})))"); await gm.wait_for_timeout(500)
            await gm.evaluate("tw.cutOff('test')"); await view(gm, 40, 30, 150, 60)
            COSTJS = """async (n) => {
              const F = tw.figures, have = Object.values(tw.entities()).filter(e => e.kind === 'token').length, sleep = (ms) => new Promise(r => setTimeout(r, ms));
              // a believable table: a third heroes, the rest townsfolk and foes, all different figures
              const heroes = F.list.filter(f => f.group === 'hero'), rest = F.list.filter(f => f.group !== 'hero' && f.size === 1), pick = [];
              for (let i = 0; pick.length < n; i++) pick.push(i % 3 === 0 ? heroes[(i / 3 * 7) % heroes.length | 0] : rest[(i * 5) % rest.length]);
              const add = pick.slice(have), ops = add.map((f, k) => { const i = have + k; return { type: 'token.create', args: { id: 'tok_cost' + String(i).padStart(4, '0') + 'x', name: f.name.slice(0, 20), x: 2.5 + (i % 12) * 5, z: 40 + Math.floor(i / 12) * 5 + 2.5, fig: f.id, color: '#e0b04a' } }; });
              if (ops.length) tw.batch(ops);
              const t0 = performance.now(); while (performance.now() - t0 < 60000) { await sleep(200); const ts = Object.values(tw.entities()).filter(e => e.kind === 'token'); if (ts.length >= n && ts.every(t => tw.worldOf(tw.area()).figureOf(t.id)?.loaded)) break; }
              await sleep(1500);
              const ts = Object.values(tw.entities()).filter(e => e.kind === 'token'), figs = [...new Set(ts.map(t => t.fig))].map(id => F.get(id));
              const frames = []; let last = performance.now(); await new Promise(res => { const tick = () => { const now = performance.now(); frames.push(now - last); last = now; frames.length < 240 ? requestAnimationFrame(tick) : res(); }; requestAnimationFrame(tick); });
              frames.sort((a, b) => a - b); const info = tw.main && document.getElementById('c') ? null : null;
              const tex = figs.reduce((a, f) => a + (tw.assets.look.texBytes.get(f.url) || 0), 0);
              return { n: ts.length, different: figs.length, heroes: figs.filter(f => f.tier === 'hero').length, file_mb: +(figs.reduce((a, f) => a + f.kb, 0) / 1024).toFixed(1), tris: figs.reduce((a, f) => a + f.tris, 0), tex_mb: +(tex / 1048576).toFixed(0), frame_ms_median: +frames[120].toFixed(2), frame_ms_p95: +frames[228].toFixed(2), fps: tw.fps }; }"""
            base = await gm.evaluate("(async () => { const frames = []; let last = performance.now(); await new Promise(res => { const tick = () => { const now = performance.now(); frames.push(now - last); last = now; frames.length < 240 ? requestAnimationFrame(tick) : res(); }; requestAnimationFrame(tick); }); frames.sort((a, b) => a - b); return { frame_ms_median: +frames[120].toFixed(2), frame_ms_p95: +frames[228].toFixed(2) }; })()")
            print(f'    empty table (two rooms): {base}')
            for n in (5, 20, 60):
                r = await gm.evaluate(COSTJS, n); print(f'    {n} figures: {json.dumps(r)}')
            await gm.evaluate(f"tw.batch({TOKENS}.map(t => ({{ type: 'token.delete', args: {{ id: t.id }} }})))")

        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
bad = [r for r in results if not r[0]]
print(f"\nfigs: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)

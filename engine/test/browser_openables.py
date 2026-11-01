#!/usr/bin/env python3
"""EVERY OPENABLE SHOWS ITS STATE (2026-10-30, Harry: "we might really need to go over *all* the opens and closes,
because a lot of them don't show state"). core/openables.js says what opens, client/openlook.js how each shows it:
a leaf swings, a pair parts, a secret wall turns, the portcullis slides (motion), or the variant's own open twin swaps
in. Two seats, the GM and a player (Mira), and an AI seat over GET. experiments/2026-10-30-openables/INVENTORY.md.

  TW_PORTS=a,b python3 engine/test/browser_openables.py --local

  KINDS    one of every kind that opens is on the table; each has an open look (motion or swap) but the few the
           census lists as having none; the five kinds with an open twin, no Open before and a shut look now open
  TOGGLE   for each kind, Mira selects it: her ring's button says Open (no "on" state); she presses it: both seats
           see it open AND drawn open (the rig at its end pose, or the open twin), her button now says Close and wears
           the state mark; she presses it again: shut and drawn shut on both
  VARIANT  a swap opens as its own variant (the fine wardrobe as the fine open wardrobe; a window keeps its stone)
  MOTION   on the GM's side a door's open swings (the rig between its poses for a moment); with reduce motion it
           is at once
  GET      an AI seat (player classes): the scene lists a wardrobe with its state; do?cmd=object.open opens it;
           both seats draw it open
  DOOR     a generated door Mira opens (door.open) is drawn swung open on the GM's side, not as a stone frame
  REPLAY   Mira reloads: what is open is drawn open, at once
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--only')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:600] if detail else ''}", flush=True)

# the kinds the census (INVENTORY.md) listed with no open look of their own: none since experiments/2026-10-30-openmesh
# made their open twins (the cage, the casket, the tack and travel trunks, the trapdoors, the oubliette hatch, three windows)
NO_LOOK = set()
# kinds with an open twin and no Open before the census: the five whose shut model looked shut, the three whose shut
# model was re-made (openmesh), and the two hatches whose open twins are new (openmesh)
NEWLY = ['cupboard', 'iron-maiden', 'wardrobe', 'salt-box', 'wall-window-small', 'bread-oven', 'smith-farrier-box', 'rural-grooming-box', 'floor-trapdoor', 'oubliette-hatch']

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18741,18742').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-openables-'); site = tempfile.mkdtemp(prefix='tw-site-')
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
async def idle(pg): await wait(pg, "tw.sync.pendingCount() === 0", 30000, 'commands settled'); await pg.wait_for_timeout(200)
async def settle(pg, ms=120000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0 && [...tw.worldOf(tw.area()).recs.values()].every(r => r.settled)", ms, 'spawn animations over'); await pg.wait_for_timeout(400)
async def view(pg, x, z, dist=40, pitch=55, yaw=30):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"); await pg.wait_for_timeout(250)

# a thing as a seat draws it: its state, the catalog object drawn, the rig's pose, whether it is still moving
DRAWN = """((id) => { const w = tw.worldOf(tw.area()), r = w.recs.get(id), e = tw.entities()[id]; if (!e) return null;
  const v = r?.visual, R = v?.userData.openRig; return { open: !!e.open, as: v?.userData.drawnAs || null, rig: R ? Math.round(R.t * 1000) / 1000 : null, moving: !!w.openAnims?.has(r), look: tw.assets.openLook(e), placeholder: !!v?.userData.placeholder }; })"""
BTN = "(() => { const b = document.querySelector('#ring .rbtn[data-cmd=\"thing.open\"]'); return b ? { label: b.getAttribute('aria-label'), state: b.dataset.state || null } : { none: [...document.querySelectorAll('#ring .rbtn')].map(x => x.dataset.cmd), sel: [...tw.sel], ring: !!document.querySelector('#ring:not([hidden])') }; })()"
# drawn open / shut, by its look: motion at its end pose; swap as the open twin (or as itself, shut)
def drawn_ok(d, want_open, cat):
    if not d or d['open'] != want_open or d['placeholder']: return False
    if d['look'] == 'motion': return d['rig'] == (1 if want_open else 0) and not d['moving']
    if d['look'] == 'swap': return (d['as'] != cat) == want_open
    return d['look'] is None and cat in NO_LOOK

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    relay = f'http://127.0.0.1:{RP}' if A.local else None
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900, still=False):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, reduced_motion='reduce' if still else 'no-preference')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url, timeout=180000, wait_until='domcontentloaded'); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST openables {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000), 'GM tab live')
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        link = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        pl = await tab(link); check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 90000), 'Mira joined')

        await gm.evaluate("tw.registry.run('area.fogOfWar.off')"); await idle(gm); await idle(pl)
        print('    fog of war (Mira):', await pl.evaluate("tw.areaRule('fogOfWar')"))
        # ================= KINDS =================
        print('KINDS: one of every kind that opens')
        items = await gm.evaluate("""(() => {
          const L = tw.lib.objects, isState = (id) => !!L[id]?.open_of || (id.endsWith('-open') && !!L[id.slice(0, -5)]), out = [];
          const pick = (cat, sku) => { const sz = tw.roomgen.sizeOf(cat, sku); if (sz) out.push({ cat, sku: sz.sku, sz }); };
          for (const cat of Object.keys(L).sort()) if (!isState(cat) && tw.assets.openable(cat)) pick(cat);
          pick('door-plank', 'door-plank--leaf'); pick('wardrobe', 'wardrobe--fine--s2'); pick('wall-window-small', 'wall-window-small--fieldstone'); pick('wall-window-small', 'wall-window-small--castle-rough');
          return out; })()""")
        if A.only: items = [it for it in items if it['cat'] in A.only.split(',') or it['sku'] in ('door-plank--leaf', 'wardrobe--fine--s2', 'wall-window-small--fieldstone', 'wall-window-small--castle-rough')]
        print('    still (GM, Mira):', await gm.evaluate("tw.worldOf(tw.area()).statusStill?.()"), await pl.evaluate("tw.worldOf(tw.area()).statusStill?.()"), await gm.evaluate("JSON.stringify({gfx: tw.prefs?.gfx, auto: tw.prefs?.gfxAuto})"))
        COLS = 10
        ops = []
        for i, it in enumerate(items):
            it['id'] = f'obj_opk{i:03d}'; it['x'] = 8 + (i % COLS) * 14; it['z'] = 8 + (i // COLS) * 14; sz = it['sz']
            ops.append({'type': 'object.place', 'args': {'id': it['id'], 'name': it['cat'].replace('-', ' '), 'cat': it['cat'], 'sku': sz['sku'], 'url': sz['url'], 'place': sz['place'] or 'floor', 'layer': 'openings' if sz['place'] == 'kit' else 'furnish', 'x': it['x'], 'z': it['z'], 'y': 0, 'rot': 0, 'yaw': sz['yaw'], 'dims': sz['dims'], **({'s': sz['s']} if sz.get('s') else {})}})
        for k in range(0, len(ops), 40): await gm.evaluate("(ops) => tw.batch(ops)", ops[k:k + 40]); await idle(gm)
        await settle(gm); await wait(pl, f"!!tw.entities()['{items[-1]['id']}']", 30000, 'Mira has them'); await settle(pl)
        cats = sorted({it['cat'] for it in items})
        looks = {it['id']: (await gm.evaluate(DRAWN + f"('{it['id']}')"))['look'] for it in items}
        nolook = sorted({it['cat'] for it in items if looks[it['id']] is None})
        check(len(cats) >= 47, f'{len(cats)} kinds that open are on the table', cats)
        check(set(nolook) == NO_LOOK, f'each has an open look (motion or its twin) but the census\'s {len(NO_LOOK)} with none', {'none': nolook})
        check(all(c in cats for c in NEWLY), f'the {len(NEWLY)} kinds with an open twin and no Open before the census now open', [c for c in NEWLY if c not in cats])
        motion = sorted({it['cat'] for it in items if looks[it['id']] == 'motion'}); swap = sorted({it['cat'] for it in items if looks[it['id']] == 'swap'})
        print(f'    motion {len(motion)}: {motion}\n    swap {len(swap)}: {swap}')

        # ================= TOGGLE =================
        print('TOGGLE: Mira opens and shuts each, from her ring')
        bad = []
        for it in items:
            i = it['id']
            await view(pl, it['x'], it['z']); await pl.evaluate(f"tw.select('{i}')"); await pl.wait_for_timeout(250)
            b0 = await pl.evaluate(BTN)
            if not b0 or 'none' in b0: bad.append((it['sku'], 'no Open on her ring')); await pl.evaluate("tw.clearSelection()"); continue
            await pl.evaluate("document.querySelector('#ring .rbtn[data-cmd=\"thing.open\"]').click()"); await idle(pl); await idle(gm)
            ok1 = await wait(gm, f"(() => {{ const d = {DRAWN}('{i}'); return d && d.open && !d.moving && !d.placeholder; }})()", 8000) and await wait(pl, f"(() => {{ const d = {DRAWN}('{i}'); return d && d.open && !d.moving; }})()", 8000)
            await pl.wait_for_timeout(150)
            dg, dp, b1 = await gm.evaluate(DRAWN + f"('{i}')"), await pl.evaluate(DRAWN + f"('{i}')"), await pl.evaluate(BTN)
            if not (b0.get('label') == 'Open' and b0['state'] is None): bad.append((it['sku'], 'shut: the button is not a plain Open', b0))
            if not (ok1 and drawn_ok(dg, True, it['cat']) and drawn_ok(dp, True, it['cat'])): bad.append((it['sku'], 'Open: not drawn open on both seats', dg, dp))
            if not (b1 and b1.get('label') == 'Close' and b1['state'] == 'on'): bad.append((it['sku'], 'open: the button does not say Close', b1))
            if b1 and 'label' in b1: await pl.evaluate("document.querySelector('#ring .rbtn[data-cmd=\"thing.open\"]').click()")
            await idle(pl); await idle(gm)
            ok2 = await wait(gm, f"(() => {{ const d = {DRAWN}('{i}'); return d && !d.open && !d.moving; }})()", 8000) and await wait(pl, f"(() => {{ const d = {DRAWN}('{i}'); return d && !d.open && !d.moving; }})()", 8000)
            await pl.wait_for_timeout(150)
            dg, dp, b2 = await gm.evaluate(DRAWN + f"('{i}')"), await pl.evaluate(DRAWN + f"('{i}')"), await pl.evaluate(BTN)
            if not (ok2 and drawn_ok(dg, False, it['cat']) and drawn_ok(dp, False, it['cat'])): bad.append((it['sku'], 'Close: not drawn shut on both seats', dg, dp))
            if not (b2 and b2.get('label') == 'Open' and b2['state'] is None): bad.append((it['sku'], 'shut again: the button does not say Open', b2))
            await pl.evaluate("tw.clearSelection()")
        n = len(items)
        check(not bad, f'{n} things: Open on a shut one, drawn open on both seats, Close on it, drawn shut on both after', bad[:8])

        # ================= VARIANT =================
        print('VARIANT: a swap opens as its own variant')
        W = next(it for it in items if it['sku'] == 'wardrobe--fine--s2'); WF = next(it for it in items if it['sku'] == 'wall-window-small--fieldstone'); WC = next(it for it in items if it['sku'] == 'wall-window-small--castle-rough')
        await gm.evaluate(f"tw.batch([{{ type: 'object.open', args: {{ id: '{W['id']}', open: true }} }}, {{ type: 'object.open', args: {{ id: '{WF['id']}', open: true }} }}, {{ type: 'object.open', args: {{ id: '{WC['id']}', open: true }} }}])"); await idle(gm)
        await wait(gm, f"(() => ['{W['id']}', '{WF['id']}', '{WC['id']}'].every(id => {DRAWN}(id)?.as?.endsWith('-open')))()", 8000)
        sk = await gm.evaluate(f"(ids) => ids.map(id => {{ let u = null; tw.worldOf(tw.area()).recs.get(id).visual.traverse(o => {{ if (o.userData.meshRoot && !u) u = o; }}); return tw.assets.specOf(tw.entities()[id]).sku; }})", [W['id'], WF['id'], WC['id']])
        check(sk[0] == 'wardrobe-open--fine--s2' and sk[1] == 'wall-window-small-open--fieldstone', 'the fine wardrobe opens as the fine open wardrobe; the fieldstone window as the fieldstone open window', sk)
        check(sk[2] == 'wall-window-small-open--castle-rough', 'a castle-rough window opens as the castle-rough open window (its own stone; it had no twin before experiments/2026-10-30-openmesh)', sk[2])

        # ================= FIT =================
        # (experiments/2026-10-30-openmesh) an open twin is drawn the shut one's size where the opening changes nothing,
        # a framed door's twin keeps its frame in the wall with the leaf out of it, a hatch's twin keeps its tile on the
        # floor with the shaft under it and the hatch standing up
        print('FIT: each open twin, against its shut piece')
        swaps = [it for it in items if looks[it['id']] == 'swap']
        BOX = """((id) => { const r = tw.worldOf(tw.area()).recs.get(id); if (!r?.visual) return null; r.visual.updateMatrixWorld(true); let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
          r.visual.traverse(o => { if (!o.isMesh || o.userData.pickProxy || o.userData.hingeHelper || !o.geometry) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
            lo = lo.map((v, i) => Math.min(v, b.min.getComponent(i))); hi = hi.map((v, i) => Math.max(v, b.max.getComponent(i))); });
          return { lo, hi, as: r.visual.userData.drawnAs }; })"""
        await gm.evaluate("(ids) => tw.batch(ids.map(id => ({ type: 'object.open', args: { id, open: false } })))", [it['id'] for it in swaps]); await idle(gm); await settle(gm)
        shut = {it['id']: await gm.evaluate(BOX + f"('{it['id']}')") for it in swaps}
        await gm.evaluate("(ids) => tw.batch(ids.map(id => ({ type: 'object.open', args: { id, open: true } })))", [it['id'] for it in swaps]); await idle(gm)
        await wait(gm, f"(ids => ids.every(id => {DRAWN}(id)?.as?.endsWith('-open') || {DRAWN}(id)?.as?.endsWith('-raised')))({json.dumps([it['id'] for it in swaps])})", 30000, 'all open'); await settle(gm)
        opened = {it['id']: await gm.evaluate(BOX + f"('{it['id']}')") for it in swaps}
        bad = []
        for it in swaps:
            a, b = shut[it['id']], opened[it['id']]
            if not a or not b: bad.append((it['sku'], 'no box')); continue
            ea = [h - l for l, h in zip(a['lo'], a['hi'])]; eb = [h - l for l, h in zip(b['lo'], b['hi'])]; r = [round(y / x, 2) if x > 0.05 else None for x, y in zip(ea, eb)]
            if not any(v and abs(v - 1) <= 0.2 for v in r): bad.append((it['sku'], 'no side the same size as shut (open/shut per x, y, z)', r))
            if it['cat'] in ('door-plank', 'door-reinforced'):
                mz = (a['lo'][2] + a['hi'][2]) / 2
                if not (b['lo'][2] - 0.3 <= mz <= b['lo'][2] + 0.6 and eb[2] >= 1.5): bad.append((it['sku'], 'frame not in the wall line or the leaf not out of it', {'shut_z': [round(a['lo'][2], 2), round(a['hi'][2], 2)], 'open_z': [round(b['lo'][2], 2), round(b['hi'][2], 2)]}))
            if it['cat'] in ('floor-trapdoor', 'oubliette-hatch'):
                if not (b['hi'][1] >= a['hi'][1] + 1.0 and b['lo'][1] < a['lo'][1] - 0.2): bad.append((it['sku'], 'the hatch does not stand up, or its tile is not on the floor (the shaft under it)', {'shut_y': [round(a['lo'][1], 2), round(a['hi'][1], 2)], 'open_y': [round(b['lo'][1], 2), round(b['hi'][1], 2)]}))
        check(not bad, f'{len(swaps)} swaps: each open twin is the shut one\'s size on a side the opening leaves alone; framed doors keep the frame in the wall; hatches keep the tile on the floor', bad[:8])
        await gm.evaluate("(ids) => tw.batch(ids.map(id => ({ type: 'object.open', args: { id, open: false } })))", [it['id'] for it in swaps]); await idle(gm)
        await gm.evaluate("(ids) => tw.batch(ids.map(id => ({ type: 'object.open', args: { id, open: true } })))", [W['id'], WF['id'], WC['id']]); await idle(gm); await settle(gm)  # (as VARIANT left them: REPLAY reloads them open)

        # ================= MOTION =================
        print('MOTION: a door swings; with reduce motion it is at once')
        D = next(it for it in items if it['sku'] == 'door-plank--leaf')
        await gm.evaluate(f"tw.dispatch('object.open', {{ id: '{D['id']}', open: true }})")
        mid = await wait(gm, f"(() => {{ const d = {DRAWN}('{D['id']}'); return d && d.open && d.moving && d.rig > 0 && d.rig < 1; }})()", 3000)
        await wait(gm, f"(() => {{ const d = {DRAWN}('{D['id']}'); return d && !d.moving && d.rig === 1; }})()", 4000)
        check(mid, 'the GM sees the leaf between shut and open for a moment (it swings)')
        await gm.evaluate("document.documentElement.classList.add('reduce-motion')")
        await gm.evaluate(f"tw.dispatch('object.open', {{ id: '{D['id']}', open: false }})")
        await wait(gm, f"tw.entities()['{D['id']}'].open === false", 4000)
        d = await gm.evaluate(DRAWN + f"('{D['id']}')")
        check(d and d['rig'] == 0 and not d['moving'], 'reduce motion: shut at once', d)
        await gm.evaluate("document.documentElement.classList.remove('reduce-motion')"); await idle(gm)

        # ================= GET =================
        print('GET: an AI seat with a player\'s classes')
        if relay:
            def get(path):
                with urllib.request.urlopen(relay + path, timeout=15) as r: return json.loads(r.read())
            cid = await gm.evaluate("tw.sync.campaign?.id || tw.campaignId?.() || null"); tok = await gm.evaluate("tw.sync.token || null"); area = await gm.evaluate('tw.area()')
            WR = next(it for it in items if it['cat'] == 'wardrobe')
            try:
                h = get(f"/c/{cid}/do?cmd=seat.create&kind=llm&name=Helper&scope={urllib.parse.quote(json.dumps({'areas': '*', 'classes': ['open']}))}&seat={urllib.parse.quote(tok)}")
                t = urllib.parse.quote(h['token'])
                r0 = get(f"/c/{cid}/a/{area}/do?cmd=object.open&id={WR['id']}&open=false&nonce=opget00&seat={t}")
                await wait(gm, f"{DRAWN}('{WR['id']}')?.as === 'wardrobe'", 8000)
                sc = get(f"/c/{cid}/a/{area}/scene?seat={t}")
                row = next((d for d in sc.get('doors', []) if d.get('id') == WR['id']), None)
                r1 = get(f"/c/{cid}/a/{area}/do?cmd=object.open&id={WR['id']}&open=true&nonce=opget01&seat={t}")
                okg = await wait(gm, f"{DRAWN}('{WR['id']}')?.as === 'wardrobe-open'", 8000) and await wait(pl, f"{DRAWN}('{WR['id']}')?.as === 'wardrobe-open'", 8000)
                sc2 = get(f"/c/{cid}/a/{area}/scene?seat={t}")
                row2 = next((d for d in sc2.get('doors', []) if d.get('id') == WR['id']), None)
                check(r0.get('ok') and row and row['open'] is False and r1.get('ok') and okg and row2 and row2['open'] is True, 'the AI seat shuts the wardrobe over GET; the scene lists it shut; the AI seat opens it; both seats draw it open; the scene says open', {'row': row, 'do': r1, 'after': row2})
            except Exception as ex: check(False, 'GET', repr(ex))
        else: check(False, 'GET: no local relay')

        # ================= DOOR =================
        print('DOOR: a generated door Mira opens')
        R = await gm.evaluate("tw.spawnRoom('common', 30, 0, 4, 4, 77)"); await idle(gm); await settle(gm); await settle(pl)
        key = await pl.evaluate(f"[...tw.worldOf(tw.area()).edges.values()].find(e => e.kind === 'door' && !e.open && e.owner.room === '{R}')?.key || null")
        res = await pl.evaluate(f"(async (k) => {{ const it = tw.wallItem('wall:' + k); if (!tw.canOpen(it)) return 'not openable'; const m = await tw.await(tw.toggleOpen(it)); return !!m; }})('{key}')") if key else None
        await idle(pl); await idle(gm)
        oid = await gm.evaluate(f"Object.values(tw.entities()).find(e => e.kind === 'object' && e.fromEdge === '{key}')?.id || null")
        okd = oid and await wait(gm, f"(() => {{ const d = {DRAWN}('{oid}'); return d && d.open && d.look === 'motion' && d.rig === 1 && !d.moving; }})()", 8000)
        check(res is True and okd, 'it becomes a thing of its own, drawn swung open on the GM\'s side (its own leaf, not a frame twin)', {'key': key, 'res': res, 'drawn': oid and await gm.evaluate(DRAWN + f"('{oid}')")})

        # ================= REPLAY =================
        print('REPLAY: Mira reloads')
        openIds = [W['id'], WF['id'], WR['id'] if relay else W['id']] + ([oid] if oid else [])
        await pl.reload(wait_until='domcontentloaded'); await wait(pl, 'window.tw && tw.ready && tw.ready()', 90000); await settle(pl)
        ds = [await pl.evaluate(DRAWN + f"('{i}')") for i in openIds]
        check(all(d and d['open'] and not d['moving'] and (d['rig'] == 1 if d['look'] == 'motion' else d['as'] != tw_cat) for d, tw_cat in zip(ds, [W['cat'], WF['cat'], 'wardrobe', 'door-plank'])), 'what is open is drawn open after a reload, at once (no swing replayed)', ds)

        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        n = sum(1 for r in results if r[0])
        print(f'browser openables: {n}/{len(results)} passed', flush=True)
        await browser.close()
    for pr in procs: pr.terminate()
    sys.exit(0 if all(r[0] for r in results) else 1)

try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass

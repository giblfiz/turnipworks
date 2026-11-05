#!/usr/bin/env python3
"""Faction pillars and piers (2026-10-24): the shelf, placement and the command bar, in the real client.

  /path/to/tw-slot python3 engine/test/browser_faction_pillars.py --local [--shots DIR]
  ... --page http://127.0.0.1:8180/         (dev; a throwaway campaign, removed afterwards)

SHELF   Build -> Factions shows a pillar cell for every faction whose flavor-pillar sku is in the library (and a pier for every
        flavor-buttress), named faction-first ("Dragon pillar", "Dragon pier"); a faction without one shows the gap.
PLACE   a shelf click then a canvas click puts the pillar down like a post: on a grid cross or an edge midpoint, never a
        cell centre, one storey tall (dims height 9.5-10.5 ft); Alt-free is not exercised. Undo removes it.
BAR     "dragon pillar", "dragon column", "spider pillar", ... and "dragon pier" / "dragon buttress" put that faction's piece
        first among the things to place; Enter enters placement of it.
LINEUP  every available pillar in a row, and every pier, photographed at table distance (lineup.png, lineup-piers.png, lineup.json:
        the left-to-right order) for the Gemini family read; no verdict here.
"""
import argparse, asyncio, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright
ROOT = Path(__file__).resolve().parents[2]; sys.path.insert(0, str(ROOT / 'tests')); import tw_sandbox
tw_sandbox.remove_campaigns()
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page', default='http://127.0.0.1:8180/')
ap.add_argument('--shots', default=str(ROOT / 'engine/test/shots/faction-pillars')); A = ap.parse_args()
results, procs, tmp = [], [], []
def check(ok, name, detail=''):
    results.append(bool(ok)); print(('ok   ' if ok else 'FAIL ') + name + (' — ' + str(detail) if detail else ''), flush=True)
def free():
    with socket.socket() as s: s.bind(('127.0.0.1', 0)); return s.getsockname()[1]
def start():
    rp, sp = free(), free(); data = tempfile.mkdtemp(prefix='tw-fpillars-'); site = tempfile.mkdtemp(prefix='tw-fpillars-site-'); tmp.extend([data, site])
    os.symlink(ROOT / 'engine', site + '/engine'); os.symlink(ROOT / 'tools/spawn-tuner', site + '/tuner')
    log = open(data + '/relay.log', 'w')
    procs.append(subprocess.Popen(['node', str(ROOT / 'engine/relay/server.js')], env={**os.environ, 'PORT': str(rp), 'DATA_DIR': data, 'ORIENT_API': '', 'TUNER_DIR': str(ROOT / 'tools/spawn-tuner/js'), 'TUNER_DATA': str(ROOT / 'tools/spawn-tuner/data')}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(sp), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        try: urllib.request.urlopen(f'http://127.0.0.1:{rp}/health'); break
        except Exception: time.sleep(.1)
    return f'http://127.0.0.1:{sp}/engine/client/index.html?relay=http://127.0.0.1:{rp}&api='
async def wait(pg, js, timeout=30000): await pg.wait_for_function(js, timeout=timeout)
async def idle(pg): await wait(pg, 'tw.sync.pendingCount() === 0')
async def snap(pg, name):
    Path(A.shots).mkdir(parents=True, exist_ok=True); await pg.screenshot(path=str(Path(A.shots) / (name + '.png')))
async def look(pg, x, z, dist=60, pitch=58):
    await pg.evaluate('([x,z,d,p])=>{const g=tw.main.grab;g.focus.set(x,0,z);g.dist=d;g.pitch=p;g.yaw=0;g.update();tw.main.rule="free"}', [x, z, dist, pitch]); await pg.wait_for_timeout(400)
async def shelf(pg):
    await pg.keyboard.press('Escape'); await pg.evaluate('tw.modes.cancel();tw.build.close();tw.clearSelection()')
    await pg.locator('#launchers [data-l="build"]').click(); await pg.locator('#buildMenu [data-factions]').click()
    await pg.locator('#factionShelf').wait_for(state='visible')
NEW = "old=>Object.values(tw.entities()).filter(e=>!old.includes(e.id))"

async def main():
    base = start() if A.local else A.page
    url = base + ('&' if '?' in base else '?') + 'nointro&nopost&faces=1500'
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling'])
        ctx = await b.new_context(viewport={'width': 1400, 'height': 950}); pg = await ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
        await pg.goto(url); await pg.fill('#newCampaign input[name=name]', 'TEST faction pillars ' + time.strftime('%H:%M:%S') + ' (throwaway)'); await pg.fill('#newCampaign input[name=gm]', 'Fauna'); await pg.click('#newCampaign button')
        await wait(pg, 'window.tw?.ready?.()', 90000)
        lib = await pg.evaluate('''() => { const f = c => (tw.lib.objects[c]?.skus || []).filter(k => k.url).map(k => k.shape);
                                    return { pillars: f('flavor-pillar'), piers: f('flavor-buttress'), labels: Object.fromEntries((Array.isArray(tw.lib.factions) ? tw.lib.factions : Object.values(tw.lib.factions || {})).map(x => [x.id, x.pieceLabel || x.label])), names: Object.fromEntries((Array.isArray(tw.lib.factions) ? tw.lib.factions : Object.values(tw.lib.factions || {})).map(x => [x.id, x.label])) }; }''')
        print('LIBRARY pillars', lib['pillars'], 'piers', lib['piers'], flush=True)
        check('dragons' in lib['pillars'], 'the library has a Dragon pillar')
        # ---------- SHELF ----------
        await shelf(pg)
        for f, lab in lib['labels'].items():
            cell = pg.locator(f'#factionShelf [data-faction="{f}"] button[aria-label="{lab} pillar"]')
            gap = pg.locator(f'#factionShelf [data-faction="{f}"] .faction-gap[aria-label="{lib["names"][f]}: missing pillar"]')  # a gap is named by the faction's own label
            if f in lib['pillars']: check(await cell.count() == 1, f'shelf: {lab} pillar')
            else: check(await gap.count() == 1, f'shelf: {lab} shows the pillar gap')
            if f in lib['piers']: check(await pg.locator(f'#factionShelf [data-faction="{f}"] button[aria-label="{lab} pier"]').count() == 1, f'shelf: {lab} pier')
        await pg.wait_for_function('document.querySelectorAll("#factionShelf [data-preview].live").length >= 10', timeout=60000)
        await snap(pg, 'shelf')
        # ---------- PLACE ----------
        old = await pg.evaluate('Object.keys(tw.entities())')
        await pg.locator('#factionShelf [data-faction="dragons"] button[aria-label="Dragon pillar"]').click()
        check(await pg.evaluate('!!tw.mode'), 'shelf Dragon pillar click enters placement')
        await look(pg, 15, 20)
        pt = await pg.evaluate('tw.screenOf(13.1,21.7,tw.main,0)'); await pg.mouse.move(pt['x'], pt['y']); await pg.wait_for_timeout(200)
        await pg.mouse.click(pt['x'], pt['y']); await idle(pg); await pg.keyboard.press('Escape')
        made = await pg.evaluate(NEW, old); pil = [e for e in made if e.get('cat') == 'flavor-pillar']
        check(len(pil) == 1 and pil[0]['sku'] == 'flavor-pillar--dragons-fct', 'canvas click places the Dragon pillar', [e.get('sku') for e in made])
        if pil:
            e = pil[0]; want = await pg.evaluate('tw.modes.postSnap(13.1,21.7)')
            onlattice = abs(e['x'] / 2.5 - round(e['x'] / 2.5)) < 1e-6 and abs(e['z'] / 2.5 - round(e['z'] / 2.5)) < 1e-6
            centre = (e['x'] % 5 == 2.5) and (e['z'] % 5 == 2.5)
            check(onlattice and not centre and abs(e['x'] - want[0]) < 1e-6 and abs(e['z'] - want[1]) < 1e-6, 'it snaps like a post (grid cross or edge midpoint, not a cell centre)', (e['x'], e['z'], want))
            h = e['dims'][1]; check(9.5 <= h <= 10.5, 'one storey tall', e['dims'])
            check(max(e['dims'][0], e['dims'][2]) <= 4.0, 'about 2-4 ft across', e['dims'])
            await pg.keyboard.press('Control+z'); await idle(pg)
            check(e['id'] not in await pg.evaluate('Object.keys(tw.entities())'), 'undo removes it')
        # ---------- BAR ----------
        async def bar(q):
            await pg.keyboard.press('Escape'); await pg.evaluate('tw.modes.cancel();tw.clearSelection()')
            await pg.keyboard.press('/'); await pg.locator('#bar textarea').fill(q); await pg.wait_for_timeout(250)
            rows = await pg.evaluate('[...document.querySelectorAll("#results .res")].map(el => ({ref: el.dataset.ref || "", t: el.querySelector(".t")?.textContent || ""}))')
            return rows
        lines = [(f'{lib["labels"][f].lower()} pillar', f'{lib["labels"][f]} pillar') for f in lib['pillars']]
        lines += [('dragon column', 'Dragon pillar'), ('spider pillar', 'Spider pillar'), ('dragon pillars', 'Dragon pillar'), ('dragon cult pillar', 'Dragon pillar'), ('skull pillar', 'Skeleton pillar'), ('sun column', 'Sun pillar'), ('tentacle column', 'Tentacle pillar'), ('devil pillar', 'Devil pillar')]
        lines += [(f'{lib["labels"][f].lower()} pier', f'{lib["labels"][f]} pier') for f in lib['piers']]
        lines += [('dragon buttress', 'Dragon pier'), ('dragon flying buttress', 'Dragon pier'), ('skull pier', 'Skeleton pier'), ('nature buttress', 'Nature pier')]
        for q, want in lines:
            if want.split()[0].lower() not in {lib['labels'][f].split()[0].lower() for f in (lib['pillars'] if 'pillar' in want else lib['piers'])}: continue
            rows = await bar(q); places = [r for r in rows if r['ref'].startswith('cat:')]
            check(bool(places) and places[0]['t'] == want, f'bar "{q}" -> {want} first to place', [r['t'] for r in places[:3]])
        rows = await bar('dragon pillar'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
        check(await pg.evaluate("tw.mode?.cat?.id === 'flavor-pillar' && tw.mode?.cat?.sku === 'flavor-pillar--dragons-fct'"), 'Enter on "dragon pillar" enters placement of it')
        await pg.keyboard.press('Escape'); await pg.evaluate('tw.modes.cancel()')
        # ---------- LINEUP (photograph only) ----------
        for i, f in enumerate(lib['pillars']):
            await shelf(pg); await pg.locator(f'#factionShelf [data-faction="{f}"] button[aria-label="{lib["labels"][f]} pillar"]').click()
            await look(pg, 30, 60, dist=80)
            pt = await pg.evaluate(f'tw.screenOf({5 * i},{60},tw.main,0)'); await pg.mouse.move(pt['x'], pt['y']); await pg.mouse.click(pt['x'], pt['y']); await idle(pg)
        await pg.keyboard.press('Escape'); await pg.evaluate('tw.modes.cancel();tw.clearSelection()')
        n = len(lib['pillars']); await look(pg, 2.5 * (n - 1), 60, dist=max(45, 7 * n), pitch=50); await pg.wait_for_timeout(2500)
        await snap(pg, 'lineup')
        # the piers get their own picture: take the pillar row away first (one row to describe)
        await pg.evaluate("Object.values(tw.entities()).filter(e=>e.cat==='flavor-pillar').forEach(e=>tw.dispatch('object.delete',{id:e.id}))"); await idle(pg)
        for i, f in enumerate(lib['piers']):
            await shelf(pg); await pg.locator(f'#factionShelf [data-faction="{f}"] button[aria-label="{lib["labels"][f]} pier"]').click()
            await look(pg, 30, 100, dist=90)
            pt = await pg.evaluate(f'tw.screenOf({6 * i},{100},tw.main,0)'); await pg.mouse.move(pt['x'], pt['y']); await pg.mouse.click(pt['x'], pt['y']); await idle(pg)
        await pg.keyboard.press('Escape'); await pg.evaluate('tw.modes.cancel();tw.clearSelection()')
        n = len(lib['piers']); await look(pg, 3 * (n - 1), 100, dist=max(45, 8 * n), pitch=50); await pg.wait_for_timeout(2500)
        await snap(pg, 'lineup-piers')
        pier_px = await pg.evaluate(f'[...Array({n}).keys()].map(i => [tw.screenOf(6*i,100,tw.main,0), tw.screenOf(6*i,100,tw.main,9)])')
        import json as _j; Path(A.shots).mkdir(parents=True, exist_ok=True); (Path(A.shots) / 'lineup.json').write_text(_j.dumps({'pillars': lib['pillars'], 'piers': lib['piers'], 'pierScreen': pier_px}))
        check(not errors, 'no page errors', errors[:3])
        await b.close()
    print(f'{sum(results)}/{len(results)} passed', flush=True)
    return all(results)

try: ok = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
    tw_sandbox.remove_campaigns()
sys.exit(0 if ok else 1)

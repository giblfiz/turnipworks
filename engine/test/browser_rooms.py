#!/usr/bin/env python3
"""Rooms, stage 1 (Harry 2026-10-05): a GM tab and a player tab.

  local:  python3 engine/test/browser_rooms.py --local [--gpu]
  live:   ... browser_rooms.py --page https://turnipworks.net/ --relay https://turnipworks.net/api/tw-relay

  LABELS     twice the size (24 px), a little see-through (82%); never on a player's screen
  SELECT     a selected room wears the house "selected" look round its volume (harry-v1: corner brackets top and
             bottom, breathing); hovering its label, the house hover look (the footprint outline)
  DICE       the re-roll button is a die
  TURN       a selected room turns 90 degrees about its centre, on the grid, its contents with it (what the user moved,
             added, pinned and deleted all survive); both tabs agree; a turn into a neighbour is refused, visibly
  DRAG       a room drags by its label (or, selected, by its floor), snapping to the grid; its footprint shows, red
             where the drop would be refused; the other tab sees the drag in progress (presence)
  HIDE       hiding a room: the player (and the player's AI seat) receives nothing of it, the GM sees it in the hidden
             treatment; the visible neighbour's wall is whole on both screens; reveal brings it all back
  MENU       ☰ opens ONE flat level for every kind of selection (a room 8 buttons, nothing more than 12; no duplicate /
             copy / cut); a sub-menu only for a long list, opened AT its button, whole on screen at the edges, following
             the camera; the Space chord tree is the same shape
  FOG        a room's Fog height drag track on its ring (at the button): dragging previews locally, letting go sends ONE
             synced, undoable room.set; the player's fog follows; "Type default" restores; a reload keeps it; an AI
             seat reads and sets it over GET
  CONDITIONAL BUTTONS  the component's rules (only while relevant, one home, never takes focus); the undo chip is one
  TOUCHABLE  the "everything on screen is touchable" invariant, after all of it
The test campaign is named "TEST rooms <time> (throwaway)". Screenshots land in engine/test/shots/rooms-*.png.
"""
import argparse, asyncio, json, math, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
from audit import AUDIT
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots')
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--relay'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--gpu', action='store_true')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

UA = {'User-Agent': 'TurnipWorks-acceptance/1.0'}
def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')

procs = []; tmpdirs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18102,18729').split(','))  # TW_PORTS=a,b when another worktree is running this suite
def start_local():
    data = tempfile.mkdtemp(prefix='tw-rooms-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmpdirs.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500&nointro', f'http://127.0.0.1:{RP}'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=60); return True
    except Exception: print(f'    (timed out: {what or js[:100]})'); return False
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")
async def view(pg, x, z, dist=110, pitch=58, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(250)
async def label_at(pg, rid):
    return await pg.evaluate(f"(() => {{ const el = document.querySelector('.rlabel[data-id=\"{rid}\"]'); if (!el || !el.classList.contains('on')) return null; const r = el.getBoundingClientRect(); return {{ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }}; }})()")
# (2026-10-20: the world-sized ring can lie over part of a room's label, its drag handle: press where no ring button is)
async def free_label_at(pg, rid):
    return await pg.evaluate(f"""(() => {{ const el = document.querySelector('.rlabel[data-id="{rid}"]'); if (!el || !el.classList.contains('on')) return null; const r = el.getBoundingClientRect();
        for (let j = 1; j < 6; j++) for (let i = 1; i < 10; i++) {{ const x = r.left + r.width * i / 10, y = r.top + r.height * j / 6, top = document.elementFromPoint(x, y); if (top && !top.closest('#ring .rbtn') && el.contains(top) || top === el) return {{ x, y }}; }}
        return null; }})()""")
async def settle(pg, ms=20000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", ms, 'spawn animations over')
    await pg.wait_for_timeout(250)
E = lambda rid: f"tw.entities()['{rid}']"
OBJS = lambda rid: f"Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{rid}')"
SNAP = lambda rid: f"JSON.stringify({OBJS(rid)}.map(o => [o.id, +o.x.toFixed(2), +o.z.toFixed(2), +(o.rot || 0).toFixed(3), !!o.pinned, !!o.hidden]).sort())"
REL = lambda rid: f"JSON.stringify((() => {{ const r = {E(rid)}.recipe, cx = (r.x + r.w / 2) * 5, cz = (r.z + r.d / 2) * 5; return {OBJS(rid)}.map(o => [o.id, +Math.hypot(o.x - cx, o.z - cz).toFixed(1)]).sort(); }})())"
def rel_same(a, b, tol=0.15):
    a, b = json.loads(a), json.loads(b)
    return [x[0] for x in a] == [x[0] for x in b] and all(abs(x[1] - y[1]) <= tol for x, y in zip(a, b))
# FRAME (2026-10-20, the world-sized ring): the ring is sized in feet at the piece and may run under the top bar, so a
# suite that clicks ring buttons first puts the selection's ring centre (tw.ringAnchor()) at a point of the screen
# (fy: a share of its height) by moving the camera's focus; returns the anchor
FRAME = """async ([dist, pitch, fy]) => { const g = tw.main.grab, sleep = (ms) => new Promise(r => setTimeout(r, ms));
  g.pitch = pitch; g.yaw = 0; g.dist = dist; tw.main.rule = 'free'; g.update(); await sleep(150);
  for (let i = 0; i < 8; i++) { const an = tw.ringAnchor(); if (!an) break; const ex = an.x - innerWidth / 2, ey = an.y - innerHeight * fy; if (Math.hypot(ex, ey) < 4) break;
    const p0 = tw.screenOf(g.focus.x, g.focus.z), p1 = tw.screenOf(g.focus.x + 1, g.focus.z), p2 = tw.screenOf(g.focus.x, g.focus.z + 1);
    const a11 = p1.x - p0.x, a12 = p2.x - p0.x, a21 = p1.y - p0.y, a22 = p2.y - p0.y, det = a11 * a22 - a12 * a21; if (!det) break;
    g.focus.x += (a22 * ex - a12 * ey) / det; g.focus.z += (-a21 * ex + a11 * ey) / det; g.update(); await sleep(150); }
  await sleep(200); return tw.ringAnchor(); }"""
RECT = lambda rid: f"(() => {{ const r = {E(rid)}?.recipe; return r ? [r.x, r.z, r.w, r.d, r.turn || 0] : null; }})()"

async def main():
    if A.local: page, relay = start_local()
    else: page, relay = A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500&nointro', (A.relay or A.page.rstrip('/') + '/api/tw-relay').rstrip('/')
    os.makedirs(SHOTS, exist_ok=True)
    GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if A.gpu or os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []; notfound = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}, permissions=['clipboard-read', 'clipboard-write'], reduced_motion='reduce')  # (the ring's slide is not what this suite tests)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            pg.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' else None)
            pg.on('response', lambda r: notfound.append(r.url) if r.status == 404 else None)
            await pg.goto(url); return pg
        gm = await tab(page)
        NAME = f"TEST rooms {time.strftime('%m-%d %H:%M:%S')} (throwaway)"
        await gm.fill('#newCampaign input[name=name]', NAME); await gm.fill('#newCampaign input[name=gm]', 'Fauna-test'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000), 'GM tab live', f"{NAME} · {await gm.evaluate('tw.transport()')} · engine {await gm.evaluate('tw.roomgen.version')}")
        # This suite exercises the open tabletop; vision fog has its own three-seat suite.
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
        await wait(gm, "tw.sync.campaign.defaults.fogOfWar === false && tw.sync.pendingCount() === 0", 15000, 'open-table fixture')
        T1 = await gm.evaluate('tw.area()'); CID = await gm.evaluate('tw.sync.campaign.id')
        ptok = await gm.evaluate("tw.createSeat({ kind: 'human', role: 'player', name: 'Brakka', color: '#5aa9e6' })")
        pl = await tab(await gm.evaluate(f"tw.inviteLink('{ptok}')") if False else page.split('#')[0].replace('nopost', 'nofx') + f'#s={ptok}')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 40000), 'player tab live')
        # ---------- a little inn: a guest room (A), a common room sharing its east wall (B), a storeroom on its own (C), a privy to bump into (D)
        await view(gm, 60, 32, 150)
        RA = await gm.evaluate("tw.spawnRoom('guest', 2, 2, 5, 4, 4101)"); await gm.wait_for_timeout(300)
        RB = await gm.evaluate("tw.spawnRoom('common', 7, 2, 4, 4, 4102)"); await gm.wait_for_timeout(300)
        RC = await gm.evaluate("tw.spawnRoom('storeroom', 16, 3, 5, 3, 4103)"); await gm.wait_for_timeout(300)
        RD = await gm.evaluate("tw.spawnRoom('privy', 17, 7, 2, 2, 4104)")
        ok = await wait(gm, f"['{RA}','{RB}','{RC}','{RD}'].every(id => tw.entities()[id]) && tw.sync.pendingCount() === 0", 30000, 'four rooms')
        await wait(pl, f"['{RA}','{RB}','{RC}','{RD}'].every(id => tw.entities()[id])", 30000, 'player has the rooms')
        await settle(gm, 60000); await view(gm, 60, 32, 150)
        check(ok, 'four rooms built', await gm.evaluate(f"JSON.stringify(['{RA}','{RB}','{RC}','{RD}'].map(id => {OBJS('ID')}.length).map((n, i) => n))".replace("'ID'", "['" + RA + "','" + RB + "','" + RC + "','" + RD + "'][i]").replace(".map(id => ", ".map((id, i) => ")))

        print('LABELS: twice the size, a little see-through; never on a player\'s screen')
        li = await gm.evaluate('tw.labelInfo()')
        rooms_l = [l for l in li if l['kind'] == 'room']; blds = [l for l in li if l['kind'] == 'building']
        check(len(rooms_l) == 4 and all(abs(l['font'] - 24) < 0.01 for l in rooms_l) and all(0.8 <= l['opacity'] <= 0.85 for l in rooms_l), 'room labels: 24 px (twice the old 12) at about 82% opacity', [(l['text'], l['font'], l['opacity']) for l in rooms_l])
        check(blds and all(abs(l['font'] - 13) < 0.01 for l in blds) and all(l['visible'] for l in li), 'building tags keep their size (13 px); at this zoom every room and building label finds a place (none steps aside)', [(l['text'], l['font'], l['visible']) for l in li])
        check(await pl.evaluate("document.querySelectorAll('.rlabel').length") == 0 and await pl.evaluate(f"!('name' in {E(RA)})"), 'the player has no labels at all')

        print('SELECT: the house selection look round the room\'s volume; hover on its label')
        la = await label_at(gm, RC)
        if not la: print('    labels:', await gm.evaluate('JSON.stringify(tw.labelInfo())'))
        await gm.mouse.move(la['x'], la['y']); await gm.wait_for_timeout(500)
        hov = await gm.evaluate("(() => { const s = tw.worldOf(tw.area()).selFx?.stats().entries || []; return { hover: tw.hover, styles: s.map(e => `${e.state}:${e.style}`) }; })()")
        check(hov['hover'] == RC and 'hover:footprint' in hov['styles'], 'hovering a room label shows the house hover look (the footprint outline) on the room', hov)
        await gm.mouse.click(la['x'], la['y']); await gm.wait_for_timeout(700)
        sel = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()), st = w.selFx.stats().entries.filter(e => e.state === 'selected'), pts = w.selFx.samples('selected');
          const r = {E(RC)}.recipe, b = [Math.min(...pts.map(p => p[0])), Math.max(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[1])), Math.min(...pts.map(p => p[2])), Math.max(...pts.map(p => p[2]))];
          return {{ sel: tw.sel.has('{RC}'), st, n: pts.length, b: b.map(v => +v.toFixed(2)), want: [r.x * 5, (r.x + r.w) * 5, 0, 9, r.z * 5, (r.z + r.d) * 5], preset: w.selFx.params().name, sp: w.selFx.params().selected, sig: tw.signals().filter(s => s.id === '{RC}') }}; }})()""")
        b, wnt = sel['b'], sel['want']
        check(sel['sel'] and len(sel['st']) == 1 and sel['st'][0]['style'] == 'brackets' and sel['st'][0]['drawn'] and sel['st'][0]['depthTest'] and sel['st'][0]['ghost'], 'clicking the label selects the room; it is drawn with the house SELECTED style (corner brackets, depth-tested, ghosted through walls)', sel['st'])
        check(sel['preset'] == 'harry-v1' and sel['sp']['dials']['brackets']['corners'] == 'both' and abs(sel['sp']['dials']['brackets']['speed'] - 0.4) < 1e-6 and abs(sel['sp']['ghost'] - 0.1) < 1e-6, 'it is the house preset harry-v1: brackets top and bottom, breathing at 0.4 Hz, ghost 10%', f"{sel['preset']} {sel['sp']['dials']['brackets']}")
        check(wnt[0] - 2 <= b[0] <= wnt[0] and wnt[1] <= b[1] <= wnt[1] + 2 and wnt[4] - 2 <= b[4] <= wnt[4] and wnt[5] <= b[5] <= wnt[5] + 2 and b[2] < 1 and 8.5 < b[3] < 10.5, 'the brackets stand round the room\'s VOLUME: its rectangle just outside the walls, floor to wall top', f'drawn {b} · room {wnt}')
        await gm.screenshot(path=os.path.join(SHOTS, 'rooms-01-selected.png'))

        print('DICE: the re-roll button')
        ring = await gm.evaluate("""(() => { const bs = [...document.querySelectorAll('#ring .rbtn')]; const rr = document.querySelector('#ring [data-cmd="room.reroll"]');
          return { cmds: bs.map(b => b.dataset.cmd || 'menu'), dice: !!rr && ((rr.innerHTML.includes('M12 12h.01') && rr.innerHTML.includes('rx="2"') && rr.querySelectorAll('path').length === 5) || /room\.reroll/.test(rr.querySelector('img.paint')?.src || '')), title: rr?.title }; })()""")  # (or the house ring's painted re-roll picture: two dice)
        check(sorted(ring['cmds']) == ['menu', 'room.reroll', 'room.rotate', 'thing.hide'] and ring['dice'], "a room's ring: turn · re-roll · hide · ☰, and re-roll is a die (five pips)", ring)

        print('TURN: 90 degrees about the centre, contents with it, nothing re-rolled')
        # what the user did to room C first: moved one thing, pinned another, deleted a third, added a crate by hand
        prep = await gm.evaluate(f"""(async () => {{ const os = {OBJS(RC)}.filter(o => !o.parent && o.place === 'floor' && !o.flat); const [m, p, d] = os;
          const r = {E(RC)}.recipe, cx = (r.x + r.w / 2) * 5, cz = (r.z + r.d / 2) * 5;
          tw.dispatch('object.move', {{ id: m.id, x: cx + 3.5, z: cz - 1.5, rot: 0.4 }}); tw.flag([p.id], {{ pinned: true }}); tw.dispatch('object.delete', {{ id: d.id }});
          const sz = tw.roomgen.sizeOf('crate'); tw.dispatch('object.place', {{ id: 'obj_handcrate01', name: 'crate', cat: 'crate', sku: sz.sku, url: sz.url, place: 'floor', x: cx - 4, z: cz + 2, dims: sz.dims, s: sz.s || undefined, yaw: sz.yaw, room: '{RC}' }});
          return {{ moved: m.id, pinned: p.id, gone: d.id, cx, cz }}; }})()""")
        await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(300)
        before = json.loads(await gm.evaluate(SNAP(RC))); rel0 = await gm.evaluate(REL(RC)); rect0 = await gm.evaluate(RECT(RC))
        await gm.evaluate(FRAME, [150, 58, 0.6])  # (the world-sized ring: on screen, clear of the top bar)
        await gm.click('#ring [data-cmd="room.rotate"]')
        await wait(gm, f"{E(RC)}.recipe.turn === 1 && tw.sync.pendingCount() === 0", 8000, 'turned'); await gm.wait_for_timeout(400)
        rect1 = await gm.evaluate(RECT(RC)); after = json.loads(await gm.evaluate(SNAP(RC))); rel1 = await gm.evaluate(REL(RC))
        check(rect1[2:4] == [rect0[3], rect0[2]] and rect1[4] == 1 and abs((rect1[0] + rect1[2] / 2) - (rect0[0] + rect0[2] / 2)) <= 0.5 and abs((rect1[1] + rect1[3] / 2) - (rect0[1] + rect0[3] / 2)) <= 0.5, 'the ring\'s turn button turns the room a quarter turn about its centre, snapped to the grid', f'{rect0} → {rect1}')
        mv = next(o for o in after if o[0] == prep['moved']); c1 = [(rect1[0] + rect1[2] / 2) * 5, (rect1[1] + rect1[3] / 2) * 5]
        check([o[0] for o in after] == [o[0] for o in before] and rel_same(rel0, rel1), 'the layout is preserved, not re-rolled: the same things, each as far from the centre as before', f'{len(after)} things')
        check(abs(mv[1] - (c1[0] + 1.5)) < 0.02 and abs(mv[2] - (c1[1] + 3.5)) < 0.02 and abs(mv[3] - (0.4 - math.pi / 2)) < 0.002, 'the thing the user moved went where a quarter turn puts it (east of centre → south of centre), facing a quarter turn round', mv)
        st = await gm.evaluate(f"({{ pinned: !!{E(prep['pinned'])}?.pinned, gone: !{E(prep['gone'])}, crate: !!{E('obj_handcrate01')} && {E('obj_handcrate01')}.room === '{RC}', inside: {OBJS(RC)}.every(o => {{ const r = {E(RC)}.recipe; return o.x > r.x * 5 - 0.6 && o.x < (r.x + r.w) * 5 + 0.6 && o.z > r.z * 5 - 0.6 && o.z < (r.z + r.d) * 5 + 0.6; }}) }})")
        check(st['pinned'] and st['gone'] and st['crate'] and st['inside'], 'pinned stays pinned, deleted stays deleted, the hand-placed crate came along, everything is inside the turned room', st)
        await wait(pl, f"{E(RC)}?.recipe.turn === 1", 8000, 'player sees the turn'); await pl.wait_for_timeout(300)
        check(json.loads(await pl.evaluate(SNAP(RC))) == after and await pl.evaluate(RECT(RC)) == rect1, 'the player tab has the same turned room, thing for thing')
        shell = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), r = {E(RC)}.recipe; const mine = [...w.shell.values()].filter(s => s.roomId === '{RC}'); const walls = mine.filter(s => s.spec.layer !== 'floor'), fl = mine.filter(s => s.spec.layer === 'floor'); return {{ floors: fl.length, want: r.w * r.d, walls: walls.length, doors: [...w.edges.values()].filter(e => e.kind === 'door' && e.sides.some(s => s.room === '{RC}')).length, sel: tw.sel.has('{RC}'), brackets: w.selFx.stats().entries.filter(e => e.state === 'selected' && e.drawn).length }}; }})()")
        check(shell['floors'] == shell['want'] and shell['walls'] >= 2 * (rect1[2] + rect1[3]) and shell['doors'] >= 1 and shell['sel'] and shell['brackets'] == 1, 'floor and walls re-formed round the turned rectangle, with a door; the room is still selected and bracketed', shell)
        await gm.screenshot(path=os.path.join(SHOTS, 'rooms-02-turned.png'))
        # keys: R turns on, Shift+R turns back; four turns come home; undo restores
        await gm.keyboard.press('r'); await wait(gm, f"{E(RC)}.recipe.turn === 2", 6000, 'R')
        await gm.keyboard.press('Shift+R'); await wait(gm, f"{E(RC)}.recipe.turn === 1", 6000, 'Shift+R')
        check(json.loads(await gm.evaluate(SNAP(RC))) == after and await gm.evaluate(RECT(RC)) == rect1, 'R turns the selected room on, Shift+R back: exactly where it was')
        for _ in range(3): await gm.keyboard.press('r'); await gm.wait_for_timeout(350)
        await wait(gm, f"({E(RC)}.recipe.turn || 0) === 0 && tw.sync.pendingCount() === 0", 6000, 'four turns')
        home = json.loads(await gm.evaluate(SNAP(RC)))
        check(await gm.evaluate(RECT(RC)) == rect0 and all(abs(a[1] - b[1]) < 0.03 and abs(a[2] - b[2]) < 0.03 for a, b in zip(home, before)), 'four quarter turns bring the room and everything in it home')
        await gm.keyboard.press('Control+z'); await wait(gm, f"{E(RC)}.recipe.turn === 3", 6000, 'undo')
        check(await gm.evaluate(f"{E(RC)}.recipe.turn") == 3, 'undo steps one turn back')
        await gm.keyboard.press('r'); await wait(gm, f"({E(RC)}.recipe.turn || 0) === 0 && tw.sync.pendingCount() === 0", 6000)
        # refusal: the storeroom (5 × 3) turned would reach into the privy just south of it
        seq0 = await gm.evaluate('tw.seq()')
        await gm.evaluate(f"tw.moveBy([{E(RC)}], 0, 5)"); await wait(gm, f"{E(RC)}.recipe.z === 4 && tw.sync.pendingCount() === 0", 6000); await gm.wait_for_timeout(300)
        rect_b = await gm.evaluate(RECT(RC)); seq1 = await gm.evaluate('tw.seq()')
        await gm.evaluate(FRAME, [150, 58, 0.6]); seq1 = await gm.evaluate('tw.seq()')
        await gm.click('#ring [data-cmd="room.rotate"]'); await gm.wait_for_timeout(350)
        ref = await gm.evaluate(f"({{ toast: document.querySelector('#toast').textContent, bad: document.querySelector('#toast').classList.contains('bad') && document.querySelector('#toast').classList.contains('show'), ref: tw.lastRefusal, flashes: tw.worldOf(tw.area()).flashes?.length || 0, rect: {RECT(RC)}, seq: tw.seq() }})")
        check(ref['rect'] == rect_b and ref['seq'] == seq1 and ref['bad'] and "Can't turn" in ref['toast'] and 'overlap' in ref['toast'] and ref['ref'] and ref['ref']['hit'] == RD and ref['flashes'] >= 1, 'a turn that would overlap another room is REFUSED with visible feedback (a red toast naming the room, the would-be footprint flashed red); nothing changes', {k: ref[k] for k in ('toast', 'flashes', 'rect')})
        await gm.screenshot(path=os.path.join(SHOTS, 'rooms-03-turn-refused.png'))
        st_, r_ = get(f"{relay}/c/{CID}/a/{T1}/do?cmd=room.rotate&id={RC}&turns=1&nonce=rot-refuse&seat={await gm.evaluate('tw.sync.token')}")
        check(r_.get('ok') is False and 'overlap' in (r_.get('why') or ''), 'the relay refuses the same turn sent straight to the command door (GET)', r_.get('why'))

        print('DRAG: by the label, on the grid, footprint shown, the other tab watches')
        await gm.keyboard.press('Escape'); await view(gm, 60, 32, 150); await gm.wait_for_timeout(200)
        la = await label_at(gm, RC); r0 = await gm.evaluate(RECT(RC))
        cxz = [(r0[0] + r0[2] / 2) * 5, (r0[1] + r0[3] / 2) * 5]
        a = await scr(gm, cxz[0], cxz[1], 10.2); bpt = await scr(gm, cxz[0] + 26, cxz[1] - 12, 10.2)  # 26 ft east, 12 north: snaps to 25, -10
        probe = await gm.evaluate(f"{OBJS(RC)}.find(o => !o.parent).id")
        await gm.mouse.move(la['x'], la['y']); await gm.mouse.down()
        for i in range(1, 13):
            await gm.mouse.move(la['x'] + (bpt['x'] - a['x']) * i / 12, la['y'] + (bpt['y'] - a['y']) * i / 12); await gm.wait_for_timeout(45)
        await gm.wait_for_timeout(700)
        mid = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), d = tw.roomDrag, pl = [...(w.dragPlates || new Map()).values()][0], e = {E(probe)}, dr = tw.drawn('{probe}'); return {{ d, sel: tw.sel.has('{RC}'), plates: w.dragPlates?.size || 0, plate: pl && [pl.position.x, pl.position.z, pl.scale.x, pl.scale.z, '#' + pl.material.color.getHexString()], rides: dr && [+(dr[0] - e.x).toFixed(2), +(dr[1] - e.z).toFixed(2)], shell: [...w.shell.values()].filter(s => s.roomId === '{RC}' && s.shifted).length, label: document.querySelector('#modeLabel').hidden ? null : document.querySelector('#modeLabel').textContent, my: tw.myColor() }}; }})()")
        check(mid['sel'] and mid['d'] and mid['d']['ok'] and mid['d']['dx'] % 5 == 0 and mid['d']['dz'] % 5 == 0 and (mid['d']['dx'], mid['d']['dz']) != (0, 0), 'pressing a room\'s label and dragging selects the room and drags it, snapped to the 5-ft grid', mid['d'])
        check(mid['plates'] == 1 and mid['plate'] and abs(mid['plate'][0] - (cxz[0] + mid['d']['dx'])) < 0.01 and abs(mid['plate'][2] - r0[2] * 5) < 0.01 and mid['plate'][4].lower() == mid['my'].lower() and mid['label'] and 'ft' in mid['label'], 'while dragging, the room\'s footprint shows where it would land, in my colour (the drop is valid), with a readout', f"{mid['plate']} · “{mid['label']}”")
        check(mid['rides'] == [mid['d']['dx'], mid['d']['dz']] and mid['shell'] > 10, 'the room\'s things and its floor and walls ride along during the drag', f"thing offset {mid['rides']}, {mid['shell']} shell pieces")
        await wait(pl, f"tw.worldOf(tw.area()).roomShifts?.has('{RC}')", 6000, 'player sees the drag'); await pl.wait_for_timeout(900)
        pm = await pl.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), s = w.roomShifts.get('{RC}'), e = {E(probe)}, dr = tw.drawn('{probe}'), p = [...(w.dragPlates || new Map()).values()][0]; return {{ s: s && [+s.dx.toFixed(1), +s.dz.toFixed(1)], rides: dr && [+(dr[0] - e.x).toFixed(1), +(dr[1] - e.z).toFixed(1)], plate: !!p, color: p && '#' + p.material.color.getHexString(), recipe: {RECT(RC)} }}; }})()")
        check(pm['s'] == [mid['d']['dx'], mid['d']['dz']] and pm['rides'] == pm['s'] and pm['plate'] and pm['color'].lower() == mid['my'].lower() and pm['recipe'] == r0, 'the OTHER tab sees the drag in progress through presence: the room\'s footprint in the dragger\'s colour, its things riding along, nothing committed yet', pm)
        await gm.screenshot(path=os.path.join(SHOTS, 'rooms-04-dragging.png'))
        await gm.mouse.up()
        await wait(gm, f"JSON.stringify({RECT(RC)}) !== '{json.dumps(r0).replace(' ', '')}' && tw.sync.pendingCount() === 0", 8000, 'dropped'); await gm.wait_for_timeout(300)
        r1 = await gm.evaluate(RECT(RC)); dcell = [mid['d']['dx'] // 5, mid['d']['dz'] // 5]
        gone_ = await wait(gm, "(tw.worldOf(tw.area()).dragPlates?.size || 0) === 0 && document.querySelector('#modeLabel').hidden", 6000, 'footprint gone')
        check(r1 == [r0[0] + dcell[0], r0[1] + dcell[1], r0[2], r0[3], r0[4]] and rel_same(await gm.evaluate(REL(RC)), rel0) and gone_, 'dropping commits ONE move: the room is at the snapped place with everything in it, and the footprint is gone', f'{r0} → {r1}')
        await wait(pl, f"JSON.stringify({RECT(RC)}) === '{json.dumps(r1).replace(' ', '')}'", 8000, 'player move'); await pl.wait_for_timeout(600)
        check(json.loads(await pl.evaluate(SNAP(RC))) == json.loads(await gm.evaluate(SNAP(RC))) and await pl.evaluate(f"!tw.worldOf(tw.area()).roomShifts?.has('{RC}')"), 'the player tab has the moved room, thing for thing, and the drag signal is gone')
        # an invalid drop: onto the common room
        la = await free_label_at(gm, RC) or await label_at(gm, RC); rk = await gm.evaluate(RECT(RB))
        a = await scr(gm, (r1[0] + r1[2] / 2) * 5, (r1[1] + r1[3] / 2) * 5, 10.2); t = await scr(gm, (rk[0] + rk[2] / 2) * 5, (rk[1] + rk[3] / 2) * 5, 10.2)
        await gm.mouse.move(la['x'], la['y']); await gm.mouse.down()
        for i in range(1, 13):
            await gm.mouse.move(la['x'] + (t['x'] - a['x']) * i / 12, la['y'] + (t['y'] - a['y']) * i / 12); await gm.wait_for_timeout(45)
        await gm.wait_for_timeout(400)
        bad = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()), p = [...(w.dragPlates || new Map()).values()][0]; return { d: tw.roomDrag, color: p && '#' + p.material.color.getHexString(), label: document.querySelector('#modeLabel').textContent }; })()")
        await gm.screenshot(path=os.path.join(SHOTS, 'rooms-05-drag-invalid.png'))
        seq_b = await gm.evaluate('tw.seq()'); await gm.mouse.up(); await gm.wait_for_timeout(500)
        aft = await gm.evaluate(f"({{ rect: {RECT(RC)}, seq: tw.seq(), toast: document.querySelector('#toast').textContent, bad: document.querySelector('#toast').classList.contains('bad') }})")
        check(bad['d'] and bad['d']['ok'] is False and bad['d']['clash'] in (RA, RB) and bad['color'] == '#e5484d' and 'overlaps' in bad['label'], 'dragged over another room, the footprint turns red and the readout says which room it overlaps', bad)
        check(aft['rect'] == r1 and aft['seq'] == seq_b and aft['bad'] and "Can't move" in aft['toast'], 'dropping there is refused, visibly (a red toast); the room stays where it was', aft['toast'])
        # by the floor, once selected (as before)
        spot = await gm.evaluate(f"(() => {{ const r = {E(RC)}.recipe, w = tw.worldOf(tw.area()); for (let x = r.x * 5 + 1.5; x < (r.x + r.w) * 5 - 1; x += 1) for (let z = r.z * 5 + 1.5; z < (r.z + r.d) * 5 - 1; z += 1) {{ const p = tw.screenOf(x, z), hits = w.pickAll(tw.rayAt(p.x, p.y)); if (hits.length && hits.every(h => h.floor)) return [x, z]; }} return null; }})()")
        fa = await scr(gm, spot[0], spot[1]); fb = await scr(gm, spot[0] - 10, spot[1])
        await gm.mouse.move(fa['x'], fa['y']); await gm.mouse.down()
        for i in range(1, 9): await gm.mouse.move(fa['x'] + (fb['x'] - fa['x']) * i / 8, fa['y'] + (fb['y'] - fa['y']) * i / 8); await gm.wait_for_timeout(40)
        await gm.mouse.up(); await wait(gm, f"{E(RC)}.recipe.x === {r1[0] - 2} && tw.sync.pendingCount() === 0", 8000, 'floor drag')
        check(await gm.evaluate(f"{E(RC)}.recipe.x") == r1[0] - 2, 'a selected room still drags by its floor')

        print('HIDE: a hidden room is not sent to players; the GM sees it in the hidden treatment')
        tok_gm = await gm.evaluate("tw.createSeat({ kind: 'llm', name: 'Assistant', color: '#b48cff', scope: { areas: '*', classes: ['token.move', 'object', 'room', 'chat'] } })")
        tok_ad = await pl.evaluate("tw.createSeat({ kind: 'llm', name: 'Advisor', color: '#5ad0c0', scope: { areas: '*', classes: ['token.move', 'chat'] } })")
        # hide the COMMON ROOM (it shares a wall, with a connecting door, with the guest room)
        shared = await gm.evaluate(f"[...tw.worldOf(tw.area()).edges.values()].filter(e => e.sides.length === 2 && e.sides.some(s => s.room === '{RA}') && e.sides.some(s => s.room === '{RB}')).map(e => [e.key, e.kind])")
        check(len(shared) == 4 and any(k == 'door' for _, k in shared), 'before: the guest room and the common room share a wall with a connecting door', shared)
        lb = await label_at(gm, RB); await gm.mouse.click(lb['x'], lb['y']); await gm.wait_for_timeout(300)
        await gm.evaluate(FRAME, [150, 58, 0.6])
        await gm.click('#ring [data-menu]'); await gm.wait_for_timeout(200)
        top = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn.ex')].map(b => b.dataset.cmd || '▸' + b.dataset.group)")
        fly = await gm.evaluate("({ f: tw.ringFlyout(), hide: document.querySelector('#ring .rbtn:not(.ex)[data-cmd=\"thing.hide\"]')?.getAttribute('aria-label') })")
        check(not fly['f'] and 'thing.hide' not in top and (fly['hide'] or '').startswith('Hide from players'), "a room's primary ring has the hide toggle without a duplicate behind ☰, named for what it will do: “Hide from players”", f"top {top}")
        await gm.click('#ring [data-menu]'); await gm.wait_for_timeout(200)
        n_b = await gm.evaluate(f"{OBJS(RB)}.length")
        await gm.click('#ring .rbtn:not(.ex)[data-cmd="thing.hide"]')
        await wait(gm, f"{E(RB)}.hidden === true && tw.sync.pendingCount() === 0", 8000, 'hidden'); await gm.wait_for_timeout(900)
        g = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()), mine = [...w.shell.values()].filter(s => s.roomId === '{RB}');
          const hid = tw.signals().filter(s => String(s.id).startsWith('shell:')).length, st = w.selFx.stats().entries.filter(e => e.state === 'hidden');
          return {{ objs: {OBJS(RB)}.length, allHidden: {OBJS(RB)}.every(o => o.hidden), shell: mine.length, shellHidden: mine.every(s => s.hidden), hidSignals: hid, tint: st.length && st.every(e => e.style === 'tint'), ghost: mine.filter(s => s.ghost).length,
            label: tw.labelInfo().find(l => l.id === '{RB}'), pills: [...w.recs.values()].filter(r => r.entity.room === '{RB}' && r.group.children.some(c => c.userData.hiddenPill)).length, flyoutClosed: !tw.ringFlyout() }}; }})()""")
        check(g['objs'] == n_b and g['allHidden'] and g['shell'] > 20 and g['shellHidden'], 'GM: the room and everything in it are flagged hidden; its floor and walls are still drawn', {k: g[k] for k in ('objs', 'shell')})
        check(g['hidSignals'] >= g['shell'] * 0.8 and g['tint'] and g['ghost'] >= g['shell'] * 0.8 and g['label']['hidden'] and g['pills'] == 0, 'GM: the hidden treatment (the house tint wash) lies on its floor and walls as on hidden things; the label wears the hidden mark; no "Hidden" pill on every chair', {k: g[k] for k in ('hidSignals', 'ghost', 'pills')})
        check(g['flyoutClosed'] and not await gm.evaluate("!!document.querySelector('#ring [data-menu].open')"), 'choosing an option folds the open ring away')
        await gm.screenshot(path=os.path.join(SHOTS, 'rooms-06-hidden-gm.png'))
        await wait(pl, f"!{E(RB)}", 8000, 'player lost the room'); await pl.wait_for_timeout(1200)
        pv = await pl.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()), all = JSON.stringify(tw.entities()), conf = JSON.stringify([...tw.sync.areas.get(tw.area()).confirmed ? Object.values(tw.sync.areas.get(tw.area()).confirmed.entities) : []]);
          return {{ room: !!{E(RB)}, objs: {OBJS(RB)}.length, trace: all.includes('{RB}') || conf.includes('{RB}'), shell: [...w.shell.values()].filter(s => s.roomId === '{RB}').length, recs: [...w.recs.values()].filter(r => r.entity.room === '{RB}' || r.entity.id === '{RB}').length,
            wall: {json.dumps([k for k, _ in shared])}.map(k => {{ const e = w.edges.get(k); return e ? [e.kind, e.sides.length, e.owner.room === '{RA}', !!(w.shell.get(k) || w.shell.get(k + ':door'))] : null; }}) }}; }})()""")
        check(not pv['room'] and pv['objs'] == 0 and not pv['trace'] and pv['shell'] == 0 and pv['recs'] == 0, 'PLAYER: nothing of the hidden room arrives: no room, no contents, no walls or floor, not even its id', {k: pv[k] for k in ('room', 'objs', 'trace', 'shell', 'recs')})
        check(all(w and w[1] == 1 and w[2] and w[3] and w[0] in ('wall', 'window', 'door') for w in pv['wall']), 'PLAYER: the wall the guest room shared with it is whole: the guest room\'s own outside wall, a piece on every segment (no hole into nothing)', pv['wall'])
        gv = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); return {json.dumps([k for k, _ in shared])}.map(k => {{ const e = w.edges.get(k); return e ? [e.kind, e.sides.length, e.owner.room === '{RA}', !!(w.shell.get(k) || w.shell.get(k + ':door'))] : null; }}); }})()")
        vis_sig = "JSON.stringify([...tw.worldOf(tw.area()).shell.values()].filter(s => !s.hidden && s.spec.layer !== 'floor').map(s => `${s.key}|${s.sig}`).sort())"
        check(gv == pv['wall'] and await gm.evaluate(vis_sig) == await pl.evaluate(vis_sig), 'GM and player see the SAME walls, doors and windows on everything that is not hidden (the shared wall included)', gv)
        await pl.screenshot(path=os.path.join(SHOTS, 'rooms-07-hidden-player.png'))
        s1, a1 = get(f"{relay}/c/{CID}/a/{T1}/state?seat={tok_gm}"); s2, a2 = get(f"{relay}/c/{CID}/a/{T1}/state?seat={tok_ad}")
        check(any(r['id'] == RB and r.get('hidden') for r in a1.get('rooms', [])) and not any(r['id'] == RB for r in a2.get('rooms', [])) and RB not in json.dumps(a2), "AI seats inherit their creator's view: the GM's assistant reads the hidden room, the player's advisor gets no trace of it", f"gm-agent rooms {len(a1.get('rooms', []))}, player-agent rooms {len(a2.get('rooms', []))}")
        # hidden things in a hidden room stay hidden while the GM works on it: turn it, drag it
        await gm.keyboard.press('r'); await wait(gm, f"{E(RB)}.recipe.turn === 1 && tw.sync.pendingCount() === 0", 6000); await gm.wait_for_timeout(500)
        check(await pl.evaluate(f"!JSON.stringify(tw.entities()).includes('{RB}') && tw.worldOf(tw.area()).shell.size > 0 && !tw.worldOf(tw.area()).roomShifts?.size"), 'the GM turning the hidden room sends the player nothing')
        await gm.keyboard.press('Shift+R'); await wait(gm, f"({E(RB)}.recipe.turn || 0) === 0 && tw.sync.pendingCount() === 0", 6000)
        # reveal directly from the primary ring
        await gm.wait_for_timeout(200)
        rv = await gm.evaluate("document.querySelector('#ring .rbtn:not(.ex)[data-cmd=\"thing.hide\"]')?.getAttribute('aria-label')")
        await gm.click('#ring .rbtn:not(.ex)[data-cmd="thing.hide"]')
        await wait(gm, f"{E(RB)}.hidden === false && tw.sync.pendingCount() === 0", 8000, 'revealed'); await wait(pl, f"!!{E(RB)} && {OBJS(RB)}.length === {n_b}", 8000, 'player has it back'); await pl.wait_for_timeout(900); await gm.wait_for_timeout(600)
        back = await pl.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); return {{ objs: {OBJS(RB)}.length, shell: [...w.shell.values()].filter(s => s.roomId === '{RB}').length, door: [...w.edges.values()].some(e => e.kind === 'door' && e.sides.length === 2 && e.sides.some(s => s.room === '{RA}') && e.sides.some(s => s.room === '{RB}')) }}; }})()")
        gb = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); return {{ hid: tw.signals().filter(s => String(s.id).startsWith('shell:')).length, ghost: [...w.shell.values()].filter(s => s.ghost).length, label: tw.labelInfo().find(l => l.id === '{RB}').hidden }}; }})()")
        check((rv or '').startswith('Reveal to players') and back['objs'] == n_b and back['shell'] > 20 and back['door'], 'the toggle now reads “Reveal to players”; revealing gives the player the whole room back, and the connecting door re-forms', back)
        check(gb['hid'] == 0 and gb['ghost'] == 0 and not gb['label'], 'GM: the hidden treatment is gone from the revealed room', gb)
        check(await gm.evaluate(vis_sig) == await pl.evaluate(vis_sig), 'after the reveal both tabs again draw identical walls')

        print('CASCADE: room hide carries only its visible non-player pawns')
        player_id = await pl.evaluate('tw.me()')
        center = await gm.evaluate(f"(() => {{ const r = {E(RB)}.recipe; return [(r.x + r.w / 2) * 5, (r.z + r.d / 2) * 5]; }})()")
        cx, cz = center
        cascade_ids = ['tok_cascade001', 'tok_cascade002', 'tok_cascade003', 'tok_cascade004', 'tok_cascade005']
        await gm.evaluate("""([x,z,owner]) => tw.batch([
          { type: 'token.create', args: { id: 'tok_cascade001', name: 'Cascade guard', x, z } },
          { type: 'token.create', args: { id: 'tok_cascade002', name: 'Already hidden guard', x:x+1, z, hidden:true } },
          { type: 'token.create', args: { id: 'tok_cascade003', name: 'Player hero', x, z:z+1, owner } },
          { type: 'token.create', args: { id: 'tok_cascade004', name: 'Player familiar', x:x+1, z:z+1, owner } }
        ])""", [cx, cz, player_id])
        await wait(gm, "!!tw.entities().tok_cascade004 && tw.sync.pendingCount() === 0", 8000)
        await wait(pl, "!!tw.entities().tok_cascade001 && !!tw.entities().tok_cascade004", 8000)
        await gm.evaluate(f"tw.setHidden([tw.entities()['{RB}']], true)")
        note = await gm.locator('#toast').inner_text()
        await wait(gm, "tw.entities().tok_cascade001.hidden && tw.sync.pendingCount() === 0", 8000)
        await wait(pl, "!tw.entities().tok_cascade001", 8000)
        check(await gm.evaluate("tw.entities().tok_cascade001.hidden && tw.entities().tok_cascade002.hidden && !tw.entities().tok_cascade003.hidden && !tw.entities().tok_cascade004.hidden") and await pl.evaluate("!tw.entities().tok_cascade001 && !tw.entities().tok_cascade002 && !!tw.entities().tok_cascade003 && !!tw.entities().tok_cascade004"), 'room hides NPCs but both player-owned pawns stay visible in both seats')
        check(note == '2 player pawns are in this room', 'GM gets the clear player-pawn exception note', note)
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Control+z')
        restored = await wait(pl, "!!tw.entities().tok_cascade001", 8000)
        gm_restored = await wait(gm, f"!{E(RB)}.hidden && !tw.entities().tok_cascade001.hidden && tw.entities().tok_cascade002.hidden", 8000)
        check(restored and gm_restored, 'one undo restores room and cascade together; pre-hidden pawn stays hidden', await gm.evaluate(f"[!!{E(RB)}.hidden, !!tw.entities().tok_cascade001.hidden, !!tw.entities().tok_cascade002.hidden, tw.sync.pendingCount()]"))
        await gm.evaluate(f"tw.setHidden([tw.entities()['{RB}']], true)")
        await wait(gm, "tw.sync.pendingCount() === 0", 8000)
        await gm.evaluate("([x,z]) => tw.dispatch('token.create', { id:'tok_cascade005', name:'Ambush reinforcement', x, z })", [cx-1, cz])
        await wait(gm, "!!tw.entities().tok_cascade005 && tw.sync.pendingCount() === 0", 8000)
        await pl.wait_for_timeout(350)
        check(await gm.evaluate("tw.entities().tok_cascade005.hidden") and await pl.evaluate("!tw.entities().tok_cascade005 && !JSON.stringify(tw.sync.areas.get(tw.area()).confirmed).includes('Ambush reinforcement')"), 'placed into hidden room arrives hidden, absent even from player confirmed state')
        await gm.evaluate("tw.dispatch('token.move', { id:'tok_cascade005', x:150, z:150 })")
        await wait(gm, "tw.entities().tok_cascade005.x === 150 && tw.sync.pendingCount() === 0", 8000)
        check(await gm.evaluate("tw.entities().tok_cascade005.hidden") and await pl.evaluate("!tw.entities().tok_cascade005"), 'GM moving a pawn out keeps it hidden')
        await gm.reload(); await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000)
        check(await gm.evaluate("tw.entities().tok_cascade001.hidden && tw.entities().tok_cascade002.hidden"), 'reloaded GM retains room cascade state')
        await gm.evaluate(f"tw.setHidden([tw.entities()['{RB}']], false)")
        await wait(gm, "!tw.entities().tok_cascade001.hidden && tw.sync.pendingCount() === 0", 8000)
        await wait(pl, "!!tw.entities().tok_cascade001", 8000)
        check(await gm.evaluate("tw.entities().tok_cascade002.hidden && tw.entities().tok_cascade005.hidden") and await pl.evaluate("!!tw.entities().tok_cascade001 && !tw.entities().tok_cascade002 && !tw.entities().tok_cascade005"), 'reveal after reload restores only cascade pawn still in the room; pre-hidden and moved-out pawns stay hidden')
        building_id = await gm.evaluate(f"{E(RB)}.building")
        await gm.evaluate("id => tw.setHidden([tw.entities()[id]], true)", building_id)
        await wait(gm, "tw.entities().tok_cascade001.hidden && tw.sync.pendingCount() === 0", 8000)
        check(await wait(pl, "!tw.entities().tok_cascade001", 8000) and await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.kind === 'room' && e.building === '{building_id}').every(e => e.hidden)"), 'building Hide carries all its rooms and NPCs')
        await gm.evaluate("id => tw.setHidden([tw.entities()[id]], false)", building_id)
        check(await wait(pl, "!!tw.entities().tok_cascade001", 8000) and await gm.evaluate("tw.entities().tok_cascade002.hidden"), 'building Reveal preserves separately hidden pawn')
        await gm.evaluate("ids => tw.batch(ids.map(id => ({ type:'token.delete', args:{id} })))", cascade_ids)
        await wait(gm, "!tw.entities().tok_cascade001 && tw.sync.pendingCount() === 0", 8000)
        await view(gm, 60, 32, 150)

        print('PIECES: posts snap to crosses and edge midpoints; Shift frees posts and walls; the turn handle has 45-degree notches')
        await gm.keyboard.press('Escape'); await gm.evaluate('tw.clearSelection()')
        ps = await gm.evaluate("[[10.3, 5.2], [10.3, 7.6], [12.4, 7.4], [12.6, 7.1], [11.2, 6.4], [-0.4, -2.3], [13.9, 9.2]].map(([x, z]) => [[x, z], tw.modes.postSnap(x, z)])")
        on_target = lambda q: (abs(q[0] % 5) < 1e-6 or abs(q[0] % 5 - 5) < 1e-6 or abs(q[1] % 5) < 1e-6 or abs(q[1] % 5 - 5) < 1e-6) and all(abs((v * 2 / 5) - round(v * 2 / 5)) < 1e-6 for v in q)
        near = lambda p_, q: all(math.hypot(p_[0] - q[0], p_[1] - q[1]) <= math.hypot(p_[0] - c[0], p_[1] - c[1]) + 1e-6 for c in [(i * 2.5, j * 2.5) for i in range(-4, 9) for j in range(-4, 9) if not (i % 2 and j % 2)])
        check(all(on_target(q) and near(p_, q) for p_, q in ps) and ps[0][1] == [10, 5] and ps[1][1] == [10, 7.5] and ps[2][1] in ([10, 7.5], [12.5, 5], [15, 7.5], [12.5, 10]), 'a post\'s snap targets are the grid CROSSES and the MIDPOINTS of cell edges (never a cell\'s centre); the nearest wins', ps)
        rc_ = await gm.evaluate(RECT(RC)); PX, PZ = rc_[0] * 5, rc_[1] * 5; pk = f"c{rc_[0]}:{rc_[1]}"
        async def top(x, z, dist=42):
            await gm.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = 89.5; g.yaw = 0; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"); await gm.wait_for_timeout(350)
        async def drag_ground(a, b, shift=False, steps=10, peek=None):
            pa = await scr(gm, a[0], a[1]); pb = await scr(gm, b[0], b[1])
            if shift: await gm.keyboard.down('Shift')
            await gm.mouse.move(pa['x'], pa['y']); await gm.mouse.down()
            for i in range(1, steps + 1): await gm.mouse.move(pa['x'] + (pb['x'] - pa['x']) * i / steps, pa['y'] + (pb['y'] - pa['y']) * i / steps); await gm.wait_for_timeout(35)
            out = await gm.evaluate('tw.moveDrag') if peek is None else await gm.evaluate(peek)
            await gm.mouse.up()
            if shift: await gm.keyboard.up('Shift')
            await wait(gm, 'tw.sync.pendingCount() === 0', 6000); await gm.wait_for_timeout(250)
            return out
        one = "(() => { const e = tw.selected()[0]; return e && { id: e.id, x: e.x, z: e.z, rot: +(e.rot || 0).toFixed(4), cat: e.cat, generated: !!e.generated }; })()"
        check(await gm.evaluate(f"tw.worldOf(tw.area()).shell.has('{pk}')") and await gm.evaluate(f"(() => {{ const e = tw.wallItem('wall:{pk}'); return e.generated && e.place === 'kit' && tw.modes.isPost(e.cat) && e.x === {PX} && e.z === {PZ}; }})()"), 'a room\'s corner post is a post to the snapping rule (a generated piece standing on a grid cross)', pk)
        check(await gm.evaluate("['post-timber', 'pillar-square', 'fence-post-corner', 'wall-drystone-pier', 'hedge-corner', 'hedge-end-block'].every(c => tw.modes.isPost(c)) && !tw.modes.isPost('wall-straight') && !tw.modes.isPost('door-plank')"), 'pillars, a fence\'s corner post, a drystone pier and a hedge\'s corner and end block count as posts too; walls and doors do not')
        # a post standing in the open (at a room's corner the wall over it can take the press instead), on a grid cross
        PX, PZ = 60, 70
        await gm.evaluate(f"(() => {{ const sz = tw.roomgen.sizeOf('post-timber'); tw.dispatch('object.place', {{ id: 'obj_freepost001', name: 'post', cat: 'post-timber', sku: sz.sku, url: sz.url, place: 'kit', layer: 'walls', x: {PX}, z: {PZ}, dims: sz.dims, s: sz.s || undefined, yaw: sz.yaw }}); }})()")
        await wait(gm, "!!tw.entities()['obj_freepost001'] && tw.sync.pendingCount() === 0", 6000); await top(PX - 2, PZ, 42)
        await gm.evaluate("tw.select(['obj_freepost001'])"); await gm.wait_for_timeout(250)
        p0 = await gm.evaluate(one)
        check(p0 and p0['id'] == 'obj_freepost001' and [p0['x'], p0['z']] == [PX, PZ], 'a post placed on a grid cross, selected', p0)
        d1 = await drag_ground((PX, PZ), (PX - 3.4, PZ - 0.3)); p1 = await gm.evaluate(one)
        check(p1 and [p1['x'], p1['z']] == [PX - 2.5, PZ] and d1['single'] and not d1['free'], 'dragged 3.4 ft west, the post snaps to the MIDPOINT of the cell edge there', f"{p1 and (p1['x'], p1['z'])} (during: {d1})")
        d2 = await drag_ground((p1['x'], p1['z']), (p1['x'] - 2.2, p1['z'] - 0.4)); p2 = await gm.evaluate(one)
        check(p2 and [p2['x'], p2['z']] == [PX - 5, PZ], 'dragged on 2.2 ft, it snaps to the next grid CROSS (where the grid lines meet)', p2 and (p2['x'], p2['z']))
        d3 = await drag_ground((p2['x'], p2['z']), (p2['x'] - 1.3, p2['z'] - 1.7), shift=True); p3 = await gm.evaluate(one)
        offgrid = lambda v: abs(v * 2 / 5 - round(v * 2 / 5)) > 0.05
        check(p3 and d3 and d3['free'] and abs(p3['x'] - (p2['x'] - 1.3)) < 0.25 and abs(p3['z'] - (p2['z'] - 1.7)) < 0.25 and offgrid(p3['x']) and offgrid(p3['z']) and [p3['x'], p3['z']] == [d3['single']['x'], d3['single']['z']], 'Shift+drag moves the post FREELY: it stays exactly where the pointer left it, off the grid', f"{p3 and (p3['x'], p3['z'])} (during: {d3})")
        # a wall segment: snapped without Shift, free with it
        wk = f"h:{rc_[0] + 1}:{rc_[1]}"; WX, WZ = (rc_[0] + 1) * 5 + 2.5, rc_[1] * 5
        await top(WX, WZ - 3, 42)
        await gm.keyboard.press('Escape'); await gm.evaluate(f"tw.select(['wall:{wk}'])"); await gm.wait_for_timeout(200)
        w0 = await gm.evaluate(one)
        dw = await drag_ground((WX, WZ), (WX + 0.6, WZ - 6.1)); w1 = await gm.evaluate(one)
        check(w0 and w0['generated'] and w1 and [w1['x'], w1['z']] == [WX, WZ - 5] and not dw['free'] and dw['single']['edge'] == f"h:{rc_[0] + 1}:{rc_[1] - 1}", 'a wall segment dragged without Shift snaps onto the grid edge it lands nearest', f"{w1 and (w1['x'], w1['z'])} {dw}")
        dw2 = await drag_ground((w1['x'], w1['z']), (w1['x'] + 1.3, w1['z'] - 2.1), shift=True); w2 = await gm.evaluate(one)
        check(w2 and dw2['free'] and abs(w2['x'] - (w1['x'] + 1.3)) < 0.25 and abs(w2['z'] - (w1['z'] - 2.1)) < 0.25 and offgrid(w2['x']) and offgrid(w2['z']) and w2['rot'] == w1['rot'], 'Shift+drag moves the wall FREELY: off the grid, where the pointer left it, keeping its facing', f"{w2 and (w2['x'], w2['z'], w2['rot'])}")
        # both at once: the group steps on the grid without Shift, moves freely with it
        await gm.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({(60 + 100) / 2}, 0, 35); g.pitch = 89.5; g.yaw = 0; g.dist = 120; g.update(); }})()"); await gm.wait_for_timeout(350)
        await gm.evaluate(f"tw.select(['{p3['id']}', '{w2['id']}'])"); await gm.wait_for_timeout(200)
        dm = await drag_ground((w2['x'], w2['z']), (w2['x'] + 6.2, w2['z'] - 3.9))
        g1 = await gm.evaluate(f"[{E(p3['id'])}, {E(w2['id'])}].map(e => [e.x, e.z])")
        check(dm and [dm['dx'], dm['dz']] == [5, -5] and all(abs(a_ - b_) < 0.011 for a_, b_ in zip(sum(g1, []), [p3['x'] + 5, p3['z'] - 5, w2['x'] + 5, w2['z'] - 5])), 'a multi-selection of pieces moves as one in whole 5-ft steps without Shift', f'{dm} → {g1}')
        dm2 = await drag_ground((g1[1][0], g1[1][1]), (g1[1][0] + 1.4, g1[1][1] + 0.8), shift=True)
        g2 = await gm.evaluate(f"[{E(p3['id'])}, {E(w2['id'])}].map(e => [e.x, e.z])")
        check(dm2 and dm2['free'] and abs(g2[0][0] - g1[0][0] - 1.4) < 0.25 and abs(g2[0][1] - g1[0][1] - 0.8) < 0.25 and abs((g2[1][0] - g1[1][0]) - (g2[0][0] - g1[0][0])) < 0.011 and offgrid(g2[1][0] - g1[1][0]), 'and freely, together, with Shift', f'{dm2} → {g2}')
        await wait(pl, f"{E(p3['id'])} && Math.abs({E(p3['id'])}.x - {g2[0][0]}) < 0.011 && Math.abs({E(w2['id'])}.z - {g2[1][1]}) < 0.011", 8000, 'player has the free positions')
        check(await pl.evaluate(f"[{E(p3['id'])}, {E(w2['id'])}].map(e => [e.x, e.z])") == g2, 'the off-grid positions reach the second tab exactly', g2)
        await gm.reload(); await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000, 'GM reloaded'); await wait(gm, f"!!{E(p3['id'])}", 15000); await settle(gm, 60000)
        check(await gm.evaluate(f"[{E(p3['id'])}, {E(w2['id'])}].map(e => [e.x, e.z])") == g2, 'and they survive a reload of the page')
        # the turn handle: free, with notches every 45 degrees
        await view(gm, 60, 32, 150); await gm.evaluate(f"tw.select(['obj_handcrate01'])"); await gm.wait_for_timeout(300); await gm.evaluate(FRAME, [110, 52, 0.55])
        async def turn_to(target_deg, hold=None):
            """drag the ring's turn handle so the crate's facing would be target_deg (before any notch catches it)"""
            rb = await gm.evaluate("(() => { const r = document.querySelector('#ring [data-cmd=\"edit.rotate\"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()")
            r0 = await gm.evaluate(f"{E('obj_handcrate01')}.rot || 0")
            await gm.mouse.move(rb['x'], rb['y']); await gm.mouse.down(); await gm.mouse.move(rb['x'] + 4, rb['y'] + 4); await gm.wait_for_timeout(40)
            d = await gm.evaluate('tw.ringDrag()'); cx, cy = d['centre']
            R0 = math.hypot(rb['x'] - cx, rb['y'] - cy); a0 = math.atan2(rb['x'] - cx, -(rb['y'] - cy))
            a1 = a0 + r0 - math.radians(target_deg); n = 14; da = math.atan2(math.sin(a1 - a0), math.cos(a1 - a0)); seen = []
            for i in range(1, n + 1):
                a = a0 + da * i / n; await gm.mouse.move(cx + R0 * math.sin(a), cy - R0 * math.cos(a)); await gm.wait_for_timeout(25)
                seen.append((await gm.evaluate('tw.ringDrag()'))['notch'])
            st = await gm.evaluate("({ d: tw.ringDrag(), on: document.querySelectorAll('#ring .guide .tick.on').length, ro: document.querySelector('#ring .readout')?.innerText })")
            if hold: await gm.screenshot(path=os.path.join(SHOTS, hold))
            await gm.mouse.up(); await wait(gm, 'tw.sync.pendingCount() === 0', 6000); await gm.wait_for_timeout(250)
            return st, math.degrees(await gm.evaluate(f"{E('obj_handcrate01')}.rot || 0")), seen
        st1, deg1, seen1 = await turn_to(92.5, hold='rooms-12-turn-notch.png')   # 2.5 degrees past a notch: it catches
        k1 = deg1 / 45
        check(st1['d']['ticks'] == 8 and st1['d']['notch'] is not None and st1['on'] == 1 and '◆' in (st1['ro'] or '') and abs(k1 - round(k1)) < 1e-9 and round(deg1) % 360 == 90, 'the turn handle shows 8 notch ticks; released within a few degrees of one, the thing lands EXACTLY on that multiple of 45°', f"aimed 92.5°, got {deg1:.6f}° · {st1['ro']} · notches passed {sorted(set(x for x in seen1 if x is not None))}")
        st2, deg2, seen2 = await turn_to(deg1 + 21)                                 # between notches: free
        off = abs(deg2 / 45 - round(deg2 / 45)) * 45
        check(st2['d']['notch'] is None and st2['on'] == 0 and off > 6 and abs(deg2 - (deg1 + 21)) < 3, 'released between notches, it stays at the free angle the pointer chose', f'aimed {deg1 + 21:.1f}°, got {deg2:.2f}° ({off:.1f}° from the nearest notch)')
        st3, deg3, seen3 = await turn_to(deg2 + 150)                                # a long turn passes several notches and is not held by them
        check(len(set(x for x in seen3 if x is not None)) >= 2 and abs(((deg3 - (deg2 + 150) + 180) % 360) - 180) < 4.5, 'a long turn passes through notches without being held (pulling further releases it)', f'aimed {deg2 + 150:.1f}°, got {deg3:.2f}°; caught on the way: {sorted(set(x for x in seen3 if x is not None))}')
        await gm.keyboard.press('Escape'); await gm.evaluate(f"tw.select(['{RC}'])"); await gm.wait_for_timeout(200)
        check(await gm.evaluate("!!document.querySelector('#ring [data-cmd=\"room.rotate\"]') && !document.querySelector('#ring [data-cmd=\"room.rotate\"]').classList.contains('drag')"), 'rooms keep their 90-degree steps (their turn button is a click, not a drag)')

        print('SHAPES: a room drawn over others becomes the part that does not overlap (L-shaped rooms)')
        await gm.keyboard.press('Escape'); await gm.evaluate('tw.clearSelection()')
        C5 = lambda g: g * 5 + 2.5
        async def topcell(gx, gz, dist=95):
            await gm.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({gx * 5}, 0, {gz * 5}); g.pitch = 89.5; g.yaw = 0; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"); await gm.wait_for_timeout(350)
        async def draw(rtype, c0, c1, release=True):
            """the room tool, dragged from cell c0 to cell c1 with the real mouse; returns what it showed while dragging"""
            await gm.evaluate(f"tw.modes.roomTool('{rtype}', {{ tool: true }})")
            a = await scr(gm, C5(c0[0]), C5(c0[1])); b = await scr(gm, C5(c1[0]), C5(c1[1]))
            await gm.mouse.move(a['x'], a['y']); await gm.mouse.down()
            for i in range(1, 11): await gm.mouse.move(a['x'] + (b['x'] - a['x']) * i / 10, a['y'] + (b['y'] - a['y']) * i / 10); await gm.wait_for_timeout(30)
            await gm.wait_for_timeout(250)
            mid = await gm.evaluate("(() => { const P = tw.mode.plan, w = tw.worldOf(tw.area()), c = w.cellMarks?.get('room-tool'); return { kind: P.kind, ok: P.ok, cells: P.piece?.cells || 0, outline: P.piece?.outline || null, pieces: P.pieces || 1, rect: tw.mode.rect, lit: c?.lit.count, dim: c?.dim.count, color: c && '#' + c.lit.material.color.getHexString(), label: document.querySelector('#modeLabel').textContent, bad: document.querySelector('#modeLabel').classList.contains('bad') }; })()")
            if release:
                seq = await gm.evaluate('tw.seq()'); await gm.mouse.up(); await gm.wait_for_timeout(350)
                mid['toast'] = await gm.evaluate("document.querySelector('#toast').classList.contains('show') ? document.querySelector('#toast').textContent : ''")
                mid['toastBad'] = await gm.evaluate("document.querySelector('#toast').classList.contains('bad')")
                await wait(gm, 'tw.sync.pendingCount() === 0', 8000); mid['made'] = await gm.evaluate('tw.seq()') > seq
                mid['marksGone'] = await gm.evaluate("!tw.worldOf(tw.area()).cellMarks?.has('room-tool')")
                await gm.evaluate('tw.modes.cancel()')
            return mid
        ROOMS = "Object.values(tw.entities()).filter(e => e.kind === 'room')"
        byrect = lambda x, z: f"{ROOMS}.find(r => r.recipe.x === {x} && r.recipe.z === {z})"
        # the base rooms, on clear ground well away from the inn
        K = await gm.evaluate("tw.spawnRoom('kitchen', 30, 20, 4, 4, 5101)"); await gm.wait_for_timeout(300)
        K2 = await gm.evaluate("tw.spawnRoom('storeroom', 30, 40, 2, 4, 5102)"); await gm.wait_for_timeout(300)
        K3 = await gm.evaluate("tw.spawnRoom('privy', 45, 19, 1, 3, 5103)"); await gm.wait_for_timeout(300)
        K4 = await gm.evaluate("tw.spawnRoom('privy', 60, 30, 1, 1, 5104)")
        await wait(gm, f"['{K}','{K2}','{K3}','{K4}'].every(id => tw.entities()[id]) && tw.sync.pendingCount() === 0", 20000, 'base rooms'); await settle(gm, 60000)
        n_rooms = await gm.evaluate(f"{ROOMS}.length")
        # L: over the kitchen's south-east corner
        await topcell(35, 24)
        dL = await draw('guest', (32, 22), (37, 25), release=False)
        await gm.screenshot(path=os.path.join(SHOTS, 'rooms-20-drawing-L.png'))
        seq = await gm.evaluate('tw.seq()'); await gm.mouse.up(); await gm.wait_for_timeout(350)
        toastL = await gm.evaluate("document.querySelector('#toast').textContent")
        await wait(gm, f"tw.sync.pendingCount() === 0 && {ROOMS}.length === {n_rooms + 1}", 10000, 'L made'); await gm.evaluate('tw.modes.cancel()'); await settle(gm, 60000)
        check(dL['kind'] == 'shape' and dL['ok'] and dL['cells'] == 20 and dL['outline'] and len(dL['outline']) == 6 and dL['lit'] == 20 and dL['dim'] == 4 and 'does not overlap Kitchen' in dL['label'] and not dL['bad'], 'dragging the room tool over another room\'s corner: the squares that WILL become the room are lit (20), the 4 overlapped squares are only marked, and the readout says so', {k: dL[k] for k in ('kind', 'cells', 'lit', 'dim', 'label', 'color')})
        LID = await gm.evaluate(f"{ROOMS}.find(r => r.recipe.outline && r.recipe.type === 'guest')?.id")
        Linfo = await gm.evaluate(f"""(() => {{ const e = {E(LID)}, rc = e.recipe, F = tw.footprint, w = tw.worldOf(tw.area()), mine = [...w.shell.values()].filter(s => s.roomId === '{LID}'), objs = {OBJS(LID)};
          const lab = tw.labelInfo().find(l => l.id === '{LID}'), lp = F.labelPoint(rc), ls = tw.screenOf(lp[0], lp[1], tw.main, 10.2);
          const inner = F.boundary(rc).filter(b => (b.side === 'N' && b.line !== 0) || (b.side === 'W' && b.line !== 0) || (b.side === 'S' && b.line !== rc.d) || (b.side === 'E' && b.line !== rc.w));
          return {{ rc, cells: F.areaCells(rc), floors: mine.filter(s => /:f\\d+:\\d+$/.test(s.key)).length, floorsInNotch: mine.filter(s => /:f\\d+:\\d+$/.test(s.key) && !F.contains(rc, s.spec.x, s.spec.z)).length,
            objs: objs.length, off: objs.filter(o => !o.parent && !F.contains(rc, o.x, o.z)).map(o => o.cat), inK: objs.filter(o => F.contains({E(K)}.recipe, o.x, o.z) && !F.contains(rc, o.x, o.z)).length,
            inner: inner.map(b => [b.key, w.edges.get(b.key)?.sides.length, !!(w.shell.get(b.key) || w.shell.get(b.key + ':door'))]), post: inner.length && [...w.shell.keys()].filter(k => /^c/.test(k)).length,
            labelIn: F.contains(rc, lp[0], lp[1]), labelAt: lab && lab.rect && Math.hypot((lab.rect[0] + lab.rect[2]) / 2 - ls.x, (lab.rect[1] + lab.rect[3]) / 2 - ls.y) < 60, bboxMidIn: F.contains(rc, (rc.x + rc.w / 2) * 5 - 12, (rc.z + rc.d / 2) * 5 - 7),
            fog: w.fogRooms().find(r => r.id === '{LID}'), hash: tw.hashCheck().find(h => h.room === '{LID}'), bld: e.building === {E(K)}.building }}; }})()""")
        check('Made the part that does not overlap Kitchen' in toastL and Linfo['rc']['outline'] and Linfo['cells'] == 20 and [Linfo['rc']['x'], Linfo['rc']['z'], Linfo['rc']['w'], Linfo['rc']['d']] == [32, 22, 6, 4], 'on release it becomes ONE L-shaped room (its outline stored; x, z, w, d its bounding box), and a message says what was made', f"{toastL} · outline {Linfo['rc']['outline']}")
        check(Linfo['floors'] == 20 and Linfo['floorsInNotch'] == 0, 'floor: a tile on every one of its 20 cells and none in the notch', Linfo['floors'])
        check(Linfo['objs'] > 12 and not Linfo['off'] and Linfo['inK'] == 0 and Linfo['hash']['match'], 'furniture: laid out inside the true shape (nothing in the notch, which is the kitchen); a second solve gives the same layout', f"{Linfo['objs']} things, hash {Linfo['hash']}")
        check(len(Linfo['inner']) == 4 and all(i[1] == 2 and i[2] for i in Linfo['inner']) and Linfo['bld'], 'walls: the inside corner\'s two walls are SHARED with the kitchen (one wall, a piece on every segment); the L joined the kitchen\'s building', Linfo['inner'])
        check(Linfo['labelIn'] and Linfo['labelAt'], 'its label floats over the largest rectangle inside the shape (on its floor, not over the notch)')
        check(Linfo['fog'] and 'poly' in Linfo['fog'] and len(Linfo['fog']['poly']) == 6, 'the fog region for the room is its true outline', Linfo['fog'])
        await gm.screenshot(path=os.path.join(SHOTS, 'rooms-21-L-top.png'))
        await wait(pl, f"!!{E(LID)}", 8000, 'player has the L'); await pl.wait_for_timeout(800)
        check(await pl.evaluate(f"JSON.stringify({E(LID)}.recipe)") == await gm.evaluate(f"JSON.stringify({E(LID)}.recipe)") and json.loads(await pl.evaluate(SNAP(LID))) == json.loads(await gm.evaluate(SNAP(LID))) and await gm.evaluate(vis_sig) == await pl.evaluate(vis_sig), 'the player tab has the same L-shaped room: shape, furniture and walls')
        # selection follows the true shape
        la = await label_at(gm, LID); await gm.mouse.move(la['x'], la['y']); await gm.wait_for_timeout(500)
        hv = await gm.evaluate("tw.worldOf(tw.area()).selFx.stats().entries.filter(e => e.state === 'hover')")
        await gm.mouse.click(la['x'], la['y']); await gm.wait_for_timeout(800)
        sl = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()), st = w.selFx.stats().entries.filter(e => e.state === 'selected'), pts = w.selFx.samples('selected'), rc = {E(LID)}.recipe, K = {E(K)}.recipe;
          const inNotch = pts.filter(p => p[0] > K.x * 5 + 2 && p[0] < (K.x + K.w) * 5 - 2 && p[2] > K.z * 5 + 2 && p[2] < (K.z + K.d) * 5 - 2 && p[0] > rc.x * 5 + 2 && p[2] > rc.z * 5 + 2).length;
          const nearInner = pts.filter(p => Math.hypot(p[0] - (K.x + K.w) * 5, p[2] - (K.z + K.d) * 5) < 2.5).length; return {{ st, n: pts.length, inNotch, nearInner }}; }})()""")
        check(hv and hv[0]['style'] == 'footprint' and hv[0]['segs'] == 6, 'hovering its label outlines the true shape (six sides)', hv)
        check(sl['st'] and sl['st'][0]['style'] == 'brackets' and sl['st'][0]['segs'] == 36 and sl['nearInner'] > 0 and sl['inNotch'] == 0, 'selected, it has a bracket at each of its SIX corners, top and bottom (the inside corner too), and none out in the notch', sl)
        await gm.screenshot(path=os.path.join(SHOTS, 'rooms-22-L-selected.png'))
        aud = await gm.evaluate(AUDIT)
        check(aud['tested'] > 50 and aud['nbad'] == 0, 'everything on screen is touchable (the L-shaped room and the kitchen in its notch)', f"{aud['tested']} points · {aud['nbad']} untouchable {aud['kinds']}")
        # wholly inside another room: refused, and said so
        await gm.keyboard.press('Escape'); await topcell(32, 22)
        dI = await draw('storeroom', (30, 20), (31, 21))
        check(dI['kind'] == 'inside' and not dI['ok'] and dI['lit'] == 0 and dI['dim'] == 4 and dI['bad'] and 'nothing to make' in dI['label'] and not dI['made'] and dI['toastBad'] and 'Nothing to make' in dI['toast'] and dI['marksGone'], 'a room drawn wholly inside another: no square lights, the readout says "nothing to make", and on release it is refused with a message (never a silent no-op)', {k: dI[k] for k in ('kind', 'lit', 'dim', 'label', 'toast')})
        # cut in two by an existing room: the larger part becomes the room
        await topcell(32, 42)
        dS = await draw('hallway', (27, 41), (36, 42))
        sp_ = await gm.evaluate(f"(() => {{ const r = {ROOMS}.filter(r => r.recipe.type === 'hallway').map(r => r.recipe); return r.map(c => [c.x, c.z, c.w, c.d, !!c.outline]); }})()")
        check(dS['kind'] == 'split' and dS['pieces'] == 2 and dS['cells'] == 10 and dS['lit'] == 10 and dS['dim'] == 4 + 6 and 'cuts it in 2' in dS['label'] and dS['made'] and sp_ == [[32, 41, 5, 2, False]] and 'larger part' in dS['toast'], 'a room drawn right across another is cut in two: the LARGER part is lit and becomes the room (the smaller part and the overlap are only marked), and the message says so', {k: dS[k] for k in ('kind', 'pieces', 'cells', 'lit', 'dim', 'label', 'toast')})
        # a room poking into one side: a U (a notched side)
        await topcell(46, 22)
        dU = await draw('common', (43, 20), (48, 24))
        UID = await gm.evaluate(f"{ROOMS}.find(r => r.recipe.type === 'common' && r.recipe.outline)?.id")
        await settle(gm, 60000)
        Uinfo = await gm.evaluate(f"(() => {{ const rc = {E(UID)}.recipe, F = tw.footprint, objs = {OBJS(UID)}; return {{ n: rc.outline.length, cells: F.areaCells(rc), rects: F.rectsOf(rc).length, off: objs.filter(o => !o.parent && !F.contains(rc, o.x, o.z)).length, objs: objs.length, label: F.contains(rc, ...F.labelPoint(rc)) }}; }})()")
        check(dU['kind'] == 'shape' and dU['cells'] == 28 and dU['dim'] == 2 and Uinfo['n'] == 8 and Uinfo['cells'] == 28 and Uinfo['off'] == 0 and Uinfo['objs'] > 15 and Uinfo['label'], 'a room poking into one side leaves a notched room (eight corners): made, furnished inside its shape, labelled on its floor', {**{k: dU[k] for k in ('kind', 'cells', 'dim')}, **Uinfo})
        # right round another room: refused
        await topcell(60, 30, 70)
        dH = await draw('guest', (59, 29), (61, 31))
        check(dH['kind'] == 'hole' and not dH['ok'] and dH['lit'] == 0 and not dH['made'] and dH['toastBad'] and "Can't make a room right round" in dH['toast'], 'a room drawn right round another is refused with a message', {k: dH[k] for k in ('kind', 'label', 'toast')})
        # a plain rectangle on clear ground is exactly what it always was
        await topcell(72, 22, 70)
        dR = await draw('privy', (71, 21), (72, 22))
        check(dR['kind'] == 'rect' and dR['lit'] == 4 and dR['dim'] == 0 and dR['made'] and await gm.evaluate(f"{byrect(71, 21)}.recipe.outline === undefined"), 'on clear ground the tool makes a plain rectangle, with no outline stored', {k: dR[k] for k in ('kind', 'lit', 'label')})
        # the L turns and drags like any room (stage 1), keeping its shape and its furniture
        await view(gm, 180, 120, 170, 60)
        await gm.evaluate(f"tw.select(['{LID}'])"); snapL = json.loads(await gm.evaluate(SNAP(LID)))
        la = await label_at(gm, LID); c0 = await gm.evaluate(f"tw.footprint.labelPoint({E(LID)}.recipe)")
        a_ = await scr(gm, c0[0], c0[1], 10.2); b_ = await scr(gm, c0[0] + 60, c0[1] + 80, 10.2)
        await gm.mouse.move(la['x'], la['y']); await gm.mouse.down()
        for i in range(1, 11): await gm.mouse.move(la['x'] + (b_['x'] - a_['x']) * i / 10, la['y'] + (b_['y'] - a_['y']) * i / 10); await gm.wait_for_timeout(40)
        await gm.wait_for_timeout(400)
        plateL = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()), p = [...(w.dragPlates || new Map()).values()][0]; return p && { shaped: !!p.userData.shaped, tris: p.geometry.attributes.position.count / 3, d: tw.roomDrag }; })()")
        await gm.mouse.up(); await wait(gm, f"{E(LID)}.recipe.x !== 32 && tw.sync.pendingCount() === 0", 8000, 'L dragged'); await gm.wait_for_timeout(300)
        rcL = await gm.evaluate(f"{E(LID)}.recipe")
        check(plateL and plateL['shaped'] and plateL['tris'] == 40 and plateL['d']['ok'] and rcL['outline'] == Linfo['rc']['outline'] and rel_same(await gm.evaluate(REL(LID)), json.dumps(sorted([[o[0], round(math.hypot(o[1] - (32 + 3) * 5, o[2] - (22 + 2) * 5), 1)] for o in snapL]))), 'an L-shaped room drags by its label: the footprint shown is its true shape (20 squares), and it lands with its outline and everything in it', plateL)
        for k in range(1, 5):
            await gm.keyboard.press('r'); await wait(gm, f"({E(LID)}.recipe.turn || 0) === {k % 4} && tw.sync.pendingCount() === 0", 6000, f'turn {k}')
            if k == 1:
                await gm.wait_for_timeout(700)
                t1 = await gm.evaluate(f"(() => {{ const rc = {E(LID)}.recipe, F = tw.footprint, w = tw.worldOf(tw.area()), objs = {OBJS(LID)}; return {{ wd: [rc.w, rc.d], ok: F.outlineProblem(rc), cells: F.areaCells(rc), off: objs.filter(o => !o.parent && !F.contains(rc, o.x, o.z)).length, floors: [...w.shell.values()].filter(s => s.roomId === '{LID}' && /:f\\d+:\\d+$/.test(s.key)).length, segs: w.selFx.stats().entries.find(e => e.state === 'selected')?.segs }}; }})()")
                await gm.screenshot(path=os.path.join(SHOTS, 'rooms-23-L-turned.png'))
        backL = await gm.evaluate(f"{E(LID)}.recipe")
        check(t1['wd'] == [4, 6] and t1['ok'] is None and t1['cells'] == 20 and t1['off'] == 0 and t1['floors'] == 20 and t1['segs'] == 36 and backL['outline'] == rcL['outline'] and [backL['x'], backL['z']] == [rcL['x'], rcL['z']] and len(json.loads(await gm.evaluate(SNAP(LID)))) == len(snapL), 'it turns by quarter turns: the outline, floor, walls, brackets and furniture turn together (nothing lands in the notch), and four turns bring it home', t1)
        # hide the L: the player receives nothing of it; the GET API reports its shape to the GM's assistant only
        await gm.evaluate(f"tw.setHidden([{E(LID)}], true)"); await wait(pl, f"!{E(LID)}", 8000, 'L hidden from player'); await pl.wait_for_timeout(500)
        s1, a1 = get(f"{relay}/c/{CID}/a/{T1}/state?seat={tok_gm}"); s2, a2 = get(f"{relay}/c/{CID}/a/{T1}/state?seat={tok_ad}")
        lr = next((r for r in a1.get('rooms', []) if r['id'] == LID), None)
        check(await pl.evaluate(f"!JSON.stringify(tw.entities()).includes('{LID}') && [...tw.worldOf(tw.area()).shell.values()].every(s => s.roomId !== '{LID}')") and lr and lr.get('hidden') and len(lr.get('outline', [])) == 6 and LID not in json.dumps(a2), "a hidden L-shaped room: nothing reaches the player or the player's AI seat; the GM's assistant reads it with its outline (in feet)", lr and lr.get('outline'))
        await gm.evaluate(f"tw.setHidden([{E(LID)}], false)"); await wait(pl, f"!!{E(LID)}", 8000, 'L back')
        st_c, r_c = get(f"{relay}/c/{CID}/a/{T1}/do?cmd=room.spawn&type=storeroom&x=390&z=390&w=30&d=25&seed=9&nonce=clip-a&seat={tok_gm}")
        st_d, r_d = get(f"{relay}/c/{CID}/a/{T1}/do?cmd=room.spawn&type=storeroom&x=400&z=400&w=30&d=25&seed=9&clip=1&nonce=clip-b&seat={tok_gm}")
        await wait(gm, f"!!tw.entities()['{r_d.get('id')}']", 8000, 'clipped room arrives')
        check(r_c.get('ok') and r_d.get('ok') and 'does not overlap' in (r_d.get('note') or '') and await gm.evaluate(f"!!tw.entities()['{r_d.get('id')}']?.recipe.outline && {OBJS(r_d.get('id'))}.length > 5"), "an AI seat draws over a room with clip=1 (GET) and gets the L-shaped part, furnished by the relay", r_d.get('note'))
        await gm.keyboard.press('Escape'); await gm.evaluate('tw.clearSelection()'); await view(gm, 60, 32, 150)

        print('MENU: ☰ is ONE flat level for every kind of selection; sub-menus only for long lists, at their button')
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_menu000001', name: 'Goblin', x: 20, z: 45 })"); await wait(gm, "!!tw.entities()['tok_menu000001']", 6000)
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_menu000002', name: 'Goblin 2', x: 25, z: 45 })"); await wait(gm, "!!tw.entities()['tok_menu000002']", 6000)
        LITS = "Object.values(tw.entities()).filter(o => o.kind === 'object' && tw.assets.lightable(o.cat) && !tw.assets.openable(o.cat))"
        kinds = {
            # (2026-10-11, after the cuts: the selections of several things, and the unusual ones)
            'pawns': "['tok_menu000001', 'tok_menu000002']", 'pawn+prop': f"['tok_menu000001', {OBJS(RA)}.find(o => !o.parent && !tw.assets.openable(o.cat) && !tw.assets.lightable(o.cat) && o.place === 'floor').id]",
            'rooms': "Object.values(tw.entities()).filter(e => e.kind === 'room' && !e.hidden).slice(0, 2).map(e => e.id)",
            'lit props': f"{LITS}.slice(0, 2).map(o => o.id).filter((x, i, a) => a.length === 2)",
            'lit openable': "[Object.values(tw.entities()).find(o => o.kind === 'object' && tw.assets.lightable(o.cat) && tw.assets.openable(o.cat))?.id].filter(Boolean)",
            'lit+openable': f"[{LITS}[0]?.id, Object.values(tw.entities()).find(o => o.kind === 'object' && tw.assets.openable(o.cat) && !tw.assets.lightable(o.cat))?.id].filter((x, i, a) => a.every(Boolean))",
            'room': f"['{RA}']", 'building': f"[{E(RA)}.building]",
            'prop': f"[{OBJS(RA)}.find(o => !o.parent && !tw.assets.openable(o.cat) && !tw.assets.lightable(o.cat) && o.place === 'floor').id]",
            'openable': "[Object.values(tw.entities()).find(o => o.kind === 'object' && tw.assets.openable(o.cat))?.id].filter(Boolean)",
            'lit prop': "[Object.values(tw.entities()).find(o => o.kind === 'object' && tw.assets.lightable(o.cat) && !tw.assets.openable(o.cat))?.id].filter(Boolean)",
            'pawn': "['tok_menu000001']",
            'wall': "['wall:' + [...tw.worldOf(tw.area()).edges.values()].find(e => e.kind === 'wall' && e.sides.length === 1).key]",
            'door': "['wall:' + [...tw.worldOf(tw.area()).edges.values()].find(e => e.kind === 'door').key]",
            'window': "[...tw.worldOf(tw.area()).edges.values()].filter(e => e.kind === 'window').slice(0, 1).map(e => 'wall:' + e.key)",
            'many': f"{OBJS(RA)}.filter(o => !o.parent).slice(0, 4).map(o => o.id)",
        }
        RING_JS = "({ closed: [...document.querySelectorAll('#ring .rbtn:not(.ex)')].map(b => b.dataset.cmd || 'menu'), top: [...document.querySelectorAll('#ring .rbtn.ex')].map(b => b.dataset.cmd || '▸' + b.dataset.group), caps: [...document.querySelectorAll('#ring .rbtn.ex')].map(b => b.dataset.tip || ''), subs: [...document.querySelectorAll('#ring .rbtn.grp')].map(b => b.dataset.group), menu: tw.ringMenu(), offscreen: [...document.querySelectorAll('#ring .rbtn')].filter(b => { const r = b.getBoundingClientRect(); return r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight; }).length })"
        async def open_ring(ids, frame=(110, 52, 0.6)):
            await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await gm.evaluate(f"tw.select({json.dumps(ids)})"); await gm.wait_for_timeout(250)
            if frame: await gm.evaluate(FRAME, list(frame))  # (the world-sized ring may run off screen: put it where it can be seen and clicked)
            if await gm.evaluate("document.querySelector('#ring').hidden || !document.querySelector('#ring [data-menu]')"): return False
            await gm.evaluate("document.querySelector('#ring [data-menu]').click()"); await gm.wait_for_timeout(250); return True
        report = {}
        for kind, expr in kinds.items():
            ids = await gm.evaluate(expr)
            if not ids: report[kind] = None; continue
            if not await open_ring(ids): report[kind] = 'no ring' if await gm.evaluate("document.querySelector('#ring').hidden") else {'closed': await gm.evaluate("[...document.querySelectorAll('#ring .rbtn:not(.ex)')].map(b => b.dataset.cmd || 'menu')"), 'top': [], 'caps': [], 'subs': [], 'menu': [], 'offscreen': 0, 'nomenu': True}; continue
            report[kind] = await gm.evaluate(RING_JS)
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(80)
        for kind, m in report.items(): print(f"    {kind:9s} {('—' if not m else m) if not isinstance(m, dict) else 'closed ' + ' · '.join(m['closed']) + ' | ' + str(len(m['top'])) + ' open: ' + ', '.join(m['top'])}")
        opened = {k: m for k, m in report.items() if isinstance(m, dict)}
        MAX_TOP = 12
        check(len(opened) >= 8 and all(len(m['top']) <= MAX_TOP for m in opened.values()) and all(m['offscreen'] == 0 for m in opened.values()), f'NO kind of selection opens more than {MAX_TOP} top-level options on the ring (a room used to open 60-odd), all on screen', {k: len(m['top']) for k, m in opened.items()})
        # THE CUTS (Harry 2026-10-11, "ship the cuts"): Room type ▸, Rename, Replay spawn and Delete are off a room's ring.
        # Floor ▸ left too (a floor dragged in from the library changes the room's floor), and Add stair (stairs are placed from the library).
        check(sorted(opened['room']['closed']) == ['menu', 'room.reroll', 'room.rotate', 'thing.hide'] and opened['room']['top'] == ['▸room.walls.', 'room.fog', 'thing.lock', 'room.height.taller', 'faction.set'] and opened['room']['subs'] == ['room.walls.', 'fog', 'faction'], "a room: turn · re-roll · hide · ☰ | exactly Walls ▸, Fog height ▸, Lock, Taller, Faction ▸. No Room type, Floor, Rename, Replay spawn or Delete", opened['room'])
        nodel = {k: [c for c in m['closed'] + m['top'] + [i for n in m['menu'] for i in n.get('items', [])] if c in ('edit.delete', 'room.delete', 'pawn.duplicate', 'pawn.give', 'room.replay', 'room.rename', 'room.stair') or c.startswith('room.type.') or c.startswith('room.floor.') or c in ('▸room.type.', '▸room.floor.')] for k, m in opened.items()}
        check(not any(nodel.values()), 'NO ring has a Delete button, for any kind of selection; nor Duplicate, Give control, Replay spawn, Room type or a room\'s Rename', {k: v for k, v in nodel.items() if v})
        check(all(m.get('nomenu') or len(m['top']) >= 1 for m in opened.values()) and all(('menu' in m['closed']) == (not m.get('nomenu')) for m in opened.values()), 'no selection is left with an empty ☰: where ☰ is shown it holds at least one entry', {k: (m['closed'], len(m['top'])) for k, m in opened.items()})
        exact = {
            'building': (['thing.hide', 'menu'], ['faction.set', '▸building.roof.', 'thing.rename', 'thing.lock']),
            'prop': (['edit.rotate', 'edit.resize', 'thing.pin', 'menu'], ['thing.replace', 'edit.lift', 'thing.tilt', 'thing.rename', 'thing.lock', 'thing.hide']),
            'pawn': (['edit.rotate', 'pawn.sheet', 'pawn.damage', 'menu'], ['▸pawn.cond.', '▸pawn.mark.', 'edit.lift', 'thing.hide', 'pawn.travel']),
            'pawns': (['edit.rotate', 'pawn.damage', 'menu'], ['▸pawn.cond.', '▸pawn.mark.', 'thing.hide', 'cast.saveGroup', 'pawn.travel']),
            'pawn+prop': (['edit.rotate', 'menu'], ['thing.hide']),
            'rooms': (['thing.hide', 'menu'], ['thing.lock']),
            'many': (['edit.rotate', 'thing.pin', 'menu'], ['thing.tilt', 'thing.lock', 'thing.hide']),
            'lit props': (['edit.rotate', 'thing.pin', 'menu'], ['thing.light', 'thing.tilt', 'thing.lock', 'thing.hide']),
            'lit+openable': (['edit.rotate', 'menu'], ['thing.tilt', 'thing.pin', 'thing.lock', 'thing.hide']),  # (two KINDS of thing: Pin has no one slot on the closed ring, so it is behind ☰, as before the cuts)
        }
        got = {k: (opened[k]['closed'], opened[k]['top']) for k in exact if k in opened}
        check(len(got) >= 7 and all(got[k] == exact[k] for k in got), 'each kind of selection, closed | open, exactly (a pawn: turn · sheet · damage | Conditions ▸, Indicators ▸, Raise / lower, Hide, Send to area; several pawns; a pawn with a prop; several rooms; several lights; a light with a chest)', {k: got[k] for k in got if got[k] != exact[k]} or sorted(got))
        if 'lit openable' in opened: check(opened['lit openable']['top'] == ['thing.replace', 'edit.lift', 'thing.tilt', 'thing.rename', 'thing.lock', 'thing.hide'] and 'thing.light' in opened['lit openable']['closed'] and 'thing.open' in opened['lit openable']['closed'], 'a thing that both lights and opens: both on its closed ring, the same five behind ☰', opened['lit openable'])
        else: print('    (no thing in this inn both lights and opens: that combination is not exercised here)')
        banned = {k: [c for c in m['top'] + [i for n in m['menu'] for i in n.get('items', [])] if c in ('edit.duplicate', 'edit.copy', 'edit.cut', '▸copy', '▸edit')] for k, m in opened.items()}
        check(not any(banned.values()), 'the clipboard\'s duplicate, copy and cut are nowhere in the ring, for any kind of selection; there is no Edit ▸ or Copy ▸ group (the Duplicate a pawn had left the ring too on 2026-10-11)', {k: v for k, v in banned.items() if v})
        allowed = {'faction', 'sheet', 'replace', 'room.type.', 'room.walls.', 'room.floor.', 'fog', 'pawn.cond.', 'pawn.mark.', 'give', 'travel', 'building.roof.', 'roof.style.'}  # (a building's Roof style and a roof's Style: Stage F)
        check(all(set(m['subs']) <= allowed for m in opened.values()) and opened['prop']['subs'] == ['replace'] and all(m['subs'] in (['replace'], []) for k, m in opened.items() if k in ('openable', 'lit prop', 'wall', 'door', 'window', 'many')), 'ordinary things are flat: the only ▸ on a prop, a chest, a candle, a wall piece or a door is Replace; rooms and pawns add their long lists; buildings also offer Faction', {k: m['subs'] for k, m in opened.items()})
        p_, lp = opened['prop']['top'], (opened.get('lit prop') or {}).get('top', [])
        check(p_ == ['thing.replace', 'edit.lift', 'thing.tilt', 'thing.rename', 'thing.lock', 'thing.hide'] and (not lp or lp == ['thing.light'] + p_) and all(opened[k]['top'] == [c for c in p_ if c != 'thing.tilt' or k == 'openable'] for k in ('openable', 'wall', 'door', 'window') if k in opened), 'the fixed order: (light) Replace ▸, raise / lower, roll, rename, lock, hide (no delete); a candle is a prop with Light in front; a chest opens the same six; a wall piece, a door and a window the five without Roll', {k: opened[k]['top'] for k in ('prop', 'lit prop', 'openable', 'wall', 'door', 'window') if k in opened})
        check(await gm.evaluate('tw.menuOrphans()') == [], 'every menu command has a line in the table (client/menu.js): no orphans', await gm.evaluate('tw.menuOrphans()'))
        rm = opened['room']['menu']
        allc = await gm.evaluate(f"(() => {{ tw.select(['{RA}']); const R = tw.registry, ctx = R.ctx(); return R.available(ctx).filter(c => c.menu && !c.stub).map(c => c.id); }})()")
        inmenu = set()
        for n in rm: inmenu.update([n['cmd']] if n.get('cmd') else n['items'])
        missing = [c for c in allc if c not in inmenu and c not in ('room.reroll', 'room.rotate', 'thing.hide')]
        check(sorted(c for c in missing if not c.startswith(('room.type.', 'room.floor.')) and c != 'room.stair') == ['edit.copy', 'edit.cut', 'edit.delete', 'edit.duplicate', 'room.rename', 'room.replay', 'room.rotateBack'] and any(c.startswith('room.type.') for c in missing) and any(c.startswith('room.floor.') for c in missing), "what a room can do and ☰ does not show is exactly the list left out on purpose (client/menu.js NOT_IN_MENU): duplicate / copy / cut, turn-back, and since 2026-10-11 delete, rename, replay spawn and the room types (keys, the label, the bar)", f"missing {[c for c in missing if not c.startswith(('room.type.', 'room.floor.'))]} + {sum(c.startswith('room.type.') for c in missing)} room types + {sum(c.startswith('room.floor.') for c in missing)} floors · of {len(allc)} commands")

        # ---- sub-menus (2026-10-20, the Ring Lab ring): the ring GROWN OUTWARD, one button per item on a bigger oval about
        # the same centre; its opener stays on the ring; no panel. The world-sized ring has no screen fitting: at an edge a
        # sub-menu is not pushed inward (it may run off screen), it is exactly the shape it is mid-screen.
        FLY = "tw.ringFlyout()"
        NEST = """(() => { const f = tw.ringFlyout(), c = tw.ringAnchor(), ns = tw.ringNodes(), box = (b) => { const r = b.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
          const nest = [...document.querySelectorAll('#ring .rbtn[data-nest]')], bs = nest.map(box), sz = nest.map(b => b.getBoundingClientRect().width);
          const mainC = ns.find(n => n.key !== 'nested' && n.key !== 'conditions' && n.key !== 'faction' && n.curve)?.curve, nestC = ns.filter(n => ['nested', 'conditions', 'faction'].includes(n.key) && n.curve).map(n => n.curve);
          const over = bs.some((a, i) => bs.some((b, j) => j > i && Math.hypot((a[0] + a[2] - b[0] - b[2]) / 2, (a[1] + a[3] - b[1] - b[3]) / 2) < (a[2] - a[0] + b[2] - b[0]) / 2 - 2)); // (round buttons: two overlap when their centres are closer than their radii)
          return f && { group: f.group, nest: !!f.nest, state: tw.ringState(), tiles: f.tiles, n: nest.length, anchorIs: f.anchorIs, anchor: f.anchor, box: f.box, centre: [c.x, c.y],
            grown: !!mainC && nestC.length === nest.length && nestC.every(k => Math.abs(k.cx - mainC.cx) < 1 && Math.abs(k.cy - mainC.cy) < 1 && k.rx > mainC.rx + 1 && k.ry > mainC.ry + 1),
            coversCentre: bs.some(b => b[0] <= c.x && c.x <= b[2] && b[1] <= c.y && c.y <= b[3]), overlap: over, minW: Math.min(...sz),
            on: bs.every(b => b[0] >= 0 && b[1] >= 0 && b[2] <= innerWidth && b[3] <= innerHeight), deeper: nest.some(b => b.getAttribute('aria-haspopup')),
            rel: ns.filter(n => ['nested', 'conditions', 'faction'].includes(n.key)).map(n => [n.id, +((n.x - c.x) / n.size).toFixed(3), +((n.y - c.y) / n.size).toFixed(3)]),  // (the layout's own places and sizes: a hovered button grows a little)
            warn: tw.ringWarnings() }; })()"""
        def shape_gap(a, b):  # how far apart two sub-menus' items are, relative to the ring's centre, in units of the button
            if not a or not b or [x[0] for x in a['rel']] != [x[0] for x in b['rel']]: return 99
            return round(max([max(abs(x[1] - y[1]), abs(x[2] - y[2])) for x, y in zip(a['rel'], b['rel'])] or [0]), 3)
        def same_shape(a, b, tol=0.03): return shape_gap(a, b) <= tol
        async def open_sub(group, js=False):
            if await gm.evaluate("tw.ringState() === 'nested'"): await gm.keyboard.press('Escape'); await gm.wait_for_timeout(120)  # one sub-menu at a time
            if js: await gm.evaluate(f"document.querySelector('#ring .rbtn.grp[data-group=\"{group}\"]').click()")  # (at a screen edge its button may be off screen itself)
            else: await gm.click(f'#ring .rbtn.grp[data-group="{group}"]')
            await gm.wait_for_timeout(350)
            return await gm.evaluate(NEST)
        shots = []
        async def shot(name):
            await gm.wait_for_timeout(500); pth = os.path.join(SHOTS, f'menu-{name}.png'); await gm.screenshot(path=pth); shots.append(pth)
        prop_id = (await gm.evaluate(kinds['prop']))[0]; pe = await gm.evaluate(E(prop_id))
        lit = await gm.evaluate(kinds['lit prop']); chest = await gm.evaluate(kinds['openable'])
        # the open ring, per kind (screenshots for the blind read)
        for nm, ids, vw in [('ring-prop', [prop_id], (pe['x'], pe['z'], 40))] + ([('ring-candle', lit, None)] if lit else []) + ([('ring-chest', chest, None)] if chest else []) + [('ring-pawn', ['tok_menu000001'], (20, 45, 40)), ('ring-room', [RA], (35, 22, 95))]:
            if vw is None: e_ = await gm.evaluate(E(ids[0])); vw = (e_['x'], e_['z'], 40)
            vx, vz, vd = vw
            await view(gm, vx, vz, vd, 62); await open_ring(ids, (vd, 62, 0.6)); await shot(nm)
        # mid-screen: each sub-menu is the ring grown outward from its opener (it does not sit on the thing's centre)
        mids = {}
        await open_ring([prop_id]); mids['replace'] = await open_sub('replace')
        await gm.keyboard.press('Escape'); await open_ring(['tok_menu000001']); mids['pawn.cond.'] = await open_sub('pawn.cond.')
        await gm.keyboard.press('Escape'); await open_ring([RA])
        for g_ in ('room.walls.',): mids[g_] = await open_sub(g_)
        check(len(mids) == 3 and all(f and f['group'] == k and f['nest'] and f['state'] == 'nested' and f['anchorIs'] == k and f['grown'] and not f['coversCentre'] and not f['overlap'] and not any('3–6' in w or 'overlap' in w for w in f['warn']) for k, f in mids.items()) and mids['replace']['on'] and mids['pawn.cond.']['on'],
              'every sub-menu (Replace, Conditions, Walls) opens as the ring grown outward: its own button stays on the ring, each item a button on a bigger oval about the same centre, none over the thing\'s centre or another item, nothing in the 3–6 sector; the short ones (Replace, Conditions) whole on screen at a play distance', {k: f and {x: f[x] for x in ('n', 'grown', 'coversCentre', 'overlap', 'on', 'warn', 'anchorIs')} for k, f in mids.items()})
        f3 = mids['room.walls.']
        check(f3 and len(f3['tiles']) > 8 and f3['n'] == len(f3['tiles']) and f3['minW'] > 40 and not f3['deeper'], 'Walls ▸ is ONE level: every wall style a button of the grown ring, none opening a deeper level (Floor ▸, the 41-tile list this was checked on, left the ring on 2026-10-11)', f"{f3 and len(f3['tiles'])} wall styles, smallest {f3 and round(f3['minW'])} px")
        # the "everything on screen is touchable" invariant holds with a sub-menu open
        await gm.evaluate("tw.worldOf(tw.area()).scene.updateMatrixWorld()"); a_ = await gm.evaluate(AUDIT)
        check(a_['tested'] > 50 and a_['nbad'] == 0 and await gm.evaluate('!!' + FLY), 'everything on screen is touchable with a sub-menu open', f"{a_['tested']} points · {a_['nbad']} untouchable {a_['kinds']}")
        # it follows the ring when the camera moves
        b0 = await gm.evaluate(NEST)
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.x += 12; g.focus.z += 6; g.update(); })()"); await gm.wait_for_timeout(400)
        b1 = await gm.evaluate(NEST)
        check(b1 and b1['state'] == 'nested' and b1['anchor'] != b0['anchor'] and b1['box'] != b0['box'] and same_shape(b0, b1), 'the sub-menu follows its ring when the camera moves (the same shape about the moved centre)', f"anchor {b0['anchor']} → {b1 and b1['anchor']}, box {b0['box']} → {b1 and b1['box']}")
        # closing: Escape (the ring stays open), a click anywhere else, the button again, ☰, choosing an item
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(120)
        esc1 = await gm.evaluate("({ fly: !!tw.ringFlyout(), open: !!document.querySelector('#ring [data-menu].open') })")
        await open_sub('room.walls.'); await gm.mouse.click(1250, 800); await gm.wait_for_timeout(200); away_ = await gm.evaluate('!!' + FLY)
        await open_ring([RA])  # (that click landed on the ground, which also let go of the room)
        await open_sub('room.walls.'); await gm.evaluate("document.querySelector('#ring .rbtn.grp[data-group=\"room.walls.\"]').click()"); await gm.wait_for_timeout(150); again = await gm.evaluate('!!' + FLY)
        await open_sub('room.walls.'); await gm.click('#ring .rbtn[data-menu]'); await gm.wait_for_timeout(150); xed = await gm.evaluate("!!tw.ringFlyout() || tw.ringState() !== 'closed'")
        check(esc1 == {'fly': False, 'open': True} and not away_ and not again and not xed, 'Escape closes the sub-menu (the ring stays open); so do a click anywhere else and its own button again; ☰ shuts the ring and the sub-menu with it', {'esc': esc1, 'away': away_, 'again': again, 'menu': xed})
        await open_ring([RA]); await open_sub('room.walls.'); await gm.click('#ring .rbtn[data-nest][data-cmd="room.walls.fieldstone"]')
        await wait(gm, f"{E(RA)}.recipe.wallFamily === 'fieldstone'", 6000, 'walls set')
        check(await gm.evaluate(f"{E(RA)}.recipe.wallFamily") == 'fieldstone' and not await gm.evaluate("!!tw.ringFlyout() || !!document.querySelector('#ring [data-menu].open')"), 'Walls ▸ fieldstone changes the room\'s walls and closes the menu')
        await settle(gm, 30000)
        # near the screen edges: NOT pushed inward (the world-sized ring has no screen fitting): the same shape as mid-screen
        edges = {}
        async def at_edge(name, ids, wx, wz, dist, fx, fy, group):
            # put the world point (wx, wz) at the screen fraction (fx, fy)
            await view(gm, wx, wz, dist, 62)
            for _ in range(3):
                await gm.evaluate(f"(() => {{ const g = tw.main.grab, p = tw.screenOf({wx}, {wz}, tw.main), q = tw.screenOf({wx} + 1, {wz}, tw.main), r = tw.screenOf({wx}, {wz} + 1, tw.main); const dx = innerWidth * {fx} - p.x, dy = innerHeight * {fy} - p.y; g.focus.x -= dx / (q.x - p.x); g.focus.z -= dy / (r.y - p.y); g.update(); }})()"); await gm.wait_for_timeout(200)
            await open_ring(ids, None); f = await open_sub(group, js=True); edges[name] = (group, f)
            await wait(gm, "!document.querySelector('#ring .rbtn[data-nest] .pvw[data-pv]') || document.querySelectorAll('#ring .rbtn[data-nest] .pvw.live').length > 0", 12000, 'previews'); await shot(f'sub-{name}')
            await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        rr = await gm.evaluate(f"(() => {{ const r = {E(RA)}.recipe; return [(r.x + r.w / 2) * 5, (r.z + r.d / 2) * 5]; }})()")
        await open_ring([RA]); mids['room.walls.'] = await open_sub('room.walls.'); await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')  # (again: its list leaves out the room's own walls, fieldstone now)
        await at_edge('replace-right-edge', [prop_id], pe['x'], pe['z'], 40, 0.95, 0.5, 'replace')
        await at_edge('replace-bottom-edge', [prop_id], pe['x'], pe['z'], 40, 0.5, 0.93, 'replace')
        await at_edge('conditions-left-edge', ['tok_menu000001'], 20, 45, 40, 0.05, 0.5, 'pawn.cond.')
        await at_edge('walls-top-left', [RA], rr[0], rr[1], 95, 0.12, 0.2, 'room.walls.')
        await at_edge('walls-right-edge', [RA], rr[0], rr[1], 95, 0.9, 0.5, 'room.walls.')
        await at_edge('walls-bottom-right', [RA], rr[0], rr[1], 95, 0.88, 0.85, 'room.walls.')
        pe_ = {k: (f and f['state'] == 'nested' and f['anchorIs'] == g and same_shape(f, mids[g]), f and not f['on'], shape_gap(f, mids[g])) for k, (g, f) in edges.items()}
        check(len(pe_) == 6 and all(v[0] for v in pe_.values()) and any(v[1] for v in pe_.values()), 'at the screen edges each sub-menu opens just the same (no screen fitting: every item where it is mid-screen, relative to the ring\'s centre and size, even where that runs off screen)', pe_)
        print('    screenshots for the blind read: ' + ' '.join(os.path.basename(s_) for s_ in shots))
        await view(gm, 60, 32, 150)
        # the chord tree is the same shape: flat where the ring is flat, one more letter inside a long list
        await gm.keyboard.press('Escape'); await gm.evaluate("tw.select(['tok_menu000001'])"); await gm.wait_for_timeout(150)
        await gm.keyboard.press('Space'); await gm.wait_for_timeout(150)
        c0 = await gm.evaluate('tw.chordState()')
        hint = await gm.evaluate("document.querySelector('#whichkey').innerText.replace(/\\s+/g, ' ')")
        await gm.keyboard.press('h'); await wait(gm, "tw.entities()['tok_menu000001'].hidden === true", 6000, 'chord hide'); await wait(pl, "!tw.entities()['tok_menu000001']", 8000, 'pawn gone for the player')
        check(c0 and c0['path'] == [] and 'thing.hide' in c0['items'] and '▸pawn.cond.' in c0['items'] and not any(i in c0['items'] for i in ('▸edit', '▸copy', 'edit.duplicate', 'edit.copy', 'edit.cut')) and len(set(c0['keys'])) == len(c0['keys']) and await gm.evaluate("tw.entities()['tok_menu000001'].hidden") and await pl.evaluate("!tw.entities()['tok_menu000001']"), 'the Space chord tree mirrors the ring: flat. Space, H hides the pawn (gone from the player tab); no Edit / Copy level, no duplicate / copy / cut, one letter each', f"top {c0 and c0['items']} · “{hint[:110]}”")
        await gm.keyboard.press('Space'); await gm.wait_for_timeout(120); await gm.keyboard.press('c'); await gm.wait_for_timeout(80); c1 = await gm.evaluate('tw.chordState()'); await gm.keyboard.press('Backspace'); await gm.wait_for_timeout(80)
        cb_ = await gm.evaluate('tw.chordState()'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(80)
        check(c1 and c1['path'] == ['Conditions'] and 'pawn.cond.poisoned' in c1['items'] and cb_ and cb_['path'] == [] and await gm.evaluate('tw.chordState()') is None and await gm.evaluate("document.querySelector('#whichkey').hidden"), 'Space, C opens the one long list (Conditions); Backspace goes up a level, Esc cancels', c1 and c1['path'])
        await gm.evaluate(f"tw.select(['{RA}'])"); await gm.wait_for_timeout(150); await gm.keyboard.press('Space'); await gm.wait_for_timeout(150); cr = await gm.evaluate('tw.chordState()'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(80)
        check(cr and cr['items'] == ['faction.set', '▸room.type.', '▸room.walls.', '▸room.floor.', 'room.fog', 'room.reroll', 'room.rotate', 'room.rename', 'thing.lock', 'thing.hide', 'room.height.taller', 'room.replay', 'edit.delete'] and len(set(cr['keys'])) == len(cr['keys']), "a room's chord level holds everything, what the cuts took off the ring included (the cuts were to the ring only): faction, the three lists, fog, re-roll, turn, rename, lock, hide, taller, replay, delete; no letter used twice", cr and list(zip(cr['keys'], cr['items'])))
        # the keyboard still duplicates, copies and cuts
        n0 = await gm.evaluate("Object.keys(tw.entities()).length"); await gm.evaluate(f"tw.select(['{prop_id}'])"); await gm.wait_for_timeout(150)
        await gm.keyboard.press('Control+d'); dup_ok = await wait(gm, f"Object.keys(tw.entities()).length === {n0 + 1} && tw.sync.pendingCount() === 0", 6000, 'Ctrl+D')
        await gm.keyboard.press('Control+x'); cut_ok = await wait(gm, f"Object.keys(tw.entities()).length === {n0} && tw.sync.pendingCount() === 0", 6000, 'Ctrl+X')
        check(dup_ok and cut_ok, 'Ctrl/⌘+D still duplicates and Ctrl/⌘+X still cuts (the keyboard keeps what the ring dropped)')
        # the bar still finds everything by name
        found = await gm.evaluate(f"""(async () => {{ tw.select(['{RA}']); const out = {{}}; for (const q of ['hide from players', 'turn room', 're-roll', 'walls: half timber', 'floor: cobble', 'room type: kitchen', 'duplicate', 'copy', 'cut', 'turn room 90° anticlockwise', 'lock', 'rename', 'replay spawn', 'delete']) {{ tw.emit('bar.open', q); await new Promise(r => setTimeout(r, 220)); out[q] = [...document.querySelectorAll('#results .res .t')].slice(0, 4).map(e => e.innerText); document.querySelector('#bar input').dispatchEvent(new KeyboardEvent('keydown', {{ key: 'Escape', bubbles: true }})); await new Promise(r => setTimeout(r, 60)); }} return out; }})()""")
        want = {'hide from players': 'Hide from players', 'turn room': 'Turn room 90°', 're-roll': 'Re-roll room', 'walls: half timber': 'Walls: half timber', 'floor: cobble': 'Floor: cobble', 'room type: kitchen': 'Room type: Kitchen', 'duplicate': 'Duplicate', 'copy': 'Copy', 'cut': 'Cut', 'turn room 90° anticlockwise': 'anticlockwise', 'lock': 'Lock', 'rename': 'Rename', 'replay spawn': 'Replay spawn', 'delete': 'Delete'}
        check(all(any(w.lower() in t.lower() for t in found[q]) for q, w in want.items()), 'the command bar still finds every one of them by name: duplicate / copy / cut, and what left the ring on 2026-10-11 (room type, rename, replay spawn, delete)', {q: found[q][:1] for q in want})

        print('FOG: a room\'s fog height, from its ring')
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        RF = await gm.evaluate("tw.spawnRoom('cellar', 2, 16, 4, 4, 4301)")
        await wait(gm, f"!!{E(RF)} && tw.sync.pendingCount() === 0", 30000, 'cellar'); await wait(pl, f"!!{E(RF)}", 20000, 'player has the cellar'); await settle(gm, 60000)
        FOGS = lambda rid: f"(() => {{ const w = tw.worldOf(tw.area()), e = {E(rid)}, fr = w.fogRooms().find(r => r.id === '{rid}'), at = w.fx?.atmos?.rooms?.().find(r => r.id === '{rid}'); return {{ has: 'fog' in e, fog: e.fog ?? null, height: fr ? fr.height : 'no room', resolved: at ? at.resolved : null, sets: tw.applied.filter(a => a[3] === 'room.set').length }}; }})()"
        # (2026-10-20: Fog height is a DRAG TRACK on its ☰ button, as damage is; the slider panel is gone. 22 px a foot out
        # along the handle's ray, 0 to 8 ft, a notch at 0; letting go on the type's default puts the room back on it)
        FOG_PX = 22
        TRACK = "(() => { const d = tw.ringDrag(); return d && { kind: d.kind, dir: d.dir, track: d.track }; })()"
        async def fog_button(rid):
            await open_ring([rid]); return await gm.evaluate("(() => { const r = document.querySelector('#ring .rbtn[data-cmd=\"room.fog\"]')?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()")
        async def fog_drag(rid, ft, peek=None, hold=None):
            b = await fog_button(rid); await gm.mouse.move(b['x'], b['y']); await gm.mouse.down(); await gm.wait_for_timeout(120)
            s = await gm.evaluate(TRACK); v0 = s['track']['start']; u = s['dir']
            for i in range(1, 9): px = (ft - v0) * FOG_PX * i / 8; await gm.mouse.move(b['x'] + u[0] * px, b['y'] + u[1] * px); await gm.wait_for_timeout(40)
            await gm.wait_for_timeout(80)
            mid = await peek() if peek else None
            if hold: await shot(hold)
            await gm.mouse.up(); await gm.wait_for_timeout(500); return s, mid
        tdef = await gm.evaluate("tw.worldOf(tw.area()).fx?.atmos?.typeDefault?.('cellar', false) ?? 0")
        ZERO = 0 if tdef > 0 else None  # (a type with no fog of its own: its zero IS the type default, so letting go at 0 puts the room back on it)
        st0 = await gm.evaluate(FOGS(RF)); b = await fog_button(RF)
        await gm.mouse.move(b['x'], b['y']); await gm.mouse.down(); await gm.wait_for_timeout(150); f0 = await gm.evaluate(TRACK); await gm.mouse.up(); await gm.wait_for_timeout(400)
        hint = await gm.evaluate("document.querySelector('#toast').textContent"); last0 = await gm.evaluate('tw.ringDragLast'); st0b = await gm.evaluate(FOGS(RF))
        t0 = f0 and f0['track']; per = t0 and math.dist(t0['ends'][0], t0['ends'][1]) / 8
        check(f0 and f0['kind'] == 'fog' and t0['min'] == 0 and t0['max'] == 8 and abs(per - FOG_PX) < 0.05 and math.dist(t0['knob'], [b['x'], b['y']]) < 8 and abs(t0['start'] - tdef) < 0.13 and any(m['v'] == 0 for m in t0['marks']) and any('default' in m['label'] and abs(m['v'] - tdef) < 0.01 for m in t0['marks']) and not st0['has'],
              "a room's ☰ has Fog height: grabbing it draws a track AT that button, 0 to 8 ft at 22 px a foot, the dot at the room type's default (marked \"type default\") until the room has its own", {'track': t0 and {k: t0[k] for k in ('min', 'max', 'start', 'marks')}, 'px/ft': per, 'typeDefault': tdef, 'state': st0})
        check(last0 and not last0['moved'] and not last0['committed'] and 'Drag Fog height' in hint and st0b['sets'] == st0['sets'], 'a plain click on it sends nothing and says how it works (a hint)', hint)
        async def peek_fog(): return {'gm': await gm.evaluate(FOGS(RF)), 'pl': await pl.evaluate(FOGS(RF)), 'track': (await gm.evaluate(TRACK))['track']}
        await fog_drag(RF, 3, hold='sub-fog-track'); await wait(gm, f"{E(RF)}.fog > 2 && tw.sync.pendingCount() === 0", 6000, 'cellar fog up'); up_ = await gm.evaluate(FOGS(RF)); st0 = up_
        check(up_['fog'] is not None and abs(up_['fog'] - 3) <= 0.25 and up_['height'] == up_['fog'], 'dragged out to about 3 ft: the cellar has its own fog height', up_)
        _, mid = await fog_drag(RF, 0.1, peek_fog)  # back in, below the notch: it catches at 0 = no fog
        await wait(gm, 'tw.sync.pendingCount() === 0', 6000); await wait(pl, f"{E(RF)}.fog === {'undefined' if ZERO is None else ZERO}", 8000, 'player gets the fog')
        g1, p1 = await gm.evaluate(FOGS(RF)), await pl.evaluate(FOGS(RF))
        check(mid['gm']['height'] == 0 and mid['track']['value'] == 0 and mid['track']['text'] in ('no fog', 'type default (none)') and mid['gm']['fog'] == st0['fog'] and mid['gm']['sets'] == st0['sets'] and mid['pl']['fog'] == st0['fog'],
              'dragging previews in this tab only (the notch catches at 0 = none): nothing is sent, the player sees nothing yet', mid)
        check(g1['fog'] == ZERO and g1['has'] == (ZERO is not None) and g1['sets'] == st0['sets'] + 1 and (g1['resolved'] in (0, None)) and p1['fog'] == ZERO and (g1['height'] or 0) == 0 and (p1['height'] or 0) == 0, 'letting go sends ONE room.set: the cellar has no fog, here (the atmosphere resolves it to 0) and on the player\'s tab', {'gm': g1, 'player': p1})
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        await fog_drag(RB, 2)
        await wait(gm, 'tw.sync.pendingCount() === 0', 6000); g2 = await gm.evaluate(FOGS(RB)); await wait(pl, f"{E(RB)}.fog === {g2['fog']}", 8000, 'player gets the common room fog'); p2 = await pl.evaluate(FOGS(RB))
        check(g2['fog'] is not None and abs(g2['fog'] - 2) <= 0.25 and g2['height'] == g2['fog'] and (g2['resolved'] in (g2['fog'], None)) and p2['fog'] == g2['fog'] and p2['height'] == g2['fog'], 'the common room set to 2 ft: the player\'s fog follows', {'gm': g2, 'player': p2})
        await gm.screenshot(path=os.path.join(SHOTS, 'rooms-12-fog-common-2ft.png'))
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        # an AI seat reads it and sets it (GET), and the relay refuses what is out of range
        s_, st = get(f"{relay}/c/{CID}/a/{T1}/state?seat={tok_gm}"); rooms_ = {r['id']: r for r in st.get('rooms', [])}
        s1_, r1_ = get(f"{relay}/c/{CID}/a/{T1}/do?cmd=room.set&id={RB}&fog=1.5&nonce=fog-a&seat={tok_gm}")
        s2_, r2_ = get(f"{relay}/c/{CID}/a/{T1}/do?cmd=room.set&id={RB}&fog=9&nonce=fog-b&seat={tok_gm}")
        s3_, card = 0, urllib.request.urlopen(urllib.request.Request(f"{relay}/c/{CID}/help/rooms?seat={tok_gm}", headers=UA), timeout=30).read().decode()  # (2026-10-20: the card's rooms page)
        await wait(pl, f"{E(RB)}.fog === 1.5", 8000, 'AI fog reaches the player')
        check(rooms_.get(RF, {}).get('fog') == ZERO and rooms_.get(RB, {}).get('fog') == g2['fog'] and 'fog' not in rooms_.get(RA, {}) and r1_.get('ok') and await gm.evaluate(f"{E(RB)}.fog") == 1.5 and await pl.evaluate(f"{E(RB)}.fog") == 1.5 and not r2_.get('ok') and '0 to 8' in json.dumps(r2_) and 'fog=FEET' in card and 'cmd=room.set' in card,
              "an AI seat reads each room's own fog in state, sets it with room.set&fog= (GET), is refused above 8 ft with the reason, and its rules card says how", {'state': {k: v.get('fog') for k, v in rooms_.items()}, 'set': r1_.get('ok'), 'refused': str(r2_)[:160]})
        # a reload keeps it
        await gm.reload(); back_ready = await wait(gm, 'window.tw && tw.ready && tw.ready()', 60000, 'GM back'); await gm.wait_for_timeout(2500)
        if not back_ready: raise RuntimeError('GM reload failed: ' + str(errors[-12:]) + ' BODY ' + (await gm.locator('body').inner_text())[:1200])
        check(await gm.evaluate(f"[{E(RF)}.fog, {E(RB)}.fog]") == [ZERO, 1.5] and (await gm.evaluate(FOGS(RB)))['height'] == 1.5, 'after a reload both rooms still have their own fog', await gm.evaluate(f"[{E(RF)}.fog, {E(RB)}.fog]"))
        # Type default restores (let go on its mark); Escape cancels a drag; undo brings the own value back
        await fog_drag(RF, 2); await wait(gm, f"{E(RF)}.fog === 2 && tw.sync.pendingCount() === 0", 6000, 'cellar own fog 2'); own = await gm.evaluate(FOGS(RF))
        async def peek_def(): return (await gm.evaluate(TRACK))['track']
        _, td = await fog_drag(RF, tdef, peek_def)
        await wait(gm, f"!('fog' in {E(RF)}) && tw.sync.pendingCount() === 0", 6000, 'type default'); await wait(pl, f"!('fog' in {E(RF)})", 8000, 'player: type default')
        await wait(gm, f"(() => {{ const a = tw.worldOf(tw.area()).fx?.atmos?.rooms?.().find(r => r.id === '{RF}'); return !a || Math.abs(a.resolved - {tdef}) < 0.01; }})()", 8000, 'the atmosphere takes the type default (it re-reads the rooms a few times a second)')
        g3, p3 = await gm.evaluate(FOGS(RF)), await pl.evaluate(FOGS(RF)); dl = await gm.evaluate('tw.ringDragLast')
        b = await fog_button(RF); await gm.mouse.move(b['x'], b['y']); await gm.mouse.down(); await gm.wait_for_timeout(120); s4 = await gm.evaluate(TRACK); u = s4['dir']
        for i in range(1, 5): await gm.mouse.move(b['x'] + u[0] * 60 * i / 4, b['y'] + u[1] * 60 * i / 4); await gm.wait_for_timeout(40)
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150); await gm.mouse.up(); await gm.wait_for_timeout(400); esc = await gm.evaluate('tw.ringDragLast'); g4 = await gm.evaluate(FOGS(RF))
        check(own['has'] and td['text'].startswith('type default') and dl['value'] == 'default' and dl['committed'] and not g3['has'] and g3['height'] is None and not p3['has'] and abs(s4['track']['start'] - tdef) < 0.13 and (g3['resolved'] is None or abs(g3['resolved'] - tdef) < 0.01),
              '“Type default”: let go on its mark and the cellar goes back on its type\'s fog, on both tabs (grabbed again, its track starts there)', {'readout': td['text'], 'last': dl, 'gm': g3, 'player': p3, 'start again': s4['track']['start']})
        check(esc['how'] == 'escape' and not esc['committed'] and g4['sets'] == g3['sets'] and not g4['has'], 'Escape during the drag changes nothing', esc)
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await gm.evaluate('tw.clearSelection()'); await gm.keyboard.press('Control+z')
        check(await wait(gm, f"{E(RF)}.fog === 2", 6000, 'undo') and await wait(pl, f"{E(RF)}.fog === 2", 8000, 'undo reaches the player'), 'undo (Ctrl+Z) brings the room\'s own fog back: it is an ordinary undoable command')
        await gm.evaluate(f"tw.dispatch('room.delete', {{ id: '{RF}' }})"); await wait(gm, f"!{E(RF)} && tw.sync.pendingCount() === 0", 8000, 'cellar removed'); await view(gm, 60, 32, 150)

        print('CONDITIONAL BUTTONS: the component\'s rules')
        await gm.keyboard.press('Escape'); await gm.evaluate("tw.clearSelection()")
        await gm.keyboard.press('/'); await gm.keyboard.type('abc'); await gm.wait_for_timeout(150)
        cb1 = await gm.evaluate("""(() => { window.__ran = 0; const cb = tw.condButtons; let cond = true;
          window.__setCond = (v) => { cond = v; };
          const b = cb.show('test:roofs', { text: 'Roofs on', icon: 'house', dock: 'bottom', when: () => cond, run: () => { window.__ran++; } });
          const r = b.el.getBoundingClientRect(); return { focus: document.activeElement?.tagName, hasFocus: document.hasFocus(), cls: document.activeElement?.className, tab: b.el.tabIndex, shown: cb.has('test:roofs'), at: [Math.round(r.left + r.width / 2), Math.round(r.top)], list: cb.list().filter(x => x.key === 'test:roofs') }; })()""")
        r_ = cb1['at']
        await gm.mouse.click(r_[0], r_[1] + 8); await wait(gm, 'window.__ran === 1', 4000, 'conditional button ran')
        cb2 = await gm.evaluate("({ ran: window.__ran, focus: document.activeElement?.tagName, value: document.querySelector('#bar input').value, barOpen: document.querySelector('#bar').classList.contains('open') })")
        check(cb1['shown'] and cb1['focus'] == 'INPUT' and cb1['tab'] == -1 and cb2['ran'] == 1 and cb2['focus'] == 'INPUT' and cb2['value'] == 'abc' and cb2['barOpen'], 'a conditional button appears without taking the keyboard focus, is not in the tab order, and pressing it leaves the focus (and what was being typed) alone', {**cb1, **cb2})
        gone_used = await wait(gm, "!tw.condButtons.has('test:roofs')", 20000, 'used button goes')
        pos = await gm.evaluate("""(async () => { const cb = tw.condButtons, at = () => { const r = cb.get('test:roofs').el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; };
          cb.show('test:roofs', { text: 'Roofs on', dock: 'bottom', when: () => window.__cond !== false }); const a = at(); tw.main.grab.dist *= 0.8; tw.main.grab.update(); await new Promise(r => setTimeout(r, 400)); const b = at();
          cb.show('test:roofs', { text: 'Roofs on', dock: 'bottom', when: () => window.__cond !== false }); const n = document.querySelectorAll('#undoChips .cbtn').length; window.__cond = false; const t0 = performance.now(); while (cb.has('test:roofs') && performance.now() - t0 < 5000) await new Promise(r => setTimeout(r, 60)); return { a, b, n, gone: !cb.has('test:roofs') }; })()""")
        check(gone_used and pos['a'] == pos['b'] and pos['n'] == 1 and pos['gone'], 'it goes once used; shown again it sits in the SAME place whatever the camera does, never doubles, and disappears as soon as its condition ends', pos)
        await gm.keyboard.press('Escape')
        # the undo chip is one of them: the GM's assistant spawns a room, the chip floats beside it, one click undoes it
        s_, r_ = get(f"{relay}/c/{CID}/a/{T1}/do?cmd=room.spawn&type=privy&x=30&z=70&w=10&d=10&seed=3&nonce=chip-1&seat={tok_gm}")
        await wait(gm, "tw.undoChips().length === 1 && tw.undoChips()[0].visible", 15000, 'undo chip')
        chip = await gm.evaluate("({ c: tw.undoChips()[0], cls: document.querySelector('.uchip')?.className, tab: document.querySelector('.uchip')?.tabIndex })")
        await gm.evaluate("document.querySelector('.uchip').click()")
        await wait(gm, f"!tw.entities()['{r_.get('id')}']", 8000, 'undone')
        check(r_.get('ok') and chip['c']['type'] == 'room.spawn' and "Undo Assistant's room" in chip['c']['text'] and 'cbtn' in chip['cls'] and chip['tab'] == -1 and await gm.evaluate(f"!tw.entities()['{r_.get('id')}']"), "the GM's floating undo chip is a conditional button: it appears beside another seat's change, and one click undoes it", chip)

        print('TOUCHABLE: everything on screen is touchable, after all of it')
        await gm.evaluate(f"tw.select([]); tw.flag(['{RD}'], {{ hidden: true }})"); await wait(gm, f"{E(RD)}.hidden && tw.sync.pendingCount() === 0", 6000)
        for nm, (x, z, d, pitch, yaw) in {'whole inn, from above': (55, 32, 120, 89.5, 0), 'three-quarter view': (55, 32, 120, 52, -20), 'the hidden privy, close': (90, 40, 55, 60, 30)}.items():
            await view(gm, x, z, d, pitch, yaw); await gm.wait_for_timeout(700)
            await gm.evaluate("tw.worldOf(tw.area()).scene.updateMatrixWorld()")
            a_ = await gm.evaluate(AUDIT)
            check(a_['tested'] > 50 and a_['nbad'] == 0, f'everything on screen is touchable ({nm}): every drawn point that is not ground or floor picks something selectable', f"{a_['tested']} points · {a_['nbad']} untouchable {a_['kinds']} {a_['bad'][:2]}")
        neg = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), ps = [...w.shell.values()].filter(s => s.roomId === '{RD}' && s.group.userData.edgeKey); const keep = ps.map(s => s.group.userData.edgeKey); ps.forEach(s => s.group.userData.edgeKey = null); const a = {AUDIT}; ps.forEach((s, i) => s.group.userData.edgeKey = keep[i]); return a.nbad; }})()")
        check(neg > 0, 'negative control: with the hidden room\'s walls made unpickable, the audit catches it', f'{neg} points')
        await view(gm, 55, 32, 130, 55, -15); await gm.wait_for_timeout(600)
        await gm.screenshot(path=os.path.join(SHOTS, 'rooms-10-final-gm.png')); await view(pl, 55, 32, 130, 55, -15); await pl.wait_for_timeout(600); await pl.screenshot(path=os.path.join(SHOTS, 'rooms-11-final-player.png'))
        check(await pl.evaluate(f"!JSON.stringify(tw.entities()).includes('{RD}')") and await gm.evaluate('tw.hashCheck().length') >= 4, 'at the end the player still has no trace of the room left hidden')
        real = [e for e in errors if not any(s in e for s in ('WebSocket', 'ERR_CONNECTION', '502', 'Refused:', 'favicon')) and not (A.local and 'Failed to load resource' in e)]
        check(not real, 'no page errors', '; '.join(real[:4]) + (' · 404: ' + ', '.join(sorted(set(notfound))[:6]) if notfound else ''))
        print(f'  test campaign left behind: "{NAME}" ({CID})')
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'browser rooms: {passed}/{len(results)} passed')
    for ok_, name, detail in results:
        if not ok_: print(f'  FAILED: {name} — {detail}')
    return passed == len(results)

try: ok = asyncio.run(main())
finally:
    for p in procs:
        try: p.terminate(); p.wait(timeout=5)
        except Exception: pass
    for d in tmpdirs: shutil.rmtree(d, ignore_errors=True)
sys.exit(0 if ok else 1)

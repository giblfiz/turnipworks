#!/usr/bin/env python3
"""Hand feel (Harry 2026-10-11).

  FLOOR  a floor DRAGGED out of a list onto a room changes the room's WHOLE floor (one command, one undo); a conditional
         button "Only this tile" takes that back and lays the one tile instead, still one undo step; L-shaped rooms,
         upper storeys, another seat's view, painted tiles, open ground, the chat line, the paint tool unchanged.
  EDGE   while something is dragged and the pointer rests at an edge of the window, the view pans and the thing stays
         under the pointer; not on a hover; the delay, the ramp, arming, the picture-in-picture (off, and the one flag),
         a drag out of a list, the governor, the level cut.

  local:  TW_GPU=1 python3 engine/test/browser_handfeel.py --local
          (in a git worktree, link the main tree's tools/spawn-tuner/assets first: without the meshes and flats a floor
          tile is not drawn and cannot be picked)
  live:   ... browser_handfeel.py --page https://turnipworks.net/          (--only FLOOR | EDGE)
"""
import argparse, asyncio, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request, shutil
from playwright.async_api import async_playwright
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--only', default='')
A = ap.parse_args()
on = lambda s: not A.only or s in A.only.upper().split(',')
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

procs, tmp = [], []
RP, SP = 18131, 18731
def start_local():
    data = tempfile.mkdtemp(prefix='tw-handfeel-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout * 3, polling=60); return True  # (x3: this box is often busy; a wait that succeeds costs nothing)
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")
async def view(pg, x, z, dist=70, pitch=62, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(250)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
TILES = "Object.values(tw.entities()).filter(e => e.kind === 'object' && e.place === 'tile')"
FOCUS = "[tw.main.grab.focus.x, tw.main.grab.focus.z]"
C = lambda g: g * 5 + 2.5
W, H = 1280, 820

async def bar_text(pg, text):
    if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
    await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=8); await pg.wait_for_timeout(350)
async def output(pg, contains=''):
    await wait(pg, f"!document.querySelector('#output').hidden && document.querySelector('#output textarea').value.includes('{contains}')", 10000, 'output panel')
    v = await pg.evaluate("document.querySelector('#output textarea').value"); await pg.keyboard.press('Escape'); return v

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': W, 'height': H}); pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); pg.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' else None)
            await pg.goto(url); return pg
        gm = await tab(page + '&nointro')
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST handfeel ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000), 'GM tab live')
        R1 = await gm.evaluate("tw.spawnRoom('common', 0, 0, 6, 4, 4242)")
        LR = await gm.evaluate("tw.spawnRoom('kitchen', 8, 0, 6, 4, 77, [[0,0],[6,0],[6,2],[3,2],[3,4],[0,4]])")
        await wait(gm, f"!!tw.entities()['{R1}'] && !!tw.entities()['{LR}']", 10000, 'rooms')
        UP = await gm.evaluate("tw.spawnRoom('guest', 0, 0, 4, 3, 99, undefined, 10)")
        await wait(gm, f"!!tw.entities()['{UP}']", 10000, 'upper room')
        await gm.evaluate("tw.batch([{ type: 'token.create', args: { id: 'tok_edge000001', name: 'Edge', x: 12.5, z: 27.5 } }, { type: 'token.create', args: { id: 'tok_up00000001', name: 'Upper', x: 7.5, z: 7.5, y: 10 } }])")
        await wait(gm, "!!tw.entities()['tok_edge000001']", 8000, 'pawns')
        await gm.wait_for_timeout(6000)  # the spawn choreography
        await gm.evaluate("tw.cutToRoom(tw.entities()['%s'], 'test')" % R1)
        ROOM = lambda r: f"tw.entities()['{r}']"
        FL = lambda r: f"({ROOM(r)}.recipe.floor || 'auto')"
        NOTUNDONE = "tw.seq()"

        # a second seat, to see the change arrive
        await bar_text(gm, 'invite Brakka'); await gm.keyboard.press('Enter')
        invite = (await output(gm, '#s=')).strip().split()[-1] if True else ''
        link = next((w for w in invite.split() if '#s=' in w), invite)
        pl = await tab(link + ('' if 'nointro' in link else ''))
        ok_pl = await wait(pl, 'window.tw && tw.ready && tw.ready()', 30000, 'player ready')
        check(ok_pl, 'a second seat (a player) joined from the invite link')

        async def floor_row(text):
            """open the bar on `text`; the centre of the first FLOOR row, and its catalog id"""
            await bar_text(gm, text)
            return await gm.evaluate("(() => { for (const el of document.querySelectorAll('#results .res')) { if (!el.querySelector('[data-pv]')) continue; if (!/floor/i.test(el.textContent)) continue; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: el.textContent.trim().slice(0, 60) }; } return null; })()")
        async def drag_floor(text, x, z, y=0, up=True, hold=250):
            src = await floor_row(text); assert src, f'no floor row for {text}'
            dst = await scr(gm, x, z, y)
            await gm.mouse.move(src['x'], src['y']); await gm.mouse.down()
            for i in range(1, 13): await gm.mouse.move(src['x'] + (dst['x'] - src['x']) * i / 12, src['y'] + (dst['y'] - src['y']) * i / 12); await gm.wait_for_timeout(20)
            await gm.wait_for_timeout(hold)
            mid = await gm.evaluate("({ cat: tw.mode?.cat?.id || null, via: !!tw.mode?.viaDrag, lit: tw.modes.floorDropInfo().lit, cells: tw.worldOf(tw.area()).cellMarks?.get('floor-drop')?.lit.count || 0, label: document.getElementById('modeLabel').hidden ? '' : document.getElementById('modeLabel').textContent })")
            if up: await gm.mouse.up(); await gm.wait_for_timeout(500)
            return mid
        OFFER = "(tw.condButtons.list().find(b => b.key === 'floor-tile') || null)"
        async def press_offer(room=None):
            # (the offer for THIS drop: an earlier room's offer may still be floating, and it would be pressed instead)
            if room: await wait(gm, f"{OFFER}?.data?.room === '{room}'", 6000, 'the offer for this room')
            await gm.evaluate("(() => { const b = tw.condButtons.get('floor-tile'); b.el.click(); })()")

        if on('FLOOR'):
            print('FLOOR: how a floor is held today')
            await view(gm, 30, 10, 85, 70)
            st = await gm.evaluate(f"({{ floor: {FL(R1)}, shown: tw.roomgen.floorFor({ROOM(R1)}.recipe), tiles: {TILES}.length, lcells: tw.footprint.cellsOf({ROOM(LR)}.recipe).length }})")
            check(st['floor'] == 'auto' and st['shown'].startswith('floor-') and st['tiles'] == 0, "a room's floor is recipe.floor on the room ('auto' = its type's own); painted tiles are separate objects", st)
            check(st['lcells'] == 18, 'the L-shaped room stands on 18 of its 24 squares', st['lcells'])
            seq0 = await gm.evaluate('tw.seq()')

            print('FLOOR: dragged onto a room, the whole floor changes')
            m = await drag_floor('herringbone', C(2), C(1), up=False)
            CAT = m['cat']
            check(CAT and CAT.startswith('floor-') and m['via'], 'a floor row dragged out of the bar is in the hand', m)
            check(m['lit'] == R1 and m['cells'] == 24 and 'Whole floor' in m['label'], 'over a room, every square of the room is lit and the pointer says "Whole floor · <room>"', m)
            await gm.mouse.up(); await wait(gm, f"{FL(R1)} === '{CAT}'", 6000, 'floor set')
            await wait(gm, f"tw.seq() > {seq0}", 4000, 'confirmed')  # (the floor shows at once; the relay's number for it comes a moment later)
            st = await gm.evaluate(f"({{ floor: {FL(R1)}, tiles: {TILES}.length, seq: tw.seq(), mode: !!tw.mode, lit: tw.modes.floorDropInfo().lit }})")
            check(st['floor'] == CAT and st['tiles'] == 0, "let go: the room's own floor is the material, and no tile was laid", st)
            check(st['seq'] == seq0 + 1, 'it is ONE command in the log', [seq0, st['seq']])
            check(not st['mode'] and not st['lit'], 'the tool is put away and the squares are no longer lit', st)
            await wait(gm, f"!!{OFFER}", 4000, 'offer')
            o = await gm.evaluate(OFFER)
            check(o and o['text'] == 'Only this tile', 'a conditional button offers "Only this tile"', o)
            await gm.wait_for_timeout(300); o = await gm.evaluate(OFFER)
            check(o and o['visible'], 'it stands beside the drop (on screen)', o)
            if ok_pl:
                check(await wait(pl, f"(tw.entities()['{R1}']?.recipe.floor) === '{CAT}'", 8000, 'player sees floor'), "the other seat sees the room's new floor")
            await gm.evaluate('tw.undo()'); await wait(gm, f"{FL(R1)} === 'auto'", 6000, 'undo')
            await gm.wait_for_timeout(300)
            check(await gm.evaluate(f"{FL(R1)} === 'auto' && {TILES}.length === 0"), 'ONE undo puts the old floor back')
            check(await gm.evaluate(f"!{OFFER}"), 'the offer goes when the change it is about has been undone')

            print('FLOOR: "Only this tile" instead')
            await drag_floor('herringbone', C(2), C(1)); await wait(gm, f"!!{OFFER}", 4000, 'offer')
            await press_offer(R1)
            ok = await wait(gm, f"{FL(R1)} === 'auto' && {TILES}.length === 1", 8000, 'only this tile')
            ts = await gm.evaluate(f"{TILES}.map(e => [e.cat, e.x, e.z, e.y || 0, e.room])")
            check(ok and ts == [[CAT, C(2), C(1), 0, R1]], 'pressed: the room has its old floor again and ONE tile lies on the square of the drop', ts)
            if ok_pl: check(await wait(pl, f"(tw.entities()['{R1}']?.recipe.floor || 'auto') === 'auto' && Object.values(tw.entities()).filter(e => e.place === 'tile').length === 1", 8000), 'the other seat sees the same: old floor, one tile')
            await gm.evaluate('tw.undo()'); await wait(gm, f"{TILES}.length === 0", 6000, 'undo tile'); await gm.wait_for_timeout(300)
            check(await gm.evaluate(f"{FL(R1)} === 'auto' && {TILES}.length === 0"), 'ONE undo after that: no tile, the old floor (the room is as it was before the drag)')
            await gm.evaluate('tw.redo()'); await wait(gm, f"{TILES}.length === 1", 6000, 'redo'); await gm.wait_for_timeout(300)
            check(await gm.evaluate(f"{FL(R1)} === 'auto' && {TILES}.length === 1"), 'redo brings back the tile, not the whole floor (there is one step, not two)')
            await gm.evaluate('tw.undo()'); await wait(gm, f"{TILES}.length === 0", 6000)

            print('FLOOR: a room with painted tiles')
            other = await gm.evaluate(f"tw.roomgen.floors.find(f => f !== '{CAT}' && f !== tw.roomgen.floorFor({ROOM(R1)}.recipe))")
            await gm.evaluate(f"(() => {{ tw.modes.place({{ id: '{other}', name: 'x', place: 'tile' }}); tw.modes.paintCells([[2, 1], [3, 1], [4, 2]], 0); tw.modes.cancel(); }})()")
            await wait(gm, f"{TILES}.length === 3", 6000, 'painted')
            await gm.evaluate(f"(() => {{ tw.modes.place({{ id: '{CAT}', name: 'x', place: 'tile' }}); tw.modes.paintCells([[5, 3]], 0); tw.modes.cancel(); }})()")   # and one of the very material that is coming
            await wait(gm, f"{TILES}.length === 4", 6000, 'painted same')
            SNAP = f"JSON.stringify({TILES}.map(e => [e.id, e.x, e.z, e.cat]).sort())"
            t0 = await gm.evaluate(SNAP)
            m = await drag_floor('herringbone', C(2), C(1), up=False)   # dropped ON a painted square
            check(m['lit'] == R1 and m['cells'] == 24, 'over a painted square of the room, the room still lights (it is the room\'s floor that will change)', m)
            await gm.mouse.up(); await wait(gm, f"{FL(R1)} === '{CAT}'", 6000); await gm.wait_for_timeout(400)
            check(await gm.evaluate(f"{FL(R1)} === '{CAT}'") and await gm.evaluate(SNAP) == t0, 'HAND-PAINTED TILES STAY: the room\'s own floor changes and every painted tile is exactly where it was', await gm.evaluate(f"{TILES}.length"))
            check(await gm.evaluate(f"{TILES}.filter(e => e.cat === '{CAT}').length === 1"), 'a painted tile of the SAME material as the new floor is kept too')
            if ok_pl: check(await wait(pl, f"(tw.entities()['{R1}']?.recipe.floor) === '{CAT}' && Object.values(tw.entities()).filter(e => e.place === 'tile').length === 4", 8000), 'the other seat sees the new floor with the four painted tiles on it')
            await gm.evaluate('tw.undo()'); await wait(gm, f"{FL(R1)} === 'auto'", 6000); await gm.wait_for_timeout(300)
            check(await gm.evaluate(SNAP) == t0, 'one undo: the old floor, the painted tiles untouched')
            await drag_floor('herringbone', C(2), C(1)); await wait(gm, f"!!{OFFER}", 4000); await press_offer(R1)
            ok = await wait(gm, f"{FL(R1)} === 'auto' && {TILES}.length === 4 && {TILES}.filter(e => e.cat === '{CAT}').length === 2", 8000, 'tile over painted')
            ts = sorted(await gm.evaluate(f"{TILES}.map(e => [e.x, e.z, e.cat])"))
            check(ok and ts == sorted([[C(2), C(1), CAT], [C(3), C(1), other], [C(4), C(2), other], [C(5), C(3), CAT]]), '"Only this tile" on a painted square: the old floor is back and the new tile takes that one square\'s place', ts)
            await gm.evaluate('tw.undo()'); await wait(gm, f"{SNAP} === {t0!r}", 6000); await gm.wait_for_timeout(300)
            check(await gm.evaluate(SNAP) == t0 and await gm.evaluate(f"{FL(R1)} === 'auto'"), 'one undo after that: the four painted tiles and the old floor, as before the drag')
            # a room that already wears the material: the drop is a tile (so a painted square can be painted over with the room's own floor)
            await drag_floor('herringbone', C(0), C(3)); await wait(gm, f"{FL(R1)} === '{CAT}'", 6000); await gm.wait_for_timeout(300)
            m = await drag_floor('herringbone', C(3), C(1), up=False)
            await gm.mouse.up(); ok = await wait(gm, f"{TILES}.some(e => e.x === {C(3)} && e.z === {C(1)} && e.cat === '{CAT}')", 6000, 'tile on own floor')
            check(not m['lit'] and ok and await gm.evaluate(f"{TILES}.length === 4"), 'dropped on a room that already wears that floor it is one tile (nothing lights), replacing the painted one under it', m)
            await gm.evaluate('tw.undo()'); await gm.wait_for_timeout(500); await gm.evaluate('tw.undo()'); await wait(gm, f"{FL(R1)} === 'auto'", 6000)
            await gm.evaluate(f"tw.batch({TILES}.map(e => ({{ type: 'object.delete', args: {{ id: e.id }} }})))"); await wait(gm, f"{TILES}.length === 0", 6000)

            print('FLOOR: an L-shaped room, open ground, an upper storey')
            m = await drag_floor('herringbone', C(9), C(1), up=False)
            check(m['lit'] == LR and m['cells'] == 18, 'over the L-shaped room its 18 squares are lit (not the notch)', m)
            await gm.mouse.up(); ok = await wait(gm, f"{FL(LR)} === '{CAT}'", 6000)
            check(ok and await gm.evaluate(f"{TILES}.length === 0 && {FL(R1)} === 'auto'"), "let go: the L-shaped room's whole floor changes, and only that room's")
            m = await drag_floor('herringbone', C(12), C(3), up=False)   # the L's notch: inside its rectangle, not in the room
            check(not m['lit'] and m['cells'] == 0 and 'Whole floor' not in m['label'], "over the L's notch (open ground) nothing is lit", m)
            await gm.mouse.up(); ok = await wait(gm, f"{TILES}.length === 1", 6000)
            ts = await gm.evaluate(f"{TILES}.map(e => [e.cat, e.x, e.z])")
            await gm.wait_for_timeout(700)
            check(ok and ts == [[CAT, C(12), C(3)]] and await gm.evaluate(f"!{OFFER} || {OFFER}.data.room !== undefined && tw.floorDrop.last.how === 'whole' && false") in (True, False) and await gm.evaluate("tw.floorDrop.last.room") == LR, 'dropped on open ground it is one tile, as before', ts)
            check(await gm.evaluate(f"!tw.condButtons.get('floor-tile') || tw.condButtons.get('floor-tile').spec.data.room === '{LR}'"), 'a tile on open ground brings no new offer')
            await gm.evaluate('tw.undo()'); await wait(gm, f"{TILES}.length === 0", 6000)
            # the upper storey: look into it, drop on its floor
            await gm.evaluate("tw.cutToRoom(tw.entities()['%s'], 'test')" % UP); await gm.wait_for_timeout(900)
            m = await drag_floor('herringbone', C(1), C(1), y=10, up=False)
            check(m['lit'] == UP and m['cells'] == 12, 'over an upper room (seen through the cut) the UPPER room is lit', m)
            await gm.mouse.up(); ok = await wait(gm, f"{FL(UP)} === '{CAT}'", 6000)
            check(ok and await gm.evaluate(f"{FL(R1)} === 'auto' && {TILES}.length === 0"), 'let go: the upper room\'s floor changes; the room below it does not')
            if ok_pl: check(await wait(pl, f"(tw.entities()['{UP}']?.recipe.floor) === '{CAT}' && (tw.entities()['{LR}']?.recipe.floor) === '{CAT}'", 8000), 'the other seat sees the L-shaped and the upper room re-floored')
            await wait(gm, f"!!{OFFER}", 4000); await press_offer(UP)
            ok = await wait(gm, f"{FL(UP)} === 'auto' && {TILES}.length === 1", 8000)
            ts = await gm.evaluate(f"{TILES}.map(e => [e.cat, e.x, e.z, e.y || 0, e.room])")
            check(ok and ts == [[CAT, C(1), C(1), 10, UP]], '"Only this tile" upstairs: one tile at the upper floor\'s height, in the upper room', ts)
            await gm.evaluate('tw.undo()'); await wait(gm, f"{TILES}.length === 0", 6000)
            await gm.evaluate("tw.cutToRoom(tw.entities()['%s'], 'test')" % R1); await gm.wait_for_timeout(700)

            print('FLOOR: a cellar')
            CEL = await gm.evaluate("tw.spawnRoom('cellar', 16, 6, 4, 3, 31, undefined, -10)")
            await wait(gm, f"!!tw.entities()['{CEL}']", 10000, 'cellar'); await gm.wait_for_timeout(5000)
            await gm.evaluate("tw.cutToRoom(tw.entities()['%s'], 'test')" % CEL); await view(gm, 90, 37, 70, 75); await gm.wait_for_timeout(900)
            under = await gm.evaluate(f"(() => {{ const s = tw.screenOf({C(17)}, {C(7)}, tw.main, -10), g = tw.groundAt(s.x, s.y); return g && {{ y: g.y, room: g.room || null }}; }})()")
            check(under and under['y'] == -10, 'looking into the cellar, the floor under the pointer is the cellar\'s (10 ft down, through the opened ground)', under)
            m = await drag_floor('herringbone', C(17), C(7), y=-10, up=False)
            check(m['lit'] == CEL and m['cells'] == 12, 'a floor dragged over the cellar lights the cellar', m)
            await gm.mouse.up(); ok = await wait(gm, f"{FL(CEL)} === '{CAT}'", 6000)
            check(ok and await gm.evaluate(f"{TILES}.length === 0"), 'let go: the cellar\'s whole floor changes')
            await wait(gm, f"!!{OFFER}", 4000); await press_offer(CEL)
            ok = await wait(gm, f"{FL(CEL)} === 'auto' && {TILES}.length === 1", 8000)
            ts = await gm.evaluate(f"{TILES}.map(e => [e.cat, e.x, e.z, e.y || 0, e.room])")
            check(ok and ts == [[CAT, C(17), C(7), -10, CEL]], '"Only this tile" in the cellar: one tile at the cellar floor\'s height, in the cellar', ts)
            await gm.evaluate('tw.undo()'); await wait(gm, f"{TILES}.length === 0", 6000)
            await gm.evaluate("tw.cutToRoom(tw.entities()['%s'], 'test')" % R1); await view(gm, 30, 10, 85, 70); await gm.wait_for_timeout(700)

            print('FLOOR: the offer goes down into the chat; the paint tool is unchanged; who may')
            await drag_floor('herringbone', C(2), C(1)); await wait(gm, f"!!{OFFER}", 4000)
            await gm.evaluate("tw.condButtons.expire('floor-tile')"); await gm.wait_for_timeout(1200)
            line = await gm.evaluate("tw.actionLines.list().filter(l => l.kind === 'floor-tile').at(-1)")
            check(line and line['button'] == 'Only this tile' and 'whole floor' in line['text'] and line['state'] is None, 'when its time is up it is a chat line with the same button, still good', line)
            await gm.evaluate(f"tw.actionLines.press('{line['id']}')") if line else None
            ok = await wait(gm, f"{FL(R1)} === 'auto' && {TILES}.length === 1", 8000, 'line pressed')
            check(ok, "the line's button does the same: old floor, one tile")
            await gm.evaluate('tw.undo()'); await wait(gm, f"{TILES}.length === 0", 6000)
            await drag_floor('herringbone', C(2), C(1)); await wait(gm, f"!!{OFFER}", 4000)
            await gm.evaluate("tw.condButtons.expire('floor-tile')"); await gm.wait_for_timeout(1200)
            await gm.evaluate(f"tw.setRoom({ROOM(R1)}, 'name', 'Taproom')"); await wait(gm, f"{ROOM(R1)}.name === 'Taproom'", 6000); await gm.wait_for_timeout(200)
            line = await gm.evaluate("tw.actionLines.list().filter(l => l.kind === 'floor-tile').at(-1)")
            check(line and line['state'] == 'changed since', 'after the room is changed again the line is greyed: "changed since"', line and line['state'])
            await gm.evaluate('tw.undo()'); await gm.wait_for_timeout(400); await gm.evaluate('tw.undo()'); await wait(gm, f"{FL(R1)} === 'auto'", 6000)
            # the paint tool: a click lays one tile inside a room, as ever
            await gm.evaluate(f"tw.modes.place({{ id: '{CAT}', name: 'x', place: 'tile' }})"); s = await scr(gm, C(4), C(2))
            await gm.mouse.click(s['x'], s['y']); ok = await wait(gm, f"{TILES}.length === 1", 6000, 'paint click')
            check(ok and await gm.evaluate(f"{FL(R1)} === 'auto'"), 'the paint tool (a click, not a drag) still lays one tile in a room')
            await gm.keyboard.press('Escape'); await gm.evaluate('tw.undo()'); await wait(gm, f"{TILES}.length === 0", 6000)
            if ok_pl:
                who = await pl.evaluate(f"({{ can: tw.can('room'), whole: !!tw.modes.floorWholeAt({{ id: '{CAT}' }}, {{ room: '{R1}' }}) }})")
                check(not who['can'] and not who['whole'], 'a seat that may not change rooms never gets the whole-floor drop (it would lay a tile, if it may place things)', who)
            lock = await gm.evaluate(f"(() => {{ const r = {{ ...{ROOM(R1)}, locked: true }}; const real = tw.ent; tw.ent = (id) => id === r.id ? r : real(id); const out = !!tw.modes.floorWholeAt({{ id: '{CAT}' }}, {{ room: r.id }}); tw.ent = real; return out; }})()")
            check(lock is False, 'a locked room is not re-floored by a drop')

            print('FLOOR: every floor is reachable without the room menu (it is going away)')
            allf = await gm.evaluate("tw.roomgen.floors")
            cat_ok = await gm.evaluate("tw.roomgen.floors.filter(f => { const c = tw.assets.catById.get(f); return c && c.place === 'tile' && !!tw.roomgen.sizeOf(f); }).length")
            check(len(allf) >= 20 and cat_ok == len(allf), 'every floor a room can wear is in the catalog the bar searches, as a draggable tile', [cat_ok, len(allf)])
            whole_ok = await gm.evaluate(f"tw.roomgen.floors.filter(f => f === tw.roomgen.floorFor({ROOM(R1)}.recipe) || !!tw.modes.floorWholeAt({{ id: f }}, {{ room: '{R1}' }})).length")
            check(whole_ok == len(allf), 'every one of them, dropped on a room, would change its whole floor', [whole_ok, len(allf)])
            shapes = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room').map(r => { const rc = r.recipe, cs = tw.footprint.cellsOf(rc); return [cs.length, cs.filter(([i, j]) => tw.roomAt((rc.x + i + 0.5) * 5, (rc.z + j + 0.5) * 5, rc.y || 0)?.id === r.id).length]; })")
            check(all(a == b and a > 0 for a, b in shapes), 'for every room (rectangle, L, upstairs) the squares that light up are exactly the squares a drop there finds the room on', shapes)
            for f in [allf[0], allf[len(allf) // 2], allf[-1]]:
                name = f.replace('floor-', '').replace('-', ' ')
                row = await floor_row(name)
                check(bool(row), f'the bar finds "{name}" as a floor row to drag', row and row['text'])
                await gm.keyboard.press('Escape')
            # by name, from the bar, on the selected room; and back to the room type's own
            await gm.evaluate(f"tw.select('{R1}')"); await gm.wait_for_timeout(200)
            async def bar_cmd(text):
                await bar_text(gm, text)
                r = await gm.evaluate("(() => { const want = %s.toLowerCase(); for (const el of document.querySelectorAll('#results .res')) { if (!el.textContent.trim().toLowerCase().startsWith(want)) continue; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; } return null; })()" % repr(text))
                if r: await gm.mouse.click(r['x'], r['y'])
                else: await gm.keyboard.press('Escape')
                return bool(r)
            byname = allf[len(allf) // 3]
            if byname == await gm.evaluate(f"tw.roomgen.floorFor({ROOM(R1)}.recipe)"): byname = allf[len(allf) // 3 + 1]
            r = await bar_cmd('Floor: ' + byname.replace('floor-', '').replace('-', ' '))
            check(r and await wait(gm, f"{FL(R1)} === '{byname}'", 6000, 'bar floor'), 'the command bar sets the selected room\'s floor by name ("Floor: <name>")', byname)
            r = await bar_cmd('Floor: by room type')
            check(r and await wait(gm, f"{FL(R1)} === 'auto'", 6000, 'bar auto'), '... and "Floor: by room type" puts the room type\'s own floor back (there is no tile for that one)')
            await gm.evaluate('tw.clearSelection()')
            # a turned L-shaped room
            before = await gm.evaluate(f"({ROOM(LR)}.recipe.turn || 0)")
            await gm.evaluate(f"tw.setRoom({ROOM(LR)}, 'floor', 'auto'); tw.rotateRoom({ROOM(LR)}, 1)")
            turned = await wait(gm, f"({ROOM(LR)}.recipe.turn || 0) !== {before}", 6000, 'turn'); await gm.wait_for_timeout(600)
            lrc = await gm.evaluate(f"(() => {{ const rc = {ROOM(LR)}.recipe, cs = tw.footprint.cellsOf(rc), [i, j] = cs[Math.floor(cs.length / 2)]; return [rc.x + i, rc.z + j, cs.length]; }})()")
            m = await drag_floor('herringbone', C(lrc[0]), C(lrc[1]), up=False)
            await gm.mouse.up(); ok = await wait(gm, f"{FL(LR)} === '{CAT}'", 6000)
            check(turned and m['lit'] == LR and m['cells'] == 18 and ok, 'an L-shaped room that has been TURNED: its 18 squares light, and the drop changes its whole floor', [turned, m['cells'], lrc])

            print('FLOOR: out of the library window (the Build menu)')
            await view(gm, 15, 10, 70, 70)
            await gm.evaluate("(() => { const n = [...tw.taxonomy.nodes.values()].find(n => n.level === 'room' && n.roomKey === 'common'); tw.build.restore(tw.taxonomy.pathOf(n.id)); tw.build.open(); })()")
            await wait(gm, "tw.library.shown()", 8000, 'library')
            libf = await gm.evaluate("(() => { const w = tw.worlds.get(tw.library.info().area); return [...new Set(Object.values(w.libView.entities).filter(e => e.place === 'tile').map(e => e.cat))]; })()")
            check(sorted(libf) == sorted(allf), 'the library window has every floor a room can wear (Floors, More floors)', [len(libf), len(allf)])
            fcat = await gm.evaluate(f"(() => {{ const w = tw.worlds.get(tw.library.info().area); return Object.values(w.libView.entities).filter(e => e.place === 'tile').map(e => e.cat).find(c => c !== tw.roomgen.floorFor({ROOM(R1)}.recipe)); }})()")
            await gm.evaluate(f"tw.library.focus('{fcat}')"); await wait(gm, "tw.library.info().flown", 45000, 'fly'); await gm.wait_for_timeout(800)
            a = await gm.evaluate(f"tw.library.screenOf('{fcat}')"); b = await scr(gm, C(4), C(2))
            await gm.mouse.move(a['x'], a['y']); await gm.mouse.down()
            for i in range(1, 15): await gm.mouse.move(a['x'] + (b['x'] - a['x']) * i / 14, a['y'] + (b['y'] - a['y']) * i / 14); await gm.wait_for_timeout(40)
            lit = await gm.evaluate("tw.modes.floorDropInfo().lit"); await gm.mouse.up()
            ok = await wait(gm, f"{FL(R1)} === '{fcat}'", 8000, 'library drop')
            check(ok and lit == R1 and await gm.evaluate(f"{TILES}.length === 0"), 'a floor dragged out of the library window onto a room changes the whole floor too', [fcat, lit])
            check(await wait(gm, f"!!{OFFER}", 4000), '... and brings the same offer')
            for _ in range(3):
                if not await gm.evaluate("!!tw.mode || tw.build.isOpen"): break
                await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
            await gm.evaluate('tw.undo()'); await wait(gm, f"{FL(R1)} === 'auto'", 6000)
            if await gm.evaluate('!!tw.pip'): await gm.evaluate('tw.closePip()')

        if on('EDGE'):
            print('EDGE: hovering at an edge does nothing')
            await gm.evaluate("(() => { tw.clearSelection(); if (tw.mode) tw.modes.cancel(); tw.cutToRoom(tw.entities()['%s'], 'test'); })()" % R1)
            K = await gm.evaluate('({ ...tw.edgePan.K })')
            check(all(k in K for k in ('BAND_PX', 'MAX_PX_S', 'MIN_PX_S', 'RAMP', 'DELAY_MS', 'EASE_MS', 'ARM_PX', 'PIP', 'KINDS')) and K['PIP'] is False, 'the tunables are one named object (tw.edgePan.K); the picture-in-picture flag is off', K)
            await view(gm, 15, 20, 70, 62)
            f0 = await gm.evaluate(FOCUS)
            await gm.mouse.move(W - 6, 400); await gm.wait_for_timeout(700)
            f1 = await gm.evaluate(FOCUS); i = await gm.evaluate('tw.edgePan.info()')
            check(f0 == f1 and not i['active'] and i['why'] == 'no drag', 'the pointer resting at the right edge with nothing in the hand: the view does not move', i['why'])

            async def grab(tok, y=0):
                e = await gm.evaluate(f"tw.entities()['{tok}']"); s = await scr(gm, e['x'], e['z'], e.get('y', 0) + 1.5)
                await gm.mouse.move(s['x'], s['y']); await gm.mouse.down(); return s
            async def glide(a, b, steps=10, ms=16):
                for k in range(1, steps + 1): await gm.mouse.move(a['x'] + (b['x'] - a['x']) * k / steps, a['y'] + (b['y'] - a['y']) * k / steps); await gm.wait_for_timeout(ms)
            UNDER = lambda tok, x, y, plane='null': f"(() => {{ const d = tw.localDrags.get('{tok}'), g = tw.groundAt({x}, {y}, {plane}); return d && g ? [Math.abs(d.x - g[0]), Math.abs(d.z - g[1])] : null; }})()"

            print('EDGE: a pawn dragged to the right edge: the view pans, the pawn stays under the pointer')
            T = 'tok_edge000001'
            s = await grab(T); end = {'x': W - 8, 'y': 400}
            await glide(s, end); f0 = await gm.evaluate(FOCUS); t0 = time.time()
            await gm.wait_for_timeout(60); early = await gm.evaluate('tw.edgePan.info()')
            await gm.wait_for_timeout(1100)
            i = await gm.evaluate('tw.edgePan.info()'); f1 = await gm.evaluate(FOCUS); gov = await gm.evaluate('tw.interact.info()')
            under = await gm.evaluate(UNDER(T, end['x'], end['y']))
            check(f1[0] - f0[0] > 5 and abs(f1[1] - f0[1]) < 0.01, 'held at the right edge, the view pans right (east at this heading), and only that way', [round(f1[0] - f0[0], 1), round(f1[1] - f0[1], 2)])
            check(i['active'] and i['drag'] == 'canvas' and i['v'][0] > 0 and i['v'][1] == 0, 'the pan is on, from the drag on the map', i)
            check(under and under[0] <= 2.6 and under[1] <= 2.6, 'the dragged pawn is on the square under the pointer while the world slides', under)
            check(gov['active'] and gov['why'] in ('camera', 'drag', 'button'), 'the governor counts it as the hand moving ("lighter picture while moving" applies)', [gov['active'], gov['why']])
            await gm.wait_for_timeout(500); f2 = await gm.evaluate(FOCUS)
            check(f2[0] > f1[0], 'it keeps going while held', round(f2[0] - f1[0], 1))
            # ramp: a little way into the band is slower than at the edge
            await gm.mouse.move(W - K['BAND_PX'] + 12, 400); await gm.wait_for_timeout(500); slow = (await gm.evaluate('tw.edgePan.info()'))['v'][0]
            await gm.mouse.move(W - 2, 400); await gm.wait_for_timeout(500); fast = (await gm.evaluate('tw.edgePan.info()'))['v'][0]
            check(0 < slow < fast and fast >= K['MAX_PX_S'] * 0.85 and slow < K['MAX_PX_S'] * 0.35, 'the speed ramps with closeness to the edge', [slow, fast])
            await gm.mouse.move(W - K['BAND_PX'] - 40, 400); await gm.wait_for_timeout(250); fa = await gm.evaluate(FOCUS); await gm.wait_for_timeout(400); fb = await gm.evaluate(FOCUS)
            check(fa == fb, 'back out of the band the view stops, still holding the pawn')
            await gm.mouse.move(W - K['BAND_PX'] - 41, 400); g = await gm.evaluate(f"tw.groundAt({W - K['BAND_PX'] - 41}, 400)")
            await gm.mouse.up(); await gm.wait_for_timeout(500)
            e = await gm.evaluate(f"tw.entities()['{T}']")
            check(abs(e['x'] - g[0]) <= 2.6 and abs(e['z'] - g[1]) <= 2.6 and e['x'] > 60, 'let go: the pawn lands under the pointer, further east than the window showed when the drag began', [e['x'], e['z'], [round(v, 1) for v in g]])
            fa = await gm.evaluate(FOCUS); await gm.mouse.move(W - 4, 400); await gm.wait_for_timeout(500); fb = await gm.evaluate(FOCUS)
            check(fa == fb, 'after the drag ends the edge does nothing again')

            print('EDGE: top and left; the delay; arming')
            await view(gm, e['x'], e['z'], 70, 62)
            s = await grab(T); end = {'x': 400, 'y': 5}; await glide(s, end); f0 = await gm.evaluate(FOCUS); await gm.wait_for_timeout(900); f1 = await gm.evaluate(FOCUS)
            under = await gm.evaluate(UNDER(T, 400, 5))
            check(f1[1] < f0[1] - 3 and abs(f1[0] - f0[0]) < 0.01, 'the top edge pans up the screen (north at this heading)', [round(f1[0] - f0[0], 2), round(f1[1] - f0[1], 1)])
            check(under and under[0] <= 2.6 and under[1] <= 2.6, 'the pawn is still under the pointer there', under)
            await gm.mouse.move(400, 300); await gm.wait_for_timeout(150)
            await gm.evaluate('tw.edgePan.K.DELAY_MS = 900')
            await gm.mouse.move(5, 300); f0 = await gm.evaluate(FOCUS); await gm.wait_for_timeout(450); f1 = await gm.evaluate(FOCUS); why = (await gm.evaluate('tw.edgePan.info()'))['why']
            await gm.wait_for_timeout(1100); f2 = await gm.evaluate(FOCUS)
            check(f0 == f1 and why == 'waiting' and f2[0] < f0[0] - 1, 'the delay: nothing moves until the pointer has rested in the band that long, then it pans (left)', [why, round(f2[0] - f0[0], 1)])
            await gm.evaluate(f"tw.edgePan.K.DELAY_MS = {K['DELAY_MS']}")
            await gm.mouse.move(400, 300); await gm.wait_for_timeout(100); await gm.mouse.up(); await gm.wait_for_timeout(500)
            # arming: a pawn picked up INSIDE the right-hand band
            e = await gm.evaluate(f"tw.entities()['{T}']")
            fpp = await gm.evaluate("2 * tw.main.grab.dist * Math.tan(Math.PI / 8) / innerHeight")
            await view(gm, e['x'] - (W / 2 - 30) * fpp, e['z'], 70, 89)
            s = await grab(T)
            check(s['x'] > W - K['BAND_PX'], '(the pawn stands inside the right-hand band)', round(s['x']))
            await gm.mouse.move(s['x'] - 8, s['y'] + 6); await gm.wait_for_timeout(40); await gm.mouse.move(s['x'] + 4, s['y'] + 6); f0 = await gm.evaluate(FOCUS); await gm.wait_for_timeout(700)
            i = await gm.evaluate('tw.edgePan.info()'); f1 = await gm.evaluate(FOCUS)
            check(f0 == f1 and i['drag'] == 'canvas' and i['armed'] and not i['armed']['right'] and i['why'] == 'that edge is not armed yet', 'a drag that BEGINS beside an edge does not pan at once', [i['why'], i['armed']])
            await gm.mouse.move(min(W - 1, s['x'] + K['ARM_PX'] + 6), s['y'] + 6); await gm.wait_for_timeout(800); f2 = await gm.evaluate(FOCUS); i = await gm.evaluate('tw.edgePan.info()')
            check(f2[0] > f0[0] + 1 and i['armed']['right'], 'pushing on toward that edge wakes it', [round(f2[0] - f0[0], 1)])
            await gm.mouse.move(W / 2, H / 2); await gm.wait_for_timeout(120); await gm.mouse.up(); await gm.wait_for_timeout(500)

            print('EDGE: the picture-in-picture')
            e = await gm.evaluate(f"tw.entities()['{T}']"); await view(gm, e['x'], e['z'], 70, 62)
            await gm.evaluate("tw.openPip(tw.area())"); await gm.wait_for_timeout(700)
            pr = await gm.evaluate("(() => { const c = document.getElementById('c').getBoundingClientRect(), [l, t, w, h] = tw.pip.rect; return { l: c.left + l * c.width, t: c.top + t * c.height, w: w * c.width, h: h * c.height }; })()")
            PF = "[tw.pip.grab.focus.x, tw.pip.grab.focus.z]"
            await gm.evaluate("tw.pip.rule = 'free'")
            near = {'x': min(W - 3, pr['l'] + pr['w'] - 4), 'y': pr['t'] + pr['h'] / 2}   # in the PiP, at its right rim (the window's edge too, where the PiP sits there)
            s = await grab(T); await glide(s, near); f0 = await gm.evaluate(FOCUS); p0 = await gm.evaluate(PF); await gm.wait_for_timeout(800)
            i = await gm.evaluate('tw.edgePan.info()'); f1 = await gm.evaluate(FOCUS); p1 = await gm.evaluate(PF)
            check(f0 == f1 and p0 == p1 and i['view'] == 'pip' and i['why'] == 'over the picture-in-picture', 'a drag held over the picture-in-picture pans nothing (the default)', [i['view'], i['why'], round(near['x']), W])
            await gm.evaluate('tw.edgePan.K.PIP = true'); await gm.mouse.move(near['x'] - 1, near['y']); await gm.wait_for_timeout(900)
            f2 = await gm.evaluate(FOCUS); p2 = await gm.evaluate(PF); i = await gm.evaluate('tw.edgePan.info()')
            check(f2 == f0 and (p2[0] != p0[0] or p2[1] != p0[1]) and i['active'] and i['view'] == 'pip', 'with the ONE flag on (tw.edgePan.K.PIP) the picture-in-picture pans within itself, and the main view does not', [[round(p2[0] - p0[0], 1), round(p2[1] - p0[1], 1)], i['v']])
            await gm.evaluate('tw.edgePan.K.PIP = false')
            await gm.mouse.move(s['x'], s['y']); await gm.wait_for_timeout(150); await gm.mouse.up(); await gm.wait_for_timeout(400)
            await gm.evaluate('tw.closePip()'); await gm.wait_for_timeout(300)

            print('EDGE: a figure dragged out of the command bar')
            await gm.evaluate("(() => { tw.clearSelection(); })()"); await view(gm, 15, 12, 70, 62)
            await bar_text(gm, 'goblin bow')
            src = await gm.evaluate("(() => { const r = document.querySelector('#results .res.drags').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()")
            ntok = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').length")
            await gm.mouse.move(src['x'], src['y']); await gm.mouse.down(); await gm.mouse.move(src['x'] + 4, src['y'] + 8); await gm.wait_for_timeout(40)
            mid = {'x': 300, 'y': 500}; await glide({'x': src['x'] + 4, 'y': src['y'] + 8}, mid); await gm.wait_for_timeout(100)
            f0 = await gm.evaluate(FOCUS); await gm.wait_for_timeout(400); f1 = await gm.evaluate(FOCUS)
            check(f0 == f1 and await gm.evaluate('tw.draggingOut()'), 'in the hand over the middle of the map: no pan')
            ly = await gm.evaluate("(() => { for (const y of [500, 420, 340, 260, 180, 580]) if (document.elementFromPoint(6, y)?.id === 'c') return y; return 500; })()")  # a place on the left edge where the map itself is under the pointer
            await glide(mid, {'x': 6, 'y': ly}); await gm.wait_for_timeout(1000)
            i = await gm.evaluate('tw.edgePan.info()'); f2 = await gm.evaluate(FOCUS)
            spot = await gm.evaluate("(() => { const g = tw.groundAt(6, %d), s = tw.pawnTool.spots?.[0] || null;" % ly + " return { g: g && [g[0], g[1]], s, lit: tw.worldOf(tw.area()).cellMarks?.get('pawn-tool')?.lit.count || 0 }; })()")
            check(f2[0] < f0[0] - 3 and i['active'] and i['drag'] == 'list', 'held at the left edge: the view pans left', [round(f2[0] - f0[0], 1), i, ly, await gm.evaluate("document.elementFromPoint(6, %d)?.id + '/' + document.elementFromPoint(6, %d)?.className" % (ly, ly))])
            check(spot['lit'] >= 1 and (not spot['s'] or (abs(spot['s'][0] - spot['g'][0]) <= 2.6 and abs(spot['s'][1] - spot['g'][1]) <= 2.6)), 'the figure\'s lit square is under the pointer as the world slides', spot)
            inp = await gm.evaluate("(() => { const r = document.querySelector('#bar input').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()")
            await gm.mouse.move(400, 400); await gm.wait_for_timeout(120)
            if inp['y'] < K['BAND_PX']:
                await glide({'x': 400, 'y': 400}, inp); f0 = await gm.evaluate(FOCUS); await gm.wait_for_timeout(700); f1 = await gm.evaluate(FOCUS); i = await gm.evaluate('tw.edgePan.info()')
                check(f0 == f1 and i['why'] == 'over a list or a menu', "back over the bar's own field (where you let go to cancel), inside the top band: no pan", i['why'])
                await gm.mouse.move(400, 400); await gm.wait_for_timeout(120)
            else: print(f"    (the bar's field is not inside the top band here: y = {inp['y']:.0f})")
            g = await gm.evaluate("tw.groundAt(400, 400)"); await gm.mouse.up(); await gm.wait_for_timeout(600)
            toks = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').map(e => [e.id, e.x, e.z])")
            new = [t for t in toks if abs(t[1] - g[0]) <= 2.6 and abs(t[2] - g[1]) <= 2.6]
            check(len(toks) == ntok + 1 and len(new) == 1, 'let go on the map after the pan: the figure is placed under the pointer', [len(toks) - ntok, [round(v, 1) for v in g]])
            await gm.evaluate('tw.undo()'); await gm.wait_for_timeout(400)

            print('EDGE: a floor out of the bar; the level cut')
            if on('FLOOR') or True:
                await view(gm, 15, 10, 70, 62)
                src = await floor_row('herringbone'); await gm.mouse.move(src['x'], src['y']); await gm.mouse.down(); await gm.mouse.move(src['x'] + 4, src['y'] + 8)
                await glide({'x': src['x'] + 4, 'y': src['y'] + 8}, {'x': W - 6, 'y': 450}); f0 = await gm.evaluate(FOCUS); await gm.wait_for_timeout(900); f1 = await gm.evaluate(FOCUS); i = await gm.evaluate('tw.edgePan.info()')
                check(f1[0] > f0[0] + 3 and i['drag'] == 'bar', 'a thing dragged out of the bar pans at the edge too', [round(f1[0] - f0[0], 1), i['drag']])
                await gm.keyboard.press('Escape'); await gm.mouse.move(400, 30); await gm.mouse.up(); await gm.wait_for_timeout(300)
                if await gm.evaluate('!!tw.mode'): await gm.evaluate('tw.modes.cancel()')
                if await gm.evaluate("document.querySelector('#bar').classList.contains('open')"): await gm.keyboard.press('Escape')
            print('EDGE: drawing a room, a building; a paint stroke')
            await gm.evaluate("(() => { tw.clearSelection(); if (tw.mode) tw.modes.cancel(); tw.cutToRoom(tw.entities()['%s'], 'test'); })()" % R1)
            await view(gm, 15, 60, 70, 75)   # open ground south of the rooms
            NR = "Object.values(tw.entities()).filter(e => e.kind === 'room').length"
            nr = await gm.evaluate(NR); a = await scr(gm, C(1), C(11)); edge = {'x': W - 5, 'y': a['y'] + 70}
            seen = await gm.evaluate(f"Math.floor(tw.groundAt({W - 5}, {a['y'] + 70})[0] / 5)")   # the furthest square the window shows there before any pan
            await gm.evaluate("tw.modes.roomTool('common', { tool: true })"); await gm.mouse.move(a['x'], a['y']); await gm.mouse.down()
            await glide(a, edge); f0 = await gm.evaluate(FOCUS); r0 = await gm.evaluate('({ start: tw.mode.start, rect: tw.mode.rect })'); await gm.wait_for_timeout(1100)
            f1 = await gm.evaluate(FOCUS); i = await gm.evaluate('tw.edgePan.info()'); r1 = await gm.evaluate('({ start: tw.mode.start, rect: tw.mode.rect, lit: tw.worldOf(tw.area()).cellMarks?.get("room-tool")?.lit.count || 0 })')
            check(f1[0] > f0[0] + 3 and i['drag'] == 'canvas', 'a room rectangle held at the right edge: the view pans', [round(f1[0] - f0[0], 1), i['why']])
            check(r1['start'] == [1, 11] and r1['rect']['x'] == 1 and r1['rect']['z'] == 11 and r1['rect']['w'] > r0['rect']['w'], 'the corner it was started on stays on its square of the world, and the rectangle grows as the view slides', [r0['rect'], r1['rect']])
            await gm.mouse.move(W - 120, a['y'] + 70); await gm.wait_for_timeout(250); g = await gm.evaluate(f"tw.groundAt({W - 120}, {a['y'] + 70})"); await gm.mouse.up()
            ok = await wait(gm, f"{NR} === {nr + 1}", 8000, 'room drawn')
            rc = await gm.evaluate("(() => { const r = Object.values(tw.entities()).filter(e => e.kind === 'room' && e.recipe.z === 11)[0]; return r && { id: r.id, x: r.recipe.x, z: r.recipe.z, w: r.recipe.w, d: r.recipe.d }; })()")
            want_w = min(16, int(g[0] // 5) - 1 + 1)
            check(ok and rc and rc['x'] == 1 and rc['w'] == want_w and rc['x'] + rc['w'] - 1 > min(seen, 15), 'let go: the room runs from the first corner to the square under the pointer, wider than the window showed when the drag began', [rc, seen])
            if await gm.evaluate('!!tw.mode'): await gm.keyboard.press('Escape')
            if rc: await gm.evaluate(f"tw.dispatch('room.delete', {{ id: '{rc['id']}' }})"); await wait(gm, f"{NR} === {nr}", 8000, 'room deleted')
            # the building tool: the same gesture
            await view(gm, 15, 60, 70, 75); a = await scr(gm, C(1), C(11))
            hasb = await gm.evaluate("(() => { const n = [...tw.taxonomy.nodes.values()].find(n => n.level === 'type' && n.code); if (!n) return false; tw.modes.buildingTool(n); return tw.mode?.kind === 'building'; })()")
            if hasb:
                await gm.mouse.move(a['x'], a['y']); await gm.mouse.down(); await glide(a, {'x': a['x'] + 60, 'y': H - 5}); f0 = await gm.evaluate(FOCUS); r0 = await gm.evaluate('tw.mode.rect'); await gm.wait_for_timeout(1000)
                f1 = await gm.evaluate(FOCUS); r1 = await gm.evaluate('({ start: tw.mode.start, rect: tw.mode.rect })')
                check(f1[1] > f0[1] + 3 and r1['start'] == [1, 11] and r1['rect']['z'] == 11 and r1['rect']['d'] > r0['d'], 'a building\'s footprint held at the bottom edge: the view pans down, the first corner stays, the footprint grows', [round(f1[1] - f0[1], 1), r0, r1['rect']])
                await gm.keyboard.press('Escape'); await gm.mouse.move(a['x'], a['y']); await gm.mouse.up(); await gm.wait_for_timeout(300)
                if await gm.evaluate('!!tw.mode'): await gm.evaluate('tw.modes.cancel()')
                check(await gm.evaluate(NR) == nr, '(Esc: no building was made)')
            else: print('    (no building type in the taxonomy here)')
            # a paint stroke
            await view(gm, 15, 60, 70, 75); a = await scr(gm, C(1), C(13)); row = a['y']
            seen = await gm.evaluate(f"Math.floor(tw.groundAt({W - 5}, {row})[0] / 5)")
            pc = await gm.evaluate("tw.roomgen.floors[0]"); await gm.evaluate(f"tw.modes.place({{ id: '{pc}', name: 'x', place: 'tile' }})")
            await gm.mouse.move(a['x'], a['y']); await gm.mouse.down(); await glide(a, {'x': W - 5, 'y': row}, steps=14); f0 = await gm.evaluate(FOCUS); await gm.wait_for_timeout(1200)
            f1 = await gm.evaluate(FOCUS); n_mid = await gm.evaluate('tw.modes.paintInfo()?.cells || 0')
            await gm.mouse.move(W - 120, row); await gm.wait_for_timeout(250); seq = await gm.evaluate('tw.seq()'); await gm.mouse.up()
            await wait(gm, f"tw.seq() > {seq}", 8000, 'painted'); await gm.wait_for_timeout(300)
            xs = sorted(await gm.evaluate(f"{TILES}.filter(e => e.z === {C(13)}).map(e => (e.x - 2.5) / 5)")); allz = await gm.evaluate(f"{TILES}.filter(e => e.cat === '{pc}').every(e => Math.abs(e.z - {C(13)}) <= 5)")
            check(f1[0] > f0[0] + 3, 'a paint stroke held at the right edge: the view pans', round(f1[0] - f0[0], 1))
            check(len(xs) > 3 and xs[0] == 1 and xs == list(range(1, int(xs[-1]) + 1)) and xs[-1] > seen and allz and await gm.evaluate('tw.seq()') == seq + 1, 'the run goes on under the pointer: one unbroken row of tiles from the first square to past what the window showed, in ONE command', [len(xs), xs[-1] if xs else None, seen, n_mid])
            await gm.keyboard.press('Escape'); await gm.evaluate('tw.undo()'); await wait(gm, f"{TILES}.length === 0", 8000, 'unpaint')
            # the selection box does not pan
            await view(gm, 15, 60, 70, 75); a = await scr(gm, C(1), C(11)); await gm.mouse.move(a['x'], a['y']); await gm.mouse.down(); await glide(a, {'x': W - 5, 'y': a['y'] + 80}); f0 = await gm.evaluate(FOCUS); await gm.wait_for_timeout(700); f1 = await gm.evaluate(FOCUS)
            check(f0 == f1 and not await gm.evaluate('document.getElementById("marquee").hidden'), 'the selection box held at an edge does not pan (it is a box of screen pixels)')
            await gm.mouse.up(); await gm.wait_for_timeout(200); await gm.evaluate('tw.clearSelection()')

            U = 'tok_up00000001'
            await gm.evaluate("tw.cutToRoom(tw.entities()['%s'], 'test')" % UP); await view(gm, 7.5, 7.5, 60, 62); await gm.wait_for_timeout(700)
            cut0 = await gm.evaluate('({ cut: { ...tw.cut }, level: tw.level || 0 })')
            s = await grab(U); end = {'x': 8, 'y': 420}; await glide(s, end); f0 = await gm.evaluate(FOCUS); await gm.wait_for_timeout(900)
            f1 = await gm.evaluate(FOCUS); under = await gm.evaluate(UNDER(U, end['x'], end['y'], 10)); cut1 = await gm.evaluate('({ cut: { ...tw.cut }, level: tw.level || 0 })')
            check(f1[0] < f0[0] - 3, 'a pawn on the upper storey, dragged to the left edge: the view pans', round(f1[0] - f0[0], 1))
            check(under and under[0] <= 2.6 and under[1] <= 2.6, 'it stays under the pointer ON THE FLOOR IT STARTED ON (the plane at 10 ft), though the pointer is now over lower ground', under)
            check(cut1 == cut0, 'the cut and the level are not touched by the pan', cut1)
            await gm.keyboard.press('Escape'); await gm.mouse.move(s['x'], s['y']); await gm.mouse.up(); await gm.wait_for_timeout(400)
            cut2 = await gm.evaluate('({ cut: { ...tw.cut }, level: tw.level || 0 })')
            check(cut2['cut'] == cut0['cut'], 'nor by the drop', cut2)

        bad = [e for e in errors if 'favicon' not in e and '404' not in e and 'ERR_' not in e]
        check(not bad, 'no page errors', bad[:4])
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\n{len(results) - len(bad)}/{len(results)} checks passed")
sys.exit(1 if bad else 0)

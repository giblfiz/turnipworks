#!/usr/bin/env python3
"""The orbital cuts (Harry 2026-10-11, "ship the cuts"; docs/design/orbital-menu-2026-10-11/README.md).

  local:  TW_GPU=1 python3 engine/test/browser_cuts.py --local [--shots]

Three tabs: the GM, a SECOND TAB OF THE GM'S OWN SEAT (labels and room names never reach a player, so "does the other
screen see it" is asked of the GM side), and a player.

  LABEL   a room is renamed AT ITS LABEL: double-click the label of the room that is already selected, or F2 with the
          room selected (and the command bar). ENTER IS NOT RENAME: it steps into the room's children, as it always did. An unselected room's label still looks into the room on a
          double-click. Enter saves, Escape does not, an unchanged name sends nothing. The second GM tab sees the name
          at once; the player never receives it; Ctrl+Z takes it back and redo returns it.
  RING    the room's ring has no Rename, Room type, Replay spawn or Delete; the bar still finds each
  PLAYER  a player has no labels and cannot rename a room; a player's own pawn opens Conditions, Indicators and
          Raise / lower and nothing the GM alone may do; a selection with nothing behind the menu button has no menu button
  HELP    the "?" sheet lists Delete with its key for a room, a prop and a pawn
(Ring contents for every kind of selection: browser_rooms.py MENU. The pawn's sheet card, Name and Moved by:
browser_pawnring.py MENU. Legacy locked pawns: core.test.mjs and migrate.test.mjs, against the corpus.)
"""
import argparse, asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18151,18781').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-cuts-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])  # /tmp is RAM: both are removed at exit
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
E = lambda i: f"tw.entities()['{i}']"
LBL = lambda i: f'.rlabel[data-id="{i}"]'
async def view(pg, x, z, dist=110, pitch=58):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = 0; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"); await pg.wait_for_timeout(300)

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900):
            ctx = await browser.new_context(viewport={'width': w, 'height': h})
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST cuts {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        # This suite exercises the open tabletop; vision fog has its own three-seat suite.
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
        await wait(gm, "tw.sync.campaign.defaults.fogOfWar === false && tw.sync.pendingCount() === 0", 15000, 'open-table fixture')
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
        pl = await tab(invite + '&nofx'); await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000, 'Mira joins'); mira = await pl.evaluate('tw.me()')
        gm2 = await tab(gm.url + ('' if 'nointro' in gm.url else '')); ok2 = await wait(gm2, 'window.tw && tw.ready && tw.ready()', 45000, 'second GM tab')
        check(ok2 and await gm2.evaluate('tw.me()') == await gm.evaluate('tw.me()') and await gm2.evaluate('tw.gm()') and not await pl.evaluate('tw.gm()'), "three tabs: the GM, a second tab of the GM's own seat, and a player")

        RA = await gm.evaluate("tw.spawnRoom('guest', 2, 2, 5, 4, 4101)"); await gm.wait_for_timeout(300)
        RB = await gm.evaluate("tw.spawnRoom('common', 9, 2, 5, 4, 4102)")
        for pg in (gm, gm2, pl): await wait(pg, f"!!{E(RA)} && !!{E(RB)}", 15000, 'rooms')
        await wait(gm, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", 40000, 'rooms settled'); await gm.wait_for_timeout(400)
        PW = 'tok_cuts000001'
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: '{PW}', name: 'Mira the Bold', x: 45, z: 45, owner: '{mira}' }})")
        for pg in (gm, pl): await wait(pg, f"!!{E(PW)}", 8000, 'pawn')
        for pg in (gm, gm2): await view(pg, 40, 20, 105)
        await wait(gm, f"document.querySelector('{LBL(RA)}')?.classList.contains('on') && document.querySelector('{LBL(RB)}')?.classList.contains('on')", 8000, 'labels showing')
        name0 = await gm.evaluate(f"document.querySelector('{LBL(RA)} .lt').textContent")
        editing = lambda rid: f"!!document.querySelector('{LBL(rid)} input')"
        cut = "tw.cut?.y ?? null"

        # ================= LABEL =================
        print('LABEL: a room is renamed at its own label')
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(700)
        c0 = await gm.evaluate(cut)
        await gm.dblclick(LBL(RB)); await gm.wait_for_timeout(500)
        c1 = await gm.evaluate(cut)
        check(not await gm.evaluate(editing(RB)) and c1 is not None and c1 != c0, "a double-click on the label of a room that was NOT selected looks into that room, as before (no name field)", [c0, c1])
        await gm.evaluate("tw.cutOff('test')"); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(800)
        await gm.click(LBL(RA)); await gm.wait_for_timeout(800)
        check(await gm.evaluate(f"[...tw.sel].join() === '{RA}'") and not await gm.evaluate(editing(RA)), 'one click on a label selects the room (no name field yet)')
        c0 = await gm.evaluate(cut)
        await gm.dblclick(LBL(RA)); ok = await wait(gm, editing(RA), 3000, 'name field')
        st = await gm.evaluate(f"({{ focus: document.activeElement === document.querySelector('{LBL(RA)} input'), value: document.activeElement?.value, ph: document.activeElement?.placeholder, cut: {cut} }})")
        check(ok and st['focus'] and st['value'] == '' and st['ph'] == name0 and st['cut'] == c0, "a double-click on the SELECTED room's label opens its name for typing, in place (the caret in it; the view is not cut)", st)
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'cuts-label-rename.png'))
        await gm.keyboard.type('Secret vault', delay=10)
        await gm.mouse.click(*(await gm.evaluate(f"(() => {{ const r = document.querySelector('{LBL(RA)} input').getBoundingClientRect(); return [r.left + 12, r.top + r.height / 2]; }})()"))); await gm.wait_for_timeout(200)
        check(await gm.evaluate(editing(RA)) and await gm.evaluate(f"document.querySelector('{LBL(RA)} input').value") == 'Secret vault', 'a click inside the field places the caret (it does not close the field or drag the room)')
        await gm.keyboard.press('Enter')
        ok = await wait(gm, f"{E(RA)}.name === 'Secret vault' && tw.sync.pendingCount() === 0", 6000, 'renamed')
        ok2 = await wait(gm2, f"{E(RA)}.name === 'Secret vault' && document.querySelector('{LBL(RA)} .lt')?.textContent === 'Secret vault'", 6000, 'second GM tab'); await pl.wait_for_timeout(600)
        check(ok and ok2 and await gm.evaluate(f"document.querySelector('{LBL(RA)} .lt').textContent") == 'Secret vault' and not await gm.evaluate(editing(RA)), "Enter saves: the label reads the new name here and on the GM's other screen at once (one synced room.set)")
        check(await pl.evaluate(f"!!{E(RA)} && !{E(RA)}.name && document.querySelectorAll('.rlabel').length === 0 && !JSON.stringify(tw.entities()).includes('Secret vault')"), 'the player has the room and never receives its name; a player has no labels at all')
        await gm.keyboard.press('Control+z'); ok = await wait(gm2, f"!{E(RA)}.name && document.querySelector('{LBL(RA)} .lt')?.textContent === {json.dumps(name0)}", 6000, 'undone')
        await gm.keyboard.press('Control+Shift+z'); ok2 = await wait(gm2, f"{E(RA)}.name === 'Secret vault'", 6000, 'redone')
        check(ok and ok2, 'Ctrl+Z takes the name back on both screens (the label reads its room type again); redo returns it')
        # F2 with the room selected; Enter keeps its meaning (step into the children), Shift+Enter goes back up
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(300); await gm.click(LBL(RA)); await gm.wait_for_timeout(800); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(300)
        kids = await gm.evaluate(f"({{ n: tw.sel.size, all: [...tw.sel].every(id => tw.entities()[id]?.room === '{RA}'), editing: {editing(RA)} }})")
        await gm.evaluate("tw.select([[...tw.sel][0]])"); await gm.wait_for_timeout(200); await gm.keyboard.press('Shift+Enter'); await gm.wait_for_timeout(300); up = await gm.evaluate("[...tw.sel].join()")
        check(kids['n'] > 1 and kids['all'] and not kids['editing'] and up == RA, "Enter on a selected room steps into its children (its furniture is selected; no name field); Shift+Enter on one of them selects the room again", [kids, up])
        await gm.keyboard.press('F2'); ok = await wait(gm, editing(RA), 3000, 'F2 opens the field')
        v = await gm.evaluate("document.activeElement?.value")
        check(ok and v == 'Secret vault' and await gm.evaluate(f"[...tw.sel].join() === '{RA}'"), 'F2 with the room selected opens its name for typing (the name as it is, selected); the selection stays the room', v)
        await gm.keyboard.type('Nope', delay=10); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(500)
        last = await gm.evaluate('tw.labelRenameLast')
        check(not await gm.evaluate(editing(RA)) and await gm.evaluate(f"{E(RA)}.name") == 'Secret vault' and last and last['saved'] is False, 'Escape leaves the name as it was: nothing is sent', last)
        seq0 = await gm.evaluate("tw.sync.areaSeq?.(tw.area()) ?? tw.worldOf(tw.area()).seq ?? null")
        await gm.keyboard.press('F2'); await wait(gm, editing(RA), 3000); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(500)
        last = await gm.evaluate('tw.labelRenameLast')
        await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(700)
        nm_after = await gm.evaluate(f"{E(RA)}.name || ''"); await gm.keyboard.press('Control+Shift+z'); await wait(gm, f"{E(RA)}.name === 'Secret vault'", 6000)
        check(last and last['saved'] is False and nm_after == '', 'Enter on an unchanged name sends nothing: the next undo is still the rename itself, not an empty step', [last, nm_after, seq0])
        # F2 and the command bar still rename, at the label
        await gm.keyboard.press('Escape'); await gm.click(LBL(RA)); await gm.wait_for_timeout(500); await gm.keyboard.press('F2'); ok = await wait(gm, editing(RA), 3000, 'F2')
        await gm.keyboard.press('Control+a'); await gm.keyboard.type('Vault', delay=10); await gm.keyboard.press('Enter'); ok2 = await wait(gm2, f"{E(RA)}.name === 'Vault'", 6000)
        await gm.keyboard.press('/'); await gm.keyboard.type('rename', delay=8); await gm.wait_for_timeout(350)
        rows = await gm.evaluate("[...document.querySelectorAll('#results .res .t')].slice(0, 4).map(e => e.innerText)")
        await gm.keyboard.press('Enter'); ok3 = await wait(gm, editing(RA), 3000, 'bar rename'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        check(ok and ok2 and ok3 and any('Rename' in r for r in rows), 'F2 renames at the label as before, and "rename" in the command bar opens the same field', rows)
        # leaving the field saves (as before)
        await gm.click(LBL(RA)); await gm.wait_for_timeout(700); await gm.keyboard.press('F2'); await wait(gm, editing(RA), 3000); await gm.keyboard.press('Control+a'); await gm.keyboard.type('Strongroom', delay=10)
        await gm.evaluate("document.activeElement.blur()"); ok = await wait(gm2, f"{E(RA)}.name === 'Strongroom'", 6000)
        check(ok, 'leaving the field saves what was typed')

        # ================= RING =================
        print('RING: what left the room\'s ring, and where it went')
        await gm.keyboard.press('Escape'); await gm.evaluate(f"tw.select(['{RA}'])"); await gm.wait_for_timeout(300); await gm.evaluate("document.querySelector('#ring [data-menu]').click()"); await gm.wait_for_timeout(300)
        top = await gm.evaluate("tw.ringMenu().map(n => n.cmd || '▸' + n.group)")
        caps = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn.ex .cap')].map(c => c.textContent.trim())")
        check(not any(c in top for c in ('room.rename', 'room.replay', 'room.stair', '▸room.type.', '▸room.floor.', 'edit.delete', 'room.delete')) and not any(x in ' '.join(caps) for x in ('Rename', 'Replay', 'Room type', 'Floor', 'Delete')) and 'thing.lock' in top and 'thing.hide' not in top and 'room.fog' in top and '▸room.walls.' in top and top[-1] == 'faction.set', "a room's open ring: no Rename, Room type, Floor, Replay spawn or Delete; Walls, Fog height and Lock are there, ending with Faction; Hide is primary (a ROOM keeps its lock)", caps)
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'cuts-room-ring.png'))
        await gm.keyboard.press('Escape')
        found = await gm.evaluate(f"""(async () => {{ tw.select(['{RA}']); const out = {{}}; for (const q of ['replay spawn', 'room type: kitchen', 'floor: cobble', 'floor: by room type', 'delete', 'rename', 'select children']) {{ tw.emit('bar.open', q); await new Promise(r => setTimeout(r, 240)); out[q] = [...document.querySelectorAll('#results .res .t')].slice(0, 4).map(e => e.innerText); document.querySelector('#bar input').dispatchEvent(new KeyboardEvent('keydown', {{ key: 'Escape', bubbles: true }})); await new Promise(r => setTimeout(r, 60)); }} return out; }})()""")
        want = {'replay spawn': 'Replay spawn', 'room type: kitchen': 'Room type: Kitchen', 'floor: cobble': 'Floor: cobble', 'floor: by room type': 'Floor: by room type', 'delete': 'Delete', 'rename': 'Rename', 'select children': 'Select children'}
        check(all(any(w.lower() in t.lower() for t in found[q]) for q, w in want.items()), 'the command bar finds each of them by name with the room selected (and Select children)', {q: found[q][:1] for q in want})
        # THE CUTS WERE TO THE RING ONLY: the Space chords keep every one of them (2026-10-12)
        await gm.evaluate(f"tw.select(['{RA}'])"); await gm.wait_for_timeout(200); await gm.keyboard.press('Space'); await gm.wait_for_timeout(200); cr = await gm.evaluate('tw.chordState()')
        kv = dict(zip(cr['items'], cr['keys'])) if cr else {}
        check(cr and [kv.get(k) for k in ('▸room.type.', '▸room.floor.', 'room.rename', 'room.replay', 'edit.delete')] == ['t', 'f', 'n', 'a', 'd'] and len(set(cr['keys'])) == len(cr['keys']) and cr['items'][-1] == 'edit.delete', "a room's Space chords still hold what left its ring, on the letters they always had: T room type, F floor, N rename, A replay, D delete (last)", cr and list(zip(cr['keys'], cr['items'])))
        await gm.keyboard.press('n'); okc = await wait(gm, editing(RA), 3000, 'Space N'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        await gm.evaluate(f"tw.select(['{PW}'])"); await gm.wait_for_timeout(200); await gm.keyboard.press('Space'); await gm.wait_for_timeout(200); cp = await gm.evaluate('tw.chordState()')
        kp = dict(zip(cp['items'], cp['keys'])) if cp else {}
        await gm.keyboard.press('g'); await gm.wait_for_timeout(400); okg = await gm.evaluate("!!tw.ringFlyout()?.sheet && document.activeElement?.classList.contains('sh-owner')"); await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        check(okc and cp and [kp.get(k) for k in ('thing.rename', 'pawn.duplicate', 'pawn.give', 'edit.delete')] == ['n', 'x', 'g', 'd'] and 'thing.lock' not in kp and okg, "Space N on a room opens its name; a pawn's chords still hold N name, X duplicate, G give control (it opens the sheet card on Moved by), D delete; no lock", cp and list(zip(cp['keys'], cp['items'])))
        n0 = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room').length")
        await gm.evaluate(f"tw.select(['{RB}'])"); await gm.wait_for_timeout(250); await gm.keyboard.press('Delete'); ok = await wait(gm2, f"!{E(RB)}", 8000, 'room deleted')
        await gm.keyboard.press('Control+z'); ok2 = await wait(gm2, f"!!{E(RB)}", 8000, 'room back')
        await wait(gm, f"!!{E(RB)} && tw.sync.pendingCount() === 0", 8000, 'room back on the GM tab'); n1 = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room').length")
        check(ok and ok2 and n1 == n0, 'the Delete key still deletes a room, and undo brings it back', [ok, ok2, n0, n1])

        # ================= HELP =================
        print('HELP: the "?" sheet still shows the Delete key')
        prop = await gm.evaluate(f"Object.values(tw.entities()).find(e => e.kind === 'object' && e.room === '{RA}' && !e.parent && e.place === 'floor')?.id")
        rows_by = {}
        for nm_, ids in (('room', [RA]), ('prop', [prop]), ('pawn', [PW])):
            await gm.keyboard.press('Escape'); await gm.evaluate(f"tw.select({json.dumps(ids)})"); await gm.wait_for_timeout(200); await gm.keyboard.press('?'); await gm.wait_for_timeout(300)
            rows_by[nm_] = await gm.evaluate("document.querySelector('#sheet').hidden ? null : [...document.querySelectorAll('#sheet .row')].map(r => [r.querySelector('span').textContent, [...r.querySelectorAll('kbd')].map(k => k.textContent)]).filter(r => r[0] === 'Delete')")
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
        check(all(v and len(v) == 1 and any(k.lower() in ('del', 'delete') for k in v[0][1]) for v in rows_by.values()), 'with a room, a prop or a pawn selected, the "?" sheet lists Delete with its key', rows_by)

        # ================= PLAYER =================
        print('PLAYER: what a player gets')
        nack = await pl.evaluate(f"(async () => {{ const cid = tw.dispatch('room.set', {{ id: '{RA}', name: 'Mine now' }}); await new Promise(r => setTimeout(r, 900)); return [document.querySelector('#toast').textContent, tw.entities()['{RA}'].name || null]; }})()")
        check(await gm.evaluate(f"{E(RA)}.name") == 'Strongroom' and 'Refused' in nack[0], 'a player cannot rename a room (the same permission as before: the relay refuses it)', nack)
        await pl.evaluate(f"(() => {{ const e = {E(PW)}, g = tw.main.grab; g.focus.set(e.x, 0, e.z); g.yaw = 0; g.pitch = 55; g.dist = 60; g.update(); tw.main.rule = 'free'; tw.select('{PW}'); }})()"); await pl.wait_for_timeout(600)
        await pl.click('#ring .rbtn[data-menu]'); await pl.wait_for_timeout(350)
        ptop = await pl.evaluate("tw.ringMenu().map(n => n.cmd || '▸' + n.group)")
        check(ptop[:3] == ['▸pawn.cond.', '▸pawn.mark.', 'edit.lift'] and set(ptop) <= {'▸pawn.cond.', '▸pawn.mark.', 'edit.lift', 'pawn.travel'}, "a player's own pawn: Conditions ▸, Indicators ▸, Raise / lower (and Send to area where there is one): no Hide, Lock, Duplicate, Give control or Delete", ptop)
        await pl.keyboard.press('Escape'); await pl.keyboard.press('Escape')
        door = await pl.evaluate("Object.values(tw.entities()).find(o => o.kind === 'object' && tw.assets.openable(o.cat) && !tw.assets.lightable(o.cat))?.id || null")
        if door:
            await pl.evaluate(f"(() => {{ const e = {E(door)}, g = tw.main.grab; g.focus.set(e.x, 0, e.z); g.yaw = 0; g.pitch = 55; g.dist = 50; g.update(); tw.main.rule = 'free'; tw.select('{door}'); }})()"); await pl.wait_for_timeout(600)
            r_ = await pl.evaluate("({ hidden: document.querySelector('#ring').hidden, btns: [...document.querySelectorAll('#ring .rbtn')].map(b => b.dataset.menu ? 'menu' : b.dataset.cmd) })")
            check(not r_['hidden'] and r_['btns'] == ['thing.open'], 'a player at a thing that opens: the ring is Open / Close alone. Nothing would be behind ☰, so there is no ☰ (never an empty circle)', r_)
            await pl.keyboard.press('Space'); await pl.wait_for_timeout(150)
            ch = await pl.evaluate('tw.chordState()'); await pl.keyboard.press('Escape')
            check(ch and ch['items'] == ['thing.open'], 'the Space chord (the whole menu, ring buttons included) holds Open / Close and nothing else', ch)
        else: print('    (no thing that opens in these two rooms: the empty-menu case is not exercised)')

        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for pr in procs:
        try: pr.wait(timeout=5)
        except Exception: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\ncuts: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)

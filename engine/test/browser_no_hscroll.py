#!/usr/bin/env python3
"""No horizontal scrollbars, anywhere (Nick's rule, relayed by Harry 2026-11-02; docs/UI.md "Industry standards").

  "Horizontal scrollbars are always a UI failure." Content wraps, truncates with a way to read it, or the layout changes.
  It never scrolls sideways. overflow-x: hidden over clipped content is not a fix: it hides the failure, so this suite
  looks for that too (CLIPPED below).

  local:  python3 engine/test/browser_no_hscroll.py --local [--only GAME,SITE] [--sizes 1440x900,phone-390x844] [--scales 1,1.5] [--surfaces pawns,settings]
          TW_PORTS=18171,18771 when another worktree is running this suite

  SELF    the instrument: real (classic) scrollbars are on, with a width (Playwright's headless browser hides them unless
          told not to, and hidden bars take no width, which is exactly how a scrollbar-only overflow goes unseen); a planted
          sideways scroller is caught; a planted clip is caught
  GAME    a throwaway sandbox campaign with long names, 70 pawns, rooms, areas, seats and chat: every surface a person can
          reach, as the GM and as a player, at 1440x900, 1024x700, 390x844 and 844x390 (a phone's touch layout AND a desktop
          window that small, which keeps classic scrollbars), at the default and the largest text size
  SITE    About, Terms, Privacy, Connect D&D Beyond, the VTT index (and its detail window, and either side of the width where
          its table becomes cards), the start page with a long memory, the phone page, the same sizes
  COVER   every size really showed every surface in MUST_SEE: a surface that stops opening fails here instead of passing

  An element fails when its computed overflow-x is auto or scroll and scrollWidth > clientWidth + 1 (the document fails on
  the same sum, whatever its overflow). A clipped element fails when its overflow-x is hidden or clip and it hides more than
  1 px sideways, unless it truncates with an ellipsis or is named in DECORATIVE, each with the reason it is decorative. A
  window in ON_SCREEN fails when it runs off the edge of the screen (a fixed window that does makes no overflow to measure).
"""
import argparse, asyncio, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaign here is a throwaway: deleted from the relay when the script exits
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--site', default=''); ap.add_argument('--headed', action='store_true')
ap.add_argument('--only', default=''); ap.add_argument('--sizes', default=''); ap.add_argument('--scales', default=''); ap.add_argument('--surfaces', default=''); ap.add_argument('--seats', default='gm,player'); ap.add_argument('--verbose', action='store_true')
A = ap.parse_args()
ONLY = [s.strip().upper() for s in A.only.split(',') if s.strip()]
want = lambda s: not ONLY or s in ONLY
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

# name, width, height, a phone (touch layout, overlay scrollbars) or a window (the desktop layout, classic scrollbars)
SIZES = [('1440x900', 1440, 900, False), ('1024x700', 1024, 700, False), ('window-390x844', 390, 844, False), ('window-844x390', 844, 390, False), ('phone-390x844', 390, 844, True), ('phone-844x390', 844, 390, True)]
if A.sizes: SIZES = [s for s in SIZES if s[0] in A.sizes.split(',')]
SCALES = [float(s) for s in A.scales.split(',')] if A.scales else [1, 1.5]  # 1.5 is the top of Settings ▸ Me ▸ Text size (client/surfaces/settings.js)
WANT_SURF = [s.strip() for s in A.surfaces.split(',') if s.strip()]
surf = lambda name: not WANT_SURF or any(w in name for w in WANT_SURF)
PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
LONG = 'Bartholomew Thistlewick the Unreasonably Verbose of Lower Piddlington-upon-Marsh'
UNBROKEN = 'Aaaaaaaaaaaaarghhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh'
# Clipped on purpose, and why: each is art or a stage, not content a person is being denied. Say so here when you add one.
DECORATIVE = {
    '#labels': 'the layer of labels pinned to the 3D world: a label off the edge is a room off the edge, and panning brings it back',
    '#undoChips': 'the same kind of layer: chips pinned to things on the map',
    '#rulers': 'the same kind of layer: measurements drawn on the map',
    '#stairNoteX': 'the same kind of layer: the dismiss button pinned to a stair warning',
    '#levelMeter': 'a meter 20 px wide that opens on hover or a press: its words are read by opening it',
    '.twl-sr, .sr': 'visually hidden text for screen readers, 1 px on purpose',
}
# Surfaces that must fit inside the window: a position: fixed window wider than the screen makes no scrollable overflow at
# all (the document does not grow), so neither sum above sees it. It is cut off with no way to reach the rest.
ON_SCREEN = '.smodal, .shmodal, .sheet-card, #pawnsTray, #buildMenu, .ppop, #ring > .flyout, #results, #chat, #crumbs, #output, #factionShelf, dialog[open], #phone, .lmcard, .faction-grid'
# Proof the sweep really opened things: each size must have shown each of these at least once, or a surface renamed or
# moved would pass by not being looked at.
MUST_SEE = ['#pawnsTray .pbody', '#pawnsTray .pbody.tree', '#pawnsTray .bgrid', '#buildMenu .bgrid', '.smodal .scats', '.smodal .spb', 'details[open]', '.mptree', '#results .res', '#chat.expanded', '.ppop', '.sheet-card',
            '#ring > .flyout', '#ring .flyout.sheet', '.faction-grid', '#output:not([hidden])', '.shmodal', '#crumbs:not([hidden])', '#factionShelf:not([hidden])']

# the instrument, in the page
SCAN = r"""
(() => {
  if (window.__hscan) return;
  const name = (el) => { if (el === document.documentElement) return 'html'; if (el === document.body) return 'body';
    let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; const c = [...el.classList].slice(0, 3); if (c.length) s += '.' + c.join('.');
    const p = el.parentElement; if (p && !el.id) { const q = p.id ? '#' + p.id : p.classList[0] ? '.' + p.classList[0] : p.tagName.toLowerCase(); s = q + ' > ' + s; } return s; };
  const shown = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden') return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  window.__hscan = (decorative = [], on = 'none', must = []) => {
    const out = [], clip = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) out.push({ el: 'document', sw: de.scrollWidth, cw: de.clientWidth, ov: getComputedStyle(de).overflowX });
    for (const el of document.querySelectorAll('body, body *')) {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      const sw = el.scrollWidth, cw = el.clientWidth; if (sw <= cw + 1 || !cw) continue;
      const c = getComputedStyle(el), ox = c.overflowX;
      if (ox !== 'auto' && ox !== 'scroll' && ox !== 'hidden' && ox !== 'clip') continue;
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT') continue; // (a text box moves its own caret along its text; nothing is lost)
      if (!shown(el)) continue;
      if (ox === 'auto' || ox === 'scroll') { const edge = el.getBoundingClientRect().left + el.clientWidth * (el.getBoundingClientRect().width / (el.offsetWidth || 1)); let by = ''; for (const d of el.querySelectorAll('*')) { const r = d.getBoundingClientRect(); let cut = false; for (let u = d.parentElement; u && u !== el; u = u.parentElement) if (getComputedStyle(u).overflowX !== 'visible') cut = true; if (!cut && r.width && r.right > edge + 1) { by = name(d); if (!d.firstElementChild) break; } } out.push({ el: name(el), sw, cw, ov: ox, by }); continue; }
      if (el === document.body) continue;
      if (c.textOverflow === 'ellipsis' || parseInt(c.webkitLineClamp) > 0) continue;
      if (decorative.some(d => el.matches(d))) continue;
      clip.push({ el: name(el), sw, cw, ov: ox });
    }
    const off = [];
    for (const el of document.querySelectorAll(on)) { if (!shown(el)) continue; const r = el.getBoundingClientRect(); if (r.left < -1 || r.right > innerWidth + 1) off.push({ el: name(el), sw: Math.round(r.right), cw: innerWidth, ov: 'off-screen, left ' + Math.round(r.left) }); }
    return { out, clip, off, hits: must.filter(q => { const e = document.querySelector(q); return e && shown(e); }) };
  };
})()
"""
HITS = {}  # size -> the MUST_SEE selectors that were on screen there
SEEN = {}  # "element" -> set of "where": one line per scroller in the report, not one per surface
async def scan(pg, where):
    await pg.evaluate(SCAN)
    r = await pg.evaluate('([d, o, m]) => window.__hscan(d, o, m)', [list(DECORATIVE), ON_SCREEN, MUST_SEE])
    HITS.setdefault(where.split(' @')[0].split(' site')[0], set()).update(r['hits'])
    r['out'] += r['off']
    for kind, rows in (('scroller', r['out']), ('clipped', r['clip'])):
        for x in rows:
            key = (kind, re.sub(r'\d+', '#', x['el']))
            SEEN.setdefault(key, []).append((where, x['sw'], x['cw'], x.get('by', '')))
    if A.verbose: print(f'    scanned {where}: {len(r["out"])} scrollers, {len(r["clip"])} clipped', flush=True)
    return r

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18171,18771').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-nohscroll-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])  # /tmp is RAM: both are removed at exit
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500', f'http://127.0.0.1:{SP}/engine/client/site/'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:90]})', flush=True); return False

E = lambda i: f"tw.entities()['{i}']"
LONGAREA = f'The Long Road to {LONG}'
PAWNS = 70

async def fixture(gm):
    """Everything long and everything many: the worst case a table can hand these surfaces."""
    await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
    await wait(gm, 'tw.sync.campaign.defaults.fogOfWar === false && tw.sync.pendingCount() === 0', 15000, 'open table')
    await gm.evaluate(f"tw.sync.submit('area.set', {{ area: tw.area(), name: {json.dumps(LONGAREA)} }})")
    for i in range(3):
        await gm.evaluate(f"tw.sync.submit('area.create', {{ id: 'area_nohscroll{i}', name: {json.dumps(f'Annexe {i}: {LONG}')} }})")
    await gm.evaluate("tw.spawnRoom('common', 0, 0, 8, 6, 4242)")
    await wait(gm, "Object.values(tw.entities()).some(e => e.kind === 'room') && tw.sync.pendingCount() === 0", 20000, 'room')
    await gm.evaluate("tw.spawnRoom('kitchen', 12, 0, 6, 6, 4243)")
    await wait(gm, "Object.values(tw.entities()).filter(e => e.kind === 'room').length >= 2 && tw.sync.pendingCount() === 0", 20000, 'second room')
    rooms = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room').map(e => e.id)")
    await gm.evaluate(f"tw.sync.submit('room.set', {{ id: '{rooms[0]}', name: {json.dumps(('The Great Hall of ' + LONG)[:60])} }}, tw.area())")
    figs = ['hero-fighter-dwarf-f', 'beast-bear', 'beast-hawk', 'hero-wizard-elf-f', 'foe-goblin-spear', 'foe-goblin-bow', 'foe-owlbear']
    toks = []
    for i in range(PAWNS):
        nm = (f'{i} {LONG}' if i % 3 == 0 else f'{i} {UNBROKEN}' if i % 3 == 1 else f'Goblin {i}')[:80]  # (the longest name a pawn may have)
        toks.append({'type': 'token.create', 'args': {'id': f'tok_hs{i:09d}', 'name': nm, 'x': 2.5 + 5 * (i % 10), 'z': 2.5 + 5 * (i // 10), 'fig': figs[i % len(figs)], 'damage': i % 5 * 111, 'conditions': ['prone', 'poisoned', 'restrained', 'frightened'] if i % 4 == 0 else []}})
    answers = []
    for i in range(0, len(toks), 10):
        answers.append(await gm.evaluate(f'tw.await(tw.batch({json.dumps(toks[i:i + 10])})).then(m => JSON.stringify(m))'))
    check(await wait(gm, f"Object.values(tw.entities()).filter(e => e.kind === 'token').length >= {PAWNS} && tw.sync.pendingCount() === 0", 30000, 'pawns'), f'the fixture has its {PAWNS} pawns', str(answers[0])[:300])
    # seats with long names, and the chat's long lines
    invites = []
    for i, nm in enumerate((LONG, UNBROKEN)):
        t = await gm.evaluate(f"(async () => {{ const t = await tw.createSeat({{ kind: 'human', role: 'player', name: {json.dumps(nm[:40])}, color: '#{i + 4}08fd0' }}); return t; }})()")
        invites.append(t)
    for text in (f'{LONG} says: ' + 'a line long enough to wrap at any width, and then some, and then some more. ' * 3, UNBROKEN * 3, 'https://example.com/' + 'a-very-long-path/' * 12):
        await gm.evaluate(f"tw.sync.submit('chat.say', {{ id: 'msg_' + Math.random().toString(36).slice(2, 10), text: {json.dumps(text)} }}, tw.area())")
    await gm.evaluate("tw.sync.submit('chat.say', { id: 'msg_' + Math.random().toString(36).slice(2, 10), text: '/r 2d6' }, tw.area())")
    # the first player owns pawns, so Mine, the party's rows and a pawn's own ring are full on their side
    await gm.evaluate(f"""(() => {{ const p = tw.sync.campaign.seats.find(s => s.kind === 'human' && s.id !== tw.me()); tw.batch(Array.from({{ length: 8 }}, (_, i) => ({{ type: 'token.owner', args: {{ id: 'tok_hs' + String(i).padStart(9, '0'), owner: p.id }} }}))); }})()""")
    await gm.evaluate("(() => { const ids = Object.values(tw.entities()).filter(e => e.kind === 'token').map(e => e.id); tw.sync.submit('turn.start', { order: ids.slice(0, 40) }, tw.area()); })()")
    await wait(gm, 'tw.sync.pendingCount() === 0', 15000, 'fixture settled')
    return invites

async def closed(pg):
    await pg.evaluate("""(() => { for (const n of ['pawns', 'build', 'settings']) { try { tw.tray?.setPin?.(n, false); tw[n]?.close?.(); } catch { } } try { tw.clearSelection?.(); } catch { } document.querySelector('#chat')?.classList.remove('expanded'); })()""")
    for _ in range(3): await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(60)

async def surfaces(pg, gm_seat, where, size_w, size_h, hand, bad):
    """Open everything; every scan appends what it found to `bad`."""
    async def look(name, settle=120):
        await pg.wait_for_timeout(settle)
        r = await scan(pg, f'{where} {name}')
        for x in r['out']: bad.append(('scroller', where, name, x))
        for x in r['clip']: bad.append(('clipped', where, name, x))
    await closed(pg)
    if surf('table'): await look('table')
    # ---- the chat, expanded
    if surf('chat'):
        await pg.evaluate("document.querySelector('#chat').click()"); await look('chat expanded'); await closed(pg)
    # ---- the Pawns tray, every view
    if surf('pawns'):
        await pg.evaluate('tw.pawns.open()'); await pg.wait_for_timeout(120); await look('pawns home')
        nodes = await pg.evaluate("""[...document.querySelectorAll('#pawnsTray .psec[data-sec="place"] [data-node]')].map(e => e.dataset.node)""")
        for n in nodes[:3 if not gm_seat else 99]:
            await pg.evaluate(f"""document.querySelector('#pawnsTray .psec[data-sec="place"] [data-node="{n}"]')?.click()""")
            await look(f'pawns tree {n}')
            kids = await pg.evaluate("[...document.querySelectorAll('#pawnsTray .pbody.tree [data-node], #pawnsTray .pbody.tree .bchip')].length")
            for i in range(min(kids, 4)):
                await pg.evaluate(f"[...document.querySelectorAll('#pawnsTray .pbody.tree [data-node], #pawnsTray .pbody.tree .bchip')][{i}]?.click()")
                await look(f'pawns tree {n}/{i}')
            await closed(pg); await pg.evaluate('tw.pawns.open()'); await pg.wait_for_timeout(80)
        await closed(pg)
    # ---- the Build tray and its levels
    if surf('build') and gm_seat:
        await pg.evaluate('tw.build.open()'); await look('build root')
        for depth in range(3):
            n = await pg.evaluate("document.querySelectorAll('#buildMenu [data-id], #buildMenu .btile, #buildMenu .bchip').length")
            if not n: break
            await pg.evaluate("document.querySelector('#buildMenu .bchip:not(.sel), #buildMenu [data-id]')?.click()")
            await look(f'build level {depth}')
        await closed(pg)
    # ---- Settings, every section
    if surf('settings'):
        secs = await pg.evaluate("(tw.settings.open('nav'), tw.settings.state().sections)")
        for s in secs:
            await pg.evaluate(f"tw.settings.show('{s}')")
            await pg.wait_for_timeout(500 if s == 'feedback' else 120)
            await pg.evaluate("document.querySelectorAll('#settingsModal details').forEach(d => { d.open = true; })")  # (Keyboard shortcuts and the like)
            await look(f'settings {s}', 60)
        await closed(pg)
        await pg.evaluate("tw.settings.editPawn('new')"); await look('settings my pawn editor', 300); await closed(pg)
    # ---- command bar results
    if surf('bar'):
        for q in ('door', 'gob', 'a'):
            await pg.keyboard.press('/'); await pg.keyboard.type(q, delay=4); await look(f'bar results "{q}"', 200); await closed(pg)
        await pg.keyboard.press('/'); await pg.keyboard.insert_text(f'{LONG} {UNBROKEN} ' * 6); await look('bar with an essay in it', 250); await closed(pg)
    # ---- roster
    if surf('roster'):
        if gm_seat:
            await pg.evaluate("document.querySelector('#roster')?.removeAttribute('hidden')")
            await pg.evaluate("(() => { const a = [...document.querySelectorAll('#roster .av[data-seat]')].find(x => x.dataset.seat !== tw.me()); return a ? tw.roster.menu(a.dataset.seat) : false; })()"); await look('roster pop'); await closed(pg)
    # ---- the output box: an invite link, the turn order
    if surf('output'):
        await pg.evaluate("tw.emit('output', { title: 'Invite link for ' + " + json.dumps(LONG) + ", text: location.href + '#s=' + 'x'.repeat(400) })"); await look('output box'); await closed(pg)
    # ---- Share, and its report
    if surf('share') and gm_seat:
        await pg.evaluate("(() => { const r = Object.values(tw.entities()).find(e => e.kind === 'room'); tw.select(r.id); return tw.share.open(); })()"); await look('share', 700)
        await pg.evaluate("tw.share.close()"); await closed(pg)
    # ---- the faction chooser's grid (the conditional button that offers it after a build: its real markup and CSS, on a real room)
    if surf('factions') and gm_seat:
        await pg.evaluate("""(async () => { const m = await import(new URL('surfaces/factions.js', document.baseURI).href), e = Object.values(tw.entities()).find(x => x.kind === 'room');
          const w = document.createElement('div'); w.id = 'hsfaction'; w.style.cssText = 'position:fixed;left:8px;top:80px;z-index:99;width:max-content;max-width:calc(100vw - 16px)'; w.className = 'cbtn'; w.append(m.factionGrid(tw, e, { conditional: true, choose() {} })); document.getElementById('app').append(w); })()""")
        await look('faction grid'); await pg.evaluate("document.getElementById('hsfaction')?.remove()")
    # ---- the factions shelf
    if surf('factions') and gm_seat:
        await pg.evaluate("tw.library.showFactions()"); await look('factions shelf', 300); await pg.evaluate("tw.library.hideFactions()"); await closed(pg)
    # ---- the shortcuts sheet
    if surf('sheet'):
        await pg.keyboard.press('?'); await look('shortcuts sheet'); await closed(pg)
    # ---- rings, and what is behind them
    if surf('ring'):
        targets = await pg.evaluate("(() => { const es = Object.values(tw.entities()); const pick = (f) => es.find(f)?.id; return [pick(e => e.kind === 'token'), pick(e => e.kind === 'room'), pick(e => e.kind === 'object')].filter(Boolean); })()")
        for t in targets:
            await closed(pg)
            await pg.evaluate(f"(() => {{ const e = {E(t)}, g = tw.main.grab; g.focus.set(e.x ?? 0, 0, e.z ?? 0); g.yaw = 0; g.pitch = 52; g.dist = 95; g.update(); tw.main.rule = 'free'; tw.select('{t}'); }})()")
            await look(f'ring {t}', 400)
            await pg.evaluate("document.querySelector('#ring .rbtn[data-menu]')?.click()"); await look(f'ring menu {t}', 300)
            await pg.evaluate("document.querySelector('#ring .rbtn[data-cmd=\"pawn.sheet\"]')?.click()"); await look(f'ring {t} sheet', 260)
            await pg.evaluate("document.querySelector('#ring .rbtn[data-cmd=\"pawn.sheet\"]')?.click()"); await pg.wait_for_timeout(60)
            groups = await pg.evaluate("[...document.querySelectorAll('#ring .rbtn.grp')].map(b => b.dataset.group)")
            for g in groups:
                await pg.evaluate(f"""document.querySelector('#ring .rbtn.grp[data-group="{g}"]')?.click()""")
                await look(f'ring {t} {g}', 260)
                await pg.evaluate(f"""document.querySelector('#ring .rbtn.grp[data-group="{g}"]')?.click()""")
                await pg.wait_for_timeout(60)
        await closed(pg)

async def game(browser, page):
    print('GAME: every surface, every size, both text sizes')
    errors = []
    ctx = await browser.new_context(viewport={'width': 1440, 'height': 900})
    gm = await ctx.new_page(); gm.on('pageerror', lambda e: (errors.append(str(e)), print(f'    PAGEERROR {e}', flush=True)))
    await gm.goto(page)
    await gm.fill('#newCampaign input[name=gm]', LONG[:40])
    nm = await gm.query_selector('#newCampaign input[name=name]')
    if nm: await nm.fill(f"TEST no hscroll {time.strftime('%H%M%S')} (throwaway) {LONG}"[:80])
    await gm.click('#newCampaign button')
    check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 60000), 'GM tab live')
    invites = await fixture(gm)
    # a real player, online for the whole sweep: the player's surfaces are their own, and the GM's roster has someone to open
    link = gm.url; invite = await gm.evaluate(f'tw.inviteLink({json.dumps(invites[0])})')
    pc = await browser.new_context(viewport={'width': 1440, 'height': 900}); player = await pc.new_page(); player.on('pageerror', lambda e: (errors.append(str(e)), print(f'    PAGEERROR {e}', flush=True)))
    await player.goto(invite); check(await wait(player, 'window.tw && tw.ready && tw.ready()', 60000), 'player tab live')
    check(not await player.evaluate('tw.gm()'), 'the second tab really is a player')
    await wait(gm, "document.querySelectorAll('#roster .av[data-seat]').length >= 2", 15000, 'the player on the roster')
    bad = []
    hand = lambda u: (lambda b, _, f: b + ('&' if '?' in b else '?') + 'phone=0&hand=1' + ('#' + f if f else ''))(*u.partition('#'))
    for name, w, h, phone in SIZES:
        for scale in SCALES:
            where = f'{name} @{scale}'
            for seat in A.seats.split(','):
                c = None
                if phone:
                    c = await browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=PHONE_UA); pg = await c.new_page()
                    pg.on('pageerror', lambda e: errors.append(str(e)))
                    await pg.goto(hand(link if seat == 'gm' else invite)); check(await wait(pg, 'window.tw && tw.ready && tw.ready()', 60000), f'{where} {seat}: phone seat live')
                else:
                    pg = gm if seat == 'gm' else player
                    await pg.set_viewport_size({'width': w, 'height': h})
                await pg.evaluate(f"tw.settings.setPref('textScale', {scale})")
                n0 = len(bad)
                await surfaces(pg, seat == 'gm', f'{where} {seat}', w, h, phone, bad)
                print(f'    {where} {seat}: {len(bad) - n0} findings', flush=True)
                if c: await c.close()
    await pc.close()
    await ctx.close()
    return bad, errors

async def self_test(browser):
    print('SELF: the instrument')
    c, pg = await fresh(browser, 800, 600, False)
    await pg.set_content('<style>body{margin:0}</style><div id=s style="width:200px;height:100px;overflow:auto"><div style="height:400px"></div></div><div id=x style="width:200px;overflow-x:auto"><div style="width:400px;height:9px"></div></div><div id=h style="width:200px;overflow:hidden;white-space:nowrap">' + UNBROKEN * 3 + '</div><div id=f style="position:fixed;left:700px;top:300px;width:300px;height:20px" class=win></div>')
    bar = await pg.evaluate("(() => { const s = document.getElementById('s'); return s.offsetWidth - s.clientWidth; })()")
    check(bar >= 10, 'SELF classic scrollbars are on and take width (Playwright hides them by default)', bar)
    await pg.evaluate(SCAN)
    r = await pg.evaluate("([d, o, m]) => window.__hscan(d, o, m)", [[], '.win', []])
    check(any('#x' in x['el'] for x in r['out']), 'SELF a planted sideways scroller is caught', r['out'])
    check(any('#h' in x['el'] for x in r['clip']), 'SELF planted clipped text is caught', r['clip'])
    check(any('#f' in x['el'] for x in r['off']), 'SELF a window off the edge of the screen is caught', r['off'])
    await c.close()

async def fresh(browser, w, h, phone, scale_css=None):
    kw = dict(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=PHONE_UA) if phone else dict(viewport={'width': w, 'height': h})
    c = await browser.new_context(**kw); return c, await c.new_page()

async def front_doors(browser, page, site):
    """What a visitor meets before any table: the site's pages, the start page with a long memory, the phone page."""
    print('SITE: the pages around the game, every size')
    pages = [('about', 'about.html'), ('terms', 'terms.html'), ('privacy', 'privacy.html'), ('connect-dnd-beyond', 'connect-dnd-beyond.html'), ('vtt-index', 'vtt-index.html'),
             ('features', 'features.html'), ('dice', 'dice.html'), ('switching', 'switching.html'), ('export', 'export.html'), ('manual', 'manual.html')]
    bad = []
    if not A.sizes:  # either side of the index's table-to-cards line, and the ordinary laptop widths
        for w in (1240, 1239, 1280, 1366, 1600):
            c, pg = await fresh(browser, w, 800, False); await pg.goto(site + 'vtt-index.html'); await pg.wait_for_load_state('load'); await pg.wait_for_timeout(200)
            r = await scan(pg, f'{w} site vtt-index')
            for x in r['out'] + r['clip']: bad.append(('scroller', f'{w}', 'vtt-index', x))
            await c.close()
    for name, w, h, phone in SIZES:
        c, pg = await fresh(browser, w, h, phone)
        for label, f in pages:
            await pg.goto(site + f); await pg.wait_for_load_state('load'); await pg.wait_for_timeout(200)
            r = await scan(pg, f'{name} site {label}')
            for x in r['out']: bad.append(('scroller', name, label, x))
            for x in r['clip']: bad.append(('clipped', name, label, x))
            if label == 'vtt-index':
                # the detail window, on the widest row of notes
                await pg.goto(site + f + '#vtt=turnip-works'); await pg.wait_for_timeout(500)
                r = await scan(pg, f'{name} site vtt-index detail')
                for x in r['out']: bad.append(('scroller', name, 'vtt-index detail', x))
                for x in r['clip']: bad.append(('clipped', name, 'vtt-index detail', x))
        # the game's front door: nothing remembered, then a long memory; and the phone page
        base = page.split('#')[0]
        await pg.goto(base + '&phone=0'); await pg.wait_for_timeout(600)
        await pg.evaluate(f"""(() => {{ const L = document.querySelector('#rememberedGames'); if (L) {{ L.innerHTML = Array.from({{ length: 12 }}, (_, i) => `<li><button>${{i}} {UNBROKEN}{UNBROKEN} {LONG}</button></li>`).join(''); document.querySelector('#gameList, #games')?.removeAttribute('hidden'); }} }})()""")
        r = await scan(pg, f'{name} start page')
        for x in r['out']: bad.append(('scroller', name, 'start', x))
        for x in r['clip']: bad.append(('clipped', name, 'start', x))
        await pg.goto(base + '&phone=1'); await pg.wait_for_timeout(900)
        r = await scan(pg, f'{name} phone page')
        for x in r['out']: bad.append(('scroller', name, 'phone page', x))
        for x in r['clip']: bad.append(('clipped', name, 'phone page', x))
        await c.close()
    return bad

async def main():
    page, site = (*start_local(),) if A.local else (A.page, A.site)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, ignore_default_args=['--hide-scrollbars'], args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        await self_test(browser)
        bad = []
        if want('SITE'): bad += await front_doors(browser, page, site)
        if want('GAME'):
            b, errors = await game(browser, page); bad += b
            check(not errors, 'no page errors', errors[:3])
            if not WANT_SURF:
                for name, *_ in SIZES:
                    missing = [q for q in MUST_SEE if q not in HITS.get(name, set()) and not (name.startswith('phone') and q.startswith('#crumbs'))]  # (a phone has no crumbs: style.css "ON A PHONE")
                    check(not missing, f'COVERAGE {name}: every surface was really on screen', missing)
        print('\nFOUND (kind, element: [worst where, scrollWidth, clientWidth], count):')
        for (kind, el), rows in sorted(SEEN.items()):
            worst = max(rows, key=lambda r: r[1] - r[2]); print(f'  {kind:8} {el}: {worst} x{len(rows)}')
        check(not [k for k in SEEN if k[0] == 'scroller'], 'no horizontal scroller, no window off the screen, on any surface', len([k for k in SEEN if k[0] == 'scroller']))
        check(not [k for k in SEEN if k[0] == 'clipped'], 'nothing clipped sideways except what DECORATIVE names', len([k for k in SEEN if k[0] == 'clipped']))
        await browser.close()

def cleanup():
    for pr in procs:
        try: pr.terminate(); pr.wait(timeout=3)
        except Exception:
            try: pr.kill()
            except Exception: pass
    for d in tmp: shutil.rmtree(d, ignore_errors=True)

try: asyncio.run(main())
finally: cleanup()
fails = [r for r in results if not r[0]]
print(f'\n{len(results) - len(fails)}/{len(results)} passed')
sys.exit(1 if fails else 0)

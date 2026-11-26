#!/usr/bin/env python3
"""The phone product pass (2026-11-11, the stranger on the plane; docs/UI.md "On a phone").

  local:  TW_GPU=1 python3 engine/test/browser_phonefix.py --local
  dev:    ... browser_phonefix.py --page 'http://127.0.0.1:8180/'
  one:    --only pixel-portrait (pixel|iphone - portrait|landscape)

Emulated phones: Playwright's Pixel 7 and iPhone 13 (Chromium with is_mobile + has_touch, so html.tw-hand), each in
portrait and landscape; fingers are CDP touch points. Then a computer (DESK) and a slow phone (LOAD).

  BACK    (client/escapable.js) Back is popstate, so the tests go back with history.back(), which is what the system's
          Back does to the page (the real phone: engine/test/moto_back.py). Each of these, opened the way a finger does,
          is closed by one Back, the game stays (same address), and the history is level again afterwards: the Build,
          Pawns and Settings trays, the command bar's list, a pawn's ring and the ring opened (☰), a live tool, the
          shortcut sheet, an output card, the avatars' menu, the link card. Two at once take two Backs, newest first.
          Closed another way (the tray's Done ✕, the bar's ✕, a tap outside the bar, Escape) the entries go back off.
          Back with nothing open leaves the game (no trap).
  DONE    Build and Pawns have a Done ✕ (40 px) on a phone; the bar's ✕ shows only while its list is open
  VOICE   (surfaces/bar.js) the mic shows where the browser has speech recognition (here a stand-in, since a test
          browser has no speech service), and not where it has none; a tap opens the list without the keyboard and
          listens; "Elf barbarian." heard fills the query "elf barbarian", the list shows elf barbarians
  PLACE   (client/handheld.js) a tapped bar row (a thing), a Pawns figure and a Build ▸ Factions piece each come up as a
          ghost in the middle of the view at once; a tap on the table puts it down there (one more thing, near the
          tap); ✕ puts it back (nothing placed); a bar row dragged off the list onto the map is placed where let go
  PAWNS   (surfaces/pawns.js) the GM's phone tray leads with the catalog (Search, then Monsters, Animals, Townsfolk,
          Heroes), Mine is one row lower down; tap targets at least 40 px; a player's phone tray has their own pawn first
  DESK    1280 x 800, a mouse: none of it (no escapable, no ✕ or mic, Escape and history as before, the tray order and
          the chip-less place as before)
  LOAD    a Pixel on a slow line (1.6 Mbit/s, 150 ms): the table opens, and Back closes the Build tray there too
"""
import argparse, asyncio, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import phonekit as K

ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--only', default='')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:400] if detail != '' else ''}", flush=True)

ST = "(() => ({ url: location.href, hist: history.length, n: tw.escapable?.entries?.() ?? null, d: tw.escapable?.depth?.() ?? null, open: tw.escapable?.open?.() || null, going: tw.escapable?.going?.() }))()"
LEVEL = "tw.escapable && !tw.escapable.going() && tw.escapable.entries() === tw.escapable.depth()"

async def settle(pg, ms=350):
    await pg.wait_for_timeout(ms); await K.wait(pg, LEVEL, 4000, 'history level')

async def back(pg):
    await pg.evaluate("history.back()"); await pg.wait_for_timeout(450); await K.wait(pg, LEVEL, 4000, 'level after Back')

async def back_cases(pg, cdp, tag, url0, W, H):
    # each opener: (name, how a finger opens it (JS or a tap), what says it is open)
    async def tapsel(sel):
        b = await K.at(pg, sel)
        if b: await K.tap(cdp, *b)
        return bool(b)
    cases = [
        ('Build tray', lambda: tapsel('#launchers .launcher:nth-child(2)'), "tw.build.isOpen"),
        ('Pawns tray', lambda: tapsel('#launchers .launcher:nth-child(1)'), "tw.pawns.isOpen"),
        ('Settings', lambda: tapsel('#launchers .launcher:nth-child(3)'), "tw.settings.isOpen"),
        ('the command bar', lambda: tapsel('#bar textarea'), "document.getElementById('bar').classList.contains('open')"),
        ('a live tool', lambda: pg.evaluate("tw.pawnTool.start('foe-goblin') || tw.pawnTool.start(tw.figures.list[0])"), "!!tw.mode"),
        ('the shortcut sheet', lambda: pg.evaluate("tw.emit('sheet.toggle')"), "!document.getElementById('sheet').hidden"),
        ('an output card', lambda: pg.evaluate("tw.emit('output', { title: 'Invite', text: 'https://example.invalid/x' })"), "!document.getElementById('output').hidden"),
        ('the link card', lambda: pg.evaluate("tw.registry.run('linkmail.open')"), "!!document.getElementById('linkMail') && !document.getElementById('linkMail').hidden"),
    ]
    for name, opener, isopen in cases:
        s0 = await pg.evaluate(ST)
        await opener(); await settle(pg, 700)
        s1 = await pg.evaluate(ST); was = await pg.evaluate(isopen)
        await back(pg)
        s2 = await pg.evaluate(ST); still = await pg.evaluate(isopen)
        check(was and not still and s2['url'] == url0 and s1['n'] >= 1 and s2['d'] == 0 and s2['n'] == 0, f'BACK {tag}: Back closes {name}; the game stays, the history level', {'open': was, 'after': still, 's1': {k: s1[k] for k in ('n', 'd', 'open')}, 's2': {k: s2[k] for k in ('n', 'd', 'url')} if s2['url'] != url0 else {k: s2[k] for k in ('n', 'd')}})
        await K.esc_all(pg, 2); await settle(pg)
    # the ring: a tap on the pawn selects it, ☰ opens it out; two Backs, newest first
    sp = await pg.evaluate("(() => { const e = tw.entities()['tok_pfix00001']; return tw.screenOf(e.x, e.z, tw.main, 2); })()")
    await K.tap(cdp, sp['x'], sp['y']); await pg.wait_for_timeout(900)
    await pg.evaluate("tw.ringOpen('expanded')"); await settle(pg, 500)
    r1 = await pg.evaluate("({ sel: tw.sel.size, ring: tw.ringState(), n: tw.escapable.entries() })")
    await back(pg); r2 = await pg.evaluate("({ sel: tw.sel.size, ring: tw.ringState(), n: tw.escapable.entries() })")
    await back(pg); r3 = await pg.evaluate("({ sel: tw.sel.size, ring: tw.ringState(), n: tw.escapable.entries(), url: location.href })")
    check(r1['sel'] == 1 and r1['ring'] == 'expanded' and r1['n'] == 2 and r2['sel'] == 1 and r2['ring'] == 'closed' and r3['sel'] == 0 and r3['n'] == 0 and r3['url'] == url0, f'BACK {tag}: a pawn tapped and its ring opened: Back folds the ring, Back again lets the pawn go', [r1, r2, r3])
    # the avatars' menu (the GM's, on a player's avatar)
    seats = await pg.evaluate("[...document.querySelectorAll('#roster .av[data-seat]')].map(a => a.dataset.seat)")
    a1 = False
    for seat in seats:
        if await pg.evaluate(f"tw.roster.menu('{seat}')"): a1 = True; break
    await settle(pg, 400)
    if a1: await back(pg)
    a2 = await pg.evaluate("!!document.querySelector('.rosterpop')")
    check(a1 and not a2 and await pg.evaluate("location.href") == url0, f"BACK {tag}: Back closes the avatars' menu", {'seats': seats, 'open': a1, 'after': a2})
    # closed another way: the Done ✕, the bar's ✕, a tap outside, Escape -- the history goes back level
    await K.tap(cdp, *(await K.at(pg, '#launchers .launcher:nth-child(2)'))); await settle(pg, 700)
    done = await pg.evaluate("(() => { const b = document.querySelector('#buildMenu .tdone'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height]; })()")
    h0 = await pg.evaluate("history.length")
    if done: await K.tap(cdp, done[0], done[1])
    await settle(pg); x1 = await pg.evaluate(ST)
    await K.tap(cdp, *(await K.at(pg, '#launchers .launcher:nth-child(1)'))); await settle(pg, 700)
    pdone = await pg.evaluate("(() => { const b = document.querySelector('#pawnsTray .tdone'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height]; })()")
    if pdone: await K.tap(cdp, pdone[0], pdone[1])
    await settle(pg); x2 = await pg.evaluate(ST)
    check(done and pdone and min(done[2:]) >= 40 and min(pdone[2:]) >= 40 and not await pg.evaluate("tw.build.isOpen || tw.pawns.isOpen") and x1['n'] == 0 and x2['n'] == 0, f'DONE {tag}: Build and Pawns each have a Done ✕ (40 px) that closes them, and the history goes back level', {'build': done, 'pawns': pdone, 'n': [x1['n'], x2['n']]})
    bx0 = await pg.evaluate("(() => { const b = document.querySelector('#bar .bx'); return !!b && getComputedStyle(b).display !== 'none'; })()")
    await K.tap(cdp, *(await K.at(pg, '#bar textarea'))); await settle(pg, 600)
    bx = await pg.evaluate("(() => { const b = document.querySelector('#bar .bx'); if (!b || getComputedStyle(b).display === 'none') return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height]; })()")
    if bx: await K.tap(cdp, bx[0], bx[1])
    await settle(pg); y1 = await pg.evaluate("({ open: document.getElementById('bar').classList.contains('open'), n: tw.escapable.entries() })")
    await K.tap(cdp, *(await K.at(pg, '#bar textarea'))); await settle(pg, 600)
    await K.tap(cdp, W * 0.5, H * 0.75); await settle(pg)
    y2 = await pg.evaluate("({ open: document.getElementById('bar').classList.contains('open'), n: tw.escapable.entries() })")
    await K.tap(cdp, *(await K.at(pg, '#launchers .launcher:nth-child(2)'))); await settle(pg, 700)
    await pg.keyboard.press('Escape'); await settle(pg)
    y3 = await pg.evaluate("({ open: tw.build.isOpen, n: tw.escapable.entries() })")
    check(not bx0 and bx and min(bx[2:]) >= 40 and not y1['open'] and y1['n'] == 0 and not y2['open'] and y2['n'] == 0 and not y3['open'] and y3['n'] == 0 and await pg.evaluate("history.length") == h0, f"DONE {tag}: the bar's ✕ (only while open) closes it, so does a tap outside it, and Escape closes Build; the history stays level each time", {'x shut': bx0, 'x': bx, 'bar x': y1, 'outside': y2, 'escape': y3})
    # two at once: Settings over a selected pawn: Back closes Settings first, then the pawn
    await pg.evaluate("tw.select(['tok_pfix00001'])"); await settle(pg, 400)
    await K.tap(cdp, *(await K.at(pg, '#launchers .launcher:nth-child(3)'))); await settle(pg, 700)
    t1 = await pg.evaluate("({ s: tw.settings.isOpen, sel: tw.sel.size, n: tw.escapable.entries() })")
    await back(pg); t2 = await pg.evaluate("({ s: tw.settings.isOpen, sel: tw.sel.size })")
    await back(pg); t3 = await pg.evaluate("({ s: tw.settings.isOpen, sel: tw.sel.size, n: tw.escapable.entries() })")
    check(t1['s'] and t1['sel'] == 1 and t1['n'] == 2 and not t2['s'] and t2['sel'] == 1 and t3['sel'] == 0 and t3['n'] == 0, f'BACK {tag}: two open (a pawn, then Settings): Back closes Settings, then lets the pawn go', [t1, t2, t3])

async def voice(p, page, W, H, which, tag):
    # a stand-in for the browser's speech recognition: start() hears "Elf barbarian." in two steps, then ends
    fake = """window.__heard = []; class FakeSR { constructor() { window.__sr = this; this.lang = ''; } start() { window.__heard.push('start'); setTimeout(() => this.onresult?.({ results: [[{ transcript: 'Elf' }]] }), 120); setTimeout(() => this.onresult?.({ results: [[{ transcript: 'Elf barbarian.' }]] }), 300); setTimeout(() => this.onend?.(), 450); } stop() { this.onend?.(); } abort() { this.onend?.(); } }
      window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;"""
    br, ctx, pg, cdp, errs = await K.gm_table_with(p, page, W, H, f'voice {tag}', which, init=fake)
    mic = await pg.evaluate("(() => { const b = document.querySelector('#bar .bmic'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height]; })()")
    if mic: await K.tap(cdp, mic[0], mic[1])
    await pg.wait_for_timeout(150)
    mid = await pg.evaluate("({ open: document.getElementById('bar').classList.contains('open'), kb: document.activeElement === document.querySelector('#bar textarea'), on: document.querySelector('#bar .bmic')?.classList.contains('on'), listening: tw.barVoice?.listening?.() })")
    await pg.wait_for_timeout(900)
    end = await pg.evaluate("({ q: document.querySelector('#bar textarea').value, rows: [...document.querySelectorAll('#results .res')].slice(0, 6).map(r => r.innerText.replace(/\\s+/g, ' ').trim().toLowerCase()), on: document.querySelector('#bar .bmic')?.classList.contains('on'), heard: window.__heard })")
    elfy = [r for r in end['rows'] if 'elf' in r and 'barbarian' in r]
    check(mic and min(mic[2:]) >= 40 and mid['open'] and not mid['kb'] and mid['on'] and end['q'] == 'elf barbarian' and elfy and not end['on'] and not errs, f'VOICE {tag}: the mic (40 px) opens the list without the keyboard and listens; "Elf barbarian." heard is the query "elf barbarian", and the list shows elf barbarians', {'mic': mic, 'mid': mid, 'q': end['q'], 'rows': end['rows'][:4], 'errs': errs[:2]})
    await ctx.close(); await br.close()
    nosr = "delete window.SpeechRecognition; delete window.webkitSpeechRecognition; window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined;"
    br, ctx, pg, cdp, errs = await K.gm_table_with(p, page, W, H, f'nomic {tag}', which, init=nosr)
    none = await pg.evaluate("({ mic: !!document.querySelector('#bar .bmic'), v: tw.barVoice })")
    check(not none['mic'] and none['v'] == {'supported': False}, f'VOICE {tag}: a browser without speech recognition shows no mic', none)
    await ctx.close(); await br.close()

GHOST = "(() => { const g = tw.modes.ghostInfo?.(); if (!g) return null; const s = tw.screenOf(g.x, g.z, tw.main, 0); return { ...g, sx: s?.x, sy: s?.y, mode: tw.mode?.kind || null, chip: tw.handTool }; })()"
async def place_cases(pg, cdp, tag, W, H):
    centre = await pg.evaluate("(() => { const c = document.getElementById('c').getBoundingClientRect(); return [c.left + c.width / 2, c.top + c.height * 0.55]; })()")
    near = lambda g: g and g['visible'] and g['sx'] is not None and abs(g['sx'] - centre[0]) < W * 0.12 and abs(g['sy'] - centre[1]) < H * 0.15
    spot = (W * 0.38, H * 0.62)
    # the bar: a thing's row, tapped
    n0 = await pg.evaluate(K.COUNT('object'))
    await K.tap(cdp, *(await K.at(pg, '#bar textarea'))); await pg.wait_for_timeout(400)
    await pg.keyboard.type('chair'); await pg.wait_for_timeout(700)
    row = await K.at(pg, '#results .res:has([data-pv])')
    if row: await K.tap(cdp, *row)
    await pg.wait_for_timeout(500); g = await pg.evaluate(GHOST)
    await K.tap(cdp, *spot); await pg.wait_for_timeout(900)
    n1 = await pg.evaluate(K.COUNT('object')); landed = await pg.evaluate(f"(() => {{ const o = Object.values(tw.entities()).filter(e => e.kind === 'object').at(-1); if (!o) return null; const s = tw.screenOf(o.x, o.z, tw.main, 0); return [s.x, s.y]; }})()")
    check(row and g and g['mode'] == 'place' and near(g) and 'tap the table' in (g['chip'] or '') and n1 == n0 + 1 and landed and abs(landed[0] - spot[0]) < 50 and abs(landed[1] - spot[1]) < 60 and not await pg.evaluate("!!tw.mode"), f'PLACE {tag}: a tapped bar row comes up as a ghost in the middle at once; a tap on the table puts it down there', {'ghost': g, 'centre': centre, 'n': [n0, n1], 'landed': landed, 'spot': spot})
    await K.esc_all(pg, 2)
    # its ✕: nothing placed
    await K.tap(cdp, *(await K.at(pg, '#bar textarea'))); await pg.wait_for_timeout(400)
    await pg.keyboard.type('chair'); await pg.wait_for_timeout(700)
    await K.tap(cdp, *(await K.at(pg, '#results .res:has([data-pv])'))); await pg.wait_for_timeout(500)
    up = await pg.evaluate(GHOST); cb = await K.at(pg, '#handTool button'); await K.tap(cdp, *cb); await pg.wait_for_timeout(500)
    check(near(up) and not await pg.evaluate("!!tw.mode") and await pg.evaluate(K.COUNT('object')) == n1, f'PLACE {tag}: its ✕ puts it back, nothing placed', up)
    # the Pawns tray: a figure, tapped (Monsters ▸ … ▸ a figure)
    t0 = await pg.evaluate(K.COUNT('token'))
    await K.tap(cdp, *(await K.at(pg, '#launchers .launcher:nth-child(1)'))); await pg.wait_for_timeout(700)
    for _ in range(4):
        fig = await K.at(pg, '#pawnsTray [data-fig]')
        if fig: break
        nd = await K.at(pg, '#pawnsTray [data-sec="place"] [data-node], #pawnsTray .tree [data-node]')
        if not nd: break
        await K.tap(cdp, *nd); await pg.wait_for_timeout(600)
    if fig: await K.tap(cdp, *fig)
    await pg.wait_for_timeout(600); pgh = await pg.evaluate(GHOST); shut = not await pg.evaluate("tw.pawns.isOpen")
    await K.tap(cdp, *spot); await pg.wait_for_timeout(900)
    t1 = await pg.evaluate(K.COUNT('token'))
    check(fig and shut and pgh and pgh['mode'] == 'place' and near(pgh) and t1 == t0 + 1, f'PLACE {tag}: a Pawns figure tapped: the tray steps aside and the pawn comes up in the middle; a tap puts it down', {'ghost': pgh, 'tokens': [t0, t1]})
    await K.esc_all(pg, 2)
    # Build ▸ Factions: a piece, tapped
    await K.tap(cdp, *(await K.at(pg, '#launchers .launcher:nth-child(2)'))); await pg.wait_for_timeout(700)
    fb = await K.at(pg, '#buildMenu [data-factions]')
    if fb: await K.tap(cdp, *fb); await pg.wait_for_timeout(900)
    cell = await K.at(pg, '#factionShelf [data-sku]')
    if cell: await K.tap(cdp, *cell)
    await pg.wait_for_timeout(700); fgh = await pg.evaluate(GHOST)
    check(cell and fgh and fgh['mode'] == 'place' and near(fgh), f'PLACE {tag}: a Build ▸ Factions piece tapped comes up as a ghost in the middle', {'cell': cell, 'ghost': fgh})
    await K.esc_all(pg, 3)
    # dragging a row off the list still works (a figure's row: the rows a finger drags; a thing's row scrolls the list,
    # as it did, and is placed with a tap now): placed where let go
    n2 = await pg.evaluate(K.COUNT('token'))
    await K.tap(cdp, *(await K.at(pg, '#bar textarea'))); await pg.wait_for_timeout(400)
    await pg.keyboard.type('goblin'); await pg.wait_for_timeout(700)
    row = await K.at(pg, '#results .res.drags')
    to = (W * 0.62, H * 0.72)
    if row: await K.drag(cdp, row, to, steps=6)
    await pg.wait_for_timeout(900)
    n3 = await pg.evaluate(K.COUNT('token')); last = await pg.evaluate("(() => { const o = Object.values(tw.entities()).filter(e => e.kind === 'token').at(-1); const s = tw.screenOf(o.x, o.z, tw.main, 0); return [s.x, s.y]; })()")
    check(row and n3 == n2 + 1 and abs(last[0] - to[0]) < 60 and abs(last[1] - to[1]) < 70 and not await pg.evaluate("!!tw.handGhost && Date.now() - tw.handGhost.at < 1500 && !!tw.mode"), f'PLACE {tag}: a figure row dragged off the bar list is placed where it is let go (no ghost put in the middle)', {'n': [n2, n3], 'at': last, 'to': to})
    await K.esc_all(pg, 2)

TRAY = """(() => { const t = document.getElementById('pawnsTray'); const secs = [...t.querySelectorAll('.pbody > .psec')].map(s => s.dataset.sec);
  const place = t.querySelector('[data-sec="place"]'), tiles = place ? [...place.querySelectorAll('[data-node]')].map(b => b.dataset.node) : [];
  const search = t.querySelector('[data-sec="place"] .phsearch'), sr = search?.getBoundingClientRect(), tr = t.getBoundingClientRect();
  const mine = t.querySelector('[data-sec="mine"]'), mr = mine?.getBoundingClientRect();
  const small = [...t.querySelectorAll('button, [role=button]')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && getComputedStyle(b).visibility !== 'hidden' && Math.min(r.width, r.height) < 40; }).map(b => b.className + ':' + Math.round(Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height)));
  return { secs, tiles: tiles.slice(0, 5), search: sr ? [sr.top - tr.top, sr.height] : null, mineH: mr ? mr.height : null, mineRow: !!mine?.querySelector('.mrow'), newp: !!t.querySelector('[data-newpawn]'), small: small.slice(0, 8), nsmall: small.length }; })()"""
async def pawns_cases(pg, cdp, br, tag, W, H, which):
    await K.tap(cdp, *(await K.at(pg, '#launchers .launcher:nth-child(1)'))); await pg.wait_for_timeout(800)
    home = await K.at(pg, '#pawnsTray [data-home]')  # (the tray comes back where it was left: a figure's grid, after PLACE)
    if home: await K.tap(cdp, *home); await pg.wait_for_timeout(600)
    t = await pg.evaluate(TRAY)
    check(t['secs'][:1] == ['place'] and t['tiles'][:4] == ['monsters', 'animals', 'townsfolk', 'heroes'] and t['search'] and t['search'][0] < 90 and t['search'][1] >= 44 and t['mineRow'] and t['mineH'] < 64 and t['newp'] and t['secs'].index('mine') > t['secs'].index('party'), f"PAWNS {tag}: the GM's tray leads with Search and the catalog (monsters, animals, townsfolk, then heroes); Mine is one row, lower down", t)
    check(t['nsmall'] == 0, f'PAWNS {tag}: every tap target in the tray is at least 40 px', t['small'])
    await K.esc_all(pg, 2)
    pl, pctx, pcdp, perrs = await K.player(br, pg, W, H)
    await K.tap(pcdp, *(await K.at(pl, '#launchers .launcher:nth-child(1)'))); await pl.wait_for_timeout(800)
    pt = await pl.evaluate(TRAY); mine = await pl.evaluate("[...document.querySelectorAll('#pawnsTray [data-sec=\"mine\"] [data-mine] .bl')].map(e => e.textContent)")
    check(pt['secs'][:1] == ['mine'] and 'Pat' in mine and not perrs, f"PAWNS {tag}: a player's tray keeps their own pawn first", {'secs': pt['secs'], 'mine': mine})
    await pctx.close()

async def phone(p, page, W, H, which):
    tag = f"{which} {'portrait' if H > W else 'landscape'}"
    print(f'--- {tag} {W} x {H}')
    br, ctx, pg, cdp, errs = await K.gm_table(p, page, W, H, tag, which)
    check(br._tw_ready and await pg.evaluate("document.documentElement.classList.contains('tw-hand') && !!tw.escapable"), f'{tag}: the table is live, laid out for a phone, Back is ours')
    await K.furnish(pg)
    await pg.evaluate("tw.createSeat({ kind: 'human', role: 'player', name: 'Robin', color: '#aa5533', placeholder: false })"); await pg.wait_for_timeout(500)
    url0 = await pg.evaluate("location.href")
    await back_cases(pg, cdp, tag, url0, W, H)
    await place_cases(pg, cdp, tag, W, H)
    await pawns_cases(pg, cdp, br, tag, W, H, which)
    # last: Back with nothing open leaves the game
    await K.esc_all(pg, 3); await settle(pg)
    before = await pg.evaluate(ST)
    await pg.evaluate("history.back()"); await pg.wait_for_timeout(1500)
    check(before['d'] == 0 and before['n'] == 0 and pg.url != url0, f'BACK {tag}: Back with nothing open leaves the game (no trap)', {'before': {k: before[k] for k in ('n', 'd')}, 'now': pg.url[:60]})
    check(not errs, f'{tag}: no page errors', errs[:3])
    await ctx.close(); await br.close()
    await voice(p, page, W, H, which, tag)

async def desktop(p, page):
    print('--- desk 1280 x 800')
    br = await p.chromium.launch(headless=True, args=['--no-sandbox', *K.GL])
    ctx = await br.new_context(viewport={'width': 1280, 'height': 800}, reduced_motion='reduce')
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    await pg.add_init_script("window.webkitSpeechRecognition = window.webkitSpeechRecognition || function () {};")
    await pg.goto(page + '&phone=0')
    await pg.wait_for_selector('#newCampaign input[name=gm]', timeout=30000)
    await pg.fill('#newCampaign input[name=gm]', 'Harry')
    nm = await pg.query_selector('#newCampaign input[name=name]')
    if nm: await nm.fill(f"TEST phone desk {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
    await pg.click('#newCampaign button')
    await K.wait(pg, 'window.tw && tw.ready && tw.ready()', 60000, 'table')
    await pg.evaluate("document.querySelector('.lmcard .lm-x')?.click()")
    h0 = await pg.evaluate("history.length")
    await pg.keyboard.press('b'); await pg.wait_for_timeout(600)
    d = await pg.evaluate("({ esc: !!tw.escapable, hand: document.documentElement.classList.contains('tw-hand'), done: !!document.querySelector('.tdone'), mic: !!document.querySelector('#bar .bmic'), bx: !!document.querySelector('#bar .bx'), build: tw.build.isOpen, hist: history.length })")
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
    shut = await pg.evaluate("!tw.build.isOpen")
    check(not d['esc'] and not d['hand'] and not d['done'] and not d['mic'] and not d['bx'] and d['build'] and shut and d['hist'] == h0 and await pg.evaluate("history.length") == h0, 'DESK: none of it on a computer (no Back handling, no ✕ or mic even with speech recognition there); B opens Build, Escape closes it, the history untouched', d)
    await pg.keyboard.press('p'); await pg.wait_for_timeout(600)
    secs = await pg.evaluate("[...document.querySelectorAll('#pawnsTray .pbody > .psec')].map(s => s.dataset.sec)")
    order = await pg.evaluate("tw.pawns.sections.map(([k]) => k)")
    tiles = await pg.evaluate("[...document.querySelectorAll('#pawnsTray [data-sec=\"place\"] [data-node]')].map(b => b.dataset.node).slice(0, 4)")
    check(secs == [s for s in order if s in secs] and secs.index('mine') < secs.index('place') and not await pg.evaluate("!!document.querySelector('#pawnsTray .phsearch, #pawnsTray .mrow')") and tiles[:1] == ['heroes'], "DESK: the Pawns tray as before (Mine before Place, the kinds in the tree's own order)", {'secs': secs, 'tiles': tiles})
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    await pg.evaluate("tw.pawnTool.start('foe-goblin') || tw.pawnTool.start(tw.figures.list[0])"); await pg.wait_for_timeout(300)
    gi = await pg.evaluate("tw.modes.ghostInfo?.()")
    check(gi and not gi['visible'] and not await pg.evaluate("!!tw.handGhost"), 'DESK: a pick arms the tool with the ghost on the pointer, as before (not put in the middle)', gi)
    check(not errs, 'DESK: no page errors', errs[:3])
    await ctx.close(); await br.close()

async def slow(p, page):
    print('--- load: a Pixel on a slow line')
    net = {'offline': False, 'latency': 150, 'downloadThroughput': 1.6 * 1024 * 1024 / 8, 'uploadThroughput': 750 * 1024 / 8}
    t0 = time.time()
    br, ctx, pg, cdp, errs = await K.gm_table(p, page, 412, 915, 'slow', 'pixel', net=net)
    secs = round(time.time() - t0)
    ok = br._tw_ready and await pg.evaluate("!!tw.escapable")
    if ok:
        b = await K.at(pg, '#launchers .launcher:nth-child(2)'); await K.tap(cdp, *b); await pg.wait_for_timeout(1200)
        o = await pg.evaluate("tw.build.isOpen"); await pg.evaluate("history.back()"); await pg.wait_for_timeout(900)
        ok = o and not await pg.evaluate("tw.build.isOpen")
    check(ok and not errs, f'LOAD: on 1.6 Mbit/s with 150 ms the table opens ({secs} s) and Back closes Build there', errs[:2])
    await ctx.close(); await br.close()

async def main():
    page = K.start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with K.async_playwright() as p:
        for which, W, H in (('pixel', 412, 915), ('iphone', 390, 844)):
            for w, h in ((W, H), (H, W)):
                tag = f"{which}-{'portrait' if h > w else 'landscape'}"
                if A.only and A.only not in tag: continue
                await phone(p, page, w, h, which)
        if not A.only or A.only == 'desk': await desktop(p, page)
        if not A.only or A.only == 'load': await slow(p, page)

try: asyncio.run(main())
finally: K.cleanup()
n = sum(1 for r in results if r[0])
print(f'phonefix: {n}/{len(results)} checks passed')
sys.exit(0 if n == len(results) and results else 1)

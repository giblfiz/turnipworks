"""THE SHOT SCRIPTS (tools/promo/shots, 2026-10-22). One async function per kind of shot; a registry entry
(shots/registry.json) names the function and its params, so one function can make several labelled shots (a different
building, camera, length). Every script:
  * sets its scene up on REAL time first (the game loads, drops are warmed: the same drop far off, watched until every
    mesh is cached), then freezes the clocks; everything filmed runs at 1x on the stepped clock;
  * uses the game's real UI and behaviour (real mouse / key input, the game's own commands); capture-only additions are
    the rig's pointer and, where a shot says so, caption mats; nothing imitates game UI;
  * returns a dict of notes (events, timings) that shoot.py keeps in capture.json.
Camera dicts: focus x, y, z (ft), pitch, yaw (deg), dist (ft).
"""
import os
import rig as R

# the drop has its choreography: a start time on its first piece (until then the clock is held: it waits on real work)
STARTED = "(() => { const w = tw.worldOf(tw.area()); for (const a of w.anims.values()) if (Number.isFinite(a.t0)) return true; return false; })()"
INN1 = {'kind': 'building', 'code': 'TAV', 'seed': 7, 'storeys': 1, 'front': 'S', 'label': 'The Turnip & Tankard', 'rect': {'x': 0, 'z': 0, 'w': 10, 'd': 7}}

async def spin(rig, P):
    """a building's spin-in at 1x with a camera move: hold on empty ground, drop, the camera eases from `cam` to `cam2`
    over the whole shot; ends `tail` s after the last piece above ground rests (or at `seconds`)."""
    spec = {**INN1, **P.get('building', {})}; cam = P['cam']; cam2 = P.get('cam2', cam)
    S = await rig.seat('gm'); await rig.chrome(S, P.get('ui', 'none'))
    r = spec['rect']; cam, cam2 = await framed(rig, S, P, cam, cam2, [r['x'] * 5, r['z'] * 5, (r['x'] + r['w']) * 5, (r['z'] + r['d']) * 5], 11.0 + 10 * (spec.get('storeys', 1) - 1))
    await rig.warm(S, spec, cam)
    await rig.freeze()
    total = round(P.get('seconds', 7.0) * R.FPS); pre = round(P.get('pre', 0.4) * R.FPS)
    k = 0
    async def camstep(_):
        nonlocal k
        await rig.cam(S, R.lerp_cam(cam, cam2, R.ease(k / max(1, total - 1), P.get('ease', 'smooth')))); k += 1
    await rig.frames(pre, camstep)
    bid = await rig.drop(S, spec)
    _, ready = await rig.hold_until(S, STARTED)
    if ready > 3: rig.fails.append(f'drop took {ready} s real to be ready (warm-up did not cache)')
    land = None
    while k < total:
        await camstep(0); await rig.step()
        st = await S.ev(R.C.STATS)
        if land is None and st['T']['g'][0] + st['T']['u'][0] == 0 and st['anims'] == 0: land = (k - pre) / R.FPS
    return {'building': bid, 'ready_real_s': ready, 'last_land_s_after_drop': land, 'pre_s': pre / R.FPS}

# ---------------------------------------------------------------------------------------------------------------------
# SCENE SET-UP (real time, before the freeze): the inn built and at rest, pawns placed and their meshes loaded
QUIET_ALL = "(() => { const w = tw.worldOf(tw.area()); return w.anims.size === 0 && !(w.stages || []).length && !w.lastEpisode?.loading && tw.sync.pendingCount() === 0 && (!tw.storeyTour || !!tw.storeyTour.end); })()"
FIGS_LOADED = "(() => { const w = tw.worldOf(tw.area()); return Object.values(tw.entities()).filter(e => e.kind === 'token' && e.fig).every(e => w.figureOf?.(e.id)?.loaded); })()"
ROOMS = "(() => Object.values(tw.entities()).filter(e => e.kind === 'room').map(e => ({ id: e.id, type: e.recipe.type, x: e.recipe.x * 5, z: e.recipe.z * 5, w: e.recipe.w * 5, d: e.recipe.d * 5, y: e.recipe.y || 0, cx: (e.recipe.x + e.recipe.w / 2) * 5, cz: (e.recipe.z + e.recipe.d / 2) * 5 })))()"

# a new building's offers (other storey counts, re-roll) stand beside it for 14 s, then go down into the chat as lines:
# the scene was built off camera, so they are put away at once, as a GM who ignored them would after a moment (no chat lines)
NO_OFFERS = "(() => { const cb = tw.condButtons; if (!cb) return 0; let n = 0; for (const k of cb.list().map(x => x.key)) if (k.startsWith('bld-')) { cb.hide(k); n++; } return n; })()"

async def settle(S, timeout=240000):
    await S.page.wait_for_timeout(500); await S.page.wait_for_function(QUIET_ALL, timeout=timeout)
    await S.page.wait_for_function(FIGS_LOADED, timeout=120000)
    t = __import__('time').time()
    while __import__('time').time() - t < 60 and S.inflight: await S.page.wait_for_timeout(200)
    await S.page.wait_for_timeout(1200)

async def inn_scene(rig, S, building=None, fog=False):
    """the inn (one storey by default) built at the origin in real time and at rest; fog of war off unless asked"""
    if not fog: await S.ev("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })"); await S.page.wait_for_function("tw.sync.pendingCount() === 0")
    spec = {**INN1, **(building or {})}
    await rig.cam(S, {'x': 25, 'z': 17, 'pitch': 50, 'yaw': -30, 'dist': 110})
    await rig.drop(S, spec); await S.page.wait_for_timeout(300); await S.ev(NO_OFFERS); await settle(S); await S.ev(NO_OFFERS)
    await S.ev("tw.cutOff?.('api')"); await S.ev("tw.clearSelection?.()"); await S.page.wait_for_timeout(400)
    rooms = await S.ev(ROOMS)
    return {r['type']: r for r in rooms} | {'_all': rooms}

async def pawns(S, fig, x, z, count=1, name=None):
    opts = {'count': count, 'select': False, **({'name': name} if name else {})}
    ids = await S.ev("(q) => tw.addPawns(q.fig, q.x, q.z, q.o)", {'fig': fig, 'x': x, 'z': z, 'o': opts})
    await S.page.wait_for_function("tw.sync.pendingCount() === 0"); return ids

async def bar(rig, S, text, cps=10, enter=True, pause=0.25):
    """the command bar the way a person uses it: '/', the words typed, a beat, Enter"""
    await rig.key(S, '/'); await rig.frames(round(0.2 * R.FPS))
    await rig.type(S, text, cps); await rig.secs(pause)
    if enter: await rig.key(S, 'Enter'); await rig.step()

def px(S, x, y):
    """a page point written for a 1920 x 1080 page, at the same place on S's page (v4: square and 4:5 takes; identity at 1920 x 1080)"""
    return (x * S.w / 1920, y * S.h / 1080)

async def at(rig, S, x, z, y=0):
    return await rig.screen(S, x, z, y)

# ---------------------------------------------------------------------------------------------------------------------
async def idle_pane(rig, k, text):
    """a window not open yet (a player who has not had the link): its pane shows one quiet line of type, not black"""
    import shutil, tempfile, urllib.parse as U
    from PIL import Image
    pw, ph = rig.pane_size(); tmp = tempfile.mkdtemp(prefix='tw-idle-')
    shutil.copy(os.path.join(R.C.REPO, 'engine', 'client', 'vendor', 'inter', 'inter-latin-wght-normal.woff2'), os.path.join(tmp, 'inter.woff2'))
    open(os.path.join(tmp, 'idle.html'), 'w').write('<!doctype html><style>@font-face{font-family:Inter;src:url(inter.woff2)}html,body{margin:0;height:100%;background:#2b251e;display:grid;place-items:center;font:500 22px Inter,sans-serif;color:rgba(246,234,210,.55);letter-spacing:.04em}</style><div id=t></div><script>t.textContent=new URLSearchParams(location.search).get("t")</script>')
    pg = await rig.browser.new_page(viewport={'width': pw, 'height': ph}); await pg.goto(f'file://{tmp}/idle.html?' + U.urlencode({'t': text})); await pg.evaluate('document.fonts.ready')
    path = os.path.join(rig.out, f'idle{k}.png'); await pg.screenshot(path=path); await pg.close()
    im = Image.open(path).convert('RGB'); comp = rig.compose
    def c2(ims): return comp([im if (j == k and x is None) else x for j, x in enumerate(ims)])
    rig.compose = c2

# the player's loading screen (#twl) still shows (not gone, not faded out): 1, else 0
LOADING_SHOWN = "(() => { const L = document.getElementById('twl'); if (!L || !L.isConnected) return document.readyState === 'loading' ? 1 : 0; const cs = getComputedStyle(L); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 ? 1 : 0; })()"
# pawns with no figure owned by a seat (the placeholder-pawn-on-invite feature, if it has landed): noted, never required
GHOSTS = "(() => Object.values(tw.entities()).filter(e => e.kind === 'token' && (e.placeholder || !e.fig)).map(e => ({ id: e.id, name: e.name, owner: e.owner || null })))()"

async def join(rig, P):
    """JOIN BY LINK, split screen: the GM (left) types `invite Pat` into the command bar, the game's invite panel shows
    the link, the GM copies it; the player's window (right) opens that link: the loading screen, then the table. The
    player moves the pointer over the inn and the GM sees Pat's cursor and Pat online in the roster. Both windows are
    the game at https://turnipworks.net/ (promosite.py: answered locally). HONEST TIME: the player's arrival is never
    shown faster than a cold browser on this box really takes (measured in the same run, `join_real_s`): if the
    stepped clock gets there first, the player's frame loop is held (time and the loading screen's own animations go
    on) until that much time has passed since the link was opened."""
    import time as T
    pw, ph = rig.pane_size(); await R.split_backdrop(rig, ['GM', 'Player'])
    await idle_pane(rig, 1, P.get('idle', "Pat's browser · waiting for a link"))
    G = await rig.seat('gm', pw, ph, prod=True)
    await G.ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin='https://turnipworks.net')
    await rig.chrome(G, 'clutter', P.get('hide', ''))
    rooms = await inn_scene(rig, G)
    cm = rooms.get('common') or rooms['_all'][0]
    party = [('hero-fighter-human-m', -4), ('hero-wizard-elf-f', 0), ('hero-rogue-small-m', 4)]
    for fig, dx in party: await pawns(G, fig, cm['cx'] + dx, cm['cz'] + min(1, cm['d'] / 2 - 4))
    await settle(G)
    camG = P.get('camG', {'x': cm['cx'], 'z': cm['cz'] + 2, 'pitch': 52, 'yaw': -24, 'dist': 92})
    z = P.get('zoom')  # (the party must stay in the GM's pane, heads and all)
    if isinstance(z, dict) and 'keep' not in z: P = {**P, 'zoom': {**z, 'keep': [[cm['cx'] + dx, y, cm['cz'] + min(1, cm['d'] / 2 - 4)] for _, dx in party for y in (0, 6.5)]}}
    camG, _ = await framed(rig, G, P, camG, camG, P.get('frame_rect', room_rect(cm)), P.get('frame_top', 11.0)); await rig.cam(G, camG)
    # the honest reference: a cold browser opening an invite link to this table, on real time
    tok = await G.ev("async () => await tw.createSeat({ kind: 'human', role: 'player', name: 'Scout', color: '#8866cc' })")
    link0 = await G.ev("(t) => tw.inviteLink(t)", tok)
    t0 = T.time(); probe = await rig.seat('probe', pw, ph, url=link0, gm=False, prod=True)
    await probe.page.wait_for_function("window.twLoad && (twLoad.failed || (twLoad.times.frame && tw.ready && tw.ready()))", timeout=120000)
    await probe.page.wait_for_function("!document.getElementById('twl') || getComputedStyle(document.getElementById('twl')).display === 'none' || !document.getElementById('twl').isConnected || +getComputedStyle(document.getElementById('twl')).opacity < 0.05", timeout=30000)
    join_real = round(T.time() - t0, 2); times0 = await probe.ev("twLoad.times")
    rig.seats.remove(probe); await probe.ctx.close()
    await G.ev("(() => { const s = tw.sync.campaign.seats.find(s => s.name === 'Scout'); return s && tw.revokeSeat(s.id); })()"); await G.page.wait_for_function("tw.sync.pendingCount() === 0")
    await G.page.wait_for_timeout(500)
    # the player's window: a fresh browser (cold cache), opened on the clock when the GM has the link
    Pl = await rig.seat('player', pw, ph, gm=False, prod=True, go=False); Pl.blank = True
    await Pl.ctx.add_init_script("window.__promo && __promo.freeze();")  # its whole load runs on the stepped clock (the network stays real)
    await rig.chrome(Pl, 'clutter', P.get('hide', ''))
    await rig.pointer(G); await rig.move(G, pw * 0.62, ph * 0.62)
    await rig.freeze()
    await rig.secs(0.7)
    await bar(rig, G, 'invite Pat', cps=9)
    await G.page.wait_for_function("!document.getElementById('output').hidden"); link = await G.ev("document.querySelector('#output textarea').value")
    await rig.secs(0.5)
    cb = await G.ev("(() => { const r = document.querySelector('#output [data-copy]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()")
    await rig.glide(G, cb, 0.7); await rig.secs(0.15); await rig.click(G); await rig.secs(0.5)
    # the player opens it
    Pl.blank = False; opened_at = rig.n; rig.load_frames = 0
    await Pl.page.goto(link, wait_until='commit')
    arrived = None; held = 0; placed = False
    # v3 (Harry 2026-10-22: "appropriately dishonest for the medium of an advertisement to crunch the load screen down to
    # almost nothing"): with P.crunch the player is held only until `crunch` s after the link opened (not the measured
    # cold join); everything else is real. The measured cold join is still taken and recorded.
    target = P.get('crunch', join_real)
    async def pl_gate(i):
        nonlocal arrived, held, placed
        el = (rig.n - opened_at) / R.FPS
        try: ready = await Pl.ev("!!(window.tw && tw.ready && tw.ready())")
        except Exception: ready = False
        if ready and not placed and P.get('player_cam', True) and P.get('zoom'):  # (under its loading screen: the player's view framed as the GM's)
            await rig.cam(Pl, camG); placed = True
        Pl.hold = bool(ready and el < target)
        held += Pl.hold
        if ready and arrived is None and not Pl.hold: arrived = el
        try: rig.load_frames += await Pl.ev(LOADING_SHOWN)
        except Exception: rig.load_frames += 1  # (between documents: the page is blank, counted as load)
    # the GM's pointer drifts to Close while the player's browser loads
    clb = await G.ev("(() => { const r = document.querySelector('#output [data-close]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()")
    await rig.glide(G, clb, 0.8, during=pl_gate); await rig.secs(0.2, pl_gate); await rig.click(G)
    n = 0
    while arrived is None and n < 30 * R.FPS: await pl_gate(0); await rig.step(); n += 1
    if arrived is None: raise RuntimeError('the player never arrived')
    await rig.secs(0.6, pl_gate)
    n = 0
    while await Pl.ev(LOADING_SHOWN) and n < 3 * R.FPS: await pl_gate(0); await rig.step(); n += 1  # (its fade-out: counted to the end)
    # the player looks round the room: Pat's pointer over the inn, seen in the GM's window
    await rig.pointer(Pl); await rig.move(Pl, pw * 0.5, ph * 0.75)
    path = P.get('pl_path', [(0.42, 0.52), (0.58, 0.44), (0.66, 0.56)])
    await rig.glide(G, (pw * 0.9, ph * 0.2), 0.6)
    for (u, v) in path: await rig.glide(Pl, (pw * u, ph * v), 1.0, kind='inout')
    await rig.secs(P.get('tail', 1.2))
    seen = await G.ev("(() => tw.sync.campaign.seats.filter(s => s.online).map(s => s.name))()")
    # the loading screen's frames after the arrival (its fade-out): counted until it is gone
    return {'join_real_s': join_real, 'crunch_s': P.get('crunch'), 'cold_load_times_ms': times0, 'player_arrived_s_after_link': arrived, 'held_frames': held,
            'load_screen_frames_until_arrival': rig.load_frames, 'link': link, 'online_at_end': seen, 'ghost_pawns': await G.ev(GHOSTS)}

# ---------------------------------------------------------------------------------------------------------------------
PARTY = [('hero-fighter-human-m', -5, 0), ('hero-wizard-elf-f', 0, 1), ('hero-rogue-small-m', 5, 0), ('hero-cleric-dwarf-f', 0, -3)]

async def gm_interior(rig, P, party=PARTY, building=None, hide=''):
    """a GM's window over the inn's common room, the party in it, everything loaded and at rest"""
    S = await rig.seat('gm'); await rig.chrome(S, 'clutter', hide + P.get('hide', ''))
    rooms = await inn_scene(rig, S, building)
    cm = rooms.get('common') or rooms['_all'][0]
    ids = {}
    cl = lambda v, half: max(-(half - 4), min(half - 4, v))  # (inside the room, clear of its walls)
    for fig, dx, dz in party: ids[fig] = (await pawns(S, fig, cm['cx'] + cl(dx, cm['w'] / 2), cm['cz'] + cl(dz, cm['d'] / 2)))[0]
    await settle(S)
    cam = {'x': cm['cx'], 'z': cm['cz'], 'pitch': 52, 'yaw': -24, 'dist': 70, **P.get('cam', {})}
    await rig.cam(S, cam); await S.page.wait_for_timeout(600)
    return S, rooms, cm, ids, cam

def room_rect(cm): return [cm['x'], cm['z'], cm['x'] + cm['w'], cm['z'] + cm['d']]

def cam_drift(rig, S, cam, cam2, secs_total):
    """a slow camera drift from cam to cam2 over secs_total (eased), as an each(i) for rig.frames/glide"""
    n = max(1, round(secs_total * R.FPS)); k = [0]
    async def each(_=None):
        await rig.cam(S, R.lerp_cam(cam, cam2, R.ease(min(1, k[0] / n), 'smooth'))); k[0] += 1
    return each

def both(*fs):
    async def each(i):
        for f in fs:
            if f: await f(i)
    return each

async def dice(rig, P):
    """DICE: the GM types `roll d20 + 2d6` in the command bar; real dice (Rapier physics) tumble onto the table, the
    numbers tag each die, the result announces and settles into the chat."""
    S, rooms, cm, ids, cam = await gm_interior(rig, P)
    # warm: the physics module and the dice meshes load on the first roll (real time); then cleared
    await S.ev("tw.roll('d20 + 2d6')"); await S.page.wait_for_function("tw.dice.info().length > 0 && tw.dice.info().every(t => t.settled)", timeout=60000)
    await S.page.wait_for_timeout(1500); await S.ev("tw.dice.clear(); tw.announce?.dismiss?.()"); await S.page.wait_for_timeout(1500)
    cam2 = {**cam, **P.get('cam2', {'yaw': cam['yaw'] + 6, 'dist': cam['dist'] * 0.92})}
    cam, cam2 = await framed(rig, S, P, cam, cam2, room_rect(cm))
    drift = cam_drift(rig, S, cam, cam2, P.get('seconds', 8))
    await rig.pointer(S); await rig.move(S, *px(S, 1250, 760))
    await rig.freeze()
    await rig.frames(round(0.6 * R.FPS), drift)
    await rig.key(S, '/'); await rig.frames(12, drift)
    for ch in P.get('expr', 'roll d20 + 2d6'): await S.page.keyboard.type(ch); await rig.frames(6, drift)
    await rig.frames(15, drift); await rig.key(S, 'Enter'); await rig.step()
    rolled = None
    for _ in range(round(P.get('after', 6.0) * R.FPS)):
        await drift(); await rig.step()
        if rolled is None:
            rolled = await S.ev("(() => { const m = tw.view().chat.slice(-1)[0]; return m && m.roll ? { expr: m.roll.expr, total: m.roll.total, rolls: m.roll.rolls } : null; })()")
    return {'roll': rolled, 'dice': await S.ev("tw.dice.info().map(t => ({ id: t.id, settled: t.settled }))")}

async def quickbar(rig, P):
    """THE COMMAND BAR: `6 goblins`, Enter, the ghost rides the pointer with its squares lit, a click puts six goblins
    down; then `barrel`, a click, a barrel by the wall."""
    S, rooms, cm, ids, cam = await gm_interior(rig, P, party=P.get('party', PARTY[:2]))
    # warm: the goblin meshes and the bar's thumbnails (real time), then everything warmed is taken away again
    far = await pawns(S, 'foe-goblin-spear', cm['cx'] + 400, cm['cz'], count=6); await settle(S)
    await S.ev("(ids) => { tw.select(ids); tw.deleteSelection(); tw.clearSelection(); }", far)
    await S.ev("(() => { const i = document.querySelector('#bar textarea'); })()")
    for word in (P.get('words', '6 goblin spear'), 'barrel'):
        await S.page.keyboard.press('/'); await S.page.locator('#bar textarea').fill(word); await S.page.wait_for_timeout(1500)
        await S.page.wait_for_function("[...document.querySelectorAll('#results img')].every(i => i.complete)", timeout=20000)
        await S.page.keyboard.press('Escape'); await S.page.keyboard.press('Escape'); await S.page.wait_for_timeout(300)
    await S.page.wait_for_function("tw.sync.pendingCount() === 0"); await S.page.wait_for_timeout(800)
    cam2 = {**cam, **P.get('cam2', {'yaw': cam['yaw'] - 8})}
    # (Harry 2026-10-22, r3: six goblins in the common room looked "crowded and trashy": they go on the open ground
    # outside the inn, on the grass west of the common room; the frame takes in that strip of grass and the room)
    out = P.get('outside', True)
    gx, gz = (cm['x'] - P.get('gob_dx_out', 8.5), cm['cz'] - 1.5) if out else (cm['cx'] + P.get('gob_dx', 6), cm['cz'] - P.get('gob_dz', 4))
    if out:
        cam = {**cam, 'x': cm['cx'] - 6}; cam2 = {**cam2, 'x': cm['cx'] - 6}
        if isinstance(P.get('zoom'), dict): P = {**P, 'zoom': {**P['zoom'], 'keep': [[gx - 5, 1, gz - 5], [gx + 5, 1, gz + 5], [gx, 4, gz]]}}
    rect = [cm['x'] - 17, cm['z'], cm['x'] + cm['w'], cm['z'] + cm['d']] if out else room_rect(cm)
    if out and P.get('rug'): P['rug'].setdefault('fit', {}).setdefault('avoid', [[gx - 8, gz - 8, gx + 8, gz + 8]])
    cam, cam2 = await framed(rig, S, P, cam, cam2, rect)
    drift = cam_drift(rig, S, cam, cam2, P.get('seconds', 10))
    await rig.pointer(S); await rig.move(S, *px(S, 1300, 700))
    await rig.freeze()
    await rig.frames(round(0.5 * R.FPS), drift)
    await rig.key(S, '/'); await rig.frames(12, drift)
    for ch in P.get('words', '6 goblin spear'): await S.page.keyboard.type(ch); await rig.frames(6, drift)
    await rig.frames(24, drift); await rig.key(S, 'Enter'); await rig.step()
    tgt = await rig.screen(S, gx, gz)
    await rig.move(S, S.mouse[0] + 2, S.mouse[1] + 2); await rig.step()
    await rig.glide(S, tgt, 1.3, during=drift); await rig.frames(18, drift); await rig.click(S); await rig.frames(round(1.2 * R.FPS), drift)
    placed = await S.ev("(tw.lastPawns || []).length")
    await rig.key(S, 'Escape'); await rig.step()
    await rig.key(S, '/'); await rig.frames(12, drift)
    for ch in 'barrel': await S.page.keyboard.type(ch); await rig.frames(6, drift)
    await rig.frames(24, drift); await rig.key(S, 'Enter'); await rig.step()
    bx, bz = (cm['cx'] - P.get('barrel_dx', 7), cm['cz'] + P.get('barrel_dz', 4)) if P.get('zoom') else (cm['x'] + 3.5, cm['z'] + 3.5)  # (zoomed in, the room's corner may be off the frame)
    tgt = await rig.screen(S, bx, bz)
    await rig.move(S, S.mouse[0] + 2, S.mouse[1] + 2); await rig.step()
    await rig.glide(S, tgt, 1.1, during=drift); await rig.frames(14, drift); await rig.click(S); await rig.frames(round(0.4 * R.FPS), drift)
    await rig.key(S, 'Escape'); await rig.step()
    await rig.glide(S, px(S, 1500, 820), 0.8, during=drift); await rig.frames(round(P.get('tail', 1.0) * R.FPS), drift)
    objs = await S.ev("Object.values(tw.entities()).filter(e => e.kind === 'object' && /barrel/i.test(e.cat || e.sku || '')).length")
    gobs = await S.ev("(r) => Object.values(tw.entities()).filter(e => e.kind === 'token' && /goblin/.test(e.fig || '')).map(e => [Math.round(e.x * 10) / 10, Math.round(e.z * 10) / 10, !(e.x > r[0] && e.x < r[2] && e.z > r[1] && e.z < r[3])])", room_rect(cm))
    if out and not all(g[2] for g in gobs): rig.fails.append(f'a goblin landed inside the common room: {gobs}')
    return {'goblins_placed': placed, 'goblins': gobs, 'barrels_now': objs, 'outside': out}

async def fireball(rig, P):
    """FIREBALL: six goblins bunched in the common room, the wizard selected across it; `sphere 20` in the bar, the
    sphere rides the pointer from the wizard to the goblins: the caught goblins ring red, the label counts them; a click
    sets it down and the pointer rests on it."""
    # the goblins in the common room (25 x 20 ft: a 20 ft sphere fills it), the party outside its front door far enough
    # that the sphere on the goblins does not reach them (a pawn is caught when the nearest point of its base is inside)
    S, rooms, cm, ids, cam = await gm_interior(rig, P, party=[])
    gob = await pawns(S, 'foe-goblin-spear', cm['cx'] + 4, cm['cz'] - 1, count=P.get('goblins', 6))
    front = cm['z'] + cm['d']
    west = P.get('party_west')  # (30B v3: the party on the grass west of the room, so the caption rug has the ground before the door)
    wz, fz = ((cm['x'] - 6, cm['cz'] + 1), (cm['x'] - 8.5, cm['cz'] + 4.5)) if west else ((cm['x'] + 4.5, front + 9), (cm['x'] + 1, front + 10))
    ids = {'hero-wizard-elf-f': (await pawns(S, 'hero-wizard-elf-f', *wz))[0], 'hero-fighter-human-m': (await pawns(S, 'hero-fighter-human-m', *fz))[0]}
    await settle(S)
    wiz = ids['hero-wizard-elf-f']
    if west: cam = {**cam, 'x': cam['x'] - 5}
    cam2 = {**cam, **P.get('cam2', {'yaw': cam['yaw'] + 8, 'dist': cam['dist'] * 0.9})}
    cam, cam2 = await framed(rig, S, P, cam, cam2, [cm['x'] - 13, cm['z'], cm['x'] + cm['w'], cm['z'] + cm['d']] if west else room_rect(cm))
    drift = cam_drift(rig, S, cam, cam2, P.get('seconds', 9))
    await rig.pointer(S); await rig.move(S, *px(S, 1250, 820))
    await rig.freeze()
    await rig.frames(round(0.5 * R.FPS), drift)
    w = await S.ev("(id) => tw.entities()[id]", wiz)
    await rig.glide(S, await rig.screen(S, w['x'], w['z'], 1.2), 0.9, during=drift); await rig.frames(6, drift); await rig.click(S); await rig.frames(24, drift)
    await rig.key(S, '/'); await rig.frames(12, drift)
    for ch in 'sphere 20': await S.page.keyboard.type(ch); await rig.frames(6, drift)
    await rig.frames(24, drift); await rig.key(S, 'Enter'); await rig.step()
    gx, gz = await S.ev("(ids) => { const E = tw.entities(), g = ids.map(i => E[i]); return [g.reduce((a, e) => a + e.x, 0) / g.length, g.reduce((a, e) => a + e.z, 0) / g.length]; }", gob)
    gz -= P.get('aim_dz', 3.0)  # (a touch past the goblins' middle, away from the party at the door)
    E = await S.ev("tw.entities()"); party_d = min(((E[i]['x'] - gx) ** 2 + (E[i]['z'] - gz) ** 2) ** 0.5 for i in ids.values())
    rig.notes['party_from_aim_ft'] = round(party_d, 1)
    await rig.move(S, S.mouse[0] + 3, S.mouse[1] - 3); await rig.step()
    async def track(i): await drift()
    tgt = await rig.screen(S, gx, gz)
    await rig.glide(S, tgt, 1.8, kind='inout', during=track); await rig.frames(round(0.6 * R.FPS), drift)
    caught_live = await S.ev("(() => { const s = tw.rulers.state(); const it = s.items?.[0] || s.live || null; return it ? { caught: it.caught, label: document.querySelector('.rlab')?.textContent || null } : null; })()")
    await rig.click(S); await rig.frames(round(0.3 * R.FPS), drift)
    # the pointer stays on the template: the caught rings stay on (a kept template shows them only when hovered)
    for _ in range(round(P.get('tail', 2.4) * R.FPS)):
        await drift(); await rig.move(S, tgt[0], tgt[1]); await rig.step()
    st = await S.ev("(() => { const s = tw.rulers.state(); return { n: (s.items || []).length, caught: (s.items || []).map(i => i.caught), label: [...document.querySelectorAll('.rlab')].map(e => e.textContent) }; })()")
    caught = set((st.get('caught') or [[]])[0] or [])
    if caught != set(gob): rig.fails.append(f'the sphere caught {len(caught)} ({len(caught & set(gob))} goblins of {len(gob)}, {len(caught - set(gob))} others)')
    return {'goblins': len(gob), 'live': caught_live, 'end': st}

# ---------------------------------------------------------------------------------------------------------------------
async def box(S, sel):
    """the centre of the first element matching sel (page px), or None"""
    return await S.ev("(s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? [r.x + r.width / 2, r.y + r.height / 2] : null; }", sel)

async def ring(rig, P):
    """THE RING: a click on the fighter selects her and the closed ring sits at her head (Turn, Sheet, Damage, ☰); a
    click on ☰ slides the full ring out (the house ring's own animation); the pointer passes over two of its buttons
    (their names show); ☰ again folds it."""
    S, rooms, cm, ids, cam = await gm_interior(rig, P, party=PARTY)
    f = await S.ev("(id) => tw.entities()[id]", ids['hero-fighter-human-m'])
    cam = {**cam, 'x': f['x'], 'z': f['z'], 'dist': P.get('dist', 46), 'pitch': 50}; await rig.cam(S, cam); await S.page.wait_for_timeout(500)
    cam2 = {**cam, 'yaw': cam['yaw'] + 10, 'dist': cam['dist'] * 0.94}
    drift = cam_drift(rig, S, cam, cam2, P.get('seconds', 8))
    await rig.pointer(S); await rig.move(S, *px(S, 1300, 820))
    await rig.freeze()
    await rig.frames(round(0.5 * R.FPS), drift)
    await rig.glide(S, await rig.screen(S, f['x'], f['z'], 1.3), 0.9, during=drift); await rig.frames(6, drift); await rig.click(S); await rig.frames(round(0.9 * R.FPS), drift)
    closed = await S.ev("[...document.querySelectorAll('#ring .rbtn')].map(b => b.dataset.cmd || (b.dataset.menu !== undefined ? 'menu' : '?'))")
    m = await box(S, '#ring .rbtn[data-menu]')
    await rig.glide(S, m, 0.6, during=drift); await rig.frames(8, drift); await rig.click(S); await rig.frames(round(0.9 * R.FPS), drift)
    opened = await S.ev("[...document.querySelectorAll('#ring .rbtn')].map(b => { const r = b.getBoundingClientRect(); return [b.dataset.cmd || 'menu', Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; })")
    pick = [b for b in opened if b[0] not in ('menu',)][:: max(1, len(opened) // 3)][:2]
    for b in pick: await rig.glide(S, (b[1], b[2]), 0.55, during=drift); await rig.frames(round(0.55 * R.FPS), drift)
    m = await box(S, '#ring .rbtn[data-menu]')
    if m: await rig.glide(S, m, 0.5, during=drift); await rig.frames(6, drift); await rig.click(S); await rig.frames(round(0.8 * R.FPS), drift)
    await rig.frames(round(P.get('tail', 0.6) * R.FPS), drift)
    return {'closed_ring': closed, 'open_ring': [b[0] for b in opened], 'hovered': [b[0] for b in pick]}

async def turn(rig, P):
    """TURN ANYTHING: a table turned with the ring's Turn button (pressed and dragged round the ring: it turns live under
    the pointer); then the room's label clicked and the ring's Turn: the whole room, walls and furniture, turns 90°."""
    S = await rig.seat('gm'); await rig.chrome(S, 'clutter', P.get('hide', ''))
    await rig.cam(S, {'x': 17.5, 'z': 12.5, 'pitch': 55, 'yaw': -20, 'dist': 80})
    spec = {'kind': 'room', 'room': P.get('room', 'common'), 'seed': P.get('seed', 4101), 'label': 'Common room', 'rect': {'x': 0, 'z': 0, 'w': 7, 'd': 5}}
    await rig.drop(S, spec); await settle(S)
    room = (await S.ev(ROOMS))[0]
    thing = await S.ev("(() => { const o = Object.values(tw.entities()).filter(e => e.kind === 'object' && /table/i.test((e.cat || '') + (e.sku || ''))); o.sort((a, b) => (b.w || 0) * (b.d || 0) - (a.w || 0) * (a.d || 0)); return o[0] || null; })()")
    cam = {'x': room['cx'], 'z': room['cz'], 'pitch': 55, 'yaw': -20, 'dist': P.get('dist', 62)}; await rig.cam(S, cam); await S.page.wait_for_timeout(600)
    cam2 = {**cam, 'yaw': cam['yaw'] - 8}
    cam, cam2 = await framed(rig, S, P, cam, cam2, room_rect(room))
    drift = cam_drift(rig, S, cam, cam2, P.get('seconds', 10))
    await rig.pointer(S); await rig.move(S, *px(S, 1350, 840))
    await rig.freeze()
    await rig.frames(round(0.5 * R.FPS), drift)
    rot0 = thing and thing.get('rot', 0); moved = None
    if thing:
        # v2 r2 (Harry 2026-10-22: "would also love if in YD7 you moved the table as well as rotating it"): click the
        # table, press on it again (12 px off the click: the same spot would cycle the selection down to the rug under
        # it) and drag it to open floor, let go; then the ring's Turn dragged round; then the room
        top = (thing.get('dims') or [3, 2.6, 3])[1]
        pts = [[thing['x'] + dx, top, thing['z'] + dz] for dx, dz in ((0.9, 0.9), (-0.9, -0.9), (0.9, -0.9), (-0.9, 0.9), (0, 1.1), (1.1, 0), (0, 0))]
        g = await S.ev(GRAB, {'pts': pts, 'id': thing['id']})
        if not g: raise RuntimeError('no spot on the table a press reaches first')
        await rig.glide(S, (g[0], g[1]), 0.9, during=drift); await rig.frames(6, drift); await rig.click(S); await rig.frames(round(0.5 * R.FPS), drift)
        g2 = None
        for p in pts:
            c = await S.ev(GRAB, {'pts': [p], 'id': thing['id']})
            if c and ((c[0] - g[0]) ** 2 + (c[1] - g[1]) ** 2) ** 0.5 > 12: g2 = c; break
        if not g2: raise RuntimeError('no second spot on the table 12 px from the first')
        E = await S.ev("Object.values(tw.entities()).filter(e => e.kind === 'object' && (e.place === 'floor' || e.place === 'ground') && !/rug|carpet/.test(e.cat || '')).map(e => [e.id, e.x, e.z])")
        to = None
        for d in (6, 7, 5, 8):
            for a in range(0, 360, 30):
                import math as _m
                x, zz = thing['x'] + d * _m.cos(_m.radians(a)), thing['z'] + d * _m.sin(_m.radians(a))
                if not (room['x'] + 4 < x < room['x'] + room['w'] - 4 and room['z'] + 4 < zz < room['z'] + room['d'] - 4): continue
                if all(((x - ex) ** 2 + (zz - ez) ** 2) ** 0.5 > 3.6 for (i, ex, ez) in E if i != thing['id']): to = (x, zz); break
            if to: break
        if not to: raise RuntimeError('no open floor to move the table to')
        await rig.move(S, g2[0], g2[1]); await rig.step(); await S.page.mouse.down(); await rig.step()
        dst = await rig.screen(S, to[0] + (g2[2] - thing['x']), to[1] + (g2[4] - thing['z']), g2[3])
        await rig.glide(S, dst, P.get('drag_s', 1.0), kind='inout', during=drift); await rig.frames(4, drift); await S.page.mouse.up(); await rig.frames(round(0.4 * R.FPS), drift)
        moved = await S.ev("(id) => { const e = tw.entities()[id]; return [e.x, e.z]; }", thing['id'])
        if abs(moved[0] - thing['x']) + abs(moved[1] - thing['z']) < 2: rig.fails.append(f'the table did not move: {moved}')
        b = await box(S, '#ring .rbtn[data-cmd="edit.rotate"]')
        await rig.glide(S, b, 0.5, during=drift); await rig.frames(8, drift)
        await S.page.mouse.down(); await rig.step()
        rd = await S.ev("tw.ringDrag?.() || null"); c = (rd or {}).get('centre') or [b[0], b[1] + 60]
        import math
        rad = math.hypot(b[0] - c[0], b[1] - c[1]) or 80; a0 = math.atan2(b[0] - c[0], -(b[1] - c[1]))
        n = round(1.4 * R.FPS)
        for i in range(n):
            a = a0 + math.radians(P.get('deg', 90)) * R.ease((i + 1) / n)
            await drift(); await rig.move(S, c[0] + rad * math.sin(a), c[1] - rad * math.cos(a)); await rig.step()
        await rig.frames(8, drift); await S.page.mouse.up(); await rig.frames(round(0.6 * R.FPS), drift)
    rot1 = thing and (await S.ev("(id) => tw.entities()[id]?.rot ?? null", thing['id']))
    await rig.key(S, 'Escape'); await rig.frames(10, drift)
    lab = await box(S, f".rlabel[data-id='{room['id']}']")
    await rig.glide(S, lab, 0.9, during=drift); await rig.frames(6, drift); await rig.click(S); await rig.frames(round(0.6 * R.FPS), drift)
    rb = await box(S, '#ring .rbtn[data-cmd="room.rotate"]')
    if rb: await rig.glide(S, rb, 0.6, during=drift); await rig.frames(10, drift); await rig.click(S)
    else: await rig.key(S, 'r'); await rig.step()
    await rig.frames(round(P.get('tail', 1.8) * R.FPS), drift)
    after = (await S.ev(ROOMS))[0]
    if thing and abs((rot1 or 0) - (rot0 or 0)) < 0.3: rig.fails.append(f'the table did not turn: {rot0} -> {rot1}')
    return {'thing': thing and thing.get('sku') or (thing and thing.get('cat')), 'moved_to': moved, 'rot': [rot0, rot1], 'room_before': [room['w'], room['d']], 'room_after': [after['w'], after['d']], 'ring_room_turn': bool(rb)}

async def multiselect(rig, P):
    """SELECT A CROWD: four heroes on the grass before the inn's door; a box dragged round them selects all four (the
    halo on each); a press on one and a drag carries the four as one, keeping their places."""
    S = await rig.seat('gm'); await rig.chrome(S, 'clutter', P.get('hide', ''))
    rooms = await inn_scene(rig, S)
    gx, gz = 25, 35 + P.get('gap', 20)  # (on open grass, clear of the props by the inn's front)
    figs = ['hero-fighter-human-m', 'hero-wizard-elf-f', 'hero-rogue-small-m', 'hero-cleric-dwarf-f', 'hero-ranger-elf-m']
    ids = []
    for k, f in enumerate(figs[:P.get('n', 4)]): ids += await pawns(S, f, gx - 7.5 + 5 * k, gz + (2.5 if k % 2 else 0))
    await settle(S)
    cam = {'x': gx + 4, 'z': gz - 2, 'pitch': 54, 'yaw': -18, 'dist': P.get('dist', 64)}; await rig.cam(S, cam); await S.page.wait_for_timeout(600)
    cam2 = {**cam, 'yaw': cam['yaw'] + 8, 'x': cam['x'] + 3}
    cam, cam2 = await framed(rig, S, P, cam, cam2, [gx - 14, gz - 6, gx + 26, gz + 8], 6.0)
    drift = cam_drift(rig, S, cam, cam2, P.get('seconds', 8))
    await rig.pointer(S); await rig.move(S, *px(S, 1400, 860))
    await rig.freeze()
    await rig.frames(round(0.5 * R.FPS), drift)
    pts = []
    for i in ids:
        e = await S.ev("(id) => tw.entities()[id]", i)
        for y in (0, 6.5): pts.append(await rig.screen(S, e['x'], e['z'], y))
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; mg = P.get('box_margin', 80)
    # the box starts on truly empty grass below-left of the four (the inn is above them on screen) and ends above-right;
    # a start point is free when nothing is picked there or 6 px round it (as browser_ui.py's marquee test probes)
    FREE = "(s) => { const w = tw.worldOf(tw.area()); return [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]].every(([dx, dy]) => !w.pickAll(tw.rayAt(s[0] + dx, s[1] + dy)).length && document.elementFromPoint(s[0] + dx, s[1] + dy)?.id === 'c'); }"
    a = None  # (the box must hold each pawn's whole base ring: r3's 80 px below the lowest base missed one; 140 took them all)
    for k in range(0, 12):
        c = (min(xs) - 130 - 12 * k, max(ys) + 125 + 8 * k)
        if await S.ev(FREE, list(c)): a = c; break
    if a is None: rig.fails.append('no empty grass to start the box on'); a = (min(xs) - mg, max(ys) + mg * 0.6)
    b = (max(xs) + 130, min(ys) - 70)
    await rig.glide(S, a, 0.8, during=drift); await rig.frames(8, drift)
    await S.page.mouse.down(); await rig.step()
    await rig.glide(S, b, 1.1, during=drift); await rig.frames(6, drift); await S.page.mouse.up(); await rig.frames(round(0.8 * R.FPS), drift)
    sel = await S.ev("tw.sel.size"); sel_ids = await S.ev("[...tw.sel]")
    h = await S.ev("(id) => tw.entities()[id]", ids[1]); hp = await rig.screen(S, h['x'], h['z'], 1.2)
    await rig.glide(S, hp, 0.7, during=drift); await rig.frames(8, drift)
    await S.page.mouse.down(); await rig.step()
    d = await rig.screen(S, h['x'] + P.get('mx', 15), h['z'] - P.get('mz', 7), 1.2)
    await rig.glide(S, d, 1.4, during=drift); await rig.frames(8, drift); await S.page.mouse.up(); await rig.frames(round(P.get('tail', 1.4) * R.FPS), drift)
    moved = await S.ev("(ids) => ids.map(i => { const e = tw.entities()[i]; return [e.x, e.z]; })", ids)
    if sel != len(ids):
        rig.fails.append(f'the box selected {sel} things, want the {len(ids)} heroes')
        rig.notes['box'] = {'a': a, 'b': b, 'pts': pts, 'ids': ids, 'sel': sel_ids}
    return {'selected_after_box': sel, 'positions_after': moved}

async def floorup(rig, P):
    """EVERY FLOOR: the two-storey inn seen at its ground floor (the party in the common room); the pointer goes to the
    level meter on the left edge and clicks the notch above: the upper floor drops back in, room by room."""
    S = await rig.seat('gm'); await rig.chrome(S, 'clutter', P.get('hide', ''))
    rooms = await inn_scene(rig, S, {'storeys': 2, 'rect': {'x': 0, 'z': 0, 'w': 12, 'd': 8}})
    cm = rooms.get('common') or rooms['_all'][0]
    for fig, dx, dz in PARTY[:3]: await pawns(S, fig, cm['cx'] + dx, cm['cz'] + dz)
    await settle(S)
    await S.ev("tw.goLevel(0, 'promo')"); await S.page.wait_for_timeout(1500); await S.page.wait_for_function(QUIET_ALL)
    cam = {'x': 30, 'z': 20, 'pitch': 46, 'yaw': -30, 'dist': P.get('dist', 105), **P.get('cam', {})}; await rig.cam(S, cam); await S.page.wait_for_timeout(800)
    cam2 = {**cam, 'yaw': cam['yaw'] + 14, 'dist': cam['dist'] * 0.93}
    cam, cam2 = await framed(rig, S, P, cam, cam2, [0, 0, 60, 40], 21.0)
    drift = cam_drift(rig, S, cam, cam2, P.get('seconds', 8))
    await rig.pointer(S); await rig.move(S, *px(S, 520, 640))
    await rig.freeze()
    await rig.frames(round(0.8 * R.FPS), drift)
    up = await box(S, '#levelMeter .lm-n[data-y="10"]')
    await rig.glide(S, (up[0] + 2, up[1]), 1.0, during=drift); await rig.frames(12, drift); await rig.click(S)
    lv = []
    for _ in range(round(P.get('after', 4.5) * R.FPS)):
        await drift(); await rig.step()
    await rig.glide(S, px(S, 560, 700), 0.8, during=drift); await rig.frames(round(P.get('tail', 0.5) * R.FPS), drift)
    return {'cut_after': await S.ev("tw.cut?.y ?? null"), 'level': await S.ev("tw.level ?? null")}

# ---------------------------------------------------------------------------------------------------------------------
async def tiles(S, sel):
    return await S.ev("(s) => [...document.querySelectorAll(s)].filter(e => e.getBoundingClientRect().width > 0).map(e => { const r = e.getBoundingClientRect(); return { d: { ...e.dataset }, t: (e.innerText || '').split('\\n')[0], c: [r.x + r.width / 2, r.y + r.height / 2] }; })", sel)

async def buildmenu(rig, P):
    """THE BUILD MENU: the Build launcher, Fantasy, Tavern & inn; the building tool's rectangle dragged out on the
    grass; the whole inn spins in (both storeys at once, then the view walks down to the ground floor: the game's
    storey tour). The same drag is made once on real time first and undone (every mesh cached), then filmed."""
    S = await rig.seat('gm'); await rig.chrome(S, 'clutter', P.get('hide', ''))
    cam = {'x': 30, 'z': 20, 'pitch': 50, 'yaw': -26, 'dist': P.get('dist', 118), **P.get('cam', {})}
    await rig.cam(S, cam); await S.page.wait_for_timeout(1500)
    A, B = P.get('a', (1.5, 1.5)), P.get('b', (58.5, 38.5)); seed = P.get('seed', 7)
    cam, _ = await framed(rig, S, P, cam, cam, [0, 0, 60, 40], 21.0); await S.page.wait_for_timeout(900)
    async def pick_inn(film):
        go = (lambda c, s=0.7: rig.glide(S, c, s)) if film else (lambda c, s=0: S.page.mouse.move(*c))
        clk = (lambda: rig.click(S)) if film else (lambda: S.page.mouse.click(*S.mouse))
        async def to(c, s=0.7):
            if film: await rig.glide(S, c, s); await rig.frames(8)
            else: await rig.move(S, *c)
            await clk()
            if film: await rig.frames(round(0.45 * R.FPS))
            else: await S.page.wait_for_timeout(500)
        await to(await box(S, '.launcher[data-l=build]'), 0.9)
        st = await S.ev("tw.build.state()")
        if 't:Tavern & inn' not in (st.get('list') or []):
            g = [t for t in await tiles(S, '#buildMenu .btile') if t['d'].get('id') == 'g:fantasy']
            if g: await to(g[0]['c'])
        t = [t for t in await tiles(S, '#buildMenu .btile') if t['d'].get('id') == 't:TAV'][0]
        await to(t['c'])
        await S.ev(f"tw.mode && (tw.mode.seed = {seed})")
    async def drag(film):
        a = await rig.screen(S, *A); b = await rig.screen(S, *B)
        if film:
            await rig.glide(S, a, 0.9); await rig.frames(10); await S.page.mouse.down(); await rig.step()
            await rig.glide(S, b, P.get('drag_s', 1.6), kind='inout'); await rig.frames(10); await S.page.mouse.up(); await rig.step()
        else:
            await rig.move(S, *a); await S.page.mouse.down()
            for k in range(1, 13): await rig.move(S, a[0] + (b[0] - a[0]) * k / 12, a[1] + (b[1] - a[1]) * k / 12); await S.page.wait_for_timeout(30)
            await S.page.mouse.up()
    # 1. the warm-up: the same pick, the same drag, on real time; at rest; one undo takes it back
    await rig.move(S, *px(S, 900, 600)); await pick_inn(False); await drag(False)
    await S.page.wait_for_function("Object.values(tw.entities()).some(e => e.kind === 'room')", timeout=30000); await S.ev(NO_OFFERS); await settle(S); await S.ev(NO_OFFERS)
    await S.page.keyboard.press('Escape'); await S.page.keyboard.press('Escape'); await S.page.wait_for_timeout(300)
    await S.page.keyboard.press('Control+z'); await S.page.wait_for_function("!Object.values(tw.entities()).some(e => e.kind === 'room')", timeout=30000)
    await settle(S); await S.ev("tw.cutOff?.('api')"); await rig.cam(S, cam); await S.page.wait_for_timeout(1500)
    if await S.ev("tw.build.state().open"): await S.page.keyboard.press('Escape'); await S.page.wait_for_timeout(300)
    # 2. filmed
    await rig.pointer(S); await rig.move(S, *px(S, 1100, 700))
    await rig.freeze()
    await rig.frames(round(0.5 * R.FPS))
    await pick_inn(True)
    await drag(True)
    n_rooms = await S.ev("Object.values(tw.entities()).filter(e => e.kind === 'room').length")
    _, ready = await rig.hold_until(S, STARTED)
    if ready > 3: rig.fails.append(f'drop took {ready} s real to be ready (warm-up did not cache)')
    await rig.glide(S, px(S, 1700, 900), 1.0)
    total = round(P.get('after', 9.0) * R.FPS); land = None
    for i in range(total):
        await rig.step()
        if land is None and await S.ev(QUIET_ALL): land = i / R.FPS
    return {'rooms': n_rooms, 'ready_real_s': ready, 'quiet_s_after_drop': land, 'tour': await S.ev("tw.storeyTour ? { end: tw.storeyTour.end, levels: tw.storeyTour.levels } : null")}

async def pawnmenu(rig, P):
    """THE PAWNS MENU: the Pawns launcher; Monsters; Goblins; a goblin shaman's tile; a click on a square of the common
    room puts her down."""
    S, rooms, cm, ids, cam = await gm_interior(rig, P, party=PARTY[:2], hide='#chat{display:none!important}')
    fig = P.get('fig', 'foe-goblin-shaman')
    far = await pawns(S, fig, cm['cx'] + 400, cm['cz']); await settle(S)
    await S.ev("(ids) => { tw.select(ids); tw.deleteSelection(); tw.clearSelection(); }", far)
    # warm the tray's thumbnails, then back to its root and shut
    await S.page.click('.launcher[data-l=pawns]'); await S.page.wait_for_timeout(700)
    for node in ('monsters', 'monsters/goblins'):
        t = [t for t in await tiles(S, '#pawnsTray .btile') if t['d'].get('node') == node][0]; await S.page.mouse.click(*t['c']); await S.page.wait_for_timeout(900)
    await S.page.wait_for_function("[...document.querySelectorAll('#pawnsTray img')].every(i => i.complete)", timeout=30000)
    for _ in range(3): await S.page.keyboard.press('Backspace'); await S.page.wait_for_timeout(250)
    await S.page.keyboard.press('Escape'); await S.page.wait_for_timeout(300)
    if await S.ev("!!document.querySelector('#pawnsTray') && getComputedStyle(document.querySelector('#pawnsTray')).display !== 'none'"): await S.page.click('.launcher[data-l=pawns]'); await S.page.wait_for_timeout(400)
    cam = {**cam, 'x': cam['x'] - 9}; await rig.cam(S, cam); await S.page.wait_for_timeout(500)
    cam2 = {**cam, 'yaw': cam['yaw'] + 6}
    if P.get('zoom'):  # v3: framed with the room's middle right of centre (zoom.cx), so the tray down the left covers none of the drop
        z = P['zoom']; P = {**P, 'zoom': {**z, 'keep': [[cm['cx'] + 2.5, 1.5, cm['cz'] - 2.5], [cm['cx'] + 2.5, 6, cm['cz'] - 2.5]]}} if isinstance(z, dict) else P
        cam, cam2 = await framed(rig, S, P, cam, cam2, room_rect(cm))
    drift = cam_drift(rig, S, cam, cam2, P.get('seconds', 9))
    await rig.pointer(S); await rig.move(S, *px(S, 1100, 760))
    await rig.freeze()
    await rig.frames(round(0.5 * R.FPS), drift)
    async def to(c, s=0.75, after=0.5):
        await rig.glide(S, c, s, during=drift); await rig.frames(8, drift); await rig.click(S); await rig.frames(round(after * R.FPS), drift)
    await to(await box(S, '.launcher[data-l=pawns]'), 1.0)
    for node in ('monsters', 'monsters/goblins'):
        t = [t for t in await tiles(S, '#pawnsTray .btile') if t['d'].get('node') == node][0]; await to(t['c'])
    t = [t for t in await tiles(S, '#pawnsTray .btile') if t['d'].get('fig') == fig]
    if not t: raise RuntimeError(f'no tile for {fig}')
    await to(t[0]['c'], after=0.3)
    await rig.move(S, S.mouse[0] + 3, S.mouse[1]); await rig.step()
    tgt = await rig.screen(S, cm['cx'] + 2.5, cm['cz'] - 2.5)
    await rig.glide(S, tgt, 1.2, during=drift); await rig.frames(14, drift); await rig.click(S); await rig.frames(round(0.8 * R.FPS), drift)
    await rig.key(S, 'Escape'); await rig.frames(round(P.get('tail', 1.2) * R.FPS), drift)
    return {'placed': await S.ev("(f) => Object.values(tw.entities()).filter(e => e.kind === 'token' && e.fig === f).length", fig), 'mode': await S.ev("tw.mode?.kind || null")}

async def fog(rig, P):
    """THE LANTERN: darkness and fog of war in the PLAYER's own window (Mira, joined by her link before the shot): her
    scout stands in the common room's door with no darkvision, every light out; the room is black fog. She clicks her
    scout and types `carries light 30` in the command bar (its words include "lantern"): her lantern lights and the fog
    rolls back off the room (the game's fog bank, on the stepped clock; the sight worker's answers waited for each
    frame). (r2 tried the GM's "view as" Mira: a click there selects nothing, so nothing lit.)"""
    G = await rig.seat('gm'); S = G
    rooms = await inn_scene(rig, S, fog=True)
    cm = rooms.get('common') or rooms['_all'][0]
    await S.ev("tw.registry.run('area.darkness.on')"); await S.page.wait_for_function("tw.sync.pendingCount() === 0")
    info = await S.ev("async () => { const t = await tw.createSeat({ kind: 'human', role: 'player', name: 'Mira', color: '#67aadd' }); return { t, id: tw.sync.campaign.seats.find(s => s.name === 'Mira').id }; }")
    seat, tok = info['id'], info['t']
    door = P.get('pawn', (cm['x'] + 7.5, cm['cz'] + 2.5))  # (inside the room, clear of the wall nearest the camera: r3's scout stood behind it and a click hit the wall)
    await S.ev("(q) => tw.dispatch('token.create', { id: 'tok_promomira1', name: 'Mira', x: q.x, z: q.z, fig: 'hero-ranger-elf-f', owner: q.seat })", {'x': door[0], 'z': door[1], 'seat': seat})
    await S.page.wait_for_function("tw.sync.pendingCount() === 0"); await settle(S)
    await S.ev("tw.select(['tok_promomira1']); tw.registry.run('pawn.darkvision', { v: 0 }); tw.clearSelection();"); await S.page.wait_for_function("tw.sync.pendingCount() === 0")
    # the lights: every one out (Mira's own lantern, lit on camera, is the only light)
    lights = await S.ev("(r) => Object.values(tw.entities()).filter(e => e.kind === 'object' && ((e.lightRadius || 0) > 0 || e.lit !== undefined || /lantern|lamp|candle|torch|chandelier|brazier|fire/i.test((e.cat || '') + ' ' + (e.sku || '')))).map(e => ({ id: e.id, cat: e.cat, sku: e.sku, x: e.x, y: e.y || 0, z: e.z, lr: e.lightRadius ?? null, lit: e.lit ?? null, inRoom: e.x > r.x && e.x < r.x + r.w && e.z > r.z && e.z < r.z + r.d }))", cm)
    out = [l['id'] for l in lights]
    if out: await S.ev("(ids) => tw.batch(ids.map(id => ({ type: 'object.set', args: { id, lightRadius: 0 } })))", out)
    await S.page.wait_for_function("tw.sync.pendingCount() === 0")
    link = await G.ev("(t) => tw.inviteLink(t)", tok)
    S = await rig.seat('mira', url=link, gm=False); await rig.chrome(S, 'clutter', P.get('hide', '') + '#chat{display:none!important}'); S.fogwait = True
    await S.page.wait_for_function("window.twLoad && (twLoad.failed || (twLoad.times.frame && tw.ready && tw.ready()))", timeout=120000); await settle(S)
    if await S.ev("tw.me()") != seat:  # (her own seat: the pawn is hers)
        await G.ev("(q) => tw.dispatch('token.set', { id: 'tok_promomira1', owner: q })", await S.ev("tw.me()")); await G.page.wait_for_function("tw.sync.pendingCount() === 0")
    rig.seats.remove(S); rig.seats.insert(0, S)  # the film is Mira's window
    cam = {'x': cm['cx'], 'z': cm['cz'], 'pitch': 54, 'yaw': -22, 'dist': P.get('dist', 66), **P.get('cam', {})}; await rig.cam(S, cam)
    await S.page.wait_for_timeout(4000)  # the fog bank settles over what Mira cannot see
    cam2 = {**cam, 'yaw': cam['yaw'] + 8, 'dist': cam['dist'] * 0.92}
    cam, cam2 = await framed(rig, S, P, cam, cam2, P.get('frame_rect', room_rect(cm)), P.get('frame_top', 11.0))
    # (30B v3: the caption rug must lie where her lantern will light it: inside its reach round her scout)
    if 'fit' in P.get('rug', {}):
        rig.rug_within = {'x': door[0], 'z': door[1], 'r': P['rug']['fit'].get('reach', 22)}
        P['rug']['fit'].setdefault('avoid', []).append([door[0] - 4.5, door[1] - 4.5, door[0] + 4.5, door[1] + 4.5])  # (r1: she stood on the rug, over "of")
    drift = cam_drift(rig, S, cam, cam2, P.get('seconds', 10))
    # the GM lights Mira's lantern from his own window (unseen; real input there: a click on her scout, the command bar):
    # a click in Mira's window on the stepped clock selected nothing in r3, while the same click on real time did
    await rig.cam(G, cam); await G.page.wait_for_timeout(500); await rig.move(G, *px(G, 1250, 860))
    await rig.freeze()
    await rig.frames(round(1.0 * R.FPS), drift)
    mp = await rig.screen(G, door[0], door[1], 1.2)
    await rig.glide(G, mp, 1.1, during=drift); await rig.frames(8, drift); await rig.click(G); await rig.frames(round(0.5 * R.FPS), drift)
    sel = await G.ev("[...tw.sel]")
    if 'tok_promomira1' not in sel: raise RuntimeError(f'the click on her scout selected {sel}')
    await rig.key(G, '/'); await rig.frames(12, drift)
    for ch in P.get('words', 'carries light 30'): await G.page.keyboard.type(ch); await rig.frames(6, drift)
    await rig.frames(20, drift); await rig.key(G, 'Enter'); await rig.step()
    await rig.frames(round(1.0 * R.FPS), drift)
    await rig.frames(round(P.get('after', 5.5) * R.FPS), drift)
    carried = await S.ev("tw.entities()['tok_promomira1']?.lightCarried ?? null")
    if not carried: rig.fails.append('her lantern never lit (no carried light on her scout)')
    return {'lights_out': len(out), 'selected': sel, 'carried': carried, 'seat': seat}

# ---------------------------------------------------------------------------------------------------------------------
# a point on a thing that a press there would reach first (the thing itself, not what stands on it): probed on screen
GRAB = """(q) => { const w = tw.worldOf(tw.area()); const sel = (h) => h && tw.selectionFor ? tw.selectionFor(h) : (h?.entity?.id || null);
  for (const [x, y, z] of q.pts) { const p = tw.screenOf(x, z, tw.main, y); const hs = w.pickAll(tw.rayAt(p.x, p.y)); const id = hs.length ? (hs[0].entity?.id || null) : null; if (id === q.id) return [p.x, p.y, x, y, z]; }
  return null; }"""

async def handle(rig, P):
    """HANDLING THINGS + THE RING DOING SOMETHING (v3, uncaptioned; a natural adjustment after a build): in the inn's
    common room the GM clicks the square table (selected, its closed ring at it), presses on it again and drags it aside
    (it lifts and rides the pointer, what stands on it riding along), lets go (it sets down); the ring's Turn, clicked
    twice, turns it 45 degrees a click. Then the pointer goes to the fireplace (put out before the shot), a click, the
    ring's All options, Light: the fire takes. All real input through the game's own UI."""
    S, rooms, cm, ids, cam = await gm_interior(rig, P, party=P.get('party', [('hero-fighter-human-m', 4, 6), ('hero-wizard-elf-f', 7.5, 5)]))
    E = await S.ev("Object.values(tw.entities())")
    tab = next(e for e in E if e.get('kind') == 'object' and e.get('cat') == P.get('table', 'table-square') and cm['x'] < e['x'] < cm['x'] + cm['w'] and cm['z'] < e['z'] < cm['z'] + cm['d'])
    fire = next(e for e in E if e.get('kind') == 'object' and e.get('cat') == P.get('fire', 'fireplace-wall'))
    # the fireplace put out (the game's own Put out, off camera), so the beat can light it
    await S.ev("(id) => tw.select([id])", fire['id']); await S.page.wait_for_timeout(500)
    if await S.ev("(id) => tw.entities()[id].lit !== false", fire['id']): await S.ev("tw.registry.run('thing.light')")
    await S.page.wait_for_function("tw.sync.pendingCount() === 0"); await S.ev("tw.clearSelection()"); await S.page.wait_for_timeout(1500)
    to = P.get('to', (tab['x'] + 5.5, tab['z'] - 4.5))  # (aside: open floor between the table and the north wall)
    cam = {**cam, 'x': cm['cx'] + 2, 'z': cm['cz'], **P.get('cam', {})}
    cam2 = {**cam, **P.get('cam2', {'yaw': cam['yaw'] + 6, 'dist': cam['dist'] * 0.94})}
    keep = [[tab['x'], 2, tab['z']], [to[0], 2, to[1]], [fire['x'], 3, fire['z']], [to[0], 7, to[1]], [fire['x'], 8, fire['z']]]  # (the ring stands over the thing)
    z = P.get('zoom'); P2 = {**P, 'zoom': {**z, 'keep': keep}} if isinstance(z, dict) else P
    cam, cam2 = await framed(rig, S, P2, cam, cam2, P.get('frame_rect', [cm['x'] + 2, cm['z'] + 3, cm['x'] + cm['w'], cm['z'] + cm['d'] - 3]), P.get('frame_top', 9.0))
    drift = cam_drift(rig, S, cam, cam2, P.get('seconds', 9))
    await rig.pointer(S); await rig.move(S, *px(S, 1250, 860))
    await rig.freeze()
    await rig.frames(round(0.4 * R.FPS), drift)
    # 1. click the table
    pts = [[tab['x'] + dx, 1.95, tab['z'] + dz] for dx, dz in ((1.1, 1.1), (1.2, -1.1), (-1.1, 1.2), (-1.2, -1.2), (1.3, 0), (0, 1.3))]
    g = await S.ev(GRAB, {'pts': pts, 'id': tab['id']})
    if not g: raise RuntimeError('no spot on the table that a press reaches first')
    gx, gy, wx, wy, wz = g
    await rig.glide(S, (gx, gy), P.get('to_table_s', 0.75), during=drift); await rig.frames(5, drift); await rig.click(S); await rig.frames(round(0.35 * R.FPS), drift)
    sel1 = await S.ev("[...tw.sel]")
    # 2. press on it again and drag it aside; let go. (Not on the very spot of the click: a second press within 4 px of the
    # last click, on the same stack, cycles the selection down it (input.js: table -> the rug under it), and r1 dragged the rug)
    far = [p for p in pts if abs(p[0] - wx) + abs(p[2] - wz) > 1.5]
    g = None
    for p in far:
        c = await S.ev(GRAB, {'pts': [p], 'id': tab['id']})
        if c and ((c[0] - gx) ** 2 + (c[1] - gy) ** 2) ** 0.5 > 12: g = c; break
    if not g: raise RuntimeError('no second spot on the table, 12 px from the first, that a press reaches first')
    gx, gy, wx, wy, wz = g
    await rig.move(S, gx, gy); await rig.step()
    await S.page.mouse.down(); await rig.step()
    dst = await rig.screen(S, to[0] + (wx - tab['x']), to[1] + (wz - tab['z']), wy)
    await rig.glide(S, dst, P.get('drag_s', 0.9), kind='inout', during=drift); await rig.frames(4, drift)
    await S.page.mouse.up(); await rig.frames(round(0.3 * R.FPS), drift)
    t1 = await S.ev("(id) => { const e = tw.entities()[id]; return [e.x, e.z, e.rot || 0]; }", tab['id'])
    # 3. the ring's Turn, twice (45 degrees a click)
    b = await box(S, '#ring .rbtn[data-cmd="edit.rotate"]')
    if not b: raise RuntimeError('no Turn on the ring after the drag')
    await rig.glide(S, b, P.get('to_turn_s', 0.45), during=drift); await rig.frames(4, drift)
    for k in range(P.get('turns', 2)):
        await rig.click(S); await rig.frames(round(P.get('turn_gap_s', 0.4) * R.FPS), drift)
        b2 = await box(S, '#ring .rbtn[data-cmd="edit.rotate"]')
        if b2 and abs(b2[0] - S.mouse[0]) + abs(b2[1] - S.mouse[1]) > 3: await rig.move(S, *b2)  # (the ring follows its thing)
    t2 = await S.ev("(id) => { const e = tw.entities()[id]; return [e.x, e.z, e.rot || 0]; }", tab['id'])
    await rig.frames(round(P.get('hold_table_s', 0.5) * R.FPS), drift)
    mark = rig.n
    # 4. the fireplace: click, the ring's All options, Light
    fp = await S.ev(GRAB, {'pts': [[fire['x'] - 0.6, y, fire['z'] + dz] for y in (2.5, 1.5, 3.5) for dz in (0, 0.8, -0.8)], 'id': fire['id']})
    if not fp: raise RuntimeError('no spot on the fireplace that a press reaches first')
    await rig.glide(S, (fp[0], fp[1]), P.get('to_fire_s', 0.8), during=drift); await rig.frames(5, drift); await rig.click(S); await rig.frames(round(0.35 * R.FPS), drift)
    m = await box(S, '#ring .rbtn[data-menu]')
    await rig.glide(S, m, 0.45, during=drift); await rig.frames(4, drift); await rig.click(S); await rig.frames(round(0.45 * R.FPS), drift)
    lb = await box(S, '#ring .rbtn[data-cmd="thing.light"]')
    if not lb: raise RuntimeError('no Light in the ring for the fireplace')
    await rig.glide(S, lb, 0.45, during=drift); await rig.frames(6, drift); await rig.click(S)
    await rig.frames(round(P.get('after', 1.8) * R.FPS), drift)
    lit = await S.ev("(id) => tw.entities()[id].lit", fire['id'])
    if not (t1[0] != tab['x'] or t1[1] != tab['z']): rig.fails.append('the table did not move')
    if abs(t2[2] - t1[2]) < 0.5: rig.fails.append(f'the table did not turn: {t1} -> {t2}')
    if lit is False: rig.fails.append('the fireplace did not light')
    return {'table': tab['id'], 'selected_on_click': sel1, 'table_before': [tab['x'], tab['z'], tab.get('rot', 0)], 'after_drag': t1, 'after_turns': t2, 'fire': fire['id'], 'fire_lit': lit, 'fire_beat_from_s': round(mark / R.FPS, 3)}

async def fogwalk(rig, P):
    """FOG FOLLOWS THE PLAYER, split screen (v3, Harry 2026-10-22): the GM's window (left) sees the whole inn; the player
    Mira's window (right, joined by her link before the shot) has fog of war: she sees only the hallway she stands in.
    In HER window she presses on her own scout and drags it through the hallway's door into the common room and lets go:
    the fog rolls back off the common room; then drags it on, out through the front door onto the grass: the fog rolls
    back off the yard outside. The GM's window shows the same token moving live (the game's own drag presence) and
    landing. Real input in the player's window (a click and a drag there work on the stepped clock with fog of war on:
    probed 2026-10-22; v2's dead click was in darkness, by a wall). Lights as the house has them (no darkness)."""
    pw, ph = rig.pane_size(); await R.split_backdrop(rig, P.get('names', ['GM', 'Player: Mira']))
    G = await rig.seat('gm', pw, ph, prod=True); await rig.chrome(G, 'clutter', '#chat{display:none!important}' + P.get('hide', '')); G.fogwait = True
    rooms = await inn_scene(rig, G, fog=True)
    cm = rooms.get('common') or rooms['_all'][0]; hw = rooms.get('hallway')
    tok = await G.ev("async () => await tw.createSeat({ kind: 'human', role: 'player', name: 'Mira', color: '#67aadd' })")
    seat = await G.ev("tw.sync.campaign.seats.find(s => s.name === 'Mira').id")
    start = P.get('start', (hw['x'] + 7, hw['cz']))  # (in the hallway, a few steps from its door into the common room)
    path = P.get('path', [[(cm['x'] + cm['w'] + 0.5, 17.5), (cm['x'] + cm['w'] - 9, cm['z'] + 7)], [(cm['x'] + 9, cm['z'] + cm['d'] - 3.5), (cm['x'] + 7.5, cm['z'] + cm['d'] + 1.5), (cm['x'] + 8.5, cm['z'] + cm['d'] + 7)]])
    await G.ev("(q) => tw.dispatch('token.create', { id: 'tok_promomira1', name: 'Mira', x: q.x, z: q.z, fig: 'hero-ranger-elf-f', owner: q.seat })", {'x': start[0], 'z': start[1], 'seat': seat})
    await G.page.wait_for_function("tw.sync.pendingCount() === 0"); await settle(G)
    link = await G.ev("(t) => tw.inviteLink(t)", tok)
    Pl = await rig.seat('player', pw, ph, url=link, gm=False, prod=True); await rig.chrome(Pl, 'clutter', '#chat{display:none!important}' + P.get('hide', '')); Pl.fogwait = True
    await Pl.page.wait_for_function("window.twLoad && (twLoad.failed || (twLoad.times.frame && tw.ready && tw.ready()))", timeout=120000); await settle(Pl)
    if await Pl.ev("tw.me()") != seat:
        await G.ev("(q) => tw.dispatch('token.set', { id: 'tok_promomira1', owner: q })", await Pl.ev("tw.me()")); await G.page.wait_for_function("tw.sync.pendingCount() === 0")
    cam = {'x': 25, 'z': 28, 'pitch': 56, 'yaw': -20, 'dist': 90, **P.get('cam', {})}
    rect = P.get('frame_rect', [cm['x'], cm['z'], hw['x'] + hw['w'], cm['z'] + cm['d'] + 9])
    keep = [[start[0], 2, start[1]]] + [[x, 2, z] for seg in path for (x, z) in seg]
    if P.get('keep_ring'):  # v4: her base ring and the name printed on it kept in too (r ft round each stop; a short stacked window)
        r = P['keep_ring']; keep += [[x + dx, 0, z + dz] for (x, z) in [start] + [p for seg in path for p in seg] for dx, dz in ((0, r), (-r, 0), (r, 0))]
    z = P.get('zoom'); P2 = {**P, 'zoom': {**z, 'keep': keep}} if isinstance(z, dict) else P
    cam, _ = await framed(rig, G, P2, cam, cam, rect, P.get('frame_top', 9.0))
    await rig.cam(G, cam); await rig.cam(Pl, cam); await G.page.wait_for_timeout(4500)  # (the fog bank settles over what Mira cannot see)
    await rig.pointer(Pl); await rig.move(Pl, pw * 0.72, ph * 0.86)
    await rig.freeze()
    async def both_cam(_=None): await rig.cam(G, cam); await rig.cam(Pl, cam)
    await rig.frames(round(P.get('lead', 0.6) * R.FPS), both_cam)
    seen = []
    for k, seg in enumerate(path):
        e = await Pl.ev("tw.entities()['tok_promomira1']")
        p = await rig.screen(Pl, e['x'], e['z'], 1.2)
        await rig.glide(Pl, p, 0.55 if k == 0 else 0.4, during=both_cam); await rig.frames(4, both_cam)
        await Pl.page.mouse.down(); await rig.step()
        for j, (x, zz) in enumerate(seg):
            q = await rig.screen(Pl, x, zz, 1.2)
            await rig.glide(Pl, q, P.get('leg_s', 0.6) * (1.0 if j else 1.15), kind='inout' if len(seg) == 1 else ('in' if j == 0 else 'out' if j == len(seg) - 1 else 'linear'), during=both_cam)
        await rig.frames(4, both_cam); await Pl.page.mouse.up()
        await rig.frames(round(P.get('settle_s', [1.5, 2.2])[k] * R.FPS), both_cam)
        e = await G.ev("tw.entities()['tok_promomira1']"); seen.append([round(e['x'], 2), round(e['z'], 2)])
    end = await Pl.ev("tw.entities()['tok_promomira1']")
    want = path[-1][-1]
    if abs(end['x'] - want[0]) > 3 or abs(end['z'] - want[1]) > 3: rig.fails.append(f"the scout ended at {end['x']:.1f}, {end['z']:.1f}, want {want}")
    return {'start': start, 'path': path, 'gm_saw_after_each_drop': seen, 'player': await Pl.ev("tw.me()"), 'seat': seat}

# ---------------------------------------------------------------------------------------------------------------------
# CAPTION RUGS (30B): a beat's caption printed on a rug lying in the scene (rug.html; the welcome mat's mesh, capture.py
# MAT_ADD: a thin box lit by the house lights). Capture-only: the game knows nothing of it.
async def add_rug(rig, S, spec):
    """spec: {text, x, z (ft, its centre), d (depth ft), rot (rad; 0 = the words read from the south), y}"""
    import base64, shutil, cards
    stage = cards.stage(); shutil.copy(os.path.join(R.HERE, 'rug.html'), stage)
    pg = await rig.browser.new_page(viewport={'width': 2400, 'height': 600})
    import urllib.parse as U
    await pg.goto(f"file://{stage}/rug.html?" + U.urlencode({'t': spec['text']})); await pg.wait_for_load_state('load')
    if not await pg.evaluate(cards.FONT_OK): raise RuntimeError('the rug did not get Inter')
    need = await pg.evaluate("Math.ceil(document.querySelector('.in').scrollWidth + innerHeight * 0.30)")
    W = max(1200, min(6000, need)); await pg.set_viewport_size({'width': W, 'height': 600}); await pg.wait_for_timeout(100)
    over = await pg.evaluate("(() => { const i = document.querySelector('.in').getBoundingClientRect(), t = document.querySelector('.t').getBoundingClientRect(); return t.right > i.right || t.left < i.left; })()")
    if over: raise RuntimeError(f"the rug's words do not fit: {spec['text']}")
    png = await pg.screenshot(); await pg.close()
    open(os.path.join(rig.out, 'rug.png'), 'wb').write(png)
    d = spec.get('d', 6.0); w = d * W / 600
    m = {'url': 'data:image/png;base64,' + base64.b64encode(png).decode(), 'w': w, 'h': spec.get('thick', 0.25), 'd': d, 'x': spec.get('x', 0), 'z': spec.get('z', 0), 'y': spec.get('y', -0.012), 'rot': spec.get('rot', 0), 'tint': spec.get('tint', '#d4d4d4'), 'spin': False}
    end = getattr(rig, '_cam_end', None)
    if 'fit' in spec:  # v3: the BIGGEST rug that lies on clear ground inside the frame at the end of the move (RUG_AUTO)
        if end: await rig.cam(S, end)
        f = spec['fit']; q = {'A': W / 600, 'avoid': f.get('avoid', []), 'dmax': f.get('dmax', 14), 'dmin': f.get('dmin', 2.5), 'sy0': f.get('sy0', 0.55), 'sy1': f.get('sy1', 0.95),
                             'pad': f.get('pad', 0.6), 'within': getattr(rig, 'rug_within', None) or f.get('within'), 'mx': f.get('mx', 0.03), 'my': f.get('my', 0.975)}
        r = await S.ev(RUG_AUTO, q)
        if not r: raise RuntimeError(f"no clear ground in the frame for the rug ({spec['text']})")
        m.update({'x': r['x'], 'z': r['z'], 'rot': r['rot'], 'd': r['d'], 'w': r['w']}); d, w = r['d'], r['w']
    elif spec.get('auto'):  # placed from the camera at the END of the move: on the ground at the frame's bottom middle, outside every room, square to the frame
        if end: await rig.cam(S, end)
        m.update(await rug_spot(S, spec['auto'], w, d))
    r = await S.ev(R.C.MAT_ADD, m)
    if spec.get('auto') or 'fit' in spec:
        r['fit'] = await rug_fit(S, spec.get('auto') or spec['fit'])
        if end: await rig.cam(S, rig._cam_start)
    return {'rug_w_ft': round(w, 2), 'rug_d_ft': d, 'at': [m['x'], m['z'], m['rot']], 'tex': r}

# v3: the biggest rug (depth d from dmax down, width A x d) whose four corners and edge midpoints lie on ground outside
# every room (padded), inside the frame (mx of the width a side, above my of the height), and, with `within`, inside a
# circle (the lantern's light); its middle on the frame's vertical centre line, as high on the frame as it fits; square
# to the frame (its long axis along the screen's horizontal there)
RUG_AUTO = """(q) => { const W = innerWidth, H = innerHeight, V = tw.main.grab.focus.constructor, cam = tw.main.camera; tw.main.grab.update(); cam.updateMatrixWorld();
  const rooms = Object.values(tw.entities()).filter(e => e.kind === 'room').map(e => e.recipe).map(r => [r.x * 5, r.z * 5, (r.x + r.w) * 5, (r.z + r.d) * 5]).concat(q.avoid || []);
  const inside = (x, z) => rooms.some(r => x > r[0] - q.pad && x < r[2] + q.pad && z > r[1] - q.pad && z < r[3] + q.pad);
  const g = (sx, sy) => { const p = tw.groundAt(sx, sy, 0); return p ? (Array.isArray(p) ? { x: p[0], z: p[1] } : { x: p.x, z: p.z }) : null; };
  const scr = (x, z) => { const v = new V(x, 0.1, z).project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  for (let d = q.dmax; d >= q.dmin; d -= 0.25) { const w = q.A * d;
    for (let sy = q.sy0; sy <= q.sy1; sy += 0.01) {
      const c = g(W / 2, sy * H), a = g(W / 2 - 200, sy * H), b = g(W / 2 + 200, sy * H), n = g(W / 2, sy * H + 40); if (!c || !a || !b || !n) continue;
      let ux = b.x - a.x, uz = b.z - a.z; const ul = Math.hypot(ux, uz); ux /= ul; uz /= ul;
      let vx = n.x - c.x, vz = n.z - c.z; const dot = vx * ux + vz * uz; vx -= dot * ux; vz -= dot * uz; const vl = Math.hypot(vx, vz); vx /= vl; vz /= vl;
      const P = []; for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0], [0, 0]]) P.push([c.x + ux * i * w / 2 + vx * j * d / 2, c.z + uz * i * w / 2 + vz * j * d / 2]);
      if (P.some(([x, z]) => inside(x, z))) continue;
      if (q.within && P.some(([x, z]) => Math.hypot(x - q.within.x, z - q.within.z) > q.within.r)) continue;
      const S2 = P.map(([x, z]) => scr(x, z)); if (S2.some(([x, y]) => x < q.mx * W || x > (1 - q.mx) * W || y > q.my * H || y < 0)) continue;
      return { d: +d.toFixed(2), w: +w.toFixed(2), x: c.x, z: c.z, rot: Math.atan2(-(b.z - a.z), b.x - a.x), sy: +sy.toFixed(3), screen: S2.slice(0, 4).map(p => p.map(Math.round)) }; } }
  return null; }"""


RUG_SPOT = """(q) => { const W = innerWidth, H = innerHeight, rooms = Object.values(tw.entities()).filter(e => e.kind === 'room').map(e => e.recipe);
  const R5 = rooms.map(r => [r.x * 5, r.z * 5, (r.x + r.w) * 5, (r.z + r.d) * 5]).concat(q.avoid || []);
  const inside = (x, z, pad) => R5.some(r => x > r[0] - pad && x < r[2] + pad && z > r[1] - pad && z < r[3] + pad);
  const g = (sx, sy) => { const p = tw.groundAt(sx, sy, 0); return p ? (Array.isArray(p) ? { x: p[0], z: p[1] } : { x: p.x, z: p.z }) : null; };
  let sy = q.sy || 0.84, p = g(W / 2, sy * H);
  while (p && inside(p.x, p.z, q.d / 2 + 1) && sy < 0.97) { sy += 0.015; p = g(W / 2, sy * H); }
  // square to the frame: the rug's long axis along the screen's horizontal at that spot
  const a = g(W / 2 - 200, sy * H), b = g(W / 2 + 200, sy * H), rot = Math.atan2(-(b.z - a.z), b.x - a.x);
  return { x: p.x, z: p.z, rot, sy, clear: !inside(p.x, p.z, q.d / 2 + 1) }; }"""

async def rug_spot(S, auto, w, d):
    q = {'sy': auto.get('sy', 0.84) if isinstance(auto, dict) else 0.84, 'd': d, 'avoid': auto.get('avoid', []) if isinstance(auto, dict) else []}
    r = await S.ev(RUG_SPOT, q)
    if not r['clear']: raise RuntimeError(f'no clear ground for the rug at the bottom of the frame: {r}')
    return {'x': r['x'], 'z': r['z'], 'rot': r['rot']}

async def rug_fit(S, auto):
    e = await S.ev(R.C.MAT_EDGE)
    xs = [c[0] for c in e['corners']]; ys = [c[1] for c in e['corners']]
    return {'near_deg': e['near'], 'x': [min(xs), max(xs)], 'y': [min(ys), max(ys)]}

# ---------------------------------------------------------------------------------------------------------------------
# ZOOM DEPTH (Harry, 2026-10-22): a shot's framing as a fraction of the frame's WIDTH that its subject fills, the same
# meaning as capture.py's camera.frame (the welcome-mat rig): the subject's extent (a rect in ft, up to `top` ft) is made
# `frac` of the width (0.87 tight, 1.0 edge to edge, 1.2 spills off both sides), its middle at the frame's middle; pitch
# and yaw are kept, distance and focus solved in the page. A shot's params: "zoom": {"frac": 1.0} (+ "family", "zoom"
# names in the registry). The camera move keeps its shape: the end pose is solved at frac, the start at frac x the
# default move's own push (dist ratio), so a push-in stays a push-in.
FRAME_SOLVE = """(q) => { const g = tw.main.grab, cam = tw.main.camera, W = innerWidth, H = innerHeight, V = g.focus.constructor;
  g.focus.set(q.cam.x, q.cam.y || 0, q.cam.z); g.pitch = q.cam.pitch; g.yaw = q.cam.yaw; g.dist = q.cam.dist; tw.main.rule = 'free';
  const P = []; for (const [x, z] of [[q.r[0], q.r[1]], [q.r[2], q.r[1]], [q.r[2], q.r[3]], [q.r[0], q.r[3]]]) for (const y of [0, q.top]) P.push(new V(x, y, z));
  const box = () => { g.update(); cam.updateMatrixWorld(); const s = P.map(p => p.clone().project(cam)); const xs = s.map(v => (v.x + 1) * W / 2), ys = s.map(v => (1 - v.y) * H / 2);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };
  if (q.measure) { const b = box(); return { frac: +((b.x1 - b.x0) / W).toFixed(4) }; }
  for (let it = 0; it < 5; it++) {
    let lo = 3, hi = 3000; for (let k = 0; k < 40; k++) { g.dist = Math.sqrt(lo * hi); const b = box(); if (b.x1 - b.x0 > q.frac * W) lo = g.dist; else hi = g.dist; }
    // re-centre: a Newton step on the focus (x, z) with the screen-centre's Jacobian measured, not assumed
    const ctr = () => { const b = box(); return [(b.x0 + b.x1) / 2 - W / 2, (b.y0 + b.y1) / 2 - H / 2]; };
    const c0 = ctr(); g.focus.x += 1; const cx = ctr(); g.focus.x -= 1; g.focus.z += 1; const cz = ctr(); g.focus.z -= 1;
    const a = cx[0] - c0[0], b2 = cz[0] - c0[0], c = cx[1] - c0[1], d = cz[1] - c0[1], det = a * d - b2 * c;
    if (Math.abs(det) > 1e-9) { g.focus.x += (-c0[0] * d + c0[1] * b2) / det; g.focus.z += (-a * c0[1] + c * c0[0]) / det; }
  }
  const b = box(); return { x: +g.focus.x.toFixed(3), z: +g.focus.z.toFixed(3), dist: +g.dist.toFixed(3), frac: +((b.x1 - b.x0) / W).toFixed(4), cy: +(((b.y0 + b.y1) / 2) / H).toFixed(3) }; }"""

async def framed(rig, S, P, cam, cam2, rect, top=11.0):
    """-> (cam, cam2) zoomed to P['zoom'] (or unchanged); the default's own fill is measured into the notes either way.
    v3 (2026-10-22 late): solved by the welcome-mat rig's own camera.frame (capture.py FRAME_INSTALL / __promoSolve: dist
    bisected to the fraction, the focus moved on the ground until the extent's middle sits at the frame's middle, or at
    zoom.cx/cy), not by a parallel solver. zoom: a fraction, or {frac, start, fallback, keep, cx, cy}:
      keep      world points [x, y, z] the beat needs on screen (the action, its target, a ring); if any falls outside the
                safe box (SAFE: clear of the frame's edges and the game's top bar) at either end of the move, the shot is
                framed at `fallback` instead (spill -> edge), then at each of `fallbacks` in turn (v4). The choice is
                recorded in notes.zoom.chosen.
    (v2's FRAME_SOLVE, a Newton step on the focus with a measured Jacobian, made the v2 zoom variants; same meaning.)"""
    m = await S.ev(FRAME_SOLVE, {'cam': cam2, 'r': rect, 'top': top, 'measure': True})
    rig.notes['default_frac_end'] = m['frac']
    z = P.get('zoom')
    rig._cam_start, rig._cam_end = cam, cam2
    if not z:
        await rig.cam(S, cam); return cam, cam2
    z = z if isinstance(z, dict) else {'frac': float(z)}
    ratio = cam['dist'] / cam2['dist'] if cam2.get('dist') else 1
    corners = [[rect[0], rect[1]], [rect[2], rect[1]], [rect[2], rect[3]], [rect[0], rect[3]]]
    await S.ev(R.C.FRAME_INSTALL, {'rect': corners, 'top': top, 'mat': [], 'text': None})
    tries = [(z['frac'], z.get('start'))] + ([(z['fallback'], z.get('fallback_start'))] if z.get('fallback') else [])
    tries += [(f, None) for f in z.get('fallbacks', [])]  # v4: further fallbacks, tried in order (a stacked split's short window)
    log = []
    for f, start in tries:
        fs = start or f / ratio  # (a spill starts spilled: no empty sides at any frame)
        fr = {k: z[k] for k in ('cx', 'cy') if k in z}
        e = await S.ev(R.C.SETCAM, {**cam2, 'frame': {**fr, 'frac': f}})
        ke = await S.ev(KEEP_IN, {'pts': z.get('keep', []), 'safe': z.get('safe', SAFE)})
        s = await S.ev(R.C.SETCAM, {**cam, 'frame': {**fr, 'frac': fs}})
        ks = await S.ev(KEEP_IN, {'pts': z.get('keep', []), 'safe': z.get('safe', SAFE)})
        c1 = {**cam, 'x': s['focus'][0], 'z': s['focus'][1], 'dist': s['dist']}; c2 = {**cam2, 'x': e['focus'][0], 'z': e['focus'][1], 'dist': e['dist']}
        if P.get('zoom_fixed_focus'): c1['x'], c1['z'] = c2['x'], c2['z']  # (a storey tour ends if the focus pans: one focus for the whole shot)
        ok = ks['ok'] and ke['ok']
        log.append({'frac': f, 'start': fs, 'end_pose': e, 'start_pose': s, 'keep_start': ks, 'keep_end': ke, 'ok': ok})
        if ok: break
    rig.notes['zoom'] = {'frac': z['frac'], 'chosen': f, 'solver': 'camera.frame', 'tries': log}
    if not ok and len(tries) > 1: rig.fails.append(f'zoom: the keep-in points leave the frame even at {f}')
    rig._cam_start, rig._cam_end = c1, c2
    await rig.cam(S, c1); await S.page.wait_for_timeout(600)
    return c1, c2

# the safe box for a beat's action (fractions of the pane): clear of the edges and of the game's top bar
SAFE = [0.05, 0.12, 0.95, 0.9]
KEEP_IN = """(q) => { const V = tw.main.grab.focus.constructor, cam = tw.main.camera, W = innerWidth, H = innerHeight; tw.main.grab.update(); cam.updateMatrixWorld();
  const out = []; for (const p of q.pts) { const v = new V(p[0], p[1], p[2]).project(cam), x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
    if (!(x >= q.safe[0] * W && x <= q.safe[2] * W && y >= q.safe[1] * H && y <= q.safe[3] * H)) out.push([p, Math.round(x), Math.round(y)]); }
  return { ok: !out.length, out }; }"""

# ---------------------------------------------------------------------------------------------------------------------
async def oner(rig, P):
    """W1 THE ONER: one camera flight, no cuts, all at 1x. The inn spins in under a slow push; as it settles the camera
    flies east to where a smithy is dropping in and watches it build; then flies back down into the inn's common room,
    where goblins have gathered (placed while the camera was away: pawns arrive instantly in the game); `sphere 20` in the
    bar, the sphere rides the pointer onto them, the caught ring red, a click sets it."""
    S = await rig.seat('gm'); await rig.chrome(S, 'clutter', P.get('hide', '') + '#chat{display:none!important}')
    await S.ev("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })"); await S.page.wait_for_function("tw.sync.pendingCount() === 0")
    A = {**INN1}
    B = {'kind': 'building', 'code': P.get('b_code', 'SMI'), 'seed': P.get('b_seed', 11), 'storeys': 1, 'front': 'S', 'label': 'The Forge', 'rect': {'x': 20, 'z': 1, 'w': 8, 'd': 6}}
    camA = {'x': 25, 'z': 17, 'pitch': 46, 'yaw': -30, 'dist': 100}; camA2 = {**camA, 'dist': 82, 'yaw': -26}
    camB = {'x': 120, 'z': 20, 'pitch': 44, 'yaw': -18, 'dist': 80}; camB2 = {**camB, 'yaw': -10, 'dist': 76}
    await rig.warm(S, B, camB); await rig.warm(S, A, camA)
    far = await pawns(S, 'foe-goblin-spear', 400, 20, count=6); await settle(S)
    await S.ev("(ids) => { tw.select(ids); tw.deleteSelection(); tw.clearSelection(); }", far); await S.page.wait_for_timeout(800)
    await rig.cam(S, camA)
    await rig.freeze()
    path = []  # (frames, from, to, ease)
    async def fly(c0, c1, secs, kind='inout', during=None):
        n = round(secs * R.FPS)
        for i in range(n):
            await rig.cam(S, R.lerp_cam(c0, c1, R.ease((i + 1) / n, kind)))
            if during: await during(i)
            await rig.step()
    await fly(camA, camA, 0.4)
    await rig.drop(S, A); await rig.hold_until(S, STARTED)
    await fly(camA, camA2, 4.6, 'smooth')
    await rig.drop(S, B); await rig.hold_until(S, STARTED)
    await fly(camA2, camB, 3.6, 'inout')
    await fly(camB, camB2, 2.6, 'smooth')
    # while the camera is on the smithy: the goblins come into the inn's common room
    rooms = {r['type']: r for r in await S.ev(ROOMS)}; cm = rooms.get('common') or list(rooms.values())[0]
    gob = await S.ev("(q) => tw.addPawns('foe-goblin-spear', q.x, q.z, { count: 6, select: false })", {'x': cm['cx'] + 5, 'z': cm['cz'] - 2})
    camC = {'x': cm['cx'] + 2, 'z': cm['cz'], 'pitch': 54, 'yaw': -24, 'dist': 64}
    await fly(camB2, camC, 3.8, 'inout')
    await rig.pointer(S); await rig.move(S, *px(S, 1250, 820))
    hold = lambda s: fly(camC, camC, s)
    await hold(0.5)
    await rig.key(S, '/'); await hold(0.2)
    for ch in 'sphere 20': await S.page.keyboard.type(ch); await hold(0.1)
    await hold(0.4); await rig.key(S, 'Enter'); await hold(0.02)
    gx, gz = await S.ev("(ids) => { const E = tw.entities(), g = ids.map(i => E[i]); return [g.reduce((a, e) => a + e.x, 0) / g.length, g.reduce((a, e) => a + e.z, 0) / g.length]; }", gob)
    await rig.move(S, S.mouse[0] + 3, S.mouse[1] - 3); await hold(0.02)
    tgt = await rig.screen(S, gx, gz); x0, y0 = S.mouse; n = round(1.8 * R.FPS)
    for i in range(n):
        u = R.ease((i + 1) / n); await rig.move(S, x0 + (tgt[0] - x0) * u, y0 + (tgt[1] - y0) * u); await rig.cam(S, camC); await rig.step()
    await hold(0.6); await rig.click(S)
    for _ in range(round(P.get('tail', 2.5) * R.FPS)): await rig.move(S, *tgt); await rig.cam(S, camC); await rig.step()
    st = await S.ev("(() => { const s = tw.rulers.state(); return { caught: (s.items || []).map(i => i.caught), label: [...document.querySelectorAll('.rlab')].map(e => e.textContent) }; })()")
    return {'goblins': len(gob), 'rulers': st, 'seconds': rig.n / R.FPS}

# ---------------------------------------------------------------------------------------------------------------------
async def twoviews(rig, P):
    """W5 TWO VIEWS, ONE TABLE (split screen): the GM's window (left) sees the whole dark inn; the player's window
    (right, Mira, joined by her link before the shot) sees only what her scout can: black fog. The GM lights the
    lantern (click, O); in Mira's window the fog rolls back off the room. Both are the game at https://turnipworks.net/
    (local); the fog worker is waited for in both."""
    pw, ph = rig.pane_size(); await R.split_backdrop(rig, ['GM', 'Player: Mira'])
    G = await rig.seat('gm', pw, ph, prod=True); await rig.chrome(G, 'clutter', '#chat{display:none!important}'); G.fogwait = True
    rooms = await inn_scene(rig, G, fog=True)
    cm = rooms.get('common') or rooms['_all'][0]
    await G.ev("tw.registry.run('area.darkness.on')"); await G.page.wait_for_function("tw.sync.pendingCount() === 0")
    tok = await G.ev("async () => await tw.createSeat({ kind: 'human', role: 'player', name: 'Mira', color: '#67aadd' })")
    seat = await G.ev("tw.sync.campaign.seats.find(s => s.name === 'Mira').id")
    door = (cm['x'] + 7.5, cm['cz'] + 2.5)  # (clear of the wall nearest the camera)
    await G.ev("(q) => tw.dispatch('token.create', { id: 'tok_promomira1', name: 'Mira', x: q.x, z: q.z, fig: 'hero-ranger-elf-f', owner: q.seat })", {'x': door[0], 'z': door[1], 'seat': seat})
    await G.page.wait_for_function("tw.sync.pendingCount() === 0"); await settle(G)
    await G.ev("tw.select(['tok_promomira1']); tw.registry.run('pawn.darkvision', { v: 0 }); tw.clearSelection();"); await G.page.wait_for_function("tw.sync.pendingCount() === 0")
    lights = await G.ev("(r) => Object.values(tw.entities()).filter(e => e.kind === 'object' && ((e.lightRadius || 0) > 0 || e.lit !== undefined || /lantern|lamp|candle|torch|chandelier|brazier|fire/i.test((e.cat || '') + ' ' + (e.sku || '')))).map(e => ({ id: e.id, cat: e.cat, sku: e.sku, x: e.x, y: e.y || 0, z: e.z, inRoom: e.x > r.x && e.x < r.x + r.w && e.z > r.z && e.z < r.z + r.d }))", cm)
    out = [l['id'] for l in lights]
    if out: await G.ev("(ids) => tw.batch(ids.map(id => ({ type: 'object.set', args: { id, lightRadius: 0 } })))", out)
    await G.page.wait_for_function("tw.sync.pendingCount() === 0")
    link = await G.ev("(t) => tw.inviteLink(t)", tok)
    Pl = await rig.seat('player', pw, ph, url=link, gm=False, prod=True); await rig.chrome(Pl, 'clutter', '#chat{display:none!important}'); Pl.fogwait = True
    await Pl.page.wait_for_function("window.twLoad && (twLoad.failed || (twLoad.times.frame && tw.ready && tw.ready()))", timeout=120000); await settle(Pl)
    cam = {'x': cm['cx'], 'z': cm['cz'], 'pitch': 54, 'yaw': -22, 'dist': P.get('dist', 74)}
    if P.get('zoom'):  # v3: both panes framed alike (solved in the GM's: the same viewport, so the same picture)
        z = P['zoom']; P = {**P, 'zoom': {**z, 'keep': [[door[0], 2, door[1]], [door[0], 7, door[1]]]}} if isinstance(z, dict) else P
        cam, _ = await framed(rig, G, P, cam, cam, room_rect(cm))
    await rig.cam(G, cam); await rig.cam(Pl, cam); await G.page.wait_for_timeout(4500)
    await rig.pointer(G); await rig.move(G, pw * 0.7, ph * 0.8)
    await rig.freeze()
    async def both_cam(_=None): await rig.cam(G, cam); await rig.cam(Pl, cam)
    await rig.frames(round(1.0 * R.FPS), both_cam)
    mp = await rig.screen(G, door[0], door[1], 1.2)
    await rig.glide(G, mp, 1.1, during=both_cam); await rig.frames(8, both_cam); await rig.click(G); await rig.frames(round(0.5 * R.FPS), both_cam)
    await rig.key(G, '/'); await rig.frames(12, both_cam)
    for ch in 'carries light 30': await G.page.keyboard.type(ch); await rig.frames(6, both_cam)
    await rig.frames(20, both_cam); await rig.key(G, 'Enter'); await rig.step()
    await rig.glide(G, (mp[0] + 160, mp[1] + 160), 1.0, during=both_cam)
    await rig.frames(round(P.get('after', 5.5) * R.FPS), both_cam)
    return {'lights_out': len(out), 'carried': await G.ev("tw.entities()['tok_promomira1']?.lightCarried ?? null"), 'player': await Pl.ev("tw.me()")}

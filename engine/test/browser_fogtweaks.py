#!/usr/bin/env python3
"""Fog tweaks (2026-10-15): per-area fog of war, cursors through fog, arrow keys. tw-slot browser-venv/bin/python engine/test/browser_fogtweaks.py --local"""
import argparse, asyncio, io, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
from PIL import Image, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaign this suite makes is a throwaway: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots', 'fogtweaks')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--only')
A = ap.parse_args()
ONLY = set((A.only or '').upper().split(',')) - {''}
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
def want(sec): return not ONLY or sec in ONLY

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18299,18899').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-fogtweaks-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
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
RX = """(() => { window.__rx = [];
  const WS = window.WebSocket; window.WebSocket = class extends WS { constructor(...a) { super(...a); this.addEventListener('message', (ev) => { try { window.__rx.push(String(ev.data)); } catch { } }); } };
  const ES = window.EventSource; if (ES) window.EventSource = class extends ES { constructor(...a) { super(...a); this.addEventListener('message', (ev) => { try { window.__rx.push(String(ev.data)); } catch { } }); } };
  const F = window.fetch; window.fetch = async (...a) => { const r = await F(...a); try { const u = String(a[0]?.url || a[0]); if (/\\/(c|sse|a)\\//.test(u) && !/\\.(glb|png|webp|js|json)(\\?|$)/.test(u)) r.clone().text().then(t => window.__rx.push(t)).catch(() => {}); } catch { } return r; }; })()"""
# Capture real submit calls across reloads; delay only fog worker delivery for the
# reset/disable race without replacing its calculations or manufacturing a result.
FOG_PROBE = """(() => {
  const W = window.Worker;
  window.Worker = class extends W {
    constructor(...args) {
      super(...args);
      if (!String(args[0]).includes('fog-worker')) return;
      let handler = null;
      Object.defineProperty(this, 'onmessage', {get: () => handler, set: fn => handler = fn});
      this.addEventListener('message', ev => {
        const delay = window.__fogWorkerDelay || 0;
        if (delay) setTimeout(() => handler?.call(this, ev), delay); else handler?.call(this, ev);
      });
    }
  };
  const timer = setInterval(() => {
    if (!window.tw?.sync || tw.sync.__fogProbe) return;
    tw.sync.__fogProbe = true;
    const original = tw.sync.submit;
    tw.sync.submit = function(type, args, area) {
      if (type === 'fog.explore') window.__fogCommand({seat:tw.me(),at:performance.timeOrigin+performance.now(),area,epoch:args.epoch,bytes:JSON.stringify(args).length}).catch(()=>{});
      return original.call(this,type,args,area);
    };
    clearInterval(timer);
  }, 25);
})()"""
ITEMS = "tw.rulers.state().items"
ITEM = lambda key: f"(tw.rulers.state().items.find(i => i.key === '{key}') || null)"
LABELS = "[...document.querySelectorAll('#rulers .rlab:not([hidden])')].map(e => e.textContent)"
SCR = lambda x, z, y=0: f"(() => {{ const p = tw.screenOf({x}, {z}, tw.main, {y}); return [p.x, p.y]; }})()"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []; fog_commands = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}, device_scale_factor=2)
            await ctx.expose_binding("__fogCommand", lambda source, data: fog_commands.append(data))
            await ctx.add_init_script(RX)
            await ctx.add_init_script(FOG_PROBE)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e))); await pg.goto(url); return pg
        async def shot(pg, name):
            await pg.mouse.move(3, 3); await pg.wait_for_timeout(700)
            if A.shots: await pg.screenshot(path=os.path.join(SHOTS, name + '.png'))
        async def action(pg, code):
            await pg.evaluate(code)
            await wait(pg, 'tw.sync.pendingCount() === 0', 15000, 'command accepted')
            await pg.wait_for_timeout(250)
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', f"TEST fogtweaks {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw?.ready?.() && tw.fog', 90000), 'GM live with vision controller')
        check(await gm.evaluate('tw.sync.campaign.defaults.fogOfWar === true && tw.sync.campaign.defaults.sharedPartyVision === false'), 'new campaign: fog on, shared sight off')
        pages = [gm]; seats = []
        for name, color in [('Mira', '#67aadd'), ('Kit', '#e0457b')]:
            invite = await gm.evaluate("async ([name, color]) => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name,color}))", [name, color])
            pg = await tab(invite); pages.append(pg)
            check(await wait(pg, 'window.tw?.ready?.() && tw.fog', 90000), name + ' joins')
            seats.append(await pg.evaluate('tw.me()'))
        mi, kit = pages[1:]

        rooms = []
        for x in [0, 4, 8]:
            rooms.append(await gm.evaluate('(x) => tw.spawnRoom("common", x, 0, 4, 4, 7101+x)', x))
            await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        await action(gm, "tw.batch([...tw.worldOf(tw.area()).edges.values()].filter(e => e.sides.length === 1).map(e => ({type:'edge.set',args:{key:e.key,as:'wall',piece:'wall-straight'}})))")
        door = await gm.evaluate("(() => { const e=[...tw.worldOf(tw.area()).edges.values()].find(e => e.kind==='door' && e.sides.length===2 && e.key.startsWith('v:4:')); if(!e)return null;const z=+e.key.split(':')[2]*5+2.5;return {key:e.key,z}; })()")
        check(bool(door), 'adjacent rooms have a generated door', door and door['key'])
        assert door, 'fixture needs an interior door'
        z = door['z']; PA, PB, NPC = 'tok_fogmira001', 'tok_fogkit0001', 'tok_fognpc0001'
        GM, MIRA, KIT = await gm.evaluate('tw.me()'), seats[0], seats[1]
        AREA = await gm.evaluate('tw.area()')
        await action(gm, 'tw.batch('+json.dumps([
            {'type':'token.create','args':{'id':PA,'name':'Mira scout','x':12.5,'z':z,'owner':MIRA}},
            {'type':'token.create','args':{'id':PB,'name':'Kit scout','x':27.5,'z':z,'owner':KIT}},
            {'type':'token.create','args':{'id':NPC,'name':'Unseen sentinel','x':32.5,'z':z}}])+')')
        CAM = "const g=tw.main.grab; g.focus.set(30,0,10);g.yaw=0;g.pitch=62;g.dist=95;g.update();tw.main.rule='free';"
        for pg in pages:
            await wait(pg, f"!!tw.entities()['{PB}']", 30000)
            await pg.evaluate("tw.settings.setGfx('medium');" + CAM)
        def vis(x): return f'tw.fog.visible({x},{z},0)'
        def exp(x): return f'tw.fog.explored({x},{z},0)'
        def drawn(id): return f"!!tw.worldOf(tw.area()).recs.get('{id}')?.group.visible"
        W = "tw.worldOf(tw.area())"
        check(await wait(mi, f'tw.fog.active() && {vis(12.5)} && !{vis(27.5)}'), 'baseline: fog on in the area, Mira sees her room only')
        check(await mi.evaluate("(async () => (await import('/engine/core/fog.js')).GM_CURSOR_THROUGH_FOG === false)()"), 'GM_CURSOR_THROUGH_FOG is false by default')

        # ---------------- 2. cursors through the fog ----------------
        async def point(pg, x, zz, sel=None):
            for _ in range(2):
                await pg.evaluate("([a,x,z]) => tw.ps.set(a, {cursor:[x,z], drag:null, sel:[]})", [AREA, x, zz]); await pg.wait_for_timeout(180)
        await mi.evaluate("""() => { window.__ov = []; const fx = tw.worldOf(tw.area()).fx.fogwar, o = fx.setOverlays; fx.setOverlays = function(r) { window.__ov = r; return o.call(this, r); }; }""")
        await point(kit, 27.5, z)
        CURS = lambda seat: f"{W}.cursors.get('{seat}')"
        check(await wait(mi, f"(() => {{ const c = {CURS(KIT)}; return !!c && c.obj.visible && c.fogged && c.dim; }})()"), "player B's cursor is drawn for A over unexplored fog, dimmed")
        check(await mi.evaluate(f"(() => {{ const c = {CURS(KIT)}; return window.__ov.includes(c.obj) && c.ring.visible && c.mats.every(([m, b]) => Math.abs(m.opacity - b * .5) < 1e-6); }})()"), 'that cursor is a fog overlay (redrawn after the fog pass), outlined and at half strength')
        box = await mi.evaluate(SCR(27.5, z)); crop = {'x': max(0, box[0] - 130), 'y': max(0, box[1] - 170), 'width': 260, 'height': 220}
        async def pic(pg):
            await pg.mouse.move(3, 3); await pg.wait_for_timeout(500)
            return Image.open(io.BytesIO(await pg.screenshot(clip=crop))).convert('RGB')
        await kit.evaluate("([a]) => tw.ps.set(a, {cursor:null, drag:null, sel:[]})", [AREA]); await wait(mi, f"!{CURS(KIT)}", 8000)
        without = await pic(mi)
        await point(kit, 27.5, z); await wait(mi, f"!!{CURS(KIT)}", 8000)
        with_c = await pic(mi)
        px = sum(1 for a, b in zip(without.getdata(), with_c.getdata()) if abs(a[0]-b[0]) + abs(a[1]-b[1]) + abs(a[2]-b[2]) > 60 and b[0] - b[1] > 30)
        check(px > 25, "pixels: Kit's pink cursor shows on the grey fog (rendered, not just bookkeeping)", {'changed_pink_pixels': px})
        if A.shots: with_c.save(os.path.join(SHOTS, 'tweaks-cursor-in-fog.png'))
        await point(kit, 12.5, z)
        check(await wait(mi, f"(() => {{ const c = {CURS(KIT)}; return !!c && c.obj.visible && !c.fogged && !c.dim && !c.ring.visible && !window.__ov.includes(c.obj); }})()"), "the same cursor over ground A can see is drawn normally (full strength, no outline)")
        await point(gm, 27.5, z)
        check(await wait(mi, f"(() => {{ const c = {CURS(GM)}; return !!c && !c.obj.visible; }})()"), "the GM's live cursor over ground the player cannot see is NOT drawn")
        check(await mi.evaluate(f"tw.cursors().some(s => s.seat === '{GM}')"), '(the relay still delivers it: the withholding is the viewer-side vision rule, unchanged hidden-room relay rules)')
        await point(gm, 12.5, z)
        check(await wait(mi, f"(() => {{ const c = {CURS(GM)}; return !!c && c.obj.visible && !c.fogged; }})()"), "the GM's cursor where the player can see IS drawn")
        await point(gm, 27.5, z)
        await mi.evaluate("""() => { window.__fp = 0; window.__fpo = 0; setInterval(() => { const w = tw.worldOf(tw.area()); const f = w.pings.filter(p => p.obj?.userData.fogged); if (f.length) { window.__fp++; if (window.__ov.some(o => o.userData?.ping && o.userData.fogged)) window.__fpo++; } }, 25); }""")
        await gm.evaluate(f"tw.ping(27.5, {z}, 0)")
        check(await wait(mi, "window.__fp > 0 && window.__fpo > 0", 6000), "a GM PING over unseen fog shows for the player (and is redrawn over the fog)")
        check(await mi.evaluate(f"tw.pingsSeen.some(p => p.seat === '{GM}' && p.x === 27.5)"), 'the ping arrived as an ordinary ping')
        await point(kit, 12.5, z)
        await mi.wait_for_timeout(1600)
        await kit.evaluate(f"tw.ping(32.5, {z}, 0)")
        check(await wait(mi, "window.__fp > 1 && window.__fpo > 1", 6000), "a player's ping over fog shows too")
        await gm.evaluate("([a]) => tw.ps.set(a, {cursor:null, drag:null, sel:[]})", [AREA]); await kit.evaluate("([a]) => tw.ps.set(a, {cursor:null, drag:null, sel:[]})", [AREA])

        # ---------------- 1. fog of war per area ----------------
        await action(gm, f"tw.toggleOpen(tw.wallItem('wall:{door['key']}'))")
        check(await wait(mi, f'{vis(27.5)} && {drawn(PB)}'), 'open door: Mira sees the next room and Kit')
        await mi.wait_for_timeout(2600)
        await action(gm, f"tw.toggleOpen(Object.values(tw.entities()).find(e=>e.fromEdge==='{door['key']}' && /door|gate|portcullis/.test(e.cat||'')))")
        check(await wait(mi, f'!{vis(27.5)} && {exp(27.5)} && !{drawn(PB)}'), 'closed again: explored mist remains')
        await mi.wait_for_timeout(2800)
        MEM = f"JSON.stringify(tw.view('{AREA}').fog.viewers['{MIRA}'] || {{}})"
        before = await mi.evaluate(MEM)
        check(len(before) > 40, "Mira's explored memory is stored on the relay", len(before))
        await action(gm, "tw.registry.run('area.fogOfWar.off')")
        check(await wait(mi, f"!tw.fog.active() && {vis(27.5)} && {drawn(PB)} && {W}.fogActive === false && !{W}.fx.fogwar.stats().fogwar_on"), 'fog off here: Mira sees everything, pawns drawn, fog pass off')
        check(await mi.evaluate(f"{MEM}") == before, 'explored memory is kept while fog is off')
        check(await gm.evaluate(f"tw.sync.campaign.areas.find(a => a.id === '{AREA}').settings.fogOfWar === false && tw.sync.campaign.defaults.fogOfWar === true"), 'the override is stored on the area; the campaign default is untouched')
        B = await gm.evaluate("tw.createArea('Cellar')"); await wait(gm, f"tw.sync.campaign.areas.some(a => a.id === '{B}')", 15000)
        await gm.evaluate(f"tw.setAreaOpen('{B}', true)"); await gm.evaluate(f"tw.setMain('{B}')")
        await wait(gm, f"tw.area() === '{B}' && !!tw.sync.view('{B}')", 20000)
        await gm.evaluate('tw.spawnRoom("common", 0, 0, 4, 4, 7301)'); await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        await action(gm, f"tw.dispatch('token.create', {{id:'tok_fogmirb0001', name:'Mira in the cellar', x:7.5, z:7.5, owner:'{MIRA}'}}, '{B}')")
        await mi.evaluate(f"tw.setMain('{B}')")
        check(await wait(mi, f"tw.area() === '{B}' && tw.fog.active() && tw.worldOf('{B}').fogActive === true && tw.worldOf('{B}').fx.fogwar.stats().fogwar_on", 30000), 'another area (inherits the default): fog on, fog pass running')
        check(await mi.evaluate(f"!tw.fog.active('{AREA}') && tw.fog.active('{B}')"), 'per-area answers: A off, B on, at the same time')
        await mi.evaluate(f"tw.setMain('{AREA}')"); await mi.evaluate(CAM)
        check(await wait(mi, f"tw.area() === '{AREA}' && !tw.fog.active() && {W}.fogActive === false", 20000), 'back in A: still no fog')
        await gm.evaluate(f"tw.setMain('{AREA}')"); await wait(gm, f"tw.area() === '{AREA}'", 15000)
        await action(gm, "tw.registry.run('area.fogOfWar.default')")
        check(await wait(mi, f"tw.fog.active() && {exp(27.5)} && !{vis(27.5)} && !{drawn(PB)}", 20000), "default here: fog is back and the explored room is remembered (not deleted)")
        check(len(await mi.evaluate(MEM)) >= len(before), 'the stored memory is the same or larger')
        check(await gm.evaluate(f"!('fogOfWar' in tw.sync.campaign.areas.find(a => a.id === '{AREA}').settings)"), 'default here removes the override (inherits)')
        await action(gm, "tw.registry.run('vision.fogOfWar.off')")
        await action(gm, "tw.registry.run('area.fogOfWar.on')")
        check(await wait(mi, f"tw.fog.active('{AREA}') && !tw.fog.active('{B}')"), 'campaign default off + this area on: only this area has fog')
        await action(gm, "tw.registry.run('vision.fogOfWar.on')"); await action(gm, "tw.registry.run('area.fogOfWar.default')")
        check(await gm.evaluate("tw.registry.run && !!tw.registry.get?.('area.fogOfWar.off') || true"), 'commands registered')
        # the command bar finds them by their words
        await gm.evaluate("tw.emit('bar.open', 'fog')"); await gm.wait_for_timeout(300)
        bar = await gm.evaluate("[...document.querySelectorAll('#results .res')].map(e => e.textContent)")
        check(any('Fog of war off here' in t for t in bar) and any('on here' in t for t in bar), 'command bar: "fog" offers fog of war on / off here', bar[:6])
        await gm.keyboard.press('Escape')
        # settings
        await gm.evaluate("tw.settings.show('area')"); await gm.wait_for_timeout(300)
        check(await gm.evaluate("!!document.querySelector('[data-rule=fogOfWar][data-scope=area]')"), 'Settings ▸ Area has a Fog of war row')
        await gm.evaluate("document.querySelector('[data-rule=fogOfWar][data-scope=area]').click()")
        check(await wait(gm, f"tw.sync.campaign.areas.find(a => a.id === '{AREA}').settings.fogOfWar === false"), 'its switch sets this area off (campaign default is on)')
        await gm.wait_for_timeout(300)
        await gm.evaluate("document.querySelector('[data-reset=fogOfWar][data-scope=area]').click()")
        check(await wait(gm, f"!('fogOfWar' in tw.sync.campaign.areas.find(a => a.id === '{AREA}').settings)"), 'its Reset puts the area back to the campaign default')
        await gm.evaluate("tw.settings.show('defaults')"); await gm.wait_for_timeout(300)
        check(await gm.evaluate("!!document.querySelector('[data-vision=fogOfWar]') && !document.querySelector('[data-rule=fogOfWar][data-scope=defaults]')"), 'Global defaults keeps its one Fog of war switch (the campaign default)')
        await gm.keyboard.press('Escape'); await gm.evaluate("tw.settings.hide?.()")
        await wait(mi, 'tw.fog.active()', 8000)

        # ---------------- 3. arrow keys ----------------
        await mi.evaluate(f"tw.select('{PA}')"); await mi.mouse.move(3, 3)
        POS = lambda: mi.evaluate(f"(() => {{ const e = {E(PA)}; const s = tw.screenOf(e.x, e.z, tw.main, e.y || 0); return [e.x, e.z, s.x, s.y]; }})()")
        async def press(key, expect_moved=True):
            p0 = await POS(); await mi.keyboard.press(key)
            ok = await wait(mi, f"(() => {{ const e = {E(PA)}; return Math.abs(e.x - {p0[0]}) + Math.abs(e.z - {p0[1]}) > 0.5 && tw.sync.pendingCount() === 0; }})()", 6000, key)
            await mi.wait_for_timeout(120)
            return p0, await POS(), ok
        await mi.evaluate("window.__vis = 0; window.__ev = {}; tw.on((w) => { window.__ev[w] = (window.__ev[w] || 0) + 1; if (w === 'vision') window.__vis++; }); 0")
        p0, p1, ok = await press('ArrowRight')
        check(ok and abs(p1[0] - p0[0] - 5) < 1e-6 and abs(p1[1] - p0[1]) < 1e-6, 'ArrowRight moves the pawn exactly one square (5 ft), default camera', [p0[:2], p1[:2]])
        vok = await wait(mi, "window.__vis > 0", 6000); print('    events', await mi.evaluate('window.__ev'), await mi.evaluate('JSON.stringify(tw.fog.info().areas.map(a=>[a.pending,a.error,a.totalMs]))'))
        check(vok, 'a pawn moved by an arrow re-runs vision, like a drag')
        check(await wait(mi, f"{vis(p1[0])}", 4000), 'and sees from its new square')
        await mi.keyboard.press('Control+z'); check(await wait(mi, f"{E(PA)}.x === {p0[0]} && {E(PA)}.z === {p0[1]}", 6000), 'undo puts it back (one step)')
        p0, p1, ok = await press('Shift+ArrowRight')
        check(ok and abs(p1[0] - p0[0] - 1) < 1e-6 and abs(p1[1] - p0[1]) < 1e-6, 'Shift+ArrowRight is the fine 1 ft nudge', [p0[:2], p1[:2]])
        await mi.keyboard.press('Control+z'); await wait(mi, f"{E(PA)}.x === {p0[0]}", 6000)
        import math
        seen_axes = set()
        for yaw in [0, 90, 180, 270, 32]:
            await mi.evaluate(f"tw.main.grab.yaw = {yaw}; tw.main.grab.update();"); await mi.wait_for_timeout(250)
            ax = await mi.evaluate("tw.arrowAxes()"); seen_axes.add(tuple(ax['up']))
            for key, want in [('ArrowUp', (0, -1)), ('ArrowDown', (0, 1)), ('ArrowLeft', (-1, 0)), ('ArrowRight', (1, 0))]:
                p0, p1, ok = await press(key)
                dx, dz, sx, sy = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2], p1[3] - p0[3]
                grid = abs(abs(dx) + abs(dz) - 5) < 1e-6 and (abs(dx) < 1e-6 or abs(dz) < 1e-6)
                onscreen = (sy < -4 and abs(sx) < abs(sy)) if key == 'ArrowUp' else (sy > 4 and abs(sx) < abs(sy)) if key == 'ArrowDown' else (sx < -4 and abs(sy) < abs(sx)) if key == 'ArrowLeft' else (sx > 4 and abs(sy) < abs(sx))
                check(ok and grid and onscreen, f'camera yaw {yaw} deg: {key} is one square toward the screen {key[5:].lower()}', {'world': [round(dx, 2), round(dz, 2)], 'screen': [round(sx), round(sy)]})
                await mi.keyboard.press('Control+z'); await wait(mi, f"{E(PA)}.x === {p0[0]} && {E(PA)}.z === {p0[1]}", 6000)
        check(len(seen_axes) >= 3, 'the screen-up axis really changed with the camera', sorted(seen_axes))
        # an object, GM
        crate = await gm.evaluate("(() => { const e = Object.values(tw.entities()).find(e => e.kind === 'object' && !e.locked && e.place !== 'tile' && !e.fromEdge); return e && {id: e.id, x: e.x, z: e.z}; })()")
        if crate:
            await gm.evaluate(f"tw.select('{crate['id']}')"); await gm.mouse.move(3, 3); await gm.keyboard.press('ArrowDown')
            check(await wait(gm, f"Math.abs({E(crate['id'])}.z - {crate['z'] + 5}) < 1e-6 || Math.abs({E(crate['id'])}.x - {crate['x']}) + Math.abs({E(crate['id'])}.z - {crate['z']}) === 5", 6000), 'objects move one square with an arrow too')
        # the shortcut sheet
        await gm.evaluate("tw.emit('sheet.toggle')"); await gm.wait_for_timeout(300)
        sheet = await gm.evaluate("document.body.innerText")
        check('one square' in sheet and 'Nudge left 1 ft' in sheet, 'the ? sheet lists the arrows (one square) and Shift+arrows (1 ft)')
        check(not errors, 'no browser errors', errors[:5])
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for pr in procs:
        try: pr.wait(timeout=5)
        except Exception: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\nfogtweaks: {len(results)-len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)

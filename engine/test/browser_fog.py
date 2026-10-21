#!/usr/bin/env python3
"""Three-seat vision fog integration: tw-slot browser-venv/bin/python engine/test/browser_fog.py --local --shots."""
import argparse, asyncio, io, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
from PIL import Image, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaign this suite makes is a throwaway: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots', 'fog')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--only')
A = ap.parse_args()
ONLY = set((A.only or '').upper().split(',')) - {''}
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
def want(sec): return not ONLY or sec in ONLY

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18297,18897').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-fog-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
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
        await gm.fill('#newCampaign input[name=name]', f"TEST fog {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw?.ready?.() && tw.fog', 90000), 'GM live with vision controller')
        check(await gm.evaluate('tw.sync.campaign.defaults.fogOfWar === true && tw.sync.campaign.defaults.sharedPartyVision === false'), 'new campaign: fog on, shared sight off')
        pages = [gm]; seats = []
        for name in ['Mira', 'Kit']:
            invite = await gm.evaluate("async name => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name,color:'#67aadd'}))", name)
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
        await action(gm, 'tw.batch('+json.dumps([
            {'type':'token.create','args':{'id':PA,'name':'Mira scout','x':12.5,'z':z,'owner':seats[0]}},
            {'type':'token.create','args':{'id':PB,'name':'Kit scout','x':27.5,'z':z,'owner':seats[1]}},
            {'type':'token.create','args':{'id':NPC,'name':'Unseen sentinel','x':32.5,'z':z}}
        ])+')')
        for pg in pages:
            await wait(pg, f"!!tw.entities()['{PB}']", 30000)
            await pg.evaluate("tw.settings.setGfx('medium'); const g=tw.main.grab; g.focus.set(30,0,10);g.yaw=0;g.pitch=62;g.dist=95;g.update();tw.main.rule='free';")
        def vis(x): return f'tw.fog.visible({x},{z},0)'
        def exp(x): return f'tw.fog.explored({x},{z},0)'
        def drawn(id): return f"!!tw.worldOf(tw.area()).recs.get('{id}')?.group.visible"
        check(await wait(mi, f'{vis(12.5)} && !{vis(27.5)}'), 'closed door: own room clear, next room unseen')
        check(await mi.evaluate(f"!!tw.entities()['{PB}'] && !tw.canSeePawn(tw.entities()['{PB}']) && !{drawn(PB)}"), 'other player data arrives but pawn is not drawn outside vision')
        check(await kit.evaluate(f'{vis(27.5)} && !{vis(12.5)}'), 'second player has independent sight')
        check(await mi.evaluate("""() => {
          const area=tw.area(), old=tw.thumbs.meta[area];
          try { tw.thumbs.meta[area]={at:12345}; return tw.thumbs.url(area) === null; }
          finally { if(old === undefined) delete tw.thumbs.meta[area]; else tw.thumbs.meta[area]=old; }
        }"""), 'fog viewer cannot use a shared GM area thumbnail even when metadata exists')
        check(await mi.evaluate("""async ([own,hidden]) => {
          const w=tw.worldOf(tw.area()), fx=w.fx.fogwar, original=fx.setOverlays;
          let roots=[];
          fx.setOverlays=function(r) { roots=r; return original.call(this,r); };
          try {
            await new Promise(resolve=>setTimeout(resolve,150));
            return !!w.recs.get(own)?.label && roots.includes(w.recs.get(own).label) && !roots.includes(w.recs.get(hidden)?.label);
          } finally { fx.setOverlays=original; }
        }""", [PA,PB]), 'visible pawn label is a fog overlay while an unseen pawn label is excluded')
        await mi.evaluate("tw.emit('bar.open','Unseen sentinel')")
        await mi.wait_for_timeout(250)
        check(not await mi.locator('#results .res:not(.intent)').filter(has_text='Unseen sentinel').count(), 'command bar does not reveal the unseen pawn by name')
        await mi.keyboard.press('Escape')
        await action(gm, "tw.dispatch('turn.start',{})")
        check(await mi.evaluate(f"tw.turnRows().some(r=>r.ids.includes('{PA}')) && !tw.turnRows().some(r=>r.ids.includes('{PB}')||r.ids.includes('{NPC}'))"), 'turn order does not name unseen pawns')
        await action(gm, "tw.dispatch('turn.end',{})")
        # Pixels, not scene bookkeeping: a disabled fog pass must not blank the GM's composer output.
        gm_picture = Image.open(io.BytesIO(await gm.locator('#c').screenshot())).convert('RGB')
        w, h = gm_picture.size
        table = gm_picture.crop((int(w*.2), int(h*.2), int(w*.85), int(h*.85)))
        colored = sum(max(p)-min(p) > 30 and max(p) > 50 for p in table.getdata())
        check(colored > 1000 and max(ImageStat.Stat(table).stddev) > 15, 'GM canvas contains the rendered colored rooms, not a blank compositor output', {'colored_pixels':colored})
        await shot(mi, '01-unseen'); await shot(gm, '00-gm')
        await action(gm, f"tw.toggleOpen(tw.wallItem('wall:{door['key']}'))")
        check(await wait(mi, f'{vis(27.5)} && {drawn(PB)}'), 'open door reveals room and other player pawn')
        await shot(mi, '02-visible')
        await mi.wait_for_timeout(2600)
        await action(gm, f"tw.toggleOpen(Object.values(tw.entities()).find(e=>e.fromEdge==='{door['key']}' && /door|gate|portcullis/.test(e.cat||'')))")
        check(await wait(mi, f'!{vis(27.5)} && {exp(27.5)} && !{drawn(PB)}'), 'closed again: explored mist remains, pawn disappears')
        await shot(mi, '03-explored')
        await mi.wait_for_timeout(2500); await mi.reload(); await wait(mi, 'window.tw?.ready?.() && tw.fog', 90000)
        await mi.evaluate("const g=tw.main.grab;g.focus.set(30,0,10);g.yaw=0;g.pitch=62;g.dist=95;g.update();tw.main.rule='free';")
        check(await wait(mi, f'{exp(27.5)} && !{vis(27.5)}'), 'explored memory survives reconnect')
        check(await mi.evaluate("Object.keys(tw.view().fog.viewers).every(id=>id===tw.me()) && !Object.keys(tw.view().fog.party).length"), 'reconnect carries only own explored memory while shared vision is off')
        await action(gm, f"tw.registry.run('vision.view.seat.{seats[0]}')")
        check(await gm.evaluate(f"tw.visionViewer === '{seats[0]}' && !document.querySelector('#visionBadge').hidden && document.querySelector('#visionBadge').dataset.viewer === '{seats[0]}' && !{drawn(PB)}"), 'GM view-as player has badge and hides outside pawns')
        await shot(gm, '04-view-as-player')
        await action(gm, "tw.registry.run('vision.view.party')")
        check(await gm.evaluate(f"tw.visionViewer === 'party' && {vis(12.5)} && {vis(27.5)}"), 'view as party combines player sight')
        await action(gm, "tw.registry.run('vision.view.gm')")
        check(await gm.evaluate(f"tw.visionViewer === 'gm' && {drawn(PB)} && document.querySelector('#visionBadge').hidden"), 'view as GM restores full picture and removes badge')
        await action(gm, "tw.registry.run('vision.sharedPartyVision.on')")
        check(await wait(mi, f'{vis(27.5)} && {drawn(PB)}'), 'shared setting gives first player second player sight')
        await action(gm, "tw.registry.run('vision.sharedPartyVision.off')")
        check(await wait(mi, f'!{vis(27.5)} && !{drawn(PB)}'), 'shared off restores personal sight')
        await action(gm, f"tw.dispatch('token.owner',{{id:'{NPC}',owner:'{seats[0]}'}})")
        check(await wait(mi, f'{vis(27.5)} && {drawn(NPC)}'), 'controlled companion contributes sight from its room')
        await action(gm, f"tw.dispatch('token.owner',{{id:'{NPC}',owner:null}})")
        check(await wait(mi, f'!{vis(27.5)} && !{drawn(NPC)}'), 'releasing companion removes its current sight')
        await action(gm, "tw.registry.run('vision.reset')")
        check(await wait(mi, f'!{exp(27.5)} && {vis(12.5)}'), 'reset forgets explored, keeps current sight')
        await action(gm, 'tw.undo()')
        check(await wait(mi, exp(27.5)), 'undo reset restores explored')
        await action(gm, f"tw.select(['{rooms[2]}']);tw.registry.run('vision.reveal')")
        check(await wait(mi, exp(47.5)), 'reveal explored here marks selected room explored')
        check(await mi.evaluate(f'!{vis(47.5)}'), 'reveal explored does not grant current sight')
        await mi.evaluate("tw.settings.setPref('fogFx',false)"); await mi.wait_for_timeout(700)
        check(await mi.evaluate(f'tw.worldOf(tw.area()).fx.atmos.isOff() && !{drawn(PB)} && !{vis(27.5)}'), 'Fog and mist off retains fog restrictions')
        check(await mi.evaluate('tw.worldOf(tw.area()).fx.fogwar.stats().fogwar_on && !tw.worldOf(tw.area()).fx.fogwar.stats().fogwar_decorative'), 'Fog and mist off uses actual flat fog pass')
        await shot(mi, '05-flat-fog-off')
        await mi.evaluate("tw.settings.setGfx('low')"); await mi.wait_for_timeout(900)
        check(await mi.evaluate(f"tw.settings.prefs().gfx === 'low' && !{drawn(PB)} && !{vis(27.5)}"), 'Low retains fog restrictions')
        check(await mi.evaluate('tw.worldOf(tw.area()).fx.fogwar.stats().fogwar_on && !tw.worldOf(tw.area()).fx.fogwar.stats().fogwar_decorative'), 'Low uses actual flat fog pass')
        await shot(mi, '06-flat-low')
        await action(gm, f"tw.dispatch('entity.flag',{{ids:['{rooms[2]}'],hidden:true}})")
        check(await wait(mi, f"!tw.entities()['{rooms[2]}']"), 'GM-hidden room stays absent despite explored reveal')
        await mi.evaluate(f"tw.rulers.start({{x:12.5,z:{z},y:0}},{{x:32.5,z:{z},y:0}})")
        check(await mi.evaluate(f'!{drawn(PB)} && !{drawn(NPC)} && !{vis(27.5)}'), 'ruler extending into fog reveals no pawns')
        check(await wait(mi, 'tw.worldOf(tw.area()).fx.fogwar.stats().fogwar_overlays > 0'), 'measurement remains in the fog overlay draw list')
        await shot(mi, '07-ruler-into-fog')
        await mi.evaluate('tw.rulers.cancel?.()')
        await gm.evaluate("tw.settings.show('defaults')")
        check(await gm.locator('[data-vision="fogOfWar"]').count() == 1 and await gm.locator('[data-vision="sharedPartyVision"]').count() == 1 and await gm.locator('[data-act="fog-reset"]').count() == 1, 'Global defaults contains both switches and reset')
        await gm.evaluate("tw.settings.close?.()")
        # A delayed result from the old epoch must not restore forgotten ground
        # while fog is disabled. Open-door sight is intentionally in flight.
        await action(gm, f"tw.toggleOpen(Object.values(tw.entities()).find(e=>e.fromEdge==='{door['key']}' && /door|gate|portcullis/.test(e.cat||'')))")
        await wait(mi, vis(27.5))
        await mi.evaluate('window.__fogWorkerDelay=1800')
        await gm.evaluate(f"tw.dispatch('token.move',{{id:'{PA}',x:11.25,z:{z}}})")
        await mi.wait_for_timeout(150)
        await action(gm, "tw.registry.run('vision.fogOfWar.off')")
        await action(gm, f"tw.toggleOpen(Object.values(tw.entities()).find(e=>e.fromEdge==='{door['key']}' && /door|gate|portcullis/.test(e.cat||'')))")
        await action(gm, "tw.registry.run('vision.reset')")
        await mi.wait_for_timeout(2300)
        await mi.evaluate('window.__fogWorkerDelay=0')
        await action(gm, "tw.registry.run('vision.fogOfWar.on')")
        check(await wait(mi, f'{vis(11.25)} && !{exp(27.5)}'), 'delayed old-epoch worker result cannot restore explored memory across reset while disabled')

        # Another floor remains in the atlas below cut0. This raised pawn's base
        # is outdoors at0, so its figure at40 must use base sight, not level40.
        await gm.evaluate("tw.spawnRoom('cellar',0,0,4,4,7199,undefined,-10)")
        await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        flyer='tok_fogflyer001'
        await action(gm, f"tw.dispatch('token.create',{{id:'{flyer}',name:'Flying scout',x:-17.5,z:7.5,y:40,owner:'{seats[0]}'}})")
        await mi.evaluate("tw.settings.setGfx('medium');tw.settings.setPref('fogFx',true);tw.setCut(0,{by:'test'});const g=tw.main.grab;g.focus.set(-5,12,10);g.yaw=0;g.pitch=62;g.dist=110;g.update();tw.main.rule='free';")
        check(await wait(mi, f"tw.pawnBase('{flyer}')?.baseY === 0 && tw.canSeePawn(tw.entities()['{flyer}']) && {drawn(flyer)}"), 'outdoor flyer at40 has base0 and stays visible at cut0')
        check(await wait(mi, "tw.worldOf(tw.area()).fx.fogwar.stats().fogwar_flyers > 0 && tw.worldOf(tw.area()).fx.fogwar.stats().fogwar_levels >= 2"), 'visible flyer uses fragment mask with another floor in the fog atlas')
        await shot(mi,'08-flyer-base-sight')
        # Drain one batch, then leave the unchanged table idle longer than two
        # contribution intervals. No new cells means no new fog commands.
        await mi.wait_for_timeout(2800)
        idle_start=len(fog_commands)
        await mi.wait_for_timeout(4300)
        check(len(fog_commands)==idle_start, 'idle unchanged table sends no exploration commands', {'before':idle_start,'after':len(fog_commands)})
        traffic=[]
        for seat in seats:
            events=[e for e in fog_commands if e['seat']==seat]
            intervals=[round(b['at']-a['at'],2) for a,b in zip(events,events[1:])]
            traffic.append({'seat':seat,'commands':len(events),'bytes':sum(e['bytes'] for e in events),'intervalsMs':intervals})
            check(bool(events) and all(dt>=1800 for dt in intervals), 'exploration submissions are coalesced to at most one per two seconds', {'seat':seat,'commands':len(events),'minIntervalMs':min(intervals) if intervals else None})
        print('FOG TRAFFIC '+json.dumps({'total':len(fog_commands),'clients':traffic}),flush=True)
        check(not errors, 'no browser errors', errors[:5])
        print('FOG INFO '+json.dumps(await mi.evaluate('tw.fog.info()')), flush=True)
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for pr in procs:
        try: pr.wait(timeout=5)
        except Exception: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\nfog: {len(results)-len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)

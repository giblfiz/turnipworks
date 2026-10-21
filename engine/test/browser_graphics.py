#!/usr/bin/env python3
"""Graphics, per viewer (Harry 2026-10-11: "this thing cooks the GPU"; docs/UI.md "Graphics: what the picture costs"):

  PRESETS   Settings > Me > Graphics: Auto / Low / Medium / High / Custom. High is today's look; a preset writes the
            switches; one switch changed by hand makes it Custom; none of it touches the look's own dials.
  SWITCHES  each one skips the WORK (the pass, the simulation, the shadow draw), and compiles nothing new.
  DENSITY   the render resolution caps the 3D canvas's pixels; the page's own pixels (text, menus) are untouched.
  IDLE      after 2 s with nothing happening the picture is drawn 20 times a second (a setting); any input, a change
            from the relay or a spawn animation brings the full rate back on the next display frame; a hidden tab
            draws nothing; simulations keep their speed.
  AUTO      steps down only when frames are slow, keeps a step only if it bought time, says so with one Undo.
  LIGHTS    "Real lights from fires": every flame, a fixed pool of the nearest N (the count never moves, so nothing is
            compiled when fires come and go), or none; a flame that is not a real light still burns and lights nothing
            (its own halo grows a little). The painted floor glow is OFF unless "Glow under far fires" is switched on.
            Changing the number: dark at once, the count changed once the other programs are built in the background.
  WATER     the effects run only while a body of water is in view.
  SELECTION the glow is cut: brackets and outlines only.

Under a test driver the idle rate and Auto are off (tw.gfxForce = true switches them on): checked here too.

  local:  tw-slot python3 engine/test/browser_graphics.py --local [--shots]
  live:   ... browser_graphics.py --page https://turnipworks.net/
"""
import argparse, asyncio, io, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true')
A = ap.parse_args()
results = []; procs = []; tmpdirs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18247,18877').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-gfx-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmpdirs.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(600):  # (a loaded box: the relay can take a while)
        time.sleep(0.2)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500&atmos=morning-mist'
async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def settle(pg, ms=120000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over'); await pg.wait_for_timeout(300)
W = "tw.worldOf(tw.area())"
ST = f"{W}.fx.stats()"
async def view(pg, x, z, dist=70, pitch=58, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
# what a preset or switch has DONE, read off the modules that do the work
STATE = f"""(() => {{ const w = {W}, fx = w.fx, s = fx.stats(), L = fx.lighting, g = tw.gfx.info(), p = tw.settings.prefs();
  return {{ gfx: p.gfx, resolved: g.resolved, shadows: L.viewer.shadows, contact: L.viewer.contact, half: L.viewer.half, dance: L.viewer.dance, ao_enabled: s.ao_enabled, ao_half: s.ao_half, casters: s.shadow_casters,
    fog_off: fx.atmos.isOff(), fog_scale: fx.atmos.viewScale, fog_every: fx.atmos.viewEvery, fog_size: fx.atmos.fxSize(), volume: s.atmos_volume, fire_lite: fx.fire.isLite(), water_lite: fx.water.isLite(), lights: fx.fire.lightsMode,
    pixelRatio: g.pixelRatio, buffer: g.buffer, passes: s.post_passes, programs: s.programs, maxFps: g.maxFps, idleFps: g.idleFps }}; }})()"""
LOOK = f"JSON.stringify(['lighting', 'fire', 'atmos', 'water'].map(k => {W}.fx.params(k)))"
# frames drawn and display frames woken over `ms` -> per second
RATE = """(ms) => new Promise(res => { const a = tw.gfx.info(), t0 = performance.now(); setTimeout(() => { const b = tw.gfx.info(), dt = (performance.now() - t0) / 1000;
  res({ state: b.state, why: b.why, drawn: +((b.drawn - a.drawn) / dt).toFixed(1), woken: +((b.drawn - a.drawn + b.skipped - a.skipped) / dt).toFixed(1) }); }, ms); })"""

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, dsf=1):
            ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}, device_scale_factor=dsf)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST graphics {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000), 'GM tab live')
        # This suite exercises the open tabletop; vision fog has its own three-seat suite.
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
        await wait(gm, "tw.sync.campaign.defaults.fogOfWar === false && tw.sync.pendingCount() === 0", 15000, 'open-table fixture')
        token = await gm.evaluate("new URLSearchParams(location.hash.slice(1)).get('s')")
        rid = await gm.evaluate("tw.spawnRoom('common', 2, 2, 6, 5, 7101)")
        await wait(gm, f"!!tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, 'the room'); await settle(gm); await view(gm, 25, 22); await gm.mouse.move(5, 5); await gm.wait_for_timeout(2500)

        # ================= PRESETS =================
        print('PRESETS: Auto by default, High is today\'s look, a preset writes the switches, one switch makes it Custom')
        s0 = await gm.evaluate(STATE); look0 = await gm.evaluate(LOOK)
        check(s0['gfx'] == 'auto' and s0['resolved'] == 'high', 'a new viewer is on Auto, and Auto starts at High', {k: s0[k] for k in ('gfx', 'resolved')})
        check(s0['shadows'] and s0['contact'] and not s0['half'] and s0['dance'] and s0['ao_enabled'] and not s0['fog_off'] and s0['fog_scale'] == 1 and not s0['fire_lite'] and not s0['water_lite'] and s0['lights'] == 'on' and s0['maxFps'] == 60,
              'High: every effect on, every flame a real light, at full resolution (today\'s picture)', s0)
        check(s0['idleFps'] == 20, 'the idle rate a new viewer gets is 20 a second', s0['idleFps'])
        await gm.evaluate("tw.settings.setGfx('low')"); await gm.wait_for_timeout(900); lo = await gm.evaluate(STATE)
        check(lo['gfx'] == 'low' and not lo['shadows'] and not lo['contact'] and not lo['ao_enabled'] and lo['fog_off'] and not lo['volume'] and lo['fire_lite'] and lo['water_lite'] and lo['lights'] in ('pool', 'dark'),
              'Low: no fire shadow, no contact shadows, no fog, steady fires, plain water, a pool of 4 real lights', lo)
        check(lo['passes'] < s0['passes'], 'and the post stack runs fewer passes', f"{s0['passes']} -> {lo['passes']}")
        await gm.evaluate("tw.settings.setGfx('medium')"); await gm.wait_for_timeout(900); me = await gm.evaluate(STATE)
        check(me['gfx'] == 'medium' and me['shadows'] and me['contact'] and me['half'] and me['ao_half'] and me['fog_scale'] == 0.5 and not me['fog_off'] and not me['fire_lite'] and me['lights'] in ('pool', 'dark') and me['fog_every'] == 2,
              'Medium: everything on, contact shadows and fog at half resolution, the fog stepped every other frame, a pool of 8 real lights', me)
        check(me['fog_size'][0] <= s0['fog_size'][0] * 0.55 and me['ao_half'], 'half resolution is real: the fog\'s target has half the pixels each way, the contact-shadow pass is in its half-res mode', f"fog {s0['fog_size']} -> {me['fog_size']}")
        await gm.evaluate("tw.settings.setPref('fireFx', false)"); await gm.wait_for_timeout(300)
        check(await gm.evaluate("tw.settings.prefs().gfx") == 'custom', 'one switch changed by hand: the preset reads Custom')
        await gm.evaluate("tw.settings.show('me')"); await gm.wait_for_timeout(400)
        rows = await gm.evaluate("(() => { const q = (k) => document.querySelector(`#settingsModal [data-pref=\"${k}\"]`); return { keys: ['gfx', 'lights', 'shadowsFx', 'contactFx', 'fogFx', 'softHalf', 'waterFx', 'fireFx', 'density', 'maxFps', 'idleFps', 'post', 'graphics', 'lightMoves'].filter(k => !q(k)), gfx: q('gfx')?.value, opts: [...(q('gfx')?.options || [])].map(o => o.value), idle: [...(q('idleFps')?.options || [])].map(o => o.value), title: [...document.querySelectorAll('#settingsModal .sgrp h3')].map(h => h.textContent) }; })()")
        check(not rows['keys'] and 'Graphics' in rows['title'], 'Settings > Me > Graphics has the preset and every switch', rows['keys'] or rows['title'])
        check(rows['gfx'] == 'custom' and rows['opts'] == ['auto', 'low', 'medium', 'high', 'custom'] and rows['idle'] == ['0', '30', '20', '10'], 'the preset control offers Auto, Low, Medium, High (and Custom while it is one); the idle rate Off, 30, 20, 10', rows)
        await gm.select_option('#settingsModal [data-pref="gfx"]', 'high'); await gm.wait_for_timeout(900); await gm.evaluate('tw.settings.close()')
        await wait(gm, f"{W}.fx.fire.lightsMode === 'on'", 30000, 'every flame a light again'); await gm.wait_for_timeout(400); hi = await gm.evaluate(STATE)
        check(hi['gfx'] == 'high' and all(hi[k] == s0[k] for k in ('shadows', 'contact', 'half', 'dance', 'ao_enabled', 'ao_half', 'fog_off', 'fog_scale', 'fire_lite', 'water_lite', 'lights', 'pixelRatio', 'passes', 'fog_size')), 'High, picked in Settings, puts every one back', hi)
        check(await gm.evaluate(LOOK) == look0, 'none of it touched the look\'s own dials (lighting, fire, atmosphere, water: byte for byte)')
        check(await gm.evaluate("JSON.parse(localStorage.getItem('tw.prefs')).gfx") == 'high', 'the choice is kept in this browser (tw.prefs), nowhere else')

        # ================= SWITCHES: THE WORK IS SKIPPED, AND NOTHING IS COMPILED =================
        print('SWITCHES: each one skips the work, and none compiles a program')
        await gm.wait_for_timeout(1200); progs0 = (await gm.evaluate(STATE))['programs']
        a = await gm.evaluate(ST); await gm.wait_for_timeout(1000); b = await gm.evaluate(ST)
        check(b['shadow_last_refresh'] > a['shadow_last_refresh'] and b['shadow_casters'] >= 1, 'High: the fire\'s shadow is being redrawn (the dance)', [a['shadow_last_refresh'], b['shadow_last_refresh'], b['shadow_casters']])
        await gm.wait_for_timeout(1500); progs0 = (await gm.evaluate(ST))['programs']
        await gm.evaluate("tw.settings.setPref('shadowsFx', false)"); await gm.wait_for_timeout(700)
        a = await gm.evaluate(ST); await gm.wait_for_timeout(1200); b = await gm.evaluate(ST)
        check(b['shadow_last_refresh'] == a['shadow_last_refresh'] and b['shadow_list_draws'] == a['shadow_list_draws'] and b['shadow_list'] == 0, 'Shadows off: the shadow map is not drawn again (no refresh, nothing in the caster list)', [a['shadow_last_refresh'], b['shadow_last_refresh'], b['shadow_list']])
        check(b['shadow_casters'] == a['shadow_casters'] >= 1 and b['programs'] == progs0 and b['lights_shining'] > 0, 'and the lights still shine with the same light state: no program was compiled for it', {'casters': b['shadow_casters'], 'programs': [progs0, b['programs']]})
        await gm.evaluate("tw.settings.setPref('shadowsFx', true)"); await gm.wait_for_timeout(900); a = await gm.evaluate(ST); await gm.wait_for_timeout(800); b = await gm.evaluate(ST)
        check(b['shadow_last_refresh'] > a['shadow_last_refresh'] and b['shadow_list'] > 0, 'on again: the shadow is drawn again', [b['shadow_list']])
        await gm.evaluate("tw.settings.setPref('contactFx', false)"); await gm.wait_for_timeout(500); b = await gm.evaluate(ST)
        check(b['ao_enabled'] is False and b['post_passes'] == s0['passes'] - 1, 'Contact shadows off: the pass is not run', b['post_passes'])
        # the governor (the hand moving) must not bring them back
        await gm.evaluate(f"{W}.fx.lighting.shed({{ ao: true }}); {W}.fx.lighting.shed({{ ao: false, fade: 0 }})"); await gm.wait_for_timeout(200)
        check((await gm.evaluate(ST))['ao_enabled'] is False, 'and "lighter picture while moving" coming back does not switch them on again')
        await gm.evaluate("tw.settings.setPref('contactFx', true)"); await gm.wait_for_timeout(400)
        check((await gm.evaluate(ST))['ao_enabled'] is True, 'on again')
        # fire: steady, still lit
        LI = f"(async () => {{ const L = {W}.fx.fire.lights().filter(l => l.visible && l.intensity > 0); const out = []; for (let i = 0; i < 6; i++) {{ out.push(L.map(l => +l.intensity.toFixed(4)).join()); await new Promise(r => setTimeout(r, 120)); }} return {{ n: L.length, distinct: new Set(out).size }}; }})()"
        f_on = await gm.evaluate(LI); await gm.evaluate("tw.settings.setPref('fireFx', false)"); await gm.wait_for_timeout(500); f_off = await gm.evaluate(LI)
        check(f_on['n'] > 0 and f_on['distinct'] > 1, 'High: the fire light flickers', f_on)
        check(f_off['n'] == f_on['n'] and f_off['distinct'] == 1, 'Fire flicker off: the same fires still light the room, steadily', f_off)
        fl = await gm.evaluate(f"({{ flames: {W}.fx.fire.flames().filter(f => f.world).length, dance: {W}.fx.lighting.viewer.dance }})")
        a = await gm.evaluate(ST); await gm.wait_for_timeout(700); b = await gm.evaluate(ST)
        check(fl['flames'] > 0 and fl['dance'] is False and b['shadow_last_refresh'] - a['shadow_last_refresh'] <= 2, 'the flames are still drawn, and the shadow is no longer redrawn for the dance', {**fl, 'refreshes': b['shadow_last_refresh'] - a['shadow_last_refresh']})
        await gm.evaluate("tw.settings.setPref('fireFx', true)")
        # WATER: the effects run only while a body of water is in view; a switch as well
        WS = f"(() => {{ const s = {ST}; return {{ wide: s.water_wide, grab: s.water_grab, draws: s.water_draw_calls, steps: s.water_sim_steps, blocks: s.water_sim_blocks, lite: s.water_lite }}; }})()"
        TOUCH = f"(async () => {{ const w = {W}.fx.water, s0 = {W}.fx.stats(); for (let i = 0; i < 10; i++) {{ w.touch(50, 0.08, 15, 1); await new Promise(r => setTimeout(r, 60)); }} const s1 = {W}.fx.stats(); return {{ steps: s1.water_sim_steps - s0.water_sim_steps, draws: s1.water_draw_calls, blocks: s1.water_sim_blocks, wide: s1.water_wide, grab: s1.water_grab }}; }})()"
        w_none = await gm.evaluate(WS)
        check(w_none['wide'] is False and not w_none['draws'], 'no water on the map: the water pass does nothing', w_none)
        await gm.evaluate(f"{W}.fx.water.setBodies([{{ id: 'pond', kind: 'pond', pts: [[40, 8], [62, 8], [64, 17], [60, 24], [43, 23], [38, 15]], depth: 2 }}])"); await view(gm, 40, 18, 80); await gm.wait_for_timeout(1200)
        w_on = await gm.evaluate(TOUCH); await gm.wait_for_timeout(800); progs_w = (await gm.evaluate(ST))['programs']
        check(w_on['wide'] is True and w_on['steps'] > 0 and w_on['grab'] not in ('plain', 'none'), 'a pond in view: the effects are on (the frame is copied for refraction, a touch runs the ripple simulation)', w_on)
        await view(gm, -400, -400, 60); await gm.wait_for_timeout(700); w_away = await gm.evaluate(TOUCH)
        check(w_away['wide'] is False and w_away['steps'] == 0, 'the pond out of view: nothing is copied and nothing is simulated', w_away)
        await view(gm, 40, 18, 80); await gm.wait_for_timeout(700); w_back = await gm.evaluate(TOUCH)
        check(w_back['wide'] is True and w_back['steps'] > 0 and (await gm.evaluate(ST))['programs'] == progs_w, 'back in view: on again, and no program was compiled for the change', [w_back, progs_w, (await gm.evaluate(ST))['programs']])
        await gm.evaluate("tw.settings.setPref('waterFx', false)"); await gm.wait_for_timeout(500); w_off = await gm.evaluate(TOUCH)
        check(w_off['steps'] == 0 and w_off['blocks'] == 0 and (w_off['draws'] or 0) > 0 and w_off['grab'] == 'plain', 'Water effects off: nothing is simulated or copied, and the pond is still drawn as a plain surface', w_off)
        check((await gm.evaluate(f"{W}.fx.water.touch(25, 2, 22, 1)")) is False, 'the game asks for plain vessels: a cup or a barrel never ripples and never switches the effects on')
        await gm.evaluate(f"tw.settings.setPref('waterFx', true); {W}.fx.water.setBodies([])"); await view(gm, 25, 22); await gm.wait_for_timeout(500)
        # LIGHT FROM FIRES: off in two steps (dark at once, out of the scene when the other programs are ready)
        L0 = await gm.evaluate(f"(() => {{ const s = {ST}; return {{ shining: s.lights_shining, casters: s.shadow_casters, mode: {W}.fx.fire.lightsMode, glows: {W}.fx.fire.glowCount(), flames: {W}.fx.fire.flames().filter(f => f.world).length }}; }})()")
        t0 = time.time(); await gm.evaluate("tw.settings.setPref('lights', 'none')"); await gm.wait_for_timeout(120)
        L1 = await gm.evaluate(f"({{ mode: {W}.fx.fire.lightsMode, lit: {W}.fx.fire.lights().filter(l => l.visible && l.intensity > 0).length, glows: {W}.fx.fire.glowCount() }})")
        check(L0['mode'] == 'on' and L0['shining'] > 0 and L0['glows'] == 0, 'Every flame: the fires light the room with real lights, and there is no floor glow', L0)
        check(L1['lit'] == 0 and L1['glows'] == 0, 'Real lights: None. At once no flame lights anything, and NO glow is painted in its place (off by default, 2026-10-12)', L1)
        ok = await wait(gm, f"{W}.fx.fire.lightsMode === 'off'", 30000, 'the no-light programs'); L2 = await gm.evaluate(f"(() => {{ const s = {ST}; return {{ shining: s.lights_shining, casters: s.shadow_casters, flames: {W}.fx.fire.flames().filter(f => f.world).length, glows: {W}.fx.fire.glowCount() }}; }})()")
        check(ok and L2['shining'] == 0 and L2['casters'] == 0 and L2['flames'] == L0['flames'] and L2['glows'] == 0, f'then (after {time.time() - t0:.1f} s here, built in the background) the lights are out of the scene: no light loop, no shadow map; the flames still burn', L2)
        if A.shots: os.makedirs(SHOTS, exist_ok=True); await gm.screenshot(path=os.path.join(SHOTS, 'graphics-fire-light-off.png'))
        # "Glow under far fires": the one switch that brings the painted glow back, per viewer, off for a new viewer
        g0 = await gm.evaluate(f"({{ pref: tw.settings.prefs().farGlow, on: {W}.fx.fire.glowOn, unlit: Math.max(...Array.from({W}.fx.fire.root.children.find(o => o.geometry?.attributes?.iData?.itemSize === 4).geometry.attributes.iData.array).filter((v, i) => i % 4 === 3)) }})")
        check(g0['pref'] == 'auto' and g0['on'] is False and await gm.evaluate('tw.gfx.farGlow()') is False, 'a new viewer has "Glow under far fires" off (it follows the house look, and no far-fire glow has been sent to the game)', g0)
        check(g0['unlit'] > 0.9, 'a candle that lights nothing is told so (its own halo grows: no light, same draw call)', g0['unlit'])
        await gm.evaluate("tw.registry.get('pref.farGlow').run()"); await gm.wait_for_timeout(300)
        g1 = await gm.evaluate(f"(() => {{ const s = {ST}; return {{ pref: tw.settings.prefs().farGlow, on: {W}.fx.farglow.on, standins: s.farglow_lights, pass_on: s.farglow_pass, discs: {W}.fx.fire.glowCount(), lit: {W}.fx.fire.pool().lit, walls: s.farglow_walls, lights: {W}.fx.fire.lights().filter(l => l.visible && l.intensity > 0).length, programs: s.programs, unlit: Math.max(...Array.from({W}.fx.fire.root.children.find(o => o.geometry?.attributes?.iData?.itemSize === 4).geometry.attributes.iData.array).filter((v, i) => i % 4 === 3)) }}; }})()")
        check(g1['pref'] is True and g1['on'] and g1['standins'] == g1['lit'] >= 1 and g1['pass_on'] and g1['lights'] == 0, 'the command "Glow under far fires" switches it on: every flame that is not a real light gets a stand-in (one draw into the light map, one pass over the picture), and still no light', g1)
        check(g1['discs'] == 0 and g1['unlit'] == 0 and g1['walls'] > 0, 'the stand-in is the projected one (no floor discs, no wider halo), and it knows the room\'s walls', {k: g1[k] for k in ('discs', 'unlit', 'walls')})
        look_before = await gm.evaluate(LOOK)
        await gm.evaluate(f"(() => {{ const p = {W}.fx.params('farglow'); p.how.mode = 'floor'; {W}.fx.setParams('farglow', p); }})()"); await gm.wait_for_timeout(300)
        g2 = await gm.evaluate(f"({{ discs: {W}.fx.fire.glowCount(), pass_on: {ST}.farglow_pass }})")
        check(g2['discs'] >= 1 and not g2['pass_on'], 'a far-fire glow look in "floor disc" mode draws the old discs instead, and no pass', g2)
        await gm.evaluate(f"(() => {{ const p = {W}.fx.params('farglow'); p.how.mode = 'projected'; {W}.fx.setParams('farglow', p); }})()"); await gm.wait_for_timeout(300)
        check(await gm.evaluate(LOOK) == look_before, 'and none of it touched the lighting, fire, atmosphere or water looks')
        await gm.evaluate("tw.settings.show('me')"); await gm.wait_for_timeout(300)
        check(await gm.evaluate("document.querySelector('#settingsModal [data-pref=\"farGlow\"]') != null && /Glow under far fires/.test(document.querySelector('#settingsModal').textContent)"), 'Settings > Me > Graphics has the switch "Glow under far fires"')
        if app_gm := await gm.evaluate("tw.gm()"):
            await gm.evaluate("tw.settings.show('defaults')"); await gm.wait_for_timeout(300)
            note = await gm.evaluate("document.querySelector('#settingsModal .gomegfx')?.closest('p')?.textContent || ''")
            check('Graphics are per person' in note, 'Global defaults says where the graphics are: "Graphics are per person: Me ▸ Graphics"', note)
            await gm.click('#settingsModal .gomegfx'); await gm.wait_for_timeout(300)
            there = await gm.evaluate("(() => { const st = tw.settings.state(), top = document.querySelector('#settingsModal .gfxtop'), pane = document.querySelector('#settingsModal .spb'); return { sec: st.section, y: top && pane ? Math.round(top.getBoundingClientRect().top - pane.getBoundingClientRect().top) : null }; })()")
            check(there['sec'] == 'me' and there['y'] is not None and -5 <= there['y'] < 200, 'and the link opens Me at Graphics', there)
        await gm.evaluate("tw.settings.close(); tw.settings.setPref('farGlow', false)"); await gm.wait_for_timeout(300)
        g3 = await gm.evaluate(f"({{ discs: {W}.fx.fire.glowCount(), pass_on: {ST}.farglow_pass, on: {W}.fx.farglow.on, viewer: {W}.fx.farglow.viewer }})")
        check(g3['discs'] == 0 and not g3['pass_on'] and not g3['on'] and g3['viewer'] is False, 'off again: no stand-in, and its pass is out of the frame', g3)
        # left alone ('auto') the switch follows the house look: on once a far-fire glow has been sent with "Use in game"
        await gm.evaluate(f"tw.settings.setPref('farGlow', 'auto'); {W}.fx.farglow.setInHouse(true)"); await gm.wait_for_timeout(300)
        g4 = await gm.evaluate(f"({{ on: {W}.fx.farglow.on, eff: tw.gfx.farGlow(), pass_on: {ST}.farglow_pass }})")
        check(g4['on'] and g4['eff'] and g4['pass_on'], 'left alone, the switch follows the house look: with a far-fire glow in it, the stand-in is on', g4)
        await gm.evaluate(f"{W}.fx.farglow.setInHouse(false)"); await gm.wait_for_timeout(200)
        check(not await gm.evaluate(f"{W}.fx.farglow.on") and not await gm.evaluate("tw.gfx.farGlow()"), 'and with none (today) it is off')
        await gm.evaluate("tw.settings.setPref('lights', 'all')"); ok = await wait(gm, f"{W}.fx.fire.lightsMode === 'on'", 30000, 'lights on'); await gm.wait_for_timeout(700)
        L3 = await gm.evaluate(f"(() => {{ const s = {ST}; return {{ shining: s.lights_shining, casters: s.shadow_casters, glows: {W}.fx.fire.glowCount() }}; }})()")
        check(ok and L3['shining'] == L0['shining'] and L3['casters'] == L0['casters'] and L3['glows'] == 0, 'on again: the same lights, the same shadow, no glow', L3)
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'graphics-fire-light-on.png'))
        pA = (await gm.evaluate(ST))['programs']; await gm.evaluate("tw.settings.setPref('lights', 'none')"); await wait(gm, f"{W}.fx.fire.lightsMode === 'off'", 30000); await gm.evaluate("tw.settings.setPref('lights', 'all')"); await wait(gm, f"{W}.fx.fire.lightsMode === 'on'", 30000); await gm.wait_for_timeout(500)
        check((await gm.evaluate(ST))['programs'] == pA, 'a second time round compiles nothing: both sets of programs are kept', [pA, (await gm.evaluate(ST))['programs']])
        # A FIXED POOL: the nearest N are real, the count never moves, nothing compiles
        POOL = f"(() => {{ const f = {W}.fx.fire; return {{ ...f.pool(), mode: f.lightsMode, glows: f.glowCount(), programs: {ST}.programs, casters: {ST}.shadow_casters }}; }})()"
        await gm.evaluate("tw.settings.setPref('lights', '4')"); ok = await wait(gm, f"{W}.fx.fire.lightsMode === 'pool'", 30000, 'a pool of 4'); await gm.wait_for_timeout(600); p4 = await gm.evaluate(POOL)
        check(ok and p4['real'] + p4['standins'] == 4 and p4['real'] == min(4, p4['lit']) and p4['glows'] == 0 and p4['casters'] == 1, 'a pool of 4: four point lights in the scene, the nearest lit flames; the others light nothing (no painted glow); one still casts the shadow', p4)
        seen = []
        for x, z, d in [(25, 22, 70), (10, 10, 40), (38, 30, 40), (-300, -300, 60), (25, 22, 120), (25, 22, 70)]:
            await view(gm, x, z, d); await gm.wait_for_timeout(450); seen.append(await gm.evaluate(POOL))
        check(all(q['real'] + q['standins'] == 4 for q in seen) and len({q['programs'] for q in seen}) == 1 and seen[0]['programs'] == p4['programs'], 'the view moves across the room and far away: always exactly four lights in the scene, and no program is compiled', [(q['real'], q['standins'], q['programs']) for q in seen])
        await gm.evaluate("tw.settings.setPref('lights', '16')"); ok = await wait(gm, f"{W}.fx.fire.capWant === 16 && {W}.fx.fire.cap === 16", 30000, 'a pool of 16'); await gm.wait_for_timeout(500); p16 = await gm.evaluate(POOL)
        check(ok and p16['real'] == p16['lit'] and p16['real'] + p16['standins'] == 16 and p16['glows'] == 0, 'a pool of 16 with fewer fires than that: every one is real, black stand-ins fill the pool', p16)
        await gm.evaluate("tw.settings.setPref('lights', 'all')"); await wait(gm, f"{W}.fx.fire.lightsMode === 'on'", 30000); await gm.wait_for_timeout(400)
        pall = await gm.evaluate(POOL)
        check(pall['standins'] == 0 and pall['real'] == L0['shining'], 'Every flame again: no stand-ins, the same lights as before', pall)
        # half resolution: two contact-shadow passes, swapped
        await gm.evaluate("tw.settings.setPref('softHalf', true)"); await gm.wait_for_timeout(900); pH = (await gm.evaluate(ST))['programs']
        await gm.evaluate("tw.settings.setPref('softHalf', false)"); await gm.wait_for_timeout(600); await gm.evaluate("tw.settings.setPref('softHalf', true)"); await gm.wait_for_timeout(600)
        hs = await gm.evaluate(ST)
        check(hs['ao_half'] is True and hs['programs'] == pH, 'half resolution off and on again compiles nothing (a second pass, built once, is swapped in)', [pH, hs['programs']])
        await gm.evaluate("tw.settings.setGfx('high')"); await gm.wait_for_timeout(600)
        # fog
        a = await gm.evaluate(ST); await gm.evaluate("tw.settings.setPref('fogFx', false)"); await gm.wait_for_timeout(1100); b = await gm.evaluate(ST)
        check(a['atmos_sim_calls'] > 0 and b['atmos_volume'] is False and b['atmos_sim_calls'] == 0, 'Fog off: not drawn and not simulated (the switch from "three small notes" is this one)', [a['atmos_sim_calls'], b['atmos_sim_calls']])
        await gm.evaluate("tw.settings.setGfx('high')"); await gm.wait_for_timeout(900)

        # ================= SELECTION: THE GLOW IS CUT =================
        print('SELECTION: no glow for any state; brackets and outlines, nothing full-screen')
        oid = await gm.evaluate("(() => { const es = Object.values(tw.entities()).filter(e => e.kind === 'object' && e.layer === 'furnish' && !e.parent); es.sort((a, b) => Math.max(...b.dims) - Math.max(...a.dims)); tw.select([es[0].id]); return es[0].id; })()")
        await gm.wait_for_timeout(700); p_sel = (await gm.evaluate(ST))['post_passes']
        SIG = f"(() => {{ const w = {W}; const mats = []; for (const h of w.halos.values()) h.obj.traverse(o => {{ if (o.material) mats.push({{ line: !!o.material.isLineMaterial, hull: !!(o.isMesh && !o.material.isLineMaterial && o.geometry?.attributes?.normal && o.geometry.attributes.position.count > 200), back: o.material.side === 1 }}); }}); return {{ n: w.halos.size, mats, styles: ['selected', 'hover', 'hidden', 'pending'].map(k => w.selFx?.params?.()?.[k]?.style ?? w.selFx?.params?.[k]?.style ?? null) }}; }})()"
        sg = await gm.evaluate(SIG)
        if A.shots: os.makedirs(SHOTS, exist_ok=True); await gm.screenshot(path=os.path.join(SHOTS, 'graphics-selection.png'))
        check(sg['n'] >= 1 and len(sg['mats']) >= 1 and all(m['line'] for m in sg['mats']), 'a selected thing wears lines (the house brackets): no copy of its own triangles is drawn', sg)
        check(p_sel == s0['passes'], 'and selecting adds no pass to the post stack', [s0['passes'], p_sel])
        ng = await gm.evaluate("import('./world.js').then(m => { const a = m.noGlow({ selected: { style: 'halo' }, hover: { style: 'halo' }, hidden: { style: 'tint' } }); const b = m.noGlow(null); return { a: ['selected', 'hover', 'hidden', 'pending'].map(k => a[k]?.style), b: b.pending?.style }; })")
        check(ng == {'a': ['brackets', 'footprint', 'tint', 'footprint'], 'b': 'footprint'}, 'a look that asks for the glow (the old house look, or "waiting on the relay" by default) gets brackets or the thin outline instead', ng)
        check(not await gm.evaluate("!!tw.registry.get('pref.selFx.high')") and 'glow' not in (await gm.evaluate("tw.registry.get('view.selHalo')?.title || ''")).lower(), 'no command offers a glow')
        await gm.evaluate("tw.select([])"); await gm.wait_for_timeout(300)

        # ================= IDLE =================
        print('IDLE: off under a test driver; with tw.gfxForce, 20 a second after 2 s of nothing, and back at once')
        await gm.mouse.move(5, 5); await gm.wait_for_timeout(3200)
        r = await gm.evaluate(RATE, 1500)
        check(r['state'] == 'full' and r['drawn'] == r['woken'], 'under a test driver the idle rate is off: every display frame is drawn', r)
        await gm.evaluate("tw.gfxForce = true"); await gm.wait_for_timeout(3200)
        r20 = await gm.evaluate(RATE, 3000)
        check(r20['state'] == 'idle' and 10 <= r20['drawn'] <= 23 and r20['woken'] > r20['drawn'] * 1.2, 'nothing happening for 2 s: about 20 pictures a second, while the loop still wakes every display frame', r20)
        await gm.evaluate("tw.settings.setPref('idleFps', 30)"); await gm.wait_for_timeout(2600); r30 = await gm.evaluate(RATE, 3000)
        check(r30['state'] == 'idle' and 24 <= r30['drawn'] <= 33, 'the setting: 30 a second', r30)
        await gm.evaluate("tw.settings.setPref('idleFps', 10)"); await gm.wait_for_timeout(2600); r10 = await gm.evaluate(RATE, 3000)
        check(r10['state'] == 'idle' and 6 <= r10['drawn'] <= 12, 'the setting: 10 a second', r10)
        # simulations keep their speed: the same seconds of fog at 10 pictures a second as at full rate
        FOGT = f"(async (ms) => {{ const s0 = {ST}, t0 = performance.now(); await new Promise(r => setTimeout(r, ms)); const s1 = {ST}; return {{ sim: s1.atmos_sim_calls - s0.atmos_sim_calls, secs: (performance.now() - t0) / 1000, state: tw.gfx.info().state }}; }})"
        # (the fog's clock is the frame's dt summed; fire and water read the wall clock. What is checked: the frame's dt at the idle rate is the real time since the last picture)
        DT = "(ms) => new Promise(res => { let sum = 0, n = 0; const off = tw.on((what, dt) => { if (what === 'frame') { sum += dt; n++; } }); const t0 = performance.now(); setTimeout(() => { off(); res({ sum: +sum.toFixed(3), wall: +((performance.now() - t0) / 1000).toFixed(3), n, state: tw.gfx.info().state }); }, ms); })"
        d10 = await gm.evaluate(DT, 3000)
        check(d10['state'] == 'idle' and abs(d10['sum'] - d10['wall']) < 0.35, 'at the idle rate each frame steps by the real time passed (simulations keep their speed)', d10)
        w10 = await gm.evaluate(f"(async () => {{ {W}.fx.water.setBodies([{{ id: 'pond', kind: 'pond', pts: [[40, 8], [62, 8], [64, 17], [60, 24], [43, 23], [38, 15]], depth: 2 }}]); await new Promise(r => setTimeout(r, 400)); const w = {W}.fx.water; w.touch(50, 0.08, 15, 1); await new Promise(r => setTimeout(r, 400)); const s0 = {ST}, t0 = performance.now(); await new Promise(r => setTimeout(r, 2000)); const s1 = {ST}; return {{ per_s: (s1.water_sim_steps - s0.water_sim_steps) / ((performance.now() - t0) / 1000), state: tw.gfx.info().state }}; }})()")
        check(w10['state'] == 'idle' and 60 <= w10['per_s'] <= 110, 'the ripple simulation still takes about 90 steps a second at 10 pictures a second', w10)
        await gm.evaluate("tw.settings.setPref('idleFps', 20)"); await gm.wait_for_timeout(2600)
        # the first frame after input
        lat = []
        for i in range(5):
            await gm.wait_for_timeout(2400)
            lat.append(await gm.evaluate("""() => new Promise(res => { const st = tw.gfx.info().state, f0 = tw.stats.frames, t0 = performance.now(); let ticks = 0; dispatchEvent(new PointerEvent('pointermove', { clientX: 300 + Math.random() * 9, clientY: 300 }));
              const tick = () => { ticks++; if (tw.stats.frames > f0) res({ st, ticks, ms: +(performance.now() - t0).toFixed(1), now: tw.gfx.info().state }); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); })"""))
        check(all(l['st'] == 'idle' and l['ticks'] <= 2 and l['now'] == 'full' for l in lat), 'a pointer move while idle: the very next display frame is drawn, at full rate again', lat)
        await gm.wait_for_timeout(2600); await gm.keyboard.press('Shift'); k = await gm.evaluate(RATE, 600)
        check(k['state'] == 'full', 'a key does the same', k)
        await gm.wait_for_timeout(2600)
        pre = (await gm.evaluate('tw.gfx.info()'))['state']
        await gm.evaluate("tw.sync.submit('chat.say', { id: 'msg_' + Math.random().toString(36).slice(2, 10), text: 'wake up' }, tw.area())"); await gm.wait_for_timeout(700)
        n1 = await gm.evaluate('tw.gfx.info()')
        check(pre == 'idle' and (n1['state'] == 'full' or n1['why'] == 'net'), 'a change arriving from the relay wakes it', [pre, n1['state'], n1['why']])
        await gm.wait_for_timeout(2600)
        rid2 = await gm.evaluate("tw.spawnRoom('kitchen', 8, 2, 4, 5, 7102)"); await gm.wait_for_timeout(900)
        sp = await gm.evaluate("({ anims: tw.spawningNow().anims, loading: !!tw.spawningNow().last?.loading, g: tw.gfx.info() })")
        check(sp['g']['state'] == 'full', 'a spawn animation runs at full rate', {'anims': sp['anims'], 'state': sp['g']['state'], 'why': sp['g']['why']})
        await settle(gm); await gm.wait_for_timeout(2800)
        check((await gm.evaluate('tw.gfx.info()'))['state'] == 'idle', 'and when it is over and nothing else happens, idle again')
        # a camera glide with no input events
        await gm.evaluate("(() => { const g = tw.main.grab; let n = 0; const id = setInterval(() => { g.focus.x += 0.3; g.update(); if (++n > 25) clearInterval(id); }, 40); })()"); await gm.wait_for_timeout(600)
        check((await gm.evaluate('tw.gfx.info()'))['state'] == 'full', 'the camera moving (no input event at all) is not idle')
        # a hidden tab draws nothing
        await gm.evaluate("Object.defineProperty(document, 'hidden', { get: () => true, configurable: true })"); await gm.wait_for_timeout(300); hid = await gm.evaluate(RATE, 1200)
        check(hid['drawn'] == 0 and hid['state'] == 'hidden', 'a hidden tab draws nothing', hid)
        await gm.evaluate("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))"); await gm.wait_for_timeout(300); vis = await gm.evaluate(RATE, 600)
        check(vis['drawn'] > 0, 'and draws again when it is shown', vis)
        await gm.evaluate("tw.settings.setPref('idleFps', 0)"); await gm.wait_for_timeout(2800); off = await gm.evaluate(RATE, 1200)
        check(off['state'] == 'full' and off['drawn'] == off['woken'], 'the idle rate switched off: every display frame, always', off)
        # the frame-rate limit
        await gm.evaluate("tw.settings.setPref('maxFps', 30)"); await gm.wait_for_timeout(500); m30 = await gm.evaluate(RATE, 2000)
        check(m30['state'] == 'full' and m30['drawn'] <= 33 and m30['drawn'] < m30['woken'] * 0.75, 'a frame-rate limit of 30 holds while active', m30)
        await gm.evaluate("tw.settings.setPref('maxFps', 60); tw.settings.setPref('idleFps', 20); tw.settings.setGfx('high')")

        # ================= THE FPS METER AND THE COMMAND BAR =================
        print('FPS METER, COMMAND BAR')
        await gm.evaluate("tw.fpsMeter.set(true)"); await gm.wait_for_timeout(4200)
        t_idle = await gm.evaluate("document.getElementById('fpsMeter').textContent")
        check('High' in t_idle and 'idle: 20 a second' in t_idle, 'the FPS meter names the preset and says when the idle rate is on', t_idle)
        await gm.mouse.move(400, 400); await gm.mouse.move(420, 410); await gm.wait_for_timeout(900); await gm.mouse.move(430, 410); await gm.wait_for_timeout(300)
        t_full = await gm.evaluate("document.getElementById('fpsMeter').textContent")
        check('idle' not in t_full, 'and not when it is off', t_full)
        gi = await gm.evaluate('tw.gfx.info()')
        check((not gi['timer']) or ('GPU' in t_full), 'with the browser\'s timer it also shows GPU time a frame' if gi['timer'] else '(this browser has no GPU timer: the meter shows frame time only)', t_full)
        await gm.evaluate("tw.fpsMeter.set(false)")
        ids = ['pref.gfx.auto', 'pref.gfx.low', 'pref.gfx.medium', 'pref.gfx.high', 'pref.lights.all', 'pref.lights.16', 'pref.lights.8', 'pref.lights.4', 'pref.lights.none', 'pref.shadowsFx', 'pref.contactFx', 'pref.fogFx', 'pref.softHalf', 'pref.waterFx', 'pref.fireFx',
               'pref.density.native', 'pref.density.1.5', 'pref.density.1', 'pref.maxFps.0', 'pref.maxFps.60', 'pref.maxFps.30', 'pref.idleFps.0', 'pref.idleFps.30', 'pref.idleFps.20', 'pref.idleFps.10', 'pref.post', 'pref.graphics.low']
        missing = await gm.evaluate(f"{json.dumps(ids)}.filter(id => !tw.registry.get(id))")
        check(not missing, f'the command bar has an entry for all of it ({len(ids)} commands)', missing)
        await gm.evaluate("tw.registry.run('pref.gfx.medium')"); await gm.wait_for_timeout(500)
        c1 = await gm.evaluate("tw.settings.prefs().gfx")
        await gm.evaluate("tw.registry.run('pref.idleFps.10'); tw.registry.run('pref.density.1'); tw.registry.run('pref.contactFx')"); await gm.wait_for_timeout(500)
        c2 = await gm.evaluate("(({ gfx, idleFps, density, contactFx }) => ({ gfx, idleFps, density, contactFx }))(tw.settings.prefs())")
        check(c1 == 'medium' and c2 == {'gfx': 'custom', 'idleFps': 10, 'density': '1', 'contactFx': False}, 'and they do what they say', [c1, c2])
        await gm.evaluate("tw.settings.setPref('idleFps', 20); tw.settings.setGfx('high')")

        # ================= AUTO =================
        print('AUTO: steps down only when slow, keeps a step only if it bought time, says so with one Undo')
        async def auto(fake, timeout=40000):
            await gm.evaluate(f"tw.gfx.pretend({fake}); tw.settings.setGfx('auto')")
            await wait(gm, "tw.gfx.info().auto.done", timeout, 'auto to finish'); await gm.wait_for_timeout(300)
            return await gm.evaluate("({ p: (({ gfx, gfxAuto, softHalf, density, shadowsFx, lights }) => ({ gfx, gfxAuto, softHalf, density, shadowsFx, lights }))(tw.settings.prefs()), a: tw.gfx.info().auto, note: (() => { const n = document.getElementById('gfxNote'); return n && !n.hidden ? n.textContent : null; })() })")
        r = await auto("() => ({ ms: 12 })")
        check(r['p']['gfx'] == 'auto' and r['p']['gfxAuto'] == 'high' and r['note'] is None, 'frames are fine: Auto stays on High and says nothing', r['p'])
        r = await auto("(p) => ({ ms: p === 'high' ? 31 : 15 })")
        check(r['p']['gfx'] == 'auto' and r['p']['gfxAuto'] == 'medium' and r['p']['softHalf'] is True and r['p']['density'] == '1.5' and r['p']['lights'] == '8', 'High is slow, Medium is not: Auto settles on Medium (the preset still reads Auto)', r['p'])
        check(r['note'] and 'Medium' in r['note'] and '31' in r['note'] and 'Undo' in r['note'], 'and says so, with the reason and an Undo', r['note'])
        await gm.evaluate("tw.settings.show('me')"); await gm.wait_for_timeout(300)
        line = await gm.evaluate("document.querySelector('#settingsModal [data-pref=\"gfx\"]').closest('.srow').textContent")
        check('Auto chose Medium' in line and 'Use High anyway' in line, 'Settings says the same, for as long as it holds', line[:200])
        await gm.evaluate('tw.settings.close()')
        await gm.click('#gfxNote .undo'); await gm.wait_for_timeout(500)
        u = await gm.evaluate("(({ gfx, softHalf, density }) => ({ gfx, softHalf, density }))(tw.settings.prefs())")
        check(u == {'gfx': 'high', 'softHalf': False, 'density': 'native'} and await gm.evaluate("document.getElementById('gfxNote').hidden"), 'Undo: High, chosen by hand now, so Auto does not take it away again', u)
        r = await auto("(p) => ({ ms: p === 'high' ? 40 : p === 'medium' ? 30 : 16 })")
        check(r['p']['gfxAuto'] == 'low' and r['note'] and 'Low' in r['note'], 'slow on High and on Medium: down to Low, said once', [r['p'], r['note']])
        await gm.evaluate("document.querySelector('#gfxNote .x')?.click()")
        r = await auto("() => ({ ms: 45 })")
        check(r['p']['gfxAuto'] == 'high' and r['a']['note'] == 'not-graphics' and r['note'] is None, 'slow whatever the preset (a big map: it is not the picture): the step is put back, nothing is said, and Auto leaves it alone', [r['p'], r['a']['note'], r['note']])
        r = await auto("(p) => ({ ms: 15, gpu: p === 'high' ? 14 : 6 })")
        check(r['p']['gfxAuto'] == 'medium' and r['note'] and 'GPU' in r['note'], 'frames on time but 14 ms of GPU work in each: Auto steps down for the heat, and says that', r['note'])
        await gm.evaluate("document.querySelector('#gfxNote .x')?.click(); tw.gfx.pretend(null); tw.gfxForce = false; tw.settings.setGfx('high')")

        # ================= DENSITY (a 2x screen) =================
        print('DENSITY: the 3D canvas only')
        hd = await tab(page.split('#')[0] + '#s=' + token, dsf=2)
        check(await wait(hd, 'window.tw && tw.ready && tw.ready()', 90000), 'a 2x tab live'); await settle(hd); await hd.wait_for_timeout(1500)
        D = "(() => { const c = document.querySelector('#c'), r = c.getBoundingClientRect(); return { buf: [c.width, c.height], css: [Math.round(r.width), Math.round(r.height)], dpr: devicePixelRatio, pr: tw.gfx.info().pixelRatio, fx: tw.worldOf(tw.area()).fx.lighting.composer.inputBuffer.width }; })()"
        d2 = await hd.evaluate(D)
        check(d2['dpr'] == 2 and d2['buf'][0] == d2['css'][0] * 2 and d2['fx'] == d2['buf'][0], 'Native on a 2x screen: two drawing-buffer pixels per CSS pixel, as before', d2)
        await hd.evaluate("tw.settings.setPref('density', '1')"); await hd.wait_for_timeout(900); d1 = await hd.evaluate(D)
        check(d1['buf'][0] == d1['css'][0] and d1['fx'] == d1['buf'][0] and d1['css'] == d2['css'] and d1['dpr'] == 2, '1x: a quarter of the pixels in the canvas and in every pass; the canvas is the same size on the page and the page is still 2x (text stays sharp)', d1)
        await hd.evaluate("tw.settings.setPref('density', '1.5')"); await hd.wait_for_timeout(900); d15 = await hd.evaluate(D)
        check(d15['buf'][0] == round(d15['css'][0] * 1.5), '1.5x', d15)
        await hd.evaluate("tw.settings.setGfx('high')"); await hd.wait_for_timeout(900)
        check((await hd.evaluate(D))['buf'] == d2['buf'], 'High: native again')
        await view(hd, 25, 22); await hd.wait_for_timeout(600)
        pt = await hd.evaluate("(() => { const es = Object.values(tw.entities()).filter(e => e.kind === 'object' && e.layer === 'furnish' && !e.parent); es.sort((a, b) => Math.max(...b.dims) - Math.max(...a.dims)); const e = es[0]; return tw.screenOf(e.x, e.z, tw.main, (e.y || 0) + e.dims[1] / 2); })()")
        await hd.mouse.click(pt['x'], pt['y']); await hd.wait_for_timeout(500); sel_a = await hd.evaluate("[...tw.sel].join()")
        await hd.evaluate("tw.select([]); tw.settings.setPref('density', '1')"); await hd.wait_for_timeout(900)
        await hd.mouse.click(pt['x'], pt['y']); await hd.wait_for_timeout(500); sel_b = await hd.evaluate("[...tw.sel].join()")
        check(sel_a and sel_a == sel_b, 'a click picks the same thing at 1x as at native (the pointer works in page pixels)', [sel_a, sel_b])
        await hd.evaluate("tw.settings.setGfx('high')"); await hd.close()

        check(not errors, 'no page errors', errors[:4])
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmpdirs: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\n{len(results) - len(bad)}/{len(results)} checks passed" + (f"; FAILED: {[b[1][:70] for b in bad]}" if bad else ''))
sys.exit(1 if bad else 0)

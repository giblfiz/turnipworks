#!/usr/bin/env python3
"""Harry's three small notes of 2026-10-11 (docs/UI.md "Three small notes, 2026-10-11"):

  LIBRARY  "In the object libraries, let's try making all objects the same size instead of having the relative sizes
           correctly.": in the Build library every thing is drawn the same size; the switch (Settings > Me, and the
           command bar) brings true relative sizes back; what is dragged or copied out is its true size either way.
  FOG      "lets add a 'fog off' option to settings.": a seat's own switch. Off: no fog is drawn and none is simulated,
           for that seat only; it comes back; it is remembered. And it is decoration: what is hidden from a player is
           not sent to them, so it is no more visible with the switch off.
  SHARP    "The 'poor focus' on lower levels is not really working out. I think we should drop it.": nothing is blurred
           or dimmed below the level in view; the post stack is the same at every level.

  local:  TW_GPU=1 python3 engine/test/browser_smalls.py --local [--shots]
  live:   ... browser_smalls.py --page https://turnipworks.net/
"""
import argparse, asyncio, io, json, os, random, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
from PIL import Image, ImageChops, ImageStat, ImageFilter

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
RP, SP = 18163, 18793
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-sm-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmpdirs.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500&atmos=morning-mist'
async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over'); await pg.wait_for_timeout(300)
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects }, stair: false } }]); return a.id; }"""
W = "tw.worldOf(tw.area())"
async def view(pg, x, z, dist=95, pitch=60, yaw=0, y=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
async def shot(pg, name=None):
    b = await pg.screenshot()
    if name and A.shots: os.makedirs(SHOTS, exist_ok=True); open(os.path.join(SHOTS, f'smalls-{name}.png'), 'wb').write(b)
    return Image.open(io.BytesIO(b)).convert('RGB')
def diff(a, b, box=None):
    if box: a, b = a.crop(box), b.crop(box)
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3
async def bar(pg, text):
    """run a command from the command bar, as a person does: / , type, Enter. -> the top results shown"""
    await pg.keyboard.press('Escape'); await pg.evaluate("document.activeElement?.blur?.()"); await pg.keyboard.press('/'); await pg.wait_for_timeout(150)
    if not await pg.evaluate("document.getElementById('bar').classList.contains('open')"): print('    (the / key did not open the bar: opened by its command)'); await pg.evaluate("tw.emit('bar.open')")
    await pg.keyboard.press('Control+A'); await pg.keyboard.type(text, delay=8); await pg.wait_for_timeout(350)
    top = await pg.evaluate("[...document.querySelectorAll('#results .res')].slice(0, 3).map(el => (el.classList.contains('hi') ? '> ' : '') + el.textContent.trim().slice(0, 60))")
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(350); return top
ATMOS = f"(() => {{ const w = {W}, s = w.fx.stats(); return {{ off: w.fx.atmos.isOff(), volume: s.atmos_volume, sim: s.atmos_sim_calls, sheets: s.atmos_sheets ?? null, pref: tw.settings.prefs().fogFx }}; }})()"
# the drawn size of every thing in the open library: the longer side of its footprint from above (its group's box)
LIBSIZES = """(() => { const w = tw.worlds.get(tw.library.info().area); const out = [];
  w.layers.things.updateMatrixWorld(true);
  for (const r of w.recs.values()) { const e = r.entity; if (e.kind !== 'object') continue; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, n = 0;
    r.group.traverse(o => { if (!o.isMesh || o.userData?.halo || !o.geometry) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; if (!b || !isFinite(b.min.x)) return;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const p = o.localToWorld(new o.position.constructor(x, y, z)); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); n++; } });
    if (n) out.push({ cat: e.cat, k: e.libK || 1, scale: +r.group.scale.x.toFixed(3), side: +Math.max(x1 - x0, z1 - z0).toFixed(2), true: Math.max(...e.dims) });
  } return out; })()"""

TOTAL = "Object.keys(tw.worlds.get(tw.library.info().area).libView.entities).length"  # every thing the library holds, loaded or not
# at the overview: a click on each thing's place picks that thing (of the things inside the PiP window)
PICKS = """(() => { const w = tw.worlds.get(tw.library.info().area), f = document.getElementById('pipFrame').getBoundingClientRect(); let n = 0, hit = 0; const miss = [];
  for (const k of w.lay.slots.keys()) { if (k.includes('|')) continue; const p = tw.library.screenOf(k); if (!p || p.x < f.left + 20 || p.x > f.right - 20 || p.y < f.top + 30 || p.y > f.bottom - 20) continue; n++;
    const got = tw.library.pick(p.x, p.y)?.id || null; if (got === k) hit++; else if (miss.length < 8) miss.push([k, got]); } return { n, hit, miss, dist: +tw.pip.grab.dist.toFixed(0) }; })()"""
def spread(xs):
    """largest over smallest, leaving out the top and bottom 2% (a mesh that spills over its listed size, as the straw floor tile does, is that much bigger at any scale)"""
    k = max(1, len(xs) // 50); return xs[-1 - k] / xs[k]
OPENLIB = "(() => { const X = tw.taxonomy; for (const gid of X.genres) for (const tid of X.get(gid).children) for (const rid of X.get(tid).children) if (X.get(rid).roomKey === 'common') { tw.build.restore([gid, tid, rid]); return true; } return false; })()"
async def open_lib(pg):
    """the Build menu on Common room, as a person who last picked it finds it: its library opens in the PiP"""
    if await pg.evaluate('tw.library.shown()'): return
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.evaluate(OPENLIB)
    for _ in range(3):  # (on a busy box the first frames after opening can take seconds)
        await pg.evaluate('tw.build.open()'); ok = await wait(pg, 'tw.library.shown()', 20000, 'the library in the PiP'); await pg.evaluate('tw.build.close()'); await pg.wait_for_timeout(600)
        if ok and await pg.evaluate('tw.library.shown()'): break

async def lib_shot(pg, name):
    """(--shots) the library window alone, once its meshes are in: the whole layout, and one section close up"""
    await wait(pg, "(() => { const l = tw.library.loaded(); return l && l.drawn >= l.total * 0.97; })()", 90000, 'library meshes'); await pg.wait_for_timeout(1500)
    r = await pg.evaluate("(() => { const f = document.getElementById('pipFrame').getBoundingClientRect(); return { x: f.left, y: f.top, width: f.width, height: f.height }; })()")
    os.makedirs(SHOTS, exist_ok=True); await pg.screenshot(path=os.path.join(SHOTS, f'smalls-{name}.png'), clip=r)
    print('    (layout)', name, await pg.evaluate("JSON.stringify({ size: tw.worlds.get(tw.library.info().area).lay.size.map(v => +v.toFixed(1)), loaded: tw.library.loaded() })"))
    await pg.evaluate("(() => { const w = tw.worlds.get(tw.library.info().area), g = tw.pip.grab; tw.library.touched(); g.focus.set(w.lay.size[0] * 0.3, 0, w.lay.size[1] * 0.3); g.dist = 34; g.pitch = 88; g.yaw = 0; g.update(); })()"); await pg.wait_for_timeout(2500)
    await pg.screenshot(path=os.path.join(SHOTS, f'smalls-{name}-close.png'), clip=r)

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro&atmos=morning-mist'
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}, permissions=['clipboard-read', 'clipboard-write'])
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST smalls {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        R = {}
        async def build(name, **a):
            rid = f"room_s{name}{random.randrange(10**6):06d}"[:24]; R[name] = await gm.evaluate(SPAWN, {'id': rid, **a})
            await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, name)
        await view(gm, 22, 10)
        await build('common', type='common', x=0, z=0, w=6, d=4, seed=8101)
        await build('up', type='guest', x=0, z=0, w=4, d=4, y=10, seed=8102)
        await build('secret', type='cellar', x=8, z=0, w=4, d=4, seed=8103)    # the room the GM hides: a cellar-type room, so it has fog of its own
        await settle(gm); await gm.wait_for_timeout(1500)

        # ================= SHARP =================
        print('SHARP: nothing is blurred or dimmed below the level in view')
        d = {}
        for (name, cut) in (('all', None), ('lv2', 19), ('lv1', 9)):
            await gm.evaluate(f"tw.setCut({json.dumps(cut)}, {{ by: 'test' }})"); await gm.wait_for_timeout(400)
            d[name] = await gm.evaluate(f"(() => {{ const w = {W}; return {{ passes: w.fx.stats().post_passes, depth: 'depth' in w.fx, focus: 'depthFocus' in tw, keys: Object.keys(w.fx.stats()).filter(k => k.startsWith('depth')) }}; }})()")
        check(len({v['passes'] for v in d.values()}) == 1 and isinstance(d['lv2']['passes'], int), 'the post stack is the same at every cut: looking down from lv 2 adds no pass', {k: v['passes'] for k, v in d.items()})
        check(not any(v['depth'] or v['focus'] or v['keys'] for v in d.values()), 'the depth look is gone from the effects stack and from the game', d['lv2'])
        # the yard beside the building, seen from lv 2: as sharp as it is with every level shown (edges in the same patch of ground)
        await view(gm, 22, 10, 70, 62)
        await gm.evaluate("tw.settings.setPref('fogFx', false)"); await gm.wait_for_timeout(600)  # (still air, so the two pictures can be compared)
        box = await gm.evaluate("(() => { const a = tw.screenOf(42, 3, tw.main, 0), b = tw.screenOf(58, 17, tw.main, 0); return [Math.round(Math.min(a.x, b.x)), Math.round(Math.min(a.y, b.y)), Math.round(Math.max(a.x, b.x)), Math.round(Math.max(a.y, b.y))]; })()")
        edge = lambda im: ImageStat.Stat(im.crop(box).convert('L').filter(ImageFilter.FIND_EDGES)).mean[0]; lum = lambda im: ImageStat.Stat(im.crop(box).convert('L')).mean[0]
        await gm.evaluate("tw.setCut(null, { by: 'test' })"); await gm.wait_for_timeout(1200); a = await shot(gm, 'sharp-all')
        await gm.evaluate("tw.setCut(19, { by: 'test' })"); await gm.wait_for_timeout(1200); b = await shot(gm, 'sharp-lv2')
        check(abs(edge(a) - edge(b)) <= 0.12 * max(edge(a), 0.5) and abs(lum(a) - lum(b)) <= 0.08 * max(lum(a), 1), 'the secret room on the ground, seen from lv 2, is as sharp and as bright as with all levels shown', f"edges {edge(a):.2f} / {edge(b):.2f}, brightness {lum(a):.1f} / {lum(b):.1f}, box {box}")
        await gm.evaluate("tw.setCut(null, { by: 'test' }); tw.settings.setPref('fogFx', true)"); await gm.wait_for_timeout(600)

        # ================= FOG =================
        print('FOG: a seat\'s own switch; decoration only')
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
        pl = await tab(invite + '&nointro&faces=1500&atmos=morning-mist')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab joined'); await settle(pl)
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{R['secret']}'], hidden: true }})")
        await wait(pl, f"!tw.entities()['{R['secret']}']", 10000, 'the secret room leaves the player')
        await view(pl, 22, 10, 80, 58); await pl.wait_for_timeout(2500)
        on = await pl.evaluate(ATMOS)
        check(on['pref'] is True and on['off'] is False and on['volume'] is True and on['sim'] > 0, 'by default the fog is on: it is drawn and its fluid is simulated', on)
        f_on = await shot(pl, 'fog-on')
        seen_on = await pl.evaluate(f"(() => {{ const w = {W}; return {{ ents: Object.values(tw.entities()).filter(e => e.id === '{R['secret']}' || e.room === '{R['secret']}').length, shell: [...w.shell.values()].filter(s => s.roomId === '{R['secret']}').length, recs: [...w.recs.values()].filter(r => r.entity.room === '{R['secret']}').length, labels: tw.labelInfo().filter(l => l.id === '{R['secret']}').length }}; }})()")
        gm_has = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.room === '{R['secret']}').length")
        check(gm_has > 0 and not any(seen_on.values()), 'the hidden room and its things are not on the player\'s side at all (the relay does not send them)', f"GM has {gm_has} things in it; player {seen_on}")
        # off, from the command bar
        await pl.mouse.move(700, 450); await bar(pl, 'fog off'); await pl.wait_for_timeout(1500)
        off = await pl.evaluate(ATMOS)
        check(off['pref'] is False and off['off'] is True, 'the command bar\'s "Fog off" turns this seat\'s fog off', off)
        check(off['volume'] is False and off['sim'] == 0 and not off['sheets'], 'off: no fog volume is drawn and the fluid is not simulated', off)
        steps = await pl.evaluate(f"(async () => {{ const a = {W}.fx.atmos, s0 = {W}.fx.stats().atmos_sim_cpu_ms; const f0 = a.readField('density'); await new Promise(r => setTimeout(r, 1200)); const f1 = a.readField('density'); let ch = 0; if (f0 && f1) for (let i = 0; i < f0.data.length; i += 37) if (f0.data[i] !== f1.data[i]) ch++; return {{ changed: ch, has: !!f0 }}; }})()")
        check(steps['changed'] == 0, 'off: the fluid\'s density field does not change from one second to the next (nothing is stepping it)', steps)
        f_off = await shot(pl, 'fog-off'); await pl.wait_for_timeout(700); f_off2 = await shot(pl)
        d_on, d_noise = diff(f_on, f_off), diff(f_off, f_off2)
        check(d_on > 2.0 and d_on > 4 * max(d_noise, 0.05), 'off: the picture really has no fog in it (it differs from the fogged one far more than two still frames differ)', f"on/off {d_on:.2f}, off/off {d_noise:.2f}")
        seen_off = await pl.evaluate(f"(() => {{ const w = {W}; return {{ ents: Object.values(tw.entities()).filter(e => e.id === '{R['secret']}' || e.room === '{R['secret']}').length, shell: [...w.shell.values()].filter(s => s.roomId === '{R['secret']}').length, recs: [...w.recs.values()].filter(r => r.entity.room === '{R['secret']}').length, labels: tw.labelInfo().filter(l => l.id === '{R['secret']}').length }}; }})()")
        check(not any(seen_off.values()), 'with the fog off the player still has nothing of the hidden room: no room, no things, no walls, no label', seen_off)
        # the ground where the hidden room stands looks, to the player, like bare ground elsewhere (nothing was only "under the fog")
        pix = await pl.evaluate("[[50, 10], [50, 30]].map(([x, z]) => { const s = tw.screenOf(x, z, tw.main, 0); return [Math.round(s.x), Math.round(s.y)]; })")
        patch = lambda im, c: im.crop((c[0] - 14, c[1] - 14, c[0] + 14, c[1] + 14))
        dd = diff(patch(f_off, pix[0]), patch(f_off, pix[1]))
        check(dd < 12, 'where the hidden room stands the player sees bare ground like the bare ground beside it', f"mean difference {dd:.1f} of 255 at {pix}")
        g = await gm.evaluate(ATMOS)
        check(g['off'] is False and g['pref'] is True and g['volume'] is True, 'the GM\'s fog is untouched by the player\'s switch (it is per seat, in that browser)', g)
        hide_fog = await gm.evaluate(f"(() => {{ const w = {W}; return {{ regions: w.fx.atmos.regions().filter(r => r.hidden).length }}; }})()")
        check(hide_fog['regions'] == 0, 'the game gives the atmosphere no "hidden" regions: nothing in the game is hidden by fog, so no fog switch can reveal anything', hide_fog)
        # a reload keeps it; Settings shows it; on again there
        await pl.reload(); await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000); await settle(pl); await pl.wait_for_timeout(1500)
        r = await pl.evaluate(ATMOS)
        check(r['pref'] is False and r['off'] is True and r['volume'] is False, 'after a reload the fog is still off for that seat', r)
        await pl.evaluate("tw.settings.show('me')"); await pl.wait_for_timeout(400)
        row = await pl.evaluate("(() => { const el = document.querySelector('#settingsModal [data-pref=\"fogFx\"]'); if (!el) return null; const r = el.closest('.srow') || el.parentElement.parentElement; return { text: r.textContent.trim().slice(0, 160), on: el.checked ?? el.getAttribute('aria-checked') ?? el.classList.contains('on') }; })()")
        check(row and 'Fog and mist' in row['text'] and row['on'] in (False, 'false'), 'Settings > Me has "Fog and mist", showing off', row)
        await pl.click('#settingsModal [data-pref="fogFx"]'); await pl.wait_for_timeout(300); await pl.evaluate("tw.settings.close()"); await pl.wait_for_timeout(2500)
        back = await pl.evaluate(ATMOS)
        check(back['pref'] is True and back['off'] is False and back['volume'] is True and back['sim'] > 0, 'switched on again in Settings, the fog is drawn and simulated again', back)
        await view(pl, 22, 10, 80, 58); await pl.wait_for_timeout(1500); f_back = await shot(pl, 'fog-back')
        check(diff(f_back, f_off) > 2.0, 'and it is in the picture again', f"{diff(f_back, f_off):.2f}")
        await pl.close()

        # ================= LIBRARY =================
        print('LIBRARY: every thing the same size; the switch; what comes out is its true size')
        await gm.bring_to_front(); await view(gm, 22, 10, 80, 58)
        await gm.mouse.move(700, 450); await open_lib(gm)
        info = await gm.evaluate('tw.library.info()')
        check(info['shown'] and info['even'] is True, 'the Build library opens with "everything the same size" on (the trial\'s default)', info)
        await wait(gm, 'tw.library.info().flown', 20000, 'overview'); await gm.wait_for_timeout(2500)
        ev = await gm.evaluate(LIBSIZES); sides = sorted(x['side'] for x in ev); trues = sorted(x['true'] for x in ev)
        total_even = await gm.evaluate(TOTAL)
        await wait(gm, "(() => { const l = tw.library.loaded(); return l && l.drawn >= l.total * 0.97; })()", 90000, 'library meshes'); await gm.wait_for_timeout(800)
        pk_even = await gm.evaluate(PICKS); print('    (picks, same size)', pk_even)
        check(len(ev) > 40 and spread(sides) < 1.25 and sides[-1] / sides[0] < 2.5 and abs(sides[len(sides) // 2] - 3) < 0.3, 'every thing in the library is drawn the same size: the longer side of each footprint is about 3 ft (all but the odd 2% within a quarter of each other; a mesh that spills over its listed size stays under 2.5; true sizes differ 40-fold)', f"{len(ev)} things, sides {sides[0]}..{sides[-1]} ft (their true longest sides run {trues[0]}..{trues[-1]} ft)")
        if A.shots: await lib_shot(gm, 'lib-even'); await gm.evaluate('tw.library.show(tw.worlds.get(tw.library.info().area).roomNode)')
        lab = await gm.evaluate("""(() => { const w = tw.worlds.get(tw.library.info().area), rs = w.layers.deco.children.filter(m => m.userData.label && !m.userData.label.text.match(/^[A-Z ,·]+$/)).map(m => [m.position.x - m.userData.label.w / 2, m.position.z - m.userData.label.h / 2, m.position.x + m.userData.label.w / 2, m.position.z + m.userData.label.h / 2]);
          let hit = 0; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (rs[i][0] < rs[j][2] - 0.02 && rs[j][0] < rs[i][2] - 0.02 && rs[i][1] < rs[j][3] - 0.02 && rs[j][1] < rs[i][3] - 0.02) hit++; return { labels: rs.length, overlapping: hit }; })()""")
        check(lab['labels'] > 40 and lab['overlapping'] == 0, 'no two labels overlap in the same-size layout', lab)
        # drag a small thing out: it lands at its true size
        small = min((x for x in ev if x['k'] > 2), key=lambda x: x['true'], default=None)
        cat = small and small['cat']
        n0 = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.cat === '{cat}').length")
        await gm.evaluate(f"tw.library.focus('{cat}')"); await wait(gm, 'tw.library.info().flown', 20000, 'the small thing in view'); await gm.wait_for_timeout(1200)
        src = await gm.evaluate(f"tw.library.screenOf('{cat}')"); dst = {'x': 300, 'y': 560}  # bare ground, well clear of the PiP window
        ids0 = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.cat === '{cat}').map(e => e.id)")
        picked = await gm.evaluate(f"tw.library.pick({src['x']}, {src['y']})?.id || null")
        await gm.mouse.move(src['x'], src['y']); await gm.mouse.down()
        for i in range(1, 13): await gm.mouse.move(src['x'] + (dst['x'] - src['x']) * i / 12, src['y'] + (dst['y'] - src['y']) * i / 12); await gm.wait_for_timeout(40)
        mid = await gm.evaluate("JSON.stringify({ mode: tw.mode?.kind, cat: tw.mode?.cat?.id, via: tw.mode?.viaDrag })")
        await gm.mouse.up()
        ok = await wait(gm, f"Object.values(tw.entities()).filter(e => e.cat === '{cat}').length > {n0} && tw.sync.pendingCount() === 0", 10000, 'dragged out'); await gm.wait_for_timeout(1500)
        if not ok: print('    (drag diag)', cat, picked, src, dst, mid, await gm.evaluate("document.querySelector('#toast')?.textContent"), await gm.evaluate("JSON.stringify(tw.library.info())"))
        placed = await gm.evaluate(f"""(() => {{ const w = {W}, old = new Set({json.dumps(ids0)}), e = Object.values(tw.entities()).find(e => e.cat === '{cat}' && !old.has(e.id)); if (!e) return null; const r = w.recs.get(e.id);
          return {{ libK: e.libK ?? null, tilt: e.tiltX || e.tiltZ || 0, scale: r ? +r.group.scale.x.toFixed(3) : null, s: e.s || null }}; }})()""")
        check(ok and placed and placed['libK'] is None and placed['scale'] == 1 and not placed['tilt'], f'a small thing ({cat}, drawn {small and small["k"]:.1f}x in the library) dragged out into the world is its true size: no drawing scale on it, upright', placed)
        await gm.keyboard.press('Escape')
        # copy from the library: the clipboard item carries no drawing scale
        clip = await gm.evaluate(f"(() => {{ const w = tw.worlds.get(tw.library.info().area), s = w.lay.slots.get('{cat}'); tw.library.select({{ id: '{cat}', sku: w.lay.entities[s.id].sku, name: '{cat}', place: w.lay.entities[s.id].place, entity: w.lay.entities[s.id] }}); const c = tw.library.clip(); tw.library.select(null); return {{ k: w.lay.entities[s.id].libK, clipK: c.items[0].e.libK ?? null }}; }})()")
        check(clip['k'] > 2 and clip['clipK'] is None, 'a thing copied in the library goes to the clipboard without its drawing scale', clip)
        # the switch: true relative sizes
        await open_lib(gm); top = await bar(gm, 'Library: show true relative sizes'); print('    (bar)', top); await gm.wait_for_timeout(600); await open_lib(gm)
        await wait(gm, 'tw.library.info().flown', 20000, 'overview'); await gm.wait_for_timeout(2000)
        info = await gm.evaluate('tw.library.info()'); tr = await gm.evaluate(LIBSIZES); ts = sorted(x['side'] for x in tr)
        total_off = await gm.evaluate(TOTAL)
        pk_true = await gm.evaluate(PICKS); print('    (picks, true sizes)', pk_true)
        check(pk_even['n'] > 40 and pk_even['hit'] / pk_even['n'] >= 0.9 and pk_even['hit'] >= pk_true['hit'] - 4, 'from the overview, pointing at the middle of a thing\'s place picks that thing about as often as with true sizes (the misses are open frames: a doorway, a stand)', f"same size {pk_even['hit']}/{pk_even['n']}, true sizes {pk_true['hit']}/{pk_true['n']}")
        check(info['even'] is False and await gm.evaluate("tw.settings.prefs().libEven") is False, 'the command bar\'s "Library: show true relative sizes" turns the trial off', info['even'])
        check(len(tr) > 40 and total_off == total_even and all(x['k'] == 1 and x['scale'] == 1 for x in tr) and ts[-1] / ts[0] > 6, 'off: things are drawn at their true relative sizes again, as before the trial', f"sides {ts[0]}..{ts[-1]} ft")
        if A.shots: await lib_shot(gm, 'lib-true')
        await gm.evaluate("tw.settings.show('me')"); await gm.wait_for_timeout(400)
        row = await gm.evaluate("(() => { const el = document.querySelector('#settingsModal [data-pref=\"libEven\"]'); return el ? (el.closest('.srow') || el.parentElement.parentElement).textContent.trim().slice(0, 120) : null; })()")
        check(row and 'Library: everything the same size' in row, 'Settings > Me has the switch', row)
        await gm.click('#settingsModal [data-pref="libEven"]'); await gm.wait_for_timeout(500); await gm.evaluate("tw.settings.close()"); await gm.wait_for_timeout(600); shown_after = await gm.evaluate('tw.library.shown()'); await open_lib(gm); await gm.wait_for_timeout(4000)
        ev2 = await gm.evaluate(LIBSIZES); s2 = sorted(x['side'] for x in ev2)
        odd = [x for x in ev2 if abs(x['side'] - 3) > 0.3]
        if odd: print('    (not 3 ft)', odd[:6])
        check(await gm.evaluate('tw.library.info().even') is True and len(ev2) > 40 and await gm.evaluate(TOTAL) == total_even and spread(s2) < 1.25 and s2[-1] / s2[0] < 2.5, 'switched on again in Settings, the open library is laid out again at one size, at once', f"sides {s2[0]}..{s2[-1]} ft")
        real = [e for e in errors if 'WebSocket' not in e and 'ERR_CONNECTION' not in e]
        check(not real, 'no page errors', real[:3])
        await browser.close()
    bad = [r for r in results if not r[0]]
    print(f"\nsmalls: {len(results) - len(bad)}/{len(results)} passed")
    return 1 if bad else 0

try: code = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmpdirs: shutil.rmtree(d, ignore_errors=True)  # (/tmp is RAM: a suite removes what it made)
sys.exit(code)

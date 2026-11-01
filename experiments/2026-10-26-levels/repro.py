#!/usr/bin/env python3
"""Pawn levels in Harry's "Intesst" map (cmp_q2bjx70ajq), dragged with the real mouse path, as the GM and as a player.

A COPY of the campaign runs on a local relay (its own secret, its own ports); seat tokens are minted locally and never
printed. Nothing touches the dev or prod relays.

  TW_GPU=1 python3 experiments/2026-10-26-levels/repro.py <copied data dir> [--out f.json] [--shots DIR]

Each case: put the pawn at a start (a command), set the view's level, drag it with the mouse from its base to a target
point, and record where it ended (y, its base, the level). Printed as a table; --out writes JSON.
"""
import argparse, asyncio, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('data'); ap.add_argument('--out'); ap.add_argument('--shots'); ap.add_argument('--only')
A = ap.parse_args()
CID, AREA, GM, PL, TONY = 'cmp_q2bjx70ajq', 'area_gmisutca4n', 'seat_18fu4xc388', 'seat_nfe2ccjmlm', 'tok_9r8hnbdr9f'
C = lambda g: g * 5 + 2.5

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
procs = []
def start():
    data = tempfile.mkdtemp(prefix='tw-levels-'); shutil.copytree(os.path.join(A.data, CID), os.path.join(data, CID))
    site = tempfile.mkdtemp(prefix='tw-levels-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    rp, sp = free_port(), free_port()
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(rp), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(sp), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(150):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{rp}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{sp}/engine/client/index.html', timeout=1); break
        except Exception: pass
    # the served page is THIS checkout's (a stale server on a port would serve another tree)
    mine = open(os.path.join(ENGINE, 'core', 'height.js'), 'rb').read()
    assert urllib.request.urlopen(f'http://127.0.0.1:{sp}/engine/core/height.js', timeout=5).read() == mine, 'the static server is not serving this checkout'
    subprocess.run(['node', os.path.join(HERE, 'mint.mjs'), data, CID, GM, PL], check=True)
    toks = json.load(open(os.path.join(data, 'local-tokens.json')))
    base = f'http://127.0.0.1:{sp}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{rp}') + '&api=&nopost&faces=1500'
    return base, toks

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=80); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def view(pg, x, z, dist=95, pitch=72, yaw=0, y=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(350)
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")
async def mdrag(pg, a, b, steps=16, peeks=None):
    await pg.mouse.move(a['x'], a['y']); await pg.wait_for_timeout(150); await pg.mouse.down()
    seen = []
    for i in range(1, steps + 1):
        await pg.mouse.move(a['x'] + (b['x'] - a['x']) * i / steps, a['y'] + (b['y'] - a['y']) * i / steps); await pg.wait_for_timeout(30)
        if peeks: seen.append(await pg.evaluate(peeks))
    await pg.mouse.up(); await pg.wait_for_timeout(500); return seen
W = "tw.worldOf(tw.area())"
INFO = f"(id) => {{ const e = tw.entities()[id], w = {W}, b = w.pawnBaseInfo(id); return {{ x: e.x, y: e.y || 0, z: e.z, base: b && b.baseY, on: b && b.on, room: b && b.room, roomType: b && b.room && tw.entities()[b.room]?.recipe?.type || null, level: w.pawnLevel(e), hidden: w.cutHides(e), drop: tw.lastDrop, hop: tw.lastHop && tw.lastHop.token === id ? tw.lastHop : null, fall: !!(tw.falls && tw.falls.hanging && tw.falls.hanging(id)) }}; }}"
# the dragged pawn's would-be landing during a drag (the distance readout's: input.js moveDrag.pawns)
PEEK = "(() => { const p = tw.moveDrag?.pawns; return p ? { dy: p.dy, hang: p.hang, on: p.on } : null; })()"

# (name, seat, pawn, start [x, z, y], target [x, z, y-seen], level ('all' | floor height), sight y for the pointer)
CASES = [
  # across buildings on the ground: the great hall (bld 1, y 0) to the north end of the mansion hall, under bld 2's upper hall (y 10)
  ('gh->mansion-under-upper', 'gm', 'probe', [C(17), C(18), 0], [C(14), C(12), 10], 'all'),
  ('gh->mansion-under-upper', 'gm', 'probe', [C(17), C(18), 0], [C(14), C(12), 0], 0),
  ('gh->mansion-under-upper', 'gm', 'probe', [C(17), C(18), 0], [C(14), C(12), 10], 10),
  # the ground mansion hall's north end, under the hill's hallway (y 10, bld 1)
  ('mansion->under-hallway', 'gm', 'probe', [C(14), C(16), 0], [C(14), C(10), 10], 'all'),
  ('mansion->under-hallway', 'gm', 'probe', [C(14), C(16), 0], [C(14), C(10), 0], 0),
  # into the cathedral on the hill (y 10) from the great hall, at every view
  ('gh->cathedral', 'gm', 'probe', [C(17), C(18), 0], [C(15), C(2), 10], 'all'),
  ('gh->cathedral', 'gm', 'probe', [C(17), C(18), 0], [C(15), C(2), 10], 0),
  ('gh->cathedral', 'gm', 'probe', [C(17), C(18), 0], [C(15), C(2), 10], 10),
  # within the cathedral (it starts on its floor at 10)
  ('cathedral->cathedral', 'gm', 'probe', [C(12), C(0), 10], [C(17), C(4), 10], 'all'),
  ('cathedral->cathedral', 'gm', 'probe', [C(12), C(0), 10], [C(17), C(4), 10], 0),
  ('cathedral->cathedral', 'gm', 'probe', [C(12), C(0), 10], [C(17), C(4), 10], 10),
  # cathedral -> hilltop grass -> off the hill's edge
  ('cathedral->hilltop', 'gm', 'probe', [C(12), C(0), 10], [C(8), C(0), 10], 'all'),
  ('cathedral->hilltop', 'gm', 'probe', [C(12), C(0), 10], [C(8), C(0), 10], 0),
  ('hilltop->plain', 'gm', 'probe', [C(8), C(0), 10], [C(4), C(0), 0], 'all'),
  ('plain->hilltop', 'gm', 'probe', [C(4), C(0), 0], [C(8), C(0), 10], 'all'),
  ('plain->hilltop', 'gm', 'probe', [C(4), C(0), 0], [C(8), C(0), 10], 0),
  # lv 2 across buildings: the hill's hallway (bld 1) to bld 2's upper mansion hall; and back down into the great hall
  ('hallway->upper-hall', 'gm', 'probe', [C(13), C(9), 10], [C(13), C(12), 10], 'all'),
  ('hallway->upper-hall', 'gm', 'probe', [C(13), C(9), 10], [C(13), C(12), 10], 10),
  ('upper-hall->greathall', 'gm', 'probe', [C(13), C(12), 10], [C(17), C(18), 0], 'all'),
  ('upper-hall->greathall', 'gm', 'probe', [C(13), C(12), 10], [C(17), C(18), 0], 10),
  # the grand stair (in the ground mansion hall, climbing north to the hill's hallway): onto its middle, from each end
  ('stair: lv1 foot->middle', 'gm', 'probe', [C(14), C(14), 0], [72.5, 57.5, 5], 'all'),
  ('stair: lv1 foot->middle', 'gm', 'probe', [C(14), C(14), 0], [72.5, 57.5, 5], 0),
  ('stair: lv2 top->middle', 'gm', 'probe', [C(14), C(9), 10], [72.5, 57.5, 5], 'all'),
  ('stair: lv2 top->middle', 'gm', 'probe', [C(14), C(9), 10], [72.5, 57.5, 5], 10),
  ('stair: foot->top exit', 'gm', 'probe', [C(14), C(14), 0], [C(14), C(9), 10], 'all'),
  ('stair: top->foot', 'gm', 'probe', [C(14), C(9), 10], [C(14), C(14), 0], 'all'),
  # the player, with Tony (fog of war on). (The first drag after the player's page loads does not start: a harness
  # matter, the same on the old code; a warm-up drag goes first and is not reported.)
  ('(player warm-up)', 'player', TONY, [C(17), C(18), 0], [C(16), C(19), 0], 'all'),
  ('player gh->cathedral', 'player', TONY, [C(17), C(18), 0], [C(15), C(2), 10], 'all'),
  ('player cathedral->cathedral', 'player', TONY, [C(12), C(0), 10], [C(17), C(4), 10], 0),
  ('player stair foot->middle', 'player', TONY, [C(14), C(14), 0], [72.5, 57.5, 5], 'all'),
  ('player across the cathedral hole', 'player', TONY, [C(10), C(0), 10], [C(19), C(0), 10], 'all'),
]
SHOT = {'gh->cathedral', 'stair: lv1 foot->middle', 'stair: lv2 top->middle', 'stair: foot->top exit', 'stair: top->foot', 'hilltop->plain', 'hallway->upper-hall', 'gh->mansion-under-upper', 'player across the cathedral hole'}

async def main():
    base, toks = start()
    out = []
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch(args=GL)
            for who in ('gm', 'player'):
                cases = [c for c in CASES if c[1] == who and (not A.only or A.only in c[0])]
                if not cases: continue
                ctx = await br.new_context(viewport={'width': 1400, 'height': 900}); pg = await ctx.new_page()
                errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
                await pg.goto(base + '#s=' + toks[GM if who == 'gm' else PL])
                await wait(pg, "window.tw && tw.sync && tw.sync.campaign && tw.area && tw.area()", 60000, 'joined')
                await pg.evaluate(f"tw.area() !== '{AREA}' && tw.setMain('{AREA}')")
                await wait(pg, f"tw.area() === '{AREA}' && Object.keys(tw.entities()).length > 20", 30000, 'area')
                await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", 90000, 'settled'); await pg.wait_for_timeout(800)
                if who == 'gm':
                    await pg.evaluate("tw.dispatch('token.create', { id: 'tok_lvprobe01', name: 'Probe', x: 87.5, z: 92.5, color: '#e8d46a' })")
                    await wait(pg, "!!tw.entities()['tok_lvprobe01'] && tw.sync.pendingCount() === 0", 8000)
                for (name, _, pawn, s, t, lv) in cases:
                    pid = 'tok_lvprobe01' if pawn == 'probe' else pawn
                    await pg.evaluate(f"tw.dispatch('token.move', {{ id: '{pid}', x: {s[0]}, z: {s[1]}, y: {s[2]} }})"); await wait(pg, 'tw.sync.pendingCount() === 0', 6000)
                    if lv == 'all': await pg.evaluate("tw.cutOff('test')")
                    else: await pg.evaluate(f"tw.goLevel({lv}, 'test')")
                    await pg.evaluate("tw.lastHop = null; tw.lastDrop = null; tw.select([]); tw.condButtons?.hide?.('cut-offer'); tw.condButtons?.hide?.('fall')") # (a docked offer under the press point would take the press)
                    await view(pg, (s[0] + t[0]) / 2, (s[1] + t[1]) / 2, 110, 74, 0, 5)
                    await pg.wait_for_timeout(400)
                    before = await pg.evaluate(f"({INFO})('{pid}')")
                    if os.environ.get('LV_DEBUG'): print('   before', before, await pg.evaluate(f"tw.canTouch(tw.entities()['{pid}'])"), await pg.evaluate(f"{W}.recs.get('{pid}')?.group.visible"))
                    a = await scr(pg, s[0], s[1], (before['base'] if before['base'] is not None else s[2]) + 0.3); b = await scr(pg, t[0], t[1], t[2])
                    seen = await mdrag(pg, a, b, 16, PEEK)
                    await wait(pg, 'tw.sync.pendingCount() === 0', 6000); await pg.wait_for_timeout(300)
                    after = await pg.evaluate(f"({INFO})('{pid}')")
                    dys = sorted({round(v['dy'], 2) for v in seen if v and v.get('dy') is not None})
                    if os.environ.get('LV_DEBUG'): print('   seen', seen)
                    row = { 'case': name, 'seat': who, 'view': lv, 'start_y': before['y'], 'end_y': after['y'], 'end_base': after['base'], 'end_room': after['roomType'], 'on': after['on'], 'level': after['level'], 'hidden': after['hidden'], 'hop': bool(after['hop']), 'fall_offer': after['fall'], 'drag_dys': dys, 'moved': [round(after['x'] - before['x'], 1), round(after['z'] - before['z'], 1)] }
                    if name.startswith('('): continue
                    out.append(row)
                    print(f"{name:28s} {who:6s} view={str(lv):4s} y {before['y']:>6} -> {after['y']:>6}  base {after['base']}  {after['roomType'] or '-':14s} on={after['on']} hop={row['hop']} fall={row['fall_offer']} dys={dys}", flush=True)
                    if A.shots and name in SHOT:
                        os.makedirs(A.shots, exist_ok=True); await pg.evaluate("tw.select([])")
                        await view(pg, after['x'], after['z'], 42, 50, 25, after['y']); await pg.wait_for_timeout(900)
                        await pg.screenshot(path=os.path.join(A.shots, f"{len(out):02d}-{who}-{name.replace(' ', '_').replace(':', '').replace('>', '')}-{lv}.png"))
                    await pg.keyboard.press('Escape')
                if errs: print('PAGE ERRORS', errs[:5])
                await ctx.close()
            await br.close()
    finally:
        for pr in procs: pr.terminate()
        for pr in procs:
            try: pr.wait(5)
            except Exception: pr.kill()
    if A.out: json.dump(out, open(A.out, 'w'), indent=1)
asyncio.run(main())

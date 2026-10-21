"""FLY-AWAY acceptance (2026-10-06): the Fly-away panel and the shared runner (js/fx/cutfly.js, js/anim.js) in the Spawn Tuner.
  F1  the panel builds (dials, the demo and cut tools, built-in looks, Send and Use in game)
  F2  the demo makes two levels; Cut sends the upper level away: staggered (not all at once), rising, gone (hidden)
      within the look's total time; the readout says how many pieces and how long
  F3  Cut again brings it back down the same way, to rest, whole
  F4  a second Cut mid-flight turns the pieces round where they are
  F5  order: "outward from the click" leaves nearest-first; "room by room" keeps a room's pieces together; stagger 0 is all at once
  F6  the look off: Cut hides and shows at once
  F7  presets: built-in load; "Use in game" stores the house fly-away (GET /tuner/house -> cutfly), in the test sandbox
  F8  idle costs nothing (the runner does not step); no page errors
python fly_ui.py BASE_URL OUTDIR [API_ORIGIN] [--gpu]
Writes go to the server's test sandbox (tests/tw_sandbox.py): the live house look is never touched.
(Until tw-ratings is restarted with the new house field, give it a copy of server/ratings_server.py on another port.)"""
import sys, time, json
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith('--')]
base, outdir = args[0].rstrip('/'), args[1]
api_origin = args[2] if len(args) > 2 else None
GPU = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
LAUNCH = GPU if '--gpu' in sys.argv else ['--no-sandbox']
os.makedirs(outdir, exist_ok=True)
ok = True
def check(name, cond, detail=''):
    global ok
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True); ok = ok and bool(cond)

UP = """(() => { const its = fx.items().filter(it => it.group && it._flyLift);
  return { n: its.length, visible: its.filter(it => it.group.visible).length, ys: its.map(it => +(it.group.position.y - it.rest.y).toFixed(3)), atRest: its.every(it => Math.abs(it.group.position.y - it.rest.y) < 1e-6) }; })()"""
SLOW = "(() => { const p = fx.params('cutfly'); p.time = { dur: 900, stagger: 900, back: 1 }; fx.setParams('cutfly', p); })()"
def setp(pg, js): pg.evaluate("(() => { const p = fx.params('cutfly'); " + js + "; fx.setParams('cutfly', p); })()")
def land(pg, t=8): 
    time.sleep(0.15); pg.wait_for_function("fx.stats().fly_active === 0", timeout=t * 1000); time.sleep(0.1)

with sync_playwright() as p:
    b = p.chromium.launch(args=LAUNCH)
    pg = b.new_page(viewport={'width': 1500, 'height': 950}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and 'favicon' not in m.text and errs.append(m.text[:300]))
    if api_origin: tw_sandbox.proxy(pg, api_origin)
    pg.add_init_script("try { localStorage.clear(); } catch (e) {}")
    pg.goto(f'{base}/index.html?nobg&seed=4242&atmos=clear&water=off')
    pg.wait_for_selector('body[data-ready="1"]', timeout=120000)
    pg.wait_for_function('!!window.fx && !!fx.cutfly && !!fx.flyTools', timeout=60000)

    dials = pg.evaluate("[...document.querySelectorAll('#fx-cutfly-dials [data-path]')].map(e => e.dataset.path)")
    builtins = pg.evaluate("[...document.querySelectorAll('#fx-cutfly-load option')].map(o => o.value).filter(v => v.startsWith('builtin:'))")
    P0 = pg.evaluate("fx.params('cutfly')")
    check('F1 the panel builds: dials, the demo and cut tools, four built-in looks, Send and Use in game', len(dials) == 9 and len(builtins) == 4 and pg.evaluate("!!document.querySelector('#fx-fly-demo') && !!document.querySelector('#fx-fly-cut') && !!document.querySelector('#fx-cutfly-house') && !!document.querySelector('#fx-cutfly-send')"), f'{len(dials)} dials; {builtins}')
    check('F1 the default look is the quick one: 350 ms end to end', P0['name'] == 'fly-quick' and P0['time']['dur'] + P0['time']['stagger'] == 350, json.dumps(P0['time']))

    pg.evaluate("void tuner.createRoom('common', 4, 3, 7, 5)"); pg.evaluate("void tuner.createRoom('kitchen', 11, 3, 5, 5)")
    pg.wait_for_function("tuner.rooms().length === 2", timeout=30000); time.sleep(14)
    pg.evaluate("(() => { tuner.cam.focus.set(52, 0, 28); tuner.cam.dist = 80; tuner.cam.pitch = 52; tuner.cam.update(); })()")
    s0 = pg.evaluate("fx.stats().fly_steps"); time.sleep(0.6)
    check('F8 idle: the runner does not step', pg.evaluate("fx.stats().fly_steps") == s0 and pg.evaluate("fx.stats().fly_active") == 0)

    # F2: leave, with the default look (timed in the page) and with a slow one (looked at part-way)
    pg.evaluate("fx.flyTools.demo(true)"); time.sleep(0.5)
    u0 = pg.evaluate(UP)
    check('F2 the demo lifts every second room: there is an upper level', u0['n'] > 10 and u0['visible'] == u0['n'] and u0['atRest'], f"{u0['n']} pieces upstairs")
    t = pg.evaluate("""(async () => { const t0 = performance.now(); fx.flyTools.cut(true); let t1 = null, gone = null, maxY = 0, slow = 0, last = t0;
      while (performance.now() - t0 < 4000) { await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); if (t1 == null) t1 = n; else slow = Math.max(slow, n - last); last = n; const u = """ + UP + """; maxY = Math.max(maxY, ...u.ys); if (!fx.stats().fly_active) { gone = n - t1; break; } }
      return { gone, slow, maxY, total: fx.stats().fly_total_ms }; })()""")
    u1 = pg.evaluate(UP)
    check('F2 Cut: the upper level rises and is gone (hidden) within the look\'s total time', t['gone'] is not None and t['gone'] <= t['total'] + 2 * t['slow'] + 40 and t['maxY'] > 30 and u1['visible'] == 0 and u1['atRest'], f"{t['gone'] and round(t['gone'])} ms of {round(t['total'])} ms, rose {t['maxY']:.0f} ft")
    time.sleep(0.4); txt = pg.evaluate("document.querySelector('#fx-fly-state').textContent")
    check('F2 the readout says how many pieces left and how long it took', f"{u0['n']} pieces left in" in txt and 'leaves in 350 ms' in txt, txt)
    pg.evaluate("fx.flyTools.cut(false)"); land(pg)
    pg.evaluate(SLOW); pg.evaluate("fx.flyTools.cut(true)"); time.sleep(0.6)
    mid = pg.evaluate(UP); moving = [y for y in mid['ys'] if y > 0.05]; waiting = [y for y in mid['ys'] if y <= 0.05]
    check('F2 NOT all at once: part-way, some pieces are rising and some have not left', len(moving) > 3 and len(waiting) > 3, f'{len(moving)} rising, {len(waiting)} waiting')
    pg.locator('#stage').screenshot(path=os.path.join(outdir, 'fly-mid.png'))

    # F4: turn round mid-flight
    j = pg.evaluate("""(async () => { const its = fx.items().filter(it => it.group), y0 = new Map(its.map(it => [it.group.uuid, it.group.position.y])); const turned0 = fx.stats().fly_turned;
      const air = its.filter(it => fx.cutfly.has(it.group.uuid) && fx.cutfly.progress(it.group.uuid) > 0); fx.flyTools.cut(false); let jump = 0; for (const it of air) jump = Math.max(jump, Math.abs(it.group.position.y - y0.get(it.group.uuid)));
      await new Promise(r => setTimeout(r, 250)); let down = 0, n = 0; for (const it of air) if (y0.get(it.group.uuid) - it.rest.y > 0.5) { n++; if (it.group.position.y < y0.get(it.group.uuid)) down++; }
      return { jump, down, n, turned: fx.stats().fly_turned - turned0 }; })()""")
    check('F4 Cut again mid-flight: the pieces in the air turn round where they are and come back down', j['jump'] < 0.01 and j['turned'] > 0 and j['n'] > 0 and j['down'] == j['n'], json.dumps(j))
    land(pg); u2 = pg.evaluate(UP)
    check('F3 back: every upper piece is drawn, at rest', u2['visible'] == u0['n'] and u2['atRest'], f"{u2['visible']} of {u0['n']}")
    pg.evaluate("fx.flyTools.cut(true)"); land(pg); pg.evaluate("fx.flyTools.cut(false)"); time.sleep(0.5)
    back = pg.evaluate(UP)
    check('F3 Cut from away: the level is drawn again at once, high above, on its way down', back['visible'] == u0['n'] and max(back['ys']) > 20, f"highest {max(back['ys']):.0f} ft")
    land(pg); check('F3 and lands whole', pg.evaluate(UP)['atRest'])

    # F5: order (pure: the schedule itself)
    sch = pg.evaluate("""(async () => { const A = await import('./js/anim.js'); const items = []; for (let i = 0; i < 40; i++) items.push({ x: i * 2, z: 0, room: i < 20 ? 'a' : 'b' });
      const P = (by, jitter, stagger = 150) => ({ time: { dur: 200, stagger, back: 1 }, order: { by, jitter }, move: A.FLY_DEFAULTS.move });
      const click = A.flySchedule(items, P('click', 0), [0, 0], Math.random).delays, room = A.flySchedule(items, P('room', 0), [0, 0], Math.random).delays, all = A.flySchedule(items, P('click', 0.3, 0), [0, 0], Math.random).delays, rnd = A.flySchedule(items, P('random', 0), null, Math.random).delays;
      const one = A.flySchedule(items.map(it => ({ ...it, x: 5, z: 5 })), P('click', 0), [5, 5], Math.random).delays;
      return { clickMono: click.every((d, i) => i === 0 || d >= click[i - 1]), clickSpan: [Math.min(...click), Math.max(...click)], roomA: new Set(room.slice(0, 20)).size, roomB: new Set(room.slice(20)).size, roomGap: room[20] - room[0], all: Math.max(...all), rndSpan: [Math.min(...rnd), Math.max(...rnd)], oneSpot: new Set(one.map(d => Math.round(d))).size, pose: [A.flyPose(P('click', 0), 0).dy, A.flyPose(P('click', 0), 1).dy, A.flyTotal(P('click', 0))] }; })()""")
    check('F5 "outward from the click": nearest first, the first at 0 and the last at the stagger', sch['clickMono'] and sch['clickSpan'] == [0, 150], json.dumps(sch['clickSpan']))
    check('F5 "room by room": a room\'s pieces share their turn, the far room last', sch['roomA'] == 1 and sch['roomB'] == 1 and sch['roomGap'] == 150)
    check('F5 stagger 0 is all at once; random spans the stagger; pieces on one spot still scatter', sch['all'] == 0 and sch['rndSpan'] == [0, 150] and sch['oneSpot'] > 5, json.dumps([sch['all'], sch['rndSpan'], sch['oneSpot']]))
    check('F5 the pose: at rest at 0, the rise height at 1; total = stagger + one piece', sch['pose'] == [0, 70, 350], json.dumps(sch['pose']))

    # F6: off
    pg.evaluate("document.querySelector('details[data-key=cutfly]').open = true"); pg.uncheck('#fx-fly-on'); time.sleep(0.2)
    b0 = pg.evaluate("fx.stats().fly_batches"); pg.evaluate("fx.flyTools.cut(true)"); a = pg.evaluate(UP); pg.evaluate("fx.flyTools.cut(false)"); c = pg.evaluate(UP)
    check('F6 the look off: Cut hides and shows at once, nothing flies', a['visible'] == 0 and c['visible'] == u0['n'] and c['atRest'] and pg.evaluate("fx.stats().fly_batches") == b0 and pg.evaluate("fx.params('cutfly').on") is False)
    pg.check('#fx-fly-on'); time.sleep(0.2)

    # F7: presets and the house look
    pg.select_option('#fx-cutfly-load', 'builtin:showy'); time.sleep(0.3); g = pg.evaluate("fx.params('cutfly')")
    if api_origin:
        pg.fill('#fx-cutfly-name', 'acceptance fly'); pg.click('#fx-cutfly-house'); time.sleep(1.2)
        house = pg.evaluate("fetch('/api/tw-ratings/tuner/house', { cache: 'no-store' }).then(r => r.json())")
        state = pg.evaluate("document.querySelector('[data-house=cutfly] .houseState').textContent")
        check('F7 built-in load; "Use in game" stores the house fly-away (GET /tuner/house -> cutfly), sandboxed, and the panel says the game uses it', g['time']['dur'] == 520 and g['order']['by'] == 'room' and (house.get('cutfly') or {}).get('name') == 'fly-acceptance fly' and house['cutfly']['time']['stagger'] == 900 and 'exactly this' in state, f"house: {(house.get('cutfly') or {}).get('name')} | {state}")
    else:
        check('F7 built-in load (no API given: house look not checked)', g['time']['dur'] == 520 and g['order']['by'] == 'room')
    pg.evaluate("fx.flyTools.cut(true)"); time.sleep(0.9); pg.locator('#stage').screenshot(path=os.path.join(outdir, 'fly-showy-mid.png')); land(pg, 12)
    pg.evaluate("fx.flyTools.demo(false)"); time.sleep(0.4)
    its = pg.evaluate("(() => { const its = fx.items().filter(it => it.group && it.rest); return { all: its.every(it => it.group.visible), ground: its.every(it => !(it._flyLift)) }; })()")
    check('F8 demo off: every room back on the ground, drawn', its['all'] and its['ground'], json.dumps(its))
    s0 = pg.evaluate("fx.stats().fly_steps"); time.sleep(0.5)
    check('F8 idle again: the runner does not step', pg.evaluate("fx.stats().fly_steps") == s0)
    check('F8 no page errors', not errs, '; '.join(errs[:3]))
    b.close()
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)

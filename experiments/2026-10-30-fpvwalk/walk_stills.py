#!/usr/bin/env python3
"""Stills of walking in first person, for the vision critic (2026-10-30). The inn of walk_stuck.py (seed 101, doors open);
three walks, a frame every --every ms while W is held:
  door     common room -> hallway, aimed straight at the hallway's middle (the line clips the doorway's jamb)
  wall     along the common room's south wall, aimed a foot into it (the slide)
  map      the GM's map view of the same doorway walk (the pawn glides, as the other seats see it)
  TW_PORTS=a,b python3 experiments/2026-10-30-fpvwalk/walk_stills.py --out DIR
"""
import argparse, json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser(); ap.add_argument('--out', required=True); ap.add_argument('--every', type=int, default=220); ap.add_argument('--n', type=int, default=6); A = ap.parse_args()
sys.argv = [sys.argv[0]]
src = open(os.path.join(HERE, 'walk_stuck.py')).read(); g = {'__file__': os.path.join(HERE, 'walk_stuck.py'), '__name__': 'stills'}
exec(compile(src.split('def main():')[0], 'walk_stuck', 'exec'), g)
from playwright.sync_api import sync_playwright
os.makedirs(A.out, exist_ok=True); url = g['start']()
try:
  with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=g['ARGS']); pg = b.new_page(viewport={'width': 1280, 'height': 800}); pg.goto(url, timeout=180000)
    pg.fill('#newCampaign input[name=gm]', 'Harry'); pg.fill('#newCampaign input[name=name]', 'TEST fpv stills (throwaway)'); pg.click('#newCampaign button')
    pg.wait_for_function('window.tw && tw.ready && tw.ready() && tw.fpv', timeout=240000)
    pg.evaluate("(() => { const g = tw.main.grab; g.focus.set(40, 0, 40); g.dist = 120; g.update(); })()")
    pg.evaluate("tw.buildAt(tw.buildingNode('inn'), 12, 10, { seed: 101 })"); pg.wait_for_function("tw.sync.pendingCount() === 0", timeout=120000)
    pg.wait_for_function("tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", timeout=600000)
    pg.evaluate("""(() => { for (const e of [...tw.worldOf(tw.area()).edges.values()]) if (e.kind === 'door' && !e.open) { const it = tw.wallItem?.('wall:' + e.key); if (it) tw.toggleOpen(it); } })()""")
    pg.wait_for_function("tw.sync.pendingCount() === 0", timeout=60000); time.sleep(1); pg.evaluate("tw.condButtons?.hide?.('stair-offer')")
    pg.evaluate("tw.dispatch('token.create', { id: 'tok_walker001', name: 'Mira', x: 52.5, z: 47.5, rot: 0, fig: 'hero-fighter-elf-f' })"); pg.wait_for_function("tw.sync.pendingCount() === 0")
    rt = json.load(open(os.path.join(HERE, 'routes-inn-101.json')))
    STEER = """(route) => { window.__k = 0; clearInterval(window.__steer); window.__steer = setInterval(() => { const i = tw.fpv.info(); if (!i) return; const a = route.aims[window.__k]; if (!a) { tw.fpv.letGo(); clearInterval(window.__steer); return; }
      const d = Math.hypot(a[0] - i.eye[0], a[1] - i.eye[2]); if (d < 3) { window.__k++; return; } tw.fpv.setLook(Math.atan2(a[0] - i.eye[0], a[1] - i.eye[2]) * 180 / Math.PI, -4); }, 30); tw.fpv.hold('w'); }"""
    # the observer's drawn pawn, every frame (how smoothly the others see it go)
    TRACK = """() => { window.__tr = []; window.__trOn = true; const f = (now) => { const r = tw.worldOf(tw.area()).recs.get('tok_walker001'); if (r) window.__tr.push([now, r.group.position.x, r.group.position.z]); if (window.__trOn) requestAnimationFrame(f); }; requestAnimationFrame(f); }"""
    TRACKED = """() => { window.__trOn = false; const p = window.__tr, v = []; for (let i = 1; i < p.length; i++) { const dt = (p[i][0] - p[i - 1][0]) / 1000; if (dt > 0) v.push(Math.hypot(p[i][1] - p[i - 1][1], p[i][2] - p[i - 1][2]) / dt); }
      const m = v.filter(x => x > 0.5).sort((a, b) => a - b), q = (k) => m.length ? +m[Math.floor(k * (m.length - 1))].toFixed(2) : null; return { frames: p.length, moving: m.length, speed: { p5: q(0.05), med: q(0.5), p95: q(0.95), max: q(1) }, still: v.length - m.length }; }"""
    def walk(name, route, frames=True, back=0):
        f = route['from']; pg.evaluate("tw.fpv.exit()")
        a = route['aims'][-1]
        if back:  # start further back along the first leg (so the first frames are before the doorway)
            a0 = route['aims'][0]; L = __import__('math').hypot(a0[0] - f[0], a0[1] - f[1]); f = [f[0] - (a0[0] - f[0]) / L * back, f[1] - (a0[1] - f[1]) / L * back, f[2]]
        pg.evaluate(f"tw.dispatch('token.move', {{ id: 'tok_walker001', x: {f[0]}, z: {f[1]}, y: 0 }})"); pg.wait_for_function("tw.sync.pendingCount() === 0")
        if frames: look = pg; pg.evaluate("tw.fpv.enter('tok_walker001')"); time.sleep(1.5)
        else:
            look = pg2; pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({(f[0] + a[0]) / 2}, 0, {(f[1] + a[1]) / 2}); g.yaw = -25; g.pitch = 55; g.dist = 70; g.update(); tw.main.rule = 'free'; }})()"); time.sleep(1.5)
            pg2.evaluate("tw.fpv.enter('tok_walker001')"); time.sleep(1.2); pg.evaluate(TRACK)
        a0 = route['aims'][0]; look.evaluate(f"tw.fpv.setLook({__import__('math').degrees(__import__('math').atan2(a0[0] - f[0], a0[1] - f[1]))}, -4)"); time.sleep(0.4)
        look.evaluate(STEER, route)
        for i in range(A.n):
            time.sleep(A.every / 1000); pg.screenshot(path=os.path.join(A.out, f'{name}-{i}.png'))
        time.sleep(1.0); look.evaluate("tw.fpv.letGo(); clearInterval(window.__steer)"); time.sleep(0.8)
        print(name, json.dumps(look.evaluate("tw.fpv.info()")['eye']), flush=True)
        if not frames: print('observer', json.dumps(pg.evaluate(TRACKED)), flush=True); pg2.evaluate("tw.fpv.exit()")
    door = next(r for r in rt if r['name'] == 'door v:7:7: common -> hallway')
    wall = next(r for r in rt if r['name'] == 'along common south wall')
    walk('door', door); walk('wall', {**wall, 'aims': [[wall['aims'][0][0] - 6, wall['aims'][0][1], 0]]})
    # the GM's map of the doorway walk, with the player tab walking (a second page as the same GM: the drawn pawn, not the eyes)
    pg.evaluate("tw.fpv.exit()"); pg2 = b.new_page(viewport={'width': 1000, 'height': 700}); pg2.goto(pg.url, timeout=180000); pg2.wait_for_function('window.tw && tw.ready && tw.ready() && tw.fpv', timeout=240000); time.sleep(2)
    walk('map', door, frames=False)
finally:
    for pr in g['procs']: pr.terminate()

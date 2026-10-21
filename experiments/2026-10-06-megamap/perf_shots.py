#!/usr/bin/env python3
"""Does a fix change the picture? Stills of the same instant with a switch off (A), on (B) and off again (A2), time
standing still (tw.freezeTime), at views chosen for see-through things: a hearth and candles, the conservatory's glass,
the crypt chapel's stained glass, a pond and a river with a pawn standing in it, a selected thing, the house fog, and
the fog sea. Reports pixel differences A:B next to A:A2 (the noise between two pictures of one frozen instant).
  python3 perf_shots.py --data <relay data dir> --rooms 52 --flags aoList --outdir <dir> [--base k=v]
Pictures stay on the box (the repo does not track images); numbers go to results/fixes.jsonl."""
import argparse, json, os, sys, time
import numpy as np
from PIL import Image
import mm, layout
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--rooms', type=int, default=52); ap.add_argument('--flags', required=True); ap.add_argument('--base', default=''); ap.add_argument('--outdir', required=True)
ap.add_argument('--out', default='results/fixes.jsonl'); ap.add_argument('--tag', default=''); ap.add_argument('--shed', action='store_true', help="what the picture loses while the hand moves: stills with each stage of engine/client/interact.js held on, at the default and quarter views, and after they are put back")
ap.add_argument('--std', action='store_true', help='the three standard views of the big-map measurements (default, a quarter of the map, the whole map) instead of the see-through set')
ap.add_argument('--moving', action='store_true', help='time runs (no freeze): for looks that only exist in motion')
A = ap.parse_args(); os.makedirs(A.outdir, exist_ok=True)
B = [json.loads(l) for l in open(os.environ.get('BUILD_JSONL', 'results/build.jsonl'))]; B = [b for b in B if b.get('counts', {}).get('room') == A.rooms][-1]
rs, lots = layout.rooms(B['asked']); FLAGS = A.flags.split(','); BASE = dict((k, v not in ('0', 'false', 'off')) for k, v in (kv.split('=') for kv in A.base.split(',') if kv))
lot = lambda name: next(l for l in lots if l['name'] == name)
def diff(a, b):
    x = np.asarray(Image.open(a).convert('RGB'), dtype=np.int16); y = np.asarray(Image.open(b).convert('RGB'), dtype=np.int16); d = np.abs(x - y).max(axis=2)
    return {'mean': round(float(d.mean()), 4), 'max': int(d.max()), 'pct_over_2': round(float((d > 2).mean() * 100), 3), 'pct_over_8': round(float((d > 8).mean() * 100), 3)}
def main():
    out = {'script': 'perf_shots', 'rooms': A.rooms, 'flags': FLAGS, 'base': BASE, 'tag': A.tag, 'frozen': not A.moving, 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'views': {}}
    mm.start_local(A.data)
    with sync_playwright() as p:
        browser, ctx, pg, errors, t = mm.open_game(p, token=B['token'], uncapped=False)
        inn, wing, crypt = lot('inn'), lot('wing'), lot('crypt')
        if A.shed:
            ext = B['extent']; SPAN = max(ext['w'], ext['d']); C = (lots[0]['x'] + 40, lots[0]['z'] + 22)
            pg.evaluate(mm.cam_js(*C, 110)); mm.wait_settled(pg, timeout=3600); pg.wait_for_timeout(3000); mm.wait_seated(pg, 240); pg.evaluate("tw.main.grab.maxDist = 3000")
            stages = pg.evaluate('tw.interact.STAGES')
            for name, c, dist in (('default', C, 110), ('quarter', C, max(110, SPAN * 0.5)), ('whole', (ext['cx'], ext['cz']), max(110, SPAN * 1.15))):
                pg.evaluate(mm.cam_js(c[0], c[1], dist)); pg.mouse.move(5, 5); pg.wait_for_timeout(4000); pg.evaluate('tw.freezeTime(true)'); files = {}; res = {}
                def snap(tag, hold):
                    pg.evaluate('(n) => tw.interact.hold(n)', hold); pg.wait_for_timeout(1500); files[tag] = os.path.join(A.outdir, f'{name}-{tag}.png'); pg.screenshot(path=files[tag])
                    return pg.evaluate("(() => { const w = tw.worldOf(tw.area()); return { napping: w.sleepStats().napping, shed: tw.interact.info().shed }; })()")
                res['full'] = snap('0-full', None); res['full2'] = snap('0-full-again', None)
                for i in range(len(stages) - 1): res[stages[i]] = snap(f'{i + 1}-{stages[i]}', stages[:i + 1])
                res['restored'] = snap('9-restored', None); pg.evaluate('tw.freezeTime(false)')
                out['views'][name] = {'noise': diff(files['0-full'], files['0-full-again']), 'restored_vs_full': diff(files['0-full'], files['9-restored']), **{f'{i + 1}-{stages[i]}': {**diff(files['0-full'], files[f'{i + 1}-{stages[i]}']), **res[stages[i]]} for i in range(len(stages) - 1)}}
                mm.say(name, json.dumps(out['views'][name]))
            out['errors'] = [e for e in errors if '404' not in e][:8]; browser.close()
            open(A.out, 'a').write(json.dumps(out) + '\n'); return
        if A.std:
            ext = B['extent']; SPAN = max(ext['w'], ext['d']); C = (lots[0]['x'] + 40, lots[0]['z'] + 22)
            pg.evaluate(mm.cam_js(*C, 110)); mm.wait_settled(pg, timeout=3600); pg.wait_for_timeout(3000); pg.evaluate("tw.main.grab.maxDist = 3000")
            def shoot(name, c, dist):
                pg.evaluate(mm.cam_js(c[0], c[1], dist)); pg.mouse.move(5, 5); pg.wait_for_timeout(4000 if not A.moving else 2500)
                if not A.moving: pg.evaluate('tw.freezeTime(true)')
                files = {}
                for tag, on in (('A', False), ('B', True), ('A2', False)):
                    pg.evaluate('(p) => tw.perf.set(p)', {**BASE, **{k: on for k in FLAGS}}); pg.wait_for_timeout(2600)
                    files[tag] = os.path.join(A.outdir, f'{name}-{tag}.png'); pg.screenshot(path=files[tag])
                    if tag == 'B': asleep = pg.evaluate("tw.worldOf(tw.area()).sleepStats?.().asleep.length ?? null")
                pg.evaluate('tw.freezeTime(false)')
                out['views'][name] = {'A_vs_B': diff(files['A'], files['B']), 'A_vs_A2_noise': diff(files['A'], files['A2']), 'asleep_in_B': asleep}; mm.say(name, json.dumps(out['views'][name]))
            shoot('default', C, 110); shoot('quarter', C, max(110, SPAN * 0.5)); shoot('whole', (ext['cx'], ext['cz']), max(110, SPAN * 1.15))
            out['errors'] = [e for e in errors if '404' not in e][:8]; browser.close()
            open(A.out, 'a').write(json.dumps(out) + '\n'); print(json.dumps(out['views'], indent=1)); return
        pg.evaluate(mm.cam_js(inn['x'] + 40, inn['z'] + 22, 110)); mm.wait_settled(pg, timeout=3600); pg.wait_for_timeout(3000)
        # water in the street beside the inn, a pawn wading in it, and something selected
        sx, sz = inn['x'] + 26, inn['z'] + 60  # the open ground of the inn's lot, south of the house
        pg.evaluate(f"tw.dispatch('water.set', {{ id: 'wat_perfshots1', body: {{ kind: 'pond', pts: [[{sx - 14}, {sz - 5}], [{sx + 2}, {sz - 6}], [{sx + 4}, {sz + 4}], [{sx - 12}, {sz + 5}]], depth: 2 }} }})")
        pg.evaluate(f"tw.dispatch('water.set', {{ id: 'wat_perfshots2', body: {{ kind: 'channel', pts: [[{sx + 8}, {sz - 6}], [{sx + 30}, {sz - 4}], [{sx + 60}, {sz - 7}]], width: 6, depth: 2, flow: 2 }} }})")
        pg.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_perfshots1', name: 'Wader', x: {sx - 5}, z: {sz} }})"); pg.wait_for_timeout(1500)
        pg.evaluate("(() => { const w = tw.worldOf(tw.area()).fx, p = w.params('water'); if (!p.on) w.setParams('water', { name: 'clear-stream' }); })()")
        table = pg.evaluate("(() => { const e = Object.values(tw.entities()).find(e => e.kind === 'object' && /table/.test(e.cat || '') && (e.y || 0) < 1); return e ? e.id : null; })()")
        def shoot(name, setup=None):
            if setup: setup()
            pg.mouse.move(5, 5); pg.wait_for_timeout(2500)
            if not A.moving: pg.evaluate('tw.freezeTime(true)')
            files = {}
            for tag, on in (('A', False), ('B', True), ('A2', False)):
                pg.evaluate('(p) => tw.perf.set(p)', {**BASE, **{k: on for k in FLAGS}}); pg.wait_for_timeout(1500)
                files[tag] = os.path.join(A.outdir, f'{name}-{tag}.png'); pg.screenshot(path=files[tag])
            pg.evaluate('tw.freezeTime(false)')
            st = pg.evaluate("(() => { const s = tw.worldOf(tw.area()).fx.stats(); return { see_through: s.ao_see_through, aware: s.ao_aware, flames: tw.fxFlames(), water: s.water_bodies }; })()")
            out['views'][name] = {'A_vs_B': diff(files['A'], files['B']), 'A_vs_A2_noise': diff(files['A'], files['A2']), **st}
            mm.say(name, json.dumps(out['views'][name]))
        cam = lambda c, d, pitch=55, yaw=0: pg.evaluate(mm.cam_js(c[0], c[1], d, pitch, yaw))
        shoot('inn-fire-water', lambda: (cam((inn['x'] + 36, inn['z'] + 34), 115), pg.evaluate(f"tw.sel.clear(); {'tw.sel.add(' + json.dumps(table) + ');' if table else ''} tw.refresh()")))
        shoot('inn-close-hearth', lambda: cam((inn['x'] + 15, inn['z'] + 12), 45, 48, 25))
        shoot('wing-conservatory-glass', lambda: (pg.evaluate('tw.sel.clear(); tw.refresh()'), cam((wing['x'] + 14, wing['z'] + 12), 60, 45, -30)))
        shoot('crypt-chapel', lambda: cam((crypt['x'] + 30, crypt['z'] + 18), 70, 50, 20))
        shoot('whole-map', lambda: (pg.evaluate("tw.main.grab.maxDist = 2000"), cam((B['extent']['cx'], B['extent']['cz']), max(B['extent']['w'], B['extent']['d']) * 1.15)))
        shoot('fog-sea-inn', lambda: (pg.evaluate("(() => { const fx = tw.worldOf(tw.area()).fx, p = fx.params('atmos'); fx.setParams('atmos', { ...p, world: { ...p.world, unbuilt: 0.75 } }); })()"), cam((inn['x'] + 36, inn['z'] + 8), 140)))
        for cmd in ("tw.dispatch('water.remove', { id: 'wat_perfshots1' })", "tw.dispatch('water.remove', { id: 'wat_perfshots2' })", "tw.dispatch('token.delete', { id: 'tok_perfshots1' })"): pg.evaluate(cmd)
        pg.wait_for_timeout(1500); out['left'] = pg.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'water' || e.kind === 'token').length")
        out['errors'] = [e for e in errors if '404' not in e][:8]
        browser.close()
    open(A.out, 'a').write(json.dumps(out) + '\n'); print(json.dumps(out['views'], indent=1))
try: main()
finally: mm.stop()

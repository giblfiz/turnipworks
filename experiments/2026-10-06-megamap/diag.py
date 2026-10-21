import sys, json, time, collections
import mm, layout
from playwright.sync_api import sync_playwright
B = [json.loads(l) for l in open('results/build.jsonl')]; B = [b for b in B if b.get('counts', {}).get('room') == int(sys.argv[2])][-1]
rs, lots = layout.rooms(B['asked']); C = (lots[0]['x'] + 40, lots[0]['z'] + 22)
mm.start_local(sys.argv[1])
try:
    with sync_playwright() as p:
        b, ctx, pg, errors, t = mm.open_game(p, token=B['token'])
        pg.evaluate(mm.cam_js(*C, 110)); mm.wait_settled(pg, 600); pg.wait_for_timeout(3000)
        for k in range(3):
            o = mm.others_gpu(); m = pg.evaluate(mm.MEASURE_JS, 3000); d = m['dts']
            h = collections.Counter(int(x // 2) * 2 for x in d)
            print('others', o, mm.others_gpu(), 'n', len(d), sorted(h.items()))
        # the cost of the frame function itself (CPU side), by wrapping requestAnimationFrame callbacks
        print(pg.evaluate("""() => new Promise(res => { const raf = window.requestAnimationFrame; const ts = []; let n = 0;
          window.requestAnimationFrame = (cb) => raf((t) => { const a = performance.now(); cb(t); ts.push(performance.now() - a); });
          setTimeout(() => { window.requestAnimationFrame = raf; ts.sort((a, b) => a - b); res({ n: ts.length, median_cb_ms: ts[ts.length >> 1], p95: ts[Math.floor(ts.length * .95)] }); }, 4000); })"""))
        b.close()
finally: mm.stop()

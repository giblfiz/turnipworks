#!/usr/bin/env python3
"""Build one rung of the ladder through the game's own room.spawn (tw.spawnRoom in a GM tab), on the LOCAL relay.

  python3 build.py --data <relay data dir> 10 25 50 ...
Appends one JSON line per size to results/build.jsonl (per-room build times, totals, relay CPU/memory, journal size, the GM
token the later scripts join with). The relay keeps running only for the length of this script; its data folder stays.
"""
import argparse, glob, json, os, sys, time
import mm, layout
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('sizes', nargs='+', type=int); ap.add_argument('--data', required=True); ap.add_argument('--out', default='results/build.jsonl')
A = ap.parse_args()
SPAWN = """([t,x,z,w,d,seed,y]) => { const said = []; const t0 = tw.toast; tw.toast = (m, bad) => { if (bad) said.push(String(m)); return t0(m, bad); };
  let id = null, err = null; const a = performance.now(); try { id = tw.spawnRoom(t, x, z, w, d, seed, undefined, y); } catch (e) { err = String(e && e.message || e); } tw.toast = t0;
  return { id, said, err, solve_ms: performance.now() - a }; }"""
def dir_size(d): return sum(os.path.getsize(f) for f in glob.glob(os.path.join(d, '**'), recursive=True) if os.path.isfile(f))
mm.start_local(A.data)
try:
    with sync_playwright() as p:
        for n in A.sizes:
            rs, lots = layout.rooms(n); ext = layout.extent(rs); name = f'TEST megamap {len(rs)} rooms (throwaway)'
            size0 = dir_size(A.data); cpu0, rss0 = mm.proc_stat(mm.relay_pid())
            b, ctx, pg, errors, t_up = mm.open_game(p, campaign=name)
            token = pg.evaluate("new URLSearchParams(location.hash.slice(1)).get('s')")
            pg.evaluate(mm.cam_js(ext['cx'], ext['cz'], 150))
            out = {'asked': n, 'campaign': name, 'token': token, 'extent': ext, 'buildings_planned': len(lots), 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z')}
            per = []; failed = []; t0 = time.time(); crashed = None
            for i, r in enumerate(rs):
                a = time.time()
                try:
                    res = pg.evaluate(SPAWN, list(r[:7]))
                    if res['id'] is None or res['err']: failed.append([i, r[0], res['err'] or res['said']]); continue
                    pg.wait_for_function(f"!!tw.entities()['{res['id']}'] && tw.sync.pendingCount() === 0", timeout=120000, polling=20)
                    if res['said']: failed.append([i, r[0], res['said']])
                    per.append([round(time.time() - a, 3), round(res['solve_ms'], 1)])
                except Exception as e:
                    failed.append([i, r[0], str(e)[:200]])
                    if 'crash' in str(e).lower() or 'closed' in str(e).lower(): crashed = f'at room {i}: {str(e)[:200]}'; break
                if i % 50 == 49: mm.say(f'  {n}: {i + 1}/{len(rs)} rooms, {time.time() - t0:.0f} s, last room {per[-1] if per else None}')
            out['build_s'] = round(time.time() - t0, 1); out['crashed'] = crashed
            if not crashed:
                ok, s, st = mm.wait_settled(pg, timeout=3600)
                out.update(settled=ok, settle_after_build_s=s, meshes=st.get('meshes'), counts=pg.evaluate(mm.COUNTS_JS),
                           stairs=pg.evaluate("Object.values(tw.entities()).filter(e => e.place === 'stair').length"),
                           heap_mb=round(pg.evaluate('performance.memory.usedJSHeapSize') / 1e6), lost=pg.evaluate(mm.GPU_JS)['lost'])
                pg.evaluate(mm.cam_js(ext['cx'], ext['cz'], min(400, max(ext['w'], ext['d']) * 1.2))); pg.wait_for_timeout(1500)
                pg.screenshot(path=f'results/built-{len(rs)}.png')
            k = max(1, len(per) // 10)
            out['per_room_s_first_tenth'] = round(sum(x[0] for x in per[:k]) / k, 3) if per else None
            out['per_room_s_last_tenth'] = round(sum(x[0] for x in per[-k:]) / k, 3) if per else None
            out['solve_ms_first_tenth'] = round(sum(x[1] for x in per[:k]) / k, 1) if per else None
            out['solve_ms_last_tenth'] = round(sum(x[1] for x in per[-k:]) / k, 1) if per else None
            out['failed'] = failed[:20]; out['failed_n'] = len(failed)
            cpu1, rss1 = mm.proc_stat(mm.relay_pid())
            out['relay'] = {'cpu_s': round(cpu1 - cpu0, 2), 'rss_mb_before': rss0, 'rss_mb_after': rss1, 'disk_bytes_added': dir_size(A.data) - size0}
            out['errors'] = [e for e in errors if '404' not in e][:8]
            try: b.close()
            except Exception: pass
            open(A.out, 'a').write(json.dumps(out) + '\n')
            mm.say(json.dumps({k: v for k, v in out.items() if k not in ('token', 'extent')}))
finally: mm.stop()

#!/usr/bin/env python3
"""Build a rung through the relay's GET API (the door an LLM seat uses), no browser: the relay furnishes each room itself.

  python3 build_get.py --data <relay data dir> --port 18213 400 800
Used for the two largest rungs, because building through a GM tab slows down with every room (see README, "Build").
Appends to results/build.jsonl (same shape as build.py, 'via': 'GET').
"""
import argparse, glob, json, os, subprocess, sys, time, urllib.parse, urllib.request
import layout
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
ap = argparse.ArgumentParser(); ap.add_argument('sizes', nargs='+', type=int); ap.add_argument('--data', required=True); ap.add_argument('--port', type=int, default=18213); ap.add_argument('--out', default='results/build.jsonl')
A = ap.parse_args(); R = f'http://127.0.0.1:{A.port}'
def say(*a): print(*a, file=sys.stderr, flush=True)
def stat(pid):
    f = open(f'/proc/{pid}/stat').read().rsplit(')', 1)[1].split(); return (int(f[11]) + int(f[12])) / os.sysconf('SC_CLK_TCK'), round(int(open(f'/proc/{pid}/statm').read().split()[1]) * os.sysconf('SC_PAGE_SIZE') / 1e6, 1)
def dir_size(d): return sum(os.path.getsize(f) for f in glob.glob(os.path.join(d, '**'), recursive=True) if os.path.isfile(f))
def get(url, timeout=600): return json.loads(urllib.request.urlopen(url, timeout=timeout).read())
os.makedirs(A.data, exist_ok=True)
relay = subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(A.port), 'DATA_DIR': A.data, 'ORIENT_API': ''}, stdout=open(os.path.join(A.data, 'relay.log'), 'a'), stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'{R}/health', timeout=1); break
        except Exception: pass
    for n in A.sizes:
        rs, lots = layout.rooms(n); ext = layout.extent(rs); name = f'TEST megamap {len(rs)} rooms (throwaway)'
        size0 = dir_size(A.data); cpu0, rss0 = stat(relay.pid)
        c = json.loads(urllib.request.urlopen(urllib.request.Request(f'{R}/campaigns', data=json.dumps({'name': name, 'gm': 'Fauna-megamap'}).encode(), method='POST')).read())
        if not c.get('ok'): say('could not create', c); continue
        base = f"{R}/c/{c['campaign']}/a/{c['area']}/do"; tok = c['token']
        out = {'asked': n, 'via': 'GET', 'campaign': name, 'token': tok, 'extent': ext, 'buildings_planned': len(lots), 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z')}
        per = []; failed = []; t0 = time.time(); stairs = 0
        for i, r in enumerate(rs):
            q = {'cmd': 'room.spawn', 'type': r[0], 'x': r[1] * 5, 'z': r[2] * 5, 'w': r[3] * 5, 'd': r[4] * 5, 'seed': r[5], 'nonce': f'mm{n}-{i}', 'seat': tok}
            if r[6]: q['y'] = r[6]
            a = time.time()
            try:
                res = get(base + '?' + urllib.parse.urlencode(q))
                if not res.get('ok'): failed.append([i, r[0], str(res)[:200]])
                elif res.get('stair'): stairs += 1
                if i == 0: say('first answer:', str(res)[:400])
            except Exception as e:
                body = e.read().decode()[:200] if hasattr(e, 'read') else ''; failed.append([i, r[0], f'{e} {body}'])
            per.append(round(time.time() - a, 3))
            if i % 50 == 49: say(f'  {n}: {i + 1}/{len(rs)} rooms, {time.time() - t0:.0f} s, last room {per[-1]} s, failed {len(failed)}')
        k = max(1, len(per) // 10); cpu1, rss1 = stat(relay.pid)
        out.update(build_s=round(time.time() - t0, 1), per_room_s_first_tenth=round(sum(per[:k]) / k, 3), per_room_s_last_tenth=round(sum(per[-k:]) / k, 3), stairs=stairs,
                   counts={'room': len(rs) - len(failed)}, failed=failed[:20], failed_n=len(failed), per_room_s_every_25=per[::25],
                   relay={'cpu_s': round(cpu1 - cpu0, 2), 'rss_mb_before': rss0, 'rss_mb_after': rss1, 'disk_bytes_added': dir_size(A.data) - size0})
        open(A.out, 'a').write(json.dumps(out) + '\n'); say(json.dumps({k: v for k, v in out.items() if k not in ('token', 'extent')}))
finally:
    relay.terminate()
    try: relay.wait(60)
    except Exception: relay.kill()

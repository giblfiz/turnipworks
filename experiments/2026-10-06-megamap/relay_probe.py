#!/usr/bin/env python3
"""What the relay does with a big map, with no browser: boot time (journal load), memory, the size and time of GET state,
and the cost of one more room.spawn, with node's CPU profile of where that time goes.

  python3 relay_probe.py --data <a COPY of the relay data dir> --rooms 802 [--port 18215]
Works on a copy because it adds three rooms (and removes nothing).
"""
import argparse, glob, json, os, subprocess, sys, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--rooms', type=int, required=True); ap.add_argument('--port', type=int, default=18215); ap.add_argument('--out', default='results/relay.jsonl')
A = ap.parse_args(); R = f'http://127.0.0.1:{A.port}'
B = [json.loads(l) for l in open('results/build.jsonl')]; B = [b for b in B if b.get('counts', {}).get('room') == A.rooms][-1]; tok = B['token']
cmp_dir = None
for d in glob.glob(os.path.join(A.data, 'cmp_*')):
    if B['campaign'] in open(os.path.join(d, 'snapshot.json')).read(3000): cmp_dir = d
snap = json.load(open(os.path.join(cmp_dir, 'snapshot.json'))); cid = snap['state']['id']; area = list(snap['state']['areas'])[0]
out = {'script': 'relay_probe', 'rooms': A.rooms, 'entities': len(snap['state']['areas'][area]['entities']), 'journal_mb': round(os.path.getsize(os.path.join(cmp_dir, 'journal.jsonl')) / 1e6, 2), 'snapshot_mb': round(os.path.getsize(os.path.join(cmp_dir, 'snapshot.json')) / 1e6, 2)}
prof = os.path.join(A.data, 'prof'); os.makedirs(prof, exist_ok=True)
def stat(pid):
    f = open(f'/proc/{pid}/stat').read().rsplit(')', 1)[1].split(); return (int(f[11]) + int(f[12])) / os.sysconf('SC_CLK_TCK'), round(int(open(f'/proc/{pid}/statm').read().split()[1]) * os.sysconf('SC_PAGE_SIZE') / 1e6, 1)
t0 = time.time()
relay = subprocess.Popen(['node', '--cpu-prof', '--cpu-prof-dir', prof, os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(A.port), 'DATA_DIR': A.data, 'ORIENT_API': ''}, stdout=open(os.path.join(A.data, 'relay.log'), 'a'), stderr=subprocess.STDOUT)
try:
    while True:
        try: urllib.request.urlopen(f'{R}/health', timeout=1); break
        except Exception: time.sleep(0.05)
    out['boot_s'] = round(time.time() - t0, 2); out['boot_cpu_s'], out['rss_mb_after_boot'] = stat(relay.pid)
    def get(path, **q):
        t = time.time(); raw = urllib.request.urlopen(f'{R}{path}?' + urllib.parse.urlencode({**q, 'seat': tok}), timeout=900).read(); return json.loads(raw), len(raw), round(time.time() - t, 3)
    st, n, t = get(f'/c/{cid}/a/{area}/state'); out['get_state'] = {'bytes': n, 's': t}
    st, n, t = get(f'/c/{cid}/a/{area}/state'); out['get_state_again'] = {'bytes': n, 's': t}
    try: lk, n, t = get(f'/c/{cid}/a/{area}/look', x=1040, z=1040, r=30); out['get_look'] = {'bytes': n, 's': t}
    except Exception as e: out['get_look'] = str(e)[:100]
    spawns = []
    # three more rooms on free ground far to the west of the town (a new building each): the cost of ONE spawn at this size
    for i in range(3):
        res, n, t = get(f'/c/{cid}/a/{area}/do', cmd='room.spawn', type='guest', x=300 + i * 60, z=300, w=20, d=20, seed=5 + i, nonce=f'probe-{time.time()}'); spawns.append([t, bool(res.get('ok')), str(res)[:120] if not res.get('ok') else ''])
    out['one_more_room_s'] = spawns
    res, n, t = get(f'/c/{cid}/a/{area}/do', cmd='token.create', name='probe', x=305, z=280, nonce=f'probe-t{time.time()}'); out['token_create_s'] = [t, str(res)[:160]]
    if res.get('id'):
        res, n, t = get(f'/c/{cid}/a/{area}/do', cmd='token.move', id=res['id'], x=310, z=280, nonce=f'probe-m{time.time()}'); out['token_move_s'] = [t, bool(res.get('ok'))]
    out['cpu_s_total'], out['rss_mb_end'] = stat(relay.pid)
finally:
    relay.terminate()
    try: relay.wait(120)
    except Exception: relay.kill()
# the CPU profile: self time by function
pf = sorted(glob.glob(os.path.join(prof, '*.cpuprofile')), key=os.path.getmtime)
if pf:
    pr = json.load(open(pf[-1])); nodes = {n['id']: n for n in pr['nodes']}; self_us = {}
    for nid, dt in zip(pr['samples'], pr['timeDeltas']): self_us[nid] = self_us.get(nid, 0) + dt
    total = sum(self_us.values()); agg = {}
    for nid, us in self_us.items():
        cf = nodes[nid]['callFrame']; k = f"{cf['functionName'] or '(anonymous)'} {os.path.basename(cf['url'])}:{cf['lineNumber'] + 1}"; agg[k] = agg.get(k, 0) + us
    out['profile_total_s'] = round(total / 1e6, 1); out['profile_top'] = [[k, round(us / 1e6, 2)] for k, us in sorted(agg.items(), key=lambda x: -x[1])[:18]]
open(A.out, 'a').write(json.dumps(out) + '\n'); print(json.dumps(out, indent=1)[:5000])

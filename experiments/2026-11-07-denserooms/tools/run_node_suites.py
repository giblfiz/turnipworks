"""Run every node suite of tools/test_matrix.json under tools/spawn-tuner in ROOT (argv[1]), 4 at a time; one line each: suite, exit, the last 'checks, failures' line.
   python3 run_node_suites.py ROOT OUT.json"""
import json, subprocess, sys, re, concurrent.futures, os
root, out = sys.argv[1], sys.argv[2]
M = json.load(open(os.path.join(root, 'tools/test_matrix.json')))
S = [s for s in M['suites'] if s['command'][0] == 'node' and 'spawn-tuner' in s['suite']]
def run(s):
    try: r = subprocess.run(s['command'], cwd=root, capture_output=True, text=True, timeout=s.get('timeout', 1500))
    except subprocess.TimeoutExpired: return s['suite'], 'timeout', ''
    tail = [l for l in (r.stdout + r.stderr).splitlines() if re.search(r'checks|fail|pass|ok\b', l, re.I)]
    return s['suite'], r.returncode, (tail[-1] if tail else (r.stdout + r.stderr)[-200:]).strip()
res = {}
with concurrent.futures.ThreadPoolExecutor(4) as ex:
    for suite, code, line in ex.map(run, S): res[suite] = [code, line]; print(f'{suite.split("/")[-1]:28s} {code} {line[:150]}', flush=True)
json.dump(res, open(out, 'w'), indent=1)

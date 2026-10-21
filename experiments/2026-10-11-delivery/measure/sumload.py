#!/usr/bin/env python3
"""sumload.py tag [tag ...]  -> one line per scene per tag from /var/tmp/tw-delivery/out/<tag>/load-<scene>.json"""
import json, os, sys
for scene in ('room', 'inn', 'town'):
    for tag in sys.argv[1:]:
        f = f'/var/tmp/tw-delivery/out/{tag}/load-{scene}.json'
        if not os.path.exists(f): continue
        d = json.load(open(f)); rq = d['requests']; m = rq.get('mesh .glb', {}); t = rq.get('texture .webp/.png', {})
        lt = d.get('longtasks') or []; durs = [x['duration'] if isinstance(x, dict) else x[1] for x in lt] if lt else []
        gl = d.get('gl_load') or {}
        def ms(k):
            v = gl.get(k) if isinstance(gl, dict) else None
            return round(v['ms']) if isinstance(v, dict) and 'ms' in v else v
        c = d.get('census', {})
        print(f"{scene:5} {tag:10} mesh n={m.get('n')} raw={m.get('raw', 0) / 1e6:.1f}MB wire={m.get('wire_gzip', 0) / 1e6:.1f}MB | img n={t.get('n')} {t.get('raw', 0) / 1e6:.2f}MB | ready {d['t_ready_s']}s settled {d['t_settled_s']}s | long tasks {len(durs)} sum {sum(durs) / 1000:.2f}s max {max(durs or [0]) / 1000:.2f}s | heap {d.get('heap_mb')}MB gpu {d.get('gpu_proc_mb')}MB lost {d.get('ctx_lost')} load {d.get('load_avg')}")
        if '-v' in sys.argv: print('   gl:', json.dumps(gl)[:900]); print('   census keys', list(c.keys())[:30]); print('   profile', json.dumps(d.get('profile_ms'))[:700])

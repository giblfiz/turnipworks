#!/usr/bin/env python3
"""print results/*.jsonl as tables:  show.py results/measure.jsonl"""
import json, sys
for l in open(sys.argv[1]):
    o = json.loads(l)
    if 'cases' in o and o['what'] in ('presets', 'switches'):
        print(o['what'], o['scene'], o.get('rooms'), 'rooms  dpr', o['dpr'], ' load', o['load']); hi = o['cases'].get('high', {})
        for k, v in o['cases'].items():
            d = '' if k == 'high' or v['gpu_ms'] is None or hi.get('gpu_ms') is None else ' (%+.2f)' % (v['gpu_ms'] - hi['gpu_ms'])
            dm = '' if k == 'high' or v['gpu_min'] is None or hi.get('gpu_min') is None else ' (%+.2f)' % (v['gpu_min'] - hi['gpu_min'])
            print('   %-28s GPU lowest %5s ms%s   median %5s%s   frame lowest %5s   quiet runs %s  load %s' % (k, v['gpu_min'], dm, v['gpu_ms'], d, v['frame_min'], v.get('quiet'), max(v['loads'])))
    elif 'cases' in o:
        print(o['what'], o['scene'], o.get('rooms'), 'rooms  dpr', o['dpr'], ' load', o['load'])
        for k, v in o['cases'].items(): print('   %-24s %s' % (k, v))
        if o.get('first_frame_after_input'): print('   first frame after input:', o['first_frame_after_input'])
    else: print(json.dumps(o)[:700])

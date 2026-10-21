"""The 30-prop sample's build jobs (sku, src, kitfix), taken from the main tree's prep/jobs*.json (last entry wins, as jobs.json is the roll-up)."""
import json, glob
R = '<repo>'
S = json.load(open(R + '/experiments/2026-10-11-asset-cost/trials/sample.json'))
jobs = {}
for f in sorted(glob.glob(R + '/tools/spawn-tuner/prep/jobs*.json')):
    for j in json.load(open(f)): jobs[j['sku']] = j
out = [dict(sku=p['sku'], src=jobs[p['sku']]['src'], kitfix=bool(jobs[p['sku']].get('kitfix')), tex=p['tex'], size_in=p['size_in']) for p in S['props']]
json.dump(out, open('/var/tmp/tw-delivery/weld/jobs.json', 'w'), indent=1); print(len(out))

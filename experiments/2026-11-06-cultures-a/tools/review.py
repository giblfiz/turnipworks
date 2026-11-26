#!/usr/bin/env python3
"""One table per culture for the supervisor's verdict: the geometric rules (qa/summary.tsv from tools/qa.sh NOVISION=1),
the blind mesh read (mesh-read.json: what Gemini called it, its culture, soundness, front) beside what was wanted.
    python3 tools/review.py CODE                       print the table
    python3 tools/review.py CODE --reject id:why ...   record rejections in qa/overrides.json (the rest of the rule
                                                       verdicts stand; a rule 'accept' with no read stays accept)
The lane agent decides the match from the table (a text judgement); vision stays with Gemini."""
import csv, json, sys
from pathlib import Path
E = Path(__file__).resolve().parent.parent; B = E / sys.argv[1]
A = {a['id']: a for a in json.loads((B / 'assets.json').read_text())['assets']}
read = json.loads((B / 'mesh-read.json').read_text()) if (B / 'mesh-read.json').exists() else {}
rows = {r['sku']: r for r in csv.DictReader((B / 'qa/summary.tsv').open(), delimiter='\t')} if (B / 'qa/summary.tsv').exists() else {}
ov_p = B / 'qa/overrides.json'; ov = json.loads(ov_p.read_text()) if ov_p.exists() else {}
if '--reject' in sys.argv or '--accept' in sys.argv:
    for arg in sys.argv[2:]:
        if arg in ('--reject', '--accept'): mode = arg[2:]; continue
        i, _, why = arg.partition(':'); ov[i] = {'verdict': 'reject' if mode == 'reject' else 'accept', 'note': why}
    ov_p.parent.mkdir(exist_ok=True); ov_p.write_text(json.dumps(ov, indent=1)); print(len(ov), 'overrides'); sys.exit()
for i in sorted(p.stem for p in (B / 'models').glob('*.glb')):
    r, q = read.get(i, {}), rows.get(i, {})
    print(f"{i:32s} rules {q.get('verdict', '-'):12s} {q.get('reason', '')[:50]:50s}\n    wanted: {A.get(i, {}).get('gate', {}).get('desc', '')[:110]}\n    read:   {r.get('object', '-')} / {r.get('alt', '')} | {r.get('culture', '')} | sound {r.get('sound')} {r.get('defects', '')} | front {r.get('front')} ({r.get('confidence')}){'  OVERRIDE ' + json.dumps(ov[i]) if i in ov else ''}")

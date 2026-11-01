#!/usr/bin/env python3
"""GEMINI'S BLIND READ: open or shut? (2026-10-30). Takes a shots.py folder (blind/ + key.json), hands Gemini (agy-run,
the subscription) batches of the random-named crops in an isolated folder that holds only those images, and asks for
each: what it sees, then OPEN or SHUT. Scores against the key: per image, and per kind (a kind "shows its state" when
Gemini reads its shut crop SHUT and its open crop OPEN).

  python3 experiments/2026-10-30-openables/judge.py SHOTS_DIR [--batch 24]
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile
ap = argparse.ArgumentParser(); ap.add_argument('shots'); ap.add_argument('--batch', type=int, default=24); A = ap.parse_args()
key = json.load(open(os.path.join(A.shots, 'key.json')))
names = sorted(key)  # (random names: sorted is shuffled)
PROMPT = """You are looking at {n} small screenshots from a 3D tabletop game, each a piece of furniture, a door, a gate,
a window, a hatch or a container, seen from a normal play camera (not a close-up). The files: {files}.
Do NOT create, crop or write any files. Do not run commands or open any other files. Only look at the images.
For EACH image: first say in a few words what you see (the object, and any visible labels or text), then decide whether
the object is OPEN or SHUT (a door/gate/hatch swung or slid open, a lid lifted, doors of a cupboard open, shutters open:
OPEN; otherwise SHUT). If you cannot tell, still pick the likelier one and give low confidence.
Answer with ONLY a JSON array, one object per image, in this exact form:
[{{"file": "<name>.png", "see": "<what you see>", "state": "OPEN" or "SHUT", "confidence": <0-100>}}, ...]"""
out = {}
cache = os.path.join(A.shots, 'judged.json')
if os.path.exists(cache): out = json.load(open(cache))
todo = [n for n in names if n not in out]
for i in range(0, len(todo), A.batch):
    part = todo[i:i + A.batch]
    d = tempfile.mkdtemp(prefix='agy-openables-')
    for n in part: shutil.copy(os.path.join(A.shots, 'blind', n), d)
    prompt = PROMPT.format(n=len(part), files=', '.join(part))
    for attempt in range(2):
        r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-C', d, '-t', '600', prompt], stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=900)
        m = re.search(r'\[\s*\{.*\}\s*\]', r.stdout, re.S)
        try: got = json.loads(m.group(0)) if m else []
        except Exception: got = []
        got = [g for g in got if isinstance(g, dict) and g.get('file') in part]
        if len(got) >= len(part) * 0.8: break
        print('  (retry: got', len(got), 'of', len(part), ')', r.stdout[-300:], r.stderr[-300:])
    for g in got: out[g['file']] = g
    json.dump(out, open(cache, 'w'), indent=1)
    print(f'batch {i // A.batch + 1}: {len(got)}/{len(part)}', flush=True)
    shutil.rmtree(d, ignore_errors=True)
# score
right = 0; n = 0; per = {}
for name, k in key.items():
    g = out.get(name)
    if not g: continue
    n += 1; ok = (g['state'].upper() == ('OPEN' if k['state'] == 'open' else 'SHUT')); right += ok
    per.setdefault(k['sku'], {'cat': k['cat']})[k['state']] = {'ok': ok, 'see': g.get('see'), 'conf': g.get('confidence')}
both = {s: v for s, v in per.items() if 'shut' in v and 'open' in v}
shows = [s for s, v in both.items() if v['shut']['ok'] and v['open']['ok']]
cats = {}
for s, v in both.items(): cats.setdefault(v['cat'], []).append(s in shows)
summary = {'images': n, 'right': right, 'accuracy': round(right / max(1, n), 3), 'skus': len(both), 'skus_showing_state': len(shows),
           'cats': len(cats), 'cats_showing_state': sum(1 for v in cats.values() if all(v)), 'cats_none': sorted(c for c, v in cats.items() if not any(v)), 'cats_some': sorted(c for c, v in cats.items() if any(v) and not all(v))}
json.dump({'summary': summary, 'per_sku': per}, open(os.path.join(A.shots, 'score.json'), 'w'), indent=1)
print(json.dumps(summary, indent=1))

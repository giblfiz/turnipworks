#!/usr/bin/env python3
"""Guard: the live game's house look and Harry's review data hold no test leftovers.  (2026-10-05)

  python3 tests/check_house_look.py            exit 1 on any finding
  python3 tests/check_house_look.py --warn     print the same lines, always exit 0 (the deploy scripts)
  python3 tests/check_house_look.py --no-lint  skip the test-file lint
  python3 tests/check_house_look.py --json     the current house look as one JSON line (name and time per kind)

Checks
  1. reviews/tuner/house.jsonl: for each kind (anim, lighting, fire, selection, atmos, water) the value the game loads now.
     A name or note that looks like a test artefact ("test", "acceptance", "qa") is a finding.
  2. reviews/latest.json: no fauna-test/ keys, no "acceptance test" notes.
  3. Lint: every browser test under the test folders imports tests/tw_sandbox.py (which sends its writes to the server's
     test sandbox), or opens the game with the write-back API switched off (`api=&`) and never names /api/tw-ratings.
"""
import glob, json, os, re, sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO, 'server'))
from reviews_home import reviews_dir  # noqa: E402
REVIEWS = str(reviews_dir())  # the live records: outside the checkout since 2026-10-12 (TW_REVIEWS_DIR)
KINDS = ('anim', 'lighting', 'fire', 'selection', 'atmos', 'water', 'fogwar')
FALLBACK = {'anim': "the tuner's default preset (harry-v2)", 'lighting': 'the night built-in', 'fire': 'the night built-in',
            'selection': "the selection module's default", 'atmos': 'clear air', 'water': 'no house water', 'fogwar': 'the built-in defaults'}
TESTY = re.compile(r'test|acceptance|(?<![a-z])qa(?![a-z])', re.I)
TEST_DIRS = ('tests', 'engine/test', 'tools/*/test', 'web/*/test')


def house():
    out = {k: None for k in KINDS}
    path = os.path.join(REVIEWS, 'tuner/house.jsonl')
    if os.path.exists(path):
        for line in open(path).read().splitlines():
            if not line.strip():
                continue
            rec = json.loads(line)
            for k in KINDS:
                v = (rec.get('data') or {}).get(k)
                if v is not None:
                    out[k] = {'name': str(v.get('name') or v.get('id') or '') if isinstance(v, dict) else str(v), 'at': rec.get('at'), 'note': rec.get('note') or ''}
    return out


def findings(lint=True):
    bad = []
    for k, v in house().items():
        if v and (TESTY.search(v['name']) or TESTY.search(v['note'].split(';')[0])):
            bad.append(f'house {k} looks like a test leftover: "{v["name"]}" set {v["at"]} ({v["note"][:80]})')
    path = os.path.join(REVIEWS, 'latest.json')
    if os.path.exists(path):
        latest = json.load(open(path))
        keys = [k for k, r in latest.items() if k.startswith('fauna-test/') or 'acceptance test' in (r.get('note') or '').lower()]
        if keys:
            bad.append(f'reviews/latest.json holds {len(keys)} test rating(s), e.g. {keys[0]}')
    if lint:
        for d in TEST_DIRS:
            for f in sorted(glob.glob(os.path.join(REPO, d, '*.py'))):
                src = open(f).read()
                if 'playwright' not in src or os.path.basename(f) in ('tw_sandbox.py', 'check_house_look.py'):
                    continue
                if 'import tw_sandbox' in src or ('api=&' in src and 'tw-ratings' not in src):
                    continue
                bad.append(f'{os.path.relpath(f, REPO)} opens a browser without tests/tw_sandbox.py: its writes would reach the live records')
    return bad


if __name__ == '__main__':
    if '--json' in sys.argv:
        print(json.dumps({k: (v and {'name': v['name'], 'at': v['at']}) for k, v in house().items()}))
        sys.exit(0)
    bad = findings(lint='--no-lint' not in sys.argv)
    if not bad:
        if '--no-lint' not in sys.argv:
            print('house look: ' + '; '.join(f'{k} = {v["name"] if v else "(none: " + FALLBACK[k] + ")"}' for k, v in house().items()))
            print('house look check: ok (no test leftovers in the house look or the ratings; every browser test is sandboxed)')
        sys.exit(0)
    for b in bad:
        print('WARNING house look check: ' + b)
    sys.exit(0 if '--warn' in sys.argv else 1)

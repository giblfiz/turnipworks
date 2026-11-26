#!/usr/bin/env python3
"""Upload a pack build to its DRAFT GitHub release, with retries, and verify every asset against SHA256SUMS using
GitHub's own digest (sha256:...) and size. Never publishes, never deletes the release, never creates a tag; a broken
partial asset (state != uploaded, or a wrong size/digest) of the SAME name on THIS release is deleted and re-sent.
  python3 experiments/2026-11-07-packs/upload.py <build dir> <release id> [--verify-only]"""
import hashlib, json, os, subprocess, sys, time
D, RID = sys.argv[1], sys.argv[2]; VERIFY = '--verify-only' in sys.argv
REPO = 'giblfiz/turnipworks'; ENV = {**os.environ, 'GH_CONFIG_DIR': '~/.config/gh'}
def gh(*a, check=True):
    r = subprocess.run(['gh', *a], capture_output=True, text=True, env=ENV)
    if check and r.returncode: raise RuntimeError(r.stderr.strip()[:400])
    return r
def assets():
    out = gh('api', '--paginate', f'repos/{REPO}/releases/{RID}/assets?per_page=100').stdout.replace('][', ',')
    return {a['name']: a for a in json.loads(out or '[]')}
rel = json.loads(gh('api', f'repos/{REPO}/releases/{RID}').stdout)
assert rel['draft'], 'not a draft: refusing to touch a published release'
tag = rel['tag_name']
sums = {n.strip(): h for h, n in (l.split(None, 1) for l in open(os.path.join(D, 'SHA256SUMS')).read().splitlines() if l.strip())}
def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()
extra = {n: sha(os.path.join(D, n)) for n in ('SHA256SUMS', 'packs.json')}
want = {**sums, **extra}
def good(a, n):
    return a and a.get('state') == 'uploaded' and a['size'] == os.path.getsize(os.path.join(D, n)) and a.get('digest') == 'sha256:' + want[n]
log = open(os.path.join(D, '..', f'upload-{tag}.log'), 'a')
def say(*m):
    line = time.strftime('%H:%M:%S ') + ' '.join(map(str, m)); print(line, flush=True); log.write(line + '\n'); log.flush()
if not VERIFY:
    for n in sorted(want, key=lambda n: os.path.getsize(os.path.join(D, n))):
        for attempt in range(1, 6):
            have = assets().get(n)
            if good(have, n): break
            if have:
                say('replace broken', n, have.get('state'), have.get('size')); gh('api', '-X', 'DELETE', f"repos/{REPO}/releases/assets/{have['id']}")
            t = time.time(); say('upload', n, f'{os.path.getsize(os.path.join(D, n)) / 1e6:.0f} MB', 'attempt', attempt)
            r = gh('release', 'upload', tag, os.path.join(D, n), '-R', REPO, check=False)
            if r.returncode: say('  failed:', r.stderr.strip()[:300]); time.sleep(20 * attempt); continue
            say(f'  done in {time.time() - t:.0f} s')
        else:
            say('GAVE UP', n)
A = assets(); bad = [n for n in want if not good(A.get(n), n)]
say('VERIFY', f'{len(want) - len(bad)}/{len(want)} assets match SHA256SUMS (size + GitHub sha256 digest)', 'bad:', bad, 'extra on release:', sorted(set(A) - set(want)))
sys.exit(1 if bad else 0)

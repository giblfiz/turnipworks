#!/usr/bin/env python3
"""DEPLOYS PUBLISH 644 / 755 THEMSELVES (2026-11-06; tools/publish_tree.sh; docs/STATUS.md "Deploys set their own file modes").

  python3 tests/test_publish_tree.py

Found 2026-11-05: a tuner deploy left new icon files at 660 (the checkout's mode) and dev 403'd them until they were fixed
by hand. Nothing here touches a real web tree: every copy is between scratch folders.

  COPY     each deploy script's own publishing line (engine/deploy.sh, tools/spawn-tuner/deploy.sh), run on its own against
           scratch folders of 660 files in 2770 folders, as if the deploy stopped right after it: every file is 644 and
           every folder 755 (a folder may keep its setgid bit)
  AGAIN    a file a run before left at 600 in the published tree is put back to 644 by the next publish
  LINKS    a symlink out of the published tree is named as a WARNING; one inside it is not
"""
import os, re, stat, subprocess, sys, tempfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HELPER = os.path.join(REPO, 'tools', 'publish_tree.sh')
results = []
def check(ok, name, detail=''):
    results.append(bool(ok)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

def make_src(root):
    """a little checkout: group-only modes, as the box's umask 007 and setgid folders make them"""
    os.makedirs(os.path.join(root, 'js'), exist_ok=True); os.makedirs(os.path.join(root, 'assets', 'icons', 'new'), exist_ok=True)
    for rel, mode in (('index.html', 0o660), ('js/main.js', 0o660), ('assets/icons/new/room-crypt.webp', 0o660), ('assets/icons/old.webp', 0o600), ('ring.html', 0o660)):
        p = os.path.join(root, rel); open(p, 'w').write(rel); os.chmod(p, mode)
    for d in ('js', 'assets', 'assets/icons', 'assets/icons/new'): os.chmod(os.path.join(root, d), 0o2770)
    os.chmod(root, 0o2770)

def modes(root):
    bad = []
    for dp, dns, fns in os.walk(root):
        for d in dns:
            m = stat.S_IMODE(os.lstat(os.path.join(dp, d)).st_mode) & 0o777
            if m != 0o755: bad.append(f'{os.path.relpath(os.path.join(dp, d), root)}/ {m:o}')
        for f in fns:
            p = os.path.join(dp, f)
            if os.path.islink(p): continue
            m = stat.S_IMODE(os.lstat(p).st_mode)
            if m != 0o644: bad.append(f'{os.path.relpath(p, root)} {m:o}')
    top = stat.S_IMODE(os.stat(root).st_mode) & 0o777
    if top != 0o755: bad.append(f'./ {top:o}')
    return bad

def publish_line(script):
    """the deploy's line that copies into "$DST/" (joined across backslash continuations)"""
    text = open(os.path.join(os.environ.get('PUBLISH_TEST_SCRIPTS', REPO), script)).read().replace('\\\n', ' ')  # (PUBLISH_TEST_SCRIPTS: another tree's scripts, to show the old ones fail)
    lines = [l.strip() for l in text.splitlines() if '"$DST/"' in l and not l.strip().startswith('#') and ('rsync' in l or 'publish_tree.sh' in l)]
    return lines

scratch = tempfile.mkdtemp(prefix='tw-publish-test-')
os.umask(0o007)
print('COPY: each deploy\'s own publishing line, stopped right after it')
for script, src_var in (('engine/deploy.sh', 'STAGE'), ('tools/spawn-tuner/deploy.sh', 'SRC')):
    lines = publish_line(script)
    check(len(lines) == 1, f'{script} has one line that publishes into $DST', lines)
    if not lines: continue
    line = re.sub(r'"\$SRC/\.\./(tools/)?publish_tree\.sh"', f'"{HELPER}"', lines[0])  # the helper where it really is; SRC is scratch
    check('publish_tree.sh' in line, f'{script} publishes through tools/publish_tree.sh', lines[0][:120])
    src = os.path.join(scratch, script.replace('/', '_') + '-src'); dst = os.path.join(scratch, script.replace('/', '_') + '-dst')
    make_src(src)
    r = subprocess.run(['bash', '-c', f'set -euo pipefail; {src_var}="$1"; DST="$2"; mkdir -p "$DST"; {line}', 'x', src, dst], capture_output=True, text=True)
    check(r.returncode == 0, f'{script}: its publishing line runs on scratch folders', (r.stderr or '')[-300:])
    check(os.path.exists(os.path.join(dst, 'assets', 'icons', 'new', 'room-crypt.webp')), f'{script}: the new icon is published')
    bad = modes(dst)
    check(not bad, f'{script}: with nothing after the copy, every file is 644 and every folder 755', bad[:6])

print('AGAIN: a file left at the wrong mode is put right')
src = os.path.join(scratch, 'again-src'); dst = os.path.join(scratch, 'again-dst'); make_src(src)
subprocess.run([HELPER, src + '/', dst + '/'], check=True, capture_output=True)
os.chmod(os.path.join(dst, 'js', 'main.js'), 0o600); os.chmod(os.path.join(dst, 'js'), 0o700)
r = subprocess.run([HELPER, src + '/', dst + '/', '--delete'], capture_output=True, text=True)
check(r.returncode == 0 and not modes(dst), 'the second publish puts the 600 file and the 700 folder back to 644 / 755', modes(dst) or r.stderr[-200:])

print('LINKS: a symlink out of the tree is named')
outside = os.path.join(scratch, 'outside'); os.makedirs(outside); p = os.path.join(outside, 'x.png'); open(p, 'w').write('x'); os.chmod(p, 0o660)
src = os.path.join(scratch, 'links-src'); dst = os.path.join(scratch, 'links-dst'); make_src(src)
os.symlink(outside, os.path.join(src, 'assets', 'linked'))
os.symlink('main.js', os.path.join(src, 'js', 'alias.js'))
r = subprocess.run([HELPER, src + '/', dst + '/'], capture_output=True, text=True)
check(r.returncode == 0, 'a tree with symlinks publishes', r.stderr[-200:])
check('WARNING' in r.stderr and 'assets/linked' in r.stderr, 'the link out of the tree is named on stderr', r.stderr.strip()[:200])
check('alias.js' not in r.stderr, 'the link inside the tree is not')
check(stat.S_IMODE(os.stat(p).st_mode) == 0o660, 'and nothing outside the published tree was changed', oct(stat.S_IMODE(os.stat(p).st_mode)))

subprocess.run(['rm', '-rf', scratch])
print(f"\npublish_tree: {sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)

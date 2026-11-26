#!/usr/bin/env python3
"""build_figures.py's PACKS (experiments/<lane>/set/published: the cyberpunk lane's PACK_GLOB) as the culture pawns use them, and its kept flying poses (2026-11-07, culture pawns; docs/PAWNS.md "Pawns by culture").
    python3 tools/spawn-tuner/test/build_figures_sets.py [--script PATH]   (--script: test another copy, e.g. the old one)

Runs build_figures.py inside a throw-away skeleton of the repo (no git, so no main-checkout fallback), with:
  the main set (2 figures), a pack A at experiments/<a>/set/published (1 figure with setting/kin/role/tile), a pack B
  (1 figure with its own genre: two lanes merge with no shared list), and a fly manifest
  whose source tiers are GONE while the built fly file is still in assets/figures/fly/ and the old figures.json has its row.
Checks:
  1. every pack's figures are in figures.json, with setting / kin / role / tile / genre passed through, files linked
  2. a pack with an id the main set already has is refused (the build stops and says so), nothing written
  3. a flying pose whose source is gone but whose built file is there KEEPS its row (2026-11-07: rebuilding main after the
     flying-pose lane's worktree was removed would have dropped all 29); with its built file gone too, the row goes
  4. --no-packs builds the main set alone
  5. a pack's OWN flying poses (<pack>/fly/manifest.json, 2026-11-07: the dinosaurs' pterosaurs) give its figures a fly row"""
import json, os, shutil, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = Path(next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == '--script'), HERE.parent / 'build_figures.py'))
checks = fails = 0


def ok(c, m, d=''):
    global checks, fails
    checks += 1
    if not c: fails += 1; print('FAIL', m, d)
    elif os.environ.get('V'): print('ok', m)


def fig(i, **o):
    return {'id': i, 'name': i, 'group': 'hero', 'tags': [i], 'srd': [], 'height_ft': 6, 'overall_ft': 6, 'base_ft': 5, 'facing_deg': 0, 'scale': 6.0, 'y0': -0.5,
            'centre': [0, 0], 'files': {'full': f'models/{i}.glb', 'hero': f'tiers/{i}--20k1024.glb', 'horde': f'tiers/{i}--8k512.glb'},
            'tris': {'full': 50000, 'hero': 20000, 'horde': 8000}, 'kb': {'full': 3000, 'hero': 1200, 'horde': 450}, 'recommended': 'hero', 'sha1': (i.encode().hex() + '0' * 8)[:12], **o}


def make_set(d, figs):
    (d / 'tiers').mkdir(parents=True); (d / 'models').mkdir()
    for f in figs:
        for k in ('hero', 'horde', 'full'): (d / f['files'][k]).write_bytes(f"{f['id']} {k}".encode())
    (d / 'manifest.json').write_text(json.dumps({'updated': 'x', 'expected_total': len(figs), 'figures': figs}))


def run(root, *args):
    r = subprocess.run([sys.executable, str(root / 'tools/spawn-tuner/build_figures.py'), *args], capture_output=True, text=True, cwd=root)
    return r.returncode, r.stdout + r.stderr


tmp = Path(tempfile.mkdtemp(prefix='bf-sets-'))
try:
    st = tmp / 'tools/spawn-tuner'; st.mkdir(parents=True); shutil.copy2(SCRIPT, st / 'build_figures.py')
    make_set(tmp / 'experiments/2026-10-06-figures/set/published', [fig('hero-a'), fig('foe-b', group='foe', recommended='horde')])
    make_set(tmp / 'experiments/2026-11-07-lane-a/set/published', [fig('cul-jpn-x', setting='JPN', kin='Japan', role='fighter', tile='Samurai')])
    make_set(tmp / 'experiments/2026-11-07-lane-b/set/published', [fig('cyb-y', genre='cyberpunk', kin='Street', role='rogue')])
    # the flying pose: its manifest is there, its source tiers are not (the lane's worktree was deleted after landing)
    fly = tmp / 'experiments/2026-11-06-pawns/fly'; fly.mkdir(parents=True)
    (fly / 'manifest.json').write_text(json.dumps({'figures': [{'id': 'foe-b', 'files': {'full': 'models/foe-b-fly.glb', 'hero': 'tiers/foe-b-fly--20k1024.glb', 'horde': 'tiers/foe-b-fly--8k512.glb'}, 'scale': 5, 'height_ft': 4, 'span_ft': 6, 'tris': {'hero': 1, 'horde': 1, 'full': 1}, 'kb': {'hero': 1, 'horde': 1, 'full': 1}, 'sha1': 'feedfacecafe'}]}))
    built_fly = {'url': 'assets/figures/fly/foe-b--8k512-feedface.glb', 'k': 5, 'c': [0, 0], 'yaw': 0, 'h': 4, 'oh': 4, 'span': 6, 'tris': 1, 'kb': 1}
    (st / 'assets/figures/fly').mkdir(parents=True); (st / built_fly['url'].replace('assets/figures/', 'assets/figures/', 1)).write_bytes(b'built fly')
    (st / 'data').mkdir(); (st / 'data/figures.json').write_text(json.dumps({'figures': [{'id': 'foe-b', 'fly': built_fly}]}))
    code, out = run(tmp)
    ok(code == 0, 'build_figures.py runs', out[-600:])
    doc = json.loads((st / 'data/figures.json').read_text()) if (st / 'data/figures.json').exists() else {'figures': []}
    F = {f['id']: f for f in doc['figures']}
    # 1. the extra sets
    ok(set(F) == {'hero-a', 'foe-b', 'cul-jpn-x', 'cyb-y'}, 'the main set and BOTH extra sets are in the list', sorted(F))
    x = F.get('cul-jpn-x', {})
    ok(x.get('setting') == 'JPN' and x.get('kin') == 'Japan' and x.get('role') == 'fighter' and x.get('tile') == 'Samurai', 'setting, kin, role and tile are passed through', x)
    ok(F.get('cyb-y', {}).get('genre') == 'cyberpunk', 'a figure\'s own genre is passed through', F.get('cyb-y'))
    ok(x.get('url') and (st / x['url']).exists() and (st / x.get('full', '-')).exists(), 'an extra set\'s files are linked into assets/figures/', x.get('url'))
    ok('2026-11-07-lane-a/set/published: 1 figures' in out and '2026-11-07-lane-b/set/published: 1 figures' in out, 'the report names each pack and its count', out[-400:])
    # 3. the kept flying pose
    ok(F.get('foe-b', {}).get('fly') == built_fly, 'a flying pose whose source is gone but whose built file is there keeps its row', F.get('foe-b', {}).get('fly'))
    ok((st / built_fly['url']).exists(), '... and its built file is not removed as stale')
    (st / built_fly['url']).unlink(missing_ok=True)
    code, out = run(tmp)
    F = {f['id']: f for f in json.loads((st / 'data/figures.json').read_text())['figures']}
    ok(code == 0 and 'fly' not in F.get('foe-b', {}), 'with its built file gone too, the flying row goes', F.get('foe-b'))
    # 5. a PACK's own flying poses (2026-11-07, the dinosaurs' pterosaurs): <pack>/fly/manifest.json, files under <pack>/fly/
    pf = tmp / 'experiments/2026-11-07-lane-b/set/published/fly'; (pf / 'tiers').mkdir(parents=True); (pf / 'models').mkdir()
    prow = {'id': 'cyb-y', 'files': {'full': 'models/cyb-y-fly.glb', 'hero': 'tiers/cyb-y-fly--20k1024.glb', 'horde': 'tiers/cyb-y-fly--8k512.glb'}, 'scale': 7, 'centre': [0.1, 0.2], 'facing_deg': 0,
            'height_ft': 5, 'overall_ft': 5, 'span_ft': 14, 'tris': {'hero': 2, 'horde': 2, 'full': 2}, 'kb': {'hero': 2, 'horde': 2, 'full': 2}, 'sha1': 'abcdef012345'}
    for k in ('hero', 'horde', 'full'): (pf / prow['files'][k]).write_bytes(f'cyb-y fly {k}'.encode())
    (pf / 'manifest.json').write_text(json.dumps({'figures': [prow]}))
    code, out = run(tmp)
    F = {f['id']: f for f in json.loads((st / 'data/figures.json').read_text())['figures']}
    fy = F.get('cyb-y', {}).get('fly') or {}
    ok(code == 0 and fy.get('span') == 14 and fy.get('k') == 7 and fy.get('url', '').startswith('assets/figures/fly/cyb-y--'), "a pack's own fly manifest gives its figure a flying pose", fy)
    ok(fy.get('url') and (st / fy['url']).read_bytes() == b'cyb-y fly hero' and (st / fy.get('full', '-')).exists(), "... with the pack's own fly files linked in", fy.get('url'))
    ok('fly' not in F.get('hero-a', {}) and 'fly' not in F.get('cul-jpn-x', {}), '... and no other figure gets one', [F.get('hero-a', {}).get('fly'), F.get('cul-jpn-x', {}).get('fly')])
    # 2. a taken id: refused, nothing written
    before = (st / 'data/figures.json').read_text()
    make_set(tmp / 'experiments/2026-11-07-lane-c/set/published', [fig('hero-a', name='IMPOSTOR')])
    code, out = run(tmp)
    ok(code != 0 and 'hero-a' in out and (st / 'data/figures.json').read_text() == before, 'a pack whose id the main set has is refused, and the list is left as it was', out[-300:])
    shutil.rmtree(tmp / 'experiments/2026-11-07-lane-c')
    # 4. --no-packs
    code, out = run(tmp, '--no-packs')
    F = {f['id']: f for f in json.loads((st / 'data/figures.json').read_text())['figures']}
    ok(code == 0 and set(F) == {'hero-a', 'foe-b'}, '--no-packs builds the main set alone', sorted(F))
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print(f'build_figures_sets: {checks - fails}/{checks} checks passed')
sys.exit(1 if fails else 0)

#!/usr/bin/env python3
"""Before you generate: are your planned skus free?  (2026-10-12)

  python3 tools/tool-sweep/sku_free.py experiments/2026-10-11-types/smi/assets.json     a batch spec (its `id`s)
  python3 tools/tool-sweep/sku_free.py catalog/runs/smi-01/manifest.tsv                 a run manifest (its `sku`s)
  python3 tools/tool-sweep/sku_free.py names.txt        one sku per line          ... or the names themselves as arguments

Lists every planned sku that is TAKEN: in the library on main, claimed by another batch on main, or claimed by another
batch in an in-flight worktree (../3d-vtt-type-*, ../3d-vtt-wizard). Exit 1 if any is taken, 0 if all are free.
Your own batch folder (the spec's folder) never counts against you. A taken name needs a suffix of your own
(`coal-bin--mine`, `scroll-rack--s2`): one mesh file per sku, and the other batch's file is the one that ships.
It also notes, without failing, the skus whose ROLE (the part before `--`) another batch already has a mesh for.
"""
import csv, json, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import sku_guard as g


def main_tree():
    try:
        out = subprocess.run(['git', '-C', str(g.ROOT), 'worktree', 'list', '--porcelain'], capture_output=True, text=True).stdout
        return Path(next(l.split(' ', 1)[1] for l in out.splitlines() if l.startswith('worktree ')))
    except Exception:  # noqa: BLE001
        return g.ROOT


def planned(args):
    names, mine = [], None
    for a in args:
        p = Path(a)
        if not p.exists():
            names.append(a); continue
        if p.suffix == '.json':
            d = json.loads(p.read_text()); items = d.get('assets') if isinstance(d, dict) else d
            names += [x['id'] if isinstance(x, dict) else x for x in items]
            mine = mine or p.resolve().parent
        elif p.suffix == '.tsv':
            names += [r['sku'] for r in csv.DictReader(p.open(newline=''), delimiter='\t')]
        else:
            names += [l.split()[0] for l in p.read_text().splitlines() if l.strip() and not l.startswith('#')]
            mine = mine or p.resolve().parent
    return list(dict.fromkeys(names)), mine


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args: sys.exit(__doc__)
    names, mine = planned(args)
    my_key = g.owner_key(str(mine / 'models' / 'x.glb')) if mine and 'experiments' in mine.parts else None
    root = main_tree(); trees = [root] + [t for t in g.other_trees(root)]
    if g.ROOT.resolve() not in [t.resolve() for t in trees]: trees.append(g.ROOT)
    taken, roles = {}, {}
    lib = json.loads((root / 'tools/spawn-tuner/data/library.json').read_text())['objects']
    for o in lib.values():
        for s in o['skus']:
            taken.setdefault(s['sku'], {}).setdefault(f"the library on main ({s['src']})", set())
    for t in trees:
        where = 'main' if t.resolve() == root.resolve() else 'this tree' if t.resolve() == g.ROOT.resolve() else t.name.replace('3d-vtt-', '')
        for c in g.claims(t):
            if my_key and c['batch'] == my_key: continue
            if c['batch'].startswith('run:') and my_key and c['how'].split('/')[2].split('-')[0] in my_key.split('/')[-1]: continue
            taken.setdefault(c['sku'], {}).setdefault(c['batch'], set()).add(where)
            if not c.get('flat'): roles.setdefault(c['sku'].split('--')[0], set()).add(c['batch'].split('/')[-1])
    settled = g.allow()['skus']   # collisions already settled by hand (sku_guard_allow.json)
    bad = {n: sorted(b + (f" [{', '.join(sorted(w))}]" if w else '') for b, w in taken[n].items()) for n in names if n in taken and n not in settled}
    if my_key:  # the library entry of my own accepted mesh is mine
        own_runs = {c['how'] for c in g.claims(g.ROOT) if c['batch'] == my_key and c['how'].endswith('manifest.tsv')}
        own_src = {h.split('/')[2] for h in own_runs}
        bad = {n: [w for w in ws if not any(w == f'the library on main ({r})' for r in own_src)] for n, ws in bad.items()}
        bad = {n: ws for n, ws in bad.items() if ws}
    print(f"{len(names)} planned skus{' of ' + my_key if my_key else ''}; checked main and {len(trees) - 1} other tree(s)")
    for n, ws in bad.items():
        print(f"  ✗ TAKEN {n}: {'; '.join(ws[:4])}{' …' if len(ws) > 4 else ''}")
    near = {n: sorted(roles[n.split('--')[0]]) for n in names if n not in bad and n.split('--')[0] in roles}
    if near:
        print(f"  · role already has a mesh elsewhere (fine: your sku is its own name): " + ', '.join(f"{n} ({'/'.join(v[:3])})" for n, v in list(near.items())[:12]) + (' …' if len(near) > 12 else ''))
    print('all free' if not bad else f"{len(bad)} taken: give each a suffix of your own (e.g. --{(my_key or 'mine').split('/')[-1]}) in the spec and the manifest")
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())

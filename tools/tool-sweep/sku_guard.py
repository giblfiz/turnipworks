#!/usr/bin/env python3
"""Two batches must never claim the same sku.  (2026-10-12)

Batches are generated in parallel, each in its own folder under experiments/, and every mesh ships as ONE file named
for its sku (tools/spawn-tuner/assets/m/<sku>.glb, a folder every git worktree shares). Four times in two days two
batches chose the same sku (scroll-rack, apothecary-drawers, orb-socket-pedestal): build_data.py kept whichever block
came first without a word, and one batch's runtime build overwrote the other's mesh file for hours.

  python3 tools/tool-sweep/sku_guard.py              the gate: exit 1 when two batches claim one sku with different
                                                     source models (build_data.py runs it before it writes anything;
                                                     tools/spawn-tuner/deploy.sh runs it before it copies anything)
  ... --worktrees     also read the in-flight worktrees (../3d-vtt-type-*, ../3d-vtt-wizard): what WILL collide
  ... --all           list the accepted collisions too (sku_guard_allow.json), with their reasons
  ... --live          are the shipped files of every multiply-claimed sku the owning batch's mesh? (bounding boxes;
                      needs trimesh: python3)
  ... --stamp         write assets/m/<sku>.glb.owner for every library mesh that has none (the runtime build's guard)
  python3 tools/tool-sweep/sku_free.py <spec>        BEFORE generating: which planned skus are already taken

A CLAIM is a sku named by a batch: a row of catalog/runs/<run>/manifest.tsv, an entry of a batch spec
(experiments/**/assets.json, `id`; the manifest's sku wins where it renames one), or a flat image in a batch's
flats/ folder. A BATCH is the folder under experiments/ (a run manifest is matched to the folder holding its models).
Two claims collide when their batches differ and their source models are not the same file content (or one is not
generated yet). Deliberate re-generations (inn-01 -> inn-01b -> inn-02) and collisions already settled are listed in
sku_guard_allow.json, each with its reason: adding a line there is the only way past the gate, so it is never silent.
"""
import csv, hashlib, json, os, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SKIP = ('2026-10-06-figures', 'figs-in-game')   # figures are pawns: another namespace (data/figures.json)
ALLOW = HERE / 'sku_guard_allow.json'


def sha8(p):
    try: return hashlib.sha1(Path(p).read_bytes()).hexdigest()[:8]
    except OSError: return None


def other_trees(root=ROOT):
    return sorted(p for pat in ('3d-vtt-type-*', '3d-vtt-wizard') for p in root.parent.glob(pat) if p.is_dir() and p.resolve() != root.resolve())


def _model(folder, name):
    for sub in ('models', 'fal/models'):
        p = folder / sub / f'{name}.glb'
        if p.exists(): return p
    return None


def claims(root=ROOT):
    """-> [{sku, batch, tree, how, model}] for one tree. `batch` is the folder under experiments/ (posix, relative)."""
    root = Path(root); exp = root / 'experiments'; out = []
    specs = {}   # folder -> [ids]
    for p in sorted(exp.glob('**/assets.json')):
        rel = p.parent.relative_to(root).as_posix()
        if any(s in rel for s in SKIP) or '/integration/' in rel + '/' or '/work/' in rel + '/': continue
        try: data = json.loads(p.read_text())
        except Exception: continue  # noqa: BLE001
        items = data.get('assets') if isinstance(data, dict) else data
        ids = [a['id'] for a in items or [] if isinstance(a, dict) and isinstance(a.get('id'), str)]
        if ids: specs[p.parent] = ids
    renamed = {}  # folder -> {source id: sku} from its run manifest
    for man in sorted((root / 'catalog/runs').glob('*/manifest.tsv')):
        run = man.parent.name
        rows = [r for r in csv.DictReader(man.open(newline=''), delimiter='\t') if r.get('sku')]
        srcs = [r.get('source') or r['sku'] for r in rows]
        # the batch folder: the spec folder that has the most of this run's models (else: the most of its ids)
        best, score = None, 0
        for folder, ids in specs.items():
            n = sum(1 for s in srcs if _model(folder, s)) * 2 + len(set(srcs) & set(ids))
            if n > score: best, score = folder, n
        if score < len(srcs): best = None    # (inn-01b's manifest lists the whole inn: it is not a spec folder's run)
        batch = best.relative_to(root).as_posix() if best else f'run:{run}'
        for r in rows:
            src = r.get('source') or r['sku']
            if (r.get('lane') or '3d') != '3d': continue
            out.append({'sku': r['sku'], 'batch': batch, 'tree': str(root), 'how': f'catalog/runs/{run}/manifest.tsv', 'model': _model(best, src) if best else None})
            if best: renamed.setdefault(best, {})[src] = r['sku']
    for folder, ids in specs.items():
        batch = folder.relative_to(root).as_posix(); ren = renamed.get(folder, {})
        for i in ids:
            if i in ren: continue   # the manifest row above is this piece, under its shipped name
            out.append({'sku': i, 'batch': batch, 'tree': str(root), 'how': f'{batch}/assets.json', 'model': _model(folder, i)})
    for p in sorted(exp.glob('**/flats/*/*')):
        if p.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp') or p.parent.name not in ('seamless', 'decals'): continue
        rel = p.parent.parent.parent.relative_to(root).as_posix()
        if any(s in rel for s in SKIP) or '/integration/' in rel + '/' or '/sandbox/' in rel + '/': continue
        out.append({'sku': p.stem, 'batch': rel, 'tree': str(root), 'how': f'{rel}/flats/{p.parent.name}', 'model': p, 'flat': True})
    return out


def allow():
    return json.loads(ALLOW.read_text()) if ALLOW.exists() else {'lineage': [], 'skus': {}}


def collisions(all_claims):
    """-> [{sku, batches: [{batch, tree, how, model, sha}], allowed: reason or None}]"""
    A = allow(); by = {}
    for c in all_claims: by.setdefault(c['sku'], []).append(c)
    out = []
    for sku, cs in sorted(by.items()):
        per = {}
        for c in cs:   # one entry per batch: prefer the claim that has a model, and the main tree's
            cur = per.get(c['batch'])
            if cur is None or (c['model'] and not cur['model']): per[c['batch']] = c
        if len(per) < 2: continue
        ents = [dict(c, sha=sha8(c['model']) if c['model'] else None) for c in per.values()]
        if len({e['sha'] for e in ents}) == 1 and ents[0]['sha']: continue      # the same file, copied: one model
        if len({bool(e.get('flat')) for e in ents}) > 1: continue               # a flat and a mesh share a name, not a file
        names = {e['batch'] for e in ents}
        why = A['skus'].get(sku) or next((f"lineage: {' -> '.join(l)}" for l in A['lineage'] if names <= set(l)), None)
        out.append({'sku': sku, 'batches': ents, 'allowed': why})
    return out


def describe(c, root=ROOT):
    def one(e):
        tree = '' if Path(e['tree']).resolve() == Path(root).resolve() else f" [in-flight: {Path(e['tree']).name}]"
        return f"{e['batch']}{tree} ({'model @' + e['sha'] if e['sha'] else 'not generated yet'}; {e['how']})"
    return f"{c['sku']}: " + '  VS  '.join(one(e) for e in c['batches'])


def gate(root=ROOT, worktrees=False, show_all=False, quiet=False):
    cl = claims(root)
    if worktrees:
        for t in other_trees(root): cl += claims(t)
    cols = collisions(cl)
    bad = [c for c in cols if not c['allowed']]; ok = [c for c in cols if c['allowed']]
    if bad:
        print(f"SKU COLLISION: {len(bad)} sku(s) are claimed by two batches with different source models. One mesh file per sku: one batch's build would overwrite the other's.")
        for c in bad: print('  ✗ ' + describe(c, root))
        print("  → rename the newer batch's sku (its spec id and manifest row), or, if one must replace the other, say so in tools/tool-sweep/sku_guard_allow.json with the reason.")
    elif not quiet:
        print(f"sku guard OK: {len({c['sku'] for c in cl})} skus over {len({c['batch'] for c in cl})} batches{' and ' + str(len(other_trees(root))) + ' in-flight worktrees' if worktrees else ''}, no new collision ({len(ok)} accepted, listed with --all)")
    if show_all:
        for c in ok: print(f"  · accepted ({c['allowed']}): {describe(c, root)}")
    return 1 if bad else 0


# ---------------------------------------------------------------- the shipped files
def owner_key(path):
    """The batch a source model belongs to, whatever tree it was read from: 'experiments/<...>' up to its models folder."""
    parts = Path(path).as_posix().split('/')
    if 'experiments' not in parts: return Path(path).parent.as_posix()
    i = len(parts) - 1 - parts[::-1].index('experiments')
    rest = parts[i:-1]
    while rest and rest[-1] in ('models', 'fal'): rest = rest[:-1]
    return '/'.join(rest)


def library_owners(root=ROOT):
    """sku -> the source GLB the library shows (found by the mesh id's hash among the claims' models, then by name)."""
    lib = json.loads((root / 'tools/spawn-tuner/data/library.json').read_text())['objects']
    models = {}
    for c in claims(root):
        if c['model'] and not c.get('flat'): models.setdefault(c['sku'], []).append(c['model'])
    out = {}
    for o in lib.values():
        for s in o['skus']:
            if s['kind'] != 'mesh': continue
            want = s['mesh'].rsplit('@', 1)[-1]
            out[s['sku']] = {'src': s['src'], 'mesh': s['mesh'], 'place': o['place'], 'bounds': s.get('bounds'),
                             'model': next((m for m in models.get(s['sku'], []) if sha8(m) == want), None)}
    return out


def stamp(root=ROOT):
    own = library_owners(root); n = 0; dest = root / 'tools/spawn-tuner/assets/m'
    for sku, o in own.items():
        f = dest / f'{sku}.glb'; side = dest / f'{sku}.glb.owner'
        if f.exists() and not side.exists() and o['model']:
            side.write_text(json.dumps({'batch': owner_key(o['model']), 'source': str(o['model']), 'mesh': o['mesh'], 'by': 'sku_guard --stamp'}) + '\n'); n += 1
    print(f"owner stamps: {n} written, {sum(1 for s in own if (dest / f'{s}.glb.owner').exists())} of {len(own)} library meshes stamped")


def live(root=ROOT, tol=0.06):
    """Is every shipped mesh file the mesh of the batch the library names? The source model is found by the hash in the
    mesh id; the shipped file is its decimated copy, so the two bounding boxes have the same proportions. A file built
    from another batch's model does not. Kit pieces are re-posed and trimmed by the build and are skipped."""
    import trimesh
    own = library_owners(root); dest = root / 'tools/spawn-tuner/assets/m'
    cl = claims(root)
    for t in other_trees(root): cl += claims(t)
    rivals = {}
    for c in cl:
        if c['model'] and not c.get('flat'): rivals.setdefault(c['sku'], {})[owner_key(c['model'])] = c['model']
    def dims(p):
        e = sorted(trimesh.load(str(p), force='scene', skip_materials=True).extents); return [x / e[-1] for x in e]
    off = lambda a, b: max(abs(x - y) for x, y in zip(a, b))
    wrong, unknown, checked = [], 0, 0
    for sku, o in sorted(own.items()):
        f = dest / f'{sku}.glb'
        if o['place'] == 'kit': continue
        if not f.exists() or o['model'] is None: unknown += 1; continue
        try: shipped = dims(f); d = off(shipped, dims(o['model']))
        except Exception as e: print(f"  ? {sku}: unreadable ({e})"); unknown += 1; continue  # noqa: BLE001
        checked += 1
        if d <= tol: continue
        other = {b: off(shipped, dims(m)) for b, m in rivals.get(sku, {}).items() if b != owner_key(o['model'])}
        best = min(other, key=other.get) if other else None
        if best and other[best] < d:
            wrong.append(sku); print(f"  ✗ {sku}: the library says {o['src']}, the shipped file has the proportions of {best} (off by {other[best]:.3f}; its own source is off by {d:.3f})")
        else:
            print(f"  ? {sku} ({o['src']}): the shipped file is off its own source by {d:.3f} and matches no other batch's model (a re-posed or trimmed mesh?)")
    print(f"live files: {checked} shipped meshes compared with their batch's source model, {len(wrong)} are another batch's mesh{': ' + ', '.join(wrong) if wrong else ''}; {unknown} could not be compared (no source model on disk)")
    return 1 if wrong else 0


if __name__ == '__main__':
    if '--stamp' in sys.argv: stamp(); sys.exit(0)
    if '--live' in sys.argv: sys.exit(live())
    rc = gate(worktrees='--worktrees' in sys.argv, show_all='--all' in sys.argv, quiet='--quiet' in sys.argv)
    sys.exit(0 if os.environ.get('TW_SKU_GUARD') == 'warn' else rc)

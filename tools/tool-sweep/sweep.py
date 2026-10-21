#!/usr/bin/env python3
"""Every library asset reaches Harry's review tools, on every deploy.  (2026-10-12)

Harry reviews assets by hand in three tools. Until now a new batch reached them only if its agent wired it by hand, and
several batches left nothing but a markdown list. This sweep reads the library the tuner ships and puts every asset that
is not presented yet where it belongs. It is run by tools/spawn-tuner/deploy.sh after the tuner is copied out, it is
idempotent (a second run changes nothing), and it never writes a rating or a bench record: it only writes LISTS.

  python3 tools/tool-sweep/sweep.py            build and publish to the live folder
  python3 tools/tool-sweep/sweep.py --plan     say what it would publish, write nothing
  python3 tools/tool-sweep/check.py            the gate: exit 1 if any library asset is in none of the tools it belongs in
  ... --dest DIR  another web folder (a sandbox)      --bin DIR  the tree that holds the binaries (default: this one;
                                                      a git worktree has no GLBs, so name the main tree there)

What it publishes, all under <dest> (default /var/www/implausible-landing/projects/turnip-works):

  review-lib/   ASSET RATER, the combined page. Every mesh and flat of the library that no older run page shows
                (review/ = inn-01, review-01b/ = inn-01b, review-02/ = inn-02, review-figures/ = figures-01 keep theirs).
                One page, a Batch filter, and each asset scored under ITS OWN batch: the key is <src>/<sku>/model, the
                key build_data.py reads back into library.json, so batches never collide and a score reaches the game.
                The model shown is the shipping mesh the game draws (../tuner/assets/m/<sku>.glb: nothing is copied);
                a flat is shown as an upright card. The source plate stands beside it where the batch folder has one
                (found by the mesh id's hash, so no per-batch code).
  queues/       bench.json   objects a batch DECLARED for the bench on top of the bench's own rules (water, openables)
                pairs.json   every closed / open pair (the open/shut tester reads it)
                queues.json  who is in each queue (rater pages by batch; fire / water / open-shut by mesh)
                index.html   WHAT IS WAITING: live counts per queue ("to rate", "fire anchors to confirm" ...)
  align/        the Alignment Bench, redeployed (its queues are computed in the browser from the deployed library;
                bench.json adds the declared ones)
  openclose/pairs/   the open/shut tester's page of library pairs
  index.html    the landing page gets a "Waiting for you" block (between two marker comments; nothing else is touched)

Who decides what belongs where
  fire        the game lights what fx/fire.js fireType() names; the bench queue is exactly that. The catalog's `aff: lit`
              is the cross-check: a lit object the game gives no flame is reported (and fails the check unless
              waivers.json says why).
  water       the catalog has no water affordance. A vessel is in the queue if the bench's own list names it, or its batch
              declared it: `bench:water` (or `empty`) in the flags column of catalog/runs/<run>/manifest.tsv, or a Water
              table in the batch's BENCH.md.
  open/shut   `aff: open`, an `open_of:` twin, or declared (`bench:hinge` / `bench:twin`, or a BENCH.md hinge table).
  Disagreements between the catalog and the declarations are REPORTED (queues/queues.json `notes`, and printed), and the
  piece is presented anyway: an extra item in a queue costs Harry a keypress, a missing one is never seen.
"""
import csv, hashlib, io, json, os, re, struct, subprocess, sys, shutil, datetime, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
LIVE = Path('/var/www/implausible-landing/projects/turnip-works')
LEGACY_RUN = {'review': 'inn-01', 'review-01b': 'inn-01b'}   # pages whose assets.json names no run
LIB_PAGE = 'review-lib'
MARK = ('<!-- tw:queues (tools/tool-sweep) -->', '<!-- /tw:queues -->')


def opt(k, d=None):
    return next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == k and i + 1 < len(sys.argv)), d)


# ---------------------------------------------------------------- reading
def load(dest=None, bin_root=None):
    """Everything the sweep and the check reason from."""
    dest = Path(dest or LIVE); bin_root = Path(bin_root or ROOT)
    tuner = ROOT / 'tools/spawn-tuner'
    lib = json.loads((tuner / 'data/library.json').read_text())
    S = {'dest': dest, 'bin': bin_root, 'tuner': tuner, 'lib': lib, 'objects': lib['objects']}
    S['skus'] = [dict(s, id=o['id']) for o in lib['objects'].values() for s in o['skus']
                 if s.get('url') and (s['kind'] == 'flat' or s.get('bounds'))]
    S['by_sku'] = {s['sku']: s for s in S['skus']}
    figs = tuner / 'data/figures.json'
    S['figures'] = json.loads(figs.read_text()).get('figures', []) if figs.exists() else []
    S['declared'], S['flag_fire'] = declared(S)
    S['benchmd'] = bench_md(S)
    return S


def declared(S):
    """Manifest flags -> {'water': {object id: why}, 'open': {...}}, and the skus a manifest calls a light."""
    out = {'water': {}, 'open': {}}; fire = {}
    for path in sorted((ROOT / 'catalog/runs').glob('*/manifest.tsv')):
        run = path.parent.name
        for row in csv.DictReader(path.open(newline=''), delimiter='\t'):
            flags = set(filter(None, (row.get('flags') or '').split(',')))
            s = S['by_sku'].get(row['sku'])
            if not flags or not s or s['kind'] != 'mesh':
                continue
            oid = S['objects'][s['id']].get('open_of') or s['id']
            if flags & {'bench:water', 'empty'}:
                out['water'].setdefault(s['id'], f"{run} manifest flag {sorted(flags & {'bench:water', 'empty'})[0]}")
            if flags & {'bench:hinge', 'bench:twin'}:
                out['open'].setdefault(oid, f"{run} manifest flag {sorted(flags & {'bench:hinge', 'bench:twin'})[0]}")
            if 'bench:fire' in flags or any(f.startswith('light:') for f in flags):
                fire[s['sku']] = run
    return out, fire


def bench_md(S):
    """The batches' BENCH.md lists, as a cross-check: {'fire'|'water'|'open': {object id: file}}, plus names that
    resolve to nothing in the library. Only TABLE rows are read (the prose lists what is missing or still to come)."""
    out = {'fire': {}, 'water': {}, 'open': {}, 'unresolved': {}, 'files': []}
    objs = S['objects']
    word = lambda t: 'fire' if re.search(r'fire|flame|light', t, re.I) else 'water' if re.search(r'water', t, re.I) else \
        'open' if re.search(r'hinge|open|shut', t, re.I) else None
    for path in sorted((ROOT / 'experiments').glob('**/BENCH.md')):
        rel = str(path.relative_to(ROOT)); out['files'].append(rel)
        section = None; base = None
        for line in path.read_text().splitlines():
            if line.startswith('#'):
                section = word(line.lstrip('# ')); continue
            if not line.startswith('|') or re.match(r'^\|\s*-', line):
                continue
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            kind = word(cells[0]) if cells and not '`' in cells[0] and word(cells[0]) and len(cells[0]) < 24 else section
            if not kind:
                continue
            note_col = len(cells) - 1 if len(cells) >= 3 else None   # the last column is prose ("note"): names there are not list entries
            for ci, cell in enumerate(cells):
                if ci == note_col and kind != 'fire':
                    continue
                if ci == note_col and kind == 'fire' and len(cells) > 3:
                    continue
                for tok in re.findall(r'`([^`]+)`', cell):
                    tok = tok.strip()
                    if tok.startswith('--') and base:           # `chandelier-grand`, `--s2`
                        tok = base + tok
                    oid = S['by_sku'][tok]['id'] if tok in S['by_sku'] else tok if tok in objs else None
                    if oid is None:                               # a role name with variants only (`sarcophagus--s1` is a sku; `door-crypt--leaf`)
                        stem = tok.split('--')[0]
                        oid = stem if stem in objs else None
                    if oid is None:
                        if re.match(r'^[a-z0-9]+(-[a-z0-9]+)+$', tok.split('--')[0]): out['unresolved'].setdefault(tok, rel)
                        continue
                    base = tok.split('--')[0]
                    if not any(s['kind'] == 'mesh' for s in objs[oid]['skus']):
                        continue
                    if kind == 'open':
                        oid = objs[oid].get('open_of') or oid
                    out[kind].setdefault(oid, rel)
    return out


def bench_lists(S):
    """queues/bench.json: what the declarations add to the bench's own rules. Deterministic (no dates)."""
    water = dict(S['declared']['water']); opened = dict(S['declared']['open'])
    for oid, f in S['benchmd']['water'].items(): water.setdefault(oid, f)
    for oid, f in S['benchmd']['open'].items(): opened.setdefault(oid, f)
    return {'water': dict(sorted(water.items())), 'open': dict(sorted(opened.items()))}


def membership(S, bench):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
        json.dump(bench, f); tmp = f.name
    try:
        r = subprocess.run(['node', str(HERE / 'membership.mjs'), str(S['tuner'] / 'data/library.json'), str(S['tuner'] / 'js/fx/fire.js'),
                            str(ROOT / 'web/align/js/queues.js'), tmp], capture_output=True, text=True, check=True)
    finally:
        os.unlink(tmp)
    return json.loads(r.stdout)


def waivers():
    p = HERE / 'waivers.json'
    return json.loads(p.read_text()) if p.exists() else {}


def notes(S, Q, bench):
    """Where the catalog, the game's rules and the batches' lists disagree. Reported, never silently resolved."""
    objs = S['objects']; has_mesh = lambda o: any(s['kind'] == 'mesh' and s.get('bounds') for s in o['skus'])
    in_q = {m: {e['id'] for e in Q[m]} for m in ('fire', 'water', 'open')}
    n = {}
    n['lit_but_no_flame'] = sorted(o['id'] for o in objs.values() if 'lit' in o['aff'] and has_mesh(o) and o['id'] not in in_q['fire'])
    n['flame_but_not_lit'] = sorted(o['id'] for o in objs.values() if 'lit' not in o['aff'] and o['id'] in in_q['fire'])
    n['benchmd_fire_not_lit_by_game'] = sorted(i for i in S['benchmd']['fire'] if i not in in_q['fire'])
    n['manifest_light_not_lit_by_game'] = sorted(s for s in S['flag_fire'] if S['by_sku'][s]['id'] not in in_q['fire'])
    n['water_declared_only_in_bench_md'] = sorted(i for i in S['benchmd']['water'] if i not in S['declared']['water'])
    n['open_declared_but_catalog_has_no_open'] = sorted(i for i in bench['open'] if 'open' not in objs[i]['aff'] and not any(o.get('open_of') == i for o in objs.values()))
    n['openable_in_no_bench_md'] = sorted(i for i in in_q['open'] if i not in S['benchmd']['open'] and any(s['src'] not in ('inn-01', 'inn-01b', 'inn-02') for s in objs[i]['skus'] if s['kind'] == 'mesh'))
    n['open_twin_missing_closed'] = sorted(f"{o['id']} -> {o['open_of']}" for o in objs.values() if o.get('open_of') and has_mesh(o) and o['open_of'] not in in_q['open'])
    water_word = re.compile(r'(^|-)(font|fountain|well|pond|birdbath|cistern|pool|vat|basin|bath|pump|spring|moat)(-|$)')
    n['looks_like_water_undeclared'] = sorted(o['id'] for o in objs.values() if has_mesh(o) and o['id'] not in in_q['water'] and water_word.search(o['id']))
    open_word = re.compile(r'(^|-)(door|gate|hatch|trapdoor|chest|cabinet|cupboard|wardrobe|coffer|casket|strongbox|locker|shutter|cage)(-|$)')
    n['looks_openable_undeclared'] = sorted(o['id'] for o in objs.values() if has_mesh(o) and not o.get('open_of') and o['id'] not in in_q['open'] and open_word.search(o['id']))
    n['bench_md_names_not_in_library'] = dict(sorted(S['benchmd']['unresolved'].items()))
    return n


# ---------------------------------------------------------------- the rater
def run_pages(S):
    """The rater pages already live, apart from the combined one: [{dir, run, skus}]."""
    pages = []
    for p in sorted(S['dest'].glob('review*/assets.json')):
        d = p.parent.name
        if d == LIB_PAGE:
            continue
        payload = json.loads(p.read_text())
        assets = payload['assets']
        if d == 'review-01b':
            assets = [a for a in assets if a.get('model')]       # that page lists every plate; only these have a mesh
        pages.append({'dir': d, 'run': payload.get('run') or LEGACY_RUN.get(d, d), 'skus': [a['sku'] for a in assets]})
    return pages


def lib_assets(S, pages):
    """Library skus no older page shows under their own batch -> the combined page."""
    shown = {(p['run'], s) for p in pages for s in p['skus']}
    return sorted((s for s in S['skus'] if (s['src'], s['sku']) not in shown), key=lambda s: (s['src'], s['kind'], s['id'], s['sku']))


def plate_index(S):
    """mesh hash (sha1-8 of the source GLB, the '@xxxxxxxx' of a mesh id) -> the source GLB. Cached by path, size, time."""
    cache_p = Path(os.environ.get('XDG_CACHE_HOME', Path.home() / '.cache')) / 'tw-tool-sweep/glb-sha1.json'
    cache = json.loads(cache_p.read_text()) if cache_p.exists() else {}
    out, fresh = {}, {}
    for g in (S['bin'] / 'experiments').glob('**/models/*.glb'):
        st = g.stat(); key = str(g); sig = [st.st_size, int(st.st_mtime)]
        h = cache[key][1] if key in cache and cache[key][0] == sig else hashlib.sha1(g.read_bytes()).hexdigest()[:8]
        fresh[key] = [sig, h]; out.setdefault(h, []).append(g)
    if fresh != cache:
        cache_p.parent.mkdir(parents=True, exist_ok=True); cache_p.write_text(json.dumps(fresh))
    return out


def find_plate(index, sku):
    h = sku['mesh'].rsplit('@', 1)[-1]
    for g in index.get(h, []):
        for folder in (g.parent.parent / 'inputs', g.parent.parent.parent / 'inputs'):
            for stem in (g.stem, sku['sku']):
                for ext in ('jpg', 'jpeg', 'png', 'webp'):
                    p = folder / f'{stem}.{ext}'
                    if p.exists():
                        return p
    return None


def write_if_changed(path, data):
    path = Path(path); data = data if isinstance(data, bytes) else data.encode()
    if path.exists() and path.read_bytes() == data:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.tmp'); tmp.write_bytes(data); os.chmod(tmp, 0o644); tmp.replace(path)
    return True


def jpeg(src, out, side=640):
    from PIL import Image
    im = Image.open(src)
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA'); bg = Image.new('RGB', im.size, (58, 63, 56)); bg.paste(im, mask=im.split()[3]); im = bg
    else:
        im = im.convert('RGB')
    im.thumbnail((side, side))
    out.parent.mkdir(parents=True, exist_ok=True); im.save(out, 'JPEG', quality=86); os.chmod(out, 0o644)


def card_glb(src, out, side=512):
    """A flat as a model the rater can turn: an upright two-sided card carrying the flat's own image."""
    from PIL import Image
    im = Image.open(src).convert('RGBA'); im.thumbnail((side, side))
    alpha = im.getextrema()[3][0] < 250
    buf = io.BytesIO(); (im if alpha else im.convert('RGB')).save(buf, 'PNG'); png = buf.getvalue()
    w, h = im.size; hw, hh = w / max(w, h) / 2, h / max(w, h) / 2
    pos = struct.pack('<12f', -hw, -hh, 0, hw, -hh, 0, hw, hh, 0, -hw, hh, 0)
    nrm = struct.pack('<12f', *([0, 0, 1] * 4)); uv = struct.pack('<8f', 0, 1, 1, 1, 1, 0, 0, 0); idx = struct.pack('<6H', 0, 1, 2, 0, 2, 3)
    parts = [pos, nrm, uv, idx, png]; views = []; blob = b''
    for p in parts:
        views.append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(p)}); blob += p + b'\0' * (-len(p) % 4)
    gltf = {'asset': {'version': '2.0', 'generator': 'tw tool-sweep'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
            'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
            'materials': [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 1},
                           'doubleSided': True, **({'alphaMode': 'BLEND'} if alpha else {})}],
            'textures': [{'source': 0}], 'images': [{'bufferView': 4, 'mimeType': 'image/png'}],
            'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': 4, 'type': 'VEC3', 'min': [-hw, -hh, 0], 'max': [hw, hh, 0]},
                          {'bufferView': 1, 'componentType': 5126, 'count': 4, 'type': 'VEC3'},
                          {'bufferView': 2, 'componentType': 5126, 'count': 4, 'type': 'VEC2'},
                          {'bufferView': 3, 'componentType': 5123, 'count': 6, 'type': 'SCALAR'}],
            'bufferViews': views, 'buffers': [{'byteLength': len(blob)}]}
    js = json.dumps(gltf, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
    data = struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(blob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + blob
    out.parent.mkdir(parents=True, exist_ok=True); out.write_bytes(data); os.chmod(out, 0o644)


def catalog_roles():
    sys.path.insert(0, str(ROOT / 'src'))
    import catalog_tool as ct
    roles = {}
    for path in sorted((ROOT / 'catalog').glob('*.catalog.md')):
        roles.update(ct.parse_catalog(path)[0])
    return roles, ct.SETTINGS


def clean(h):
    h = re.sub(r'^[A-Z]+\d*[a-z]?\.\s*', '', h or '')
    return re.split(r'\s+[—-]\s+', h)[0].strip()


def build_rater(S, pages, plan=False):
    """-> (assets.json payload, meta.json payload, counts). Writes plates and flat cards into <dest>/review-lib/assets."""
    todo = lib_assets(S, pages)
    out_dir = S['dest'] / LIB_PAGE
    roles, settings = catalog_roles()
    index = plate_index(S) if any(s['kind'] == 'mesh' for s in todo) else {}
    assets, meta, made = [], {}, {'plates': 0, 'cards': 0, 'no_plate': []}
    for s in todo:
        o = S['objects'][s['id']]; sku = s['sku']; flat = s['kind'] == 'flat'
        shipped = S['bin'] / 'tools/spawn-tuner' / s['url']
        plate_out = out_dir / 'assets/plates' / f'{sku}.jpg'
        src_plate = shipped if flat else find_plate(index, s)
        if src_plate and src_plate.exists() and not plan and (not plate_out.exists() or plate_out.stat().st_mtime < src_plate.stat().st_mtime):
            jpeg(src_plate, plate_out); made['plates'] += 1
        has_plate = bool(src_plate and src_plate.exists())
        if not has_plate: made['no_plate'].append(f"{s['src']}/{sku}")
        a = {'sku': sku, 'run': s['src'], 'name': o['desc'], 'priority': o['pri'], 'material': o['mat'], 'placement': o['place'], 'rooms': '',
             'group': s['kind'], 'hint': o.get('hint') or '', 'bytes': shipped.stat().st_size if shipped.exists() else int(s.get('kb', 0)) * 1024}
        if flat:
            card = out_dir / 'assets/models' / f'{sku}.glb'
            if shipped.exists() and not plan and (not card.exists() or card.stat().st_mtime < shipped.stat().st_mtime):
                card_glb(shipped, card); made['cards'] += 1
        else:
            a['model'] = f"../tuner/{s['url']}"
        if not has_plate: a['plate'] = False
        assets.append(a)
        role = roles.get(s['id'])
        gen = datetime.datetime.fromtimestamp(shipped.stat().st_mtime).astimezone().isoformat(timespec='minutes') if shipped.exists() else None
        kind = 'Flat (floor, rug, decal)' if flat else 'Kit piece (wall, door, stair)' if o['place'] == 'kit' else 'Mesh'
        meta[sku] = {'domain': kind, 'role': clean(role['domain']) if role else 'Uncatalogued', 'themes': sorted(role['set']) if role else [], 'gen': gen}
    batches = sorted({a['run'] for a in assets})
    payload = {'run': 'library', 'label': 'Library', 'complete': len(assets), 'expectedMeshes': sum(a['group'] == 'mesh' for a in assets),
               'flatAssets': sum(a['group'] == 'flat' for a in assets), 'assets': assets}
    return payload, {'settings': settings, 'batches': {b: b for b in batches}, 'assets': meta}, made


# ---------------------------------------------------------------- publishing
def stamp(path):
    return hashlib.sha1(Path(path).read_bytes()).hexdigest()[:10]


def publish(S, plan=False):
    dest = S['dest']
    bench = bench_lists(S)
    Q = membership(S, bench)
    pages = run_pages(S)
    payload, meta, made = build_rater(S, pages, plan)
    N = notes(S, Q, bench)
    box = lambda sku: {'size': S['objects'][S['by_sku'][sku]['id']]['size'], 'bounds': S['by_sku'][sku]['bounds'], 'desc': S['objects'][S['by_sku'][sku]['id']]['desc']}
    pairs = [{'id': e['id'], 'sku': e['sku'], 'mesh': e['mesh'], 'url': e['url'], 'kind': e['kind'], **box(e['sku']),
              'open': {**e['twin'], **box(e['twin']['sku'])}} for e in Q['open'] if e.get('twin')]
    by_batch = {}
    for a in payload['assets']: by_batch.setdefault(a['run'], []).append(a['sku'])
    queues = {
        'rater': [{'href': f"{p['dir']}/", 'label': p['run'], 'runs': {p['run']: p['skus']}} for p in pages if p['dir'] != 'review-01b' or p['skus']]
                 + [{'href': f'{LIB_PAGE}/', 'label': 'library (every batch since the inn)', 'batch_links': True, 'runs': dict(sorted(by_batch.items()))}],
        'bench': {m: [e['mesh'] for e in Q[m]] for m in ('fire', 'water', 'open')},
        'bench_by_batch': {m: _count(e['mesh'].split('/')[0] for e in Q[m]) for m in ('fire', 'water', 'open')},
        'pairs': len(pairs), 'figures': len(S['figures']), 'notes': N, 'bench_md': S['benchmd']['files'],
        # the Wall fit bench's queue (tuner/wallbench.html): every wall family that has pieces of its own
        'wall_families': sorted({k['family'] for oid in ('wall-straight', 'wall-doorway', 'wall-window-small') for k in S['objects'].get(oid, {}).get('skus', []) if k.get('family') and k.get('kind') == 'mesh' and k.get('bounds')}),
    }
    line = (f"tool sweep: rater {payload['complete']} in {LIB_PAGE} ({payload['expectedMeshes']} meshes, {payload['flatAssets']} flats, "
            f"{len(by_batch)} batches; {len(made['no_plate'])} without a source plate) + {sum(len(p['skus']) for p in pages)} on {len(pages)} older pages · "
            f"bench fire {len(Q['fire'])} / water {len(Q['water'])} / open-shut {len(Q['open'])} · pairs {len(pairs)}")
    if plan:
        print(line); print(json.dumps({'batches': {b: len(v) for b, v in by_batch.items()}, 'bench_by_batch': queues['bench_by_batch'], 'notes': N}, indent=1)); return 0
    changed = []
    # 1. the combined rater page: data to a stage, page code through the shared deploy script (content-hash stamps)
    lib_dir = dest / LIB_PAGE; (lib_dir / 'assets/models').mkdir(parents=True, exist_ok=True); (lib_dir / 'assets/plates').mkdir(parents=True, exist_ok=True)
    keep = {f"{a['sku']}.glb" for a in payload['assets'] if a['group'] == 'flat'}
    for old in (lib_dir / 'assets/models').glob('*.glb'):
        if old.name not in keep: old.unlink()
    keep = {f"{a['sku']}.jpg" for a in payload['assets']}
    for old in (lib_dir / 'assets/plates').glob('*.jpg'):
        if old.name not in keep: old.unlink()
    with tempfile.TemporaryDirectory() as stage:
        (Path(stage) / 'assets.json').write_text(json.dumps(payload, indent=1) + '\n'); (Path(stage) / 'meta.json').write_text(json.dumps(meta, indent=1) + '\n')
        before = {f: stamp(lib_dir / f) for f in ('assets.json', 'meta.json', 'review.js', 'index.html', 'review.css') if (lib_dir / f).exists()}
        subprocess.run(['bash', str(ROOT / 'src/deploy_review.sh'), str(lib_dir)], check=True, capture_output=True,
                       env={**os.environ, 'REVIEW_SRC': stage, 'REVIEW_KEEP_META': '1'})
        if before != {f: stamp(lib_dir / f) for f in ('assets.json', 'meta.json', 'review.js', 'index.html', 'review.css')}: changed.append(LIB_PAGE)
    # 2. the lists
    qd = dest / 'queues'; qd.mkdir(exist_ok=True)
    for name, data in (('bench.json', bench), ('pairs.json', {'pairs': pairs}), ('queues.json', queues)):
        if write_if_changed(qd / name, json.dumps(data, indent=1, sort_keys=True) + '\n'): changed.append(f'queues/{name}')
    # 3. the "what is waiting" page and the open/shut pairs page (content-hash stamped: Cloudflare keeps js for hours)
    js = (ROOT / 'web/queues/queues.js').read_bytes()
    if write_if_changed(qd / 'queues.js', js): changed.append('queues/queues.js')
    v = stamp(qd / 'queues.js')
    if write_if_changed(qd / 'index.html', (ROOT / 'web/queues/index.html').read_text().replace('queues.js?v=0', f'queues.js?v={v}')): changed.append('queues/index.html')
    if write_if_changed(dest / 'openclose/pairs/index.html', (ROOT / 'web/openclose-pairs/index.html').read_text()): changed.append('openclose/pairs')
    # 4. the landing page: one block between two markers, everything else as it is
    landing = dest / 'index.html'
    if landing.exists():
        html = landing.read_text()
        block = f'{MARK[0]}\n    <section id="tw-queues" data-base=""></section>\n    <script type="module" src="queues/queues.js?v={v}"></script>\n    {MARK[1]}'
        if MARK[0] in html:
            new = re.sub(re.escape(MARK[0]) + r'[\s\S]*?' + re.escape(MARK[1]), lambda _: block, html)
        else:
            i = html.find('<nav')
            new = html[:i] + block + '\n    ' + html[i:] if i > 0 else html
        if new != html:
            keep = landing.with_name(f'index.html.bak-{datetime.date.today()}-queues')
            if not keep.exists(): shutil.copy2(landing, keep)
            write_if_changed(landing, new); changed.append('index.html')
    # 5. the bench itself (a no-op when nothing changed: its URLs are content hashes)
    before = stamp(dest / 'align/index.html') if (dest / 'align/index.html').exists() else None
    subprocess.run(['bash', str(ROOT / 'web/align/deploy.sh'), str(dest / 'align')], check=True, capture_output=True)
    if before != stamp(dest / 'align/index.html'): changed.append('align')
    for d in (qd, lib_dir, dest / 'openclose/pairs'):
        for p in [d, *d.rglob('*')]:
            if p.is_symlink(): continue
            want = 0o755 if p.is_dir() else 0o644
            if (p.stat().st_mode & 0o777) != want: os.chmod(p, want)
    print(line + (f" · published: {', '.join(changed)}" if changed else ' · nothing new'))
    return 0


def _count(it):
    c = {}
    for x in it: c[x] = c.get(x, 0) + 1
    return dict(sorted(c.items()))


if __name__ == '__main__':
    S = load(opt('--dest'), opt('--bin'))
    sys.exit(publish(S, plan='--plan' in sys.argv))

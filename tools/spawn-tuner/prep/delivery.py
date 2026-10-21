#!/usr/bin/env python3
"""The delivered copies of the asset library (docs/ASSET_DELIVERY.md).            2026-10-11

  python3 tools/spawn-tuner/prep/delivery.py              build what is missing, write assets/delivery.json
  ... --check        nothing is written: exit 1 if a listed file has no delivered copy (deploy gate, assets_check.py)
  ... --raw          delivered meshes are plain copies (no compression)       ... --jobs N   compressors at once (3)
  ... --dir DIR      another tuner tree                                        ... --prune-days N  (14)
  ... --only REGEX   (trying something out) only names that match get a delivered copy; the rest stay on their sources

Every asset the library lists (data/library.json, data/figures.json: the same list test/assets_check.py checks) gets a
delivered copy  assets/d/<folder>/<name>.<token>.<ext>  beside the source, which is never touched:
  .glb    meshopt-compressed with quantization (prep/meshopt.mjs, checked against its source file by file)
  other   a hard link to the source (same bytes; the token in the name is what makes it cacheable for good)
<token> = 8 hex of a hash over every delivered file of that NAME (a sku's mesh at each face count, its colour map at
each size, its shipping GLB), so a name's addresses all change together when any of its files does, and never
otherwise. assets/delivery.json = {"tokens": {name: token}} is what the client reads (js/delivery.js).
A name is listed only when EVERY one of its listed files has its delivered copy; until then the client fetches the
sources as before. Old delivered files stay for --prune-days after they stop being current, so a browser still running
yesterday's client finds them. State: assets/d/.cache.json (what was built from which source size + time).
"""
import fcntl, hashlib, json, os, pathlib, shutil, subprocess, sys, time
HERE = pathlib.Path(__file__).resolve().parent
RECIPE_GLB = 'meshopt-high-1'   # change the name when prep/meshopt.mjs changes what it writes: everything is rebuilt
opt = lambda k, d: next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == k and i + 1 < len(sys.argv)), d)


def listed(T):
    """logical address -> why it is listed. The files the client can be told to fetch (assets_check.py's list)."""
    T = pathlib.Path(T); out = {}
    lib = json.loads((T / 'data/library.json').read_text())['objects']
    faces = sorted(p.name for p in (T / 'assets/lod').glob('f*')); skins = sorted(p.name for p in (T / 'assets/tex').glob('t*'))
    for o in lib.values():
        for s in o['skus']:
            if not s.get('url') or (s.get('kind') == 'mesh' and not s.get('bounds')): continue
            out[s['url']] = s['sku']
            if s.get('kind') == 'mesh':
                for f in faces: out[f"assets/lod/{f}/{s['sku']}.glb"] = s['sku'] + ' ladder'
                for t in skins: out[f"assets/tex/{t}/{s['sku']}.webp"] = s['sku'] + ' ladder'
    figs = T / 'data/figures.json'
    if figs.exists():
        for f in json.loads(figs.read_text()).get('figures', []):
            out[f['url']] = 'figure ' + f['id']
            if f.get('full'): out[f['full']] = 'figure ' + f['id'] + ' original'
    return out


def name_of(url): return url.rsplit('/', 1)[-1].rsplit('.', 1)[0]
def delivered(url, token): p, ext = url.rsplit('.', 1); return f"assets/d/{p[len('assets/'):]}.{token}.{ext}"
def sha8(path):
    h = hashlib.sha1()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()[:8]
def is_meshopt(path):
    with open(path, 'rb') as f:
        head = f.read(20); n = int.from_bytes(head[12:16], 'little')
        return b'EXT_meshopt_compression' in f.read(n)


def check(T, raw=None):
    """-> (problems, counts). Every listed file that exists must have its delivered copy, named by the manifest."""
    T = pathlib.Path(T); man = T / 'assets/delivery.json'
    if not man.exists(): return ['assets/delivery.json is missing (python3 tools/spawn-tuner/prep/delivery.py)'], {}
    M = json.loads(man.read_text()); tok = M.get('tokens', {}); raw = M.get('recipe') == 'raw' if raw is None else raw
    bad = []; n = 0
    for url in listed(T):
        if not (T / url).exists(): continue  # (a listed file with no source is assets_check.py's own finding)
        t = tok.get(name_of(url)); n += 1
        if not t: bad.append(f'{url}: no delivered copy is listed'); continue
        d = T / delivered(url, t)
        if not d.exists(): bad.append(f'{url}: its delivered copy {delivered(url, t)} is missing')
        elif url.endswith('.glb') and not raw and not is_meshopt(d): bad.append(f'{url}: its delivered copy is not compressed')
    return bad, {'listed': n, 'names': len(tok), 'recipe': M.get('recipe')}


def build(T, raw=False, jobs=3, prune_days=14, quiet=False, only=None):
    T = pathlib.Path(T); A = (T / 'assets').resolve(); D = A / 'd'; D.mkdir(exist_ok=True)
    say = (lambda *a: None) if quiet else (lambda *a: print(*a, flush=True))
    lock = open(D / '.lock', 'w'); fcntl.flock(lock, fcntl.LOCK_EX)
    cpath = D / '.cache.json'; C = json.loads(cpath.read_text()) if cpath.exists() else {}
    files = C.setdefault('files', {}); retired = C.setdefault('retired', {})
    L = listed(T); now = time.time(); todo = []; missing = []
    if only: import re; L = {u: w for u, w in L.items() if re.search(only, name_of(u))}
    # 1. what each listed file's delivered bytes are (built now if its source changed or it was never built)
    for url in L:
        src = T / url
        if not src.exists(): missing.append(url); continue
        st = src.stat(); recipe = RECIPE_GLB if url.endswith('.glb') and not raw else 'raw'
        sig = [st.st_size, st.st_mtime_ns, recipe]; rec = files.get(url)
        if rec and rec['sig'] == sig and (recipe == 'raw' or (rec.get('at') and (T / rec['at']).exists())): continue
        if recipe == 'raw': files[url] = {'sig': sig, 'sha': sha8(src), 'at': None}
        else: todo.append((url, sig))
    if todo:
        tmp = D / '.tmp'; tmp.mkdir(exist_ok=True)
        say(f'delivery: compressing {len(todo)} mesh file(s) ({jobs} at once)')
        if not (HERE / 'node_modules/@gltf-transform/core').exists():
            subprocess.run(['npm', 'ci', '--no-audit', '--no-fund'], cwd=HERE, check=True, stdout=subprocess.DEVNULL)
        work = [(url, sig, tmp / (hashlib.sha1(url.encode()).hexdigest()[:16] + '.glb')) for url, sig in todo]
        procs = []
        for k in range(jobs):
            part = work[k::jobs]
            if not part: continue
            jf = tmp / f'jobs-{os.getpid()}-{k}.json'; jf.write_text(json.dumps([[str(T / u), str(o)] for u, _s, o in part]))
            procs.append((subprocess.Popen(['node', str(HERE / 'meshopt.mjs'), str(jf)], stdout=subprocess.PIPE, text=True), part, jf))
        failed = []
        for p, part, jf in procs:
            res = {}
            for line in p.stdout:
                try: r = json.loads(line)
                except ValueError: continue
                res[r['in']] = r
                if not quiet and len(res) % 500 == 0: say(f'   … {len(res)} of {len(part)} in one compressor')
            p.wait(); jf.unlink(missing_ok=True)
            for url, sig, o in part:
                r = res.get(str(T / url))
                if r and r.get('ok') and o.exists(): files[url] = {'sig': sig, 'sha': sha8(o), 'at': None, 'tmp': str(o), 'err': r.get('err')}
                else: failed.append((url, (r or {}).get('why', 'the compressor stopped'))); files.pop(url, None)
        for url, why in failed[:30]: say(f'   NOT COMPRESSED {url}: {why}')
        if failed: say(f'delivery: {len(failed)} mesh file(s) could not be compressed; their names are served from the sources')
    # 2. one token per name, over every delivered file of that name; link the files into place under it
    by = {}
    for url in L: by.setdefault(name_of(url), []).append(url)
    tokens = {}; current = set(); made = 0
    for name, urls in by.items():
        if any(u not in files for u in urls): continue  # (a source missing or a mesh that failed: this name stays on its sources)
        token = hashlib.sha1('\n'.join(f"{u}:{files[u]['sig'][2]}:{files[u]['sha']}" for u in sorted(urls)).encode()).hexdigest()[:8]
        ok = True
        for u in urls:
            rec = files[u]; rel = delivered(u, token); dst = T / rel
            if not dst.exists():
                srcs = [T / u] if rec['sig'][2] == 'raw' else [pathlib.Path(p) for p in (rec.get('tmp'), rec.get('at') and str(T / rec['at'])) if p and pathlib.Path(p).exists()]
                if not srcs: ok = False; files.pop(u); continue  # (its built file was pruned: next run rebuilds it)
                dst.parent.mkdir(parents=True, exist_ok=True)
                try: os.link(srcs[0].resolve(), dst)
                except OSError: shutil.copy2(srcs[0], dst)
                os.chmod(dst, 0o644); made += 1
            rec['at'] = rel; current.add(rel)
        if ok: tokens[name] = token
    for rec in files.values():
        t = rec.pop('tmp', None)
        if t: pathlib.Path(t).unlink(missing_ok=True)
    for url in [u for u in files if u not in L]: files.pop(url)
    # 3. yesterday's delivered files stay a while (a browser still running the previous client asks for them)
    gone = 0
    for p in D.rglob('*'):
        if not p.is_file() or p.name.startswith('.') or '.tmp' in p.parts: continue
        rel = 'assets/' + str(p.relative_to(A))
        if rel in current: retired.pop(rel, None); continue
        if rel not in retired: retired[rel] = now
        elif now - retired[rel] > prune_days * 86400: p.unlink(); retired.pop(rel); gone += 1
    for rel in [r for r in retired if not (T / r).exists()]: retired.pop(rel)
    man = {'v': 1, 'recipe': 'raw' if raw else RECIPE_GLB, 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'tokens': dict(sorted(tokens.items()))}
    old = json.loads((A / 'delivery.json').read_text()) if (A / 'delivery.json').exists() else {}
    if old.get('tokens') != man['tokens'] or old.get('recipe') != man['recipe']:
        t = A / '.delivery.json.tmp'; t.write_text(json.dumps(man, separators=(',', ':'))); os.chmod(t, 0o644); os.replace(t, A / 'delivery.json')
    t = D / '.cache.json.tmp'; t.write_text(json.dumps(C)); os.replace(t, cpath)
    say(f"delivery: {len(tokens)} names, {len(current)} delivered files ({made} new, {len(retired)} kept from before, {gone} pruned)" + (f"; {len(missing)} listed files have no source" if missing else ''))
    return tokens


if __name__ == '__main__':
    T = pathlib.Path(opt('--dir', HERE.parent)).resolve()
    if '--check' in sys.argv:
        bad, n = check(T)
        for b in bad[:40]: print('   NOT DELIVERED', b)
        print(f"delivery: {n.get('listed', 0)} listed files, {len(bad)} without a delivered copy ({n.get('recipe')})"); sys.exit(1 if bad else 0)
    build(T, raw='--raw' in sys.argv, jobs=int(opt('--jobs', 3)), prune_days=float(opt('--prune-days', 14)), quiet='--quiet' in sys.argv, only=opt('--only', None))

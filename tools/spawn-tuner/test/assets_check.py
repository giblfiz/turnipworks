#!/usr/bin/env python3
"""Nothing may be listed without its file (2026-10-05: six castle / mansion floors were listed live with no image,
because build_data.py had picked their PNGs up from a batch folder before prep/flats.py had converted them).

  python3 tools/spawn-tuner/test/assets_check.py                 the working tree (what a deploy would ship)
  python3 tools/spawn-tuner/test/assets_check.py --live          the two live hosts, by HTTP (HEAD): what is new or changed since
                                                                 it was last seen live (seconds). --live-full: everything (minutes)
  ... --quiet   only the totals        ... --dir DIR   another tuner tree (a sandbox, the deployed folder)

Checked, from data/library.json: every sku `url` (assets/m/*.glb, assets/flat/*.webp); for every mesh sku every file the
faces x skins dials can ask for (assets/lod/f<N>/<sku>.glb for each N in assets/lod, assets/tex/t<N>/<sku>.webp for each
N in assets/tex); every wall family in walls.js WALL_FAMILIES has a usable wall-straight piece with its file.
From data/figures.json (the figure library, pawns): every figure's mesh (assets/figures/*.glb) and thumbnail.
From the engine: room-<key>.png for every room type in data/rooms.json, type-<CODE>.png and genre icons named by
engine/client/data/types.json, and every roof section named by engine/client/data/roofsections.json. Exit code 1 if anything is missing. deploy.sh runs this and stops on a miss.
DELIVERED COPIES (2026-10-11, prep/delivery.py, docs/ASSET_DELIVERY.md): every listed file that exists must have its
delivered copy (assets/d/…<token>…, named by assets/delivery.json), and a delivered mesh must be compressed. A tree with
no assets/delivery.json at all is not checked for them (a sandbox; deploy.sh always builds it first); --live checks
the copies each host's own manifest names.
"""
import json, re, sys, pathlib, urllib.request, concurrent.futures as cf
HERE = pathlib.Path(__file__).resolve().parent; ROOT = HERE.parents[2]
opt = lambda k, d: next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == k and i + 1 < len(sys.argv)), d)
T = pathlib.Path(opt('--dir', HERE.parent)).resolve(); QUIET = '--quiet' in sys.argv
ENG = ROOT / 'engine/client'
lib = json.loads((T / 'data/library.json').read_text())['objects']; rooms = json.loads((T / 'data/rooms.json').read_text())
faces = sorted(p.name for p in (T / 'assets/lod').glob('f*')) or ['f1500', 'f3000', 'f5000', 'f10000', 'f20000', 'ffull']
skins = sorted(p.name for p in (T / 'assets/tex').glob('t*')) or ['t64', 't128', 't256', 't512', 't1024', 't2048']
tuner, why = [], {}
for oid, o in lib.items():
    for s in o['skus']:
        if not s.get('url') or (s.get('kind') == 'mesh' and not s.get('bounds')): continue  # (a mesh with no runtime bounds is never chosen or requested)
        tuner.append(s['url']); why[s['url']] = f"{s['sku']} ({s.get('src')})"
        if s.get('kind') == 'mesh':
            for f in faces: u = f"assets/lod/{f}/{s['sku']}.glb"; tuner.append(u); why[u] = f"{s['sku']} ladder"
            for t in skins: u = f"assets/tex/{t}/{s['sku']}.webp"; tuner.append(u); why[u] = f"{s['sku']} ladder"
# the FIGURE library (pawns; data/figures.json, built by build_figures.py): each figure's mesh and its thumbnail
figs_file = T / 'data/figures.json'
if figs_file.exists():
    for f in json.loads(figs_file.read_text()).get('figures', []):
        tuner.append(f['url']); why[f['url']] = f"figure {f['id']}"
        if f.get('thumb'): tuner.append(f['thumb']); why[f['thumb']] = f"figure {f['id']} thumbnail"
        if f.get('full'): tuner.append(f['full']); why[f['full']] = f"figure {f['id']} original (main pawns)"
problems = []
fams = re.search(r"WALL_FAMILIES\s*=\s*\[([^\]]*)\]", (T / 'js/walls.js').read_text()); fams = re.findall(r"'([^']+)'", fams.group(1)) if fams else []
fams += re.findall(r"WALL_FAMILIES\.push\(([^)]*)\)", (T / 'js/walls.js').read_text()) and [f for m in re.findall(r"WALL_FAMILIES\.push\(([^)]*)\)", (T / 'js/walls.js').read_text()) for f in re.findall(r"'([^']+)'", m)]
for f in sorted(set(fams)):
    if not any(s.get('family') == f and s.get('bounds') and s.get('url') for s in lib.get('wall-straight', {}).get('skus', [])): problems.append(f"wall family {f}: no wall-straight piece with bounds in the library")
types = json.loads((ENG / 'data/types.json').read_text())
icons = [f"data/icons/room-{r['key']}.png" for r in rooms] + [f"data/icons/type-{t['code']}.png" for t in types.get('types', [])] + [f"data/icons/genre-{g['key']}.png" for g in types.get('genres', []) if isinstance(g, dict) and g.get('key')]

# the roof sections (2026-10-11): every file engine/client/data/roofsections.json names (checked with the icons: same folder, same hosts)
rs = ENG / 'data/roofsections.json'
if rs.exists(): icons += [f"data/{v['url']}" for v in json.loads(rs.read_text()).get('sections', {}).values()]

def report(name, total, miss):
    print(f"{name}: {total} checked, {len(miss)} missing")
    if not QUIET:
        for m in miss[:40]: print('   MISSING', m, '<-', why.get(m.split('/', 1)[-1] if m not in why else m, why.get(m, '')))
        if len(miss) > 40: print(f'   ... and {len(miss) - 40} more')
    return len(miss)

sys.path.insert(0, str(HERE.parent / 'prep')); import delivery  # noqa: E402
if '--live' not in sys.argv and (T / 'assets/delivery.json').exists():
    dbad, dn = delivery.check(T)
    print(f"delivered copies: {dn.get('listed', 0)} checked, {len(dbad)} missing ({dn.get('recipe')})")
    if not QUIET:
        for b in dbad[:40]: print('   NOT DELIVERED', b)
    if dbad and QUIET: print('   (python3 tools/spawn-tuner/prep/delivery.py builds them)')
    problems += [None] * len(dbad)
bad = len(problems)
for p in problems:
    if p: print('   PROBLEM', p)
if '--live' in sys.argv:
    # FAST BY DEFAULT (2026-10-12: the exhaustive pass was 75,000 HEADs through Cloudflare, half an hour inside a landing).
    #   a delivered copy never changes under its name: once seen live (200) it is never asked for again;
    #   a plain listed path is asked for again only when its local file has changed since it was last seen live.
    # What has been seen is kept per host in ~/.cache/tw-assets-check/ (safe to delete: the next run is the full one).
    # --live-full asks for everything regardless. Connections are kept open and reused, 32 at a time.
    # --live-public: every question through the public address (slow; from a machine that is not the origin it is the only way).
    import http.client, threading, time, urllib.parse
    FULL = '--live-full' in sys.argv; PUBLIC = '--live-public' in sys.argv; CACHE = pathlib.Path.home() / '.cache/tw-assets-check'; CACHE.mkdir(parents=True, exist_ok=True)
    local = threading.local()
    def head(u, origin=False):
        pu = urllib.parse.urlsplit(u); r = None; key = (pu.netloc, origin)
        for k in range(4):  # a network error (TLS handshake, timeout) is retried on a new connection; an HTTP status is an answer
            try:
                local.c = getattr(local, 'c', {}); c = local.c.get(key)
                if c is None: c = local.c[key] = http.client.HTTPConnection('127.0.0.1', 80, timeout=30) if origin else http.client.HTTPSConnection(pu.netloc, timeout=30)
                c.request('HEAD', pu.path + ('?' + pu.query if pu.query else ''), headers={'User-Agent': 'tw-assets-check', 'Host': pu.netloc}); resp = c.getresponse(); resp.read(); return resp.status
            except Exception as e:
                r = str(e)[:40] or type(e).__name__
                try: local.c.pop(key).close()
                except Exception: pass
                time.sleep(0.5 + k)
        return r
    def body(u, origin):
        pu = urllib.parse.urlsplit(u); c = http.client.HTTPConnection('127.0.0.1', 80, timeout=15) if origin else http.client.HTTPSConnection(pu.netloc, timeout=30)
        c.request('GET', pu.path + '?t=%d' % time.time(), headers={'User-Agent': 'tw-assets-check', 'Host': pu.netloc}); return c.getresponse().read()
    def at_origin(base):  # is this machine the origin behind that host? (its own nginx answers with the same deploy as the public address)
        if PUBLIC: return False
        try: a = body(base + 'version.json', True); return bool(a) and a == body(base + 'version.json', False)
        except Exception: return False
    def ask_all(urls, origin, label):
        res = {}; t0 = time.time()
        with cf.ThreadPoolExecutor(32 if origin else 16) as ex:
            for i, (u, r) in enumerate(zip(urls, ex.map(lambda x: head(x, origin), urls)), 1):
                res[u] = r
                if i % 5000 == 0 or (not origin and i % 200 == 0): print(f'   … {label}: {i} of {len(urls)} asked, {sum(1 for v in res.values() if v != 200)} not there, {time.time() - t0:.0f} s', flush=True)
        return res
    sig = lambda f: (lambda st: [st.st_size, st.st_mtime_ns])(f.stat()) if f.exists() else None
    # (2026-10-19, two servers: deploys go to DEV, so the live check asks dev.turnipworks.net, never prod. Prod serves
    # a pinned release that is BEHIND the source between nightly rolls; tools/release.sh verify checks prod.)
    import socket
    def resolves(h):
        try: socket.getaddrinfo(h, 443); return True
        except OSError: return False
    for name, tbase, ebase in (('implausible.enterprises', 'https://implausible.enterprises/projects/turnip-works/tuner/', 'https://implausible.enterprises/projects/turnip-works/engine/client/'),
                               ('dev.turnipworks.net', 'https://dev.turnipworks.net/look/', 'https://dev.turnipworks.net/engine/client/')):
        public_ok = resolves(urllib.parse.urlsplit(tbase).hostname)
        cfile = CACHE / f'{name}.json'
        try: seen = json.loads(cfile.read_text())
        except Exception: seen = {}
        seen.setdefault('delivered', {}); seen.setdefault('plain', {})
        plain = {tbase + u: sig(T / u) for u in tuner}; plain.update({ebase + u: sig(ENG / u) for u in icons})
        dl = []
        try:  # the delivered copies this host's own manifest names
            tok = json.loads(urllib.request.urlopen(urllib.request.Request(tbase + 'assets/delivery.json?t=%d' % time.time(), headers={'User-Agent': 'tw-assets-check'}), timeout=30).read()).get('tokens', {}) if public_ok else json.loads(body(tbase + 'assets/delivery.json', True)).get('tokens', {})
            dl = [tbase + delivery.delivered(u, tok[delivery.name_of(u)]) for u in tuner if u.startswith('assets/') and delivery.name_of(u) in tok and '/thumbs/' not in u]
        except Exception as e: print(f'{name}: no delivery manifest ({str(e)[:60]})')
        ask = [u for u in dl if FULL or u not in seen['delivered']] + [u for u, g in plain.items() if FULL or g is None or seen['plain'].get(u) != g]
        print(f"{name}: {len(dl) + len(plain)} listed ({len(dl)} delivered copies of {len(tok) if dl else 0} names, {len(plain)} plain paths); asking for {len(ask)}" + ('' if FULL else f" (the rest were seen live and have not changed; --live-full asks for all)"), flush=True)
        # WHERE: on the machine that IS the origin (the build box) every address is asked of the origin's own nginx with the
        # site's Host header: the same files through the same server rules, without the edge in between (through
        # Cloudflare a HEAD takes 0.3 to 1.6 s). A sample then goes the public way, to see the edge passes them on.
        origin = at_origin(tbase) if public_ok else not PUBLIC  # (no public name yet: the origin is the only way to ask)
        if not public_ok: print(f"   {name} has no public DNS record yet: asked at this machine's nginx only", flush=True)
        res = ask_all(ask, origin, 'at the origin' if origin else 'public address')
        if origin and ask and public_ok:
            import random
            sample = random.Random(len(ask)).sample(ask, min(len(ask), 400 if FULL else 60)); pub = ask_all(sample, False, 'public address (a sample)')
            for u, r in pub.items():
                if r != 200: res[u] = f'{r} at the public address, 200 at the origin' if res[u] == 200 else r
            print(f"   {len(ask)} asked at the origin, {len(sample)} of them at the public address too", flush=True)
        for u, r in res.items():
            if r != 200: seen['delivered'].pop(u, None); seen['plain'].pop(u, None)
            elif u in plain: seen['plain'][u] = plain[u]
            else: seen['delivered'][u] = 1
        cur = set(dl)
        if len(seen['delivered']) > 4 * max(1, len(cur)): seen['delivered'] = {u: 1 for u in seen['delivered'] if u in cur}  # (old names: forgotten in the end)
        tmp = cfile.with_suffix('.tmp'); tmp.write_text(json.dumps(seen)); tmp.replace(cfile)
        miss = [f"{u} [{r}]" for u, r in res.items() if r != 200]
        bad += report(name, len(dl) + len(plain), miss)
else:
    miss = [u for u in tuner if not (T / u).exists()] + [f"engine/client/{u}" for u in icons if not (ENG / u).exists()]
    bad += report(str(T.relative_to(ROOT)) if T.is_relative_to(ROOT) else str(T), len(tuner) + len(icons), miss)
sys.exit(1 if bad else 0)

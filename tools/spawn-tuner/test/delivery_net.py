#!/usr/bin/env python3
"""What a real browser fetches for a table, twice: redirects, cache headers, and what the second visit re-downloads.
(2026-10-11, docs/ASSET_DELIVERY.md)

  python3 tools/spawn-tuner/test/delivery_net.py              the live game
  ... --page URL --relay URL      another site (a local stack: --page http://127.0.0.1:P/engine/client/index.html?relay=…)
  ... --rooms inn                 a whole inn's rooms instead of one common room      ... --json FILE

Makes one throwaway campaign on that relay (deleted at exit), spawns a common room and two pawns, opens it in a fresh
browser profile (visit 1), closes the page and opens it again in the SAME profile (visit 2). Exit 1 if an asset was
redirected, a delivered asset lacks its cache lifetime or type, or visit 2 fetched an asset over the network.
"""
import json, os, sys, tempfile, time, urllib.parse, urllib.request, collections
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'tests')); import tw_sandbox
from playwright.sync_api import sync_playwright
tw_sandbox.remove_campaigns()
opt = lambda k, d: next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == k and i + 1 < len(sys.argv)), d)
PAGE = opt('--page', 'https://turnipworks.net/'); RELAY = opt('--relay', 'https://turnipworks.net/api/tw-relay').rstrip('/')
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
UA = {'User-Agent': 'Mozilla/5.0 tw-delivery-net', 'Content-Type': 'application/json'}
INN = [('common', 0, 0, 6, 5), ('kitchen', 6, 0, 4, 3), ('guest', 0, 5, 4, 4), ('storeroom', 6, 3, 3, 3)]
ROOMS = INN if opt('--rooms', 'room') == 'inn' else INN[:1]
FIGS = ['hero-fighter-dragonborn-m', 'foe-goblin-club']
LOADED = """(() => { const w = tw.worldOf(tw.area()); let ph = 0; w.scene.traverse(o => { if (o.userData?.placeholder && o.visible !== false) ph++; });
  const s = tw.spawningNow(); return ph === 0 && s.anims === 0 && !s.last?.loading && tw.sync.pendingCount() === 0; })()"""
kind = lambda u: (lambda p: 'mesh' if p.endswith('.glb') else 'picture' if p.rsplit('.', 1)[-1] in ('webp', 'png', 'jpg') else 'code' if p.rsplit('.', 1)[-1] in ('js', 'css', 'html') or p.endswith('/') else 'data' if p.endswith('.json') else 'api' if '/api/' in p else 'other')(u.split('?')[0].split('#')[0])

def get(u): return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120).read())

def visit(ctx, url, label):
    pg = ctx.new_page(); cdp = ctx.new_cdp_session(pg); cdp.send('Network.enable'); R = {}; errs = []
    cdp.on('Network.requestWillBeSent', lambda e: R.setdefault(e['requestId'], {'url': e['request']['url'], 'redir': []}).__setitem__('redir', R[e['requestId']]['redir'] + ([e['redirectResponse']['status']] if e.get('redirectResponse') else [])) or R[e['requestId']].__setitem__('url', e['request']['url']))
    def got(e):
        r = R.setdefault(e['requestId'], {'url': e['response']['url'], 'redir': []}); h = {k.lower(): v for k, v in e['response']['headers'].items()}
        r.update(status=e['response']['status'], disk=bool(e['response'].get('fromDiskCache')), prefetch=bool(e['response'].get('fromPrefetchCache')), cc=h.get('cache-control', ''), type=h.get('content-type', ''), enc=h.get('content-encoding', ''), cf=h.get('cf-cache-status', ''))
    cdp.on('Network.responseReceived', got)
    cdp.on('Network.requestServedFromCache', lambda e: R.setdefault(e['requestId'], {'url': '', 'redir': []}).__setitem__('mem', True))
    cdp.on('Network.loadingFinished', lambda e: R.setdefault(e['requestId'], {'url': '', 'redir': []}).__setitem__('wire', e.get('encodedDataLength', 0)))
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    t0 = time.time(); pg.goto(url); pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=180000)
    quiet = None
    while time.time() - t0 < 240:
        if pg.evaluate(LOADED):
            quiet = quiet or time.time()
            if time.time() - quiet > 2.5: break
        else: quiet = None
        pg.wait_for_timeout(400)
    try: pg.evaluate("Promise.race([Promise.allSettled([...tw.assets.look.glbCache.values(), ...tw.assets.look.texCache.values()]), new Promise(r => setTimeout(r, 60000))]).then(() => 1)")  # (things still on their way in)
    except Exception: pass
    t1 = time.time()  # ... and until nothing has been on its way for a second (things seated late bring their pictures late)
    while time.time() - t1 < 60:
        if all('status' in r or 'wire' in r for r in R.values() if '/assets/' in r.get('url', '')):
            pg.wait_for_timeout(1000)
            if all('status' in r or 'wire' in r for r in R.values() if '/assets/' in r.get('url', '')): break
        else: pg.wait_for_timeout(300)
    secs = round(time.time() - t0, 1); delivery = pg.evaluate("(() => { try { return !!tw.assets?.look?.glbCache && [...tw.assets.look.glbCache.keys()].length; } catch { return null; } })()")
    pg.wait_for_timeout(500); pg.close()
    return {'label': label, 'seconds': secs, 'errors': errs, 'meshes_loaded': delivery, 'requests': [r for r in R.values() if r.get('url', '').startswith('http')]}

def table(v):
    rows = collections.defaultdict(lambda: collections.Counter())
    for r in v['requests']:
        k = kind(r['url']); c = rows[k]; cached = r.get('disk') or r.get('mem')
        c['n'] += 1; c['redirected'] += bool(r['redir']); c['from cache'] += bool(cached); c['network'] += (not cached and r.get('status') != 304); c['304'] += r.get('status') == 304
        c['wire KB'] += 0 if cached else round((r.get('wire') or 0) / 1024); c['immutable'] += 'immutable' in r.get('cc', ''); c['no lifetime'] += (not r.get('cc') and not cached)
        c['delivered'] += '/assets/d/' in r['url']; c['gzip/br'] += bool(r.get('enc')); c['edge HIT'] += r.get('cf') == 'HIT'; c['gltf type'] += r.get('type', '').startswith('model/gltf-binary')
    return {k: dict(v) for k, v in rows.items()}

c = json.loads(urllib.request.urlopen(urllib.request.Request(f'{RELAY}/campaigns', data=json.dumps({'name': 'TEST delivery net (throwaway)', 'gm': 'Fauna-delivery'}).encode(), method='POST', headers=UA), timeout=60).read())
tw_sandbox._made.append((RELAY, c['campaign'], c['token'], 'TEST delivery net (throwaway)'))
do = f"{RELAY}/c/{c['campaign']}/a/{c['area']}/do"
for i, (ty, x, z, w, d) in enumerate(ROOMS):
    r = get(do + '?' + urllib.parse.urlencode({'cmd': 'room.spawn', 'type': ty, 'x': (200 + x) * 5, 'z': (200 + z) * 5, 'w': w * 5, 'd': d * 5, 'seed': 9100 + i, 'nonce': f'dn-{i}', 'seat': c['token']}))
    if not r.get('ok'): print('room.spawn failed', str(r)[:200])
for k, f in enumerate(FIGS): get(do + '?' + urllib.parse.urlencode({'cmd': 'token.create', 'fig': f, 'x': (201 + k) * 5 + 2.5, 'z': 1007.5, 'nonce': f'dn-f{k}', 'seat': c['token']}))
url = PAGE + ('&' if '?' in PAGE else '?') + 'nointro#s=' + c['token']
out = {'page': PAGE, 'at': time.strftime('%Y-%m-%d %H:%M:%S'), 'rooms': len(ROOMS)}
with sync_playwright() as p, tempfile.TemporaryDirectory(prefix='tw-delivery-profile-') as prof:
    ctx = p.chromium.launch_persistent_context(prof, headless=True, args=ARGS, viewport={'width': 1600, 'height': 900})
    # a browser with any request routed has its HTTP cache switched off (Playwright), and this test is about the cache:
    # take the sandbox's routes off this context. It only loads a table (reads); the campaign is removed by hand below.
    ctx.unroute(tw_sandbox.PATTERN); ctx.unroute(tw_sandbox.CAMPAIGNS)
    v1 = visit(ctx, url, 'visit 1 (fresh profile)'); v2 = visit(ctx, url, 'visit 2 (same profile)'); ctx.close()
bad = []
for v in (v1, v2):
    t = table(v); out[v['label']] = {'seconds': v['seconds'], 'errors': v['errors'], 'meshes_loaded': v['meshes_loaded'], 'by kind': t}
    print(f"\n{v['label']}: all in after {v['seconds']} s, {len(v['requests'])} requests, {v['meshes_loaded']} mesh files in the scene" + (f", page errors {v['errors'][:2]}" if v['errors'] else ''))
    cols = ['n', 'redirected', 'network', '304', 'from cache', 'wire KB', 'delivered', 'immutable', 'no lifetime', 'gzip/br', 'gltf type', 'edge HIT']
    print('  ' + 'kind'.ljust(9) + ''.join(c.rjust(12) for c in cols))
    for k in ('mesh', 'picture', 'code', 'data', 'api', 'other'):
        if k in t: print('  ' + k.ljust(9) + ''.join(str(t[k].get(c, 0)).rjust(12) for c in cols))
A = lambda v, f: [r for r in v['requests'] if kind(r['url']) in ('mesh', 'picture') and '/assets/' in r['url'] and f(r)]
red = [r for v in (v1, v2) for r in v['requests'] if r['redir'] and kind(r['url']) in ('mesh', 'picture', 'code', 'data')]
if red: bad.append(f"{len(red)} requests were redirected, e.g. {red[0]['url'][:120]} {red[0]['redir']}")
if not A(v1, lambda r: True): bad.append('visit 1 fetched no assets at all')
plain = A(v1, lambda r: '/assets/d/' not in r['url'] and '/wallkit/' not in r['url'] and '/thumbs/' not in r['url'])
if plain: bad.append(f"{len(plain)} assets were fetched at their plain address (no delivered copy), e.g. {plain[0]['url'][:140]}")
noimm = A(v1, lambda r: '/assets/d/' in r['url'] and 'immutable' not in r.get('cc', ''))
if noimm: bad.append(f"{len(noimm)} delivered assets came without 'immutable', e.g. {noimm[0]['url'][:140]} [{noimm[0].get('cc')}]")
notype = A(v1, lambda r: r['url'].split('?')[0].endswith('.glb') and not r.get('type', '').startswith('model/gltf-binary'))
if notype: bad.append(f"{len(notype)} meshes came with the wrong type, e.g. {notype[0].get('type')}")
again = A(v2, lambda r: not (r.get('disk') or r.get('mem')))
if again: bad.append(f"visit 2 fetched {len(again)} assets over the network again, e.g. {again[0]['url'][:140]} (status {again[0].get('status')})")
out['problems'] = bad
if opt('--json', None): json.dump({**out, 'visit1': v1['requests'], 'visit2': v2['requests']}, open(opt('--json', None), 'w'), indent=1)
print('\n' + ('\n'.join('PROBLEM ' + b for b in bad) if bad else 'OK: no redirects, every asset delivered with its lifetime and type, visit 2 re-downloaded no asset'))
sys.exit(1 if bad else 0)

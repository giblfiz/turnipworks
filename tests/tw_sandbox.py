"""Test writes never reach the live game or Harry's review data.  (2026-10-05)

Importing this module (one line at the top of every browser test) makes every Playwright browser the script opens send
`X-TW-Test: <session>` on each /api/tw-ratings/ request. The write-back server (server/ratings_server.py) stores such
writes under reviews/test-sandbox/<session>/ and answers the session's reads with the live records plus its own writes,
so a test still presses "Use in game", Send, the star keys ... and reads back exactly what it wrote, while the house
look the game loads and reviews/latest.json stay byte-for-byte what they were. Nothing to archive, nothing to restore:
a test that crashes or is killed half way leaves the live records untouched too.

    import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '<up>', 'tests')); import tw_sandbox

  tw_sandbox.SID / tw_sandbox.HEADERS   the session, and the header for a test's own urllib / curl calls
  tw_sandbox.proxy(page, api_origin)    for a page served by a local static server: forward its /api/tw-ratings/ calls to
                                        api_origin (e.g. http://127.0.0.1:8096), sandboxed  (replaces a hand-made page.route)
  tw_sandbox.aproxy(page, api_origin)   the same for the async API (await it)
  tw_sandbox.live(context)              take the header off ONE context: "what does everybody else see?" (read-only use)
  tw_sandbox.remove_campaigns()         (2026-10-06) one line after the import, in a suite whose campaigns are throwaways:
                                        every campaign a browser of this script makes (POST <relay>/campaigns) is deleted
                                        from that relay, files and all, when the script exits, however it exits. Without
                                        the line nothing is deleted (a script that builds a campaign for later scripts
                                        to join must not call it).
  tw_sandbox.delete_campaign(relay, campaign, token, purge=True)   the relay's delete, for a test's own use -> bool
  (2026-10-19) feedback tickets: every ticket call a test browser makes to a relay (.../tickets...) carries the header
  too, and the relay keeps those tickets in its test sandbox; a test's own urllib calls add tw_sandbox.HEADERS.

Fail closed: before the first write to an API the helper asks GET <api>/sandbox and, unless the server echoes this
session (an old server, a proxy that drops the header), it blocks every write to that API and says so.
At exit it compares the live house look and ratings with what they were at import and runs tests/check_house_look.py.
"""
import atexit, hashlib, json, os, re, subprocess, sys, time, urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO, 'server'))
from reviews_home import reviews_dir  # noqa: E402
REVIEWS = str(reviews_dir())  # the live records' folder: outside the checkout since 2026-10-12 (TW_REVIEWS_DIR); the sandbox is REVIEWS/test-sandbox/<session>/
PATTERN = '**/api/tw-ratings/**'
_stem = re.sub(r'[^A-Za-z0-9._-]', '-', os.path.splitext(os.path.basename(sys.argv[0] or 'py'))[0])[:30] or 'py'
SID = os.environ.get('TW_SANDBOX') or f'{_stem}-{os.getpid()}-{int(time.time()):x}'
if not re.match(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$', SID):
    raise SystemExit(f'tw_sandbox: bad session id {SID!r}')
HEADERS = {'X-TW-Test': SID}
_verified = {}  # API base -> bool


def _ok(api_base):
    """Does this API honour the sandbox header (through every proxy on the way)? Asked once per API."""
    if api_base not in _verified:
        try:
            req = urllib.request.Request(api_base + '/sandbox', headers={**HEADERS, 'User-Agent': 'Mozilla/5.0 tw-sandbox'})
            with urllib.request.urlopen(req, timeout=15) as r:
                _verified[api_base] = json.loads(r.read()).get('sandbox') == SID
        except Exception:  # noqa: BLE001  (a static server with no API behind it answers 404: nothing there to write to)
            _verified[api_base] = False
    return _verified[api_base]


def _plan(request, api_origin=None):
    """-> (allowed, url, headers) for a request to the write-back API."""
    head, tail = request.url.split('/api/tw-ratings', 1)
    base = api_origin if api_origin is not None else head + '/api/tw-ratings'
    allowed = _ok(base) or request.method in ('GET', 'HEAD', 'OPTIONS')
    if not allowed:
        print(f'tw_sandbox: BLOCKED {request.method} {request.url}: {base} does not honour the test sandbox', flush=True)
    return allowed, (api_origin + tail if api_origin is not None else None), {**request.headers, 'x-tw-test': SID}


def _handler(api_origin=None):
    def handle(route):
        allowed, url, headers = _plan(route.request, api_origin)
        if not allowed:
            return route.abort()
        if url:
            return route.fulfill(response=route.fetch(url=url, headers=headers))
        route.continue_(headers=headers)
    return handle


def _ahandler(api_origin=None):
    async def handle(route):
        allowed, url, headers = _plan(route.request, api_origin)
        if not allowed:
            return await route.abort()
        if url:
            return await route.fulfill(response=await route.fetch(url=url, headers=headers))
        await route.continue_(headers=headers)
    return handle


# ---- feedback tickets (2026-10-19): the relay keeps a ticket that carries X-TW-Test in its test sandbox
# (<data>/tickets/test-sandbox/<session>/, engine/relay/tickets.js), as the ratings server does. Every ticket call a test
# browser makes gets the header: filing (POST <relay>/c/<id>/tickets…), My tickets, and the triage page's /tickets….
TICKETS = re.compile(r'^https?://[^/]+(?:/api/tw-relay)?/(?:c/[^/?#]+/)?tickets(?:[/?#]|$)')


def _relay_base(url):
    m = re.match(r'^(https?://[^/]+(?:/api/tw-relay)?)/', url)
    return m.group(1) if m else url


def _tickets_ok(base):
    key = base + '/tickets'
    if key not in _verified:
        try:
            req = urllib.request.Request(base + '/tickets/sandbox', headers={**HEADERS, 'User-Agent': 'Mozilla/5.0 tw-sandbox'})
            with urllib.request.urlopen(req, timeout=15) as r:
                _verified[key] = json.loads(r.read()).get('sandbox') == SID
        except Exception:  # noqa: BLE001
            _verified[key] = False
    return _verified[key]


def _tickets_plan(request):
    allowed = request.method in ('GET', 'HEAD', 'OPTIONS') or _tickets_ok(_relay_base(request.url))
    if not allowed:
        print(f'tw_sandbox: BLOCKED {request.method} {request.url}: the relay does not honour the test sandbox for tickets', flush=True)
    return allowed, {**request.headers, 'x-tw-test': SID}


def _tickets_handler(route):
    allowed, headers = _tickets_plan(route.request)
    if not allowed: return route.abort()
    route.continue_(headers=headers)


async def _atickets_handler(route):
    allowed, headers = _tickets_plan(route.request)
    if not allowed: return await route.abort()
    await route.continue_(headers=headers)


# ---- throwaway campaigns (2026-10-06): about a hundred "TEST ... (throwaway)" campaigns had piled up on the live relay,
# and nothing could delete one. The relay now has POST /c/<id>/delete (its GM; purge=1 removes the files).
CAMPAIGNS = '**/campaigns'
_made = []       # (relay base, campaign id, GM token, name) of every campaign this script's browsers made
_remove = False


def remove_campaigns(on=True):
    global _remove
    _remove = on


def delete_campaign(relay, campaign, token, purge=True):
    try:
        req = urllib.request.Request(f"{relay.rstrip('/')}/c/{campaign}/delete?seat={token}{'&purge=1' if purge else ''}", data=b'', method='POST', headers={'User-Agent': 'Mozilla/5.0 tw-sandbox'})
        with urllib.request.urlopen(req, timeout=20) as r:
            return bool(json.loads(r.read()).get('ok'))
    except Exception:  # noqa: BLE001  (a local relay that has already stopped, with its data folder: nothing left to delete)
        return False


def _note(request, response):
    try:
        body = response.json()
        if response.ok and body.get('ok') and body.get('campaign') and body.get('token'):
            try: name = json.loads(request.post_data or '{}').get('name') or ''
            except Exception: name = ''  # noqa: BLE001, E701
            _made.append((request.url.rsplit('/campaigns', 1)[0], body['campaign'], body['token'], name))
    except Exception:  # noqa: BLE001
        pass


def _made_handler(route):
    if route.request.method != 'POST': return route.continue_()
    resp = route.fetch(); _note(route.request, resp); route.fulfill(response=resp)


async def _amade_handler(route):
    if route.request.method != 'POST': return await route.continue_()
    resp = await route.fetch()
    try:
        body = await resp.json()
        if resp.ok and body.get('ok') and body.get('campaign') and body.get('token'):
            try: name = json.loads(route.request.post_data or '{}').get('name') or ''
            except Exception: name = ''  # noqa: BLE001, E701
            _made.append((route.request.url.rsplit('/campaigns', 1)[0], body['campaign'], body['token'], name))
    except Exception:  # noqa: BLE001
        pass
    await route.fulfill(response=resp)


def _remove_at_exit():
    if not _remove or not _made: return
    gone = [(c, n) for (relay, c, tok, n) in _made if delete_campaign(relay, c, tok)]
    left = len(_made) - len(gone)
    if not gone and all('//127.0.0.1' in relay or '//localhost' in relay for (relay, *_x) in _made): return  # a local relay: its data folder went with it
    print(f"tw_sandbox: removed {len(gone)} throwaway campaign(s) this run made{': ' + ', '.join(c for c, _ in gone) if gone else ''}" + (f' ({left} were on a relay that has stopped, or could not be removed)' if left else ''), flush=True)


def proxy(page, api_origin):
    page.route(PATTERN, _handler(api_origin.rstrip('/')))


async def aproxy(page, api_origin):
    await page.route(PATTERN, _ahandler(api_origin.rstrip('/')))


def live(context):
    """Take the sandbox off one context (sync API: returns None; async API: returns an awaitable)."""
    return context.unroute(PATTERN)


# PAWNS AND THE SQUARES (2026-10-11): a dragged pawn moves freely by default now and Shift snaps it (Settings ▸ Me ▸
# "Pawns snap to squares"). A suite whose pawn drags expect one rule SAYS which, once, after the import:
#     tw_sandbox.pawn_snap('always')     # they snap; Shift frees (the rule the older suites were written for)
#     tw_sandbox.pawn_snap('shift')      # free; Shift snaps (the default)
# Every context the suite opens then starts with that choice in the browser's preferences, unless the page already
# holds one (so a suite can still change it in the page: tw.settings.setPref('pawnSnap', ...)).
_pawn_snap = None
def pawn_snap(mode):
    global _pawn_snap
    assert mode in ('always', 'shift'), mode
    _pawn_snap = mode
def _snap_script():
    return "try { const p = JSON.parse(localStorage.getItem('tw.prefs') || '{}'); if (!('pawnSnap' in p)) { p.pawnSnap = '%s'; localStorage.setItem('tw.prefs', JSON.stringify(p)); } } catch (e) {}" % _pawn_snap


def _launch_options(options):
    """Keep sandbox policy explicit; opt old suites into the runner's real GPU.

    TW_GPU is deliberately opt-in: an ordinary standalone suite retains its GL
    backend. The matrix requests Vulkan to avoid software GL saturating the box.
    """
    options = dict(options)
    args = list(options.get('args') or [])
    if '--no-sandbox' not in args: args.append('--no-sandbox')
    if os.environ.get('TW_GPU') == '1':
        args = [a for a in args if not a.startswith(('--use-gl=', '--use-angle='))]
        args.append('--use-angle=vulkan')
        features = next((a for a in args if a.startswith('--enable-features=')), None)
        if features:
            args.remove(features)
            values = features.split('=', 1)[1].split(',')
            if 'Vulkan' not in values: values.append('Vulkan')
            args.append('--enable-features=' + ','.join(values))
        else: args.append('--enable-features=Vulkan')
        for flag in ('--ignore-gpu-blocklist', '--enable-gpu'):
            if flag not in args: args.append(flag)
    options['args'] = args
    return options


def _patch():
    """Every context a test opens gets the header, however it is opened (new_context, new_page, persistent)."""
    try:
        from playwright.sync_api import Browser, BrowserType
        original_launch = BrowserType.launch
        def launch(self, *a, **k):
            return original_launch(self, *a, **(_launch_options(k) if self.name == 'chromium' else k))
        BrowserType.launch = launch
        for cls, name, ctx_of in ((Browser, 'new_context', lambda c: c), (Browser, 'new_page', lambda pg: pg.context), (BrowserType, 'launch_persistent_context', lambda c: c)):
            def wrap(orig, ctx_of=ctx_of):
                def opened(self, *a, **k):
                    out = orig(self, *a, **(_launch_options(k) if orig.__name__ == 'launch_persistent_context' and self.name == 'chromium' else k))
                    ctx_of(out).route(PATTERN, _handler())
                    ctx_of(out).route(CAMPAIGNS, _made_handler)
                    ctx_of(out).route(TICKETS, _tickets_handler)
                    if _pawn_snap: ctx_of(out).add_init_script(_snap_script())
                    return out
                return opened
            setattr(cls, name, wrap(getattr(cls, name)))
    except ImportError:
        pass
    try:
        from playwright.async_api import Browser as ABrowser, BrowserType as ABrowserType
        original_async_launch = ABrowserType.launch
        async def async_launch(self, *a, **k):
            return await original_async_launch(self, *a, **(_launch_options(k) if self.name == 'chromium' else k))
        ABrowserType.launch = async_launch
        for cls, name, ctx_of in ((ABrowser, 'new_context', lambda c: c), (ABrowser, 'new_page', lambda pg: pg.context), (ABrowserType, 'launch_persistent_context', lambda c: c)):
            def awrap(orig, ctx_of=ctx_of):
                async def opened(self, *a, **k):
                    out = await orig(self, *a, **(_launch_options(k) if orig.__name__ == 'launch_persistent_context' and self.name == 'chromium' else k))
                    await ctx_of(out).route(PATTERN, _ahandler())
                    await ctx_of(out).route(CAMPAIGNS, _amade_handler)
                    await ctx_of(out).route(TICKETS, _atickets_handler)
                    if _pawn_snap: await ctx_of(out).add_init_script(_snap_script())
                    return out
                return opened
            setattr(cls, name, awrap(getattr(cls, name)))
    except ImportError:
        pass


WATCHED = ('tuner/house.jsonl', 'latest.json', 'ratings.jsonl')


def fingerprint():
    out = {}
    for rel in WATCHED:
        path = os.path.join(REVIEWS, rel)
        out[rel] = hashlib.sha256(open(path, 'rb').read()).hexdigest() if os.path.exists(path) else None
    return out


_before = fingerprint()


def _at_exit():
    after = fingerprint()
    changed = [rel for rel in WATCHED if after[rel] != _before[rel]]
    if changed:  # not necessarily this test: Harry may have pressed a button meanwhile. Say so either way.
        print(f"tw_sandbox: WARNING live records changed during this run: {', '.join(changed)} (this test wrote to sandbox {SID}; if nobody pressed a button, something wrote without the header)", flush=True)
    else:
        print(f'tw_sandbox: live house look and ratings unchanged by this run (sandbox {SID})', flush=True)
    try:
        r = subprocess.run([sys.executable, os.path.join(REPO, 'tests', 'check_house_look.py'), '--warn', '--no-lint'], capture_output=True, text=True, timeout=30)
        if 'WARNING' in r.stdout:
            print(r.stdout.strip(), flush=True)
    except Exception:  # noqa: BLE001
        pass


_patch()
atexit.register(_at_exit)
atexit.register(_remove_at_exit)


# ANOTHER BROWSER (2026-10-06; Harry plays in Firefox, the suites were Chromium only, and a Chrome-only wheel bug got
# through the other way round). TW_BROWSER=firefox or TW_BROWSER=webkit runs any suite that imports this file in that
# browser: every `p.chromium` in a suite then hands out that browser instead, without Chromium's launch flags and
# without the context options only Chromium has (clipboard permissions).
def _other_browser():
    name = os.environ.get('TW_BROWSER', '').strip().lower()
    if name not in ('firefox', 'webkit'):
        return
    if name == 'firefox':
        os.environ.setdefault('DISPLAY', ':99')  # (set before Playwright starts its driver, which hands its environment to the browser)
    drop = lambda kw: {k: v for k, v in kw.items() if k not in ('permissions',)}  # noqa: E731

    class _B:  # a Browser whose new_context ignores Chromium-only options
        def __init__(self, b): self._b = b
        def __getattr__(self, k): return getattr(self._b, k)
        def new_context(self, **kw): return self._b.new_context(**drop(kw))

    class _T:  # a BrowserType whose launch ignores Chromium's flags
        def __init__(self, t, is_async): self._t, self._async = t, is_async
        def __getattr__(self, k): return getattr(self._t, k)
        def launch(self, **kw):
            kw = {k: v for k, v in kw.items() if k != 'args'}
            if name == 'firefox':  # headless Firefox has no WebGL on this box; with a window on the virtual display (Xvfb :99) it draws with llvmpipe
                kw['firefox_user_prefs'] = {'webgl.force-enabled': True, 'webgl.disabled': False}
                kw['headless'] = False
            if self._async:
                async def go(): return _B(await self._t.launch(**kw))
                return go()
            return _B(self._t.launch(**kw))
    for mod, is_async in (('playwright.async_api', True), ('playwright.sync_api', False)):
        try:
            P = __import__(mod, fromlist=['Playwright']).Playwright
            P.chromium = property(lambda self, a=is_async, real=getattr(P, name): _T(real.fget(self), a))
        except Exception as e:  # noqa: BLE001
            print(f'tw_sandbox: could not switch to {name}: {e}', flush=True)
    print(f'tw_sandbox: running in {name} (TW_BROWSER)', flush=True)


_other_browser()

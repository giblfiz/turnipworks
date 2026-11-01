"""THE GAME AT ITS OWN ADDRESS, LOCALLY (tools/promo, 2026-10-22). A shot that shows a link (the join-by-link split
screen) must not show http://127.0.0.1:18532/engine/client/index.html?relay=... in the game's own invite panel. So the
seats of such a shot open https://turnipworks.net/ and every request for that origin is answered INSIDE the browser by
Playwright routes from the rig's local relay and static site, laid out the way turnipworks.net serves the game
(engine/deploy.sh: the game at "/" from index.turnipworks.html with <base href="/engine/client/">, the tuner under /look/,
the relay under /api/tw-relay). The relay's WebSocket is bridged the same way (route_web_socket -> a local socket).
The invite link the game then prints is the shape a real GM gets: https://turnipworks.net/#s=<token>.

FAIL CLOSED: nothing may reach the real turnipworks.net. The browser runs with --host-resolver-rules that send the name
to an address nothing listens on (anything a route missed fails instead of landing on prod), the page asks a probe path
only these routes answer before anything else happens, and a route that cannot answer aborts.
"""
import asyncio, os, re

ORIGIN = 'https://turnipworks.net'
RESOLVER = '--host-resolver-rules=MAP turnipworks.net 127.0.0.1, MAP *.turnipworks.net 127.0.0.1'
# init script: the first-visit pantomime is a real feature, but not this shot's (the tests skip it with ?nointro, which
# would show in the link): the seat reads its intro as already seen
NO_INTRO = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('tw.intro.') ? '1' : g.call(this, k); }; })();"

def prod_index(repo):
    """engine/client/index.html as engine/deploy.sh rewrites it for turnipworks.net (index.turnipworks.html)"""
    s = open(os.path.join(repo, 'engine', 'client', 'index.html')).read()
    s = s.replace('<head>', '<head>\n<base href="/engine/client/">', 1)
    s = s.replace('content="../../tuner/"', 'content="/look/"').replace('"../../tuner/js/', '"/look/js/')
    s = re.sub(r'href="site/(about|terms|privacy)\.html"', r'href="/\1"', s)
    return s

async def mount(page, repo, relay_port, site_port):
    index = prod_index(repo)
    local_site, local_relay = f'http://127.0.0.1:{site_port}', f'http://127.0.0.1:{relay_port}'

    async def http(route):
        u = route.request.url; path = u[len(ORIGIN):] or '/'
        p = path.split('#', 1)[0]; bare = p.split('?', 1)[0]
        try:
            if bare == '/__promo_probe': return await route.fulfill(status=200, body='promo-local', content_type='text/plain')
            if bare.startswith('/__promo_ptr/'): return await route.fallback()  # the rig's pointer images (rig.py's route)
            if bare in ('/', '/index.html'): return await route.fulfill(status=200, body=index, content_type='text/html; charset=utf-8')
            if bare.startswith('/engine/'): target = local_site + p
            elif bare.startswith('/look/'): target = local_site + '/tuner/' + p[len('/look/'):]
            elif bare.startswith('/api/tw-relay'): target = local_relay + p
            elif bare.startswith('/api/tw-ratings'): return await route.fallback()  # tw_sandbox's route (read-only, sandboxed) answers it
            else: return await route.fulfill(status=404, body='not in the promo site', content_type='text/plain')
            r = await route.fetch(url=target, max_redirects=0)
            await route.fulfill(response=r)
        except Exception as e:  # noqa: BLE001
            print('site route failed:', u, e, flush=True); await route.abort()

    async def ws(wr):
        import aiohttp
        path = wr.url[len('wss://turnipworks.net'):]
        sess = aiohttp.ClientSession(); q = []
        try: cws = await sess.ws_connect(local_relay.replace('http', 'ws') + path, max_msg_size=0)
        except Exception as e:  # noqa: BLE001
            print('ws bridge failed:', path, e, flush=True); await sess.close(); return await wr.close()
        def to_relay(m):
            asyncio.ensure_future(cws.send_str(m) if isinstance(m, str) else cws.send_bytes(m))
        wr.on_message(to_relay)
        async def from_relay():
            try:
                async for m in cws:
                    if m.type == aiohttp.WSMsgType.TEXT: wr.send(m.data)
                    elif m.type == aiohttp.WSMsgType.BINARY: wr.send(m.data)
                    else: break
            finally:
                try: await wr.close()
                except Exception: pass  # noqa: BLE001
                await sess.close()
        wr.on_close(lambda *a: asyncio.ensure_future(cws.close()))
        asyncio.ensure_future(from_relay())

    await page.route(ORIGIN + '/**', http)
    await page.route_web_socket(re.compile(r'^wss://turnipworks\.net/.*'), ws)

async def probe(page):
    """the routes answer, not the network (before the game is opened)"""
    try:
        await page.goto(ORIGIN + '/__promo_probe'); txt = await page.evaluate('document.body.innerText')
    except Exception as e:  # noqa: BLE001
        txt = f'ERR {e}'
    if txt.strip() != 'promo-local': raise SystemExit(f'the promo site routes are not answering ({txt!r}): refusing to open turnipworks.net')

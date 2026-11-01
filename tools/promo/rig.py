#!/usr/bin/env python3
"""THE RIG for scripted shots (tools/promo, 2026-10-22): the frame-exact capture of capture.py, generalised from "one
drop" to a script of beats that use the game's real UI. A shot script (shots/scripts.py) gets a Rig and says what
happens frame by frame: drops, camera moves, mouse moves and clicks, keys; the rig steps every seat's clock 1/60 s per
frame and screenshots it.

What it shares with capture.py (imported, so a fix there is a fix here): the local relay + static site, the asset links
for a worktree, the vclock.js init script, the drop and stats JavaScript, the warm-up rule (the same drop far off,
watched until quiet), the stand-in check.

What it adds:
  * SEATS: one or more browser contexts (a GM, a player), each on its own virtual clock, stepped together. A split
    frame composes them side by side (a desktop with two windows), each pane its own viewport.
  * THE REAL UI: the DOM chrome stays (command bar, menus, ring); only dev overlays, first-visit hints and the operator's
    notice are hidden (HIDE_CLUTTER). capture.py's HIDE_CSS (canvas only) is used for clean drop shots.
  * A POINTER: headless Chromium draws none, so the rig draws one at the mouse: the game's own cursor image where its CSS
    sets one (data/cursors), else the desktop theme's arrow / hand (xcursor.py). It is a DOM node on top of the page,
    moved by the rig, invisible to the game (pointer-events: none).
  * MOUSE / KEYS on the clock: rig.glide(seat, to, secs) moves the real mouse a little per frame (eased), so hover,
    ghosts and drags see real pointermove events; rig.click / rig.key / rig.type send real input between frames.
  * CAMERA paths: rig.cam_path(seat, keys) with eased interpolation per frame.
Frames are never written to disk: each screenshot is decoded and piped as raw RGB into one ffmpeg per shot, which
writes the master (x264 CRF 16 slow, 60 fps). (/mnt/usb is a fuseblk disk that writes ~9 MB/s under load; a 2 MB PNG a
frame cost 8 s a frame there, and the root disk is too full for frame dumps.) Every 30th frame is kept as a JPEG
(stills/) for QA and contact sheets.
"""
import asyncio, json, math, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
# own ports: another rig (the welcome-mat capture) may be running capture.py on 18431/18432 at the same time
os.environ.setdefault('TW_PROMO_RELAY_PORT', '18531'); os.environ.setdefault('TW_PROMO_SITE_PORT', '18532')
sys.path.insert(0, HERE)
import capture as C  # noqa: E402
import promosite as SITE  # noqa: E402  (tools/promo/promosite.py: the game at https://turnipworks.net, answered locally)
from playwright.async_api import async_playwright  # noqa: E402

FPS = 60; DT = 1000 / FPS
CURSORS = os.path.join(json.load(open(os.path.join(HERE, 'shots.json')))['_root'], 'cursors')
# dev overlays, the first-visit hints, the operator's notice, toasts that are not part of a beat: hidden. The real UI stays.
HIDE_CLUTTER = """#tw-dev, #hud, #fpsMeter, #gfxNote, #tw-notice, #introGhost, #introHint, #areaState, #areaVeil, #visionBadge, #undoChips,
#ringlab-open, #ringlab-panel, #labellab-open, #labellab-panel, #otherGames { display: none !important; }"""
# (headless Chromium draws no OS pointer, so the CSS cursor is left alone: the pointer overlay reads it to pick its image)
POINTER_JS = """(o) => { let p = document.getElementById('__promoPtr');
  if (!p) { p = document.createElement('img'); p.id = '__promoPtr'; p.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;image-rendering:auto;'; document.documentElement.appendChild(p); }
  if (o.hide) { p.style.display = 'none'; return null; } p.style.display = 'block';
  // which pointer: the CSS cursor of what is under the mouse (the game's own image where it sets one)
  p.style.display = 'none'; const el = document.elementFromPoint(o.x, o.y); p.style.display = 'block';
  let cur = 'default', url = null, hx = 0, hy = 0;
  if (el) { const c = (getComputedStyle(el).cursor || 'auto');
    const m = /url\\(["']?([^"')]+)["']?\\)\\s*(\\d+)?\\s*(\\d+)?/.exec(c);
    if (m) { url = m[1]; hx = +(m[2] || 0); hy = +(m[3] || 0); } else { cur = c.split(',').pop().trim(); } }
  if (cur === 'auto') cur = (el && (el.closest('button,a,[role=button],.btn') ? 'pointer' : (el.closest('input,textarea') ? 'text' : 'default')));
  const s = o.scale || 1, H = o.hot || {};
  if (url) { if (p.dataset.src !== url) { p.src = url; p.dataset.src = url; } p.style.width = (24 * s) + 'px'; p.style.left = (o.x - hx * s) + 'px'; p.style.top = (o.y - hy * s) + 'px'; return 'game:' + url; }
  const k = H[cur] ? cur : 'default', h = H[k]; const src = o.base + k + '.png';
  if (p.dataset.src !== src) { p.src = src; p.dataset.src = src; }
  p.style.width = (h.w * s) + 'px'; p.style.left = (o.x - h.x * s) + 'px'; p.style.top = (o.y - h.y * s) + 'px'; return k; }"""

def ease(u, kind='inout'):
    u = min(1.0, max(0.0, u))
    if kind == 'linear': return u
    if kind == 'out': return 1 - (1 - u) ** 3
    if kind == 'in': return u ** 3
    return u * u * (3 - 2 * u) if kind == 'smooth' else (4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2)

def lerp_cam(a, b, u):
    out = dict(a)
    for k in ('x', 'y', 'z', 'pitch', 'dist'):
        if k in a or k in b: out[k] = a.get(k, 0) + (b.get(k, 0) - a.get(k, 0)) * u
    if 'yaw' in a or 'yaw' in b:
        ya, yb = a.get('yaw', 0), b.get('yaw', 0); out['yaw'] = ya + (yb - ya) * u
    return out

class Seat:
    def __init__(self, name, ctx, page, w, h): self.name, self.ctx, self.page, self.w, self.h = name, ctx, page, w, h; self.mouse = (w / 2, h / 2); self.ptr = False; self.errors = []; self.inflight = set()
    async def ev(self, js, arg=None): return await (self.page.evaluate(js, arg) if arg is not None else self.page.evaluate(js))

class Rig:
    """layout 'single' (one seat fills 1920x1080) or 'split' (seats side by side, each pane its viewport, on a backdrop)"""
    def __init__(self, label, out, layout='single', headed=False, master=None, size=(1920, 1080), page_scale=1.0):
        """size: the film's frame (v4: [1080, 1080] square, [1080, 1350] 4:5); a split frame in a frame taller than 4:3 stacks
        its windows (GM above the player); page_scale: each page (the frame, or a split window's pane) is drawn at
        (its size / page_scale) CSS px and scaled down to it. v4: 0.8 for the feed shapes, so the game lays its UI out on a
        page 1350 px wide (at 1080 CSS px the open command bar runs over the Settings launcher; at 1310+ it does not)"""
        self.label, self.out, self.layout, self.headed, self.master = label, out, layout, headed, master
        self.W, self.H = int(size[0]), int(size[1]); self.stack = layout == 'split' and self.H > self.W * 0.75; self.page_scale = float(page_scale)
        self.stills = os.path.join(out, 'stills'); os.makedirs(self.stills, exist_ok=True)
        for f in os.listdir(self.stills):
            if f.endswith(('.png', '.jpg')): os.remove(os.path.join(self.stills, f))
        self.enc = None; self.notes = {}
        self.seats = []; self.n = 0; self.log = []; self.fails = []; self.marks = {}; self.per_frame = []
        self.hot = json.load(open(os.path.join(CURSORS, 'cursors.json')))
        self.compose = None  # split: a function (list of PIL images) -> PIL image

    async def __aenter__(self):
        C.link_assets(); self.url = C.start_local()
        self.pw = await async_playwright().start()
        gpu = os.environ.get('TW_GPU', '1') == '1'
        GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if gpu else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
        self.browser = await self.pw.chromium.launch(headless=not self.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--hide-scrollbars', SITE.RESOLVER])
        return self

    async def __aexit__(self, *a):
        try: await self.browser.close(); await self.pw.stop()
        finally:
            for pr in C.procs: pr.terminate()
            C.procs.clear()

    def pane_size(self):
        """a split window's page size in CSS px (its viewport): the pane on the frame divided by page_scale"""
        pw, ph = pane_size(self.W, self.H, self.stack); return round(pw / self.page_scale), round(ph / self.page_scale)

    async def seat(self, name, w=None, h=None, url=None, gm=True, seed=20261022, campaign=None, prod=False, go=True):
        """prod: the seat opens https://turnipworks.net/ (promosite.py: answered locally, fail closed); url: open that
        (an invite link); go=False: set the seat up but do not open anything yet (S.open(url) later, on the clock)"""
        w = w or round(self.W / self.page_scale); h = h or round(self.H / self.page_scale)
        ctx = await self.browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
        await ctx.add_init_script(f'globalThis.__PROMO_SEED = {int(seed)};')
        await ctx.add_init_script(path=os.path.join(HERE, 'vclock.js'))
        await ctx.add_init_script(path=os.path.join(HERE, 'vanim.js'))  # CSS / Web Animations on the stepped clock too
        await ctx.add_init_script(path=os.path.join(HERE, 'fogwait.js'))  # the fog worker's jobs counted (S.fogwait)
        # the pointer images are served from the rig's folder through a route (the page cannot read the USB disk)
        pg = await ctx.new_page(); S = Seat(name, ctx, pg, w, h)
        await C.tw_sandbox.aproxy(pg, C.RATINGS)
        async def ptr_route(route):
            f = os.path.join(CURSORS, route.request.url.rsplit('/', 1)[-1]); await route.fulfill(path=f) if os.path.exists(f) else await route.abort()
        await pg.route('**/__promo_ptr/*', ptr_route)
        pg.on('pageerror', lambda e: S.errors.append(f'pageerror: {e}'))
        pg.on('console', lambda m: S.errors.append(f'console: {m.text[:200]}') if m.type == 'error' and 'status of 404' not in m.text else None)
        pg.on('request', lambda r: S.inflight.add(r)); pg.on('requestfinished', lambda r: S.inflight.discard(r)); pg.on('requestfailed', lambda r: S.inflight.discard(r))
        if prod:
            await SITE.mount(pg, C.REPO, C.RP, C.SP); await ctx.add_init_script(SITE.NO_INTRO); await SITE.probe(pg)
        S.prod = prod
        self.seats.append(S)
        if not go: return S
        await pg.goto(url or (SITE.ORIGIN + '/' if prod else self.url))
        if gm and not url:
            await pg.fill('#newCampaign input[name=name]', campaign or f'TEST promo {self.label} {time.strftime("%m-%d %H:%M:%S")} (throwaway)')
            await pg.fill('#newCampaign input[name=gm]', 'Fauna-promo'); await pg.click('#newCampaign button')
            await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
        return S

    async def chrome(self, S, mode='clutter', extra=''):
        """'clutter': keep the game's UI, hide dev/hints/notices; 'none': canvas only (capture.py's look). On this page
        and every page the seat opens later (an init script)."""
        css = (C.HIDE_CSS if mode == 'none' else HIDE_CLUTTER) + extra
        js = "(() => { const add = () => { const s = document.createElement('style'); s.dataset.promo = 'chrome'; s.textContent = %s; (document.head || document.documentElement).appendChild(s); }; if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add); })();" % json.dumps(css)
        await S.ctx.add_init_script(js)
        try: await S.page.add_style_tag(content=css)
        except Exception: pass

    # ---- the scene ----
    async def drop(self, S, spec, dx=0):
        return await S.ev(C.DROP, {**spec, 'dx': dx})

    async def quiet(self, S, timeout=240000, settle=1500):
        await S.page.wait_for_timeout(600); await S.page.wait_for_function(C.QUIET, timeout=timeout)
        t = time.time()
        while time.time() - t < 60 and S.inflight: await S.page.wait_for_timeout(200)
        await S.page.wait_for_timeout(settle)

    async def warm(self, S, spec, cam):
        """the same drop 600 ft east, watched until it is in, at rest and drawn (every mesh cached, shaders compiled)"""
        await self.cam(S, {**cam, 'x': cam['x'] + 600}); await self.drop(S, spec, dx=120); await self.quiet(S)
        await S.ev("tw.clearSelection?.()"); await self.cam(S, cam); await S.page.wait_for_timeout(300)
        await S.ev("tw.cutOff?.('api')"); await S.page.wait_for_timeout(2500)

    async def cam(self, S, c):
        await S.ev(C.SETCAM, c)

    # ---- the clock ----
    async def freeze(self):
        if getattr(self, 'before_freeze', None): self.notes['before_freeze'] = await self.before_freeze()  # (a caption rug laid in the scene)
        live = [S for S in self.seats if not getattr(S, 'blank', False)]
        # (v3, Harry 2026-10-22: YD7's ring showed no painted icons: the ring's painted set is fetched into this browser's
        # cache and decoded before anything is filmed, and every frame waits for the ring's pictures, as fogwait does)
        for S in live:
            try: self.notes.setdefault('ring_icons', {})[S.name] = await S.ev(RING_PRELOAD)
            except Exception as e: self.notes.setdefault('ring_icons', {})[S.name] = f'preload failed: {e}'
        for S in live: await S.ev("__promo.freeze()")
        for _ in range(3): await self.step(DT, snap=False)
        for S in live: await S.ev("__promo.reseed()")

    async def hold_until(self, S, js, timeout=120, arg=None):
        """hold every clock (steps of 0: no timer fires) until js is truthy in S: for a drop to get ready, a relay ack"""
        t = time.time()
        while time.time() - t < timeout:
            for s in self.seats:
                if not getattr(s, 'blank', False): await s.ev("__promo.step(0)")
            v = await S.ev(js, arg)
            if v: return v, round(time.time() - t, 2)
            await S.page.wait_for_timeout(20)
        raise RuntimeError(f'hold_until timed out: {js[:80]}')

    async def step(self, ms=DT, snap=True):
        for S in self.seats:
            if getattr(S, 'blank', False): continue
            if getattr(S, 'hold', False): await S.ev(f"(() => {{ __promo.t += {ms}; __promo.syncAnims && __promo.syncAnims(); }})()")
            else:
                await S.ev(f"__promo.step({ms})")
                t = time.time(); waited = False
                while time.time() - t < 4 and await S.ev(RING_PENDING): waited = True; await S.page.wait_for_timeout(5)
                if waited: self.ring_waits = getattr(self, 'ring_waits', 0) + 1
                if waited and await S.ev(RING_PENDING): self.fails.append(f'frame {self.n}: the ring\'s pictures still not drawn after 4 s ({S.name})')
                if getattr(S, 'fogwait', False):
                    t = time.time()
                    while time.time() - t < 3 and await S.ev("window.__fogInflight ? __fogInflight() : 0"): await S.page.wait_for_timeout(5)
        if snap: await self.snap()

    async def snap(self):
        for S in self.seats:
            if S.ptr and not getattr(S, 'blank', False): await S.ev(POINTER_JS, {'x': S.mouse[0], 'y': S.mouse[1], 'base': '/__promo_ptr/', 'hot': self.hot, 'scale': 1.4})
        st = await self.seats[0].ev(STAND)
        if st: self.fails.append(f'frame {self.n}: {st} grey stand-in(s) drawn ({self.seats[0].name})')
        for S in self.seats[1:]:
            if getattr(S, 'blank', False): continue
            try: s2 = await S.ev(STAND)
            except Exception: s2 = 0  # (a page between documents)
            if s2: self.fails.append(f'frame {self.n}: {s2} grey stand-in(s) drawn ({S.name})')
        from PIL import Image
        import io
        if self.layout == 'single': im = Image.open(io.BytesIO(await self.seats[0].page.screenshot(type='png'))).convert('RGB')
        else: im = self.compose([None if getattr(S, 'blank', False) else Image.open(io.BytesIO(await S.page.screenshot(type='png'))) for S in self.seats])
        if im.size != (self.W, self.H): im = im.resize((self.W, self.H), Image.LANCZOS)
        self.write(im)
        if self.n % 30 == 0: im.save(os.path.join(self.stills, f's_{self.n:05d}.jpg'), quality=90)
        self.per_frame.append({'i': self.n, **{k: v for k, v in self.marks.items()}}); self.n += 1
        if self.n % 60 == 0:
            now = time.time(); print(f'  [{self.label}] frame {self.n} ({self.n / FPS:.1f} s) {now - getattr(self, "_t60", now):.1f} s wall / 60 frames', flush=True); self._t60 = now

    def write(self, im):
        import subprocess
        if self.enc is None:
            os.makedirs(os.path.dirname(self.master), exist_ok=True)
            self.enc = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{self.W}x{self.H}', '-framerate', '60', '-i', '-',
                                         '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '60', '-movflags', '+faststart', '-an', self.master + '.part.mp4'], stdin=subprocess.PIPE)
        self.enc.stdin.write(im.tobytes())

    def close(self, keep=True):
        """finish the master (keep=False: a failed take, thrown away)"""
        if self.enc is None: return None
        self.enc.stdin.close(); rc = self.enc.wait(); self.enc = None
        if keep and rc == 0: os.replace(self.master + '.part.mp4', self.master); return self.master
        try: os.remove(self.master + '.part.mp4')
        except OSError: pass
        return None

    async def frames(self, n, each=None):
        """n frames: each(i) runs before frame i's step (camera, mouse), then the step and the screenshot"""
        for i in range(int(round(n))):
            if each: await each(i)
            await self.step()

    async def secs(self, s, each=None):
        await self.frames(round(s * FPS), each)

    # ---- input on the clock ----
    async def pointer(self, S, on=True):
        S.ptr = on
        if not on: await S.ev(POINTER_JS, {'hide': True})

    async def move(self, S, x, y):
        S.mouse = (x, y); await S.page.mouse.move(x, y)

    async def glide(self, S, to, secs, kind='inout', during=None, steps_per_frame=2):
        """move the real mouse from where it is to `to` over secs, a little each frame (pointermove events every frame)"""
        x0, y0 = S.mouse; n = max(1, round(secs * FPS))
        async def each(i):
            u = ease((i + 1) / n, kind)
            await self.move(S, x0 + (to[0] - x0) * u, y0 + (to[1] - y0) * u)
            if during: await during(i)
        await self.frames(n, each)

    async def click(self, S, button='left', modifiers=None):
        for m in modifiers or []: await S.page.keyboard.down(m)
        await S.page.mouse.down(button=button); await self.step(); await S.page.mouse.up(button=button)
        for m in modifiers or []: await S.page.keyboard.up(m)

    async def key(self, S, k): await S.page.keyboard.press(k)

    async def type(self, S, text, cps=9):
        """type text at about cps characters a second (a human typing), a frame or more per key"""
        per = max(1, round(FPS / cps))
        for ch in text:
            await S.page.keyboard.type(ch); await self.frames(per)

    async def screen(self, S, x, z, y=0):
        """the page position of a world point in S's main view"""
        p = await S.ev("(q) => tw.screenOf(q.x, q.z, tw.main, q.y)", {'x': x, 'z': z, 'y': y}); return (p['x'], p['y'])

    def mark(self, **kw): self.marks.update(kw)

    def report(self):
        errs = {S.name: S.errors[:30] for S in self.seats}
        return {'label': self.label, 'notes': self.notes, 'frames': self.n, 'seconds': round(self.n / FPS, 3), 'fails': self.fails[:50], 'n_fails': len(self.fails), 'errors': errs}

# THE RING'S PICTURES (v3): the painted icon set the house ring uses (tw.ringSettings().iconSet; ringlab manifest), every
# picture fetched and decoded in this page (so the browser has them, as a player's has after the first ring); and a frame
# check: any ring picture (img.paint) not yet loaded, or a ring on screen still in line icons while a painted set is
# chosen and the manifest has it, holds the frame (real time) until drawn
RING_PRELOAD = """async () => { if (!window.tw?.ringSettings) return null; const set = tw.ringSettings()?.iconSet || null; if (!set || set === 'line (current)') return { set, n: 0 };
  const base = new URL('assets/ui-icons/manifest.json', tw.tunerBase || new URL('/look/', location.href)); let m = null;
  try { m = await (await fetch(base, { cache: 'no-store' })).json(); } catch (e) { return { set, error: String(e) }; }
  const urls = []; for (const a of Object.values(m.actions || {})) for (const v of a.variants || []) if (v.set === set) urls.push(new URL(v.sizes?.['62'] || v.file, base).href);
  let ok = 0; await Promise.all(urls.map(u => new Promise(r => { const i = new Image(); i.onload = () => { ok++; (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(r); }; i.onerror = r; i.src = u; (window.__ringPre ||= []).push(i); })));
  return { set, n: urls.length, ok }; }"""
RING_PENDING = "(() => { const L = document.getElementById('ring'); if (!L || L.hidden) return false; return [...L.querySelectorAll('img.paint')].some(i => !(i.complete && i.naturalWidth > 0)); })()"

# (a stand-in under the game's own opaque loading screen is not drawn for anyone: a player's first seconds, a cold cache)
STAND = """() => { if (!window.tw?.worldOf) return 0; const L = document.getElementById('twl'); if (L && L.isConnected) { const cs = getComputedStyle(L); if (cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.98) return 0; } const w = tw.worldOf(tw.area()); let stand = 0; const drawn = (g) => { for (let o = g; o; o = o.parent) { if (!o.visible) return false; if (o.isScene) return true; } return false; };
  for (const r of w.recs.values()) if (r.visual?.userData?.placeholder && !r.asleep && drawn(r.group)) stand++;
  for (const s of w.shell.values()) if (s.visual?.userData?.placeholder && !s.asleep && drawn(s.group)) stand++; return stand; }"""

SPLIT = {'top': 56, 'gap': 16}
def pane_size(W=1920, H=1080, stack=False):
    """each window of a split frame on the frame: side by side (W - 3 gap) / 2 wide, H - top - gap high; stacked (v4, the
    square and 4:5 frames): W - 2 gap wide, (H - 2 top - gap) / 2 high, each window under its own name band"""
    if stack: return W - 2 * SPLIT['gap'], (H - 2 * SPLIT['top'] - SPLIT['gap']) // 2
    return (W - 3 * SPLIT['gap']) // 2, H - SPLIT['top'] - SPLIT['gap']

def pane_xy(k, W, H, stack):
    pw, ph = pane_size(W, H, stack)
    return (SPLIT['gap'], SPLIT['top'] + k * (ph + SPLIT['top'])) if stack else (SPLIT['gap'] + k * (pw + SPLIT['gap']), SPLIT['top'])

async def split_backdrop(rig, names, W=None, H=None):
    """the desk behind the two windows with their names (split.html, Inter): rendered once, the panes pasted on it"""
    import shutil, tempfile
    W = W or rig.W; H = H or rig.H; stack = rig.stack
    tmp = tempfile.mkdtemp(prefix='tw-split-'); shutil.copy(os.path.join(HERE, 'split.html'), tmp)
    shutil.copy(os.path.join(C.REPO, 'engine', 'client', 'vendor', 'inter', 'inter-latin-wght-normal.woff2'), os.path.join(tmp, 'inter.woff2'))
    pg = await rig.browser.new_page(viewport={'width': W, 'height': H})
    import urllib.parse as U
    await pg.goto(f'file://{tmp}/split.html?' + U.urlencode({'a': names[0], 'b': names[1], 'top': SPLIT['top'], 'gap': SPLIT['gap'], **({'stack': 1} if stack else {})}))
    await pg.evaluate('document.fonts.ready'); path = os.path.join(rig.out, 'backdrop.png'); await pg.screenshot(path=path); await pg.close()
    from PIL import Image
    bg = Image.open(path).convert('RGB'); pw, ph = pane_size(W, H, stack); vw, vh = rig.pane_size()
    def comp(ims):
        out = bg.copy()
        for k, im in enumerate(ims):
            if im is None: continue
            im = im.convert('RGB').crop((0, 0, vw, vh))
            if (vw, vh) != (pw, ph): im = im.resize((pw, ph), Image.LANCZOS)  # (page_scale: the page drawn larger, scaled to its pane)
            out.paste(im, pane_xy(k, W, H, stack))
        return out
    rig.compose = comp
    return comp

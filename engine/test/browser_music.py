#!/usr/bin/env python3
"""The table's music (Harry 2026-10-30: "you can tie that audio in as game options"; client/music.js, docs/UI.md "Music").
A GM tab, a player tab and a phone tab against a throwaway local relay; headless audio (the element's state is checked,
not the speakers). Chromium runs with the real autoplay rule (--autoplay-policy=user-gesture-required).

  local:  TW_GPU=1 python3 engine/test/browser_music.py --local

  OFF       a new campaign plays nothing: Area settings and Area defaults read Off; no <audio> exists
  FILES     tracks.json lists the seven; one file answers 200 with an audio type (or the WebM container's)
  GM PICKS  Settings ▸ Area settings ▸ Music = The Tasty Turnip: the GM (who clicked) hears it at once
  GESTURE   the player joins: the table wants the track, but nothing streams until her first click; then it plays,
            from the synced place (within a few seconds of the GM's), one element, preload none, the WebM file
  NOTE      "The Tasty Turnip" shows in the corner and fades; its ♪ mutes (her ears only)
  EARS      Controls ▸ Sound: the volume slider sets the element's volume (the square: 0.5 -> 0.25); Music off stops
            the download; on again resumes in step; a GM's Music off is the player's silence too
  BAR       "playlist", "next track" (both seats move to the same new track), "music black mass", "music off" (GM);
            "mute music" / "unmute music" (the player, locally); the player is offered none of the GM's words
  AREAS     a second area with its own music: the GM going there switches the track; back again switches back;
            Area defaults (campaign) = playlist reaches an area with no music of its own
  AI GET    a GM AI seat: do?cmd=music.set (no browser) and both tabs change to In the Dark Soil
  LOW       low graphics and reduce motion: still plays
  PHONE     a phone tab (?hand=1, touch): nothing before a tap; a tap starts it
"""
import argparse, asyncio, json, os, random, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--relay'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []; dirs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18421,18422').split(','))
RELAY = A.relay or f'http://127.0.0.1:{RP}'
RANGE_SERVER = r"""
import http.server, os, re, sys
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def send_head(self):
        rng = self.headers.get('Range'); path = self.translate_path(self.path)
        if not rng or not os.path.isfile(path): return super().send_head()
        m = re.match(r'bytes=(\d*)-(\d*)', rng); size = os.path.getsize(path)
        a = int(m.group(1)) if m.group(1) else max(0, size - int(m.group(2))); b = int(m.group(2)) if m.group(1) and m.group(2) else size - 1
        b = min(b, size - 1); f = open(path, 'rb'); f.seek(a)
        self.send_response(206); self.send_header('Content-Type', self.guess_type(path)); self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', f'bytes {a}-{b}/{size}'); self.send_header('Content-Length', str(b - a + 1)); self.end_headers()
        self._left = b - a + 1; return f
    def copyfile(self, src, dst):
        n = getattr(self, '_left', None)
        if n is None: return super().copyfile(src, dst)
        while n > 0:
            buf = src.read(min(65536, n))
            if not buf: break
            dst.write(buf); n -= len(buf)
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
"""
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-music-'); site = tempfile.mkdtemp(prefix='tw-site-'); dirs.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    # a static server that answers Range requests, as nginx does (python's http.server does not: a browser cannot seek
    # into a track it serves, and joining mid-track is what this suite checks)
    procs.append(subprocess.Popen([sys.executable, '-c', RANGE_SERVER, str(SP)], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(RELAY) + '&api=&nointro&faces=1500'

UA = {'User-Agent': 'Mozilla/5.0 (TW browser_music)'}  # (Cloudflare refuses python-urllib's own agent)
def http(url, method='GET', timeout=8): return urllib.request.urlopen(urllib.request.Request(url, method=method, headers=UA), timeout=timeout)
async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
ST = 'tw.music.state()'
PLAYING = lambda tid: f"(() => {{ const s = tw.music.state(); return s.playing && s.playing.id === '{tid}' && !s.playing.paused && s.playing.time > 0.3; }})()"
SILENT = "(() => { const s = tw.music.state(); return !s.playing && s.elements === 0; })()"
async def bar(pg, text):
    await pg.keyboard.press('Escape'); await pg.keyboard.press('/'); await pg.wait_for_timeout(250)
    await pg.keyboard.type(text, delay=6); await pg.wait_for_timeout(450)
    top = await pg.evaluate("(() => { const r = document.querySelector('#results .row, #results [data-ref], #results li'); return r ? r.textContent.trim().slice(0, 90) : null; })()")
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300); await pg.keyboard.press('Escape')
    return top
async def offered(pg, text):
    await pg.keyboard.press('Escape'); await pg.keyboard.press('/'); await pg.wait_for_timeout(250)
    await pg.keyboard.type(text, delay=6); await pg.wait_for_timeout(450)
    rows = await pg.evaluate("[...document.querySelectorAll('#results .row, #results li')].map(r => r.textContent.trim().slice(0, 80))")
    await pg.keyboard.press('Escape'); return rows

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    origin = page.split('/engine/')[0] if '/engine/' in page else page.rsplit('/', 1)[0]
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--autoplay-policy=user-gesture-required', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []; media = []
        async def tab(url, w=1400, h=900, **kw):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, **kw)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            pg.on('request', lambda r: media.append((id(pg), r.url)) if '/data/music/' in r.url and r.url.split('?')[0].endswith(('.webm', '.m4a')) else None)
            await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST music {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready() && tw.music && tw.music.ready', 45000), 'GM tab live')
        INN = await gm.evaluate('tw.area()')

        print('OFF')
        s = await gm.evaluate(ST)
        check(s['tracks'] == 7 and s['value'] == '' and s['want'] is None and s['elements'] == 0, 'a new campaign plays nothing (Off), seven tracks known', json.dumps(s))
        await gm.keyboard.press('s'); await gm.wait_for_timeout(300); await gm.keyboard.press('a'); await gm.wait_for_timeout(400)
        sel = await gm.evaluate("(() => { const e = document.querySelector('#settingsModal select[data-rule=music][data-scope=area]'); return e && { v: e.value, opts: [...e.options].map(o => o.textContent) }; })()")
        check(sel and sel['v'] == '' and sel['opts'][:2] == ['Off', 'Playlist (every track, shuffled)'] and 'The Tasty Turnip' in sel['opts'] and len(sel['opts']) == 9, 'Area settings ▸ Music: Off, Playlist, the seven tracks; it reads Off', json.dumps(sel))

        print('FILES')
        tj = json.loads(http(f'{origin}/engine/client/data/music/tracks.json').read())
        names = [t['name'] for t in tj['tracks']]
        check(names == ["The Wizard's Roots", 'Buried in the Earth', 'Hymn of the Radiant Path', 'The Turnip Castle', 'The Black Mass', 'In the Dark Soil', 'The Tasty Turnip'] and all(-18.6 < t['lufs'] < -17.4 for t in tj['tracks']), 'tracks.json: the seven names, typos fixed, each within 0.6 LU of -18 LUFS', names)
        for f, want in (('tasty-turnip.webm', ('audio/webm', 'video/webm')), ('tasty-turnip.m4a', ('audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/m4a'))):
            r = http(f'{origin}/engine/client/data/music/{f}', 'HEAD')
            ct = (r.headers.get('content-type') or '').split(';')[0]
            check(r.status == 200 and ct in want and int(r.headers.get('content-length') or 0) < 3.5e6, f'{f}: 200, {ct}, {int(r.headers.get("content-length") or 0) / 1e6:.1f} MB', ct)

        print('GM PICKS')
        await gm.select_option('#settingsModal select[data-rule=music][data-scope=area]', 'tasty-turnip')
        check(await wait(gm, PLAYING('tasty-turnip'), 15000, 'GM hears it'), 'the GM picks The Tasty Turnip and hears it at once (the click was the gesture)', json.dumps(await gm.evaluate(ST)))
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')

        print('GESTURE')
        pl = await tab(invite)
        check(await wait(pl, 'window.tw && tw.ready && tw.ready() && tw.music && tw.music.ready', 45000), 'player tab joined')
        await pl.wait_for_timeout(1500)
        s = await pl.evaluate(ST)
        check(s['want'] and s['want']['id'] == 'tasty-turnip' and not s['unlocked'] and s['elements'] == 0 and not [u for (k, u) in media if k == id(pl)], 'before her first click the table wants the track, but nothing exists or streams (and nothing asks her)', json.dumps(s))
        check(not await pl.evaluate("!!document.querySelector('#musicNote:not([hidden])')"), '(no note, no prompt either)')
        await pl.mouse.click(700, 600); await pl.keyboard.press('Escape')
        check(await wait(pl, PLAYING('tasty-turnip'), 15000, 'player hears it'), 'her first click starts it', json.dumps(await pl.evaluate(ST)))
        s = await pl.evaluate(ST)
        check(s['playing']['preload'] == 'none' and s['playing']['src'].split('?')[0].endswith('tasty-turnip.webm') and s['elements'] == 1 and s['kind'] == 'webm', 'one element, preload none, the WebM copy (streamed, never all seven)', json.dumps(s['playing']))
        await pl.wait_for_timeout(2500)
        tg, tp = await gm.evaluate('tw.music.state().playing.time'), await pl.evaluate('tw.music.state().playing.time')
        check(abs(tg - tp) < 3.5 and tp > 3, f'both seats are at the same moment of the same track (GM {tg:.1f} s, player {tp:.1f} s: she joined mid-track at the synced place)')

        print('NOTE')
        check(await pl.evaluate('tw.music.note()') == 'The Tasty Turnip', 'the note says "The Tasty Turnip"')
        box = await pl.evaluate("(() => { const r = document.querySelector('#musicNote').getBoundingClientRect(); return [r.right, r.bottom, innerWidth, innerHeight]; })()")
        check(box[2] - box[0] < 40 and box[3] - box[1] < 60, 'in the bottom-right corner', str(box))
        check(await wait(pl, "!tw.music.note()", 9000, 'note fades'), 'and it fades by itself')

        print('EARS')
        await pl.evaluate("tw.settings.setPref('musicVol', 0.5)"); await pl.wait_for_timeout(2600)
        v = (await pl.evaluate(ST))['playing']['volume']
        check(abs(v - 0.25) < 0.02, f'the Music slider at 0.5: the element plays at {v:.3f} (the square)')
        await pl.keyboard.press('s'); await pl.wait_for_timeout(300); await pl.keyboard.press('k'); await pl.wait_for_timeout(400)
        note = await pl.evaluate("[...document.querySelectorAll('#settingsModal .sgrp, #settingsModal section, #settingsModal fieldset')].map(g => g.textContent).find(t => /Sound/.test(t) && /Music/.test(t)) || document.querySelector('#settingsModal').textContent")
        check('coming' not in note.split('Sound effects are coming')[0][-200:] and 'Your ears only' in note, 'Controls ▸ Sound no longer says "coming" for music', note[:160])
        await pl.click('#settingsModal [data-pref=music]'); await pl.wait_for_timeout(600)
        check(await pl.evaluate(SILENT) and (await pl.evaluate(ST))['muted'], 'Music off (Controls ▸ Sound): stopped, nothing streaming')
        check(await gm.evaluate(PLAYING('tasty-turnip')), "(the GM still hears it: it was her ears only)")
        await pl.click('#settingsModal [data-pref=music]'); await pl.keyboard.press('Escape')
        check(await wait(pl, PLAYING('tasty-turnip'), 15000), 'Music on again: it comes back')
        await pl.wait_for_timeout(1500)
        tg, tp = await gm.evaluate('tw.music.state().playing.time'), await pl.evaluate('tw.music.state().playing.time')
        check(abs(tg - tp) < 3.5, f'in step with the table (GM {tg:.1f} s, player {tp:.1f} s)')
        # the note's ♪ mutes
        await pl.evaluate("document.querySelector('#musicNote').hidden = false; document.querySelector('#musicNote').classList.add('show')")
        await pl.click('#musicNote .mn-mute'); await pl.wait_for_timeout(500)
        check(await pl.evaluate(SILENT) and (await pl.evaluate('tw.settings.prefs().music')) is False, "the note's ♪ mutes her music (a stored pref, this browser)")

        print('BAR')
        top = await bar(pl, 'unmute music')
        check(await wait(pl, PLAYING('tasty-turnip'), 15000), '"unmute music" (the player) brings it back', top)
        await bar(pl, 'mute music'); await pl.wait_for_timeout(400)
        check(await pl.evaluate(SILENT), '"mute music" silences it', json.dumps(await pl.evaluate(ST)))
        await bar(pl, 'unmute music')
        rows = await offered(pl, 'playlist') + await offered(pl, 'next track') + await offered(pl, 'music off')
        check(not any(('Playlist' in r or 'Next track' in r or 'Music off here' in r) for r in rows), 'the player is offered none of the GM\'s music words', str(rows[:6]))
        nk = await pl.evaluate("(async () => { const m = await tw.await(tw.sync.submit('music.set', { area: tw.area(), music: 'playlist' })); return m; })()")
        check(not nk, 'and the relay refuses her if she sends one anyway', str(nk))
        top = await bar(gm, 'playlist')
        check(await wait(gm, "tw.music.state().value === 'playlist' && tw.music.state().playing && !tw.music.state().playing.paused", 15000), '"playlist" (GM): the table plays every track, shuffled', top)
        await wait(pl, "tw.music.state().value === 'playlist' && tw.music.state().playing && !tw.music.state().playing.paused", 15000)
        a, b = await gm.evaluate('tw.music.state().playing.id'), await pl.evaluate('tw.music.state().playing.id')
        check(a == b, f'both seats hear the same playlist track ({a})')
        top = await bar(gm, 'next track')
        check(await wait(gm, f"tw.music.state().playing && tw.music.state().playing.id !== '{a}' && !tw.music.state().playing.paused", 15000), '"next track" moves on', top)
        nxt = await gm.evaluate('tw.music.state().playing.id')
        check(await wait(pl, f"tw.music.state().playing && tw.music.state().playing.id === '{nxt}'", 15000), f'for the player too ({nxt})')
        top = await bar(gm, 'music black mass')
        check(await wait(pl, PLAYING('black-mass'), 15000), '"music black mass" (GM): The Black Mass, for both', top)
        check(await pl.evaluate("tw.music.state().playing.loop") is True, 'one track loops')
        top = await bar(gm, 'music off')
        check(await wait(pl, SILENT, 10000) and await wait(gm, SILENT, 10000), '"music off" (GM): silence at both seats', top)

        print('AREAS')
        await gm.evaluate("tw.sync.submit('music.set', { area: tw.area(), music: 'tasty-turnip' })")
        await wait(gm, PLAYING('tasty-turnip'), 15000)
        CRYPT = await gm.evaluate("tw.createArea('Crypt')")
        await wait(gm, f"tw.sync.campaign.areas.some(a => a.id === '{CRYPT}')", 8000)
        await gm.evaluate(f"tw.sync.submit('music.set', {{ area: '{CRYPT}', music: 'black-mass' }})"); await gm.wait_for_timeout(500)
        await gm.evaluate(f"tw.setMain('{CRYPT}')")
        check(await wait(gm, PLAYING('black-mass'), 15000), 'the GM goes to the crypt: The Black Mass')
        check(await pl.evaluate(PLAYING('tasty-turnip')), '(the player, still in the inn, keeps The Tasty Turnip)')
        await gm.evaluate(f"tw.setMain('{INN}')")
        check(await wait(gm, PLAYING('tasty-turnip'), 15000), 'back in the inn: The Tasty Turnip again')
        # the campaign default reaches an area without music of its own
        await gm.evaluate(f"tw.sync.submit('area.set', {{ area: '{CRYPT}', settings: {{ music: null }} }})")
        await gm.keyboard.press('s'); await gm.wait_for_timeout(300); await gm.keyboard.press('d'); await gm.wait_for_timeout(400)
        dv = await gm.evaluate("document.querySelector('#settingsModal select[data-rule=music][data-scope=defaults]')?.value")
        check(dv == '', 'Area defaults ▸ Music reads Off (built-in)', str(dv))
        await gm.select_option('#settingsModal select[data-rule=music][data-scope=defaults]', 'playlist'); await gm.keyboard.press('Escape')
        await gm.evaluate(f"tw.setMain('{CRYPT}')")
        check(await wait(gm, "tw.music.state().value === 'playlist' && tw.music.state().playing && !tw.music.state().playing.paused", 15000), 'Area defaults = Playlist: the crypt (no music of its own) plays the playlist')
        check(await pl.evaluate(PLAYING('tasty-turnip')), '(the inn keeps its own pick)')
        await gm.evaluate(f"tw.setMain('{INN}')")

        print('AI GET')
        tok = await gm.evaluate("tw.createSeat({ kind: 'llm', name: 'Helper', color: '#b48cff', scope: { areas: '*', classes: ['area.admin', 'chat'] } })")
        cid = await gm.evaluate('tw.sync.campaign.id')
        q = urllib.parse.urlencode({'cmd': 'music.set', 'area': INN, 'music': 'In the Dark Soil', 'nonce': f'm{random.randrange(10**6)}', 'seat': tok})
        r = json.loads(http(f'{RELAY}/c/{cid}/do?{q}').read())
        check(r.get('ok'), 'a GM AI seat sets the music with a plain GET', str(r)[:200])
        check(await wait(pl, PLAYING('in-the-dark-soil'), 15000) and await wait(gm, PLAYING('in-the-dark-soil'), 15000), 'both tabs change to In the Dark Soil')

        print('LOW')
        await pl.evaluate("tw.settings.setGfx('low'); tw.settings.setPref('reducedMotion', true)"); await pl.wait_for_timeout(1500)
        check(await pl.evaluate(PLAYING('in-the-dark-soil')), 'low graphics and reduce motion: still playing')

        print('PHONE')
        ph = await tab(invite.replace('#', ('&' if '?' in invite.split('#')[0] else '?') + 'hand=1#', 1), w=390, h=844, is_mobile=True, has_touch=True)
        check(await wait(ph, 'window.tw && tw.ready && tw.ready() && tw.music && tw.music.ready', 45000), 'phone tab joined (?hand=1)')
        await ph.wait_for_timeout(1500)
        check(await ph.evaluate(SILENT) and not [u for (k, u) in media if k == id(ph)], 'nothing plays or streams on the phone before a tap')
        await ph.tap('canvas', position={'x': 200, 'y': 500})
        check(await wait(ph, PLAYING('in-the-dark-soil'), 15000), 'a tap starts it', json.dumps(await ph.evaluate(ST)))

        n = len({u.split('?')[0] for (_, u) in media})
        check(n <= 6, f'over the whole run {n} distinct music files were fetched (each only when it played)')
        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    time.sleep(0.3)
    for d in dirs: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\nmusic: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)

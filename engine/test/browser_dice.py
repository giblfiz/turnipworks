#!/usr/bin/env python3
"""REAL 3D DICE in the game (2026-10-19). Two seats (GM Harry, player Mira), three rooms A | B | C in a row (walls
between), fog of war on. Mira's pawn stands in A; B and C are dark to her. A GM-hidden pawn and a GM-hidden barrel stand in C.
  G1  the GM (no pawn) rolls 4d6 looking at C: the roller's client throws once and the recording rides the dice.roll
      command; BOTH tabs play it and every die's top face reads the committed number
  G2  both seats end with identical final poses (it is one recording, played twice)
  G3  SECRECY: the GM-hidden pawn and barrel are not colliders of that throw (it was simulated in the GM's client, which
      holds them)
  G4  LEAK: Mira's camera on C while the GM's dice tumble there: no die is drawn for her, and an in-frame A/B (time
      frozen; the dice there vs cleared) differs by 0 pixels
  G5  Mira rolls d20 + 2d6: thrown from her pawn, landing in A within reach; drawn for her and for the GM; tops read right
  G6  the chat line and the big announce wait for the dice to settle (the line is held while they tumble), and the
      roller's line is never shown before its dice settle, not even in the optimistic render before the relay's echo
  G7  Settings ▸ Me ▸ 3D dice off (Mira): the GM's next roll draws nothing for her; the chat line still arrives
  G8  linger then fade: the dice leave both scenes; nothing is busy after
  G9  no page errors
  G10 an AI seat rolls 2d6 over GET (the relay picks the numbers, no recording): each tab throws those dice itself,
      every top reads the committed numbers on both, and the line is held until they settle
Stills: engine/test/shots/dice-game-*.png
  local:  python3 engine/test/browser_dice.py --local
  dev:    ... browser_dice.py --page http://127.0.0.1:8180/   (GPU by default; TW_GPU=0 = SwiftShader, slow joins)
"""
import argparse, asyncio, io, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
# GPU BY DEFAULT (2026-10-19): on SwiftShader a player tab's full FX stack blocks its main thread ~80 s before it goes
# live (measured the same before the dice: a05f4974, d72f27e6, 3393fbc6), so the join timed out on dev. TW_GPU=0 forces
# software GL (then the join is given 240 s).
SOFT = os.environ.get('TW_GPU', '1') == '0'
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] if SOFT else ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
JOIN_MS = 240000 if SOFT else 90000
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE); SHOTS = os.path.join(HERE, 'shots')
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:400] if detail != '' else ''}", flush=True)

procs = []
RP, SP = 18311, 18312
def start_local():
    import socket
    for port in (RP, SP):  # (2026-10-20: a day-old run's relay on 18311 answered instead, and the suite tested old code)
        with socket.socket() as sk:
            if sk.connect_ex(('127.0.0.1', port)) == 0: sys.exit(f'port {port} is in use (a stale test server?): stop it first')
    data = tempfile.mkdtemp(prefix='tw-dice-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=50); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
def px(png): return np.asarray(Image.open(io.BytesIO(png)).convert('RGB')).astype(np.int16)
LAST = "tw.view().chat.slice(-1)[0]"
INFO = "tw.dice.info()"
def throw_of(i): return f"{INFO}.find(t => t.id === '{i}')"
LOOK = "(x, z, dist) => { const g = tw.main.grab; g.focus.set(x, 0, z); g.dist = dist; g.pitch = 55; g.yaw = 0; g.update(); }"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}, device_scale_factor=1)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.on('console', lambda m: errors.append(m.text[:200]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
            await pg.goto(url); return pg
        async def action(pg, code):
            await pg.evaluate(code); await wait(pg, 'tw.sync.pendingCount() === 0', 15000, 'command accepted'); await pg.wait_for_timeout(250)
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', f"TEST dice {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw?.ready?.() && tw.fog && tw.dice', JOIN_MS), 'GM did not come up'
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        pl = await tab(invite)
        assert await wait(pl, 'window.tw?.ready?.() && tw.fog && tw.dice', JOIN_MS), 'player did not join'
        seat = await pl.evaluate('tw.me()')
        for x in [0, 4, 8]:
            await gm.evaluate('(x) => tw.spawnRoom("common", x, 0, 4, 4, 7401+x)', x)
            await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        await action(gm, "tw.batch([...tw.worldOf(tw.area()).edges.values()].filter(e => e.sides.length === 1).map(e => ({type:'edge.set',args:{key:e.key,as:'wall',piece:'wall-straight'}})))")
        PA, HP, HB = 'tok_dicemira01', 'tok_dicehide01', 'obj_dicehide01'
        await action(gm, 'tw.batch(' + json.dumps([
            {'type': 'token.create', 'args': {'id': PA, 'name': 'Mira', 'x': 7.5, 'z': 12.5, 'owner': seat}},
            {'type': 'token.create', 'args': {'id': HP, 'name': 'Lurker', 'x': 50, 'z': 10, 'hidden': True}}]) + ')')
        await action(gm, f"tw.dispatch('object.place', {{ id: '{HB}', x: 47.5, z: 6.5, cat: 'barrel', ...tw.roomgen.sizeOf('barrel') }})")
        await action(gm, f"tw.dispatch('entity.flag', {{ ids: ['{HB}'], hidden: true }})")
        await action(gm, "tw.registry.run('area.fogOfWar.on')")
        await wait(pl, "tw.fog.visible(7.5, 12.5, 0) && !tw.fog.visible(50, 10, 0)", 30000, 'player vision')
        hidden_ok = await gm.evaluate(f"!!tw.entities()['{HP}']?.hidden && !!tw.entities()['{HB}']?.hidden")
        await gm.evaluate(f"({LOOK})(50, 10, 34)"); await pl.evaluate(f"({LOOK})(50, 10, 34)")
        await gm.wait_for_timeout(1200)

        print('GM ROLLS 4d6 OVER C')
        await gm.evaluate("tw.roll('4d6')")
        await wait(gm, f"{LAST}?.roll?.expr === '4d6'", 15000, 'gm roll committed')
        rid = await gm.evaluate(f"{LAST}.id"); rolls = await gm.evaluate(f"{LAST}.roll.rolls")
        last = await gm.evaluate('tw.dice.last')
        ok_both = await wait(gm, f"!!{throw_of(rid)}", 8000) and await wait(pl, f"!!{throw_of(rid)}", 8000)
        # G4 leak first, while they tumble: freeze time on Mira's tab, picture with the dice there, then with them cleared
        await pl.evaluate(f"tw.dice.seek('{rid}', 0.15)"); await pl.wait_for_timeout(300)
        drawn_mid = await pl.evaluate(f"{throw_of(rid)}.drawn")
        ab = await pl.evaluate("tw.dice.abPixels()")
        ab_gm = await gm.evaluate(f"tw.dice.seek('{rid}', 0.15), tw.dice.abPixels()")  # (the positive control: the GM's own screen DOES change)
        diff = ab['px'] if ab else None
        await gm.evaluate(f"tw.dice.seek('{rid}', 99)"); await pl.evaluate(f"tw.dice.seek('{rid}', 99)")  # (let them finish: seek holds a throw where it is put)
        await wait(gm, f"{throw_of(rid)}?.settled", 15000, 'gm settles')
        g = await gm.evaluate(throw_of(rid))
        check(ok_both and last and last['bytes'] > 0 and g and [d['reads'] for d in g['dice']] == rolls and all(g['drawn']),
              'G1 the GM\'s 4d6 throw rides the command; it plays on both tabs; every top reads the committed roll (GM tab)', {'rolls': rolls, 'reads': [d['reads'] for d in g['dice']] if g else None, 'tries': last and last['tries'], 'reasons': last and last['reasons'], 'fallback': last and last['fallback'], 'bytes': last and last['bytes'], 'ms': last and last['ms']})
        wsum = {'hidden_ok': hidden_ok, 'pawn_in': HP in last['world']['cylinders'], 'barrel_in': HB in last['world']['things'], 'left': last['world']['left'], 'boxes': last['world']['boxes'], 'walls': last['world']['walls']}
        check(hidden_ok and not wsum['pawn_in'] and not wsum['barrel_in'] and last['world']['left']['pawns'] >= 1 and last['world']['left']['things'] >= 1,
              'G3 SECRECY: the GM-hidden pawn and barrel are not colliders (they were left out of the GM\'s own throw)', wsum)
        check(not any(drawn_mid) and diff == 0 and ab_gm and ab_gm['px'] > 500, 'G4 LEAK: Mira (camera on dark C) draws none of the GM\'s dice: in-frame A/B (dice there vs taken out) differs by 0 pixels; on the GM\'s screen it does', {'drawn': drawn_mid, 'mira': ab, 'gm': ab_gm})
        await gm.screenshot(path=os.path.join(SHOTS, 'dice-game-gm-4d6.png'))
        # the frame strip: the same throw, 8 moments from the hand to rest (seeked playback), on the GM's screen
        await gm.evaluate(f"({LOOK})(50, 10, 26)"); await gm.wait_for_timeout(600)
        dur = await gm.evaluate(f"tw.worldOf(tw.area()).dice.duration('{rid}')"); fr = []
        for k in range(8):
            await gm.evaluate(f"tw.dice.seek('{rid}', {dur * k / 7})"); await gm.wait_for_timeout(300); fr.append(Image.open(io.BytesIO(await gm.screenshot())))
        w0, h0 = fr[0].size; sc = 0.42; strip = Image.new('RGB', (int(w0 * sc) * 4, int(h0 * sc) * 2))
        for k, im in enumerate(fr): strip.paste(im.resize((int(w0 * sc), int(h0 * sc))), ((k % 4) * int(w0 * sc), (k // 4) * int(h0 * sc)))
        strip.save(os.path.join(SHOTS, 'dice-game-4d6-strip.png'))

        print('BOTH TABS, ONE RECORDING: identical final poses')
        await gm.evaluate("tw.dice.clear()")
        await gm.evaluate("tw.roll('2d20')")
        await wait(gm, f"{LAST}?.roll?.expr === '2d20'", 15000)
        rid2 = await gm.evaluate(f"{LAST}.id")
        await wait(gm, f"{throw_of(rid2)}?.settled", 15000); await wait(pl, f"{throw_of(rid2)}?.settled", 15000)
        a = await gm.evaluate(throw_of(rid2)); b = await pl.evaluate(throw_of(rid2))
        same = a and b and all(abs(x - y) < 1e-4 for da, db in zip(a['dice'], b['dice']) for x, y in zip(da['p'] + da['q'], db['p'] + db['q']))
        check(same and [d['reads'] for d in b['dice']] == a['values'], 'G2 both seats end with identical final poses and read the same numbers', {'gm': [(d['p'], d['reads']) for d in a['dice']] if a else None, 'mira': [(d['p'], d['reads']) for d in b['dice']] if b else None})

        print('MIRA ROLLS d20 + 2d6 FROM HER PAWN IN A')
        await gm.evaluate(f"({LOOK})(10, 10, 30)"); await pl.evaluate(f"({LOOK})(10, 10, 30)"); await pl.wait_for_timeout(800)
        # every render of the chat while the roll is out: was a roll line ever shown (not 'pending') before its dice
        # settled? An observer sees the optimistic render too, the one that showed early before the echo (Harry
        # 2026-10-20: "results are going to chat instantly rather than after settling"; locally the echo is instant)
        await pl.evaluate("""(() => { window.__early = []; const box = document.querySelector('#chat');
          new MutationObserver(() => { for (const l of box.querySelectorAll('.line[data-id]')) { const id = l.dataset.id, t = tw.dice.info().find(x => x.id === id);
            if (!l.classList.contains('pending') && l.textContent.includes('d20+2d6') && !(t && t.settled)) window.__early.push({ id, at: performance.now(), throw: !!t }); } }).observe(box, { childList: true, subtree: true, attributes: true });
          // and the big announce: never up while this roll's dice are still out (it showed at once on prod, 258 ms in)
          window.__seenThrow = new Set();
          const iv = setInterval(() => { for (const t of tw.dice.info()) window.__seenThrow.add(t.id); const s = tw.announce.info().showing; if (!s) return; const t = tw.dice.info().find(x => x.id === s.id);
            if (t && !t.settled) window.__early.push({ id: s.id, announce: true }); const c = (tw.view().chat || []).find(x => x.id === s.id); if (c?.roll && !t && !window.__seenThrow?.has(s.id)) window.__early.push({ id: s.id, announce: true, before: 'dice' }); }, 20);
          setTimeout(() => clearInterval(iv), 20000); })()""")
        await pl.evaluate("tw.roll('d20+2d6')")
        await wait(pl, f"{LAST}?.roll?.expr === 'd20+2d6'", 15000)
        rid3 = await pl.evaluate(f"{LAST}.id"); rolls3 = await pl.evaluate(f"{LAST}.roll.rolls"); last3 = await pl.evaluate('tw.dice.last')
        held = await pl.evaluate(f"(() => {{ const l = document.querySelector('#chat .line[data-id=\"{rid3}\"]'); return {{ holding: tw.dice.holding('{rid3}'), pending: !l || l.classList.contains('pending'), announce: tw.announce.info().showing?.id === '{rid3}' }}; }})()")
        await wait(pl, f"{throw_of(rid3)}?.settled", 15000); await wait(gm, f"{throw_of(rid3)}?.settled", 15000)
        m = await pl.evaluate(throw_of(rid3)); mg = await gm.evaluate(throw_of(rid3))
        far = max(((d['p'][0] - 7.5) ** 2 + (d['p'][2] - 12.5) ** 2) ** 0.5 for d in m['dice'])
        check(last3 and abs(last3['from']['x'] - 7.5) < 0.01 and abs(last3['from']['z'] - 12.5) < 0.01 and far <= 12.01 and all(d['p'][0] < 20 for d in m['dice'])
              and [d['reads'] for d in m['dice']] == rolls3 and all(m['drawn']) and all(mg['drawn']),
              'G5 Mira\'s throw starts at her pawn, lands in A within reach, is drawn for her and the GM, and reads her numbers', {'from': last3 and last3['from'], 'far': round(far, 2), 'rolls': rolls3, 'reads': [d['reads'] for d in m['dice']]})
        await wait(pl, f"tw.announce.info().log.some(r => r.id === '{rid3}')", 15000)
        shown = await pl.evaluate(f"tw.announce.info().log.find(r => r.id === '{rid3}')?.shownAt")
        settled_at = await pl.evaluate(f"tw.dice.info().find(t => t.id === '{rid3}') ? performance.now() : null")
        line_shown = await pl.evaluate(f"!document.querySelector('#chat .line[data-id=\"{rid3}\"]')?.classList.contains('pending') || !!tw.announce.info().showing")
        early = await pl.evaluate("window.__early")
        held['shown_early'] = early[:3]
        check(held['holding'] and held['pending'] and not held['announce'] and shown is not None and line_shown and not early, 'G6 the chat line and the announce wait while the dice tumble, then show (never shown early, not even before the echo)', held)
        await pl.screenshot(path=os.path.join(SHOTS, 'dice-game-mira-d20-2d6.png'))

        print('AN AI SEAT ROLLS OVER GET (no throw): every tab throws it itself')
        await gm.evaluate("tw.dice.clear()"); await pl.evaluate("tw.dice.clear()")
        card = await gm.evaluate("async () => tw.cardUrl(await tw.createSeat({kind:'llm', name:'Helper', scope:{areas:'*', classes:['chat']}}))")
        cbase, tok = card.split('/card?')[0], urllib.parse.parse_qs(urllib.parse.urlparse(card).query)['seat'][0]
        area = await gm.evaluate('tw.area()')
        with urllib.request.urlopen(urllib.request.Request(f"{cbase}/a/{area}/do?cmd=dice.roll&expr=2d6&why=AI%20roll&nonce=airoll1&seat={tok}", headers={'User-Agent': 'TurnipWorks-acceptance/1.0'}), timeout=30) as r: ai = json.loads(r.read())
        rid5 = ai.get('id')
        seen_g = await wait(gm, f"!!{throw_of(rid5)}", 8000, 'gm throws the AI roll'); seen_p = await wait(pl, f"!!{throw_of(rid5)}", 8000, 'mira throws the AI roll')
        held5 = await pl.evaluate(f"tw.dice.holding('{rid5}')")
        await wait(gm, f"{throw_of(rid5)}?.settled", 20000); await wait(pl, f"{throw_of(rid5)}?.settled", 20000)
        a5 = await gm.evaluate(throw_of(rid5)); b5 = await pl.evaluate(throw_of(rid5))
        shown5 = await wait(pl, f"!!document.querySelector('#chat .line[data-id=\"{rid5}\"]') && !document.querySelector('#chat .line[data-id=\"{rid5}\"]').classList.contains('pending')", 8000, 'AI line shown')
        check(ai.get('ok') and len(ai.get('rolls', [])) == 2 and seen_g and seen_p and a5 and b5 and [d['reads'] for d in a5['dice']] == ai['rolls'] and [d['reads'] for d in b5['dice']] == ai['rolls'] and held5 and shown5,
              'G10 an AI seat\'s 2d6 over GET: the relay rolled, both tabs threw it themselves and read its numbers; the line waited, then showed', {'ai': {k: ai.get(k) for k in ('ok', 'rolls', 'total', 'why')}, 'gm': [d['reads'] for d in a5['dice']] if a5 else None, 'mira': [d['reads'] for d in b5['dice']] if b5 else None, 'held': held5})
        await pl.screenshot(path=os.path.join(SHOTS, 'dice-game-ai-2d6.png'))

        print('3D DICE OFF FOR MIRA')
        await pl.evaluate("tw.dice.clear(); tw.settings.setPref('dice3d', false)")
        await gm.evaluate("tw.roll('d12')")
        await wait(gm, f"{LAST}?.roll?.expr === 'd12'", 15000); rid4 = await gm.evaluate(f"{LAST}.id")
        await wait(pl, f"tw.view().chat.some(c => c.id === '{rid4}')", 15000); await pl.wait_for_timeout(1500)
        off = await pl.evaluate(f"({{ throw: !!{throw_of(rid4)}, line: tw.view().chat.some(c => c.id === '{rid4}') }})")
        check(not off['throw'] and off['line'], 'G7 3D dice off: nothing drawn for Mira, the chat line still arrives', off)

        print('LINGER, THEN FADE')
        ok_g = await wait(gm, "tw.dice.active() === 0 && !tw.dice.busy()", 20000, 'gm dice leave'); ok_p = await wait(pl, "tw.dice.active() === 0", 20000)
        check(ok_g and ok_p, 'G8 the dice linger, fade and leave both scenes; nothing busy after')
        check(not errors, 'G9 no page errors', errors[:4])
        await browser.close()
    for pr in procs: pr.terminate()
    n = sum(1 for r in results if r[0]); print(f'\nbrowser dice: {n}/{len(results)} passed'); sys.exit(0 if n == len(results) else 1)

asyncio.run(main())

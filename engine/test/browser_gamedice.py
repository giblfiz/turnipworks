#!/usr/bin/env python3
"""GAME DICE in the game (2026-10-29; Harry: "build the fancy dice for a few games, so that the LLMs have them to roll").
Two seats (GM Harry, player Mira, her pawn in one lit room). core/gamedice.js parses the words; every seat throws the
same dice and reads the same faces; the log and the announce say the tally.
  B1-B6  Mira types each game's roll in the command bar ("roll coc 65 bonus 1", "roll v5 7 hunger 2 diff 3", "roll sr 12",
         "roll duality +2", "roll 4df+1", "roll l5r 3 ring 2 skill"): the bar's top row is the roll; the committed expr is
         the canonical label; BOTH tabs play one recording (identical final poses), every die's top reads its committed
         face, each die wears its skin (Hunger, Hope/Fear, fudge, ring/skill), its tag says its face; the chat line reads
         "<title>: <tally> [faces]" on both tabs and the announce shows the short tally
  G1-G6  an AI seat rolls each form over GET: the relay rolls, the answer carries "tally"; both tabs throw those dice
         themselves and read the same faces; the log line says the same tally as the answer
  G7     a BIG pool over GET ("sr 20", 2026-10-29: a 12-dice pool once took 2.4 s in one tab and showed no dice there):
         both tabs show all twenty dice, each throw back within the wait (dicephys.js BIG POOLS)
  G8     the same for an Exalted pool of 15 (2026-10-30: "ex 15", pools of 10-20 are common there); B7 is "roll ex 8 d9"
  F1     forced faces (Beyond20's given numbers, app.roll opts.given): a V5 roll with a Hunger 10 and a Hunger 1 and an
         L5R roll showing every symbol land on exactly those faces (the stills the vision check reads)
  E1     no page errors
Stills: engine/test/shots/gamedice-*.png
  local:  python3 engine/test/browser_gamedice.py --local   (TW_PORTS=relay,site)
  dev:    ... browser_gamedice.py --page http://127.0.0.1:8180/
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()
SOFT = os.environ.get('TW_GPU', '1') == '0'
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] if SOFT else ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
JOIN_MS = 240000 if SOFT else 90000
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE); SHOTS = os.path.join(HERE, 'shots')
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:500] if detail != '' else ''}", flush=True)

procs = []
import atexit; atexit.register(lambda: [pr.terminate() for pr in procs])  # (a failed assert still stops this run's servers)
RP, SP = [int(x) for x in os.environ.get('TW_PORTS', '18341,18342').split(',')]
def start_local():
    import socket
    for port in (RP, SP):
        with socket.socket() as sk:
            if sk.connect_ex(('127.0.0.1', port)) == 0: sys.exit(f'port {port} is in use (a stale test server?): stop it first, or pass TW_PORTS')
    data = tempfile.mkdtemp(prefix='tw-gamedice-'); site = tempfile.mkdtemp(prefix='tw-site-')
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
LAST = "tw.view().chat.slice(-1)[0]"
def throw_of(i): return f"tw.dice.info().find(t => t.id === '{i}')"
LOOK = "(x, z, dist, pitch = 55) => { const g = tw.main.grab; g.focus.set(x, 0, z); g.dist = dist; g.pitch = pitch; g.yaw = 0; g.update(); }"
# what each die should read and wear, worked out in the page from the same modules the game uses
EXPECT = """async ([expr, rolls]) => { const D = await import(new URL('../core/dice.js', document.baseURI).href);
  const tb = new URL(document.querySelector('meta[name=tw-tuner]').content, document.baseURI), F = await import(new URL('js/fx/dicephys.js', tb).href);
  const p = D.parseDice(expr), list = F.diceOfRoll(p.terms, rolls), t = D.tallyOf(expr, rolls);
  return { label: p.label, values: list.map(d => d.value), skins: list.map(d => d.skin || null), tags: list.map(d => D.faceTag(d.skin, d.value, d.type === 'd10t')), title: t?.title, text: t?.text, short: t?.short, faces: t?.faces }; }"""
LINE = "(id) => { const l = document.querySelector(`#chat .line[data-id=\"${id}\"]`); return l ? { text: l.textContent.replace(/\\s+/g, ' ').trim(), pending: l.classList.contains('pending') } : null; }"

FORMS = [  # (bar words, canonical label, kind)
    ('roll coc 65 bonus 1', 'coc 65 bonus 1', 'coc'),
    ('roll v5 7 hunger 2 diff 3', 'v5 7 hunger 2 diff 3', 'v5'),
    ('roll sr 12', 'sr 12', 'sr'),
    ('roll duality +2', 'duality+2', 'duality'),
    ('roll 4df+1', '4dF+1', 'fate'),
    ('roll l5r 3 ring 2 skill', 'l5r 3 ring 2 skill', 'l5r'),
    ('roll ex 8 d9', 'ex 8 double 9', 'ex'),
]

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
        await gm.fill('#newCampaign input[name=name]', f"TEST gamedice {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw?.ready?.() && tw.dice', JOIN_MS), 'GM did not come up'
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        pl = await tab(invite)
        assert await wait(pl, 'window.tw?.ready?.() && tw.dice', JOIN_MS), 'player did not join'
        seat = await pl.evaluate('tw.me()')
        await gm.evaluate('tw.spawnRoom("common", 0, 0, 8, 6, 7711)')
        await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        PA = 'tok_gdmira0001'
        await action(gm, 'tw.batch(' + json.dumps([{'type': 'token.create', 'args': {'id': PA, 'name': 'Mira', 'x': 12.5, 'z': 17.5, 'owner': seat}}]) + ')')
        for pg in (gm, pl): await pg.evaluate(f"({LOOK})(20, 12, 34)")
        await gm.wait_for_timeout(1500)

        async def settle_both(rid, timeout=20000):
            a = await wait(gm, f"{throw_of(rid)}?.settled", timeout, 'gm settles'); b = await wait(pl, f"{throw_of(rid)}?.settled", timeout, 'mira settles')
            return a and b
        async def close_shot(pg, rid, name):
            t = await pg.evaluate(throw_of(rid))
            if not t: return
            xs = [d['p'][0] for d in t['dice']]; zs = [d['p'][2] for d in t['dice']]
            for _ in range(4):  # (the big announce card covers the middle of the screen: a click lands it)
                await pg.evaluate("document.querySelector('#announce .ann')?.click()"); await pg.wait_for_timeout(250)
            await wait(pg, "!tw.announce.info().showing", 4000, 'announce gone')
            await pg.evaluate(f"({LOOK})({sum(xs) / len(xs)}, {sum(zs) / len(zs)}, 16, 62)"); await pg.wait_for_timeout(700)
            await pg.screenshot(path=os.path.join(SHOTS, f'gamedice-{name}.png'))

        print('MIRA ROLLS EACH GAME\'S DICE IN THE BAR')
        for i, (words, label, kind) in enumerate(FORMS):
            for pg in (gm, pl): await pg.evaluate("tw.dice.clear()"); await pg.evaluate(f"({LOOK})(20, 12, 34)")
            await pl.wait_for_timeout(300)
            if not await pl.locator('#bar').evaluate("e => e.classList.contains('open')"): await pl.keyboard.press('/')
            await pl.locator('#bar input').fill(words); await pl.wait_for_timeout(300)
            top = await pl.evaluate("document.querySelector('#results .res[data-i=\"0\"]')?.dataset.ref || null")
            await pl.keyboard.press('Enter')
            got = await wait(pl, f"{LAST}?.roll?.expr === {json.dumps(label)}", 15000, f'{kind} committed')
            rid = await pl.evaluate(f"{LAST}.id"); rolls = await pl.evaluate(f"{LAST}.roll.rolls")
            settled = await settle_both(rid)
            a = await gm.evaluate(throw_of(rid)); b = await pl.evaluate(throw_of(rid)); X = await pl.evaluate(EXPECT, [label, rolls])
            same = bool(a and b) and all(abs(x - y) < 1e-4 for da, db in zip(a['dice'], b['dice']) for x, y in zip(da['p'] + da['q'], db['p'] + db['q']))
            reads_ok = bool(a and b) and [d['reads'] for d in a['dice']] == X['values'] == [d['reads'] for d in b['dice']]
            skins_ok = bool(b) and [d.get('skin') for d in b['dice']] == X['skins'] and [d.get('skin') for d in a['dice']] == X['skins']
            await wait(pl, f"(() => {{ const t = {throw_of(rid)}; return t && t.dice.every(d => d.tag); }})()", 6000, 'tags')
            tags = [d.get('tag') for d in (await pl.evaluate(throw_of(rid)) or {'dice': []})['dice']]
            await wait(gm, f"tw.announce.info().showing?.id === '{rid}'", 15000, 'announce up')
            ann = await gm.evaluate("document.querySelector('#announce .ann')?.textContent.replace(/\\s+/g, ' ').trim() || ''")
            await wait(gm, f"(({LINE})('{rid}') || {{}}).pending === false", 8000); await wait(pl, f"(({LINE})('{rid}') || {{}}).pending === false", 8000)
            lg = await gm.evaluate(LINE, rid); lp = await pl.evaluate(LINE, rid)
            want_line = f"{X['title']}: {X['text']} [{X['faces']}]"
            line_ok = bool(lg and lp) and want_line in lg['text'] and want_line in lp['text']
            check(top == 'cmd:chat.roll' and got and settled and same and reads_ok and skins_ok and tags == X['tags'] and line_ok and X['title'] in ann and X['short'] in ann,
                  f'B{i + 1} bar "{words}": one throw on both tabs, faces and skins right, tags, the log says "{want_line}"',
                  {'top': top, 'rolls': rolls, 'reads': [d['reads'] for d in b['dice']] if b else None, 'want': X['values'], 'skins': [d.get('skin') for d in b['dice']] if b else None, 'tags': tags, 'wantTags': X['tags'], 'same': same, 'line': lp and lp['text'], 'announce': ann[:120]})
            await close_shot(gm, rid, f'bar-{kind}')

        print('AN AI SEAT ROLLS EACH OVER GET')
        area = await gm.evaluate('tw.area()')
        seats = []
        for k in range(3):  # (an AI seat may roll 3 times a minute)
            card = await gm.evaluate(f"async () => tw.cardUrl(await tw.createSeat({{kind:'llm', name:'Dice {k}', scope:{{areas:'*', classes:['chat']}}}}))")
            seats.append((card.split('/card?')[0], urllib.parse.parse_qs(urllib.parse.urlparse(card).query)['seat'][0]))
        GET_FORMS = ['coc 65 bonus 1', 'v5 7 hunger 2 diff 3', 'sr 12 threshold 2', 'duality 2', '4df 1', 'l5r 3 ring 2 skill', 'sr 20', 'ex 15']
        for i, expr in enumerate(GET_FORMS):
            for pg in (gm, pl): await pg.evaluate("tw.dice.clear()")
            cbase, tok = seats[i // 3]
            await gm.evaluate("tw.say('(the table talks)')")  # (a person speaking resets the AI-to-AI loop count)
            url = f"{cbase}/a/{area}/do?cmd=dice.roll&expr={urllib.parse.quote(expr)}&why=AI%20roll&nonce=gd{i}{int(time.time())}&seat={tok}"
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'TurnipWorks-acceptance/1.0'}), timeout=30) as r: ai = json.loads(r.read())
            rid = ai.get('id')
            seen = await wait(gm, f"!!{throw_of(rid)}", 8000, 'gm throws') and await wait(pl, f"!!{throw_of(rid)}", 8000, 'mira throws')
            settled = seen and await settle_both(rid)
            a = await gm.evaluate(throw_of(rid)); b = await pl.evaluate(throw_of(rid)); X = await pl.evaluate(EXPECT, [ai.get('expr', ''), ai.get('rolls', [])])
            reads_ok = bool(a and b) and [d['reads'] for d in a['dice']] == X['values'] == [d['reads'] for d in b['dice']] and [d.get('skin') for d in b['dice']] == X['skins']
            await wait(pl, f"(({LINE})('{rid}') || {{}}).pending === false", 8000)
            lp = await pl.evaluate(LINE, rid)
            throws = [await pg.evaluate("(({ tries, fallback, ms, wall, n, hands, setDown, reasons } = tw.dice.last || {}) => ({ tries, fallback, ms, wall, n, hands, setDown, wait: n && tw.dice.waitFor(n), reasons }))()") for pg in (gm, pl)]
            big = {'sr 20': 20, 'ex 15': 15}.get(expr)
            big_ok = not big or (all(t.get('n') == big and t.get('wall') is not None and t['wall'] <= t['wait'] for t in throws) and bool(a and b) and len(a['dice']) == len(b['dice']) == big)
            check(ai.get('ok') and ai.get('tally') == f"{X['title']}: {X['text']}" and settled and reads_ok and lp and ai['tally'] in lp['text'] and big_ok,
                  f'G{i + 1} GET expr="{expr}": the relay rolled, "tally" in the answer; both tabs threw it and read the same faces; the log says the tally' + (f' (a big pool: all {big} dice on both tabs, in time)' if big else ''),
                  {'ai': {k: ai.get(k) for k in ('ok', 'expr', 'rolls', 'tally')}, 'reads': [d['reads'] for d in b['dice']] if b else None, 'want': X['values'], 'line': lp and lp['text'], 'throws': throws})
            if i in (1, 5): await close_shot(pl, rid, f'get-{ai.get("expr", "x").split()[0]}')

        print('FORCED FACES (given numbers): the symbols the vision check reads')
        for pg in (gm, pl): await pg.evaluate("tw.dice.clear()"); await pg.evaluate(f"({LOOK})(20, 12, 34)")
        for name, expr, rolls in [('v5-forced', 'v5 6 hunger 2', [10, 7, 1, 6, 10, 1]), ('l5r-forced', 'l5r 3 ring 3 skill', [6, 2, 4, 12, 10, 3]), ('fate-forced', '4dF+1', [6, 1, 3, 5]), ('duality-forced', 'duality+1', [11, 4])]:
            await pl.evaluate("tw.dice.clear()"); await gm.evaluate("tw.dice.clear()")
            X = await pl.evaluate(EXPECT, [expr, rolls])
            await pl.evaluate(f"tw.roll({json.dumps(expr)}, '', {{ given: {{ rolls: {json.dumps(rolls)}, total: 0 }} }})")
            await wait(pl, f"{LAST}?.roll?.expr === {json.dumps(X['label'])}", 15000)
            rid = await pl.evaluate(f"{LAST}.id"); settled = await settle_both(rid)
            a = await gm.evaluate(throw_of(rid)); b = await pl.evaluate(throw_of(rid))
            check(settled and a and b and [d['reads'] for d in a['dice']] == X['values'] == [d['reads'] for d in b['dice']], f'F1 forced {expr} {rolls}: both tabs land on exactly those faces', {'reads': [d['reads'] for d in b['dice']] if b else None, 'want': X['values']})
            await close_shot(gm, rid, name)
        check(not errors, 'E1 no page errors', errors[:4])
        await browser.close()
    for pr in procs: pr.terminate()
    n = sum(1 for r in results if r[0]); print(f'\nbrowser gamedice: {n}/{len(results)} passed'); sys.exit(0 if n == len(results) else 1)

asyncio.run(main())

#!/usr/bin/env python3
"""THE BAR'S CATALOG: what a GM or player types, and what the command bar puts first.  (2026-10-20)

  TW_GPU=1 python3 engine/test/browser_barcat.py --local [--dump DIR] [--only CORPUS,PERMS]
  (heavy runs: wrap in tw-slot; TW_PORTS=a,b when another worktree runs it at the same time)

  CORPUS   every line of engine/test/bar-corpus.json (about 300 things people type) is typed into the REAL bar, for the
           seat and selection it names; the line passes when one of its wanted rows is in the top `k` (default 3).
           Prints hit@1 and hit@3; the suite fails when a line marked "must" misses, or when hit@3 falls under FLOOR.
  PERMS    the player seat: every "deny" row (GM-only commands, room labels, hidden rooms) never appears, for any line.
  --dump   writes inventory.json (every command with its words and where it applies, the catalog, figures, room and
           building types) and corpus-results.json to DIR; experiments/2026-10-20-bar-catalog/inventory.py turns them
           into inventory.md. This is the periodic redo: docs/STATUS.md "The bar's catalog, redone periodically".

A wanted row is its data-ref (bar.js): cmd:<command id> · cat:<catalog id> · fig:<figure id> · ent:@alias · area:@alias ·
send:@alias · seat:@alias; a trailing * matches a prefix ("fig:goblin*"). "title:<text>" matches a row's words instead.
Aliases are the scene this suite builds: @room (Common room), @chapel, @temple (a whole temple building), @pawn (Brakka),
@crate, @door, @lantern, @hidden (a treasure chest hidden from players), @dungeon (a second area), @mira (the player's seat). Writes nothing outside a throwaway campaign.
"""
import argparse, asyncio, atexit, fnmatch, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402  test writes go to the server's sandbox, never the house look
tw_sandbox.remove_campaigns()  # the campaign this suite makes is a throwaway: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
ap.add_argument('--dump'); ap.add_argument('--only'); ap.add_argument('--corpus', default=os.path.join(HERE, 'bar-corpus.json')); ap.add_argument('--verbose', action='store_true'); ap.add_argument('--probe', help='JS evaluated on the GM page after the scene is built, printed (debugging a line)')
A = ap.parse_args()
if not A.local and not A.page: ap.error('choose --local or --page URL')
ONLY = set((A.only or 'CORPUS,PERMS').upper().split(','))
FLOOR = {'hit3': 0.97, 'hit1': 0.92}  # 2026-10-20: origin/main scored 0.758 / 0.685 on this corpus, the update 1.000 / 0.964; a drop under these fails
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
@atexit.register
def _cleanup():
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
    for pr in procs:
        try: pr.wait(timeout=5)
        except subprocess.TimeoutExpired: pr.kill(); pr.wait()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18183,18813').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-barcat-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
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
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False

# Type every query of one (seat, selection) group into the real bar and read the rows back, in order.
RUN = """async ([qs, sel]) => {
  tw.select(sel); await new Promise(r => setTimeout(r, 60));
  tw.emit('bar.open'); const input = document.querySelector('#bar input'), out = [];
  for (const q of qs) {
    input.value = q; input.dispatchEvent(new Event('input'));
    out.push([...document.querySelectorAll('#results .res')].map(el => ({ ref: el.dataset.ref || '', t: el.querySelector('.t')?.textContent || '', d: el.classList.contains('disabled') })));
  }
  input.value = ''; input.dispatchEvent(new Event('input')); document.activeElement?.blur(); tw.registry.surfaces.find(s => s.name === 'bar')?.close(); tw.select([]);
  return out;
}"""
DUMP = """(ctxs) => {
  const R = tw.registry, f = (v) => typeof v === 'function' ? 'fn' : v ?? null;
  const where = {}; for (const [k, sel] of Object.entries(ctxs)) { tw.select(sel); const c = R.ctx(); for (const x of R.available(c)) (where[x.id] ||= []).push(k); }
  tw.select([]); const ctx = R.ctx();
  return {
    commands: R.all().map(c => ({ id: c.id, title: String(R.titleOf(c, ctx)), synonyms: c.synonyms, keys: c.keys, group: c.group, hidden: !!c.hidden, stub: !!c.stub, cls: f(c.cls), parse: !!c.parse, toggle: !!c.toggle, menu: !!c.menu, where: where[c.id] || [] })),
    catalog: tw.assets.catalog.map(c => ({ id: c.id, name: c.name, desc: c.desc, hint: c.hint, place: c.place, terms: c.terms || '' })),
    figures: tw.figures.list.map(x => ({ id: x.id, name: x.name, group: x.group, cls: x.cls, race: x.race, tags: x.tags, srd: x.srd })),
    roomTypes: tw.roomgen.typeList.map(t => ({ key: t.key, label: t.label })),
    buildingTypes: [...tw.taxonomy.nodes.values()].filter(n => n.level === 'type').map(n => ({ id: n.id, code: n.code, label: n.label, disabled: !!n.disabled })),
  };
}"""

def wanted(want, rows, alias):
    def one(w, r):
        if w.startswith('title:'): return w[6:].lower() in r['t'].lower()
        for a, v in alias.items(): w = w.replace(a, v)
        return fnmatch.fnmatchcase(r['ref'], w)
    return [i for i, r in enumerate(rows) if any(one(w, r) for w in want)]

async def main():
    corpus = json.load(open(A.corpus))
    url = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1400, 'height': 900})
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
            await pg.goto(url); return pg
        gm = await tab(url)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', f"TEST bar catalog {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready?.()', 60000), 'GM ready')
        await gm.evaluate("tw.setVisibility('open')")
        invite = await gm.evaluate("(async () => { tw.registry.run('people.invite', { name: 'Mira' }); for (let i = 0; i < 100 && document.querySelector('#output').hidden; i++) await new Promise(r => setTimeout(r, 50)); return document.querySelector('#output textarea')?.value || ''; })()")
        await gm.keyboard.press('Escape')
        # the scene the corpus names: rooms, a whole temple, a pawn, a crate, a door, a lantern, a second area
        alias = await gm.evaluate("""async () => {
          const W = (ms) => new Promise(r => setTimeout(r, ms)), E = () => tw.entities();
          const room = tw.spawnRoom('common', 2, 2, 6, 5, 4101); await W(300);
          const chapel = tw.spawnRoom(tw.roomgen.typeList.find(t => /chapel|shrine|temple/.test(t.key))?.key || 'storeroom', 12, 2, 4, 4, 4102); await W(300);
          const node = tw.buildingNode('temple') || tw.buildingNode('inn'); tw.buildAt(node, 10, 8); await W(600);
          const temple = Object.values(E()).find(e => e.kind === 'building' && e.gen)?.id || ''; // the generated one (a drawn room makes a building too)
          tw.dispatch('token.create', { id: 'tok_barcat0001', name: 'Brakka', x: 12.5, z: 12.5 });
          const put = (id, cat, x, z) => { const sz = tw.roomgen.sizeOf(cat); tw.dispatch('object.place', { id, name: cat.replace(/-/g, ' '), cat, sku: sz.sku, url: sz.url, place: tw.assets.catalog.find(c => c.id === cat)?.place || 'floor', x, z, dims: sz.dims, s: sz.s || undefined, yaw: sz.yaw }); };
          put('obj_barcat0crate', 'crate', 17.5, 12.5); put('obj_barcat00door', 'door-plank', 22.5, 12.5); put('obj_barcat0hoard', 'chest-treasure', 32.5, 12.5);
          tw.dispatch('object.set', { id: 'obj_barcat0hoard', name: 'Hidden hoard' }); tw.flag(['obj_barcat0hoard'], { hidden: true }); // hidden from players: never in their results
          const lamp = tw.assets.catalog.find(c => /lantern/.test(c.id) && tw.assets.lightable?.(c.id))?.id || tw.assets.catalog.find(c => /lantern|candle/.test(c.id))?.id;
          put('obj_barcat00lamp', lamp, 27.5, 12.5);
          const dungeon = tw.createArea('Dungeon'); await W(800);
          return { '@room': room, '@chapel': chapel, '@temple': temple, '@pawn': 'tok_barcat0001', '@crate': 'obj_barcat0crate', '@door': 'obj_barcat00door', '@lantern': 'obj_barcat00lamp', '@dungeon': dungeon, '@lampcat': lamp, '@hidden': 'obj_barcat0hoard' };
        }""")
        check(all(alias.values()), 'the scene: rooms, a temple, a pawn, a crate, a door, a lantern and a second area', alias)
        player = await tab(invite + '&nofx&nointro')
        check(await wait(player, 'window.tw && tw.ready?.() && Object.keys(tw.entities()).length > 3', 60000), 'the player seat is ready and sees the area')
        alias['@mira'] = await gm.evaluate("tw.sync.campaign.seats.find(s => s.name === 'Mira')?.id || ''")
        CTX = {'none': [], 'pawn': ['@pawn'], 'prop': ['@crate'], 'door': ['@door'], 'lantern': ['@lantern'], 'room': ['@room'], 'chapel': ['@chapel'], 'building': ['@temple'], 'pawn+crate': ['@pawn', '@crate']}
        sel = lambda k: [alias[a] for a in CTX[k]]

        if A.probe: print('  probe:', json.dumps(await gm.evaluate(A.probe), default=str)[:4000])
        if A.dump:
            os.makedirs(A.dump, exist_ok=True)
            inv = await gm.evaluate(DUMP, {k: sel(k) for k in CTX})
            inv['player'] = await player.evaluate("(sels) => { const R = tw.registry, out = {}; for (const [k, s] of Object.entries(sels)) { tw.select(s); out[k] = R.available(R.ctx()).map(c => c.id); } tw.select([]); return out; }", {k: sel(k) for k in ('none', 'pawn')})
            json.dump(inv, open(os.path.join(A.dump, 'inventory.json'), 'w'), indent=1)
            print(f"  (inventory: {len(inv['commands'])} commands, {len(inv['catalog'])} catalog things, {len(inv['figures'])} figures, {len(inv['roomTypes'])} room types, {len(inv['buildingTypes'])} building types → {A.dump})")

        # ---------- CORPUS: the real bar, line by line ----------
        groups = {}
        for i, c in enumerate(corpus['cases']): groups.setdefault((c.get('seat', 'gm'), c.get('ctx', 'none')), []).append(i)
        got = [None] * len(corpus['cases'])
        for (seat, ck), idx in groups.items():
            pg = gm if seat == 'gm' else player
            rows = await pg.evaluate(RUN, [[corpus['cases'][i]['q'] for i in idx], sel(ck)])
            for i, r in zip(idx, rows): got[i] = r
        h1 = h3 = n = 0; misses = []; must_miss = []; report = []
        for c, rows in zip(corpus['cases'], got):
            if not c.get('want'): continue
            pos = wanted(c['want'], rows, alias); k = c.get('k', 3); n += 1
            r1, r3 = bool(pos) and pos[0] == 0, bool(pos) and pos[0] < k
            h1 += r1; h3 += r3
            report.append({**c, 'pos': pos[0] if pos else None, 'top': [r['ref'] or r['t'] for r in rows[:4]]})
            if not r3: misses.append(f"{c['q']!r} [{c.get('seat', 'gm')}/{c.get('ctx', 'none')}] want {c['want']} got {[r['ref'] or r['t'][:30] for r in rows[:3]]}")
            if not r3 and c.get('must'): must_miss.append(c['q'])
        if 'CORPUS' in ONLY:
            print(f"CORPUS  {n} lines: hit@1 {h1}/{n} = {h1 / n:.3f} · hit@3 {h3}/{n} = {h3 / n:.3f}")
            for m in misses if A.verbose else misses[:40]: print('    miss', m)
            check(h3 / n >= FLOOR['hit3'], f"hit@3 at least {FLOOR['hit3']}", f'{h3 / n:.3f}')
            check(h1 / n >= FLOOR['hit1'], f"hit@1 at least {FLOOR['hit1']}", f'{h1 / n:.3f}')
            check(not must_miss, 'every line marked "must" is in its top k', must_miss)
        if A.dump: json.dump({'hit1': h1, 'hit3': h3, 'n': n, 'cases': report}, open(os.path.join(A.dump, 'corpus-results.json'), 'w'), indent=1)

        # ---------- PERMS: what a player must never be offered ----------
        if 'PERMS' in ONLY:
            leaks = []
            for c, rows in zip(corpus['cases'], got):
                if c.get('seat') != 'player': continue
                for w in c.get('deny', []) + corpus.get('playerDeny', []):
                    if wanted([w], rows, alias): leaks.append(f"{c['q']!r}: {w}")
            np_ = sum(1 for c in corpus['cases'] if c.get('seat') == 'player')
            check(np_ >= 20 and not leaks, f'a player is never offered a GM-only row, a room name or a hidden thing ({np_} player lines)', leaks[:10])
            # and the GM's own rows are really there for the GM (the deny list is not vacuous)
            gm_rows = await gm.evaluate(RUN, [['hide labels', 'darkness on', 'build chapel', 'new area', 'invite'], []])
            check(all(r for r in gm_rows) and wanted(['cmd:view.labels'], gm_rows[0], alias) and wanted(['cmd:build.*'], gm_rows[2], alias), 'the same words find the GM-only rows for the GM', [[x['ref'] for x in r[:2]] for r in gm_rows])
        check(not errors, 'no page errors', errors[:3])
        await browser.close()
    bad = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(bad)}/{len(results)} checks passed")
    sys.exit(1 if bad else 0)

asyncio.run(main())

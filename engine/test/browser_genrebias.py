#!/usr/bin/env python3
"""THE BAR LEANS TO THE TABLE'S GENRE (2026-11-08; client/genrebias.js, docs/UI.md "The bar leans to the table's genre").

  TW_GPU=1 TW_PORTS=18447,18448 python3 engine/test/browser_genrebias.py --local [--dump DIR]

Builds four tables in one throwaway campaign, each in its own area: EMPTY (nothing), FANTASY (a generated tavern), MODERN
(a generated office tower) and MIXED (the tavern's twin and an office tower side by side), types the ambiguous words into
the REAL bar on each, with the genre tilt and with it switched off (tw.genreProfile stubbed to no signal: the bar as it
was), and checks:
  EMPTY    no signal, and every row, in order, the same with and without the tilt (the bar as it was)
  PROFILE  the fantasy table reads fantasy, the modern table modern, the mixed table both
  SHIFT    the top three things and figures move toward the table's genre (counted over every word); the mixed table's
           count lies between the other two; the words with a clear modern and fantasy sense pick the table's
  NAMES    an exact name still comes first: "car" on the fantasy table, "dragon" (figures) and "crate" on the modern one
  KEEP     nothing disappears: as many rows, the same sections in the same order, and every row that is not a thing or a
           figure (commands, the world, places, people) exactly where it was
  FAST     a keystroke with the tilt costs about what it did without
--dump DIR writes top3.json and top3.md (the before / after table for Harry) to DIR.
--empty-html FILE: the empty table's whole result list for every word and corpus line, as the page drew it; it needs
           nothing of this lane's, so the same run on the code before it (git stash) proves the empty bar byte-identical.
"""
import argparse, asyncio, atexit, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402  test writes go to the server's sandbox, never the house look
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--dump'); ap.add_argument('--empty-html', help='only: write the empty table\'s full result lists (WORDS and every corpus line) to this JSON file and stop (run it on old code too, and diff)')
A = ap.parse_args()
if not A.local and not A.page: ap.error('choose --local or --page URL')
# the ambiguous words: each has a fantasy sense and a modern one in the catalog or the figures
WORDS = ['chair', 'table', 'bed', 'door', 'guard', 'soldier', 'lamp', 'shelf', 'bar', 'stool', 'bench', 'desk', 'cabinet', 'weapon', 'thug', 'bartender', 'window', 'sofa']
# the words whose top thing (or figure) is the OTHER genre's on that table without the tilt, and must not be with it (the
# table's own, or a thing of both genres: the plain chair has a modern look, the street bench is in both sets)
CLEAR = {'modern': [('cat', 'chair'), ('cat', 'door'), ('cat', 'table'), ('cat', 'bench'), ('cat', 'cabinet'), ('cat', 'desk'), ('cat', 'weapon'), ('fig', 'guard'), ('fig', 'thug'), ('fig', 'soldier')],
         'fantasy': [('cat', 'lamp'), ('fig', 'bartender')]}
OTHER = {'modern': 'fantasy', 'fantasy': 'modern'}
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

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18447,18448').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-genrebias-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500&boxes'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False

# every word into the real bar, with the tilt (on) and without (off: the profile stubbed to no signal), rows in order
RUN = """async (qs) => {
  const rowsOf = () => [...document.querySelectorAll('#results .res')].map(el => ({ ref: el.dataset.ref || '', t: el.querySelector('.t')?.textContent || '' }));
  const sections = () => [...document.querySelectorAll('#results .sec')].map(el => el.textContent);
  const keep = tw.genreProfile, off = () => ({ mix: {}, strength: 0, mass: 0 });
  const pass = (stub) => { if (stub) tw.genreProfile = off; const out = {}; try { for (const q of qs) { tw.emit('bar.open', q); out[q] = { rows: rowsOf(), secs: sections(), html: document.querySelector('#results').innerHTML.length }; } } finally { tw.genreProfile = keep; } return out; };
  const time = (stub) => { if (stub) tw.genreProfile = off; const t0 = performance.now(); try { for (let k = 0; k < 4; k++) for (const q of qs) tw.emit('bar.open', q); } finally { tw.genreProfile = keep; } return (performance.now() - t0) / (4 * qs.length); };
  const on = pass(false), offRows = pass(true);
  const msOff = time(true), msOn = time(false), msOff2 = time(true), msOn2 = time(false);
  tw.registry.surfaces.find(s => s.name === 'bar')?.close();
  const g = (ref) => ref.startsWith('cat:') ? tw.genres.catGenre(ref.slice(4)) : ref.startsWith('fig:') ? tw.genres.figGenre(ref.slice(4)) : null;
  const genres = {}; for (const r of [...Object.values(on), ...Object.values(offRows)]) for (const x of r.rows) if (/^(cat|fig):/.test(x.ref)) genres[x.ref] = g(x.ref);
  const p = tw.genreProfile();
  return { on, off: offRows, genres, profile: { mix: p.mix, strength: p.strength, mass: p.mass }, ms: { off: Math.min(msOff, msOff2), on: Math.min(msOn, msOn2) } };
}"""

def top(rows, kind, k=3): return [r['ref'][4:] for r in rows if r['ref'].startswith(kind + ':')][:k]
def fam(g, want): return g == want or (want == 'fantasy' and g is not None and g.startswith('cultures'))

async def main():
    url = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro&boxes'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1400, 'height': 900})
        gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(str(e)))
        await gm.goto(url)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', f"TEST genre bias {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready?.()', 60000), 'GM ready')
        got = {}
        # EMPTY first: the campaign's own first area, nothing in it, nothing else loaded
        check(await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind !== 'area').length") == 0, 'the first area is empty')
        if A.empty_html:
            corpus = [c['q'] for c in json.load(open(os.path.join(HERE, 'bar-corpus.json')))['cases'] if c.get('seat', 'gm') == 'gm' and c.get('ctx', 'none') == 'none']
            html = await gm.evaluate("(qs) => { const out = {}; for (const q of qs) { tw.emit('bar.open', q); out[q] = document.querySelector('#results').innerHTML; } tw.registry.surfaces.find(s => s.name === 'bar')?.close(); return out; }", WORDS + corpus)
            json.dump(html, open(A.empty_html, 'w'), indent=0); print(f'  (the empty table: {len(html)} lines → {A.empty_html})'); await browser.close(); return
        got['empty'] = await gm.evaluate(RUN, WORDS)
        # the other three tables, an area each (the area left behind is unsubscribed: only the table in view counts)
        BUILD = """async ([name, codes]) => {
          const W = (ms) => new Promise(r => setTimeout(r, ms));
          const id = tw.createArea(name); for (let i = 0; i < 100 && !tw.sync.campaign.areas.some(a => a.id === id); i++) await W(50);
          tw.setMain(id); for (let i = 0; i < 100 && !tw.sync.view(id); i++) await W(50); await W(300);
          for (const c of codes) { tw.buildAt(tw.buildingNode(c), 10, 8); await W(1500); }
          for (let i = 0; i < 60 && Object.values(tw.entities()).filter(e => e.kind === 'object').length < 10 * codes.length; i++) await W(100);
          await W(500);
          const E = Object.values(tw.entities()); return { rooms: E.filter(e => e.kind === 'room').map(e => e.recipe.type), things: E.filter(e => e.kind === 'object').length };
        }"""
        for key, name, codes in (('fantasy', 'Tavern', ['TAV']), ('modern', 'Office', ['OFC']), ('mixed', 'Crossroads', ['TAV', 'OFC'])):
            made = await gm.evaluate(BUILD, [name, codes])
            check(made['rooms'] and made['things'] >= 10, f'the {key} table is built', f"{len(made['rooms'])} rooms ({', '.join(sorted(set(made['rooms'])))}), {made['things']} things")
            got[key] = await gm.evaluate(RUN, WORDS)
        G = {}; [G.update(v['genres']) for v in got.values()]

        # ---------- EMPTY ----------
        e = got['empty']
        check(e['profile']['strength'] == 0, 'EMPTY: no signal', e['profile'])
        same = [q for q in WORDS if e['on'][q] == e['off'][q]]
        check(len(same) == len(WORDS), 'EMPTY: every row, in order, the same as the bar without the tilt', [q for q in WORDS if q not in same])
        # ---------- PROFILE ----------
        f, m, x = got['fantasy']['profile'], got['modern']['profile'], got['mixed']['profile']
        check(f['mix'].get('fantasy', 0) > 0.9 and f['strength'] > 0.8, 'PROFILE: the tavern reads fantasy', f)
        check(m['mix'].get('modern', 0) > 0.9 and m['strength'] > 0.8, 'PROFILE: the office tower reads modern', m)
        check(0.2 < x['mix'].get('fantasy', 0) < 0.8 and 0.2 < x['mix'].get('modern', 0) < 0.8 and x['strength'] > 0.8, 'PROFILE: the tavern and the office tower read as a mix', x)
        # ---------- SHIFT ----------
        def count(table, side, want):
            return sum(sum(1 for r in top(got[table][side][q]['rows'], kind) if fam(G.get(f'{kind}:{r}'), want)) for q in WORDS for kind in ('cat', 'fig'))
        cm = {t: count(t, 'on', 'modern') for t in ('fantasy', 'modern', 'mixed')}; cm0 = count('modern', 'off', 'modern')
        cf = {t: count(t, 'on', 'fantasy') for t in ('fantasy', 'modern', 'mixed')}; cf0 = count('fantasy', 'off', 'fantasy')
        check(cm['modern'] > cm0, 'SHIFT: on the modern table more of the top three are modern than without the tilt', f"{cm0} → {cm['modern']}")
        check(cf['fantasy'] > cf0, 'SHIFT: on the fantasy table more of the top three are fantasy than without the tilt', f"{cf0} → {cf['fantasy']}")
        check(cm['fantasy'] <= cm['mixed'] <= cm['modern'] and cf['modern'] <= cf['mixed'] <= cf['fantasy'], 'SHIFT: the mixed table lies between the two', {'modern rows': cm, 'fantasy rows': cf})
        for table, items in CLEAR.items():
            bad = []
            for kind, q in items:
                t0, t1 = top(got[table]['off'][q]['rows'], kind, 1), top(got[table]['on'][q]['rows'], kind, 1)
                if not t0 or not fam(G.get(f'{kind}:{t0[0]}'), OTHER[table]): bad.append(f"{q}: without the tilt already {t0}")
                if not t1 or fam(G.get(f'{kind}:{t1[0]}'), OTHER[table]): bad.append(f"{q}: {t1}")
            check(not bad, f"SHIFT: on the {table} table the first of {', '.join(q for _, q in items)} goes from {OTHER[table]} to {table} (or a thing of both)", bad)
        # ---------- NAMES ----------
        names = await gm.evaluate("""async () => { const W = (ms) => new Promise(r => setTimeout(r, ms));
          const rowsOf = () => [...document.querySelectorAll('#results .res')].map(el => el.dataset.ref || '');
          const go = async (area, q) => { tw.setMain(area); for (let i = 0; i < 100 && !tw.sync.view(area); i++) await W(50); await W(200); tw.emit('bar.open', q); const r = rowsOf(); tw.registry.surfaces.find(s => s.name === 'bar')?.close(); return r; };
          const A = (n) => tw.sync.campaign.areas.find(a => a.name === n).id;
          return { car: await go(A('Tavern'), 'car'), dragon: await go(A('Office'), 'dragon'), crate: await go(A('Office'), 'crate'), strength: tw.genreProfile().strength }; }""")
        check(names['strength'] > 0.8 and names['car'] and (top([{'ref': r} for r in names['car']], 'cat', 1) or [''])[0].startswith('car-'), 'NAMES: "car" on the fantasy table: a car first', names['car'][:3])
        check((top([{'ref': r} for r in names['dragon']], 'fig', 1) or [''])[0].startswith('foe-dragon'), 'NAMES: "dragon" on the modern table: a dragon figure first', [r for r in names['dragon'] if r.startswith('fig:')][:3])
        check((top([{'ref': r} for r in names['crate']], 'cat', 1) or [''])[0] == 'crate', 'NAMES: "crate" on the modern table: the crate first', names['crate'][:3])
        # ---------- KEEP ----------
        bad = []
        for t in ('fantasy', 'modern', 'mixed'):
            for q in WORDS:
                a, b = got[t]['on'][q], got[t]['off'][q]
                other = lambda rows: [(i, r['ref']) for i, r in enumerate(rows) if not r['ref'].startswith(('cat:', 'fig:'))]
                if len(a['rows']) != len(b['rows']) or a['secs'] != b['secs'] or other(a['rows']) != other(b['rows']): bad.append(f'{t}/{q}')
        check(not bad, 'KEEP: as many rows, the same sections in order, every command / world / place / person row where it was', bad[:8])
        # ---------- FAST ----------
        ms = {t: got[t]['ms'] for t in got}
        check(all(v['on'] <= v['off'] * 1.5 + 3 for v in ms.values()), 'FAST: a keystroke with the tilt costs about what it did without (ms per line)', {t: f"{v['off']:.1f} → {v['on']:.1f}" for t, v in ms.items()})
        if A.dump:
            os.makedirs(A.dump, exist_ok=True)
            out = {t: {q: {'off': {'cat': top(got[t]['off'][q]['rows'], 'cat'), 'fig': top(got[t]['off'][q]['rows'], 'fig')}, 'on': {'cat': top(got[t]['on'][q]['rows'], 'cat'), 'fig': top(got[t]['on'][q]['rows'], 'fig')}} for q in WORDS} for t in got}
            json.dump({'profiles': {t: got[t]['profile'] for t in got}, 'genres': G, 'top3': out}, open(os.path.join(A.dump, 'top3.json'), 'w'), indent=1)
            mark = lambda kind, i: f"{i}{'' if G.get(f'{kind}:{i}') is None else ' ·' + G.get(f'{kind}:{i}').replace('cultures:', '')[0:3]}"
            md = ['# The bar leans to the table: top three, without the tilt → with it', '', 'Each cell: the top three things (cat) and figures (fig). The mark after an id is its genre (fan, mod, a culture); none: neutral.', '']
            for t in ('fantasy', 'modern', 'mixed'):
                pr = got[t]['profile']; md += [f"## {t} table — mix {', '.join(f'{k} {v:.2f}' for k, v in pr['mix'].items())}, strength {pr['strength']:.2f}", '', '| word | things, without | things, with | figures, without | figures, with |', '|---|---|---|---|---|']
                for q in WORDS:
                    c = out[t][q]; cell = lambda kind, side: '<br>'.join(mark(kind, i) for i in c[side][kind]) or '—'
                    md.append(f"| {q} | {cell('cat', 'off')} | {cell('cat', 'on')} | {cell('fig', 'off')} | {cell('fig', 'on')} |")
                md.append('')
            open(os.path.join(A.dump, 'top3.md'), 'w').write('\n'.join(md))
            print(f'  (top three, before and after → {A.dump}/top3.md)')
        check(not errors, 'no page errors', errors[:3])
        await browser.close()
    bad = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(bad)}/{len(results)} checks passed")
    sys.exit(1 if bad else 0)

asyncio.run(main())

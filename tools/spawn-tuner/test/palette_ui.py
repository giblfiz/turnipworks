"""The room palette (2026-10-12): grouped by building type, one group open, search, and it never takes height from the stage.

python palette_ui.py BASE_URL OUTDIR [API_ORIGIN]   (BASE_URL a static server on tools/spawn-tuner, or the live tuner;
                                                     API_ORIGIN e.g. http://127.0.0.1:8096 when BASE_URL is a local static server)
Real mouse and keyboard in headless Chromium at an ordinary 1280x800 page. Exit code = number of failures.
"""
import json, os, sys, time, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip('/'); OUT = sys.argv[2]; API = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3].startswith('http') else None
os.makedirs(OUT, exist_ok=True)
results = []


def check(name, cond, evidence=''):
    results.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{evidence}]' if evidence else ''), flush=True)


def get(path): return json.loads(urllib.request.urlopen(urllib.request.Request(f'{BASE}/{path}?t={time.time()}', headers={'User-Agent': 'Mozilla/5.0 tw-test'}), timeout=60).read())


ROOMS = get('data/rooms.json'); TYPES = get('data/types.json')
RECT = "(s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }"
OPEN = "() => tuner.palette().filter(g => g.open && !g.hidden).map(g => g.code)"
VISIBLE = """(k) => { const b = document.querySelector(`#palette button[data-type="${k}"]`), p = document.querySelector('#pgroups').getBoundingClientRect(), r = b.getBoundingClientRect();
  return r.height > 0 && r.top >= p.top - 1 && r.bottom <= p.bottom + 1; }"""


def group_of(t):
    for rc in t['recipes']:
        for bt in TYPES:
            if rc.startswith(bt['code'].lower() + '-'): return bt['code']
    return None


def load(pg, query='', w=1280, h=800):
    pg.set_viewport_size({'width': w, 'height': h})
    pg.goto(f'{BASE}/index.html?nobg&nofx&seed=7{query}'); pg.wait_for_selector('body[data-ready="1"]', timeout=120000)


with sync_playwright() as p:
    br = p.chromium.launch(args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 1280, 'height': 800}); pg = ctx.new_page(); errors = []
    if API: tw_sandbox.proxy(pg, API)
    pg.on('pageerror', lambda e: errors.append(str(e)))

    # ---- the stage keeps its height
    load(pg)
    st, pal, left = pg.evaluate(RECT, '#stage'), pg.evaluate(RECT, '#palette'), pg.evaluate(RECT, '#left')
    check('P1 at 1280x800 the stage fills the window under the title bar', st['h'] >= 740 and st['w'] >= 640, f"stage {st['w']:.0f}x{st['h']:.0f}")
    check('P2 the palette sits inside the left column and leaves the panels below it room', pal['x'] >= left['x'] and pal['x'] + pal['w'] <= left['x'] + left['w'] + 1 and pal['h'] <= 0.6 * left['h'] and pg.evaluate(RECT, '#leftPanels')['h'] >= 120, f"palette {pal['w']:.0f}x{pal['h']:.0f} of a {left['h']:.0f}-px column")
    check('P3 the page itself does not scroll', pg.evaluate("document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth"))

    # ---- groups are the game's building types
    G = pg.evaluate("tuner.palette()")
    want = [t['code'] for t in TYPES if any(group_of(r) == t['code'] for r in ROOMS)]
    labels = {t['code']: t['label'] for t in TYPES}
    check('P4 one group per building type that has rooms, in the Build tray\'s order, under its names', [g['code'] for g in G][:len(want)] == want and all(g['label'] == labels[g['code']] for g in G if g['code'] in labels), ', '.join(f"{g['label']} {len(g['rooms'])}" for g in G))
    flat = [k for g in G for k in g['rooms']]
    check('P5 every room type is in exactly one group, and each is in its own type\'s', sorted(flat) == sorted(r['key'] for r in ROOMS) and all(group_of(r) in (None, g['code']) for g in G for r in ROOMS if r['key'] in g['rooms']), f"{len(flat)} buttons, {len(ROOMS)} room types")
    check('P6 one group is open (the first, in a browser that has not used the tool), the rest shut', pg.evaluate(OPEN) == [G[0]['code']], str(pg.evaluate(OPEN)))
    pg.screenshot(path=f'{OUT}/palette-1280x800.png')

    # ---- opening a group shuts the other; this browser remembers
    second = G[min(2, len(G) - 1)]
    pg.locator(f'#ptabs .pt[data-code="{second["code"]}"]').click(); time.sleep(0.2)
    check('P7 a click on a heading opens that group and shuts the one that was open', pg.evaluate(OPEN) == [second['code']], str(pg.evaluate(OPEN)))
    st2 = pg.evaluate(RECT, '#stage')
    check('P8 the stage is the same height whichever group is open', abs(st2['h'] - st['h']) < 1, f"{st2['h']:.0f}")
    pg.locator(f'#ptabs .pt[data-code="{second["code"]}"]').click(); time.sleep(0.2); shut = pg.evaluate(OPEN); hs = pg.evaluate(RECT, '#stage')['h']
    pg.locator(f'#ptabs .pt[data-code="{second["code"]}"]').focus(); pg.keyboard.press('Enter'); time.sleep(0.2)
    check('P8b a second click folds the group away; Enter on the heading opens it again', shut == [] and abs(hs - st['h']) < 1 and pg.evaluate(OPEN) == [second['code']], f"{shut} then {pg.evaluate(OPEN)}")
    check('P8c the headings are not room-type buttons (every button in the palette is a room type)', pg.evaluate("[...document.querySelectorAll('#palette button')].every(b => b.dataset.type)") and pg.locator('#ptabs .pt').count() == len(G), f"{pg.locator('#palette button').count()} buttons, {pg.locator('#ptabs .pt').count()} headings")
    load(pg)
    check('P9 after a reload the group used last is the open one', pg.evaluate(OPEN) == [second['code']], str(pg.evaluate(OPEN)))

    # ---- click to pick, drag on the grid to lay out
    key = second['rooms'][0]
    pg.locator(f'#palette button[data-type="{key}"]').click()
    check('P10 a click on a room type picks it as the tool', pg.evaluate("tuner.tool()") == key and pg.locator('#palette button.active').get_attribute('data-type') == key and 'Drag on the grid' in pg.inner_text('#hint'), pg.inner_text('#hint')[:60])
    n0 = len(pg.evaluate("tuner.rooms()")); cx, cy = st['x'] + st['w'] / 2, st['y'] + st['h'] / 2
    pg.mouse.move(cx - 80, cy - 40); pg.mouse.down()
    for i in range(1, 11): pg.mouse.move(cx - 80 + 16 * i, cy - 40 + 10 * i)
    pg.mouse.up(); pg.wait_for_function(f"tuner.rooms().length === {n0 + 1} && tuner.rooms().at(-1).n > 0", timeout=120000); pg.wait_for_function('tuner.episodes() === 0', timeout=180000)
    rs = pg.evaluate("tuner.rooms()")
    check('P11 a drag on the grid with that tool lays out a room of that type', rs[-1]['type'] == key and rs[-1]['n'] > 0, f"{rs[-1]['type']} {rs[-1]['w']}x{rs[-1]['d']} cells, {rs[-1]['n']} objects")
    opt = pg.evaluate("(() => { const s = document.querySelector('#roomType'); return { groups: [...s.querySelectorAll('optgroup')].map(o => o.label), n: s.options.length, value: s.value }; })()")
    check('P12 the room panel\'s type list is grouped the same way and names the new room', opt['groups'] == [g['label'] for g in G] and opt['n'] == len(ROOMS) and opt['value'] == key, f"{len(opt['groups'])} groups, {opt['n']} types, {opt['value']}")
    other = second['rooms'][1]; pg.select_option('#roomType', other); pg.wait_for_function(f"tuner.rooms().at(-1).type === '{other}' && tuner.rooms().at(-1).n > 0", timeout=120000); pg.wait_for_function('tuner.episodes() === 0', timeout=180000)
    check('P13 the type list still changes the selected room\'s type', pg.evaluate("tuner.rooms().at(-1).type") == other, other)
    pg.locator(f'#palette button[data-type="{key}"]').click()
    check('P14 a second click on the active type puts the tool down', pg.evaluate("tuner.tool()") is None and pg.locator('#palette button.active').count() == 0)

    # ---- keyboard
    pg.mouse.move(cx, cy); pg.keyboard.press('2')
    check('P15 a number key picks its room type and opens that type\'s group', pg.evaluate("tuner.tool()") == ROOMS[1]['key'] and pg.evaluate(OPEN) == [group_of(ROOMS[1])] and pg.evaluate(VISIBLE, ROOMS[1]['key']), f"{pg.evaluate('tuner.tool()')} in {pg.evaluate(OPEN)}")
    pg.keyboard.press('Escape')
    check('P16 Esc puts the tool down', pg.evaluate("tuner.tool()") is None)
    last = G[-1]['rooms'][-1]; pg.evaluate(f"tuner.setTool('{last}')"); time.sleep(0.2)
    check('P17 a tool chosen from a shut group opens the group and scrolls the button into the palette', pg.evaluate(OPEN) == [G[-1]['code']] and pg.evaluate(VISIBLE, last), last)
    pg.keyboard.press('Escape')

    # ---- search
    pg.keyboard.press('/')
    check('P18 "/" puts the cursor in the search box', pg.evaluate("document.activeElement.id") == 'roomSearch')
    word = 'passage'; hits = [r['key'] for r in ROOMS if all(w in f"{r['label']} {r['key']} {labels.get(group_of(r), '')} {group_of(r)} {' '.join(r['recipes'])}".lower() for w in [word])]
    pg.keyboard.type(word); time.sleep(0.2)
    shown = pg.evaluate("[...document.querySelectorAll('#palette button[data-type]')].filter(b => b.getBoundingClientRect().height > 0).map(b => b.dataset.type)")
    hit_groups = {group_of(r) for r in ROOMS if r['key'] in hits}
    check(f'P19 typing "{word}" shows the matches from every group and nothing else', sorted(shown) == sorted(hits) and len(hit_groups) >= 2 and set(pg.evaluate(OPEN)) == hit_groups, f"{len(shown)} shown in {len(hit_groups)} groups")
    check('P20 typing in the search box does not fire the tool keys', pg.evaluate("tuner.tool()") is None)
    check('P21 the stage keeps its height while searching', abs(pg.evaluate(RECT, '#stage')['h'] - st['h']) < 1)
    pg.keyboard.press('Enter'); time.sleep(0.2)
    check('P22 Enter picks the first match, clears the search and leaves its group open', pg.evaluate("tuner.tool()") == shown[0] and pg.input_value('#roomSearch') == '' and pg.evaluate(OPEN) == [group_of(next(r for r in ROOMS if r['key'] == shown[0]))], shown[0])
    pg.keyboard.press('Escape'); pg.keyboard.press('/'); pg.keyboard.type('zzqx'); time.sleep(0.2)
    check('P23 a search with no match says so', pg.locator('#pnone').is_visible() and pg.evaluate(OPEN) == [])
    before = pg.evaluate("tuner.palette().filter(g => g.open).length")
    pg.keyboard.press('Escape'); time.sleep(0.2)
    check('P24 Esc clears the search and the one group is open again', pg.input_value('#roomSearch') == '' and len(pg.evaluate(OPEN)) == 1 and not pg.locator('#pnone').is_visible() and pg.evaluate("document.activeElement.id") != 'roomSearch', str(pg.evaluate(OPEN)))
    two = 'vault'; pg.fill('#roomSearch', two); time.sleep(0.2); k2 = pg.evaluate("[...document.querySelectorAll('#palette button[data-type]')].find(b => b.getBoundingClientRect().height > 0).dataset.type")
    pg.locator(f'#palette button[data-type="{k2}"]').click()
    check('P25 a click on a search result picks it', pg.evaluate("tuner.tool()") == k2, k2)
    pg.fill('#roomSearch', ''); pg.keyboard.press('Escape')

    # ---- URL parameters
    tgt = next(r for r in ROOMS if group_of(r) == G[-1]['code'])
    load(pg, f"&room={tgt['key']}")
    check('P26 ?room=<key> picks that tool, opens its group and shows the button', pg.evaluate("tuner.tool()") == tgt['key'] and pg.evaluate(OPEN) == [G[-1]['code']] and pg.evaluate(VISIBLE, tgt['key']), tgt['key'])
    mid = G[len(G) // 2]
    load(pg, f"&type={mid['code'].lower()}"); a = pg.evaluate(OPEN)
    load(pg, '&type=' + urllib.request.quote(mid['label'])); b = pg.evaluate(OPEN)
    check('P27 ?type=<code or name> opens that group', a == [mid['code']] and b == [mid['code']], f"{a} {b}")
    load(pg, '&palette=open'); st3 = pg.evaluate(RECT, '#stage')
    check('P28 ?palette=open opens every group, and the stage is still full height', len(pg.evaluate(OPEN)) == len(G) and abs(st3['h'] - st['h']) < 1 and pg.evaluate("(() => { const e = document.querySelector('#paletteFold .pbody'); return e.scrollHeight > e.clientHeight; })()"), f"stage {st3['h']:.0f}, palette scrolls inside itself")
    pg.screenshot(path=f'{OUT}/palette-all-open.png')

    # ---- the headless picture path: a room made through tuner.createRoom, the stage clipped out of an ordinary page
    load(pg, '&flavor=none'); t = ROOMS[0]
    pg.evaluate(f"void tuner.createRoom('{t['key']}', 4, 5, {t['cells'][0]}, {t['cells'][1]})"); pg.wait_for_function('tuner.rooms().length === 1 && tuner.rooms()[0].n > 0 && tuner.episodes() === 0', timeout=180000)
    clip = pg.evaluate(RECT, '#stage'); pg.screenshot(path=f'{OUT}/stage-clip.png', clip={'x': clip['x'], 'y': clip['y'], 'width': clip['w'], 'height': clip['h']})
    import struct
    with open(f'{OUT}/stage-clip.png', 'rb') as f: f.seek(16); iw, ih = struct.unpack('>II', f.read(8))
    check('P29 a stage picture taken on a 1280x800 page is the whole stage, not a strip', iw >= 640 and ih >= 740, f'{iw}x{ih} px')
    for (w, h) in ((1500, 950), (1024, 600)):
        load(pg, '', w, h); s = pg.evaluate(RECT, '#stage')
        check(f'P30 at {w}x{h} the stage is the window less the title bar', abs(s['h'] - (h - 52)) <= 2, f"{s['w']:.0f}x{s['h']:.0f}")

    # ---- a narrow window stacks; the palette stays usable
    load(pg, '', 800, 900); s = pg.evaluate(RECT, '#stage'); pl = pg.evaluate(RECT, '#palette')
    check('P31 a narrow window: the stage keeps most of the screen and the palette is capped below it', s['h'] >= 600 and pl['h'] <= 0.6 * 900 + 2 and pl['y'] >= s['y'] + s['h'] - 1, f"stage {s['h']:.0f}, palette {pl['h']:.0f}")
    check('P32 no page errors', not errors, '; '.join(errors[:3]))
    br.close()

fails = [n for n, ok in results if not ok]
print(f'\n{len(results) - len(fails)}/{len(results)} passed' + (f"; FAILED: {fails}" if fails else ''))
sys.exit(len(fails))

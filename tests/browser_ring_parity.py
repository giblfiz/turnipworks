#!/usr/bin/env python3
"""THE NEW RING'S PARITY WITH THE LEGACY RING (2026-10-20). Harry asked for the ring he shaped in Ring Lab to become the
game ring for every seat; the legacy ring's every action was audited first (tests/data/ring-parity-audit.json, made from
commit 98734365: per selection kind and seat, each action, where it lived, how it was used and what it sends). This
suite walks that audit against the NEW ring on a throwaway local table.

  local:  TW_GPU=1 python3 tests/browser_ring_parity.py [--shots DIR] [--only KIND]

For every selection kind × seat in the audit (the GM; a player "Pia" who owns Bram and Mira, opens doors, lights lamps;
nothing else is hers to touch):
  REACH    every audited action is in the new ring: a main button, behind ☰, or inside a sub-menu (a ▸ group, or a
           list a command opens; a dynamic list — variants, areas — holds at least one item; a static one holds the
           same items as before)
  INVOKE   used the way a person would — a click, a real mouse DRAG for the drag handles (turn, size, raise / lower,
           roll, damage, fog height), a typed value in the damage field, the rename field, the sheet card's fields,
           picking an item in a sub-menu, the command bar it opens — it sends the same command type the audit lists
           (every page's tw.sync.submit / tw.dispatch / tw.batch is recorded); each change is undone after
  NO RING  a selection the audit gives no ring (a thing the player may not touch, a bare wall) shows none
  ALWAYS   no "not wired" / placeholder toast, ever; a sub-menu's sibling buttons never share a picture (their inner
           SVG / IMG / initials markup; a turning preview is its own model: distinct sku and drawn); no button or label
           enters the 3–6 sector (tw.ringWarnings()) shut, open or with a sub-menu open
The table is "TEST ring parity … (throwaway)", deleted at exit (tw_sandbox.remove_campaigns). Viewport 1600 × 1200,
reduced motion (this suite is not about the slide: tests/browser_ring_ellipse.py is). The camera is moved so the ring
it is about to press is on screen and clear of the top bar (the ring is world-sized and may run off screen by design).
"""
import argparse, asyncio, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from collections import defaultdict
from pathlib import Path
from playwright.async_api import async_playwright
HERE = Path(__file__).resolve().parent; ROOT = HERE.parent; ENGINE = ROOT / 'engine'
sys.path.insert(0, str(HERE)); import tw_sandbox  # noqa: E402  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaign this suite makes is a throwaway: deleted from the relay when it exits
AUDIT = json.loads((HERE / 'data' / 'ring-parity-audit.json').read_text())
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--shots'); ap.add_argument('--only', action='append', default=[]); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18981,18982').split(','))
W, H, TOP = 1600, 1200, 72  # the viewport; below TOP is clear of the top bar
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:400] if detail != '' else ''}", flush=True)

def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-parity-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])  # /tmp is RAM: removed at exit
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(ROOT / 'tools' / 'spawn-tuner', os.path.join(site, 'tuner'))
    procs.append(subprocess.Popen(['node', str(ENGINE / 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=open(os.path.join(data, 'relay.log'), 'a'), stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what='', arg=None):
    try: await pg.wait_for_function(js, arg=arg, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False

# Recorded on every page: each command type sent (tw.sync.submit, and what tw.dispatch / tw.batch were asked), and every toast
RECORD = r"""() => { if (window.__rec) return; const rec = window.__rec = { cmds: [], toasts: [] };
  const s = tw.sync, sub = s.submit.bind(s);
  s.submit = (type, args, ...r) => { rec.cmds.push(type); if (type === 'batch') for (const o of args?.ops || []) rec.cmds.push(o.type); return sub(type, args, ...r); };
  const d = tw.dispatch; tw.dispatch = (type, args, ...r) => { rec.cmds.push(type); return d(type, args, ...r); };
  const b = tw.batch; tw.batch = (ops, ...r) => { rec.cmds.push('batch'); for (const o of ops || []) if (o) rec.cmds.push(o.type); return b(ops, ...r); };
  const t = tw.toast; tw.toast = (m, bad) => { rec.toasts.push(String(m)); return t(m, bad); };
  window.__P = {
    // a button's centre, and whether a real mouse there would land on it
    at: (css) => { const b = document.querySelector(css); if (!b || b.closest('[hidden]')) return null; const r = b.getBoundingClientRect(); if (r.width < 2) return null;
      const x = r.left + r.width / 2, y = r.top + r.height / 2, hit = document.elementFromPoint(x, y);
      return { x, y, size: r.width, box: [r.left, r.top, r.right, r.bottom], hit: !!hit && (hit === b || b.contains(hit)), under: hit ? (hit.closest('.rbtn')?.dataset.id || hit.id || hit.className?.baseVal || hit.className || hit.tagName) : null }; },
    // the drawn ring's box (its buttons; the pawn sheet card / damage field / rename field when open)
    box: () => { let u = null; for (const b of document.querySelectorAll('#ring > .rbtn, #ring > .flyout, #ring > .dmg-edit, #ring > .ring-edit')) { const r = b.getBoundingClientRect(); if (r.width < 2) continue;
      u = u ? [Math.min(u[0], r.left), Math.min(u[1], r.top), Math.max(u[2], r.right), Math.max(u[3], r.bottom)] : [r.left, r.top, r.right, r.bottom]; } return u; },
    // move the camera's focus so the table moves (dx, dy) px on screen (the ring follows its piece)
    pan: (dx, dy) => { const g = tw.main.grab, cam = tw.main.camera; cam.updateMatrixWorld(); const m = cam.matrixWorld.elements;
      let rx = m[0], rz = m[2], L = Math.hypot(rx, rz) || 1; rx /= L; rz /= L; let fx = -m[8], fz = -m[10]; L = Math.hypot(fx, fz) || 1; fx /= L; fz /= L;
      const f = g.focus, y = f.y || 0, s0 = tw.screenOf(f.x, f.z, tw.main, y), sR = tw.screenOf(f.x + rx, f.z + rz, tw.main, y), sF = tw.screenOf(f.x + fx, f.z + fz, tw.main, y);
      const a1 = sR.x - s0.x, a2 = sR.y - s0.y, b1 = sF.x - s0.x, b2 = sF.y - s0.y, det = a1 * b2 - a2 * b1; if (Math.abs(det) < 1e-6) return false;
      const a = (dx * b2 - dy * b1) / det, b = (a1 * dy - a2 * dx) / det;
      f.x -= a * rx + b * fx; f.z -= a * rz + b * fz; g.update(); return true; },
    // a sub-menu's sibling pictures: the markup that draws each one (a turning preview: its own model, by id)
    pics: () => [...document.querySelectorAll('#ring > .rbtn[data-nest]')].map(b => { const pv = b.querySelector('.pvw'); if (pv) return { id: b.dataset.id, pic: 'model:' + b.dataset.id, live: pv.classList.contains('live'), failed: pv.classList.contains('failed') };
      const img = b.querySelector('img'), svg = b.querySelector(':scope > svg'), ini = b.querySelector('.ini');
      return { id: b.dataset.id, pic: img ? 'img:' + img.getAttribute('src') : ini ? 'ini:' + ini.textContent : svg ? 'svg:' + svg.innerHTML : 'html:' + b.innerHTML }; }),
  }; }"""
RESET = "(() => { window.__rec.cmds.length = 0; })()"

def expected(typ):
    """the audit's dispatch text -> alternatives, each a list of command types that must all be sent"""
    t = re.sub(r'\(.*?\)', '', typ)
    return [[x.strip() for x in alt.split('+') if x.strip()] for alt in re.split(r'[|/]', t) if alt.strip()]
def matches(typ, sent):
    # "a + b": a is always sent, b as well when it applies (a roll sends object.move only when it changes the yaw: app.rollSelection)
    return any(alt[0] in sent for alt in expected(typ))

async def main():
    page = start_local()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': W, 'height': H}, reduced_motion='reduce')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST ring parity {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")  # the open table (fog has its own suites)
        await wait(gm, "tw.sync.campaign.defaults.fogOfWar === false && tw.sync.pendingCount() === 0", 15000, 'open table')
        MAIN = await gm.evaluate('tw.area()')
        # ---- THE TABLE: what the audit's probe had (the Ring lab fixture), as a throwaway ----
        setup = await gm.evaluate(r"""async () => {
          const sleep = (ms) => new Promise(r => setTimeout(r, ms)), waitFor = async (f, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { if (f()) return true; await sleep(100); } return false; };
          const E = () => Object.values(tw.entities()), by = (n) => E().find(e => e.name === n);
          const room = tw.spawnRoom('common', 2, 2, 6, 5, 82241); await waitFor(() => tw.entities()[room]); tw.rename(tw.entities()[room], 'Parity common room');
          tw.makeBuilding({ code: 'TAV', x: 16, z: 2, w: 12, d: 10, seed: 82242, storeys: 2 }, { name: 'Parity inn' }); await waitFor(() => by('Parity inn'), 30000);
          const lib = tw.lib.objects, rid = () => 'obj_' + Math.random().toString(36).slice(2, 12).padEnd(10, 'x');
          const place = (cat, name, x, z) => { const sz = tw.roomgen.sizeOf(cat); if (!sz) return null; const id = rid(); tw.dispatch('object.place', { id, name, cat, sku: sz.sku, url: sz.url, place: lib[cat].place || 'floor', x, y: lib[cat].place === 'wall' ? 7 : 0, z, s: sz.s, dims: sz.dims, yaw: sz.yaw }); return id; };
          const flav = Object.keys(lib).filter(k => k.startsWith('flavor-') && tw.roomgen.sizeOf(k));
          const ids = { crate: place('crate', 'Parity crate', 30, 80), tilted: place('crate', 'Parity tilted crate', 45, 80), locked: place('crate', 'Parity locked crate', 60, 80),
            lamp: place('candle', 'Parity candle', 75, 80), door: place('door-plank', 'Parity door', 90, 80), chest: place('chest-ironbound', 'Parity chest', 105, 80), flavor: place(flav.includes('flavor-altarpiece') ? 'flavor-altarpiece' : flav[0], 'Parity flavor', 120, 80) };
          const ELSE = tw.createArea('Elsewhere');
          const tok = await tw.createSeat({ kind: 'human', role: 'player', name: 'Pia', color: '#5aa9e6' });
          await sleep(800); tw.sync.submit('area.visibility', { area: ELSE, visibility: 'open' });
          const pia = tw.sync.campaign.seats.find(s => s.name === 'Pia').id;
          const P = (id, name, x, z, extra = {}) => ({ type: 'token.create', args: { id, name, x, z, ...extra } });
          tw.batch([P('tok_bram000001', 'Bram', 30, 110, { owner: pia }), P('tok_cato000001', 'Cato', 45, 110), P('tok_mira000001', 'Mira · raised', 60, 110, { owner: pia, y: 10 }),
            // spares, for the one action that takes pawns away (Send to area): the same kinds, the same owners
            P('tok_sgm1000001', 'Spare G1', 30, 130), P('tok_sgm2000001', 'Spare G2', 45, 130), P('tok_sgm3000001', 'Spare G3', 60, 130),
            P('tok_spl1000001', 'Spare P1', 75, 130, { owner: pia }), P('tok_spl2000001', 'Spare P2', 90, 130, { owner: pia }), P('tok_spl3000001', 'Spare P3', 105, 130, { owner: pia })]);
          await waitFor(() => tw.entities().tok_spl3000001 && Object.values(ids).every(i => !i || tw.entities()[i]) && tw.sync.pendingCount() === 0);
          tw.dispatch('object.set', { id: ids.tilted, quat: [0.7071, 0, 0, 0.7071] });
          tw.flag([ids.locked], { locked: true });
          await waitFor(() => tw.sync.pendingCount() === 0);
          return { ids, tok, pia, ELSE, room, flav: flav.slice(0, 3) };
        }""")
        ids = setup['ids']
        check(all(ids.values()), 'the table: a common room, a two-storey inn, a crate (plain, rolled, locked), a candle, a door, a chest, a faction piece, pawns, a second area, a player', ids)
        await gm.evaluate("(() => { tw.setRoofs(true, 'bar'); tw.cutOff('bar'); })()"); await gm.wait_for_timeout(2500)
        found = await gm.evaluate(r"""(room) => {
          const E = Object.values(tw.entities()), by = (n) => E.find(e => e.name === n), w = tw.worldOf(tw.area());
          const keys = [...(w.shell?.keys?.() || [])], items = keys.map(k => ({ k, it: tw.wallItem('wall:' + k) })).filter(x => x.it);
          const all = (f) => items.filter(f).map(x => 'wall:' + x.k);
          const inn = by('Parity inn'), innRooms = E.filter(e => e.kind === 'room' && e.building === inn.id);
          const roofs = innRooms.map(r => tw.roofItem('roof:' + r.id)?.id).filter(Boolean);
          return { wall: all(x => x.it.kind === 'object' && x.it.edgeKind === 'wall' && /wall/.test(x.it.cat)).slice(0, 40),
            door: keys.filter(k => k.endsWith(':door')).map(k => 'wall:' + k.slice(0, -5)).filter(id => tw.wallItem(id)?.kind === 'object').slice(0, 20),
            window: all(x => x.it.kind === 'object' && /window/.test(x.it.cat || '')).slice(0, 20), post: all(x => x.it.kind === 'object' && x.it.edgeKind === 'post').slice(0, 20),
            bare: all(x => x.it.kind === 'wall').slice(0, 3), stairs: E.filter(tw.ST.isConnector).map(e => e.id), inn: inn.id,
            innGround: innRooms.filter(r => !r.recipe.y).sort((a, b) => (a.recipe.w === a.recipe.d ? 0 : 1) - (b.recipe.w === b.recipe.d ? 0 : 1)).map(r => r.id), roofs, common: room };  // (a square one first: it may turn in place)
        }""", setup['room'])
        check(found['wall'] and found['door'] and found['window'] and found['post'] and found['bare'] and found['stairs'] and found['roofs'] and found['innGround'], 'and its generated pieces: walls, doors, windows, posts, bare wall runs, stairs, roofs', {k: (len(v) if isinstance(v, list) else v) for k, v in found.items()})
        pl = await tab(page.replace('&nointro', '&nointro&nofx') + '#s=' + setup['tok'])
        check(await wait(pl, "window.tw && tw.ready && tw.ready() && tw.entities().tok_spl3000001", 45000, 'player'), 'the player (Pia) is at the table')
        await pl.evaluate("(() => { tw.setRoofs(true, 'bar'); tw.cutOff('bar'); })()")
        for pg in (gm, pl): await pg.evaluate(RECORD)
        await gm.wait_for_timeout(1500)
        B, C, M = 'tok_bram000001', 'tok_cato000001', 'tok_mira000001'
        spare = {'gm': ['tok_sgm1000001', 'tok_sgm2000001', 'tok_sgm3000001'], 'player': ['tok_spl1000001', 'tok_spl2000001', 'tok_spl3000001']}
        gen = {k: list(found[k]) for k in ('wall', 'door', 'window', 'post')}
        # the audit's selection kinds × seats -> what to select (a callable: generated pieces are taken fresh each time)
        SEL = {
            'one pawn': {'gm': [B], 'player: own pawn': [B], "player: someone else's pawn": [C]},
            'several pawns': {'gm': [B, C], 'player: all own': [B, M], "player: own + someone else's": [B, C]},
            'ordinary object (prop)': {'gm': [ids['crate']], 'gm: rolled (tilted)': [ids['tilted']], 'gm: locked': [ids['locked']], 'player: may not touch': [ids['crate']]},
            'several props': {'gm': [ids['crate'], ids['tilted']], 'player: may not touch': [ids['crate'], ids['tilted']]},
            'faction object (flavor-*)': {'gm': [ids['flavor']], 'player: may not touch': [ids['flavor']]},
            'light (lightable prop: candle)': {'gm': [ids['lamp']], 'player: may light': [ids['lamp']]},
            'openable (door)': {'gm': [ids['door']], 'player: may open': [ids['door']]},
            'openable (chest)': {'gm': [ids['chest']], 'player: may open': [ids['chest']]},
            'room': {'gm': [found['common']], 'gm: room of a building': [found['innGround'][0]], 'player: may not touch': [found['common']]},
            'roof': {'gm': [found['roofs'][0]], 'player: may not touch': [found['roofs'][0]]},
            'building': {'gm': [found['inn']], 'player: may not touch': [found['inn']]},
            'generated wall (wall:…)': {'gm': 'wall', 'player: may not touch': 'wall'},
            'generated door (wall:…)': {'gm': 'door', 'player: may open': 'door'},
            'generated window (wall:…)': {'gm': 'window', 'player: may not touch': 'window'},
            'generated post (wall:c…)': {'gm': 'post', 'player: may not touch': 'post'},
            "bare wall (kind 'wall', no piece)": {'gm': [found['bare'][0]], 'player': [found['bare'][0]]},
            'stairs': {'gm': [found['stairs'][0]], 'player: may not touch': [found['stairs'][0]]},
            'mixed: pawn + prop': {'gm': [B, ids['crate']], 'player': [B, ids['crate']]},
            'mixed: pawn + light': {'gm': [B, ids['lamp']], 'player': [B, ids['lamp']]},
            'mixed: openable + prop': {'gm': [ids['door'], ids['crate']], 'player': [ids['door'], ids['crate']]},
            'mixed: openable + light': {'gm': [ids['door'], ids['lamp']], 'player': [ids['door'], ids['lamp']]},
            'mixed: room + building': {'gm': [found['common'], found['inn']], 'player': [found['common'], found['inn']]},
        }
        async def ids_for(pg, spec):
            if isinstance(spec, list): return spec
            for cand in gen[spec]:  # a generated piece of this kind that is still generated (not made a thing of its own)
                if await pg.evaluate("(id) => { const it = tw.wallItem(id); return !!it && it.kind === 'object'; }", cand): return [cand]
            return [gen[spec][0]]

        # ---------- moving about ----------
        async def reset(pg):
            for _ in range(3): await pg.keyboard.press('Escape')
            await pg.evaluate("(() => { tw.ringOpen?.('closed'); tw.select([]); })()"); await pg.wait_for_timeout(80)
        async def select(pg, sel):
            await reset(pg)
            await pg.evaluate("""(ids) => { const E = tw.entities(), g = tw.main.grab; let xs = [], zs = [], y = 0;
              for (const id of ids) { const e = E[id] || (id.startsWith('wall:') ? tw.wallItem(id) : id.startsWith('roof:') ? tw.roofItem(id) : null) || {}; let x = e.x, z = e.z;
                if (e.kind === 'roof') { const r = E[e.room].recipe; x = (r.x + r.w / 2) * 5; z = (r.z + r.d / 2) * 5; y = (r.y || 0) + 10; }
                else if (e.kind === 'room') { const r = e.recipe; x = (r.x + r.w / 2) * 5; z = (r.z + r.d / 2) * 5; }
                else if (e.kind === 'building') { const rs = Object.values(E).filter(q => q.kind === 'room' && q.building === e.id).map(q => q.recipe); x = (Math.min(...rs.map(r => r.x)) + Math.max(...rs.map(r => r.x + r.w))) * 2.5; z = (Math.min(...rs.map(r => r.z)) + Math.max(...rs.map(r => r.z + r.d))) * 2.5; }
                if (Number.isFinite(x)) { xs.push(x); zs.push(z); } }
              const ax = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length), az = zs.reduce((a, b) => a + b, 0) / Math.max(1, zs.length);
              g.focus.set(ax, y, az); g.yaw = -20; g.pitch = 52; g.dist = 130; g.update(); tw.main.rule = 'free'; tw.select(ids); }""", sel)
            await pg.wait_for_timeout(450)
        async def fit(pg, css=None):
            """pan until the drawn ring is on screen below the top bar (or at least the button about to be pressed is)"""
            for _ in range(6):
                await pg.wait_for_timeout(160)
                u = await pg.evaluate('__P.box()')
                if not u: return
                tgt = await pg.evaluate('(c) => __P.at(c)', css) if css else None
                if u[2] - u[0] > W - 20 or u[3] - u[1] > H - TOP - 10:  # bigger than the screen: centre the button
                    if not tgt: return
                    u = tgt['box']
                dx = (10 - u[0] + 6) if u[0] < 10 else ((W - 10) - u[2] - 6) if u[2] > W - 10 else 0
                dy = (TOP - u[1] + 6) if u[1] < TOP else ((H - 10) - u[3] - 6) if u[3] > H - 10 else 0
                if not dx and not dy: return
                await pg.evaluate(f'__P.pan({dx}, {dy})')
        async def button(pg, css):
            await fit(pg, css); b = await pg.evaluate('(c) => __P.at(c)', css)
            if b and not b['hit']: await pg.wait_for_timeout(300); b = await pg.evaluate('(c) => __P.at(c)', css)
            return b
        async def sent(pg, ms=500):
            await pg.wait_for_timeout(ms); await wait(pg, 'tw.sync.pendingCount() === 0', 8000, 'sent')
            return await pg.evaluate('[...window.__rec.cmds]')
        async def undo(pg, cmds):
            if not cmds or set(cmds) <= {'travel', 'cast.save'}: return
            await pg.evaluate('tw.undo()'); await pg.wait_for_timeout(300); await wait(pg, 'tw.sync.pendingCount() === 0', 8000, 'undo')
        async def drag(pg, b, kind):
            """a real mouse drag on the handle: out along its ray (size, damage, fog), round the centre (turn, roll), up (raise)"""
            c = await pg.evaluate('tw.ringCenter()') or [b['x'], b['y'] + 100]
            ux, uy = b['x'] - c[0], b['y'] - c[1]; L = (ux * ux + uy * uy) ** 0.5 or 1; ux, uy = ux / L, uy / L
            vec = {'size': (ux * 40, uy * 40), 'damage': (ux * 30, uy * 30), 'fog': (ux * 50, uy * 50), 'lift': (0, -90), 'rotate': (-uy * 60, ux * 60), 'tilt': (-uy * 70, ux * 70)}[kind]
            await pg.mouse.move(b['x'], b['y']); await pg.mouse.down(); await pg.wait_for_timeout(90)
            for i in range(1, 11): await pg.mouse.move(b['x'] + vec[0] * i / 10, b['y'] + vec[1] * i / 10); await pg.wait_for_timeout(25)
            await pg.wait_for_timeout(90); await pg.mouse.up()
            return await pg.evaluate('tw.ringDragLast')

        sector_bad = []; pic_bad = []; table = defaultdict(lambda: [0, 0, 0])  # (kind, role) -> [actions, reached, invoked]
        async def sector(pg, label):
            await pg.wait_for_timeout(120); w = await pg.evaluate('tw.ringWarnings()')
            if '3–6 sector' in w: sector_bad.append(label)
        async def sub_menu(pg, label):
            """an open sub-menu: its items, their pictures (distinct), the sector"""
            f = await pg.evaluate('tw.ringFlyout()')
            if not f or not f.get('nest'): return None
            await sector(pg, label + ' (sub-menu)')
            pics = await pg.evaluate('__P.pics()')
            if any(x['pic'].startswith('model:') for x in pics): await pg.wait_for_timeout(1500); pics = await pg.evaluate('__P.pics()')
            keys = [x['pic'] for x in pics]
            if len(set(keys)) != len(keys) or any(x.get('failed') or (x['pic'].startswith('model:') and not x.get('live')) for x in pics):
                pic_bad.append((label, [x['id'] for x in pics if keys.count(x['pic']) > 1 or x.get('failed') or (x['pic'].startswith('model:') and not x.get('live'))]))
            return f
        async def open_menu(pg):
            if await pg.evaluate("tw.ringState() === 'closed'"):
                mb = await button(pg, '#ring > .rbtn[data-menu]')
                if mb and mb['hit']: await pg.mouse.click(mb['x'], mb['y']); await pg.wait_for_timeout(200)
            return await pg.evaluate("tw.ringState() === 'expanded'")
        async def find(pg, sel, aid):
            """where the action is in the new ring: 'main', '☰' (or None); the ring is left in that state"""
            await select(pg, sel)
            css = f'#ring > .rbtn[data-id="{aid}"]:not([data-nest])'
            if await pg.evaluate("(c) => !!document.querySelector(c)", css): return 'main', css
            if await pg.evaluate("!!document.querySelector('#ring > .rbtn[data-menu]')") and await open_menu(pg):
                if await pg.evaluate("(c) => !!document.querySelector(c)", css): return '☰', css
            return None, css

        async def invoke(pg, sel, act, label, gm_seat):
            """use the action as a person would; -> (ok, detail)"""
            aid, typ = act['id'], act['dispatch']['type']
            where, css = await find(pg, sel, aid)
            if not where: return False, False, f'not in the new ring (audit: {act["where"]})'
            await sector(pg, label + (' (shut)' if where == 'main' else ' (open)'))
            b = await button(pg, css)
            if not b or not b['hit']: return True, False, f'in the ring ({where}) but not pressable: {b}'
            info = await pg.evaluate("(c) => { const el = document.querySelector(c), R = tw.registry, cmd = R.get(el.dataset.cmd || ''); return { drag: el.classList.contains('drag') ? (cmd?.ring?.drag || (el.dataset.group === 'fog' ? 'fog' : null)) : null, group: el.dataset.group || null, tip: el.dataset.tip || '' }; }", css)
            await pg.evaluate(RESET)
            notes = [f'{where}']
            # ---- a drag handle ----
            if info['drag']:
                last = await drag(pg, b, info['drag']); cmds = await sent(pg)
                ok = matches(typ, cmds) and last and last.get('committed')
                await undo(pg, cmds)
                if aid == 'pawn.damage' and ok:  # and its click: the typed field
                    await select(pg, sel); b2 = await button(pg, css); await pg.evaluate(RESET)
                    await pg.mouse.click(b2['x'], b2['y']); okf = await wait(pg, '!!tw.ringDamageEdit()', 3000, 'damage field')
                    await pg.keyboard.type('3', delay=20); await pg.keyboard.press('Enter'); cmds2 = await sent(pg)
                    ok = okf and matches(typ, cmds2); notes.append(f'typed 3 -> {cmds2}'); await undo(pg, cmds2)
                return True, ok, f'{"; ".join(notes)}; drag {info["drag"]} -> {cmds} committed={last and last.get("committed")}'
            # ---- a ▸ group, or a command that opens a list on the grown ring ----
            if aid.endswith('.') or aid in ('thing.replace', 'faction.set', 'pawn.travel'):
                await pg.mouse.click(b['x'], b['y']); await pg.wait_for_timeout(350)
                f = await sub_menu(pg, label)
                if not f: return False, False, f'{where}: pressing it opened no sub-menu ({await pg.evaluate("tw.ringState()")})'
                tiles = f['tiles']; want = [x for x in (act.get('opens') or []) if not x.startswith('dynamic:')]
                if aid == 'faction.set': want = ['inherit' if x.startswith('inherit') else x for x in want]
                if aid == 'faction.set' and 'building' in label: want = [x for x in want if x != 'inherit']
                missing = [x for x in want if x not in tiles]
                if aid.endswith('.') and not want: missing = []
                if missing or not tiles: return False, False, f'{where} ▸ sub-menu {tiles}: missing {missing}'
                items = await pg.evaluate("[...document.querySelectorAll('#ring > .rbtn[data-nest]')].filter(b => !b.classList.contains('disabled') && b.getAttribute('aria-pressed') !== 'true' && !b.classList.contains('locked')).map(b => b.dataset.id)")
                if aid == 'pawn.travel': items = [i for i in items if i.startswith('travel:area')]
                if not items: return False, False, f'{where} ▸ {tiles}: nothing to pick'
                pick = items[0]
                ib = await button(pg, f'#ring > .rbtn[data-nest][data-id="{pick}"]')
                if not ib or not ib['hit']: return False, False, f'{where} ▸ {pick} not pressable: {ib}'
                await pg.evaluate(RESET); await pg.mouse.click(ib['x'], ib['y'])
                cmds = await sent(pg, 900 if aid == 'pawn.travel' else 500)
                closed = await pg.evaluate("!tw.ringState() || tw.ringState() === 'closed'")
                ok = matches(typ, cmds) and closed
                if aid == 'pawn.travel': await pg.evaluate(f"tw.setMain('{MAIN}')"); await wait(pg, f"tw.area() === '{MAIN}'", 8000, 'back to the main area'); await pg.wait_for_timeout(500)
                else: await undo(pg, cmds)
                return True, ok, f'{where} ▸ {len(tiles)} items, picked {pick} -> {cmds}{"" if closed else " (ring still open)"}'
            # ---- the sheet card ----
            if aid == 'pawn.sheet':
                await pg.mouse.click(b['x'], b['y']); await pg.wait_for_timeout(400)
                f = await pg.evaluate('tw.ringFlyout()'); sh = f and f.get('sheet')
                if not sh: return True, False, f'{where}: no card'
                may = await pg.evaluate("(id) => tw.gm() || tw.canTouch(tw.entities()[id])", sel[0])
                if not may: return True, (not sh['editable'] and sh['name'] is None and sh['owner'] is None), f'{where}: the card, read-only for this seat (as before: it may not write) {sh}'
                got = {}
                await pg.evaluate(RESET); await pg.fill('.flyout.sheet .sh-name', 'Parity name'); await pg.keyboard.press('Enter'); got['name'] = await sent(pg)
                await pg.evaluate(RESET); await pg.fill('.flyout.sheet .sh-url', 'sheets.example.com/parity'); await pg.keyboard.press('Enter'); got['link'] = await sent(pg)
                await pg.evaluate(RESET); await pg.fill('.flyout.sheet .sh-notes', 'parity notes'); await pg.locator('.flyout.sheet .sh-notes').dispatch_event('change'); got['notes'] = await sent(pg)
                if gm_seat:
                    await pg.click('.flyout.sheet .sh-tabs [data-tab=gm]'); await pg.wait_for_timeout(150)
                    await pg.evaluate(RESET); await pg.fill('.flyout.sheet .sh-notes', 'parity gm notes'); await pg.locator('.flyout.sheet .sh-notes').dispatch_event('change'); got['gmNotes'] = await sent(pg)
                    pia = setup['pia']; cur = await pg.evaluate("(id) => tw.entities()[id].owner || ''", sel[0])
                    await pg.evaluate(RESET); await pg.select_option('.flyout.sheet .sh-owner', '' if cur else pia); got['owner'] = await sent(pg)
                ok = all('token.set' in v for k, v in got.items() if k != 'owner') and ('owner' not in got or 'token.owner' in got['owner'])
                await reset(pg)
                for k in reversed(list(got)): await undo(pg, got[k])
                return True, ok, f'{where}: card fields -> {got}'
            # ---- rename: the field over the ring ----
            if aid == 'thing.rename':
                await pg.mouse.click(b['x'], b['y']); okf = await wait(pg, "!!document.querySelector('#ring .ring-edit')", 3000, 'rename field')
                await pg.evaluate(RESET); await pg.keyboard.press('Control+a'); await pg.keyboard.type('Parity renamed', delay=10); await pg.keyboard.press('Enter'); cmds = await sent(pg)
                await undo(pg, cmds)
                return True, okf and matches(typ, cmds), f'{where}: field -> {cmds}'
            # ---- a plain click (Save as group opens the command bar: name it, Enter) ----
            await pg.mouse.click(b['x'], b['y'])
            if aid == 'cast.saveGroup':
                await pg.wait_for_timeout(400); await pg.keyboard.type('parity patrol', delay=10); await pg.keyboard.press('Enter')
            cmds = await sent(pg)
            await undo(pg, cmds)
            if not matches(typ, cmds):  # the same command refusing visibly (a room of a building that would overlap its neighbour if turned: core rules, not the ring)
                ref = await pg.evaluate("(a) => { const r = tw.lastRefusal; return r && r.what === a && Date.now() - r.at < 4000 ? r : null; }", aid)
                if ref: return True, True, f'{where}: click -> the command ran and refused visibly, as it does on any ring ({ref}; toast {(await pg.evaluate("window.__rec.toasts.slice(-1)"))})'
            return True, matches(typ, cmds), f'{where}: click -> {cmds}'

        # ================= THE WALK =================
        travel_left = {k: list(v) for k, v in spare.items()}
        for kind, roles in AUDIT.items():
            if kind.startswith('_') or kind not in SEL or (A.only and not any(o in kind for o in A.only)): continue
            print(f'\n{kind.upper()}')
            for role, acts in roles.items():
                if not isinstance(acts, list): continue
                pg = gm if role.startswith('gm') else pl
                spec = SEL[kind].get(role)
                if spec is None: check(False, f'{kind} / {role}: no selection for it in this suite'); continue
                label = f'{kind} / {role}'
                sel = await ids_for(pg, spec)
                await select(pg, sel)
                shown = await pg.evaluate("!!tw.ringState() && !document.getElementById('ring').hidden && !!document.querySelector('#ring > .rbtn')")
                if not acts:
                    check(not shown, f'{label}: no ring (as before)', await pg.evaluate("[...document.querySelectorAll('#ring > .rbtn')].map(b => b.dataset.id)"))
                    continue
                check(shown, f'{label}: a ring', sel)
                await fit(pg); await sector(pg, label + ' (shut)')
                if await pg.evaluate("!!document.querySelector('#ring > .rbtn[data-menu]')"):
                    await open_menu(pg); await fit(pg); await sector(pg, label + ' (open)')
                for act in acts:
                    s = sel
                    if act['id'] == 'pawn.travel':  # the pawns that go are spares of the same kind and owner
                        side = 'gm' if role.startswith('gm') else 'player'
                        n = len(sel); s = travel_left[side][:n]; travel_left[side] = travel_left[side][n:]
                        if role == "player: own + someone else's": s = sel
                    if any(x.startswith('wall:') for x in s) and isinstance(spec, str): s = await ids_for(pg, spec)
                    reached, ok, detail = await invoke(pg, s, act, label, role.startswith('gm'))
                    t = table[(kind, role)]; t[0] += 1; t[1] += bool(reached); t[2] += bool(ok)
                    check(reached and ok, f'{label}: {act["id"]} ({act["dispatch"]["type"]})', detail)
                await reset(pg)

        # ================= ALWAYS =================
        print('\nALWAYS')
        toasts = {n: await pg.evaluate('window.__rec.toasts') for n, pg in (('GM', gm), ('player', pl))}
        bad = {n: [t for t in v if re.search(r'not wired|placeholder|not (yet )?implemented|coming soon|\btodo\b', t, re.I)] for n, v in toasts.items()}
        check(not any(bad.values()), 'no "not wired" / placeholder toast on either seat, in the whole walk', bad)
        check(not pic_bad, "every sub-menu's sibling buttons have pictures of their own (no two share one; turning previews drew)", pic_bad)
        check(not sector_bad, 'no button or label entered the 3–6 sector, shut, open or with a sub-menu open', sector_bad)
        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        print('\nTABLE (kind × seat: actions reached / invoked / audited)')
        for (k, r), (n, rc, iv) in table.items(): print(f'  {k} / {r}: {rc}/{n} reached, {iv}/{n} invoked')
        if A.shots:
            os.makedirs(A.shots, exist_ok=True); (Path(A.shots) / 'parity-table.json').write_text(json.dumps({f'{k} / {r}': v for (k, r), v in table.items()}, indent=1))
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for pr in procs:
        try: pr.wait(timeout=5)
        except Exception: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\nring parity: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)

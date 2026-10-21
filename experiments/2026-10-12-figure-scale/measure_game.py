#!/usr/bin/env python3
"""Figure scale (Harry 2026-10-12: "the minis are mostly too big"): measure, IN THE GAME, in world feet, what is drawn.

  TW_GPU=1 python3 experiments/2026-10-12-figure-scale/measure_game.py [--scale K] [--shots DIR] [--tag before]

A throwaway campaign on a local relay: an inn common room and a guest room, a hero, a guard and a townsperson stood by
a chair, a table, a door and a bed. Every number is taken from the vertices as drawn (world matrices applied):
  figure   feet to top of head, widest slice under the neck, the disc
  chair    overall, and the SEAT: the height holding the most upward-facing area between 25 % and 75 % of its height
  table    the top: the highest height holding a large upward-facing area;  bed: the same for the mattress, and its length
  door     the leaf's height and width
--scale K sets the figure-scale dial for this run (never the house look: tests/tw_sandbox.py).
"""
import argparse, asyncio, json, os, sys, time, random
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
sys.argv_keep = sys.argv[:]; argv = sys.argv[1:]; sys.argv = [sys.argv[0], '--local']
sys.path.insert(0, os.path.join(REPO, 'engine', 'test'))
ap = argparse.ArgumentParser(); ap.add_argument('--scale', type=float); ap.add_argument('--shots'); ap.add_argument('--tag', default='now'); ap.add_argument('--json')
B = ap.parse_args(argv)
import types
_p = os.path.join(REPO, 'engine', 'test', 'browser_figs.py')  # the figure suite's local stack and helpers (its own main() is not run)
F = types.SimpleNamespace(); _ns = {'__file__': _p, '__name__': 'figs_helpers'}; exec(compile(open(_p).read().split('\nasync def main():')[0], _p, 'exec'), _ns); F.__dict__.update(_ns)
from playwright.async_api import async_playwright

SURF = """(ids) => { const w = tw.worldOf(tw.area()), out = {};
  for (const id of ids) { const r = w.recs.get(id); if (!r) continue; const g = r.group; g.updateMatrixWorld(true);
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; const T = [];
    g.traverse(o => { if (!o.isMesh || o.isInstancedMesh || o.userData.fx || !o.geometry?.attributes?.position) return; let v = o; while (v) { if (v.visible === false) return; v = v.parent; }
      const p = o.geometry.attributes.position, ix = o.geometry.index, n = ix ? ix.count : p.count, e = o.matrixWorld.elements, P = [];
      for (let i = 0; i < n; i++) { const j = ix ? ix.getX(i) : i, x = p.getX(j), y = p.getY(j), z = p.getZ(j); const q = [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; P.push(q); for (let k = 0; k < 3; k++) { if (q[k] < lo[k]) lo[k] = q[k]; if (q[k] > hi[k]) hi[k] = q[k]; } }
      for (let i = 0; i + 2 < P.length; i += 3) { const a = P[i], b = P[i + 1], c = P[i + 2], ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, L = Math.hypot(nx, ny, nz); if (L > 0 && Math.abs(ny) / L > 0.9) T.push([(a[1] + b[1] + c[1]) / 3, L / 2, a, b, c]); } });
    const H = hi[1] - lo[1], N = 60, hist = new Array(N).fill(0); for (const t of T) hist[Math.min(N - 1, Math.max(0, Math.floor((t[0] - lo[1]) / H * N)))] += t[1];
    const band = (i) => { let a = [1e9, 1e9], b = [-1e9, -1e9]; for (const t of T) { const k = Math.floor((t[0] - lo[1]) / H * N); if (Math.abs(k - i) > 1) continue; for (const q of [t[2], t[3], t[4]]) { a[0] = Math.min(a[0], q[0]); a[1] = Math.min(a[1], q[2]); b[0] = Math.max(b[0], q[0]); b[1] = Math.max(b[1], q[2]); } } return { y: +(lo[1] + (i + 0.5) / N * H).toFixed(2), w: +(b[0] - a[0]).toFixed(2), d: +(b[1] - a[1]).toFixed(2) }; };
    let seat = 15; for (let i = 15; i < 45; i++) if (hist[i] > hist[seat]) seat = i;
    let big = 0; for (let i = 18; i < N; i++) big = Math.max(big, hist[i]); let top = 18; for (let i = 18; i < N; i++) if (hist[i] >= 0.4 * big) top = i;
    out[id] = { role: r.entity.role || r.entity.asset || r.entity.sku, sku: r.entity.sku, floor: +lo[1].toFixed(2), size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]].map(v => +v.toFixed(2)), seat: band(seat), top: band(top) }; }
  return out; }"""
# a figure as drawn: feet to head, and the widest side-to-side slice of the body between 55 % and 80 % of its height
FIGW = """(id) => { const w = tw.worldOf(tw.area()), r = w.recs.get(id), m = w.figureOf(id); if (!m || !r.visual.userData.body) return m; const body = r.visual.userData.body; body.updateMatrixWorld(true);
  const P = []; body.traverse(o => { if (!o.isMesh) return; const p = o.geometry.attributes.position, e = o.matrixWorld.elements; for (let j = 0; j < p.count; j++) { const x = p.getX(j), y = p.getY(j), z = p.getZ(j); P.push([e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]); } });
  let lo = 1e9, hi = -1e9; for (const q of P) { lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); } const H = hi - lo, sl = (a, b) => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const q of P) { const t = (q[1] - lo) / H; if (t < a || t > b) continue; x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]); } return [+(x1 - x0).toFixed(2), +(z1 - z0).toFixed(2)]; };
  return { ...m, feet_y: +lo.toFixed(3), head_y: +hi.toFixed(3), hips: sl(0.45, 0.55), chest: sl(0.62, 0.78), head: sl(0.9, 1.0) }; }"""

async def main():
    page = F.start_local()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *F.GL])
        ctx = await browser.new_context(viewport={'width': 1600, 'height': 1000}); gm = await ctx.new_page()
        errs = []; gm.on('pageerror', lambda e: errs.append(str(e)))
        await gm.goto(page); await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST figscale {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button'); assert await F.wait(gm, 'window.tw && tw.ready && tw.ready()', 45000)
        if B.scale is not None: await gm.evaluate(f"tw.figures.setScale({B.scale})")
        R = {}
        for (name, a) in (('common', dict(type='common', x=0, z=0, w=8, d=6, seed=6101)), ('guest', dict(type='guest', x=9, z=0, w=4, d=4, seed=6103))):
            rid = f"room_fs{name}{random.randrange(10**6):06d}"[:24]; R[name] = await gm.evaluate(F.SPAWN, {'id': rid, **a})
            await F.wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, name)
        await F.settle(gm)
        ents = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'object').map(e => ({ id: e.id, role: e.role, asset: e.asset, sku: e.sku, x: e.x, z: e.z, y: e.y, room: e.room, keys: Object.keys(e).join(',') }))")
        if os.environ.get('FS_DEBUG'): print(json.dumps(ents[:3], indent=1)); print(sorted({(e.get('role') or e.get('asset') or '?') for e in ents}))
        nameof = lambda e: (e.get('role') or e.get('asset') or e.get('sku') or '')
        pick = lambda pre: [e for e in ents if nameof(e).startswith(pre)]
        want = [e for pre in ('chair', 'table', 'bed', 'bench', 'stool', 'bar-counter', 'door') for e in pick(pre)]
        S = await gm.evaluate(SURF, [e['id'] for e in want])
        # the three, beside the first chair, table and bed
        figs = ['hero-fighter-human-m', 'town-human-guard', 'town-human-commoner-f']
        spots = []
        for pre in ('chair', 'table-', 'bed'):
            es = pick(pre)
            if es: spots.append((pre, es[0]))
        toks = []
        for i, (pre, e) in enumerate(spots):
            for j, fg in enumerate(figs if pre == 'chair' else figs[:1]):
                tid = f"tok_fs{i}{j}{random.randrange(10**6):06d}"; toks.append((tid, fg, pre))
                await gm.evaluate(f"tw.dispatch('token.create', {{ id: '{tid}', name: '{fg.split('-')[1].title()}', x: {e['x'] + 2.6 * (j + 1) * (1 if j != 1 else -1) if j < 2 else e['x']}, z: {e['z'] + (2.8 if j == 2 else 0)}, fig: '{fg}' }})")
        await gm.wait_for_timeout(600)
        for tid, _, _ in toks: await F.wait(gm, f"tw.worldOf(tw.area()).figureOf('{tid}')?.loaded", 30000, tid)
        Fg = {fg + '@' + pre: await gm.evaluate(FIGW, tid) for tid, fg, pre in toks}
        out = {'scale': await gm.evaluate("tw.figures.scale?.() ?? 1"), 'furniture': S, 'figures': Fg, 'errors': errs}
        def med(v): v = sorted(v); return v[len(v) // 2] if v else None
        print(f"figure scale {out['scale']}")
        for k, m in Fg.items(): print(f"  {k:36s} drawn {m['height_ft']} ft (stated {m['stated_ft']}), feet at y {m['feet_y']}, head top y {m['head_y']}, hips {m['hips']}, chest {m['chest']}, head {m['head']}, disc {m['base_width_ft']} x {m['disc_top_ft']}")
        for pre, key in (('chair', 'seat'), ('bench', 'top'), ('stool', 'top'), ('table', 'top'), ('bar-counter', 'top'), ('bed', 'seat'), ('door', 'top')):
            rows = [v for v in S.values() if (v['role'] or '').startswith(pre)]
            for v in rows[:6]: print(f"  {v['role']:34s} {str(v['sku'])[:34]:34s} size {v['size']}  {key} y {round(v[key]['y'] - v['floor'], 2)} ({v[key]['w']} x {v[key]['d']})")
            if rows: print(f"  == {pre}: n {len(rows)}, median height {med([v['size'][1] for v in rows])}, median {key} height {med([round(v[key]['y'] - v['floor'], 2) for v in rows])}")
        if B.json: json.dump(out, open(B.json, 'w'), indent=1)
        if B.shots:
            os.makedirs(B.shots, exist_ok=True)
            await gm.evaluate("document.documentElement.classList.add('shots')")
            for pre, e in spots:
                await gm.evaluate(f"tw.cutToRoom?.(tw.entities()['{e['room']}'], 'test')"); await gm.wait_for_timeout(500)
                await F.view(gm, e['x'], e['z'], 80, 58, 0); await gm.wait_for_timeout(900); await gm.screenshot(path=os.path.join(B.shots, f"{B.tag}-table-{pre.strip('-')}.jpg"), type='jpeg', quality=88)
                await F.view(gm, e['x'], e['z'], 17, 16, 25); await gm.wait_for_timeout(900); await gm.screenshot(path=os.path.join(B.shots, f"{B.tag}-close-{pre.strip('-')}.jpg"), type='jpeg', quality=88)
        print('errors:', errs[:3])
        await browser.close()
asyncio.run(main())

#!/usr/bin/env python3
"""CLASH (2026-11-06): spawn one room in a real game page, then for each named thing find every OTHER mesh in the scene
(walls included, instanced or merged) with vertices inside the thing's drawn box, and how deep they reach into it. Also
the wall surface the thing faces, by ray casts from the thing's box toward its nearest wall.
  python3 experiments/2026-11-06-room-dressing/clash.py type:w:d:seed cat[,cat] [--json out]
Ports: TW_PORTS (default 23405,23406)."""
import argparse, asyncio, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('TW_PORTS', '23405,23406')
import measure  # noqa: E402  (its start_local / procs; its main() is not run on import)
from playwright.async_api import async_playwright

CLASH = """async ([rid, cats]) => { const THREE = await import('three'); const w = tw.worldOf(tw.area()), scene = w.scene, out = [];
  const v3 = new THREE.Vector3(), m4 = new THREE.Matrix4(), mi = new THREE.Matrix4();
  const ownerOf = (o) => { for (let p = o; p; p = p.parent) { if (p.userData?.shellKey || p.userData?.kitSku) return 'shell'; } return null; };
  for (const r of w.recs.values()) { const e = r.entity; if (e.kind !== 'object' || e.room !== rid || !cats.includes(e.cat) || !r.visual) continue;
    r.visual.updateWorldMatrix(true, true); const B = new THREE.Box3().setFromObject(r.visual, true), mine = new Set(); r.visual.traverse(o => mine.add(o));
    const hits = [];
    scene.traverse(o => { if (!o.isMesh || mine.has(o) || !o.visible || !o.geometry?.attributes?.position) return; let vis = true; for (let p = o; p; p = p.parent) if (p.visible === false) { vis = false; break; } if (!vis) return;
      o.updateWorldMatrix(true, false); const pos = o.geometry.attributes.position, n = o.isInstancedMesh ? o.count : 1; let k = 0, deep = 0, ex = null;
      for (let i = 0; i < n; i++) { if (o.isInstancedMesh) { o.getMatrixAt(i, mi); m4.multiplyMatrices(o.matrixWorld, mi); } else m4.copy(o.matrixWorld);
        for (let j = 0; j < pos.count; j++) { v3.fromBufferAttribute(pos, j).applyMatrix4(m4); if (B.containsPoint(v3)) { k++; const d = Math.min(v3.x - B.min.x, B.max.x - v3.x, v3.z - B.min.z, B.max.z - v3.z); if (d > deep) { deep = d; ex = v3.toArray().map(x => +x.toFixed(2)); } } } }
      if (k) { let tag = o.name || o.type; for (let p = o.parent; p && p !== scene; p = p.parent) if (p.name) { tag = p.name + '/' + tag; break; } hits.push({ mesh: tag.slice(0, 60), uuid: o.uuid.slice(0, 8), instanced: !!o.isInstancedMesh, inside: k, deepest: +deep.toFixed(3), at: ex, layer: o.userData?.layer || o.parent?.userData?.layer || null }); } });
    out.push({ cat: e.cat, x: e.x, z: e.z, rot: e.rot, box: [B.min.toArray().map(x => +x.toFixed(2)), B.max.toArray().map(x => +x.toFixed(2))], hits: hits.sort((a, b) => b.deepest - a.deepest).slice(0, 12) }); }
  return out; }"""

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('room'); ap.add_argument('cats'); ap.add_argument('--json'); A = ap.parse_args()
    page = measure.start_local(); res = None
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch(headless=True, args=['--no-sandbox', *measure.GL])
            pg = await (await br.new_context(viewport={'width': 1600, 'height': 900})).new_page()
            await measure.tw_sandbox.aproxy(pg, 'http://127.0.0.1:8096')
            await pg.goto(page, timeout=180000, wait_until='domcontentloaded')
            await pg.fill('#newCampaign input[name=gm]', 'Harry')
            nm = await pg.query_selector('#newCampaign input[name=name]')
            if nm: await nm.fill(f"TEST clash {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
            await pg.click('#newCampaign button'); await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
            t, w, d, s = A.room.split(':')
            rid = await pg.evaluate(f"tw.spawnRoom('{t}', 0, 0, {w}, {d}, {s})")
            await pg.wait_for_function("tw.sync.pendingCount() === 0", timeout=30000)
            await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({int(w) * 2.5}, 0, {int(d) * 2.5}); g.pitch = 45; g.yaw = -30; g.dist = 60; g.update(); tw.main.rule = 'free'; }})()")
            await pg.wait_for_function("tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", timeout=120000); await pg.wait_for_timeout(1500)
            res = await pg.evaluate(CLASH, [rid, A.cats.split(',')])
            await br.close()
    finally:
        for pr in measure.procs: pr.kill()
    for o in res:
        print(o['cat'], 'at', (round(o['x'], 2), round(o['z'], 2)), 'box', o['box'])
        for h in o['hits']: print('   ', h)
    if A.json: json.dump(res, open(A.json, 'w'), indent=1)

asyncio.run(main())

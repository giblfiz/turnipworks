#!/usr/bin/env python3
"""How many draw calls are repeats: what instancing or merging could remove. Counts the visible meshes of a loaded map by
  (geometry, material)            what three.js could instance today with no other change
  (geometry, colour texture)      what could be instanced if look-alike materials were shared (they differ only by object)
and splits them into furniture / things (world.recs) and the shell (floors, walls, posts: world.shell).
  python3 repeats.py --data <relay data dir> --rooms 104
"""
import argparse, json, sys, time
import mm, layout
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--rooms', type=int, required=True); ap.add_argument('--out', default='results/repeats.jsonl')
A = ap.parse_args()
B = [json.loads(l) for l in open(__import__('os').environ.get('BUILD_JSONL', 'results/build.jsonl'))]; B = [b for b in B if b.get('counts', {}).get('room') == A.rooms][-1]
JS = """(() => { const w = tw.worldOf(tw.area()); const out = {};
  const vis = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const tally = (name, roots) => { const gm = new Map(), gt = new Map(), geos = new Set(), mats = new Set(), texs = new Set(); let meshes = 0, tris = 0; const matKinds = {};
    for (const root of roots) root.traverse(o => { if (!o.isMesh || !vis(o)) return; meshes++; const g = o.geometry; geos.add(g.uuid); tris += g.index ? g.index.count / 3 : (g.attributes.position?.count || 0) / 3;
      const m = Array.isArray(o.material) ? o.material[0] : o.material; mats.add(m.uuid); const t = m.map ? m.map.uuid : (m.color ? '#' + m.color.getHexString() : m.type); texs.add(t);
      gm.set(g.uuid + '|' + m.uuid, (gm.get(g.uuid + '|' + m.uuid) || 0) + 1); gt.set(g.uuid + '|' + t, (gt.get(g.uuid + '|' + t) || 0) + 1);
      const kind = (o.userData?.layer || o.parent?.userData?.layer || o.name || m.name || m.type); matKinds[kind] = (matKinds[kind] || 0) + 1; });
    const big = [...gt.values()].sort((a, b) => b - a);
    out[name] = { visible_meshes: meshes, triangles: Math.round(tris), geometries: geos.size, materials: mats.size, colour_textures: texs.size, draws_if_instanced_by_geometry_and_material: gm.size, draws_if_instanced_by_geometry_and_texture: gt.size, biggest_repeat_groups: big.slice(0, 10), top_names: Object.entries(matKinds).sort((a, b) => b[1] - a[1]).slice(0, 8) }; };
  const recs = [...w.recs.values()].map(r => r.group).filter(Boolean), shell = [...(w.shell?.values?.() || [])].map(s => s.group || s).filter(g => g && g.isObject3D);
  tally('things', recs); tally('shell', shell); tally('everything', [w.scene]);
  out.entities_by_place = (() => { const c = {}; for (const e of Object.values(tw.entities())) if (e.kind === 'object') c[e.place || '?'] = (c[e.place || '?'] || 0) + 1; return c; })();
  return out; })()"""
mm.start_local(A.data)
try:
    with sync_playwright() as p:
        browser, ctx, pg, errors, t = mm.open_game(p, token=B['token'])
        mm.wait_settled(pg, timeout=3600); pg.wait_for_timeout(2000)
        out = {'script': 'repeats', 'rooms': A.rooms, **pg.evaluate(JS)}; browser.close()
    open(A.out, 'a').write(json.dumps(out) + '\n'); print(json.dumps(out, indent=1))
finally: mm.stop()

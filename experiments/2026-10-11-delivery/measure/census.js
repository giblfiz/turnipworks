// Scene census: everything the area holds (sleeping rooms included: walks the layer groups AND every record's group).
(() => {
  const w = tw.worldOf(tw.area()); const seen = new Set(); const roots = [w.scene];
  for (const r of w.recs.values()) if (r.group) roots.push(r.group);
  for (const s of w.shell.values()) if (s.group) roots.push(s.group);
  const geos = new Map(), mats = new Map(), texs = new Map(); let meshes = 0, tris = 0, inst = 0, batched = 0, nodes = 0, lights = 0, pointLights = 0, visibleMeshes = 0;
  const pairs = new Map(), pairsTex = new Map(); const kindOf = new Map(); for (const r of w.recs.values()) r.group?.traverse(o => kindOf.set(o, r.entity?.kind === 'token' ? 'pawn' : 'prop')); for (const s of w.shell.values()) s.group?.traverse(o => kindOf.set(o, 'shell: ' + (s.spec?.layer || '?'))); const byKind = {};
  const TEXKEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'bumpMap', 'lightMap'];
  const visit = (o) => { if (seen.has(o)) return; seen.add(o); nodes++;
    if (o.isLight) { lights++; if (o.isPointLight) pointLights++; }
    if (o.isInstancedMesh) inst++; if (o.isBatchedMesh) batched++;
    if (o.isMesh || o.isPoints || o.isLine) { meshes++; const g = o.geometry; const n = g?.index ? g.index.count / 3 : (g?.attributes?.position?.count || 0) / 3; tris += n * (o.isInstancedMesh ? o.count : 1);
      if (g) { const e = geos.get(g.uuid) || { n: 0, tris: n, verts: g.attributes?.position?.count || 0, bytes: 0 }; if (!e.n) { for (const a of Object.values(g.attributes)) e.bytes += a.array?.byteLength || 0; if (g.index) e.bytes += g.index.array.byteLength; } e.n++; geos.set(g.uuid, e); }
      for (const m of [].concat(o.material || [])) { const e = mats.get(m.uuid) || { n: 0, type: m.type, transparent: !!m.transparent, tex: 0 }; e.n++; mats.set(m.uuid, e);
        const kd = kindOf.get(o) || 'other (ground, slabs, roofs, effects)'; const bk = byKind[kd] ||= { meshes: 0, tris: 0, gm: new Set(), gt: new Set(), mats: new Set() }; bk.meshes++; bk.tris += n; bk.gm.add(`${g?.uuid}|${m.uuid}`); bk.gt.add(`${g?.uuid}|${m.map?.uuid || m.color?.getHexString?.()}|${m.type}`); bk.mats.add(m.uuid);
        const k = `${g?.uuid}|${m.uuid}`; pairs.set(k, (pairs.get(k) || 0) + 1); const kt = `${g?.uuid}|${m.map?.uuid || m.color?.getHexString?.()}|${m.type}`; pairsTex.set(kt, (pairsTex.get(kt) || 0) + 1);
        for (const tk of TEXKEYS) { const t = m[tk]; if (t && t.isTexture) { const im = t.image || {}; const te = texs.get(t.uuid) || { n: 0, w: im.width || 0, h: im.height || 0, key: tk, src: (t.source?.data?.currentSrc || t.source?.data?.src || '').split('/assets/')[1] || (im.constructor?.name || '?') }; te.n++; texs.set(t.uuid, te); } } }
    }
    for (const c of o.children) visit(c); };
  for (const r of roots) visit(r);
  let texBytes = 0; const texSizes = {}; for (const t of texs.values()) { const b = t.w * t.h * 4 * 4 / 3; texBytes += b; const k = `${t.w}x${t.h}`; texSizes[k] = (texSizes[k] || 0) + 1; }
  let geoBytes = 0, geoTris = 0; for (const g of geos.values()) { geoBytes += g.bytes; geoTris += g.tris; }
  const topGeo = [...geos.values()].sort((a, b) => b.n - a.n).slice(0, 5).map(g => [g.n, g.tris]);
  const texFiles = {}; for (const t of texs.values()) { const d = t.src.split('/').slice(0, 2).join('/'); texFiles[d] = (texFiles[d] || 0) + 1; }
  const kinds = Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, { meshes: v.meshes, tris: Math.round(v.tris), materials: v.mats.size, groups_same_mesh_same_material: v.gm.size, groups_same_mesh_same_picture: v.gt.size }]));
  return { kinds, nodes, meshes, tris: Math.round(tris), instancedMeshes: inst, batchedMeshes: batched, lights, pointLights,
    geometries: geos.size, geoBytes, uniqueTris: Math.round(geoTris), materials: mats.size, textures: texs.size, texBytesRGBAmips: Math.round(texBytes), texSizes, texFiles,
    drawGroups_sameGeoSameMat: pairs.size, drawGroups_sameGeoSameTex: pairsTex.size, topGeoUse: topGeo,
    entities: Object.keys(tw.entities()).length, recs: w.recs.size, shell: w.shell.size, sleeping: w.sleeping?.size ?? null };
})()

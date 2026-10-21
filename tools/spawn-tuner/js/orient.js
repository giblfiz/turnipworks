// Mesh orientation, shared by the Spawn Tuner, the game client and the relay (no three.js: Node imports this too).
// Mesh orientation (front = glTF +Z). Keyed by MESH id (sku.mesh = "<src>/<sku>@<hash>"): inn-02 regenerated meshes
// under the same sku names, so a yaw measured on one mesh must never land on another. Older corrections carry only a
// sku: they belong to the mesh that sku showed when they were made (library `was`: superseded meshes + when replaced).
export function meshAtFn(lib) {
  const skuRec = new Map(Object.values(lib.objects).flatMap(o => o.skus.map(s => [s.sku, s])));
  return (sku, at) => { // at: ISO time of a sku-keyed correction; null = "before this build" (old browser storage)
    const s = skuRec.get(sku); if (!s?.mesh) return null;
    if (at == null) return s.was?.[0]?.mesh ?? s.mesh;
    const t = Date.parse(String(at).replace(/([+-]\d\d)(\d\d)$/, '$1:$2'));
    for (const w of [...(s.was || [])].reverse()) if (!(t >= Date.parse(String(w.until).replace(/([+-]\d\d)(\d\d)$/, '$1:$2')))) return w.mesh;
    return s.mesh;
  };
}
// server records (GET /tuner/orient) -> { mesh: yaw_deg }
export function orientFromServer(lib, records) {
  const meshAt = meshAtFn(lib), out = {};
  for (const [k, rec] of Object.entries(records || {})) {
    const v = rec?.data?.yaw_deg ?? rec?.yaw_deg, m = rec?.data?.mesh || (k.includes('@') ? k : meshAt(rec?.data?.sku || k, rec?.at ?? null));
    if (v != null && m) out[m] = +v;
  }
  return out;
}


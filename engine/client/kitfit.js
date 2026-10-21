// KIT FIT: put a generated kit piece (a jetty bracket, a chimney, a parapet section, a ridge cap…) where a rule wants it,
// the right way round and the right size, BY MEASURING THE MESH. The image-to-3D meshes do not agree on which way they
// face or which horizontal axis is their length, and the library's own sizing (largest dimension to largest dimension)
// is for furniture; the vertical kit asks for a per-axis fit to its stated box (experiments/2026-10-05-castle-crypt-
// mansion/vertical/kit.json: "fit: box"). So nothing here trusts a mesh's frame:
//   measure(THREE, v)        its box, where its LOW part sits (a bracket's leg is at the wall; a dormer's …), which way it
//                            climbs (a stair), sampled from its vertices
//   fitPiece(THREE, v, dims, opts) → a Group with the piece turned by a quarter turn chosen from the measurement, centred
//                            in x and z, its foot on y = 0, scaled to dims [w, h, d] per axis (or uniformly)
//     opts.long    'x' | 'z'     the piece's longer horizontal side goes along this axis (a parapet's run, a bracket's reach)
//     opts.lowAt   '-z' | '+z'   the end where its low part is (a bracket's wall leg) points this way
//     opts.uniform 'h' | 'w' | 'fit'   one scale for all three axes: to the height, to the width, or the largest that
//                            fits inside dims; default: per axis
// The fitted group carries userData.fit = { yaw, size, scale } for tests.

const QUARTERS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

// vertices of everything under `root`, in root's parent frame after root's own transform (sampled)
function points(THREE, root, max = 6000) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.parent ? root.parent.matrixWorld : new THREE.Matrix4()).invert(), m = new THREE.Matrix4(), v = new THREE.Vector3(), out = [];
  let total = 0; root.traverse(o => { if (o.isMesh && o.geometry?.attributes?.position) total += o.geometry.attributes.position.count; });
  const step = Math.max(1, Math.floor(total / max));
  root.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position; m.multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i).applyMatrix4(m); out.push(v.x, v.y, v.z); }
  });
  return out;
}

export function measure(THREE, root) {
  const p = points(THREE, root), n = p.length / 3;
  if (!n) return null;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { if (p[i + k] < min[k]) min[k] = p[i + k]; if (p[i + k] > max[k]) max[k] = p[i + k]; }
  const size = [0, 1, 2].map(k => max[k] - min[k]), c = [0, 1, 2].map(k => (min[k] + max[k]) / 2);
  // where the low third and the top tenth of it sit, in units of the half size (-1..1) along x and z
  const lowY = min[1] + size[1] * 0.33, topY = max[1] - size[1] * 0.1;
  let lx = 0, lz = 0, ln = 0, tx0 = Infinity, tx1 = -Infinity, tz0 = Infinity, tz1 = -Infinity;
  let sx = 0, sy = 0, sz = 0, sxy = 0, szy = 0, sxx = 0, szz = 0, syy = 0;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    if (y <= lowY) { lx += x - c[0]; lz += z - c[2]; ln++; }
    if (y >= topY) { tx0 = Math.min(tx0, x); tx1 = Math.max(tx1, x); tz0 = Math.min(tz0, z); tz1 = Math.max(tz1, z); }
    sx += x; sy += y; sz += z; sxy += x * y; szy += z * y; sxx += x * x; szz += z * z; syy += y * y;
  }
  const cov = (ab, a, b) => ab / n - (a / n) * (b / n), vy = Math.max(1e-9, cov(syy, sy, sy));
  const cx = cov(sxy, sx, sy) / Math.sqrt(Math.max(1e-9, cov(sxx, sx, sx)) * vy), cz = cov(szy, sz, sy) / Math.sqrt(Math.max(1e-9, cov(szz, sz, sz)) * vy);
  return {
    min, max, size, centre: c, n,
    lowAt: ln ? [lx / ln / Math.max(1e-6, size[0] / 2), lz / ln / Math.max(1e-6, size[2] / 2)] : [0, 0],
    top: [tx1 - tx0, tz1 - tz0],              // how far its top tenth reaches along x and z (a ridge runs along the longer)
    climb: [cx, cz],                          // how closely height follows x and z (a stair climbs along the stronger)
  };
}

export function fitPiece(THREE, v, dims, { long = null, lowAt = null, uniform = null } = {}) {
  const turn = new THREE.Group(), out = new THREE.Group();
  turn.add(v); out.add(turn);
  let best = 0, m = measure(THREE, turn);
  if (m && (long || lowAt)) {
    // judge each quarter turn from the one measurement (a quarter turn swaps x and z and flips one of them)
    const score = (yaw) => {
      const q = Math.round(yaw / (Math.PI / 2)), odd = Math.abs(q) % 2 === 1;
      const sx = odd ? m.size[2] : m.size[0], sz = odd ? m.size[0] : m.size[2];
      // three.js: a turn of +90° about Y sends +z to +x and +x to -z
      const low = q === 0 ? m.lowAt : q === 2 || q === -2 ? [-m.lowAt[0], -m.lowAt[1]] : q === 1 ? [m.lowAt[1], -m.lowAt[0]] : [-m.lowAt[1], m.lowAt[0]];
      let s = 0;
      if (long && Math.abs(sx - sz) > 0.08 * Math.max(sx, sz)) s += (long === 'x' ? sx > sz : sz > sx) ? 2 : -2;
      if (lowAt) s += (lowAt === '-z' ? -low[1] : low[1]);
      return s - Math.abs(q) * 1e-4; // ties: the smallest turn
    };
    let bs = -Infinity; for (const y of QUARTERS) { const s = score(y); if (s > bs) { bs = s; best = y; } }
  }
  turn.rotation.y = best;
  m = measure(THREE, turn);
  if (!m) return out;
  turn.position.set(-m.centre[0], -m.min[1], -m.centre[2]);
  const k = [dims[0] / Math.max(1e-6, m.size[0]), dims[1] / Math.max(1e-6, m.size[1]), dims[2] / Math.max(1e-6, m.size[2])];
  const u = uniform === 'h' ? k[1] : uniform === 'w' ? Math.min(k[0], k[2]) : uniform === 'fit' ? Math.min(...k) : null;
  out.scale.set(u ?? k[0], u ?? k[1], u ?? k[2]);
  out.userData.fit = { yaw: best, size: [m.size[0] * out.scale.x, m.size[1] * out.scale.y, m.size[2] * out.scale.z], scale: out.scale.toArray(), lowAt: m.lowAt, top: m.top, climb: m.climb };
  out.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return out;
}

// a sku's stated box in feet [w, h, d] from the library (catalog size is W x D x H inches; a sku may carry its own)
export function statedBox(lib, cat, skuName) {
  const o = lib?.objects?.[cat]; if (!o) return null;
  const k = o.skus.find(s => s.sku === skuName), sz = (k?.size?.length === 3 ? k.size : null) || (o.size?.length === 3 ? o.size : null);
  return sz ? [sz[0] / 12, sz[2] / 12, sz[1] / 12] : null;
}
// the first sku of `cat` whose name holds one of `wants` (in order), else the first with a mesh; null when the library
// has no such piece (the caller then draws its stand-in)
export function pickSku(lib, cat, wants = []) {
  const o = lib?.objects?.[cat]; if (!o) return null;
  const skus = o.skus.filter(k => k.url && k.bounds && k.kind !== 'flat');
  for (const w of wants) { const k = skus.find(s => s.sku.includes(w)); if (k) return k; }
  return skus[0] || null;
}

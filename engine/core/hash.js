// Deterministic hashing for layouts and versions. FNV-1a over a canonical string; no floats in the
// hash input are left unrounded, so the same layout hashes the same in every JS engine.

export function fnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export const hex8 = (n) => (n >>> 0).toString(16).padStart(8, '0');

// JSON with sorted keys, so two equal objects always serialize identically.
export function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  return `{${Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
}

// Round to 1/1000 ft (~0.01 in) before hashing: drift below that is invisible and not worth a mismatch.
const r3 = (x) => Math.round(x * 1000) / 1000;

// Hash of a solved room layout: what a viewer would see (which mesh, where, which way).
export function layoutHash(placements) {
  const rows = placements.map(p => [p.id, p.sku || '', r3(p.x), r3(p.y || 0), r3(p.z), r3(p.rot || 0), (p.dims || []).map(r3)].join('|'));
  return hex8(fnv1a(rows.join('\n')));
}

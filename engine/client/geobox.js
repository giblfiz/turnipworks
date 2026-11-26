// A MESH'S OWN BOX, WORKED OUT ONCE (2026-11-06, the SPEED lane; docs/PERF.md). world.boundsOf asked every mesh of a
// thing for its bounding box with computeBoundingBox(), which walks every vertex, every time it is asked; the selected
// pawn's ring asks several times a frame. The box is now kept with the geometry and worked out again only when its
// positions change: three.js bumps an attribute's version on needsUpdate, which any code that moves vertices must set
// for the picture to change at all (and a new attribute object is a new version too). Morph targets: always fresh.
const seen = new WeakMap(); // geometry -> [its position attribute, that attribute's version] when its box was worked out
export function geoBox(g) {
  if (!g?.computeBoundingBox) return null;
  const a = g.attributes?.position || null, v = a?.version ?? 0, s = seen.get(g);
  if (!g.boundingBox || !s || s[0] !== a || s[1] !== v || g.morphAttributes?.position?.length) { g.computeBoundingBox(); seen.set(g, [a, v]); }
  return g.boundingBox;
}

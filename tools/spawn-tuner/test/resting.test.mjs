// RESTING AND REACHING (2026-11-06): what the room roll puts down, judged by the MESHES the game draws, not the catalog
// boxes. Two Gemini reads of the /assets pack stills (Mine: "a wheelbarrow floats"; Monster lair: "a skeleton pokes through
// a wall", docs/KNOWN_BUGS.md 2026-11-04) asked whether the roll ever leaves a thing standing on air or reaching into a
// wall. This is the rule, over every room type in rooms.json x 3 sizes x N seeds (rectangular rooms, alone):
//   rest   every standing mesh's drawn bottom (its y + its scale x the real GLB's lowest point) is on the floor, or not
//          above the top of what it stands on (its parent / `on` record, or anything under its centre: a dais, a nest)
//          by more than REST_TOL; and never below the floor by more than SINK_TOL
//   reach  every mesh's drawn footprint (the real GLB's x/z bounds x its scale, turned by its rot and the yaw it is
//          DRAWN at: data/orient.json for its mesh, else the solver's yaw, as js/look.js meshYawDeg) stays inside the
//          room's inner wall faces (cell edge + INSET) by REACH_TOL; outdoor rooms (no walls) are left out
// The meshes are read from assets/m (git-ignored: a fresh worktree links them from the main checkout; docs/TEST_DEBT.md).
//   node tools/spawn-tuner/test/resting.test.mjs [tuner dir] [--seeds N] [--only type,type] [--print]
import { readFileSync, existsSync } from 'node:fs';
import { loadTree, makeHarness, CELL, INSET } from './ccm_lib.mjs';
const S = await loadTree('rest'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const argv = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SEEDS = +argv('--seeds', 4), ONLY = argv('--only', '') ? new Set(argv('--only').split(',')) : null;
export const REST_TOL = 0.12, SINK_TOL = 0.25, REACH_TOL = 2 / 12; // ft (REACH_TOL as ccm_lib's TOL)

// ---- the real meshes: bounds in the GLB's own space, node transforms applied (POSITION accessor min/max, glTF 2.0 5.1.1)
const meshBox = new Map();
function glbBox(path) {
  const b = readFileSync(path); let off = 12, js = null;
  while (off < b.length) { const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4); if (type === 0x4E4F534A) { js = JSON.parse(b.subarray(off + 8, off + 8 + len).toString('utf8')); break; } off += 8 + len; }
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const mul = (A, B) => { const C = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) C[j * 4 + i] += A[k * 4 + i] * B[j * 4 + k]; return C; }; // column-major
  const local = (n) => { if (n.matrix) return n.matrix; const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
    return [(1 - 2 * (y * y + z * z)) * sx, (2 * (x * y + z * w)) * sx, (2 * (x * z - y * w)) * sx, 0, (2 * (x * y - z * w)) * sy, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z + x * w)) * sy, 0, (2 * (x * z + y * w)) * sz, (2 * (y * z - x * w)) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1]; };
  const walk = (i, M) => { const n = js.nodes[i], W = mul(M, local(n));
    if (n.mesh != null) for (const p of js.meshes[n.mesh].primitives) { const a = js.accessors[p.attributes.POSITION]; if (!a.min || !a.max) continue;
      for (let c = 0; c < 8; c++) { const v = [c & 1 ? a.max[0] : a.min[0], c & 2 ? a.max[1] : a.min[1], c & 4 ? a.max[2] : a.min[2]];
        for (let r = 0; r < 3; r++) { const t = W[r] * v[0] + W[4 + r] * v[1] + W[8 + r] * v[2] + W[12 + r]; lo[r] = Math.min(lo[r], t); hi[r] = Math.max(hi[r], t); } } }
    for (const c of n.children || []) walk(c, W); };
  for (const i of js.scenes[js.scene || 0].nodes) walk(i, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return { lo, hi };
}
let missing = 0;
function boxOf(url) {
  if (!meshBox.has(url)) { const f = S.dir + url; meshBox.set(url, existsSync(f) ? glbBox(f) : null); if (!existsSync(f)) missing++; }
  return meshBox.get(url);
}
const meshOfSku = new Map(Object.values(S.lib.objects).flatMap(o => o.skus.map(k => [k.sku, k.mesh])));
const drawnYaw = (p) => { const m = meshOfSku.get(p.sku); return m && S.orient[m] != null ? +S.orient[m] * Math.PI / 180 : (p.yaw || 0); }; // (look.js meshYawDeg)
const HUNG = /^(wall-mount|wall-light|ceiling)$/;
const hungThing = (p) => HUNG.test(p.rule || '') || p.place === 'wall' || p.place === 'ceiling'; // (pegs, corbels, mangers, hanging carcasses: up off the floor by design)
const isMesh = (p) => p.kind === 'mesh' && p.url && p.place !== 'kit' && p.orient !== 'floor' && p.orient !== 'wall' && Array.isArray(p.s);
// a placement as drawn: world x/z box of its mesh, its bottom and top
function drawn(p) {
  const B = boxOf(p.url); if (!B) return null;
  const [sx, sy, sz] = p.s, a = (p.rot || 0) + drawnYaw(p), c = Math.cos(a), s = Math.sin(a);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const mx of [B.lo[0], B.hi[0]]) for (const mz of [B.lo[2], B.hi[2]]) { const lx = mx * sx, lz = mz * sz, wx = p.x + lx * c + lz * s, wz = p.z - lx * s + lz * c; x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz); } // (THREE rotation.y)
  return { x0, x1, z0, z1, bottom: (p.y || 0) + B.lo[1] * sy, top: (p.y || 0) + B.hi[1] * sy };
}
// what a thing can stand on: its own parent / `on` record first, else whatever is under its centre
function supportTop(p, L, D) {
  const id = p.parent || p.on; const sup = id && L.placements.find(q => q.uid === id);
  if (sup) { const d = D.get(sup); return { top: d ? d.top : (sup.y || 0) + sup.dims[1], base: sup.y || 0, by: sup.id, sku: sup.sku, stated: true }; }
  let best = null;
  for (const q of L.placements) { if (q === p || hungThing(q)) continue; const d = D.get(q); if (!d) continue;
    if (p.x > d.x0 && p.x < d.x1 && p.z > d.z0 && p.z < d.z1 && d.top <= D.get(p).bottom + REST_TOL && (!best || d.top > best.top)) best = { top: d.top, base: q.y || 0, by: q.id, sku: q.sku, stated: false }; }
  return best;
}
// KNOWN DEBT (measured 2026-11-06; both are data, from tools/spawn-tuner/build_data.py taking `bounds` from
// prep/blender_runtime.py rather than from the shipped GLB): a sku here may float by up to its `ft` and no more.
//   base: the GLB's lowest point is above its origin (the mesh stands that far up off whatever it is put on)
//   top:  the catalog `bounds` height is taller than the GLB, so things put ON it (parent = this sku) sit above its drawn top
export const DEBT = {
  'linen-chest': { kind: 'base', ft: 0.16, why: 'GLB bottom is 4% of its longest side above its origin (0.13 ft at its usual size)' },
  'statue-rotating--s2': { kind: 'base', ft: 0.2, why: 'GLB bottom is 2.6% of its longest side above its origin (0.16 ft on a 6.5-ft statue)' },
  'table-feast--fine': { kind: 'top', ft: 0.22, why: 'catalog bounds y 0.250 vs the GLB 0.234: at 11.8x the plates and goblets sit 0.18 ft over the cloth' },
};
const debtFor = (p, sup) => (DEBT[p.sku]?.kind === 'base' && DEBT[p.sku]) || (sup?.sku && DEBT[sup.sku]?.kind === 'top' && DEBT[sup.sku]) || null;
const debtSeen = new Map();
// the problems with one placed mesh: [[kind, message]]
function judge(p, L, D, faces, outdoor) {
  const dr = D.get(p), out = [], [X0, Z0, X1, Z1] = faces;
  if (!hungThing(p)) { // REST
    const lift = dr.bottom, sup = lift > REST_TOL || lift < -SINK_TOL ? supportTop(p, L, D) : null, over = sup ? lift - sup.top : lift, debt = over > REST_TOL ? debtFor(p, sup) : null;
    if (debt && over <= debt.ft) { const k = `${p.sku}${sup?.sku ? ' on ' + sup.sku : ''}`; debtSeen.set(k, Math.max(debtSeen.get(k) || 0, over)); }
    else if (!(lift <= REST_TOL || (sup && lift <= sup.top + REST_TOL))) out.push(['rest', `${p.id} (${p.rule}) stands on air: its drawn bottom is ${lift.toFixed(2)} ft up${sup ? `, ${sup.by}'s top is ${sup.top.toFixed(2)}` : ', nothing under it'} (y ${(p.y || 0).toFixed(2)})`]);
    if (!(lift >= -SINK_TOL || (sup && sup.stated))) out.push(['sink', `${p.id} (${p.rule}) is sunk ${(-lift).toFixed(2)} ft into the floor`]);
  }
  if (!outdoor) { // REACH
    const over = Math.max(X0 - dr.x0, dr.x1 - X1, Z0 - dr.z0, dr.z1 - Z1);
    if (over > REACH_TOL) out.push(['reach', `${p.id} (${p.rule}) reaches ${over.toFixed(2)} ft into a wall (drawn x ${dr.x0.toFixed(2)}..${dr.x1.toFixed(2)} z ${dr.z0.toFixed(2)}..${dr.z1.toFixed(2)}; faces x ${X0}..${X1} z ${Z0}..${Z1})`]);
  }
  return out;
}
const facesOf = (r) => [r.x * CELL + INSET, r.z * CELL + INSET, (r.x + r.w) * CELL - INSET, (r.z + r.d) * CELL - INSET];
const measured = (L) => new Map(L.placements.filter(isMesh).map(p => [p, drawn(p)]).filter(([, d]) => d));

// THE CHECK BITES: in a real solved room, a floor thing lifted 0.4 ft, a thing put on its parent 0.4 ft above the top,
// and a wall-hugger pushed 0.4 ft past the inner face must each be caught (and the unchanged room is clean of them)
{ const B = H.build([mk('r', 'min-sorting', 10, 10, 7, 5, 6104, 1)]), L = B.solve('r'), F = facesOf(B.rooms[0]);
  const wb = L.placements.find(p => p.id === 'wheelbarrow') || L.placements.find(p => isMesh(p) && !p.parent && p.rule === 'against-wall');
  ok(!!wb, 'self-test: the Mine still\'s room has a wall-standing thing'); if (wb) {
    ok(judge(wb, L, measured(L), F, false).length === 0, `self-test: the Mine still's ${wb.id} as rolled rests on the floor and stays out of the wall: ${JSON.stringify(judge(wb, L, measured(L), F, false))}`);
    const up = { ...wb, y: (wb.y || 0) + 0.4 }, L2 = { ...L, placements: L.placements.map(p => p === wb ? up : p) };
    ok(judge(up, L2, measured(L2), F, false).some(([k]) => k === 'rest'), `self-test: ${wb.id} lifted 0.4 ft is caught standing on air`);
    const side = wb.side || (Math.abs(wb.x - F[0]) < Math.abs(wb.x - F[2]) ? 'W' : 'E'), dx = side === 'W' ? -0.4 : side === 'E' ? 0.4 : 0, dz = side === 'N' ? -0.4 : side === 'S' ? 0.4 : 0;
    const inw = { ...wb, x: wb.x + dx, z: wb.z + dz }, L3 = { ...L, placements: L.placements.map(p => p === wb ? inw : p) };
    ok(judge(inw, L3, measured(L3), F, false).some(([k]) => k === 'reach'), `self-test: ${wb.id} pushed 0.4 ft toward its ${side} wall is caught reaching into it`); }
}
{ const B = H.build([mk('r', 'common', 10, 10, 6, 5, 82241, 1)]), L = B.solve('r'), F = facesOf(B.rooms[0]), kid = L.placements.find(p => p.parent && isMesh(p));
  ok(!!kid, 'self-test: a common room puts something on something');
  if (kid) { ok(judge(kid, L, measured(L), F, false).length === 0, `self-test: ${kid.id} as rolled sits on its parent's top`);
    const up = { ...kid, y: kid.y + 0.4 }, L4 = { ...L, placements: L.placements.map(p => p === kid ? up : p) };
    ok(judge(up, L4, measured(L4), F, false).some(([k]) => k === 'rest'), `self-test: ${kid.id} 0.4 ft above its parent's top is caught`); } }

const sizes = [[3, 3], [5, 4], [8, 6]], seen = new Map(); let rooms = 0, things = 0;
const note = (k, tag) => { const v = seen.get(k) || { n: 0, ex: tag }; v.n++; seen.set(k, v); };
for (const T of S.types) {
  if (ONLY && !ONLY.has(T.key)) continue;
  const outdoor = S.w.isOutdoor(T.key);
  for (const [w, d] of sizes) for (let seed = 1; seed <= SEEDS; seed++) {
    let B, L; const r0 = mk('r', T.key, 10, 10, w, d, seed * 101 + w * 7 + d, 1);
    try { B = H.build([r0]); L = B.solve('r'); } catch (e) { ok(false, `${T.key} ${w}x${d} seed ${r0.seed} threw: ${e.message}`); continue; }
    rooms++;
    const tag = `${T.key} ${w}x${d} seed ${r0.seed}`, F = facesOf(B.rooms[0]), D = measured(L);
    for (const p of D.keys()) {
      things++;
      const probs = judge(p, L, D, F, outdoor);
      if (!probs.length) ok(true, ''); for (const [k, m] of probs) { ok(false, `${tag}: ${m}`); note(`${k} ${p.id} ${p.sku} ${p.rule}`, tag); }
    }
  }
}
ok(ONLY || rooms > 100, `rooms solved: ${rooms}`);
ok((ONLY || things > 1000) && missing < meshBox.size / 2, `meshes measured: ${things} placements, ${meshBox.size} GLBs (${missing} missing: link tools/spawn-tuner/assets/m from the main checkout)`);
console.log(`\n${rooms} rooms, ${things} placed meshes, ${meshBox.size} GLBs read (${missing} missing)`);
for (const [k, v] of debtSeen) console.log(`  known debt (DEBT above): ${k} floats ${v.toFixed(2)} ft`);
if (PRINT || seen.size) for (const [k, v] of [...seen].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${String(v.n).padStart(4)} x ${k}   e.g. ${v.ex}`);
H.report('resting');

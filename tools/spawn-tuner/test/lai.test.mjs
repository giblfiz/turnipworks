// Monster lair (2026-10-11): ten room types in cut-rock walls (the dungeon's family, shared), no windows.
//   node test/lai.test.mjs [tuner dir] [--print]
//   rooms     every room type x 6 sizes x 8 seeds x 3 arrangements (alone; off a cave passage; packed between others,
//             which gives the dens a second door): the shared checks (ccm_lib.mjs: no purpose fail, nothing outside or
//             overlapping, the focal piece present, paths clear, the key piece in view, nothing hung on a door,
//             deterministic) + no windows + cut-rock
//   skeleton  the four dens (dragon, spider, beast, goblin) carry the SAME beats: a bed, a hoard, a feeding spot, signs
//             inside the door; the bed is deeper in than the signs and the feeding spot; the hoard is nearer the bed
//             than the door; a second door is joined to the creature's spot by a clear 'escape' line; the creature's
//             own patch of floor is empty
//   kinds     the four dens differ: each has pieces no other den has (what a blind read can tell them apart by)
//   dark      beast, spider and dragon dens have NO light; the warren, the larder and the pit have one
//   passage   a lone cave passage is entered at an end and has a way on; one cell wide, nothing stands in it
//   a lair    ten rooms side by side: every room solves
// The lair shares the dungeon batch's meshes (sku tier 'dun'); the same test passes on a library without them.
import { loadTree, makeHarness, CELL, standing, aabb, fireType } from './ccm_lib.mjs';
const S = await loadTree('lai'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const KEYS = S.w.LAI_ROOMS, DENS = ['lair-dragon', 'lair-spider', 'lair-beast', 'lair-warren'], HAS = (id) => !!S.lib.objects[id];
ok(KEYS.length === 10, 'ten lair rooms');
for (const k of KEYS) ok(!!S.T[k], `room type ${k} is in rooms.json`);
const EGGS = HAS('eggs-monster') || HAS('dragon-eggs');
const FOCAL = { 'lair-mouth': /^(cave-mouth|totem-skull|skull-pile|bones-pile)$/, 'lair-passage': null, 'lair-warren': /^(bone-throne|throne|chair-armed)$/, 'lair-beast': /^(nest-giant|nest-monster|hay-pile)$/, 'lair-spider': /^(web-funnel|egg-sacs-floor|eggs-monster|web-cocoon|rite-mummified-remains|bones-pile)$/,
  'lair-larder': /^(butcher-block|chopping-block-kitchen|block-headsman|carcass-hanging)$/, 'lair-pit': /^(pit-open|oubliette-hatch|cage-floor)$/, 'lair-hatchery': /^(dragon-eggs|eggs-monster|nest-giant)$/, 'lair-trophy': /^(dragon-skull|pedestal-display|skull-pile|armor-stand|weapon-rack|mil-shield-stack|banner-pole|bones-pile|trophy-head|monster-head-trophy|shield-display|heraldic-shield|horn-hunting|statue-petrified)$/, 'lair-dragon': /^(treasure-hoard-heap|dun-treasure-hoard|coin-pile)$/ };
const SIZES = { 'lair-mouth': [[7, 6], [5, 4], [4, 4], [9, 7], [6, 9], [12, 8]], 'lair-passage': [[8, 2], [6, 1], [1, 7], [10, 3], [3, 2], [2, 12]], 'lair-warren': [[7, 6], [4, 4], [5, 3], [6, 8], [9, 7], [12, 8]],
  'lair-beast': [[5, 5], [3, 3], [4, 3], [6, 5], [4, 7], [8, 7]], 'lair-spider': [[6, 6], [3, 3], [4, 3], [5, 7], [8, 6], [10, 8]], 'lair-larder': [[4, 4], [3, 3], [3, 2], [5, 4], [4, 6], [7, 6]],
  'lair-pit': [[5, 5], [3, 3], [4, 3], [6, 5], [4, 7], [8, 7]], 'lair-hatchery': [[5, 4], [3, 3], [4, 3], [6, 6], [4, 7], [8, 6]], 'lair-trophy': [[7, 3], [5, 2], [2, 6], [9, 3], [3, 10], [10, 4]], 'lair-dragon': [[8, 7], [4, 4], [5, 4], [6, 8], [10, 8], [12, 10]] };
const DARK = new Set(['lair-beast', 'lair-spider', 'lair-dragon']), LIT = new Set(['lair-warren', 'lair-larder', 'lair-pit']);
const ARR = {
  alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
  offPassage: (k, w, d, s) => [mk('h', k === 'lair-passage' ? 'lair-warren' : 'lair-passage', 10, 7, Math.max(w, 4), 3, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)],
  packed: (k, w, d, s) => [mk('a', 'lair-larder', 10 - 4, 10, 4, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('c', 'lair-passage', 10, 10 + d, w, 2, s + 2, 3), mk('v', k === 'lair-pit' ? 'lair-beast' : 'lair-pit', 10 + w, 10, 4, d, s + 3, 4)],
};
const dist = (p, q) => Math.hypot(p.x - q[0], p.z - q[1]);
const stats = {}; let rooms = 0; const kinds = Object.fromEntries(DENS.map(k => [k, new Map()]));
for (const k of KEYS) for (const [w, d] of SIZES[k]) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 8; seed++) {
  if (k === 'lair-mouth' && arr === 'packed') continue; // (an outdoor room packed between indoor ones: the yard test's ground, not ours)
  const B = H.build(ARR[arr](k, w, d, seed * 97 + w * 7 + d)), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`;
  rooms++;
  const outdoor = k === 'lair-mouth', noEggs = k === 'lair-hatchery' && !EGGS;
  const st = stats[k] ||= { n: 0, props: 0, dens: [], light: 0, fails: 0, things: new Map() };
  st.n++; if (L.purposeFail) st.fails++;
  if (noEggs) { ok(/no eggs/.test(L.purposeFail || ''), `${tag} a hatchery without an egg mesh should say so: ${L.purposeFail}`); continue; }
  const res = H.checkRoom(tag, B, r, L, { focal: L.purposeFail ? null : FOCAL[k], lights: false, windows: outdoor ? undefined : false });
  st.props += res.props; st.dens.push(res.density / res.target); st.light += L.placements.filter(p => fireType(p.id)).length;
  for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  if (!outdoor) ok(r.family === 'cut-rock', `${tag} family ${r.family}`);
  const mine = [...B.E.edges.values()].filter(e => e.sides.some(s => s.room === r.id)), fl = standing(L), doors = B.E.openings.get(r.id).filter(o => o.kind === 'door');
  if (!outdoor) for (const e of mine.filter(e => e.kind === 'door' && e.owner.room === r.id)) ok(/^(door-reinforced|door-plank|crypt-gate-iron)$/.test(e.doorType), `${tag} door type ${e.doorType}`);
  const lights = L.placements.filter(p => fireType(p.id)).length;
  if (DARK.has(k)) ok(lights === 0, `${tag} a light in a ${k} (${L.placements.filter(p => fireType(p.id)).map(p => p.id)})`);
  if (LIT.has(k) && !L.purposeFail) ok(lights >= 1, `${tag} no light`);
  // ---- the den skeleton
  if (DENS.includes(k) && !L.purposeFail) {
    const by = (rule) => L.placements.filter(p => p.rule === rule), bed = by('den-bed'), hoard = by('den-hoard'), feed = by('den-feed'), signs = by('den-sign'), md = L.mainDoor, info = L.placements.find(p => p.lair)?.lair || {};
    const door = md ? md.inner : null, big = w * d >= (k === 'lair-dragon' ? 30 : 20) && Math.min(w, d) >= 4;
    if (big) { ok(bed.length >= 1, `${tag} no bed`); ok(hoard.length >= 1, `${tag} no hoard`); ok(feed.length >= 1, `${tag} no feeding spot`); if (door) ok(signs.length >= 1, `${tag} no warning sign`); }
    if (door && bed.length) {
      const b0 = bed[0], bd = dist(b0, door);
      if (big) for (const p of signs) ok(dist(p, door) < Math.max(12, bd * 0.55), `${tag} a warning sign (${p.id}) ${dist(p, door).toFixed(0)} ft from the door`);
      if (big && k !== 'lair-warren') { const nearBed = hoard.filter(p => dist(p, [b0.x, b0.z]) < dist(p, door)).length; ok(nearBed >= Math.ceil(hoard.length * 0.6), `${tag} the hoard is by the door, not the bed (${nearBed} of ${hoard.length})`);
        const f0 = feed.find(p => p.orient !== 'floor'); if (f0) ok(dist(f0, door) > 3 && dist(f0, [b0.x, b0.z]) > 2, `${tag} the feeding spot is not between the door and the bed`); }
      if (big && k !== 'lair-warren') ok(bd >= Math.min(w, d) * CELL * 0.45, `${tag} the bed is ${bd.toFixed(0)} ft from the door: not deep in the room`);
    }
    // the creature's own floor is empty, and every second door has its escape line
    if (info.spot && info.stand >= 3) for (const p of fl) { const [aw, ad] = aabb(p); ok(!(Math.abs(p.x - info.spot[0]) < (aw + info.stand) / 2 - 0.6 && Math.abs(p.z - info.spot[1]) < (ad + info.stand) / 2 - 0.6), `${tag} ${p.id} (${p.rule}) stands on the creature's own floor`); }
    if (doors.length >= 2) ok(L.paths.some(p => p.kind === 'escape' && p.ok) || L.paths.filter(p => p.ok).length >= 2, `${tag} a second door with no escape line`);
    ok(!!info.kind, `${tag} no lair record`);
    for (const p of L.placements) if (/^den-/.test(p.rule) || p.rule === 'key-seat') kinds[k].set(p.id, (kinds[k].get(p.id) || 0) + 1);
  }
  if (k === 'lair-passage') { ok(L.paths.some(p => p.kind === 'through' && p.ok), `${tag} no clear way through`);
    if (arr === 'alone' && w !== d) { const end = w > d ? ['W', 'E'] : ['N', 'S'], ds = mine.filter(e => e.kind === 'door'); ok(ds.length === 2 && ds.every(e => end.includes(e.owner.side)), `${tag} a lone passage should have a door in each end wall: ${ds.map(e => e.owner.side)}`); }
    if (Math.min(w, d) === 1) ok(fl.length === 0, `${tag} something stands in a passage one cell wide: ${fl.map(p => p.id)}`); }
  if (k === 'lair-trophy' && !L.purposeFail) ok(L.paths.some(p => p.kind === 'through' && p.ok), `${tag} no clear way down the gallery`);
  if (k === 'lair-pit' && !L.purposeFail) { const pit = L.placements.find(p => p.rule === 'key-pit'); ok(!!pit, `${tag} no pit`); if (pit && pit.orient === 'floor') for (const p of fl) { const [aw, ad] = aabb(p); ok(!(Math.abs(p.x - pit.x) < (aw + pit.dims[0]) / 2 - 0.3 && Math.abs(p.z - pit.z) < (ad + pit.dims[2]) / 2 - 0.3), `${tag} ${p.id} stands in the pit`); } }
  if (k === 'lair-mouth' && !L.purposeFail) ok(L.paths.some(p => p.kind === 'path' && p.ok), `${tag} no clear way in`);
  if (PRINT && seed === 1 && arr === 'alone') console.log('\n--- ' + tag + '\n' + S.s2.summarize2(L));
}
console.log(`rooms: ${rooms} lair rooms solved (10 types x 6 sizes x 3 arrangements x 8 seeds)`);
for (const [k, st] of Object.entries(stats)) { const top = [...st.things].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([i, n]) => `${i} ${(n / st.n).toFixed(1)}`).join(', ');
  console.log(`  ${k.padEnd(14)} ${String(st.n).padStart(3)} rooms, purpose fails ${st.fails}, ${(st.props / st.n).toFixed(1)} props, density ${st.dens.length ? (st.dens.reduce((a, b) => a + b, 0) / st.dens.length).toFixed(2) : '-'}x target, ${(st.light / st.n).toFixed(1)} lights; per room: ${top}`);
  if (!(k === 'lair-hatchery' && !EGGS)) ok(st.fails <= st.n * 0.1, `${k}: purpose fails in ${st.fails} of ${st.n} rooms`); }
// ---- the creature kinds differ: each den has beat pieces that no other den uses
for (const k of DENS) { const own = [...kinds[k].keys()].filter(id => DENS.every(o => o === k || !kinds[o].has(id)));
  console.log(`  ${k}: its own beat pieces: ${own.join(', ') || '(none)'}`);
  ok(own.length >= 1, `${k} has no beat piece of its own: a blind read could not tell it from the other dens`); }
// ---- a lair: the ten rooms side by side, every one solves
{ let x = 10; const rs = KEYS.filter(k => k !== 'lair-mouth').map((k, i) => { const [w, d] = SIZES[k][0], r = mk('r' + i, k, x, 10, w, d, 500 + i, i + 1); x += w; return r; });
  rs.push(mk('m', 'lair-mouth', 10, 10 + 8, 8, 6, 77, 99));
  const B = H.build(rs); for (const r of rs) { const L = B.solve(r.id); ok(!L.purposeFail || (r.type === 'lair-hatchery' && !EGGS), `a lair: ${r.type} fails: ${L.purposeFail}`); } }
H.report('lai');

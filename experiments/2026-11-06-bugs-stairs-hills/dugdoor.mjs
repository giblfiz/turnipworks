// B2: does a room dug into a hill's side get its outside door on the earth side? Sweeps seeds and room types over a
// room at the ground half dug into a 10-ft hill and counts doors whose outside square is solid earth (earthAt > floor).
//   node experiments/2026-11-06-bugs-stairs-hills/dugdoor.mjs
const ENG = new URL('../../engine/', import.meta.url);
const { loadRoomgen } = await import(new URL('relay/server.js', ENG).href);
const HT = await import(new URL('core/height.js', ENG).href);
const rg = await loadRoomgen(new URL('tuner', ENG).pathname, new URL('tuner-data', ENG).pathname);
const room = (id, type, x, z, w, d, y, seed, order) => ({ id, kind: 'room', order, recipe: { type, x, z, w, d, seed, wallSeed: seed + 1, ...(y && { y }) } });
// the square just outside a perimeter edge (tools/spawn-tuner/js/walls.js perimeter keys)
const outside = (key, side) => { const [, a, b] = key.split(':').map(Number); return side === 'N' ? [a, b - 1] : side === 'S' ? [a, b] : side === 'W' ? [a - 1, b] : [a, b]; };
let n = 0, bad = 0; const ex = [];
for (const type of ['common', 'guest', 'kitchen', 'storeroom', 'chapel', 'great-hall']) for (let seed = 1; seed <= 40; seed++) for (const [rx, w] of [[6, 6], [4, 8], [8, 4]]) {
  const E = Object.fromEntries([room('room_hill', 'hill', 0, 0, 10, 10, 10, 3, 1), room('room_dug', type, rx, 3, w, 4, 0, seed, 2)].map(e => [e.id, e]));
  const r = rg.roomsOf(E).find(r => r.id === 'room_dug'); n++;
  if (!r.extDoor) continue;
  const cells = r.extDoor.keys.map(k => outside(k, r.extDoor.side)), earth = cells.map(([gx, gz]) => HT.earthAt(E, (gx + 0.5) * 5, (gz + 0.5) * 5));
  if (earth.some(h => h > 0.5)) { bad++; if (ex.length < 4) ex.push({ type, seed, rx, w, side: r.extDoor.side, cells, earth }); }
}
console.log(`doors onto solid earth: ${bad} of ${n} dug-in rooms`); for (const e of ex) console.log(JSON.stringify(e));

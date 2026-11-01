// node engine/tools/library_spawns.mjs [--jobs 6] [--solves 48] : WHAT EACH ROOM TYPE'S RULES CAN SPAWN, for the Build
// library's shelves (Harry 2026-10-29: "The objects feel sparse somehow, are we missing stuff?"). A room's recipe slots
// name only part of what its solver program puts down (the program also brings its own lights, tableware, rugs, a
// dragon's hoard ...: 511 things on 135 of 147 room types' shelves were missing, 2026-10-29). So each room type is
// solved many times (48), at four sizes (its usual size, half as big again, a square smaller, twice as big) and as many
// seeds, twice with a faction, in the browser's own room engine, and every
// catalog id it put down is written to engine/client/data/library-spawns.json:
//   { version, solves, rooms: { <room key>: [catalog ids, sorted] } }
// client/library-index.js puts those on the room's shelves. Re-run it when the room rules change (test/library-index
// .test.mjs solves a few rooms and fails, by name, on a spawned thing that is on no shelf of its room).
import fs from 'node:fs';
import { spawn } from 'node:child_process';
const E = new URL('../', import.meta.url).pathname;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SOLVES = +arg('--solves', 48), JOBS = +arg('--jobs', 6), SHARD = arg('--shard', null);
const FACTIONS = ['sun', 'moon', 'devils', 'spiders'];

async function sample(shard, n) {
  const { makeRoomGen } = await import(E + 'core/roomgen.js');
  const walls = await import(E + '../tools/spawn-tuner/js/walls.js'), solver = await import(E + '../tools/spawn-tuner/js/solver.js'), solver2 = await import(E + '../tools/spawn-tuner/js/solver2.js');
  const read = (p) => JSON.parse(fs.readFileSync(E + p));
  const lib = read('tuner-data/library.json'), rooms = read('tuner-data/rooms.json'), orient = read('tuner-data/orient.json');
  const rg = makeRoomGen({ walls, solver, solver2, lib, types: rooms, orient, version: 'library-spawns' });
  const out = {};
  rooms.forEach((r, i) => {
    if (i % n !== shard) return;
    const [cw, cd] = r.cells || [4, 4], got = new Set();
    const sizes = [[cw, cd], [Math.ceil(cw * 1.5), Math.ceil(cd * 1.5)], [Math.max(2, cw - 1), Math.max(2, cd - 1)], [cw * 2, cd * 2]];
    for (let s = 0; s < SOLVES; s++) {
      const [w, d] = sizes[s % sizes.length], flavor = s >= SOLVES - 2 ? FACTIONS[(i + s) % 4] : null;
      try {
        const L = rg.solve({}, { id: 'room_spawns', type: r.key, x: 0, z: 0, w, d, seed: 11 + s * 37, ...(flavor && { flavor }) }, 1); // (w, d in 5-ft squares)
        for (const o of L.objects) got.add(o.cat);
      } catch (e) { process.stderr.write(`${r.key}: ${String(e).slice(0, 160)}\n`); }
    }
    out[r.key] = [...got].sort();
  });
  return out;
}

if (SHARD != null) { const [s, n] = SHARD.split('/').map(Number); process.stdout.write(JSON.stringify(await sample(s, n))); }
else {
  const parts = await Promise.all(Array.from({ length: JOBS }, (_, s) => new Promise((res, rej) => {
    let buf = ''; const p = spawn(process.execPath, [new URL(import.meta.url).pathname, '--shard', `${s}/${JOBS}`, '--solves', String(SOLVES)], { stdio: ['ignore', 'pipe', 'inherit'] });
    p.stdout.on('data', (c) => buf += c); p.on('close', (code) => code ? rej(new Error(`shard ${s} exited ${code}`)) : res(JSON.parse(buf)));
  })));
  const rooms = Object.fromEntries(Object.entries(Object.assign({}, ...parts)).sort(([a], [b]) => a < b ? -1 : 1));
  const file = E + 'client/data/library-spawns.json';
  fs.writeFileSync(file, JSON.stringify({ version: 1, solves: SOLVES, made: new Date().toISOString().slice(0, 10), rooms }) + '\n');
  console.log(`${Object.keys(rooms).length} room types, ${SOLVES} solves each -> ${file}`);
}

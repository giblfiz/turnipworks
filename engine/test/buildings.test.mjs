// WHOLE BUILDINGS, ENGINE LEVEL: a plan (tuner js/buildings.js) turned into commands (core/buildplan.js), applied the
// way the relay applies them, with the REAL wall engine and the REAL layout solver. What is checked on every building:
//   the relay's own checks accept every op of the batch, in order
//   every door the plan asked for is a door, on the wall segment the plan named; no door the plan did not ask for
//     joins two of its rooms; no door was forced in by the wall engine ("added so the room is reachable")
//   the street door is where the plan put it, and it is the only door to outside of a planned room
//   every room is furnished without losing its key piece (the solver's purposeFail)
//   every stair joins two rooms (core/stairs.js stairLinks), and no furniture stands on a stair, its foot, its hole or its landing
//   node engine/test/buildings.test.mjs [seeds=3] [--code=TAV] [--verbose]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRoomgen } from '../relay/server.js';
import { REGISTRY } from '../core/commands.js';
import { planOps, genOf } from '../core/buildplan.js';
import { newId } from '../core/ids.js';
import { stairsOf, stairLinks, stairCells, stairEnds, stairTop, stairBase, isConnector } from '../core/stairs.js';
const HERE = path.dirname(fileURLToPath(import.meta.url)), TUNER = path.join(HERE, '../../tools/spawn-tuner');
const B = await import(path.join(TUNER, 'js/buildings.js')), walls = await import(path.join(TUNER, 'js/walls.js'));
const rg = await loadRoomgen(path.join(TUNER, 'js'), path.join(TUNER, 'data'), { orientApi: null });
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const N = +(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 3), only = arg('code', null), verbose = process.argv.includes('--verbose');
const PREFIX = { TAV: 'tav-', NOB: 'nob-', CAS: 'cas-', CRY: 'cry-' };
const typesOf = (code) => rg.typeList.filter(t => (rg.recipesOf?.(t.key) || []).some(r => r.startsWith(PREFIX[code])));
const fs = await import('node:fs'); const roomsJson = JSON.parse(fs.readFileSync(path.join(TUNER, 'data/rooms.json'), 'utf8'));
const roomTypes = (code) => roomsJson.filter(t => (t.recipes || []).some(r => r.startsWith(PREFIX[code] || code.toLowerCase() + '-'))).map(t => ({ key: t.key, cells: t.cells, outdoor: !!t.outdoor }));
void typesOf;
const SIZES = [[8, 6], [12, 8], [16, 12], [20, 14], [8, 12]];
const tally = {}; const bump = (code, k, ok, eg) => { const t = (tally[code] ||= {}), r = (t[k] ||= { pass: 0, fail: 0, eg: [] }); r[ok ? 'pass' : 'fail']++; if (!ok && r.eg.length < 4) r.eg.push(eg); };
let buildings = 0, roomsN = 0, t0 = Date.now();
for (const code of (only ? [only] : ['TAV', 'NOB', 'CAS', 'CRY'])) {
  const T = B.BUILDING_TYPES[code];
  for (const [w, d] of SIZES) for (const st of [...new Set([T.storeys.def, T.storeys.max])]) for (let n = 1; n <= N; n++) {
    const seed = n * 104729 + w * 13 + d, tag = `${code} ${w}x${d} s${st} seed ${seed}`;
    const plan = B.generate({ code, rect: { x: 2, z: 1, w, d }, seed, storeys: st, types: roomTypes(code), roles: walls.ROLES });
    const building = newId('bld');
    let out; try { out = planOps(plan, { roomgen: rg, entities: {}, order: 0, building, name: T.label, newId, gen: genOf(plan) }); } catch (e) { bump(code, 'planOps runs', false, `${tag}: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); continue; }
    bump(code, 'planOps runs', !out.blocked, `${tag}: ${out.left.join('; ')}`); if (out.blocked) continue;
    buildings++; roomsN += out.rooms.length;
    // the relay's checks, op by op
    let area = { entities: {}, order: 0, chat: [] }, refused = null;
    for (const op of out.ops) { const why = REGISTRY[op.type].check?.({ area, roomTypes: rg.types, state: null }, op.args); if (why) { refused = `${op.type} ${op.args.type || op.args.name || ''}: ${why}`; break; } area = REGISTRY[op.type].apply(area, op.args, { by: 'gm' }); }
    bump(code, 'the relay accepts every op', !refused, `${tag}: ${refused}`); if (refused) continue;
    const E = area.entities, W = rg.edges(E), idOf = out.idOf, back = new Map([...idOf].map(([a, b]) => [b, a]));
    const doors = [...W.edges.values()].filter(e => e.kind === 'door');
    // doors as planned
    const want = new Map(); for (const r of plan.rooms) for (const [o, e] of Object.entries(r.links)) if (idOf.has(r.id) && idOf.has(o)) want.set([idOf.get(r.id), idOf.get(o)].sort().join('|'), { key: `${e[0]}:${e[1]}:${e[2]}${r.y ? '@' + r.y : ''}`, a: r, b: plan.rooms.find(x => x.id === o) });
    const got = new Map(); for (const e of doors) { if (e.sides.length === 2) got.set([e.sides[0].room, e.sides[1].room].sort().join('|'), e); else if (e.yard) got.set([e.sides[0].room, e.yard.room].sort().join('|'), e); }
    const planned = (id) => { const p = plan.rooms.find(r => r.id === back.get(id)); return p && !p.free; };
    let missing = 0, moved = 0, extra = 0;
    for (const [k, v] of want) { const e = got.get(k); if (!e) { if (v.a.free || v.b.free) continue; missing++; if (verbose) console.log('  missing', tag, v.a.type, v.b.type, v.key); } else if (e.key !== v.key) moved++; }
    for (const [k, e] of got) { const [a, b] = k.split('|'); if (!want.has(k) && planned(a) && planned(b) && !(e.sides.length === 1 && e.doorFor && plan.rooms.find(r => r.id === back.get(e.doorFor))?.entry)) { extra++; if (verbose) console.log('  extra', tag, E[a]?.recipe.type, E[b]?.recipe.type, e.why); } }
    bump(code, 'every planned door is a door', !missing, `${tag}: ${missing} missing`);
    bump(code, 'each door is on the segment the plan named', !moved, `${tag}: ${moved} elsewhere`);
    bump(code, 'no door the plan did not ask for', !extra, `${tag}: ${extra} extra`);
    const forced = doors.filter(e => e.flag === 'reachability' || e.flag === 'forced');
    bump(code, 'the wall engine forced no door in', !forced.length, `${tag}: ${forced.map(e => `${e.flag}:${e.sides.map(s => E[s.room]?.recipe.type).join('/')}`).join(', ')}`);
    // the street door
    const ent = plan.rooms.find(r => r.entry), entId = ent && idOf.get(ent.id), ext = doors.filter(e => e.sides.length === 1 && planned(e.sides[0].room) && (!e.yard || !want.has([e.sides[0].room, e.yard.room].sort().join("|"))));
    const front = doors.filter(e => e.sides.length === 1 && e.sides[0].room === entId && e.key === `${ent.entry[0]}:${ent.entry[1]}:${ent.entry[2]}`);
    bump(code, 'the street door is where the plan put it', front.length === 1, `${tag}: ${front.length}`);
    const strays = ext.filter(e => !(e.sides[0].room === entId));
    bump(code, 'no other planned room has a door to outside', !strays.length, `${tag}: ${strays.map(e => E[e.sides[0].room]?.recipe.type + ' ' + e.why).join(', ')}`);
    // furnished, key piece present
    bump(code, 'every room keeps its key piece', !out.fails.length, `${tag}: ${out.fails.map(f => `${f.type} ${f.w}x${f.d}: ${f.why}`).join('; ')}`);
    for (const f of out.fails) bump(code, `  key piece: ${f.type}`, false, `${tag} ${f.w}x${f.d}: ${f.why}`);
    // stairs
    let loose = 0, onStair = 0;
    for (const s of stairsOf(E)) { const L = stairLinks(E, s); if (!L.from || !L.to) loose++;
      const ends = stairEnds(s), cells = stairCells(s);
      const keep = [[stairBase(s), [...cells, ends.footCell]], [stairTop(s), [...cells, ends.topCell]]];
      for (const [yy, cs] of keep) for (const o of Object.values(E)) { if (o.kind !== 'object' || isConnector(o) || o.parent || o.flat || o.place === 'wall' || o.place === 'ceiling' || o.place === 'kit' || o.place === 'tile' || (o.y || 0) - yy > 3 || (o.y || 0) - yy < -0.5) continue; // (things on that floor: not what hangs overhead)
        if (cs.some(([gx, gz]) => o.x > gx * 5 + 0.6 && o.x < gx * 5 + 4.4 && o.z > gz * 5 + 0.6 && o.z < gz * 5 + 4.4)) { onStair++; if (verbose) console.log('  on stair', tag, o.cat, E[o.room]?.recipe.type); } } }
    bump(code, 'every stair joins two rooms', !loose, `${tag}: ${loose}`);
    const ways = stairsOf(E).length; // (2026-10-11: a stair that is furniture opens the floor above it too; a generated building must have only the planned ones)
    bump(code, 'no stair but the planned ones opens a floor', ways === out.stairs.length, `${tag}: ${ways} connectors, ${out.stairs.length} planned`);
    bump(code, 'no furniture on a stair, its foot, hole or landing', !onStair, `${tag}: ${onStair} things`);
  }
}
let failed = 0;
for (const [code, t] of Object.entries(tally)) { console.log(`\n${code}`); for (const [k, r] of Object.entries(t)) { if (r.fail) failed++; console.log(`  ${r.fail ? 'FAIL' : ' ok '} ${String(r.pass).padStart(4)}/${r.pass + r.fail}  ${k}`); for (const e of r.eg) console.log(`         e.g. ${e}`); } }
console.log(`\n${buildings} buildings, ${roomsN} rooms furnished, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(failed ? 1 : 0);

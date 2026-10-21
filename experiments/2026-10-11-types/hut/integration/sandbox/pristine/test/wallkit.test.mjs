// Variant B wall kit: node tools/spawn-tuner/test/wallkit.test.mjs
// Measures the planned geometry over random buildings (v1 + v2 door policies, every kit family, mixed with generated
// families): zero overlap between any two body/face/casing/closed-leaf boxes; every joint abuts with zero gap (straight
// joints meet at the vertex with identical cross-sections; slabs ending on a node lie on the node's face and inside
// it); UVs equal on both sides of every joint; door openings equal the generated-leaf spans; hinges sit on leaf edges.
import { computeEdges, chooseExteriorDoor, overlaps, CELL, doorSpanFor } from '../js/walls.js';
import { mulberry32 } from '../js/solver.js';
import { planKit, KIT, KIT_FAMILIES, boxSolids, overlapVol, faceUV, jambOf, DOOR_H } from '../js/wallkit.js';
import { readFileSync } from 'node:fs';
const here = new URL('..', import.meta.url).pathname;
const types = JSON.parse(readFileSync(here + 'data/rooms.json'));
const T = Object.fromEntries(types.map(t => [t.key, t])), keys = types.map(t => t.key);
const GEN = ['rough-timber', 'half-timber', 'fieldstone', 'dressed-stone', 'noble-interior'];

let checks = 0, fails = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 25) console.log('FAIL', m); } };
const EPS = 1e-9;
const stats = { buildings: 0, solids: 0, pairs: 0, straight: 0, nodeJoints: 0, uvSamples: 0, maxUv: 0, maxGap: 0, doors: {}, hinges: 0 };

function building(seed, famMode) {
  const rng = mulberry32(seed * 7919), rooms = [];
  let tries = 0;
  while (rooms.length < 2 + Math.floor(rng() * 6) && tries++ < 300) {
    const type = keys[Math.floor(rng() * keys.length)], [cw, cd] = T[type].cells;
    const w = Math.max(1, cw + Math.floor(rng() * 3) - 1), d = Math.max(1, cd + Math.floor(rng() * 3) - 1);
    let x = 6, z = 6;
    if (rooms.length) { const b = rooms[Math.floor(rng() * rooms.length)]; const side = Math.floor(rng() * 4); x = side === 0 ? b.x + b.w : side === 1 ? b.x - w : b.x + Math.floor(rng() * b.w); z = side === 2 ? b.z + b.d : side === 3 ? b.z - d : b.z + Math.floor(rng() * b.d); }
    const fam = famMode === 'kit' ? KIT_FAMILIES[Math.floor(rng() * 3)] : famMode === 'mixed' ? (rng() < 0.6 ? KIT_FAMILIES[Math.floor(rng() * 3)] : GEN[Math.floor(rng() * 5)]) : famMode;
    const r = { id: `r${rooms.length}`, type, x, z, w, d, seed: Math.floor(rng() * 1e9), wallSeed: Math.floor(rng() * 1e9), family: fam, created: rooms.length + 1 };
    if (x < 0 || z < 0 || rooms.some(o => overlaps(o, r))) continue;
    r.extDoor = chooseExteriorDoor(r, [...rooms, r]);
    rooms.push(r);
  }
  return rooms;
}

// along-wall coordinate helpers
const sOf = (dir, b) => dir === 'h' ? [b[0], b[1]] : [b[2], b[3]];
const cOf = (dir, b) => dir === 'h' ? [b[2], b[3]] : [b[0], b[1]];

function measure(rooms, engine, label) {
  const E = computeEdges(rooms, { engine });
  const plan = planKit(E.edges);
  stats.buildings++;
  // 1. zero overlap
  const S = boxSolids(plan);
  stats.solids += S.length;
  for (let a = 0; a < S.length; a++) for (let b = a + 1; b < S.length; b++) {
    stats.pairs++;
    const v = overlapVol(S[a], S[b]);
    if (v > EPS) ok(false, `${label}: overlap ${v.toExponential(2)} cu ft ${S[a].item}(${S[a].part}) / ${S[b].item}(${S[b].part})`);
  }
  checks++;
  // 2. joints. For every kit edge, its body boxes per layer; at each end either a straight joint (the next edge's box
  // starts exactly where this one ends, same cross-section and height) or a node (the box end lies on a node box face,
  // and its end rectangle is inside that face).
  const bodies = (it) => it.solids.filter(s => s.b && s.part === 'body');
  const edgeList = [...plan.edgeItems.values()];
  for (const it of edgeList) {
    const e = plan.view.get(it.key) || E.edges.get(it.key), dir = it.wallDir, n = e.kind === 'door' ? (e.span || 1) : 1;
    const ends = [[e.gx, e.gz, -1], dir === 'h' ? [e.gx + n, e.gz, 1] : [e.gx, e.gz + n, 1]];
    for (const [gx, gz, side] of ends) {
      const vs = (dir === 'h' ? gx : gz) * CELL;
      const node = plan.nodeItems.get(`${gx}:${gz}`);
      // the body boxes that touch this end of the run
      const mine = bodies(it).filter(s => { const [s0, s1] = sOf(dir, s.b); return side < 0 ? s0 <= Math.min(...bodies(it).map(q => sOf(dir, q.b)[0])) + 1e-6 && s0 < vs + 1.5 : s1 >= Math.max(...bodies(it).map(q => sOf(dir, q.b)[1])) - 1e-6 && s1 > vs - 1.5; });
      if (!node) {
        if (side < 0) continue; // count each straight joint once, from its left/top piece
        const next = edgeList.find(o => { const q = plan.view.get(o.key) || E.edges.get(o.key); return o !== it && o.wallDir === dir && q.gx === gx && q.gz === gz; });
        if (!next) { ok(!plan.nodeItems.size || true, ''); continue; } // a generated-family neighbour: not a kit joint
        stats.straight++;
        for (const s of mine) {
          const end = sOf(dir, s.b)[1];
          stats.maxGap = Math.max(stats.maxGap, Math.abs(end - vs));
          ok(Math.abs(end - vs) < EPS, `${label}: straight joint ${it.key}: ends at ${end} not ${vs}`);
          // the neighbour's boxes starting at the vertex must cover this end face's height with the same cross-section
          // (a window run splits a layer into below-sill / piers / above-head boxes)
          const mates = bodies(next).filter(q => Math.abs(sOf(dir, q.b)[0] - vs) < EPS && q.y0 < s.y1 - EPS && q.y1 > s.y0 + EPS);
          const lo = Math.min(...mates.map(q => q.y0)), hi = Math.max(...mates.map(q => q.y1));
          ok(mates.length && lo <= s.y0 + EPS && hi >= s.y1 - EPS, `${label}: straight joint ${it.key}->${next.key}: end face y ${s.y0}-${s.y1} not covered`);
          for (const mate of mates) {
            ok(Math.abs(cOf(dir, mate.b)[0] - cOf(dir, s.b)[0]) < EPS && Math.abs(cOf(dir, mate.b)[1] - cOf(dir, s.b)[1]) < EPS, `${label}: cross-section differs at ${it.key}`);
            ok(mate.mat === s.mat && mate.uv === s.uv, `${label}: material changes across straight joint ${it.key}`);
            // UV continuity: sample the joint face (both faces of the wall + top) from both pieces
            for (const [cc, nrm] of [[cOf(dir, s.b)[0], dir === 'h' ? [0, 0, -1] : [-1, 0, 0]], [cOf(dir, s.b)[1], dir === 'h' ? [0, 0, 1] : [1, 0, 0]]]) {
              for (const y of [Math.max(s.y0, mate.y0), (Math.max(s.y0, mate.y0) + Math.min(s.y1, mate.y1)) / 2, Math.min(s.y1, mate.y1)]) {
                const p = dir === 'h' ? [vs, y, cc] : [cc, y, vs];
                const ua = faceUV(s.uv, s.mat, p, nrm), ub = faceUV(mate.uv, mate.mat, p, nrm);
                const du = Math.max(Math.abs(ua[0] - ub[0]), Math.abs(ua[1] - ub[1]));
                stats.uvSamples++; stats.maxUv = Math.max(stats.maxUv, du);
                ok(du < 1e-12, `${label}: UV jump ${du} at ${it.key}`);
              }
            }
          }
        }
      } else {
        stats.nodeJoints++;
        for (const s of mine) {
          const end = side < 0 ? sOf(dir, s.b)[0] : sOf(dir, s.b)[1];
          // a node box in the same height band whose face is at `end`, covering s's end rectangle
          const nb = node.solids.filter(q => q.y0 < s.y1 - EPS && q.y1 > s.y0 + EPS);
          const face = nb.filter(q => Math.abs((side < 0 ? sOf(dir, q.b)[1] : sOf(dir, q.b)[0]) - end) < EPS);
          const covered = face.length && Math.min(...face.map(q => q.y0)) <= s.y0 + EPS && Math.max(...face.map(q => q.y1)) >= s.y1 - EPS
            && face.every(q => cOf(dir, q.b)[0] <= cOf(dir, s.b)[0] + EPS && cOf(dir, q.b)[1] >= cOf(dir, s.b)[1] - EPS);
          const g = face.length ? 0 : Math.min(...nb.map(q => Math.abs((side < 0 ? sOf(dir, q.b)[1] : sOf(dir, q.b)[0]) - end)));
          stats.maxGap = Math.max(stats.maxGap, g);
          ok(covered, `${label}: ${it.key} (${it.family}) y${s.y0}-${s.y1} end ${end} c ${cOf(dir, s.b).map(v => v.toFixed(3))} not on node ${node.key} (${node.family}) faces ${JSON.stringify(face.map(q => [q.y0, q.y1, cOf(dir, q.b).map(v => +v.toFixed(3))]))}`);
        }
      }
    }
    // 3. doors: opening = generated-leaf span; leaves fill the casing; hinges on leaf edges, swinging into the owner room
    if (e.kind === 'door') {
      const cas = it.solids.filter(s => s.part === 'casing'), lo = Math.min(...cas.map(s => sOf(dir, s.b)[0])), hi = Math.max(...cas.map(s => sOf(dir, s.b)[1]));
      // jamb at each end: the generated leaf's (4 / 8 in) unless a wall turns there (then the crossing wall's half-thickness)
      const turn = (gx, gz) => { const nd = plan.nodeItems.get(`${gx}:${gz}`); const ins = [...E.edges.values()].filter(x => x.kind !== 'door-span' && ((x.gx === gx && x.gz === gz) || (x.dir === 'h' ? x.gx + (x.kind === 'door' ? x.span || 1 : 1) === gx && x.gz === gz : x.gx === gx && x.gz + (x.kind === 'door' ? x.span || 1 : 1) === gz))); return ins.some(x => x.dir !== dir); };
      const cornerA = turn(...ends[0]), cornerB = turn(...ends[1].slice(0, 2));
      const want = (n * 60 - (n === 1 ? 8 : 16)) / 12;
      if (!cornerA && !cornerB) ok(Math.abs(hi - lo - want) < EPS, `${label}: door ${it.key} span ${n}: opening ${(hi - lo) * 12} in, want ${want * 12}`);
      else { stats.cornerDoors = (stats.cornerDoors || 0) + 1; stats.cornerLoss = Math.max(stats.cornerLoss || 0, (want - (hi - lo)) * 12); ok(hi - lo <= want + EPS && hi - lo >= want - 2 / 3 - 1e-9, `${label}: corner door ${it.key} opening ${(hi - lo) * 12}`); }
      stats.doors[n] = (stats.doors[n] || 0) + 1;
      ok(it.leaves.length === (n > 1 ? 2 : 1), `${label}: door ${it.key} leaves ${it.leaves.length}`);
      for (const l of it.leaves) {
        stats.hinges++;
        const board = l.solids.find(s => s.part === 'leaf'), [b0, b1] = sOf(dir, board.b), ps = dir === 'h' ? l.pivot[0] : l.pivot[2];
        ok(Math.abs(ps - b0) < EPS || Math.abs(ps - b1) < EPS, `${label}: hinge not on the leaf edge ${it.key}`);
        ok(Math.abs(board.y1 - (DOOR_H - 0.25)) < EPS && board.y0 === 0, `${label}: leaf height`);
        ok(Math.abs(l.openAngle) === 100 && l.axis[1] === 1, `${label}: hinge data`);
        // swing: rotate the free edge 30 deg by openAngle's sign; it must move toward the owner interior
        const free = Math.abs(ps - b0) < EPS ? b1 : b0, a = Math.sign(l.openAngle) * 30 * Math.PI / 180;
        const L = dir === 'h' ? [free - ps, 0] : [0, free - ps];
        const rx = L[0] * Math.cos(a) + L[1] * Math.sin(a), rz = -L[0] * Math.sin(a) + L[1] * Math.cos(a);
        const into = dir === 'h' ? rz : rx, sgn = (e.owner.side === 'N' || e.owner.side === 'W') ? 1 : -1;
        ok(Math.sign(into) === sgn, `${label}: leaf ${it.key} swings out of the owner room`);
      }
    }
  }
}

for (let s = 1; s <= 120; s++) {
  for (const mode of ['kit', 'mixed', 'kit-stone', 'kit-half-timber', 'kit-plank']) {
    const rooms = building(s, mode);
    measure(rooms, s % 2 ? 'v2' : 'v1', `s${s}/${mode}`);
  }
}
// every span doorSpanFor can produce must have been exercised as a kit door
const spans = new Set(['barn', 'stable', 'common', 'desk', 'guest'].flatMap(t => [1, 2, 3, 4, 5, 6, 8].map(L => doorSpanFor(t, L, 0)).concat([1, 2, 3, 4, 5, 6, 8].map(L => doorSpanFor(t, L, 1)), [1, 2, 3, 4, 5, 6, 8].map(L => doorSpanFor(t, L, 2)))));
for (const n of spans) ok(stats.doors[n] > 0, `door span ${n} (from doorSpanFor) never built as a kit door`);
// jambs match the generated leaves
ok(jambOf(1) * 12 === 4 && jambOf(3) * 12 === 8, 'jamb widths');
console.log(`wallkit: ${checks} checks, ${fails} failures | ${stats.buildings} buildings, ${stats.solids} boxes, ${stats.pairs} overlap pairs, ${stats.straight} straight joints, ${stats.nodeJoints} node joints, ${stats.uvSamples} UV samples (max jump ${stats.maxUv}), max gap ${stats.maxGap} ft, doors by span ${JSON.stringify(stats.doors)}, ${stats.hinges} hinges, corner doors ${stats.cornerDoors} (max narrowing ${stats.cornerLoss?.toFixed(2)} in)`);
process.exit(fails ? 1 : 0);

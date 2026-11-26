// Solve one culture room and print what stands where (debugging):  node tools/one.mjs KEY W D SEED [hub-key]
// run from tools/spawn-tuner:  node ../../experiments/2026-11-06-cultures-a/tools/one.mjs jpn-shop 4 4 53 jpn-house
import { loadTree, makeHarness } from '../../../tools/spawn-tuner/test/ccm_lib.mjs';
const [k, w, d, seed, hub] = process.argv.slice(3).filter(a => !a.startsWith('--')); // (argv[2]: the tuner dir, for loadTree)
const S = await loadTree('../..'), H = makeHarness(S);
const rooms = [...(hub ? [H.mk('h', hub, 10, 6, Math.max(+w, 4), 4, +seed + 1, 1)] : []), H.mk('r', k, 10, 10, +w, +d, +seed, 2)];
const B = H.build(rooms), L = B.solve('r');
console.log(L.purposeFail || 'ok', '| doors', B.E.openings.get('r').filter(o => o.kind === 'door').map(o => `${o.side}${o.index}`).join(' '), '| room', 10 * 5, 10 * 5, +w * 5, +d * 5);
for (const p of L.placements) console.log(p.id.padEnd(28), p.rule.padEnd(14), p.x.toFixed(1), p.z.toFixed(1), (p.rot * 180 / Math.PI).toFixed(0), p.why);

// Debug one room solve:  node experiments/2026-11-06-cultures-b/tools/dbg_room.mjs <type> <w> <d> <seed> [--fake]
// prints paths, placements and doors (the --fake library as test/cultures_b.test.mjs builds it)
import fs from 'node:fs';
const [type, w, d, seed] = process.argv.slice(2, 6), fake = process.argv.includes('--fake');
const TU = new URL('../../../tools/spawn-tuner/', import.meta.url).pathname, E = new URL('../', import.meta.url).pathname;
process.argv = [process.argv[0], process.argv[1], TU];
const { loadTree, makeHarness } = await import(TU + 'test/ccm_lib.mjs');
const S = await loadTree('real'), H = makeHarness(S), code = type.slice(0, 3);
if (fake) {
  const TG = JSON.parse(fs.readFileSync(E + 'targets.json')), RT = JSON.parse(fs.readFileSync(E + 'fake_types.json'));
  for (const t of TG) { if (t.kind === 'wall' || t.code !== code) continue; const sku = { sku: t.obj === t.id ? t.id : `${t.obj}--${t.code}`, family: '', tier: t.code, shape: '', kind: 'mesh', url: 'x', bounds: [t.size[0] / 12, t.size[2] / 12, t.size[1] / 12] };
    if (S.lib.objects[t.obj]) S.lib.objects[t.obj].skus.push(sku); else S.lib.objects[t.obj] = { id: t.obj, desc: t.desc, place: t.place, fp: t.fp, size: t.size, scale: [0.9, 1.1], mat: t.mat, aff: [], gen: 'mesh', pri: 'P1', hint: '', var: [], skus: [sku], only: [t.code] }; }
  for (const rt of RT) if (!S.T[rt.key]) S.T[rt.key] = { ...rt, slots: {}, missing: [] };
}
const r = H.mk('r', type, 10, 10, +w, +d, +seed, 2), B = H.build([r]), L = B.solve('r');
console.log('fail:', L.purposeFail || '-', '| what:', L.what || '');
console.log('paths:', JSON.stringify(L.paths.map(p => ({ kind: p.kind, ok: p.ok, ...(p.ok ? {} : { by: p.blockedBy || p.blocked || p.why }) }))));
console.log(L.placements.filter(p => p.orient !== 'floor').map(p => `${p.id}@${p.x.toFixed(1)},${p.z.toFixed(1)} r${(p.rot * 180 / Math.PI).toFixed(0)} [${p.rule}]`).join('\n'));
console.log('doors:', B.E.openings.get('r').filter(o => o.kind === 'door').map(o => `${o.side}${o.index}`).join(' '), 'room', r.x * 5, r.z * 5, r.w * 5, r.d * 5);

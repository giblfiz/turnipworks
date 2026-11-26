// Faith factions (2026-11-07, lane faith-factions; experiments/2026-11-07-faith-factions/DESIGN.md): Christian, Buddhist,
// Hindu, Muslim as factions beside the thirteen fantasy ones.
//   node test/faiths.test.mjs [tuner dir] [--fake] [--print]
//   --fake    lay the planned pieces into the library in memory at catalog size (before the meshes exist)
//   library   the four are factions: reverent, a named look, every piece named (never "<faith> idol"), every piece of
//             theirs present; a slot they omit is empty; their own roles are filled by them alone
//   halls     temple nave / cathedral / shrine x sizes x seeds, each faith: the shared room checks (ccm_lib) + every flavor
//             piece is the room's faith; Buddhist / Hindu / Muslim halls have NO church fitting; the right focus, the
//             minbar to the worshipper's right of the mihrab, prayer rows, an open Hindu floor; the Christian church has
//             no confessional, benches not pews, its font by the door
//   grisly    every room type a faction can dress, asked for each faith: a room only sinister flavors dress (the cult
//             sanctum, the dark cathedral) never takes the faith, and NO solved faith room holds a grisly piece
//   golden    the other seventeen flavors' halls are untouched (run test/golden.mjs for the full tree)
import { loadTree, makeHarness, standing, aabb, fireType } from './ccm_lib.mjs';
import { readFileSync } from 'node:fs';
const S = await loadTree('faiths'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print'), FAKE = process.argv.includes('--fake');
const FAITHS = ['christian', 'buddhist', 'hindu', 'muslim'];
const PIECES = { // what each faith fills (DESIGN.md); the rest of the slots stay empty
  christian: ['idol', 'altarpiece', 'sculpture', 'censer', 'font', 'stand', 'banner', 'relief', 'sigil'],
  buddhist: ['idol', 'altar', 'altarpiece', 'sculpture', 'censer', 'wheel', 'mat', 'banner', 'relief', 'sigil'],
  hindu: ['idol', 'altarpiece', 'censer', 'bell', 'gate', 'relief', 'sigil'],
  muslim: ['idol', 'censer', 'pulpit', 'lamp', 'stand', 'font', 'corbel', 'mat', 'relief', 'sigil'] };
const ROLE = { altar: ['floor', [60, 24, 36]], mat: ['floor', [30, 96, 0.2], 'flat'], pulpit: ['floor', [30, 96, 106]], stand: ['floor', [18, 18, 54]], font: ['floor', [36, 36, 54]],
  lamp: ['ceiling', [14, 14, 36]], wheel: ['floor', [30, 30, 72]], bell: ['ceiling', [14, 14, 36]], gate: ['floor', [96, 24, 120]] };
const FLATS = ['banner', 'relief', 'sigil', 'mat'];
const lib = S.lib, meta = (f) => (Array.isArray(lib.factions) ? lib.factions.find(x => x.id === f) : lib.factions[f]);
if (FAKE) for (const f of FAITHS) for (const r of PIECES[f]) {
  const id = `flavor-${r}`, sku = `${id}--${f}`;
  lib.objects[id] ||= { id, desc: id, place: ROLE[r][0], fp: '1', size: ROLE[r][1], scale: [1, 1], mat: 'stone', aff: r === 'lamp' ? ['lit'] : [], gen: 'mesh', pri: 'P1', hint: '', var: ['shape'], skus: [] };
  if (!lib.objects[id].skus.some(s => s.sku === sku)) lib.objects[id].skus.push({ sku, family: '', tier: '', shape: f, piece: '', src: 'fth-01', kind: FLATS.includes(r) ? 'flat' : 'mesh', url: `assets/m/${sku}.glb`, lod: 'default', ...(FLATS.includes(r) ? {} : { bounds: [0.6, 1, 0.5] }) });
}

// ---- library: the four factions and their pieces
const sinister = new Set(['devils', 'spiders', 'dragons', 'skulls', 'tentacles']);
for (const f of FAITHS) {
  const m = meta(f);
  ok(!!m && m.reverent === true && m.group === 'faith' && m.rite === f && !!m.look, `${f}: a reverent faction with its rite and look (${JSON.stringify(m && { group: m.group, rite: m.rite })})`);
  if (!m) continue;
  for (const r of PIECES[f]) { const id = `flavor-${r}`; ok(lib.objects[id]?.skus.some(s => s.shape === f), `${f}: has its ${id} (${m.names?.[id]})`); ok(!!m.names?.[id] && !/idol|flavor|faction/i.test(m.names[id]), `${f}: ${id} is named for what it is (${m.names?.[id]})`); }
  for (const id of m.omit) ok(!lib.objects[id]?.skus.some(s => s.shape === f), `${f}: ${id} is deliberately empty, yet has a piece`);
  ok(!(m.omit || []).some(id => (m.ownSlots || []).includes(id)), `${f}: a slot both omitted and owned`);
}
ok(!lib.objects['flavor-idol']?.skus.some(s => s.shape === 'muslim' && !meta('muslim')?.names['flavor-idol'].match(/^Mihrab$/)), 'the Muslim focus is the mihrab');
for (const [id, o] of Object.entries(lib.objects)) if (id.startsWith('flavor-') && FAITHS.some(f => meta(f)?.ownSlots?.includes(id))) for (const s of o.skus) ok(FAITHS.includes(s.shape), `${id} is a faith's own role, but ${s.sku} is ${s.shape}'s`);

// ---- no text on anything sacred: every prompt forbids it, and every shipped piece's blind read (Gemini, unprimed) saw none
// (the Om roundel and the Om emblem may show the Om sign and nothing else)
{ const X = new URL('../../../experiments/2026-11-07-faith-factions/fth/', import.meta.url), J = (f) => { try { return JSON.parse(readFileSync(new URL(f, X))); } catch { return null; } };
  const plates = J('assets.json')?.assets || [], flats = J('flats.json')?.assets || [];
  ok(plates.length >= 24 && flats.length >= 16, `the spec lists the faiths' plates (${plates.length}) and flats (${flats.length})`);
  for (const a of plates) ok(/NO writing, letters, characters, calligraphy/.test(a.prompt), `${a.id}: its prompt does not forbid writing`);
  for (const a of flats) ok(/ABSOLUTELY NO TEXT|NO text/.test(a.prompt), `${a.id}: its prompt does not forbid text`);
  const reads = { ...(J('mesh-read.json') || {}), ...(J('reads-final.json') || {}), ...(J('reads-flats.json') || {}) }, om = (t) => (t || []).every(x => /\bom\b|ॐ/i.test(String(x)));
  const shipped = Object.values(lib.objects).flatMap(o => o.skus.filter(k => /^fth-(flats-)?01$/.test(k.src || '')));
  if (!FAKE) ok(shipped.length >= 34, `the faiths' pieces are in the library (${shipped.length})`);
  for (const f of FAITHS) { const r = reads[`emblem--${f}`]; ok(!!r && (!(r.text || []).length || (f === 'hindu' && om(r.text))), `the ${f} emblem: ${r ? 'text ' + JSON.stringify(r.text) : 'no blind read'}`); }
  const man = (() => { try { const [h, ...rows] = readFileSync(new URL('../../../catalog/runs/fth-01/manifest.tsv', import.meta.url), 'utf8').trim().split('\n').map(l => l.split('\t')); return Object.fromEntries(rows.map(r => [r[h.indexOf('sku')], r[h.indexOf('source')]])); } catch { return {}; } })();
  // (a re-plated piece ships under its sku; its read is its source mesh's: catalog/runs/fth-01/manifest.tsv)
  for (const k of shipped) { const src = man[k.sku] || k.sku, r = reads[src]; ok(!!r, `${k.sku}: no blind read on record`); if (r) ok(!(r.text || []).length || (k.shape === 'hindu' && /relief|emblem/.test(k.sku) && om(r.text)), `${k.sku}: the blind read saw text: ${JSON.stringify(r.text)}`); }
}

// ---- halls
const CHURCH = /^(pew|organ-pipe|confessional|rite-choir-stall|font-holy|rite-prie-dieu|rite-alms-box|prayer-candle-rack|rite-memorial-sand-tray|pulpit|lectern|altar-stone|rite-vestments-stand)$/;
const flavOf = (p) => /^flavor-/.test(p.id) ? lib.objects[p.id]?.skus.find(s => s.sku === p.sku)?.shape : null;
const SIZES = { 'temple-nave': [[5, 8], [4, 6], [6, 9], [7, 10], [4, 5]], cathedral: [[8, 14], [7, 10], [9, 12]], 'temple-shrine': [[3, 4], [2, 3], [4, 4], [3, 5]] };
const FOCUS = { christian: /^altar-stone$/, buddhist: /^flavor-idol$/, hindu: /^flavor-idol$/, muslim: /^flavor-idol$/ };
let rooms = 0; const stats = {};
for (const f of FAITHS) for (const [k, sizes] of Object.entries(SIZES)) for (const [w, d] of sizes) for (let seed = 1; seed <= 4; seed++) {
  const r = mk('r', k, 10, 10, w, d, seed * 131 + w * 7 + d, 1); r.flavor = f;
  const B = H.build([r]), L = B.solve('r'), tag = `${f} ${k} ${w}x${d} seed ${r.seed}`; rooms++;
  H.checkRoom(tag, B, r, L, { focal: k === 'temple-shrine' && f === 'christian' ? /^flavor-idol$|^altar-stone$/ : FOCUS[f], lights: true, fire: [[/^flavor-(censer|lamp)/, 'candle']], windows: undefined });
  const st = stats[`${f} ${k}`] ||= { n: 0, things: new Map(), mats: 0, lamps: 0 }; st.n++;
  for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  for (const p of L.placements.filter(flavOf)) ok(flavOf(p) === f, `${tag}: ${p.sku} in a ${f} room`);
  ok(L.placements.some(p => p.id === 'flavor-idol'), `${tag}: no ${meta(f)?.names['flavor-idol']}`);
  if (f !== 'christian') {
    const ch = L.placements.filter(p => CHURCH.test(p.id)); ok(!ch.length, `${tag}: church fittings in a ${f} hall: ${ch.map(p => p.id)}`);
    const idol = L.placements.find(p => p.id === 'flavor-idol');
    if (idol) for (const p of standing(L).filter(p => p !== idol && p.y < 0.5)) { const [aw, ad] = aabb(p), [iw, id] = aabb(idol); ok(!(Math.abs(p.x - idol.x) < (aw + iw) / 2 && Math.abs(p.z - idol.z) < (ad + id) / 2), `${tag}: ${p.id} inside the ${f} focus`); }
  }
  const mats = L.placements.filter(p => p.id === 'flavor-mat'); st.mats += mats.length;
  for (const m of mats) for (const p of standing(L)) { const [aw, ad] = aabb(p), [mw, md] = aabb(m); ok(!(Math.abs(p.x - m.x) < (aw + mw) / 2 - 0.1 && Math.abs(p.z - m.z) < (ad + md) / 2 - 0.1), `${tag}: ${p.id} stands on a ${f} mat`); }
  if (f === 'hindu') ok(!mats.length && !L.placements.some(p => /^(pew|bench-)/.test(p.id)), `${tag}: the Hindu hall's floor is open`);
  if ((f === 'muslim' || f === 'buddhist') && k !== 'temple-shrine' && w * d >= 30) ok(mats.length >= 4, `${tag}: only ${mats.length} ${f} mats in a ${w * d}-cell hall`);
  if (f === 'muslim') {
    st.lamps += L.placements.filter(p => p.id === 'flavor-lamp').length;
    ok(L.placements.some(p => p.id === 'flavor-lamp'), `${tag}: no mosque lamp`);
    const mb = L.placements.find(p => p.id === 'flavor-pulpit'), mh = L.placements.find(p => p.id === 'flavor-idol');
    if (mb && mh) { const [nx, nz] = [Math.sin(mh.rot), Math.cos(mh.rot)], right = [nz, -nx]; ok((mb.x - mh.x) * right[0] + (mb.z - mh.z) * right[1] > 0, `${tag}: the minbar stands to the worshipper's LEFT of the mihrab`); }
    const across = Math.min(w, d) * 5 - 1; if (k !== 'temple-shrine' && across >= 16 && w * d >= 30) ok(!!mb, `${tag}: no minbar in a hall ${across} ft across`);
    ok(!L.placements.some(p => p.id === 'flavor-font'), `${tag}: the ablution fountain is on the prayer floor`);
  }
  if (f === 'christian' && k !== 'temple-shrine') {
    ok(!L.placements.some(p => /^(confessional|pew)$/.test(p.id)), `${tag}: a confessional or a pew in a medieval church`);
    if (w * d >= 30) ok(L.placements.some(p => p.id === 'flavor-font'), `${tag}: no baptismal font`);
  }
  if (PRINT && seed === 1) console.log('\n--- ' + tag + '\n' + S.s2.summarize2(L));
}
console.log(`halls: ${rooms} faith halls solved (4 faiths x nave / cathedral / shrine x sizes x 4 seeds)`);
for (const [k, st] of Object.entries(stats)) console.log(`  ${k.padEnd(26)} ${String(st.n).padStart(3)} rooms, ${(st.mats / st.n).toFixed(1)} mats, ${(st.lamps / st.n).toFixed(1)} lamps | ${[...st.things].sort((a, b) => b[1] - a[1]).slice(0, 9).map(([i, n]) => `${i} ${(n / st.n).toFixed(1)}`).join(', ')}`);

// ---- grisly: no faith in a cult room; no grisly piece in any faith room
const GRISLY = /sacrific|blood|bone|skull|corpse|carcass|gore|torture|gibbet|^cage-|dagger-ritual|chalice-dark|candle-black|ritual-circle|portal-arch|grimoire|rite-sigil-stone|summon|tentacle|spider-|devil/;
const evilOnly = (t) => (t.flavors || []).length && t.flavors.every(x => sinister.has(x));
let barred = 0, dressed = 0;
for (const t of S.types.filter(t => t.flavors?.length)) for (const f of FAITHS) for (let seed = 1; seed <= 3; seed++) {
  const r = mk('r', t.key, 10, 10, ...t.cells, seed * 71 + 5, 1); r.flavor = f;
  const L = H.build([r]).solve('r'), tag = `${f} asked for ${t.key} seed ${r.seed}`, fl = L.placements.map(flavOf).filter(Boolean);
  if (evilOnly(t)) { barred++; ok(!fl.includes(f), `${tag}: a ${f} piece in a room only sinister factions dress`); }
  else { if (fl.includes(f)) dressed++; const g = L.placements.filter(p => GRISLY.test(p.id) || (flavOf(p) && sinister.has(flavOf(p)))); ok(!g.length, `${tag}: grisly pieces in a ${f} room: ${g.map(p => p.sku || p.id)}`); }
}
ok(dressed > 0, 'no faith room was dressed at all');
// the same through the opts flavor (the tuner's ?flavor=) and the classic engine's roll
for (const f of FAITHS) { const r = mk('r', 'cult-sanctum', 10, 10, 6, 9, 9, 1); const L = H.build([r]).solve('r', { flavor: f }); ok(!L.placements.map(flavOf).includes(f), `opts.flavor ${f} dressed a cult sanctum`); }
console.log(`grisly: ${barred} faith asks on cult / dark-cathedral rooms refused; ${dressed} faith rooms dressed with no grisly piece`);
H.report('faiths');

// "table" → "area" migration (Harry 2026-10-03): old campaigns on disk, old tokens, old wire names.
//   node engine/test/migrate.test.mjs            (also replays every campaign under engine/data, from its pre-rename
//                                                 originals when the live dir has already been migrated)
import { corpusDir } from './corpus.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CampaignRuntime } from '../relay/campaign.js';
import { migrateDataDir } from '../relay/migrate-areas.js';
import { makeTokens } from '../relay/tokens.js';
import { migrateMessage, migrateCommand, migrateRecord, migratePawns, DATA_FORMAT } from '../core/migrate.js';
import { applyArea } from '../core/commands.js';
import { stableStringify } from '../core/hash.js';

let checks = 0, fails = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } else if (process.env.V) console.log('ok', m); };
const quiet = () => {};
const HERE = path.dirname(fileURLToPath(import.meta.url));
const tokens = makeTokens('test-secret');
// /tmp is RAM-backed on the build box; un-reaped dirs from this test reached 12.5k / 4.3 GB of swap (2026-10-06).
const madeDirs = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-migrate-')); madeDirs.push(d); return d; };
process.on('exit', () => { for (const d of madeDirs) fs.rmSync(d, { recursive: true, force: true }); });
const load = (dir, id) => { const rt = new CampaignRuntime({ id, dir, tokens, log: quiet }); rt.load(); return rt; };
const copyDir = (from, to, pre = false) => {
  fs.mkdirSync(to, { recursive: true });
  for (const f of ['journal.jsonl', 'snapshot.json']) {
    const src = pre && fs.existsSync(path.join(from, f + '.pre-areas')) ? path.join(from, f + '.pre-areas') : path.join(from, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(to, f));
  }
};

// ---- a campaign written in the OLD names, by hand: tables, table.create, table.visibility, a `tables` LLM scope ----
const OLD = [
  { r: 1, at: 1, by: null, genesis: { id: 'cmp_oldform01', name: 'Old' }, fx: [] },
  { r: 2, at: 2, by: null, camp: { type: 'table.create', args: { id: 'tbl_oldmain01', name: 'Table 1', visibility: 'open' } }, fx: [] },
  { r: 3, at: 3, by: null, camp: { type: 'seat.create', args: { id: 'seat_oldgm001', kind: 'human', role: 'gm', name: 'Harry', location: 'tbl_oldmain01' } }, fx: [] },
  { r: 4, at: 4, by: 'seat_oldgm001', camp: { type: 'table.create', args: { id: 'tbl_oldvault1', name: 'Table 2', visibility: 'open' } }, fx: [] },
  { r: 5, at: 5, by: 'seat_oldgm001', camp: { type: 'table.visibility', args: { table: 'tbl_oldvault1', visibility: 'gm' } }, fx: [] },
  { r: 6, at: 6, by: 'seat_oldgm001', camp: { type: 'seat.create', args: { id: 'seat_oldllm01', kind: 'llm', name: 'Assistant', scope: { tables: '*', classes: ['token.move', 'object', 'table.admin'] } } }, fx: [] },
  { r: 7, at: 7, by: 'seat_oldgm001', cid: 'c_old1', fx: [{ table: 'tbl_oldmain01', seq: 1, type: 'object.place', args: { id: 'obj_oldcrate1', cat: 'crate', name: 'crate', x: 3, z: 4, dims: [2, 2, 2] }, inv: { type: 'entities.set', args: { set: { obj_oldcrate1: null } } } }] },
  { r: 8, at: 8, by: 'seat_oldgm001', cid: 'c_old2', camp: { type: 'seat.locate', args: { who: 'seat_oldgm001', table: 'tbl_oldvault1' } }, fx: [] },
];
{
  const dir = path.join(tmp(), 'cmp_oldform01'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'journal.jsonl'), OLD.map(r => JSON.stringify(r)).join('\n') + '\n');
  const before = load(dir, 'cmp_oldform01'); before.close();
  const s = before.state;
  ok(s.areas && !s.tables && s.areaOrder?.length === 2, 'an unmigrated journal loads as areas (backward-compatible read)');
  ok(s.areas.tbl_oldmain01.name === 'Area 1' && s.areas.tbl_oldvault1.visibility === 'gm', 'table.create / table.visibility replay; default "Table N" names read "Area N"');
  ok(s.areas.tbl_oldmain01.entities.obj_oldcrate1?.x === 3, 'an old fx {table, …} lands in its area');
  ok(s.seats.seat_oldgm001.location === 'tbl_oldvault1', 'old seat.locate {table} moves the seat');
  ok(s.seats.seat_oldllm01.scope.areas === '*' && s.seats.seat_oldllm01.scope.classes.includes('area.admin') && !('tables' in s.seats.seat_oldllm01.scope), 'an LLM scope {tables, table.admin} reads as {areas, area.admin}');

  // the one-shot rewrite, then the same state from the rewritten files
  const dir2 = path.join(tmp(), 'cmp_oldform01'); fs.mkdirSync(dir2, { recursive: true });
  fs.writeFileSync(path.join(dir2, 'journal.jsonl'), OLD.map(r => JSON.stringify(r)).join('\n') + '\n');
  const n = migrateDataDir(path.dirname(dir2), quiet);
  const text = fs.readFileSync(path.join(dir2, 'journal.jsonl'), 'utf8');
  ok(n === 1 && !/"table(s|\.create|\.visibility|\.admin)?"/.test(text) && /"area\.create"/.test(text), 'the one-shot migration rewrites the journal in the new names', text.slice(0, 80));
  ok(fs.existsSync(path.join(dir2, 'journal.jsonl.pre-areas')) && +fs.readFileSync(path.join(dir2, 'format'), 'utf8') === DATA_FORMAT, 'originals kept as *.pre-areas; the dir is marked format 2');
  ok(migrateDataDir(path.dirname(dir2), quiet) === 0, 'running it again changes nothing (idempotent)');
  const after = load(dir2, 'cmp_oldform01'); after.close();
  ok(stableStringify(after.state) === stableStringify(s), 'the migrated files load to exactly the state the old files read as');

  // a token minted for the OLD seat record (scope {tables: '*'}) still opens the migrated seat
  const oldSeat = { id: 'seat_oldllm01', kind: 'llm', creator: 'seat_oldgm001', scope: { tables: '*', classes: ['token.move', 'object', 'table.admin'] } };
  const oldTok = tokens.mint('cmp_oldform01', oldSeat), claims = tokens.verify(oldTok);
  ok(claims.sc.tables === '*' && tokens.matches(claims, 'cmp_oldform01', after.state.seats.seat_oldllm01), "an LLM seat's token minted before the rename still matches its (migrated) seat");
  ok(!tokens.matches(claims, 'cmp_oldform01', { ...after.state.seats.seat_oldllm01, scope: { areas: '*', classes: ['token.move'] } }), 'but not a seat whose scope really changed');
}

// ---- old wire names ----
ok(migrateMessage({ t: 'sub', table: 'tbl_x0000001' }).area === 'tbl_x0000001', 'an old client\'s {t:"sub", table} reads as area');
const mc = migrateMessage({ t: 'cmd', type: 'table.visibility', table: null, args: { table: 'tbl_x0000001', visibility: 'gm' } });
ok(mc.type === 'area.visibility' && mc.args.area === 'tbl_x0000001' && !('table' in mc.args), 'an old command message (type and args) reads in the new names');
ok(migrateCommand({ type: 'object.move', table: 'tbl_x0000001', args: { id: 'obj_a0000001', x: 1, z: 2 } }).area === 'tbl_x0000001', 'a GET/socket command {table} reads as {area}');

// ---- hit points -> damage (Harry 2026-10-06): a campaign written with hp / hpMax loads as damage ----
{
  const A1 = 'area_olddmg001', G = 'seat_olddmggm1';
  const recs = [
    { r: 1, at: 1, by: null, genesis: { id: 'cmp_olddmg0001', name: 'Old HP' }, fx: [] },
    { r: 2, at: 2, by: null, camp: { type: 'area.create', args: { id: A1, name: 'Area 1', visibility: 'open' } }, fx: [] },
    { r: 3, at: 3, by: null, camp: { type: 'seat.create', args: { id: G, kind: 'human', role: 'gm', name: 'Harry', location: A1 } }, fx: [] },
    { r: 4, at: 4, by: G, cid: 'c_h1', fx: [{ area: A1, seq: 1, type: 'token.create', args: { id: 'tok_oldhurt01', name: 'Brakka', x: 1, z: 1, hp: 20, hpMax: 20 }, inv: { type: 'entities.set', args: { set: { tok_oldhurt01: null } } } }] },
    { r: 5, at: 5, by: G, cid: 'c_h2', fx: [{ area: A1, seq: 2, type: 'token.create', args: { id: 'tok_oldnohp01', name: 'Cat', x: 2, z: 1 }, inv: { type: 'entities.set', args: { set: { tok_oldnohp01: null } } } }] },
    { r: 6, at: 6, by: G, cid: 'c_h3', fx: [{ area: A1, seq: 3, type: 'token.create', args: { id: 'tok_oldonly01', name: 'Ogre', x: 3, z: 1, hp: 50 }, inv: { type: 'entities.set', args: { set: { tok_oldonly01: null } } } }] },
    // the old HP buttons: token.set { hp } with the pawn as it was in the inverse
    { r: 7, at: 7, by: G, cid: 'c_h4', fx: [{ area: A1, seq: 4, type: 'token.set', args: { id: 'tok_oldhurt01', hp: 13 }, inv: { type: 'entities.set', args: { set: { tok_oldhurt01: { id: 'tok_oldhurt01', kind: 'token', name: 'Brakka', x: 1, z: 1, rot: 0, color: '#d9a441', owner: null, hp: 20, hpMax: 20, conditions: [], hidden: false, locked: false } } } } }] },
    { r: 8, at: 8, by: G, cid: 'c_h5', fx: [{ area: A1, seq: 5, type: 'batch', args: { ops: [{ type: 'token.set', args: { id: 'tok_oldonly01', hp: 41 } }, { type: 'token.set', args: { id: 'tok_oldhurt01', hp: 9, conditions: ['prone'] } }] }, inv: { type: 'entities.set', args: { set: {} } } }] },
  ];
  const dir = path.join(tmp(), 'cmp_olddmg0001'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'journal.jsonl'), recs.map(r => JSON.stringify(r)).join('\n') + '\n');
  const before = fs.readFileSync(path.join(dir, 'journal.jsonl'), 'utf8');
  const rt = load(dir, 'cmp_olddmg0001'), E = rt.state.areas[A1].entities;
  ok(E.tok_oldhurt01.damage === 11 && !('hp' in E.tok_oldhurt01) && !('hpMax' in E.tok_oldhurt01) && E.tok_oldhurt01.conditions[0] === 'prone', 'an old pawn at 9 of 20 hit points loads as 11 damage (max - hp), everything else on it kept');
  ok(!('damage' in E.tok_oldnohp01) && !('hp' in E.tok_oldnohp01) && E.tok_oldnohp01.name === 'Cat', 'a pawn that never had hit points loads unhurt, with no damage field');
  ok(E.tok_oldonly01.damage === 9 && !('hp' in E.tok_oldonly01), 'a pawn made with hp alone had its maximum set from it by the old code: 41 of 50 loads as 9 damage');
  ok(!/"hp(Max)?"/.test(JSON.stringify([[...rt.undo], [...rt.tails], [...rt.redo]])), 'the undo stack and the log tail in memory carry no hit points either');
  // undoing the oldest HP change still puts the pawn back as it was then: unhurt
  const u = rt.dispatch(G, { type: 'undo', area: A1, args: { seq: 4 } });
  ok(u.ok && !('damage' in rt.state.areas[A1].entities.tok_oldhurt01) && !('hp' in rt.state.areas[A1].entities.tok_oldhurt01), 'an undo recorded in the old form restores the pawn in the new form (20 of 20 = unhurt)');
  rt.close();
  const snap = fs.readFileSync(path.join(dir, 'snapshot.json'), 'utf8');
  ok(!/"hp(Max)?"/.test(snap) && /"damage":9/.test(snap), 'a snapshot in the new form is written at once; it has no hp in it');
  ok(fs.readFileSync(path.join(dir, 'journal.jsonl'), 'utf8').startsWith(before), 'the journal on disk is not rewritten: the old lines stay behind the snapshot');
  const again = load(dir, 'cmp_olddmg0001');
  ok(again.state.areas[A1].entities.tok_oldonly01.damage === 9 && !('damage' in again.state.areas[A1].entities.tok_oldhurt01) && migratePawns(again) === 0, 'loading again gives the same pawns and converts nothing more');
  const live = again.dispatch(G, { type: 'token.damage', area: A1, args: { id: 'tok_oldnohp01', damage: 4 } }), old = again.dispatch(G, { type: 'token.set', area: A1, args: { id: 'tok_oldnohp01', hp: 3 } });
  ok(live.ok && again.state.areas[A1].entities.tok_oldnohp01.damage === 4 && !old.ok && /damage now/.test(old.why), 'the migrated campaign takes token.damage, and refuses a live hp with the reason');
  again.close();
}

const live = corpusDir(); // the frozen corpus of real saved campaigns (test/corpus.mjs)
// ---- the pawn lock is dropped (Harry 2026-10-11): a campaign saved with a locked pawn loads with it unlocked ----
const lockedTokens = (x) => (JSON.stringify(x).match(/\{[^{}]*"kind":"token"[^{}]*\}/g) || []).filter(t => /"locked":true/.test(t)).length; // (a pawn has no nested objects before its lock)
const storedOf = (rt) => [[...rt.undo], [...rt.redo]];
{
  const A1 = 'area_oldlock01', G = 'seat_oldlockgm', P = 'seat_oldlockpl', id = 'tok_oldlock001';
  const tok = (locked) => ({ id, kind: 'token', name: 'Brakka', x: 1, z: 1, rot: 0, color: '#d9a441', owner: P, conditions: [], hidden: false, locked });
  const recs = [
    { r: 1, at: 1, by: null, genesis: { id: 'cmp_oldlock001', name: 'Old lock' }, fx: [] },
    { r: 2, at: 2, by: null, camp: { type: 'area.create', args: { id: A1, name: 'Area 1', visibility: 'open' } }, fx: [] },
    { r: 3, at: 3, by: null, camp: { type: 'seat.create', args: { id: G, kind: 'human', role: 'gm', name: 'Harry', location: A1 } }, fx: [] },
    { r: 4, at: 4, by: G, camp: { type: 'seat.create', args: { id: P, kind: 'human', role: 'player', name: 'Mira', location: A1 } }, fx: [] },
    { r: 5, at: 5, by: G, cid: 'c_l1', fx: [{ area: A1, seq: 1, type: 'token.create', args: { id, name: 'Brakka', x: 1, z: 1, owner: P }, inv: { type: 'entities.set', args: { set: { [id]: null } } } }] },
    { r: 6, at: 6, by: G, cid: 'c_l2', fx: [{ area: A1, seq: 2, type: 'object.place', args: { id: 'obj_oldlock001', cat: 'crate', name: 'crate', x: 8, z: 8, dims: [2, 2, 2] }, inv: { type: 'entities.set', args: { set: { obj_oldlock001: null } } } }] },
    // the old ring's Lock, on the pawn and on a crate; Unlock (its inverse holds the pawn LOCKED); Lock again
    { r: 7, at: 7, by: G, cid: 'c_l3', fx: [{ area: A1, seq: 3, type: 'entity.flag', args: { ids: [id], locked: true }, inv: { type: 'entities.set', args: { set: { [id]: tok(false) } } } }] },
    { r: 8, at: 8, by: G, cid: 'c_l4', fx: [{ area: A1, seq: 4, type: 'entity.flag', args: { ids: ['obj_oldlock001'], locked: true }, inv: { type: 'entity.flag', args: { ids: ['obj_oldlock001'], locked: false } } }] },
    { r: 9, at: 9, by: G, cid: 'c_l5', fx: [{ area: A1, seq: 5, type: 'entity.flag', args: { ids: [id], locked: false }, inv: { type: 'entities.set', args: { set: { [id]: tok(true) } } } }] },
    { r: 10, at: 10, by: G, cid: 'c_l6', fx: [{ area: A1, seq: 6, type: 'entity.flag', args: { ids: [id], locked: true }, inv: { type: 'entities.set', args: { set: { [id]: tok(false) } } } }] },
  ];
  const write = (name, extra = null) => { const dir = path.join(tmp(), name); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'journal.jsonl'), recs.map(r => JSON.stringify(r)).join('\n') + '\n'); if (extra) extra(dir); return dir; };
  // (1) from the journal alone
  const dir = write('cmp_oldlock001'), before = fs.readFileSync(path.join(dir, 'journal.jsonl'), 'utf8');
  const rt = load(dir, 'cmp_oldlock001'), E = () => rt.state.areas[A1].entities;
  ok(E()[id].locked === false && E().obj_oldlock001.locked === true, 'a pawn the journal leaves locked loads unlocked; the crate locked beside it stays locked');
  ok(lockedTokens(storedOf(rt)) === 0, 'no stored undo or redo step holds the pawn locked either');
  const mv = rt.dispatch(P, { type: 'token.move', area: A1, args: { id, x: 6, z: 7 } });
  ok(mv.ok && E()[id].x === 6, 'its owner, a player, moves it (the old core refused: "Brakka is locked")', JSON.stringify(mv));
  const u = rt.dispatch(G, { type: 'undo', area: A1, args: { seq: 5 } });
  ok(E()[id].locked === false, 'undoing the old Unlock (whose stored inverse held the pawn locked) does not lock it again', JSON.stringify(u));
  const again = rt.dispatch(G, { type: 'entity.flag', area: A1, args: { ids: [id], locked: true } });
  ok(!again.ok && /cannot be locked/.test(again.why) && E()[id].locked === false, 'and the relay refuses a live lock on a pawn, with the reason', JSON.stringify(again));
  ok(/locked/.test(rt.dispatch(G, { type: 'object.move', area: A1, args: { id: 'obj_oldlock001', x: 1, z: 1 } }).why || ''), 'the crate is still locked: things keep their lock');
  rt.close();
  ok(fs.readFileSync(path.join(dir, 'journal.jsonl'), 'utf8').startsWith(before), 'the journal on disk is not rewritten');
  const re = load(dir, 'cmp_oldlock001'); ok(re.state.areas[A1].entities[id].locked === false && lockedTokens([re.state, storedOf(re)]) === 0 && migratePawns(re) === 0, 'loading again: still unlocked, nothing more to convert'); re.close();
  // (2) from a SNAPSHOT written while the pawn was locked (the state and the undo stack both hold it locked; no journal lines to replay)
  const snapState = JSON.parse(JSON.stringify(re.state)); snapState.areas[A1].entities[id].locked = true;
  const dir2 = write('cmp_oldlock002', (d) => { fs.writeFileSync(path.join(d, 'journal.jsonl'), ''); fs.writeFileSync(path.join(d, 'snapshot.json'), JSON.stringify({ format: DATA_FORMAT, r: re.r, state: { ...snapState, id: 'cmp_oldlock002' }, undo: [[A1, [{ seq: 5, by: G, inv: { type: 'entities.set', args: { set: { [id]: tok(true) } } } }]]], redo: [[`${A1}|${G}`, [{ inv: { type: 'batch', args: { ops: [{ type: 'entities.set', args: { set: { [id]: tok(true) } } }] } } }]]], nonces: [], tails: [[A1, []]] })); });
  let rs = null; try { rs = load(dir2, 'cmp_oldlock002'); } catch (e) { ok(false, `a snapshot holding a locked pawn loads (${e.message})`); }
  if (rs) {
    ok(rs.state.areas[A1].entities[id].locked === false && lockedTokens([rs.state, storedOf(rs)]) === 0 && migratePawns.last, 'a snapshot that holds the pawn locked (state, undo and redo) loads with it unlocked everywhere');
    const m2 = rs.dispatch(P, { type: 'token.move', area: A1, args: { id, x: 3, z: 3 } });
    ok(m2.ok, 'and its owner moves it', JSON.stringify(m2));
    rs.close();
    ok(lockedTokens(JSON.parse(fs.readFileSync(path.join(dir2, 'snapshot.json'), 'utf8'))) === 0, 'the snapshot written at that load has no locked pawn in it');
  }
}
// ---- the same against THE CORPUS: every real campaign that ever said "locked": true, read by the code as it stood
// before the cut (main at 51d6988, taken from git) and by the code now. Where the old code reads a locked pawn (in play
// or in a stored undo / redo step) today's code must read it unlocked, and the two states must otherwise be identical.
{
  const { execFileSync } = await import('node:child_process');
  const BASE = '51d6988', old = path.join(HERE, '..', 'node_modules', '.cache', `tw-pre-pawnlock-${BASE}`);
  let Old = null;
  try {
    if (!fs.existsSync(path.join(old, 'relay', 'campaign.js'))) {
      fs.mkdirSync(old, { recursive: true });
      const tar = execFileSync('git', ['-C', path.join(HERE, '..'), 'archive', BASE, 'core', 'relay'], { maxBuffer: 1 << 28 });
      execFileSync('tar', ['-x', '-C', old], { input: tar });
    }
    Old = (await import(path.join(old, 'relay', 'campaign.js'))).CampaignRuntime;
  } catch (e) { console.log(`  (the code before the pawn-lock cut is not available from git: ${e.message.split('\n')[0]}; comparison skipped)`); }
  const dirs = fs.existsSync(live) ? fs.readdirSync(live).filter(d => d.startsWith('cmp_')) : [];
  let said = 0, camps = 0, pawns = 0, wasLocked = 0, wasStored = 0, withAny = 0, flags = 0;
  for (const d of Old ? dirs : []) {
    const text = ['journal.jsonl', 'snapshot.json'].map(f => { try { return fs.readFileSync(path.join(live, d, f), 'utf8'); } catch { return ''; } }).join('\n');
    if (!/"locked":true/.test(text)) continue; // a campaign that never locked anything: the lock code cannot touch it
    said++;
    const a = path.join(tmp(), d), b = path.join(tmp(), d);
    copyDir(path.join(live, d), a); copyDir(path.join(live, d), b);
    let A, B;
    try { A = new Old({ id: d, dir: a, tokens, log: quiet }); A.load(); A.close(); } catch (e) { ok(false, `${d}: loads with the code before the cut (${e.message})`); continue; }
    try { B = load(b, d); B.close(); } catch (e) { ok(false, `${d}: loads with today's code (${e.message})`); continue; }
    camps++;
    const inPlay = lockedTokens(A.state), stored = lockedTokens(storedOf(A));
    for (const T of Object.values(A.state.areas)) for (const e of Object.values(T.entities)) if (e.kind === 'token') pawns++;
    wasLocked += inPlay; wasStored += stored; if (inPlay || stored) withAny++;
    flags += (text.match(/"entity\.flag","args":\{[^}]*"locked":true/g) || []).length;
    ok(lockedTokens([B.state, storedOf(B)]) === 0, `${d}: no pawn is locked after loading, in play or in a stored step (before: ${inPlay} in play, ${stored} stored)`);
    migratePawns(A); // the old read, with the same conversion: everything else must be byte for byte the same
    ok(stableStringify(A.state) === stableStringify(B.state) && A.r === B.r && stableStringify(storedOf(A)) === stableStringify(storedOf(B)), `${d} ("${B.state.name}"): apart from pawn locks, loads byte-identical before and after the cut`);
    // every stored step that held a locked pawn, applied by today's reducers, leaves that pawn unlocked
    for (const [key, list] of [...A.undo, ...A.redo]) for (const it of list) if (lockedTokens(it.inv)) {
      const area = String(key).split('|')[0], T = B.state.areas[area]; if (!T) continue;
      let out = null; try { out = applyArea(T, it.inv.type, it.inv.args); } catch (e) { ok(false, `${d}: a stored step applies (${e.message})`); continue; }
      ok(lockedTokens(out) === 0, `${d}: a stored ${it.inv.type} that held a locked pawn, applied now, leaves it unlocked`);
    }
  }
  if (Old) {
    ok(dirs.length === 0 || said > 0, `the corpus has campaigns that used a lock (${said} of ${dirs.length})`);
    console.log(`  (pawn lock, corpus: ${dirs.length} campaigns; ${said} ever wrote "locked": true (${flags} lock commands, on things and pawns), ${camps} of them loaded both ways with ${pawns} pawns; the code before the cut read ${wasLocked} pawns locked in play and ${wasStored} locked in stored undo / redo steps (${withAny} campaigns); today's code reads 0 and 0)`);
  }
}

// ---- every real campaign under engine/data: old read == migrated read ----
let n = 0;
for (const d of fs.existsSync(live) ? fs.readdirSync(live).filter(d => d.startsWith('cmp_')) : []) {
  const a = path.join(tmp(), d), b = path.join(tmp(), d);
  copyDir(path.join(live, d), a, true); copyDir(path.join(live, d), b, true);
  let A, B;
  try { A = load(a, d); A.close(); } catch (e) { ok(false, `${d}: old files load (${e.message})`); continue; }
  migrateDataDir(path.dirname(b), quiet);
  try { B = load(b, d); B.close(); } catch (e) { ok(false, `${d}: migrated files load (${e.message})`); continue; }
  ok(stableStringify(A.state) === stableStringify(B.state) && A.r === B.r && !B.state.tables, `${d}: migrated read equals the backward-compatible read (r=${B.r})`);
  n++;
}
console.log(`  (${n} real campaigns replayed both ways)`);

// ---- storeys (2026-10-05): NOBODY'S SAVED CAMPAIGN CHANGES. Every real campaign under engine/data is loaded twice: by
// the code as it stood before storeys (commit ee461e8, taken from git into node_modules/.cache) and by the code now.
// The two states must be byte-identical, every stored wall key must still parse, and every edge id must be unchanged.
{
  const { execFileSync } = await import('node:child_process');
  const { EDGE_KEY_RE, edgeId } = await import('../core/commands.js');
  const BASE = 'ee461e8', old = path.join(HERE, '..', 'node_modules', '.cache', `tw-pre-storeys-${BASE}`);
  let Old = null;
  try {
    if (!fs.existsSync(path.join(old, 'relay', 'campaign.js'))) {
      fs.mkdirSync(old, { recursive: true });
      const tar = execFileSync('git', ['-C', path.join(HERE, '..'), 'archive', BASE, 'core', 'relay'], { maxBuffer: 1 << 28 });
      execFileSync('tar', ['-x', '-C', old], { input: tar });
    }
    Old = (await import(path.join(old, 'relay', 'campaign.js'))).CampaignRuntime;
  } catch (e) { console.log(`  (pre-storeys code not available from git: ${e.message.split('\n')[0]}; comparison skipped)`); }
  let same = 0, dawn = 0, keys = 0, skipped = 0, pawns = 0, hurt = 0, fromHp = 0, already = 0, journals = 0, jpawns = 0, jhurt = 0;
  // the rule, written out here on its own (not imported): damage = hpMax - hp where a pawn has both; a pawn already in the new form carries its damage
  const damageByRule = (e) => 'hp' in e || 'hpMax' in e ? (Number.isFinite(e.hp) && Number.isFinite(e.hpMax) ? Math.max(0, e.hpMax - e.hp) : 0) : (e.damage || 0);
  for (const d of Old && fs.existsSync(live) ? fs.readdirSync(live).filter(d => d.startsWith('cmp_')) : []) {
    const a = path.join(tmp(), d), b = path.join(tmp(), d);
    copyDir(path.join(live, d), a); copyDir(path.join(live, d), b);
    let A, B;
    try { B = load(b, d); B.close(); } catch (e) { ok(false, `${d}: loads with today's code (${e.message})`); continue; }
    // (a campaign made after storeys may use commands the old code never had, e.g. room.tall: the old code cannot read it; left out, and counted)
    try { A = new Old({ id: d, dir: a, tokens, log: quiet }); A.load(); A.close(); } catch (e) { skipped++; continue; }
    // (a campaign that USES height, made after storeys, cannot be read by the old code: left out, and counted)
    const tall = Object.values(B.state.areas).some(T => Object.values(T.entities).some(e => (e.kind === 'room' && (e.recipe.y || e.recipe.tall)) || (e.kind === 'building' && (e.base || e.storey)) || (e.kind === 'edge' && e.key.includes('@')) || (e.kind === 'edge' && e.hidden) || (e.kind === 'token' && e.y < 0)));
    if (tall) { skipped++; continue; }
    // (hit points became damage on 2026-10-06: today's code converts every old pawn on load. That is checked on its own,
    // below and here: each pawn's damage is worked out independently from what the OLD code read, then the same
    // conversion is applied to the old read so the rest of the state can still be compared byte for byte.)
    // (since the live relay converted its campaigns, 2026-10-06 17:38, a snapshot on disk already says `damage` and has
    // no hp: the old code reads that pawn through untouched, so the number to expect is the one it carries. A pawn the
    // old code still reads WITH hit points is worked out by the rule. Both forms are right; they are counted apart.)
    for (const [aid, T] of Object.entries(A.state.areas)) for (const e of Object.values(T.entities)) if (e.kind === 'token') {
      const oldForm = 'hp' in e || 'hpMax' in e;
      const want = damageByRule(e), got = B.state.areas[aid]?.entities[e.id];
      pawns++; if (want) hurt++; if (oldForm) fromHp++; else already++;
      if (!got || (got.damage || 0) !== want || 'hp' in got || 'hpMax' in got) ok(false, `${d}: pawn ${e.id} (${oldForm ? `hp ${e.hp}/${e.hpMax}` : `damage ${e.damage || 0} on disk`}) reads as ${want} damage with no hp left`);
    }
    // THE JOURNAL IS THE RECORD (it is never rewritten). Where a campaign's journal never speaks of damage (nothing has
    // been written to it in the new form), replaying the journal ALONE, with no snapshot, gives every pawn's hit points
    // as they were; the rule applied to those must give exactly what is on disk now, converted or not.
    const jtext = fs.existsSync(path.join(live, d, 'journal.jsonl')) ? fs.readFileSync(path.join(live, d, 'journal.jsonl'), 'utf8') : '';
    if (jtext && !/"damage"|token\.damage/.test(jtext)) {
      const J = new CampaignRuntime({ id: d, dir: path.join(tmp(), d), tokens, log: quiet });
      try { for (const line of jtext.split('\n').filter(Boolean)) J.applyRecord(migrateRecord(JSON.parse(line))); J.journal.close(); } catch (e) { ok(false, `${d}: the journal replays alone (${e.message})`); continue; }
      journals++;
      for (const [aid, T] of Object.entries(J.state.areas)) for (const e of Object.values(T.entities)) if (e.kind === 'token') {
        const want = damageByRule(e), got = B.state.areas[aid]?.entities[e.id];
        jpawns++; if (want) jhurt++;
        if (!got || (got.damage || 0) !== want) ok(false, `${d}: pawn ${e.id} is hp ${e.hp}/${e.hpMax} by its journal = ${want} damage, but loads as ${got ? got.damage || 0 : 'nothing'}`);
      }
    }
    migratePawns(A);
    const identical = stableStringify(A.state) === stableStringify(B.state) && A.r === B.r;
    if (!identical || B.state.name === 'Dawnhaven') ok(identical, `${d} ("${B.state.name}"): loads byte-identical before and after storeys`);
    if (identical) same++; if (B.state.name === 'Dawnhaven' && identical) dawn++;
    for (const T of Object.values(B.state.areas)) for (const e of Object.values(T.entities)) {
      if (e.kind === 'edge') { keys++; if (!EDGE_KEY_RE.test(e.key) || edgeId(e.key) !== e.id) ok(false, `${d}: wall key ${e.key} still parses and keeps its id ${e.id}`); }
    }
  }
  if (Old) { ok(pawns > 0, `every old pawn in the real campaigns reads as damage (${pawns} pawns, ${hurt} of them hurt)`); console.log(`  (${pawns} real pawns read as damage, ${hurt} with damage above 0: ${fromHp} worked out from hit points, ${already} already converted on disk)`);
    ok(journals > 0 && jpawns > 0, `journals replayed alone agree with what is on disk (${journals} campaigns, ${jpawns} pawns, ${jhurt} hurt)`); console.log(`  (${journals} journals replayed alone, with no snapshot: ${jpawns} pawns, ${jhurt} hurt, by the old rule equal what loads today)`); }
  if (Old) { ok(same > 0 && dawn > 0, `the corpus's campaigns named "Dawnhaven" load unchanged (${dawn}; that was the start form's prefilled name until 2026-10-06, so most are test runs that took it)`); console.log(`  (${same} real campaigns byte-identical before and after storeys, ${dawn} named "Dawnhaven", ${keys} stored wall keys parse${skipped ? `; ${skipped} campaigns that use height left out` : ''})`); }
}
console.log(`migrate: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);

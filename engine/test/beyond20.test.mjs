// Beyond20 intake (2026-10-29; docs/BEYOND20.md): the pure rules (core/beyond20.js) on messages shaped exactly as
// Beyond20 sends them (its src/common/dice.js toJSON and roll_renderer.js postDescription), and the relay: a dice.roll
// can carry what a roll was (`info`), and NO description, spell or feature text ever reaches the journal on disk.
//   node engine/test/beyond20.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import * as B from '../core/beyond20.js';
import { parseArgs, checkCommand } from '../core/commands.js';
import { startRelay } from '../relay/server.js';
import { ClientSync } from '../core/client-sync.js';
import { wsTransport } from '../core/transport.js';

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra === undefined ? '' : JSON.stringify(extra)); } else if (process.env.V) console.log('ok', m); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { } await sleep(20); } return false; }

// ---- Beyond20's shapes (DNDBDice.toJSON, Beyond20BaseRoll.toJSON) ----
const die = (faces, rolls, modifiers = '') => ({ total: rolls.filter(r => !r.discarded).reduce((a, r) => a + r.roll, 0), formula: `${rolls.length}d${faces}${modifiers}`, rolls, amount: rolls.length, faces, modifiers });
const roll = (parts, { type = 'to-hit', discarded = false, crit = false, fumble = false, total = null, formula = null } = {}) => {
  let t = 0, add = true; for (const p of parts) { if (p === '+' || p === '-') add = p === '+'; else { const v = typeof p === 'number' ? p : p.total; t += add ? v : -v; } }
  return { formula: formula || parts.map(p => typeof p === 'object' ? p.formula : p).join(' '), parts, 'fail-limit': null, 'critical-limit': null, 'critical-failure': fumble, 'critical-success': crit, discarded, type, total: total ?? t };
};
const SECRET = 'SECRET-DESCRIPTION-7f3a';
const character = { name: 'Brakka Stonefist', type: 'Character', url: 'https://www.dndbeyond.com/characters/1111', id: '1111', source: 'D&D Beyond', hp: 21, 'max-hp': 30, 'temp-hp': 0, conditions: ['Prone'], 'class-features': [SECRET], feats: [SECRET], actions: [SECRET] };
const rendered = (request, attack_rolls = [], damage_rolls = [], more = {}) => ({ action: 'rendered-roll', rendered: 'fallback', request: { action: 'roll', character, whisper: 0, advantage: 0, ...request }, title: request.name || 'Roll', html: `<div class="beyond20-message">${SECRET}</div>`, character: character.name, whisper: 0, play_sound: true, source: SECRET, attributes: { Range: SECRET }, description: SECRET, attack_rolls, roll_info: [['Effects', SECRET]], damage_rolls, total_damages: {}, open: false, ...more });

// ---- 1. one roll -> TW's dice ----
{
  const t = B.twRoll(roll([die(20, [{ roll: 14 }]), '+', 5]));
  ok(t.expr === 'd20+5' && JSON.stringify(t.rolls) === '[14]' && t.total === 19, 'a plain d20+5', t);
  const k = B.twRoll(roll([die(6, [{ roll: 1, discarded: true }, { roll: 4 }, { roll: 5 }, { roll: 6 }], 'kh3')], { type: 'custom' }));
  ok(k.expr === '4d6kh3' && k.rolls.length === 4 && k.total === 15 && !k.formula, 'keep-highest stays keep-highest (all four dice thrown)', k);
  const rr = B.twRoll(roll([die(20, [{ roll: 1, discarded: true }, { roll: 13 }], 'ro<=1'), '+', 2]));
  ok(rr.expr === 'd20+2' && JSON.stringify(rr.rolls) === '[13]' && rr.total === 15 && /ro<=1/.test(rr.formula), 'a reroll TW cannot say: the die that counts, Beyond20\'s formula kept', rr);
  const mn = B.twRoll(roll([die(20, [{ roll: 3 }], 'min10'), '+', 4], { total: 14 }));
  ok(mn.expr === 'd20+4' && mn.total === 14 && JSON.stringify(mn.rolls) === '[3]', 'minimum 10: the total is Beyond20\'s (authoritative), the die reads what it rolled', mn);
  const neg = B.twRoll(roll([die(8, [{ roll: 5 }]), '-', 1], { type: 'damage' }));
  ok(neg.expr === 'd8-1' && neg.total === 4, 'a minus', neg);
}
// ---- 2. advantage: two whole Rolls, one discarded -> one throw "d20+5 adv" ----
{
  const a = roll([die(20, [{ roll: 17 }]), '+', 5]), b = roll([die(20, [{ roll: 4 }]), '+', 5], { discarded: true });
  const [x] = B.twD20s([a, b], 3);
  ok(x && x.expr === 'd20+5 adv' && JSON.stringify(x.rolls) === '[17,4]' && x.total === 22 && x.adv === 'adv', 'advantage is one throw of two d20s', x);
  const c = roll([die(20, [{ roll: 17 }]), '+', 5], { discarded: true }), d = roll([die(20, [{ roll: 4 }]), '+', 5]);
  const [y] = B.twD20s([c, d], 4);
  ok(y && y.expr === 'd20+5 dis' && y.total === 9 && y.adv === 'dis', 'disadvantage', y);
  const s3 = B.twD20s([roll([die(20, [{ roll: 3 }]), '+', 1], { discarded: true }), roll([die(20, [{ roll: 19 }]), '+', 1]), roll([die(20, [{ roll: 8 }]), '+', 1], { discarded: true })], 6);
  ok(s3.length === 1 && s3[0].expr === '3d20kh1+1' && s3[0].total === 20 && s3[0].adv === 'super-adv', 'super advantage', s3);
  const both = B.twD20s([roll([die(20, [{ roll: 11 }]), '+', 2]), roll([die(20, [{ roll: 6 }]), '+', 2])], 1);
  ok(both.length === 2 && both.every(r => r.adv === 'double'), '"roll twice, show both": two rolls', both);
  const crit = B.twD20s([roll([die(20, [{ roll: 20 }]), '+', 5], { crit: true })], 0);
  ok(crit[0].crit === true && !crit[0].adv, 'a natural 20 says crit', crit);
}
// ---- 3. whole messages ----
{
  const m = rendered({ type: 'attack', name: 'Longsword', description: SECRET, 'to-hit': '+5', damages: ['1d8+3', '1d6'], 'damage-types': ['Slashing', 'Fire'], 'critical-damages': ['1d8'], 'critical-damage-types': ['Slashing'], rollAttack: true, rollDamage: true, advantage: 3, properties: ['Versatile'], 'attack-source': 'item', 'attack-type': 'Melee' },
    [roll([die(20, [{ roll: 15 }]), '+', 5]), roll([die(20, [{ roll: 9 }]), '+', 5], { discarded: true })],
    [['Slashing', roll([die(8, [{ roll: 6 }]), '+', 3], { type: 'damage' }), 1], ['Fire', roll([die(6, [{ roll: 2 }])], { type: 'damage' }), 4], ['2-Handed Slashing', roll([die(10, [{ roll: 7 }]), '+', 3], { type: 'damage' }), 2], [SECRET, '', 0]]);
  const r = B.fromRendered(m);
  ok(r.char.key === 'characters/1111' && r.kind === 'attack' && r.name === 'Longsword', 'the character and the roll', r.char);
  ok(r.specs.length === 3, 'to hit, damage (regular + additional in one throw), the two-handed alternative', r.specs.map(s => s.expr));
  ok(r.specs[0].expr === 'd20+5 adv' && r.specs[0].info.part === 'to-hit' && r.specs[0].info.adv === 'adv', 'to hit', r.specs[0]);
  ok(r.specs[1].expr === 'd8+3+d6' && r.specs[1].total === 11 && JSON.stringify(r.specs[1].info.types) === '["Slashing","Fire"]' && !r.specs[1].info.alt, 'damage: one throw, its total the sum', r.specs[1]);
  ok(r.specs[2].info.alt === 'two-handed' && r.specs[2].total === 10, 'versatile two-handed is its own throw', r.specs[2]);
  ok(r.attack && r.attack.hit === '+5' && r.attack.damages.length === 2 && B.hitExpr(r.attack) === 'd20+5' && B.damageExpr(r.attack) === 'd8+3+d6', 'the attack is remembered as numbers and dice', r.attack);
  const all = JSON.stringify(r);
  ok(!all.includes(SECRET), 'NOTHING of the description, html, roll_info, source, attributes, features or a damage message is in what crosses', all.slice(0, 300));
  ok(r.specs.every(s => !B.infoProblem(s.info)), 'every info passes the relay\'s check');
  const sk = B.fromRendered(rendered({ type: 'skill', skill: 'Stealth', ability: 'DEX', modifier: '+4', advantage: 0 }, [roll([die(20, [{ roll: 12 }]), '+', 4], { type: 'skill-check' })]));
  ok(sk.name === 'Stealth' && sk.specs.length === 1 && sk.specs[0].info.part === 'check' && sk.specs[0].total === 16, 'a skill check', sk.specs);
  const ini = B.fromRendered(rendered({ type: 'initiative', initiative: '+2' }, [roll([die(20, [{ roll: 18 }]), '+', 2], { type: 'initiative' })]));
  ok(ini.init === 20 && ini.specs[0].info.part === 'initiative', 'initiative -> its number', ini.init);
  const save = B.fromRendered(rendered({ type: 'saving-throw', name: 'Dexterity', ability: 'DEX', modifier: '+4' }, [roll([die(20, [{ roll: 5 }]), '+', 4])]));
  ok(save.name === 'Dexterity save', 'a save is named', save.name);
  const card = B.fromRendered(rendered({ type: 'spell-card', name: 'Fireball', description: SECRET, 'level-school': '3rd Level Evocation' }));
  ok(card.kind === null && card.specs.length === 0 && !JSON.stringify(card).includes(SECRET), 'a spell card carries no dice: nothing of it crosses');
  const trait = B.fromRendered(rendered({ type: 'trait', name: 'Second Wind', description: SECRET }));
  ok(trait.specs.length === 0, 'a trait: nothing');
  const heal = B.fromRendered(rendered({ type: 'spell-attack', name: 'Cure Wounds', description: SECRET, damages: ['1d8+3'], 'damage-types': ['Healing'], rollDamage: true }, [], [['Healing', roll([die(8, [{ roll: 5 }]), '+', 3], { type: 'damage' }), 8]]));
  ok(heal.specs.length === 1 && heal.specs[0].info.part === 'healing' && heal.specs[0].total === 8, 'healing is its own throw', heal.specs);
  const tbl = B.fromRendered(rendered({ type: 'roll-table', name: 'Wild Magic', formula: '1d100', table: { Effect: { '1-2': SECRET } } }, [roll([die(100, [{ roll: 37 }])], { type: 'custom' })]));
  ok(tbl.specs.length === 1 && tbl.specs[0].expr === 'd100' && !JSON.stringify(tbl).includes(SECRET), 'a roll table: its die, never its contents', tbl.specs);
}
// ---- 4. sheets, HP, conditions ----
ok(B.sheetKey('https://www.dndbeyond.com/characters/1111') === 'characters/1111', 'sheet link');
ok(B.sheetKey('https://www.dndbeyond.com/profile/Someone/characters/42/') === 'characters/42', 'profile sheet link');
ok(B.sheetKey('https://ddb.ac/characters/42/AbCd') === 'characters/42', 'short share link');
ok(B.sheetKey('https://www.dndbeyond.com/monsters/16907-goblin') === 'monsters/16907', 'a monster page');
ok(B.sheetKey('https://evil.example/www.dndbeyond.com/characters/1') === null && B.sheetKey('javascript:alert(1)') === null, 'other sites are not D&D Beyond');
ok(B.damageFromHP(21, 30) === 9 && B.damageFromHP(35, 30) === 0 && B.damageFromHP(null, 30) === null && B.damageFromHP(5, 0) === null, 'damage = max - current, never below 0');
ok(JSON.stringify(B.conditionsAfter(['prone', 'hasted', 'stunned'], ['Poisoned', 'Prone', 'Paralyzed'])) === '["prone","hasted","poisoned","paralyzed"]', 'conditions: D&D Beyond\'s wins for its own words; other words stay; nothing is dropped (2026-10-29)', B.conditionsAfter(['prone', 'hasted', 'stunned'], ['Poisoned', 'Prone', 'Paralyzed']));
// ---- 5. the relay's check on dice.roll info ----
ok(B.infoProblem({ description: 'x' }) && B.infoProblem({ name: 'x'.repeat(61) }) && B.infoProblem({ kind: 'spell-card' }) && B.infoProblem({ types: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }) && B.infoProblem({ html: '<b>' }) && B.infoProblem({ name: '<script>' }), 'info refuses any other field, long text, unknown kinds, markup');
ok(B.infoProblem(null) === null && B.infoProblem({ src: 'tw', name: 'Longsword', target: 'Goblin 2', part: 'to-hit', crit: true }) === null, 'info accepts what a roll was');
{
  const p = parseArgs('dice.roll', { id: 'msg_b20aaa0001', expr: 'd20+5', rolls: [12], total: 17, description: SECRET, html: SECRET, info: { name: 'Longsword' } });
  ok(!p.error && !JSON.stringify(p.args).includes(SECRET), 'a field dice.roll does not know (description, html) is never even parsed', p);
}

// ---- 6. through a real relay, onto disk ----
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-b20-'));
process.on('exit', () => fs.rmSync(dataDir, { recursive: true, force: true }));
const relay = await startRelay({ port: 0, dataDir, log: () => { } });
const C = await fetch(`http://127.0.0.1:${relay.port}/campaigns`, { method: 'POST', body: JSON.stringify({ name: 'Beyond20 test', gm: 'Harry' }) }).then(r => r.json());
const nacks = [], acks = [];
const gm = new ClientSync({ token: C.token, transport: wsTransport(`ws://127.0.0.1:${relay.port}/ws`, WebSocket), onNack: (m) => nacks.push(m), onAck: (m) => acks.push(m), onPresence: () => { }, onCampaign: () => { } });
gm.connect();
await waitFor(() => gm.status === 'live'); gm.subscribe(C.area); await waitFor(() => gm.view(C.area));
const spec = B.fromRendered(rendered({ type: 'attack', name: 'Longsword', description: SECRET, 'to-hit': '+5', damages: ['1d8+3'], 'damage-types': ['Slashing'], rollAttack: true, rollDamage: true }, [roll([die(20, [{ roll: 14 }]), '+', 5])], [['Slashing', roll([die(8, [{ roll: 6 }]), '+', 3], { type: 'damage' }), 1]])).specs[0];
gm.submit('dice.roll', { id: 'msg_b20good001', expr: spec.expr, rolls: spec.rolls, total: spec.total, why: 'Brakka · Longsword to hit', info: spec.info }, C.area);
await waitFor(() => (gm.view(C.area).chat || []).some(c => c.id === 'msg_b20good001') && gm.pendingCount() === 0);
const line = (gm.view(C.area).chat || []).find(c => c.id === 'msg_b20good001');
ok(line && line.roll.info?.name === 'Longsword' && line.roll.info.part === 'to-hit' && line.roll.total === 19, 'the line keeps what the roll was', line);
// a hand-made command: the description in info is refused; at the top level it is dropped
gm.submit('dice.roll', { id: 'msg_b20bad0001', expr: 'd20', rolls: [3], total: 3, info: { name: 'Fireball', description: SECRET } }, C.area);
gm.submit('dice.roll', { id: 'msg_b20bad0002', expr: 'd20', rolls: [4], total: 4, description: SECRET, html: SECRET, title: SECRET }, C.area);
gm.submit('dice.roll', { id: 'msg_b20bad0003', expr: 'd20', rolls: [5], total: 5, info: { name: SECRET.repeat(4) } }, C.area);
await waitFor(() => gm.pendingCount() === 0, 4000);
await sleep(200);
ok(nacks.some(n => /no field "description"/.test(n.why || '')), 'the relay refuses info with a description', nacks.map(n => n.why));
ok(nacks.some(n => /info\.name/.test(n.why || '')), 'the relay refuses a name that is a paragraph', nacks.map(n => n.why));
ok((gm.view(C.area).chat || []).some(c => c.id === 'msg_b20bad0002'), 'a roll with stray top-level fields still goes (those fields are dropped)');
// an old-style roll (no info) is unchanged
gm.submit('dice.roll', { id: 'msg_b20old0001', expr: 'd20+1', rolls: [9], total: 10, why: 'old' }, C.area);
await waitFor(() => (gm.view(C.area).chat || []).some(c => c.id === 'msg_b20old0001'));
const old = (gm.view(C.area).chat || []).find(c => c.id === 'msg_b20old0001');
ok(old && !('info' in old.roll) && old.text === 'old', 'a roll without info reads exactly as before', old);
// ---- 7. a pawn's target (2026-10-29): set, clear, never itself, never a missing pawn; old pawns have none ----
gm.submit('batch', { ops: [{ type: 'token.create', args: { id: 'tok_b20att0001', name: 'Thorin', x: 5, z: 5 } }, { type: 'token.create', args: { id: 'tok_b20tgt0001', name: 'Goblin 1', x: 10, z: 5 } }, { type: 'token.create', args: { id: 'tok_b20hid0001', name: 'Lurker', x: 15, z: 5, hidden: true } }] }, C.area);
await waitFor(() => gm.view(C.area).entities.tok_b20tgt0001 && gm.pendingCount() === 0);
ok(!('target' in gm.view(C.area).entities.tok_b20att0001), 'a pawn has no target until one is set');
gm.submit('token.set', { id: 'tok_b20att0001', target: 'tok_b20tgt0001' }, C.area);
await waitFor(() => gm.view(C.area).entities.tok_b20att0001.target === 'tok_b20tgt0001' && gm.pendingCount() === 0);
ok(gm.view(C.area).entities.tok_b20att0001.target === 'tok_b20tgt0001', 'token.set target sets it');
const n0 = nacks.length;
gm.submit('token.set', { id: 'tok_b20att0001', target: 'tok_b20att0001' }, C.area);
gm.submit('token.set', { id: 'tok_b20att0001', target: 'tok_nothere001' }, C.area);
gm.submit('token.set', { id: 'tok_b20att0001', target: 'tok_b20hid0001' }, C.area);
await waitFor(() => gm.pendingCount() === 0); await sleep(150);
const why = nacks.slice(n0).map(n => n.why || '');
ok(why.some(w => /cannot target itself/.test(w)) && why.some(w => /no pawn tok_nothere001/.test(w)) && why.some(w => /hidden from the players/.test(w)) && gm.view(C.area).entities.tok_b20att0001.target === 'tok_b20tgt0001', 'never itself, never a missing pawn, a hidden pawn only from a hidden one', why);
gm.submit('token.set', { id: 'tok_b20att0001', target: '' }, C.area);
await waitFor(() => !('target' in gm.view(C.area).entities.tok_b20att0001) && gm.pendingCount() === 0);
ok(!('target' in gm.view(C.area).entities.tok_b20att0001), 'target= (empty) clears it');
// ---- 8. saved attacks (2026-10-29): names and formulas only, 8 at most; [] clears ----
const n1 = nacks.length;
gm.submit('token.set', { id: 'tok_b20att0001', attacks: [{ name: 'Longsword', hit: '+5', dmg: '1d8+3' }, { name: 'Fire Bolt', hit: '+7', dmg: '1d10' }] }, C.area);
await waitFor(() => gm.view(C.area).entities.tok_b20att0001.attacks?.length === 2 && gm.pendingCount() === 0);
ok(JSON.stringify(gm.view(C.area).entities.tok_b20att0001.attacks) === '[{"name":"Longsword","hit":"+5","dmg":"1d8+3"},{"name":"Fire Bolt","hit":"+7","dmg":"1d10"}]', 'token.set attacks saves them');
gm.submit('token.set', { id: 'tok_b20att0001', attacks: [{ name: 'Fireball', dmg: '8d6', description: SECRET }] }, C.area);
gm.submit('token.set', { id: 'tok_b20att0001', attacks: Array.from({ length: 9 }, (_, i) => ({ name: `A${i}`, hit: '+1' })) }, C.area);
gm.submit('token.set', { id: 'tok_b20att0001', attacks: [{ name: SECRET.repeat(3), hit: '+1' }] }, C.area);
gm.submit('token.set', { id: 'tok_b20att0001', attacks: [{ name: 'Bite', hit: 'lots' }] }, C.area);
await waitFor(() => gm.pendingCount() === 0); await sleep(150);
const w2 = nacks.slice(n1).map(n => n.why || '');
ok(w2.length === 4 && w2.some(w => /no field "description"/.test(w)) && w2.some(w => /at most 8/.test(w)) && w2.some(w => /a name is a short word/.test(w)) && w2.some(w => /hit is a bonus/.test(w)), 'refused: a description, a ninth attack, a paragraph for a name, a hit that is not a bonus', w2);
gm.submit('token.set', { id: 'tok_b20att0001', attacks: [] }, C.area);
await waitFor(() => !('attacks' in gm.view(C.area).entities.tok_b20att0001) && gm.pendingCount() === 0);
ok(!('attacks' in gm.view(C.area).entities.tok_b20att0001), 'attacks=[] clears (the field is gone)');
gm.close?.();
await sleep(300);
await relay.close?.();
const files = []; const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else files.push(p); } }; walk(dataDir);
const disk = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
ok(files.some(f => f.endsWith('journal.jsonl')) && disk.includes('msg_b20good001') && disk.includes('Longsword'), 'the journal on disk has the roll', files.map(f => path.basename(f)));
ok(!disk.includes(SECRET), 'NO description text anywhere on disk (journal, snapshot)');

console.log(`beyond20: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);

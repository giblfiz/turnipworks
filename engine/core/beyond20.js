// BEYOND20 INTAKE (Harry 2026-10-29; docs/BEYOND20.md). Beyond20 is a browser extension (GPL-3, kakaroto/Beyond20) that
// reads a player's D&D Beyond sheet in their own browser and, on a site added to its "custom domains", sends that page DOM
// events: Beyond20_RenderedRoll, _UpdateHP, _UpdateConditions, _UpdateCombat, _Loaded, _NewSettings. TW only listens
// (client/surfaces/beyond20.js); we ship and fork nothing.
//
// PURE: the client turns Beyond20's messages into TW commands with these functions, and the relay checks the one new
// field with them (`info` on dice.roll, core/commands.js), so the two cannot drift. engine/test/beyond20.test.mjs.
//
// WHAT CROSSES, AND WHAT NEVER DOES (Harry 2026-10-29: Wizards' paid content must never be stored). A roll crosses as
// its character's name, the roll's name ("Longsword", "Stealth"), its type, the formulas, every die's number, the total,
// and crit / fumble / advantage flags. NEVER a description, a spell's or feature's text, Beyond20's rendered html, its
// roll_info, a roll table's contents or a damage "message" (a damage entry with flag 0 is prose: "Chaotic energy leaps
// ..."). Nothing below copies such a field: every value written out is picked by name and cut short. The relay refuses
// an `info` with any other key (infoProblem), so a hand-made command cannot store text there either.
import { parseDice } from './dice.js';
import { DAMAGE_LIMIT } from './pawn.js';
import { cleanConditions, condKey, exhaustionLevel, exhaustionWord, EXHAUSTION_MAX, DDB_WORDS } from './conditions.js';

// the roll types that carry dice (Beyond20 docs/api.md "Roll types"). The others (avatar, trait, item, spell-card,
// chat-message) are text or pictures only: nothing of them crosses.
export const B20_KINDS = ['initiative', 'ability', 'saving-throw', 'skill', 'attack', 'spell-attack', 'hit-dice', 'death-save', 'custom', 'digital-dice', 'roll-table'];
// Beyond20's RollType enum -> our word (0 normal; 2, 8, 9 never reach a site)
export const ADVANTAGE = { 1: 'double', 3: 'adv', 4: 'dis', 5: 'thrice', 6: 'super-adv', 7: 'super-dis' };
export const PARTS = ['to-hit', 'check', 'initiative', 'damage', 'healing', 'roll'];

// THE ONE NEW FIELD ON dice.roll: `info`. Every key, and what it may hold. Nothing else is accepted.
const S = (n) => ({ str: n }), E = (list) => ({ en: list });
export const INFO = {
  src: E(['b20', 'tw']),            // b20: Beyond20's own numbers; tw: TW rolled them (the Attack button)
  char: S(60),                      // the character's name as D&D Beyond has it
  name: S(60),                      // the roll's name: "Longsword", "Stealth", "Fire Bolt"
  kind: E(B20_KINDS),
  part: E(PARTS),
  adv: E(Object.values(ADVANTAGE)),
  crit: { bool: 1 }, fumble: { bool: 1 },
  formula: { str: 80, ops: 1 },     // Beyond20's own formula when ours had to differ ("1d20min10 + 5", "1d20ro<=1": < and > allowed here only)
  types: { list: 6, item: 24 },     // damage types, short words ("Slashing", "Fire")
  alt: S(24),                       // a damage alternative: "two-handed", "conditional"
  target: S(60),                    // the Attack button: who was attacked (a pawn's name)
};
const CTRL = /[\u0000-\u001f\u007f<>]/, CTRL_OPS = /[\u0000-\u001f\u007f]/;
export function infoProblem(info) {
  if (info == null) return null;
  if (typeof info !== 'object' || Array.isArray(info)) return 'info: an object';
  for (const [k, v] of Object.entries(info)) {
    const spec = INFO[k];
    if (!spec) return `info: no field "${k}" (only ${Object.keys(INFO).join(', ')}: descriptions, spell and feature text are never stored)`;
    if (spec.str && !(typeof v === 'string' && v.length <= spec.str && !(spec.ops ? CTRL_OPS : CTRL).test(v))) return `info.${k}: a short name (${spec.str} characters at most)`;
    if (spec.en && !spec.en.includes(v)) return `info.${k}: one of ${spec.en.join(' ')}`;
    if (spec.bool && typeof v !== 'boolean') return `info.${k}: true or false`;
    if (spec.list && !(Array.isArray(v) && v.length <= spec.list && v.every(x => typeof x === 'string' && x.length <= spec.item && !CTRL.test(x)))) return `info.${k}: at most ${spec.list} short words`;
  }
  return null;
}
// the same rules, as a filter: what the client sends is already clean (a key we do not know is dropped, text is cut)
export function cleanInfo(info) {
  const out = {};
  for (const [k, spec] of Object.entries(INFO)) {
    const v = info?.[k]; if (v == null || v === '') continue;
    if (spec.str) { const s = short(v, spec.str, spec.ops); if (s) out[k] = s; }
    else if (spec.en) { if (spec.en.includes(v)) out[k] = v; }
    else if (spec.bool) { if (v === true) out[k] = true; }
    else if (spec.list && Array.isArray(v)) { const l = v.map(x => short(x, spec.item)).filter(Boolean).slice(0, spec.list); if (l.length) out[k] = l; }
  }
  return out;
}
export const short = (v, n, ops = false) => typeof v === 'string' || typeof v === 'number' ? String(v).replace(ops ? /[\u0000-\u001f\u007f]+/g : /[\u0000-\u001f\u007f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n).trim() : '';

// A CHARACTER-SHEET KEY: the D&D Beyond id in a sheet link, so a pawn's `sheet` and Beyond20's character.url compare.
//   https://www.dndbeyond.com/characters/12345678            -> characters/12345678
//   https://www.dndbeyond.com/profile/Someone/characters/123 -> characters/123
//   https://ddb.ac/characters/123/AbCd                       -> characters/123
//   https://www.dndbeyond.com/monsters/16907-goblin          -> monsters/16907   (a GM's monster page; vehicles too)
export function sheetKey(url) {
  const s = String(url || '');
  const m = s.match(/^https?:\/\/(?:[\w-]+\.)*(?:dndbeyond\.com|ddb\.ac)\/(?:profile\/[^/?#]+\/)?(characters|monsters|vehicles)\/(\d+)/i);
  return m ? `${m[1].toLowerCase()}/${m[2]}` : null;
}
export const isDdbSheet = (url) => !!sheetKey(url);
// the character a Beyond20 message is about: name, sheet link, key. Nothing else of the character object is kept.
export function charOf(c, fallbackName = '') {
  const o = c && typeof c === 'object' ? c : {};
  const url = typeof o.url === 'string' && /^https?:\/\//i.test(o.url) && o.url.length <= 500 ? o.url : '';
  const name = short(o.name || (typeof c === 'string' ? c : '') || fallbackName, 60) || 'Character';
  const key = sheetKey(url) || (o.id != null && /^\w{1,40}$/.test(String(o.id)) ? `${short(o.type, 20).toLowerCase() || 'sheet'}:${o.id}` : `name:${name.toLowerCase()}`);
  return { name, url, key, type: short(o.type, 20) };
}

// ---------- one Beyond20 Roll -> TW's dice ----------
// TW's expression grammar (core/dice.js): NdF, NdFkhK / klK, flat numbers, + and -. Beyond20 has more (reroll "ro<=1",
// minimum "min10", drop "dl1"). Where ours cannot say it, the die list is the dice that COUNT (the kept ones) and the
// total is still Beyond20's: the numbers are authoritative, the expression is only how the dice are thrown and shown.
const isDie = (p) => p && typeof p === 'object' && Number.isInteger(p.faces) && Array.isArray(p.rolls);
function termsOf(parts) {
  const out = []; let sign = '+';
  for (const p of Array.isArray(parts) ? parts : []) {
    if (p === '+' || p === '-') { sign = p; continue; }
    if (typeof p === 'number' && Number.isFinite(p)) { out.push({ sign, str: String(Math.round(Math.abs(p))), values: [], neg: p < 0 }); sign = '+'; continue; }
    if (!isDie(p)) continue;
    const all = p.rolls.map(r => Math.round(+r?.roll)).filter(Number.isFinite), kept = p.rolls.filter(r => !r?.discarded).map(r => Math.round(+r.roll)).filter(Number.isFinite);
    const mods = String(p.modifiers || '').trim().toLowerCase(), faces = p.faces;
    if (faces < 2 || faces > 1000) { out.push({ sign, str: String(Math.round(+p.total || 0)), values: [] }); sign = '+'; continue; }
    let str, values, exact = true;
    if (/^k[hl]\d+$/.test(mods) && all.length === p.amount) { str = `${all.length}d${faces}${mods}`; values = all; }
    else if (!mods && kept.length === all.length) { str = `${all.length}d${faces}`; values = all; }
    else { str = `${kept.length}d${faces}`; values = kept; exact = false; }
    if (!values.length) { sign = '+'; continue; }
    out.push({ sign, str, values, exact });
    sign = '+';
  }
  // a negative flat after a '+' (cannot happen in Beyond20's parser, kept honest anyway)
  for (const t of out) if (t.neg) { t.sign = t.sign === '-' ? '+' : '-'; delete t.neg; }
  return out;
}
const join = (terms) => terms.map((t, i) => `${t.sign === '-' ? '-' : i ? '+' : ''}${t.str}`).join('');
const label = (expr) => parseDice(expr)?.label || expr;
// -> { expr, rolls, total, crit, fumble, formula? } (formula: Beyond20's own, when ours is not the same thing)
export function twRoll(r) {
  if (!r || typeof r !== 'object') return null;
  const terms = termsOf(r.parts);
  if (!terms.length) return null;
  const expr = join(terms), rolls = terms.flatMap(t => t.values).slice(0, 100);
  const out = { expr: label(expr).slice(0, 80), rolls, total: Math.round(+r.total || 0), crit: r['critical-success'] === true, fumble: r['critical-failure'] === true };
  if (terms.some(t => t.exact === false) && typeof r.formula === 'string') out.formula = short(r.formula, 80, true);
  return out;
}
// THE d20s OF A CHECK OR AN ATTACK: advantage is two whole Rolls (super advantage three), one kept and the others
// discarded. Thrown together as ONE roll in our words: "d20+5 adv" (2d20kh1+5), "d20+5 dis", "3d20kh1+5". Anything
// else (Beyond20's "roll twice and show both", or rolls that do not line up) is one TW roll per Roll.
const singleD20 = (r) => { const p = r?.parts?.[0]; return isDie(p) && p.faces === 20 && p.amount === 1 && !String(p.modifiers || '').trim() && p.rolls.length === 1; };
export function twD20s(rolls, advantage) {
  const list = (Array.isArray(rolls) ? rolls : []).filter(r => r && typeof r === 'object');
  const kept = list.filter(r => !r.discarded);
  const adv = ADVANTAGE[advantage] || null;
  if (list.length > 1 && kept.length === 1 && list.every(singleD20) && list.every(r => JSON.stringify(r.parts.slice(1)) === JSON.stringify(list[0].parts.slice(1)))) {
    const k = kept[0], rest = termsOf(k.parts.slice(1)).map(t => `${t.sign === '-' ? '-' : '+'}${t.str}`).join('');
    const lo = advantage === 4 || advantage === 7 || (advantage !== 3 && advantage !== 6 && k.total < Math.max(...list.map(r => r.total)));
    const n = list.length, expr = n === 2 ? `d20${rest} ${lo ? 'dis' : 'adv'}` : `${n}d20k${lo ? 'l' : 'h'}1${rest}`;
    return [{ expr: label(expr).slice(0, 80), rolls: list.map(r => Math.round(+r.parts[0].rolls[0].roll)), total: Math.round(+k.total || 0), crit: k['critical-success'] === true, fumble: k['critical-failure'] === true, adv: adv || (lo ? 'dis' : 'adv') }];
  }
  return (kept.length ? kept : list).map(r => { const t = twRoll(r); return t && { ...t, ...(adv && { adv }) }; }).filter(Boolean);
}

// ---------- a whole rendered roll -> what TW does with it ----------
// Beyond20's damage flags (docs/api.md "Damage Roll Info Format")
export const DMG = { MESSAGE: 0, REGULAR: 1, VERSATILE: 2, ADDITIONAL: 4, HEALING: 8, CRITICAL: 16, CONDITIONAL: 32 };
const dmgType = (s) => { const t = short(s, 40).replace(/\s*damage$/i, '').trim(); return /^[A-Za-z][A-Za-z' -]{0,23}$/.test(t) ? t : ''; };
function nameOf(req, msg) {
  const k = req.type;
  const n = k === 'skill' ? req.skill : k === 'initiative' ? 'Initiative' : k === 'hit-dice' ? 'Hit dice' : k === 'death-save' ? 'Death save' : k === 'saving-throw' ? `${short(req.name || req.ability, 40)} save` : req.name;
  return short(n, 60) || short(String(msg?.title || '').replace(/\s*\([^)]*\)\s*$/, ''), 60) || k;
}
// msg: the RenderedRoll detail (Beyond20's "rendered-roll" request). ->
//   { char: { name, url, key }, kind, name, whisper, specs: [{ expr, rolls, total, info }], init: n | null, attack: null | {...} }
// A spec is one TW roll (one throw, one line). The order is the table's: the d20s first, then damage.
export function fromRendered(msg) {
  const req = msg && typeof msg.request === 'object' && msg.request ? msg.request : {};
  const kind = B20_KINDS.includes(req.type) ? req.type : null;
  const char = charOf(req.character, typeof msg?.character === 'string' ? msg.character : '');
  const out = { char, kind, name: kind ? nameOf(req, msg) : '', whisper: Number.isInteger(req.whisper) ? req.whisper : Number.isInteger(msg?.whisper) ? msg.whisper : 0, specs: [], init: null, attack: null };
  if (!kind) return out; // a description card (trait, item, spell card, chat message, avatar): nothing of it crosses
  const base = { src: 'b20', char: char.name, name: out.name, kind };
  const d20Part = kind === 'attack' || kind === 'spell-attack' ? 'to-hit' : kind === 'initiative' ? 'initiative' : ['skill', 'ability', 'saving-throw', 'death-save'].includes(kind) ? 'check' : 'roll';
  for (const t of twD20s(msg.attack_rolls, req.advantage)) {
    const { adv, crit, fumble, formula, ...dice } = t;
    out.specs.push({ ...dice, info: cleanInfo({ ...base, part: d20Part, adv, crit, fumble, formula }) });
  }
  const main = out.specs[0];
  if (kind === 'initiative' && main) out.init = main.total;
  // damage: the regular and additional damage (and the critical dice when Beyond20 rolled them) are ONE throw, the total
  // the table uses; a versatile weapon's two-handed alternative and conditional damage are throws of their own; healing
  // its own. A damage "message" (flag 0) is prose and never crosses.
  const groups = new Map();
  for (const d of Array.isArray(msg.damage_rolls) ? msg.damage_rolls : []) {
    if (!Array.isArray(d) || d.length < 3) continue;
    const [lbl, roll, flags] = d;
    if (!Number.isInteger(flags) || flags === DMG.MESSAGE || !roll || typeof roll !== 'object') continue;
    const g = flags & DMG.HEALING ? 'healing' : flags & DMG.CONDITIONAL ? 'conditional' : flags & DMG.VERSATILE ? 'two-handed' : 'damage';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push({ type: dmgType(lbl), roll });
  }
  for (const [g, list] of groups) {
    const rs = list.map(x => twRoll(x.roll)).filter(Boolean); if (!rs.length) continue;
    const expr = label(rs.map((r, i) => (i && !/^-/.test(r.expr) ? '+' : '') + r.expr.replace(/\s+(adv|dis)$/, '')).join('')).slice(0, 80);
    const formula = rs.some(r => r.formula) ? short(list.map(x => x.roll.formula).join(' + '), 80, true) : null;
    out.specs.push({ expr, rolls: rs.flatMap(r => r.rolls).slice(0, 100), total: rs.reduce((a, r) => a + r.total, 0),
      info: cleanInfo({ ...base, part: g === 'healing' ? 'healing' : 'damage', types: [...new Set(list.map(x => x.type).filter(Boolean))], alt: g === 'two-handed' || g === 'conditional' ? g : null, crit: main?.info?.crit && g !== 'healing' ? true : null, formula }) });
  }
  if (kind === 'attack' || kind === 'spell-attack') out.attack = attackOf(req, out.name);
  return out;
}
// AN ATTACK TO ROLL AGAIN IN TW (the Attack button): its name, the to-hit modifier and the damage formulas. All of them
// are numbers and dice, from the attack's own fields (never its description).
export function attackOf(req, name) {
  const mod = String(req?.['to-hit'] ?? '').replace(/\s+/g, '');
  const hit = /^[+-]?\d{1,2}$/.test(mod) ? (/^[+-]/.test(mod) ? mod : `+${mod}`) : null;
  const types = Array.isArray(req?.['damage-types']) ? req['damage-types'] : [];
  const damages = (Array.isArray(req?.damages) ? req.damages : []).map((f, i) => {
    const e = String(f ?? '').replace(/\s+/g, ''), p = /^[\dd+\-khl]{1,40}$/i.test(e) ? parseDice(e) : null;
    return p ? { expr: p.label, type: dmgType(types[i]) } : null;
  }).filter(Boolean).slice(0, 6);
  if (!hit && !damages.length) return null;
  return { name: short(name, 60) || 'Attack', hit, damages, spell: req?.type === 'spell-attack' };
}
// the to-hit expression of a remembered attack ("d20+5"), and its damage as one roll ("1d8+3+2d6")
export const hitExpr = (a) => a?.hit ? parseDice(`d20${a.hit === '+0' ? '' : a.hit}`)?.label || null : null;
export const damageExpr = (a) => a?.damages?.length ? parseDice(a.damages.map(d => d.expr).join('+'))?.label || null : null;

// HP -> DAMAGE (TW counts damage up from 0; docs/PAWNS.md "Damage, not HP"): max - current, never below 0. Temporary
// hit points are not damage and are ignored. null = Beyond20 did not give both numbers.
export function damageFromHP(hp, max) {
  if (hp == null || max == null || hp === '' || max === '') return null;
  const h = Number(hp), m = Number(max);
  if (!Number.isFinite(h) || !Number.isFinite(m) || m <= 0) return null;
  return Math.max(0, Math.min(DAMAGE_LIMIT, Math.round(m - h)));
}
// CONDITIONS (2026-10-29: nothing is dropped any more). D&D Beyond's list is the truth for D&D Beyond's own words (its
// conditions, core/conditions.js DDB_WORDS, and exhaustion's level); every other word on the pawn (dead, concentrating,
// anything the GM or a player typed) is left alone. A word TW has a look for is stored as TW's word; deafened, petrified
// and any word TW does not know arrive as they are and show as a text label. Exhaustion comes as Beyond20's own number
// (UpdateConditions' 4th argument, or the character's `exhaustion`) and is stored as "exhaustion N"; 0 takes it off.
//   current     the pawn's conditions now      ddb    D&D Beyond's list      exhaustion   its level (undefined: not sent)
export function conditionsAfter(current, ddb, exhaustion) {
  const cur = cleanConditions(current);
  const inc = cleanConditions(Array.isArray(ddb) ? ddb : []);
  const n = Number(exhaustion);
  const exh = exhaustion == null || exhaustion === '' || !Number.isFinite(n) ? inc.find(exhaustionLevel) || undefined : exhaustionWord(Math.max(0, Math.min(EXHAUSTION_MAX, Math.round(n)))) || null;
  const words = inc.filter(w => !exhaustionLevel(w)), on = new Set(words.map(condKey));
  const ddbOwns = (w) => DDB_WORDS.includes(condKey(w)) || on.has(condKey(w)) || (exh !== undefined && condKey(w) === 'exhaustion');
  const out = [...cur.filter(w => !ddbOwns(w) || on.has(condKey(w))), ...words.filter(w => !cur.some(c => condKey(c) === condKey(w)))];
  const kept = out.filter(w => condKey(w) !== 'exhaustion' || exh === undefined);
  if (exh) kept.push(exh);
  return cleanConditions(kept);
}

// CONDITIONS: the words on a pawn, what each one looks like on the table, and the one shape rule (2026-10-29).
// Pure, shared by the relay (the shape check), the client (what it draws, what it sends) and Beyond20's mapping.
//
// Harry's design of 2026-10-15 (docs/PAWNS.md "Conditions on the table"): no icon badges; "big cartoony, easy to follow".
// Poses (prone, unconscious, dead), ORBITERS round one ring over the head, base treatments (incapacitated, exhaustion,
// concentrating) and the invisible body. Harry 2026-10-29: "missing status effects that come over can just be a text
// label": ANY other short word is kept and shown as a small text orbiter. The relay is strict on the SHAPE of the list
// (how many, how long, which characters), never on its vocabulary.
//
// Stored as before: `conditions: [word, ...]` on the pawn. TW's own words are lower case; exhaustion is ONE entry
// "exhaustion N" (1 to 6); a word TW does not know keeps the case it was typed in ("Hexed").
// Old journals: apply never looks at the words (check does not run on replay), so every old list loads as it was.

import { CONDITIONS } from './pawn.js';

export const COND_MAX = 12;   // words on one pawn
export const COND_LEN = 24;   // characters in one word
export const EXHAUSTION_MAX = 6;
// what a word may be made of: letters and digits of any script, spaces and a little punctuation. No markup characters.
const OK_CHARS = /^[\p{L}\p{M}\p{N} '’().:,/+!?&#%-]+$/u;
const BAD_CHARS = /[^\p{L}\p{M}\p{N} '’().:,/+!?&#%-]/gu;
const ALIAS = { paralysed: 'paralyzed', concentration: 'concentrating', concentrate: 'concentrating', unconcious: 'unconscious', 'knocked out': 'unconscious', invisibility: 'invisible', poison: 'poisoned', blind: 'blinded', charm: 'charmed', fear: 'frightened', scared: 'frightened', afraid: 'frightened', stun: 'stunned', grapple: 'grappled', restrain: 'restrained', paralysis: 'paralyzed', incapacitate: 'incapacitated' };
const EXH = /^(?:exhaustion|exhausted)(?:\s*(?:level|lvl|lv)?\s*[:=]?\s*(\d{1,2}))?$/i;

const len = (s) => [...s].length;
const cut = (s, n) => [...s].slice(0, n).join('').trimEnd();
export const exhaustionLevel = (w) => { const m = typeof w === 'string' && /^exhaustion ([1-6])$/.exec(w); return m ? +m[1] : 0; };
export const exhaustionWord = (n) => n >= 1 ? `exhaustion ${Math.min(EXHAUSTION_MAX, Math.round(n))}` : null;
// the key a word is compared by: case-insensitive; every exhaustion level is one key (a pawn has one level)
export const condKey = (w) => exhaustionLevel(w) ? 'exhaustion' : String(w).toLowerCase();

// ONE WORD, CLEANED: what any way in (the ring, the bar's typing, Beyond20, an AI seat over GET) stores. Control and
// markup characters go, spaces collapse, TW's own words (and a few spellings of them) become TW's word, exhaustion
// becomes "exhaustion N", anything else is cut to COND_LEN characters. '' = nothing left (or "exhaustion 0").
export function normCondition(raw) {
  let s = String(raw ?? '').normalize('NFC').replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, '').replace(BAD_CHARS, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const lo = s.toLowerCase(), ex = EXH.exec(lo);
  if (ex) { const n = ex[1] == null ? 1 : +ex[1]; return exhaustionWord(n) || ''; }
  const w = ALIAS[lo] || lo;
  if (CONDITIONS.includes(w) || DDB_WORDS.includes(w)) return w;
  return cut(s, COND_LEN);
}
// A WHOLE LIST, CLEANED: each word cleaned, empties dropped, repeats dropped (the later exhaustion level wins), at most
// COND_MAX kept.
export function cleanConditions(list) {
  const out = [], at = new Map();
  for (const raw of Array.isArray(list) ? list : []) {
    const w = normCondition(raw); if (!w) continue;
    const k = condKey(w);
    if (at.has(k)) { if (k === 'exhaustion') out[at.get(k)] = w; continue; }
    at.set(k, out.length); out.push(w);
  }
  return out.slice(0, COND_MAX);
}
// THE RELAY'S CHECK (token.set / token.create): the SHAPE only. A list of at most COND_MAX words, each 1 to COND_LEN
// characters with no space at either end, made of letters, digits, spaces and a little punctuation, no word twice
// (case-insensitive; one exhaustion). Any word passes it, so text a person or an AI typed is kept, not dropped.
export function conditionsProblem(list) {
  if (!Array.isArray(list)) return 'conditions are a list of short words';
  if (list.length > COND_MAX) return `a pawn has at most ${COND_MAX} conditions`;
  const seen = new Set();
  for (const w of list) {
    if (typeof w !== 'string' || !w || len(w) > COND_LEN || w !== w.trim()) return `conditions are short words (1 to ${COND_LEN} characters)`;
    if (!OK_CHARS.test(w) || /\s{2}/.test(w)) return 'a condition is letters, digits, spaces and a little punctuation';
    if (/^exhaustion\b/i.test(w) && !exhaustionLevel(w)) return 'exhaustion is "exhaustion 1" to "exhaustion 6"';
    const k = condKey(w); if (seen.has(k)) return `${w} is there twice`; seen.add(k);
  }
  return null;
}

// D&D BEYOND'S WORDS (the 2014 and 2024 conditions, Beyond20 UpdateConditions). Exhaustion comes as its own number.
export const DDB_WORDS = ['blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];

// WHAT EACH WORD LOOKS LIKE ON THE TABLE (docs/PAWNS.md "Conditions on the table"). The client draws statusOf().
//   pose     the figure laid down: 'side' (prone), 'back' (unconscious), 'down' (dead: face down)
//   orbit    a picture on the ring over the head (art key: engine/client/data/icons/status/<key>.png in the atlas)
export const ORBIT_ART = { charmed: 'charmed', stunned: 'stunned', frightened: 'frightened', blinded: 'blinded', grappled: 'grappled', restrained: 'restrained', poisoned: 'poisoned', paralyzed: 'paralyzed' };
// words with a look of their own that is not an orbiter
const OWN_LOOK = new Set(['prone', 'unconscious', 'dead', 'invisible', 'incapacitated', 'concentrating']);
export const hasLook = (w) => !!ORBIT_ART[w] || OWN_LOOK.has(w) || !!exhaustionLevel(w);
export const ORBIT_SHOWN = 4; // past this many orbiters: three and "+N" (Harry 2026-10-15: "past ~4 show three + +N")
// THE LOOK OF A WHOLE LIST: { pose, grey, zzz, invisible, dim, drain, runes, orbit: [{ key, art } | { key, text }], words }
// Unconscious and dead beat prone; dead beats unconscious (toppled, greyed, no Z's).
export function statusOf(conditions) {
  const words = Array.isArray(conditions) ? conditions.filter(w => typeof w === 'string' && w) : [];
  const on = new Set(words.map(w => w.toLowerCase()));
  const dead = on.has('dead'), out = { pose: dead ? 'down' : on.has('unconscious') ? 'back' : on.has('prone') ? 'side' : null, grey: dead, zzz: !dead && on.has('unconscious'),
    invisible: on.has('invisible'), dim: on.has('incapacitated'), drain: 0, runes: on.has('concentrating'), orbit: [], words };
  for (const w of words) {
    const lo = w.toLowerCase(), ex = exhaustionLevel(lo);
    if (ex) { out.drain = Math.max(out.drain, ex); continue; }
    if (ORBIT_ART[lo]) out.orbit.push({ key: lo, art: ORBIT_ART[lo] });
    else if (!OWN_LOOK.has(lo)) out.orbit.push({ key: lo, text: w });
  }
  return out;
}
// what the orbit ring draws: up to ORBIT_SHOWN entries as they are; more: the first three and a "+N" (N = the rest)
export function orbitShown(orbit) {
  if (orbit.length <= ORBIT_SHOWN) return { shown: orbit, more: [] };
  return { shown: orbit.slice(0, ORBIT_SHOWN - 1), more: orbit.slice(ORBIT_SHOWN - 1) };
}
// the name a person reads for a word (hover names, the Pawns menu): TW's words as they are; "exhaustion 2" as it is
export const condName = (w) => String(w);

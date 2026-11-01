// GAME DICE (2026-10-29; Harry: "build the fancy dice for a few games, so that the LLMs have them to roll"). The roll
// words for six games' own dice, parsed into ordinary dice terms (so every seat throws them with the same 3D dice and
// the same "whoever rolls sends the result" path: docs/NETCODE.md "Dice") plus the MECHANICAL TALLY each game reads off
// them: successes counted, criticals, glitches, Hope or Fear. Judgement calls (a messy critical's consequences, which
// L5R dice to keep) stay with the GM and the LLM. Pure: the browser and the relay share it (core/dice.js calls in).
//
//   coc [skill] [bonus N | penalty N]     percentile: tens dice (00-90) + a units d10; bonus keeps the best, penalty the
//                                         worst; with a skill: critical (01), extreme (1/5), hard (1/2), regular, failure,
//                                         fumble (100, or 96+ when the skill is under 50)                    (7th edition)
//   v5 POOL [hunger H] [diff D]           POOL d10s, H of them red Hunger dice; 6+ succeeds, each PAIR of 10s counts 4
//                                         (critical); messy critical when a Hunger die shows a 10 in a critical; a Hunger
//                                         die showing 1: bestial failure if the roll fails; diff: win/lose by a margin
//   sr POOL [threshold T]                 POOL d6s; 5 and 6 are hits; glitch when more than half the dice show 1,
//                                         critical glitch when that comes with no hits; threshold: net hits
//   duality [+M] [diff D]                 a Hope d12 and a Fear d12, total = both + M; "with Hope" / "with Fear" by the
//                                         higher die; doubles are a critical success
//   NdF[+M]  (fate [+M])                  N (default 4) Fudge dice: + / blank / -, total = sum + M, with the ladder word
//   l5r R ring S skill [tn N]             R ring d6s and S skill d12s with symbol faces; the tally of every face (the
//                                         player keeps some: the GM or the LLM reads which)
//   ex POOL [tn T] [double D | nodouble] [diff N]   (2026-10-30) Exalted: POOL d10s; T (7) and up is a success, D (10)
//                                         and up counts twice ("d9" = double 9s); nodouble for rolls that never double
//                                         (damage); botch = no successes and at least one 1; diff: threshold successes
//
// The parsed roll is { terms, label, game: { kind, ... } }. The label is canonical ("v5 7 hunger 2 diff 3") and is what
// the dice.roll command stores as `expr`: parsing it again gives the same terms, so every seat (and an old journal
// replayed later) rebuilds the same dice and the same tally from expr + rolls. No new fields on the command.
// The dice terms carry `skin` (the face set the look paints: neutral ids, no game names in assets) and `tens` (a
// percentile tens die): tools/spawn-tuner/js/fx/dicephys.js diceOfRoll reads them.

export const SKINS = {
  'pool-d10-hunger': { sides: 10 },
  'duality-d12-hope': { sides: 12 },
  'duality-d12-fear': { sides: 12 },
  'fudge-d6': { sides: 6 },
  'ring-d6': { sides: 6 },
  'skill-d12': { sides: 12 },
};
// Fudge die faces by d6 value (opposite faces 1-6, 2-5, 3-4: minus faces plus, blank faces blank)
export const FUDGE = [null, -1, -1, 0, 0, 1, 1];
// L5R faces by die value: s success, o opportunity, t strife, e explosive success (counts as a success too)
export const RING_FACES = [null, '', 'ot', 'o', 'st', 's', 'et'];
export const SKILL_FACES = [null, '', '', 'o', 'o', 'o', 's', 's', 'st', 'st', 'so', 'et', 'e'];
const FACE_WORD = { '': 'blank', o: 'opportunity', s: 'success', t: 'strife', e: 'explosive' };
export const faceWords = (f) => f === '' ? 'blank' : [...f].map(c => FACE_WORD[c]).join('+');
const LADDER = { 8: 'Legendary', 7: 'Epic', 6: 'Fantastic', 5: 'Superb', 4: 'Great', 3: 'Good', 2: 'Fair', 1: 'Average', 0: 'Mediocre', '-1': 'Poor', '-2': 'Terrible' };
export const ladder = (n) => LADDER[n] || (n > 8 ? 'Beyond Legendary' : 'Abysmal');

// the words that start each game's roll (lower case; "roll " already stripped)
const KIND = [
  [/^(?:coc|cthulhu|call of cthulhu|percentile|pct)(?![a-z])/, 'coc'],
  [/^(?:v5|vtm|vampire|hunger pool)(?![a-z0-9])/, 'v5'],
  [/^(?:sr|shadowrun)(?![a-z])/, 'sr'],
  [/^(?:duality|daggerheart|dh|hope and fear|hope fear)(?![a-z])/, 'duality'],
  [/^(?:fate|fudge)(?![a-z])/, 'fate'],
  [/^(\d*)df(?![a-z])/, 'fate'],
  [/^(?:l5r|rings|legend of the five rings)(?![a-z0-9])/, 'l5r'],
  [/^(?:ex|exalted)(?![a-z])/, 'ex'],
];
const ALIAS = {
  coc: { skill: 'skill', vs: 'skill', bonus: 'bonus', b: 'bonus', penalty: 'penalty', p: 'penalty' },
  v5: { hunger: 'hunger', h: 'hunger', diff: 'diff', difficulty: 'diff', dc: 'diff', vs: 'diff', pool: 'pool', dice: 'pool' },
  sr: { threshold: 'threshold', thr: 'threshold', th: 'threshold', t: 'threshold', vs: 'threshold', pool: 'pool', dice: 'pool' },
  duality: { diff: 'diff', difficulty: 'diff', dc: 'diff', vs: 'diff' },
  fate: { diff: 'diff', difficulty: 'diff', vs: 'diff' },
  l5r: { ring: 'ring', rings: 'ring', r: 'ring', skill: 'skill', skills: 'skill', s: 'skill', tn: 'tn', vs: 'tn' },
  ex: { tn: 'tn', target: 'tn', double: 'double', doubles: 'double', d: 'double', diff: 'diff', difficulty: 'diff', dc: 'diff', vs: 'diff', pool: 'pool', dice: 'pool' },
};
const POSITIONAL = { coc: ['skill'], v5: ['pool', 'hunger', 'diff'], sr: ['pool', 'threshold'], duality: [], fate: [], l5r: ['ring', 'skill'], ex: ['pool'] };
const LIMIT = { pool: [1, 50], hunger: [0, 30], diff: [0, 99], skill: [0, 200], bonus: [0, 2], penalty: [0, 2], threshold: [0, 50], ring: [0, 10], tn: [0, 20] };

// "v5 7 hunger 2 diff 3" -> { kind, pool: 7, hunger: 2, diff: 3 }; null when it is not one of these rolls
function words(s) {
  let kind = null, rest = '', fateN = null;
  for (const [re, k] of KIND) { const m = s.match(re); if (m) { kind = k; rest = s.slice(m[0].length); if (k === 'fate' && m[1] != null) fateN = m[1] ? +m[1] : 4; break; } }
  if (!kind) return null;
  if (kind === 'ex') rest = rest.replace(/(\d)s\b/g, '$1'); // ("double 9s")
  const toks = rest.replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2').replace(/([+-])\s+(\d)/g, '$1$2').trim().split(/[\s,]+/).filter(Boolean);
  const A = ALIAS[kind], out = { kind }, num = (t) => /^\d+$/.test(t);
  let mod = 0, sawMod = false;
  const set = (k, v) => { if (out[k] != null) return false; const L = LIMIT[k]; if (L && (v < L[0] || v > L[1])) return false; out[k] = v; return true; };
  // L5R written "3 ring 2 skill" (count first) or "ring 3 skill 2" (word first): the first token says which
  const countFirst = kind === 'l5r' && num(toks[0] || '') && A[toks[1]] && A[toks[1]] !== 'tn';
  const free = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === 'with' || t === 'of' || t === 'and' || t === '=' || t === 'die' && kind !== 'v5') continue;
    if (/^[+-]\d+$/.test(t)) { if (kind === 'coc' && /^\+/.test(t) && A[toks[i + 1]]) { if (!set(A[toks[i + 1]], +t.slice(1))) return null; i++; continue; } mod += +t; sawMod = true; continue; }
    if (countFirst && num(t) && A[toks[i + 1]] && A[toks[i + 1]] !== 'tn') { if (!set(A[toks[i + 1]], +t)) return null; i++; continue; }
    if (A[t] && num(toks[i + 1] || '')) { if (!set(A[t], +toks[i + 1])) return null; i++; continue; }
    if (kind === 'coc' && A[t] && (A[t] === 'bonus' || A[t] === 'penalty')) { if (!set(A[t], 1)) return null; continue; } // "coc 50 bonus" = one bonus die
    if (kind === 'ex' && (/^no-?doubles?$/.test(t) || t === 'no' && /^doubles?$/.test(toks[i + 1] || ''))) { if (!set('double', 11)) return null; if (t === 'no') i++; continue; } // (11: nothing doubles)
    if (num(t)) { free.push(+t); continue; }
    if ((kind === 'v5' || kind === 'ex') && (t === 'dice' || t === 'die')) continue;
    return null;
  }
  if (kind === 'duality' || kind === 'fate') { if (free.length > 1) return null; if (free.length) { mod += free.pop(); sawMod = true; } } // ("duality 2": a URL's "+" arrives as a space)
  for (const v of free) { const k = POSITIONAL[kind].find(k => out[k] == null); if (!k || !set(k, v)) return null; }
  if (sawMod && !(kind === 'duality' || kind === 'fate')) return null;
  if (kind === 'fate') { out.n = fateN ?? 4; if (out.n < 1 || out.n > 12) return null; }
  if (kind === 'duality' || kind === 'fate') { if (Math.abs(mod) > 99) return null; out.mod = mod; }
  if (kind === 'v5') { if (out.pool == null) return null; out.hunger = out.hunger || 0; if (out.hunger > out.pool) return null; }
  if (kind === 'sr' && out.pool == null) return null;
  if (kind === 'ex') { if (out.pool == null) return null; out.tn = out.tn ?? 7; out.double = out.double ?? 10; if (out.tn < 2 || out.tn > 10 || out.double < out.tn || out.double > 11) return null; }
  if (kind === 'l5r') { out.ring = out.ring || 0; out.skill = out.skill || 0; if (out.ring + out.skill < 1) return null; }
  if (kind === 'coc') { const b = (out.bonus || 0) - (out.penalty || 0); out.bonus = Math.max(0, b); out.penalty = Math.max(0, -b); } // (bonus and penalty dice cancel one for one)
  return out;
}

const sgn = (m) => m ? `${m > 0 ? '+' : '-'}${Math.abs(m)}` : '';
function labelOf(g) {
  switch (g.kind) {
    case 'coc': return `coc${g.skill != null ? ` ${g.skill}` : ''}${g.bonus ? ` bonus ${g.bonus}` : ''}${g.penalty ? ` penalty ${g.penalty}` : ''}`;
    case 'v5': return `v5 ${g.pool}${g.hunger ? ` hunger ${g.hunger}` : ''}${g.diff != null ? ` diff ${g.diff}` : ''}`;
    case 'sr': return `sr ${g.pool}${g.threshold != null ? ` threshold ${g.threshold}` : ''}`;
    case 'duality': return `duality${sgn(g.mod)}${g.diff != null ? ` diff ${g.diff}` : ''}`;
    case 'fate': return `${g.n}dF${sgn(g.mod)}${g.diff != null ? ` diff ${g.diff}` : ''}`;
    case 'l5r': return `l5r ${g.ring} ring ${g.skill} skill${g.tn != null ? ` tn ${g.tn}` : ''}`;
    case 'ex': return `ex ${g.pool}${g.tn !== 7 ? ` tn ${g.tn}` : ''}${g.double === 11 ? ' nodouble' : g.double !== 10 ? ` double ${g.double}` : ''}${g.diff != null ? ` diff ${g.diff}` : ''}`;
  }
}
function termsOf(g) {
  const T = [];
  const add = (n, sides, extra = {}) => { if (n > 0) T.push({ sign: 1, n, sides, keep: null, ...extra }); };
  switch (g.kind) {
    case 'coc': add(1 + g.bonus + g.penalty, 10, { tens: true }); add(1, 10); break;
    case 'v5': add(g.pool - g.hunger, 10); add(g.hunger, 10, { skin: 'pool-d10-hunger' }); break;
    case 'sr': add(g.pool, 6); break;
    case 'ex': add(g.pool, 10); break;
    case 'duality': add(1, 12, { skin: 'duality-d12-hope' }); add(1, 12, { skin: 'duality-d12-fear' }); break;
    case 'fate': add(g.n, 6, { skin: 'fudge-d6' }); break;
    case 'l5r': add(g.ring, 6, { skin: 'ring-d6' }); add(g.skill, 12, { skin: 'skill-d12' }); break;
  }
  if (g.mod) T.push({ sign: g.mod < 0 ? -1 : 1, flat: Math.abs(g.mod) });
  return T;
}

// the parse: a game's roll as dice terms, or null
export function parseGame(text) {
  const s = String(text || '').trim().toLowerCase().replace(/^(?:roll|\/r)\s*/, '').replace(/\s+/g, ' ');
  const g = words(s); if (!g) return null;
  return { terms: termsOf(g), mode: null, label: labelOf(g), game: g };
}

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
// THE TALLY: what the dice say, by the game's rules. rolls are the raw die values in term order (1..sides each).
// -> { total, text, ...fields }  (total: the number the chat line keeps; text: the log's words after the label)
export function tallyGame(g, rolls) {
  const R = rolls.map(Number);
  switch (g.kind) {
    case 'coc': {
      const k = 1 + g.bonus + g.penalty, tens = R.slice(0, k).map(v => v % 10), units = R[k] % 10;
      const each = tens.map(t => (t * 10 + units) || 100);
      const r = g.bonus ? Math.min(...each) : g.penalty ? Math.max(...each) : each[0];
      const s = g.skill;
      let level = null;
      if (s != null) level = r === 1 ? 'critical' : (r === 100 || (s < 50 && r >= 96)) ? 'fumble' : r <= Math.floor(s / 5) ? 'extreme' : r <= Math.floor(s / 2) ? 'hard' : r <= s ? 'regular' : 'failure';
      const word = { critical: 'critical success', fumble: 'fumble', extreme: 'extreme success', hard: 'hard success', regular: 'regular success', failure: 'failure' };
      const note = s == null ? (r === 1 ? 'critical (01)' : r === 100 ? 'fumble (100)' : r >= 96 ? 'a fumble if the skill is under 50' : '') : word[level];
      const pad = (n) => n === 100 ? '100' : String(n).padStart(2, '0');
      return { total: r, short: `${pad(r)}${note ? ` ${note}` : ''}`, result: r, level, tens: tens.map(t => t * 10), units, success: level ? !['failure', 'fumble'].includes(level) : null,
        text: `${pad(r)}${note ? `, ${note}` : ''}${k > 1 ? ` (tens ${tens.map(t => pad(t * 10).replace('100', '00')).join(' ')}${g.bonus ? ', best kept' : ', worst kept'})` : ''}` };
    }
    case 'v5': {
      const N = g.pool - g.hunger, reg = R.slice(0, N), hun = R.slice(N, N + g.hunger), all = [...reg, ...hun];
      const tens = all.filter(v => v === 10).length, pairs = Math.floor(tens / 2), base = all.filter(v => v >= 6).length;
      const successes = base + 2 * pairs, critical = pairs > 0, hungerTen = hun.includes(10), hungerOne = hun.includes(1);
      const messy = critical && hungerTen;
      const win = g.diff != null ? successes >= g.diff : null, margin = g.diff != null ? successes - g.diff : null;
      const bestial = hungerOne && win === false, possibleBestial = hungerOne && win == null;
      const parts = [plural(successes, 'success', 'successes')];
      if (g.diff != null) parts.push(win ? `win by ${margin}` : `fail by ${-margin}`);
      if (critical && win !== false) parts.push(messy ? 'messy critical' : 'critical');
      if (bestial) parts.push('bestial failure');
      else if (possibleBestial) parts.push('bestial failure if it fails');
      if (successes === 0 && !bestial) parts.push('total failure');
      return { total: successes, short: parts.join(', '), successes, critical, messy: messy && win !== false, bestial, possibleBestial, win, margin, text: parts.join(', ') };
    }
    case 'sr': {
      const hits = R.filter(v => v >= 5).length, ones = R.filter(v => v === 1).length;
      const glitch = ones > g.pool / 2, critGlitch = glitch && hits === 0;
      const net = g.threshold != null ? hits - g.threshold : null, success = g.threshold != null ? hits >= g.threshold : null;
      const parts = [plural(hits, 'hit')];
      if (g.threshold != null) parts.push(success ? `success, ${plural(net, 'net hit')}` : `failure (threshold ${g.threshold})`);
      if (critGlitch) parts.push('CRITICAL GLITCH'); else if (glitch) parts.push('glitch');
      return { total: hits, short: [plural(hits, 'hit'), critGlitch ? 'CRITICAL GLITCH' : glitch ? 'glitch' : ''].filter(Boolean).join(', '), hits, ones, glitch, criticalGlitch: critGlitch, net, success, text: parts.join(', ') };
    }
    case 'duality': {
      const hope = R[0], fear = R[1], total = hope + fear + g.mod, crit = hope === fear;
      const side = crit ? 'hope' : hope > fear ? 'hope' : 'fear';
      const success = g.diff != null ? (crit || total >= g.diff) : null;
      const how = crit ? 'critical success on doubles' : `with ${side === 'hope' ? 'Hope' : 'Fear'}`;
      return { total, short: `${total} ${crit ? 'critical' : `with ${side === 'hope' ? 'Hope' : 'Fear'}`}`, hope, fear, with: side, critical: crit, success,
        text: `${total} ${how} (Hope ${hope}, Fear ${fear}${g.mod ? `, ${sgn(g.mod)}` : ''})${g.diff != null && !crit ? `, ${success ? 'success' : 'failure'} vs ${g.diff}` : ''}` };
    }
    case 'fate': {
      const faces = R.slice(0, g.n).map(v => FUDGE[v]), sum = faces.reduce((a, b) => a + b, 0), total = sum + g.mod;
      const shifts = g.diff != null ? total - g.diff : null;
      const fs = faces.map(f => f > 0 ? '+' : f < 0 ? '-' : '0').join(' ');
      return { total, short: `${total > 0 ? '+' : ''}${total} ${ladder(total)}`, faces: fs, sum, shifts,
        text: `${total >= 0 && total ? '+' : ''}${total} ${ladder(total)} (${fs}${g.mod ? `, ${sgn(g.mod)}` : ''})${shifts != null ? `, ${shifts > 0 ? `succeed with ${plural(shifts, 'shift')}` : shifts === 0 ? 'tie' : 'fail'}` : ''}` };
    }
    case 'l5r': {
      const ring = R.slice(0, g.ring).map(v => RING_FACES[v]), skill = R.slice(g.ring, g.ring + g.skill).map(v => SKILL_FACES[v]);
      const all = [...ring, ...skill], count = (c) => all.reduce((n, f) => n + [...f].filter(x => x === c).length, 0);
      const explosive = count('e'), successes = count('s') + explosive, opportunity = count('o'), strife = count('t');
      const parts = [`if all kept: ${plural(successes, 'success', 'successes')}${explosive ? ` (${explosive} explosive)` : ''}`, plural(opportunity, 'opportunity', 'opportunities'), `${strife} strife`];
      const list = (fs) => fs.map(faceWords).join(', ');
      return { total: successes, short: `${plural(successes, 'success', 'successes')}, ${opportunity} opp, ${strife} strife`, successes, explosive, opportunity, strife, ring: ring.map(faceWords), skill: skill.map(faceWords),
        text: `ring [${list(ring)}]${g.skill ? ` skill [${list(skill)}]` : ''}: ${parts.join(', ')}${g.tn != null ? `; TN ${g.tn}: keep ${g.tn} successes to pass` : ''}${explosive ? '; each explosive kept rolls one more die of its kind' : ''}; keep up to ${g.ring} dice` };
    }
    case 'ex': {
      const D = R.slice(0, g.pool), doubled = D.filter(v => v >= g.double).length, successes = D.filter(v => v >= g.tn).length + doubled;
      const ones = D.filter(v => v === 1).length, botch = successes === 0 && ones > 0;
      const success = g.diff != null ? successes >= g.diff : null, extra = g.diff != null ? successes - g.diff : null;
      const parts = [`${plural(successes, 'success', 'successes')}${doubled ? ` (${doubled} doubled)` : ''}`];
      if (botch) parts.push(`BOTCH (${plural(ones, 'one')})`);
      else if (g.diff != null) parts.push(success ? `success, ${plural(extra, 'threshold success', 'threshold successes')}` : `failure (difficulty ${g.diff})`);
      return { total: successes, short: `${plural(successes, 'success', 'successes')}${botch ? ', BOTCH' : ''}`, successes, doubled, ones, botch, success: botch ? false : success, threshold: success ? extra : null, text: parts.join(', ') };
    }
  }
  return { total: 0, text: '' };
}

// the log's name for the roll ("Vampire pool 7 (2 hunger)")
export function gameTitle(g) {
  switch (g.kind) {
    case 'coc': return `Percentile${g.skill != null ? ` vs ${g.skill}` : ''}${g.bonus ? ` (${plural(g.bonus, 'bonus die', 'bonus dice')})` : ''}${g.penalty ? ` (${plural(g.penalty, 'penalty die', 'penalty dice')})` : ''}`;
    case 'v5': return `Vampire pool ${g.pool}${g.hunger ? ` (${g.hunger} hunger)` : ''}${g.diff != null ? ` vs ${g.diff}` : ''}`;
    case 'sr': return `Shadowrun pool ${g.pool}${g.threshold != null ? ` (threshold ${g.threshold})` : ''}`;
    case 'duality': return `Duality${g.mod ? ` ${sgn(g.mod)}` : ''}${g.diff != null ? ` vs ${g.diff}` : ''}`;
    case 'fate': return `${g.n}dF${g.mod ? ` ${sgn(g.mod)}` : ''}`;
    case 'l5r': return `Rings ${g.ring} ring + ${g.skill} skill${g.tn != null ? ` (TN ${g.tn})` : ''}`;
    case 'ex': { const how = [g.tn !== 7 && `TN ${g.tn}`, g.double === 11 ? 'no doubles' : g.double !== 10 && `double ${g.double}s`].filter(Boolean);
      return `Exalted pool ${g.pool}${how.length ? ` (${how.join(', ')})` : ''}${g.diff != null ? ` vs ${g.diff}` : ''}`; }
  }
  return '';
}

// every die's face, grouped by kind, for the log's [ … ] ("6 10 3 | hunger 10 1", "ring E+T O | skill S")
const GROUP = { 'pool-d10-hunger': 'hunger', 'duality-d12-hope': 'Hope', 'duality-d12-fear': 'Fear', 'ring-d6': 'ring', 'skill-d12': 'skill' };
export function faceList(parsed, rolls) {
  const out = []; let k = 0;
  for (const t of parsed.terms) { if (t.flat != null) continue;
    const vs = rolls.slice(k, k + t.n).map(Number); k += t.n;
    const name = t.tens ? 'tens' : GROUP[t.skin] || (parsed.game.kind === 'coc' ? 'units' : '');
    out.push(`${name ? name + ' ' : ''}${vs.map(v => faceTag(t.skin, t.tens ? (v % 10) * 10 : v, t.tens)).join(' ')}`); }
  return out.join(' | ');
}
// a die's short face text for the number tag over it (and tests): by skin, else the number
export function faceTag(skin, value, tens = false) {
  if (tens) return value ? String(value) : '00'; // (a d10t's value: 0..90)
  if (skin === 'fudge-d6') return FUDGE[value] > 0 ? '+' : FUDGE[value] < 0 ? '−' : '0';
  if (skin === 'ring-d6' || skin === 'skill-d12') { const f = (skin === 'ring-d6' ? RING_FACES : SKILL_FACES)[value]; return f === '' ? '–' : f.toUpperCase().split('').join('+'); }
  return String(value);
}

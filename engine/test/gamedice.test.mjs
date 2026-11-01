// GAME DICE (engine/core/gamedice.js via core/dice.js): every roll word parses to its canonical label (which parses back
// to itself: the playback and an old journal rebuild the same dice), and every tally rule, edges included, on FIXED
// rolls: CoC levels and fumble thresholds, bonus/penalty keep, V5 criticals / messy / bestial / margins, Shadowrun
// glitch and critical glitch, Daggerheart Hope/Fear/doubles, Fate ladder, L5R face tallies, Exalted successes / double 10s
// / botch and its target-number and doubling overrides (2026-10-30). Plain dice unchanged.
import { parseDice, rollDice, tallyOf, faceTag, SKINS } from '../core/dice.js';
import { RING_FACES, SKILL_FACES, FUDGE } from '../core/gamedice.js';
import { diceOfRoll } from '../../tools/spawn-tuner/js/fx/dicephys.js';
let pass = 0, fail = 0;
const check = (ok, name, d = '') => { ok ? pass++ : fail++; if (!ok || process.env.V) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${d ? ' — ' + d : ''}`); };
const T = (expr, rolls) => tallyOf(parseDice(expr).label, rolls);

// ---- the words
const LABELS = {
  'coc 65 bonus 1': 'coc 65 bonus 1', 'roll coc 65 b1': 'coc 65 bonus 1', 'coc 65 +1b': 'coc 65 bonus 1', 'cthulhu 40 penalty 2': 'coc 40 penalty 2',
  'coc 50 bonus': 'coc 50 bonus 1', 'coc': 'coc', 'percentile 30': 'coc 30', 'coc 40 penalty 2 bonus 1': 'coc 40 penalty 1', 'coc 40 bonus 1 penalty 1': 'coc 40',
  'v5 7 hunger 2 diff 3': 'v5 7 hunger 2 diff 3', 'vampire 5 h1': 'v5 5 hunger 1', 'v5 7 2 3': 'v5 7 hunger 2 diff 3', 'vtm 4': 'v5 4', 'v5 6 dice hunger 3': 'v5 6 hunger 3',
  'sr 12': 'sr 12', 'shadowrun 12 thr 3': 'sr 12 threshold 3', 'sr 8 threshold 2': 'sr 8 threshold 2', 'roll sr12': 'sr 12',
  'duality +2': 'duality+2', 'duality 2': 'duality+2', 'duality': 'duality', 'dh -1 diff 14': 'duality-1 diff 14', 'daggerheart+3': 'duality+3', 'duality + 2': 'duality+2',
  '4df+1': '4dF+1', '4dF': '4dF', 'fate': '4dF', 'fudge +2': '4dF+2', 'df': '4dF', '4df 1': '4dF+1', '3df-1': '3dF-1', 'roll 4df+1': '4dF+1',
  'l5r 3 ring 2 skill': 'l5r 3 ring 2 skill', 'l5r ring 3 skill 2': 'l5r 3 ring 2 skill', 'l5r 3r 2s tn 2': 'l5r 3 ring 2 skill tn 2', 'l5r 3 2': 'l5r 3 ring 2 skill', 'rings 2 ring': 'l5r 2 ring 0 skill',
  'ex 8': 'ex 8', 'exalted 15': 'ex 15', 'roll ex8': 'ex 8', 'ex 8 dice': 'ex 8', 'ex 8 tn6': 'ex 8 tn 6', 'ex 8 d9': 'ex 8 double 9', 'ex 8 double 9s': 'ex 8 double 9',
  'ex 8 tn 7 double 10': 'ex 8', 'ex 10 tn6 d8 diff 3': 'ex 10 tn 6 double 8 diff 3', 'ex 6 nodouble': 'ex 6 nodouble', 'ex 6 no doubles': 'ex 6 nodouble', 'ex 6 vs 2': 'ex 6 diff 2',
};
for (const [w, want] of Object.entries(LABELS)) { const p = parseDice(w); check(p?.label === want, `"${w}" -> ${want}`, p?.label); if (p) check(parseDice(p.label)?.label === want, `"${want}" parses back to itself`); }
for (const bad of ['v5', 'v5 3 hunger 4', 'sr 0', 'coc 50 bonus 3', 'l5r', 'v5 7 banana', 'sr 12 +2', 'coc 50 +3', 'duality 2 3', 'roll stealth', 'fate 4 5', 'ex', 'ex 0', 'ex 8 3', 'ex 8 +2', 'ex 8 d6', 'ex 8 tn 11', 'ex 8 tn 1', 'ex 8 d9 nodouble', 'exa 8'])
  check(parseDice(bad) == null, `"${bad}" is not a roll`);
// plain dice: unchanged, no tally
for (const [w, l] of [['d20+5', 'd20+5'], ['2d6', '2d6'], ['d20 adv', 'd20 adv'], ['4d6kh3', '4d6kh3'], ['d100', 'd100']]) { const p = parseDice(w); check(p?.label === l && !p.game, `plain ${w} unchanged`); check(tallyOf(l, [5]) == null, `plain ${w}: no tally`); }

// ---- the dice each roll throws (term order = rolls order), and their skins
const types = (expr, rolls) => diceOfRoll(parseDice(expr).terms, rolls).map(d => `${d.type}${d.skin ? ':' + d.skin : ''}=${d.value}`).join(' ');
check(types('coc 50 bonus 1', [3, 10, 7]) === 'd10t=30 d10t=0 d10=7', 'coc bonus: two tens dice then the units', types('coc 50 bonus 1', [3, 10, 7]));
check(types('v5 3 hunger 1', [6, 10, 1]) === 'd10=6 d10=10 d10:pool-d10-hunger=1', 'v5: regular then hunger', types('v5 3 hunger 1', [6, 10, 1]));
check(types('duality+1', [5, 9]) === 'd12:duality-d12-hope=5 d12:duality-d12-fear=9', 'duality: hope then fear');
check(types('4df', [1, 3, 5, 6]) === 'd6:fudge-d6=1 d6:fudge-d6=3 d6:fudge-d6=5 d6:fudge-d6=6', 'fate: four fudge d6');
check(types('l5r 1 ring 1 skill', [6, 12]) === 'd6:ring-d6=6 d12:skill-d12=12', 'l5r: ring d6, skill d12');
check(types('sr 2', [5, 1]) === 'd6=5 d6=1', 'sr: plain d6');
check(types('ex 3 d9', [10, 7, 1]) === 'd10=10 d10=7 d10=1', 'ex: plain d10');
for (const [k, v] of Object.entries(SKINS)) check(!/cthulhu|vampire|shadowrun|dagger|fate|legend|l5r|v5|exalted/i.test(k) && v.sides > 0, `skin id ${k} is neutral`);
// a real roll's numbers fit the dice and its total is the tally
for (const w of ['coc 60 bonus 2', 'v5 9 hunger 4 diff 4', 'sr 14 threshold 3', 'duality+2 diff 12', '4dF+1', 'l5r 4 ring 3 skill', 'ex 15 tn 6 double 9']) {
  const p = parseDice(w), r = rollDice(p), n = p.terms.reduce((a, t) => a + (t.flat != null ? 0 : t.n), 0);
  check(r.rolls.length === n && r.total === tallyOf(p.label, r.rolls).total, `${w}: ${n} dice, total = tally`, `${r.rolls} -> ${r.total}`);
}
// fixed-random: rollDice with a given rand draws the expected faces
{ let i = 0; const seq = [0.05, 0.95, 0.45]; const r = rollDice(parseDice('coc 50 bonus 1'), () => seq[i++]); check(JSON.stringify(r.rolls) === '[1,10,5]' && r.total === 5, 'coc fixed rand: tens 10/00, units 5 -> 05 (bonus keeps the best)', JSON.stringify(r)); }

// ---- Call of Cthulhu 7e
const coc = (expr, rolls) => T(expr, rolls);
check(coc('coc 50', [1, 1]).level === 'hard', 'coc 11 vs 50: hard (<= 25)');
check(coc('coc 50', [1, 10]).total === 10 && coc('coc 50', [1, 10]).level === 'extreme', 'coc 10 vs 50: extreme (<= 10)');
check(coc('coc 50', [10, 1]).total === 1 && coc('coc 50', [10, 1]).level === 'critical', 'coc 01: critical');
check(coc('coc 50', [10, 10]).total === 100 && coc('coc 50', [10, 10]).level === 'fumble', 'coc 00+0 = 100: fumble');
check(coc('coc 50', [5, 10]).level === 'regular', 'coc 50 vs 50: regular (equal succeeds)');
check(coc('coc 50', [5, 1]).level === 'failure', 'coc 51 vs 50: failure');
check(coc('coc 49', [9, 6]).level === 'fumble', 'coc 96 vs 49: fumble (skill under 50)');
check(coc('coc 49', [9, 5]).level === 'failure', 'coc 95 vs 49: failure, not fumble');
check(coc('coc 50', [9, 6]).level === 'failure', 'coc 96 vs 50: failure (skill 50+: only 100 fumbles)');
check(coc('coc 50', [9, 9]).level === 'failure', 'coc 99 vs 50: failure');
check(coc('coc 99', [9, 9]).level === 'regular', 'coc 99 vs 99: regular');
check(coc('coc 120', [10, 10]).level === 'fumble', 'coc 100 vs 120: still a fumble');
check(coc('coc 20', [10, 4]).level === 'extreme' && coc('coc 20', [10, 5]).level === 'hard', 'coc 20: 04 extreme, 05 hard (ceil? no: floor(20/5)=4)');
check(coc('coc 49', [2, 4]).level === 'hard' && coc('coc 49', [2, 5]).level === 'regular', 'coc 49: half is 24 (floor)');
check(coc('coc 65 bonus 1', [7, 2, 3]).total === 23 && coc('coc 65 bonus 1', [7, 2, 3]).level === 'hard', 'coc bonus keeps the lower tens: 73/23 -> 23 hard');
check(coc('coc 65 penalty 1', [7, 2, 3]).total === 73 && coc('coc 65 penalty 1', [7, 2, 3]).level === 'failure', 'coc penalty keeps the higher: 73');
check(coc('coc 65 bonus 2', [7, 2, 10, 10]).total === 20, 'coc bonus 2, units 0: 70 20 100 -> 20');
check(coc('coc 65 penalty 1', [10, 5, 10]).total === 100 && coc('coc 65 penalty 1', [10, 5, 10]).level === 'fumble', 'coc penalty, units 0: 00 -> 100 is the worst: fumble');
check(coc('coc 65 bonus 1', [10, 5, 1]).total === 1 && coc('coc 65 bonus 1', [10, 5, 1]).level === 'critical', 'coc bonus: 01 vs 51 -> 01 critical');
check(/fumble/.test(coc('coc', [10, 10]).text) && /critical/.test(coc('coc', [10, 1]).text) && /under 50/.test(coc('coc', [9, 7]).text), 'coc without a skill: 100 fumble, 01 critical, 96+ flagged');
check(coc('coc 65 bonus 1', [7, 2, 3]).text === '23, hard success (tens 70 20, best kept)', 'coc text', coc('coc 65 bonus 1', [7, 2, 3]).text);

// ---- Vampire 5e
const v5 = (expr, rolls) => T(expr, rolls);
let t = v5('v5 5', [6, 7, 5, 1, 2]); check(t.successes === 2 && !t.critical, 'v5: 6+ succeeds', JSON.stringify(t));
t = v5('v5 4', [10, 10, 3, 3]); check(t.successes === 4 && t.critical && !t.messy, 'v5: a pair of 10s is 4 successes, a critical');
t = v5('v5 4', [10, 10, 10, 3]); check(t.successes === 5 && t.critical, 'v5: three 10s = one pair (4) + one (1) = 5');
t = v5('v5 4', [10, 10, 10, 10]); check(t.successes === 8, 'v5: four 10s = two pairs = 8');
t = v5('v5 4', [10, 3, 3, 3]); check(t.successes === 1 && !t.critical, 'v5: one 10 alone is one success, no critical');
t = v5('v5 4 hunger 1', [10, 3, 3, 10]); check(t.critical && t.messy && /messy critical/.test(t.text), 'v5: crit with a Hunger 10 -> messy');
t = v5('v5 4 hunger 1', [10, 10, 3, 10]); check(t.critical && t.messy, 'v5: two regular 10s + a Hunger 10 -> messy (any Hunger 10 in a crit)');
t = v5('v5 4 hunger 2', [10, 3, 10, 1]); check(t.messy && t.possibleBestial, 'v5: messy and a Hunger 1 at once');
t = v5('v5 4 hunger 1', [10, 3, 3, 3]); check(!t.critical && !t.messy, 'v5: a lone Hunger 10 with no pair is not messy');
t = v5('v5 3 hunger 1', [3, 3, 1]); check(t.possibleBestial && !t.bestial && /bestial failure if it fails/.test(t.text) && /total failure/.test(t.text), 'v5 no diff: Hunger 1 -> possible bestial', t.text);
t = v5('v5 3 hunger 1 diff 2', [7, 3, 1]); check(t.bestial && !t.win && /bestial failure/.test(t.text), 'v5 diff 2: 1 success + Hunger 1 -> bestial failure', t.text);
t = v5('v5 3 hunger 1 diff 1', [7, 3, 1]); check(!t.bestial && t.win && t.margin === 0, 'v5 diff 1: win by 0, Hunger 1 harmless');
t = v5('v5 3 hunger 1', [1, 3, 5]); check(!t.possibleBestial, 'v5: a 1 on a REGULAR die is nothing');
t = v5('v5 7 hunger 2 diff 3', [10, 6, 2, 3, 4, 10, 8]); check(t.successes === 6 && t.margin === 3 && t.messy && t.text === '6 successes, win by 3, messy critical', 'v5 text', t.text);
t = v5('v5 2 diff 5', [10, 10]); check(t.successes === 4 && !t.win && !t.messy && t.margin === -1 && !/critical/.test(t.text), 'v5: a critical that still fails is not shown as a critical');
check(tallyOf('v5 7 hunger 2', [6, 6, 6, 1, 1, 10, 3]).title === 'Vampire pool 7 (2 hunger)', 'v5 title');

// ---- Shadowrun
const sr = (expr, rolls) => T(expr, rolls);
t = sr('sr 6', [5, 6, 4, 3, 2, 1]); check(t.hits === 2 && !t.glitch, 'sr: 5-6 hit');
t = sr('sr 6', [1, 1, 1, 5, 2, 3]); check(!t.glitch, 'sr: exactly half ones (3 of 6) is NOT a glitch');
t = sr('sr 6', [1, 1, 1, 1, 5, 3]); check(t.glitch && !t.criticalGlitch && t.text === '1 hit, glitch', 'sr: 4 of 6 ones with a hit: glitch', t.text);
t = sr('sr 5', [1, 1, 1, 2, 3]); check(t.glitch && t.criticalGlitch && /CRITICAL GLITCH/.test(t.text), 'sr: 3 of 5 ones, no hits: critical glitch');
t = sr('sr 5', [1, 1, 2, 2, 3]); check(!t.glitch && t.hits === 0, 'sr: 2 of 5 ones: no glitch');
t = sr('sr 1', [1]); check(t.criticalGlitch, 'sr 1 die showing 1: critical glitch');
t = sr('sr 12 threshold 3', [5, 6, 5, 6, 1, 2, 3, 4, 2, 3, 4, 2]); check(t.success && t.net === 1 && /1 net hit/.test(t.text), 'sr threshold: net hits', t.text);
t = sr('sr 4 threshold 3', [5, 6, 2, 2]); check(!t.success && /failure/.test(t.text), 'sr threshold not met');

// ---- Daggerheart
const dh = (expr, rolls) => T(expr, rolls);
t = dh('duality+2', [9, 4]); check(t.total === 15 && t.with === 'hope' && t.text === '15 with Hope (Hope 9, Fear 4, +2)', 'dh with Hope', t.text);
t = dh('duality+2', [4, 9]); check(t.total === 15 && t.with === 'fear' && /with Fear/.test(t.text), 'dh with Fear');
t = dh('duality-1', [7, 7]); check(t.critical && t.total === 13 && /critical success/.test(t.text), 'dh doubles: critical');
t = dh('duality diff 30', [1, 1]); check(t.critical && t.success, 'dh doubles succeed whatever the difficulty');
t = dh('duality diff 12', [6, 5]); check(t.success === false && /failure vs 12/.test(t.text), 'dh 11 vs 12 fails');
t = dh('duality diff 12', [6, 6]); check(t.success, 'dh 12 doubles vs 12');

// ---- Fate
t = T('4dF+1', [6, 5, 3, 1]); check(t.total === 2 && t.faces === '+ + 0 -' && /\+2 Fair/.test(t.text), 'fate +1: + + 0 - = +1, +1 -> +2 Fair', t.text);
t = T('4dF', [1, 2, 1, 2]); check(t.total === -4 && /Abysmal|Terrible/.test(t.text), 'fate -4');
t = T('4dF diff 2', [5, 5, 3, 3]); check(t.shifts === 0 && /tie/.test(t.text), 'fate tie');
check(FUDGE[1] + FUDGE[6] === 0 && FUDGE[2] + FUDGE[5] === 0 && FUDGE[3] === 0 && FUDGE[4] === 0, 'fudge: opposite faces cancel (two +, two -, two blank)');

// ---- L5R
const cnt = (F, f) => F.filter(x => x === f).length;
check(RING_FACES.length === 7 && cnt(RING_FACES, '') === 1 && cnt(RING_FACES, 'ot') === 1 && cnt(RING_FACES, 'o') === 1 && cnt(RING_FACES, 'st') === 1 && cnt(RING_FACES, 's') === 1 && cnt(RING_FACES, 'et') === 1, 'ring die: blank, O+T, O, S+T, S, E+T');
check(SKILL_FACES.length === 13 && cnt(SKILL_FACES, '') === 2 && cnt(SKILL_FACES, 'o') === 3 && cnt(SKILL_FACES, 's') === 2 && cnt(SKILL_FACES, 'st') === 2 && cnt(SKILL_FACES, 'so') === 1 && cnt(SKILL_FACES, 'et') === 1 && cnt(SKILL_FACES, 'e') === 1, 'skill die: 2 blank, 3 O, 2 S, 2 S+T, S+O, E+T, E');
// the distributions: ring 1/2 success, 1/2 strife, 1/3 opportunity; skill 7/12 success, 1/4 strife, 1/3 opportunity
const avg = (F, c) => F.slice(1).reduce((a, f) => a + [...f].filter(x => x === c || (c === 's' && x === 'e')).length, 0) / (F.length - 1);
check(avg(RING_FACES, 's') === 1 / 2 && avg(RING_FACES, 't') === 1 / 2 && Math.abs(avg(RING_FACES, 'o') - 1 / 3) < 1e-9, 'ring die averages');
check(Math.abs(avg(SKILL_FACES, 's') - 7 / 12) < 1e-9 && avg(SKILL_FACES, 't') === 1 / 4 && Math.abs(avg(SKILL_FACES, 'o') - 1 / 3) < 1e-9, 'skill die averages');
t = T('l5r 3 ring 2 skill', [6, 2, 1, 10, 12]); check(t.successes === 3 && t.explosive === 2 && t.opportunity === 2 && t.strife === 2, 'l5r tally: E+T, O+T, blank | S+O, E', JSON.stringify(t));
check(t.ring.join() === 'explosive+strife,opportunity+strife,blank' && t.skill.join() === 'success+opportunity,explosive', 'l5r lists every face');
check(/keep up to 3 dice/.test(t.text) && /explosive/.test(t.text), 'l5r text', t.text);
check(faceTag('ring-d6', 6) === 'E+T' && faceTag('skill-d12', 1) === '–' && faceTag('fudge-d6', 5) === '+' && faceTag('fudge-d6', 2) === '−' && faceTag(null, 7) === '7', 'face tags');

// ---- Exalted (3rd edition core rule; charms move the target number and the doubling)
t = T('ex 8', [7, 8, 9, 10, 1, 2, 3, 6]); check(t.successes === 5 && t.doubled === 1 && t.ones === 1 && !t.botch && t.text === '5 successes (1 doubled)', 'ex: 7 8 9 one each, the 10 two; 6 nothing', t.text);
t = T('ex 4', [10, 10, 10, 10]); check(t.total === 8 && t.doubled === 4, 'ex: four 10s = 8');
t = T('ex 5', [1, 2, 3, 4, 5]); check(t.successes === 0 && t.botch && t.success === false && t.text === '0 successes, BOTCH (1 one)' && t.short === '0 successes, BOTCH', 'ex: no successes and a 1 is a botch', t.text);
t = T('ex 5', [2, 3, 4, 5, 6]); check(!t.botch && t.text === '0 successes', 'ex: no successes, no 1: a failure, not a botch');
t = T('ex 3', [1, 1, 7]); check(!t.botch && t.successes === 1 && t.ones === 2, 'ex: 1s with a success are no botch');
t = T('ex 4 d9 diff 3', [9, 10, 7, 1]); check(t.successes === 5 && t.doubled === 2 && t.success && t.threshold === 2 && t.text === '5 successes (2 doubled), success, 2 threshold successes', 'ex double 9s vs 3: threshold successes', t.text);
t = T('ex 4 tn 6 diff 6', [6, 6, 10, 1]); check(t.successes === 4 && !t.success && /failure \(difficulty 6\)/.test(t.text), 'ex tn 6: 6s succeed; 4 vs 6 fails', t.text);
t = T('ex 3 tn 8', [7, 8, 10]); check(t.successes === 3, 'ex tn 8: a 7 misses');
t = T('ex 3 nodouble', [10, 10, 1]); check(t.successes === 2 && t.doubled === 0, 'ex nodouble: 10s count one');
t = T('ex 2 diff 2', [1, 4]); check(t.botch && /BOTCH/.test(t.text) && !/failure/.test(t.text), 'ex: a botch says BOTCH, not just failure');
check(T('ex 6 tn 6 double 9 diff 2', [1, 1, 1, 1, 1, 1]).title === 'Exalted pool 6 (TN 6, double 9s) vs 2' && T('ex 2 nodouble', [1, 1]).title === 'Exalted pool 2 (no doubles)' && T('ex 2', [5, 5]).faces === '5 5', 'ex title and faces');

// old journals: a line with the wrong number of dice reads no tally (never a crash)
check(tallyOf('v5 7 hunger 2', [1, 2]) == null && tallyOf('v5 7', null) == null, 'mismatched rolls: no tally');
console.log(`gamedice: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

// Dice expressions: d20+5, 2d6+3, 4d6kh3, d20 adv / dis, 1d8+1d6+2. Shared by the browser (the command bar's "roll …",
// client/dice.js) and the relay (an AI seat's dice.roll over GET: the relay rolls, relay/llm.js). parse() is pure;
// roll() draws from crypto. Whoever rolls sends the result: every client animates that result, nobody re-rolls
// (docs/NETCODE.md "Dice"). Moved here from client/dice.js on 2026-10-20 so the relay rolls with the same parser.
const TERM = /^([+-]?)(?:(\d*)d(\d+)(?:(kh|kl)(\d+))?|(\d+))$/i;

export function parseDice(text) {
  let s = String(text || '').trim().toLowerCase().replace(/^roll\s*/, '');
  let mode = null;
  const m = s.match(/\s+(adv|advantage|dis|disadvantage)$/);
  if (m) { mode = m[1].startsWith('adv') ? 'adv' : 'dis'; s = s.slice(0, m.index); }
  s = s.replace(/\s+/g, '');
  if (!s) return null;
  const terms = s.match(/[+-]?[^+-]+/g);
  if (!terms) return null;
  const out = [];
  for (const t of terms) {
    const x = t.match(TERM);
    if (!x) return null;
    const sign = x[1] === '-' ? -1 : 1;
    if (x[6]) { out.push({ sign, flat: +x[6] }); continue; }
    const n = x[2] ? +x[2] : 1, sides = +x[3];
    if (n < 1 || n > 100 || sides < 2 || sides > 1000) return null;
    out.push({ sign, n, sides, keep: x[4] ? { hi: x[4] === 'kh', k: Math.min(n, +x[5]) } : null });
  }
  if (!out.some(t => t.sides)) return null;
  // advantage/disadvantage applies to a single d20 term: roll it twice, keep the high/low one
  if (mode) { const d = out.find(t => t.sides === 20 && t.n === 1); if (!d) return null; d.n = 2; d.keep = { hi: mode === 'adv', k: 1 }; }
  const label = out.map((t, i) => `${i ? (t.sign < 0 ? '-' : '+') : t.sign < 0 ? '-' : ''}${t.flat != null ? t.flat : `${t.n === 1 ? '' : t.n}d${t.sides}${t.keep ? (t.keep.hi ? 'kh' : 'kl') + t.keep.k : ''}`}`).join('');
  return { terms: out, mode, label: mode ? label.replace(/2d20k[hl]1/, 'd20') + ` ${mode}` : label };
}

export function rollDice(parsed, rand = cryptoRand) {
  const rolls = []; let total = 0;
  for (const t of parsed.terms) {
    if (t.flat != null) { total += t.sign * t.flat; continue; }
    const r = Array.from({ length: t.n }, () => 1 + Math.floor(rand() * t.sides));
    rolls.push(...r);
    let kept = r;
    if (t.keep) kept = [...r].sort((a, b) => t.keep.hi ? b - a : a - b).slice(0, t.keep.k);
    total += t.sign * kept.reduce((a, b) => a + b, 0);
  }
  return { rolls, total };
}
function cryptoRand() { const a = new Uint32Array(1); globalThis.crypto.getRandomValues(a); return a[0] / 4294967296; }

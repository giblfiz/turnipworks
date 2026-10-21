// Pawns: the small shared rules behind the pawn's ring (Harry 2026-10-06; docs/UI.md "Pawn ring"). Pure functions,
// used by the relay (enforcement) and the client (what to offer), so the two cannot drift apart.

// INDICATORS: eight persistent markers, in the manner of World of Warcraft's raid markers. One per pawn, floating over
// it for every seat, until cleared. [key, label, colour]
export const MARKS = [
  ['star', 'Star', '#f5d23c'], ['circle', 'Circle', '#f08a2b'], ['diamond', 'Diamond', '#c05ce0'], ['triangle', 'Triangle', '#4fc24a'],
  ['moon', 'Moon', '#cfe0f2'], ['square', 'Square', '#3f9be8'], ['cross', 'Cross', '#e5484d'], ['skull', 'Skull', '#f4f1e8'],
];
export const MARK_KEYS = MARKS.map(m => m[0]);

// WHO GETS THE UNDO FOR A DAMAGE CHANGE (and may press it): the seat that made the change, the pawn's owner, and the
// GM side (Harry 2026-10-06: "great choice. agreed."). To change the audience, change this one function. The relay
// asks it before undoing someone else's damage change; the client asks it before showing the button and its chat line.
//   seat    who is asking       gmSide  is that seat on the GM side
//   by      who made the change owner   the pawn's owner (null = nobody's: the GM's)
export function seesDamageUndo({ seat, gmSide, by, owner }) { return !!gmSide || seat === by || (!!owner && seat === owner); }

// A CHARACTER-SHEET LINK: ordinary web links only (http or https), nothing else. Returns the reason it is refused, or
// null. `cleanSheet` is what gets stored: a bare "dndbeyond.com/characters/1" gets https:// in front.
export const SHEET_MAX = 500;
export function cleanSheet(s) {
  s = String(s ?? '').trim();
  if (s && !/^[a-z][a-z0-9+.-]*:/i.test(s) && /^[\w-]+(\.[\w-]+)+([/:?#]|$)/.test(s)) s = 'https://' + s;
  return s;
}
export function sheetProblem(s) {
  if (typeof s !== 'string') return 'a sheet link is text';
  if (!s) return null; // '' clears it
  if (s.length > SHEET_MAX) return `a sheet link is at most ${SHEET_MAX} characters`;
  if (/[\s<>"'`\\^{}|]/.test(s)) return 'that is not a web link';
  let u; try { u = new URL(s); } catch { return 'that is not a web link (it should start with https://)'; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'only ordinary web links (http or https) can be a sheet link';
  if (!u.hostname || u.username || u.password) return 'that is not an ordinary web link';
  return null;
}
export const sheetHost = (s) => { try { return new URL(s).hostname.replace(/^www\./, ''); } catch { return ''; } };

// DAMAGE, NOT HIT POINTS (Harry 2026-10-06: "easy and better 'HP' answer... instead it's 'damage'. That means 0 is
// always healthy, it also means there isn't that whole 'bloodied' question."). A pawn carries `damage`: a count UP from
// zero. 0 (the field absent) is unhurt, always. There is no maximum to set up, so it works for games that are not D&D,
// and nothing is derived from it (no bloodied, no death at a number). An optional limit could be added later as its
// own field; nothing here assumes there is none.
export const DAMAGE_LIMIT = 9999;
export const damageOf = (e) => e?.damage || 0;
// the damage a pawn ends on after a change: never below 0
export const damageAfter = (damage, d) => Math.max(0, Math.min(DAMAGE_LIMIT, (damage || 0) + d));

// THE TYPED FIELD, one small parser (Fauna's choice; Harry has not ruled on it): the common case is "take 7", so
//   "7" or "+7" adds 7 damage     "-5" heals 5 (never below 0)     "=12" sets it to 12
//   -> { delta } | { set } | null (not understood)
export function parseDamage(text) {
  const t = String(text ?? '').trim().replace(/\u2212/g, '-').replace(/\s+/g, '');
  let m;
  if ((m = t.match(/^([+-]?)(\d{1,4})$/))) return { delta: (m[1] === '-' ? -1 : 1) * +m[2] };
  if ((m = t.match(/^=(\d{1,4})$/))) return { set: +m[1] };
  return null;
}
export const signed = (d) => `${d < 0 ? '\u2212' : '+'}${Math.abs(d)}`;
// "12 → 19 (+7)": the change as well as the total (the 7 is the number said out loud at the table)
export const damageReadout = (from, to) => to === from ? String(from) : `${from} \u2192 ${to} (${signed(to - from)})`;
// the words of the undo line: "Brakka took 7 (19 damage) by Tobias" / "Brakka healed 5 (14 damage) by Tobias"
//   what   the pawn's name, or "3 pawns"      d   the change (null = not one number: several pawns, different changes)
//   to     the damage it ends on (null for several pawns)
export function damageLine(what, d, to, who) {
  const total = to == null ? '' : ` (${to} damage)`;
  return d == null ? `${what} damage changed${total} by ${who}` : d > 0 ? `${what} took ${d}${total} by ${who}` : d < 0 ? `${what} healed ${-d}${total} by ${who}` : `${what} damage unchanged${total} by ${who}`;
}

// A PAWN'S KIND (docs/PAWNS.md, "On the table" and the turn order): its name, lower-case, without a trailing number, so
// "Goblin 1" ... "Goblin 6" are one kind ("goblin") and a renamed "Grishnak" is a kind of his own. ONE function: the
// Pawns menu groups by it and a turn order's `kind:<k>` keys are made of it.
export const pawnKind = (e) => String(e?.name || '').toLowerCase().replace(/\s+#?\d+$/, '').replace(/\s+/g, ' ').trim() || 'pawn';
export const pawnKindLabel = (e) => String(e?.name || 'Pawn').replace(/\s+#?\d+$/, '').trim() || 'Pawn';

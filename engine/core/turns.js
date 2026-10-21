// TURN ORDER AND INITIATIVE (Harry 2026-10-06; docs/PAWNS.md "Turn order and initiative"). Pure functions over an area;
// the relay, every client and the tests run the same code.
//
// THE CORE HAS NO NUMBERS: an order over the pawns in an area, a marker on whose turn it is, Next and Previous, and the
// GM dragging rows at any time. That alone serves a game with no initiative. NUMBERS ONLY SORT IT: a number rolled or
// typed for an entry puts that entry in its place.
//
//   area.turns = { order: [key, ...], at: key | null, round: 1, init: { key: number } }      absent = no order
//
//   key     a pawn's id (a pawn with an owner; or one monster the GM put in on its own), or `kind:<k>` = every pawn
//           without an owner of that kind as ONE entry ("monsters roll once per kind"); <k> = pawnKind (core/pawn.js)
//   at      the key whose turn it is. null just after Start = "gathering initiative": the first Next goes to the first.
//   round   counts up each time the marker passes the end
//   init    the number for a key in THIS fight (no entry = not rolled). The BONUS is on the pawn: token.initBonus.
//
// HIDDEN PAWNS never reach a player seat: forPlayers() is what the relay sends them in place of the real thing.
import { isId } from './ids.js';
import { pawnKind, pawnKindLabel } from './pawn.js';

export const KIND = 'kind:';
export const TURN_ORDER_MAX = 200, INIT_MIN = -99, INIT_MAX = 999, BONUS_MAX = 99;
export const TPL = 'tpl_'; // a kept template that lasts a number of rounds has a thin row of its own (docs/RULERS.md)
export const isTplKey = (k) => typeof k === 'string' && k.startsWith(TPL);
export const isTurnKey = (k) => typeof k === 'string' && (isId(k) ? k.startsWith('tok_') || k.startsWith(TPL) : k.startsWith(KIND) && k.length > KIND.length && k.length <= KIND.length + 80 && !/[\u0000-\u001f]/.test(k));
// a pawn's own key: itself when someone owns it, else its kind
export const turnKeyOf = (e) => e?.owner ? e.id : KIND + pawnKind(e);
const pawnsOf = (area) => Object.values(area?.entities || {}).filter(e => e.kind === 'token');
const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'en', { numeric: true }) || (a.id < b.id ? -1 : 1);

// the pawns an entry stands for. A pawn named in the order by its own id is that entry's, and not also its kind's.
export function keyPawns(area, turns, key) {
  if (!key) return [];
  if (!key.startsWith(KIND)) { const e = area.entities[key]; return e && e.kind === 'token' ? [e] : []; }
  const solo = new Set((turns?.order || []).filter(k => !k.startsWith(KIND)));
  const k = key.slice(KIND.length);
  return pawnsOf(area).filter(e => !e.owner && !solo.has(e.id) && pawnKind(e) === k).sort(byName);
}
// the entry a pawn is in, given an order (its own id if that is in the order, else its kind's key if that is)
export function keyOfPawn(turns, e) {
  if (!turns || !e) return null;
  if (turns.order.includes(e.id)) return e.id;
  const k = KIND + pawnKind(e);
  return !e.owner && turns.order.includes(k) ? k : null;
}
// an entry's initiative bonus: the pawn's own; for a kind, the first pawn of the kind (by name) that has one
export function bonusOf(area, turns, key) {
  for (const e of keyPawns(area, turns, key)) if (Number.isInteger(e.initBonus)) return e.initBonus;
  return null;
}
export const keyLabel = (area, turns, key) => { const ps = keyPawns(area, turns, key); return !ps.length ? (key.startsWith(KIND) ? key.slice(KIND.length) : key) : ps.length > 1 ? `${pawnKindLabel(ps[0])} ×${ps.length}` : ps[0].name; }; // (the last goblin standing is "Goblin 3", not "Goblin")

// "Start fight" with no order given: the pawns that have an owner, by name; then the kinds of the others. Pawns that
// are hidden from players are left out (the GM drags an ambusher in when it joins: turn.order).
export function defaultOrder(area) {
  const ps = pawnsOf(area).filter(e => !e.hidden);
  const owned = ps.filter(e => e.owner).sort(byName).map(e => e.id);
  const kinds = [...new Set(ps.filter(e => !e.owner).sort(byName).map(e => KIND + pawnKind(e)))];
  return [...owned, ...kinds];
}
export const cleanOrder = (order) => [...new Set(order)];
export const orderProblem = (order) => !Array.isArray(order) || order.length > TURN_ORDER_MAX ? `order: a list of at most ${TURN_ORDER_MAX} keys` : order.every(isTurnKey) ? null : 'order: each key is a pawn id (tok_…) or kind:<name>';
export const newTurns = (order) => ({ order: cleanOrder(order), at: null, round: 1, init: {} });
const pickInit = (init, order) => Object.fromEntries(Object.entries(init || {}).filter(([k]) => order.includes(k)));

// the order as dragged: the marker stays on its entry if that is still in the order
export function reorder(turns, order) {
  order = cleanOrder(order);
  if (!turns) return newTurns(order);
  return { ...turns, order, at: order.includes(turns.at) ? turns.at : null, init: pickInit(turns.init, order) };
}
// Next / Previous. An entry none of whose pawns is on the table any more is passed over (a dead goblin's turn does
// not come up). Past the end: the first, and the round counts up. Back past the start: the last of the round before;
// in round 1 the marker comes off (back to "gathering initiative").
export function step(area, turns, dir) {
  const live = turns.order.filter(k => keyPawns(area, turns, k).length);
  if (!live.length) return turns;
  const i = live.indexOf(turns.at);
  if (dir > 0) {
    if (turns.at == null || (i < 0 && turns.order.indexOf(turns.at) < 0)) return { ...turns, at: live[0] };
    // (the marker's own entry may have died: go on from where it stood in the full order)
    const from = turns.order.indexOf(turns.at), next = turns.order.slice(from + 1).find(k => live.includes(k));
    return next ? { ...turns, at: next } : { ...turns, at: live[0], round: turns.round + 1 };
  }
  if (turns.at == null) return turns;
  const from = turns.order.indexOf(turns.at), prev = turns.order.slice(0, Math.max(0, from)).reverse().find(k => live.includes(k));
  if (prev) return { ...turns, at: prev };
  return turns.round > 1 ? { ...turns, at: live.at(-1), round: turns.round - 1 } : { ...turns, at: null };
}
// NUMBERS SORT IT. Setting an entry's number moves ONLY that entry: it goes in front of the first entry that has no
// number, a lower number, or the same number and a lower bonus. So the highest goes first; on a TIE the higher bonus
// goes first; still tied, whoever was already in the order stays ahead of the newcomer. Everything else keeps the
// place the GM dragged it to. n = null takes the number away and leaves the entry where it is.
export function setInit(area, turns, key, n) {
  if (n == null) { if (!(key in turns.init)) return turns; const { [key]: _, ...init } = turns.init; return { ...turns, init }; }
  const init = { ...turns.init, [key]: n }, rest = turns.order.filter(k => k !== key), b = bonusOf(area, turns, key) || 0;
  let i = rest.findIndex(k => !(k in init) || init[k] < n || (init[k] === n && (bonusOf(area, turns, k) || 0) < b));
  if (i < 0) i = rest.length;
  return { ...turns, order: [...rest.slice(0, i), key, ...rest.slice(i)], init };
}

// TEMPLATES THAT LAST A NUMBER OF ROUNDS (docs/RULERS.md "Rounds"). A kept template with `rounds` has a thin row in
// the order: its key is its own id (tpl_…). The row is never anybody's turn: the marker passes it, and each time it
// does the template's `left` goes down by one.
//   WHERE THE ROW SITS: just BEFORE its creator's entry (the pawn it was cast from, `src`; else the first pawn its
//   owner has in the order; else, the GM's, before the entry whose turn it is; else last). So "1 round" runs out as
//   the turn comes back round to its creator: until the start of their next turn. The GM may drag it anywhere.
//   AT ZERO IT DOES NOT VANISH: it is `left: 0`, "expired", and its owner and the GM are asked Remove / Keep. If nobody
//   answers, the NEXT time the turn moves on it is removed (Remove is the default).
//   Previous gives a round back to the rows it passes back over (a template already removed stays removed).
// With no fight running nothing counts: the template is simply kept, and gets its row when a fight starts.
const timed = (area) => Object.values(area?.entities || {}).filter(e => e.kind === 'template' && e.rounds > 0);
export const leftOf = (e) => Number.isInteger(e?.left) ? e.left : e?.rounds || 0;
export const isTimed = (area, key) => { const e = area?.entities?.[key]; return !!e && e.kind === 'template' && e.rounds > 0; };
function tplIndex(area, turns, order, e) {
  const src = e.src && area.entities[e.src], sk = src && keyOfPawn({ ...turns, order }, src);
  if (sk) return order.indexOf(sk);
  const own = e.owner ? order.findIndex(k => !k.startsWith(KIND) && !isTplKey(k) && area.entities[k]?.owner === e.owner) : -1;
  if (own >= 0) return own;
  const at = turns.at ? order.indexOf(turns.at) : -1;
  return at >= 0 ? at : order.length;
}
// the order with this template's row put in its place (unchanged when it is there already, or has no rounds)
export function withTemplate(area, turns, e) {
  if (!turns || !e || !(e.rounds > 0) || turns.order.includes(e.id)) return turns;
  const order = turns.order.slice(); order.splice(tplIndex(area, turns, order, e), 0, e.id);
  return { ...turns, order };
}
// ... and with every timed template of the area in it (Start; and a row whose key was lost is put back, last)
export function withTemplates(area, turns) { let t = turns; for (const e of timed(area).sort((a, b) => (a.id < b.id ? -1 : 1))) t = withTemplate(area, t, e); return t; }
// the rows the marker passes going forward from `a.at` to `b.at`
function passed(area, a, b) {
  const o = a.order, i = o.indexOf(a.at), j = o.indexOf(b.at);
  if (a.at == null || b.at == null || i < 0 || j < 0) return [];
  return (j > i ? o.slice(i + 1, j) : [...o.slice(i + 1), ...o.slice(0, j)]).filter(k => isTimed(area, k));
}
// the templates a Next or a Previous may change (the commands' `touches`: undo, staleness, what is hidden from whom)
export const tickTouches = (area) => area?.turns ? timed(area).map(e => e.id) : [];
// NEXT / PREVIOUS ON THE WHOLE AREA: the marker moves (step), and the templates it passes count.
export function advance(area, dir) {
  const turns = area?.turns; if (!turns) return area;
  const full = withTemplates(area, turns), next = step(area, full, dir);
  const entities = { ...area.entities };
  if (dir > 0) {
    if (next !== full) for (const e of timed(area)) if (leftOf(e) === 0) delete entities[e.id]; // expired a turn ago, never answered: removed
    for (const k of passed(area, full, next)) { const e = entities[k]; if (e && leftOf(e) > 0) entities[k] = { ...e, left: leftOf(e) - 1 }; }
  } else for (const k of passed(area, next, full)) { const e = entities[k]; if (e && leftOf(e) < e.rounds) entities[k] = { ...e, left: leftOf(e) + 1 }; }
  return { ...area, entities, turns: next };
}

// WHAT A PLAYER SEAT IS SENT. An entry all of whose pawns are hidden from players is not in it: not in the order, not
// in the numbers. The marker is never on such an entry: it stays on the nearest entry before it that players can see
// (in round 1 with none before it: no marker), so a hidden monster's turn looks like nothing happening, and never like
// "someone you cannot see is acting". Returns null when there is no order.
export function forPlayers(area) {
  const turns = area?.turns;
  if (!turns) return null;
  const seen = (k) => isTplKey(k) ? isTimed(area, k) && !area.entities[k].hidden : keyPawns(area, turns, k).some(e => !e.hidden);
  const order = turns.order.filter(seen);
  let at = turns.at;
  if (at != null && !order.includes(at)) {
    const i = turns.order.indexOf(at);
    at = turns.order.slice(0, Math.max(0, i)).reverse().find(k => order.includes(k)) ?? (turns.round > 1 ? order.at(-1) ?? null : null);
  }
  return { order, at, round: turns.round, init: pickInit(turns.init, order) };
}
// the pawns whose turn it is (for the mark on the table), as this seat's own data has them
export const currentPawns = (area) => area?.turns?.at ? keyPawns(area, area.turns, area.turns.at) : [];

// THE ROWS, resolved, in order: what a menu or an AI seat reads. Pawns on the table that are in no entry come after,
// as `out: true` rows (a menu lists them under the order; the GM drags one in).
export function turnRows(area, { all = true } = {}) {
  const turns = area?.turns;
  if (!turns) return [];
  const rows = [];
  for (const key of withTemplates(area, turns).order) {
    if (isTplKey(key)) { // a template that lasts a number of rounds: a thin row, never anybody's turn
      const e = area.entities[key]; if (!isTimed(area, key)) continue;
      rows.push({ key, ids: [], tpl: true, shape: e.shape, size: e.size, name: e.name || null, owner: e.owner || null, rounds: e.rounds, left: leftOf(e), expired: leftOf(e) === 0, init: null, bonus: null, current: false, ...(e.hidden && { hidden: true }) });
      continue;
    }
    const ps = keyPawns(area, turns, key);
    if (!ps.length) continue; // gone from the table: skipped when drawn
    rows.push({ key, ids: ps.map(e => e.id), name: keyLabel(area, turns, key), kind: key.startsWith(KIND), owner: key.startsWith(KIND) ? null : ps[0].owner || null, init: turns.init[key] ?? null, bonus: bonusOf(area, turns, key), current: turns.at === key, ...(ps.every(e => e.hidden) && { hidden: true }) });
  }
  if (all) {
    const inOrder = new Set(rows.flatMap(r => r.ids)), outs = new Map();
    for (const e of pawnsOf(area).filter(e => !inOrder.has(e.id)).sort(byName)) { const k = turnKeyOf(e); if (!outs.has(k)) outs.set(k, []); outs.get(k).push(e); }
    for (const [key, ps] of outs) rows.push({ key, ids: ps.map(e => e.id), name: ps.length > 1 ? `${pawnKindLabel(ps[0])} ×${ps.length}` : ps[0].name, kind: key.startsWith(KIND), owner: key.startsWith(KIND) ? null : ps[0].owner || null, init: null, bonus: ps.find(e => Number.isInteger(e.initBonus))?.initBonus ?? null, current: false, out: true, ...(ps.every(e => e.hidden) && { hidden: true }) });
  }
  return rows;
}

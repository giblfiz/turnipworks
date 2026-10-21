// THE PARTY, A PLAYER'S PAWNS AND THE GM'S CAST (Harry 2026-10-06; docs/PAWNS.md). Campaign data, beside the areas
// (Harry: "the pawn collection is basically part of the set of maps... it's literally just a line of json"):
//   state.pawns  { id: Def }   a player's defined pawns ("Settings ▸ Me ▸ My pawns"). A pawn that is defined and not on
//                              any table is ON THE BENCH. No limit, no approval.
//                Def { id, owner (a human seat), name, fig?, size?, sheet?, notes?, petOf? (another of the owner's
//                      defs: whose pet or familiar it is), main? (the owner's main pawn: full detail on the table) }
//   state.cast   { id: Cast }  the GM's bench: named individuals and saved groups. GM side only: never sent to a player.
//                Cast { id, kind: 'one' | 'group', name, at (campaign seq when last saved or used: recents first),
//                       one:   fig?, size?, sheet?, notes?, gmNotes?
//                       group: members: [{ name, fig?, size?, dx, dz }] (dx, dz: feet from the group's lead) }
//   state.party  { notes, order }   one shared text everyone edits; the marching order (seat ids)
// A pawn on a table that came from a definition carries `def` (the Def's or the Cast's id).
// Pure functions: the relay uses them to decide what each seat is SENT, the client to draw it.
import { canSee, liveSeat, principalOf, isGmSide } from './perms.js';

export const PARTY_NOTES_MAX = 4000, DEFS_PER_SEAT = 200, CAST_MAX = 500, GROUP_MAX = 30;

// every pawn that belongs to a person, in the areas this viewer can see, as the party rows need it. Things the
// viewer may not know are simply absent: a pawn hidden from players, a pawn in a hidden area, GM notes.
export function partyPawns(state, viewer) {
  const gm = isGmSide(state, viewer), out = [];
  for (const aid of state.areaOrder) {
    if (!canSee(state, viewer, aid)) continue;
    for (const e of Object.values(state.areas[aid].entities)) {
      if (e.kind !== 'token' || !e.owner || (e.hidden && !gm) || !liveSeat(state, e.owner)) continue;
      out.push({ id: e.id, area: aid, owner: e.owner, name: e.name, ...(e.fig && { fig: e.fig }), ...(e.size > 1 && { size: e.size }), ...(e.main && { main: true }), ...(e.damage > 0 && { damage: e.damage }),
        ...(e.conditions?.length && { conditions: e.conditions }), ...(e.mark && { mark: e.mark }), ...(e.sheet && { sheet: e.sheet }), ...(e.def && { def: e.def }), ...(e.lender && { lender: e.lender }), ...(e.hidden && { hidden: true }) });
    }
  }
  return out;
}
// where each definition's pawn stands now: def id -> area id (a pawn hidden from players still counts: it is not on the bench)
export function defPlaces(state) {
  const at = {};
  for (const aid of state.areaOrder) for (const e of Object.values(state.areas[aid].entities)) if (e.kind === 'token' && e.def) at[e.def] = aid;
  return at;
}
// the definitions a seat is sent: its own (an agent: its person's), and for the GM side everyone's.
//   at     the area its pawn is in, when this viewer can see that area      away   on a table this viewer cannot see
export function defsFor(state, viewer) {
  const who = principalOf(state, viewer)?.id, gm = isGmSide(state, viewer), at = defPlaces(state);
  return Object.values(state.pawns || {}).filter(d => gm || d.owner === who).map(d => {
    const a = at[d.id] || null, seen = !!a && canSee(state, viewer, a) && (gm || !Object.values(state.areas[a].entities).some(e => e.def === d.id && e.hidden));
    return { ...d, at: seen ? a : null, ...(a && !seen && { away: true }) };
  });
}
export const castFor = (state, viewer) => isGmSide(state, viewer) ? Object.values(state.cast || {}).sort((a, b) => (b.at || 0) - (a.at || 0)) : undefined;
export function partyFor(state, viewer) {
  const p = state.party || {};
  const pawns = partyPawns(state, viewer), portraits = {}, placed = defPlaces(state);
  // A benched main character remains a person's portrait. For a pawn on a table use only the
  // already-filtered party view, so hiding a pawn/area cannot disclose its figure through an avatar.
  for (const d of Object.values(state.pawns || {})) if (d.main && d.fig && !placed[d.id] && liveSeat(state, d.owner)) portraits[d.owner] = d.fig;
  for (const e of pawns) if (e.main && e.fig) portraits[e.owner] = e.fig;
  return { notes: p.notes || '', order: (p.order || []).filter(id => liveSeat(state, id)), pawns, portraits };
}
// has anything the party rows or the benches show changed? (the relay sends fresh campaign views when this text does)
export function partySignature(state) {
  const out = [];
  for (const aid of state.areaOrder) for (const e of Object.values(state.areas[aid].entities)) if (e.kind === 'token' && (e.owner || e.def)) out.push([aid, e.id, e.owner, e.name, e.fig, e.size, e.main, e.damage, e.conditions, e.mark, e.sheet, e.def, e.lender, e.hidden]);
  return JSON.stringify(out);
}

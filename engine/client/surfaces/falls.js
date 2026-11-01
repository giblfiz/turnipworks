// FALLING (Harry 2026-10-22, item 4: "If you drag a pawn out over open air, it should give you a contextual option to
// 'fall xx feet?' and then place them down several levels. This is distinct from height adjusting.").
//
// WHEN. A pawn that STOOD where it was (its figure under PAWN_BEAM.land, 5 ft, above its base) is moved to where it
// stands on nothing: let go past a balcony's edge or beyond an upper room, over a hole or a pit's opening (core/holes.js),
// walked off a ledge with the arrow keys. It is NOT put down on whatever is under the pointer far below: it stays where
// it was let go, at its height, hovering exactly like a raised pawn (the beam down to its base, the height on it), and
// this offer appears beside it (main.js moveBy finds it; client/input.js keeps it on the drag's plane). A pawn that was
// already up (raised: flying) is moved as ever and offered nothing; raise / lower is a different thing.
//
// THE OFFER is a conditional button (surfaces/condbutton.js: beside the pawn, never over it, never takes the focus;
// RARE: this one follows what the person just did with something they may well want next), "Fall 20 ft?": the real
// drop, from the figure to the first thing under it (a floor, the ground, a room's top, a table; never below the
// lowest floor). Taking it puts the pawn there (one token.move, synced like any move: every seat sees it land) and says
// so in the chat, "Brakka falls 20 ft", as ONE command (one undo puts the pawn back up and takes the line away). A
// fall is a game event (damage is rolled for it), so it is named; a stair is not (it says nothing). A pawn hidden from
// players falls without a line. Ignored, the button goes down into the chat after FALL_OFFER_MS as a local line
// "Brakka is over a 20-ft drop · [Fall 20 ft]", good for as long as the pawn is still hanging there.
// Also in the bar: "fall" with the pawn selected (any pawn that is up: a flyer knocked out of the sky too).
// PITS (core/holes.js PIT_CATS): a pawn put down on a pit with its own bottom (the spike pit, a painted pit or chasm, a
// through pit with nothing under it) is offered "Fall into the spike pit?"; taking it puts it in the pit's middle at its
// bottom and says "Kit falls into the spike pit". A through pit over a floor is an opening: the ordinary drop above.
import { newId } from '../../core/ids.js';

export const FALL_OFFER_MS = 8000;
const KEY = 'fall';
const r2 = (v) => Math.round(v * 100) / 100;

export function fallsSurface(R, app) {
  const ents = () => app.entities();
  const LAND = () => app.pawnLiftStep || 5;
  // where each of these pawns would land, as they are now: [{ e, base, drop, pit? }] (only the ones with somewhere to fall).
  // A pawn up over a drop falls onto what is under it; a pawn standing on a pit (core/holes.js PIT_CATS) falls into it.
  const plan1 = (e, x = e.x, y = e.y || 0, z = e.z) => {
    const D = app.pawnDropAt(e, x, y, z); if (D.drop >= 0.5) return { e, ...D };
    const P = app.pitAt?.(e, x, y, z); return P ? { e, base: P.y, drop: 0, pit: P } : null;
  };
  const plan = (ids) => ids.map(id => ents()[id]).filter(e => e?.kind === 'token' && app.canTouch(e)).map(e => plan1(e)).filter(Boolean);
  const ft = (n) => `${Math.round(n)} ft`;
  const dropText = (P) => { const lo = Math.min(...P.map(p => p.drop)), hi = Math.max(...P.map(p => p.drop)); return Math.round(lo) === Math.round(hi) ? ft(hi) : `${Math.round(lo)}–${ft(hi)}`; };
  const nameOf = (P) => P.length === 1 ? (P[0].e.name || 'The pawn') : `${P.length} pawns`;
  const pitName = (P) => P.every(p => p.pit && p.pit.pit === P[0].pit.pit) ? P[0].pit.name : null; // all into one pit: its name
  // THE FALL: every pawn onto what is under it (or into the pit it is on), and the chat line, as one command. -> the command id, or null
  app.fall = (ids, { area = app.area(), say = true } = {}) => {
    const P = plan(ids); if (!P.length) return null;
    const one = P.length === 1;
    const ops = P.map(p => p.pit ? { type: 'token.move', args: { id: p.e.id, x: r2(one ? p.pit.x : p.e.x), z: r2(one ? p.pit.z : p.e.z), y: r2(p.pit.y) } } : { type: 'token.move', args: { id: p.e.id, x: p.e.x, z: p.e.z, y: r2(p.base) } });
    const seen = P.filter(p => !p.e.hidden), nm = (p) => p.e.name || 'a pawn';
    const lineOf = (p) => p.pit ? `${p.e.name || 'A pawn'} falls into ${p.pit.name}` : `${p.e.name || 'A pawn'} falls ${ft(p.drop)}`;
    if (say && seen.length) ops.push({ type: 'chat.say', args: { id: newId('msg'), text: seen.length === 1 ? lineOf(seen[0]) : pitName(seen) ? `${seen.map(nm).join(', ')} fall into ${pitName(seen)}` : `${seen.map(nm).join(', ')} fall ${dropText(seen)}` } });
    const cid = app.batch(ops, area);
    app.falls.last = cid ? { cid, ids: P.map(p => p.e.id), drops: P.map(p => r2(p.drop)), to: P.map(p => r2(p.pit ? p.pit.y : p.base)), pits: P.map(p => p.pit?.pit || null) } : null;
    cb()?.hide(KEY);
    return cid;
  };
  const cb = () => app.condButtons;
  // the offer is good while every pawn is still where it was left (the same place, the same height) and still over the drop (or on the pit)
  const stillThere = (d) => {
    if (d.area !== app.area()) return 'in another area';
    for (const p of d.at) { const e = ents()[p.id]; if (!e) return 'the pawn is gone'; if (Math.abs(e.x - p.x) > 0.05 || Math.abs(e.z - p.z) > 0.05 || Math.abs((e.y || 0) - p.y) > 0.05) return 'it has moved'; }
    return plan(d.at.map(p => p.id)).some(p => p.drop >= LAND() || p.pit) ? null : 'it is not over a drop now';
  };
  app.actionLines?.kind(KEY, { restorable: false, valid: stillThere, run: (d) => { const why = stillThere(d); if (why) return why; app.fall(d.at.map(p => p.id), { area: d.area }); return null; } });
  const F = app.falls = {
    life: FALL_OFFER_MS, last: null, offered: null,
    // at: [{ id, x, y, z, pit? }] where the pawns were just put (the move may not have come back from the relay yet)
    offer(at) {
      const area = app.area();
      const P = at.map(p => { const e = ents()[p.id]; return e && plan1(e, p.x, p.y, p.z); }).filter(p => p && (p.drop >= LAND() || p.pit));
      if (!P.length) return null;
      const lead = at.find(p => p.id === P[0].e.id), name = nameOf(P), pit = P.every(p => p.pit) ? pitName(P) || 'the pits' : null, drop = pit ? null : dropText(P.filter(p => !p.pit));
      const d = { area, at: at.filter(p => P.some(q => q.e.id === p.id)), drop, pit };
      const text = pit ? `Fall into ${pit}?` : `Fall ${drop}?`;
      F.offered = { ids: d.at.map(p => p.id), drop, pit, text };
      cb()?.hide(KEY); // (in place: the offer for where it hung a moment ago is not a line for the chat)
      cb()?.show(KEY, {
        cls: 'uchip fallchip', icon: 'arrow-down', text, anchor: [lead.x, lead.z, lead.y], area, life: FALL_OFFER_MS, doneText: pit ? 'Fell in' : `Fell ${drop}`, data: d,
        when: () => d.used || !stillThere(d), // moved again, gone, landed some other way: the offer goes
        line: { kind: KEY, text: pit ? `${name} ${P.length === 1 ? 'is' : 'are'} at the edge of ${pit}` : `${name} ${P.length === 1 ? 'is' : 'are'} over a ${drop.replace(' ft', '-ft')} drop`, button: pit ? `Fall into ${pit}` : `Fall ${drop}`, data: d },
        run: () => { d.used = true; app.fall(d.at.map(p => p.id), { area: d.area }); },
      });
      return F.offered;
    },
    // is this pawn hanging where an offer left it (the offer still up)? Moved on over the air, it is offered again
    hanging: (id) => !!cb()?.get(KEY)?.spec.data?.at.some(p => p.id === id && !p.pit),
    offer_: () => cb()?.get(KEY)?.spec.data || null, // (tests)
  };
  return { name: 'falls' };
}
// (the bar's "fall": surfaces/falls.js's app.fall, from client/commands.js): a pawn that is up, or standing on a pit
export const fallWhen = (app, sel) => sel.length > 0 && sel.every(e => e.kind === 'token' && app.canTouch(e) && (app.pawnDropAt(e, e.x, e.y || 0, e.z).drop >= 0.5 || !!app.pitAt?.(e)));

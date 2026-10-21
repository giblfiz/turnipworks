// A FLOOR DRAGGED ONTO A ROOM CHANGES THE WHOLE FLOOR (Harry 2026-10-11: "When dragging in floor tiles, it should by
// default change the entire floor, and then offer a contextual option to only do tiles in the object style").
//
// HOW A FLOOR IS HELD. Two things, and the picture is both:
//   the room's floor    recipe.floor on the room entity: a floor material id ('floor-planks-oak'), or 'auto' = the room
//                       type's own (core/roomgen.js floorFor). The shell draws it under every square of the room,
//                       whatever the room's shape (an L, an upper storey). Changed by `room.set { id, floor }`.
//   painted tiles       ordinary objects { place: 'tile' }, one per 5-ft square, drawn INSTEAD of the room's floor on
//                       their square (client/tiles.js). Laid by the paint tool; moved, copied and deleted like things.
//
// THE DROP (client/modes.js placeAt, only for a drag out of a list: the library window, the command bar):
//   on a room, by a seat that may change rooms   ONE command: the room's floor becomes the material. One undo step.
//                                                TILES PAINTED BY HAND STAY (Harry 2026-10-11: "Let's keep hand
//                                                painted floor tiles"): they lie on top of the new floor, as they
//                                                lay on the old one. A hand-painted tile of the SAME material as
//                                                the new floor stays too: it cannot be told from the floor round
//                                                it, it costs nothing, and it is still there if the floor changes
//                                                again (the drop never deletes anything).
//   anywhere else (open ground, a locked room,   one tile on the square under the drop, as before
//   a seat that may not change rooms)
// THEN THE OFFER: a conditional button beside the drop, "Only this tile" (surfaces/condbutton.js: it floats for
// FLOOR_OFFER_MS, then goes down into the chat as a line with the same button; the `.` key presses it). Pressing it
// takes the whole-floor change back BY ITS NUMBER IN THE LOG (so the room's old floor and its painted tiles are exactly
// as they were) and lays the one tile where the drop was. The undone change leaves nothing on this seat's undo stack
// and the relay clears the redo when the tile is laid, so there is ONE step to undo either way: Ctrl/⌘+Z after
// "Only this tile" removes the tile and the room is as it was before the drag.
// The offer is honest for as long as it lives: it goes (or its line greys, with the reason) once that change has been
// undone, the room has been changed again, or the room is gone (surfaces/undochips.js app.undoState).
import { paintOps, tileName } from '../tiles.js';

export const FLOOR_OFFER_MS = 8000; // how long "Only this tile" floats beside the drop before it goes down into the chat
const KEY = 'floor-tile';

export function floorDropSurface(R, app) {
  const pending = new Map(); // cid of a whole-floor change -> what the offer needs, until the relay gives it its number
  const valid = (d) => d.area !== app.area() ? 'in another area' : app.undoState(d);
  const until = (test, ms) => new Promise((done) => { const t0 = performance.now(); (function poll() { if (test() || performance.now() - t0 > ms) done(); else setTimeout(poll, 30); })(); });
  async function justTile(d) {
    const why = valid(d); if (why) return why;
    const m = await app.await(app.sync.submitRaw({ type: 'undo', area: d.area, args: { seq: d.seq } }));
    if (!m) return 'could not be changed';
    await until(() => app.undoState(d) === 'already undone', 10000); // this page has seen the old floor (and its tiles) come back
    const ops = paintOps(app, d.cat, [d.cell], { y: d.y });
    FD.last = { how: 'tile', seq: d.seq, cid: ops.length ? app.batch(ops, d.area) : null };
    return null;
  }
  const FD = app.floorDrop = {
    life: FLOOR_OFFER_MS, last: null,
    // the whole floor of `room` becomes `cat`, as one command; p: where the drop was (modes.placementAt)
    whole(room, cat, p) {
      const area = app.area();
      const cid = app.batch([{ type: 'room.set', args: { id: room.id, floor: cat.id } }], area); // (the room's hand-painted tiles are left alone)
      if (!cid) return null;
      pending.set(cid, { area, by: app.me(), room: room.id, roomName: app.nameOf(room), cat: cat.id, cell: p.cell, x: p.x, z: p.z, y: p.y || 0, ids: [room.id], type: 'room.set', thing: 'room' });
      FD.last = { how: 'whole', cid, room: room.id, cat: cat.id };
      return cid;
    },
    justTile,
    offer: () => app.condButtons.get(KEY)?.spec.data || null, // (tests)
  };
  app.actionLines?.kind(KEY, { restorable: false, valid, run: (d) => justTile(d) });
  app.on((what, e) => {
    if (what !== 'entry' || !e?.cid || !pending.has(e.cid)) return;
    const d = { ...pending.get(e.cid), seq: e.seq }; pending.delete(e.cid);
    if (FD.last?.cid === e.cid) FD.last.seq = e.seq;
    const name = tileName(d.cat).replace(/ floor$/, '');
    app.condButtons.show(KEY, {
      cls: 'uchip floorchip', icon: 'layout-grid', text: 'Only this tile', anchor: [d.x, d.z, d.y + 1], area: d.area, life: FLOOR_OFFER_MS, doneText: 'One tile', data: d,
      when: () => d.used || !valid(d), // undone, changed again, gone: the offer goes
      line: { kind: KEY, text: `${d.roomName}: the whole floor is now ${name}`, button: 'Only this tile', data: d },
      run: () => { const go = justTile(d); d.used = true; go.then(why => { if (why) app.toast(`Only this tile: ${why}`, true); }); },
    });
  });
  return { name: 'floordrop' };
}

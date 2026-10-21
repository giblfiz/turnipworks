// Floating undo chips (Harry 2026-10-03): whenever ANOTHER seat changes something in the area the GM is looking at,
// a small "Undo <who>'s <what>" chip floats beside the change, for the GM side only. One chip per seat (a newer
// change by the same seat moves it), it fades after a while, and one click undoes exactly that change (the relay's
// per-seat undo, by seq). It is visual, not a log: older changes stay reachable through the ghost trail in the bar
// ("undo <name>"). The first-visit intro's phantom seat is its first use.
// It is the first CONDITIONAL BUTTON (surfaces/condbutton.js, docs/UI.md): this file only says when one appears, where
// its home is (beside the change) and what it does; the component enforces the pattern's rules.
import { createConditionalButtons } from './condbutton.js';
import { seesDamageUndo, damageLine } from '../../core/pawn.js';

// A DAMAGE CHANGE'S UNDO (Harry 2026-10-06: "everyone can change everyones HP by default, and it comes with an undo
// float"; the number became damage the same day): how long it floats beside the pawn before it goes down into the
// chat, and how close together one seat's changes to one pawn must be to count as one ("take 3, no, 7": one line with
// the total).
export const DAMAGE_LIFE_MS = 6000, DAMAGE_MERGE_MS = 2500;

const LIFE_MS = 9000, CELL = 5;
const NOUN = { 'room.spawn': 'room', 'room.reroll': 're-roll', 'room.delete': 'deletion', 'room.move': 'move', 'room.rotate': 'turn', 'room.set': 'room change', 'building.set': 'rename',
  'object.place': 'placement', 'object.move': 'move', 'object.delete': 'deletion', 'object.set': 'change', 'object.replace': 'swap', 'object.open': 'door', 'object.light': 'light',
  'edge.set': 'wall change', 'edge.reset': 'wall change',
  'token.create': 'new pawn', 'token.move': 'move', 'token.set': 'change', 'token.delete': 'deletion', 'entity.flag': 'change', batch: 'changes', 'transfer.in': 'arrival', 'transfer.out': 'send-off' };

// what the chat line says: "<who> <did> <thing>"
const DID = { 'room.spawn': 'built', 'room.reroll': 're-rolled', 'room.delete': 'deleted', 'room.move': 'moved', 'room.rotate': 'turned', 'room.set': 'changed', 'building.set': 'renamed',
  'object.place': 'placed', 'object.move': 'moved', 'object.delete': 'deleted', 'object.set': 'changed', 'object.replace': 'swapped', 'object.open': 'opened or shut', 'object.light': 'lit or put out',
  'edge.set': 'changed a wall', 'edge.reset': 'changed a wall', 'token.create': 'added', 'token.move': 'moved', 'token.set': 'changed', 'token.delete': 'deleted', 'entity.flag': 'changed', batch: 'changed several things', 'transfer.in': 'brought in', 'transfer.out': 'sent off' };
const DELETES = new Set(['room.delete', 'object.delete', 'token.delete', 'transfer.out']);
// the entity ids an entry changed (as far as its arguments say)
const idsOf = (e) => { const a = e?.args || {}; return [...new Set([a.id, ...(a.ids || []), ...(a.ops || []).flatMap(o => idsOf(o)), a.entity?.id, ...Object.keys(a.set || {})].filter(Boolean))]; };

export function undoChipsSurface(R, app) {
  const cb = app.condButtons = createConditionalButtons(app, document.getElementById('undoChips'));
  const keyOf = (seat) => `undo:${seat}`;
  app.damageChips = () => cb.list().filter(b => b.key.startsWith('dmg:')).map(b => ({ key: b.key, text: b.text, visible: b.visible, seqs: b.data?.seqs || [], ids: b.data?.ids || [], by: b.data?.by })); // (tests)
  app.undoChips = () => cb.list().filter(b => b.key.startsWith('undo:')).map(b => ({ seat: b.data.by, seq: b.data.seq, type: b.data.type, text: b.text, visible: b.visible }));

  app.on((what, e) => {
    if (what === 'entry') return onEntry(e);
    if (what === 'frame') return cb.frame();
  });
  // WHAT CAN STILL BE UNDONE (for the chat line's button, which must stay honest long after the chip): the relay undoes
  // one entry by its seq, so the line is valid while (a) nobody has undone that entry, (b) what it changed is still
  // there, and (c) nothing has changed those things since (the undo would put back an older state over newer work).
  // All three are known only for what this page has watched: after a reload an undo line is plain text.
  const undone = new Map(), touched = new Map(); // area -> Set(seq); area -> Map(entity id -> last seq that changed it)
  function track(e) {
    if (!e?.area || e.seq == null) return;
    if (!undone.has(e.area)) { undone.set(e.area, new Set()); touched.set(e.area, new Map()); }
    if (e.undoOf != null) undone.get(e.area).add(e.undoOf);
    for (const id of idsOf(e)) touched.get(e.area).set(id, e.seq);
  }
  app.undoState = (d) => { // null = can be undone; else the short reason
    if (!d || d.seq == null) return 'not available';
    if (d.by !== app.me() && !app.gm()) return 'not yours to undo';
    if ((d.seqs || [d.seq]).some(q => undone.get(d.area)?.has(q))) return 'already undone';
    if (undone.get(d.area)?.has(d.seq)) return 'already undone';
    const E = app.sync.view?.(d.area)?.entities; if (!E) return 'in another area';
    const ids = d.ids || [];
    if (!DELETES.has(d.type) && ids.length && ids.every(id => !E[id])) return `that ${d.thing || 'thing'} is gone`;
    const t = touched.get(d.area);
    if (t && ids.some(id => (t.get(id) || 0) > d.seq)) return 'changed since';
    return null;
  };
  app.actionLines?.kind('undo', {
    restorable: false,
    valid: (d) => app.undoState(d),
    run: (d) => app.await(app.sync.submitRaw({ type: 'undo', area: d.area, args: { who: d.by, seq: d.seq } })).then(m => m ? null : 'could not be undone'),
  });
  // ---------- damage changes: an undo for the changer, the pawn's owner and the GM (core/pawn.js seesDamageUndo) ----------
  // It reads "Brakka took 7 (19 damage) by Tobias · [Undo]" (or "healed 5"). It floats beside the pawn for
  // DAMAGE_LIFE_MS, then goes down into the chat (condbutton.js rule 6) and stays there. Several changes by one seat to
  // the same pawn within DAMAGE_MERGE_MS are ONE button and one line with the total; its Undo takes back every one of
  // them, newest first, each by its own number in the log (so it can never undo a change the line does not name).
  // Stale: greyed, with the reason.
  const dmgIdsOf = (e) => e.type === 'token.damage' ? [e.args.id] : e.type === 'batch' && e.args?.ops?.length && e.args.ops.every(o => o.type === 'token.damage') ? e.args.ops.map(o => o.args.id) : null;
  const confirmed = (area) => app.sync.areas?.get(area)?.confirmed || null;
  const dmgSeen = new Map(); // area -> { seq, of: Map(pawn id -> damage) }: every pawn's damage as of the last entry this page applied
  const dmgNote = (area) => { const c = confirmed(area); if (c) dmgSeen.set(area, { seq: c.seq, of: new Map(Object.values(c.entities).filter(x => x.kind === 'token').map(x => [x.id, x.damage || 0])) }); };
  const dmgLive = new Map(); // button key -> { spec, at } (the button still floating, to add a quick follow-up change to)
  const seatName = (id) => app.sync.campaign?.seats.find(x => x.id === id)?.name || 'someone';
  const mayUndoDamage = (d, E) => (d.ids || []).some(id => E[id]) && (d.ids || []).filter(id => E[id]).every(id => seesDamageUndo({ seat: app.me(), gmSide: app.gm(), by: d.by, owner: E[id].owner }));
  app.damageUndo = { life: DAMAGE_LIFE_MS, merge: DAMAGE_MERGE_MS, sees: seesDamageUndo };
  app.damageUndoState = (d) => { // null = can be undone; else the short reason
    const E = app.sync.view?.(d.area)?.entities; if (!E) return 'in another area';
    if (d.seqs.some(q => undone.get(d.area)?.has(q))) return 'already undone';
    if (d.ids.every(id => !E[id])) return `that pawn is gone`;
    if (!mayUndoDamage(d, E)) return 'not yours to undo';
    const t = touched.get(d.area), top = Math.max(...d.seqs);
    if (t && d.ids.some(id => (t.get(id) || 0) > top)) return 'changed since';
    return null;
  };
  const damageUndoRun = async (d) => { // newest first; each by its seq
    for (const seq of [...d.seqs].sort((a, b) => b - a)) { const m = await app.await(app.sync.submitRaw({ type: 'undo', area: d.area, args: { who: d.by, seq } })); if (!m) return 'could not be undone'; }
    return null;
  };
  app.actionLines?.kind('damage-undo', { restorable: false, valid: (d) => app.damageUndoState(d), run: (d) => damageUndoRun(d) });
  const dmgText = (d) => damageLine(d.ids.length === 1 ? d.name : `${d.ids.length} pawns`, d.total, d.ids.length === 1 ? d.to : null, seatName(d.by));
  function onDamage(e, ids) {
    const seen = dmgSeen.get(e.area), c = confirmed(e.area);
    if (!c || !seen || seen.seq !== e.seq - 1 || e.undoOf != null) return; // (an undo is not a new change; a gap: the damage before is not known)
    const E = c.entities, here = ids.filter(id => E[id]);
    if (!here.length) return;
    if (!here.some(id => seesDamageUndo({ seat: app.me(), gmSide: app.gm(), by: e.by, owner: E[id].owner }))) return; // not this seat's to undo: no button, no line
    const deltas = here.map(id => (E[id].damage || 0) - (seen.of.get(id) || 0));
    const same = deltas.every(v => v === deltas[0]), key = `dmg:${e.by}:${here.join(',')}`, now = performance.now();
    if (same && deltas[0] === 0) return;
    let g = dmgLive.get(key); const b = g && cb.get(key);
    if (g && b && b.spec === g.spec && !b.done && e.area === g.spec.line.data.area && now - g.at < DAMAGE_MERGE_MS) { // one seat, one pawn, a moment apart: the same button, the total
      const d = g.spec.line.data; d.seqs.push(e.seq); d.total = d.total == null || !same ? null : d.total + deltas[0]; d.to = E[here[0]].damage || 0;
    } else {
      const top = (() => { try { const w = app.worldOf(e.area), r = w.recs.get(here[0]), bx = r && w.boundsOf(r); return bx ? bx.max.y - (E[here[0]].y || 0) : 3; } catch { return 3; } })(); // beside the top of the pawn, whatever its figure's height
      const d = { area: e.area, by: e.by, seqs: [e.seq], ids: here, name: E[here[0]].name, to: E[here[0]].damage || 0, total: same ? deltas[0] : null, type: 'token.damage', thing: 'pawn' };
      g = { spec: { cls: 'uchip dmgchip', icon: 'undo-2', anchor: [E[here[0]].x, E[here[0]].z, (E[here[0]].y || 0) + top], area: e.area, life: DAMAGE_LIFE_MS, doneText: 'Undone', data: d,
        line: { kind: 'damage-undo', button: 'Undo', data: d }, run: () => { damageUndoRun(d).then(why => { if (why) app.toast(`That damage change ${why}`, true); }); } } };
      dmgLive.set(key, g);
    }
    g.at = now;
    const d = g.spec.line.data; g.spec.line.text = dmgText(d); g.spec.text = `Undo: ${dmgText(d)}`; g.spec.data = { ...d, seq: Math.max(...d.seqs) };
    const btn = cb.show(key, g.spec); btn.el.dataset.seat = e.by; btn.el.dataset.dmg = here.join(',');
  }
  app.on((what, a) => { if (what === 'change' && a && !dmgSeen.has(a)) dmgNote(a); });
  function onEntry(e) {
    track(e);
    const dmg = e?.type && dmgIdsOf(e);
    if (dmg && e.area) onDamage(e, dmg);
    if (e?.area) dmgNote(e.area);
    if (dmg) return; // (the GM's general "Undo <who>'s change" chip is not shown as well)
    if (!app.gm() || !e?.by || e.by === app.me() || e.undoOf || e.area !== app.area() || !NOUN[e.type]) return;
    const who = app.sync.campaign?.seats.find(s => s.id === e.by)?.name || 'someone';
    const ids = idsOf(e), E = app.entities(), first = ids.map(id => E[id]).find(Boolean), a = e.args || {};
    const kindWord = first?.kind === 'token' ? 'pawn' : first?.kind || (e.type.startsWith('room.') ? 'room' : e.type.startsWith('token.') ? 'pawn' : 'thing');
    const what = e.type === 'room.spawn' ? `a room${ids.length ? '' : ''}` : e.type === 'batch' || e.type.startsWith('edge.') ? '' : first ? app.nameOf(first) : a.name || `a ${kindWord}`;
    const W = app.undoWording?.(e) || null; // a pawn's travel has its own words: "Brakka went to the Crypt · [Bring back]" (surfaces/areas.js)
    const b = cb.show(keyOf(e.by), {
      cls: 'uchip', icon: 'undo-2', text: W?.text || `Undo ${who}'s ${NOUN[e.type]}`, ...(W ? (W.anchor ? { anchor: W.anchor } : { dock: W.dock }) : { anchor: anchorOf(e) }), area: e.area, life: LIFE_MS, doneText: W?.doneText || 'Undone',
      data: { by: e.by, seq: e.seq, type: e.type },
      // when its time is up it goes down into the chat (condbutton.js rule 6); the same thing changed again by the same
      // seat is one line, for the latest change
      line: { kind: 'undo', text: W?.line || `${who} ${DID[e.type] || 'changed'}${what ? ` ${what === who ? 'their pawn' : what}` : ''}`, button: W?.button || 'Undo', group: `undo|${e.by}|${e.type}|${ids.join(',')}`, data: { area: e.area, by: e.by, seq: e.seq, type: e.type, ids, thing: kindWord } },
      run: () => { app.sync.submitRaw({ type: 'undo', area: e.area, args: { who: e.by, seq: e.seq } }); },
    });
    b.el.dataset.seat = e.by; b.el.dataset.seq = e.seq;
    if (!b.spec.anchor && !b.spec.dock) b.el.hidden = true; // nowhere to stand: no chip (the bar's "undo <name>" still works)
  }
  // where the change is: a new room's centre, else the first thing it touched
  function anchorOf(e) {
    const E = app.entities(), a = e.args || {};
    if (e.type === 'room.spawn') return [(a.x + a.w / 2) * CELL, (a.z + a.d / 2) * CELL, 3];
    if (e.type.startsWith('edge.')) { const w = app.worldOf(e.area).edgeAt?.(a.key); return w ? [w.x, w.z, 9] : null; }
    const id = a.id || a.ids?.[0] || a.ops?.[0]?.args?.id || a.entity?.id || Object.keys(a.set || {})[0];
    const x = E[id];
    if (x?.kind === 'room') return [...app.footprint.labelPoint(x.recipe), 3];
    if (x?.x != null) return [x.x, x.z, (x.dims?.[1] || 2) + 1];
    return null;
  }
  return { name: 'undochips' };
}

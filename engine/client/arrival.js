// A PLAYER'S FIRST ARRIVAL (Harry 2026-10-22: the player "arrives in the world with no pawn, no idea where to create one,
// nothing prompting them to"; "no obvious answer as to where I am"). The GM's invite puts the player's pawn on the table
// (client/pawns.js app.placeholderFor); this is the other half, in the player's browser:
//   1. the FIRST time a seat opens the campaign on this device, the camera goes to that seat's own main pawn (else its
//      first pawn in the area). Remembered per campaign and seat in this browser (localStorage), so it happens once;
//      a seat with no pawn in its area is not marked, and is centred the first time one is there.
//   2. if that pawn is still a PLACEHOLDER, ONE gentle offer beside its base (below its tag, never over it) (a conditional button, surfaces/condbutton.js):
//      "This is you, Bobby. Click to choose who you are." After a few seconds it goes down into the chat as a quiet
//      line with the same button, and stays there; it is never shown again on its own. Choosing a figure in any way
//      (here, the pawn's ring, the GM doing it) ends it at once (rule 1: its condition ended).
// Offered, never forced: nothing here opens a dialog, takes the keyboard, or comes back on the next visit.
// The GM side never gets either (the GM's camera is the GM's).
import { loadPrefs } from './surfaces/settings.js';

export const HINT_LIFE_MS = 9000;
const ARRIVAL_DIST = 60, ARRIVAL_GRACE_MS = 4000; // ft: the camera's distance when it was further out than this (a table view of the pawn)

export function installArrival(app) {
  const key = () => `tw.arrived.${app.sync.campaign?.id}.${app.me()}`;
  const seen = () => { try { return !!localStorage.getItem(key()); } catch { return true; } };
  const mark = () => { try { localStorage.setItem(key(), String(Date.now())); } catch { } };
  const still = (d) => { const t = app.entities(d.area)?.[d.id]; return t && t.placeholder ? t : null; };
  app.actionLines?.kind('placeholder-hint', { restorable: true, valid: (d) => d.area !== app.area() ? 'in another area' : still(d) ? null : 'already chosen', run: (d) => { const t = still(d); if (t) app.choosePawn(t); } });
  const A = app.arrival = {
    centred: null, hinted: null, // (tests)
    seen,
    run({ force = false } = {}) {
      if (app.gm() || !app.main || (!force && (seen() || loadPrefs().arrivalCentre === false))) return false;
      const me = app.me(), mine = Object.values(app.entities()).filter(e => e.kind === 'token' && e.owner === me);
      const t = mine.find(e => e.main) || mine[0];
      if (!t) return false; // nothing of mine here yet: ask again later
      mark();
      const g = app.main.grab; if (g.dist > ARRIVAL_DIST) { g.dist = ARRIVAL_DIST; g.update(); }
      app.centreOn({ x: t.x, y: t.y || 0, z: t.z }, app.main, { ms: 0 });
      A.centred = { id: t.id, at: [t.x, t.z], placeholder: !!t.placeholder, when: performance.now() };
      if (t.placeholder) {
        const name = app.sync.campaign?.seats.find(s => s.id === me)?.name || t.name || 'friend', area = app.area(), d = { id: t.id, area };
        app.condButtons?.show('placeholder-hint', { cls: 'arrival', icon: 'user', text: `This is you, ${name}. Click to choose who you are.`, anchor: [t.x, t.z, t.y || 0], nudge: [14, 58], life: HINT_LIFE_MS, area, data: d,
          when: () => !!still(d), doneText: 'Choose your figure',
          line: { kind: 'placeholder-hint', text: `Your pawn is a stand-in until you choose who you are`, button: 'Choose', group: `placeholder|${t.id}`, data: d },
          run: () => { const p = still(d); if (p) app.choosePawn(p); } });
        A.hinted = { id: t.id, text: `This is you, ${name}. Click to choose who you are.`, when: performance.now() };
      }
      return true;
    },
  };
  // when the first loading screen has gone, and for a few seconds after (the area's pawns may still be arriving); never
  // later in the visit: a pawn the GM makes for me an hour in does not swing my camera round. No pawn by then: the next
  // visit tries again (nothing was marked).
  let tries = 0, since = null;
  const tick = () => {
    if (A.centred || seen() || (app.sync.campaign && app.gm()) || loadPrefs().arrivalCentre === false) return;
    if (app.ready?.() && app.loaded?.()) { since ??= performance.now(); if (A.run() || performance.now() - since > ARRIVAL_GRACE_MS) return; }
    if (++tries < 400) setTimeout(tick, 250);
  };
  setTimeout(tick, 300);
  return A;
}

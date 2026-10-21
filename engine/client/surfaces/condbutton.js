// CONDITIONAL BUTTONS: a named piece of the UI vocabulary (Harry 2026-10-05: "I actually want those conditional buttons
// to become part of our UI vocab"; docs/UI.md "Conditional buttons"). A conditional button exists only while it is
// relevant. They are deliberately RARE (Harry 2026-10-06: "Roofs on doesn't get a chat line, it doesn't even get a
// conditional. Just placing things doesn't get conditionals... they are somewhat rare."): a conditional is for
// something the person did NOT just do themselves and may want to reverse or follow, never a confirmation of what
// they just did. Today: the GM's undo chip for another seat's change (surfaces/undochips.js) and "Cut to lv N" when
// your pawn changes floor (surfaces/cut.js). And the undo on a pawn's damage change (undochips.js).
// And "Only this tile" after a floor dragged onto a room changed its whole floor (surfaces/floordrop.js: asked for by
// Harry 2026-10-11, an alternative to what was just done rather than a confirmation of it).
// The rules, enforced here so every such button gets them for free:
//   1. It appears only while its condition holds, and goes when the condition ends (hide), when it has been used, or
//      after its life (it fades; a missed button is never the only way to do the thing).
//   2. ONE home per button, always the same: either beside the thing it is about (`anchor`: a world point, the button
//      sits a little up and to the right of it, never over it) or a fixed screen slot (`dock`). It never wanders.
//   3. It never steals focus: it cannot be tabbed to, pressing it leaves the keyboard focus where it was, and it never
//      opens by itself over what you are typing in. It is a shortcut; everything it does is also in the command bar.
//   4. It never covers the PiP window, and it is not drawn for a point that is off screen.
//   5. One per key: showing the same key again replaces the old one in place (no stacks of the same offer).
//   6. IT DOES NOT JUST FADE (Harry 2026-10-06: "instead of fading away, they should go down into the chat area, so
//      you still have access to them later"). When its time is up, or a newer offer takes its place, it flies down
//      into the chat log and stays there as a quiet, LOCAL action line with the same button on it (surfaces/chat.js,
//      app.actionLines). A button that was pressed, or whose condition simply ended, leaves no line.
//
// A NEW CONDITIONAL BUTTON WITH A CHAT LINE is two calls:
//   app.actionLines.kind('damage-undo', { valid: (data) => null | 'already undone', run: (data) => ..., restorable: false })
//   app.condButtons.show(key, { icon, text, anchor | dock, life, area, run,
//     line: { kind: 'damage-undo', text: 'Brakka took 4 (9 damage) by Tobias', button: 'Undo', data: {...} } })
// `valid` is asked every time the line is drawn and again when its button is pressed; `group` collapses repeats.
//
//   const cb = createConditionalButtons(app, layerEl)
//   cb.show(key, { icon, text, cls, anchor: [x, z, y] | dock: 'top' | 'bottom', run(), life: ms | 0, area, data })
//   cb.hide(key)      cb.has(key)      cb.list()      cb.frame()  (call every frame)
import { icon } from '../icons.js';

const FADE_MS = 600, FLY_MS = 480;
export const DOCKS = ['top', 'bottom', 'bottom2']; // fixed screen slots: under the command bar; above the bottom edge (centred); one row higher (so two offers never share a slot)

export function createConditionalButtons(app, layer) {
  const live = new Map(); // key -> { el, spec, at }
  function show(key, spec) {
    let b = live.get(key);
    if (b && b.spec?.line && !b.done && b.spec !== spec) { toChat(key, b); b = null; } // rule 6: the older offer lives on in the chat
    if (!b) {
      const el = document.createElement(spec.render ? 'div' : 'button');
      el.tabIndex = -1;                                              // rule 3: not in the tab order
      el.addEventListener('mousedown', (ev) => ev.preventDefault()); // rule 3: a press does not move the focus
      el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      el.addEventListener('click', (ev) => { ev.stopPropagation(); const cur = live.get(key); if (!cur || cur.done) return; cur.done = true; const after = cur.spec.run?.(cur); if (after !== 'keep') settle(key, cur.spec.doneText); });
      layer.append(el);
      b = { el }; live.set(key, b);
    }
    b.spec = spec; b.at = performance.now(); b.done = false;
    b.el.className = `cbtn ${spec.cls || ''}${spec.dock ? ` docked dock-${spec.dock}` : ''}`;
    b.el.innerHTML = '';
    if (spec.render) spec.render(b.el);
    else b.el.innerHTML = `${spec.icon ? icon(spec.icon, 14) : ''}<span>${esc(spec.text)}</span>`;
    b.el.hidden = !!spec.anchor; // an anchored one is placed (or left hidden) by the next frame
    void b.el.offsetWidth;        // restart the fade-in when the same key is shown again
    return b;
  }
  // used: say so for a moment, then go
  function settle(key, text = 'Done') { const b = live.get(key); if (!b) return; b.el.classList.add('done'); b.el.innerHTML = `${icon('check', 14)} ${esc(text)}`; setTimeout(() => { if (live.get(key) === b) hide(key); }, 900); }
  function hide(key) { const b = live.get(key); if (b) { b.el.remove(); live.delete(key); } }
  // RULE 6: the button leaves its place and lands on its own line in the chat log (FLIP, as a say or a roll does:
  // the line is laid out but held invisible, the button flies onto the line's button, then the line shows). With
  // reduced motion, or when either end is not on screen, it fades instead.
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');
  const flights = []; // (tests) { key, mode, from, to, at }
  function toChat(key, b) {
    live.delete(key);
    const el = b.el, s = b.spec, from = el.hidden ? null : el.getBoundingClientRect();
    const line = app.actionLines.add({ ...s.line, area: s.area || app.area() }, { pending: true });
    const rec = { key, line: line?.id || null, mode: null, at: performance.now() }; flights.push(rec); if (flights.length > 40) flights.shift();
    const done = (fade) => { el.remove(); if (line) app.actionLines.reveal(line.id, fade); rec.landedAt = performance.now(); };
    const target = line && app.actionLines.buttonEl(line.id), to = target?.getBoundingClientRect();
    const box = document.getElementById('chat')?.getBoundingClientRect();
    const seen = from && from.width > 0 && to && to.width > 0 && box && to.top >= box.top - 1 && to.bottom <= box.bottom + 1;
    if (!seen || reduced()) {
      rec.mode = reduced() ? 'fade' : 'fade-unseen';
      if (!from) return done(true);
      el.classList.add('flying'); el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'forwards' }).finished.then(() => done(true), () => done(true));
      return;
    }
    rec.mode = 'fly'; rec.from = [from.left, from.top]; rec.to = [to.left, to.top];
    el.classList.remove('fade', 'docked'); el.classList.add('flying');
    Object.assign(el.style, { position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, bottom: 'auto', transform: 'none', transformOrigin: '0 0', margin: 0 });
    const sc = to.height / from.height;
    el.animate([{ transform: 'translate(0px, 0px) scale(1)', opacity: 1 }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${sc})`, opacity: 0.85 }], { duration: FLY_MS, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' })
      .finished.then(() => { const r = el.getBoundingClientRect(); rec.landed = [r.left, r.top]; const t2 = app.actionLines.buttonEl(line.id)?.getBoundingClientRect(); rec.target = t2 ? [t2.left, t2.top] : null; done(false); }, () => done(false));
  }
  function frame() {
    const now = performance.now();
    for (const [key, b] of live) {
      const s = b.spec, age = now - b.at;
      if ((s.area && s.area !== app.area()) || (s.when && !s.when())) { hide(key); continue; } // rule 1: the condition ended
      if (s.life && age > s.life && !b.done && s.line && app.actionLines) { toChat(key, b); continue; } // rule 6: time is up, down into the chat
      if (s.life && age > s.life + FADE_MS) { hide(key); continue; }
      b.el.classList.toggle('fade', !!s.life && age > s.life && !b.done);
      if (!s.anchor) continue; // docked: CSS holds its slot
      const p = app.screenOf(s.anchor[0], s.anchor[1], app.main, s.anchor[2] || 0), x = p.x + 30 + (s.nudge?.[0] || 0), y = p.y - 46 + (s.nudge?.[1] || 0); // (nudge: px, so a few offers about ONE thing stand in a column: a new building's storeys and re-roll) // beside and above, never over the thing
      const pr = app.pip && document.getElementById('pipFrame')?.getBoundingClientRect();
      b.el.hidden = !(p.x > 0 && p.x < innerWidth && p.y > 0 && p.y < innerHeight) || !!(pr?.width && x + 160 > pr.left && x < pr.right && y + 30 > pr.top && y < pr.bottom); // rule 4
      b.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  }
  return { show, hide, frame, flights: () => flights.slice(), expire: (key) => { const b = live.get(key); if (b?.spec.life) b.at = performance.now() - b.spec.life - 1; return !!b; } /* (tests) its time is up now */, has: (key) => live.has(key), get: (key) => live.get(key), list: () => [...live].map(([key, b]) => ({ key, text: b.el.textContent.trim(), visible: !b.el.hidden, docked: b.spec.dock || null, data: b.spec.data || null })) };
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

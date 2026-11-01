// ON A PHONE (2026-10-24; docs/UI.md "On a phone"). Only when index.html set html.tw-hand (a small screen with a touch
// pointer only). The layout is CSS (style.css "ON A PHONE"); the fingers are input.js (a tool takes the finger; two
// fingers pinch, twist and tilt). This file is the little that is neither:
//   THE LIVE TOOL, AND ITS WAY OUT. On a computer a live tool (placing a thing or a pawn, drawing a room or a building,
//   painting floor) shows itself as a ghost on the pointer, and Escape ends it. A phone has no hover and no Escape, so
//   a chip says what the finger will do and has Cancel ("Placing Chair · lift your finger to put it down  [Cancel]").
//   A TRAY GETS OUT OF THE WAY. Picking a thing, a room or a pawn in the Build or Pawns tray closes that tray, so the map
//   is there for the finger (not a pinned tray, not while the first-visit intro is acting, and not for the building tool
//   that picking a TYPE arms: the tray then shows that type's rooms, to go on into).
import { icon } from './icons.js';

export function installHandheld(app) {
  const on = document.documentElement.classList.contains('tw-hand');
  app.handheld = on;
  if (!on) return;
  const chip = document.createElement('div');
  chip.id = 'handTool'; chip.hidden = true; chip.setAttribute('role', 'status');
  chip.innerHTML = `<span class="ht-what"></span><button type="button" class="ht-x">${icon('x', 15)}<span>Cancel</span></button>`;
  (document.getElementById('app') || document.body).append(chip);
  const what = chip.querySelector('.ht-what');
  chip.querySelector('.ht-x').addEventListener('click', (ev) => { ev.stopPropagation(); app.modes.cancel(); });
  const words = (m) => {
    const name = (m.cat?.name || '').replace(/^./, c => c.toUpperCase());
    if (m.kind === 'room') return 'Drag on the map to draw the room';
    if (m.kind === 'building') return `Drag on the map for the ${(m.node?.label || 'building').toLowerCase()}`;
    if (m.cat?.place === 'tile') return `${name || 'Floor'}: drag on the map to paint`;
    return `Placing ${name || 'it'}: lift your finger to put it down`;
  };
  let sig = '';
  app.on((ev) => {
    if (ev !== 'refresh' && ev !== 'frame') return;
    const m = app.mode, live = !!m && (m.kind === 'place' || m.kind === 'room' || m.kind === 'building');
    const s = live ? `${m.kind}|${m.cat?.id || m.cat?.name || ''}|${m.type || ''}` : '';
    if (s === sig) return;
    sig = s;
    chip.hidden = !live;
    if (live) what.textContent = words(m);
    // a tool just went live: the tray it came from makes room for the finger
    if (live && m.kind !== 'building' && app.intro?.state !== 'running') for (const name of ['build', 'pawns']) { const t = app[name]; if (t?.isOpen && app.tray?.dismissable(name)) t.close(); }
    app.handTool = live ? what.textContent : null; // (tests)
  });
}

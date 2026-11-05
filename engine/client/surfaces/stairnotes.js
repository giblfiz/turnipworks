// THE × ON A STAIR'S NOTE (Harry 2026-11-02: "they are fine as *warnings*... but how do I get rid of them?" "Yeah, we
// need a dismiss button on these."; docs/UI.md "A stair's warning"). The note itself is a sprite in the world (client/
// world.js syncStairNotes), and sprites are never picked. So the button is the room label's pattern, not a pick: a real
// DOM button laid over the canvas and moved to the note every frame (surfaces/labels.js). It has every bit of a button
// (hover, a title, a real tap on a phone) and the 3D hit-test stays out of it.
//   Who: the GM side only, and not while the GM previews what players see. A player sees the note and no ×; the relay
//        refuses the command anyway (object.set is class 'object').
//   Where: just past the note's right end, so it never covers the words. The note is a constant size on screen for a
//        given window height, so that end is worked out from the sprite's scale, as statusfx.js boxOfSprite does.
//   Always showing, not on hover: a phone has no hover. On a coarse pointer the disc is larger and the target is 44 px
//        (style.css .snx). The ring and the bar reach the same thing (client/commands.js stair.note), with no small target.
//   It goes with the note: hidden by the cut with the stair, under the PiP, off screen, behind the camera. While a tool
//        is live it lets the pointer through, as the labels do.
import * as THREE from 'three';
import { icon } from '../icons.js';

const OVERLAP = 2; // px the disc sits over the note's end, so the two read as one thing

export function stairNotesSurface(R, app) {
  const layer = document.getElementById('stairNoteX'), canvas = document.getElementById('c');
  const els = new Map(); // stair id -> button
  const v = new THREE.Vector3();
  const make = (id) => {
    const el = document.createElement('button');
    el.className = 'snx'; el.type = 'button'; el.tabIndex = -1; el.dataset.id = id; el.title = 'Dismiss this warning'; el.setAttribute('aria-label', 'Dismiss this stair warning');
    el.innerHTML = `<span class="snx-d">${icon('x', 13)}</span>`;
    el.addEventListener('mousedown', (ev) => ev.preventDefault()); // (a press does not move the focus)
    el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    el.addEventListener('click', (ev) => { ev.stopPropagation(); const e = app.entities()[id]; if (e) app.setStairNotes([e], true); });
    layer.append(el); els.set(id, el); return el;
  };
  const drop = (id) => { els.get(id)?.remove(); els.delete(id); };
  // (tests) the buttons: [{ id, shown, box: [left, top, width, height] in client px, disc: the same, of what is drawn }]
  const box = (el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(n => +n.toFixed(1)); };
  app.stairNoteX = () => [...els].map(([id, el]) => ({ id, shown: !el.hidden, box: el.hidden ? null : box(el), disc: el.hidden ? null : box(el.firstChild) }));

  app.on((what) => {
    if (what !== 'frame') return;
    const notes = app.main && app.gm() && !app.fog?.preview?.() ? app.worldOf?.(app.area())?.stairNotes : null;
    for (const id of [...els.keys()]) if (!notes?.has(id)) drop(id);
    if (!notes?.size) return;
    layer.classList.toggle('passive', !!app.mode);
    const cam = app.main.camera, r = canvas.getBoundingClientRect(), [vl, vt, vw, vh] = app.main.rect, px = r.width * vw, py = r.height * vh;
    const f = cam.projectionMatrix.elements[5] * py / 2; // screen px per unit of a sprite that keeps its size on screen
    const pip = app.pip && document.getElementById('pipFrame')?.getBoundingClientRect();
    for (const [id, t] of notes) {
      const el = els.get(id) || make(id);
      v.copy(t.position).project(cam);
      const x = r.left + vl * r.width + (v.x + 1) / 2 * px + t.scale.x * f / 2 - OVERLAP + el.firstChild.offsetWidth / 2, y = r.top + vt * r.height + (1 - v.y) / 2 * py;
      const on = t.visible && v.z < 1 && x > 0 && x < innerWidth && y > 0 && y < innerHeight && !(pip?.width && x > pip.left && x < pip.right && y > pip.top && y < pip.bottom);
      if (el.hidden === on) el.hidden = !on;
      if (on) el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  });
}

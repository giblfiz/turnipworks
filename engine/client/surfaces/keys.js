// Hotkeys, chords and the "?" shortcut sheet, all generated from the registry.
// Layers: this surface owns the "default" key layer (standard modifiers + a few single letters). A second front end
// (Harry's alternate menu/hotkey design) can own its own layer and run at the same time: it gets first refusal on
// keys only when it registers `app.keyLayers.unshift(handler)`; nothing here is hard-wired against it.
// Chords: Space, then a letter from the SAME menu the ring's ☰ shows (client/menu.js): flat where the ring is flat
// (Space H hides, Space K locks, Space D deletes), one more letter inside a long list (Space F, then the floor). A
// which-key hint at the bottom shows the level you are on. Backspace goes up a level, Esc (or any other key) cancels.
// Space+drag still pans.
import { eventKey, keyLabel } from '../registry.js';
import { icon } from '../icons.js';
import { menuFor, chordOf, titleOf as nodeTitle, iconOf as nodeIcon } from '../menu.js';

const inField = (ev) => ev.target.closest?.('input, textarea, select, [contenteditable]');

const PIP_KEYS = new Set(['edit.copy', 'edit.undo', 'edit.redo', 'build.menu', 'view.labels', 'help.intro', 'view.theme', 'help.sheet']);

export function keysSurface(R, app) {
  app.keyLayers = app.keyLayers || [];   // other front ends: (ev) => true if they handled it
  app.escapeStack = app.escapeStack || []; // open popovers register a closer; Escape closes the newest first
  const map = R.keymap('default');
  const hint = document.getElementById('whichkey');
  let chord = null, spaceUsed = false;

  addEventListener('pointerdown', () => { if (app.spaceHeld?.()) spaceUsed = true; }, true);
  addEventListener('keydown', (ev) => {
    if (inField(ev)) return;
    for (const layer of app.keyLayers) if (layer(ev)) { ev.preventDefault(); return; }
    if (app.modes.key(ev)) { ev.preventDefault(); return; }
    const k = eventKey(ev);
    if (k === 'escape') { // newest open thing first; a closer whose thing is already gone reports false and we go on
      while (app.escapeStack.length) if (app.escapeStack.pop()() !== false) { ev.preventDefault(); return; }
    }
    if (chord) { if (['Shift', 'Control', 'Alt', 'Meta'].includes(ev.key)) return; ev.preventDefault(); runChord(ev.key.toLowerCase()); return; }
    if (k === 'space') { ev.preventDefault(); if (!ev.repeat) spaceUsed = false; return; }
    // shortcuts go to the view under the pointer (Harry 2026-10-04): over the PiP, F frames its picked thing and copy
    // copies it; the library is read-only, so delete, rotate, paste and the rest are inert there
    const overPip = app.pointerView === 'pip' && !!app.pip;
    if (overPip && k === 'f') { const sel = app.library?.selection(); if (sel) app.library.focus(sel.id, sel.sku); ev.preventDefault(); return; }
    const cmds = map.get(k);
    if (!cmds) return;
    const ctx = R.ctx();
    const c = cmds.find(c => R.permitted(c, ctx) && (overPip ? PIP_KEYS.has(c.id) : safe(() => c.when(ctx))) && R.isEnabled(c, ctx));
    if (!c) return;
    if (overPip && c.id === 'edit.copy') { if (!app.library?.selection()) return; ev.preventDefault?.(); const t = app.copy(); if (t) { navigator.clipboard?.writeText(t).catch(() => {}); app.toast('Copied'); } return; }
    if (c.native && (k.startsWith('mod+') && !ev.shiftKey)) return; // Mod+C/X/V: let the browser raise the clipboard event (main.js)
    ev.preventDefault();
    R.run(c, undefined, ctx);
  });
  addEventListener('keyup', (ev) => {
    if (ev.code !== 'Space' || inField(ev) || spaceUsed) return;
    openChord();
  });

  // the chord tree IS the ☰ menu for the selection (nothing skipped: the keyboard has no ring buttons)
  function openChord() {
    const nodes = menuFor(R, R.ctx());
    if (!nodes.length) return;
    chord = { nodes, path: [], up: [] };
    showHint();
  }
  function showHint() {
    const ctx = R.ctx();
    hint.innerHTML = `<b>Space</b>${chord.path.map(p => ` <b>▸ ${esc(p)}</b>`).join('')} then ${chord.nodes.map(n => `<span class="wk" data-key="${esc(n.key || '')}">${icon(nodeIcon(n, R, ctx), 14)}${n.key ? `<kbd>${esc(n.key.toUpperCase())}</kbd>` : ''} ${esc(n.cmd ? n.cmd.short || nodeTitle(n, R, ctx) : n.title)}${n.children ? ' ▸' : ''}</span>`).join('')}${chord.up.length ? '<span class="wk mute"><kbd>⌫</kbd> back</span>' : ''}<span class="wk mute"><kbd>Esc</kbd> cancel</span>`;
    hint.hidden = false;
  }
  function runChord(key) {
    if (key === 'backspace' && chord.up.length) { chord.nodes = chord.up.pop(); chord.path.pop(); showHint(); return; }
    const n = chord.nodes.find(n => n.key && n.key === key);
    if (n?.children) { chord.up.push(chord.nodes); chord.path.push(n.title); chord.nodes = n.children; showHint(); return; }
    chord = null; hint.hidden = true;
    if (n) R.run(n.cmd);
  }
  app.chordState = () => chord && { path: [...chord.path], keys: chord.nodes.map(n => n.key), items: chord.nodes.map(n => n.cmd ? n.cmd.id : `▸${n.group}`) }; // (tests)
  const title = (c) => typeof c.title === 'function' ? c.title(R.ctx()) : c.title;

  // ---------- "?" sheet ----------
  const sheet = document.getElementById('sheet');
  app.on((what) => {
    if (what !== 'sheet.toggle') return;
    if (!sheet.hidden) { sheet.hidden = true; return; }
    const ctx = R.ctx();
    const groups = new Map();
    for (const c of R.all()) {
      if (c.stub || (!c.keys.length && !chordOf(R, c.id))) continue;
      if (/^(room\.(type|walls|floor)|pawn\.(cond|mark))\./.test(c.id) && !c.keys.length) continue; // long lists: one line each would drown the sheet
      if (!R.permitted(c, ctx)) continue;
      const g = String(c.group).split(' ▸ ')[0];
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(c);
    }
    const mouse = [['Left-drag empty space', 'Select with a box'], ['Click · Shift-click · Ctrl/⌘-click', 'Select · add · toggle'], ['Click again on the same spot', 'Cycle down the stack'], ['Double-click a room or its label', 'Go to that room\'s level, and centre on it'], ['Double-click open ground', 'Show all levels, and centre there'], ['Click or drag on the left-edge meter', 'Go to a level (its cap: all levels)'], ['Drag a pawn · Shift-drag', app.pawnSnaps(false) ? 'Snaps to the squares · moves freely (Settings ▸ Me)' : 'Moves freely · snaps to the squares (Settings ▸ Me)'], ['Drag a thing · Shift-drag', 'Moves freely · snaps to the half squares (2.5 ft)'], ['Drag a ring handle · with Shift', 'Freely · in steps: turn and roll 15°, raise 6 in, resize 25%, damage 5'], ['Drag a wall piece, door or post · Shift-drag', 'Stays on the grid · moves freely'], ['Double-click a selected thing', 'Step inside'], ['Zoom all the way out', 'The Roofs on button appears (also "roofs on" / "roofs off" in the command bar)'], ['Click a roof', 'Select it: style, re-roll, hide (its room\'s roof)'], ['Double-click a roof', 'Look into the room under it'], ['Drop a pawn on a stair', 'It goes to the stair\'s other end'], ['Drag the raise / lower button', 'Lift a thing or pawn: a line drops to what is under it, with its height'], ['Right- / middle-drag · Space+drag', 'Pan'], ['Wheel · pinch', 'Zoom to the cursor'], ['⌥ Option-drag', 'Rotate the view'], ['Alt+click', 'Ping'], ['Q / E', 'Turn the view'], ['PageUp / PageDown', 'Tilt the view']];
    // trackpads (Harry 2026-10-04, a MacBook with no mouse): the same moves without middle or right buttons
    const pad = [['Two-finger scroll', 'Pan'], ['Pinch', 'Zoom'], ['⌥ Option + two-finger scroll', 'Rotate the view (turn and tilt)'], ['Two-finger rotate (Safari)', 'Turn the view'], ['⌘ Cmd + drag on empty space', 'Pan'], ['⌥ Option + drag', 'Rotate the view'], ['Shift + drag on empty space', 'Add to the selection with a box']];
    sheet.innerHTML = `<div class="sheet-card"><header><h2>${icon('keyboard', 18)} Shortcuts</h2><button class="iconbtn" data-close aria-label="Close">${icon('x')}</button></header>
      <div class="sheet-cols">${[...groups].map(([g, cs]) => `<section><h3>${esc(g)}</h3>${cs.map(c => `<div class="row">${icon(R.iconOf(c), 14)}<span>${esc(title(c))}</span>${[...c.keys.map(k => `<kbd>${esc(keyLabel(k))}</kbd>`), chordOf(R, c.id) ? `<kbd>${chordOf(R, c.id).map(x => x.length === 1 ? x.toUpperCase() : x).join(' ')}</kbd>` : ''].join('')}</div>`).join('')}</section>`).join('')}
      <section><h3>Mouse and touch</h3>${mouse.map(([a, b]) => `<div class="row"><span>${b}</span><kbd>${a}</kbd></div>`).join('')}</section>
      <section class="pad"><h3>Trackpad${app.trackpad || /Mac/.test(navigator.platform) ? ' (yours)' : ''}</h3>${pad.map(([a, b]) => `<div class="row"><span>${b}</span><kbd>${a}</kbd></div>`).join('')}</section></div></div>`;
    sheet.hidden = false;
    sheet.querySelector('[data-close]').onclick = () => { sheet.hidden = true; };
    app.escapeStack.push(() => { if (sheet.hidden) return false; sheet.hidden = true; });
  });
  sheet.addEventListener('pointerdown', (ev) => { if (ev.target === sheet) sheet.hidden = true; });
  return { name: 'keys' };
}
const safe = (fn) => { try { return !!fn(); } catch { return false; } };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

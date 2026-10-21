// Every command any surface offers. Data + a run() that ends in the one door (app.dispatch / app.batch) or a purely
// local view action. Surfaces (bar, ring, ☰ radial, hotkeys, chords, "?" sheet) are generated from this list.
import { resolveFaction } from '../core/faction-catalog.js';
import { factionTarget } from './surfaces/factions.js';
import { parseDice } from './dice.js';
import { T } from './tuner.js';
import { MARKS, parseDamage } from '../core/pawn.js';
import { markUrl } from './marks.js';
import * as DK from '../core/darkness.js';
import { canTilt } from '../core/commands.js';
import { quatOfEntity } from '../core/orient.js';

// ROLL: TIPPING A THING OVER, about the VIEW's axis (Harry 2026-10-11 and 10-12), in an object's ☰ menu.
// THE WORD ON THE BUTTON is written in this ONE place (Harry settled "Roll" on 2026-10-11). Nothing stored is named
// after it: the data field is `quat` (the thing's orientation, core/orient.js), nothing to do with a mesh's `yaw`.
export const TILT_LABEL = 'Roll';
// WHICH AXIS A ROLL IS ABOUT (app.viewRollAxis, main.js). The ONE line to change if Harry meant the other reading:
//   'horizon'  the camera's forward direction laid flat on the ground: the thing tips to the left or right as seen on
//              screen, like a pilot's roll. (From the steep table camera the true line of sight is nearly vertical, and
//              a roll about it would just be the Turn again.)
//   'sight'    the true line of sight
export const ROLL_AXIS = 'horizon';
// typed in the bar: "roll 90" (a quarter roll clockwise about the view's axis), "roll -45", "roll 0" / "roll upright" (stand it
// upright: the way home), "roll side" (= 90); "tilt" and "tip" are the same word -> { deg }
export const parseTilt = (text) => {
  const m = String(text).trim().match(/^(?:roll|tilt|tip)\s+(?:to\s+)?(?:(-?\d{1,3}(?:\.\d+)?)\s*(?:°|deg|degrees)?|(upright|up|reset|none|off|flat)|(side|over|on (?:its|their) sides?))$/i);
  return !m ? null : m[1] != null ? (Math.abs(+m[1]) <= 360 ? { deg: +m[1] } : null) : m[2] ? { deg: 0 } : { deg: 90 };
};

// A selected pawn's damage keys: = adds one, - removes one. (They were [ and ] for HP, which are also the level keys:
// docs/STATUS.md, 2026-10-06. Harry accepted - and = ("hmm, ok"), lukewarm, so this is the ONE place to change them.)
export const PAWN_DAMAGE_KEYS = { add: '=', remove: '-' };

const CONDITIONS = ['blinded', 'charmed', 'frightened', 'grappled', 'invisible', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];
const STUB = () => false; // shown, greyed: on the roadmap
const is = (...kinds) => (ctx) => ctx.sel.length > 0 && ctx.sel.every(e => kinds.includes(kindOfCtx(ctx, e)));
const kindOfCtx = (ctx, e) => e.kind === 'object' ? (ctx.app.assets.openable(e.cat) ? 'openable' : 'prop') : e.kind === 'token' ? 'pawn' : e.kind;
const things = (ctx) => ctx.sel.filter(e => e.kind !== 'wall' && e.kind !== 'roof'); // (a roof is derived: its own commands, below)
const frozen = (e) => e.kind !== 'token' && !!e.locked; // a locked THING. A pawn is never locked (the pawn lock was dropped 2026-10-11: core/commands.js unlockPawn)
const touchable = (ctx) => ctx.sel.length > 0 && ctx.sel.every(e => ctx.gm || ctx.app.canTouch(e));

// TYPED IN WORDS (2026-10-20, the bar's catalog redone): "7 damage", "take 10 damage", "hurt 5", "heal 5" -> parseDamage's
// { delta }; and a d20 for a named check: "roll stealth", "roll a strength save", "roll athletics +4", "roll dex save
// advantage", "roll 1d20+5 stealth" -> { expr, label, why } (the why is the roll's reason, app.roll). "roll initiative"
// stays the turn order's.
export const damageWords = (text) => {
  const t = String(text ?? '').trim().toLowerCase(); let m;
  if ((m = t.match(/^(?:takes?|deals?|does|do)?\s*(\d{1,4})\s*(?:points? of\s+)?(?:damage|dmg)$/)) || (m = t.match(/^(?:damage|dmg|hurt|hit|harm|wound|takes?)\s+(?:for\s+)?(\d{1,4})(?:\s*(?:damage|dmg))?$/))) return { delta: +m[1] };
  if ((m = t.match(/^(?:heals?|cure|restore)\s+(?:for\s+)?(\d{1,4})(?:\s*(?:hp|hit points))?$/))) return { delta: -m[1] };
  return null;
};
const CHECKS = 'acrobatics|animal handling|arcana|athletics|deception|history|insight|intimidation|investigation|medicine|nature|perception|performance|persuasion|religion|sleight of hand|stealth|survival|strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha|attack|to hit|death|luck|check|save|saving throw|skill';
const CHECK_RE = new RegExp(`^(?:roll|\\/r)\\s+(?:a\\s+|an\\s+|for\\s+)?((?:${CHECKS})(?:\\s+(?:check|save|saving throw))?)\\s*([+-]\\s*\\d{1,2})?(?:\\s+(?:with\\s+)?(adv|advantage|dis|disadvantage))?$`, 'i');
export const rollWords = (text) => {
  const t = String(text ?? '').trim(); let m, expr, why;
  if ((m = t.match(CHECK_RE))) { expr = `d20${m[2] ? m[2].replace(/\s+/g, '') : ''}${m[3] ? ' ' + m[3] : ''}`; why = m[1].toLowerCase(); }
  else if ((m = t.match(/^(?:roll\s+|\/r\s+)?(\d*d\d+[^a-z]*)\s+(?:for\s+)?([a-z][a-z' ]{1,40})$/i)) && !/^(adv|advantage|dis|disadvantage)$/i.test(m[2].trim())) { expr = m[1].trim(); why = m[2].trim().toLowerCase(); }
  const p = expr && parseDice(expr);
  return p ? { expr, label: p.label, terms: p.terms, why } : null;
};

export function defineCommands(R, app) {
  const add = (c) => R.add(c);
  add({ id: 'faction.set', title: 'Faction', short: 'Faction', icon: 'sun', menu: true, group: 'Build', cls: 'room',
    synonyms: ['faction', 'flavor', 'religion', 'cult', 'temple', 'heraldry', 'banner', 'emblem'],
    when: (ctx) => !!ctx.one && factionTarget(ctx.one),
    parse: (text) => {
      const m = text.trim().match(/^(?:faction|flavor|religion|cult|temple|heraldry|banner|emblem)\s+(.+)$/i);
      if (!m) return null;
      const flavor = /^inherit$/i.test(m[1]) ? 'inherit' : resolveFaction(T.lib, m[1]);
      return flavor ? { flavor } : null;
    },
    chips: (a) => ['faction', a.flavor],
    run: (ctx, a) => a?.flavor ? app.setFaction(ctx.one.id, a.flavor) : app.emit('ring.faction', ctx.one),
  });

  // ---------------- edit (standard modifiers) ----------------
  add({ id: 'edit.undo', title: 'Undo', synonyms: ['revert', 'back'], icon: 'undo-2', keys: ['Mod+Z'], group: 'Edit', cls: 'undo', run: () => app.undo() });
  add({ id: 'edit.redo', title: 'Redo', icon: 'redo-2', keys: ['Mod+Shift+Z', 'Mod+Y'], group: 'Edit', cls: 'undo', run: () => app.redo() });
  add({ id: 'edit.cut', title: 'Cut', icon: 'scissors', keys: ['Mod+X'], group: 'Edit', menu: true, cls: (ctx) => ctx.gm ? true : null, when: (ctx) => things(ctx).length > 0, run: () => { app.copy(); app.deleteSelection(); }, native: 'cut' });
  add({ id: 'edit.copy', title: 'Copy', icon: 'copy', keys: ['Mod+C'], group: 'Edit', menu: true, when: (ctx) => things(ctx).length > 0, run: () => { const t = app.copy(); navigator.clipboard?.writeText(t).catch(() => {}); app.toast('Copied'); }, native: 'copy' });
  add({ id: 'edit.paste', title: 'Paste at cursor', icon: 'clipboard-paste', keys: ['Mod+V'], group: 'Edit', cls: (ctx) => ctx.gm ? true : null, when: () => !!app.clip, run: () => app.pasteData(app.clip), native: 'paste' });
  add({ id: 'edit.duplicate', title: 'Duplicate', synonyms: ['clone', 'copy here'], icon: 'copy', keys: ['Mod+D'], group: 'Edit', menu: true, cls: (ctx) => ctx.gm ? true : null, when: (ctx) => things(ctx).length > 0, run: () => app.duplicate() });
  add({ id: 'edit.delete', title: 'Delete', synonyms: ['remove', 'erase'], icon: 'trash-2', keys: ['Delete', 'Backspace'], group: 'Edit', menu: true, danger: true, cls: (ctx) => ctx.gm ? true : null, when: (ctx) => things(ctx).length > 0, run: () => app.deleteSelection() });
  add({ id: 'edit.selectAll', title: 'Select all (this room)', icon: 'square-dashed', keys: ['Mod+A'], group: 'Select', run: () => app.selectAll() });
  add({ id: 'edit.deselect', title: 'Clear selection / cancel', icon: 'x', keys: ['Escape'], group: 'Select', hidden: true, run: () => { if (app.mode) app.modes.cancel(); else app.clearSelection(); } });
  add({ id: 'sel.parent', title: 'Select parent', icon: 'layers', keys: ['Shift+Enter'], group: 'Select', when: (ctx) => !!ctx.one && !!app.parentOf(ctx.one), run: (ctx) => app.select(app.parentOf(ctx.one).id) });
  add({ id: 'sel.children', title: 'Select children', icon: 'boxes', keys: ['Enter'], group: 'Select', when: (ctx) => ctx.sel.some(e => app.childrenOf(e).length), run: (ctx) => app.select(ctx.sel.flatMap(e => app.childrenOf(e).map(c => c.id))) });
  // Arrow = one grid square, Shift+arrow = 1 ft (Harry 2026-10-15); "left/right/up/down" are the SCREEN's (app.arrowAxes)
  for (const [dir, sx, sy, k] of [['left', -1, 0, 'ArrowLeft'], ['right', 1, 0, 'ArrowRight'], ['up', 0, 1, 'ArrowUp'], ['down', 0, -1, 'ArrowDown']]) {
    add({ id: `edit.nudge5.${dir}`, title: `Move ${dir} one square`, icon: 'move', keys: [k], group: 'Arrange', hidden: true, when: touchable, run: () => app.nudgeScreen(sx, sy, 5) });
    add({ id: `edit.nudge.${dir}`, title: `Nudge ${dir} 1 ft`, icon: 'move', keys: [`Shift+${k}`], group: 'Arrange', hidden: true, when: touchable, run: () => app.nudgeScreen(sx, sy, 1) });
  }
  // the ring's turn button: drag it to turn (Shift snaps 15°); a click turns 45°
  add({ id: 'edit.rotate', title: 'Turn (drag; click = 45°)', icon: 'rotate-cw', keys: ['R'], group: 'Arrange', ring: { kinds: ['prop', 'openable', 'pawn'], slot: 10, drag: 'rotate' }, when: (ctx) => touchable(ctx) && ctx.sel.every(e => (e.kind === 'object' || e.kind === 'token') && !frozen(e)), run: () => app.rotateSelection(45) });
  // raise / lower ("pick it up off the floor"): drag up or down; Shift snaps to 6 in; lifted things may hang or fly
  add({ id: 'edit.lift', title: 'Raise / lower (drag)', short: 'Raise / lower', synonyms: ['lift', 'elevation', 'height', 'fly', 'hang', 'raise', 'lower'], icon: 'move-vertical', group: 'Arrange', menu: true, ring: { drag: 'lift' }, when: (ctx) => !!ctx.one && (ctx.one.kind === 'object' || ctx.one.kind === 'token') && app.canTouch(ctx.one) && !frozen(ctx.one), run: (ctx) => app.toast(ctx.one?.kind === 'token' ? 'Drag the raise / lower button up or down: a pawn under 5 ft settles to the ground (Shift: 5 ft steps)' : 'Drag the raise / lower button up or down (Shift snaps to 6 in)') });
  // tip it over: a drag button in the ☰ circle, the turn's gesture about another axis (free, 45° notches, Shift = 15° steps).
  // A click on the button does nothing (it stole short drags); the chord and the bar's plain "Roll" lay it over / stand it up.
  const tiltable = (ctx) => ctx.sel.length > 0 && ctx.sel.every(e => e.kind === 'object' && canTilt(e) && !e.locked && app.canTouch(e));
  add({ id: 'thing.tilt', title: `${TILT_LABEL} (drag to tip it over)`, short: TILT_LABEL, synonyms: ['tilt', 'roll', 'tip', 'tip over', 'topple', 'knock over', 'lay down', 'on its side', 'sideways', 'upright'], icon: 'rotate-cw-square', group: 'Arrange', menu: true, cls: 'object', ring: { drag: 'tilt' },
    args: [{ name: 'degrees' }], parse: (text, ctx) => { const p = parseTilt(text); return p && tiltable(ctx) ? p : null; }, chips: (a) => [TILT_LABEL.toLowerCase(), a.deg === 0 ? 'upright' : `${a.deg}° about the view`],
    when: tiltable, run: (ctx, a) => a?.deg === 0 ? app.standUpright(ctx.sel) : a?.deg != null ? app.rollSelection(a.deg * Math.PI / 180) : ctx.sel.some(e => quatOfEntity(e)) ? app.standUpright(ctx.sel) : app.rollSelection(Math.PI / 2) });
  // the way home from any orientation: the roll is cleared, the Turn kept
  add({ id: 'thing.upright', title: 'Stand upright', synonyms: ['upright', 'stand up', 'reset roll', 'unroll', 'untilt', 'right way up', 'roll 0'], icon: 'arrow-up', group: 'Arrange', menu: true, cls: 'object', when: (ctx) => tiltable(ctx) && ctx.sel.some(e => quatOfEntity(e)), run: (ctx) => app.standUpright(ctx.sel) });
  add({ id: 'edit.resize', title: 'Resize (drag)', icon: 'scaling', group: 'Arrange', ring: { kinds: ['prop', 'openable'], slot: { prop: 11.34, openable: 4 }, drag: 'size' }, when: (ctx) => ctx.gm && !!ctx.one && ctx.one.kind === 'object' && ctx.one.place !== 'tile' && !ctx.one.locked, run: () => app.toast('Drag the resize button to grow or shrink (Shift: 25% steps)') });
  add({ id: 'edit.rotateBack', title: 'Turn 45° anticlockwise', icon: 'rotate-ccw', keys: ['Shift+R'], group: 'Arrange', hidden: true, when: (ctx) => touchable(ctx) && ctx.sel.every(e => (e.kind === 'object' || e.kind === 'token') && !frozen(e)), run: () => app.rotateSelection(-45) });

  // ---------------- view ----------------
  add({ id: 'view.bar', title: 'Command bar', icon: 'search', keys: ['/', 'Mod+K'], group: 'View', hidden: true, run: () => app.emit('bar.open') });
  add({ id: 'view.sheet', title: 'Keyboard shortcuts', synonyms: ['help', 'keys', 'hotkeys'], icon: 'keyboard', keys: ['?'], group: 'View', run: () => app.emit('sheet.toggle') });
  add({ id: 'view.frame', title: 'Frame selection', synonyms: ['zoom to', 'focus'], icon: 'focus', keys: ['F'], group: 'View', when: (ctx) => ctx.sel.length > 0, run: () => app.frameSelection() });
  add({ id: 'view.reset', title: 'Reset view', icon: 'map', keys: ['Mod+0'], group: 'View', run: () => app.resetView() });
  add({ id: 'view.zoomIn', title: 'Zoom in', icon: 'zoom-in', keys: ['Mod+='], group: 'View', run: () => app.zoom(0.8) });
  add({ id: 'view.zoomOut', title: 'Zoom out', icon: 'zoom-out', keys: ['Mod+-'], group: 'View', run: () => app.zoom(1.25) });
  // the level being worked on (storeys): the floor height rooms are drawn at; steps by the building's storey height
  // the room a "look into this room" would cut to: the selected room, or the room the selected thing is in
  const cutRoomOf = (ctx) => { const e = ctx.one; if (!e) return null; const E = app.entities(); return e.kind === 'room' ? e : e.kind === 'object' && E[e.room] ? E[e.room] : (e.kind === 'object' || e.kind === 'token') ? app.roomAt(e.x, e.z, e.y || 0) : null; };
  // the pawn whose level "cut to my pawn" goes to: the selected pawn, else the one pawn this seat owns
  const cutPawnOf = (ctx) => { if (ctx.one?.kind === 'token') return ctx.one; const mine = Object.values(app.entities()).filter(e => e.kind === 'token' && e.owner === app.me()); return mine.length === 1 ? mine[0] : null; };
  // LEVEL UP / LEVEL DOWN (Harry 2026-10-06: one level): the level you are on is the level you see AND the level you
  // build on (surfaces/cut.js). ] and [ are ONLY the level keys (a selected pawn's damage keys are = and -, PAWN_DAMAGE_KEYS); } and { step levels too.
  add({ id: 'level.up', title: 'Level up (go up one storey: you see it and build on it)', short: 'Level up', synonyms: ['floor up', 'level up', 'storey up', 'upstairs', 'build level', 'second floor', 'next floor', 'cut up'], icon: 'arrow-up', keys: [']'], group: 'View', run: () => app.floorUp('key') });
  add({ id: 'level.up2', title: 'Level up', icon: 'arrow-up', keys: ['}'], group: 'View', hidden: true, run: () => app.floorUp('key') });
  add({ id: 'level.down2', title: 'Level down', icon: 'arrow-down', keys: ['{'], group: 'View', hidden: true, run: () => app.floorDown('key') });
  add({ id: 'cut.off', title: 'Show all levels', short: 'All levels', synonyms: ['all levels', 'cut off', 'no cut', 'show everything', 'whole building', 'show all'], icon: 'layers', keys: ['\\'], group: 'View', when: () => app.cut?.y != null, run: () => app.cutOff('bar') });
  add({ id: 'cut.on', title: 'Show only the level I am on (and below)', short: 'This level only', synonyms: ['this level', 'cut on', 'cut here', 'hide upper floors', 'my level', 'one level'], icon: 'layers', keys: ['\\'], group: 'View', when: () => app.cut?.y == null, run: () => app.cutOn('bar') });
  add({ id: 'cut.room', title: 'Look into this room (cut the view at its ceiling)', short: 'Look into room', synonyms: ['cut here', 'cut to room', 'see inside', 'look inside', 'this floor'], icon: 'layers', group: 'View', hint: 'or double-click the room',
    when: (ctx) => !!cutRoomOf(ctx), run: (ctx) => app.cutToRoom(cutRoomOf(ctx), 'bar') });
  add({ id: 'cut.pawn', title: "Cut to my pawn's level", short: 'Cut to pawn', synonyms: ['cut to pawn', 'follow pawn', 'my floor', 'cut to lv'], icon: 'layers', group: 'View', when: (ctx) => !!cutPawnOf(ctx), run: (ctx) => app.cutToPawn(cutPawnOf(ctx), 'bar') });
  add({ id: 'view.roofsOn', title: 'Roofs on', synonyms: ['roofs', 'show roofs', 'roof'], icon: 'house', group: 'View', when: () => !app.roofs, run: () => { app.setRoofs(true, 'bar'); app.cutOff('bar'); } });
  add({ id: 'view.roofSurfacePainted', title: 'Roofs: painted flat surface (the old look, to compare)', short: 'Painted roofs', synonyms: ['flat roofs', 'old roofs', 'painted roofs', 'roof surface', 'roof sections off', 'procedural roofs'], icon: 'house', group: 'View', when: () => app.roofSurface?.() === 'sections', run: () => { app.roofSurface('painted'); app.toast('Roofs: the painted flat surface'); } });
  add({ id: 'view.roofSurfaceSections', title: 'Roofs: modelled shingles (roof sections)', short: 'Modelled roofs', synonyms: ['shingles', 'modelled roofs', 'roof sections', 'roof surface', 'new roofs', '3d roofs'], icon: 'house', group: 'View', when: () => app.roofSurface?.() === 'painted', run: () => { app.roofSurface('sections'); app.toast('Roofs: modelled shingles'); } });
  add({ id: 'view.roofsOff', title: 'Roofs off', synonyms: ['roofs', 'hide roofs', 'roof'], icon: 'house', group: 'View', when: () => !!app.roofs, run: () => app.setRoofs(false, 'bar') });
  add({ id: 'level.down', title: 'Level down (go down one storey: you see it and build on it)', short: 'Level down', synonyms: ['floor down', 'level down', 'storey down', 'downstairs', 'cellar', 'dungeon', 'basement', 'below ground', 'cut down'], icon: 'arrow-down', keys: ['['], group: 'View', run: () => app.floorDown('key') });
  add({ id: 'level.ground', title: 'Level: back to the ground', short: 'Ground level', synonyms: ['ground floor', 'level 1', 'lv 1'], icon: 'map', group: 'View', when: () => (app.level || 0) !== 0, run: () => app.goLevel(0, 'bar') });
  add({ id: 'view.walls', title: 'Show / hide walls', synonyms: ['cut-away', 'walls', 'hide walls'], icon: 'brick-wall', group: 'View', run: () => app.toggleWalls() });
  add({ id: 'view.selHalo', title: 'Selection: corner brackets (the house look)', synonyms: ['selection style', 'brackets', 'house look'], icon: 'sun', group: 'View', when: () => app.selStyle !== 'halo', run: () => app.setSelStyle('halo') });
  add({ id: 'view.selFoot', title: 'Selection: footprint on the ground', synonyms: ['selection style', 'footprint', 'outline'], icon: 'square-dashed', group: 'View', when: () => app.selStyle !== 'footprint', run: () => app.setSelStyle('footprint') });
  add({ id: 'view.theme', title: 'Toggle light / dark', synonyms: ['theme', 'light mode', 'dark mode'], icon: 'sun', group: 'View', run: () => app.toggleTheme() });
  add({ id: 'view.pipClose', title: 'Close picture-in-picture', icon: 'picture-in-picture-2', group: 'View', when: () => !!app.pip, run: () => app.closePip() });
  add({ id: 'view.pipSwap', title: 'Swap picture-in-picture with main view', icon: 'picture-in-picture-2', group: 'View', when: () => !!app.pip, run: () => app.swapPip() });
  add({ id: 'view.ping', title: 'Ping here', synonyms: ['point', 'look here'], icon: 'crosshair', group: 'View', hint: 'or Alt+click', run: () => app.cursor && app.ping(app.cursor[0], app.cursor[1], app.cursor.y || app.cursor[2] || 0) });

  // ---------------- the selection ring's buttons (fixed clock positions) and the ☰ tree ----------------
  add({ id: 'thing.open', toggle: { of: (ctx) => ctx.sel, is: (e) => !!e.open, on: ['Close', 'door-closed'], off: ['Open', 'door-open'] }, keys: ['O'], group: 'Use', menu: true, cls: 'open', ring: { kinds: ['openable'], slot: 11 }, when: (ctx) => !!ctx.one && kindOfCtx(ctx, ctx.one) === 'openable' && app.canOpen(ctx.one), run: (ctx) => app.toggleOpen(ctx.one) });
  add({ id: 'thing.pin', toggle: { of: (ctx) => ctx.sel, is: (e) => !!e.pinned, on: ['Unpin', 'pin-off'], off: ['Pin (keeps it through a re-roll)', 'pin'], mix: 'Pin all' }, group: 'Arrange', menu: true, cls: 'object', ring: { kinds: ['prop', 'openable'], slot: { prop: 12.66, openable: 12 } }, when: is('prop', 'openable'), run: (ctx) => app.flag(ctx.sel.map(e => e.id), { pinned: !ctx.sel.every(e => e.pinned) }) });
  // fireplaces, candles, lanterns (the tuner's fire types): the button shows what it will do (lit → put out, dark → light).
  // O is "change this thing's state" (Harry 2026-10-20: L went to the labels): Open / Close first, so one openable (even
  // one that is also a light) opens; Light / Put out when every selected thing is a light. (The key runs the first command
  // whose `when` holds: keep thing.open above thing.light.)
  add({ id: 'thing.light', toggle: { of: (ctx) => ctx.sel, is: (e) => e.lit !== false, on: ['Put out', 'flame'], off: ['Light', 'flame-kindling'], mix: 'Light all' }, synonyms: ['extinguish', 'kindle', 'snuff', 'fire', 'candle'], keys: ['O'], group: 'Use', menu: true, cls: 'open',
    ring: { kinds: ['openable'], slot: 1 }, when: (ctx) => ctx.sel.length > 0 && ctx.sel.every(e => e.kind === 'object' && app.assets.lightable(e.cat) && !e.locked), run: (ctx) => app.toggleLit(ctx.sel) });
  add({ id: 'thing.hide', toggle: { of: (ctx) => things(ctx), is: (e) => !!e.hidden, on: ['Reveal to players', 'eye'], off: ['Hide from players', 'eye-off'], mix: 'Hide all from players' }, synonyms: ['secret', 'reveal', 'unhide', 'gm only'], group: 'Visibility', menu: true, cls: 'reveal', ring: { kinds: ['room', 'building'], slot: { room: 1, building: 10 } }, when: (ctx) => things(ctx).length > 0, run: (ctx) => app.setHidden(things(ctx), !things(ctx).every(e => e.hidden)) });
  // LOCK is for things, rooms and buildings. A pawn has none (dropped 2026-10-11), so a selection with a pawn in it is not offered Lock at all
  add({ id: 'thing.lock', toggle: { of: (ctx) => things(ctx), is: (e) => !!e.locked, on: ['Unlock', 'lock-open'], off: ['Lock', 'lock'], mix: 'Lock all' }, synonyms: ['freeze'], group: 'Arrange', menu: true, cls: 'object', when: (ctx) => things(ctx).length > 0 && !ctx.sel.some(e => e.kind === 'token'), run: (ctx) => app.flag(things(ctx).map(e => e.id), { locked: !things(ctx).every(e => e.locked) }) });
  add({ id: 'thing.replace', title: 'Replace with similar…', synonyms: ['swap', 'variant', 'other version'], icon: 'replace', group: 'Edit', menu: true, cls: 'object', when: (ctx) => !!ctx.one && ctx.one.kind === 'object' && !!ctx.one.cat, run: (ctx) => app.emit('ring.replace', ctx.one) });
  // a pawn's name is on its SHEET CARD (Harry 2026-10-11; it was "Set / change name" in its ☰): F2 and the bar open the card on the name
  add({ id: 'thing.rename', title: (ctx) => ctx.one?.kind === 'token' ? 'Set / change name' : 'Rename / label…', cap: (ctx) => ctx.one?.kind === 'token' ? 'Change name' : null, /* the ring's caption (two short lines); the full name is the button's title */ synonyms: ['label', 'name', 'rename', 'set name', 'change name'], icon: 'pencil', keys: ['F2'], group: 'Edit', menu: true, cls: (ctx) => ctx.one?.kind === 'token' ? 'pawn' : 'object', when: (ctx) => !!ctx.one && ['token', 'object', 'building'].includes(ctx.one.kind) && (ctx.gm || app.canTouch(ctx.one)), run: (ctx) => app.emit('ring.rename', ctx.one) });
  // later (visible stubs)
  for (const [id, title, icon, group, kinds] of [
    ['thing.age', 'Condition / age', 'clock', 'Look', ['prop', 'openable']],
    ['thing.fill', 'Fill', 'droplet', 'Look', ['prop', 'openable']], ['thing.break', 'Break', 'hammer', 'Look', ['prop', 'openable']],
    ['thing.contents', 'Contents', 'package', 'Use', ['openable', 'prop']], ['thing.notes', 'Description and notes', 'notebook-pen', 'Edit', ['prop', 'openable', 'pawn', 'room']],
    ['pawn.vision', 'Vision', 'eye', 'Pawn', ['pawn']], ['pawn.elevation', 'Elevation', 'layers', 'Pawn', ['pawn']],
    ['pawn.size', 'Enlarge / reduce', 'maximize-2', 'Pawn', ['pawn']],
    ['wall.door', 'Add a door', 'door-closed', 'Wall', ['wall']],
  ]) add({ id, title: `${title} (later)`, icon, group, menu: true, stub: true, enabled: STUB, when: is(...kinds), run: () => {} });

  // ---------------- pawns ----------------
  // THE PAWN'S RING (Harry 2026-10-06; docs/UI.md "Pawn ring"): closed, turn · sheet · damage · ☰.
  const pawns = is('pawn');
  // SHEET: one click opens a small card: the character-sheet link (a new tab), and Notes / GM notes (surfaces/ring.js)
  add({ id: 'pawn.sheet', title: 'Character sheet and notes', short: 'Sheet', synonyms: ['sheet', 'character sheet', 'notes', 'gm notes', 'link', 'dnd beyond'], icon: 'file-text', group: 'Pawn', menu: true, ring: { kinds: ['pawn'], slot: 11.34, opens: 'sheet' }, when: (ctx) => ctx.one?.kind === 'token', run: (ctx) => app.emit('ring.sheet', ctx.one) });
  // DAMAGE (Harry 2026-10-06: "instead it's 'damage'. That means 0 is always healthy"): a drag handle with a track (a
  // fixed number of pixels per point); a plain click opens a field: 7 takes 7, -5 heals 5, =12 sets it.
  // Everyone can change everyone's damage (core token.damage), and every change leaves an undo (surfaces/undochips.js).
  add({ id: 'pawn.damage', title: 'Damage (drag to change; click to type 7, -5 or =12)', short: 'Damage', synonyms: ['damage', 'hp', 'hit points', 'hurt', 'heal', 'health', 'wounds', 'life'], icon: 'heart-crack', group: 'Pawn', menu: true, cls: 'pawn', ring: { kinds: ['pawn'], slot: 12.66, drag: 'damage', badge: (ctx) => ctx.one?.damage > 0 ? String(ctx.one.damage) : '' }, when: pawns, run: () => app.emit('ring.damage') });
  add({ id: 'pawn.damageUp', title: 'Damage +1', icon: 'plus', keys: [PAWN_DAMAGE_KEYS.add], group: 'Pawn', hidden: true, cls: 'pawn', when: pawns, run: (ctx) => app.damageDelta(ctx.sel, 1) });
  add({ id: 'pawn.damageDown', title: 'Damage -1 (heal one)', icon: 'minus', keys: [PAWN_DAMAGE_KEYS.remove], group: 'Pawn', hidden: true, cls: 'pawn', when: pawns, run: (ctx) => app.damageDelta(ctx.sel, -1) });
  for (const c of CONDITIONS) add({ id: `pawn.cond.${c}`, title: (ctx) => `${ctx.sel.every(p => (p.conditions || []).includes(c)) ? '✓ ' : ''}${c}`, synonyms: [`condition ${c}`], icon: 'badge-alert', group: 'Pawn ▸ Conditions', menu: true, cls: 'pawn', when: (ctx) => is('pawn')(ctx) && touchable(ctx), run: (ctx) => app.toggleCondition(ctx.sel, c) });
  // INDICATORS: eight persistent markers over a pawn, WoW's raid markers; one per pawn, seen by every seat, cleared here
  for (const [key, label] of MARKS) add({ id: `pawn.mark.${key}`, title: (ctx) => `${ctx.sel.every(p => p.mark === key) ? '✓ ' : ''}${label}`, short: label, synonyms: [`indicator ${label}`, `mark ${label}`, 'marker', 'raid marker'], icon: 'star', pic: () => markUrl(key), group: 'Pawn ▸ Indicators', menu: true, cls: 'pawn', when: pawns, run: (ctx) => app.setMark(ctx.sel, ctx.sel.every(p => p.mark === key) ? '' : key) });
  add({ id: 'pawn.mark.none', title: 'Clear the indicator', short: 'Clear', synonyms: ['clear indicator', 'clear mark', 'unmark', 'no marker'], icon: 'x', group: 'Pawn ▸ Indicators', menu: true, cls: 'pawn', when: (ctx) => pawns(ctx) && ctx.sel.some(p => p.mark), run: (ctx) => app.setMark(ctx.sel, '') });
  // the GM's chores on a pawn. Since 2026-10-11 neither is on the ring (client/menu.js NOT_IN_MENU): Duplicate is
  // Ctrl/⌘+D and the bar; Give control is on the pawn's sheet card (this command opens the card there). Kill is the Delete key.
  add({ id: 'pawn.duplicate', title: 'Duplicate', synonyms: ['clone pawn', 'another one', 'copy pawn'], icon: 'copy', group: 'Pawn', menu: true, cls: (ctx) => ctx.gm ? 'token.edit' : null, when: pawns, run: () => app.duplicate() });
  add({ id: 'pawn.give', title: 'Give control to a player…', short: 'Give control', synonyms: ['owner', 'assign', 'hand over', 'give pawn', 'control'], icon: 'user-plus', group: 'Pawn', menu: true, cls: (ctx) => ctx.gm ? 'token.edit' : null, when: (ctx) => ctx.one?.kind === 'token', run: (ctx) => app.emit('ring.give', ctx.one) });
  // DARKNESS (2026-10-20; core/darkness.js): typed with pawns selected, "darkvision 60" (or "sees in the dark 60"; "darkvision
  // default" = 30 ft again) and "carries light 40"; with lights selected (GM), "light radius 15" ("light radius default" = its kind's)
  const FT = '(\\d{1,3}(?:\\.\\d+)?|default|none|reset)\\s*(?:ft|feet|foot|\')?';
  const feetArg = (re, max) => (text) => { const m = String(text).trim().match(re); if (!m) return null; const v = /^\d/.test(m[1]) ? Math.max(0, Math.min(max, Math.round(+m[1]))) : null; return { v }; };
  const ftChip = (a, dflt) => a.v == null ? `default (${dflt})` : `${a.v} ft`;
  add({ id: 'pawn.darkvision', title: 'Darkvision… (type: darkvision 60)', short: 'Darkvision', synonyms: ['darkvision', 'dark vision', 'sees in the dark', 'night vision', 'infravision'], icon: 'moon', group: 'Pawn', cls: 'pawn',
    when: pawns,
    parse: feetArg(new RegExp(`^(?:dark ?vision|sees? in the dark|night ?vision|infravision)\\s+(?:of\\s+|to\\s+|=\\s*)?${FT}$`, 'i'), DK.DARKVISION_MAX),
    chips: (a, ctx) => ['darkvision', ftChip(a, `${DK.DARKVISION_DEFAULT} ft`), '→', ctx.sel.map(e => e.name).join(', ')],
    run: (ctx, a) => a ? app.batch(ctx.sel.filter(e => e.kind === 'token').map(e => ({ type: 'token.set', args: { id: e.id, darkvision: a.v } }))) : app.emit('bar.open', `darkvision ${ctx.one?.darkvision ?? DK.DARKVISION_DEFAULT}`) });
  add({ id: 'pawn.carryLight', title: 'Carries a light… (type: carries light 40)', short: 'Carried light', synonyms: ['carries light', 'carry light', 'holds a torch', 'torch', 'lantern', 'light radius'], icon: 'flame', group: 'Pawn', cls: 'pawn',
    when: pawns,
    parse: feetArg(new RegExp(`^(?:carr(?:y|ies)|holds?)\\s+(?:a\\s+)?(?:light|torch|lantern)\\s+(?:of\\s+|=\\s*)?${FT}$`, 'i'), DK.CARRIED_LIGHT_MAX),
    chips: (a, ctx) => ['carries light', ftChip(a, 'none'), '→', ctx.sel.map(e => e.name).join(', ')],
    run: (ctx, a) => a ? app.batch(ctx.sel.filter(e => e.kind === 'token').map(e => ({ type: 'token.set', args: { id: e.id, lightCarried: a.v } }))) : app.emit('bar.open', 'carries light ') });
  add({ id: 'thing.lightRadius', title: 'Light radius… (type: light radius 15)', short: 'Light radius', synonyms: ['light radius', 'light reach', 'how far it lights', 'brightness'], icon: 'flame', group: 'Use', cls: 'object', // (the bar only: the ring's light menu is Harry's fixed layout)
    when: (ctx) => ctx.sel.length > 0 && ctx.sel.every(e => e.kind === 'object' && app.assets.lightKind?.(e.cat) && !e.locked),
    parse: feetArg(new RegExp(`^(?:light (?:radius|reach)|lights? to)\\s+(?:of\\s+|=\\s*)?${FT}$`, 'i'), DK.LIGHT_RADIUS_MAX),
    chips: (a, ctx) => ['light radius', a.v == null ? 'default (by kind)' : `${a.v} ft`, '→', ctx.sel.map(e => e.name).join(', ')],
    run: (ctx, a) => a ? app.batch(ctx.sel.map(e => ({ type: 'object.set', args: { id: e.id, lightRadius: a.v } }))) : app.emit('bar.open', `light radius ${ctx.one ? app.assets.lightRadius?.(ctx.one, app.fog?.lightTable?.()) ?? '' : ''}`) });
  // typed in the bar with pawns selected: "+7" is 7 damage, "-5" heals 5, "=12" sets it (the ring field's own parser; a
  // bare number is left to the bar's other meanings)
  add({ id: 'pawn.damageTyped', title: 'Damage / heal selected', icon: 'heart-crack', group: 'Pawn', hidden: true, cls: 'pawn', when: is('pawn'),
    parse: (text, ctx) => { const p = /^\s*[+\-=\u2212]/.test(text) ? parseDamage(text) : damageWords(text); return p && ctx.sel.length && ctx.sel.every(e => e.kind === 'token') ? p : null; },
    chips: (a, ctx) => [a.set != null ? 'set damage' : a.delta < 0 ? 'heal' : 'damage', String(a.set ?? Math.abs(a.delta)), '→', ctx.sel.map(e => e.name).join(', ')], run: (ctx, a) => a.set != null ? app.damageSet(ctx.sel, a.set) : app.damageDelta(ctx.sel, a.delta) });

  // ---------------- chat & dice ("say …", "roll …") ----------------
  add({ id: 'chat.say', title: 'Say…', synonyms: ['chat', 'talk', 'tell'], icon: 'message-square', group: 'Talk', cls: 'chat',
    parse: (text) => { const m = text.match(/^say\s+(.+)/i); return m ? { text: m[1] } : null; }, chips: (a) => ['say', a.text], run: (ctx, a) => a?.text && app.say(a.text) });
  add({ id: 'chat.roll', title: 'Roll dice…', synonyms: ['roll', 'dice', 'd20'], icon: 'dices', group: 'Talk', cls: 'chat',
    parse: (text) => { const m = text.match(/^(?:roll\s+|\/r\s+)?(\d*d\d+.*)$/i); const p = m && parseDice(m[1]); return p ? { expr: m[1], label: p.label, terms: p.terms } : rollWords(text); },
    chips: (a) => ['roll', ...a.label.split(/(?=[+-])/).map(s => s.trim()), ...(a.why ? [a.why] : [])], run: (ctx, a) => a?.expr && app.roll(a.expr, a.why) });
  // WHISPER: a private line to one person at the table ("whisper Mira meet me outside"). Not a command to the relay's
  // log: surfaces/chat.js app.whisper. The Pawns menu's party rows open the bar on "whisper <name> ".
  const whisperTo = (text) => {
    const m = text.match(/^(?:whisper|tell|w)\s+(.*)$/i); if (!m) return null;
    const rest = m[1], low = rest.toLowerCase(), people = (app.sync.campaign?.seats || []).filter(s => s.kind === 'human' && s.id !== app.me()).sort((a, b) => b.name.length - a.name.length);
    const s = people.find(s => low === s.name.toLowerCase() || low.startsWith(s.name.toLowerCase() + ' '));
    return s ? { to: s.id, name: s.name, text: rest.slice(s.name.length).trim() } : { to: null, name: rest.trim(), text: '' };
  };
  add({ id: 'chat.whisper', title: 'Whisper to one person… (type: whisper Mira meet me outside)', short: 'Whisper', synonyms: ['whisper', 'private message', 'tell', 'dm', 'pm', 'secret'], icon: 'message-square-lock', group: 'Talk', cls: 'chat',
    parse: (text) => whisperTo(text), chips: (a) => ['whisper', a.to ? a.name : `${a.name || '…'} (no such person here)`, a.text || '…'],
    run: (ctx, a) => { if (!a) return app.emit('bar.open', 'whisper '); if (!a.to) return app.toast(`Nobody called "${a.name}" is at the table`, true); if (!a.text) return app.emit('bar.open', `whisper ${a.name} `); app.whisper(a.to, a.text); } });
  add({ id: 'chat.assistant', title: 'Ask the assistant…', icon: 'wand-sparkles', group: 'Talk', hidden: true, stub: true, run: (ctx, a) => app.toast(`Natural language goes to the assistant seat (not wired yet): "${a?.text || ''}"`) });

  // ---------------- building (GM) ----------------
  for (const t of app.roomgen.typeList) add({ id: `build.${t.key}`, title: `Build ${t.label.toLowerCase()}`, synonyms: [t.key, t.label, `${t.label} room`, 'room', 'build'], icon: 'square-dashed', img: `room-${t.key}`, group: 'Build', cls: 'room', hint: 'drag a rectangle', run: () => app.modes.roomTool(t.key) });
  const room = (ctx) => ctx.one?.kind === 'room' ? ctx.one : null;
  // WHOLE BUILDINGS (docs/BUILDINGS.md): a generated building remembers its recipe (building.gen), so it can be made again
  // with another storey count or another seed, as one undoable step. The same offers float beside a building just made.
  const genB = (ctx) => { const e = ctx.one, b = e?.kind === 'building' ? e : e?.kind === 'room' && e.building ? app.entities()[e.building] : null; return b?.gen ? b : null; };
  const isB = (ctx) => ctx.one?.kind === 'building' && !!ctx.one.gen;
  for (const n of [1, 2, 3]) add({ id: `building.storeys.${n}`, title: `Whole building: ${n} storey${n === 1 ? '' : 's'} (makes it again)`, short: `${n} storey${n === 1 ? '' : 's'}`, synonyms: ['storeys', 'stories', 'floors', 'levels', `${n} floors`, `${n} levels`, 'taller', 'shorter'], icon: 'layers', group: 'Building ▸ Storeys', menu: true, cls: 'room',
    when: (ctx) => { const b = isB(ctx) && genB(ctx), P = b && app.buildingProgramme(b.gen.code); return !!P && n >= P.storeys.min && n <= P.storeys.max && b.gen.storeys !== n; }, run: (ctx) => app.regenBuilding(genB(ctx).id, { storeys: n }) });
  add({ id: 'building.reroll', title: 'Re-roll the whole building (a new layout on the same footprint)', short: 'Re-roll building', synonyms: ['reroll building', 'regenerate building', 'new layout', 'new seed', 'building dice'], icon: 'dice-5', group: 'Building', menu: true, cls: 'room', when: (ctx) => isB(ctx), run: (ctx) => app.regenBuilding(genB(ctx).id, { seed: 1 + Math.floor(Math.random() * 1e6) }) });
  add({ id: 'build.whole', title: 'Build a whole building: build inn 12x8 (seed 7, 3 storeys)', synonyms: ['whole building', 'generate building', 'inn', 'mansion', 'castle', 'crypt'], icon: 'house', group: 'Build', cls: 'room', hint: 'build inn 12x8',
    parse: (text) => { const m = text.match(/^build\s+(?:an?\s+)?([a-z' &]+?)\s+(\d{1,2})\s*[x×]\s*(\d{1,2})(?:\s+seed\s+(\d+))?(?:\s+(\d)\s*(?:storeys?|stories|floors?|levels?))?\s*$/i); const node = m && app.buildingNode(m[1]); return node ? { node, w: +m[2], d: +m[3], seed: m[4] ? +m[4] : undefined, storeys: m[5] ? +m[5] : undefined } : null; },
    chips: (a) => ['build', a.node.label, `${a.w * 5} × ${a.d * 5} ft`, ...(a.seed ? [`seed ${a.seed}`] : []), ...(a.storeys ? [`${a.storeys} storeys`] : [])],
    run: (ctx, a) => a?.node ? app.buildAt(a.node, a.w, a.d, { seed: a.seed, storeys: a.storeys }) : app.emit('bar.open', 'build inn 12x8') });
  add({ id: 'room.reroll', title: 'Re-roll room (keeps pinned)', short: 'Re-roll', synonyms: ['reroll', 'regenerate', 'new seed', 'roll again', 'dice'], icon: 'dice-5', group: 'Room', menu: true, cls: 'room', ring: { kinds: ['room'], slot: 12 }, when: (ctx) => !!room(ctx) && !room(ctx).locked, run: (ctx) => app.rerollRoom(room(ctx)) });
  // turn a room a quarter turn about its centre, its contents with it (Harry 2026-10-05); the ring's turn button, where a thing's is
  add({ id: 'room.rotate', title: 'Turn room 90°', short: 'Turn 90°', synonyms: ['rotate room', 'turn room', 'spin room', 'quarter turn'], icon: 'rotate-cw', keys: ['R'], group: 'Room', menu: true, cls: 'room', ring: { kinds: ['room'], slot: 10 }, when: (ctx) => !!room(ctx) && !room(ctx).locked, run: (ctx) => app.rotateRoom(room(ctx), 1) });
  add({ id: 'room.rotateBack', title: 'Turn room 90° anticlockwise', short: 'Turn back 90°', synonyms: ['rotate room back', 'counter-clockwise'], icon: 'rotate-ccw', keys: ['Shift+R'], group: 'Room', menu: true, cls: 'room', when: (ctx) => !!room(ctx) && !room(ctx).locked, run: (ctx) => app.rotateRoom(room(ctx), -1) });
  for (const t of app.roomgen.typeList) add({ id: `room.type.${t.key}`, title: `Room type: ${t.label}`, short: t.label, synonyms: [`make it a ${t.label}`, `change type ${t.label}`, `change to ${t.key}`], icon: 'house', img: `room-${t.key}`, group: 'Room ▸ Change type', menu: true, cls: 'room', when: (ctx) => !!room(ctx) && room(ctx).recipe.type !== t.key, run: (ctx) => app.rerollRoom(room(ctx), t.key) });
  for (const f of ['auto', ...app.roomgen.families]) add({ id: `room.walls.${f}`, short: f === 'auto' ? 'By room type' : f.replace(/-/g, ' '), title: `${f === 'auto' ? 'Walls: by room type' : 'Walls: ' + f.replace(/-/g, ' ')}`, synonyms: ['walls', f], icon: 'brick-wall', group: 'Room ▸ Walls', menu: true, cls: 'room', when: (ctx) => !!room(ctx) && (room(ctx).recipe.wallFamily || 'auto') !== f, run: (ctx) => app.setRoom(room(ctx), 'wallFamily', f) });
  for (const f of ['auto', ...app.roomgen.floors]) add({ id: `room.floor.${f}`, short: f === 'auto' ? 'By room type' : f.replace(/^floor-/, '').replace(/-/g, ' '), preview: f === 'auto' ? null : () => app.previewOf({ id: f, place: 'tile' }), title: `${f === 'auto' ? 'Floor: by room type' : 'Floor: ' + f.replace(/^floor-/, '').replace(/-/g, ' ')}`, synonyms: ['floor', f], icon: 'layout-grid', group: 'Room ▸ Floor', menu: true, cls: 'room', when: (ctx) => !!room(ctx) && (room(ctx).recipe.floor || 'auto') !== f, run: (ctx) => app.setRoom(room(ctx), 'floor', f) });
  // this room's own fog height (Harry 2026-10-05: "can we also get that fog-height slider attached to the room menu?"):
  // opens a slider at the ring's button (surfaces/ring.js); the value is room.set { fog } (core), one command per release
  add({ id: 'room.fog', title: 'Fog height…', short: 'Fog height', synonyms: ['fog', 'mist', 'no fog', 'fog height', 'haze'], icon: 'cloud-fog', group: 'Room', menu: true, cls: 'room', when: (ctx) => !!room(ctx) && !room(ctx).locked, run: (ctx) => app.emit('ring.fog', room(ctx)) });
  // a tall room (a great hall, a nave): ONE room spanning several storeys (core room.tall); refused, with the reason, when a room above is in the way
  const setTall = (r, d) => { const n = (r.recipe.tall || 1) + d; if (n < 1) return app.toast('It is one storey tall already', true); if (n > 6) return app.toast('Six storeys is as tall as a room goes', true); return app.dispatch('room.tall', { id: r.id, tall: n }); };
  add({ id: 'room.height.taller', title: 'Taller (one more storey of height)', short: 'Taller', synonyms: ['tall room', 'great hall', 'high ceiling', 'raise ceiling', 'nave'], icon: 'chevrons-up', group: 'Room', menu: true, cls: 'room', when: (ctx) => !!room(ctx) && !room(ctx).locked && (room(ctx).recipe.tall || 1) < 6, run: (ctx) => setTall(room(ctx), 1) });
  add({ id: 'room.height.shorter', title: 'Shorter (one storey less)', short: 'Shorter', synonyms: ['lower ceiling', 'less tall'], icon: 'chevrons-down', group: 'Room', menu: true, cls: 'room', when: (ctx) => !!room(ctx) && !room(ctx).locked && (room(ctx).recipe.tall || 1) > 1, run: (ctx) => setTall(room(ctx), -1) });
  // a stair joining the room to the storey below it (a cellar: to the storey above): planned like the automatic one
  // STAIRS UP / STAIRS DOWN (Harry 2026-10-11): a stair, spiral or ladder leads up from the level it was put on; this
  // switches it to lead down from that level instead (same place in plan, one flight lower), and back. The button names
  // what you would GET. Counted from the level you are on (core/stairs.js stairSide).
  add({ id: 'stair.flip', toggle: { of: (ctx) => ctx.sel.filter(app.ST.isConnector), is: (e) => app.stairSide(e) === 'down', on: ['Stairs up (it leads up from this level)', 'arrow-up'], off: ['Stairs down (it leads down from this level)', 'arrow-down'], mix: 'Switch stairs up / down' }, short: 'Stairs up / down', synonyms: ['stairs down', 'stairs up', 'flip stair', 'go down', 'go up', 'downstairs', 'upstairs', 'ladder down', 'switch direction'], group: 'Arrange', menu: true, cls: 'object', when: (ctx) => ctx.sel.length > 0 && ctx.sel.every(app.ST.isConnector), run: (ctx) => app.flipStairs(ctx.sel.filter(app.ST.isConnector)) });
  add({ id: 'room.stair', title: 'Add stair (joins this room to the storey below; a cellar: above)', short: 'Add stair', synonyms: ['stairs', 'staircase', 'ladder', 'steps', 'way up', 'way down', 'connect floors'], icon: 'move-vertical', group: 'Room', menu: true, cls: 'object', when: (ctx) => !!room(ctx) && ctx.gm && (room(ctx).recipe.y || 0) !== (app.entities()[room(ctx).building]?.base || 0), run: (ctx) => app.addStair(room(ctx)) });
  add({ id: 'room.replay', title: 'Replay spawn animation', short: 'Replay spawn', synonyms: ['animate', 'spawn in'], icon: 'play', group: 'Room', menu: true, when: (ctx) => !!room(ctx), run: (ctx) => app.replaySpawn(room(ctx)) });
  // ---------------- roofs (storeys, Stage F): a roof is selectable and editable like a room ----------------
  // The selection is 'roof:<room id>' (main.js roofItem); every command writes the room's roof choices (room.set roof)
  // or the building's style (building.set roof), so undo, the relay, other seats and AI seats all get it.
  const roof = (ctx) => ctx.one?.kind === 'roof' ? ctx.one : null;
  const ROOFS = [['thatch', 'Thatch', 'roofing-thatch'], ['tile', 'Clay tile', 'roofing-tile-clay'], ['slate', 'Slate shingle', 'roofing-slate'], ['shingle', 'Wood shingle', 'roofing-shingle-wood'], ['flat', 'Flat', null]];
  const swatch = (cat) => { const k = cat && app.lib.objects[cat]?.skus.find(x => x.kind === 'flat' && x.url); return k ? `${T.base}${T.look.deliver?.(k.url) ?? k.url}` : null; };
  for (const [key, label, cat] of ROOFS) {
    add({ id: `roof.style.${key}`, short: label, title: `Roof: ${label.toLowerCase()}`, synonyms: ['roof', 'roofing', key, label], icon: 'house', pic: () => swatch(cat), group: 'Roof ▸ Style', menu: true, cls: 'room',
      when: (ctx) => !!roof(ctx) && !roof(ctx).locked && roof(ctx).style !== key, run: (ctx) => app.dispatch('room.set', { id: roof(ctx).room, roof: { style: key } }) });
    add({ id: `building.roof.${key}`, short: label, title: `Building's roofs: ${label.toLowerCase()}`, synonyms: ['roof', 'roofing', key, label], icon: 'house', pic: () => swatch(cat), group: 'Building ▸ Roof style', menu: true, cls: 'room',
      when: (ctx) => ctx.one?.kind === 'building' && ctx.one.roof !== key, run: (ctx) => app.dispatch('building.set', { id: ctx.one.id, roof: key }) });
  }
  add({ id: 'roof.style.auto', short: "The building's", title: "Roof: the building's style", synonyms: ['roof', 'auto', 'default'], icon: 'house', group: 'Roof ▸ Style', menu: true, cls: 'room', when: (ctx) => !!roof(ctx) && !roof(ctx).locked && !!roof(ctx).own, run: (ctx) => app.dispatch('room.set', { id: roof(ctx).room, roof: { style: 'auto' } }) });
  add({ id: 'building.roof.auto', short: 'By its walls', title: "Building's roofs: by its walls", synonyms: ['roof', 'auto', 'default'], icon: 'house', group: 'Building ▸ Roof style', menu: true, cls: 'room', when: (ctx) => ctx.one?.kind === 'building' && !!ctx.one.roof, run: (ctx) => app.dispatch('building.set', { id: ctx.one.id, roof: 'auto' }) });
  // a die, as on a room: new dormers and finial (the chimneys stay over their fireplaces)
  add({ id: 'roof.reroll', title: 'Re-roll the roof (new dormers and finial)', short: 'Re-roll', synonyms: ['reroll roof', 'dormer', 'dormers', 'finial', 'roof dice'], icon: 'dice-5', group: 'Roof', menu: true, cls: 'room', ring: { kinds: ['roof'], slot: 12 },
    when: (ctx) => !!roof(ctx) && !roof(ctx).locked, run: (ctx) => app.dispatch('room.set', { id: roof(ctx).room, roof: { seed: 1 + Math.floor(Math.random() * 1e6) } }) });
  add({ id: 'roof.hide', title: 'Hide roof (this room goes without one)', short: 'Hide roof', synonyms: ['remove roof', 'no roof', 'roof off', 'open top'], icon: 'eye-off', group: 'Roof', menu: true, cls: 'room',
    when: (ctx) => !!roof(ctx) && !roof(ctx).locked, run: (ctx) => { const r = roof(ctx); app.select([]); app.dispatch('room.set', { id: r.room, roof: { off: true } }); app.toast('Roof hidden. The command bar has "Show roof" (undo also brings it back)'); } });
  add({ id: 'room.roofShow', title: 'Show roof (this room has none)', short: 'Show roof', synonyms: ['roof', 'add roof', 'roof back', 'restore roof'], icon: 'house', group: 'Room', menu: true, cls: 'room',
    when: (ctx) => !!room(ctx) && !!room(ctx).roof?.off, run: (ctx) => app.dispatch('room.set', { id: room(ctx).id, roof: { off: false } }) });
  add({ id: 'room.delete', title: 'Delete room', icon: 'trash-2', group: 'Room', danger: true, cls: 'room', when: (ctx) => ctx.sel.length > 0 && ctx.sel.every(e => e.kind === 'room' || e.kind === 'building'), run: () => app.deleteSelection() });

  // ---------------- build (the Build launcher and menu: surfaces/build.js) ----------------
  add({ id: 'build.menu', title: 'Build…', synonyms: ['build', 'construct', 'place', 'furniture', 'rooms', 'buildings'], icon: 'hammer', keys: ['B'], group: 'Build', cls: (ctx) => ctx.app.can('room') || ctx.app.can('object') ? true : null, run: () => app.build.toggle() });
  add({ id: 'help.intro', title: 'Replay intro', synonyms: ['intro', 'tutorial', 'help', 'how do i build', 'show me'], icon: 'play', group: 'Help', cls: 'room', run: () => app.intro.run({ force: true }) });
  // THE LABS (2026-10-20): the Label lab and Ring Lab are the game with a drawer (?labellab=1, ?ringlab=1); the bar opens and leaves them
  const inLab = (k) => new URLSearchParams(location.search).get(k) === '1';
  const lab = (k) => { const u = new URL(location.href); if (inLab(k)) u.searchParams.delete(k); else u.searchParams.set(k, '1'); location.href = u.toString(); };
  add({ id: 'view.labelLab', title: () => inLab('labellab') ? 'Leave the Label lab' : 'Label lab: try the room labels\' size and place', short: 'Label lab', icon: 'tag', group: 'View', cls: 'room', run: () => lab('labellab') });
  add({ id: 'view.ringLab', title: () => inLab('ringlab') ? 'Leave Ring Lab' : 'Ring Lab: try the ring\'s shape and buttons', short: 'Ring Lab', icon: 'circle-dot', group: 'View', cls: (ctx) => ctx.gm ? true : null, run: () => lab('ringlab') });
  // L: room and building labels off / on in this browser (Harry 2026-10-20; pawn names are drawn in the 3D view and stay)
  add({ id: 'view.labels', title: () => app.labelsOn?.() ? 'Hide room labels' : 'Show room labels', synonyms: ['labels', 'names', 'room names', 'building names'], icon: 'tag', keys: ['L'], group: 'View', cls: 'room', run: () => app.setLabels(!app.labelsOn()) });
  add({ id: 'room.rename', title: 'Rename (label)', short: 'Rename', synonyms: ['name', 'label'], icon: 'pencil', keys: ['F2'], group: 'Room', menu: true, cls: 'room', when: (ctx) => ctx.one?.kind === 'room', run: (ctx) => app.startLabelRename(ctx.one.id) });

  // ---------------- areas, people, agents ----------------
  add({ id: 'area.new', title: 'New area…', synonyms: ['scene', 'map', 'new map'], icon: 'map', group: 'Areas', cls: 'area.admin', args: [{ name: 'name' }], parse: (text) => { const m = text.match(/^new area\s+(.+)/i); return m ? { name: m[1] } : null; }, chips: (a) => ['new area', a.name], run: (ctx, a) => { const id = app.createArea(a?.name || 'New area'); app.toast(`Created "${a?.name || 'New area'}" (hidden from players until you open it)`); return id; } });
  // (an area is open or hidden: "Open this area to players" / "Hide this area from players", travel and its lock are in surfaces/areas.js)
  add({ id: 'area.transfer', title: 'Send selection to another area…', synonyms: ['move to area', 'transfer'], icon: 'send', group: 'Areas', cls: 'transfer', when: (ctx) => ctx.sel.some(e => e.kind === 'token' || e.kind === 'object'), run: () => app.emit('bar.open', 'send to ') });
  add({ id: 'people.invite', title: 'Invite a player…', synonyms: ['add player', 'invite'], icon: 'user-plus', group: 'People', cls: 'seat.admin', parse: (text) => { const m = text.match(/^invite\s+(.+)/i); return m ? { name: m[1] } : null; }, chips: (a) => ['invite', a.name],
    run: async (ctx, a) => { const t = await app.createSeat({ kind: 'human', role: 'player', name: a?.name || 'Player', color: nextColor(app) }); if (t) app.emit('output', { title: `Invite link for ${a?.name || 'Player'}`, text: app.inviteLink(t) }); } });
  add({ id: 'people.agent', title: (ctx) => ctx.gm ? 'Create a GM assistant (LLM seat)…' : 'Create my advisor (LLM seat)…', synonyms: ['agent', 'assistant', 'llm', 'advisor', 'ai'], icon: 'bot', group: 'People', cls: 'seat.agent',
    run: async (ctx) => { const t = await app.createSeat({ kind: 'llm', name: ctx.gm ? 'Assistant' : 'Advisor', color: ctx.gm ? '#b48cff' : '#5ad0c0', scope: { areas: '*', classes: ctx.gm ? ['token.move', 'object', 'room', 'chat'] : ['token.move', 'chat'] } }); if (t) app.emit('output', { title: 'Paste this URL into any chat LLM', text: app.cardUrl(t) }); } });
  add({ id: 'people.undoOther', title: 'Undo their last action…', synonyms: ['undo player', 'undo agent'], icon: 'undo-2', group: 'Edit', cls: 'undo', when: (ctx) => ctx.gm, run: () => app.emit('bar.open', 'undo ') });

  // ================= THE BAR, BROUGHT UP TO DATE (2026-10-06) =================
  // Harry: "As a baseline, send an agent to sort of repopulate the command bar for the moment." Everything the game can
  // do today that had no command gets one here, found by its plain name and its obvious synonyms. The audit (what had a
  // command, what was added, what is left out and why) is the table in docs/UI.md, "The command bar, brought up to
  // date"; engine/test/browser_figs.py runs every command registered.

  // ---------------- pawns: figures (client/pawns.js, client/figures.js) ----------------
  // "add pawn ▸ a figure ▸ click a square". The figure list itself is searched by the bar (surfaces/bar.js): a
  // creature's own name is enough ("owlbear", "elf wizard", "6 goblins"); these entries are the way in by the verb.
  const figPawns = (ctx) => ctx.sel.filter(e => e.kind === 'token');
  const myPawns = (ctx) => figPawns(ctx).length > 0 && figPawns(ctx).length === ctx.sel.length && touchable(ctx);
  add({ id: 'pawn.add', title: 'Add pawn… (pick a figure, click a square)', short: 'Add pawn', synonyms: ['add pawn', 'place figure', 'add figure', 'figure', 'fig', 'mini', 'miniature', 'spawn', 'summon', 'creature', 'monster', 'npc', 'hero', 'token', 'new pawn', 'place pawn', 'drop pawn'], icon: 'user-plus', group: 'Pawns', cls: 'token.edit', hint: 'or just type its name: owlbear, elf wizard, 6 goblins', run: () => app.emit('bar.open', 'add pawn ') });
  add({ id: 'pawn.addPlain', title: 'Add a plain pawn (no figure)', short: 'Plain pawn', synonyms: ['plain pawn', 'blank pawn', 'stand-in', 'marker', 'token', 'peg'], icon: 'user-plus', group: 'Pawns', cls: 'token.edit', hint: 'click a square', run: () => app.pawnTool.start(null) });
  add({ id: 'pawn.figure', title: 'Change figure…', synonyms: ['change figure', 'swap figure', 'set figure', 'change mini', 'change model', 'wear', 'looks like', 'figure'], icon: 'replace', group: 'Pawns', cls: 'pawn', when: myPawns, run: () => app.emit('bar.open', 'change figure ') });
  add({ id: 'pawn.figureNone', title: 'Remove figure (back to the plain pawn)', short: 'No figure', synonyms: ['no figure', 'remove figure', 'plain pawn', 'stand-in'], icon: 'user', group: 'Pawns', cls: 'pawn', when: (ctx) => myPawns(ctx) && figPawns(ctx).some(p => p.fig), run: (ctx) => app.setFigure(figPawns(ctx), null) });
  add({ id: 'pawn.cond.clear', title: 'Clear all conditions', synonyms: ['no conditions', 'remove conditions', 'cure'], icon: 'badge-alert', group: 'Pawns', cls: 'pawn', when: (ctx) => myPawns(ctx) && figPawns(ctx).some(p => (p.conditions || []).length), run: (ctx) => app.batch(figPawns(ctx).map(p => ({ type: 'token.set', args: { id: p.id, conditions: [] } }))) });

  // A PLAYER'S MAIN PAWN (Harry 2026-10-06): it wears the highest-detail figure there is; one per seat (marking another
  // unmarks the first: core token.set main). A player marks her own; the GM marks anyone's.
  add({ id: 'pawn.main', toggle: { of: (ctx) => figPawns(ctx), is: (e) => !!e.main, on: ['Not my main pawn any more (normal detail)', 'star-off'], off: ['Make this my main pawn (full detail)', 'star'] }, synonyms: ['main pawn', 'my pawn', 'my character', 'main character', 'avatar', 'full detail', 'high detail', 'pc'], group: 'Pawns', cls: 'pawn', when: (ctx) => myPawns(ctx) && ctx.sel.length === 1, run: (ctx) => app.setMainPawn(ctx.one) });
  // THE NAME ON THE BASE or the floating label (client/figures.js NAME_ON_BASE; this browser)
  add({ id: 'view.pawnNames', toggle: { of: () => [1], is: () => app.figures.name().on, on: ['Pawn names: float over the figure (off the base)', 'tag'], off: ['Pawn names: on the base, round its edge', 'tag'] }, synonyms: ['pawn names', 'name on base', 'name bar', 'floating label', 'labels'], group: 'View', run: () => app.figures.setName({ on: !app.figures.name().on }) });
  add({ id: 'view.pawnNamesFace', toggle: { of: () => [1], is: () => app.figures.name().faceCamera, on: ['Pawn names: fixed to the base (turn with the pawn)', 'tag'], off: ['Pawn names: stay toward the camera', 'tag'] }, synonyms: ['pawn names', 'name on base', 'face camera', 'names turn'], group: 'View', when: () => app.figures.name().on, run: () => app.figures.setName({ faceCamera: !app.figures.name().faceCamera }) });

  // ---------------- levels and the view ----------------
  // typed: "level 2", "lv -1", "go to level 3": onto that level of the building in focus (the meter's notches)
  add({ id: 'level.goto', title: 'Go to level… (type: level 2)', short: 'Go to level', synonyms: ['go to level', 'floor', 'storey', 'lv', 'level'], icon: 'layers', group: 'View',
    parse: (text) => { const m = text.trim().match(/^(?:go\s*to\s+)?(?:level|lv|floor|storey)\s*(-?\d{1,2})$/i); return m && +m[1] !== 0 ? { n: +m[1] } : null; },
    chips: (a) => ['go to', `lv ${a.n}`], run: (ctx, a) => { if (!a) return app.emit('bar.open', 'level '); const I = app.levelInfo(), R = app.levelRange(); app.goLevel((R.base || 0) + (a.n > 0 ? a.n - 1 : a.n) * I.step, 'bar'); } });
  add({ id: 'view.turnLeft', title: 'Turn the view left (45°)', synonyms: ['rotate view', 'rotate camera', 'orbit left', 'spin view'], icon: 'rotate-ccw', group: 'View', hint: 'or hold Q', run: () => app.rotateView(null, -45, 0) });
  add({ id: 'view.turnRight', title: 'Turn the view right (45°)', synonyms: ['rotate view', 'rotate camera', 'orbit right', 'spin view'], icon: 'rotate-cw', group: 'View', hint: 'or hold E', run: () => app.rotateView(null, 45, 0) });
  add({ id: 'view.pipOpen', title: 'Open picture-in-picture (this area)', synonyms: ['pip', 'second view', 'picture in picture', 'mini view', 'inset'], icon: 'picture-in-picture-2', group: 'View', when: () => !app.pip, run: () => app.openPip(app.area()) });

  // ---------------- whole buildings (the Build tray's Type level: the building tool) ----------------
  for (const n of app.taxonomy?.nodes?.values?.() || []) if (n.level === 'type' && !n.disabled) add({ id: `build.type.${n.id}`, title: `Build a whole ${n.label.toLowerCase()} (drag a rectangle: it is packed with rooms)`, short: n.label, synonyms: [n.label, `${n.label} building`, 'building', 'whole building', 'build'], icon: 'house', group: 'Build', cls: 'room', hint: 'drag a rectangle', run: () => app.modes.buildingTool(n) });

  // ---------------- this area's play settings (Settings ▸ Area), as commands ----------------
  const rule = (k) => app.areaRule?.(k);
  const setRule = (k, v) => app.sync.submit('area.set', { area: app.area(), settings: { [k]: v } });
  for (const [v, label, syn] of [['house', 'the house look', ['default light']], ['day', 'day', ['daytime', 'morning']], ['night', 'night', ['dark', 'torchlight', 'evening', 'dusk']], ['deep-night', 'deep night', ['midnight', 'pitch dark']], ['daylight', 'flat daylight', ['bright', 'work light', 'no shadows']]])
    add({ id: `area.light.${v}`, title: `Lighting here: ${label}`, synonyms: ['lighting', 'light', 'time of day', v, ...syn], icon: v === 'night' || v === 'deep-night' ? 'flame' : 'sun', group: 'Area', cls: 'area.admin', when: () => (rule('light') || 'house') !== v, run: () => setRule('light', v) });
  add({ id: 'area.grid', toggle: { of: () => [1], is: () => rule('grid') !== false, on: ['Hide the grid (this area)', 'layout-grid'], off: ['Show the grid (this area)', 'layout-grid'] }, synonyms: ['grid', 'squares', 'grid lines'], group: 'Area', cls: 'area.admin', run: () => setRule('grid', rule('grid') === false) });
  add({ id: 'area.freeMoves', toggle: { of: () => [1], is: () => rule('freeMoves') !== false, on: ['Lock players\' moves (this area)', 'lock'], off: ['Let players move their pawns (this area)', 'lock-open'] }, synonyms: ['free moves', 'lock moves', 'freeze players', 'players move'], group: 'Area', cls: 'area.admin', run: () => setRule('freeMoves', rule('freeMoves') === false) });
  add({ id: 'area.touch', toggle: { of: () => [1], is: () => rule('touch') !== 'none', on: ['Players may touch nothing (doors, chests, lights)', 'lock'], off: ['Players may open doors, chests and lights', 'lock-open'] }, synonyms: ['players touch', 'lock doors', 'players open'], group: 'Area', cls: 'area.admin', run: () => setRule('touch', rule('touch') === 'none' ? 'open' : 'none') });
  // Fog of war here (Harry 2026-10-15): this area's own On / Off, or the campaign default (Settings ▸ Global defaults ▸ Vision)
  const ownFog = () => app.sync.campaign?.areas.find(x => x.id === app.area())?.settings?.fogOfWar;
  for (const [id, v, title, syn] of [['on', true, 'Fog of war on here', ['fog', 'fog on', 'vision on', 'turn on fog here']], ['off', false, 'Fog of war off here', ['fog', 'fog off', 'vision off', 'no fog here', 'turn off fog here']], ['default', null, 'Fog of war: campaign default here', ['fog', 'fog default', 'vision', 'inherit fog', 'default here']]])
    add({ id: `area.fogOfWar.${id}`, title, synonyms: ['fog of war', 'vision fog', ...syn], icon: 'eye', group: 'Area', cls: 'area.admin', when: () => v === null ? typeof ownFog() === 'boolean' : ownFog() !== v, run: () => setRule('fogOfWar', v) });
  // Darkness here (Harry 2026-10-20; core/darkness.js): this area's own On / Off, or the campaign default. Only with fog of war.
  const ownDark = () => app.sync.campaign?.areas.find(x => x.id === app.area())?.settings?.darkness;
  for (const [id, v, title, syn] of [['on', true, 'Darkness on here (players see by darkvision and lights)', ['darkness on', 'dark', 'darkvision', 'turn on darkness', 'lights out']], ['off', false, 'Darkness off here', ['darkness off', 'no darkness', 'lit area', 'turn off darkness']], ['default', null, 'Darkness: campaign default here', ['darkness default', 'inherit darkness']]])
    add({ id: `area.darkness.${id}`, title, synonyms: ['darkness', 'dark', ...syn], icon: 'moon', group: 'Area', cls: 'area.admin', when: () => v === null ? typeof ownDark() === 'boolean' : ownDark() !== v, run: () => setRule('darkness', v) });
  add({ id: 'area.rename', title: 'Rename this area… (type: rename area Cellar)', short: 'Rename area', synonyms: ['rename area', 'area name', 'rename map'], icon: 'pencil', group: 'Areas', cls: 'area.admin',
    parse: (text) => { const m = text.match(/^rename area\s+(?:to\s+)?(.+)/i); return m ? { name: m[1].trim().slice(0, 60) } : null; }, chips: (a) => ['rename area', a.name], run: (ctx, a) => a?.name ? app.sync.submit('area.set', { area: app.area(), name: a.name }) : app.emit('bar.open', 'rename area ') });

  // ---------------- Settings: its sections, and the switches in Me (this browser) ----------------
  for (const [sec, label, syn, gm] of [['nav', 'World navigation', ['areas', 'maps', 'world'], false], ['me', 'Me', ['my settings', 'preferences', 'controls', 'graphics', 'name', 'colour', 'color'], false], ['area', 'Area settings', ['area', 'play rules', 'lighting'], true], ['defaults', 'Global defaults', ['campaign defaults', 'house rules'], true], ['admin', 'Campaign admin', ['snapshots', 'save', 'export', 'import', 'invites', 'seats', 'backup'], true]])
    add({ id: `settings.${sec}`, title: `Settings: ${label}`, synonyms: ['settings', label, ...syn], icon: 'layout-grid', group: 'Settings', cls: gm ? (ctx) => ctx.gm ? true : null : null, run: () => app.settings.show(sec) });
  // FEEDBACK (Harry 2026-10-19): Settings ▸ Feedback, opened pre-set; "comment on this asset" for the selected thing or pawn
  add({ id: 'settings.feedback', title: 'Feedback…', short: 'Feedback', synonyms: ['feedback', 'settings', 'ticket', 'tickets', 'my tickets', 'send feedback', 'report', 'comment', 'suggestion'], icon: 'message-square', group: 'Settings', run: () => app.feedback?.open({}) });
  add({ id: 'feedback.bug', title: 'Report a bug…', short: 'Report a bug', synonyms: ['bug', 'report a bug', 'bug report', 'broken', 'problem', 'glitch', 'crash', 'error'], icon: 'bug', group: 'Settings', run: () => app.feedback?.open({ kind: 'bug' }) });
  add({ id: 'feedback.idea', title: 'Idea or feature request…', short: 'Idea', synonyms: ['idea', 'feature request', 'feature', 'suggest', 'suggestion', 'wish', 'request'], icon: 'lightbulb', group: 'Settings', run: () => app.feedback?.open({ kind: 'idea' }) });
  add({ id: 'feedback.asset', title: 'Comment on this asset…', short: 'Comment on asset', synonyms: ['comment on this asset', 'asset comment', 'comment on this', 'this model', 'model looks wrong', 'asset feedback', 'report asset'], icon: 'box', group: 'Settings',
    when: (ctx) => ctx.sel.some(e => e.kind === 'object' || e.kind === 'token'), run: () => app.feedback?.open({ kind: 'asset' }) });
  add({ id: 'vision.reset', title: 'Reset fog', synonyms: ['forget explored', 'reset fog of war'], icon: 'undo-2', group: 'Settings', cls: ctx => ctx.gm ? true : null, run: () => app.fog.reset() });
  add({ id: 'vision.reveal', title: 'Reveal explored here', synonyms: ['explore room', 'reveal explored room', 'explore area'], icon: 'eye', group: 'Settings', cls: ctx => ctx.gm ? true : null, run: () => app.fog.revealHere() });
  // Shared vision is campaign-wide; fog of war's campaign default is set here (an area can override it: "fog of war off here");
  // view-as changes only the GM's own picture.
  for (const [key, label, words] of [['fogOfWar', 'Fog of war (campaign default)', ['fog of war', 'vision fog', 'fog default']], ['sharedPartyVision', 'Shared party vision', ['shared party vision', 'shared vision']]]) {
    for (const value of [true, false]) add({ id: `vision.${key}.${value ? 'on' : 'off'}`, title: `${label}: ${value ? 'on' : 'off'}`, synonyms: words, icon: 'eye', group: 'Settings', cls: ctx => ctx.gm ? true : null,
      when: () => (app.sync.campaign?.defaults?.[key] === true) !== value,
      run: () => app.sync.submit('campaign.set', { defaults: { [key]: value } }) });
  }
  for (const [viewer, name] of [['gm', 'GM'], ['party', 'party']]) add({ id: `vision.view.${viewer}`, title: `View as ${name}`, synonyms: ['view as', 'vision', name], icon: 'eye', group: 'View', cls: ctx => ctx.gm ? true : null, run: () => app.setVisionViewer(viewer) });
  const addVisionSeats = () => {
    for (const seat of app.sync?.campaign?.seats || []) {
      const id = `vision.view.seat.${seat.id}`;
      if (seat.kind !== 'human' || seat.role !== 'player' || R.get(id)) continue;
      add({ id, title: () => `View as ${app.sync.campaign?.seats.find(s => s.id === seat.id)?.name || seat.name}`, synonyms: ['view as', 'vision', seat.name], icon: 'eye', group: 'View', cls: ctx => ctx.gm ? true : null,
        when: () => !!app.sync.campaign?.seats.some(s => s.id === seat.id && s.role === 'player'), run: () => app.setVisionViewer(seat.id) });
    }
  };
  app.on?.(what => { if (what === 'refresh') addVisionSeats(); });
  addVisionSeats();
  add({ id: 'vision.view.player', title: 'View as player…', synonyms: ['view as player', 'vision'], icon: 'eye', group: 'View', cls: ctx => ctx.gm ? true : null,
    parse: text => {
      const m = text.trim().match(/^view as\s+(.+)$/i); if (!m) return null;
      const name = m[1].toLowerCase(), seat = (app.sync.campaign?.seats || []).find(s => s.role === 'player' && s.kind === 'human' && (s.name.toLowerCase() === name || s.id.toLowerCase() === name));
      return seat ? { viewer: seat.id, name: seat.name } : null;
    }, chips: a => ['view as', a.name], run: (ctx, a) => { if (a?.viewer) app.setVisionViewer(a.viewer); else app.toast('Type view as followed by a player name'); } });
  const pref = (k) => app.settings?.prefs()[k];
  for (const [k, on, off, syn] of [['reducedMotion', 'Reduce motion: off', 'Reduce motion: on', ['animations', 'motion', 'accessibility']], ['cutFly', 'Levels fly away: off (they just vanish)', 'Levels fly away: on', ['fly away', 'level animation']], ['libEven', 'Library: show true relative sizes', 'Library: show everything the same size', ['library', 'library size', 'same size', 'relative size', 'true size', 'thumbnails', 'object size']], ['fogFx', 'Fog and mist: off (fog of war stays)', 'Fog and mist: on', ['fog', 'fog off', 'fog on', 'mist', 'haze', 'atmosphere', 'no fog', 'hide fog']], ['cursors', "Hide other people's cursors", "Show other people's cursors", ['cursors', 'pointers']], ['announce', 'Announcements: off (says and rolls go straight to the chat)', 'Announcements: on', ['announce', 'big box', 'say box']]])
    add({ id: `pref.${k}`, toggle: { of: () => [1], is: () => !!pref(k), on: [on, 'layout-grid'], off: [off, 'layout-grid'] }, synonyms: syn, group: 'Settings', run: () => app.settings.setPref(k, !pref(k)) });
  // pawns and the squares (Harry 2026-10-11, unsure: a switch so both can be played): 'shift' = free, Shift snaps (the default); 'always' = snaps, Shift frees
  for (const [v, label] of [['shift', 'only with Shift (they move freely)'], ['always', 'always (Shift = free)']]) add({ id: `pref.pawnSnap.${v}`, title: `Pawns snap to squares: ${label}`, synonyms: ['snap', 'grid', 'squares', 'pawn snap', 'snap to grid', 'free movement'], icon: 'grid-3x3', group: 'Settings', when: () => (pref('pawnSnap') || 'shift') !== v, run: () => { app.settings.setPref('pawnSnap', v); app.toast(`Pawns snap to squares: ${label}`); } });
  for (const [v, label] of [['auto', 'auto (a wheel zooms, a trackpad pans)'], ['zoom', 'always zoom'], ['pan', 'always pan']]) add({ id: `pref.wheel.${v}`, title: `Scroll wheel: ${label}`, synonyms: ['scroll wheel', 'mouse wheel', 'wheel', 'trackpad', 'magic mouse'], icon: 'move-vertical', group: 'Settings', when: () => (pref('wheel') || 'auto') !== v, run: () => app.settings.setPref('wheel', v) });
  // Me ▸ Graphics (graphics.js): the preset, each switch, the render resolution, the frame-rate limit, the idle rate
  // Broad performance searches offer the presets and FPS meter; individual knobs have their own names.
  // Repeating this alias on every knob filled the capped bar before the meter could appear.
  const GSYN = ['graphics', 'quality', 'gpu', 'hot', 'fan', 'heat', 'battery', 'slow', 'fast'];
  for (const [v, label] of [['auto', 'auto (measure this machine)'], ['low', 'low'], ['medium', 'medium'], ['high', 'high (the full look)']]) add({ id: `pref.gfx.${v}`, title: `Graphics quality: ${label}`, synonyms: [...GSYN, 'performance', 'preset', v], icon: 'sun', group: 'Settings', when: () => (pref('gfx') || 'auto') !== v, run: () => { app.settings.setGfx(v); app.toast(`Graphics quality: ${v}`); } });
  for (const [k, on, off, syn] of [['shadowsFx', 'Shadows from fires: off', 'Shadows from fires: on', ['shadows', 'fire shadows', 'light shadows']], ['contactFx', 'Contact shadows: off', 'Contact shadows: on', ['contact shadows', 'ambient occlusion', 'ao']], ['softHalf', 'Soft effects: full resolution', 'Soft effects: half resolution', ['half resolution', 'soft effects', 'fog resolution']], ['waterFx', 'Water effects: off (plain water)', 'Water effects: on', ['water', 'ripples', 'reflections']], ['fireFx', 'Fire flicker and sparks: off (steady fires)', 'Fire flicker and sparks: on', ['fire', 'flicker', 'embers', 'sparks', 'smoke']], ['post', 'Lighting effects: off', 'Lighting effects: on', ['lighting effects', 'post', 'bloom']], ['lightMoves', 'Lighter picture while moving: off', 'Lighter picture while moving: on', ['while moving', 'governor']]])
    add({ id: `pref.${k}`, toggle: { of: () => [1], is: () => pref(k) !== false && !!pref(k), on: [on, 'sun'], off: [off, 'sun'] }, synonyms: [...syn, ...GSYN], group: 'Settings', run: () => app.settings.setPref(k, !pref(k)) });
  add({ id: 'pref.farGlow', toggle: { of: () => [1], is: () => !!app.gfx?.farGlow?.(), on: ['Glow under far fires: off', 'sun'], off: ['Glow under far fires: on', 'sun'] }, synonyms: ['glow', 'far fires', 'painted glow', 'floor glow', 'fire glow', ...GSYN], group: 'Settings', run: () => app.settings.setPref('farGlow', !app.gfx?.farGlow?.()) });
  for (const [v, label] of [['all', 'every flame'], ['16', 'the nearest 16'], ['8', 'the nearest 8'], ['4', 'the nearest 4'], ['none', 'none']]) add({ id: `pref.lights.${v}`, title: `Real lights from fires: ${label}`, synonyms: ['lights', 'fire light', 'dynamic lights', 'candle light', 'lamps', 'light pool', 'light slots', ...GSYN], icon: 'sun', group: 'Settings', when: () => String(pref('lights') || 'all') !== v, run: () => app.settings.setPref('lights', v) });
  for (const [v, label] of [['native', "native (the screen's own)"], ['1.5', '1.5×'], ['1', '1× (fewest pixels)']]) add({ id: `pref.density.${v}`, title: `Render resolution: ${label}`, synonyms: ['render resolution', 'resolution', 'pixel density', 'retina', 'pixels', 'dpr', ...GSYN], icon: 'sun', group: 'Settings', when: () => String(pref('density') || 'native') !== v, run: () => app.settings.setPref('density', v) });
  for (const [v, label] of [[0, "the display's own rate"], [60, '60 a second'], [30, '30 a second']]) add({ id: `pref.maxFps.${v}`, title: `Frame rate limit: ${label}`, synonyms: ['frame rate', 'fps limit', 'fps cap', 'limit', '120 hz', ...GSYN], icon: 'sun', group: 'Settings', when: () => (+(pref('maxFps') ?? 60) || 0) !== v, run: () => app.settings.setPref('maxFps', v) });
  for (const [v, label] of [[0, 'off (always full rate)'], [30, '30 a second'], [20, '20 a second'], [10, '10 a second']]) add({ id: `pref.idleFps.${v}`, title: `When nothing is happening, draw: ${label}`, synonyms: ['idle', 'idle rate', 'idle throttle', 'throttle', 'still picture', 'power saving', ...GSYN], icon: 'sun', group: 'Settings', when: () => (+(pref('idleFps') ?? 20) || 0) !== v, run: () => app.settings.setPref('idleFps', v) });
  for (const [v, label] of [['low', 'low (1,500 faces)'], ['medium', 'medium (5,000)'], ['high', 'high (10,000)']]) add({ id: `pref.graphics.${v}`, title: `Geometry detail: ${label}`, synonyms: ['geometry', 'detail', 'faces', 'triangles', 'mesh detail', ...GSYN], icon: 'sun', group: 'Settings', when: () => pref('graphics') !== v, run: () => app.settings.setPref('graphics', v) });
  add({ id: 'pref.reset', title: 'Reset my settings to the defaults', synonyms: ['reset settings', 'defaults', 'factory'], icon: 'undo-2', group: 'Settings', hidden: true, run: () => { app.settings.resetPrefs(); app.toast('Your settings are back to the defaults'); } });
}

const COLORS = ['#e5734f', '#5aa9e6', '#7cc47a', '#e6b450', '#d47fd0', '#4fc1b5', '#f08aa0', '#9cb36a'];
function nextColor(app) { const used = new Set((app.sync.campaign?.seats || []).map(s => s.color)); return COLORS.find(c => !used.has(c)) || COLORS[0]; }

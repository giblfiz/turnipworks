// Copy/paste: relative layout around the selection's centre, pasted at the cursor, across areas and campaigns.
// The clipboard text is plain: a human line, then one "TW1:<base64url JSON>" token. Pasting finds the token anywhere
// in the text, so a selection survives a trip through Discord, an email or a text box (whitespace and all).
//
// THE LEVEL A PASTE LANDS ON (2026-11-25, Harry on dev: "Those mimics got pasted, but not onto the level that I was acting
// on"). A paste at the pointer lands where a fresh placement from the tray would at that spot: on the floor under the
// pointer at the level in view (app.cursor.y, input.js groundOf: the cut's level, a cellar, a cave, an upper storey), and
// then settles like any placement (main.js pawnLandY). Each pawn or thing carries `lift`, its height above what it stood
// on when copied: a standing pawn 0, a raised or flying one its height, a thing its height above its floor; so a flying
// pawn stays that far above the floor it is pasted onto. Until then the paste sent no height and everything landed on
// the ground (y 0): a mimic copied in the Dragon Temple's vault (lv -2) went into the forge above it, where the cut hid
// it and the selection dropped it, so nothing seemed to happen. A ROOM lands on the level you are on (app.level), the
// level the room tool draws on. A paste with no pointer over the table keeps the heights it was copied at.
import * as HT from '../core/height.js';
const CELL = 5;
const r2 = (v) => Math.round(v * 100) / 100;

export function clipFrom(app, things) {
  const ents = things.filter(e => e && e.kind !== 'wall');
  const rooms = new Set(ents.filter(e => e.kind === 'room').map(e => e.id));
  for (const b of ents.filter(e => e.kind === 'building')) for (const r of app.childrenOf(b)) rooms.add(r.id);
  const E = app.entities();
  const items = [];
  // an object travels with its room when its room travels; things resting on a copied object travel with it
  const take = new Map();
  for (const id of rooms) take.set(id, E[id]);
  for (const e of ents) if ((e.kind === 'object' && !rooms.has(e.room)) || e.kind === 'token') { take.set(e.id, e); for (const d of app.descendants(e)) take.set(d.id, d); }
  const pts = [...take.values()].map(e => e.kind === 'room' ? [(e.recipe.x + e.recipe.w / 2) * CELL, (e.recipe.z + e.recipe.d / 2) * CELL] : [e.x, e.z]);
  if (!pts.length) return null;
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  for (const e of take.values()) {
    if (e.kind === 'room') {
      const objects = Object.values(E).filter(o => o.kind === 'object' && o.room === e.id).map(({ noteOff, ...o }) => o); // (a copy of a stair shows its own warning: a dismissal belongs to the stair it was made on, core/stairs.js)
      items.push({ kind: 'room', e: { id: e.id, recipe: e.recipe }, dx: (e.recipe.x + e.recipe.w / 2) * CELL - cx, dz: (e.recipe.z + e.recipe.d / 2) * CELL - cz, objects });
    } else items.push({ kind: e.kind, e: { ...e }, dx: e.x - cx, dz: e.z - cz, lift: liftOf(app, E, e) });
  }
  return { v: 1, items };
}

// how far above what it stands on a pawn or thing was copied (feet): a standing pawn 0 (it lands on what is at the new
// spot), a raised or flying pawn its height over its base, a thing its height over its floor (a lamp on a wall, a cup on
// a table copied with it)
function liftOf(app, E, e) {
  if (e.kind === 'token') { if (app.pawnStands ? app.pawnStands(e) : true) return 0; return r2(Math.max(0, app.pawnDropAt(e, e.x, e.y || 0, e.z).drop)); }
  const fy = HT.floorUnder(E, e.x, e.z, e.y || 0)?.y ?? Math.min(0, e.y || 0);
  return r2(Math.max(0, (e.y || 0) - fy));
}

// the middle of what was copied, where it was (a paste with no pointer over the table lands next to it)
export function clipOrigin(clip) {
  const it = clip?.items?.[0]; if (!it) return null;
  if (it.kind === 'room') { const r = it.e.recipe; return [(r.x + r.w / 2) * CELL - it.dx, (r.z + r.d / 2) * CELL - it.dz]; }
  return Number.isFinite(it.e.x) && Number.isFinite(it.e.z) ? [it.e.x - it.dx, it.e.z - it.dz] : null;
}

// THE HEIGHT A PASTED PAWN OR THING IS SENT AT. floorY: the floor the paste lands on (the pointer's, see above), or null
// to keep the height it was copied at. A clip from before `lift` (text from an older build) lands on that floor.
export function pasteY(it, floorY) {
  if (floorY == null || !Number.isFinite(floorY)) return r2(it.e.y || 0);
  return r2(floorY + (Number.isFinite(it.lift) ? it.lift : 0));
}

// NO EXACT STACKING (2026-11-25): a paste whose pawns or things would land on top of the same kind of thing already there
// (the original, or the last paste at the same pointer) moves to the nearest square (5 ft steps, ring by ring, nearest
// first, as a group of pawns is placed: pawns.js pawnFormation) where nothing of its kind stands AND each lands on the
// same floor, in the same room, as it would at the pointer (never out of a cellar into the rock, off a hilltop, into the
// room below or out through a wall onto the open ground).
// spots([dx, dz]) -> [{ kind, cat, x, y, z, y0, room, room0 }] for the paste moved by that much (y0, room0: where it
// lands at the pointer); free(spot) -> nothing of its kind there.
// -> the [dx, dz] to move by ([0, 0] when nothing is in the way, or when there is nowhere better within PASTE_RINGS)
export const PASTE_STEP = CELL, PASTE_RINGS = 4;
export function pasteOffsets(rings = PASTE_RINGS) {
  const out = [[0, 0]];
  for (let r = 1; r <= rings; r++) {
    const ring = [];
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) if (Math.max(Math.abs(i), Math.abs(j)) === r) ring.push([i, j]);
    ring.sort((a, b) => (a[0] ** 2 + a[1] ** 2) - (b[0] ** 2 + b[1] ** 2) || Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    out.push(...ring);
  }
  return out.map(([i, j]) => [i * PASTE_STEP, j * PASTE_STEP]);
}
export function pasteStep(spots, free, rings = PASTE_RINGS) {
  for (const off of pasteOffsets(rings)) if (spots(off).every(s => free(s) && Math.abs(s.y - s.y0) < 0.5 && (s.room0 === undefined || s.room === s.room0))) return off;
  return [0, 0];
}

export function copyText(clip) {
  const n = clip.items.length;
  const json = JSON.stringify(clip);
  const bytes = new TextEncoder().encode(json); let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192)); // big selections: chunked
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `Turnip Works: ${n} thing${n === 1 ? '' : 's'} (paste into a Turnip Works area)\nTW1:${b64}`;
}

export function parseClip(text) {
  const t = String(text || ''), at = t.indexOf('TW1:');
  if (at < 0) return null;
  // a chat app may wrap the token across lines: try it with whitespace removed, then as written
  const joined = t.slice(at + 4).replace(/\s+/g, '').match(/^[A-Za-z0-9_-]+/)?.[0];
  const plain = t.slice(at + 4).trim().match(/^[A-Za-z0-9_-]+/)?.[0];
  for (const tok of [joined, plain]) {
    if (!tok) continue;
    try {
      const b = atob(tok.replace(/-/g, '+').replace(/_/g, '/'));
      const clip = JSON.parse(new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))));
      if (clip?.v === 1 && Array.isArray(clip.items)) return clip;
    } catch { /* try the next reading */ }
  }
  return null;
}

// Copy/paste: relative layout around the selection's centre, pasted at the cursor, across areas and campaigns.
// The clipboard text is plain: a human line, then one "TW1:<base64url JSON>" token. Pasting finds the token anywhere
// in the text, so a selection survives a trip through Discord, an email or a text box (whitespace and all).
const CELL = 5;

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
      const objects = Object.values(E).filter(o => o.kind === 'object' && o.room === e.id).map(o => ({ ...o }));
      items.push({ kind: 'room', e: { id: e.id, recipe: e.recipe }, dx: (e.recipe.x + e.recipe.w / 2) * CELL - cx, dz: (e.recipe.z + e.recipe.d / 2) * CELL - cz, objects });
    } else items.push({ kind: e.kind, e: { ...e }, dx: e.x - cx, dz: e.z - cz });
  }
  return { v: 1, items };
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

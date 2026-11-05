// LINKS FROM THE ASSETS PAGE (2026-11-04, turnipworks.net/assets; Harry: "an assets page that demos all of the assets and
// asset packs and deep links to them"). The page's "Use it in Turnip Works" buttons open the game with one of:
//   ?place=<thing>          the thing ready to put down: its ghost follows the pointer, a click puts it down (Esc: no)
//   ?pawn=<figure>          the Add pawn tool with that figure: a click on a square puts the pawn down
//   ?pack=<TYPE>            the Build menu open at that type (its building tool: drag a footprint)
//   ?pack=<TYPE>/<room>     ... at that room (its room tool, and its library in the picture-in-picture)
// (TYPE: the Build menu's type code, TAV, CRY ..., or its slug, tavern-inn; room: the room key, common, crypt-vault ...)
// HARMLESS FOR PLAYERS: it acts only for the GM's seat, and it only arms a tool: nothing is put down, built or changed
// without the GM's own click. A player's seat gets a toast and nothing else. The address is cleaned as soon as the link
// is read, so a reload or an invite link copied afterwards does not carry it (app.inviteLink copies location.search).
// A visitor with no table yet starts one from the start card as usual; the page reloads into the new table with the
// address it had, and the link acts there (the new table's GM). The first-visit intro waits for another visit.
export const DEEP_KEYS = ['place', 'pawn', 'pack'];

// -> { kind, value } of the first deep-link key in a query string, or null
export function readDeepLink(search) {
  const q = new URLSearchParams(search);
  for (const k of DEEP_KEYS) { const v = (q.get(k) || '').trim(); if (v) return { kind: k, value: v.slice(0, 120) }; }
  return null;
}
// the same address without any deep-link key
export function withoutDeepLink(loc) {
  const q = new URLSearchParams(loc.search); for (const k of DEEP_KEYS) q.delete(k);
  return `${loc.pathname}${q.toString() ? '?' + q : ''}${loc.hash}`;
}
// the Build menu node a ?pack= value names, or null (pure: the node test runs it on the real taxonomy)
export function packNode(taxonomy, types, value) {
  const [t, room] = String(value).split('/');
  const w = (t || '').toLowerCase(), type = (types || []).find(x => x.code.toLowerCase() === w || x.slug === w);
  const tn = type && taxonomy.get(`t:${type.code}`); if (!tn || tn.disabled) return null;
  if (!room) return tn;
  return taxonomy.get(`r:${type.code}:${room}`) || null;
}

// act on the link once the table is ready (app.ready(), the loading screen gone)
export function installDeepLink(app, { link, loaded, types, patience = 120000 }) {
  if (!link) return;
  history.replaceState(history.state, '', withoutDeepLink(location));
  const t0 = performance.now();
  // the GM's tool is armed once the loading screen has gone (not under it); a player's seat gets no tool, so its answer is
  // settled as soon as the table is there, and its note waits for the screen
  const say = (r) => { const t1 = performance.now(); const show = () => loaded() ? r.msg && app.toast(r.msg, !r.ok) : performance.now() - t1 < patience && setTimeout(show, 400); show(); };
  const go = () => {
    if (!(app.ready() && app.main && app.area() && (loaded() || !app.gm()))) return performance.now() - t0 < patience && setTimeout(go, 400);
    const r = act(app, link, types);
    app.deepLinked = { ...link, ...r };
    say(r);
  };
  go();
}

export function act(app, { kind, value }, types) {
  if (!app.gm()) return { ok: false, msg: 'Links from the assets page work for the GM: open it at a table you run' };
  if (kind === 'place') {
    const cat = app.assets.catById.get(value);
    if (!cat) return { ok: false, msg: `No "${value}" to place in this version of the game` };
    app.modes.place(cat);
    if (app.mode?.kind !== 'place') return { ok: false, msg: `${cap(cat.name)} cannot be placed here` };
    return { ok: true, msg: `${cap(cat.name)}: click where it goes (Esc to put it away)` };
  }
  if (kind === 'pawn') {
    const fig = app.figures?.get(value);
    if (!fig) return { ok: false, msg: `No figure "${value}" in this version of the game` };
    if (app.pawnTool.start(fig) === false) return { ok: false, msg: null }; // (it says why itself)
    return { ok: true, msg: `${fig.name}: click a square to put the pawn down (Esc to put it away)` };
  }
  if (kind === 'pack') {
    const n = packNode(app.taxonomy, types, value);
    if (!n) return { ok: false, msg: `No "${value}" in the Build menu of this version of the game` };
    app.build.restore(app.taxonomy.pathOf(n.id)); app.build.open();
    return { ok: true, msg: n.level === 'room' ? `${n.label}: drag on the ground to draw it, or take things from its library` : `${n.label}: drag a footprint to build one` };
  }
  return { ok: false, msg: null };
}
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

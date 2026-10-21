// PAWNS FROM THE COMMAND BAR (Harry 2026-10-06: "I also would love to place some figs in here now and play with them.
// As a baseline ... repopulate the command bar for the moment"). The Pawns menu is not designed yet; until it is, the
// bar is how a figure gets onto the table. Everything here ends in the one door (token.create / token.set), so undo,
// the relay, other seats and AI seats all get it.
//   the pawn tool   "add pawn ▸ a figure ▸ click a square": a ghost of the figure on its base rides the pointer, snapped
//                   to the square it would stand in (a large creature: to the four squares it covers); R turns it;
//                   a click places; Shift+click keeps placing; Esc puts the tool away.
//   a count         "6 goblins": ONE click drops the whole group round the clicked square (the nearest free squares, in
//                   the same room when they fit), as one command (one undo), labelled Goblin 1 … Goblin 6. The count
//                   carries on from the highest number already on the table.
//   change figure   a selected pawn (or several) takes another figure, or goes back to the plain stand-in.
import * as THREE from 'three';
import { installPicks } from './picks.js';
import { newId } from '../core/ids.js';

const CELL = 5, MAX_GROUP = 30;
const r2 = (v) => Math.round(v * 100) / 100;
// where a pawn stands: a 1-square pawn on a square's centre, a 2-square one where four squares meet (and so on)
export const pawnPoint = (v, size = 1) => size % 2 ? (Math.floor(v / CELL) + 0.5) * CELL : Math.round(v / CELL) * CELL;
export const pawnCells = (x, z, size = 1) => { const out = [], x0 = Math.round((x - size * CELL / 2) / CELL), z0 = Math.round((z - size * CELL / 2) / CELL); for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) out.push([x0 + i, z0 + j]); return out; };

// a pawn's label from its figure: the name up to its first comma or bracket ("Goblin, spear" -> "Goblin";
// "Elf wizard (woman)" -> "Elf wizard"), so a group reads Goblin 1, Goblin 2 …
export const pawnLabel = (f) => f ? (f.name.split(/[,(]/)[0].trim() || f.name) : 'Pawn';
export function installPawns(app) {
  installPicks(app);
  const F = app.assets.figures;
  // THE RIM'S COLOUR: the owner seat's colour; nobody's pawn (the GM's to move) wears its own colour, which the bar sets
  // to the colour of the seat that placed it
  app.assets.pawnColor = (e) => (e.owner && app.sync.campaign?.seats.some(s => s.id === e.owner)) ? app.seatColor(e.owner) : (e.color || '#d9a441');
  // this area's play setting as it is in force: its own value, else the campaign's default, else the built-in (the
  // command bar's Area entries read it; Settings ▸ Area shows the same)
  const BUILTIN = { light: 'house', grid: true, freeMoves: true, touch: 'open', fog: false, fogOfWar: false, darkness: false, music: '' };
  app.areaRule = (k) => { const c = app.sync.campaign, a = c?.areas.find(x => x.id === app.area()); return a?.settings && k in a.settings ? a.settings[k] : c?.defaults && k in c.defaults ? c.defaults[k] : BUILTIN[k]; };
  // the name on the base (client/figures.js NAME_ON_BASE): a change of its parameters reletters every pawn on the table
  F.nameStamp = 1; F.onName(() => { F.nameStamp++; for (const w of app.worlds.values()) w.refreshPawnNames?.(); });
  // A PLAYER'S MAIN PAWN (token.main): one per seat; it wears the original, full-detail mesh
  app.setMainPawn = (p, on = !p.main) => app.dispatch('token.set', { id: p.id, main: !!on });
  const sizeLabel = document.getElementById('modeLabel');
  const tokens = () => Object.values(app.entities()).filter(e => e.kind === 'token');
  const sizeOf = (e) => F.sizeOf(e);

  // the squares taken by pawns standing on this floor (within half a storey of y)
  function taken(y, except = null) {
    const out = new Set();
    for (const t of tokens()) if (!except?.has(t.id) && Math.abs((t.y || 0) - y) < 5) for (const [gx, gz] of pawnCells(t.x, t.z, sizeOf(t))) out.add(`${gx}:${gz}`);
    return out;
  }
  // where a group of n would stand round a clicked point: the lead on the clicked square(s), the rest on the nearest
  // free squares (ring by ring, nearest first), kept in the lead's room when they fit there
  app.pawnFormation = (x, z, { size = 1, n = 1, y = 0, free = false } = {}) => {
    const lx = pawnPoint(x, size), lz = pawnPoint(z, size), step = size * CELL, busy = taken(y), room = app.roomAt(lx, lz, y)?.id || null;
    const isFree = (px, pz) => pawnCells(px, pz, size).every(([gx, gz]) => !busy.has(`${gx}:${gz}`));
    const claim = (px, pz) => { for (const [gx, gz] of pawnCells(px, pz, size)) busy.add(`${gx}:${gz}`); return [px, pz]; };
    const out = [claim(lx, lz)]; // the lead goes where it was clicked, whatever stands there (the click is the choice)
    const cands = [];
    for (let ring = 1; ring <= 9 && cands.length < n * 6; ring++) for (let i = -ring; i <= ring; i++) for (let j = -ring; j <= ring; j++) if (Math.max(Math.abs(i), Math.abs(j)) === ring) cands.push([i, j]);
    cands.sort((a, b) => (a[0] ** 2 + a[1] ** 2) - (b[0] ** 2 + b[1] ** 2) || Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    for (const pass of room ? ['room', 'any'] : ['any']) for (const [i, j] of cands) {
      if (out.length >= n) break;
      const px = lx + i * step, pz = lz + j * step;
      if (!isFree(px, pz) || (pass === 'room' && app.roomAt(px, pz, y)?.id !== room)) continue;
      out.push(claim(px, pz));
    }
    // free (Shift while DRAGGING a figure out of a list: off the squares, as Shift is for a dragged pawn): the whole
    // formation is shifted so the lead stands exactly where the pointer is
    if (free) { const ox = x - lx, oz = z - lz; return out.map(([px, pz]) => [px + ox, pz + oz]); }
    return out;
  };
  // labels: one pawn keeps the plain name unless that name is on the table already; a group is numbered, carrying on
  // from the highest number there ("Goblin 4" stands: the next are Goblin 5, 6 …)
  app.pawnNames = (base, n, numbered = false) => {
    const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: (\\d+))?$`); let max = 0, any = false;
    for (const t of tokens()) { const m = re.exec(t.name || ''); if (m) { any = true; max = Math.max(max, m[1] ? +m[1] : 1); } }
    if (n === 1 && !any && !numbered) return [base];
    return Array.from({ length: n }, (_, i) => `${base} ${max + i + 1}`);
  };
  // place n pawns wearing a figure (null: the plain stand-in) round a point; ONE command. Returns the new ids.
  app.addPawns = (fig, x, z, { count = 1, y = 0, rot = 0, owner = null, name = null, select = true, numbered = false, free = false } = {}) => {
    const f = typeof fig === 'string' ? F.get(fig) : fig, size = f?.size || 1, n = Math.max(1, Math.min(MAX_GROUP, count | 0));
    const spots = app.pawnFormation(x, z, { size, n, y, free }), names = app.pawnNames(name || pawnLabel(f), spots.length, numbered), color = app.myColor();
    const ops = spots.map(([px, pz], i) => ({ type: 'token.create', args: { id: newId('tok'), name: names[i], x: r2(px), z: r2(pz), ...(y && { y: r2(y) }), rot: r2(rot), color, ...(owner && { owner }), ...(f && { fig: f.id }), ...(size > 1 && { size }) } }));
    app.batch(ops);
    const ids = ops.map(o => o.args.id);
    if (select) app.select(ids);
    app.lastPawns = { ids, names, fig: f?.id || null, spots }; // (tests)
    return ids;
  };
  // DROP A CAST ENTRY (the GM's cast: core/party.js). A named individual is one pawn, with its sheet link and notes. A
  // saved group is dropped in one go round the clicked square and NUMBERED, exactly as the command bar's "6 goblins"
  // is: the lead on the square, the rest on the nearest free squares, "Goblin 1, Goblin 2 ...", the count carrying on
  // from the highest number on the table. One command (one undo).
  app.dropCast = (cast, x, z, { y = 0, rot = 0, select = true, free = false } = {}) => {
    const color = app.myColor(), ops = [];
    if (cast.kind === 'group') {
      const ms = cast.members.map(m => ({ ...m, f: F.get(m.fig), size: m.size || F.get(m.fig)?.size || 1 }));
      const S = Math.max(...ms.map(m => m.size)), spots = app.pawnFormation(x, z, { size: S, n: ms.length, y, free });
      const bases = new Map(); for (const m of ms) bases.set(m.name, (bases.get(m.name) || 0) + 1);
      const names = new Map([...bases].map(([b, n]) => [b, app.pawnNames(b, n, n > 1)]));
      // (each spot is the middle of an S x S block of squares: a smaller pawn stands in the block's first square)
      ms.slice(0, spots.length).forEach((m, i) => { const [px, pz] = spots[i], off = (m.size - S) * 2.5; ops.push({ type: 'token.create', args: { id: newId('tok'), name: names.get(m.name).shift(), x: r2(px + off), z: r2(pz + off), ...(y && { y: r2(y) }), rot: r2(rot), color, ...(m.f && { fig: m.f.id }), ...(m.size > 1 && { size: m.size }) } }); });
    } else {
      const f = F.get(cast.fig), size = cast.size || f?.size || 1, [px, pz] = app.pawnFormation(x, z, { size, n: 1, y, free })[0];
      ops.push({ type: 'token.create', args: { id: newId('tok'), def: cast.id, name: app.pawnNames(cast.name, 1)[0], x: r2(px), z: r2(pz), ...(y && { y: r2(y) }), rot: r2(rot), color, ...(f && { fig: f.id }), ...(size > 1 && { size }), ...(cast.sheet && { sheet: cast.sheet }), ...(cast.notes && { notes: cast.notes }), ...(cast.gmNotes && { gmNotes: cast.gmNotes }) } });
    }
    app.batch(ops); app.sync.submit('cast.use', { id: cast.id });
    const ids = ops.map(o => o.args.id); if (select) app.select(ids);
    app.lastPawns = { ids, names: ops.map(o => o.args.name), cast: cast.id }; // (tests)
    return ids;
  };
  app.setFigure = (pawns, fig) => {
    const f = typeof fig === 'string' ? F.get(fig) : fig;
    return app.batch(pawns.map(p => {
      const size = f?.size || 1, moved = size !== sizeOf(p); // a pawn that changes size goes onto the squares its new base covers
      return [{ type: 'token.set', args: { id: p.id, fig: f ? f.id : 'none', size } }, ...(moved ? [{ type: 'token.move', args: { id: p.id, x: pawnPoint(p.x, size), z: pawnPoint(p.z, size) } }] : [])];
    }).flat());
  };

  // ---------------- the pawn tool (a 'place' mode: input.js already sends it hover, click, R and Esc) ----------------
  let ghost = null;
  const world = () => app.worldOf(app.area());
  const fade = (g) => g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.6; o.material.depthWrite = false; o.userData.noPick = true; } });
  const T = app.pawnTool = {
    // def: one of my DEFINED pawns, brought on from the bench (pawn.bring: a player may; core/commands.js)
    // cast: an entry of the GM's cast: a named individual, or a saved group dropped in one go (app.dropCast)
    start(fig, { count = 1, keep = false, def = null, cast = null } = {}) {
      const members = cast?.kind === 'group' ? cast.members : null;
      const f = def ? F.get(def.fig) : cast ? F.get(members ? members[0].fig : cast.fig) : typeof fig === 'string' ? F.get(fig) : fig;
      if (def ? !app.can('pawn') : !app.can('token.edit')) { app.toast(def ? 'You cannot bring pawns on here' : 'Only the GM side adds pawns', true); return false; }
      app.modes.cancel();
      const n = members ? members.length : Math.max(1, Math.min(MAX_GROUP, count | 0)), size = members ? Math.max(...members.map(m => m.size || F.get(m.fig)?.size || 1)) : (def?.size || cast?.size || f?.size || 1);
      app.mode = { kind: 'place', pawn: { fig: f || null, n, size, def, cast }, cat: { id: null, place: 'pawn', name: def?.name || cast?.name || f?.name || 'Pawn' }, size: { dims: [size * 4.5, f ? f.oh * F.scale() : 4, size * 4.5] }, rot: 0, keep, tool: false };
      ghost = (f && F.pawnVisual({ fig: f.id, size }, { color: app.myColor(), onReady: (g) => { if (g === ghost) fade(g); } })) || world().tokenMesh({ color: app.myColor() });
      fade(ghost); ghost.visible = false; ghost.userData.halo = true; world().layers.deco.add(ghost);
      if (count > MAX_GROUP) app.toast(`${MAX_GROUP} at a time is the most`, true);
      app.refresh(); return true;
    },
    clear() { if (ghost) { ghost.parent?.remove(ghost); ghost = null; } app.worlds.get(app.area())?.clearCells('pawn-tool'); },
    plan(ground, free = false) { const m = app.mode?.pawn; if (!m || !ground) return null; const y = ground.y || 0; return { y, spots: app.pawnFormation(ground[0], ground[1], { size: m.size, n: m.n, y, free }) }; },
    hover(ray, ground, ev) {
      const m = app.mode?.pawn, drag = !!app.mode?.viaDrag, P = T.plan(ground, drag && !app.pawnSnaps(!!ev?.shiftKey)); if (!ghost || !m) return; // (dragged out of a list: on the squares or off them by the same rule as a dragged pawn)
      ghost.visible = !!P;
      if (!P) { world().clearCells('pawn-tool'); sizeLabel.hidden = true; return; }
      ghost.position.set(P.spots[0][0], P.y, P.spots[0][1]); ghost.rotation.y = app.mode.rot;
      world().showCells('pawn-tool', { lit: P.spots.flatMap(([x, z]) => pawnCells(x, z, m.size)), dim: [], color: app.myColor(), y: P.y });
      if (ev) { sizeLabel.hidden = false; sizeLabel.classList.remove('bad'); sizeLabel.textContent = `${m.n > 1 ? `${P.spots.length} × ` : ''}${app.mode.cat.name}${m.size > 1 ? ` · ${m.size * 5} ft base` : ''} · ${drag ? (app.pawnSnaps(!!ev.shiftKey) ? 'let go on a square' : app.pawnSnaps(true) ? 'let go anywhere · Shift: on a square' : 'let go anywhere') : 'click a square'} · R turns`; sizeLabel.style.left = `${ev.clientX + 40}px`; sizeLabel.style.top = `${ev.clientY + 40}px`; }
    },
    placeAt(ray, ground, ev) {
      const m = app.mode?.pawn; if (!m || !ground) return;
      // DRAGGED OUT OF A LIST (app.dragPawnOut): one drop, never "keep placing"; Shift is off the squares instead
      const drag = !!app.mode.viaDrag, free = drag && !app.pawnSnaps(!!ev?.shiftKey); if (drag) ev = null;
      if (m.def) { // from my bench: the relay writes the pawn from the definition (what is sent here is only for drawing it at once)
        const d = m.def, [x, z] = app.pawnFormation(ground[0], ground[1], { size: m.size, n: 1, y: ground.y || 0, free })[0], id = newId('tok');
        app.dispatch('pawn.bring', { id, def: d.id, x: r2(x), z: r2(z), ...(ground.y && { y: r2(ground.y) }), rot: r2(app.mode.rot), name: d.name, owner: d.owner, color: app.seatColor(d.owner), ...(d.fig && { fig: d.fig }), ...(m.size > 1 && { size: m.size }), ...(d.sheet && { sheet: d.sheet }), ...(d.notes && { notes: d.notes }), ...(d.main && { main: true }) });
        app.select([id]); app.lastPawns = { ids: [id], names: [d.name], fig: d.fig || null, def: d.id }; app.modes.cancel(); return;
      }
      if (m.cast) { const ids = app.dropCast(m.cast, ground[0], ground[1], { y: ground.y || 0, rot: app.mode.rot, free }); if (ids.length < m.n) app.toast(`Room for ${ids.length} of ${m.n} there`, true); if (!(ev?.shiftKey || (app.mode.keep && !drag))) app.modes.cancel(); return; }
      const keep = !drag && !!(ev?.shiftKey || app.mode.keep);
      const ids = app.addPawns(m.fig, ground[0], ground[1], { count: m.n, y: ground.y || 0, rot: app.mode.rot, select: !keep, numbered: keep, free });
      if (ids.length < m.n) app.toast(`Room for ${ids.length} of ${m.n} there`, true);
      if (!keep) app.modes.cancel();
    },
  };
  // ---------------- DRAG IT OUT OF A LIST (Harry 2026-10-06: "the pawns can't be dragged out of the text-search menu") ----------------
  // ONE gesture for every place a figure or a pawn is shown as a row or a tile (the command bar's figure rows, the Pawns
  // menu's tree, the cast, my bench): press on it, move past the threshold, and it is in your hand over the map; let go
  // on the map and it is there. Let go anywhere else (back over the list, a menu, the picture-in-picture) or press Esc:
  // nothing happened. A press that never moves is the row's ordinary click, untouched.
  //   app.dragOut(ev, { begin, move, drop, end, key })   the bare gesture, from a pointerdown
  //       begin()            the threshold was crossed; return false to refuse (nothing starts)
  //       move(ev, overMap)  every pointer move after that
  //       drop(ev)           released over the map; return false when nothing was done
  //       end(done)          always, last: done = something was dropped
  //       key(ev)            a key while dragging (Esc is taken already); return true when used
  //   app.dragPawnOut(ev, start, { onStart, onEnd })     the pawn tool's ghost as the thing in hand: `start` starts the
  //       tool (app.pawnTool.start(...), so a seat can only drag what it could click). It snaps to the squares (a large
  //       creature to its four), lands on the floor that shows under the pointer, R turns it, Shift is off the squares.
  //   app.dragFigureOnto(ev, fig, { onStart, onEnd })    a figure's picture in hand, dropped ONTO a pawn: that pawn
  //       wears the figure (the bar's "change figure" rows)
  // Mouse, trackpad and touch are all pointer events here; a row that can be dragged has touch-action: none (style.css).
  const DRAG_OUT_PX = 6, canvas = document.getElementById('c');
  const overMap = (x, y) => { if (document.elementFromPoint(x, y) !== canvas) return false; if (!app.pip) return true; const r = canvas.getBoundingClientRect(); return !app.pip.contains(x - r.left, y - r.top, r.width, r.height); };
  let out = null;
  app.dragOut = (ev, h) => {
    if (out || !app.main || (ev.pointerType === 'mouse' && ev.button !== 0) || ev.isPrimary === false) return false;
    const d = out = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, started: false };
    const off = () => { removeEventListener('pointermove', mv, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true); removeEventListener('keydown', kd, true); out = null; };
    const swallow = (e) => { e.stopPropagation(); e.preventDefault(); }; // the release of a drag is never also a click on what is under it
    const finish = (done) => {
      off(); document.body.classList.remove('dragging-out');
      addEventListener('click', swallow, true); setTimeout(() => removeEventListener('click', swallow, true), 0);
      app.lastDragOut = { done: !!done, at: Date.now() }; // (tests)
      h.end?.(!!done);
    };
    const mv = (e) => {
      if (e.pointerId !== d.id) return;
      if (!d.started) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) <= DRAG_OUT_PX) return;
        if (h.begin?.() === false) { off(); return; }
        d.started = true; document.body.classList.add('dragging-out');
      }
      e.preventDefault(); d.last = [e.clientX, e.clientY, e.shiftKey];
      d.again = () => h.move?.(e, overMap(e.clientX, e.clientY)); // (edge auto-pan: the same pointer place, after the view moved)
      h.move?.(e, overMap(e.clientX, e.clientY));
    };
    const up = (e) => {
      if (e.pointerId !== d.id) return;
      if (!d.started) { off(); return; } // it never moved: the row's own click
      finish(e.type === 'pointerup' && overMap(e.clientX, e.clientY) && h.drop?.(e) !== false);
    };
    const kd = (e) => {
      if (!d.started) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); finish(false); return; }
      if (h.key?.(e, d.last)) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    addEventListener('pointermove', mv, true); addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true); addEventListener('keydown', kd, true);
    return true;
  };
  app.draggingOut = () => !!out?.started;
  app.edgePan?.source({ name: 'list', mapOnly: true, active: () => !!out?.started, refresh: () => out?.again?.() }); // held at an edge of the window, the view pans (edgepan.js)
  app.dragPawnOut = (ev, start, { onStart = null, onEnd = null } = {}) => {
    const at = (e) => { const g = app.groundAt(e.clientX, e.clientY); return [app.rayAt(e.clientX, e.clientY), g]; };
    return app.dragOut(ev, {
      begin: () => { if (!start() || !app.mode?.pawn) return false; app.mode.viaDrag = true; onStart?.(); },
      move: (e, over) => { const [r, g] = at(e); app.cursor = over ? g : null; app.modes.hover(r, over ? g : null, e); },
      drop: (e) => { const [r, g] = at(e); if (!g || !app.mode?.pawn) return false; app.modes.placeAt(r, g, e); },
      // R turns the ghost (the keyboard may be in the command bar's field: the letter is not typed)
      key: (e, last) => { if (e.key.toLowerCase() !== 'r' || e.ctrlKey || e.metaKey || e.altKey || !app.mode?.pawn) return false; app.mode.rot += (e.shiftKey ? -1 : 1) * Math.PI / 4; if (last) T.hover(null, overMap(last[0], last[1]) ? app.groundAt(last[0], last[1]) : null, { clientX: last[0], clientY: last[1], shiftKey: last[2] }); return true; },
      end: (done) => { if (app.mode?.viaDrag) app.modes.cancel(); sizeLabel.hidden = true; onEnd?.(done); },
    });
  };
  app.dragFigureOnto = (ev, fig, { onStart = null, onEnd = null } = {}) => {
    let chip = null, target = null;
    const hoverOn = (id) => { if (app.hover !== id) { app.hover = id; app.emit('hover', id); } };
    return app.dragOut(ev, {
      begin: () => { chip = document.createElement('div'); chip.id = 'dragFig'; const u = F.thumbUrl(fig); if (u) { const im = new Image(); im.src = u; im.alt = ''; im.draggable = false; chip.append(im); } document.body.append(chip); onStart?.(); },
      move: (e, over) => {
        chip.style.left = `${e.clientX}px`; chip.style.top = `${e.clientY}px`;
        const t = over ? world().pick(app.rayAt(e.clientX, e.clientY))?.entity : null;
        target = t?.kind === 'token' && (app.gm() || app.canTouch(t)) ? t : null; hoverOn(target?.id || null);
        sizeLabel.hidden = false; sizeLabel.classList.remove('bad'); sizeLabel.textContent = target ? `${target.name} → ${fig.name}` : `${fig.name}: let go on a pawn to change its figure`; sizeLabel.style.left = `${e.clientX + 40}px`; sizeLabel.style.top = `${e.clientY + 40}px`;
      },
      drop: () => { if (!target) return false; app.setFigure([target], fig); app.lastFigureDrop = { id: target.id, fig: fig.id }; },
      end: (done) => { chip?.remove(); hoverOn(null); sizeLabel.hidden = true; onEnd?.(done); },
    });
  };
}

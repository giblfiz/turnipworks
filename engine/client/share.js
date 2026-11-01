// SHARED BUILDS, in the browser (2026-10-29; core/share.js is the format and every rule; docs/UI.md "Sharing builds").
//   Export         THE WHOLE AREA only: Settings ▸ Area settings ("Export this area…") and the bar ("export", "export
//                  area", "share link"): a small window with the 3/4 picture the game renders, what is in it,
//                  "Strip secrets", and two ways out: Download (.turnip.json) and Copy share link (an unlisted copy on the
//                  relay, relay/shares.js; its delete is in the same window and in Settings ▸ Campaign admin).
//                  A SELECTION (a room, a building, things) is not exported, on purpose (Harry 2026-10-29: "drop export
//                  of selections — that can be a thing once we have the whole 'object tuner for players' thing"). It is
//                  PARKED until the player object tuner / prop assembler exists; the format (core/share.js) still has
//                  every kind, so the starter builds and old files of every kind still import. Sh.build takes any kind
//                  (the tests make their room, building and prop-group files with it); no button reaches the others.
//   Import         open a file (Settings ▸ Campaign admin ▸ Shared builds, or "import" in the bar), drop one on the window,
//                  or "import <link>" in the bar; a share page's "Use in my campaign" opens the game with ?share=<id>.
//                  A room, a building or things ride the pointer as a GHOST (their footprint in my colour, red where it
//                  would overlap; a building lands on the ground, on a hilltop it stands wholly on; things land on the floor
//                  under the pointer at the level in view); a click commits it as ONE batch (one undo). A whole area comes
//                  in as a new area. Pieces this library lacks come in as stand-ins, and the toast says how many.
//   Starter builds the repo's engine/client/starter/ (index.json lists them): built-in shared builds, the alpha's kit.
// Everything that reads a file goes through core/share.js parseShare + planImport: never raw entities, never a URL from
// the file (a share link is reduced to its id and fetched from OUR relay only).
import * as THREE from 'three';
import * as S from '../core/share.js';
import { cellsOf } from '../core/footprint.js';
import { newId } from '../core/ids.js';
import { icon } from './icons.js';

export const SHARE_LINK_RE = /(?:^|\/s\/)([A-Za-z0-9_-]{22})(?=$|[/?#\s])/;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const KIND_WORD = { area: 'area', building: 'building', room: 'room', group: 'set of things' };
const LINKS_KEY = 'tw.shareLinks';
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function createShare(app, { thumbs }) {
  const Sh = { last: null, lastImport: null, lastLink: null };
  const may = () => !!app.gm?.() && !!app.can?.('room');
  const C = () => app.sync?.campaign;
  const linkBase = () => app.relayBase.replace(/\/api\/tw-relay\/?$/, '');
  Sh.urlOf = (id) => `${linkBase()}/s/${id}`;
  const seatQ = () => `seat=${encodeURIComponent(app.sync.token)}`;
  const savedLinks = () => { try { return JSON.parse(localStorage.getItem(LINKS_KEY) || '[]'); } catch { return []; } };
  const saveLinks = (L) => { try { localStorage.setItem(LINKS_KEY, JSON.stringify(L.slice(-60))); } catch { } };

  // the area's picture: 3/4 from the home angle (thumbs.js), without what players cannot see
  async function pictureOf(area = app.area()) {
    try { const blob = await thumbs.render(area, {}); if (!blob) return null; return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => res(null); fr.readAsDataURL(blob); }); }
    catch { return null; }
  }
  Sh.build = (sel, { strip = false, name = null, thumb = null, area = app.area() } = {}) => {
    const A = C()?.areas.find(a => a.id === area), v = app.sync.view(area);
    return S.exportShare(app.entities(area) || {}, { kind: sel.kind, ids: sel.ids, name: name || sel.name || (sel.kind === 'area' ? A?.name : ''), strip, thumb, engineVersion: app.roomgen?.version || '', area: sel.kind === 'area' ? { name: A?.name, settings: A?.settings, ground: v?.ground } : null });
  };

  // ---------------------------------------------------------------- the window
  let modal = null, D = null;
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div'); modal.id = 'shareModal'; modal.hidden = true;
    modal.addEventListener('pointerdown', (ev) => { if (ev.target === modal) Sh.close(); });
    modal.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Escape') Sh.close(); });
    document.body.append(modal);
    return modal;
  }
  Sh.close = () => { if (modal) modal.hidden = true; D = null; };
  Sh.isOpen = () => !!modal && !modal.hidden;
  // (the whole area: a selection is not exported, see the top of this file; { area: true } is still accepted)
  Sh.open = async () => {
    if (!may()) { app.toast('Exporting builds is the GM\'s', true); return false; }
    const sel = { kind: 'area', ids: [], name: C()?.areas.find(a => a.id === app.area())?.name || 'Area' };
    const secrets = S.secretsIn(app.entities() || {}, sel);
    D = { sel, strip: false, name: sel.name || '', thumb: undefined, secrets, link: null, busy: false };
    render();
    modal.hidden = false; modal.querySelector('.shname')?.focus();
    const thumb = await pictureOf(); if (D?.sel === sel) { D.thumb = thumb; render(); }
    return true;
  };
  const docNow = () => Sh.build(D.sel, { strip: D.strip, name: D.name || null, thumb: D.thumb || null });
  function render() {
    ensureModal(); if (!D) return;
    const { doc, left } = docNow(), sum = S.summaryOf(doc), sc = D.secrets;
    const what = [sum.buildings && plural(sum.buildings, 'building'), sum.rooms && plural(sum.rooms, 'room'), sum.levels > 1 && `${sum.levels} levels`, sum.hills && plural(sum.hills, 'hill'), sum.things && plural(sum.things, 'thing'), sum.pawns && plural(sum.pawns, 'creature'), sum.water && plural(sum.water, 'water')].filter(Boolean).join(' · ');
    const gone = [sc.hiddenRooms && plural(sc.hiddenRooms, 'hidden room'), sc.hiddenThings && plural(sc.hiddenThings, 'hidden thing'), sc.pawns && plural(sc.pawns, 'creature'), sc.traps && plural(sc.traps, 'trap'), sc.gmNotes && plural(sc.gmNotes, 'GM note')].filter(Boolean).join(', ');
    const bytes = JSON.stringify(doc).length;
    modal.innerHTML = `<div class="shmodal" role="dialog" aria-label="Share">
      <div class="shhead"><b>Share this ${KIND_WORD[D.sel.kind]}</b><button class="sx" data-act="close" aria-label="Close">×</button></div>
      <div class="shbody">
        <div class="shpic">${D.thumb ? `<img src="${esc(D.thumb)}" alt="">` : `<span>${D.thumb === undefined ? 'Taking the picture…' : 'No picture'}</span>`}</div>
        <div class="shside">
          <label class="shlab">Name <input class="shname" maxlength="${S.SHARE_LIMITS.name}" value="${esc(D.name)}" placeholder="${esc(doc.name)}"></label>
          <p class="shwhat">${esc(what || 'nothing')} <small>· ${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB</small></p>
          <label class="schk shstrip${sc.any ? '' : ' dim'}"><input type="checkbox" class="shstripbox"${D.strip ? ' checked' : ''}${sc.any ? '' : ' disabled'}> Strip secrets</label>
          <p class="snote">${sc.any ? `GM-only parts travel by default (the one who imports it is a GM). Strip secrets takes out ${esc(gone)}.` : 'Nothing in it is hidden from players.'}</p>
          ${left.players ? `<p class="snote">${plural(left.players, 'player pawn')} left out: a player's pawn never leaves its campaign.</p>` : ''}
          <p class="snote">Recipes and library pieces only, no meshes: rooms, walls and furniture come from the importer's own library.</p>
          <div class="sab"><button class="sbtn primary" data-act="download">${icon('package', 15)} Download .turnip.json</button><button class="sbtn" data-act="link"${D.busy ? ' disabled' : ''}>${icon('link', 15)} Copy share link</button></div>
          ${D.link ? `<div class="shlink"><code>${esc(D.link.url)}</code><button class="sbtn tiny" data-act="copylink">Copy</button><button class="sbtn tiny danger" data-act="unlink">Delete link</button></div><p class="snote">Unlisted: only people with the link can open it. Anyone with it can import it.</p>` : ''}
          ${D.error ? `<p class="snote bad">${esc(D.error)}</p>` : ''}
        </div>
      </div></div>`;
    const $ = (s) => modal.querySelector(s);
    $('[data-act=close]').onclick = Sh.close;
    $('.shname').oninput = (ev) => { D.name = ev.target.value; };
    $('.shname').onchange = () => render();
    const sb = $('.shstripbox'); if (sb) sb.onchange = () => { D.strip = sb.checked; D.link = null; render(); };
    $('[data-act=download]').onclick = () => Sh.download();
    $('[data-act=link]').onclick = () => Sh.makeLink();
    const cl = $('[data-act=copylink]'); if (cl) cl.onclick = () => copy(D.link.url, 'Share link copied');
    const ul = $('[data-act=unlink]'); if (ul) ul.onclick = async () => { await Sh.deleteLink(D.link.id); D.link = null; render(); };
  }
  const copy = (text, msg) => { try { navigator.clipboard?.writeText(text)?.catch?.(() => { }); } catch { } Sh.lastCopied = text; app.toast(msg); };
  const slug = (s) => String(s || 'build').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'build';
  Sh.download = (doc = null) => {
    doc ||= docNow().doc;
    const text = JSON.stringify(doc);
    Sh.last = { doc, bytes: text.length };
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${slug(doc.name)}${S.SHARE_EXT}` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    app.toast(`Downloaded “${doc.name}”`);
    return doc;
  };
  Sh.makeLink = async () => {
    if (!D || D.busy) return null;
    D.busy = true; D.error = null; render();
    const doc = docNow().doc;
    let r; try { r = await fetch(`${app.relayBase}/c/${C().id}/shares?${seatQ()}`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(doc) }).then(x => x.json()); } catch { r = { ok: false, why: 'the server could not be reached' }; }
    if (!D) return null;
    D.busy = false;
    if (!r.ok) { D.error = `No link: ${r.why}`; render(); return null; }
    D.link = { id: r.id, url: Sh.urlOf(r.id), del: r.del };
    Sh.lastLink = { ...D.link, name: doc.name };
    saveLinks([...savedLinks(), { id: r.id, del: r.del, name: doc.name, at: Date.now(), campaign: C().id }]);
    copy(D.link.url, 'Share link copied');
    render();
    return D.link;
  };
  // delete a link I made: by my seat (the relay knows who made it), else by the key this browser kept
  Sh.deleteLink = async (id) => {
    let r = null;
    try { r = await fetch(`${app.relayBase}/c/${C().id}/shares/${encodeURIComponent(id)}/delete?${seatQ()}`, { method: 'POST' }).then(x => x.json()); } catch { }
    if (!r?.ok) { const k = savedLinks().find(x => x.id === id); if (k) try { r = await fetch(`${app.relayBase}/s/${encodeURIComponent(id)}/delete`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ token: k.del }) }).then(x => x.json()); } catch { } }
    if (r?.ok) { saveLinks(savedLinks().filter(x => x.id !== id)); app.toast('Share link deleted'); Sh.myLinks = (Sh.myLinks || []).filter(x => x.id !== id); }
    else app.toast(`Could not delete the link${r?.why ? `: ${r.why}` : ''}`, true);
    return !!r?.ok;
  };
  Sh.refreshLinks = async () => { try { const r = await fetch(`${app.relayBase}/c/${C().id}/shares?${seatQ()}`).then(x => x.json()); Sh.myLinks = r.ok ? r.shares : []; } catch { Sh.myLinks = []; } return Sh.myLinks; };

  // ---------------------------------------------------------------- import
  const target = (area = app.area(), extra = {}) => ({ area: { ...app.sync.view(area), id: area }, resolve: (c, s) => app.roomgen.sizeOf(c, s), roomTypes: app.roomgen?.types || null, fallbackType: app.roomgen?.types?.has?.('common') ? 'common' : null, figs: app.assets?.figures?.byId ? new Set(app.assets.figures.byId.keys()) : null, gm: !!app.gm?.(), engineVersion: app.roomgen?.version || '', newId, ...extra });
  Sh.importText = async (text, { from = 'file' } = {}) => {
    if (!may()) { app.toast('Importing builds is the GM\'s', true); return false; }
    if (/"kind"\s*:\s*"turnip-works-campaign"/.test(String(text).slice(0, 400))) { let d = null; try { d = JSON.parse(text); } catch { } if (d) { await app.settings?.importData(d); return true; } }
    const { doc, error } = S.parseShare(String(text));
    if (error) { Sh.lastImport = { error }; app.toast(`Not imported: ${error}`, true); return false; }
    return Sh.begin(doc, { from });
  };
  Sh.importLink = async (link) => {
    const m = String(link || '').trim().match(SHARE_LINK_RE);
    if (!m) { app.toast('That is not a Turnip Works share link (…/s/ID)', true); return false; }
    let r; try { r = await fetch(`${app.relayBase}/s/${m[1]}/json`); } catch { r = null; } // (our own relay only: the link gives just the id)
    if (!r?.ok) { Sh.lastImport = { error: 'no such shared build' }; app.toast('No such shared build here (deleted, or the link is not complete)', true); return false; }
    return Sh.importText(await r.text(), { from: 'link' });
  };
  Sh.importFile = async (file) => { if (!file) return false; if (file.size > S.SHARE_LIMITS.bytes) { app.toast('Not imported: that file is too big for a shared build', true); return false; } return Sh.importText(await file.text(), { from: 'file' }); };
  Sh.pickFile = () => { const i = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' }); i.onchange = () => Sh.importFile(i.files[0]); i.click(); };
  Sh.begin = (doc, opts = {}) => doc.kind === 'area' ? Sh.importArea(doc) : tool.start(doc, opts);
  const reportText = (R) => [R.standIns.length && `${plural(R.standIns.length, 'piece')} your library lacks: shown as stand-ins`, R.substitutes.length && `${plural(R.substitutes.length, 'piece')} swapped for a close match`, R.roomTypes.length && `${plural(R.roomTypes.length, 'room type')} it lacks: built as common rooms`, R.figs.length && `${plural(R.figs.length, 'figure')} it lacks: plain pawns`].filter(Boolean).join(' · ');
  // the ops, in batches that each fit one message (a build is one: one undo)
  async function commit(plan, area) {
    const parts = S.chunkOps(plan.ops);
    for (const ops of parts) { const m = await app.await(app.sync.submit('batch', { ops }, area)); if (!m) return false; }
    return parts.length;
  }
  Sh.importArea = async (doc) => {
    const id = newId('area'), name = String(doc.area?.name || doc.name).slice(0, 60);
    if (!(await app.await(app.sync.submit('area.create', { id, name })))) return false; // (a new area starts hidden from players)
    if (doc.area?.settings && Object.keys(doc.area.settings).length) app.sync.submit('area.set', { area: id, settings: doc.area.settings });
    app.sync.subscribe(id);
    for (let i = 0; i < 80 && !app.sync.view(id); i++) await new Promise(r => setTimeout(r, 100));
    if (!app.sync.view(id)) { app.toast('Not imported: the new area did not open', true); return false; }
    if (doc.area?.ground) app.sync.submit('area.ground', { cat: doc.area.ground }, id);
    const plan = S.planImport(doc, target(id, { keepPlace: true }));
    if (!plan.ok) { Sh.lastImport = { error: plan.why }; app.toast(`Not imported: ${plan.why}`, true); return false; }
    const steps = await commit(plan, id);
    if (id !== app.area() && app.pip?.area !== id) app.sync.unsubscribe(id);
    const rep = reportText(plan.report);
    Sh.lastImport = { area: id, name, report: plan.report, ids: plan.ids, steps };
    app.toast(`Imported “${name}” as a new area (hidden from players)${rep ? ` · ${rep}` : ''}`, !!plan.report.standIns.length);
    return id;
  };

  // ---------------------------------------------------------------- the ghost (a sub-tool of the place mode, like picks.js)
  const label = document.getElementById('modeLabel');
  const fade = (g) => g.traverse(o => { if (!o.isMesh) return; o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; o.material.depthWrite = false; o.renderOrder = 26; o.userData.noPick = true; });
  let ghost = null, cellKeys = new Set();
  const world = () => app.worldOf(app.area());
  const tool = app.shareTool = {
    start(doc, { from } = {}) {
      app.modes.cancel();
      app.mode = { kind: 'place', share: { doc, from }, cat: { place: 'share', name: doc.name }, rot: 0, tool: false };
      const g = ghost = new THREE.Group(); g.visible = false; g.userData.noPick = true; world().layers.deco.add(g);
      let meshes = 0;
      for (const o of doc.objects.slice(0, 600)) {
        const holder = new THREE.Group(); holder.position.set(o.x, o.y || 0, o.z); holder.rotation.y = o.rot || 0; g.add(holder);
        const stand = app.assets.placeholder(o.dims || [2, 2, 2]); holder.add(stand); fade(stand);
        const lib = o.cat && o.sku ? app.roomgen.sizeOf(o.cat, o.sku) : null;
        if (lib?.url && meshes++ < 160) app.assets.visualFor({ ...lib, cat: o.cat, place: o.place, dims: o.dims || lib.dims, s: o.sku === lib.sku ? o.s || lib.s : lib.s }).then(v => { if (!v || ghost !== g) return; holder.remove(stand); holder.add(v); fade(v); }).catch(() => {});
      }
      for (const t of doc.pawns.slice(0, 100)) {
        const v = (t.fig && app.assets.figures?.pawnVisual({ fig: t.fig, size: t.size || 1 }, { color: app.myColor(), ghost: true })) || world().tokenMesh?.({ color: app.myColor() });
        if (v) { v.position.set(t.x, t.y || 0, t.z); g.add(v); fade(v); }
      }
      Sh.ghost = { name: doc.name, rooms: doc.rooms.length, things: doc.objects.length, pawns: doc.pawns.length, at: null };
      app.toast(`Place “${doc.name}”: click where it goes · Esc cancels`);
      app.refresh(); return true;
    },
    clear() { ghost?.parent?.remove(ghost); ghost = null; const w = app.worlds.get(app.area()); for (const k of cellKeys) w?.clearCells(k); cellKeys = new Set(); if (label) { label.hidden = true; label.classList.remove('bad'); } },
    where(ground) {
      const doc = app.mode?.share?.doc; if (!doc || !ground) return null;
      return S.placeFor(doc, { entities: app.entities(), at: [ground[0], ground[1]], level: app.level || 0, floorY: ground.y || 0 });
    },
    hover(ray, ground, ev) {
      const doc = app.mode?.share?.doc, P = tool.where(ground);
      if (!ghost || !doc) return;
      ghost.visible = !!P; if (!P) return;
      ghost.position.set(P.dx, P.dy, P.dz);
      // the footprint, per level, in my colour (red where it would land on a room that is already there)
      const byY = new Map();
      for (const rc of P.rooms) { const y = rc.y || 0; if (!byY.has(y)) byY.set(y, []); for (const [i, j] of cellsOf(rc)) byY.get(y).push([rc.x + i, rc.z + j]); }
      const w = world(), now = new Set();
      for (const [y, lit] of byY) { const k = `share-ghost:${y}`; now.add(k); w.showCells(k, { lit, color: P.clash ? '#e5484d' : app.myColor(), y, opacity: 0.3 }); }
      for (const k of cellKeys) if (!now.has(k)) w.clearCells(k);
      cellKeys = now;
      const hit = P.clash && app.entities()[P.clash.hit];
      if (label) {
        label.hidden = false; label.classList.toggle('bad', !!P.clash);
        label.textContent = `${doc.name}${P.clash ? ` · overlaps ${hit ? app.nameOf?.(hit) || 'a room' : 'a room'}` : P.dy ? ` · ${P.dy > 0 ? 'up' : 'down'} ${Math.abs(P.dy)} ft` : ''} · click to place`;
        if (ev?.clientX != null) { label.style.left = `${ev.clientX + 40}px`; label.style.top = `${ev.clientY + 40}px`; }
      }
      Sh.ghost = { ...Sh.ghost, at: [ground[0], ground[1]], dx: P.dx, dz: P.dz, dy: P.dy, clash: P.clash?.hit || null, cells: [...byY.values()].reduce((n, l) => n + l.length, 0), levels: [...byY.keys()] };
    },
    async placeAt(ray, ground, ev) {
      const m = app.mode, doc = m?.share?.doc; if (!doc || !ground) return;
      const plan = S.planImport(doc, target(app.area(), { at: [ground[0], ground[1]], level: app.level || 0, floorY: ground.y || 0 }));
      if (!plan.ok) { Sh.lastImport = { error: plan.why }; app.toast(`Not placed: ${plan.why}`, true); return; }
      if (!ev?.shiftKey) app.modes.cancel();
      const area = app.area(), steps = await commit(plan, area);
      if (!steps) { Sh.lastImport = { error: 'refused' }; return; }
      const rep = reportText(plan.report);
      Sh.lastImport = { area, name: doc.name, report: plan.report, ids: plan.ids, top: plan.top, steps, shift: { dx: plan.shift.dx, dz: plan.shift.dz, dy: plan.shift.dy } };
      app.select(plan.top.filter(id => app.ent(id)));
      app.toast(`Imported “${doc.name}”${steps > 1 ? ` (${steps} steps)` : ''}${rep ? ` · ${rep}` : ''}`, !!plan.report.standIns.length);
    },
  };

  // ---------------------------------------------------------------- drop a file on the window
  const hasFiles = (ev) => [...(ev.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragover', (ev) => { if (hasFiles(ev) && may()) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; } });
  window.addEventListener('drop', (ev) => {
    if (!hasFiles(ev) || !may()) return;
    const f = [...ev.dataTransfer.files].find(x => /\.json$/i.test(x.name) || x.type === 'application/json');
    if (!f) return;
    ev.preventDefault(); Sh.importFile(f);
  });

  // ---------------------------------------------------------------- starter builds (the repo's starter/ folder)
  Sh.starters = async () => {
    if (Sh._starters) return Sh._starters;
    try { const r = await fetch(new URL('starter/index.json', document.baseURI)); const j = r.ok ? await r.json() : null; Sh._starters = Array.isArray(j?.builds) ? j.builds.filter(b => b && /^[a-z0-9][a-z0-9-]{0,60}\.turnip\.json$/.test(b.file)).map(b => ({ file: b.file, name: String(b.name || b.file).slice(0, 60), about: String(b.about || '').slice(0, 200) })) : []; }
    catch { Sh._starters = []; }
    return Sh._starters;
  };
  Sh.useStarter = async (file) => {
    const list = await Sh.starters(), b = list.find(x => x.file === file || x.name.toLowerCase() === String(file).toLowerCase());
    if (!b) { app.toast('No such starter build', true); return false; }
    const r = await fetch(new URL(`starter/${b.file}`, document.baseURI)).catch(() => null);
    if (!r?.ok) { app.toast('That starter build could not be loaded', true); return false; }
    return Sh.importText(await r.text(), { from: 'starter' });
  };

  // ---------------------------------------------------------------- Settings ▸ Campaign admin ▸ Shared builds
  Sh.adminGroupHtml = () => {
    const links = Sh.myLinks || [], st = Sh._starters || [];
    return `<div class="sab"><button class="sbtn primary" data-shact="pick">${icon('package', 15)} Import a shared build (.turnip.json)…</button></div>
      ${st.length ? `<p class="snote">Starter builds:</p><div class="sab">${st.map(b => `<button class="sbtn" data-starter="${esc(b.file)}" title="${esc(b.about)}">${esc(b.name)}</button>`).join('')}</div>` : ''}
      ${links.length ? `<p class="snote">Your share links:</p><ul class="slist">${links.map(l => `<li data-link="${esc(l.id)}"><b>${esc(l.name)}</b><small>${esc(KIND_WORD[l.kind] || l.kind)} · ${new Date(l.at).toLocaleDateString()}</small><button class="sbtn" data-shact="copy">Copy link</button><button class="sbtn danger" data-shact="delete">Delete</button></li>`).join('')}</ul>` : ''}`;
  };
  Sh.wireAdmin = (root, rerender) => {
    root.querySelector('[data-shact=pick]')?.addEventListener('click', () => Sh.pickFile());
    for (const b of root.querySelectorAll('[data-starter]')) b.onclick = () => { app.settings?.close?.(); Sh.useStarter(b.dataset.starter); };
    for (const li of root.querySelectorAll('li[data-link]')) {
      li.querySelector('[data-shact=copy]').onclick = () => copy(Sh.urlOf(li.dataset.link), 'Share link copied');
      li.querySelector('[data-shact=delete]').onclick = async () => { await Sh.deleteLink(li.dataset.link); rerender?.(); };
    }
    if (!Sh._adminLoaded) { Sh._adminLoaded = true; Promise.all([Sh.refreshLinks(), Sh.starters()]).then(() => { Sh._adminLoaded = false; rerender?.(); }); }
  };

  // ---------------------------------------------------------------- "Use in my campaign" (?share=<id>)
  const want = new URLSearchParams(location.search).get('share');
  if (want && SHARE_LINK_RE.test(want)) {
    const t0 = Date.now();
    const go = () => {
      if (Date.now() - t0 > 120000) return;
      if (!(app.ready?.() && app.sync?.campaign && app.view?.() && app.roomgen)) return setTimeout(go, 400);
      try { const u = new URL(location.href); u.searchParams.delete('share'); history.replaceState(history.state, '', u); } catch { }
      if (!may()) { app.toast('Only the GM can import a shared build into this campaign', true); return; }
      Sh.importLink(want);
    };
    setTimeout(go, 400);
  }
  return Sh;
}

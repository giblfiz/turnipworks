// Turnip Works area client. The renderer is a VIEW of state; every change goes out through app.dispatch →
// ClientSync.submit (the one door). Surfaces (command bar, selection ring, hotkeys, shortcut sheet, roster, chat)
// are generated from ONE command registry (registry.js + commands.js) and call the actions defined here.
//
// URL: #s=<seat token>   ?relay=<base> (default same-origin /api/tw-relay)   ?tuner=<deployed tuner base> (default ../../tuner/)
//      ?api=<ratings API> (default /api/tw-ratings; '' = none)   ?nofx (no lighting/fire: light tests)   ?nopost (fires, no post stack)
//      ?transport=ws|sse   ?lag=50-400&loss=0.2 (simulated network)   ?theme=light|dark   ?boxes (no meshes: light tests)
//      ?nointro (no first-visit pantomime)
import { installFeedbackHook } from './feedback-hook.js'; // first: its error listeners are up before anything else runs (Settings ▸ Feedback)
import * as THREE from 'three';
import { campaignName } from '../core/campaign-names.js';
import { rememberedGames, rememberGame, dropGame, forgetGames, renderGames, gamesAddress, openGames } from './games.js';
import { ClientSync } from '../core/client-sync.js';
import { autoTransport } from '../core/transport.js';
import { withNetSim } from '../core/netsim.js';
import { PresenceSender, PresenceView } from '../core/presence.js';
import { makeRoomGen, SOLVER_OPTS } from '../core/roomgen.js';
import { REGISTRY, turnPlan, canTilt, applyArea, roomPlayerPawns, HIDE_ROOM_HIDES_PLAYER_PAWNS } from '../core/commands.js';
import { quatOfEntity, rollQuat, foldTurn, Q_ID } from '../core/orient.js';
import { ROLL_AXIS } from './commands.js';
import { newArea } from '../core/state.js';
import { newId } from '../core/ids.js';
import { damageAfter, damageOf } from '../core/pawn.js';
import * as FP from '../core/footprint.js';
import * as HT from '../core/height.js';
import * as TILES from './tiles.js';
import { createThumbs } from './thumbs.js';
const { isFloorCat, tileSize, tilesAt, TILE } = TILES;
import { T, loadTuner } from './tuner.js';
import { AreaWorld, PAWN_BEAM } from './world.js';
import { createInteraction } from './interact.js';
import { View, swapPoses } from './views.js';
import { createAssets } from './assets.js';
import { createPreviews } from './previews.js';
import { createRegistry } from './registry.js';
import { defineCommands } from './commands.js';
import { installInput } from './input.js';
import { installEdgePan } from './edgepan.js';
import { createModes } from './modes.js';
import { copyText, parseClip, clipFrom } from './clipboard.js';
import { parseDice, rollDice } from './dice.js';
import { barSurface } from './surfaces/bar.js';
import { ringSurface } from './surfaces/ring.js';
import { ringLabSurface } from './surfaces/ringlab.js';
import { labelLabSurface } from './surfaces/labellab.js';
import { keysSurface } from './surfaces/keys.js';
import { rosterSurface } from './surfaces/roster.js';
import { chatSurface } from './surfaces/chat.js';
import { announceSurface } from './surfaces/announce.js';
import { diceSurface } from './surfaces/dice.js';
import { crumbsSurface } from './surfaces/crumbs.js';
import { buildSurface } from './surfaces/build.js';
import { pawnsSurface } from './surfaces/pawns.js';
import { traySurface } from './surfaces/tray.js';
import { createFigures, loadFigureList } from './figures.js';
import { teachBar, teachFigures } from './barwords.js';
import { installPawns } from './pawns.js';
import { settingsSurface, prefFaces } from './surfaces/settings.js';
import { cursorSurface } from './surfaces/cursor.js';
import { labelsSurface } from './surfaces/labels.js';
import { undoChipsSurface } from './surfaces/undochips.js';
import { floorDropSurface } from './surfaces/floordrop.js';
import { cutSurface } from './surfaces/cut.js';
import { fpsSurface } from './surfaces/fps.js';
import { createGraphics } from './graphics.js';
import { areasSurface } from './surfaces/areas.js';
import { turnsSurface } from './surfaces/turns.js';
import { xraySurface } from './surfaces/xray.js';
import { lightReachSurface } from './surfaces/lightreach.js';
import { rulersSurface } from './surfaces/rulers.js';
import { installStairs } from './stairs.js';
import * as ST from '../core/stairs.js';
import { buildTaxonomy } from './taxonomy.js';
import { packRooms } from './pack.js';
import { planOps, genOf, roomsOfBuilding } from '../core/buildplan.js';
import { createLibrary } from './library.js';
import { planFactionChange } from '../core/factions.js';
import { setupFactionUI } from './surfaces/factions.js';
import { createIntro } from './intro.js';
import { installFog } from './fog.js';
import { showNotice, noticeLive, currentNotice } from './notice.js';

const qs = new URLSearchParams(location.search);
const ringLab = qs.get('ringlab') === '1';
const labelLab = qs.get('labellab') === '1'; // Label lab (surfaces/labellab.js): the label look's drawer, over its own design table when there is no seat
const V = window.TW_V || 'dev';
const relayBase = (qs.get('relay') || new URL('/api/tw-relay', location.href).href).replace(/\/$/, '');
// the game imports the deployed tuner live; where it lives depends on the site (meta tw-tuner; turnipworks.net: /look/)
const tunerBase = qs.get('tuner') || new URL(document.querySelector('meta[name="tw-tuner"]')?.content || '../../tuner/', document.baseURI).href;
const ratingsApi = qs.has('api') ? qs.get('api') : '/api/tw-ratings';
const $ = (s) => document.querySelector(s);
const CELL = 5;
const OVERVIEW_DIST = 150; // ft: beyond this camera distance a click selects whole buildings (the map detent)

// theme: dark first; light designed too. ?theme= or the "toggle theme" command (remembered per browser)
let theme = qs.get('theme') || (() => { try { return localStorage.getItem('tw.theme'); } catch { return null; } })() || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
document.documentElement.dataset.theme = theme;

// THE LOADING SCREEN lives in the page (index.html, window.twLoad; docs/UI.md "The loading screen"): this file only
// tells it what has happened. A page without it (an embed, an old cached page) gets a stand-in that does nothing.
const LOAD = window.twLoad || new Proxy({}, { get: () => () => {} });
LOAD.at('code');
const start = (token) => boot(token).catch((err) => { console.error('boot', err); LOAD.fail(err?.twKind || 'code', String(err?.message || err)); });
// Fragment-only navigation must open a fresh client, not keep the previous seat's world and connection.
addEventListener('hashchange', () => location.reload());
const hash = new URLSearchParams(location.hash.slice(1));
const recent = !ringLab && !labelLab && !hash.has('s') && !hash.has('games') ? rememberedGames()[0] : null;
const token = hash.has('s') ? hash.get('s') : recent?.token;
$('#otherGames').onclick = openGames;
if (ringLab && !token) {
  // A dedicated reusable campaign keeps experiments out of ordinary tables.
  const cached = localStorage.getItem('tw.ringlab.token');
  if (cached) { history.replaceState(null, '', `${location.pathname}${location.search}#s=${encodeURIComponent(cached)}`); start(cached); }
  else fetch(relayBase + '/campaigns', { method:'POST', body:JSON.stringify({name:'Ring lab · design table',gm:'Harry'}) })
    .then(r=>r.json()).then(r=>{if(!r?.ok)throw Error('Could not create Ring lab table');localStorage.setItem('tw.ringlab.token',r.token);history.replaceState(null,'',`${location.pathname}${location.search}#s=${encodeURIComponent(r.token)}`);start(r.token);})
    .catch(e=>LOAD.fail('relay',String(e.message||e)));
} else if (labelLab && !token) {
  // the Label lab's own reusable design table (as Ring lab's), furnished by surfaces/labellab.js
  const cached = localStorage.getItem('tw.labellab.token');
  const go = (t) => { history.replaceState(null, '', `${location.pathname}${location.search}#s=${encodeURIComponent(t)}`); start(t); };
  if (cached) go(cached);
  else fetch(relayBase + '/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Label lab · design table', gm: 'Harry' }) })
    .then(r => r.json()).then(r => { if (!r?.ok) throw Error('Could not create the Label lab table'); localStorage.setItem('tw.labellab.token', r.token); go(r.token); })
    .catch(e => LOAD.fail('relay', String(e.message || e)));
} else if (token) {
  if (recent) history.replaceState(null, '', gamesAddress(`s=${encodeURIComponent(token)}`));
  start(token);
} else {
  LOAD.off(); // the start form is its own picture
  $('#start').hidden = false;
  renderGames();
  const form = $('#newCampaign'), name = form.elements.name;
  name.value = campaignName();
  form.hidden = hash.has('games') && hash.get('games') !== 'unavailable' && rememberedGames().length > 0;
  $('#startNewCampaign').onclick = () => { form.hidden = false; name.focus(); name.select(); };
  $('#rerollCampaign').onclick = () => { name.value = campaignName(name.value); };
  $('#forgetGames').onclick = () => { forgetGames(); renderGames(); form.hidden = false; };
  addEventListener('storage', (ev) => { if (ev.key === 'tw.games' || ev.key === null) renderGames(); });
  if (hash.get('games') === 'unavailable') {
    $('#gameNotice').textContent = 'That remembered game is no longer available; it has been forgotten.';
    // A reload should show the ordinary list, not repeat an old rejection notice.
    history.replaceState(null, '', gamesAddress());
  }
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const submit = form.querySelector('[type=submit]');
    if (submit.disabled) return;
    submit.disabled = true;
    const f = new FormData(form);
    let r = null;
    try { r = await fetch(relayBase + '/campaigns', { method: 'POST', body: JSON.stringify({ name: f.get('name').trim() || campaignName(), gm: f.get('gm') }) }).then(r => r.json()); } catch { }
    submit.disabled = false;
    if (!r?.ok) { $('#gameNotice').textContent = 'The table could not be reached. Try again in a moment.'; return; }
    // Full address: a bare #s resolves against <base>, which broke invite links at the site's root.
    history.replaceState(null, '', gamesAddress(`s=${encodeURIComponent(r.token)}`));
    $('#start').hidden = true; LOAD.again('Opening your table');
    start(r.token);
  });
}

async function boot(token) {
  let wasRemembered = rememberedGames().some(g => g.token === token);
  $('#app').hidden = false;
  const [, typesData] = await Promise.all([loadTuner(tunerBase, ratingsApi), fetch(`data/types.json?v=${V}`).then(r => r.json()).catch(() => ({ genres: [{ key: 'fantasy', label: 'Fantasy' }], types: [] }))]);
  const { lib } = T;
  LOAD.at('look'); // the look (the tuner's code and lists) is here; next the table itself
  const roomgen = makeRoomGen({ solver: T.solver, solver2: T.solver2, walls: T.walls, lib, types: T.types, orient: T.orient, version: T.version, newId });
  const sizeOf0 = roomgen.sizeOf; roomgen.sizeOf = (cat, sku) => isFloorCat(cat) ? tileSize(lib, cat, sku) : sizeOf0(cat, sku); // floors place as 5-ft tiles (client/tiles.js)
  // ?faces=1500 (tests and slow machines only): a lighter LOD tier than the tuner's default 10k
  const facesWanted = qs.get('faces') || prefFaces(); // ?faces= wins; else Settings ▸ Me ▸ Graphics (applies at load)
  const assets = createAssets({ base: tunerBase, dials: facesWanted && facesWanted !== T.look.LOOK_DIALS.faces ? { ...T.look.LOOK_DIALS, faces: facesWanted } : null });
  if (qs.has('boxes')) assets.visualFor = async () => null; // tests: catalog boxes only
  // FIGURES (client/figures.js): the list is data; a mesh loads only when a pawn on the table wears it
  assets.figures = createFigures({ list: teachFigures(await loadFigureList(tunerBase, T.v === 'dev' ? `dev${Date.now()}` : T.v)), base: tunerBase, look: assets.look, scale: T.house.figures });
  const canvas = $('#c');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (err) { throw Object.assign(new Error(`no WebGL: ${err?.message || err}`), { twKind: 'webgl' }); }
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.autoClear = false;
  const previews = createPreviews({ canvas: $('#pv'), assets });

  const baseTransport = autoTransport({ wsUrl: relayBase.replace(/^http/, 'ws') + '/ws', httpBase: relayBase, prefer: qs.get('transport') });
  let transport = baseTransport;
  const lag = qs.get('lag');
  if (lag) { const [a, b] = lag.split('-').map(Number); transport = withNetSim(transport, { minMs: a, maxMs: b ?? a, loss: +(qs.get('loss') || 0) }); }

  const taxonomy = buildTaxonomy({ lib, roomTypes: T.types, data: typesData, usable: (k) => T.solver.skuUsable(k, SOLVER_OPTS) });
  const app = window.tw = {
    notice: () => currentNotice(), // the operator's banner showing now, or null (notice.js)
    assets, roomgen, previews, lib, taxonomy, worlds: new Map(), views: [], main: null, pip: null,
    sel: new Set(), hover: null, mode: null, cursor: null, localDrags: new Map(), clip: null,
    pv: new PresenceView(), beforeViews: [], applied: [], waiting: new Map(), listeners: new Set(), chatSeen: new Map(), theme,
    relayBase, transport: () => baseTransport.kind, stats: { frames: 0 }, fps: 0, footprint: FP, facesUsed: facesWanted || T.look.LOOK_DIALS.faces,
  };
  app.tunerBase = tunerBase; // (the ring's painted icons: assets/ui-icons/manifest.json)
  if (ringLab) { app.ringLabTunerBase = tunerBase; app.ringLabRatingsApi = ratingsApi; }
  // FRAME-TIME SWITCHES (2026-10-06): each fix of the big-map work can be switched off to measure against it or to get
  // out of it: tw.perf.set({ aoList: false }), ?perfoff=sleep, or ?perf=off for all of them. world.js PERF has the list.
  const perfWant = qs.get('perf') === 'off' ? Object.fromEntries(Object.keys(AreaWorld.PERF).map(k => [k, false])) : {};
  for (const [q, v] of [['perfoff', false], ['perfon', true]]) for (const k of (qs.get(q) || '').split(',')) if (k in AreaWorld.PERF) perfWant[k] = v; // ?perfoff=sleep, ?perfon=lightSlots: one at a time
  if (qs.get('roofsurface') === 'painted') AreaWorld.ROOF_SURFACE = 'painted'; // the roofs' old flat surface, to compare (surfaces/cut.js app.roofSurface)
  if (['near', 'far'].includes(qs.get('rooftier'))) AreaWorld.ROOF_TIER = qs.get('rooftier'); // (measurements)
  app.perf = { get: () => ({ ...AreaWorld.PERF, ...perfWant }), set: (p) => { Object.assign(perfWant, p); for (const w of app.worlds.values()) w.setPerf(perfWant); return app.perf.get(); } };
  app.freezeTime = (on = true) => { app.frozenAt = on ? performance.now() : null; };
  const sync = app.sync = new ClientSync({
    token, transport,
    onChange: (area, v) => onAreaChange(area, v),
    onEntry: (e) => { app.emit('entry', e); app.applied.push([e.area, e.seq, e.cid, e.type]); if (app.applied.length > 5000) app.applied.splice(0, 1000); if (e.type === 'token.move' || e.type === 'object.move' || e.type === 'batch' || e.type === 'room.move' || e.type === 'room.rotate') for (const d of [...app.pv.seats.values()]) if (d.seat === e.by) app.pv.endDrag(e.area, e.by); },
    onPresence: (m) => { app.gfx?.wake('net'); if (m.ping && m.cursor) app.showPing(m); else app.pv.ingest(m); }, // (another seat's cursor is moving: not idle, graphics.js)
    onCampaign: (c) => onCampaign(c),
    onNack: (m) => { app.toast(`Refused: ${m.why}`, true); app.waiting.get(m.cid)?.(null); },
    onAck: (m) => app.waiting.get(m.cid)?.(m),
    onWhisper: (m) => app.emit('whisper', m), // a private line for this seat (surfaces/chat.js)
    onNotice: (m) => showNotice(m), // the operator's banner before a release roll (notice.js)
    onStatus: (s) => { netStatus(s); if (s === 'live') noticeLive(); app.refresh(); },
  });
  // THE CONNECTION, for the loading screen: a first connection that does not come says so (and keeps trying); a
  // connection lost later (the relay restarts on every deploy) is a small "reconnecting" pill, gone when it is back
  let everLive = false; const bootAt = performance.now(); let relayTimer = null, loadUp = true; // loadUp: the loading screen is waiting for the main area's first real frame (the first load, then each travel)
  function netStatus(s) {
    if (s === 'live') { rememberGame(token, sync.campaign, true); wasRemembered ||= rememberedGames().some(g => g.token === token); clearTimeout(relayTimer); relayTimer = null; if (!everLive) { everLive = true; LOAD.at('welcome', loadKey); } else LOAD.clear('net'); return; }
    if (s === 'denied' || s === 'closed') { clearTimeout(relayTimer); LOAD.clear('net'); if (s === 'denied') {
      if (ringLab && localStorage.getItem('tw.ringlab.token') === token) {
        localStorage.removeItem('tw.ringlab.token'); dropGame(token);
        location.replace(location.pathname + location.search); return;
      }
      if (labelLab && localStorage.getItem('tw.labellab.token') === token) { localStorage.removeItem('tw.labellab.token'); dropGame(token); location.replace(location.pathname + location.search); return; }
      if (wasRemembered || rememberedGames().some(g => g.token === token)) { dropGame(token); location.replace(gamesAddress('games=unavailable')); }
      else LOAD.fail('denied');
    } return; } // (the seat is gone or the link is bad: nothing more will come)
    if (everLive) LOAD.wait('net', 'The table is reconnecting…', { delay: 500 });
    else if (!relayTimer) relayTimer = setTimeout(() => { if (!everLive) LOAD.fail('relay', `no answer from ${relayBase} after ${Math.round(performance.now() - bootAt)} ms`); }, RELAY_PATIENCE_MS);
  }
  let loadKey = 0; for (const ch of token) loadKey = (loadKey * 31 + ch.charCodeAt(0)) >>> 0; loadKey = loadKey.toString(36); // (which table this browser's remembered "setting out" time is for; not the token)
  const ps = app.ps = new PresenceSender((p) => sync.presence(p.area, p));

  // ---------- basic accessors ----------
  Object.assign(app, {
    area: () => app.main?.area,
    view: (t = app.main?.area) => sync.view(t),
    entities: (t = app.main?.area) => sync.view(t)?.entities || {},
    ent: (id, t) => id?.startsWith?.('wall:') ? app.wallItem(id) : id?.startsWith?.('roof:') ? app.roofItem(id) : app.entities(t)[id],
    me: () => sync.me,
    gm: () => sync.campaign?.my.role === 'gm',
    // what this seat may do (the relay decides; this only hides what would be refused)
    can: (cls) => !!sync.campaign?.my.classes.includes(cls),
    seatColor: (seat) => sync.campaign?.seats.find(s => s.id === seat)?.color || '#e0b04a',
    figures: assets.figures,
    myColor: () => app.seatColor(sync.me),
    areaName: (id) => sync.campaign?.areas.find(t => t.id === id)?.name || '(hidden)',
    overview: () => (app.main?.grab.dist || 0) > OVERVIEW_DIST,
  });
  // WORKED OUT ONCE PER STATE, NOT ONCE PER FRAME (big maps, 2026-10-06). The area's entities are a new object after every
  // change and the same object until then, so anything derived from them (the list of rooms, the pawns, a building's
  // rooms) is kept against that object. Per-frame code that used to walk every entity to find the rooms asks here.
  const derivedOf = new WeakMap();
  app.derived = (name, fn, ents = app.entities()) => { let m = derivedOf.get(ents); if (!m) derivedOf.set(ents, m = new Map()); let v = m.get(name); if (v === undefined) m.set(name, v = fn(ents)); return v; };
  app.roomList = (ents = app.entities()) => app.derived('rooms', (E) => Object.values(E).filter(e => e.kind === 'room'), ents);
  app.pawnList = (ents = app.entities()) => app.derived('pawns', (E) => Object.values(E).filter(e => e.kind === 'token'), ents);
  app.roomsByBuilding = (ents = app.entities()) => app.derived('byBuilding', (E) => { const m = new Map(); for (const r of app.roomList(E)) if (r.building) { const a = m.get(r.building); if (a) a.push(r); else m.set(r.building, [r]); } return m; }, ents);
  const labelPts = new WeakMap(); // a room's label point (the middle of the largest rectangle inside it), per recipe object
  app.labelPointOf = (rc) => { let p = labelPts.get(rc); if (!p) labelPts.set(rc, p = FP.labelPoint(rc)); return p; };
  // may this seat touch (move/edit) this thing at all? (players: their own pawns, and opening things)
  app.canTouch = (e) => {
    if (!e) return false;
    if (app.gm()) return true;
    if (e.kind === 'token') return e.owner === sync.me; // (a pawn has no lock: dropped 2026-10-11, core/commands.js unlockPawn)
    return false;
  };
  app.canOpen = (e) => e?.kind === 'object' && assets.openable(e.cat) && !e.locked && (app.gm() || app.can('open'));

  // ---------- worlds and views ----------
  const syncedAt = new Map(), waiting = new Map(); // area -> the frame it was last brought up to date in; area -> the newest view not yet applied
  function worldOf(area) { if (waiting.size) flushSyncs(area); return rawWorldOf(area); } // (a reader sees every change that has arrived)
  function rawWorldOf(area) {
    if (!app.worlds.has(area)) {
      const w = new AreaWorld(area, { roomgen, assets, renderer, camera: app.main.camera, focus: () => app.main?.grab.focus, fx: !qs.has('nofx') });
      w.setPerf(app.perf.get()); w.busy = () => !!app.interact?.busy();
      if (w.fx) { w.fx.setSize(canvas.clientWidth, canvas.clientHeight); if (qs.has('nopost')) { w.fx.lighting.params.on = false; w.fx.lighting.apply(); } }
      app.worlds.set(area, w);
    }
    return app.worlds.get(area);
  }
  app.worldOf = worldOf;
  // Settings ▸ Me ▸ Graphics: a new geometry tier applies at once, every world's visuals swapped in place (no reload)
  app.setFaces = (faces) => { faces = String(faces); if (!faces || faces === String(app.facesUsed)) return false; assets.setFaces(faces); app.facesUsed = faces; for (const w of app.worlds.values()) w.refreshVisuals?.(); app.refresh(); return true; };
  app.THREE = THREE; // (tests)
  app.tiles = TILES; // floor tiles (client/tiles.js), for the paint tool and tests
  // A BURST OF CHANGES IS DRAWN ONCE (big maps, 2026-10-06). Bringing the scene up to date with the state looks at every
  // room and thing of the area, so a join that replays hundreds of entries, an AI seat building a street, or several
  // people moving at once used to do that once PER ENTRY inside one frame. Now the first change of a frame is applied
  // at once (a single action is as immediate as ever) and any more that arrive before the next frame are applied
  // together when it starts. Nothing can see the gap: every reader of a world comes through app.worldOf, which applies
  // what is waiting first.
  function flushSyncs(only = null) { if (!waiting.size) return; for (const [area, v] of [...waiting]) { if (only && area !== only) continue; waiting.delete(area); applyChange(area, v); } }
  function onAreaChange(area, v) {
    if (syncedAt.get(area) === app.stats.frames && app.worlds.has(area) && v) { waiting.set(area, v); app.syncsHeld = (app.syncsHeld || 0) + 1; app.emit('change', area); app.refresh(); return; } // (only the SCENE waits for the next frame: whoever listens for the state hears of every change at once, the chat's announcements for one)
    waiting.delete(area); applyChange(area, v);
  }
  function applyChange(area, v) {
    if (v && area === app.main?.area) LOAD.at('state'); // the area's state is here; setting it out and the first frame are next (the page is busy until then)
    syncedAt.set(area, app.stats.frames);
    const w = rawWorldOf(area);
    const fresh = w.sync(app.fog?.sceneView(v) ?? v, { gmSide: app.gm() && !app.fog?.preview() });
    app.fog?.update(area, w, v);
    // a room that just arrived plays the tuner's spawn-in (floor, walls, furniture; camera-side walls last); a re-rolled
    // room brings its new furniture in. Purely local: only the room command synced.
    if (v) for (const rid of [...fresh.rooms, ...fresh.rerolled]) {
      const ids = fresh.objects.filter(id => v.entities[id]?.room === rid);
      w.animateRoom(rid, ids, app.main?.camera, { shell: fresh.rooms.includes(rid) });
    }
    for (const id of [...app.sel]) if (!app.ent(id, area) && area === app.area()) app.sel.delete(id);
    app.emit('change', area);
    app.refresh();
  }
  const rectOf = (r) => ({ x0: r.recipe.x * CELL, z0: r.recipe.z * CELL, x1: (r.recipe.x + r.recipe.w) * CELL, z1: (r.recipe.z + r.recipe.d) * CELL });
  app.rectOf = rectOf;

  function onCampaign(c) {
    rememberGame(token, c);
    if (!app.main) { const start = c.areas.find(t => t.id === c.my.location) || c.areas[0]; if (start) app.setMain(start.id); }
    if (app.main && !c.areas.some(t => t.id === app.main.area) && c.areas[0]) app.setMain(c.areas[0].id);
    if (app.pip && !c.areas.some(t => t.id === app.pip.area)) app.closePip();
    for (const w of app.worlds.values()) w.refreshPawnColours?.(); // a seat changed its colour: its pawns' rims follow
    app.refresh();
  }
  app.setMain = (area) => {
    if (!area || area.startsWith('lib:')) return; // only a campaign area can be the main view
    const prev = app.main?.area;
    if (!app.main) { app.main = new View({ area, rule: 'free', dom: canvas }); app.views.unshift(app.main); }
    app.main.area = area;
    if (prev !== area) {
      if (prev && prev !== app.pip?.area) sync.unsubscribe(prev);
      sync.subscribe(area);
      if (prev && !sync.view(area)) { loadUp = true; LOAD.wait('travel', `Travelling to ${app.areaName?.(area) || 'the area'}`, { delay: TRAVEL_GRACE_MS }); } // an area not loaded yet: the loading screen, if it takes more than a moment. (loadUp is set HERE, not by a frame noticing the empty view: the state can arrive before any frame is drawn, and the screen would then come up after the area's first frame and never leave)
      if (sync.campaign && sync.campaign.my.location !== area) sync.submit('seat.locate', { area });
      app.sel.clear(); app.mode = null;
    }
    app.refresh();
  };
  app.openPip = (area, follow = null) => {
    if (!app.pip) { app.pip = newPip({ area, rule: 'follow', rect: app.pipRect(), follow }); app.views.push(app.pip); }
    if (app.pip.area !== area && app.pip.area !== app.main?.area && !app.pip.area.startsWith('lib:')) sync.unsubscribe(app.pip.area);
    Object.assign(app.pip, { area, follow, rule: 'follow' });
    sync.subscribe(area);
    app.refresh();
  };
  // every view is a full viewport: the PiP's camera measures the pointer against the PiP's own rectangle on screen
  const pipDom = { getBoundingClientRect: () => { const r = canvas.getBoundingClientRect(), [l, t, w, h] = app.pip?.rect || [0, 0, 1, 1]; return { left: r.left + l * r.width, top: r.top + t * r.height, width: w * r.width, height: h * r.height, right: r.left + (l + w) * r.width, bottom: r.top + (t + h) * r.height }; } };
  const newPip = (opts) => { const v = new View({ ...opts, dom: canvas }); v.grab.dom = pipDom; return v; };
  // a PiP of a LOCAL area (the Build menu's library shelves): nothing to subscribe to, its camera is flown by library.js
  app.openLocalPip = (area) => {
    if (app.pip && app.pip.area !== area && !app.pip.area.startsWith('lib:') && app.pip.area !== app.main?.area) sync.unsubscribe(app.pip.area);
    if (!app.pip) { app.pip = newPip({ area, rule: 'library', rect: app.pipRect() }); app.views.push(app.pip); }
    Object.assign(app.pip, { area, follow: null, rule: 'library' });
    app.refresh();
  };
  app.closePip = () => { if (!app.pip) return; if (app.pip.area !== app.main?.area && !app.pip.area.startsWith('lib:')) sync.unsubscribe(app.pip.area); app.views = app.views.filter(v => v !== app.pip); app.pip = null; app.refresh(); };
  app.swapPip = () => { if (!app.pip || app.pip.area.startsWith('lib:')) return; /* the library shelves never become the main view */ const a = app.main.area, b = app.pip.area; swapPoses(app.main, app.pip, canvas.clientWidth, canvas.clientHeight); /* each area keeps its own camera (Harry 2026-10-05) */ app.pip.area = a; app.pip.follow = null; app.pip.rule = 'pinned'; app.setMain(b); sync.subscribe(a); };
  $('#pipSwap').onclick = app.swapPip; $('#pipClose').onclick = app.closePip;
  // the PiP is a window: drag it by its title bar, resize it from the edges and corners (kept on screen, at least
  // MIN px), double-click the title bar for a bigger window and back; its place and size are remembered per seat
  const PIP_DEFAULT = [0.64, 0.5, 0.34, 0.42], PIP_BIG = [0.3, 0.12, 0.68, 0.84], MIN = [240, 160], PIP_EDGE = 22;
  const pipKey = () => `tw.pip.${sync.campaign?.id || '-'}.${sync.me || '-'}`;
  app.pipRect = () => { try { const r = JSON.parse(localStorage.getItem(pipKey()) || 'null'); if (Array.isArray(r?.rect) && r.rect.length === 4) return clampRect(r.rect.slice()); } catch { } return clampRect(PIP_DEFAULT.slice()); };
  const savePip = (extra = {}) => { try { const prev = JSON.parse(localStorage.getItem(pipKey()) || '{}'); localStorage.setItem(pipKey(), JSON.stringify({ ...prev, rect: app.pip.rect, ...extra })); } catch { } };
  function clampRect([l, t, w, h]) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    w = Math.min(1, Math.max(MIN[0] / W, w)); h = Math.min(1, Math.max(MIN[1] / H, h));
    const top = 58 / H, edge = PIP_EDGE / W; // its title bar stays clear of the command bar; the left strip is the level meter's (always visible: surfaces/cut.js)
    w = Math.min(w, 1 - edge); h = Math.min(h, 1 - top);
    return [Math.min(1 - w, Math.max(edge, l)), Math.min(1 - h, Math.max(top, t)), w, h];
  }
  const frameEl = $('#pipFrame');
  frameEl.addEventListener('pointerdown', (ev) => {
    const handle = ev.target.closest('.rz'), bar = !handle && ev.target.closest('.bar');
    if (!app.pip || (!handle && !bar) || ev.target.closest('button') || ev.button !== 0) return;
    ev.preventDefault(); ev.stopPropagation();
    const W = canvas.clientWidth, H = canvas.clientHeight, r0 = app.pip.rect.slice(), x0 = ev.clientX, y0 = ev.clientY, d = handle?.dataset.d || 'move';
    const move = (e) => {
      const dx = (e.clientX - x0) / W, dy = (e.clientY - y0) / H;
      let [l, t, w, h] = r0;
      const mw = MIN[0] / W, mh = MIN[1] / H, top = 58 / H;
      if (d === 'move') { app.pip.rect = clampRect([l + dx, t + dy, w, h]); moved = true; return; }
      // resizing: the opposite edge stays put; the dragged edge stops at the screen's edge and at the minimum size
      if (d.includes('e')) w = Math.max(mw, Math.min(1 - l, r0[2] + dx));
      if (d.includes('s')) h = Math.max(mh, Math.min(1 - t, r0[3] + dy));
      if (d.includes('w')) { const right = r0[0] + r0[2]; l = Math.max(PIP_EDGE / W, Math.min(right - mw, r0[0] + dx)); w = right - l; }
      if (d.includes('n')) { const bottom = r0[1] + r0[3]; t = Math.max(top, Math.min(bottom - mh, r0[1] + dy)); h = bottom - t; }
      app.pip.rect = [l, t, w, h]; moved = true;
    };
    let moved = false;
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); if (moved) savePip({ big: false }); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  });
  frameEl.querySelector('.bar').addEventListener('dblclick', (ev) => {
    if (!app.pip || ev.target.closest('button')) return;
    let st = {}; try { st = JSON.parse(localStorage.getItem(pipKey()) || '{}'); } catch { }
    if (st.big) { app.pip.rect = clampRect(st.normal || PIP_DEFAULT); savePip({ big: false }); }
    else { const normal = app.pip.rect.slice(); app.pip.rect = clampRect(PIP_BIG); savePip({ big: true, normal }); }
  });

  // ---------- events for surfaces ----------
  app.on = (fn) => { app.listeners.add(fn); return () => app.listeners.delete(fn); };
  app.emit = (what, data) => { for (const fn of app.listeners) fn(what, data); };
  // what the picture costs, per viewer: the Graphics switches, the idle rate, Auto (graphics.js)
  app.gfx = createGraphics(app, { renderer, canvas, busy: () => loadUp || waiting.size > 0 });
  app.diceRenderer = renderer; // (surfaces/dice.js: its test-only in-frame A/B)
  // my selection goes out in presence: every other seat sees it outlined faintly in my colour (world.js remote signals)
  app.on((what) => { if (what === 'selection' && app.area() && app.ps) app.ps.set(app.area(), { cursor: app.cursor || null, drag: null, sel: [...app.sel] }); });
  let refreshQueued = false;
  app.refresh = () => { if (refreshQueued) return; refreshQueued = true; queueMicrotask(() => { refreshQueued = false; app.emit('refresh'); }); };
  installFog(app);
  installFeedbackHook(app, { renderer, tunerVersion: () => T.v }); // errors are sent silently; every ticket's context (feedback-hook.js)
  let toastTimer = null;
  app.toast = (msg, bad = false) => { const t = $('#toast'); t.textContent = msg; t.classList.toggle('bad', bad); t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); };

  // ---------- dispatch: the one door ----------
  app.dispatch = (type, args, area = app.area()) => {
    if (REGISTRY[type].level !== 'area') return sync.submit(type, args);
    if ([args?.id, ...(args?.ids || [])].some(x => typeof x === 'string' && x.startsWith('wall:'))) return app.batch([{ type, args }], area); // a generated wall/door/window
    return sync.submit(type, args, area);
  };
  app.batch = (ops, area = app.area()) => {
    ops = ops.filter(Boolean);
    const ex = app.expandWallOps(ops); ops = ex.ops;
    if (ex.map.size) { app.sel = new Set([...app.sel].map(id => ex.map.get(id) || id)); queueMicrotask(() => { app.emit('selection'); app.refresh(); }); }
    if (!ops.length) return null;
    return ops.length === 1 ? sync.submit(ops[0].type, ops[0].args, area) : sync.submit('batch', { ops }, area);
  };
  app.await = (cid) => new Promise((resolve) => { if (!cid) return resolve(null); app.waiting.set(cid, (m) => { app.waiting.delete(cid); resolve(m); }); setTimeout(() => app.waiting.has(cid) && (app.waiting.delete(cid), resolve(null)), 15000); });
  // ids touched by my unconfirmed commands (the shimmer)
  app.pendingIds = (area = app.area()) => {
    const Tb = sync.areas.get(area); const out = new Set();
    for (const c of Tb?.pending || []) { if (NO_SHIMMER.has(c.type)) continue; for (const id of REGISTRY[c.type].touches?.(c.args, Tb.confirmed) || []) out.add(id); }
    return out;
  };

  // ---------- selection & hierarchy (building ▸ room ▸ object ▸ things on it) ----------
  // Walls, doors and windows are ordinary OBJECTS (Harry 2026-10-04). The room generator still makes them (the shell is
  // derived from the rooms), and a generated piece reads as an object: selection, ring, keys and every object action.
  // The first change to one MATERIALIZES it, inside the same command: an edge override hides the generated piece
  // (edge.set as 'open') and an ordinary object takes its place, then the change applies to that object; so one undo
  // puts the generated piece back. Delete just deletes it (the override alone: nothing replaces it).
  // Re-roll regenerates a room's generated pieces; a materialized (edited) piece stays, the way pinned props do.
  // A ROOF IS SELECTABLE LIKE A ROOM (Harry 2026-10-05: "A roof is basically a kind of room"). It is derived, not an
  // entity, so its selection is 'roof:<room id>': something with the room's roof choices on it. It exists only while it
  // is drawn (Roofs on, and the cut not below it); its commands write room.roof through room.set.
  app.roofItem = (id) => {
    const rid = id.slice(5), room = app.entities()[rid], w = app.worldOf(app.area()), rec = w?.roofRecs?.get(rid);
    if (!room || !rec || !app.roofs || !w.roofShown(rec)) return undefined;
    const b = rec.box;
    return { id, kind: 'roof', room: rid, building: room.building || null, name: `${app.nameOf(room)} roof`, style: rec.roof.style, own: room.roof?.style || null, seed: room.roof?.seed ?? room.recipe.seed, locked: !!room.locked, hidden: !!room.hidden, x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2, y: rec.roof.top };
  };
  app.wallItem = (id) => {
    const key = id.slice(5), w = app.worldOf(app.area()), e = w.edgeAt?.(key);
    // a piece storeys generate (2026-10-06): a bracket or post under an overhang, a railing section round a stair's hole.
    // A thing of its own, like a wall piece: its place is 'kit' for a post (it snaps like a corner post) and 'floor'
    // for the rest (a railing is furniture: it moves like furniture and never takes a wall's place)
    const gen = w.shell?.get(key)?.spec;
    if (gen?.gen) {
      if (!gen.url) return { id, kind: 'wall', key, name: gen.name };
      return { id, kind: 'object', generated: true, key, cat: gen.id, sku: gen.sku, url: gen.url, s: [1, 1, 1], dims: gen.dims.map(v => Math.round(v * 100) / 100), place: gen.gen === 'post' ? 'kit' : 'floor', layer: gen.gen === 'post' ? 'walls' : 'furnish',
        x: gen.x, y: gen.y || 0, z: gen.z, rot: gen.rot || 0, yaw: 0, name: gen.name, room: w.shell.get(key).roomId, edgeKind: gen.gen };
    }
    if (key[0] === 'c') { // a corner or jamb post (2026-10-04: everything on screen is touchable); it moves freely, like furniture
      const sp = w.shell?.get(key)?.spec;
      if (!sp) return { id, kind: 'wall', key, name: 'Post' };
      return { id, kind: 'object', generated: true, key, cat: sp.id, sku: sp.sku, url: sp.url, s: sp.s, dims: sp.dims, place: 'kit', layer: 'walls',
        x: sp.x, y: sp.y || 0, z: sp.z, rot: 0, yaw: 0, name: sp.id === 'pillar-square' ? 'Pillar' : 'Post', room: w.shell.get(key).roomId, edgeKind: 'post' }; // (y: a post upstairs, or of a tall room's upper storey, stands at its own height)
    }
    const sh = w.shell?.get(key) || w.shell?.get(key + ':door'), sp = sh?.spec;
    if (!sp || (!e && !sp.stack)) return { id, kind: 'wall', key, name: 'Wall' };
    return { id, kind: 'object', generated: true, key, cat: sp.id, sku: sp.sku, url: sp.url, s: sp.s, dims: sp.dims, place: 'kit', layer: sp.layer,
      x: sp.x, y: sp.y || 0, z: sp.z, rot: sp.rot || 0, yaw: 0, name: cap(sp.id.replace(/-/g, ' ')), room: e ? e.owner.room : sh.roomId, edgeKind: e ? e.kind : 'wall' }; // (no edge: a tall room's upper wall piece)
  };
  // ops naming 'wall:<key>' become: hide the generated piece, place an object in its place, then the op on that object
  const wallIdsIn = (op) => [op.args?.id, ...(op.args?.ids || [])].filter(x => typeof x === 'string' && x.startsWith('wall:'));
  app.expandWallOps = (ops) => {
    if (!ops.some(op => wallIdsIn(op).length)) return { ops, map: new Map() };
    const map = new Map(), out = [];
    const objFor = (wid) => {
      if (map.has(wid)) return map.get(wid);
      const it = app.wallItem(wid); if (!it.generated) return null;
      const id = newId('obj'); map.set(wid, id);
      out.push({ type: 'edge.set', args: { key: it.key, as: 'open' } });
      out.push({ type: 'object.place', args: { id, name: it.name, cat: it.cat, sku: it.sku, url: it.url, s: it.s, dims: it.dims, place: it.place || 'kit', layer: it.layer, x: r2(it.x), y: r2(it.y), z: r2(it.z), rot: it.rot, yaw: 0, room: it.room, fromEdge: it.key } });
      return id;
    };
    for (const op of ops) {
      const ws = wallIdsIn(op);
      if (!ws.length) { out.push(op); continue; }
      if (op.type === 'object.delete') { const it = app.wallItem(op.args.id); if (it.generated) out.push({ type: 'edge.set', args: { key: it.key, as: 'open' } }); continue; }
      const args = { ...op.args };
      if (args.id?.startsWith?.('wall:')) args.id = objFor(args.id);
      if (args.ids) args.ids = args.ids.map(x => x.startsWith('wall:') ? objFor(x) : x);
      if (args.id === null || args.ids?.includes(null)) continue;
      out.push({ ...op, args });
    }
    return { ops: out, map };
  };
  // turn the selected generated pieces into objects now (before a drag, so the drag can preview the real object)
  app.materializeSelection = () => {
    const ws = [...app.sel].filter(id => id.startsWith('wall:') && app.wallItem(id).generated);
    if (!ws.length) return null;
    const { ops, map } = app.expandWallOps(ws.map(id => ({ type: 'object.set', args: { id } })));
    app.batch(ops.filter(o => o.type !== 'object.set'));
    app.sel = new Set([...app.sel].map(id => map.get(id) || id)); app.emit('selection'); app.refresh();
    return map;
  };
  app.selected = () => [...app.sel].map(id => app.ent(id)).filter(Boolean);
  app.selLog = [];
  app.select = (ids, how = 'replace') => {
    ids = [].concat(ids).filter(Boolean);
    app.selLog.push([how, ids.slice(0, 3), new Error().stack.split('\n').slice(2, 4).map(l => l.trim().slice(0, 80))]); if (app.selLog.length > 20) app.selLog.shift();
    if (how === 'replace') app.sel = new Set(ids);
    else if (how === 'add') for (const id of ids) app.sel.add(id);
    else if (how === 'toggle') for (const id of ids) app.sel.has(id) ? app.sel.delete(id) : app.sel.add(id);
    app.emit('selection'); app.refresh();
  };
  app.clearSelection = () => app.select([], 'replace');
  app.parentOf = (e) => {
    if (!e) return null;
    const E = app.entities();
    if (e.kind === 'object') return E[e.parent] || E[e.room] || roomAt(e.x, e.z);
    if (e.kind === 'token') return roomAt(e.x, e.z);
    if (e.kind === 'wall') return E[e.room] || null;
    if (e.kind === 'room') return E[e.building] || null;
    return null;
  };
  app.childrenOf = (e) => {
    const all = Object.values(app.entities());
    if (!e) return [];
    if (e.kind === 'building') return all.filter(x => x.kind === 'room' && x.building === e.id);
    if (e.kind === 'room') return all.filter(x => x.kind === 'object' && x.room === e.id && !x.parent);
    if (e.kind === 'object') return all.filter(x => x.kind === 'object' && x.parent === e.id);
    return [];
  };
  app.descendants = (e) => { const out = []; const walk = (x) => { for (const c of app.childrenOf(x)) { out.push(c); walk(c); } }; walk(e); return out; };
  app.crumbs = (e) => { const out = []; let x = e; for (let i = 0; x && i < 8; i++) { out.unshift(x); x = app.parentOf(x); } return out; };
  function roomAt(x, z, y = 0) { return HT.roomAtHeight(app.entities(), x, z, y); } // at a height: the room whose floor is under the point and whose ceiling is above it (core/height.js) // the room whose floor the point is on (an L-shaped room's notch is not its floor)
  app.roomAt = roomAt;
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s; // catalog roles read 'table square': show 'Table square'
  app.nameOf = (e) => !e ? '' : e.kind === 'room' ? e.name || roomgen.typeList.find(t => t.key === e.recipe.type)?.label || e.recipe.type : e.kind === 'building' ? e.name : cap(e.name || e.cat || e.kind);
  // the three-letter tag of a thing (stable: from its id)
  app.tagOf = (id) => { let h = 2166136261; for (const c of id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; return A[h % 24] + A[(h >>> 5) % 24] + A[(h >>> 10) % 24]; };
  // what a click at this pick would select, at the current granularity
  app.selectionFor = (hit) => {
    if (!hit) return null;
    if (hit.wall) return app.overview() ? null : 'wall:' + hit.wall;
    if (hit.roof) { const r = app.entities()[hit.roof]; return app.overview() ? (app.entities()[r?.building] || r)?.id || null : 'roof:' + hit.roof; } // at the map detent a roof is its building
    const e = hit.entity; if (!e) return null;
    if (hit.floor) return null; // labels select rooms and buildings now; the floor selects nothing (Harry 2026-10-03)
    if (app.overview()) { const r = e.kind === 'room' ? e : app.parentOf(e)?.kind === 'room' ? app.parentOf(e) : roomAt(e.x, e.z, e.y || 0); const b = r && app.entities()[r.building]; return (b || r || e).id; }
    return e.id;
  };

  // ---------- actions (the commands call these) ----------
  const selOf = (pred) => app.selected().filter(pred);
  const movable = (e) => e.kind === 'token' ? app.canTouch(e) : e.kind === 'object' && app.canTouch(e) && !e.locked; // (only things lock; a pawn never)
  app.undo = () => sync.submitRaw({ type: 'undo', area: app.area(), args: {} });
  app.redo = () => sync.submitRaw({ type: 'redo', area: app.area(), args: {} });
  app.undoFor = (who) => sync.submitRaw({ type: 'undo', area: app.area(), args: { who } });
  app.deleteSelection = () => {
    const sel = app.selected().filter(e => e.kind !== 'wall' && e.kind !== 'roof');
    const ops = [];
    const gone = new Set();
    for (const e of sel) {
      if (e.kind === 'building') { for (const r of app.childrenOf(e)) { ops.push({ type: 'room.delete', args: { id: r.id } }); gone.add(r.id); } continue; }
      if (e.kind === 'room' && !gone.has(e.id)) { ops.push({ type: 'room.delete', args: { id: e.id } }); gone.add(e.id); }
    }
    for (const e of sel) {
      if (e.kind === 'object' && !gone.has(e.room)) ops.push({ type: 'object.delete', args: { id: e.id } });
      if (e.kind === 'token') ops.push({ type: 'token.delete', args: { id: e.id } });
    }
    if (ops.length) { app.batch(ops); app.clearSelection(); }
  };
  app.selectAll = () => {
    const r = app.selected()[0]?.kind === 'room' ? app.selected()[0] : (app.cursor && roomAt(app.cursor[0], app.cursor[1]));
    const ids = Object.values(app.entities()).filter(e => (e.kind === 'object' || e.kind === 'token') && (!r || (e.kind === 'object' ? e.room === r.id : roomAt(e.x, e.z)?.id === r.id))).map(e => e.id);
    app.select(ids);
  };
  // move a set of things by (dx, dz) feet as ONE step; contents ride along (moving a parent moves its contents)
  const overlapCells = FP.overlap; // by the cells the rooms stand on (core/footprint.js)
  const roomsIn = (things) => { const out = new Map(); for (const e of things) { if (e.kind === 'building') for (const r of app.childrenOf(e)) out.set(r.id, r); if (e.kind === 'room') out.set(e.id, e); } return [...out.values()]; };
  app.roomsIn = roomsIn;
  // would these rooms, each at its new rectangle (rectOf(room) in cells), overlap a room that is staying put? → that room
  app.roomClash = (rooms, rectFor) => {
    const moving = new Set(rooms.map(r => r.id)), others = Object.values(app.entities()).filter(e => e.kind === 'room' && !moving.has(e.id));
    const ents = app.entities(); // (rooms on different storeys never clash: footprints AND heights must overlap)
    for (const r of rooms) { const n = rectFor(r), y = HT.roomY(n), top = y + HT.roomHeight(ents, r), hit = others.find(o => overlapCells(o.recipe, n) && HT.spansOverlap(y, top, HT.roomY(o.recipe), HT.roomTop(ents, o))); if (hit) return { room: r, hit }; }
    return null;
  };
  app.moveBy = (things, dx, dz, { rot = null, dy = 0 } = {}) => { // dy: onto a floor at another height (things and pawns; rooms keep theirs)
    const ops = [], seen = new Set();
    const cdx = Math.round(dx / CELL), cdz = Math.round(dz / CELL);
    const rooms = roomsIn(things);
    if (rooms.length && (cdx || cdz)) {
      const clash = app.roomClash(rooms, (r) => ({ ...r.recipe, x: r.recipe.x + cdx, z: r.recipe.z + cdz }));
      if (clash) { app.toast(`Can't move ${app.nameOf(clash.room)} there: it would overlap ${app.nameOf(clash.hit)}`, true); return null; } // never a silent no-op
      // the rooms furthest along the way go first, so a building's rooms never step on each other mid-command
      for (const r of [...rooms].sort((a, b) => ((b.recipe.x + b.recipe.w / 2) * cdx + (b.recipe.z + b.recipe.d / 2) * cdz) - ((a.recipe.x + a.recipe.w / 2) * cdx + (a.recipe.z + a.recipe.d / 2) * cdz))) ops.push({ type: 'room.move', args: { id: r.id, dx: cdx, dz: cdz } });
    }
    for (const r of rooms) seen.add(r.id);
    const moving = [];
    for (const e of things) if ((e.kind === 'object' || e.kind === 'token') && !seen.has(e.room)) { moving.push(e); for (const d of app.descendants(e)) moving.push(d); }
    for (const e of new Set(moving)) {
      if (seen.has(e.id)) continue; seen.add(e.id);
      if (e.kind === 'token') {
        // A PAWN THAT LANDS ON A STAIR GOES TO ITS OTHER END (core/stairs.js): dropped on the stair from the floor it stands
        // on, it arrives on the landing upstairs; dropped on the hole from above, at the stair's foot. One move.
        const nx = e.x + dx, nz = e.z + dz, ny = (e.y || 0) + dy, fl = HT.floorUnder(app.entities(), nx, nz, ny)?.y ?? Math.min(0, ny);
        const hop = things.length === 1 && Math.abs(ny - fl) < 1 ? app.stairHop(nx, nz, fl) : null;
        if (hop) { ops.push({ type: 'token.move', args: { id: e.id, x: r2(hop.x), z: r2(hop.z), y: r2(hop.y), ...(rot != null && { rot }) } }); app.lastHop = { token: e.id, ...hop }; continue; }
        const ly = app.pawnLandY(e, nx, ny, nz); // (a pawn under 5 ft up where it arrives settles there: a float left by an old lowering too)
        ops.push({ type: 'token.move', args: { id: e.id, x: r2(nx), z: r2(nz), ...((dy || ly !== (e.y || 0)) && { y: r2(ly) }), ...(rot != null && { rot }) } });
        continue;
      }
      // a thing belongs to the room it stands in (so it turns, moves and hides with that room): keep that current
      { const now = roomAt(e.x + dx, e.z + dz, (e.y || 0) + dy)?.id || ''; ops.push({ type: 'object.move', args: { id: e.id, x: r2(e.x + dx), z: r2(e.z + dz), ...(dy && { y: r2((e.y || 0) + dy) }), ...(now !== (e.room || '') && { room: now }) } }); }
    }
    return app.batch(ops);
  };
  // turn a room by quarter turns (clockwise; -1 = anticlockwise) about its centre, its contents with it (core room.rotate).
  // A turn that would overlap another room is refused HERE, visibly: a toast and the would-be footprint in red.
  app.rotateRoom = (r, turns = 1) => {
    if (!r?.recipe) return null;
    const { rc } = turnPlan(r.recipe, ((turns % 4) + 4) % 4);
    const clash = app.roomClash([r], () => rc);
    if (clash) {
      app.toast(`Can't turn ${app.nameOf(r)}: it would overlap ${app.nameOf(clash.hit)}`, true);
      worldOf(app.area()).flashRect(rc.x * CELL, rc.z * CELL, (rc.x + rc.w) * CELL, (rc.z + rc.d) * CELL, undefined, undefined, HT.roomY(rc));
      app.lastRefusal = { what: 'room.rotate', room: r.id, hit: clash.hit.id, at: Date.now() };
      return null;
    }
    return app.dispatch('room.rotate', { id: r.id, turns });
  };
  // ARROW KEYS (Harry 2026-10-15): an arrow moves the selection one grid square (CELL = 5 ft; units 'm' only changes the
  // readouts), Shift+arrow the fine 1 ft nudge. The directions are the SCREEN's, snapped to the nearest grid axis: with the
  // camera turned 90 degrees, "up" is still toward the top of the screen. Looking nearly straight down, "up" is the camera's
  // own up, laid flat. app.arrowAxes() -> { up: [x, z], right: [x, z] } unit grid vectors.
  app.arrowAxes = (view = app.main) => {
    const m = view.camera.matrixWorld.elements, snap = (x, z) => Math.abs(x) >= Math.abs(z) ? [Math.sign(x) || 1, 0] : [0, Math.sign(z)];
    let up = [-m[8], -m[10]]; if (Math.hypot(up[0], up[1]) < 0.3) up = [m[4], m[6]]; // forward laid flat; straight down: the screen's up laid flat
    const u = snap(up[0], up[1]);
    return { up: u, right: [-u[1], u[0]] };
  };
  app.nudgeScreen = (sx, sy, ft = CELL) => { const a = app.arrowAxes(); return app.nudge((sx * a.right[0] + sy * a.up[0]) * ft, (sx * a.right[1] + sy * a.up[1]) * ft); };
  app.nudge = (dx, dz) => app.moveBy(selOf(e => movable(e) || (app.gm() && (e.kind === 'room' || e.kind === 'building'))), dx, dz);
  app.rotateSelection = (deg) => {
    const ops = [];
    for (const e of selOf(movable)) {
      const rot = (e.rot || 0) + (ST.isConnector(e) ? Math.sign(deg) * 90 : deg) * Math.PI / 180; // a stair stands on whole squares: quarter turns
      ops.push(e.kind === 'token' ? { type: 'token.move', args: { id: e.id, x: e.x, z: e.z, rot } } : { type: 'object.move', args: { id: e.id, x: e.x, z: e.z, rot } });
    }
    app.batch(ops);
  };
  app.flag = (ids, flags) => ids.length && app.dispatch('entity.flag', { ids, ...flags });
  // hide / reveal: a room or a building hides WHOLE (the command cascades to its things and wall edits: core entity.flag);
  // a thing takes what rests on it along
  app.setHidden = (things, hidden) => {
    const ids = new Set();
    for (const e of things) { if (e.kind === 'wall') continue; ids.add(e.id); if (e.kind === 'object') for (const d of app.descendants(e)) ids.add(d.id); }
    const players = hidden && !HIDE_ROOM_HIDES_PLAYER_PAWNS && app.gm()
      ? roomPlayerPawns(app.view(), [...ids], app.sync.campaign?.seats || {}) : [];
    app.flag([...ids], { hidden });
    if (players.length) {
      const place = things.length === 1 && things[0].kind === 'room' ? 'this room' : things.length === 1 && things[0].kind === 'building' ? 'this building' : 'these rooms';
      app.toast(`${players.length} player pawn${players.length === 1 ? ' is' : 's are'} in ${place}`);
    }
  };
  app.toggleOpen = (e) => app.dispatch('object.open', { id: e.id, open: !e.open });
  // DAMAGE goes through token.damage (anyone's pawn; each change leaves an undo: surfaces/undochips.js)
  app.damageDelta = (pawns, n) => app.batch(pawns.filter(p => damageAfter(p.damage, n) !== damageOf(p)).map(p => ({ type: 'token.damage', args: { id: p.id, damage: damageAfter(p.damage, n) } })));
  app.damageSet = (pawns, damage) => app.batch(pawns.filter(p => damageOf(p) !== damage).map(p => ({ type: 'token.damage', args: { id: p.id, damage } })));
  app.setMark = (pawns, mark) => app.batch(pawns.filter(p => (p.mark || '') !== mark).map(p => ({ type: 'token.mark', args: { id: p.id, mark } })));
  app.giveTo = (pawn, seat) => app.dispatch('token.owner', { id: pawn.id, owner: seat || '' });
  app.toggleCondition = (pawns, c) => { const on = !pawns.every(p => (p.conditions || []).includes(c)); app.batch(pawns.map(p => ({ type: 'token.set', args: { id: p.id, conditions: on ? [...new Set([...(p.conditions || []), c])] : (p.conditions || []).filter(x => x !== c) } }))); };
  app.rename = (e, name) => e.kind === 'token' ? app.dispatch('token.set', { id: e.id, name }) : e.kind === 'building' ? app.dispatch('building.set', { id: e.id, name }) : e.kind === 'room' ? app.dispatch('room.set', { id: e.id, name }) : app.dispatch('object.set', { id: e.id, name });
  app.replaceWith = (e, v) => {
    const sz = roomgen.sizeOf(v.cat, v.sku); if (!sz) return;
    app.dispatch('object.replace', { id: e.id, cat: v.cat, sku: sz.sku, url: sz.url, flat: sz.flat, s: sz.s || undefined, dims: sz.dims, yaw: sz.yaw, name: v.cat.replace(/-/g, ' ') });
  };
  app.duplicate = (things = app.selected(), at = null) => app.pasteData(clipFrom(app, things), at || offsetOf(things, 2.5));
  const offsetOf = (things, d) => { const c = centroid(things); return c && [c[0] + d, c[1] + d]; };
  const centroid = (things) => { const pts = things.map(e => e.kind === 'room' ? [(e.recipe.x + e.recipe.w / 2) * CELL, (e.recipe.z + e.recipe.d / 2) * CELL] : [e.x, e.z]).filter(p => p[0] != null); return pts.length ? [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length] : null; };
  app.centroid = centroid;

  // ---------- clipboard: relative layout, paste at the cursor, plain text that survives a trip through Discord ----------
  app.copy = () => {
    const lc = (app.pointerView === 'pip' || !app.sel.size) && app.library?.selection() ? app.library.clip() : null; // a thing picked in the library
    if (lc) { app.clip = lc; return copyText(lc); }
    const things = app.selected().filter(e => e.kind !== 'wall'); if (!things.length) return null; app.clip = clipFrom(app, things); return copyText(app.clip);
  };
  app.pasteText = (text, at) => { const c = parseClip(text); if (!c) return false; app.pasteData(c, at); return true; };
  app.pasteData = (clip, at = app.cursor) => {
    if (!clip?.items?.length) return;
    let [x, z] = at || centroid(app.selected()) || [0, 0];
    if (clip.items.some(i => i.kind === 'room')) { x = Math.round(x / CELL) * CELL; z = Math.round(z / CELL) * CELL; }
    else { const t = clip.items.find(i => i.kind === 'object' && i.e.place === 'tile'); if (t) { const tx = x + t.dx, tz = z + t.dz; x += Math.floor(tx / TILE) * TILE + TILE / 2 - tx; z += Math.floor(tz / TILE) * TILE + TILE / 2 - tz; } } // floor tiles land on the 5-ft grid
    const ops = [], newIds = [], idMap = new Map();
    for (const it of clip.items) idMap.set(it.e.id, newId(it.kind === 'room' ? 'room' : it.kind === 'token' ? 'tok' : 'obj'));
    const E = app.entities();
    for (const it of clip.items) {
      const id = idMap.get(it.e.id); newIds.push(id);
      if (it.kind === 'room') {
        const rc = it.e.recipe, dx = Math.round((x + it.dx) / CELL - rc.w / 2), dz = Math.round((z + it.dz) / CELL - rc.d / 2);
        const sx = (dx - rc.x) * CELL, sz = (dz - rc.z) * CELL;
        const objects = (it.objects || []).map(o => ({ ...o, id: newId('obj'), x: r2(o.x + sx), z: r2(o.z + sz) }));
        const om = new Map((it.objects || []).map((o, i) => [o.id, objects[i].id])); for (const o of objects) if (o.parent) o.parent = om.get(o.parent) || undefined;
        ops.push({ type: 'room.spawn', args: { id, ...app.buildingFor(dx, dz, rc.w, rc.d), type: rc.type, ...(rc.flavor && { flavor: rc.flavor }), x: dx, z: dz, w: rc.w, d: rc.d, seed: rc.seed, wallFamily: rc.wallFamily, floor: rc.floor, ...(rc.turn && { turn: rc.turn }), ...(rc.outline && { outline: rc.outline }), engine: 'v2', engineVersion: roomgen.version, layout: { hash: 'copy', summary: 'pasted', objects: objects.map(stripObj) } } });
      } else if (it.kind === 'token') {
        ops.push({ type: 'token.create', args: { id, name: it.e.name, x: r2(x + it.dx), z: r2(z + it.dz), rot: it.e.rot || 0, color: it.e.color, owner: E[it.e.id]?.owner && it.e.owner ? it.e.owner : undefined, ...(it.e.damage > 0 && { damage: it.e.damage }), ...(it.e.conditions?.length && { conditions: it.e.conditions }), ...(it.e.sheet && { sheet: it.e.sheet }), ...(it.e.notes && { notes: it.e.notes }), ...(it.e.gmNotes && app.gm() && { gmNotes: it.e.gmNotes }), ...(it.e.mark && { mark: it.e.mark }), fig: it.e.fig || undefined, size: it.e.size > 1 ? it.e.size : undefined } });
      } else {
        const parent = it.e.parent && idMap.get(it.e.parent);
        const nx = r2(x + it.dx), nz = r2(z + it.dz);
        if (it.e.place === 'tile') for (const o of tilesAt(app, nx, nz)) ops.unshift({ type: 'object.delete', args: { id: o.id } }); // one tile per cell
        ops.push({ type: 'object.place', args: { ...stripObj(it.e), id, x: nx, z: nz, parent: parent || undefined, room: roomAt(nx, nz)?.id } });
      }
    }
    // rooms must not overlap: refuse locally rather than half-paste
    const cid = app.batch(ops);
    if (cid) app.select(newIds.filter(id => !id.startsWith('room') || true));
    return cid;
  };
  const stripObj = (o) => ({ ...(o.flavor && { flavor: o.flavor }), ...(o.factionMissing && { factionMissing: true, factionWasHidden: !!o.factionWasHidden, hidden: true }), name: o.name, cat: o.cat || undefined, sku: o.sku || undefined, url: o.url || undefined, flat: o.flat || undefined, place: o.place, layer: o.layer, x: o.x, y: o.y || 0, z: o.z, rot: o.rot || 0, yaw: o.yaw || 0, ...(o.quat && { quat: o.quat }), ...(o.tiltZ && !o.quat && { tiltZ: o.tiltZ }), s: o.s || undefined, dims: o.dims, parent: o.parent || undefined, id: o.id, ...(ST.stairRole(o) && { down: o.down || undefined, rise: o.rise || undefined }) }); // (a stair keeps which way it leads)
  // the building a new room at this rect joins: the one it touches, else a new one
  // (stacked counts as touching: an upper storey belongs to the building it stands on; core/height.js buildingAt)
  app.buildingFor = (x, z, w, d, y = 0) => {
    const ents = app.entities(), b = HT.buildingAt(ents, { x, z, w, d }, HT.spanOfArgs(ents, { y }));
    if (b) return { building: b };
    const n = Object.values(ents).filter(e => e.kind === 'building').length + 1;
    return { building: newId('bld'), buildingName: `Building ${n}` };
  };
  document.addEventListener('copy', (ev) => { if (ev.target.closest?.('input, textarea') || (!app.sel.size && !app.library?.selection())) return; const t = app.copy(); if (t) { ev.clipboardData.setData('text/plain', t); ev.preventDefault(); app.toast(`Copied ${app.clip.items.length} thing${app.clip.items.length === 1 ? '' : 's'}`); } });
  document.addEventListener('cut', (ev) => { if (ev.target.closest?.('input, textarea') || !app.sel.size) return; const t = app.copy(); if (t) { ev.clipboardData.setData('text/plain', t); ev.preventDefault(); app.deleteSelection(); } });
  document.addEventListener('paste', (ev) => { if (ev.target.closest?.('input, textarea')) return; const t = ev.clipboardData?.getData('text/plain'); if (t && app.pasteText(t)) ev.preventDefault(); else if (app.clip) { app.pasteData(app.clip); ev.preventDefault(); } });

  // ---------- rooms ----------
  // outline: only for a room that is not its whole rectangle (core/footprint.js; the room tool's overlapping draws)
  // y: the room's floor height in feet (the level being built on); 0 = on the ground
  app.spawnRoom = (type, x, z, w, d, seed = Math.floor(Math.random() * 1e6), outline = undefined, y = 0) => {
    const area = app.area(), v = sync.view(area);
    const id = newId('room');
    const b = app.buildingFor(x, z, w, d, y);
    // NO STAIR IS PLACED FOR A ROOM DRAWN BY HAND (Harry 2026-10-11: "let's not default to dropping stairs everywhere …
    // let players place their own stairs unless it looks like we can line one up from a plausible target to a plausible
    // target below"). Stairs are in the library. Only when a flight lines up with a hallway or common room is one
    // OFFERED, by a conditional button beside the room (core/stairs.js stairOffer; client/stairs.js takeStairOffer).
    const L = roomgen.solve(v.entities, { id, type, x, z, w, d, seed, outline, ...(y && { y }), building: b.building }, v.order + 1);
    const cid = app.batch([{ type: 'room.spawn', args: { id, ...b, type, x, z, w, d, ...(y && { y }), seed, ...(outline && { outline }), engine: 'v2', engineVersion: roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]);
    app.lastStair = null; app.lastStairOffer = null; // (tests)
    if (cid && y) {
      const room = app.entities()[id], P = room && app.stairOffer(room);
      if (P) {
        app.lastStairOffer = { room: id, label: P.label, from: P.from, to: P.to };
        app.stairOfferKind?.();
        app.condButtons?.show('stair-offer', { icon: 'move-vertical', text: P.label, anchor: [(x + w / 2) * CELL, (z + d / 2) * CELL, y], life: 12000, area, run: () => { app.takeStairOffer(id); },
          line: { kind: 'stair-offer', text: `${app.nameOf(room)} has no stairs`, button: P.label, data: { room: id, area } } });
      }
    }
    app.lastBuilding = b.building;
    if (cid) queueMicrotask(() => app.offerFaction?.(id));
    return id;
  };
  app.rerollRoom = (r, type = null) => {
    const v = app.view(), seed = Math.floor(Math.random() * 1e6);
    const L = roomgen.solve(v.entities, { id: r.id, type: type || r.recipe.type, seed }, r.order, roomgen.pinnedOf(v.entities, r.id));
    app.dispatch('room.reroll', { id: r.id, seed, ...(type && { type }), engineVersion: roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } });
  };
  app.setRoom = (r, k, v) => app.dispatch('room.set', { id: r.id, [k]: v });
  app.setFaction = (id, flavor) => {
    try {
      const args = planFactionChange(app.entities(), id, flavor, lib, T.types);
      return app.dispatch('faction.set', args);
    } catch (err) { app.toast(err.message, true); return null; }
  };
  // the building tool: a rectangle becomes the type's rooms (client/pack.js), each solved against the ones before it,
  // all in ONE command (one step to undo), in one new building named for the type
  const roomsOfType = (node) => node.children.map(id => taxonomy.get(id)).filter(n => n.level === 'room').map(n => ({ key: n.roomKey, cells: n.cells || [3, 3] }));
  // WHOLE BUILDINGS (docs/BUILDINGS.md, Harry 2026-10-11): on the ground a dragged footprint becomes a PLAN (the tuner's
  // js/buildings.js: rooms, doors, the stair core, storeys) and the plan becomes one batch (core/buildplan.js).
  const typesOfNode = (node) => roomsOfType(node).map(r => ({ ...r, outdoor: roomgen.isOutdoor(r.key) }));
  const nodeOfCode = (code) => [...taxonomy.nodes.values()].find(n => n.level === 'type' && n.code === code) || null;
  app.buildingNode = (word) => { const w = String(word || '').trim().toLowerCase(); return [...taxonomy.nodes.values()].find(n => n.level === 'type' && !n.disabled && (n.code.toLowerCase() === w || n.label.toLowerCase() === w || T.buildings.BUILDING_TYPES[n.code]?.label.toLowerCase() === w || n.label.toLowerCase().split(/[^a-z]+/).includes(w))) || null; };
  app.buildingProgramme = (code) => { const node = nodeOfCode(code); return node && T.buildings.programmeFor(code, typesOfNode(node), T.walls.ROLES); };
  app.buildingPlan = (gen) => { const node = nodeOfCode(gen.code); return node ? T.buildings.generate({ code: gen.code, rect: { x: gen.x, z: gen.z, w: gen.w, d: gen.d }, seed: gen.seed, storeys: gen.storeys, front: gen.front || 'S', dials: gen.dials, outbuildings: gen.outbuildings, flavor: gen.flavor, types: typesOfNode(node), roles: T.walls.ROLES }) : null; };
  let pv = { key: '', n: 0 };
  app.packPreview = (rect) => {
    const m = app.mode, r = m?.node && app.buildableRect(rect); if (!r) return 0;
    if (app.level) return packRooms(r, roomsOfType(m.node)).length;
    m.seed ||= 1 + Math.floor(Math.random() * 1e6); // the seed is picked when the drag starts, so the count shown is the building you get
    const key = `${m.node.code}|${r.x}|${r.z}|${r.w}|${r.d}|${m.seed}`;
    if (pv.key !== key) pv = { key, n: app.buildingPlan({ code: m.node.code, ...r, seed: m.seed })?.rooms.filter(x => !x.outside).length || 0 };
    return pv.n;
  };
  // OFF THE GROUND (storeys, Stage G) the building tool packs the part of the dragged rectangle that can be built on at
  // the level being built on: above ground the squares that are carried (over rooms below, or up to two squares out:
  // the room tool's lit squares) and free; below ground the free squares. The biggest rectangle of them is the building.
  // It joins the building it stands on, and that storey gets its stair by the same rule as a drawn room.
  app.buildableRect = (rect, level = app.level || 0) => {
    if (!level) return rect;
    const ents = app.entities(), top = level + app.levelInfo(level).step;
    const taken = Object.values(ents).filter(r => r.kind === 'room' && HT.spansOverlap(level, top, HT.roomY(r.recipe), HT.roomTop(ents, r))).map(r => r.recipe);
    const valid = level > 0 ? new Set(app.modes.validCells(level).map(([gx, gz]) => `${gx}:${gz}`)) : null;
    const ok = (gx, gz) => (valid ? valid.has(`${gx}:${gz}`) : true) && !taken.some(rc => FP.hasCell(rc, gx, gz));
    let best = null; const h = new Array(rect.w).fill(0); // the largest rectangle of buildable squares inside the drag (row by row histogram)
    for (let j = 0; j < rect.d; j++) {
      for (let i = 0; i < rect.w; i++) h[i] = ok(rect.x + i, rect.z + j) ? h[i] + 1 : 0;
      for (let i = 0; i < rect.w; i++) { let m = h[i]; for (let k = i; k >= 0 && m > 0; k--) { m = Math.min(m, h[k]); const a = m * (i - k + 1); if (m > 0 && (!best || a > best.a)) best = { a, x: rect.x + k, z: rect.z + j - m + 1, w: i - k + 1, d: m }; } }
    }
    return best && { x: best.x, z: best.z, w: best.w, d: best.d };
  };
  // one generated building, as ONE command (one undo): a new one, or `replace` made again (other seed, other storey count)
  app.makeBuilding = (gen, { name = null, replace = null } = {}) => {
    const plan = app.buildingPlan(gen); if (!plan) { app.toast('No such building type here', true); return null; }
    const v = sync.view(app.area()), old = replace ? v.entities[replace] : null, building = replace || newId('bld');
    const out = planOps(plan, { roomgen, entities: v.entities, order: v.order, building, name: old?.name || name || plan.label, newId, replace: replace ? roomsOfBuilding(v.entities, replace) : [], gen: genOf(plan, gen), flavor: gen.flavor });
    if (out.blocked || !out.ops.length) { app.toast('A building needs clear ground: its rooms cannot overlap others', true); return null; }
    if (old?.roof) out.ops.push({ type: 'building.set', args: { id: building, roof: old.roof } });
    app.batch(out.ops);
    const P = app.buildingProgramme(plan.code), word = P?.down ? 'level' : 'storey', n = plan.levels.filter(L => P?.down ? L <= 0 : L >= 0).length;
    app.toast(`${old?.name || name || plan.label}: ${out.rooms.length} rooms, ${n} ${word}${n === 1 ? '' : 's'}${out.left.length ? ` (left out: ${out.left.join('; ')})` : ''}`);
    app.lastBuilding = building; app.lastStair = out.stairs[0] || null; app.lastPlan = plan; app.lastBuildOut = { rooms: out.rooms, stairs: out.stairs, left: out.left, fails: out.fails }; // (tests)
    app.clearSelection?.();
    queueMicrotask(() => {
      app.offerBuilding(building, { ...genOf(plan, gen), name: old?.name || name || plan.label });
      if (!replace) app.offerFaction?.(building);
    });
    return building;
  };
  app.regenBuilding = (id, patch) => { const b = app.entities()[id]; if (!b?.gen) { app.toast('That building was not generated: nothing to make again', true); return null; } return app.makeBuilding({ ...b.gen, ...patch }, { replace: id }); };
  // AFTER A BUILDING ARRIVES, THE OFFERS (Harry: "it should come with a contextual popup like we do that asks (want this to
  // be 1 story? 3?)"): conditional buttons beside it, one per other storey count and a re-roll. Never the only way: the
  // same are in the command bar and on the building's own menu. A storey offer that times out goes down into the chat.
  const BLD_OFFER_MS = 14000;
  app.offerBuilding = (id, gen) => {
    const P = app.buildingProgramme(gen.code), cb = app.condButtons; if (!P || !cb) return;
    if (!app.offerBuilding.kind && app.actionLines) { app.offerBuilding.kind = true; app.actionLines.kind('building-storeys', { restorable: true,
      valid: (d) => { const b = app.entities()[d.building]; return d.area && d.area !== app.area() ? 'in another area' : !b ? 'that building is gone' : !b.gen ? 'not a generated building' : b.gen.seed !== d.seed || b.gen.storeys !== d.was ? 'changed since' : null; },
      run: (d) => app.regenBuilding(d.building, { storeys: d.storeys }) }); }
    for (const k of cb.list().map(x => x.key)) if (k.startsWith('bld-')) cb.hide(k);
    const word = (n) => `${n} ${P.down ? 'level' : 'storey'}${n === 1 ? '' : 's'}`, anchor = [(gen.x + gen.w) * 5, gen.z * 5, 0], area = app.area();
    let i = 0;
    // with every level showing, a new two-storey inn is seen from above its top floor: offer the floor people walk in at
    // (the view never moves by itself: docs/VERTICAL.md "Only four things write the cut")
    if (!P.down && gen.storeys > 1 && app.cut?.y == null && app.goLevel) cb.show('bld-cut', { icon: 'layers', text: 'Cut to lv 1', anchor, nudge: [0, 34 * i++], life: BLD_OFFER_MS, area, when: () => app.cut?.y == null, run: () => { app.goLevel(0, 'offer'); }, doneText: 'Showing lv 1' });
    for (let n = P.storeys.min; n <= P.storeys.max; n++) if (n !== gen.storeys) cb.show(`bld-st-${n}`, { icon: 'layers', text: word(n), anchor, nudge: [0, 34 * i++], life: BLD_OFFER_MS, area, data: { building: id, storeys: n },
      run: () => { app.regenBuilding(id, { storeys: n }); }, doneText: word(n),
      line: { kind: 'building-storeys', text: `${gen.name}: ${word(gen.storeys)}`, button: word(n), data: { building: id, storeys: n, seed: gen.seed, was: gen.storeys } } });
    cb.show('bld-reroll', { icon: 'dice-5', text: 'Re-roll', anchor, nudge: [0, 34 * i], life: BLD_OFFER_MS, area, data: { building: id }, run: () => { app.regenBuilding(id, { seed: 1 + Math.floor(Math.random() * 1e6) }); return 'keep'; } });
  };
  // a footprint for a building made without a drag (the command bar, a link from the gallery): the free ground nearest the middle of the view
  app.freeGroundFor = (w, d) => {
    const c = document.getElementById('c').getBoundingClientRect(), g = app.groundAt(c.left + c.width / 2, c.top + c.height * 0.5) || [0, 0];
    const cx = Math.floor(g[0] / 5 - w / 2), cz = Math.floor(g[1] / 5 - d / 2), rooms = Object.values(app.entities()).filter(r => r.kind === 'room');
    const free = (x, z) => !rooms.some(r => r.recipe.x < x + w + 2 && x - 2 < r.recipe.x + r.recipe.w && r.recipe.z < z + d + 7 && z - 7 < r.recipe.z + r.recipe.d);
    for (let ring = 0; ring < 60; ring++) for (let dx = -ring; dx <= ring; dx++) for (let dz = -ring; dz <= ring; dz++) if (Math.max(Math.abs(dx), Math.abs(dz)) === ring && free(cx + dx * 2, cz + dz * 2)) return { x: cx + dx * 2, z: cz + dz * 2, w, d };
    return null;
  };
  app.buildAt = (node, w, d, opts = {}) => { const rect = app.freeGroundFor(clampN(w, 4, 24), clampN(d, 4, 24)); if (!rect) { app.toast('No free ground near here', true); return null; } const lv = app.level; app.level = 0; let id; try { id = app.spawnBuilding(node, rect, opts); } finally { app.level = lv; }
    if (id && app.main?.grab) { const g = app.main.grab; g.focus.set((rect.x + rect.w / 2) * 5, g.focus.y, (rect.z + rect.d / 2) * 5); g.update?.(); } // asked for by words, it may be off screen: the view goes to it (heading, pitch and zoom kept)
    return id; };
  const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v) || lo));
  app.spawnBuilding = (node, rect0, opts = {}) => {
    if (!(app.level || 0) && T.buildings) { // on the ground: the whole-building generator
      const seed = opts.seed || app.mode?.seed || 1 + Math.floor(Math.random() * 1e6); if (app.mode) app.mode.seed = null;
      return app.makeBuilding({ code: node.code, x: rect0.x, z: rect0.z, w: rect0.w, d: rect0.d, seed, storeys: opts.storeys, front: opts.front || 'S', dials: opts.dials, outbuildings: opts.outbuildings, flavor: opts.flavor }, { name: node.label });
    }
    const y = app.level || 0, rect = app.buildableRect(rect0, y);
    if (!rect) { app.toast(y > 0 ? 'Nothing to build on there: an upper storey stands over rooms below (or up to two squares out)' : 'No free ground there on this level', true); return null; }
    const plan = packRooms(rect, roomsOfType(node));
    if (!plan.length) { app.toast(y && (rect.w !== rect0.w || rect.d !== rect0.d) ? `Only ${rect.w * 5} × ${rect.d * 5} ft of that can be built on at this level: too small for a building (10 × 10 ft at least)` : 'Too small for a building: drag at least 10 × 10 ft', true); return null; }
    const v = sync.view(app.area()), ents = { ...v.entities }, ops = [], ids = [];
    const b = y ? app.buildingFor(rect.x, rect.z, rect.w, rect.d, y) : { building: newId('bld'), buildingName: node.label }, building = b.building;
    plan.forEach((p, i) => {
      const id = newId('room'), seed = Math.floor(Math.random() * 1e6), order = v.order + 1 + i; ids.push(id);
      const L = roomgen.solve(ents, { id, type: p.key, x: p.x, z: p.z, w: p.w, d: p.d, seed, ...(y && { y, building }) }, order);
      ops.push({ type: 'room.spawn', args: { id, building, ...(i === 0 && b.buildingName && { buildingName: y ? b.buildingName : node.label }), type: p.key, x: p.x, z: p.z, w: p.w, d: p.d, ...(y && { y }), seed, engine: 'v2', engineVersion: roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } });
      ents[id] = { id, kind: 'room', order, building, recipe: { type: p.key, x: p.x, z: p.z, w: p.w, d: p.d, ...(y && { y }), seed, wallSeed: seed * 7 + 1, wallFamily: 'auto', floor: 'auto' } };
    });
    app.batch(ops);
    const clipped = rect.w !== rect0.w || rect.d !== rect0.d;
    app.toast(`${node.label}: ${plan.length} room${plan.length === 1 ? '' : 's'}${clipped ? ` on the ${rect.w * 5} × ${rect.d * 5} ft that can be built on here` : ''}`);
    // the storey's stair, as its own command (undo takes it first): the first of the new rooms a stair fits in. The
    // rooms are furnished already, so it only goes where it lands on no furniture (a stair never removes anything).
    app.lastStair = null;
    if (y) for (const id of ids) { const r = app.entities()[id]; if (!r) continue; if (ST_hasAny(app.entities(), ids)) break; const P = app.planStair(r); if (P) { app.dispatch('object.place', P.args); app.toast(`${P.kind === 'ladder' ? 'Ladder' : 'Stair'} added (undo removes it)`); app.lastStair = P.args.id; break; } }
    if (y && !app.lastStair) app.toast('No stair fitted between the furniture: add one with "Add stair" after moving something', true);
    app.lastBuilding = building;
    return building;
  };
  const ST_hasAny = (E, ids) => ids.some(id => E[id] && app.ST?.hasStair(E, E[id]));
  app.replaySpawn = (r) => { const w = worldOf(app.area()); const ids = Object.values(app.entities()).filter(e => e.room === r.id).map(e => e.id); w.animateRoom(r.id, ids, app.main?.camera, { shell: 'all' }); }; // (fixed 2026-10-06: it called a function that no longer existed, found by the command audit)

  // ---------- chat & dice ----------
  app.say = (text) => app.dispatch('chat.say', { id: newId('msg'), text: text.slice(0, 500) });
  // a roll: the numbers here (crypto), then the dice's tumble (surfaces/dice.js: thrown once, by this client, played by
  // every seat; never waited on longer than THROW_WAIT_MS), then one dice.roll command carrying both
  app.roll = async (expr, why = '') => {
    const p = parseDice(expr); if (!p) { app.toast(`Not a roll: ${expr}`, true); return null; }
    const r = rollDice(p); let thr = null;
    try { if (app.dice) thr = await Promise.race([app.dice.throwFor(p.terms, r.rolls), new Promise(res => setTimeout(() => res(null), app.dice.THROW_WAIT_MS))]); } catch (err) { console.warn('dice throw', err); }
    const args = { id: newId('msg'), expr: p.label, rolls: r.rolls, total: r.total, why: why || undefined, ...(thr && { throw: thr }) };
    // my own dice start now, as the roll goes out: the chat line and the announce are held from the first frame (before,
    // they waited for the relay's echo, and over the public route the line showed for that half second: Harry 2026-10-20,
    // "results are going to chat instantly rather than after settling")
    if (thr) try { app.dice.start({ type: 'dice.roll', area: app.area(), by: app.me(), args }); } catch (err) { console.warn('dice start', err); }
    return app.dispatch('dice.roll', args);
  };
  // A PING: a brief mark at a spot, in your seat colour, for the other seats. Presence, not a command: never stored,
  // never in the log or the chat. Press and hold (input.js), Alt/Option+click, or "Ping here" in the bar. Drawn for you
  // too. At most one per 600 ms here; the relay allows 4 in 3 s. (A double-click does NOT ping: Harry 2026-10-06,
  // "pinging: let's go with whatever the norm is, not double click".)
  let pingAt = 0;
  app.ping = (x, z, y = 0, { local = true, secret = false } = {}) => {
    const now = performance.now(); if (now - pingAt < 600) return false; pingAt = now;
    const h = Math.round((y || 0) * 100) / 100;
    sync.presence(app.area(), { cursor: h ? [x, z, h] : [x, z], ping: true, ...(secret && { secret: true }) }); // secret: on a thing hidden from players; only the GM side is told
    if (local) worldOf(app.area()).ping(x, z, app.myColor(), h);
    app.lastPing = { x, z, y: h, local, secret, at: now }; // (tests)
    return true;
  };
  // someone else's ping: drawn at its spot when that spot is on a level I am showing; when my view is cut below it, a
  // small mark in their colour on my level meter at that storey instead (I learn where to look without the view moving)
  app.pv.roleOf = (seat) => sync.campaign?.seats.find(s => s.id === seat)?.role || null; // (World.frameCursors: the GM's cursor is withheld over fog, core/fog.js GM_CURSOR_THROUGH_FOG)
  app.pingsSeen = []; // (tests)
  app.showPing = (m) => {
    const [x, z, y = 0] = m.cursor, mine = m.area === app.area();
    const hid = mine && app.cut?.y != null && y > app.cut.y + 0.5;
    app.pingsSeen.push({ x, z, y, seat: m.seat, color: m.color, area: m.area, how: hid ? 'meter' : 'world', at: performance.now() }); if (app.pingsSeen.length > 50) app.pingsSeen.shift();
    if (hid) app.meterPing?.(y, m.color, m.name); else worldOf(m.area).ping(x, z, m.color, y);
  };

  // ---------- areas, people, agents ----------
  // (the relay decides a new area's visibility: the first of a campaign is open, every later one starts hidden)
  app.createArea = (name) => { const id = newId('area'); sync.submit('area.create', { id, name }); return id; };
  app.setVisibility = (visibility, area = app.area()) => sync.submit('area.visibility', { area, visibility });
  // things are transferred where they stand; PAWNS TRAVEL (surfaces/areas.js app.travel: the relay picks the arrival, and a player's pawn sent into a hidden area opens it)
  app.transfer = (things, to) => { const from = app.area(), pawns = things.filter(e => e.kind === 'token'); for (const e of things) if (e.kind === 'object') sync.submit('transfer', { id: e.id, from, to, x: e.x, z: e.z }); if (pawns.length && app.travel) app.travel(pawns, to, from, { follow: false }); else app.clearSelection(); };
  app.createSeat = async (args) => { const m = await app.await(sync.submit('seat.create', { id: newId('seat'), ...args })); return m?.token || null; };
  app.inviteLink = (t) => `${location.origin}${location.pathname}${location.search}#s=${t}`; // (this page's own address: every address the page is served at must open a link, engine/test/browser_join.py)
  app.cardUrl = (t) => `${relayBase}/c/${sync.campaign.id}/card?seat=${t}`;
  app.revokeSeat = (who) => sync.submit('seat.revoke', { who });

  // ---------- camera ----------
  app.frameSelection = () => {
    const things = app.selected(); if (!things.length) return;
    const w = worldOf(app.area()); const b = new THREE.Box3();
    for (const e of things) { const r = w.recs.get(e.id); const bb = r ? w.boundsOf(r) : null; if (bb) b.union(bb); else if (e.x != null) b.expandByPoint(new THREE.Vector3(e.x, 0, e.z)); }
    if (b.isEmpty()) return;
    const c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3());
    const g = app.main.grab; g.focus.set(c.x, 0, c.z); g.dist = THREE.MathUtils.clamp(Math.max(size.x, size.z, 8) * 1.9, 14, 400); g.update(); app.main.rule = 'free';
  };
  // CENTRE ON A POINT (Harry 2026-10-06: "let's have it also center on the double click as well as cutting above"):
  // the view glides until the world point p = { x, y, z } is in the middle of the view. Heading, pitch and zoom are
  // kept. No move when the point is already near the middle. Reduced motion: it is simply there.
  const NEAR_CENTRE = 0.08; // of the view's smaller side
  app.centreOn = (p, view = app.main, { ms = 300 } = {}) => {
    if (!view || !p) return false;
    const g = view.grab, cam = view.camera; g.update();
    const W = canvas.clientWidth * view.rect[2], H = canvas.clientHeight * view.rect[3];
    const n = new THREE.Vector3(p.x, p.y || 0, p.z).project(cam);
    if (Math.hypot(n.x * W / 2, n.y * H / 2) < NEAR_CENTRE * Math.min(W, H)) return false;
    // the focus lies on the ground plane; a point up on a floor is centred when the view line through it meets the focus
    const dir = new THREE.Vector3().subVectors(g.focus, cam.position).normalize(), t = Math.abs(dir.y) > 1e-4 ? -((p.y || 0) - g.focus.y) / dir.y : 0;
    const x = p.x + dir.x * t, z = p.z + dir.z * t;
    if (view === app.main) view.rule = 'free'; else if (view.rule === 'follow') view.rule = 'pinned';
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion') || ms <= 0) { g.focus.x = x; g.focus.z = z; g.update(); view.glide = null; } // (or Settings ▸ Me ▸ reduce motion)
    else view.glideTo(x, z, ms);
    app.lastCentre = { x, z, point: [p.x, p.y || 0, p.z], view: view === app.main ? 'main' : 'pip', at: performance.now() }; // (tests)
    return true;
  };
  app.resetView = () => { const g = app.main.grab; const pts = Object.values(app.entities()).map(e => e.kind === 'room' ? [(e.recipe.x + e.recipe.w / 2) * CELL, (e.recipe.z + e.recipe.d / 2) * CELL] : [e.x, e.z]).filter(p => p[0] != null); const c = pts.length ? [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length] : [30, 20]; g.focus.set(c[0], 0, c[1]); g.yaw = -20; g.pitch = 52; g.dist = 95; g.update(); };
  app.zoom = (f) => { const g = app.main.grab; g.dist = THREE.MathUtils.clamp(g.dist * f, g.minDist, g.maxDist); g.update(); };
  app.toggleWalls = () => { for (const w of app.worlds.values()) w.setWalls(!w.wallsOn); }; // the tuner's walls toggle (cut-away viewing)
  app.toggleTheme = () => { app.theme = theme = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; try { localStorage.setItem('tw.theme', theme); } catch { } };
  // selection signal: a pulsing glow halo (default) or the footprint on the ground; both depth-tested, never a box
  app.selStyle = (() => { try { return localStorage.getItem('tw.selStyle') || 'halo'; } catch { return 'halo'; } })();
  app.setSelStyle = (s) => { app.selStyle = s; try { localStorage.setItem('tw.selStyle', s); } catch { } app.refresh(); };
  // light / put out a fireplace, candle, lantern…: a synced command; the fire FX follows the flag in every tab
  // raise / lower: one synced, undoable move. Released within reach above a surface, it lands there (and settle.js
  // finishes the contact with gravity); lifted above everything it stays put (hanging and flying are legitimate).
  // "The floor" is the floor of the storey the thing is over (core/height.js), not height 0: lowered to within an inch
  // of it, it stands on it; raised through a ceiling into the room above, it becomes that room's.
  app.floorYOf = (e) => { const ents = app.entities(); return e.room && ents[e.room] ? HT.roomY(ents[e.room].recipe) : HT.floorUnder(ents, e.x, e.z, e.y || 0)?.y ?? Math.min(0, e.y || 0); };
  // DOES A DRAGGED PAWN SNAP TO THE SQUARES NOW? One answer for the pawn drag (input.js) and the placing ghost of a figure
  // dragged out of a list (pawns.js). Settings ▸ Me ▸ "Pawns snap to squares": 'shift' (the default since 2026-10-11:
  // free, Shift snaps: "Shift should be 'snap to steps' across the board") or 'always' (snaps, Shift frees).
  app.pawnSnaps = (shift) => (app.prefs?.pawnSnap || 'shift') === 'always' ? !shift : !!shift;
  // ROLL THINGS (the ☰ menu's Roll, the bar's "roll 90"). Harry 2026-10-12: "I was hoping for roll to always be relative
  // to the current view, rather than fixed to the object. That way you can get the object into ANY orientation while
  // just having rotation and roll".
  //   app.viewRollAxis()         the roll's axis in the world, from the camera NOW (client/commands.js ROLL_AXIS says how)
  //   app.rolled(e, axis, a)     -> { rot, quat } of thing e after a roll of `a` radians about that axis (core/orient.js);
  //                              clockwise as seen looking along the axis. A result that is only a turn goes into `rot`.
  //   app.rollSelection(a, { axis, things })   that, sent: ONE batch whatever the number of things (one undo step). Each
  //                              thing rolls about the same world axis through its own middle.
  //   app.standUpright(things)   the way home: the orientation is cleared, the Turn kept
  app.viewRollAxis = (view = app.main) => {
    const m = view.camera.matrixWorld.elements, f = [-m[8], -m[9], -m[10]], up = [m[4], m[5], m[6]];
    if (ROLL_AXIS === 'sight') return f; // the true line of sight
    // 'horizon': the view's forward direction laid flat (the thing tips to the left or right AS SEEN, a pilot's roll).
    // Looking almost straight down there is no forward left on the ground: then the screen's up direction, laid flat.
    let a = [f[0], 0, f[2]]; if (Math.hypot(a[0], a[2]) < 0.08) a = [up[0], 0, up[2]];
    const l = Math.hypot(a[0], a[2]) || 1; return [a[0] / l, 0, a[2] / l];
  };
  app.rolled = (e, axis, angle) => foldTurn(e.rot || 0, rollQuat(quatOfEntity(e), e.rot || 0, axis, angle));
  app.rollSelection = (angle, { axis = app.viewRollAxis(), things = app.selected() } = {}) => {
    const ops = [];
    for (const e of things) {
      if (e.kind !== 'object' || !canTilt(e) || e.locked) continue;
      const was = quatOfEntity(e), now = app.rolled(e, axis, angle);
      if (JSON.stringify(now.quat) !== JSON.stringify(was)) ops.push({ type: 'object.set', args: { id: e.id, quat: now.quat || Q_ID } });
      if (Math.abs(now.rot - (e.rot || 0)) > 1e-9) ops.push({ type: 'object.move', args: { id: e.id, x: e.x, z: e.z, rot: now.rot } });
    }
    return ops.length ? app.batch(ops) : null;
  };
  app.standUpright = (things = app.selected()) => {
    const ops = things.filter(e => e.kind === 'object' && quatOfEntity(e) && !e.locked).map(e => ({ type: 'object.set', args: { id: e.id, quat: Q_ID } }));
    return ops.length ? app.batch(ops) : null;
  };
  // A PAWN LESS THAN PAWN_BEAM.land (5 ft) ABOVE ITS BASE SETTLES ONTO IT (Harry 2026-10-19, D&D: under 5 ft is on the ground).
  // Its base: the highest ground at or below the figure at (x, z): a floor, a room's top, a thing's top (world.pawnBaseAt).
  // Asked when a pawn is let go by raise / lower (liftTo, and the ring's preview) and when it is moved (moveBy: drags, arrows).
  // NEVER BELOW THE LOWEST FLOOR (2026-10-20): a pawn asked to go under the lowest floor at (x, z) stands on it (HT.lowestFloorAt).
  const pawnBase = (e, x, y, z) => { const w = app.worldOf(app.area()), rec = w?.recs.get(e.id); return rec ? w.pawnBaseAt(rec, x, y, z) : HT.baseUnder(app.entities(), x, z, y).y; };
  app.pawnLandY = (e, x, y, z) => {
    y = Math.max(y, HT.lowestFloorAt(app.entities(), x, z));
    const by = pawnBase(e, x, y, z);
    return y - by > 0 && y - by < PAWN_BEAM.land ? by : y;
  };
  app.pawnLiftStep = PAWN_BEAM.land;
  // A pawn LOWERED THROUGH a floor (below the base it stood on or hung over) lands on the floor below it, never in the
  // ground under the lowest one.
  app.pawnLowerY = (e, y) => {
    const from = e.y || 0, low = HT.lowestFloorAt(app.entities(), e.x, e.z);
    y = Math.max(y, low);
    if (y < from) { const base0 = pawnBase(e, e.x, from, e.z); if (y < base0 - 0.01) y = Math.max(low, pawnBase(e, e.x, y, e.z)); }
    return app.pawnLandY(e, e.x, y, e.z);
  };
  app.liftTo = (e, y) => {
    if (e.kind === 'token') return app.dispatch('token.move', { id: e.id, x: e.x, z: e.z, y: r2(app.pawnLowerY(e, y)) });
    const fy = HT.floorUnder(app.entities(), e.x, e.z, y)?.y ?? Math.min(0, y);
    const s = app.worldOf(app.area()).surfaceBelow(e.x, y, e.z, new Set([e.id, ...app.descendants(e).map(d => d.id)]), fy);
    const land = s && y - s.y < 1.5 ? s : null, ny = r2(land ? land.y : y - fy < 0.05 ? fy : y), now = roomAt(e.x, e.z, ny)?.id || '';
    return app.dispatch('object.move', { id: e.id, x: e.x, z: e.z, y: ny, parent: land?.parent || '', ...(now !== (e.room || '') && !(e.fromEdge) && { room: now }) });
  };

  // ---------- THE LEVEL (storeys; one level, Harry 2026-10-06) ----------
  // ONE number per client, never synced: app.level, a floor height in feet (0 = the ground). It is the level you are
  // ON: the one the meter marks, the one [ and ] move, and the one a room or building tool draws on ("we should just
  // build on whatever level the level is set to"). There is always one; with nothing ever chosen it is the ground.
  // It may be a level nothing is built on yet (that is how a new storey or a cellar is started). It steps by the
  // storey height of the building in focus. Whether every level is SHOWN is a separate switch (surfaces/cut.js).
  // Listeners get app.emit('level', y).
  app.level = 0;
  const buildTool = () => app.mode?.kind === 'room' || app.mode?.kind === 'building';
  app.focusBuilding = () => {
    const ents = app.entities();
    for (const e of app.selected?.() || []) { const r = e.kind === 'building' ? e : e.kind === 'room' ? ents[e.building] : e.room && ents[ents[e.room]?.building]; if (r) return r.id; }
    if (app.lastBuilding && ents[app.lastBuilding]) return app.lastBuilding;
    const f = app.main?.grab.focus; let best = null, bd = Infinity;
    for (const r of app.roomList(ents)) if (r.building) { const [x, z] = app.labelPointOf(r.recipe), d = f ? Math.hypot(x - f.x, z - f.z) : 0; if (d < bd) { bd = d; best = r.building; } }
    return best;
  };
  // the levels the meter offers: 5 storeys above the ground storey and 6 below it (Harry), more when the area has
  // rooms beyond that (always one spare above the highest room and one below the lowest, to build on)
  const UP = 5, DOWN = 6;
  app.levelRange = () => {
    const ents = app.entities(), bid = app.focusBuilding(), b = bid ? ents[bid] : null, step = HT.storeyHeightOf(b), base = HT.baseOf(b);
    const [yLo, yHi] = app.derived('roomYs', (E) => { let a = Infinity, z = -Infinity; for (const r of app.roomList(E)) { const y = HT.roomY(r.recipe); if (y < a) a = y; if (y > z) z = y; } return [a, z]; }, ents); // (the storey number rises with the height, so the lowest and highest rooms are enough)
    const ss = Number.isFinite(yLo) ? [HT.storeyAt(b, yLo), HT.storeyAt(b, yHi)] : [];
    const cap = Math.floor(HT.MAX_Y / step);
    const lo = Math.max(-cap, Math.min(-DOWN, ...ss.map(v => v - 1))), hi = Math.min(cap, Math.max(UP, ...ss.map(v => v + 1)));
    return { building: bid, step, base, lo, hi, loY: base + lo * step, hiY: base + hi * step };
  };
  app.levelInfo = (y = app.level) => {
    const ents = app.entities(), R = app.levelRange(), b = R.building ? ents[R.building] : null;
    const exists = Object.values(ents).some(r => r.kind === 'room' && HT.roomY(r.recipe) === y);
    return { y, label: HT.levelLabel(HT.storeyAt(b, y)), building: R.building, step: R.step, exists, isNew: !exists && y !== 0, lo: R.loY, hi: R.hiY, tool: buildTool() };
  };
  const applyLevel = () => { const w = app.area() && app.worlds.get(app.area()); if (!w) return; w.setGroundOpen(app.level < 0); w.showLevelGrid(buildTool() && app.level !== 0 ? app.level : null); app.modes?.levelChanged?.(); };
  app.setLevel = (y, { quiet = true } = {}) => {
    y = Math.max(-HT.MAX_Y, Math.min(HT.MAX_Y, Math.round(y / HT.STEP) * HT.STEP));
    if (y === app.level) return false;
    app.level = y; applyLevel();
    if (!quiet) { const I = app.levelInfo(); app.toast(`${I.label} (${y} ft)${I.isNew ? ' · nothing built here yet' : ''}`); }
    app.emit('level', y); app.refresh(); return true;
  };
  // the ghost grid follows the tool and the level
  app.on((what) => { if (what === 'refresh') applyLevel(); });
  app.toggleLit = (things) => { const lit = !things.every(e => e.lit !== false); return app.batch(things.map(e => ({ type: 'object.light', args: { id: e.id, lit } }))); }; // mixed → all lit
  app.previewOf = (cat) => ({ key: cat.sku, make: () => { const sz = roomgen.sizeOf(cat.id, cat.sku); return sz ? assets.visualFor({ cat: cat.id, ...sz, place: cat.place }) : Promise.resolve(null); } });

  // ---------- modes (place with a ghost, room rectangle tool) and input ----------
  installEdgePan(app, canvas); // (before the pawns, the surfaces and the input: every drag registers itself with it)
  installPawns(app); // figures as pawns: place one or a group, change a pawn's figure (client/pawns.js)
  installStairs(app, { roomgen, toast: (m, bad) => app.toast(m, bad) }); // core/stairs.js for the client: plan, add, a pawn's hop
  app.modes = createModes(app);
  app.registry = createRegistry(app);
  defineCommands(app.registry, app);
  // surfaces: every front end reads the same registry (a second menu/hotkey system plugs in the same way)
  app.library = createLibrary(app, { taxonomy, renderer });
  app.thumbs = createThumbs(app, { renderer });
  app.intro = createIntro(app);
  for (const s of [traySurface, buildSurface, pawnsSurface, settingsSurface, turnsSurface, xraySurface, lightReachSurface, rulersSurface /* all before the keys surface, which reads the key map once */, keysSurface, barSurface, ringSurface, rosterSurface, diceSurface, announceSurface, chatSurface, crumbsSurface, cursorSurface, labelsSurface, undoChipsSurface, floorDropSurface, cutSurface, fpsSurface, areasSurface]) app.registry.use(s);
  if (ringLab) { app.registry.use(ringLabSurface); installRingLabTable(app, token); }
  if (labelLab) app.registry.use(labelLabSurface);
  teachBar(app.registry, assets); // the bar's vocabulary (barwords.js), once every surface has added its commands
  setupFactionUI(app);
  installInput(app, canvas);
  // links and cards the GM/players need to hand on (invite links, agent rules cards)
  app.on((what, d) => {
    if (what !== 'output') return;
    const o = $('#output');
    o.innerHTML = `<h3></h3><textarea readonly></textarea><div class="row"><button data-copy>Copy</button><button data-close>Close</button></div>`;
    o.querySelector('h3').textContent = d.title; o.querySelector('textarea').value = d.text;
    o.hidden = false;
    const close = () => { if (o.hidden) return false; o.hidden = true; const i = app.escapeStack.indexOf(close); if (i >= 0) app.escapeStack.splice(i, 1); };
    o.querySelector('[data-copy]').onclick = () => { navigator.clipboard?.writeText(d.text).then(() => app.toast('Copied'), () => {}); o.querySelector('textarea').select(); };
    o.querySelector('[data-close]').onclick = close;
    app.escapeStack.push(close);
    app.lastOutput = d;
  });

  app.interact = createInteraction(app, { canvas, renderer }); // the hand comes first (interact.js)
  app.gfx.apply();
  // ---------- render loop: one renderer, scissor viewports ----------
  let last = performance.now(), fpsT = last, fpsN = 0;
  // The loop wakes every display frame; whether THIS one is drawn is graphics.js's call (the idle rate, the frame-rate
  // limit, a hidden tab). Skipping costs nothing, and the first frame after any input is never skipped.
  function frame(now) {
    requestAnimationFrame(frame);
    if (!app.gfx.due(now)) return;
    app.gfx.begin();
    try { frameInner(now); } catch (err) { console.error('frame', err); } // one bad frame must never stop the loop
    app.gfx.end(now);
  }
  function frameInner(now) {
    const rawMs = now - last; let dt = Math.min(0.1, rawMs / 1000); last = now;
    app.interact.frame(now, rawMs); // is the hand moving, and is the frame keeping up? (interact.js)
    app.edgePan?.step(dt, now);     // something in the hand, held at an edge of the window: the view pans (edgepan.js)
    flushSyncs();                   // state changes that came in a burst since the last frame: applied to the scene once
    if (app.frozenAt != null) { now = app.frozenAt; dt = 0; } // (tests) time stands still: two pictures of the same instant can be compared
    app.pv.step(dt); ps.tick();
    app.fog.tick(now);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * renderer.getPixelRatio()) || canvas.height !== Math.round(H * renderer.getPixelRatio())) { renderer.setSize(W, H, false); for (const w of app.worlds.values()) w.fx?.setSize(W, H); }
    const deco = { selected: app.sel, hover: app.hover, color: app.myColor(), pending: app.pendingIds(), style: app.selStyle, remote: app.prefs?.remoteSel === false ? null : app.pv.selections(app.area(), app.me()) };
    for (const w of app.worlds.values()) w.viewers = app.views.filter(v => v.area === w.areaId).map(v => v.camera); // who is looking at each area (far buildings sleep: world.js SLEEP)
    for (const w of app.worlds.values()) { w.frame(dt, { presence: app.pv, localDrags: w.areaId === app.area() ? app.localDrags : null, deco: w.areaId === app.area() ? deco : w.local ? app.library.deco() : null, now, camera: w.local ? app.pip?.camera : app.main?.camera }); w.setLineResolution(W, H); }
    app.modes.frame?.(dt);
    app.diceFrame?.(now); // the dice: stepped, and each shown only where this viewer can see (surfaces/dice.js)
    app.library.frame(dt);
    // one-off renders that read the drawing buffer (area thumbnails): drawn first, so this frame's views paint over them
    for (const job of app.beforeViews.splice(0)) { try { job(); } catch (e) { console.error('beforeViews', e); } }
    renderer.setScissorTest(true);
    app.lastRenders = []; // (tests) which view drew which area into which rectangle, this frame
    for (const v of app.views) {
      const world = app.worlds.get(v.area);
      const px = v.pixels(W, H);
      v.camera.aspect = px.w / Math.max(1, px.h); v.camera.updateProjectionMatrix();
      v.update(dt, world);
      world?.beforeRender?.(v.camera); // everything this camera could see is in the scene before it is drawn (world.js SLEEP)
      if (v === app.main && world?.fx && sync.view(v.area)) { // the main view renders through the tuner's lighting stack
        // the FX stack draws into whatever viewport the renderer holds; left alone, that was the PiP's rectangle from the
        // previous frame, so the main scene landed INSIDE the PiP and the main window went blank (Harry 2026-10-04)
        renderer.setScissorTest(false); world.ghostPrepass(renderer, v.camera); renderer.setScissorTest(true); // (only while a ghost grid is up below the ground: world.js ghostMaterial)
        renderer.setViewport(px.x, px.y, px.w, px.h); renderer.setScissor(px.x, px.y, px.w, px.h);
        renderer.setScissorTest(false); world.fx.render(dt * 1000); renderer.setScissorTest(true); // fx counts in milliseconds
        app.lastRenders.push({ view: 'main', area: v.area, via: 'fx', viewport: px });
        continue;
      }
      renderer.setViewport(px.x, px.y, px.w, px.h); renderer.setScissor(px.x, px.y, px.w, px.h);
      renderer.setClearColor(0x1d1f1a); renderer.clear();
      if (world && (sync.view(v.area) || world.local)) { (world.fx?.fogwar || world.fogwar)?.enabled ? (world.fx?.fogwar || world.fogwar).renderPlain(world.scene, v.camera) : renderer.render(world.scene, v.camera); app.lastRenders.push({ view: v === app.main ? 'main' : 'pip', area: v.area, via: 'plain', viewport: px }); }
    }
    renderer.setScissorTest(false);
    app.previewsDrawn = previews.render();
    app.emit('frame', dt);
    placePipFrame(W, H);
    // the loading screen leaves with the first real frame of the area (and a travel's with the first of the new one)
    // (2026-10-11) on the FIRST load it stays a little longer: until the pieces of the opening view are in (holding())
    if (loadUp && app.main && sync.view(app.main.area) && app.lastRenders.some(r => r.view === 'main') && !(firstLoad && holding(now))) { loadUp = false; firstLoad = false; LOAD.done(); LOAD.clear('travel'); }
    app.stats.frames++; fpsN++;
    if (now - fpsT > 1000) { app.fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; hud(); }
  }
  // THE HOLD (Harry 2026-10-07: "add the stuff needed to load that first common room into the loading that happens on
  // the pre-loading loading bar. We want that first demo moment to pop instantly."). The first frame used to send the
  // loading screen away with the table made of grey stand-in boxes, and the meshes came in over the next seconds. Now,
  // on the first load, the screen waits for:
  //   - every piece the OPENING VIEW shows (things and shell pieces under the camera that are awake: world.unsettled);
  //   - where the intro is about to play (a building seat's first visit: a new campaign), the pieces of the very room
  //     its phantom will build: the room is solved here ahead of time with the seed the phantom will send, and set out
  //     in a world nobody sees, which fetches its meshes and textures into the look's caches (and onto the GPU).
  // The pieces arriving move the bar (LOAD.pieces). It leaves two frames after the last one (so the frame that draws
  // them all, and compiles their shaders, is behind it), or after HOLD_CAP_MS whatever is still missing.
  let firstLoad = true, hold = null;
  function warmRoom(plan) {
    const v = sync.view(app.main.area);
    const args = { id: 'room_warm', type: plan.type, x: plan.x, z: plan.z, w: plan.w, d: plan.d, seed: plan.seed, building: 'bld_warm' };
    const L = roomgen.solve(v.entities, args, v.order + 1);
    const area = applyArea(newArea('warm', 'warm'), 'room.spawn', { ...args, engine: 'v2', engineVersion: roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } });
    const w = new AreaWorld('warm:intro', { roomgen, assets, renderer, camera: app.main.camera, focus: () => null, fx: false });
    w.sync({ entities: area.entities, seq: 0, order: area.order, chat: [] }, { gmSide: true });
    return { world: w, hash: L.hash, things: L.objects.length };
  }
  function holding(now) { try { return holding1(now); } catch (err) { console.warn('hold', err); return false; } } // (whatever goes wrong here, the screen leaves)
  function holding1() {
    const now = performance.now(), w = app.worlds.get(app.main.area); // (not the frame's own time: that is when the frame BEGAN, and the first one is long)
    if (!hold) {
      hold = { at: now, total: 0, quiet: 0, warm: null }; LOAD.at('first');
      const plan = !qs.has('nointro') && app.intro.plan();
      if (plan) try { hold.warm = warmRoom(plan); } catch (err) { console.warn('warm', err); }
      // how many FILES all that is (asked of the look's own list of what a piece needs, so it follows whatever the
      // loader fetches), and a count of the files that arrive from now on: the pace (pieces finish in lumps, files do not)
      try {
        const urls = new Set(), L = assets.look;
        for (const x of [w, hold.warm?.world]) if (x) {
          for (const r of x.recs.values()) if (r.entity.kind === 'object' && r.entity.url && !r.asleep) for (const u of L.assetUrls(assets.specOf(r.entity))) urls.add(u);
          for (const sh of x.shell.values()) if (!sh.asleep && sh.spec?.url) for (const u of L.assetUrls(sh.spec)) urls.add(u);
        }
        hold.files = urls.size; hold.got = 0;
        hold.po = new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.responseEnd >= hold.at) hold.got++; }); hold.po.observe({ type: 'resource' });
      } catch { hold.files = 0; }
    }
    const left = (w?.unsettled(app.main.camera) || 0) + (hold.warm?.world.unsettled() || 0);
    // (things that stand on a table are seated on it once their mesh is in, a few a frame: that is given a moment too, so
    // the screen does not lift on mugs still dropping into place; no longer than 1.5 s, the queue is the whole area's)
    const seating = !left && w?.settler.pending() && now - (hold.inAt ||= now) < 1500;
    hold.total = Math.max(hold.total, left); hold.quiet = left || seating ? 0 : hold.quiet + 1;
    // the bar: by files while pieces are still out (they finish in lumps), and "all in" only when every piece is
    if (left && hold.files) LOAD.pieces(Math.min(hold.got, hold.files - 1), hold.files); else LOAD.pieces(hold.total - left, hold.total);
    // it gives up at the cap, and EARLY on a line too slow to make it: from a third of the cap on, if fewer than half
    // the FILES a steady pace to the cap would have brought are in (under a sixth after 5 s, under a third after
    // 10 s), waiting longer only shows the same stand-ins later
    const el = now - hold.at, slow = el > HOLD_CAP_MS / 3 && hold.files > 0 && left > 0 && hold.got / hold.files < 0.5 * el / HOLD_CAP_MS;
    const capped = el > HOLD_CAP_MS ? 'cap' : slow ? 'slow' : false;
    if (hold.quiet < 2 && !capped) return true;
    if (hold.warm) { const seen = new Set(); hold.warm.world.scene.traverse(o => { for (const m of [].concat(o.material || [])) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap']) { const t = m[k]; if (t?.image && !seen.has(t)) { seen.add(t); try { renderer.initTexture(t); } catch { } } } }); }
    hold.po?.disconnect();
    app.loadHold = { ms: Math.round(now - hold.at), pieces: hold.total, left, capped, files: hold.files, got: hold.got, warm: hold.warm ? { hash: hold.warm.hash, things: hold.warm.things } : null }; // (tests, and a slow machine's report)
    hold.warm = null;
    return false;
  }
  function placePipFrame(W, H) {
    const f = $('#pipFrame');
    if (!app.pip) { f.hidden = true; return; }
    const [l, t, w, h] = app.pip.rect;
    Object.assign(f.style, { left: `${l * W}px`, top: `${t * H}px`, width: `${w * W}px`, height: `${h * H}px` });
    f.hidden = false;
    const fol = app.pip.follow, pw = app.worlds.get(app.pip.area);
    const n = (fol?.owner ? [...(pw?.recs.values() || [])].filter(r => r.entity.owner === fol.owner).length : pw?.pointsOf(fol).length) || 0;
    $('#pipTitle').textContent = pw?.local ? `Library · ${pw.roomNode.label}${app.mode?.cat?.name ? ` · ${app.mode.cat.name[0].toUpperCase() + app.mode.cat.name.slice(1)}` : ''} · drag it out` : `${app.areaName(app.pip.area)} · ${app.pip.rule === 'follow' ? `follow-group (${n} token${n === 1 ? '' : 's'})` : app.pip.rule}`;
    f.classList.toggle('lib', !!pw?.local);
  }
  function hud() {
    const t = app.area(), v = t && sync.view(t);
    $('#hud').textContent = `${sync.status} (${baseTransport.kind})${sync.rtt != null ? ` · ${sync.rtt} ms` : ''} · ${app.areaName(t)} seq ${v?.seq ?? '–'}${sync.pendingCount() ? ` · ${sync.pendingCount()} unconfirmed` : ''} · ${app.fps} fps`;
  }
  setInterval(() => sync.ping(), 2000);

  // ---------- test hooks ----------
  Object.assign(app, {
    ready: () => sync.status === 'live' && !!app.main && !!sync.view(app.main.area),
    seq: (t = app.area()) => sync.view(t)?.seq ?? null,
    cursors: (t = app.area()) => app.pv.on(t).map(s => ({ seat: s.seat, name: s.name, ghost: s.ghost, thinking: s.thinking, label: s.label, pos: s.pos && [+s.pos[0].toFixed(2), +s.pos[1].toFixed(2)] })),
    drawn: (id, t = app.area()) => app.worlds.get(t)?.recs.get(id)?.drawn || null,
    screenOf(x, z, view = app.main, y = 0) { const r = canvas.getBoundingClientRect(), [l, t, w, h] = view.rect; const p = new THREE.Vector3(x, y, z).project(view.camera); return { x: r.left + (l + (p.x + 1) / 2 * w) * r.width, y: r.top + (t + (1 - p.y) / 2 * h) * r.height }; },
    signals: () => { const w = app.worldOf(app.area()); return [...w.halos.values()].map(h => { let mat = null; h.obj.traverse(o => { if (!mat && o.material) mat = o.material; }); return { id: h.id, style: h.style, depthTest: mat?.depthTest, kind: mat?.userData?.kind || (mat?.userData?.foot ? 'footprint' : null), box: false }; }); },
    spawningNow: () => { const w = app.worldOf(app.area()); return { anims: w.anims.size, last: w.lastEpisode || null }; },
    glowSeen: (roomId, at = null) => app.worldOf(app.area()).glowSeen(roomId, app.main.camera, at),
    wallHeights: (roomId) => { const w = app.worldOf(app.area()); return [...w.shell.values()].filter(s => s.spec.layer === 'walls' && /^wall-/.test(s.spec.sku || '') && (!roomId || s.roomId === roomId) && !s.visual?.userData?.placeholder).map(s => { s.group.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(s.visual); return { sku: s.spec.sku, h: +(b.max.y - b.min.y).toFixed(3) }; }); },
    houseInfo: () => { const w = app.worldOf(app.area()); return { anim: T.house.anim, from: T.house.from, lighting: w.fx ? w.fx.params('lighting') : null, fire: w.fx ? w.fx.params('fire') : null, tunerV: T.v, engine: T.version }; },
    dropLines: () => app.worldOf(app.area()).dropLines.size,
    pawnBase: (id) => app.worldOf(app.area()).pawnBaseInfo(id), pawnBeam: () => ({ ...PAWN_BEAM }),
    fxFlames: () => { const w = app.worldOf(app.area()); return w.fx ? w.fx.fire.flames().length : null; },
    pipInfo: () => app.pip && { ...app.pip.describe(), points: app.worlds.get(app.pip.area)?.pointsOf(app.pip.follow?.owner ? [...app.worlds.get(app.pip.area).recs.values()].filter(r => r.entity.owner === app.pip.follow.owner).map(r => r.entity.id) : app.pip.follow) || [] },
    hashCheck: () => Object.values(app.entities()).filter(e => e.kind === 'room').map(r => { const v = app.view(); const before = Object.fromEntries(Object.entries(v.entities).filter(([, x]) => x.kind === 'room' && x.order < r.order)); let mine = null; try { mine = roomgen.solve({ ...before, [r.id]: r }, { id: r.id, ...r.recipe }, r.order, roomgen.pinnedOf(v.entities, r.id)).hash; } catch { } return { room: r.id, type: r.recipe.type, creator: r.layout.hash, mine, match: mine === r.layout.hash }; }),
  });
  sync.connect();
  requestAnimationFrame(frame);
  // first visit of a seat that can build: the ghost acts the first build out (?nointro: tests and embeds skip it)
  // a link from the buildings gallery (tuner/buildings/): ?build=TAV&w=12&d=8&seed=7&storeys=2&loops=0.3 builds that
  // building once, on free ground, for a seat that may build; the address is then cleaned so a reload does not build again
  if (qs.has('build')) { const t0 = performance.now(); const go = () => {
    if (!(app.ready() && app.main && app.area())) return performance.now() - t0 < 120000 && setTimeout(go, 400);
    const node = app.buildingNode(qs.get('build')), num = (k) => qs.has(k) ? +qs.get(k) : undefined, dials = {}; for (const k of ['loops', 'pacing', 'carved']) if (qs.has(k)) dials[k] = +qs.get(k);
    const clean = new URLSearchParams(location.search); for (const k of ['build', 'w', 'd', 'seed', 'storeys', 'front', 'loops', 'pacing', 'carved', 'outbuildings']) clean.delete(k);
    history.replaceState(null, '', `${location.origin}${location.pathname}${clean.toString() ? '?' + clean : ''}${location.hash}`);
    if (!node) return app.toast(`No building type "${qs.get('build')}"`, true);
    if (!app.gm()) return app.toast('Only the GM side builds: open the link as the GM', true);
    setTimeout(() => { const id = app.buildAt(node, num('w') || 12, num('d') || 8, { seed: num('seed'), storeys: num('storeys'), front: qs.get('front') || 'S', ...(Object.keys(dials).length && { dials }), ...(qs.get('outbuildings') === '0' && { outbuildings: false }) }); void id; }, 600);
  }; go(); }
  if (!qs.has('nointro')) { const t0 = performance.now(); const go = () => app.ready() && app.main && !firstLoad ? setTimeout(() => app.intro.run(), 900) : performance.now() - t0 < 60000 && setTimeout(go, 300); go(); }
}
const r2 = (v) => Math.round(v * 100) / 100;
const RELAY_PATIENCE_MS = 8000; // a first connection that has not answered by then: the loading screen says so (and the page keeps trying)
const HOLD_CAP_MS = +new URLSearchParams(location.search).get('holdcap') || 15000; // (?holdcap=: tests)
//                              // the loading screen waits at most this long past the first frame for the opening view's pieces (a huge map on a slow line): then it leaves, and the rest arrive as they used to
const TRAVEL_GRACE_MS = 350;    // an area that arrives within this of asking shows no loading screen at all (a local travel takes about 0.3 s: a screen for the last tenth of a second would only be a flash)
const NO_SHIMMER = new Set(['room.spawn', 'room.reroll', 'room.delete', 'room.move', 'room.rotate', 'room.set']); // a spawn is its own show

function installRingLabTable(app, token) {
  if (localStorage.getItem('tw.ringlab.token') !== token) return;
  let started = false;
  const waitFor = async (test, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { if (test()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
  app.on(async what => {
    if (what !== 'frame' || started || app.sync.status !== 'live' || !app.area() || !app.view()) return;
    started = true;
    try {
      const has = name => Object.values(app.entities()).some(e => e.name === name);
      const area = app.area();
      const fresh = !has('Ring lab common room') && !has('Ring lab inn');
      if (!has('Ring lab common room')) {
        const room = app.spawnRoom('common', 2, 2, 6, 5, 82241);
        await waitFor(() => !!app.entities()[room]);
        app.rename(app.entities()[room], 'Ring lab common room');
      }
      if (!has('Ring lab inn')) {
        app.makeBuilding({ code:'TAV', x:16, z:2, w:12, d:10, seed:82242, storeys:2 }, { name:'Ring lab inn' });
        await waitFor(() => has('Ring lab inn'));
      }
      if (!has('Mira · raised')) app.addPawns(null, 22.5, 22.5, { name:'Mira · raised', y:10, select:false });
      if (!has('Bram')) app.addPawns(null, 27.5, 22.5, { name:'Bram', select:false });
      if (!has('Cato')) app.addPawns(null, 32.5, 22.5, { name:'Cato', select:false });
      // Big pieces for the world-sized ring (2026-10-20): Huge (15 ft) and Gargantuan (20 ft, the game's largest pawn:
      // core size 1-4) from the figure library, and an 80 ft room as the tarrasque-size base no pawn can have.
      for (const [name, fig, size, x, z] of [['Huge · fire giant (15 ft)', 'foe-fire-giant', 3, 52.5, 72.5], ['Gargantuan · red dragon (20 ft)', 'foe-dragon-young-red', 4, 85, 85]])
        if (!has(name)) app.dispatch('token.create', { id: newId('tok'), name, x, z, rot: 0, color: '#c0703a', ...(app.assets.figures?.get?.(fig) && { fig }), size });
      if (!has('Ring lab · 80 ft base (tarrasque-size)')) {
        const big = app.spawnRoom('common', 2, 24, 16, 16, 82243);
        await waitFor(() => !!app.entities()[big]);
        app.rename(app.entities()[big], 'Ring lab · 80 ft base (tarrasque-size)');
      }
      // A door and lamp are placed from the actual library and remain fully editable.
      for (const [cat,name,x,z,place] of [['door-plank','Ring lab door',40,25,'kit'],['sconce-reflector','Ring lab light',27,15,'wall']]) {
        if (has(name)) continue;
        const sz = app.roomgen.sizeOf(cat); if (!sz) continue;
        app.dispatch('object.place', { id:newId('obj'), name, cat, sku:sz.sku, url:sz.url, place, x, y:place==='wall'?7:0, z, s:sz.s, dims:sz.dims, yaw:sz.yaw });
      }
      app.dispatch('area.set', { area, name:'Ring lab · try the ring here' });
      if (fresh && app.main?.grab) {
        const g = app.main.grab;
        g.focus.set(72, 0, 32); g.dist = 145; g.pitch = 62; g.yaw = 0; g.update();
      }
      const first = Object.values(app.entities()).find(e => e.name === 'Bram');
      if (first && fresh) app.select(first.id);
      app.toast('Ring lab table ready. Select any piece, then open the Ring lab drawer.');
    } catch (e) { console.error('ring lab table', e); app.toast('Ring lab table needs another try: '+e.message, true); started=false; }
  });
}

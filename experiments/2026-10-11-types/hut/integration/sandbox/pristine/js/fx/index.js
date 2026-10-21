// FX facade: one object main.js (or the fx.html harness) talks to with a couple of hook calls.
//   const fx = createFx({ renderer, scene, camera, hemi, sun, items: () => items, api: API, toast, focus: () => cam.focus });
//   frame loop: fx.frame(dt, now); fx.render(dt);   resize: fx.setSize(w, h);   bench: Object.assign(stats, fx.stats())
// It builds the LIGHTING, FIRE and ATMOSPHERE panels into <details data-key="light"> / "fire" / "atmos", keeps the current
// dials in this browser, and saves / loads / sends presets (POST /tuner kind "fx", data.fx = "lighting" | "fire" | "atmos").
// ATMOSPHERE (atmos.js, 2026-10-04): ground fog that swirls, haze + dust, soft smoke, ceiling pooling, wisps, puffs.
// structure(): the walls + floors the fog keeps to (default: items()); the game passes its room shell.
// WATER (water.js, 2026-10-04): water in vessels (Alignment Bench records), interactive ripples, rivers / canals / ponds
// (fx.water.setBodies). Panel data-key "water", presets kind "fx" data.fx "water", "Use in game" -> house `water`.
import * as THREE from 'three';
import { dialGroup } from '../ui.js';
import { createLighting, LIGHT_DEFAULTS, LIGHT_SCHEMA, LIGHT_BUILTINS } from './lighting.js';
import { createFire, FIRE_DEFAULTS, FIRE_SCHEMA, FIRE_BUILTINS } from './fire.js';
import { createAtmos, ATMOS_DEFAULTS, ATMOS_SCHEMA, ATMOS_BUILTINS, migrateAtmos } from './atmos.js';
import { createWater, WATER_DEFAULTS, WATER_SCHEMA, WATER_BUILTINS } from './water.js';
import { mountWaterTools } from './waterpanel.js';
import { createCutFly, FLY_DEFAULTS, FLY_SCHEMA, FLY_BUILTINS } from './cutfly.js';
import { mountFlyTools } from './flypanel.js';
import { clone, mergeDefaults } from './util.js';
import { createAnchorEditor } from './anchoredit.js';
import { houseLink } from './houselink.js';

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};

// The game (engine/client) creates one with panels: false, persist: false (never touch the tuner's browser dials),
// initial: the house look ({lighting, fire} params from GET /tuner/house) and dataBase: the deployed tuner's data/ URL.
// movers(): things that can wade (the game's pawns) beyond items(); water ripples behind them.
// shadowCasters(light, reach): the things within reach of a shadow-casting light, when the host can say (lighting.js)
export function createFx({ renderer, scene, camera, hemi, sun, items = () => [], movers = () => [], structure = null, rooms = null, stirrers = null, shadowCasters = null, plainVessels = false, api = '/api/tw-ratings', toast = () => {}, meshOf = () => null, focus = () => null, panels = true, persist = true, initial = null, dataBase = 'data/' }) {
  // scene motion signature: any item moving (spawn, settle, drag, LOD swap) changes it -> shadow maps refresh
  // things the water module places itself (the tuner's water demo) join items(), so the fire lights them
  let water = null; const baseItems = items;
  items = () => { const x = water?.extraItems(); return x?.length ? [...baseItems(), ...x] : baseItems(); };
  const motion = () => { let h = 0; for (const it of items()) { const g = it.group; if (!g?.visible) continue; const p = g.position, q = g.rotation, k = g.scale; h += p.x * 1.31 + p.y * 7.13 + p.z * 2.97 + k.x * 3.7 + k.y * 5.3 + k.z * 1.9 + q.x * 11 + q.y * 13 + q.z * 17 + (it.visual?.id || 0) * 0.37; } return Math.round(h * 1000); };
  const lighting = createLighting({ renderer, scene, camera, hemi, sun, focus, motion, casters: shadowCasters });
  // presets made before the atmosphere's indoor / outdoor split are carried over on the way in
  const fit = (defaults, p) => mergeDefaults(defaults, defaults === ATMOS_DEFAULTS ? migrateAtmos(p) : p);
  const atmos = createAtmos({ renderer, scene, camera, hemi, sun, items, structure, stirrers, focus });
  const fire = createFire({ scene, camera, onLights: (ls) => lighting.setFireLights(ls), meshOf, smokeBatch: atmos.softBatch, focus });
  // "Light from fires" off (fire.js setLights): the programs for the other light state are built in the background
  fire.setCompiler(() => renderer.compileAsync ? renderer.compileAsync(scene, camera) : null);
  atmos.bind({ fire, lighting }); lighting.setAtmosPass(atmos.pass);
  water = createWater({ renderer, scene, camera, hemi, sun, items: baseItems, movers, meshOf, api, dataBase, canvas: renderer.domElement, focus, plainVessels });
  lighting.setWaterPass(water.pass);
  // FLY-AWAY (cutfly.js, 2026-10-06): what the cut hides flies up and off; the game owns its own runner (engine/client/cutfly.js)
  const cutfly = createCutFly();
  const kinds = {
    lighting: { mod: lighting, defaults: LIGHT_DEFAULTS, schema: LIGHT_SCHEMA, builtins: LIGHT_BUILTINS, key: 'light', prefix: 'light-' },
    fire: { mod: fire, defaults: FIRE_DEFAULTS, schema: FIRE_SCHEMA, builtins: FIRE_BUILTINS, key: 'fire', prefix: 'fire-' },
    atmos: { mod: atmos, defaults: ATMOS_DEFAULTS, schema: ATMOS_SCHEMA, builtins: ATMOS_BUILTINS, key: 'atmos', prefix: 'atmos-', label: 'atmosphere' },
    water: { mod: water, defaults: WATER_DEFAULTS, schema: WATER_SCHEMA, builtins: WATER_BUILTINS, key: 'water', prefix: 'water-' },
    cutfly: { mod: cutfly, defaults: FLY_DEFAULTS, schema: FLY_SCHEMA, builtins: FLY_BUILTINS, key: 'cutfly', prefix: 'fly-', label: 'fly-away' },
  };
  const qs = new URLSearchParams(location.search);
  // atmosphere start: the house look (game) / this browser's dials (tuner); else ?atmos=<built-in>; else morning mist in the
  // tuner (so the fog is there to play with) and clear in the game when no house atmosphere is stored (one is, since 2026-10-05)
  const firstAtmos = () => ATMOS_BUILTINS[qs.get('atmos')]?.() || (panels ? ATMOS_BUILTINS['morning-mist']() : ATMOS_BUILTINS.clear());
  // water start: ?water=<built-in>; the house look (game) / this browser's dials (tuner); else well water in the tuner and
  // none in the game until Harry presses "Use in game" (the game fetches the house water below)
  const firstWater = () => panels ? WATER_BUILTINS['well-water']() : { ...WATER_BUILTINS['well-water'](), vessels: { on: false, auto: false } }; // game: placed rivers draw; vessels stay dry
  for (const [name, K] of Object.entries(kinds)) K.mod.set(fit(K.defaults, (name === 'atmos' && ATMOS_BUILTINS[qs.get('atmos')]?.()) || (name === 'water' && WATER_BUILTINS[qs.get('water')]?.()) || initial?.[name] || (persist && store.get(`tuner.fx.${name}.current`, null)) || (name === 'atmos' ? firstAtmos() : name === 'water' ? firstWater() : K.builtins.night?.() || K.defaults)));
  fire.setDance(lighting.params.shadows.dance);
  if (qs.has('nofx')) { // headless layout tests: plain render, no flames (software GL memory)
    lighting.set({ ...lighting.params, on: false });
    fire.set({ ...fire.params, types: Object.fromEntries(Object.keys(fire.params.types).map(k => [k, 0])), particles: { ...fire.params.particles, embers: 0, smoke: 0 } });
    atmos.set(ATMOS_BUILTINS.clear());
    water.set(WATER_BUILTINS.off());
  }
  const atmosLinks = () => { const A = atmos.params; fire.setSmokeLook({ amount: A.smoke.amount, rise: A.smoke.rise, spread: A.smoke.spread, dark: A.smoke.dark, soft: A.smoke.soft }); lighting.setHazeBoost(A.haze.amount * A.haze.shafts * 0.02); };
  atmosLinks();
  if (panels) for (const name of Object.keys(kinds)) buildPanel(name);

  function onChange(name) {
    const K = kinds[name];
    K.mod.apply();
    if (name === 'lighting') fire.setDance(lighting.params.shadows.dance);
    if (name === 'atmos') atmosLinks();
    if (persist) store.set(`tuner.fx.${name}.current`, K.mod.params);
    K.link?.changed(); // the panel's "what is the game using" line
  }

  let remote = {};
  async function fetchRemote() {
    try { const r = await fetch(`${api}/tuner/fx`); remote = r.ok ? await r.json() : {}; } catch { remote = {}; }
    for (const name of Object.keys(kinds)) fillLoad(name);
  }
  function fillLoad(name) {
    const sel = document.querySelector(`#fx-${name}-load`); if (!sel) return;
    const K = kinds[name]; sel.length = 1;
    for (const n of Object.keys(K.builtins)) sel.append(new Option(`${n} (built-in)`, 'builtin:' + n));
    for (const n of Object.keys(store.get(`tuner.fx.${name}.presets`, {}))) sel.append(new Option(`${n} (this browser)`, 'local:' + n));
    for (const [n, rec] of Object.entries(remote)) if (rec?.data?.fx === name) sel.append(new Option(`${n} (sent)`, 'remote:' + n));
  }

  function buildPanel(name) {
    const K = kinds[name];
    const box = document.querySelector(`details.major[data-key="${K.key}"]`); if (!box) return;
    box.querySelectorAll(':scope > section').forEach(s => s.remove());
    const sec = document.createElement('section'); sec.className = 'fxPanel'; sec.id = `fx-${name}`;
    const prefix = K.prefix, label = K.label || name;
    sec.innerHTML = `
      ${name === 'lighting' ? `<label class="check"><input type="checkbox" id="fx-lighting-on"> Lighting FX on (post stack + fire shadows)</label>` : ''}
      ${name === 'lighting' ? `<div class="row"><button id="fx-prof-day">☀ Day</button><button id="fx-prof-night">☾ Night</button></div>` : ''}
      <div class="row"><input id="fx-${name}-name" placeholder="preset name"></div>
      <div class="row"><button id="fx-${name}-save">Save</button><select id="fx-${name}-load"><option value="">Load…</option></select><button id="fx-${name}-reset">Defaults</button></div>
      ${name === 'atmos' ? `<div class="muted small">Move the cursor (or drag a thing) through the fog: it swirls. The volume needs Lighting FX on; smoke draws either way.</div>
      <div class="row"><button id="fx-atmos-snuff" title="put every fire out: each one puffs">Put fires out</button><button id="fx-atmos-light">Relight</button><button id="fx-atmos-warm" title="run the ceiling smoke forward ~20 s">Fast-forward smoke</button></div>
      <label class="check"><input type="checkbox" id="fx-atmos-unbuilt"> Fog sea over the undiscovered world (then build a room: its arrival blows the fog away)</label>
      <div class="row"><button id="fx-atmos-hide" title="fog of war: the room nearest the view centre fogs out">Hide a room (fog of war)</button><button id="fx-atmos-reveal">Reveal all</button></div>` : ''}
      <textarea id="fx-${name}-note" rows="2" placeholder="Notes for Fauna about this ${label} (sent with the preset)"></textarea>
      <div class="row"><button id="fx-${name}-send" class="primary">Send ${label} preset to Fauna</button><button id="fx-${name}-house" title="Make this the game's house ${label} (turnipworks.net/play)">Use in game</button></div>
      <div id="fx-${name}-dials"></div>`;
    box.append(sec);
    const $ = (s) => sec.querySelector(s);
    // "Use in game" is the primary button, with a line under it saying what the game is using now (houselink.js)
    K.link = houseLink({ api, key: name, label, sendBtn: $(`#fx-${name}-send`), houseBtn: $(`#fx-${name}-house`), current: () => K.mod.params, norm: (p) => fit(K.defaults, p), toast });
    const draw = () => {
      const P = K.mod.params, root = $(`#fx-${name}-dials`); root.innerHTML = '';
      K.schema.forEach(([title, group, schema], i) => root.append(dialGroup(title, schema, P[group], `${name}.${group}`, () => onChange(name), i < 2)));
      $(`#fx-${name}-name`).value = P.name || '';
      const on = sec.querySelector('#fx-lighting-on'); if (on) on.checked = !!P.on;
      const unb = sec.querySelector('#fx-atmos-unbuilt'); if (unb) unb.checked = P.world.unbuilt > 0;
    };
    draw();
    const on = sec.querySelector('#fx-lighting-on');
    if (on) on.addEventListener('change', () => { lighting.params.on = on.checked; onChange('lighting'); });
    const nameOf = () => ($(`#fx-${name}-name`).value.trim() || K.mod.params.name || prefix + 'untitled').replace(/[^A-Za-z0-9 ._-]/g, '-');
    const withPrefix = (n) => n.startsWith(prefix) ? n : prefix + n;
    $(`#fx-${name}-save`).addEventListener('click', () => {
      const n = nameOf(); K.mod.params.name = n;
      const all = store.get(`tuner.fx.${name}.presets`, {}); all[n] = clone(K.mod.params); store.set(`tuner.fx.${name}.presets`, all);
      fillLoad(name); toast(`saved ${name} preset "${n}" in this browser`);
    });
    $(`#fx-${name}-load`).addEventListener('change', (e) => {
      const v = e.target.value; if (!v) return;
      const src = v.split(':')[0], n = v.slice(v.indexOf(':') + 1);
      const p = src === 'builtin' ? K.builtins[n]?.() : src === 'local' ? store.get(`tuner.fx.${name}.presets`, {})[n] : remote[n]?.data;
      if (p) { K.mod.set(fit(K.defaults, p)); onChange(name); draw(); toast(`loaded ${name} preset "${n}"`); }
      e.target.value = '';
    });
    $(`#fx-${name}-reset`).addEventListener('click', () => { K.mod.set(K.builtins.night ? fit(K.defaults, K.builtins.night()) : clone(K.defaults)); onChange(name); draw(); });
    $(`#fx-${name}-send`).addEventListener('click', async () => {
      const n = withPrefix(nameOf()); K.mod.params.name = n; $(`#fx-${name}-name`).value = n;
      const data = { ...clone(K.mod.params), fx: name };
      try {
        const r = await fetch(`${api}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'fx', name: n, note: $(`#fx-${name}-note`).value.trim(), data }) });
        const j = await r.json(); if (!r.ok || !j.ok) throw new Error(j.err || r.status);
        K.link.sent(n); fetchRemote(); // (says the game is NOT changed)
      } catch (err) { toast(`send failed: ${err.message}. The preset is still saved in this page.`, true); }
    });
    $(`#fx-${name}-house`).addEventListener('click', async () => { // the game's house look (GET /tuner/house)
      const n = withPrefix(nameOf()); const data = { [name]: { ...clone(K.mod.params), name: n } };
      try {
        const r = await fetch(`${api}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'house', name: 'house', note: `${name} "${n}" is now the game's house look`, data }) });
        const j = await r.json(); if (!r.ok || !j.ok) throw new Error(j.err || r.status);
        K.mod.params.name = n; $(`#fx-${name}-name`).value = n; K.link.used(n);
      } catch (err) { toast(`could not set the house look: ${err.message}`, true); }
    });
    sec.querySelector('#fx-atmos-snuff')?.addEventListener('click', () => { let n = 0; for (const it of items()) if (isFire(it) && !it.fxSnuffed) { it.fxSnuffed = true; n++; } sig = null; toast(`put out ${n} fire${n === 1 ? '' : 's'}`); });
    sec.querySelector('#fx-atmos-light')?.addEventListener('click', () => { for (const it of items()) it.fxSnuffed = false; sig = null; toast('fires relit'); });
    sec.querySelector('#fx-atmos-warm')?.addEventListener('click', () => { atmos.warm(600); toast('ceiling smoke run forward'); });
    const unb = sec.querySelector('#fx-atmos-unbuilt');
    if (unb) { unb.checked = atmos.params.world.unbuilt > 0; unb.addEventListener('change', () => { atmos.params.world.unbuilt = unb.checked ? 0.75 : 0; onChange('atmos'); draw(); }); }
    // fog of war demo: the tuner's rooms are cells (5 ft); the region takes the walls too
    sec.querySelector('#fx-atmos-hide')?.addEventListener('click', () => {
      const f = focus(), rooms = window.tuner?.rooms?.() || [], C = 5;
      const hidden = new Set(atmos.regions().filter(r => r.hidden).map(r => r.id));
      const r = rooms.filter(r => !hidden.has('war-' + r.id)).map(r => ({ r, d: f ? Math.hypot((r.x + r.w / 2) * C - f.x, (r.z + r.d / 2) * C - f.z) : 0 })).sort((a, b) => a.d - b.d)[0]?.r;
      if (!r) { toast('no room left to hide', true); return; }
      atmos.setRegions([...atmos.regions(), { id: 'war-' + r.id, rect: [r.x * C - 0.7, r.z * C - 0.7, (r.x + r.w) * C + 0.7, (r.z + r.d) * C + 0.7], hidden: true }]); // (no height: the room keeps its own fog under the war fog)
      toast(`fog of war over the ${r.type}`);
    });
    sec.querySelector('#fx-atmos-reveal')?.addEventListener('click', () => { atmos.setRegions(atmos.regions().filter(r => !r.hidden)); toast('revealed'); });
    for (const prof of ['day', 'night']) sec.querySelector(`#fx-prof-${prof}`)?.addEventListener('click', () => {
      K.mod.set(fit(K.defaults, K.builtins[prof]())); onChange(name); draw(); toast(`lighting: ${prof}`);
    });
    K.redraw = draw;
  }
  if (panels) fetchRemote();
  if (panels) mountWaterTools({ water, panel: document.querySelector('#fx-water'), camera, canvas: renderer.domElement, scene, toast, dataBase, onChange: () => onChange('water'), redraw: () => kinds.water.redraw?.(),
    clearAir: () => { if (atmos.params.name !== 'morning-mist') return false; atmos.set(mergeDefaults(ATMOS_DEFAULTS, ATMOS_BUILTINS.clear())); onChange('atmos'); kinds.atmos.redraw?.(); return true; } });
  const flyTools = panels ? mountFlyTools({ fly: cutfly, panel: document.querySelector('#fx-cutfly'), items, camera, focus, toast, onChange: () => { onChange('cutfly'); flyTools?.sync(); } }) : null;
  // flame anchors: derived per sku (data/fire_anchors.json) + Harry's edits from the server (latest per sku wins)
  (async () => {
    let auto = {}, over = {};
    try { const r = await fetch(`${dataBase}fire_anchors.json?v=1`); if (r.ok) auto = await r.json(); } catch { }
    try { const r = await fetch(`${api}/tuner/fire_anchors`); if (r.ok) for (const [sku, rec] of Object.entries(await r.json())) if (rec?.data?.anchors) over[sku] = { anchors: rec.data.anchors, ...(rec.data.light && { light: rec.data.light }), src: 'override' }; } catch { }
    fire.setAnchors(auto, over);
  })();
  let anchorEditor = null;
  const firePanel = document.querySelector('#fx-fire');
  if (panels && firePanel) {
    const box = document.createElement('div'); box.className = 'fxAnchors';
    box.innerHTML = `<h3>Flame positions (selected object)</h3>
      <div class="row"><button id="fx-anchor-edit">Edit flames</button><button id="fx-anchor-send" class="primary">Send flames</button><button id="fx-anchor-auto" title="back to the positions derived from the mesh">Auto</button></div>
      <div id="fx-anchor-state" class="muted small"></div>`;
    firePanel.insertBefore(box, firePanel.querySelector('#fx-fire-dials'));
    anchorEditor = createAnchorEditor({ fire, camera, canvas: renderer.domElement, scene, items, api, toast, panel: box });
  }

  // rooms -> the atmosphere: each room's fog height (its own setting, else its type's default) and whether it is outdoors.
  // rooms(): [{ id, rect: [x0, z0, x1, z1], type, outdoor, height }] (the game passes its room entities); the tuner's own
  // rooms (cells of 5 ft; `fog` = the Room panel's slider) are the default
  const OUTDOOR = /yard|outdoor|garden|court|paddock|field/;
  const roomsNow = rooms || (() => (window.tuner?.rooms?.() || []).map(r => ({ id: 'room-' + r.id, rect: [r.x * 5, r.z * 5, (r.x + r.w) * 5, (r.z + r.d) * 5], type: r.type, outdoor: r.outdoor ?? OUTDOOR.test(r.type), height: r.fog ?? null })));
  let roomSig = '', roomT = -1e9;
  function pollRooms(now) { if (now - roomT < 300) return; roomT = now; const list = roomsNow(), sg = JSON.stringify(list); if (sg !== roomSig) { roomSig = sg; atmos.setRooms(list); } }
  fetch(`${dataBase}fog_defaults.json?v=1`).then(r => r.ok ? r.json() : null).then(j => { if (j) atmos.setTypeDefaults(Object.fromEntries(Object.entries(j).filter(([k, v]) => typeof v === 'number'))); }).catch(() => { });

  // fire sources: re-sync when the set of fire items changes (polled; cheap string signature)
  // (fxSnuffed: the tuner's "Put fires out"; the game leaves an unlit thing out of items() instead)
  let sig = '', syncT = -1e9;
  const isFire = (it) => it.spec?.id && /fire|hearth|oven|candle|candelabra|lantern|lamp|chandelier|torch|brazier|sconce/.test(it.spec.id);
  function pollSources(now) {
    if (now - syncT < 400 && sig !== null) return; syncT = now; // null: re-sync now (all fires out is '' too)
    const list = [...items()].filter(it => !it.fxSnuffed);
    const s = list.filter(isFire).map(it => (it.spec.uid || it.spec.key || it.spec.id) + '@' + it.group?.id + '/' + (it.visual?.id || 0)).join('|');
    if (s !== sig) { sig = s; fire.sync(list); }
  }

  const hist = []; // last 16 frames' whole-frame counts (shadow refreshes come every other frame or less)
  const avg = (i) => hist.length ? Math.round(hist.reduce((a, h) => a + h[i], 0) / hist.length) : 0;
  const self = {
    lighting, fire, atmos, water, cutfly, flyTools, items: () => [...items()], anchorEditor: () => anchorEditor,
    frame(dt, now) { pollSources(now); pollRooms(now); fire.frame(dt, now); lighting.frame(now); atmos.frame(dt, now); water.frame(dt, now); flyTools?.frame(now); },
    render(dt) {
      const ar = renderer.info.autoReset; renderer.info.autoReset = false; renderer.info.reset();
      atmos.mainView(lighting.params.on);
      lighting.render(dt);
      atmos.mainView(false);
      if (!lighting.params.on) { water.renderPlain(); atmos.renderPlain(); } // no post stack: the smoke still draws (depth-tested), the fog volume needs depth
      hist.push([renderer.info.render.calls, renderer.info.render.triangles]); if (hist.length > 16) hist.shift();
      renderer.info.autoReset = ar;
    },
    setSize(w, h) { lighting.setSize(w, h); },
    // whole-frame numbers (every pass, shadow maps included) plus the FX bookkeeping
    stats: () => ({ frame_draw_calls: avg(0), frame_triangles: avg(1), frame_draw_calls_max: Math.max(0, ...hist.map(h => h[0])), frame_triangles_max: Math.max(0, ...hist.map(h => h[1])), programs: renderer.info.programs?.length ?? 0, ...lighting.stats(), ...fire.stats(), ...atmos.stats(), ...water.stats(), ...cutfly.stats() }),
    setParams(name, p) { const K = kinds[name]; K.mod.set(fit(K.defaults, p)); onChange(name); K.redraw?.(); },
    params: (name) => clone(kinds[name].mod.params),
  };
  window.fx = self; // test + automation hook (fx_ui.py, fx_shots.py)
  // the game: the house water ("Use in game" in the tuner's Water panel), fetched here so engine/client needs no change
  if (!panels && !initial?.water && !qs.has('water') && !qs.has('nofx')) fetch(`${api}/tuner/house`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(h => { if (h?.water) self.setParams('water', h.water); if (h?.cutfly) self.setParams('cutfly', h.cutfly); }).catch(() => { });
  return self;
}

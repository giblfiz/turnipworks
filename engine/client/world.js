// AreaWorld: the 3D VIEW of one area's state (principle 1). It never changes state; it draws the area with the
// Spawn Tuner's own look code (imported live through tuner.js):
//   shell     floor tiles (look.floorSpecs), wall pieces and doors (look.edgeSpecs), posts (look.cornerSpec)
//   visuals   look.makeVisual: the tuner's mesh / LOD tier / orientation / flat / chain rules
//   spawn     anim.js schedule + pose with the HOUSE preset (Harry's harry-v2 unless the tuner chose another), the
//             tuner's layer order and camera-side walls arriving last; out-animation on re-roll and delete
//   settle    settle.js gravity onto tabletops          fx  fx/ lighting + fires (lit things only), per world
// Animations, settling and fire are local and purely visual; only the room-spawn command syncs.
//
// Signals (no boxes): selected = a pulsing halo in the selecting seat's colour (or, switchable, the footprint on the
// ground), depth-tested so it never shows through the thing or anything in front of it; hover = a thin neutral halo;
// hidden (GM side) = see-through + a violet halo + a "Hidden" pill; unconfirmed = a faint fast shimmer halo. Nothing
// is ever drawn around something that is spawning in.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { T } from './tuner.js';
import { isTile, cellKey } from './tiles.js';
import * as FP from '../core/footprint.js';
import * as ST from '../core/stairs.js';
import { stairVisual } from './stairs.js';
import * as HT from '../core/height.js';
import { quatOfEntity, qMul, qAxis } from '../core/orient.js';
import * as RF from './roofs.js';
import * as KF from './kitfit.js';
import { gameFly } from './cutfly.js';
import { markCanvas } from './marks.js';
import { GM_CURSOR_THROUGH_FOG } from '../core/fog.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// FAR BUILDINGS SLEEP (big maps, 2026-10-06; see the SLEEP section of AreaWorld). Feet and milliseconds.
export const WAKE_MARGIN = 40;   // a building is in the scene whenever any part of it is within this of what a camera sees
export const SLEEP_MARGIN = 50;  // and leaves it only once it is farther than this from every camera's view ...
export const SLEEP_DWELL = 1500; // ... and has been for this long
const SLEEP_PER_FRAME = 12, UNIT_PAD = 6, UNIT_ROOF = 20; // rooms put to sleep in one frame; a room's box grows by these (eaves, a tree's crown; its roof and chimneys)
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _ball = new THREE.Sphere(), _bc = new THREE.Vector3();
const UNSEEN_KEEP = 7.5; // ft round a stair's hole within which a covered room's things are still drawn (they show through it)
const _sv = new THREE.Vector3();
const CELL = 5, WALL_H = 9, OUTSET = 0.6; // ft: wall height; a room's volume reaches the walls' outer faces
export const NO_DROP = '#e5484d'; // a drop that would be refused (the one destructive red)
export const HIDDEN_COLOR = '#a78bfa';
// the "remote selected" look (another seat's selection, Harry 2026-10-04): the shared selection module's brackets, quiet.
// (Kept here, as a preset passed to the module, so the game needn't wait on a tuner deploy; it can become a fifth state
// of tools/spawn-tuner/js/fx/selection.js later.)
// THE SELECTION GLOW IS CUT (Harry 2026-10-11: "we can definitely cut 'selection glow' as bringing almost nothing to the
// table"). The glow was the 'halo' style: a second copy of the thing's own triangles, pushed outward and drawn glowing
// (never a full-screen pass). The game no longer draws it for any state: a look that asks for it gets corner brackets
// (selected) or the thin footprint outline (hover, hidden, waiting on the relay). Everything else of the house look is
// as the tuner's Selection lab sends it.
export function noGlow(house) {
  const out = { ...(house || {}) };
  for (const st of ['selected', 'hover', 'hidden', 'pending']) {
    const s0 = out[st] || (st === 'pending' ? { style: 'halo', color: 'fixed', fixed: '#ffffff' } : null); // (a look that says nothing about "pending" got the module's default: the halo)
    if (s0 && (s0.style || 'halo') === 'halo') out[st] = { ...s0, style: st === 'selected' ? 'brackets' : 'footprint', ghost: 0, dials: { ...(s0.dials || {}), ...(st !== 'selected' && { footprint: { ...(s0.dials?.footprint || {}), weight: 2, dash: st === 'pending' ? 0.3 : 0, gap: 0.3, glow: 0 } }) } };
  }
  return out;
}
export const REMOTE_LOOK = { name: 'remote', selected: { style: 'brackets', color: 'seat', ghost: 0, dials: { brackets: { anim: 'none', opacity: 0.4, weight: 2, size: 0.18 } } } };

const FIRE_RE = /^(fireplace|hearth|cook-hearth)/; // what gets a chimney above it (a firepit or a brazier does not)
const ROOF_WALL = '#b9ad98';                        // a gable end's plaster
const _down = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0);
let _roofTex = null;
function roofTextures(lib) { // the four generated roofing textures, through the library (never a path the library does not list)
  return _roofTex ||= RF.loadRoofTextures(THREE, (cat) => { const k = lib.objects[cat]?.skus.find(x => x.kind === 'flat' && x.url); return k ? `${T.base}${T.look.deliver?.(k.url) ?? k.url}` : null; }, undefined, T.look.loadTexture || null);
}
// THE ROOF SECTIONS (2026-10-11): one modelled patch of roofing per style (data/roofsections.json names the files, built
// by experiments/2026-10-11-roof-sections). Loaded once, the first time roofs are drawn; until a style's file is in
// (and if it never comes) its roofs wear the painted flat surface, as before.
const _roofKits = {}; let _roofKitsAsked = null;
function roofSections(onReady) {
  _roofKitsAsked ||= fetch(new URL(`./data/roofsections.json?v=${globalThis.TW_V || 'dev'}`, import.meta.url)).then(r => r.json()).then(man => Promise.all(Object.entries(man.sections || {}).map(([style, info]) =>
    new Promise(res => new GLTFLoader().load(new URL(`./data/${info.url}?v=${info.rev || ''}`, import.meta.url).href, g => { const kit = RF.roofSectionKit(THREE, g.scene, info); if (kit) _roofKits[style] = kit; res(); }, undefined, () => res()))))).catch(() => { });
  _roofKitsAsked.then(onReady);
  return _roofKits;
}
const _rc = new THREE.Vector3();
const RAY_CAMERA = new THREE.PerspectiveCamera(); // for raycasts that are not from the eye (surfaceBelow): see there
// A RAISED PAWN'S BEAM (Harry 2026-10-13: "raise & lower a pawn should leave its base on the ground and show an indicator
// beam down to the base"; docs/PAWNS.md "A raised pawn"). The base stays on the ground under the figure; the beam joins
// the two: a solid rod in the pawn's seat colour (unlit: the same in a dark cellar and in sunlight) inside a dark
// casing (so it reads on a pale floor as well as a dark one), with the height on it. All in feet.
export const PAWN_BEAM = {
  radius: 0.24,            // the coloured rod, close up (about six inches through)
  casing: 1.6,             // the dark sleeve round it, as a multiple of the rod (drawn as an outline: its back faces only)
  minAngle: 0.0028,        // ... and never thinner on screen than this share of its distance from the eye (about 7 px of rod, 11 with the sleeve, on a 900-px-high view): it reads at table distance
  casingColor: '#14100c',
  hiddenOpacity: 0.45,     // a pawn hidden from players (the GM's view of it): the beam is see-through with the rest
  min: 0.3,                // a pawn this little above what is under it stands on it: no beam, the base is with the figure
  land: 5,                 // a pawn let go (raise / lower) or moved to less than this above its base (floor, deck, a thing's top) lands ON
                           // it; exactly 5 ft or more stays up (main.js pawnLandY). Harry 2026-10-19: "based on D&D rules, anything less
                           // than 5 feet off the ground should probably settle to the ground for pawns" (first 0.5 ft: a pawn let go a few
                           // inches up had floated for good under a "0.5 ft" beam). The ring's raise / lower steps a pawn by this too.
  labelAt: 0.5,            // where on the beam the height label sits (0 = the base, 1 = the figure's feet)
  labelScale: 0.9,         // of a small label's size
  recheckMs: 400,          // a flyer that is not moving asks again what is under it this often (a table's mesh may have arrived)
};
const _bv = new THREE.Vector3();
const BEAM_GEO = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).translate(0, 0.5, 0);
const GROUND_Y = -0.02, STOP_SLACK = 0.05; // ft: where the ground mesh lies; how far past a floor a pick still counts (a rug, a floor tile)
const _so = new THREE.Vector3(), _sd = new THREE.Vector3(), _sr = new THREE.Raycaster();
export class AreaWorld {
  constructor(areaId, { roomgen, assets, renderer, camera, focus, fx = true }) {
    Object.assign(this, { areaId, roomgen, assets });
    this.scene = new THREE.Scene();
    if (AreaWorld.ROOF_SURFACE !== 'painted') roofSections(() => { }); // the roof sections are fetched with the area (about 650 KB once), so the first "Roofs on" flies in the finished roofs
    this.scene.background = new THREE.Color('#1d1f1a');               // the tuner's scene, lights, ground and grid
    this.hemi = new THREE.HemisphereLight('#fff4e0', '#3a3428', 1.7);
    this.sun = new THREE.DirectionalLight('#fff1dc', 1.9);
    this.sun.position.set(-60, 120, -40); this.sun.target.position.set(60, 0, 60);
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 10, far: 400 });
    this.scene.add(this.hemi, this.sun, this.sun.target);
    const W = 800;
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(W, W), new THREE.MeshStandardMaterial({ color: '#2b2e25', roughness: 1 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = GROUND_Y; this.ground.receiveShadow = true; this.ground.userData.ground = true; this.scene.add(this.ground);
    this.grid = new THREE.GridHelper(W, W / CELL, '#4a4e40', '#3a3d33'); this.scene.add(this.grid);
    this.layers = { shell: new THREE.Group(), things: new THREE.Group(), deco: new THREE.Group(), cursors: new THREE.Group() };
    for (const g of Object.values(this.layers)) this.scene.add(g);
    this.cutFly = gameFly(this); this.born = performance.now(); // levels above the cut fly away (cutfly.js); its carriers live in a layer of their own
    this.recs = new Map();       // entity id -> { entity, group, visual, vkey, it }
    this.pawns = new Set();      // the recs that are pawns (per-frame code asks for these, not for every thing)
    this.shell = new Map();      // shell key -> { key, sig, spec, group, visual, it, roomId }
    this.cursors = new Map(); this.pings = []; this.anims = new Map(); this.halos = new Map(); this.footprints = new Map(); this.dropLines = new Map();
    this.view = null; this.shellKey = ''; this.wallsOn = true; this.loaded = false;
    this.preset = T.house.anim;
    // (the things of a room, from an index: this was a walk over every thing in the area for every thing seated, so on a
    // big map the seating queue took minutes to run out, and every thing it seated redrew the fire's shadow: FIXES.md, "the slow state")
    this.settler = T.settle.createSettler({ itemsOfRoom: (rid) => this.itemsOfRoom(rid) });
    this.fx = null;
    this.fogwar = !fx && T.fx.createFogWar ? T.fx.createFogWar({renderer,scene:this.scene,camera,decorative:()=>false}) : null;
    if (this.fogwar && T.house.fogwar) this.fogwar.set?.(T.house.fogwar);
    if (fx) this.fx = T.fx.createFx({ renderer, scene: this.scene, camera, hemi: this.hemi, sun: this.sun, panels: false, persist: false, plainVessels: true, // (plainVessels: a cup or a barrel never switches the water effects on; fx/water.js)
     
      initial: { lighting: T.house.lighting, fire: T.house.fire, atmos: T.house.atmos, fogwar: T.house.fogwar }, dataBase: `${T.base}data/`, api: T.api || '/api/tw-ratings',
      shadowCasters: (light, reach) => this.shadowCasters(light, reach),
      items: () => this.fxItems(), structure: () => this.fogStructure(), rooms: () => this.fogRooms(), stirrers: () => this.layers.cursors.children, focus, meshOf: (spec) => assets.lib.objects[spec.id]?.skus.find(k => k.sku === spec.sku)?.mesh || null,
      movers: () => { const out = []; for (const r of this.pawns) if (r.group.visible) out.push(r.waterIt ||= { group: r.group, visual: r.visual, spec: { uid: r.entity.id, kind: 'token' } }); return out; } }); // pawns wade (water.js)
  }

  // FRAME-TIME SWITCHES (big maps, 2026-10-06; experiments/2026-10-06-megamap/FIXES.md). Each is on; off is the code as
  // it was, for measuring one against the other and as a way out.  tw.perf.set({ ... }), ?perf=off
  //   aoList   the contact-shadow pass draws its see-through things from a list, not by walking the scene (fx/lighting.js)
  //   sleep    buildings far from every camera's view are out of the scene (SLEEP, below)
  //   shadowList  the fire's shadow is drawn from the things within its light's reach, not by walking the scene six
  //            times; and only THEIR moving redraws it (shadowCasters below, fx/lighting.js)
  //   freeze   world positions are worked out only for what moved (updateMatrices below), not for every node, every draw
  //   lightSlots  OFF: NOT READY. Only the fires that can be seen shine; dark stand-ins keep the light count on a ladder
  //            (fx/fire.js LIGHT SLOTS). Measured -35 to -45% of the frame at 203 rooms (82 lights in the shaders, not
  //            208), but the first time a rung of the ladder is outgrown every shader in view is compiled again: under a
  //            second at the table view, 14 s when first zooming out to the whole map. It needs the rungs compiled in the
  //            background first (FIXES.md, "what is still slow"). Try it: ?perfon=lightSlots, tw.perf.set({ lightSlots: true }).
  //   pickNear a pick hands the raycast only what stands near the pointer's ray (nearRay)
  static ROOF_SURFACE = 'sections'; // or 'painted': the flat generated texture (setRoofSurface)
  static ROOF_TIER = 'auto';        // (measurements) 'near' / 'far' pins every roof to one tier
  static PERF = { aoList: true, sleep: true, shadowList: true, freeze: true, lightSlots: false, pickNear: true };
  setPerf(p = {}) { this.perf = { ...AreaWorld.PERF, ...this.perf, ...p }; this.fx?.lighting.setPerf?.({ aoList: this.perf.aoList, shadowList: this.perf.shadowList }); this.fx?.fire.setSlots?.(this.perf.lightSlots); if (!this.perf.sleep) this.wakeAll(); if (!this.perf.freeze) { this.scene.matrixWorldAutoUpdate = true; this.mwManual = false; } return this.perf; }

  // ---------------- WORLD POSITIONS ONLY FOR WHAT MOVED (big maps, 2026-10-06) ----------------
  // three.js works out every node's place in the world again each time it draws the scene (compose from position,
  // rotation and scale; multiply by the parent's): 47,000 nodes at 203 rooms, of which a frame moves none, or one.
  // Here the scene's own automatic pass is off and this one runs once before a camera draws (beforeRender):
  //   the small layers (cursors, signs, pings, flames, roofs, pieces in flight, the ground)   in full, as three.js would
  //   each thing and each floor / wall / post (a group in the two big layers)                 ONE test: has its
  //       position, rotation or scale changed, or what hangs directly under it? Only then is it, and everything
  //       under it, worked out again. Every way a thing moves in the game goes through its group (the state, drags,
  //       the spawn animation, seating on a table top, a room being dragged), and a new mesh or label is a new child.
  //   whatever is selected, hovered, dragged, arriving, riding on one of those, and every pawn      in full, always
  //       (the selection look may lift or pulse the mesh INSIDE the group)
  //   and, as a net under all of it, a few groups in full each frame in turn (every group about every two seconds):
  //       something moved inside a group by code that did not exist when this was written rights itself, late, rather
  //       than staying wrong.
  // Anything that reads world positions between frames asks for this pass first (the picks). perf.freeze = false: off.
  updateMatrices() {
    const sc = this.scene, L = this.layers;
    if (!this.perf?.freeze || this.local) { if (this.mwManual) { sc.matrixWorldAutoUpdate = true; this.mwManual = false; } return; }
    if (!this.mwManual) { sc.updateMatrixWorld(true); sc.matrixWorldAutoUpdate = false; this.mwManual = true; }
    for (const c of sc.children) if (c !== L.shell && c !== L.things) c.updateMatrixWorld();
    // who is "in full, always": worked out again only when the selection, the hover, the drags or the things change
    const D = this.frameDeco, key = `${[...(D?.selected || [])].join()}|${D?.hover || ''}|${[...(this.frameDrags?.keys() || [])].join()}|${[...(this.remoteDrags?.keys() || [])].join()}|${this.itemsGen}`;
    if (key !== this.mwHotKey) {
      this.mwHotKey = key; const ids = new Set([...(D?.selected || []), ...(this.frameDrags?.keys() || []), ...(this.remoteDrags?.keys() || [])]); if (D?.hover) ids.add(D.hover);
      const hot = this.mwHot = new Set();
      if (ids.size) {
        for (const [id, r] of this.recs) { const e = r.entity; if (ids.has(id) || (e.parent && ids.has(e.parent)) || (e.room && ids.has(e.room))) hot.add(r.group); }
        for (const s of this.shell.values()) if ((s.group.userData.edgeKey && ids.has('wall:' + s.group.userData.edgeKey)) || ids.has(s.roomId)) hot.add(s.group);
      }
    }
    const hot = this.mwHot, anim = this.anims.size > 0; let n = 0;
    for (const g of L.things.children) n += this.touchGroup(g, g.userData.pawn || hot.has(g) || (anim && this.anims.has(g)));
    for (const g of L.shell.children) n += this.touchGroup(g, hot.has(g) || (anim && this.anims.has(g)));
    // the net: a few groups in full, in turn
    for (const kids of [L.things.children, L.shell.children]) { const N = kids.length; if (!N) continue; const k = Math.max(4, Math.ceil(N / 120)); let i = (kids === L.things.children ? (this.mwAt1 || 0) : (this.mwAt2 || 0)) % N; for (let j = 0; j < k && j < N; j++, i = (i + 1) % N) kids[i].updateMatrixWorld(true); if (kids === L.things.children) this.mwAt1 = i; else this.mwAt2 = i; }
    this.mwStats = { touched: n, at: performance.now() }; this.mwStale = false; this.mwGen = THREE.Object3D.prototype.__twGraph?.gen; // (the scene graph's counter, fx/lighting.js: a mesh that arrived, a room that woke)
  }
  settleMatrices() { if (this.perf?.freeze && !this.local) { const G = THREE.Object3D.prototype.__twGraph; if (this.mwStale !== false || !G || G.gen !== this.mwGen || this.anims.size) this.updateMatrices(); } else this.scene.updateMatrixWorld(); } // (before a pick or a ray between frames; nothing to do when nothing has moved since the last frame was drawn)
  touchGroup(g, always) {
    const p = g.position, q = g.quaternion, k = g.scale, kids = g.children, m = g.userData.mw ||= new Float64Array(11);
    if (!always && !g.matrixWorldNeedsUpdate && m[0] === p.x && m[1] === p.y && m[2] === p.z && m[3] === q.x && m[4] === q.y && m[5] === q.z && m[6] === q.w && m[7] === k.x && m[8] === k.y && m[9] === k.z && m[10] === kids.length && g.userData.mwKid === kids[0]) return 0;
    m[0] = p.x; m[1] = p.y; m[2] = p.z; m[3] = q.x; m[4] = q.y; m[5] = q.z; m[6] = q.w; m[7] = k.x; m[8] = k.y; m[9] = k.z; m[10] = kids.length; g.userData.mwKid = kids[0];
    g.updateMatrixWorld(true); return 1;
  }

  // ---------------- SLEEP: far buildings are out of the scene (big maps, 2026-10-06) ----------------
  // WHY. Every frame three.js walks every node of the scene several times (world positions, the main picture, each face
  // of the fire's shadow), and so does the game (poses, the cut, lamps). A node that is culled or hidden is still
  // walked, so the frame followed the size of the WHOLE map: 63% of it at 203 rooms was things nowhere near the view.
  // WHAT. The unit is the ROOM: its floor, walls and posts, the things that belong to it, and its roof. (Rooms, not
  // whole buildings, so that at the edge of the view only the near rooms of a building are in the scene; a far
  // building is all of its rooms asleep.) A unit is ASLEEP when it is not in the scene graph at all: its groups keep
  // everything (meshes, materials, positions, cut and shadow flags), they are just not children of the layers, and the
  // per-frame passes skip them. Nothing is unloaded, so waking is putting the groups back: no loading, no pop.
  // Pawns, things that belong to no room, cursors, pings, selection signs and the fire LIGHTS never sleep: a sleeping
  // fire loses its flame and smoke, which nobody can see from there, and keeps its light, because three.js compiles its
  // shaders again for every new light count (a freeze of seconds on a big map). (perf.lightSlots, off: the lights sleep
  // too and dark stand-ins keep the count on a ladder: fx/fire.js LIGHT SLOTS. Not ready: see PERF.)
  // WHEN. A unit is awake whenever any part of its box is within WAKE_MARGIN ft of what any camera on this area sees
  // (the main view, the picture-in-picture, an area picture being taken): the test is against the camera's view
  // volume, so it follows panning, turning, pitch and zoom, and zoomed out to the whole map everything is awake. It is
  // woken in the SAME frame, before that frame is drawn (beforeRender), so it is there before it can be seen. WAKE_MARGIN
  // is 40 ft because that is as far as anything of an unseen building reaches INTO the picture: a fire's light and its
  // shadow carry 30 ft at the house look, a tall chimney or tree leans in a few feet; and it leaves room for the one
  // frame by which flames and the shadow map follow a waking. A unit goes back to sleep only when it has been more
  // than SLEEP_MARGIN ft outside every view for SLEEP_DWELL ms, a few at a time: no flapping at the edge.
  // ALWAYS AWAKE: a unit with anything selected, hovered or being dragged (here or by another seat), and everything
  // while a fly-away is in the air.
  // NOT LOST. State keeps arriving for sleeping things exactly as for waking ones (sync, place, the cut pass, the
  // shadow marks all work on the group whether or not it is in the scene); a new thing or wall of a sleeping unit is
  // made asleep; a thing that moves to another unit, or out of its building's box, changes sides at once.
  buildUnits(ents) {
    const sig = [], by = new Map();
    for (const e of Object.values(ents)) {
      if (e.kind !== 'room' || !e.recipe) continue;
      const c = e.recipe, y = HT.roomY(c), top = HT.roomTop(ents, e); sig.push(`${e.id}:${e.building || ''}:${c.x}:${c.z}:${c.w}:${c.d}:${y}:${top}`);
      by.set(e.id, { id: e.id, building: e.building || null, x0: c.x * CELL, z0: c.z * CELL, x1: (c.x + c.w) * CELL, z1: (c.z + c.d) * CELL, y0: y - 1, y1: top + UNIT_ROOF });
    }
    const key = sig.sort().join('|'); if (key === this.unitKey) return false; this.unitKey = key;
    const was = this.units || new Map(); this.units = by;
    for (const u of by.values()) { const o = was.get(u.id); u.asleep = !!o?.asleep; u.seen = o?.seen; }
    this.roomUnit = { get: (id) => (by.has(id) ? id : undefined) }; // (a room is its own unit; kept as a lookup so the unit could be made coarser again)
    return true;
  }
  // which unit a thing sleeps with: its room's, while it stands inside that room's box (a thing carried away from its
  // room but still counted to it does not vanish with it); pawns and things of no room: none
  unitOf(e) {
    if (!e || e.kind !== 'object' || !e.room) return null;
    const u = this.units?.get(this.roomUnit?.get(e.room)); if (!u) return null;
    return e.x >= u.x0 - UNIT_PAD && e.x <= u.x1 + UNIT_PAD && e.z >= u.z0 - UNIT_PAD && e.z <= u.z1 + UNIT_PAD ? u.id : null;
  }
  unitAsleep(id) { return !!(id && this.units?.get(id)?.asleep); }
  // one thing / shell piece / roof in or out of the scene (its unit decides; this only makes the group agree)
  sleepRec(r) { if (r.asleep) return; const g = r.group, a = this.anims.get(g); if (a) { this.endAnim(g, a); g.visible = !g.userData.cutHidden; } g.parent?.remove(g); r.asleep = true; if (r.it) r.it.asleep = true; }
  wakeRec(r) { if (!r.asleep) return; r.asleep = false; if (r.it) r.it.asleep = false; if (!this.recs.has(r.entity.id)) return; this.poseRec(r, r.entity.id); this.layers.things.add(r.group); }
  sleepShell(s) { if (s.asleep) return; const g = s.group, a = this.anims.get(g); if (a) { this.endAnim(g, a); g.visible = (this.wallsOn || s.spec.layer === 'floor') && !g.userData.cutHidden; } g.parent?.remove(g); s.asleep = true; }
  wakeShell(s) { if (!s.asleep) return; s.asleep = false; if (this.shell.get(s.key) !== s) return; const sh = this.roomShifts?.get(s.roomId); s.group.position.set(s.spec.x + (sh?.dx || 0), s.spec.y || 0, s.spec.z + (sh?.dz || 0)); s.shifted = !!sh; this.layers.shell.add(s.group); }
  // make every group agree with its unit's state: all of them, or only those of the units named
  applySleep(only = null) {
    const want = (unit) => this.unitAsleep(unit);
    for (const r of this.recs.values()) { if (only && !only.has(r.unit)) continue; if (r.entity.kind !== 'object') continue; const z = want(r.unit) || !!r.nap; if (z && !r.asleep) this.sleepRec(r); else if (!z && r.asleep) this.wakeRec(r); }
    for (const s of this.shell.values()) { if (only && !only.has(s.unit)) continue; const z = want(s.unit); if (z && !s.asleep) this.sleepShell(s); else if (!z && s.asleep) this.wakeShell(s); }
    for (const rec of this.roofRecs?.values() || []) { const unit = this.roomUnit?.get(rec.id); if (only && !only.has(unit)) continue; const z = want(unit); if (z && !rec.asleep) { rec.group.parent?.remove(rec.group); rec.asleep = true; } else if (!z && rec.asleep) { rec.asleep = false; this.roofLayer.add(rec.group); } }
    this.shadowKey = null; this.sleepGen = (this.sleepGen || 0) + 1;
  }
  wakeAll() { if (!this.units) return; let n = 0; for (const u of this.units.values()) if (u.asleep) { u.asleep = false; n++; } if (n) this.applySleep(); }
  // is the unit's box within `margin` ft, along the ground, of this camera's view volume? (the box's corner nearest the
  // inside of each of the six planes; never says "far" of a box that is near, says "near" of a few just past a corner)
  unitNear(u, margin) { const P = _fr.planes; for (let i = 0; i < 6; i++) { const n = P[i].normal; if (n.x * (n.x >= 0 ? u.x1 + UNIT_PAD : u.x0 - UNIT_PAD) + n.y * (n.y >= 0 ? u.y1 : u.y0) + n.z * (n.z >= 0 ? u.z1 + UNIT_PAD : u.z0 - UNIT_PAD) + P[i].constant < -margin * Math.hypot(n.x, n.z)) return false; } return true; } // (the margin is feet ALONG THE GROUND: a plane that leans counts for less)
  // BEFORE A CAMERA DRAWS THIS AREA: everything it could see is in the scene. Called by main.js for each view once its
  // camera has moved for this frame (and by anything else that draws the area: an area picture).
  beforeRender(camera) { const n = this.wakeFor(camera); this.updateMatrices(); return n; } // (and every world position it will draw with is current)
  wakeFor(camera) {
    if (!this.units?.size || !this.sleeping) return 0;
    _fr.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    let woke = null;
    for (const u of this.units.values()) if (u.asleep && this.unitNear(u, WAKE_MARGIN)) { u.asleep = false; u.seen = performance.now(); (woke ||= new Set()).add(u.id); }
    if (woke) { const t0 = performance.now(); this.applySleep(woke); this.sleeping -= woke.size; this.wakes = (this.wakes || 0) + woke.size; this.lastWake = { units: woke.size, ms: +(performance.now() - t0).toFixed(2), at: t0 }; }
    return woke ? woke.size : 0;
  }
  // every frame: who must stay awake, and who has been out of every view long enough to sleep (viewers: the cameras
  // looking at this area, set by main.js; none = nobody is looking, so everything may sleep)
  sleepStep(now, deco, localDrags, presence) {
    if (!this.units) return;
    const hurry = !!this.busy?.(); // the hand is moving (interact.js): rooms are woken as ever, none is put to sleep
    if (!this.perf?.sleep || this.local) { if (this.sleeping) { this.wakeAll(); this.sleeping = 0; } return; }
    const force = new Set(), unitOfId = (id) => { if (!id) return; if (id.startsWith?.('wall:')) { const rid = this.roomOfWall(id.slice(5)); if (rid) force.add(this.roomUnit.get(rid)); return; } if (id.startsWith?.('roof:')) { force.add(this.roomUnit.get(id.slice(5))); return; } const r = this.recs.get(id); if (!r) return; const e = r.entity; if (e.kind === 'room') force.add(e.id); else if (e.kind === 'building') { for (const u of this.units.values()) if (u.building === e.id) force.add(u.id); } else if (r.unit) force.add(r.unit); };
    for (const id of deco?.selected || []) unitOfId(id); unitOfId(deco?.hover);
    for (const id of localDrags?.keys() || []) unitOfId(id);
    for (const id of this.roomShifts?.keys() || []) unitOfId(id);
    for (const id of this.remoteDrags?.keys() || []) unitOfId(id);
    const busy = this.cutFly.busy(), cams = this.viewers || [];
    let wake = null, sleep = null;
    for (const cam of cams.length ? cams : [null]) {
      if (cam) _fr.setFromProjectionMatrix(_pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      for (const u of this.units.values()) if (busy || force.has(u.id) || (cam && this.unitNear(u, SLEEP_MARGIN))) u.seen = now;
    }
    for (const u of this.units.values()) {
      if (u.asleep) { if (u.seen === now && (busy || force.has(u.id))) { u.asleep = false; (wake ||= new Set()).add(u.id); } continue; } // (in view again: beforeRender wakes it, with the camera where it will be drawn from)
      if (u.seen === now) continue;
      if (u.seen === undefined || (!hurry && now - u.seen > SLEEP_DWELL)) { if (u.seen !== undefined && sleep && sleep.size >= SLEEP_PER_FRAME) continue; u.asleep = true; (sleep ||= new Set()).add(u.id); }
    }
    if (wake || sleep) { this.applySleep(new Set([...(wake || []), ...(sleep || [])])); this.sleeping = [...this.units.values()].filter(u => u.asleep).length; }
  }
  // SMALL THINGS NAP WHILE THE HAND MOVES (interact.js, stage 3). With this.napPx set, a thing whose largest side is
  // under that many pixels on screen is out of the scene, exactly as a sleeping room's things are (same switch: its
  // flame is not drawn, its light stays); with napPx 0 they all come back. Only ever asked for while the view is being
  // moved and frames run over time, so it matters zoomed far out on a big map, where a mug is a pixel or two.
  // Never: pawns, what is selected, hovered or dragged, and what is arriving. `all`: look at every thing now (a stage
  // going on or off); else every sixth frame (the zoom changes while the hand moves).
  napStep(camera, viewH, all = false) {
    const px = this.napPx || 0; if (!px && !this.napping) return 0;
    if (!all && (this.napTick = (this.napTick || 0) + 1) % 6) return 0;
    const K = viewH / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)), c = camera.position, D = this.frameDeco, hot = (id) => D?.selected?.has(id) || D?.hover === id || this.frameDrags?.has(id);
    let n = 0, changed = 0;
    for (const [id, r] of this.recs) {
      const e = r.entity; if (e.kind !== 'object' || (r.asleep && !r.nap)) continue;
      let nap = false;
      if (px && !hot(id) && !(e.parent && hot(e.parent)) && !this.anims.has(r.group)) { const d = e.dims || [2, 2, 2], size = Math.max(d[0], d[1], d[2]) * (e.libK || 1) * K / Math.hypot(e.x - c.x, (e.y || 0) - c.y, e.z - c.z); nap = size < (r.nap ? px * 1.3 : px); } // (a little more to come back than to go: no flicker at the edge)
      if (nap !== !!r.nap) { r.nap = nap; changed++; const z = nap || this.unitAsleep(r.unit); if (z && !r.asleep) this.sleepRec(r); else if (!z && r.asleep) this.wakeRec(r); }
      if (nap) n++;
    }
    if (changed) { this.shadowKey = null; this.sleepGen = (this.sleepGen || 0) + 1; }
    return this.napping = n;
  }
  // (tests, measurements) { units, asleep, things: [awake, asleep], shell: [awake, asleep], wakes, lastWake }
  sleepStats() { let ra = 0, rz = 0, sa = 0, sz = 0; for (const r of this.recs.values()) if (r.entity.kind === 'object') r.asleep ? rz++ : ra++; for (const s of this.shell.values()) s.asleep ? sz++ : sa++; return { on: !!this.perf?.sleep, napping: this.napping || 0, units: this.units?.size || 0, asleep: [...(this.units?.values() || [])].filter(u => u.asleep).map(u => u.id), things: [ra, rz], shell: [sa, sz], wakes: this.wakes || 0, lastWake: this.lastWake || null }; }

  // the area's rooms, and their heights: kept for as long as the state is the same object (it was a walk over every
  // entity, several times a frame and on every pointer move)
  roomsNow() { const E = this.view?.entities; if (E !== this.roomsOfE) { this.roomsOfE = E; this.roomsKept = E ? Object.values(E).filter(e => e.kind === 'room') : []; this.roomYsKept = null; } return this.roomsKept; }
  roomYsNow() { this.roomsNow(); return this.roomYsKept ||= [...new Set(this.roomsKept.map(r => HT.roomY(r.recipe)))].sort((a, b) => b - a); }
  itemsOfRoom(rid) {
    if (this.roomItemsGen !== this.itemsGen) { const m = this.roomItems = new Map(); for (const r of this.recs.values()) if (r.it) { const a = m.get(r.it.roomId); if (a) a.push(r.it); else m.set(r.it.roomId, [r.it]); } this.roomItemsGen = this.itemsGen; }
    return this.roomItems.get(rid) || [];
  }

  // rooms for the atmosphere (fog height by room type, a room's own `fog` setting from the room menu's Fog height
  // slider; outdoor rooms). fogPreview: Map(room id -> ft | null) while that slider is being dragged (local, not sent)
  // FOG AND STOREYS (Stage G). The fog is one sheet on one floor: the level in view. Cut off, or on the ground storey:
  // the ground, exactly as before storeys (ground-level rooms and their walls only, so an upper floor or a cellar can
  // neither get ground fog nor block it). Cut on an upper storey or below ground: that level's rooms' own fog at that
  // floor's height, and no outdoor fog or sea there (fx/atmos.js setLevel).
  fogLevel() {
    const cut = this.cut ?? null; if (cut == null) return 0;
    this.cutSets(); let top = -Infinity;
    if (this.fogLevelGen === this.cutGen && this.fogLevelCut === cut) return this.fogLevelKept; // (the same until the cut or the rooms change)
    for (const e of this.roomsNow()) if (e.recipe && !this.cutHidden.has(e.id)) top = Math.max(top, HT.roomY(e.recipe));
    this.fogLevelGen = this.cutGen; this.fogLevelCut = cut; return this.fogLevelKept = !Number.isFinite(top) ? 0 : cut >= 0 ? Math.max(0, top) : top;
  }
  fogStructure() { const L = this.fogLevel(), E = this.view?.entities || {}, out = []; for (const s of this.shell.values()) { if (s.spec.slab || s.spec.support || s.spec.stack || s.spec.rail) continue; const rm = E[s.roomId]; if (rm?.recipe ? HT.roomY(rm.recipe) === L : L === 0) out.push(s); } return out; }
  fogRooms() { const out = [], L = this.fogLevel(); for (const e of Object.values(this.view?.entities || {})) if (e.kind === 'room' && e.recipe && HT.roomY(e.recipe) === L) { const r = e.recipe; out.push({ id: e.id, ...(r.outline ? { poly: FP.polyFeet(r) } : { rect: [r.x * CELL, r.z * CELL, (r.x + r.w) * CELL, (r.z + r.d) * CELL] }), type: r.type, outdoor: !!T.walls?.isOutdoor?.(r.type), height: this.fogPreview?.has(e.id) ? this.fogPreview.get(e.id) : e.fog ?? HT.fogDefault(this.view.entities, e) }); } return out; } // (an upper storey has no fog unless the room was given its own: core fogDefault)
  // things the fire system sees: object items that are visible and lit (an extinguished candle has no flame)
  // LAMPS BELONG TO THEIR ROOM (docs/VERTICAL.md): a lamp in a room that is not visible is switched off: above the cut
  // (its group is hidden: cutPass), or wholly under a visible floor (roomCovered: nothing of it can be seen from above).
  fxItems() { const out = []; this.cutSets(); for (const r of this.recs.values()) if (r.it && r.entity.lit !== false && (this.noLampRule || (r.group.visible && !(r.entity.room && this.coveredRooms.has(r.entity.room))))) out.push(r.it); return out; } // (noLampRule: tests measure the cost without the rule)
  litCount() { return this.fxItems().length; } // (tests)

  // ---------------- THE CUT (storeys, Stage C; surfaces/cut.js owns the state) ----------------
  // cut: a height in feet, or null = off. Shown iff base <= cut (core visibleAt). A ROOM shows whole or not at all: its
  // floor, slab, walls, posts and supports, and every thing that belongs to it (so a stair or a tall thing that pokes
  // through the cut is whole: geometry is never sliced). Loose things and pawns go by their own height.
  // Hidden pieces get group.visible = false (cutPass, every frame) and are left out of every raycast (pickAll,
  // surfaceAt, surfaceBelow; floorPoint takes the cut as `max`), so a hidden level can never catch a click.
  setCut(y) {
    y = y == null ? null : y;
    if (this.cutLift) { this.cutLift.y = y; return; } // lifted for a picture (liftCut): it lands when the picture is taken
    this.cutDirty = true;
    if (y === this.cut) return;
    this.cut = y; this.floorMax = y ?? Infinity; this.roofPass?.();
    this.groundOpen = y != null && y < 0; this.rebuildGround(); // the ground opens over the below-ground rooms being shown
  }
  // ---------------- ROOFS (storeys, Stage F; Harry 2026-10-05: "A roof is basically a kind of room") ----------------
  // DERIVED, never entities: client/roofs.js works the shapes out from the rooms (one roof per room with nothing of its
  // building above it; the open part of a lower storey is a flat deck; joined rooms' roofs run into each other). The
  // surface is one of the four generated roofing textures; the trim (a chimney over each fireplace, a rare dormer, a
  // ledge round a flat roof) is placed by rule and drawn with the game's ordinary object visuals where the piece is in
  // the library, a plain stand-in where it is not. Only the STYLE is data (building.roof, room.roof: core/height.js).
  // Roofs are a per-seat VIEW SWITCH (app.roofs, surfaces/cut.js): off by default. On, a roof shows when the cut is off
  // or at / above the top of its room (its base). A room under a roof that is showing is covered: no label, lamps out.
  // A hidden room gets no roof on the GM's side either (players never have the room at all).
  setRoofs(on) { on = !!on; if (on === !!this.roofsOn) return; if (on) this.roofsLanding = true; else this.cutFly?.leaveRoofs(); this.roofsOn = on; this.cutDirty = true; this.roofKey = null; this.syncRoofs(); }
  roofInputs(ents) {
    const E = ents, rooms = [], fam = new Map();
    try { for (const r of this.roomgen?.roomsOf(E) || []) fam.set(r.id, r.family); } catch { }
    const famOf = (r) => fam.get(r.id);
    for (const e of Object.values(E)) {
      if (e.kind !== 'room' || !e.recipe || HT.roomY(e.recipe) < 0 || T.walls?.isOutdoor?.(e.recipe.type)) continue; // no roof below ground or over a yard
      const c = e.recipe, none = !!e.roof?.off || !!e.hidden;
      rooms.push({ id: e.id, building: e.building || e.id, x: c.x, z: c.z, w: c.w, d: c.d, ...(c.outline && { outline: c.outline }), y: HT.roomY(c), top: HT.ceilingOf(E, e), style: HT.roofStyleOf(E, e, famOf), seed: e.roof?.seed ?? c.seed ?? 1, ...(none && { props: false, none: true }) });
    }
    const fires = Object.values(E).filter(e => e.kind === 'object' && FIRE_RE.test(e.cat || '') && (e.y || 0) >= 0 && !(e.hidden)).map(e => ({ id: e.id, x: e.x, z: e.z }));
    return { rooms, fires };
  }
  syncRoofs(ents = this.view?.entities || {}) {
    this.roofRecs ||= new Map();
    if (!this.roofsOn || !this.roomgen) { if (this.roofRecs.size) { for (const id of [...this.roofRecs.keys()]) this.dropRoof(id); this.cutDirty = true; } this.roofKey = null; return; }
    const { rooms, fires } = this.roofInputs(ents), key = JSON.stringify([rooms, fires]);
    if (key === this.roofKey) return;
    this.roofKey = key; this.cutDirty = true;
    const lib = this.assets.lib, has = (id) => !!lib.objects[id] && !!this.roomgen.sizeOf(id);
    const plan = this.roofPlan = RF.planRoofs(rooms, { fires, has });
    const none = new Set(rooms.filter(r => r.none).map(r => r.id));
    if (!this.roofLayer) { this.roofLayer = new THREE.Group(); this.roofLayer.name = 'roofs'; this.scene.add(this.roofLayer); }
    const tex = roofTextures(lib);
    // the surface: modelled sections (the default), or the painted flat surface (`painted`: the look before 2026-10-11, kept for comparing)
    const painted = AreaWorld.ROOF_SURFACE === 'painted', kits = painted ? null : roofSections(() => { if (this.roofsOn && this.roofSurfaceBuilt !== this.roofSurfaceKey()) { this.cutFly?.flush(); this.roofKey = null; this.syncRoofs(); } }); // (the files came after the roofs were drawn: a slow line. Roofs in flight land first, then every roof is rebuilt in sections)
    const surfaceKey = this.roofSurfaceBuilt = this.roofSurfaceKey();
    const want = new Map(plan.roofs.filter(r => !none.has(r.room)).map(r => [r.room, r]));
    for (const id of [...this.roofRecs.keys()]) if (!want.has(id) || this.roofRecs.get(id).sig !== JSON.stringify(want.get(id)) || this.roofRecs.get(id).surface !== surfaceKey) this.dropRoof(id);
    for (const [id, roof] of want) {
      if (this.roofRecs.has(id)) continue;
      const group = RF.buildRoof(roof, { THREE, textures: tex, sections: kits, wallColor: ROOF_WALL });
      group.userData.roofOf = id;
      const b = new THREE.Box3().setFromObject(group);
      const rec = { id, roof, group, sig: JSON.stringify(roof), surface: surfaceKey, base: roof.top + 1, box: b, props: [] };
      for (const p of roof.props) this.addRoofProp(rec, p);
      this.addRidge(rec);
      if (this.unitAsleep(this.roomUnit?.get(id))) rec.asleep = true; else this.roofLayer.add(group);
      this.roofRecs.set(id, rec);
      if (this.roofsLanding) group.visible = false; // roofs just switched on: the roof pass shows it, and it flies down (cutfly.js)
    }
    this.roofsLanding = false; this.roofTierAt = 0;
    this.roofPass();
  }
  roofSurfaceKey() { return AreaWorld.ROOF_SURFACE === 'painted' ? 'painted' : 'sections:' + Object.keys(_roofKits).sort().join(); }
  // ONE SWITCH between the modelled roof sections and the painted flat surface they replaced (tw.roofSurface('painted'),
  // ?roofsurface=painted, the command bar): every roof is rebuilt in the other surface, nothing else changes
  setRoofSurface(mode) { AreaWorld.ROOF_SURFACE = mode === 'painted' ? 'painted' : 'sections'; if (this.roofsOn) { this.roofKey = null; this.syncRoofs(); } return AreaWorld.ROOF_SURFACE; }
  // WHICH TIER EACH ROOF WEARS: the modelled sections within SECTION.near ft of the eye, the flat far tier (two
  // triangles a section, a normal map) beyond SECTION.far; in between a roof keeps what it has, so nothing flickers.
  // A few times a second, one distance per roof; a roof in flight or asleep is left as it is.
  roofTiers(camera, now = performance.now()) {
    if (!this.roofRecs?.size || !camera || now - (this.roofTierAt || 0) < 200) return;
    this.roofTierAt = now; const { near, far } = RF.SECTION, k = AreaWorld.ROOF_TIER; let n = 0;
    for (const rec of this.roofRecs.values()) {
      const T = rec.group.userData.roofTiers; if (!T) continue;
      const d = rec.box.distanceToPoint(camera.position), want = k === 'near' ? true : k === 'far' ? false : d < near ? true : d > far ? false : T.isNear;
      if (RF.setRoofTier(rec.group, want)) n++;
    }
    if (n) this.shadowKey = null;
  }
  // (tests, measurements) what the roof sections cost: copies, triangles drawn at each tier, how many roofs wear which
  roofSectionReport() { const out = { surface: AreaWorld.ROOF_SURFACE, roofs: 0, near: 0, far: 0, copies: 0, whole: 0, split: 0, tris: 0, kits: Object.keys(_roofKits) }; for (const rec of this.roofRecs?.values() || []) { const T = rec.group.userData.roofTiers; if (!T) continue; out.roofs++; out.copies += T.count; out.whole += T.whole; out.split += T.split; if (T.isNear) { out.near++; out.tris += T.count * T.tris; } else { out.far++; out.tris += T.count * 2; } } return out; }
  dropRoof(id) { const rec = this.roofRecs.get(id); if (!rec) return; rec.group.parent?.remove(rec.group); rec.group.traverse(o => { if (o.isMesh) o.geometry?.dispose?.(); }); this.roofRecs.delete(id); this.dropHalos('roof:' + id); }
  // ONE PIECE OF TRIM. The vertical kit's own piece where the library has it (roofPiece below: which sku for this roof's
  // material, its stated box, how it is turned and seated), fitted BY MEASURING THE MESH (kitfit.js); a plain stand-in box
  // where the library has none. A chimney keeps its proportions: a taller stack is CHOSEN for a longer rise and the
  // spare length is sunk into the roof, never stretched. A dormer is sunk until its front stands on the slope.
  addRoofProp(rec, p) {
    const holder = new THREE.Group(); holder.position.set(p.x, p.y, p.z); holder.rotation.y = p.rot || 0; holder.userData.roofOf = rec.id; holder.userData.roofProp = p.role;
    const stand = RF.propStandIns({ room: rec.id, props: [{ ...p, x: 0, y: 0, z: 0, rot: 0 }] }, { THREE }); holder.add(stand);
    const K = roofPiece(this.assets.lib, p, rec.roof, (x, z) => this.roofPlan?.heightAt(x, z));
    const info = { role: p.role, cat: K?.cat ?? p.cat, sku: K?.sku || null, standIn: !K, wants: p.wants, x: p.x, y: p.y, z: p.z, dims: p.dims, fire: p.fire ?? null };
    rec.group.add(holder); rec.props.push(info); holder.userData.kitSku = K?.sku || null;
    if (!K) return;
    this.assets.template(K.url).then(scene => {
      if (!scene || this.roofRecs.get(rec.id) !== rec) return;
      const fit = KF.fitPiece(THREE, scene.clone(true), K.dims, K.fit); fit.position.y = K.dy || 0; fit.rotation.y = K.yaw || 0;
      holder.remove(stand); holder.add(fit); holder.userData.sku = K.sku; holder.traverse(o => { o.userData.roofOf = rec.id; });
      holder.userData.loaded = true; this.shadowKey = null; this.cutDirty = true;
    }).catch(() => { });
  }
  // THE RIDGE CAP: the kit's 5-ft ridge sections laid end to end along every ridge (thatch has its own raised ridge;
  // lead for the rest), each run divided into whole sections; the drawn strip stays where the library has no ridge piece
  addRidge(rec) {
    const style = rec.roof.style, sku = KF.pickSku(this.assets.lib, 'roof-ridge', [style === 'thatch' ? 'thatch' : 'lead']);
    rec.ridge = { sku: sku?.sku || null, standIn: !sku, n: 0, loaded: 0 };
    if (!sku || !rec.roof.ridges.length) return;
    const box = KF.statedBox(this.assets.lib, 'roof-ridge', sku.sku) || [5, 0.75, 1.2], sink = style === 'thatch' ? 0.33 : 0.12;
    const drawn = rec.group.children.find(c => c.userData.roofPart === 'ridge');
    for (const { a, b } of rec.roof.ridges) {
      const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.round(L / CELL)), alongX = Math.abs(b[0] - a[0]) > Math.abs(b[2] - a[2]);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, holder = new THREE.Group(); holder.position.set(a[0] + (b[0] - a[0]) * t, a[1] - sink, a[2] + (b[2] - a[2]) * t); holder.rotation.y = alongX ? 0 : Math.PI / 2;
        holder.userData.roofOf = rec.id; holder.userData.roofProp = 'ridge'; holder.userData.sku = holder.userData.kitSku = sku.sku; rec.group.add(holder); rec.ridge.n++;
        this.assets.template(sku.url).then(scene => {
          if (!scene || this.roofRecs.get(rec.id) !== rec) return;
          const fit = KF.fitPiece(THREE, scene.clone(true), [L / n + 0.04, box[1], box[2]], { long: 'x' }); holder.add(fit); holder.traverse(o => { o.userData.roofOf = rec.id; });
          if (drawn?.parent) drawn.parent.remove(drawn); // the real cap is on: the drawn strip goes
          rec.ridge.loaded++; this.shadowKey = null; this.cutDirty = true;
        }).catch(() => { });
      }
    }
  }
  // (tests) every kit piece now drawn, MEASURED where it stands (world feet): supports, roof trim, ridge sections, stairs.
  // { kind, role, sku, standIn, loaded, room, min, max, lowAt: where its low third sits along world x and z (-1..1) }
  kitReport() {
    const out = [], M = (g) => { const m = KF.measure(THREE, g); return m ? { min: m.min.map(r2), max: m.max.map(r2), lowAt: m.lowAt.map(r2) } : { min: null, max: null, lowAt: null }; }, r2 = (v) => Math.round(v * 100) / 100;
    for (const s of this.shell.values()) if (s.spec.support) out.push({ kind: 'support', role: s.spec.support, sku: s.spec.sku || null, standIn: !!s.spec.standIn, loaded: !!s.visual && !s.visual.userData?.placeholder, room: s.roomId, at: [s.spec.x, s.spec.y, s.spec.z], ...M(s.group) });
    for (const rec of this.roofRecs?.values() || []) for (const h of rec.group.children) if (h.userData.roofProp) out.push({ kind: 'roof', role: h.userData.roofProp, sku: h.userData.kitSku || null, standIn: !h.userData.kitSku, loaded: h.userData.roofProp === 'ridge' ? h.children.length > 0 : !!h.userData.loaded, room: rec.id, style: rec.roof.style, ridgeY: rec.roof.ridgeY, at: h.position.toArray().map(r2), roofAt: this.roofPlan?.heightAt(h.position.x, h.position.z) ?? null, ...M(h) });
    for (const r of this.recs.values()) if (ST.isConnector(r.entity)) out.push({ kind: 'stair', role: ST.stairKind(r.entity), sku: r.entity.sku || null, standIn: !!r.visual?.userData?.stair?.standIn, loaded: !!r.visual && !r.visual.userData?.placeholder, room: r.entity.room, at: [r.entity.x, r.entity.y || 0, r.entity.z], rise: ST.stairRise(r.entity), dir: ST.stairDir(r.entity), rot: r.entity.rot || 0, ...M(r.group) });
    return out;
  }
  // which roofs show: the switch is on, and the cut is off or not below the roof's base (the top of its room)
  roofShown(rec) { return !!this.roofsOn && HT.visibleAt(rec.base, this.cut ?? null) && !this.fogRule?.(this.view?.entities[rec.id]); }
  roofPass() { if (!this.roofRecs) return; const fly = this.cutFly; for (const rec of this.roofRecs.values()) { const v = this.roofShown(rec); if (v === rec.group.visible) continue; rec.group.visible = v; if (rec.asleep) continue; if (v) fly?.arrive(rec.group, rec); else fly?.leave(rec.group, rec); } fly?.commit(); } // (a roof the cut or the switch hides flies off: cutfly.js)
  roofBounds(id) { const rec = this.roofRecs?.get(id); return rec ? rec.box.clone() : null; }
  // (tests) what is drawn: per room, style, kind, shown, the trim and which of it is a stand-in
  roofReport() { this.roofPass(); return [...(this.roofRecs?.values() || [])].map(r => ({ room: r.id, style: r.roof.style, kind: r.roof.kind, shown: r.group.visible, base: r.base, ridgeY: r.roof.ridgeY, planes: r.roof.planes.length, standable: r.roof.standable.length, props: r.props, ridge: r.ridge || null })); }
  // a roof under a ray: { id, point, flat } (the nearest roof that is showing), or null
  roofAt(raycaster, asleepToo = false) { // (asleepToo: a ray that is not from the eye, e.g. another seat's cursor over a roof nobody here is looking at)
    if (!this.roofsOn || !this.roofRecs?.size) return null;
    this.roofPass(); raycaster.camera ||= RAY_CAMERA;
    const groups = [...this.roofRecs.values()].filter(r => r.group.visible && (asleepToo || !r.asleep)).map(r => r.group); if (!groups.length) return null;
    this.roofLayer.updateMatrixWorld(true);
    for (const h of raycaster.intersectObjects(groups, true)) { if (h.object instanceof THREE.Sprite) continue; const id = h.object.userData.roofOf; if (id) return { id, point: h.point, distance: h.distance, flat: h.object.userData.roofPart === 'flat' || h.object.userData.roofPart === 'skirt' }; }
    return null;
  }
  // THE CUT LIFTED FOR ONE PICTURE (the area's thumbnail shows every level): liftCut() draws everything until dropLift()
  // puts back the cut WANTED BY THEN. A cut set in between is kept, not lost: the picture is taken a frame later, and
  // putting back the cut remembered before it left the view on the old level while the seat had moved to another
  // (2026-10-06: ground-floor walls drawn and clickable at lv -1).
  liftCut() { if (this.cutLift) return; this.cutFly?.flush(); const y = this.cut ?? null; this.flyMuted = true; try { if (y != null) this.setCut(null); this.cutLift = { y }; this.cutPass(); } finally { this.flyMuted = false; } } // (with no cut on too: one set meanwhile waits for the picture)
  dropLift() { const L = this.cutLift; if (!L) return; this.cutLift = null; this.flyMuted = true; try { this.setCut(L.y); this.cutPass(); } finally { this.flyMuted = false; } } // (no fly-away for a picture)
  // which rooms the cut hides, and which rooms lie wholly under a visible floor (recomputed when the cut or the rooms change)
  cutSets() {
    if (!this.cutDirty && this.cutHidden) return;
    this.cutDirty = false;
    const ents = this.view?.entities || {}, rooms = Object.values(ents).filter(e => e.kind === 'room'), cut = this.cut ?? null;
    this.cutHidden = new Set(rooms.filter(r => !HT.visibleAt(HT.roomY(r.recipe), cut)).map(r => r.id));
    const shown = rooms.filter(r => !this.cutHidden.has(r.id)), covered = new Set();
    for (const r of shown) {
      const top = HT.roomTop(ents, r), above = shown.filter(u => HT.roomY(u.recipe) === top).map(u => u.recipe);
      if (above.length && FP.cellsOf(r.recipe).every(([i, j]) => above.some(u => FP.hasCell(u, r.recipe.x + i, r.recipe.z + j)))) covered.add(r.id);
    }
    const under = new Set(); if (cut == null || cut >= 0) for (const r of shown) if (HT.roomY(r.recipe) < 0) { covered.add(r.id); under.add(r.id); } // under the unopened ground (with the cut off too: the ground is closed then)
    if (this.roofsOn && this.roofRecs) for (const rec of this.roofRecs.values()) if (this.roofShown(rec)) covered.add(rec.id); // under its own roof (Stage F): nobody sees in
    this.coveredRooms = covered;
    // WHAT NOBODY CAN SEE COSTS NOTHING (frame time, 2026-10-06). A covered room's things are not drawn (so they cast no
    // shadow either), except within UNSEEN_KEEP ft of a stair's hole in the floor above, through which the room shows.
    // A room under the unopened ground loses its floor and walls too, by the same rule; a room under an upper floor or
    // its own roof keeps them (its outside walls are the building, and a door or window shows a little floor).
    const near = new Map(); // room id -> [[x0, z0, x1, z1] ...] ft: the holes above it, grown by UNSEEN_KEEP
    for (const id of covered) {
      const r = ents[id], top = HT.roomTop(ents, r), boxes = [];
      for (const k of ST.holesAt(ents, top)) { const [gx, gz] = k.split(':').map(Number); if (FP.hasCell(r.recipe, gx, gz)) boxes.push([gx * CELL - UNSEEN_KEEP, gz * CELL - UNSEEN_KEEP, (gx + 1) * CELL + UNSEEN_KEEP, (gz + 1) * CELL + UNSEEN_KEEP]); }
      near.set(id, boxes);
    }
    this.unseenNear = near; this.unseenUnder = under; this.cutGen = (this.cutGen || 0) + 1;
    // the floors that are drawn, by height, for floorStop (below): the rooms on each, and the cells a stair has opened
    const planes = new Map();
    for (const r of shown) { if (under.has(r.id)) continue; const y = HT.roomY(r.recipe); let P = planes.get(y); if (!P) planes.set(y, P = { y, rooms: [], holes: ST.holesAt(ents, y) }); P.rooms.push(r.recipe); } // (under the closed ground: the ground stops the ray first)
    this.floorPlanes = [...planes.values()];
  }
  // A FLOOR THAT IS DRAWN STOPS THE POINTER (Harry 2026-10-06: "on floor two I can still select things on floor one
  // directly thru the actual floor. (not just things I can see blurry, but the actual physical floor is not flooring.)").
  // The pick went by the list of things and wall pieces; floors, slabs and the ground were never in it, so nothing lay
  // between the pointer and a pawn under an upper floor. The rule: THE POINTER SELECTS WHAT YOU CAN SEE AT THAT SPOT.
  // floorStop is how far along a pointer ray the first drawn floor is: a room's floor (and, upstairs, the underside of
  // its 1-ft slab) wherever the room has floor, less the cells a stair comes up through; and the ground, less where it
  // is opened. Every ray pick stops there (pickAll, surfaceAt; inSight for the selection box). What shows beside a floor,
  // through a stair's hole or down in a yard is reached as before.
  // Worked out, not raycast: a few plane crossings against the rooms that are showing (the list is kept with the cut
  // sets and changes only when the cut, the rooms or the things do). No mesh is touched, so it costs the same whether
  // a building is drawn, asleep or still loading. -> a distance along the ray (its direction is unit length), or Infinity
  floorStop(ray) {
    if (this.noFloorStop) return Infinity; // (tests: the pick as it was)
    this.cutSets();
    const o = ray.origin, d = ray.direction; if (Math.abs(d.y) < 1e-6) return Infinity;
    let best = Infinity;
    const cell = (x, z) => `${Math.floor(x / CELL)}:${Math.floor(z / CELL)}`;
    const solid = (P, x, z, rim = false) => { if (P.holes.size && P.holes.has(cell(x, z))) return false; for (const rc of P.rooms) if (FP.contains(rc, x, z)) return true;
      // the slab runs SLAB_RIM past the room's outer edge, under the wall (core/height.js slabRects): a point there is slab too (not into a hole)
      if (rim) for (const dx of [-HT.SLAB_RIM, 0, HT.SLAB_RIM]) for (const dz of [-HT.SLAB_RIM, 0, HT.SLAB_RIM]) if ((dx || dz) && !P.holes.has(cell(x + dx, z + dz)) && P.rooms.some(rc => FP.contains(rc, x + dx, z + dz))) return true;
      return false; };
    for (const P of this.floorPlanes) {
      const tTop = (P.y - o.y) / d.y;
      if (!(P.y > 0)) { if (tTop > 1e-4 && tTop < best && solid(P, o.x + d.x * tTop, o.z + d.z * tTop)) best = tTop; continue; } // on or below the ground: the floor alone
      // upstairs the floor is the top of a 1-ft slab: the ray is stopped where it first comes into the slab, from above
      // (or below) or through its side (the edge of the floor seen from beside the building, the wall of a stair's hole)
      const tBot = (P.y - HT.SLAB - o.y) / d.y, t0 = Math.max(1e-4, Math.min(tTop, tBot)), t1 = Math.max(tTop, tBot);
      if (t1 <= t0 || t0 >= best) continue;
      if (solid(P, o.x + d.x * t0, o.z + d.z * t0, true)) { best = t0; continue; }
      const ts = []; // where the ray crosses a 5-ft grid line inside the slab's height: a side can only be met there
      for (const [p, v] of [[o.x, d.x], [o.z, d.z]]) { if (Math.abs(v) < 1e-9) continue; const a = p + v * t0, b = p + v * t1; for (const off of [0, HT.SLAB_RIM, -HT.SLAB_RIM]) for (let k = Math.ceil((Math.min(a, b) - off) / CELL), n = 0; k * CELL + off <= Math.max(a, b) && n < 40; k++, n++) ts.push((k * CELL + off - p) / v); } // (the grid lines and the slab rim's faces, 6 in either side of them)
      ts.sort((a, b) => a - b);
      for (let i = 0; i < ts.length; i++) { const t = ts[i]; if (t <= t0 || t >= best) continue; const m = (t + (ts[i + 1] ?? t1)) / 2; if (solid(P, o.x + d.x * m, o.z + d.z * m, true)) { best = t; break; } }
    }
    const tg = (GROUND_Y - o.y) / d.y; if (tg > 1e-4 && tg < best && !this.groundOpenCells?.has(cell(o.x + d.x * tg, o.z + d.z * tg))) best = tg;
    return best;
  }
  // IS ANY OF THIS THING IN SIGHT from the camera, as far as the cut, the floors, the ground and the roofs go? For the
  // selection box, which takes things by their bounds and not by a ray: a box takes what you can see inside it. Six
  // points of the thing (its middle, the middle of its top, its top corners drawn in a little) are each tried against
  // floorStop and, with roofs on, the roofs; one that is not behind any of them is enough (a thing half out from under
  // a floor's edge, or showing through a stair's hole, is still taken). Called once per thing when a box is let go.
  inSight(rec, camera) {
    const e = rec?.entity; if (!rec?.group || !e) return false;
    if (rec.group.userData.cutHidden || this.cutHides(e)) return false; // above the cut, or a covered room's things that are not drawn
    if (this.noFloorStop) return true;
    const b = this.boundsOf(rec); if (!b) return true;
    const o = camera.getWorldPosition(_so), cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, ty = b.max.y - Math.min(0.2, (b.max.y - b.min.y) / 4), ix = (b.max.x - b.min.x) * 0.35, iz = (b.max.z - b.min.z) * 0.35;
    const roofs = this.roofsOn && this.roofRecs?.size ? (_sr.camera = RAY_CAMERA, _sr) : null;
    for (const [x, y, z] of [[cx, (b.min.y + b.max.y) / 2, cz], [cx, ty, cz], [cx - ix, ty, cz - iz], [cx + ix, ty, cz - iz], [cx - ix, ty, cz + iz], [cx + ix, ty, cz + iz]]) {
      _sd.set(x - o.x, y - o.y, z - o.z); const dist = _sd.length(); if (dist < 1e-3) return true; _sd.divideScalar(dist);
      _sr.ray.origin.copy(o); _sr.ray.direction.copy(_sd);
      if (this.floorStop(_sr.ray) < dist - 0.05) continue;
      if (roofs) { const rf = this.roofAt(roofs); if (rf && rf.distance < dist - 0.05) continue; }
      return true;
    }
    return false;
  }
  // is this thing / shell piece of a covered room out of everybody's sight? (see cutSets)
  unseenAt(roomId, x, z) { const bs = this.unseenNear?.get(roomId); return !!bs && !bs.some(b => x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3]); }
  unseenThing(e) { return e.kind === 'object' && !!e.room && !this.noUnseenRule && e.place !== 'stair' && e.place !== 'kit' && !e.fromEdge && this.unseenAt(e.room, e.x, e.z); }
  unseenShell(s) { return !this.noUnseenRule && this.unseenUnder.has(s.roomId) && this.unseenAt(s.roomId, s.spec.x, s.spec.z); }
  // is this entity (or shell piece) hidden by the cut?
  cutHides(e) {
    if (this.cut == null || !e) return false;
    this.cutSets();
    if (e.kind === 'room') return this.cutHidden.has(e.id);
    if (e.kind === 'object' && e.room && this.view?.entities[e.room]) return this.cutHidden.has(e.room);
    if (e.kind === 'token') return !HT.visibleAt(this.pawnLevel(e), this.cut); // BY ITS BASE, not by how high the figure is (a dragon 40 ft over the yard shows with the cut at 20)
    return e.kind === 'object' && !HT.visibleAt(e.y || 0, this.cut);
  }
  // ---------------- A PAWN'S BASE (core/height.js baseUnder; docs/PAWNS.md "A raised pawn") ----------------
  // a room with no top to rest a base on: a yard (and every outdoor room type), a room whose roof is off
  isOpenRoom(e) { return !!e.roof?.off || !!T.walls?.isOutdoor?.(e.recipe?.type); }
  // THE LEVEL A PAWN'S BASE IS ON (feet): what the cut asks. From the data alone (the rooms and the pawn's place), so
  // it is the same for every seat that holds the same rooms; worked out once per state.
  pawnLevel(e) {
    const E = this.view?.entities;
    if (this.levelsOf !== E) { this.levelsOf = E; this.levels = new Map(); this.openRoom ||= (rm) => this.isOpenRoom(rm); }
    let v = this.levels.get(e.id);
    if (v === undefined || v.e !== e) { v = { e, y: HT.baseUnder(E, e.x, e.z, e.y || 0, this.openRoom).y }; this.levels.set(e.id, v); }
    return v.y;
  }
  // WHERE THE BASE IS DRAWN for a pawn whose figure is at (x, y, z) right now (a drag, a lift): its level, or higher when
  // something stands there: the top of a thing under it (a table: the same downward look a released, lifted thing
  // lands by, surfaceBelow) or, with my roofs showing, the roof's own surface over a room's top (a pitch, not the deck
  // inside it). Asked again only when the pawn, the things or the view changed, or after PAWN_BEAM.recheckMs.
  pawnBaseAt(r, x, y, z) {
    const E = this.view?.entities, now = performance.now(), key = `${x.toFixed(2)}|${y.toFixed(2)}|${z.toFixed(2)}|${this.itemsGen}|${this.cut}|${!!this.roofsOn}`, c = r.baseAt;
    if (c && c.key === key && c.E === E && now - c.t < PAWN_BEAM.recheckMs) return c.y;
    this.openRoom ||= (rm) => this.isOpenRoom(rm);
    const b = HT.baseUnder(E, x, z, y, this.openRoom); let by = b.y, on = b.on;
    if (y - by > PAWN_BEAM.min) {
      const sb = this.surfaceBelow(x, y, z, new Set([r.entity.id]), by); if (sb && sb.y > by && sb.y <= y) { by = sb.y; on = 'thing'; }
      if (b.on === 'top' && this.roofsOn && this.roofRecs?.size) { // (a pitch: the highest of the roof under the base's middle and its rim, so the disc lies ON the slope, not half inside it)
        const rad = (r.visual?.userData.base?.userData.radius || 1.7) * 0.9;
        for (const [dx, dz] of [[0, 0], [rad, 0], [-rad, 0], [0, rad], [0, -rad]]) { _down.set(new THREE.Vector3(x + dx, y + 0.05, z + dz), DOWN); const rf = this.roofAt(_down, true); if (rf && rf.point.y > by && rf.point.y <= y) { by = rf.point.y; on = 'roof'; } }
      }
    }
    r.baseAt = { key, E, t: now, y: by, level: b.y, on, room: b.room };
    return by;
  }
  // put a pawn's base `drop` feet under its figure (0: the pawn stands on it, as a pawn always did)
  setFoot(r, drop) {
    const foot = r.visual?.userData.foot; if (!foot) return;
    if (!(drop > PAWN_BEAM.min)) drop = 0;
    if (foot.position.y === -drop && (r.footDrop || 0) === drop) return;
    foot.position.y = -drop; r.footDrop = drop; r.group.userData.footDrop = drop; this.mwStale = true;
    this.dropHalos(r.entity.id); // what is drawn round it (brackets, a hover outline) was measured with the base where it was
  }
  // (tests) a pawn's base and beam as drawn
  pawnBaseInfo(id) {
    const r = this.recs.get(id); if (!r || r.entity.kind !== 'token') return null;
    const foot = r.visual?.userData.foot, l = this.dropLines.get(id), p = new THREE.Vector3(); r.group.updateMatrixWorld(true); foot?.getWorldPosition(p);
    return { fig: r.visual?.userData.fig || null, nameOnBase: !!r.visual?.userData.nameG && r.visual.userData.nameG.parent === foot, visible: !!r.group.visible, figureY: +r.group.position.y.toFixed(3), baseY: foot ? +p.y.toFixed(3) : null, drop: +(r.footDrop || 0).toFixed(3), level: this.pawnLevel(r.entity), on: r.baseAt?.on || null, room: r.baseAt?.room || null,
      beam: l?.userData.beam ? { color: l.userData.color, radius: +l.userData.radius.toFixed(3), casing: +(l.userData.radius * PAWN_BEAM.casing).toFixed(3), from: +l.position.y.toFixed(3), length: +l.children[0].scale.y.toFixed(3), label: l.userData.text, labelY: +(l.position.y + l.userData.tag.position.y).toFixed(3), visible: !!l.visible } : null };
  }
  // wall pieces whose face is seen: sample each long face a little off the wall (ends left out, so a wall that only
  // TOUCHES seen ground with its end, a T-junction from the far side, is not known); a post: its four sides
  wallKnown(s) {
    const seen = this.fogKnown, sp = s.spec; if (!seen) return true;
    const [w = 5, , d = 1] = sp.dims || [], rot = sp.rot || 0, ax = Math.cos(rot), az = -Math.sin(rot), nx = Math.sin(rot), nz = Math.cos(rot), y = sp.y || 0;
    if (sp.wallDir === 'c') { const r = Math.max(w, d) / 2 + 0.4; return [[r, 0], [-r, 0], [0, r], [0, -r]].some(([a, b]) => seen(sp.x + a, sp.z + b, y)); }
    for (const t of [-0.3, 0, 0.3]) for (const side of [-1, 1]) { const off = side * (d / 2 + 0.4); if (seen(sp.x + ax * t * w + nx * off, sp.z + az * t * w + nz * off, y)) return true; }
    return false;
  }
  knownWalls() { const out = []; for (const s of this.shell.values()) if (s.spec.layer === 'walls' && s.group?.visible) out.push(s.group); return out; } // (every wall drawn under vision fog is known: fogHidesShell)
  // under vision fog a WALL piece is drawn only when its face is known (wallKnown): a wall that merely touches seen ground
  // with its end (one joining from the far side) is not drawn at all, so the known wall's far face stays whole
  fogHidesShell(s) { return !!this.fogRule?.(s.fogEntity ||= {x:s.spec.x,z:s.spec.z,y:s.spec.y||0,dims:s.spec.dims,rot:s.spec.rot||0,room:s.roomId}) || (!!this.fogActive && s.spec.layer === 'walls' && !this.wallKnown(s)); }
  cutPass() {
    this.cutSets();
    // NOT EVERY FRAME (frame time, 2026-10-06): only when the cut, the roofs, the rooms or the things changed (cutGen),
    // and while anything is animating in (the spawn sets visible itself) plus one frame after
    const anim = this.anims.size > 0;
    if (this.cutGen === this.passGen && !anim && !this.passAnim) return;
    this.passGen = this.cutGen; this.passAnim = anim;
    // what the CUT ITSELF has just hidden or shown flies (cutfly.js): only when the cut moved since the last pass, and
    // never a piece hidden because nobody could see it anyway (`above` false: under a floor, a roof, the closed ground)
    const cutNow = this.cut ?? null, fly = this.flyCut !== undefined && cutNow !== this.flyCut && performance.now() - this.born > 1500 ? this.cutFly : null; this.flyCut = cutNow; // (not the cut an area opens with)
    const set = (g, hide, base, above, owner) => { // (a sleeping piece changes sides with no flight: nobody is watching it)
      if (hide) { if (!g.userData.cutHidden) { g.userData.cutAbove = above; if (above && !owner.asleep) fly?.leave(g, owner, g.visible); } g.userData.cutHidden = true; g.visible = false; }
      else if (g.userData.cutHidden) { g.userData.cutHidden = false; g.visible = base; if (base && g.userData.cutAbove && !owner.asleep) fly?.arrive(g, owner); }
    };
    for (const s of this.shell.values()) { const above = this.cutHidden.has(s.roomId); set(s.group, above || this.unseenShell(s) || this.fogHidesShell(s), this.wallsOn || s.spec.layer === 'floor', above, s); }
    for (const r of this.recs.values()) { const k = r.entity.kind; if (k === 'object' || k === 'token') { const above = this.cutHides(r.entity); set(r.group, above || this.unseenThing(r.entity) || this.fogRule?.(r.entity), true, above, r); } }
    fly?.commit();
    this.cutApplied = this.cut != null;
    this.shadowKey = null; // which things may cast the fire's shadow follows what is shown (shadowPass)
  }
  // THE FIRE'S SHADOW STAYS ON ITS OWN STOREY (frame time, 2026-10-06). The one fire that casts shadows re-draws every
  // shadow caster within its reach into six cube faces, every other frame; things on the storeys above and below it
  // were in that pass although a slab lies between. So: only things of rooms whose height span holds the fire cast
  // (loose things and pawns always do). Checked a few times a second, and applied only when the answer changes.
  shadowPass() {
    this.shadowTick = (this.shadowTick || 0) + 1;
    if (this.shadowKey != null && this.shadowTick % 120) return;
    let y = null; const P = _sv;
    for (const l of this.shadowLights()) { l.getWorldPosition(P); y = P.y; break; }
    const ents = this.view?.entities || {}, band = new Map(); // room id -> does its height span hold the fire?
    const holds = (id) => { if (y == null || this.noShadowRule) return true; let v = band.get(id); if (v === undefined) { const r = ents[id]; v = !r?.recipe || (y >= HT.roomY(r.recipe) - 1 && y < HT.roomTop(ents, r)); band.set(id, v); } return v; };
    let n = 0;
    // (the lighting stack re-marks every mesh as a caster once a second unless userData.noCast says otherwise: fx/lighting.js markCasters)
    const apply = (root, on) => root.traverse(o => { if (!o.isMesh || o.userData.fx) return; if (!on) { if (!o.userData.noCast) { o.userData.noCast = true; o.userData.offStorey = true; o.castShadow = false; n++; } } else if (o.userData.offStorey) { o.userData.offStorey = false; o.userData.noCast = false; n++; } });
    for (const s of this.shell.values()) if (s.visual && !s.asleep) apply(s.group, holds(s.roomId)); // (a sleeping room is marked when it wakes: applySleep asks for this pass again)
    for (const r of this.recs.values()) if (r.entity.kind === 'object' && r.visual && !r.asleep) apply(r.group, !r.entity.room || holds(r.entity.room));
    this.shadowKey = `${y}`; this.shadowChanged = n;
  }
  // WHAT CAN CAST INTO A FIRE'S SHADOW: the things, floors, walls and posts that stand within the light's reach (its
  // shadow cameras end there), plus everything that is not a thing of a room (pawns' layer is the things layer too, so
  // pawns are tested like things; cursors, signs, roofs, pieces in flight and the ground come whole: they are few).
  // Asked by the lighting stack every frame; a walk over what is awake with one distance test each.
  shadowCasters(light, reach) {
    // The list is kept while nothing was added, removed, woken or put to sleep and the light has not gone a foot from
    // where the list was made (a fire's light wobbles a few inches every frame: without this, things at the edge of its
    // reach would come and go from the list every frame, and each change reads as "something moved"), and for a
    // quarter of a second at most (a thing carried into the light's reach joins then).
    light.getWorldPosition(_sv); const C = this.casterCache ||= new WeakMap(), now = performance.now(), key = `${this.itemsGen}|${this.sleepGen}|${this.shell.size}|${this.scene.children.length}`;
    let c = C.get(light);
    if (c && c.key === key && c.reach === reach && now - c.t < 250 && Math.hypot(_sv.x - c.x, _sv.z - c.z) < 1) return c.list;
    const x = _sv.x, z = _sv.z, out = [];
    for (const k of this.scene.children) if (k !== this.layers.shell && k !== this.layers.things && !k.isLight && !k.userData.fx && !/^fx-/.test(k.name)) out.push(k); // (not the flames and smoke: they cast nothing, and being never culled they would all be drawn)
    const near = (g, d) => { const dx = g.position.x - x, dz = g.position.z - z, r = reach + 2.5 + 0.75 * Math.max(d?.[0] || 2, d?.[2] || 2); return dx * dx + dz * dz < r * r; };
    for (const s of this.shell.values()) if (!s.asleep && s.group.parent && near(s.group, s.spec.dims)) out.push(s.group);
    for (const r of this.recs.values()) { const k = r.entity.kind; if ((k === 'object' || k === 'token') && !r.asleep && r.group.parent && near(r.group, r.entity.dims)) out.push(r.group); }
    C.set(light, { x, z, reach, key, t: now, list: out });
    return out;
  }
  shadowLights() { const out = []; this.scene.traverse(o => { if (o.isPointLight && o.castShadow) out.push(o); }); return out; }
  // (tests) what the cut leaves visible: room ids by whether any of their shell is drawn, and counts
  cutReport() {
    this.cutPass();
    // shown / hidden are about the CUT. A piece that is not drawn only because nobody can see it (a covered room's
    // things away from a stair's hole, a room under the unopened ground: cutSets) counts as shown, and is listed in `unseen`.
    const rooms = {}, unseen = { rooms: {}, things: [] };
    for (const s of this.shell.values()) { const v = (rooms[s.roomId] ||= { shown: 0, hidden: 0 }), un = !s.group.visible && !this.cutHidden.has(s.roomId) && this.unseenShell(s); if (un) unseen.rooms[s.roomId] = (unseen.rooms[s.roomId] || 0) + 1; s.group.visible || un ? v.shown++ : v.hidden++; }
    const things = { shown: [], hidden: [] }; for (const r of this.recs.values()) if (r.entity.kind === 'object' || r.entity.kind === 'token') { const un = !r.group.visible && !this.cutHides(r.entity) && this.unseenThing(r.entity); if (un) unseen.things.push(r.entity.id); (r.group.visible || un ? things.shown : things.hidden).push(r.entity.id); }
    return { cut: this.cut ?? null, rooms, things, unseen, covered: [...this.coveredRooms], groundOpen: !!this.groundOpen, lit: this.litCount() };
  }

  // ---------------- state -> scene ----------------
  // returns what is new, so the caller can play the spawn: { rooms: [ids of rooms that just appeared], objects: [ids] }
  sync(view, { gmSide = false } = {}) {
    const first = !this.loaded; this.loaded = !!view;
    this.view = view; const was = this.gmSide; this.gmSide = gmSide; this.cutDirty = true;
    const ents = view ? view.entities : {};
    const fresh = { rooms: [], objects: [], rerolled: [] };
    const unitsMoved = this.buildUnits(ents); // (before anything is added: a new thing of a sleeping building is made asleep)
    for (const [id, r] of this.recs) if (!ents[id] || ents[id].factionMissing || (was !== gmSide && r.entity.hidden)) this.remove(id, { out: !ents[id] && this.leaving(r, ents) });
    for (const e of Object.values(ents)) {
      if (e.factionMissing) continue; // an unavailable faction slot has no old symbol, even for the GM
      const r = this.recs.get(e.id);
      if (!r) { this.add(e); if (!first) { if (e.kind === 'object') fresh.objects.push(e.id); if (e.kind === 'room') fresh.rooms.push(e.id); } continue; }
      if (r.entity === e) continue;
      if (e.kind === 'room' && r.entity.layout?.hash !== e.layout?.hash) fresh.rerolled.push(e.id);
      if (visualKey(e) !== r.vkey) { this.remove(e.id); this.add(e); continue; }
      if (e.kind === 'room') { this.dropHalos(e.id); if (e.building) this.dropHalos(e.building); }
      r.entity = e; this.place(r);
    }
    const rooms = Object.values(ents).filter(e => e.kind === 'room');
    const key = rooms.map(e => `${e.id}:${e.order}:${e.recipe.type}:${e.recipe.x}:${e.recipe.z}:${e.recipe.w}:${e.recipe.d}:${e.recipe.wallFamily}:${e.recipe.floor}:${e.recipe.wallSeed}:${e.hidden}:${e.recipe.turn || 0}:${e.recipe.outline ? JSON.stringify(e.recipe.outline) : ''}:${e.recipe.y || 0}:${e.recipe.tall || 1}`).sort().join('|')
      + '#' + Object.values(ents).filter(e => e.kind === 'building' && (e.base || e.storey)).map(e => `${e.id}:${e.base || 0}:${e.storey || 10}`).sort().join('|')
      + '#' + Object.values(ents).filter(e => e.kind === 'edge').map(e => JSON.stringify(e)).sort().join('|')
      + '#' + Object.values(ents).filter(isTile).map(e => tileKey(e.x, e.z, e.y)).sort().join(',') // a floor tile replaces its cell's generated floor
      + '#' + Object.values(ents).filter(e => e.kind === 'object' && e.fromEdge).map(e => e.fromEdge).sort().join(',') // a wall object still standing keeps its posts
      + '#' + ST.stairsOf(ents).map(e => `${e.x}:${e.z}:${e.y || 0}:${ST.stairTop(e)}:${e.rot || 0}:${(e.dims || []).join('x')}`).sort().join(','); // a stair cuts its hole in the floor above
    if (key !== this.shellKey) { this.shellKey = key; this.buildShell(ents); this.rebuildGround(); }
    this.syncStairNotes(ents); // a stair that leads nowhere where it stands says so
    this.syncRoofs(ents); // (Stage F) the roofs follow the rooms, their styles and the fireplaces below
    if (unitsMoved) { for (const r of this.recs.values()) r.unit = this.unitOf(r.entity); for (const s of this.shell.values()) s.unit = this.roomUnit.get(s.roomId) || null; this.applySleep(); this.sleeping = [...this.units.values()].filter(u => u.asleep).length; } // rooms changed: every thing's unit is worked out again
    this.fx?.water?.setBodies(Object.values(ents).filter(e => e.kind === 'water' && e.body && (!e.hidden || gmSide)).map(e => ({ ...e.body, id: e.id }))); // rivers, ponds (water.js)
    return fresh;
  }
  // an object leaving because its room was re-rolled or deleted plays the out-animation (as in the tuner)
  leaving(r, ents) { const e = r.entity; return e.kind === 'object' && e.room && (!ents[e.room] || ents[e.room].layout?.hash !== this.recs.get(e.room)?.entity.layout?.hash); }

  remove(id, { out = false } = {}) {
    const r = this.recs.get(id); if (!r) return;
    this.recs.delete(id); this.pawns.delete(r); this.anims.delete(r.group); this.dropHalos(id); this.itemsGen = (this.itemsGen || 0) + 1;
    if (out && r.group.visible && !r.asleep) { this.animateOut([{ group: r.group, layer: r.entity.layer || 'furnish', x: r.entity.x, z: r.entity.z, rest: restOf(r.entity) }]); return; }
    r.group.parent?.remove(r.group);
  }

  add(e) {
    const group = new THREE.Group(); group.rotation.order = 'YXZ';
    group.userData.entityId = e.id;
    const r = { entity: e, group, visual: null, vkey: visualKey(e), unit: this.unitOf(e) };
    this.cutDirty = true; // a new thing: the cut pass looks at it
    this.recs.set(e.id, r); this.itemsGen = (this.itemsGen || 0) + 1;
    if (e.kind === 'room' || e.kind === 'building' || e.kind === 'edge' || e.kind === 'water' || e.kind === 'template') return; // a room is its shell (built per area); a building, an edge override and water (fx.water) are data
    if (e.kind === 'token') {
      this.pawns.add(r); group.userData.pawn = true; // (pawns are asked for by name each frame, and their world positions are always worked out in full: a figure turns its name inside its group)
      r.visual = this.tokenMesh(e, r); group.add(r.visual); this.layers.things.add(group); this.place(r);
      // a figure's mesh arrives later: what was drawn round the stand-in (halo, ring, label height) is redone then
      r.ready = r.visual.userData.ready?.then(() => { if (this.recs.get(e.id) !== r) return; this.dropHalos(e.id); r.labelKey = null; this.refreshTokenLabel(r); this.cutDirty = true; this.onFigure?.(e.id); })?.catch(() => {}).then(() => { r.settled = true; });
      return;
    }
    r.visual = this.assets.placeholder(e.dims); group.add(r.visual);
    r.it = { spec: { uid: e.id, id: e.cat, sku: e.sku, dims: e.dims, parent: e.parent || undefined, layer: e.layer }, roomId: e.room || '_', visual: r.visual, group, rest: restOf(e) };
    if (this.unitAsleep(r.unit)) { r.asleep = true; r.it.asleep = true; } else this.layers.things.add(group); // (a thing of a sleeping building arrives asleep)
    this.place(r);
    r.ready = this.visualOf(e).then(v => {
      if (!v || this.recs.get(e.id) !== r) return;
      this.swapVisual(r, v);
      if (this.gmSide && e.hidden) ghostify(v);
      const a = this.anims.get(group); if (a?.m.fade) a.fadeMats = null; // the real mesh fades with the rest of its spawn
      this.dropHalos(e.id); // halos were built on the stand-in
      if (e.parent) this.settler.enqueue(r.it);
    }).catch((err) => { console.warn('visual failed', e.id, e.cat, e.sku, String(err?.stack || err).slice(0, 300)); }) // (it stays the catalog box; say why)
      .then(() => { r.settled = true; }); // (settled: its mesh is in, or never will be; the loading screen waits for these, unsettled())
    if (this.gmSide && e.hidden) { ghostify(r.visual); if (this.view?.entities[e.room]?.hidden) return; const pill = labelSprite('Hidden', { pill: null, accent: HIDDEN_COLOR, small: true }); pill.position.y = (e.dims?.[1] || 2) + 0.8; pill.userData.hiddenPill = true; group.add(pill); }
  }

  // the entity with its height counted from its room's floor (the tuner's visual code hangs a ceiling thing's chain from
  // 9 ft above the floor it knows, which is the room's own)
  // an entity's visual: the tuner's own, except a stair (client/stairs.js: fitted to its rise and run, climbing its +z)
  // (a bracket, post or railing section that became an object keeps the look it had: the same measured fit to its box)
  visualOf(e) { return ST.isStair(e) || (ST.stairRole(e) && !e.url) ? stairVisual(this.assets, e) : e.fromEdge && e.url && e.dims && GEN_FIT[e.fromEdge[0]] ? supportVisual(this.assets, { url: e.url, sku: e.sku, fit: GEN_FIT[e.fromEdge[0]] }, e.dims) : this.assets.visualFor(this.inRoomFrame(e)); }
  inRoomFrame(e) { const ry = e.room ? HT.roomY(this.view?.entities[e.room]?.recipe) : 0; return ry ? { ...e, y: (e.y || 0) - ry } : e; }
  roomYOf(id) { return HT.roomY(this.view?.entities[id]?.recipe); }

  place(r) {
    const e = r.entity; this.mwStale = true;
    if (e.kind === 'building' || e.kind === 'room') return;
    r.group.position.set(e.x, e.y || 0, e.z); // objects and pawns may be lifted (hanging, flying)
    r.group.rotation.set(0, e.rot || 0, 0);
    if (e.kind === 'object') this.seatTilt(r); // tipped over (its `quat`, core/orient.js): inside the group, below
    if (e.libK || r.libK) { r.libK = e.libK; r.group.scale.setScalar(e.libK || 1); } // a library thing's drawing scale (library.js, "the same size for all"), set here too: a thing out of the camera's reach is not posed each frame
    if (e.kind === 'token') { this.refreshTokenLabel(r); this.refreshTokenMark(r); }
    if (e.kind === 'object') { const u = this.unitOf(e); if (u !== r.unit) { r.unit = u; const z = this.unitAsleep(u) || !!r.nap; if (z && !r.asleep) this.sleepRec(r); else if (!z && r.asleep) this.wakeRec(r); } } // moved to another building, or out of its own: it sleeps or wakes with where it is now
    if (r.it) { r.it.rest = restOf(e); r.it.spec.parent = e.parent || undefined; if (e.parent) this.settler.enqueue(r.it); }
    this.dropHalos(e.id, true);
  }

  // A PAWN'S LOOK: the figure it wears on the engine's own base (client/figures.js), or, with no figure chosen, the
  // stand-in below. The rim is the owner seat's colour (nobody's pawn: the pawn's own colour).
  pawnColor(e) { return this.assets.pawnColor?.(e) || e.color || '#d9a441'; }
  tokenMesh(e) {
    const fig = e.fig && this.assets.figures?.pawnVisual(e, { color: this.pawnColor(e), ghost: !!(this.gmSide && e.hidden) });
    if (fig) return fig;
    const g = new THREE.Group();
    const col = new THREE.Color(e.color || '#d9a441');
    const mat = (c) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, transparent: !!(this.gmSide && e.hidden), opacity: this.gmSide && e.hidden ? 0.42 : 1 }); return m; };
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.5, 32), mat(col.clone().multiplyScalar(0.8))); base.position.y = 0.25;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 1.5, 4, 14), mat(col)); body.position.y = 1.9;
    const notch = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 12), mat(new THREE.Color('#f4efe3'))); // facing
    notch.rotation.x = Math.PI / 2; notch.position.set(0, 0.35, 1.55);
    const foot = new THREE.Group(); foot.add(base, notch); g.add(foot, body); g.userData.foot = foot; // (the base and its facing notch stay down under a raised pawn)
    return g;
  }
  refreshTokenLabel(r) {
    const e = r.entity;
    // A FIGURE PAWN'S NAME IS ON ITS BASE (client/figures.js NAME_ON_BASE); the floating label then carries only what
    // the base does not: damage, conditions, the GM's Hidden mark. With the name off the base it floats as before.
    const onBase = !!r.visual?.userData.fig && this.assets.figures.name().on;
    if (r.visual?.userData.fig && (r.visual.userData.nameText !== (onBase ? e.name : '') || r.nameStamp !== this.assets.figures.nameStamp)) { this.assets.figures.setNameOn(r.visual, onBase ? e.name : ''); r.nameStamp = this.assets.figures.nameStamp; r.labelKey = null; }
    // damage counts up from 0 (Harry 2026-10-06): an unhurt pawn shows its name alone; there is no bar and no "bloodied"
    const dmg = e.damage > 0 ? `${e.damage} dmg` : '';
    const text = onBase ? dmg : `${e.name}${dmg ? `  ${dmg}` : ''}`;
    const sub = (e.conditions || []).join(' · ');
    const key = `${text}|${sub}|${e.hidden}|${this.gmSide}|${onBase}`;
    if (r.labelKey === key) return;
    r.labelKey = key;
    if (r.label) { r.group.remove(r.label); r.label = null; }
    if (onBase && !text && !sub && !(this.gmSide && e.hidden)) return; // nothing left to float
    r.label = labelSprite(text || (sub ? '' : ' '), { sub, pill: this.gmSide && e.hidden ? 'Hidden' : null });
    r.label.position.y = r.visual?.userData.labelY ?? 4.4; // over a figure's head (a giant is 15 ft tall)
    r.group.add(r.label);
    if (r.mark) this.placeMark(r);
  }
  // A PAWN'S INDICATOR (Harry 2026-10-06; core/pawn.js MARKS): one of eight shapes floating over the pawn for every
  // seat, the same size on screen at any zoom (so it reads at table distance). It stands on the name label, wherever
  // that is (it reads the label's place, not the stand-in pawn's height).
  refreshTokenMark(r) {
    const key = r.entity.mark || '';
    if (r.markKey === key) return;
    r.markKey = key;
    if (r.mark) { r.group.remove(r.mark); r.mark.material.map?.dispose(); r.mark.material.dispose(); r.mark = null; }
    if (!key) return;
    const tex = new THREE.CanvasTexture(markCanvas(key, 128)); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, transparent: true }));
    sp.renderOrder = 41; sp.scale.set(MARK_SIZE, MARK_SIZE, 1); sp.center.set(0.5, -0.5); sp.userData.mark = key;
    r.mark = sp; r.group.add(sp); this.placeMark(r);
  }
  placeMark(r) { if (r.mark && r.label) r.mark.position.copy(r.label.position); }
  // (tests) the indicator over a pawn: which one, and where it is on screen
  markOf(id, view) { const r = this.recs.get(id); if (!r?.mark) return null; const p = r.mark.getWorldPosition(new THREE.Vector3()); return { mark: r.mark.userData.mark, at: [p.x, p.y, p.z], visible: !!r.group.visible && r.mark.visible, size: MARK_SIZE }; }

  // ---------------- the shell: floors, walls, doors, posts (the tuner's own specs and visuals) ----------------
  buildShell(ents) {
    if (!this.roomgen) return;
    // HIDDEN ROOMS (Harry 2026-10-05). The player side never receives a hidden room, so its walls are worked out from the
    // rooms it can see: a wall a visible room shared with the hidden one is simply that room's own outside wall, whole
    // (never a gap into nothing). The GM side draws the visible rooms EXACTLY the same way (so GM and players agree on
    // every door and window they can both see) and adds the hidden room's own pieces on top, in the hidden treatment;
    // the connecting door appears when the room is revealed and the shell re-forms.
    const hiddenRooms = new Set(Object.values(ents).filter(e => e.kind === 'room' && e.hidden).map(e => e.id));
    const visEnts = hiddenRooms.size ? Object.fromEntries(Object.entries(ents).filter(([, e]) => !(e.kind === 'room' && e.hidden))) : ents;
    let { edges, corners, rooms } = this.roomgen.edges(visEnts);
    if (hiddenRooms.size) {
      const all = this.roomgen.edges(ents);
      rooms = all.rooms; // every room's floor is drawn (the hidden ones in the hidden treatment)
      for (const [k, e] of all.edges) if (!edges.has(k) && e.sides.every(s => hiddenRooms.has(s.room))) edges.set(k, e);
      const have = new Set(corners.map(vertKey)), veiled = (k) => { const e = edges.get(k); return !!e && hiddenRooms.has(e.owner.room); };
      for (const c of all.corners) if (!have.has(vertKey(c)) && keysAt(c).some(veiled)) { corners.push({ ...c, veiled: true }); have.add(vertKey(c)); }
    }
    applyEdgeOverrides(edges, ents);
    this.edges = edges; this.hiddenRooms = hiddenRooms;
    this.cutDirty = true; // new shell pieces: the cut pass looks at them
    const look = this.assets.look;
    const want = new Map();
    // STOREYS (2026-10-05): every piece is drawn at its room's height. Floors and walls come from the tuner's own specs
    // (worked out one height at a time, core/roomgen.js edges) and are lifted by the room's y; a wall key off the ground
    // carries its level ('h:3:4@10'), so pieces at different heights never share a shell key.
    const tiled = new Set(Object.values(ents).filter(isTile).map(e => tileKey(e.x, e.z, e.y))); // cells a placed floor tile covers (at its height)
    for (const rc of rooms) {
      const { id, specs } = look.floorSpecs(rc), y = rc.y || 0, holes = ST.holesAt(ents, y); // the cells a stair comes up through: no floor, no slab
      for (const sp of specs) { if (tiled.has(tileKey(sp.x, sp.z, y)) || (holes.size && holes.has(cellKey(sp.x, sp.z)))) continue; if (y) sp.y = (sp.y || 0) + y; want.set(sp.uid, { spec: sp, sig: `${id}|${rc.family}|${sp.sku}|${sp.x}|${sp.z}|${sp.rot}|${y}`, roomId: rc.id }); }
      if (y > 0) { const sl = slabSpec(rc); want.set(sl.uid, { spec: sl, sig: `slab|${HT.isStoneFamily(rc.family) ? 's' : 't'}|${rc.x}|${rc.z}|${rc.w}|${rc.d}|${y}|${rc.outline ? JSON.stringify(rc.outline) : ''}|${[...holes].sort().join(',')}`, roomId: rc.id, make: () => slabVisual(rc, holes) }); } // the 1-ft floor slab an upper room stands on (derived, never an entity)
    }
    // pieces storeys generate are things of their own (2026-10-06): each has a key, and an 'edge' override on it
    // ('open': deleted, or turned into an object that someone moved or swapped) takes the generated one away
    const openGen = new Set(Object.values(ents).filter(e => e.kind === 'edge' && e.as === 'open').map(e => e.key));
    for (const [uid, w] of this.supportSpecs(ents, rooms)) if (!openGen.has(uid)) want.set(uid, w); // jetty brackets and posts under an overhanging upper room (derived, never entities)
    for (const [uid, w] of this.railSpecs(ents, rooms)) if (!openGen.has(uid)) want.set(uid, w);    // the railing round a stair's hole
    for (const e of edges.values()) for (const sp of edgeSpecsOf(look, e)) { if (e.y) sp.y = (sp.y || 0) + e.y; want.set(sp.uid, { spec: sp, sig: `${e.kind}|${e.family}|${e.owner.side}|${e.doorType || ''}|${e.span || 1}|${sp.sku}|${e.y || 0}`, roomId: e.owner.room }); }
    // posts are touchable too (2026-10-04): a post edited away ('c<x>:<z>' override) is gone, and a post with no wall
    // left standing at it goes by itself (a materialized wall object still counts as standing)
    const openPost = new Set(Object.values(ents).filter(e => e.kind === 'edge' && e.key?.[0] === 'c' && e.as === 'open').map(e => e.key));
    const movedWalls = new Set(Object.values(ents).filter(e => e.kind === 'object' && e.fromEdge && e.fromEdge[0] !== 'c').map(e => e.fromEdge));
    const standing = (k) => { const e = edges.get(k); return !!e && (!e.open || movedWalls.has(k)); };
    const lonely = (v) => { const ks = keysAt(v); return ks.some(k => edges.has(k)) && !ks.some(standing); };
    for (const v of corners) {
      const sfx = FP.levelSuffix(v.y || 0);
      if (openPost.has(`c${v.gx}:${v.gz}${sfx}`) || lonely(v)) continue;
      const sp = look.cornerSpec(v); if (sfx) { sp.uid += sfx; sp.key += sfx; sp.y = (sp.y || 0) + v.y; }
      want.set(sp.uid, { spec: sp, sig: `${v.family}|${!!v.jamb}|${!!v.slim}|${sp.sku}|${v.y || 0}`, roomId: roomOfVertex((v.veiled ? rooms.filter(r => hiddenRooms.has(r.id)) : rooms.filter(r => !hiddenRooms.has(r.id))).filter(r => (r.y || 0) === (v.y || 0)), v) });
    }
    // TALL ROOMS (Stage G): a room that spans several storeys has its walls and posts carried up, one plain wall piece per
    // storey above its first (no doors or windows up there). Where a room beside it stands at that height, that room's
    // own wall is the wall (it is shared, as at any height), so nothing is doubled. The upper pieces belong to the tall
    // room: a click on one selects the room, and they hide and show with it.
    const tallBy = new Map(rooms.filter(r => r.tall > 1).map(r => [r.id, r]));
    if (tallBy.size) {
      const stepOf = (rid) => HT.storeyHeightOf(ents[ents[rid]?.building]);
      for (const e of [...edges.values()]) {
        const t = (e.sides || [e.owner]).map(s => tallBy.get(s.room)).filter(Boolean).sort((a, b) => b.tall - a.tall)[0]; if (!t) continue;
        const H = stepOf(t.id), plain = { ...e, kind: 'wall', open: false, swap: undefined, doorType: undefined, span: undefined, spanKeys: undefined, spanOf: undefined, override: undefined };
        for (let k = 1; k < t.tall; k++) {
          const y = (e.y || 0) + k * H; if (edges.has(FP.keyBase(e.key) + FP.levelSuffix(y))) continue;
          // (2026-10-06) an upper wall piece has the wall key of its own height, so it is a piece of its own: select, delete, swap
          const ukey = FP.keyBase(e.key) + FP.levelSuffix(y); if (openGen.has(ukey)) continue;
          for (const sp of look.edgeSpecs(plain)) { sp.y = (sp.y || 0) + y; sp.uid = sp.uid === e.key ? ukey : sp.uid + `^${k}`; sp.key = ukey; sp.stack = k; want.set(sp.uid, { spec: sp, sig: `stack|${e.family}|${e.owner.side}|${sp.sku}|${y}`, roomId: t.id }); }
        }
      }
      const cornerAt = new Set(corners.map(vertKey));
      for (const v of corners) {
        const t = [...tallBy.values()].filter(r => (r.y || 0) === (v.y || 0) && v.gx >= r.x && v.gx <= r.x + r.w && v.gz >= r.z && v.gz <= r.z + r.d).sort((a, b) => b.tall - a.tall)[0]; if (!t || lonely(v)) continue;
        const H = stepOf(t.id);
        for (let k = 1; k < t.tall; k++) {
          const y = (v.y || 0) + k * H; if (cornerAt.has(vertKey({ ...v, y }))) continue;
          const ukey = `c${v.gx}:${v.gz}${FP.levelSuffix(y)}`; if (openGen.has(ukey)) continue;
          const sp = look.cornerSpec({ ...v, jamb: false }); sp.uid = ukey; sp.key = ukey; sp.stack = k; sp.y = (sp.y || 0) + y;
          want.set(sp.uid, { spec: sp, sig: `stack|${v.family}|${sp.sku}|${y}`, roomId: t.id });
        }
      }
    }
    this.newShell = [];
    for (const [k, s] of this.shell) if (!want.has(k) || want.get(k).sig !== s.sig || want.get(k).roomId !== s.roomId) { s.group.parent?.remove(s.group); this.shell.delete(k); this.anims.delete(s.group); this.dropHalos('shell:' + k); }
    for (const [k, w] of want) {
      if (this.shell.has(k)) { const s = this.shell.get(k); s.group.visible = (this.wallsOn || s.spec.layer === 'floor') && !s.group.userData.cutHidden; s.hidden = hiddenRooms.has(w.roomId); this.setGhost(s, s.hidden); continue; }
      const group = new THREE.Group(); group.rotation.order = 'YXZ';
      group.position.set(w.spec.x, w.spec.y || 0, w.spec.z); group.rotation.y = w.spec.rot || 0;
      group.userData = { shellKey: k, edgeKey: w.spec.layer === 'floor' ? null : (w.spec.key || null), roomId: w.roomId, floor: w.spec.layer === 'floor', roomPiece: (w.spec.support || w.spec.stack) && !w.spec.key ? w.roomId : null }; // walls, doors, windows AND posts pick
      const s = { key: k, sig: w.sig, spec: w.spec, group, roomId: w.roomId, visual: null, hidden: hiddenRooms.has(w.roomId), make: w.make || null, unit: this.roomUnit?.get(w.roomId) || null };
      const stand = this.assets.placeholder(w.spec.dims); stand.userData.noPick = w.spec.layer === 'floor'; group.add(stand); s.visual = stand;
      s.ready = shellVisual(look, s).then(v => { if (this.shell.get(k) !== s || !v) return; group.remove(s.visual); group.add(v); s.visual = v; s.ghost = false; this.setGhost(s, s.hidden); }).catch(() => {}).then(() => { s.settled = true; });
      group.visible = this.wallsOn || w.spec.layer === 'floor';
      if (this.unitAsleep(s.unit)) s.asleep = true; else this.layers.shell.add(group);
      this.shell.set(k, s);
      this.newShell.push(s);
    }
  }
  // the graphics preset changed the LOD tier: rebuild every visual in place (objects and the shell), as the tuner's faces
  // dial does; the stand-in stays until the new mesh is ready, so nothing blinks out
  refreshVisuals() {
    const look = this.assets.look;
    for (const [id, r] of this.recs) {
      if (!r.it || !r.entity.url) continue;
      const e = r.entity;
      this.visualOf(e).then(v => {
        if (!v || this.recs.get(id) !== r) return;
        this.swapVisual(r, v);
        if (this.gmSide && e.hidden) ghostify(v);
        this.dropHalos(id);
      }).catch(() => {});
    }
    for (const [k, s] of this.shell) {
      shellVisual(look, s).then(v => {
        if (!v || this.shell.get(k) !== s) return;
        s.group.remove(s.visual); s.group.add(v); s.visual = v; const g = s.ghost; s.ghost = false; if (g) this.setGhost(s, true);
      }).catch(() => {});
    }
  }
  setGhost(s, on) {
    if (!!s.ghost === on || !s.visual) return; s.ghost = on;
    if (on && this.gmSide) { ghostify(s.visual); return; }
    if (!on) shellVisual(this.assets.look, s).then(v => { if (!v || this.shell.get(s.key) !== s || s.ghost) return; s.group.remove(s.visual); s.group.add(v); s.visual = v; }).catch(() => {}); // revealed: its own materials back
  }
  // ---------------- storeys, Stage B: what holds an overhang up; the ground opened over what is below it ----------------
  // SUPPORTS (Harry 2026-10-05: "one square out is a jetty that gets brackets underneath automatically; two squares out
  // gets posts or flying buttresses filled in automatically"). Derived from the rooms, like walls; never entities.
  //   a square of an upper room ONE out from the rooms below: a bracket under it, against the wall below, per 5 ft
  //   a square TWO out: posts from the ground (or the roof below) up to the slab, at the overhang's outer corners and
  //   every 10 ft along its outer edge; a stone building gets the buttress piece instead of the timber post
  // The pieces come from the catalog by id, first one the library has (SUPPORT_KIT); a plain box stands in otherwise.
  supportSpecs(ents, rooms) {
    const out = new Map(), kit = this.supportKit ||= resolveSupportKit(this.assets.lib);
    for (const rc of rooms) {
      const y = rc.y || 0, e = ents[rc.id]; if (y <= 0 || !e) continue;
      const P = HT.supportPlan(ents, e); if (!P.brackets.length && !P.posts.length) continue;
      // stone or timber follows the walls: this room's, or those of the storey of its building that it stands over
      const stone = HT.isStoneFamily(rc.family) || rooms.some(r => r.id !== rc.id && (r.y || 0) < y && ents[r.id]?.building && ents[r.id].building === e.building && HT.isStoneFamily(r.family)), postKit = stone ? kit.buttress : kit.post, brKit = stone ? kit.corbel : kit.bracket;
      for (const { key, gx, gz, dx, dz } of P.brackets) { // a jetty: a bracket against the wall below it
        const B = brKit, [bw, bh, bd] = B.dims, mx = (gx + 0.5 - dx / 2) * CELL, mz = (gz + 0.5 - dz / 2) * CELL;
        const spec = { uid: key, key, gen: 'bracket', name: stone ? 'Corbel' : 'Jetty bracket', id: B.id, url: B.url || null, support: 'bracket', layer: 'walls', roomId: rc.id, x: mx + dx * (0.5 + bd / 2), y: y - 1 - bh, z: mz + dz * (0.5 + bd / 2), rot: Math.atan2(dx, dz), dims: [bw, bh, bd], sku: B.sku || null, standIn: !!B.standIn };
        out.set(key, { spec, sig: `br|${B.id}|${B.sku}|${y}`, roomId: rc.id, make: () => supportVisual(this.assets, B, [bw, bh, bd]) });
      }
      for (const { key, vx, vz, y0, inn } of P.posts) {
        // AT ITS OWN PROPORTIONS (Harry 2026-10-06: "this particular pillar type is not visually quite right"): the gap
        // sets its height and its width follows the mesh (postDims), so nothing is squeezed thin or stretched tall. It
        // stands in from the corner so that its outer faces line up with the wall above it.
        const h = y - 1 - y0, [pw, , pd] = postDims(postKit, h), ins = [Math.max(0, pw / 2 - 0.5), Math.max(0, pd / 2 - 0.5)];
        const spec = { uid: key, key, gen: 'post', name: stone ? 'Pier' : 'Post', id: postKit.id, url: postKit.url || null, support: 'post', layer: 'walls', roomId: rc.id, x: vx * CELL + inn[0] * ins[0], y: y0, z: vz * CELL + inn[1] * ins[1], rot: 0, dims: [pw, h, pd], sku: postKit.sku || null, standIn: !!postKit.standIn };
        out.set(key, { spec, sig: `post|${postKit.id}|${postKit.sku}|${y0}|${y}`, roomId: rc.id, make: () => supportVisual(this.assets, postKit, [pw, h, pd]) });
      }
    }
    return out;
  }
  // THE RAILING ROUND A STAIR'S HOLE (core/stairs.js stairRails; Harry 2026-10-06: "just as a normal kind of furniture
  // that gets placed by default"): one 5-ft section per open side, on the floor the stair comes up through, in the
  // material of that room's walls. Generated like a wall piece, so each section is a thing of its own.
  railSpecs(ents, rooms) {
    const out = new Map(), rails = ST.railsOf(ents); if (!rails.length) return out;
    const kit = this.railKit ||= resolveRailKit(this.assets.lib), fam = new Map(rooms.map(r => [r.id, r.family]));
    for (const r of rails) {
      if (!fam.has(r.room)) continue; // (a room this seat was not sent)
      const K = kit[railKind(fam.get(r.room))];
      const spec = { uid: r.key, key: r.key, gen: 'rail', name: 'Railing', id: K.id, url: K.url || null, rail: true, layer: 'walls', roomId: r.room, x: r.x, y: r.y, z: r.z, rot: r.rot, dims: K.dims, sku: K.sku || null, standIn: !!K.standIn, stair: r.stair };
      out.set(r.key, { spec, sig: `rail|${K.id}|${K.sku}|${r.y}`, roomId: r.room, make: () => supportVisual(this.assets, K, K.dims) });
    }
    return out;
  }
  rails() { return [...this.shell.values()].filter(s => s.spec.rail).map(s => ({ key: s.spec.key, id: s.spec.id, sku: s.spec.sku, room: s.roomId, stair: s.spec.stair, x: s.spec.x, y: s.spec.y, z: s.spec.z, rot: s.spec.rot, dims: s.spec.dims, loaded: !!s.visual && !s.visual.userData?.placeholder })); }
  // (tests, docs) the support pieces now drawn: [{ kind, id, standIn, room, x, y, z, h }]
  supports() { return [...this.shell.values()].filter(s => s.spec.support).map(s => ({ kind: s.spec.support, id: s.spec.id, sku: s.spec.sku || null, standIn: s.spec.standIn, room: s.roomId, x: s.spec.x, y: s.spec.y, z: s.spec.z, h: s.spec.dims[1] })); }

  // THE GROUND OPENS over rooms below it, so a cellar or a dungeon can be seen and worked in from above. Off (whole
  // ground) unless asked: Stage B opens it while the level being worked on is below 0; the cut will drive it (Stage C).
  setGroundOpen(on) { on = !!on || (this.cut != null && this.cut < 0); if (on === !!this.groundOpen) return; this.groundOpen = on; this.rebuildGround(); } // (the cut opens it too: setCut)
  rebuildGround() {
    const W = 800, open = new Set();
    if (this.groundOpen) for (const e of Object.values(this.view?.entities || {})) if (e.kind === 'room' && HT.roomY(e.recipe) < 0 && HT.visibleAt(HT.roomY(e.recipe), this.cut ?? null)) for (const [i, j] of FP.cellsOf(e.recipe)) open.add(`${e.recipe.x + i}:${e.recipe.z + j}`);
    const E = this.view?.entities || {}; // a stair that comes up onto open ground (no room's floor there) cuts the ground, cut or no cut
    for (const k of ST.holesAt(E, 0)) open.add(k); // (2026-10-11: under a ground-floor ROOM too. Its floor tiles were left out there, but the ground itself lay in the hole: a stairs-down into a cellar showed grass, and the pointer stopped on it)
    this.groundOpenCells = open; // (floorStop: the ground stops the pointer except over these)
    const key = [...open].sort().join(','); if (key === this.groundKey) return; this.groundKey = key;
    const pos = [], quad = (x0, z0, x1, z1) => { if (x1 > x0 && z1 > z0) pos.push(x0, -z0, 0, x0, -z1, 0, x1, -z1, 0, x0, -z0, 0, x1, -z1, 0, x1, -z0, 0); }; // (the mesh lies flat: its local -y is world z)
    if (!open.size) quad(-W / 2, -W / 2, W / 2, W / 2);
    else {
      const cs = [...open].map(k => k.split(':').map(Number)), gx0 = Math.min(...cs.map(c => c[0])), gx1 = Math.max(...cs.map(c => c[0])) + 1, gz0 = Math.min(...cs.map(c => c[1])), gz1 = Math.max(...cs.map(c => c[1])) + 1;
      quad(-W / 2, -W / 2, W / 2, gz0 * CELL); quad(-W / 2, gz1 * CELL, W / 2, W / 2); quad(-W / 2, gz0 * CELL, gx0 * CELL, gz1 * CELL); quad(gx1 * CELL, gz0 * CELL, W / 2, gz1 * CELL);
      for (let gz = gz0; gz < gz1; gz++) { let run = null; for (let gx = gx0; gx <= gx1; gx++) { const solid = gx < gx1 && !open.has(`${gx}:${gz}`); if (solid && run == null) run = gx; if (!solid && run != null) { quad(run * CELL, gz * CELL, gx * CELL, (gz + 1) * CELL); run = null; } } }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    this.ground.geometry.dispose(); this.ground.geometry = g;
  }
  // THE GHOST of the level being built on: its 5-ft grid, and the lit squares (showCells below).
  // Harry 2026-10-06: "it is showing THRU things that are on the second floor. It DOES need to show over things on the
  // first floor, but it also needs to not ghost thru things on the second floor." The rule: the ghost draws over
  // everything BELOW its level and is hidden by whatever stands ON that level or above it.
  //   above the ground  the ordinary depth test does exactly that, because the camera looks down: what is in front of
  //                     a point of the level's plane is higher than the plane. The ghost lies GHOST_DROP under the
  //                     floor line: above the wall tops of the storey below (a 9-ft wall ends 1 ft under it), under
  //                     the top of this level's own floors and slabs, which therefore cover it.
  //   below the ground  the ground is in front of a cellar's plane too, and the ghost must still show through it. So
  //                     while a ghost is up down there, the rooms and things (not the ground) are drawn once more,
  //                     depth only, into a small buffer (ghostPrepass, called by main.js just before the main view),
  //                     and the ghost tests itself against that instead of the screen's depth.
  //   on the ground     as before: over everything (the room tool's squares on the ground are not a "level").
  ghostMaterial(mat) {
    const G = this.ghostU ||= { tex: { value: null } }, on = mat.userData.ghostOn = { value: 0 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.tGhostDepth = G.tex; sh.uniforms.uGhostOn = on;
      sh.vertexShader = 'varying vec4 vGhostClip;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vGhostClip = gl_Position;');
      sh.fragmentShader = 'uniform sampler2D tGhostDepth; uniform float uGhostOn; varying vec4 vGhostClip;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (uGhostOn > 0.5) { vec3 gN = vGhostClip.xyz / vGhostClip.w * 0.5 + 0.5; if (texture2D(tGhostDepth, gN.xy).x < gN.z) discard; }');
    };
    mat.customProgramCacheKey = () => 'tw-ghost';
    return mat;
  }
  ghostMode(obj, y) { // how a ghost at height y is tested: 'over' (the ground level), 'depth' (above), 'pre' (below the ground)
    const mode = y > 0 ? 'depth' : y < 0 ? 'pre' : 'over', m = obj.material;
    m.depthTest = mode === 'depth'; m.depthWrite = false; if (m.userData.ghostOn) m.userData.ghostOn.value = mode === 'pre' ? 1 : 0;
    obj.userData.ghost = mode; obj.userData.ghostY = y;
    return mode;
  }
  ghosts() { return [this.levelGrid, ...[...(this.cellMarks?.values() || [])].flatMap(c => [c.lit, c.dim])].filter(Boolean); }
  ghostInfo() { return this.ghosts().map(o => ({ mode: o.userData.ghost, y: o.userData.ghostY, at: o.isInstancedMesh ? null : o.position.y, count: o.isInstancedMesh ? o.count : null })).concat(this.ghostPasses ? [{ passes: this.ghostPasses }] : []); } // (tests)
  // below the ground only: the depth of everything but the ground, from the main camera, for the ghost to hide behind
  ghostPrepass(renderer, camera) {
    if (!this.ghosts().some(o => o.userData.ghost === 'pre' && o.visible && (!o.isInstancedMesh || o.count > 0))) return false;
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2()), w = Math.max(1, sz.x >> 1), h = Math.max(1, sz.y >> 1);
    let rt = this.ghostRT;
    if (!rt) { rt = this.ghostRT = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true }); rt.depthTexture = new THREE.DepthTexture(w, h); rt.depthTexture.type = THREE.UnsignedIntType; rt.texture.minFilter = rt.texture.magFilter = rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.NearestFilter; this.ghostDepthMat = new THREE.MeshBasicMaterial({ colorWrite: false }); }
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    (this.ghostU ||= { tex: { value: null } }).tex.value = rt.depthTexture;
    const keep = new Set([this.layers.shell, this.layers.things]), was = [];
    for (const c of this.scene.children) { was.push([c, c.visible]); if (!keep.has(c)) c.visible = false; }
    const sprites = []; for (const L of keep) L.traverse(o => { if ((o.isSprite || o.isLine || o.isPoints) && o.visible) { sprites.push(o); o.visible = false; } }); // only solid things hide the ghost
    const prev = renderer.getRenderTarget(), auto = renderer.shadowMap.autoUpdate, over = this.scene.overrideMaterial, bg = this.scene.background;
    renderer.shadowMap.autoUpdate = false; this.scene.overrideMaterial = this.ghostDepthMat; this.scene.background = null;
    try { renderer.setRenderTarget(rt); renderer.clear(true, true, false); renderer.render(this.scene, camera); }
    finally {
      renderer.setRenderTarget(prev); renderer.shadowMap.autoUpdate = auto; this.scene.overrideMaterial = over; this.scene.background = bg;
      for (const [c, v] of was) c.visible = v; for (const o of sprites) o.visible = true;
    }
    this.ghostPasses = (this.ghostPasses || 0) + 1;
    return true;
  }
  showLevelGrid(y) {
    if (y == null || y === 0) { if (this.levelGrid) { this.levelGrid.parent?.remove(this.levelGrid); this.levelGrid = null; } return; }
    if (!this.levelGrid) { const g = this.levelGrid = new THREE.GridHelper(600, 120, '#cfd6c0', '#cfd6c0'); g.material.transparent = true; g.material.opacity = 0.16; this.ghostMaterial(g.material); g.renderOrder = 24; g.userData.halo = true; this.layers.deco.add(g); }
    this.levelGrid.position.y = y - GHOST_DROP; this.levelGrid.userData.y = y; this.ghostMode(this.levelGrid, y);
  }

  setWalls(on) { this.wallsOn = on; for (const s of this.shell.values()) if (s.spec.layer !== 'floor') s.group.visible = on && !s.group.userData.cutHidden; }

  // ---------------- spawn animation (the tuner's choreography, local) ----------------
  // a new room: its floor, walls, doors and furniture, in the house preset's layer order, camera-side walls last
  animateRoom(roomId, objectIds, camera, { shell = true } = {}) {
    const room = this.view?.entities[roomId]; if (!room) return 0;
    if (this.unitAsleep(roomId)) return 0; // built out of everybody's sight (another seat, far away): it is simply there when someone looks
    const c = room.recipe, rect = { x0: c.x * CELL, z0: c.z * CELL, x1: (c.x + c.w) * CELL, z1: (c.z + c.d) * CELL };
    const list = [];
    // shell: true = the pieces that are new with this room; 'all' = every piece it has (a replay); false = its things only
    if (shell) for (const s of shell === 'all' ? this.shell.values() : this.newShell || []) if (s.roomId === roomId && (shell !== 'all' || (s.visual && s.group.visible))) list.push({ group: s.group, layer: s.spec.layer, x: s.spec.x, z: s.spec.z, wallDir: s.spec.wallDir, rest: { x: s.spec.x, y: s.spec.y || 0, z: s.spec.z, rot: s.spec.rot || 0 }, ready: s.ready });
    for (const id of objectIds) { const r = this.recs.get(id); if (r) list.push({ group: r.group, layer: r.entity.layer || 'furnish', x: r.entity.x, z: r.entity.z, rest: restOf(r.entity), entityId: id, ready: r.ready }); }
    // as the tuner does: load every mesh first (the room stays unseen), then play the whole choreography with the real
    // pieces, never grey stand-ins swapping in mid-flight. A piece that won't load doesn't hold the room past 20 s.
    const ready = Promise.race([Promise.all(list.map(it => it.ready && it.ready.catch(() => {}))), new Promise(r => setTimeout(r, 20000))]);
    return this.play(list, 'in', rect, camera, ready);
  }
  animateOut(list) { return this.play(list, 'out', null, null); }
  play(list, dir, rect, camera, ready = null) {
    if (!list.length) return 0;
    const P = this.preset;
    const side = dir === 'in' || !P.out.mirror ? P[dir] : { ...P.in, choreo: { ...P.in.choreo, reverse: !P.in.choreo.reverse } };
    if (!rect) { const xs = list.map(i => i.x), zs = list.map(i => i.z); rect = { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) }; }
    // Is this wall piece between the camera and the room? (camera and room centre on opposite sides of its line)
    const cameraSide = (it) => {
      if (!camera) return false;
      const cx = (rect.x0 + rect.x1) / 2, cz = (rect.z0 + rect.z1) / 2, cp = camera.position;
      const opp = (a, b, w) => (a - w) * (b - w) < 0;
      if (it.wallDir === 'h') return opp(cp.z, cz, it.z);
      if (it.wallDir === 'v') return opp(cp.x, cx, it.x);
      return opp(cp.z, cz, it.z) || opp(cp.x, cx, it.x);
    };
    const layerOf = (it) => side.choreo.nearWallsLast && it.wallDir && cameraSide(it) ? 'walls-near' : it.layer;
    const { delays, total } = T.anim.schedule(list.map(it => ({ x: it.x, z: it.z, layer: layerOf(it) })), side, rect, null, Math.random);
    const t0 = performance.now(), speed = P.speed || 1;
    const as = [];
    list.forEach((it, i) => {
      const a = { dir, t0: ready ? Infinity : t0 + delays[i] / speed, delay: delays[i] / speed, m: T.anim.motionFor(side, it.layer), rest: it.rest, axisPick: ['x', 'y', 'z'][(i * 7 + 3) % 3], layerUsed: layerOf(it), speed, entityId: it.entityId };
      this.anims.set(it.group, a); as.push(a);
      if (dir === 'in') it.group.visible = false;
      if (it.entityId) this.dropHalos(it.entityId);
    });
    const ep = this.lastEpisode = { dir, n: list.length, total: total / speed, near: list.filter(it => layerOf(it) === 'walls-near').length, at: t0, loading: !!ready };
    if (ready) ready.then(() => { const now = performance.now(); for (const a of as) a.t0 = now + a.delay; ep.at = now; ep.loading = false; ep.loadMs = Math.round(now - t0); });
    return total / speed;
  }
  // the tuner's applyPose: drop, spin about the chosen axis, grow/squash, fade
  stepAnims(now) {
    for (const [g, a] of this.anims) {
      const p = (now - a.t0) / a.m.dur;
      if (a.dir === 'in') { if (p <= 0) { g.visible = false; continue; } g.visible = true; }
      const q = a.dir === 'in' ? Math.min(1, p) : 1 - Math.max(0, Math.min(1, p));
      const ps = T.anim.pose(a.m, q);
      const axis = ps.axis === 'random' ? a.axisPick : ps.axis;
      g.position.set(a.rest.x, a.rest.y + ps.dy, a.rest.z);
      g.rotation.set(axis === 'x' ? ps.ang : 0, a.rest.rot + (axis === 'y' ? ps.ang : 0), axis === 'z' ? ps.ang : 0);
      g.scale.set(Math.max(1e-4, ps.sx), Math.max(1e-4, ps.sy), Math.max(1e-4, ps.sz));
      if (a.m.fade || a.fadeMats) setOpacity(g, a, ps.opacity);
      if (p >= 1) this.endAnim(g, a);
    }
  }
  // an animation is over (or its piece went to sleep under it): the piece is where it rests
  endAnim(g, a) {
    this.anims.delete(g);
    if (a.dir === 'out') { g.parent?.remove(g); return; }
    g.scale.setScalar(1); g.rotation.set(0, a.rest.rot, 0); g.position.set(a.rest.x, a.rest.y, a.rest.z);
    if (a.fadeMats) setOpacity(g, a, 1);
    const r = a.entityId && this.recs.get(a.entityId); if (r?.it) this.settler.enqueue(r.it);
  }
  spawning(id) { const r = this.recs.get(id); return !!r && this.anims.has(r.group); }

  // A THING TIPPED OVER (Harry 2026-10-11: the ☰ menu's tilt; and the library's exhibits lying on a side or their back).
  // (Since 2026-10-12 a thing carries a whole orientation, `quat`, under its turn: core/orient.js. The library's exhibits
  // still say tiltZ / tiltX; orientOf below reads either.)
  // entity.tiltZ / tiltX are radians about the thing's OWN front-to-back / side-to-side horizontal axis, applied after
  // its turn (`rot`). The turn stays on the group, which every animation, drag and the settler write; the tilt lives on
  // a node INSIDE the group that exists only while the thing is tilted, so an upright thing is built exactly as before.
  //   pivot      the middle of its box (dims), so it stays over the spot it stands on
  //   grounding  then it is raised or lowered until its LOWEST POINT is where its lowest point was upright (measured on
  //              the mesh's own vertices, in the group's frame; the stand-in box until the mesh arrives): it rests on
  //              the surface it was on, neither sunk nor floating. entity.y is unchanged: still what it rests on.
  // Asked for every frame (poseRec): nothing is done unless the tilt or the mesh changed.
  seatTilt(r, q = orientOf(r.entity)) {
    const v = r.visual, key = q ? q.join() : '';
    if (!v || (r.tiltKey === key && r.tiltOn === v)) return;
    const g = r.group, was = r.tiltKey; r.tiltKey = key; r.tiltOn = v;
    if (!key) {
      if (r.tiltNode) { g.add(v); r.tiltNode.removeFromParent(); r.tiltNode = null; }
      if (was) { g.userData.pickR = undefined; g.matrixWorldNeedsUpdate = true; this.mwStale = true; this.dropHalos(r.entity.id); }
      return;
    }
    let n = r.tiltNode; if (!n) { n = r.tiltNode = new THREE.Group(); n.userData.tilt = true; g.add(n); }
    if (v.parent !== n) n.add(v);
    const [w, h, d] = r.entity.dims || [2, 2, 2];
    if (v.userData.lowUp === undefined) v.userData.lowUp = lowestY(v, IDENT); // upright: usually 0 (things stand on their groups)
    n.quaternion.set(q[0], q[1], q[2], q[3]).normalize(); n.position.set(0, 0, 0); n.updateMatrix();
    const c = TILT_V.set(0, h / 2, 0).applyMatrix4(n.matrix); n.position.set(-c.x, h / 2 - c.y, -c.z); n.updateMatrix(); // about the box's middle
    n.position.y += v.userData.lowUp - lowestY(v, n.matrix); n.updateMatrix();
    g.userData.pickR = Math.hypot(w, h, d) + 6; // the pointer's "could this ray touch it" sphere (nearRay): any way up
    g.matrixWorldNeedsUpdate = true; this.mwStale = true; this.cutDirty = true;
    if (was !== key) this.dropHalos(r.entity.id); // the brackets are measured round the thing as it lies
  }
  // a thing's mesh arrived or was rebuilt: it takes the stand-in's place (inside the tilt, when the thing is tilted)
  swapVisual(r, v) { r.visual?.removeFromParent(); r.visual = v; if (r.it) r.it.visual = v; (r.tiltNode || r.group).add(v); if (r.entity.kind === 'object' && !this.anims.has(r.group)) this.seatTilt(r); }
  // (tests) a thing's box in the world as drawn, from its vertices: { min, max } in feet
  drawnBox(id) { const r = this.recs.get(id); if (!r?.visual) return null; this.settleMatrices(); r.group.updateMatrixWorld(true); const b = vertexBox(r.visual, r.visual.parent.matrixWorld); return b && { min: b.min.toArray(), max: b.max.toArray(), standIn: !!r.visual.userData?.placeholder, tilted: !!r.tiltNode }; }

  // where a thing is drawn this frame: where the state has it, or where a drag (mine, another seat's, its room's) has it
  poseRec(r, id) {
    const e = r.entity; this.mwStale = true;
    if (e.kind === 'room' || e.kind === 'building' || this.anims.has(r.group)) return;
    let x = e.x, z = e.z, rot = e.rot || 0, y = r.it ? r.it.rest.y : e.y || 0;
    const remote = this.remoteDrags?.get(id);
    if (remote) { x = remote.x; z = remote.z; if (remote.rot != null) rot = remote.rot; if (remote.y != null) y = remote.y; }
    const mine = this.frameDrags?.get(id);
    if (mine) { x = mine.x; z = mine.z; if (mine.rot != null) rot = mine.rot; if (mine.y != null) y = mine.y; }
    const sh = !remote && !mine && e.room ? this.roomShifts?.get(e.room) : null; // its room is being dragged: it rides along
    if (sh) { x += sh.dx; z += sh.dz; }
    r.group.position.set(x, y, z); r.group.rotation.y = rot;
    if (e.kind === 'object') this.seatTilt(r, mine && mine.quat !== undefined ? mine.quat : remote && remote.quat != null ? remote.quat : orientOf(e)); // (a roll being dragged, mine or another seat's)
    r.lifted = y;
    r.group.scale.setScalar((mine?.scale || 1) * (e.libK || 1)); // libK: a library thing's drawing scale (library.js, "the same size for all"); nothing in a real area has it
    r.drawn = [x, z];
  }

  // ---------------- per frame ----------------
  frame(dt, { presence, localDrags, deco, now = performance.now(), camera }) {
    this.stepAnims(now);
    if (this.roofsOn) this.roofTiers(camera, now);
    if (this.assets.figures?.name().faceCamera) { const vs = []; for (const r of this.pawns) if (r.visual?.userData.nameG) vs.push(r.visual); if (vs.length) this.assets.figures.faceNames(vs, camera); } // names on bases stay toward the camera
    this.settler.tick(this.busy?.() ? 0.4 : 3); // (seating things on table tops can wait while the hand moves: interact.js)
    // ROOMS BEING DRAGGED (mine, or another seat's, through presence): the whole room rides along (its floor and walls,
    // everything in it, its selection brackets) and a footprint shows where it would land: the dragger's colour, or red
    // when the drop would be refused (only the dragger knows that; other seats just see the room move)
    // every drag another seat is making here, looked up once (it was a walk over the seats for every thing, every frame)
    const remoteDrags = this.remoteDrags = new Map(); for (const st of presence?.seats?.values() || []) if (st.area === this.areaId && st.drags?.size) for (const [id, d] of st.drags) if (!remoteDrags.has(id)) remoteDrags.set(id, d);
    const shifts = this.roomShifts = new Map();
    for (const id of new Set([...(localDrags?.keys() || []), ...remoteDrags.keys()])) {
      const r = this.recs.get(id); if (r?.entity.kind !== 'room') continue;
      const mine = localDrags?.get(id), rem = mine ? null : remoteDrags.get(id), d = mine || rem; if (!d) continue;
      const c = r.entity.recipe, cx = (c.x + c.w / 2) * CELL, cz = (c.z + c.d / 2) * CELL;
      shifts.set(id, { dx: d.x - cx, dz: d.z - cz, x: d.x, z: d.z, w: c.w * CELL, d: c.d * CELL, rc: c, color: mine ? (mine.ok === false ? NO_DROP : deco?.color) : presence.dragSeat?.(this.areaId, id)?.color });
    }
    this.frameDrags = localDrags; this.frameDeco = deco;
    this.sleepStep(now, deco, localDrags, presence); // far buildings out of the scene; the ones needed back in (SLEEP)
    if (shifts.size || this.hadShifts) for (const s of this.shell.values()) { // (only while a room is being dragged, and once after)
      if (s.asleep) continue;
      const sh = shifts.get(s.roomId);
      if (this.anims.has(s.group) || (!sh && !s.shifted)) continue;
      s.group.position.set(s.spec.x + (sh?.dx || 0), s.spec.y || 0, s.spec.z + (sh?.dz || 0)); s.shifted = !!sh;
    }
    this.hadShifts = shifts.size > 0 || (this.hadShifts && this.anims.size > 0);
    for (const [id, m] of this.dragPlates ||= new Map()) if (!shifts.has(id)) { m.parent?.remove(m); m.material.dispose(); this.dragPlates.delete(id); }
    for (const [id, sh] of shifts) {
      let m = this.dragPlates.get(id);
      if (!m) { m = new THREE.Mesh(sh.rc.outline ? cellsGeometry(sh.rc) : PLATE, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthTest: false })); m.renderOrder = 25; m.userData.halo = true; m.userData.noPick = true; m.userData.shaped = !!sh.rc.outline; this.layers.deco.add(m); this.dragPlates.set(id, m); }
      m.material.color.set(sh.color || '#ffffff'); if (!m.userData.shaped) m.scale.set(sh.w, 1, sh.d); m.position.set(sh.x, (sh.rc.y || 0) + 0.12, sh.z); // (a shaped room's plate is its own cells, about its bounding box's centre)
    }
    for (const h of this.halos.values()) { const v = h.obj.userData.volume; if (!v) continue; const sh = v.roomIds.length === 1 ? shifts.get(v.roomIds[0]) : v.roomIds.map(i => shifts.get(i)).find(Boolean); v.group.position.set(v.home[0] + (sh?.dx || 0), v.y || 0, v.home[1] + (sh?.dz || 0)); }
    for (const [id, r] of this.recs) { if (!r.asleep) this.poseRec(r, id); }
    this.cutPass(); // the cut: what is above it is not drawn (and so its lamps are out: fxItems)
    this.cutFly.frame(now, camera); // what the cut just hid or showed, in flight (nothing in flight: nothing done)
    this.shadowPass();
    this.roofPass(); // roofs show with the switch on and the cut off or above them
    { const L = this.fogLevel(); if (L !== this.fogL && this.fx?.atmos?.setLevel) { this.fogL = L; this.fx.atmos.setLevel({ base: L, indoorOnly: L !== 0 }); } }
    this.fogwar?.frame(dt * 1000, now);
    this.fx?.frame(dt * 1000, now); // the fx stack counts in MILLISECONDS (as the tuner calls it); seconds here ran the fog, smoke and water 1000x slow (Harry 2026-10-05: "fog is non-moving static")
    this.frameCursors(presence);
    this.framePings(now);
    this.frameSignals(deco, now, camera);
    // Every visible figure uses its grounded base's sight, including tall figures and flyers.
    // The fog pass exempts only its depth-tested silhouette, never nearby geometry.
    const fog=this.fx?.fogwar||this.fogwar;
    const sightPawns=this.fogActive ? [...this.pawns].filter(r=>r.group.visible && !this.cutHides(r.entity) && !this.fogRule?.(r.entity)) : [];
    if(fog?.setOverlays)fog.setOverlays(this.fogActive ? [...this.layers.deco.children.filter(g=>g.userData.ruler||(g.userData.ping&&g.userData.fogged)),...[...this.cursors.values()].filter(c=>c.fogged).map(c=>c.obj),...sightPawns.flatMap(r=>[r.label,r.mark].filter(Boolean))] : []);
    if(fog?.setFlyers)fog.setFlyers(sightPawns.map(r=>r.group));
    // walls known through their thickness (2026-10-18): a wall piece or post whose FACE the viewer has seen or remembers
    // keeps its cap and far face (fogwar.js); recomputed when sight or the cut changes (cutGen), not every frame
    if(fog?.setKnown){ if(this.fogActive&&this.fogKnown){ if(this._knownGen!==this.cutGen){ this._knownGen=this.cutGen; this._known=this.knownWalls(); } fog.setKnown(this._known); } else if(this._known?.length){ this._known=[]; this._knownGen=null; fog.setKnown([]); } }
  }

  // THE PIECES STILL ON THEIR WAY (2026-10-11, the loading screen waits for the opening view's: main.js "the hold"):
  // how many things and shell pieces that are awake have a mesh that has neither arrived nor failed. With a camera,
  // only those it can see (a 10-ft ball round each against its frustum).
  unsettled(camera = null) {
    let fr = null; if (camera) { camera.updateMatrixWorld(); fr = _fr.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); }
    const seen = (x, y, z) => !fr || fr.intersectsSphere(_ball.set(_bc.set(x, y, z), 10));
    let n = 0;
    for (const r of this.recs.values()) if (r.ready && !r.settled && !r.asleep && seen(r.entity.x, r.entity.y || 0, r.entity.z)) n++;
    for (const s of this.shell.values()) if (s.ready && !s.settled && !s.asleep && seen(s.spec.x, s.spec.y || 0, s.spec.z)) n++;
    return n;
  }

  frameCursors(presence) {
    const here = new Set();
    for (const s of presence ? presence.on(this.areaId) : []) {
      if (!s.pos || presence.hidden?.has(s.seat)) continue; // (hidden: a seat whose cursor this screen already shows another way: the intro's phantom, intro.js)
      here.add(s.seat);
      let c = this.cursors.get(s.seat);
      const text = s.ghost ? `${s.name} · ${s.label}${s.thinking ? ' · thinking…' : ''}` : s.name;
      if (!c || c.text !== text || c.color !== s.color) {
        if (c) this.layers.cursors.remove(c.obj);
        c = { obj: cursorMesh(s, text), text, color: s.color };
        this.cursors.set(s.seat, c); this.layers.cursors.add(c.obj);
      }
      let cy = s.pos[2] || 0; if (this.roofsOn && this.roofRecs?.size) { _down.set(new THREE.Vector3(s.pos[0], 400, s.pos[1]), DOWN); const rf = this.roofAt(_down, true); if (rf && rf.point.y > cy) cy = rf.point.y; } // with my roofs showing, on the roof over that spot (a deck, a pitch), not under it
      c.obj.position.set(s.pos[0], cy, s.pos[1]); c.obj.visible = this.cut == null || HT.visibleAt(cy, this.cut); // on the floor it points at; a cursor above my cut is not drawn
      // VISION FOG (Harry 2026-10-15): other people's cursors show through it, dimmed and ringed where I cannot see the spot
      // ("pointing into the unknown"); drawn again after the fog pass (fogwar.js overlays), the way rulers are. The GM's is
      // withheld there unless GM_CURSOR_THROUGH_FOG: they may be standing in the room they are preparing.
      const fogged = !!this.fogActive && !!this.fogSees && !this.fogSees(s.pos[0], s.pos[1], cy);
      if (fogged && !GM_CURSOR_THROUGH_FOG && presence.roleOf?.(s.seat) === 'gm') c.obj.visible = false;
      this.dimCursor(c, fogged);
      c.fogged = fogged && c.obj.visible;
      if (s.ghost) c.obj.children[0].rotation.z += 0.04;
    }
    for (const [seat, c] of this.cursors) if (!here.has(seat)) { this.layers.cursors.remove(c.obj); this.cursors.delete(seat); }
  }
  // the dim, ringed look of a cursor over ground I cannot see (materials keep their program: only opacity and a mesh's visibility change)
  dimCursor(c, on) {
    if (!c.mats) { c.mats = []; c.obj.traverse(o => { if (o.material && !o.userData.fogRing) c.mats.push([o.material, o.material.opacity]); }); c.ring = c.obj.children.find(o => o.userData.fogRing); }
    if (c.dim === on) return; c.dim = on;
    for (const [m, base] of c.mats) m.opacity = on ? base * 0.5 : base;
    if (c.ring) c.ring.visible = on;
  }

  ping(x, z, color, y = 0) { this.pings.push({ x, z, y: y || 0, color, t0: performance.now() }); } // (y: the height of the spot; a floor upstairs, a table top, a roof)
  // THE CELL INDICATOR: which 5-ft squares an action will take, and which it will not. `lit` cells light up in the given
  // colour (they will become the thing); `dim` cells get a small quiet mark (asked for, but not available: another room
  // stands there). Built for the room tool's overlapping draws (Harry 2026-10-05) and meant to be reused, e.g. by the
  // upper-storey build mode ("which squares can I build on"). Cells are world cells [gx, gz]; y: the height to draw at.
  //   world.showCells('room-tool', { lit, dim, color })      world.clearCells('room-tool')
  showCells(key, { lit = [], dim = [], color = '#ffffff', dimColor = NO_DROP, y = 0, opacity = 0.34 } = {}) {
    const CAP = 1600;
    const mk = (opacity) => { const m = new THREE.InstancedMesh(CELL_PLATE, this.ghostMaterial(new THREE.MeshBasicMaterial({ transparent: true, opacity, depthTest: false, depthWrite: false })), CAP); m.renderOrder = 25; m.frustumCulled = false; m.userData.halo = true; m.userData.noPick = true; this.layers.deco.add(m); return m; };
    let c = (this.cellMarks ||= new Map()).get(key);
    if (!c) { c = { lit: mk(opacity), dim: mk(0.5) }; this.cellMarks.set(key, c); }
    c.lit.material.opacity = opacity;
    this.ghostMode(c.lit, y); this.ghostMode(c.dim, y); // on a level: over what is below it, behind what is on it (the ghost, above)
    const M = new THREE.Matrix4();
    const fill = (mesh, cells, scale, col) => { mesh.count = Math.min(CAP, cells.length); cells.slice(0, CAP).forEach(([gx, gz], i) => { M.makeScale(scale, 1, scale).setPosition((gx + 0.5) * CELL, y === 0 ? 0.12 : y - GHOST_DROP + 0.02, (gz + 0.5) * CELL); mesh.setMatrixAt(i, M); }); mesh.instanceMatrix.needsUpdate = true; mesh.material.color.set(col); };
    fill(c.lit, lit, CELL - 0.3, color); fill(c.dim, dim, 1.1, dimColor); // lit: the whole square; not available: a small red mark in its middle
    c.info = { lit: lit.length, dim: dim.length, color: String(color), y };
  }
  clearCells(key) { const c = this.cellMarks?.get(key); if (!c) return; for (const m of [c.lit, c.dim]) { m.parent?.remove(m); m.material.dispose(); } this.cellMarks.delete(key); }

  // a refused room turn or drop: where it would have gone, in red, for a moment
  flashRect(x0, z0, x1, z1, color = NO_DROP, ms = 1100, y = 0) {
    const m = new THREE.Mesh(PLATE, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, depthTest: false }));
    m.renderOrder = 25; m.userData.halo = true; m.userData.noPick = true; m.scale.set(x1 - x0, 1, z1 - z0); m.position.set((x0 + x1) / 2, y + 0.12, (z0 + z1) / 2);
    this.layers.deco.add(m); (this.flashes ||= []).push({ m, t0: performance.now(), ms });
  }
  framePings(now) {
    for (const p of this.pings) {
      if (!p.obj) { p.obj = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.1, 48), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, side: THREE.DoubleSide, depthTest: false })); p.obj.rotation.x = -Math.PI / 2; p.obj.position.set(p.x, (p.y || 0) + 0.15, p.z); p.obj.renderOrder = 20; p.obj.userData.ping = true; p.obj.userData.noPick = true; this.layers.deco.add(p.obj); }
      const k = (now - p.t0) / 1400;
      p.obj.userData.fogged = !!this.fogActive && !!this.fogSees && !this.fogSees(p.x, p.z, p.y || 0); // over ground I cannot see: drawn again after the fog pass
      p.obj.scale.setScalar(1 + (k % 0.5) * 10); p.obj.material.opacity = Math.max(0, 1 - k);
    }
    this.pings = this.pings.filter(p => { if (now - p.t0 > 1400) { this.layers.deco.remove(p.obj); return false; } return true; });
    if (this.flashes?.length) this.flashes = this.flashes.filter(f => { const k = (now - f.t0) / f.ms; if (k >= 1) { f.m.parent?.remove(f.m); f.m.material.dispose(); return false; } f.m.material.opacity = 0.42 * (1 - k * k); return true; });
  }

  // ---------------- signals: halos and footprints (no boxes) ----------------
  // deco: { selected: Set, hover, color, pending: Set, style: 'halo' | 'footprint' }
  frameSignals(deco, now, camera) {
    const want = new Map(); // `${id}|${kind}` -> { id, kind, color }
    if (deco) {
      for (const id of deco.selected || []) want.set(id + '|sel', { id, kind: 'sel', color: deco.color });
      if (deco.hover && !deco.selected?.has(deco.hover)) want.set(deco.hover + '|hov', { id: deco.hover, kind: 'hov' });
      for (const id of deco.pending || []) if (!deco.selected?.has(id)) want.set(id + '|pend', { id, kind: 'pend' });
      // other seats' selections: faint, in their colour, never on what I have selected myself (presence; hidden things
      // never reach a player's presence, and a player's view has no hidden entity to draw it on anyway)
      for (const [id, o] of deco.remote || []) if (!deco.selected?.has(id) && (this.recs.has(id) ? !this.cutHides(this.recs.get(id).entity) : id.startsWith('wall:') && HT.visibleAt(FP.keyLevel(id.slice(5)) || 0, this.cut ?? null))) want.set(id + '|rem', { id, kind: 'rem', color: o.color || '#ffffff', seat: o.seat });
    }
    if (this.gmSide) { // (which things are hidden is worked out once per state)
      if (this.hiddenOfE !== this.view?.entities) { this.hiddenOfE = this.view?.entities; this.hiddenIds = []; for (const [id, r] of this.recs) if (r.entity.hidden && (r.entity.kind === 'object' || r.entity.kind === 'token')) this.hiddenIds.push(id); }
      for (const id of this.hiddenIds) { const r = this.recs.get(id); if (r && r.entity.hidden && !r.asleep) want.set(id + '|hid', { id, kind: 'hid' }); }
    }
    // a hidden room's own floor and walls: the same hidden treatment as a hidden thing (the house look's tint wash)
    if (this.gmSide && this.hiddenRooms?.size) for (const [k, sh] of this.shell) if (sh.hidden && !sh.asleep && sh.visual && !sh.visual.userData?.placeholder && sh.group.visible && !this.anims.has(sh.group)) want.set(`shell:${k}|hid`, { id: 'shell:' + k, kind: 'hid' });
    if (this.fogRule) for (const [k,w] of want) { const e=this.recs.get(w.id)?.entity; if(e && this.fogRule(e)) want.delete(k); }
    const style = deco?.style || 'halo';
    for (const [k, h] of this.halos) if (!want.has(k) || h.style !== style || h.color !== want.get(k).color) { h.obj.parent?.remove(h.obj); this.halos.delete(k); }
    for (const [k, w] of want) {
      if (this.halos.has(k)) continue;
      const obj = this.signalFor(w, style);
      if (obj) this.halos.set(k, { obj, style, color: w.color, id: w.id });
    }
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    for (const h of this.halos.values()) h.obj.traverse(o => { if (o.material?.userData?.halo) { const u = o.material.uniforms; u.pulse.value = o.material.userData.kind === 'pend' ? 0.5 + 0.5 * Math.sin(now / 90) : o.material.userData.kind === 'sel' ? pulse : 0.6; } if (o.material?.userData?.foot) o.material.opacity = o.material.userData.foot * (0.55 + 0.45 * pulse); });
    this.lastSignals = [...this.halos.keys()];
    this.selFx?.tick(now - (this.selT ?? now), now, camera); this.remoteFx?.tick(now - (this.selT ?? now), now, camera); this.selT = now;
    // a faint drop line to the floor under anything lifted that is selected or being lifted (hanging, flying)
    // FLYERS AND HANGING THINGS (Stage G): a faint drop line from anything lifted down to the SURFACE below it (the floor
    // of the room it is over, or the top of a thing under it; never just height 0) and a small height label riding with
    // it ("12 ft" above that surface). For what is selected or being lifted, and for every pawn in the air, selected or
    // not (one visible height number on the token).
    const lifted = new Map(), E = this.view?.entities;
    for (const [id, t] of this.stairNotes || []) t.visible = !!this.recs.get(id)?.group.visible; // a stair's note shows with its stair
    const consider = (id, sel) => {
      const r = this.recs.get(id); if (!r || lifted.has(id) || !r.group.visible || r.entity.parent || this.anims.has(r.group)) return;
      const k = r.entity.kind; if (k !== 'object' && k !== 'token') return;
      const y = r.lifted ?? (r.entity.y || 0), x = r.group.position.x, z = r.group.position.z;
      if (k === 'token') { const by = this.pawnBaseAt(r, x, y, z); if (y - by > PAWN_BEAM.min) lifted.set(id, { r, x, y, z, fy: by, sel, pawn: true }); return; } // A PAWN: its base is down there, a beam joins them
      let fy = HT.floorUnder(E, x, z, y)?.y ?? Math.min(0, y);
      if (y - fy <= 0.3) return;
      if (sel) { const sb = this.surfaceBelow(x, y, z, new Set([id]), fy); if (sb && sb.y > fy && sb.y <= y) fy = sb.y; if (y - fy <= 0.3) return; } // a thing's top under it (only for the few selected: a raycast)
      lifted.set(id, { r, x, y, z, fy, sel });
    };
    for (const id of deco?.selected || []) consider(id, true);
    for (const r of this.pawns) consider(r.entity.id, false);
    for (const r of this.pawns) { const f = lifted.get(r.entity.id); this.setFoot(r, f ? f.y - f.fy : 0); } // the base stays on what is under the figure
    for (const [id, l] of this.dropLines) if (!lifted.has(id)) { l.parent?.remove(l); l.userData.tag?.material.map?.dispose(); this.dropLines.delete(id); }
    for (const [id, f] of lifted) {
      if (!f.pawn) continue;
      const e = f.r.entity, col = this.pawnColor(e), ghost = !!(this.gmSide && e.hidden), key = `${col}|${ghost}`, drop = f.y - f.fy, text = `${Math.round(drop * 2) / 2} ft`;
      let l = this.dropLines.get(id);
      if (l && l.userData.beamKey !== key) { l.parent?.remove(l); l.userData.tag?.material.map?.dispose(); this.dropLines.delete(id); l = null; }
      if (!l) {
        l = new THREE.Group();
        const mat = (c, side) => new THREE.MeshBasicMaterial({ color: c, side, toneMapped: false, fog: false, transparent: ghost, opacity: ghost ? PAWN_BEAM.hiddenOpacity : 1, depthWrite: !ghost });
        const rod = new THREE.Mesh(BEAM_GEO, mat(col, THREE.FrontSide)), casing = new THREE.Mesh(BEAM_GEO, mat(PAWN_BEAM.casingColor, THREE.BackSide));
        for (const m of [rod, casing]) { m.userData.halo = true; m.userData.noPick = true; m.raycast = () => {}; m.castShadow = false; m.receiveShadow = false; }
        l.add(rod, casing); Object.assign(l.userData, { halo: true, noPick: true, beam: true, beamKey: key, color: col }); this.layers.deco.add(l); this.dropLines.set(id, l);
      }
      const len = drop + 0.12; // from inside the base's disc up to the figure's feet
      l.position.set(f.x, f.fy, f.z); l.userData.drop = drop; l.userData.floor = f.fy;
      const rad = Math.max(PAWN_BEAM.radius, camera ? camera.position.distanceTo(_bv.set(f.x, f.fy + drop / 2, f.z)) * PAWN_BEAM.minAngle : 0); l.userData.radius = rad;
      l.children[0].scale.set(rad, len, rad); l.children[1].scale.set(rad * PAWN_BEAM.casing, len, rad * PAWN_BEAM.casing);
      if (l.userData.text !== text) { // the height, ON the beam: screen-constant, never picked
        if (l.userData.tag) { l.remove(l.userData.tag); l.userData.tag.material.map?.dispose(); }
        const tag = labelSprite(text, { small: true, accent: col }); tag.scale.multiplyScalar(PAWN_BEAM.labelScale); tag.center.set(0.5, 0.5); tag.userData.halo = true; tag.userData.heightTag = true;
        l.add(tag); l.userData.tag = tag; l.userData.text = text;
      }
      l.userData.tag.position.y = drop * PAWN_BEAM.labelAt;
    }
    for (const [id, f] of lifted) {
      if (f.pawn) continue;
      let l = this.dropLines.get(id); const col = (f.sel && deco?.color) || f.r.entity.color || '#ffffff';
      if (!l) { l = new THREE.Group(); const line = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45, depthWrite: false })); line.position.y = 0.5; const dot = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.4, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); dot.rotation.x = -Math.PI / 2; dot.position.y = 0.03; l.add(line, dot); l.userData.halo = true; l.userData.noPick = true; this.layers.deco.add(l); this.dropLines.set(id, l); }
      const drop = f.y - f.fy, text = `${Math.round(drop * 2) / 2} ft`;
      l.position.set(f.x, f.fy, f.z); l.children[0].scale.y = Math.max(0.01, drop); l.children[0].position.y = drop / 2; l.userData.drop = drop; l.userData.floor = f.fy;
      if (l.userData.text !== text) { // the height label: beside the thing's foot, screen-constant, never picked
        if (l.userData.tag) { l.remove(l.userData.tag); l.userData.tag.material.map?.dispose(); }
        const tag = labelSprite(text, { small: true }); tag.scale.multiplyScalar(0.72); tag.center.set(-0.25, 0.5); tag.userData.halo = true; tag.userData.heightTag = true;
        l.add(tag); l.userData.tag = tag; l.userData.text = text;
      }
      l.userData.tag.position.y = drop + 0.2;
    }
  }
  // A STAIR THAT CANNOT WORK WHERE IT STANDS SAYS SO (2026-10-11; core/stairs.js stairStatus): a small note over it, for
  // as long as that is so. A stair the room's own layout rolled, with simply nothing built over it, is furniture and
  // says nothing. Never picked; shown with the stair (hidden by the cut with it).
  syncStairNotes(ents) {
    const want = new Map();
    for (const s of ST.stairsOf(ents)) { const Q = ST.stairStatus(ents, s); if (Q.code && !(s.rule && Q.code === 'open')) want.set(s.id, { s, Q, text: STAIR_NOTE[Q.code] || 'Leads nowhere' }); }
    this.stairNotes ||= new Map();
    for (const [id, t] of this.stairNotes) if (!want.has(id)) { t.parent?.remove(t); t.material.map?.dispose(); this.stairNotes.delete(id); }
    for (const [id, w] of want) {
      let t = this.stairNotes.get(id);
      if (!t || t.userData.text !== w.text) {
        if (t) { t.parent?.remove(t); t.material.map?.dispose(); }
        t = labelSprite(w.text, { small: true, accent: w.Q.code === 'open' ? null : '#e0a03c' }); t.scale.multiplyScalar(0.8); t.userData.halo = true; t.userData.noPick = true; t.userData.stairNote = id; t.userData.text = w.text; t.renderOrder = 26;
        this.layers.deco.add(t); this.stairNotes.set(id, t);
      }
      t.userData.code = w.Q.code; t.userData.why = w.Q.why;
      t.position.set(w.s.x, ST.stairBase(w.s) + Math.min(ST.stairRise(w.s), 10) + 2.2, w.s.z);
    }
  }
  // (tests, the ring) the notes showing: [{ id, text, code, why, shown }]
  stairNoteList() { return [...(this.stairNotes || [])].map(([id, t]) => ({ id, text: t.userData.text, code: t.userData.code, why: t.userData.why, shown: t.visible })); }
  // (tests) the height labels showing: [{ id, text, drop, floor }]
  heightLabels() { return [...this.dropLines].map(([id, l]) => ({ id, text: l.userData.text, drop: +l.userData.drop.toFixed(2), floor: l.userData.floor, ...(l.userData.beam && { beam: true }) })); }
  dropHalos(id, poseOnly = false) { for (const [k, h] of this.halos) if (h.id === id && (!poseOnly || h.style === 'footprint')) { h.obj.parent?.remove(h.obj); this.halos.delete(k); } }
  // (tests) of points along a room's glow outline, the share the camera can actually see: a ray from the camera reaches
  // the point before any wall, floor board or furniture. `at` overrides the placement ({ y, inset }) for comparison.
  glowSeen(roomId, camera, at = null, n = 120) {
    const rm = this.view?.entities[roomId]; if (!rm) return null;
    const c = rm.recipe, k = at || this.roomGlowAt(rm), [x0, z0, x1, z1] = [c.x * CELL + k.inset, c.z * CELL + k.inset, (c.x + c.w) * CELL - k.inset, (c.z + c.d) * CELL - k.inset];
    const per = 2 * (x1 - x0 + z1 - z0), ray = new THREE.Raycaster(), cam = camera.position, P = new THREE.Vector3();
    const targets = [this.layers.shell, this.layers.things]; for (const t of targets) t.updateMatrixWorld(true);
    let seen = 0, inView = 0;
    for (let i = 0; i < n; i++) {
      let d = (i + 0.5) / n * per; const L = [x1 - x0, z1 - z0, x1 - x0, z1 - z0]; let e = 0; while (d > L[e]) d -= L[e++];
      const [px, pz] = [[x0 + d, z0], [x1, z0 + d], [x1 - d, z1], [x0, z1 - d]][e];
      P.set(px, k.y, pz);
      const ndc = P.clone().project(camera); if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) continue; inView++;
      const dir = P.clone().sub(cam), dist = dir.length(); ray.set(cam, dir.normalize()); ray.far = dist;
      const hit = ray.intersectObjects(targets, true).find(h => h.object.visible && !h.object.userData?.halo && h.distance < dist - 0.02);
      if (!hit) seen++;
    }
    return { seen, inView, share: inView ? seen / inView : 0, at: k };
  }
  // where a room's glow can be seen: the floor's top and the walls' inner face, measured from the built pieces
  roomGlowAt(rm) {
    const c = rm.recipe, x0 = c.x * CELL, z0 = c.z * CELL, x1 = (c.x + c.w) * CELL, z1 = (c.z + c.d) * CELL, b = new THREE.Box3();
    const ry = HT.roomY(c); let y = ry, inset = 0.5;
    for (const s of this.shell.values()) {
      if (s.roomId !== rm.id || !s.visual || s.visual.userData?.placeholder || s.spec.support || s.spec.rail) continue;
      b.setFromObject(s.group); if (b.isEmpty()) continue;
      if (s.spec.layer === 'floor') { if (!s.spec.slab && b.max.y < ry + 0.8) y = Math.max(y, b.max.y); continue; }
      // a wall piece along an edge of the room: how far its inner face reaches into the room
      if (s.spec.wallDir === 'h') inset = Math.max(inset, Math.min(2, Math.abs(s.spec.z - z0) < 1 ? b.max.z - z0 : Math.abs(s.spec.z - z1) < 1 ? z1 - b.min.z : 0));
      if (s.spec.wallDir === 'v') inset = Math.max(inset, Math.min(2, Math.abs(s.spec.x - x0) < 1 ? b.max.x - x0 : Math.abs(s.spec.x - x1) < 1 ? x1 - b.min.x : 0));
    }
    return { y: y + 0.05, inset: inset + 0.15 };
  }
  signalFor(w, style) {
    if (w.kind === 'rem') return this.remoteSignal(w);
    if (w.id.startsWith('shell:')) { const sh = this.shell.get(w.id.slice(6)); return sh ? this.sharedSignal(sh, w) : null; }
    if (w.id.startsWith('roof:')) { // a roof wears the house selection look round its volume, like a room
      const rec = this.roofRecs?.get(w.id.slice(5)); if (!rec || !rec.group.visible) return null;
      const b = rec.box, group = new THREE.Group(); group.userData.halo = true; group.position.set((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2); this.layers.deco.add(group);
      const vol = { group, visual: group, y: b.min.y, dims: [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z], roomIds: [rec.id], home: [group.position.x, group.position.z] };
      const shared = this.sharedSignal(vol, w);
      if (shared) { shared.userData.volume = vol; shared.addEventListener('removed', () => group.parent?.remove(group)); return shared; }
      group.parent?.remove(group); return null;
    }
    if (w.id.startsWith('wall:')) { const s = [...this.shell.values()].find(s => s.group.userData.edgeKey === w.id.slice(5)); return s ? this.sharedSignal({ group: s.group, visual: s.visual }, w) : null; }
    const r = this.recs.get(w.id); if (!r) return null;
    const e = r.entity;
    if (e.kind === 'edge') return null; // a wall edit is data; its wall shows (or doesn't) in the shell
    if (this.anims.has(r.group)) return null; // never anything around something spawning in
    if (e.kind === 'room' || e.kind === 'building') { // the room's floor outline glows (once its spawn is over)
      if ([...this.anims.values()].some(a => a.dir === 'in')) return null;
      const rooms = e.kind === 'room' ? [e] : Object.values(this.view?.entities || {}).filter(x => x.kind === 'room' && x.building === e.id);
      // ROOMS FOLLOW THE HOUSE SELECTION LOOK (Harry 2026-10-05): the same treatment a selected or hovered thing gets
      // (harry-v1: corner brackets top and bottom when selected, the footprint outline on hover), drawn by the tuner's
      // shared selection module around the room's VOLUME: its floor rectangle out to the walls' outer faces, wall high
      const vol = this.volumeItem(rooms), shared = vol && this.sharedSignal(vol, w);
      if (shared) { shared.userData.volume = vol; shared.addEventListener('removed', () => vol.group.parent?.remove(vol.group)); return shared; }
      vol?.group.parent?.remove(vol.group);
      const g = new THREE.Group(); // (no shared selection module loaded: the old floor outline)
      // drawn just inside the walls and just above the floor boards: on the room's own edge it sat inside the wall
      // pieces and under the planks, so depth testing hid nearly all of it
      for (const rm of rooms) {
        const c = rm.recipe, k = this.roomGlowAt(rm), [x0, z0, x1, z1] = [c.x * CELL + k.inset, c.z * CELL + k.inset, (c.x + c.w) * CELL - k.inset, (c.z + c.d) * CELL - k.inset];
        const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], col = w.kind === 'hov' ? '#ffffff' : w.color || '#e0b04a';
        g.add(footLine(pts, k.y, col, w.kind));
        if (w.kind === 'sel') g.add(footLine(pts, k.y, col, w.kind, { width: 14, alpha: 0.28 })); // the soft glow around the line
      }
      this.layers.deco.add(g); return g;
    }
    if (style === 'footprint' || !r.visual) { // the floor of the box: the footprint outline on the ground, under the thing
      const pw = e.kind === 'token' && r.visual?.userData.base ? r.visual.userData.base.userData.radius * 2 : 3.6; // a figure pawn: its base
      const [wd, , dp] = e.kind === 'token' ? [pw, 0, pw] : e.dims || [2, 2, 2], cs = Math.cos(e.rot || 0), sn = Math.sin(e.rot || 0);
      const pts = [[-wd / 2, -dp / 2], [wd / 2, -dp / 2], [wd / 2, dp / 2], [-wd / 2, dp / 2]].map(([a, b]) => [e.x + a * cs + b * sn, e.z - a * sn + b * cs]);
      const g = footLine(pts, (e.kind === 'object' ? e.y || 0 : 0) + 0.05, w.kind === 'hid' ? HIDDEN_COLOR : w.kind === 'hov' || w.kind === 'pend' ? '#ffffff' : w.color, w.kind);
      this.layers.deco.add(g); return g;
    }
    return this.sharedSignal(r, w); // (no fallback: the old one was the glowing hull, cut 2026-10-11)
  }
  // a room's (or a building's) volume as something the shared selection module can draw round: a bare root at its
  // centre and a size (the module measures a thing with no meshes by its `dims`)
  volumeItem(rooms) {
    if (!rooms.length) return null;
    const x0 = Math.min(...rooms.map(r => r.recipe.x)) * CELL, x1 = Math.max(...rooms.map(r => r.recipe.x + r.recipe.w)) * CELL, z0 = Math.min(...rooms.map(r => r.recipe.z)) * CELL, z1 = Math.max(...rooms.map(r => r.recipe.z + r.recipe.d)) * CELL;
    const y0 = Math.min(...rooms.map(r => HT.roomY(r.recipe))), y1 = Math.max(...rooms.map(r => HT.roomY(r.recipe))); // a room: at its own height; a building: from its lowest floor to its highest wall top
    const group = new THREE.Group(); group.userData.halo = true; group.position.set((x0 + x1) / 2, y0, (z0 + z1) / 2); this.layers.deco.add(group);
    // a room that is not a rectangle: its true outline too (root frame), so the look follows the shape (selection.js `outline`)
    const outline = rooms.length === 1 && rooms[0].recipe.outline ? FP.polyFeet(rooms[0].recipe).map(([x, z]) => [x - (x0 + x1) / 2, z - (z0 + z1) / 2]) : null;
    return { group, visual: group, y: y0, dims: [x1 - x0 + 2 * OUTSET, WALL_H + (y1 - y0), z1 - z0 + 2 * OUTSET], ...(outline && { outline, outset: OUTSET }), roomIds: rooms.map(r => r.id), home: [(x0 + x1) / 2, (z0 + z1) / 2] }; // visual: the bare root (no meshes), so the module measures `dims`
  }
  // another seat's selection (presence): the shared selection module, a second instance with the REMOTE look: the
  // selected style's corner brackets at ~40% in that seat's colour, still (no breathing), no ghosting. Rooms: their floor
  // outline, thin and faint.
  remoteSignal(w) {
    if (w.id.startsWith('wall:')) { const s = [...this.shell.values()].find(s => s.group.userData.edgeKey === w.id.slice(5)); return s ? this.remoteOn({ group: s.group, visual: s.visual }, w) : null; }
    const r = this.recs.get(w.id); if (!r) return null;
    const e = r.entity;
    if (e.kind === 'room' || e.kind === 'building') {
      const rooms = e.kind === 'room' ? [e] : Object.values(this.view?.entities || {}).filter(x => x.kind === 'room' && x.building === e.id), g = new THREE.Group();
      for (const rm of rooms) { const c = rm.recipe, k = this.roomGlowAt(rm), [x0, z0, x1, z1] = [c.x * CELL + k.inset, c.z * CELL + k.inset, (c.x + c.w) * CELL - k.inset, (c.z + c.d) * CELL - k.inset]; g.add(footLine([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], k.y, w.color, 'rem', { width: 2, alpha: 0.4 })); }
      g.userData.halo = true; this.layers.deco.add(g); return g;
    }
    if (e.kind === 'edge' || this.anims.has(r.group) || !r.visual) return null;
    return this.remoteOn(r, w);
  }
  remoteOn(item, w) {
    if (!T.selection?.createSelection || !item.visual) return null;
    this.remoteFx ||= T.selection.createSelection({ scene: this.scene, params: REMOTE_LOOK });
    const h = new THREE.Group(); h.userData.halo = true;
    this.remoteFx.select(item, 'selected', w.color, { parent: h, tag: { kind: 'rem' } });
    h.addEventListener('removed', () => this.remoteFx.clear(item, 'selected'));
    this.layers.deco.add(h); return h;
  }
  // the house selection look (tuner Selection lab, "Use in game"): the tuner's shared renderer draws the signal under a
  // handle in the deco layer; dropping the handle (removeFromParent) clears it
  sharedSignal(item, w) {
    if (!T.selection?.createSelection || !item.visual) return null;
    const ridersOf = (it) => it.entity ? [...this.recs.values()].filter(x => x.entity.parent === it.entity.id) : [];
    const fx = this.selFx ||= T.selection.createSelection({ scene: this.scene, params: noGlow(T.house?.selection), ridersOf });
    const state = { sel: 'selected', hov: 'hover', hid: 'hidden', pend: 'pending' }[w.kind], h = new THREE.Group(); h.userData.halo = true;
    fx.select(item, state, w.color || null, { parent: h, tag: { kind: w.kind } });
    h.addEventListener('removed', () => fx.clear(item, state));
    this.layers.deco.add(h); return h;
  }
  setLineResolution(w, h) { for (const h0 of this.halos.values()) h0.obj.traverse(o => { if (o.material?.isLineMaterial) o.material.resolution.set(w, h); }); }

  // world-space bounds of what is drawn for an entity (rooms and buildings: their floor rectangles)
  boundsOf(r, part = null) { // part 'figure': a raised pawn without its base far below (where its ring opens)
    const e = r.entity, skip = part === 'figure' && r.footDrop ? r.visual?.userData.foot : null;
    if (e.kind === 'building') { const b = new THREE.Box3(); for (const x of Object.values(this.view?.entities || {})) if (x.kind === 'room' && x.building === e.id) { const c = x.recipe; const ry = HT.roomY(c); b.expandByPoint(new THREE.Vector3(c.x * CELL, ry, c.z * CELL)); b.expandByPoint(new THREE.Vector3((c.x + c.w) * CELL, ry + 0.3, (c.z + c.d) * CELL)); } return b.isEmpty() ? null : b; }
    if (e.kind === 'room') { const c = e.recipe, ry = HT.roomY(c); return new THREE.Box3(new THREE.Vector3(c.x * CELL, ry, c.z * CELL), new THREE.Vector3((c.x + c.w) * CELL, ry + 0.3, (c.z + c.d) * CELL)); }
    const b = new THREE.Box3();
    r.group.updateMatrixWorld(true);
    r.group.traverse(o => { if (o.isMesh && !(o instanceof THREE.Sprite) && !o.userData.halo) { if (skip) for (let q = o; q && q !== r.group; q = q.parent) if (q === skip) return; o.geometry.computeBoundingBox?.(); b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
    return b.isEmpty() ? null : b.expandByScalar(0.08);
  }
  shellBounds(key) { const s = this.shell.get(key); if (!s) return null; s.group.updateMatrixWorld(true); return new THREE.Box3().setFromObject(s.group); }

  // every distinct thing under a ray, nearest first (click again to cycle down the stack): pawns first, things, walls,
  // ceiling-hung things last, then the room whose floor it hits
  pickAll(raycaster) {
    this.settleMatrices(); // input can arrive before the next frame has placed what just changed
    this.cutPass();                 // (and before it has hidden what the cut just took away)
    // WHAT THE RAYCAST IS GIVEN. You can only click what you can see: not what the cut hides, not a sleeping room (it is
    // out of every view). And only what stands near the pointer's ray (nearRay): three.js otherwise walks into every
    // thing and wall of the area and tests each mesh on every pointer move (5 ms at 50 rooms). The near test comes
    // first, on the groups that are in the scene, so the other questions are asked of a few dozen things, not of all.
    const ray = raycaster.ray; let near, asked = 0;
    if (this.perf?.pickNear === false || this.local) {
      const things = [...this.recs.values()].filter(r => (r.entity.kind === 'token' || r.entity.kind === 'object') && !r.asleep && !r.group.userData.cutHidden && !this.cutHides(r.entity)).map(r => r.group);
      const walls = [...this.shell.values()].filter(s => !s.asleep && (s.group.userData.edgeKey || s.group.userData.roomPiece) && s.group.visible).map(s => s.group);
      near = [...things, ...walls]; asked = near.length;
    } else {
      near = [];
      for (const g of this.layers.things.children) { asked++; if (g.userData.cutHidden || !this.nearRay(ray, g)) continue; const r = this.recs.get(g.userData.entityId); if (r && r.group === g && (r.entity.kind === 'token' || r.entity.kind === 'object') && !this.cutHides(r.entity)) near.push(g); }
      for (const g of this.layers.shell.children) { asked++; if (!g.visible || !(g.userData.edgeKey || g.userData.roomPiece) || !this.nearRay(ray, g)) continue; near.push(g); }
    }
    const out = [], seen = new Set();
    const roof = this.roofAt(raycaster); // a roof that is showing is in the way of everything under it (you can only click what you can see)
    const stop = this.floorStop(raycaster.ray) + STOP_SLACK; // and so is a floor, a slab or the ground (floorStop)
    this.lastPick = { asked, tested: near.length }; // (tests, measurements)
    for (const h of raycaster.intersectObjects(near, true)) {
      if (h.distance > stop || (roof && h.distance > roof.distance + 0.02)) break;
      if (h.object instanceof THREE.Sprite || h.object.userData.noPick || h.object.userData.halo) continue;
      let o = h.object; while (o && !o.userData.entityId && !o.userData.edgeKey && !o.userData.roomPiece) o = o.parent;
      if (!o) continue;
      const k = o.userData.entityId || (o.userData.edgeKey ? 'wall:' + o.userData.edgeKey : 'piece:' + o.userData.roomPiece);
      if (seen.has(k)) continue; seen.add(k);
      out.push(o.userData.entityId ? { entity: this.recs.get(o.userData.entityId)?.entity, point: h.point } : o.userData.edgeKey ? { wall: o.userData.edgeKey, point: h.point } : { entity: this.view?.entities[o.userData.roomPiece], point: h.point, piece: true }); // a bracket or post under an overhang selects its room
    }
    const rank = (h) => h.entity?.kind === 'token' ? 0 : h.entity?.place === 'ceiling' ? 2 : isTile(h.entity) ? 3 : 1; // a floor tile: under everything on it
    out.sort((a, b) => rank(a) - rank(b));
    if (roof) { out.push({ roof: roof.id, point: roof.point }); return out; } // then the roof itself (selection 'roof:<room id>'); never the floor under it
    // the room under the ray: the highest room floor the ray meets (floorPoint)
    const fp = this.floorPoint(raycaster.ray, { max: this.floorMax ?? Infinity }), rm = fp?.room && this.view?.entities[fp.room];
    if (rm && !this.fogRule?.(rm)) out.push({ entity: rm, point: new THREE.Vector3(fp.x, fp.y, fp.z), floor: true });
    return out;
  }
  pick(raycaster) { return this.pickAll(raycaster)[0] || null; }
  // could this ray touch this thing or shell piece at all? A sphere round the group that holds whatever is drawn under
  // it with room to spare: half the footprint's diagonal, plus its height or 12 ft (a hanging thing's chain runs up to
  // the ceiling; a pawn's label), plus 2 ft, times its scale. Never says no to something the ray could hit.
  nearRay(ray, g) {
    let R = g.userData.pickR;
    if (R === undefined) { const id = g.userData.entityId, d = (id ? this.recs.get(id)?.entity.dims : this.shell.get(g.userData.shellKey)?.spec.dims) || [6, 8, 6]; R = g.userData.pickR = Math.hypot(d[0], d[2]) / 2 + Math.max(d[1], 12) + 2; }
    const p = g.position, o = ray.origin, d = ray.direction, k = Math.max(1, g.scale.x, g.scale.y, g.scale.z), r = R * k + (g.userData.footDrop || 0); // (a raised pawn's base is that far under it)
    const x = p.x - o.x, y = p.y + 4 - o.y, z = p.z - o.z, t = x * d.x + y * d.y + z * d.z; // (the sphere sits 4 ft up: things stand on their groups)
    if (t < -r) return false;
    const dx = x - d.x * t, dy = y - d.y * t, dz = z - d.z * t; return dx * dx + dy * dy + dz * dz <= r * r;
  }
  // WHERE A POINTER RAY MEETS THE FLOOR (storeys, Stage B): the one answer to "which point of the world is under the
  // pointer", used by every tool, drag and pick.
  //   level given   the plane at that height (the level being built on: there may be no floor there yet)
  //   otherwise     the highest room floor the ray meets (no higher than `max`: the cut, Stage C), else the ground at 0;
  //                 below-ground floors only where the ground is open over them (setGroundOpen)
  // -> { x, z, y, room } (room: the id of the room whose floor it is, or null)
  floorPoint(ray, { level = null, max = Infinity } = {}) {
    const o = ray.origin, d = ray.direction; if (Math.abs(d.y) < 1e-6) return null;
    const at = (y) => { const t = (y - o.y) / d.y; return t > 0 ? [o.x + d.x * t, o.z + d.z * t] : null; };
    const rooms = this.roomsNow();
    const roomOn = (y, p) => rooms.find(r => HT.roomY(r.recipe) === y && FP.contains(r.recipe, p[0], p[1]));
    if (level != null) { const p = at(level); return p ? { x: p[0], z: p[1], y: level, room: roomOn(level, p)?.id || null } : null; }
    // ROOFS ON (Stage F): a roof that is showing is the floor under the pointer. A flat roof or deck: the spot itself, at
    // deck height. A pitched roof: the nearest place to stand on it (its ridge points; sloped standing is not solved).
    if (this.roofsOn && this.roofRecs?.size) {
      const rc = new THREE.Raycaster(ray.origin, ray.direction); rc.camera = RAY_CAMERA;
      const hit = this.roofAt(rc), rec = hit && this.roofRecs.get(hit.id);
      if (rec && rec.base <= max + 1) {
        if (hit.flat) return { x: hit.point.x, z: hit.point.z, y: rec.base, room: null, roof: rec.id };
        let best = null; for (const sp of rec.roof.standable) { const d = Math.hypot(sp.x - hit.point.x, sp.z - hit.point.z); if (!best || d < best.d) best = { d, sp }; }
        return best ? { x: best.sp.x, z: best.sp.z, y: best.sp.y, room: null, roof: rec.id, snapped: true } : { x: hit.point.x, z: hit.point.z, y: hit.point.y, room: null, roof: rec.id };
      }
    }
    const ys = this.roomYsNow().filter(y => y <= max);
    for (const y of ys) { if (y < 0 && !this.groundOpen) break; if (y < 0 && max >= 0) { const g = at(0); if (g && roomOn(0, g)) break; } const p = at(y), r = p && roomOn(y, p); if (r) return { x: p[0], z: p[1], y, room: r.id }; }
    const p = at(0); return p ? { x: p[0], z: p[1], y: 0, room: null } : null; // (with the cut below ground this is still the ground plane: "open ground")
  }
  surfaceAt(raycaster, exclude = new Set(), floorY = 0) {
    this.settleMatrices();
    const things = [...this.recs.values()].filter(r => r.entity.kind === 'object' && !r.asleep && !exclude.has(r.entity.id) && !r.visual?.userData?.placeholder && !r.group.userData.cutHidden && !this.cutHides(r.entity)).map(r => r.group);
    const stop = this.floorStop(raycaster.ray) + STOP_SLACK; // a table top under a floor that is drawn is not under the pointer
    for (const h of raycaster.intersectObjects(things, true)) {
      if (h.distance > stop) break;
      if (h.object instanceof THREE.Sprite || !h.face || h.object.userData.halo) continue;
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      if (n.y < 0.6 || h.point.y < floorY + 0.4) continue;
      let o = h.object; while (o && !o.userData.entityId) o = o.parent;
      return { point: h.point, parent: o?.userData.entityId };
    }
    return null;
  }
  // the highest up-facing surface under (x, z) at or below height y (where a released, lifted thing would land)
  surfaceBelow(x, y, z, exclude = new Set(), floorY = 0) {
    this.settleMatrices();
    const rc = new THREE.Raycaster(new THREE.Vector3(x, y + 0.05, z), new THREE.Vector3(0, -1, 0), 0, Math.max(0.1, y - floorY + 0.1)); // down to the floor it is over
    // a thing's group can hold SPRITES (the GM's "Hidden" pill, a name label), and three's Sprite.raycast throws without
    // a camera on the raycaster. That threw out of every raise / lower release whenever ANY thing in the area was hidden
    // from players: the drag previewed, the release sent nothing, the thing fell back (Harry 2026-10-05: "raise is now
    // dropping everything instantly back to the floor"). Sprites are skipped below; this only keeps them from throwing.
    rc.camera = RAY_CAMERA;
    const things = [...this.recs.values()].filter(r => r.entity.kind === 'object' && !r.asleep && !isTile(r.entity) && !exclude.has(r.entity.id) && !r.visual?.userData?.placeholder && !this.cutHides(r.entity)).map(r => r.group);
    for (const h of rc.intersectObjects(things, true)) {
      if (h.object instanceof THREE.Sprite || !h.face || h.object.userData.halo) continue;
      if (h.face.normal.clone().transformDirection(h.object.matrixWorld).y < 0.6) continue;
      let o = h.object; while (o && !o.userData.entityId) o = o.parent;
      return { y: h.point.y, parent: o?.userData.entityId };
    }
    return null;
  }
  roomOfWall(key) { for (const s of this.shell.values()) if (s.group.userData.edgeKey === key) return s.roomId; return this.edges?.get(key)?.owner?.room || null; }
  edgeAt(key) { const e = this.edges?.get(key); if (!e) return null; const t = T.walls.edgeTransform(e); return { ...e, x: t.x, z: t.z }; }
  // the name-on-base parameters changed: every figure pawn is relettered
  refreshPawnNames() { for (const r of this.recs.values()) if (r.entity.kind === 'token' && r.visual?.userData.fig) { r.nameStamp = null; this.refreshTokenLabel(r); } }
  // seat colours changed (Settings ▸ Me): the rims of the figure pawns follow, in place
  refreshPawnColours() { for (const r of this.recs.values()) if (r.entity.kind === 'token' && r.visual?.userData.setColor) { const c = this.pawnColor(r.entity); if (r.visual.userData.base.userData.color !== c) r.visual.userData.setColor(c); } }
  // (tests) what a figure pawn is, measured in the world (client/figures.js measure)
  figureOf(id) { const r = this.recs.get(id); return r?.visual?.userData.fig ? this.assets.figures.measure(r.visual) : null; }
  pointsOf(ids) { const out = []; for (const r of this.pawns) if ((!ids || ids.includes(r.entity.id)) && !this.fogRule?.(r.entity)) out.push(r.drawn || [r.entity.x, r.entity.z]); return out; }
}

const GHOST_DROP = 0.3; // ft under a level's floor line that its ghost grid and lit squares lie (see ghostMaterial)
const PLATE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), CELL_PLATE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
// a shaped room's footprint as one flat geometry: a square per cell, about the middle of its bounding rectangle (feet)
function cellsGeometry(rc) {
  const pos = [], x0 = -rc.w * CELL / 2, z0 = -rc.d * CELL / 2;
  for (const [i, j] of FP.cellsOf(rc)) { const a = x0 + i * CELL, b = z0 + j * CELL, c = a + CELL, d = b + CELL; pos.push(a, 0, b, a, 0, d, c, 0, d, a, 0, b, c, 0, d, c, 0, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g;
}
// the box of a visual's own vertices, in the frame `M` puts its parent in (halos, sprites and lines left out). Its own
// local matrices are used, not the world's, so it is right before the scene has been drawn.
const IDENT = new THREE.Matrix4(), TILT_V = new THREE.Vector3();
// a thing's orientation under its turn, as [x, y, z, w], or null for upright: its `quat`; an old `tiltZ`; a library
// exhibit's tiltX (on its back) and tiltZ (on its side), which is Rx · Rz
const orientOf = (e) => e.tiltX ? qMul(qAxis([1, 0, 0], e.tiltX), qAxis([0, 0, 1], e.tiltZ || 0)) : quatOfEntity(e);
function vertexBox(root, M) {
  const box = new THREE.Box3(), p = new THREE.Vector3();
  const walk = (o, PM) => {
    if (o.userData?.halo || o.isSprite) return;
    if (o.matrixAutoUpdate) o.updateMatrix();
    const m = new THREE.Matrix4().multiplyMatrices(PM, o.matrix);
    const pos = o.isMesh && o.geometry?.attributes?.position;
    if (pos) { const step = Math.max(1, Math.floor(pos.count / 60000)); for (let i = 0; i < pos.count; i += step) box.expandByPoint(p.fromBufferAttribute(pos, i).applyMatrix4(m)); } // (a very dense mesh: a sample of it)
    for (const k of o.children) walk(k, m);
  };
  walk(root, M);
  return box.isEmpty() ? null : box;
}
const lowestY = (root, M) => vertexBox(root, M)?.min.y ?? 0;
const restOf = (e) => ({ x: e.x, y: e.y || 0, z: e.z, rot: e.rot || 0 });
// ---- storeys: pieces at a height ----
const vertKey = (c) => `${c.gx}:${c.gz}:${c.y || 0}`;
// the four wall keys that meet at a grid vertex, at the vertex's height
const keysAt = (v) => { const sfx = FP.levelSuffix(v.y || 0); return [`h:${v.gx - 1}:${v.gz}`, `h:${v.gx}:${v.gz}`, `v:${v.gx}:${v.gz - 1}`, `v:${v.gx}:${v.gz}`].map(k => k + sfx); };
const tileKey = (x, z, y) => `${cellKey(x, z)}@${Math.round((y || 0) / 5) * 5}`;
// a shell piece's visual: the tuner's own, or (the floor slab) the piece's own maker
const shellVisual = (look, s) => s.make ? Promise.resolve(s.make()) : look.makeVisual(s.spec, false);
// THE FLOOR SLAB of a room above the ground: one foot of timber under its floor, on exactly its cells. `rc` is the
// tuner room (cells x, z, w, d; y in feet). Drawn about the middle of the room's bounding rectangle.
export const SLAB_COLOR = '#5d4630', SLAB_STONE = '#77736b';
const slabSpec = (rc) => ({ uid: `${rc.id}:slab`, id: 'floor-slab', layer: 'floor', slab: true, roomId: rc.id, x: (rc.x + rc.w / 2) * CELL, y: rc.y - 1, z: (rc.z + rc.d / 2) * CELL, rot: 0, dims: [rc.w * CELL, 1, rc.d * CELL] });
let slabMat = null, slabStone = null;
function slabVisual(rc, holes = null) {
  slabMat ||= new THREE.MeshStandardMaterial({ color: SLAB_COLOR, roughness: 0.92 });
  slabStone ||= new THREE.MeshStandardMaterial({ color: SLAB_STONE, roughness: 0.95 }); // (2026-10-06) a stone building's floor is not held up by a timber band (Gemini, blind: "a continuous horizontal band ... made of wood ... a significant mismatch")
  const mat = HT.isStoneFamily(rc.family) ? slabStone : slabMat;
  const g = new THREE.Group(), open = holes?.size ? (i, j) => holes.has(`${rc.x + i}:${rc.z + j}`) : null;
  for (const [x0, z0, x1, z1] of HT.slabRects(rc.w, rc.d, rc.cells || null, open, CELL)) { // (the rim: height.js slabRects, shared with the Wall fit bench)
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.98, z1 - z0), mat); m.position.set((x0 + x1) / 2 - rc.w * CELL / 2, 0.49, (z0 + z1) / 2 - rc.d * CELL / 2); m.castShadow = true; m.receiveShadow = true; m.userData.noPick = true; g.add(m);
  }
  g.userData.slab = true;
  return g;
}
const roomOfVertex = (rooms, v) => (rooms.find(r => v.gx >= r.x && v.gx <= r.x + r.w && v.gz >= r.z && v.gz <= r.z + r.d) || rooms[0])?.id;
function visualKey(e) {
  if (e.kind === 'token') return `t|${e.color}|${e.hidden}|${e.fig || ''}|${e.size || 1}|${e.owner || ''}|${e.main ? 'main' : ''}`;
  if (e.kind === 'room' || e.kind === 'building') return `${e.kind}`;
  return `o|${e.sku}|${e.url}|${e.flat}|${e.rise || ''}|${(e.s || []).join(',')}|${(e.dims || []).join(',')}|${e.open}|${e.hidden}|${e.yaw}${isTile(e) ? `|${e.cat}|${cellKey(e.x, e.z)}` : ''}`; // a tile's look depends on its world cell
}
// fade (the tuner's setOpacity): per-animation material clones, released when the spawn ends
function setOpacity(g, a, op) {
  if (!a.fadeMats) { a.fadeMats = []; g.traverse(o => { if (o.isMesh && !o.userData.halo) { o.material = o.material.clone(); o.material.transparent = true; a.fadeMats.push(o.material); } }); }
  for (const m of a.fadeMats) { m.opacity = op; m.transparent = op < 1; m.depthWrite = op >= 1; }
}
// the GM's wall edits (edge entities, core/commands.js edge.set) applied to the shell the rooms imply
export function applyEdgeOverrides(edges, ents) {
  for (const o of Object.values(ents)) {
    if (o.kind !== 'edge') continue;
    const e = edges.get(o.key); if (!e) continue;
    if (o.as === 'wall' && (e.kind === 'door' || e.kind === 'window')) {
      if (e.kind === 'door') for (const k of (e.spanKeys || []).slice(1)) { const x = edges.get(k); if (x) { x.kind = 'wall'; delete x.spanOf; } }
      e.kind = 'wall'; delete e.span; delete e.spanKeys; delete e.doorType;
    }
    if (o.as === 'open') { e.open = true; if (e.kind === 'door') for (const k of (e.spanKeys || []).slice(1)) { const x = edges.get(k); if (x) x.open = true; } } // deleted (or moved away): no generated piece here
    if (o.doorType && e.kind === 'door') e.doorType = o.doorType;
    if (o.piece && (e.kind === 'wall' || e.kind === 'window')) e.swap = { piece: o.piece, family: o.family || e.family, pick: o.pick || 0 };
    e.override = o;
  }
}
// the pieces of one edge: the tuner's own, unless the edge was opened up or its piece swapped
export function edgeSpecsOf(look, e) {
  if (e.open) return [];
  const specs = look.edgeSpecs(e);
  if (e.swap && specs[0] && (e.kind === 'wall' || e.kind === 'window')) {
    const k = look.kitSpec(e.swap.piece, e.swap.family, undefined, {}, e.swap.pick);
    if (k) specs[0] = { ...specs[0], id: k.id, sku: k.sku, url: k.url, s: k.s, dims: k.dims };
  }
  return specs;
}
// THE PIECES THAT HOLD AN OVERHANG UP, from the vertical kit, by role. Each: the catalog ids to try in order (the first
// the library has wins; a later one is a stand-in), which sku of it, its box [w, h, d] in feet when the kit states one
// (a post's and a buttress's height is whatever the gap is), and how the measured mesh is turned (kitfit.js). A plain
// box stands in when the library has none of them.
//   bracket   timber walls: the jetty bracket, its wall leg against the wall, reaching out under the overhang
//   corbel    stone walls: the stone corbel, the same way
//   post      timber: the kit's straight post (the older post-timber mesh has arms and measures 5 ft across)
//   buttress  stone: the buttress, as a pier
export const SUPPORT_KIT = {
  bracket: { ids: ['jetty-bracket', 'corbel-stone'], skus: ['--s1'], box: [0.83, 3, 2.5], fit: { long: 'z', lowAt: '-z' } },
  corbel: { ids: ['corbel-stone', 'jetty-bracket'], skus: ['--s1'], box: [1.15, 2.4, 2.25], fit: { long: 'z', lowAt: '-z' } }, // (the 18-in corbel at 1.6x, its own proportions: at 18 in it does not read at table distance)
  post: { ids: ['post-timber', 'pillar-square'], skus: ['--plain', '--s1'], box: [1, 9, 1], fit: {}, own: true },
  buttress: { ids: ['pillar-square', 'buttress'], skus: ['--s1'], box: [2.5, 9, 2.5], fit: {}, own: true }, // a free-standing stone pier (the buttress piece is drawn to lean on a wall)
};
const SUPPORT_BOX = { bracket: [0.7, 2.4, 2.2], corbel: [0.9, 1.5, 1.5], post: [0.8, 9, 0.8], buttress: [1.4, 9, 1.4] };
export function resolveSupportKit(lib) {
  const out = {};
  for (const [k, K] of Object.entries(SUPPORT_KIT)) {
    let got = null;
    for (const id of K.ids) { const sku = KF.pickSku(lib, id, K.skus); if (sku) { const own = id === K.ids[0]; got = { id, sku: sku.sku, url: sku.url, standIn: !own, dims: own ? K.box : (KF.statedBox(lib, id, sku.sku) || K.box).map((v, i) => i === 1 && (k === 'post' || k === 'buttress') ? K.box[1] : v), fit: K.fit, bounds: sku.bounds || null, own: !!K.own }; if (!own && (k === 'post' || k === 'buttress')) got.dims = [1.67, K.box[1], 1.67]; break; } }
    out[k] = got || { id: `${k}-box`, box: true, standIn: true, dims: SUPPORT_BOX[k] };
  }
  return out;
}
// a post's or pier's box for a gap of h feet: its height is the gap, its width what the mesh's own proportions give
// (the library's measured bounds), so it is never squeezed or stretched; kept between 1 and 3.4 ft across
export function postDims(K, h) {
  const b = K.own && K.bounds; if (!b || !(b[1] > 0)) return [K.dims[0], h, K.dims[2]];
  const k = Math.min(h, 12) / b[1], w = Math.min(3.4, Math.max(1, (b[0] + b[2]) / 2 * k)); // (a gap over 12 ft: taller, no fatter)
  return [w, h, w];
}
// THE RAILING ROUND A STAIR'S HOLE: a 5-ft section, about 3 ft high, thin, open enough to see a pawn through.
//   timber  the inn's rough-timber railing (a post at each end, open braces between): timber and half-timber buildings
//   iron    a plain wrought-iron section (generated 2026-10-06, experiments/2026-10-06-railings): stone buildings
//           (dressed stone, fieldstone, a castle, a crypt)
//   stone   the mansion's own marble balustrade: the noble families
// Each at its mesh's own proportions (the timber one is squeezed in depth only: its mesh is 2.4 ft deep).
export const RAIL_KIT = {
  timber: { ids: ['railing-wood', 'fence-post-rail'], skus: ['--rough-timber'], box: [5, 3, 0.6] },
  iron: { ids: ['railing-iron', 'balustrade-stone', 'railing-wood'], skus: [''], box: [5, 3, 0.42] },
  stone: { ids: ['balustrade-stone', 'railing-iron', 'railing-wood'], skus: [''], box: [5, 2.7, 0.67] },
};
export const railKind = (family) => /noble|conservatory/.test(family || '') ? 'stone' : HT.isStoneFamily(family) ? 'iron' : 'timber';
export function resolveRailKit(lib) {
  const out = {};
  for (const [k, K] of Object.entries(RAIL_KIT)) {
    let got = null;
    for (const id of K.ids) { const sku = KF.pickSku(lib, id, K.skus); if (sku) { got = { id, sku: sku.sku, url: sku.url, standIn: id !== K.ids[0], dims: id === K.ids[0] ? K.box : [5, 3, 0.6], fit: { long: 'x' } }; break; } }
    out[k] = got || { id: 'railing-box', box: true, standIn: true, dims: [5, 3, 0.3] };
  }
  return out;
}
// how a generated piece that has become an object (moved, swapped) is fitted: by what it was (its key's first letter)
const GEN_FIT = { p: {}, j: { long: 'z', lowAt: '-z' }, r: { long: 'x' } };
let supportMat = null;
// a support piece's visual at the wanted size: the kit's mesh turned by measurement and fitted to it, or the box
function supportVisual(assets, K, dims) {
  if (K.box) { supportMat ||= new THREE.MeshStandardMaterial({ color: '#5d4630', roughness: 0.9 }); const m = new THREE.Mesh(new THREE.BoxGeometry(dims[0], dims[1], dims[2]), supportMat); m.position.y = dims[1] / 2; m.castShadow = true; m.receiveShadow = true; const g = new THREE.Group(); g.add(m); return g; }
  return assets.template(K.url).then(scene => { const g = KF.fitPiece(THREE, scene.clone(true), dims, K.fit); g.userData.sku = K.sku; return g; });
}

// WHICH KIT PIECE DRAWS A PIECE OF ROOF TRIM, and how: { cat, sku, url, dims [w, h, d] ft, fit (kitfit.js), dy, yaw }, or
// null (no such piece in the library: the stand-in box stays). `p` is the planner's placement (roofs.js), `roof` its
// roof, heightAt(x, z) the roof surface.
//   chimney  by the roof's material (thatch: the low cottage stack; tile: brick; shingle, flat: stone; slate: the tall
//            mansion stack), but never stretched: if that stack is too short to clear the ridge from where the
//            fireplace is (or far too tall for a low deck), another is used, grown by a quarter at most, with the spare
//            length sunk in the roof
//   dormer   by material; its window faces down the slope (the kit's meshes all face +z: checked 2026-10-06, one blind
//            read per mesh); sunk until its front stands on the slope
//   parapet, corner pier, finial: the kit's stated box
const CHIMNEYS = { thatch: ['cottage', 'stone', 'mansion'], tile: ['brick', 'mansion'], slate: ['mansion'], shingle: ['stone', 'mansion'], flat: ['stone', 'mansion'] };
const DORMERS = { thatch: ['rough-timber'], tile: ['tile'], slate: ['slate'], shingle: ['shingle'], flat: ['dressed-stone'] };
export function roofPiece(lib, p, roof, heightAt = () => null) {
  const style = roof?.style || 'thatch';
  if (p.role === 'chimney') {
    const o = lib?.objects?.['chimney-stack']; if (!o) return null;
    const need = Math.max(2, p.dims[1] - 1.5); // how much must show: from the roof surface to the planned top
    const skus = (CHIMNEYS[style] || CHIMNEYS.flat).map(w => o.skus.find(k => k.url && k.bounds && k.sku.endsWith('--' + w))).filter(Boolean);
    const all = skus.length ? skus : o.skus.filter(k => k.url && k.bounds); if (!all.length) return null;
    const boxOf = (k) => KF.statedBox(lib, 'chimney-stack', k.sku) || [2.5, 7, 2.5];
    // tall enough to clear the planned top, and not so tall that only its pots would show above the roof (a mansion
    // stack on a low deck read as "a stove with a pipe"): this material's stacks first, then any, brick and stone first
    const fits = (k) => boxOf(k)[1] * 1.25 >= need + 0.75 && boxOf(k)[1] <= need + 4;
    const any = ['brick', 'stone', 'cottage', 'mansion'].map(w => o.skus.find(k => k.url && k.bounds && k.sku.endsWith('--' + w))).filter(Boolean);
    const sku = all.find(fits) || any.find(fits) || all.find(k => boxOf(k)[1] * 1.25 >= need + 0.75) || all.slice().sort((a, b) => boxOf(b)[1] - boxOf(a)[1])[0];
    const box = boxOf(sku), g = Math.min(1.25, Math.max(1, (need + 1) / box[1])), dims = box.map(v => +(v * g).toFixed(3));
    const wide = Math.abs(box[0] - box[2]) > 0.2; // the mansion stack: its long side runs with the ridge
    return { cat: 'chimney-stack', sku: sku.sku, url: sku.url, dims: wide ? [Math.max(dims[0], dims[2]), dims[1], Math.min(dims[0], dims[2])] : dims, fit: wide ? { long: 'x' } : {}, yaw: wide && p.axis === 'z' ? Math.PI / 2 : 0, dy: p.dims[1] - dims[1] };
  }
  if (p.role === 'dormer') {
    const sku = KF.pickSku(lib, 'roof-dormer', DORMERS[style] || []); if (!sku) return null;
    const dims = KF.statedBox(lib, 'roof-dormer', sku.sku) || p.dims, out = p.out || [0, 1];
    const front = heightAt(p.x + out[0] * (dims[2] / 2 - 0.05), p.z + out[1] * (dims[2] / 2 - 0.05)); // the slope under its front face
    return { cat: 'roof-dormer', sku: sku.sku, url: sku.url, dims, fit: {}, dy: front == null ? 0 : Math.min(0, front - 0.5 - p.y) };
  }
  const simple = { parapet: ['parapet-straight', { long: 'x' }, 0], corner: ['parapet-corner', {}, 0], finial: ['roof-finial', {}, -0.25] }[p.role];
  if (!simple) return null;
  const sku = KF.pickSku(lib, simple[0], ['--s1']); if (!sku) return null;
  return { cat: simple[0], sku: sku.sku, url: sku.url, dims: KF.statedBox(lib, simple[0], sku.sku) || p.dims, fit: simple[1], dy: simple[2] };
}
function ghostify(v) { v.traverse(o => { if (!o.isMesh) return; o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.42; o.material.depthWrite = false; }); }

// ---- the halo: an inflated back-face shell (world-space normal push), depth-tested, so only the rim beyond the
// silhouette shows and nothing in front of it (or the thing itself) lets it through
function footLine(pts, y, color, kind, { width = kind === 'sel' ? 4 : 2, alpha = 1 } = {}) {
  if (!Number.isFinite(y) || pts.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) { console.warn('footLine: not a finite outline', kind, JSON.stringify(pts), y); return new THREE.Group(); }
  const pos = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; pos.push(a[0], y, a[1], b[0], y, b[1]); }
  const mat = new LineMaterial({ color, linewidth: width, transparent: true, opacity: alpha, depthTest: true, depthWrite: false });
  mat.userData.foot = alpha; mat.resolution.set(innerWidth, innerHeight);
  const l = new LineSegments2(new LineSegmentsGeometry().setPositions(pos), mat);
  l.renderOrder = 3; l.userData.halo = true;
  return l;
}

function cursorMesh(s, text) {
  const g = new THREE.Group();
  const col = new THREE.Color(s.color || '#7fb0ff');
  if (s.ghost) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.16, 8, 28, Math.PI * 1.6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.4;
    g.add(ring);
  } else {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.0, 14), new THREE.MeshBasicMaterial({ color: col, transparent: true }));
    cone.rotation.x = Math.PI; cone.position.y = 1.0;
    g.add(cone);
  }
  const label = labelSprite(text, { accent: s.color, small: true });
  label.center.set(-0.08, 0.5);
  label.position.y = s.ghost ? 0.6 : 1.4;
  g.add(label);
  // the outline shown only while the cursor points into fog (World.dimCursor)
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.9, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; ring.renderOrder = 21; ring.userData.fogRing = ring.userData.noPick = true; ring.visible = false;
  g.add(ring);
  return g;
}

const MARK_SIZE = 0.052; // a pawn's indicator: a share of the view's height (about 1.5 times the name label's height)
// screen-constant text label (sprite without size attenuation), the UI typeface
const STAIR_NOTE = { open: 'No floor above yet', 'nothing-below': 'Nothing below', 'wall-below': 'A wall runs through it', foot: 'Blocked at the foot', 'wall-above': 'Comes up through a wall', 'no-exit': 'Blocked at the top' };
export function labelSprite(text, { sub = '', pill = null, accent = null, small = false } = {}) {
  const font = `600 ${small ? 24 : 27}px Inter, system-ui, sans-serif`, subFont = '500 20px Inter, system-ui, sans-serif';
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  ctx.font = font; let w = ctx.measureText(text).width;
  ctx.font = subFont; if (sub) w = Math.max(w, ctx.measureText(sub).width);
  ctx.font = '600 18px Inter, system-ui, sans-serif'; const pw = pill ? ctx.measureText(pill).width + 18 : 0;
  w = Math.ceil(w + 24 + (pill ? pw + 8 : 0)); const h = sub ? 62 : 38;
  c.width = w; c.height = h;
  ctx.fillStyle = 'rgba(18,20,24,0.88)'; rr(ctx, 0, 0, w, h, 9); ctx.fill();
  if (accent) { ctx.fillStyle = accent; ctx.fillRect(0, h - 4, w, 4); }
  ctx.fillStyle = '#f2efe8'; ctx.textBaseline = 'middle'; ctx.font = font; ctx.fillText(text, 12, sub ? 21 : h / 2 + 1);
  if (sub) { ctx.font = subFont; ctx.fillStyle = '#c9c3b6'; ctx.fillText(sub, 12, 45); }
  if (pill) { ctx.font = '600 18px Inter, system-ui, sans-serif'; ctx.fillStyle = HIDDEN_COLOR; rr(ctx, w - pw - 8, 8, pw, 22, 11); ctx.fill(); ctx.fillStyle = '#1a1033'; ctx.fillText(pill, w - pw + 1, 20); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, transparent: true }));
  sp.renderOrder = 40;
  const k = 0.00088;
  sp.scale.set(w * k, h * k, 1);
  return sp;
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

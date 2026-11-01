// CEILINGS, for first person (surfaces/fpv.js; docs/VERTICAL.md "Ceilings": "When first-person arrives, the underside of
// the floor slab gets a ceiling surface"). From above nobody needs one, so the map draws none: a room is open to the
// camera, and an upper floor is a slab seen from on top. Standing in a room you look up, and without a ceiling you see
// the sky through the cut, or through an upper room that fog of war has not drawn.
//   WHERE      every covered room near the eyes: one surface at the underside of its slab (core/height.js ceilingOf: its
//              top less the 1-ft slab; a tall room's own top), over the squares it stands on, less the squares a stair,
//              a hole or a pit opens in the floor above (you see up through those). A room open to the sky (a yard, a
//              room whose roof is off) and a hill get none.
//   WHAT       the library's own generated floors, turned face down: dark planks under a timber or stone building's floor,
//              cut rock in the rock families (dungeon, mine, crypt), the cave floor's rock over a cave. No new picture.
//   SEEN       only what this seat may know: a room the fog of war has not shown (world.fogRule) gets no ceiling, so a
//              ceiling never tells a player where a room is.
//   COST       the rooms within REACH ft of the eyes, built once and kept while they stay near and unchanged; dropped when
//              first person ends. Nothing here runs for the map view.
import * as THREE from 'three';
import * as HT from '../core/height.js';
import * as FP from '../core/footprint.js';
import * as CV from '../core/caves.js';
import { holesAt } from '../core/stairs.js';

export const CEILING = {
  reach: 90,        // ft from the eyes: a room whose nearest edge is within this gets its ceiling
  sink: 0.04,       // ft under the slab's underside (the slab and the band are drawn there: no fighting over the same depth)
  timber: 'floor-planks-dark', rock: 'floor-cut-rock', cave: 'floor-cave-rock',
  rockFamilies: /cut-rock|crypt|dungeon|mine|cave/,
  caveGrow: 1,      // squares a cave's ceiling runs past its own on every side (its rock is not on the grid)
  glow: 0.32,       // how much of its own picture a ceiling shows unlit (0: only the lamps and the hemisphere's ground colour)
};

export function ceilingCat(room) {
  const rc = room.recipe || {};
  if (CV.isCave(rc)) return CEILING.cave;
  return CEILING.rockFamilies.test(rc.wallFamily || rc.family || '') ? CEILING.rock : CEILING.timber;
}

export function createCeilings(world) {
  const group = new THREE.Group(); group.name = 'fpv-ceilings'; group.userData.noPick = true;
  const built = new Map(); // room id -> { key, holder }
  let added = false, lastE = null, lastAt = 0, lastEye = null;
  const look = () => world.assets?.look;
  function wanted(E, eye) {
    const out = new Map(), holeMemo = new Map(), holesOf = (y) => { let h = holeMemo.get(y); if (!h) holeMemo.set(y, h = holesAt(E, y)); return h; };
    for (const r of Object.values(E || {})) {
      if (r.kind !== 'room' || !r.recipe || HT.isTerrain(r.recipe)) continue;
      if (world.isOpenRoom(r)) continue;                 // a yard, a room whose roof is off: the sky
      if (world.fogRule?.(r)) continue;                  // not known to this seat: nothing drawn for it at all
      const rc = r.recipe, x0 = rc.x * 5, z0 = rc.z * 5, x1 = (rc.x + rc.w) * 5, z1 = (rc.z + rc.d) * 5;
      const dx = Math.max(x0 - eye.x, 0, eye.x - x1), dz = Math.max(z0 - eye.z, 0, eye.z - z1);
      if (Math.hypot(dx, dz) > CEILING.reach) continue;
      const y = HT.ceilingOf(E, r) - CEILING.sink, top = HT.roomTop(E, r), holes = [...holesOf(top)].filter(k => { const [gx, gz] = k.split(':').map(Number); return FP.hasCell(rc, gx, gz); }).sort().join(',');
      const cat = ceilingCat(r);
      out.set(r.id, { room: r, y, top, cat, key: `${rc.x}:${rc.z}:${rc.w}:${rc.d}:${rc.y || 0}:${rc.tall || 1}:${rc.outline ? JSON.stringify(rc.outline) : ''}:${cat}:${holes}` });
    }
    return out;
  }
  async function build(id, w, E) {
    const L = look(); if (!L) return null;
    const rc = w.room.recipe, open = holesAt(E, w.top);
    // a CAVE's rock is no straight wall on the grid: its ceiling runs one square past its own squares on every side, so
    // it meets the rock (and covers the ground's opening along the lip) instead of stopping short of it (Gemini r3: "the
    // flat cave ceiling slab does not ... seal against the rock walls")
    const grow = CV.isCave(rc) ? CEILING.caveGrow : 0;
    let cells = FP.cellsOf(rc);
    if (grow) { const set = new Set(); for (const [i, j] of cells) for (let a = -grow; a <= grow; a++) for (let b = -grow; b <= grow; b++) set.add(`${i + a + grow}:${j + b + grow}`); cells = [...set].map(k => k.split(':').map(Number)); }
    const r = { id: `${id}:ceil`, x: rc.x - grow, z: rc.z - grow, w: rc.w + 2 * grow, d: rc.d + 2 * grow, wallSeed: `${rc.wallSeed || id}:ceil`, floor: w.cat, type: '', family: '', cells };
    let specs = []; try { specs = L.floorSpecs(r).specs.filter(sp => sp.uid?.includes(':f')); } catch { return null; }
    specs = specs.filter(sp => !open.has(`${Math.floor(sp.x / 5)}:${Math.floor(sp.z / 5)}`));
    const holder = new THREE.Group(); holder.position.y = w.y; holder.userData.ceiling = id;
    const vs = await Promise.all(specs.map(sp => L.makeVisual(sp, false).catch(() => null)));
    vs.forEach((v, i) => {
      if (!v) return; const sp = specs[i], h = new THREE.Group(), flip = new THREE.Group();
      h.position.set(sp.x, 0, sp.z); h.rotation.y = sp.rot || 0;
      flip.rotation.x = Math.PI; // face down: the floor's picture seen from under it (the visual keeps its own pose: a flat is a plane laid down)
      flip.add(v); h.add(flip);
      v.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.userData.noCast = true; o.userData.ceiling = true; o.material = ceilingMaterial(o.material); } });
      holder.add(h);
    });
    return holder;
  }
  const C = {
    group,
    // keep the ceilings round the eyes current (cheap when nothing moved: a distance and an identity check)
    sync(eye, now = performance.now()) {
      const E = world.view?.entities; if (!E || !eye) return;
      if (!added) { world.scene.add(group); added = true; }
      const moved = !lastEye || Math.hypot(eye.x - lastEye.x, eye.z - lastEye.z) > 5;
      if (E === lastE && !moved && now - lastAt < 1500) return;
      lastE = E; lastAt = now; if (moved) lastEye = { x: eye.x, z: eye.z };
      const want = wanted(E, eye);
      for (const [id, b] of built) if (want.get(id)?.key !== b.key) { b.holder?.parent?.remove(b.holder); dispose(b.holder); built.delete(id); }
      for (const [id, w] of want) {
        if (built.has(id)) continue;
        const b = { key: w.key, holder: null }; built.set(id, b);
        build(id, w, E).then(h => { if (built.get(id) !== b || !h) { dispose(h); return; } b.holder = h; group.add(h); world.wake?.('ceiling'); }).catch(() => { });
      }
    },
    clear() { for (const b of built.values()) { b.holder?.parent?.remove(b.holder); dispose(b.holder); } built.clear(); group.parent?.remove(group); added = false; lastE = null; lastEye = null; },
    info() { const out = {}; for (const [id, b] of built) { let n = 0; b.holder?.traverse(o => { if (o.isMesh) n++; }); out[id] = { y: b.holder ? +b.holder.position.y.toFixed(2) : null, cells: n }; } return out; },
    pending() { let n = 0; for (const b of built.values()) if (!b.holder) n++; return n; },
  };
  return C;
}
// A CEILING'S MATERIAL: the floor's own, one-sided (seen from above, from outside or a hill, a ceiling is not there: the
// floors are drawn two-sided, and a ceiling's back showed as a black slab on every building, Gemini r1), and lit a little
// by its own picture (a surface facing down gets only the hemisphere's dark ground colour: a "pitch-black void").
// One copy per floor material, shared by every ceiling cell that wears it.
const _ceilMats = new WeakMap();
function ceilingMaterial(m) {
  if (!m || Array.isArray(m)) return m;
  let c = _ceilMats.get(m);
  if (!c) { c = m.clone(); c.side = THREE.FrontSide; if (c.emissive && c.map) { c.emissiveMap = c.map; c.emissive.setScalar(CEILING.glow); } c.userData = { ...(m.userData || {}), ceiling: true }; _ceilMats.set(m, c); }
  return c;
}
// (the flats share their geometry and textures with the floors: only the groups go)
function dispose(h) { if (!h) return; h.clear(); }

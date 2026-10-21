// The Spawn Tuner, imported LIVE: the game renders with the tuner's own look code, never a copy (Harry 2026-10-02:
// "bring back (and KEEP UP TO DATE) the aesthetic quality from the tuner"). A tuner deploy writes version.json; we import
// exactly that stamped build, so a tuner deploy updates the game. The relay solves with the same deployed files
// (tw-relay restarts on tuner deploy), so both ends share one engine version.
//   js/look.js     orientation, asset + LOD loading, visuals, wall pieces, floor tiling (shared with the tuner's main.js)
//   js/anim.js     the spawn choreography      js/settle.js  gravity onto tabletops     js/fx/  lighting + fire
//   js/solver*.js, js/walls.js   the room engine (also run by the relay)               js/camera.js  grab-the-world camera
// The house look (spawn animation, lighting, fire, selection, atmosphere, figure scale) is data chosen in the tuner ("Use in game" → GET /tuner/house).
import { engineVersionOf, TUNER_FILES, TUNER_DATA, applyRatings, ratingsDigest } from '../core/roomgen.js';
import { stableStringify } from '../core/hash.js';

export const T = {}; // filled by loadTuner(); every module reads T.<module> at run time

export async function loadTuner(base, api) {
  let v = null;
  try { v = (await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null))?.v || null; } catch { }
  const q = v ? `?v=${v}` : '';
  const files = ['solver.js', 'solver2.js', 'walls.js', 'anim.js', 'settle.js', 'look.js', 'camera.js', 'fx/index.js', 'fx/fire.js', 'hinge.js', 'fx/selection.js', 'buildings.js'];
  const mods = await Promise.all(files.map(f => import(`${base}js/${f}${q}`)));
  [T.solver, T.solver2, T.walls, T.anim, T.settle, T.look, T.camera, T.fx, T.fire, T.hinge, T.selection, T.buildings] = mods; // buildings.js: whole-building plans (docs/BUILDINGS.md)
  const get = (u) => fetch(u).then(r => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.text(); });
  // the delivered copies of the assets (the tuner's js/delivery.js; absent on an old tuner: the plain addresses are used)
  const delivered = T.look.loadDelivery ? T.look.loadDelivery(`${base}assets/delivery.json${q}`) : null;
  const texts = await Promise.all([...TUNER_FILES.map(f => get(`${base}js/${f}${q}`)), ...TUNER_DATA.map(f => get(`${base}data/${f}${q}`))]);
  const [lib, types, orientFile] = texts.slice(TUNER_FILES.length).map(t => JSON.parse(t));
  T.delivery = await delivered;
  // Harry's orientation corrections and the house look are the tuner's own server records
  const json = (u) => fetch(u, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  // hinge records (Alignment Bench, 2026-10-04): {closed mesh id: {mode: hinge|swap, ...}}; assets.specOf uses them
  const [orientRecs, house, hingeRecs, ratings] = await Promise.all([api ? json(`${api}/tuner/orient`) : null, api ? json(`${api}/tuner/house`) : null, api ? json(`${api}/tuner/hinges`) : null, api ? json(`${api}/ratings`) : null]);
  // Harry's latest ratings apply live (a 2-star or masking SKU drops out on the next load, no tuner rebuild needed)
  T.ratingsApplied = applyRatings(lib, ratings);
  const orientServer = T.look.orientFromServer(lib, orientRecs || {});
  Object.assign(T, { v: v || 'dev', base, api, lib, types, orient: { ...orientFile, ...orientServer }, hinges: T.hinge.hingesFromServer(hingeRecs || {}),
    version: engineVersionOf([...texts, stableStringify(orientServer), ratingsDigest(lib)]),
    house: {
      anim: house?.anim || T.anim.defaultPreset(),        // Harry's harry-v2 unless the tuner chose another
      lighting: house?.lighting || null, fire: house?.fire || null, // null: createFx falls back to the night builtins
      selection: house?.selection || null,                 // null: the selection module's default (the glow halo)
      atmos: house?.atmos || null,                         // null: clear air (the tuner's Atmosphere panel, "Use in game")
      fogwar: house?.fogwar || null,                       // null: built-in defaults (the tuner's Fog of war look panel, "Use in game")
      wallfit: house?.wallfit || null,                     // null: no wall fit corrections (the tuner's Wall fit bench, "Use in game": per-sku scale/offset/yaw for kit pieces)
      figures: house?.figures || null,                     // null: figures.js FIGURE_SCALE (the tuner's Figure scale bench, "Use in game")
      dice: house?.dice || null,
      ring: house?.ring || null,                           // null: the built-in "Ellipse · one curve" (Ring Lab's "Use as default"; surfaces/ring.js)                           // null: the dice built-ins (the tuner's Dice panel, "Use in game"; surfaces/dice.js)
      labels: house?.labels || null,                       // null: today's room and building labels exactly (Label lab ?labellab=1, "Use as default"; labels/look.js)
      from: house?.at || {},
    } });
  return T;
}

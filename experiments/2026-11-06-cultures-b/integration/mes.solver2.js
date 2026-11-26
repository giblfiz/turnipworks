// ======================= Mexica (MES, 2026-11-06): six rooms on the culture-room skeleton (cb:solver2) =======================
// Late Postclassic Tenochtitlan and Tlatelolco, c. 1400-1520. From above: the shrine by its altar of offerings between two
// great braziers, the chacmool before it; the ballcourt by its two long sloping benches with the stone rings at mid-court;
// the house by the lord's backed seat on reed mats and the three-stone hearth; the market by vendors' spreads in ROWS; the
// chinampa by long raised maize beds on the water. Offerings are maize, flowers and copal: no gore (ROSTERS.md).
const MES_LIGHT = [['torch-bracket-rough'], ['mes-brazier', 'brazier-tripod']]; // (pine-resin torches, ocotl, on the wall)
cbRegister('mes-shrine', { name: 'temple summit shrine', focal: 'the altar of offerings between two great braziers', density: 4, lights: MES_LIGHT, keyRe: /^mes-altar$/, annex: ['mes-water-jar'],
  steps: [
    { op: 'far', ids: ['mes-altar', 'altar-stone'], as: 'altar', focal: true, label: 'altar', why: 'the altar with its offerings of maize, flowers and copal, on the wall facing the door' },
    { op: 'flank', ids: ['mes-brazier'], to: 'altar', off: 0.8, n: 2, layer: 'light', why: 'a great brazier each side of the altar' },
    { op: 'front', ids: ['mes-chacmool'], to: 'altar', dist: 5.2, min: 16, as: 'chac', why: 'the chacmool before the altar, its dish for offerings' },
    { op: 'near', ids: ['mes-chacmool'], to: 'altar', unless: 'chac', r0: 3, r1: 5.5, why: 'the chacmool beside the altar (a small shrine: the way to the altar stays clear)' },
    { op: 'rug', ids: ['rug-rush-mat'], to: 'altar', dist: 2.6, why: 'reed mats before the altar' },
    { op: 'corner', ids: ['mes-water-jar'], which: 'door', layer: 'furnish', why: 'a water jar by the door' },
  ] });
cbRegister('mes-ballcourt', { name: 'ballcourt', focal: 'the stone rings in the middle of the two long sloping benches', outdoor: true, edges: ['none'], keyRe: /^mes-court-ring$/,
  steps: [
    { op: 'osides', ids: ['mes-court-wall'], mid: 'mes-court-ring', as: 'ring', focal: true, path: false, why: 'the sloping stone benches down both long sides, a ring set high in the middle of each' },
  ] });
cbRegister('mes-house', { name: "noble's house", focal: "the lord's backed seat on its mats, facing the door", density: 5, lights: MES_LIGHT, keyRe: /^mes-icpalli$/, annex: ['mes-reed-chest', 'mes-water-jar'],
  steps: [
    { op: 'far', ids: ['mes-icpalli'], as: 'seat', focal: true, label: 'icpalli', why: "the lord's backed reed seat, on the wall facing the door" },
    { op: 'rug', ids: ['rug-rush-mat'], to: 'seat', dist: 2.4, why: 'a reed mat before the seat' },
    { op: 'near', ids: ['mes-reed-chest'], to: 'seat', n: 2, r0: 2.6, r1: 5, why: 'reed chests beside the seat' },
    { op: 'corner', ids: ['mes-comal-hearth'], which: 'door', as: 'hearth', layer: 'furnish', why: 'the cooking place by the door: three stones and the griddle' },
    { op: 'near', ids: ['mes-metate'], to: 'hearth', n: 1, why: 'the grinding stone by the hearth' },
    { op: 'near', ids: ['mes-water-jar'], to: 'hearth', n: 1, why: 'the water jar by the hearth' },
    { op: 'wall', ids: ['mes-reed-chest', 'storage-jar'], sides: 'lat', n: 2, why: 'stores against the walls' },
    { op: 'wall', ids: ['mes-brazier'], sides: 'lat', n: 1, layer: 'light', why: 'a brazier against the wall' },
    { op: 'rug', ids: ['rug-rush-mat'], why: 'reed mats on the floor' },
  ] });
cbRegister('mes-market', { name: 'market plaza', focal: "vendors' spreads in rows", outdoor: true, edges: ['none'], keyRe: /^mes-spread-/,
  steps: [
    { op: 'orows', ids: ['mes-spread-maize', 'mes-spread-chilies', 'mes-spread-pottery', 'mes-spread-cloth'], mix: true, gap: 3.5, as: 'row', focal: true, path: false, why: "vendors' spreads in rows, an aisle between every two" },
    { op: 'oedge', ids: ['mes-awning'], n: 2, why: 'a shade awning over a stall' },
    { op: 'oedge', ids: ['mes-water-jar'], n: 2, why: 'water jars' },
  ] });
cbRegister('mes-chinampa', { name: 'chinampa garden', focal: 'long raised maize beds on the water, in rows', outdoor: true, edges: ['none'], keyRe: /^mes-chinampa-bed$/,
  steps: [
    { op: 'orows', ids: ['mes-chinampa-bed'], gap: 3, as: 'bed', focal: true, path: false, why: 'the raised beds in rows, canals between them' },
    { op: 'oedge', ids: ['mes-ahuejote'], n: 3, why: 'willows at the edges of the beds' },
    { op: 'oedge', ids: ['mes-canoe'], far: true, why: 'the canoe, tied at the edge' },
  ] });
cbRegister('mes-scribe', { name: "scribe's room", focal: 'the codex unfolded on its mat in the middle of the floor', density: 5, lights: MES_LIGHT, keyRe: /^mes-codex-mat$/, annex: ['mes-reed-chest'],
  steps: [
    { op: 'centre', ids: ['mes-codex-mat'], as: 'codex', focal: true, label: 'codex', why: 'the codex, unfolded on a reed mat in the middle of the floor where the painter kneels' },
    { op: 'near', ids: ['mes-paint-pots'], to: 'codex', n: 1, why: 'the paint pots beside the codex' },
    { op: 'wall', ids: ['mes-reed-chest'], sides: 'nodoor', n: 2, why: 'chests of finished books against the walls' },
    { op: 'far', ids: ['mes-icpalli'], why: "the master's seat on the far wall" },
    { op: 'corner', ids: ['mes-water-jar'], which: 'door', layer: 'furnish', why: 'water for the paints' },
  ] });

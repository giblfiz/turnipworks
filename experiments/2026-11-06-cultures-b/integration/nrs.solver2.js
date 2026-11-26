// ======================= Norse steading (NRS, 2026-11-06): six rooms on the culture-room skeleton (cb:solver2) =======================
// Viking-Age Scandinavia, c. 800-1050. From above a Norse hall is named by its LONG HEARTH down the middle with platforms
// along both long walls; the mead hall by the high seat in the middle of a long wall facing the hearth; the boathouse by the
// boat; the yard by the runestone. Lit by the hearth and horn lanterns (no windows: walls.js NO_WINDOWS).
const NRS_LAMP = [['lantern-wall-horn', 'torch-bracket-rough'], ['torch-stand', 'lantern-hand']];
const NRS_FLOOR = ['rug-sheepskin', 'rug-fur', 'rug-hay-scatter'];
cbRegister('nrs-longhouse', { name: 'longhouse', focal: 'the long hearth down the middle', density: 5, lights: NRS_LAMP, keyRe: /^nrs-long-hearth$/, annex: ['nrs-sleeping-platform', 'barrel'],
  steps: [
    { op: 'centre', ids: ['nrs-long-hearth', 'hearth-central'], along: true, as: 'hearth', focal: true, label: 'long hearth', why: 'the long hearth: down the middle of the hall, the smoke going up to the roof' },
    { op: 'posts', ids: ['nrs-roof-post'], every: 10, inset: 4.9, why: 'the roof posts: two rows down the hall, between the hearth and the platforms' },
    { op: 'wall', ids: ['nrs-sleeping-platform'], sides: 'long', per: 11, layer: 'anchor', rule: 'platform', why: 'the raised platforms along both long walls: seats by day, beds by night' },
    { op: 'near', ids: ['cauldron-crane', 'cauldron', 'pot-iron-large'], to: 'hearth', n: 1, why: 'the cauldron on its crane at the end of the hearth' },
    { op: 'wall', ids: ['nrs-loom'], sides: 'lat', n: 1, rule: 'loom', why: 'the loom by the end wall, where the door lets in the light' },
    { op: 'near', ids: ['nrs-wool-baskets'], to: 'hearth', n: 1, r0: 3.5, r1: 7, why: 'wool and spindles by the fire' },
    { op: 'wall', ids: ['nrs-sea-chest', 'chest-plain'], sides: 'long', n: 1, rule: 'chest', why: 'a chest at the end of a platform' },
    { op: 'corner', ids: ['nrs-quern'], which: 'far', layer: 'furnish', why: 'the hand quern in the far corner' },
    { op: 'pile', ids: ['barrel', 'sack', 'grain-sack-open', 'barley-sack', 'crate'], n: 3, why: 'the stores, heaped at the far end' },
    { op: 'near', ids: ['stool-three-leg', 'log-seat'], to: 'hearth', n: 2, r0: 2.4, r1: 4, why: 'a stool by the fire' },
    { op: 'rug', ids: NRS_FLOOR, why: 'a fleece on the floor' },
    { op: 'hang', ids: ['nrs-shield-row'], sides: 'long', n: 1, height: 5.4, min: 30, why: 'the household\'s shields on the wall' },
    { op: 'lights', ids: NRS_LAMP[0], sides: 'long', every: 20, n: 1, max: 2 },
  ] });
cbRegister('nrs-meadhall', { name: 'mead hall', focal: "the high seat in the middle of a long wall, facing the hearth", density: 5, lights: NRS_LAMP, keyRe: /^nrs-high-seat$/, annex: ['bench-long', 'table-trestle'],
  steps: [
    { op: 'centre', ids: ['nrs-long-hearth', 'hearth-central'], along: true, n: (ctx) => Math.max(ctx.W, ctx.D) >= 44 ? 2 : 1, as: 'hearth', label: 'long hearth', why: 'the long hearth down the middle of the hall' },
    { op: 'longwall', ids: ['nrs-high-seat', 'throne', 'chair-armed'], as: 'seat', focal: true, label: 'high seat', why: "the chieftain's high seat: in the middle of a long wall, between its carved pillars, facing the hearth" },
    { op: 'posts', ids: ['nrs-roof-post'], every: 11, inset: 6, minWidth: 18, why: 'the roof posts, two rows down the hall' },
    { op: 'wall', ids: ['table-trestle'], sides: 'long', per: 13, rule: 'feast-table', why: 'the long trestle tables down both sides of the hall' },
    { op: 'wall', ids: ['bench-long'], sides: 'long', per: 9, rule: 'bench', why: 'benches along the walls' },
    { op: 'wall', ids: ['nrs-sleeping-platform'], sides: 'short', n: 1, rule: 'platform', why: 'a platform at the end of the hall' },
    { op: 'hang', ids: ['nrs-shield-row'], sides: 'long', n: 4, height: 5.4, why: 'the warband\'s round shields, hung in rows on the walls' },
    { op: 'wall', ids: ['nrs-spear-rack', 'weapon-rack'], sides: 'door', n: 1, why: 'spears and axes racked by the door' },
    { op: 'near', ids: ['barrel', 'nrs-sea-chest'], to: 'seat', n: 2, r0: 2.6, r1: 5, why: "the chieftain's chest and the ale cask beside the high seat" },
    { op: 'rug', ids: ['rug-bearskin', 'rug-fur', 'rug-wolfskin'], to: 'seat', dist: 3, why: "a bearskin before the high seat" },
    { op: 'near', ids: ['horn-drinking-banded', 'tankard-horn', 'tankard-wooden'], to: 'seat', n: 1, r0: 1.2, r1: 3, layer: 'dress', why: "the chieftain's drinking horn" },
    { op: 'lights', ids: NRS_LAMP[0], sides: 'long', every: 18, n: 2, max: 4 },
  ] });
cbRegister('nrs-smithy', { name: 'Norse smithy', focal: 'the low stone forge on the wall facing the door', density: 6, lights: NRS_LAMP, keyRe: /^nrs-forge$/, annex: ['woodpile', 'barrel'],
  steps: [
    { op: 'far', ids: ['nrs-forge', 'forge'], as: 'forge', focal: true, label: 'forge', why: 'the forge: a low stone hearth with its bellows-shield, on the wall facing the door' },
    { op: 'front', ids: ['anvil'], to: 'forge', dist: 3.4, as: 'anvil', why: 'the anvil on its stump, a step from the forge' },
    { op: 'near', ids: ['quench-trough', 'bucket'], to: 'anvil', n: 1, r0: 1.6, r1: 3.4, why: 'the quench tub within reach of the anvil' },
    { op: 'wall', ids: ['nrs-spear-rack'], sides: 'lat', n: 1, why: 'finished spears and axes racked against the wall' },
    { op: 'wall', ids: ['grindstone', 'table-work'], sides: 'lat', n: 1, why: 'the grindstone against the other wall' },
    { op: 'corner', ids: ['smith-coal-heap', 'coal-bin', 'woodpile'], which: 'door', layer: 'furnish', why: 'charcoal heaped by the door' },
    { op: 'wall', ids: ['nrs-sea-chest', 'chest-ironbound'], sides: 'far', n: 1, why: "the smith's tool chest" },
    { op: 'hang', ids: ['tool-rack-smith'], sides: 'lat', n: 1, why: 'tongs and hammers on the wall' },
    { op: 'lights', ids: NRS_LAMP[0], sides: 'lat', every: 20, n: 1, max: 1 },
  ] });
cbRegister('nrs-boathouse', { name: 'boathouse', focal: 'the boat on its stocks down the middle', density: 4, lights: NRS_LAMP, keyRe: /^nrs-boat$/, annex: ['nrs-oar-rack', 'barrel'],
  steps: [
    { op: 'centre', ids: ['nrs-boat'], along: true, as: 'boat', focal: true, label: 'boat', why: 'the boat, laid up on its stocks down the middle of the naust' },
    { op: 'wall', ids: ['nrs-oar-rack'], sides: 'long', n: 1, why: 'the oars racked against the long wall' },
    { op: 'wall', ids: ['nrs-sail-trestle'], sides: 'long', n: 1, why: 'the furled sail on its trestles along the wall' },
    { op: 'wall', ids: ['nrs-sea-chest'], sides: 'long', per: 14, why: "the crew's sea chests" },
    { op: 'pile', ids: ['barrel', 'rope-coil', 'crate', 'barrel'], n: 3, why: 'tar barrels and rope in the corner' },
    { op: 'hang', ids: ['nrs-shield-row'], sides: 'long', n: 1, height: 5.4, min: 24, why: 'the crew\'s shields on the wall' },
    { op: 'near', ids: ['rope-coil', 'bucket'], to: 'boat', n: 1, r0: 2.5, r1: 5, layer: 'dress', why: 'a coil of rope by the boat' },
    { op: 'lights', ids: NRS_LAMP[0], sides: 'long', every: 22, n: 1, max: 2 },
  ] });
cbRegister('nrs-weaving', { name: 'weaving hut', focal: 'the loom against the wall facing the door', density: 6, lights: NRS_LAMP, keyRe: /^nrs-loom$/, annex: ['nrs-wool-baskets'],
  steps: [
    { op: 'far', ids: ['nrs-loom', 'spinning-wheel'], as: 'loom', focal: true, label: 'loom', why: 'the warp-weighted loom against the wall facing the door' },
    { op: 'near', ids: ['nrs-wool-baskets'], to: 'loom', n: 1, r0: 1.5, r1: 3.5, why: 'wool and spindles beside the loom' },
    { op: 'near', ids: ['stool-three-leg'], to: 'loom', n: 1, dist: 2.2, r0: 0, r1: 1.6, why: "the weaver's stool before the loom" },
    { op: 'centre', ids: ['hearth-central', 'firepit-stone-round'], off: [0, 0], as: 'fire', why: 'a small fire in the floor' },
    { op: 'wall', ids: ['nrs-sea-chest', 'chest-plain'], sides: 'lat', n: 1, why: 'the cloth chest' },
    { op: 'corner', ids: ['nrs-quern'], which: 'door', layer: 'furnish', why: 'the quern by the door' },
    { op: 'pile', ids: ['sack', 'barrel'], n: 2, why: 'stores in the corner' },
  ] });
cbRegister('nrs-yard', { name: 'steading yard', focal: 'the runestone', outdoor: true, edges: ['wattle fence', 'post-and-rail fence', 'none'], keyRe: /^nrs-runestone$/,
  steps: [
    { op: 'ocentre', ids: ['nrs-runestone'], as: 'stone', focal: true, label: 'runestone', why: 'the runestone, standing in the middle of the yard' },
    { op: 'oedge', ids: ['well'], far: true, why: 'the well' },
    { op: 'oedge', ids: ['nrs-fish-rack'], far: true, why: 'stockfish drying on the rack' },
    { op: 'oedge', ids: ['woodpile'], built: true, why: 'firewood stacked against the house wall' },
    { op: 'oedge', ids: ['hay-bale', 'hay-pile'], n: 2, far: true, why: 'hay for the beasts' },
    { op: 'oedge', ids: ['cart-hand', 'wheelbarrow'], near: 'gate', why: 'the handcart inside the gate' },
    { op: 'oedge', ids: ['chopping-block', 'log-seat'], built: true, why: 'the chopping block' },
    { op: 'oplants', ids: ['bush', 'tree-birch'], n: 2, why: 'birch and scrub at the edge' },
  ] });

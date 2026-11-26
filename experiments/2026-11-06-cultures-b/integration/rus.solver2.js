// ======================= Medieval Rus' (RUS, 2026-11-06): six rooms on the culture-room skeleton (cb:solver2) =======================
// Novgorod, Vladimir-Suzdal and Muscovy, 11th-16th c. From above: the izba by its great white stove in the corner by the
// door with the table in the corner diagonal from it, under the icon shelf (the "beautiful corner"); the church by the
// iconostasis across its east end with the altar behind it and NO pews; the banya by its heater of heaped stones and the
// steaming shelf; the yard by the well-sweep inside a palisade. The market stall is a trade of the shop skeleton.
const RUS_LAMP = [['candle-box-sconce', 'lantern-wall-horn'], ['candlestick-floor', 'lantern-hand']];
YARD_EDGES['palisade'] = ['rus-palisade', 'post-timber', 'rus-yard-gate'];
cbRegister('rus-izba', { name: 'izba', focal: 'the great stove in the corner by the door', density: 5.5, lights: RUS_LAMP, keyRe: /^rus-stove$/, annex: ['bench-long', 'rus-chest'],
  steps: [
    { op: 'corner', ids: ['rus-stove'], which: 'door', as: 'stove', focal: true, label: 'stove', why: 'the great stove in the corner by the door: the family sleeps on it' },
    { op: 'wall', ids: ['rus-stove'], sides: 'lat', n: 1, unless: 'stove', as: 'stove', focal: true, layer: 'anchor', why: 'the great stove against a side wall (no corner free)' },
    { op: 'centre', ids: ['rus-stove'], unless: 'stove', as: 'stove', focal: true, why: 'the great stove standing free (a small izba with doors on every wall)' },
    { op: 'corner', ids: ['table-square', 'table-trestle'], which: 'far', as: 'table', layer: 'furnish', why: 'the table in the "beautiful corner", diagonal from the stove' },
    { op: 'hang', ids: ['rus-icon-corner'], sides: 'far', n: 1, height: 5.6, why: 'the icon shelf over the table, in the beautiful corner' },
    { op: 'wall', ids: ['bench-long'], sides: 'far', n: 1, rule: 'bench', why: 'the bench built along the wall at the table' },
    { op: 'wall', ids: ['bench-long'], sides: 'lat', n: 2, rule: 'bench', why: 'benches along the walls' },
    { op: 'on', ids: ['bread-loaf', 'bowl-wood-small', 'jug-clay', 'porridge-bowl'], to: 'table', n: 3, why: 'bread and bowls on the table' },
    { op: 'wall', ids: ['rus-chest'], sides: 'lat', n: 1, why: 'the family chest by the bench' },
    { op: 'near', ids: ['stool-three-leg'], to: 'table', n: 1, why: 'a stool at the table' },
    { op: 'near', ids: ['firewood-basket', 'kindling-bundle', 'bucket'], to: 'stove', n: 1, layer: 'dress', why: 'firewood by the stove' },
    { op: 'rug', ids: ['rug-rush-mat', 'rug-braided-round'], why: 'a woven mat on the floor' },
  ] });
cbRegister('rus-terem', { name: 'terem hall', focal: 'the tiled stove in the corner and the long table', density: 5, lights: RUS_LAMP, keyRe: /^rus-tiled-stove$/, annex: ['bench-long', 'rus-chest'],
  steps: [
    { op: 'corner', ids: ['rus-tiled-stove'], which: 'door', as: 'stove', focal: true, label: 'tiled stove', why: 'the tiled stove in the corner by the door' },
    { op: 'centre', ids: ['table-trestle', 'table-feast'], along: true, as: 'table', why: 'the long table down the middle of the chamber' },
    { op: 'on', ids: ['table-runner-embroidered', 'goblet', 'bread-loaf', 'jug-clay', 'bowl-wood-small'], to: 'table', n: 4, why: 'an embroidered cloth, bread and cups on the table' },
    { op: 'near', ids: ['rus-high-chair'], to: 'table', n: 1, why: "the boyar's high chair at the head of the table" },
    { op: 'wall', ids: ['bench-long'], sides: 'long', per: 9, rule: 'bench', why: 'benches along the walls, under carpets' },
    { op: 'wall', ids: ['rus-chest'], sides: 'short', n: 2, why: 'chests against the end walls' },
    { op: 'hang', ids: ['rus-icon-corner'], sides: 'far', n: 1, height: 5.6, why: 'the icon shelf in the corner' },
    { op: 'rug', ids: ['rug-striped-woven', 'rug-runner'], to: 'table', dist: 0, why: 'a carpet under the table' },
    { op: 'lights', ids: ['sconce-candle-single', 'candle-box-sconce'], sides: 'long', every: 14, n: 1, max: 3 },
  ] });
cbRegister('rus-banya', { name: 'banya', focal: 'the heater of heaped stones in the far corner', density: 6, lights: RUS_LAMP, keyRe: /^rus-banya-heater$/, annex: ['bench-long'],
  steps: [
    { op: 'corner', ids: ['rus-banya-heater'], which: 'far', as: 'heater', focal: true, label: 'heater', why: 'the heater: stones heaped over the firebox, in the far corner' },
    { op: 'wall', ids: ['rus-banya-shelf'], sides: 'lat', n: 1, layer: 'anchor', why: 'the steaming shelf along the wall' },
    { op: 'near', ids: ['washtub', 'bathtub-wood', 'bucket'], to: 'heater', n: 1, why: 'the water tub by the heater' },
    { op: 'near', ids: ['bucket'], to: 'heater', n: 1, layer: 'dress', why: 'a bucket and ladle by the heater' },
    { op: 'hang', ids: ['rus-besom-rack'], sides: 'nodoor', n: 1, height: 4.6, why: 'birch besoms on their pegs' },
    { op: 'wall', ids: ['bench-long'], sides: 'door', n: 1, why: 'a bench by the door, for cooling off' },
  ] });
cbRegister('rus-church', { name: 'wooden church', focal: 'the iconostasis across the east end, the altar behind it', shortEnd: true, density: 3, lights: RUS_LAMP, keyRe: /^rus-iconostasis$/, annex: [],
  steps: [
    { op: 'screen', ids: ['rus-iconostasis'], depth: 6.2, as: 'screen', focal: true, label: 'iconostasis', why: 'the iconostasis: a screen of icons across the east end, the sanctuary behind it' },
    { op: 'behind', ids: ['altar-stone'], depth: 2.6, as: 'altar', why: 'the altar, in the sanctuary behind the screen' },
    { op: 'on', ids: ['rite-altar-cloth', 'candlestick'], to: 'altar', n: 1, why: 'the altar cloth' },
    { op: 'near', ids: ['rus-lectern'], to: 'screen', dist: 5, r0: 0.8, r1: 3, why: 'the lectern with its icon, before the screen' },
    { op: 'flank', ids: ['candlestand-pricket', 'candle-tree'], to: 'screen', off: 1.2, n: 2, layer: 'light', why: 'candle stands before the screen, one each side' },
    { op: 'wall', ids: ['candlestand-pricket'], sides: 'lat', n: 2, layer: 'light', why: 'candle stands by the side walls' },
    { op: 'wall', ids: ['bench-long'], sides: 'door', n: 1, why: 'a bench by the door for the old and the sick (no pews: the faithful stand)' },
  ] });
cbRegister('rus-yard', { name: 'stockade yard', focal: 'the well-sweep in the middle of the yard', outdoor: true, edges: ['palisade', 'wattle fence'], keyRe: /^rus-well-sweep$/,
  steps: [
    { op: 'ocentre', ids: ['rus-well-sweep', 'well'], as: 'well', focal: true, label: 'well-sweep', why: 'the well-sweep in the middle of the yard' },
    { op: 'oedge', ids: ['rus-sledge'], far: true, why: 'the sledge, laid up at the far side' },
    { op: 'oedge', ids: ['woodpile'], built: true, n: 2, why: 'firewood stacked against the house wall' },
    { op: 'oedge', ids: ['hay-pile', 'hay-bale'], far: true, n: 2, why: 'hay for the winter' },
    { op: 'oedge', ids: ['cart-hand', 'wheelbarrow'], near: 'gate', why: 'the cart inside the gate' },
    { op: 'oedge', ids: ['chopping-block', 'log-seat'], built: true, why: 'the chopping block' },
    { op: 'oplants', ids: ['tree-birch', 'bush'], n: 2, why: 'birches in the corner of the yard' },
  ] });
// the market row stall: a trade of the shop skeleton (the plank counter, the shelf of honey, wax and birch-bark boxes, the furs)
mktRegisterTrade('rus-market', { tier: 'rus', name: 'market row stall', hero: [['rus-chest', 'wall']], floor: ['barrel', 'sack', 'rus-chest'], by: ['barrel'], sign: null });
MKT_TIERS.splice(MKT_TIERS.indexOf('rus'), 1); // (not dealt into the European market square)

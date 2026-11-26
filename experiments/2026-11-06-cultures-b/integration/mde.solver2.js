// ======================= Middle East / Mamluk (MDE, 2026-11-06): six rooms on the culture-room skeleton (cb:solver2) =======================
// The Mamluk Near East, Cairo and Damascus, 13th-16th c. From above: the reception hall (qa'a) by its floor fountain in the
// low middle between raised platforms (iwans) at both ends; the hammam by its fountain ringed with marble benches and wall
// basins; the caravanserai by its court ringed with arched storerooms; the coffee house by its brazier and divans. The souk
// shop is a trade of the market's shop skeleton. No mosque and no sacred text as decoration (ROSTERS.md).
const MDE_LAMP = [['lantern-pierced-tin', 'lantern-wall-brass'], ['oil-lamp', 'lantern-hand']];
// the caravanserai's edge: an arcade of storeroom bays, square piers at its corners and ends, the great gate where the plot has one
YARD_EDGES['khan arcade'] = ['mde-arcade', 'mde-arcade-pier', 'mde-khan-gate'];
cbRegister('mde-courtyard', { name: 'caravanserai courtyard', focal: 'the fountain in the middle of the court', outdoor: true, edges: ['khan arcade', 'none'], keyRe: /^(mde-floor-fountain|well)$/,
  steps: [
    { op: 'ocentre', ids: ['mde-floor-fountain', 'well'], as: 'fount', focal: true, label: 'fountain', why: 'the fountain in the middle of the court, where the caravan waters' },
    { op: 'oedge', ids: ['water-trough'], to: 'fount', why: 'the water trough for the beasts' },
    { op: 'oedge', ids: ['mde-bales'], n: 3, why: 'bales of cloth, unloaded by the storerooms' },
    { op: 'oedge', ids: ['mde-saddle-packs'], n: 2, why: 'saddlebags and pack saddles where the caravan unloaded' },
    { op: 'oedge', ids: ['mde-water-jar'], n: 2, why: 'water jars in the shade' },
    { op: 'oedge', ids: ['hitching-post'], near: 'gate', why: 'a tethering post by the gate' },
    { op: 'near', ids: ['mde-bales', 'mde-saddle-packs'], to: 'fount', n: 1, r0: 5, r1: 9, why: 'a load set down in the court' },
  ] });
cbRegister('mde-hammam', { name: 'hammam', focal: 'the fountain in the middle, ringed by marble benches and wall basins', density: 4.5, lights: MDE_LAMP, keyRe: /^mde-floor-fountain$/, annex: ['mde-hammam-bench', 'mde-wall-basin'],
  steps: [
    { op: 'centre', ids: ['mde-floor-fountain', 'basin-stone'], as: 'fount', focal: true, label: 'fountain', why: 'the marble fountain in the middle of the bath' },
    { op: 'wall', ids: ['mde-hammam-bench'], sides: 'nodoor', per: 14, layer: 'anchor', rule: 'bench', why: 'the marble benches round the walls' },
    { op: 'wall', ids: ['mde-wall-basin'], sides: 'all', per: 9, rule: 'basin', why: 'the wall basins, a bowl on each' },
    { op: 'corner', ids: ['mde-water-jar'], which: 'door', layer: 'furnish', why: 'the cool-water jar by the door' },
    { op: 'near', ids: ['bucket', 'bowl-wood-large'], to: 'fount', n: 1, layer: 'dress', why: 'a bathing bowl by the fountain' },
    { op: 'hang', ids: MDE_LAMP[0], sides: 'all', n: 2, height: 6.5, layer: 'light', why: 'pierced lanterns on the walls' },
  ] });
cbRegister('mde-audience', { name: "reception hall (qa'a)", focal: 'the raised platforms at both ends of the hall, the fountain in the low middle', density: 4.5, lights: MDE_LAMP, keyRe: /^mde-dais$/, annex: ['mde-divan'],
  steps: [
    { op: 'ends', ids: ['mde-dais', 'dais'], as: 'iwan', focal: true, label: 'iwan platform', why: 'a raised carpeted platform (iwan) at each end of the hall: where the host and his guests sit' },
    { op: 'centre', ids: ['mde-floor-fountain'], as: 'fount', why: 'the fountain in the low middle of the hall (the durqa\'a)' },
    { op: 'wall', ids: ['mde-divan'], sides: 'long', per: 7, rule: 'divan', why: 'divans along the long walls' },
    { op: 'front', ids: ['mde-tray-table'], to: 'iwan', dist: 4.6, why: 'a tray table before the platform' },
    { op: 'wall', ids: ['mde-inlaid-chest'], sides: 'door', n: 1, why: 'an inlaid chest by the door' },
    { op: 'corner', ids: ['mde-water-jar'], which: 'door', layer: 'furnish', why: 'the water jar by the door' },
    { op: 'rug', ids: ['rug-grand', 'rug-striped-woven'], to: 'fount', dist: 0, why: 'a carpet by the fountain' },
    { op: 'hang', ids: MDE_LAMP[0], sides: 'long', n: 2, height: 6.5, layer: 'light', why: 'pierced lanterns on the walls' },
  ] });
cbRegister('mde-coffee', { name: 'coffee house', focal: "the coffee-maker's brazier in the far corner", density: 5, lights: MDE_LAMP, keyRe: /^mde-coffee-brazier$/, annex: ['mde-divan'],
  steps: [
    { op: 'corner', ids: ['mde-coffee-brazier'], which: 'far', as: 'brazier', focal: true, label: 'coffee brazier', why: "the coffee-maker's brazier in the far corner, the pots on the coals" },
    { op: 'wall', ids: ['mde-divan'], sides: 'nodoor', per: 7, rule: 'divan', why: 'divans along the walls' },
    { op: 'near', ids: ['mde-tray-table'], n: 3, r0: 2, r1: 7, why: 'low tray tables before the divans' },
    { op: 'near', ids: ['pillows-cushions'], n: 2, r0: 1, r1: 6, layer: 'dress', why: 'cushions on the floor' },
    { op: 'near', ids: ['mde-water-jar'], to: 'brazier', n: 1, why: 'the water jar by the brazier' },
    { op: 'rug', ids: ['rug-striped-woven', 'rug-grand'], why: 'a carpet' },
    { op: 'hang', ids: MDE_LAMP[0], sides: 'all', n: 2, height: 6.5, layer: 'light', why: 'pierced lanterns on the walls' },
  ] });
cbRegister('mde-garden', { name: 'courtyard garden', focal: 'the fountain in the middle, citrus round it', outdoor: true, edges: ['none'], keyRe: /^(mde-floor-fountain|fountain-courtyard)$/,
  steps: [
    { op: 'ocentre', ids: ['mde-floor-fountain', 'fountain-courtyard'], as: 'fount', focal: true, label: 'fountain', why: 'the fountain in the middle of the courtyard' },
    { op: 'near', ids: ['citrus-tree-tub'], to: 'fount', n: 4, r0: 5, r1: 8, why: 'citrus trees in tubs round the fountain' },
    { op: 'oedge', ids: ['flowerbed'], n: 2, built: true, why: 'flower beds against the house walls' },
    { op: 'oedge', ids: ['bench-stone', 'bench-garden'], n: 2, why: 'a stone bench in the shade' },
    { op: 'oedge', ids: ['trellis-vine'], built: true, why: 'a vine on a trellis up the wall' },
    { op: 'oedge', ids: ['mde-water-jar'], why: 'a water jar' },
    { op: 'oplants', ids: ['palm-potted', 'planter-stone'], n: 2, why: 'potted palms at the edge' },
  ] });
// the souk shop: a trade of the market's shop skeleton (counter, niche shelves of brass, spice sacks, the carpet stack)
mktRegisterTrade('mde-souk', { tier: 'mde', name: 'souk shop', hero: [['mde-inlaid-chest', 'wall']], floor: ['mde-bales', 'mde-water-jar', 'mde-saddle-packs'], by: ['mde-bales'], sign: null, rug: ['rug-striped-woven', 'rug-grand'] });
MKT_TIERS.splice(MKT_TIERS.indexOf('mde'), 1); // (the market square deals its stalls from MKT_TIERS: the souk is not in the European market)

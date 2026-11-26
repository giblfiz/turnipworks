// ---- China (culture pack, 2026-11-06): six rooms on the culture skeleton. Signatures from the table camera: the long
// console table with upturned ends on the hall's back wall, the square table between two tall-backed armchairs under a
// silk lantern (the hall); square tables in rows with long benches and the copper kettles on the counter (the tea house);
// the long painting table among cased books (the study); the seated Buddha on its lotus throne, the offering table and
// the great censer on one axis, kneeling cushions in rows, bell and drum by the door (the temple hall); awnings and
// steamer stacks (the market street); the Taihu rock, the lotus vats either side of the hall's door, the screen wall by
// the gate (the courtyard). The Buddha is placed ONLY on the temple hall's axis.
const CHN_LANTERN = ['chn-palace-lantern'];
caRegister({
  'chn-hall': { culture: 'china', name: 'courtyard-house hall', label: 'console table', focal: ['chn-console-table'], proof: '^chn-console-table$', density: 3.5,
    before: [{ id: 'chn-square-table', s: 2.4, why: 'the square table before the console table, on the axis' }, { id: 'chn-armchair', s: 2.4, dx: 3.1, rot: 'door', why: 'an armchair either side of the square table, facing the door' }],
    hung: [{ ids: ['chn-scroll-landscape'], sides: 'far', n: 1, height: 4.2, why: 'the landscape scroll over the console table' }],
    walls: ['chn-standing-screen', 'chn-porcelain-jars', 'chn-penjing'], ceiling: [{ id: 'chn-palace-lantern', s: 5.5, why: 'a silk lantern over the tables' }], lamps: { wall: [], floor: [] } },
  'chn-teahouse': { culture: 'china', name: 'tea house', label: 'tea counter', focal: ['chn-tea-counter'], proof: '^chn-tea-counter$', density: 3.5,
    ranks: { id: 'chn-square-table', seats: 'chn-bench', gap: 4.2, aisle: 4.5, s0: 3.5, s1: 3, per: 5, why: 'tea tables in rows, a bench either side' },
    doorWall: ['chn-steamer-stack'], walls: ['chn-porcelain-jars'], ceiling: [{ id: 'chn-palace-lantern', s: 5 }, { id: 'chn-palace-lantern', s: 13 }], lamps: { wall: [], floor: [] } },
  'chn-study': { culture: 'china', name: 'scholar\'s study', label: 'bookcase', focal: ['chn-bookcase'], proof: '^(chn-painting-table|chn-bookcase)$', density: 3.5,
    island: { id: 'chn-painting-table', seats: 'chn-armchair', n: 1, at: 'centre', why: 'the painting table in the middle of the study, the scholar\'s chair at it' },
    walls: ['chn-bookcase', 'chn-standing-screen'], corners: ['chn-penjing'], hung: [{ ids: ['chn-scroll-landscape'], sides: 'lat', n: 1, height: 4.0 }], lamps: { wall: [], floor: [] }, ceiling: [{ id: 'chn-palace-lantern', s: 6 }] },
  'chn-temple': { culture: 'china', name: 'temple hall', label: 'Buddha', focal: ['chn-buddha-altar'], shortEnd: true, proof: '^chn-buddha-altar$', density: 2,
    before: [{ id: 'chn-offering-table', s: 0.8, why: 'the offering table before the Buddha' }, { id: 'chn-incense-burner', s: 6.5, why: 'the great censer on the axis, between the cushions and the door' }],
    ranks: { id: 'chn-kneeling-cushion', gap: 1.6, aisle: 4.5, s0: 3.2, s1: 7, per: 3, why: 'kneeling cushions in rows facing the Buddha' },
    doorWall: ['chn-temple-bell', 'chn-temple-drum'], ceiling: [{ id: 'chn-palace-lantern', s: 2.5, dx: 4 }], lamps: { wall: [], floor: [] } },
  'chn-market': { culture: 'china', outdoor: true, name: 'market street', label: 'market stall', proof: '^chn-market-stall$', density: 2.2, pathW: 5,
    line: { ids: ['chn-lantern-pole'], every: 14, off: 4.5 }, beside: [{ id: 'chn-market-stall', at: 0.5, off: 2.5, must: true, reach: 5, why: 'a stall beside the way, its awning over the street' }], edgeItems: ['chn-market-stall', 'chn-steamer-stack', 'chn-market-stall', 'chn-carrying-pole', 'chn-porcelain-jars'], per: 70,
    lamp: ['chn-lantern-pole'] },
  'chn-courtyard': { culture: 'china', outdoor: true, name: 'courtyard', label: 'Taihu rock', focal: ['chn-taihu-rock'], proof: '^(chn-taihu-rock|chn-screen-wall)$', density: 1.6,
    beside: [{ id: 'chn-screen-wall', at: 0.12, off: 2.5, must: true, face: 'gate', why: 'the screen wall inside the gate, keeping the court from the street\'s eye' }, { id: 'chn-goldfish-vat', at: 'door', pair: true, off: 1.4, must: true, why: 'a lotus vat either side of the hall\'s door' },
      { id: 'chn-stone-table', at: 0.5, off: 4, why: 'the stone table and its drum stools' }],
    corners: ['chn-pomegranate-tub'], per: 300 }, // (pomegranates in the corners only: an edge one beside a corner one read as doubled)
});

// ---- Japan (culture pack, 2026-11-06): seven rooms, each one line of the culture skeleton (caRoom / caYard above).
// Read from the table camera by ONE signature each (the mine's lesson): the tatami floor and the tokonoma alcove (a
// tatami room), the sunken kettle on four and a half mats (the tea house), an EMPTY polished floor under the kamidana
// (the dojo), the offering table, bell rope and offering box on one axis (the shrine hall), the torii and paired stone
// lanterns on the path (the shrine approach), the raised counting platform among straw-wrapped casks (the sake
// merchant), stepping stones to the stone basin under a maple (the tea garden). Sacred pieces are placed only here:
// the kamidana high and centred on the dojo's front wall, nothing beneath it but the clear floor; the shrine's pieces on
// the hall's axis; komainu as a pair by the hall's door on the approach, the purification basin beside the path before it.
const JPN_LAMP = ['jpn-andon'];
caRegister({
  'jpn-house': { culture: 'japan', name: 'tatami room', label: 'tokonoma', focal: ['jpn-tokonoma'], proof: '^jpn-tokonoma$', density: 2.2,
    before: [{ id: 'jpn-zabuton', s: 0.9, rot: 'door', why: 'the guest of honour\'s cushion, back to the tokonoma' }],
    island: { id: 'jpn-low-table', seats: 'jpn-zabuton', n: 4, at: 'centre' },
    walls: ['jpn-tansu', 'jpn-byobu', 'jpn-armour-chest'], corners: ['jpn-andon'], lamps: { wall: [], floor: JPN_LAMP } },
  'jpn-teahouse': { culture: 'japan', name: 'tea house', label: 'tokonoma', focal: ['jpn-tokonoma'], proof: '^(jpn-tokonoma|jpn-ro-kama)$', density: 2,
    before: [{ id: 'jpn-zabuton', s: 0.9, rot: 'door', why: 'the principal guest\'s place, by the tokonoma' }, { id: 'jpn-ro-kama', s: 3.0, dt: 2.2, why: 'the sunken hearth and its kettle, in the mats beside the way in' },
      { id: 'jpn-tea-utensils', s: 3.0, dt: 4.2, why: 'the tea things beside the hearth' }, { id: 'jpn-zabuton', s: 5.0, dt: 2.2, rot: 'focal', why: 'the host\'s place, across the hearth' }],
    walls: [], corners: ['jpn-andon'], lamps: { wall: [], floor: JPN_LAMP } },
  'jpn-dojo': { culture: 'japan', name: 'dojo', label: 'kamidana', focal: ['jpn-kamidana'], focalHung: true, proof: '^jpn-kamidana$', density: 0.5,
    clear: [0.72, 0.62], walls: ['jpn-bokken-rack', 'jpn-bokken-rack'], wallWhy: 'the practice weapons along the side wall',
    corners: ['jpn-taiko', 'jpn-armour-chest'], lamps: { wall: [], floor: JPN_LAMP } },
  'jpn-shrine': { culture: 'japan', name: 'shrine hall', label: 'offering table', focal: ['jpn-shinsen-altar'], shortEnd: true, proof: '^jpn-shinsen-altar$', density: 1.2,
    before: [{ id: 'jpn-saisen-bako', s: 3.6, rot: 'door', why: 'the offering box: where worshippers stand, under the bell' }],
    ceiling: [{ id: 'jpn-bell-rope', s: 2.4, why: 'the bell and its rope, over the offering box' }],
    walls: ['jpn-taiko'], lamps: { wall: [], floor: JPN_LAMP } },
  'jpn-shrine-court': { culture: 'japan', outdoor: true, name: 'shrine approach', label: 'torii', gatePiece: 'jpn-torii', proof: '^jpn-torii$', density: 1.6,
    line: { ids: ['jpn-toro'], every: 8, off: 3.4 },
    beside: [{ id: 'jpn-chozuya', at: 0.4, off: 3, must: true, why: 'the purification basin: wash before worship' }, { id: 'jpn-komainu', at: 'door', pair: true, off: 1.6, face: 'gate', must: true, why: 'the guardian lion-dogs, a pair by the hall\'s door' }],
    corners: ['jpn-pine'], edgeItems: ['jpn-pine'], per: 260 },
  'jpn-shop': { culture: 'japan', name: 'sake merchant\'s shop', label: 'counting platform', focal: ['jpn-shop-platform'], proof: '^jpn-shop-platform$', density: 3.5,
    walls: ['jpn-sake-casks', 'jpn-shop-shelves', 'jpn-sake-casks', 'jpn-tansu'], doorWall: ['jpn-sake-casks'],
    hung: [{ ids: ['jpn-sugidama'], sides: 'door', n: 1, height: 6.6, why: 'the cedar ball: the sake shop\'s sign, over its door' }], lamps: { wall: [], floor: JPN_LAMP } },
  'jpn-garden': { culture: 'japan', outdoor: true, name: 'tea garden', label: 'stone basin', proof: '^(jpn-tsukubai|jpn-toro)$', density: 1.4, pathW: 3, steps: 'decal-stepping-stones',
    beside: [{ id: 'jpn-tsukubai', at: 'door', off: 1.4, must: true, why: 'the stone basin: guests rinse their hands before tea' }, { id: 'jpn-toro', at: 0.68, off: 1.8, must: true, why: 'the lantern that lights the basin' }],
    corners: ['jpn-maple', 'jpn-pine'], edge: 'fence-bamboo', edgeItems: ['jpn-maple', 'jpn-pine'], per: 220 },
});

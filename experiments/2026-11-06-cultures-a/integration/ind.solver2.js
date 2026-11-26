// ---- India (culture pack, 2026-11-06): six rooms on the culture skeleton. Signatures from the table camera: the tulsi
// planter on its mandana floor painting in the open court, a charpai and a swing (the haveli courtyard); the canopied
// gaddi with bolsters on the axis, floor seating along the walls, brass lamp stands (the palace hall); the pillared hall
// with Nandi facing the curtained sanctum door (the Shiva temple); the merchant on his white mattress behind baskets
// of grain (the bazaar shop); the stepped tank (the stepwell); the clay chulha and the shelves of brass (the kitchen).
// Nandi, the sanctum door and the temple bell are placed ONLY by the temple hall, the tulsi only by the courtyard.
const IND_LAMP = ['ind-lamp-stand'];
caRegister({
  'ind-haveli': { culture: 'india', outdoor: true, name: 'haveli courtyard', label: 'tulsi planter', focal: ['ind-tulsi'], centreRug: 'decal-mandana', proof: '^ind-tulsi$', density: 1.8, round: 1.6,
    corners: ['ind-water-pots', 'ind-charpai'], edgeItems: ['ind-charpai', 'ind-jhula', 'ind-water-pots'], per: 120 },
  'ind-durbar': { culture: 'india', name: 'palace hall', label: 'gaddi throne', focal: ['ind-gaddi-throne'], shortEnd: true, proof: '^ind-gaddi-throne$', density: 2,
    flank: { ids: IND_LAMP, off: 0.6 }, rugs: [{ id: 'rug-ind-durrie', s: 5.5, turn: Math.PI / 2, why: 'the durrie before the throne' }],
    walls: ['ind-floor-seating', 'ind-floor-seating', 'ind-floor-seating'], wallWhy: 'floor seating for the court along the side wall', corners: IND_LAMP, lamps: { wall: [], floor: IND_LAMP } },
  'ind-mandapa': { culture: 'india', name: 'Shiva temple hall', label: 'sanctum doorway', focal: ['ind-sanctum-door'], shortEnd: true, proof: '^ind-sanctum-door$', density: 1.5, aisle: 4,
    flank: { ids: IND_LAMP, off: 0.4 }, before: [{ id: 'ind-nandi', s: 5.5, rot: 'focal', reach: 1, why: 'Nandi on the worship axis, facing the sanctum' }],
    ranks: { id: 'ind-temple-pillar', gap: 5.5, aisle: 7, s0: 2.5, s1: 3, per: 4, why: 'the pillared hall: carved pillars in rows either side of the axis' },
    ceiling: [{ id: 'ind-temple-bell', s: 9, why: 'the bell over the way in, rung on entering' }], rugs: [{ id: 'decal-mandana', s: 2.2, why: 'a floor painting before the sanctum' }], lamps: { wall: [], floor: IND_LAMP } },
  'ind-bazaar': { culture: 'india', name: 'bazaar shop', label: 'merchant\'s seat', focal: ['ind-merchant-seat'], proof: '^ind-merchant-seat$', density: 4,
    before: [{ id: 'ind-grain-baskets', s: 1.4, why: 'baskets of grain and spice before the merchant' }],
    walls: ['ind-brass-pots', 'ind-grain-jars', 'ind-water-pots'], doorWall: ['ind-grain-baskets'], corners: ['ind-grain-jars'], lamps: { wall: [], floor: IND_LAMP } },
  'ind-stepwell': { culture: 'india', outdoor: true, name: 'stepwell', label: 'stepped tank', focal: ['ind-stepwell'], proof: '^ind-stepwell$', density: 0.9, round: 1.2,
    corners: ['ind-chhatri'], edgeItems: ['ind-water-pots'], per: 400 },
  'ind-kitchen': { culture: 'india', name: 'household kitchen', label: 'chulha', focal: ['ind-chulha'], proof: '^ind-chulha$', density: 4,
    before: [{ id: 'ind-grinding-stone', s: 1.2, dt: 2.2, why: 'the grinding stone beside the stove' }],
    walls: ['ind-niche-shelf', 'ind-grain-jars', 'ind-water-pots', 'ind-niche-shelf'], corners: ['ind-grain-jars', 'ind-brass-pots'], lamps: { wall: [], floor: IND_LAMP } },
});

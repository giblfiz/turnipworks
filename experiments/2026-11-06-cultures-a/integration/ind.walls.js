// ---- India (culture pack, 2026-11-06, cultures-a): 18th-century Jaipur-Amber, Rajasthan. Walls: ind-lime (ivory lime
// plaster with painted borders, the jharokha window) for the bazaar shop and the household kitchen; ind-sandstone (red
// sandstone, cusped arches, jali windows) for the palace hall; ind-temple (golden sandstone carved in horizontal bands)
// for the Shiva temple's hall, which has no windows. Doors: carved teak leaves with brass studs. The haveli courtyard and
// the stepwell are OUTDOOR. Graph: the shop is a hub (street in front, the household behind), the rest terminals. ----
Object.assign(ROLES, {
  'ind-haveli': { role: 'outdoor', who: 'the household' },
  'ind-durbar': { role: 'terminal', who: 'the ruler and his court' },
  'ind-mandapa': { role: 'terminal', who: 'worshippers' },
  'ind-bazaar': { role: 'hub', who: 'customers at the front, the merchant\'s household behind' },
  'ind-stepwell': { role: 'outdoor', who: 'everyone who comes for water' },
  'ind-kitchen': { role: 'terminal', who: 'the household' },
});
export const IND_ROOMS = ['ind-haveli', 'ind-durbar', 'ind-mandapa', 'ind-bazaar', 'ind-stepwell', 'ind-kitchen'];
WALL_FAMILIES.push('ind-lime', 'ind-sandstone', 'ind-temple');
FAMILY_FALLBACK['ind-lime'] = 'dressed-stone'; FAMILY_FALLBACK['ind-sandstone'] = 'dressed-stone'; FAMILY_FALLBACK['ind-temple'] = 'dressed-stone'; // (stone corner pillars: the culture's own red sandstone pillar where it has one)
TO_KIT['ind-lime'] = 'kit-stone'; TO_KIT['ind-sandstone'] = 'kit-stone'; TO_KIT['ind-temple'] = 'kit-stone';
NO_WINDOWS.add('ind-mandapa'); // a temple hall is lit by its lamps (ind-temple has no window piece)
{ const leaf = { 'door-plank': 'ind-carved-leaf' }, carved = { main: 'door-plank', inner: 'door-plank', leaf };
  for (const k of ['ind-durbar', 'ind-mandapa', 'ind-bazaar', 'ind-kitchen']) DOORS[k] = carved; }
DOOR_ENDS.add('ind-mandapa'); DOOR_ENDS.add('ind-durbar'); // entered facing the sanctum, the throne, down the long axis

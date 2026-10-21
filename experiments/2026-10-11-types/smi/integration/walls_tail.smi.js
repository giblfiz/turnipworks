// ---- smithy & workshop (2026-10-11): nine rooms. The fire rooms (forge, armourer, potter) are fieldstone, the woodshop
// and the stock store rough timber, the shop front, the quarters and the passage half-timber: all families the inn
// already had. The yard is an outdoor room: no walls of its own, the neighbours' doors open onto it ----
export const SMI_WORKSHOPS = ['smi-forge', 'smi-armoury', 'smi-carpenter', 'smi-potter']; // ONE workshop program; the craft is a line of data (solver2.js SMI_CRAFTS)
Object.assign(ROLES, {
  // the forge is the heart of the building, and a WORK room: it has doors to the rooms it uses (the store, the other workshops) and to the yard;
  // customers stay in the shop front, which is the hub (mktRegisterShop below)
  'smi-forge': { role: 'uses', who: 'the smith, his striker', uses: ['smi-stock', 'smi-armoury', 'smi-carpenter', 'smi-potter'] },
  'smi-armoury': { role: 'uses', who: 'the armourer', uses: ['smi-stock'] },
  'smi-carpenter': { role: 'uses', who: 'the carpenter', uses: ['smi-stock'] },
  'smi-potter': { role: 'uses', who: 'the potter', uses: ['smi-stock'] },
  'smi-stock': { role: 'terminal', who: 'the craftsmen' },
  'smi-quarters': { role: 'terminal', who: "the smith's household" },                         // upstairs, reached by the passage's stair
  'smi-passage': { role: 'passage', who: 'the household' },
  'smi-yard': { role: 'outdoor', who: 'everyone: customers, horses, carts' },
});
NO_WINDOWS.add('smi-stock'); // a store: its walls are for stock
mktRegisterShop('smi-shopfront'); // the shop front is a shop of the market's skeleton: hub, the shop window in the street wall, no door into the shop next door

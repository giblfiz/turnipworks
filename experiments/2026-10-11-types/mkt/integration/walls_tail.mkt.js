// ---- market & village (2026-10-11): twelve rooms. Shops and houses are half-timber (the family the inn already had; it
// gained a second wall shape, a doorway and the shop window), the watch post is fieldstone. The square and the street are
// outdoor rooms: no walls of their own, the neighbours' doors open onto them ----
export const MKT_SHOPS = ['mkt-general', 'mkt-bakery', 'mkt-apothecary', 'mkt-tailor', 'mkt-curio']; // ONE shop program; the trade is a sku tier (solver2.js MKT_TRADES)
Object.assign(ROLES, {
  'mkt-square': { role: 'outdoor', who: 'everyone: traders, shoppers, carts' },
  'mkt-street': { role: 'outdoor', who: 'everyone on foot, carts' },
  'mkt-backroom': { role: 'terminal', who: 'the shopkeeper' },
  'mkt-passage': { role: 'passage', who: 'the household' },                              // the side passage with the stair to the rooms above
  'mkt-watch': { role: 'uses', who: 'the watch, and whoever they bring in', uses: [] },    // (not a hub: a hub is given a loop through its corners, and the lockup stands in one)
  'mkt-house': { role: 'hub', who: 'the family' },                                       // the living room: the bedroom opens off it
  'mkt-bedroom': { role: 'terminal', who: 'the family' },
});
// two shops side by side are two businesses: no door between them (nor into the watch post or a neighbour's living room).
// One hook line at the top of linkWhy(). A shop still opens into ITS back room, the passage, and onto the street.
const MKT_FRONTS = new Set(['mkt-watch', 'mkt-house']); // (+ every shop: mktRegisterShop)
function mktNoLink(a, b) { return MKT_FRONTS.has(a.type) && MKT_FRONTS.has(b.type); }
// THE SHOPFRONT: the shop window (kit role wall-window-shop, family half-timber) stands in for every plain panel of the
// wall that has the shop's street door in it, and for no other wall: the other three walls are for shelves.
// (`only` on a PANELS rule: one line in specialPanels(), a filter on the eligible panels.)
// A shop's light is its shop window: no other windows are rolled, so the other walls are shelves from end to end.
// mktRegisterShop(key): everything walls.js knows about a shop, for one more room key (a later trade calls it from its own block).
export function mktRegisterShop(key) {
  if (!MKT_SHOPS.includes(key)) MKT_SHOPS.push(key);
  ROLES[key] = { role: 'hub', who: 'customers' };   // customers come in from the street; the back room and the passage open off it
  MKT_FRONTS.add(key);
  PANELS[key] = [{ ids: ['wall-window-shop'], sides: 'all', ends: true, every: [1, 1], only: (p, r, edges) => perimeter(r).some(q => q.side === p.side && edges.get(q.key)?.kind === 'door' && edges.get(q.key).sides.length === 1) }];
  NO_WINDOWS.add(key);
}
for (const k of [...MKT_SHOPS]) mktRegisterShop(k);
NO_WINDOWS.add('mkt-backroom'); // (a store)

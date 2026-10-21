// Alignment Bench queues (2026-10-04): which meshes need an effect anchor, per mode. Pure (no three.js, no DOM), so
// node can test it. Built at load time from the deployed tuner's data/library.json, so a library rebuild (new meshes,
// new mesh ids) shows up here without a bench deploy. One queue entry = one MESH (`<src>/<sku>@<sha1-8>`), because
// every record the bench writes is keyed by mesh, like fire anchors and orientation.

// A COPY of tools/spawn-tuner/js/fx/fire.js fireType(), used only when the caller hands none over (node tests). The
// bench itself passes the deployed tuner's own fireType (main.js), so a flame type a batch adds there (cresset, flame
// bowl, athanor ...) reaches the fire queue with no edit here. (2026-10-12: this copy had gone stale and ten lit meshes
// of the castle and crypt batch were missing from the queue.)
export function fireType(id = '') {
  if (/^(fireplace|cook-hearth|hearth)/.test(id) || /-hearth$|^hearth-/.test(id)) return 'hearth';
  if (/rug|rake|mat\b/.test(id)) return null;
  if (/oven/.test(id)) return 'oven';
  if (/brazier|fire-pit|firepit/.test(id)) return 'brazier';
  if (/torch/.test(id)) return 'torch';
  if (/chandelier/.test(id)) return 'chandelier';
  if (/candelabra/.test(id)) return 'candelabra';
  if (/candle-stubs/.test(id)) return 'stubs';
  if (/candle/.test(id)) return 'candle';
  if (/lantern|lamp/.test(id)) return 'lantern';
  if (/cresset/.test(id)) return 'torch';
  if (/signal-beacon|boiling-oil|fire-basket|cauldron-crane|pig-on-spit/.test(id)) return 'brazier';
  if (/flame-bowl/.test(id)) return 'brazier';
  if (/sand-tray/.test(id)) return 'stubs';
  return null;
}

// WATER: vessels that can hold standing water. inn-02's EMPTY group (bucket, ewer and basin, stone horse trough, open
// rain barrel, washtub, water trough, open well) plus the catalog's other open water vessels. Standing barrels are in
// so the raycast can say whether their top is open; things that hold food, feed, ash or slops are out.
const WATER_IDS = new Set([
  'bucket', 'ewer-and-basin', 'horse-trough-stone', 'rain-barrel', 'washtub', 'water-trough', 'well',
  'basin-stone', 'bathtub-wood', 'cauldron', 'quench-trough', 'rural-water-bucket-stable', 'water-jug-basin',
  'trade-fever-basin', 'washboard-tub', 'barrel',
]);

// OPEN/SHUT: catalog objects that open (aff "open"), have a catalog "-open" twin (open_of), or swing on a hinge.
const OPEN_EXTRA = new Set(['floor-trapdoor', 'privy-stall-door', 'stable-stall-door', 'stable-stall-gate', 'trunk-travel', 'rural-tack-trunk']);
// how the auto guess treats an openable: a swinging LEAF (door, gate, shutter, trapdoor: the whole mesh turns), a LID
// (chest-like: the mesh is cut at a height and the top swings back), or a SWAP to the "-open" twin
export function openKind(id, sku) {
  if (/trapdoor/.test(id)) return 'trapdoor';
  if (/door|gate|shutter/.test(id) || sku?.piece === 'leaf') return 'leaf';
  if (/chest|trunk|strongbox|box|coffer|casket/.test(id)) return 'lid';
  return 'other'; // cupboards, wardrobes, windows, ovens: two leaves or a hatch, only the swap reads right
}

const meshSkus = (o) => o.skus.filter(s => s.kind === 'mesh' && s.bounds && s.mesh && s.url);
const entry = (o, s, extra) => ({ id: o.id, sku: s.sku, mesh: s.mesh, url: s.url, bounds: s.bounds, size: o.size, place: o.place, piece: s.piece || '', desc: o.desc || '', ...extra });

// the open twin of a closed sku: same suffix on the open object (chest-plain--s2 -> chest-plain-open--s2), else its first.
// The open object is the one whose catalog line says `open_of: <id>` (portcullis-raised is the open portcullis), else "<id>-open".
export function twinOf(lib, id, sku) {
  const t = Object.values(lib.objects).find(o => o.open_of === id && meshSkus(o).length) || lib.objects[`${id}-open`]; if (!t) return null;
  const want = sku.startsWith(id) ? `${t.id}${sku.slice(id.length)}` : null;
  const s = meshSkus(t).find(k => k.sku === want) || meshSkus(t)[0];
  return s ? { id: t.id, sku: s.sku, mesh: s.mesh, url: s.url, bounds: s.bounds, size: t.size } : null;
}

// opt.fireType: the tuner's own (see above). opt.bench: the tool sweep's lists (queues/bench.json, tools/tool-sweep):
// { water: {id: why}, open: {id: why} } = objects a batch DECLARED for the bench (manifest flag bench:water / bench:hinge,
// or its BENCH.md), on top of the rules here. A missing or empty file changes nothing.
export function buildQueues(lib, fireAuto = {}, opt = {}) {
  const fireType_ = opt.fireType || fireType, moreWater = opt.bench?.water || {}, moreOpen = opt.bench?.open || {};
  const fire = [], water = [], open = [];
  const objs = Object.values(lib.objects).sort((a, b) => a.id.localeCompare(b.id));
  const twins = new Set(objs.filter(o => o.open_of).map(o => o.open_of));
  for (const o of objs) {
    const ft = fireType_(o.id);
    if (ft) for (const s of meshSkus(o)) {
      const a = fireAuto[s.sku];
      const auto = a && (!a.mesh || a.mesh === s.mesh) ? a : null; // auto anchors belong to the mesh they were derived on
      fire.push(entry(o, s, { type: ft, auto: auto ? { anchors: auto.anchors, method: auto.method || '' } : null }));
    }
    if (WATER_IDS.has(o.id) || moreWater[o.id]) for (const s of meshSkus(o)) water.push(entry(o, s, { empty: /--(empty|open)$/.test(s.sku) }));
    if (!o.id.endsWith('-open') && !o.open_of && (o.aff?.includes('open') || twins.has(o.id) || OPEN_EXTRA.has(o.id) || moreOpen[o.id])) for (const s of meshSkus(o)) {
      const twin = twinOf(lib, o.id, s.sku);
      open.push(entry(o, s, { kind: openKind(o.id, s), twin }));
    }
  }
  // inn-02's empty vessels first: they were made for the water shader
  water.sort((a, b) => (b.empty - a.empty) || a.sku.localeCompare(b.sku));
  return { fire, water, open };
}

// Floor tiles (Harry 2026-10-04): every floor the tuner draws (planks, parquet, herringbone, checkers, flagstones,
// tiles, earth, the stable's straw scatter) is also a PLACEABLE 5×5-ft object, like a rug. A tile:
//   - is an ordinary object entity: { place: 'tile', layer: 'floor', flat: true, cat: 'floor-…', x/z = a cell centre }
//   - is drawn by the tuner's own floor code (look.floorSpecs on a one-cell room at the tile's WORLD cell), so the
//     patterned floors that crop a periodic layout by world cell (herringbone, checkers, flagstones, delft…) and the
//     seamless continuous floors read as one floor across neighbouring tiles; straw keeps its hay and dirt scatter
//   - REPLACES the generated floor of its cell (the shell skips that cell: no z-fighting, no doubled floor); rugs
//     (y ≥ 0.03) and furniture sit on top as before
//   - one per cell: painting, moving or pasting a tile onto a cell takes the old tile's place
import * as THREE from 'three';
import { newId } from '../core/ids.js';

export const TILE = 5;
export const TILE_DIMS = [TILE, 0.05, TILE];
export const isTile = (e) => e?.kind === 'object' && e.place === 'tile';
export const isFloorCat = (id) => typeof id === 'string' && id.startsWith('floor-');
export const cellOf = (x, z) => [Math.floor(x / TILE), Math.floor(z / TILE)];
export const centre = (g) => g * TILE + TILE / 2;
export const cellKey = (x, z) => cellOf(x, z).join(':');
export const tileName = (id) => id.replace(/^floor-/, '').replace(/-/g, ' ') + ' floor';

// every flat floor material in the library (the list the tuner's room floors draw from)
export const floorCats = (lib) => Object.keys(lib.objects).filter(k => isFloorCat(k) && lib.objects[k].skus.some(s => s.kind === 'flat')).sort();

// a tile's catalog sizing (what roomgen.sizeOf returns for a thing): one 5-ft cell, flat
export function tileSize(lib, cat, skuName = null) {
  const o = lib.objects[cat]; if (!o) return null;
  const sku = (skuName && o.skus.find(k => k.sku === skuName)) || o.skus.find(k => k.kind === 'flat' && !k.sku.includes('--v') && !/^g\d\d$/.test(k.shape || '')) || o.skus.find(k => k.kind === 'flat');
  return sku ? { sku: sku.sku, url: sku.url, flat: true, place: 'tile', s: [1, 1, 1], yaw: 0, dims: [...TILE_DIMS] } : null;
}

// the tuner's own floor specs for the one cell under (x, z): the tile and (straw) its scatter decals
export function tileSpecs(look, cat, x = TILE / 2, z = TILE / 2) {
  const [gx, gz] = cellOf(x, z);
  const r = { id: 'tile', x: gx, z: gz, w: 1, d: 1, wallSeed: `tile:${gx}:${gz}`, floor: cat, type: '', family: '' };
  try { return look.floorSpecs(r).specs; } catch { return []; }
}

// the visual: the cell's specs as children around the tile's own origin (its group sits at the cell centre)
export async function tileVisual(look, e) {
  const x = e.x ?? TILE / 2, z = e.z ?? TILE / 2, specs = tileSpecs(look, e.cat, x, z);
  if (!specs.length) return null;
  const [gx, gz] = cellOf(x, z), cx = centre(gx), cz = centre(gz);
  const vs = await Promise.all(specs.map(sp => look.makeVisual(sp, false).catch(() => null)));
  const g = new THREE.Group();
  vs.forEach((v, i) => {
    if (!v) return;
    const sp = specs[i], h = new THREE.Group();
    h.position.set(sp.x - cx, sp.y || 0, sp.z - cz); h.rotation.y = sp.rot || 0;
    h.add(v); g.add(h);
  });
  g.userData.tile = true;
  return g;
}

// the cells of a straight run from a to b (inclusive, 4-connected: a painted run never skips a cell diagonally)
export function runCells(a, b) {
  const out = [];
  let [x, z] = a; const [x1, z1] = b;
  const dx = Math.abs(x1 - x), dz = Math.abs(z1 - z), sx = Math.sign(x1 - x), sz = Math.sign(z1 - z);
  out.push([x, z]);
  let ex = 0, ez = 0;
  for (let i = 0; i < dx + dz; i++) {
    // step along whichever axis is further behind the ideal line
    if ((ex + 1) * dz <= (ez + 1) * dx && ex < dx) { x += sx; ex++; } else { z += sz; ez++; }
    out.push([x, z]);
  }
  return out;
}
export function rectCells(a, b, cap = 1600) {
  const out = [];
  for (let x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++) for (let z = Math.min(a[1], b[1]); z <= Math.max(a[1], b[1]); z++) { out.push([x, z]); if (out.length >= cap) return out; }
  return out;
}

// the ops that lay `cat` on these cells as ONE command (one undo step): any other tile already on a cell goes; a cell
// that already has this very floor is left alone
export function paintOps(app, cat, cells, { size = null, y = 0 } = {}) { // y: the height of the floor being painted
  const sz = size || tileSize(app.lib, cat); if (!sz) return [];
  const byCell = new Map();
  for (const e of Object.values(app.entities())) if (isTile(e) && Math.abs((e.y || 0) - y) < 2.5) { const k = cellKey(e.x, e.z); (byCell.get(k) || byCell.set(k, []).get(k)).push(e); }
  const ops = [], seen = new Set();
  for (const [gx, gz] of cells) {
    const k = `${gx}:${gz}`; if (seen.has(k)) continue; seen.add(k);
    const there = byCell.get(k) || [];
    if (there.length === 1 && there[0].cat === cat) continue;
    for (const t of there) ops.push({ type: 'object.delete', args: { id: t.id } });
    const x = centre(gx), z = centre(gz);
    ops.push({ type: 'object.place', args: { id: newId('obj'), name: tileName(cat), cat, sku: sz.sku, url: sz.url, flat: true, place: 'tile', layer: 'floor', x, y, z, rot: 0, yaw: 0, dims: [...TILE_DIMS], room: app.roomAt(x, z, y)?.id || undefined } });
  }
  return ops;
}
// tiles (other than `except`) already on the cell under (x, z): moving or pasting a tile there takes their place
export function tilesAt(app, x, z, except = new Set(), y = 0) {
  const k = cellKey(x, z);
  return Object.values(app.entities()).filter(e => isTile(e) && !except.has(e.id) && cellKey(e.x, e.z) === k && Math.abs((e.y || 0) - y) < 2.5);
}

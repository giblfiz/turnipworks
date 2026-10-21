// Asset delivery (2026-10-11, docs/ASSET_DELIVERY.md): the library names an asset by a LOGICAL address
// ('assets/lod/f10000/chair.glb', 'assets/tex/t256/chair.webp'); what the browser fetches is the DELIVERED copy
// 'assets/d/lod/f10000/chair.<token>.glb', whose name changes whenever its bytes do, so it is served "immutable" and
// kept for a year by the browser and the edge. The tokens are assets/delivery.json, written by prep/delivery.py at
// every deploy: {v, recipe, tokens: {<file name without extension>: <token>}}. One token per name covers every
// file of that name (a sku's mesh at every face count, its colour map at every size).
//   No manifest (a working tree nobody has built, an old deploy) or no token for a name: the logical address is
//   fetched as it always was. A delivered address that fails to load is retried at its logical address (loaders in
//   look.js), so a manifest that is ahead of or behind the files can never leave a hole in the picture.
let TOKENS = null;
export function setDelivery(manifest) { TOKENS = manifest?.tokens || null; }
export const deliveryOn = () => !!TOKENS;
// 'assets/x/name.ext?r=..' -> 'assets/d/x/name.<token>.ext' (the old '?r=' revision is dropped: the token replaces it)
export function deliver(url) {
  if (!TOKENS || !url.startsWith('assets/') || url.startsWith('assets/d/')) return url;
  const p = url.split('?')[0], s = p.lastIndexOf('/'), d = p.lastIndexOf('.');
  if (d <= s) return url;
  const t = TOKENS[p.slice(s + 1, d)];
  return t ? `assets/d/${p.slice(7, d)}.${t}${p.slice(d)}` : url;
}
// url: the manifest's address, stamped with the deploy's version like the other lists ('assets/delivery.json?v=…')
export async function loadDelivery(url = 'assets/delivery.json') {
  // ?nodelivery on the page's address: every asset from its plain address (to compare, or to rule delivery out)
  if (/[?&]nodelivery\b/.test(globalThis.location?.search || '')) { setDelivery(null); return null; }
  try { const r = await fetch(url, { cache: 'no-cache' }); setDelivery(r.ok ? await r.json() : null); } catch { setDelivery(null); }
  return TOKENS;
}

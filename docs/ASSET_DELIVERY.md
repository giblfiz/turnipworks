# Asset delivery: how a mesh or a picture gets from the library to a browser

Written 2026-10-11. This is the pipeline as it now is. The measurements behind it are in
`experiments/2026-10-11-asset-cost/` (the study) and `experiments/2026-10-11-delivery/` (the before and after of this
work). Every number here is the build box unless it says otherwise.

## The short version

- The library still names an asset by a **logical address**: `assets/lod/f10000/chair.glb`,
  `assets/tex/t256/chair.webp`, `assets/flat/floor-oak.webp`, `assets/figures/foe-goblin--8k512-1a2b3c4d.glb`. Those
  files are the **sources**. Nothing in this pipeline changes or deletes them.
- What a browser fetches is the **delivered copy**: `assets/d/lod/f10000/chair.<token>.glb`. The token is 8 hex digits
  that change whenever the bytes do, so a delivered copy is served `Cache-Control: public, max-age=31536000, immutable`
  and is never asked for twice.
- A delivered **mesh** is meshopt-compressed (about a third of the source on the wire). A delivered **picture** is the
  same bytes as its source (a hard link).
- `tools/spawn-tuner/deploy.sh` builds whatever is missing before it copies anything, and the deploy gate
  (`test/assets_check.py`) refuses to deploy if a listed file has no delivered copy. **An asset added by anyone is
  compressed and content-addressed by the next deploy with no extra step.**

## The pieces

| piece | where | what it does |
|---|---|---|
| the builder | `tools/spawn-tuner/prep/delivery.py` | lists every asset the library can ask for (the same list as `assets_check.py`: `data/library.json` skus at every face count and texture size, `data/figures.json` figures and their originals), builds the delivered copies that are missing or whose source changed, writes `assets/delivery.json`, retires old copies |
| the mesh compressor | `tools/spawn-tuner/prep/meshopt.mjs` (+ `prep/package.json`) | one GLB in, one meshopt GLB out, checked against its source |
| the manifest | `assets/delivery.json` | `{"recipe": …, "tokens": {"<file name without extension>": "<token>"}}`. One token per NAME: it covers every file of that name (a sku's mesh at each face count, its colour map at each size, its shipping GLB), so about 2,700 entries, 97 KB (about 40 KB compressed) |
| the client's map | `tools/spawn-tuner/js/delivery.js` | `deliver('assets/lod/f10000/chair.glb')` → `'assets/d/lod/f10000/chair.<token>.glb'`; no token → the address unchanged |
| the mesh loader | `tools/spawn-tuner/js/gltf.js` | `gltfLoader()`: a `GLTFLoader` with the meshopt decoder running in workers |
| the picture loader | `tools/spawn-tuner/js/tex.js` | `loadTexture(url, { flipY })`: decodes off the main thread (`createImageBitmap`) |
| the gate | `tools/spawn-tuner/test/assets_check.py` | fails if a listed file that exists has no delivered copy, or a delivered mesh is not compressed |
| the network check | `tools/spawn-tuner/test/delivery_net.py` | a real browser, two visits: redirects, lifetimes, types, what the second visit re-downloads |

### Tokens, exactly

`token(name) = sha1 of the sorted lines "<logical address>:<recipe>:<sha1 of the delivered bytes, 8 hex>"` over every
listed file with that name, cut to 8 hex. So a name's addresses all change together when ANY of its files changes
(a re-decimated rung, a repainted colour map), and never otherwise. A name gets a token only when EVERY one of its
listed files has a delivered copy; until then the client fetches that name's sources at their plain addresses, as it
always did.

### What the client does when something is missing

- No `assets/delivery.json` (a working tree nobody built, an old deploy): plain addresses. Everything works, nothing is
  cached for good, meshes are uncompressed.
- A delivered address that fails to load (a manifest ahead of its files in the middle of a deploy): the loader asks
  for the plain address instead (`look.js`, `fetched()`).
- `?nodelivery` on the game's or the tuner's address: plain addresses for everything (to compare, or to rule delivery
  out when something looks wrong). `?imgtex`: pictures through `THREE.TextureLoader` as before 2026-10-11.

### Old clients keep working through a deploy

Delivered copies are NEW files beside the sources; no file a running client knows is overwritten. A browser still
running yesterday's client asks for yesterday's addresses: plain ones (before 2026-10-11) or delivered ones that are
kept for 14 days after they stop being current (`--prune-days`; the list of retired copies and when they retired is
in `assets/d/.cache.json`).

## The mesh recipe (`meshopt-high-1`)

`gltf-transform`'s `meshopt({ level: 'high' })`, the setting trialled in the study's `A_compression.md`:

- vertices and triangles reordered for the codec; `EXT_meshopt_compression` (filters on);
- positions quantized to 14 bits (stored as 16-bit integers; the scale and offset go on the mesh's NODE, so code must
  read a mesh through its world matrix, which everything here already did);
- UVs to 12 bits (left as floats when a mesh has UVs outside 0..1); normals to 8-bit octahedral;
- textures and materials inside a file (figures, the shipping GLBs) pass through untouched.

Every output is read back and compared with its source before it counts: same triangle count, no more vertices, the
model's box within 0.02% of its largest side, the UV box within 1/1024. A file that fails is not delivered; its name
stays on its sources and the build says so. The study's measured error for this setting: worst vertex 0.007% of the
model's size, UVs 0.04 texel at the shipped texture sizes; mean pixel difference 0.1 of 255.

To change the recipe: change `prep/meshopt.mjs` AND the name `RECIPE_GLB` in `prep/delivery.py`. Every mesh is then
rebuilt and every name gets a new token.

## Adding or replacing an asset

Nothing new to do. Put the source files where they always went (`prep/blender_lod.py`, `prep/lod_tex.py`,
`prep/flats.py`, `build_data.py`, `build_figures.py`), then `tools/spawn-tuner/deploy.sh`. The deploy prints
`delivery: … names, … delivered files (N new, …)`.

- By hand: `python3 tools/spawn-tuner/prep/delivery.py` (build), `--check` (what the gate checks), `--only REGEX`
  (try a few names), `--raw` (no compression: plain hard links; the fallback if the compressor ever has to be taken
  out of the path).
- First run on a machine: `npm ci` in `tools/spawn-tuner/prep/` (the builder does it by itself if `node_modules` is
  missing). Node 20.
- A whole library from nothing: about 10,400 mesh files in 2 to 3 minutes on three cores; a later deploy builds only
  what changed (a no-change run is 2 s). Measured: 10,400 files in 2 min 17 s, none refused by the check.
- A replaced mesh under the same sku no longer needs the `rev` trick on its colour map's address: the token changes.

## The servers

Both sites are nginx on the build box behind Cloudflare (TLS ends at Cloudflare). The game asks its own origin for
assets: `https://turnipworks.net/look/assets/…` on turnipworks.net, `…/projects/turnip-works/tuner/assets/…` on
implausible.enterprises. Same origin, so no CORS and no second connection. There is no redirect on this path: a browser's network log of a table opened at
`https://turnipworks.net/` showed none before this work and none after. The 301 the study saw is real only for
`turnipworks.net/tuner/…`, which the game does not ask for; until the morning of 2026-10-11 the page at
`turnipworks.net/engine/client/index.html` (the address in older invite links) was the other site's page and did point
there, which is the likely source of the finding.

What was added on 2026-10-11, in both site files (`/etc/nginx/sites-available/turnipworks.net`, copied in
`engine/relay/nginx-turnipworks.net.conf`; `/etc/nginx/sites-enabled/implausible-enterprises`; the files as they were
are in `/etc/nginx/backup-2026-10-11-delivery/`):

```nginx
# turnipworks.net (above the general /look/ location: regex locations are tried in order)
location ~ ^/look/(assets/(d|wallkit)/.+)$ {
    alias /var/www/implausible-landing/projects/turnip-works/tuner/$1;
    types { model/gltf-binary glb; image/webp webp; image/png png; image/jpeg jpg jpeg; application/json json; }
    gzip on; gzip_vary on; gzip_comp_level 6; gzip_min_length 1024; gzip_types model/gltf-binary;
    add_header Cache-Control "public, max-age=31536000, immutable";
}
location ~ ^/look/(assets/.+\.glb)$ {          # the sources (older clients): the right type, gzip
    alias /var/www/implausible-landing/projects/turnip-works/tuner/$1;
    types { model/gltf-binary glb; }
    gzip on; gzip_vary on; gzip_comp_level 6; gzip_min_length 1024; gzip_types model/gltf-binary;
}
# implausible.enterprises
location ~ ^/projects/turnip-works/tuner/assets/(d|wallkit)/ {
    types { model/gltf-binary glb; image/webp webp; image/png png; image/jpeg jpg jpeg; application/json json; }
    gzip_comp_level 6; gzip_types model/gltf-binary;
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
}
location ~ ^/projects/turnip-works/tuner/assets/.+\.glb$ {
    types { model/gltf-binary glb; }
    gzip_comp_level 6; gzip_types model/gltf-binary;
    try_files $uri =404;
}
```

- The wall kit's six pictures (`assets/wallkit/stone.a09bad29.webp` …) already carried a hash in their names, so
  they get the same lifetime.
- Before this, turnipworks.net sent `.glb` as `application/octet-stream` with NO compression at all (its server block
  had no gzip); implausible.enterprises gzipped at nginx's default level 1.
- **Brotli: not on.** The installed nginx (1.28.0, Ubuntu) has neither the brotli filter nor `brotli_static`
  (`nginx -V`; `/etc/nginx/modules-enabled/` is empty). Ubuntu packages them
  (`libnginx-mod-http-brotli-filter`, `libnginx-mod-http-brotli-static`, universe); installing a module into the
  nginx that serves some twenty-five other sites was left alone. The study measured what it would add: 7% on top of
  meshopt + gzip. Cloudflare re-compresses text types to brotli by itself; it does not touch `model/gltf-binary`.

### The Cloudflare rule still wanted

Cloudflare caches by file extension, and `.glb` is not on its list: every mesh request still reaches the origin
(`cf-cache-status: DYNAMIC`), although the browser now keeps it for a year. One **Cache Rule** in each zone
(turnipworks.net and implausible.enterprises; dashboard ▸ Caching ▸ Cache Rules ▸ Create rule) finishes the job:

- **When incoming requests match** (expression):
  `(starts_with(http.request.uri.path, "/look/assets/d/")) or (starts_with(http.request.uri.path, "/projects/turnip-works/tuner/assets/d/"))`
- **Then**: Cache eligibility = **Eligible for cache**; Edge TTL = **Use cache-control header if present, bypass
  cache if not**; Browser TTL = **Respect origin TTL**.

The expression names paths only, so in the turnipworks.net zone it covers dev.turnipworks.net too (2026-10-19, two
servers: dev serves the same `/look/assets/d/` paths from the dev tree, prod from its release; Cloudflare keys its cache by
host, and a delivered name never changes content, so the two can never serve each other's bytes). No change needed for dev.

Nothing else is needed: the origin's header already says a year and immutable, and delivered addresses never change
content, so there is nothing to purge, ever. (It needs an API token or the dashboard; we have neither from here.)

## Licences of what was added

| what | role | licence | where |
|---|---|---|---|
| meshoptimizer 1.2.0, `meshopt_decoder.mjs` | shipped to the browser (vendored: `js/vendor/meshopt_decoder-1.2.0.js`, 29 KB) | MIT | `js/vendor/LICENSE.meshoptimizer` |
| meshoptimizer 1.2.0 (encoder) | build | MIT | `prep/node_modules/meshoptimizer/LICENSE.md` |
| @gltf-transform/core, /extensions, /functions 4.5.1 | build | MIT | each package's `LICENSE.md` |
| their dependencies (property-graph, ktx-parse, ndarray-*, sharp …) | build only, never shipped or redistributed (`node_modules` is not in git) | MIT, except sharp: Apache-2.0 (it bundles libvips, LGPL) | `prep/package-lock.json` pins them |

Nothing shipped to a browser is anything but MIT.

## Pictures: decoded off the main thread

`js/tex.js` `loadTexture()` replaces `THREE.TextureLoader` for the ladder's colour maps, the flats (floors, rugs,
decals), the wall kit and the roofs. `TextureLoader` gives the card an `<img>`, which is decoded on the main thread
inside the upload; `createImageBitmap` decodes in the background. An ImageBitmap ignores `texture.flipY`, so the flip
is asked for when the bitmap is made and the texture is marked `flipY = false`: the picture on the model is the same
(pixel difference of a room, old loader against new, effects off: 0.0 in Chromium; inside the noise floor in Firefox).
Pictures inside a GLB (figures) already went this way in three.js.

## What it bought (the build box; a local relay and site, so no network time)

Bytes are the files a cold load of each scene asked for, gzip level 6 as the origin serves them.

| | one room + 6 pawns | whole inn (10 rooms) + 6 pawns | 203-room town |
|---|--:|--:|--:|
| mesh bytes on the wire, before | 25.4 MB | 99.8 MB | 294.2 MB |
| **after (meshopt)** | **9.1 MB** | **32.9 MB** | **93.7 MB** |
| with the fitted tiers too (a trial, not on) | 5.1 MB | 15.5 MB | 42.6 MB |
| geometry on the card, before → after | 29 → 16.8 MB | 117.3 → 67.6 MB | 350.7 → 201.7 MB |
| at 30 Mbit/s that download is (estimated) | 6.8 → 2.4 s | 27 → 8.8 s | 78 → 25 s |

- Live, a real browser, one room: 60 meshes were 22.0 MB on the wire on every visit; now 7.4 MB on the first visit
  and **nothing on the second** (60 of 60 meshes and 67 of 67 pictures from the browser's cache, no request made).
- The picture: a common room, old against new, effects off: mean difference 0.05 to 0.28 of 255, 0.01 to 0.07% of
  pixels more than 16 off (the same page against itself: 0.005, 0.01%).
- Main thread, whole inn (CPU profile): mesh parsing 283 → 134 ms; the decoder's own main-thread share 49 ms (the rest
  is in workers); **the pick structures (`three-mesh-bvh`) build slower on quantized attributes: 152 → 334 ms.** Net
  about +80 ms of main thread for an inn, against 67 MB less to download.
- Picture uploads, whole inn (`texSubImage2D`, 319 uploads, two runs each, in turn): 680 and 541 ms → **100 and 81 ms**.
  Long tasks during the load: 1.92 and 1.74 s in all → 1.39 and 1.19 s; the longest 0.47 and 0.43 s → 0.30 and 0.28 s.
- Load time on a local stack barely moves (an inn settled at 5.3 to 5.5 s either way): with no network the download
  was never in it. The gain is the download, which was not measured on a real line.

## Right-sized face tiers: a trial, NOT the default

The faces dial has a new value, `fit` (`look.js` `fitFaces`; the game: `?faces=fit`): small things (the library's
`lod: small`, or a `tiny` footprint) at 1,500 faces, big pieces (four squares and up) at 10,000, the rest at 5,000.
The game still draws **10,000 for everything**; nothing Harry sees has changed.

Why it is not the default (2026-10-12, `experiments/2026-10-11-delivery/tiers/`):

- 24 props, each at 10,000 against its fitted rung, blind side by side (Gemini 2.5 Pro, sides randomised):
  | props sent to | close up: prefers the 10,000 | noticeable at the closest ordinary zoom | noticeable at table distance |
  |---|--:|--:|--:|
  | 1,500 (12 small things) | 10 of 12 (1 same, 1 the lower) | **8 of 12** | 1 of 12 |
  | 5,000 (12 pieces of furniture) | 8 of 12 (3 same, 1 the lower) | **4 of 12** | 1 of 12 |
  Its words for the worst (a sack at 1,500): "geometry exploded or corrupted … a chaotic jumble of sharp, flat planes".
- The same in the game, effects off, share of the whole screen's pixels more than 16 of 255 off against 10,000 (noise
  0.002 to 0.06%): table view 1.3% (room) and 2.5% (inn); leaning in 5.1% and 7.0%; low and close 5.1% and 10.5%.
  Nearly all of it is already there at a flat 5,000.
- So the lower rungs show at ordinary play distances, and plainly in first person. The rule was: then it does not
  become the default.
- What it would have saved: mesh bytes room 9.1 → 5.1 MB, inn 32.9 → 15.5 MB, town 93.7 → 42.6 MB; triangles placed in
  an inn 5.64 M → 2.30 M.
- What this says about the ladder: the rungs are not bad because they are few triangles but because the decimation
  tears the surface (the study's "fragment soup"). A 1,500-face kettle can look fine; ours does not. The saving is
  real and waits for a better decimator (one that keeps UV seams and attributes, e.g. meshoptimizer's simplifier),
  not for a braver dial.

## Weld before decimating: tested, not adopted

The study estimated 20 to 30% fewer vertices from welding the source mesh before decimating. Tested on its 30 sample
props (`experiments/2026-10-11-delivery/weld/`; Blender 4.3, merge by distance at 1e-4 of the largest side, then
today's decimation chain):

- The sources ARE split at UV seams by position (29,055 → 24,228 vertices on a candle) and nearly closed once welded.
- On the 19 props where the welded mesh still decimates to its target: vertices −12% at 10,000 faces, −8% at 5,000,
  −5% at 3,000, 0% at 1,500; bytes after meshopt + gzip −8%, −8%, −6%, −3%. Not 20 to 30%.
- **On 11 of 30 the decimator stops short on the welded mesh**: a jug stays at 29,000 faces at every rung; beds, a
  tree and a sconce stick at 5,000 to 6,000 whatever is asked. Summed over all 30, weld-first is 2% LARGER at 10,000
  and 77% larger at 1,500.
- Protecting seam vertices with a vertex group stops the decimation altogether (three props tried).
- The picture was not compared: a build that misses its face count on a third of the props is out before the look
  matters. `blender_lod.py` is unchanged.

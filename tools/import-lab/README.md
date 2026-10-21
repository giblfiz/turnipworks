# Import Lab

Live: https://implausible.enterprises/projects/turnip-works/import-lab/

A lab bench for one question: if a player imports their own model and we convert it **in their browser** to a small game asset and keep only that, how much do they lose? Original on the left, converted on the right, one camera, the game's lighting, the game's table distance. Why it exists and when to delete it: `COMMANDERS_INTENT.md`. What was measured and learned: `LAB_NOTES.md`.

Nothing is uploaded. The file is read, converted and displayed in the tab. The only thing that leaves the browser is the verdict record when a verdict button is pressed (settings, numbers, the note, the file's *name*; never its contents).

## Using it

1. Drop an STL, OBJ or GLB anywhere (or pick a built-in sample).
2. Say how tall it is in feet; turn it to face you; stand it up if it is lying down (STL has no units and no agreed "up").
3. Pick a triangle budget (5k / 10k / 20k / 50k / 100k), normal-map bake on or off, and the map size.
4. Look at **table distance** first. `1` `2` `3` switch table / leaning in / close-up. `F` switches side-by-side and flip; in either, hold `Space` to swap the original for the converted in place.
5. Press **This looks fine** or **Not good enough**, with a note if you like.

`python3 tools/import-lab/read_verdicts.py` prints what was sent.

## What the conversion does (`js/`)

| step | file | notes |
|---|---|---|
| read + weld | `pipeline.js` `ingest`, `mesh.js` `weldPositions` | every mesh in the file, world transforms applied, exact-position weld (STL has no shared vertices), slivers dropped, BVH built (three-mesh-bvh) |
| simplify | `pipeline.js` `simplify` | meshoptimizer 1.3.0 WASM simplifier to the budget; falls back to prune, then sloppy, if loose shells stop it short |
| normals | `mesh.js` `groupedNormals` | smooth, with hard edges kept where the surface really folds (80° when baking, 50° when not) |
| unwrap | `unwrap.js` `boxUnwrap` | six-direction box projection, charts packed on shelves. Milliseconds, never fails; about half the texture is used |
| bake | `bake.js` `bake` | for each texel: ray along the low model's normal, both ways, to the original; write the original's normal in the low model's tangent frame (explicit glTF tangents). Colour and texture are read at the same hit point |
| export | three's `GLTFExporter` | a real GLB. The right-hand view shows **that file loaded back in**, not the in-memory mesh |
| measure | `pipeline.js` `surfaceError` | 20,000 random points each way, nearest-surface distance, as a share of the model's height |

## Known limits (said plainly)

- **Box unwrap, not xatlas.** More seams and a looser pack than a proper atlas. xatlas-WASM was not tried; the box unwrap was good enough to answer the question.
- **An original's own normal map is not carried.** The bake reads the original's *geometry*. Sculpted detail survives; detail that only existed in the source's normal map does not. Its roughness and metalness textures are reduced to one average number each. Colour textures and vertex colours are carried.
- **Skinned and animated models** are taken in their rest pose, as static meshes.
- **GLB size is unoptimised:** float32 attributes, PNG textures (three's exporter cannot write WebP). The readout also gives the size with WebP textures. Mesh quantisation or meshopt compression would roughly halve the geometry.
- **Everything runs on the main thread.** The page freezes for the few seconds a conversion takes; a real importer should use a worker.
- **Pewter uses a small painted studio as its reflection** because the house lighting has no environment map and metal renders black without one.
- **The house lighting is imported live from the deployed Spawn Tuner** (`../tuner/js/fx/lighting.js`). If that module's interface changes, the lab falls back to plain lighting and says so in the status line.

## Samples and licences

Binaries are git-ignored (`*.glb`, `*.stl`); `deploy.sh` ships the gnome and refuses to deploy without it.

| sample | source | licence | build |
|---|---|---|---|
| `samples/garden-gnome.glb` (28,858 triangles, textured) | [Garden Gnome](https://polyhaven.com/a/garden_gnome) by Bhargav Kubal, Poly Haven | CC0 | `python3 prep/pack_polyhaven.py garden_gnome 2k` |
| Bumpy ball, Cube | generated in the page (`testShape` in `js/main.js`) | ours | none |
| `test/fixtures/bumpy-ball.stl` (20,480 triangles, the STL path's test input) | generated: the bumpy ball as a binary STL | ours | `python3 prep/make_fixtures.py` |

The Stanford Dragon sample (and its reduced STL fixture) was removed on 2026-10-21: the Stanford 3D Scanning Repository's terms exclude commercial use, which a public, CC BY repository cannot carry. Old `?sample=dragon` links open the gnome. The measurements in `LAB_NOTES.md` were made on the dragon and stay as records.


Vendored code: `vendor/meshopt_simplifier-1.3.0.js` (meshoptimizer, MIT), `vendor/three-mesh-bvh-0.8.3.js` (MIT, same copy as the Spawn Tuner's). three.js r170 from jsDelivr.

## Developing

```
# serve import-lab next to the tuner, as on the live site
mkdir -p /tmp/tw && ln -sfn $PWD/tools/import-lab /tmp/tw/import-lab && ln -sfn $PWD/tools/spawn-tuner /tmp/tw/tuner
(cd /tmp/tw && python3 -m http.server 8377 --bind 127.0.0.1)

PY=python3
$PY tools/import-lab/test/ui_check.py                      # 18 control checks (add the live URL to test the deploy; --send posts a self-test verdict)
$PY tools/import-lab/test/shoot.py OUT --clean --budgets 5000,10000,20000,50000,100000 --views table,lean,close   # shots + results.json
bash tools/import-lab/deploy.sh
```

URL parameters: `?sample=gnome|ball|cube|sphere|none` (default gnome), `budget`, `bake=0`, `tex`, `view=table|lean|close`, `mode=side|flip`, `light=night|day`, `look=pewter|plastic|primer`, `clean` (no labels in the picture), `capture` (keeps the drawing buffer for screenshots).

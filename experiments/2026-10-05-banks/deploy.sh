#!/usr/bin/env bash
# Build the banks-demo page into a folder (default: the live site) with a version stamp on every URL.
#   ./deploy.sh                 -> https://implausible.enterprises/projects/turnip-works/banks-demo/
#   ./deploy.sh /some/dir       -> a local copy for headless shots
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."; PILOT="$HERE/../2026-10-05-slopes"; T="$ROOT/tools/spawn-tuner"
DST="${1:-/var/www/implausible-landing/projects/turnip-works/banks-demo}"
V=$(date +%Y%m%d%H%M%S)
mkdir -p "$DST/lib/vendor" "$DST/tex" "$DST/models" "$DST/props"
cp "$HERE"/viewer/{index.html,main.js,scenes.js,terrain.js} "$DST/"
sed -i "s/__V__/$V/g" "$DST"/index.html "$DST"/*.js
cp "$PILOT/kit.json" "$DST/kit.json"                      # the pilot's measurements of its pieces (sizes, standing zones, colour)
# the game's lighting module and the three libraries it needs, copied from the working tree (read-only use)
cp "$T/js/fx/lighting.js" "$DST/lib/lighting.js"
cp "$T"/js/vendor/{postprocessing-6.39.5.js,n8ao-2.0.1.js,three-good-godrays-0.12.1.js,LICENSE.postprocessing.txt,LICENSE.n8ao,LICENSE.three-good-godrays} "$DST/lib/vendor/"
# ground: the game's grass, packed earth and flagstones; this demo's two generated textures (rock face, bank earth)
cp "$T"/assets/flat/{floor-grass,floor-earth-packed,floor-flagstone-large}.webp "$T"/assets/flat/decal-grass-*.webp "$DST/tex/"
cp "$HERE"/tex/{ground-rock,ground-rock-face,ground-earth-bank}.webp "$DST/tex/"
# pieces: the scree from the pilot (the only pilot piece used), and library props (sizes from the tuner library.json -> props.json)
for m in slope-scree; do cp "$PILOT/web-models/$m.glb" "$DST/models/"; done
python3 - "$T" "$DST" "$HERE" <<'PY'
import json, shutil, sys
T, DST = sys.argv[1], sys.argv[2]
USE = ['tree-fruit--s', 'tree-fruit--s2', 'tree-deciduous--s', 'tree-deciduous--s2', 'tree-birch--s', 'bush--s1', 'bush--s2', 'bush--s3', 'bush-berry',
       'hedge-straight--low', 'wall-drystone', 'wall-drystone-pier', 'fence-post-rail', 'log-seat', 'pillar-square--s1', 'stair-straight--dressed-stone', 'hearth-raised-square--s1']
lib = json.load(open(f'{T}/data/library.json'))['objects']; out = {}
for o in lib.values():
    for s in o['skus']:
        if s['sku'] in USE:
            out[s['sku']] = {'size_ft': [round(v / 12, 3) for v in (s.get('size') or o['size'])], 'place': o['place'], 'src': s['src'], 'mesh': s['mesh']}
            shutil.copy(f"{T}/{s['url']}", f"{DST}/props/{s['sku']}.glb")
missing = [u for u in USE if u not in out]
assert not missing, missing
HERE = sys.argv[3]   # this demo's own generated rocks (rocks_spec.py -> fal/models), sized by their largest dimension like any prop
for a in json.load(open(f'{HERE}/assets.json'))['assets']:
    if a['id'] not in ('rock-boulder', 'rock-table'): continue          # rock-cluster came back half unpainted: not used
    out[a['id']] = {'size_ft': [round(v / 12, 3) for v in a['size']], 'place': 'ground', 'src': 'banks-demo', 'mesh': a['id']}
    shutil.copy(f"{HERE}/fal/models/{a['id']}.glb", f"{DST}/props/{a['id']}.glb")
json.dump(out, open(f'{DST}/props.json', 'w'), indent=1)
PY
find "$DST" -type d -exec chmod 755 {} +; find "$DST" -type f -exec chmod 644 {} +
echo "deployed v=$V to $DST ($(du -sh "$DST" | cut -f1))"

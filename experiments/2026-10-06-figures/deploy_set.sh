#!/usr/bin/env bash
# Build the figure-set GALLERY into a folder, with a version stamp on every address (Cloudflare keeps files ~4 hours).
#   ./deploy_set.sh                      -> https://implausible.enterprises/projects/turnip-works/figures-pilot/set/
#   ./deploy_set.sh /some/dir            -> a local copy (serve it with: python3 -m http.server -d /some/dir)
#   --set DIR        the published set to copy (manifest.json, thumbs/, tiers/, models/); default ./set/published
#   --link-models    (default) if models/ is a symbolic link or bigger than 300 MB, DST/models becomes a link to the
#                    same folder instead of a copy.   --copy-models: always copy the originals in.
#   --link           link manifest.json, thumbs/, tiers/ and models/ instead of copying anything (scratch copies only)
# Safe to run again and again while the page is open: nothing is deleted, every file is swapped in whole, the data
# goes in before the page that asks for it, and the page itself goes last.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."; T="$ROOT/tools/spawn-tuner"
SET_DIR="${SET_DIR:-$HERE/set/published}"; DST=""; LINK_MODELS=1; LINK_ALL=0
while (($#)); do case "$1" in
  --set) SET_DIR="$2"; shift;; --set=*) SET_DIR="${1#--set=}";;
  --link-models) LINK_MODELS=1;; --copy-models|--no-link-models) LINK_MODELS=0;; --link) LINK_ALL=1;;
  -h|--help) sed -n '2,11p' "$0"; exit 0;;
  -*) echo "deploy_set: unknown option $1" >&2; exit 2;;
  *) DST="$1";; esac; shift; done
DST="${DST:-/var/www/implausible-landing/projects/turnip-works/figures-pilot/set}"
[ -f "$SET_DIR/manifest.json" ] || { echo "deploy_set: no manifest.json in $SET_DIR (nothing published yet?)" >&2; exit 1; }
python3 -c 'import json,sys; m=json.load(open(sys.argv[1])); assert isinstance(m.get("figures"), list)' "$SET_DIR/manifest.json" || { echo "deploy_set: $SET_DIR/manifest.json is not a readable figure list; nothing deployed" >&2; exit 1; }
SET_DIR="$(cd "$SET_DIR" && pwd)"; V=$(date +%Y%m%d%H%M%S)
mkdir -p "$DST/lib/vendor" "$DST/tex"
put() { install -m 644 "$1" "$2.tmp-$V" && mv -f "$2.tmp-$V" "$2"; }   # a whole file or the old one, never half

# the game's lighting module and the three libraries it needs, copied from the working tree (read-only use), as deploy.sh
put "$T/js/fx/lighting.js" "$DST/lib/lighting.js"
for f in postprocessing-6.39.5.js n8ao-2.0.1.js three-good-godrays-0.12.1.js LICENSE.postprocessing.txt LICENSE.n8ao LICENSE.three-good-godrays; do put "$T/js/vendor/$f" "$DST/lib/vendor/$f"; done
# the inn's plank floor the inspector stands a figure on (the FLOOR list in gallery.js)
for f in floor-planks-worn.webp floor-planks-worn--v2.webp floor-planks-worn--v3.webp floor-planks-worn--v4.webp; do put "$T/assets/flat/$f" "$DST/tex/$f"; done

# the set: models first, then the lighter files and the pictures, then the list that points at them
RS=(rsync -a --chmod=D755,F644)
link() { if [ -e "$2" ] && [ ! -L "$2" ]; then echo "deploy_set: $2 is a real file or folder, not replacing it with a link" >&2; return 1; fi; ln -sfn "$1" "$2"; }
if [ -e "$SET_DIR/models" ]; then
  REAL="$(readlink -f "$SET_DIR/models")"; MB=$(du -smL "$SET_DIR/models" 2>/dev/null | cut -f1); MB=${MB:-0}
  if [ "$LINK_ALL" = 1 ] || { [ "$LINK_MODELS" = 1 ] && { [ -L "$SET_DIR/models" ] || [ "$MB" -gt 300 ]; }; }; then
    [ -d "$DST/models" ] && [ ! -L "$DST/models" ] && rmdir "$DST/models" 2>/dev/null || true
    if link "$REAL" "$DST/models"; then MODELS="linked to $REAL"
      if [ -n "$(find "$REAL" -maxdepth 1 -name '*.glb' ! -perm -o=r -print -quit 2>/dev/null)" ]; then echo "deploy_set: WARNING some originals in $REAL are not readable by everyone; the web server will refuse them (chmod o+r)" >&2; fi
    else "${RS[@]}" -L "$SET_DIR/models/" "$DST/models/"; MODELS="copied (${MB} MB; the folder was already there)"; fi
  else mkdir -p "$DST/models"; "${RS[@]}" -L "$SET_DIR/models/" "$DST/models/"; MODELS="copied (${MB} MB)"; fi
else MODELS="none in the set"; fi
for d in tiers thumbs; do
  [ -e "$SET_DIR/$d" ] || continue
  if [ "$LINK_ALL" = 1 ]; then [ -d "$DST/$d" ] && [ ! -L "$DST/$d" ] && rmdir "$DST/$d" 2>/dev/null || true; link "$(readlink -f "$SET_DIR/$d")" "$DST/$d"
  else mkdir -p "$DST/$d"; "${RS[@]}" -L "$SET_DIR/$d/" "$DST/$d/"; fi
done
if [ "$LINK_ALL" = 1 ]; then link "$SET_DIR/manifest.json" "$DST/manifest.json"; else put "$SET_DIR/manifest.json" "$DST/manifest.json"; fi

# the page last: gallery.js under its stamp, then index.html, which is what points a browser at it
sed "s/__V__/$V/g" "$HERE/viewer/gallery.js" > "$DST/gallery.js.tmp-$V"; chmod 644 "$DST/gallery.js.tmp-$V"; mv -f "$DST/gallery.js.tmp-$V" "$DST/gallery.js"
sed "s/__V__/$V/g" "$HERE/viewer/gallery.html" > "$DST/index.html.tmp-$V"; chmod 644 "$DST/index.html.tmp-$V"; mv -f "$DST/index.html.tmp-$V" "$DST/index.html"
find "$DST" -type d -exec chmod 755 {} +; find "$DST" -type f ! -perm 644 -exec chmod 644 {} +
N=$(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))["figures"]))' "$SET_DIR/manifest.json")
echo "deployed gallery v=$V to $DST: $N figures from $SET_DIR; originals $MODELS ($(du -sh "$DST" 2>/dev/null | cut -f1) in the folder itself)"

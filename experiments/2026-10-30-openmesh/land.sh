#!/usr/bin/env bash
# Land openmesh on main, under the lock:   flock /tmp/tw-main.lock experiments/2026-10-30-openmesh/land.sh   (run the worktree's copy)
# (after experiments/2026-10-29-gamedice/land.sh) the batch's git-ignored binaries copied into main: the accepted source
# meshes (experiments/2026-10-30-openmesh/models, which build_data.py reads), and their runtime tier, LOD ladder and
# texture ladder (tools/spawn-tuner/assets/{m,lod,tex}, with the .owner notes). New names are copied; a name this batch
# REPLACES (targets.json `replaces`) is overwritten only while main's copy is still the replaced batch's (its .owner),
# never another batch's. Then: ff-only merge; the TUNER deploy (library, meshes, js) from main WITHOUT its line that copies
# engine/client/icons.js over ring/line-icons.js and without shipping ring/line-icons.js or the uncommitted
# ring/registry.json (others' work in progress); the client to DEV; the release candidate; push. Never live.
set -euo pipefail
W=$(cd "$(dirname "$0")/../.." && pwd); M=$TW_REPO
[[ $W != "$M" ]] || { echo "run the worktree's copy"; exit 1; }
LOG=$W/experiments/2026-10-30-openmesh/landing-$(date +%Y%m%d-%H%M%S).log; exec > >(tee -a "$LOG") 2>&1
cd "$M"
[[ $(git rev-parse --abbrev-ref HEAD) == main ]] || { echo "main checkout is not on main"; exit 1; }
git fetch -q origin
git merge-base --is-ancestor HEAD openmesh || { echo "openmesh is not a fast-forward of main: rebase it first"; exit 1; }
python3 - "$W" "$M" <<'PY'
import json, shutil, sys, hashlib
from pathlib import Path
W, M = Path(sys.argv[1]), Path(sys.argv[2]); E = 'experiments/2026-10-30-openmesh'
sys.path.insert(0, str(M / 'tools/spawn-tuner/prep')); from owner_guard import owner_key
T = {t['id']: t for t in json.loads((W / E / 'targets.json').read_text())}
ids = sorted(p.stem for p in (W / E / 'models').glob('*.glb'))
sha = lambda p: hashlib.sha1(p.read_bytes()).hexdigest()
plan = []
for i in ids:
    plan.append((W / E / 'models' / f'{i}.glb', M / E / 'models' / f'{i}.glb', None))
    rel = [f'tools/spawn-tuner/assets/m/{i}.glb', f'tools/spawn-tuner/assets/m/{i}.glb.owner'] + \
          [str(p.relative_to(W)) for p in sorted((W / 'tools/spawn-tuner/assets/lod').glob(f'*/{i}.glb'))] + \
          [str(p.relative_to(W)) for p in sorted((W / 'tools/spawn-tuner/assets/tex').glob(f'*/{i}.webp'))]
    for r in rel:
        src = W / r
        if src.is_symlink() or not src.exists(): sys.exit(f'REFUSING: {r} is not a file built here (run tools/runtime.sh)')
        plan.append((src, M / r, T[i].get('replaces') and owner_key(T[i]['replaces_glb'])))
n = {'new': 0, 'replaced': 0, 'same': 0}
for src, dst, was in plan:
    if dst.exists():
        if sha(src) == sha(dst): n['same'] += 1; continue
        own = dst.parent / (dst.name.split('.glb')[0] + '.glb.owner') if '/assets/m/' in str(dst) else None
        if not was: sys.exit(f'REFUSING: main has a different {dst} and this batch does not replace it')
        if own and own.exists() and own != dst:
            b = json.loads(own.read_text()).get('batch')
            if b not in (was, owner_key(str(W / E / 'models' / 'x.glb'))): sys.exit(f'REFUSING: {dst} now belongs to {b}, not {was}')
        n['replaced'] += 1
    else: n['new'] += 1
    dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(src, dst); dst.chmod(0o664)
print(f"binaries into main: {n} ({len(ids)} meshes)")
PY
git merge --ff-only openmesh
T=$(mktemp); trap 'rm -f "$T"' EXIT
grep -v 'cp "$SRC/../../engine/client/icons.js" "$SRC/ring/line-icons.js"' tools/spawn-tuner/deploy.sh | sed "s#rsync -aH --delete --exclude '\*.owner'#rsync -aH --delete --exclude ring/line-icons.js --exclude ring/registry.json --exclude '*.owner'#; s#^SRC=.*#SRC=$M/tools/spawn-tuner#; s#\"\$(dirname \"\$0\")/\.\./\.\./engine#\"\$SRC/../../engine#g" > "$T"
grep -q 'dirname "$0"' "$T" && { echo "the tuner deploy copy still uses its own path: not deploying the tuner"; exit 6; }
grep -q 'cp "$SRC/../../engine/client/icons.js"' "$T" && { echo "could not neutralise the line-icons copy: not deploying the tuner"; exit 6; }
grep -q 'exclude ring/registry.json' "$T" || { echo "could not exclude ring/registry.json: not deploying the tuner"; exit 6; }
bash "$T"
git diff --quiet -- tools/spawn-tuner/ring/line-icons.js || { echo "line-icons.js CHANGED (should not have)"; exit 7; }
D=/var/www/implausible-landing/projects/turnip-works/tuner
for s in floor-trapdoor-open--dressed-stone wall-window-small-open--temple-stone chest-treasure; do test -f "$D/assets/m/$s.glb" || { echo "the dev tuner lacks $s"; exit 8; }; done
grep -q '"floor-trapdoor-open"' "$D/data/library.json" || { echo "the dev tuner's library lacks the new twins"; exit 8; }
bad=$(find "$D" \( -type f ! -perm 644 \) -o \( -type d ! -perm 755 \) | head -3); [[ -z $bad ]] || { echo "dev tuner permissions: $bad"; exit 9; }
TW_LOCK_HELD=1 engine/deploy.sh
TW_LOCK_HELD=1 tools/release.sh candidate
GH_CONFIG_DIR=$HOME/.config/gh git push origin main
git log --oneline -3
echo "LANDED $(git rev-parse --short HEAD)"

#!/usr/bin/env bash
# Landing the cult sanctum, the second way (coordinator, 2026-10-12): main is never moved while tests run.
#   flock /tmp/tw-main.lock tools/land2.sh > land2.log 2>&1
# R = a throwaway worktree on branch clt-land (= origin/main + this type's commits). The data is built and every suite
# and gate runs THERE; only when all are green is main fast-forwarded to clt-land, the same data rebuilt in main,
# committed, deployed and pushed. main is not reset by this script: before the fast-forward it has not been touched.
set -uo pipefail
M=$TW_REPO; R=$TW_REPO; W=$TW_REPO
E=experiments/2026-10-11-types/clt
SLOT=/tmp/scratch/tw-slot
die() { echo "LAND FAILED: $*"; exit 1; }
export GH_CONFIG_DIR=$HOME/.config/gh

cd $M; git fetch -q origin || die "fetch"
[[ $(git rev-parse main) == $(git rev-parse origin/main) ]] || die "local main ($(git rev-parse --short main)) is not origin/main ($(git rev-parse --short origin/main))"
dirty=$(git status --short | grep -v '^??' | grep -v ' reviews/' || true); [[ -z $dirty ]] || die "main has uncommitted tracked edits: $dirty"
git -C $R merge-base --is-ancestor origin/main clt-land || { git -C $R merge -q origin/main -m "Merge origin/main into clt-land" || die "origin/main does not merge into clt-land: resolve in $R"; }
echo "origin/main $(git rev-parse --short origin/main), clt-land $(git -C $R rev-parse --short HEAD)"

# ---- the data pass, in tree $1 (the same commands for the throwaway tree and for main)
data_pass() {
  local D=$1 T=$1/tools/spawn-tuner
  cd $D
  python3 src/catalog_tool.py --fix-tags >/dev/null 2>&1; python3 src/catalog_tool.py --promote >/dev/null 2>&1; python3 src/catalog_tool.py > /tmp/clt-catalog.log 2>&1
  ! grep -q ERROR /tmp/clt-catalog.log || { grep ERROR /tmp/clt-catalog.log | head -3; return 1; }
  cd $T
  python3 build_data.py > /tmp/clt-build1.log 2>&1 || return 1
  $SLOT python3 prep/lod_tex.py > /tmp/clt-lodtex.log 2>&1 || return 1
  python3 prep/flats.py > /tmp/clt-flats.log 2>&1 || return 1
  python3 - <<'PY' || return 1
import json, subprocess
new = json.loads(subprocess.run(["git", "-C", "$TW_REPO", "show", "stash@{0}:tools/spawn-tuner/data/orient.json"], capture_output=True, text=True, check=True).stdout)
lib = json.load(open("data/library.json")); live = {s.get("mesh") for o in lib["objects"].values() for s in o["skus"]}
o = json.load(open("data/orient.json")); add = {k: v for k, v in new.items() if k.startswith("cult-01/") and k in live}
for s in lib["objects"].get("flavor-buttress", {}).get("skus", []):   # set by measurement: the pier goes to the wall
    if s["sku"] == "flavor-buttress--devils": add[s["mesh"]] = 90
    if s["sku"] == "flavor-buttress--spiders": add[s["mesh"]] = 180
o.update(add); json.dump(dict(sorted(o.items())), open("data/orient.json", "w"), indent=1); open("data/orient.json", "a").write("\n")
print("orient: cult-01 keys", len(add))
PY
  python3 build_data.py > /tmp/clt-build2.log 2>&1 || return 1
  cd $D; python3 engine/tools/build_types.py | tail -1
}

# ---- stage 1: the throwaway tree. Everything git ignores is linked in from main (and this type's own from the worktree)
cd $R
python3 - <<'PY' || die "links"
import os, subprocess
M='$TW_REPO'; R='$TW_REPO'; W='$TW_REPO'
def link(src, sub):
    n = 0
    for f in subprocess.run(['git', '-C', src, 'ls-files', '-o', '-i', '--exclude-standard', '--', sub], capture_output=True, text=True).stdout.split('\n'):
        d = os.path.join(R, f)
        if not f or os.path.lexists(d): continue
        os.makedirs(os.path.dirname(d), exist_ok=True); os.symlink(os.path.join(src, f), d); n += 1
    return n
print('linked', link(W, 'experiments/2026-10-11-types/clt/models') + link(W, 'experiments/2026-10-11-types/clt/flats'), 'of this type,', link(M, 'experiments') + link(M, 'engine/client/data'), 'of main')
for a, b in ((M + '/tools/spawn-tuner/assets', R + '/tools/spawn-tuner/assets'), (M + '/engine/node_modules', R + '/engine/node_modules')):
    if not os.path.lexists(b): os.symlink(a, b)
PY
rsync -a $M/reviews/ $R/reviews/      # the ratings main's build reads (uncommitted, live)
cp -n $W/$E/flats/icons/room-cult-*.png $R/engine/client/data/icons/ 2>/dev/null
data_pass $R || die "data pass in the throwaway tree"
T=$R/tools/spawn-tuner
$SLOT node $T/test/cult.test.mjs $T > /tmp/clt-test.log 2>&1 || { tail -12 /tmp/clt-test.log | cut -c1-200; die "cult.test"; }; tail -1 /tmp/clt-test.log
node $T/test/golden.mjs $M/tools/spawn-tuner $T > /tmp/clt-golden.log 2>&1; grep -q "^golden: " /tmp/clt-golden.log || { tail -5 /tmp/clt-golden.log | cut -c1-200; die "golden did not run"; }
tail -n +1 /tmp/clt-golden.log | grep -E "^golden|differ" | cut -c1-200
# allowed to change: the temple's rooms (back to their own flavor where main's library let them draw the cult's flats), the Dark
# cathedral (it lists the evil flavors and now has devils), the cult's own rooms. Nothing else.
bad=$(grep -E "^  [a-z0-9-]+: [0-9]+ differ" /tmp/clt-golden.log | grep -vE "^  (cathedral-dark|cathedral|temple-[a-z]+|cult-[a-z]+):" || true); [[ -z $bad ]] || { echo "$bad" | head; die "golden: rooms other than the temple's and the cult's changed"; }
for t in solver solver2 yard repeat zones stable stacks focal wall_items logcabin wallkit anim crypt castle mansion tem; do [[ -f $T/test/$t.test.mjs ]] || continue; ( cd $T && node test/$t.test.mjs $( [[ $t =~ ^(crypt|castle|mansion|tem)$ ]] && echo . ) > /tmp/clt-t-$t.log 2>&1 ) || { tail -4 /tmp/clt-t-$t.log | cut -c1-200; die "tuner suite $t"; }; done; echo "tuner node suites ok"
( cd $R && node engine/test/core.test.mjs > /tmp/clt-core.log 2>&1 ) || { tail -6 /tmp/clt-core.log | cut -c1-200; die "core.test"; }; tail -1 /tmp/clt-core.log
( cd $R && python3 tools/tool-sweep/sku_guard.py > /tmp/clt-guard.log 2>&1 ) || { tail -5 /tmp/clt-guard.log | cut -c1-200; die "sku_guard"; }
( cd $R && python3 $T/test/assets_check.py --quiet > /tmp/clt-assets.log 2>&1 ) || { tail -8 /tmp/clt-assets.log | cut -c1-200; die "assets_check"; }
echo "STAGE 1 GREEN (throwaway tree)"
[[ ${STAGE:-ALL} == 1 ]] && exit 0

# ---- stage 2: main moves, once, by fast-forward
cd $M
git merge -q --ff-only clt-land || die "main does not fast-forward to clt-land"
mkdir -p $M/$E/models $M/$E/flats/seamless $M/$E/flats/decals $M/$E/flats/icons
rsync -a $W/$E/models/ $M/$E/models/; for d in seamless decals icons; do rsync -a $W/$E/flats/$d/ $M/$E/flats/$d/; done
cp $W/$E/flats/icons/room-cult-*.png $M/engine/client/data/icons/
data_pass $M || die "data pass in main (main is at clt-land, data not committed: run the pass again)"
( cd $M/tools/spawn-tuner && $SLOT python3 prep/fire_anchors.py > /tmp/clt-fire.log 2>&1 && python3 build_data.py > /dev/null 2>&1 ) || echo "(fire anchors step failed: the bench sets them)"
python3 tools/spawn-tuner/test/assets_check.py --quiet > /tmp/clt-assets2.log 2>&1 || { tail -8 /tmp/clt-assets2.log | cut -c1-200; die "assets_check in main"; }
T=$M/tools/spawn-tuner
git add catalog $T/data/library.json $T/data/rooms.json $T/data/orient.json $T/data/fire_anchors.json $T/prep/flats.json $T/prep/flats-out.json $T/prep/tex-ladder.json engine/client/data/types.json
git commit -q -m "Cult sanctum: library, rooms, flats and orientation data rebuilt with the flavor fix (cult-01, cult-flats-01); catalog tags; types.json

A flavor slot role asked for without a flavor now stays inside the room type's own list, so temple rooms draw only sun
and moon pieces again (main's library had let them draw the cult's devil and spider flats). The Dark cathedral, which
lists the evil flavors, is dressed with devils: its golden scenes change by design. Golden against main before this:
only temple, cathedral and cult rooms differ.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <session>" || die "data commit"
git log --oneline -1 | cat
tools/spawn-tuner/deploy.sh > /tmp/clt-deploy-tuner.log 2>&1 || { tail -8 /tmp/clt-deploy-tuner.log | cut -c1-240; die "tuner deploy (main is committed, not pushed)"; }; grep -i "deployed\|NOT\|FAILED\|coverage" /tmp/clt-deploy-tuner.log | cut -c1-200
engine/deploy.sh --no-relay > /tmp/clt-deploy-engine.log 2>&1 || { tail -8 /tmp/clt-deploy-engine.log | cut -c1-240; die "engine deploy (main is committed, not pushed)"; }; tail -2 /tmp/clt-deploy-engine.log | cut -c1-200
python3 $T/test/assets_check.py --live 2>&1 | tail -2 | cut -c1-200
python3 tools/tool-sweep/check.py 2>&1 | tail -2 | cut -c1-200
left=$(git status --short | grep -v '^??' | grep -v ' reviews/' || true); [[ -z $left ]] || { echo "left dirty by the deploy: $left"; git add -u -- engine/client/data tools/spawn-tuner/data tools/spawn-tuner/prep 2>/dev/null; git commit -q -m "Cult sanctum: files the deploy rewrote" || true; }
git push -q origin main 2>&1 | tail -2 || die "push"
git fetch -q origin; echo "main $(git log --oneline -1 main | cut -c1-60) | origin/main $(git rev-parse --short origin/main)"
echo "LAND DONE"

#!/usr/bin/env bash
# THE TABLE'S MUSIC (2026-10-30; client/music.js, docs/UI.md "Music"). Harry's seven tracks, made for Turnip Works, as
# small web copies: Opus in WebM (every current browser) and AAC in .m4a (the Safari fallback), each two-pass
# loudness-normalised to -18 LUFS integrated (true peak -1.5 dBTP) so the tracks sit together, plus tracks.json (id,
# name, seconds, files) that the game reads. Not in git (*.webm is ignored; the folder is ignored too, as every
# generated binary): engine/deploy.sh runs this when the files are missing, and a release copies them from the dev tree.
# The masters (m4a, Harry 2026-10-30, SHA256SUMS beside them) stay on the USB disk and are never shipped.
# LICENCE NOT YET CONFIRMED (2026-10-30): Harry has not said where the tracks come from or under what licence. Until he
# does they stay out of the public repo export (tools/public-export/exclude.tsv) and out of the CC BY library.
#   engine/tools/build_music.sh [--force]
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
M=${TW_MUSIC_MASTERS:-/mnt/usb/turnip-works/music/harry-2026-10-30}
O="$SRC/client/data/music"
# id | display name (his typos fixed) | master file
TRACKS=(
  "wizards-roots|The Wizard's Roots|The_Wizards_Roots.m4a"
  "buried-in-the-earth|Buried in the Earth|Burried_in_the_earth.m4a"
  "hymn-of-the-radiant-path|Hymn of the Radiant Path|Hymn_of_the_Radiant_Path.m4a"
  "turnip-castle|The Turnip Castle|The_Turnip_castle.m4a"
  "black-mass|The Black Mass|The_Black_Mass.m4a"
  "in-the-dark-soil|In the Dark Soil|In_the_Dark_soil.m4a"
  "tasty-turnip|The Tasty Turnip|The_Tastey_Turnip.m4a"
)
have() { for t in "${TRACKS[@]}"; do local id=${t%%|*}; [[ -s "$O/$id.webm" && -s "$O/$id.m4a" ]] || return 1; done; [[ -s "$O/tracks.json" ]]; }
if [[ "${1:-}" != "--force" ]] && have; then echo "music: present ($(du -shL "$O" | cut -f1), ${#TRACKS[@]} tracks)"; exit 0; fi
[[ -d "$M" ]] || { echo "music: the masters are not at $M (TW_MUSIC_MASTERS)"; exit 1; }
( cd "$M" && sha256sum -c --quiet SHA256SUMS ) || { echo "music: the masters do not match their SHA256SUMS"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$O"
LN="I=-18:TP=-1.5:LRA=11"
json="["
for t in "${TRACKS[@]}"; do
  IFS='|' read -r id name file <<<"$t"
  in="$M/$file"
  # pass 1: measure
  ffmpeg -hide_banner -nostats -i "$in" -af "loudnorm=$LN:print_format=json" -f null - 2>"$T/m.txt"
  read -r mi mtp mlra mth off < <(python3 -c '
import json,re,sys
s=open(sys.argv[1]).read(); j=json.loads(s[s.rindex("{"):s.rindex("}")+1])
print(j["input_i"],j["input_tp"],j["input_lra"],j["input_thresh"],j["target_offset"])' "$T/m.txt")
  AF="loudnorm=$LN:measured_I=$mi:measured_TP=$mtp:measured_LRA=$mlra:measured_thresh=$mth:offset=$off:linear=true,aresample=48000"
  # pass 2: the two web copies (no video, no cover art, no metadata but the title)
  ffmpeg -v error -y -i "$in" -map 0:a:0 -vn -af "$AF" -c:a libopus -b:a 80k -vbr on -application audio -map_metadata -1 -metadata title="$name" "$T/$id.webm"
  ffmpeg -v error -y -i "$in" -map 0:a:0 -vn -af "$AF" -c:a aac -b:a 112k -map_metadata -1 -metadata title="$name" -movflags +faststart "$T/$id.m4a"
  sec=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$T/$id.webm")
  out=$(ffmpeg -hide_banner -nostats -i "$T/$id.webm" -af "loudnorm=$LN:print_format=json" -f null - 2>&1 | python3 -c 'import json,sys; s=sys.stdin.read(); print(json.loads(s[s.rindex("{"):s.rindex("}")+1])["input_i"])')
  install -m 644 "$T/$id.webm" "$O/$id.webm"; install -m 644 "$T/$id.m4a" "$O/$id.m4a"
  echo "music: $id  master ${mi} LUFS -> ${out} LUFS  $(du -h "$O/$id.webm" | cut -f1) webm, $(du -h "$O/$id.m4a" | cut -f1) m4a, ${sec}s"
  json+=$(python3 -c 'import json,sys; print(json.dumps({"id":sys.argv[1],"name":sys.argv[2],"sec":round(float(sys.argv[3]),2),"lufs":float(sys.argv[4]),"webm":sys.argv[1]+".webm","m4a":sys.argv[1]+".m4a"}))' "$id" "$name" "$sec" "$out")","
done
json="${json%,}]"
python3 -c 'import json,sys; L=json.loads(sys.argv[1]); open(sys.argv[2],"w").write(json.dumps({"v":1,"source":"Harry, 2026-10-30 (licence not yet confirmed)","target_lufs":-18,"tracks":L},indent=1)+"\n")' "$json" "$T/tracks.json"
install -m 644 "$T/tracks.json" "$O/tracks.json"
chmod 755 "$O"
echo "music: built ${#TRACKS[@]} tracks in $O ($(du -shL "$O" | cut -f1))"

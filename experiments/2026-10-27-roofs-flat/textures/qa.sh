#!/bin/bash
# qa.sh S [TAG] : single + 3x3 + 3x3@256 sheets of seamless/roof-flat--S.png -> Gemini blind read via agy-run (one at a time, flock)
cd "$(dirname "$0")"; n=$1; tag=${2:-$1}; f=seamless/roof-flat--$n.png; [ -f raw/rolls/$tag.png ] && f=raw/rolls/$tag.png
python3 - "$f" raw/checks/$tag <<'PY'
import sys; from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); o = sys.argv[2]; t = im.resize((512, 512), Image.LANCZOS); s = Image.new('RGB', (1536, 1536))
for i in range(9): s.paste(t, (i % 3 * 512, i // 3 * 512))
im.save(o + '-single.jpg', quality=92); s.save(o + '-3x3.jpg', quality=92); s.resize((256, 256), Image.LANCZOS).save(o + '-3x3-256.jpg', quality=92)
PY
d=$(mktemp -d /tmp/roofqa-XXXX); cp raw/checks/$tag-single.jpg $d/image-1.jpg; cp raw/checks/$tag-3x3.jpg $d/image-2.jpg; cp raw/checks/$tag-3x3-256.jpg $d/image-3.jpg
flock /tmp/agy.lock $HOME/fauna-tools/agy-run -C $d -t 300 -o raw/gemini-v2/$tag.blind.txt < raw/prompts/roof-blind.txt
rm -rf $d; cat raw/gemini-v2/$tag.blind.txt

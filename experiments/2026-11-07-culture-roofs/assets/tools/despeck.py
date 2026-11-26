#!/usr/bin/env python3
"""Take small high-contrast marks (painted specks that read as lettering or graffiti) out of a PLAIN surface's colour texture
inside a GLB: a pixel that differs from its 11 x 11 median by more than THR (and is not in the atlas's black gutter) takes
the median. Everything else in the file is kept byte for byte (JSON, geometry, other images).
    python3 tools/despeck.py IN.glb OUT.glb [THR=38]"""
import io, json, struct, sys
import numpy as np
from PIL import Image
from scipy import ndimage
src, dst = sys.argv[1], sys.argv[2]; thr = float(sys.argv[3]) if len(sys.argv) > 3 else 38
b = open(src, 'rb').read(); jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl]); bl = struct.unpack('<I', b[20 + jl:24 + jl])[0]; bin_ = bytearray(b[28 + jl:28 + jl + bl])
m = j['materials'][0]['pbrMetallicRoughness']; t = j['textures'][m['baseColorTexture']['index']]
img = t.get('source', (t.get('extensions') or {}).get('EXT_texture_webp', {}).get('source')); bvi = j['images'][img]['bufferView']; bv = j['bufferViews'][bvi]
o = bv.get('byteOffset', 0); raw = bytes(bin_[o:o + bv['byteLength']]); fmt = j['images'][img]['mimeType']
a = np.asarray(Image.open(io.BytesIO(raw)).convert('RGB')).astype(float)
med = np.stack([ndimage.median_filter(a[..., c], size=11) for c in range(3)], -1)
dev = np.abs(a - med).max(axis=2); live = med.sum(axis=2) > 60; fix = (dev > thr) & live
fix = ndimage.binary_dilation(fix, iterations=1) & live
out = np.where(fix[..., None], med, a)
print(f'{src}: {fix.mean():.2%} of texels replaced (dev > {thr}); deviant texels left {((np.abs(out - med).max(axis=2) > thr) & live).mean():.2%}')
f = io.BytesIO(); Image.fromarray(out.astype(np.uint8)).save(f, 'WEBP' if 'webp' in fmt else 'PNG', **({'quality': 92} if 'webp' in fmt else {})); new = f.getvalue()
# rebuild the binary chunk: the image's bufferView gets the new bytes, every later view shifts by the difference (4-aligned)
d = len(new) - bv['byteLength']; pad = (-d) % 4; d += pad
bin2 = bytes(bin_[:o]) + new + b'\0' * pad + bytes(bin_[o + bv['byteLength']:])
bv['byteLength'] = len(new)
for k, v in enumerate(j['bufferViews']):
    if k != bvi and v.get('byteOffset', 0) > o: v['byteOffset'] = v.get('byteOffset', 0) + d
j['buffers'][0]['byteLength'] = len(bin2)
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4); bin2 += b'\0' * ((-len(bin2)) % 4)
open(dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin2)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(bin2), 0x004E4942) + bin2)
print('wrote', dst)

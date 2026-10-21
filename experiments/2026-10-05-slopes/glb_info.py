#!/usr/bin/env python3
"""Triangle count, double-sided flag and base-colour texture health (share of black and of unpainted texels) of GLBs.
    python3 glb_info.py fal/models/*.glb"""
import json, struct, sys, io
import numpy as np
from PIL import Image
def info(f):
    b = open(f, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + n]); off = 20 + n + 8
    t = j['textures'][j['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]
    im = j['images'][t.get('source', (t.get('extensions') or {}).get('EXT_texture_webp', {}).get('source', 0))]
    bv = j['bufferViews'][im['bufferView']]; d = b[off + bv.get('byteOffset', 0):][:bv['byteLength']]
    a = np.asarray(Image.open(io.BytesIO(d)).convert('RGBA')).reshape(-1, 4).astype(float)
    p = j['meshes'][0]['primitives'][0]
    return {"tris": j['accessors'][p['indices']]['count'] // 3, "double_sided": bool(j['materials'][0].get('doubleSided')),
            "tex_black_share": round(float((a[:, :3].max(1) < 12).mean()), 3), "tex_unpainted_share": round(float((a[:, 3] < 8).mean()), 3), "mb": round(len(b) / 1e6, 1)}
if __name__ == "__main__":
    for f in sys.argv[1:]: print(f, info(f))

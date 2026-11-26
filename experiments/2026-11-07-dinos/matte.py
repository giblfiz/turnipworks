#!/usr/bin/env python3
"""MATTE THE METAL (2026-11-07): TRELLIS.2 estimates a PBR metal/roughness map with each mesh, and for two of these it
made the whole creature METAL (spinosaurus: metal channel 252/255 on average; velociraptor 157; the set's tyrannosaur 13).
A metallic surface with no environment to reflect renders near-black in the game (a blind read: "rendered solid black").
The house style is matte, so a mesh whose mean metalness is over LIMIT gets glTF metallicFactor = TARGET / mean (metal =
factor x texture), bringing it to the set's own level. Lossless: only the GLB's JSON chunk changes (written in place, so
hard links follow). Reports every mesh; changes only those over LIMIT.
    ~/.local/share/tw-trimesh-venv/bin/python matte.py GLB [GLB ...]   [--check]"""
import io, json, struct, sys
import numpy as np
from PIL import Image
LIMIT, TARGET = 100, 15


def read(p):
    b = open(p, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]
    return json.loads(b[20:20 + n]), b, n


def tex(j, b, n, idx):
    t = j['textures'][idx]; src = t.get('source', next((e.get('source') for e in t.get('extensions', {}).values() if 'source' in e), None))
    bv = j['bufferViews'][j['images'][src]['bufferView']]; o = 20 + n + 8 + bv.get('byteOffset', 0)
    return Image.open(io.BytesIO(b[o:o + bv['byteLength']]))


def write(p, j, b, n):
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
    rest = b[20 + n:]                                       # the BIN chunk (header + data), untouched
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + len(rest)) + struct.pack('<II', len(js), 0x4E4F534A) + js + rest
    with open(p, 'r+b') as f: f.seek(0); f.write(out); f.truncate()


for p in [a for a in sys.argv[1:] if not a.startswith('--')]:
    j, b, n = read(p); changed = []
    for k, m in enumerate(j.get('materials', [])):
        pbr = m.setdefault('pbrMetallicRoughness', {}); mr = pbr.get('metallicRoughnessTexture')
        if mr is None: continue
        metal = float(np.asarray(tex(j, b, n, mr['index']).convert('RGB'))[:, :, 2].mean()) * pbr.get('metallicFactor', 1.0)
        if metal > LIMIT: pbr['metallicFactor'] = round(TARGET / (metal / pbr.get('metallicFactor', 1.0)), 4); changed.append((k, round(metal), pbr['metallicFactor']))
        print(f"{p.split('/')[-1]}: material {k} mean metal {metal:.0f}{' -> factor ' + str(pbr['metallicFactor']) if metal > LIMIT else ' (left)'}")
    if changed and '--check' not in sys.argv: write(p, j, b, n)

#!/usr/bin/env python3
"""Turn a mesh about the vertical axis IN PLACE (positions and normals rewritten in the GLB's buffer; textures, UVs and
indices untouched), for sound meshes that came back lying diagonally in their box (tools/qa_yaw.py).
    python3 tools/glb_yaw.py TYPE_DIR sku[:DEG] ...      DEG omitted = the yaw_deg of qa-extra/yaw.json
The file as harvested is kept once in TYPE_DIR/models-asmeshed/<sku>.glb. Only single-buffer GLBs with float32 VEC3
POSITION / NORMAL accessors and no node transform (what the TRELLIS exporter writes)."""
import json, struct, sys, shutil
from pathlib import Path
import numpy as np
T = Path(sys.argv[1]); yaw = json.loads((T / "qa-extra" / "yaw.json").read_text()) if (T / "qa-extra" / "yaw.json").exists() else {}
for arg in sys.argv[2:]:
    sku, _, d = arg.partition(":"); deg = float(d) if d else yaw[sku]["yaw_deg"]
    p = T / "models" / f"{sku}.glb"; keep = T / "models-asmeshed" / p.name; keep.parent.mkdir(exist_ok=True)
    if not keep.exists(): shutil.copy2(p, keep)
    b = p.read_bytes(); n = struct.unpack("<I", b[12:16])[0]; j = json.loads(b[20:20 + n]); bo = 20 + n + 8; bn = struct.unpack("<I", b[20 + n:24 + n])[0]
    buf = bytearray(b[bo:bo + bn])
    assert len(j["buffers"]) == 1 and all(not any(k in nd for k in ("rotation", "matrix", "translation", "scale")) for nd in j["nodes"]), "node transforms: not handled"
    c, s = np.cos(np.radians(deg)), np.sin(np.radians(deg))
    done = set()
    for mesh in j["meshes"]:
        for pr in mesh["primitives"]:
            for name in ("POSITION", "NORMAL"):
                ai = pr["attributes"].get(name)
                if ai is None or ai in done: continue
                done.add(ai); a = j["accessors"][ai]; bv = j["bufferViews"][a["bufferView"]]
                assert a["componentType"] == 5126 and a["type"] == "VEC3" and not bv.get("byteStride")
                off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
                v = np.frombuffer(buf, dtype="<f4", count=a["count"] * 3, offset=off).reshape(-1, 3).copy()
                x, z = v[:, 0].copy(), v[:, 2].copy()
                v[:, 0], v[:, 2] = x * c + z * s, -x * s + z * c          # the rotation qa_yaw.py measured (a proper rotation: winding unchanged)
                buf[off:off + v.nbytes] = v.astype("<f4").tobytes()
                if name == "POSITION": a["min"], a["max"] = [float(t) for t in v.min(0)], [float(t) for t in v.max(0)]
    js = json.dumps(j, separators=(",", ":")).encode(); js += b" " * (-len(js) % 4)
    out = b"glTF" + struct.pack("<II", 2, 12 + 8 + len(js) + 8 + len(buf)) + struct.pack("<I", len(js)) + b"JSON" + js + struct.pack("<I", len(buf)) + b"BIN\x00" + bytes(buf)
    p.write_bytes(out); print(f"{sku}: turned {deg:g} deg about the vertical axis; box now {[round(float(t), 3) for t in np.array(j['accessors'][pr['attributes']['POSITION']]['max']) - np.array(j['accessors'][pr['attributes']['POSITION']]['min'])]}")

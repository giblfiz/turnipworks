#!/usr/bin/env python3
"""Fetch a Poly Haven model (CC0) and pack its .gltf + .bin + textures into one GLB for the Import Lab samples.

  python3 prep/pack_polyhaven.py garden_gnome 2k   ->  samples/garden-gnome.glb

Poly Haven assets are CC0 (https://polyhaven.com/license). Credit is not required; we give it anyway (README.md).
"""
import json
import pathlib
import struct
import sys
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent.parent
UA = {"User-Agent": "turnip-works-import-lab/0.1 (sample prep)"}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()


def main(asset, res):
    files = json.loads(get(f"https://api.polyhaven.com/files/{asset}"))["gltf"][res]["gltf"]
    info = json.loads(get(f"https://api.polyhaven.com/info/{asset}"))
    gltf = json.loads(get(files["url"]))
    inc = {k: get(v["url"]) for k, v in files["include"].items()}
    blob = bytearray()
    for b in gltf["buffers"]:
        assert len(gltf["buffers"]) == 1
        blob += inc[b["uri"]]
    while len(blob) % 4: blob += b"\0"
    for img in gltf.get("images", []):
        data = inc[img.pop("uri")]
        gltf["bufferViews"].append({"buffer": 0, "byteOffset": len(blob), "byteLength": len(data)})
        img["bufferView"] = len(gltf["bufferViews"]) - 1
        img["mimeType"] = "image/jpeg" if data[:2] == b"\xff\xd8" else "image/png"
        blob += data
        while len(blob) % 4: blob += b"\0"
    gltf["buffers"] = [{"byteLength": len(blob)}]
    authors = ", ".join(info.get("authors", {}).keys())
    gltf["asset"]["copyright"] = f"{info.get('name', asset)} by {authors}, Poly Haven, CC0"
    js = json.dumps(gltf, separators=(",", ":")).encode(); js += b" " * (-len(js) % 4)
    out = HERE / "samples" / f"{asset.replace('_', '-')}.glb"
    with open(out, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(js) + 8 + len(blob)))
        f.write(struct.pack("<I4s", len(js), b"JSON")); f.write(js)
        f.write(struct.pack("<I4s", len(blob), b"BIN\0")); f.write(blob)
    print(out, len(blob) + len(js), "bytes;", info.get("name"), "by", authors, "; polycount", info.get("polycount"))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "2k")

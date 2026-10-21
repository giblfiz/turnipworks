#!/usr/bin/env python3
"""Matte concept plates with the official MIT BiRefNet (pinned) and score each matte.

Usage: python src/birefnet_matte.py INPUT_DIR OUTPUT_DIR [--ids a,b,c] [--overwrite]
Runs on the local GPU (the build box RTX 3060) from the tw-birefnet venv:
  python3 src/birefnet_matte.py ...

Output per plate: OUTPUT_DIR/<id>.png (RGBA, full plate resolution, colour zeroed under alpha 0) and a
record in OUTPUT_DIR/matte-manifest.json with quality metrics used by the mask gate:
  fg        fraction of pixels with alpha > 0.5
  soft      fraction of pixels with 0.1 < alpha < 0.9 (large = mushy matte)
  comps     connected foreground components holding >= 0.5% of the foreground (1 = one clean object)
  border    fraction of the 1-px image border that is foreground (object cut by the frame, or background kept)
  chroma_iou  IoU between the BiRefNet matte and a chroma-blue key when the plate border is chroma blue
              (low IoU = the two disagree; usually BiRefNet dropped a part or kept a cast shadow)
  verdict   pass | review (soft thresholds) | fail (hard thresholds)
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image
from torchvision import transforms

REPO = "ZhengPeng7/BiRefNet"
REVISION = "e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4"  # MIT, pinned 2026-10-02
SIZE = 1024


def load_model():
    from transformers import AutoModelForImageSegmentation

    model = AutoModelForImageSegmentation.from_pretrained(REPO, revision=REVISION, trust_remote_code=True)
    model.to("cuda").eval().half()
    return model


TF = transforms.Compose([
    transforms.Resize((SIZE, SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def chroma_alpha(bgr):
    h, w = bgr.shape[:2]
    edge = max(4, min(h, w) // 64)
    border = np.concatenate((bgr[:edge].reshape(-1, 3), bgr[-edge:].reshape(-1, 3),
                             bgr[:, :edge].reshape(-1, 3), bgr[:, -edge:].reshape(-1, 3)))
    bg = np.median(border, axis=0)
    if not (bg[0] > bg[1] * 1.25 and bg[0] > bg[2] * 1.5):
        return None
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    bg_lab = cv2.cvtColor(bg.reshape(1, 1, 3).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)[0, 0]
    d = np.linalg.norm(lab - bg_lab, axis=2)
    return np.clip((d - 12.0) / 24.0, 0.0, 1.0)


def refine_with_chroma(alpha, bgr, min_area=150):
    """BiRefNet tends to keep background trapped inside closed shapes (handle loops, between bars, inside window
    frames). Where the plate border is chroma blue, cut every sizeable connected region that is plainly the chroma
    background colour. Returns (alpha, pixels_removed)."""
    ca = chroma_alpha(bgr)
    if ca is None:
        return alpha, 0
    bg = (ca < 0.15).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(bg, 4)
    keep = np.zeros(n, bool)
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= min_area
    cut = keep[labels]
    cut = cv2.dilate(cut.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (ca < 0.5)
    removed = int((cut & (alpha > 0.5)).sum())
    out = alpha.copy()
    out[cut] = 0
    return out, removed


def score(alpha, bgr):
    fg = alpha > 0.5
    rec = {"fg": round(float(fg.mean()), 4), "soft": round(float(((alpha > 0.1) & (alpha < 0.9)).mean()), 4)}
    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg.astype(np.uint8), 8)
    total = max(1, int(fg.sum()))
    rec["comps"] = int(sum(1 for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= 0.005 * total))
    ring = np.concatenate((fg[0], fg[-1], fg[:, 0], fg[:, -1]))
    rec["border"] = round(float(ring.mean()), 4)
    ca = chroma_alpha(bgr)
    if ca is not None:
        cf = ca > 0.5
        rec["chroma_iou"] = round(float((cf & fg).sum() / max(1, (cf | fg).sum())), 4)
    fails, reviews = [], []
    if rec["fg"] < 0.02:
        fails.append("empty matte")
    if rec["fg"] > 0.85:
        fails.append("matte kept the background")
    if rec["border"] > 0.08:
        fails.append("object cut by frame / background kept")
    if rec.get("chroma_iou", 1) < 0.80:
        fails.append(f"BiRefNet vs chroma disagree (IoU {rec.get('chroma_iou')})")
    elif rec.get("chroma_iou", 1) < 0.92:
        reviews.append(f"BiRefNet vs chroma IoU {rec.get('chroma_iou')}")
    if rec["comps"] > 3:
        reviews.append(f"{rec['comps']} separate pieces")
    if rec["soft"] > 0.06:
        reviews.append(f"soft matte {rec['soft']}")
    rec["verdict"] = "fail" if fails else ("review" if reviews else "pass")
    rec["why"] = fails + reviews
    return rec


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input_dir", type=Path)
    ap.add_argument("output_dir", type=Path)
    ap.add_argument("--ids", help="comma-separated plate ids (default: every *.jpg)")
    ap.add_argument("--overwrite", action="store_true")
    a = ap.parse_args()
    a.output_dir.mkdir(parents=True, exist_ok=True)
    man_path = a.output_dir / "matte-manifest.json"
    manifest = json.loads(man_path.read_text()) if man_path.exists() else {"model": REPO, "revision": REVISION, "assets": {}}
    wanted = set(a.ids.split(",")) if a.ids else None
    plates = [p for p in sorted(a.input_dir.glob("*.jpg")) if wanted is None or p.stem in wanted]
    model = None
    for p in plates:
        out = a.output_dir / f"{p.stem}.png"
        if out.exists() and not a.overwrite and p.stem in manifest["assets"]:
            continue
        if model is None:
            model = load_model()
        img = Image.open(p).convert("RGB")
        with torch.no_grad():
            x = TF(img).unsqueeze(0).to("cuda").half()
            pred = model(x)[-1].sigmoid()[0, 0].float().cpu().numpy()
        alpha = cv2.resize(pred, img.size, interpolation=cv2.INTER_LINEAR)
        alpha = np.clip(alpha, 0, 1)
        bgr = cv2.cvtColor(np.asarray(img), cv2.COLOR_RGB2BGR)
        rec = score(alpha, bgr)
        a8 = (alpha * 255).astype(np.uint8)
        rgba = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
        rgba[:, :, 3] = a8
        rgba[a8 == 0, :3] = 0
        cv2.imwrite(str(out), rgba, [cv2.IMWRITE_PNG_COMPRESSION, 6])
        manifest["assets"][p.stem] = rec
        print(p.stem, rec["verdict"], rec["why"], flush=True)
        man_path.write_text(json.dumps(manifest, indent=1) + "\n")
    man_path.write_text(json.dumps(manifest, indent=1) + "\n")
    v = [r["verdict"] for r in manifest["assets"].values()]
    print(json.dumps({"total": len(v), "pass": v.count("pass"), "review": v.count("review"), "fail": v.count("fail")}))


if __name__ == "__main__":
    main()

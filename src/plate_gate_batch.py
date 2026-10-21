#!/usr/bin/env python3
"""Plate factory with gates, in the corrected inn-01 order:
plate candidate -> semantic gate (Gemini vision) -> reroll up to N times -> BiRefNet matte -> mask gate
(metrics + Gemini vision on the cut-out; chroma key as the fallback matte) -> RGBA ready for TRELLIS.

Run from the tw-birefnet venv (it needs torch + the BiRefNet deps):
  python3 src/plate_gate_batch.py experiments/inn-02 [--ids a,b] [--workers 6]

Reads <run>/assets.json: {"assets": [{id, prompt, refs: [paths], gate: {desc, must: [], must_not: []}, ...}]}.
  prompt  the complete Gemini image prompt (style template already applied)
  refs    reference images (style plate, or the closed plate an open version is edited from)
  gate    what the vision gate checks: desc = what the object must be; must / must_not = extra criteria
Writes <run>/inputs/<id>.jpg (accepted plate), <run>/masked/<id>.png (accepted RGBA), <run>/rejected/<id>.tryN.*,
and <run>/gate-manifest.json (every attempt, verdicts, reasons, token usage). Resumable: accepted ids are skipped.
"""

from __future__ import annotations

import argparse
import base64
import concurrent.futures
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import birefnet_matte as bm  # noqa: E402

GATE_MODEL = "gemini-3.8-flash"
IMAGE_COST = 0.039  # USD per 1K image, gemini-3.1-flash-image (inn-01b observed ~$20 / 494 plates)
LOCK = threading.Lock()
GPU = threading.Lock()
MODEL = None
IMAGE_MODEL = None  # --image-model: e.g. gemini-3-pro-image for hard edits (open doors)


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


def vision(parts: list, schema_hint: str, retries: int = 3) -> tuple[dict, dict]:
    body = {"contents": [{"role": "user", "parts": parts + [{"text": schema_hint}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GATE_MODEL}:generateContent"
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST", headers={
                "Content-Type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]})
            with urllib.request.urlopen(req, timeout=180) as r:
                out = json.load(r)
            text = "".join(p.get("text", "") for p in out["candidates"][0]["content"]["parts"])
            return json.loads(text), out.get("usageMetadata", {})
        except (urllib.error.URLError, KeyError, json.JSONDecodeError, TimeoutError) as exc:
            if attempt == retries:
                raise RuntimeError(f"vision gate failed: {exc}") from exc
            time.sleep(5 * (attempt + 1))
    raise AssertionError


def img_part(path: Path, label: str) -> list:
    mime = "image/png" if path.suffix == ".png" else "image/jpeg"
    return [{"inline_data": {"mime_type": mime, "data": b64(path)}}, {"text": f"[above: {label}]"}]


def semantic_gate(asset: dict, plate: Path) -> tuple[dict, dict]:
    """Two steps, so the judge is never primed (Harry 2026-10-02: "describe this object to me", not "is this a sandwich").
    1. BLIND: the vision model describes the candidate without being told what it should be.
    2. MATCH: a text-only call compares that description (plus any reference-match notes) with the spec."""
    g = asset["gate"]
    parts = img_part(plate, "CANDIDATE image")
    for ref in asset.get("gate_refs", []):
        parts += img_part(Path(ref), "REFERENCE image")
    blind = """Describe the CANDIDATE image plainly; you are not told what it is meant to be.
First list any text, labels or watermarks. Then: how many separate objects; what the object is (your best name, and a
second guess); its parts, counted (legs, wheels, doors, drawers, lids, handles); the state of any lid, door, drawer or
shutter (open/closed, how far, whether you can see inside and how deep); materials and colours; whether it is whole or
cropped by the frame; the background (colour, uniformity, floor, shadows); any people, text or scenery.""" + (
        "\nIf REFERENCE images are given, also list concrete design differences between the candidate and the reference "
        "(colours, bands, proportions, painting style), still without guessing what either is for." if asset.get("gate_refs") else "") + """
Return JSON: {"what_i_see": "<one sentence>", "details": "<the full description>", "reference_differences": ["..."]}"""
    seen, use1 = vision(parts, blind)
    must = "\n".join(f"- {m}" for m in g.get("must", []))
    must_not = "\n".join(f"- {m}" for m in g.get("must_not", []))
    match = f"""You are the semantic gate of a 3D asset factory. An observer who was NOT told what to expect described a
concept image as follows:

{json.dumps(seen, ensure_ascii=False)}

The image was requested to show: {g['desc']}
Requirements:
- exactly ONE object (or the one described set), whole, not cropped, not a grid or multiple views
- recognisably the requested object, with the described structure (legs, wheels, lids, doors, open/closed state)
- no invented handles, rings, loops or straps on things that do not normally have them
- no text, no people, no floor plane or scenery
{must}
Must NOT:
{must_not or '- (nothing extra)'}

Judge only from the observer's description; if it does not mention something the spec needs, treat it as missing.
Return JSON: {{"what_i_see": "<the observer's one sentence>", "ok": true|false, "problems": ["<short, specific, fixable>"]}}
Set ok=false only for problems that would make the 3D prop wrong or unusable; ignore minor painterly details."""
    verdict, use2 = vision([], match)
    verdict["blind"] = seen
    use = {k: use1.get(k, 0) + use2.get(k, 0) for k in set(use1) | set(use2) if isinstance(use1.get(k, 0), int) and isinstance(use2.get(k, 0), int)}
    return verdict, use


def composite(rgba_path: Path, out: Path) -> Path:
    rgba = cv2.imread(str(rgba_path), cv2.IMREAD_UNCHANGED)
    a = rgba[:, :, 3:4].astype(np.float32) / 255
    bg = np.zeros_like(rgba[:, :, :3])
    bg[:] = (255, 0, 255)  # BGR magenta: neither the plate's blue nor a common prop colour
    comp = (rgba[:, :, :3] * a + bg * (1 - a)).astype(np.uint8)
    comp = cv2.resize(comp, (512, 512), interpolation=cv2.INTER_AREA)
    cv2.imwrite(str(out), comp, [cv2.IMWRITE_JPEG_QUALITY, 88])
    return out


def mask_gate(asset: dict, plate: Path, comp: Path) -> tuple[dict, dict]:
    parts = img_part(plate, "ORIGINAL plate") + img_part(comp, "CUT-OUT on a magenta background")
    prompt = f"""You are the mask gate of a 3D asset factory. The CUT-OUT should contain the whole object from the
ORIGINAL plate ({asset['gate']['desc']}) and nothing else, on flat magenta.
Fail it if: any part of the object is missing or eaten away (legs, handles that belong, lids, rims, thin parts,
the inside of an open container replaced by magenta), OR leftover background (blue fringe, blue patches, floor,
shadow) remains, OR holes appear where the object is solid. Magenta visible THROUGH real openings (between legs,
through a handle loop, an open window) is correct. Thin magenta/blue fringes of a pixel or two are fine.

Return JSON: {{"ok": true|false, "problems": ["<short>"]}}"""
    return vision(parts, prompt)


def chroma_rgba(plate: Path, out: Path) -> bool:
    bgr = cv2.imread(str(plate), cv2.IMREAD_COLOR)
    alpha = bm.chroma_alpha(bgr)
    if alpha is None:
        return False
    a8 = cv2.medianBlur((alpha * 255).astype(np.uint8), 3)
    rgba = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = a8
    rgba[a8 == 0, :3] = 0
    cv2.imwrite(str(out), rgba)
    return True


def birefnet(plate: Path, out: Path) -> dict:
    global MODEL
    from PIL import Image
    import torch
    with GPU:
        if MODEL is None:
            MODEL = bm.load_model()
        img = Image.open(plate).convert("RGB")
        with torch.no_grad():
            pred = MODEL(bm.TF(img).unsqueeze(0).to("cuda").half())[-1].sigmoid()[0, 0].float().cpu().numpy()
    alpha = np.clip(cv2.resize(pred, img.size, interpolation=cv2.INTER_LINEAR), 0, 1)
    bgr = cv2.cvtColor(np.asarray(img), cv2.COLOR_RGB2BGR)
    alpha, removed = bm.refine_with_chroma(alpha, bgr)
    rec = bm.score(alpha, bgr)
    rec["chroma_holes_removed_px"] = removed
    a8 = (alpha * 255).astype(np.uint8)
    rgba = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = a8
    rgba[a8 == 0, :3] = 0
    cv2.imwrite(str(out), rgba)
    return rec


def generate(root: Path, asset: dict, attempt: int, extra: str) -> Path:
    pdir, tmp = root / "prompts", root / "work"
    pdir.mkdir(exist_ok=True)
    tmp.mkdir(exist_ok=True)
    prompt = asset["prompt"] + (f"\n\nCorrections from a rejected previous attempt (fix these): {extra}" if extra else "")
    ppath = pdir / f"{asset['id']}.try{attempt}.md"
    ppath.write_text(prompt)
    out = tmp / f"{asset['id']}.try{attempt}.jpg"
    cmd = [sys.executable, str(Path(__file__).with_name("gemini_image.py")), "--prompt-file", str(ppath), "--output", str(out)]
    for ref in asset.get("refs", []):
        cmd += ["--reference", str(ref)]
    if IMAGE_MODEL:
        cmd += ["--model", IMAGE_MODEL]
    for k in range(4):
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0 and out.exists():
            return out
        time.sleep(5 * 3 ** k)
    raise RuntimeError(f"gemini image failed: {r.stderr[-400:]}")


def run_asset(root: Path, asset: dict, rerolls: int, state: dict) -> dict:
    aid = asset["id"]
    rec = {"id": aid, "group": asset.get("group"), "attempts": [], "images": 0, "tokens_in": 0, "tokens_out": 0}
    rej = root / "rejected"
    rej.mkdir(exist_ok=True)
    extra = ""
    for attempt in range(1, rerolls + 2):
        plate = generate(root, asset, attempt, extra)
        rec["images"] += 1
        a = {"try": attempt, "plate": str(plate)}
        sem, use = semantic_gate(asset, plate)
        rec["tokens_in"] += use.get("promptTokenCount", 0)
        rec["tokens_out"] += use.get("candidatesTokenCount", 0) + use.get("thoughtsTokenCount", 0)
        a["semantic"] = sem
        if not sem.get("ok"):
            a["verdict"] = "semantic_reject"
            extra = "; ".join(sem.get("problems", []))[:600]
            shutil.move(plate, rej / f"{aid}.try{attempt}.jpg")
            rec["attempts"].append(a)
            continue
        rgba = root / "work" / f"{aid}.try{attempt}.png"
        metrics = birefnet(plate, rgba)
        a["matte"] = {"method": "birefnet", **metrics}
        mask_ok = metrics["verdict"] != "fail"
        if mask_ok:
            mg, use = mask_gate(asset, plate, composite(rgba, root / "work" / f"{aid}.try{attempt}.comp.jpg"))
            rec["tokens_in"] += use.get("promptTokenCount", 0)
            rec["tokens_out"] += use.get("candidatesTokenCount", 0) + use.get("thoughtsTokenCount", 0)
            a["mask_gate"] = mg
            mask_ok = bool(mg.get("ok"))
        if not mask_ok:  # fallback matte: chroma key
            crgba = root / "work" / f"{aid}.try{attempt}.chroma.png"
            if chroma_rgba(plate, crgba):
                mg, use = mask_gate(asset, plate, composite(crgba, root / "work" / f"{aid}.try{attempt}.ccomp.jpg"))
                rec["tokens_in"] += use.get("promptTokenCount", 0)
                rec["tokens_out"] += use.get("candidatesTokenCount", 0) + use.get("thoughtsTokenCount", 0)
                a["chroma_gate"] = mg
                if mg.get("ok"):
                    rgba, mask_ok = crgba, True
                    a["matte"]["method"] = "chroma"
        if not mask_ok:
            a["verdict"] = "mask_reject"
            extra = "the background must be one perfectly uniform flat chroma-blue with clear space around the object, no floor, no shadow, no blue reflected onto the object"
            shutil.move(plate, rej / f"{aid}.try{attempt}.jpg")
            rec["attempts"].append(a)
            continue
        a["verdict"] = "accepted"
        rec["attempts"].append(a)
        (root / "inputs").mkdir(exist_ok=True)
        (root / "masked").mkdir(exist_ok=True)
        shutil.move(plate, root / "inputs" / f"{aid}.jpg")
        side = plate.with_suffix(".gemini.json")
        if side.exists():
            shutil.move(side, root / "inputs" / f"{aid}.gemini.json")
        shutil.copy2(rgba, root / "masked" / f"{aid}.png")
        shutil.copy2(root / "prompts" / f"{aid}.try{attempt}.md", root / "prompts" / f"{aid}.md")
        rec["status"] = "accepted"
        rec["matte"] = a["matte"]["method"]
        break
    else:
        rec["status"] = "rejected"
    with LOCK:
        state["assets"][aid] = rec
        (root / "gate-manifest.json").write_text(json.dumps(state, indent=1) + "\n")
    print(f"{aid}: {rec['status']} after {len(rec['attempts'])} ({[x['verdict'] for x in rec['attempts']]})", flush=True)
    return rec


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("run", type=Path)
    ap.add_argument("--ids")
    ap.add_argument("--group")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--rerolls", type=int, default=2)
    ap.add_argument("--redo", action="store_true", help="re-run ids already accepted/rejected")
    ap.add_argument("--image-model", help="Gemini image model override (default gemini_image.py's)")
    a = ap.parse_args()
    global IMAGE_MODEL
    IMAGE_MODEL = a.image_model
    root = a.run.resolve()
    assets = json.loads((root / "assets.json").read_text())["assets"]
    man = root / "gate-manifest.json"
    state = json.loads(man.read_text()) if man.exists() else {"gate_model": GATE_MODEL, "assets": {}}
    ids = set(a.ids.split(",")) if a.ids else None
    todo = [x for x in assets if (ids is None or x["id"] in ids) and (a.group is None or x.get("group") == a.group)
            and (a.redo or x["id"] not in state["assets"])]
    print(f"{len(todo)} assets to run", flush=True)
    t0 = time.time()
    with concurrent.futures.ThreadPoolExecutor(a.workers) as pool:
        futs = {pool.submit(run_asset, root, x, a.rerolls, state): x["id"] for x in todo}
        for f in concurrent.futures.as_completed(futs):
            try:
                f.result()
            except Exception as exc:  # keep the batch going
                with LOCK:
                    state["assets"][futs[f]] = {"id": futs[f], "status": "error", "error": repr(exc)[:500]}
                    man.write_text(json.dumps(state, indent=1) + "\n")
                print(f"{futs[f]}: ERROR {exc!r}"[:300], flush=True)
    done = [state["assets"][x["id"]] for x in todo if x["id"] in state["assets"]]
    imgs = sum(r.get("images", 0) for r in done)
    tin = sum(r.get("tokens_in", 0) for r in done)
    tout = sum(r.get("tokens_out", 0) for r in done)
    summary = {"ran": len(todo), "accepted": sum(r.get("status") == "accepted" for r in done),
               "rejected": sum(r.get("status") == "rejected" for r in done),
               "errors": sum(r.get("status") == "error" for r in done), "images": imgs,
               "gate_tokens_in": tin, "gate_tokens_out": tout, "minutes": round((time.time() - t0) / 60, 1)}
    print(json.dumps(summary), flush=True)


if __name__ == "__main__":
    main()

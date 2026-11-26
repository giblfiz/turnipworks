#!/usr/bin/env python3
"""Build a figures-01 data set for the shared Turnip Works asset reviewer.

The reviewer evaluates the shipping tier rather than the 50k source mesh. Files are
hard-linked so exposing the queue does not duplicate the roughly 820 MB figure set.

Publishing (2026-11-07): the web folder's review-figures/assets is a link to this tree, but its assets.json and
meta.json are COPIES: after a run, cp web/review-figures/{assets,meta}.json
/var/www/implausible-landing/projects/turnip-works/review-figures/ (tools/tool-sweep/check.py reads the published copy).
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
GROUPS = {
    "hero": ("Heroes", "HERO"),
    "townsfolk": ("Townsfolk", "TOWN"),
    "foe": ("Foes", "FOE"),
    "large": ("Large creatures", "LARGE"),
    "beast": ("Beasts and mounts", "BEAST"),
    "runner": ("Cyberpunk runners", "RUNNER"),   # (the cyberpunk pack, 2026-11-07)
    "modern": ("Modern NPCs", "MODERN"),
    "robot": ("Robots", "ROBOT"),
}


def hard_link(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        if source.stat().st_ino == target.stat().st_ino:
            target.chmod(0o644)
            return
        target.unlink()
    try:
        os.link(source, target)
    except OSError:  # another disk (a later lane's plates live on USB): copy instead
        shutil.copy2(source, target)
    # nginx serves the review through a symlink and is not in the project group.
    # This changes only the shared inode's mode; the content remains a hard link.
    target.chmod(0o644)


def accepted_plate(gate: dict, figure_id: str, inputs: Path) -> Path:
    entry = gate["assets"].get(figure_id, {})
    stable = inputs / f"{figure_id}.jpg"
    for attempt in reversed(entry.get("attempts", [])):
        if attempt.get("verdict") != "accepted":
            continue
        if stable.exists():
            return stable
        plate = Path(attempt["plate"])
        if plate.exists():
            return plate
    raise FileNotFoundError(f"no accepted concept plate for {figure_id}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", type=Path, default=HERE / "set/published")
    ap.add_argument("--gate", type=Path, default=HERE / "set/gate-manifest.json")
    ap.add_argument("--output", type=Path, default=ROOT / "web/review-figures")
    ap.add_argument("--run-name", default="figures-01")
    ap.add_argument("--extra", type=Path, action="append", default=None,
                    help="a later lane's set folder (set/published/manifest.json, set/gate.json with accepted_try, "
                         "set/plates.json); default: every experiments/*/set with that shape (2026-11-07)")
    args = ap.parse_args()

    manifest = json.loads((args.set / "manifest.json").read_text())
    gate = json.loads(args.gate.read_text())
    assets = []
    meta = {}
    seen = set()

    sources = [(f, args.set, lambda sku: accepted_plate(gate, sku, args.gate.parent / "inputs")) for f in manifest["figures"]]
    extras = args.extra if args.extra is not None else sorted(
        p for p in ROOT.glob("experiments/*/set") if p != HERE / "set"
        and (p / "published/manifest.json").exists() and (p / "gate.json").exists() and (p / "plates.json").exists())
    for xs in extras:
        xg = json.loads((xs / "gate.json").read_text()); xp = json.loads((xs / "plates.json").read_text())
        def lane_plate(sku, xg=xg, xp=xp):
            t = xg.get(sku, {}).get("accepted_try")
            tries = [tr for tr in xp.get(sku, {}).get("tries", []) if Path(tr["plate"]).exists()]
            for tr in tries:
                if t is not None and tr.get("try") == t:
                    return Path(tr["plate"])
            if t is None and tries:  # gated outside gate.json (the grid's later rows): its last try is the one meshed
                return Path(tries[-1]["plate"])
            raise FileNotFoundError(f"no accepted concept plate for {sku}")
        for f in json.loads((xs / "published/manifest.json").read_text())["figures"]:
            sources.append((f, xs / "published", lane_plate))

    for figure, set_dir, plate_of in sources:
        sku = figure["id"]
        if sku in seen:
            raise ValueError(f"duplicate figure id: {sku}")
        seen.add(sku)

        tier = figure.get("recommended") or "hero"
        model_rel = figure["files"].get(tier) or figure["files"]["hero"]
        model = set_dir / model_rel
        plate = plate_of(figure.get("plate") or sku)   # a row may name another try's plate: a flier standing in its flying pose (2026-11-07)
        if not model.exists():
            raise FileNotFoundError(model)

        hard_link(model, args.output / "assets/models" / f"{sku}.glb")
        hard_link(plate, args.output / "assets/plates" / f"{sku}.jpg")

        group_name, group_code = GROUPS[figure["group"]]
        role = str(figure.get("cls") or figure.get("race") or group_name).replace("-", " ").title()
        tags = [str(x) for x in figure.get("tags", [])]
        srd = [str(x) for x in figure.get("srd", [])]
        notes = [str(x) for x in figure.get("qa", {}).get("notes", [])]
        hint_parts = []
        if tags:
            hint_parts.append("tags: " + ", ".join(tags))
        if srd:
            hint_parts.append("SRD: " + ", ".join(srd))
        if notes:
            hint_parts.append("QA: " + "; ".join(notes))

        assets.append({
            "sku": sku,
            "name": figure["name"],
            "priority": group_name,
            "material": role,
            "placement": "pawn",
            "rooms": ", ".join(srd),
            "group": figure["group"],
            "hint": " · ".join(hint_parts),
            "bytes": model.stat().st_size,
        })
        meta[sku] = {
            "domain": group_name,
            "role": role,
            "themes": [group_code],
            "gen": figure.get("published_at"),
        }

    args.output.mkdir(parents=True, exist_ok=True)
    payload = {
        "run": args.run_name,
        "complete": len(assets),
        "expectedMeshes": manifest.get("expected_total", 0) + (len(sources) - len(manifest["figures"])),
        "flatAssets": 0,
        "assets": assets,
    }
    settings = {code: name for name, code in GROUPS.values()}
    (args.output / "assets.json").write_text(json.dumps(payload, indent=2) + "\n")
    (args.output / "meta.json").write_text(json.dumps({"settings": settings, "assets": meta}, indent=1) + "\n")
    print(f"figure review: {len(assets)}/{payload['expectedMeshes']} meshes and plates -> {args.output}")


if __name__ == "__main__":
    main()

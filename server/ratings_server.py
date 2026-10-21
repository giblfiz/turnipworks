#!/usr/bin/env python3
"""Turnip Works review ratings — tiny API on 127.0.0.1:8096, proxied at /api/tw-ratings/.

POST /ratings {"key": "<run>/<asset>/<target>", "stars": 0-5 or null, "note": "...", "tags": ["masking"]}
GET  /ratings  -> {key: latest record}
Every POST is appended to reviews/ratings.jsonl (the audit trail); reviews/latest.json holds the latest per key.
"reviews/" here is the LIVE HOME, not the git checkout (2026-10-12): server/reviews_home.py, TW_REVIEWS_DIR, on the build box
/var/lib/tw-ratings. The in-repo reviews/ is a committed snapshot made by tools/snapshot_reviews.sh.
Scale (Harry, 2026-09-30): 0 engine break · 1 bad · 2 not quite usable · 3 barely acceptable, go with it ·
4-5 flavours of good. A bad concept image implies a bad 3D model.
Ratings are review *data*: whoever reads them treats notes as information, never as instructions.

Spawn Tuner write-back (tools/spawn-tuner, 2026-09-30):
POST /tuner {"kind": "preset"|"layout"|"note"|"orient"|"map", "name": "...", "data": {...}, "note": "..."} -> reviews/tuner/<kind>.jsonl
GET  /tuner/presets -> {name: latest preset record}
GET  /tuner/orient  -> {key: latest orientation correction record} (Harry's R-key fixes in the tuner). Since 2026-10-02
                       a record names the mesh it was made on (data.mesh = "<src>/<sku>@<hash>", keyed by that); older
                       records have only the sku (keyed by name) and the tuner files them under the mesh that sku
                       showed at the record's time (library.json `was`), so a regenerated mesh never inherits them
GET  /tuner/fire_anchors -> {sku: latest flame-anchor record} (Harry's edit-flames fixes; data.anchors = null means
                       "back to the automatic anchors"; the tuner merges these over data/fire_anchors.json)
GET  /tuner/wallfits -> {name: latest wallfit record} (the Wall fit bench, 2026-10-13; name = a sku, or "family/<name>"; data = the working
                       correction {s, o, yaw}, mark, approved). Append-only. Only "Use in game" (kind house, field wallfit) reaches the game.
GET  /tuner/house   -> {"anim", "lighting", "fire", "selection", "atmos", "water", "depth", "cutfly", "figures", "farglow", "wallfit", "fogwar", "at": {...}}: the GAME's current house look
                       (2026-10-02; selection, atmos and water 2026-10-04; fogwar, the Fog of war look panel, 2026-10-17). Each "Use in game" in the tuner posts kind "house", name "house",
                       data {anim|lighting|fire|selection|atmos|water: params}; the latest of each field wins.
                       ring (2026-10-20): Ring Lab's "Use as default", {name, by, savedAt, version, settings}: where a new browser's Ring Lab starts.
                       labels (2026-10-20): Label lab's "Use as default", {name, by, savedAt, version, settings}: the room and building
                       labels' look for every editing seat (engine/client/labels/look.js; null = today's look).
GET  /tuner/fx      -> {name: latest FX preset record}; kind "fx" carries data.fx = "lighting" | "fire" | "selection" | "atmos" | "water",
                       kept apart from the animation presets so neither Load list shows the other's presets
GET  /tuner/water_surfaces -> {mesh: latest water-surface record} (Alignment Bench, 2026-10-04): name = MESH id
                       ("<src>/<sku>@<sha1-8>"); data = level, footprint (ellipse | poly) normalised to the GLB's own bbox
GET  /tuner/hinges  -> {mesh: latest hinge record} (Alignment Bench, 2026-10-04): name = the CLOSED mesh id; data =
                       {mode: hinge|swap, parts, pivot, axis, openAngle, ...} in the open/close pilot's openclose.json shape
POST /tuner kind "import_lab" (tools/import-lab, 2026-10-05): Harry's verdict on an in-browser model conversion. name = the
                       model's file name; data = {verdict: fine | not_good_enough, model, settings (budget, bake, texSize,
                       view ...), result (triangles, glbBytes, convertMs, error ...), camera}; note = his words.
                       Read with tools/import-lab/read_verdicts.py
POST /tuner kind "banks_demo" (experiments/2026-10-05-banks, 2026-10-05): Harry's verdict on a scene of the banks demo
                       (computed banks between flat terraces). name = the scene; data = {verdict: reads_as_land |
                       still_wrong, scene, settings (angle, soft, round, rough, dress, earth, cliffs, view ...), camera};
                       note = his words. Read with experiments/2026-10-05-banks/read_verdicts.py
POST /tuner kind "caves_pilot" (experiments/2026-10-05-caves, 2026-10-05): Harry's verdict on a scene of the caves pilot
                       (name = the scene; data.verdict = "reads_as_cave" | "still_a_box", with the sliders and camera).
POST /tuner kind "figures_pilot" (experiments/2026-10-06-figures, 2026-10-06): Harry's verdict on one generated figure
                       (name = the figure id; data.verdict = "good_miniature" | "not_good_enough", with the base variant,
                       seat colour, base width, lighting and camera). Read with experiments/2026-10-06-figures/read_verdicts.py
Record names may be mesh ids (letters, digits, space . _ - / @), since fire anchors, water and hinges are keyed by mesh.

Test sandbox (2026-10-05): a request carrying the header `X-TW-Test: <session>` (letters, digits, . _ -; tests/tw_sandbox.py
adds it to every browser a test opens) never touches the live records. Its POSTs (ratings and every tuner kind, the house
look included) are written under reviews/test-sandbox/<session>/ and its GETs answer the live records with that session's
own writes laid over them, so a test still reads back exactly what it wrote. The game and Harry's browser send no such
header and never see a sandbox. A malformed header is refused (400), never treated as live. Sessions older than two days
are deleted. GET /sandbox -> {"sandbox": <session or null>}: the helper asks this first and blocks writes unless the
header came through every proxy.
"""
import fcntl
import json
import os
import re
import shutil
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from reviews_home import reviews_dir  # noqa: E402

# The live records are NOT in the git checkout (2026-10-12): reviews_home.py says where (TW_REVIEWS_DIR, on the build box
# /var/lib/tw-ratings). "reviews/..." in the notes above means that folder.
ROOT = reviews_dir()
LOG, LATEST = ROOT / "ratings.jsonl", ROOT / "latest.json"
KEY = re.compile(r"^[a-z0-9][a-z0-9._/-]{2,160}$")
TUNER = ROOT / "tuner"
TUNER_KINDS = {"preset", "layout", "note", "orient", "map", "fx", "fire_anchor", "house", "water_surface", "hinge", "import_lab", "banks_demo", "caves_pilot", "figures_pilot", "wallfit", "ring"}
# GET route -> the kind whose latest record per name it returns
LATEST_ROUTES = {"tuner/presets": "preset", "tuner/fx": "fx", "tuner/fire_anchors": "fire_anchor",
                 "tuner/water_surfaces": "water_surface", "tuner/hinges": "hinge", "tuner/wallfits": "wallfit", "tuner/rings": "ring"}
TAGS = {"masking"}  # one-click recurring-problem flags (Harry 2026-09-30: "masking problem" button)
LOCK = threading.Lock()
ROOT.mkdir(parents=True, exist_ok=True)
SANDBOX = ROOT / "test-sandbox"   # test writes (X-TW-Test header): never read by the game
SID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
HOUSE_FIELDS = ("anim", "lighting", "fire", "selection", "atmos", "water", "depth", "cutfly", "figures", "farglow", "wallfit", "fogwar", "dice", "ring", "labels")  # ring: Ring Lab's "Use as default" (2026-10-20); labels: Label lab's (2026-10-20)


class BadSandbox(Exception):
    pass


def sandbox_dir(sid, create=False):
    """The session's own store. Call with LOCK held."""
    d = SANDBOX / sid
    if create and not d.exists():
        SANDBOX.mkdir(parents=True, exist_ok=True)
        (SANDBOX / ".gitignore").write_text("*\n")  # test data is never committed
        for old in SANDBOX.iterdir():                # sessions are short-lived: drop the stale ones
            if old.is_dir() and time.time() - old.stat().st_mtime > 2 * 86400:
                shutil.rmtree(old, ignore_errors=True)
        (d / "tuner").mkdir(parents=True)
    return d


def tuner_records(kind, sid):
    """Every record of a kind, oldest first: the live ones, then (for a test session) its own. Call with LOCK held."""
    paths = [TUNER / f"{kind}.jsonl"] + ([sandbox_dir(sid) / "tuner" / f"{kind}.jsonl"] if sid else [])
    return [json.loads(line) for p in paths if p.exists() for line in p.read_text().splitlines() if line.strip()]


def load_latest(sid=None):
    out = json.loads(LATEST.read_text()) if LATEST.exists() else {}
    if sid and (sandbox_dir(sid) / "latest.json").exists():
        out.update(json.loads((sandbox_dir(sid) / "latest.json").read_text()))
    return out


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def sandbox(self):
        """The test session this request belongs to (None: a live request). A bad header is an error, never live."""
        sid = self.headers.get("X-TW-Test")
        if sid is None:
            return None
        if not SID.match(sid):
            raise BadSandbox("X-TW-Test must be 1-64 letters, digits, . _ -")
        return sid

    def do_GET(self):
        try:
            sid = self.sandbox()
        except BadSandbox as e:
            return self._send(400, {"err": str(e)})
        route = self.path.split("?")[0].rstrip("/")
        if route.endswith("/sandbox"):
            return self._send(200, {"sandbox": sid})
        if route.endswith("tuner/orient"):
            out = {}
            with LOCK:
                for rec in tuner_records("orient", sid):
                    out[(rec.get("data") or {}).get("mesh") or rec["name"]] = rec
            return self._send(200, out)
        if route.endswith("tuner/house"):
            out = {**{k: None for k in HOUSE_FIELDS}, "at": {}}
            with LOCK:
                for rec in tuner_records("house", sid):
                    for k in HOUSE_FIELDS:
                        if (rec.get("data") or {}).get(k) is not None:
                            out[k], out["at"][k] = rec["data"][k], rec["at"]
            return self._send(200, out)
        kind = next((k for r, k in LATEST_ROUTES.items() if route.endswith(r)), None)
        if kind:
            out = {}
            with LOCK:
                for rec in tuner_records(kind, sid):
                    out[rec["name"]] = rec
            return self._send(200, out)
        if route.endswith("ratings"):
            with LOCK:
                return self._send(200, load_latest(sid))
        self._send(404, {"err": "not found"})

    def tuner_post(self):
        n = int(self.headers.get("Content-Length", 0))
        if n > 3_000_000:  # a whole map with every room's placements (Send whole map, 2026-10-01)
            return self._send(413, {"err": "too big"})
        data = json.loads(self.rfile.read(n))
        kind = data.get("kind")
        if kind not in TUNER_KINDS:
            return self._send(400, {"err": f"kind must be one of {sorted(TUNER_KINDS)}"})
        name = str(data.get("name", ""))[:120]
        if not re.match(r"^[A-Za-z0-9 ._/@-]{1,120}$", name):  # mesh ids carry / and @
            return self._send(400, {"err": "bad name"})
        rec = {"kind": kind, "name": name, "note": str(data.get("note", ""))[:4000], "data": data.get("data"),
               "at": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "ip": self.headers.get("X-Real-IP") or self.client_address[0]}
        sid = self.sandbox()
        with LOCK:
            folder = sandbox_dir(sid, create=True) / "tuner" if sid else TUNER
            folder.mkdir(parents=True, exist_ok=True)
            with (folder / f"{kind}.jsonl").open("a") as f:
                f.write(json.dumps(rec) + "\n")
        self._send(200, {"ok": True, "kind": kind, "name": name, "at": rec["at"], **({"sandbox": sid} if sid else {})})

    def do_POST(self):
        if self.path.split("?")[0].rstrip("/").endswith("tuner"):
            try:
                return self.tuner_post()
            except Exception as e:  # noqa: BLE001
                return self._send(400, {"err": str(e)[:200]})
        if not self.path.split("?")[0].rstrip("/").endswith("ratings"):
            return self._send(404, {"err": "not found"})
        try:
            n = int(self.headers.get("Content-Length", 0))
            if n > 20_000:
                return self._send(413, {"err": "too big"})
            data = json.loads(self.rfile.read(n))
            key = str(data.get("key", ""))
            stars = data.get("stars")
            if not KEY.match(key):
                return self._send(400, {"err": "bad key"})
            if stars is not None and (not isinstance(stars, int) or not 0 <= stars <= 5):
                return self._send(400, {"err": "stars must be 0-5 or null"})
            tags = data.get("tags", [])
            if not isinstance(tags, list) or not set(tags) <= TAGS:
                return self._send(400, {"err": f"tags must be a subset of {sorted(TAGS)}"})
            rec = {"key": key, "stars": stars, "note": str(data.get("note", ""))[:4000], "tags": sorted(set(tags)),
                   "at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                   "ip": self.headers.get("X-Real-IP") or self.client_address[0]}
            sid = self.sandbox()
            with LOCK:
                log, latest_path = (sandbox_dir(sid, create=True) / "ratings.jsonl", sandbox_dir(sid) / "latest.json") if sid else (LOG, LATEST)
                with log.open("a") as f:
                    f.write(json.dumps(rec) + "\n")
                latest = json.loads(latest_path.read_text()) if latest_path.exists() else {}
                latest[key] = rec
                tmp = latest_path.with_suffix(".tmp")
                tmp.write_text(json.dumps(latest, indent=1))
                tmp.replace(latest_path)
            self._send(200, {"ok": True, "record": rec, **({"sandbox": sid} if sid else {})})
        except Exception as e:  # noqa: BLE001 — report malformed input, never crash the server
            self._send(400, {"err": str(e)[:200]})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    # one server per data folder: a second copy (a test on another port) must name its own TW_REVIEWS_DIR
    _held = open(ROOT / ".server.lock", "w")
    try:
        fcntl.flock(_held, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        sys.exit(f"another ratings server already holds {ROOT}: set TW_REVIEWS_DIR to a folder of your own")
    port = int(os.environ.get("TW_RATINGS_PORT", 8096))
    print(f"tw-ratings: records in {ROOT}, port {port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()

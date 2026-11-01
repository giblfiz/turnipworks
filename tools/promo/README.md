# tools/promo: the frame-exact promo rig (2026-10-22)

Marketing footage of Turnip Works itself: a building (or one room) dropped onto open ground, its spawn-in recorded
frame by frame on a **virtual clock**, cut against the house card (FREE · NO DOWNLOAD · NO ACCOUNT · OPEN SOURCE),
encoded as 6 s H.264 films at 1920×1080 and 1080×1080. Harry's concept: one continuous clock; three times the picture
cuts to the card for about a third of a second while the build keeps running unseen, each cut showing one more phrase;
the fourth reveal holds to the end.

**The welcome mat (M-series, Harry 2026-10-22).** One continuous shot, no cut-ins: a one-storey building spins in
while the camera orbits ~45° from a high 3/4 view of a corner to a 3/4 view of the front; a building-wide printed rug
lies in front of the door from frame one, carrying the mark, the name and the four phrases, skewed at the start and
coming square to the frame as the orbit eases out on the moment the building settles; the full card drops over the last
1.0 s (`sequence: [[5.0, 4]]`). The mat is the rig's, not the game's: `mat.html` rendered to a texture, put on a thin
box in the scene through `page.evaluate` (capture.py `MAT_ADD`). The cards and the mat are set in Inter, the face the
site ships (`engine/client/vendor/inter`).

**Re-render everything** (after an engine change, from the checkout that has it):

    python3 tools/promo/render.py            # all variants
    python3 tools/promo/render.py V10 V11    # some

Output: `/mnt/usb/turnip-works/promo/finals/V*.mp4`, `V*-square.mp4`, `V*-sheet.jpg` (contact sheet, every 12th frame,
frame numbers burnt in). Frames go to `/mnt/usb/turnip-works/promo/captures/<shot>/frames/` and are deleted once
encoded (`--keep-frames` keeps them). About 0.8 s of wall time per captured frame (the screenshot), so ~5 min a take.

| file | what it does |
|---|---|
| `vclock.js` | init script: `performance.now`, `Date.now`, `requestAnimationFrame`, `setTimeout`/`setInterval` on a stepped clock after `__promo.freeze()`; `__promo.step(ms)` fires due timers in order, then the frame's rAF callbacks once; `Math.random` seeded, `__promo.reseed()` just before the drop so every take of a drop has the same choreography |
| `capture.py --shot S [--measure\|--probe]` | local relay + static site (own ports 18431/18432), house look read from the live ratings server through `tests/tw_sandbox.py`, headless Chromium on the GPU (Vulkan ANGLE), all DOM chrome hidden; warm-up drop of the same thing 600 ft off; freeze, real drop, clock held at 0 while it gets ready, then one 1000/60 ms × speed step per frame and one screenshot; `capture.json` per-frame stats; fails on any grey stand-in drawn or a drop not ready at once |
| `shots.json` | the drops: building / room / stacked rooms, seed, footprint, camera, speed (number, or a fit to an event of a 1× measure: `ground_land`, `upper_start`, `last_land`), push-in |
| `cards.py`, `card.html` | the four card states at 1920×1080 and 1080×1080 from HTML: loading-screen brown `#4a4136`, cream `#f6ead2`, gold dots `#e0b04a`, set in Inter (the site's own face, vendored; was the loading screen's Georgia stack, which fell back to Noto Serif here), the mark is `engine/client/mark.svg` itself |
| `mat.html` | the welcome mat's face (M-series): the card's set on a rug (dark binding, gold and cream rules), sized in vh so any aspect lays out the same; capture.py renders it at the mat's aspect (4096 px wide), checks Inter loaded and every line sits inside the inner rule |
| shot `mat` / `orbit` | `mat: {side, gap, depth, [width, thick, tint, spin: {at, slow}]}` (ft; side = the door's); `orbit: {from, to, end, [s0, pitch: [a, b], push]}` (yaw deg; end = output s or `{event, from}` of a 1x measure, divided by the shot's speed); per frame `mat_deg` (the mat's near edge on screen), event `mat_square_out_s` (first frame from which it stays within 0.5°); `--probe` prints the framing along the orbit and whether it fits the square crop |
| shot `camera.frame` | **zoom by framing** (any shot, mat or not): `frame: 0.87` or `{frac, margin, textMargin, hold, smooth}`. The scene's extent on screen (the shot's rect up to `wallTop` ft, default 11, plus the mat's corners) is made `frac` of the frame's WIDTH (1 = edge to edge, 1.2 = spills off both sides), its middle at the frame's middle; then the view is shifted (not zoomed) so the mat's type stays `margin` (0.04 of the frame's short side) inside every edge, and never zoomed so far that the type is wider than the frame less `textMargin` (0.02) a side (`capped`). The distance and focus of `camera` are then ignored (pitch, yaw, orbit, y are used). Default `hold: 'orbit'`: every frame's pose is solved before the take, the path Gaussian-smoothed (`smooth`, 12 frames) and flown, so the fraction holds through the move and the type never leaves the frame (the focus drifts to keep it in); `hold: 'end'` frames only the end and flies a rigid orbit at that distance (on M4-z3 the type was off the frame until 3.55 s). A push (`camera.push`, or `orbit.push`) ramps the fraction: it starts at `frac × push` and ends at `frac`. Per frame the log has `cam` (dist, focus) and `text_in`; events `text_cut_frames`, `text_in_from_out_s` |
| shot `size` | the viewport, default `[1920, 1080]`; `[1080, 1080]` for a square take framed for the square. A variant's `square_capture` names that take: `assemble.py` uses its frames uncropped with `card-n-sq.png` for `<name>-square.mp4` (same drop, same clock, so the EDL's frame numbers serve both) |
| `qa.py M…` | stills at 0.2 / 2.5 / 4.8 / 5.5 s (+ the square at 4.8) to Gemini through agy-run, one image a call: transcribe first, then skewed/square, any type cut off by the frame, rug or overlay, fits, broken; `finals/qa/<name>/qa.json` |
| `variants.json` → `edl.py` → `variants/V*.json` | the idea of each variant → an EDL: segments on the output clock, `{out:[a,b], footage:c}` (capture frames from c, 1:1) or `{out:[a,b], card:n}`; cut moments moved up to ±0.15 s from the baseline to maximise pieces in flight on both sides of each cut; recorded in the EDL's `cuts` |
| `assemble.py V…` | EDL → numbered links → ffmpeg image sequence → libx264 (or `--nvenc`), yuv420p, 60 fps, +faststart, no audio; square = middle 1080 of the footage + the square card |
| `check.py` | ffprobe (codec, size, 60/1, 360 frames, 6.00 s ± 1 frame, no audio, faststart) and signalstats (no flat frame) |

Never touches the house look: every ratings call carries the sandbox header; the campaign is a throwaway on a local
relay. A worktree gets the ignored assets linked from the main checkout on first run (docs/TEST_DEBT.md).

## The shot library (15 / 30 / 60 s cuts, 2026-10-22)

Scripted shots that use the game's real UI, each with a label (two letters + a digit, e.g. RZ4; no I/L/O, no 0/1),
kept in `shots/registry.json` (`library.py list | new | bump | show`). A re-render keeps the label and bumps the
revision; a different shot (a zoom variant, a caption rug) gets a new label in the same `family`. Cuts are lists of
labels (`cuts/<name>.json`), so recombining is editing a list.

    python3 tools/promo/shoot.py RZ4 [RQ8 ...]     # shots -> finals/shots/<label>.mp4 + review clip
    python3 tools/promo/shotqa.py RZ4 [...]                                                 # Gemini (agy-run) reads 4 stills -> registry verdict
    python3 tools/promo/cut.py 15A [30A ...]        # cuts -> finals/<name>.mp4 + review copy

| file | what it does |
|---|---|
| `rig.py` | capture.py generalised: seats (browser contexts, one clock each, stepped together), split frames, the real UI kept with dev clutter hidden, a drawn pointer (the game's own cursor images, else the desktop theme's via `xcursor.py`), mouse/keys on the clock, frames piped straight into the master's encoder (no frame files: /mnt/usb writes ~9 MB/s) |
| `vanim.js`, `fogwait.js` | init scripts: CSS/Web Animations driven from the stepped clock; the fog worker's jobs waited for each frame |
| `promosite.py` | a shot that shows a link opens the game at https://turnipworks.net/, answered inside the browser from the local relay and site (routes + a WebSocket bridge), fail-closed (the name resolves nowhere) |
| `shots/scripts.py` | one function per kind of shot (spin, join, dice, quickbar, fireball, ring, turn, multiselect, floorup, buildmenu, pawnmenu, fog); `framed()` = zoom depth by framing fraction (camera.frame's meaning); `add_rug()` = a caption printed on a rug in the scene (30B) |
| `caption.html`, `rug.html`, `split.html` | typography only: the overlay lower-third, the caption rug's face, the split screen's desk and window names |
| `cut.py`, `cuts/*.json` | label lists -> films: hard cuts, faded captions, the end card dissolving in (swappable: `--card`, a cut's `end.card`, TW_PROMO_CARD; default card-4.png, v3 cuts use card-c5.png); ffprobe + flat-frame checks; the last frame must be the card, fully drawn |
| `card-c5.html` | end card C5 (v3, Harry's pick): the brand panel left, four gold ticks with glosses; `?square=1` stacks the brand as a band; `cards.py` renders it with a fit/overlap check |
| `capqa.py` | every overlay caption of a cut read by Gemini (agy-run) at 1920x1080 and in the square layout over the beat's middle 1080 |
| v3 framing | `framed()` uses `camera.frame` (`__promoSolve`, now with `cx`/`cy`); `zoom: {frac, start, fallback, keep, cx, cy, safe}`: spill tried first, edge if a `keep` point leaves the safe box; the choice in `notes.zoom.chosen` |
| v3 captions | `caption.html`: two-level, "Headline\|plain line" (else the first sentence is the headline); `rug.html` the same; rugs sized to the frame by `rug.fit` (RUG_AUTO: clear ground, `avoid` rects, lantern reach) |
| v3 rig | the ring's painted pictures (ui-icons/charcoal, parchment) linked into worktrees, preloaded before the freeze; a frame waits until every `#ring img.paint` is drawn. `join` takes `crunch` (s of load screen: "load time shortened") |
| v4 feed shapes | `library.py shape square\|4x5 LABEL...`: a twin take per shot (own label, same family, `shape`/`shape_of`; the 16:9 shot's `shapes`), params + `size` + `page_scale` (0.8: the page laid out 1350 CSS px wide, scaled to 1080); `cut.py CUT --shape square\|4x5` -> `finals/<cut>-<shape>.mp4` from the twins, same beats/in/out/captions; captions `caption.html ?sq=1` / `?shape=4x5`; card `card-c5-sq.png` / `card-c5-4x5.png` (`cards.py --feed`); split screens stack (GM above the player, `split.html ?stack=1`); `feedqa.py` Gemini reads stills off the shape cuts; `TW_PROMO_GAME_REPO` films another checkout's engine (the approved takes' bea26e7e) |

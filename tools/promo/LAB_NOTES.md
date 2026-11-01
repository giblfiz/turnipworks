# tools/promo lab notes

## 2026-10-22 (Fauna, Claude substrate) — the rig, the cards, V10/V11

**Clock.** Own stepped clock (`vclock.js`) rather than Playwright's `page.clock`: fake-timers fires rAF on a 16 ms
grid, not 16.667, and I wanted the freeze to happen after load (real network, real mesh fetches) with real-mode rAF and
timers that land after the freeze moving onto the stepped queue. Verified per take: every step advanced the page clock
by exactly 1000/60 × speed (common: 16.666667 ms every step; common-land: 16.550927 every step), and the game's own
schedule (`lastEpisode.at + total` = 4756.3 ms at 0.993×) ends on the frame the per-frame log says the last piece came
to rest (4766.7 ms, the first frame after it). `lastEpisode.loadMs` = 0 in the take.

**Determinism.** `Math.random` is seeded, but a fixed seed alone gave different choreographies per run (other code eats
random numbers during the real-time load): a common room landed at 4733 ms in one take, 4750 in the measure. Fix:
`__promo.reseed()` just before the drop. Two measures since: 4766.667 and 4766.667; the fitted take lands at 4.800 s.

**Warm-up (Harry: "give the browser time to have cached all the assets").** Same drop (same seed, so the same pieces)
600 ft east in the same page; wait until no animation, no stage, no pending command, no network request in flight;
1.5 s more; look away (it sleeps out of the scene). The real drop is then ready in 0.02–0.5 s of real time, with the
clock held at 0 (steps of 0: no timer can fire, so play()'s 20 s give-up race cannot either). A take fails if the drop
needs more than 3 s to be ready, or if any frame draws a grey stand-in (placeholder visual on a drawn group): 0 so far.

**Measured spawn-in at 1x (house preset harry-v2, speed 1), main 153a97b0 (storey-by-storey drop):**
- common room 7×5, seed 4101, 136 pieces: 4.767 s (last piece rests).
- inn TAV seed 7, 12×8, 2 storeys, 1013 pieces (364 upstairs): ground storey landed 6.233 s, upper storey starts 6.550 s,
  last piece above ground 13.133 s (the cellar plays after; ignored).
- armoury ×2 stacked (6×4, seeds 5301/5302), 151 pieces: ground 4.217 s, upper starts 4.533 s, last 8.983 s.
  (The tuner's armoury is a castle ROOM type; there is no armoury building, so it is two armoury rooms of one building.)

**Cuts chosen (in flight = pieces moving on the last frame before the card / first frame after):** baseline ±0.15 s,
maximising the smaller of the two counts. V10: 0.900→1.233 (28/28), 2.217→2.550 (34/43), 3.617→3.950 (15/14), final 4.800.
V11 (×0.993, lands 4.800): 0.867→1.200 (29/30), 2.233→2.567 (34/43), 3.633→3.967 (15/14), final 4.800.
V10 and V11 are nearly the same film: a single room already lands at 4.77 s at 1×.

**QA.** Gemini (agy-run, short single-image prompts; a three-image prompt timed out at 6 min) on the contact sheets:
card text read back right on every card frame (FREE / + NO DOWNLOAD / + NO ACCOUNT / + OPEN SOURCE, Turnip Works,
turnipworks.net), no blank frame, no UI chrome, no stand-ins, room inside the frame (square too). It flagged a "roof
ridge through the floor" by the door and a "chandelier on the floor": the dump says those are the notice board (a small
roofed board on the floor, (12.8, 22)) and a ring chandelier hanging at 5.6 ft seen from above. Not defects.
check.py: all four MP4s h264 High yuv420p 60/1, 360 frames, 6.000 s, one stream, faststart, no flat frame.

**Font.** The card names the loading screen's stack (Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua',
serif). the build box has none of those: Chromium falls back to its serif (Noto Serif here). On a Mac or Windows viewer the
loading screen is Georgia; the card here is not. Installing Georgia system-wide would change every test's rendering on
this box, so not done.

**Open: the storey drop is being redesigned** (Harry, relayed 2026-10-22: all storeys spin in at once with the placing
seat's view cut at the TOP storey, then the view steps down a level at a time, ~0.3 s a floor). The inn/armoury shots'
speed fits (`upper_start`, `last_land`) were written for the sequential drop. When it lands: measure, look at the new
events (the step-down shows in the log as `cut` / `level` changes; a take already waits for them to stop before it
ends), probably fit `last_land` (top floor in) and add an event for the end of the step-down, then `render.py`.

## 2026-10-22 later — the redesigned drop (main bae15ade): V1–V9

**The new drop:** every storey spins in on one frame, the placing seat's view cut at the top storey; when it has all
settled the storey tour steps the view down (app.goLevel and its fly, 300 ms hold) to the ground storey, which then
shows the ground floor only. The rig: a `stack` drop sets `tw.madeBuilding` (as makeBuilding does) so it gets the
tour too; after the warm-up the cut goes back to all levels (its tour left it at lv 1); a take keeps recording until
this drop's tour has ended (`tw.storeyTour.end`); new events `upper_land` (top floor's last piece rests),
`step_start`, `step_land` (tour on the ground storey).

**Measured at 1x** (ms from the first piece): inn ground 6.250, top floor 6.583, step down starts 6.883, on lv 1 7.250
(one run 7.267: the tour's settle wait varies by a frame); armoury ground 4.117, top 4.450, step 4.767, on lv 1 5.150.

**Speeds:** V1/V3/V4/V7/V8/V9 inn ×1.53 (step_land at 4.75: lands 4.767); V2 inn ×1.3715 (top floor lands 4.800, the
step down at 5.03–5.32 is under the final card); V5 armoury ×1.08 (step down 4.417–4.767); V6 armoury ×0.927 (top
floor 4.800; a slow-down: it lands at 4.45 at 1x; step down under the card).

**Step down in frame:** V1, V4 (ground floor held 4.77–5.40), V5, V7. Not: V2, V6 (by their fit), V3 (the freeze's
footage clock is 1 s behind at the final card), V8 (final at 4.50, the step starts 4.517), V9 (cards from 4.40).

**QA:** all eleven pass check.py; 0 stand-ins and 0 fails in every take; Gemini (one sheet a call) read every card
right and found no blank frame / chrome / stand-in. Seen: during the step down the ground's look changes for a few
frames (grey fog where the grid was: the level-change fly), and on lv 1 Gemini sees "orphaned upper-wall segments"
front-left. Not investigated; game behaviour, worth a look in the game itself. The inn's square crop clips its sides
(~5–10% left): the 16:9 framing is 69% building wide, the square keeps the middle 56%.

## 2026-10-22 evening — the welcome mat (M1–M8)

**Concept (Harry, after V1–V11 read as frantic):** no cuts. A building-wide printed rug in front of the door carries
the mark, the name and FREE · NO DOWNLOAD / NO ACCOUNT · OPEN SOURCE (two lines: bigger on the ground than one); the
camera orbits from a high 3/4 view of a corner to a 3/4 view of the front while a ONE-storey building spins in; the
orbit eases out to a dead stop on the frame the last piece rests, so the mat's edges come square with the settle; the
full card (now with turnipworks.net) covers 5.0–6.0. Rig pieces: `mat.html` (texture), capture.py `MAT_ADD` (a 3 in
box in `world.scene`, MeshStandard, texture top toward the building, tint #d0d0d0 so the cream sits in the scene's
light), `orbit` (yaw/pitch/push on the output clock, cubic leaving at 0.5x mean speed and arriving at 0), `mat_deg`
per frame, `--probe` framing along the orbit against the square crop; qa.py.

**One storey:** the armoury is now ONE armoury room (stack of one, seed 5301: door on S at x 12.5); the inn is
`makeBuilding` TAV seed 7 with `storeys: 1` (the generator's own parameter) and `outbuildings: false` (front door
double-grand at (40, 40), S). No storey tour fires for either. Measured at 1x: armoury last piece 4.150 s (78 pieces);
inn 5.133 s (438 pieces, cellar plays after, under the ground).

**Speeds:** armoury 1x (settles 4.15, 0.85 s held square before the card). Inn x1.19 (fit last_land at 4.3): at 1x it
would settle at 5.13, under the card; the speed-up was the smallest that leaves a held beat.

**Mat squares** (near edge within 0.5° and staying): 3.83–3.92 s on the armoury cuts, 4.02 s on the inn; edge exactly
0° from the orbit's end (4.15 / 4.31). Framing checked numerically: building rect to 11 ft + mat corners stay inside
x 420..1500 (the square crop) along the whole orbit for every shot (M2 needed dist 72, not 66).

**Font:** cards and mat are set in Inter from `engine/client/vendor/inter` (what turnipworks.net ships: site chrome,
brand, game UI). The loading screen's name asks for Georgia, which only exists on Mac/Windows viewers; the card had
fallen back to Noto Serif here. Name 700 at -.015em (Inter wants negative tracking at display sizes), phrases 800.
cards.py now fails if Inter did not load. (V1–V11 finals were encoded with the old serif cards; re-render to update.)

**Checked, not a defect:** Gemini said once the ground grid "shows through" the mat. Measured: grid on vs off differs in
the mat interior less than two grid-on screenshots a moment apart (real-time fire flicker); the GridHelper is
depth-tested under the mat's top. The house look has no sun shadow outdoors, so the mat gets no building shadow;
thickness (3 in) and the dark binding are its physical cues.

**M7:** the mat spins in with the house's own floor motion (borrowed from a floor piece's anim: backOut, 240° about
y, grows from 0.18), 1.5x slower, from 0.25 s, landed by 1.05 s. **M8:** dist 78 -> 64 along the orbit.

**QA (all eight):** check.py ok on 16 MP4s; 0 stand-ins and 0 fails in every take. Gemini (qa.py, 40 single-image
calls): at 0.2 / 2.5 / 4.8 s it read Turnip Works, FREE · NO DOWNLOAD, NO ACCOUNT · OPEN SOURCE on the mat in every
frame (M7 at 0.2 s: no mat yet, as designed); mat skewed at 0.2 and 2.5, square at 4.8; "printed rug" every time;
building and mat in frame in 16:9 and square; nothing broken; card read right with turnipworks.net. Its one-line notes
are near-identical across calls (it pattern-matches its own phrasing), so read them as weak evidence; the transcriptions
and the skewed/square calls agree with the measured mat_deg. Review copies (CRF 23, slow): 2.3–3.6 MB.

## 2026-10-22 night — zoom depth (Mn-z2/z3/z4) and camera.frame

**Ask (Harry, via the coordinator):** the same cuts (M7 dropped) at several zoom depths, defined by framing: the scene's
extent (building rect up to 11 ft + the mat's corners) as a fraction of the frame width at the END of the orbit.
z1 = the M-series as rendered (end fractions 0.33 M2, 0.37 M1/M4/M5/M8, 0.38 M6, 0.41 M3), z2 0.87, z3 1.0, z4 1.2.
The mat's type must be fully in frame by the end; its border may spill.

**camera.frame** (capture.py FRAME_INSTALL / __promoSolve): bisect dist (log scale) to the fraction, centre the extent,
then shift the focus on the ground (never zoom) so the type's box stays 4% of the short side inside every edge; never
zoom past the type being wider than the frame less 2% a side (capped: did not bind on any shot). Works for any shot.

**Hold vs along the move.** At a corner the extent is much wider than at the front (M4: 1.74x at yaw -70 for the same
distance). Held (frame the end, fly a rigid orbit at that distance): the type is off the frame until 3.55 s on M4-z3,
for most of the shot. Solved along the move: the type is never off the frame, the distance breathes (M4-z3 35.0 -> 28.2
-> 30.5 ft) and the focus drifts ~11 ft to keep the words in. The raw per-frame path had a one-frame turn where the
type's clamp hands over between corners (focus acceleration 0.047 ft/frame^2 at frame 135): the path is now solved for
every frame before the take and Gaussian-smoothed (sigma 12 frames), max acceleration 0.0035, type still in on every
frame. Chosen: along the move (default `hold: 'orbit'`; `hold: 'end'` kept).

**Square:** at z2+ a centre crop of the 16:9 cuts the type (the type is ~75% of the scene's width; the crop keeps 56% of
the frame). So each zoom cut has its own 1080x1080 take (shot `size`, variant `square_capture`), framed the same way
for the square; assemble.py uses it uncropped. 42 takes for 21 cuts, five render.py at once (own ports): ~5 min a take.

**Result (21 cuts, 42 takes):** check.py ok on all 42 MP4s; 0 stand-ins, 0 fails; measured `text_in` true on every
frame of every take (the type never leaves the frame, 16:9 or square); zoom never capped. Mat squares 3.83–3.95 s
(inn 4.00–4.03). End distances (armoury, 16:9): z2 34.6, z3 30.5, z4 25.9 ft at pitch 48 (z1 was 68). Gemini, 105
stills: the mat's three lines read exactly in every scene still, skewed at 0.2/2.5, square at 4.8, no type cut off at
4.8 (or anywhere asked), "printed rug", nothing broken; card read exactly. Review copies 140 MB for the 42.

## 2026-10-22 night — the shot library and the 15 / 30 / 60 s drafts (Fauna, Claude substrate)

**What Harry asked for (overnight).** Calm cuts at real speed, one idea per beat, built from a library of shots that each
carry a label (two letters + a digit, no I/L/O, no 0/1, random, never reused) so he can say "keep these four, swap that
one". Then (relayed mid-run) zoom-depth variants of every scene shot, each its own label in a `family`.

**The rig, generalised (`rig.py`).** capture.py drives one drop; the library's shots drive the real UI. A shot is a script
(`shots/scripts.py`) run against seats (browser contexts, each on its own vclock, stepped together). Things that had to be
solved to keep it frame-exact and honest:
- **Frames never touch the disk.** /mnt/usb is fuseblk and wrote ~9 MB/s under the night's load: a 2 MB PNG a frame cost
  8 s a frame. Screenshots are decoded and piped as raw RGB into one ffmpeg per shot (x264 CRF 16 slow); every 30th frame
  is kept as a JPEG still. ~0.8–1.1 s a frame per lane, three lanes in parallel on their own ports (18531/61/81).
- **CSS / Web Animations on the clock (`vanim.js`).** Menus, toasts, the announce's flight into the chat, the ring's slide
  and the loading screen run on compositor time; each is paused when first seen and its currentTime set from the stepped
  clock every step (finished at its end, so `.finished` promises still resolve).
- **The fog worker (`fogwait.js`).** Sight is computed in a Worker on real time; the rig counts its jobs in flight and
  waits for none before each frame (no pawn flicker between "pending" and "seen").
- **A pointer.** Headless Chromium draws none: the rig draws the game's own cursor image where its CSS sets one, else the
  desktop theme's (Adwaita, read from its Xcursor files by `xcursor.py`). Mouse moves are real pointermove events every
  frame (hover, ghosts, drags and the marquee see them); a press is released within a frame (a 500 ms hold pings).
- **The link reads true (`promosite.py`).** The join shot's invite panel would have printed
  http://127.0.0.1:18532/engine/client/index.html?relay=... — so both windows open https://turnipworks.net/ and every
  request is answered inside the browser from the local relay and site (routes laid out as engine/deploy.sh serves prod;
  the relay WebSocket bridged through aiohttp). Fail closed: the name resolves to an address nothing listens on, and a probe
  path only the routes answer is checked first. Link printed: https://turnipworks.net/#s=<token>. Nothing reached prod.
- **Honest join time.** The player's whole load runs on the stepped clock (network real), which would show the arrival
  in a fraction of a second. So each take first measures a cold browser opening an invite link to the same table on real
  time (2.7 s r1, 3.7 s r2, localhost, cold cache), and the player's window is held (time and the loading screen's own
  animations go on; its frame loop waits) until that long after the link opened. The arrival is never faster than real.
- **Stand-in check** extended: a stand-in under the game's own opaque loading screen is not drawn for anyone (the player's
  first frames on a cold cache); everywhere else a drawn grey stand-in still fails the take.

**Found by Gemini, fixed in r2.** (1) Two stale chat lines "> The Turnip & Tankard: 1 storey · 2 storeys" bottom-left in
every interior shot: a new building's storey offers time out into the chat after 14 s, and the scene was built off camera
(plus the warm-up copy). The offers are now put away at once. (2) Party bases clipping the common room's south wall: placed
inside a 4 ft margin. (3) "6 goblins" places six goblin BOSSES (the bar's top row); now "6 goblin spear". (4) The fireball
caught 8: the wizard and fighter too. The inn's common room is only 25 x 20 ft, so a 20 ft sphere fills it; the party now
stands outside the front door, the aim is nudged away, and a take fails unless exactly the goblins are caught. (5) The
fog shot's hanging chandelier could not be clicked in Mira's "view as" (selection empty, nothing lit): she now lights her
own lantern (`carries light 30`, whose words include "lantern"). (6) The multiselect box selected nothing: drawn now round
the pawns as they are on screen (bases and heads), and a take fails unless all four are selected.

**Not done / dropped.** W2 (spin-out transitions): the engine animates only furniture out (world.js `remove(..., {out})`
for objects whose room went); walls and floors vanish at once, so a building cannot fly apart without an engine change.
W4 (one evening's prep): not attempted (time went to r2 fixes and the zoom variants).

**More found and fixed on the way (r3/r4).** The rig's pointer image was a broken-image icon in the turnipworks.net
windows (the promo site's routes answered its URL): it falls through to the rig's route now (UD5 r3, KK9 r2). The fog
lantern: in r3 Mira's window was filmed and she clicked her scout, but a click in a fogged player window on the stepped
clock selected nothing (the same click on real time did: not chased further); r4 has the GM light her lantern from his own
window, unseen, so the film is purely what the player sees. The marquee was flaky (3 of 4 in the lanes, 4 of 4 in a
repro): the box now starts on probed-empty grass well below-left of the group and takes each base ring with room to spare;
a take fails unless exactly the four are selected. The join's honest hold varies with the box's load: a cold join took
2.7 s (r1), 3.7 s (r2), 4.5 s (r3, five capture lanes running); the cuts' join beats are timed to r3.

**Zoom depth (Harry, relayed mid-run).** `framed()` in shots/scripts.py: the subject (a building's rect up to its wall
top, a room, the group's patch of grass) made `frac` of the frame width, its middle at the frame's middle, pitch and yaw
kept: the same meaning as capture.py's `camera.frame` (the welcome-mat rig, landed while this ran). Mine solves the move's
two ends (bisection on distance, a measured-Jacobian Newton step on the focus) and the drift interpolates; the mat rig's
solves every frame of an orbit. Reconcile later by calling its FRAME_INSTALL. Levels: tight 0.87, edge 1.0, spill 1.2
(spill starts at 1.12, so no frame has empty sides); the build-menu shot has no spill (its drag corners must stay on
screen) and edge at 0.97; the turn shot no spill (the room's label must stay clickable). Measured default fills: spin-in
0.64 at the end of its push, interiors ~0.37, multiselect 0.50. 28 variants, each its own label in its family.

**Review budget.** The first review encodes (1280 wide, CRF 23) passed 50 MB with half the library done. `review.py`
re-encodes every review copy from its master at the end: cuts 1280x720 CRF 25 (60 s: 26), originals 854x480 CRF 27,
variants 640x360 CRF 30, CRF +2 a round until the set is under 59 MB and no file over 12 MB.

**Gemini quota.** agy's Gemini (3.8 Flash and Argon) hit "Individual quota reached" mid-afternoon (shared with the
welcome-mat agent's QA); three dice-variant verdicts came back as quota errors and had been recorded as OK: shotqa.py
now records "NO QA" for an unanswered still. QA resumed when the quota reset.

**Results (Gemini read beat midpoints and the end card of every cut).** Every captioned beat's caption read back
exactly; the end card read FREE · NO DOWNLOAD · NO ACCOUNT · OPEN SOURCE / turnipworks.net. Gemini's flags on the cuts
are about the game's UI, not the rig: the bar's placeholder truncated ("... or sa"), room labels behind the bar or clipped
by the split's divider, base-ring names under furniture. Two flags are the rig's: the 30A/60A join caption sits over the
game's "Copied" toast for a moment, and 30B's fog rug (XF9) never shows (it lies outside the walls, and only what Mira's
lantern lights comes out of the fog), so 30B's last beat reads uncaptioned. UK2 (multiselect at spill zoom) was skipped:
the four cannot all fit wholly inside a box on screen. Review set 43 MB in 57 files (largest 7.7 MB, the 60 s cut).

## 2026-10-22 late — v3: framing, crunched join, large two-level captions, card C5, new demos (Fauna, Claude substrate)

**Harry's review of v2:** "if I wasn't trying to be a perfectionist I'd say ship it". The last 20%: edge/spill framing
by default; crunch the join's load screen; captions much larger; three new uncaptioned-or-new demos (handling a table,
the ring doing something, fog following a player in split screen). Mid-run: captions must NAME the mechanic, then say
what it does (two-level: headline + plain line); the end card is C5 (checklist, dark); goblins out of the common room;
YD7 moves its table before turning it; the ring's icons were missing; the card must be the last frame.

**Framing (one solver now).** `framed()` (shots/scripts.py) calls the welcome-mat rig's `camera.frame` (capture.py
FRAME_INSTALL / `__promoSolve`) instead of its own Newton solver; `__promoSolve` gained `cx`/`cy` (where the extent's
middle goes; the pawns tray shot puts the room right of centre, the 30B rug shots put the scene above centre so the rug
has ground). New: `zoom.keep` (world points the beat needs) and `zoom.fallback`: spill (1.2) is tried first and the shot
falls back to edge (1.0) if any keep point leaves the safe box (5% in from the sides, 12% from the top bar, 10% from the
bottom) at either end of the move; the choice is `notes.zoom.chosen`. v2's zoom variants (SY7, CH6/BQ5, PP8/JW2, QP4,
TZ5, UC3, RJ4, DM3, HZ8) were made by the old solver (same meaning); they are used as they are where nothing else changed.

**Join, crunched (JE2, KU9).** `crunch: 0.45`: the player's window is held only until 0.45 s after the link opens (v2
held it to a cold join measured in the same run: 7.68 s this time, 3.9 s for KU9's run, the box busy with five lanes).
Measured: the arrival at 0.45 s, the loading screen on 39 frames (0.65 s, its own fade-out included). The player's view
is set under its loading screen to the GM's framing. Registry descriptions say "load time shortened".

**Ring icons: the rig's bug, not (only) the game's.** The painted ring pictures (`tools/spawn-tuner/assets/ui-icons/
charcoal`, `parchment`) are git-ignored and were not in capture.py's `IGNORED` link list, so in every worktree take the
ring's buttons were `painted` with images that 404'd: blank. Every v2 ring shot (QV3, YD7, MC3, the zoom variants, KK9...)
was filmed that way. Fixed: linked; the rig preloads the house set (149 pictures, decoded) before the freeze and holds a
frame (real time, up to 4 s, else a fail) while any `#ring img.paint` is undrawn. On dev (http://127.0.0.1:8180/, a fresh
browser context = cold cache, localhost), the first ring opened 0 s and 3 s after the table was up showed all four
painted pictures on the first poll (49-64 ms after the click; 0 ms blank at 8 ms polling, 6 tries): on localhost a real
player would not see it blank; over a real network the first open would wait one round trip per picture.

**New shots.** FF2 (handling + the ring): click the table, press again 12 px off the click (the same spot cycles the
selection down the stack, input.js: r1 dragged the rug under the table), drag it 7 ft aside, the ring's Turn clicked twice
(45° a click), then the fireplace (put out before the shot) -> the ring's All options -> Light. BX6 (fog walk, split):
in the PLAYER's window she drags her own scout from the hallway through its door into the common room, lets go (fog rolls
back), then out of the front door onto the grass. A click and a drag in a fogged player window work on the stepped
clock (probed); v2's dead click was in darkness, beside a wall. The fog follows the committed position (fog.js reads
entities, not local drags): it rolls back on each drop, not during the drag; the GM's window sees the token move live.

**Captions.** caption.html: headline 12.4vh (2.7x v2), stepping down to no less than 9vh to keep one line; the plain line
6.4vh; lifted to 12% above the bottom; a full-width soft dark band and a strong shadow. Square layout (?sq=1) for the
1080 checks. 30B rugs: two-level too, and sized by the rig (`rug.fit`, RUG_AUTO: the biggest rug whose corners lie on
clear ground inside the frame, outside every room and `avoid` rect, inside the lantern's reach for the fog beat). Rug
lessons: an empty `fit: {}` read as "no fit" and laid KU9 r1's rug at the origin; a spin-in's building does not exist at
the freeze, so its footprint must be in `avoid` (KP7 r1's rug lay where the inn then landed).

**End card C5** (card-c5.html, from the card-variants round): brand panel left, four gold ticks with glosses; square
stacks the brand as a band. Held 3.0 s in the 30s and the 60, 2.2 s in the 15s, 3.4 s in W5. cut.py `--card`, a cut's
`end.card` or TW_PROMO_CARD swap it (card-4.png is the old card.html look). cut.py now checks the last frame and the
frame 0.5 s before it against the card PNG (mean difference < 4/255): the card is the last frame, fully drawn.

**pkill self-match, again:** `pkill -f "shoot.py ..."` from a bash line that contains the pattern kills that bash too
(twice tonight). Anchor: `pgrep -f "^python3 tools/promo/shoot.py"`, kill by PID.

**v3 results.** Seven cuts (15A, 15B, 15C, 30A, 30B, 60A, W5), 17 new or re-rendered shots, every take 0 fails; cut.py
ok on every master and review copy, the last frame and the frame 0.5 s before it equal to card-c5.png (mean diff 1.3/255).
Gemini: every overlay caption read exactly, complete, "at a glance", contrast "strong", at 1920 and in the square layout
(30A 10/10, 60A 22/22, W5 2/2); card C5 wide and square: nothing clipped, bold lines strong, glosses "ok"; the last frame
of each cut read as a complete card. Its flags on the cuts are the game's UI (the bar's "... or sa", truncated base
names, the breadcrumb over a room label), a transient "8 caught" while TW9's sphere rides from the wizard, and in 30B the
fog beat's rug comes out of the fog only from 8.4 s of UR4 (the beat was moved to 5.8-10.4 so it reads for 2 s).
Rendered-but-wrong caught by Gemini only (0 fails each): KU9 r1 and KP7 r1 rugs (see above), UR4 r2 (its relay was
killed mid-take by another agent's test run on the same port, 18911: "The table is reconnecting..."; r3 on 19437).
Not done: the join was not re-shot with the placeholder pawn (it landed on main mid-run, 881c17ce; v3's join shots are
from the branch point bea26e7e). Review set 51.5 MB, largest 6.7 MB (60A at CRF 28).

## 2026-10-23 — v4: feed shapes (1:1 and 4:5 of the approved 15C, 30A, 60A) (Fauna, Claude substrate)

**Ask (Harry approved 15C, 30A, 60A on 2026-10-23; the coordinator relayed):** feed-placement versions of exactly those
three, the same shots, order, in/out and caption text: 1:1 (1080x1080) required, 4:5 (1080x1350) if the rig extends at
reasonable cost. Every shot its own take framed for the shape (the 16:9 takes are framed edge/spill: a centre crop cuts
the action or the ring).

**What filmed what.** The approved takes were all filmed on the engine as it was from bae15ade to bea26e7e (the v3
branch point; v2's SY7/QP4/TZ5/RJ4/UC3 too: engine/ and the tuner did not change between). main has since gained the
placeholder pawn (802f0cb5: the invite places a pawn and a joining player's first view centres on it), which would change
JE2's picture. So the twins film a detached worktree at bea26e7e (`TW_PROMO_GAME_REPO`, new in capture.py) while the rig
runs from this branch: same game, same house look (read from the ratings server through the sandbox, as always).

**The rig.** `Rig(size, page_scale)`; a shot's params `size` and `page_scale`. Each page is drawn at size / page_scale
CSS px and scaled down to the frame (Lanczos): at 0.8 the game lays out on a 1350 px wide page. Why: at 1080 CSS px the
open command bar (680 px, centred) runs over the Settings launcher (probed; Gemini saw it in 1080x1080 and 1080x1350
probes; at 1310+ px it does not). Hard-coded page points in the scripts (where the pointer rests, the end of a glide)
were written for a 1920x1080 page: `px(S, x, y)` puts them at the same place on any page. camera.frame already solves
on innerWidth/innerHeight, so `framed()` and the keep-in boxes solve for the new aspect unchanged; spill (1.2 of the
WIDTH) leaves the square and the 4:5 more ground above and below than 16:9 did.

**Split screens stacked.** In a frame taller than 4:3 a split puts the GM's window above the player's, each under its
own name band (split.html `?stack=1`, `rig.pane_xy`): panes 1048x476 on the square (pages 1310x595), 1048x611 on the 4:5
(pages 1310x764). Side by side in a square would give two 516 px wide portrait windows: the game's top bar alone is
wider than that. Stacked, each window is a short landscape window, the scene reads in both, the link and the arrival
(JE2) and the fog walk (BX6) stay whole.

**Labels.** Every twin is a new label in its shot's family (`library.py shape square|4x5 LABEL...`): `shape`,
`shape_of`, the 16:9 shot's params + size + page_scale; the 16:9 shot carries `shapes: {square, 4x5}`. cut.py `--shape`
builds a cut from the twins of its beats (the cut file is the 16:9 one: same list, in/out, captions, end), writes
`<cut>-<shape>.mp4`, its captions in the shape's layout (caption.html `?sq=1` square, `?shape=4x5`; sized on the frame's
width, checked inside the frame), end card C5 in the shape (card-c5-sq.png existing; card-c5-4x5.png new: the square's
stacked band, taller, the type larger; cards.py `--feed`, fit check), the last-frame card check as for 16:9.

**Split-beat captions over the GM's window.** In 16:9 a split beat's caption (bottom-left, max 26ch) lay over the GM's
(left) window only; the player's window stayed clear. Stacked, the default bottom caption landed on the PLAYER's window
(BX6's three-row caption is 328 px of a 1080 frame: most of a 476 px window; Gemini: Mira and her ring under it). Tried
centred on the band between the windows (`mid`): each window lost a strip, and the player's ring at her first stop was
still under it. Chosen: `caption.html ?above=Y`, the words ending 24 px above the GM window's bottom (cut.py does it for a
beat whose twin's layout is split; EDL `caption_at`). The player's window is clear for the whole beat; the GM window's
lower part is covered (its Mira at the yard, its chat bar, JE2's fighter), as the 16:9's left window's was.

**Takes that passed with 0 fails but were wrong (Gemini, or a probe):**
- RJ4 twins r1 at 0.97: the drag started under the build tray (17.5% of a 1350 px page; 12% at 16:9): no rooms, the take
  failed in its warm-up. r1 at 0.75/cx 0.575 then cut the drag's size label ("60 × 40 ft · 12 rooms") at the right edge.
  r2: keep A and B inside x 0.22..0.82, frac 0.7 (square) / 0.67 (4:5), cx 0.52. Label whole (Gemini).
- FF2 twins r1 at spill 1.2: the ring's Pin ran over the Common room label just above it ("ComnPin room"; 16:9 FF2 has 29
  px between them, and a square page has 0.84x the px per ft at 1.2). r2 at spill 1.5 (start 1.41, the 16:9 move's 6%
  push; keep-in probed at 1.4 and 1.5): no overlap flagged.
- BX6 twins: r1 square failed keep-in even at edge (the walk in a 1048x476 window); r2 (fallbacks to 0.6) ended with Mira's
  ring cut by the window's bottom edge / the divider; r3 square / r2 4:5 keep her ring and nameplate (`keep_ring` 3 ft
  round every stop): square 0.55, 4:5 0.7. Small, but the whole walk is in both windows.

**Timing.** Every twin has the 16:9 shot's frame count exactly (26 of 26) and its scripted events on the same frames
(the join's arrival frame, the fire beat, the turns; `held_frames` 24 -> 25 on the join), so the cut files' in/out serve
the twins unchanged. Differ: the dice's numbers (QP4 rolled 17; the square 13, the 4:5 27: Rapier is not stepped from the
seeded clock); the RJ4 drop's quiet time 5.25 -> 6.18 s (after the 60A beat ends: the storey tour's fly is longer from a
farther camera); the join's measured cold load (recorded, not shown: the load is crunched).

**Framing chosen** (frac of the page width): spill 1.2 for SY7, JE2, BQ5, JW2, QP4, TZ5, UC3, TJ5 twins (FF2's 1.5; at
16:9 FF2 was edge: the square's height lets the ring fit); edge 1.0 for DM3, HZ8 (as 16:9); RJ4 0.7 / 0.67; BX6 0.55 / 0.7.

**QA.** check.py-equivalent checks (cut.py): all six masters h264 High yuv420p 60/1, exact frame counts (900/1800/3600),
one stream, faststart, no flat frame; last frame and the frame 0.5 s before it = card C5 of the shape (mean diff
1.36-1.42/255). Captions: every one inside its frame (cut.py's new check); capqa.py read all 32 captioned stills of
30A/60A in both shapes exactly, complete, "at a glance", contrast strong (the four split beats were read again by
feedqa.py after the move over the GM window: exact, complete). feedqa.py (new): 3 stills a beat off the shape cuts + the
last frame, ~170 Gemini calls in all. What it flags that is NOT the rig: the game's UI (room labels under the top bar or
cut by the top edge, "Small-folk rog...", the roster's "Fauna-prom...", tooltips overlapping, the ring's sub-menu label),
pieces mid-spin read as "floor tiles clipping", the ring chandelier read as "on the floor", the fog's remembered-area
checker read as "placeholder texture" (the approved 16:9 BX6 shows the same pattern: asked of both), "grey placeholder
boxes" in the stable as the inn drops in (the rig's per-frame stand-in check: 0), the spill framing cutting the sphere
template's outer edge and, in the 4:5 JW2 beat, the party's rings at the bottom edge while the sphere leaves the wizard.
Card C5 4:5 and square: every line read, nothing clipped, legible on a phone.

**Delivered:** finals/15C-square.mp4, 15C-4x5, 30A-square, 30A-4x5, 60A-square, 60A-4x5 (+ .edl.json, -last.png), copied
into finals/approved/2026-10-23/ with their sums appended to SHA256SUMS (the 16:9 entries untouched; all 28 verify).
Review set scratchpad/promo-review/v4/ (manifest.json; 6 cuts at 720 wide, 26 twin clips at 640; 38.5 MB).

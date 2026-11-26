# Meshy batch 2 (lane `meshy-batch`), lab notes

2026-11-10. Harry, in the parent session: "drop an agent to run the stuff like shelves that we are going to get 'huge wins'
from thru the meshy pipeline please" (after the 11/07 store-shelving / server-rack drop-ins: "WOW, like huge improvement...
figure out what else is worth replacing like that"). Input: today's ranking `experiments/2026-11-10-meshy-candidates/`
(RANKING.md, CANDIDATES.json). Batch: 25 skus over 14 catalog ids, $15 hard cap including retries.

## Pipeline (what ran)
- Plates: three Codex workers (`codex exec`, built-in image_gen, ChatGPT plan, no API key), briefs from
  `tools/make_briefs.py`: the house "heroic hand-painted miniature" frame, a setting line per genre, the CATALOG size in
  inches plus "its depth is only N% of its width", three-quarter view from above with one side panel visible. Existing
  plates passed as references where they were on this machine (curio, both casks, terminal, wire, vending, inn back-bars,
  cooling); the wizard/mansion/temple/market/China plates are not on the build box. `tools/feed.py` pads each plate to a 10%
  margin and zeroes alpha < 40 (the workers reported faint halos and tight margins), then submits.
- Meshy: Smart Topology meshy-t2.5, 10k, 2K base colour, remesh + texture in ONE task (`tools/meshy_i2m.py` t25, the
  11/07 client). Key: `tools/with_meshy_key.sh` exports it from the credential registry for one command, never echoed.
  Every task came back at 8.8k-10.5k triangles with one map, median ~45 s.
- Gate (`tools/gate.py`): props scale uniformly by their largest side (solver.js), so world width/depth = bounds x
  (catalog largest / mesh largest). PASS if width AND depth are within 10% of the shipped mesh's OR within 10% of the
  catalog box. Why both: the brief says "10% off the shipped record" and also "prompt at catalog proportions", and the
  shipped TRELLIS meshes are themselves 20-75% deeper than the catalog (cask-rack D/W 0.70 vs 0.42, apothecary 0.52 vs
  0.20), so either reference alone contradicts the other instruction.
- Runtime prep and drop-in: `integration/dropin.py` (the 11/07 pattern: same sku, `was` keeps the shipped mesh, `rev`,
  `src` = `meshy-02`, prep files `*-zz-meshy-batch*`, takeover), built in worktree `3d-vtt-meshyb` (branch `meshyb`).
- Judging: `tools/render_pairs.py` (the 11/07 render_game.py per sku): the real engine on private ports, the sku in its
  own room type (every thing of its category swapped to it) at a close view, and alone at zoom distance. Before = main's
  library, after = the drop-in. `tools/judge_pairs.py`: blind Gemini via agy-run (`< /dev/null`, isolated tmp folder,
  random 6-hex names, pair order shuffled, name map kept outside). Clear win = after better in BOTH pairs, "clear", and
  mean score (reads_as / clean / detail) up by >= 1.5.

## Results
- Round 1 (25 tasks): 24 of 25 FAILED the gate. Cause measured, not guessed: a blind Gemini read of the plates put the
  bookshelves at D/W ~0.52 against the catalog's 0.35, and Meshy reproduced the plates faithfully (0.54). image_gen draws
  shelving too deep and too tall-and-narrow whatever the inches say. Only apothecary-drawers--s2 passed (8.7% off shipped).
- Round 2 (24 re-plates, each told its measured error: "came out W:D:H = a:b:c, must be x:y:z, draw it N% shallower",
  the first plate as reference): 7 more passed: back-bar-shelves--mod, cooling-unit, organ-pipe, shelving-wire,
  shop-shelf-stocked--apoth, shop-shelf-stocked--general, terminal-desk. 17 given up (rule: re-plate once). Near misses
  at 12-15% off the catalog: bookshelf--fine--s1/s2/s3, bookshelf--arcane--s2, alch-reagent-shelf-tall--s1,
  apothecary-drawers--shop, chn-bookcase; vending-machine missed on both references by 10.6-10.7%.
- Blind before -> after (mean of the two pairs, 0-10):
  - terminal-desk 5.2 -> 9.3
  - shop-shelf-stocked--general 4.0 -> 9.3
  - organ-pipe 3.8 -> 9.3 ("severely melted and fragmented" -> "individual pipes, dual manuals, and stops")
  - shop-shelf-stocked--apoth 6.0 -> 9.0
  - apothecary-drawers--s2 5.0 -> 8.8
  - back-bar-shelves--mod 5.2 -> 8.8
  - shelving-wire 3.2 -> 8.3. Its room-close pair was hidden behind a wall in both versions, so it was re-shot from above
    (`ROOMVIEW=high`, the same view both sides) and re-judged once.
  - **cooling-unit REJECTED**: it won alone (5.0 -> 8.0) but lost its room twice, the close view and the high view
    (8.3 -> 4.3: "clips through the partition wall", "rounded glowing handles instead of cooling vents"). The solver
    footprints were measured in game (x 26.41-29.45 against the wall at 29.5, no overlaps) and the runtime GLB is
    centred, so I could not reproduce the clipping. That is an open question; it is not a clear win either way, so it was
    reverted (its build is on USB `rejected-builds/cooling-unit/`).
- Spend: 1,510 -> 775 credits = 735 (49 tasks x 15), **$14.70** at Pro's $0.02 a credit, under the $15 cap. 0 Meshy
  task failures. Codex image_gen and Gemini on subscriptions ($0).

## Integration (7 skus)
- Suites with the drop-in (worktree): mod 336,160 / 0, cyb 169,441 / 0, market 295,782 / 0, wizard 219,574 / 0,
  temple 342,929 / 0, faiths 63,862 / 0, mh 49,896 / 0, meshy_dropin2 35 / 0 (32 of 40 fail on the library before it),
  sku_guard OK, assets_check 0 missing.
- Golden: see the landing entry below; every difference is in a room type that places a swapped category, and nothing
  else moved. The new meshes are closer to catalog proportions than the TRELLIS ones (mostly narrower and shallower), so
  more of them fit along a wall.

## Shop-shelf-stocked pilot (2 of 13 skus)
Both won clearly (general 4.0 -> 9.3, apoth 6.0 -> 9.0), but both needed the re-plate to pass the gate: 4 tasks for 2
skus. The other 11 trade skus (bakery x2, curio x2, general--s2, apoth--s2, smith, tailor x2, mde, rus) look worth paying
for: ~11-22 tasks = $3.30-$6.60, plus Codex plates. Not run, per the brief.

## Things that broke (and the fix)
- A transient Meshy TLS handshake timeout killed the feeder loop twice: feed.py now retries a failed pass.
- `~/.codex/config.toml` was changed to `gpt-6.1-sol` mid-lane (14:20, not by this lane); a ChatGPT login refuses that model.
  The re-plate workers run with `-m gpt-6-astra`; the shared config was left alone.
- The worktree had no `engine/node_modules` (link_main_binaries skips them): linked to main's for the relay.

## Landing (main 86433082 + this entry), dev deploy
- Golden vs pre-landing main 4d8e17a7: 143 of 2,820 scenes differ, all in the 14 room types that place a swapped
  category: cathedral 5, cathedral-dark 2 (organ-pipe), wiz-lab 12, wiz-store 12, wiz-apothecary 9 (apothecary-drawers),
  mkt-general 12, mkt-apothecary 11, mkt-backroom 9 (shop-shelf-stocked), mod-bar 12 (back-bar-shelves), cyb-server 12,
  cyb-rigger 12, cyb-safehouse 12 (terminal-desk), mod-kitchen 12, mod-service-corridor 11 (shelving-wire). No other room
  type moved. Mechanism: the solver scales props by their largest side, so a mesh closer to the catalog's shallow,
  slimmer box takes less floor; the samples show sub-foot shifts (organ-pipe 0.2-0.7 ft along its wall) and more units
  along a wall where the old ones were oversized.
- `integration/land.py` (inside /tmp/tw-main.lock): ff main to meshyb, 105 built files (15 per sku) copied into main by
  name, the shipped originals backed up to USB `lanes-2026-11-10/meshy-batch/main-shipped-backup/`. In main:
  meshy_dropin2 35/0, meshy_dropin 15/0, sku_guard OK. `tools/spawn-tuner/deploy.sh` exit 0 (delivery rebuilt the 7
  names' compressed copies).
- Dev check: library.json on dev names the 7 meshy-02 meshes; each delivered f10000 GLB and t256 colour map answers 200,
  runtime GLB sizes equal the build's. A real browser on dev (throwaway TEST campaign) placed all 7: each fetched its
  NEW delivered token (e.g. organ-pipe.e32af3b8), 0 page errors. Live (turnipworks.net) untouched: promote is Harry's.
- Undo, if wanted: `dropin.py undo` (library records back) plus the USB backup copied over the 7 names, then deploy.

## Review page for the size-gate rejects (2026-11-10 evening, presentation only)
- Harry thinks the 17 gate rejects (plus cooling-unit, reverted on the "clips the wall" read) may be fine anyway. Run
  `meshy-depth-1110`: https://implausible.enterprises/projects/turnip-works/review-meshy-depth/ . Per sku: the shipped
  mesh, meshy plate 1, the re-plate (cooling-unit also its reverted runtime build), 55 entries, each with W/D/H and the
  % off shipped and catalog box in its hint line. Meshes are the raw t25 GLBs the gate measured (USB `meshy/`).
  `tools/build_review_depth.py`, then `REVIEW_SRC=web/review-meshy-depth REVIEW_KEEP_META=1 src/deploy_review.sh <dest>`.
- Deep links (new in web/review/review.js, every page): `?sku=<asset>` or `#<asset>` opens one entry; `?sku=<sku>` here
  opens the group (Role filter narrowed to it). Test `tests/review_deeplink.py <url>` 9/9 on the live page;
  `tests/reviewer_hotkeys.py` 12/12 on inn-01 data with the new review.js.
- **The gate measured four skus against the wrong box.** gate.py takes the catalog OBJECT's size; the solver takes the
  sku's own size first (solver.js 157). bookshelf--fine--s1/s2 are 48x16x96 in game (not 40x14x78): both re-plates are
  W -10%, D +0/+1% of that box, i.e. at the pass line. bookshelf--fine--s3 is a LOW shelf (54x15x42) and both plates
  drew a tall bookcase: a shape miss, not a depth one. bookcase-ladder 96x30x104 (small change). The page's hint lines
  carry an "in-game" figure for these four.

## The 18 flagged meshes, dropped in too (later 2026-11-10, on Harry's review)
Harry looked at every size-check reject on the review page (`web/review-meshy-depth/`, c12ab45f): "all of these are like
litterally amazing! way better. None of these should be disqualified." All 17 size-check rejects plus cooling-unit are now
under their shipped skus (25 meshy-02 skus in all).
- **Which attempt:** the one closer to the box solver.js PLACES (`Ctx.dims`: `sku.size` when the sku has one, else the
  catalog), worst of W/D/H. `work/choice-18.json`. The gate had a bug here: four skus carry their own size (bookcase-ladder,
  bookshelf--fine--s1/s2/s3) and it measured them against the catalog. Re-plate chosen for 13, plate 1 for 5 (bookshelf--fine--s3,
  cask-rack--s2, chn-bookcase, curio-shelf; cooling-unit takes its re-plate). Per sku, shipped -> new (ft, W x D x H):
  - alch-reagent-shelf-tall--s1  re-plate box(catalog) 4.0x1.17x7.0  ft W x D x H 4.95x1.77x7.0 -> 3.64x1.34x7.0  footprint -44%  off box 15%
  - alch-reagent-shelf-tall--s2  re-plate box(catalog) 4.0x1.17x7.0  ft W x D x H 4.97x1.86x7.0 -> 2.99x1.26x7.0  footprint -59%  off box 25%
  - apothecary-drawers           re-plate box(catalog) 5.0x1.0x6.0  ft W x D x H 5.33x2.76x6.0 -> 5.13x1.16x6.0  footprint -60%  off box 16%
  - apothecary-drawers--shop     re-plate box(catalog) 5.0x1.0x6.0  ft W x D x H 4.34x1.45x6.0 -> 4.96x1.12x6.0  footprint -12%  off box 12%
  - back-bar-shelves             re-plate box(catalog) 5.0x1.17x7.0  ft W x D x H 7.0x1.38x5.77 -> 5.15x1.53x7.0  footprint -18%  off box 31%
  - back-bar-shelves--s2         re-plate box(catalog) 5.0x1.17x7.0  ft W x D x H 4.38x2.26x7.0 -> 4.7x1.42x7.0  footprint -33%  off box 21%
  - bookcase-ladder              re-plate box(sku.size) 8.0x2.5x8.67  ft W x D x H 8.64x2.93x8.67 -> 7.08x3.3x8.67  footprint -8%  off box 32%
  - bookshelf--arcane            re-plate box(catalog) 3.33x1.17x6.5  ft W x D x H 3.97x1.74x6.5 -> 2.67x1.4x6.5  footprint -46%  off box 20%
  - bookshelf--arcane--s2        re-plate box(catalog) 3.33x1.17x6.5  ft W x D x H 3.91x1.92x6.5 -> 3.83x1.28x6.5  footprint -35%  off box 15%
  - bookshelf--fine--s1          re-plate box(sku.size) 4.0x1.33x8.0  ft W x D x H 4.85x1.71x8.0 -> 3.6x1.34x8.0  footprint -42%  off box 10%
  - bookshelf--fine--s2          re-plate box(sku.size) 4.0x1.33x8.0  ft W x D x H 5.69x1.89x8.0 -> 3.6x1.35x8.0  footprint -55%  off box 10%
  - bookshelf--fine--s3          plate 1  box(sku.size) 4.5x1.25x3.5  ft W x D x H 4.5x1.65x3.09 -> 2.41x1.05x4.5  footprint -66%  off box 46%
  - cask-rack                    re-plate box(catalog) 6.0x2.5x5.0  ft W x D x H 6.0x4.23x5.5 -> 6.0x3.1x4.54  footprint -27%  off box 24%
  - cask-rack--s2                plate 1  box(catalog) 6.0x2.5x5.0  ft W x D x H 5.87x4.07x6.0 -> 6.0x2.86x3.83  footprint -28%  off box 24%
  - chn-bookcase                 plate 1  box(catalog) 4.0x1.5x6.0  ft W x D x H 3.7x2.08x6.0 -> 3.45x1.46x6.0  footprint -35%  off box 14%
  - cooling-unit                 re-plate box(catalog) 6.0x3.0x6.5  ft W x D x H 6.5x3.54x4.68 -> 5.54x3.09x6.5  footprint -26%  off box 8%
  - curio-shelf                  plate 1  box(catalog) 5.0x1.33x7.0  ft W x D x H 5.53x2.42x7.0 -> 4.57x1.7x7.0  footprint -42%  off box 28%
  - vending-machine              re-plate box(catalog) 3.33x2.83x6.33  ft W x D x H 3.33x3.19x6.33 -> 3.69x3.04x6.33  footprint +6%  off box 11%
- **dropin.py** now takes the drawn runtime GLB's extent when prep's record differs by more than 2%. That happened once:
  alch-reagent-shelf-tall--s1, depth 0.186 recorded vs 0.182 drawn at every tier. meshy_dropin2 125 / 0.
- **Suites** (worktree, all 25): 0 failures in mansion 484,899, cult 136,496, cultures 157,391, wizard 241,033, mkt 295,960,
  cyb 169,682, mod 336,160, dense, mh, tem, faiths, focal, zones, stacks, logcabin 916,015, wall_items, wallfit, repeat 342,595,
  halls, shaped, hut 453,759, wallkit. Three red, none caused by this:
  - solver2: 743 failures on main, 739 with it.
  - yard: 273 on main, 273 with it.
  - resting: 1 new failure, a tun-large 0.13 ft off the floor in cellar 5x4 seed 443. The shallower cask-rack--s2 left room for
    a tun-large there. That mesh floats on main too (main, 40 seeds: seeds 645 and 746, 0.13-0.14 ft against REST_TOL 0.12).
    Latent tun-large asset defect, not fixed here.
- **Golden:** 1,555 of 2,820 scenes differ.
  - 397 are in the 39 room types that place a swapped category.
  - 1,158 are in 179 other types, and those differ ONLY in their "inn" scenes. golden's inn arrangement attaches a common room,
    whose cask-rack and back-bar changed.
  - Sole exception: temple-infirmary's legacy v1 solve places apothecary-drawers.
  - So every difference traces to a swapped mesh.
- **Layout shift per room type**, from the conflict probe (`work/conflicts-18*.json`; 39 room types x 3 sizes x 16 seeds, old
  vs new library):
  - The new meshes are narrower and shallower, mean footprint per piece 25-60% smaller, so more pieces fit: cellar 178 -> 242,
    cult-library 509 -> 782, mansion-library 479 -> 759, wiz-store 528 -> 790, cyb-talisman 342 -> 469, cyb-server 147 -> 258.
  - Vending-machine is the only footprint that grows (+6%), so cyb-noodle, capsule, lobby and office-corridor hold slightly fewer.
  - Doors: 0 door-cell hits before or after, every room type.
  - Windows (tall piece in a window cell): mansion-library 121 -> 23, the rest flat.
  - True 3D intersections (plan AND height overlap) fall or hold everywhere (cellar 16 -> 0, wiz-store 31 -> 23) except
    cyb-server 83 -> 88 (terminal-desk with its own desk-top keyboard/laptop/cup, the existing pattern) and cyb-noodle 22 -> 23
    (vending machine under its neon sign, existing pattern).
  - cooling-unit: 0 intersections anywhere.
- **bookshelf--fine--s3:** its sku.size is a LOW shelf (54 x 15 x 42 in). Both Meshy attempts are tall bookcases, so in game
  it is a 2.4 x 1.05 x 4.5 ft bookcase.
  - Placed only by the libraries' "bookcase" wall rule (mansion-library 169 -> 245, cult-library 176 -> 300), never under
    counters.
  - Window cells 98 -> 0 (the 3.1-ft shipped one stood under windows; the solver keeps the 4.5-ft one off them). Overlaps 0 -> 0.
  - No room breaks. It reads as one more narrow bookcase; the low-shelf intent is lost.
- **Gate fixed for future runs** (`tools/gate.py`):
  - measures against the PLACED box, all three sides;
  - output is `ok` / `review`, and `review` means look at the pair, never reject.

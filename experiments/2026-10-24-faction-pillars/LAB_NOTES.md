# Faction pillars and piers (2026-10-24)

Harry: "how is our pillar collection? I think pillars for each faction would be super helpful." New slot `flavor-pillar`
(free-standing column, 30x30x120 in nominal, one storey, placed by hand, snaps like a post) for all 13 factions; and the
9 empty `flavor-buttress` (pier) slots. Dragons first: Harry is building a Dragon Cult one-shot.

## Route (as the repo does it)
- Plates: Codex worker (`codex exec`, its built-in image_gen, ChatGPT plan; no API key), briefs `BRIEF-*.md` written by
  `tools/write_brief.py` from `assets.json` (`tools/make_specs.py`: the factions-01 text-only house template, each
  faction's factions-01 corbel palette so pieces join their family). Worker logs: `LOG.md`, `LOG-buttresses.md`.
- Plate gate `tools/gate_plates.py`: measured alpha/margins, then an unprimed blind read of small JPGs on grey (neutral
  names, labels read first, 3 a call) and a text-only match, all through `agy-run` (the Gemini subscription). The
  factions-01 gate called `gemini-vision.py`, the paid API, blocked since 2026-10-20.
- Meshes: TRELLIS.2 on fal ($0.30 each) for the dragon handful; the 12 other pillars in one RunPod wave (A100).
- Mesh gate: `tools/qa.sh` (factions-01 copy; Blender tiles + measurements + the rules), vision switched to agy-run, serial.
- Orientation: `integration/orientation_prepare.py` (five views) + `integration/orient_read.py` (agy blind front read).
- Runtime: `integration/runtime.sh` (runtime mesh, LODs, textures, measured orientation) in the worktree, binaries
  synced into main by `integration/sync_binaries.sh` (no overwrite; identical or refuse).

## Log
- 12:18Z dragon pillar: plate accepted (blind: "pillar / dragon"), fal 116 s, mesh gate accept ("dragon pillar", 0.95,
  reads clearly at distance), 2.9 x 3.7 x 10 ft. Front = view A (blind, 0.95) -> yaw 0.
- Dragon pier, plate v1 (landscape, "footing 8 ft away"): reads as a flying buttress (0.95) but the dragon head faces
  sideways and the mesh came out 9.0 x 4.5 ft and only 5.8 ft tall: the rule gate refuses (squarer by 1.82x).
- Plate v2 (square, "about as tall as it is long"): the mesh became a three-legged archway (Gemini: "fantasy archway",
  fails). The square v2 plates of the other eight piers are set aside in `plates/v2/` unmeshed.
- Plate v3: side-on profile, one flat-sided slab 2.5 ft thick, nothing projecting sideways, pier the tallest part.
- Spend so far: fal $0.90 (dragon pillar, dragon pier v1, v2).
- 13:27Z Dragon pillar LANDED on dev: main 2591270a, candidate 20261024-062725-2591270a; dev browser_faction_pillars 34/34.
- Plate v3 dragon pier: fal mesh accepted ("flying buttress", 0.9), 3.9 x 9 x 7 ft at auto scale; shipped at that box.
  Pier orientation: two conventions in the house. tem-01 sun/moon put the pier at +Z (in the room, the half-arch leaning
  back to the wall: architecturally right); cult-01 devils/spiders are the other way round (measured with
  integration/pier_end.py: their tall end lands at -Z). New piers follow sun/moon. Open for Harry: flip devils/spiders?
- 13:58Z Dragon pier LANDED on dev: main 3a9779d1, candidate 20261024-065802-3a9779d1; dev browser_faction_pillars 38/38;
  golden 0 differences, temple 342888 / cult 126959 checks 0 failures; a dragon cathedral rolls 4 piers (16 over 4 seeds).
- RunPod: one A100 pod 3phy8vpkh9qjvl, 12 pillars in one wave (median 43 s a mesh), 0.228 h x $1.79 = $0.41, deleted
  and verified (GET 404). The batch's one pod is used (pod-ever-created): the eight remaining piers go to fal.
- agy-run is the bottleneck: several agents share it; one four-tile mesh read took 3-14 min. The mesh gate's text-only
  match step is now batched into one call (BATCH_MATCH=1 in tools/qa.sh).
- "Pedestal" reads (devils, forge-hammer pillars): with no ceiling over it a flat-topped column reads as a pedestal;
  second guess "pillar" both times; accepted by the match.
- 12 RunPod pillars: all accepted by the mesh gate (sword-shield after one agy timeout and a re-run; it reads as a "chess
  rook" because of its crenellated top, sword and shield on every face). Pillar orientation: the blind sheet reads timed
  out on all three sheets; yaw 0 by a reviewed decision (a column with its motif all round, turned by hand with R).
- Eight v3 pier plates: 7 accepted, forge accepted by measured override (alpha box 7 px from the frame against an 8-px
  threshold; the blind read calls it whole). fal: 7 piers $2.10, forge $0.30; nature's first mesh had an open top
  (mesh gate reroll-mesh), its second ($0.30) passed.
- Family reads (qa/family/): pillars, one call: 13/13 motifs in order, one family, none out of place. Piers: multi-image
  calls timed out three times; one crop per call worked: 13/13 "flying buttress" with the right motif in order.
- agy calls fail far more often with many items in one picture; one item group per call is the reliable shape.
- Spend: fal $3.90, RunPod $0.41: $4.31 of the $15 budget.

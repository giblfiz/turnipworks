# Faith factions (Christian, Buddhist, Hindu, Muslim): lab notes, lane faith-factions, 2026-11-07

Brief: the lane prompt (Harry 2026-11-07: "creating 'factions' for the real world religions (Christian, Buddhist, Hindu,
Muslim) so people who want to build historical have no problem... Right there next to spider cult") + the lanes'
common rules (scratchpad tw-lanes-common-1107.md). Worktree <repo>, branch
faith-factions, off main a7b5c59e. DESIGN.md = the roster after the codex read; SENSITIVITY-codex.txt = the read.

## Log
- 07:40 read the faction system: engine/core/faction-catalog.js (discovery from sku shapes), core/factions.js (inheritance,
  asset-only re-dressing), client faction-shelf.js / surfaces/factions.js / ring.js, tools/spawn-tuner/factions.py
  (picker data + ingest), solver2.js types:flavor (flavorOf: ANY flavor asked by name dresses ANY religious type: that is
  the grisly hole: a Christian cult sanctum would put the crucifix beside the sacrificial altar and the cages).
- 07:44 DESIGN.md v1 -> codex exec sensitivity read (text only, isolated scratchpad folder): all four OK WITH FIXES. Fixes
  that changed real forms: no confessionals / benches not pews in a medieval church, font beside (not instead of) the
  stoup, the labyrinth large in the nave floor (not a seal before the altar); Tibetan seating runners not a generic
  khaden, vajra-and-bell not the roofline wheel-and-deer, a named chorten type, a thangka; no marigolds before 1300 (an
  American flower), mandana not kolam (South Indian), a garbhagriha sanctum with a walk-round path, a named torana
  (Solanki kirti-torana), a plain dipa not a samai; the qibla is not "the wall opposite the door", the minbar to the
  worshipper's RIGHT and optional in small halls, a referenced Qaytbay minbar canopy, a Mamluk carpet not identical niche
  rugs, an ablution fountain added, and my crescent-and-star reason was WRONG (it predates Islam; omitted because it is
  not a symbol of the faith). Global: faiths grouped, never among the sinister; a change of faith must REBUILD the layout.
- 07:52 spec_fth.py: 24 mesh plates + 12 flats + 4 emblems, NOTEXT on every one; 6 Codex image workers (4 mesh, 2 flat):
  all done by 08:08 (14 min). Worker self-checks: alpha halo on most (clean_alpha), four plates within 4-7 px of the frame.
- 08:00 tools/link_ignored.py: 96,700 of main's ignored binaries linked. Baseline build_data.py here: library.json drops
  the sprawl batch's 87 skus (no binaries on this box, as cultures-a found) -> tools/merge_faith.py: main's committed data
  + this batch's additions only; a raw rebuild is never committed. prep/{jobs,flats}.json restored from HEAD.
- Code (see ROOMS.md "The four real-world faiths"): factions.py FAITHS (names, omit, ownSlots, rite, look), nine new roles
  (catalog K8), faction-catalog.js (names, factionRowSlots, faithBarredType), core/factions.js (factionAllowed,
  faithBarredRoom, riteChangedRooms, the refusal), picker / ring / shelf (disable, group), main.js setFaction (rebuild
  batch), solver2.js faith:solver2 (faithHall for Buddhist / Hindu / Muslim, five Christian hooks in templeNave, the
  flavorOf guard), solver.js (the classic roll's guard), build_data.py (rite on nave / cathedral / shrine).
- test/faiths.test.mjs --fake (pieces in memory at catalog size, before meshes): 54.7k checks; found the idol over the
  ceiling (sizes), the minbar refused before a window (wallGen windows), fixed. golden main vs here: 2,580 scenes, 0
  differences. tem 342,888 / 0, cult 126,959 / 0.
- 08:04-08:16 RunPod: EUR-IS-1 (the TRELLIS volume) had no 4090 or A100; tools/pod_retry.sh tried every 3 min; twice a
  card freed and another lane's create took it first. No pod was ever created by this lane (API: none named
  tw-faith-factions). 08:17 -> fal TRELLIS.2 (src/fal_trellis.py, the openmesh route: same open-weight model, hosted;
  1024, 50k faces, 2048 tex), 24 plates, outputs on USB (fal1/).
- (an aside, no harm done: `kill $(pgrep -f "bash tools/pod_retry.sh")` matched my own shell, which died; the loop was
  already between tries. Kill by PID from `ps`, never a pgrep pattern that the command line itself contains.)
2026-11-07T08:41:24-08:00 round-1 still read cancelled before it reached the agy lock (halls changed: stupa + thangkas before the wheels, a pillared mandapa, the rehal); round 2 re-shot
- 08:17-08:24 fal: 24 meshes, 0 failed, $7.20. Geometric rules (qa.sh NOVISION=1; Blender 5 tile renders fail as the
  cultures lane found, trimesh stands): 23 accept; the torana came out a 9.3 x 9.5 x 10 ft CUBE (TRELLIS read depth into
  the scalloped arch) -> re-plated near front-on ("it is THIN ... like a doorway frame standing alone"), v2 8.2 x 2.3 ft,
  $0.30, ships as flavor-gate--hindu (manifest_overrides rename). fal total $7.50.
- Flats blind read (one agy call, 16 pictures, unprimed): every one names its faith, no text on any (Om only where
  asked), every symbol judged accurate, no problems. The Muslim emblem read as a Rub el Hizb (the star of two squares):
  an accurate reading of the decorative star; it stays a decorative mark in the docs.
- Real library: faiths.test found (1) faithMats / the offering table called chooseSku on a role a library may lack
  (crash): guarded; (2) a flat's w/d follow its PICTURE's aspect (the Buddhist runner was painted landscape): rows now
  take long/short sides and turn each mat; (3) the 4x5 chapel's corner refuses the crucifix's broad arms: other corner,
  then a three-quarter crucifix; (4) a cathedral whose door walls are full: the font free-standing near the door.
  The old tuner factions test asserted every delivered faction's idol in cult rooms too: now the reverse for reverent.
- browser_factions.py --local (real UI, 17 factions in the ring and the drag-out offer): 71/71.
- Stills r1 (12 halls): 0 HTTP errors, 0 overlaps; the counts showed the Buddhist hall with no stupa and no thangka (the
  wheels took the walls first), no rehal in the prayer hall, a bare Hindu hall: fixed (stupa + thangkas before wheels;
  a pillared mandapa of the India pack's temple pillars, one column system; rehal spots clear of the candlestick).
  r1 still read cancelled before it reached the lock; r2 shot and queued. Golden again: 2,580 scenes, 0 differences.
- Mesh read batch 1 (12 sheets, one agy call; the read also asks faith, text, problems): 8 clean. Re-plated (v2): the
  Buddhist incense burner ("garbled writing-like markings on the stem band") and the mosque candlestick ("garbled
  writing-like knotwork in the base medallions": real Mamluk candlesticks DO carry inscriptions, and generated arabesque
  drifts toward script), the Hindu bell ("melted, blobby closed bottom": TRELLIS closes a bell's mouth; v2 seen level, a
  solid clean silhouette), the muqarnas corbel (read as broken stone; v2 three bold tiers). fal $1.20.
  The lesson for sacred metalwork: ask for FEW, BROAD geometric bands and say "nothing that could look like writing";
  fine ornament is where fake script appears.
- Hall stills r2 blind read (12 halls, one call): every hall names its faith unprompted (Gothic Western Christian,
  Tibetan / East Asian Buddhist, Indian Hindu mandapa, Islamic prayer hall), each judged accurate, no problems; the "N"
  text in three is the compass overlay. BUT all three prayer halls: "script-like marks on open book pages": the v1
  rehal's inlaid cradle read as an OPEN QUR'AN WITH FAKE WRITING, the one outcome the brief most had to avoid. Re-plated
  as plain walnut, smooth empty faces (v2, $0.30); the worker's leg cut-outs came out six-pointed (the Seal of Solomon is
  common in Mamluk ornament; left for the blind read to judge). Mosque halls re-shot with v2, re-read queued.
2026-11-07T09:47:41-08:00 mesh reads consolidated: the batch-2 call answered (3.7 KB) in a shape the parser refused and re-queued; the lock is unfair (whichever waiter wakes first): four pending calls stopped by PID, one call for the 16 unread shipped meshes, parser accepts an object-shaped answer
- Mosque halls with the v2 rehal, blind re-read: all three clean (no text, Islam named, accurate, no problems).
- The 16-sheet mesh read LOST its answer: agy-run logged exit 0 with 5,157 bytes at 10:27:50, the caller's stdout came
  back empty at 10:27:45. Both read tools now pass `-o <file>` (as the other lanes' callers do) and read that file when
  stdout is empty; the parser also accepts an object keyed by file. Restarted.
- 16-sheet mesh read (one call): 12 clean, including all four focal pieces, the Virgin, the stupa, the minbar, the
  mosque lamp, the torana, and the v2 incense burner / candlestick / bell (now text-free). Still wrong: the MIHRAB
  ("garbled pseudo-Arabic calligraphy in border panels"), the PRAYER WHEEL ("pseudo-script embossed on drum"), the v2
  rehal (text-free but broken). The v2 corbel's one flaw is an open back, which faces the wall: accepted with that note.
  Re-plated (broad ablaq stripes and big plain shapes; a smooth drum with one ring of big petals; a solid chunky rehal).
- fal's account balance ran out (HTTP 403 "User is locked", $0 charged). RunPod retry: a 4090 freed at 11:11, pod
  b75mbpygc52m33, setup 207 s, 3 meshes (median 65 s), deleted 11:24 and verified gone: 0.199 h x $0.89 = $0.18.
- Main moved (the cyberpunk lane: ten cyb-* types, 50 meshes). Replayed instead of rebasing six commits through
  generated-file conflicts: old branch kept as faith-factions-backup; faith-factions recreated on main 840306f0; the
  code/doc diff applied 3-way (clean); link_ignored.py linked main's 2,090 new binaries; runtime.sh + merge_faith.py HEAD
  rebuilt the data as main's + this batch's (verified: only faith keys added, none of main's 2,486 skus touched).
- Final combined read (3 piece sheets + 6 halls, one call): the mihrab, rehal and prayer wheel clean; Buddhist halls
  clean; the mosque halls flagged the lamps "placed on the floor / on prayer rugs": they hang at 5.7-8.75 ft, but with
  rule 'lamp' the renderer (look.js) draws no chain to the unrendered ceiling, so from the table camera they float over
  the carpets. Lamps and the Hindu bell now use rule 'ceiling'. faiths.test: 64,055 checks, 0 failures.

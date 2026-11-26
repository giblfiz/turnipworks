# Lab notes: culture packs B (Norse, Middle East, Rus', Mexica), 2026-11-06

- 22:05 worktree; tools/setup_links.py links main's 89k git-ignored binaries in (build_data.py then reproduces the committed
  library.json and rooms.json byte for byte). ROSTERS.md: the four rosters with the deliberate NOTs.
- Sensitivity read (codex, reads/sensitivity-codex.md) changed the rosters before any plate: Mammen/Ringerike, not Urnes
  (Urnes is after 1050); roof-support posts added; the qa'a is a low fountain between TWO raised iwans (not a throne dais);
  the octagonal hot slab is Ottoman, so the Mamluk hammam is a fountain ringed by marble benches and wall basins; no
  dallah (17th c.); plain plaster for ordinary walls, tile only on the rich variant; no chahar-bagh rills or cypresses for a
  Cairo/Damascus courtyard; a khan arcade of storeroom bays rings the caravanserai court; Rus' decoration restrained (no
  folkloric window frames, no chimney on the stove, a plain green tiled stove of the late 16th c.); the iconostasis's upper
  row a Deesis, the altar BEHIND it; Mexica: no stepped fret as a universal trim, the codex on a mat (not a table), pictures
  in the manner of the Codex Borbonicus; door curtains instead of hinged doors.
- 22:22 START 6 Codex image workers (BRIEF-1..6). 22:27 RESTART with "any size is fine": they spent 3 tries a plate on
  the tool's non-square sizes. Then about one plate a minute overall; transparent backgrounds, so no matte (tools/stage.py
  checks the alpha and the corners).
- Programs: ONE data-driven skeleton for all four packs (integration/cb.solver2.js; CB[key] = a list of steps). Tested
  before any mesh existed with --fake (the planned meshes at catalog size, test/cultures_b.test.mjs): 80k checks.
  Lessons: an exclusive tier hides a reused piece (the anvil is `smi`: the Norse smithy lists tiers nrs + smi); a hub of
  900 sq ft or more gets attempt()'s swirl loop through its inset corners AFTER the program, so the skeleton walks it first
  (but after the signature piece: the high seat in the middle of a long wall sits on that loop's line); an outdoor plot's
  way from the door to the gate is walked after the centre piece, and rows skip it.
- Plate gate (agy, blind, 256 px on grey): the Norse plates were named right, each with "[Viking, Early Medieval]".
- 22:39 RunPod RTX 4090 (EUR-IS-1, $0.89/h), local timer 1.5 h + pod-side dead-man.
- The pod's network was slow: pip setup 1683 s (215 kB/s downloads; other sessions saw 185-250 s), uploads ~70 kB/s, so the
  plates went up shrunk to 640 px (tools/shrink.py; TRELLIS.2 resizes to 518 anyway): 167 MB -> 30 MB.
- 23:35 the non-resident 4090 worker ran 50-65 s a mesh; restarted as ONE resident worker (tools/remote_resident.sh, 16 GB
  on the card): 15 s a mesh (median 13), Norse first. Two meshes failed CUDA out of memory in resident mode
  (mes-spread-maize, mes-spread-pottery); re-meshed non-resident, fine. 86/86 meshes.
- 00:00 pod DELETED and verified (state gone, no pod named tw-cultures-b): 1.349 h x $0.89 = **$1.20**, the whole spend
  (plates and icons on the Codex plan, reads on agy).
- Real meshes needed few program changes: the iconostasis came out square (catalog 104x22x104 so it stands under the
  9-ft ceiling), the stove smaller (60x72x66), the walk to a screen ends before it, the lectern and the chacmool off the
  approach. Known limit (counted): a 15x15 ft izba with doors in two walls' middles has no place for its stove.
- Mesh fix: the Mamluk floor fountain's painted water became a flat square sheet at the top of its box (Gemini, on the
  room shots: "a flat grey-blue square plane over the fountain"; on the render: "floating parts"). tools/parts.py dropped
  the two big flat shells; the original is in models-ungraded/.
- Blind room reads (agy, table camera, one picture each, no words): Norse 6/6 named Viking and the right room (the yard
  "bedchamber and courtyard": the longhouse beside it shows); Middle East 6/6 named Middle Eastern/Islamic and the right
  room (qa'a "diwan / formal reception hall", hammam, caravanserai courtyard, souk shop, garden courtyard, coffee house as
  "majlis / tea salon"); Rus' 6/6 named Slavic/Russian (izba, banya, Orthodox chapel with iconostasis, yard with well
  sweep, terem as "dining room", the stall as "cheese shop": wax cakes read as cheese). The Rus' yard's plank floor read
  as indoors: removed from its floors.
- Mexica 6/6 named "Pre-Columbian Mesoamerican (Aztec ...)"; rooms: market, scribe's room, offering shrine right;
  chinampa "water garden courtyard" and the noble's house "throne room / reception hall" partly; the BALLCOURT not named
  ("council chamber": from above it is benches round an empty floor; the rings did not carry it). Wanted: the I-shaped
  end zones, a ball, a painted alley (docs/ASSETS_TO_BUILD.md). The "green arrow / bar" Gemini sees in the room shots is
  the tuner's own overlay: the four stills for Harry are shot with it hidden.
- The shared agy lock was the session's bottleneck: 10-21 queued calls from the seven lanes, ~20 min a call.

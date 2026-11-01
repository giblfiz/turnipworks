2026-10-30T13:12:32-07:00 START 4 codex image workers (BRIEF-1..4, 24 plates)
- Partner looks: tools/render_ref.py rendered every partner (and every replaced model) as the game turns it (orient.json
  yaw), 3/4 and front, transparent; Gemini (agy) read all 30 three-quarter views as FRONT views (refread/).
- Plates: four Codex workers (BRIEF-1..4, tools/write_briefs.py; each shot an EDIT with the partner renders and, where
  it survives, the partner's source plate in ref/<id>/), 24 plates in ~12 min, all 1254 px RGBA. Prompt rules learned
  from the swap code: window shutters/casements open FOLDED FLAT to the wall (a kit twin is stretched into the shut
  piece's 12-in box), the cage's door a third of its front (a twin is scaled by its sides the opening leaves alone).
- 13:38 RunPod: no A100 in EUR-IS-1, one RTX 4090 ($0.89/h), timer 1.5 h + pod-side dead-man; setup 185 s. Wave of all
  24 launched at once while the plate gate ran (meshing is cheap next to the pod's idle time).
- Plate gate (tools/gate.py) blind read at 160 px: 23/24 the wanted state. smith-farrier-box read OPEN ("closed lid, and
  open side drawer"): re-plated (BRIEF-5: "no drawers open anywhere"); v1 kept in plates/v1/. (BRIEF-1.md was
  overwritten by the BRIEF-5 run: tools/write_briefs.py remakes it.)
- Plate match read (plate beside the partner's RENDER) stopped after 12/24: unfair by construction (Codex plates are
  saturated, Blender renders of TRELLIS meshes are muted), and agy was saturated by the promo agents (10+ min a call).
  The match that counts is render-vs-render on the meshes (gate-renders.json).
- castle-rough: the partner is a bare cruciform arrow slit (Gemini on the ref: "unglazed cruciform arrow slit"), so
  "shutters folded beside it" was a different design (match read: "entirely different design"). Treated like the four
  windows whose shut model reads open: a NEW SHUT model (BRIEF-6: the slit closed by a plank shutter; Codex: "cruciform
  outline lost", the shutter fills a rectangular embrasure) and the EXISTING slit mesh copied as its open twin
  (targets.json kind reuse-open: no generation). Generated castle rooms now show the shuttered slit.
- door-reinforced-open--rough-timber: mesh v1 came out wider than tall (x/y 1.34; the frame's 0.80): the leaf swung out
  sideways past the frame, which the kit stretch would have squashed into the frame's width. v2 plate the same (Codex:
  "leaf projects sideways"); v3 plate (BRIEF-8: 40-degree side view, "like a door left ajar at 90 degrees") meshed at
  x/y 0.81, depth 0.59: accepted on measurement.
- Swap code (engine/client/assets.js), found while planning the plates: (1) a twin was scaled longest side to longest
  side, so an open trunk whose raised lid is taller than the trunk is wide came out ~3/4 size: now the largest per-side
  ratio (the side the opening leaves alone); (2) every kit twin was stretched into the SHUT piece's box, which lays a
  framed door's leaf back into a 3-in frame and a trapdoor's raised hatch onto a 4-in tile (both read shut): framed
  doors and the trapdoor (OWN_DEPTH) now take their own depth/height at the width's scale, the door's frame kept in the
  wall line (leaf on +Z by a measured yaw: tools/orient_set.py, incl. the two inn-02 door twins); (3) the hatch twins
  came out of TRELLIS with their shaft under the tile, so the tile floated 1.5 ft up: `sink` (tools/sink.py, measured
  on the runtime mesh; build_data.py carries it) lowers the twin so its tile top meets the shut tile's top.
- browser_openables FIT (new): 32 swaps, each open twin the shut one's size on a side the opening leaves alone, framed
  doors' frames in the wall, hatch tiles on the floor: pass. browser_openables 15/15.
- prep/results-bars01.jsonl: cell-bars-post's runtime record (bounds, faces) taken from the committed library.json; it had
  no results line, so any rebuild of the library dropped its bounds (and the post).
- 14:44 RunPod pod DELETED and verified (GET 404): 1.385 h x $0.89 = $1.23 (balance moved exactly $1.23). 27 meshes
  (24 + farrier v2 + castle-rough shut + reinforced door v3), median 22 s each; most of the uptime was waiting on agy.
- Mesh gate (tools/gate.py renders; each mesh rendered as the partner is, blind at 160 px, then beside the partner's
  render): blind state 24/24 right. Match 18/24 SAME; colour drifts graded to the partner's colour map (tools/grade.py,
  per-channel mean and spread, texture only; originals in models-ungraded/): grooming box and cage then SAME, bread
  oven still DIFFERENT (painted details: a gold wheat emblem, a red band, a brass door frame). Still DIFFERENT, kept:
  tower-stone open (stone tone, casement grille), noble-panel shut (darker wood), castle-rough shut (fal v2, the slit
  "planks in it" plate: Gemini still sees a rectangular shuttered window, not the cruciform slit). Facing: TURNED
  flags re-read with the four-turn sheet (tools/orient_read.py): grooming box yaw 270; salt box v2 yaw 0.
- In-game blind read, all 85 SKUs (shots.py + tools/judge.py: the audit's judge with no timeout on the shared agy lock;
  batches of 24/37/40 for throughput, the audit used 24): first pass 165/170 = 97.1%. Fixed after it: bread-oven shut
  read "a forge with burning fire inside": the fire FX had no anchor for the new mesh (anchors belong to a mesh) and fell
  back to an offset in front of it; data/fire_anchors.json now puts the shut oven's fire INSIDE the dome (enclosed on
  all sides: a lit shut oven glows, no flames; open, the twin's mouth anchor shows them). salt-box open read "lid
  closed" (a 6-in box at table distance): re-plated (lid thrown back, salt heaped above the rim) and meshed on fal.
  Those three kinds (and the re-turned grooming box) re-shot and re-judged alone (6 crops).
- FINAL: **167/170 = 98.2%** (census before: 143/170 = 84.1%). Kinds showing no state: 16 -> 2 (table-final.md; its
  "before" columns are the census's after3). Left: door-reinforced--leaf open (the swinging leaf; unchanged, read
  right in the census: Gemini variance), wall-window-small--half-timber shut (unchanged mesh, read right before:
  variance), wall-window-small-open--castle-rough (the existing bare cruciform slit, now the open state, read "stone
  wall panel with barred window": a slit's cross reads as bars; the shut model with planks reads shut).
- Spend: RunPod $1.23 (one 4090 pod, 27 meshes, deleted + verified), fal $0.60 (castle-rough shut v2, salt-box open v2).
  Codex plates (12 workers' runs) on the ChatGPT plan; Gemini on agy-run. Total $1.83.
- Look changes beyond the openables: generated rooms' fieldstone, rough-timber, noble-panel and castle-rough windows now
  show their shutters (or the slit's planks) CLOSED (rooms place the wall-window-small sku: client look.js kitSpec); lit
  bread ovens show no flames until opened.
- 16:51 LANDED on dev: main 9cc49bdc, candidate 20261030-165116-9cc49bdc (prod stays 20261029-153128-f0228c68; never
  promoted). land.sh copied 179 new + 196 replaced binaries into main (14 replaced skus x glb/.owner/6 LOD/6 tex), the
  tuner deployed (tw-relay-dev restarted onto it), then the client. land.sh's permission gate wanted 755 exactly and the
  tree's directories are 2755 (setgid): fixed afterwards; the client deploy, candidate and push ran by hand under the lock.
  Suites before landing (worktree, after the last rebase): npm test green; browser_openables 15/15 (FIT new),
  browser_pdoors 23/23, browser_bars 68/68, browser_build 98/99 (F2 rename: fails on origin/main too, checked in a clean
  baseline worktree).

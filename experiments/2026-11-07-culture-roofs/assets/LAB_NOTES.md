# Lab notes: culture roofs, ASSETS worker (2026-11-07)

Contract: ../PLAN.md. Lane rules: the scratchpad tw-lanes-common-1107.md. Pictures: /mnt/usb/turnip-works/lanes-2026-11-07/culture-roofs/assets/.

- 07:43 ROSTER.md + sensitivity-prompt.md; codex exec (read-only) started on the roster BEFORE any plate.
- 07:4x ENGINE asked (message): the engine bends kawara/tongwa/glazed slopes near the eaves (vertex shader), so the five NEW
  sections need a gridded base. build_sections.py: per-style `grid: n` makes the roof plane an n x n grid of quads and the far
  tier a 4 x 4 grid; far_triangles in report.json / roofsections.json is now counted. Checked in a scratch copy: tile and
  thatch rebuild BYTE-IDENTICAL to main's GLBs (c2e6d8b0, 75fd9520). Marble's plate (roofs-temple/plates/roofing-marble.png)
  exists nowhere on disk, so marble cannot be rebuilt at all (unchanged by this; not needed).
- 07:47 D, gable pictures: gables.py runs roofs-temple bake/bake.py's own code redirected to assets/gables/ (bake.py would have
  overwritten its tracked out/bake.json with only six families), for jpn-shoji, jpn-shrine, chn-brick, chn-temple,
  norse-stave, rus-log ONLY; each from its base wall-straight--<family> mesh, 0 holes. chn-brick bakes dark (mean RGB 46,34,26):
  the wall mesh's own texture is that dark (51,38,30), so the bake is faithful. Installed: engine/client/data/roof/
  gable-wall--<family>(.normal).webp (new names, targets unlinked first) + 6 rows in gables.json `walls` (+90 lines, nothing
  else changed). Main checked: no new files in its roof dir; its `git status` unchanged from the baseline saved on USB.
- 07:51 SENSITIVITY READ in (sensitivity-codex.md; log sensitivity-codex.log). Roster changes, each before any plate:
  - glazed = GREEN (yellow implies imperial patronage; imperially sponsored temples could use yellow, so green is the
    non-imperial default). Ridge to match.
  - onigawara = PLAIN with cloud/wave relief, no oni face (authentic default; oni faces stay a valid alternative).
  - shrine hall: NO chigi, NO katsuogi (they depend on the building tradition; not right for an unspecified irimoya worship
    hall). Material: hiwadabuki is layered cypress BARK, not split shingles (kokerabuki): the engine's shrine roof should read
    as thick layered bark eaves, no plank-shingle joints. No new plate for it in this contract (open question).
  - CHIWEN: the read says "omit under the no-figures rule", but that rule was MY roster's over-broad line ("nothing on a
    sacred building carries figures"); the lane rule is no deity images and no text. The read calls it historically
    appropriate and not disrespectful, and says: if kept, use the Qing ridge-swallowing dragon form (zhengwen), not a
    freestanding fish. DECISION: keep the fixed id roof-chiwen, designed as the Qing zhengwen (dragon head biting the ridge,
    tail curling up, green glazed, stylised architectural ornament). Question for Harry, default built.
  - cupola: a plain CROSS on top, no corpus; a MODEST onion (restrained bulb and neck, silver-grey aspen scales), not the
    Kizhi cluster; neither helmet nor tent is a universal replacement; one over the principal church volume only.
  - dome: masonry with a PLASTER finish (not exposed stone), ordered clusters of raised GLASS caps/bowls (not open holes).
  - malqaf: sloping timber scoop, a dark intake mouth, closed sloping back; "north" is an acceptable simplification.
  - shikhara: LATINA (rekha-prasada) single curvilinear tower, projecting vertical ribs, a scalloped amalaka, kalasha;
    regional anchor Jaipur/Amber; figure-free is our art direction, not a Hindu requirement.
  - ridges: three different constructions (Japanese noshi stack + round cap; a modest Chinese grey stacked-tile ridge, NOT
    noshi; moulded green-glazed ridge pieces).
  - tes: boards OVERLAP (double coverage), no open seams between boards (prompt changed).
  - sod: keep; a thick earth edge under the grass (prompt has it).
  - Engine-side items (shapes/placement, not mine): machiya and shops want simple KIRIZUMA gables and a restrained straight
    eave (irimoya + upturned corners over-monumentalise ordinary Kyoto houses; irimoya for larger buildings: dojo, shrine
    hall); a lower street-front hisashi; Chinese houses: restrained YINGSHAN gables (gable walls meeting the roof edge), no
    curled eaves on ordinary houses; sod: a framed smoke opening; tes: heavy timber ridge cover and eave troughs; Norse
    halls: no dragon finials (default kept); chhatri on elite haveli/palace only; one shikhara over the sanctum only.
- 07:52 B started: gen_plates.py, five Codex image requests in parallel (free route, style anchor attached, "any size is fine").
- 07:53 five raw plates in (Codex, ~1 min each, 1254 px RGB, $0). finish.py (the castle flats finisher, the five course/piece
  counts): every wrap step equals the same-phase step inside the tile (kawara TB 6.5 vs 6.5 x5, tes LR 13.8 vs 6.7-14.1...):
  the high seam ratios are course shadows / board joints lying on the border, not seams. -> seamless/roofing-<style>.png.
- 07:57 build_sections.py kawara,tongwa,glazed,sod,tes --install: all tile both ways (measured); grid 10. tongwa measured 5
  columns (182 px), not 6: the finisher cropped to 5 whole columns. glazed found 35 of 36 pieces. Painted pictures exported
  as engine/client/data/roof/roofing-<style>.webp (512 px). previews/section-<style>.png: 3x3 tiled, 35 deg, Blender.
  Ornament plates (C) started in parallel at 07:54 (3 Codex workers, BRIEF-1..3; they write plates/, so the roofing plates
  moved to seamless/; rebuilt: same shas).
- 07:54-07:59 C plates: spec.py (9 targets, ids and sizes from PLAN.md, designs from the read) -> tools/briefs.py 3 -> three
  Codex image workers (cultures-b briefs, "any size is fine", transparent). All 9 in by 07:59, $0. stage.py: all alpha-clean
  corners. Alpha < 48 zeroed in masked/ (the cultures-a lesson; 1-2.5% faint haze per plate), shrink.py to 640 px.
  roof-dome REJECTED by its own worker's log ("substantial decorated building walls instead of a short drum", 3 of 3 tries):
  design rewritten (ONLY the roof dome: short drum on a thin plinth, NO walls, wider than tall), re-plated by worker 4
  (BRIEF-4.md); the first in plates-rejected/. (BRIEF-1..3 regenerated for provenance with the final spec.)
- 08:0x POD: 4090 in EUR-IS-1 (the volume's DC): "no longer any instances available"; A100 none; the only stock there is a
  B300 at $8.99/h (Blackwell: the volume's sm_89 wheels would not run; no). Verified no pod was made (rp_our_pods = []).
  fal is not an option (its account was exhausted 2026-10-28, roofs-flat lab notes). tools/pod_retry.sh: pod_up.sh every
  90 s for up to 60 min.
- Landing prepared: tools/spawn-tuner/culture_roofs.py (NEW, mine: reads catalog/runs/croof-01/manifest.tsv; binaries in
  assets/models/), tools/manifest.py (writes that manifest and catalog/objects-culture-roofs.catalog.md). Ridge skus = shape
  kawara/tongwa/glazed, tier '' like --lead/--thatch; the six new roles carry jpn/chn/rus/mde/mde/ind (exclusive tiers).
- 08:15 POD UP on the retry loop's 11th try: zo039lp4ftv5bk, 1x RTX 4090 secure EUR-IS-1 @ $0.89/h, local deletion timer 1.5 h
  (fires 09:45) + pod-side dead-man switch (09:47); worst case $1.33. TRELLIS.2 setup started 08:16.
- 08:20 SUCH dropped three plates (mes-court-endwall 120x24x48, mes-court-ball 10x10x10, mes-court-hip-guard 30x18x8; its README): added to targets.json (code mes, plate path) and staged with alpha < 48 zeroed (0.7-1.1% haze); they go in the same wave and land through croof-01 with tier mes.
- 08:19 setup OK in 184 s (fast network this time). Wave 1: ONE resident worker, 12 plates: model load 155 s, then median 17 s
  a mesh (the first 76 s); roof-onigawara and roof-ridge--glazed failed CUDA out of memory in resident mode (as cultures-b).
- 08:2x Plate read (agy, one call of 19 pictures, reads/plates-r1.json): ornaments named right: onigawara "carved cloud-and-wave
  ridge-end tile (onigawara) [Japanese]", chiwen "green glazed ceramic dragon roof ridge ornament (chiwen) [Chinese]", cupola
  "wooden onion dome with Orthodox cross [Russian Orthodox]", shikhara "stone temple spire / shikhara finial [Indian Hindu]",
  ridges kawara "grey ceramic roof ridge cap tile [Japanese]", glazed "green glazed ... ridge [Chinese]", tongwa "stone roof
  ridge cresting with dentils [Classical]" (partly), dome "domed roof skylight with colored glass lenses [Ottoman/Islamic]"
  ("base under it" = the plinth asked for). MISS: malqaf "timber-frame roof dormer with arched windows" -> design rewritten
  (a single open-mouthed air scoop, NO windows/arches), re-plated (worker 5), the first plate and mesh in plates-rejected/,
  models-rejected/. The ROOFING rows of that call were scrambled (kawara named "turf", section-sod "grey ceramic tiles",
  four rows with identical words): Gemini mixed file names in a 19-picture batch. Re-read as 5 paired pictures (plate 2x2 +
  section side by side): reads/roofing-r2.json.
- 08:3x Wave 2 (non-resident, seed 833072): roof-onigawara, roof-ridge--glazed, the new roof-malqaf: all fine. 12/12 GLBs.
- Mesh boxes vs catalog (qa/sizes.json): each ships at its OWN proportions with one catalog dimension kept (kit pieces are
  stretched per axis to their stated box, so a box off the mesh's shape distorts it): ridge kawara 60x22x15, tongwa 60x19x10
  (modest, as the read wants), glazed 60x13x13 measured -> 60x18x18 (cross-section scaled evenly, harmless for a repeating
  module); onigawara 33x22x30; chiwen 51x17x48; cupola 83x84x168; dome 144x138x83; malqaf 46x38x72; shikhara 120x121x264;
  SUCH: endwall 120x27x35 (catalog 48 tall), hip guard 30x21x9, ball 10x10x10.
- roof-chiwen came out with its mouth-to-tail axis along DEPTH: turned 90 deg about up by a new root node in its GLB (the
  original geometry and material bytes untouched; a Blender re-export had dropped the material factors). Now the tail (the
  high end, found from the top 2% of vertices) is at +X, the MOUTH at -X. Original in models-unturned/.
- 08:55 ENGINE: Gemini reads the gables over chn-brick and norse-stave as 'an open dark void'. Re-checked: the bake is faithful (both faces of each mesh equally dark unlit; the source GLB textures are that dark, TRELLIS darkened them vs the plates; the base skus). gables.py: gables/grade.json {family: gain}; default gain 1.6 for chn-brick and norse-stave installed (reversible), exact gain to follow from ENGINE's in-game wall/gable ratio.
- 08:50 Roofing re-read as 5 paired pictures (reads/roofing-r2.json): all five named right (glazed "green ceramic ... East
  Asian / Chinese temple", kawara "dark grey ceramic wavy pantiles ... Japanese kawara", sod "green sod / turf ... Viking
  Age torvtak", tes "timber planks in overlapping courses", tongwa "grey curved pantiles / barrel tiles ... East Asian");
  swatch and 3D patch "the same covering" 5/5; NO seams, no holes 5/5. Noted: "blocky stepped lighting" on the 3D patches
  (the wedge method; the old tile styles share it; ENGINE says they read right in game); tes joints line up across
  courses (by design: whole columns are what tile); sod fringe repeats in a 2x2 (expected at 4 courses); tongwa "repeating
  warm blotches" -> landmark damping 0.6 -> 0.9 (piece-tone deviation 5.18 -> 4.02, warm spread 2.12 -> 1.63), section rebuilt
  and reinstalled (sha 2b1433ef, tiles both ways), roofing-tongwa.webp re-exported.
- 08:40 tools/runtime.sh (manifest -> build_data.py with the culture_roofs hook -> blender_runtime/lod/textures for src croof-01
  only -> build_data.py): 12/12 with bounds, every LOD and texture rung present, no links into main among them; main unchanged.
- 09:02 Mesh read r1a (reads/meshes-r1a.json; each sheet = front 3/4 + table view): ALL SOUND: chiwen "dragon roof ornament
  [Chinese]", cupola "church tower [Russian]", dome "dome [Ottoman]", shikhara "temple tower [Indian]"; ridges kawara and
  tongwa alone read "wall" (a ridge module out of context; their plates read right). Chiwen front "right" vs my mouth-at -X:
  a side-view read queued to settle which end the head is (reads/chiwen-side.out).
- 09:24 Mesh read r1b (reads/meshes-r1b.json): ridge--glazed "low wall [Chinese, Imperial]" sound; ball "cannonball" (a dark
  ball: fine), hip guard "cloth bundle" (P3, partly); malqaf "market stall [Medieval European]" sound but a MISS alone;
  onigawara NOT SOUND ("broken rear ribs with holes and jagged fragments"); mes-court-endwall "carved ivory bar [Indus Valley]"
  with "Indus script characters" (script-like marks: against the no-script rule). Re-meshed both (seed new, non-resident):
  onigawara loose parts 4049 -> 2248; endwall new mesh; read r2 queued (reads/meshes-r2.json). Old ones in models-rejected/.
- ENGINE's in-game blind culture-from-roofline read (same buildings/cameras, before -> after): Japan 50 -> 98 "late Edo", China
  50 -> 99 "Beijing, Ming-mid Qing", Norse 55 -> 98 "Viking turf", Rus' 65 -> 98 "tes + cupola", Mamluk 65 -> 98 "Mamluk Cairo
  (dome, wind-catcher)", India 70 -> 99 "Rajput/Nagara (chhatris, shikhara)"; "wrong notes: none" on every after picture; the
  gables at gain 1.6 not flagged: keep 1.6. (So the malqaf reads right in context.)
- 09:30 POD DELETED, VERIFIED (rp_pod_state gone; no pod named tw-culture-roofs): zo039lp4ftv5bk 08:15:15 -> 09:30:04 = 1.247 h x
  $0.89 = **$1.11**, the whole spend of this worker (plates on the Codex plan, reads on agy, sensitivity read on codex: $0).
  spend.log copied to USB. Runtime rebuilt for the two re-meshes: 12/12 with bounds.
- 09:57 Chiwen side read (reads/chiwen-side.out): head LEFT (-X), mouth points left, tail top-right: the turn is right.
- 10:14 Read r2 (reads/meshes-r2.json): roof-onigawara now SOUND (alone "treasure chest"; in context ENGINE's Japan read was 98,
  no wrong notes): shipped. mes-court-endwall now "low wall" (right) and sound, but "small black lettering (chj) and orange
  graffiti" on it: marks in the texture (most likely painted into SUCH's plate). Pod already gone, so tools/despeck.py: texels
  differing from their 11x11 median by > 18 (outside the atlas gutter) take the median: 0.63% of texels, everything else in
  the GLB byte for byte; runtime rebuilt (12/12 bounds). Original in models-undespecked/. Read r3 of the cleaned wall queued
  (reads/meshes-r3.json). OPEN for SUCH: the real fix is a mark-free plate and a re-mesh in a later pod session.

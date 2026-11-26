# Flying figures (pawns lane, asset sub-lane), 2026-11-06

Harry: "for pawns that often fly (like say a dragon) let's make an alt of them flying and when they get their vertical
set switch to flying mode." This folder makes the flying alts; the engine side (the switch) is the parent lane's
(experiments/2026-11-06-pawns/LAB_NOTES.md).

## Inventory (from the published set's manifest, its blind reads and its specs)
29 figures have wings in their standing figure (every standing spec says "WINGS FOLDED"; every blind read names the
wings, or "winged"): dragon wyrmling, young black / green / red / white dragon, wyvern, griffon, hippogriff, pegasus,
giant eagle, giant bat, harpy, gargoyle, angel, imp, pixie, stirge, giant wasp, vulture demon, manticore, chimera, winged
kobold, couatl, succubus, mephit, homunculus, hawk, owl, raven. None dropped on that ground. Already floating, no alt:
will-o'-wisp, ghost, wraith, banshee, air elemental, flying sword, eye tyrant.

## How a figure is made (reused, not rebuilt)
The set's route (experiments/2026-10-06-figures): a plate painted by Codex's built-in image tool (`codex exec`, the
ChatGPT plan: no API spend) with a style/sibling reference attached; a blind vision gate; BiRefNet matte (local GPU);
TRELLIS.2 (1024 cascade, 50k faces, 2048 px texture) on fal or a RunPod pod; `src/optimize_glb_blender.py` for the two
shipping tiers (20k/1024 heroes and large, 8k/512 horde); measured; thumbnail.
Changes here: the reference is the creature's OWN standing plate (same individual, same paint), and the gate runs on
Gemini through agy-run (the set's gate called the Gemini API with a key: not allowed now).

## Cost estimate (before any spend)
- Plates: Codex image tool on the ChatGPT plan, $0. Gate and blind reads: agy-run (subscription), $0.
- Meshes: fal TRELLIS.2 is $0.30 a mesh. 29 figures + ~6 re-rolls = 35 meshes = **$10.50 on fal**; the fal balance is
  $8.91, so fal alone does not cover it. RunPod (one RTX 4090, $0.89/h; openmesh did 27 meshes in 1.4 h for $1.23)
  does the whole lot for **about $1.50–2.50**.
- Plan: the small batch of 4 on fal ($1.20: fast, no pod setup), the other 25 + re-rolls on ONE RunPod pod (~$2).
  **Estimated total: about $3.50.** Hard cap I hold myself to: $8.

## Spend log
(every dollar, with what it bought; fal lines also in fal-spend.log)
- 2026-11-06 22:20 fal TRELLIS.2, small batch: foe-dragon-young-red, foe-wyvern, beast-hawk, foe-imp, 4 x $0.30 = **$1.20**
  (fal-spend.log). The balance read $8.9125 before and $8.6125 just after (fal books with a lag; re-read later).

- 2026-11-06 22:43 RunPod: ONE pod `tw-pawns-fly` (RTX 4090, $0.89/h, EUR-IS-1 on the tw-trellis-cache volume), the
  openmesh pod tools copied to pod/tools (POD_NAME tw-pawns-fly, remote runs pawnsfly-*); deletion timer 1.5 h + the
  pod-side dead-man. Setup 186 s. Wave 1: 14 plates (1024 cascade, 50k faces, 2048 px: the figure set's settings).

- Waves 2–4 on the same pod: 4 (chimera, gargoyle, manticore, vulture demon), 4 (winged kobold, couatl, succubus,
  mephit), 3 (homunculus; owl and raven meshed from their try-1 plates while their gate waited on the shared agy lock).
  Mesh time median 45 s, model load ~150 s a wave.
- 2026-11-06 23:38 RunPod pod wy8sbx7l0xz5ze DELETED: 0.916 h x $0.89 = **$0.81** for 25 meshes (pod/spend.log).
  Verified gone twice: pod_down.sh's GET, then pod/verify_gone.sh on its own ("gone", no pod named tw-pawns-fly left).
  (The account balance moved $3.30 in that time: sibling lanes' pods bill the same account.)

## The shared Gemini lock (agy-run)
The bottleneck of the run. One TABLE read hung 9 minutes holding /tmp/agy.lock (killed by PID; the reads now time out
at 5 min) and another lane's calls held the lock 3–5 minutes each, back to back. review.py (three calls a figure) was
replaced by review_batch.py: four figures to a call.

## Facing
All 519 standing figures have facing_deg 0: this route (a three-quarter FRONT plate into TRELLIS.2) hands figures back
facing +Z every time. The four-view facing read is run on the small batch only; the other 25 are taken at yaw 0, and
their table reads would show a figure flying backwards.

## Into the game's list (2026-11-06 23:43)
build_figures.py --check, then the build: "0 new, 29 changed, 87 files written" (29 x tier + original + thumbnail,
all under tools/spawn-tuner/assets/figures/fly/, real directories; the parent's per-file links to main's standing
files were left alone). diff_figures.py against HEAD: "519 rows; 29 with fly; rows changed beyond fly: none".
assets_check.py: 58 NOT DELIVERED, all fly files (29 x tier + original): the deploy's prep/delivery.py makes them
(it now lists fly files); NOT run here, because the worktree's assets/d is a link into main. The other 213 "missing"
are none of ours (0 lines name a flying file).

## Money, final (2026-11-07 00:20)
| what | $ |
|---|---|
| fal TRELLIS.2, 4 meshes (red dragon, wyvern, hawk, imp); fal balance $8.9125 -> $7.7125, re-read after it settled | 1.20 |
| RunPod, one RTX 4090 pod, 0.916 h, 25 meshes; deleted, verified gone twice | 0.81 |
| Codex plates (ChatGPT plan), Gemini reads (agy-run subscription) | 0 |
| **total** | **2.01** |
No re-rolls were needed or made.

## Blind reads at table distance (TABLE: alone, 10 ft over its base; batched, review_batch.py)
11 of 29 read before the run was stopped (the shared agy lock had ~20 waiters; the parent called time):
all 11 "flying: true, wings spread". Creature: red / black / green / white young dragon and the wyrmling are each named
as the right dragon (the wyrmling as "red dragon"); griffon "griffin"; hippogriff "griffin", second guess hippogriff;
pegasus "pegasus"; wyvern "red dragon", second guess wyvern; hawk "bird of prey" ("hard to read: very small, high up");
**imp "red dragon", second guess wyvern** ("small scale, high altitude"): the weak one. Not read yet: 18 (eagle, bat,
harpy, gargoyle, angel, pixie, stirge, wasp, vulture demon, manticore, chimera, winged kobold, couatl, succubus,
mephit, homunculus, owl, raven). Their plates passed the blind plate gate (flying, wings spread, same creature as the
standing figure). PAIR (body size beside the standing figure) was read only for the red dragon, under the OLD volume
fill: "smaller, 0.45". The closing fix since then made it 1.55x bigger. The size read under the final rule is still
owed. Control stills for the imp (standing on the ground, standing lifted, flying on the ground) are in shots/ctl-*.png,
not read.
Facing: the 4 small-batch figures were read "A" (front on +Z), confidence 1.0, so yaw 0 for all.

## Plates (Codex, $0)
All four small-batch plates passed the gate on the first try (Gemini: "flying: true, wings spread, nothing under it,
same creature and paint as the reference"). The other 25 are painted by 4 Codex workers.
- foe-gargoyle: refused three times for "painted: false" alone ("a stylized sandstone gargoyle ... flying with wings
  spread"; same creature as its standing figure). It IS a stone creature, painted grey-ochre stone: the gate's
  unpainted-statue rule misfires on it. Try 1 accepted by hand (inputs/, masked/ from rejected/ and work/ try1).

## Measuring (measure_fly.py)
- TRELLIS hands back meshes in a unit cube (largest side 1), so span_ft = k.
- `fm.split()` hangs on these meshes (texture seams: thousands of shells); pieces are counted on a welded copy by face
  adjacency instead. The young red dragon came back as TWO coincident shells (each 49% of the area: an inner copy of
  the outer surface); harmless to look at. Noted, not re-rolled.
- Small batch by the size rule (same body volume as standing): red dragon k 7.73 (4.8 ft high, 7.7 ft span; standing 7
  ft), wyvern 9.96 (6.8 high, 10.0 span; standing 8), hawk 2.92 (1.7 high, 2.9 span; standing 2), imp 2.93 (2.3, 2.9;
  standing 2.2).

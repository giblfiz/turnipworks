# Painted ring icons for Attack and Target — 2026-10-29

Harry, 2026-10-29: "can you do our missing icons for attack and target just with chatgpt image path?" The ring buttons
`pawn.attack` (crossed swords, engine/client/surfaces/beyond20.js) and `pawn.target` (engine/client/surfaces/target.js)
landed with the Beyond20 work wearing line icons (`swords`, `crosshair`) while every other ring button has a painting.

## How the family is made (copied, not reinvented)
- The family is experiments/2026-10-15-ring-icons (Task J): two sets, charcoal (the house ring's set) and parchment.
  Every prompt is one template: "Use case: stylized-concept. Paint exactly ONE original Turnip Works fantasy tabletop
  UI pictogram: <metaphor> Heroic hand-painted style D ... Transparent outside the circle, preserve actual alpha ...".
  plan-additions.json holds the four new pictures in that exact form (only the metaphor differs).
- Packaging is that batch's own `tools/process.py` `prepare()` (package.py imports it): native alpha kept, Lanczos to the
  fifteen sizes, lossless WebP into tools/spawn-tuner/assets/ui-icons/<set>/ (git-ignored), provenance JSON, neutral
  31 px candidate.png. The four pictures were appended to its plan.json and inventory.json; manifest.json gains the two
  actions, every other action byte-identical. The ring needs no code change: surfaces/ring.js paints any button whose
  command id has manifest variants in the chosen set.
- Generation: `gen.py <set> <id> [note]` writes a brief (briefs/) and runs `codex exec -s workspace-write` (no
  OPENAI_API_KEY) with the built-in image_gen and a self-QA loop of up to four tries. No paid API anywhere.
- Blind reads: the 10-15 gate called gemini-vision.py (paid, blocked since 2026-10-20). blind_read.py sends the same
  neutral prompt + candidate.png through agy-run (Gemini subscription, serial under /tmp/agy.lock) into the same
  reads/ directories, and records the model it actually used in provenance.

## Round 1
- Codex made four tries per picture and rejected all sixteen: my brief's alpha check said "disc opaque" and the
  generator's discs are alpha 251-254. The existing family's sources are exactly 251-254 too (measured), so the check
  was wrong, not the pictures. Fixed the brief's wording; disc occupancy of every try (0.955-0.998) is inside the
  family's range (0.93-0.996).
- Gemini picked from contact sheets (pick/*.png: four family members R1-R4 above candidates A-D at 62 and 31 px):
  charcoal attack C, charcoal target D, parchment attack C, parchment target B.
- Real ring screenshots (shoot_ring.py: local relay, Mira's tab with Beyond20 Loaded and the painted set forced,
  Thorin linked -> Attack, Goblin 1 -> Target): Attack FITS in both sets. Target: charcoal "FITS"; parchment
  "FITS ... or DOES NOT FIT strictly on shape simplicity": the four corner brackets "look slightly like a modern/sci-fi
  lock-on HUD". Blind 31 px reads of both targets: "Focus / Center camera on piece" (corner brackets = viewfinder),
  target only as the alternative. Attack blind reads: "Attack", high confidence, both sets.
- So the Target metaphor changed: ring + four inward pointers kept (the table reticle's shape), corner brackets
  dropped, bigger pawn, crimson like the Damage heart. v1 sources kept in attempts/.

## Round 2
- Four more Codex tries per set with the new metaphor (the alpha check fixed). Codex's own QA still failed them all on
  "a clear gap between pawn and pointers"; Gemini's contact-sheet pick (pick/*-v2.*): charcoal A ("cleanest symmetry,
  the truest teal/crimson palette match ... Needs regeneration? No"), parchment B ("the cleanest separation between
  the red arrowheads and the teal pawn at 31 px ... fits the family cleanly").
- Real ring, both sets (shots/ring-<set>.png, verdicts shots/ring-<set>-v2.gemini.txt): charcoal "Attack ... FITS",
  "Target ... FITS" (it "directly echoes the teal pawn from Sheet and the crimson red from Damage"); parchment
  "Attack ... FITS", "Target ... FITS". All buttons "clearly legible at gameplay size". Notes left as notes: the new
  pair looks a little crisper than the older four (parchment), the charcoal reticle sits close to the rim bevel.
- Blind 31 px reads (no label, no context): Attack "Attack", high confidence, both sets -> accepted. Target, both
  sets: "Focus / center camera on piece", medium, with "Target / ping the piece" the alternative -> learned (the
  10-15 meaning: the picture is usable, the exact command comes from its name). A reticle round a piece is that
  ambiguous on its own; on the ring it wears its name ("Target" on hover / labels) and reads right there.
- Pipeline: strict `tools/validate.py` 0 errors, 0 pending (process.py BLIND_MODELS now admits the agy-run models).
  Suites in this worktree: npm test all green (core 743/743, beyond20 46/46, relay 206/206, gamedice 178, harness
  5/5 ...); browser_pawnring 108/108; tests/browser_ring_ellipse 415/416, the one failure ("WORLD: with a wall between
  the camera and the pawn, the ring is drawn over it", buttons on top 2/4) is the same on a clean origin/main worktree.
- Shipping: the webp files are git-ignored (repository binary policy). They go to the main checkout's
  tools/spawn-tuner/assets/ui-icons/<set>/ and to the dev tuner tree's assets/ui-icons/ (copied alone: the full tuner
  deploy would also ship other people's uncommitted tuner edits); manifest.json is committed. Sources, attempts and
  the Codex transcripts are git-ignored or left untracked, and copied to the main checkout's copy of this folder.

## Round 3 — every ring command still on a line icon (Harry: "let's get those new icons to match the charcoal ones we use everywhere else")
- audit.py reads the live registry in a real page: commands with `ring` or `menu` (not stubs, not RING_CUT / NOT_IN_MENU)
  plus the ☰ table's lists, against manifest.json. 60 entries had no painting (audit.json): the statusfx conditions
  (paralyzed, incapacitated, dead, concentrating, exhaustion +1 / −1, Other…, the six typed-condition slots), First
  person's Eyes, Choose this pawn, Move, holes (wider / narrower), hills (height list, raise, lower, 10 ft, 20 ft, rock
  sides), the flat-roof materials and marble, roof edges / shape lists, battlements, turrets, trim put-back / remove,
  Turn roof, Export, Share link. (hand.delete already wears template.remove via PAINT_AS.)
- make_plan2.py: 38 new pictures x 2 sets (plan-round3.json) and 6 aliases to existing paintings, the 10-15 sharing
  rule (never two pictures side by side in one arc): roof.turn -> Turn, trim.remove -> the waste bin, roof/building
  Flat and Automatic shapes -> roof.style.flat / roof.style.auto. building.roof.* share roof.style.*; roof.battlements
  (the toggle) shares roof.edge.battlements; the six typed-condition slots share one tag picture.
- Generation (gen3.py): Codex built-in image_gen, batches of 2-4 per session, the 10-15 prompt templates (generic,
  condition, roof option) with one change: three of our own icons of the same category attached as STYLE references
  (the 10-15 method of its upright repair). Parchment = an EDIT of the accepted charcoal painting into the parchment
  treatment, plus parchment references, so every pair has the same geometry. fal was not used ($0 of the $10).
- Gemini through agy-run only, two kinds of call never mixed (blind3.py): a set match (existing icons R1-R4 above the new
  ones at 62 and 31 px, "does it belong to the same set") and batched blind reads (each icon's own 31 px candidate.png on
  #1c1f24, up to eight to a sheet, shuffled letters, no names). Sheets, answers and letter keys are under checks/.
- Charcoal set match, first pass: 34/38 YES. NO for paralyzed, incapacitated, dead, concentrating ("full-body figure
  with airbrushed neon lightning glow instead of R1-R4's close-up, chunky hand-painted brushwork"; "smooth 3D
  clay-rendered"; "fills the lower ground with textured dirt"). Repainted as close-up floating motifs: all four YES.
- Blind reads, charcoal: marble read as "overlapping slate / stone shingles" (the set already has Slate) -> repainted as
  big white veined panels. Concentrating (a yellow head with a gold ring) read as "Stunned" -> repainted as hands holding
  a sky-blue orb, no head, no yellow. Others: conditions all named right (Incapacitated, Dead, Paralyzed, add / remove
  exhaustion level, custom / add custom condition, high or medium).
- Concentrating v3 (hands holding a sky-blue orb): blind "Concentration (medium)" / parchment "Concentrating (high)";
  set match YES. Marble v2 (white veined panels): set match YES both sets, blind still reads the wedge first
  ("Gable roof shape / light stone tile roof material") -> learned, but no longer read as Slate.
- Parchment set match: 38/38 YES. Blind, parchment: every condition named right (Paralyzed, Incapacitated, Dead,
  Concentrating high; add / remove exhaustion level; custom / add custom condition).
- Review (review.json): 56 accepted, 20 learned of the 76 (learned = the picture is right, the exact option comes from
  its name: Choose this pawn, Share link, hill 10 / 20 ft and lower, whitewash, marble, the automatic edge, put back,
  parchment Rock sides and Export, charcoal shape list). Every condition accepted in both sets.
- Attack / Target redone with references too (compare_at.py, one call per set, the landed versions beside the new):
  charcoal "ATTACK: B, TARGET: D" (both new: "B's wider, stockier blades ... match that shape language"; "D uses the
  exact same squat, collarless, bell-shaped pawn design ... seen in R1"); parchment "ATTACK: B, TARGET: C" (new attack,
  landed target kept). Swapped in; old ones in attempts/. Charcoal Target's blind read is now "Target piece / Mark as
  target" (medium) -> accepted. Real ring, charcoal, round 3 (shots-r3/): Attack, Target, Eyes all "FITS"; "one
  cohesive painted icon family"; note: the new ones are "slightly crisper" than the older four.
- FOUND IN THE GAME: the nested arcs never showed paintings for tiles whose line icon is shared by a sibling (all 14
  conditions are 'badge-alert', the roof styles 'house', exhaustion 'activity'): nestButton drew initials and paint()
  skips a tile with initials. With the charcoal set the Conditions arc showed 2 of 18 paintings. Fixed in
  surfaces/ring.js: a tile the chosen set has a picture for is not "shared"; initials only among the rest. The real arc
  (shoot_conditions.py: a pawn prone, "hexed", exhaustion 2): 18/18 painted, both sets (shots-cond/).
- agy-run reads stdin when it is not a tty; started from a background shell it sat on an open socket for 20-40 min
  (wchan unix_stream_data_wait, fd 0 a socket). Every call here now has stdin from /dev/null; agy-run-bounded is a copy
  with its post-exit drain bounded (5 s), and the calls run under `timeout 1500` after the lock. Each blind sheet is
  built in its own temp folder holding only the sheet, so Gemini cannot read repo files.
- fal: not used. Spend $0 of the $10.
- Rebased onto condring (dca9bad5: paint() also leaves alone a button with its own picture, img.pic). Its report
  ("Conditions shows letters") is the same bug as above; with both changes the arc is 18/18 painted.
- Gemini on the REAL ☰ ▸ Conditions arc (shots-cond/conditions-<set>.png; pawn prone, "hexed", exhaustion 2; camera
  placed so every tile is unobscured: elementFromPoint 18/18 clear): first pass flagged Other… (a tag with a plus)
  as "nearly identical" to the custom-word tag -> repainted as a quill writing on a slip: blind "Add custom
  condition (high)", set match YES. Final: every one of the 18 tiles "FITS", both sets. Notes kept as notes: Prone (the
  10-15 painting, kept: it still means prone) "small and low-contrast"; the exhaustion heads share Stunned's yellow
  cartoon head (blind reads still tell them apart). Clear all is not in the Conditions arc (a bar command); its
  10-15 painting exists. An unused Prone repaint is in attempts/r3/.

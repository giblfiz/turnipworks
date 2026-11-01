# The eye tyrant (2026-10-24, Fauna, Claude Opus 5.5)

Harry asked for an "eye tyrant": a floating orb with one great central eye, a fanged mouth and eyestalks on top; Large,
floating. It is the classic floating-eye monster, but the best-known version of it is a publisher's product identity
(not in the open SRD), so the figure is ours: its own name (`foe-eye-tyrant`, "Eye tyrant"), its own design, and no
publisher image or name was given to the painter. Tags: eye tyrant, floating eye, eye monster, many-eyed, aberration,
floating (+ "monster", as every foe). The publisher's word is a SEARCH word only, in our UI code
(`engine/client/barwords.js` FIGURE_WORDS), never in the figure's tags, manifest or set records.

**Our design** (the line in `../2026-10-06-figures/set_more.py`): a 5-ft orb hovering 3.5 ft up on a narrow twisting
column of pale smoke (the set's floating-figure stand, as the wisp and the flying sword have), tilted back so its face
looks up at the table; one great eye with a goat's horizontal slot pupil; a crooked mouth of uneven blunt fangs; SIX
thick wrinkled stalks like short elephant trunks spread apart in a ring; a dusky burgundy-red warty toad hide mottled
ochre and moss green. Gemini, asked on the first plate whether it copies the publisher's specific iconography: no
(7 stalks then, not 10; blunt teeth; warty skin, no chitin plates; slot pupils; the smoke stand); what is shared is
exactly Harry's brief (an orb, one big eye, a mouth below it, stalks on top).

## Route and cost

The default set's route, run for one figure from this folder: `spec.py` (the set's own spec code, its line in
set_more.py) -> `plate.py` (the Codex painter with its built-in image tool; the figure gate blind-then-match and the
mask gate with Gemini on **agy-run**, `agy_vision.py`, never the paid API) -> `mesh.py` (fal TRELLIS.2, the pilot's
runner, this folder's own `spend.log`, cap $3) -> `qa.py` (the set's measure + rules + two tiers) -> four plain views
for the facing read (`render_views.py`) -> `publish_one.py` (the set's publish code, one record merged into
`set/published/manifest.json`) -> the gallery thumbnail (`thumbs.py`) -> `tools/spawn-tuner/build_figures.py`.
Binaries went where the set's live: `../2026-10-06-figures/set/{inputs,masked,tiers,published/tiers,published/thumbs}`
in the main checkout and the original on the USB disk (`set/models`).

**fal: $0.90** (three meshes at $0.30, `spend.log`, `fal-trellis2*/manifests/`). Plates and Gemini: no charge.

| try | plate | mesh | why another |
|---|---|---|---|
| 1 | moss/ochre hide, 7 stalks, orb 2 ft up on a wide mist column; gate passed first time | accepted by the rules | in the game at play distance Gemini: "on the floor", "dark, muddy", 3/10 |
| 2 | bright ochre-yellow, 6 stalks, 3.5 ft up, narrow column; three plates refused (the column's foot read as a disc), then accepted | accepted | "cartoonish, overly bright", 2/10 at play distance, 3/10 leaning in |
| 3 | the set's palette and washes, sculpted folds, trunk-like stalks; accepted first time; Gemini against a set plate (the manticore): style 9/10, far read 9/10 (tries 1 and 2: 3/5 and 4/7) | **shipped**, sha `f0439698` | |

## Measured (try 3, `qa/foe-eye-tyrant.json`)

9.0 ft to the stalk tips (drawn 6.03 ft at the house figure scale 0.67); a 10-ft base (2 x 2 squares, disc 9 ft);
the orb's underside 3 ft clear of the ground over a smoke column about 1.5 ft across: one ground contact, 1.5 ft;
reach 3.8 ft from the middle (inside its 5-ft half-square); unpainted 0 %; no floating piece; tiers 20k/1024
(1.1 MB, the shipping tier: large) and 8k/512. Facing: four views, Gemini: the eye looks straight out of the mesh's own
+Z (confidence 1.0), so no turn is stored. In the game (`table_shots.py`, local, an inn common room with the manticore,
a fighter, a goblin and the basilisk): lowest point 0.000 ft from its disc top.

**It floats the way the set's floaters float:** the hover is in the mesh, on its own smoke stand, and the pawn stands
on the ground like every figure. True flight (40 ft up) is the game's raised pawn (raise / lower: the base stays on
the ground, a beam and a height label), docs/VERTICAL.md "Flyers".

## Gemini in the game (agy-run, one still each, labels read first; `shots/`)

- **Leaning in** (45 ft, 38 degrees): read as the eye monster, eye toward the camera, **floating** "on a swirl of smoke
  flight stand"; 6/10 beside manticore 8, knight 8, basilisk 7, goblin 6. Faults it listed: the mouth not seen from
  that angle, the smoke stand plain, stalk eyes undefined, less dark wash than the manticore.
- **Play distance** (110 ft, 58 degrees): read as the eye monster, but **"on the floor"** (from that high the orb hides
  its own stand), "a muddy reddish-brown lump", eye and mouth "barely discernible"; 3/10 beside manticore 4, fighter 6,
  goblin 7 (the same judge gave the manticore 8 and 4 in two reads of the same scene: noisy).
- Close-up notes (not verdicts): faceting on the silhouette, a soft texture on the eye.

So: named and floating when leaned in; small and flat at play distance, like most large figures there but more so.
Harry's eye decides; a fourth plate is free and a mesh $0.30 if he wants one.

## The basilisk

`foe-basilisk` (Basilisk, foe, 3 ft) was already there: the command bar finds it first for "basilisk" (now a "must"
line in `engine/test/bar-corpus.json`), and in Place a pawn it is under Monsters > Monsters of legend, beside the eye
tyrant.

## Files

`spec.py`, `plate.py`, `agy_vision.py`, `mesh.py`, `qa.py`, `render_views.py`, `publish_one.py`, `table_shots.py`
(each says how to run it); `assets.json`, `gate-manifest.json`, `prompts/`, `qa/`, `fal-trellis2*/manifests/`,
`spend.log`, `shots/result.json`. Earlier tries' plates, meshes and shots are in `r1/`, `r2/` on the build box (not in git).
Note for whoever repeats this: agy-run, given room to, wanders (crops the image, greps the repo for the prompt, reads
other lanes' files); every vision prompt here says "do not run commands or open other files", and the gate runs
in the foreground (in the background its agy turns stalled with no answer).

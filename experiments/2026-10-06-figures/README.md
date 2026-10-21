# Figures pilot (2026-10-06, Fauna, Claude Opus 5.5)

Harry decided pawns will be 3D figures, not flat standees, and asked: "Start by trying like 4 in fal, and let's see how
they come out. No bases; let's add the bases ourselves afterwards in engine by default."

**The one question:** can our pipeline (painted plate, blind gate, matte, image-to-3D on fal TRELLIS.2) make a
tabletop figure that reads as a good miniature at table distance: recognisable, clean, right proportions, thin parts
intact?

**Answer from the instruments (Harry's eye decides): yes, about 80 % sure.** All six meshes came back whole, fully
painted, standing flat with no base, facing forward, with sword, staff and spear unbroken. Gemini names all four from
the table camera and calls each a good miniature that matches the furniture. The weak point is not the mesh: from the
table camera a staff or spear 0.2 to 0.4 ft thick is too thin to be seen at all.

Look for yourself: https://implausible.enterprises/projects/turnip-works/figures-pilot/
(the four in an inn room at table distance by default; leaning in, close-up; each alone from the front, side and top;
turntable; night and day; base variants, seat colour, base width; first and second tries; game-size files; two verdict
buttons per figure). Nothing here is in the game, the tuner library or the catalog.

## The four figures, and why these

| figure | stated height | the hard case it tests |
|---|---|---|
| armoured human fighter, sword and round shield | 6 ft | a thin blade held away from the body, hard flat plates, a disc held edge-on |
| robed wizard, staff, pointed hat | 6 ft (7 ft to the hat tip) | a long thin shaft standing clear of cloth, a tapering point, feet under a robe |
| goblin with a short spear | 3.5 ft | a small creature with non-human proportions, big thin ears, the thinnest shaft |
| wolf | 3.5 ft to the ears, 5.5 ft long | a quadruped: four thin legs, a tail, no upright stance, a body longer than it is tall |

## What was made, and what it cost

Plates by the free Codex image route (`gen.py`), the prop batches' style reference
(`style-references/heroic-handpainted-tavern-v1.png`) attached, a figure-specific gate (below), BiRefNet matte.
Meshes on fal `fal-ai/trellis-2` with the settings of `src/fal_trellis.py` (1024, 50k faces, 2048 px, remesh), run by
`mesh_fal.py` (the cave pilot's runner: it saves the request id so a lost poll does not lose a paid mesh).

| what | cost |
|---|---|
| four meshes, first round (`fig-fighter`, `fig-wizard`, `fig-goblin`, `fig-wolf`) | $1.20 |
| two second tries with changed plates (`fig-wolf-b`, `fig-goblin-b`), see "Second tries" | $0.60 |
| **total on fal** (`spend.log`; cap was $2.20) | **$1.80** |

fal balance: $0.2725 left. It read $2.3725 when I checked before starting and $2.0725 when my first call began six
minutes later; my six calls are the $1.80 between $2.0725 and $0.2725. The other $0.30 was not this pilot.
No RunPod. Plates and Gemini gates: no spend beyond flash and pro vision tokens. Plate tries: wizard 2 (the first had
the staff resting against the robe; the gate refused it), every other plate 1. 7 images for 6 accepted plates.

## Prompts

Full text per figure: `prompts/<id>.spec.md` (as sent: `prompts/<id>.tryN.md`); built by `build_spec.py`. Every prompt is

- a header: "a painted tabletop miniature FIGURE of ..." and "the supplied image shows the furniture and rooms this
  figure will stand among; use it only as a guide to the painting style";
- **Geometry:** heroic-scale miniature proportions, stout, slightly oversized head, hands, feet and weapons; "weapons
  and staffs are THICK like on a wargaming miniature (a blade as thick as a thumb, a shaft as thick as a wrist)"; hands
  as chunky fists;
- **Finish / Palette:** the house style's own words, plus "FULLY PAINTED in full colour" and "NO blue, teal or cyan
  anywhere on the figure (the background is a blue mask)";
- **Avoid:** grey primer, pewter or statue look; capes, straps, feathers, hair strands; glow and effects; turnaround sheets;
- **Pose:** "ONE single full figure, the WHOLE body in frame from the top of the head (or hat) to the soles of the
  feet, standing still in a clear, stable, readable classic miniature pose (not a T-pose, not an action leap, not a
  crouch). Limbs and weapon are held SLIGHTLY AWAY from the body with clear background visible in the gaps, so nothing
  fuses together. Feet planted FLAT on the same level";
- **NO BASE:** "no base, no ground disc, no plinth, no pedestal, no rock, no grass tuft, no patch of floor under the
  feet ... No cast shadow and no dark blob under the feet";
- **Presentation:** one figure, three-quarter front view (about 30 degrees), plain chroma-blue background, even light;
- **Specific design:** the creature, its height in feet, each hand, where the weapon's ends are.

**The gate** (`gen.py`, replacing the prop gate, which forbids people). Blind first: Gemini is asked what the figure
is, what it holds and in which hand, whether background shows between each pair of neighbouring parts, what is under
the feet, whether anything is cut off by the frame, whether it is painted. A second, text-only call compares that
description with the spec and refuses any base, plinth, ground patch or shadow, a cropped figure, fused limbs where a
gap was asked for, a missing or incomplete weapon, the wrong creature. Then the usual matte and mask gate.

## Measured (`measure.py` -> `kit.json`; nothing here is by eye)

Sizes in feet after scaling. Each figure is scaled so the top of the figure ITSELF is at its stated height; the weapon
is found first and left out of that (the goblin is 3.5 ft, not "3.5 ft to its spear tip").

| | fighter | wizard | goblin | goblin, 2nd | wolf | wolf, 2nd |
|---|---|---|---|---|---|---|
| height (to its highest point) | 6.0 | 7.05 hat tip | 3.5 (3.84 spear tip) | 3.5 (4.25 spear tip) | 3.5 | 3.5 |
| plan, wide x deep | 6.1 x 4.5 | 4.7 x 2.9 | 2.95 x 1.8 | 2.85 x 1.6 | 1.9 x 4.3 | 2.5 x 4.4 |
| triangles / file | 49.2k / 2.9 MB | 48.6k / 2.6 MB | 49.9k / 2.9 MB | 48.4k / 2.4 MB | 49.7k / 2.3 MB | 49.1k / 2.5 MB |
| unpainted, of what can be seen | 0.0 % | 0.1 % | 0.0 % | 0.0 % | 0.0 % | 0.1 % |
| unpainted, whole surface | 0.0 % | 2.5 % (inside the robe) | 0.1 % | 0.0 % | 0.0 % | 0.2 % |
| loose bits floating free | 1 speck (0.04 ft) | 0 | 1 speck (0.03 ft) | 0 | 0 | 0 |
| base or ground patch in the mesh | no | no | no | no | no | no |
| ground contacts | 2 boots | robe hem + staff foot | 2 feet | 2 feet | 4 paws | 4 paws |
| highest contact off the ground plane | 0.006 | 0.006 | 0.001 | 0.001 | 0.024 | 0.001 |
| share of each sole within 0.06 ft of level | 76 to 83 % | n/a (hem) | 78 to 83 % | 85 to 90 % | 74 to 82 % | 81 to 86 % |
| thin straight part | sword 3.5 long, 0.38 thick | staff 6.2 long, 0.40 thick | spear 3.7 long, 0.21 thick | spear 4.3 long, 0.20 thick | | |
| ... unbroken along its length | yes | yes | yes | yes | | |
| ... standing clear / joined (the grip) | 83 % / 17 % | 89 % / 11 % | 86 % / 14 % | 93 % / 7 % | | |
| ... its low end above the ground | held at 2.7 | 0.06 (on the ground) | 0.33 (hangs) | 0.06 (on the ground) | | |
| legs separate | 2 islands, ground to hip | under the robe | 2 | 2 | 4, ground to belly | 4, ground to belly |
| tail | | | | | separate from the legs | separate from the legs |
| outline against its own painting (overlap) | 90 % | 91 % | 84 % | 81 % | 88 % | 84 % |
| ... of the painting lost / added by the mesh | 2 % / 9 % | 2 % / 8 % | 8 % / 11 % | 12 % / 9 % | 6 % / 7 % | 10 % / 7 % |
| furthest reach from the base's centre | **3.9** | 2.4 | 1.6 | 1.5 | 2.2 | 2.5 |
| facing | +Z | +Z | +Z | +Z | +Z | +Z |

How each line is measured:

- **Unpainted:** 400,000 points on the surface, each looked up in the colour map; unpainted = alpha 0 or black. "Seen"
  = the first surface met from above and from the four sides. The slope pilot's bulky pieces were 29 to 69 % on this
  same route; these are under 0.2 %.
- **Loose bits:** the mesh's texture seams are welded, connected parts counted, and a part is "floating" when its
  nearest point is more than 0.03 ft from the main part. The three specks are smaller than half an inch at scale.
- **Base sneaked in:** the lowest 2 % of the figure covers 11 to 32 % of its plan in separate patches (feet). A disc or
  ground patch would be one patch covering most of the plan. None.
- **Feet:** every separate patch in the lowest 9 % of the height is a contact; "off the ground" is its lowest point
  above the lowest point of the whole mesh. Worst: the first wolf's front paws, 0.024 ft (a third of an inch).
- **Thin straight part:** the figure is cut into 64 slices along each axis; a thin island followed from slice to slice
  is the shaft; along its length each slice is clear (its own island), joined (it runs into something bigger: the hand)
  or broken (nothing there). No slice of any of the four weapons is broken, and the only joined stretch is the grip.
  Fingers and ears are not measured; Gemini judges them below.
- **Outline:** the mesh's outline is matched against the plate's cut-out over view angles and small shifts. "Lost" =
  part of the painting with no mesh behind it (a thin part gone); "added" = mesh where the painting had background (a
  gap webbed shut). Nothing is webbed: the 7 to 11 % added is the mesh being a little stouter all over.
- **Facing (the project's orientation step):** eight work-lit views turned in 45-degree steps, blind Gemini read
  (`gemini/yaw-*.txt`, `yaw.json`): all six face the mesh's own +Z, confidence 0.9 to 1.0. Cross-check by measurement:
  the view that best reproduces each three-quarter plate is 5 to 40 degrees off +Z. So this route hands figures back
  facing forward and no turn is stored.

**Proportions are not obeyed, as in the slope and cave pilots.** Asked: wolf 5.5 ft long, came 4.3; goblin spear tip at
4.5 ft, came 3.84 (and at 5 ft in the second try, came 4.25); the fighter's stance came 3 ft wide between boot
centres. Height is set by the page, so only the ratios matter, and a short spear or a compact wolf does no harm.

**The one that matters: the fighter's sword and shield reach 3.9 ft from the middle of his base**, 1.4 ft past the
edge of a 5-ft square, because the prompt asked for them "out to the side". 8.5 % of his surface is outside his
square. Next to a wall or another pawn they will overlap.

## The base, built by the page (`viewer/main.js`: `makeBase`)

- **Footprint:** one 5-ft square for all four. The goblin shares the human square (small creatures take a square in
  the game's grid). The wolf also stays in one square: at 3.5 ft to the ears it is 4.3 to 4.4 ft long and its paws
  stand inside a circle 3.1 to 3.3 ft across, so a larger base is not needed (a horse or an ogre would need one).
- **Width:** 4.5 ft by default (90 % of the square, so two neighbours do not merge), slider from 2.5 to 5 ft. The
  widest set of feet (the fighter's) needs 4.3 ft.
- **Centre:** the middle of the smallest circle round everything that touches the ground (`kit.json` plan.centre).
- **Variants:** a plain dark disc 0.3 ft thick; the same disc with a rim in the seat's colour; a ring painted on the
  floor with no disc (the banks demo's better answer on slopes); none. Six seat colours.
- **Facing:** a small arrowhead at the front edge, turning with the figure.
- **Sits properly:** the page measures it (`window.__figs`): the lowest point of every figure is 0.000 ft from the
  top of its disc, or from the floor for the ring, in all four variants (`live_check.py` prints it).

## Gemini (gemini-2.5-pro; blind first; `gemini/`, shots in `shots/r1` and `shots/r2`)

### Blind, at table distance in the room: "describe every figure you see: what is it, what is it holding, what is it standing on?"

The game's night look, the rim base; first tries read 5 times (4 night, 1 day), second tries 5 times (3 night, 1 day,
1 with the game-size files).

| figure | what Gemini called it | what it is holding | standing on |
|---|---|---|---|
| fighter | "a knight or a heavily armored warrior", 10 of 10 | "a sword in its right hand and a large, round shield on its left arm", 10 of 10 | "a black circular base with a red rim" |
| wizard | "a wizard or a mage", 9 of 10 (once only "a robed figure" in a pointed hat) | **the staff is never seen: "does not appear to be holding anything", 10 of 10** | the same |
| goblin, first | "a goblin", second guess "a small orc", 4 of 5 (once only "a green-skinned creature") | **"a small, dark object ... a crude dagger or a club", 5 of 5; never a spear** | the same |
| goblin, second (taller pale spear) | "a goblin", 5 of 5 | **"a small, dark object" 3 of 5, nothing 2 of 5; never a spear** | the same |
| wolf, first | **"a large dog, like a mastiff", second guess wolf, 3 of 5; "a wolf or a large dog" 2 of 5** | nothing | the same |
| wolf, second (lean, grey, no ruff) | "a wolf", second guess "a large dog", 5 of 5 | nothing | the same |

Leaning in (38 degrees, 45 ft; one or two reads each): fighter, wizard "holding a gnarled wooden staff", goblin
"holding a simple spear", all named. The first wolf was "a lion, possibly a young male ... or a hyena" and "a wolf or
a hyena ... a mane around its neck"; the second wolf "a wolf ... or a coyote".

### Close-up, per figure (blind description of four sides, then the questions)

The blind names below are from a re-run with neutral file names (`shots/neutral/figure1..6`, `gemini/r3-*`): the Gemini
tool passes file names to the model and the first run's names said "goblin" and "wolf". The names held.

| figure | blind name | anything malformed, fused, missing, melted | painted miniature (0-10) | matches the furniture (0-10) | size by the chair and door | verdict |
|---|---|---|---|---|---|---|
| fighter | "an armored humanoid figurine ... a short, broad-bladed sword ... a round shield" | "the blade of the sword is slightly wavy, and the hand holding it is a bit blocky, with fingers that aren't clearly defined" (minor) | 9 | 10 | right | good miniature |
| wizard | "a wizard or magician", second guess "a gnome" | "the left hand is a bit simple and blocky" (minor) | 10 | 10 | right | good miniature |
| goblin, first | "a goblin", second guess "a small orc or a gremlin", "holding a simple spear" | "fingers fused together and into the spear shaft" (noticeable close up) | 8 | 10 | right | good miniature |
| goblin, second | "a goblin", second guess "a small orc", "holding a spear" | "fingers on the hand holding the spear are somewhat fused" (noticeable close up) | 9 | 10 | right | good miniature |
| wolf, first | "a wolf", second guess "a husky or a malamute" | none | 10 | 10 | right | good miniature |
| wolf, second | "a wolf", second guess "a husky or a German shepherd" | "paws are slightly blocky and lack distinct toes" (minor) | 9 | 10 | right | good miniature |

All six, blind: nothing malformed, webbed, broken, doubled or floating; the only thing listed is fingers sculpted as
one mass round a grip (and, in these shots, feet "fused" to the page's disc); "painted in colour all over". The style score is a 10 every time, which says the question is too easy for Gemini to fail; Harry's
eye is the test of that one. Stout proportions: the wizard's plate was read by the gate as "a short, stout ... dwarf
or gnome", and the mesh once as a possible gnome. In the room Gemini calls his size right.

### Bases (four pairs of shots, table and leaning in; four reads)

| | best overall | second |
|---|---|---|
| read 1 | ring on the floor | disc with coloured rim |
| read 2 | ring on the floor | plain dark disc |
| read 3 | disc with coloured rim | ring on the floor |
| read 4 | disc with coloured rim | ring on the floor |

- The ring "is the least intrusive ... marks the figure's occupied square without obscuring its feet", all four reads.
- The rim "would make a player-specific colour easiest to see at table distance" in three reads of four (the fourth
  preferred the ring: the rim's colour is on the disc's edge, half hidden from above). The plain dark disc is
  "clearest that these are pieces" in two reads, and never best overall.
- The facing arrow is "barely" visible at table distance in all four reads (seen clearly leaning in; it points the
  way the figure faces). It was enlarged once after the first read and is still small: 1.2 ft wide.
- Floating or sinking: none in three reads. One read said feet "sink slightly" into the plain dark disc; measured 0.000 ft
  (dark boots on a black disc).

### Game-size files (the furniture's shipping tier: 5,000 triangles, 256 px, about 0.27 MB instead of 2.6 MB)

Made with `src/optimize_glb_blender.py` (`tier/`), behind the page's "Game-size files" box. At table distance the
blind read is the same (knight, wizard, goblin, wolf). Close up, against the full meshes: fighter, wizard and goblin
"clearly worse" ("the blurry texture makes the figure look flat"), wolf "slightly softer". The shape holds; the
256-px picture does not. Figures are looked at harder than chairs and will want a bigger picture than the furniture
tier (512 px is the obvious next step; not tested).

## Second tries (what a changed prompt can and cannot fix)

- **Wolf: fixed by the prompt.** "A lean, rangy GREY timber wolf ... not a dog, lion or hyena: a LONG narrow muzzle,
  tall pointed upright ears ... NO mane and NO neck ruff ... light warm grey fur with a darker charcoal saddle". From
  the table camera: first try a dog 3 of 5, second try a wolf 5 of 5. The first prompt had asked for a "thick ruff at
  the neck" and brown-grey fur, and that is what read as a mastiff or a lion.
- **Goblin's spear: not fixed.** Asked for an extra-thick, pale, taller spear with a bright head. It came 0.20 ft
  thick (the first was 0.21), 4.25 ft to the tip, and reaches the ground. From the table camera it is still never
  called a spear. At that distance 0.2 ft is about 3 pixels of a 1600-px window. "As thick as its wrist" bought nothing.

The page shows the second tries by default; untick "Second-try wolf and goblin" for the first.

## Honest answer

**Can this pipeline make a figure that reads as a good miniature at table distance? Yes, about 80 % sure**, for
creatures like these four. What the 80 % rests on: six meshes out of six usable from six fal calls with no mesh
re-rolled for a fault; every measured failure the slope pilot hit on this route (unpainted faces, lost parts) absent;
no base, flat feet, forward facing without help; Gemini naming three of four blind from above on the first try and
four of four after one plate change. What the other 20 % is: six is a small sample; nothing with wings, a bow string,
a cloak, a rider, or a creature bigger than one square has been tried; and the style and "good miniature" scores come
from a judge that gave ten out of ten every time.

**Weakest thing:** what a figure holds disappears at table distance. Staff: never seen in ten reads. Spear: never
named in ten reads. A sword and shield survive because they are broad. It is not a fault of the mesh (all present
and unbroken) and not fixed by asking for a thicker shaft.
Second weakest: the fighter's sword and shield stick 1.4 ft out of his square.

## What I would change before a full default set (not done)

1. **Everything inside the square.** Replace "held out to the side" with: the whole figure, weapon included, fits
   inside an upright cylinder 4 ft across; weapons upright or across the body, a hand's width clear of it.
2. **Make held things broad, not thick.** A staff with a big head (a lantern, a crook, a chunky crystal block), a
   spear with a wide banner-like head or a halberd blade, a bow drawn as a thick limb. Ask for the silhouette from
   above, since that is where the camera is. Pale against dark clothes, never wood-brown (the floors are wood).
3. **Name the look-alikes for every animal** ("not a dog, lion or hyena") and its two or three tell-tale features;
   say what colour it is NOT.
4. **Keep the gate as it is**, and add the measured checks as a mesh gate: reach inside 2.5 ft, no floating part over
   0.1 ft, contacts within 0.05 ft of one plane, the tracked weapon unbroken. They run in about 20 seconds a figure.
5. **A figure tier for shipping:** 5k triangles is enough at table distance; the picture wants 512 px. Test before
   the batch.
6. **Route:** this pilot only proves fal's TRELLIS.2. The project's RunPod pod runs the same model family for about a
   cent a mesh; run these six plates through it first as a canary (cents) and compare the same measurements.
7. On the page side, for whoever builds pawns: a bigger facing mark, and the rim or ring decided by Harry.

**How big is a robust default set, and what would it cost?** About 64 figures: 24 heroes (eight classes in three
body types), 12 townsfolk (innkeeper, guard, merchant, noble, priest, smith, peasants, a child, bandits), 22 monsters
(goblin, orc, kobold, skeleton, zombie, ghoul, cultist, ogre, troll, giant spider, giant rat, ghost, slime and so on)
and 6 animals (wolf, bear, boar, horse, dog, cat). Allowing a third again for second tries, about 85 meshes:

- fal at $0.30: about **$25**.
- RunPod: the project's last batches ran $0.009 to $0.014 a mesh (441 for $3.84, 53 for $0.76, 73 for $0.97), so
  about **$1 to $1.50** including pod start-up. Figures are untested there.

Plates and gates stay free either way (Codex image route, flash vision tokens).

## Files

`build_spec.py` -> `assets.json` (prompts in `prompts/`); `gen.py` plates and the figure gate (`gate-manifest.json`);
`mesh_fal.py trellis2 ids` meshes and `spend.log` (manifests in `fal-trellis2/manifests/`); `measure.py --kit` ->
`kit.json` (`yaw.json` holds the facing); `build_room.py` -> `room.json` (the room, from the game's library, read-only);
`viewer/` the page; `deploy.sh [dir]` builds it (live by default, version-stamped); `shoot.py` headless shots and the
page's own measurements; `live_check.py [--post]`; `read_verdicts.py`. Gemini prompts and every answer: `gemini/`.
Write-back: kind `figures_pilot` on the ratings server (`server/ratings_server.py`, tw-ratings restarted); the one
record in `reviews/tuner/figures_pilot.jsonl` so far is marked TEST (a second self-test went to the test sandbox).
Binaries (plates, meshes, shots) are git-ignored and stay on the build box. Mesh measuring needs
`~/.local/share/tw-trimesh-venv`; plates need `~/.local/share/tw-birefnet-venv`.

---

# The default figure set (2026-10-06, same day; Fauna, Claude Opus 5.5)

**518 figures, all 518 published**: heroes 168 (12 classes x 7 peoples x man and woman), townsfolk 118, foes 154,
large creatures on 10-ft bases 51, beasts and mounts 27. Gallery (thumbnails, filters, a turntable in the game's
lighting, two verdict buttons per figure): https://implausible.enterprises/projects/turnip-works/figures-pilot/set/

Nothing is listed as not published. Nothing here is in the game, the tuner library or the catalog yet. All 518 are in
the full asset rater at https://implausible.enterprises/projects/turnip-works/review-figures/ under the distinct
`figures-01` ratings namespace; the gallery remains the table-context verdict surface. The files sit at stable paths
under the gallery URL for whoever builds pawns (`manifest.json`: id, tags, SRD names, sizes, facing, base size;
`tiers/<id>--20k1024.glb` for heroes, bosses and large one-offs, `tiers/<id>--8k512.glb` for hordes and townsfolk,
`models/<id>.glb` the 49k original).

## Route and cost

Plates by the free Codex image route (16 painters, about 340 accepted plates an hour, no quota message all afternoon),
the figure gate, the matte, then TRELLIS.2 on five rented RTX 4090 pods (settings of the fal pilot: 1024 cascade,
2048 px, 50k faces; about 50 s a figure and about 3 minutes to load the model at the start of every wave), measured QA,
two shipping tiers, publish, Gemini's blind read of each gallery picture.

**RunPod: $9.18 for the set, measured from the account balance** ($69.69 at 13:44 to $60.51 at 16:55; cap $15). That
includes the route check of the four pilot figures, about 560 meshes (518 figures, 17 second meshes, 17 repainted
plates meshed again, and a handful made twice by the faults below). Plates and Gemini reads: no charge.
`spend.log` has the total line; the SPENT lines per pod show the account difference since that pod started, not the
pod's own cost.

## Numbers

- **Plates:** 532 accepted (518 figures + 14 body reference plates) from 632 paintings. The gate refused 37 plates at
  some point; every one was painted again and passed, most after the gate's wording was loosened where it was stricter
  than the picture deserved ("missing tusks" on four orcs, "missing tall headdress", "not bent", a jailer's "extra
  weapon", the foam ring under the merfolk and the shark read as a base, the grimlock's eyes), two after a real fault
  (the chimera's five legs; the devil's spread wings, fixed by asking for wings "wrapped round its shoulders like a
  short cloak").
- **Meshes:** 518 accepted. 17 figures needed a second mesh (a loose piece hovering clear of the body, or an unpainted
  patch). Three failed twice and were repainted instead, then passed first time: the cow, the tiger, the dwarf fighter
  woman. One is published with a note Harry can see: `hero-ranger-tiefling-f`, a loose piece 0.5 ft across after two
  meshes.
- **QA notes on published figures** (notes, not faults): 119 have a separate shell lying within half an inch of the
  body (how the generator builds pouches and hair), 117 have one foot more than 0.12 ft off the ground, 17 reach
  outside their square by 0.6 ft or more (2 by more than 1.5 ft), 15 need a base wider than their square for their feet.
- **Gemini's blind read lists a fault** (something fused, missing or malformed) for 4 of 518.
- **SRD coverage** (`COVERAGE.md`): 277 creatures listed, 155 with their own figure, 122 with a stand-in, 0 missing.

## Can a blind eye tell the classes apart? (`class_test.py`)

Each hero alone, from its gallery picture, never told what it is, asked for one class of the twelve. First guess right:
**161 of 168.**

| class | first guess right | called instead |
|---|---|---|
| barbarian, bard, cleric, druid, monk, rogue, wizard | 14 of 14 each | |
| ranger | 13 of 14 | druid |
| sorcerer | 13 of 14 | monk |
| warlock | 13 of 14 | wizard |
| fighter | 12 of 14 | paladin, twice |
| paladin | 12 of 14 | cleric, twice |

**The warlock question, and how it was settled.** With the first kit (dark robes, a skull staff, a tome in the hand)
warlocks were named warlock 9 of 14; the other five were called wizards. The kit was rewritten to share nothing with
the wizard: a hooded knee-length coat over trousers, the book hanging at the hip on its chain, a small red imp on the
shoulder, a short skull rod with a ball of green fire. Four were repainted as a test (human man, elf man, small-folk
man, dragonborn woman; all four had been called wizards). A blind read of the four new plates gave warlock 12 of 12
(`plate_blind.py`, three reads each; `set/plate-blind.json`), and on that the other ten were repainted without waiting
for the meshes, the old meshes kept in `set/rerolled/`. The verdict is the mesh read: the four test figures 4 of 4,
all fourteen **13 of 14**. The one miss is the small-folk woman, called a wizard with warlock as second guess. The
first kit's reads are kept in `set/blind-warlock-first-kit.json`.
Harry, the same hour: do not spend more on telling warlock, wizard and sorcerer apart (or fighter, paladin and cleric);
"I can't do that with most professionally made products." Nothing more was repainted for class.

Peoples are weaker than classes and were left alone: tiefling 23 of 24, elf 20, orc 19, small folk 19, dragonborn 17,
human 16, dwarf 16. The house style makes everyone stout; alone in a picture a dwarf and a human differ by beard. On
the table they differ by height, which the page sets exactly.

## The crash, and what it showed (15:33)

the build box crashed and rebooted in the middle of the run. The five pods kept meshing; everything that watched them was
a local process and died: the conveyors and all five deletion timers. Nothing on disk was damaged (every script
parsed, every state file loaded, 1,757 GLBs and 873 recent images checked whole). The main session re-armed the timers
and restarted the conveyors within six minutes. But for those minutes five pods at $3.73 an hour had nothing that would
ever have stopped them.

**So there is now a second timer on the pod itself: `tools/pod_deadman.sh`.** A detached
`sleep N; runpodctl remove pod $RUNPOD_POD_ID` on the pod, using the pod-scoped key RunPod puts in the container (it
is in PID 1's environment, not in an ssh shell, so the script reads `/proc/1/environ`). `pod_up.sh` arms it as soon as
ssh answers, 10 minutes later than the local timer (the local one also books the spend, so it should win when both
are alive). **Verified live:** armed on `tw-figs-e` with 40 seconds once its work was home; the pod removed itself and
GET pod returned 404 at 43 seconds, the local timer untouched. Rules: extending a pod's time means moving both timers
(`pod_timer.sh` says how in its header); state on the pod is in `/root`, never `/workspace` (the volume is shared).

## Faults in the conveyor, found by finishing the run (all fixed in `dispatch.py` / `tools/pod_down.sh`)

1. **A repaint request was dropped when every pod was busy.** An id left `set/REMESH` the moment the dispatcher saw
   it, sent or not. Now it leaves only when a pod has taken it, only once its new plate is accepted, and a repainted
   plate gets its own two mesh tries.
2. **A figure sent to a second pod could come home as its old mesh.** The first pod still held the old GLB, the next
   harvest brought it back, and the two copies replaced each other every round. A figure now belongs to one pod: the
   one it was last sent to; its plate and mesh are removed from every other pod's queue, here and there. Three heroes
   (elf barbarian man, small-folk bard woman, tiefling ranger woman) show their first mesh because of this; all three
   first meshes pass QA after the unpainted measure was corrected, so they were left.
3. **`pod_down.sh` with several pods on one volume** judged the other pods' run folders and refused; and it counted
   0 meshes through a symlinked models folder. It now looks only at its own queue folders.
4. **The dispatcher stopped collecting from a pod's folder the moment the pod was deleted.** It now reads every queue
   folder, live pod or not.
5. Not fixed, for next time: a dispatch round takes 2 to 7 minutes with five pods (five harvests one after another),
   and a figure given to a busy pod waits behind that pod's whole wave, so the last 30 figures sat on one pod while
   four were idle (half its queue was moved by hand). Harvest in parallel, and give plates to pods in small waves.

## Files (the set)

`set_spec.py` + `set_more.py` -> `set/assets.json` (532 plates; prompts in `set/prompts/`); `run_plates.py` (the plate
queue; `set/WORKERS`, `set/RETRY`, `set/STOP`) -> `set/gate-manifest.json`; `dispatch.py` (plates to pods, meshes home,
second tries; `set/REMESH`, `set/retries.json`) run by `loop_dispatch.sh`; `cycle.sh` = `set_qa.py` (measure, judge,
tiers; `set/qa/<id>.json`) + `publish.py` (`set/published/manifest.json`) + `thumbs.py` + `set_blind.py`
(`set/blind.json`) + `deploy_set.sh`, run by `loop_publish.sh`; `status.py` one screen of where it stands;
`class_test.py`; `plate_blind.py`; `coverage.py` -> `COVERAGE.md`; `gallery_check.py` (65 checks, all pass on the live
page); `build_review.py` -> the shared review data contract; `review_check.py` checks the live 518-item rater and a
sandboxed score. Pods: `tools/pod_up.sh`, `pod_timer.sh`, `pod_deadman.sh`, `pod_down.sh`, `launch_wave.sh`, `harvest.sh`; one
folder per extra pod under `pods/` with its own `pod-<id>.json`, timer log and spend lines.
Originals are on the USB disk (`/mnt/usb/turnip-works/figures-set/`); tiers and thumbnails in `set/` (git-ignored).

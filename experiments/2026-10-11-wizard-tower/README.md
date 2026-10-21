# Wizard's tower (2026-10-11/12): the wizard / alchemist tower room type

Harry, 2026-10-11: "We probably need a alchimist / wizards tower tile set." A new room TYPE beside Inn, Crypt, Castle and
Mansion: Build → Fantasy → Wizard's tower (catalog setting ARC). Made the way the crypt, castle and mansion were
(`../2026-10-05-castle-crypt-mansion/integration/PLAN.md`): design → plates (free Codex route) → gates → meshes (RunPod)
→ mesh QA → manifest → runtime files and the faces x skins ladder → orientation → appended programs → tests → blind reads.

    python3 wizard/build_spec.py                       # wizard/assets.json + prompts/ (58 meshes)
    python3 flats/gen.py list                          # the 15 flats (4 keyed plates, 11 room icons)
    python3 tools/make_manifest.py wizard wizard-01    # catalog/runs/wizard-01/manifest.tsv
    python3 integration/apply.py --tree ../../tools/spawn-tuner [--check]     # the whole integration, as hunks
    node ../../tools/spawn-tuner/test/wizard.test.mjs ../../tools/spawn-tuner

## Rooms (11) and walls

| key | label | cells | built round |
|---|---|---|---|
| `wiz-lab` | Alchemy laboratory | 5x4 | the brick furnace; benches of coloured apparatus |
| `wiz-study` | Library & study | 4x4 | crammed bookcases, the desk before them, the great book on its lectern |
| `wiz-summoning` | Summoning chamber | 4x4 | the circle in the middle of the floor, candles on its rim |
| `wiz-observatory` | Observatory | 4x4 | the great telescope on the inlaid star floor |
| `wiz-scrying` | Scrying room | 3x3 | the stone basin; the crystal ball on its pedestal |
| `wiz-store` | Potion store | 3x3 | shelves of bottles on every wall, stock on the floor |
| `wiz-apothecary` | Apothecary shop | 4x3 | the counter before a wall of drawers |
| `wiz-bedchamber` | Wizard's bedchamber | 4x4 | the purple bed; the robe and hat on their stand |
| `wiz-menagerie` | Familiars' menagerie | 4x4 | the great cage; birdcages round the walls |
| `wiz-stair` | Tower stair | 3x3 | the stone spiral (a working stair) |
| `wiz-workshop` | Enchanter's workshop | 5x4 | the stone arch between two crystal pylons; the enchanter's table |

**Wall families.** One new: `tower-stone` (warm buff ashlar in level courses, one plum-grey band course, a rounded
string moulding at the top): `wall-straight` x2, `wall-doorway`, `wall-window-small` (a tall leaded lancet, closed, no
open twin) and the leaf `door-tower--leaf`. Corners, floors and stairs borrow dressed stone; slate roof. The apothecary
shop uses the existing `half-timber` family plus one new special panel, `wall-shop-window--half-timber` (a projecting
display window; its bay faces the street). No new floors: the tower uses the library's flagstones, checker and planks.

**Shared roles.** A bed is `bed-canopy`, a bookcase `bookshelf`, a work table `table-kitchen-prep`, a counter falls
back to `counter-shop`: a recipe changes genre by its family and its tier. The tower's own meshes of roles other types
also use carry the exclusive tier `wizard`, so no older room rolls them (the golden test: 816 scenes of 51 older room
types, 0 differ).

**For the flavours system.** No runes, stars, moons or sigils on any wall, door, furniture or cloth (every prompt
forbids them; `build_spec.py` asserts the words out). The arcane marks are separate flats: `decal-ritual-circle--s1`
(white chalk, a seven-pointed star), `--s2` (red ochre, a triangle and rings), `decal-star-floor`, `map-wall--stars`.

## How a square tower reads (round walls do not exist)

**Badly: it is a tenement.** MEASURED once, on the live game (2026-10-12): four tower rooms of 4x4 cells stacked on
levels 0, 10, 20 and 30 (laboratory, study, bedchamber, observatory), all levels and the roof shown, three outside
views, one blind read by Gemini (`wizard/live-tower/`; one read is a coin, PLAN.md 15):
- named "a tenement building, tall townhouse or boarding house", very sure; "does not strongly read as a classic tower";
- what helped: only the height to width;
- what hurt: the house's gabled roof ("a wizard's tower might have a conical spire"); four identical storeys stacked
  ("the exact same floor module ... cookie-cutter"); small regular domestic windows; and the walls read as "horizontal
  wood planks or siding of a light brown colour" from outside: the buff ashlar's OUTER face (the plain back of the
  panel) does not say stone at that distance. It also called the plan rectangular.
So, in order of effect: a tower cap for a roof; an outer wall face that reads as stone (a darker joint, or a plinth
course and a top course that differ per storey); then round or eight-sided plans (docs/ASSETS_TO_BUILD.md → Wizard's
tower). INFERRED, not measured: looking DOWN into one cut storey the outline hardly matters (every room is named from
its contents); and a 3x3 or 4x4 footprint is the most a "tower" stands, since the spiral takes 2x2 cells of a floor.

## Counts

58 meshes specified (prio 1 / 2 / 3: 25 / 18 / 15), 58 plates accepted (64 images: three plates were re-prompted after
the gate refused them for things my own prompt had asked for: a brick ring under the still, a cradle under the jar, a
"corked" pot), 58 meshes, 58 accepted by mesh QA, 0 rejected (`wizard/qa/summary.tsv`; one override: the alembic's round
board was specified). Two skus were renamed at integration (`apothecary-drawers--s2`, `scroll-rack--s2`): the temple
batch shipped the same names the same night. Flats: 15 requests, 15 accepted.

**Spend.** One A100 80 GB pod (the 4090 was out of stock), 18:31 to 19:59 on 2026-10-11 = 1.46 h x $1.79 = **$2.62**
(computed: four other agents' pods ran at the same time, so the balance cannot be split). Deleted and verified (GET 404);
it carried both timers. Model load was 19 to 21 minutes per wave with three workers (10 with one), which is most of the
bill; one worker of the second wave died while loading. Plates and gates: free.

## What surprised

- **The gate refuses what the prompt asked for** when `must_not` is generic ("a base slab") and the design has one on
  purpose. Three of the four refusals were this.
- **Parallel batches collide on sku names**, and the runtime build overwrites `assets/m/<sku>.glb` before
  `build_data.py` can refuse the name (docs/STATUS.md).
- **`ctx.storeInfo` is read by the solver's own summary**: a program that sets a field of that name with another shape
  passes every node test and breaks the tuner page. The programs use `ctx.wizInfo`.
- **Blind reads**: `wizard/ROOM_READS.md`. The menagerie took three rounds; cages are the only thing that says animals.

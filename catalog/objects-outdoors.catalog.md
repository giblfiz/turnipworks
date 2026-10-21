# Outdoors gaps — the yard (2026-10-05)

Objects the yard grammar (`tools/spawn-tuner/ROOMS.md` → Outdoors, solver v2 `yard()`) wants and the catalog lacked. Harry approved the Outdoors room on 2026-10-05; the yard itself is dressed only from meshes that already exist. Most of what a yard wants (trees, bushes, hedges, fences, a field gate, dry-stone wall, flowerbed, planters, garden tools, a signpost) already had a catalog line and only lacks a mesh: those are listed with these in `docs/ASSETS_TO_BUILD.md`, which is the wishlist of record.

**Status (2026-10-05, evening): generated.** Every line here has a mesh or a flat image: the meshes came from the outdoors-02 batch (`experiments/2026-10-05-yard-props/`, manifest `catalog/runs/outdoors-02/manifest.tsv`), the flats from the free image route (`experiments/2026-10-05-outdoors/`). `hedge-end-block`, `wall-drystone-pier` and `woodpile-long` were added by that batch: the pieces that end or turn a hedge or wall run, and the long woodpile as its own object so it never lands by an indoor hearth.

## A8. Outdoor ground (yard, 2026-10-05)

- **floor-grass** — short trodden yard grass · ground · 1 · size:60x60x1 · organic · set:TAV,HUT,NOB,MKT,CMP,GRV · var:- · aff:- · flat · P1 · the yard's default ground; generated 2026-10-05 (4 variants)
- **floor-gravel** — raked pea gravel · ground · 1 · size:60x60x1 · stone · set:TAV,NOB,MKT · var:- · aff:- · flat · P2 · forecourts and drives; generated 2026-10-05 (2 variants)
- **floor-grass-worn** — grass worn to bare earth in patches · ground · 1 · size:60x60x1 · organic · set:TAV,HUT,MKT,CMP · var:- · aff:- · flat · P2 · busy yards, paddocks; generated 2026-10-05
- **floor-grass-meadow** — longer meadow grass with small flowers · ground · 1 · size:60x60x1 · organic · set:HUT,NOB,GRV,CMP,TAV · var:- · aff:- · flat · P3 · gardens and orchards; generated 2026-10-05
- **floor-cobble-mossy** — old cobbles with moss and grass in the joints · ground · 1 · size:60x60x3 · stone · set:TAV,MKT,CAS · var:- · aff:- · flat · P3 · back yards, wells; generated 2026-10-05

- **decal-grass-tuft** — tuft of longer grass, clover or daisies, seen from above · ground · sub · size:36x30x0.5~0.6-1.6 · organic · set:TAV,HUT,NOB,MKT,CMP,GRV · var:shape · aff:- · flat · P1 · scattered over floor-grass so a lawn is not one flat green; generated 2026-10-05 (4 shapes)
- **decal-grass-worn** — patch of lawn worn down to pale earth · ground · sub · size:48x36x0.5~0.6-1.6 · organic · set:TAV,HUT,MKT,CMP · var:shape · aff:- · flat · P1 · scattered thinly over floor-grass; generated 2026-10-05 (3 shapes)
- **decal-path-worn** — stretch of trodden earth path, soft-edged · ground · sub · size:60x48x0.5~0.6-1.6 · organic · set:TAV,HUT,MKT,CMP,GRV · var:shape · aff:- · flat · P1 · laid along the yard's door-to-gate path; the yard grammar lays it by itself once it exists; generated 2026-10-05

## M2. Yard furniture & fittings (yard, 2026-10-05)

- **table-picnic** — plank table with attached benches · ground · 1x2 · size:72x60x30 · wood · set:TAV,MKT,HUT · var:ruin · aff:sit · mesh · P2 · beer gardens and inn yards; generated 2026-10-05
- **sign-post-inn** — free-standing post with a hanging inn sign on a bracket · ground · sub · size:36x8x108 · wood · set:TAV!,MKT · var:shape · aff:- · mesh · P1 · at the yard gate; the sign board blank for the engine to paint; generated 2026-10-05
- **planter-barrel** — half barrel planted with flowers · ground · sub · size:26x26x30~0.7-1.3 · mixed · set:TAV,HUT,MKT · var:shape · aff:- · mesh · P1 · either side of an inn door; generated 2026-10-05
- **flowerbox-window** — window box of flowers on brackets · wall · sub · mount:30 · size:42x9x12 · mixed · set:TAV,HUT,NOB,MKT · var:shape · aff:- · mesh · P2 · under a window on the wall facing the yard; generated 2026-10-05
- **trellis-vine** — wall trellis with a climbing plant · wall · 1 · size:48x8x84~0.7-1.3 · organic · set:TAV,HUT,NOB · var:- · aff:climb · thin · P3 · on the building wall facing the yard; lattice is thin, test first; generated 2026-10-05
- **clothesline** — washing line between two posts with linen · ground · 1x2 · size:120x12x72 · mixed · set:TAV,HUT,MKT · var:- · aff:los · thin · P3 · kitchen garden, wash day; thin rope, test first; generated 2026-10-05
- **garden-tools-leaning** — spade, rake and hoe leaning together · wall · sub · size:24x10x60 · mixed · set:TAV,HUT,NOB,MIN · var:- · aff:- · mesh · P2 · one chunky mesh instead of three thin ones; against the wall by the kitchen door; generated 2026-10-05
- **compost-heap** — slatted compost bin with kitchen scraps · ground · 1 · size:48x48x30 · organic · set:TAV,HUT · var:- · aff:- · mesh · P3 · the far corner of a kitchen garden; generated 2026-10-05
- **dog-kennel** — small plank kennel · ground · sub · size:30x40x30 · wood · set:TAV,HUT,NOB · var:- · aff:hide · mesh · P3 · by the gate; no dog; generated 2026-10-05
- **fence-post-corner** — stout fence corner / end post · kit · edge · size:8x8x48 · wood · set:TAV,HUT,MKT · var:ruin · aff:cover · kit · P2 · closes fence runs at corners and gates; generated 2026-10-05
- **hedge-gap-arch** — hedge section with a walk-through arch · kit · edge · size:60x30x84 · organic · set:NOB,HUT,TAV · var:- · aff:pass · kit · P3 · the gate in a hedged yard; generated 2026-10-05
- **wall-drystone-gate** — dry-stone wall section with a gap and stone piers · kit · edge · size:60x24x42 · stone · set:HUT,MKT,TAV · var:ruin · aff:pass,cover · kit · P3 · the gate in a walled yard; generated 2026-10-05
- **hedge-end-block** — square end / corner block of clipped hedge · kit · edge · size:30x30x46 · organic · set:NOB,HUT,TAV · var:- · aff:block,los · kit · P2 · ends a hedge run and stands at its corners, a little taller than the hedge
- **wall-drystone-pier** — square dry-stone corner pier with a cap stone · kit · edge · size:28x28x42 · stone · set:HUT,MKT,TAV · var:ruin · aff:cover · kit · P2 · ends a dry-stone wall run and stands at its corners
- **woodpile-long** — long low stack of split firewood · ground · 1x2 · size:96x20x40 · wood · set:HUT,TAV,CMP · var:- · aff:cover · mesh · P2 · runs along an outside wall in place of two short stacks side by side

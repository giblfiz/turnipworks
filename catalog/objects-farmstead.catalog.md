# Farmstead objects — roles the Farmstead type (HUT) still wants (2026-10-11)

The Farmstead type shipped from the library as it stood (no mesh was generated: the image allowance was spent). These are the roles its rooms ask for that had no catalog line yet; the roles that had a line and no mesh (butter churn, cradle, spinning wheel, haystack, pigsty, nest box, milk churn, beehive skep, the crop-field tile…) keep their lines where they are. Build order and prompts: `experiments/2026-10-11-types/hut/assets.json`; `docs/ASSETS_TO_BUILD.md` → Farmstead. Thatch, hay, straw and fleece are asked for as "smooth, painted as one flat solid surface"; poles and rails are drawn stout.

## H Trades & work — farm

- **pot-hook-tripod** — iron tripod with a hanging pot hook, to stand over a central hearth · floor · sub · size:30x30x54 · metal · set:HUT,CMP · var:- · aff:use · thin · P2 · over the cottage's open hearth; legs drawn stout
- **bread-trough-kneading** — wooden kneading trough on legs, lid leaning · floor · sub · size:40x18x30 · wood · set:HUT,TAV · var:- · aff:use · mesh · P3 · farm kitchens
- **truckle-bed** — low child's bed on small wheels, a straw mattress · floor · 1 · size:28x54x14 · wood · set:HUT · var:- · aff:sleep · mesh · P3 · rolled under the big bed
- **loft-ladder-head** — top of a ladder standing through a square hole framed in the floor · floor · 1 · size:36x36x40 · wood · set:HUT,TAV · var:- · aff:pass,climb · mesh · P2 · lofts: how you came up
- **apple-rack-slatted** — low slatted rack of apples laid out to keep · floor · 1 · size:48x24x36 · wood · set:HUT · var:- · aff:loot · mesh · P3 · lofts and cellars in autumn
- **root-sand-box** — long wooden box of sand with carrots and beets bedded in it · floor · 1 · size:48x20x16 · mixed · set:HUT · var:- · aff:loot · mesh · P2 · root cellars: the signature piece
- **cellar-steps-earth** — short flight of steep plank steps down, earth cut either side · floor · 1 · size:36x60x48 · wood · set:HUT,MIN · var:- · aff:pass · mesh · P3 · root cellar entrance
- **dung-fork** — four-tined dung fork leaning · floor · tiny · size:50x9x3 · mixed · set:HUT · var:- · aff:carry · thin · P3 · byres; draw the tines stout
- **chicken-perch-ladder** — sloping roost: a ladder-like frame of stout round perches · floor · 1 · size:48x30x40 · wood · set:HUT! · var:- · aff:- · mesh · P1 · coop signature; perches as thick as a wrist
- **egg-basket** — shallow basket of eggs on straw · surface · tiny · size:12x12x8 · organic · set:HUT,MKT · var:- · aff:loot,carry · mesh · P2 · coops, kitchens, market stalls
- **staddle-stones** — mushroom-shaped stone that keeps a granary off the ground · ground · sub · size:20x20x28 · stone · set:HUT · var:pile · aff:- · mesh · P3 · under and beside granaries
- **bean-poles-wigwam** — wigwam of stout bean poles with climbing beans · ground · sub · size:36x36x84 · organic · set:HUT · var:- · aff:hide · mesh · P2 · vegetable gardens: height among the beds
- **cold-frame** — low glazed garden frame, lid propped · ground · 1 · size:48x30x18 · mixed · set:HUT,NOB · var:open · aff:- · mesh · P3 · kitchen gardens
- **scarecrow-post** — bare scarecrow cross-post with a turnip head and a sack coat (the dressed scarecrow that walks is a figure) · ground · sub · size:40x12x72 · mixed · set:HUT! · var:- · aff:- · mesh · P1 · fields and gardens; post as thick as a fence post
- **windfall-apples-scatter** — scatter of fallen apples in the grass · ground · 1 · size:48x36x0 · food · set:HUT · var:- · aff:- · flat · P2 · under orchard trees
- **mounting-stone** — worn stone step block by a door · ground · sub · size:24x18x16 · stone · set:HUT,TAV · var:- · aff:climb · mesh · P3 · farmyards

Kit note (not a role line): the wattle-and-daub wall family is `half-timber` today. A humbler `wattle-daub` family (no beams, cracked limewash, the wattle showing at the foot) is wanted: `wall-straight`, `wall-window-small`, `wall-doorway`.

## Built in the hut-01 batch (2026-10-12)

- **nest-box-row** — row of three open-fronted straw-lined nest boxes on short legs, eggs showing · floor · 1 · size:54x20x34 · wood · set:HUT! · var:- · aff:loot · mesh · P1 · the coop's signature: along its walls
- **floor-field-furrows** — ploughed earth in straight furrows, ridge and trough · ground · 1 · size:60x60x1 · organic · set:HUT! · var:- · aff:- · flat · P1 · the field's ground; the furrows run on from tile to tile

# Vertical kit — stairs, overhangs and roof furniture (2026-10-05)

The pieces the storeys and roofs work will need (`docs/VERTICAL.md`): vertical connectors (stairs, ladders, a roof hatch, a skylight), what carries an overhanging upper floor (jetty bracket, corbel), and the sparse furniture of a roof (Harry, 2026-10-05: "A roof is basically a kind of room! We need those windows that pop out, and chimneys, and ledges. They will be sparse."). Nothing here is built into the engine yet: this file only catalogs the roles that had no line. Specs are in `experiments/2026-10-05-castle-crypt-mansion/vertical/` (`build_spec.py` → `assets.json`, `kit.json` for the storeys/roof builder, `flats.json` for the roof surfaces).

Roles this kit uses that ALREADY had a line (in `fantasy-core.catalog.md`) and so are not repeated here: `stair-straight`, `stair-landing`, `stair-grand`, `stair-wall-hugging`, `stair-exterior-wood`, `ladder-wood`, `post-timber`, `buttress`, `roof-dormer`, `chimney-stack`, `wall-crenellated`, `floor-trapdoor`. Their sizes in the core file predate the 10-ft storey (stairs there are 108 in tall with a 110 in run); the kit's meshes are specified at 120 in of rise. `kit.json` lists the core lines that want their size corrected.

Conventions: a storey is 120 in floor to floor (108 in wall + 12 in slab); a stair's top tread is level with the upper floor. Every stair cell rises exactly 60 in, one step of the world's 5-ft height lattice: a full flight is 2 cells, a half flight 1 cell. All new roles are P2/P3 because no room recipe asks for them: the building generator places them, not the room solver.

## A9. Vertical connectors (vertical kit, 2026-10-05)

- **stair-half** — short half flight of five steps rising 5 ft · kit · 1 · size:48x60x60 · mixed · set:ANY · var:- · aff:pass,climb · kit · P2 · up to a dais, a stage or a half level; two of them and a landing make a dog-leg
- **stair-quarter-turn** — L-shaped stair: five steps, a square landing, five more steps at a right angle · kit · 2x2 · size:120x120x120 · mixed · set:ANY · var:- · aff:pass · kit · P2 · one storey in a corner; fills three cells of a 2x2 block, the fourth stays free
- **railing-iron** — straight section of low wrought-iron railing: two end posts, top and bottom rail, plain upright bars · kit · edge · size:60x5x34 · metal · set:CAS,CRY,TEM,DUN · var:- · aff:cover · thin · P2 · round the hole a stair cuts in a stone building's floor (2026-10-06); also a gallery or wall-walk edge
- **stair-spiral-wide** — spiral stair of one full turn round a central newel, 9 ft across · kit · 2x2 · size:108x108x120 · mixed · set:CAS!,ARC,TEM,NOB · var:- · aff:pass · kit · P2 · towers; one full turn per storey so copies stack and every floor enters on the same side
- **roof-hatch** — plank hatch in a raised curb on a roof or loft floor · kit · 1 · size:48x48x10 · wood · set:TAV,CAS,NOB,MKT,HUT · var:open · aff:pass,open · kit · P2 · the way onto a roof; sits over the head of a ladder
- **roof-hatch-open** — roof hatch with its lid stood open · kit · 1 · open_of:roof-hatch · size:48x52x50 · wood · set:TAV,CAS,NOB,MKT,HUT · var:- · aff:pass,open · kit · P2 · open state of roof-hatch
- **roof-skylight** — low glazed roof lantern in a lead frame · kit · 1 · size:48x48x16 · mixed · set:NOB,ARC,MKT,TEM · var:- · aff:pass,hazard · kit · P2 · lights the room below; a thief's way in

## A10. Overhang supports (vertical kit, 2026-10-05)

- **jetty-bracket** — curved timber bracket under a jettied upper floor · wall · sub · mount:72 · size:10x30x36 · wood · set:MKT,TAV,HUT · var:shape · aff:- · mesh · P2 · one under each joist end where an upper storey oversails the lower by 2.5 ft
- **corbel-stone** — stone corbel projecting from a wall · wall · sub · mount:90 · size:12x18x18 · stone · set:CAS,NOB,TEM,DUN · var:shape · aff:- · mesh · P2 · carries a stone balcony, a wall-walk, a beam end or an oversailing parapet

## A11. Roof furniture (vertical kit, 2026-10-05)

- **parapet-straight** — low stone roof parapet with a coping, 5-ft section · kit · edge · size:60x12x36 · stone · set:NOB,CAS,TEM,MKT · var:- · aff:cover · kit · P2 · the ledge round a flat or low roof; half cover in a rooftop chase
- **parapet-corner** — square parapet corner pier with a cap · kit · edge · size:16x16x44 · stone · set:NOB,CAS,TEM,MKT · var:- · aff:cover · kit · P2 · stands at the corners and ends of a parapet run
- **wall-crenellated-corner** — corner merlon block of a battlement · kit · edge · size:28x28x66 · stone · set:CAS! · var:- · aff:cover,los · kit · P2 · stands at the corners of a wall-crenellated run
- **roof-ridge** — 5-ft section of roof ridge capping · kit · edge · size:60x16x10 · mixed · set:HUT,TAV,MKT,NOB,CAS · var:- · aff:- · kit · P3 · laid along the ridge line and sunk into both roof planes; one per roof material
- **roof-finial** — ornament on a gable peak or tower cap · attach · sub · size:10x10x26 · mixed · set:NOB,CAS,TEM,ARC,MKT · var:shape · aff:- · mesh · P3 · ends a ridge; tops a conical roof
- **weathervane** — chunky banner weathervane on a post · attach · sub · size:30x8x48 · metal · set:MKT,NOB,TEM,HUT,TAV · var:- · aff:- · mesh · P3 · one per building at most, on the highest ridge end
- **gargoyle-spout** — carved stone waterspout projecting from a parapet · wall · sub · mount:96 · size:14x36x18 · stone · set:CAS,TEM,NOB,CLT · var:shape · aff:- · mesh · P3 · at parapet corners and gutter ends; one every 15 to 20 ft at most
- **nest-bird** — small twig nest with eggs · attach · tiny · size:14x14x7 · organic · set:ANY · var:- · aff:loot · mesh · P3 · life on a roof: beside a chimney or in a dormer valley

## A12. Roof surfaces (flat textures, vertical kit, 2026-10-05)

Seamless 5-ft squares for the free ground-texture route. Courses run along the image's X axis and the eaves are at the bottom of the image, so a roof plane can turn the texture to its own slope. They replace the mesh roof segments (`roof-thatch`, `roof-tile-slate`, `roof-shingle-wood` in the core file) once roofs are planes made by code.

- **roofing-thatch** — combed straw thatch, seen flat · kit · 1 · size:60x60x1 · organic · set:HUT!,TAV,MKT · var:- · aff:- · flat · P2 · cottage and poor-inn roofs
- **roofing-tile-clay** — plain terracotta roof tiles in courses, seen flat · kit · 1 · size:60x60x1 · ceramic · set:TAV,MKT,NOB,TEM · var:- · aff:- · flat · P2 · town roofs and better inns
- **roofing-slate** — grey slate shingles in courses, seen flat · kit · 1 · size:60x60x1 · stone · set:NOB,CAS,TEM,MKT · var:- · aff:- · flat · P2 · mansion, church and castle-turret roofs
- **roofing-shingle-wood** — split wooden shingles in courses, seen flat · kit · 1 · size:60x60x1 · wood · set:HUT,TAV,MKT,CMP · var:- · aff:- · flat · P2 · middle-wealth and woodland roofs

#!/usr/bin/env python3
"""Vertical kit (2026-10-05): stairs, ladders, overhang supports and roof furniture for the storeys / roofs work
(docs/VERTICAL.md). SPEC ONLY: nothing is generated here. Writes assets.json (the yard's format, for
src/plate_gate_batch.py) and kit.json (what each piece is FOR, for whoever builds storeys and roofs).
    python3 build_spec.py

Dimensions every piece is drawn to: a storey is 120 in floor to floor (108 in wall + 12 in slab), a cell is 60 in.
Every stair cell rises exactly 60 in (one step of the 5-ft height lattice): a full flight = 2 cells at 45 degrees,
a half flight = 1 cell. The grand stair is the one exception (3 cells of run, 8-in risers).
Groups: p1/p2/p3 = independent pieces by prio; sib1/sib2 = painted FROM the accepted plate of `parent`
(inputs/<parent>.jpg) so that pieces that are used together are the same stone or the same timber.
"""
import json, sys
from pathlib import Path
from collections import Counter
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct
STYLE = (ROOT / "style/heroic-handpainted.object.md").read_text()
STYLE_REF = str(ROOT / "style-references/heroic-handpainted-tavern-v1.png")
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")):
    roles.update(ct.parse_catalog(p)[0])

NOBASE = (" It stands on nothing: NO ground disc, NO floor slab, NO patch of roof, NO wall behind it, NO base slab or platform under it."
          " The background is flat chroma blue, so the object itself has NO blue anywhere (stone is warm grey or grey-green, glass is dark grey-green).")
BUTT = (" This is ONE straight 5-ft section of a longer run: both side ends are clean, flat, vertical cuts with nothing sticking out past them,"
        " and the profile is the same from end to end, so that copies placed end to end make one continuous run. Seen from its broad side, three-quarter view from slightly above.")
MATCH = ("The supplied image is an existing piece of the same {what}. The new piece must look built from the same {what}:"
         " the SAME materials, colours, thicknesses, step size, painting style and camera angle. Change ONLY what is described below.\n\n")
STONE = ("Coursed warm-grey and grey-green ashlar blocks with a few ochre and cream stones mixed in, soft mortar joints, lighter worn edges on the treads"
         " and a little moss in a few joints: clearly painted stonework on EVERY face, no blank unpainted areas.")
TIMBER = ("Warm honey-brown oak: thick planks with broad painted grain, darker end grain, chunky wooden pegs at the joints, paler worn patches in the middle of each tread.")
STAIRVIEW = (" View it from the side and slightly above, so that every step shows as a clear tread and riser and the full height is visible.")
SINK = (" The lowest part is a plain, straight continuation of the same shape with a flat cut bottom, because in the game it is sunk into a sloping roof.")
GLASS = "Window panes are dark warm grey-green with thick cream glazing bars (never blue, never see-through)."

assets, kit = [], []
def add(sku, obj, group, prio, subject, design, desc, must=(), must_not=(), size=None, parent=None, what="", base=True, extra_prompt="",
        use="", fp=None, connector=None, anchor=None, **more):
    role = roles[obj]
    w, d, h = size or role["size"]
    detail = (f"{design} Real-world size about {w:g} in wide x {d:g} in deep x {h:g} in tall: keep these proportions exactly."
              + extra_prompt + (NOBASE if base else " The background is flat chroma blue, so the object itself has NO blue anywhere.")
              + " Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.")
    prompt = STYLE.format(subject=subject, detail=detail)
    refs, gate_refs = [STYLE_REF], []
    must = list(must)
    if parent:
        pp = str(HERE / "inputs" / f"{parent}.jpg")
        prompt = prompt.replace("Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset:",
                                MATCH.format(what=what) + "Create a single asset in the Turnip Works house style (heroic hand-painted):")
        assert "The supplied image is an existing piece" in prompt, sku
        refs, gate_refs = [pp], [pp]
        must.append(f"materials and colours match the REFERENCE piece of the {what} (the described change is the intended difference)")
    a = {"id": sku, "object": obj, "group": group, "source": "generate", "lane": "3d", "subject": subject, "size": [w, d, h],
         "prompt": prompt, "refs": refs, "gate_refs": gate_refs,
         "gate": {"desc": desc, "must": must, "must_not": list(must_not) + (["a ground disc, floor slab, patch of roof or base platform under the object"] if base else [])},
         "prio": prio, "rooms": [], "bench": more.pop("bench", []), "route": more.pop("route", "trellis")}
    if parent: a["parent"] = parent
    a.update(more)                      # hung, light, twin_of, supersedes, fit ...
    assets.append(a)
    kit.append({"sku": sku, "object": obj, "size_in": [w, d, h], "cells": fp or role["fp"], "prio": prio,
                **({"connector": connector} if connector else {}), **({"anchor": anchor} if anchor else {}),
                **({k: a[k] for k in ("hung", "twin_of", "supersedes", "fit") if k in a}), "use": use})

# ------------------------------------------------------------------------------------------------ stairs
STAIR_NOT = ["a ramp with no steps", "a second flight or a landing that was not asked for", "people or creatures"]
S_UP = "a 1x2 opening in the upper floor above the flight (headroom); the cell beyond the top step must be floor"
add("stair-straight--dressed-stone--t10", "stair-straight", "p1", 1, "a straight stone staircase of ten steps",
    "ONE straight flight of exactly TEN deep stone steps climbing in one direction, as tall as it is long: a steep 45-degree flight, every step 12 in high and 12 in deep, 4 ft wide."
    " The underside is SOLID: the whole wedge under the steps is filled with masonry down to the ground, with flat vertical side faces and a flat vertical back face under the top step."
    " Each side face has one shallow blind round-arched recess carved into it (not a hole through). No handrail, no banister, no posts. " + STONE,
    "a straight flight of about ten stone steps, solid masonry underneath, no railing",
    ["one straight flight of steps, clearly stone", "solid underneath: no gap under the steps", "about as tall as it is long"],
    STAIR_NOT + ["a handrail or balustrade", "an open underside you can see through"], size=(48, 120, 120), extra_prompt=STAIRVIEW,
    use="The default storey stair in stone buildings (castle, crypt, dressed-stone inn). Rises one full storey (120 in) over 2 cells; 45 degrees, 12-in treads and risers. No rail: put it against a wall, or let the engine add railings.",
    fp="1x2", connector="stair", anchor="low end on the -D edge of cell 1 at floor level; top tread at the +D edge of cell 2, level with the upper floor (z=120). Needs " + S_UP,
    supersedes="stair-straight--dressed-stone (inn-01: measures 61 w x 110 run x 84 rise, so it climbs 7 ft, not 10)", fit="box")
add("stair-straight--rough-timber--t10", "stair-straight", "p1", 1, "a straight wooden staircase of ten steps",
    "ONE straight flight of exactly TEN thick plank steps climbing in one direction, as tall as it is long: a steep 45-degree flight, every step 12 in high and 12 in deep, 4 ft wide,"
    " held between two heavy sloping side beams (stringers). Closed risers. The underside is SOLID: the triangle under the stair is boarded in on both sides and at the back with upright planks,"
    " like an under-stair cupboard with no door, so nothing is see-through. A short, fat, square newel post with a rounded cap stands at the foot on each side (waist high). No handrail and no spindles. " + TIMBER,
    "a straight flight of about ten wooden steps, boarded in underneath, no railing",
    ["one straight flight of steps, clearly timber", "boarded in or solid underneath", "about as tall as it is long"],
    STAIR_NOT + ["a handrail with thin spindles", "an open underside you can see through", "a carpet or runner"], size=(48, 120, 120), extra_prompt=STAIRVIEW,
    use="The default storey stair in timber buildings (inn, cottage, log cabin). Same geometry as the stone one, so the generator can swap them by wall family.",
    fp="1x2", connector="stair", anchor="as stair-straight--dressed-stone--t10",
    supersedes="stair-straight--rough-timber (inn-01: measures 110 x 77 x 94 high, wrong pitch and too wide for a cell)", fit="box")
for fam, mat, sub, under in (("dressed-stone", STONE, "stone", "The underside is SOLID masonry down to the ground, flat vertical sides and back."),
                             ("rough-timber", TIMBER, "wooden", "The underside is SOLID: boarded in on both sides and the back with upright planks.")):
    par, what = f"stair-straight--{fam}--t10", f"{sub} staircase"
    add(f"stair-half--{fam}", "stair-half", "sib1", 1, f"a short {sub} flight of five steps",
        f"A SHORT flight: exactly FIVE steps climbing in one direction to a height of 5 ft, as tall as it is long (the lower half of the staircase in the reference, cut off square after the fifth step),"
        f" every step 12 in high and 12 in deep, 4 ft wide. {under} The back face under the top step is a flat vertical wall. No handrail, no posts at the top. {mat}",
        f"a short flight of about five {sub} steps, solid underneath, about as tall as it is long",
        ["a single short flight of four to six steps", "solid underneath"], STAIR_NOT + ["a full-height staircase of ten or more steps", "a handrail"],
        size=(48, 60, 60), parent=par, what=what, extra_prompt=STAIRVIEW,
        use="Rises 5 ft in one cell: up to a dais, stage or half level (docs/VERTICAL.md: 5-ft half-steps). Half flight + landing + half flight = a dog-leg built from parts.",
        fp="1", connector="stair", anchor="low end at the -D edge of its cell, top tread at the +D edge at z=60", fit="box")
    add(f"stair-landing--{fam}--t10", "stair-landing", "sib1", 1, f"a square {sub} stair landing platform five feet high",
        (f"A square landing platform, a cube 5 ft wide, 5 ft deep and 5 ft high with a flat top to stand on and NO steps. "
         + ("It is a SOLID block of masonry with a top of four big flagstones and a shallow blind round-arched recess carved into each of the four side faces. " if sub == "stone" else
            "A deck of thick planks on a heavy square frame, carried on FOUR stout square corner posts with a fat curved knee brace at the top of each post. The underside is OPEN between the posts (the posts are thick, 8 in square). ")
         + f"No handrail. {mat}"),
        f"a square {sub} platform about as tall as it is wide, with a flat top and no steps",
        ["a flat-topped square platform", "about as tall as it is wide"], ["steps on the platform", "a handrail or balustrade", "people or creatures"],
        size=(60, 60, 60), parent=par, what=what,
        use="A 5-ft-high landing cell, level with the top of a half flight. Turns a stair (dog-leg, U-turn) or extends a mezzanine. The timber one is open underneath (storage, a hiding place); the stone one is solid.",
        fp="1", connector="stair", anchor="fills its cell; top surface at z=60",
        supersedes=f"stair-landing--{fam} (inn-01: only about 35 in high, so it meets no half flight)", fit="box")
    add(f"stair-quarter-turn--{fam}", "stair-quarter-turn", "sib2", 2, f"an L-shaped {sub} staircase with a landing",
        f"An L-SHAPED staircase that turns a corner: FIVE steps climb to a square landing 5 ft above the ground, then the stair turns 90 degrees to the RIGHT and FIVE more steps climb from the landing to the top, 10 ft above the ground."
        f" Every step 12 in high and 12 in deep; flights and landing are each 5 ft wide. Seen from above the stair is an L filling three quarters of a 10-ft square; the inside corner of the L is empty air."
        + (" Everything under the steps and the landing is SOLID masonry down to the ground." if sub == "stone" else " Everything under the steps and the landing is SOLID: boarded in with upright planks down to the ground, with a stout square post at each corner of the landing.")
        + f" No handrail. {mat}",
        f"an L-shaped {sub} staircase: a lower flight, a square landing, and an upper flight at a right angle",
        ["two flights of steps at a right angle joined by a landing", "solid underneath"], ["a straight staircase with no turn", "a spiral staircase", "a handrail with thin spindles", "people or creatures"],
        size=(120, 120, 120), parent=par, what=what, extra_prompt=" View it from above and to one side so both flights and the landing show.",
        use="One storey in a room corner, as ONE mesh. Right-hand turn; mirror it for a left-hand turn. Occupies three cells of a 2x2 block: lower flight in cell (0,0) climbing +D, landing in (0,1) at z=60, upper flight in (1,1) climbing +W, arriving at the +W edge at z=120.",
        fp="2x2", connector="stair", anchor="upper floor needs an opening over the landing cell and the upper-flight cell", fit="box")
add("stair-wall-hugging--dressed-stone", "stair-wall-hugging", "sib2", 2, "a castle stone stair built against a wall",
    "The same straight flight of exactly TEN stone steps, but a castle stair built against a wall: the steps are big single slabs with rounded, heavily worn front edges,"
    " one long side is a perfectly flat vertical face (it stands against the castle wall), the other long side drops sheer with no rail or kerb."
    " The underside is SOLID masonry with ONE deep round-arched niche in the open side (a dark recess, not a hole through). Darker, rougher, older stone than a house stair, with moss low down.",
    "a straight flight of about ten worn stone steps with solid masonry underneath and an arched niche in its side, no railing",
    ["one straight flight of stone steps", "solid underneath apart from a recess"], STAIR_NOT + ["a handrail or balustrade"],
    size=(48, 120, 120), parent="stair-straight--dressed-stone--t10", what="stone staircase", extra_prompt=STAIRVIEW,
    use="Castle and dungeon version of the straight flight: runs along a wall with a sheer open side (a fall hazard, catalog aff:hazard). Flat side goes to the wall; mirror for the other hand.",
    fp="1x2", connector="stair", anchor="as stair-straight--dressed-stone--t10", fit="box")
SPIRAL_NOT = ["a straight staircase", "a wall or shaft enclosing the stair", "thin spindles or a wire rail", "people or creatures"]
add("stair-spiral-wide--dressed-stone", "stair-spiral-wide", "p1", 1, "a stone spiral staircase winding once round a central column",
    "A free-standing spiral stair with NO tower wall round it: a thick round central stone column (newel) 14 in across and 10 ft tall, with SIXTEEN wedge-shaped stone steps winding ONE full turn"
    " anticlockwise round it as they climb, so the top step ends directly above the bottom step. Each step is a thick solid wedge slab, narrow at the column and 4 ft long, about 7 in higher than the one before."
    " The underside is SOLID: each step rests on the one below, making one continuous stepped helix of masonry with a smooth spiral underside; no gaps between steps. No handrail. The whole thing is 9 ft across and 10 ft tall. " + STONE,
    "a spiral staircase of wedge-shaped stone steps winding round a central stone column, with no wall around it",
    ["steps winding around a central column", "clearly stone"], SPIRAL_NOT, size=(108, 108, 120), extra_prompt=" View it from the side and slightly above so the winding steps and the column both show.",
    use="Tower stair: fills a 2x2 block (9 ft across, a 6-in margin for the tower wall). ONE full turn per storey, so the foot and the head are on the same bearing: copies stack floor on floor and every floor enters on the same side.",
    fp="2x2", connector="stair", anchor="centre of the 2x2 block; bottom step and top step both on the -D side; the upper floor is cut away over the whole 2x2 except the arrival cell edge", fit="box")
add("stair-spiral-wide--rough-timber", "stair-spiral-wide", "p1", 1, "a wooden spiral staircase winding once round a central post",
    "A free-standing spiral stair with NO wall round it: a thick round central timber post 12 in across and 10 ft tall with a turned ball cap, and SIXTEEN wedge-shaped plank steps winding ONE full turn"
    " anticlockwise round it as they climb, so the top step ends directly above the bottom step. Each tread is a 3-in-thick wedge plank, narrow at the post and 4 ft long, with a CLOSED riser board below it;"
    " the outer ends of the steps are held by one broad, thick, curved board (an outer stringer) that spirals up with them. The underside is boarded, with no gaps between steps. No spindles, no thin rail. The whole thing is 9 ft across and 10 ft tall. " + TIMBER,
    "a spiral staircase of wedge-shaped wooden steps winding round a central wooden post, with no wall around it",
    ["steps winding around a central post", "clearly timber"], SPIRAL_NOT, size=(108, 108, 120), extra_prompt=" View it from the side and slightly above so the winding steps and the post both show.",
    use="Timber tower / mill / wizard's-loft stair. Same geometry and stacking rule as the stone spiral.",
    fp="2x2", connector="stair", anchor="as stair-spiral-wide--dressed-stone", fit="box")
add("stair-grand--noble-interior", "stair-grand", "p2", 2, "a grand mansion staircase with balustrades and a carpet runner",
    "A WIDE, stately straight staircase for a mansion hall: exactly FIFTEEN broad shallow steps (8 in high, 12 in deep) climbing in one direction, 10 ft wide, 15 ft long and 10 ft tall, so it is longer than it is tall."
    " Dark polished walnut with cream marble treads. A burgundy carpet runner with a thick gold border runs up the middle third of every step. The bottom three steps flare out wider with rounded ends."
    " On each side a heavy balustrade: a thick moulded handrail on a row of FAT turned vase-shaped balusters set close together (each baluster thicker than the gap beside it), ending at the foot in a massive square carved newel post with a ball cap."
    " The underside is SOLID: both sides below the steps are closed with carved walnut panelling down to the ground, and the back under the top step is a flat panelled wall.",
    "a wide grand staircase with a red carpet runner and heavy balustrades on both sides",
    ["a wide straight staircase with many steps", "a red or burgundy carpet runner up the middle", "a balustrade or solid rail on each side"],
    ["thin wire-like spindles", "a curved or spiral staircase", "an open underside you can see through", "people or creatures"], size=(120, 180, 120), extra_prompt=STAIRVIEW,
    use="The mansion foyer's focal piece: 2 cells wide, 3 cells of run (the one stair at a natural 34-degree pitch, because it is looked at, not squeezed in). Arrives at a gallery or upper landing.",
    fp="2x3", connector="stair", anchor="low end at the -D edge of a 2x3 block, top tread at the +D edge at z=120; upper floor open over the upper two rows (2x2)", fit="box")
LADDER_NOT = ["one rung much thicker or bigger than the others", "thin stick-like rails or rungs", "a rope ladder", "people or creatures"]
add("ladder-wood--leaning", "ladder-wood", "p1", 1, "a chunky wooden ladder leaning at a steep angle",
    "A sturdy wooden ladder shown LEANING as if against a wall, tilted about 15 degrees from upright: two thick round side poles (4 in thick) and exactly NINE fat round rungs (3 in thick), all rungs the SAME thickness and evenly spaced,"
    " each rung pegged through the poles with its ends showing. The feet of the poles are cut flat on the ground and the tops are rounded. About 2 ft wide. Nothing else: no wall, no rope. " + TIMBER,
    "a wooden ladder with two side rails and evenly spaced rungs, leaning at a steep angle",
    ["two side rails joined by several rungs", "the rungs are all about the same thickness"], LADDER_NOT, size=(24, 34, 126), base=True,
    use="Loft, hayloft and roof-hatch ladder: stands in one cell, head resting on the edge of the opening above (a floor-trapdoor or roof-hatch in the same cell). Its top passes 6 in above the upper floor so it shows at the upper cut height.",
    fp="sub", connector="ladder", anchor="foot 34 in out from the wall or opening edge, head at z=120 on that edge",
    supersedes="ladder-wood (inn-01: plate rated 1 star, 'what's with the jumbo rung?')")
add("ladder-wood--upright", "ladder-wood", "sib2", 2, "a chunky wooden ladder fixed upright to a wall",
    "The same ladder, but standing perfectly UPRIGHT and fixed flat to a wall: two thick straight side poles and exactly NINE fat rungs of equal thickness, with four chunky wooden stand-off blocks on the back"
    " (two near the top, two near the bottom) that hold it 5 in off the wall. Exactly vertical, 10 ft tall, 2 ft wide. No wall shown.",
    "a wooden ladder with two side rails and evenly spaced rungs, standing vertically",
    ["two side rails joined by several rungs", "the rungs are all about the same thickness", "stands upright, not leaning"], LADDER_NOT,
    size=(24, 9, 120), parent="ladder-wood--leaning", what="wooden ladder",
    use="Wall-fixed ladder for shafts, towers, wells and wall-walk access; takes no floor cell (wall edge). Stack copies for taller climbs.",
    fp="edge", connector="ladder", anchor="flat against a wall face, foot at floor level, head at z=120", hung=True)

# ------------------------------------------------------------------------------------------------ overhang supports
add("post-timber--plain", "post-timber", "p2", 2, "a plain square timber support post",
    "ONE plain load-bearing oak post, 12 in square and 9 ft tall, perfectly upright: chamfered corners that stop short of the ends, a slightly wider square head block (a bolster) at the very top with two big pegs, the bottom cut flat."
    " NO braces, NO cross beam, NO arms: a single straight post. " + TIMBER,
    "a single tall square wooden post with no braces",
    ["one upright square timber post, much taller than wide"], ["diagonal braces, arms or a cross beam", "a stone pad or base under it"], size=(12, 12, 108),
    use="Carries the outer corner of a jetty, a porch roof or a gallery edge: one storey of wall height (108 in), so the slab or bracket sits on its head. The existing post-timber mesh has arms (it measures 67 in wide); this is the straight one.",
    fp="sub", anchor="on a cell corner or edge midpoint, top at z=108")
BR_NOT = ["a metal shelf bracket", "a whole beam or post attached", "thin parts"]
add("jetty-bracket--s1", "jetty-bracket", "p2", 2, "a curved timber bracket for under an overhanging upper floor",
    "ONE thick oak jetty bracket, seen from the side: a short upright stub (the part that sits against the wall post, 3 ft tall), a short horizontal stub along its top (the part under the overhanging floor, 2.5 ft long),"
    " and a fat CURVED brace sweeping in a quarter arc between the bottom of the upright and the outer end of the horizontal, leaving one small rounded triangular opening. All three members are 10 in thick and pegged together with big pegs. " + TIMBER,
    "a thick curved wooden bracket shaped like a quarter arc inside a right angle",
    ["a curved brace between an upright part and a horizontal part", "thick timber"], BR_NOT, size=(10, 30, 36),
    use="Under a jettied upper storey: the upper floor oversails the lower wall by 30 in (half a cell). One bracket under each joist end, i.e. at every cell boundary along the jettied side (every 5 ft) and at the corners.",
    fp="sub", anchor="back face on the outside of the lower wall, top face at z=108 (under the slab), projecting 30 in outward", hung=True)
add("jetty-bracket--s2", "jetty-bracket", "p3", 3, "a carved solid timber bracket for under an overhanging upper floor",
    "ONE solid carved oak console bracket, seen from the side: a single thick block shaped like a right-angled triangle with a deeply scooped S-curve front edge, with NO opening through it,"
    " a carved scroll at the lower tip and a carved leaf on each side face. Flat back (against the wall) and flat top (under the floor). 10 in thick. " + TIMBER,
    "a solid carved wooden bracket with a curved front edge",
    ["one solid wooden bracket with a flat back and a flat top", "a curved or scrolled front"], BR_NOT, size=(10, 30, 36),
    use="Shape variant of the jetty bracket for richer town houses and inns; also under a timber balcony (balcony-wood).",
    fp="sub", anchor="as jetty-bracket--s1", hung=True)
add("buttress--s1", "buttress", "p2", 2, "a stepped stone wall buttress",
    "ONE stone buttress as it would stand against the outside of a wall: a tall pier that gets shallower in TWO steps as it rises, each step capped with a sloping stone weathering, and a small gabled stone cap at the top."
    " The back face is a perfectly flat vertical cut (it stands against the wall, which is not shown). Deep at the bottom (4 ft), shallow at the top (1.5 ft), 2.5 ft wide, 9 ft tall. A moulded plinth course round the foot. " + STONE,
    "a tall stone buttress that steps back as it rises, with sloping tops to the steps",
    ["a tall narrow stone pier, deeper at the bottom than the top", "painted stonework on every visible face"], ["a wall attached behind it", "a flying arch", "people or creatures"], size=(30, 48, 108),
    use="Exterior only: against the outside of stone walls of tall rooms (great hall, chapel, crypt above ground), on cell boundaries between windows, one per 10 ft. One storey high; stack two (the upper one scaled 0.8 in depth) for a 20-ft hall.",
    fp="1", anchor="flat back on the outside wall face, foot on the ground")
add("buttress--s2", "buttress", "p3", 3, "a plain raking stone buttress",
    "ONE plain stone buttress: a heavy pier whose front face leans back in a single straight slope from a deep foot to a shallow top, like a wedge of masonry leaning on a wall, finished with a flat sloping cap stone."
    " The back face is a perfectly flat vertical cut (the wall is not shown). 3 ft wide, 4 ft deep at the foot, 9 ft tall. Rougher, bigger blocks, with a band of darker stone a third of the way up. " + STONE,
    "a plain wedge-shaped stone buttress with a sloping front",
    ["a tall stone pier, deeper at the bottom than the top"], ["a wall attached behind it", "a flying arch", "people or creatures"], size=(36, 48, 108),
    use="Castle curtain walls, barns, old church walls, shored-up ruins. Same placement as buttress--s1.",
    fp="1", anchor="as buttress--s1")
add("corbel-stone--s1", "corbel-stone", "p2", 2, "a plain stepped stone corbel",
    "ONE stone corbel: a block projecting from a wall, built of THREE stacked courses each rounded underneath (quarter-round) and each sticking out further than the one below, with a flat top to carry a load."
    " The back is a flat vertical cut (the wall is not shown). 12 in wide, 18 in deep, 18 in tall. Warm-grey stone with lighter worn edges and a little soot staining underneath.",
    "a stone bracket made of three stepped rounded courses, with a flat top",
    ["a single stone bracket with a flat top and a flat back", "it steps or curves outward toward the top"], ["a statue or a face", "a section of wall attached"], size=(12, 18, 18),
    use="Under a stone balcony, a projecting parapet or wall-walk (machicolation look), a hall's roof-beam ends, an oriel. In rows at 30-in centres under a parapet, or pairs under a balcony.",
    fp="sub", anchor="flat back on a wall face, flat top at the underside of what it carries (default mount 90 in = top at z=108)", hung=True)
add("corbel-stone--s2", "corbel-stone", "p3", 3, "a carved stone corbel with a scroll and leaf",
    "ONE carved stone corbel: a single S-curved console block projecting from a wall, with a big scroll rolled at the top front and a smaller one at the bottom, a broad carved leaf down its front, and a flat moulded slab on top to carry a load."
    " The back is a flat vertical cut (the wall is not shown). 12 in wide, 18 in deep, 18 in tall. Cream and warm-grey stone.",
    "a carved stone bracket with scrolls and a leaf, with a flat top",
    ["a single stone bracket with a flat top and a flat back", "carved scroll or leaf decoration"], ["a statue or a face", "a section of wall attached"], size=(12, 18, 18),
    use="Mansion and temple version: under balcony-stone, mantel shelves, and the eaves cornice of a slate roof.",
    fp="sub", anchor="as corbel-stone--s1", hung=True)

# ------------------------------------------------------------------------------------------------ roof furniture
DORMER = (" It is a complete little house-shaped box that sticks out of a roof: a window front, two solid side walls (cheeks), and its own small roof that runs STRAIGHT BACK, level, for the full depth."
          " The bottom is one flat level cut and the back is one flat vertical cut, because in the game the back of the box is sunk into the sloping main roof. The main roof itself is NOT shown. " + GLASS)
D_MUST = ["a small roofed window structure with a window in its front", "its own little roof on top"]
D_NOT = ["a whole house or a whole roof", "a patch of the main roof around it", "blue window glass", "people or creatures"]
D_USE = " Sink it into the roof plane until the sill is 6 in above the slope; the roof builder clips nothing, the plane simply hides the back."
D_ANCH = "window front parallel to the eaves, centred on a cell, front face 1 to 2 ft up-slope of the wall line"
add("roof-dormer--tile", "roof-dormer", "p1", 1, "a gabled dormer window with a clay tile roof",
    "A gabled dormer window: a square timber-framed front with a two-light casement window and a small cream-plastered triangle (gable) above it with a carved bargeboard, cheeks hung with terracotta tiles,"
    " and a steep two-sided roof of chunky orange-red clay tiles in clear courses with a row of half-round ridge tiles." + DORMER,
    "a small gabled dormer window with a red clay tile roof",
    D_MUST + ["red or orange tiles on its roof"], D_NOT, size=(48, 60, 66),
    use="Dormer for clay-tile roofs (town house, better inn)." + D_USE, fp="1", anchor=D_ANCH,
    supersedes="roof-dormer--dressed-stone and --rough-timber for tiled roofs (the inn-01 pair stay as generic fallbacks)")
add("roof-dormer--thatch", "roof-dormer", "p2", 2, "a cottage dormer window under a thatched hood",
    "A cottage dormer window: a low, wide front of dark oak frame and cream plaster with a small two-light casement, and a very THICK thatch roof of golden-ochre straw that curves over the window like a hood or eyebrow,"
    " a foot thick at its rounded front edge, with a neat scalloped pattern cut along the edge. Soft, rounded, no sharp ridge." + DORMER,
    "a small cottage dormer window under a thick rounded thatched roof",
    D_MUST + ["a thick rounded straw thatch roof"], D_NOT + ["tiles or slates on its roof"], size=(54, 60, 54),
    use="Dormer for thatched roofs (cottage, poor inn): the 'eyebrow' that lifts the thatch over an attic window." + D_USE, fp="1", anchor=D_ANCH)
add("roof-dormer--slate", "roof-dormer", "p2", 2, "a tall mansion dormer window with a slate roof",
    "A tall, narrow, formal mansion dormer: a cream stone front with a tall sash window between two flat pilasters, a carved triangular pediment above it,"
    " lead-grey panelled cheeks, and a steep two-sided roof of charcoal and grey-green slates in neat courses with a lead-grey ridge roll. Taller than it is wide." + DORMER,
    "a tall narrow dormer window with a stone front, a pediment and a grey slate roof",
    D_MUST + ["grey slate or lead on its roof", "taller than it is wide"], D_NOT + ["red tiles or thatch"], size=(44, 60, 78),
    use="Dormer for slate roofs (mansion, town hall); in a regular row, one per bay, aligned over the windows below." + D_USE, fp="1", anchor=D_ANCH)
add("roof-dormer--shingle", "roof-dormer", "p3", 3, "a wide shed dormer with a wood shingle roof",
    "A low, wide shed dormer: a plank-framed front with TWO small square shuttered-open casement windows side by side, plank cheeks, and a single-slope (lean-to) roof of grey-brown split wooden shingles in clear ragged courses,"
    " sloping gently down toward the front and overhanging it a little. Wider than it is tall." + DORMER,
    "a low wide dormer with two small windows and a single-slope wooden shingle roof",
    D_MUST + ["wooden shingles on its roof", "wider than it is tall"], D_NOT + ["red tiles, slate or thatch"], size=(72, 60, 42),
    use="Dormer for wood-shingle roofs (lodge, mill, log house); lights a whole attic room." + D_USE, fp="1x2", anchor=D_ANCH)
CH_NOT = ["smoke, flame or glowing embers", "a fireplace or hearth at the bottom", "a patch of roof round it", "people or creatures"]
CH_USE = " A chimney is a vertical connector (docs/VERTICAL.md): place it straight above the fireplace on the wall below so the two line up through every storey; sink the plain lower shaft into the roof."
add("chimney-stack--brick", "chimney-stack", "p1", 1, "a red brick chimney stack with one pot",
    "A square red-brick chimney stack as it stands above a roof: warm orange-red bricks with cream mortar, a few darker burnt bricks, three projecting stepped courses near the top (a corbelled cap),"
    " and ONE stubby, fat terracotta chimney pot on top with a dark sooty opening. Unlit, no smoke." + SINK,
    "a square red brick chimney with a stepped top and a clay pot",
    ["a square brick chimney shaft, taller than wide", "brickwork painted on every face"], CH_NOT, size=(28, 28, 84),
    use="The ordinary town / inn chimney; on tile and shingle roofs." + CH_USE, fp="sub", connector="chimney", anchor="over the hearth; top 3 ft above the ridge if within 5 ft of it")
add("chimney-stack--stone", "chimney-stack", "p1", 1, "a stone chimney stack",
    "A square chimney stack of rough warm-grey and ochre fieldstone with thick cream mortar, tapering very slightly, with a projecting course of flat stones near the top and TWO thick slate slabs leaning together like a tent over the flue."
    " Dark soot staining round the top. Unlit, no smoke." + SINK,
    "a square rough stone chimney with slabs leaning together on top",
    ["a square stone chimney shaft, taller than wide", "stonework painted on every face"], CH_NOT, size=(30, 30, 84),
    use="Stone-built houses, castles' domestic ranges, log cabins." + CH_USE, fp="sub", connector="chimney", anchor="as chimney-stack--brick")
add("chimney-stack--mansion", "chimney-stack", "p2", 2, "a tall mansion chimney stack with three pots",
    "A tall, grand chimney stack: a long rectangular shaft of fine red brick with cream stone corner blocks (quoins), a moulded cream stone cornice near the top, and THREE fat terracotta chimney pots in a row on top,"
    " each a different simple shape (round, square, octagonal), with dark sooty openings. Twice as wide as it is deep, and very tall. Unlit, no smoke." + SINK,
    "a tall rectangular brick chimney with stone trim and three clay pots in a row on top",
    ["a tall chimney shaft, much taller than wide", "two or more chimney pots on top"], CH_NOT, size=(48, 24, 132),
    use="Mansion skyline: one per pair of fireplaces, usually on the ridge or at a gable end; the tallest thing on the roof." + CH_USE, fp="sub", connector="chimney", anchor="long side parallel to the ridge")
add("chimney-stack--cottage", "chimney-stack", "p2", 2, "a short squat cottage chimney",
    "A SHORT, squat cottage chimney: a stubby square stack of whitewashed, lumpy fieldstone, a little wider at the bottom, with a flat slate slab cap raised on four stubby corner stones so that a dark gap shows under the slab."
    " Soot-stained at the top, a patch of moss on one side. Only a little taller than it is wide. Unlit, no smoke." + SINK,
    "a short squat stone chimney with a flat slab cap raised on little corner stones",
    ["a short stubby chimney, not much taller than wide"], CH_NOT + ["a tall slender chimney"], size=(32, 32, 48),
    use="Thatched and peasant roofs: sits low on the ridge." + CH_USE, fp="sub", connector="chimney", anchor="on the ridge line")
P_NOT = ["battlements or tooth-shaped gaps along the top", "a pierced balustrade with thin balusters", "people or creatures"]
add("parapet-straight--dressed-stone", "parapet-straight", "p2", 2, "a low stone roof parapet, one straight section",
    "A low, solid stone parapet wall: 3 ft high, 1 ft thick, 5 ft long, with a moulded plinth course along the bottom, one long sunk rectangular panel carved into each broad face, and a projecting rounded coping stone along the top."
    " Level top, no gaps. Cream and warm-grey stone with lichen spots." + BUTT,
    "a low solid stone wall section with a coping on top and a carved panel in its face",
    ["a low solid wall section, wider than it is tall", "a continuous level top"], P_NOT, size=(60, 12, 36),
    use="The ledge of a flat or low-pitched roof and of a roof terrace: on the roof's cell edges, at the outside face of the wall below. Half cover. Also a terrace edge at ground level.",
    fp="edge", anchor="on a cell edge at roof level (z = top of the wall), outer face flush with the wall face below", fit="box")
add("parapet-corner--dressed-stone", "parapet-corner", "sib2", 2, "a square stone parapet corner pier",
    "Not a wall section but the CORNER PIER of this parapet: a square stone pier 16 in each way and a little taller than the parapet (44 in), with the same plinth course and the same coping profile carried round all four sides,"
    " a sunk panel on each face, and a low pyramid cap stone on top. All four sides alike.",
    "a short square stone pier with a pyramid cap",
    ["a square pier, taller than wide", "the same on all sides"], ["a long wall section", "a statue, urn or ball on top"],
    size=(16, 16, 44), parent="parapet-straight--dressed-stone", what="stone parapet",
    use="At every corner and free end of a parapet run (the way hedge-end-block ends a hedge). A roof-finial or gargoyle-spout may sit on / under it.",
    fp="edge", anchor="on a cell vertex at roof level", fit="box")
add("wall-crenellated--dressed-stone", "wall-crenellated", "p1", 1, "a castle battlement, one straight section",
    "One 5-ft section of a castle battlement: a thick solid stone parapet 3 ft high and 2 ft thick, with ONE square merlon (the raised tooth) standing on the middle of it, 2.5 ft wide and rising to 5 ft,"
    " so that there is HALF a gap (crenel) at each end of the section. The merlon has a sloped cap stone and a small arrow-slit groove carved into its outer face (a recess, not a hole). Big rough warm-grey blocks, weathered, moss in the joints." + BUTT.replace("and the profile is the same from end to end", "and the low parts at both ends are the same height"),
    "a thick stone battlement section: a low wall with one raised square block in the middle",
    ["a low thick stone wall with one raised square merlon in the middle", "lower gaps at both ends"], ["two or more merlons", "a tower or gatehouse", "people or creatures"], size=(60, 24, 60),
    use="Castle roof and wall-walk edge (three-quarter cover behind the merlon, half behind the crenel). Copies butt into merlon / crenel / merlon at 5-ft rhythm. If the castle designer specifies the same role, keep one sku.",
    fp="edge", anchor="on a cell edge at roof / wall-walk level, outer face flush with (or 6 in proud of, on corbel-stone) the wall below", fit="box")
add("wall-crenellated-corner--dressed-stone", "wall-crenellated-corner", "sib1", 1, "the corner block of a castle battlement",
    "Not a wall section but the CORNER of this battlement: one big square corner merlon, 28 in each way and 5.5 ft tall (a little taller than the other merlons), solid from the ground of the wall-walk up,"
    " with a pyramid-sloped cap stone and an arrow-slit groove carved into each of its two outer faces. The same stone, block size and weathering.",
    "a tall square stone corner block with a sloped cap",
    ["a single square block, taller than wide"], ["a long wall section", "a round turret", "people or creatures"],
    size=(28, 28, 66), parent="wall-crenellated--dressed-stone", what="castle battlement",
    use="At every corner and free end of a battlement run.", fp="edge", anchor="on a cell vertex at roof level", fit="box")
RIDGE = " The underside is solid and flat (in the game it is sunk into both roof slopes along the ridge)."
R_NOT = ["a whole roof or a roof slope attached", "a house"]
add("roof-ridge--thatch", "roof-ridge", "p2", 2, "a section of decorative thatched roof ridge",
    "A thatched ridge capping: a thick saddle of golden-ochre straw, 5 ft long, 2 ft wide and 1 ft high, rounded over the top like a loaf, with its two long lower edges cut into a row of big scallops,"
    " and a criss-cross diamond pattern of darker hazel rods pressed INTO its surface along each side (carved into the mass, not separate sticks)." + RIDGE + BUTT,
    "a long rounded hump of straw thatch with scalloped lower edges and a criss-cross pattern",
    ["a long low rounded bar of straw thatch", "scalloped or patterned edges"], R_NOT, size=(60, 24, 12),
    use="Along the ridge of a thatched roof, end to end. Thatch ridges are the one ridge that really is a raised, sculpted thing, so it is worth a mesh.", fp="edge", anchor="centred on the ridge line, sunk 4 in", fit="box")
add("roof-ridge--tile", "roof-ridge", "p2", 2, "a section of clay ridge tiles",
    "A row of exactly FIVE half-round terracotta ridge tiles laid end to end, each overlapping the next with a thick raised collar, bedded on a strip of cream mortar that shows along both lower edges."
    " Orange-red clay with darker and mossy patches. 5 ft long, 1 ft wide, 8 in high: a long half-cylinder." + RIDGE + BUTT,
    "a long half-round row of overlapping red clay ridge tiles",
    ["a long half-round bar made of several clay tiles end to end"], R_NOT, size=(60, 12, 8),
    use="Along the ridge (and hips) of a clay-tile roof, end to end.", fp="edge", anchor="centred on the ridge line, sunk 2 in", fit="box")
add("roof-ridge--lead", "roof-ridge", "p3", 3, "a section of lead-covered roof ridge roll",
    "A lead ridge roll: a long round wooden roll wrapped in dull grey lead sheet, with a flat skirt of lead flashing down each side and THREE raised welted seams crossing over it at even spacing."
    " Soft dents and pale streaks in the lead. 5 ft long, 10 in wide, 6 in high." + RIDGE + BUTT,
    "a long low grey metal-covered ridge bar with a rounded top and raised seams",
    ["a long low rounded bar, grey metal"], R_NOT + ["shiny chrome or mirror-like metal"], size=(60, 10, 6),
    use="Ridge and hips of slate roofs and (painted the same) of wood-shingle roofs; if the roof code can extrude a ridge roll itself, this mesh is not needed.", fp="edge", anchor="centred on the ridge line, sunk 1 in", fit="box")
add("roof-finial--s1", "roof-finial", "p3", 3, "a stone ball finial for a gable peak",
    "A stone roof finial: a fat stone ball on a short moulded neck, standing on a small square saddle block with a flat cut bottom. Cream and warm-grey stone, lichen-spotted. About 10 in wide and 2 ft tall; every part thick.",
    "a stone ball on a short moulded stem and a square block",
    ["a ball or knob on a short thick stem"], ["a thin spike or needle", "a statue or figure"], size=(10, 10, 24),
    use="On gable peaks, parapet corner piers and at the ends of a ridge (stone, slate and tile roofs).", fp="sub", anchor="on a ridge end or gable apex, sunk 3 in")
add("roof-finial--s2", "roof-finial", "p3", 3, "a chunky lead spear-bud finial for a tower cap",
    "A lead and iron roof finial for the point of a tower roof: a flared round lead skirt at the bottom (it caps the point of the roof), a fat ringed stem, and a chunky closed flower-bud or spearhead shape at the top, as thick as a fist everywhere."
    " Dull grey lead with dark iron and a few pale streaks. About 9 in wide and 30 in tall.",
    "a thick grey metal roof ornament: a flared base, a ringed stem and a bud-shaped top",
    ["a thick upright ornament with a bud or spearhead top"], ["a thin spike or needle", "a flag or weathervane arrow", "shiny chrome"], size=(9, 9, 30),
    use="On the apex of a conical or pyramid tower cap (roof-conical), and on dormer peaks.", fp="sub", anchor="on a roof apex, skirt sunk over the point")
add("weathervane--banner", "weathervane", "p3", 3, "a chunky iron banner weathervane",
    "A blacksmith-made weathervane, deliberately CHUNKY: a thick round iron post (3 in thick) with a fat ball halfway up, a short thick cross of four stubby arms with ball ends below it (NO letters on the arms),"
    " and at the top one thick horizontal bar carrying a swallow-tailed banner-shaped plate on one side and a fat arrowhead on the other. The banner plate is a slab at least 2 in thick with a simple cut-out diamond. Dark iron with ochre gilding worn on the edges.",
    "a thick iron weathervane with an arrow and a banner-shaped plate on a post",
    ["an upright post carrying a horizontal arrow or banner", "all parts thick and solid"], ["letters N E S W or any text", "a rooster or other animal", "thin wire-like rods"], size=(30, 8, 48),
    use="Roof life: at most one per building, on the highest ridge end or tower apex. May turn slowly in the wind later (the engine can spin it about its post).", fp="sub", anchor="on a ridge end or apex, post sunk 4 in")
add("roof-skylight--lead", "roof-skylight", "p2", 2, "a low glazed roof lantern skylight",
    "A roof skylight: a square raised timber curb 8 in high, and on it a low four-sided hipped lantern of glass in a thick lead-grey frame, with one fat glazing bar down the middle of each of the four sloping glass faces and a small ball knob at the peak."
    " The glass is dark warm grey-green with a paler streak (never blue, not see-through). 4 ft square, 16 in high.",
    "a low square pyramid-shaped glazed roof light in a thick grey frame on a raised curb",
    ["a low square glazed structure with a thick frame", "sloping glass faces meeting at a peak or short ridge"], ["blue glass", "a tall greenhouse", "a patch of roof round it"], size=(48, 48, 16),
    use="A vertical connector for thieves and rooftop chases: sits on a flat roof or the ridge-side of a low slope, directly over the room it lights (a mansion stair hall, a studio, a library). Drop through = a 10-ft fall into that room.",
    fp="1", connector="skylight", anchor="centred on a cell of the room below, on the roof surface")
HATCH = "A raised square curb of thick planks, 8 in high and 4 ft square, bound at the corners with iron straps"
add("roof-hatch--wood", "roof-hatch", "p1", 1, "a wooden roof hatch, closed",
    HATCH + ", closed by a flat lid of four thick planks with two cross battens, two heavy iron strap hinges along one edge and one iron ring handle opposite them. The lid overhangs the curb a little all round to shed rain."
    " Weathered grey-brown oak, dark iron. Low and square.",
    "a low square wooden hatch with a plank lid, iron hinges and a ring handle",
    ["a low square wooden box or frame with a flat plank lid", "iron hinges or a handle"], ["an open lid", "a chest or crate that is tall", "a patch of roof round it"], size=(48, 48, 10),
    use="The way onto a roof, or into a loft from below: placed in the cell over the head of a ladder (ladder-wood--leaning / --upright) or over a stair-spiral-wide top. Closed = floor you can stand on.",
    fp="1", connector="hatch", anchor="centred on its cell on the roof / floor surface; the floor below it is open", bench=["hinge"])
add("roof-hatch-open--wood", "roof-hatch-open", "sib1", 1, "a wooden roof hatch with its lid stood open",
    "The same hatch with its lid OPEN: the plank lid is swung up on its two strap hinges and stands just past upright, leaning back about 10 degrees, held by one thick iron prop bar. The curb, straps, planks and ring handle are unchanged."
    " Inside the curb is a square dark opening, painted near-black, with the rounded tops of two thick ladder poles just showing inside one edge.",
    "a low square wooden hatch frame with its plank lid standing open on hinges",
    ["the lid is open and standing up", "a dark opening inside the frame"], ["a closed lid", "a patch of roof round it"],
    size=(48, 52, 50), parent="roof-hatch--wood", what="roof hatch",
    use="Open state of roof-hatch--wood (two-state swap; align on the Alignment Bench so the curb does not jump).", fp="1", connector="hatch",
    anchor="as roof-hatch--wood", twin_of="roof-hatch--wood", bench=["hinge"])
add("gargoyle-spout--s1", "gargoyle-spout", "p2", 2, "a carved stone gargoyle waterspout",
    "An architectural stone CARVING, not a living creature: a gargoyle waterspout, a long horizontal block of weathered warm-grey stone that projects 3 ft from a wall, carved as a crouching, stretched-out grotesque beast"
    " with a big blunt head, an open mouth that is the spout hole, stubby clawed forelegs gripping the block, and short wings folded TIGHT against its sides (carved in relief, not sticking out)."
    " The back end is a plain square block with a flat vertical cut (the part built into the wall). Lichen and dark water streaks. One solid chunky piece.",
    "a horizontal carved stone gargoyle waterspout projecting from a square block",
    ["a stone carving of a grotesque beast, stretched out horizontally", "clearly stone, all one grey colour family"], ["a living, coloured animal or monster", "wings spread out wide", "a wall section attached"], size=(14, 36, 18),
    use="Sparse: at parapet / battlement corners and gutter ends of temples, castles and old mansions, no more than one per 15 to 20 ft of eaves. Projects outward under the coping.",
    fp="sub", anchor="flat back in the outer wall face just below the parapet (default mount 96 in), pointing outward", hung=True)
add("gargoyle-spout--plain", "gargoyle-spout", "p3", 3, "a plain stone waterspout",
    "A plain stone waterspout with no figure carving: a long tapering stone trough, half-round underneath with a channel hollowed along its top, projecting 2.5 ft from a square moulded block with a flat vertical cut at the back (the part built into the wall),"
    " carried on one small rounded corbel stone under its root. A carved leaf at the very tip. Warm-grey stone with a green water stain along the channel.",
    "a plain horizontal stone water spout: a tapering trough projecting from a square block",
    ["a long horizontal stone spout with a channel along its top"], ["an animal or face carving", "a wall section attached", "running water"], size=(10, 30, 14),
    use="The everyday version: castles' wall-walk drains, town houses. Same placement as the gargoyle; can be denser (every 10 ft).",
    fp="sub", anchor="as gargoyle-spout--s1", hung=True)
add("nest-bird--s1", "nest-bird", "p3", 3, "a bird's nest with three eggs",
    "A small bird's nest: a chunky bowl woven of thick twigs and straw, painted as one solid mass with a few fat twig shapes on its surface (no thin loose twigs), lined with a little moss and two cream feathers pressed flat,"
    " holding THREE large cream eggs with brown speckles. No bird. About 14 in across and 7 in high.",
    "a round twig nest holding three speckled cream eggs",
    ["a bowl-shaped nest of twigs", "eggs inside"], ["a bird", "blue eggs", "a branch or tree"], size=(14, 14, 7),
    use="Optional roof life: beside a chimney, in a dormer valley, on a parapet corner pier, on a tower cap. At most one or two per building. (A pigeon is a creature and is left to the creature pipeline.)",
    fp="tiny", anchor="on any flat-ish roof spot, sunk 1 in")

# ------------------------------------------------------------------------------------------------ write
ids = [a["id"] for a in assets]
assert len(ids) == len(set(ids))
for a in assets:
    assert roles[a["object"]]["size"], a["object"]
    if a.get("parent"):
        par = next(x for x in assets if x["id"] == a["parent"])
        assert par["group"].startswith("p"), (a["id"], "parent must be in a p group")
    if a.get("twin_of"): assert a["twin_of"] in ids
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])

KIT = {
 "what": "Vertical kit: what each piece is for and where it goes. For the agent who builds storeys and roofs. Nothing here is generated or wired yet (2026-10-05).",
 "conventions": {
  "units": "inches; W = width (across the direction of travel), D = depth / run (the direction a stair climbs), H = height",
  "storey": {"floor_to_floor": 120, "wall": 108, "slab": 12, "cell": 60, "half_level": 60},
  "stair_rule": "Every stair cell rises exactly 60 in, one step of the world's 5-ft height lattice. Full flight = 1x2 cells (10 steps of 12 in x 12 in, 45 degrees); half flight = 1 cell (5 steps). A pawn on the first cell of a flight stands at about +2.5 ft, on the second at about +7.5 ft.",
  "why_1x2_not_1x3": ["a 1x2 flight is exactly two 5-ft cubes, so the half flight (dais, stage, half level) is literally half of it and the L and dog-leg stairs are made of the same half flights plus a 5-ft landing: one module, not two",
                      "at 1x3 a cell rises 3.33 ft, which is on no lattice, and the half flight would be 1.5 cells long",
                      "inn and cottage rooms are 4 to 6 cells across: three cells of stair plus a cell of floor at each end is most of a wall",
                      "ten 12-in steps read as steps from the top-down camera and survive image-to-3D; fifteen 8-in steps blur into a ramp",
                      "the cost is a 45-degree pitch (a real house stair is 35 to 38): acceptable at table distance. The one stair that is looked at, stair-grand, takes 3 cells of run at 8-in risers"],
  "stair_top": "The top tread is level with the upper floor (z = 120). The upper slab is cut away over the stair's cells; the cell beyond the top tread is floor.",
  "stair_width": "Treads are 48 in wide, centred in the 60-in cell: 6 in each side for the wall panel's thickness or a railing.",
  "handed": "stair-quarter-turn, stair-wall-hugging and the ladders are right-handed as specified; mirror the mesh for the other hand.",
  "fit": "Pieces marked fit:box must be scaled PER AXIS to their size_in (not uniformly by the largest dimension, which is what the library does today): the image-to-3D generator ignores stated proportions, and a stair that is 8% short does not meet the floor. A per-axis stretch of up to about 15% is invisible on steps; beyond that, regenerate.",
  "sink": "Roof furniture (dormers, chimneys, ridges, finials) has a flat bottom and a plain lower part and is SUNK into the sloping roof plane; nothing is cut to the pitch, so one mesh serves every pitch.",
  "sparse": "Harry: roof furniture 'will be sparse'. Guide: chimneys = one per fireplace stack; dormers = one per attic room or one per bay on a mansion; one weathervane per building; a gargoyle per 15 to 20 ft of parapet; a nest on one roof in three.",
  "roof_surfaces": "See flats.json: four seamless roofing textures with courses along image X and eaves at image bottom.",
 },
 "connectors": {
  "stair": ["stair-straight", "stair-half", "stair-landing", "stair-quarter-turn", "stair-spiral-wide", "stair-wall-hugging", "stair-grand", "stair-exterior-wood (existing mesh)"],
  "ladder": ["ladder-wood--leaning under floor-trapdoor (existing mesh) or roof-hatch", "ladder-wood--upright on a wall face"],
  "hatch": ["roof-hatch--wood / roof-hatch-open--wood", "floor-trapdoor (existing)"],
  "skylight": ["roof-skylight--lead (one-way: a drop)"],
  "chimney": ["chimney-stack--* lines up over the fireplace below"],
 },
 "pieces": kit,
 "existing_library": [
  {"object": "stair-straight", "skus": "--dressed-stone, --rough-timber (inn-01, 3 stars)", "verdict": "superseded", "why": "measured 61 x 110 x 84 high (stone) and 110 x 77 x 94 high (timber): neither climbs 10 ft, neither fits a 5-ft cell. New meshes are separate skus with the suffix --t10 (ten-foot storey); the inn-01 meshes stay in place for the rooms that use them."},
  {"object": "stair-landing", "skus": "--dressed-stone, --rough-timber (3 stars)", "verdict": "superseded", "why": "about 35 in high: meets neither floor nor half level. New 60-in-high landings are separate skus with the suffix --t10."},
  {"object": "stair-exterior-wood", "skus": "--dressed-stone, --rough-timber (3 stars; note 'outdoor carpets?')", "verdict": "usable", "why": "rise is about equal to run (62-65 w x 110 x 106-113 high): right pitch for this kit. Rescale to 120 rise and it is the outside stair to an upper door. Wider than a cell by a few inches. Not respecified."},
  {"object": "ladder-wood", "skus": "ladder-wood (plate 1 star: 'jumbo rung')", "verdict": "superseded", "why": "by ladder-wood--leaning and --upright (equal rungs demanded in the gate)."},
  {"object": "floor-trapdoor", "skus": "--dressed-stone, --rough-timber (3 stars)", "verdict": "usable", "why": "the indoor floor-side connector over a ladder (cellar, loft). Measures 18 to 23 in high at a 60-in width, far more than the catalog's 4 in: check whether it is a thick frame or an open lid before placing it flush. roof-hatch is the weathered outdoor one with a curb."},
  {"object": "roof-dormer", "skus": "--dressed-stone, --rough-timber (3 stars)", "verdict": "usable as fallback", "why": "proportions fine (49 x 39 x 60 and 57 x 53 x 60) but their roofing matches none of the four roof surfaces by design; the four material-matched dormers replace them on generated roofs."},
  {"object": "roof-shingle-wood", "skus": "both (3 stars, note 'is a whole roof')", "verdict": "superseded", "why": "each is a complete little roof, not a segment that tiles. Roof planes are code plus the roofing-shingle-wood flat. Keep as a ready-made roof for a 1-cell shed, well-house or porch."},
  {"object": "balcony-wood", "skus": "--rough-timber (3 stars), --dressed-stone (unrated: 'model isn't bad... specified as outside')", "verdict": "usable", "why": "about 60 x 50 x 50 with its own railing: an exterior piece hung at upper-floor level (bottom at z about 108), over jetty-bracket--s2 or corbel-stone. Harry's note is about placement, which is the generator's job."},
  {"object": "railing-wood", "skus": "both (3 stars)", "verdict": "check before use", "why": "catalog says 4 in deep; they measure 30 to 45 in deep at a 60-in length, so they are not a thin edge rail (a base, a return or a diagonal). Look before putting them on stair and gallery edges. No replacement specified: a thin railing is exactly what image-to-3D breaks; a code-made rail (posts + bar) is the better route."},
  {"object": "gallery-interior", "skus": "both (unrated: 'what is this?', 'not sure what this is supposed to be')", "verdict": "not usable; retire", "why": "a gallery is a floor slab at +10 ft with a rail and posts under it: storeys make it (slab + post-timber--plain + rail), no mesh needed."},
  {"object": "porch-covered", "skus": "both (3 stars)", "verdict": "usable for now", "why": "works as a whole prop at a door (about 110 x 87-100 x 100 high) but carries its own fixed roof; once roofs exist a porch is a lean-to roof plane on two post-timber--plain."},
  {"object": "post-timber", "skus": "post-timber (3 stars)", "verdict": "usable indoors", "why": "it measures 67 in wide at 108 tall, so it has arms or braces: good in a common room, wrong under a jetty corner. post-timber--plain added."},
 ],
 "catalog_lines_to_correct": [
  "stair-straight: size 36x110x108 -> 48x120x120 (the kit's flights are specified at this size; the core line is untouched)",
  "stair-landing: 60x60x54 -> 60x60x60", "stair-exterior-wood: 40x110x108 -> 40x120x120", "stair-wall-hugging: 36x110x108 -> 48x120x120",
  "stair-grand: fp 2x2, 110x110x108 -> fp 2x3, 120x180x120 (or keep 2x2 and accept a 45-degree grand stair)",
  "ladder-wood: 18x6x120 -> 24x9x120 (chunky), and the leaning one occupies part of a floor cell",
  "wall-crenellated: 60x24x60 is used as is", "roof-thatch / roof-tile-slate / roof-shingle-wood (mesh roof segments): retire in favour of the roofing-* flats when roofs are planes",
  "jetty-overhang (a whole overhanging storey as one kit piece): retire; a jetty is the upper storey offset 30 in plus jetty-bracket",
 ],
 "not_specified_on_purpose": ["pigeon (creature)", "stair-spiral in ONE cell (core line; a 5-ft spiral is too tight for 12-in chunky steps)", "roof-conical tower cap and roof-gable-end (roof code makes them from the roofing flats)",
                              "railings (thin; code-made)", "a U-turn dog-leg as one mesh (build it from stair-half + two stair-landing + stair-half, or use stair-quarter-turn)"],
}
(HERE / "kit.json").write_text(json.dumps(KIT, indent=1) + "\n")
print(len(assets), "assets", dict(Counter(a["group"] for a in assets)), "prio", dict(sorted(Counter(a["prio"] for a in assets).items())))

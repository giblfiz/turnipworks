#!/usr/bin/env python3
"""Codex image_gen briefs for the 2026-11-10 Meshy batch: one plate per shipped sku, at the CATALOG proportions.
  make_briefs.py [ids...]        writes BRIEF-<worker>.md (shots split across workers) into the lane folder
  make_briefs.py --redo id ...   writes BRIEF-redo.md for re-plates (adds the redo note from REDO_NOTES)"""
import json, sys
from pathlib import Path
E = Path(__file__).resolve().parents[1]; R = E.parents[1]
L = json.loads((R / 'tools/spawn-tuner/data/library.json').read_text())['objects']

HEAD = """# Image brief: {name}

You are generating source plates for 3D reconstruction (image-to-3D). Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates images or draws anything: every picture must come from image_gen.

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim), size as stated, with a transparent background. If the shot names a reference image, LOOK at it first and pass it to image_gen as a reference image (keep its style, colours and contents, but follow the prompt's proportions where they differ). Save the result as `plates/<id>.png` in this folder (create `plates/` if missing).

Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it is plainly the requested object; (4) its PROPORTIONS match the prompt: compare the drawn width, height and depth (the visible side panel) with the inches given; depth matters most, a shallow wall unit must look shallow; (5) NO text, letters, numbers, logos or brand marks anywhere (look closely at book spines, labels, screens, bottles); (6) no floor, no shadow, no people. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG-{name}.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next. When all are done, write `plates/DONE-{name}` containing the list of saved ids.

## Shots
"""

STYLE = ("Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, "
         "no glossy PBR, no photorealism. Glass is painted OPAQUE (soft tinted colour with a pale highlight), never see-through. "
         "Exactly one complete object centered with generous clear margin, no scene or additional objects, no people or creatures. "
         "NO text, NO letters, NO numbers, NO logos, NO brand names and no recognisable real product design anywhere: labels, "
         "spines and screens are blank or carry simple abstract shapes only. Three-quarter front view from ABOVE (camera elevation "
         "30 degrees, turned about 30 degrees to one side) so the front, ONE side panel and the top are all visible and the depth "
         "reads clearly; the whole object fits in the frame. Genuinely transparent background, no floor, no ground and no cast "
         "shadow. Thick reconstructible parts; no wires, thin rods or isolated floating components.")

SET = {
    'wizard': ("for a WIZARD'S TOWER (high fantasy, arcane)", "Palette: aged dark oak and walnut, brass fittings, deep purple, midnight blue and emerald accents, a few softly glowing gems; avoid an all-brown result."),
    'noble': ("for a NOBLE MANSION (fantasy, late Renaissance)", "Palette: polished dark walnut and mahogany, gilt trim, book bindings in burgundy, forest green, navy and tan leather; avoid an all-brown result."),
    'inn': ("for a FANTASY TAVERN (medieval fantasy)", "Palette: warm honey and dark oak, black iron hoops and brackets, copper and brass taps, bottles in amber, green and ruby glass; avoid an all-brown result."),
    'temple': ("for a FANTASY CATHEDRAL (medieval fantasy)", "Palette: dark carved oak, burnished brass and pewter pipes, deep red and gold trim; avoid an all-brown result."),
    'market': ("for a FANTASY MARKET TOWN shop (medieval fantasy)", "Palette: warm oak and pine, iron fittings, colourful stock (cloth, pottery, glass, herbs); avoid an all-brown result."),
    'cyber': ("for a CYBERPUNK CITY (near future, neon)", "Palette: gunmetal and charcoal panels, scuffed paint, glowing cyan, magenta and amber light accents; avoid an all-black result: panels read as mid grey with pale worn edges."),
    'modern': ("for a MODERN CITY setting (present day)", "Palette: clean modern colours (chrome and white-painted steel, warm wood, colourful packaging in red, yellow, green and blue); avoid an all-grey result."),
    'chn': ("for an imperial CHINESE SCHOLAR'S STUDY (historical fantasy)", "Palette: dark red-brown rosewood, indigo-blue cloth book cases, pale paper, brass fittings; avoid an all-brown result."),
}
PRE = "Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art, {s}: the same chunky storybook miniature style the game uses for all its props. "

# sku -> (catalog id, setting, one-line object, body, reference image or None)
X = 'experiments/'
SHOTS = {
 'bookshelf--arcane': ('bookshelf', 'wizard', "ONE tall wizard's bookshelf.", "A tall standing BOOKSHELF of dark oak with brass corner fittings and a carved crest: five shelves packed with rows of chunky leather-bound spellbooks standing upright (purple, blue, green, oxblood), a few lying stacked, a skull and a small glowing crystal ball on the top shelf, a candle stub.", None),
 'bookshelf--arcane--s2': ('bookshelf', 'wizard', "ONE tall arcane bookshelf.", "A tall standing BOOKSHELF in midnight-blue painted wood with brass star inlays on its side panels and an arched top: five shelves filled with rows of thick upright tomes in purple, teal and gold bindings, some scroll cases, a brass astrolabe and a stoppered potion bottle tucked between the books.", None),
 'bookshelf--fine--s1': ('bookshelf', 'noble', "ONE tall mansion library bookshelf.", "A tall standing BOOKSHELF of polished walnut with a moulded crown cornice and fluted pilasters: five shelves packed with neat rows of upright leather-bound books in burgundy, green and tan, gilt bands on the spines (no lettering), a small marble bust on the top.", None),
 'bookshelf--fine--s2': ('bookshelf', 'noble', "ONE tall gentleman's bookshelf.", "A tall standing BOOKSHELF of dark mahogany with a gilt-edged cornice and a plinth base: five shelves of upright leather books in navy, forest green and oxblood, one shelf with a row of books leaning and a brass globe-shaped bookend, a closed cupboard of two panelled doors at the bottom.", None),
 'bookshelf--fine--s3': ('bookshelf', 'noble', "ONE tall noble's bookshelf.", "A tall standing BOOKSHELF of honey-coloured oak with carved acanthus brackets and a broken-pediment top: five shelves of densely packed upright books in mixed tan, burgundy and green leather, a pair of candlesticks and a small clock on the middle shelf.", None),
 'curio-shelf': ('curio-shelf', 'cyber', "ONE tall cyberpunk curio shelf.", "A tall standing open SHELF unit of scuffed gunmetal and old wood crammed with talisman-shop stock: rows of glass jars of herbs and glowing liquids, bundles of dried herbs, small animal skulls and bones, clusters of glowing crystals, a string of tiny neon charms along one edge.", X + '2026-11-07-cyberpunk-rooms/masked/curio-shelf.png'),
 'cask-rack': ('cask-rack', 'inn', "ONE tavern cask rack.", "A heavy oak CASK RACK: a sturdy timber cradle frame holding six chunky barrels lying on their sides in two rows of three, iron hoops on every barrel, a brass tap in the front end of each, the round barrel ends facing the front.", X + 'inn-02/masked/cask-rack.png'),
 'cask-rack--s2': ('cask-rack', 'inn', "ONE tavern cask rack.", "A heavy dark-oak CASK RACK: a two-tier timber stand holding a row of three large barrels below and three smaller kegs above, lying on their sides with iron hoops, a copper tap and a drip cup at each round front end.", X + 'inn-02/masked/cask-rack--s2.png'),
 'apothecary-drawers': ('apothecary-drawers', 'temple', "ONE apothecary's drawer wall.", "A tall shallow APOTHECARY CABINET: a dark oak case faced with a dense grid of many small square drawers (eight rows of seven), each with a little brass knob and a blank brass label plate, a narrow shelf on top with a few stoppered jars and a brass scale.", None),
 'apothecary-drawers--s2': ('apothecary-drawers', 'wizard', "ONE wizard's reagent drawer cabinet.", "A tall shallow REAGENT CABINET of dark oak with brass corners: its front is a dense grid of many small drawers (eight rows of six) with brass ring pulls and blank paper labels, a carved moon crest on top, a few glowing potion vials standing on its top.", None),
 'apothecary-drawers--shop': ('apothecary-drawers', 'market', "ONE apothecary shop's drawer wall.", "A tall shallow APOTHECARY DRAWER CABINET of warm oak: its front is a dense grid of many small drawers (eight rows of six) with round wooden knobs and blank cream label cards, a row of glazed pottery jars along its top, a little ladder-rail moulding at the cornice.", None),
 'terminal-desk': ('terminal-desk', 'cyber', "ONE cyberpunk hacker's terminal desk.", "A long workstation DESK of gunmetal steel: three chunky glowing monitors on arms (screens show abstract cyan and magenta bars only), two keyboards, a stack of humming computer towers in the desk's side bay, a mug and a tangle-free cable tray along the back edge.", X + '2026-11-07-cyberpunk-rooms/masked/terminal-desk.png'),
 'bookcase-ladder': ('bookcase-ladder', 'noble', "ONE grand library bookcase with a rolling ladder.", "A grand double-width tall BOOKCASE of polished walnut: two bays of six shelves each packed with hundreds of upright leather books (burgundy, green, navy, tan, gilt bands, no lettering), a carved cornice, and a sturdy wooden library LADDER leaning against its front, its top hooked on a thick brass rail that runs along the bookcase.", None),
 'alch-reagent-shelf-tall--s1': ('alch-reagent-shelf-tall', 'wizard', "ONE tall alchemist's reagent shelf.", "A tall standing open SHELF unit of dark oak with iron brackets: five shelves lined with rows of glass jars and bottles of reagents (glowing green, amber, violet liquids, dried herbs, eyes in brine), corked flasks, a mortar and pestle.", None),
 'alch-reagent-shelf-tall--s2': ('alch-reagent-shelf-tall', 'wizard', "ONE tall alchemist's jar shelf.", "A tall standing open SHELF unit of weathered grey-brown wood with brass corner caps: five shelves of rows of squat clay jars with wax-sealed lids, tall glass flasks of coloured liquids, bundles of dried roots and a coiled brass alembic on the top shelf.", None),
 'chn-bookcase': ('chn-bookcase', 'chn', "ONE Chinese scholar's open bookcase.", "An open BOOKCASE of dark rosewood with a simple frame and gently curled top rails: four shelves holding neat stacks of string-bound books inside indigo-blue cloth cases with bone clasps, a few scroll rolls and a small celadon vase.", None),
 'shelving-wire': ('shelving-wire', 'modern', "ONE chrome wire shelving unit of dry goods.", "A freestanding chrome WIRE SHELVING unit with four thick wire-grid shelves on chunky round corner posts, stocked with dry goods: cardboard boxes, big sacks of rice and flour, stacked cans, jars of pickles and plastic tubs (all unlabelled, plain colours).", X + '2026-11-07-modrooms/masked/shelving-wire.png'),
 'vending-machine': ('vending-machine', 'cyber', "ONE cyberpunk drinks vending machine.", "A chunky DRINKS VENDING MACHINE: a tall steel cabinet whose front is a glowing window (painted opaque) showing a neat grid of colourful drink cans and bottles in rows of slots, a keypad and coin slot panel at the side, a dispensing tray at the bottom, a glowing cyan light strip around the front.", X + '2026-11-07-cyberpunk-rooms/masked/vending-machine.png'),
 'back-bar-shelves': ('back-bar-shelves', 'inn', "ONE tavern back-bar shelf of bottles.", "A tall shallow BACK-BAR SHELF of dark oak: four shelves lined with rows of bottles (amber, green, ruby glass), small kegs on the bottom shelf, a row of pewter tankards hanging from hooks under the top shelf, a carved board crowning the top.", X + '2026-09-30-inn-01-500/masked/back-bar-shelves.png'),
 'back-bar-shelves--mod': ('back-bar-shelves', 'modern', "ONE modern bar's back-bar shelving.", "A tall shallow modern BACK-BAR SHELVING unit: dark walnut uprights with lit glass shelves (painted opaque) lined with rows of spirits bottles in amber, clear-blue and green, a row of upturned glasses on the lowest shelf, a mirrored back panel (painted opaque blue-grey).", None),
 'back-bar-shelves--s2': ('back-bar-shelves', 'inn', "ONE tavern back-bar shelf.", "A tall shallow BACK-BAR SHELF of weathered honey oak: four shelves of bottles and stoneware jugs, a row of hanging copper mugs, a small cask on a cradle on the bottom shelf, a carved scalloped top.", X + 'inn-02/masked/back-bar-shelves--s2.png'),
 'cooling-unit': ('cooling-unit', 'cyber', "ONE data-centre cooling cabinet.", "A big data-centre AIR-CONDITIONING CABINET: a tall boxy steel unit with a grid of louvred vent panels across its front, two big round fan grilles near the top, a small glowing control panel with status lights, thick pipe stubs entering its top.", X + '2026-11-07-cyberpunk-rooms/masked/cooling-unit.png'),
 'organ-pipe': ('organ-pipe', 'temple', "ONE cathedral pipe organ.", "A PIPE ORGAN: a tall carved dark-oak case holding ranks of stout brass and pewter pipes rising in a stepped row, tallest in the middle, over a wooden keyboard desk with two chunky manuals of keys, rows of round stop knobs either side, and a bench before it.", None),
 'shop-shelf-stocked--general': ('shop-shelf-stocked', 'market', "ONE general store's stocked shelf unit.", "A tall standing SHOP SHELF unit of warm pine: five shelves loaded with a general store's stock: coils of rope, lanterns, stacked tin cups and plates, sacks of grain, boxes of candles, wrapped bundles and clay jugs.", None),
 'shop-shelf-stocked--apoth': ('shop-shelf-stocked', 'market', "ONE apothecary shop's stocked shelf unit.", "A tall standing SHOP SHELF unit of dark oak: five shelves loaded with an apothecary's stock: rows of glass jars of herbs and powders, corked bottles of coloured tinctures, bundles of dried herbs, a brass scale and a stack of small wooden boxes.", None),
}
REDO_NOTES = json.loads((E / 'work/redo-notes.json').read_text()) if (E / 'work/redo-notes.json').exists() else {}


def size_of(w, d, h):
    return '1536x1024 (landscape)' if w > h * 1.15 else '1024x1536 (portrait)' if h > w * 1.15 else '1024x1024 (square)'


def shot(sku, redo=False):
    cid, st, one, body, ref = SHOTS[sku]
    if redo: ref = str(E / 'plates' / f'{sku}.png'); w, d, h = L[cid]['size']; s, pal = SET[st]
    prop = (f"Real-world size about {w:.0f} in wide x {d:.0f} in deep x {h:.0f} in tall: keep these proportions. "
            f"Its depth is only {round(100 * d / w)}% of its width" + (" (a shallow unit that stands against a wall)" if d / w < 0.45 else "") + ".")
    p = PRE.format(s=s) + one + ' ' + body + ' ' + prop + ' ' + pal + ' ' + STYLE
    if redo and sku in REDO_NOTES: p += ' ' + REDO_NOTES[sku]
    out = f"### {sku}{'--r2' if redo else ''}\nSize: {size_of(w, d, h)}\n"
    if ref: out += f"Reference image: `{ref}`\n"
    return out + f"\nPrompt:\n\n{p}\n"


if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == '--redo':
        ids = a[1:]
        for k in range(3):
            nm = f'r{k + 1}'; part = ids[k::3]
            (E / f'BRIEF-{nm}.md').write_text(HEAD.format(name=nm) + '\n'.join(shot(s, True) for s in part)); print(nm, part)
    else:
        ids = a or list(SHOTS); n = 3
        for k in range(n):
            nm = f'w{k + 1}'; part = ids[k::n]
            (E / f'BRIEF-{nm}.md').write_text(HEAD.format(name=nm) + '\n'.join(shot(s) for s in part)); print(nm, part)

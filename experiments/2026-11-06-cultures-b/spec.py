#!/usr/bin/env python3
"""Culture packs B (2026-11-06): every NEW mesh of the four packs (Norse NRS, Middle East MDE, Rus' RUS, Mesoamerica MES).
    python3 spec.py            -> targets.json (one record per mesh), catalog/objects-cultures-<code>.catalog.md (new roles)
Nothing here calls a model. Plates: tools/briefs.py (Codex image_gen workers). ROSTERS.md has the research and the
deliberate NOTs; reads/ the sensitivity reads that changed this list.
Every sku is NEW (prefix nrs-/mde-/rus-/mes-, or a wall-family suffix) and tier = its code (exclusive): no older room
can roll any of them. Thin things are designed STOUT; a room's read comes from a few big pieces seen from above."""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[1]
MAIN = Path('<repo>')
STYLE_REF = str(MAIN / 'style-references/heroic-handpainted-tavern-v1.png')
CODES = {'nrs': ('NRS', 'norse-steading', 'Norse steading'), 'mde': ('MDE', 'middle-east', 'Middle East (Mamluk)'),
         'rus': ('RUS', 'rus-medieval', "Medieval Rus'"), 'mes': ('MES', 'mesoamerica', 'Mexica (Aztec)')}
T = []

STOUT = (' Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man\'s arm;'
         ' nothing thin, no wire, no string, no loose dangling parts.')
FEW = ' The things on it are FEW and BIG, packed tight as solid masses (nothing tiny, nothing floating).'
COLD = ' It is COLD and UNLIT: dull charcoal and pale ash, NO flames, NO glow, NO smoke (the game adds the fire).'
UNLIT = ' It is UNLIT: NO flames, NO glow (the game adds the light).'
LEAFY = (' Foliage is a FEW big solid masses with broad leaf shapes painted on them, never separate thin leaves or twigs;'
         ' no gaps you can see through, nothing floating free.')


def P(code, sku, place, fp, size, mat, desc, hint, design, see, rooms, aff='-', pri='P1', flags=(), obj=None, light=None, view=None):
    """A new prop. `see`: what a blind judge should call it (the plate gate's words)."""
    T.append(dict(id=sku, obj=obj or sku, code=code, kind='prop', place=place, fp=fp, size=list(size), mat=mat, desc=desc, hint=hint,
                  design=design, see=see, rooms=rooms, aff=aff, pri=pri, flags=list(flags) + ([f'light:{light}'] if light else []), view=view))


def WALL(code, fam, piece, design, see, parent=None, shape=''):
    sku = f'{piece}--{fam}' + (f'--{shape}' if shape else '')
    T.append(dict(id=sku, obj=piece, code=code, kind='wall', family=fam, shape=shape, place='kit', fp='edge', size=[60, 12, 108], mat='mixed',
                  design=design, see=see, parent=parent, rooms=['*']))

# =====================================================================================================================
# NORSE STEADING (NRS): Viking-Age Scandinavia, c. 800-1050
N = 'nrs'; LH, MH, SM, BH, YD, WV = 'nrs-longhouse', 'nrs-meadhall', 'nrs-smithy', 'nrs-boathouse', 'nrs-yard', 'nrs-weaving'
WALL(N, 'norse-stave', 'wall-straight',
     'ONE straight wall section of a Viking-Age hall: a row of thick UPRIGHT split-log STAVES standing edge to edge, weathered grey-brown oak with warm honey highlights on'
     ' their rounded faces, set into a heavy horizontal SILL BEAM along the very bottom and capped by a heavy WALL PLATE beam along the very top. The wall plate'
     ' carries ONE broad carved band of interlaced tendrils and ribbon-beasts (Viking Mammen / Ringerike style), deep-carved, the grooves picked out in faded red ochre.'
     ' Nothing else: no windows, no posts standing proud, no shields or decoration hung on it.',
     'a wall section of vertical dark timber planks with a carved band at the top')
WALL(N, 'norse-stave', 'wall-straight', 'The same wall with ONE thick round roof-support post set into the middle of the stave row, its face carved from top to'
     ' bottom with a single long interlaced beast in deep relief; the staves either side unchanged.', 'a wall section of vertical timber with a carved post in the middle',
     parent='wall-straight--norse-stave', shape='s2')
WALL(N, 'norse-stave', 'wall-doorway', 'The same wall with an EMPTY door opening through it from the very bottom: about 3.5 ft wide and 6 ft tall (Norse doors are low),'
     ' framed by two massive carved door jambs whose faces are covered in deep interlaced-beast carving, under a heavy plain lintel. NO door leaf, NO hinges,'
     ' NO step. Wall remains each side and above the opening; you can see straight through the opening.', 'a timber wall section with a carved doorway',
     parent='wall-straight--norse-stave')
P(N, 'nrs-long-hearth', 'floor', '1x3', (132, 42, 14), 'stone', 'long stone-lined hearth', 'the middle of a longhouse or hall, down its length',
  'A Viking longhouse LONG HEARTH: a long low rectangular fire bed about 11 ft long and 3.5 ft wide, edged all round with a kerb of rounded grey fieldstones set'
  ' on edge, the bed inside filled with pale grey ash, a few half-burnt dark logs lying along it and black charcoal. Seen from above it is a long grey stone'
  ' rectangle.' + COLD, 'a long rectangular stone-edged fire pit with ash and logs', [LH, MH, WV], aff='hazard', light='hearth', view='top')
P(N, 'nrs-sleeping-platform', 'floor', '1x2', (120, 48, 26), 'wood', 'raised sleeping platform with fleeces', 'along the long walls of a longhouse',
  'A Viking longhouse wall bench: a long, low, broad raised platform about 10 ft long, 4 ft deep and knee high, built of thick dark timber planks on a heavy'
  ' timber kerb, its top heaped with thick pale sheepskin fleeces, a brown cow hide and a rolled woollen blanket in faded red and ochre stripes. It is a place to'
  ' sit by day and sleep by night: no headboard, no posts, no canopy.' + STOUT, 'a long low wooden platform covered with fleeces and blankets', [LH, MH, WV], aff='sit,sleep')
P(N, 'nrs-high-seat', 'floor', '1', (48, 36, 84), 'wood', "the chieftain's high seat between its carved pillars", "the middle of a hall's long wall, facing the hearth",
  "A Viking chieftain's HIGH SEAT: a broad heavy wooden chair with a tall straight back and solid arms, standing on a low wooden step, between two TALL carved"
  ' high-seat pillars rising well above it, each pillar carved with interlaced beasts and topped by a carved beast head. A thick fleece over the seat, the'
  ' wood dark with faded red ochre in the carving.' + STOUT, 'a carved wooden throne between two tall carved posts', [MH], aff='sit')
P(N, 'nrs-loom', 'floor', '1', (60, 30, 78), 'wood', 'warp-weighted loom with cloth half woven', 'by the door of a longhouse, where the light is',
  'A Viking WARP-WEIGHTED LOOM: two thick upright wooden posts leaning back slightly against a wall, a thick round cloth beam across their tops, and between'
  ' them a broad SOLID sheet of half-woven woollen cloth in bands of red, ochre and natural cream, hanging down to a row of fat round grey clay loom weights at'
  ' the bottom, packed together in one solid row. Treat the warp as one continuous cloth surface: no separate threads, no gaps.' + STOUT,
  'an upright wooden loom with striped cloth and a row of round stones at the bottom', [LH, WV], aff='use', flags=['against-wall'])
P(N, 'nrs-sea-chest', 'floor', 'sub', (40, 20, 22), 'wood', 'Norse sea chest with iron bands', 'at the foot of a sleeping platform; one per crewman in a boathouse',
  'A Viking sea chest: a stout rectangular oak chest with a gently sloped (trapezoid) lid, bound with broad black iron straps and a big iron lock plate, the'
  ' wood honey-brown and worn. Closed.' + STOUT, 'a wooden chest with iron straps', [LH, MH, BH], aff='loot,sit')
P(N, 'nrs-shield-row', 'wall', '1', (72, 8, 34), 'wood', 'row of painted round shields hung on a board', 'on the walls of a mead hall',
  'Three Viking ROUND SHIELDS, each about 3 ft across, hung OVERLAPPING in a row on one thick plank board: plain wooden boards painted in bold halves and'
  ' quarters of red, cream and ochre, each with a big domed iron boss in its centre and an iron-bound rim. They lie FLAT against the board, fixed along their'
  ' whole backs, nothing projecting.' + STOUT, 'three round painted shields in a row', [MH, BH], aff='-', flags=['hung'])
P(N, 'nrs-runestone', 'ground', '1', (40, 24, 84), 'stone', 'painted runestone', 'the focal stone of a steading yard or a crossroads',
  'A Viking RUNESTONE: one tall upright slab of grey granite, about 7 ft tall, its rounded outline taller than wide, rising from rough ground stones at its foot.'
  ' Carved on its broad face, picked out in RED and black paint: a long ribbon-bodied serpent curling round the edge of the stone in a loop, its body carrying a'
  ' band of small angular rune marks, its head biting its tail at the bottom. No cross, no figures.', 'a tall standing stone carved with a red serpent band',
  [YD], aff='cover')
P(N, 'nrs-boat', 'floor', '2x3', (240, 72, 64), 'wood', 'small clinker-built boat on its stocks', 'the middle of a boathouse; a beach',
  'A small Viking-Age boat (a faering) laid up on land: a narrow clinker-built wooden hull about 20 ft long and 5 ft across, its overlapping strakes (planks)'
  ' honey-brown and tarred dark at the seams, both stem and stern posts rising and curling up high at the ends, three thick plank thwarts across it, the'
  ' inside empty. It rests level on two heavy wooden trestle stocks. Seen from above it is a long pointed hull shape.' + STOUT,
  'a small wooden boat with curled ends resting on two wooden stands', [BH], aff='cover,hide')
P(N, 'nrs-oar-rack', 'floor', '1', (60, 18, 96), 'wood', 'oars racked against the wall', 'along the side wall of a boathouse',
  'A rack of long wooden oars standing almost upright against a wall: eight oars, their broad blades at the bottom, packed tight side by side in one solid'
  ' fan, held by one thick horizontal timber rail across them; pale ash wood, the blades painted red at the tips.' + STOUT,
  'a row of long wooden oars leaning in a rack', [BH], flags=['against-wall'])
P(N, 'nrs-sail-trestle', 'floor', '1x3', (150, 36, 44), 'cloth', 'furled striped sail and yard on trestles', 'the middle or side of a boathouse',
  'A Viking ship\'s sail laid up: a long thick wooden yard (spar) about 12 ft long with the heavy woollen sail furled tightly round it in one fat roll, the'
  ' cloth in broad stripes of red and cream, lying across two stout wooden trestles.' + STOUT, 'a rolled red and white striped sail lying on two trestles', [BH])
P(N, 'nrs-fish-rack', 'ground', '1x2', (96, 42, 72), 'wood', 'fish-drying rack hung with stockfish', 'a steading yard by the shore',
  'A Norse fish-drying rack (hjell): a stout A-frame of thick grey weathered poles about 8 ft long, with two horizontal rails, and over the rails hang PAIRS of'
  ' split dried cod (stockfish), pale silver-grey and flat, packed close in solid rows.' + STOUT, 'a wooden rack hung with dried fish', [YD, BH])
P(N, 'nrs-forge', 'floor', '2x2', (60, 48, 40), 'stone', 'Norse forge with a stone bellows-shield', 'the heart of a Norse smithy',
  'A Viking-Age smith\'s forge: a low rectangular hearth of grey fieldstones and clay, knee to thigh high, its top a shallow bed of black charcoal. At its back'
  ' stands one flat upright SLAB of soapstone (the bellows shield) with a round hole near its foot, and behind the slab lie two fat leather bag-bellows on a'
  ' wooden board.' + COLD + STOUT, 'a low stone fire hearth with an upright stone slab and leather bellows behind', [SM], aff='hazard', light='brazier')
P(N, 'nrs-wool-baskets', 'floor', 'sub', (36, 24, 26), 'organic', 'baskets of raw wool and spindles', 'by the loom in a weaving hut or longhouse',
  'Two round woven wicker baskets side by side, one heaped high with fluffy cream raw wool, the other with balls of spun yarn in red, ochre and brown and two'
  ' fat wooden drop spindles with round whorls lying on top.' + FEW, 'two baskets of wool and yarn', [LH, WV])
P(N, 'nrs-quern', 'floor', 'sub', (30, 30, 24), 'stone', 'rotary hand quern on a wooden box', 'a longhouse corner; the weaving hut',
  'A Viking rotary hand QUERN: two thick round grey millstones stacked one on the other, the upper with a hole in its centre and a stout upright wooden'
  ' handle near its edge, sitting on a low square wooden box half full of coarse flour.' + STOUT, 'a pair of round grinding stones on a wooden box', [LH, WV], aff='use')
P(N, 'nrs-spear-rack', 'floor', '1', (48, 18, 84), 'wood', 'rack of spears and bearded axes', 'by the door of a hall; a smithy',
  'A stout wooden weapon rack standing against a wall: a heavy timber frame holding five upright ash-wood spears with broad leaf-shaped iron heads and two'
  ' long-hafted bearded axes, packed tight side by side, held by thick rails. Iron dark grey.' + STOUT, 'a wooden rack of upright spears and axes',
  [MH, SM], flags=['against-wall'])

# =====================================================================================================================
# MIDDLE EAST (MDE): medieval Islamic Near East (Mamluk Cairo / Damascus / Aleppo), 13th-16th c.
M = 'mde'; CY, SQ, HM, AU, CF, GD = 'mde-courtyard', 'mde-souk', 'mde-hammam', 'mde-audience', 'mde-coffee', 'mde-garden'
WALL(M, 'mde-plaster', 'wall-straight',
     'ONE straight wall section of a Mamluk-era stone house in Cairo or Damascus: a smooth wall of warm CREAM lime plaster over stone, standing on three courses'
     ' of ABLAQ masonry at its foot (broad horizontal stone courses alternating dark charcoal-grey and warm honey-cream), and just under the very top one'
     ' carved band of geometric interlace (eight-pointed stars) in the plaster. Nothing else: no windows, no arches, no lamps, no tiles, no writing.', 'a cream plaster wall section with dark and light striped stone at its foot')
WALL(M, 'mde-plaster', 'wall-straight', 'The same wall dressed for a richer house: a band of glazed geometric TILE (turquoise, white and deep green star pattern), about 1 ft tall, runs above the'
     ' striped stone, and ONE shallow pointed-arch NICHE is recessed into the plaster above it, its hood carved with a small fan of stepped honeycomb'
     ' (muqarnas) cells; the niche is empty.', 'a striped stone and plaster wall with a pointed niche', parent='wall-straight--mde-plaster', shape='s2')
WALL(M, 'mde-plaster', 'wall-doorway', 'The same wall with an EMPTY door opening from the very bottom, about 3.5 ft wide and 7 ft tall, under a POINTED ARCH'
     ' whose arch stones (voussoirs) alternate dark charcoal and honey-cream. NO door leaf, NO hinges, NO step. You can see straight through the opening.',
     'a wall section with a striped pointed-arch doorway', parent='wall-straight--mde-plaster')
WALL(M, 'mde-plaster', 'wall-window-small', 'The same wall with ONE window in its upper half, about 3 ft wide and 4 ft tall, filled flush with a MASHRABIYA:'
     ' a fine-looking but THICK lattice screen of turned dark-brown wooden spindles in a dense grid, set in a wooden frame. The lattice is solid enough to read'
     ' as one carved wooden panel.', 'a wall section with a carved wooden lattice window', parent='wall-straight--mde-plaster')
P(M, 'mde-wall-basin', 'floor', 'sub', (36, 24, 36), 'stone', 'marble wall basin with a brass bowl', 'along the walls of a hammam',
  'A hammam wall basin (kurna): a thick carved white marble basin about waist high, its front carved with a shallow arch, a stout brass spout above it on a'
  ' marble back plate, and a hammered brass bathing bowl resting on its rim. DRY and empty (the game adds water).', 'a carved marble basin with a brass bowl',
  [HM], flags=['against-wall'])
P(M, 'mde-divan', 'floor', '1', (60, 30, 30), 'cloth', 'built-in divan bench with mattress and bolsters', 'along the walls of a reception hall or coffee house',
  'One section of a DIVAN: a low broad built-in bench of plastered masonry along a wall, about 5 ft long and knee high, covered by a thick flat mattress in'
  ' woven red and ochre striped cloth, with three fat bolster cushions in dusty teal and cream leaning against the back. No legs, no back frame.' + STOUT,
  'a low cushioned bench with bolster pillows', [AU, CF], aff='sit,sleep', flags=['against-wall'])
P(M, 'mde-tray-table', 'floor', 'sub', (30, 30, 18), 'metal', 'low round brass tray table with cups', 'between the divans of a coffee house',
  'A low round TRAY TABLE: a big round engraved brass tray about 2.5 ft across on a short, stout octagonal wooden stand inlaid with pale bone; on the tray a'
  ' round copper coffee pot and four small handleless cups.' + FEW, 'a low round brass tray table with a coffee pot and cups', [CF, AU], aff='use')
P(M, 'mde-coffee-brazier', 'floor', 'sub', (36, 30, 34), 'metal', 'coffee brazier with long-spouted pots', 'the coffee-maker\'s corner of a coffee house',
  "A coffee-maker's hearth of 16th-century Cairo: a square raised brass-bound BRAZIER box on four short stout legs, its top a bed of charcoal, with TWO big"
  ' round-bellied tinned-copper boiling pots with straight spouts standing on it, a long-handled iron roasting pan and a stack of small handleless cups beside them.' + COLD,
  'a brass brazier with two big copper pots on it', [CF], light='brazier')
P(M, 'mde-dais', 'floor', '2x2', (108, 72, 30), 'cloth', 'raised carpeted dais with bolsters', 'the far end of an audience hall',
  'A raised IWAN platform of a Mamluk reception hall (qa\'a), as a piece: a broad low platform of dark wood with an inlaid geometric border, about 9 ft wide, 6 ft deep and 1.5 ft high, covered with a deep'
  ' red patterned carpet hanging over its front, with a row of fat bolster cushions and a big square seat cushion in gold and teal brocade along its back.'
  + STOUT, 'a raised platform with a red carpet and cushions', [AU], aff='sit')
P(M, 'mde-bales', 'floor', '1', (60, 36, 40), 'cloth', 'corded bales of cloth goods', 'a caravanserai courtyard; a merchant\'s store',
  'A heap of three big trade BALES: tight cloth-wrapped bundles of goods in coarse undyed and indigo-striped sacking, bound with thick crossed ropes, stacked'
  ' two below and one on top.' + FEW, 'a stack of rope-tied cloth bundles', [CY, SQ], aff='cover,loot')
P(M, 'mde-saddle-packs', 'floor', 'sub', (48, 30, 30), 'cloth', 'pile of camel saddlebags and packs', 'a caravanserai courtyard, where the caravan unloaded',
  'A pile of caravan PACK GEAR set down on the ground: two big woven saddlebags in red, black and cream geometric kilim weave with fat tassels, a rolled'
  ' blanket and a wooden pack-saddle frame lying across them.' + FEW, 'a pile of woven saddlebags and a pack saddle', [CY])
P(M, 'mde-water-jar', 'floor', 'sub', (24, 24, 50), 'ceramic', 'tall water jar on a stand', 'a courtyard; a hammam\'s cool room',
  'A tall unglazed terracotta water JAR (zir), pale buff clay with a few incised wavy bands, its pointed bottom set into a stout square wooden stand, a'
  ' round wooden lid on its mouth and a brass dipper hanging from the stand.' + STOUT, 'a tall clay water jar on a wooden stand', [CY, HM, GD])
P(M, 'mde-merchant-platform', 'floor', '1x2', (84, 36, 34), 'wood', "the merchant's raised platform-counter", 'the front of a souk shop', obj='counter-shop',
  design='A souk shop\'s COUNTER: a broad raised wooden platform about 7 ft long and knee-to-waist high where the merchant sits cross-legged among his goods,'
  ' its front of carved wooden panels in a geometric lattice, its top covered with a small red rug, a bolster at the back, a brass balance scale and a few'
  ' brass bowls on it.' + STOUT, see='a raised wooden shop platform with a rug, a scale and brass bowls', rooms=[SQ], aff='use')
P(M, 'mde-niche-shelf', 'floor', '1', (60, 18, 72), 'mixed', 'niche shelves of brass and copper wares', 'the back wall of a souk shop', obj='shop-shelf-stocked',
  design='A tall shop shelf unit of dark wood built like a set of plastered wall niches with pointed tops, three rows, every niche packed with gleaming brass'
  ' and copper wares: ewers with long spouts, engraved trays standing on edge, pierced lanterns, bowls and pitchers, all big and chunky.' + FEW,
  see='a tall shelf full of brass and copper pots, trays and lanterns', rooms=[SQ], flags=['against-wall'])
P(M, 'mde-spice-sacks', 'floor', '1', (54, 30, 26), 'organic', 'open sacks heaped with spices', 'the floor of a souk shop', obj='shop-floor-stock',
  design='A row of four open hessian sacks with their mouths rolled down, each heaped to a cone above the rim with one ground spice: deep red-orange paprika,'
  ' golden turmeric, dark brown cumin and green dried herbs, a little brass scoop stuck in one.' + FEW, see='open sacks heaped with colourful spice powders',
  rooms=[SQ])
P(M, 'mde-carpet-stack', 'floor', '1', (60, 36, 30), 'cloth', 'stack of folded and rolled carpets', 'a souk shop; a merchant\'s store', obj='craft-display-table-goods',
  design='A low wooden platform stacked with folded pile carpets, their patterned edges showing in deep red, indigo, ochre and cream, with two fat carpet ROLLS'
  ' lying across the top.' + FEW, see='a stack of folded and rolled patterned carpets', rooms=[SQ, CY])
P(M, 'mde-inlaid-chest', 'floor', 'sub', (42, 22, 26), 'wood', 'chest inlaid with bone and mother-of-pearl', 'a reception room; a merchant\'s house',
  'A dark walnut wooden CHEST with a flat lid, its front and lid covered in a geometric star-pattern inlay of pale bone and mother-of-pearl, with brass corner'
  ' fittings. Closed.' + STOUT, 'a dark wooden chest with a pale geometric inlay', [AU, SQ], aff='loot')

# =====================================================================================================================
# MEDIEVAL RUS' (RUS): Novgorod / Vladimir-Suzdal / Muscovy, 11th-16th c.
R = 'rus'; IZ, TE, BA, CH, MR, ST = 'rus-izba', 'rus-terem', 'rus-banya', 'rus-church', 'rus-market', 'rus-yard'
WALL(R, 'rus-log', 'wall-straight',
     'ONE straight wall section of a Russian log house (izba): thick round pine LOGS laid HORIZONTALLY one on another, about nine logs high, warm golden-brown'
     ' with darker grey-brown weathering, moss packed in the seams between them, the log ends at both side edges cut flush. Along the very top runs a carved'
     ' plank band with a row of pierced half-round scallops and painted red and green stripes. Nothing else: no window, no door.',
     'a log wall section of horizontal round logs with a carved board at the top')
WALL(R, 'rus-log', 'wall-straight', 'The same log wall with one carved wooden wall-post (a thick upright plank) fixed on its face in the middle, carved with'
     ' a stack of rosettes and painted in faded red and green.', 'a log wall with a carved painted plank on it', parent='wall-straight--rus-log', shape='s2')
WALL(R, 'rus-log', 'wall-doorway', 'The same log wall with an EMPTY door opening from the very bottom, about 3.5 ft wide and 6.5 ft tall, framed by two thick'
     ' squared jamb posts and under a broad carved LINTEL BOARD shaped like a low peaked gable, pierced with a row of scallops and painted red, green and ochre.'
     ' NO door leaf, NO hinges, NO step. You can see straight through the opening.', 'a log wall with a carved doorway', parent='wall-straight--rus-log')
WALL(R, 'rus-log', 'wall-window-small', 'The same log wall with ONE small window in its upper half, about 2 ft wide and 2.5 ft tall, closed by a casement of'
     ' small pale amber MICA panes in a lead grid, in a plain thick plank frame with a simple carved top board (restrained, unpainted wood).', 'a log wall with a small window', parent='wall-straight--rus-log')
P(R, 'rus-stove', 'floor', '2x2', (60, 72, 66), 'stone', 'great whitewashed Russian stove', 'the corner by the door of an izba',
  'A great RUSSIAN STOVE (pech): a huge solid block of WHITE-WASHED clay and brick about 6 ft wide, 7 ft long and 6.5 ft tall, its flat top a broad sleeping'
  ' ledge with a folded red-and-white woven blanket on it, its front with one arched dark oven MOUTH at waist height with a plank shutter leaning beside'
  ' it and two small arched niches below; NO chimney (the smoke leaves by a vent in the wall), the top front edge smoke-darkened.' + COLD,
  'a very large white clay oven block with an arched mouth', [IZ], aff='climb,sleep', light='oven')
P(R, 'rus-icon-corner', 'wall', 'sub', (30, 8, 34), 'wood', "the beautiful corner: icon shelf with a lamp", 'the corner diagonal from the stove, over the table',
  'An Orthodox home ICON SHELF (the "beautiful corner"): a carved wooden corner shelf with a small peaked canopy, holding two small painted icon panels of'
  ' haloed saints in gold, red and green, a hanging red glass oil lamp (unlit) in front of them on a short chain-free bracket, and an embroidered white'
  ' towel (rushnik) with red ends draped over the top. Painted with respect: calm faces, gold halos.' + UNLIT, 'a small wooden shelf with two painted icons and a red lamp',
  [IZ, TE], flags=['hung'])
P(R, 'rus-tiled-stove', 'floor', '1', (54, 48, 96), 'ceramic', 'tiled stove of glazed relief tiles', 'the corner of a terem chamber',
  'A late-16th-century Muscovite TILED STOVE: a tall square stove about 8 ft tall built of GREEN-glazed relief tiles, each tile a simple raised rosette,'
  ' with a stepped cornice at the top, a small arched iron fire door low at the front.' + COLD, 'a tall stove of green glazed tiles',
  [TE], light='oven')
P(R, 'rus-high-chair', 'floor', 'sub', (36, 30, 66), 'wood', "a boyar's carved high-backed chair", "the head of the table in a terem",
  "A boyar's high-backed CHAIR: a heavy carved wooden armchair with a tall straight back topped by a carved peaked crest, its back and arms carved with"
  ' interlaced vines and painted red, green and gold, a red cushion on the seat.' + STOUT, 'a tall carved and painted wooden chair', [TE], aff='sit')
P(R, 'rus-chest', 'floor', 'sub', (44, 24, 28), 'wood', 'painted chest (sunduk) with iron straps', 'by the bench of an izba; a terem',
  "A Rus' storage chest: a stout oak chest with a flat lid, bound with black iron straps in a lattice and a big iron lock plate, the wood stained a deep"
  ' red-brown. Closed.' + STOUT, 'a red-brown wooden chest with iron straps', [IZ, TE], aff='loot,sit')
P(R, 'rus-iconostasis', 'floor', '1x2', (104, 22, 104), 'wood', 'iconostasis screen section with central doors', 'across the east end of an Orthodox church',
  'A section of an Orthodox ICONOSTASIS (icon screen), about 10 ft wide and 8.5 ft tall: a carved and gilded wooden screen holding TWO tiers of painted icon'
  ' panels side by side, tall saints in the lower tier and smaller ones above, each with a gold halo and calm face in red, green and blue robes on gold'
  ' ground, in the manner of 15th-century Novgorod icons (the upper tier a Deesis row: Christ enthroned in the centre, the Virgin and St John the Baptist'
  ' turned toward him); in the middle of the lower tier a pair of carved gilded double doors with an arched top (the Royal Doors), shut. Reverent and orderly.'
  + STOUT, 'a wide gilded wooden screen of painted saint icons with doors in the middle', [CH], aff='block')
P(R, 'rus-lectern', 'floor', 'sub', (24, 24, 50), 'wood', 'lectern (analoy) with an icon', 'before the iconostasis in a church',
  'An Orthodox ANALOY: a tall narrow wooden lectern with a sloping top, draped with a gold-embroidered cloth that hangs down all four sides, one small painted'
  ' icon of a haloed saint lying on the sloping top.' + STOUT, 'a tall cloth-draped stand with a small icon on top', [CH])
P(R, 'rus-banya-heater', 'floor', '1', (48, 48, 48), 'stone', 'banya heater: stones heaped over a firebox', 'the corner of a banya',
  'A Russian BANYA heater (kamenka): a squat square firebox of rough grey stones and clay, waist high, its top heaped high with a mound of round dark grey'
  ' rocks, a small dark arched stoke hole in front, a wooden bucket and a long-handled wooden ladle beside it.' + COLD, 'a stone heater with a heap of rocks on top',
  [BA], light='oven', aff='hazard')
P(R, 'rus-banya-shelf', 'floor', '1x2', (96, 42, 54), 'wood', 'tiered steaming shelf (polok)', 'along the wall of a banya',
  'A banya steaming SHELF (polok): two broad tiers of thick pale linden planks stepping up along a wall like a wide bench and a higher bench above it, on stout'
  ' squared legs, about 8 ft long, the wood pale and steam-worn.' + STOUT, 'a two-step wooden bench', [BA], aff='sit,sleep', flags=['against-wall'])
P(R, 'rus-besom-rack', 'wall', 'sub', (40, 8, 30), 'organic', 'birch besoms hung on pegs', 'the wall of a banya',
  'A plank board with a row of four BIRCH BESOMS (venik) hanging from thick wooden pegs: each a fat bundle of leafy birch twigs, bound at the handle, the'
  ' leaves dried olive-green as one solid mass.' + LEAFY, 'bundles of leafy twigs hanging on a board', [BA], flags=['hung'])
P(R, 'rus-sledge', 'ground', '1x2', (96, 42, 36), 'wood', 'wooden sledge', 'a stockade yard in winter; a barn',
  'A Russian wooden SLEDGE: two thick curved wooden runners turned up at the front, a slatted wooden bed on short posts, the front bow painted red with a'
  ' simple flower, a rolled sheepskin on the bed.' + STOUT, 'a wooden sledge with curled runners', [ST])
P(R, 'rus-well-sweep', 'ground', '1x2', (156, 60, 168), 'wood', 'well-sweep over a log well-head', 'the middle of a stockade yard',
  'A Russian WELL-SWEEP (zhuravl): a square log WELL-HEAD of stacked logs, waist high, with a plank lid; beside it a thick forked upright post 10 ft tall'
  ' carrying a long THICK lever pole pivoted across its fork, a heavy stone tied to its short end near the ground and a wooden bucket hanging on a stout'
  ' pole from its long end over the well.' + STOUT, 'a log well with a tall lever pole and bucket', [ST], aff='use')
P(R, 'rus-palisade', 'kit', 'edge', (60, 18, 120), 'wood', 'pointed-log palisade section', 'round a stockade yard (its edge)',
  'One 5-ft section of a log PALISADE: five thick upright pine logs standing side by side, their tops sharpened to points, about 10 ft tall, bound by one'
  ' heavy horizontal rail across their backs, golden-brown weathered wood; both side edges cut clean so sections butt together.' + STOUT,
  'a section of a fence of upright pointed logs', [ST], aff='block,cover')
P(R, 'rus-fur-bundles', 'floor', '1', (54, 30, 32), 'organic', 'bundles of furs and pelts', 'a market row stall; a merchant\'s store', obj='shop-floor-stock',
  design='A heap of fur trade goods: four fat bundles of pelts tied with cord, sable dark brown, fox red, squirrel grey and white ermine, stacked on a low'
  ' plank pallet with two loose pelts draped over them.' + FEW, see='a heap of fur bundles', rooms=[MR])
P(R, 'rus-stall-counter', 'floor', '1x2', (84, 30, 38), 'wood', 'market stall counter of carved planks', 'the front of a market row stall', obj='counter-shop',
  design='A market STALL COUNTER: a long heavy plank counter about 7 ft long and waist high on thick posts, its front boards carved with a row of scallops and'
  ' painted red and green, on its top a wooden balance scale, a stack of birch-bark boxes and two round cakes of yellow beeswax.' + STOUT,
  see='a wooden counter with scales, boxes and wax', rooms=[MR], aff='use')
P(R, 'rus-wares-shelf', 'floor', '1', (60, 18, 72), 'wood', 'shelf of honey pots, wax and birch-bark boxes', 'the back of a market row stall', obj='shop-shelf-stocked',
  design='A tall open plank SHELF of three shelves packed with goods: round clay honey pots tied with cloth, big round yellow beeswax cakes, cylindrical'
  ' birch-bark boxes (pale with dark bands), coils of rope and a few wooden spoons and bowls.' + FEW, see='a tall shelf of pots, wax cakes and bark boxes',
  rooms=[MR], flags=['against-wall'])

# =====================================================================================================================
# MESOAMERICA (MES): Late Postclassic Nahua (Mexica Tenochtitlan / Tlatelolco), c. 1400-1520
X = 'mes'; SH, BC, NH, MK, CN, SC = 'mes-shrine', 'mes-ballcourt', 'mes-house', 'mes-market', 'mes-chinampa', 'mes-scribe'
WALL(X, 'mes-stucco', 'wall-straight',
     'ONE straight wall section of a Mexica (Aztec) stone building: thick masonry covered in smooth CREAM-WHITE lime STUCCO, a broad band of rich RED-painted'
     ' stucco along the lower 2 ft and a narrow red band under a plain projecting stone coping at the top. Nothing else: no window, no door, no figures, no writing.', 'a white plaster wall with a red base band')
WALL(X, 'mes-stucco', 'wall-straight', 'The same wall with, in its middle, a painted MURAL panel above the red band: a procession of stylised maize plants and'
     ' flowers in green, ochre and red on the white, framed by a red border.', 'a white wall with a painted mural of plants', parent='wall-straight--mes-stucco', shape='s2')
WALL(X, 'mes-stucco', 'wall-doorway', 'The same wall with an EMPTY doorway from the very bottom, about 4 ft wide and 6.5 ft tall, under a heavy squared stone'
     ' LINTEL, the jambs painted red. NO door leaf, NO curtain,'
     ' NO hinges. You can see straight through the opening.', 'a white plastered wall with a square doorway', parent='wall-straight--mes-stucco')
P(X, 'mes-chacmool', 'floor', '1', (60, 30, 36), 'stone', 'chacmool offering figure', 'the entrance of a temple summit shrine',
  'A CHACMOOL: a Mesoamerican stone sculpture of a reclining figure lying on its back with knees raised, propped on its elbows, its head turned to face the'
  ' side, holding a round shallow stone dish on its stomach (an offering vessel) with a few yellow marigold flowers in it; carved from grey stone with traces'
  ' of red and blue-green paint. Calm and dignified.', 'a stone statue of a reclining figure holding a dish', [SH])
P(X, 'mes-altar', 'floor', '1x2', (84, 42, 36), 'stone', 'stone altar with offerings', 'the far wall of a temple shrine',
  'A Mexica stone ALTAR: a broad low rectangular block of grey stone, its sides carved with a band of stepped fret and painted red and ochre, its top laid'
  ' with OFFERINGS: ears of yellow and red maize, a heap of orange marigold flowers, painted clay bowls and a three-legged clay incense burner with a lump'
  ' of white copal resin. No blood, no knife, nothing grim.', 'a stone altar covered with maize, flowers and bowls', [SH], aff='use')
P(X, 'mes-brazier', 'floor', 'sub', (36, 36, 54), 'ceramic', 'great painted ceramic brazier', 'flanking the altar of a shrine; a palace hall',
  'A great Mexica ceramic BRAZIER: a big round fired-clay brazier bowl on a tall flaring pedestal, waist high, painted ochre with a band of red and black'
  ' geometric pattern and two big knobs on its rim, its bowl filled with black charcoal.' + COLD, 'a large painted clay fire bowl on a pedestal',
  [SH, NH], light='brazier', aff='hazard')
P(X, 'mes-court-wall', 'ground', '2x3', (120, 72, 72), 'stone', 'ballcourt sloping bench wall section', 'the two long sides of a ballcourt',
  'One 10-ft section of a Mesoamerican BALLCOURT side: a long massive stone BENCH with a steeply SLOPING face toward the playing alley, rising to a short'
  ' vertical wall at the back, plastered smooth and painted cream-white with a red band along the foot of the slope.' + STOUT,
  'a long stone bench with a sloping face', [BC], aff='block,cover,climb')
P(X, 'mes-court-ring', 'ground', '2x3', (120, 72, 96), 'stone', 'ballcourt wall section with the stone ring', 'the middle of each long side of a ballcourt',
  'The same ballcourt side section: a long stone bench with a steeply SLOPING plastered face rising to a vertical wall at the back, and set HIGH in the'
  ' middle of that wall a big carved STONE RING standing upright (its hole facing across the court), the ring carved with a band of feathers; cream-white'
  ' plaster with a red band at the foot.' + STOUT, 'a sloping stone wall with a big stone ring set upright in it', [BC], aff='block,cover')
P(X, 'mes-icpalli', 'floor', 'sub', (32, 30, 40), 'organic', "a lord's backed seat of woven reeds (icpalli)", "the far wall of a noble's house",
  "A Mexica lord's SEAT (icpalli): a low seat of tightly woven golden reeds with a high slanted back, the back taller than the seat is wide, covered with a"
  ' spotted jaguar-pattern cloth (painted, not real fur) over the seat and a woven cotton border in red.' + STOUT, 'a low woven reed seat with a high back',
  [NH, SC], aff='sit')
P(X, 'mes-reed-chest', 'floor', 'sub', (40, 24, 22), 'organic', 'woven reed chest (petlacalli)', "a noble's house; a scribe's room",
  'A Mexica PETLACALLI: a rectangular lidded chest woven of golden reed matting in a twill pattern with a dark red woven border, tied shut with a thick cotton'
  ' cord.' + STOUT, 'a woven reed box with a lid', [NH, SC], aff='loot')
P(X, 'mes-metate', 'floor', 'sub', (30, 18, 14), 'stone', 'grinding stone (metate) with mano', 'the kitchen side of a house',
  'A Mesoamerican METATE: a slab of grey volcanic basalt on three short stout legs, its top dished, sloping toward the front, with a long cylindrical stone'
  ' MANO (hand stone) lying across it and a little heap of yellow maize dough on the slab.' + STOUT, 'a stone grinding slab on three legs with a stone roller',
  [NH], aff='use')
P(X, 'mes-comal-hearth', 'floor', 'sub', (36, 36, 14), 'ceramic', 'three-stone hearth with a clay griddle (comal)', 'the cooking place of a house',
  'A Mesoamerican HEARTH: three rounded grey hearthstones set in a triangle on the ground holding a big round flat clay griddle (comal), with three'
  ' tortillas on it and a little black charcoal under it, a clay cooking pot beside the stones.' + COLD, 'three stones holding a round flat clay griddle',
  [NH], light='hearth')
P(X, 'mes-water-jar', 'floor', 'sub', (26, 26, 34), 'ceramic', 'painted water jar on a ring stand', 'a house; a courtyard',
  'A big round-bellied Mexica water JAR of orange fired clay painted with black and cream bands and a stepped-fret band round the shoulder, with a narrow'
  ' neck, sitting on a thick woven reed ring.' + STOUT, 'a round painted clay water jar', [NH, SC, MK])
P(X, 'mes-spread-maize', 'floor', '1', (54, 54, 22), 'organic', "a vendor's mat heaped with maize", 'a market plaza, in rows',
  "A market VENDOR'S SPREAD: a square woven reed mat on the ground with goods on it: two big round baskets heaped with yellow and red ears of maize, a heap of"
  ' loose dried maize cobs and a basket of black beans.' + FEW, 'a mat on the ground with baskets of maize', [MK, CN])
P(X, 'mes-spread-chilies', 'floor', '1', (54, 54, 20), 'organic', "a vendor's mat of chilies, beans and squash", 'a market plaza, in rows',
  "A market VENDOR'S SPREAD: a square reed mat on the ground with low baskets heaped with bright RED dried chili peppers, brown beans and pale green squash"
  ' gourds, with a small pyramid of squash at one corner.' + FEW, 'a mat with baskets of red chilies, beans and squash', [MK])
P(X, 'mes-spread-pottery', 'floor', '1', (54, 54, 28), 'ceramic', "a potter's spread of jars and bowls", 'a market plaza, in rows',
  "A market VENDOR'S SPREAD: a square reed mat on the ground set out with orange and black painted clay pots, tripod bowls, griddles stacked on edge and"
  ' two big jars, arranged in tight groups.' + FEW, 'a mat with painted clay pots and bowls', [MK])
P(X, 'mes-spread-cloth', 'floor', '1', (54, 54, 22), 'cloth', "a weaver's spread of cotton mantles", 'a market plaza, in rows',
  "A market VENDOR'S SPREAD: a square reed mat on the ground with folded cotton mantles (tilmatli) stacked in neat piles, white with bold red, black and"
  ' ochre geometric borders, and one mantle spread open on top showing its pattern.' + FEW, 'a mat with stacks of patterned folded cloth', [MK])
P(X, 'mes-awning', 'ground', '1x2', (108, 72, 96), 'cloth', 'cotton shade awning on four poles', 'over a vendor\'s spread in a market',
  'A market SHADE AWNING: a flat rectangle of undyed cotton cloth with a red striped border stretched taut on four THICK upright wooden poles about 8 ft tall,'
  ' tied at each corner; nothing under it.' + STOUT, 'a cloth awning on four poles', [MK], pri='P2')
P(X, 'mes-chinampa-bed', 'ground', '1x3', (180, 54, 54), 'organic', 'raised chinampa bed with maize', 'the fields of a chinampa garden, in rows',
  'A CHINAMPA bed: a long raised rectangular garden plot of dark rich earth about 15 ft long and 4.5 ft wide, edged with a woven reed and stake kerb, planted'
  ' with two rows of tall green MAIZE plants with yellow tassels, the plants packed as one solid green mass.' + LEAFY,
  'a long raised garden bed with rows of corn plants', [CN])
P(X, 'mes-canoe', 'ground', '1x2', (168, 36, 22), 'wood', 'dugout canoe (acalli)', 'the canal of a chinampa garden',
  'A Mexica dugout CANOE (acalli): a long narrow flat-bottomed boat carved from one log, about 14 ft long, square-ended and low, honey-brown wood, a long'
  ' wooden pole and a paddle lying in it with a basket of maize.' + STOUT, 'a long narrow dugout canoe', [CN])
P(X, 'mes-ahuejote', 'ground', '1', (60, 60, 216), 'organic', 'ahuejote willow tree', 'the edges of chinampa beds',
  'An AHUEJOTE willow: a tall, very narrow upright tree about 18 ft tall, its silvery green foliage one tight slender column from near the ground to the top,'
  ' a short pale trunk at its foot.' + LEAFY, 'a tall narrow willow tree', [CN], pri='P2')
P(X, 'mes-paint-pots', 'floor', 'sub', (30, 24, 14), 'ceramic', "a scribe's paint pots and brushes on a mat", "a scribe's room, beside the codex",
  "A Mexica SCRIBE'S paint set on a small reed mat: six small round clay pots of thick paint (red, black, ochre, white, turquoise, green), a few thick reed"
  ' brushes lying beside them and a stack of folded blank bark paper.' + FEW, 'small pots of coloured paint and brushes on a mat', [SC])

# ---- added after the sensitivity read (reads/sensitivity-codex.md, 2026-11-06)
P(N, 'nrs-roof-post', 'floor', 'sub', (16, 16, 104), 'wood', 'roof-support post of a longhouse', 'two rows down a longhouse or hall, either side of the hearth',
  'One round timber ROOF-SUPPORT POST of a Viking longhouse: a thick round oak post about 9 ft tall and as thick as a man\'s thigh, standing straight on a flat'
  ' foot stone, its top cut square to take a beam, a band of carved interlace round it at head height; weathered grey-brown wood.' + STOUT,
  'a tall thick wooden post', [LH, MH], aff='cover')
P(M, 'mde-floor-fountain', 'floor', '1', (60, 60, 24), 'stone', 'octagonal marble floor fountain', "the middle of a qa'a, a hammam's cool room or a courtyard",
  'A Mamluk FLOOR FOUNTAIN (fisqiya): a low OCTAGONAL basin of white marble set into the floor, knee high, about 5 ft across, its rim and the floor panel round it'
  ' inlaid in a geometric pattern of red, black and white marble, a small stepped marble jet-stand in the middle; the basin holds shallow, pale, LIGHT TEAL water,'
  ' painted flat and clear.', 'a low octagonal marble fountain basin with water', [AU, HM, GD, CY], aff='-', view='top')
P(M, 'mde-hammam-bench', 'floor', '1x2', (96, 36, 22), 'stone', 'marble bench (mastaba) of a bath', 'along the walls of a hammam',
  'A hammam MASTABA: a long low built-in bench of white and pale grey veined marble slabs about 8 ft long and knee high along a wall, its front panelled, a'
  ' folded striped cotton bath towel and a pair of tall wooden bath clogs on it.' + STOUT, 'a long low white marble bench', [HM], aff='sit,sleep', flags=['against-wall'])
P(M, 'mde-arcade', 'kit', 'edge', (60, 72, 132), 'stone', 'khan arcade bay with a storeroom door', 'round the court of a caravanserai (its edge)',
  'One BAY of a caravanserai (khan) arcade, as a building kit piece 5 ft wide: a pointed stone ARCH on two square piers at the front, a short vaulted passage'
  ' behind it about 6 ft deep, and at its back a plain stone wall with one small dark storeroom doorway; honey-coloured limestone with a dark ablaq course,'
  ' a flat roof slab on top. Both side edges cut clean so bays butt together into a long arcade.' + STOUT, 'a stone archway bay with a doorway at the back',
  [CY], aff='cover,block')
P(M, 'mde-arcade-pier', 'kit', 'edge', (24, 24, 132), 'stone', 'square stone pier closing an arcade', 'the corners and ends of a khan arcade',
  'One square stone PIER about 2 ft square and 11 ft tall, honey limestone with a band of dark ablaq stone at its foot and a plain moulded capital at the top.' + STOUT,
  'a tall square stone pillar', [CY], aff='cover')
P(M, 'mde-khan-gate', 'kit', 'edge', (60, 24, 156), 'stone', 'great gateway of a khan', 'the street side of a caravanserai court',
  'The GATEWAY of a caravanserai, as a kit piece 5 ft wide: a tall pointed-arch portal in honey limestone with striped dark and light arch stones, a carved'
  ' band of stepped honeycomb (muqarnas) in its hood, and a pair of heavy wooden gate leaves studded with iron standing wide OPEN against its sides.' + STOUT,
  'a tall stone arched gateway with open wooden gates', [CY], aff='pass')
P(R, 'rus-yard-gate', 'kit', 'edge', (60, 18, 132), 'wood', 'plank gate of a fenced yard, with its little roof', 'the street side of a stockade yard',
  "The GATE of a Rus' fenced yard compound, as a kit piece 5 ft wide: two massive squared gateposts carrying a small pitched plank roof across their tops, and"
  ' between them a pair of heavy plank gate leaves standing OPEN; weathered golden-brown wood, a simple carved board under the little roof.' + STOUT,
  'a wooden gate under a little roof', [ST], aff='pass')
P(X, 'mes-codex-mat', 'floor', '1', (60, 42, 12), 'paper', 'screenfold codex unfolded on a reed mat', "the middle of a scribe's room",
  'A Mexica SCREENFOLD CODEX laid open on the floor: a long strip of white-plastered bark paper folded like a fan, several pages unfolded flat side by side on'
  ' a woven reed mat, a low woven cushion at one side where the painter kneels. The pages are painted in the manner of the Codex Borbonicus: day-sign'
  ' pictures in coloured boxes on white, framed by red guide lines (pictures, no letters).' + FEW, 'a long folded painted book spread open on a mat',
  [SC], aff='use', view='top')

P(X, 'door-curtain--leaf', 'kit', 'edge', (36, 3, 80), 'cloth', 'woven cotton door curtain', 'hangs in a Mexica doorway (no hinged doors)', obj='door-curtain',
  design='A DOOR CURTAIN as a stiff hanging panel: a heavy woven cotton cloth about 3 ft wide and 6.5 ft tall hanging straight and flat from a thick wooden'
  ' rod, cream with broad red and black stepped-pattern bands across it and a fringed bottom edge. Flat and upright like a door leaf, about 3 in thick.',
  see='a flat woven striped curtain hanging from a rod', rooms=['*'], aff='open,los')

SECTION = {'nrs': ('Norse steading', 'Viking-Age Scandinavia, c. 800-1050'), 'mde': ('Middle East (Mamluk)', 'the Mamluk Near East, Cairo and Damascus, 13th-16th c.'),
           'rus': ("Medieval Rus'", "Novgorod, Vladimir-Suzdal and Muscovy, 11th-16th c."), 'mes': ('Mexica (Aztec)', 'Late Postclassic Tenochtitlan and Tlatelolco, c. 1400-1520')}
def catalog_files():
    """catalog/objects-culture-<code>.catalog.md: one line per NEW role (a prop whose role is its own sku, or a new role such as
    door-curtain); skus under existing roles (wall kit, the shop skeleton's five) need no line."""
    import sys; sys.path.insert(0, str(ROOT / 'src')); import catalog_tool as ct
    have = {}
    for p in sorted((ROOT / 'catalog').glob('*.catalog.md')):
        if 'objects-culture-' in p.name: continue
        have.update(ct.parse_catalog(p)[0])
    for code, ts in sorted({t['code']: [x for x in T if x['code'] == t['code']] for t in T}.items()):
        C = CODES[code][0]; name, period = SECTION[code]
        lines = [f'# {name} — object level (culture packs B, 2026-11-06)', '',
                 f'New roles of the {name} culture pack ({period}): experiments/2026-11-06-cultures-b/spec.py (designs, sizes in inches),'
                 ' ROSTERS.md (research, the deliberate NOTs) and reads/ (the sensitivity reads). Every mesh is tier `' + code + '` (exclusive).', '',
                 f'## {C}1. {name}', '']
        for t in ts:
            if t['kind'] == 'wall' or t['obj'] in have: continue
            w, d, h = t['size']; rng = '~0.8-1.3' if t['place'] in ('floor', 'ground') and max(w, d, h) < 100 else ''
            sets = f"set:{C}!" + (',' + ','.join(sorted(set(t.get('also', []))) ) if t.get('also') else '')
            lines.append(f"- **{t['obj']}** — {t['desc']} · {t['place']} · {t['fp']} · size:{w:g}x{d:g}x{h:g}{rng} · {t['mat']} · {sets} · var:- · aff:{t['aff']} · mesh · {t['pri']} · {t['hint']}")
        (ROOT / 'catalog' / f"objects-culture-{CODES[code][1]}.catalog.md").write_text('\n'.join(lines) + '\n')
        print('catalog', CODES[code][1], len(lines) - 6, 'roles')

# =====================================================================================================================
if __name__ == '__main__':
    ids = [t['id'] for t in T]; assert len(ids) == len(set(ids)), 'duplicate id'
    (HERE / 'targets.json').write_text(json.dumps(T, indent=1))
    by = {}
    for t in T: by.setdefault(t['code'], []).append(t)
    for c, ts in by.items(): print(c, len(ts), 'meshes,', sum(t['kind'] == 'wall' for t in ts), 'wall pieces')
    print(len(T), 'in all -> targets.json')
    catalog_files()

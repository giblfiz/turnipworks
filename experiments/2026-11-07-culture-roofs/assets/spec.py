#!/usr/bin/env python3
"""Culture roofs (2026-11-07): the roof ORNAMENT meshes. Ids and sizes are FIXED by ../PLAN.md (the engine places them by rule).
    python3 spec.py      -> targets.json (one record per mesh, the cultures-b format: tools/briefs.py, gate.py, stage.py read it)
Designs follow the sensitivity read (sensitivity-codex.md; changes in LAB_NOTES 07:51). Nothing here calls a model.
Every mesh is designed STOUT for table distance, with NO text, NO script-like marks, NO figures or deity images.
(The ridge skus belong to the existing role `roof-ridge`, like its --lead / --thatch skus: shape = the roof style.)"""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent
T = []
STOUT = (' Built CHUNKY for a tabletop miniature seen from across the table: every part THICK and solid, broad soft bevels, nothing thin, no wire,'
         ' no loose or dangling parts, nothing floating.')
NOTEXT = ' NO text, letters, inscriptions or script-like marks anywhere; NO figures, faces or deity images.'

def P(i, obj, size, mat, desc, design, see, view='prop', shape='', culture=''):
    T.append(dict(id=i, obj=obj, code='croof', kind='prop', place='kit', fp='edge' if obj == 'roof-ridge' else '1', size=list(size), mat=mat,
                  desc=desc, hint='placed by the roof builder (engine/client/roofs.js rules)', design=design + STOUT + NOTEXT, see=see, rooms=['*'],
                  aff='-', pri='P2', flags=[], view=view, shape=shape, culture=culture))

RIDGE = (' It is ONE straight 5-ft MODULE of a roof ridge, seen from the side at a three-quarter angle: a LONG horizontal bar about three times as long as'
         ' it is tall, its long axis running LEFT-RIGHT across the picture. Both ENDS are cut clean and flat (square), so copies butt end to end into one'
         ' continuous ridge; the underside is a shallow inverted V (it sits astride the roof peak). No end ornament, no roof slopes attached.')
P('roof-ridge--kawara', 'roof-ridge', (60, 20, 22), 'stone', '5-ft ridge section of a Japanese kawara roof (noshi stack under a round cap)',
  'A Japanese late-Edo KAWARA roof RIDGE module: a stack of FIVE flat noshi-gawara ridge tiles laid in neat horizontal layers along its length (each'
  ' layer a crisp thin dark line of shadow), plastered at its foot onto a row of small grey tile ends, and crowned along its whole top by ONE continuous'
  ' ROUND cap tile (kanmuri-gawara, a half cylinder). Matte smoky silver-grey fired clay, cool blue-grey to pewter.' + RIDGE,
  'a long straight grey tiled roof-ridge section with layered tiles and a round cap', shape='kawara', culture='Japan, late Edo')
P('roof-ridge--tongwa', 'roof-ridge', (60, 20, 22), 'stone', '5-ft ridge section of a Chinese grey tile roof (a modest stacked-tile ridge)',
  'A mid-Qing Beijing courtyard-house RIDGE module, modest and plain: a solid ridge of grey tiles laid ON EDGE in a close row along its length (a fine'
  ' rhythm of upright tile edges), set on a smooth band of grey lime mortar, with a flat grey brick COPING course along its whole top. Matte unglazed'
  ' blue-grey fired clay and pale grey mortar. NOT Japanese (no stacked flat layers under a round cap), no curled ends, no beasts.' + RIDGE,
  'a long straight grey Chinese tiled roof-ridge section', shape='tongwa', culture='China, mid-Qing')
P('roof-ridge--glazed', 'roof-ridge', (60, 20, 22), 'stone', '5-ft ridge section of a Chinese green-glazed temple roof',
  'A mid-Qing Beijing temple-hall RIDGE module of moulded GREEN-GLAZED ridge pieces: a tall straight ridge with a deep moulded panel along its side'
  ' (a sunken band with a simple raised plain border and a row of plain round bosses), a rounded glazed coping along its whole top and a moulded base'
  ' course. Deep jade to malachite green glaze with a soft restrained sheen, the sunken band a touch darker; no dragons, no figures on it.' + RIDGE,
  'a long straight green glazed temple roof-ridge section', shape='glazed', culture='China, mid-Qing')
P('roof-onigawara', 'roof-onigawara', (24, 14, 30), 'stone', 'Japanese ridge-end tile (onigawara) with cloud relief',
  'A Japanese late-Edo ONIGAWARA (ridge-end tile) WITHOUT a face: one thick upright slab of smoky silver-grey fired clay, shaped like a broad'
  ' rounded shield taller than wide, with two blunt rounded horns curling outward at its top corners and a thick flat foot; its front carved in deep'
  ' soft relief with a bold swirling CLOUD-and-WAVE pattern (big rounded scrolls), a plain raised rim round it. Seen from the front at a slight'
  ' three-quarter angle. It stands alone.', 'a grey clay ornamental roof end tile with swirling cloud relief', culture='Japan, late Edo')
P('roof-chiwen', 'roof-chiwen', (30, 14, 48), 'stone', 'Qing ridge-end ornament (zhengwen), green glazed',
  'A Qing-dynasty Beijing temple RIDGE-END ornament (zhengwen, the "ridge-swallowing" acroterion): a tall, thick, stylised glazed-ceramic block whose'
  ' LOWER front is a broad stylised dragon head with a wide open mouth gripping DOWN onto a short stub of ridge at its foot (the mouth faces the'
  ' ridge, to the side), and whose back rises and CURLS UP and inward into one big thick rolled tail at the top; a short stout rod-like spine stands at'
  ' the back. The whole surface broad moulded scales and scrolls, bold and simple. Green glaze with deep jade shadows and a little ochre in the deepest'
  ' cuts, soft restrained sheen. Seen from the side at a slight three-quarter angle, the mouth on the LEFT. A stylised architectural ornament.',
  'a green glazed dragon-headed roof ridge ornament with a curled-up tail', culture='China, mid-Qing')
P('roof-cupola-onion', 'roof-cupola-onion', (72, 72, 168), 'wood', "Rus' wooden church cupola: drum, onion dome of aspen shingles, plain cross",
  "A wooden Russian church CUPOLA (late 16th c. style, modest): a tall round timber DRUM of horizontal logs, a thin plain cornice band at its top, and on"
  ' it a MODEST ONION dome (a restrained bulb, only a little wider than the drum, with a short neck), covered all over in overlapping rounded'
  ' aspen-wood ploughshare shingles (lemekh) like fish scales, weathered SILVER-GREY with warm honey edges, and on top a short thick neck carrying ONE'
  ' plain wooden CROSS with three bars (the lowest slanted), the bars as thick as the neck, no figure on it. The whole piece is tall and narrow;'
  ' the drum stands on a short square timber base that sits astride a roof ridge.', 'a tall wooden onion-domed church cupola with a cross on top',
  culture="Rus', 16th c.")
P('roof-dome', 'roof-dome', (144, 144, 96), 'stone', 'Mamluk bathhouse dome with glass light-caps',
  'ONLY the ROOF DOME of a Mamluk Cairo HAMMAM (bathhouse), as it stands on a flat roof: a low broad hemispherical masonry dome with a smooth warm'
  ' off-white PLASTER finish, on a SHORT plain round drum (about one fifth of the total height) that sits on a thin flat square plaster plinth slab'
  ' at the very bottom. NOTHING below the plinth: NO walls, NO building, NO doors, NO windows, NO arches, NO decorated facade; the whole piece is'
  ' wider than tall (about 3 times as wide as the drum is tall). The dome is studded with ordered rings of small raised round GLASS LIGHT-CAPS (thick little glass bowls'
  ' set in the plaster, pale green-blue and amber, each with a soft rim), about forty of them in four rings, none at the very top. Matte limewashed'
  ' plaster with faint warm staining.', 'a low white plastered dome dotted with small round glass lights', view='top', culture='Mamluk Cairo')
P('roof-malqaf', 'roof-malqaf', (48, 48, 72), 'wood', 'Cairo wind-catcher (malqaf): slanted timber hood open to the north',
  "A medieval Cairo WIND-CATCHER (malqaf) on a flat roof, shaped like a big wooden SCOOP or open box tipped back: from a low square plastered base"
  ' rises a plain square timber shaft, and on it a sloping hood whose BACK is one solid plank surface sloping steeply up like a lean-to roof and whose'
  ' high FRONT is ONE single huge OPEN rectangular mouth (taking up the whole front face), pitch dark inside, framed by a thick plain plank frame and'
  ' facing the viewer at a three-quarter angle. Plain weathered grey-brown planks and pale plaster. NO windows, NO arches, NO shutters, NO grilles,'
  ' NO ornament, NO second opening: it is a single open-mouthed air scoop, not a house or dormer.',
  'a slanted wooden air scoop with one big dark open mouth', culture='Mamluk Cairo')
P('roof-shikhara', 'roof-shikhara', (144, 144, 264), 'stone', 'Nagara latina temple tower (shikhara) with amalaka and kalasha',
  'A north-Indian Nagara temple TOWER of the LATINA (rekha-prasada) type, as built round Amber and Jaipur: one tall, single, CURVILINEAR tower of buff'
  ' and pale pink sandstone rising from a square base, its sides curving gently inward to the top like a beehive, made of many stacked horizontal'
  ' storey bands and divided by strong PROJECTING VERTICAL RIBS (a broad central offset on each face and stepped offsets beside it); at its top a short'
  ' neck, a big round ribbed AMALAKA (a fluted cushion-shaped stone disc with a SCALLOPED outline) and on it a pot-shaped KALASHA finial. Carving is'
  ' only abstract and architectural: mesh-like gavaksha (horseshoe-arch) lattice and mouldings, no figures, no deities, no animals.',
  'a tall curving Indian sandstone temple tower with a ribbed disc and pot finial on top', view='top', culture='Rajput India, 18th c.')

# ---- SUCH's plates (experiments/2026-11-07-culture-roofs/such/plates-for-assets, its README: ids, sizes, see-as; its own
# sensitivity read and designs). Meshed in this lane's one pod session; they land through this manifest with tier `mes`.
def SUCH(i, size, place, fp, mat, desc, see, aff, pri, hint):
    T.append(dict(id=i, obj=i, code='mes', kind='prop', place=place, fp=fp, size=list(size), mat=mat, desc=desc, hint=hint, design='(SUCH plate)', see=see,
                  rooms=['mes-ballcourt'], aff=aff, pri=pri, flags=[], view='prop', shape='', culture='Mexica, c. 1400-1520', plate='../such/plates-for-assets/' + i + '.png'))
SUCH('mes-court-endwall', (120, 24, 48), 'ground', '1x2', 'stone', "low plain lime-plastered wall section closing a ballcourt's end zone", 'a low plastered stone wall section',
     'block,cover,climb', 'P1', "round the two end zones of a ballcourt, wider than the alley (2026-11-07)")
SUCH('mes-court-ball', (10, 10, 10), 'floor', 'sub', 'organic', 'solid rubber ball (olli) of the ballgame, brown-black', 'a dark rubber ball', 'carry', 'P1', 'in the alley of a ballcourt (2026-11-07)')
SUCH('mes-court-hip-guard', (30, 18, 8), 'floor', 'sub', 'organic', "ballplayer's folded leather hip guard with its girdle", 'a folded leather belt / hip pad', 'carry', 'P3',
     'on the end of a ballcourt bench (2026-11-07)')

if __name__ == '__main__':
    ids = [t['id'] for t in T]; assert len(ids) == len(set(ids))
    (HERE / 'targets.json').write_text(json.dumps(T, indent=1)); print(len(T), 'meshes -> targets.json')

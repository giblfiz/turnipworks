#!/usr/bin/env python3
"""Faith factions (lane faith-factions, 2026-11-07): Christian (High Gothic, N. France / England c. 1250-1400), Buddhist
(Tibetan assembly hall c. 1400-1800), Hindu (Nagara, central/western India c. 950-1100, a Ganesha sanctum), Muslim (Mamluk
Cairo 1250-1517). DESIGN.md is the roster; SENSITIVITY-codex.txt the read that changed it (every fix applied here).
    python3 spec_fth.py   ->  fth/assets.json (meshes: Codex image worker plates for TRELLIS), fth/flats.json (flat
                              pieces and the four picker emblems: Codex image worker, transparent PNGs), fth/prompts/
No text in any script on any piece (spec_lib NOTEXT on every mesh; FLAT_NOTEXT on every flat); the one symbol that is a
written syllable, Om, is named exactly where it is wanted and nowhere else."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from spec_lib import add, assets, STOUT, UNLIT, HERE  # noqa: E402

REV = " Made with reverence: dignified, calm, symmetrical where the real object is, a sacred object treated respectfully, never cartoonish."
HUNG = (" It HANGS: at the top, three or four THICK straight chain rods (drawn as solid rods, not fine links) rise to one small ceiling ring;"
        " nothing below it touches the ground.")

# ---------------- CHRISTIAN: Latin church, High Gothic, northern France / England, c. 1250-1400
C = "christian"
add(f"flavor-idol--{C}", "flavor-idol", (48, 30, 108), "a tall carved oak crucifix of a High Gothic church",
    "A tall CRUCIFIX of a 13th-14th century Gothic church: a thick carved oak cross with trefoil (three-lobed) ends on its three upper arms, painted"
    " deep red with gilt edges, standing in a stepped base of pale carved limestone; on it the carved and painted figure of Christ, arms outstretched"
    " along the crossbar, head gently inclined, a calm serene face, a white loincloth, NO blood, NO wounds shown. NO plaque, NO titulus, nothing"
    " written above the head. Thick, solid, stout proportions." + REV + STOUT,
    "a tall carved Gothic crucifix with the figure of Christ on a stone base", ["a cross", "a carved figure of Christ on it", "a stone base"],
    ["blood or gore", "a plaque or sign on the cross", "a second figure"], aspect="portrait", base=False)
add(f"flavor-altarpiece--{C}", "flavor-altarpiece", (30, 10, 30), "a gilt Gothic altar cross between two candlesticks",
    "An ALTAR SET of a Gothic church as ONE piece on one narrow plank-like gilt foot: in the middle a gilt brass CROSS (plain Latin cross with small"
    " trefoil ends) on a stepped foot, and either side of it a short gilt PRICKET CANDLESTICK holding a thick white candle." + UNLIT + REV + STOUT,
    "a gilt altar cross between two candlesticks", ["a cross in the middle", "a candlestick each side"], ["a crucifix figure", "flames"], aspect="landscape", base=False)
add(f"flavor-sculpture--{C}", "flavor-sculpture", (30, 24, 84), "a Gothic polychrome statue of the Virgin and Child",
    "A standing VIRGIN AND CHILD statue of 14th-century French Gothic painted wood: Mary standing in a gentle S-curve, a deep blue mantle over a"
    " red gown with gilt borders, a white veil and a small gilt crown, a calm kind face, holding the Christ Child on her left arm; he raises one"
    " hand in blessing. She stands on a carved hexagonal plinth of painted stone with a Gothic arcade moulding." + REV + STOUT,
    "a painted standing statue of a woman in a blue mantle holding a child, on a plinth", ["a standing woman in a blue mantle", "a small child held on her arm", "a plinth"],
    ["a warrior", "wings", "a weapon"], aspect="portrait", base=False)
add(f"flavor-censer--{C}", "flavor-censer", (18, 18, 66), "a tall Gothic pricket floor candlestick",
    "A tall PRICKET CANDLESTICK for a Gothic church floor: a stout wrought-iron stem with a brass knop half way up, on three splayed iron feet, a"
    " broad brass drip-pan at the top with an iron spike holding a very thick tall white wax candle." + UNLIT + STOUT,
    "a tall iron floor candlestick with a thick white candle", ["a tall floor candlestick", "a thick candle on top"], ["flames", "several candles"], aspect="portrait", base=False)
add(f"flavor-font--{C}", "flavor-font", (36, 36, 54), "a Gothic baptismal font with a pointed wooden cover",
    "A BAPTISMAL FONT of a 14th-century English church: a broad OCTAGONAL bowl of pale carved limestone, each face carved with a plain quatrefoil, on"
    " a thick octagonal pedestal and a stepped octagonal plinth; on top a tall pointed CONICAL oak COVER with carved crocket ridges and a small"
    " finial." + REV + STOUT, "an octagonal stone font with a pointed wooden cover", ["an octagonal stone bowl on a pedestal", "a pointed wooden cover"],
    ["water spilling", "a figure"], aspect="portrait", base=False)
add(f"flavor-stand--{C}", "flavor-stand", (18, 18, 54), "a brass thurible hanging from its iron stand",
    "A THURIBLE STAND of a Gothic church: a stout wrought-iron upright on a tripod foot with a hook arm at the top, and hanging from the hook on"
    " three THICK straight brass chain rods a brass THURIBLE (a round censer bowl with a domed pierced lid like a little Gothic tower)." + UNLIT
    + " No smoke." + STOUT, "a brass censer hanging from an iron stand", ["an iron stand", "a hanging brass censer"], ["smoke", "flames"], aspect="portrait", base=False)

# ---------------- BUDDHIST: Tibetan monastery assembly hall (dukhang), c. 1400-1800
B = "buddhist"
add(f"flavor-idol--{B}", "flavor-idol", (60, 48, 96), "a gilt seated Buddha of a Tibetan monastery",
    "A SEATED BUDDHA SHAKYAMUNI of a Tibetan monastery, gilt copper: seated cross-legged in meditation, a serene calm face with lowered eyes, the"
    " RIGHT hand reaching down over the right knee with the fingertips touching the ground (the earth-touching gesture), the LEFT hand resting"
    " palm-up in the lap; a red-and-gold robe over one shoulder; seated on a broad DOUBLE LOTUS THRONE of gilt petals on a stepped red-painted"
    " plinth; behind him a plain smooth oval AUREOLE of gold edged with red." + REV + STOUT,
    "a serene gilt seated Buddha touching the ground with his right hand, on a lotus throne", ["a seated Buddha figure", "a lotus throne", "an aureole behind him"],
    ["a standing figure", "many arms", "a dragon", "a warrior"], aspect="square", base=False)
add(f"flavor-altar--{B}", "flavor-altar", (60, 24, 36), "a Tibetan offering table with offering bowls and butter lamps",
    "A Tibetan monastery OFFERING TABLE: a low long table of red-lacquered wood with carved and gilt borders and painted lotus panels on its front;"
    " on its top, in one straight row, SEVEN small polished brass OFFERING BOWLS filled with water, and at the two ends two brass BUTTER LAMPS"
    " (goblet-shaped)." + UNLIT + STOUT, "a red lacquered table with a row of brass bowls", ["a low red table", "a row of small brass bowls on it"],
    ["food heaps", "flames", "a statue"], aspect="landscape", base=False)
add(f"flavor-altarpiece--{B}", "flavor-altarpiece", (16, 10, 10), "a Tibetan vajra and handbell on a cushion",
    "A Tibetan VAJRA AND BELL set: on a small square brocade CUSHION of maroon and gold, a brass VAJRA (dorje: a short thick sceptre with two"
    " bulbous rounded ends of curving prongs) lying beside a brass HANDBELL (drilbu) standing upright on its rim, its handle topped with a half"
    " vajra." + REV + STOUT, "a brass sceptre and a handbell on a small cushion", ["a small handbell", "a short double-ended brass sceptre", "a cushion"],
    ["a weapon", "a large bell"], aspect="landscape", base=False)
add(f"flavor-sculpture--{B}", "flavor-sculpture", (48, 48, 96), "a Tibetan Bodhi-type chorten (stupa)",
    "A Tibetan CHORTEN of the Bodhi (jangchub) type: a whitewashed square base of FOUR receding steps, above it a white rounded vase-shaped dome,"
    " a small square gilt box (harmika) on the dome, then a tapering GILT SPIRE of thirteen stacked rings, a small gilt parasol, and on the very top"
    " a gilt crescent moon holding a disc with a little flame-drop point." + REV + STOUT,
    "a white Tibetan stupa with a gilt ringed spire", ["a white stepped base and dome", "a gilt spire of rings"], ["windows", "a door", "a pagoda roof"],
    aspect="portrait", base=False)
add(f"flavor-censer--{B}", "flavor-censer", (20, 20, 48), "a Tibetan brass incense burner on a tall stand",
    "A Tibetan brass INCENSE BURNER: a round bulbous brass bowl with a high DOMED PIERCED LID (pierced with lotus and cloud shapes) and a small lotus"
    " finial, on a tall stout brass stand with a round foot." + UNLIT + " No smoke." + STOUT,
    "a brass incense burner with a pierced domed lid on a tall stand", ["a brass bowl with a pierced domed lid", "a tall stand"], ["smoke", "flames"], aspect="portrait", base=False)
add(f"flavor-wheel--{B}", "flavor-wheel", (30, 30, 72), "a large standing Tibetan prayer wheel in its frame",
    "A large standing Tibetan PRAYER WHEEL: a tall upright CYLINDER DRUM of polished copper and brass, its surface EMBOSSED WITH LOTUS PETALS and"
    " bands of round ornament only (NO letters: the prayer scroll is hidden inside), turning on a thick vertical iron axle, set in a sturdy wooden"
    " FRAME painted red with gilt and green trim, a little roof on the frame, on a square wooden plinth." + REV + STOUT,
    "a tall copper drum in a red wooden frame", ["a tall upright copper drum", "a red painted wooden frame"], ["letters or script on the drum", "a barrel", "a small handheld wheel"],
    aspect="portrait", base=False)

# ---------------- HINDU: Nagara temple, central/western India, c. 950-1100: a Ganesha sanctum
H = "hindu"
add(f"flavor-idol--{H}", "flavor-idol", (60, 54, 108), "a carved sandstone Ganesha sanctum of a medieval North Indian temple",
    "A small enclosed SANCTUM (garbhagriha) of an 11th-century central-Indian temple, carved in warm buff SANDSTONE: a cube-like stone cell with a"
    " richly carved DOORWAY in its front (stepped carved door jambs and lintel), a short curved beehive-shaped SHIKHARA tower on top with a round"
    " ribbed crowning stone. Inside, seen through the open doorway, a seated GANESHA murti of dark stone: elephant head, FOUR arms (upper right"
    " holding an axe, upper left a noose, lower right his broken tusk, lower left a bowl of round sweets, toward which his trunk curves to his left),"
    " seated at ease on a low pedestal, a small mouse at his feet, a garland of white jasmine flowers round his neck. Nothing else inside." + REV + STOUT,
    "a carved stone shrine with a seated elephant-headed figure visible through its doorway", ["a carved stone shrine with a curved tower", "a seated elephant-headed figure inside the doorway"],
    ["marigolds", "a tower taller than the shrine body is wide x3", "a standing figure"], aspect="portrait", base=False)
add(f"flavor-altarpiece--{H}", "flavor-altarpiece", (18, 18, 12), "a brass Hindu offering plate on a low stand",
    "A Hindu OFFERING PLATE (thali): a round polished brass plate on a short brass stand with a round foot; on the plate a small unlit clay oil lamp"
    " (diya), a little heap of white jasmine flowers and one pink lotus flower, two bananas, and two tiny brass bowls, one of red kumkum powder and"
    " one of rice." + UNLIT + STOUT, "a brass plate of flowers, fruit and a little lamp on a low stand", ["a round brass plate", "flowers and a little lamp on it"],
    ["marigolds", "flames", "a bowl of soup"], aspect="square", base=False)
add(f"flavor-censer--{H}", "flavor-censer", (16, 16, 60), "a tall brass standing oil lamp of a Hindu temple",
    "A tall Hindu temple standing OIL LAMP (dipa) of polished brass: a stout round stepped foot, a thick turned stem with rings, and at the top a"
    " broad flat dish with FIVE small pointed spouts round its rim for wicks, a small finial in its centre." + UNLIT + STOUT,
    "a tall brass lamp stand with a five-spouted dish on top", ["a tall brass stem", "a flat dish with spouts on top"], ["flames", "a candle"], aspect="portrait", base=False)
add(f"flavor-bell--{H}", "flavor-bell", (14, 14, 36), "a brass Hindu temple bell hanging from its chain",
    "A Hindu temple BELL (ghanta) of polished brass: a stout bell shape with a thick rim and a heavy clapper inside, hanging from a short THICK brass"
    " chain rod with a round hook at the top." + REV + STOUT, "a brass bell hanging from a short chain", ["a brass bell", "a short chain above it"],
    ["a handbell with a handle", "a cow bell"], aspect="portrait", base=False)
add(f"flavor-gate--{H}", "flavor-gate", (96, 24, 120), "a carved sandstone kirti-torana gateway arch",
    "A free-standing KIRTI-TORANA gateway of the 11th-century Solanki style (as at Modhera, Gujarat), carved in warm sandstone: two tall square"
    " carved PILLARS on moulded bases, carrying a heavy horizontal carved LINTEL across the top, and between the pillars, below the lintel, a"
    " CUSPED (scalloped) arch springing from the pillars. Open in the middle so one walks through it. No walls on either side." + STOUT,
    "a free-standing carved stone gateway of two pillars and a lintel with a scalloped arch", ["two carved pillars", "a lintel on top", "a scalloped arch between them"],
    ["a door leaf", "walls", "a roof"], aspect="square", base=False)

# ---------------- MUSLIM: Mamluk Cairo, 1250-1517 (aniconic: no figure anywhere)
M = "muslim"
NOFIG = " NO figures, NO faces, NO animals anywhere: geometric and arabesque ornament only."
add(f"flavor-idol--{M}", "flavor-idol", (72, 24, 120), "a Mamluk marble mihrab prayer niche",
    "A MIHRAB of a 15th-century Mamluk mosque in Cairo, as a free-standing wall piece with a FLAT BACK: a tall rectangular frame of polychrome"
    " MARBLE INLAY (bands of white, black, red and green marble in geometric patterns) around a deep recessed NICHE with a POINTED ARCH, the arch"
    " stones alternating light and dark, the niche's half-dome hood fluted, two slender marble COLUMNS with small capitals standing in the niche's"
    " corners; the niche's back wall panelled in striped marble. NO inscription band, NO letters." + NOFIG + REV + STOUT,
    "a marble prayer niche with a pointed arch in a polychrome inlaid frame", ["a deep niche with a pointed arch", "polychrome marble inlay"],
    ["a statue or figure", "a door", "letters or calligraphy"], aspect="portrait", base=False)
add(f"flavor-censer--{M}", "flavor-censer", (18, 18, 54), "a tall Mamluk brass mosque candlestick",
    "A tall MAMLUK MOSQUE CANDLESTICK of brass: a broad bell-shaped BASE, a short thick neck, a round candle socket on top holding a very thick"
    " tall white wax candle; the base inlaid with silver and dark bands of GEOMETRIC ornament and roundels of arabesque (NO inscription)." + UNLIT + NOFIG + STOUT,
    "a brass candlestick with a broad bell base and a thick candle", ["a broad bell-shaped brass base", "a thick candle"], ["flames", "letters"], aspect="portrait", base=False)
add(f"flavor-pulpit--{M}", "flavor-pulpit", (30, 96, 106), "a carved wooden Mamluk minbar",
    "A MINBAR (mosque pulpit) of 15th-century Mamluk Cairo, like the minbar of Sultan Qaytbay: carved dark wood, seen from the side so its whole"
    " length shows: a straight STAIR of steps rising between two TRIANGULAR SIDE PANELS filled with GEOMETRIC STAR-PATTERN inlay of wood and ivory;"
    " at the low end a tall doorway frame with a small cresting; at the top a small open PAVILION of four posts carrying a BULB-SHAPED wooden cupola."
    + NOFIG + " NO letters." + REV + STOUT, "a long wooden stair pulpit with star-pattern side panels and a little domed top", ["a straight stair between triangular panels",
    "geometric star-pattern panels", "a small domed pavilion at the top"], ["a staircase to a floor above", "a figure", "letters"], aspect="landscape", base=False)
add(f"flavor-lamp--{M}", "flavor-lamp", (14, 14, 36), "an enamelled glass Mamluk mosque lamp hanging on chains",
    "A MAMLUK MOSQUE LAMP of clear enamelled glass: a wide flaring NECK, a round bulbous BODY with six small glass loop handles, a short foot;"
    " painted with enamel BANDS of deep blue, red and gold: geometric bands, roundels and floral arabesque only, NO inscription." + HUNG + UNLIT + NOFIG + STOUT,
    "a glass lamp with a flared neck and enamelled bands hanging on chains", ["a glass lamp with a flared neck", "enamelled blue and red bands", "chains above"],
    ["letters or calligraphy", "flames", "a lantern box"], aspect="portrait", base=False)
add(f"flavor-stand--{M}", "flavor-stand", (12, 16, 14), "an open empty wooden rehal (Qur'an stand)",
    "A REHAL: a folding wooden book stand made of two thick boards that cross in an X, opened so that it stands with a V-shaped cradle on top, its"
    " boards INLAID with a geometric star pattern in light wood and mother-of-pearl. It is EMPTY: NO book on it." + NOFIG + STOUT,
    "an empty X-shaped folding wooden stand with geometric inlay", ["an X-shaped folding wooden stand", "geometric inlay"], ["a book", "letters"], aspect="square", base=False)
add(f"flavor-font--{M}", "flavor-font", (48, 48, 40), "an octagonal marble ablution fountain of a Mamluk mosque courtyard",
    "An ABLUTION FOUNTAIN of a Mamluk mosque courtyard: a broad OCTAGONAL basin of white and grey marble with a polychrome inlaid band round its"
    " rim, small brass SPOUTS set round its sides, a low marble step round its foot for sitting, and in its centre a short marble post. No water"
    " spray." + NOFIG + STOUT, "an octagonal marble basin with small spouts round it", ["an octagonal marble basin", "small spouts round it"],
    ["a domed roof", "a statue", "water spray"], aspect="square", base=False)
add(f"flavor-corbel--{M}", "flavor-corbel", (24, 24, 30), "a carved stone muqarnas corbel bracket",
    "One architectural carved CORBEL bracket, not a freestanding statue: a stout block projecting out from a FLAT VERTICAL wall-mounting back, with a"
    " wide FLAT HORIZONTAL TOP to carry a beam; under that top its front is carved as stepped tiers of MUQARNAS cells (little niche-like facets"
    " stacked in rows, widening upward), pale limestone. Back completely flat; top completely flat. No wall, no beam." + NOFIG + STOUT,
    "a stone wall bracket carved with stepped honeycomb-like niches", ["a bracket with a flat top", "stepped muqarnas cells"], ["a figure", "a head"], aspect="square", base=False)

# ---------------- flats (banner / relief / sigil / mat) and the picker emblems: transparent PNGs, text-only prompts
FLAT_HEAD = "Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art (match the attached style image's painting style, never its contents). "
FLAT_TAIL = (" Stout connected forms, broad shapes, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object, centered,"
             " generous clear margin, no scene or additional objects. ABSOLUTELY NO TEXT: no letters, words, numbers, calligraphy, runes or anything that"
             " looks like script, in any language. Genuinely transparent background. Orthographic flat artwork suitable for a game texture.")
FLAT = {
 f"flavor-banner--{C}": ("flavor-banner", [36, 1, 60], "One flat processional BANNER of a Gothic church, straight front-on: deep red silk with a broad gold border, in its middle a large plain gold LATIN CROSS; it hangs from a short horizontal gilt crossbar along its top, its bottom edge cut into three points each with a small gold tassel.", "portrait"),
 f"flavor-relief--{C}": ("flavor-relief", [30, 2, 30], "One flat round carved limestone ROUNDEL, straight front-on: a Gothic QUATREFOIL (four-lobed frame) carved in relief, inside it a plain equal-armed CROSS with small flared ends, gilded; wide bevelled stone border. Relief shading painted into a mostly flat face; no wall behind.", "square"),
 f"flavor-sigil--{C}": ("flavor-sigil", [96, 96, 1], "One flat circular PAVEMENT LABYRINTH seen exactly top-down: the medieval Chartres-type eleven-circuit labyrinth laid in pale limestone paths between thin dark stone lines, a single winding path from the opening at the bottom to the six-lobed rosette at the centre; a ring of small dark scallops (lunations) round the outside.", "square"),
 f"flavor-banner--{B}": ("flavor-banner", [36, 1, 60], "One flat Tibetan THANGKA, straight front-on: a painted scroll in a mount of maroon and gold brocade with a dark blue lower border; in the painted panel the BUDDHA SHAKYAMUNI seated cross-legged on a lotus, serene, gilt skin, a red robe, his right hand reaching down to touch the ground and the left in his lap, a green-and-gold halo behind him, on a plain deep-blue ground with a few soft clouds. NO inscriptions, no lettering anywhere, no other figures.", "portrait"),
 f"flavor-relief--{B}": ("flavor-relief", [30, 2, 30], "One flat round ROUNDEL, straight front-on: a gilt EIGHT-SPOKED DHARMA WHEEL (a hub with a small swirl, eight straight spokes, a rim) carved in relief on a disc of deep red lacquered wood with a gilt bevelled border.", "square"),
 f"flavor-sigil--{B}": ("flavor-sigil", [72, 72, 1], "One flat circular floor emblem seen exactly top-down: an ornamental EIGHT-PETALLED LOTUS flower inlaid in polished stone, cream and saffron petals on a maroon ground, a gold ring round it. Only the flower and the ring.", "square"),
 f"flavor-mat--{B}": ("flavor-mat", [30, 96, 4], "One flat long low SEATING RUNNER of a Tibetan monastery assembly hall, seen exactly top-down: a long narrow cushioned mat of maroon wool with a plain saffron-gold border and a simple repeating band of small lotus shapes at both ends; no people.", "portrait"),
 f"flavor-relief--{H}": ("flavor-relief", [30, 2, 30], "One flat round carved sandstone ROUNDEL, straight front-on: in its centre the sacred symbol OM (the Devanagari Om sign, drawn accurately: the curved figure-3 shape with its tail, the small crescent and dot above) carved in relief and painted vermilion and saffron, inside a ring of lotus petals; wide bevelled sandstone border. Om is the ONLY sign on it: nothing else that looks like writing.", "square"),
 f"flavor-sigil--{H}": ("flavor-sigil", [60, 60, 1], "One flat MANDANA floor design seen exactly top-down, as painted on central-Indian temple and house floors: on a round ground of red ochre, a symmetrical LOTUS with eight petals drawn in thick white chalk lines, with dots and a simple geometric border of white lines round it.", "square"),
 f"flavor-mat--{M}": ("flavor-mat", [36, 96, 1], "One flat long CARPET RUNNER seen exactly top-down, in the style of a 15th-century Cairo Mamluk carpet: a deep red ground with a row of large OCTAGON MEDALLIONS in green and blue filled with small geometric stars and rosettes, a border of small repeating geometric shapes. Geometric only: no figures, no lettering, no niche picture.", "portrait"),
 f"flavor-relief--{M}": ("flavor-relief", [30, 2, 30], "One flat square carved wooden PANEL, straight front-on: a Mamluk GEOMETRIC INTERLACE pattern of a large TEN-POINTED STAR in the centre with interlocking polygons round it, made of inlaid dark wood, light wood and ivory pieces; a wide plain wooden border.", "square"),
 f"flavor-sigil--{M}": ("flavor-sigil", [72, 72, 1], "One flat circular floor MEDALLION seen exactly top-down: Mamluk polychrome MARBLE INLAY (opus sectile) of a large eight-pointed geometric STAR inside interlaced bands, in white, black, red and green marble, a round border of small triangles.", "square"),
}
EMBLEM = ("Use case: stylized-concept. One small painted emblem icon for a tabletop faction picker: {what}. Bold chunky pictogram filling a centered dark charcoal"
          " CIRCULAR button ground, viewed perfectly straight on. Heroic hand-painted style, matte, broad simple shapes, extremely restrained brush texture."
          " Must read at just 31 pixels: simple outer silhouette, large negative spaces, no fine detail. Outside the circle transparent. Exactly one icon, NO text,"
          " no lettering{extra}, no ornament border, no extra symbols, no 3D pedestal, no environment, no glow.")
ICONS = {
 C: EMBLEM.format(what="one plain gold LATIN CROSS (the upright longer below the crossbar) on a deep red disc inside the charcoal circle", extra=""),
 B: EMBLEM.format(what="one gold EIGHT-SPOKED DHARMA WHEEL (hub, eight straight spokes, a rim) on a maroon disc inside the charcoal circle", extra=""),
 H: EMBLEM.format(what="the sacred OM symbol (the Devanagari Om sign drawn accurately: the curved figure-3 shape with its tail, the crescent and dot above) in saffron on a vermilion disc inside the charcoal circle", extra=" other than the Om sign itself"),
 M: EMBLEM.format(what="one gold EIGHT-POINTED INTERLACED STAR (two overlapping squares, one turned 45 degrees, their lines interlaced) on a deep green disc inside the charcoal circle; NO crescent", extra=""),
}

assert all(a["id"].split("--")[1] in (C, B, H, M) for a in assets)
out = HERE / "fth"
(out / "prompts").mkdir(parents=True, exist_ok=True)
for a in assets: (out / "prompts" / f"{a['id']}.md").write_text(a["prompt"] + "\n")
(out / "assets.json").write_text(json.dumps({"batch": "fth-01", "note": "see spec_fth.py", "assets": assets}, indent=1) + "\n")
flats = [dict(id=k, object=o, shape=k.split("--")[1], size=s, aspect=asp, prompt=FLAT_HEAD + d + FLAT_TAIL, kind="flat") for k, (o, s, d, asp) in FLAT.items()]
flats += [dict(id=f"emblem--{f}", object="emblem", shape=f, size=[1, 1, 1], aspect="square", prompt=p, kind="emblem") for f, p in ICONS.items()]
for a in flats: (out / "prompts" / f"{a['id']}.md").write_text(a["prompt"] + "\n")
(out / "flats.json").write_text(json.dumps({"batch": "fth-flats-01", "assets": flats}, indent=1) + "\n")
print(f"fth: {len(assets)} mesh plates, {len(flats) - len(ICONS)} flats, {len(ICONS)} emblems")

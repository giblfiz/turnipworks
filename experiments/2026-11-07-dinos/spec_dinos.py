#!/usr/bin/env python3
"""THE DINOSAURS (Harry 2026-11-07: "can we flesh out the set of dinosaur tokens? I notice you've got T-Rex and
Triceratops, but let's get our top 8 favorites all done. So Ankylosaurus, Spinosaurus, Stegosaurus, Pterodactyl,
Brontosaurus, Quetzalcoatlus."; Fauna added the Velociraptor). Seven standing figures and two flying poses (the two
pterosaurs), in the default set's own words (../2026-10-06-figures/set_spec.py: STYLE, POSE, the gate's must-nots, read
without editing it), matched to the set's existing tyrannosaur and triceratops (moss-green / ochre hides, cream bellies,
scaly, no feathers: the set's STYLE bans feathers outright).
    python3 spec_dinos.py            -> set/assets.json, set/prompts/<id>.spec.md
Sizes (engine/core/size.js: size = squares a side; base_ft = 5 x size). Harry: Brontosaurus gargantuan;
Spinosaurus, Stegosaurus, Ankylosaurus huge; Quetzalcoatlus huge with a big wingspan; the pterodactyl large or medium
(built LARGE: a 10-ft base under an 18-ft wingspan). The velociraptor is medium (a man-sized pack hunter).
The compact cylinder grows with the base as the set's does (4 ft on 5, 8.5 on 10): 12.5 ft on 15, 17 ft on 20.
PLATES are painted by an OPEN-WEIGHT model on a RunPod pod (Qwen-Image-Edit, Apache-2.0: fal is empty and Codex's image
quota is spent until 11-11), conditioned on the set's own tyrannosaur plate (two-legged) or triceratops plate (four-legged); `qwen` is its prompt."""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent; FIG = HERE.parent / "2026-10-06-figures"
MAIN = Path("experiments/2026-10-06-figures")   # the set's plates (binaries) live in the main checkout
src = (FIG / "set_spec.py").read_text(); src = src[:src.index("exec(open(HERE / 'set_more.py')")]
src = src[:src.index("n = 0\nfor c in CLASSES:")]
ns = {"__file__": str(FIG / "set_spec.py"), "__name__": "set_spec"}; exec(compile(src, str(FIG / "set_spec.py"), "exec"), ns)
ns["F"].clear()
STYLE, POSE, NOT, HEAD = ns["STYLE"], ns["POSE"], ns["NOT"], ns["HEAD"]
TREX, TRIKE = str(MAIN / "set/inputs/foe-tyrannosaur.jpg"), str(MAIN / "set/inputs/foe-triceratops.jpg")
CYL = {5: 4, 10: 8.5, 15: 12.5, 20: 17}
COMMON = {"quad": ["the whole animal, nose to tail and head to feet", "FOUR separate legs all visible, with gaps between them"], "odd": ["the whole creature, nothing cut off"],
          "fly": ["the whole creature, both wing tips and the tail inside the picture"]}
FLY_POSE = ("Pose: FLYING, seen in mid-air: its body roughly LEVEL (horizontal, head a little raised), its two WINGS SPREAD WIDE and raised in a strong up-stroke (a clear V seen from the front), "
            "each wing drawn as ONE thick solid opaque shape (thick like a wargaming miniature's cast wing, a leathery skin wing with a thick bony leading edge, never a thin translucent membrane). "
            "Its legs tucked up under the body. COMPACT for a tabletop piece: the wing tips not stretched to the image edges.")
F = []


def dino(id, name, subject, h, kind, base, design, desc, must=(), length=None, tags=(), srd=(), fly=None, qwen=""):
    cyl = CYL[base]
    pose = POSE[kind].format(cyl=cyl)
    prompt = HEAD.format(subject=subject) + "\n\n" + STYLE.format(pose=pose) + "\n\nSpecific design: " + design + "\n"
    ht = {"body": h, "figure_top": h, "overall": h}
    if length: ht["length"] = length
    group = "foe" if base == 5 else "large"
    F.append({"id": id, "object": id, "family": "figures", "group": group, "source": "generate", "lane": "3d", "generation": "figure", "kind": kind, "subject": subject,
              "height_ft": ht, "shaft": None, "base_ft": base, "body": None, "canary": False, "name": name, "cls": id.split("-", 1)[1], "boss": base >= 15,
              "tags": list(tags) + ["dinosaur", "dino", "monster"], "srd": list(srd), "prompt": prompt, "refs": [TREX if kind == "odd" else TRIKE], "gate_refs": [],
              "gate": {"desc": desc, "must": COMMON[kind] + list(must) + ["fully painted in colour"], "must_not": NOT}, "qwen": qwen, "cyl_ft": cyl})
    if fly:
        F.append({"id": id + "-fly", "object": id, "family": "figures", "group": "fly", "source": "generate", "generation": "figure-fly", "kind": "fly", "subject": subject + ", flying",
                  "height_ft": {"body": h, "figure_top": h, "overall": h}, "base_ft": base, "name": name + " (flying)", "standing": id,
                  "prompt": fly["prompt"], "refs": [f"STANDING:{id}"], "gate": {"desc": fly["desc"], "must": COMMON["fly"] + list(fly.get("must", [])) + ["fully painted in colour"],
                  "must_not": [n for n in NOT if "rider" not in n] + ["a base, flight stand, rod, perch or ground under it", "the wings folded or hidden"]}, "qwen": fly["qwen"]})


# the Qwen prompt: the references carry the style; the words carry the creature, the pose and the mask rules
QSTYLE = ("Picture 1 is a painted tabletop miniature figure from a set ({ref}), alone on a flat chroma-blue background. "
          "Make ONE NEW figure of the SAME SET: {subject}. Keep EXACTLY its look: the same heroic hand-painted style, stout chunky miniature proportions with broad simple shapes, "
          "thick sturdy limbs, matte diffuse paint with soft gradients and subtle brush texture, the same soft even lighting, the same camera (three-quarter front view, very slightly above eye level) "
          "and the same perfectly flat uniform chroma-blue background. It is a DIFFERENT animal, described here: {design} "
          "Palette: the set's moss green, ochre, warm brown, burgundy and cream; NO blue, teal or cyan anywhere on the animal. "
          "{pose} No base, no ground, no rock, no grass, no cast shadow under the feet: it stands on nothing. Exactly one whole animal, centred, with generous clear blue space all around; "
          "nothing cut off by the frame. No feathers, no text, no glow, no scenery, not a statue, not a photo.")
QPOSE = {"quad": "Standing still and square on ALL FOUR legs, all four legs separately visible with blue background between them, all four feet flat on one level; compact: head up, tail curved round close beside its body, nothing stretched out.",
         "odd": "Standing still on its two legs in a compact stable pose, both feet flat on one level, a clear gap between the legs; the tail curved round close beside its legs down to the ground, nothing stretched out."}
QFLY = ("Picture 1 is THIS SAME CREATURE'S OWN STANDING FIGURE, already made in this set. Make a second figure of the SAME individual: the same painting style and paint scheme, the same colours "
        "and markings, the same head, crest, beak and proportions, the same chunkiness, lighting, camera and flat chroma-blue background. Only the POSE changes: it is FLYING in mid-air, "
        "body level and seen from slightly above and in front, its two big leathery WINGS SPREAD WIDE in a strong up-stroke (a clear V), each wing ONE thick solid opaque shape with a thick bony "
        "leading edge; legs tucked under the body. No base, no stand, no rod, no ground, no shadow: it floats on the plain blue. The whole creature in the picture, both wing tips inside the frame "
        "with clear blue space around them. No feathers, no blue or teal on the creature, no text, no glow, no scenery.")


def q(subject, design, kind):
    return QSTYLE.format(subject=subject, design=design, pose=QPOSE[kind], ref="a tyrannosaur" if kind == "odd" else "a triceratops")


D = "a velociraptor: a man-sized, lean, two-legged predator 5 ft tall at the head, standing fairly upright: a long low snout with a row of small thick cream teeth showing, a sharp-eyed head, three-fingered clawed hands held forward close to its chest, strong bird-like legs with a big curved SICKLE CLAW raised on each foot, a stiff tail curved round close beside its legs to the ground. SCALY skin (no feathers at all): ochre-tan hide with dark moss-green stripes down its back and a cream belly."
dino("foe-velociraptor", "Velociraptor", "a velociraptor", 5.0, "odd", 5,
     "A velociraptor, 5 ft tall at the head, standing fairly upright so it fits inside a 4-ft cylinder: a lean two-legged predator with a long low snout showing a row of small thick cream teeth, three-fingered clawed hands held forward close to its chest, strong bird-like legs with a big curved sickle claw raised on each foot, and a stiff tail curved round close beside its legs to the ground. Scaly skin, no feathers: an ochre-tan hide with dark moss-green stripes down its back and a cream belly.",
     "one lean two-legged raptor dinosaur with a long snout and clawed hands", ["a long snout and clawed hands on two legs"],
     tags=["velociraptor", "raptor", "deinonychus", "utahraptor", "pack hunter"], srd=["velociraptor", "deinonychus"], qwen=q("a velociraptor", D, "odd"))

D = "an ankylosaurus: a low, very broad armoured dinosaur on four short thick legs, its back a wide dome covered in rows of thick bony plates and short blunt spikes along its flanks, a broad flat head with two short horns at the back corners and a blunt beak, and a thick tail ending in a big heavy round bony CLUB; the tail curved round beside its flank. Ochre-brown armour plates with moss-green skin between them and a cream throat."
dino("foe-ankylosaurus", "Ankylosaurus", "an ankylosaurus", 6.5, "quad", 15,
     "An ankylosaurus, 6.5 ft tall at the top of its back, a very broad low body about 12 ft long with its tail curved close: its back a wide dome covered in rows of thick bony plates with short blunt spikes along the flanks, a broad flat head with two short horns at its back corners and a blunt beak, four short thick pillar legs, and a thick tail ending in a big heavy round bony club, curved round beside its flank. Ochre-brown armour plates with moss-green skin between them and a cream throat.",
     "one low armoured four-legged dinosaur with a bony tail club", ["an armoured back of bony plates", "a big bony club at the tail tip"], length=12,
     tags=["ankylosaurus", "ankylosaur", "armored dinosaur", "armoured dinosaur", "club tail"], srd=["ankylosaurus"], qwen=q("an ankylosaurus", D, "quad"))

D = "a stegosaurus: a big four-legged dinosaur with a high-arched back carrying TWO ROWS of big upright kite-shaped bony PLATES, a small low head on a short neck, hind legs much longer than the front legs, and a thick tail held low and curved round beside its flank with FOUR big thick SPIKES at its tip. Moss-green hide with ochre bands and a cream belly; the plates burgundy-red edged with ochre."
dino("foe-stegosaurus", "Stegosaurus", "a stegosaurus", 12.0, "quad", 15,
     "A stegosaurus, 12 ft tall at the top of its back plates, a massive body about 13 ft long with its tail curved close: a high-arched back carrying two rows of big upright kite-shaped bony plates, a small low head on a short neck, hind legs much longer than the front legs, four pillar legs, and a thick tail curved round beside its flank with four big thick spikes at the tip. Moss-green hide with ochre bands and a cream belly; the plates burgundy-red edged with ochre.",
     "one four-legged dinosaur with two rows of big back plates and a spiked tail", ["two rows of big upright plates on the back", "big spikes at the tail tip"], length=13,
     tags=["stegosaurus", "stegosaur", "plated dinosaur"], srd=["stegosaurus"], qwen=q("a stegosaurus", D, "quad"))

D = "a spinosaurus: a huge two-legged predator with a long narrow crocodile-like SNOUT lined with cream teeth, a tall SAIL of skin on its back held up by long spines (the sail as tall as its body is deep), strong arms with big hooked claws held close in front, two thick legs with big clawed feet, and a deep paddle-like tail curved round close beside its legs to the ground. Moss-green and ochre hide with a cream belly; the sail burgundy-red with ochre stripes."
dino("foe-spinosaurus", "Spinosaurus", "a spinosaurus", 15.0, "odd", 15,
     "A spinosaurus, 15 ft tall at the top of its sail, standing fairly upright so it fits inside a 12.5-ft cylinder: a huge two-legged predator with a long narrow crocodile-like snout lined with thick cream teeth, a tall sail of skin on its back held up by long spines, strong arms with big hooked claws held close in front of its chest, two massive legs with big clawed feet flat on the ground, and a deep paddle-like tail curved round close beside its legs to the ground. Moss-green and ochre hide with a cream belly; the sail burgundy-red with ochre stripes.",
     "one huge two-legged dinosaur with a long crocodile snout and a tall back sail", ["a tall sail on its back", "a long narrow snout"],
     tags=["spinosaurus", "spinosaur", "sail-back dinosaur"], srd=["spinosaurus"], qwen=q("a spinosaurus", D, "odd"))

D = "a brontosaurus: an enormous long-necked plant-eating dinosaur on four huge pillar legs, its LONG NECK raised high in a gentle S-curve with a small head on top, a massive barrel body, and a long thick tail curved round close beside its flank to the ground. Moss-green hide with soft ochre bands across the back and a cream belly and throat."
dino("foe-brontosaurus", "Brontosaurus", "a brontosaurus", 24.0, "quad", 20,
     "A brontosaurus, 24 ft tall at the top of its head, a massive body about 17 ft long with its tail curved close: an enormous long-necked plant-eater on four huge pillar legs, its long thick neck raised high in a gentle S-curve with a small head on top, a deep barrel body, and a long thick tail curved round close beside its flank to the ground. Moss-green hide with soft ochre bands across the back and a cream belly and throat.",
     "one enormous long-necked four-legged dinosaur with a small head", ["a very long neck raised high with a small head", "four huge pillar legs"], length=17,
     tags=["brontosaurus", "apatosaurus", "brachiosaurus", "diplodocus", "sauropod", "long neck", "longneck"], srd=["brontosaurus", "apatosaurus", "brachiosaurus"], qwen=q("a brontosaurus", D, "quad"))

D = "a pterodactyl (a pteranodon): a flying reptile standing on the ground on all fours, its big leathery WINGS FOLDED against its arms so it walks on its folded wing-knuckles and two small back feet, a long pointed toothless BEAK, and a long bony CREST sweeping back from the back of its head. Ochre-brown and moss-green leathery skin, a cream chest, a burgundy crest."
FLYP = ("Create a new single asset in the Turnip Works house style (heroic hand-painted): a painted tabletop miniature FIGURE of {s}, FLYING.\n\nThe supplied image is THIS SAME CREATURE'S OWN STANDING FIGURE, already made in this set. Make a second figure of the SAME individual: the SAME painting style and paint scheme, the same colours and markings, the same head, crest, beak and proportions, the same chunkiness and level of detail, the same lighting and the same flat blue background. Only the POSE changes: now it is FLYING.\n\n")
dino("foe-pterodactyl", "Pterodactyl", "a pterodactyl (a pteranodon)", 6.0, "quad", 10,
     "A pterodactyl (a pteranodon), 6 ft tall at the top of its crest, standing on the ground on all fours with its big leathery wings FOLDED tight against its arms, walking on its folded wing-knuckles and two small back feet: a long pointed toothless beak and a long bony crest sweeping back from the back of its head. Ochre-brown and moss-green leathery skin, a cream chest, a burgundy crest.",
     "one pterosaur standing on all fours with folded wings, a long beak and a back-swept head crest", ["a long pointed beak and a crest sweeping back from the head", "wings folded, standing on all fours"],
     tags=["pterodactyl", "pteranodon", "pterosaur", "flying reptile", "flier"], srd=["pteranodon"], qwen=q("a pterodactyl (a pteranodon)", D, "quad"),
     fly={"prompt": FLYP.format(s="a pterodactyl (a pteranodon)") + STYLE.format(pose=FLY_POSE + " The wingspan about three times the body's length.") + "\n\nSpecific design: the same pteranodon, flying: long pointed beak, back-swept crest, wings spread wide.\n",
          "desc": "one flying pterosaur with its wings spread wide, a long beak and a back-swept crest", "must": ["two wings spread wide", "a long beak and a head crest"], "qwen": QFLY})

D = "a quetzalcoatlus: a GIANT flying reptile standing tall on the ground on all fours like a giraffe-sized stork, its huge leathery WINGS FOLDED against its long front limbs so it stands on its folded wing-knuckles and two back feet, a very long stiff NECK held up high, and an enormous long pointed toothless BEAK on a big head with a low crest. Ochre and warm-brown leathery skin with a cream neck and chest, a burgundy-red crest and beak tip."
dino("foe-quetzalcoatlus", "Quetzalcoatlus", "a quetzalcoatlus", 16.0, "quad", 15,
     "A quetzalcoatlus, 16 ft tall at the top of its head, a giant flying reptile standing tall on the ground on all fours like a giraffe-sized stork, its huge leathery wings FOLDED against its long front limbs so it stands on its folded wing-knuckles and two back feet: a very long stiff neck held up high and an enormous long pointed toothless beak on a big head with a low crest. Ochre and warm-brown leathery skin with a cream neck and chest, a burgundy-red crest and beak tip.",
     "one giant long-necked pterosaur standing tall on all fours with folded wings and an enormous beak", ["a very long neck held high and an enormous beak", "wings folded, standing on all fours"],
     tags=["quetzalcoatlus", "azhdarchid", "pterosaur", "giant pterosaur", "flying reptile", "flier"], srd=["quetzalcoatlus"], qwen=q("a quetzalcoatlus", D, "quad"),
     fly={"prompt": FLYP.format(s="a quetzalcoatlus") + STYLE.format(pose=FLY_POSE + " A HUGE wingspan, about four times the body's length; the long neck stretched forward, the enormous beak pointing ahead.") + "\n\nSpecific design: the same quetzalcoatlus, flying: enormous beak, long neck stretched forward, giant wings spread wide.\n",
          "desc": "one giant flying pterosaur with a long neck, an enormous beak and its huge wings spread wide", "must": ["two huge wings spread wide", "a long neck and an enormous beak"], "qwen": QFLY})

if __name__ == "__main__":
    (HERE / "set/prompts").mkdir(parents=True, exist_ok=True)
    (HERE / "set/assets.json").write_text(json.dumps({"assets": F}, indent=1) + "\n")
    for a in F: (HERE / "set/prompts" / f"{a['id']}.spec.md").write_text(a["prompt"] + "\n\n--- qwen ---\n" + a["qwen"] + "\n")
    print(len(F), "specs:", ", ".join(f"{a['id']} ({a['base_ft']} ft base, {a['height_ft']['body']} ft)" for a in F))

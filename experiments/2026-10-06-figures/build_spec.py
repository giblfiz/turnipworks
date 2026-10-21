#!/usr/bin/env python3
"""Figures pilot (Harry 2026-10-06): pawns will be 3D FIGURES. Four test figures chosen for the hard cases of
image-to-3D: thin blade + hard armour, thin staff + cloth + pointed hat, a small non-human with a spear, a quadruped.
No base in the mesh: the base is added in the engine. Writes assets.json for gen.py (plates from the FREE Codex image
route, a figure-specific blind gate, BiRefNet matte).
    python3 build_spec.py
"""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent
STYLE_REF = str(HERE.parents[1] / "style-references/heroic-handpainted-tavern-v1.png")   # the prop batches' reference
HEAD = ("Create a new single asset in the Turnip Works house style (heroic hand-painted): a painted tabletop miniature FIGURE of {subject}.\n\n"
        "The supplied image shows the furniture and rooms this figure will stand among. Use it only as a guide to the painting style, colours and chunkiness, "
        "so the figure belongs on the same table; do not copy its content.")
STYLE = """Geometry: heroic-scale tabletop miniature proportions: stout and chunky, slightly oversized head, hands, feet and weapons; thick limbs; broad simple shapes; deep readable folds and plates rather than fine detail. Weapons and staffs are THICK like on a wargaming miniature (a blade as thick as a thumb, a shaft as thick as a wrist). Hands are simple chunky fists or mitten shapes. Every part thick enough to reconstruct as 3D geometry and to survive as a printed tabletop piece.
Finish: FULLY PAINTED in full colour, diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights, low-frequency surface detail, mostly matte. A simple readable painted face.
Palette: rich but softened burgundy, moss green, ochre, cream, warm honey leather and wood, warm grey steel, used where they suit the figure. NO blue, teal or cyan anywhere on the figure (the background is a blue mask).
Avoid: grey unpainted primer, bare plastic or pewter, a bronze or stone statue look; photorealism, plastic toy gloss, strong reflections, black outlines, hard cel-shading bands, comic inking, flat vector art, anime or chibi proportions; thin fragile parts, loose straps, flying cloaks, capes, banners, chains, feathers or hair strands sticking out; glow, magic effects, sparks, smoke; text, logos, emblems; multiple views, variants, a turnaround sheet or a grid in one image.

Pose: ONE single full figure, the WHOLE body in frame from the top of the head (or hat) to the soles of the feet, standing still in a clear, stable, readable classic miniature pose (not a T-pose, not an action leap, not a crouch). Limbs and weapon are held SLIGHTLY AWAY from the body with clear background visible in the gaps, so nothing fuses together. Feet planted FLAT on the same level, as if on an invisible floor.
NO BASE: no base, no ground disc, no plinth, no pedestal, no rock, no grass tuft, no patch of floor under the feet. The figure floats on the plain background, standing on nothing. No cast shadow and no dark blob under the feet.

Presentation for image-to-3D: exactly one complete figure, centered, three-quarter FRONT view (turned about 30 degrees, face and chest clearly visible) from very slightly above eye level, generous clear space around every edge, perfectly uniform solid chroma-blue background, no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts and no dark shadowed side, no environment, no scenery, no additional objects or other figures. The blue background is a removable mask and must not reflect blue light onto the figure."""
NOT = ["any base, ground disc, plinth, pedestal, rock or patch of ground under the feet",
       "a cast shadow or dark blob under the feet",
       "the figure cropped by the frame anywhere (head, hat, weapon tip, feet, tail)",
       "limbs fused together or fused to the body with no gap where the spec asks for a gap",
       "a missing, broken or doubled weapon; extra weapons not asked for",
       "more than one figure, or several views of the figure",
       "an unpainted grey, metal or stone statue look"]
SHAFT = {"fig-fighter": "sword", "fig-wizard": "staff", "fig-goblin": "spear", "fig-goblin-b": "spear"}   # the thin straight part measure.py tracks
def A(id, subject, height, design, desc, must):
    prompt = HEAD.format(subject=subject) + "\n\n" + STYLE + "\n\nSpecific design: " + design + "\n"
    return {"id": id, "object": id, "family": "figures", "group": "round2" if id.endswith("-b") else "pilot", "source": "generate", "lane": "3d", "generation": "figure",
            "subject": subject, "height_ft": height, "shaft": SHAFT.get(id), "base_ft": 5, "prompt": prompt, "refs": [STYLE_REF], "gate_refs": [],
            "gate": {"desc": desc, "must": list(must), "must_not": NOT}}
assets = [
 A("fig-fighter", "an armoured human fighter with sword and shield", {"body": 6.0, "figure_top": 6.0, "overall": 6.0},
   "A human fighter 6 ft tall, in warm grey steel plate armour over a burgundy padded tunic, open-faced helmet so the face shows, leather belt, sturdy boots. "
   "The RIGHT hand holds a straight broad longsword out to the side, arm bent, blade pointing outward and a little upward, the whole blade clear of the body and the tip NO HIGHER than the top of the helmet. "
   "The LEFT arm carries a round wooden shield with a steel rim and boss (plain painted moss green, no emblem), held out at the side, a little away from the body and not covering the torso. "
   "Feet shoulder-width apart with a clear gap between the legs, both boots flat on the ground. No cape, no scabbard, no plume.",
   "one armoured human fighter, standing, holding one sword in one hand and one round shield on the other arm",
   ["the whole figure head to toe, both feet visible", "exactly one sword, complete from pommel to tip, and exactly one shield",
    "a visible gap between the two legs, and the sword blade clear of the body", "fully painted in colour"]),
 A("fig-wizard", "a robed human wizard with a staff and a pointed hat", {"body": 6.0, "figure_top": 7.0, "overall": 7.0},
   "An old human wizard, 6 ft tall to the crown of the head and 7 ft to the tip of his hat, with a short full grey beard (a solid chunky beard shape lying on the chest, not strands). "
   "A tall pointed wide-brimmed hat with a stout slightly bent cone, in burgundy. A heavy burgundy robe with a moss-green trim and an ochre rope belt; the robe ends at the ANKLES so both leather shoes are clearly visible, flat on the ground, with the hem hanging straight (no train, no flying cloth). "
   "The RIGHT hand holds a thick gnarled wooden STAFF upright out at his side, about a hand's width away from the robe along its whole length, its foot resting on the same ground level as his shoes and its knobbly top at about 6.5 ft (below the hat tip). "
   "The LEFT arm hangs a little away from the body, hand open. No glow, no crystal, no book, no familiar.",
   "one robed wizard with a pointed hat, standing, holding one long wooden staff upright in one hand",
   ["the whole figure from hat tip to shoes, both shoes visible below the robe", "exactly one staff, complete from top to foot, standing clear of the robe with background visible between staff and body",
    "a pointed hat, complete", "fully painted in colour"]),
 A("fig-goblin", "a goblin with a short spear", {"body": 3.5, "figure_top": 3.5, "overall": 4.5},
   "A small goblin only 3.5 ft tall: NOT a human child and not human proportions: a big head about a third of its height, large pointed ears sticking out sideways (thick, short ears), a long nose, olive-green skin, a hunched wiry body with long arms, short bowed legs and big bare flat feet. "
   "It wears a ragged ochre-brown leather jerkin and a rope belt. Its RIGHT hand holds a short SPEAR upright at its side like a sentry, about a hand's width away from the body: a thick wooden shaft with a simple leaf-shaped iron head, the butt resting on the same ground level as the feet and the tip at about 4.5 ft, a little above the top of its head. "
   "The LEFT arm hangs away from the body, hand in a loose fist. Legs apart with a clear gap between them, both feet flat. Mouth closed in a crooked grin. No shield, no hood, no other gear.",
   "one small goblin (a small green-skinned humanoid creature with a big head and pointed ears), standing, holding one short spear upright in one hand",
   ["the whole figure head to feet, both feet visible", "exactly one spear, complete from tip to butt, clear of the body",
    "non-human goblin proportions (large head, pointed ears), not a human child", "a visible gap between the two legs", "fully painted in colour"]),
 A("fig-wolf", "a wolf", {"body": 3.5, "figure_top": 3.5, "overall": 3.5, "length": 5.5},
   "A big grey-brown wolf standing square on all four legs: about 2.75 ft tall at the shoulder, 3.5 ft to the tips of its ears with the head held up and alert, and about 5.5 ft long from nose to tail tip. "
   "Warm grey and brown fur with a cream chest and muzzle, painted as a FEW big chunky tufts (thick ruff at the neck), never as thin hairs. "
   "ALL FOUR legs are separately and clearly visible, each one thick and sturdy, none hidden behind another, with background visible between them and under the belly; all four paws flat on the same ground level. "
   "The tail is thick and bushy and hangs down and slightly back, clear of the hind legs. Ears upright, short and thick. Mouth closed. Seen in three-quarter front view from its front-left so the head, chest, the whole left flank and all four legs show. No collar, no saddle.",
   "one wolf (a four-legged canine animal), standing on all four legs",
   ["the whole animal from nose to tail tip and ears to paws", "FOUR separate legs all visible, with gaps between them", "a tail, complete", "two ears", "fully painted in colour"]),
# --- second round (2026-10-06, after the first Gemini reads). From the table camera (52 degrees down) the first wolf was
 # read blind as "a dog, perhaps a mastiff" and once as "a lion or hyena" (its neck ruff read as a mane), and the goblin's
 # brown spear was "a small dark object". One changed plate each, to see whether the PROMPT fixes the read from above.
 A("fig-wolf-b", "a grey wolf", {"body": 3.5, "figure_top": 3.5, "overall": 3.5, "length": 5.5},
   "A lean, rangy GREY timber wolf standing square on all four legs: about 2.75 ft tall at the shoulder, 3.5 ft to the tips of its ears with the head held up and forward, and about 5.5 ft long from nose to tail tip. "
   "Unmistakably a wolf and not a dog, lion or hyena: a LONG narrow muzzle, tall pointed upright ears, long legs, a deep narrow chest, a level back. NO mane and NO neck ruff: the neck fur is short and lies flat. "
   "Light warm grey fur with a darker charcoal-grey saddle along the back and a cream muzzle, chest and legs (grey, not brown), painted as a few big smooth tufts, never as thin hairs. "
   "ALL FOUR legs are separately and clearly visible, each one thick and sturdy, none hidden behind another, with background visible between them and under the belly; all four paws flat on the same ground level. "
   "The tail is long, thick and bushy with a dark tip, carried low and straight out behind, clear of the hind legs. Mouth closed. Seen in three-quarter front view from its front-left so the head, chest, the whole left flank and all four legs show. No collar, no saddle.",
   "one wolf (a four-legged canine animal), standing on all four legs",
   ["the whole animal from nose to tail tip and ears to paws", "FOUR separate legs all visible, with gaps between them", "a tail, complete", "two ears", "fully painted in colour"]),
 A("fig-goblin-b", "a goblin with a spear", {"body": 3.5, "figure_top": 3.5, "overall": 5.0},
   "A small goblin only 3.5 ft tall: NOT a human child and not human proportions: a big head about a third of its height, large pointed ears sticking out sideways (thick, short ears), a long nose, olive-green skin, a hunched wiry body with long arms, short bowed legs and big bare flat feet. "
   "It wears a ragged ochre-brown leather jerkin and a rope belt. Its RIGHT hand holds a SPEAR upright at its side like a sentry, a full hand's width away from the body and the ear: an extra-THICK shaft of PALE bone-white wood (as thick as its wrist, much paler than its skin and clothes) with a big, broad, bright polished steel leaf-shaped head and a short burgundy cloth binding below the head. The butt rests on the same ground level as the feet and the tip is at about 5 ft, clearly well above the top of its head. "
   "The LEFT arm hangs away from the body, hand in a loose fist. Legs apart with a clear gap between them, both feet flat. Mouth closed in a crooked grin. No shield, no hood, no other gear.",
   "one small goblin (a small green-skinned humanoid creature with a big head and pointed ears), standing, holding one spear upright in one hand",
   ["the whole figure head to feet, both feet visible", "exactly one spear, complete from tip to butt, clear of the body, its tip clearly higher than the head",
    "non-human goblin proportions (large head, pointed ears), not a human child", "a visible gap between the two legs", "fully painted in colour"]),
]
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets")

## Culture packs: Japan (2026-11-06, cultures-a)

Built: 33 meshes in run `jpn-01` (two wall families, two door leaves, a vermilion post, a bamboo fence, 27 props), floors (tatami, cedar, moss), stepping stones, seven room icons and the type icon. Prompts `experiments/2026-11-06-cultures-a/spec_jpn.py`. Wanted, not built:
- **A sliding door** (shoji, fusuma, the street koshido): the engine hangs every leaf on a hinge. The leaves exist; a slide is an openables change (`engine/client/assets.js`).
- **A kawara roof style** (silver-grey interlocking clay tiles, a curved hip-and-gable): the house uses `slate` today. One roofing plate + `experiments/2026-10-11-roof-sections/build_sections.py`.
- An **engawa** (the veranda along a tatami room's garden side), **tatami edge-joining** across a room (one mat pattern per cell today), **noren** curtains at a shop door, a **kamado** stove for a farmhouse kitchen (doma), a Buddhist temple (the pack's sacred space is Shinto only).

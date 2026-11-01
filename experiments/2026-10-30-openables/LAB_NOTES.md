# Openables — LAB_NOTES (2026-10-30)

Harry: "door opening and closing ... we might really need to go over *all* the opens and closes, because a lot of them
don't show state." Census and table: INVENTORY.md. Code: engine/core/openables.js (what opens), engine/client/
openlook.js (how), world.js openTo/openStep (the animation), assets.js specOf/meshVisual. Test: engine/test/
browser_openables.py.

## Timeline
- 10:55 Census from the library: 53 objects say `open` (37 kinds once the "-open" twins are set aside); 8 more kinds
  had an open twin hidden from the catalog and no Open (wardrobe, cupboard, bread oven, iron maiden, salt box, two
  small boxes, the small window); floor-trapdoor and oubliette-hatch are hatches nothing opens. No Alignment Bench hinge
  records exist on the server (GET /tuner/hinges = {}), so only the cage door moved (assets.js HOUSE_HINGES).
- 11:20 Baseline shots (85 SKUs, shut and forced open) and Gemini's blind read: 127/170 = 74.7%; 26 kinds read no state.
- 11:50 First pass: leaves swing 100° (the cage door's hinge), pairs part, the portcullis slides, swaps match their own
  variant. after1: 56.5%. Two causes, both mine: (1) a lone door turned 100° in an empty field is just a door turned
  round, so doors were re-shot between two wall sections as they stand in the game; (2) the open twin was dropped on
  the GM's own tab when the relay's copy of the change replaced the optimistic entity (`r.entity !== e`): fixed by
  comparing the open state and the visual key instead.
- 12:30 Fog of war is on by default: a player with no pawn sees nothing, and the fog worker drops her selection after
  any change; the suite turns fog off first (pdoors covers fog).
- 13:00 after2: 84.7%. Three kinds whose SHUT model reads open (bread oven, farrier's box, grooming box) left
  not-openable (core SHUT_LOOKS_OPEN). browser_pdoors FPV "a second click shuts it" failed: the swung leaf left the
  doorway, the click walked. Fixed with an unseen pick box at the shut place (the open twins always filled the
  doorway, so this keeps the old click).
- 13:30 The FPV walking agent: every open door was drawn SHUT on main (the generated leaf swapped to a stone frame
  twin, or nothing), walkers passed through it. Rebased on ba88c19e. Its walk_stills with 100° leaves: Gemini FIX, a
  leaf "standing across" the 5-ft hallway. Leaves now swing 175° to lie flat by the wall (hinge offset from the wall's
  middle by half of the wall's half thickness plus the leaf's): Gemini OK, first person and map, nothing clipping.
- 14:10 after3: 143/170 = 84.1%, 16 kinds with no visible state (31 before). browser_bars read the rig at
  `userData.hinge` (the tuner's mark): the new rigs mark it too.

## Rules kept
- Only placement transforms and the hinge rig on generated meshes (the 2026-10-02 pilot's rule): the double door is a
  split of the one mesh at its middle, by triangle, each half about its own outer edge. No caps, no rims.
- Never judge visuals here: every look verdict is Gemini's, blind, with the labels listed first.

## Traps
- agy-run: `< /dev/null` and `flock /tmp/agy.lock`; ~5 min per 24 images.
- An open leaf is pickable only through the proxy box: halo code skips it (`selFx`), pickAll does not.

# Genres icon generation — 2026-11-12

Built-in image generation only. All four references viewed and attached as style references for every request.

| File | Verdict | Reason |
|---|---|---|
| raw/genres-a-attempt1.png | FAIL | Clear matte dragon/rocket composition, but background is transparent (corner RGBA 0,0,0,1), not opaque chroma green. |
| raw/genres-a-attempt2.png | FAIL | Composition/style pass visually; opaque green background has pixel variation (e.g. 2,250,4), not uniform #00FF00. |
| raw/genres-a.png (attempt 3) | FAIL — retry cap reached | Clear dragon perched on rocket, matte warm style, no text/recognizable franchise; background still varies (corner 21,241,13; 70 colors in 40×40 corner). |
| raw/genres-b-attempt1.png | FAIL | Both subjects clear and face each other, matte style; textured green background fails uniform-color requirement. |
| raw/genres-c-attempt1.png | FAIL | Flying dragon and saucer clear in compact cluster, matte style; textured green background fails uniform-color requirement. |
| raw/genres-b.png (attempt 2) | FAIL | Dragon/ship readable at 48px, matte rendering; background still nonuniform (corner 18,238,14; 76 colors in 40×40 corner). |
| raw/genres-c.png (attempt 2) | FAIL | Circling dragon and overlapping saucer readable at 48px; background still nonuniform (corner 18,242,17; 69 colors in 40×40 corner). |

## Final inspection

Viewed every output at full size and compared all attempts side by side with all four references at 128px and 48px (inspection sheet: /tmp/genres-inspection.png). All three chosen compositions show both subjects, with no text, recognizable franchise design, outlines, gloss, floor, or drop shadow. Warm matte palette is consistent with siblings, although the dragons are more cartoon-like and heavily textured. B is wider/flatter and reads smaller than A/C at 48px. No bright green subject material or visible green reflection.

None passes the strict uniform #00FF00 requirement. A received the maximum two retries; B and C received one targeted retry each, stopped because the same background defect persisted across all opaque generations. Raw outputs remain unmodified; no code-drawn art or background corrections. No quota/rate limit encountered.

## Prompt set

All requests attached ref/anchor-type-TAV.png, ref/genre-fantasy.png, ref/genre-modern.png, ref/genre-cultures.png as style references.

A initial:
Create one square original Genres UI icon. Attached images are STYLE REFERENCES ONLY: first is the tavern style anchor, others are finished sibling icons. Match their chunky quiet matte painted 3D rendering, restrained warm palette, soft upper-left lighting, three-quarter camera slightly above. Simple bold silhouette readable at 48px, minimal detail, no outlines or comic ink, no gloss or photorealism. Dragon muted burgundy with ochre details; spaceship cream and blue-gray. One centered compact vignette filling about 80% of frame with clear margins on every edge. Perfectly uniform solid chroma green #00FF00 background edge to edge, no gradients, no floor plane, no drop shadow, no green light reflection and no bright green in subject. No frame or badge. Entirely generic original dragon and spaceship, no recognizable franchise designs, no text letters logos emblems. Composition: a small chunky dragon perched and curled on top of a small rounded retro rocket-ship standing upright on its fins. Dragon and rocket both clearly readable.

A retry 1 appended:
 CRITICAL OUTPUT: OPAQUE image, alpha 255 everywhere. Paint the entire background literal vivid RGB(0,255,0) green, including all empty spaces. Do NOT remove the background or make transparency. The green background of the FIRST reference is mandatory; ignore transparency in other references.

A retry 2 additionally appended:
 Background must be a perfectly flat digital color field exactly #00FF00, without texture, noise, grain, vignette, shading, lighting, or color variation of any kind. Do not texture the background. Keep painted texture only inside the dragon and spaceship.

B initial:
Create one square original Genres UI icon. Attached images are STYLE REFERENCES ONLY: first is the tavern style anchor, others are finished sibling icons. Match their chunky quiet matte painted 3D rendering, restrained warm palette, soft upper-left lighting, three-quarter camera slightly above. Simple bold silhouette readable at 48px, minimal detail, no outlines or comic ink, no gloss or photorealism. Dragon muted burgundy with ochre details; spaceship cream and blue-gray. One centered compact vignette filling about 80% of frame with clear margins on every edge. Perfectly uniform solid chroma green #00FF00 background edge to edge, no gradients, no floor plane, no drop shadow, no green light reflection and no bright green in subject. No frame or badge. Entirely generic original dragon and spaceship, no recognizable franchise designs, no text letters logos emblems. Composition: a small dragon and a small sleek spaceship side by side, facing each other, the dragon's wings half-open, the ship's nose toward it. Both form one compact balanced cluster. CRITICAL OUTPUT: OPAQUE image, alpha 255 everywhere. Paint the entire background literal vivid RGB(0,255,0) green, including all empty spaces. Do NOT remove the background or make transparency. The green background of the FIRST reference is mandatory; ignore transparency in other references. Background must be a perfectly flat digital color field exactly #00FF00, without texture, noise, grain, vignette, shading, lighting, or color variation of any kind. Do not texture the background. Keep painted texture only inside the dragon and spaceship.

B retry appended: Correct the background: use a pure untextured digital green matte, RGB 0 255 0. Previous attempts had grain and RGB 17 241 15. These are unacceptable: only the exact specified solid green. Reduce overall width to 80% of canvas and bring subjects closer together.

C initial:
Create one square original Genres UI icon. Attached images are STYLE REFERENCES ONLY: first is the tavern style anchor, others are finished sibling icons. Match their chunky quiet matte painted 3D rendering, restrained warm palette, soft upper-left lighting, three-quarter camera slightly above. Simple bold silhouette readable at 48px, minimal detail, no outlines or comic ink, no gloss or photorealism. Dragon muted burgundy with ochre details; spaceship cream and blue-gray. One centered compact vignette filling about 80% of frame with clear margins on every edge. Perfectly uniform solid chroma green #00FF00 background edge to edge, no gradients, no floor plane, no drop shadow, no green light reflection and no bright green in subject. No frame or badge. Entirely generic original dragon and spaceship, no recognizable franchise designs, no text letters logos emblems. Composition: a small dragon in flight circling a small round flying-saucer-style spaceship, the two overlapping as one compact cluster. Clearly airborne dragon with curved body and wings, separate readable saucer silhouette. CRITICAL OUTPUT: OPAQUE image, alpha 255 everywhere. Paint the entire background literal vivid RGB(0,255,0) green, including all empty spaces. Do NOT remove the background or make transparency. The green background of the FIRST reference is mandatory; ignore transparency in other references. Background must be a perfectly flat digital color field exactly #00FF00, without texture, noise, grain, vignette, shading, lighting, or color variation of any kind. Do not texture the background. Keep painted texture only inside the dragon and spaceship.

C retry appended: Correct the background: use a pure untextured digital green matte RGB 0 255 0. Previous attempt had grain and RGB 17 241 13. Only the exact specified solid green is acceptable. Slightly overlap dragon tail and saucer edge to unite the cluster.


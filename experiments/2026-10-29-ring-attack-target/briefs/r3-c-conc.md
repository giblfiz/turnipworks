# Brief: 1 painted ring icons, charcoal set (batch c-conc)

Use your BUILT-IN image generation tool (the imagegen skill; no API calls, no scripts that draw, no SVG, no hand-built
pixels, no post-processing of pixels). For EVERY image, pass these reference images to the generator as style references
(they are our own earlier icons of the same set; match their look, not their subjects):
- experiments/2026-10-29-ring-attack-target/refs3/charcoal--pawn.cond.poisoned.png
- experiments/2026-10-29-ring-attack-target/refs3/charcoal--pawn.cond.stunned.png
- experiments/2026-10-29-ring-attack-target/refs3/charcoal--pawn.cond.unconscious.png
Ask for a transparent background. Save each generated PNG unmodified (no resize, recolour, mask or background removal) to
its path below, and write `<path>.json` beside it with "prompt", "references" (the files you passed, and the edit source if
any) and "output" (the original generated file path the tool returned).

### pawn.cond.concentrating  ->  `experiments/2026-10-29-ring-attack-target/sources/charcoal--pawn.cond.concentrating.png`
Generate with this prompt, verbatim, with the reference images attached as style references:
> Use case: stylized-concept. Paint exactly ONE original Turnip Works tabletop condition pictogram for concentrating: TWO cupped ivory cartoon hands holding up ONE big glowing sky-blue magic orb with a bright white core between them, three short sky-blue sparks around the orb: holding a spell. No face, no head. Bold dark outlines, chunky shapes, floating alone. Dominant subject colour key: glowing sky blue; keep this colour strongly visible, not just a tiny accent. Heroic hand-painted style D, chunky matte painted forms, broad soft bevels, restrained brushwork. Center on a dark charcoal circular ground with a quiet thin slate rim. Upper-left light. Straight-on circular badge; outer circle fills 94 percent of square canvas, pictogram fills 80 percent of disc. Readable at31px and smaller: bold silhouette, thick features, generous negative space, absolutely no tiny detail. Native transparent alpha outside the circle. No text, lettering, numbers, watermark, decorative flourishes or extra scene. Our own design, no trademarked game iconography. Style reference: the attached images are our own earlier Turnip Works ring icons from this same set; match their circular ground, rim, painted brushwork, bevels, lighting and palette exactly, as if painted by the same artist in the same sitting. Do not copy their subjects. No third-party references.

Self-QA after each image (open it and look; and check alpha with
`python3 -c "from PIL import Image; im=Image.open('PATH').convert('RGBA'); w,h=im.size; print(im.size, [im.getpixel(p)[3] for p in [(2,2),(w-3,2),(2,h-3),(w-3,h-3)]], im.getpixel((w//2,h//2))[3])"`):
1. Corners alpha 0 and a solid disc (centre alpha about 250-255; the generator's native 251-254 is normal).
2. ONE circular badge whose ground, rim, disc size, brushwork and palette match the reference icons: same artist, same set.
3. The subject is exactly the one asked for, no text or numbers, no extra symbols.
4. Shrunk to 31 px it still reads: thick shapes only.
If a check fails, regenerate that one (at most 3 tries per image in all) and keep the best at the path. Never leave an
image missing: if no try passes, keep the best try and say so.
Reviewer note for this batch: The previous try (a yellow head with a gold ring) read blind as Stunned, the set's existing yellow head with stars. Concentrating must share nothing with Stunned: no head, no yellow, no stars; hands holding a glowing sky-blue orb.
Log tries, failures and final files in `experiments/2026-10-29-ring-attack-target/logs/r3-c-conc.md`. Then stop.

# Brief: 2 painted ring icons, charcoal set (batch c-pawn)

Use your BUILT-IN image generation tool (the imagegen skill; no API calls, no scripts that draw, no SVG, no hand-built
pixels, no post-processing of pixels). For EVERY image, pass these reference images to the generator as style references
(they are our own earlier icons of the same set; match their look, not their subjects):
- experiments/2026-10-29-ring-attack-target/refs3/charcoal--pawn.give.png
- experiments/2026-10-29-ring-attack-target/refs3/charcoal--pawn.sheet.png
- experiments/2026-10-29-ring-attack-target/refs3/charcoal--pawn.travel.png
Ask for a transparent background. Save each generated PNG unmodified (no resize, recolour, mask or background removal) to
its path below, and write `<path>.json` beside it with "prompt", "references" (the files you passed, and the edit source if
any) and "output" (the original generated file path the tool returned).

### pawn.eyes  ->  `experiments/2026-10-29-ring-attack-target/sources/charcoal--pawn.eyes.png`
Generate with this prompt, verbatim, with the reference images attached as style references:
> Use case: stylized-concept. Paint exactly ONE original Turnip Works fantasy tabletop UI pictogram: One big muted-teal pawn silhouette whose round head holds ONE large open ivory eye with a dark teal iris, looking straight out at the viewer: see through this pawn's eyes. Heroic hand-painted style D: chunky miniature-safe forms, broad soft bevels, matte painted gradients, restrained brushwork, no glossy plastic. Centered on a dark charcoal circular ground, quiet thin slate rim. Straight-on circular badge, subject fills 80 percent of the disc, outer disc fills 94 percent of square canvas. Light from upper left. Palette: warm ochre wood, muted teal, ivory, slate, red only for danger or pin. Must read at 31 pixels: extremely simple silhouette, thick features, generous negative space, no tiny detail. Transparent outside the circle, preserve actual alpha. No text, lettering, numbers, watermark, decorative flourishes, extra symbols, or scene. Style reference: the attached images are our own earlier Turnip Works ring icons from this same set; match their circular ground, rim, painted brushwork, bevels, lighting and palette exactly, as if painted by the same artist in the same sitting. Do not copy their subjects. No third-party references.

### pawn.choose  ->  `experiments/2026-10-29-ring-attack-target/sources/charcoal--pawn.choose.png`
Generate with this prompt, verbatim, with the reference images attached as style references:
> Use case: stylized-concept. Paint exactly ONE original Turnip Works fantasy tabletop UI pictogram: One stout muted-teal pawn standing on its round base with ONE large bold ivory checkmark floating at its upper right: choose this pawn as yours. Heroic hand-painted style D: chunky miniature-safe forms, broad soft bevels, matte painted gradients, restrained brushwork, no glossy plastic. Centered on a dark charcoal circular ground, quiet thin slate rim. Straight-on circular badge, subject fills 80 percent of the disc, outer disc fills 94 percent of square canvas. Light from upper left. Palette: warm ochre wood, muted teal, ivory, slate, red only for danger or pin. Must read at 31 pixels: extremely simple silhouette, thick features, generous negative space, no tiny detail. Transparent outside the circle, preserve actual alpha. No text, lettering, numbers, watermark, decorative flourishes, extra symbols, or scene. Style reference: the attached images are our own earlier Turnip Works ring icons from this same set; match their circular ground, rim, painted brushwork, bevels, lighting and palette exactly, as if painted by the same artist in the same sitting. Do not copy their subjects. No third-party references.

Self-QA after each image (open it and look; and check alpha with
`python3 -c "from PIL import Image; im=Image.open('PATH').convert('RGBA'); w,h=im.size; print(im.size, [im.getpixel(p)[3] for p in [(2,2),(w-3,2),(2,h-3),(w-3,h-3)]], im.getpixel((w//2,h//2))[3])"`):
1. Corners alpha 0 and a solid disc (centre alpha about 250-255; the generator's native 251-254 is normal).
2. ONE circular badge whose ground, rim, disc size, brushwork and palette match the reference icons: same artist, same set.
3. The subject is exactly the one asked for, no text or numbers, no extra symbols.
4. Shrunk to 31 px it still reads: thick shapes only.
If a check fails, regenerate that one (at most 3 tries per image in all) and keep the best at the path. Never leave an
image missing: if no try passes, keep the best try and say so.

Log tries, failures and final files in `experiments/2026-10-29-ring-attack-target/logs/r3-c-pawn.md`. Then stop.

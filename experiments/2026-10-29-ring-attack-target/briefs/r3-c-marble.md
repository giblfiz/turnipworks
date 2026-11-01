# Brief: 1 painted ring icons, charcoal set (batch c-marble)

Use your BUILT-IN image generation tool (the imagegen skill; no API calls, no scripts that draw, no SVG, no hand-built
pixels, no post-processing of pixels). For EVERY image, pass these reference images to the generator as style references
(they are our own earlier icons of the same set; match their look, not their subjects):
- experiments/2026-10-29-ring-attack-target/refs3/charcoal--roof.style.flat.png
- experiments/2026-10-29-ring-attack-target/refs3/charcoal--roof.style.slate.png
- experiments/2026-10-29-ring-attack-target/refs3/charcoal--roof.style.thatch.png
Ask for a transparent background. Save each generated PNG unmodified (no resize, recolour, mask or background removal) to
its path below, and write `<path>.json` beside it with "prompt", "references" (the files you passed, and the edit source if
any) and "output" (the original generated file path the tool returned).

### roof.style.marble  ->  `experiments/2026-10-29-ring-attack-target/sources/charcoal--roof.style.marble.png`
Generate with this prompt, verbatim, with the reference images attached as style references:
> Use case: stylized-concept. Paint exactly ONE original Turnip Works fantasy tabletop roof material option pictogram: One pitched roof wedge clad in a few very LARGE smooth polished BRIGHT WHITE MARBLE panels with bold wavy grey veins running across them; flat gleaming panels with fine straight joints, NOT overlapping shingles or slates, NOT grey or blue. Dominant colour: white marble. Roof only, no whole house, no walls, no decorative architecture. Heroic hand-painted style D: chunky miniature-safe forms, broad soft bevels, matte painted gradients and restrained brushwork. Centered on a dark charcoal circular ground with quiet thin slate rim. Upper-left light. Straight-on circular badge; subject fills80percent of disc; outer disc fills94percent of square canvas. Must read at31px: thick forms, simple countable rows, broad negative space. Distinguish this option from sibling options by shape and structure, not only colour. Native transparent alpha outside circle. No text, lettering, numbers, watermark, extra symbols, tiny detailing or scene. Style reference: the attached images are our own earlier Turnip Works ring icons from this same set; match their circular ground, rim, painted brushwork, bevels, lighting and palette exactly, as if painted by the same artist in the same sitting. Do not copy their subjects. No third-party references.

Self-QA after each image (open it and look; and check alpha with
`python3 -c "from PIL import Image; im=Image.open('PATH').convert('RGBA'); w,h=im.size; print(im.size, [im.getpixel(p)[3] for p in [(2,2),(w-3,2),(2,h-3),(w-3,h-3)]], im.getpixel((w//2,h//2))[3])"`):
1. Corners alpha 0 and a solid disc (centre alpha about 250-255; the generator's native 251-254 is normal).
2. ONE circular badge whose ground, rim, disc size, brushwork and palette match the reference icons: same artist, same set.
3. The subject is exactly the one asked for, no text or numbers, no extra symbols.
4. Shrunk to 31 px it still reads: thick shapes only.
If a check fails, regenerate that one (at most 3 tries per image in all) and keep the best at the path. Never leave an
image missing: if no try passes, keep the best try and say so.
Reviewer note for this batch: The first try read blind as 'overlapping slate shingles', the same as the set's existing Slate option. Marble must be unmistakably bright white polished stone panels with bold grey veins.
Log tries, failures and final files in `experiments/2026-10-29-ring-attack-target/logs/r3-c-marble.md`. Then stop.

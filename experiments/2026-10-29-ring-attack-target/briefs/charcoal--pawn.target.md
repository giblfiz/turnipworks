# Brief: one painted ring icon, charcoal set, pawn.target ("Target")

Make ONE image with your BUILT-IN image generation tool (no API calls, no scripts that draw, no SVG, no hand-built pixels).
Use this prompt for the generation, verbatim:

> Use case: stylized-concept. Paint exactly ONE original Turnip Works fantasy tabletop UI pictogram: ONE large muted-teal pawn silhouette standing at the center, held inside a bold deep-crimson TARGET RETICLE: one thick crimson ring around the pawn with four thick crimson triangular pointers on the ring at 12, 3, 6 and 9 o'clock aimed INWARD at the pawn. Nothing outside the ring: no corner brackets, no frame, no viewfinder marks. The pawn fills most of the ring's inside with a clear dark gap between pawn and pointers. Perfectly symmetric; chunky shapes, no thin crosshair hairlines, no bullseye stripes, no arrow. Reads as: this piece is marked as the target being aimed at. Heroic hand-painted style D: chunky miniature-safe forms, broad soft bevels, matte painted gradients, restrained brushwork, no glossy plastic. Centered on a dark charcoal circular ground, quiet thin slate rim. Straight-on circular badge, subject fills 80 percent of the disc, outer disc fills 94 percent of square canvas. Light from upper left. Palette: warm ochre wood, muted teal, ivory, slate, red only for danger or pin. Must read at 31 pixels: extremely simple silhouette, thick features, generous negative space, no tiny detail. Transparent outside the circle, preserve actual alpha. No text, lettering, numbers, watermark, decorative flourishes, extra symbols, or scene. Text-only original design; no third-party references.

Save the generated PNG, unmodified (no resizing, recolouring, masking or background removal), to:
`experiments/2026-10-29-ring-attack-target/sources/charcoal--pawn.target.png`
Then write `experiments/2026-10-29-ring-attack-target/sources/charcoal--pawn.target.png.json` with keys "prompt" (the exact prompt) and "output" (the original generated file path the tool returned).

This icon joins an existing family of painted ring icons. Existing members of the charcoal set, for comparison only (do NOT feed them to the generator):
- experiments/2026-10-29-ring-attack-target/refs/charcoal--pawn.damage.png
- experiments/2026-10-29-ring-attack-target/refs/charcoal--pawn.give.png
- experiments/2026-10-29-ring-attack-target/refs/charcoal--pawn.sheet.png
- experiments/2026-10-29-ring-attack-target/refs/charcoal--thing.lock.png

Self-QA, after each generation (open the image and look; also run python with Pillow to check alpha:
`python3 -c "from PIL import Image; im=Image.open('experiments/2026-10-29-ring-attack-target/sources/charcoal--pawn.target.png').convert('RGBA'); w,h=im.size; print(im.size, [im.getpixel(p)[3] for p in [(2,2),(w-3,2),(2,h-3),(w-3,h-3)]], im.getpixel((w//2,h//2))[3])"`):
1. The four corners are fully transparent (alpha 0) and the disc is solid (centre alpha about 250-255: the generator's native 251-254 is normal, the existing family has exactly that). Only an opaque background (corners not 0) or a see-through disc (centre alpha under 240) fails.
2. A single circular badge, dark charcoal ground, thin slate rim, matching the reference icons' disc size, rim and painted brushwork.
3. The subject matches the metaphor exactly; no text, numbers, extra symbols or scene.
4. Shrink it mentally to 31 px: does it still read? Thick shapes only.
5. Side by side with the reference icons it looks like the same artist and set.
If any check fails, regenerate (same prompt, up to 4 tries total) and keep only the best passing result at the output path.
Extra note from the reviewer for this regeneration: Earlier version had four corner brackets outside the ring: blind readers took them for a camera viewfinder ('focus camera'). This version must have NO marks outside the ring, a larger pawn, and crimson like the Damage heart (deep painterly red, not bright scarlet).
Log what you did (tries, what failed, final file) in `experiments/2026-10-29-ring-attack-target/logs/charcoal--pawn.target.md`. Then stop.

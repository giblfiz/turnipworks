# r3-p-roof4 — 2026-10-29

Used the built-in image generator, one edit call per icon. Each call included its accepted charcoal source and all three named parchment style references. Exact prompts, input paths and original generated output paths are recorded in each PNG's .png.json sidecar.

| Final file (under sources/) | Tries | Corner alpha | Centre alpha | Result |
|---|---:|---|---:|---|
| parchment--roof.edge.none.png | 1 | 0,0,0,0 | 253 | Retained |
| parchment--roof.edge.auto.png | 1 | 0,0,0,0 | 252 | Retained |
| parchment--roof.turrets.png | 1 | 0,0,0,0 | 253 | Retained |

All outputs are 1254 × 1254 PNGs. Copies were verified byte-identical to the original generator files. No resizing, recolouring, masking, alpha repair or pixel post-processing was applied.

Visual review of each generated image: one parchment circular badge with brass rim, matte brushwork, upper-left illumination and dark subject contours. Bare slab remains bare; automatic edge retains one five-tooth cog, recoloured slate; turret retains one round stone turret and pointed teal roof. Composition visually follows each charcoal source; no text, numbers or extra symbols observed. Geometry preservation was assessed visually, not claimed pixel-exact.

Small-size readability: broad slab, cog and turret silhouettes appear distinguishable. A literal 31 px browser-display check was attempted using untouched PNGs in HTML, but local Chrome crashed before producing a screenshot. Thus actual 31 px display verification remains incomplete. No generation failures or retries; all three first attempts retained.

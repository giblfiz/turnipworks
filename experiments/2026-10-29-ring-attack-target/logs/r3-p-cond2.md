# r3-p-cond2 — parchment condition icons

2026-10-29. Built-in imagegen only; one edit call per asset, all three specified parchment style references plus the corresponding charcoal edit source passed on every call. Transparent background requested. Saved PNGs are byte-identical copies of the original tool outputs; no pixel post-processing.

| Final file (sources/) | Tries | Corner alpha | Centre alpha | Visual review |
|---|---:|---|---:|---|
| parchment--pawn.cond.exhaustion.up.png | 1 | 0,0,0,0 | 253 | Tired ochre head, one sweat drop, one red plus at right; composition retained. |
| parchment--pawn.cond.exhaustion.down.png | 1 | 0,0,0,0 | 253 | Tired ochre head, one sweat drop, one green minus at right; composition retained. |
| parchment--pawn.cond.other..png | 1 | 0,0,0,0 | 252 | Ivory tag, dark string, one teal check; composition retained. |
| parchment--pawn.cond.other.png | 1 | 0,0,0,0 | 253 | Ivory tag, dark string, one teal plus; composition retained. |

All images: 1254 × 1254 RGBA. Opened/viewed tool output for each image: one parchment disc, brass rim, matte painted forms, dark outlines, no text or additional symbols. Ivory tags remain distinct through dark contours. Geometry is visually consistent with the source; pixel-exact geometry preservation is not established. Broad silhouettes and signs appear suitable for small display.

QA limitation: an actual 31 px browser display check was attempted twice, but Chromium could not launch under this sandbox (sandbox_host_linux.cc: shutdown: Operation not permitted). Therefore exact 31 px readability remains unverified. No generation failures or retries; no assets missing. All four alpha checks passed. No image was altered for QA.

Each PNG has a .png.json sidecar containing the exact prompt, all four input reference paths, and original generated output path.


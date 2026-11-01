# r3-p-ground1

2026-10-29. Built-in imagegen; four edits, one generation attempt per image. Each call included its accepted charcoal edit source and all three specified parchment style references. PNGs copied byte-for-byte; no pixel post-processing.

| Icon | Tries | Size | Corner alpha | Centre alpha | Final file |
|---|---:|---|---|---:|---|
| hole.wider | 1 | 1254 × 1254 | 0, 0, 0, 0 | 252 | [PNG](../sources/parchment--hole.wider.png) |
| hole.narrower | 1 | 1254 × 1254 | 0, 0, 0, 0 | 253 | [PNG](../sources/parchment--hole.narrower.png) |
| room.hill.height. | 1 | 1254 × 1254 | 0, 0, 0, 0 | 252 | [PNG](../sources/parchment--room.hill.height..png) |
| room.hill.cliff | 1 | 1254 × 1254 | 0, 0, 0, 0 | 252 | [PNG](../sources/parchment--room.hill.cliff.png) |

Visual review: inspected every generated image. All show one parchment/brass circular badge, matte painted forms, upper-left lighting, and the intended subject without text or extra symbols. Pit arrows point outward/inward respectively; hill height has one vertical double-headed slate arrow on the right; cliff is rock on the left and grass slope on the right. Source compositions and recognizable contours are retained visually; exact pixel geometry is not established. Brass rims are stronger than the small style references but follow the source badge contours.

Failures and limitations: no generation or alpha-check failures. A read-only browser preview at CSS 31 × 31 pixels was attempted; Chromium failed to launch due to sandbox restrictions (Operation not permitted). Therefore actual 31-pixel readability remains unverified; full-size silhouettes appear legible. No generated PNG was resized or changed. No regenerations.

Each PNG has a .png.json sidecar containing the exact prompt, four input references, and original generated output path.


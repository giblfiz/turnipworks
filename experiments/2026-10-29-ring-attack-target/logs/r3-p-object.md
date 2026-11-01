# r3-p-object — 2026-10-29

Built-in image_gen edits only; each call received its accepted charcoal edit source and all three specified parchment style references. Final PNGs copied byte-for-byte from tool outputs; no pixel post-processing. Exact final prompts and references are in each `.png.json` sidecar.

| Icon | Tries | Selected | QA |
|---|---:|---:|---|
| hand.move | 1 | 1 | Four outward slate arrows, central ochre crate; parchment/brass palette; no extra symbols or text. |
| share.export | 2 | 2 | First rim touched canvas edges; retry restored margin. Open crate and one upper-right slate arrow. |
| share.link | 3 | 3 | First sheet lacked slate conversion and rim touched canvas; second fixed palette but not framing; third restored margin. Slate sheet and teal chain retain source arrangement. |

All attempts opened and visually inspected through tool output. Final images: 1254×1254; corner alpha [0,0,0,0]; centre alpha 253. All copies verified byte-identical to generated originals. Final source subjects and placements visually retained; exact pixel geometry equality is not claimed for generative edits. Brass rims are somewhat broader than the small style references, following source badge geometry.

31 px assessment: broad arrow/crate and sheet/chain silhouettes look suitable on native inspection. Attempted actual 31 px CSS display in Chromium, but sandbox denied browser startup (`sandbox_host_linux.cc`, Operation not permitted); actual 31 px rendered inspection remains unverified. No resized image was written.

## Final files

- experiments/2026-10-29-ring-attack-target/sources/parchment--hand.move.png
  - Sidecar: experiments/2026-10-29-ring-attack-target/sources/parchment--hand.move.png.json
  - Original: ~/.codex/generated_images/01a18905-2ed4-77b3-9cd3-9e5baf23a9ce/exec-b2d05c71-8408-4bcf-8054-607b6e536967.png

- experiments/2026-10-29-ring-attack-target/sources/parchment--share.export.png
  - Sidecar: experiments/2026-10-29-ring-attack-target/sources/parchment--share.export.png.json
  - Original: ~/.codex/generated_images/01a18905-2ed4-77b3-9cd3-9e5baf23a9ce/exec-f110177a-9286-4c3c-b786-29d7022d8c7a.png

- experiments/2026-10-29-ring-attack-target/sources/parchment--share.link.png
  - Sidecar: experiments/2026-10-29-ring-attack-target/sources/parchment--share.link.png.json
  - Original: ~/.codex/generated_images/01a18905-2ed4-77b3-9cd3-9e5baf23a9ce/exec-ec6a8751-d6bb-4cb3-811f-46df4363f7f7.png

## Rejected originals

- Export try 1: ~/.codex/generated_images/01a18905-2ed4-77b3-9cd3-9e5baf23a9ce/exec-03c17ca8-24f1-4eaa-a5fe-7b02025a4541.png
- Link try 1: ~/.codex/generated_images/01a18905-2ed4-77b3-9cd3-9e5baf23a9ce/exec-e75ecbbc-b1ec-45d5-9762-bf85a7ec800a.png
- Link try 2: ~/.codex/generated_images/01a18905-2ed4-77b3-9cd3-9e5baf23a9ce/exec-f9dcc049-6121-485e-81c8-9b553613402c.png

All rejected attempts also had corner alpha 0 and centre alpha 252–253. No images missing. Retained best candidates within the three-attempt maximum.


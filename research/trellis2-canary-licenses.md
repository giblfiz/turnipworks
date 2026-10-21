# TRELLIS.2 canary license ledger

**Checked:** 2026-09-29. This is an engineering dependency ledger for later counsel/product review, not a legal conclusion. The September canary is evaluation work; do not silently promote this exact dependency stack into a commercial production pipeline.

## Meta DINOv3 image encoder

TRELLIS.2-4B names `facebook/dinov3-vitl16-pretrain-lvd1689m` as its image encoder. The Hugging Face repository is manually gated. We submitted its access request on 2026-09-29; approval was still pending during the canary. Meta's [DINOv3 license](https://github.com/facebookresearch/dinov3/blob/main/LICENSE.md) grants broad royalty-free rights including use, modification, derivative works, and redistribution under its terms. Material redistribution must carry the same agreement; research publications must acknowledge DINOv3; prohibited uses include specified military, warfare, nuclear, espionage, gun, illegal-weapon, and trade-control contexts. Meta describes DINOv3 as released under a [commercial license](https://ai.meta.com/blog/dinov3-self-supervised-vision-model/).

For the canary only, we used public mirror `camenduru/dinov3-vitl16-pretrain-lvd1689m`. Its `model.safetensors` is byte-identical to the official gated file: both advertise 1,212,559,808 bytes and SHA-256 `dcb2e45127cccbf1601e5f42fef165eea275c8e5213197e8dcf3f48822718179`. This mirror is an unblocker, not the intended production source; switch back to Meta after approval.

## BRIA RMBG-2.0 background removal

TRELLIS.2 also loads `briaai/RMBG-2.0` with remote model code. We accepted the Hugging Face gate on 2026-09-29 for this evaluation. BRIA's [official model card](https://huggingface.co/briaai/RMBG-2.0) states that the downloadable weights are CC BY-NC 4.0 for noncommercial use and that commercial use requires a separate agreement or BRIA API. This is the important red flag in the current self-hosted stack: even if the 3D output itself is technically excellent, we should replace the remover, supply already-masked inputs and bypass it, or acquire commercial terms before production use.

The model is loaded with `trust_remote_code=True`, so its Python configuration and implementation execute on the worker. The canary downloaded `BiRefNet_config.py` and `birefnet.py`; pin the exact repository revision and review those files before a durable deployment.

## Integration decision gate

**Resolved 2026-09-30:** the production-oriented design replaces RMBG-2.0 with pinned official MIT BiRefNet preprocessing and replaces the NVIDIA-dependent Microsoft reference runtime with a pinned official ComfyUI core TRELLIS.2 worker. The old stack remains evaluation-only. See `dependency-license-resolution.md` for revisions, primary sources, coupling boundary, and the still-required operational canary.

Before production integration:

1. Confirm Meta approval and use the official DINOv3 repository.
2. Verify pinned BiRefNet RGBA preprocessing and confirm TRELLIS background preprocessing stays disabled.
3. Pin every model and code revision, preserve license texts, and hash all fetched artifacts.
4. Rebuild the worker from a reviewed image rather than executing mutable remote code at startup.

## See also

- [TRELLIS.2 repository](https://github.com/microsoft/TRELLIS.2)
- [Hugging Face gated-model behavior](https://huggingface.co/docs/hub/models-gated)
- [BRIA RMBG-2.0 model card](https://huggingface.co/briaai/RMBG-2.0)

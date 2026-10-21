# TRELLIS.2 dependency license resolution

**Checked:** 2026-09-30. This is an engineering dependency decision, not legal advice. The original Runpod canary remains valid evaluation evidence but is not the production worker.

## Decision

The production-oriented bulk lane will not load BRIA RMBG-2.0, `nvdiffrast`, or `nvdiffrec`.

1. **Foreground masking:** run the official `ZhengPeng7/BiRefNet` code and weights locally, pin both revisions, produce an RGBA plate, and invoke TRELLIS.2 with image preprocessing/background removal disabled. The official GitHub code license and Hugging Face model card both identify MIT; the inspected Hugging Face revision was `e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4` and the GitHub `main` revision was `ebcc0bc8ec7fe919cec829f2dea656b3078acddc`.
2. **TRELLIS worker:** keep the pinned MIT Microsoft inference path and replace the one NVIDIA-dependent UV-space rasterization block used by `o_voxel.postprocess.to_glb`. The replacement will be an independently written standard barycentric rasterizer under our pipeline license, or initially BSD-licensed PyTorch3D. Everything after that seam remains upstream: CuMesh cleanup/remesh/UV unwrap, BVH back-projection, sparse PBR sampling, seam fill, material construction and GLB serialization. Preview/training renderers remain outside the production batch path.

The worker patch is **license-resolved and canary-verified**. On 2026-09-30 a pre-masked RGBA apple ran through pinned Microsoft TRELLIS.2 inference and the replacement rasterizer, exported a 49,984-triangle textured GLB, reloaded in Blender as one mesh with one material and two images, and rendered correctly. No GPL component is required for this design. Batch throughput and the full 500-SKU validation remain run-level gates rather than license gates.

## Hosted Fal boundary

Fal's hosted `fal-ai/trellis-2` endpoint is an approved commercial service lane. Its public model page expressly marks the endpoint for commercial use. Turnip Works may rely on that representation without auditing Fal's private supplier licenses or internal dependency graph; any undisclosed breach between Fal and one of its suppliers belongs on Fal's side of the service boundary.

This does not prove that the Microsoft reference stack is suitable for us to self-host, and it does not transfer Fal's permissions to our own worker. The NVIDIA replacement work below therefore applies only to infrastructure we operate or distribute. Fal remains a clean bridge/premium lane while that worker is brought up.

## Why the old stack is research-only

TRELLIS.2 code and weights are MIT, but its reference setup explicitly installs two separately licensed NVIDIA packages. `nvdiffrast` v0.4.0 (`253ac4fcea7de5f396371124af597e6cc957bfae`) and the `nvdiffrec` renderutils branch (`b296927cc7fd01c2ac1087c8065c4d7248f72da4`) both use NVIDIA Source Code licenses restricting use to research/evaluation. This is not a generic objection to NVIDIA GPUs or CUDA; it is specific to those research-code repositories.

BRIA RMBG-2.0 is likewise source-available for noncommercial use under CC BY-NC 4.0, with a separate agreement or BRIA API required for commercial deployment. Since background masking is a separable preprocessing step, buying that license adds no useful coupling.

## Exact NVIDIA seam

The normal `Trellis2ImageTo3DPipeline.run` and latent decoder do not import either NVIDIA package. `nvdiffrast` enters when `o_voxel.postprocess.to_glb` rasterizes UV triangles so generated sparse PBR values can be sampled into texture maps. `nvdiffrec_render` appears only in the environment-light preview renderer and is not part of GLB export. Upstream's eager `o_voxel` import must also be made optional so a clean worker can start without `nvdiffrast` installed.

The verified canary imported the worker in an environment containing neither NVIDIA package, generated and reloaded the textured GLB, and visually confirmed texture coverage and orientation. It used 50k faces and a 1024 texture. The 100k/2048 performance point remains optional characterization rather than a production gate.

## Primary sources

- [Microsoft TRELLIS.2 repository and dependency notice](https://github.com/microsoft/TRELLIS.2)
- [Microsoft reference setup installing nvdiffrast and nvdiffrec](https://github.com/microsoft/TRELLIS.2/blob/main/setup.sh)
- [nvdiffrast license](https://github.com/NVlabs/nvdiffrast/blob/main/LICENSE.txt)
- [nvdiffrec renderutils license](https://github.com/JeffreyXiang/nvdiffrec/blob/renderutils/LICENSE.txt)
- [BRIA RMBG-2.0 model card](https://huggingface.co/briaai/RMBG-2.0)
- [Official BiRefNet weights and MIT model-card designation](https://huggingface.co/ZhengPeng7/BiRefNet)
- [Official BiRefNet MIT code license](https://github.com/ZhengPeng7/BiRefNet/blob/main/LICENSE)
- [PyTorch3D BSD license](https://github.com/facebookresearch/pytorch3d/blob/main/LICENSE)
- [Fal hosted TRELLIS.2 endpoint, marked for commercial use](https://fal.ai/models/fal-ai/trellis-2)

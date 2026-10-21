#!/usr/bin/env bash
set -euo pipefail

# RESEARCH/EVALUATION ONLY. This reference worker installs nvdiffrast and
# nvdiffrec, whose NVIDIA Source Code licenses restrict them to non-commercial
# research/evaluation. Production keeps TRELLIS.2 inference but uses the clean
# GLB-export patch documented in research/dependency-license-resolution.md.
if [[ "${TW_ALLOW_RESEARCH_ONLY_NVIDIA_STACK:-}" != "1" ]]; then
  printf '%s\n' \
    'Refusing to install the research-only NVIDIA TRELLIS.2 stack.' \
    'For a deliberate evaluation run, set TW_ALLOW_RESEARCH_ONLY_NVIDIA_STACK=1.' \
    'For production-oriented work, use the patched TRELLIS.2/BiRefNet worker path.' >&2
  exit 64
fi

# Prepare a disposable Runpod PyTorch 2.4 / CUDA 12.4 worker for the pinned
# TRELLIS.2 evaluation stack. Keep WORKSPACE on a network volume so source,
# model caches, and compiled wheels survive pod replacement.

WORKSPACE=${WORKSPACE:-/workspace}
TRELLIS_COMMIT=${TRELLIS_COMMIT:-75fbf0183001ed9876c8dbb35de6b68552ee08bd}
CUDA_HOME=${CUDA_HOME:-/usr/local/cuda-12.4}
MAX_JOBS=${MAX_JOBS:-16}
export CUDA_HOME MAX_JOBS
export PATH="$CUDA_HOME/bin:$PATH"

apt-get update -qq
apt-get install -y -qq libjpeg-dev zlib1g-dev git rsync ripgrep

if [[ ! -d "$WORKSPACE/TRELLIS.2/.git" ]]; then
  git clone --recursive https://github.com/microsoft/TRELLIS.2.git "$WORKSPACE/TRELLIS.2"
fi
git -C "$WORKSPACE/TRELLIS.2" checkout "$TRELLIS_COMMIT"
git -C "$WORKSPACE/TRELLIS.2" submodule update --init --recursive

python -m pip install --force-reinstall --no-cache-dir \
  torch==2.6.0 torchvision==0.21.0 \
  --index-url https://download.pytorch.org/whl/cu124
python -m pip uninstall -y torchaudio >/dev/null 2>&1 || true

python -m pip install \
  imageio imageio-ffmpeg tqdm easydict opencv-python-headless ninja trimesh \
  transformers gradio==6.0.1 tensorboard pandas lpips zstandard kornia timm
python -m pip install \
  git+https://github.com/EasternJournalist/utils3d.git@9a4eb15e4021b67b12c460c7057d642626897ec8
python -m pip install pillow-simd

extension_root="$WORKSPACE/trellis2-extension-src"
wheel_root="$WORKSPACE/trellis2-built-wheels"
mkdir -p "$extension_root" "$wheel_root"

[[ -d "$extension_root/nvdiffrast/.git" ]] || \
  git clone -b v0.4.0 https://github.com/NVlabs/nvdiffrast.git "$extension_root/nvdiffrast"
[[ -d "$extension_root/nvdiffrec/.git" ]] || \
  git clone -b renderutils https://github.com/JeffreyXiang/nvdiffrec.git "$extension_root/nvdiffrec"
[[ -d "$extension_root/CuMesh/.git" ]] || \
  git clone --recursive https://github.com/JeffreyXiang/CuMesh.git "$extension_root/CuMesh"
[[ -d "$extension_root/FlexGEMM/.git" ]] || \
  git clone --recursive https://github.com/JeffreyXiang/FlexGEMM.git "$extension_root/FlexGEMM"

if [[ $(find "$wheel_root" -maxdepth 1 -name '*.whl' | wc -l) -lt 6 ]]; then
  rm -rf "$extension_root/o-voxel"
  cp -r "$WORKSPACE/TRELLIS.2/o-voxel" "$extension_root/o-voxel"
  python -m pip wheel --no-deps --no-build-isolation -w "$wheel_root" \
    "$extension_root/nvdiffrast" \
    "$extension_root/nvdiffrec" \
    "$extension_root/CuMesh" \
    "$extension_root/FlexGEMM" \
    "$extension_root/o-voxel"
  python -m pip wheel --no-deps --no-build-isolation -w "$wheel_root" flash-attn==2.7.3
fi

# --no-deps is deliberate: FlexGEMM's unconstrained metadata otherwise replaces
# the pinned CUDA 12.4 PyTorch stack with a newer incompatible build.
python -m pip install --no-deps "$wheel_root"/*.whl

cd "$WORKSPACE/TRELLIS.2"
python - <<'PY'
import flash_attn
import cumesh
import flex_gemm
import nvdiffrast.torch
import o_voxel
import torch
import trellis2

assert torch.__version__.startswith("2.6.0+cu124"), torch.__version__
assert torch.cuda.is_available()
print(torch.__version__, torch.version.cuda, torch.cuda.get_device_name())
PY

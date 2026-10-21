#!/usr/bin/env bash
set -euo pipefail

WORKSPACE=${WORKSPACE:-/workspace}
TRELLIS_COMMIT=${TRELLIS_COMMIT:-75fbf0183001ed9876c8dbb35de6b68552ee08bd}
CUDA_HOME=${CUDA_HOME:-/usr/local/cuda-12.4}
export CUDA_HOME
export MAX_JOBS=${MAX_JOBS:-16}
export HF_HOME=${HF_HOME:-$WORKSPACE/.cache/huggingface}
export PATH="$CUDA_HOME/bin:$PATH"

apt-get update -qq
apt-get install -y -qq libjpeg-dev zlib1g-dev git rsync ripgrep

test -d "$WORKSPACE/TRELLIS.2/.git"
test "$(git -C "$WORKSPACE/TRELLIS.2" rev-parse HEAD)" = "$TRELLIS_COMMIT"

python -m pip install --force-reinstall --no-cache-dir \
  torch==2.6.0 torchvision==0.21.0 \
  --index-url https://download.pytorch.org/whl/cu124
python -m pip uninstall -y torchaudio nvdiffrast nvdiffrec-render >/dev/null 2>&1 || true
python -m pip install \
  imageio imageio-ffmpeg tqdm easydict opencv-python-headless ninja trimesh \
  transformers gradio==6.0.1 tensorboard pandas lpips zstandard kornia timm
python -m pip install \
  git+https://github.com/EasternJournalist/utils3d.git@9a4eb15e4021b67b12c460c7057d642626897ec8

wheel_root="$WORKSPACE/trellis2-built-wheels"
python -m pip install --no-deps \
  "$wheel_root"/flash_attn-*.whl \
  "$wheel_root"/cumesh-*.whl \
  "$wheel_root"/flex_gemm-*.whl \
  "$wheel_root"/o_voxel-*.whl

python /workspace/tw-pipeline/patch_trellis2_clean_export.py --trellis-root "$WORKSPACE/TRELLIS.2"

cd "$WORKSPACE/TRELLIS.2"
python - <<'PY'
import importlib.metadata
import torch
import o_voxel
import trellis2

installed = {dist.metadata['Name'].lower().replace('_', '-') for dist in importlib.metadata.distributions()}
assert 'nvdiffrast' not in installed, installed
assert 'nvdiffrec-render' not in installed, installed
assert torch.__version__.startswith('2.6.0+cu124'), torch.__version__
assert torch.cuda.is_available()
print(torch.__version__, torch.version.cuda, torch.cuda.get_device_name())
print('clean TRELLIS.2 imports verified')
PY

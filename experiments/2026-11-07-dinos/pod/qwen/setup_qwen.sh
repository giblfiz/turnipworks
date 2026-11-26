#!/usr/bin/env bash
# ON THE POD: an open-weight image model for the plates (fal empty, Codex image quota spent until 2026-11-11).
# Qwen-Image-Edit (Apache-2.0, Qwen team), the 2511 release if the hub has it, else 2509; diffusers' QwenImageEditPlusPipeline.
# A venv on top of the system torch (so the TRELLIS.2 environment's packages are not touched), weights on the container
# disk (/root/hf), NOT on the shared network volume.
set -euo pipefail
python -m venv --system-site-packages /root/qenv
/root/qenv/bin/pip install -q -U pip
/root/qenv/bin/pip install -q -U "git+https://github.com/huggingface/diffusers" "transformers>=4.57" accelerate safetensors hf_transfer sentencepiece "huggingface_hub[cli]" pillow
/root/qenv/bin/python -c "import torch, diffusers, transformers; from diffusers import QwenImageEditPlusPipeline; print('torch', torch.__version__, 'diffusers', diffusers.__version__, 'transformers', transformers.__version__)"
export HF_HOME=/root/hf HF_HUB_ENABLE_HF_TRANSFER=1
for M in Qwen/Qwen-Image-Edit-2511 Qwen/Qwen-Image-Edit-2509; do
  if /root/qenv/bin/hf download "$M" --exclude "*.md" > /root/qwen-dl.log 2>&1; then echo "$M" > /root/qwen-model.txt; echo "downloaded $M"; break; fi
  echo "no $M: $(tail -2 /root/qwen-dl.log)"
done
du -sh /root/hf
echo QWEN SETUP OK

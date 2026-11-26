from huggingface_hub import snapshot_download
snapshot_download('stabilityai/stable-diffusion-xl-base-1.0', allow_patterns=['model_index.json', 'scheduler/*', 'text_encoder/*fp16.safetensors', 'text_encoder/config.json', 'text_encoder_2/*fp16.safetensors', 'text_encoder_2/config.json', 'tokenizer/*', 'tokenizer_2/*', 'unet/*fp16.safetensors', 'unet/config.json', 'vae/*fp16.safetensors', 'vae/config.json'])
print('SDXL-READY')

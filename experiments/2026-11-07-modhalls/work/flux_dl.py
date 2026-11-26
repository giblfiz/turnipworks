from huggingface_hub import snapshot_download
snapshot_download('black-forest-labs/FLUX.1-schnell', allow_patterns=['model_index.json', 'scheduler/*', 'text_encoder/*', 'text_encoder_2/*', 'tokenizer/*', 'tokenizer_2/*', 'transformer/*', 'vae/*'])
print('FLUX-READY')

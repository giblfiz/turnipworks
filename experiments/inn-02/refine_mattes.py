"""Re-matte accepted BiRefNet plates with the chroma-hole refinement (2026-10-02 audit: background trapped in
loops/bars/window frames). Writes masked/<id>.png in place and refine-report.json {id: removed_px}."""
import json, sys
from pathlib import Path
import cv2, numpy as np, torch
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
import birefnet_matte as bm
RUN = Path(__file__).resolve().parent
man = json.loads((RUN / "gate-manifest.json").read_text())["assets"]
ids = [k for k, v in man.items() if v.get("status") == "accepted" and v.get("matte") == "birefnet"]
model = bm.load_model(); rep = {}
for k in ids:
    img = Image.open(RUN / "inputs" / f"{k}.jpg").convert("RGB")
    with torch.no_grad():
        pred = model(bm.TF(img).unsqueeze(0).to("cuda").half())[-1].sigmoid()[0, 0].float().cpu().numpy()
    alpha = np.clip(cv2.resize(pred, img.size, interpolation=cv2.INTER_LINEAR), 0, 1)
    bgr = cv2.cvtColor(np.asarray(img), cv2.COLOR_RGB2BGR)
    alpha, removed = bm.refine_with_chroma(alpha, bgr)
    a8 = (alpha * 255).astype(np.uint8); rgba = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA); rgba[:, :, 3] = a8; rgba[a8 == 0, :3] = 0
    cv2.imwrite(str(RUN / "masked" / f"{k}.png"), rgba); rep[k] = removed
(RUN / "refine-report.json").write_text(json.dumps(rep, indent=0))
big = {k: v for k, v in rep.items() if v > 300}
print(len(rep), "re-matted;", len(big), "changed by >300 px")

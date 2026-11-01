"""A drop-in for src/plate_gate_batch.vision() on the free route: Gemini through agy-run (the subscription), never a
paid API (Harry 2026-10-18: no GEMINI_API_KEY paths). Same call shape: vision(parts, prompt) -> (dict, usage).
Images in `parts` (inline_data) are written to a fresh folder under neutral names and the prompt names them; the answer's
first whole JSON object is returned. One call at a time (the caller runs serially)."""
import base64, json, re, subprocess, tempfile, time
from pathlib import Path
AGY = "~/fauna-tools/agy-run"


def first_json(out):
    dec = json.JSONDecoder()
    for m in re.finditer(r"\{", out):
        try: return dec.raw_decode(out[m.start():])[0]
        except json.JSONDecodeError: continue
    return None


def vision(parts, prompt, retries=3, timeout=240):
    d = Path(tempfile.mkdtemp(prefix="agyv-")); names, k = [], 0
    for i, p in enumerate(parts):
        if "inline_data" in p:
            k += 1; ext = ".png" if "png" in p["inline_data"]["mime_type"] else ".jpg"
            f = d / f"image{k}{ext}"; f.write_bytes(base64.b64decode(p["inline_data"]["data"]))
            label = parts[i + 1].get("text", "") if i + 1 < len(parts) and "text" in parts[i + 1] else ""
            names.append(f"{f.name} {label}".strip())
    head = ("Look at these image files in this folder: " + "; ".join(names) + ".\n\n") if names else "(No image: a text-only task.)\n\n"
    full = head + ("Answer from looking at the image(s) alone: do NOT run any commands, do not crop, edit or convert them, and do not open or search any other file.\n\n" if names else "Do NOT run any commands or open any file.\n\n") + prompt + "\n\nAnswer ONLY with the one JSON object asked for, no prose, no code fence."
    out = ""
    for _ in range(retries + 1):
        try: out = subprocess.run([AGY, "-C", str(d), "-t", str(timeout), full], capture_output=True, text=True, timeout=timeout + 60).stdout
        except subprocess.TimeoutExpired: out = ""
        r = first_json(out)
        if isinstance(r, dict): return r, {}
        time.sleep(20)   # (agy is shared by the other lanes: a stalled turn usually clears)
    raise RuntimeError("agy vision gave no JSON: " + out[-300:])

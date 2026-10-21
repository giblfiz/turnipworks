#!/usr/bin/env python3
"""One cave-floor ground texture by the free route the yard floors used (experiments/2026-10-05-outdoors: `codex exec`
image generation, then flatten the tone and join the edges with a cut). Same prompt frame as outdoors/gen.py FLOOR and
the same seam maths as outdoors/finish_new.py (copied here so that folder is not touched).
    python3 floor.py gen        # floor/floor-cave-rock.jpg (raw 1024 px)
    python3 floor.py finish     # floor/floor-cave-rock.png (tiles) + floor/floor-cave-rock-3x3.jpg (check sheet)
"""
import os, sys, subprocess, tempfile
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
NAME = "floor-cave-rock"; os.makedirs(f"{HERE}/floor", exist_ok=True)
ANCHOR = os.path.join(ROOT, "style-references/heroic-handpainted-tavern-v1.png")
FLOOR = """Use your built-in image generation tool. Using the FIRST attached image only as a visual style guide for the Turnip Works house style (heroic hand-painted), paint a ground material swatch: {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency surface detail, mostly matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, logos and emblems.

Presentation: a perfectly top-down orthographic view looking straight down at the ground. The ground surface fills the ENTIRE square canvas edge to edge: no border, no frame, no background colour, no vignette, no perspective, no cast shadows, no objects, no rocks bigger than a fist. Even, flat, shadowless lighting. The square shows a 5 ft x 5 ft patch of ground, so keep elements at true scale for that area. It must tile seamlessly: whatever leaves the left edge continues on the right edge, and top continues to bottom. Keep the overall tone EVEN across the whole square (no big light or dark blotches), so that a grid of these squares does not show.

Specific design: {detail}
Save the resulting PNG (square, at least 1024 px) into the current directory as {name}.png and print its path and pixel size."""
DETAIL = "The SECOND attached image is a piece of the cave's rock wall: the floor is the SAME grey-brown limestone (same hue, a little darker and duller than the wall). A natural cave floor: uneven worn bedrock in soft flat plates with shallow irregular cracks, thin drifts of brown packed earth and grit in the low places, a few small damp darker stains, a scatter of small pebbles. No built paving, no regular joints, no moss patches bigger than a hand, no puddles, no landmark that would be noticed when repeated."

def gen():
    wd = tempfile.mkdtemp(prefix="caves-floor-")
    cmd = ["codex", "exec", "--skip-git-repo-check", "-C", wd, "-s", "workspace-write", "-i", ANCHOR, "-i", f"{HERE}/inputs/cave-wall-plain-a.jpg", "-"]
    for _ in range(2):
        r = subprocess.run(cmd, input=FLOOR.format(subject="natural cave floor of worn limestone bedrock", detail=DETAIL, name=NAME), capture_output=True, text=True, timeout=1200)
        open(f"{HERE}/floor/gen.log", "a").write(r.stdout[-3000:] + r.stderr[-2000:])
        if os.path.exists(f"{wd}/{NAME}.png"):
            Image.open(f"{wd}/{NAME}.png").convert("RGB").resize((1024, 1024), Image.LANCZOS).save(f"{HERE}/floor/{NAME}.jpg", quality=93); print("ok"); return
    sys.exit("codex image failed")

def finish():
    from scipy import ndimage
    BAND, FEATHER = 0.18, 1.5
    def seam(a, axis): return (np.abs(a[:, 0] - a[:, -1]).mean() / np.abs(a[:, 1:] - a[:, :-1]).mean()) if axis == 1 else (np.abs(a[0] - a[-1]).mean() / np.abs(a[1:] - a[:-1]).mean())
    def blotch(a): lum = a.mean(axis=2); return ndimage.gaussian_filter(lum, a.shape[0] / 12).std() / lum.std()
    def flatten(a, strength=0.75):
        low = np.stack([ndimage.gaussian_filter(a[..., c], a.shape[0] / 8, mode="wrap") for c in range(3)], -1)
        return a - strength * (low - low.mean(axis=(0, 1)))
    def path(cost):
        n, W = cost.shape; best = None
        for s in range(3, W - 3, 6):
            acc = np.full(W, np.inf); acc[s] = cost[0, s]; back = np.zeros((n, W), np.int8)
            for y in range(1, n):
                c = np.stack([np.r_[np.inf, acc[:-1]], acc, np.r_[acc[1:], np.inf]])
                k = c.argmin(axis=0); back[y] = k - 1; acc = c[k, np.arange(W)] + cost[y]
            if best is None or acc[s] < best[0]:
                p = np.zeros(n, int); p[-1] = s
                for y in range(n - 1, 0, -1): p[y - 1] = p[y] + back[y, p[y]]
                best = (acc[s], p)
        return best[1]
    def cut(a):
        n = a.shape[1]; W = int(BAND * n); r = np.roll(a, n // 2, axis=1)
        d = ndimage.gaussian_filter(((a - r) ** 2).sum(axis=2), 2, mode="wrap") + 1.0
        m = np.ones(a.shape[:2]); pl = path(d[:, :W]); pr = path(d[:, n - W:][:, ::-1]); xx = np.arange(n)[None, :]
        m[xx < pl[:, None]] = 0; m[xx > (n - 1 - pr)[:, None]] = 0
        m = ndimage.gaussian_filter(m, FEATHER, mode="wrap")[..., None]
        return a * m + r * (1 - m)
    a = np.asarray(Image.open(f"{HERE}/floor/{NAME}.jpg").convert("RGB")).astype(float)
    b = (seam(a, 1), seam(a, 0), blotch(a))
    a = flatten(a); a = cut(a); a = cut(a.transpose(1, 0, 2)).transpose(1, 0, 2)
    print(f"seam LR {b[0]:.1f}->{seam(a, 1):.1f}  TB {b[1]:.1f}->{seam(a, 0):.1f}  blotch {b[2]:.2f}->{blotch(a):.2f}  mean RGB {a.mean(axis=(0, 1)).round(0)}")
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)); im.save(f"{HERE}/floor/{NAME}.png")
    im.resize((512, 512), Image.LANCZOS).save(f"{HERE}/floor/{NAME}.webp", quality=88)
    s = im.resize((400, 400)); sheet = Image.new("RGB", (1200, 1200))
    for i in range(9): sheet.paste(s, (i % 3 * 400, i // 3 * 400))
    sheet.save(f"{HERE}/floor/{NAME}-3x3.jpg", quality=90)
if __name__ == "__main__": {"gen": gen, "finish": finish}[sys.argv[1]]()

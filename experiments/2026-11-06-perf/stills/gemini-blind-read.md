# Blind Gemini read of the dynres stills (2026-11-06, gemini-4-argon-high via agy-run, isolated folder)

Key (not shown to Gemini): A = pixel ratio 0.6, B = 1 (rest, the look), C = 0.5, D = 0.75 (the default built). Stills: inn-high-pr*.png here, the bench's inn at High, 1440 x 900 at 1x.

### Readable Labels / Text (Per Image)
* **[A.png](A):** `Kitchen`, `Building 1`, `Fine guest room`, `Bench 1`, `Benc` (cut off at right edge), `Bench 2`, `Y` (cut off at right edge), and a blurry `1` on the yellow marker base.
* **[B.png](B):** `Kitchen`, `Building 1`, `Fine guest room`, `Bench 1`, `Benc` (cut off at right edge), `Bench 2`, `Y` (cut off at right edge), and a clear `1` on the yellow marker base.
* **[C.png](C):** `Kitchen`, `Building 1`, `Fine guest room`, `Bench 1`, `Benc` (cut off at right edge), `Bench 2`, `Y` (cut off at right edge); the `1` on the yellow marker base is blurred into a smudge.
* **[D.png](D):** `Kitchen`, `Building 1`, `Fine guest room`, `Bench 1`, `Benc` (cut off at right edge), `Bench 2`, `Y` (cut off at right edge), and a readable `1` on the yellow marker base.

### (1) Ranking from Sharpest to Softest
1. **[B.png](B)** (sharpest)
2. **[D.png](D)**
3. **[A.png](A)**
4. **[C.png](C)** (softest)

### (2) What a Player Would Notice at Normal Viewing Distance
* **[B.png](B):** Crisp furniture edges, well-defined small props (chandelier spokes, candle flames, window lattice, chest planks), minimal jaggies on diagonal timbers, and sharp `Bench` labels.
* **[D.png](D):** Nearly indistinguishable from B at a glance, with only slight softening on fine textures (top-left rug, `Bench` text) and faint stair-stepping on diagonal timber beams and tile edges.
* **[A.png](A):** Noticeable overall softness and stair-stepping along checkered floor tiles, furniture edges, and diagonal beams, with small props (lantern, chandelier, kitchen jars) and `Bench` labels looking visibly fuzzy while overlay UI pills (`Kitchen`, `Building 1`, `Fine guest room`) stay sharp.
* **[C.png](C):** Heavy blur and blocky jaggies across the 3D scene—small props (chandelier, lantern, window lattice, broom) dissolve into coarse blobs, `Bench` labels are very blurry, and the contrast with the sharp UI pills is jarring.

### (3) Acceptable Only While Camera Is Panning or Turning
* **[B.png](B):** **yes**
* **[D.png](D):** **yes**
* **[A.png](A):** **borderline**
* **[C.png](C):** **no**

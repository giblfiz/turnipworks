# Vision fog renderer (2026-10-13)

The renderer is integrated with client vision, stored explored masks, cut levels, visible pawns, and ruler/template overlays. Deployment and whole-feature acceptance are recorded separately in `INTEGRATION.md` and `docs/STATUS.md`; this file reports the renderer's own evidence. Explored storage was authorized during Task G; the original command-log-history blocker is no longer the chosen implementation.

## Rendering contract

`fx.fogwar.setState` accepts an enabled flag, revision, viewed `floorY`, and either one RGBA mask or `levels:[{floorY,bounds,width,height,data}]` (up to sixteen physical levels). R=current sight, G=explored; callers own rasterization. One texture atlas and one final full-screen pass follow lighting/tone mapping/bloom. The surface depth selects its level; background rays use the viewed floor. Explicit texel-center reads preserve binary membership; filtered reads soften fog only **inside** known/current cells, never exposing an unseen texel. Explored edges reconstruct the coarse 1.25-ft memory footprint with four bilinear taps to broaden the inward fade beyond the fine display texels. Table-camera stills retain a noticeable stair-step rim at the coarse remembered boundary; this visual limitation remains visible despite the smoothing. The runtime independently omits never-seen objects and pawns outside exact current polygons, preventing hidden geometry from leaving a silhouette.

Unseen is opaque grey with a cheap floor-plane noise sea. Explored is a stationary translucent grey wash. Current is clear; changes blend opacity for 420 ms and sample the existing atmosphere's wall-masked velocity field for the reveal curl. Reset/never-seen is opaque immediately. Decorative atmosphere off selects flat notation. The lighting-off path captures scene depth and applies the same mask after plain water/smoke; auxiliary-camera rendering preserves viewport/scissor. `snap:true` skips transitions for identity/area changes. Revisions must change when the atlas/cut selection changes.

`setFlyers([root,...])` accepts all already-visibility-filtered pawn roots, including grounded tall figures. Their geometry is drawn into a Red8 silhouette target with exact original-scene-depth rejection (0.025 ft tolerance), then only these fragments bypass the surface level's mask, using the pawn base's sight for the whole figure. This preserves the original lit picture, rejects occluding walls and alpha-cutout holes, and does not expose other upper-level surfaces. It costs extra geometry draws only when visible pawns exist, not a second full-screen fog pass. Reserved layer 31 and temporary scene/render state are restored.

`setOverlays([root,...])` draws the actual ruler/template geometry after fog, preserving original alpha. It never exempts a transparent template's footprint from fog, which would expose the world underneath. Layer 30, depth-test/write flags, scene state, and camera layers are restored after the draw.

## Tests and performance

`engine/test/browser_fogpass.py` runs through `tw-slot`, imports `tw_sandbox`, creates no campaign, and cleans its browser and temporary server. Its synthetic red floor/green figure fixture validates shader output independently of geometry generation. It covers plain/composer agreement; exact clear-color preservation including a real ACES effect; no program growth on texture/decorative state changes; two physical levels; intermediate reveal and immediate reset; stationary explored pixels; PiP viewport/scissor restoration; disabled/enabled/disabled fog in the real lighting facade; distant perspective noise continuity; and an elevated base-level figure behind an occluding wall. The final version passed **28/28** with zero browser errors. Ruler/template readbacks over a hidden green figure and hidden red floor both return RGB 129/132/134, proving readability without exposing the world underneath. Material/depth/camera state restores exactly. Structured evidence: `results/render-probe.json`.

`measure_fog.py` uses the existing common-room and 104-room town fixtures, with direct GPU queries around the visibility pass. It uses **Medium with density restored to native at DPR 2**, giving 3840×2160 (normal Medium caps resolution at 1.5×). An injected current/explored/unseen mask isolates GPU rendering from visibility CPU work. Three interleaved rounds per mode, 120 queries per round, slowest 5% removed; the lowest round estimates uncontended cost on the shared RTX 3060. Results are in `results/gpu-common.json` and `results/gpu-town104.json`. Four physical levels are exercised on the town. The benchmark does not claim gameplay correctness.

Final shader GPU costs (milliseconds):

| Scene | Flat | Decorative |
|---|---:|---:|
| Common room, 1 level | **0.514** | **0.926** |
| Town, 104 rooms / 4 levels | **0.500** | **0.928** |

Both decorative scene measurements are under the ~1 ms pass budget at true 2×. All rounds collected 120 queries and neither scene reported browser errors. The final benchmark includes one visible capsule figure and its depth-equal mask draw; ruler geometry draws remain excluded and have independent correctness probes. The standalone final shader was 0.350 ms flat at 2×; scene benchmarks are the budget evidence. Program growth from asynchronous scene material warm-up in these full scenes is not evidence of fog-state compilation; the isolated state test pins unchanged programs.

Uploading fine masks also costs CPU. Native row copies, Uint32 transition-byte packing, and two reused buffers avoid rebuilding individual RG bytes and repeated large allocations. The 640×720 (460,800 pixel) fixture measured **1.80 ms median**, 1.8–2.1 ms across eight warm updates, after buffer reuse. A later shared-machine rerun measured **3.10 ms median**, 2.6–3.5 ms; CPU scheduling and load affect these measurements (before reuse: 2.6 ms). This is upload preparation, separate from visibility-polygon computation; it must not be reported as a combined pawn-move cost. Unchanged revisions return before copying.

Local fixture stills: `shots/fogpass-flat.png`, `shots/fogpass-decorative.png`. These are synthetic shader fixtures, **not table-camera acceptance stills**. Real three-seat captures live under `engine/test/shots/fog/`.

## Failures caught and repaired

- An enabled-only isolated fixture missed the GM's blank canvas. EffectComposer chooses its screen pass when passes are added/removed, not when the last pass is disabled. `lighting.render` now routes the previous final effect directly to screen when fog is disabled. A real lighting off/on/off readback test prevents recurrence.
- Rendering through an intermediate target needs final output color-space conversion. The first prototype darkened a clear red floor from RGB 240/0/0 to 222/0/0. Three's output color-space conversion restores exact equality, including after ACES tone mapping.
- Reconstructing a ray at clip depth 1 loses precision with a distant far plane; the original sine hash also amplified coordinate precision errors. Finite clip depths 0 and 0.5 plus a stable polynomial hash produce continuous floor noise. The large-coordinate, far=100000 perspective test sees at most one RGB step between neighbouring pixels.
- A depth-only level atlas initially fogged visible flyers as if their heads belonged upstairs. The depth-equal flyer silhouette mask resolves this without making upper-level geometry visible.
- Transparent rulers must be drawn over fog, not cut holes in it. The explicit overlay seam preserves fog over the world beneath their translucent fill.

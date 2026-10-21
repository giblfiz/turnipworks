# Design brief for the four designers (crypt / castle / mansion / vertical kit)

You are one of four designers working in parallel on the Turnip Works asset batch of 2026-10-05. Repo:
`<repo>`. Batch folder: `experiments/2026-10-05-castle-crypt-mansion/` (called B below). Your
own folder is `B/<type>/`. You DESIGN and SPECIFY only. You do not generate any image or mesh, spend no money, call no
image model, and touch no code outside your own folder and your own new catalog files.

Harry's ask: "make me castle, crypt and mansion types" for the game's Build tray (Genre -> Type -> Room). Each type gets
5-8 ROOMS; each room a focal piece and a furniture/prop program the solver can lay out; plus its own wall and floor styles
where the existing ones are wrong. A fourth designer does a "vertical kit" (stairs, roof furniture; see docs/VERTICAL.md).
Props are BACKGROUND pieces judged at table distance (top-down-ish camera, a room fills the screen). Favour what makes a
room read as what it is from above: focal pieces first, then furniture, then smalls.

## Read first (skim; you are not expected to read everything end to end)
- `catalog/README.md` (line grammar: one line = one mesh; fields place/fp/size/mat/set/var/aff/gen/P#; `open_of:`, `mount:`).
- Your setting's pick list: `catalog/out/by-setting/{cry-crypt-tomb,cas-castle-keep,nob-aristocrat-manor}.txt` (roles that
  ALREADY have catalog lines), and the recipes that exist for it (`grep -n` your setting in `catalog/room-recipes.md` and
  `catalog/rooms-*.md`).
- What ALREADY HAS A MESH: `tools/spawn-tuner/data/library.json` (`objects` keyed by role id, each with `skus`; `kind: mesh`
  or `flat`). About 900 mesh skus exist (inn, kitchen, cellar, bedroom, stable, yard, smithy and trade props, tableware,
  food, lights). REUSE these wherever they fit; never specify a new mesh for a role that has one unless the existing one is
  wrong for the setting (a rough inn bed is wrong for a lord; then add a `--noble` / `--stone` variant sku of the same role).
- How a room type is defined: `tools/spawn-tuner/build_data.py` (ROOM_TYPES), `tools/spawn-tuner/ROOMS.md`, recipe
  `tav-yard` in `catalog/rooms-inn.md`, and the solver's programs in `tools/spawn-tuner/js/solver.js` / `solver2.js`
  (READ ONLY: another agent is editing them). Note `isHung` / `HUNG_IDS` and how light sources are recognised: you must
  flag which of your new ids hang on a wall and which are lights.
- The worked example of a spec: `experiments/2026-10-05-yard-props/build_spec.py` and its `assets.json` (prompt built from
  `style/heroic-handpainted.object.md`, the gate `desc` / `must` / `must_not`, sibling pieces painted from a parent plate
  via `parent=`), and `experiments/2026-10-05-yard-props/README.md`. For wall kits also LAB_NOTES.md sections
  "2026-10-02 — Decision: generated walls, not the kit" and "2026-10-05 — Log-cabin window, open window and doorway"
  and `experiments/2026-10-05-log-cabin/build_spec.py` (how a wall style and its window/door are specified and named:
  `<object>--<family>[--sN]`, e.g. `wall-straight--log-cabin`, `wall-window-small--log-cabin`).
- Open/closed twins: LAB_NOTES.md "2026-10-04 — Alignment Bench" and `catalog/objects-open-states.catalog.md`,
  `experiments/2026-10-02-openclose/`.
- Limits of the generator (TRELLIS.2 image-to-3D): wants ONE chunky isolated object. Thin things (chains, ropes, cobwebs,
  bare tools, railings, lattice) break into floating pieces: make them chunky or bundle them (the yard's `hoe` failed; the
  bundle `garden-tools-leaning` shipped). Big blocky plain masses can come back partly unpainted: give big stone things
  carved relief, mouldings and colour variation in the prompt. The generator ignores stated sizes: the size in the spec is
  what the mesh is SCALED to (largest dimension), so proportions in the prompt matter. Nothing may stand on a base slab,
  ground disc or plinth it would not really have. No text, no logos, no people or creatures, no blue on the object.
  Flat things (rugs, tapestries seen flat, floor textures, papers) are NOT meshes: list them under `flats`.

## What you deliver (all inside `B/<type>/` unless said)
1. **Catalog lines** for every role you need that has no line yet: a NEW file `catalog/objects-<type>.catalog.md`
   (crypt / castle / mansion / vertical), same header style and grammar as `catalog/objects-outdoors.catalog.md`. Add your
   setting tag to existing lines only if needed for a recipe and only by a minimal edit of that line. Role ids are global:
   before inventing one, `grep` every `catalog/*.catalog.md` for an existing role that means the same thing and use it.
   To avoid colliding with the other designers' NEW ids: crypt designer prefixes nothing but checks `catalog/objects-*.catalog.md`
   of the others at the end; if two of you invented the same id for the same thing, keep one line (the first file
   alphabetically) and both reference it.
2. **Room recipes**: a NEW file `catalog/rooms-<type>.md` (not for vertical) in the grammar of `catalog/rooms-inn.md`
   (recipe ids `cry-…`, `cas-…`, `nob-…`; reuse existing recipes for these settings where they already exist rather than
   duplicating them). Run `python3 src/catalog_tool.py` (see its `--help`) and leave it CLEAN.
3. **`rooms.json`**: for the integration agent. A list of rooms: `key`, `label`, `outdoor` (bool), default `cells` [w,d] in
   5-ft cells, `family` (wall style), `floors` (ordered, first = default; mark each `exists` or `new`), `recipes`,
   `focal` (role ids, in order of preference), and a `program` object in plain data: which existing solver program is the
   closest fit (`common`, `kitchen`, `store`, `bedroom`, `hallway`, `desk`, `stable`, `barn`, `outdoors` …) and the
   layout rules in words and counts (what goes against walls, what in the centre, what in rows, what sits on what, how
   many per room size, what hangs on walls, what is a light and of which kind: candle / torch / brazier / fireplace /
   lantern / chandelier). Also `reuse`: existing library role ids this room uses. A room must be recognisable from above
   by its focal piece plus two or three supporting pieces: say which.
4. **`build_spec.py` -> `assets.json`** for every NEW mesh, in exactly the yard's format (copy its helper and adapt:
   same `add(...)`, STYLE, NOBASE, `parent=` for siblings). Fields per asset: `id` (the sku), `object` (catalog role),
   `group`, `size` [w,d,h] inches, `prompt`, `refs`, `gate_refs`, `gate` {desc, must, must_not}. Extra fields you add per
   asset (the runner ignores them, later stages use them): `"prio": 1|2|3` (1 = focal pieces, wall kit and whatever makes a
   room read; 2 = furniture; 3 = smalls and variants), `"rooms": [...]`, `"bench": []` any of `"fire"`, `"water"`, `"hinge"`
   (needs Harry on the Alignment Bench), `"hung": true` for wall-hung, `"light": "candle|torch|brazier|fireplace|lantern|chandelier"`
   for light sources (generate them UNLIT: no flame painted; see `catalog/objects-lighting.catalog.md`), `"twin_of": "<closed sku>"`
   for an open-state mesh, `"route": "trellis"` (default) or `"hunyuan-mv"` for hollow things that TRELLIS cannot do
   (say why). Groups: `p1`, `p2`, `p3` for independent pieces; `sib1`, `sib2`, `sib3` for pieces painted FROM an accepted
   parent plate of the same prio (a wall's window and door from the wall; sarcophagus variants from the first; a furniture
   suite from its first piece; an open twin from its closed twin). A parent must be in a `p` group.
   Gate text: `desc` is one plain sentence of what a blind describer should have seen; `must` only what truly matters
   (the yard lost a good plate to a gate text that demanded a domed top); `must_not` the specific wrong things.
   Run `python3 build_spec.py` and check `assets.json` loads and every `object` exists in the catalog with a size.
5. **`flats.json`**: floors (seamless ground textures, name `floor-…`), and any other flat images you want (rugs, wall
   hangings as flat cards), each with `id`, one-paragraph description, and which rooms use it. Check what floors exist
   first (`library.json`, ids starting `floor-`, `rug-`, `decal-`). Keep it small: 2-5 new floors per type.
6. **`README.md`** in your folder: rooms, counts by prio and group, what you reuse, risks (pieces you expect the generator
   to struggle with), and the list of bench items.

## Budgets (new meshes to specify; siblings, variants and open twins count)
- crypt: about 75. castle: about 135. mansion: about 135. vertical kit: about 45 meshes + 4 roof-surface flats.
- Roughly a quarter prio 1, half prio 2, a quarter prio 3. Give the most-repeated pieces 2-3 shape variants
  (`--s2`, `--s3`) so repeats do not read as copies (pews, sarcophagi, armour stands, dining chairs).
- Each wall style: `wall-straight--<family>` in two versions (`--s2`), one window piece where the type has windows, and
  note which existing door leaf fits or specify one. Wall pieces are 5 ft wide x 9 ft tall kit panels seen from the broad side.

## Report back (under 250 words)
Rooms (key: focal), counts of new meshes by prio, flats wanted, number of reused roles, catalog_tool result, anything you
could not decide. No file dumps.

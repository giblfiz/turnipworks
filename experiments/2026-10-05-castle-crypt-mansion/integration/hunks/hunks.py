"""The integration, as a list of hunks (see ../apply.py). Paths are relative to tools/spawn-tuner.

Order matters only inside one file: `once` tails first, then each type's. Every `anchor` / `old` string must occur
exactly once in its file; apply.py refuses to write anything if one does not.
"""
import pprint

def room_type_lines(rows):
    out = ""
    for r in rows:
        r = {k: v for k, v in r.items() if not k.startswith("_")}
        out += "    " + pprint.pformat(r, width=100000, sort_dicts=False) + ",\n"
    return out

ROOMS_ANCHOR = ']\nSHELL = "any-shell"\n'

def hunks(rt):
    H = []
    add = lambda **k: H.append(k)
    # ------------------------------------------------------------------ build_data.py
    add(id="data.batch", scope="once", file="build_data.py", kind="before",
        anchor="    # a remeshed piece set supersedes the whole-object SKU it was split from (bar-counter pieces)\n", text=rt.BATCH_BLOCK)
    add(id="data.objects", scope="once", file="build_data.py", kind="before",
        anchor="    # room types: union of recipe slots, filtered to objects we can show (mesh or flat) plus sets we can assemble\n", text=rt.OBJECT_HUNK)
    for i, (old, new) in enumerate(rt.BORROW_HUNK):
        add(id=f"data.rooms-loop-{i + 1}", scope="once", file="build_data.py", kind="replace", old=old, new=new)
    for t in ("crypt", "castle", "mansion"):
        head = {"crypt": "    # Crypt (2026-10-05): seven rooms, crypt-stone walls, no windows. v2 programs: js/solver2.js (the appended block)\n",
                "castle": "    # Castle (2026-10-05): nine rooms; castle-rough for the working rooms, dressed-stone for hall, throne room and chapel\n",
                "mansion": "    # Mansion (2026-10-05): eight state rooms + two service rooms; every room wealth 'fine', its own meshes are tier 'noble'\n"}[t]
        add(id=f"data.room-types.{t}", scope=t, file="build_data.py", kind="before", anchor=ROOMS_ANCHOR,
            text=head + room_type_lines(getattr(rt, t.upper() + "_ROOM_TYPES")))
    # ------------------------------------------------------------------ js/walls.js
    add(id="walls.door-hook", scope="once", file="js/walls.js", kind="after", anchor="export function doorTypeFor(e, byId) {\n",
        text="  const special = specialDoor(e, byId); if (special) return special; // castle / crypt / mansion: DOORS, at the end of this file\n")
    add(id="walls.panel-hook", scope="once", file="js/walls.js", kind="before", anchor="  // corners: grid vertices that join a horizontal and a vertical wall\n",
        text="  specialPanels(rooms, edges, byId, opts); // castle / crypt / mansion: THROUGH and PANELS, at the end of this file (after doors and windows are decided)\n")
    add(id="walls.door-order", scope="once", file="js/walls.js", kind="replace",
        old="  const order = h % 2 ? SIDE_PREF : ['S', 'W', 'E', 'N'];\n",
        new="  const order = doorOrder(room, h % 2 ? SIDE_PREF : ['S', 'W', 'E', 'N'], turn); // castle / crypt / mansion: DOOR_ENDS, at the end of this file\n")
    add(id="walls.once", scope="once", file="js/walls.js", kind="tail", src="hunks/walls_tail.once.js")
    for t in ("crypt", "castle", "mansion"):
        add(id=f"walls.{t}", scope=t, file="js/walls.js", kind="tail", src=f"hunks/walls_tail.{t}.js")
    # ------------------------------------------------------------------ js/solver.js
    add(id="solver.has", scope="once", file="js/solver.js", kind="replace",
        old="  has(id) { return !!this.lib.objects[id]; }\n",
        new="  has(id) { const o = this.lib.objects[id]; return !!o && (!o.only || o.only.some(t => (this.type.tiers || []).includes(t))); } // o.only: every mesh of this role has an exclusive tier (build_data.py)\n")
    add(id="solver.tiers", scope="once", file="js/solver.js", kind="before", anchor="    const tier = this.type.wealth === 'fine' ? 'fine' : 'common';\n",
        text="    // exclusive tiers (build_data.py: the mansion's 'noble', the storey kit's 'storey') are rolled only by room types that\n"
             "    // list them in `tiers`, in that order of preference; every other room rolls exactly what it rolled before\n"
             "    // (want.tiers overrides the room's list for one placement: [] = the plain meshes; want.shape names one variant)\n"
             "    const tiers = want.tiers || this.type.tiers || [], named = want.shape !== undefined ? pool.filter(s => s.shape === want.shape) : [];\n"
             "    if (named.length) pool = named;\n"
             "    else { const open = pool.filter(s => !s.tier || s.tier === 'common' || s.tier === 'fine' || tiers.includes(s.tier)); if (open.length) pool = open; }\n"
             "    if (!named.length && tiers.length) { const own = pool.filter(s => s.tier === tiers[0]); if (own.length) pool = own; }\n")
    add(id="solver.fit", scope="once", file="js/solver.js", kind="replace",
        old="    if (o.place === 'kit') { const oy = orientDeg(sku, this.opts); return {",
        new="    if (o.place === 'kit' || sku.fit === 'box') { /* (fit box: a kit-generated piece that stands as a prop, the castle dais: build_data.py) */ const oy = orientDeg(sku, this.opts); return {")
    add(id="solver.once", scope="once", file="js/solver.js", kind="tail", src="hunks/solver_tail.once.js")
    for t in ("crypt", "castle", "mansion", "vertical"):
        add(id=f"solver.{t}", scope=t, file="js/solver.js", kind="tail", src=f"hunks/solver_tail.{t}.js")
    # ------------------------------------------------------------------ js/solver2.js  (the programs)
    add(id="solver2.common", scope="once", file="js/solver2.js", kind="tail", src="programs/00-common.js")
    add(id="solver2.crypt", scope="crypt", file="js/solver2.js", kind="tail", src="programs/10-crypt.js")
    add(id="solver2.castle", scope="castle", file="js/solver2.js", kind="tail", src="programs/20-castle.js")
    add(id="solver2.mansion", scope="mansion", file="js/solver2.js", kind="tail", src="programs/30-mansion.js")
    # ------------------------------------------------------------------ js/look.js
    add(id="look.corner", scope="once", file="js/look.js", kind="replace",
        old="    const stone = v.family === 'dressed-stone' || v.family === 'fieldstone';\n",
        new="    const vf = FAMILY_FALLBACK[v.family] || v.family, stone = vf === 'dressed-stone' || vf === 'fieldstone'; // a family that borrows a stone family's pieces gets its stone corner pillars (crypt-stone, castle-rough)\n")
    add(id="look.panel", scope="once", file="js/look.js", kind="after",
        anchor="    if (piece === 'wall-window-small' && !familyUsable(piece, e.family)) piece = 'wall-straight';\n",
        text="    // a special wall panel (walls.js PANELS: burial niches, a wall of skulls, stained glass) stands in for the plain panel when\n"
             "    // its family has the piece. It is thicker than the 12-in wall: its room face stays flush, the extra depth goes outward\n"
             "    let pin = -1; // (a panel rule may name the version: e.panelShape)\n    if (e.kind === 'wall' && e.panel && familyUsable(e.panel, e.family)) { piece = e.panel; const out = (lib.objects[piece].size[1] / 12 - 1) / 2; base.x -= Math.sin(t.rot) * out; base.z -= Math.cos(t.rot) * out;\n      if (e.panelShape != null) pin = lib.objects[piece].skus.filter(s => s.bounds && skuUsable(s, solverOpts()) && s.family === e.family).findIndex(s => (s.shape || '') === e.panelShape); }\n")
    add(id="look.panel-pick", scope="once", file="js/look.js", kind="replace",
        old="    const specs = wide ? [] : [{ ...kitSpec(piece, e.family, undefined, {}, Math.abs(along) + hash(`${e.dir}:${line}`, 'variant') % 64), ...base,",
        new="    const specs = wide ? [] : [{ ...kitSpec(piece, e.family, undefined, {}, pin >= 0 ? pin : Math.abs(along) + hash(`${e.dir}:${line}`, 'variant') % 64), ...base,")
    add(id="look.leaf", scope="once", file="js/look.js", kind="replace",
        old="      const leaf = lib.objects[dt].skus.find(k => k.piece === 'leaf' && k.bounds && skuUsable(k, solverOpts()));\n",
        new="      const leaves = lib.objects[dt].skus.filter(k => k.piece === 'leaf' && k.bounds && skuUsable(k, solverOpts()));\n"
            "      // a role with several leaves hangs the plain one ('leaf') unless the room type asks for another (walls.js DOORS: e.doorLeaf)\n"
            "      const leaf = leaves.find(k => k.shape === (e.doorLeaf || 'leaf')) || leaves.find(k => k.shape === 'leaf') || (e.doorLeaf ? leaves[0] : null);\n")
    # ------------------------------------------------------------------ js/main.js (the tuner page)
    add(id="main.edge-sig", scope="once", file="js/main.js", kind="replace",
        old="`${e.kind}|${e.family}|${e.owner.side}|${e.doorType || ''}|${e.span || 1}|${fsig}` });\n",
        new="`${e.kind}|${e.family}|${e.owner.side}|${e.doorType || ''}|${e.span || 1}|${fsig}|${e.panel || ''}|${e.panelShape ?? ''}|${e.doorLeaf || ''}` });\n")
    add(id="main.palette-keys", scope="once", file="js/main.js", kind="replace",
        old="  b.innerHTML = `<i style=\"background:${t.color}\"></i>${t.label} <kbd>${KEYS[i]}</kbd>`;\n",
        new="  if (t.group && t.group !== types[i - 1]?.group) { const g = document.createElement('span'); g.className = 'pgroup'; g.textContent = t.group; palette.append(g); } // castle / crypt / mansion: a heading per type\n"
            "  b.innerHTML = `<i style=\"background:${t.color}\"></i>${t.label} <kbd>${KEYS[i] || ''}</kbd>`;\n")
    add(id="main.palette-css", scope="once", file="styles.css", kind="after",
        anchor="#palette button.active { border-color: var(--turnip); background: #2d3322; }\n",
        text="#palette .pgroup { flex-basis: 100%; color: var(--muted); font: 11px \"DM Mono\", monospace; text-transform: uppercase; letter-spacing: .06em; margin-top: 2px; }\n")
    # ------------------------------------------------------------------ lights, wall select, fog: per type
    FIRE = {"crypt": "  if (/flame-bowl/.test(id)) return 'brazier';   // crypt: rite-sacred-flame-bowl\n"
                     "  if (/sand-tray/.test(id)) return 'stubs';      // crypt: rite-memorial-sand-tray (a tray of thin candles)\n",
            "castle": "  if (/cresset/.test(id)) return 'torch';        // castle: cresset-wall\n"
                      "  if (/signal-beacon|boiling-oil|fire-basket|cauldron-crane|pig-on-spit/.test(id)) return 'brazier'; // castle: open fires that are not in a hearth\n"}
    FIRE_PY = {"crypt": "    if 'flame-bowl' in i: return 'brazier'\n    if 'sand-tray' in i: return 'stubs'\n",
               "castle": "    if 'cresset' in i: return 'torch'\n    if re.search(r'signal-beacon|boiling-oil|fire-basket|cauldron-crane|pig-on-spit', i): return 'brazier'\n"}
    WALLS = {"crypt": '<option value="crypt-stone">crypt stone</option>', "castle": '<option value="castle-rough">castle rough stone</option>',
             "mansion": '<option value="noble-panel">oak panelling</option><option value="noble-paper">damask paper</option><option value="conservatory">conservatory glass</option>'}
    FOG = {"crypt": '  "crypt-antechamber": 1.5,\n  "crypt-vault": 3,\n  "crypt-ossuary": 3,\n  "crypt-catacomb": 3,\n  "crypt-chapel": 1.5,\n  "crypt-embalming": 0,\n  "crypt-relic": 2.5,\n',
           "castle": '  "dungeon": 2,\n', "mansion": '  "mansion-cellar": 2.5,\n'}
    for t in ("crypt", "castle", "mansion"):
        if t in FIRE:
            add(id=f"fire.{t}", scope=t, file="js/fx/fire.js", kind="after", anchor="  if (/lantern|lamp/.test(id)) return 'lantern';\n", text=FIRE[t])
            add(id=f"fire-anchors.{t}", scope=t, file="prep/fire_anchors.py", kind="after", anchor="    if re.search(r'lantern|lamp', i): return 'lantern'\n", text=FIRE_PY[t])
        add(id=f"html.walls.{t}", scope=t, file="index.html", kind="after", anchor='<option value="noble-interior">panelled plaster</option>', text=WALLS[t])
        add(id=f"fog.{t}", scope=t, file="data/fog_defaults.json", kind="after", anchor='  "vault": 2.5,\n', text=FOG[t])
    # ------------------------------------------------------------------ reusing an inn program under a new key (castle kitchen, the mansion's kitchen and cellar)
    add(id="solver2.alias", scope="once", file="js/solver2.js", kind="replace",
        old="  const type = args.type, key = type.key;\n",
        new="  const type = args.type, key = PROGRAM_OF[type.key] || type.key; // a room type that IS an inn room in other walls runs the inn's program (PROGRAM_OF, in the appended block)\n")
    # ------------------------------------------------------------------ castle / mansion: an outdoor room type with its own grammar
    # attempt() sends every outdoor room to yard(). A type that registers KEY[key] (the castle courtyard, the formal garden)
    # runs that instead; the inn's yard has no KEY entry and is exactly as before. The same line for both scopes: the
    # second one finds it already there.
    for t in ("castle", "mansion"):
        add(id=f"solver2.outdoor.{t}", scope=t, file="js/solver2.js", kind="replace",
            old="  if (ctx.role === 'outdoor') return finish(ctx, yard(ctx), args); // no walls, no zone menu, no density fill: its own grammar\n",
            new="  if (ctx.role === 'outdoor') return finish(ctx, (KEY[key] || yard)(ctx), args); // no walls, no zone menu, no density fill: its own grammar (the yard's, or the type's own: KEY)\n")
    return H

"""The "everything on screen is touchable" invariant (docs/UI.md), shared by the browser suites."""
# "everything on screen is touchable": sample a dense grid of screen points; wherever the first thing the ray meets is
# drawn and is not ground or generated floor, the ordinary pick must resolve it to something selectable.
#
# 2026-10-06, THE PIECE ITSELF. Harry: "I'm looking at some pillars that are holding up an overhang, and I don't seem to
# be able to select them as first-class objects." The audit above passed on them: a click on a post selected the ROOM it
# held up, and "something selectable" was all it asked for. It also never looked at the roof layer. So now:
#   - a generated piece (anything in the shell that is not floor: walls, doors, windows, posts, a tall room's upper
#     walls, the brackets and posts under an overhang, the railing round a stair's hole) must be offered AS ITSELF
#     ('wall:<its key>') among what the pick resolves, not only as its room;
#   - a point whose first drawn thing is a roof or its trim (chimney, dormer, parapet, ridge, finial) must resolve to
#     that roof ('roof:<room>'): trim is part of its roof by decision (re-roll moves it; docs/UI.md "Roofs").
# The floor slab under an upper room counts as floor (deliberate: it is the room's floor seen from the side).
#
# 2026-10-06 (later), THE GROUND IS IN THE WAY TOO. The audit took "the first thing the ray meets" from the shell and the
# things only, so a cellar's wall drawn under the closed ground (near a stair's hole, or the outer half of a wall beside
# the opened ground) counted as on screen, and the audit REQUIRED it to be pickable through the ground. Harry: "on floor
# two I can still select things on floor one directly thru the actual floor." The ground mesh is one of the layers now:
# a point whose first drawn thing is the ground asks nothing, like a floor. Its partner is browser_cut.py FLOORS, which
# checks the other direction (no pick lies behind a floor or the ground that is drawn).
AUDIT = """(() => { const w = tw.worldOf(tw.area()), c = document.getElementById('c').getBoundingClientRect(), bad = [], notOwn = [];
  const vis = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  let tested = 0, pieces = 0, roofs = 0; const layers = [w.layers.shell, w.layers.things, w.ground]; if (w.roofLayer && w.roofsOn) layers.push(w.roofLayer);
  for (let i = 0; i < 64; i++) for (let j = 0; j < 40; j++) {
    const x = c.left + (i + 0.5) * c.width / 64, y = c.top + (j + 0.5) * c.height / 40, ray = tw.rayAt(x, y);
    const h = ray.intersectObjects(layers, true).find(h => h.object.isMesh && !h.object.isSprite && !h.object.userData.halo && vis(h.object) && (!h.object.material || h.object.material.opacity > 0.05));
    if (!h) continue;
    if (h.object.userData.ground) continue; // the ground itself (see the note of 2026-10-06 below)
    let o = h.object; while (o && !o.userData.shellKey && !o.userData.entityId && !o.userData.roofOf) o = o.parent;
    if (o?.userData.floor) continue; // the generated floor: the ground of the room (and the slab an upper room stands on)
    tested++;
    const hits = w.pickAll(ray), sel = hits.map(x => tw.selectionFor(x)).filter(Boolean);
    const what = o?.userData.shellKey || o?.userData.entityId || (o?.userData.roofOf && 'roof:' + o.userData.roofOf) || h.object.name || 'unknown';
    if (!sel.length) { bad.push({ x: Math.round(x), y: Math.round(y), what }); continue; }
    if (tw.overview()) continue; // at the map detent a click takes the building, by design
    if (o?.userData.shellKey && !o.userData.entityId) { pieces++; const k = o.userData.edgeKey; if (!k || !sel.includes('wall:' + k)) notOwn.push({ x: Math.round(x), y: Math.round(y), what, got: sel[0] }); }
    else if (o?.userData.roofOf && !o.userData.entityId) { roofs++; if (!sel.includes('roof:' + o.userData.roofOf)) notOwn.push({ x: Math.round(x), y: Math.round(y), what, got: sel[0] }); }
  }
  const all = [...bad, ...notOwn];
  return { tested, pieces, roofs, bad: all.slice(0, 6), nbad: all.length, untouchable: bad.length, notOwn: notOwn.length, kinds: [...new Set(all.map(b => String(b.what).replace(/[0-9-]+/g, '#')))] };
})()"""

// Presence: cursors (ground points in world feet), drags in progress, ghost cursors of LLM seats.
// Lossy by design. Smoothness comes from the receiver, robustness from the sender:
//   PresenceSender  at most ~18 Hz; after the last change it repeats the final state 8 times (150 ms apart
//                   for 1.2 s), then heartbeats every 1 s: at 36% end-to-end loss, P(all 8 lost) ~ 0.03%
//   PresenceView    per seat, glides toward the latest sample (critically damped), never jumps backwards
//                   in time; a seat disappears on `gone` or after 10 s of silence

export class PresenceSender {
  constructor(send, { hz = 18, settleMs = 150, settleFor = 1200, heartbeatMs = 1000, now = () => Date.now() } = {}) {
    Object.assign(this, { send, minGap: 1000 / hz, settleMs, settleFor, heartbeatMs, now });
    this.cur = null; this.lastSent = 0; this.lastChange = 0; this.dirty = false;
  }
  // set the presence for an area (cursor [x,z] or null, drag {id,x,z} or null)
  set(area, data) {
    // copy: callers often reuse (mutate) one vector, which would make every change look like no change
    const drag = data.drag ? [].concat(data.drag).slice(0, 64).map(d => ({ id: d.id, x: d.x, z: d.z, ...(d.rot != null && { rot: d.rot }), ...(d.y != null && { y: d.y }), ...(d.quat != null && { quat: d.quat }) })) : null;
    // the seat's selection (ids, shared so every other seat sees it outlined faintly in this seat's colour); a call
    // that doesn't mention it keeps the last one for this area
    const sel = data.sel !== undefined ? (data.sel ? [].concat(data.sel).filter(id => typeof id === 'string').slice(0, 64) : null) : (this.cur?.area === area ? this.cur.sel : null);
    // the cursor's height (storeys): the floor it points at, as a third number, left out on the ground (so the shape is
    // unchanged for flat play and for clients that predate it)
    const cy = data.cursor ? +(data.cursor[2] ?? data.cursor.y ?? 0) || 0 : 0;
    // a ruler being drawn (docs/RULERS.md; setRuler below): it rides along with whatever else is sent, until taken away
    const ruler = this.rulerOf?.area === area ? this.rulerOf.ruler : null;
    const next = { area, cursor: data.cursor ? [data.cursor[0], data.cursor[1], ...(cy ? [Math.round(cy * 100) / 100] : [])] : null, drag: drag && drag.length ? drag : null, ...(sel?.length && { sel }), ...(ruler && { ruler }) };
    const same = this.cur && this.cur.area === area && JSON.stringify(this.cur) === JSON.stringify(next);
    this.cur = next;
    if (!same) { this.dirty = true; this.lastChange = this.now(); }
    this.tick();
  }
  // what this seat is measuring right now (core/measure.js cleanRuler's shape), or null: sent with the cursor and the
  // drag, which stay as they are
  setRuler(area, ruler) {
    const was = this.rulerOf; this.rulerOf = ruler ? { area, ruler } : null;
    if (!was && !ruler) return;
    const cur = this.cur?.area === area ? this.cur : null;
    this.set(area, { cursor: cur?.cursor || null, drag: cur?.drag || null });
  }
  // call every frame (or from a timer)
  tick() {
    if (!this.cur) return;
    const t = this.now(), since = t - this.lastSent;
    const settling = t - this.lastChange < this.settleFor;
    if ((this.dirty && since >= this.minGap) || (settling && since >= this.settleMs) || since >= this.heartbeatMs) {
      if (this.send(this.cur)) { this.lastSent = t; this.dirty = false; }
    }
  }
}

export class PresenceView {
  constructor({ rate = 14, expireMs = 10000, now = () => Date.now() } = {}) {
    Object.assign(this, { rate, expireMs, now });
    this.seats = new Map(); // `${area}|${seat}` -> state
    this.hidden = new Set(); // seats whose cursor is not drawn here (this screen shows it another way: the intro's phantom)
  }
  ingest(m) {
    const k = `${m.area}|${m.seat}`;
    if (m.gone || (!m.cursor && !m.drag && !m.sel?.length && !m.ruler)) { this.seats.delete(k); return; }
    let s = this.seats.get(k);
    if (!s) { s = { pos: m.cursor ? [...m.cursor] : null, drags: new Map() }; this.seats.set(k, s); }
    Object.assign(s, { area: m.area, seat: m.seat, name: m.name, color: m.color, label: m.label || null, ghost: !!m.ghost, thinking: !!m.thinking, target: m.cursor || s.target, at: this.now(), sel: m.sel || [], away: !m.cursor, ruler: m.ruler || null });
    if (!s.pos && m.cursor) s.pos = [...m.cursor];
    if (s.pos && m.cursor) s.pos[2] = m.cursor[2] || 0; // its height: the floor it points at (0 from a client that sends none)
    // drags in progress (one thing or a whole selection): each glides toward its latest sample
    const list = m.drag ? [].concat(m.drag) : [];
    const keep = new Set(list.map(d => d.id));
    for (const id of [...s.drags.keys()]) if (!keep.has(id)) s.drags.delete(id);
    for (const d of list) { const cur = s.drags.get(d.id); if (cur) Object.assign(cur, { tx: d.x, tz: d.z, rot: d.rot, y: d.y, quat: d.quat }); else s.drags.set(d.id, { x: d.x, z: d.z, tx: d.x, tz: d.z, rot: d.rot, y: d.y, quat: d.quat }); }
  }
  // advance smoothing by dt seconds; far jumps (> 60 ft) snap instead of sliding across the map
  step(dt) {
    const k = 1 - Math.exp(-dt * this.rate), t = this.now();
    for (const [key, s] of this.seats) {
      if (t - s.at > this.expireMs) { this.seats.delete(key); continue; }
      if (s.target && s.pos) glide(s.pos, s.target, k);
      for (const d of s.drags.values()) { const p = [d.x, d.z]; glide(p, [d.tx, d.tz], k); d.x = p[0]; d.z = p[1]; }
    }
  }
  // what other seats have selected in an area: Map(id -> { seat, name, color })
  selections(area, except = null) { const out = new Map(); for (const s of this.seats.values()) if (s.area === area && s.seat !== except) for (const id of s.sel || []) if (!out.has(id)) out.set(id, { seat: s.seat, name: s.name, color: s.color }); return out; }
  // the seats present in an area, with their smoothed positions
  on(area) { return [...this.seats.values()].filter(s => s.area === area); }
  // a drag in progress on an entity (someone else's), smoothed: the renderer draws the entity here
  dragOf(area, id) { for (const s of this.seats.values()) if (s.area === area && s.drags.has(id)) return s.drags.get(id); return null; }
  // whose drag that is (for the dragger's colour on a room's footprint)
  dragSeat(area, id) { for (const s of this.seats.values()) if (s.area === area && s.drags.has(id)) return s; return null; }
  // a committed move from `seat` ends that seat's drags (in case the drag-end packet was lost)
  endDrag(area, seat) { const s = this.seats.get(`${area}|${seat}`); if (s) s.drags.clear(); }
}

function glide(p, target, k) {
  const dx = target[0] - p[0], dz = target[1] - p[1];
  if (Math.hypot(dx, dz) > 60) { p[0] = target[0]; p[1] = target[1]; return; }
  p[0] += dx * k; p[1] += dz * k;
}
// (the height does not glide: a cursor is on one floor or another)

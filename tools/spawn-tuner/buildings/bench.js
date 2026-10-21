// THE BUILDINGS BENCH: many generated buildings at once as labelled floor plans, so a layout rule can be judged by eye
// across types, footprints and seeds (docs/BUILDINGS.md). It draws exactly what js/buildings.js generate() returns: the
// game builds from the same plan. Notes go to the tuner's write-back (POST /tuner, kind "note", name "buildings ...").
const SVG = 'http://www.w3.org/2000/svg';
const qs = new URLSearchParams(location.search);
const API = qs.get('api') || '/api/tw-ratings';
const GAME = qs.get('game') || 'https://turnipworks.net/';
const SIZES = [[8, 6], [12, 8], [16, 12], [20, 14]];
const $ = (s, el = document) => el.querySelector(s);
const el = (tag, attrs = {}, kids = []) => { const e = document.createElementNS(SVG, tag); for (const [k, val] of Object.entries(attrs)) e.setAttribute(k, val); for (const k of kids) e.append(k); return e; };
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function start(v) {
  const q = v ? `?v=${v}` : `?t=${Date.now()}`;
  const [B, W, types, buildingTypes] = await Promise.all([import(`../js/buildings.js${q}`), import(`../js/walls.js${q}`), fetch(`../data/rooms.json${q}`).then(r => r.json()), fetch(`../data/types.json${q}`).then(r => r.json())]);
  const T = Object.fromEntries(types.map(t => [t.key, t]));
  const roomsOf = (code) => types.filter(t => (t.recipes || []).some(r => r.startsWith(code.toLowerCase() + '-'))).map(t => ({ key: t.key, cells: t.cells, outdoor: !!t.outdoor }));
  // a type is shown when it has rooms of its OWN (first recipe): the castle's dungeon also lists a 'dun-' recipe, which does not make a Dungeon type
  const own = (code) => types.filter(t => (t.recipes || [])[0]?.startsWith(code.toLowerCase() + '-')).length;
  const codes = buildingTypes.map(t => t.code).filter(c => B.BUILDING_TYPES[c] && own(c) >= 3);
  const saved = (() => { try { return JSON.parse(localStorage.getItem('tw.buildings.bench') || '{}'); } catch { return {}; } })();
  const S = { types: new Set(codes), sizes: new Set(SIZES.map(s => s.join('x'))), seeds: 4, salt: 1, storeys: 0, front: 'S', out: true, graph: true, dials: { loops: null, pacing: null, carved: null }, ...saved };
  S.types = new Set([...(saved.types || codes)].filter(c => codes.includes(c))); if (!S.types.size) S.types = new Set(codes);
  S.sizes = new Set(saved.sizes || SIZES.map(s => s.join('x')));
  const save = () => { try { localStorage.setItem('tw.buildings.bench', JSON.stringify({ ...S, types: [...S.types], sizes: [...S.sizes] })); } catch { } };
  const bench = window.bench = { S, plans: [], B, codes };

  // ---------------- controls
  const toggles = (host, items, isOn, flip, { one = false } = {}) => { for (const [key, label, title] of items) { const b = h('button', isOn(key) ? 'on' : '', label); b.dataset.key = key; if (title) b.title = title; b.onclick = (ev) => { flip(key, ev); for (const x of host.querySelectorAll('button')) x.classList.toggle('on', isOn(x.dataset.key)); render(); }; host.append(b); } void one; };
  // (click = toggle; Alt/Shift-click or double-click = only this one)
  const only = (set, all) => (key, ev) => { if (ev.shiftKey || ev.altKey || ev.detail > 1) { set.clear(); set.add(key); } else if (set.has(key) && set.size > 1) set.delete(key); else if (set.has(key)) { for (const a of all) set.add(a); } else set.add(key); };
  toggles($('#fType'), codes.map(c => [c, B.BUILDING_TYPES[c].label, 'click: show / hide · Shift-click: only this type']), k => S.types.has(k), only(S.types, codes));
  toggles($('#fSize'), SIZES.map(([w, d]) => [`${w}x${d}`, `${w * 5}×${d * 5} ft`, `${w}×${d} squares · Shift-click: only this size`]), k => S.sizes.has(k), only(S.sizes, SIZES.map(s => s.join('x'))));
  toggles($('#fStoreys'), [[0, 'default', "each type's own"], [1, '1'], [2, '2'], [3, '3']], k => +k === S.storeys, k => { S.storeys = +k; });
  toggles($('#fFront'), ['S', 'N', 'E', 'W'].map(k => [k, k, 'which side of the dragged rectangle is the street (S = the bottom of the drawing)']), k => k === S.front, k => { S.front = k; });
  const flag = (id, key) => { const b = $(id); b.classList.toggle('on', S[key]); b.onclick = () => { S[key] = !S[key]; b.classList.toggle('on', S[key]); render(); }; };
  flag('#tOut', 'out'); flag('#tGraph', 'graph');
  $('#more').onclick = () => { S.seeds = Math.min(12, S.seeds + 2); render(); }; $('#fewer').onclick = () => { S.seeds = Math.max(1, S.seeds - 1); render(); };
  $('#reseed').onclick = () => { S.salt = Math.floor(Math.random() * 1e5) + 2; render(); };
  for (const d of document.querySelectorAll('.dial')) {
    const k = d.dataset.dial, range = $('input[type=range]', d), def = $('label.def input', d), out = $('output', d);
    const words = () => { const defs = [...S.types].map(c => `${B.BUILDING_TYPES[c].label.toLowerCase()} ${k === 'carved' ? (B.BUILDING_TYPES[c].dials[k] >= 0.5 ? 'carved' : 'packed') : B.BUILDING_TYPES[c].dials[k]}`).join(' · ');
      out.textContent = S.dials[k] == null ? 'by type' : k === 'carved' ? (S.dials[k] >= 0.5 ? 'all carved' : 'all packed') : (+S.dials[k]).toFixed(2); out.title = `type defaults: ${defs}`; d.title = `type defaults: ${defs}`; d.classList.toggle('auto', S.dials[k] == null); };
    if (S.dials[k] != null) { range.value = S.dials[k]; def.checked = false; }
    range.oninput = () => { S.dials[k] = +range.value; def.checked = false; words(); render(); };
    def.onchange = () => { S.dials[k] = def.checked ? null : +range.value; words(); render(); };
    d._words = words; words();
  }
  $('#sendNote').onclick = async () => { const t = $('#note').value.trim(); if (!t) return toast('Type a note first', true); if (await send('buildings', t, null)) $('#note').value = ''; };
  $('#note').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') $('#sendNote').click(); });

  // ---------------- write-back
  const state = () => ({ dials: { ...S.dials }, filters: { types: [...S.types], sizes: [...S.sizes], seeds: S.seeds, salt: S.salt, storeys: S.storeys || 'default', front: S.front, outbuildings: S.out }, v: v || 'dev' });
  async function send(name, note, card) {
    try {
      const r = await fetch(`${API}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'note', name, note, data: { tool: 'buildings', ...state(), ...(card && { card }) } }) });
      const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) throw new Error(j.err || r.status);
      bench.lastSent = { name, note, card, at: j.at }; toast(`Sent to Fauna: "${note.slice(0, 60)}"`); return true;
    } catch (e) { toast(`Not sent: ${e.message}`, true); return false; }
  }
  let toastT = 0;
  function toast(text, err = false) { const t = $('#toast'); t.textContent = text; t.classList.toggle('err', err); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3500); }

  // ---------------- the drawing
  const label = (type) => T[type]?.label || type;
  const short = (name, room) => { const w = name.split(/[\s/]+/).filter(x => x && x !== '/'); const a = w.length > 1 ? w.map(x => x[0].toUpperCase()).join('') : name.slice(0, 4); return room < 14 ? a.slice(0, 2) : a; };
  const lvName = (L) => L >= 0 ? `lv ${L + 1}` : `lv ${L}`;
  const lvWhat = (plan, L) => L < 0 && !plan.down ? 'cellar' : L === 0 ? (plan.down ? 'first level' : 'ground') : plan.down ? `${-L} below` : L === 1 ? 'upstairs' : 'top';
  const K = (x, z) => `${x}:${z}`;
  // where a room's name and graph node go: the middle of the largest rectangle inside it
  function anchor(r) {
    if (!r.shaped) return [r.x + r.w / 2, r.z + r.d / 2];
    const set = new Set(r.cells.map(c => K(...c))); let best = null;
    for (const [x, z] of r.cells) { let w = 0; while (set.has(K(x + w, z))) w++; let d = 0, mw = w; for (; set.has(K(x, z + d)); d++) { let ww = 0; while (ww < mw && set.has(K(x + ww, z + d))) ww++; mw = ww; if (!mw) break; const a = mw * (d + 1); if (!best || a > best.a) best = { a, x, z, w: mw, d: d + 1 }; } }
    return best ? [best.x + best.w / 2, best.z + best.d / 2] : [r.cells[0][0] + 0.5, r.cells[0][1] + 0.5];
  }
  const tint = (hex, k) => { const n = parseInt((hex || '#b8b09a').slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(x => Math.round(x + (238 - x) * k)); return `rgb(${c.join(',')})`; };
  let uid = 0;
  function drawLevel(plan, L, box, px, tree) {
    const rooms = plan.rooms.filter(r => r.level === L), byId = new Map(plan.rooms.map(r => [r.id, r]));
    // squares a stair, its foot or its hole takes on this level: a room's name and node keep off them
    const stairAt = new Set();
    for (const s of plan.stairs) { const lo = Math.min(byId.get(s.from)?.level ?? 0, byId.get(s.to)?.level ?? 0); if (lo === L) for (const c of [s.foot, ...s.cells]) stairAt.add(K(...c)); if (lo + 1 === L) for (const c of [...s.cells, s.top]) stairAt.add(K(...c)); }
    const baseAnchor = anchor;
    const anchorOf = (r) => { const a = baseAnchor(r), hit = (p) => [[0, 0], [-0.5, 0], [0, -0.5], [-0.5, -0.5], [0.4, 0], [-0.9, 0], [0, 0.4], [0, -0.9]].some(([dx, dz]) => stairAt.has(K(Math.floor(p[0] + dx), Math.floor(p[1] + dz))));
      if (!hit(a)) return a; const set = new Set(r.cells.map(c => K(...c))); let best = null;
      for (const [x, z] of r.cells) { const p = [x + 0.5 + (set.has(K(x + 1, z)) ? 0.5 : 0), z + 0.5 + (set.has(K(x, z + 1)) && !set.has(K(x + 1, z)) ? 0.5 : 0)]; if (hit(p)) continue; const d = Math.hypot(p[0] - a[0], p[1] - a[1]); if (!best || d < best.d) best = { d, p }; }
      return best ? best.p : a; };
    const pad = 16, X = (x) => pad + (x - box.x0) * px, Z = (z) => pad + (z - box.z0) * px;
    const wpx = (box.x1 - box.x0) * px + pad * 2, hpx = (box.z1 - box.z0) * px + pad * 2 + 6, id = `p${++uid}`;
    const svg = el('svg', { class: 'plan', viewBox: `0 0 ${wpx} ${hpx}`, width: wpx, height: hpx });
    svg.append(el('defs', {}, [
      el('pattern', { id: `${id}h`, width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, [el('rect', { width: 5, height: 5, fill: '#f6f1e4' }), el('line', { x1: 0, y1: 0, x2: 0, y2: 5, stroke: '#5a554a', 'stroke-width': 1.6 })]),
      el('pattern', { id: `${id}p`, width: 6, height: 6, patternUnits: 'userSpaceOnUse' }, [el('circle', { cx: 3, cy: 3, r: 0.8, fill: 'rgba(40,30,20,.45)' })]),
      el('marker', { id: `${id}a`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, [el('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#1c1a15' })]),
    ]));
    const R = plan.rect, carved = plan.solver === 'carved';
    // the dragged footprint: rock when carved, a dashed outline otherwise
    svg.append(el('rect', { x: X(R.x), y: Z(R.z), width: R.w * px, height: R.d * px, fill: carved ? '#3d3a35' : 'none', rx: 1 }));
    const doorEdges = new Set(); // 'h:x:z' / 'v:x:z' on this level
    for (const r of rooms) { for (const e of Object.values(r.links)) doorEdges.add(e.join(':')); if (r.entry) for (let i = 0; i < r.entry[3]; i++) doorEdges.add([r.entry[0], r.entry[1] + (r.entry[0] === 'h' ? i : 0), r.entry[2] + (r.entry[0] === 'v' ? i : 0)].join(':')); }
    const at = new Map(); for (const r of rooms) for (const c of r.cells) at.set(K(...c), r);
    // floors
    for (const r of rooms) {
      const g = el('g', { opacity: r.outside ? 0.55 : 1 });
      const d = r.cells.map(([x, z]) => `M${X(x)},${Z(z)}h${px}v${px}h${-px}z`).join('');
      g.append(el('path', { d, fill: tint(T[r.type]?.color, r.role === 'hall' ? 0.72 : 0.5), stroke: 'none' }));
      if (r.priv) g.append(el('path', { d, fill: `url(#${id}p)` }));
      g.append(el('title', {}, [document.createTextNode(`${label(r.type)} · ${r.w * 5}×${r.d * 5} ft${r.shaped ? ' (shaped)' : ''} · ${r.role}${r.priv ? ' · private' : ''}${r.one ? ' · one door only' : ''}${r.depth != null ? ` · ${r.depth} from the street door` : ''}`)]));
      svg.append(g);
    }
    // stairs: the flight on its lower floor (treads and an arrow pointing UP the flight), the hole on the floor above
    for (const s of plan.stairs) {
      const lo = Math.min(byId.get(s.from)?.level ?? 0, byId.get(s.to)?.level ?? 0);
      const xs = s.cells.map(c => c[0]), zs = s.cells.map(c => c[1]), x0 = Math.min(...xs), z0 = Math.min(...zs), w = Math.max(...xs) - x0 + 1, d = Math.max(...zs) - z0 + 1;
      const dx = Math.sign(s.top[0] - s.foot[0]), dz = Math.sign(s.top[1] - s.foot[1]);
      if (lo === L) {
        const g = el('g', {}, [el('title', {}, [document.createTextNode(`${s.kind === 'ladder' ? 'ladder' : 'stair'} up to ${lvName(L + 1)}`)])]);
        g.append(el('rect', { x: X(x0) + 2, y: Z(z0) + 2, width: w * px - 4, height: d * px - 4, fill: '#f6f1e4', stroke: '#1c1a15', 'stroke-width': 1 }));
        const n = s.kind === 'ladder' ? 3 : 7;
        for (let i = 1; i < n; i++) { const t = i / n; g.append(dx ? el('line', { x1: X(x0) + 2 + t * (w * px - 4), y1: Z(z0) + 2, x2: X(x0) + 2 + t * (w * px - 4), y2: Z(z0 + d) - 2, stroke: '#1c1a15', 'stroke-width': 0.6 }) : el('line', { x1: X(x0) + 2, y1: Z(z0) + 2 + t * (d * px - 4), x2: X(x0 + w) - 2, y2: Z(z0) + 2 + t * (d * px - 4), stroke: '#1c1a15', 'stroke-width': 0.6 })); }
        const c = [X(x0 + w / 2), Z(z0 + d / 2)], half = (dx ? w : d) * px / 2 - 5;
        g.append(el('line', { x1: c[0] - dx * half, y1: c[1] - dz * half, x2: c[0] + dx * half, y2: c[1] + dz * half, stroke: '#1c1a15', 'stroke-width': 1.6, 'marker-end': `url(#${id}a)` }));
        g.append(el('text', { x: X(s.foot[0] + 0.5), y: Z(s.foot[1] + 0.5) + 3, class: 'dim' }, [document.createTextNode('up')]));
        svg.append(g);
      }
      if (lo + 1 === L) {
        const g = el('g', {}, [el('title', {}, [document.createTextNode(`the stair's hole: it comes up from ${lvName(L - 1)}; you step off (and start down) at the square marked "down"`)])]);
        g.append(el('rect', { x: X(x0) + 2, y: Z(z0) + 2, width: w * px - 4, height: d * px - 4, fill: `url(#${id}h)`, stroke: '#1c1a15', 'stroke-width': 1 }));
        const c = [X(x0 + w / 2), Z(z0 + d / 2)], half = (dx ? w : d) * px / 2 - 5;
        g.append(el('line', { x1: c[0] + dx * half, y1: c[1] + dz * half, x2: c[0] - dx * half, y2: c[1] - dz * half, stroke: '#1c1a15', 'stroke-width': 1.6, 'marker-end': `url(#${id}a)` }));
        g.append(el('text', { x: X(s.top[0] + 0.5), y: Z(s.top[1] + 0.5) + 3, class: 'dim', 'font-weight': 500 }, [document.createTextNode('down')]));
        svg.append(g);
      }
    }
    // walls: every cell edge with a different room (or nothing) beyond it, less the doors
    const walls = [], doors = [];
    const seg = (dir, x, z, a, b) => { const key = `${dir}:${x}:${z}`, out = (a?.outside || !a) && (b?.outside || !b);
      const p = dir === 'h' ? [X(x), Z(z), X(x + 1), Z(z)] : [X(x), Z(z), X(x), Z(z + 1)];
      if (doorEdges.has(key)) doors.push({ dir, p, a, b }); else if (!((a?.role === 'yard' || !a) && (b?.role === 'yard' || !b))) walls.push({ p, out }); else walls.push({ p, out: true, yard: true }); };
    const seen = new Set();
    for (const r of rooms) for (const [x, z] of r.cells) for (const [dir, ex, ez, nx, nz] of [['h', x, z, x, z - 1], ['h', x, z + 1, x, z + 1], ['v', x, z, x - 1, z], ['v', x + 1, z, x + 1, z]]) {
      const o = at.get(K(nx, nz)); if (o === r) continue; const k = `${dir}:${ex}:${ez}`; if (seen.has(k)) continue; seen.add(k); seg(dir, ex, ez, r, o); }
    for (const w of walls) svg.append(el('line', { x1: w.p[0], y1: w.p[1], x2: w.p[2], y2: w.p[3], class: w.yard ? 'wall out' : 'wall' }));
    for (const d of doors) { // a gap with the door leaf drawn ajar
      const [x1, y1, x2, y2] = d.p, hgt = px * 0.16;
      svg.append(el('line', { x1, y1, x2: x1 + (x2 - x1) * 0.14, y2: y1 + (y2 - y1) * 0.14, class: 'wall' })); svg.append(el('line', { x1: x2 - (x2 - x1) * 0.14, y1: y2 - (y2 - y1) * 0.14, x2, y2, class: 'wall' }));
      const street = !d.a || !d.b, r = px * 0.72; void hgt;
      // the leaf swung a quarter open, and the arc it sweeps: the architect's door
      svg.append(el('path', { d: d.dir === 'h' ? `M${x1 + px * 0.14},${y1} l0,${-r} M${x1 + px * 0.14},${y1 - r} A${r},${r} 0 0 1 ${x1 + px * 0.14 + r},${y1}` : `M${x1},${y1 + px * 0.14} l${r},0 M${x1 + r},${y1 + px * 0.14} A${r},${r} 0 0 1 ${x1},${y1 + px * 0.14 + r}`, class: 'door', ...(street && { stroke: '#d9302c', 'stroke-width': 2 }) }));
    }
    if (!carved) svg.append(el('rect', { x: X(R.x), y: Z(R.z), width: R.w * px, height: R.d * px, class: 'foot' }));
    // the street door: an arrow from outside, and the word
    for (const r of rooms) if (r.entry) { const [dir, gx, gz, span] = r.entry, mx = dir === 'h' ? X(gx + span / 2) : X(gx), mz = dir === 'h' ? Z(gz) : Z(gz + span / 2);
      const inside = at.get(dir === 'h' ? K(gx, gz) : K(gx, gz)) === r, ox = dir === 'v' ? (inside ? -1 : 1) : 0, oz = dir === 'h' ? (inside ? -1 : 1) : 0, yardFront = rooms.some(q => q.role === 'yard' && q.cells.some(c => c[0] === (dir === 'h' ? gx : gx - (inside ? 1 : 0)) && c[1] === (dir === 'h' ? gz - (inside ? 1 : 0) : gz)));
      svg.append(el('line', { x1: mx + ox * 13, y1: mz + oz * 13, x2: mx + ox * 3, y2: mz + oz * 3, stroke: '#d9302c', 'stroke-width': 2.4 }));
      svg.append(el('path', { d: `M${mx - ox * 3},${mz - oz * 3} l${(ox ? ox * 7 : -5)},${(oz ? oz * 7 : -5)} l${(ox ? 0 : 10)},${(oz ? 0 : 10)} z`, fill: '#d9302c' }));
      if (!yardFront) svg.append(el('text', { x: clamp(mx + ox * 30, 20, wpx - 20), y: clamp(mz + oz * 19 + 3, 9, hpx - 3), class: 'street' }, [document.createTextNode('street')])); }
    // names
    for (const r of rooms) { const [ax, az] = anchorOf(r), name = r.name || label(r.type), wp = Math.min(r.shaped ? 2 : r.w, 99) * px, fs = clamp(px * 0.42, 7.5, 11);
      const txt = name.length * fs * 0.6 <= wp - 4 ? name : (name.split(' ')[0].length * fs * 0.6 <= wp - 4 && name.split(' ').length > 1 ? name.split(' ')[0] : short(name, wp));
      if (r.role !== 'hall' || wp > 40) svg.append(el('text', { x: X(ax), y: Z(az) + (S.graph ? -fs * 0.55 : fs * 0.35), class: 'name', 'font-size': fs, opacity: r.outside ? 0.75 : 1 }, [document.createTextNode(r.role === 'hall' && txt.length > 8 ? 'hall' : txt)])); }
    // the circulation graph: a node per room, an edge per door (through the door), loops in the accent colour
    const G = el('g', { class: 'graph' }); const A = new Map(rooms.map(r => [r.id, anchorOf(r)]));
    const nodeY = (r) => Z(A.get(r.id)[1]) + (r.role === 'hall' && Math.min(r.w, r.d) * px < 30 ? 0 : px * 0.22);
    for (const r of rooms) for (const [oid, e] of Object.entries(r.links)) { if (r.id > oid && byId.get(oid)?.links[r.id]) continue; const o = byId.get(oid); if (!o || o.level !== L) continue;
      const [dir, gx, gz] = e, mx = dir === 'h' ? X(gx + 0.5) : X(gx), mz = dir === 'h' ? Z(gz) : Z(gz + 0.5), loop = !tree.has(`${r.id}|${oid}`) && !tree.has(`${oid}|${r.id}`);
      G.append(el('polyline', { points: `${X(A.get(r.id)[0])},${nodeY(r)} ${mx},${mz} ${X(A.get(o.id)[0])},${nodeY(o)}`, class: loop ? 'gedge loop' : 'gedge' })); }
    for (const r of rooms) { if (r.free && r.depth == null) continue; const ent = r.id === plan.entrance;
      G.append(el('circle', { cx: X(A.get(r.id)[0]), cy: nodeY(r), r: 6, class: ent ? 'gnode ent' : 'gnode' }));
      G.append(el('text', { x: X(A.get(r.id)[0]), y: nodeY(r) + 2.7, class: 'depth' }, [document.createTextNode(r.depth ?? '·')])); }
    svg.append(G);
    return svg;
  }
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  function card(plan, opts) {
    const fails = plan.checks.filter(c => !c.ok), c = h('div', 'card' + (fails.length ? ' fail' : ''));
    c.dataset.code = plan.code; c.dataset.seed = plan.seed; c.dataset.solver = plan.solver; c.dataset.size = `${opts.w}x${opts.d}`;
    const doors = plan.rooms.reduce((s, r) => s + Object.keys(r.links).length, 0) / 2;
    c.dataset.edges = doors; c.dataset.rooms = plan.rooms.length;
    const hd = h('div', 'hd'); hd.innerHTML = `<b>${esc(plan.label)} · ${opts.w * 5}×${opts.d * 5} ft · ${plan.storeys} ${plan.down ? 'level' : 'storey'}${plan.storeys > 1 ? 's' : ''}</b><span class="seed">${plan.solver} · ${plan.rooms.length} rooms · ${doors} doors · seed ${plan.seed}</span>`;
    c.append(hd);
    // the BFS tree from the street door (over doors on any level and stairs): what is not in it is a loop
    const byId = new Map(plan.rooms.map(r => [r.id, r])), tree = new Set(), seen = new Set(plan.entrance ? [plan.entrance] : []);
    for (const q = [...seen]; q.length;) { const id = q.shift(), r = byId.get(id); for (const n of [...Object.keys(r.links), ...plan.stairs.filter(s => s.from === id || s.to === id).map(s => s.from === id ? s.to : s.from)]) if (n && byId.has(n) && !seen.has(n)) { seen.add(n); tree.add(`${id}|${n}`); q.push(n); } }
    // one scale for every storey of the card, from the widest storey
    const boxes = new Map(); let wide = 1, n = 0;
    for (const L of plan.levels) { const rs = plan.rooms.filter(r => r.level === L); if (!rs.length) continue; const xs = rs.flatMap(r => [r.x, r.x + r.w]), zs = rs.flatMap(r => [r.z, r.z + r.d]);
      const b = { x0: Math.min(...xs, plan.rect.x), x1: Math.max(...xs, plan.rect.x + plan.rect.w), z0: Math.min(...zs, plan.rect.z), z1: Math.max(...zs, plan.rect.z + plan.rect.d) }; boxes.set(L, b); wide = Math.max(wide, b.x1 - b.x0); n++; }
    const px = clamp(Math.floor((bench.cardW - 60) / wide), 9, 30);
    const lv = h('div', 'levels'); const order = [...boxes.keys()].sort((a, b) => (a === 0 ? -9 : a) - (b === 0 ? -9 : b)); // ground first, then up, then the cellar
    for (const L of plan.down ? [...boxes.keys()].sort((a, b) => b - a) : [0, ...order.filter(x => x > 0), ...order.filter(x => x < 0)].filter(x => boxes.has(x))) {
      const d = h('div', 'level'); const t = h('div', 'lv'); const under = plan.rooms.find(r => r.level === L && r.under), host = under && byId.get(under.under);
      t.innerHTML = `<b>${lvName(L)}</b> · ${lvWhat(plan, L)}${host ? ` (under the ${esc(label(host.type).toLowerCase())}; the dashed box is the building above)` : ''}`; d.append(t, drawLevel(plan, L, boxes.get(L), px, tree)); lv.append(d); }
    c.append(lv);
    const ch = h('div', 'checks'); const ok = h('span', 'ok', `✓ ${plan.checks.length - fails.length} of ${plan.checks.length} rules`); ok.title = plan.checks.filter(x => x.ok).map(x => `✓ ${x.rule}${x.detail ? ` (${x.detail})` : ''}`).join('\n'); ch.append(ok);
    for (const f of fails) { const b = h('span', 'bad', `✗ ${f.rule}`); b.title = f.detail || f.rule; ch.append(b); }
    c.append(ch);
    if (plan.notes.length) c.append(h('div', 'notes', plan.notes.join(' · ')));
    const acts = h('div', 'acts'), p = new URLSearchParams({ build: plan.code, w: opts.w, d: opts.d, seed: plan.seed, storeys: plan.storeys, front: plan.front });
    for (const k of ['loops', 'pacing', 'carved']) if (S.dials[k] != null) p.set(k, S.dials[k]);
    if (!S.out) p.set('outbuildings', 0);
    const go = h('a', 'go', 'Open in 3D'); go.href = `${GAME}?${p}`; go.target = '_blank'; go.rel = 'noopener'; go.title = 'Opens the game and builds exactly this plan there';
    const cmd = `build ${plan.label.toLowerCase()} ${opts.w}x${opts.d} seed ${plan.seed}${plan.storeys !== B.BUILDING_TYPES[plan.code].storeys.def ? ` storeys ${plan.storeys}` : ''}`;
    const cp = h('button', '', 'Copy command'); cp.title = cmd; cp.onclick = async () => { try { await navigator.clipboard.writeText(cmd); toast(`Copied: ${cmd}`); } catch { toast(cmd); } };
    const note = document.createElement('input'); note.type = 'text'; note.placeholder = 'note on this one…';
    const sb = h('button', '', 'Send'); const info = { code: plan.code, w: opts.w, d: opts.d, seed: plan.seed, storeys: plan.storeys, front: plan.front, solver: plan.solver, dials: plan.dials, failed: fails.map(f => f.rule), cmd };
    sb.onclick = async () => { const t = note.value.trim(); if (!t) return toast('Type the note first', true); if (await send(`buildings ${plan.code} ${opts.w}x${opts.d} seed ${plan.seed}`, t, info)) note.value = ''; };
    note.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') sb.click(); });
    acts.append(go, cp, note, sb); c.append(acts);
    return c;
  }

  let raf = 0;
  function render() { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
  function draw() {
    save(); document.body.classList.toggle('nograph', !S.graph); $('#nSeeds').textContent = S.seeds;
    for (const d of document.querySelectorAll('.dial')) d._words();
    const grid = $('#grid'), sizes = SIZES.filter(s => S.sizes.has(s.join('x'))), shown = codes.filter(c => S.types.has(c));
    // big cards when he is looking at one size; the page's width decides how many across
    const big = sizes.length === 1 || shown.length === 1; bench.cardW = big ? Math.min(900, Math.max(520, innerWidth / 2 - 40)) : 430;
    grid.style.setProperty('--cardw', `${bench.cardW}px`);
    const frag = document.createDocumentFragment(); bench.plans = []; const failCount = new Map(); let bad = 0;
    for (const code of shown) {
      const BT = B.BUILDING_TYPES[code], dl = { ...BT.dials, ...Object.fromEntries(Object.entries(S.dials).filter(([, x]) => x != null)) };
      const h2 = h('h2', '', BT.label); h2.append(h('small', '', `${dl.loops <= 0.05 ? 'tree' : dl.loops < 0.35 ? `a loop or two (${dl.loops})` : `loops (${dl.loops})`} · ${dl.pacing >= 0.5 ? 'pacing' : 'function'} · ${dl.carved >= 0.5 ? 'carved' : 'packed'} · ${S.storeys || BT.storeys.def} ${BT.down ? 'level' : 'storey'}${(S.storeys || BT.storeys.def) > 1 ? 's' : ''}${S.storeys ? '' : ' by default'}${BT.storeys.why ? ` — ${BT.storeys.why}` : ''}`)); frag.append(h2);
      for (const [w, d] of sizes) {
        frag.append(h('h3', '', `${w * 5} × ${d * 5} ft  (${w} × ${d} squares)`)); const row = h('div', 'row');
        for (let i = 0; i < S.seeds; i++) {
          const seed = ((i + 1) * 7919 + w * 31 + d + S.salt * 104729) % 1000000;
          let plan; try { plan = B.generate({ code, rect: { x: 0, z: 0, w, d }, seed, front: S.front, ...(S.storeys && { storeys: S.storeys }), dials: Object.fromEntries(Object.entries(S.dials).filter(([, x]) => x != null)), types: roomsOf(code), roles: W.ROLES, outbuildings: S.out }); }
          catch (e) { const c = h('div', 'card fail'); c.append(h('div', 'checks', `CRASH seed ${seed}: ${e.message}`)); row.append(c); bad++; failCount.set('CRASH', (failCount.get('CRASH') || 0) + 1); bench.plans.push({ code, crash: e.message }); console.error(e); continue; }
          bench.plans.push(plan); const f = plan.checks.filter(c => !c.ok); if (f.length) bad++; for (const x of f) failCount.set(x.rule, (failCount.get(x.rule) || 0) + 1);
          row.append(card(plan, { w, d }));
        }
        frag.append(row);
      }
    }
    grid.replaceChildren(frag);
    const n = bench.plans.length, top = [...failCount].sort((a, b) => b[1] - a[1]).slice(0, 3);
    $('#summary').innerHTML = `<b>${n}</b> plans · <b>${n - bad}</b> keep every rule (${n ? Math.round(100 * (n - bad) / n) : 0}%)` + (top.length ? ` · <span class="bad">most broken: ${top.map(([k, c]) => `${esc(k)} ×${c}`).join('; ')}</span>` : '') + ` · <span class="muted">shift-click a type or size to see it alone and large</span>`;
    document.body.dataset.ready = '1'; bench.draws = (bench.draws || 0) + 1;
  }
  addEventListener('resize', render);
  render();
}

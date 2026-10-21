// TURN ORDER AND INITIATIVE on the client (Harry 2026-10-06; docs/PAWNS.md "Turn order and initiative"; the rules are
// core/turns.js, the same code the relay runs). This surface owns the DATA's use, the COMMANDS, the KEYS, the contextual
// buttons and their chat lines, and the mark on the table. It draws no list: the party rows of the Pawns menu are where
// an order is shown (surfaces/pawns.js reads tw.turns() and tw.turnRows(), and sends turn.order for a drag).
//
//   tw.turns()                 the area's order as this seat holds it, or null: { order, at, round, init }
//   tw.turnRows({ all })       [{ key, ids, name, kind, owner, init, bonus, current, out?, hidden? }] resolved, in order
//   registry                   turn.start · turn.end · turn.next (N) · turn.prev (Shift+N) · turn.rollMine · turn.setBonus ·
//                              turn.rollPcs · turn.rollMonsters · turn.typed · turn.here · turn.up · turn.down · turn.add ·
//                              turn.remove · turn.show
//
// WHO SEES WHAT: a player seat holds the order without the entries of pawns hidden from it (the relay sends it that way),
// and client vision further filters pawn rows locally when campaign fog is enabled.
import * as TU from '../../core/turns.js';
import { pawnKindLabel } from '../../core/pawn.js';
import { parseDice, rollDice } from '../dice.js';
import { newId } from '../../core/ids.js';

export const TURN_KEYS = { next: 'N', prev: 'Shift+N' }; // one place to change them (free before: docs/UI.md "Keys")
const OFFER_MS = 20000;
// the mark on the table: a ring round the base of every pawn whose turn it is, breathing (every number is here)
export const TURN_MARK = { color: '#ffe9a8', gap: 0.22, width: 0.36, y: 0.07, hz: 0.9, lo: 0.5, hi: 1, swell: 0.07, rim: 1.5 };

export function turnsSurface(R, app) {
  const THREE = app.THREE;
  const view = (area = app.area()) => { const v=app.view(area); return v && app.fog?.active(area) ? {...v,entities:Object.fromEntries(Object.entries(v.entities).filter(([,e])=>app.canSeePawn(e,area)))} : v || null; };
  const turns = (area) => view(area)?.turns || null;
  app.turns = turns;
  app.turnRows = (opts) => { const v = view(); return v ? TU.turnRows(v, opts) : []; };
  const seatName = (id) => app.sync.campaign?.seats.find(s => s.id === id)?.name || 'someone';
  const pawns = () => Object.values(app.entities()).filter(e => e.kind === 'token');
  const mine = () => pawns().filter(e => e.owner === app.me()).sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0) || String(a.name).localeCompare(String(b.name)));
  const keyOf = (e) => TU.keyOfPawn(turns(), e) || TU.turnKeyOf(e);
  const labelOf = (key) => { const v = view(); return v ? TU.keyLabel(v, v.turns, key) : key; };
  const signed = (n) => `${n < 0 ? '−' : '+'}${Math.abs(n)}`;
  // whose initiative a command is about. A player: the pawn she has selected if it is hers, else her main pawn, else her
  // first. The GM: the selected pawns (any).
  const targets = (ctx) => {
    const sel = ctx.sel.filter(e => e.kind === 'token');
    if (ctx.gm) return sel;
    const own = sel.filter(e => e.owner === app.me());
    return own.length ? own : mine().slice(0, 1);
  };

  // ---------------- rolling ----------------
  // The game's own dice (client/dice.js, app.roll's path): the roll is a dice.roll like any other, so it shows in the
  // chat and the announce box as rolls do; then turn.init puts the entry in its place. One roll per ENTRY: the goblins
  // roll once. An entry all of whose pawns are hidden from players gets its number with NO roll line (the line would
  // say its name to the table).
  function rollKeys(keys) {
    // A player may roll for an owned pawn even when fog hides its table position.
    // The relay has already filtered the seat's view; the display-only fog filter
    // used by turn rows must not remove that pawn from initiative resolution.
    const v = app.view(); if (!v?.turns) { app.toast('No fight has been started', true); return []; }
    const out = [];
    for (const key of [...new Set(keys)]) {
      const ps = TU.keyPawns(v, v.turns, key); if (!ps.length) continue;
      const bonus = TU.bonusOf(v, v.turns, key) || 0, expr = bonus ? `d20${bonus < 0 ? '-' : '+'}${Math.abs(bonus)}` : 'd20', p = parseDice(expr), r = rollDice(p);
      if (ps.some(e => !e.hidden)) app.dispatch('dice.roll', { id: newId('msg'), expr: p.label, rolls: r.rolls, total: r.total, why: `Initiative: ${ps.length > 1 ? pawnKindLabel(ps[0]) : ps[0].name}`.slice(0, 80) });
      out.push({ key, n: r.total, die: r.rolls[0], bonus });
    }
    if (out.length) app.batch(out.map(o => ({ type: 'turn.init', args: { key: o.key, n: o.n } })));
    app.lastInitRolls = out; // (tests)
    return out;
  }
  // "Roll initiative" for a player's pawn asks for the bonus first when none is set (Harry: "asks for the bonus first
  // if none is set, otherwise just rolls"): the bar opens on "initiative bonus " and the roll follows the answer.
  let rollAfterBonus = null;
  function rollFor(ps, { ask = true } = {}) {
    if (!turns()) { app.toast('No fight has been started', true); return false; }
    if (!ps.length) { app.toast(app.gm() ? 'Select the pawns to roll for' : 'You have no pawn in this area', true); return false; }
    const unset = ask && !app.gm() ? ps.find(e => !Number.isInteger(e.initBonus)) : null;
    if (unset) { app.select(unset.id); rollAfterBonus = unset.id; app.emit('bar.open', 'initiative bonus '); app.toast(`${unset.name}: type the initiative bonus (0 for none), then it rolls`); return 'asked'; }
    rollKeys(ps.map(keyOf));
    return true;
  }
  function setBonus(ps, bonus) {
    if (!ps.length) return;
    app.batch(ps.map(e => ({ type: 'token.set', args: { id: e.id, initBonus: bonus } })));
    app.toast(`${ps.length === 1 ? ps[0].name : `${ps.length} pawns`}: initiative bonus ${signed(bonus)}`);
    const after = rollAfterBonus; rollAfterBonus = null;
    if (after && ps.some(e => e.id === after) && turns()) rollKeys([keyOf(ps.find(e => e.id === after))]); // (the view already holds the new bonus: the roll adds it)
  }
  app.on((what) => {
    // Selection can change while the bar closes to run its chosen command.
    // Dismissal clears the pending roll after that synchronous command runs.
    if (what === 'bar.close' && rollAfterBonus) queueMicrotask(() => { if (!document.querySelector('#bar')?.classList.contains('open')) rollAfterBonus = null; });
  });
  const needsRoll = () => { const t = turns(); return !!t && !app.gm() && mine().some(e => !(keyOf(e) in t.init)); };
  const rollMine = () => { const t = turns(); return rollFor(mine().filter(e => !(keyOf(e) in (t?.init || {}))).slice(0, 1)); };
  app.rollInitiative = (ids) => rollFor(ids ? ids.map(id => app.ent(id)).filter(Boolean) : app.gm() ? app.selected().filter(e => e.kind === 'token') : mine().slice(0, 1));

  // ---------------- commands ----------------
  const gmCls = (ctx) => ctx.gm ? 'turn' : null;
  const selPawns = (ctx) => ctx.sel.filter(e => e.kind === 'token');
  R.add({ id: 'turn.start', title: (ctx) => selPawns(ctx).length > 1 ? `Start fight with the ${selPawns(ctx).length} selected pawns` : 'Start fight (turn order)', short: 'Start fight', synonyms: ['start fight', 'fight', 'combat', 'encounter', 'initiative', 'turn order', 'roll for initiative', 'begin combat'], icon: 'swords', group: 'Turns', cls: gmCls, when: () => !turns(),
    run: (ctx) => { const ps = selPawns(ctx); app.dispatch('turn.start', ps.length > 1 ? { order: [...new Set(ps.map(TU.turnKeyOf))] } : {}); app.toast('Fight started: players are offered "Roll initiative". N = next turn'); } });
  R.add({ id: 'turn.end', title: 'End fight (clear the turn order)', short: 'End fight', synonyms: ['end fight', 'end combat', 'stop fight', 'clear turn order', 'initiative', 'turn order'], icon: 'swords', group: 'Turns', cls: gmCls, when: () => !!turns(), run: () => { app.dispatch('turn.end', {}); app.toast('Fight ended (Ctrl+Z brings the order back)'); } });
  const myTurn = () => { const t = turns(), e = t?.at && app.entities()[t.at]; return !!e && e.owner === app.me(); };
  R.add({ id: 'turn.next', title: (ctx) => ctx.gm ? 'Next turn' : 'End my turn', synonyms: ['next', 'next turn', 'end turn', 'done', 'pass', 'initiative', 'turn order'], icon: 'chevron-right', keys: [TURN_KEYS.next], group: 'Turns', cls: 'turn', when: (ctx) => !!turns() && (ctx.gm || myTurn()), run: () => app.dispatch('turn.next', {}) });
  R.add({ id: 'turn.prev', title: 'Previous turn', synonyms: ['previous turn', 'back a turn', 'go back', 'turn order'], icon: 'chevron-left', keys: [TURN_KEYS.prev], group: 'Turns', cls: gmCls, when: () => !!turns(), run: () => app.dispatch('turn.prev', {}) });
  // "initiative" in the bar: the two a player needs, in Harry's words
  R.add({ id: 'turn.setBonus', title: (ctx) => ctx.gm ? 'Set initiative bonus (selected pawns)…' : 'Set your initiative bonus…', short: 'Initiative bonus', synonyms: ['initiative', 'initiative bonus', 'init bonus', 'bonus', 'dex'], icon: 'plus', group: 'Turns', cls: 'pawn', hint: 'type: initiative bonus +3',
    when: (ctx) => targets(ctx).length > 0, run: () => app.emit('bar.open', 'initiative bonus ') });
  R.add({ id: 'turn.bonusTyped', title: 'Initiative bonus', icon: 'plus', group: 'Turns', hidden: true, cls: 'pawn', when: (ctx) => targets(ctx).length > 0,
    parse: (text) => { const m = text.replace(/−/g, '-').match(/^(?:set\s+)?(?:my\s+)?init(?:iative)?\s+bonus\s*([+-]?\d{1,2})$/i); return m ? { bonus: +m[1] } : null; },
    chips: (a, ctx) => ['initiative bonus', signed(a.bonus), '→', targets(ctx).map(e => e.name).join(', ')], run: (ctx, a) => Number.isInteger(a?.bonus) ? setBonus(targets(ctx), a.bonus) : app.emit('bar.open', 'initiative bonus ') });
  R.add({ id: 'turn.rollMine', title: (ctx) => ctx.gm ? 'Roll initiative for the selected pawns' : 'Roll your initiative', short: 'Roll initiative', synonyms: ['initiative', 'roll initiative', 'roll for initiative', 'init'], icon: 'dices', group: 'Turns', cls: 'turn', hint: 'd20 + the bonus',
    when: (ctx) => targets(ctx).length > 0, enabled: () => !!turns(), run: (ctx) => rollFor(targets(ctx)) });
  // a typed number in place of a roll (dice on the table): "initiative 17"
  R.add({ id: 'turn.typed', title: 'Initiative (a number you rolled)', icon: 'dices', group: 'Turns', hidden: true, cls: 'turn', when: (ctx) => !!turns() && targets(ctx).length > 0,
    parse: (text) => { const m = text.replace(/−/g, '-').match(/^init(?:iative)?\s+(-?\d{1,3})$/i); return m ? { n: +m[1] } : null; },
    chips: (a, ctx) => ['initiative', String(a.n), 'rolled at the table', '→', [...new Set(targets(ctx).map(keyOf))].map(labelOf).join(', ')],
    run: (ctx, a) => { if (!Number.isInteger(a?.n)) return app.emit('bar.open', 'initiative '); const keys = [...new Set(targets(ctx).map(keyOf))]; app.batch(keys.map(key => ({ type: 'turn.init', args: { key, n: a.n } }))); const v = view(); for (const key of keys) if (TU.keyPawns(v, v.turns, key).some(e => !e.hidden)) app.say(`Initiative: ${labelOf(key)} ${a.n} (rolled at the table)`); } });
  // the GM's two bulk rolls. Only entries with no number yet: a player who has rolled keeps her roll.
  const unrolled = (pred) => { const v = view(), t = v?.turns; return t ? t.order.filter(k => !(k in t.init) && TU.keyPawns(v, t, k).length && pred(k, TU.keyPawns(v, t, k))) : []; };
  R.add({ id: 'turn.rollPcs', title: 'Roll initiative for all PCs (those who have not rolled)', short: 'Roll for PCs', synonyms: ['initiative', 'roll for players', 'roll for everyone', 'roll for pcs', 'roll for the party'], icon: 'dices', group: 'Turns', cls: gmCls, when: () => !!turns(),
    run: () => { const ks = unrolled((k, ps) => !k.startsWith(TU.KIND) && !!ps[0].owner); if (!ks.length) return app.toast('Every PC in the order has a number already'); rollKeys(ks); app.toast(`Rolled for ${ks.length} PC${ks.length === 1 ? '' : 's'}`); } });
  R.add({ id: 'turn.rollMonsters', title: 'Roll initiative for the monsters (once per kind)', short: 'Roll for monsters', synonyms: ['initiative', 'roll for monsters', 'roll for npcs', 'monster initiative'], icon: 'dices', group: 'Turns', cls: gmCls, when: () => !!turns(),
    run: () => { const ks = unrolled((k, ps) => k.startsWith(TU.KIND) || !ps[0].owner); if (!ks.length) return app.toast('Every monster in the order has a number already'); rollKeys(ks); app.toast(`Rolled for ${ks.length} kind${ks.length === 1 ? '' : 's'} of monster`); } });
  // the order by hand, before (and beside) the menu's drag: the selected pawn's entry
  const selKey = (ctx) => { const ps = selPawns(ctx); return ps.length && ps.length === ctx.sel.length ? keyOf(ps[0]) : null; };
  const inOrder = (ctx) => { const t = turns(), k = selKey(ctx); return !!t && !!k && t.order.includes(k); };
  const move = (ctx, d) => { const t = turns(), k = selKey(ctx), i = t.order.indexOf(k), j = i + d; if (j < 0 || j >= t.order.length) return; const o = t.order.slice(); o.splice(i, 1); o.splice(j, 0, k); app.dispatch('turn.order', { order: o }); };
  R.add({ id: 'turn.here', title: 'It is this pawn\'s turn (move the marker here)', short: 'Its turn now', synonyms: ['turn order', 'set turn', 'marker', 'whose turn'], icon: 'crosshair', group: 'Turns', cls: gmCls, when: inOrder, run: (ctx) => app.dispatch('turn.at', { key: selKey(ctx) }) });
  R.add({ id: 'turn.up', title: 'Turn order: move earlier', synonyms: ['turn order', 'move up', 'earlier', 'initiative'], icon: 'arrow-up', group: 'Turns', cls: gmCls, when: inOrder, run: (ctx) => move(ctx, -1) });
  R.add({ id: 'turn.down', title: 'Turn order: move later', synonyms: ['turn order', 'move down', 'later', 'initiative'], icon: 'arrow-down', group: 'Turns', cls: gmCls, when: inOrder, run: (ctx) => move(ctx, 1) });
  R.add({ id: 'turn.add', title: 'Add to the turn order', synonyms: ['turn order', 'join fight', 'add to fight', 'initiative'], icon: 'plus', group: 'Turns', cls: gmCls, when: (ctx) => !!selKey(ctx) && !inOrder(ctx) && selPawns(ctx).length > 0,
    run: (ctx) => { const t = turns(), ks = [...new Set(selPawns(ctx).map(keyOf))].filter(k => !t?.order.includes(k)); app.dispatch('turn.order', { order: [...(t?.order || []), ...ks] }); } });
  R.add({ id: 'turn.remove', title: 'Take out of the turn order', synonyms: ['turn order', 'leave fight', 'remove from fight', 'initiative'], icon: 'minus', group: 'Turns', cls: gmCls, when: inOrder, run: (ctx) => { const k = selKey(ctx); app.dispatch('turn.order', { order: turns().order.filter(x => x !== k) }); } });
  // the order as text (until the Pawns menu's rows show it; and for copying)
  const orderText = () => { const t = turns(); if (!t) return ''; return app.turnRows({ all: false }).map((r, i) => `${r.current ? '▶' : ' '} ${String(i + 1).padStart(2)}. ${r.name}${r.init != null ? `  ${r.init}` : '  (not rolled)'}${r.bonus != null ? `  [${signed(r.bonus)}]` : ''}${r.hidden ? '  (hidden from players)' : ''}`).join('\n'); };
  app.turnOrderText = orderText;
  R.add({ id: 'turn.show', title: 'Show the turn order', synonyms: ['turn order', 'initiative order', 'who is next', 'whose turn', 'initiative'], icon: 'users', group: 'Turns', when: () => !!turns(), run: () => app.emit('output', { title: `Turn order · round ${turns().round}${turns().at == null ? ' · gathering initiative' : ''}`, text: orderText() }) });

  // ---------------- contextual buttons and their chat lines (surfaces/condbutton.js; rare, by rule) ----------------
  // 1. "Roll initiative", for a PLAYER, when the GM starts a fight (Harry: "if one thing always comes up first it's roll
  //    for initiative"). Something she did not do herself and will want: it passes the rule. It stays while her pawn
  //    has no number, then goes down into the chat as "<GM> started a fight · [Roll initiative]".
  // 2. "End my turn", for the PLAYER whose pawn the marker is on. No chat line: when it is no longer her turn there is
  //    nothing left to do.
  queueMicrotask(() => app.actionLines?.kind('roll-init', { restorable: true, valid: (d) => d.area && d.area !== app.area() ? 'in another area' : !turns() ? 'the fight is over' : !needsRoll() ? 'already rolled' : null, run: () => { const r = rollMine(); return r === false ? 'could not roll' : undefined; } })); // (the chat surface, made after this one, owns the lines)
  const seen = new Map(); // area -> { has, at } as last looked at
  function watch(area) {
    const t = turns(area), was = seen.get(area), cb = app.condButtons;
    seen.set(area, { has: !!t, at: t?.at ?? null, round: t?.round });
    if (!cb || area !== app.area()) return;
    if (t && (!was || !was.has) && t.at == null && needsRoll()) {
      const gm = app.sync.campaign?.seats.find(s => s.role === 'gm' && s.kind === 'human');
      cb.show('roll-init', { cls: 'turnoffer', icon: 'dices', text: 'Roll initiative', dock: 'top', life: OFFER_MS, area, when: () => needsRoll(), doneText: 'Rolled',
        run: (b) => { const r = rollMine(); if (r === 'asked') { b.done = false; return 'keep'; } },
        line: { kind: 'roll-init', text: `${gm?.name || 'The GM'} started a fight`, button: 'Roll initiative', data: { area } } });
    }
    if (!t) { cb.hide('roll-init'); cb.hide('my-turn'); return; }
    const now = t.at && app.entities(area)[t.at], isMine = !!now && now.owner === app.me() && !app.gm();
    if (isMine && (!was || was.at !== t.at || was.round !== t.round)) {
      app.toast(`Your turn: ${now.name}`);
      cb.show('my-turn', { cls: 'turnoffer', icon: 'chevron-right', text: `${now.name}'s turn · End turn (${TURN_KEYS.next})`, dock: 'top', life: 0, area, when: () => myTurn(), doneText: 'Turn ended', run: () => { app.dispatch('turn.next', {}); } });
    } else if (!isMine) cb.hide('my-turn');
  }
  app.on((what, area) => { if (what === 'change' && area) watch(area); });

  // ---------------- the mark on the table ----------------
  // Usable before any menu: every pawn whose turn it is wears a pale ring round its base that breathes, and a figure's
  // own rim (the seat-colour rim the base already has) glows with it. The ring follows the pawn (a drag, a lift) and is
  // hidden with it (the cut). Reduced motion: steady.
  const marks = new Map(); // `${area}|${id}` -> { ring, layer, rim, rim0 }
  let geo = null;
  const ringFor = (size) => { geo ||= new Map(); if (!geo.has(size)) { const r = (app.assets.figures?.radiusOf?.(size) ?? 2.25 * size) + TURN_MARK.gap; geo.set(size, new THREE.RingGeometry(r, r + TURN_MARK.width, 64).rotateX(-Math.PI / 2)); } return geo.get(size); };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');
  function drop(k) { const m = marks.get(k); if (!m) return; m.layer.remove(m.ring); m.ring.material.dispose(); if (m.rim) m.rim.material.emissiveIntensity = m.rim0; marks.delete(k); }
  app.on((what) => {
    if (what !== 'frame') return;
    if (!marks.size && ![...app.worlds.keys()].some(a => app.view(a)?.turns?.at)) return; // no fight anywhere: nothing to do
    const want = new Set(), t = performance.now() / 1000, still = reduced(), wave = still ? 1 : 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * TURN_MARK.hz);
    for (const [area, w] of app.worlds) {
      const v = app.view(area); if (!v?.turns?.at) continue;
      for (const e of TU.currentPawns(v)) {
        const rec = w.recs.get(e.id); if (!rec) continue;
        const k = `${area}|${e.id}`; want.add(k);
        let m = marks.get(k);
        if (!m) {
          // (in the world's own overlay layer, with the pings and the selection marks: not a thing, so nothing that
          // lights, shadows or picks things ever meets it)
          const ring = new THREE.Mesh(ringFor(e.size > 1 ? e.size : 1), new THREE.MeshBasicMaterial({ color: TURN_MARK.color, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
          ring.renderOrder = 4; ring.userData.turnMark = true; ring.userData.halo = true; ring.raycast = () => {}; // never picked
          w.layers.deco.add(ring); m = { ring, layer: w.layers.deco }; marks.set(k, m);
        }
        const rim = rec.visual?.userData?.base?.userData?.rim || null;
        if (rim !== m.rim) { if (m.rim) m.rim.material.emissiveIntensity = m.rim0; m.rim = rim; m.rim0 = rim ? rim.material.emissiveIntensity : 0; }
        const g = rec.group;
        m.ring.position.set(g.position.x, g.position.y - (g.userData.footDrop || 0) + TURN_MARK.y, g.position.z); // round the BASE (under a raised pawn's figure) // it goes where the pawn is drawn (a drag, a lift)
        m.ring.visible = g.visible;                                                    // and is hidden with it (a level above the cut)
        m.ring.material.opacity = TURN_MARK.lo + (TURN_MARK.hi - TURN_MARK.lo) * wave;
        m.ring.scale.setScalar(1 + TURN_MARK.swell * wave);
        if (m.rim) m.rim.material.emissiveIntensity = m.rim0 + (TURN_MARK.rim - m.rim0) * wave;
      }
    }
    for (const k of [...marks.keys()]) if (!want.has(k)) drop(k);
  });
  // (tests) which pawns wear the mark in the main area now, and how bright
  app.turnMarks = () => [...marks].filter(([k]) => k.startsWith(app.area() + '|')).map(([k, m]) => ({ id: k.split('|')[1], opacity: +m.ring.material.opacity.toFixed(3), visible: m.ring.visible, rim: !!m.rim }));
  return { name: 'turns' };
}

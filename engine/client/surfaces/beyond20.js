// BEYOND20 INTAKE on the client (Harry 2026-10-29; docs/BEYOND20.md; the pure rules: core/beyond20.js). Beyond20 is a
// browser extension that reads a player's D&D Beyond sheet in THEIR browser; with this site in its "custom domains" it
// sends this page DOM events. TW only listens. Without Beyond20 nothing here does anything, and says nothing.
//
//   Loaded / NewSettings        a small "Beyond20 connected" note, once
//   RenderedRoll                the roll on the table: TW's own 3D dice, thrown from the mapped pawn and LANDING on
//                               Beyond20's numbers (app.roll { given }: every seat turns each die's numbering to them, the
//                               ordinary synced dice.roll); the line says what it was (dice.roll `info`). An initiative roll
//                               also sets that pawn's number in the turn order. One roll's throws go one after the other.
//   UpdateHP                    damage = max - current (never below 0) on the mapped pawn (token.damage)
//   UpdateConditions            the conditions, on the mapped pawn (token.set conditions): TW's words as TW's, any other word
//                               as a text label, exhaustion as "exhaustion N" (core/beyond20.js conditionsAfter)
//   UpdateCombat                ignored for now (D&D Beyond's encounter tracker; TW's turn order is the GM's)
//
// WHICH PAWN: the pawn whose sheet link is the same D&D Beyond character (core/beyond20.js sheetKey); else a pawn of this
// seat's with the character's name; else this seat's main pawn. Matched any way but the sheet, or not at all, the seat
// is offered "Link <character>'s sheet to <pawn>" (a conditional button; token.set sheet), once per character a visit.
//
// WHISPERS: a roll Beyond20 whispers (its whisper setting: on by default for monsters) never goes on the table. A player
// whispers the line to the GM; the GM keeps it (a toast). A roll for a pawn hidden from players is the GM's alone too.
//
// ATTACKS: an attack or spell attack rolled on a LINKED sheet (matched by its sheet link) is saved on the pawn by name
// (token.set attacks; core/pawn.js upsertAttack): the pawn's Attack menu (surfaces/attacks.js) lists it from then on, in
// any visit and for every seat. Beyond20 cannot be asked to roll (its SendMessage only reaches VTT tabs), so the menu
// rolls TW's own dice.
import * as B from '../../core/beyond20.js';
import * as TU from '../../core/turns.js';
import { cleanSheet, sheetProblem, pawnKind, upsertAttack } from '../../core/pawn.js';
import { newId } from '../../core/ids.js';

export const B20_EVENTS = ['Loaded', 'NewSettings', 'RenderedRoll', 'UpdateHP', 'UpdateConditions', 'UpdateCombat'];
const LINK_LIFE_MS = 20000, SETTLE_MAX_MS = 9000, ATTACKS_MAX = 12;

export function beyond20Surface(R, app) {
  const S = app.b20 = {
    connected: false, version: null, seen: { rolls: 0, hp: 0, conditions: 0, combat: 0, ignored: 0 },
    log: [], // (tests) what was done with each event: { ev, char, pawn, how, did }
    offered: new Set(), // character keys offered a link this visit
  };
  const note = (o) => { S.log.push({ at: Date.now(), ...o }); if (S.log.length > 60) S.log.shift(); };
  const me = () => app.me();
  const pawns = () => Object.values(app.entities()).filter(e => e.kind === 'token' && (app.gm() || !e.hidden));
  const mine = () => pawns().filter(e => e.owner === me() || (app.gm() && !e.owner));
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const editable = (e) => !!e && (app.gm() || e.owner === me());

  // ---------- which pawn ----------
  function pawnFor(char) {
    const ps = pawns(), sel = (list) => list.find(e => app.sel?.has(e.id)) || list.find(e => e.owner === me()) || list[0];
    const key = B.sheetKey(char.url);
    if (key) { const bySheet = ps.filter(e => e.sheet && B.sheetKey(e.sheet) === key); if (bySheet.length) return { pawn: sel(bySheet), how: 'sheet' }; }
    const own = mine(), n = norm(char.name), first = n.split(' ')[0];
    const byName = own.filter(e => norm(e.name) === n);
    if (byName.length) return { pawn: sel(byName), how: 'name' };
    const byFirst = n && first !== n ? own.filter(e => norm(e.name) === first) : [];
    if (byFirst.length) return { pawn: sel(byFirst), how: 'name' };
    if (app.gm()) { const byKind = own.filter(e => pawnKind(e) === n); if (byKind.length) return { pawn: sel(byKind), how: 'name' }; } // ("Goblin" -> the goblins)
    const main = own.find(e => e.main && e.owner === me());
    if (main) return { pawn: main, how: 'main' };
    return { pawn: null, how: null };
  }
  // the link offer: matched without the sheet (or not at all), and the character has an ordinary D&D Beyond link
  function offerLink(char, m) {
    kind();
    if (m.how === 'sheet' || !char.url || sheetProblem(cleanSheet(char.url)) || S.offered.has(char.key) || !app.condButtons) return;
    const sel = app.selected().filter(e => e.kind === 'token' && editable(e));
    const to = m.pawn && editable(m.pawn) && !B.isDdbSheet(m.pawn.sheet) ? m.pawn : !m.pawn ? (sel[0] || mine().find(e => e.owner === me()) || null) : null;
    if (!to) { if (!m.pawn) { S.offered.add(char.key); app.toast(`Beyond20: no pawn here for ${char.name}. Select yours and roll again to link its sheet`); } return; }
    S.offered.add(char.key);
    const d = { id: to.id, area: app.area(), sheet: cleanSheet(char.url), char: char.name };
    S.offer = { ...d, pawn: to.name }; // (tests)
    app.condButtons.show('b20-link', { icon: 'file-text', text: `Link ${char.name}'s sheet to ${to.name}`, anchor: [to.x, to.z, to.y || 0], life: LINK_LIFE_MS, area: d.area, data: d,
      when: () => !linked(d), doneText: 'Sheet linked',
      line: { kind: 'b20-link', text: `Beyond20: ${char.name} is not linked to a pawn`, button: `Link to ${to.name}`.slice(0, 40), group: `b20-link|${char.key}`, data: d },
      run: () => link(d) });
  }
  const linked = (d) => B.sheetKey(app.entities(d.area)?.[d.id]?.sheet) === B.sheetKey(d.sheet);
  function link(d) {
    const e = app.entities(d.area)?.[d.id]; if (!e) return 'that pawn is gone';
    app.dispatch('token.set', { id: e.id, sheet: d.sheet });
    app.toast(`${e.name} is linked to ${d.char}'s D&D Beyond sheet`);
    note({ ev: 'link', char: d.char, pawn: e.id });
    return null;
  }
  // (the chat's action lines are made by a surface installed after this one: the kind is registered once they exist)
  let kinded = false;
  const kind = () => { if (kinded || !app.actionLines) return; kinded = true; app.actionLines.kind('b20-link', { restorable: true, valid: (d) => d.area !== app.area() ? 'in another area' : !app.entities(d.area)?.[d.id] ? 'that pawn is gone' : linked(d) ? 'linked' : null, run: (d) => link(d) }); };
  setTimeout(kind, 0);

  // ---------- the events ----------
  const backlog = [];
  const isReady = () => app.ready?.() && !!app.area() && !!app.sync?.campaign;
  function connected(how) {
    if (S.connected) return;
    S.connected = true; S.how = how;
    // the note waits for the loading screen to go (Beyond20 usually reports in while the table is still being set out,
    // and a 2.6 s toast under the loading screen is never seen: Gemini on the help page's film, 2026-10-29)
    const loading = () => { const l = document.getElementById('twl'); return !!l && !l.hidden; }, t0 = Date.now();
    const say = () => { S.told = Date.now(); app.toast('Beyond20 connected: rolls from D&D Beyond come to this table'); };
    if (!loading()) say(); else { const iv = setInterval(() => { if (!loading() || Date.now() - t0 > 30000) { clearInterval(iv); setTimeout(say, 300); } }, 250); }
    app.refresh?.();
  }
  let chain = Promise.resolve(); // one event at a time: a roll's throws never overlap the next roll's
  function handle(name, detail) {
    if (!B20_EVENTS.includes(name)) return;
    const args = Array.isArray(detail) ? detail : detail != null ? [detail] : [];
    if (!isReady()) { backlog.push([name, args]); if (backlog.length > 50) backlog.shift(); return; }
    connected(name);
    if (name === 'Loaded' || name === 'NewSettings') return;
    chain = chain.then(() => run(name, args)).catch(err => console.warn('beyond20', name, err));
  }
  async function run(name, args) {
    if (name === 'RenderedRoll') return onRoll(args[0]);
    if (name === 'UpdateHP') return onHP(args);
    if (name === 'UpdateConditions') return onConditions(args);
    if (name === 'UpdateCombat') { S.seen.combat++; note({ ev: 'combat', did: 'ignored' }); }
  }

  // a roll: on the table (or whispered), one throw after another
  async function onRoll(msg) {
    const r = B.fromRendered(msg); S.seen.rolls++;
    if (!r.specs.length) { S.seen.ignored++; note({ ev: 'roll', char: r.char.name, kind: r.kind, did: 'nothing to roll' }); return; }
    const m = pawnFor(r.char); offerLink(r.char, m);
    if (r.attack) save(m.pawn, m.how, r.attack);
    const pawn = m.pawn, hideNames = r.whisper === 3, secret = r.whisper === 1 || !!pawn?.hidden;
    const who = pawn?.name || r.char.name, ids = [];
    // an attack from a pawn that has a target (surfaces/target.js) is AT that target: "Thorin attacks Goblin 1"; with
    // none it is "Thorin rolls Longsword"
    const isAttack = r.kind === 'attack' || r.kind === 'spell-attack', tgt = isAttack && pawn ? app.targetOf?.(pawn) : null;
    for (const spec of r.specs) {
      const part = spec.info.part, what = part === 'damage' ? `${r.name} damage` : part === 'healing' ? `${r.name} healing` : part === 'to-hit' ? `${r.name} to hit` : r.name;
      const said = isAttack && part === 'to-hit' ? (tgt ? `${who} attacks ${tgt.name}` : `${who} rolls ${r.name}`) : isAttack && part === 'damage' && tgt ? `${who}: ${r.name} damage on ${tgt.name}` : `${who} · ${what}`;
      const why = (hideNames ? (part === 'damage' ? 'Damage' : part === 'to-hit' ? 'Attack' : 'A roll') : said).slice(0, 80);
      const info0 = tgt && !hideNames ? B.cleanInfo({ ...spec.info, target: tgt.name }) : spec.info;
      const info = hideNames ? (({ char, name, ...rest }) => rest)(info0) : info0;
      if (secret) { whisperRoll(why, spec); ids.push(null); continue; }
      const id = newId('msg'); ids.push(id);
      await app.roll(spec.expr, why, { given: { rolls: spec.rolls, total: spec.total }, info, pawn: pawn?.id || null, id });
      await settled(id);
    }
    if (r.init != null && pawn) setInit(pawn, r.init);
    note({ ev: 'roll', char: r.char.name, kind: r.kind, pawn: pawn?.id || null, how: m.how, did: secret ? 'whispered' : 'rolled', ids, init: r.init });
  }
  // a whispered roll never reaches the table: a player whispers it to the GM, the GM keeps it
  function whisperRoll(why, spec) {
    const text = `Beyond20 (whispered): ${why}: ${spec.expr} = ${spec.total} [${spec.rolls.join(', ')}]`.slice(0, 500);
    const gm = app.sync.campaign?.seats.find(s => s.role === 'gm' && s.kind !== 'llm' && s.id !== me());
    if (!app.gm() && gm && app.whisper) app.whisper(gm.id, text); else app.toast(text);
    S.lastWhisper = text; // (tests)
  }
  // wait for a roll's dice to come to rest (never longer than SETTLE_MAX_MS: the next throw goes regardless)
  function settled(id) {
    const t0 = performance.now();
    return new Promise(res => { const tick = () => { if (!app.dice?.holding?.(id) || performance.now() - t0 > SETTLE_MAX_MS) return setTimeout(res, 150); setTimeout(tick, 120); }; setTimeout(tick, 60); });
  }
  function setInit(pawn, n) {
    const v = app.view(), t = v?.turns;
    if (!t) { app.toast(`Beyond20: ${pawn.name} rolled ${n} for initiative; no fight is running, so the turn order is unchanged`); return; }
    if (!app.gm() && pawn.owner !== me()) { app.toast(`Beyond20: ${pawn.name} is not yours: the GM sets its initiative`); return; }
    const key = app.gm() ? (TU.keyOfPawn(t, pawn) || TU.turnKeyOf(pawn)) : pawn.id;
    const k = Math.max(TU.INIT_MIN, Math.min(TU.INIT_MAX, n));
    app.dispatch('turn.init', { key, n: k });
    S.lastInit = { key, n: k }; // (tests)
  }
  // HP -> damage
  function onHP([req, name, hp, max]) {
    S.seen.hp++;
    const char = B.charOf(req?.character, name), m = pawnFor(char); offerLink(char, m);
    const dmg = B.damageFromHP(hp ?? req?.character?.hp, max ?? req?.character?.['max-hp']);
    if (!m.pawn || dmg == null) { note({ ev: 'hp', char: char.name, did: m.pawn ? 'no numbers' : 'no pawn' }); return; }
    if ((m.pawn.damage || 0) !== dmg) app.dispatch('token.damage', { id: m.pawn.id, damage: dmg });
    note({ ev: 'hp', char: char.name, pawn: m.pawn.id, how: m.how, did: `damage ${dmg}` });
  }
  function onConditions([req, name, conditions, exhaustion]) {
    S.seen.conditions++;
    const char = B.charOf(req?.character, name), m = pawnFor(char); offerLink(char, m);
    if (!m.pawn) { note({ ev: 'conditions', char: char.name, did: 'no pawn' }); return; }
    if (!editable(m.pawn)) { note({ ev: 'conditions', char: char.name, pawn: m.pawn.id, did: 'not yours' }); return; }
    const next = B.conditionsAfter(m.pawn.conditions || [], conditions ?? req?.character?.conditions, exhaustion ?? req?.character?.exhaustion); // (2026-10-29) unmatched words arrive as text labels; exhaustion as "exhaustion N"
    if (JSON.stringify(next) !== JSON.stringify(m.pawn.conditions || [])) app.dispatch('token.set', { id: m.pawn.id, conditions: next });
    note({ ev: 'conditions', char: char.name, pawn: m.pawn.id, how: m.how, did: next.join(',') || 'none' });
  }

  // ---------- a linked sheet's attacks are SAVED on the pawn (token.set attacks; surfaces/attacks.js rolls them) ----------
  // (Harry 2026-10-29: "Attack is always there and always useful": they last across visits and seats)
  function save(pawn, how, a) {
    if (!pawn || how !== 'sheet' || !editable(pawn)) return;
    const next = upsertAttack(pawn.attacks, { name: a.name, hit: a.hit, dmg: B.damageExpr(a) });
    if (JSON.stringify(next) !== JSON.stringify(pawn.attacks || [])) app.dispatch('token.set', { id: pawn.id, attacks: next });
  }
  S.linked = (e) => e?.kind === 'token' && B.isDdbSheet(e.sheet);

  // ---------- listening ----------
  // index.html's first script listens from the very start (Beyond20 can say Loaded before this module has run) and keeps
  // what came in `window.__tw_b20`; from here on it hands each event straight to `handle`.
  const early = Array.isArray(window.__tw_b20) ? window.__tw_b20.splice(0) : [];
  window.__tw_b20h = handle;
  if (!window.__tw_b20) for (const n of B20_EVENTS) document.addEventListener('Beyond20_' + n, (ev) => handle(n, ev.detail)); // (a page without the early script)
  for (const [n, d] of early) handle(n, d);
  const drain = () => { if (!backlog.length || !isReady()) return; for (const [n, a] of backlog.splice(0)) handle(n, a); };
  app.on((what) => { if (what === 'refresh' || what === 'change') drain(); });
  setInterval(drain, 1000);
  return { name: 'beyond20' };
}

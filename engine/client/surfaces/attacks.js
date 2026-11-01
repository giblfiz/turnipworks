// THE ATTACK BUTTON AND A PAWN'S SAVED ATTACKS (Harry 2026-10-29: "Attack is always there and always useful"; docs/BEYOND20.md
// "The Attack button"). On the ring of every pawn this seat acts for (its owner; the GM: any), with or without Beyond20.
//
//   the saved attacks   on the pawn: `attacks: [{ name, hit, dmg }]`, the last used first (token.set; core/pawn.js:
//                       8 at most, names and formulas only). Filled by Beyond20 (an attack rolled on the linked sheet is
//                       saved by name: surfaces/beyond20.js), by "+ Add attack" here, or by an AI seat over GET.
//   the menu            the grown ring (ring.nest): one tile per saved attack ("Longsword +5"), "+ Add attack", and
//                       "Edit attacks" when there are any. A linked pawn with none says "Roll an attack on your D&D Beyond
//                       sheet and it appears here".
//   an attack           TW's OWN dice (crypto, like any roll here: Beyond20 cannot be asked to roll on D&D Beyond): to hit
//                       at the pawn's TARGET (surfaces/target.js; with none, one click on a pawn picks it and makes it the
//                       target), then the damage: "Thorin attacks Goblin 1: d20+5 = 17", "Thorin: Longsword damage on
//                       Goblin 1: d8+3 = 7". No AC is compared: TW knows no rules.
//   the form            a small card at the button (ring.panel): name, to hit, damage; each saved attack with Edit / Remove.
import * as B from '../../core/beyond20.js';
import { cleanAttack, upsertAttack, ATTACKS_MAX, ATTACK_NAME_MAX } from '../../core/pawn.js';
import { newId } from '../../core/ids.js';

const SETTLE_MAX_MS = 9000;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function attacksSurface(R, app) {
  const me = () => app.me();
  const actsFor = (e) => e?.kind === 'token' && (app.gm() || e.owner === me());
  const saved = (e) => Array.isArray(e?.attacks) ? e.attacks : [];
  const A = app.attacks = { log: [], picking: null };
  const note = (o) => { A.log.push({ at: Date.now(), ...o }); if (A.log.length > 40) A.log.shift(); };
  const setAttacks = (e, list) => { if (JSON.stringify(list) !== JSON.stringify(saved(e))) app.dispatch('token.set', { id: e.id, attacks: list }); };

  // ---------- rolling one ----------
  function settled(id) {
    const t0 = performance.now();
    return new Promise(res => { const tick = () => { if (!app.dice?.holding?.(id) || performance.now() - t0 > SETTLE_MAX_MS) return setTimeout(res, 150); setTimeout(tick, 120); }; setTimeout(tick, 60); });
  }
  async function attack(attId, a, target) {
    const att = app.entities()[attId]; if (!att || !target) return;
    if (att.target !== target.id) app.setTarget?.(att, target); // (a target picked here IS the pawn's target from now on)
    const base = { src: 'tw', name: a.name, kind: 'attack', target: target.name };
    const hit = a.hit ? B.hitExpr(a) : null, ids = [];
    if (hit) { const id = newId('msg'); ids.push(id); await app.roll(hit, `${att.name} attacks ${target.name}`.slice(0, 80), { pawn: att.id, id, info: B.cleanInfo({ ...base, part: 'to-hit' }) }); await settled(id); }
    if (a.dmg) { const id = newId('msg'); ids.push(id); await app.roll(a.dmg, `${att.name}: ${a.name} damage on ${target.name}`.slice(0, 80), { pawn: att.id, id, info: B.cleanInfo({ ...base, part: 'damage' }) }); }
    const now = app.entities()[attId]; if (now && actsFor(now)) setAttacks(now, upsertAttack(saved(now), a)); // the last used first
    note({ ev: 'attack', pawn: attId, target: target.id, attack: a.name, ids });
  }
  // no target yet: the next pawn selected is it
  let pick = null;
  function cancelPick() { if (!pick) return false; pick = null; A.picking = null; const i = app.escapeStack.indexOf(cancelPick); if (i >= 0) app.escapeStack.splice(i, 1); return true; }
  function startPick(att, a) {
    cancelPick(); pick = { attacker: att.id, area: app.area(), a }; A.picking = { attacker: att.id, attack: a.name };
    app.escapeStack.push(cancelPick);
    app.toast(`${att.name}: ${a.name}. Click the target on the map (Esc cancels)`);
  }
  app.on((what) => {
    if (what !== 'selection' || !pick) return;
    const s = app.selected();
    if (s.length !== 1 || s[0].kind !== 'token' || s[0].id === pick.attacker) return;
    const p = pick; cancelPick();
    if (p.area === app.area()) attack(p.attacker, p.a, s[0]);
  });
  function use(att, a) { const t = app.targetOf?.(att); if (t) attack(att.id, a, t); else startPick(att, a); }

  // ---------- the menu ----------
  function tiles(att, done) {
    const list = saved(att), t = app.targetOf?.(att), out = [];
    list.forEach((a, i) => out.push({ id: `attack:${i}`, label: `${a.name}${a.hit ? ' ' + a.hit : ''}`.slice(0, 30), icon: 'swords',
      title: `${i === 0 ? 'Last used. ' : ''}${a.name}: ${[a.hit && `${B.hitExpr(a)} to hit`, a.dmg && `${a.dmg} damage`].filter(Boolean).join(', then ')} (TW's dice) ${t ? `at ${t.name}` : 'once you click the target'}`,
      run: () => { done(); use(att, a); } }));
    if (!list.length && B.isDdbSheet(att.sheet)) out.push({ id: 'attack:none', label: 'Roll an attack on your D&D Beyond sheet and it appears here', icon: 'swords', cls: 'locked', title: 'Roll an attack on your D&D Beyond sheet (with Beyond20) and it appears here, for every visit', run: () => { done(); app.toast('Roll an attack on your D&D Beyond sheet and it appears here'); } });
    if (list.length < ATTACKS_MAX) out.push({ id: 'attack:add', label: '+ Add attack', icon: 'plus', title: 'Add an attack: its name, to-hit bonus and damage dice', run: () => { done(); form(att, null); } });
    if (list.length) out.push({ id: 'attack:edit', label: 'Edit attacks', icon: 'pencil', title: 'Change or remove a saved attack', run: () => { done(); form(att, 'list'); } });
    return out;
  }
  R.add({ id: 'pawn.attack', title: 'Attack', short: 'Attack', synonyms: ['attack', 'attacks', 'beyond20', 'weapon', 'to hit', 'add attack', 'saved attacks'], icon: 'swords', group: 'Pawn', menu: true, cls: 'pawn',
    ring: { kinds: ['pawn'], slot: 14, opens: 'attack' },
    when: (ctx) => !!ctx.one && actsFor(ctx.one),
    run: (ctx) => app.emit('ring.nest', { key: 'attack', title: 'Attack', tiles: (done) => tiles(ctx.one, done) }) });

  // ---------- the form: add, edit, remove ----------
  // mode: null = a new attack; 'list' = the saved ones with Edit / Remove; a number = edit that one
  function form(att0, mode) {
    const id = att0.id, cur = () => app.entities()[id];
    let editing = mode;
    app.emit('ring.panel', { group: 'attack', title: `${att0.name}'s attacks`, cls: 'atk', fill: (el) => {
      const draw = () => {
        const e = cur(); if (!e) return;
        const list = saved(e), a = Number.isInteger(editing) ? list[editing] : null, showForm = editing === null || Number.isInteger(editing);
        el.querySelector('.atk-body')?.remove();
        const box = document.createElement('div'); box.className = 'atk-body';
        box.innerHTML = `${list.length ? `<div class="atk-list">${list.map((x, i) => `<div class="atk-row${editing === i ? ' on' : ''}" data-i="${i}"><b>${esc(x.name)}</b> <span>${esc([x.hit && `${x.hit} to hit`, x.dmg].filter(Boolean).join(' · '))}</span><button class="sh-change atk-edit" data-i="${i}" title="Change ${esc(x.name)}">Edit</button><button class="sh-change atk-del" data-i="${i}" title="Remove ${esc(x.name)}">Remove</button></div>`).join('')}</div>` : ''}
          ${showForm ? `<div class="sh-who atk-form">
            <label class="sh-row"><span>Name</span><input class="sh-name atk-name" type="text" maxlength="${ATTACK_NAME_MAX}" autocomplete="off" spellcheck="false" placeholder="Longsword" aria-label="The attack's name"></label>
            <label class="sh-row"><span>To hit</span><input class="sh-name atk-hit" type="text" maxlength="4" autocomplete="off" spellcheck="false" placeholder="+5" aria-label="To-hit bonus"></label>
            <label class="sh-row"><span>Damage</span><input class="sh-name atk-dmg" type="text" maxlength="40" autocomplete="off" spellcheck="false" placeholder="1d8+3" aria-label="Damage dice"></label>
            <div class="atk-btns"><button class="sh-save atk-save">${a ? 'Save' : 'Add'}</button>${list.length ? '<button class="sh-change atk-cancel">Done</button>' : ''}</div></div>`
            : `<div class="atk-btns">${list.length < ATTACKS_MAX ? '<button class="sh-save atk-new">+ Add attack</button>' : ''}</div>`}
          <div class="sh-err atk-err" role="alert"></div>`;
        el.append(box);
        const err = box.querySelector('.atk-err');
        if (showForm) {
          const [n, h, d] = ['.atk-name', '.atk-hit', '.atk-dmg'].map(q => box.querySelector(q));
          if (a) { n.value = a.name; h.value = a.hit || ''; d.value = a.dmg || ''; }
          const save = () => {
            const c = cleanAttack({ name: n.value, hit: h.value, dmg: d.value });
            if (!c) { err.textContent = !n.value.trim() ? 'Give it a name' : h.value.trim() && !cleanAttack({ name: 'x', hit: h.value }) ? 'To hit is a bonus like +5' : d.value.trim() && !cleanAttack({ name: 'x', dmg: d.value }) ? 'Damage is dice like 1d8+3' : 'Give it a to-hit bonus or damage dice'; return; }
            const e = cur(); if (!e) return;
            const list = saved(e).filter((x, i) => i !== editing && x.name.toLowerCase() !== (a?.name || '').toLowerCase());
            if (list.some(x => x.name.toLowerCase() === c.name.toLowerCase())) { err.textContent = `There is already an attack called ${c.name}`; return; }
            const next = Number.isInteger(editing) ? saved(e).map((x, i) => i === editing ? c : x) : [...saved(e), c].slice(0, ATTACKS_MAX);
            setAttacks(e, next); note({ ev: Number.isInteger(editing) ? 'edit' : 'add', pawn: id, attack: c.name });
            editing = 'list'; setTimeout(draw, 0);
          };
          for (const i of [n, h, d]) i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); save(); } });
          box.querySelector('.atk-save').onclick = (ev) => { ev.stopPropagation(); save(); };
          const c = box.querySelector('.atk-cancel'); if (c) c.onclick = (ev) => { ev.stopPropagation(); editing = 'list'; draw(); };
          setTimeout(() => (a ? h : n).focus(), 0);
        } else box.querySelector('.atk-new')?.addEventListener('click', (ev) => { ev.stopPropagation(); editing = null; draw(); });
        for (const b of box.querySelectorAll('.atk-edit')) b.onclick = (ev) => { ev.stopPropagation(); editing = +b.dataset.i; draw(); };
        for (const b of box.querySelectorAll('.atk-del')) b.onclick = (ev) => { ev.stopPropagation(); const e = cur(); if (!e) return; const x = saved(e)[+b.dataset.i]; setAttacks(e, saved(e).filter((_, i) => i !== +b.dataset.i)); note({ ev: 'remove', pawn: id, attack: x?.name }); editing = 'list'; setTimeout(draw, 0); };
      };
      draw();
    } });
  }
  A.form = (e, mode = null) => form(e, mode); // (tests)
  return { name: 'attacks' };
}

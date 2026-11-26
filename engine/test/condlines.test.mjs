// EVERY CONDITIONAL BUTTON WITH A LIFE GOES DOWN INTO THE CHAT (condbutton.js rule 6; Harry 2026-11-13: "previously all
// of our contextual buttons had the UI pattern where, if they weren't clicked, they would get moved into the chat log ...
// any sane implementation would have that as a shared sub-function that always behaves the same").
// 1. the helper itself: a button shown WITHOUT a `line` still gets one when its time is up, and pressing that line asks
//    the button's `when` and runs its `run`; `line: false` opts out.
// 2. the sources: no call opts out (`line: false`) without saying why on the same line (`// no chat line: <why>`).
//   node engine/test/condlines.test.mjs
import fs from 'node:fs';
import path from 'node:path';
let pass = 0, fail = 0;
const check = (ok, name, detail = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

// ---- a tiny DOM, just enough for createConditionalButtons ----
class El {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.style = {}; this.dataset = {}; this.hidden = false; this.innerHTML = ''; this.className = '';
    const cls = new Set(); this.classList = { add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)), toggle: (c, on) => on ? cls.add(c) : cls.delete(c), contains: (c) => cls.has(c) }; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  append(c) { this.children.push(c); c.parent = this; } remove() { this.removed = true; }
  get offsetWidth() { return 0; } getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; }
  animate() { return { finished: Promise.resolve() }; }
  click() { for (const f of this.listeners.click || []) f({ stopPropagation() {} }); }
}
let now = 1000;
globalThis.performance = { now: () => now };
globalThis.matchMedia = () => ({ matches: false });
globalThis.document = { createElement: (t) => new El(t), getElementById: () => null, documentElement: { classList: { contains: () => false } } };
globalThis.innerWidth = 1400; globalThis.innerHeight = 900;
const { createConditionalButtons } = await import('../client/surfaces/condbutton.js');

const kinds = new Map(), lines = [];
const app = {
  area: () => 'a1', screenOf: () => ({ x: 100, y: 100 }),
  actionLines: {
    kind: (n, d) => kinds.set(n, d),
    add: (spec) => { const l = { id: `l${lines.length}`, ...spec }; lines.push(l); return l; },
    reveal() {}, buttonEl: () => null,
    press: (id) => { const l = lines.find(x => x.id === id), K = kinds.get(l.kind); const why = K.valid?.(l.data || {}, l); if (why) return why; return K.run(l.data || {}, l) ?? 'ran'; },
  },
};
const cb = createConditionalButtons(app, new El('div'));

let ran = 0, holds = true;
cb.show('bare', { icon: 'x', text: 'Take it underground', lineText: 'Cave: on the ground', dock: 'top', life: 5000, area: 'a1', when: () => holds, run: () => { ran++; } });
now += 5001; cb.frame(); await Promise.resolve(); await Promise.resolve();
const l = lines.find(x => x.text === 'Cave: on the ground');
check(!!l && l.button === 'Take it underground' && l.kind === 'offer' && !cb.has('bare'), 'a button with a life and NO line of its own still goes down into the chat when its time is up', JSON.stringify(l));
check(l && app.actionLines.press(l.id) === 'ran' && ran === 1, 'pressing that line runs the button\'s own run', `ran ${ran}`);
holds = false;
check(l && app.actionLines.press(l.id) === 'no longer applies' && ran === 1, 'its condition ended (when() false): the line refuses, nothing runs', '');

let ran2 = 0;
cb.show('keep', { text: 'Re-roll', dock: 'top', life: 100, area: 'a1', run: () => { ran2++; return 'keep'; } });
now += 101; cb.frame();
const l2 = lines.find(x => x.button === 'Re-roll');
check(l2 && app.actionLines.press(l2.id) === 'ran' && ran2 === 1, "a run that says 'keep' (stay up on the table) is not taken as a refusal in the chat", '');

const n0 = lines.length;
cb.show('optout', { text: 'Nope', dock: 'top', life: 100, area: 'a1', line: false, run: () => {} });
now += 101; cb.frame();
check(lines.length === n0, '`line: false` opts out: it fades, no line', '');
cb.show('nolife', { text: 'Your turn', dock: 'top', life: 0, area: 'a1', run: () => {} });
check(cb.get('nolife')?.spec.line === undefined, 'a button without a life (it stays until its condition ends) gets no line', '');
let r3 = 0;
cb.show('same', { text: 'Old offer', dock: 'top', life: 9000, area: 'a1', run: () => { r3++; } });
cb.show('same', { text: 'New offer', dock: 'top', life: 9000, area: 'a1', run: () => {} });
check(lines.some(x => x.button === 'Old offer'), 'a newer offer under the same key sends the older one down into the chat', '');

// ---- the sources: no silent opt-outs ----
const root = new URL('../client/', import.meta.url).pathname, bad = [];
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (!['vendor', 'data', 'site', 'phone', 'node_modules'].includes(f.name)) walk(p); } else if (f.name.endsWith('.js')) { fs.readFileSync(p, 'utf8').split('\n').forEach((ln, i) => { if (!/^\s*\/\//.test(ln) && /\bline:\s*false\b/.test(ln) && !/no chat line:/.test(ln)) bad.push(`${path.relative(root, p)}:${i + 1}`); }); } } };
walk(root);
check(!bad.length, 'no conditional button opts out of the chat (`line: false`) without "// no chat line: <why>" beside it', bad.join(', '));

console.log(`\ncondlines: ${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);

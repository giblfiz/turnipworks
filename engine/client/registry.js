// The command registry: ONE source of truth for every front end. A command is data:
//   id        stable id ('edit.undo')                    title, synonyms   what the bar matches
//   icon      a Lucide icon name                         group             where it sits in menus ('Edit', 'Room ▸ Walls')
//   keys      default keys, e.g. ['Mod+Z'] (Mod = Cmd on Mac, Ctrl elsewhere)
//   (chords)  not set here: the Space chord tree is the ☰ menu's own tree, from ONE table (client/menu.js)
//   cls       permission class (core/perms.js), or (ctx) => class; results the seat can't use never appear
//   when      (ctx) => bool: does it apply to this selection / mode
//   enabled   (ctx) => bool: false = shown but greyed (visible stubs)
//   ring      { kinds, slot } for the selection ring's fixed clock positions; menu: true = in the ☰ radial tree
//   args      chip descriptions for the bar; parse(text, ctx) -> args | null lets a command claim typed text
//   run       (ctx, args) => void   — always ends in app.dispatch (the one door) or a local view action
//
// SURFACES read the registry; they never define commands. Today: command bar, selection ring + ☰ radial, hotkeys +
// chords, "?" shortcut sheet, roster, chat, breadcrumb. Harry's alternate menu/hotkey system will be another surface
// running at the same time: it can claim its own key layer through `keymap(layer)` without touching these.
export function createRegistry(app) {
  const cmds = new Map();
  const surfaces = [];
  const used = new Map(); // id -> { n, last } (frequency and recency for ranking; per browser)
  try { for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem('tw.cmdUse') || '{}'))) used.set(k, v); } catch { }

  const reg = {
    add(def) {
      const c = { synonyms: [], keys: [], group: 'General', icon: 'box', when: () => true, enabled: () => true, cls: null, section: 'commands', layer: 'default', ...def };
      // TOGGLES (Harry 2026-10-04): a toggle shows the action it will perform NOW, label and icon both: pinned → Unpin,
      // hidden → Reveal, open → Close, locked → Unlock, lit → Put out. A mixed selection shows the action that makes
      // them uniform ("Pin all"). Every surface reads the same title/icon, and both wordings are searchable in the bar.
      //   toggle: { of(ctx) → things, is(e) → bool, on: [title, icon] (shown when ALL are on), off: [title, icon], mix?: title }
      if (c.toggle) {
        const t = c.toggle;
        const st = (ctx) => { const xs = t.of(ctx) || []; const n = xs.filter(t.is).length; return xs.length && n === xs.length ? 'on' : n === 0 ? 'off' : 'mixed'; };
        c.toggleState = st;
        c.title = (ctx) => { const s = st(ctx); return s === 'on' ? t.on[0] : s === 'off' ? t.off[0] : (t.mix || `${t.off[0]} all`); };
        c.icon = (ctx) => st(ctx) === 'on' ? t.on[1] : t.off[1];
        c.synonyms = [...new Set([...c.synonyms, t.on[0], t.off[0], t.mix || `${t.off[0]} all`])];
      }
      if (cmds.has(c.id)) throw new Error(`duplicate command ${c.id}`);
      cmds.set(c.id, c);
      return c;
    },
    get: (id) => cmds.get(id),
    all: () => [...cmds.values()],
    // the context every predicate sees
    ctx() {
      const sel = app.selected();
      const kinds = new Set(sel.map(e => kindOf(app, e)));
      return { app, sel, kinds, one: sel.length === 1 ? sel[0] : null, gm: app.gm(), me: app.me(), mode: app.mode?.kind || null, kind: kinds.size === 1 ? [...kinds][0] : (kinds.size ? 'mixed' : null) };
    },
    permitted(c, ctx) { if (!c.cls) return true; const cls = typeof c.cls === 'function' ? c.cls(ctx) : c.cls; return cls === true || (cls && app.can(cls)); },
    available(ctx = reg.ctx()) { return reg.all().filter(c => reg.permitted(c, ctx) && safe(() => c.when(ctx))); },
    isEnabled: (c, ctx) => safe(() => c.enabled(ctx)),
    run(id, args, ctx = reg.ctx()) {
      const c = typeof id === 'string' ? cmds.get(id) : id;
      if (!c || !reg.permitted(c, ctx) || !safe(() => c.when(ctx)) || !safe(() => c.enabled(ctx))) return false;
      const u = used.get(c.id) || { n: 0, last: 0 }; u.n++; u.last = Date.now(); used.set(c.id, u);
      try { localStorage.setItem('tw.cmdUse', JSON.stringify(Object.fromEntries(used))); } catch { }
      app.emit('command', c.id);
      c.run(ctx, args);
      return true;
    },
    usage: (id) => used.get(id) || { n: 0, last: 0 },
    iconOf: (c, ctx = reg.ctx()) => typeof c.icon === 'function' ? safeVal(() => c.icon(ctx), 'box') : c.icon,
    titleOf: (c, ctx = reg.ctx()) => typeof c.title === 'function' ? safeVal(() => c.title(ctx), c.id) : c.title,
    // key -> commands, for one key layer (the default layer is the standard one; another front end can add its own)
    keymap(layer = 'default') {
      const m = new Map();
      for (const c of cmds.values()) if (c.layer === layer || layer === 'all') for (const k of c.keys) { const n = normKey(k); if (!m.has(n)) m.set(n, []); m.get(n).push(c); }
      return m;
    },
    // every option for a selection, flat (the ring's expanded circle: one level, no sub-menus)
    flat(ctx = reg.ctx()) { const out = []; const walk = (n) => { for (const c of n.children || []) c.children ? walk(c) : out.push(c); }; walk({ children: reg.tree(ctx).children || [] }); return out; },
    // the ☰ tree for a selection: groups from `group` ('Room ▸ Walls'), leaves the commands that apply
    tree(ctx = reg.ctx()) {
      const root = { label: '', children: [] };
      for (const c of reg.available(ctx).filter(c => c.menu)) {
        let node = root;
        for (const g of String(c.group).split(' ▸ ')) {
          let next = node.children.find(n => n.label === g && n.children);
          if (!next) { next = { label: g, children: [], icon: c.groupIcon }; node.children.push(next); }
          node = next;
        }
        node.children.push({ label: typeof c.title === 'function' ? c.title(ctx) : c.title, cmd: c, enabled: reg.isEnabled(c, ctx), keys: c.keys, chord: c.chord, icon: typeof c.icon === 'function' ? c.icon(ctx) : c.icon });
      }
      return root.children.length === 1 && root.children[0].children ? root.children[0] : root;
    },
    use(surface) { const s = surface(reg, app); if (s) surfaces.push(s); return s; },
    surfaces,
  };
  return reg;
}

export function kindOf(app, e) {
  if (e.kind === 'object') return app.assets.openable(e.cat) ? 'openable' : 'prop';
  if (e.kind === 'token') return 'pawn';
  return e.kind; // room, building, wall
}
function safe(fn) { try { return !!fn(); } catch { return false; } }
function safeVal(fn, d) { try { return fn(); } catch { return d; } }

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
// "Mod+Shift+Z" -> canonical "mod+shift+z"; from an event the same way
export function normKey(k) {
  const parts = k.split('+').map(p => p.trim().toLowerCase());
  const key = parts.pop();
  const mods = ['mod', 'ctrl', 'alt', 'shift'].filter(m => parts.includes(m));
  return [...mods, key === 'esc' ? 'escape' : key === 'del' ? 'delete' : key].join('+');
}
export function eventKey(ev) {
  const mods = [];
  if (IS_MAC ? ev.metaKey : ev.ctrlKey) mods.push('mod');
  if (IS_MAC && ev.ctrlKey) mods.push('ctrl');
  if (ev.altKey) mods.push('alt');
  let key = ev.key.toLowerCase();
  if (key === ' ') key = 'space';
  if (ev.shiftKey && !(key.length === 1 && !/[a-z0-9]/.test(key))) mods.push('shift'); // "?" is shift+/ on most layouts: keep "?" itself
  return [...mods, key].join('+');
}
export function keyLabel(k) {
  return k.split('+').map(p => ({ Mod: IS_MAC ? '⌘' : 'Ctrl', Shift: '⇧', Alt: IS_MAC ? '⌥' : 'Alt', Ctrl: 'Ctrl', Delete: 'Del', Backspace: '⌫', Escape: 'Esc', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Enter: '↵' }[p] || p.toUpperCase())).join(IS_MAC ? '' : '+');
}

// THE GET API GAP AUDIT (2026-10-20; rerun it whenever the command registry grows: see README.md "Redo this").
//   node experiments/2026-10-20-llm-api/audit.mjs            the table, as markdown, on stdout
//   node experiments/2026-10-20-llm-api/audit.mjs --json     the same rows as JSON
// For every command in the core registry (engine/core/commands.js REGISTRY, internal ones left out) and the GET-only
// verbs, against a throwaway relay with the real room engine:
//   class / who   its permission class, and who may send it (tried: the GM's AI seat and a player's AI seat)
//   GET           what the GM's AI seat got when it sent the fixture below through /do (ok, or the refusal)
//   card          is it named in the GM AI seat's rules card, or a help page the card links to (/help/...)
//   read          did the AI seat's own reads (state, and scene / room where they exist) change when it ran
// A command with no fixture is listed as "no fixture" (write one below when you add a command).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.join(HERE, '..', '..', 'engine');
const { startRelay } = await import(path.join(ENGINE, 'relay/server.js'));
const { REGISTRY } = await import(path.join(ENGINE, 'core/commands.js'));
const lib = JSON.parse(fs.readFileSync(path.join(ENGINE, 'tuner-data/library.json'), 'utf8'));

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-audit-'));
const relay = await startRelay({ port: 0, dataDir, log: () => {} });
const base = `http://127.0.0.1:${relay.port}`;
const get = (p) => fetch(base + p).then(async r => ({ status: r.status, body: (r.headers.get('content-type') || '').includes('json') ? await r.json() : await r.text() }));
const C = await fetch(base + '/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Audit', gm: 'Harry' }) }).then(r => r.json());
const cp = `/c/${C.campaign}`, A = C.area;
const q = (o) => new URLSearchParams(Object.entries(o).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])).toString();
const mk = async (tok, args) => (await get(`${cp}/do?cmd=seat.create&${q(args)}&seat=${tok}`)).body;
const gmAi = await mk(C.token, { kind: 'llm', name: 'Helper', scope: { areas: '*', classes: '*' } });
const pl = await mk(C.token, { kind: 'human', role: 'player', name: 'Brakka' });
const PLAYER_CLASSES = ['token.move', 'pawn', 'open', 'chat', 'turn', 'template', 'undo', 'travel'];
const plAi = await mk(pl.token, { kind: 'llm', name: 'Advisor', scope: { areas: '*', classes: PLAYER_CLASSES } });
const G = gmAi.token, P = plAi.token;
let n = 0;
const act = async (tok, cmd, args = {}, area = A) => (await get(`${area ? `${cp}/a/${area}` : cp}/do?cmd=${cmd}&${q(args)}&nonce=au${++n}&seat=${tok}`)).body;

// ---- the scene: a common room, a cellar below it, a goblin, a player's pawn, a template, a second area ----
const R1 = (await act(G, 'room.spawn', { type: 'common', x: 0, z: 0, w: 30, d: 25, seed: 4 })).id;
const R2 = (await act(G, 'room.spawn', { type: 'kitchen', x: 30, z: 0, w: 20, d: 25, seed: 5 })).id;
const st0 = (await get(`${cp}/a/${A}/state?seat=${G}`)).body;
const E0 = relay.campaigns.get(C.campaign).state.areas[A].entities;
const objs = Object.values(E0).filter(e => e.kind === 'object');
const LIGHT = objs.find(o => /candle|lantern|lamp|torch|fireplace|hearth|chandelier|brazier/.test(o.cat || ''))?.id;
const OPEN = objs.find(o => lib.objects[o.cat]?.aff?.includes('open'))?.id || (await act(G, 'object.place', { cat: 'chest-plain', name: 'chest plain', x: 25, z: 20 })).id;
const PROP = objs.find(o => o.id !== LIGHT && o.id !== OPEN && o.place === 'floor' && !o.flat)?.id;
const GOB = (await act(G, 'token.create', { fig: 'foe-goblin-club', x: 12.5, z: 12.5 })).id;
const PC = (await act(G, 'token.create', { name: 'Brakka', x: 7.5, z: 7.5, owner: pl.id })).id;
const BLD = st0.buildings?.[0]?.id;
const A2 = (await get(`${cp}/do?cmd=area.create&name=Cave&nonce=au-area2&seat=${C.token}`)).body.id || Object.keys(relay.campaigns.get(C.campaign).state.areas).find(a => a !== A);

// ---- one fixture per command: [args, area?] (area null = a campaign command); 'skip: why' when GET cannot carry it ----
const F = {
  'fog.explore': 'skip: the browser sends the cells its pawns see (a raster); an AI seat has no eyes to explore with',
  'fog.reveal': 'skip: the browser sends a raster of explored cells (the GM\'s "Reveal explored here")',
  'fog.reset': [{ area: A }, null],
  'token.create': [{ name: 'Orc', x: 17.5, z: 7.5 }],
  'token.move': [{ id: GOB, x: 17.5, z: 12.5 }],
  'token.set': [{ id: GOB, conditions: ['prone'], darkvision: 60 }],
  'token.damage': [{ id: GOB, damage: 4 }],
  'token.mark': [{ id: GOB, mark: 'skull' }],
  'token.owner': [{ id: GOB, owner: pl.id }],
  'token.delete': [{ id: 'tok_none' }, A, async (c) => { c.args.id = (await act(G, 'token.create', { name: 'Rat', x: 2.5, z: 22.5 })).id; }],
  'template.place': [{ id: 'tpl_audit00001', shape: 'circle', x: 10, z: 10, size: 20 }],
  'template.set': [{ id: 'tpl_audit00001', size: 15 }],
  'template.delete': [{ id: 'tpl_audit00001' }],
  'template.clear': [{}, A, async () => act(G, 'template.place', { id: 'tpl_audit00002', shape: 'circle', x: 5, z: 5, size: 10 })],
  'turn.start': [{}],
  'turn.roll': [{ id: GOB }],
  'turn.init': [{ key: GOB, n: 12 }],
  'turn.order': [{ order: [PC, GOB] }],
  'turn.at': [{ key: PC }],
  'turn.next': [{}],
  'turn.prev': [{}],
  'turn.end': [{}],
  'object.place': [{ cat: 'candlestick', name: 'candlestick', x: 22, z: 4, y: 3 }],
  'object.move': [{ id: PROP, x: 3, z: 20 }],
  'object.set': [{ id: PROP, tiltZ: 1.5708 }],
  'object.open': OPEN ? [{ id: OPEN, open: true }] : 'skip: no openable thing in the fixture room',
  'object.light': LIGHT ? [{ id: LIGHT, lit: false }] : 'skip: no light in the fixture room',
  'object.replace': [{ id: PROP, cat: lib.objects[E0[PROP]?.cat] ? E0[PROP].cat : 'barrel' }],
  'stair.flip': 'skip: needs a stair (see the storeys tests)',
  'object.delete': [{ id: PROP }],
  'entity.flag': [{ ids: R2, hidden: true }],
  'water.set': [{ id: 'wat_audit00001', body: { kind: 'pond', pts: [[60, 60], [70, 60], [70, 70], [60, 70]] } }],
  'water.remove': [{ id: 'wat_audit00001' }],
  'room.spawn': [{ type: 'temple-nave', x: 0, z: 40, w: 30, d: 30, seed: 9 }],
  'room.reroll': [{ id: R2, type: 'storeroom' }],
  'room.tall': [{ id: R1, tall: 2 }],
  'room.set': [{ id: R1, name: 'The Gilded Goose', fog: 2 }],
  'room.delete': [{ id: R2 }, A, async () => act(G, 'entity.flag', { ids: R2, hidden: false })],
  'room.move': [{ id: R1, dx: 0, dz: 5 }],
  'room.rotate': [{ id: R1, turns: 1 }],
  'edge.set': [{ key: 'h:2:0', as: 'open' }],
  'edge.reset': [{ key: 'h:2:0' }],
  'building.set': BLD ? [{ id: BLD, name: 'The Inn', roof: 'slate' }] : 'skip: no building',
  'faction.set': [{ id: R1, flavor: 'sun' }],
  'batch': [{ ops: [{ type: 'token.move', args: { id: GOB, x: 22.5, z: 12.5 } }] }],
  'chat.say': [{ text: 'Hello' }, A, async () => get(`${cp}/a/${A}/do?cmd=chat.say&text=${encodeURIComponent('(a person speaks)')}&nonce=hu${++n}&seat=${C.token}`)],
  'dice.roll': [{ expr: 'd20', why: 'Perception' }, A, async () => get(`${cp}/a/${A}/do?cmd=chat.say&text=${encodeURIComponent('(a person speaks)')}&nonce=hu${++n}&seat=${C.token}`)],
  'undo': [{}],
  'redo': [{}],
  'area.create': [{ name: 'Tower' }, null],
  'area.visibility': [{ area: A2, visibility: 'open' }, null],
  'area.set': [{ area: A, settings: { darkness: true } }, null],
  'area.delete': 'skip: would delete the fixture area (tested in areas.test.mjs)',
  'campaign.set': [{ defaults: { travelLocked: true } }, null],
  'seat.create': 'skip: agents never make seats (AGENTS_NEVER); a human does',
  'seat.revoke': 'skip: agents never revoke seats (AGENTS_NEVER)',
  'seat.locate': 'skip: agents never move people (AGENTS_NEVER)',
  'seat.set': 'skip: agents never rename seats (AGENTS_NEVER)',
  'request.create': 'skip: agents never file requests (AGENTS_NEVER)',
  'request.resolve': 'skip: needs a request (a person files it)',
  'transfer': [{ id: 'tok_none', from: A, to: A2 }, null, async (c) => { c.args.id = (await act(G, 'token.create', { name: 'Crate', x: 2.5, z: 2.5 })).id; }],
  'travel': [{ id: GOB, from: A, to: A2 }, null],
  'token.lend': [{ id: PC, to: '' }], // (a loan is its owner's: the GM's agent is refused, the player's agent may)
  'pawn.define': [{ id: 'pdef_audit0001', name: 'Familiar' }, null],
  'pawn.bring': 'skip: needs a player\'s pawn definition (a person defines it)',
  'pawn.bench': 'skip: needs a brought pawn',
  'pawn.forget': [{ id: 'pdef_audit0001' }, null],
  'cast.save': [{ id: 'cast_audit0001', name: 'Goblin boss', fig: 'foe-goblin-boss' }, null],
  'cast.use': [{ id: 'cast_audit0001' }, null],
  'cast.forget': [{ id: 'cast_audit0001' }, null],
  'party.set': [{ notes: 'We owe the miller 5 gp' }, null],
  'entities.set': 'skip: the undo machinery (quiet)',
};
// ---- what the seat reads: state (and the newer views when the relay has them) ----
const NOISE = new Set(['seq', 'cseq', 'r', 'online', 'lastSeen', 'secondsAgo', 'at', 'you']);
async function reads(tok, area) {
  const out = {};
  for (const v of ['state', 'scene', `room/${R1}`]) { const r = await get(`${cp}/a/${area}/${v}?seat=${tok}`); if (r.status === 200 && typeof r.body === 'object') { const { area: ar, ...rest } = r.body; out[v] = { ...rest, ...(ar && { area: { ...ar, seq: 0 } }) }; delete out[v].seq; } }
  out.campaign = (await get(`${cp}/state?seat=${tok}`)).body;
  return JSON.stringify(out, (k, v) => NOISE.has(k) ? undefined : v); // (sequence numbers and liveness change on every command)
}
async function docs(tok) {
  const card = (await get(`${cp}/card?seat=${tok}`)).body;
  const index = /\/help\//.test(String(card)) ? String((await get(`${cp}/help?seat=${tok}`)).body) : '';
  const links = [...new Set([...(String(card) + index).matchAll(/\/help\/([\w.-]+)\?/g)].map(m => m[1]))].filter(t => t !== 'TOPIC');
  let all = String(card);
  for (const t of links) all += '\n' + (await get(`${cp}/help/${t}?seat=${tok}`)).body;
  return { card: String(card), all, pages: links.length };
}
const before = { G: await docs(G), P: await docs(P) };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const named = (text, type) => new RegExp(`(^|[^\\w.])${esc(type)}(?![\\w.])`).test(text);
const rows = [];
// (in the registry's order, except that the fight is rolled for, stepped through and only then ended)
const types = Object.values(REGISTRY).filter(d => !d.internal).map(d => d.type).filter(t => t !== 'turn.end');
types.splice(types.indexOf('turn.init'), 0, 'turn.roll'); types.splice(types.indexOf('turn.prev') + 1, 0, 'turn.end');
for (const type of types) {
  const d = REGISTRY[type], f = F[type];
  const row = { type, level: d?.level || 'area', cls: d ? (typeof d.cls === 'string' ? d.cls : d.cls ? 'by args' : 'per op') : 'turn', card: named(before.G.all, type), cardP: named(before.P.all, type), inCard: named(before.G.card, type) };
  if (!f) { row.get = 'no fixture'; rows.push(row); continue; }
  if (typeof f === 'string') { row.get = f; rows.push(row); continue; }
  const c = { args: { ...f[0] } }; const area = f.length > 1 ? f[1] : A;
  if (f[2]) await f[2](c);
  // the GM's agent (its reads before and after), then the player's agent on the same args (a success is undone)
  const r0 = await reads(G, area || A);
  const r = await act(G, type, c.args, area);
  row.get = r.ok ? 'ok' : `REFUSED: ${String(r.why || r.code).slice(0, 90)}`;
  row.read = r.ok ? (await reads(G, area || A)) !== r0 ? 'yes' : 'NO' : '-';
  if (f[2] && /say|roll/.test(type)) await f[2](c);
  const pr = await act(P, type, c.args, area);
  if (pr.ok && type !== 'undo') await act(P, 'undo', {}, area === null ? A : area);
  row.player = pr.ok ? 'yes' : pr.code === 'forbidden' ? 'no' : `no (${String(pr.why || pr.code).slice(0, 60)})`;
  rows.push(row);
}
await relay.close(); fs.rmSync(dataDir, { recursive: true, force: true });
if (process.argv.includes('--json')) { console.log(JSON.stringify({ card: { gm: before.G.card.length, player: before.P.card.length, gmAll: before.G.all.length, pages: before.G.pages }, rows }, null, 1)); process.exit(0); }
const words = (s) => s.split(/\s+/).filter(Boolean).length;
console.log(`Rules card (GM's AI seat, every class): ${before.G.card.length} characters, ${words(before.G.card)} words; with its ${before.G.pages} help pages ${before.G.all.length} characters.`);
console.log(`Rules card (a player's AI seat): ${before.P.card.length} characters, ${words(before.P.card)} words.\n`);
console.log('| command | level | class | player\'s AI | GET (GM\'s AI) | explained (card / help) | AI read shows it |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.type} | ${r.level} | ${r.cls} | ${r.player || '-'} | ${r.get} | ${r.card ? (r.inCard ? 'card' : 'help') : 'NO'} | ${r.read || '-'} |`);
const okN = rows.filter(r => r.get === 'ok').length, docN = rows.filter(r => r.card).length, readN = rows.filter(r => r.read === 'yes').length;
console.log(`\n${rows.length} commands: ${okN} work over GET with the fixture, ${docN} explained, ${readN} visible in the AI's reads (of ${rows.filter(r => r.read && r.read !== '-').length} that ran).`);
process.exit(0);

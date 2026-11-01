// CONDITIONS (2026-10-29; core/conditions.js, docs/PAWNS.md "Conditions on the table"): the words, the shape rule, the
// looks, Beyond20's mapping with text labels, a real relay over the socket and over GET (an AI seat), and old journals.
//   node engine/test/conditions.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import * as CO from '../core/conditions.js';
import * as B from '../core/beyond20.js';
import { CONDITIONS } from '../core/pawn.js';
import { startRelay } from '../relay/server.js';
import { ClientSync } from '../core/client-sync.js';
import { wsTransport } from '../core/transport.js';
import { corpusDir } from './corpus.mjs';

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra === undefined ? '' : JSON.stringify(extra)); } else if (process.env.V) console.log('ok', m); };
const J = JSON.stringify;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { } await sleep(20); } return false; }

// ---- 1. one word, cleaned ----
ok(CO.normCondition('Prone') === 'prone' && CO.normCondition('  PARALYSED ') === 'paralyzed' && CO.normCondition('Concentration') === 'concentrating', 'TW\'s words (and their spellings) become TW\'s word');
ok(CO.normCondition('Exhaustion') === 'exhaustion 1' && CO.normCondition('exhaustion 2') === 'exhaustion 2' && CO.normCondition('Exhaustion level 4') === 'exhaustion 4' && CO.normCondition('exhausted: 9') === 'exhaustion 6' && CO.normCondition('exhaustion 0') === '', 'exhaustion becomes "exhaustion N" (1 to 6; 0 is none)');
ok(CO.normCondition('Hexed') === 'Hexed' && CO.normCondition('Hexed   by  the hag') === 'Hexed by the hag', 'a word TW does not know is kept as typed, spaces collapsed');
ok(CO.normCondition('<script>alert(1)</script>') === 'script alert(1) /script' && !/[<>]/.test(CO.normCondition('<b>x</b>')), 'markup characters go', CO.normCondition('<script>alert(1)</script>'));
ok(CO.normCondition('a\u0000b\u200bc\u202ed') === 'abcd', 'control and direction characters go', CO.normCondition('a\u0000b\u200bc\u202ed'));
ok([...CO.normCondition('x'.repeat(40))].length === CO.COND_LEN && CO.normCondition('Blessed by Pelor, the dawn father') === 'Blessed by Pelor, the da', 'cut to 24 characters', CO.normCondition('Blessed by Pelor, the dawn father'));
ok(CO.normCondition('') === '' && CO.normCondition('   ') === '' && CO.normCondition(null) === '' && CO.normCondition('<>') === '', 'nothing left: empty');
ok(CO.normCondition('Verflucht') === 'Verflucht' && CO.normCondition('呪い') === '呪い', 'any script');

// ---- 2. a whole list, cleaned ----
ok(J(CO.cleanConditions(['Prone', 'prone', 'Hexed', 'hexed', 'exhaustion 2', 'Exhaustion 3'])) === J(['prone', 'Hexed', 'exhaustion 3']), 'repeats go (case-insensitive); the later exhaustion level wins', CO.cleanConditions(['Prone', 'prone', 'Hexed', 'hexed', 'exhaustion 2', 'Exhaustion 3']));
ok(CO.cleanConditions(Array.from({ length: 20 }, (_, i) => `w${i}`)).length === CO.COND_MAX, `at most ${CO.COND_MAX}`);
ok(J(CO.cleanConditions(['', ' ', '<>', 'ok'])) === J(['ok']) && J(CO.cleanConditions('prone')) === '[]', 'empties dropped; not a list: nothing');

// ---- 3. the relay's check: shape, not vocabulary ----
ok(CO.conditionsProblem(['prone', 'Hexed', 'exhaustion 2', 'deafened', 'Blessed by Pelor']) === null, 'any short words pass');
ok(CO.conditionsProblem([]) === null, 'an empty list passes (clears)');
for (const [bad, why] of [[['x'.repeat(25)], 'too long'], [[''], 'empty'], [[' prone'], 'space at an end'], [['a  b'], 'two spaces'], [['<b>'], 'markup'], [['a\u0000'], 'control'], [[7], 'a number'], [['prone', 'Prone'], 'twice'], [['exhaustion 2', 'exhaustion 3'], 'two exhaustion levels'], [['exhaustion 7'], 'exhaustion 7'], [['exhaustion'], 'bare exhaustion'], [Array(13).fill(0).map((_, i) => `w${i}`), 'thirteen'], ['prone', 'not a list']])
  ok(CO.conditionsProblem(bad), `refused: ${why}`, bad);
ok(Array.from({ length: 50 }, (_, i) => CO.cleanConditions([`<x>${'é'.repeat(i)}\u0007`, 'Prone', 'prone ', `exhaustion ${i}`])).every(L => CO.conditionsProblem(L) === null), 'whatever goes in, what cleanConditions gives the relay accepts');

// ---- 4. the looks ----
{
  const s = CO.statusOf(['prone', 'charmed', 'Hexed', 'exhaustion 3', 'concentrating', 'incapacitated', 'invisible']);
  ok(s.pose === 'side' && s.drain === 3 && s.runes && s.dim && s.invisible && J(s.orbit) === J([{ key: 'charmed', art: 'charmed' }, { key: 'hexed', text: 'Hexed' }]), 'statusOf: pose, drain, runes, dim, invisible; orbiters = pictures and text labels', s);
  ok(CO.statusOf(['prone', 'unconscious']).pose === 'back' && CO.statusOf(['prone', 'unconscious']).zzz, 'unconscious beats prone, with Z\'s');
  ok(CO.statusOf(['unconscious', 'dead', 'prone']).pose === 'down' && CO.statusOf(['unconscious', 'dead']).grey && !CO.statusOf(['unconscious', 'dead']).zzz, 'dead beats both: toppled, greyed, no Z\'s');
  ok(CONDITIONS.every(w => CO.hasLook(w)) && ['blinded', 'charmed', 'frightened', 'grappled', 'poisoned', 'restrained', 'stunned', 'paralyzed'].every(w => CO.statusOf([w]).orbit[0]?.art), 'every ring word has a look; the eight orbiters have pictures');
  ok(CO.statusOf(['deafened']).orbit[0]?.text === 'deafened' && CO.statusOf(['petrified']).orbit[0]?.text === 'petrified', 'deafened and petrified (dropped from the design) are text labels');
  const o = CO.orbitShown(CO.statusOf(['charmed', 'stunned', 'poisoned', 'Hexed', 'Blessed', 'blinded']).orbit);
  ok(o.shown.length === 3 && o.more.length === 3 && o.more.some(x => x.text === 'Hexed'), 'past 4: three shown and "+N", text labels counted', o);
  ok(CO.orbitShown(CO.statusOf(['charmed', 'stunned', 'poisoned', 'Hexed']).orbit).more.length === 0, 'four: all shown');
  ok(CO.statusOf(['Prone', 'weird <old>', 42]).pose === 'side', 'an old odd list still draws (case, odd words, a number)');
}

// ---- 5. Beyond20: unmatched words arrive as text labels, exhaustion with its level ----
{
  const a = B.conditionsAfter(['prone', 'Hexed', 'dead'], ['Poisoned', 'Deafened', 'Petrified'], 2);
  ok(J(a) === J(['Hexed', 'dead', 'poisoned', 'deafened', 'petrified', 'exhaustion 2']), 'D&D Beyond\'s words follow D&D Beyond; deafened, petrified arrive; exhaustion 2; TW-only words stay', a);
  ok(J(B.conditionsAfter(a, ['Poisoned'], 0)) === J(['Hexed', 'dead', 'poisoned']), 'gone on D&D Beyond: gone here (deafened, petrified); exhaustion 0 takes it off', B.conditionsAfter(a, ['Poisoned'], 0));
  ok(J(B.conditionsAfter(['exhaustion 2', 'prone'], ['Prone'])) === J(['exhaustion 2', 'prone']), 'no exhaustion number sent: the level stays');
  ok(J(B.conditionsAfter([], ['Exhaustion 3', 'Some Homebrew Thing That Is Long'])) === J(['Some Homebrew Thing That', 'exhaustion 3']), 'a level in the list; an unknown long word cut to 24', B.conditionsAfter([], ['Exhaustion 3', 'Some Homebrew Thing That Is Long']));
  ok(CO.conditionsProblem(B.conditionsAfter(['x'.repeat(30), 'Prone', 'prone'], ['<i>Charmed</i>'], 9)) === null, 'what Beyond20 makes always passes the relay\'s check', B.conditionsAfter(['x'.repeat(30), 'Prone', 'prone'], ['<i>Charmed</i>'], 9));
}

// ---- 6. a real relay: the socket, GET for an AI seat, and an old journal replayed ----
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-cond-'));
process.on('exit', () => fs.rmSync(dataDir, { recursive: true, force: true }));
let relay = await startRelay({ port: 0, dataDir, log: () => { } });
const base = `http://127.0.0.1:${relay.port}`;
const C = await fetch(`${base}/campaigns`, { method: 'POST', body: J({ name: 'Conditions test', gm: 'Harry' }) }).then(r => r.json());
const nacks = [];
const gm = new ClientSync({ token: C.token, transport: wsTransport(`ws://127.0.0.1:${relay.port}/ws`, WebSocket), onNack: (m) => nacks.push(m), onAck: () => { }, onPresence: () => { }, onCampaign: () => { } });
gm.connect(); await waitFor(() => gm.status === 'live'); gm.subscribe(C.area); await waitFor(() => gm.view(C.area));
const P = 'tok_condaaaa001';
gm.submit('token.create', { id: P, name: 'Brakka', x: 2.5, z: 2.5, conditions: ['prone', 'Hexed'] }, C.area);
await waitFor(() => gm.view(C.area).entities[P] && gm.pendingCount() === 0);
ok(J(gm.view(C.area).entities[P].conditions) === J(['prone', 'Hexed']), 'token.create keeps a text label');
gm.submit('token.set', { id: P, conditions: ['prone', 'Hexed', 'deafened', 'exhaustion 2', 'Blessed by Pelor'] }, C.area);
await waitFor(() => gm.pendingCount() === 0);
ok(J(gm.view(C.area).entities[P].conditions) === J(['prone', 'Hexed', 'deafened', 'exhaustion 2', 'Blessed by Pelor']), 'token.set keeps any short words');
const n0 = nacks.length;
for (const bad of [['<script>'], ['x'.repeat(25)], ['a', 'A'], Array(13).fill(0).map((_, i) => `w${i}`), ['exhaustion 8']]) gm.submit('token.set', { id: P, conditions: bad }, C.area);
gm.submit('token.create', { id: 'tok_condaaaa002', name: 'Bad', x: 7.5, z: 2.5, conditions: ['<b>'] }, C.area);
await waitFor(() => gm.pendingCount() === 0); await sleep(150);
ok(nacks.length - n0 === 6 && J(gm.view(C.area).entities[P].conditions) === J(['prone', 'Hexed', 'deafened', 'exhaustion 2', 'Blessed by Pelor']) && !gm.view(C.area).entities.tok_condaaaa002, 'the relay refuses a list of the wrong shape (markup, too long, twice, 13, exhaustion 8), on set and create', nacks.slice(n0).map(n => n.why));
gm.submit('token.set', { id: P, conditions: [] }, C.area); await waitFor(() => gm.pendingCount() === 0);
ok(J(gm.view(C.area).entities[P].conditions) === '[]', 'an empty list clears');
// GET: an AI seat (the GM's assistant), the same addresses the rules card gives it
const cp = `/c/${C.campaign}`, enc = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(typeof v === 'object' ? J(v) : v)}`).join('&');
const gget = (p) => fetch(base + p).then(async r => (r.headers.get('content-type') || '').includes('json') ? r.json() : r.text());
const helper = await gget(`${cp}/do?cmd=seat.create&${enc({ kind: 'llm', name: 'Helper', scope: { areas: '*', classes: '*' } })}&seat=${C.token}`);
const aiTok = helper?.token;
if (aiTok) {
  const r1 = await gget(`${cp}/a/${C.area}/do?cmd=token.set&id=${P}&conditions=${encodeURIComponent('Paralysed,<i>Hexed</i>,Blessed by Pelor the dawn father,exhaustion level 3,prone,Prone')}&nonce=condget0001&seat=${aiTok}`);
  await waitFor(() => J(gm.view(C.area).entities[P].conditions) !== '[]', 3000);
  ok(r1.ok && J(gm.view(C.area).entities[P].conditions) === J(['paralyzed', 'i Hexed /i', 'Blessed by Pelor the daw', 'exhaustion 3', 'prone']), 'GET: an AI seat\'s words are cleaned and kept (TW spelling, markup out, cut, one exhaustion, repeats dropped)', { r1, now: gm.view(C.area).entities[P].conditions });
  const r2 = await gget(`${cp}/a/${C.area}/do?cmd=token.set&id=${P}&conditions=&nonce=condget0002&seat=${aiTok}`); await waitFor(() => J(gm.view(C.area).entities[P].conditions) === '[]', 3000);
  ok(r2.ok && J(gm.view(C.area).entities[P].conditions) === '[]', 'GET: conditions= clears', r2);
  const r3 = await gget(`${cp}/a/${C.area}/do?cmd=token.set&id=${P}&conditions=${encodeURIComponent(J(['Hexed, cursed', 'prone']))}&nonce=condget0003&seat=${aiTok}`); await waitFor(() => (gm.view(C.area).entities[P].conditions || []).length === 2, 3000);
  ok(r3.ok && J(gm.view(C.area).entities[P].conditions) === J(['Hexed, cursed', 'prone']), 'GET: a JSON list may hold a comma', r3);
  const help = await gget(`${cp}/conditions?seat=${aiTok}`);
  ok(help?.conditions?.includes('dead') && /any short text/i.test(help.how) && /text label/.test(help.other), 'GET /conditions: the words with a look, and that any short text is a label', help);
  const card = await gget(`${cp}/card?seat=${aiTok}`);
  ok(typeof card === 'string' && /(ANY|Any) (other )?short text/.test(card), 'the rules card says any short text is allowed', typeof card === 'string' ? card.match(/CONDITIONS[^\n]*/)?.[0] : card);
} else ok(false, 'could not make an AI seat for the GET checks', helper);
// an old journal: a record written before the shape rule (a 30-character word, markup, a number) replays as written
{
  const rt = relay.campaigns.get(C.campaign);
  const T = rt.state.areas[C.area], old = ['Prone', 'x'.repeat(30), '<old>', 'prone'];
  rt.commit({ by: Object.keys(rt.state.seats)[0], cid: null, fx: [{ area: C.area, seq: T.seq + 1, type: 'token.set', args: { id: P, conditions: old } }] });
  await relay.close?.(); relay = await startRelay({ port: 0, dataDir, log: () => { } });
  const rt2 = relay.campaigns.get(C.campaign);
  const got = (rt2.state || (await rt2.load?.(), rt2.state))?.areas?.[C.area]?.entities?.[P]?.conditions;
  ok(J(got) === J(old), 'an old journal\'s record with an odd list replays exactly as written (apply never checks words)', got);
  ok(CO.statusOf(got).pose === 'side', 'and it still draws');
}
// the frozen corpus: every saved pawn's list draws, and the ones the new shape rule would refuse are counted (they load as they are)
{
  const dir = corpusDir(); let pawns = 0, withC = 0, refuse = 0, threw = 0;
  for (const c of fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => x.startsWith('cmp_')) : []) {
    const f = path.join(dir, c, 'snapshot.json'); if (!fs.existsSync(f)) continue;
    let snap; try { snap = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    const walk = (o) => { if (!o || typeof o !== 'object') return; if (o.kind === 'token' && typeof o.id === 'string') { pawns++; if (o.conditions?.length) { withC++; try { CO.statusOf(o.conditions); } catch { threw++; } if (CO.conditionsProblem(o.conditions)) refuse++; } return; } for (const v of Object.values(o)) walk(v); };
    walk(snap.state || snap);
  }
  console.log(`  (corpus: ${pawns} pawns, ${withC} with conditions, ${refuse} of those the new check would refuse: they load and draw as they are)`);
  ok(threw === 0, 'every saved list draws', { threw });
}
await relay.close?.();
console.log(`conditions: ${checks - fails}/${checks}`);
process.exit(fails ? 1 : 0);

// Browser-local seat history contracts, with storage faults and other-tab edits.
// node --test engine/test/games.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES_KEY, rememberedGames, rememberGame, dropGame, forgetGames } from '../client/games.js';

function storage(t) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map();
  const store = { getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: store });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  });
  return store;
}
const row = (token, lastUsed = 100) => ({ token, campaign: 'cmp_' + token,
  name: 'The Test Campaign', seat: 'GM', role: 'gm', lastUsed });
const campaign = (name = 'New name') => ({ id: 'cmp_alpha', name, my: { name: 'New seat', role: 'player' } });

test('storage getter denial, method denial and missing storage never block joining or forgetting', t => {
  storage(t);
  const check = () => {
    assert.deepEqual(rememberedGames(), []);
    assert.doesNotThrow(() => rememberGame('alpha', campaign(), true));
    assert.doesNotThrow(() => dropGame('alpha'));
    assert.doesNotThrow(() => forgetGames());
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('denied'); } });
  check();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('denied'); },
  } });
  check();
  delete globalThis.localStorage;
  check();
});

test('failed writes preserve readable saved games without throwing', t => {
  const store = storage(t);
  store.setItem(GAMES_KEY, JSON.stringify([row('alpha')]));
  store.setItem = () => { throw Error('quota'); };
  assert.doesNotThrow(() => rememberGame('beta', campaign(), true));
  assert.deepEqual(rememberedGames(), [row('alpha')]);
});

test('malformed JSON, non-arrays and malformed records are ignored', t => {
  const store = storage(t);
  for (const raw of ['{', 'null', '{}', '42', '"text"']) {
    store.setItem(GAMES_KEY, raw);
    assert.deepEqual(rememberedGames(), []);
  }
  const malformed = [null, false, 4, {}, ...['campaign', 'token', 'name', 'seat', 'role'].map(k => ({ ...row('bad'), [k]: null })),
    ...[0, -1, '100', null].map(lastUsed => ({ ...row('bad'), lastUsed })),
    { ...row('bad'), token: '' }, { ...row('bad'), campaign: '' }];
  store.setItem(GAMES_KEY, JSON.stringify([...malformed, row('alpha')]));
  assert.deepEqual(rememberedGames(), [row('alpha')]);
});

test('history sorts newest first and keeps newest duplicate token while preserving different seats', t => {
  const store = storage(t);
  const otherSeat = { ...row('beta', 200), campaign: 'cmp_alpha', role: 'player' };
  store.setItem(GAMES_KEY, JSON.stringify([row('alpha', 50), otherSeat, row('alpha', 300)]));
  assert.deepEqual(rememberedGames(), [row('alpha', 300), otherSeat]);
  dropGame('alpha');
  assert.deepEqual(rememberedGames(), [otherSeat]);
});

test('successful joins record metadata and time; later metadata updates do not reorder history', t => {
  const store = storage(t);
  store.setItem(GAMES_KEY, JSON.stringify([row('beta', 200), row('alpha', 100)]));
  rememberGame('alpha', campaign());
  assert.deepEqual(rememberedGames().map(g => [g.token, g.lastUsed]), [['beta', 200], ['alpha', 100]]);
  assert.deepEqual(rememberedGames()[1], { ...row('alpha'), name: 'New name', seat: 'New seat', role: 'player' });
  const before = Date.now();
  rememberGame('alpha', campaign(), true);
  const joined = rememberedGames();
  assert.equal(joined[0].token, 'alpha');
  assert.ok(joined[0].lastUsed >= before && joined[0].lastUsed <= Date.now());
  assert.equal(joined.length, 2);
});

test('forget removes only game history; idle updates do not restore it after another tab forgets', t => {
  const store = storage(t);
  store.setItem('tw.prefs', '{"theme":"light"}');
  rememberGame('alpha', campaign(), true);
  forgetGames();
  assert.equal(store.getItem(GAMES_KEY), null);
  assert.equal(store.getItem('tw.prefs'), '{"theme":"light"}');
  rememberGame('alpha', campaign('Later rename'));
  assert.deepEqual(rememberedGames(), []);
  // An independent tab's join survives this tab refreshing its old seat metadata.
  store.setItem(GAMES_KEY, JSON.stringify([row('beta', 200)]));
  rememberGame('alpha', campaign('Another rename'));
  assert.deepEqual(rememberedGames(), [row('beta', 200)]);
  // A new successful join is a deliberate re-entry and may remember the seat again.
  rememberGame('alpha', campaign(), true);
  assert.deepEqual(rememberedGames().map(g => g.token), ['alpha', 'beta']);
});

test('edits read fresh storage so another tab joining is not lost', t => {
  const store = storage(t);
  store.setItem(GAMES_KEY, JSON.stringify([row('alpha', 100)]));
  rememberedGames();
  store.setItem(GAMES_KEY, JSON.stringify([row('beta', 200), row('alpha', 100)]));
  rememberGame('alpha', campaign());
  assert.deepEqual(rememberedGames().map(g => g.token), ['beta', 'alpha']);
  dropGame('alpha');
  assert.deepEqual(rememberedGames(), [row('beta', 200)]);
});

test('campaign and seat names remain literal data, even when they resemble executable markup', t => {
  storage(t);
  const name = '<img src=x onerror="globalThis.__twInjected=true">';
  const c = campaign(name);
  c.my.name = '</button><script>globalThis.__twInjected=true</script>';
  rememberGame('alpha', c, true);
  assert.equal(rememberedGames()[0].name, name);
  assert.equal(rememberedGames()[0].seat, c.my.name);
  assert.equal(globalThis.__twInjected, undefined);
});

test('missing campaign or seat metadata does not corrupt existing history', t => {
  const store = storage(t);
  store.setItem(GAMES_KEY, JSON.stringify([row('alpha')]));
  for (const c of [null, {}, { id: 'cmp_alpha' }]) rememberGame('alpha', c, true);
  assert.deepEqual(rememberedGames(), [row('alpha')]);
});

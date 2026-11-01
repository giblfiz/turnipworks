// The table's music (2026-10-30; core/commands.js music.set, client/music.js): the command, its clock, permissions, the
// GET API, replay after a restart, the relay's clock in pong, and the client's timeline (shuffle, offsets, matching).
//   node engine/test/music.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { REGISTRY, checkCommand } from '../core/commands.js';
import { newCampaign, projectCampaign, areaRules } from '../core/state.js';
import { startRelay } from '../relay/server.js';
import { musicAt, matchTrack, shuffled } from '../client/music.js';

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); } else if (process.env.V) console.log('ok', m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m, { got: a, want: b });

// ---- the reducer: pure, with the record's time ----
{
  let S = newCampaign('cmp_music0001', 'Music');
  const camp = (type, args, by = null, at = 0) => { S = REGISTRY[type].apply(S, args, { by, at }); };
  camp('area.create', { id: 'tbl_inn00001', name: 'Inn', visibility: 'open' });
  camp('area.create', { id: 'tbl_crypt001', name: 'Crypt', visibility: 'open' });
  const GM = 'seat_gm000001', P1 = 'seat_pl000001';
  camp('seat.create', { id: GM, kind: 'human', role: 'gm', name: 'Harry', location: 'tbl_inn00001' });
  camp('seat.create', { id: P1, kind: 'human', role: 'player', name: 'Brakka', location: 'tbl_inn00001' }, GM);
  const run = (by, args, at) => { const err = checkCommand({ state: S, by }, { type: 'music.set', args }); if (!err) camp('music.set', args, by, at); return err; };
  eq(areaRules(S, 'tbl_inn00001').music, '', 'built-in: Off (Harry 2026-10-30, "area defaults to off")');
  eq(run(P1, { area: 'tbl_inn00001', music: 'playlist' })?.code, 'forbidden', 'a player may not change the table\'s music');
  eq(run(P1, { default: true, music: 'playlist' })?.code, 'forbidden', 'nor the campaign default');
  ok(/needs an area/.test(run(GM, { music: 'playlist' })?.why || ''), 'an area or default=true is needed');
  ok(/say music=/.test(run(GM, { area: 'tbl_inn00001' })?.why || ''), 'music= or next= is needed');
  ok(/no area/.test(run(GM, { area: 'tbl_nope0001', music: 'x' })?.why || ''), 'an unknown area is refused');
  ok(!run(GM, { default: true, music: 'playlist' }, 1000), 'the GM sets the campaign default');
  eq([areaRules(S, 'tbl_inn00001').music, areaRules(S, 'tbl_crypt001').music, S.musicClock], ['playlist', 'playlist', { at: 1000, seed: 1000 }], 'every area inherits it, on the campaign clock');
  ok(!run(GM, { area: 'tbl_crypt001', music: 'black-mass' }, 2000), 'the crypt gets The Black Mass');
  eq([S.areas.tbl_crypt001.settings.music, S.areas.tbl_crypt001.musicClock, areaRules(S, 'tbl_inn00001').music], ['black-mass', { at: 2000, seed: 2000 }, 'playlist'], 'the crypt\'s own setting and clock; the inn still inherits');
  ok(!run(GM, { area: 'tbl_inn00001', next: 'tasty-turnip' }, 3000), 'next track in the inheriting inn');
  eq([S.musicClock, S.areas.tbl_inn00001.musicClock], [{ at: 3000, seed: 1000, first: 'tasty-turnip' }, undefined], 'next moves the clock that plays there (the campaign\'s), keeping the shuffle seed');
  ok(!run(GM, { area: 'tbl_crypt001', music: 'off' }, 4000) && S.areas.tbl_crypt001.settings.music === '', '"off" is stored as Off here (not the default)');
  ok(!run(GM, { area: 'tbl_crypt001', music: 'default' }, 5000) && !('music' in S.areas.tbl_crypt001.settings) && areaRules(S, 'tbl_crypt001').music === 'playlist', '"default" goes back to the campaign\'s');
  ok(/no default of its own/.test(run(GM, { default: true, music: 'default' })?.why || ''), 'the default cannot inherit');
  // the other doors still start a clock (Settings used area.set before music.set existed; old journals replay)
  camp('area.set', { area: 'tbl_crypt001', settings: { music: 'in-the-dark-soil' } }, GM, 6000);
  eq(S.areas.tbl_crypt001.musicClock, { at: 6000, seed: 6000 }, 'area.set with music starts a clock');
  camp('area.set', { area: 'tbl_crypt001', settings: { light: 'night' } }, GM, 7000);
  eq(S.areas.tbl_crypt001.musicClock, { at: 6000, seed: 6000 }, 'area.set without music leaves it');
  const before = S; S = REGISTRY['area.set'].apply(S, { area: 'tbl_inn00001', settings: { music: 'x' } }, { by: GM });
  eq(S.areas.tbl_inn00001.musicClock, { at: 0, seed: 0 }, 'a record without a time (old callers) gives a zero clock: the client starts at the top'); S = before;
  const pv = projectCampaign(S, P1);
  ok(pv.musicClock?.at === 3000 && pv.areas.find(a => a.id === 'tbl_crypt001').musicClock?.at === 6000 && pv.defaults.music === 'playlist', 'players receive the setting and both clocks');
}

// ---- the client's timeline ----
{
  const T = [{ id: 'a', name: "The Wizard's Roots", sec: 100 }, { id: 'b', name: 'Buried in the Earth', sec: 200 }, { id: 'c', name: 'The Black Mass', sec: 50 }];
  eq(shuffled(['a', 'b', 'c', 'd'], 'k'), shuffled(['a', 'b', 'c', 'd'], 'k'), 'the shuffle is the same at every seat');
  ok(['wizards roots', "The Wizard's Roots", 'a', 'WIZARD’S ROOTS'].every(v => matchTrack(T, v)?.id === 'a'), 'a track by id or name (case, apostrophes, "the")');
  ok(!matchTrack(T, 'tavern') && !matchTrack(T, 'roots') && !musicAt(T, 'tavern', null, 'x', 0), 'an old free-text value plays nothing');
  ok(musicAt(T, '', { at: 1 }, 'x', 5e3) === null && musicAt([], 'playlist', null, 'x', 0) === null, 'off, or no tracks: silence');
  const s = musicAt(T, 'black mass', { at: 1000, seed: 1000 }, 'x', 1000 + 120e3);
  eq([s.id, s.off, s.single], ['c', 20, true], 'one track loops: 120 s in a 50 s track is 20 s in');
  const p0 = musicAt(T, 'playlist', { at: 1000, seed: 7 }, 'x', 1000), seg0 = T.find(t => t.id === p0.id).sec - 3;
  const p1 = musicAt(T, 'playlist', { at: 1000, seed: 7 }, 'x', 1000 + (seg0 + 1) * 1000);
  eq([p0.off, p1.idx, p1.id, p1.off], [0, 1, p0.order[1], 1], 'a playlist moves on 3 s before a track ends (the crossfade)');
  const j = musicAt(T, 'playlist', { at: 1000, seed: 7, first: p0.order[2] }, 'x', 1000);
  eq([j.id, j.order[1]], [p0.order[2], p0.order[0]], 'next= starts there and keeps the order');
  const late = musicAt(T, 'playlist', { at: 1000, seed: 7 }, 'x', 1000 + 1e6);
  ok(late.idx > 2 && late.off >= 0, 'a seat that joins much later lands in the right place');
}

// ---- the relay: GET API, the journal's time, a restart, the clock in pong ----
{
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-music-'));
  process.on('exit', () => fs.rmSync(dataDir, { recursive: true, force: true }));
  let relay = await startRelay({ port: 0, dataDir, log: () => {} });
  let base = `http://127.0.0.1:${relay.port}`;
  const get = (p) => fetch(base + p).then(async r => ({ status: r.status, body: (r.headers.get('content-type') || '').includes('json') ? await r.json() : await r.text() }));
  const C = await fetch(base + '/campaigns', { method: 'POST', body: JSON.stringify({ name: 'TEST music (throwaway)', gm: 'GM' }) }).then(r => r.json());
  const cp = `/c/${C.campaign}`, A = C.area;
  const enc = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(typeof v === 'object' ? JSON.stringify(v) : v)}`).join('&');
  let n = 0;
  const act = async (tok, cmd, args) => (await get(`${cp}/do?cmd=${cmd}&${enc(args)}&nonce=m${++n}&seat=${tok}`)).body;
  const gmAi = (await get(`${cp}/do?cmd=seat.create&${enc({ kind: 'llm', name: 'Helper', scope: { areas: '*', classes: '*' } })}&seat=${C.token}`)).body;
  const plSeat = (await get(`${cp}/do?cmd=seat.create&${enc({ kind: 'human', role: 'player', name: 'Brakka' })}&seat=${C.token}`)).body;
  ok(gmAi.token && plSeat.token, 'a GM AI seat and a player', { gmAi, plSeat });
  const rt = () => relay.campaigns.get(C.campaign);
  eq(projectCampaign(rt().state, Object.keys(rt().state.seats)[0]).defaults.music ?? '', '', 'a new campaign plays nothing');
  const t0 = Date.now();
  const r1 = await act(gmAi.token, 'music.set', { area: A, music: 'The Black Mass' });
  ok(r1.ok, 'a GM AI seat sets the area music over GET (no browser)', r1);
  const ck = rt().state.areas[A].musicClock;
  ok(rt().state.areas[A].settings.music === 'The Black Mass' && ck && ck.at >= t0 && ck.at <= Date.now(), 'stored, with the relay\'s own time', ck);
  const r2 = await act(plSeat.token, 'music.set', { area: A, music: 'playlist' });
  ok(!r2.ok, 'a player may not', r2);
  const r3 = await act(gmAi.token, 'music.set', { default: 'true', music: 'playlist' });
  ok(r3.ok && rt().state.defaults.music === 'playlist', 'the campaign default over GET (default=true)', r3);
  const r4 = await act(gmAi.token, 'area.set', { area: A, music: 'default' });
  ok(r4.ok && !('music' in rt().state.areas[A].settings), 'area.set music=default still works (the older door)', r4);
  const r5 = await act(gmAi.token, 'music.set', { area: A, next: 'tasty-turnip' });
  ok(r5.ok && rt().state.musicClock.first === 'tasty-turnip', 'next track on the campaign clock', r5);
  const help = (await get(`${cp}/help/areas?seat=${gmAi.token}`)).body;
  ok(/music\.set/.test(help), 'the areas help page says how', help.slice(0, 200));
  const want = JSON.stringify({ d: rt().state.defaults, c: rt().state.musicClock, a: rt().state.areas[A].musicClock });
  await relay.close();
  relay = await startRelay({ port: 0, dataDir, log: () => {} }); base = `http://127.0.0.1:${relay.port}`;
  await get(`${cp}/a/${A}/scene?seat=${gmAi.token}`); // (loads the campaign)
  eq(JSON.stringify({ d: rt().state.defaults, c: rt().state.musicClock, a: rt().state.areas[A].musicClock }), want, 'a restart replays the journal to the same music and clocks');
  // pong carries the relay's time
  const ws = new WebSocket(`ws://127.0.0.1:${relay.port}/ws`), frames = [];
  await new Promise(r => ws.on('open', r)); ws.on('message', d => frames.push(JSON.parse(String(d))));
  ws.send(JSON.stringify({ t: 'hello', token: plSeat.token }));
  const sent = Date.now(); ws.send(JSON.stringify({ t: 'ping', ts: sent }));
  for (let i = 0; i < 100 && !frames.some(f => f.t === 'pong'); i++) await new Promise(r => setTimeout(r, 20));
  const pong = frames.find(f => f.t === 'pong');
  ok(pong && pong.ts === sent && Math.abs(pong.now - Date.now()) < 2000, 'pong says the relay\'s time', pong);
  const camp = frames.find(f => f.t === 'welcome')?.campaign;
  ok(camp?.defaults?.music === 'playlist' && camp?.musicClock?.first === 'tasty-turnip', 'a joining seat gets the music and its clock in welcome', camp && { d: camp.defaults, c: camp.musicClock });
  ws.close(); await relay.close();
}

console.log(`music: ${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

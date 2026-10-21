// A throwaway relay for a live trial of the GET API with a small model (README.md "The live trial").
//   node experiments/2026-10-20-llm-api/trial_relay.mjs [port] [outdir]
// Starts a relay (its own temp data, the real room engine) on 127.0.0.1:<port> (default 8199), builds a small inn
// (a named common room with its lights put out, a kitchen), seats a GM assistant with every class, writes its rules
// card to <outdir>/card.txt and the facts to check the trial against to <outdir>/trial.json, then keeps running
// until killed. Nothing here touches the dev or prod relays or Harry's house look.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { startRelay } = await import(path.join(HERE, '..', '..', 'engine', 'relay', 'server.js'));
const port = Number(process.argv[2] || 8199), out = process.argv[3] || HERE;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-trial-'));
const relay = await startRelay({ port, host: '127.0.0.1', dataDir, log: () => {} });
const base = `http://127.0.0.1:${relay.port}`;
const get = (p) => fetch(base + p).then(r => r.json());
const C = await fetch(base + '/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Trial Inn', gm: 'Harry' }) }).then(r => r.json());
const cp = `/c/${C.campaign}`, A = C.area;
const ai = await get(`${cp}/do?cmd=seat.create&kind=llm&name=Helper&scope=${encodeURIComponent(JSON.stringify({ areas: '*', classes: '*' }))}&seat=${C.token}`);
const room = (t, x, w, d, name) => get(`${cp}/a/${A}/do?cmd=room.spawn&type=${t}&x=${x}&z=0&w=${w}&d=${d}&seed=${x + 3}${name ? `&name=${encodeURIComponent(name)}` : ''}&nonce=r${x}&seat=${C.token}`);
const inn = await room('common', 0, 30, 25, 'The Gilded Goose'), kitchen = await room('kitchen', 30, 20, 25);
const rt = relay.campaigns.get(C.campaign);
const lights = Object.values(rt.state.areas[A].entities).filter(e => e.kind === 'object' && /candle|lantern|lamp|chandelier|torch|sconce/.test(e.cat || ''));
for (const [i, l] of lights.entries()) await get(`${cp}/a/${A}/do?cmd=object.light&id=${l.id}&lit=false&nonce=dark${i}&seat=${C.token}`);
const card = await fetch(`${base}${cp}/card?seat=${ai.token}`).then(r => r.text());
fs.writeFileSync(path.join(out, 'card.txt'), card);
fs.writeFileSync(path.join(out, 'trial.json'), JSON.stringify({ base, campaign: C.campaign, area: A, gmToken: C.token, aiSeat: ai.id, inn: inn.id, kitchen: kitchen.id, lightsOut: lights.map(l => ({ id: l.id, cat: l.cat, room: l.room })), cardChars: card.length }, null, 1));
console.log(`trial relay on ${base}; campaign ${C.campaign}; card ${card.length} chars -> ${path.join(out, 'card.txt')}`);
process.on('SIGTERM', async () => { await relay.close(); fs.rmSync(dataDir, { recursive: true, force: true }); process.exit(0); });
process.on('SIGINT', async () => { await relay.close(); fs.rmSync(dataDir, { recursive: true, force: true }); process.exit(0); });

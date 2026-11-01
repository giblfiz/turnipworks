// Mint LOCAL seat tokens for a copied campaign, with the local relay's own secret (they are good on that relay only).
// Writes them to <data>/local-tokens.json and prints nothing secret.
//   node mint.mjs <data dir> <campaign id> <seat id>...
import fs from 'node:fs'; import path from 'node:path';
const { makeTokens } = await import(new URL('../../engine/relay/tokens.js', import.meta.url).href);
const [data, cid, ...seats] = process.argv.slice(2);
const T = makeTokens(fs.readFileSync(path.join(data, 'secret'), 'utf8').trim());
const S = JSON.parse(fs.readFileSync(path.join(data, cid, 'snapshot.json'), 'utf8')).state;
const out = {}; for (const s of seats) out[s] = T.mint(cid, S.seats[s]);
fs.writeFileSync(path.join(data, 'local-tokens.json'), JSON.stringify(out), { mode: 0o600 });
console.log('minted', Object.keys(out).length);

// Stable IDs (principle 3). An ID is minted once, by whoever creates the thing, and never changes.
// Client-minted IDs let a creator apply its own command optimistically before the relay has seen it;
// the relay refuses a duplicate, so uniqueness is still enforced in one place.
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function randomChars(n) {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += ALPHABET[b % 36];
  return s;
}

// prefix: 'tok' token, 'room' room, 'obj' placed object, 'area' area (older areas kept their 'tbl' ids), 'seat' seat, 'cmp' campaign, 'c' client command
export function newId(prefix, n = 10) {
  return `${prefix}_${randomChars(n)}`;
}

export const ID_RE = /^[a-z]{1,6}_[0-9a-z]{4,24}$/;
export const isId = (s) => typeof s === 'string' && ID_RE.test(s);
